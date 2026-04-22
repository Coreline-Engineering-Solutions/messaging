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
  participant_count?: number;
  other_participant_id?: string;
  other_participant_name?: string;
  other_participant_email?: string;
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
  created_at: string;
  is_read?: boolean | string;
  read_at?: string;
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
}

export interface ConversationParticipant {
  contact_id: string;
  first_name: string;
  last_name: string;
  profile_image_url?: string;
  joined_at: string;
}

export interface CompanyConnection {
  connection_id: string;
  requester_company: string;
  responder_company: string;
  status: 'PENDING' | 'ACTIVE' | 'REJECTED' | 'REVOKED';
  created_at: string;
}

export interface WebSocketMessage {
  type: 'new_message' | 'conversation_updated' | 'connection_invite_received' | 'pong' | 'auth_success' | 'error';
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

export type SidebarSide = 'left' | 'right';

/**
 * Helper function to create a Contact object from common user data shapes.
 * Reduces boilerplate when integrating with existing auth systems.
 * 
 * @param user - User object with email and optional fields
 * @param sessionGid - Session GUID from authentication
 * @param contactIdHint - Optional field name to use for contact_id (e.g., 'email', 'id', 'userId')
 * @returns Contact object ready for setSession()
 * 
 * @example
 * // Using email as contact_id (default)
 * const contact = createContactFromUser({
 *   email: 'user@example.com',
 *   firstName: 'John',
 *   lastName: 'Doe',
 *   company: 'Acme Corp'
 * }, sessionGid);
 * 
 * // Using custom field as contact_id
 * const contact = createContactFromUser({
 *   email: 'user@example.com',
 *   id: 'uuid-123',
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
