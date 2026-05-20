"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessagingTabBarButton = MessagingTabBarButton;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_native_1 = require("react-native");
const MessagingContext_1 = require("../context/MessagingContext");
const messagingStyles_1 = require("../styles/messagingStyles");
/** Messages tab: open host screen + messenger panel. */
function MessagingTabBarButton({ onNavigateToHost, ...props }) {
    const { openPanel, totalUnread } = (0, MessagingContext_1.useMessaging)();
    return ((0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: props.accessibilityRole, accessibilityState: props.accessibilityState, accessibilityLabel: props.accessibilityLabel, testID: props.testID, onPress: (e) => {
            onNavigateToHost();
            openPanel();
            props.onPress?.(e);
        }, style: props.style, children: (0, jsx_runtime_1.jsxs)(react_native_1.View, { children: [props.children, totalUnread > 0 && ((0, jsx_runtime_1.jsx)(react_native_1.View, { style: messagingStyles_1.messagingStyles.tabUnreadBadge, pointerEvents: "none", children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: messagingStyles_1.messagingStyles.tabUnreadText, children: totalUnread > 99 ? '99+' : totalUnread }) }))] }) }));
}
