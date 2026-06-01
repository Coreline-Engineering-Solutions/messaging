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
  project_id?: string;
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

export type MessagingView =
  | 'inbox'
  | 'chat'
  | 'new-conversation'
  | 'group-manager'
  | 'message-search'
  | 'thread';

export interface PresenceInfo {
  status: string;
  custom_status?: string;
}

export type WsStatus = 'disconnected' | 'connecting' | 'connected' | 'authenticated';

export function getContactDisplayName(contact: Contact): string {
  if (contact.username) return contact.username;
  if (contact.first_name) {
    return contact.last_name ? `${contact.first_name} ${contact.last_name}` : contact.first_name;
  }
  return contact.email;
}

/** True when a string looks like a numeric contact id, not a display name. */
export function looksLikeContactId(value: string | undefined | null): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  return /^\d+$/.test(trimmed);
}

/** Prefer username for group/DM sender labels (matches Angular chat-thread). */
export function getMessageSenderName(msg: Message): string {
  if (msg.sender_username) return msg.sender_username;
  if (msg.sender_name && !looksLikeContactId(msg.sender_name)) return msg.sender_name;
  if (msg.sender_first_name) {
    return msg.sender_last_name
      ? `${msg.sender_first_name} ${msg.sender_last_name}`
      : msg.sender_first_name;
  }
  return 'Unknown';
}

export function resolveMessageSenderDisplayName(
  msg: Message,
  contacts: Contact[],
  myContactId?: string | null
): string {
  if (myContactId && String(msg.sender_id) === String(myContactId)) {
    return 'You';
  }

  const fromMessage = getMessageSenderName(msg);
  if (fromMessage !== 'Unknown') return fromMessage;

  const matched = contacts.find((c) => String(c.contact_id) === String(msg.sender_id));
  if (matched) return getContactDisplayName(matched);

  return 'Unknown';
}

/** Group inbox titles: resolve id lists to usernames when API name is contact ids. */
export function getInboxDisplayName(item: InboxItem, contacts: Contact[]): string {
  if (!item.is_group) {
    return item.name || item.other_participant_name || 'Direct Message';
  }

  const rawName = item.name?.trim();
  if (rawName && !looksLikeContactId(rawName) && !looksLikeContactIdList(rawName)) {
    return rawName;
  }

  if (rawName && looksLikeContactIdList(rawName)) {
    const labels = contactIdsToDisplayNames(rawName, contacts);
    if (labels.length > 0) return labels.join(', ');
  }

  return rawName || 'Group';
}

function looksLikeContactIdList(value: string): boolean {
  const parts = value.split(/[,\s]+/).filter(Boolean);
  return parts.length > 0 && parts.every((p) => looksLikeContactId(p));
}

function contactIdsToDisplayNames(value: string, contacts: Contact[]): string[] {
  const ids = value.split(/[,\s]+/).filter(Boolean);
  return ids
    .map((id) => contacts.find((c) => String(c.contact_id) === String(id)))
    .filter((c): c is Contact => !!c)
    .map((c) => getContactDisplayName(c));
}

/** Project channels from API flags or group naming patterns. */
export function isProjectConversation(item: InboxItem): boolean {
  if (item.is_project === true) return true;
  if (item.project_id) return true;
  if (item.conversation_type?.toLowerCase() === 'project') return true;

  const name = (item.name || '').trim();
  if (!name) return false;
  if (/^project[\s:#-]/i.test(name)) return true;
  return /\bproject\b/i.test(name) && !!item.is_group;
}
