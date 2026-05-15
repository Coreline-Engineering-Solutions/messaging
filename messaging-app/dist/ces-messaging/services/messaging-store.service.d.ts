import { OnDestroy } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { MessagingApiService } from './messaging-api.service';
import { MessagingWebSocketService } from './messaging-websocket.service';
import { InboxItem, Message, Contact, ChatWindow, SidebarSide } from '../models/messaging.models';
import * as i0 from "@angular/core";
export declare class MessagingStoreService implements OnDestroy {
    private auth;
    private api;
    private wsService;
    private inbox$;
    private messagesMap$;
    private openChats$;
    private visibleContacts$;
    private panelOpen$;
    private activeView$;
    private sidebarSide$;
    private activeConversationId$;
    private pendingDmRecipient$;
    private totalUnread$;
    private loadingMessages$;
    private panelPosition$;
    private panelSize$;
    private wasOpenBeforeDrag$;
    readonly inbox: Observable<InboxItem[]>;
    readonly messagesMap: Observable<Map<string, Message[]>>;
    readonly openChats: Observable<ChatWindow[]>;
    readonly visibleContacts: Observable<Contact[]>;
    readonly panelOpen: Observable<boolean>;
    readonly activeView: Observable<"inbox" | "chat" | "new-conversation" | "group-manager" | "conversation-settings">;
    readonly activeConversationId: Observable<string>;
    readonly totalUnread: Observable<number>;
    readonly loadingMessages: Observable<boolean>;
    wsStatus: Observable<string>;
    readonly panelPosition: Observable<{
        x: number;
        y: number;
    }>;
    readonly panelSize: Observable<{
        width: number;
        height: number;
    }>;
    readonly wasOpenBeforeDrag: Observable<boolean>;
    readonly sidebarSide: Observable<SidebarSide>;
    private wsSub;
    private destroy$;
    private pollTimer;
    private groupSettings$;
    readonly groupSettings: Observable<{
        conversationId: string;
        name: string;
    }>;
    constructor(auth: AuthService, api: MessagingApiService, wsService: MessagingWebSocketService);
    initialize(): void;
    teardown(): void;
    private startPolling;
    private stopPolling;
    ngOnDestroy(): void;
    togglePanel(buttonX?: number, buttonY?: number): void;
    openPanel(buttonX?: number, buttonY?: number): void;
    closePanel(): void;
    setPanelSize(width: number, height: number): void;
    getPanelSize(): {
        width: number;
        height: number;
    };
    onButtonDragStart(): void;
    onButtonDragEnd(buttonX: number, buttonY: number): void;
    setView(view: 'inbox' | 'chat' | 'new-conversation' | 'group-manager' | 'conversation-settings'): void;
    toggleSidebarSide(): void;
    getSidebarSide(): SidebarSide;
    loadInbox(): void;
    loadVisibleContacts(): void;
    openConversation(conversationId: string, name: string, isGroup?: boolean): void;
    closeChat(conversationId: string): void;
    loadMessages(conversationId: string, beforeMessageId?: string, skipReactionHydration?: boolean): void;
    sendMessage(conversationId: string | null, content: string, messageType?: 'TEXT' | 'IMAGE'): void;
    openDirectConversation(recipientContactId: string, displayName: string): void;
    sendDirectMessage(recipientContactId: string, content: string): void;
    createGroupConversation(participantIds: string[], name: string): void;
    openGroupSettings(conversationId: string, name: string): void;
    clearGroupSettings(): void;
    markAsRead(conversationId: string): void;
    manageGroup(action: 'create' | 'add' | 'remove' | 'rename', conversationId?: string, groupName?: string, participantContactIds?: string[]): void;
    deleteConversation(conversationId: string): void;
    clearConversation(conversationId: string): void;
    deleteGroup(conversationId: string): void;
    addReaction(messageId: string, emoji: string): void;
    removeReaction(messageId: string, emoji: string): void;
    getActiveConversationId(): string | null;
    getMessagesForConversation(conversationId: string): Message[];
    getCurrentInbox(): InboxItem[];
    /**
     * Prefer `{ type, data }`; support flat `{ type, ...fields }` envelopes from older backends.
     */
    private wsEventPayload;
    private listenWebSocket;
    private handleWsMessage;
    private handleGroupUpdated;
    private handleWebSocketError;
    private handleNewMessage;
    /** Public — lets components add an optimistic message without a round-trip. */
    appendOptimisticMessage(message: Message): void;
    private appendMessage;
    private updateInboxPreview;
    /** First non-empty text field from API / WS objects (POST bodies often omit `content`). */
    private coalesceMessageText;
    private messageLooksLikeMedia;
    /** Same logical message_id can appear twice when WS beats HTTP temp replacement — keep first row. */
    private dedupeMessagesByIdKeepFirst;
    private incrementUnread;
    /**
     * Normalize backend message shapes so UI can reliably render attachments/media.
     * Supports legacy and current field names returned by API/WS payloads.
     */
    private normalizeMessageShape;
    private playNotificationSound;
    private recalcUnread;
    private hydrateReactionsForConversation;
    private refreshMessageReactions;
    private normalizeReactionRows;
    private applyReactionOptimistically;
    static ɵfac: i0.ɵɵFactoryDeclaration<MessagingStoreService, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<MessagingStoreService>;
}
