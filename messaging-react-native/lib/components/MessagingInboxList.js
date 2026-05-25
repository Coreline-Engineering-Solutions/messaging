"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessagingInboxList = MessagingInboxList;
const jsx_runtime_1 = require("react/jsx-runtime");
const MaterialIcons_1 = __importDefault(require("@expo/vector-icons/MaterialIcons"));
const react_1 = require("react");
const react_native_1 = require("react-native");
const theme_1 = require("../theme");
const MessagingContext_1 = require("../context/MessagingContext");
const messagingStyles_1 = require("../styles/messagingStyles");
const messaging_1 = require("../types/messaging");
function formatTime(iso) {
    const d = new Date(iso);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
const FILTER_EMPTY_LABEL = {
    all: 'conversations',
    dms: 'DM conversations',
    groups: 'group conversations',
    favorites: 'favorite conversations',
    projects: 'project conversations',
};
function MessagingInboxList() {
    const { inbox, openConversation, setView, isReady, initError, refreshInbox, visibleContacts, openCreateGroup, clearConversation, deleteConversationItem, openMessageSearch, isFavoriteConversation, toggleFavoriteConversation, closePanel, presentation, } = (0, MessagingContext_1.useMessaging)();
    const [search, setSearch] = (0, react_1.useState)('');
    const [inboxFilter, setInboxFilter] = (0, react_1.useState)('all');
    const [refreshing, setRefreshing] = (0, react_1.useState)(false);
    const filtered = (0, react_1.useMemo)(() => {
        let list = inbox;
        if (inboxFilter === 'groups')
            list = list.filter((i) => i.is_group);
        if (inboxFilter === 'dms')
            list = list.filter((i) => !i.is_group);
        if (inboxFilter === 'favorites') {
            list = list.filter((i) => isFavoriteConversation(i.conversation_id));
        }
        if (inboxFilter === 'projects') {
            list = list.filter((i) => (0, messaging_1.isProjectConversation)(i));
        }
        const q = search.trim().toLowerCase();
        if (!q)
            return list;
        return list.filter((i) => (0, messaging_1.getInboxDisplayName)(i, visibleContacts).toLowerCase().includes(q) ||
            (i.last_message_preview || '').toLowerCase().includes(q));
    }, [inbox, search, inboxFilter, visibleContacts, isFavoriteConversation]);
    if (initError) {
        return ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: messagingStyles_1.messagingStyles.emptyState, children: [(0, jsx_runtime_1.jsx)(MaterialIcons_1.default, { name: "error-outline", size: 40, color: theme_1.colors.error }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: messagingStyles_1.messagingStyles.emptyText, children: initError })] }));
    }
    if (!isReady) {
        return ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: messagingStyles_1.messagingStyles.emptyState, children: [(0, jsx_runtime_1.jsx)(react_native_1.ActivityIndicator, { color: theme_1.colors.primary[500] }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: messagingStyles_1.messagingStyles.emptyText, children: "Loading messenger\u00E2\u20AC\u00A6" })] }));
    }
    const showConversationActions = (item) => {
        const title = (0, messaging_1.getInboxDisplayName)(item, visibleContacts);
        const onClear = () => {
            react_native_1.Alert.alert('Clear conversation', `Clear messages in "${title}"?`, [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clear',
                    style: 'destructive',
                    onPress: () => void clearConversation(item),
                },
            ]);
        };
        const onDelete = () => {
            react_native_1.Alert.alert('Delete conversation', `Delete "${title}"?`, [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => void deleteConversationItem(item),
                },
            ]);
        };
        if (react_native_1.Platform.OS === 'ios') {
            react_native_1.ActionSheetIOS.showActionSheetWithOptions({
                options: ['Clear messages', 'Delete conversation', 'Cancel'],
                cancelButtonIndex: 2,
                destructiveButtonIndex: 1,
                title,
            }, (idx) => {
                if (idx === 0)
                    onClear();
                if (idx === 1)
                    onDelete();
            });
        }
        else {
            react_native_1.Alert.alert(title, undefined, [
                { text: 'Clear messages', onPress: onClear },
                { text: 'Delete conversation', style: 'destructive', onPress: onDelete },
                { text: 'Cancel', style: 'cancel' },
            ]);
        }
    };
    const renderItem = ({ item }) => {
        const favorited = isFavoriteConversation(item.conversation_id);
        const project = (0, messaging_1.isProjectConversation)(item);
        return ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: messagingStyles_1.messagingStyles.convItem, children: [(0, jsx_runtime_1.jsxs)(react_native_1.TouchableOpacity, { style: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: theme_1.spacing.sm }, onPress: () => openConversation(item), onLongPress: () => showConversationActions(item), delayLongPress: 400, activeOpacity: 0.7, children: [(0, jsx_runtime_1.jsx)(react_native_1.View, { style: messagingStyles_1.messagingStyles.avatar, children: (0, jsx_runtime_1.jsx)(MaterialIcons_1.default, { name: project ? 'work' : item.is_group ? 'group' : 'person', size: 22, color: theme_1.colors.text.primary }) }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: { flex: 1 }, children: [(0, jsx_runtime_1.jsxs)(react_native_1.View, { style: { flexDirection: 'row', alignItems: 'center', gap: 8 }, children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: messagingStyles_1.messagingStyles.convName, numberOfLines: 1, children: (0, messaging_1.getInboxDisplayName)(item, visibleContacts) }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: messagingStyles_1.messagingStyles.convTime, children: formatTime(item.last_message_at) })] }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: { flexDirection: 'row', alignItems: 'center', marginTop: 4 }, children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: messagingStyles_1.messagingStyles.convPreview, numberOfLines: 1, children: item.last_message_preview || 'No messages yet' }), item.unread_count > 0 && ((0, jsx_runtime_1.jsx)(react_native_1.View, { style: messagingStyles_1.messagingStyles.unreadBadge, children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: messagingStyles_1.messagingStyles.unreadText, children: item.unread_count > 99 ? '99+' : item.unread_count }) }))] })] })] }), (0, jsx_runtime_1.jsx)(react_native_1.TouchableOpacity, { style: messagingStyles_1.messagingStyles.convFavoriteButton, onPress: () => void toggleFavoriteConversation(item.conversation_id), hitSlop: { top: 8, bottom: 8, left: 8, right: 8 }, accessibilityLabel: favorited ? 'Remove from favorites' : 'Add to favorites', accessibilityRole: "button", children: (0, jsx_runtime_1.jsx)(MaterialIcons_1.default, { name: favorited ? 'star' : 'star-outline', size: 22, color: favorited ? theme_1.colors.warning : theme_1.colors.text.tertiary }) })] }));
    };
    const FilterChip = ({ id, label, }) => {
        const active = inboxFilter === id;
        return ((0, jsx_runtime_1.jsx)(react_native_1.TouchableOpacity, { style: [messagingStyles_1.messagingStyles.filterChip, active && messagingStyles_1.messagingStyles.filterChipActive], onPress: () => setInboxFilter(id), activeOpacity: 0.8, children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [
                    messagingStyles_1.messagingStyles.filterChipText,
                    active && messagingStyles_1.messagingStyles.filterChipTextActive,
                ], children: label }) }));
    };
    const emptyLabel = search
        ? 'No matching conversations'
        : `No ${FILTER_EMPTY_LABEL[inboxFilter]}`;
    return ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: { flex: 1 }, children: [(0, jsx_runtime_1.jsxs)(react_native_1.View, { style: messagingStyles_1.messagingStyles.inboxHeader, children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: messagingStyles_1.messagingStyles.inboxTitle, children: "Messages" }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: { flexDirection: 'row', gap: theme_1.spacing.xs }, children: [(0, jsx_runtime_1.jsx)(react_native_1.TouchableOpacity, { style: messagingStyles_1.messagingStyles.iconButton, onPress: () => setView('new-conversation'), activeOpacity: 0.7, children: (0, jsx_runtime_1.jsx)(MaterialIcons_1.default, { name: "edit", size: 16, color: theme_1.colors.text.secondary }) }), (0, jsx_runtime_1.jsx)(react_native_1.TouchableOpacity, { style: messagingStyles_1.messagingStyles.iconButton, onPress: openMessageSearch, activeOpacity: 0.7, children: (0, jsx_runtime_1.jsx)(MaterialIcons_1.default, { name: "search", size: 16, color: theme_1.colors.text.secondary }) }), (0, jsx_runtime_1.jsx)(react_native_1.TouchableOpacity, { style: messagingStyles_1.messagingStyles.iconButton, onPress: openCreateGroup, activeOpacity: 0.7, children: (0, jsx_runtime_1.jsx)(MaterialIcons_1.default, { name: "group-add", size: 16, color: theme_1.colors.text.secondary }) }), presentation === 'overlay' && ((0, jsx_runtime_1.jsx)(react_native_1.TouchableOpacity, { style: messagingStyles_1.messagingStyles.iconButton, onPress: closePanel, activeOpacity: 0.7, hitSlop: { top: 4, bottom: 4, left: 4, right: 4 }, accessibilityLabel: "Close messenger", accessibilityRole: "button", children: (0, jsx_runtime_1.jsx)(MaterialIcons_1.default, { name: "close", size: 16, color: theme_1.colors.text.secondary }) }))] })] }), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: messagingStyles_1.messagingStyles.inboxFilterRow, children: (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: messagingStyles_1.messagingStyles.inboxFilterStrip, children: [(0, jsx_runtime_1.jsx)(FilterChip, { id: "all", label: "All" }), (0, jsx_runtime_1.jsx)(FilterChip, { id: "dms", label: "DMs" }), (0, jsx_runtime_1.jsx)(FilterChip, { id: "groups", label: "Groups" }), (0, jsx_runtime_1.jsx)(FilterChip, { id: "favorites", label: "Favorites" }), (0, jsx_runtime_1.jsx)(FilterChip, { id: "projects", label: "Projects" })] }) }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: messagingStyles_1.messagingStyles.searchBar, children: [(0, jsx_runtime_1.jsx)(MaterialIcons_1.default, { name: "search", size: 20, color: theme_1.colors.text.tertiary }), (0, jsx_runtime_1.jsx)(react_native_1.TextInput, { style: messagingStyles_1.messagingStyles.searchInput, placeholder: "Search conversations\u00E2\u20AC\u00A6", placeholderTextColor: theme_1.colors.text.tertiary, value: search, onChangeText: setSearch })] }), (0, jsx_runtime_1.jsx)(react_native_1.FlatList, { data: filtered, keyExtractor: (item) => item.conversation_id, renderItem: renderItem, refreshing: refreshing, onRefresh: async () => {
                    setRefreshing(true);
                    await refreshInbox();
                    setRefreshing(false);
                }, ListEmptyComponent: (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: messagingStyles_1.messagingStyles.emptyState, children: [(0, jsx_runtime_1.jsx)(MaterialIcons_1.default, { name: inboxFilter === 'favorites'
                                ? 'star-outline'
                                : inboxFilter === 'projects'
                                    ? 'work-outline'
                                    : 'forum', size: 48, color: theme_1.colors.text.tertiary }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: messagingStyles_1.messagingStyles.emptyText, children: emptyLabel }), !search && inboxFilter === 'favorites' && ((0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [messagingStyles_1.messagingStyles.emptyText, { fontSize: 13, marginTop: 4 }], children: "Tap the star on a conversation to add it here." })), !search && (inboxFilter === 'all' || inboxFilter === 'dms') && ((0, jsx_runtime_1.jsx)(react_native_1.TouchableOpacity, { onPress: () => setView('new-conversation'), children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: messagingStyles_1.messagingStyles.linkText, children: "Start a conversation" }) }))] }) })] }));
}
