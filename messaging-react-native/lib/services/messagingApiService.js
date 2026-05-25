"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveContactByEmail = resolveContactByEmail;
exports.getInbox = getInbox;
exports.getVisibleContacts = getVisibleContacts;
exports.getMessages = getMessages;
exports.sendMessage = sendMessage;
exports.getConversationParticipants = getConversationParticipants;
exports.manageGroup = manageGroup;
exports.addReaction = addReaction;
exports.deleteGroupConversation = deleteGroupConversation;
exports.removeReaction = removeReaction;
exports.sendDirectMessage = sendDirectMessage;
exports.markConversationRead = markConversationRead;
exports.createConversation = createConversation;
exports.getDirectConversation = getDirectConversation;
exports.deleteConversation = deleteConversation;
exports.clearConversation = clearConversation;
exports.getReactions = getReactions;
exports.getThreadMessages = getThreadMessages;
exports.sendThreadReply = sendThreadReply;
exports.editMessage = editMessage;
exports.deleteMessage = deleteMessage;
exports.pinMessage = pinMessage;
exports.unpinMessage = unpinMessage;
exports.searchMessages = searchMessages;
exports.updatePresence = updatePresence;
exports.getPresence = getPresence;
exports.checkContactProfile = checkContactProfile;
exports.getCompanyConnections = getCompanyConnections;
exports.sendConnectionInvite = sendConnectionInvite;
exports.respondToConnection = respondToConnection;
exports.updateNotificationSettings = updateNotificationSettings;
exports.sendMessageWithAttachments = sendMessageWithAttachments;
const axios_1 = __importDefault(require("axios"));
const messagingRuntime_1 = require("./messagingRuntime");
const messagingHttp = axios_1.default.create();
messagingHttp.interceptors.request.use(async (config) => {
    config.baseURL = (0, messagingRuntime_1.getMessagingApiBaseUrl)();
    const token = await (0, messagingRuntime_1.resolveMessagingAccessToken)();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});
const base = '/messaging';
async function resolveContactByEmail(email) {
    const { data } = await messagingHttp.get(`${base}/contacts/by-email/${encodeURIComponent(email)}`);
    if (!data?.contact_id)
        return null;
    return {
        contact_id: String(data.contact_id),
        user_gid: String(data.contact_id),
        email: data.email || email,
        username: data.username,
        company_name: 'CES',
        is_active: true,
    };
}
async function getInbox(contactId) {
    const { data } = await messagingHttp.get(`${base}/contacts/${contactId}/inbox`);
    return data ?? [];
}
async function getVisibleContacts(contactId) {
    const { data } = await messagingHttp.get(`${base}/contacts/${contactId}/visible-contacts`);
    return data ?? [];
}
async function getMessages(conversationId, contactId, beforeMessageId, limit = 50) {
    const params = {
        contact_id: contactId,
        limit: String(limit),
    };
    if (beforeMessageId)
        params.before = beforeMessageId;
    const { data } = await messagingHttp.get(`${base}/conversations/${conversationId}/messages`, {
        params,
    });
    return data ?? [];
}
async function sendMessage(conversationId, senderContactId, content, messageType = 'TEXT') {
    const { data } = await messagingHttp.post(`${base}/conversations/${conversationId}/messages`, {
        sender_id: parseInt(senderContactId, 10),
        content,
        message_type: messageType,
    });
    return data ?? {};
}
async function getConversationParticipants(conversationId) {
    const { data } = await messagingHttp.get(`${base}/conversations/${conversationId}/participants`);
    return (data ?? []).map((p) => ({
        ...p,
        contact_id: String(p.contact_id),
    }));
}
async function manageGroup(contactId, action, conversationId, groupName, participantContactIds) {
    const payload = {
        contact_id: parseInt(contactId, 10),
    };
    if (conversationId)
        payload.conversation_id = parseInt(conversationId, 10);
    if (groupName)
        payload.name = groupName;
    if (participantContactIds) {
        payload.participant_ids = participantContactIds.map((id) => parseInt(id, 10));
    }
    await messagingHttp.post(`${base}/groups`, { action, payload });
}
async function addReaction(messageId, contactId, emoji) {
    await messagingHttp.post(`${base}/messages/${messageId}/reactions`, {
        contact_id: parseInt(contactId, 10),
        emoji,
    });
}
async function deleteGroupConversation(conversationId, contactId) {
    await messagingHttp.post(`${base}/groups/${conversationId}/delete`, {
        contactId,
    });
}
async function removeReaction(messageId, contactId, emoji) {
    await messagingHttp.delete(`${base}/messages/${messageId}/reactions`, {
        data: {
            contact_id: parseInt(contactId, 10),
            emoji,
        },
    });
}
async function sendDirectMessage(senderContactId, recipientContactId, content) {
    await messagingHttp.post(`${base}/direct-messages`, {
        sender_id: parseInt(senderContactId, 10),
        recipient_id: parseInt(recipientContactId, 10),
        content,
    });
}
async function markConversationRead(conversationId, contactId) {
    await messagingHttp.post(`${base}/conversations/${conversationId}/read`, {
        contact_id: parseInt(contactId, 10),
    });
}
async function createConversation(creatorContactId, participantContactIds, name) {
    const { data } = await messagingHttp.post(`${base}/conversations`, {
        creator_id: parseInt(creatorContactId, 10),
        participants: participantContactIds.map((id) => parseInt(id, 10)),
        name: name || null,
    });
    return data;
}
async function getDirectConversation(contactA, contactB) {
    const { data } = await messagingHttp.get(`${base}/conversations/direct`, { params: { contactA, contactB } });
    return data ?? null;
}
async function deleteConversation(conversationId, contactId) {
    await messagingHttp.post(`${base}/conversations/${conversationId}/delete`, { contactId });
}
async function clearConversation(conversationId, contactId) {
    await messagingHttp.post(`${base}/conversations/${conversationId}/clear`, { contactId });
}
async function getReactions(messageId) {
    const { data } = await messagingHttp.get(`${base}/messages/${messageId}/reactions`);
    return data ?? [];
}
async function getThreadMessages(parentMessageId, contactId) {
    const { data } = await messagingHttp.get(`${base}/messages/${parentMessageId}/thread`, { params: { contact_id: contactId } });
    return data ?? [];
}
async function sendThreadReply(parentMessageId, senderContactId, content) {
    const { data } = await messagingHttp.post(`${base}/messages/${parentMessageId}/replies`, {
        sender_id: parseInt(senderContactId, 10),
        content,
    });
    return data ?? {};
}
async function editMessage(messageId, contactId, content) {
    await messagingHttp.put(`${base}/messages/${messageId}`, { contactId, content });
}
async function deleteMessage(messageId, contactId) {
    await messagingHttp.delete(`${base}/messages/${messageId}`, {
        data: { contactId },
    });
}
async function pinMessage(messageId, conversationId, contactId) {
    await messagingHttp.post(`${base}/messages/${messageId}/pin`, {
        conversationId,
        contactId,
    });
}
async function unpinMessage(messageId, contactId) {
    await messagingHttp.delete(`${base}/messages/${messageId}/pin`, {
        data: { contactId },
    });
}
async function searchMessages(contactId, query, conversationId) {
    const { data } = await messagingHttp.post(`${base}/search`, {
        contact_id: parseInt(contactId, 10),
        query,
        conversation_id: conversationId ? parseInt(conversationId, 10) : null,
    });
    return data ?? [];
}
async function updatePresence(contactId, status, customStatus) {
    await messagingHttp.put(`${base}/contacts/${contactId}/presence`, null, {
        params: { status, ...(customStatus ? { custom_status: customStatus } : {}) },
    });
}
async function getPresence(contactId) {
    const { data } = await messagingHttp.get(`${base}/contacts/${contactId}/presence`);
    return data ?? { status: 'offline' };
}
async function checkContactProfile(contactId) {
    await messagingHttp.post(`${base}/contacts/check`, {
        contact_id: parseInt(contactId, 10),
    });
}
async function getCompanyConnections(contactId) {
    const { data } = await messagingHttp.get(`${base}/contacts/${contactId}/connections`);
    return data ?? [];
}
async function sendConnectionInvite(adminContactId, targetCompany) {
    await messagingHttp.post(`${base}/connections/invites`, {
        admin_contact_id: parseInt(adminContactId, 10),
        target_company: targetCompany,
    });
}
async function respondToConnection(adminContactId, connectionId, accept) {
    await messagingHttp.post(`${base}/connections/${connectionId}/respond`, {
        admin_contact_id: parseInt(adminContactId, 10),
        accept,
    });
}
async function updateNotificationSettings(conversationId, contactId, settings) {
    await messagingHttp.put(`${base}/conversations/${conversationId}/notifications`, {
        contactId,
        ...settings,
    });
}
async function sendMessageWithAttachments(conversationId, senderContactId, content, attachmentIds, filenames, mimeTypes = []) {
    const { data } = await messagingHttp.post(`${base}/conversations/${conversationId}/messages`, {
        sender_id: parseInt(senderContactId, 10),
        content: content || '',
        attachment_ids: attachmentIds,
        filenames,
        mime_types: mimeTypes,
    });
    return data ?? {};
}
