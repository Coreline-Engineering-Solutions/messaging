"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessagingNewConversation = MessagingNewConversation;
const jsx_runtime_1 = require("react/jsx-runtime");
const MaterialIcons_1 = __importDefault(require("@expo/vector-icons/MaterialIcons"));
const react_1 = require("react");
const react_native_1 = require("react-native");
const theme_1 = require("../theme");
const MessagingContext_1 = require("../context/MessagingContext");
const messagingStyles_1 = require("../styles/messagingStyles");
const messaging_1 = require("../types/messaging");
function MessagingNewConversation() {
    const { visibleContacts, openDirectConversation, setView, contact } = (0, MessagingContext_1.useMessaging)();
    const [search, setSearch] = (0, react_1.useState)('');
    const filtered = (0, react_1.useMemo)(() => {
        const q = search.trim().toLowerCase();
        return visibleContacts.filter((c) => {
            if (c.contact_id === contact?.contact_id)
                return false;
            if (!q)
                return true;
            const name = (0, messaging_1.getContactDisplayName)(c).toLowerCase();
            return name.includes(q) || c.email.toLowerCase().includes(q);
        });
    }, [visibleContacts, search, contact]);
    const renderContact = ({ item }) => ((0, jsx_runtime_1.jsxs)(react_native_1.TouchableOpacity, { style: messagingStyles_1.messagingStyles.contactRow, onPress: () => openDirectConversation(item), children: [(0, jsx_runtime_1.jsx)(react_native_1.View, { style: messagingStyles_1.messagingStyles.avatar, children: (0, jsx_runtime_1.jsx)(MaterialIcons_1.default, { name: "person", size: 22, color: theme_1.colors.text.primary }) }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: { flex: 1 }, children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: messagingStyles_1.messagingStyles.convName, children: (0, messaging_1.getContactDisplayName)(item) }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: messagingStyles_1.messagingStyles.convPreview, children: item.email })] })] }));
    return ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: { flex: 1 }, children: [(0, jsx_runtime_1.jsxs)(react_native_1.View, { style: messagingStyles_1.messagingStyles.chatHeader, children: [(0, jsx_runtime_1.jsx)(react_native_1.TouchableOpacity, { style: messagingStyles_1.messagingStyles.iconButton, onPress: () => setView('inbox'), activeOpacity: 0.7, children: (0, jsx_runtime_1.jsx)(MaterialIcons_1.default, { name: "arrow-back", size: 16, color: theme_1.colors.text.secondary }) }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: messagingStyles_1.messagingStyles.inboxTitle, children: "New conversation" })] }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: messagingStyles_1.messagingStyles.searchBar, children: [(0, jsx_runtime_1.jsx)(MaterialIcons_1.default, { name: "search", size: 20, color: theme_1.colors.text.tertiary }), (0, jsx_runtime_1.jsx)(react_native_1.TextInput, { style: messagingStyles_1.messagingStyles.searchInput, placeholder: "Search contacts\u2026", placeholderTextColor: theme_1.colors.text.tertiary, value: search, onChangeText: setSearch })] }), (0, jsx_runtime_1.jsx)(react_native_1.FlatList, { data: filtered, keyExtractor: (item) => item.contact_id, renderItem: renderContact, ListEmptyComponent: (0, jsx_runtime_1.jsx)(react_native_1.View, { style: messagingStyles_1.messagingStyles.emptyState, children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: messagingStyles_1.messagingStyles.emptyText, children: "No contacts found" }) }) })] }));
}
