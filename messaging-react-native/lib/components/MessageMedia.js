"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageMedia = MessageMedia;
const jsx_runtime_1 = require("react/jsx-runtime");
const expo_image_1 = require("expo-image");
const MaterialIcons_1 = __importDefault(require("@expo/vector-icons/MaterialIcons"));
const react_1 = require("react");
const react_native_1 = require("react-native");
const theme_1 = require("../theme");
const messagingFileService_1 = require("../services/messagingFileService");
const messagingStyles_1 = require("../styles/messagingStyles");
const messagingHelpers_1 = require("../utils/messagingHelpers");
function MessageMedia({ message, onPress, }) {
    const localUri = message.local_image_uri;
    const fileId = (0, messagingHelpers_1.resolveMessageFileId)(message);
    const [remoteUri, setRemoteUri] = (0, react_1.useState)(fileId ? (0, messagingFileService_1.getCachedMessagingMediaUrl)(fileId) : null);
    const [loading, setLoading] = (0, react_1.useState)(!!fileId && !remoteUri && !localUri);
    const [failed, setFailed] = (0, react_1.useState)(false);
    (0, react_1.useEffect)(() => {
        if (localUri || !fileId)
            return;
        const cached = (0, messagingFileService_1.getCachedMessagingMediaUrl)(fileId);
        if (cached) {
            setRemoteUri(cached);
            setLoading(false);
            return;
        }
        let cancelled = false;
        setLoading(true);
        void (0, messagingFileService_1.getMessagingMediaUrl)(fileId)
            .then((uri) => {
            if (!cancelled) {
                setRemoteUri(uri);
                setFailed(false);
            }
        })
            .catch(() => {
            if (!cancelled)
                setFailed(true);
        })
            .finally(() => {
            if (!cancelled)
                setLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [fileId, localUri]);
    const directUrl = message.media_url && (0, messagingHelpers_1.isHttpOrDataUrl)(message.media_url) ? message.media_url : null;
    const uri = localUri || remoteUri || directUrl;
    if (message.message_type === 'FILE' && !uri) {
        return ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [messagingStyles_1.messagingStyles.chatImage, messagingStyles_1.messagingStyles.fileAttachment], children: [(0, jsx_runtime_1.jsx)(MaterialIcons_1.default, { name: "insert-drive-file", size: 32, color: theme_1.colors.primary[500] }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: messagingStyles_1.messagingStyles.convPreview, numberOfLines: 2, children: message.attachments?.[0]?.filename || 'Attachment' })] }));
    }
    if (loading) {
        return ((0, jsx_runtime_1.jsx)(react_native_1.View, { style: [messagingStyles_1.messagingStyles.chatImage, { alignItems: 'center', justifyContent: 'center' }], children: (0, jsx_runtime_1.jsx)(react_native_1.ActivityIndicator, { color: theme_1.colors.primary[500] }) }));
    }
    if (!uri || failed) {
        return ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [messagingStyles_1.messagingStyles.chatImage, { alignItems: 'center', justifyContent: 'center' }], children: [(0, jsx_runtime_1.jsx)(MaterialIcons_1.default, { name: "broken-image", size: 40, color: theme_1.colors.text.tertiary }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: messagingStyles_1.messagingStyles.convPreview, children: "Unavailable" })] }));
    }
    const image = ((0, jsx_runtime_1.jsx)(expo_image_1.Image, { source: { uri }, style: messagingStyles_1.messagingStyles.chatImage, contentFit: "cover" }));
    if (onPress) {
        return ((0, jsx_runtime_1.jsx)(react_native_1.TouchableOpacity, { activeOpacity: 0.9, onPress: () => onPress(uri), children: image }));
    }
    return image;
}
