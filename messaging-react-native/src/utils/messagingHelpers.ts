import type { Contact, InboxItem, Message, MessageReaction } from '../types/messaging';
import { getContactDisplayName } from '../types/messaging';

export function isTempMessageId(id: string | undefined | null): boolean {
  return !id || String(id).startsWith('temp-');
}

/** JSON-looking attachment ids must not be sent to storage retrieve. */
export function isStructuredAttachmentId(id: string | undefined | null): boolean {
  const value = String(id ?? '').trim();
  return value.startsWith('{') || value.startsWith('[');
}

export function formatMessageTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatDateSeparatorLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}

export function shouldShowDateSeparator(messages: Message[], index: number): boolean {
  if (index === 0) return true;
  const prev = new Date(messages[index - 1].created_at).toDateString();
  const cur = new Date(messages[index].created_at).toDateString();
  return prev !== cur;
}

export function messageLooksLikeMedia(msg: Message): boolean {
  return (
    msg.message_type === 'IMAGE' ||
    msg.message_type === 'FILE' ||
    !!msg.local_image_uri ||
    !!msg.media_url ||
    (msg.attachments?.length ?? 0) > 0 ||
    (/^[a-f0-9-]{36}$/i.test(String(msg.content ?? '').trim()) &&
      msg.message_type !== 'TEXT')
  );
}

export function getMessagePreviewText(msg: Message): string {
  const text = String(msg.content ?? '').trim();
  if (text && !messageLooksLikeMedia(msg)) return text;
  if (msg.message_type === 'IMAGE' || msg.local_image_uri) return '[Image]';
  if (msg.message_type === 'FILE') return '[File]';
  if (msg.attachments?.length) return `[${msg.attachments.length} attachment(s)]`;
  return text || '[Message]';
}

export function dedupeMessagesById(messages: Message[]): Message[] {
  const byId = new Map<string, Message>();
  for (const m of messages) {
    byId.set(m.message_id, m);
  }
  return Array.from(byId.values()).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

export function normalizeReactionRows(
  rows: unknown[],
  myContactId: string,
  contacts: Contact[]
): MessageReaction[] {
  const byEmoji = new Map<
    string,
    { emoji: string; count: number; hasReacted: boolean; reactors: string[] }
  >();

  for (const row of rows || []) {
    const r = row as Record<string, unknown>;
    const emoji = String(r?.emoji ?? '').trim();
    if (!emoji) continue;

    const contactId = String(r?.contact_id ?? r?.contactId ?? '');
    const explicit = r?.hasReacted ?? r?.has_reacted;
    const hasReacted =
      explicit === true || (contactId && contactId === myContactId);

    const countFromRow = Number(r?.count ?? r?.reaction_count ?? 0);
    const existing = byEmoji.get(emoji) || {
      emoji,
      count: 0,
      hasReacted: false,
      reactors: [],
    };

    existing.count += countFromRow > 0 ? countFromRow : 1;
    existing.hasReacted = existing.hasReacted || !!hasReacted;

    if (contactId && countFromRow <= 1) {
      let name: string;
      if (contactId === myContactId) {
        name = 'You';
      } else {
        const c = contacts.find((x) => String(x.contact_id) === contactId);
        name = c ? getContactDisplayName(c) : `User ${contactId}`;
      }
      if (!existing.reactors.includes(name)) existing.reactors.push(name);
    }

    byEmoji.set(emoji, existing);
  }

  return Array.from(byEmoji.values())
    .filter((r) => r.count > 0)
    .map((r) => ({
      emoji: r.emoji,
      count: r.count,
      hasReacted: r.hasReacted,
      reactors: r.reactors,
    }));
}

export function patchInboxPreview(
  items: InboxItem[],
  message: Message
): InboxItem[] {
  const preview = getMessagePreviewText(message);
  const next = items.map((item) =>
    item.conversation_id === message.conversation_id
      ? {
          ...item,
          last_message_preview: preview,
          last_message_at: message.created_at,
        }
      : item
  );
  return next.sort(
    (a, b) =>
      new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
  );
}

export function incrementInboxUnread(
  items: InboxItem[],
  conversationId: string
): InboxItem[] {
  return items.map((item) =>
    item.conversation_id === conversationId
      ? { ...item, unread_count: (item.unread_count || 0) + 1 }
      : item
  );
}

export function tryMergeOwnEcho(
  existing: Message[],
  incoming: Message,
  myContactId: string
): Message[] | null {
  if (!myContactId || String(incoming.sender_id) !== myContactId) return null;
  if (isTempMessageId(incoming.message_id)) return null;

  const convId = String(incoming.conversation_id);
  const tempIdx = existing.findIndex((m) => {
    if (!isTempMessageId(m.message_id)) return false;
    if (String(m.conversation_id) !== convId) return false;
    if (String(m.sender_id) !== myContactId) return false;
    const dt = Math.abs(
      new Date(m.created_at).getTime() - new Date(incoming.created_at).getTime()
    );
    if (dt >= 120_000) return false;
    const a = String(m.content ?? '').trim();
    const b = String(incoming.content ?? '').trim();
    return a === b || !b;
  });

  if (tempIdx < 0) return null;
  const merged: Message = {
    ...existing[tempIdx],
    ...incoming,
    message_id: incoming.message_id,
    local_image_uri: incoming.local_image_uri ?? existing[tempIdx].local_image_uri,
  };
  const next = [...existing];
  next[tempIdx] = merged;
  return dedupeMessagesById(next);
}

export function resolveMessageFileId(msg: Message): string | null {
  const fromAttachment = msg.attachments?.[0]?.file_id;
  if (fromAttachment) {
    return isStructuredAttachmentId(fromAttachment) ? null : fromAttachment;
  }
  const content = String(msg.content ?? '').trim();
  if (
    content &&
    !isStructuredAttachmentId(content) &&
    /^[a-f0-9-]{8,}$/i.test(content) &&
    msg.message_type !== 'TEXT'
  ) {
    return content;
  }
  return null;
}
