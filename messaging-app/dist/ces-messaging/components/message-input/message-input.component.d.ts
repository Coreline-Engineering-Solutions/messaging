import { AfterViewInit, ElementRef, EventEmitter, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import * as i0 from "@angular/core";
export interface MessagePayload {
    text: string;
    files: File[];
    forcePlainText?: boolean;
}
export interface MessageTextPayload {
    text: string;
    forcePlainText?: boolean;
}
export interface ReplyPreview {
    senderName: string;
    content: string;
}
export interface MentionOption {
    contactId: string;
    label: string;
    token: string;
}
export declare class MessageInputComponent implements OnChanges, AfterViewInit, OnDestroy {
    conversationId: string | null;
    replyTo: ReplyPreview | null;
    enableMentions: boolean;
    mentionOptions: MentionOption[];
    messageSent: EventEmitter<MessageTextPayload>;
    messageWithFiles: EventEmitter<MessagePayload>;
    replyCancelled: EventEmitter<void>;
    fileInput: ElementRef<HTMLInputElement>;
    messageTextarea: ElementRef<HTMLTextAreaElement>;
    messageText: string;
    selectedFiles: File[];
    textareaHeight: number;
    mentionSuggestions: MentionOption[];
    detectedCodeLanguage: string | null;
    codeDetectionDismissed: boolean;
    private readonly draftPrefix;
    private lastConversationId;
    private resizing;
    private resizeStartY;
    private resizeStartHeight;
    private readonly minTextareaHeight;
    private readonly maxTextareaHeight;
    private manualTextareaHeight;
    private activeMentionStart;
    private activeMentionEnd;
    private boundResizeMove;
    private boundResizeEnd;
    ngOnChanges(changes: SimpleChanges): void;
    ngAfterViewInit(): void;
    ngOnDestroy(): void;
    get canSend(): boolean;
    send(): void;
    onTextChange(value: string): void;
    onPaste(event: ClipboardEvent): void;
    autoResize(): void;
    onResizeStart(event: MouseEvent): void;
    private onResizeMove;
    private onResizeEnd;
    private queueAutoResize;
    private draftKey;
    private loadDraft;
    private persistDraft;
    private clearDraft;
    private htmlTableToText;
    private insertTextAtCursor;
    private nameClipboardImage;
    focus(): void;
    updateMentionSuggestions(): void;
    insertMention(option: MentionOption): void;
    dismissCodeDetection(): void;
    private updateCodeDetection;
    private detectCodeLanguage;
    private looksLikeMarkdown;
    private isTableContent;
    onKeydown(event: KeyboardEvent): void;
    onEnter(event: Event): void;
    onFilesSelected(event: Event): void;
    addFiles(files: File[]): void;
    removeFile(index: number): void;
    getFileIcon(file: File): string;
    formatSize(bytes: number): string;
    static ɵfac: i0.ɵɵFactoryDeclaration<MessageInputComponent, never>;
    static ɵcmp: i0.ɵɵComponentDeclaration<MessageInputComponent, "app-message-input", never, { "conversationId": { "alias": "conversationId"; "required": false; }; "replyTo": { "alias": "replyTo"; "required": false; }; "enableMentions": { "alias": "enableMentions"; "required": false; }; "mentionOptions": { "alias": "mentionOptions"; "required": false; }; }, { "messageSent": "messageSent"; "messageWithFiles": "messageWithFiles"; "replyCancelled": "replyCancelled"; }, never, never, true, never>;
}
