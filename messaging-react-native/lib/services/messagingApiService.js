"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.getReactions = getReactions;
exports.getThreadMessages = getThreadMessages;
exports.sendThreadReply = sendThreadReply;
exports.editMessage = editMessage;
exports.deleteMessage = deleteMessage;
exports.searchMessages = searchMessages;
exports.updatePresence = updatePresence;
exports.getPresence = getPresence;
exports.checkContactProfile = checkContactProfile;
exports.sendMessageWithAttachments = sendMessageWithAttachments;
const axios_1 = __importStar(require("axios"));
const messagingHttpError_1 = require("../utils/messagingHttpError");
const messagingRuntime_1 = require("./messagingRuntime");
const messagingHttp = axios_1.default.create();
messagingHttp.interceptors.request.use(async (config) => {
    config.baseURL = (0, messagingRuntime_1.getMessagingApiBaseUrl)();
    const sessionGid = await (0, messagingRuntime_1.resolveMessagingSessionGid)();
    if (sessionGid) {
        const headers = axios_1.AxiosHeaders.from(config.headers);
        headers.set('X-Messaging-Session', sessionGid);
        config.headers = headers;
    }
    return config;
});
const base = '/messaging';
async function resolveContactByEmail(email) {
    const { data } = await messagingHttp.get(`${base}/auth/me`);
    if (!data?.contact_id)
        return null;
    return {
        contact_id: String(data.contact_id),
        user_gid: data.user_gid || String(data.contact_id),
        email: data.email || email,
        username: data.username,
        company_name: data.company || 'CES',
        is_active: true,
    };
}
async function getInbox(contactId) {
    void contactId;
    const { data } = await messagingHttp.get(`${base}/my-inbox`);
    return data ?? [];
}
async function getVisibleContacts(contactId) {
    void contactId;
    const { data } = await messagingHttp.get(`${base}/my-visible-contacts`);
    return data ?? [];
}
async function getMessages(conversationId, contactId, beforeMessageId, limit = 50) {
    const params = {
        limit: String(limit),
    };
    void contactId;
    if (beforeMessageId)
        params.before = beforeMessageId;
    const { data } = await messagingHttp.get(`${base}/conversations/${conversationId}/messages`, {
        params,
    });
    return data ?? [];
}
async function sendMessage(conversationId, senderContactId, content, messageType = 'TEXT') {
    void senderContactId;
    const { data } = await messagingHttp.post(`${base}/conversations/${conversationId}/messages`, {
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
    void contactId;
    const payload = {};
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
    void contactId;
    await messagingHttp.post(`${base}/messages/${messageId}/reactions`, {
        emoji,
    });
}
async function deleteGroupConversation(conversationId, contactId) {
    void contactId;
    await messagingHttp.post(`${base}/groups`, {
        action: 'remove',
        payload: {
            conversation_id: parseInt(conversationId, 10),
        },
    });
}
async function removeReaction(messageId, contactId, emoji) {
    void contactId;
    await messagingHttp.delete(`${base}/messages/${messageId}/reactions`, {
        data: {
            emoji,
        },
    });
}
async function sendDirectMessage(senderContactId, recipientContactId, content) {
    void senderContactId;
    await messagingHttp.post(`${base}/direct-messages`, {
        recipient_id: parseInt(recipientContactId, 10),
        content,
    });
}
async function markConversationRead(conversationId, contactId) {
    void contactId;
    await messagingHttp.post(`${base}/conversations/${conversationId}/read`, {});
}
async function createConversation(creatorContactId, participantContactIds, name) {
    void creatorContactId;
    const { data } = await messagingHttp.post(`${base}/conversations`, {
        participants: participantContactIds.map((id) => parseInt(id, 10)),
        name: name || null,
    });
    return data;
}
async function getDirectConversation(contactA, contactB) {
    void contactA;
    const { data } = await messagingHttp.get(`${base}/conversations/direct`, { params: { contactB } });
    return data ?? null;
}
async function getReactions(messageId) {
    const { data } = await messagingHttp.get(`${base}/messages/${messageId}/reactions`);
    return data ?? [];
}
async function getThreadMessages(parentMessageId, contactId) {
    void contactId;
    const { data } = await messagingHttp.get(`${base}/messages/${parentMessageId}/thread`, { params: {} });
    return data ?? [];
}
async function sendThreadReply(parentMessageId, senderContactId, content) {
    void senderContactId;
    const { data } = await messagingHttp.post(`${base}/messages/${parentMessageId}/replies`, {
        content,
    });
    return data ?? {};
}
async function editMessage(messageId, contactId, content) {
    void contactId;
    await messagingHttp.put(`${base}/messages/${messageId}`, { content });
}
async function deleteMessage(messageId, contactId) {
    void contactId;
    await messagingHttp.delete(`${base}/messages/${messageId}`, {
        data: {},
    });
}
async function searchMessages(contactId, query, conversationId) {
    void contactId;
    const { data } = await messagingHttp.post(`${base}/search`, {
        query,
        conversation_id: conversationId ? parseInt(conversationId, 10) : null,
    });
    return data ?? [];
}
async function updatePresence(contactId, status, customStatus) {
    await messagingHttp.put(`${base}/contacts/${contactId}/presence`, {
        status,
        ...(customStatus ? { custom_status: customStatus } : {}),
    });
}
async function getPresence(contactId) {
    const { data } = await messagingHttp.get(`${base}/contacts/${contactId}/presence`);
    return data ?? { status: 'offline' };
}
async function checkContactProfile(contactId) {
    void contactId;
    await messagingHttp.post(`${base}/contacts/check`, {});
}
async function sendMessageWithAttachments(conversationId, senderContactId, content, attachmentIds, filenames, mimeTypes = []) {
    const messageContent = (content || '').trim() || filenames.filter(Boolean).join(', ') || 'Attachment';
    void senderContactId;
    const body = {
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
        const { data } = await messagingHttp.post(`${base}/conversations/${conversationId}/messages`, body);
        return data ?? {};
    }
    catch (error) {
        throw new Error((0, messagingHttpError_1.formatMessagingHttpError)(error, 'Send attachment message failed'));
    }
}
