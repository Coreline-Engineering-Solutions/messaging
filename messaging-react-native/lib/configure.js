"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.configureMessaging = configureMessaging;
exports.getMessagingConfig = getMessagingConfig;
exports.isMessagingConfigured = isMessagingConfigured;
let runtimeConfig = null;
function configureMessaging(config) {
    runtimeConfig = config;
}
function getMessagingConfig() {
    if (!runtimeConfig) {
        throw new Error('Messaging is not configured. Call configureMessaging({ apiBaseUrl, wsBaseUrl }) before using the library.');
    }
    return runtimeConfig;
}
function isMessagingConfigured() {
    return runtimeConfig !== null;
}
