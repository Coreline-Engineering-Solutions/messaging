import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subject, Subscription, forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { MessagingApiService } from './messaging-api.service';
import { MessagingWebSocketService } from './messaging-websocket.service';
import {
  InboxItem,
  Message,
  Attachment,
  Contact,
  ChatWindow,
  WebSocketMessage,
  SidebarSide,
  getContactDisplayName,
  getMessageSenderName,
} from '../models/messaging.models';

@Injectable({ providedIn: 'root' })
export class MessagingStoreService implements OnDestroy {
  // ── State subjects ──
  private inbox$ = new BehaviorSubject<InboxItem[]>([]);
  private messagesMap$ = new BehaviorSubject<Map<string, Message[]>>(new Map());
  private openChats$ = new BehaviorSubject<ChatWindow[]>([]);
  private visibleContacts$ = new BehaviorSubject<Contact[]>([]);
  private panelOpen$ = new BehaviorSubject<boolean>(false);
  private activeView$ = new BehaviorSubject<'inbox' | 'chat' | 'new-conversation' | 'group-manager' | 'conversation-settings'>('inbox');
  private sidebarSide$ = new BehaviorSubject<SidebarSide>(
    (localStorage.getItem('messaging_sidebar_side') as SidebarSide) || 'right'
  );
  private activeConversationId$ = new BehaviorSubject<string | null>(null);
  private pendingDmRecipient$ = new BehaviorSubject<{contactId: string, name: string} | null>(null);
  private totalUnread$ = new BehaviorSubject<number>(0);
  private loadingMessages$ = new BehaviorSubject<boolean>(false);
  private panelPosition$ = new BehaviorSubject<{ x: number; y: number } | null>(null);
  private panelSize$ = new BehaviorSubject<{ width: number; height: number }>({ width: 380, height: 560 });
  private wasOpenBeforeDrag$ = new BehaviorSubject<boolean>(false);

  // ── Public observables ──
  readonly inbox = this.inbox$.asObservable();
  readonly messagesMap = this.messagesMap$.asObservable();
  readonly openChats = this.openChats$.asObservable();
  readonly visibleContacts = this.visibleContacts$.asObservable();
  readonly panelOpen = this.panelOpen$.asObservable();
  readonly activeView = this.activeView$.asObservable();
  readonly activeConversationId = this.activeConversationId$.asObservable();
  readonly totalUnread = this.totalUnread$.asObservable();
  readonly loadingMessages = this.loadingMessages$.asObservable();
  wsStatus: Observable<string> = new Observable<string>();
  readonly panelPosition = this.panelPosition$.asObservable();
  readonly panelSize = this.panelSize$.asObservable();
  readonly wasOpenBeforeDrag = this.wasOpenBeforeDrag$.asObservable();
  readonly sidebarSide = this.sidebarSide$.asObservable();

  private wsSub: Subscription | null = null;
  private destroy$ = new Subject<void>();
  private pollTimer: any = null;
  private groupSettings$ = new BehaviorSubject<{ conversationId: string; name: string } | null>(null);

  readonly groupSettings = this.groupSettings$.asObservable();

  constructor(
    private auth: AuthService,
    private api: MessagingApiService,
    private wsService: MessagingWebSocketService
  ) {
    (this as any).wsStatus = this.wsService.status$;
  }

  // ── Initialization ──
  initialize(): void {
    if (!this.auth.isAuthenticated()) return;

    const contactId = this.auth.contactId!;
    const sessionGid = this.auth.sessionGid!;

    this.loadInbox();
    this.loadVisibleContacts();

    this.wsService.connect(contactId, sessionGid);
    this.listenWebSocket();
    this.startPolling();
  }

  teardown(): void {
    this.stopPolling();
    this.wsService.disconnect();
    this.wsSub?.unsubscribe();
    this.inbox$.next([]);
    this.messagesMap$.next(new Map());
    this.openChats$.next([]);
    this.panelOpen$.next(false);
    this.activeView$.next('inbox');
    this.activeConversationId$.next(null);
    this.totalUnread$.next(0);
  }

  // ── Polling fallback (inbox only - messages rely on WebSocket) ──
  private startPolling(): void {
    this.stopPolling();
    this.pollTimer = setInterval(() => {
      this.loadInbox();
    }, 30000);
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  ngOnDestroy(): void {
    this.teardown();
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Panel controls ──
  togglePanel(buttonX?: number, buttonY?: number): void {
    if (buttonX !== undefined && buttonY !== undefined) {
      this.panelPosition$.next({ x: buttonX, y: buttonY });
    }
    this.panelOpen$.next(!this.panelOpen$.value);
  }

  openPanel(buttonX?: number, buttonY?: number): void {
    if (buttonX !== undefined && buttonY !== undefined) {
      this.panelPosition$.next({ x: buttonX, y: buttonY });
    }
    this.panelOpen$.next(true);
  }

  closePanel(): void {
    this.panelOpen$.next(false);
  }

  setPanelSize(width: number, height: number): void {
    this.panelSize$.next({ width, height });
    localStorage.setItem('messaging_panel_size', JSON.stringify({ width, height }));
  }

  getPanelSize(): { width: number; height: number } {
    const saved = localStorage.getItem('messaging_panel_size');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.width && parsed.height) {
          this.panelSize$.next(parsed);
          return parsed;
        }
      } catch {}
    }
    return this.panelSize$.value;
  }

  onButtonDragStart(): void {
    this.wasOpenBeforeDrag$.next(this.panelOpen$.value);
    if (this.panelOpen$.value) {
      this.panelOpen$.next(false);
    }
  }

  onButtonDragEnd(buttonX: number, buttonY: number): void {
    if (this.wasOpenBeforeDrag$.value) {
      this.openPanel(buttonX, buttonY);
    }
  }

  setView(view: 'inbox' | 'chat' | 'new-conversation' | 'group-manager' | 'conversation-settings'): void {
    this.activeView$.next(view);
  }

  toggleSidebarSide(): void {
    const next = this.sidebarSide$.value === 'right' ? 'left' : 'right';
    this.sidebarSide$.next(next);
    localStorage.setItem('messaging_sidebar_side', next);
  }

  getSidebarSide(): SidebarSide {
    return this.sidebarSide$.value;
  }

  // ── Inbox ──
  loadInbox(): void {
    const contactId = this.auth.contactId;
    if (!contactId) return;

    this.api.getInbox(contactId).subscribe({
      next: (items) => {
        const mapped = items.map(item => {
          const isGroup = item.is_group === true || (item.is_group as any) === 'True';
          
          if (!isGroup && !item.name && item.other_participant_name) {
            return { ...item, name: item.other_participant_name, is_group: false };
          }
          return { ...item, is_group: isGroup };
        });
        this.inbox$.next(mapped);
        this.recalcUnread(mapped);

        const ids = mapped.map((i) => i.conversation_id);
        this.wsService.subscribeAll(ids);
      },
      error: () => {},
    });
  }

  // ── Contacts ──
  loadVisibleContacts(): void {
    const contactId = this.auth.contactId;
    if (!contactId) return;

    this.api.getVisibleContacts(contactId).subscribe({
      next: (contacts) => {
        this.visibleContacts$.next(contacts);
        
        const currentContact = this.auth.currentContact;
        if (currentContact && currentContact.email) {
          const match = contacts.find(c => c.email === currentContact.email);
          if (match && match.contact_id !== currentContact.contact_id) {
            this.auth.setSession(this.auth.sessionGid!, { ...currentContact, contact_id: match.contact_id });
            
            this.wsService.disconnect();
            this.wsService.connect(match.contact_id, this.auth.sessionGid!);
          }
        }
      },
      error: () => {},
    });
  }

  // ── Conversations ──
  openConversation(conversationId: string, name: string, isGroup = false): void {
    if (!conversationId || conversationId === 'undefined') {
      return;
    }
    this.activeConversationId$.next(conversationId);
    this.activeView$.next('chat');
    this.openPanel();

    const chats = this.openChats$.value;
    if (!chats.find((c) => c.conversationId === conversationId)) {
      this.openChats$.next([
        ...chats,
        { conversationId, name, isGroup, isMinimized: false, unreadCount: 0 },
      ]);
    }

    const existing = this.messagesMap$.value.get(conversationId);
    if (existing && existing.length > 0) {
      // Already cached — silent background refresh for new messages, skip reaction hydration
      this.loadMessages(conversationId, undefined, true);
    } else {
      this.loadMessages(conversationId);
    }
    this.markAsRead(conversationId);
    this.wsService.subscribe(conversationId);
  }

  closeChat(conversationId: string): void {
    const chats = this.openChats$.value.filter((c) => c.conversationId !== conversationId);
    this.openChats$.next(chats);

    if (this.activeConversationId$.value === conversationId) {
      this.activeConversationId$.next(null);
      this.activeView$.next('inbox');
    }
  }

  // ── Messages ──
  loadMessages(conversationId: string, beforeMessageId?: string, skipReactionHydration = false): void {
    if (!conversationId || conversationId === 'undefined') {
      return;
    }
    const contactId = this.auth.contactId;
    if (!contactId) return;

    this.loadingMessages$.next(true);

    this.api.getMessages(conversationId, contactId, beforeMessageId, 50).subscribe({
      next: (messages) => {
        const map = new Map(this.messagesMap$.value);
        const existing = map.get(conversationId) || [];

        const normalized = messages.map((m: any) => this.normalizeMessageShape(m));
        const sorted = [...normalized].sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );

        if (beforeMessageId) {
          // Prepend older messages, preserving existing reactions
          const merged = [...sorted, ...existing];
          map.set(conversationId, merged);
        } else if (skipReactionHydration) {
          // Silent refresh — merge new messages but preserve existing reaction state
          const existingById = new Map(existing.map(m => [String(m.message_id), m]));
          const merged = sorted.map(m => {
            const cached = existingById.get(String(m.message_id));
            return cached ? { ...m, reactions: cached.reactions } : m;
          });
          map.set(conversationId, merged);
        } else {
          map.set(conversationId, sorted);
        }

        this.messagesMap$.next(map);
        if (!skipReactionHydration) {
          this.hydrateReactionsForConversation(conversationId, map.get(conversationId) || []);
        }
        this.loadingMessages$.next(false);
      },
      error: () => {
        this.loadingMessages$.next(false);
      },
    });
  }

  sendMessage(conversationId: string | null, content: string, messageType: 'TEXT' | 'IMAGE' = 'TEXT'): void {
    const contactId = this.auth.contactId;
    if (!contactId) return;

    const pending = this.pendingDmRecipient$.value;
    if (!conversationId && pending) {
      this.sendDirectMessage(pending.contactId, content);
      this.pendingDmRecipient$.next(null);
      const chats = this.openChats$.value.filter(c => c.conversationId !== 'pending');
      this.openChats$.next(chats);
      return;
    }

    if (!conversationId) return;

    this.api.sendMessage(conversationId, contactId, content, messageType).subscribe({
      next: (res) => {
        const optimistic: Message = {
          message_id: 'temp-' + Date.now(),
          conversation_id: conversationId,
          sender_id: contactId,
          sender_name: 'You',
          message_type: messageType,
          content,
          created_at: new Date().toISOString(),
          is_read: true,
        };
        this.appendMessage(optimistic);
      },
      error: () => {},
    });
  }

  openDirectConversation(recipientContactId: string, displayName: string): void {
    const existing = this.inbox$.value.find(item => 
      !item.is_group && item.name === displayName
    );
    
    if (existing) {
      this.pendingDmRecipient$.next(null);
      this.openConversation(existing.conversation_id, displayName, false);
    } else {
      this.pendingDmRecipient$.next({contactId: recipientContactId, name: displayName});
      this.activeConversationId$.next(null);
      this.activeView$.next('chat');
      this.openPanel();
      
      const chats = this.openChats$.value;
      if (!chats.find(c => c.conversationId === 'pending')) {
        this.openChats$.next([...chats, {
          conversationId: 'pending',
          name: displayName,
          isGroup: false,
          isMinimized: false,
          unreadCount: 0
        }]);
      }
    }
  }

  sendDirectMessage(recipientContactId: string, content: string): void {
    const contactId = this.auth.contactId;
    if (!contactId) return;

    this.api.sendDirectMessage(contactId, recipientContactId, content).subscribe({
      next: (res) => {
        this.loadInbox();
        // Backend may return conversation_id, id, or conversationId
        const convId = String(res?.conversation_id || res?.id || res?.conversationId || '');
        if (convId) {
          const recipient = this.visibleContacts$.value.find(
            (c) => c.contact_id === recipientContactId
          );
          const name = recipient ? getContactDisplayName(recipient) : 'Direct Message';
          this.openConversation(convId, name, false);
        }
      },
      error: () => {},
    });
  }

  createGroupConversation(participantIds: string[], name: string): void {
    const contactId = this.auth.contactId;
    if (!contactId) return;

    const allParticipants = participantIds.includes(contactId)
      ? participantIds
      : [contactId, ...participantIds];

    this.api.createConversation(contactId, allParticipants, name).subscribe({
      next: (conv) => {
        // Backend may return conversation_id, id, or conversationId
        const convId = String((conv as any)?.conversation_id || (conv as any)?.id || (conv as any)?.conversationId || '');
        if (!convId) {
          this.loadInbox();
          return;
        }
        this.loadInbox();
        this.openConversation(convId, name, true);
      },
      error: () => {},
    });
  }

  openGroupSettings(conversationId: string, name: string): void {
    this.groupSettings$.next({ conversationId, name });
    this.setView('group-manager');
  }

  clearGroupSettings(): void {
    this.groupSettings$.next(null);
  }

  markAsRead(conversationId: string): void {
    if (!conversationId || conversationId === 'undefined') return;
    const contactId = this.auth.contactId;
    if (!contactId) return;

    this.api.markConversationRead(conversationId, contactId).subscribe({
      next: () => {
        const items = this.inbox$.value.map((item) =>
          item.conversation_id === conversationId ? { ...item, unread_count: 0 } : item
        );
        this.inbox$.next(items);
        this.recalcUnread(items);
      },
      error: () => {},
    });
  }

  // ── Group management ──
  manageGroup(
    action: 'create' | 'add' | 'remove' | 'rename',
    conversationId?: string,
    groupName?: string,
    participantContactIds?: string[]
  ): void {
    const contactId = this.auth.contactId;
    if (!contactId) return;

    this.api.manageGroup(contactId, action, conversationId, groupName, participantContactIds).subscribe({
      next: () => this.loadInbox(),
      error: () => {},
    });
  }

  // ── Delete / Clear ──
  deleteConversation(conversationId: string): void {
    const contactId = this.auth.contactId;
    if (!contactId) return;

    this.api.deleteConversation(conversationId, contactId).subscribe({
      next: () => {
        const items = this.inbox$.value.filter(i => i.conversation_id !== conversationId);
        this.inbox$.next(items);
        this.recalcUnread(items);
        const map = new Map(this.messagesMap$.value);
        map.delete(conversationId);
        this.messagesMap$.next(map);
        if (this.activeConversationId$.value === conversationId) {
          this.activeConversationId$.next(null);
          this.activeView$.next('inbox');
        }
        this.closeChat(conversationId);
      },
      error: () => {},
    });
  }

  clearConversation(conversationId: string): void {
    const contactId = this.auth.contactId;
    if (!contactId) return;

    this.api.clearConversation(conversationId, contactId).subscribe({
      next: () => {
        const map = new Map(this.messagesMap$.value);
        map.set(conversationId, []);
        this.messagesMap$.next(map);
        const items = this.inbox$.value.map(i =>
          i.conversation_id === conversationId
            ? { ...i, last_message_preview: '', last_message_at: i.last_message_at }
            : i
        );
        this.inbox$.next(items);
      },
      error: () => {},
    });
  }

  deleteGroup(conversationId: string): void {
    const contactId = this.auth.contactId;
    if (!contactId) return;

    this.api.deleteGroup(conversationId, contactId).subscribe({
      next: () => {
        const items = this.inbox$.value.filter(i => i.conversation_id !== conversationId);
        this.inbox$.next(items);
        this.recalcUnread(items);
        const map = new Map(this.messagesMap$.value);
        map.delete(conversationId);
        this.messagesMap$.next(map);
        if (this.activeConversationId$.value === conversationId) {
          this.activeConversationId$.next(null);
          this.activeView$.next('inbox');
        }
        this.closeChat(conversationId);
      },
      error: () => {},
    });
  }

  // ── Reactions ──
  addReaction(messageId: string, emoji: string): void {
    const contactId = this.auth.contactId;
    if (!contactId) return;

    // Enforce one reaction per user — remove any existing reaction with a different emoji
    for (const msgs of this.messagesMap$.value.values()) {
      const msg = msgs.find(m => String(m.message_id) === String(messageId));
      if (msg?.reactions) {
        for (const r of msg.reactions) {
          if (r.hasReacted && r.emoji !== emoji) {
            this.applyReactionOptimistically(messageId, r.emoji, false);
            this.api.removeReaction(messageId, contactId, r.emoji).subscribe({ error: () => {} });
          }
        }
      }
      break;
    }

    // Optimistic UI so user sees reaction immediately.
    this.applyReactionOptimistically(messageId, emoji, true);

    this.api.addReaction(messageId, contactId, emoji).subscribe({
      next: () => {
        this.refreshMessageReactions(messageId);
      },
      error: () => {
        // Revert optimistic update when request fails.
        this.applyReactionOptimistically(messageId, emoji, false);
      },
    });
  }

  removeReaction(messageId: string, emoji: string): void {
    const contactId = this.auth.contactId;
    if (!contactId) return;

    // Optimistic UI so user sees reaction removal immediately.
    this.applyReactionOptimistically(messageId, emoji, false);

    this.api.removeReaction(messageId, contactId, emoji).subscribe({
      next: () => {
        this.refreshMessageReactions(messageId);
      },
      error: () => {
        // Revert optimistic update when request fails.
        this.applyReactionOptimistically(messageId, emoji, true);
      },
    });
  }

  getActiveConversationId(): string | null {
    return this.activeConversationId$.value;
  }

  // ── Getters ──
  getMessagesForConversation(conversationId: string): Message[] {
    return this.messagesMap$.value.get(conversationId) || [];
  }

  getCurrentInbox(): InboxItem[] {
    return this.inbox$.value;
  }

  // ── Private helpers ──
  private listenWebSocket(): void {
    this.wsSub?.unsubscribe();
    this.wsSub = this.wsService.onMessage$.subscribe((msg) => this.handleWsMessage(msg));
  }

  private handleWsMessage(msg: WebSocketMessage): void {
    switch (msg.type) {
      case 'new_message':
        this.handleNewMessage(msg.data);
        break;
      case 'conversation_updated':
        this.loadInbox();
        if (this.activeConversationId$.value) {
          this.loadMessages(this.activeConversationId$.value);
        }
        break;
      case 'group_updated':
        this.handleGroupUpdated(msg.data);
        break;
      case 'error':
        this.handleWebSocketError(msg.message);
        break;
    }
  }

  private handleGroupUpdated(data: any): void {
    this.loadInbox();
  }

  private handleWebSocketError(errorMessage: string | undefined): void {
    void errorMessage;
  }

  private handleNewMessage(data: any): void {
    if (!data) return;

    // Pass through full payload so nested / alternate attachment fields are not dropped.
    const message: Message = this.normalizeMessageShape(data);

    const isFromOther = String(message.sender_id) !== String(this.auth.contactId);

    const existing = this.messagesMap$.value.get(message.conversation_id) || [];
    const isDuplicate = existing.some(
      (m) => m.message_id === message.message_id ||
             (m.sender_id === message.sender_id &&
              m.content === message.content &&
              Math.abs(new Date(m.created_at).getTime() - new Date(message.created_at).getTime()) < 2000)
    );

    if (!isDuplicate) {
      this.appendMessage(message);
      
      if (isFromOther) {
        this.playNotificationSound();
      }
    }

    this.updateInboxPreview(message);

    if (this.activeConversationId$.value !== message.conversation_id) {
      if (isFromOther) {
        this.incrementUnread(message.conversation_id);
      }
    } else {
      this.markAsRead(message.conversation_id);
    }
  }

  /** Public — lets components add an optimistic message without a round-trip. */
  appendOptimisticMessage(message: Message): void {
    this.appendMessage(message);
  }

  private appendMessage(message: Message): void {
    const map = new Map(this.messagesMap$.value);
    const msgs = [...(map.get(message.conversation_id) || []), message];
    map.set(message.conversation_id, msgs);
    this.messagesMap$.next(map);
    this.refreshMessageReactions(message.message_id);
  }

  private updateInboxPreview(message: Message): void {
    const items = this.inbox$.value.map((item) => {
      if (item.conversation_id === message.conversation_id) {
        return {
          ...item,
          last_message_preview: message.content || '[Image]',
          last_message_at: message.created_at,
        };
      }
      return item;
    });

    items.sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
    this.inbox$.next(items);
  }

  private incrementUnread(conversationId: string): void {
    const items = this.inbox$.value.map((item) =>
      item.conversation_id === conversationId
        ? { ...item, unread_count: Number(item.unread_count) + 1 }
        : item
    );
    this.inbox$.next(items);
    this.recalcUnread(items);
  }

  /**
   * Normalize backend message shapes so UI can reliably render attachments/media.
   * Supports legacy and current field names returned by API/WS payloads.
   */
  private normalizeMessageShape(raw: any): Message {
    const base: Message = {
      message_id: String(raw?.message_id ?? raw?.id ?? ''),
      conversation_id: String(raw?.conversation_id ?? raw?.conversationId ?? ''),
      sender_id: String(raw?.sender_id ?? raw?.senderId ?? ''),
      sender_name: raw?.sender_name,
      sender_username: raw?.sender_username,
      sender_first_name: raw?.sender_first_name,
      sender_last_name: raw?.sender_last_name,
      message_type: (raw?.message_type ?? raw?.messageType ?? 'TEXT') as Message['message_type'],
      content: raw?.content ?? '',
      media_url: raw?.media_url ?? raw?.mediaUrl ?? raw?.url ?? raw?.file_url,
      created_at: raw?.created_at ?? raw?.createdAt ?? new Date().toISOString(),
      is_read: raw?.is_read,
      reactions: raw?.reactions,
      mentions: raw?.mentions,
      attachments: raw?.attachments,
      is_pinned: raw?.is_pinned,
      pinned_at: raw?.pinned_at,
      pinned_by: raw?.pinned_by,
    };

    const uuidRe =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    // Normalize attachment objects (API may use fileId / id instead of file_id).
    if (Array.isArray(base.attachments) && base.attachments.length > 0) {
      const mapped: Attachment[] = (base.attachments as any[]).map((a) => ({
        file_id: String(
          a?.file_id ?? a?.fileId ?? a?.id ?? a?.attachment_id ?? a?.storage_file_id ?? ''
        ).trim(),
        filename: String(a?.filename ?? a?.file_name ?? a?.name ?? a?.original_filename ?? ''),
        mime_type: a?.mime_type ?? a?.mimeType,
        url: a?.url ?? a?.file_url ?? a?.download_url,
      })).filter((a) => !!a.file_id && !a.file_id.startsWith('temp-'));

      if (mapped.length > 0) {
        return { ...base, attachments: mapped };
      }
    }

    // Reconstruct attachments from alternate API fields.
    let attachmentIds: string[] = [];
    if (Array.isArray(raw?.attachment_ids)) {
      attachmentIds = raw.attachment_ids.map((x: any) => String(x).trim()).filter(Boolean);
    } else if (typeof raw?.attachment_ids === 'string' && raw.attachment_ids.trim()) {
      attachmentIds = raw.attachment_ids
        .split(/[,\s]+/)
        .map((s: string) => s.trim())
        .filter(Boolean);
    }

    if (attachmentIds.length === 0 && Array.isArray(raw?.file_ids)) {
      attachmentIds = raw.file_ids.map((x: any) => String(x).trim()).filter(Boolean);
    }

    const pushId = (v: any) => {
      const s = v != null && v !== '' ? String(v).trim() : '';
      if (s && !attachmentIds.includes(s)) attachmentIds.push(s);
    };

    pushId(raw?.file_id);
    pushId(raw?.attachment_id);
    pushId(raw?.storage_file_id);
    pushId(raw?.blob_id);

    // Backend stores first attachment id in messaging.message.media_url (UUID), not a public URL.
    const mediaAsId = String(base.media_url || '').trim();
    if (
      mediaAsId &&
      !mediaAsId.startsWith('http://') &&
      !mediaAsId.startsWith('https://') &&
      !mediaAsId.startsWith('data:')
    ) {
      pushId(mediaAsId);
    }

    const contentTrim = String(base.content || '').trim();
    if (attachmentIds.length === 0 && uuidRe.test(contentTrim)) {
      attachmentIds.push(contentTrim);
    }
    // Some APIs store storage / attachment id as numeric string in content for FILE messages.
    if (
      attachmentIds.length === 0 &&
      /^\d+$/.test(contentTrim) &&
      (base.message_type === 'FILE' || base.message_type === 'IMAGE')
    ) {
      attachmentIds.push(contentTrim);
    }

    const filenames: string[] = Array.isArray(raw?.filenames)
      ? raw.filenames.map((x: any) => String(x))
      : raw?.filename
      ? [String(raw.filename)]
      : raw?.file_name
      ? [String(raw.file_name)]
      : base.content && !uuidRe.test(contentTrim)
      ? [String(base.content)]
      : [];

    if (attachmentIds.length > 0 || filenames.length > 0) {
      const fallbackMime = raw?.mime_type ?? raw?.attachment_mime_type;
      const urlFallback = raw?.file_url ?? raw?.url ?? raw?.media_url ?? raw?.mediaUrl;
      const ids = attachmentIds.length > 0 ? attachmentIds : [];
      const built: Attachment[] = ids.map((id, idx) => ({
        file_id: id,
        filename: filenames[idx] || filenames[0] || `Attachment ${idx + 1}`,
        mime_type: fallbackMime,
        url: urlFallback,
      }));

      // Filename only + direct URL (no storage id): still renderable as <img src>.
      if (
        built.length === 0 &&
        filenames.length > 0 &&
        urlFallback &&
        String(urlFallback).match(/^https?:\/\//i)
      ) {
        built.push({
          file_id: '',
          filename: filenames[0],
          mime_type: fallbackMime,
          url: String(urlFallback),
        });
      }

      if (built.length > 0) {
        return { ...base, attachments: built };
      }
    }

    return base;
  }

  private playNotificationSound(): void {
    try {
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGGS57OihUBELTKXh8bllHAU2jdXzzn0vBSh+zPLaizsKFGCz6OyrWBQLSKDf8sFuIwUug8/y24k3CBhku+zooVARC0yl4fG5ZRwFNo3V8859LwUofszy2os7ChRgs+jsq1gVC0ig3/LBbiMFLoLP8tuJNwgYZLvs6KFQEQtMpeHxuWUcBTaN1fPOfS8FKH7M8tqLOwoUYLPo7KtYFQtIoN/ywW4jBS6Cz/LbiTcIGGS77OihUBELTKXh8bllHAU2jdXzzn0vBSh+zPLaizsKFGCz6OyrWBULSKDf8sFuIwUugs/y24k3CBhku+zooVARC0yl4fG5ZRwFNo3V8859LwUofszy2os7ChRgs+jsq1gVC0ig3/LBbiMFLoLP8tuJNwgYZLvs6KFQEQtMpeHxuWUcBTaN1fPOfS8FKH7M8tqLOwoUYLPo7KtYFQtIoN/ywW4jBS6Cz/LbiTcIGGS77OihUBELTKXh8bllHAU2jdXzzn0vBSh+zPLaizsKFGCz6OyrWBULSKDf8sFuIwUugs/y24k3CBhku+zooVARC0yl4fG5ZRwFNo3V8859LwUofszy2os7ChRgs+jsq1gVC0ig3/LBbiMFLoLP8tuJNwgYZLvs6KFQEQtMpeHxuWUcBTaN1fPOfS8FKH7M8tqLOwoUYLPo7KtYFQtIoN/ywW4jBS6Cz/LbiTcIGGS77OihUBELTKXh8bllHAU2jdXzzn0vBSh+zPLaizsKFGCz6OyrWBULSKDf8sFuIwUugs/y24k3CBhku+zooVARC0yl4fG5ZRwFNo3V8859LwUofszy2os7ChRgs+jsq1gVC0ig3/LBbiMFLoLP8tuJNwgYZLvs6KFQEQtMpeHxuWUcBTaN1fPOfS8FKH7M8tqLOwoUYLPo7KtYFQtIoN/ywW4jBS6Cz/LbiTcIGGS77OihUBELTKXh8bllHAU2jdXzzn0vBSh+zPLaizsKFGCz6OyrWBULSKDf8sFuIwUugs/y24k3CBhku+zooVARC0yl4fG5ZRwFNo3V8859LwUofszy2os7ChRgs+jsq1gVC0ig3/LBbiMFLoLP8tuJNwgYZLvs6KFQEQtMpeHxuWUcBTaN1fPOfS8FKH7M8tqLOwoUYLPo7KtYFQtIoN/ywW4jBS6Cz/LbiTcIGGS77OihUBELTKXh8bllHAU2jdXzzn0vBSh+zPLaizsKFGCz6OyrWBULSKDf8sFuIwUugs/y24k3CBhku+zooVARC0yl4fG5ZRwFNo3V8859LwUofszy');
      audio.volume = 0.3;
      audio.play().catch(() => {});
    } catch {
    }
  }

  private recalcUnread(items: InboxItem[]): void {
    const total = items.reduce((sum, i) => sum + Number(i.unread_count || 0), 0);
    this.totalUnread$.next(total);
  }

  private hydrateReactionsForConversation(conversationId: string, messages: Message[]): void {
    const fetchable = messages.filter(
      (m) => !!m.message_id && !String(m.message_id).startsWith('temp-')
    );
    if (!fetchable.length) return;

    const jobs = fetchable.map((m) =>
      this.api.getReactions(m.message_id).pipe(
        map((rows) => ({ messageId: m.message_id, reactions: this.normalizeReactionRows(rows) })),
        catchError(() => of({ messageId: m.message_id, reactions: [] }))
      )
    );

    forkJoin(jobs).subscribe((results) => {
      const map = new Map(this.messagesMap$.value);
      const current = [...(map.get(conversationId) || [])];
      if (!current.length) return;

      let changed = false;
      for (const result of results) {
        const idx = current.findIndex((m) => String(m.message_id) === String(result.messageId));
        if (idx === -1) continue;
        current[idx] = { ...current[idx], reactions: result.reactions };
        changed = true;
      }

      if (changed) {
        map.set(conversationId, current);
        this.messagesMap$.next(map);
      }
    });
  }

  private refreshMessageReactions(messageId: string): void {
    if (!messageId || String(messageId).startsWith('temp-')) return;

    this.api.getReactions(messageId).subscribe({
      next: (rows) => {
        const normalized = this.normalizeReactionRows(rows);
        const map = new Map(this.messagesMap$.value);
        let changed = false;

        for (const [conversationId, msgs] of map.entries()) {
          const idx = msgs.findIndex((m) => String(m.message_id) === String(messageId));
          if (idx === -1) continue;
          const nextMsgs = [...msgs];
          nextMsgs[idx] = { ...nextMsgs[idx], reactions: normalized };
          map.set(conversationId, nextMsgs);
          changed = true;
          break;
        }

        if (changed) {
          this.messagesMap$.next(map);
        }
      },
      error: () => {},
    });
  }

  private normalizeReactionRows(rows: any[]): any[] {
    const byEmoji = new Map<string, { emoji: string; count: number; hasReacted: boolean; reactors: string[] }>();
    const myContactId = String(this.auth.contactId || '');
    const contacts = this.visibleContacts$.value;

    for (const row of rows || []) {
      const emoji = String(row?.emoji || '').trim();
      if (!emoji) continue;

      const contactId = String(row?.contact_id ?? row?.contactId ?? '');
      const explicitHasReacted = row?.hasReacted ?? row?.has_reacted;
      const hasReacted = explicitHasReacted === true || (contactId && contactId === myContactId);

      const countFromRow = Number(row?.count ?? row?.reaction_count ?? 0);
      const existing = byEmoji.get(emoji) || { emoji, count: 0, hasReacted: false, reactors: [] };

      // Some APIs return one row per reaction; some return pre-aggregated count.
      existing.count += countFromRow > 0 ? countFromRow : 1;
      existing.hasReacted = existing.hasReacted || !!hasReacted;

      // Track reactor display names when individual contactId is available
      if (contactId && countFromRow <= 1) {
        let name: string;
        if (contactId === myContactId) {
          name = 'You';
        } else {
          const contact = contacts.find(c => String(c.contact_id) === contactId);
          name = contact ? getContactDisplayName(contact) : `User ${contactId}`;
        }
        if (!existing.reactors.includes(name)) {
          existing.reactors.push(name);
        }
      }

      byEmoji.set(emoji, existing);
    }

    return Array.from(byEmoji.values()).filter((r) => r.count > 0);
  }

  private applyReactionOptimistically(messageId: string, emoji: string, add: boolean): void {
    const map = new Map(this.messagesMap$.value);
    let didUpdate = false;

    for (const [conversationId, msgs] of map.entries()) {
      const idx = msgs.findIndex((m) => String(m.message_id) === String(messageId));
      if (idx === -1) continue;

      const target = msgs[idx];
      const nextReactions = [...(target.reactions || [])];
      const rIdx = nextReactions.findIndex((r) => r.emoji === emoji);

      if (add) {
        if (rIdx >= 0) {
          const current = nextReactions[rIdx];
          if (!current.hasReacted) {
            nextReactions[rIdx] = {
              ...current,
              hasReacted: true,
              count: Number(current.count || 0) + 1,
            };
          }
        } else {
          nextReactions.push({ emoji, count: 1, hasReacted: true });
        }
      } else {
        if (rIdx >= 0) {
          const current = nextReactions[rIdx];
          const nextCount = Math.max(Number(current.count || 0) - (current.hasReacted ? 1 : 0), 0);
          if (nextCount === 0) {
            nextReactions.splice(rIdx, 1);
          } else {
            nextReactions[rIdx] = {
              ...current,
              hasReacted: false,
              count: nextCount,
            };
          }
        }
      }

      const updatedMsg: Message = { ...target, reactions: nextReactions };
      const updatedMsgs = [...msgs];
      updatedMsgs[idx] = updatedMsg;
      map.set(conversationId, updatedMsgs);
      didUpdate = true;
      break;
    }

    if (didUpdate) {
      this.messagesMap$.next(map);
    }
  }
}
