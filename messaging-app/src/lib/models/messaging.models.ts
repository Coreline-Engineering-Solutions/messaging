export interface AuthSession {
  session_gid: string;
  session_expires: string;
}

export interface Contact {
  contact_id: string;
  user_gid: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  email: string;
  company_name: string;
  profile_image_url?: string;
  phone?: string;
  is_active: boolean;
}

/** Get display name: username > first_name > email */
export function getContactDisplayName(contact: Contact): string {
  if (contact.username) return contact.username;
  if (contact.first_name) {
    return contact.last_name 
      ? `${contact.first_name} ${contact.last_name}`
      : contact.first_name;
  }
  return contact.email;
}

export interface InboxItem {
  conversation_id: string;
  name: string | null;
  last_message_preview: string;
  last_message_at: string;
  unread_count: number;
  is_group?: boolean;
  has_mention?: boolean;
  participant_count?: number;
  other_participant_id?: string;
  other_participant_name?: string;
  other_participant_email?: string;
}

export interface MessageReplyPreview {
  message_id?: string;
  sender_name?: string;
  content?: string;
}

export const PLAIN_TEXT_MESSAGE_PREFIX = '[messaging:plain-text]\n';

export interface Message {
  message_id: string;
  conversation_id: string;
  sender_id: string;
  sender_name?: string;
  sender_username?: string;
  sender_first_name?: string;
  sender_last_name?: string;
  message_type: 'TEXT' | 'IMAGE' | 'FILE' | 'SYSTEM';
  content?: string;
  media_url?: string;
  created_at: string;
  is_read?: boolean | string;
  read_at?: string;
  edited_at?: string;
  is_deleted?: boolean;
  deleted_at?: string;
  read_by?: Array<string | number | { contact_id?: string | number; username?: string; name?: string; display_name?: string; email?: string }>;
  read_by_names?: string[];
  parent_message_id?: string;
  reply_to?: MessageReplyPreview;
  render_as_plain_text?: boolean;
  thread_count?: number;
  reactions?: MessageReaction[];
  mentions?: string[];
  attachments?: Attachment[];
  is_pinned?: boolean;
  pinned_at?: string;
  pinned_by?: string;
}

/** Get display name from message sender fields */
export function getMessageSenderName(msg: Message): string {
  if (msg.sender_name) return msg.sender_name;
  if (msg.sender_first_name) {
    return msg.sender_last_name
      ? `${msg.sender_first_name} ${msg.sender_last_name}`
      : msg.sender_first_name;
  }
  return msg.sender_username || 'Unknown';
}

export interface Conversation {
  conversation_id: string;
  name: string;
  is_group: boolean;
  created_at: string;
  participants?: ConversationParticipant[];
  description?: string;
  is_private?: boolean;
  created_by?: string;
  pinned_messages?: PinnedMessage[];
  notification_settings?: NotificationSettings;
}

export interface ConversationParticipant {
  contact_id: string;
  email: string;
  username: string;
  company: string;
  profile_image_url?: string;
  joined_at?: string;
}

export interface WebSocketMessage {
  type: 'new_message' | 'conversation_updated' | 'group_updated' | 'pong' | 'auth_success' | 'error';
  timestamp?: string;
  data?: any;
  message?: string;
}

export interface ChatWindow {
  conversationId: string;
  name: string;
  isGroup: boolean;
  isMinimized: boolean;
  unreadCount: number;
}

export interface Attachment {
  file_id: string;
  filename: string;
  mime_type?: string;
  size_bytes?: number;
  url?: string;
}

export interface MessageReaction {
  reaction_id?: string;
  message_id?: string;
  contact_id?: string;
  emoji: string;
  created_at?: string;
  count?: number;
  hasReacted?: boolean;
  reactors?: string[];
}

export interface PresenceStatus {
  contact_id: string;
  status: 'online' | 'offline' | 'away' | 'busy';
  last_seen?: string;
  custom_status?: string;
}

export interface TypingIndicator {
  conversation_id: string;
  contact_id: string;
  contact_name: string;
  timestamp: string;
}

export interface Thread {
  parent_message_id: string;
  reply_count: number;
  last_reply_at: string;
  participants: string[];
  is_following?: boolean;
}

export interface Mention {
  message_id: string;
  mentioned_contact_id: string;
  mention_type: 'user' | 'channel' | 'everyone';
  position: number;
}

export interface PinnedMessage {
  message_id: string;
  conversation_id: string;
  pinned_by: string;
  pinned_at: string;
}

export interface ReadReceipt {
  message_id: string;
  contact_id: string;
  read_at: string;
}

export interface NotificationSettings {
  conversation_id: string;
  is_muted: boolean;
  mute_until?: string;
  notify_on_mention: boolean;
  notify_on_all_messages: boolean;
}

export interface ChannelPermissions {
  can_post: boolean;
  can_delete_own: boolean;
  can_delete_any: boolean;
  can_pin: boolean;
  can_invite: boolean;
  can_manage_settings: boolean;
}

export interface ParticipantRole {
  contact_id: string;
  conversation_id: string;
  role: 'admin' | 'member' | 'guest';
  permissions: ChannelPermissions;
  joined_at: string;
}

export interface SearchFilter {
  query: string;
  user_id?: string;
  date_from?: string;
  date_to?: string;
  file_type?: string;
  conversation_id?: string;
}

export type SidebarSide = 'left' | 'right';

/**
 * Helper function to create a Contact object from common user data shapes.
 * Reduces boilerplate when integrating with existing auth systems.
 *
 * **`contact_id` must match your backend**  
 * Many APIs (including typical CES / FastAPI bigint routes) expect a **numeric** contact id in
 * URL paths such as `/messaging/contacts/{contact_id}/...`. Email is a common human identifier
 * but is often **wrong** for those routes. Prefer:
 * - resolving the server contact id first (e.g. `GET .../messaging/contacts/by-email?email=...` when your API provides it), then passing that id as `contact_id`, or
 * - `contactIdHint: 'id'` / `'userId'` when your auth user already carries the numeric messaging id.
 *
 * @param user - User object with email and optional fields
 * @param sessionGid - Session GUID from authentication
 * @param contactIdHint - Optional field name for `contact_id` (see `MessagingConfig.contactIdHint`)
 * @returns Contact object ready for `setSession()`
 *
 * @example
 * // Backend expects numeric id — use server lookup first, then set contact_id
 * // const numericId = await fetchByEmail(user.email);
 * // createContactFromUser({ ...user, id: numericId }, sessionGid, 'id');
 *
 * @example
 * // Using email as contact_id (only if your backend truly accepts email in paths)
 * const contact = createContactFromUser({
 *   email: 'user@example.com',
 *   firstName: 'John',
 *   lastName: 'Doe',
 *   company: 'Acme Corp'
 * }, sessionGid);
 *
 * @example
 * const contact = createContactFromUser({
 *   email: 'user@example.com',
 *   id: '12345',
 *   firstName: 'John'
 * }, sessionGid, 'id');
 *
 * messagingAuth.setSession(sessionGid, contact);
 */
export function createContactFromUser(user: {
  email: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  userId?: string;
  id?: string;
  customId?: string;
  [key: string]: any;
}, sessionGid: string, contactIdHint?: string): Contact {
  // Determine contact_id based on hint or default to email
  let contactId = user.email;
  if (contactIdHint && user[contactIdHint]) {
    contactId = String(user[contactIdHint]);
  }

  return {
    contact_id: contactId,
    user_gid: sessionGid,
    email: user.email,
    first_name: user.firstName || '',
    last_name: user.lastName || '',
    company_name: user.company || '',
    is_active: true
  };
}
