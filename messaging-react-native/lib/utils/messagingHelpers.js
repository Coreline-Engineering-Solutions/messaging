"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isTempMessageId = isTempMessageId;
exports.isStructuredAttachmentId = isStructuredAttachmentId;
exports.formatMessageTime = formatMessageTime;
exports.formatDateSeparatorLabel = formatDateSeparatorLabel;
exports.shouldShowDateSeparator = shouldShowDateSeparator;
exports.messageLooksLikeMedia = messageLooksLikeMedia;
exports.getMessagePreviewText = getMessagePreviewText;
exports.dedupeMessagesById = dedupeMessagesById;
exports.normalizeReactionRows = normalizeReactionRows;
exports.patchInboxPreview = patchInboxPreview;
exports.incrementInboxUnread = incrementInboxUnread;
exports.tryMergeOwnEcho = tryMergeOwnEcho;
exports.resolveMessageFileId = resolveMessageFileId;
const messaging_1 = require("../types/messaging");
function isTempMessageId(id) {
    return !id || String(id).startsWith('temp-');
}
/** JSON-looking attachment ids must not be sent to storage retrieve. */
function isStructuredAttachmentId(id) {
    const value = String(id ?? '').trim();
    return value.startsWith('{') || value.startsWith('[');
}
function formatMessageTime(iso) {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function formatDateSeparatorLabel(iso) {
    const d = new Date(iso);
    const now = new Date();
    if (d.toDateString() === now.toDateString())
        return 'Today';
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString())
        return 'Yesterday';
    return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}
function shouldShowDateSeparator(messages, index) {
    if (index === 0)
        return true;
    const prev = new Date(messages[index - 1].created_at).toDateString();
    const cur = new Date(messages[index].created_at).toDateString();
    return prev !== cur;
}
function messageLooksLikeMedia(msg) {
    return (msg.message_type === 'IMAGE' ||
        msg.message_type === 'FILE' ||
        !!msg.local_image_uri ||
        !!msg.media_url ||
        (msg.attachments?.length ?? 0) > 0 ||
        (/^[a-f0-9-]{36}$/i.test(String(msg.content ?? '').trim()) &&
            msg.message_type !== 'TEXT'));
}
function getMessagePreviewText(msg) {
    const text = String(msg.content ?? '').trim();
    if (text && !messageLooksLikeMedia(msg))
        return text;
    if (msg.message_type === 'IMAGE' || msg.local_image_uri)
        return '[Image]';
    if (msg.message_type === 'FILE')
        return '[File]';
    if (msg.attachments?.length)
        return `[${msg.attachments.length} attachment(s)]`;
    return text || '[Message]';
}
function dedupeMessagesById(messages) {
    const byId = new Map();
    for (const m of messages) {
        byId.set(m.message_id, m);
    }
    return Array.from(byId.values()).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}
function normalizeReactionRows(rows, myContactId, contacts) {
    const byEmoji = new Map();
    for (const row of rows || []) {
        const r = row;
        const emoji = String(r?.emoji ?? '').trim();
        if (!emoji)
            continue;
        const contactId = String(r?.contact_id ?? r?.contactId ?? '');
        const explicit = r?.hasReacted ?? r?.has_reacted;
        const hasReacted = explicit === true || (contactId && contactId === myContactId);
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
            let name;
            if (contactId === myContactId) {
                name = 'You';
            }
            else {
                const c = contacts.find((x) => String(x.contact_id) === contactId);
                name = c ? (0, messaging_1.getContactDisplayName)(c) : `User ${contactId}`;
            }
            if (!existing.reactors.includes(name))
                existing.reactors.push(name);
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
function patchInboxPreview(items, message) {
    const preview = getMessagePreviewText(message);
    const next = items.map((item) => item.conversation_id === message.conversation_id
        ? {
            ...item,
            last_message_preview: preview,
            last_message_at: message.created_at,
        }
        : item);
    return next.sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
}
function incrementInboxUnread(items, conversationId) {
    return items.map((item) => item.conversation_id === conversationId
        ? { ...item, unread_count: (item.unread_count || 0) + 1 }
        : item);
}
function tryMergeOwnEcho(existing, incoming, myContactId) {
    if (!myContactId || String(incoming.sender_id) !== myContactId)
        return null;
    if (isTempMessageId(incoming.message_id))
        return null;
    const convId = String(incoming.conversation_id);
    const tempIdx = existing.findIndex((m) => {
        if (!isTempMessageId(m.message_id))
            return false;
        if (String(m.conversation_id) !== convId)
            return false;
        if (String(m.sender_id) !== myContactId)
            return false;
        const dt = Math.abs(new Date(m.created_at).getTime() - new Date(incoming.created_at).getTime());
        if (dt >= 120000)
            return false;
        const a = String(m.content ?? '').trim();
        const b = String(incoming.content ?? '').trim();
        return a === b || !b;
    });
    if (tempIdx < 0)
        return null;
    const merged = {
        ...existing[tempIdx],
        ...incoming,
        message_id: incoming.message_id,
        local_image_uri: incoming.local_image_uri ?? existing[tempIdx].local_image_uri,
    };
    const next = [...existing];
    next[tempIdx] = merged;
    return dedupeMessagesById(next);
}
function resolveMessageFileId(msg) {
    const fromAttachment = msg.attachments?.[0]?.file_id;
    if (fromAttachment) {
        return isStructuredAttachmentId(fromAttachment) ? null : fromAttachment;
    }
    const content = String(msg.content ?? '').trim();
    if (content &&
        !isStructuredAttachmentId(content) &&
        /^[a-f0-9-]{8,}$/i.test(content) &&
        msg.message_type !== 'TEXT') {
        return content;
    }
    return null;
}
