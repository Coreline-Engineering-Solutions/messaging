import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject, forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { getContactDisplayName, } from '../models/messaging.models';
import * as i0 from "@angular/core";
import * as i1 from "./auth.service";
import * as i2 from "./messaging-api.service";
import * as i3 from "./messaging-websocket.service";
export class MessagingStoreService {
    auth;
    api;
    wsService;
    // ── State subjects ──
    inbox$ = new BehaviorSubject([]);
    messagesMap$ = new BehaviorSubject(new Map());
    openChats$ = new BehaviorSubject([]);
    visibleContacts$ = new BehaviorSubject([]);
    panelOpen$ = new BehaviorSubject(false);
    activeView$ = new BehaviorSubject('inbox');
    sidebarSide$ = new BehaviorSubject(localStorage.getItem('messaging_sidebar_side') || 'right');
    activeConversationId$ = new BehaviorSubject(null);
    pendingDmRecipient$ = new BehaviorSubject(null);
    totalUnread$ = new BehaviorSubject(0);
    loadingMessages$ = new BehaviorSubject(false);
    panelPosition$ = new BehaviorSubject(null);
    panelSize$ = new BehaviorSubject({ width: 380, height: 560 });
    wasOpenBeforeDrag$ = new BehaviorSubject(false);
    // ── Public observables ──
    inbox = this.inbox$.asObservable();
    messagesMap = this.messagesMap$.asObservable();
    openChats = this.openChats$.asObservable();
    visibleContacts = this.visibleContacts$.asObservable();
    panelOpen = this.panelOpen$.asObservable();
    activeView = this.activeView$.asObservable();
    activeConversationId = this.activeConversationId$.asObservable();
    totalUnread = this.totalUnread$.asObservable();
    loadingMessages = this.loadingMessages$.asObservable();
    wsStatus = new Observable();
    panelPosition = this.panelPosition$.asObservable();
    panelSize = this.panelSize$.asObservable();
    wasOpenBeforeDrag = this.wasOpenBeforeDrag$.asObservable();
    sidebarSide = this.sidebarSide$.asObservable();
    wsSub = null;
    destroy$ = new Subject();
    pollTimer = null;
    groupSettings$ = new BehaviorSubject(null);
    groupSettings = this.groupSettings$.asObservable();
    constructor(auth, api, wsService) {
        this.auth = auth;
        this.api = api;
        this.wsService = wsService;
        this.wsStatus = this.wsService.status$;
    }
    // ── Initialization ──
    initialize() {
        if (!this.auth.isAuthenticated())
            return;
        const contactId = this.auth.contactId;
        const sessionGid = this.auth.sessionGid;
        this.loadInbox();
        this.loadVisibleContacts();
        this.wsService.connect(contactId, sessionGid);
        this.listenWebSocket();
        this.startPolling();
    }
    teardown() {
        this.stopPolling();
        this.wsService.disconnect();
        this.wsSub?.unsubscribe();
        this.inbox$.next([]);
        this.messagesMap$.next(new Map());
        this.openChats$.next([]);
        this.panelOpen$.next(false);
        this.activeView$.next('inbox');
        this.activeConversationId$.next(null);
        this.totalUnread$.next(0);
    }
    // ── Polling fallback (inbox only - messages rely on WebSocket) ──
    startPolling() {
        this.stopPolling();
        this.pollTimer = setInterval(() => {
            this.loadInbox();
        }, 30000);
    }
    stopPolling() {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
    }
    ngOnDestroy() {
        this.teardown();
        this.destroy$.next();
        this.destroy$.complete();
    }
    // ── Panel controls ──
    togglePanel(buttonX, buttonY) {
        if (buttonX !== undefined && buttonY !== undefined) {
            this.panelPosition$.next({ x: buttonX, y: buttonY });
        }
        this.panelOpen$.next(!this.panelOpen$.value);
    }
    openPanel(buttonX, buttonY) {
        if (buttonX !== undefined && buttonY !== undefined) {
            this.panelPosition$.next({ x: buttonX, y: buttonY });
        }
        this.panelOpen$.next(true);
    }
    closePanel() {
        this.panelOpen$.next(false);
    }
    setPanelSize(width, height) {
        this.panelSize$.next({ width, height });
        localStorage.setItem('messaging_panel_size', JSON.stringify({ width, height }));
    }
    getPanelSize() {
        const saved = localStorage.getItem('messaging_panel_size');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed.width && parsed.height) {
                    this.panelSize$.next(parsed);
                    return parsed;
                }
            }
            catch { }
        }
        return this.panelSize$.value;
    }
    onButtonDragStart() {
        this.wasOpenBeforeDrag$.next(this.panelOpen$.value);
        if (this.panelOpen$.value) {
            this.panelOpen$.next(false);
        }
    }
    onButtonDragEnd(buttonX, buttonY) {
        if (this.wasOpenBeforeDrag$.value) {
            this.openPanel(buttonX, buttonY);
        }
    }
    setView(view) {
        this.activeView$.next(view);
    }
    toggleSidebarSide() {
        const next = this.sidebarSide$.value === 'right' ? 'left' : 'right';
        this.sidebarSide$.next(next);
        localStorage.setItem('messaging_sidebar_side', next);
    }
    getSidebarSide() {
        return this.sidebarSide$.value;
    }
    // ── Inbox ──
    loadInbox() {
        const contactId = this.auth.contactId;
        if (!contactId)
            return;
        this.api.getInbox(contactId).subscribe({
            next: (items) => {
                const mapped = items.map(item => {
                    const isGroup = item.is_group === true || item.is_group === 'True';
                    if (!isGroup && !item.name && item.other_participant_name) {
                        return { ...item, name: item.other_participant_name, is_group: false };
                    }
                    return { ...item, is_group: isGroup };
                });
                this.inbox$.next(mapped);
                this.recalcUnread(mapped);
                const ids = mapped.map((i) => i.conversation_id);
                this.wsService.subscribeAll(ids);
            },
            error: () => { },
        });
    }
    // ── Contacts ──
    loadVisibleContacts() {
        const contactId = this.auth.contactId;
        if (!contactId)
            return;
        this.api.getVisibleContacts(contactId).subscribe({
            next: (contacts) => {
                this.visibleContacts$.next(contacts);
                const currentContact = this.auth.currentContact;
                if (currentContact && currentContact.email) {
                    const match = contacts.find(c => c.email === currentContact.email);
                    if (match &&
                        String(match.contact_id) !== String(currentContact.contact_id)) {
                        this.auth.setSession(this.auth.sessionGid, { ...currentContact, contact_id: match.contact_id });
                        this.wsService.disconnect();
                        this.wsService.connect(match.contact_id, this.auth.sessionGid);
                    }
                }
            },
            error: () => { },
        });
    }
    // ── Conversations ──
    openConversation(conversationId, name, isGroup = false) {
        if (!conversationId || conversationId === 'undefined') {
            return;
        }
        this.activeConversationId$.next(conversationId);
        this.activeView$.next('chat');
        this.openPanel();
        const chats = this.openChats$.value;
        if (!chats.find((c) => c.conversationId === conversationId)) {
            this.openChats$.next([
                ...chats,
                { conversationId, name, isGroup, isMinimized: false, unreadCount: 0 },
            ]);
        }
        const existing = this.messagesMap$.value.get(conversationId);
        if (existing && existing.length > 0) {
            // Already cached — silent background refresh for new messages, skip reaction hydration
            this.loadMessages(conversationId, undefined, true);
        }
        else {
            this.loadMessages(conversationId);
        }
        this.markAsRead(conversationId);
        this.wsService.subscribe(conversationId);
    }
    closeChat(conversationId) {
        const chats = this.openChats$.value.filter((c) => c.conversationId !== conversationId);
        this.openChats$.next(chats);
        if (this.activeConversationId$.value === conversationId) {
            this.activeConversationId$.next(null);
            this.activeView$.next('inbox');
        }
    }
    // ── Messages ──
    loadMessages(conversationId, beforeMessageId, skipReactionHydration = false) {
        if (!conversationId || conversationId === 'undefined') {
            return;
        }
        const contactId = this.auth.contactId;
        if (!contactId)
            return;
        this.loadingMessages$.next(true);
        this.api.getMessages(conversationId, contactId, beforeMessageId, 50).subscribe({
            next: (messages) => {
                const map = new Map(this.messagesMap$.value);
                const existing = map.get(conversationId) || [];
                const normalized = messages.map((m) => this.normalizeMessageShape(m));
                const sorted = [...normalized].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                if (beforeMessageId) {
                    // Prepend older messages, preserving existing reactions
                    const merged = [...sorted, ...existing];
                    map.set(conversationId, merged);
                }
                else if (skipReactionHydration) {
                    // Silent refresh — merge new messages but preserve existing reaction state
                    const existingById = new Map(existing.map(m => [String(m.message_id), m]));
                    const merged = sorted.map(m => {
                        const cached = existingById.get(String(m.message_id));
                        return cached ? { ...m, reactions: cached.reactions } : m;
                    });
                    map.set(conversationId, merged);
                }
                else {
                    map.set(conversationId, sorted);
                }
                this.messagesMap$.next(map);
                if (!skipReactionHydration) {
                    this.hydrateReactionsForConversation(conversationId, map.get(conversationId) || []);
                }
                this.loadingMessages$.next(false);
            },
            error: () => {
                this.loadingMessages$.next(false);
            },
        });
    }
    sendMessage(conversationId, content, messageType = 'TEXT') {
        const contactId = this.auth.contactId;
        if (!contactId)
            return;
        const pending = this.pendingDmRecipient$.value;
        if (!conversationId && pending) {
            this.sendDirectMessage(pending.contactId, content);
            this.pendingDmRecipient$.next(null);
            const chats = this.openChats$.value.filter(c => c.conversationId !== 'pending');
            this.openChats$.next(chats);
            return;
        }
        if (!conversationId)
            return;
        const tempMessageId = 'temp-' + Date.now();
        const optimistic = {
            message_id: tempMessageId,
            conversation_id: conversationId,
            sender_id: contactId,
            sender_name: 'You',
            message_type: messageType,
            content,
            created_at: new Date().toISOString(),
            is_read: true,
        };
        this.appendMessage(optimistic);
        this.api.sendMessage(conversationId, contactId, content, messageType).subscribe({
            next: (res) => {
                const realId = res?.message_id ?? res?.id ?? res?.messageId;
                if (realId == null || String(realId).startsWith('temp-')) {
                    return;
                }
                const merged = this.normalizeMessageShape({
                    ...optimistic,
                    ...res,
                    message_id: String(realId),
                    conversation_id: conversationId,
                });
                const map = new Map(this.messagesMap$.value);
                const msgs = [...(map.get(conversationId) || [])];
                const idx = msgs.findIndex((m) => m.message_id === tempMessageId);
                if (idx >= 0) {
                    msgs[idx] = merged;
                    map.set(conversationId, msgs);
                    this.messagesMap$.next(map);
                    this.refreshMessageReactions(merged.message_id);
                }
            },
            error: () => { },
        });
    }
    openDirectConversation(recipientContactId, displayName) {
        const existing = this.inbox$.value.find(item => !item.is_group && item.name === displayName);
        if (existing) {
            this.pendingDmRecipient$.next(null);
            this.openConversation(existing.conversation_id, displayName, false);
        }
        else {
            this.pendingDmRecipient$.next({ contactId: recipientContactId, name: displayName });
            this.activeConversationId$.next(null);
            this.activeView$.next('chat');
            this.openPanel();
            const chats = this.openChats$.value;
            if (!chats.find(c => c.conversationId === 'pending')) {
                this.openChats$.next([...chats, {
                        conversationId: 'pending',
                        name: displayName,
                        isGroup: false,
                        isMinimized: false,
                        unreadCount: 0
                    }]);
            }
        }
    }
    sendDirectMessage(recipientContactId, content) {
        const contactId = this.auth.contactId;
        if (!contactId)
            return;
        this.api.sendDirectMessage(contactId, recipientContactId, content).subscribe({
            next: (res) => {
                this.loadInbox();
                // Backend may return conversation_id, id, or conversationId
                const convId = String(res?.conversation_id || res?.id || res?.conversationId || '');
                if (convId) {
                    const recipient = this.visibleContacts$.value.find((c) => c.contact_id === recipientContactId);
                    const name = recipient ? getContactDisplayName(recipient) : 'Direct Message';
                    this.openConversation(convId, name, false);
                }
            },
            error: () => { },
        });
    }
    createGroupConversation(participantIds, name) {
        const contactId = this.auth.contactId;
        if (!contactId)
            return;
        const allParticipants = participantIds.includes(contactId)
            ? participantIds
            : [contactId, ...participantIds];
        this.api.createConversation(contactId, allParticipants, name).subscribe({
            next: (conv) => {
                // Backend may return conversation_id, id, or conversationId
                const convId = String(conv?.conversation_id || conv?.id || conv?.conversationId || '');
                if (!convId) {
                    this.loadInbox();
                    return;
                }
                this.loadInbox();
                this.openConversation(convId, name, true);
            },
            error: () => { },
        });
    }
    openGroupSettings(conversationId, name) {
        this.groupSettings$.next({ conversationId, name });
        this.setView('group-manager');
    }
    clearGroupSettings() {
        this.groupSettings$.next(null);
    }
    markAsRead(conversationId) {
        if (!conversationId || conversationId === 'undefined')
            return;
        const contactId = this.auth.contactId;
        if (!contactId)
            return;
        this.api.markConversationRead(conversationId, contactId).subscribe({
            next: () => {
                const items = this.inbox$.value.map((item) => item.conversation_id === conversationId ? { ...item, unread_count: 0 } : item);
                this.inbox$.next(items);
                this.recalcUnread(items);
            },
            error: () => { },
        });
    }
    // ── Group management ──
    manageGroup(action, conversationId, groupName, participantContactIds) {
        const contactId = this.auth.contactId;
        if (!contactId)
            return;
        this.api.manageGroup(contactId, action, conversationId, groupName, participantContactIds).subscribe({
            next: () => this.loadInbox(),
            error: () => { },
        });
    }
    // ── Delete / Clear ──
    deleteConversation(conversationId) {
        const contactId = this.auth.contactId;
        if (!contactId)
            return;
        this.api.deleteConversation(conversationId, contactId).subscribe({
            next: () => {
                const items = this.inbox$.value.filter(i => i.conversation_id !== conversationId);
                this.inbox$.next(items);
                this.recalcUnread(items);
                const map = new Map(this.messagesMap$.value);
                map.delete(conversationId);
                this.messagesMap$.next(map);
                if (this.activeConversationId$.value === conversationId) {
                    this.activeConversationId$.next(null);
                    this.activeView$.next('inbox');
                }
                this.closeChat(conversationId);
            },
            error: () => { },
        });
    }
    clearConversation(conversationId) {
        const contactId = this.auth.contactId;
        if (!contactId)
            return;
        this.api.clearConversation(conversationId, contactId).subscribe({
            next: () => {
                const map = new Map(this.messagesMap$.value);
                map.set(conversationId, []);
                this.messagesMap$.next(map);
                const items = this.inbox$.value.map(i => i.conversation_id === conversationId
                    ? { ...i, last_message_preview: '', last_message_at: i.last_message_at }
                    : i);
                this.inbox$.next(items);
            },
            error: () => { },
        });
    }
    deleteGroup(conversationId) {
        const contactId = this.auth.contactId;
        if (!contactId)
            return;
        this.api.deleteGroup(conversationId, contactId).subscribe({
            next: () => {
                const items = this.inbox$.value.filter(i => i.conversation_id !== conversationId);
                this.inbox$.next(items);
                this.recalcUnread(items);
                const map = new Map(this.messagesMap$.value);
                map.delete(conversationId);
                this.messagesMap$.next(map);
                if (this.activeConversationId$.value === conversationId) {
                    this.activeConversationId$.next(null);
                    this.activeView$.next('inbox');
                }
                this.closeChat(conversationId);
            },
            error: () => { },
        });
    }
    // ── Reactions ──
    addReaction(messageId, emoji) {
        const contactId = this.auth.contactId;
        if (!contactId)
            return;
        // Enforce one reaction per user — remove any existing reaction with a different emoji
        for (const msgs of this.messagesMap$.value.values()) {
            const msg = msgs.find(m => String(m.message_id) === String(messageId));
            if (msg?.reactions) {
                for (const r of msg.reactions) {
                    if (r.hasReacted && r.emoji !== emoji) {
                        this.applyReactionOptimistically(messageId, r.emoji, false);
                        this.api.removeReaction(messageId, contactId, r.emoji).subscribe({ error: () => { } });
                    }
                }
            }
            break;
        }
        // Optimistic UI so user sees reaction immediately.
        this.applyReactionOptimistically(messageId, emoji, true);
        this.api.addReaction(messageId, contactId, emoji).subscribe({
            next: () => {
                this.refreshMessageReactions(messageId);
            },
            error: () => {
                // Revert optimistic update when request fails.
                this.applyReactionOptimistically(messageId, emoji, false);
            },
        });
    }
    removeReaction(messageId, emoji) {
        const contactId = this.auth.contactId;
        if (!contactId)
            return;
        // Optimistic UI so user sees reaction removal immediately.
        this.applyReactionOptimistically(messageId, emoji, false);
        this.api.removeReaction(messageId, contactId, emoji).subscribe({
            next: () => {
                this.refreshMessageReactions(messageId);
            },
            error: () => {
                // Revert optimistic update when request fails.
                this.applyReactionOptimistically(messageId, emoji, true);
            },
        });
    }
    getActiveConversationId() {
        return this.activeConversationId$.value;
    }
    // ── Getters ──
    getMessagesForConversation(conversationId) {
        return this.messagesMap$.value.get(conversationId) || [];
    }
    getCurrentInbox() {
        return this.inbox$.value;
    }
    // ── Private helpers ──
    /**
     * Prefer `{ type, data }`; support flat `{ type, ...fields }` envelopes from older backends.
     */
    wsEventPayload(msg) {
        if (msg.data !== undefined && msg.data !== null) {
            return msg.data;
        }
        const raw = msg;
        const { type: _t, data: _d, timestamp: _ts, message: _msg, ...rest } = raw;
        return Object.keys(rest).length ? rest : null;
    }
    listenWebSocket() {
        this.wsSub?.unsubscribe();
        this.wsSub = this.wsService.onMessage$.subscribe((msg) => this.handleWsMessage(msg));
    }
    handleWsMessage(msg) {
        switch (msg.type) {
            case 'new_message':
                this.handleNewMessage(this.wsEventPayload(msg));
                break;
            case 'conversation_updated':
                this.loadInbox();
                if (this.activeConversationId$.value) {
                    this.loadMessages(this.activeConversationId$.value);
                }
                break;
            case 'group_updated':
                this.handleGroupUpdated(this.wsEventPayload(msg));
                break;
            case 'error':
                this.handleWebSocketError(msg.message);
                break;
        }
    }
    handleGroupUpdated(data) {
        this.loadInbox();
    }
    handleWebSocketError(errorMessage) {
        void errorMessage;
    }
    handleNewMessage(data) {
        if (!data)
            return;
        // Pass through full payload so nested / alternate attachment fields are not dropped.
        const message = this.normalizeMessageShape(data);
        const isFromOther = String(message.sender_id) !== String(this.auth.contactId);
        const existing = this.messagesMap$.value.get(message.conversation_id) || [];
        const isDuplicate = existing.some((m) => m.message_id === message.message_id ||
            (m.sender_id === message.sender_id &&
                m.content === message.content &&
                Math.abs(new Date(m.created_at).getTime() - new Date(message.created_at).getTime()) < 2000));
        if (!isDuplicate) {
            this.appendMessage(message);
            if (isFromOther) {
                this.playNotificationSound();
            }
        }
        this.updateInboxPreview(message);
        if (this.activeConversationId$.value !== message.conversation_id) {
            if (isFromOther) {
                this.incrementUnread(message.conversation_id);
            }
        }
        else {
            this.markAsRead(message.conversation_id);
        }
    }
    /** Public — lets components add an optimistic message without a round-trip. */
    appendOptimisticMessage(message) {
        this.appendMessage(message);
    }
    appendMessage(message) {
        const map = new Map(this.messagesMap$.value);
        const msgs = [...(map.get(message.conversation_id) || []), message];
        map.set(message.conversation_id, msgs);
        this.messagesMap$.next(map);
        this.refreshMessageReactions(message.message_id);
    }
    updateInboxPreview(message) {
        const items = this.inbox$.value.map((item) => {
            if (item.conversation_id === message.conversation_id) {
                return {
                    ...item,
                    last_message_preview: message.content || '[Image]',
                    last_message_at: message.created_at,
                };
            }
            return item;
        });
        items.sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
        this.inbox$.next(items);
    }
    incrementUnread(conversationId) {
        const items = this.inbox$.value.map((item) => item.conversation_id === conversationId
            ? { ...item, unread_count: Number(item.unread_count) + 1 }
            : item);
        this.inbox$.next(items);
        this.recalcUnread(items);
    }
    /**
     * Normalize backend message shapes so UI can reliably render attachments/media.
     * Supports legacy and current field names returned by API/WS payloads.
     */
    normalizeMessageShape(raw) {
        const base = {
            message_id: String(raw?.message_id ?? raw?.id ?? ''),
            conversation_id: String(raw?.conversation_id ?? raw?.conversationId ?? ''),
            sender_id: String(raw?.sender_id ?? raw?.senderId ?? ''),
            sender_name: raw?.sender_name,
            sender_username: raw?.sender_username,
            sender_first_name: raw?.sender_first_name,
            sender_last_name: raw?.sender_last_name,
            message_type: (raw?.message_type ?? raw?.messageType ?? 'TEXT'),
            content: raw?.content ?? '',
            media_url: raw?.media_url ?? raw?.mediaUrl ?? raw?.url ?? raw?.file_url,
            created_at: raw?.created_at ?? raw?.createdAt ?? new Date().toISOString(),
            is_read: raw?.is_read,
            reactions: raw?.reactions,
            mentions: raw?.mentions,
            attachments: raw?.attachments,
            is_pinned: raw?.is_pinned,
            pinned_at: raw?.pinned_at,
            pinned_by: raw?.pinned_by,
        };
        const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        // Normalize attachment objects (API may use fileId / id instead of file_id).
        if (Array.isArray(base.attachments) && base.attachments.length > 0) {
            const mapped = base.attachments.map((a) => ({
                file_id: String(a?.file_id ?? a?.fileId ?? a?.id ?? a?.attachment_id ?? a?.storage_file_id ?? '').trim(),
                filename: String(a?.filename ?? a?.file_name ?? a?.name ?? a?.original_filename ?? ''),
                mime_type: a?.mime_type ?? a?.mimeType,
                url: a?.url ?? a?.file_url ?? a?.download_url,
            })).filter((a) => !!a.file_id && !a.file_id.startsWith('temp-'));
            if (mapped.length > 0) {
                return { ...base, attachments: mapped };
            }
        }
        // Reconstruct attachments from alternate API fields.
        let attachmentIds = [];
        if (Array.isArray(raw?.attachment_ids)) {
            attachmentIds = raw.attachment_ids.map((x) => String(x).trim()).filter(Boolean);
        }
        else if (typeof raw?.attachment_ids === 'string' && raw.attachment_ids.trim()) {
            attachmentIds = raw.attachment_ids
                .split(/[,\s]+/)
                .map((s) => s.trim())
                .filter(Boolean);
        }
        if (attachmentIds.length === 0 && Array.isArray(raw?.file_ids)) {
            attachmentIds = raw.file_ids.map((x) => String(x).trim()).filter(Boolean);
        }
        const pushId = (v) => {
            const s = v != null && v !== '' ? String(v).trim() : '';
            if (s && !attachmentIds.includes(s))
                attachmentIds.push(s);
        };
        pushId(raw?.file_id);
        pushId(raw?.attachment_id);
        pushId(raw?.storage_file_id);
        pushId(raw?.blob_id);
        // Backend stores first attachment id in messaging.message.media_url (UUID), not a public URL.
        const mediaAsId = String(base.media_url || '').trim();
        if (mediaAsId &&
            !mediaAsId.startsWith('http://') &&
            !mediaAsId.startsWith('https://') &&
            !mediaAsId.startsWith('data:')) {
            pushId(mediaAsId);
        }
        const contentTrim = String(base.content || '').trim();
        if (attachmentIds.length === 0 && uuidRe.test(contentTrim)) {
            attachmentIds.push(contentTrim);
        }
        // Some APIs store storage / attachment id as numeric string in content for FILE messages.
        if (attachmentIds.length === 0 &&
            /^\d+$/.test(contentTrim) &&
            (base.message_type === 'FILE' || base.message_type === 'IMAGE')) {
            attachmentIds.push(contentTrim);
        }
        const filenames = Array.isArray(raw?.filenames)
            ? raw.filenames.map((x) => String(x))
            : raw?.filename
                ? [String(raw.filename)]
                : raw?.file_name
                    ? [String(raw.file_name)]
                    : base.content && !uuidRe.test(contentTrim)
                        ? [String(base.content)]
                        : [];
        if (attachmentIds.length > 0 || filenames.length > 0) {
            const fallbackMime = raw?.mime_type ?? raw?.attachment_mime_type;
            const urlFallback = raw?.file_url ?? raw?.url ?? raw?.media_url ?? raw?.mediaUrl;
            const ids = attachmentIds.length > 0 ? attachmentIds : [];
            const built = ids.map((id, idx) => ({
                file_id: id,
                filename: filenames[idx] || filenames[0] || `Attachment ${idx + 1}`,
                mime_type: fallbackMime,
                url: urlFallback,
            }));
            // Filename only + direct URL (no storage id): still renderable as <img src>.
            if (built.length === 0 &&
                filenames.length > 0 &&
                urlFallback &&
                String(urlFallback).match(/^https?:\/\//i)) {
                built.push({
                    file_id: '',
                    filename: filenames[0],
                    mime_type: fallbackMime,
                    url: String(urlFallback),
                });
            }
            if (built.length > 0) {
                return { ...base, attachments: built };
            }
        }
        return base;
    }
    playNotificationSound() {
        try {
            const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGGS57OihUBELTKXh8bllHAU2jdXzzn0vBSh+zPLaizsKFGCz6OyrWBQLSKDf8sFuIwUug8/y24k3CBhku+zooVARC0yl4fG5ZRwFNo3V8859LwUofszy2os7ChRgs+jsq1gVC0ig3/LBbiMFLoLP8tuJNwgYZLvs6KFQEQtMpeHxuWUcBTaN1fPOfS8FKH7M8tqLOwoUYLPo7KtYFQtIoN/ywW4jBS6Cz/LbiTcIGGS77OihUBELTKXh8bllHAU2jdXzzn0vBSh+zPLaizsKFGCz6OyrWBULSKDf8sFuIwUugs/y24k3CBhku+zooVARC0yl4fG5ZRwFNo3V8859LwUofszy2os7ChRgs+jsq1gVC0ig3/LBbiMFLoLP8tuJNwgYZLvs6KFQEQtMpeHxuWUcBTaN1fPOfS8FKH7M8tqLOwoUYLPo7KtYFQtIoN/ywW4jBS6Cz/LbiTcIGGS77OihUBELTKXh8bllHAU2jdXzzn0vBSh+zPLaizsKFGCz6OyrWBULSKDf8sFuIwUugs/y24k3CBhku+zooVARC0yl4fG5ZRwFNo3V8859LwUofszy2os7ChRgs+jsq1gVC0ig3/LBbiMFLoLP8tuJNwgYZLvs6KFQEQtMpeHxuWUcBTaN1fPOfS8FKH7M8tqLOwoUYLPo7KtYFQtIoN/ywW4jBS6Cz/LbiTcIGGS77OihUBELTKXh8bllHAU2jdXzzn0vBSh+zPLaizsKFGCz6OyrWBULSKDf8sFuIwUugs/y24k3CBhku+zooVARC0yl4fG5ZRwFNo3V8859LwUofszy2os7ChRgs+jsq1gVC0ig3/LBbiMFLoLP8tuJNwgYZLvs6KFQEQtMpeHxuWUcBTaN1fPOfS8FKH7M8tqLOwoUYLPo7KtYFQtIoN/ywW4jBS6Cz/LbiTcIGGS77OihUBELTKXh8bllHAU2jdXzzn0vBSh+zPLaizsKFGCz6OyrWBULSKDf8sFuIwUugs/y24k3CBhku+zooVARC0yl4fG5ZRwFNo3V8859LwUofszy2os7ChRgs+jsq1gVC0ig3/LBbiMFLoLP8tuJNwgYZLvs6KFQEQtMpeHxuWUcBTaN1fPOfS8FKH7M8tqLOwoUYLPo7KtYFQtIoN/ywW4jBS6Cz/LbiTcIGGS77OihUBELTKXh8bllHAU2jdXzzn0vBSh+zPLaizsKFGCz6OyrWBULSKDf8sFuIwUugs/y24k3CBhku+zooVARC0yl4fG5ZRwFNo3V8859LwUofszy');
            audio.volume = 0.3;
            audio.play().catch(() => { });
        }
        catch {
        }
    }
    recalcUnread(items) {
        const total = items.reduce((sum, i) => sum + Number(i.unread_count || 0), 0);
        this.totalUnread$.next(total);
    }
    hydrateReactionsForConversation(conversationId, messages) {
        const fetchable = messages.filter((m) => !!m.message_id && !String(m.message_id).startsWith('temp-'));
        if (!fetchable.length)
            return;
        const jobs = fetchable.map((m) => this.api.getReactions(m.message_id).pipe(map((rows) => ({ messageId: m.message_id, reactions: this.normalizeReactionRows(rows) })), catchError(() => of({ messageId: m.message_id, reactions: [] }))));
        forkJoin(jobs).subscribe((results) => {
            const map = new Map(this.messagesMap$.value);
            const current = [...(map.get(conversationId) || [])];
            if (!current.length)
                return;
            let changed = false;
            for (const result of results) {
                const idx = current.findIndex((m) => String(m.message_id) === String(result.messageId));
                if (idx === -1)
                    continue;
                current[idx] = { ...current[idx], reactions: result.reactions };
                changed = true;
            }
            if (changed) {
                map.set(conversationId, current);
                this.messagesMap$.next(map);
            }
        });
    }
    refreshMessageReactions(messageId) {
        if (!messageId || String(messageId).startsWith('temp-'))
            return;
        this.api.getReactions(messageId).subscribe({
            next: (rows) => {
                const normalized = this.normalizeReactionRows(rows);
                const map = new Map(this.messagesMap$.value);
                let changed = false;
                for (const [conversationId, msgs] of map.entries()) {
                    const idx = msgs.findIndex((m) => String(m.message_id) === String(messageId));
                    if (idx === -1)
                        continue;
                    const nextMsgs = [...msgs];
                    nextMsgs[idx] = { ...nextMsgs[idx], reactions: normalized };
                    map.set(conversationId, nextMsgs);
                    changed = true;
                    break;
                }
                if (changed) {
                    this.messagesMap$.next(map);
                }
            },
            error: () => { },
        });
    }
    normalizeReactionRows(rows) {
        const byEmoji = new Map();
        const myContactId = String(this.auth.contactId || '');
        const contacts = this.visibleContacts$.value;
        for (const row of rows || []) {
            const emoji = String(row?.emoji || '').trim();
            if (!emoji)
                continue;
            const contactId = String(row?.contact_id ?? row?.contactId ?? '');
            const explicitHasReacted = row?.hasReacted ?? row?.has_reacted;
            const hasReacted = explicitHasReacted === true || (contactId && contactId === myContactId);
            const countFromRow = Number(row?.count ?? row?.reaction_count ?? 0);
            const existing = byEmoji.get(emoji) || { emoji, count: 0, hasReacted: false, reactors: [] };
            // Some APIs return one row per reaction; some return pre-aggregated count.
            existing.count += countFromRow > 0 ? countFromRow : 1;
            existing.hasReacted = existing.hasReacted || !!hasReacted;
            // Track reactor display names when individual contactId is available
            if (contactId && countFromRow <= 1) {
                let name;
                if (contactId === myContactId) {
                    name = 'You';
                }
                else {
                    const contact = contacts.find(c => String(c.contact_id) === contactId);
                    name = contact ? getContactDisplayName(contact) : `User ${contactId}`;
                }
                if (!existing.reactors.includes(name)) {
                    existing.reactors.push(name);
                }
            }
            byEmoji.set(emoji, existing);
        }
        return Array.from(byEmoji.values()).filter((r) => r.count > 0);
    }
    applyReactionOptimistically(messageId, emoji, add) {
        const map = new Map(this.messagesMap$.value);
        let didUpdate = false;
        for (const [conversationId, msgs] of map.entries()) {
            const idx = msgs.findIndex((m) => String(m.message_id) === String(messageId));
            if (idx === -1)
                continue;
            const target = msgs[idx];
            const nextReactions = [...(target.reactions || [])];
            const rIdx = nextReactions.findIndex((r) => r.emoji === emoji);
            if (add) {
                if (rIdx >= 0) {
                    const current = nextReactions[rIdx];
                    if (!current.hasReacted) {
                        nextReactions[rIdx] = {
                            ...current,
                            hasReacted: true,
                            count: Number(current.count || 0) + 1,
                        };
                    }
                }
                else {
                    nextReactions.push({ emoji, count: 1, hasReacted: true });
                }
            }
            else {
                if (rIdx >= 0) {
                    const current = nextReactions[rIdx];
                    const nextCount = Math.max(Number(current.count || 0) - (current.hasReacted ? 1 : 0), 0);
                    if (nextCount === 0) {
                        nextReactions.splice(rIdx, 1);
                    }
                    else {
                        nextReactions[rIdx] = {
                            ...current,
                            hasReacted: false,
                            count: nextCount,
                        };
                    }
                }
            }
            const updatedMsg = { ...target, reactions: nextReactions };
            const updatedMsgs = [...msgs];
            updatedMsgs[idx] = updatedMsg;
            map.set(conversationId, updatedMsgs);
            didUpdate = true;
            break;
        }
        if (didUpdate) {
            this.messagesMap$.next(map);
        }
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: MessagingStoreService, deps: [{ token: i1.AuthService }, { token: i2.MessagingApiService }, { token: i3.MessagingWebSocketService }], target: i0.ɵɵFactoryTarget.Injectable });
    static ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: MessagingStoreService, providedIn: 'root' });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: MessagingStoreService, decorators: [{
            type: Injectable,
            args: [{ providedIn: 'root' }]
        }], ctorParameters: () => [{ type: i1.AuthService }, { type: i2.MessagingApiService }, { type: i3.MessagingWebSocketService }] });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVzc2FnaW5nLXN0b3JlLnNlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvbGliL3NlcnZpY2VzL21lc3NhZ2luZy1zdG9yZS5zZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxVQUFVLEVBQWEsTUFBTSxlQUFlLENBQUM7QUFDdEQsT0FBTyxFQUFFLGVBQWUsRUFBRSxVQUFVLEVBQUUsT0FBTyxFQUFnQixRQUFRLEVBQUUsRUFBRSxFQUFFLE1BQU0sTUFBTSxDQUFDO0FBQ3hGLE9BQU8sRUFBRSxVQUFVLEVBQUUsR0FBRyxFQUFFLE1BQU0sZ0JBQWdCLENBQUM7QUFJakQsT0FBTyxFQVFMLHFCQUFxQixHQUV0QixNQUFNLDRCQUE0QixDQUFDOzs7OztBQUdwQyxNQUFNLE9BQU8scUJBQXFCO0lBMkN0QjtJQUNBO0lBQ0E7SUE1Q1YsdUJBQXVCO0lBQ2YsTUFBTSxHQUFHLElBQUksZUFBZSxDQUFjLEVBQUUsQ0FBQyxDQUFDO0lBQzlDLFlBQVksR0FBRyxJQUFJLGVBQWUsQ0FBeUIsSUFBSSxHQUFHLEVBQUUsQ0FBQyxDQUFDO0lBQ3RFLFVBQVUsR0FBRyxJQUFJLGVBQWUsQ0FBZSxFQUFFLENBQUMsQ0FBQztJQUNuRCxnQkFBZ0IsR0FBRyxJQUFJLGVBQWUsQ0FBWSxFQUFFLENBQUMsQ0FBQztJQUN0RCxVQUFVLEdBQUcsSUFBSSxlQUFlLENBQVUsS0FBSyxDQUFDLENBQUM7SUFDakQsV0FBVyxHQUFHLElBQUksZUFBZSxDQUFvRixPQUFPLENBQUMsQ0FBQztJQUM5SCxZQUFZLEdBQUcsSUFBSSxlQUFlLENBQ3ZDLFlBQVksQ0FBQyxPQUFPLENBQUMsd0JBQXdCLENBQWlCLElBQUksT0FBTyxDQUMzRSxDQUFDO0lBQ00scUJBQXFCLEdBQUcsSUFBSSxlQUFlLENBQWdCLElBQUksQ0FBQyxDQUFDO0lBQ2pFLG1CQUFtQixHQUFHLElBQUksZUFBZSxDQUEyQyxJQUFJLENB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R0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUM7WUFDOUIsV0FBVyxDQUFDLEdBQUcsQ0FBQyxHQUFHLFVBQVUsQ0FBQztZQUM5QixHQUFHLENBQUMsR0FBRyxDQUFDLGNBQWMsRUFBRSxXQUFXLENBQUMsQ0FBQztZQUNyQyxTQUFTLEdBQUcsSUFBSSxDQUFDO1lBQ2pCLE1BQU07UUFDUixDQUFDO1FBRUQsSUFBSSxTQUFTLEVBQUUsQ0FBQztZQUNkLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQzlCLENBQUM7SUFDSCxDQUFDO3dHQTkvQlUscUJBQXFCOzRHQUFyQixxQkFBcUIsY0FEUixNQUFNOzs0RkFDbkIscUJBQXFCO2tCQURqQyxVQUFVO21CQUFDLEVBQUUsVUFBVSxFQUFFLE1BQU0sRUFBRSIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEluamVjdGFibGUsIE9uRGVzdHJveSB9IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xyXG5pbXBvcnQgeyBCZWhhdmlvclN1YmplY3QsIE9ic2VydmFibGUsIFN1YmplY3QsIFN1YnNjcmlwdGlvbiwgZm9ya0pvaW4sIG9mIH0gZnJvbSAncnhqcyc7XHJcbmltcG9ydCB7IGNhdGNoRXJyb3IsIG1hcCB9IGZyb20gJ3J4anMvb3BlcmF0b3JzJztcclxuaW1wb3J0IHsgQXV0aFNlcnZpY2UgfSBmcm9tICcuL2F1dGguc2VydmljZSc7XHJcbmltcG9ydCB7IE1lc3NhZ2luZ0FwaVNlcnZpY2UgfSBmcm9tICcuL21lc3NhZ2luZy1hcGkuc2VydmljZSc7XHJcbmltcG9ydCB7IE1lc3NhZ2luZ1dlYlNvY2tldFNlcnZpY2UgfSBmcm9tICcuL21lc3NhZ2luZy13ZWJzb2NrZXQuc2VydmljZSc7XHJcbmltcG9ydCB7XHJcbiAgSW5ib3hJdGVtLFxyXG4gIE1lc3NhZ2UsXHJcbiAgQXR0YWNobWVudCxcclxuICBDb250YWN0LFxyXG4gIENoYXRXaW5kb3csXHJcbiAgV2ViU29ja2V0TWVzc2FnZSxcclxuICBTaWRlYmFyU2lkZSxcclxuICBnZXRDb250YWN0RGlzcGxheU5hbWUsXHJcbiAgZ2V0TWVzc2FnZVNlbmRlck5hbWUsXHJcbn0gZnJvbSAnLi4vbW9kZWxzL21lc3NhZ2luZy5tb2RlbHMnO1xyXG5cclxuQEluamVjdGFibGUoeyBwcm92aWRlZEluOiAncm9vdCcgfSlcclxuZXhwb3J0IGNsYXNzIE1lc3NhZ2luZ1N0b3JlU2VydmljZSBpbXBsZW1lbnRzIE9uRGVzdHJveSB7XHJcbiAgLy8g4pSA4pSAIFN0YXRlIHN1YmplY3RzIOKUgOKUgFxyXG4gIHByaXZhdGUgaW5ib3gkID0gbmV3IEJlaGF2aW9yU3ViamVjdDxJbmJveEl0ZW1bXT4oW10pO1xyXG4gIHByaXZhdGUgbWVzc2FnZXNNYXAkID0gbmV3IEJlaGF2aW9yU3ViamVjdDxNYXA8c3RyaW5nLCBNZXNzYWdlW10+PihuZXcgTWFwKCkpO1xyXG4gIHByaXZhdGUgb3BlbkNoYXRzJCA9IG5ldyBCZWhhdmlvclN1YmplY3Q8Q2hhdFdpbmRvd1tdPihbXSk7XHJcbiAgcHJpdmF0ZSB2aXNpYmxlQ29udGFjdHMkID0gbmV3IEJlaGF2aW9yU3ViamVjdDxDb250YWN0W10+KFtdKTtcclxuICBwcml2YXRlIHBhbmVsT3BlbiQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PGJvb2xlYW4+KGZhbHNlKTtcclxuICBwcml2YXRlIGFjdGl2ZVZpZXckID0gbmV3IEJlaGF2aW9yU3ViamVjdDwnaW5ib3gnIHwgJ2NoYXQnIHwgJ25ldy1jb252ZXJzYXRpb24nIHwgJ2dyb3VwLW1hbmFnZXInIHwgJ2NvbnZlcnNhdGlvbi1zZXR0aW5ncyc+KCdpbmJveCcpO1xyXG4gIHByaXZhdGUgc2lkZWJhclNpZGUkID0gbmV3IEJlaGF2aW9yU3ViamVjdDxTaWRlYmFyU2lkZT4oXHJcbiAgICAobG9jYWxTdG9yYWdlLmdldEl0ZW0oJ21lc3NhZ2luZ19zaWRlYmFyX3NpZGUnKSBhcyBTaWRlYmFyU2lkZSkgfHwgJ3JpZ2h0J1xyXG4gICk7XHJcbiAgcHJpdmF0ZSBhY3RpdmVDb252ZXJzYXRpb25JZCQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PHN0cmluZyB8IG51bGw+KG51bGwpO1xyXG4gIHByaXZhdGUgcGVuZGluZ0RtUmVjaXBpZW50JCA9IG5ldyBCZWhhdmlvclN1YmplY3Q8e2NvbnRhY3RJZDogc3RyaW5nLCBuYW1lOiBzdHJpbmd9IHwgbnVsbD4obnVsbCk7XHJcbiAgcHJpdmF0ZSB0b3RhbFVucmVhZCQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PG51bWJlcj4oMCk7XHJcbiAgcHJpdmF0ZSBsb2FkaW5nTWVzc2FnZXMkID0gbmV3IEJlaGF2aW9yU3ViamVjdDxib29sZWFuPihmYWxzZSk7XHJcbiAgcHJpdmF0ZSBwYW5lbFBvc2l0aW9uJCA9IG5ldyBCZWhhdmlvclN1YmplY3Q8eyB4OiBudW1iZXI7IHk6IG51bWJlciB9IHwgbnVsbD4obnVsbCk7XHJcbiAgcHJpdmF0ZSBwYW5lbFNpemUkID0gbmV3IEJlaGF2aW9yU3ViamVjdDx7IHdpZHRoOiBudW1iZXI7IGhlaWdodDogbnVtYmVyIH0+KHsgd2lkdGg6IDM4MCwgaGVpZ2h0OiA1NjAgfSk7XHJcbiAgcHJpdmF0ZSB3YXNPcGVuQmVmb3JlRHJhZyQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PGJvb2xlYW4+KGZhbHNlKTtcclxuXHJcbiAgLy8g4pSA4pSAIFB1YmxpYyBvYnNlcnZhYmxlcyDilIDilIBcclxuICByZWFkb25seSBpbmJveCA9IHRoaXMuaW5ib3gkLmFzT2JzZXJ2YWJsZSgpO1xyXG4gIHJlYWRvbmx5IG1lc3NhZ2VzTWFwID0gdGhpcy5tZXNzYWdlc01hcCQuYXNPYnNlcnZhYmxlKCk7XHJcbiAgcmVhZG9ubHkgb3BlbkNoYXRzID0gdGhpcy5vcGVuQ2hhdHMkLmFzT2JzZXJ2YWJsZSgpO1xyXG4gIHJlYWRvbmx5IHZpc2libGVDb250YWN0cyA9IHRoaXMudmlzaWJsZUNvbnRhY3RzJC5hc09ic2VydmFibGUoKTtcclxuICByZWFkb25seSBwYW5lbE9wZW4gPSB0aGlzLnBhbmVsT3BlbiQuYXNPYnNlcnZhYmxlKCk7XHJcbiAgcmVhZG9ubHkgYWN0aXZlVmlldyA9IHRoaXMuYWN0aXZlVmlldyQuYXNPYnNlcnZhYmxlKCk7XHJcbiAgcmVhZG9ubHkgYWN0aXZlQ29udmVyc2F0aW9uSWQgPSB0aGlzLmFjdGl2ZUNvbnZlcnNhdGlvbklkJC5hc09ic2VydmFibGUoKTtcclxuICByZWFkb25seSB0b3RhbFVucmVhZCA9IHRoaXMudG90YWxVbnJlYWQkLmFzT2JzZXJ2YWJsZSgpO1xyXG4gIHJlYWRvbmx5IGxvYWRpbmdNZXNzYWdlcyA9IHRoaXMubG9hZGluZ01lc3NhZ2VzJC5hc09ic2VydmFibGUoKTtcclxuICB3c1N0YXR1czogT2JzZXJ2YWJsZTxzdHJpbmc+ID0gbmV3IE9ic2VydmFibGU8c3RyaW5nPigpO1xyXG4gIHJlYWRvbmx5IHBhbmVsUG9zaXRpb24gPSB0aGlzLnBhbmVsUG9zaXRpb24kLmFzT2JzZXJ2YWJsZSgpO1xyXG4gIHJlYWRvbmx5IHBhbmVsU2l6ZSA9IHRoaXMucGFuZWxTaXplJC5hc09ic2VydmFibGUoKTtcclxuICByZWFkb25seSB3YXNPcGVuQmVmb3JlRHJhZyA9IHRoaXMud2FzT3BlbkJlZm9yZURyYWckLmFzT2JzZXJ2YWJsZSgpO1xyXG4gIHJlYWRvbmx5IHNpZGViYXJTaWRlID0gdGhpcy5zaWRlYmFyU2lkZSQuYXNPYnNlcnZhYmxlKCk7XHJcblxyXG4gIHByaXZhdGUgd3NTdWI6IFN1YnNjcmlwdGlvbiB8IG51bGwgPSBudWxsO1xyXG4gIHByaXZhdGUgZGVzdHJveSQgPSBuZXcgU3ViamVjdDx2b2lkPigpO1xyXG4gIHByaXZhdGUgcG9sbFRpbWVyOiBhbnkgPSBudWxsO1xyXG4gIHByaXZhdGUgZ3JvdXBTZXR0aW5ncyQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PHsgY29udmVyc2F0aW9uSWQ6IHN0cmluZzsgbmFtZTogc3RyaW5nIH0gfCBudWxsPihudWxsKTtcclxuXHJcbiAgcmVhZG9ubHkgZ3JvdXBTZXR0aW5ncyA9IHRoaXMuZ3JvdXBTZXR0aW5ncyQuYXNPYnNlcnZhYmxlKCk7XHJcblxyXG4gIGNvbnN0cnVjdG9yKFxyXG4gICAgcHJpdmF0ZSBhdXRoOiBBdXRoU2VydmljZSxcclxuICAgIHByaXZhdGUgYXBpOiBNZXNzYWdpbmdBcGlTZXJ2aWNlLFxyXG4gICAgcHJpdmF0ZSB3c1NlcnZpY2U6IE1lc3NhZ2luZ1dlYlNvY2tldFNlcnZpY2VcclxuICApIHtcclxuICAgICh0aGlzIGFzIGFueSkud3NTdGF0dXMgPSB0aGlzLndzU2VydmljZS5zdGF0dXMkO1xyXG4gIH1cclxuXHJcbiAgLy8g4pSA4pSAIEluaXRpYWxpemF0aW9uIOKUgOKUgFxyXG4gIGluaXRpYWxpemUoKTogdm9pZCB7XHJcbiAgICBpZiAoIXRoaXMuYXV0aC5pc0F1dGhlbnRpY2F0ZWQoKSkgcmV0dXJuO1xyXG5cclxuICAgIGNvbnN0IGNvbnRhY3RJZCA9IHRoaXMuYXV0aC5jb250YWN0SWQhO1xyXG4gICAgY29uc3Qgc2Vzc2lvbkdpZCA9IHRoaXMuYXV0aC5zZXNzaW9uR2lkITtcclxuXHJcbiAgICB0aGlzLmxvYWRJbmJveCgpO1xyXG4gICAgdGhpcy5sb2FkVmlzaWJsZUNvbnRhY3RzKCk7XHJcblxyXG4gICAgdGhpcy53c1NlcnZpY2UuY29ubmVjdChjb250YWN0SWQsIHNlc3Npb25HaWQpO1xyXG4gICAgdGhpcy5saXN0ZW5XZWJTb2NrZXQoKTtcclxuICAgIHRoaXMuc3RhcnRQb2xsaW5nKCk7XHJcbiAgfVxyXG5cclxuICB0ZWFyZG93bigpOiB2b2lkIHtcclxuICAgIHRoaXMuc3RvcFBvbGxpbmcoKTtcclxuICAgIHRoaXMud3NTZXJ2aWNlLmRpc2Nvbm5lY3QoKTtcclxuICAgIHRoaXMud3NTdWI/LnVuc3Vic2NyaWJlKCk7XHJcbiAgICB0aGlzLmluYm94JC5uZXh0KFtdKTtcclxuICAgIHRoaXMubWVzc2FnZXNNYXAkLm5leHQobmV3IE1hcCgpKTtcclxuICAgIHRoaXMub3BlbkNoYXRzJC5uZXh0KFtdKTtcclxuICAgIHRoaXMucGFuZWxPcGVuJC5uZXh0KGZhbHNlKTtcclxuICAgIHRoaXMuYWN0aXZlVmlldyQubmV4dCgnaW5ib3gnKTtcclxuICAgIHRoaXMuYWN0aXZlQ29udmVyc2F0aW9uSWQkLm5leHQobnVsbCk7XHJcbiAgICB0aGlzLnRvdGFsVW5yZWFkJC5uZXh0KDApO1xyXG4gIH1cclxuXHJcbiAgLy8g4pSA4pSAIFBvbGxpbmcgZmFsbGJhY2sgKGluYm94IG9ubHkgLSBtZXNzYWdlcyByZWx5IG9uIFdlYlNvY2tldCkg4pSA4pSAXHJcbiAgcHJpdmF0ZSBzdGFydFBvbGxpbmcoKTogdm9pZCB7XHJcbiAgICB0aGlzLnN0b3BQb2xsaW5nKCk7XHJcbiAgICB0aGlzLnBvbGxUaW1lciA9IHNldEludGVydmFsKCgpID0+IHtcclxuICAgICAgdGhpcy5sb2FkSW5ib3goKTtcclxuICAgIH0sIDMwMDAwKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgc3RvcFBvbGxpbmcoKTogdm9pZCB7XHJcbiAgICBpZiAodGhpcy5wb2xsVGltZXIpIHtcclxuICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLnBvbGxUaW1lcik7XHJcbiAgICAgIHRoaXMucG9sbFRpbWVyID0gbnVsbDtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIG5nT25EZXN0cm95KCk6IHZvaWQge1xyXG4gICAgdGhpcy50ZWFyZG93bigpO1xyXG4gICAgdGhpcy5kZXN0cm95JC5uZXh0KCk7XHJcbiAgICB0aGlzLmRlc3Ryb3kkLmNvbXBsZXRlKCk7XHJcbiAgfVxyXG5cclxuICAvLyDilIDilIAgUGFuZWwgY29udHJvbHMg4pSA4pSAXHJcbiAgdG9nZ2xlUGFuZWwoYnV0dG9uWD86IG51bWJlciwgYnV0dG9uWT86IG51bWJlcik6IHZvaWQge1xyXG4gICAgaWYgKGJ1dHRvblggIT09IHVuZGVmaW5lZCAmJiBidXR0b25ZICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgdGhpcy5wYW5lbFBvc2l0aW9uJC5uZXh0KHsgeDogYnV0dG9uWCwgeTogYnV0dG9uWSB9KTtcclxuICAgIH1cclxuICAgIHRoaXMucGFuZWxPcGVuJC5uZXh0KCF0aGlzLnBhbmVsT3BlbiQudmFsdWUpO1xyXG4gIH1cclxuXHJcbiAgb3BlblBhbmVsKGJ1dHRvblg/OiBudW1iZXIsIGJ1dHRvblk/OiBudW1iZXIpOiB2b2lkIHtcclxuICAgIGlmIChidXR0b25YICE9PSB1bmRlZmluZWQgJiYgYnV0dG9uWSAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgIHRoaXMucGFuZWxQb3NpdGlvbiQubmV4dCh7IHg6IGJ1dHRvblgsIHk6IGJ1dHRvblkgfSk7XHJcbiAgICB9XHJcbiAgICB0aGlzLnBhbmVsT3BlbiQubmV4dCh0cnVlKTtcclxuICB9XHJcblxyXG4gIGNsb3NlUGFuZWwoKTogdm9pZCB7XHJcbiAgICB0aGlzLnBhbmVsT3BlbiQubmV4dChmYWxzZSk7XHJcbiAgfVxyXG5cclxuICBzZXRQYW5lbFNpemUod2lkdGg6IG51bWJlciwgaGVpZ2h0OiBudW1iZXIpOiB2b2lkIHtcclxuICAgIHRoaXMucGFuZWxTaXplJC5uZXh0KHsgd2lkdGgsIGhlaWdodCB9KTtcclxuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdtZXNzYWdpbmdfcGFuZWxfc2l6ZScsIEpTT04uc3RyaW5naWZ5KHsgd2lkdGgsIGhlaWdodCB9KSk7XHJcbiAgfVxyXG5cclxuICBnZXRQYW5lbFNpemUoKTogeyB3aWR0aDogbnVtYmVyOyBoZWlnaHQ6IG51bWJlciB9IHtcclxuICAgIGNvbnN0IHNhdmVkID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ21lc3NhZ2luZ19wYW5lbF9zaXplJyk7XHJcbiAgICBpZiAoc2F2ZWQpIHtcclxuICAgICAgdHJ5IHtcclxuICAgICAgICBjb25zdCBwYXJzZWQgPSBKU09OLnBhcnNlKHNhdmVkKTtcclxuICAgICAgICBpZiAocGFyc2VkLndpZHRoICYmIHBhcnNlZC5oZWlnaHQpIHtcclxuICAgICAgICAgIHRoaXMucGFuZWxTaXplJC5uZXh0KHBhcnNlZCk7XHJcbiAgICAgICAgICByZXR1cm4gcGFyc2VkO1xyXG4gICAgICAgIH1cclxuICAgICAgfSBjYXRjaCB7fVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIHRoaXMucGFuZWxTaXplJC52YWx1ZTtcclxuICB9XHJcblxyXG4gIG9uQnV0dG9uRHJhZ1N0YXJ0KCk6IHZvaWQge1xyXG4gICAgdGhpcy53YXNPcGVuQmVmb3JlRHJhZyQubmV4dCh0aGlzLnBhbmVsT3BlbiQudmFsdWUpO1xyXG4gICAgaWYgKHRoaXMucGFuZWxPcGVuJC52YWx1ZSkge1xyXG4gICAgICB0aGlzLnBhbmVsT3BlbiQubmV4dChmYWxzZSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBvbkJ1dHRvbkRyYWdFbmQoYnV0dG9uWDogbnVtYmVyLCBidXR0b25ZOiBudW1iZXIpOiB2b2lkIHtcclxuICAgIGlmICh0aGlzLndhc09wZW5CZWZvcmVEcmFnJC52YWx1ZSkge1xyXG4gICAgICB0aGlzLm9wZW5QYW5lbChidXR0b25YLCBidXR0b25ZKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHNldFZpZXcodmlldzogJ2luYm94JyB8ICdjaGF0JyB8ICduZXctY29udmVyc2F0aW9uJyB8ICdncm91cC1tYW5hZ2VyJyB8ICdjb252ZXJzYXRpb24tc2V0dGluZ3MnKTogdm9pZCB7XHJcbiAgICB0aGlzLmFjdGl2ZVZpZXckLm5leHQodmlldyk7XHJcbiAgfVxyXG5cclxuICB0b2dnbGVTaWRlYmFyU2lkZSgpOiB2b2lkIHtcclxuICAgIGNvbnN0IG5leHQgPSB0aGlzLnNpZGViYXJTaWRlJC52YWx1ZSA9PT0gJ3JpZ2h0JyA/ICdsZWZ0JyA6ICdyaWdodCc7XHJcbiAgICB0aGlzLnNpZGViYXJTaWRlJC5uZXh0KG5leHQpO1xyXG4gICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ21lc3NhZ2luZ19zaWRlYmFyX3NpZGUnLCBuZXh0KTtcclxuICB9XHJcblxyXG4gIGdldFNpZGViYXJTaWRlKCk6IFNpZGViYXJTaWRlIHtcclxuICAgIHJldHVybiB0aGlzLnNpZGViYXJTaWRlJC52YWx1ZTtcclxuICB9XHJcblxyXG4gIC8vIOKUgOKUgCBJbmJveCDilIDilIBcclxuICBsb2FkSW5ib3goKTogdm9pZCB7XHJcbiAgICBjb25zdCBjb250YWN0SWQgPSB0aGlzLmF1dGguY29udGFjdElkO1xyXG4gICAgaWYgKCFjb250YWN0SWQpIHJldHVybjtcclxuXHJcbiAgICB0aGlzLmFwaS5nZXRJbmJveChjb250YWN0SWQpLnN1YnNjcmliZSh7XHJcbiAgICAgIG5leHQ6IChpdGVtcykgPT4ge1xyXG4gICAgICAgIGNvbnN0IG1hcHBlZCA9IGl0ZW1zLm1hcChpdGVtID0+IHtcclxuICAgICAgICAgIGNvbnN0IGlzR3JvdXAgPSBpdGVtLmlzX2dyb3VwID09PSB0cnVlIHx8IChpdGVtLmlzX2dyb3VwIGFzIGFueSkgPT09ICdUcnVlJztcclxuICAgICAgICAgIFxyXG4gICAgICAgICAgaWYgKCFpc0dyb3VwICYmICFpdGVtLm5hbWUgJiYgaXRlbS5vdGhlcl9wYXJ0aWNpcGFudF9uYW1lKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB7IC4uLml0ZW0sIG5hbWU6IGl0ZW0ub3RoZXJfcGFydGljaXBhbnRfbmFtZSwgaXNfZ3JvdXA6IGZhbHNlIH07XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICByZXR1cm4geyAuLi5pdGVtLCBpc19ncm91cDogaXNHcm91cCB9O1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIHRoaXMuaW5ib3gkLm5leHQobWFwcGVkKTtcclxuICAgICAgICB0aGlzLnJlY2FsY1VucmVhZChtYXBwZWQpO1xyXG5cclxuICAgICAgICBjb25zdCBpZHMgPSBtYXBwZWQubWFwKChpKSA9PiBpLmNvbnZlcnNhdGlvbl9pZCk7XHJcbiAgICAgICAgdGhpcy53c1NlcnZpY2Uuc3Vic2NyaWJlQWxsKGlkcyk7XHJcbiAgICAgIH0sXHJcbiAgICAgIGVycm9yOiAoKSA9PiB7fSxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLy8g4pSA4pSAIENvbnRhY3RzIOKUgOKUgFxyXG4gIGxvYWRWaXNpYmxlQ29udGFjdHMoKTogdm9pZCB7XHJcbiAgICBjb25zdCBjb250YWN0SWQgPSB0aGlzLmF1dGguY29udGFjdElkO1xyXG4gICAgaWYgKCFjb250YWN0SWQpIHJldHVybjtcclxuXHJcbiAgICB0aGlzLmFwaS5nZXRWaXNpYmxlQ29udGFjdHMoY29udGFjdElkKS5zdWJzY3JpYmUoe1xyXG4gICAgICBuZXh0OiAoY29udGFjdHMpID0+IHtcclxuICAgICAgICB0aGlzLnZpc2libGVDb250YWN0cyQubmV4dChjb250YWN0cyk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgY29uc3QgY3VycmVudENvbnRhY3QgPSB0aGlzLmF1dGguY3VycmVudENvbnRhY3Q7XHJcbiAgICAgICAgaWYgKGN1cnJlbnRDb250YWN0ICYmIGN1cnJlbnRDb250YWN0LmVtYWlsKSB7XHJcbiAgICAgICAgICBjb25zdCBtYXRjaCA9IGNvbnRhY3RzLmZpbmQoYyA9PiBjLmVtYWlsID09PSBjdXJyZW50Q29udGFjdC5lbWFpbCk7XHJcbiAgICAgICAgICBpZiAoXHJcbiAgICAgICAgICAgIG1hdGNoICYmXHJcbiAgICAgICAgICAgIFN0cmluZyhtYXRjaC5jb250YWN0X2lkKSAhPT0gU3RyaW5nKGN1cnJlbnRDb250YWN0LmNvbnRhY3RfaWQpXHJcbiAgICAgICAgICApIHtcclxuICAgICAgICAgICAgdGhpcy5hdXRoLnNldFNlc3Npb24odGhpcy5hdXRoLnNlc3Npb25HaWQhLCB7IC4uLmN1cnJlbnRDb250YWN0LCBjb250YWN0X2lkOiBtYXRjaC5jb250YWN0X2lkIH0pO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgdGhpcy53c1NlcnZpY2UuZGlzY29ubmVjdCgpO1xyXG4gICAgICAgICAgICB0aGlzLndzU2VydmljZS5jb25uZWN0KG1hdGNoLmNvbnRhY3RfaWQsIHRoaXMuYXV0aC5zZXNzaW9uR2lkISk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICB9LFxyXG4gICAgICBlcnJvcjogKCkgPT4ge30sXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8vIOKUgOKUgCBDb252ZXJzYXRpb25zIOKUgOKUgFxyXG4gIG9wZW5Db252ZXJzYXRpb24oY29udmVyc2F0aW9uSWQ6IHN0cmluZywgbmFtZTogc3RyaW5nLCBpc0dyb3VwID0gZmFsc2UpOiB2b2lkIHtcclxuICAgIGlmICghY29udmVyc2F0aW9uSWQgfHwgY29udmVyc2F0aW9uSWQgPT09ICd1bmRlZmluZWQnKSB7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIHRoaXMuYWN0aXZlQ29udmVyc2F0aW9uSWQkLm5leHQoY29udmVyc2F0aW9uSWQpO1xyXG4gICAgdGhpcy5hY3RpdmVWaWV3JC5uZXh0KCdjaGF0Jyk7XHJcbiAgICB0aGlzLm9wZW5QYW5lbCgpO1xyXG5cclxuICAgIGNvbnN0IGNoYXRzID0gdGhpcy5vcGVuQ2hhdHMkLnZhbHVlO1xyXG4gICAgaWYgKCFjaGF0cy5maW5kKChjKSA9PiBjLmNvbnZlcnNhdGlvbklkID09PSBjb252ZXJzYXRpb25JZCkpIHtcclxuICAgICAgdGhpcy5vcGVuQ2hhdHMkLm5leHQoW1xyXG4gICAgICAgIC4uLmNoYXRzLFxyXG4gICAgICAgIHsgY29udmVyc2F0aW9uSWQsIG5hbWUsIGlzR3JvdXAsIGlzTWluaW1pemVkOiBmYWxzZSwgdW5yZWFkQ291bnQ6IDAgfSxcclxuICAgICAgXSk7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgZXhpc3RpbmcgPSB0aGlzLm1lc3NhZ2VzTWFwJC52YWx1ZS5nZXQoY29udmVyc2F0aW9uSWQpO1xyXG4gICAgaWYgKGV4aXN0aW5nICYmIGV4aXN0aW5nLmxlbmd0aCA+IDApIHtcclxuICAgICAgLy8gQWxyZWFkeSBjYWNoZWQg4oCUIHNpbGVudCBiYWNrZ3JvdW5kIHJlZnJlc2ggZm9yIG5ldyBtZXNzYWdlcywgc2tpcCByZWFjdGlvbiBoeWRyYXRpb25cclxuICAgICAgdGhpcy5sb2FkTWVzc2FnZXMoY29udmVyc2F0aW9uSWQsIHVuZGVmaW5lZCwgdHJ1ZSk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICB0aGlzLmxvYWRNZXNzYWdlcyhjb252ZXJzYXRpb25JZCk7XHJcbiAgICB9XHJcbiAgICB0aGlzLm1hcmtBc1JlYWQoY29udmVyc2F0aW9uSWQpO1xyXG4gICAgdGhpcy53c1NlcnZpY2Uuc3Vic2NyaWJlKGNvbnZlcnNhdGlvbklkKTtcclxuICB9XHJcblxyXG4gIGNsb3NlQ2hhdChjb252ZXJzYXRpb25JZDogc3RyaW5nKTogdm9pZCB7XHJcbiAgICBjb25zdCBjaGF0cyA9IHRoaXMub3BlbkNoYXRzJC52YWx1ZS5maWx0ZXIoKGMpID0+IGMuY29udmVyc2F0aW9uSWQgIT09IGNvbnZlcnNhdGlvbklkKTtcclxuICAgIHRoaXMub3BlbkNoYXRzJC5uZXh0KGNoYXRzKTtcclxuXHJcbiAgICBpZiAodGhpcy5hY3RpdmVDb252ZXJzYXRpb25JZCQudmFsdWUgPT09IGNvbnZlcnNhdGlvbklkKSB7XHJcbiAgICAgIHRoaXMuYWN0aXZlQ29udmVyc2F0aW9uSWQkLm5leHQobnVsbCk7XHJcbiAgICAgIHRoaXMuYWN0aXZlVmlldyQubmV4dCgnaW5ib3gnKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8vIOKUgOKUgCBNZXNzYWdlcyDilIDilIBcclxuICBsb2FkTWVzc2FnZXMoY29udmVyc2F0aW9uSWQ6IHN0cmluZywgYmVmb3JlTWVzc2FnZUlkPzogc3RyaW5nLCBza2lwUmVhY3Rpb25IeWRyYXRpb24gPSBmYWxzZSk6IHZvaWQge1xyXG4gICAgaWYgKCFjb252ZXJzYXRpb25JZCB8fCBjb252ZXJzYXRpb25JZCA9PT0gJ3VuZGVmaW5lZCcpIHtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgY29uc3QgY29udGFjdElkID0gdGhpcy5hdXRoLmNvbnRhY3RJZDtcclxuICAgIGlmICghY29udGFjdElkKSByZXR1cm47XHJcblxyXG4gICAgdGhpcy5sb2FkaW5nTWVzc2FnZXMkLm5leHQodHJ1ZSk7XHJcblxyXG4gICAgdGhpcy5hcGkuZ2V0TWVzc2FnZXMoY29udmVyc2F0aW9uSWQsIGNvbnRhY3RJZCwgYmVmb3JlTWVzc2FnZUlkLCA1MCkuc3Vic2NyaWJlKHtcclxuICAgICAgbmV4dDogKG1lc3NhZ2VzKSA9PiB7XHJcbiAgICAgICAgY29uc3QgbWFwID0gbmV3IE1hcCh0aGlzLm1lc3NhZ2VzTWFwJC52YWx1ZSk7XHJcbiAgICAgICAgY29uc3QgZXhpc3RpbmcgPSBtYXAuZ2V0KGNvbnZlcnNhdGlvbklkKSB8fCBbXTtcclxuXHJcbiAgICAgICAgY29uc3Qgbm9ybWFsaXplZCA9IG1lc3NhZ2VzLm1hcCgobTogYW55KSA9PiB0aGlzLm5vcm1hbGl6ZU1lc3NhZ2VTaGFwZShtKSk7XHJcbiAgICAgICAgY29uc3Qgc29ydGVkID0gWy4uLm5vcm1hbGl6ZWRdLnNvcnQoKGEsIGIpID0+IFxyXG4gICAgICAgICAgbmV3IERhdGUoYS5jcmVhdGVkX2F0KS5nZXRUaW1lKCkgLSBuZXcgRGF0ZShiLmNyZWF0ZWRfYXQpLmdldFRpbWUoKVxyXG4gICAgICAgICk7XHJcblxyXG4gICAgICAgIGlmIChiZWZvcmVNZXNzYWdlSWQpIHtcclxuICAgICAgICAgIC8vIFByZXBlbmQgb2xkZXIgbWVzc2FnZXMsIHByZXNlcnZpbmcgZXhpc3RpbmcgcmVhY3Rpb25zXHJcbiAgICAgICAgICBjb25zdCBtZXJnZWQgPSBbLi4uc29ydGVkLCAuLi5leGlzdGluZ107XHJcbiAgICAgICAgICBtYXAuc2V0KGNvbnZlcnNhdGlvbklkLCBtZXJnZWQpO1xyXG4gICAgICAgIH0gZWxzZSBpZiAoc2tpcFJlYWN0aW9uSHlkcmF0aW9uKSB7XHJcbiAgICAgICAgICAvLyBTaWxlbnQgcmVmcmVzaCDigJQgbWVyZ2UgbmV3IG1lc3NhZ2VzIGJ1dCBwcmVzZXJ2ZSBleGlzdGluZyByZWFjdGlvbiBzdGF0ZVxyXG4gICAgICAgICAgY29uc3QgZXhpc3RpbmdCeUlkID0gbmV3IE1hcChleGlzdGluZy5tYXAobSA9PiBbU3RyaW5nKG0ubWVzc2FnZV9pZCksIG1dKSk7XHJcbiAgICAgICAgICBjb25zdCBtZXJnZWQgPSBzb3J0ZWQubWFwKG0gPT4ge1xyXG4gICAgICAgICAgICBjb25zdCBjYWNoZWQgPSBleGlzdGluZ0J5SWQuZ2V0KFN0cmluZyhtLm1lc3NhZ2VfaWQpKTtcclxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZCA/IHsgLi4ubSwgcmVhY3Rpb25zOiBjYWNoZWQucmVhY3Rpb25zIH0gOiBtO1xyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgICBtYXAuc2V0KGNvbnZlcnNhdGlvbklkLCBtZXJnZWQpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICBtYXAuc2V0KGNvbnZlcnNhdGlvbklkLCBzb3J0ZWQpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5tZXNzYWdlc01hcCQubmV4dChtYXApO1xyXG4gICAgICAgIGlmICghc2tpcFJlYWN0aW9uSHlkcmF0aW9uKSB7XHJcbiAgICAgICAgICB0aGlzLmh5ZHJhdGVSZWFjdGlvbnNGb3JDb252ZXJzYXRpb24oY29udmVyc2F0aW9uSWQsIG1hcC5nZXQoY29udmVyc2F0aW9uSWQpIHx8IFtdKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5sb2FkaW5nTWVzc2FnZXMkLm5leHQoZmFsc2UpO1xyXG4gICAgICB9LFxyXG4gICAgICBlcnJvcjogKCkgPT4ge1xyXG4gICAgICAgIHRoaXMubG9hZGluZ01lc3NhZ2VzJC5uZXh0KGZhbHNlKTtcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgc2VuZE1lc3NhZ2UoY29udmVyc2F0aW9uSWQ6IHN0cmluZyB8IG51bGwsIGNvbnRlbnQ6IHN0cmluZywgbWVzc2FnZVR5cGU6ICdURVhUJyB8ICdJTUFHRScgPSAnVEVYVCcpOiB2b2lkIHtcclxuICAgIGNvbnN0IGNvbnRhY3RJZCA9IHRoaXMuYXV0aC5jb250YWN0SWQ7XHJcbiAgICBpZiAoIWNvbnRhY3RJZCkgcmV0dXJuO1xyXG5cclxuICAgIGNvbnN0IHBlbmRpbmcgPSB0aGlzLnBlbmRpbmdEbVJlY2lwaWVudCQudmFsdWU7XHJcbiAgICBpZiAoIWNvbnZlcnNhdGlvbklkICYmIHBlbmRpbmcpIHtcclxuICAgICAgdGhpcy5zZW5kRGlyZWN0TWVzc2FnZShwZW5kaW5nLmNvbnRhY3RJZCwgY29udGVudCk7XHJcbiAgICAgIHRoaXMucGVuZGluZ0RtUmVjaXBpZW50JC5uZXh0KG51bGwpO1xyXG4gICAgICBjb25zdCBjaGF0cyA9IHRoaXMub3BlbkNoYXRzJC52YWx1ZS5maWx0ZXIoYyA9PiBjLmNvbnZlcnNhdGlvbklkICE9PSAncGVuZGluZycpO1xyXG4gICAgICB0aGlzLm9wZW5DaGF0cyQubmV4dChjaGF0cyk7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoIWNvbnZlcnNhdGlvbklkKSByZXR1cm47XHJcblxyXG4gICAgY29uc3QgdGVtcE1lc3NhZ2VJZCA9ICd0ZW1wLScgKyBEYXRlLm5vdygpO1xyXG4gICAgY29uc3Qgb3B0aW1pc3RpYzogTWVzc2FnZSA9IHtcclxuICAgICAgbWVzc2FnZV9pZDogdGVtcE1lc3NhZ2VJZCxcclxuICAgICAgY29udmVyc2F0aW9uX2lkOiBjb252ZXJzYXRpb25JZCxcclxuICAgICAgc2VuZGVyX2lkOiBjb250YWN0SWQsXHJcbiAgICAgIHNlbmRlcl9uYW1lOiAnWW91JyxcclxuICAgICAgbWVzc2FnZV90eXBlOiBtZXNzYWdlVHlwZSxcclxuICAgICAgY29udGVudCxcclxuICAgICAgY3JlYXRlZF9hdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxyXG4gICAgICBpc19yZWFkOiB0cnVlLFxyXG4gICAgfTtcclxuICAgIHRoaXMuYXBwZW5kTWVzc2FnZShvcHRpbWlzdGljKTtcclxuXHJcbiAgICB0aGlzLmFwaS5zZW5kTWVzc2FnZShjb252ZXJzYXRpb25JZCwgY29udGFjdElkLCBjb250ZW50LCBtZXNzYWdlVHlwZSkuc3Vic2NyaWJlKHtcclxuICAgICAgbmV4dDogKHJlcykgPT4ge1xyXG4gICAgICAgIGNvbnN0IHJlYWxJZCA9IHJlcz8ubWVzc2FnZV9pZCA/PyByZXM/LmlkID8/IHJlcz8ubWVzc2FnZUlkO1xyXG4gICAgICAgIGlmIChyZWFsSWQgPT0gbnVsbCB8fCBTdHJpbmcocmVhbElkKS5zdGFydHNXaXRoKCd0ZW1wLScpKSB7XHJcbiAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGNvbnN0IG1lcmdlZCA9IHRoaXMubm9ybWFsaXplTWVzc2FnZVNoYXBlKHtcclxuICAgICAgICAgIC4uLm9wdGltaXN0aWMsXHJcbiAgICAgICAgICAuLi5yZXMsXHJcbiAgICAgICAgICBtZXNzYWdlX2lkOiBTdHJpbmcocmVhbElkKSxcclxuICAgICAgICAgIGNvbnZlcnNhdGlvbl9pZDogY29udmVyc2F0aW9uSWQsXHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgY29uc3QgbWFwID0gbmV3IE1hcCh0aGlzLm1lc3NhZ2VzTWFwJC52YWx1ZSk7XHJcbiAgICAgICAgY29uc3QgbXNncyA9IFsuLi4obWFwLmdldChjb252ZXJzYXRpb25JZCkgfHwgW10pXTtcclxuICAgICAgICBjb25zdCBpZHggPSBtc2dzLmZpbmRJbmRleCgobSkgPT4gbS5tZXNzYWdlX2lkID09PSB0ZW1wTWVzc2FnZUlkKTtcclxuICAgICAgICBpZiAoaWR4ID49IDApIHtcclxuICAgICAgICAgIG1zZ3NbaWR4XSA9IG1lcmdlZDtcclxuICAgICAgICAgIG1hcC5zZXQoY29udmVyc2F0aW9uSWQsIG1zZ3MpO1xyXG4gICAgICAgICAgdGhpcy5tZXNzYWdlc01hcCQubmV4dChtYXApO1xyXG4gICAgICAgICAgdGhpcy5yZWZyZXNoTWVzc2FnZVJlYWN0aW9ucyhtZXJnZWQubWVzc2FnZV9pZCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9LFxyXG4gICAgICBlcnJvcjogKCkgPT4ge30sXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIG9wZW5EaXJlY3RDb252ZXJzYXRpb24ocmVjaXBpZW50Q29udGFjdElkOiBzdHJpbmcsIGRpc3BsYXlOYW1lOiBzdHJpbmcpOiB2b2lkIHtcclxuICAgIGNvbnN0IGV4aXN0aW5nID0gdGhpcy5pbmJveCQudmFsdWUuZmluZChpdGVtID0+IFxyXG4gICAgICAhaXRlbS5pc19ncm91cCAmJiBpdGVtLm5hbWUgPT09IGRpc3BsYXlOYW1lXHJcbiAgICApO1xyXG4gICAgXHJcbiAgICBpZiAoZXhpc3RpbmcpIHtcclxuICAgICAgdGhpcy5wZW5kaW5nRG1SZWNpcGllbnQkLm5leHQobnVsbCk7XHJcbiAgICAgIHRoaXMub3BlbkNvbnZlcnNhdGlvbihleGlzdGluZy5jb252ZXJzYXRpb25faWQsIGRpc3BsYXlOYW1lLCBmYWxzZSk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICB0aGlzLnBlbmRpbmdEbVJlY2lwaWVudCQubmV4dCh7Y29udGFjdElkOiByZWNpcGllbnRDb250YWN0SWQsIG5hbWU6IGRpc3BsYXlOYW1lfSk7XHJcbiAgICAgIHRoaXMuYWN0aXZlQ29udmVyc2F0aW9uSWQkLm5leHQobnVsbCk7XHJcbiAgICAgIHRoaXMuYWN0aXZlVmlldyQubmV4dCgnY2hhdCcpO1xyXG4gICAgICB0aGlzLm9wZW5QYW5lbCgpO1xyXG4gICAgICBcclxuICAgICAgY29uc3QgY2hhdHMgPSB0aGlzLm9wZW5DaGF0cyQudmFsdWU7XHJcbiAgICAgIGlmICghY2hhdHMuZmluZChjID0+IGMuY29udmVyc2F0aW9uSWQgPT09ICdwZW5kaW5nJykpIHtcclxuICAgICAgICB0aGlzLm9wZW5DaGF0cyQubmV4dChbLi4uY2hhdHMsIHtcclxuICAgICAgICAgIGNvbnZlcnNhdGlvbklkOiAncGVuZGluZycsXHJcbiAgICAgICAgICBuYW1lOiBkaXNwbGF5TmFtZSxcclxuICAgICAgICAgIGlzR3JvdXA6IGZhbHNlLFxyXG4gICAgICAgICAgaXNNaW5pbWl6ZWQ6IGZhbHNlLFxyXG4gICAgICAgICAgdW5yZWFkQ291bnQ6IDBcclxuICAgICAgICB9XSk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcblxyXG4gIHNlbmREaXJlY3RNZXNzYWdlKHJlY2lwaWVudENvbnRhY3RJZDogc3RyaW5nLCBjb250ZW50OiBzdHJpbmcpOiB2b2lkIHtcclxuICAgIGNvbnN0IGNvbnRhY3RJZCA9IHRoaXMuYXV0aC5jb250YWN0SWQ7XHJcbiAgICBpZiAoIWNvbnRhY3RJZCkgcmV0dXJuO1xyXG5cclxuICAgIHRoaXMuYXBpLnNlbmREaXJlY3RNZXNzYWdlKGNvbnRhY3RJZCwgcmVjaXBpZW50Q29udGFjdElkLCBjb250ZW50KS5zdWJzY3JpYmUoe1xyXG4gICAgICBuZXh0OiAocmVzKSA9PiB7XHJcbiAgICAgICAgdGhpcy5sb2FkSW5ib3goKTtcclxuICAgICAgICAvLyBCYWNrZW5kIG1heSByZXR1cm4gY29udmVyc2F0aW9uX2lkLCBpZCwgb3IgY29udmVyc2F0aW9uSWRcclxuICAgICAgICBjb25zdCBjb252SWQgPSBTdHJpbmcocmVzPy5jb252ZXJzYXRpb25faWQgfHwgcmVzPy5pZCB8fCByZXM/LmNvbnZlcnNhdGlvbklkIHx8ICcnKTtcclxuICAgICAgICBpZiAoY29udklkKSB7XHJcbiAgICAgICAgICBjb25zdCByZWNpcGllbnQgPSB0aGlzLnZpc2libGVDb250YWN0cyQudmFsdWUuZmluZChcclxuICAgICAgICAgICAgKGMpID0+IGMuY29udGFjdF9pZCA9PT0gcmVjaXBpZW50Q29udGFjdElkXHJcbiAgICAgICAgICApO1xyXG4gICAgICAgICAgY29uc3QgbmFtZSA9IHJlY2lwaWVudCA/IGdldENvbnRhY3REaXNwbGF5TmFtZShyZWNpcGllbnQpIDogJ0RpcmVjdCBNZXNzYWdlJztcclxuICAgICAgICAgIHRoaXMub3BlbkNvbnZlcnNhdGlvbihjb252SWQsIG5hbWUsIGZhbHNlKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0sXHJcbiAgICAgIGVycm9yOiAoKSA9PiB7fSxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgY3JlYXRlR3JvdXBDb252ZXJzYXRpb24ocGFydGljaXBhbnRJZHM6IHN0cmluZ1tdLCBuYW1lOiBzdHJpbmcpOiB2b2lkIHtcclxuICAgIGNvbnN0IGNvbnRhY3RJZCA9IHRoaXMuYXV0aC5jb250YWN0SWQ7XHJcbiAgICBpZiAoIWNvbnRhY3RJZCkgcmV0dXJuO1xyXG5cclxuICAgIGNvbnN0IGFsbFBhcnRpY2lwYW50cyA9IHBhcnRpY2lwYW50SWRzLmluY2x1ZGVzKGNvbnRhY3RJZClcclxuICAgICAgPyBwYXJ0aWNpcGFudElkc1xyXG4gICAgICA6IFtjb250YWN0SWQsIC4uLnBhcnRpY2lwYW50SWRzXTtcclxuXHJcbiAgICB0aGlzLmFwaS5jcmVhdGVDb252ZXJzYXRpb24oY29udGFjdElkLCBhbGxQYXJ0aWNpcGFudHMsIG5hbWUpLnN1YnNjcmliZSh7XHJcbiAgICAgIG5leHQ6IChjb252KSA9PiB7XHJcbiAgICAgICAgLy8gQmFja2VuZCBtYXkgcmV0dXJuIGNvbnZlcnNhdGlvbl9pZCwgaWQsIG9yIGNvbnZlcnNhdGlvbklkXHJcbiAgICAgICAgY29uc3QgY29udklkID0gU3RyaW5nKChjb252IGFzIGFueSk/LmNvbnZlcnNhdGlvbl9pZCB8fCAoY29udiBhcyBhbnkpPy5pZCB8fCAoY29udiBhcyBhbnkpPy5jb252ZXJzYXRpb25JZCB8fCAnJyk7XHJcbiAgICAgICAgaWYgKCFjb252SWQpIHtcclxuICAgICAgICAgIHRoaXMubG9hZEluYm94KCk7XHJcbiAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMubG9hZEluYm94KCk7XHJcbiAgICAgICAgdGhpcy5vcGVuQ29udmVyc2F0aW9uKGNvbnZJZCwgbmFtZSwgdHJ1ZSk7XHJcbiAgICAgIH0sXHJcbiAgICAgIGVycm9yOiAoKSA9PiB7fSxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgb3Blbkdyb3VwU2V0dGluZ3MoY29udmVyc2F0aW9uSWQ6IHN0cmluZywgbmFtZTogc3RyaW5nKTogdm9pZCB7XHJcbiAgICB0aGlzLmdyb3VwU2V0dGluZ3MkLm5leHQoeyBjb252ZXJzYXRpb25JZCwgbmFtZSB9KTtcclxuICAgIHRoaXMuc2V0VmlldygnZ3JvdXAtbWFuYWdlcicpO1xyXG4gIH1cclxuXHJcbiAgY2xlYXJHcm91cFNldHRpbmdzKCk6IHZvaWQge1xyXG4gICAgdGhpcy5ncm91cFNldHRpbmdzJC5uZXh0KG51bGwpO1xyXG4gIH1cclxuXHJcbiAgbWFya0FzUmVhZChjb252ZXJzYXRpb25JZDogc3RyaW5nKTogdm9pZCB7XHJcbiAgICBpZiAoIWNvbnZlcnNhdGlvbklkIHx8IGNvbnZlcnNhdGlvbklkID09PSAndW5kZWZpbmVkJykgcmV0dXJuO1xyXG4gICAgY29uc3QgY29udGFjdElkID0gdGhpcy5hdXRoLmNvbnRhY3RJZDtcclxuICAgIGlmICghY29udGFjdElkKSByZXR1cm47XHJcblxyXG4gICAgdGhpcy5hcGkubWFya0NvbnZlcnNhdGlvblJlYWQoY29udmVyc2F0aW9uSWQsIGNvbnRhY3RJZCkuc3Vic2NyaWJlKHtcclxuICAgICAgbmV4dDogKCkgPT4ge1xyXG4gICAgICAgIGNvbnN0IGl0ZW1zID0gdGhpcy5pbmJveCQudmFsdWUubWFwKChpdGVtKSA9PlxyXG4gICAgICAgICAgaXRlbS5jb252ZXJzYXRpb25faWQgPT09IGNvbnZlcnNhdGlvbklkID8geyAuLi5pdGVtLCB1bnJlYWRfY291bnQ6IDAgfSA6IGl0ZW1cclxuICAgICAgICApO1xyXG4gICAgICAgIHRoaXMuaW5ib3gkLm5leHQoaXRlbXMpO1xyXG4gICAgICAgIHRoaXMucmVjYWxjVW5yZWFkKGl0ZW1zKTtcclxuICAgICAgfSxcclxuICAgICAgZXJyb3I6ICgpID0+IHt9LFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvLyDilIDilIAgR3JvdXAgbWFuYWdlbWVudCDilIDilIBcclxuICBtYW5hZ2VHcm91cChcclxuICAgIGFjdGlvbjogJ2NyZWF0ZScgfCAnYWRkJyB8ICdyZW1vdmUnIHwgJ3JlbmFtZScsXHJcbiAgICBjb252ZXJzYXRpb25JZD86IHN0cmluZyxcclxuICAgIGdyb3VwTmFtZT86IHN0cmluZyxcclxuICAgIHBhcnRpY2lwYW50Q29udGFjdElkcz86IHN0cmluZ1tdXHJcbiAgKTogdm9pZCB7XHJcbiAgICBjb25zdCBjb250YWN0SWQgPSB0aGlzLmF1dGguY29udGFjdElkO1xyXG4gICAgaWYgKCFjb250YWN0SWQpIHJldHVybjtcclxuXHJcbiAgICB0aGlzLmFwaS5tYW5hZ2VHcm91cChjb250YWN0SWQsIGFjdGlvbiwgY29udmVyc2F0aW9uSWQsIGdyb3VwTmFtZSwgcGFydGljaXBhbnRDb250YWN0SWRzKS5zdWJzY3JpYmUoe1xyXG4gICAgICBuZXh0OiAoKSA9PiB0aGlzLmxvYWRJbmJveCgpLFxyXG4gICAgICBlcnJvcjogKCkgPT4ge30sXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8vIOKUgOKUgCBEZWxldGUgLyBDbGVhciDilIDilIBcclxuICBkZWxldGVDb252ZXJzYXRpb24oY29udmVyc2F0aW9uSWQ6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgY29uc3QgY29udGFjdElkID0gdGhpcy5hdXRoLmNvbnRhY3RJZDtcclxuICAgIGlmICghY29udGFjdElkKSByZXR1cm47XHJcblxyXG4gICAgdGhpcy5hcGkuZGVsZXRlQ29udmVyc2F0aW9uKGNvbnZlcnNhdGlvbklkLCBjb250YWN0SWQpLnN1YnNjcmliZSh7XHJcbiAgICAgIG5leHQ6ICgpID0+IHtcclxuICAgICAgICBjb25zdCBpdGVtcyA9IHRoaXMuaW5ib3gkLnZhbHVlLmZpbHRlcihpID0+IGkuY29udmVyc2F0aW9uX2lkICE9PSBjb252ZXJzYXRpb25JZCk7XHJcbiAgICAgICAgdGhpcy5pbmJveCQubmV4dChpdGVtcyk7XHJcbiAgICAgICAgdGhpcy5yZWNhbGNVbnJlYWQoaXRlbXMpO1xyXG4gICAgICAgIGNvbnN0IG1hcCA9IG5ldyBNYXAodGhpcy5tZXNzYWdlc01hcCQudmFsdWUpO1xyXG4gICAgICAgIG1hcC5kZWxldGUoY29udmVyc2F0aW9uSWQpO1xyXG4gICAgICAgIHRoaXMubWVzc2FnZXNNYXAkLm5leHQobWFwKTtcclxuICAgICAgICBpZiAodGhpcy5hY3RpdmVDb252ZXJzYXRpb25JZCQudmFsdWUgPT09IGNvbnZlcnNhdGlvbklkKSB7XHJcbiAgICAgICAgICB0aGlzLmFjdGl2ZUNvbnZlcnNhdGlvbklkJC5uZXh0KG51bGwpO1xyXG4gICAgICAgICAgdGhpcy5hY3RpdmVWaWV3JC5uZXh0KCdpbmJveCcpO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLmNsb3NlQ2hhdChjb252ZXJzYXRpb25JZCk7XHJcbiAgICAgIH0sXHJcbiAgICAgIGVycm9yOiAoKSA9PiB7fSxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgY2xlYXJDb252ZXJzYXRpb24oY29udmVyc2F0aW9uSWQ6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgY29uc3QgY29udGFjdElkID0gdGhpcy5hdXRoLmNvbnRhY3RJZDtcclxuICAgIGlmICghY29udGFjdElkKSByZXR1cm47XHJcblxyXG4gICAgdGhpcy5hcGkuY2xlYXJDb252ZXJzYXRpb24oY29udmVyc2F0aW9uSWQsIGNvbnRhY3RJZCkuc3Vic2NyaWJlKHtcclxuICAgICAgbmV4dDogKCkgPT4ge1xyXG4gICAgICAgIGNvbnN0IG1hcCA9IG5ldyBNYXAodGhpcy5tZXNzYWdlc01hcCQudmFsdWUpO1xyXG4gICAgICAgIG1hcC5zZXQoY29udmVyc2F0aW9uSWQsIFtdKTtcclxuICAgICAgICB0aGlzLm1lc3NhZ2VzTWFwJC5uZXh0KG1hcCk7XHJcbiAgICAgICAgY29uc3QgaXRlbXMgPSB0aGlzLmluYm94JC52YWx1ZS5tYXAoaSA9PlxyXG4gICAgICAgICAgaS5jb252ZXJzYXRpb25faWQgPT09IGNvbnZlcnNhdGlvbklkXHJcbiAgICAgICAgICAgID8geyAuLi5pLCBsYXN0X21lc3NhZ2VfcHJldmlldzogJycsIGxhc3RfbWVzc2FnZV9hdDogaS5sYXN0X21lc3NhZ2VfYXQgfVxyXG4gICAgICAgICAgICA6IGlcclxuICAgICAgICApO1xyXG4gICAgICAgIHRoaXMuaW5ib3gkLm5leHQoaXRlbXMpO1xyXG4gICAgICB9LFxyXG4gICAgICBlcnJvcjogKCkgPT4ge30sXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIGRlbGV0ZUdyb3VwKGNvbnZlcnNhdGlvbklkOiBzdHJpbmcpOiB2b2lkIHtcclxuICAgIGNvbnN0IGNvbnRhY3RJZCA9IHRoaXMuYXV0aC5jb250YWN0SWQ7XHJcbiAgICBpZiAoIWNvbnRhY3RJZCkgcmV0dXJuO1xyXG5cclxuICAgIHRoaXMuYXBpLmRlbGV0ZUdyb3VwKGNvbnZlcnNhdGlvbklkLCBjb250YWN0SWQpLnN1YnNjcmliZSh7XHJcbiAgICAgIG5leHQ6ICgpID0+IHtcclxuICAgICAgICBjb25zdCBpdGVtcyA9IHRoaXMuaW5ib3gkLnZhbHVlLmZpbHRlcihpID0+IGkuY29udmVyc2F0aW9uX2lkICE9PSBjb252ZXJzYXRpb25JZCk7XHJcbiAgICAgICAgdGhpcy5pbmJveCQubmV4dChpdGVtcyk7XHJcbiAgICAgICAgdGhpcy5yZWNhbGNVbnJlYWQoaXRlbXMpO1xyXG4gICAgICAgIGNvbnN0IG1hcCA9IG5ldyBNYXAodGhpcy5tZXNzYWdlc01hcCQudmFsdWUpO1xyXG4gICAgICAgIG1hcC5kZWxldGUoY29udmVyc2F0aW9uSWQpO1xyXG4gICAgICAgIHRoaXMubWVzc2FnZXNNYXAkLm5leHQobWFwKTtcclxuICAgICAgICBpZiAodGhpcy5hY3RpdmVDb252ZXJzYXRpb25JZCQudmFsdWUgPT09IGNvbnZlcnNhdGlvbklkKSB7XHJcbiAgICAgICAgICB0aGlzLmFjdGl2ZUNvbnZlcnNhdGlvbklkJC5uZXh0KG51bGwpO1xyXG4gICAgICAgICAgdGhpcy5hY3RpdmVWaWV3JC5uZXh0KCdpbmJveCcpO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLmNsb3NlQ2hhdChjb252ZXJzYXRpb25JZCk7XHJcbiAgICAgIH0sXHJcbiAgICAgIGVycm9yOiAoKSA9PiB7fSxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLy8g4pSA4pSAIFJlYWN0aW9ucyDilIDilIBcclxuICBhZGRSZWFjdGlvbihtZXNzYWdlSWQ6IHN0cmluZywgZW1vamk6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgY29uc3QgY29udGFjdElkID0gdGhpcy5hdXRoLmNvbnRhY3RJZDtcclxuICAgIGlmICghY29udGFjdElkKSByZXR1cm47XHJcblxyXG4gICAgLy8gRW5mb3JjZSBvbmUgcmVhY3Rpb24gcGVyIHVzZXIg4oCUIHJlbW92ZSBhbnkgZXhpc3RpbmcgcmVhY3Rpb24gd2l0aCBhIGRpZmZlcmVudCBlbW9qaVxyXG4gICAgZm9yIChjb25zdCBtc2dzIG9mIHRoaXMubWVzc2FnZXNNYXAkLnZhbHVlLnZhbHVlcygpKSB7XHJcbiAgICAgIGNvbnN0IG1zZyA9IG1zZ3MuZmluZChtID0+IFN0cmluZyhtLm1lc3NhZ2VfaWQpID09PSBTdHJpbmcobWVzc2FnZUlkKSk7XHJcbiAgICAgIGlmIChtc2c/LnJlYWN0aW9ucykge1xyXG4gICAgICAgIGZvciAoY29uc3QgciBvZiBtc2cucmVhY3Rpb25zKSB7XHJcbiAgICAgICAgICBpZiAoci5oYXNSZWFjdGVkICYmIHIuZW1vamkgIT09IGVtb2ppKSB7XHJcbiAgICAgICAgICAgIHRoaXMuYXBwbHlSZWFjdGlvbk9wdGltaXN0aWNhbGx5KG1lc3NhZ2VJZCwgci5lbW9qaSwgZmFsc2UpO1xyXG4gICAgICAgICAgICB0aGlzLmFwaS5yZW1vdmVSZWFjdGlvbihtZXNzYWdlSWQsIGNvbnRhY3RJZCwgci5lbW9qaSkuc3Vic2NyaWJlKHsgZXJyb3I6ICgpID0+IHt9IH0pO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgICBicmVhaztcclxuICAgIH1cclxuXHJcbiAgICAvLyBPcHRpbWlzdGljIFVJIHNvIHVzZXIgc2VlcyByZWFjdGlvbiBpbW1lZGlhdGVseS5cclxuICAgIHRoaXMuYXBwbHlSZWFjdGlvbk9wdGltaXN0aWNhbGx5KG1lc3NhZ2VJZCwgZW1vamksIHRydWUpO1xyXG5cclxuICAgIHRoaXMuYXBpLmFkZFJlYWN0aW9uKG1lc3NhZ2VJZCwgY29udGFjdElkLCBlbW9qaSkuc3Vic2NyaWJlKHtcclxuICAgICAgbmV4dDogKCkgPT4ge1xyXG4gICAgICAgIHRoaXMucmVmcmVzaE1lc3NhZ2VSZWFjdGlvbnMobWVzc2FnZUlkKTtcclxuICAgICAgfSxcclxuICAgICAgZXJyb3I6ICgpID0+IHtcclxuICAgICAgICAvLyBSZXZlcnQgb3B0aW1pc3RpYyB1cGRhdGUgd2hlbiByZXF1ZXN0IGZhaWxzLlxyXG4gICAgICAgIHRoaXMuYXBwbHlSZWFjdGlvbk9wdGltaXN0aWNhbGx5KG1lc3NhZ2VJZCwgZW1vamksIGZhbHNlKTtcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcmVtb3ZlUmVhY3Rpb24obWVzc2FnZUlkOiBzdHJpbmcsIGVtb2ppOiBzdHJpbmcpOiB2b2lkIHtcclxuICAgIGNvbnN0IGNvbnRhY3RJZCA9IHRoaXMuYXV0aC5jb250YWN0SWQ7XHJcbiAgICBpZiAoIWNvbnRhY3RJZCkgcmV0dXJuO1xyXG5cclxuICAgIC8vIE9wdGltaXN0aWMgVUkgc28gdXNlciBzZWVzIHJlYWN0aW9uIHJlbW92YWwgaW1tZWRpYXRlbHkuXHJcbiAgICB0aGlzLmFwcGx5UmVhY3Rpb25PcHRpbWlzdGljYWxseShtZXNzYWdlSWQsIGVtb2ppLCBmYWxzZSk7XHJcblxyXG4gICAgdGhpcy5hcGkucmVtb3ZlUmVhY3Rpb24obWVzc2FnZUlkLCBjb250YWN0SWQsIGVtb2ppKS5zdWJzY3JpYmUoe1xyXG4gICAgICBuZXh0OiAoKSA9PiB7XHJcbiAgICAgICAgdGhpcy5yZWZyZXNoTWVzc2FnZVJlYWN0aW9ucyhtZXNzYWdlSWQpO1xyXG4gICAgICB9LFxyXG4gICAgICBlcnJvcjogKCkgPT4ge1xyXG4gICAgICAgIC8vIFJldmVydCBvcHRpbWlzdGljIHVwZGF0ZSB3aGVuIHJlcXVlc3QgZmFpbHMuXHJcbiAgICAgICAgdGhpcy5hcHBseVJlYWN0aW9uT3B0aW1pc3RpY2FsbHkobWVzc2FnZUlkLCBlbW9qaSwgdHJ1ZSk7XHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIGdldEFjdGl2ZUNvbnZlcnNhdGlvbklkKCk6IHN0cmluZyB8IG51bGwge1xyXG4gICAgcmV0dXJuIHRoaXMuYWN0aXZlQ29udmVyc2F0aW9uSWQkLnZhbHVlO1xyXG4gIH1cclxuXHJcbiAgLy8g4pSA4pSAIEdldHRlcnMg4pSA4pSAXHJcbiAgZ2V0TWVzc2FnZXNGb3JDb252ZXJzYXRpb24oY29udmVyc2F0aW9uSWQ6IHN0cmluZyk6IE1lc3NhZ2VbXSB7XHJcbiAgICByZXR1cm4gdGhpcy5tZXNzYWdlc01hcCQudmFsdWUuZ2V0KGNvbnZlcnNhdGlvbklkKSB8fCBbXTtcclxuICB9XHJcblxyXG4gIGdldEN1cnJlbnRJbmJveCgpOiBJbmJveEl0ZW1bXSB7XHJcbiAgICByZXR1cm4gdGhpcy5pbmJveCQudmFsdWU7XHJcbiAgfVxyXG5cclxuICAvLyDilIDilIAgUHJpdmF0ZSBoZWxwZXJzIOKUgOKUgFxyXG4gIC8qKlxyXG4gICAqIFByZWZlciBgeyB0eXBlLCBkYXRhIH1gOyBzdXBwb3J0IGZsYXQgYHsgdHlwZSwgLi4uZmllbGRzIH1gIGVudmVsb3BlcyBmcm9tIG9sZGVyIGJhY2tlbmRzLlxyXG4gICAqL1xyXG4gIHByaXZhdGUgd3NFdmVudFBheWxvYWQobXNnOiBXZWJTb2NrZXRNZXNzYWdlKTogYW55IHtcclxuICAgIGlmIChtc2cuZGF0YSAhPT0gdW5kZWZpbmVkICYmIG1zZy5kYXRhICE9PSBudWxsKSB7XHJcbiAgICAgIHJldHVybiBtc2cuZGF0YTtcclxuICAgIH1cclxuICAgIGNvbnN0IHJhdyA9IG1zZyBhcyB1bmtub3duIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+O1xyXG4gICAgY29uc3QgeyB0eXBlOiBfdCwgZGF0YTogX2QsIHRpbWVzdGFtcDogX3RzLCBtZXNzYWdlOiBfbXNnLCAuLi5yZXN0IH0gPSByYXc7XHJcbiAgICByZXR1cm4gT2JqZWN0LmtleXMocmVzdCkubGVuZ3RoID8gcmVzdCA6IG51bGw7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGxpc3RlbldlYlNvY2tldCgpOiB2b2lkIHtcclxuICAgIHRoaXMud3NTdWI/LnVuc3Vic2NyaWJlKCk7XHJcbiAgICB0aGlzLndzU3ViID0gdGhpcy53c1NlcnZpY2Uub25NZXNzYWdlJC5zdWJzY3JpYmUoKG1zZykgPT4gdGhpcy5oYW5kbGVXc01lc3NhZ2UobXNnKSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGhhbmRsZVdzTWVzc2FnZShtc2c6IFdlYlNvY2tldE1lc3NhZ2UpOiB2b2lkIHtcclxuICAgIHN3aXRjaCAobXNnLnR5cGUpIHtcclxuICAgICAgY2FzZSAnbmV3X21lc3NhZ2UnOlxyXG4gICAgICAgIHRoaXMuaGFuZGxlTmV3TWVzc2FnZSh0aGlzLndzRXZlbnRQYXlsb2FkKG1zZykpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICBjYXNlICdjb252ZXJzYXRpb25fdXBkYXRlZCc6XHJcbiAgICAgICAgdGhpcy5sb2FkSW5ib3goKTtcclxuICAgICAgICBpZiAodGhpcy5hY3RpdmVDb252ZXJzYXRpb25JZCQudmFsdWUpIHtcclxuICAgICAgICAgIHRoaXMubG9hZE1lc3NhZ2VzKHRoaXMuYWN0aXZlQ29udmVyc2F0aW9uSWQkLnZhbHVlKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgIGNhc2UgJ2dyb3VwX3VwZGF0ZWQnOlxyXG4gICAgICAgIHRoaXMuaGFuZGxlR3JvdXBVcGRhdGVkKHRoaXMud3NFdmVudFBheWxvYWQobXNnKSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgIGNhc2UgJ2Vycm9yJzpcclxuICAgICAgICB0aGlzLmhhbmRsZVdlYlNvY2tldEVycm9yKG1zZy5tZXNzYWdlKTtcclxuICAgICAgICBicmVhaztcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHByaXZhdGUgaGFuZGxlR3JvdXBVcGRhdGVkKGRhdGE6IGFueSk6IHZvaWQge1xyXG4gICAgdGhpcy5sb2FkSW5ib3goKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgaGFuZGxlV2ViU29ja2V0RXJyb3IoZXJyb3JNZXNzYWdlOiBzdHJpbmcgfCB1bmRlZmluZWQpOiB2b2lkIHtcclxuICAgIHZvaWQgZXJyb3JNZXNzYWdlO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBoYW5kbGVOZXdNZXNzYWdlKGRhdGE6IGFueSk6IHZvaWQge1xyXG4gICAgaWYgKCFkYXRhKSByZXR1cm47XHJcblxyXG4gICAgLy8gUGFzcyB0aHJvdWdoIGZ1bGwgcGF5bG9hZCBzbyBuZXN0ZWQgLyBhbHRlcm5hdGUgYXR0YWNobWVudCBmaWVsZHMgYXJlIG5vdCBkcm9wcGVkLlxyXG4gICAgY29uc3QgbWVzc2FnZTogTWVzc2FnZSA9IHRoaXMubm9ybWFsaXplTWVzc2FnZVNoYXBlKGRhdGEpO1xyXG5cclxuICAgIGNvbnN0IGlzRnJvbU90aGVyID0gU3RyaW5nKG1lc3NhZ2Uuc2VuZGVyX2lkKSAhPT0gU3RyaW5nKHRoaXMuYXV0aC5jb250YWN0SWQpO1xyXG5cclxuICAgIGNvbnN0IGV4aXN0aW5nID0gdGhpcy5tZXNzYWdlc01hcCQudmFsdWUuZ2V0KG1lc3NhZ2UuY29udmVyc2F0aW9uX2lkKSB8fCBbXTtcclxuICAgIGNvbnN0IGlzRHVwbGljYXRlID0gZXhpc3Rpbmcuc29tZShcclxuICAgICAgKG0pID0+IG0ubWVzc2FnZV9pZCA9PT0gbWVzc2FnZS5tZXNzYWdlX2lkIHx8XHJcbiAgICAgICAgICAgICAobS5zZW5kZXJfaWQgPT09IG1lc3NhZ2Uuc2VuZGVyX2lkICYmXHJcbiAgICAgICAgICAgICAgbS5jb250ZW50ID09PSBtZXNzYWdlLmNvbnRlbnQgJiZcclxuICAgICAgICAgICAgICBNYXRoLmFicyhuZXcgRGF0ZShtLmNyZWF0ZWRfYXQpLmdldFRpbWUoKSAtIG5ldyBEYXRlKG1lc3NhZ2UuY3JlYXRlZF9hdCkuZ2V0VGltZSgpKSA8IDIwMDApXHJcbiAgICApO1xyXG5cclxuICAgIGlmICghaXNEdXBsaWNhdGUpIHtcclxuICAgICAgdGhpcy5hcHBlbmRNZXNzYWdlKG1lc3NhZ2UpO1xyXG4gICAgICBcclxuICAgICAgaWYgKGlzRnJvbU90aGVyKSB7XHJcbiAgICAgICAgdGhpcy5wbGF5Tm90aWZpY2F0aW9uU291bmQoKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHRoaXMudXBkYXRlSW5ib3hQcmV2aWV3KG1lc3NhZ2UpO1xyXG5cclxuICAgIGlmICh0aGlzLmFjdGl2ZUNvbnZlcnNhdGlvbklkJC52YWx1ZSAhPT0gbWVzc2FnZS5jb252ZXJzYXRpb25faWQpIHtcclxuICAgICAgaWYgKGlzRnJvbU90aGVyKSB7XHJcbiAgICAgICAgdGhpcy5pbmNyZW1lbnRVbnJlYWQobWVzc2FnZS5jb252ZXJzYXRpb25faWQpO1xyXG4gICAgICB9XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICB0aGlzLm1hcmtBc1JlYWQobWVzc2FnZS5jb252ZXJzYXRpb25faWQpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqIFB1YmxpYyDigJQgbGV0cyBjb21wb25lbnRzIGFkZCBhbiBvcHRpbWlzdGljIG1lc3NhZ2Ugd2l0aG91dCBhIHJvdW5kLXRyaXAuICovXHJcbiAgYXBwZW5kT3B0aW1pc3RpY01lc3NhZ2UobWVzc2FnZTogTWVzc2FnZSk6IHZvaWQge1xyXG4gICAgdGhpcy5hcHBlbmRNZXNzYWdlKG1lc3NhZ2UpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBhcHBlbmRNZXNzYWdlKG1lc3NhZ2U6IE1lc3NhZ2UpOiB2b2lkIHtcclxuICAgIGNvbnN0IG1hcCA9IG5ldyBNYXAodGhpcy5tZXNzYWdlc01hcCQudmFsdWUpO1xyXG4gICAgY29uc3QgbXNncyA9IFsuLi4obWFwLmdldChtZXNzYWdlLmNvbnZlcnNhdGlvbl9pZCkgfHwgW10pLCBtZXNzYWdlXTtcclxuICAgIG1hcC5zZXQobWVzc2FnZS5jb252ZXJzYXRpb25faWQsIG1zZ3MpO1xyXG4gICAgdGhpcy5tZXNzYWdlc01hcCQubmV4dChtYXApO1xyXG4gICAgdGhpcy5yZWZyZXNoTWVzc2FnZVJlYWN0aW9ucyhtZXNzYWdlLm1lc3NhZ2VfaWQpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSB1cGRhdGVJbmJveFByZXZpZXcobWVzc2FnZTogTWVzc2FnZSk6IHZvaWQge1xyXG4gICAgY29uc3QgaXRlbXMgPSB0aGlzLmluYm94JC52YWx1ZS5tYXAoKGl0ZW0pID0+IHtcclxuICAgICAgaWYgKGl0ZW0uY29udmVyc2F0aW9uX2lkID09PSBtZXNzYWdlLmNvbnZlcnNhdGlvbl9pZCkge1xyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAuLi5pdGVtLFxyXG4gICAgICAgICAgbGFzdF9tZXNzYWdlX3ByZXZpZXc6IG1lc3NhZ2UuY29udGVudCB8fCAnW0ltYWdlXScsXHJcbiAgICAgICAgICBsYXN0X21lc3NhZ2VfYXQ6IG1lc3NhZ2UuY3JlYXRlZF9hdCxcclxuICAgICAgICB9O1xyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiBpdGVtO1xyXG4gICAgfSk7XHJcblxyXG4gICAgaXRlbXMuc29ydCgoYSwgYikgPT4gbmV3IERhdGUoYi5sYXN0X21lc3NhZ2VfYXQpLmdldFRpbWUoKSAtIG5ldyBEYXRlKGEubGFzdF9tZXNzYWdlX2F0KS5nZXRUaW1lKCkpO1xyXG4gICAgdGhpcy5pbmJveCQubmV4dChpdGVtcyk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGluY3JlbWVudFVucmVhZChjb252ZXJzYXRpb25JZDogc3RyaW5nKTogdm9pZCB7XHJcbiAgICBjb25zdCBpdGVtcyA9IHRoaXMuaW5ib3gkLnZhbHVlLm1hcCgoaXRlbSkgPT5cclxuICAgICAgaXRlbS5jb252ZXJzYXRpb25faWQgPT09IGNvbnZlcnNhdGlvbklkXHJcbiAgICAgICAgPyB7IC4uLml0ZW0sIHVucmVhZF9jb3VudDogTnVtYmVyKGl0ZW0udW5yZWFkX2NvdW50KSArIDEgfVxyXG4gICAgICAgIDogaXRlbVxyXG4gICAgKTtcclxuICAgIHRoaXMuaW5ib3gkLm5leHQoaXRlbXMpO1xyXG4gICAgdGhpcy5yZWNhbGNVbnJlYWQoaXRlbXMpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogTm9ybWFsaXplIGJhY2tlbmQgbWVzc2FnZSBzaGFwZXMgc28gVUkgY2FuIHJlbGlhYmx5IHJlbmRlciBhdHRhY2htZW50cy9tZWRpYS5cclxuICAgKiBTdXBwb3J0cyBsZWdhY3kgYW5kIGN1cnJlbnQgZmllbGQgbmFtZXMgcmV0dXJuZWQgYnkgQVBJL1dTIHBheWxvYWRzLlxyXG4gICAqL1xyXG4gIHByaXZhdGUgbm9ybWFsaXplTWVzc2FnZVNoYXBlKHJhdzogYW55KTogTWVzc2FnZSB7XHJcbiAgICBjb25zdCBiYXNlOiBNZXNzYWdlID0ge1xyXG4gICAgICBtZXNzYWdlX2lkOiBTdHJpbmcocmF3Py5tZXNzYWdlX2lkID8/IHJhdz8uaWQgPz8gJycpLFxyXG4gICAgICBjb252ZXJzYXRpb25faWQ6IFN0cmluZyhyYXc/LmNvbnZlcnNhdGlvbl9pZCA/PyByYXc/LmNvbnZlcnNhdGlvbklkID8/ICcnKSxcclxuICAgICAgc2VuZGVyX2lkOiBTdHJpbmcocmF3Py5zZW5kZXJfaWQgPz8gcmF3Py5zZW5kZXJJZCA/PyAnJyksXHJcbiAgICAgIHNlbmRlcl9uYW1lOiByYXc/LnNlbmRlcl9uYW1lLFxyXG4gICAgICBzZW5kZXJfdXNlcm5hbWU6IHJhdz8uc2VuZGVyX3VzZXJuYW1lLFxyXG4gICAgICBzZW5kZXJfZmlyc3RfbmFtZTogcmF3Py5zZW5kZXJfZmlyc3RfbmFtZSxcclxuICAgICAgc2VuZGVyX2xhc3RfbmFtZTogcmF3Py5zZW5kZXJfbGFzdF9uYW1lLFxyXG4gICAgICBtZXNzYWdlX3R5cGU6IChyYXc/Lm1lc3NhZ2VfdHlwZSA/PyByYXc/Lm1lc3NhZ2VUeXBlID8/ICdURVhUJykgYXMgTWVzc2FnZVsnbWVzc2FnZV90eXBlJ10sXHJcbiAgICAgIGNvbnRlbnQ6IHJhdz8uY29udGVudCA/PyAnJyxcclxuICAgICAgbWVkaWFfdXJsOiByYXc/Lm1lZGlhX3VybCA/PyByYXc/Lm1lZGlhVXJsID8/IHJhdz8udXJsID8/IHJhdz8uZmlsZV91cmwsXHJcbiAgICAgIGNyZWF0ZWRfYXQ6IHJhdz8uY3JlYXRlZF9hdCA/PyByYXc/LmNyZWF0ZWRBdCA/PyBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXHJcbiAgICAgIGlzX3JlYWQ6IHJhdz8uaXNfcmVhZCxcclxuICAgICAgcmVhY3Rpb25zOiByYXc/LnJlYWN0aW9ucyxcclxuICAgICAgbWVudGlvbnM6IHJhdz8ubWVudGlvbnMsXHJcbiAgICAgIGF0dGFjaG1lbnRzOiByYXc/LmF0dGFjaG1lbnRzLFxyXG4gICAgICBpc19waW5uZWQ6IHJhdz8uaXNfcGlubmVkLFxyXG4gICAgICBwaW5uZWRfYXQ6IHJhdz8ucGlubmVkX2F0LFxyXG4gICAgICBwaW5uZWRfYnk6IHJhdz8ucGlubmVkX2J5LFxyXG4gICAgfTtcclxuXHJcbiAgICBjb25zdCB1dWlkUmUgPVxyXG4gICAgICAvXlswLTlhLWZdezh9LVswLTlhLWZdezR9LVsxLTVdWzAtOWEtZl17M30tWzg5YWJdWzAtOWEtZl17M30tWzAtOWEtZl17MTJ9JC9pO1xyXG5cclxuICAgIC8vIE5vcm1hbGl6ZSBhdHRhY2htZW50IG9iamVjdHMgKEFQSSBtYXkgdXNlIGZpbGVJZCAvIGlkIGluc3RlYWQgb2YgZmlsZV9pZCkuXHJcbiAgICBpZiAoQXJyYXkuaXNBcnJheShiYXNlLmF0dGFjaG1lbnRzKSAmJiBiYXNlLmF0dGFjaG1lbnRzLmxlbmd0aCA+IDApIHtcclxuICAgICAgY29uc3QgbWFwcGVkOiBBdHRhY2htZW50W10gPSAoYmFzZS5hdHRhY2htZW50cyBhcyBhbnlbXSkubWFwKChhKSA9PiAoe1xyXG4gICAgICAgIGZpbGVfaWQ6IFN0cmluZyhcclxuICAgICAgICAgIGE/LmZpbGVfaWQgPz8gYT8uZmlsZUlkID8/IGE/LmlkID8/IGE/LmF0dGFjaG1lbnRfaWQgPz8gYT8uc3RvcmFnZV9maWxlX2lkID8/ICcnXHJcbiAgICAgICAgKS50cmltKCksXHJcbiAgICAgICAgZmlsZW5hbWU6IFN0cmluZyhhPy5maWxlbmFtZSA/PyBhPy5maWxlX25hbWUgPz8gYT8ubmFtZSA/PyBhPy5vcmlnaW5hbF9maWxlbmFtZSA/PyAnJyksXHJcbiAgICAgICAgbWltZV90eXBlOiBhPy5taW1lX3R5cGUgPz8gYT8ubWltZVR5cGUsXHJcbiAgICAgICAgdXJsOiBhPy51cmwgPz8gYT8uZmlsZV91cmwgPz8gYT8uZG93bmxvYWRfdXJsLFxyXG4gICAgICB9KSkuZmlsdGVyKChhKSA9PiAhIWEuZmlsZV9pZCAmJiAhYS5maWxlX2lkLnN0YXJ0c1dpdGgoJ3RlbXAtJykpO1xyXG5cclxuICAgICAgaWYgKG1hcHBlZC5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgcmV0dXJuIHsgLi4uYmFzZSwgYXR0YWNobWVudHM6IG1hcHBlZCB9O1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLy8gUmVjb25zdHJ1Y3QgYXR0YWNobWVudHMgZnJvbSBhbHRlcm5hdGUgQVBJIGZpZWxkcy5cclxuICAgIGxldCBhdHRhY2htZW50SWRzOiBzdHJpbmdbXSA9IFtdO1xyXG4gICAgaWYgKEFycmF5LmlzQXJyYXkocmF3Py5hdHRhY2htZW50X2lkcykpIHtcclxuICAgICAgYXR0YWNobWVudElkcyA9IHJhdy5hdHRhY2htZW50X2lkcy5tYXAoKHg6IGFueSkgPT4gU3RyaW5nKHgpLnRyaW0oKSkuZmlsdGVyKEJvb2xlYW4pO1xyXG4gICAgfSBlbHNlIGlmICh0eXBlb2YgcmF3Py5hdHRhY2htZW50X2lkcyA9PT0gJ3N0cmluZycgJiYgcmF3LmF0dGFjaG1lbnRfaWRzLnRyaW0oKSkge1xyXG4gICAgICBhdHRhY2htZW50SWRzID0gcmF3LmF0dGFjaG1lbnRfaWRzXHJcbiAgICAgICAgLnNwbGl0KC9bLFxcc10rLylcclxuICAgICAgICAubWFwKChzOiBzdHJpbmcpID0+IHMudHJpbSgpKVxyXG4gICAgICAgIC5maWx0ZXIoQm9vbGVhbik7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGF0dGFjaG1lbnRJZHMubGVuZ3RoID09PSAwICYmIEFycmF5LmlzQXJyYXkocmF3Py5maWxlX2lkcykpIHtcclxuICAgICAgYXR0YWNobWVudElkcyA9IHJhdy5maWxlX2lkcy5tYXAoKHg6IGFueSkgPT4gU3RyaW5nKHgpLnRyaW0oKSkuZmlsdGVyKEJvb2xlYW4pO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHB1c2hJZCA9ICh2OiBhbnkpID0+IHtcclxuICAgICAgY29uc3QgcyA9IHYgIT0gbnVsbCAmJiB2ICE9PSAnJyA/IFN0cmluZyh2KS50cmltKCkgOiAnJztcclxuICAgICAgaWYgKHMgJiYgIWF0dGFjaG1lbnRJZHMuaW5jbHVkZXMocykpIGF0dGFjaG1lbnRJZHMucHVzaChzKTtcclxuICAgIH07XHJcblxyXG4gICAgcHVzaElkKHJhdz8uZmlsZV9pZCk7XHJcbiAgICBwdXNoSWQocmF3Py5hdHRhY2htZW50X2lkKTtcclxuICAgIHB1c2hJZChyYXc/LnN0b3JhZ2VfZmlsZV9pZCk7XHJcbiAgICBwdXNoSWQocmF3Py5ibG9iX2lkKTtcclxuXHJcbiAgICAvLyBCYWNrZW5kIHN0b3JlcyBmaXJzdCBhdHRhY2htZW50IGlkIGluIG1lc3NhZ2luZy5tZXNzYWdlLm1lZGlhX3VybCAoVVVJRCksIG5vdCBhIHB1YmxpYyBVUkwuXHJcbiAgICBjb25zdCBtZWRpYUFzSWQgPSBTdHJpbmcoYmFzZS5tZWRpYV91cmwgfHwgJycpLnRyaW0oKTtcclxuICAgIGlmIChcclxuICAgICAgbWVkaWFBc0lkICYmXHJcbiAgICAgICFtZWRpYUFzSWQuc3RhcnRzV2l0aCgnaHR0cDovLycpICYmXHJcbiAgICAgICFtZWRpYUFzSWQuc3RhcnRzV2l0aCgnaHR0cHM6Ly8nKSAmJlxyXG4gICAgICAhbWVkaWFBc0lkLnN0YXJ0c1dpdGgoJ2RhdGE6JylcclxuICAgICkge1xyXG4gICAgICBwdXNoSWQobWVkaWFBc0lkKTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBjb250ZW50VHJpbSA9IFN0cmluZyhiYXNlLmNvbnRlbnQgfHwgJycpLnRyaW0oKTtcclxuICAgIGlmIChhdHRhY2htZW50SWRzLmxlbmd0aCA9PT0gMCAmJiB1dWlkUmUudGVzdChjb250ZW50VHJpbSkpIHtcclxuICAgICAgYXR0YWNobWVudElkcy5wdXNoKGNvbnRlbnRUcmltKTtcclxuICAgIH1cclxuICAgIC8vIFNvbWUgQVBJcyBzdG9yZSBzdG9yYWdlIC8gYXR0YWNobWVudCBpZCBhcyBudW1lcmljIHN0cmluZyBpbiBjb250ZW50IGZvciBGSUxFIG1lc3NhZ2VzLlxyXG4gICAgaWYgKFxyXG4gICAgICBhdHRhY2htZW50SWRzLmxlbmd0aCA9PT0gMCAmJlxyXG4gICAgICAvXlxcZCskLy50ZXN0KGNvbnRlbnRUcmltKSAmJlxyXG4gICAgICAoYmFzZS5tZXNzYWdlX3R5cGUgPT09ICdGSUxFJyB8fCBiYXNlLm1lc3NhZ2VfdHlwZSA9PT0gJ0lNQUdFJylcclxuICAgICkge1xyXG4gICAgICBhdHRhY2htZW50SWRzLnB1c2goY29udGVudFRyaW0pO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGZpbGVuYW1lczogc3RyaW5nW10gPSBBcnJheS5pc0FycmF5KHJhdz8uZmlsZW5hbWVzKVxyXG4gICAgICA/IHJhdy5maWxlbmFtZXMubWFwKCh4OiBhbnkpID0+IFN0cmluZyh4KSlcclxuICAgICAgOiByYXc/LmZpbGVuYW1lXHJcbiAgICAgID8gW1N0cmluZyhyYXcuZmlsZW5hbWUpXVxyXG4gICAgICA6IHJhdz8uZmlsZV9uYW1lXHJcbiAgICAgID8gW1N0cmluZyhyYXcuZmlsZV9uYW1lKV1cclxuICAgICAgOiBiYXNlLmNvbnRlbnQgJiYgIXV1aWRSZS50ZXN0KGNvbnRlbnRUcmltKVxyXG4gICAgICA/IFtTdHJpbmcoYmFzZS5jb250ZW50KV1cclxuICAgICAgOiBbXTtcclxuXHJcbiAgICBpZiAoYXR0YWNobWVudElkcy5sZW5ndGggPiAwIHx8IGZpbGVuYW1lcy5sZW5ndGggPiAwKSB7XHJcbiAgICAgIGNvbnN0IGZhbGxiYWNrTWltZSA9IHJhdz8ubWltZV90eXBlID8/IHJhdz8uYXR0YWNobWVudF9taW1lX3R5cGU7XHJcbiAgICAgIGNvbnN0IHVybEZhbGxiYWNrID0gcmF3Py5maWxlX3VybCA/PyByYXc/LnVybCA/PyByYXc/Lm1lZGlhX3VybCA/PyByYXc/Lm1lZGlhVXJsO1xyXG4gICAgICBjb25zdCBpZHMgPSBhdHRhY2htZW50SWRzLmxlbmd0aCA+IDAgPyBhdHRhY2htZW50SWRzIDogW107XHJcbiAgICAgIGNvbnN0IGJ1aWx0OiBBdHRhY2htZW50W10gPSBpZHMubWFwKChpZCwgaWR4KSA9PiAoe1xyXG4gICAgICAgIGZpbGVfaWQ6IGlkLFxyXG4gICAgICAgIGZpbGVuYW1lOiBmaWxlbmFtZXNbaWR4XSB8fCBmaWxlbmFtZXNbMF0gfHwgYEF0dGFjaG1lbnQgJHtpZHggKyAxfWAsXHJcbiAgICAgICAgbWltZV90eXBlOiBmYWxsYmFja01pbWUsXHJcbiAgICAgICAgdXJsOiB1cmxGYWxsYmFjayxcclxuICAgICAgfSkpO1xyXG5cclxuICAgICAgLy8gRmlsZW5hbWUgb25seSArIGRpcmVjdCBVUkwgKG5vIHN0b3JhZ2UgaWQpOiBzdGlsbCByZW5kZXJhYmxlIGFzIDxpbWcgc3JjPi5cclxuICAgICAgaWYgKFxyXG4gICAgICAgIGJ1aWx0Lmxlbmd0aCA9PT0gMCAmJlxyXG4gICAgICAgIGZpbGVuYW1lcy5sZW5ndGggPiAwICYmXHJcbiAgICAgICAgdXJsRmFsbGJhY2sgJiZcclxuICAgICAgICBTdHJpbmcodXJsRmFsbGJhY2spLm1hdGNoKC9eaHR0cHM/OlxcL1xcLy9pKVxyXG4gICAgICApIHtcclxuICAgICAgICBidWlsdC5wdXNoKHtcclxuICAgICAgICAgIGZpbGVfaWQ6ICcnLFxyXG4gICAgICAgICAgZmlsZW5hbWU6IGZpbGVuYW1lc1swXSxcclxuICAgICAgICAgIG1pbWVfdHlwZTogZmFsbGJhY2tNaW1lLFxyXG4gICAgICAgICAgdXJsOiBTdHJpbmcodXJsRmFsbGJhY2spLFxyXG4gICAgICAgIH0pO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBpZiAoYnVpbHQubGVuZ3RoID4gMCkge1xyXG4gICAgICAgIHJldHVybiB7IC4uLmJhc2UsIGF0dGFjaG1lbnRzOiBidWlsdCB9O1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIGJhc2U7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHBsYXlOb3RpZmljYXRpb25Tb3VuZCgpOiB2b2lkIHtcclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IGF1ZGlvID0gbmV3IEF1ZGlvKCdkYXRhOmF1ZGlvL3dhdjtiYXNlNjQsVWtsR1Jub0dBQUJYUVZaRlptMTBJQkFBQUFBQkFBRUFRQjhBQUVBZkFBQUJBQWdBWkdGMFlRb0dBQUNCaFlxRmJGMWZkSml2ckpCaE5qVmdvZERicTJFY0JqK2EyL0xEY2lVRkxJSE84dGlKTndnWmFMdnQ1NTlORUF4UXArUHd0bU1jQmppUjEvTE1lU3dGSkhmSDhOMlFRQW9VWHJUcDY2aFZGQXBHbitEeXZtd2hCU3VCenZMWmlUWUlHR1M1N09paFVCRUxUS1hoOGJsbEhBVTJqZFh6em4wdkJTaCt6UExhaXpzS0ZHQ3o2T3lyV0JRTFNLRGY4c0Z1SXdVdWc4L3kyNGszQ0Joa3Urem9vVkFSQzB5bDRmRzVaUndGTm8zVjg4NTlMd1VvZnN6eTJvczdDaFJncytqc3ExZ1ZDMGlnMy9MQmJpTUZMb0xQOHR1Sk53Z1laTHZzNktGUUVRdE1wZUh4dVdVY0JUYU4xZlBPZlM4RktIN004dHFMT3dvVVlMUG83S3RZRlF0SW9OL3l3VzRqQlM2Q3ovTGJpVGNJR0dTNzdPaWhVQkVMVEtYaDhibGxIQVUyamRYenpuMHZCU2grelBMYWl6c0tGR0N6Nk95cldCVUxTS0RmOHNGdUl3VXVncy95MjRrM0NCaGt1K3pvb1ZBUkMweWw0Zkc1WlJ3Rk5vM1Y4ODU5THdVb2Zzenkyb3M3Q2hSZ3MranNxMWdWQzBpZzMvTEJiaU1GTG9MUDh0dUpOd2dZWkx2czZLRlFFUXRNcGVIeHVXVWNCVGFOMWZQT2ZTOEZLSDdNOHRxTE93b1VZTFBvN0t0WUZRdElvTi95d1c0akJTNkN6L0xiaVRjSUdHUzc3T2loVUJFTFRLWGg4YmxsSEFVMmpkWHp6bjB2QlNoK3pQTGFpenNLRkdDejZPeXJXQlVMU0tEZjhzRnVJd1V1Z3MveTI0azNDQmhrdSt6b29WQVJDMHlsNGZHNVpSd0ZObzNWODg1OUx3VW9mc3p5Mm9zN0NoUmdzK2pzcTFnVkMwaWczL0xCYmlNRkxvTFA4dHVKTndnWVpMdnM2S0ZRRVF0TXBlSHh1V1VjQlRhTjFmUE9mUzhGS0g3TTh0cUxPd29VWUxQbzdLdFlGUXRJb04veXdXNGpCUzZDei9MYmlUY0lHR1M3N09paFVCRUxUS1hoOGJsbEhBVTJqZFh6em4wdkJTaCt6UExhaXpzS0ZHQ3o2T3lyV0JVTFNLRGY4c0Z1SXdVdWdzL3kyNGszQ0Joa3Urem9vVkFSQzB5bDRmRzVaUndGTm8zVjg4NTlMd1VvZnN6eTJvczdDaFJncytqc3ExZ1ZDMGlnMy9MQmJpTUZMb0xQOHR1Sk53Z1laTHZzNktGUUVRdE1wZUh4dVdVY0JUYU4xZlBPZlM4RktIN004dHFMT3dvVVlMUG83S3RZRlF0SW9OL3l3VzRqQlM2Q3ovTGJpVGNJR0dTNzdPaWhVQkVMVEtYaDhibGxIQVUyamRYenpuMHZCU2grelBMYWl6c0tGR0N6Nk95cldCVUxTS0RmOHNGdUl3VXVncy95MjRrM0NCaGt1K3pvb1ZBUkMweWw0Zkc1WlJ3Rk5vM1Y4ODU5THdVb2Zzenkyb3M3Q2hSZ3MranNxMWdWQzBpZzMvTEJiaU1GTG9MUDh0dUpOd2dZWkx2czZLRlFFUXRNcGVIeHVXVWNCVGFOMWZQT2ZTOEZLSDdNOHRxTE93b1VZTFBvN0t0WUZRdElvTi95d1c0akJTNkN6L0xiaVRjSUdHUzc3T2loVUJFTFRLWGg4YmxsSEFVMmpkWHp6bjB2QlNoK3pQTGFpenNLRkdDejZPeXJXQlVMU0tEZjhzRnVJd1V1Z3MveTI0azNDQmhrdSt6b29WQVJDMHlsNGZHNVpSd0ZObzNWODg1OUx3VW9mc3p5Jyk7XHJcbiAgICAgIGF1ZGlvLnZvbHVtZSA9IDAuMztcclxuICAgICAgYXVkaW8ucGxheSgpLmNhdGNoKCgpID0+IHt9KTtcclxuICAgIH0gY2F0Y2gge1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSByZWNhbGNVbnJlYWQoaXRlbXM6IEluYm94SXRlbVtdKTogdm9pZCB7XHJcbiAgICBjb25zdCB0b3RhbCA9IGl0ZW1zLnJlZHVjZSgoc3VtLCBpKSA9PiBzdW0gKyBOdW1iZXIoaS51bnJlYWRfY291bnQgfHwgMCksIDApO1xyXG4gICAgdGhpcy50b3RhbFVucmVhZCQubmV4dCh0b3RhbCk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGh5ZHJhdGVSZWFjdGlvbnNGb3JDb252ZXJzYXRpb24oY29udmVyc2F0aW9uSWQ6IHN0cmluZywgbWVzc2FnZXM6IE1lc3NhZ2VbXSk6IHZvaWQge1xyXG4gICAgY29uc3QgZmV0Y2hhYmxlID0gbWVzc2FnZXMuZmlsdGVyKFxyXG4gICAgICAobSkgPT4gISFtLm1lc3NhZ2VfaWQgJiYgIVN0cmluZyhtLm1lc3NhZ2VfaWQpLnN0YXJ0c1dpdGgoJ3RlbXAtJylcclxuICAgICk7XHJcbiAgICBpZiAoIWZldGNoYWJsZS5sZW5ndGgpIHJldHVybjtcclxuXHJcbiAgICBjb25zdCBqb2JzID0gZmV0Y2hhYmxlLm1hcCgobSkgPT5cclxuICAgICAgdGhpcy5hcGkuZ2V0UmVhY3Rpb25zKG0ubWVzc2FnZV9pZCkucGlwZShcclxuICAgICAgICBtYXAoKHJvd3MpID0+ICh7IG1lc3NhZ2VJZDogbS5tZXNzYWdlX2lkLCByZWFjdGlvbnM6IHRoaXMubm9ybWFsaXplUmVhY3Rpb25Sb3dzKHJvd3MpIH0pKSxcclxuICAgICAgICBjYXRjaEVycm9yKCgpID0+IG9mKHsgbWVzc2FnZUlkOiBtLm1lc3NhZ2VfaWQsIHJlYWN0aW9uczogW10gfSkpXHJcbiAgICAgIClcclxuICAgICk7XHJcblxyXG4gICAgZm9ya0pvaW4oam9icykuc3Vic2NyaWJlKChyZXN1bHRzKSA9PiB7XHJcbiAgICAgIGNvbnN0IG1hcCA9IG5ldyBNYXAodGhpcy5tZXNzYWdlc01hcCQudmFsdWUpO1xyXG4gICAgICBjb25zdCBjdXJyZW50ID0gWy4uLihtYXAuZ2V0KGNvbnZlcnNhdGlvbklkKSB8fCBbXSldO1xyXG4gICAgICBpZiAoIWN1cnJlbnQubGVuZ3RoKSByZXR1cm47XHJcblxyXG4gICAgICBsZXQgY2hhbmdlZCA9IGZhbHNlO1xyXG4gICAgICBmb3IgKGNvbnN0IHJlc3VsdCBvZiByZXN1bHRzKSB7XHJcbiAgICAgICAgY29uc3QgaWR4ID0gY3VycmVudC5maW5kSW5kZXgoKG0pID0+IFN0cmluZyhtLm1lc3NhZ2VfaWQpID09PSBTdHJpbmcocmVzdWx0Lm1lc3NhZ2VJZCkpO1xyXG4gICAgICAgIGlmIChpZHggPT09IC0xKSBjb250aW51ZTtcclxuICAgICAgICBjdXJyZW50W2lkeF0gPSB7IC4uLmN1cnJlbnRbaWR4XSwgcmVhY3Rpb25zOiByZXN1bHQucmVhY3Rpb25zIH07XHJcbiAgICAgICAgY2hhbmdlZCA9IHRydWU7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGlmIChjaGFuZ2VkKSB7XHJcbiAgICAgICAgbWFwLnNldChjb252ZXJzYXRpb25JZCwgY3VycmVudCk7XHJcbiAgICAgICAgdGhpcy5tZXNzYWdlc01hcCQubmV4dChtYXApO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgcmVmcmVzaE1lc3NhZ2VSZWFjdGlvbnMobWVzc2FnZUlkOiBzdHJpbmcpOiB2b2lkIHtcclxuICAgIGlmICghbWVzc2FnZUlkIHx8IFN0cmluZyhtZXNzYWdlSWQpLnN0YXJ0c1dpdGgoJ3RlbXAtJykpIHJldHVybjtcclxuXHJcbiAgICB0aGlzLmFwaS5nZXRSZWFjdGlvbnMobWVzc2FnZUlkKS5zdWJzY3JpYmUoe1xyXG4gICAgICBuZXh0OiAocm93cykgPT4ge1xyXG4gICAgICAgIGNvbnN0IG5vcm1hbGl6ZWQgPSB0aGlzLm5vcm1hbGl6ZVJlYWN0aW9uUm93cyhyb3dzKTtcclxuICAgICAgICBjb25zdCBtYXAgPSBuZXcgTWFwKHRoaXMubWVzc2FnZXNNYXAkLnZhbHVlKTtcclxuICAgICAgICBsZXQgY2hhbmdlZCA9IGZhbHNlO1xyXG5cclxuICAgICAgICBmb3IgKGNvbnN0IFtjb252ZXJzYXRpb25JZCwgbXNnc10gb2YgbWFwLmVudHJpZXMoKSkge1xyXG4gICAgICAgICAgY29uc3QgaWR4ID0gbXNncy5maW5kSW5kZXgoKG0pID0+IFN0cmluZyhtLm1lc3NhZ2VfaWQpID09PSBTdHJpbmcobWVzc2FnZUlkKSk7XHJcbiAgICAgICAgICBpZiAoaWR4ID09PSAtMSkgY29udGludWU7XHJcbiAgICAgICAgICBjb25zdCBuZXh0TXNncyA9IFsuLi5tc2dzXTtcclxuICAgICAgICAgIG5leHRNc2dzW2lkeF0gPSB7IC4uLm5leHRNc2dzW2lkeF0sIHJlYWN0aW9uczogbm9ybWFsaXplZCB9O1xyXG4gICAgICAgICAgbWFwLnNldChjb252ZXJzYXRpb25JZCwgbmV4dE1zZ3MpO1xyXG4gICAgICAgICAgY2hhbmdlZCA9IHRydWU7XHJcbiAgICAgICAgICBicmVhaztcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmIChjaGFuZ2VkKSB7XHJcbiAgICAgICAgICB0aGlzLm1lc3NhZ2VzTWFwJC5uZXh0KG1hcCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9LFxyXG4gICAgICBlcnJvcjogKCkgPT4ge30sXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgbm9ybWFsaXplUmVhY3Rpb25Sb3dzKHJvd3M6IGFueVtdKTogYW55W10ge1xyXG4gICAgY29uc3QgYnlFbW9qaSA9IG5ldyBNYXA8c3RyaW5nLCB7IGVtb2ppOiBzdHJpbmc7IGNvdW50OiBudW1iZXI7IGhhc1JlYWN0ZWQ6IGJvb2xlYW47IHJlYWN0b3JzOiBzdHJpbmdbXSB9PigpO1xyXG4gICAgY29uc3QgbXlDb250YWN0SWQgPSBTdHJpbmcodGhpcy5hdXRoLmNvbnRhY3RJZCB8fCAnJyk7XHJcbiAgICBjb25zdCBjb250YWN0cyA9IHRoaXMudmlzaWJsZUNvbnRhY3RzJC52YWx1ZTtcclxuXHJcbiAgICBmb3IgKGNvbnN0IHJvdyBvZiByb3dzIHx8IFtdKSB7XHJcbiAgICAgIGNvbnN0IGVtb2ppID0gU3RyaW5nKHJvdz8uZW1vamkgfHwgJycpLnRyaW0oKTtcclxuICAgICAgaWYgKCFlbW9qaSkgY29udGludWU7XHJcblxyXG4gICAgICBjb25zdCBjb250YWN0SWQgPSBTdHJpbmcocm93Py5jb250YWN0X2lkID8/IHJvdz8uY29udGFjdElkID8/ICcnKTtcclxuICAgICAgY29uc3QgZXhwbGljaXRIYXNSZWFjdGVkID0gcm93Py5oYXNSZWFjdGVkID8/IHJvdz8uaGFzX3JlYWN0ZWQ7XHJcbiAgICAgIGNvbnN0IGhhc1JlYWN0ZWQgPSBleHBsaWNpdEhhc1JlYWN0ZWQgPT09IHRydWUgfHwgKGNvbnRhY3RJZCAmJiBjb250YWN0SWQgPT09IG15Q29udGFjdElkKTtcclxuXHJcbiAgICAgIGNvbnN0IGNvdW50RnJvbVJvdyA9IE51bWJlcihyb3c/LmNvdW50ID8/IHJvdz8ucmVhY3Rpb25fY291bnQgPz8gMCk7XHJcbiAgICAgIGNvbnN0IGV4aXN0aW5nID0gYnlFbW9qaS5nZXQoZW1vamkpIHx8IHsgZW1vamksIGNvdW50OiAwLCBoYXNSZWFjdGVkOiBmYWxzZSwgcmVhY3RvcnM6IFtdIH07XHJcblxyXG4gICAgICAvLyBTb21lIEFQSXMgcmV0dXJuIG9uZSByb3cgcGVyIHJlYWN0aW9uOyBzb21lIHJldHVybiBwcmUtYWdncmVnYXRlZCBjb3VudC5cclxuICAgICAgZXhpc3RpbmcuY291bnQgKz0gY291bnRGcm9tUm93ID4gMCA/IGNvdW50RnJvbVJvdyA6IDE7XHJcbiAgICAgIGV4aXN0aW5nLmhhc1JlYWN0ZWQgPSBleGlzdGluZy5oYXNSZWFjdGVkIHx8ICEhaGFzUmVhY3RlZDtcclxuXHJcbiAgICAgIC8vIFRyYWNrIHJlYWN0b3IgZGlzcGxheSBuYW1lcyB3aGVuIGluZGl2aWR1YWwgY29udGFjdElkIGlzIGF2YWlsYWJsZVxyXG4gICAgICBpZiAoY29udGFjdElkICYmIGNvdW50RnJvbVJvdyA8PSAxKSB7XHJcbiAgICAgICAgbGV0IG5hbWU6IHN0cmluZztcclxuICAgICAgICBpZiAoY29udGFjdElkID09PSBteUNvbnRhY3RJZCkge1xyXG4gICAgICAgICAgbmFtZSA9ICdZb3UnO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICBjb25zdCBjb250YWN0ID0gY29udGFjdHMuZmluZChjID0+IFN0cmluZyhjLmNvbnRhY3RfaWQpID09PSBjb250YWN0SWQpO1xyXG4gICAgICAgICAgbmFtZSA9IGNvbnRhY3QgPyBnZXRDb250YWN0RGlzcGxheU5hbWUoY29udGFjdCkgOiBgVXNlciAke2NvbnRhY3RJZH1gO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoIWV4aXN0aW5nLnJlYWN0b3JzLmluY2x1ZGVzKG5hbWUpKSB7XHJcbiAgICAgICAgICBleGlzdGluZy5yZWFjdG9ycy5wdXNoKG5hbWUpO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG5cclxuICAgICAgYnlFbW9qaS5zZXQoZW1vamksIGV4aXN0aW5nKTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gQXJyYXkuZnJvbShieUVtb2ppLnZhbHVlcygpKS5maWx0ZXIoKHIpID0+IHIuY291bnQgPiAwKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgYXBwbHlSZWFjdGlvbk9wdGltaXN0aWNhbGx5KG1lc3NhZ2VJZDogc3RyaW5nLCBlbW9qaTogc3RyaW5nLCBhZGQ6IGJvb2xlYW4pOiB2b2lkIHtcclxuICAgIGNvbnN0IG1hcCA9IG5ldyBNYXAodGhpcy5tZXNzYWdlc01hcCQudmFsdWUpO1xyXG4gICAgbGV0IGRpZFVwZGF0ZSA9IGZhbHNlO1xyXG5cclxuICAgIGZvciAoY29uc3QgW2NvbnZlcnNhdGlvbklkLCBtc2dzXSBvZiBtYXAuZW50cmllcygpKSB7XHJcbiAgICAgIGNvbnN0IGlkeCA9IG1zZ3MuZmluZEluZGV4KChtKSA9PiBTdHJpbmcobS5tZXNzYWdlX2lkKSA9PT0gU3RyaW5nKG1lc3NhZ2VJZCkpO1xyXG4gICAgICBpZiAoaWR4ID09PSAtMSkgY29udGludWU7XHJcblxyXG4gICAgICBjb25zdCB0YXJnZXQgPSBtc2dzW2lkeF07XHJcbiAgICAgIGNvbnN0IG5leHRSZWFjdGlvbnMgPSBbLi4uKHRhcmdldC5yZWFjdGlvbnMgfHwgW10pXTtcclxuICAgICAgY29uc3QgcklkeCA9IG5leHRSZWFjdGlvbnMuZmluZEluZGV4KChyKSA9PiByLmVtb2ppID09PSBlbW9qaSk7XHJcblxyXG4gICAgICBpZiAoYWRkKSB7XHJcbiAgICAgICAgaWYgKHJJZHggPj0gMCkge1xyXG4gICAgICAgICAgY29uc3QgY3VycmVudCA9IG5leHRSZWFjdGlvbnNbcklkeF07XHJcbiAgICAgICAgICBpZiAoIWN1cnJlbnQuaGFzUmVhY3RlZCkge1xyXG4gICAgICAgICAgICBuZXh0UmVhY3Rpb25zW3JJZHhdID0ge1xyXG4gICAgICAgICAgICAgIC4uLmN1cnJlbnQsXHJcbiAgICAgICAgICAgICAgaGFzUmVhY3RlZDogdHJ1ZSxcclxuICAgICAgICAgICAgICBjb3VudDogTnVtYmVyKGN1cnJlbnQuY291bnQgfHwgMCkgKyAxLFxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICBuZXh0UmVhY3Rpb25zLnB1c2goeyBlbW9qaSwgY291bnQ6IDEsIGhhc1JlYWN0ZWQ6IHRydWUgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIGlmIChySWR4ID49IDApIHtcclxuICAgICAgICAgIGNvbnN0IGN1cnJlbnQgPSBuZXh0UmVhY3Rpb25zW3JJZHhdO1xyXG4gICAgICAgICAgY29uc3QgbmV4dENvdW50ID0gTWF0aC5tYXgoTnVtYmVyKGN1cnJlbnQuY291bnQgfHwgMCkgLSAoY3VycmVudC5oYXNSZWFjdGVkID8gMSA6IDApLCAwKTtcclxuICAgICAgICAgIGlmIChuZXh0Q291bnQgPT09IDApIHtcclxuICAgICAgICAgICAgbmV4dFJlYWN0aW9ucy5zcGxpY2UocklkeCwgMSk7XHJcbiAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBuZXh0UmVhY3Rpb25zW3JJZHhdID0ge1xyXG4gICAgICAgICAgICAgIC4uLmN1cnJlbnQsXHJcbiAgICAgICAgICAgICAgaGFzUmVhY3RlZDogZmFsc2UsXHJcbiAgICAgICAgICAgICAgY291bnQ6IG5leHRDb3VudCxcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGNvbnN0IHVwZGF0ZWRNc2c6IE1lc3NhZ2UgPSB7IC4uLnRhcmdldCwgcmVhY3Rpb25zOiBuZXh0UmVhY3Rpb25zIH07XHJcbiAgICAgIGNvbnN0IHVwZGF0ZWRNc2dzID0gWy4uLm1zZ3NdO1xyXG4gICAgICB1cGRhdGVkTXNnc1tpZHhdID0gdXBkYXRlZE1zZztcclxuICAgICAgbWFwLnNldChjb252ZXJzYXRpb25JZCwgdXBkYXRlZE1zZ3MpO1xyXG4gICAgICBkaWRVcGRhdGUgPSB0cnVlO1xyXG4gICAgICBicmVhaztcclxuICAgIH1cclxuXHJcbiAgICBpZiAoZGlkVXBkYXRlKSB7XHJcbiAgICAgIHRoaXMubWVzc2FnZXNNYXAkLm5leHQobWFwKTtcclxuICAgIH1cclxuICB9XHJcbn1cclxuIl19