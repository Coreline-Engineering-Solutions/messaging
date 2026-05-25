import axios from 'axios';
import { getMessagingApiBaseUrl, resolveMessagingAccessToken } from './messagingRuntime';
import type {
  CompanyConnection,
  Contact,
  ConversationParticipant,
  InboxItem,
  Message,
  PresenceInfo,
} from '../types/messaging';

const messagingHttp = axios.create();
messagingHttp.interceptors.request.use(async (config) => {
  config.baseURL = getMessagingApiBaseUrl();
  const token = await resolveMessagingAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const base = '/messaging';

export async function resolveContactByEmail(email: string): Promise<Contact | null> {
  const { data } = await messagingHttp.get<{ contact_id: number | string; email?: string; username?: string }>(
    `${base}/contacts/by-email/${encodeURIComponent(email)}`
  );
  if (!data?.contact_id) return null;
  return {
    contact_id: String(data.contact_id),
    user_gid: String(data.contact_id),
    email: data.email || email,
    username: data.username,
    company_name: 'CES',
    is_active: true,
  };
}

export async function getInbox(contactId: string): Promise<InboxItem[]> {
  const { data } = await messagingHttp.get<InboxItem[]>(`${base}/contacts/${contactId}/inbox`);
  return data ?? [];
}

export async function getVisibleContacts(contactId: string): Promise<Contact[]> {
  const { data } = await messagingHttp.get<Contact[]>(`${base}/contacts/${contactId}/visible-contacts`);
  return data ?? [];
}

export async function getMessages(
  conversationId: string,
  contactId: string,
  beforeMessageId?: string,
  limit = 50
): Promise<Message[]> {
  const params: Record<string, string> = {
    contact_id: contactId,
    limit: String(limit),
  };
  if (beforeMessageId) params.before = beforeMessageId;
  const { data } = await messagingHttp.get<Message[]>(`${base}/conversations/${conversationId}/messages`, {
    params,
  });
  return data ?? [];
}

export async function sendMessage(
  conversationId: string,
  senderContactId: string,
  content: string,
  messageType: 'TEXT' | 'IMAGE' | 'FILE' = 'TEXT'
): Promise<{ message_id?: string }> {
  const { data } = await messagingHttp.post<{ message_id?: string; id?: string }>(
    `${base}/conversations/${conversationId}/messages`,
    {
      sender_id: parseInt(senderContactId, 10),
      content,
      message_type: messageType,
    }
  );
  return data ?? {};
}

export async function getConversationParticipants(
  conversationId: string
): Promise<ConversationParticipant[]> {
  const { data } = await messagingHttp.get<ConversationParticipant[]>(
    `${base}/conversations/${conversationId}/participants`
  );
  return (data ?? []).map((p) => ({
    ...p,
    contact_id: String(p.contact_id),
  }));
}

export async function manageGroup(
  contactId: string,
  action: 'create' | 'add' | 'remove' | 'rename',
  conversationId?: string,
  groupName?: string,
  participantContactIds?: string[]
): Promise<void> {
  const payload: Record<string, unknown> = {
    contact_id: parseInt(contactId, 10),
  };
  if (conversationId) payload.conversation_id = parseInt(conversationId, 10);
  if (groupName) payload.name = groupName;
  if (participantContactIds) {
    payload.participant_ids = participantContactIds.map((id) => parseInt(id, 10));
  }
  await messagingHttp.post(`${base}/groups`, { action, payload });
}

export async function addReaction(
  messageId: string,
  contactId: string,
  emoji: string
): Promise<void> {
  await messagingHttp.post(`${base}/messages/${messageId}/reactions`, {
    contact_id: parseInt(contactId, 10),
    emoji,
  });
}

export async function deleteGroupConversation(
  conversationId: string,
  contactId: string
): Promise<void> {
  await messagingHttp.post(`${base}/groups/${conversationId}/delete`, {
    contactId,
  });
}

export async function removeReaction(
  messageId: string,
  contactId: string,
  emoji: string
): Promise<void> {
  await messagingHttp.delete(`${base}/messages/${messageId}/reactions`, {
    data: {
      contact_id: parseInt(contactId, 10),
      emoji,
    },
  });
}

export async function sendDirectMessage(
  senderContactId: string,
  recipientContactId: string,
  content: string
): Promise<void> {
  await messagingHttp.post(`${base}/direct-messages`, {
    sender_id: parseInt(senderContactId, 10),
    recipient_id: parseInt(recipientContactId, 10),
    content,
  });
}

export async function markConversationRead(conversationId: string, contactId: string): Promise<void> {
  await messagingHttp.post(`${base}/conversations/${conversationId}/read`, {
    contact_id: parseInt(contactId, 10),
  });
}

export async function createConversation(
  creatorContactId: string,
  participantContactIds: string[],
  name?: string
): Promise<{ conversation_id: string }> {
  const { data } = await messagingHttp.post<{ conversation_id: string }>(`${base}/conversations`, {
    creator_id: parseInt(creatorContactId, 10),
    participants: participantContactIds.map((id) => parseInt(id, 10)),
    name: name || null,
  });
  return data;
}

export async function getDirectConversation(
  contactA: string,
  contactB: string
): Promise<{ conversation_id?: string } | null> {
  const { data } = await messagingHttp.get<{ conversation_id?: string }>(
    `${base}/conversations/direct`,
    { params: { contactA, contactB } }
  );
  return data ?? null;
}

export async function deleteConversation(
  conversationId: string,
  contactId: string
): Promise<void> {
  await messagingHttp.post(`${base}/conversations/${conversationId}/delete`, { contactId });
}

export async function clearConversation(
  conversationId: string,
  contactId: string
): Promise<void> {
  await messagingHttp.post(`${base}/conversations/${conversationId}/clear`, { contactId });
}

export async function getReactions(messageId: string): Promise<unknown[]> {
  const { data } = await messagingHttp.get<unknown[]>(
    `${base}/messages/${messageId}/reactions`
  );
  return data ?? [];
}

export async function getThreadMessages(
  parentMessageId: string,
  contactId: string
): Promise<Message[]> {
  const { data } = await messagingHttp.get<Message[]>(
    `${base}/messages/${parentMessageId}/thread`,
    { params: { contact_id: contactId } }
  );
  return data ?? [];
}

export async function sendThreadReply(
  parentMessageId: string,
  senderContactId: string,
  content: string
): Promise<{ message_id?: string }> {
  const { data } = await messagingHttp.post<{ message_id?: string }>(
    `${base}/messages/${parentMessageId}/replies`,
    {
      sender_id: parseInt(senderContactId, 10),
      content,
    }
  );
  return data ?? {};
}

export async function editMessage(
  messageId: string,
  contactId: string,
  content: string
): Promise<void> {
  await messagingHttp.put(`${base}/messages/${messageId}`, { contactId, content });
}

export async function deleteMessage(messageId: string, contactId: string): Promise<void> {
  await messagingHttp.delete(`${base}/messages/${messageId}`, {
    data: { contactId },
  });
}

export async function pinMessage(
  messageId: string,
  conversationId: string,
  contactId: string
): Promise<void> {
  await messagingHttp.post(`${base}/messages/${messageId}/pin`, {
    conversationId,
    contactId,
  });
}

export async function unpinMessage(messageId: string, contactId: string): Promise<void> {
  await messagingHttp.delete(`${base}/messages/${messageId}/pin`, {
    data: { contactId },
  });
}

export async function searchMessages(
  contactId: string,
  query: string,
  conversationId?: string
): Promise<Message[]> {
  const { data } = await messagingHttp.post<Message[]>(`${base}/search`, {
    contact_id: parseInt(contactId, 10),
    query,
    conversation_id: conversationId ? parseInt(conversationId, 10) : null,
  });
  return data ?? [];
}

export async function updatePresence(
  contactId: string,
  status: string,
  customStatus?: string
): Promise<void> {
  await messagingHttp.put(`${base}/contacts/${contactId}/presence`, null, {
    params: { status, ...(customStatus ? { custom_status: customStatus } : {}) },
  });
}

export async function getPresence(contactId: string): Promise<PresenceInfo> {
  const { data } = await messagingHttp.get<PresenceInfo>(
    `${base}/contacts/${contactId}/presence`
  );
  return data ?? { status: 'offline' };
}

export async function checkContactProfile(contactId: string): Promise<void> {
  await messagingHttp.post(`${base}/contacts/check`, {
    contact_id: parseInt(contactId, 10),
  });
}

export async function getCompanyConnections(contactId: string): Promise<CompanyConnection[]> {
  const { data } = await messagingHttp.get<CompanyConnection[]>(
    `${base}/contacts/${contactId}/connections`
  );
  return data ?? [];
}

export async function sendConnectionInvite(
  adminContactId: string,
  targetCompany: string
): Promise<void> {
  await messagingHttp.post(`${base}/connections/invites`, {
    admin_contact_id: parseInt(adminContactId, 10),
    target_company: targetCompany,
  });
}

export async function respondToConnection(
  adminContactId: string,
  connectionId: string,
  accept: boolean
): Promise<void> {
  await messagingHttp.post(`${base}/connections/${connectionId}/respond`, {
    admin_contact_id: parseInt(adminContactId, 10),
    accept,
  });
}

export async function updateNotificationSettings(
  conversationId: string,
  contactId: string,
  settings: Record<string, unknown>
): Promise<void> {
  await messagingHttp.put(`${base}/conversations/${conversationId}/notifications`, {
    contactId,
    ...settings,
  });
}

export async function sendMessageWithAttachments(
  conversationId: string,
  senderContactId: string,
  content: string,
  attachmentIds: string[],
  filenames: string[],
  mimeTypes: string[] = []
): Promise<{ message_id?: string }> {
  const { data } = await messagingHttp.post<{ message_id?: string }>(
    `${base}/conversations/${conversationId}/messages`,
    {
      sender_id: parseInt(senderContactId, 10),
      content: content || '',
      attachment_ids: attachmentIds,
      filenames,
      mime_types: mimeTypes,
    }
  );
  return data ?? {};
}
