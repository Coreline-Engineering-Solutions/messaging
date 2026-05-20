"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageImageLightbox = MessageImageLightbox;
const jsx_runtime_1 = require("react/jsx-runtime");
const expo_image_1 = require("expo-image");
const MaterialIcons_1 = __importDefault(require("@expo/vector-icons/MaterialIcons"));
const react_native_1 = require("react-native");
const theme_1 = require("../theme");
const messagingStyles_1 = require("../styles/messagingStyles");
function MessageImageLightbox({ uri, onClose, }) {
    return ((0, jsx_runtime_1.jsx)(react_native_1.Modal, { visible: !!uri, transparent: true, animationType: "fade", onRequestClose: onClose, children: (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: messagingStyles_1.messagingStyles.lightboxBackdrop, children: [(0, jsx_runtime_1.jsx)(react_native_1.TouchableOpacity, { style: messagingStyles_1.messagingStyles.lightboxClose, onPress: onClose, children: (0, jsx_runtime_1.jsx)(MaterialIcons_1.default, { name: "close", size: 28, color: theme_1.colors.white }) }), uri ? ((0, jsx_runtime_1.jsx)(expo_image_1.Image, { source: { uri }, style: messagingStyles_1.messagingStyles.lightboxImage, contentFit: "contain" })) : null] }) }));
}
