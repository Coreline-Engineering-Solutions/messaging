export interface AuthSession {
  session_gid: string;
  session_expires: string;
}

export interface Contact {
  contact_id: string;
  user_gid: string;
  first_name: string;
  last_name: string;
  email: string;
  company_name: string;
  profile_image_url?: string;
  phone?: string;
  is_active: boolean;
}

export interface InboxItem {
  conversation_id: string;
  name: string;
  last_message_preview: string;
  last_message_at: string;
  unread_count: number;
  is_group?: boolean;
  participant_count?: number;
}

export interface Message {
  message_id: string;
  conversation_id: string;
  sender_id: string;
  sender_name: string;
  message_type: 'TEXT' | 'IMAGE';
  content?: string;
  media_url?: string;
  created_at: string;
  is_read?: boolean;
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
