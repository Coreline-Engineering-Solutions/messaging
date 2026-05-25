"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessagingProvider = MessagingProvider;
exports.useMessaging = useMessaging;
exports.useMessagingOptional = useMessagingOptional;
exports.requestMessagingOpen = requestMessagingOpen;
const jsx_runtime_1 = require("react/jsx-runtime");
const async_storage_1 = __importDefault(require("@react-native-async-storage/async-storage"));
const react_1 = require("react");
const react_native_1 = require("react-native");
const messagingConfig_1 = require("../constants/messagingConfig");
const messagingApiService_1 = require("../services/messagingApiService");
const messagingFavoritesCache_1 = require("../services/messagingFavoritesCache");
const messagingFileService_1 = require("../services/messagingFileService");
const messagingNotificationSound_1 = require("../services/messagingNotificationSound");
const messagingWebSocketService_1 = require("../services/messagingWebSocketService");
const messaging_1 = require("../types/messaging");
const messagingHelpers_1 = require("../utils/messagingHelpers");
const MessagingContext = (0, react_1.createContext)(null);
function MessagingProvider({ children, sessionGid, userEmail, presentation = 'overlay', }) {
    const [contact, setContact] = (0, react_1.useState)(null);
    const [initError, setInitError] = (0, react_1.useState)(null);
    const [attachmentError, setAttachmentError] = (0, react_1.useState)(null);
    const [panelOpen, setPanelOpen] = (0, react_1.useState)(false);
    const [pendingPanelOpen, setPendingPanelOpen] = (0, react_1.useState)(false);
    const [panelHeightRatio, setPanelHeightRatioState] = (0, react_1.useState)(messagingConfig_1.MESSAGING_PANEL_HEIGHT_DEFAULT);
    const [activeView, setActiveView] = (0, react_1.useState)('inbox');
    const [inbox, setInbox] = (0, react_1.useState)([]);
    const [messagesMap, setMessagesMap] = (0, react_1.useState)({});
    const [visibleContacts, setVisibleContacts] = (0, react_1.useState)([]);
    const [activeConversationId, setActiveConversationId] = (0, react_1.useState)(null);
    const [activeConversationName, setActiveConversationName] = (0, react_1.useState)(null);
    const [activeIsGroup, setActiveIsGroup] = (0, react_1.useState)(false);
    const [groupEdit, setGroupEdit] = (0, react_1.useState)(null);
    const [pendingRecipient, setPendingRecipient] = (0, react_1.useState)(null);
    const [loadingMessages, setLoadingMessages] = (0, react_1.useState)(false);
    const [wsStatus, setWsStatus] = (0, react_1.useState)('disconnected');
    const [threadParent, setThreadParent] = (0, react_1.useState)(null);
    const [threadMessages, setThreadMessages] = (0, react_1.useState)([]);
    const [favoriteConversationIds, setFavoriteConversationIds] = (0, react_1.useState)(new Set());
    const pollRef = (0, react_1.useRef)(null);
    const activeConversationIdRef = (0, react_1.useRef)(null);
    const panelOpenRef = (0, react_1.useRef)(false);
    const sessionGidRef = (0, react_1.useRef)(sessionGid);
    sessionGidRef.current = sessionGid;
    (0, react_1.useEffect)(() => {
        activeConversationIdRef.current = activeConversationId;
    }, [activeConversationId]);
    (0, react_1.useEffect)(() => {
        panelOpenRef.current = panelOpen;
    }, [panelOpen]);
    const messages = activeConversationId ? messagesMap[activeConversationId] ?? [] : [];
    const totalUnread = (0, react_1.useMemo)(() => inbox.reduce((sum, item) => sum + (item.unread_count || 0), 0), [inbox]);
    const isSessionActive = !!sessionGid && !!userEmail;
    const isReady = !!contact && !!sessionGid;
    const persistPanelHeight = (0, react_1.useCallback)(async (ratio) => {
        setPanelHeightRatioState(ratio);
        try {
            await async_storage_1.default.setItem(messagingConfig_1.MESSAGING_PANEL_HEIGHT_KEY, String(ratio));
        }
        catch {
            /* ignore */
        }
    }, []);
    (0, react_1.useEffect)(() => {
        async_storage_1.default.getItem(messagingConfig_1.MESSAGING_PANEL_HEIGHT_KEY).then((v) => {
            if (v) {
                const n = parseFloat(v);
                if (!Number.isNaN(n))
                    setPanelHeightRatioState(n);
            }
        });
    }, []);
    (0, react_1.useEffect)(() => {
        if (!contact?.contact_id) {
            setFavoriteConversationIds(new Set());
            return;
        }
        void (0, messagingFavoritesCache_1.loadFavoriteConversationIds)(contact.contact_id).then((ids) => {
            setFavoriteConversationIds(new Set(ids));
        });
    }, [contact?.contact_id]);
    const isFavoriteConversation = (0, react_1.useCallback)((conversationId) => favoriteConversationIds.has(conversationId), [favoriteConversationIds]);
    const toggleFavoriteConversation = (0, react_1.useCallback)(async (conversationId) => {
        if (!contact)
            return;
        setFavoriteConversationIds((prev) => {
            const next = new Set(prev);
            if (next.has(conversationId)) {
                next.delete(conversationId);
            }
            else {
                next.add(conversationId);
            }
            void (0, messagingFavoritesCache_1.persistFavoriteConversationIds)(contact.contact_id, Array.from(next));
            return next;
        });
    }, [contact]);
    const removeFavoriteConversation = (0, react_1.useCallback)(async (conversationId) => {
        if (!contact)
            return;
        setFavoriteConversationIds((prev) => {
            if (!prev.has(conversationId))
                return prev;
            const next = new Set(prev);
            next.delete(conversationId);
            void (0, messagingFavoritesCache_1.persistFavoriteConversationIds)(contact.contact_id, Array.from(next));
            return next;
        });
    }, [contact]);
    const loadInbox = (0, react_1.useCallback)(async () => {
        if (!contact)
            return;
        const items = await (0, messagingApiService_1.getInbox)(contact.contact_id);
        setInbox(items);
        messagingWebSocketService_1.messagingWebSocket.subscribeAll(items.map((i) => i.conversation_id));
    }, [contact]);
    const loadVisibleContacts = (0, react_1.useCallback)(async () => {
        if (!contact)
            return;
        const contacts = await (0, messagingApiService_1.getVisibleContacts)(contact.contact_id);
        setVisibleContacts(contacts);
    }, [contact]);
    const hydrateReactionsForConversation = (0, react_1.useCallback)(async (conversationId, list) => {
        if (!contact)
            return;
        const fetchable = list.filter((m) => !(0, messagingHelpers_1.isTempMessageId)(m.message_id));
        if (!fetchable.length)
            return;
        const results = await Promise.all(fetchable.map(async (m) => {
            try {
                const rows = await (0, messagingApiService_1.getReactions)(m.message_id);
                return {
                    messageId: m.message_id,
                    reactions: (0, messagingHelpers_1.normalizeReactionRows)(rows, contact.contact_id, visibleContacts),
                };
            }
            catch {
                return { messageId: m.message_id, reactions: [] };
            }
        }));
        setMessagesMap((prev) => {
            const current = [...(prev[conversationId] ?? [])];
            if (!current.length)
                return prev;
            let changed = false;
            for (const r of results) {
                const idx = current.findIndex((m) => m.message_id === r.messageId);
                if (idx === -1)
                    continue;
                current[idx] = { ...current[idx], reactions: r.reactions };
                changed = true;
            }
            if (!changed)
                return prev;
            return { ...prev, [conversationId]: current };
        });
    }, [contact, visibleContacts]);
    const loadMessagesFor = (0, react_1.useCallback)(async (conversationId, before) => {
        if (!contact)
            return;
        setLoadingMessages(true);
        try {
            const batch = (await (0, messagingApiService_1.getMessages)(conversationId, contact.contact_id, before)).map((m) => (0, messagingHelpers_1.normalizeMessageFromApi)(m));
            let nextList = [];
            setMessagesMap((prev) => {
                const existing = prev[conversationId] ?? [];
                const merged = before ? [...batch, ...existing] : batch;
                nextList = (0, messagingHelpers_1.dedupeMessagesById)(merged);
                return { ...prev, [conversationId]: nextList };
            });
            const fileIds = nextList
                .map((m) => (0, messagingHelpers_1.resolveMessageFileId)(m))
                .filter((id) => !!id);
            (0, messagingFileService_1.prewarmMessagingMediaCache)(fileIds);
            if (!before)
                void hydrateReactionsForConversation(conversationId, nextList);
        }
        finally {
            setLoadingMessages(false);
        }
    }, [contact, hydrateReactionsForConversation]);
    const refreshMessageReactions = (0, react_1.useCallback)(async (messageId) => {
        if (!contact || (0, messagingHelpers_1.isTempMessageId)(messageId))
            return;
        try {
            const rows = await (0, messagingApiService_1.getReactions)(messageId);
            const reactions = (0, messagingHelpers_1.normalizeReactionRows)(rows, contact.contact_id, visibleContacts);
            setMessagesMap((prev) => {
                const next = { ...prev };
                for (const [convId, msgs] of Object.entries(next)) {
                    const idx = msgs.findIndex((m) => m.message_id === messageId);
                    if (idx === -1)
                        continue;
                    const updated = [...msgs];
                    updated[idx] = { ...updated[idx], reactions };
                    next[convId] = updated;
                    break;
                }
                return next;
            });
        }
        catch {
            /* ignore */
        }
    }, [contact, visibleContacts]);
    const handleWsMessage = (0, react_1.useCallback)((msg) => {
        if (msg.type === 'new_message') {
            const incoming = (0, messagingHelpers_1.normalizeMessageFromApi)((msg.data ?? msg));
            const convId = incoming.conversation_id || msg.conversation_id;
            if (!convId || !contact)
                return;
            const myId = contact.contact_id;
            const activeId = activeConversationIdRef.current;
            const isActive = activeId === convId;
            setMessagesMap((prev) => {
                const list = prev[convId] ?? [];
                if (list.some((m) => m.message_id === incoming.message_id))
                    return prev;
                const merged = (0, messagingHelpers_1.tryMergeOwnEcho)(list, incoming, myId);
                if (merged) {
                    return { ...prev, [convId]: merged };
                }
                return {
                    ...prev,
                    [convId]: (0, messagingHelpers_1.dedupeMessagesById)([...list, incoming]),
                };
            });
            setInbox((prev) => (0, messagingHelpers_1.patchInboxPreview)(prev, incoming));
            const fromOther = String(incoming.sender_id) !== String(myId);
            if (fromOther && !isActive) {
                setInbox((prev) => (0, messagingHelpers_1.incrementInboxUnread)(prev, convId));
                const shouldNotify = presentation === 'screen' || !panelOpenRef.current;
                if (shouldNotify)
                    void (0, messagingNotificationSound_1.playMessagingNotificationSound)();
            }
            if (isActive && contact) {
                void (0, messagingApiService_1.markConversationRead)(convId, contact.contact_id);
                setInbox((prev) => prev.map((i) => i.conversation_id === convId ? { ...i, unread_count: 0 } : i));
            }
            void refreshMessageReactions(incoming.message_id);
            const fileId = (0, messagingHelpers_1.resolveMessageFileId)(incoming);
            if (fileId)
                (0, messagingFileService_1.prewarmMessagingMediaCache)([fileId]);
        }
        else if (msg.type === 'conversation_updated' || msg.type === 'group_updated') {
            void loadInbox();
            const activeId = activeConversationIdRef.current;
            if (activeId)
                void loadMessagesFor(activeId);
        }
    }, [contact, loadInbox, loadMessagesFor, presentation, refreshMessageReactions]);
    const initialize = (0, react_1.useCallback)(async () => {
        if (!sessionGid || !userEmail)
            return;
        setInitError(null);
        try {
            const resolved = await (0, messagingApiService_1.resolveContactByEmail)(userEmail);
            if (!resolved) {
                setInitError('Messaging contact not found for your account.');
                return;
            }
            const withSession = { ...resolved, user_gid: sessionGid };
            setContact(withSession);
            messagingWebSocketService_1.messagingWebSocket.connect(resolved.contact_id, sessionGid);
            const items = await (0, messagingApiService_1.getInbox)(resolved.contact_id);
            setInbox(items);
            messagingWebSocketService_1.messagingWebSocket.subscribeAll(items.map((i) => i.conversation_id));
            const contacts = await (0, messagingApiService_1.getVisibleContacts)(resolved.contact_id);
            setVisibleContacts(contacts);
            void (0, messagingApiService_1.updatePresence)(resolved.contact_id, 'online').catch(() => { });
        }
        catch (e) {
            setInitError(e instanceof Error ? e.message : 'Failed to initialize messaging.');
        }
    }, [sessionGid, userEmail]);
    (0, react_1.useEffect)(() => {
        if (sessionGid && userEmail) {
            void initialize();
        }
        else {
            setContact(null);
            messagingWebSocketService_1.messagingWebSocket.disconnect();
        }
        return () => {
            if (pollRef.current)
                clearInterval(pollRef.current);
        };
    }, [sessionGid, userEmail, initialize]);
    (0, react_1.useEffect)(() => {
        const unsubStatus = messagingWebSocketService_1.messagingWebSocket.onStatus(setWsStatus);
        const unsubMsg = messagingWebSocketService_1.messagingWebSocket.onMessage(handleWsMessage);
        return () => {
            unsubStatus();
            unsubMsg();
        };
    }, [handleWsMessage]);
    (0, react_1.useEffect)(() => {
        if (!contact)
            return;
        pollRef.current = setInterval(() => void loadInbox(), 30000);
        return () => {
            if (pollRef.current)
                clearInterval(pollRef.current);
        };
    }, [contact, loadInbox]);
    const openPanel = (0, react_1.useCallback)(() => {
        setPanelOpen(true);
        if (!contact || !sessionGid) {
            setPendingPanelOpen(true);
        }
    }, [contact, sessionGid]);
    (0, react_1.useEffect)(() => {
        if (contact && sessionGid && pendingPanelOpen) {
            setPanelOpen(true);
            setPendingPanelOpen(false);
        }
    }, [contact, sessionGid, pendingPanelOpen]);
    (0, react_1.useEffect)(() => {
        const sub = react_native_1.DeviceEventEmitter.addListener(messagingConfig_1.MESSAGING_OPEN_EVENT, () => {
            openPanel();
        });
        return () => sub.remove();
    }, [openPanel]);
    const closePanel = (0, react_1.useCallback)(() => {
        setActiveView('inbox');
        if (presentation === 'overlay') {
            setPanelOpen(false);
        }
    }, [presentation]);
    (0, react_1.useEffect)(() => {
        if (presentation === 'screen' && contact && sessionGid) {
            setPanelOpen(true);
        }
    }, [presentation, contact, sessionGid]);
    const togglePanel = (0, react_1.useCallback)(() => setPanelOpen((v) => !v), []);
    const goBackToInbox = (0, react_1.useCallback)(() => {
        setActiveView('inbox');
        setActiveConversationId(null);
        setActiveConversationName(null);
        setActiveIsGroup(false);
        setPendingRecipient(null);
        setThreadParent(null);
        setThreadMessages([]);
    }, []);
    const openConversation = (0, react_1.useCallback)((item) => {
        setActiveConversationId(item.conversation_id);
        setActiveConversationName((0, messaging_1.getInboxDisplayName)(item, visibleContacts));
        setActiveIsGroup(!!item.is_group);
        setActiveView('chat');
        messagingWebSocketService_1.messagingWebSocket.subscribe(item.conversation_id);
        void loadMessagesFor(item.conversation_id);
        if (contact) {
            void (0, messagingApiService_1.markConversationRead)(item.conversation_id, contact.contact_id);
            setInbox((prev) => prev.map((i) => i.conversation_id === item.conversation_id ? { ...i, unread_count: 0 } : i));
        }
    }, [contact, loadMessagesFor, visibleContacts]);
    const openDirectConversation = (0, react_1.useCallback)((recipient) => {
        const existing = inbox.find((i) => !i.is_group &&
            (i.other_participant_id === recipient.contact_id ||
                i.name === recipient.email ||
                i.other_participant_name === recipient.username));
        if (existing) {
            openConversation(existing);
            return;
        }
        setPendingRecipient(recipient);
        setActiveConversationId(null);
        setActiveView('chat');
        setActiveConversationName(recipient.username || recipient.first_name || recipient.email);
        setActiveIsGroup(false);
    }, [inbox, openConversation]);
    const sendChatMessage = (0, react_1.useCallback)(async (content) => {
        if (!contact || !content.trim())
            return;
        const trimmed = content.trim();
        if (pendingRecipient && !activeConversationId) {
            const recipient = pendingRecipient;
            await (0, messagingApiService_1.sendDirectMessage)(contact.contact_id, recipient.contact_id, trimmed);
            setPendingRecipient(null);
            await loadInbox();
            const refreshed = await (0, messagingApiService_1.getInbox)(contact.contact_id);
            const match = refreshed.find((i) => !i.is_group &&
                (i.other_participant_id === recipient.contact_id ||
                    i.other_participant_name === recipient.username));
            if (match) {
                openConversation(match);
            }
            return;
        }
        if (activeConversationId) {
            const tempId = `temp-${Date.now()}`;
            const optimistic = {
                message_id: tempId,
                conversation_id: activeConversationId,
                sender_id: contact.contact_id,
                sender_username: contact.username,
                sender_name: (0, messaging_1.getContactDisplayName)(contact),
                message_type: 'TEXT',
                content: trimmed,
                created_at: new Date().toISOString(),
            };
            setMessagesMap((prev) => ({
                ...prev,
                [activeConversationId]: [...(prev[activeConversationId] ?? []), optimistic],
            }));
            const res = await (0, messagingApiService_1.sendMessage)(activeConversationId, contact.contact_id, trimmed);
            if (res.message_id) {
                setMessagesMap((prev) => {
                    const list = prev[activeConversationId] ?? [];
                    const idx = list.findIndex((m) => m.message_id === tempId);
                    if (idx < 0)
                        return prev;
                    const next = [...list];
                    next[idx] = { ...next[idx], message_id: res.message_id };
                    return { ...prev, [activeConversationId]: next };
                });
                void refreshMessageReactions(res.message_id);
            }
            else {
                await loadMessagesFor(activeConversationId);
            }
            setInbox((prev) => (0, messagingHelpers_1.patchInboxPreview)(prev, {
                ...optimistic,
                message_id: res.message_id || tempId,
            }));
        }
    }, [
        activeConversationId,
        contact,
        loadInbox,
        loadMessagesFor,
        openConversation,
        pendingRecipient,
        refreshMessageReactions,
    ]);
    const createGroup = (0, react_1.useCallback)(async (participantIds, name) => {
        if (!contact)
            return;
        const created = await (0, messagingApiService_1.createConversation)(contact.contact_id, participantIds, name);
        const items = await (0, messagingApiService_1.getInbox)(contact.contact_id);
        setInbox(items);
        setGroupEdit(null);
        const match = items.find((i) => i.conversation_id === created.conversation_id) ||
            items.find((i) => i.is_group && (0, messaging_1.getInboxDisplayName)(i, visibleContacts) === name.trim());
        if (match) {
            openConversation(match);
        }
        else {
            setActiveView('inbox');
        }
    }, [contact, openConversation, visibleContacts]);
    const openCreateGroup = (0, react_1.useCallback)(() => {
        setGroupEdit(null);
        setActiveView('group-manager');
    }, []);
    const openGroupSettings = (0, react_1.useCallback)(() => {
        if (!activeConversationId || !activeIsGroup)
            return;
        setGroupEdit({
            conversationId: activeConversationId,
            name: activeConversationName || 'Group',
        });
        setActiveView('group-manager');
    }, [activeConversationId, activeConversationName, activeIsGroup]);
    const clearGroupEdit = (0, react_1.useCallback)(() => setGroupEdit(null), []);
    const saveGroupEdit = (0, react_1.useCallback)(async (name, addIds, removeIds) => {
        if (!contact || !groupEdit)
            return;
        const { conversationId } = groupEdit;
        if (name.trim() && name.trim() !== groupEdit.name) {
            await (0, messagingApiService_1.manageGroup)(contact.contact_id, 'rename', conversationId, name.trim());
        }
        if (addIds.length > 0) {
            await (0, messagingApiService_1.manageGroup)(contact.contact_id, 'add', conversationId, undefined, addIds);
        }
        for (const id of removeIds) {
            await (0, messagingApiService_1.manageGroup)(contact.contact_id, 'remove', conversationId, undefined, [id]);
        }
        setActiveConversationName(name.trim() || groupEdit.name);
        setGroupEdit(null);
        await loadInbox();
        setActiveView('chat');
    }, [contact, groupEdit, loadInbox]);
    const deleteGroup = (0, react_1.useCallback)(async () => {
        if (!contact || !groupEdit)
            return;
        await (0, messagingApiService_1.deleteGroupConversation)(groupEdit.conversationId, contact.contact_id);
        setGroupEdit(null);
        setActiveConversationId(null);
        setActiveView('inbox');
        await loadInbox();
    }, [contact, groupEdit, loadInbox]);
    const updateMessageInMap = (0, react_1.useCallback)((conversationId, messageId, updater) => {
        setMessagesMap((prev) => {
            const list = prev[conversationId] ?? [];
            return {
                ...prev,
                [conversationId]: list.map((m) => m.message_id === messageId ? updater(m) : m),
            };
        });
    }, []);
    const toggleReaction = (0, react_1.useCallback)(async (messageId, emoji) => {
        if (!contact || !activeConversationId)
            return;
        const msg = messagesMap[activeConversationId]?.find((m) => m.message_id === messageId);
        const existing = msg?.reactions?.find((r) => r.hasReacted && r.emoji !== emoji);
        if (existing) {
            updateMessageInMap(activeConversationId, messageId, (m) => ({
                ...m,
                reactions: applyReactionToggle(m.reactions, existing.emoji, false, contact.contact_id),
            }));
            await (0, messagingApiService_1.removeReaction)(messageId, contact.contact_id, existing.emoji);
        }
        const already = msg?.reactions?.find((r) => r.emoji === emoji && r.hasReacted);
        if (already) {
            updateMessageInMap(activeConversationId, messageId, (m) => ({
                ...m,
                reactions: applyReactionToggle(m.reactions, emoji, false, contact.contact_id),
            }));
            await (0, messagingApiService_1.removeReaction)(messageId, contact.contact_id, emoji);
            return;
        }
        updateMessageInMap(activeConversationId, messageId, (m) => ({
            ...m,
            reactions: applyReactionToggle(m.reactions, emoji, true, contact.contact_id),
        }));
        try {
            await (0, messagingApiService_1.addReaction)(messageId, contact.contact_id, emoji);
        }
        catch {
            updateMessageInMap(activeConversationId, messageId, (m) => ({
                ...m,
                reactions: applyReactionToggle(m.reactions, emoji, false, contact.contact_id),
            }));
        }
    }, [activeConversationId, contact, messagesMap, updateMessageInMap]);
    const sendChatAttachments = (0, react_1.useCallback)(async (files, caption = '') => {
        if (!contact || !activeConversationId || files.length === 0)
            return;
        const tempId = `temp-${Date.now()}`;
        setAttachmentError(null);
        const optimistic = {
            message_id: tempId,
            conversation_id: activeConversationId,
            sender_id: contact.contact_id,
            sender_username: contact.username,
            sender_name: (0, messaging_1.getContactDisplayName)(contact),
            message_type: 'IMAGE',
            content: caption,
            local_image_uri: files[0].uri,
            created_at: new Date().toISOString(),
        };
        setMessagesMap((prev) => ({
            ...prev,
            [activeConversationId]: [...(prev[activeConversationId] ?? []), optimistic],
        }));
        try {
            let uploaded;
            try {
                uploaded = await (0, messagingFileService_1.uploadMessagingImages)(files);
            }
            catch (uploadErr) {
                const msg = uploadErr instanceof Error ? uploadErr.message : String(uploadErr);
                throw new Error(msg.startsWith('Upload') ? msg : `Upload failed: ${msg}`);
            }
            const fileIds = uploaded.map((u) => u.file_id);
            const filenames = uploaded.map((u) => u.filename);
            const mimeTypes = uploaded.map((u) => u.mime_type || '');
            if (fileIds.some((id) => (0, messagingHelpers_1.isTempMessageId)(id))) {
                throw new Error('Upload not finished — cannot attach temp file.');
            }
            const messageText = caption.trim() || filenames.filter(Boolean).join(', ') || 'Attachment';
            const isImg = (mimeTypes[0] || '').startsWith('image/') ||
                /\.(png|jpe?g|gif|webp|bmp|svg|heic|heif)$/i.test(filenames[0] || '');
            setMessagesMap((prev) => ({
                ...prev,
                [activeConversationId]: (prev[activeConversationId] ?? []).map((m) => m.message_id === tempId
                    ? {
                        ...m,
                        message_type: isImg ? 'IMAGE' : 'FILE',
                        content: messageText,
                        attachments: fileIds.map((id, idx) => ({
                            file_id: id,
                            filename: filenames[idx] || filenames[0] || `Attachment ${idx + 1}`,
                            mime_type: mimeTypes[idx] || undefined,
                            url: uploaded[idx]?.url,
                        })),
                    }
                    : m),
            }));
            (0, messagingFileService_1.prewarmMessagingMediaCache)(fileIds);
            await (0, messagingApiService_1.sendMessageWithAttachments)(activeConversationId, contact.contact_id, messageText, fileIds, filenames, mimeTypes);
            await loadMessagesFor(activeConversationId);
            setInbox((prev) => (0, messagingHelpers_1.patchInboxPreview)(prev, optimistic));
        }
        catch (e) {
            const message = e instanceof Error ? e.message : 'Failed to send attachment';
            setAttachmentError(message);
            setMessagesMap((prev) => ({
                ...prev,
                [activeConversationId]: (prev[activeConversationId] ?? []).filter((m) => m.message_id !== tempId),
            }));
        }
    }, [activeConversationId, contact, loadMessagesFor]);
    const sendChatImage = (0, react_1.useCallback)(async (uri, fileName) => {
        await sendChatAttachments([{ uri, fileName }]);
    }, [sendChatAttachments]);
    const clearConversation = (0, react_1.useCallback)(async (item) => {
        if (!contact)
            return;
        await (0, messagingApiService_1.clearConversation)(item.conversation_id, contact.contact_id);
        setMessagesMap((prev) => {
            const next = { ...prev };
            delete next[item.conversation_id];
            return next;
        });
        if (activeConversationId === item.conversation_id) {
            setActiveConversationId(null);
            setActiveView('inbox');
        }
        await loadInbox();
    }, [activeConversationId, contact, loadInbox]);
    const deleteConversationItem = (0, react_1.useCallback)(async (item) => {
        if (!contact)
            return;
        if (item.is_group) {
            await (0, messagingApiService_1.deleteGroupConversation)(item.conversation_id, contact.contact_id);
        }
        else {
            await (0, messagingApiService_1.deleteConversation)(item.conversation_id, contact.contact_id);
        }
        setMessagesMap((prev) => {
            const next = { ...prev };
            delete next[item.conversation_id];
            return next;
        });
        if (activeConversationId === item.conversation_id) {
            setActiveConversationId(null);
            setActiveView('inbox');
        }
        await removeFavoriteConversation(item.conversation_id);
        await loadInbox();
    }, [activeConversationId, contact, loadInbox, removeFavoriteConversation]);
    const openMessageSearch = (0, react_1.useCallback)(() => setActiveView('message-search'), []);
    const searchMessages = (0, react_1.useCallback)(async (query) => {
        if (!contact || !query.trim())
            return [];
        return (0, messagingApiService_1.searchMessages)(contact.contact_id, query.trim(), activeConversationId ?? undefined);
    }, [activeConversationId, contact]);
    const openThread = (0, react_1.useCallback)(async (message) => {
        if (!contact)
            return;
        setThreadParent(message);
        setActiveView('thread');
        const list = await (0, messagingApiService_1.getThreadMessages)(message.message_id, contact.contact_id);
        setThreadMessages((0, messagingHelpers_1.dedupeMessagesById)(list));
    }, [contact]);
    const closeThread = (0, react_1.useCallback)(() => {
        setThreadParent(null);
        setThreadMessages([]);
        setActiveView('chat');
    }, []);
    const sendThreadMessage = (0, react_1.useCallback)(async (content) => {
        if (!contact || !threadParent || !content.trim())
            return;
        await (0, messagingApiService_1.sendThreadReply)(threadParent.message_id, contact.contact_id, content.trim());
        const list = await (0, messagingApiService_1.getThreadMessages)(threadParent.message_id, contact.contact_id);
        setThreadMessages((0, messagingHelpers_1.dedupeMessagesById)(list));
    }, [contact, threadParent]);
    const editChatMessage = (0, react_1.useCallback)(async (messageId, content) => {
        if (!contact || !activeConversationId)
            return;
        await (0, messagingApiService_1.editMessage)(messageId, contact.contact_id, content.trim());
        setMessagesMap((prev) => ({
            ...prev,
            [activeConversationId]: (prev[activeConversationId] ?? []).map((m) => m.message_id === messageId
                ? { ...m, content: content.trim(), edited_at: new Date().toISOString() }
                : m),
        }));
    }, [activeConversationId, contact]);
    const deleteChatMessage = (0, react_1.useCallback)(async (messageId) => {
        if (!contact || !activeConversationId)
            return;
        await (0, messagingApiService_1.deleteMessage)(messageId, contact.contact_id);
        setMessagesMap((prev) => ({
            ...prev,
            [activeConversationId]: (prev[activeConversationId] ?? []).filter((m) => m.message_id !== messageId),
        }));
    }, [activeConversationId, contact]);
    const togglePinMessage = (0, react_1.useCallback)(async (message) => {
        if (!contact || !activeConversationId)
            return;
        if (message.is_pinned) {
            await (0, messagingApiService_1.unpinMessage)(message.message_id, contact.contact_id);
        }
        else {
            await (0, messagingApiService_1.pinMessage)(message.message_id, activeConversationId, contact.contact_id);
        }
        setMessagesMap((prev) => ({
            ...prev,
            [activeConversationId]: (prev[activeConversationId] ?? []).map((m) => m.message_id === message.message_id ? { ...m, is_pinned: !m.is_pinned } : m),
        }));
    }, [activeConversationId, contact]);
    const value = (0, react_1.useMemo)(() => ({
        isSessionActive,
        isReady,
        initError,
        attachmentError,
        contact,
        panelOpen,
        panelHeightRatio,
        activeView,
        inbox,
        messages,
        visibleContacts,
        activeConversationId,
        activeConversationName,
        activeIsGroup,
        groupEdit,
        totalUnread,
        loadingMessages,
        wsStatus,
        openPanel,
        closePanel,
        togglePanel,
        setPanelHeightRatio: persistPanelHeight,
        setView: setActiveView,
        openConversation,
        openDirectConversation,
        openCreateGroup,
        openGroupSettings,
        clearGroupEdit,
        goBackToInbox,
        loadOlderMessages: async () => {
            if (!activeConversationId || messages.length === 0)
                return;
            await loadMessagesFor(activeConversationId, messages[0].message_id);
        },
        sendChatMessage,
        sendChatImage,
        sendChatAttachments,
        toggleReaction,
        refreshInbox: loadInbox,
        createGroup,
        saveGroupEdit,
        deleteGroup,
        clearConversation,
        deleteConversationItem,
        openMessageSearch,
        searchMessages,
        threadParent,
        threadMessages,
        openThread,
        closeThread,
        sendThreadMessage,
        editChatMessage,
        deleteChatMessage,
        togglePinMessage,
        favoriteConversationIds,
        isFavoriteConversation,
        toggleFavoriteConversation,
        presentation,
    }), [
        presentation,
        isSessionActive,
        isReady,
        initError,
        attachmentError,
        contact,
        panelOpen,
        panelHeightRatio,
        activeView,
        inbox,
        messages,
        visibleContacts,
        activeConversationId,
        activeConversationName,
        activeIsGroup,
        groupEdit,
        totalUnread,
        loadingMessages,
        wsStatus,
        openPanel,
        closePanel,
        togglePanel,
        persistPanelHeight,
        openConversation,
        openDirectConversation,
        openCreateGroup,
        openGroupSettings,
        clearGroupEdit,
        goBackToInbox,
        loadMessagesFor,
        sendChatMessage,
        sendChatImage,
        sendChatAttachments,
        toggleReaction,
        loadInbox,
        createGroup,
        saveGroupEdit,
        deleteGroup,
        clearConversation,
        deleteConversationItem,
        openMessageSearch,
        searchMessages,
        threadParent,
        threadMessages,
        openThread,
        closeThread,
        sendThreadMessage,
        editChatMessage,
        deleteChatMessage,
        togglePinMessage,
        favoriteConversationIds,
        isFavoriteConversation,
        toggleFavoriteConversation,
    ]);
    return (0, jsx_runtime_1.jsx)(MessagingContext.Provider, { value: value, children: children });
}
function applyReactionToggle(reactions, emoji, add, contactId) {
    const list = [...(reactions ?? [])];
    const idx = list.findIndex((r) => r.emoji === emoji);
    if (add) {
        if (idx >= 0) {
            list[idx] = {
                ...list[idx],
                count: (list[idx].count ?? 0) + 1,
                hasReacted: true,
                contact_id: contactId,
            };
        }
        else {
            list.push({ emoji, count: 1, hasReacted: true, contact_id: contactId });
        }
        return list;
    }
    if (idx < 0)
        return list;
    const nextCount = Math.max(0, (list[idx].count ?? 1) - 1);
    if (nextCount === 0)
        return list.filter((_, i) => i !== idx);
    list[idx] = { ...list[idx], count: nextCount, hasReacted: false };
    return list;
}
function useMessaging() {
    const ctx = (0, react_1.useContext)(MessagingContext);
    if (!ctx)
        throw new Error('useMessaging must be used within MessagingProvider');
    return ctx;
}
function useMessagingOptional() {
    return (0, react_1.useContext)(MessagingContext);
}
function requestMessagingOpen() {
    react_native_1.DeviceEventEmitter.emit(messagingConfig_1.MESSAGING_OPEN_EVENT);
}
