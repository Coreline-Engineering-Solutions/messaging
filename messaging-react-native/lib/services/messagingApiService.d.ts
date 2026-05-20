import type { CompanyConnection, Contact, ConversationParticipant, InboxItem, Message, PresenceInfo } from '../types/messaging';
export declare function resolveContactByEmail(email: string): Promise<Contact | null>;
export declare function getInbox(contactId: string): Promise<InboxItem[]>;
export declare function getVisibleContacts(contactId: string): Promise<Contact[]>;
export declare function getMessages(conversationId: string, contactId: string, beforeMessageId?: string, limit?: number): Promise<Message[]>;
export declare function sendMessage(conversationId: string, senderContactId: string, content: string, messageType?: 'TEXT' | 'IMAGE' | 'FILE'): Promise<{
    message_id?: string;
}>;
export declare function getConversationParticipants(conversationId: string): Promise<ConversationParticipant[]>;
export declare function manageGroup(contactId: string, action: 'create' | 'add' | 'remove' | 'rename', conversationId?: string, groupName?: string, participantContactIds?: string[]): Promise<void>;
export declare function addReaction(messageId: string, contactId: string, emoji: string): Promise<void>;
export declare function deleteGroupConversation(conversationId: string, contactId: string): Promise<void>;
export declare function removeReaction(messageId: string, contactId: string, emoji: string): Promise<void>;
export declare function sendDirectMessage(senderContactId: string, recipientContactId: string, content: string): Promise<void>;
export declare function markConversationRead(conversationId: string, contactId: string): Promise<void>;
export declare function createConversation(creatorContactId: string, participantContactIds: string[], name?: string): Promise<{
    conversation_id: string;
}>;
export declare function getDirectConversation(contactA: string, contactB: string): Promise<{
    conversation_id?: string;
} | null>;
export declare function deleteConversation(conversationId: string, contactId: string): Promise<void>;
export declare function clearConversation(conversationId: string, contactId: string): Promise<void>;
export declare function getReactions(messageId: string): Promise<unknown[]>;
export declare function getThreadMessages(parentMessageId: string, contactId: string): Promise<Message[]>;
export declare function sendThreadReply(parentMessageId: string, senderContactId: string, content: string): Promise<{
    message_id?: string;
}>;
export declare function editMessage(messageId: string, contactId: string, content: string): Promise<void>;
export declare function deleteMessage(messageId: string, contactId: string): Promise<void>;
export declare function pinMessage(messageId: string, conversationId: string, contactId: string): Promise<void>;
export declare function unpinMessage(messageId: string, contactId: string): Promise<void>;
export declare function searchMessages(contactId: string, query: string, conversationId?: string): Promise<Message[]>;
export declare function updatePresence(contactId: string, status: string, customStatus?: string): Promise<void>;
export declare function getPresence(contactId: string): Promise<PresenceInfo>;
export declare function checkContactProfile(contactId: string): Promise<void>;
export declare function getCompanyConnections(contactId: string): Promise<CompanyConnection[]>;
export declare function sendConnectionInvite(adminContactId: string, targetCompany: string): Promise<void>;
export declare function respondToConnection(adminContactId: string, connectionId: string, accept: boolean): Promise<void>;
export declare function updateNotificationSettings(conversationId: string, contactId: string, settings: Record<string, unknown>): Promise<void>;
export declare function sendMessageWithAttachments(conversationId: string, senderContactId: string, content: string, attachmentIds: string[], filenames: string[]): Promise<{
    message_id?: string;
}>;
//# sourceMappingURL=messagingApiService.d.ts.map