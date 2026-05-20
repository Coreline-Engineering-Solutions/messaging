"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessagingThreadViewer = MessagingThreadViewer;
const jsx_runtime_1 = require("react/jsx-runtime");
const MaterialIcons_1 = __importDefault(require("@expo/vector-icons/MaterialIcons"));
const react_1 = require("react");
const react_native_1 = require("react-native");
const theme_1 = require("../theme");
const MessagingContext_1 = require("../context/MessagingContext");
const messagingStyles_1 = require("../styles/messagingStyles");
const messaging_1 = require("../types/messaging");
function MessagingThreadViewer() {
    const { threadParent, threadMessages, closeThread, sendThreadMessage, contact, visibleContacts, } = (0, MessagingContext_1.useMessaging)();
    const [draft, setDraft] = (0, react_1.useState)('');
    const [sending, setSending] = (0, react_1.useState)(false);
    const listRef = (0, react_1.useRef)(null);
    if (!threadParent) {
        return ((0, jsx_runtime_1.jsx)(react_native_1.View, { style: messagingStyles_1.messagingStyles.emptyState, children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: messagingStyles_1.messagingStyles.emptyText, children: "No thread selected" }) }));
    }
    const handleSend = async () => {
        if (!draft.trim() || sending)
            return;
        setSending(true);
        try {
            await sendThreadMessage(draft);
            setDraft('');
            setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
        }
        finally {
            setSending(false);
        }
    };
    return ((0, jsx_runtime_1.jsxs)(react_native_1.KeyboardAvoidingView, { style: { flex: 1 }, behavior: react_native_1.Platform.OS === 'ios' ? 'padding' : undefined, keyboardVerticalOffset: 80, children: [(0, jsx_runtime_1.jsxs)(react_native_1.View, { style: messagingStyles_1.messagingStyles.chatHeader, children: [(0, jsx_runtime_1.jsx)(react_native_1.TouchableOpacity, { style: messagingStyles_1.messagingStyles.iconButton, onPress: closeThread, children: (0, jsx_runtime_1.jsx)(MaterialIcons_1.default, { name: "arrow-back", size: 16, color: theme_1.colors.text.secondary }) }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [messagingStyles_1.messagingStyles.convName, { flex: 1 }], numberOfLines: 1, children: "Thread" })] }), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: { padding: 12, backgroundColor: theme_1.colors.glassUltra }, children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: messagingStyles_1.messagingStyles.convPreview, numberOfLines: 3, children: threadParent.content || '[Media]' }) }), (0, jsx_runtime_1.jsx)(react_native_1.FlatList, { ref: listRef, data: threadMessages, keyExtractor: (item) => item.message_id, contentContainerStyle: messagingStyles_1.messagingStyles.messagesList, renderItem: ({ item }) => {
                    const own = String(item.sender_id) === String(contact?.contact_id);
                    return ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: own ? messagingStyles_1.messagingStyles.bubbleRowOwn : messagingStyles_1.messagingStyles.bubbleRowOther, children: [!own && ((0, jsx_runtime_1.jsx)(react_native_1.Text, { style: messagingStyles_1.messagingStyles.senderName, children: (0, messaging_1.resolveMessageSenderDisplayName)(item, visibleContacts, contact?.contact_id) })), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: own ? messagingStyles_1.messagingStyles.bubbleOwn : messagingStyles_1.messagingStyles.bubbleOther, children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: messagingStyles_1.messagingStyles.bubbleText, children: item.content }) })] }));
                }, onContentSizeChange: () => listRef.current?.scrollToEnd({ animated: false }) }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: messagingStyles_1.messagingStyles.inputBar, children: [(0, jsx_runtime_1.jsx)(react_native_1.TextInput, { style: messagingStyles_1.messagingStyles.textInput, placeholder: "Reply in thread\u00E2\u20AC\u00A6", placeholderTextColor: theme_1.colors.text.tertiary, value: draft, onChangeText: setDraft, multiline: true }), (0, jsx_runtime_1.jsx)(react_native_1.TouchableOpacity, { style: [messagingStyles_1.messagingStyles.sendBtn, sending && { opacity: 0.5 }], onPress: () => void handleSend(), disabled: sending, children: (0, jsx_runtime_1.jsx)(MaterialIcons_1.default, { name: "send", size: 20, color: theme_1.colors.white }) })] })] }));
}
