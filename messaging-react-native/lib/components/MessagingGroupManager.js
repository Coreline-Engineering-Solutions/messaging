"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessagingGroupManager = MessagingGroupManager;
const jsx_runtime_1 = require("react/jsx-runtime");
const MaterialIcons_1 = __importDefault(require("@expo/vector-icons/MaterialIcons"));
const react_1 = require("react");
const react_native_1 = require("react-native");
const theme_1 = require("../theme");
const MessagingContext_1 = require("../context/MessagingContext");
const messagingApiService_1 = require("../services/messagingApiService");
const messagingStyles_1 = require("../styles/messagingStyles");
const messaging_1 = require("../types/messaging");
function MessagingGroupManager() {
    const { visibleContacts, createGroup, saveGroupEdit, deleteGroup, groupEdit, contact, setView, clearGroupEdit, } = (0, MessagingContext_1.useMessaging)();
    const isEditMode = !!groupEdit;
    const [name, setName] = (0, react_1.useState)(groupEdit?.name ?? '');
    const [search, setSearch] = (0, react_1.useState)('');
    const [selected, setSelected] = (0, react_1.useState)([]);
    const [members, setMembers] = (0, react_1.useState)([]);
    const [pendingRemove, setPendingRemove] = (0, react_1.useState)(new Set());
    const [loadingMembers, setLoadingMembers] = (0, react_1.useState)(false);
    const [saving, setSaving] = (0, react_1.useState)(false);
    (0, react_1.useEffect)(() => {
        setName(groupEdit?.name ?? '');
        setSelected([]);
        setPendingRemove(new Set());
    }, [groupEdit]);
    const loadMembers = (0, react_1.useCallback)(async () => {
        if (!groupEdit)
            return;
        setLoadingMembers(true);
        try {
            const list = await (0, messagingApiService_1.getConversationParticipants)(groupEdit.conversationId);
            setMembers(list);
        }
        catch {
            setMembers([]);
        }
        finally {
            setLoadingMembers(false);
        }
    }, [groupEdit]);
    (0, react_1.useEffect)(() => {
        if (isEditMode)
            void loadMembers();
        else
            setMembers([]);
    }, [isEditMode, loadMembers]);
    const memberIds = (0, react_1.useMemo)(() => new Set(members
        .filter((m) => !pendingRemove.has(m.contact_id))
        .map((m) => m.contact_id)), [members, pendingRemove]);
    const candidates = (0, react_1.useMemo)(() => {
        const q = search.trim().toLowerCase();
        return visibleContacts.filter((c) => {
            if (c.contact_id === contact?.contact_id)
                return false;
            if (memberIds.has(c.contact_id))
                return false;
            if (!q)
                return true;
            return ((0, messaging_1.getContactDisplayName)(c).toLowerCase().includes(q) ||
                c.email.toLowerCase().includes(q));
        });
    }, [visibleContacts, contact, memberIds, search]);
    const isSelected = (c) => selected.some((s) => s.contact_id === c.contact_id);
    const removeSelected = (c) => {
        setSelected((prev) => prev.filter((x) => x.contact_id !== c.contact_id));
    };
    const getMemberLabel = (m) => m.username || m.email || (0, messaging_1.getContactDisplayName)(m);
    const toggleSelect = (c) => {
        setSelected((prev) => prev.some((x) => x.contact_id === c.contact_id)
            ? prev.filter((x) => x.contact_id !== c.contact_id)
            : [...prev, c]);
    };
    const goBack = () => {
        clearGroupEdit();
        setView(isEditMode ? 'chat' : 'inbox');
    };
    const handleSubmit = async () => {
        if (!name.trim() || saving)
            return;
        setSaving(true);
        try {
            if (isEditMode && groupEdit) {
                await saveGroupEdit(name.trim(), selected.map((c) => c.contact_id), Array.from(pendingRemove));
            }
            else {
                if (selected.length < 1)
                    return;
                await createGroup(selected.map((c) => c.contact_id), name.trim());
            }
        }
        finally {
            setSaving(false);
        }
    };
    const handleDelete = () => {
        react_native_1.Alert.alert('Leave group', 'Remove yourself from this group?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Leave',
                style: 'destructive',
                onPress: () => void deleteGroup(),
            },
        ]);
    };
    return ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: { flex: 1 }, children: [(0, jsx_runtime_1.jsxs)(react_native_1.View, { style: messagingStyles_1.messagingStyles.chatHeader, children: [(0, jsx_runtime_1.jsx)(react_native_1.TouchableOpacity, { style: messagingStyles_1.messagingStyles.iconButton, onPress: goBack, activeOpacity: 0.7, children: (0, jsx_runtime_1.jsx)(MaterialIcons_1.default, { name: "arrow-back", size: 16, color: theme_1.colors.text.secondary }) }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: messagingStyles_1.messagingStyles.inboxTitle, children: isEditMode ? 'Group settings' : 'Create group' })] }), (0, jsx_runtime_1.jsxs)(react_native_1.ScrollView, { style: { flex: 1, backgroundColor: theme_1.colors.background }, contentContainerStyle: { padding: theme_1.spacing.lg, gap: theme_1.spacing.md }, keyboardShouldPersistTaps: "handled", children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: { color: theme_1.colors.text.secondary, fontSize: 12, fontWeight: '600' }, children: "GROUP NAME" }), (0, jsx_runtime_1.jsx)(react_native_1.TextInput, { style: messagingStyles_1.messagingStyles.textInput, placeholder: "Enter group name\u2026", placeholderTextColor: theme_1.colors.text.tertiary, value: name, onChangeText: setName }), isEditMode && ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: { color: theme_1.colors.text.secondary, fontSize: 12, fontWeight: '600' }, children: "CURRENT MEMBERS" }), loadingMembers ? ((0, jsx_runtime_1.jsx)(react_native_1.ActivityIndicator, { color: theme_1.colors.primary[500] })) : (members.map((m) => {
                                const removed = pendingRemove.has(m.contact_id);
                                const isYou = m.contact_id === contact?.contact_id;
                                return ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [messagingStyles_1.messagingStyles.contactRow, removed && { opacity: 0.4 }], children: [(0, jsx_runtime_1.jsx)(react_native_1.View, { style: messagingStyles_1.messagingStyles.avatar, children: (0, jsx_runtime_1.jsx)(MaterialIcons_1.default, { name: "person", size: 20, color: theme_1.colors.text.primary }) }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: { flex: 1 }, children: [(0, jsx_runtime_1.jsxs)(react_native_1.Text, { style: messagingStyles_1.messagingStyles.convName, children: [getMemberLabel(m), isYou ? ' (you)' : ''] }), m.email ? ((0, jsx_runtime_1.jsx)(react_native_1.Text, { style: messagingStyles_1.messagingStyles.convPreview, children: m.email })) : null] }), !isYou && !removed && ((0, jsx_runtime_1.jsx)(react_native_1.TouchableOpacity, { onPress: () => setPendingRemove((prev) => new Set(prev).add(m.contact_id)), children: (0, jsx_runtime_1.jsx)(MaterialIcons_1.default, { name: "person-remove", size: 22, color: theme_1.colors.error }) })), removed && ((0, jsx_runtime_1.jsx)(react_native_1.TouchableOpacity, { onPress: () => setPendingRemove((prev) => {
                                                const next = new Set(prev);
                                                next.delete(m.contact_id);
                                                return next;
                                            }), children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: messagingStyles_1.messagingStyles.linkText, children: "Undo" }) }))] }, m.contact_id));
                            }))] })), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: { color: theme_1.colors.text.secondary, fontSize: 12, fontWeight: '600' }, children: isEditMode ? 'ADD MEMBERS' : 'SELECT MEMBERS (min 1)' }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: messagingStyles_1.messagingStyles.groupSearchBar, children: [(0, jsx_runtime_1.jsx)(MaterialIcons_1.default, { name: "search", size: 20, color: theme_1.colors.text.tertiary }), (0, jsx_runtime_1.jsx)(react_native_1.TextInput, { style: messagingStyles_1.messagingStyles.searchInput, placeholder: "Search contacts\u2026", placeholderTextColor: theme_1.colors.text.tertiary, value: search, onChangeText: setSearch })] }), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: messagingStyles_1.messagingStyles.memberTagsSection, children: selected.length === 0 ? ((0, jsx_runtime_1.jsx)(react_native_1.Text, { style: messagingStyles_1.messagingStyles.memberTagsHint, children: "Selected people appear here \u2014 tap contacts below to add" })) : ((0, jsx_runtime_1.jsx)(react_native_1.View, { style: messagingStyles_1.messagingStyles.memberTagsWrap, children: selected.map((c) => ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: messagingStyles_1.messagingStyles.memberTagChip, children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: messagingStyles_1.messagingStyles.memberTagText, numberOfLines: 1, children: (0, messaging_1.getContactDisplayName)(c) }), (0, jsx_runtime_1.jsx)(react_native_1.TouchableOpacity, { style: messagingStyles_1.messagingStyles.memberTagRemove, onPress: () => removeSelected(c), accessibilityLabel: `Remove ${(0, messaging_1.getContactDisplayName)(c)}`, hitSlop: { top: 8, bottom: 8, left: 8, right: 8 }, children: (0, jsx_runtime_1.jsx)(MaterialIcons_1.default, { name: "close", size: 14, color: theme_1.colors.text.secondary }) })] }, c.contact_id))) })) }), candidates.map((c) => {
                        const picked = isSelected(c);
                        return ((0, jsx_runtime_1.jsxs)(react_native_1.TouchableOpacity, { style: [messagingStyles_1.messagingStyles.contactRow, picked && messagingStyles_1.messagingStyles.contactRowSelected], onPress: () => toggleSelect(c), activeOpacity: 0.7, children: [(0, jsx_runtime_1.jsx)(react_native_1.View, { style: messagingStyles_1.messagingStyles.avatar, children: (0, jsx_runtime_1.jsx)(MaterialIcons_1.default, { name: "person", size: 20, color: theme_1.colors.text.primary }) }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [messagingStyles_1.messagingStyles.convName, { flex: 1 }], children: (0, messaging_1.getContactDisplayName)(c) }), (0, jsx_runtime_1.jsx)(MaterialIcons_1.default, { name: picked ? 'check-circle' : 'person-add', size: 22, color: picked ? theme_1.colors.success : theme_1.colors.primary[500] })] }, c.contact_id));
                    })] }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: messagingStyles_1.messagingStyles.groupActionBar, children: [(0, jsx_runtime_1.jsx)(react_native_1.TouchableOpacity, { style: messagingStyles_1.messagingStyles.groupPrimaryBtn, onPress: () => void handleSubmit(), disabled: saving || !name.trim() || (!isEditMode && selected.length < 1), activeOpacity: 0.8, children: saving ? ((0, jsx_runtime_1.jsx)(react_native_1.ActivityIndicator, { color: theme_1.colors.white })) : ((0, jsx_runtime_1.jsx)(react_native_1.Text, { style: messagingStyles_1.messagingStyles.groupPrimaryBtnText, children: isEditMode
                                ? 'Confirm changes'
                                : `Create group (${selected.length + 1} members)` })) }), isEditMode && ((0, jsx_runtime_1.jsx)(react_native_1.TouchableOpacity, { style: messagingStyles_1.messagingStyles.groupDeleteBtn, onPress: handleDelete, disabled: saving, activeOpacity: 0.8, children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: messagingStyles_1.messagingStyles.groupDeleteBtnText, children: "Leave group" }) }))] })] }));
}
