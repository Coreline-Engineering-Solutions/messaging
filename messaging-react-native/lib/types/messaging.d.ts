export interface Contact {
    contact_id: string;
    user_gid: string;
    username?: string;
    first_name?: string;
    last_name?: string;
    email: string;
    company_name: string;
    profile_image_url?: string;
    is_active: boolean;
}
export interface InboxItem {
    conversation_id: string;
    name: string | null;
    last_message_preview: string;
    last_message_at: string;
    unread_count: number;
    is_group?: boolean;
    participant_count?: number;
    other_participant_id?: string;
    other_participant_name?: string;
    /** Set when API marks a conversation as project-scoped. */
    is_project?: boolean;
    project_gid?: string;
    project_status?: 'active' | 'pending_delete' | 'archived' | 'deleted';
    project_purge_after?: string;
    conversation_type?: string;
}
export interface MessageReaction {
    reaction_id?: string;
    message_id?: string;
    contact_id?: string;
    emoji: string;
    count?: number;
    hasReacted?: boolean;
    reactors?: string[];
}
export interface MessageAttachment {
    file_id: string;
    filename?: string;
    mime_type?: string;
}
export interface Message {
    message_id: string;
    conversation_id: string;
    sender_id: string;
    sender_name?: string;
    sender_username?: string;
    sender_first_name?: string;
    sender_last_name?: string;
    message_type: 'TEXT' | 'IMAGE' | 'FILE';
    content?: string;
    media_url?: string;
    attachments?: MessageAttachment[];
    reactions?: MessageReaction[];
    /** Local preview URI while upload in flight */
    local_image_uri?: string;
    created_at: string;
    is_read?: boolean | string;
    parent_message_id?: string;
    edited_at?: string;
    is_pinned?: boolean;
    mentions?: string[];
}
export interface ConversationParticipant {
    contact_id: string;
    email?: string;
    username?: string;
    company?: string;
    profile_image_url?: string;
}
export interface GroupEditState {
    conversationId: string;
    name: string;
}
export type InboxFilter = 'all' | 'dms' | 'groups' | 'favorites' | 'projects';
export interface WebSocketMessage {
    type: string;
    conversation_id?: string;
    data?: Message;
    message?: string;
}
export type MessagingView = 'inbox' | 'chat' | 'new-conversation' | 'group-manager' | 'message-search' | 'thread';
export interface PresenceInfo {
    status: string;
    custom_status?: string;
}
export type WsStatus = 'disconnected' | 'connecting' | 'connected' | 'authenticated';
export declare function getContactDisplayName(contact: Contact): string;
/** True when a string looks like a numeric contact id, not a display name. */
export declare function looksLikeContactId(value: string | undefined | null): boolean;
/** Prefer username for group/DM sender labels (matches Angular chat-thread). */
export declare function getMessageSenderName(msg: Message): string;
export declare function resolveMessageSenderDisplayName(msg: Message, contacts: Contact[], myContactId?: string | null): string;
/** Group inbox titles: resolve id lists to usernames when API name is contact ids. */
export declare function getInboxDisplayName(item: InboxItem, contacts: Contact[]): string;
export declare function isProjectConversation(item: InboxItem): boolean;
//# sourceMappingURL=messaging.d.ts.map