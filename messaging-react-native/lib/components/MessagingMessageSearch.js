"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessagingMessageSearch = MessagingMessageSearch;
const jsx_runtime_1 = require("react/jsx-runtime");
const MaterialIcons_1 = __importDefault(require("@expo/vector-icons/MaterialIcons"));
const react_1 = require("react");
const react_native_1 = require("react-native");
const theme_1 = require("../theme");
const MessagingContext_1 = require("../context/MessagingContext");
const messagingStyles_1 = require("../styles/messagingStyles");
const messagingHelpers_1 = require("../utils/messagingHelpers");
function MessagingMessageSearch() {
    const { searchMessages, goBackToInbox, openConversation, inbox, activeConversationId } = (0, MessagingContext_1.useMessaging)();
    const [query, setQuery] = (0, react_1.useState)('');
    const [results, setResults] = (0, react_1.useState)([]);
    const [loading, setLoading] = (0, react_1.useState)(false);
    const runSearch = async () => {
        if (!query.trim())
            return;
        setLoading(true);
        try {
            setResults(await searchMessages(query));
        }
        finally {
            setLoading(false);
        }
    };
    const openResult = (msg) => {
        const item = inbox.find((i) => i.conversation_id === msg.conversation_id);
        if (item)
            openConversation(item);
    };
    return ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: { flex: 1 }, children: [(0, jsx_runtime_1.jsxs)(react_native_1.View, { style: messagingStyles_1.messagingStyles.chatHeader, children: [(0, jsx_runtime_1.jsx)(react_native_1.TouchableOpacity, { style: messagingStyles_1.messagingStyles.iconButton, onPress: goBackToInbox, children: (0, jsx_runtime_1.jsx)(MaterialIcons_1.default, { name: "arrow-back", size: 16, color: theme_1.colors.text.secondary }) }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [messagingStyles_1.messagingStyles.convName, { flex: 1 }], children: activeConversationId ? 'Search in chat' : 'Search messages' })] }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: messagingStyles_1.messagingStyles.groupSearchBar, children: [(0, jsx_runtime_1.jsx)(MaterialIcons_1.default, { name: "search", size: 20, color: theme_1.colors.text.tertiary }), (0, jsx_runtime_1.jsx)(react_native_1.TextInput, { style: messagingStyles_1.messagingStyles.searchInput, placeholder: "Search message text\u00E2\u20AC\u00A6", placeholderTextColor: theme_1.colors.text.tertiary, value: query, onChangeText: setQuery, onSubmitEditing: () => void runSearch(), returnKeyType: "search" }), (0, jsx_runtime_1.jsx)(react_native_1.TouchableOpacity, { onPress: () => void runSearch(), disabled: loading, children: loading ? ((0, jsx_runtime_1.jsx)(react_native_1.ActivityIndicator, { size: "small", color: theme_1.colors.primary[500] })) : ((0, jsx_runtime_1.jsx)(MaterialIcons_1.default, { name: "search", size: 22, color: theme_1.colors.primary[500] })) })] }), (0, jsx_runtime_1.jsx)(react_native_1.FlatList, { data: results, keyExtractor: (item) => item.message_id, renderItem: ({ item }) => ((0, jsx_runtime_1.jsxs)(react_native_1.TouchableOpacity, { style: messagingStyles_1.messagingStyles.contactRow, onPress: () => openResult(item), children: [(0, jsx_runtime_1.jsxs)(react_native_1.View, { style: { flex: 1 }, children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: messagingStyles_1.messagingStyles.convPreview, numberOfLines: 2, children: item.content || `[${item.message_type}]` }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: messagingStyles_1.messagingStyles.convTime, children: (0, messagingHelpers_1.formatMessageTime)(item.created_at) })] }), (0, jsx_runtime_1.jsx)(MaterialIcons_1.default, { name: "chevron-right", size: 20, color: theme_1.colors.text.tertiary })] })), ListEmptyComponent: (0, jsx_runtime_1.jsx)(react_native_1.View, { style: messagingStyles_1.messagingStyles.emptyState, children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: messagingStyles_1.messagingStyles.emptyText, children: query ? 'No results' : 'Enter a query to search' }) }) })] }));
}
