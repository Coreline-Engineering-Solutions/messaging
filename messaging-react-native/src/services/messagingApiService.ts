import axios, { AxiosHeaders } from 'axios';
import { formatMessagingHttpError } from '../utils/messagingHttpError';
import { getMessagingApiBaseUrl, resolveMessagingSessionGid } from './messagingRuntime';
import type {
  Contact,
  ConversationParticipant,
  InboxItem,
  Message,
  PresenceInfo,
} from '../types/messaging';

const messagingHttp = axios.create();
messagingHttp.interceptors.request.use(async (config) => {
  config.baseURL = getMessagingApiBaseUrl();
  const sessionGid = await resolveMessagingSessionGid();
  if (sessionGid) {
    const headers = AxiosHeaders.from(config.headers);
    headers.set('X-Messaging-Session', sessionGid);
    config.headers = headers;
  }
  return config;
});

const base = '/messaging';

export async function resolveContactByEmail(email: string): Promise<Contact | null> {
  const { data } = await messagingHttp.get<{
    contact_id: number | string;
    user_gid?: string;
    email?: string;
    username?: string;
    company?: string;
  }>(
    `${base}/auth/me`
  );
  if (!data?.contact_id) return null;
  return {
    contact_id: String(data.contact_id),
    user_gid: data.user_gid || String(data.contact_id),
    email: data.email || email,
    username: data.username,
    company_name: data.company || 'CES',
    is_active: true,
  };
}

export async function getInbox(contactId: string): Promise<InboxItem[]> {
  void contactId;
  const { data } = await messagingHttp.get<InboxItem[]>(`${base}/my-inbox`);
  return data ?? [];
}

export async function getVisibleContacts(contactId: string): Promise<Contact[]> {
  void contactId;
  const { data } = await messagingHttp.get<Contact[]>(`${base}/my-visible-contacts`);
  return data ?? [];
}

export async function getMessages(
  conversationId: string,
  contactId: string,
  beforeMessageId?: string,
  limit = 50
): Promise<Message[]> {
  const params: Record<string, string> = {
    limit: String(limit),
  };
  void contactId;
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
  void senderContactId;
  const { data } = await messagingHttp.post<{ message_id?: string; id?: string }>(
    `${base}/conversations/${conversationId}/messages`,
    {
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
  void contactId;
  const payload: Record<string, unknown> = {};
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
  void contactId;
  await messagingHttp.post(`${base}/messages/${messageId}/reactions`, {
    emoji,
  });
}

export async function deleteGroupConversation(
  conversationId: string,
  contactId: string
): Promise<void> {
  void contactId;
  await messagingHttp.post(`${base}/groups`, {
    action: 'remove',
    payload: {
      conversation_id: parseInt(conversationId, 10),
    },
  });
}

export async function removeReaction(
  messageId: string,
  contactId: string,
  emoji: string
): Promise<void> {
  void contactId;
  await messagingHttp.delete(`${base}/messages/${messageId}/reactions`, {
    data: {
      emoji,
    },
  });
}

export async function sendDirectMessage(
  senderContactId: string,
  recipientContactId: string,
  content: string
): Promise<void> {
  void senderContactId;
  await messagingHttp.post(`${base}/direct-messages`, {
    recipient_id: parseInt(recipientContactId, 10),
    content,
  });
}

export async function markConversationRead(conversationId: string, contactId: string): Promise<void> {
  void contactId;
  await messagingHttp.post(`${base}/conversations/${conversationId}/read`, {});
}

export async function createConversation(
  creatorContactId: string,
  participantContactIds: string[],
  name?: string
): Promise<{ conversation_id: string }> {
  void creatorContactId;
  const { data } = await messagingHttp.post<{ conversation_id: string }>(`${base}/conversations`, {
    participants: participantContactIds.map((id) => parseInt(id, 10)),
    name: name || null,
  });
  return data;
}

export async function getDirectConversation(
  contactA: string,
  contactB: string
): Promise<{ conversation_id?: string } | null> {
  void contactA;
  const { data } = await messagingHttp.get<{ conversation_id?: string }>(
    `${base}/conversations/direct`,
    { params: { contactB } }
  );
  return data ?? null;
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
  void contactId;
  const { data } = await messagingHttp.get<Message[]>(
    `${base}/messages/${parentMessageId}/thread`,
    { params: {} }
  );
  return data ?? [];
}

export async function sendThreadReply(
  parentMessageId: string,
  senderContactId: string,
  content: string
): Promise<{ message_id?: string }> {
  void senderContactId;
  const { data } = await messagingHttp.post<{ message_id?: string }>(
    `${base}/messages/${parentMessageId}/replies`,
    {
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
  void contactId;
  await messagingHttp.put(`${base}/messages/${messageId}`, { content });
}

export async function deleteMessage(messageId: string, contactId: string): Promise<void> {
  void contactId;
  await messagingHttp.delete(`${base}/messages/${messageId}`, {
    data: {},
  });
}

export async function searchMessages(
  contactId: string,
  query: string,
  conversationId?: string
): Promise<Message[]> {
  void contactId;
  const { data } = await messagingHttp.post<Message[]>(`${base}/search`, {
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
  await messagingHttp.put(`${base}/contacts/${contactId}/presence`, {
    status,
    ...(customStatus ? { custom_status: customStatus } : {}),
  });
}

export async function getPresence(contactId: string): Promise<PresenceInfo> {
  const { data } = await messagingHttp.get<PresenceInfo>(
    `${base}/contacts/${contactId}/presence`
  );
  return data ?? { status: 'offline' };
}

export async function checkContactProfile(contactId: string): Promise<void> {
  void contactId;
  await messagingHttp.post(`${base}/contacts/check`, {});
}

export async function sendMessageWithAttachments(
  conversationId: string,
  senderContactId: string,
  content: string,
  attachmentIds: string[],
  filenames: string[],
  mimeTypes: string[] = []
): Promise<{ message_id?: string }> {
  const messageContent =
    (content || '').trim() || filenames.filter(Boolean).join(', ') || 'Attachment';
  void senderContactId;
  const body: Record<string, unknown> = {
    content: messageContent,
    attachment_ids: attachmentIds,
    attachmentIds: attachmentIds,
    filenames,
  };
  const mimes = mimeTypes.filter((m) => !!m && m.trim());
  if (mimes.length > 0) {
    body.mime_types = mimes;
    body.mimeTypes = mimes;
  }
  try {
    const { data } = await messagingHttp.post<{ message_id?: string }>(
      `${base}/conversations/${conversationId}/messages`,
      body
    );
    return data ?? {};
  } catch (error) {
    throw new Error(formatMessagingHttpError(error, 'Send attachment message failed'));
  }
}
