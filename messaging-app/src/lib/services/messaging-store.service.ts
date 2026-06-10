import { Inject, Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subject, Subscription, forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { MessagingApiService } from './messaging-api.service';
import { MessagingWebSocketService } from './messaging-websocket.service';
import {
  InboxItem,
  Message,
  MessageReplyPreview,
  PLAIN_TEXT_MESSAGE_PREFIX,
  Attachment,
  Contact,
  ChatWindow,
  WebSocketMessage,
  SidebarSide,
  isProjectConversation,
  getContactDisplayName,
  getMessageSenderName,
} from '../models/messaging.models';
import { MESSAGING_CONFIG, MessagingConfig } from '../messaging.config';

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
  private panelFloating$ = new BehaviorSubject<boolean>(false);
  private notificationVolume$ = new BehaviorSubject<number>(
    Number(localStorage.getItem('messaging_notification_volume') ?? '0.35')
  );
  private notificationsMuted$ = new BehaviorSubject<boolean>(
    localStorage.getItem('messaging_notifications_muted') === 'true'
  );
  private messageTextScale$ = new BehaviorSubject<number>(
    Number(localStorage.getItem('messaging_message_text_scale') ?? '1')
  );
  private codeTextScale$ = new BehaviorSubject<number>(
    Number(localStorage.getItem('messaging_code_text_scale') ?? '1')
  );
  private toast$ = new BehaviorSubject<{ message: string; type: 'info' | 'success' | 'error' } | null>(null);
  private removedGroupIds$ = new BehaviorSubject<Set<string>>(new Set());
  private mentionConversationIds$ = new BehaviorSubject<Set<string>>(new Set());
  private groupMembershipVersion$ = new BehaviorSubject<number>(0);
  private activeDbGid$ = new BehaviorSubject<string | null>(null);

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
  readonly panelFloating = this.panelFloating$.asObservable();
  readonly notificationVolume = this.notificationVolume$.asObservable();
  readonly notificationsMuted = this.notificationsMuted$.asObservable();
  readonly messageTextScale = this.messageTextScale$.asObservable();
  readonly codeTextScale = this.codeTextScale$.asObservable();
  readonly toast = this.toast$.asObservable();
  readonly removedGroupIds = this.removedGroupIds$.asObservable();
  readonly mentionConversationIds = this.mentionConversationIds$.asObservable();
  readonly groupMembershipVersion = this.groupMembershipVersion$.asObservable();
  readonly activeDbGid = this.activeDbGid$.asObservable();

  private wsSub: Subscription | null = null;
  private destroy$ = new Subject<void>();
  private pollTimer: any = null;
  private groupSettings$ = new BehaviorSubject<{
    conversationId: string;
    name: string;
    isProject?: boolean;
    dbGid?: string;
    projectGid?: string;
  } | null>(null);
  private deletingConversationIds = new Set<string>();
  private removalToastShown = new Set<string>();
  private toastTimer: any = null;

  readonly groupSettings = this.groupSettings$.asObservable();

  constructor(
    private auth: AuthService,
    private api: MessagingApiService,
    private wsService: MessagingWebSocketService,
    @Inject(MESSAGING_CONFIG) private config: MessagingConfig
  ) {
    (this as any).wsStatus = this.wsService.status$;
  }

  get projectGroupsEnabled(): boolean {
    return this.config.enableProjectGroups === true;
  }

  // ── Initialization ──
  initialize(): void {
    if (!this.auth.isAuthenticated()) return;

    this.auth.refreshMessagingSession().subscribe({
      next: (contact) => {
        if (!contact) {
          this.teardown();
          return;
        }
        this.initializeWithVerifiedSession();
      },
      error: () => this.teardown(),
    });
  }

  private initializeWithVerifiedSession(): void {
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
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }
    this.wsService.disconnect();
    this.wsSub?.unsubscribe();
    this.inbox$.next([]);
    this.messagesMap$.next(new Map());
    this.openChats$.next([]);
    this.panelOpen$.next(false);
    this.activeView$.next('inbox');
    this.activeConversationId$.next(null);
    this.totalUnread$.next(0);
    this.deletingConversationIds.clear();
    this.removalToastShown.clear();
    this.removedGroupIds$.next(new Set());
    this.mentionConversationIds$.next(new Set());
    this.groupMembershipVersion$.next(0);
    this.toast$.next(null);
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

  setPanelFloating(isFloating: boolean): void {
    this.panelFloating$.next(isFloating);
  }

  setNotificationVolume(volume: number): void {
    const normalized = Math.max(0, Math.min(1, Number(volume)));
    this.notificationVolume$.next(normalized);
    localStorage.setItem('messaging_notification_volume', String(normalized));
    if (normalized > 0 && this.notificationsMuted$.value) {
      this.setNotificationsMuted(false);
    }
  }

  setNotificationsMuted(muted: boolean): void {
    this.notificationsMuted$.next(muted);
    localStorage.setItem('messaging_notifications_muted', String(muted));
  }

  setMessageTextScale(scale: number): void {
    const normalized = Math.max(0.8, Math.min(1.5, Number(scale)));
    this.messageTextScale$.next(normalized);
    localStorage.setItem('messaging_message_text_scale', String(normalized));
  }

  setCodeTextScale(scale: number): void {
    const normalized = Math.max(0.8, Math.min(1.5, Number(scale)));
    this.codeTextScale$.next(normalized);
    localStorage.setItem('messaging_code_text_scale', String(normalized));
  }

  testNotificationSound(): void {
    this.playSoftNotificationSound(true);
  }

  prepareOutgoingMessageContent(content: string, replyTo?: Message | null, forcePlainText?: boolean): string {
    const body = String(content || '').trim();
    const withReply = !replyTo ? body : (() => {
      const reply = this.createReplyPreview(replyTo);
      const sender = (reply.sender_name || 'message').replace(/\]/g, '').trim();
      const excerpt = this.replyExcerpt(reply.content || '');
      return `[Reply to ${sender}]\n> ${excerpt}\n\n${body}`;
    })();
    return forcePlainText ? `${PLAIN_TEXT_MESSAGE_PREFIX}${withReply}` : withReply;
  }

  createReplyPreview(message: Message): MessageReplyPreview {
    return {
      message_id: String(message.message_id || ''),
      sender_name: getMessageSenderName(message) !== 'Unknown'
        ? getMessageSenderName(message)
        : this.getContactNameById(message.sender_id),
      content: this.replyExcerpt(String(message.content || '')),
    };
  }

  showToast(message: string, type: 'info' | 'success' | 'error' = 'info', durationMs = 3000): void {
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }
    this.toast$.next({ message, type });
    this.toastTimer = setTimeout(() => {
      this.toast$.next(null);
      this.toastTimer = null;
    }, durationMs);
  }

  getSidebarSide(): SidebarSide {
    return this.sidebarSide$.value;
  }

  setActiveDbGid(dbGid: string | null | undefined): void {
    const normalized = String(dbGid || '').trim() || null;
    if (normalized === this.activeDbGid$.value) return;

    this.activeDbGid$.next(normalized);
    this.api.setActiveDbGid(normalized);
    this.removeProjectConversationsFromUi();

    if (this.auth.isAuthenticated()) {
      this.loadInbox();
    }
  }

  // ── Inbox ──
  loadInbox(): void {
    const contactId = this.auth.contactId;
    if (!contactId) return;

    this.api.getInbox(contactId).subscribe({
      next: (items) => {
        const mapped = items.map(item => {
          const isGroup = item.is_group === true || (item.is_group as any) === 'True';
          const isProject = this.projectGroupsEnabled && isProjectConversation(item);
          const conversationId = String(item.conversation_id);
          const preview = this.replyBodyText(item.last_message_preview || '');
          const hasMention =
            this.mentionConversationIds$.value.has(conversationId) ||
            (Number(item.unread_count || 0) > 0 && this.messageTextMentionsCurrentUser(preview));
          
          if (!isGroup && !item.name && item.other_participant_name) {
            return { ...item, name: item.other_participant_name, last_message_preview: preview, is_group: false, is_project: isProject, has_mention: hasMention };
          }
          return { ...item, last_message_preview: preview, is_group: isGroup, is_project: isProject, has_mention: hasMention };
        }).filter(item =>
          (!isProjectConversation(item) || this.projectGroupsEnabled) &&
          !this.deletingConversationIds.has(String(item.conversation_id)) &&
          !this.removedGroupIds$.value.has(String(item.conversation_id))
        );
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
          if (
            match &&
            String(match.contact_id) !== String(currentContact.contact_id)
          ) {
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
  openConversation(
    conversationId: string,
    name: string,
    isGroup = false,
    isProject = false,
    dbGid?: string,
    projectGid?: string,
  ): void {
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
        { conversationId, name, isGroup, isProject, dbGid, projectGid, isMinimized: false, unreadCount: 0 },
      ]);
    }

    const existing = this.messagesMap$.value.get(conversationId);
    if (!existing || existing.length === 0) {
      this.loadMessages(conversationId);
    }
    this.markAsRead(conversationId);
    this.wsService.subscribe(conversationId);
  }

  closeChat(conversationId: string): void {
    const chats = this.openChats$.value.filter((c) => c.conversationId !== conversationId);
    this.openChats$.next(chats);

    if (String(this.activeConversationId$.value) === String(conversationId)) {
      this.activeConversationId$.next(null);
      this.activeView$.next('inbox');
    }
  }

  markGroupRemoved(conversationId: string): void {
    const id = String(conversationId);
    if (!id || id === 'undefined') return;

    const next = new Set(this.removedGroupIds$.value);
    next.add(id);
    this.removedGroupIds$.next(next);

    const items = this.inbox$.value.filter(i => String(i.conversation_id) !== id);
    this.inbox$.next(items);
    this.recalcUnread(items);

    if (!this.removalToastShown.has(id)) {
      this.removalToastShown.add(id);
      this.showToast('You were removed from this group', 'info', 5000);
    }
  }

  exitRemovedGroup(conversationId: string): void {
    const id = String(conversationId);
    const next = new Set(this.removedGroupIds$.value);
    next.delete(id);
    this.removedGroupIds$.next(next);
    this.removalToastShown.delete(id);
    this.removeConversationFromUi(id);
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
        sorted.forEach((m) => this.detectGroupRemovalForCurrentUser(m));

        const existingById = new Map(existing.map(m => [String(m.message_id), m]));

        if (beforeMessageId) {
          // Prepend older messages, preserving existing reactions
          const merged = [...sorted, ...existing];
          map.set(conversationId, merged);
        } else {
          // Replace with server data but keep the richer of existing vs server attachments
          // (the optimistic path may have more attachment metadata than the server echoes back).
          const merged = sorted.map(m => {
            const cached = existingById.get(String(m.message_id));
            if (!cached) return m;
            return this.mergeMessageAttachments(cached, m);
          });
          map.set(conversationId, merged);
        }

        this.messagesMap$.next(map);
        this.hydrateReactionsForConversation(
          conversationId,
          map.get(conversationId) || [],
          skipReactionHydration
        );
        this.loadingMessages$.next(false);
      },
      error: () => {
        this.loadingMessages$.next(false);
      },
    });
  }

  sendMessage(
    conversationId: string | null,
    content: string,
    messageType: 'TEXT' | 'IMAGE' | 'SYSTEM' = 'TEXT',
    options?: { replyTo?: Message | null; mentions?: string[]; forcePlainText?: boolean }
  ): void {
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

    const outgoingContent = this.prepareOutgoingMessageContent(content, options?.replyTo || null, options?.forcePlainText);
    const replyTo = options?.replyTo ? this.createReplyPreview(options.replyTo) : undefined;
    const tempMessageId = 'temp-' + Date.now();
    const optimistic: Message = {
      message_id: tempMessageId,
      conversation_id: conversationId,
      sender_id: contactId,
      sender_name: 'You',
      message_type: messageType,
      content,
      reply_to: replyTo,
      mentions: options?.mentions,
      render_as_plain_text: options?.forcePlainText,
      created_at: new Date().toISOString(),
      is_read: false,
    };
    this.appendMessage(optimistic);

    this.api.sendMessage(conversationId, contactId, outgoingContent, messageType).subscribe({
      next: (res) => {
        const realId = res?.message_id ?? res?.id ?? res?.messageId;
        if (realId == null || String(realId).startsWith('temp-')) {
          return;
        }
        const pickedContent = this.coalesceMessageText(res, outgoingContent || optimistic.content);
        const merged = this.normalizeMessageShape({
          ...optimistic,
          ...res,
          message_id: String(realId),
          conversation_id: conversationId,
          message_type: messageType === 'SYSTEM' ? 'SYSTEM' : res?.message_type ?? optimistic.message_type,
          content: pickedContent,
          reply_to: replyTo ?? res?.reply_to,
          mentions: options?.mentions ?? res?.mentions,
          render_as_plain_text: options?.forcePlainText,
        });
        const map = new Map(this.messagesMap$.value);
        const msgs = [...(map.get(conversationId) || [])];
        const idx = msgs.findIndex((m) => m.message_id === tempMessageId);
        if (idx >= 0) {
          msgs[idx] = merged;
          map.set(conversationId, this.dedupeMessagesByIdKeepFirst(msgs));
          this.messagesMap$.next(map);
          this.refreshMessageReactions(merged.message_id);
        }
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

  createGroupConversation(
    participantIds: string[],
    name: string,
    callbacks?: { success?: () => void; error?: () => void }
  ): void {
    const contactId = this.auth.contactId;
    if (!contactId) {
      callbacks?.error?.();
      return;
    }

    const allParticipants = participantIds.includes(contactId)
      ? participantIds
      : [contactId, ...participantIds];

    this.api.createConversation(contactId, allParticipants, name).subscribe({
      next: (conv) => {
        // Backend may return conversation_id, id, or conversationId
        const convId = String(
          typeof conv === 'string' || typeof conv === 'number'
            ? conv
            : (conv as any)?.conversation_id || (conv as any)?.id || (conv as any)?.conversationId || ''
        );
        if (!convId) {
          this.loadInbox();
          callbacks?.error?.();
          return;
        }
        this.loadInbox();
        this.clearGroupSettings();
        this.openConversation(convId, name, true);
        callbacks?.success?.();
      },
      error: () => {
        callbacks?.error?.();
      },
    });
  }

  openGroupSettings(
    conversationId: string,
    name: string,
    isProject = false,
    dbGid?: string,
    projectGid?: string,
  ): void {
    this.groupSettings$.next({ conversationId, name, isProject, dbGid, projectGid });
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
          item.conversation_id === conversationId ? { ...item, unread_count: 0, has_mention: false } : item
        );
        this.inbox$.next(items);
        this.recalcUnread(items);
        this.setConversationMention(conversationId, false);
      },
      error: () => {},
    });
  }

  // ── Group management ──
  manageGroup(
    action: 'create' | 'add' | 'remove' | 'rename',
    conversationId?: string,
    groupName?: string,
    participantContactIds?: string[],
    callbacks?: { success?: () => void; error?: () => void }
  ): void {
    const contactId = this.auth.contactId;
    if (!contactId) {
      callbacks?.error?.();
      return;
    }

    if (action === 'remove' && conversationId && participantContactIds?.length) {
      const actorName = this.getContactNameById(contactId);
      const noticeJobs = participantContactIds.map((id) =>
        this.api.sendMessage(
          conversationId,
          contactId,
          `${actorName} removed ${this.getContactNameById(id)} from the group`,
          'SYSTEM'
        ).pipe(catchError(() => of(null)))
      );
      const removeJobs = participantContactIds.map((id) =>
        this.api.manageGroup(id, action, conversationId, groupName)
      );

      forkJoin(noticeJobs).subscribe({
        next: () => {
          forkJoin(removeJobs).subscribe({
            next: () => {
              this.loadInbox();
              this.notifyGroupMembershipChanged();
              callbacks?.success?.();
            },
            error: () => {
              callbacks?.error?.();
            },
          });
        },
        error: () => {
          callbacks?.error?.();
        },
      });
      return;
    }

    this.api.manageGroup(contactId, action, conversationId, groupName, participantContactIds).subscribe({
      next: () => {
        this.loadInbox();
        if (action === 'add' && conversationId && participantContactIds?.length) {
          this.notifyGroupMembershipChanged();
          const addedNames = participantContactIds.map((id) => this.getContactNameById(id));
          const text = `${this.getContactNameById(contactId)} added ${addedNames.join(', ')} to the group`;
          this.sendMessage(conversationId, text, 'SYSTEM');
        }
        callbacks?.success?.();
      },
      error: () => {
        callbacks?.error?.();
      },
    });
  }

  setGroupAdmin(
    conversationId: string,
    targetContactId: string,
    isAdmin: boolean,
    callbacks?: { success?: () => void; error?: () => void }
  ): void {
    if (!this.auth.contactId) {
      callbacks?.error?.();
      return;
    }

    this.api.setGroupAdmin(conversationId, targetContactId, isAdmin).subscribe({
      next: () => {
        this.loadInbox();
        this.notifyGroupMembershipChanged();
        callbacks?.success?.();
      },
      error: () => callbacks?.error?.(),
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

  deleteGroup(conversationId: string, callbacks?: { success?: () => void; error?: () => void }): void {
    const contactId = this.auth.contactId;
    if (!contactId || this.deletingConversationIds.has(conversationId)) {
      callbacks?.error?.();
      return;
    }

    const previousInbox = this.inbox$.value;
    const previousMessagesMap = new Map(this.messagesMap$.value);
    const previousOpenChats = this.openChats$.value;
    const previousActiveConversationId = this.activeConversationId$.value;
    const previousActiveView = this.activeView$.value;
    const previousGroupSettings = this.groupSettings$.value;

    this.deletingConversationIds.add(conversationId);
    this.showToast('Exiting group...', 'info', 1500);
    this.removeConversationFromUi(conversationId);

    this.api.deleteGroup(conversationId, contactId).subscribe({
      next: () => {
        this.deletingConversationIds.delete(conversationId);
        this.showToast('Exited group', 'success');
        callbacks?.success?.();
      },
      error: () => {
        this.deletingConversationIds.delete(conversationId);
        this.inbox$.next(previousInbox);
        this.recalcUnread(previousInbox);
        this.messagesMap$.next(previousMessagesMap);
        this.openChats$.next(previousOpenChats);
        this.groupSettings$.next(previousGroupSettings);
        this.activeConversationId$.next(previousActiveConversationId);
        this.activeView$.next(previousActiveView);
        this.showToast('Could not exit group', 'error');
        callbacks?.error?.();
      },
    });
  }

  private removeConversationFromUi(conversationId: string): void {
    const items = this.inbox$.value.filter(i => String(i.conversation_id) !== String(conversationId));
    this.inbox$.next(items);
    this.recalcUnread(items);

    const map = new Map(this.messagesMap$.value);
    map.delete(conversationId);
    this.messagesMap$.next(map);

    this.openChats$.next(this.openChats$.value.filter(c => String(c.conversationId) !== String(conversationId)));
    if (String(this.activeConversationId$.value) === String(conversationId)) {
      this.activeConversationId$.next(null);
      this.activeView$.next('inbox');
    }
    const settings = this.groupSettings$.value;
    if (settings?.conversationId === conversationId) {
      this.clearGroupSettings();
    }
  }

  private removeProjectConversationsFromUi(): void {
    const projectIds = new Set(
      this.inbox$.value
        .filter((item) => isProjectConversation(item))
        .map((item) => String(item.conversation_id))
    );
    this.openChats$.value
      .filter((chat) => chat.isProject)
      .forEach((chat) => projectIds.add(String(chat.conversationId)));

    if (projectIds.size === 0) return;

    const items = this.inbox$.value.filter((item) => !projectIds.has(String(item.conversation_id)));
    this.inbox$.next(items);
    this.recalcUnread(items);

    const map = new Map(this.messagesMap$.value);
    projectIds.forEach((id) => map.delete(id));
    this.messagesMap$.next(map);
    this.openChats$.next(this.openChats$.value.filter((chat) => !projectIds.has(String(chat.conversationId))));

    if (this.activeConversationId$.value && projectIds.has(String(this.activeConversationId$.value))) {
      this.activeConversationId$.next(null);
      this.activeView$.next('inbox');
    }

    const settings = this.groupSettings$.value;
    if (settings && projectIds.has(String(settings.conversationId))) {
      this.clearGroupSettings();
    }
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

  editMessage(messageId: string, content: string): void {
    const contactId = this.auth.contactId;
    const conversationId = this.activeConversationId$.value;
    const nextContent = content.trim();
    if (!contactId || !conversationId || !messageId || !nextContent) return;

    this.api.editMessage(messageId, contactId, nextContent).subscribe({
      next: (res) => {
        const serverMessage = res?.message ? this.normalizeMessageShape(res.message) : null;
        this.updateMessageInConversation(
          conversationId,
          messageId,
          serverMessage || {
            content: nextContent,
            edited_at: res?.edited_at || new Date().toISOString(),
          }
        );
        this.loadInbox();
      },
      error: () => {},
    });
  }

  deleteMessage(messageId: string): void {
    const contactId = this.auth.contactId;
    const conversationId = this.activeConversationId$.value;
    if (!contactId || !conversationId || !messageId) return;

    if (String(messageId).startsWith('temp-')) {
      this.removeMessageFromConversation(conversationId, messageId);
      return;
    }

    this.api.deleteMessage(messageId, contactId).subscribe({
      next: () => {
        this.updateMessageInConversation(conversationId, messageId, {
          content: '[deleted]',
          is_deleted: true,
        });
        this.loadInbox();
      },
      error: () => {},
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
  /**
   * Prefer `{ type, data }`; support flat `{ type, ...fields }` envelopes from older backends.
   */
  private wsEventPayload(msg: WebSocketMessage): any {
    if (msg.data !== undefined && msg.data !== null) {
      return msg.data;
    }
    const raw = msg as unknown as Record<string, unknown>;
    const { type: _t, data: _d, timestamp: _ts, message: _msg, ...rest } = raw;
    return Object.keys(rest).length ? rest : null;
  }

  private listenWebSocket(): void {
    this.wsSub?.unsubscribe();
    this.wsSub = this.wsService.onMessage$.subscribe((msg) => this.handleWsMessage(msg));
  }

  private handleWsMessage(msg: WebSocketMessage): void {
    switch (msg.type) {
      case 'new_message':
        this.handleNewMessage(this.wsEventPayload(msg));
        break;
      case 'conversation_updated':
        this.handleConversationUpdated(this.wsEventPayload(msg));
        break;
      case 'group_updated':
        this.handleGroupUpdated(this.wsEventPayload(msg));
        break;
      case 'error':
        this.handleWebSocketError(msg.message);
        break;
    }
  }

  private handleConversationUpdated(data: any): void {
    this.loadInbox();
    const activeId = this.activeConversationId$.value;
    const eventConversationId = data?.conversation_id ?? data?.conversationId;
    if (activeId && (!eventConversationId || String(eventConversationId) === String(activeId))) {
      this.loadMessages(activeId, undefined, true);
    }
  }

  private handleGroupUpdated(data: any): void {
    this.handleConversationUpdated(data);
  }

  private handleWebSocketError(errorMessage: string | undefined): void {
    void errorMessage;
  }

  private handleNewMessage(data: any): void {
    if (!data) return;

    let message: Message = this.normalizeMessageShape(data);
    this.detectGroupRemovalForCurrentUser(message);
    const myContactId = String(this.auth.contactId ?? '');
    const convId = String(message.conversation_id ?? '');
    const existing = this.messagesMap$.value.get(convId) || [];

    const ownEcho =
      myContactId &&
      String(message.sender_id) === myContactId &&
      !!message.message_id &&
      !String(message.message_id).startsWith('temp-');

    // WS often arrives before HTTP finishes replacing temp-; merge into temp instead of appending a duplicate row.
    if (ownEcho) {
      const tempIdx = existing.findIndex((m) => {
        if (!String(m.message_id).startsWith('temp-')) return false;
        if (String(m.conversation_id) !== convId) return false;
        if (String(m.sender_id) !== myContactId) return false;
        const dt = Math.abs(
          new Date(m.created_at).getTime() - new Date(message.created_at).getTime()
        );
        if (dt >= 120_000) return false;
        const a = String(m.content ?? '').trim();
        const b = String(message.content ?? '').trim();
        return a === b || !b;
      });
      if (tempIdx >= 0) {
        const merged: Message = this.mergeMessageAttachments(existing[tempIdx], this.normalizeMessageShape({
          ...existing[tempIdx],
          ...data,
          message_id: message.message_id,
          conversation_id: convId,
          content: this.coalesceMessageText(data, existing[tempIdx].content),
        }));
        const map = new Map(this.messagesMap$.value);
        const msgs = this.dedupeMessagesByIdKeepFirst([...existing]);
        msgs[tempIdx] = merged;
        map.set(convId, this.dedupeMessagesByIdKeepFirst(msgs));
        this.messagesMap$.next(map);
        this.refreshMessageReactions(merged.message_id);
        message = merged;
        this.updateInboxPreview(message);
        if (this.activeConversationId$.value === message.conversation_id) {
          this.markAsRead(message.conversation_id);
        }
        return;
      }
    }

    const isFromOther = String(message.sender_id) !== myContactId;
    const mentionsMe = isFromOther && this.messageMentionsCurrentUser(message);

    const duplicateIdx = existing.findIndex(
      (m) =>
        String(m.message_id) === String(message.message_id) ||
        (String(m.sender_id) === String(message.sender_id) &&
          String(m.content ?? '') === String(message.content ?? '') &&
          Math.abs(new Date(m.created_at).getTime() - new Date(message.created_at).getTime()) < 2000)
    );
    const isDuplicate = duplicateIdx >= 0;

    if (!isDuplicate) {
      this.appendMessage(message);

      if (isFromOther) {
        this.playSoftNotificationSound();
      }
      this.updateInboxPreview(message);
    } else {
      const map = new Map(this.messagesMap$.value);
      const msgs = [...existing];
      msgs[duplicateIdx] = this.mergeMessageAttachments(existing[duplicateIdx], message);
      map.set(convId, msgs);
      this.messagesMap$.next(map);
    }

    if (this.activeConversationId$.value !== message.conversation_id) {
      if (isFromOther && !isDuplicate) {
        this.incrementUnread(message.conversation_id);
        if (mentionsMe) {
          this.setConversationMention(message.conversation_id, true);
        }
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
    const current = map.get(message.conversation_id) || [];
    const sameIdIdx = current.findIndex((m) => String(m.message_id) === String(message.message_id));
    if (sameIdIdx >= 0) {
      const msgs = [...current];
      msgs[sameIdIdx] = this.mergeMessageAttachments(current[sameIdIdx], message);
      map.set(message.conversation_id, msgs);
      this.messagesMap$.next(map);
      this.refreshMessageReactions(message.message_id);
      return;
    }

    const msgs = [...current, message];
    map.set(message.conversation_id, msgs);
    this.messagesMap$.next(map);
    this.refreshMessageReactions(message.message_id);
  }

  private updateMessageInConversation(
    conversationId: string,
    messageId: string,
    patch: Partial<Message>
  ): void {
    const map = new Map(this.messagesMap$.value);
    const current = map.get(conversationId) || [];
    const next = current.map((message) =>
      String(message.message_id) === String(messageId)
        ? this.normalizeMessageShape({ ...message, ...patch })
        : message
    );
    map.set(conversationId, next);
    this.messagesMap$.next(map);
  }

  private removeMessageFromConversation(conversationId: string, messageId: string): void {
    const map = new Map(this.messagesMap$.value);
    const current = map.get(conversationId) || [];
    map.set(
      conversationId,
      current.filter((message) => String(message.message_id) !== String(messageId))
    );
    this.messagesMap$.next(map);
  }

  private mergeMessageAttachments(existing: Message, incoming: Message): Message {
    const existingAttachments = this.normalizeAttachmentList(existing.attachments || []);
    const incomingAttachments = this.normalizeAttachmentList(incoming.attachments || []);
    const attachments =
      incomingAttachments.length >= existingAttachments.length ? incomingAttachments : existingAttachments;

    return {
      ...existing,
      ...incoming,
      reactions: incoming.reactions || existing.reactions,
      attachments: attachments.length > 0 ? attachments : incoming.attachments || existing.attachments,
    };
  }

  private normalizeAttachmentList(attachments: Attachment[]): Attachment[] {
    const byId = new Map<string, Attachment>();
    for (const attachment of attachments) {
      const fileId = String(attachment?.file_id || '').trim();
      if (!fileId || fileId.startsWith('temp-')) continue;
      byId.set(fileId, {
        ...attachment,
        file_id: fileId,
        filename: attachment.filename || 'File',
      });
    }
    return Array.from(byId.values());
  }

  private updateInboxPreview(message: Message): void {
    const text = String(message.content ?? '').trim();
    const media = this.messageLooksLikeMedia(message);
    if (!text && !media) {
      return;
    }
    const preview = text || '[Image]';
    const items = this.inbox$.value.map((item) => {
      if (item.conversation_id === message.conversation_id) {
        const mentioned = item.has_mention || this.mentionConversationIds$.value.has(String(item.conversation_id));
        return {
          ...item,
          last_message_preview: preview,
          last_message_at: message.created_at,
          has_mention: mentioned,
        };
      }
      return item;
    });

    items.sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
    this.inbox$.next(items);
  }

  /** First non-empty text field from API / WS objects (POST bodies often omit `content`). */
  private coalesceMessageText(raw: any, fallback = ''): string {
    const cands = [raw?.content, raw?.body, raw?.text, fallback];
    for (const c of cands) {
      if (typeof c === 'string' && c.trim()) return c;
      if (c != null && typeof c !== 'object' && String(c).trim()) return String(c).trim();
    }
    return typeof fallback === 'string' ? fallback : String(fallback ?? '');
  }

  private parseReplyContent(content: string): { reply: MessageReplyPreview; body: string } | null {
    const value = String(content || '');
    const match = value.match(/^\[Reply to ([^\]]+)\]\n> ([^\n]*)\n\n([\s\S]*)$/);
    if (!match) return null;
    return {
      reply: {
        sender_name: match[1].trim(),
        content: match[2].trim(),
      },
      body: match[3],
    };
  }

  private replyBodyText(content: string): string {
    return this.parseReplyContent(content)?.body ?? String(content || '');
  }

  private notifyGroupMembershipChanged(): void {
    this.groupMembershipVersion$.next(this.groupMembershipVersion$.value + 1);
  }

  private replyExcerpt(content: string): string {
    const parsed = this.parseReplyContent(content);
    const base = (parsed?.body ?? content).replace(/\s+/g, ' ').trim();
    return base.length > 120 ? `${base.slice(0, 117)}...` : base || 'Attachment';
  }

  private currentMentionTokens(): string[] {
    const current = this.auth.currentContact;
    const values = [
      current?.username,
      current?.email?.split('@')[0],
      current?.first_name,
      current?.last_name,
      current?.email,
    ];
    return values
      .map((value) => String(value || '').trim().toLowerCase())
      .filter(Boolean)
      .map((value) => value.replace(/^@/, ''));
  }

  private messageTextMentionsCurrentUser(content: string): boolean {
    const tokens = this.currentMentionTokens();
    if (!tokens.length) return false;
    const mentions = Array.from(String(content || '').matchAll(/(^|[^a-zA-Z0-9._-])@([a-zA-Z0-9._-]+)/g))
      .map((match) => match[2].toLowerCase());
    return mentions.some((mention) => tokens.includes(mention));
  }

  private messageMentionsCurrentUser(message: Message): boolean {
    const myId = String(this.auth.contactId || '');
    const explicitMentions = Array.isArray(message.mentions)
      ? message.mentions.map((id) => String(id))
      : [];
    return (!!myId && explicitMentions.includes(myId)) ||
      this.messageTextMentionsCurrentUser(String(message.content || ''));
  }

  private setConversationMention(conversationId: string, hasMention: boolean): void {
    const id = String(conversationId || '');
    if (!id) return;
    const next = new Set(this.mentionConversationIds$.value);
    if (hasMention) {
      next.add(id);
    } else {
      next.delete(id);
    }
    this.mentionConversationIds$.next(next);
    const items = this.inbox$.value.map((item) =>
      String(item.conversation_id) === id ? { ...item, has_mention: hasMention } : item
    );
    this.inbox$.next(items);
  }

  private messageLooksLikeMedia(m: Message): boolean {
    const t = m.message_type;
    if (t && t !== 'TEXT') return true;
    const u = String(m.media_url ?? '').trim();
    if (u && (u.startsWith('http://') || u.startsWith('https://') || u.startsWith('data:'))) {
      return true;
    }
    return Array.isArray(m.attachments) && m.attachments.length > 0;
  }

  /** Same logical message_id can appear twice when WS beats HTTP temp replacement — keep first row. */
  private dedupeMessagesByIdKeepFirst(msgs: Message[]): Message[] {
    const seen = new Set<string>();
    return msgs.filter((m) => {
      const id = String(m.message_id ?? '');
      if (!id) return true;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
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
      content: raw?.content ?? raw?.body ?? raw?.text ?? '',
      media_url: raw?.media_url ?? raw?.mediaUrl ?? raw?.url ?? raw?.file_url,
      created_at: raw?.created_at ?? raw?.createdAt ?? new Date().toISOString(),
      is_read: raw?.is_read,
      edited_at: raw?.edited_at ?? raw?.editedAt,
      is_deleted: Boolean(raw?.is_deleted ?? raw?.isDeleted ?? false),
      deleted_at: raw?.deleted_at ?? raw?.deletedAt,
      reactions: raw?.reactions,
      mentions: raw?.mentions,
      attachments: raw?.attachments,
      is_pinned: raw?.is_pinned,
      pinned_at: raw?.pinned_at,
      pinned_by: raw?.pinned_by,
    };

    const rawContent = String(base.content || '');
    if (rawContent.startsWith(PLAIN_TEXT_MESSAGE_PREFIX)) {
      base.content = rawContent.slice(PLAIN_TEXT_MESSAGE_PREFIX.length);
      base.render_as_plain_text = true;
    } else {
      base.render_as_plain_text = raw?.render_as_plain_text ?? raw?.renderAsPlainText;
    }

    const parsedReply = this.parseReplyContent(String(base.content || ''));
    if (parsedReply) {
      base.content = parsedReply.body;
      base.reply_to = raw?.reply_to ?? raw?.replyTo ?? parsedReply.reply;
    } else {
      base.reply_to = raw?.reply_to ?? raw?.replyTo;
    }

    const uuidRe =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    const toStringArray = (value: any): string[] => {
      if (Array.isArray(value)) {
        return value
          .map((x: any) => (typeof x === 'string' ? x : x?.file_id ?? x?.id ?? ''))
          .map((x: any) => String(x).trim())
          .filter(Boolean);
      }
      if (typeof value === 'string' && value.trim()) {
        const trimmed = value.trim();
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
          try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) return toStringArray(parsed);
            return toStringArray(parsed?.ids ?? parsed?.file_ids ?? parsed?.attachment_ids ?? parsed?.attachments);
          } catch {
            return [];
          }
        }
        return trimmed.split(/[,\s]+/).map((s: string) => s.trim()).filter(Boolean);
      }
      return [];
    };

    const normalizeAttachment = (a: any): Attachment | null => {
      const fileId = String(
        typeof a === 'string' ? a :
        a?.file_id ?? a?.fileId ?? a?.id ?? a?.attachment_id ?? a?.storage_file_id ?? ''
      ).trim();
      if (!fileId || fileId.startsWith('temp-')) return null;
      return {
        file_id: fileId,
        filename: String(a?.filename ?? a?.file_name ?? a?.name ?? a?.original_filename ?? 'File'),
        mime_type: a?.mime_type ?? a?.mimeType,
        size_bytes: a?.size_bytes ?? a?.sizeBytes,
        url: a?.url ?? a?.file_url ?? a?.download_url,
      };
    };

    let normalizedAttachments: Attachment[] = [];
    const addAttachment = (attachment: Attachment | null): void => {
      if (!attachment) return;
      const fileId = String(attachment.file_id || '').trim();
      const url = String(attachment.url || '').trim();
      if (fileId.startsWith('{') || fileId.startsWith('[')) {
        const ids = toStringArray(fileId);
        ids.forEach((id, idx) => {
          addAttachment({
            ...attachment,
            file_id: id,
            filename: attachment.filename || `Attachment ${idx + 1}`,
          });
        });
        return;
      }
      if (fileId && normalizedAttachments.some((a) => a.file_id === fileId)) return;
      if (!fileId && url && normalizedAttachments.some((a) => a.url === url)) return;
      normalizedAttachments.push(attachment);
    };

    // Normalize attachment objects (API may use fileId / id instead of file_id).
    if (Array.isArray(base.attachments) && base.attachments.length > 0) {
      (base.attachments as any[]).forEach((a) => addAttachment(normalizeAttachment(a)));
    }

    const mediaValue = String(base.media_url || '').trim();
    if (mediaValue.startsWith('{') || mediaValue.startsWith('[')) {
      try {
        const parsed = JSON.parse(mediaValue);
        const rawAttachments = Array.isArray(parsed) ? parsed : parsed?.attachments;
        if (Array.isArray(rawAttachments)) {
          rawAttachments.forEach((a) => addAttachment(normalizeAttachment(a)));
        }
        if (!Array.isArray(parsed)) {
          const mediaIds = toStringArray(parsed?.ids ?? parsed?.file_ids ?? parsed?.attachment_ids);
          const mediaFilenames = toStringArray(parsed?.filenames);
          const mediaMimeTypes = toStringArray(parsed?.mime_types ?? parsed?.mimeTypes);
          mediaIds.forEach((id, idx) => {
            addAttachment({
              file_id: id,
              filename: mediaFilenames[idx] || mediaFilenames[0] || `Attachment ${idx + 1}`,
              mime_type: mediaMimeTypes[idx],
            });
          });
        }
      } catch {
        // Fall through to legacy attachment reconstruction below.
      }
    }

    // Reconstruct attachments from alternate API fields.
    let attachmentIds: string[] = [];
    attachmentIds = toStringArray(raw?.attachment_ids);

    if (attachmentIds.length === 0) {
      attachmentIds = toStringArray(raw?.file_ids);
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
      !mediaAsId.startsWith('{') &&
      !mediaAsId.startsWith('[') &&
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

    const filenames: string[] = toStringArray(raw?.filenames).length
      ? toStringArray(raw?.filenames)
      : raw?.filename
      ? [String(raw.filename)]
      : raw?.file_name
      ? [String(raw.file_name)]
      : [];

    const mimeTypes: string[] = toStringArray(raw?.mime_types).length
      ? toStringArray(raw?.mime_types)
      : toStringArray(raw?.mimeTypes);

    if (attachmentIds.length > 0 || filenames.length > 0) {
      const fallbackMime = raw?.mime_type ?? raw?.attachment_mime_type ?? (base.message_type === 'IMAGE' ? 'image/*' : undefined);
      const urlFallback = raw?.file_url ?? raw?.url ?? raw?.media_url ?? raw?.mediaUrl;
      const ids = attachmentIds.length > 0 ? attachmentIds : [];
      const built: Attachment[] = ids.map((id, idx) => ({
        file_id: id,
        filename: filenames[idx] || filenames[0] || (base.message_type === 'IMAGE' ? `Image ${idx + 1}` : `Attachment ${idx + 1}`),
        mime_type: mimeTypes[idx] || fallbackMime,
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

      built.forEach((attachment) => addAttachment(attachment));
    }

    if (normalizedAttachments.length > 0) {
      return { ...base, attachments: normalizedAttachments };
    }

    return base;
  }

  private playSoftNotificationSound(force = false): void {
    if (!force && this.notificationsMuted$.value) return;
    const volume = Math.max(0, Math.min(1, this.notificationVolume$.value));
    if (volume <= 0 && !force) return;

    try {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const master = ctx.createGain();
      const outputGain = Math.max(volume, 0.001);
      master.gain.setValueAtTime(0.0001, ctx.currentTime);
      master.gain.exponentialRampToValueAtTime(outputGain, ctx.currentTime + 0.015);
      master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.42);
      master.connect(ctx.destination);

      const playTone = (frequency: number, start: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(frequency, ctx.currentTime + start);
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.55, ctx.currentTime + start + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + duration);
        osc.connect(gain);
        gain.connect(master);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + duration + 0.02);
      };

      playTone(740, 0, 0.18);
      playTone(988, 0.12, 0.22);
      window.setTimeout(() => ctx.close().catch(() => {}), 600);
    } catch {
    }
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

  private getContactNameById(contactId: string): string {
    const id = String(contactId);
    if (id === String(this.auth.contactId || '') && this.auth.currentContact) {
      return getContactDisplayName(this.auth.currentContact);
    }
    const contact = this.visibleContacts$.value.find((c) => String(c.contact_id) === id);
    return contact ? getContactDisplayName(contact) : `User ${id}`;
  }

  private detectGroupRemovalForCurrentUser(message: Message): void {
    const content = String(message.content || '').trim();
    const match = content.match(/^(.+) removed (.+) from the group$/);
    if (!match) return;

    const myContact = this.auth.currentContact;
    const myName = myContact ? getContactDisplayName(myContact).trim().toLowerCase() : '';
    const removedName = match[2]?.trim().toLowerCase();
    if (!myName || removedName !== myName) return;

    const convId = String(message.conversation_id || '');
    if (convId) {
      this.markGroupRemoved(convId);
    }
  }

  private hydrateReactionsForConversation(conversationId: string, messages: Message[], onlyMissing = false): void {
    const fetchable = messages.filter((m) => {
      if (!m.message_id || String(m.message_id).startsWith('temp-')) return false;
      if (!onlyMissing) return true;
      return !Array.isArray(m.reactions) || m.reactions.length === 0;
    });
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
    const parseReactors = (value: any): any[] => {
      if (Array.isArray(value)) return value;
      if (value && typeof value === 'object') return [value];
      if (typeof value !== 'string' || !value.trim()) return [];

      const trimmed = value.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          const parsed = JSON.parse(trimmed);
          return Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          return [trimmed];
        }
      }

      return trimmed.split(',').map((x: string) => x.trim()).filter(Boolean);
    };

    const displayNameForReactor = (reactor: any): string => {
      if (reactor == null) return '';
      if (typeof reactor === 'string') {
        const trimmed = reactor.trim();
        if (!trimmed) return '';
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
          const parsed = parseReactors(trimmed);
          return parsed.map(displayNameForReactor).filter(Boolean).join(', ');
        }
        return trimmed;
      }

      const reactorId = String(reactor?.contact_id ?? reactor?.contactId ?? reactor?.id ?? '').trim();
      if (reactorId && reactorId === myContactId) return 'You';

      const explicitName = String(
        reactor?.username ??
        reactor?.name ??
        reactor?.display_name ??
        reactor?.displayName ??
        reactor?.email ??
        ''
      ).trim();
      if (explicitName) return explicitName;

      if (reactorId) {
        const contact = contacts.find(c => String(c.contact_id) === reactorId);
        return contact ? getContactDisplayName(contact) : `User ${reactorId}`;
      }

      return '';
    };

    for (const row of rows || []) {
      const emoji = String(row?.emoji || '').trim();
      if (!emoji) continue;

      const contactId = String(row?.contact_id ?? row?.contactId ?? '');
      const explicitHasReacted = row?.hasReacted ?? row?.has_reacted;
      const hasReacted = explicitHasReacted === true || (contactId && contactId === myContactId);

      const rawReactors =
        row?.reactors ??
        row?.reactor_names ??
        row?.reactorNames ??
        row?.reacted_by ??
        row?.reactedBy ??
        row?.users ??
        [];
      const reactorRows = parseReactors(rawReactors);
      const countFromRow = Number(row?.count ?? row?.reaction_count ?? row?.reactionCount ?? reactorRows.length ?? 0);
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

      for (const reactor of reactorRows) {
        const reactorId = String(
          typeof reactor === 'object'
            ? reactor?.contact_id ?? reactor?.contactId ?? reactor?.id ?? ''
            : ''
        ).trim();
        const name = displayNameForReactor(reactor);
        if (reactorId && reactorId === myContactId) {
          existing.hasReacted = true;
        }
        if (name && !existing.reactors.includes(name)) {
          existing.reactors.push(name);
        }
      }

      const directName = String(
        row?.reactor_name ??
        row?.reactorName ??
        row?.contact_name ??
        row?.contactName ??
        row?.username ??
        row?.email ??
        ''
      ).trim();
      if (directName && !existing.reactors.includes(directName)) {
        existing.reactors.push(contactId === myContactId ? 'You' : directName);
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
            const reactors = Array.isArray(current.reactors) ? [...current.reactors] : [];
            if (!reactors.includes('You')) reactors.unshift('You');
            nextReactions[rIdx] = {
              ...current,
              hasReacted: true,
              count: Number(current.count || 0) + 1,
              reactors,
            };
          }
        } else {
          nextReactions.push({ emoji, count: 1, hasReacted: true, reactors: ['You'] });
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
              reactors: Array.isArray(current.reactors)
                ? current.reactors.filter((name: string) => name !== 'You')
                : current.reactors,
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
