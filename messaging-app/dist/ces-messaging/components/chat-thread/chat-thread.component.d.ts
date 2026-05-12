import { OnInit, OnDestroy, ElementRef, AfterViewChecked, ChangeDetectorRef } from '@angular/core';
import { MessagingStoreService } from '../../services/messaging-store.service';
import { MessagingFileService } from '../../services/messaging-file.service';
import { AuthService } from '../../services/auth.service';
import { Contact, Message } from '../../models/messaging.models';
import { MessagePayload } from '../message-input/message-input.component';
import * as i0 from "@angular/core";
export declare class ChatThreadComponent implements OnInit, OnDestroy, AfterViewChecked {
    private store;
    private auth;
    private fileService;
    private cdr;
    scrollContainer: ElementRef;
    messages: Message[];
    visibleContacts: Contact[];
    conversationName: string;
    isGroup: boolean;
    loading: boolean;
    myContactId: string | null;
    private conversationId;
    private sub;
    private shouldScrollToBottom;
    uploading: boolean;
    hoveredMessageId: string | null;
    quickEmojis: string[];
    /** Lightbox: currently displayed full-size data URL */
    lightboxUrl: string | null;
    /** When true the lightbox is a draggable floating window instead of full-screen */
    lightboxDetached: boolean;
    lightboxX: number;
    lightboxY: number;
    lightboxW: number;
    lightboxH: number;
    private lbDragging;
    private lbDragOffX;
    private lbDragOffY;
    private boundLbMove;
    private boundLbEnd;
    private lbResizing;
    private lbResizeStartX;
    private lbResizeStartY;
    private lbResizeStartW;
    private lbResizeStartH;
    private boundLbResizeMove;
    private boundLbResizeEnd;
    /** Tracks which file IDs are currently being fetched to avoid duplicate requests */
    private mediaLoading;
    /** Tracks file IDs where retrieval failed so UI doesn't spin forever. */
    private mediaFailed;
    constructor(store: MessagingStoreService, auth: AuthService, fileService: MessagingFileService, cdr: ChangeDetectorRef);
    ngOnInit(): void;
    ngAfterViewChecked(): void;
    ngOnDestroy(): void;
    goBack(): void;
    onClearConversation(): void;
    onDeleteConversation(): void;
    onGroupSettings(): void;
    onSendMessage(content: string): void;
    onSendWithFiles(payload: MessagePayload): void;
    loadOlder(): void;
    onScroll(): void;
    shouldShowDateSeparator(index: number): boolean;
    shouldShowSender(index: number): boolean;
    isOwnMessage(msg: Message): boolean;
    getSenderName(msg: Message): string;
    formatTime(dateStr: string): string;
    formatDate(dateStr: string): string;
    private scrollToBottom;
    private getFilenameLike;
    /** Returns the primary attachment for a message, if any. */
    private getPrimaryAttachment;
    isImageAttachment(msg: Message): boolean;
    /** Returns the cached data URL for a message's media, or null and triggers background load. */
    getMediaUrl(msg: Message): string | null;
    private prewarmMedia;
    private fetchMedia;
    shouldShowMediaSpinner(msg: Message): boolean;
    isVideoAttachment(msg: Message): boolean;
    getAttachmentMimeType(msg: Message): string;
    getAttachmentName(msg: Message): string;
    openLightbox(dataUrl: string): void;
    /** Fullscreen mode: only close when the dimmed backdrop is clicked, not after toolbar actions. */
    onLightboxBackdropClick(event: MouseEvent): void;
    expandLightbox(): void;
    closeLightbox(): void;
    detachLightbox(): void;
    onLightboxDragStart(event: MouseEvent): void;
    private onLightboxDragMove;
    private onLightboxDragEnd;
    onLightboxResizeStart(event: MouseEvent): void;
    private onLightboxResizeMove;
    private onLightboxResizeEnd;
    onEmojiSelected(emoji: string, messageId: string): void;
    toggleReaction(emoji: string, messageId: string): void;
    getReactorTooltip(reaction: any): string;
    static ɵfac: i0.ɵɵFactoryDeclaration<ChatThreadComponent, never>;
    static ɵcmp: i0.ɵɵComponentDeclaration<ChatThreadComponent, "app-chat-thread", never, {}, {}, never, never, true, never>;
}
