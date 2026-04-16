import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subject, Subscription } from 'rxjs';
import { AuthService } from './auth.service';
import { MessagingApiService } from './messaging-api.service';
import { MessagingWebSocketService } from './messaging-websocket.service';
import {
  InboxItem,
  Message,
  Contact,
  ChatWindow,
  WebSocketMessage,
} from '../models/messaging.models';

@Injectable({ providedIn: 'root' })
export class MessagingStoreService implements OnDestroy {
  // ── State subjects ──
  private inbox$ = new BehaviorSubject<InboxItem[]>([]);
  private messagesMap$ = new BehaviorSubject<Map<string, Message[]>>(new Map());
  private openChats$ = new BehaviorSubject<ChatWindow[]>([]);
  private visibleContacts$ = new BehaviorSubject<Contact[]>([]);
  private panelOpen$ = new BehaviorSubject<boolean>(false);
  private activeView$ = new BehaviorSubject<'inbox' | 'chat' | 'new-conversation' | 'group-manager'>('inbox');
  private activeConversationId$ = new BehaviorSubject<string | null>(null);
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
  readonly wsStatus = this.wsService.status$;
  readonly panelPosition = this.panelPosition$.asObservable();
  readonly panelSize = this.panelSize$.asObservable();
  readonly wasOpenBeforeDrag = this.wasOpenBeforeDrag$.asObservable();

  private wsSub: Subscription | null = null;
  private destroy$ = new Subject<void>();

  constructor(
    private auth: AuthService,
    private api: MessagingApiService,
    private wsService: MessagingWebSocketService
  ) {}

  // ── Initialization ──
  initialize(): void {
    if (!this.auth.isAuthenticated()) return;

    const contactId = this.auth.contactId!;
    const sessionGid = this.auth.sessionGid!;

    this.loadInbox();
    this.loadVisibleContacts();

    this.wsService.connect(contactId, sessionGid);
    this.listenWebSocket();
  }

  teardown(): void {
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

  setView(view: 'inbox' | 'chat' | 'new-conversation' | 'group-manager'): void {
    this.activeView$.next(view);
  }

  // ── Inbox ──
  loadInbox(): void {
    const contactId = this.auth.contactId;
    if (!contactId) return;

    this.api.getInbox(contactId).subscribe({
      next: (items) => {
        this.inbox$.next(items);
        this.recalcUnread(items);

        // Subscribe to all conversations via WebSocket
        const ids = items.map((i) => i.conversation_id);
        this.wsService.subscribeAll(ids);
      },
      error: (err) => console.error('Failed to load inbox:', err),
    });
  }

  // ── Contacts ──
  loadVisibleContacts(): void {
    const contactId = this.auth.contactId;
    if (!contactId) return;

    this.api.getVisibleContacts(contactId).subscribe({
      next: (contacts) => this.visibleContacts$.next(contacts),
      error: (err) => console.error('Failed to load contacts:', err),
    });
  }

  // ── Conversations ──
  openConversation(conversationId: string, name: string, isGroup = false): void {
    this.activeConversationId$.next(conversationId);
    this.activeView$.next('chat');
    this.openPanel();

    // Add to open chats if not already there
    const chats = this.openChats$.value;
    if (!chats.find((c) => c.conversationId === conversationId)) {
      this.openChats$.next([
        ...chats,
        { conversationId, name, isGroup, isMinimized: false, unreadCount: 0 },
      ]);
    }

    this.loadMessages(conversationId);
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
  loadMessages(conversationId: string, beforeMessageId?: string): void {
    const contactId = this.auth.contactId;
    if (!contactId) return;

    this.loadingMessages$.next(true);

    this.api.getMessages(conversationId, contactId, beforeMessageId, 50).subscribe({
      next: (messages) => {
        const map = new Map(this.messagesMap$.value);
        const existing = map.get(conversationId) || [];

        if (beforeMessageId) {
          // Prepend older messages
          map.set(conversationId, [...messages, ...existing]);
        } else {
          map.set(conversationId, messages);
        }

        this.messagesMap$.next(map);
        this.loadingMessages$.next(false);
      },
      error: (err) => {
        console.error('Failed to load messages:', err);
        this.loadingMessages$.next(false);
      },
    });
  }

  sendMessage(conversationId: string, content: string, messageType: 'TEXT' | 'IMAGE' = 'TEXT'): void {
    const contactId = this.auth.contactId;
    if (!contactId) return;

    this.api.sendMessage(conversationId, contactId, content, messageType).subscribe({
      next: (res) => {
        // The WebSocket will deliver the message back to us
        // But for instant UI feedback, add optimistic message
        const optimistic: Message = {
          message_id: res?.message_id || `temp-${Date.now()}`,
          conversation_id: conversationId,
          sender_id: contactId,
          sender_name: `${this.auth.currentContact?.first_name || ''} ${this.auth.currentContact?.last_name || ''}`.trim(),
          message_type: messageType,
          content,
          created_at: new Date().toISOString(),
          is_read: true,
        };
        this.appendMessage(optimistic);
      },
      error: (err) => console.error('Failed to send message:', err),
    });
  }

  sendDirectMessage(recipientContactId: string, content: string): void {
    const contactId = this.auth.contactId;
    if (!contactId) return;

    this.api.sendDirectMessage(contactId, recipientContactId, content).subscribe({
      next: (res) => {
        // Reload inbox to get the new conversation
        this.loadInbox();
        if (res?.conversation_id) {
          const recipient = this.visibleContacts$.value.find(
            (c) => c.contact_id === recipientContactId
          );
          const name = recipient
            ? `${recipient.first_name} ${recipient.last_name}`
            : 'Direct Message';
          this.openConversation(res.conversation_id, name, false);
        }
      },
      error: (err) => console.error('Failed to send DM:', err),
    });
  }

  createGroupConversation(participantIds: string[], name: string): void {
    const contactId = this.auth.contactId;
    if (!contactId) return;

    this.api.createConversation(contactId, participantIds, name).subscribe({
      next: (conv) => {
        this.loadInbox();
        this.openConversation(conv.conversation_id, name, true);
      },
      error: (err) => console.error('Failed to create group:', err),
    });
  }

  markAsRead(conversationId: string): void {
    const contactId = this.auth.contactId;
    if (!contactId) return;

    this.api.markConversationRead(conversationId, contactId).subscribe({
      next: () => {
        // Update unread count in inbox
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
      error: (err) => console.error('Group action failed:', err),
    });
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
        break;
      case 'error':
        console.error('WebSocket error:', msg.message);
        break;
    }
  }

  private handleNewMessage(data: any): void {
    if (!data) return;

    const message: Message = {
      message_id: data.message_id,
      conversation_id: data.conversation_id,
      sender_id: data.sender_id,
      sender_name: data.sender_name,
      message_type: data.message_type,
      content: data.content,
      media_url: data.media_url,
      created_at: data.created_at,
    };

    // Don't duplicate if it's our own optimistic message
    const existing = this.messagesMap$.value.get(message.conversation_id) || [];
    const isDuplicate = existing.some(
      (m) => m.message_id === message.message_id ||
             (m.sender_id === message.sender_id &&
              m.content === message.content &&
              Math.abs(new Date(m.created_at).getTime() - new Date(message.created_at).getTime()) < 2000)
    );

    if (!isDuplicate) {
      this.appendMessage(message);
    }

    // Update inbox
    this.updateInboxPreview(message);

    // If not the active conversation, increment unread
    if (this.activeConversationId$.value !== message.conversation_id) {
      this.incrementUnread(message.conversation_id);
    } else {
      this.markAsRead(message.conversation_id);
    }
  }

  private appendMessage(message: Message): void {
    const map = new Map(this.messagesMap$.value);
    const msgs = [...(map.get(message.conversation_id) || []), message];
    map.set(message.conversation_id, msgs);
    this.messagesMap$.next(map);
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

    // Sort by last_message_at descending
    items.sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
    this.inbox$.next(items);
  }

  private incrementUnread(conversationId: string): void {
    const items = this.inbox$.value.map((item) =>
      item.conversation_id === conversationId
        ? { ...item, unread_count: item.unread_count + 1 }
        : item
    );
    this.inbox$.next(items);
    this.recalcUnread(items);
  }

  private recalcUnread(items: InboxItem[]): void {
    const total = items.reduce((sum, i) => sum + i.unread_count, 0);
    this.totalUnread$.next(total);
  }
}
