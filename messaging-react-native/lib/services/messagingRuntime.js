"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMessagingApiBaseUrl = getMessagingApiBaseUrl;
exports.getMessagingWsBaseUrl = getMessagingWsBaseUrl;
exports.getMessagingStorageApiUrl = getMessagingStorageApiUrl;
exports.resolveMessagingAccessToken = resolveMessagingAccessToken;
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
async function resolveMessagingAccessToken() {
    const cfg = (0, configure_1.getMessagingConfig)();
    if (cfg.getAccessToken) {
        return cfg.getAccessToken();
    }
    return async_storage_1.default.getItem('access_token');
}
