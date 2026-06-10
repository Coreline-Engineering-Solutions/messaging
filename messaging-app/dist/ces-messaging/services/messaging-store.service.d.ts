import { OnDestroy } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { MessagingApiService } from './messaging-api.service';
import { MessagingWebSocketService } from './messaging-websocket.service';
import { InboxItem, Message, MessageReplyPreview, Contact, ChatWindow, SidebarSide } from '../models/messaging.models';
import { MessagingConfig } from '../messaging.config';
import * as i0 from "@angular/core";
export declare class MessagingStoreService implements OnDestroy {
    private auth;
    private api;
    private wsService;
    private config;
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
    private panelFloating$;
    private notificationVolume$;
    private notificationsMuted$;
    private messageTextScale$;
    private codeTextScale$;
    private toast$;
    private removedGroupIds$;
    private mentionConversationIds$;
    private groupMembershipVersion$;
    private activeDbGid$;
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
    readonly panelFloating: Observable<boolean>;
    readonly notificationVolume: Observable<number>;
    readonly notificationsMuted: Observable<boolean>;
    readonly messageTextScale: Observable<number>;
    readonly codeTextScale: Observable<number>;
    readonly toast: Observable<{
        message: string;
        type: 'info' | 'success' | 'error';
    }>;
    readonly removedGroupIds: Observable<Set<string>>;
    readonly mentionConversationIds: Observable<Set<string>>;
    readonly groupMembershipVersion: Observable<number>;
    readonly activeDbGid: Observable<string>;
    private wsSub;
    private destroy$;
    private pollTimer;
    private groupSettings$;
    private deletingConversationIds;
    private removalToastShown;
    private toastTimer;
    readonly groupSettings: Observable<{
        conversationId: string;
        name: string;
        isProject?: boolean;
        isProjectSubgroup?: boolean;
        isProjectSubgroupCreate?: boolean;
        dbGid?: string;
        projectGid?: string;
        parentConversationId?: string;
        subject?: string;
    }>;
    constructor(auth: AuthService, api: MessagingApiService, wsService: MessagingWebSocketService, config: MessagingConfig);
    get projectGroupsEnabled(): boolean;
    initialize(): void;
    private initializeWithVerifiedSession;
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
    setPanelFloating(isFloating: boolean): void;
    setNotificationVolume(volume: number): void;
    setNotificationsMuted(muted: boolean): void;
    setMessageTextScale(scale: number): void;
    setCodeTextScale(scale: number): void;
    testNotificationSound(): void;
    prepareOutgoingMessageContent(content: string, replyTo?: Message | null, forcePlainText?: boolean): string;
    createReplyPreview(message: Message): MessageReplyPreview;
    showToast(message: string, type?: 'info' | 'success' | 'error', durationMs?: number): void;
    getSidebarSide(): SidebarSide;
    setActiveDbGid(dbGid: string | null | undefined): void;
    loadInbox(): void;
    loadVisibleContacts(): void;
    openConversation(conversationId: string, name: string, isGroup?: boolean, isProject?: boolean, isProjectSubgroup?: boolean, dbGid?: string, projectGid?: string, parentConversationId?: string, subgroupSubject?: string): void;
    closeChat(conversationId: string): void;
    markGroupRemoved(conversationId: string): void;
    exitRemovedGroup(conversationId: string): void;
    loadMessages(conversationId: string, beforeMessageId?: string, skipReactionHydration?: boolean): void;
    sendMessage(conversationId: string | null, content: string, messageType?: 'TEXT' | 'IMAGE' | 'SYSTEM', options?: {
        replyTo?: Message | null;
        mentions?: string[];
        forcePlainText?: boolean;
    }): void;
    openDirectConversation(recipientContactId: string, displayName: string): void;
    sendDirectMessage(recipientContactId: string, content: string): void;
    createGroupConversation(participantIds: string[], name: string, callbacks?: {
        success?: () => void;
        error?: () => void;
    }): void;
    openGroupSettings(conversationId: string, name: string, isProject?: boolean, isProjectSubgroup?: boolean, dbGid?: string, projectGid?: string, parentConversationId?: string, subject?: string): void;
    openProjectSubgroupCreator(parent: InboxItem): void;
    clearGroupSettings(): void;
    markAsRead(conversationId: string): void;
    manageGroup(action: 'create' | 'add' | 'remove' | 'rename', conversationId?: string, groupName?: string, participantContactIds?: string[], callbacks?: {
        success?: () => void;
        error?: () => void;
    }): void;
    setGroupAdmin(conversationId: string, targetContactId: string, isAdmin: boolean, callbacks?: {
        success?: () => void;
        error?: () => void;
    }): void;
    createProjectSubgroup(parentConversationId: string, name: string, subject: string | null | undefined, participantIds: string[], callbacks?: {
        success?: () => void;
        error?: () => void;
    }): void;
    updateProjectSubgroup(conversationId: string, name: string, subject: string | null | undefined, callbacks?: {
        success?: () => void;
        error?: () => void;
    }): void;
    deleteConversation(conversationId: string): void;
    clearConversation(conversationId: string): void;
    deleteGroup(conversationId: string, callbacks?: {
        success?: () => void;
        error?: () => void;
    }): void;
    private removeConversationFromUi;
    private removeProjectConversationsFromUi;
    addReaction(messageId: string, emoji: string): void;
    removeReaction(messageId: string, emoji: string): void;
    editMessage(messageId: string, content: string): void;
    deleteMessage(messageId: string): void;
    getActiveConversationId(): string | null;
    getMessagesForConversation(conversationId: string): Message[];
    getCurrentInbox(): InboxItem[];
    /**
     * Prefer `{ type, data }`; support flat `{ type, ...fields }` envelopes from older backends.
     */
    private wsEventPayload;
    private listenWebSocket;
    private handleWsMessage;
    private handleConversationUpdated;
    private handleGroupUpdated;
    private handleWebSocketError;
    private handleNewMessage;
    /** Public — lets components add an optimistic message without a round-trip. */
    appendOptimisticMessage(message: Message): void;
    private appendMessage;
    private updateMessageInConversation;
    private removeMessageFromConversation;
    private mergeMessageAttachments;
    private normalizeAttachmentList;
    private updateInboxPreview;
    /** First non-empty text field from API / WS objects (POST bodies often omit `content`). */
    private coalesceMessageText;
    private parseReplyContent;
    private replyBodyText;
    private notifyGroupMembershipChanged;
    private replyExcerpt;
    private currentMentionTokens;
    private messageTextMentionsCurrentUser;
    private messageMentionsCurrentUser;
    private setConversationMention;
    private messageLooksLikeMedia;
    /** Same logical message_id can appear twice when WS beats HTTP temp replacement — keep first row. */
    private dedupeMessagesByIdKeepFirst;
    private incrementUnread;
    /**
     * Normalize backend message shapes so UI can reliably render attachments/media.
     * Supports legacy and current field names returned by API/WS payloads.
     */
    private normalizeMessageShape;
    private playSoftNotificationSound;
    private playNotificationSound;
    private recalcUnread;
    private getContactNameById;
    private detectGroupRemovalForCurrentUser;
    private hydrateReactionsForConversation;
    private refreshMessageReactions;
    private normalizeReactionRows;
    private applyReactionOptimistically;
    static ɵfac: i0.ɵɵFactoryDeclaration<MessagingStoreService, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<MessagingStoreService>;
}
