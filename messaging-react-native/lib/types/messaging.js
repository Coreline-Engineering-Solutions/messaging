"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getContactDisplayName = getContactDisplayName;
exports.looksLikeContactId = looksLikeContactId;
exports.getMessageSenderName = getMessageSenderName;
exports.resolveMessageSenderDisplayName = resolveMessageSenderDisplayName;
exports.getInboxDisplayName = getInboxDisplayName;
exports.isProjectConversation = isProjectConversation;
function getContactDisplayName(contact) {
    if (contact.username)
        return contact.username;
    if (contact.first_name) {
        return contact.last_name ? `${contact.first_name} ${contact.last_name}` : contact.first_name;
    }
    return contact.email;
}
/** True when a string looks like a numeric contact id, not a display name. */
function looksLikeContactId(value) {
    if (!value)
        return false;
    const trimmed = value.trim();
    return /^\d+$/.test(trimmed);
}
/** Prefer username for group/DM sender labels (matches Angular chat-thread). */
function getMessageSenderName(msg) {
    if (msg.sender_username)
        return msg.sender_username;
    if (msg.sender_name && !looksLikeContactId(msg.sender_name))
        return msg.sender_name;
    if (msg.sender_first_name) {
        return msg.sender_last_name
            ? `${msg.sender_first_name} ${msg.sender_last_name}`
            : msg.sender_first_name;
    }
    return 'Unknown';
}
function resolveMessageSenderDisplayName(msg, contacts, myContactId) {
    if (myContactId && String(msg.sender_id) === String(myContactId)) {
        return 'You';
    }
    const fromMessage = getMessageSenderName(msg);
    if (fromMessage !== 'Unknown')
        return fromMessage;
    const matched = contacts.find((c) => String(c.contact_id) === String(msg.sender_id));
    if (matched)
        return getContactDisplayName(matched);
    return 'Unknown';
}
/** Group inbox titles: resolve id lists to usernames when API name is contact ids. */
function getInboxDisplayName(item, contacts) {
    if (!item.is_group) {
        return item.name || item.other_participant_name || 'Direct Message';
    }
    const rawName = item.name?.trim();
    if (rawName && !looksLikeContactId(rawName) && !looksLikeContactIdList(rawName)) {
        return rawName;
    }
    if (rawName && looksLikeContactIdList(rawName)) {
        const labels = contactIdsToDisplayNames(rawName, contacts);
        if (labels.length > 0)
            return labels.join(', ');
    }
    return rawName || 'Group';
}
function looksLikeContactIdList(value) {
    const parts = value.split(/[,\s]+/).filter(Boolean);
    return parts.length > 0 && parts.every((p) => looksLikeContactId(p));
}
function contactIdsToDisplayNames(value, contacts) {
    const ids = value.split(/[,\s]+/).filter(Boolean);
    return ids
        .map((id) => contacts.find((c) => String(c.contact_id) === String(id)))
        .filter((c) => !!c)
        .map((c) => getContactDisplayName(c));
}
function isProjectConversation(item) {
    return (item.is_project === true ||
        !!item.project_gid ||
        item.conversation_type?.toLowerCase() === 'project');
}
