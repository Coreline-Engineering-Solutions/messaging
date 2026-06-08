"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMessagingApiBaseUrl = getMessagingApiBaseUrl;
exports.getMessagingWsBaseUrl = getMessagingWsBaseUrl;
exports.getMessagingStorageApiUrl = getMessagingStorageApiUrl;
exports.setMessagingSessionGid = setMessagingSessionGid;
exports.resolveMessagingSessionGid = resolveMessagingSessionGid;
exports.getMessagingSessionHeaders = getMessagingSessionHeaders;
const async_storage_1 = __importDefault(require("@react-native-async-storage/async-storage"));
const configure_1 = require("../configure");
function getMessagingApiBaseUrl() {
    return (0, configure_1.getMessagingConfig)().apiBaseUrl;
}
function getMessagingWsBaseUrl() {
    return (0, configure_1.getMessagingConfig)().wsBaseUrl;
}
function getMessagingStorageApiUrl() {
    const cfg = (0, configure_1.getMessagingConfig)();
    return cfg.storageApiUrl ?? cfg.apiBaseUrl;
}
let currentSessionGid = null;
function setMessagingSessionGid(sessionGid) {
    currentSessionGid = sessionGid;
}
async function resolveMessagingSessionGid() {
    if (currentSessionGid)
        return currentSessionGid;
    const cfg = (0, configure_1.getMessagingConfig)();
    if (cfg.getSessionGid) {
        return cfg.getSessionGid();
    }
    return async_storage_1.default.getItem('session_gid');
}
async function getMessagingSessionHeaders() {
    const sessionGid = await resolveMessagingSessionGid();
    return sessionGid ? { 'X-Messaging-Session': sessionGid } : {};
}
