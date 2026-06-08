"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessagingChatThread = MessagingChatThread;
const jsx_runtime_1 = require("react/jsx-runtime");
const MaterialIcons_1 = __importDefault(require("@expo/vector-icons/MaterialIcons"));
const react_1 = require("react");
const react_native_1 = require("react-native");
const MessagingContext_1 = require("../context/MessagingContext");
const imagePickerHost_1 = require("../services/imagePickerHost");
const mediaPickerService_1 = require("../services/mediaPickerService");
const messagingStyles_1 = require("../styles/messagingStyles");
const theme_1 = require("../theme");
const messaging_1 = require("../types/messaging");
const messagingHelpers_1 = require("../utils/messagingHelpers");
const MessageImageLightbox_1 = require("./MessageImageLightbox");
const MessageMedia_1 = require("./MessageMedia");
const REACTION_EMOJIS = ['ðŸ‘', 'â¤ï¸', 'ðŸ˜‚', 'ðŸ˜®', 'ðŸ˜¢', 'ðŸŽ‰', 'ðŸ”¥', 'ðŸ‘'];
function isMessageRead(msg) {
    if (msg.is_read === true || msg.is_read === 'true' || msg.is_read === '1')
        return true;
    return false;
}
function MessagingChatThread() {
    const { contact, messages, activeConversationName, activeIsGroup, activeConversationId, visibleContacts, loadingMessages, goBackToInbox, sendChatMessage, sendChatAttachments, toggleReaction, loadOlderMessages, openGroupSettings, openMessageSearch, openThread, editChatMessage, deleteChatMessage, closePanel, openPanel, presentation, isFavoriteConversation, toggleFavoriteConversation, attachmentError, } = (0, MessagingContext_1.useMessaging)();
    const [draft, setDraft] = (0, react_1.useState)('');
    const [sending, setSending] = (0, react_1.useState)(false);
    const [reactionTargetId, setReactionTargetId] = (0, react_1.useState)(null);
    const [showAttachMenu, setShowAttachMenu] = (0, react_1.useState)(false);
    const [pickingImage, setPickingImage] = (0, react_1.useState)(false);
    const [pendingFiles, setPendingFiles] = (0, react_1.useState)([]);
    const [lightboxUri, setLightboxUri] = (0, react_1.useState)(null);
    const [editingId, setEditingId] = (0, react_1.useState)(null);
    const [editDraft, setEditDraft] = (0, react_1.useState)('');
    const listRef = (0, react_1.useRef)(null);
    const isOwn = (msg) => String(msg.sender_id) === String(contact?.contact_id);
    const isFavorited = activeConversationId
        ? isFavoriteConversation(activeConversationId)
        : false;
    const handleSend = async () => {
        if (editingId) {
            await editChatMessage(editingId, editDraft);
            setEditingId(null);
            setEditDraft('');
            return;
        }
        if (pendingFiles.length > 0) {
            setSending(true);
            try {
                await sendChatAttachments(pendingFiles, draft.trim());
                setPendingFiles([]);
                setDraft('');
                setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
            }
            finally {
                setSending(false);
            }
            return;
        }
        if (!draft.trim() || sending)
            return;
        setSending(true);
        try {
            await sendChatMessage(draft);
            setDraft('');
            setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
        }
        finally {
            setSending(false);
        }
    };
    const runImagePick = async (source) => {
        if (!activeConversationId || pickingImage)
            return;
        setShowAttachMenu(false);
        setPickingImage(true);
        const panelWasOpen = presentation === 'overlay';
        try {
            if (source === 'camera' && presentation === 'overlay') {
                closePanel();
                await new Promise((r) => setTimeout(r, react_native_1.Platform.OS === 'android' ? 500 : 150));
            }
            if (source === 'multi') {
                const files = await (0, mediaPickerService_1.pickMultipleImages)(5);
                if (files.length)
                    setPendingFiles((prev) => [...prev, ...files].slice(0, 5));
                return;
            }
            const file = source === 'camera'
                ? await (0, imagePickerHost_1.takePhotoFromHost)().catch(() => (0, mediaPickerService_1.takePhoto)())
                : await (0, imagePickerHost_1.pickImageFromHost)().catch(() => (0, mediaPickerService_1.pickImage)());
            if (file) {
                if (source === 'camera') {
                    await sendChatAttachments([file]);
                }
                else {
                    setPendingFiles((prev) => [...prev, file].slice(0, 5));
                }
            }
        }
        catch {
            /* ignore picker cancellation/failures */
        }
        finally {
            if (panelWasOpen && source === 'camera')
                openPanel();
            setPickingImage(false);
        }
    };
    const showMessageActions = (item) => {
        const own = isOwn(item);
        const options = ['Reply in thread', 'React'];
        const handlers = [
            () => void openThread(item),
            () => setReactionTargetId(item.message_id),
        ];
        if (own && item.message_type === 'TEXT' && !(0, messagingHelpers_1.isTempMessageId)(item.message_id)) {
            options.push('Edit');
            handlers.push(() => {
                setEditingId(item.message_id);
                setEditDraft(item.content || '');
            });
        }
        if (own && !(0, messagingHelpers_1.isTempMessageId)(item.message_id)) {
            options.push('Delete');
            handlers.push(() => {
                react_native_1.Alert.alert('Delete message', 'Remove this message?', [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: () => void deleteChatMessage(item.message_id),
                    },
                ]);
            });
        }
        options.push('Cancel');
        handlers.push(() => { });
        if (react_native_1.Platform.OS === 'ios') {
            react_native_1.ActionSheetIOS.showActionSheetWithOptions({ options, cancelButtonIndex: options.length - 1, destructiveButtonIndex: options.indexOf('Delete') }, (idx) => {
                if (idx >= 0 && idx < handlers.length)
                    handlers[idx]();
            });
        }
        else {
            react_native_1.Alert.alert('Message', undefined, [
                ...options.slice(0, -1).map((label, i) => ({
                    text: label,
                    style: label === 'Delete' ? 'destructive' : 'default',
                    onPress: handlers[i],
                })),
                { text: 'Cancel', style: 'cancel' },
            ]);
        }
    };
    const renderMessageBody = (item) => {
        if (item.message_type === 'IMAGE' || item.message_type === 'FILE') {
            return ((0, jsx_runtime_1.jsx)(MessageMedia_1.MessageMedia, { message: item, onPress: (uri) => setLightboxUri(uri) }));
        }
        return (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: messagingStyles_1.messagingStyles.bubbleText, children: item.content });
    };
    const renderMessage = ({ item, index }) => {
        const own = isOwn(item);
        const showPicker = reactionTargetId === item.message_id;
        const showDate = (0, messagingHelpers_1.shouldShowDateSeparator)(messages, index);
        return ((0, jsx_runtime_1.jsxs)(react_native_1.View, { children: [showDate && ((0, jsx_runtime_1.jsx)(react_native_1.View, { style: messagingStyles_1.messagingStyles.dateSeparator, children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: messagingStyles_1.messagingStyles.dateSeparatorText, children: (0, messagingHelpers_1.formatDateSeparatorLabel)(item.created_at) }) })), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: own ? messagingStyles_1.messagingStyles.bubbleRowOwn : messagingStyles_1.messagingStyles.bubbleRowOther, children: [item.is_pinned && ((0, jsx_runtime_1.jsx)(MaterialIcons_1.default, { name: "push-pin", size: 12, color: theme_1.colors.text.tertiary, style: { marginBottom: 2 } })), !own && activeIsGroup && ((0, jsx_runtime_1.jsx)(react_native_1.Text, { style: messagingStyles_1.messagingStyles.senderName, children: (0, messaging_1.resolveMessageSenderDisplayName)(item, visibleContacts, contact?.contact_id) })), showPicker && ((0, jsx_runtime_1.jsx)(react_native_1.View, { style: messagingStyles_1.messagingStyles.reactionPicker, children: REACTION_EMOJIS.map((emoji) => ((0, jsx_runtime_1.jsx)(react_native_1.TouchableOpacity, { style: messagingStyles_1.messagingStyles.reactionEmojiBtn, onPress: () => {
                                    void toggleReaction(item.message_id, emoji);
                                    setReactionTargetId(null);
                                }, children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: { fontSize: 20 }, children: emoji }) }, emoji))) })), (0, jsx_runtime_1.jsx)(react_native_1.TouchableOpacity, { activeOpacity: 0.9, onLongPress: () => showMessageActions(item), delayLongPress: 280, children: (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: own ? messagingStyles_1.messagingStyles.bubbleOwn : messagingStyles_1.messagingStyles.bubbleOther, children: [renderMessageBody(item), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: messagingStyles_1.messagingStyles.bubbleMetaRow, children: [item.edited_at && ((0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [messagingStyles_1.messagingStyles.editedLabel, own && { color: 'rgba(255,255,255,0.6)' }], children: "edited" })), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: own ? messagingStyles_1.messagingStyles.bubbleTimeOwn : messagingStyles_1.messagingStyles.bubbleTime, children: (0, messagingHelpers_1.formatMessageTime)(item.created_at) }), own && !(0, messagingHelpers_1.isTempMessageId)(item.message_id) && ((0, jsx_runtime_1.jsx)(MaterialIcons_1.default, { name: isMessageRead(item) ? 'done-all' : 'done', size: 14, color: isMessageRead(item) ? theme_1.colors.success : 'rgba(255,255,255,0.55)' }))] })] }) }), item.reactions && item.reactions.length > 0 && ((0, jsx_runtime_1.jsx)(react_native_1.View, { style: messagingStyles_1.messagingStyles.reactionRow, children: item.reactions.map((r) => ((0, jsx_runtime_1.jsx)(react_native_1.TouchableOpacity, { style: [
                                    messagingStyles_1.messagingStyles.reactionChip,
                                    r.hasReacted && messagingStyles_1.messagingStyles.reactionChipActive,
                                ], onPress: () => void toggleReaction(item.message_id, r.emoji), children: (0, jsx_runtime_1.jsxs)(react_native_1.Text, { style: { fontSize: 13 }, children: [r.emoji, (r.count ?? 0) > 1 ? ` ${r.count}` : ''] }) }, r.emoji))) }))] })] }));
    };
    return ((0, jsx_runtime_1.jsxs)(react_native_1.KeyboardAvoidingView, { style: { flex: 1 }, behavior: react_native_1.Platform.OS === 'ios' ? 'padding' : undefined, keyboardVerticalOffset: 80, children: [(0, jsx_runtime_1.jsxs)(react_native_1.View, { style: messagingStyles_1.messagingStyles.chatHeader, children: [(0, jsx_runtime_1.jsx)(react_native_1.TouchableOpacity, { style: messagingStyles_1.messagingStyles.iconButton, onPress: goBackToInbox, children: (0, jsx_runtime_1.jsx)(MaterialIcons_1.default, { name: "arrow-back", size: 16, color: theme_1.colors.text.secondary }) }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [messagingStyles_1.messagingStyles.convName, { flex: 1 }], numberOfLines: 1, children: activeConversationName }), (0, jsx_runtime_1.jsx)(react_native_1.TouchableOpacity, { style: messagingStyles_1.messagingStyles.iconButton, onPress: openMessageSearch, children: (0, jsx_runtime_1.jsx)(MaterialIcons_1.default, { name: "search", size: 16, color: theme_1.colors.text.secondary }) }), activeConversationId && ((0, jsx_runtime_1.jsx)(react_native_1.TouchableOpacity, { style: messagingStyles_1.messagingStyles.iconButton, onPress: () => void toggleFavoriteConversation(activeConversationId), accessibilityLabel: isFavorited ? 'Remove from favorites' : 'Add to favorites', children: (0, jsx_runtime_1.jsx)(MaterialIcons_1.default, { name: isFavorited ? 'star' : 'star-outline', size: 16, color: isFavorited ? theme_1.colors.warning : theme_1.colors.text.secondary }) })), activeIsGroup && ((0, jsx_runtime_1.jsx)(react_native_1.TouchableOpacity, { style: messagingStyles_1.messagingStyles.iconButton, onPress: openGroupSettings, children: (0, jsx_runtime_1.jsx)(MaterialIcons_1.default, { name: "settings", size: 16, color: theme_1.colors.text.secondary }) }))] }), loadingMessages && messages.length === 0 ? ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: messagingStyles_1.messagingStyles.emptyState, children: [(0, jsx_runtime_1.jsx)(react_native_1.ActivityIndicator, { color: theme_1.colors.primary[500] }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: messagingStyles_1.messagingStyles.emptyText, children: "Loading messages\u2026" })] })) : ((0, jsx_runtime_1.jsx)(react_native_1.FlatList, { ref: listRef, data: messages, keyExtractor: (item) => item.message_id, renderItem: renderMessage, contentContainerStyle: messagingStyles_1.messagingStyles.messagesList, onScrollBeginDrag: () => setReactionTargetId(null), onContentSizeChange: () => listRef.current?.scrollToEnd({ animated: false }), ListHeaderComponent: messages.length >= 50 ? ((0, jsx_runtime_1.jsx)(react_native_1.TouchableOpacity, { onPress: () => void loadOlderMessages(), style: { alignSelf: 'center', marginBottom: 8 }, children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: messagingStyles_1.messagingStyles.linkText, children: "Load older messages" }) })) : null, ListEmptyComponent: (0, jsx_runtime_1.jsx)(react_native_1.View, { style: messagingStyles_1.messagingStyles.emptyState, children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: messagingStyles_1.messagingStyles.emptyText, children: "No messages yet. Say hello!" }) }) })), attachmentError ? ((0, jsx_runtime_1.jsx)(react_native_1.View, { style: messagingStyles_1.messagingStyles.pendingAttachRow, children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [messagingStyles_1.messagingStyles.emptyText, { color: theme_1.colors.error }], children: attachmentError }) })) : null, pendingFiles.length > 0 && ((0, jsx_runtime_1.jsx)(react_native_1.View, { style: messagingStyles_1.messagingStyles.pendingAttachRow, children: pendingFiles.map((f, i) => ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: messagingStyles_1.messagingStyles.pendingAttachChip, children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: messagingStyles_1.messagingStyles.convPreview, numberOfLines: 1, children: f.fileName }), (0, jsx_runtime_1.jsx)(react_native_1.TouchableOpacity, { onPress: () => setPendingFiles((prev) => prev.filter((_, idx) => idx !== i)), children: (0, jsx_runtime_1.jsx)(MaterialIcons_1.default, { name: "close", size: 16, color: theme_1.colors.text.secondary }) })] }, `${f.uri}-${i}`))) })), editingId && ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [messagingStyles_1.messagingStyles.pendingAttachRow, { justifyContent: 'space-between' }], children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: messagingStyles_1.messagingStyles.linkText, children: "Editing message" }), (0, jsx_runtime_1.jsx)(react_native_1.TouchableOpacity, { onPress: () => {
                            setEditingId(null);
                            setEditDraft('');
                        }, children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: messagingStyles_1.messagingStyles.convPreview, children: "Cancel" }) })] })), showAttachMenu && ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: messagingStyles_1.messagingStyles.attachMenu, children: [(0, jsx_runtime_1.jsxs)(react_native_1.TouchableOpacity, { style: messagingStyles_1.messagingStyles.attachMenuBtn, onPress: () => void runImagePick('camera'), disabled: pickingImage, children: [(0, jsx_runtime_1.jsx)(MaterialIcons_1.default, { name: "photo-camera", size: 24, color: theme_1.colors.primary[500] }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: messagingStyles_1.messagingStyles.attachMenuLabel, children: "Camera" })] }), (0, jsx_runtime_1.jsxs)(react_native_1.TouchableOpacity, { style: messagingStyles_1.messagingStyles.attachMenuBtn, onPress: () => void runImagePick('library'), disabled: pickingImage, children: [(0, jsx_runtime_1.jsx)(MaterialIcons_1.default, { name: "photo-library", size: 24, color: theme_1.colors.primary[500] }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: messagingStyles_1.messagingStyles.attachMenuLabel, children: "Library" })] }), (0, jsx_runtime_1.jsxs)(react_native_1.TouchableOpacity, { style: messagingStyles_1.messagingStyles.attachMenuBtn, onPress: () => void runImagePick('multi'), disabled: pickingImage, children: [(0, jsx_runtime_1.jsx)(MaterialIcons_1.default, { name: "collections", size: 24, color: theme_1.colors.primary[500] }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: messagingStyles_1.messagingStyles.attachMenuLabel, children: "Multi" })] }), (0, jsx_runtime_1.jsxs)(react_native_1.TouchableOpacity, { style: messagingStyles_1.messagingStyles.attachMenuBtn, onPress: () => setShowAttachMenu(false), children: [(0, jsx_runtime_1.jsx)(MaterialIcons_1.default, { name: "close", size: 24, color: theme_1.colors.text.secondary }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: messagingStyles_1.messagingStyles.attachMenuLabel, children: "Cancel" })] })] })), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: messagingStyles_1.messagingStyles.inputBar, children: [(0, jsx_runtime_1.jsx)(react_native_1.TouchableOpacity, { style: messagingStyles_1.messagingStyles.iconButton, onPress: () => {
                            setShowAttachMenu((v) => !v);
                            setReactionTargetId(null);
                        }, disabled: pickingImage || !activeConversationId, children: pickingImage ? ((0, jsx_runtime_1.jsx)(react_native_1.ActivityIndicator, { size: "small", color: theme_1.colors.primary[500] })) : ((0, jsx_runtime_1.jsx)(MaterialIcons_1.default, { name: "attach-file", size: 20, color: theme_1.colors.text.secondary })) }), (0, jsx_runtime_1.jsx)(react_native_1.TextInput, { style: messagingStyles_1.messagingStyles.textInput, placeholder: editingId ? 'Edit message…' : 'Type a message…', placeholderTextColor: theme_1.colors.text.tertiary, value: editingId ? editDraft : draft, onChangeText: editingId ? setEditDraft : setDraft, multiline: true }), (0, jsx_runtime_1.jsx)(react_native_1.TouchableOpacity, { style: [messagingStyles_1.messagingStyles.sendBtn, sending && { opacity: 0.5 }], onPress: () => void handleSend(), disabled: sending, children: (0, jsx_runtime_1.jsx)(MaterialIcons_1.default, { name: editingId ? 'check' : 'send', size: 20, color: theme_1.colors.white }) })] }), (0, jsx_runtime_1.jsx)(MessageImageLightbox_1.MessageImageLightbox, { uri: lightboxUri, onClose: () => setLightboxUri(null) })] }));
}
