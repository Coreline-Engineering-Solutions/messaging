"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessagingScreen = MessagingScreen;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_native_1 = require("react-native");
const theme_1 = require("../theme");
const MessagingPanelContent_1 = require("./MessagingPanelContent");
/** Full-screen messaging UI for a dedicated host tab (not a bottom sheet). */
function MessagingScreen() {
    return ((0, jsx_runtime_1.jsx)(react_native_1.View, { style: styles.root, children: (0, jsx_runtime_1.jsx)(MessagingPanelContent_1.MessagingPanelContent, {}) }));
}
const styles = react_native_1.StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: theme_1.colors.background,
    },
});
