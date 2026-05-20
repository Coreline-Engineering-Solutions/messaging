"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MapTabBarButton = MapTabBarButton;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_native_1 = require("react-native");
const MessagingContext_1 = require("../context/MessagingContext");
/** Map (or host) tab: dismiss messenger when returning. */
function MapTabBarButton({ onNavigateToHost, ...props }) {
    const { closePanel, panelOpen } = (0, MessagingContext_1.useMessaging)();
    return ((0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: props.accessibilityRole, accessibilityState: props.accessibilityState, accessibilityLabel: props.accessibilityLabel, testID: props.testID, onPress: (e) => {
            if (panelOpen)
                closePanel();
            onNavigateToHost?.();
            props.onPress?.(e);
        }, style: props.style, children: props.children }));
}
