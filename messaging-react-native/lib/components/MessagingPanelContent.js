"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessagingPanelContent = MessagingPanelContent;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_native_1 = require("react-native");
const MessagingContext_1 = require("../context/MessagingContext");
const messagingStyles_1 = require("../styles/messagingStyles");
const MessagingChatThread_1 = require("./MessagingChatThread");
const MessagingGroupManager_1 = require("./MessagingGroupManager");
const MessagingInboxList_1 = require("./MessagingInboxList");
const MessagingMessageSearch_1 = require("./MessagingMessageSearch");
const MessagingNewConversation_1 = require("./MessagingNewConversation");
const MessagingThreadViewer_1 = require("./MessagingThreadViewer");
/** Shared inbox / chat / group views for overlay panel and full-screen tab. */
function MessagingPanelContent() {
    const { activeView } = (0, MessagingContext_1.useMessaging)();
    return ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: messagingStyles_1.messagingStyles.panelBody, children: [activeView === 'inbox' && (0, jsx_runtime_1.jsx)(MessagingInboxList_1.MessagingInboxList, {}), activeView === 'chat' && (0, jsx_runtime_1.jsx)(MessagingChatThread_1.MessagingChatThread, {}), activeView === 'new-conversation' && (0, jsx_runtime_1.jsx)(MessagingNewConversation_1.MessagingNewConversation, {}), activeView === 'group-manager' && (0, jsx_runtime_1.jsx)(MessagingGroupManager_1.MessagingGroupManager, {}), activeView === 'message-search' && (0, jsx_runtime_1.jsx)(MessagingMessageSearch_1.MessagingMessageSearch, {}), activeView === 'thread' && (0, jsx_runtime_1.jsx)(MessagingThreadViewer_1.MessagingThreadViewer, {})] }));
}
