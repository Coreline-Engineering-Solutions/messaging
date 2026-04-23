import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subject, Subscription } from 'rxjs';
import { AuthService } from './auth.service';
import { MessagingApiService } from './messaging-api.service';
import { MessagingWebSocketService } from './messaging-websocket.service';
import {
  InboxItem,
  Message,
  Contact,
  ChatWindow,
  WebSocketMessage,
  SidebarSide,
  getContactDisplayName,
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
      error: (err: any) => console.error('Failed to load inbox:', err),
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
      error: (err: any) => console.error('Failed to load contacts:', err),
    });
  }

  // ── Conversations ──
  openConversation(conversationId: string, name: string, isGroup = false): void {
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

        const sorted = [...messages].sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );

        if (beforeMessageId) {
          map.set(conversationId, [...sorted, ...existing]);
        } else {
          map.set(conversationId, sorted);
        }

        this.messagesMap$.next(map);
        this.loadingMessages$.next(false);
      },
      error: (err: any) => {
        console.error('Failed to load messages:', err);
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
      error: (err: any) => console.error('Failed to send message:', err),
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
        if (res?.conversation_id) {
          const recipient = this.visibleContacts$.value.find(
            (c) => c.contact_id === recipientContactId
          );
          const name = recipient ? getContactDisplayName(recipient) : 'Direct Message';
          this.openConversation(res.conversation_id, name, false);
        }
      },
      error: (err: any) => console.error('Failed to send DM:', err),
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
        this.loadInbox();
        this.openConversation(conv.conversation_id, name, true);
      },
      error: (err: any) => console.error('Failed to create group:', err),
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
      error: (err: any) => console.error('Group action failed:', err),
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
      error: (err: any) => console.error('Delete conversation failed:', err),
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
      error: (err: any) => console.error('Clear conversation failed:', err),
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
      error: (err: any) => console.error('Delete group failed:', err),
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
        break;
      case 'error':
        this.handleWebSocketError(msg.message);
        break;
    }
  }

  private handleWebSocketError(errorMessage: string | undefined): void {
    const contactId = this.auth.contactId;
    
    if (!errorMessage) {
      console.error('WebSocket error: Unknown error');
      return;
    }

    if (errorMessage.includes('Contact not found') || errorMessage.includes('contact')) {
      console.error(
        `❌ Messaging contact not found for ID "${contactId}". ` +
        `Ensure a record exists in the messaging.contacts table. ` +
        `If the contact doesn't exist, create one via: POST /messaging/contacts with contact_id="${contactId}". ` +
        `Error: ${errorMessage}`
      );
    } else if (errorMessage.includes('unauthorized') || errorMessage.includes('auth')) {
      console.error(
        `❌ WebSocket authentication failed. ` +
        `Verify session_gid is valid and not expired. ` +
        `Re-authenticate and call messagingAuth.setSession() again. ` +
        `Error: ${errorMessage}`
      );
    } else if (errorMessage.includes('permission') || errorMessage.includes('forbidden')) {
      console.error(
        `❌ Permission denied for contact "${contactId}". ` +
        `Ensure the contact has access to the messaging system. ` +
        `Error: ${errorMessage}`
      );
    } else {
      console.error(`❌ WebSocket error: ${errorMessage}`);
    }
  }

  private handleNewMessage(data: any): void {
    if (!data) return;

    const message: Message = {
      message_id: data.message_id,
      conversation_id: data.conversation_id,
      sender_id: data.sender_id,
      sender_name: data.sender_name || data.sender_username,
      sender_username: data.sender_username,
      sender_first_name: data.sender_first_name,
      sender_last_name: data.sender_last_name,
      message_type: data.message_type,
      content: data.content,
      media_url: data.media_url,
      created_at: data.created_at,
      is_read: data.is_read,
    };

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

  private playNotificationSound(): void {
    try {
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGGS57OihUBELTKXh8bllHAU2jdXzzn0vBSh+zPLaizsKFGCz6OyrWBQLSKDf8sFuIwUug8/y24k3CBhku+zooVARC0yl4fG5ZRwFNo3V8859LwUofszy2os7ChRgs+jsq1gVC0ig3/LBbiMFLoLP8tuJNwgYZLvs6KFQEQtMpeHxuWUcBTaN1fPOfS8FKH7M8tqLOwoUYLPo7KtYFQtIoN/ywW4jBS6Cz/LbiTcIGGS77OihUBELTKXh8bllHAU2jdXzzn0vBSh+zPLaizsKFGCz6OyrWBULSKDf8sFuIwUugs/y24k3CBhku+zooVARC0yl4fG5ZRwFNo3V8859LwUofszy2os7ChRgs+jsq1gVC0ig3/LBbiMFLoLP8tuJNwgYZLvs6KFQEQtMpeHxuWUcBTaN1fPOfS8FKH7M8tqLOwoUYLPo7KtYFQtIoN/ywW4jBS6Cz/LbiTcIGGS77OihUBELTKXh8bllHAU2jdXzzn0vBSh+zPLaizsKFGCz6OyrWBULSKDf8sFuIwUugs/y24k3CBhku+zooVARC0yl4fG5ZRwFNo3V8859LwUofszy2os7ChRgs+jsq1gVC0ig3/LBbiMFLoLP8tuJNwgYZLvs6KFQEQtMpeHxuWUcBTaN1fPOfS8FKH7M8tqLOwoUYLPo7KtYFQtIoN/ywW4jBS6Cz/LbiTcIGGS77OihUBELTKXh8bllHAU2jdXzzn0vBSh+zPLaizsKFGCz6OyrWBULSKDf8sFuIwUugs/y24k3CBhku+zooVARC0yl4fG5ZRwFNo3V8859LwUofszy2os7ChRgs+jsq1gVC0ig3/LBbiMFLoLP8tuJNwgYZLvs6KFQEQtMpeHxuWUcBTaN1fPOfS8FKH7M8tqLOwoUYLPo7KtYFQtIoN/ywW4jBS6Cz/LbiTcIGGS77OihUBELTKXh8bllHAU2jdXzzn0vBSh+zPLaizsKFGCz6OyrWBULSKDf8sFuIwUugs/y24k3CBhku+zooVARC0yl4fG5ZRwFNo3V8859LwUofszy2os7ChRgs+jsq1gVC0ig3/LBbiMFLoLP8tuJNwgYZLvs6KFQEQtMpeHxuWUcBTaN1fPOfS8FKH7M8tqLOwoUYLPo7KtYFQtIoN/ywW4jBS6Cz/LbiTcIGGS77OihUBELTKXh8bllHAU2jdXzzn0vBSh+zPLaizsKFGCz6OyrWBULSKDf8sFuIwUugs/y24k3CBhku+zooVARC0yl4fG5ZRwFNo3V8859LwUofszy');
      audio.volume = 0.3;
      audio.play().catch(() => {});
    } catch (err) {
      console.warn('Notification sound failed:', err);
    }
  }

  private recalcUnread(items: InboxItem[]): void {
    const total = items.reduce((sum, i) => sum + Number(i.unread_count || 0), 0);
    this.totalUnread$.next(total);
  }
}
