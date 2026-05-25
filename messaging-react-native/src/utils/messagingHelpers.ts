import type {
  Contact,
  InboxItem,
  Message,
  MessageAttachment,
  MessageReaction,
} from '../types/messaging';
import { getContactDisplayName } from '../types/messaging';

export function isTempMessageId(id: string | undefined | null): boolean {
  return !id || String(id).startsWith('temp-');
}

/** JSON-looking attachment ids must not be sent to storage retrieve. */
export function isStructuredAttachmentId(id: string | undefined | null): boolean {
  const value = String(id ?? '').trim();
  return value.startsWith('{') || value.startsWith('[');
}

export function isHttpOrDataUrl(url: string | undefined | null): boolean {
  const v = String(url ?? '').trim();
  return v.startsWith('http://') || v.startsWith('https://') || v.startsWith('data:');
}

/** Storage file id (UUID / hex), not a fetchable http URL. */
export function looksLikeStorageFileId(value: string | undefined | null): boolean {
  const v = String(value ?? '').trim();
  if (!v || isStructuredAttachmentId(v) || isTempMessageId(v)) return false;
  if (isHttpOrDataUrl(v)) return false;
  return (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v) ||
    /^[a-f0-9-]{8,}$/i.test(v) ||
    /^\d+$/.test(v)
  );
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((x) => (typeof x === 'string' ? x : (x as { file_id?: string; id?: string })?.file_id ?? (x as { id?: string })?.id ?? ''))
      .map((x) => String(x).trim())
      .filter(Boolean);
  }
  if (typeof value === 'string' && value.trim()) {
    const trimmed = value.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed) as Record<string, unknown>;
        if (Array.isArray(parsed)) return toStringArray(parsed);
        return toStringArray(
          parsed.ids ?? parsed.file_ids ?? parsed.attachment_ids ?? parsed.attachments
        );
      } catch {
        return [];
      }
    }
    return trimmed.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

/**
 * Rebuild attachments[] and resolve media_url file ids (Angular normalizeMessageShape parity).
 */
export function normalizeMessageFromApi(raw: Record<string, unknown>): Message {
  const messageType = (raw.message_type ?? raw.messageType ?? 'TEXT') as Message['message_type'];
  const base: Message = {
    message_id: String(raw.message_id ?? raw.id ?? ''),
    conversation_id: String(raw.conversation_id ?? raw.conversationId ?? ''),
    sender_id: String(raw.sender_id ?? raw.senderId ?? ''),
    sender_name: raw.sender_name as string | undefined,
    sender_username: raw.sender_username as string | undefined,
    sender_first_name: raw.sender_first_name as string | undefined,
    sender_last_name: raw.sender_last_name as string | undefined,
    message_type: messageType,
    content: String(raw.content ?? raw.body ?? raw.text ?? ''),
    media_url: (raw.media_url ?? raw.mediaUrl ?? raw.url ?? raw.file_url) as string | undefined,
    created_at: String(raw.created_at ?? raw.createdAt ?? new Date().toISOString()),
    is_read: raw.is_read as Message['is_read'],
    reactions: raw.reactions as MessageReaction[] | undefined,
    mentions: raw.mentions as string[] | undefined,
    attachments: raw.attachments as MessageAttachment[] | undefined,
    parent_message_id: raw.parent_message_id as string | undefined,
    edited_at: raw.edited_at as string | undefined,
    is_pinned: raw.is_pinned as boolean | undefined,
  };

  const attachments: MessageAttachment[] = [];
  const seen = new Set<string>();

  const addAttachment = (a: MessageAttachment | null) => {
    if (!a?.file_id) return;
    const id = String(a.file_id).trim();
    if (!id || isTempMessageId(id) || isStructuredAttachmentId(id) || seen.has(id)) return;
    seen.add(id);
    attachments.push(a);
  };

  const normalizeOne = (a: unknown): MessageAttachment | null => {
    if (typeof a === 'string') {
      const id = a.trim();
      return id && !isTempMessageId(id) ? { file_id: id, filename: 'File' } : null;
    }
    if (!a || typeof a !== 'object') return null;
    const o = a as Record<string, unknown>;
    const fileId = String(
      o.file_id ?? o.fileId ?? o.id ?? o.attachment_id ?? o.storage_file_id ?? ''
    ).trim();
    if (!fileId || isTempMessageId(fileId)) return null;
    return {
      file_id: fileId,
      filename: String(o.filename ?? o.file_name ?? o.name ?? 'File'),
      mime_type: (o.mime_type ?? o.mimeType) as string | undefined,
    };
  };

  if (Array.isArray(raw.attachments)) {
    for (const a of raw.attachments) addAttachment(normalizeOne(a));
  }

  const mediaValue = String(base.media_url ?? '').trim();
  if (mediaValue.startsWith('{') || mediaValue.startsWith('[')) {
    try {
      const parsed = JSON.parse(mediaValue) as Record<string, unknown>;
      const rawAttachments = Array.isArray(parsed) ? parsed : parsed.attachments;
      if (Array.isArray(rawAttachments)) {
        for (const a of rawAttachments) addAttachment(normalizeOne(a));
      }
      if (!Array.isArray(parsed)) {
        const ids = toStringArray(parsed.ids ?? parsed.file_ids ?? parsed.attachment_ids);
        const names = toStringArray(parsed.filenames);
        const mimes = toStringArray(parsed.mime_types ?? parsed.mimeTypes);
        ids.forEach((id, idx) =>
          addAttachment({
            file_id: id,
            filename: names[idx] || names[0] || `Attachment ${idx + 1}`,
            mime_type: mimes[idx],
          })
        );
      }
    } catch {
      /* ignore */
    }
  }

  let attachmentIds = toStringArray(raw.attachment_ids ?? raw.attachmentIds);
  if (attachmentIds.length === 0) attachmentIds = toStringArray(raw.file_ids ?? raw.fileIds);
  for (const key of ['file_id', 'fileId', 'attachment_id', 'storage_file_id', 'blob_id'] as const) {
    const v = raw[key];
    if (v != null && v !== '') {
      const s = String(v).trim();
      if (s && !attachmentIds.includes(s)) attachmentIds.push(s);
    }
  }
  if (looksLikeStorageFileId(mediaValue) && !attachmentIds.includes(mediaValue)) {
    attachmentIds.push(mediaValue);
  }

  const contentTrim = String(base.content ?? '').trim();
  if (attachmentIds.length === 0 && looksLikeStorageFileId(contentTrim)) {
    attachmentIds.push(contentTrim);
  }
  if (
    attachmentIds.length === 0 &&
    /^\d+$/.test(contentTrim) &&
    (messageType === 'FILE' || messageType === 'IMAGE')
  ) {
    attachmentIds.push(contentTrim);
  }

  const filenames = toStringArray(raw.filenames);
  const mimeTypes = toStringArray(raw.mime_types ?? raw.mimeTypes);
  const fallbackMime = (raw.mime_type ?? raw.mimeType) as string | undefined;

  for (let idx = 0; idx < attachmentIds.length; idx++) {
    addAttachment({
      file_id: attachmentIds[idx],
      filename:
        filenames[idx] ||
        filenames[0] ||
        (messageType === 'IMAGE' ? `Image ${idx + 1}` : `Attachment ${idx + 1}`),
      mime_type: mimeTypes[idx] || fallbackMime,
    });
  }

  if (attachments.length > 0) {
    return { ...base, attachments };
  }
  return base;
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
  if (fromAttachment && looksLikeStorageFileId(fromAttachment)) {
    return fromAttachment;
  }
  const media = String(msg.media_url ?? '').trim();
  if (looksLikeStorageFileId(media)) return media;
  const content = String(msg.content ?? '').trim();
  if (looksLikeStorageFileId(content) && msg.message_type !== 'TEXT') {
    return content;
  }
  return null;
}
