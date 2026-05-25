"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessagingPanel = MessagingPanel;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const react_native_1 = require("react-native");
const MessagingContext_1 = require("../context/MessagingContext");
const messagingConfig_1 = require("../constants/messagingConfig");
const messagingStyles_1 = require("../styles/messagingStyles");
const MessagingPanelContent_1 = require("./MessagingPanelContent");
function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
function MessagingPanel({ bottomInset }) {
    const { height: screenH } = (0, react_native_1.useWindowDimensions)();
    const { panelOpen, panelHeightRatio, setPanelHeightRatio } = (0, MessagingContext_1.useMessaging)();
    const maxH = screenH * messagingConfig_1.MESSAGING_PANEL_HEIGHT_MAX;
    const minH = screenH * messagingConfig_1.MESSAGING_PANEL_HEIGHT_MIN;
    const targetH = clamp(screenH * panelHeightRatio, minH, maxH);
    const [displayHeight, setDisplayHeight] = (0, react_1.useState)(targetH);
    const displayHeightRef = (0, react_1.useRef)(targetH);
    const startHeightRef = (0, react_1.useRef)(targetH);
    const isDraggingRef = (0, react_1.useRef)(false);
    displayHeightRef.current = displayHeight;
    (0, react_1.useEffect)(() => {
        if (!isDraggingRef.current) {
            setDisplayHeight(targetH);
            startHeightRef.current = targetH;
            displayHeightRef.current = targetH;
        }
    }, [targetH]);
    const panResponder = (0, react_1.useRef)(react_native_1.PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 2,
        onPanResponderGrant: () => {
            isDraggingRef.current = true;
            startHeightRef.current = displayHeightRef.current;
        },
        onPanResponderMove: (_, g) => {
            const next = clamp(startHeightRef.current - g.dy, minH, maxH);
            setDisplayHeight(next);
        },
        onPanResponderRelease: (_, g) => {
            const next = clamp(startHeightRef.current - g.dy, minH, maxH);
            isDraggingRef.current = false;
            setDisplayHeight(next);
            startHeightRef.current = next;
            void setPanelHeightRatio(next / screenH);
        },
        onPanResponderTerminate: () => {
            isDraggingRef.current = false;
        },
    })).current;
    if (!panelOpen)
        return null;
    return ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [
            messagingStyles_1.messagingStyles.panelOuter,
            { height: displayHeight, bottom: bottomInset },
        ], children: [(0, jsx_runtime_1.jsx)(react_native_1.View, { ...panResponder.panHandlers, style: messagingStyles_1.messagingStyles.resizeHandle, children: (0, jsx_runtime_1.jsx)(react_native_1.View, { style: messagingStyles_1.messagingStyles.resizeGrab }) }), (0, jsx_runtime_1.jsx)(MessagingPanelContent_1.MessagingPanelContent, {})] }));
}
