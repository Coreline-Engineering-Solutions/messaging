"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessagingOverlay = MessagingOverlay;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_native_1 = require("react-native");
const messagingStyles_1 = require("../styles/messagingStyles");
const MessagingPanel_1 = require("./MessagingPanel");
function MessagingOverlay({ panelBottomInset }) {
    return ((0, jsx_runtime_1.jsx)(react_native_1.View, { style: messagingStyles_1.messagingStyles.overlayRoot, pointerEvents: "box-none", children: (0, jsx_runtime_1.jsx)(MessagingPanel_1.MessagingPanel, { bottomInset: panelBottomInset }) }));
}
