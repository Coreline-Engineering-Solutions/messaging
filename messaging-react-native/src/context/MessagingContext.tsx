import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { DeviceEventEmitter } from 'react-native';
import {
    MESSAGING_OPEN_EVENT,
    MESSAGING_PANEL_HEIGHT_DEFAULT,
    MESSAGING_PANEL_HEIGHT_KEY,
} from '../constants/messagingConfig';
import {
    addReaction as addReactionApi,
    clearConversation as clearConversationApi,
    createConversation,
    deleteConversation as deleteConversationApi,
    deleteGroupConversation,
    deleteMessage as deleteMessageApi,
    editMessage as editMessageApi,
    getInbox,
    getMessages,
    getReactions,
    getThreadMessages,
    getVisibleContacts,
    manageGroup,
    markConversationRead,
    pinMessage as pinMessageApi,
    removeReaction as removeReactionApi,
    resolveContactByEmail,
    searchMessages as searchMessagesApi,
    sendDirectMessage,
    sendMessage as sendMessageApi,
    sendMessageWithAttachments,
    sendThreadReply,
    unpinMessage as unpinMessageApi,
    updatePresence,
} from '../services/messagingApiService';
import {
    loadFavoriteConversationIds,
    persistFavoriteConversationIds,
} from '../services/messagingFavoritesCache';
import {
    prewarmMessagingMediaCache,
    uploadMessagingImages,
} from '../services/messagingFileService';
import { playMessagingNotificationSound } from '../services/messagingNotificationSound';
import { messagingWebSocket } from '../services/messagingWebSocketService';
import type {
    Contact,
    GroupEditState,
    InboxItem,
    Message,
    MessageReaction,
    MessagingView,
    WebSocketMessage,
    WsStatus,
} from '../types/messaging';
import { getContactDisplayName, getInboxDisplayName } from '../types/messaging';
import {
    dedupeMessagesById,
    incrementInboxUnread,
    isTempMessageId,
    normalizeReactionRows,
    patchInboxPreview,
    resolveMessageFileId,
    tryMergeOwnEcho,
} from '../utils/messagingHelpers';

interface MessagingContextValue {
  isSessionActive: boolean;
  isReady: boolean;
  initError: string | null;
  /** Last attachment upload/send failure (cleared on next attempt). */
  attachmentError: string | null;
  contact: Contact | null;
  panelOpen: boolean;
  panelHeightRatio: number;
  activeView: MessagingView;
  inbox: InboxItem[];
  messages: Message[];
  visibleContacts: Contact[];
  activeConversationId: string | null;
  activeConversationName: string | null;
  activeIsGroup: boolean;
  groupEdit: GroupEditState | null;
  totalUnread: number;
  loadingMessages: boolean;
  wsStatus: WsStatus;
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  setPanelHeightRatio: (ratio: number) => void;
  setView: (view: MessagingView) => void;
  openConversation: (item: InboxItem) => void;
  openDirectConversation: (recipient: Contact) => void;
  openCreateGroup: () => void;
  openGroupSettings: () => void;
  clearGroupEdit: () => void;
  goBackToInbox: () => void;
  loadOlderMessages: () => Promise<void>;
  sendChatMessage: (content: string) => Promise<void>;
  sendChatImage: (uri: string, fileName: string) => Promise<void>;
  toggleReaction: (messageId: string, emoji: string) => Promise<void>;
  refreshInbox: () => Promise<void>;
  createGroup: (participantIds: string[], name: string) => Promise<void>;
  saveGroupEdit: (
    name: string,
    addIds: string[],
    removeIds: string[]
  ) => Promise<void>;
  deleteGroup: () => Promise<void>;
  clearConversation: (item: InboxItem) => Promise<void>;
  deleteConversationItem: (item: InboxItem) => Promise<void>;
  openMessageSearch: () => void;
  searchMessages: (query: string) => Promise<Message[]>;
  threadParent: Message | null;
  threadMessages: Message[];
  openThread: (message: Message) => Promise<void>;
  closeThread: () => void;
  sendThreadMessage: (content: string) => Promise<void>;
  editChatMessage: (messageId: string, content: string) => Promise<void>;
  deleteChatMessage: (messageId: string) => Promise<void>;
  togglePinMessage: (message: Message) => Promise<void>;
  sendChatAttachments: (files: { uri: string; fileName: string }[], caption?: string) => Promise<void>;
  favoriteConversationIds: ReadonlySet<string>;
  isFavoriteConversation: (conversationId: string) => boolean;
  toggleFavoriteConversation: (conversationId: string) => Promise<void>;
  /** `screen` = dedicated tab; `overlay` = bottom sheet (default). */
  presentation: 'overlay' | 'screen';
}

const MessagingContext = createContext<MessagingContextValue | null>(null);

export type MessagingPresentation = 'overlay' | 'screen';

export function MessagingProvider({
  children,
  sessionGid,
  userEmail,
  presentation = 'overlay',
}: {
  children: React.ReactNode;
  sessionGid: string | null;
  userEmail: string | null;
  presentation?: MessagingPresentation;
}) {
  const [contact, setContact] = useState<Contact | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [pendingPanelOpen, setPendingPanelOpen] = useState(false);
  const [panelHeightRatio, setPanelHeightRatioState] = useState(MESSAGING_PANEL_HEIGHT_DEFAULT);
  const [activeView, setActiveView] = useState<MessagingView>('inbox');
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [messagesMap, setMessagesMap] = useState<Record<string, Message[]>>({});
  const [visibleContacts, setVisibleContacts] = useState<Contact[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeConversationName, setActiveConversationName] = useState<string | null>(null);
  const [activeIsGroup, setActiveIsGroup] = useState(false);
  const [groupEdit, setGroupEdit] = useState<GroupEditState | null>(null);
  const [pendingRecipient, setPendingRecipient] = useState<Contact | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [wsStatus, setWsStatus] = useState<WsStatus>('disconnected');
  const [threadParent, setThreadParent] = useState<Message | null>(null);
  const [threadMessages, setThreadMessages] = useState<Message[]>([]);
  const [favoriteConversationIds, setFavoriteConversationIds] = useState<Set<string>>(new Set());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeConversationIdRef = useRef<string | null>(null);
  const panelOpenRef = useRef(false);
  const sessionGidRef = useRef(sessionGid);
  sessionGidRef.current = sessionGid;

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    panelOpenRef.current = panelOpen;
  }, [panelOpen]);

  const messages = activeConversationId ? messagesMap[activeConversationId] ?? [] : [];
  const totalUnread = useMemo(
    () => inbox.reduce((sum, item) => sum + (item.unread_count || 0), 0),
    [inbox]
  );
  const isSessionActive = !!sessionGid && !!userEmail;
  const isReady = !!contact && !!sessionGid;

  const persistPanelHeight = useCallback(async (ratio: number) => {
    setPanelHeightRatioState(ratio);
    try {
      await AsyncStorage.setItem(MESSAGING_PANEL_HEIGHT_KEY, String(ratio));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(MESSAGING_PANEL_HEIGHT_KEY).then((v) => {
      if (v) {
        const n = parseFloat(v);
        if (!Number.isNaN(n)) setPanelHeightRatioState(n);
      }
    });
  }, []);

  useEffect(() => {
    if (!contact?.contact_id) {
      setFavoriteConversationIds(new Set());
      return;
    }
    void loadFavoriteConversationIds(contact.contact_id).then((ids) => {
      setFavoriteConversationIds(new Set(ids));
    });
  }, [contact?.contact_id]);

  const isFavoriteConversation = useCallback(
    (conversationId: string) => favoriteConversationIds.has(conversationId),
    [favoriteConversationIds]
  );

  const toggleFavoriteConversation = useCallback(
    async (conversationId: string) => {
      if (!contact) return;
      setFavoriteConversationIds((prev) => {
        const next = new Set(prev);
        if (next.has(conversationId)) {
          next.delete(conversationId);
        } else {
          next.add(conversationId);
        }
        void persistFavoriteConversationIds(contact.contact_id, Array.from(next));
        return next;
      });
    },
    [contact]
  );

  const removeFavoriteConversation = useCallback(
    async (conversationId: string) => {
      if (!contact) return;
      setFavoriteConversationIds((prev) => {
        if (!prev.has(conversationId)) return prev;
        const next = new Set(prev);
        next.delete(conversationId);
        void persistFavoriteConversationIds(contact.contact_id, Array.from(next));
        return next;
      });
    },
    [contact]
  );

  const loadInbox = useCallback(async () => {
    if (!contact) return;
    const items = await getInbox(contact.contact_id);
    setInbox(items);
    messagingWebSocket.subscribeAll(items.map((i) => i.conversation_id));
  }, [contact]);

  const loadVisibleContacts = useCallback(async () => {
    if (!contact) return;
    const contacts = await getVisibleContacts(contact.contact_id);
    setVisibleContacts(contacts);
  }, [contact]);

  const hydrateReactionsForConversation = useCallback(
    async (conversationId: string, list: Message[]) => {
      if (!contact) return;
      const fetchable = list.filter((m) => !isTempMessageId(m.message_id));
      if (!fetchable.length) return;

      const results = await Promise.all(
        fetchable.map(async (m) => {
          try {
            const rows = await getReactions(m.message_id);
            return {
              messageId: m.message_id,
              reactions: normalizeReactionRows(rows, contact.contact_id, visibleContacts),
            };
          } catch {
            return { messageId: m.message_id, reactions: [] as MessageReaction[] };
          }
        })
      );

      setMessagesMap((prev) => {
        const current = [...(prev[conversationId] ?? [])];
        if (!current.length) return prev;
        let changed = false;
        for (const r of results) {
          const idx = current.findIndex((m) => m.message_id === r.messageId);
          if (idx === -1) continue;
          current[idx] = { ...current[idx], reactions: r.reactions };
          changed = true;
        }
        if (!changed) return prev;
        return { ...prev, [conversationId]: current };
      });
    },
    [contact, visibleContacts]
  );

  const loadMessagesFor = useCallback(
    async (conversationId: string, before?: string) => {
      if (!contact) return;
      setLoadingMessages(true);
      try {
        const batch = await getMessages(conversationId, contact.contact_id, before);
        let nextList: Message[] = [];
        setMessagesMap((prev) => {
          const existing = prev[conversationId] ?? [];
          const merged = before ? [...batch, ...existing] : batch;
          nextList = dedupeMessagesById(merged);
          return { ...prev, [conversationId]: nextList };
        });
        const fileIds = nextList
          .map((m) => resolveMessageFileId(m))
          .filter((id): id is string => !!id);
        prewarmMessagingMediaCache(fileIds);
        if (!before) void hydrateReactionsForConversation(conversationId, nextList);
      } finally {
        setLoadingMessages(false);
      }
    },
    [contact, hydrateReactionsForConversation]
  );

  const refreshMessageReactions = useCallback(
    async (messageId: string) => {
      if (!contact || isTempMessageId(messageId)) return;
      try {
        const rows = await getReactions(messageId);
        const reactions = normalizeReactionRows(rows, contact.contact_id, visibleContacts);
        setMessagesMap((prev) => {
          const next = { ...prev };
          for (const [convId, msgs] of Object.entries(next)) {
            const idx = msgs.findIndex((m) => m.message_id === messageId);
            if (idx === -1) continue;
            const updated = [...msgs];
            updated[idx] = { ...updated[idx], reactions };
            next[convId] = updated;
            break;
          }
          return next;
        });
      } catch {
        /* ignore */
      }
    },
    [contact, visibleContacts]
  );

  const handleWsMessage = useCallback(
    (msg: WebSocketMessage) => {
      if (msg.type === 'new_message') {
        const incoming = (msg.data ?? msg) as Message;
        const convId = incoming.conversation_id || msg.conversation_id;
        if (!convId || !contact) return;

        const myId = contact.contact_id;
        const activeId = activeConversationIdRef.current;
        const isActive = activeId === convId;

        setMessagesMap((prev) => {
          const list = prev[convId] ?? [];
          if (list.some((m) => m.message_id === incoming.message_id)) return prev;

          const merged = tryMergeOwnEcho(list, incoming, myId);
          if (merged) {
            return { ...prev, [convId]: merged };
          }

          return {
            ...prev,
            [convId]: dedupeMessagesById([...list, incoming]),
          };
        });

        setInbox((prev) => patchInboxPreview(prev, incoming));

        const fromOther = String(incoming.sender_id) !== String(myId);
        if (fromOther && !isActive) {
          setInbox((prev) => incrementInboxUnread(prev, convId));
          const shouldNotify =
            presentation === 'screen' || !panelOpenRef.current;
          if (shouldNotify) void playMessagingNotificationSound();
        }

        if (isActive && contact) {
          void markConversationRead(convId, contact.contact_id);
          setInbox((prev) =>
            prev.map((i) =>
              i.conversation_id === convId ? { ...i, unread_count: 0 } : i
            )
          );
        }

        void refreshMessageReactions(incoming.message_id);
        const fileId = resolveMessageFileId(incoming);
        if (fileId) prewarmMessagingMediaCache([fileId]);
      } else if (msg.type === 'conversation_updated' || msg.type === 'group_updated') {
        void loadInbox();
        const activeId = activeConversationIdRef.current;
        if (activeId) void loadMessagesFor(activeId);
      }
    },
    [contact, loadInbox, loadMessagesFor, presentation, refreshMessageReactions]
  );

  const initialize = useCallback(async () => {
    if (!sessionGid || !userEmail) return;
    setInitError(null);
    try {
      const resolved = await resolveContactByEmail(userEmail);
      if (!resolved) {
        setInitError('Messaging contact not found for your account.');
        return;
      }
      const withSession: Contact = { ...resolved, user_gid: sessionGid };
      setContact(withSession);
      messagingWebSocket.connect(resolved.contact_id, sessionGid);
      const items = await getInbox(resolved.contact_id);
      setInbox(items);
      messagingWebSocket.subscribeAll(items.map((i) => i.conversation_id));
      const contacts = await getVisibleContacts(resolved.contact_id);
      setVisibleContacts(contacts);
      void updatePresence(resolved.contact_id, 'online').catch(() => {});
    } catch (e) {
      setInitError(e instanceof Error ? e.message : 'Failed to initialize messaging.');
    }
  }, [sessionGid, userEmail]);

  useEffect(() => {
    if (sessionGid && userEmail) {
      void initialize();
    } else {
      setContact(null);
      messagingWebSocket.disconnect();
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [sessionGid, userEmail, initialize]);

  useEffect(() => {
    const unsubStatus = messagingWebSocket.onStatus(setWsStatus);
    const unsubMsg = messagingWebSocket.onMessage(handleWsMessage);
    return () => {
      unsubStatus();
      unsubMsg();
    };
  }, [handleWsMessage]);

  useEffect(() => {
    if (!contact) return;
    pollRef.current = setInterval(() => void loadInbox(), 30000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [contact, loadInbox]);

  const openPanel = useCallback(() => {
    setPanelOpen(true);
    if (!contact || !sessionGid) {
      setPendingPanelOpen(true);
    }
  }, [contact, sessionGid]);

  useEffect(() => {
    if (contact && sessionGid && pendingPanelOpen) {
      setPanelOpen(true);
      setPendingPanelOpen(false);
    }
  }, [contact, sessionGid, pendingPanelOpen]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(MESSAGING_OPEN_EVENT, () => {
      openPanel();
    });
    return () => sub.remove();
  }, [openPanel]);
  const closePanel = useCallback(() => {
    setActiveView('inbox');
    if (presentation === 'overlay') {
      setPanelOpen(false);
    }
  }, [presentation]);

  useEffect(() => {
    if (presentation === 'screen' && contact && sessionGid) {
      setPanelOpen(true);
    }
  }, [presentation, contact, sessionGid]);
  const togglePanel = useCallback(() => setPanelOpen((v) => !v), []);

  const goBackToInbox = useCallback(() => {
    setActiveView('inbox');
    setActiveConversationId(null);
    setActiveConversationName(null);
    setActiveIsGroup(false);
    setPendingRecipient(null);
    setThreadParent(null);
    setThreadMessages([]);
  }, []);

  const openConversation = useCallback(
    (item: InboxItem) => {
      setActiveConversationId(item.conversation_id);
      setActiveConversationName(getInboxDisplayName(item, visibleContacts));
      setActiveIsGroup(!!item.is_group);
      setActiveView('chat');
      messagingWebSocket.subscribe(item.conversation_id);
      void loadMessagesFor(item.conversation_id);
      if (contact) {
        void markConversationRead(item.conversation_id, contact.contact_id);
        setInbox((prev) =>
          prev.map((i) =>
            i.conversation_id === item.conversation_id ? { ...i, unread_count: 0 } : i
          )
        );
      }
    },
    [contact, loadMessagesFor, visibleContacts]
  );

  const openDirectConversation = useCallback((recipient: Contact) => {
    const existing = inbox.find(
      (i) =>
        !i.is_group &&
        (i.other_participant_id === recipient.contact_id ||
          i.name === recipient.email ||
          i.other_participant_name === recipient.username)
    );
    if (existing) {
      openConversation(existing);
      return;
    }
    setPendingRecipient(recipient);
    setActiveConversationId(null);
    setActiveView('chat');
    setActiveConversationName(
      recipient.username || recipient.first_name || recipient.email
    );
    setActiveIsGroup(false);
  }, [inbox, openConversation]);

  const sendChatMessage = useCallback(
    async (content: string) => {
      if (!contact || !content.trim()) return;
      const trimmed = content.trim();
      if (pendingRecipient && !activeConversationId) {
        const recipient = pendingRecipient;
        await sendDirectMessage(contact.contact_id, recipient.contact_id, trimmed);
        setPendingRecipient(null);
        await loadInbox();
        const refreshed = await getInbox(contact.contact_id);
        const match = refreshed.find(
          (i) =>
            !i.is_group &&
            (i.other_participant_id === recipient.contact_id ||
              i.other_participant_name === recipient.username)
        );
        if (match) {
          openConversation(match);
        }
        return;
      }
      if (activeConversationId) {
        const tempId = `temp-${Date.now()}`;
        const optimistic: Message = {
          message_id: tempId,
          conversation_id: activeConversationId,
          sender_id: contact.contact_id,
          sender_username: contact.username,
          sender_name: getContactDisplayName(contact),
          message_type: 'TEXT',
          content: trimmed,
          created_at: new Date().toISOString(),
        };
        setMessagesMap((prev) => ({
          ...prev,
          [activeConversationId]: [...(prev[activeConversationId] ?? []), optimistic],
        }));
        const res = await sendMessageApi(activeConversationId, contact.contact_id, trimmed);
        if (res.message_id) {
          setMessagesMap((prev) => {
            const list = prev[activeConversationId] ?? [];
            const idx = list.findIndex((m) => m.message_id === tempId);
            if (idx < 0) return prev;
            const next = [...list];
            next[idx] = { ...next[idx], message_id: res.message_id! };
            return { ...prev, [activeConversationId]: next };
          });
          void refreshMessageReactions(res.message_id);
        } else {
          await loadMessagesFor(activeConversationId);
        }
        setInbox((prev) =>
          patchInboxPreview(prev, {
            ...optimistic,
            message_id: res.message_id || tempId,
          })
        );
      }
    },
    [
      activeConversationId,
      contact,
      loadInbox,
      loadMessagesFor,
      openConversation,
      pendingRecipient,
      refreshMessageReactions,
    ]
  );

  const createGroup = useCallback(
    async (participantIds: string[], name: string) => {
      if (!contact) return;
      const created = await createConversation(contact.contact_id, participantIds, name);
      const items = await getInbox(contact.contact_id);
      setInbox(items);
      setGroupEdit(null);
      const match =
        items.find((i) => i.conversation_id === created.conversation_id) ||
        items.find(
          (i) => i.is_group && getInboxDisplayName(i, visibleContacts) === name.trim()
        );
      if (match) {
        openConversation(match);
      } else {
        setActiveView('inbox');
      }
    },
    [contact, openConversation, visibleContacts]
  );

  const openCreateGroup = useCallback(() => {
    setGroupEdit(null);
    setActiveView('group-manager');
  }, []);

  const openGroupSettings = useCallback(() => {
    if (!activeConversationId || !activeIsGroup) return;
    setGroupEdit({
      conversationId: activeConversationId,
      name: activeConversationName || 'Group',
    });
    setActiveView('group-manager');
  }, [activeConversationId, activeConversationName, activeIsGroup]);

  const clearGroupEdit = useCallback(() => setGroupEdit(null), []);

  const saveGroupEdit = useCallback(
    async (name: string, addIds: string[], removeIds: string[]) => {
      if (!contact || !groupEdit) return;
      const { conversationId } = groupEdit;
      if (name.trim() && name.trim() !== groupEdit.name) {
        await manageGroup(contact.contact_id, 'rename', conversationId, name.trim());
      }
      if (addIds.length > 0) {
        await manageGroup(contact.contact_id, 'add', conversationId, undefined, addIds);
      }
      for (const id of removeIds) {
        await manageGroup(contact.contact_id, 'remove', conversationId, undefined, [id]);
      }
      setActiveConversationName(name.trim() || groupEdit.name);
      setGroupEdit(null);
      await loadInbox();
      setActiveView('chat');
    },
    [contact, groupEdit, loadInbox]
  );

  const deleteGroup = useCallback(async () => {
    if (!contact || !groupEdit) return;
    await deleteGroupConversation(groupEdit.conversationId, contact.contact_id);
    setGroupEdit(null);
    setActiveConversationId(null);
    setActiveView('inbox');
    await loadInbox();
  }, [contact, groupEdit, loadInbox]);

  const updateMessageInMap = useCallback(
    (conversationId: string, messageId: string, updater: (m: Message) => Message) => {
      setMessagesMap((prev) => {
        const list = prev[conversationId] ?? [];
        return {
          ...prev,
          [conversationId]: list.map((m) =>
            m.message_id === messageId ? updater(m) : m
          ),
        };
      });
    },
    []
  );

  const toggleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      if (!contact || !activeConversationId) return;
      const msg = messagesMap[activeConversationId]?.find((m) => m.message_id === messageId);
      const existing = msg?.reactions?.find((r) => r.hasReacted && r.emoji !== emoji);
      if (existing) {
        updateMessageInMap(activeConversationId, messageId, (m) => ({
          ...m,
          reactions: applyReactionToggle(m.reactions, existing.emoji, false, contact.contact_id),
        }));
        await removeReactionApi(messageId, contact.contact_id, existing.emoji);
      }
      const already = msg?.reactions?.find((r) => r.emoji === emoji && r.hasReacted);
      if (already) {
        updateMessageInMap(activeConversationId, messageId, (m) => ({
          ...m,
          reactions: applyReactionToggle(m.reactions, emoji, false, contact.contact_id),
        }));
        await removeReactionApi(messageId, contact.contact_id, emoji);
        return;
      }
      updateMessageInMap(activeConversationId, messageId, (m) => ({
        ...m,
        reactions: applyReactionToggle(m.reactions, emoji, true, contact.contact_id),
      }));
      try {
        await addReactionApi(messageId, contact.contact_id, emoji);
      } catch {
        updateMessageInMap(activeConversationId, messageId, (m) => ({
          ...m,
          reactions: applyReactionToggle(m.reactions, emoji, false, contact.contact_id),
        }));
      }
    },
    [activeConversationId, contact, messagesMap, updateMessageInMap]
  );

  const sendChatAttachments = useCallback(
    async (files: { uri: string; fileName: string }[], caption = '') => {
      if (!contact || !activeConversationId || files.length === 0) return;
      const tempId = `temp-${Date.now()}`;
      setAttachmentError(null);
      const optimistic: Message = {
        message_id: tempId,
        conversation_id: activeConversationId,
        sender_id: contact.contact_id,
        sender_username: contact.username,
        sender_name: getContactDisplayName(contact),
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
        const uploaded = await uploadMessagingImages(files);
        const fileIds = uploaded.map((u) => u.file_id);
        const filenames = uploaded.map((u) => u.filename);
        const mimeTypes = uploaded.map((u) => u.mime_type || '');

        if (fileIds.some((id) => isTempMessageId(id))) {
          throw new Error('Upload not finished — cannot attach temp file.');
        }

        const isImg =
          (mimeTypes[0] || '').startsWith('image/') ||
          /\.(png|jpe?g|gif|webp|bmp|svg|heic|heif)$/i.test(filenames[0] || '');

        setMessagesMap((prev) => ({
          ...prev,
          [activeConversationId]: (prev[activeConversationId] ?? []).map((m) =>
            m.message_id === tempId
              ? {
                  ...m,
                  message_type: isImg ? 'IMAGE' : 'FILE',
                  attachments: fileIds.map((id, idx) => ({
                    file_id: id,
                    filename: filenames[idx] || filenames[0] || `Attachment ${idx + 1}`,
                    mime_type: mimeTypes[idx] || undefined,
                    url: uploaded[idx]?.url,
                  })),
                }
              : m
          ),
        }));

        prewarmMessagingMediaCache(fileIds);

        await sendMessageWithAttachments(
          activeConversationId,
          contact.contact_id,
          caption,
          fileIds,
          filenames,
          mimeTypes
        );
        await loadMessagesFor(activeConversationId);
        setInbox((prev) => patchInboxPreview(prev, optimistic));
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to send attachment';
        setAttachmentError(message);
        setMessagesMap((prev) => ({
          ...prev,
          [activeConversationId]: (prev[activeConversationId] ?? []).filter(
            (m) => m.message_id !== tempId
          ),
        }));
      }
    },
    [activeConversationId, contact, loadMessagesFor]
  );

  const sendChatImage = useCallback(
    async (uri: string, fileName: string) => {
      await sendChatAttachments([{ uri, fileName }]);
    },
    [sendChatAttachments]
  );

  const clearConversation = useCallback(
    async (item: InboxItem) => {
      if (!contact) return;
      await clearConversationApi(item.conversation_id, contact.contact_id);
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
    },
    [activeConversationId, contact, loadInbox]
  );

  const deleteConversationItem = useCallback(
    async (item: InboxItem) => {
      if (!contact) return;
      if (item.is_group) {
        await deleteGroupConversation(item.conversation_id, contact.contact_id);
      } else {
        await deleteConversationApi(item.conversation_id, contact.contact_id);
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
    },
    [activeConversationId, contact, loadInbox, removeFavoriteConversation]
  );

  const openMessageSearch = useCallback(() => setActiveView('message-search'), []);

  const searchMessages = useCallback(
    async (query: string) => {
      if (!contact || !query.trim()) return [];
      return searchMessagesApi(
        contact.contact_id,
        query.trim(),
        activeConversationId ?? undefined
      );
    },
    [activeConversationId, contact]
  );

  const openThread = useCallback(
    async (message: Message) => {
      if (!contact) return;
      setThreadParent(message);
      setActiveView('thread');
      const list = await getThreadMessages(message.message_id, contact.contact_id);
      setThreadMessages(dedupeMessagesById(list));
    },
    [contact]
  );

  const closeThread = useCallback(() => {
    setThreadParent(null);
    setThreadMessages([]);
    setActiveView('chat');
  }, []);

  const sendThreadMessage = useCallback(
    async (content: string) => {
      if (!contact || !threadParent || !content.trim()) return;
      await sendThreadReply(threadParent.message_id, contact.contact_id, content.trim());
      const list = await getThreadMessages(threadParent.message_id, contact.contact_id);
      setThreadMessages(dedupeMessagesById(list));
    },
    [contact, threadParent]
  );

  const editChatMessage = useCallback(
    async (messageId: string, content: string) => {
      if (!contact || !activeConversationId) return;
      await editMessageApi(messageId, contact.contact_id, content.trim());
      setMessagesMap((prev) => ({
        ...prev,
        [activeConversationId]: (prev[activeConversationId] ?? []).map((m) =>
          m.message_id === messageId
            ? { ...m, content: content.trim(), edited_at: new Date().toISOString() }
            : m
        ),
      }));
    },
    [activeConversationId, contact]
  );

  const deleteChatMessage = useCallback(
    async (messageId: string) => {
      if (!contact || !activeConversationId) return;
      await deleteMessageApi(messageId, contact.contact_id);
      setMessagesMap((prev) => ({
        ...prev,
        [activeConversationId]: (prev[activeConversationId] ?? []).filter(
          (m) => m.message_id !== messageId
        ),
      }));
    },
    [activeConversationId, contact]
  );

  const togglePinMessage = useCallback(
    async (message: Message) => {
      if (!contact || !activeConversationId) return;
      if (message.is_pinned) {
        await unpinMessageApi(message.message_id, contact.contact_id);
      } else {
        await pinMessageApi(message.message_id, activeConversationId, contact.contact_id);
      }
      setMessagesMap((prev) => ({
        ...prev,
        [activeConversationId]: (prev[activeConversationId] ?? []).map((m) =>
          m.message_id === message.message_id ? { ...m, is_pinned: !m.is_pinned } : m
        ),
      }));
    },
    [activeConversationId, contact]
  );

  const value = useMemo<MessagingContextValue>(
    () => ({
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
        if (!activeConversationId || messages.length === 0) return;
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
    }),
    [
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
    ]
  );

  return <MessagingContext.Provider value={value}>{children}</MessagingContext.Provider>;
}

function applyReactionToggle(
  reactions: MessageReaction[] | undefined,
  emoji: string,
  add: boolean,
  contactId: string
): MessageReaction[] {
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
    } else {
      list.push({ emoji, count: 1, hasReacted: true, contact_id: contactId });
    }
    return list;
  }
  if (idx < 0) return list;
  const nextCount = Math.max(0, (list[idx].count ?? 1) - 1);
  if (nextCount === 0) return list.filter((_, i) => i !== idx);
  list[idx] = { ...list[idx], count: nextCount, hasReacted: false };
  return list;
}

export function useMessaging(): MessagingContextValue {
  const ctx = useContext(MessagingContext);
  if (!ctx) throw new Error('useMessaging must be used within MessagingProvider');
  return ctx;
}

export function useMessagingOptional(): MessagingContextValue | null {
  return useContext(MessagingContext);
}

export function requestMessagingOpen(): void {
  DeviceEventEmitter.emit(MESSAGING_OPEN_EVENT);
}
