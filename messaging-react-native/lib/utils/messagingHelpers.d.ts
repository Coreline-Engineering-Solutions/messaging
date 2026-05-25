import type { Contact, InboxItem, Message, MessageReaction } from '../types/messaging';
export declare function isTempMessageId(id: string | undefined | null): boolean;
/** JSON-looking attachment ids must not be sent to storage retrieve. */
export declare function isStructuredAttachmentId(id: string | undefined | null): boolean;
export declare function isHttpOrDataUrl(url: string | undefined | null): boolean;
/** Storage file id (UUID / hex), not a fetchable http URL. */
export declare function looksLikeStorageFileId(value: string | undefined | null): boolean;
/**
 * Rebuild attachments[] and resolve media_url file ids (Angular normalizeMessageShape parity).
 */
export declare function normalizeMessageFromApi(raw: Record<string, unknown>): Message;
export declare function formatMessageTime(iso: string): string;
export declare function formatDateSeparatorLabel(iso: string): string;
export declare function shouldShowDateSeparator(messages: Message[], index: number): boolean;
export declare function messageLooksLikeMedia(msg: Message): boolean;
export declare function getMessagePreviewText(msg: Message): string;
export declare function dedupeMessagesById(messages: Message[]): Message[];
export declare function normalizeReactionRows(rows: unknown[], myContactId: string, contacts: Contact[]): MessageReaction[];
export declare function patchInboxPreview(items: InboxItem[], message: Message): InboxItem[];
export declare function incrementInboxUnread(items: InboxItem[], conversationId: string): InboxItem[];
export declare function tryMergeOwnEcho(existing: Message[], incoming: Message, myContactId: string): Message[] | null;
export declare function resolveMessageFileId(msg: Message): string | null;
//# sourceMappingURL=messagingHelpers.d.ts.map