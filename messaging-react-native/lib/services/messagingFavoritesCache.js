"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadFavoriteConversationIds = loadFavoriteConversationIds;
exports.persistFavoriteConversationIds = persistFavoriteConversationIds;
const async_storage_1 = __importDefault(require("@react-native-async-storage/async-storage"));
const messagingConfig_1 = require("../constants/messagingConfig");
function storageKey(contactId) {
    return `${messagingConfig_1.MESSAGING_FAVORITES_KEY_PREFIX}${contactId}`;
}
async function loadFavoriteConversationIds(contactId) {
    try {
        const raw = await async_storage_1.default.getItem(storageKey(contactId));
        if (!raw)
            return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed))
            return [];
        return parsed.map(String);
    }
    catch {
        return [];
    }
}
async function persistFavoriteConversationIds(contactId, conversationIds) {
    try {
        await async_storage_1.default.setItem(storageKey(contactId), JSON.stringify(conversationIds));
    }
    catch {
        /* ignore */
    }
}
