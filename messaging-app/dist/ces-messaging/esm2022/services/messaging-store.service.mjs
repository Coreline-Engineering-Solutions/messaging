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
                const pickedContent = this.coalesceMessageText(res, optimistic.content);
                const merged = this.normalizeMessageShape({
                    ...optimistic,
                    ...res,
                    message_id: String(realId),
                    conversation_id: conversationId,
                    content: pickedContent,
                });
                const map = new Map(this.messagesMap$.value);
                const msgs = [...(map.get(conversationId) || [])];
                const idx = msgs.findIndex((m) => m.message_id === tempMessageId);
                if (idx >= 0) {
                    msgs[idx] = merged;
                    map.set(conversationId, this.dedupeMessagesByIdKeepFirst(msgs));
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
        let message = this.normalizeMessageShape(data);
        const myContactId = String(this.auth.contactId ?? '');
        const convId = String(message.conversation_id ?? '');
        const existing = this.messagesMap$.value.get(convId) || [];
        const ownEcho = myContactId &&
            String(message.sender_id) === myContactId &&
            !!message.message_id &&
            !String(message.message_id).startsWith('temp-');
        // WS often arrives before HTTP finishes replacing temp-; merge into temp instead of appending a duplicate row.
        if (ownEcho) {
            const tempIdx = existing.findIndex((m) => {
                if (!String(m.message_id).startsWith('temp-'))
                    return false;
                if (String(m.conversation_id) !== convId)
                    return false;
                if (String(m.sender_id) !== myContactId)
                    return false;
                const dt = Math.abs(new Date(m.created_at).getTime() - new Date(message.created_at).getTime());
                if (dt >= 120_000)
                    return false;
                const a = String(m.content ?? '').trim();
                const b = String(message.content ?? '').trim();
                return a === b || !b;
            });
            if (tempIdx >= 0) {
                const merged = this.normalizeMessageShape({
                    ...existing[tempIdx],
                    ...data,
                    message_id: message.message_id,
                    conversation_id: convId,
                    content: this.coalesceMessageText(data, existing[tempIdx].content),
                });
                const map = new Map(this.messagesMap$.value);
                const msgs = this.dedupeMessagesByIdKeepFirst([...existing]);
                msgs[tempIdx] = merged;
                map.set(convId, this.dedupeMessagesByIdKeepFirst(msgs));
                this.messagesMap$.next(map);
                this.refreshMessageReactions(merged.message_id);
                message = merged;
                this.updateInboxPreview(message);
                if (this.activeConversationId$.value === message.conversation_id) {
                    this.markAsRead(message.conversation_id);
                }
                return;
            }
        }
        const isFromOther = String(message.sender_id) !== myContactId;
        const isDuplicate = existing.some((m) => String(m.message_id) === String(message.message_id) ||
            (String(m.sender_id) === String(message.sender_id) &&
                String(m.content ?? '') === String(message.content ?? '') &&
                Math.abs(new Date(m.created_at).getTime() - new Date(message.created_at).getTime()) < 2000));
        if (!isDuplicate) {
            this.appendMessage(message);
            if (isFromOther) {
                this.playNotificationSound();
            }
            this.updateInboxPreview(message);
        }
        if (this.activeConversationId$.value !== message.conversation_id) {
            if (isFromOther && !isDuplicate) {
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
        const text = String(message.content ?? '').trim();
        const media = this.messageLooksLikeMedia(message);
        if (!text && !media) {
            return;
        }
        const preview = text || '[Image]';
        const items = this.inbox$.value.map((item) => {
            if (item.conversation_id === message.conversation_id) {
                return {
                    ...item,
                    last_message_preview: preview,
                    last_message_at: message.created_at,
                };
            }
            return item;
        });
        items.sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
        this.inbox$.next(items);
    }
    /** First non-empty text field from API / WS objects (POST bodies often omit `content`). */
    coalesceMessageText(raw, fallback = '') {
        const cands = [raw?.content, raw?.body, raw?.text, fallback];
        for (const c of cands) {
            if (typeof c === 'string' && c.trim())
                return c;
            if (c != null && typeof c !== 'object' && String(c).trim())
                return String(c).trim();
        }
        return typeof fallback === 'string' ? fallback : String(fallback ?? '');
    }
    messageLooksLikeMedia(m) {
        const t = m.message_type;
        if (t && t !== 'TEXT')
            return true;
        const u = String(m.media_url ?? '').trim();
        if (u && (u.startsWith('http://') || u.startsWith('https://') || u.startsWith('data:'))) {
            return true;
        }
        return Array.isArray(m.attachments) && m.attachments.length > 0;
    }
    /** Same logical message_id can appear twice when WS beats HTTP temp replacement — keep first row. */
    dedupeMessagesByIdKeepFirst(msgs) {
        const seen = new Set();
        return msgs.filter((m) => {
            const id = String(m.message_id ?? '');
            if (!id)
                return true;
            if (seen.has(id))
                return false;
            seen.add(id);
            return true;
        });
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
            content: raw?.content ?? raw?.body ?? raw?.text ?? '',
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVzc2FnaW5nLXN0b3JlLnNlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvbGliL3NlcnZpY2VzL21lc3NhZ2luZy1zdG9yZS5zZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxVQUFVLEVBQWEsTUFBTSxlQUFlLENBQUM7QUFDdEQsT0FBTyxFQUFFLGVBQWUsRUFBRSxVQUFVLEVBQUUsT0FBTyxFQUFnQixRQUFRLEVBQUUsRUFBRSxFQUFFLE1BQU0sTUFBTSxDQUFDO0FBQ3hGLE9BQU8sRUFBRSxVQUFVLEVBQUUsR0FBRyxFQUFFLE1BQU0sZ0JBQWdCLENBQUM7QUFJakQsT0FBTyxFQVFMLHFCQUFxQixHQUV0QixNQUFNLDRCQUE0QixDQUFDOzs7OztBQUdwQyxNQUFNLE9BQU8scUJBQXFCO0lBMkN0QjtJQUNBO0lBQ0E7SUE1Q1YsdUJBQXVCO0lBQ2YsTUFBTSxHQUFHLElBQUksZUFBZSxDQUFjLEVBQUUsQ0FBQyxDQUFDO0lBQzlDLFlBQVksR0FBRyxJQUFJLGVBQWUsQ0FBeUIsSUFBSSxHQUFHLEVBQUUsQ0FBQyxDQUFDO0lBQ3RFLFVBQVUsR0FBRyxJQUFJLGVBQWUsQ0FBZSxFQUFFLENBQUMsQ0FBQztJQUNuRCxnQkFBZ0IsR0FBRyxJQUFJLGVBQWUsQ0FBWSxFQUFFLENBQUMsQ0FBQztJQUN0RCxVQUFVLEdBQUcsSUFBSSxlQUFlLENBQVUsS0FBSyxDQUFDLENBQUM7SUFDakQsV0FBVyxHQUFHLElBQUksZUFBZSxDQUFvRixPQUFPLENBQUMsQ0FBQztJQUM5SCxZQUFZLEdBQUcsSUFBSSxlQUFlLENBQ3ZDLFlBQVksQ0FBQyxPQUFPLENBQUMsd0JBQXdCLENBQWlCLElBQUksT0FBTyxDQUMzRSxDQUFDO0lBQ00scUJBQXFCLEdBQUcsSUFBSSxlQUFlLENBQWdCLElBQUksQ0FBQyxDQUFDO0lBQ2pFLG1CQUFtQixHQUFHLElBQUksZUFBZSxDQUEyQyxJQUFJLENB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Q0FBQztvQkFDaEMsQ0FBQzt5QkFBTSxDQUFDO3dCQUNOLGFBQWEsQ0FBQyxJQUFJLENBQUMsR0FBRzs0QkFDcEIsR0FBRyxPQUFPOzRCQUNWLFVBQVUsRUFBRSxLQUFLOzRCQUNqQixLQUFLLEVBQUUsU0FBUzt5QkFDakIsQ0FBQztvQkFDSixDQUFDO2dCQUNILENBQUM7WUFDSCxDQUFDO1lBRUQsTUFBTSxVQUFVLEdBQVksRUFBRSxHQUFHLE1BQU0sRUFBRSxTQUFTLEVBQUUsYUFBYSxFQUFFLENBQUM7WUFDcEUsTUFBTSxXQUFXLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDO1lBQzlCLFdBQVcsQ0FBQyxHQUFHLENBQUMsR0FBRyxVQUFVLENBQUM7WUFDOUIsR0FBRyxDQUFDLEdBQUcsQ0FBQyxjQUFjLEVBQUUsV0FBVyxDQUFDLENBQUM7WUFDckMsU0FBUyxHQUFHLElBQUksQ0FBQztZQUNqQixNQUFNO1FBQ1IsQ0FBQztRQUVELElBQUksU0FBUyxFQUFFLENBQUM7WUFDZCxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUM5QixDQUFDO0lBQ0gsQ0FBQzt3R0FsbENVLHFCQUFxQjs0R0FBckIscUJBQXFCLGNBRFIsTUFBTTs7NEZBQ25CLHFCQUFxQjtrQkFEakMsVUFBVTttQkFBQyxFQUFFLFVBQVUsRUFBRSxNQUFNLEVBQUUiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBJbmplY3RhYmxlLCBPbkRlc3Ryb3kgfSBmcm9tICdAYW5ndWxhci9jb3JlJztcclxuaW1wb3J0IHsgQmVoYXZpb3JTdWJqZWN0LCBPYnNlcnZhYmxlLCBTdWJqZWN0LCBTdWJzY3JpcHRpb24sIGZvcmtKb2luLCBvZiB9IGZyb20gJ3J4anMnO1xyXG5pbXBvcnQgeyBjYXRjaEVycm9yLCBtYXAgfSBmcm9tICdyeGpzL29wZXJhdG9ycyc7XHJcbmltcG9ydCB7IEF1dGhTZXJ2aWNlIH0gZnJvbSAnLi9hdXRoLnNlcnZpY2UnO1xyXG5pbXBvcnQgeyBNZXNzYWdpbmdBcGlTZXJ2aWNlIH0gZnJvbSAnLi9tZXNzYWdpbmctYXBpLnNlcnZpY2UnO1xyXG5pbXBvcnQgeyBNZXNzYWdpbmdXZWJTb2NrZXRTZXJ2aWNlIH0gZnJvbSAnLi9tZXNzYWdpbmctd2Vic29ja2V0LnNlcnZpY2UnO1xyXG5pbXBvcnQge1xyXG4gIEluYm94SXRlbSxcclxuICBNZXNzYWdlLFxyXG4gIEF0dGFjaG1lbnQsXHJcbiAgQ29udGFjdCxcclxuICBDaGF0V2luZG93LFxyXG4gIFdlYlNvY2tldE1lc3NhZ2UsXHJcbiAgU2lkZWJhclNpZGUsXHJcbiAgZ2V0Q29udGFjdERpc3BsYXlOYW1lLFxyXG4gIGdldE1lc3NhZ2VTZW5kZXJOYW1lLFxyXG59IGZyb20gJy4uL21vZGVscy9tZXNzYWdpbmcubW9kZWxzJztcclxuXHJcbkBJbmplY3RhYmxlKHsgcHJvdmlkZWRJbjogJ3Jvb3QnIH0pXHJcbmV4cG9ydCBjbGFzcyBNZXNzYWdpbmdTdG9yZVNlcnZpY2UgaW1wbGVtZW50cyBPbkRlc3Ryb3kge1xyXG4gIC8vIOKUgOKUgCBTdGF0ZSBzdWJqZWN0cyDilIDilIBcclxuICBwcml2YXRlIGluYm94JCA9IG5ldyBCZWhhdmlvclN1YmplY3Q8SW5ib3hJdGVtW10+KFtdKTtcclxuICBwcml2YXRlIG1lc3NhZ2VzTWFwJCA9IG5ldyBCZWhhdmlvclN1YmplY3Q8TWFwPHN0cmluZywgTWVzc2FnZVtdPj4obmV3IE1hcCgpKTtcclxuICBwcml2YXRlIG9wZW5DaGF0cyQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PENoYXRXaW5kb3dbXT4oW10pO1xyXG4gIHByaXZhdGUgdmlzaWJsZUNvbnRhY3RzJCA9IG5ldyBCZWhhdmlvclN1YmplY3Q8Q29udGFjdFtdPihbXSk7XHJcbiAgcHJpdmF0ZSBwYW5lbE9wZW4kID0gbmV3IEJlaGF2aW9yU3ViamVjdDxib29sZWFuPihmYWxzZSk7XHJcbiAgcHJpdmF0ZSBhY3RpdmVWaWV3JCA9IG5ldyBCZWhhdmlvclN1YmplY3Q8J2luYm94JyB8ICdjaGF0JyB8ICduZXctY29udmVyc2F0aW9uJyB8ICdncm91cC1tYW5hZ2VyJyB8ICdjb252ZXJzYXRpb24tc2V0dGluZ3MnPignaW5ib3gnKTtcclxuICBwcml2YXRlIHNpZGViYXJTaWRlJCA9IG5ldyBCZWhhdmlvclN1YmplY3Q8U2lkZWJhclNpZGU+KFxyXG4gICAgKGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdtZXNzYWdpbmdfc2lkZWJhcl9zaWRlJykgYXMgU2lkZWJhclNpZGUpIHx8ICdyaWdodCdcclxuICApO1xyXG4gIHByaXZhdGUgYWN0aXZlQ29udmVyc2F0aW9uSWQkID0gbmV3IEJlaGF2aW9yU3ViamVjdDxzdHJpbmcgfCBudWxsPihudWxsKTtcclxuICBwcml2YXRlIHBlbmRpbmdEbVJlY2lwaWVudCQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PHtjb250YWN0SWQ6IHN0cmluZywgbmFtZTogc3RyaW5nfSB8IG51bGw+KG51bGwpO1xyXG4gIHByaXZhdGUgdG90YWxVbnJlYWQkID0gbmV3IEJlaGF2aW9yU3ViamVjdDxudW1iZXI+KDApO1xyXG4gIHByaXZhdGUgbG9hZGluZ01lc3NhZ2VzJCA9IG5ldyBCZWhhdmlvclN1YmplY3Q8Ym9vbGVhbj4oZmFsc2UpO1xyXG4gIHByaXZhdGUgcGFuZWxQb3NpdGlvbiQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PHsgeDogbnVtYmVyOyB5OiBudW1iZXIgfSB8IG51bGw+KG51bGwpO1xyXG4gIHByaXZhdGUgcGFuZWxTaXplJCA9IG5ldyBCZWhhdmlvclN1YmplY3Q8eyB3aWR0aDogbnVtYmVyOyBoZWlnaHQ6IG51bWJlciB9Pih7IHdpZHRoOiAzODAsIGhlaWdodDogNTYwIH0pO1xyXG4gIHByaXZhdGUgd2FzT3BlbkJlZm9yZURyYWckID0gbmV3IEJlaGF2aW9yU3ViamVjdDxib29sZWFuPihmYWxzZSk7XHJcblxyXG4gIC8vIOKUgOKUgCBQdWJsaWMgb2JzZXJ2YWJsZXMg4pSA4pSAXHJcbiAgcmVhZG9ubHkgaW5ib3ggPSB0aGlzLmluYm94JC5hc09ic2VydmFibGUoKTtcclxuICByZWFkb25seSBtZXNzYWdlc01hcCA9IHRoaXMubWVzc2FnZXNNYXAkLmFzT2JzZXJ2YWJsZSgpO1xyXG4gIHJlYWRvbmx5IG9wZW5DaGF0cyA9IHRoaXMub3BlbkNoYXRzJC5hc09ic2VydmFibGUoKTtcclxuICByZWFkb25seSB2aXNpYmxlQ29udGFjdHMgPSB0aGlzLnZpc2libGVDb250YWN0cyQuYXNPYnNlcnZhYmxlKCk7XHJcbiAgcmVhZG9ubHkgcGFuZWxPcGVuID0gdGhpcy5wYW5lbE9wZW4kLmFzT2JzZXJ2YWJsZSgpO1xyXG4gIHJlYWRvbmx5IGFjdGl2ZVZpZXcgPSB0aGlzLmFjdGl2ZVZpZXckLmFzT2JzZXJ2YWJsZSgpO1xyXG4gIHJlYWRvbmx5IGFjdGl2ZUNvbnZlcnNhdGlvbklkID0gdGhpcy5hY3RpdmVDb252ZXJzYXRpb25JZCQuYXNPYnNlcnZhYmxlKCk7XHJcbiAgcmVhZG9ubHkgdG90YWxVbnJlYWQgPSB0aGlzLnRvdGFsVW5yZWFkJC5hc09ic2VydmFibGUoKTtcclxuICByZWFkb25seSBsb2FkaW5nTWVzc2FnZXMgPSB0aGlzLmxvYWRpbmdNZXNzYWdlcyQuYXNPYnNlcnZhYmxlKCk7XHJcbiAgd3NTdGF0dXM6IE9ic2VydmFibGU8c3RyaW5nPiA9IG5ldyBPYnNlcnZhYmxlPHN0cmluZz4oKTtcclxuICByZWFkb25seSBwYW5lbFBvc2l0aW9uID0gdGhpcy5wYW5lbFBvc2l0aW9uJC5hc09ic2VydmFibGUoKTtcclxuICByZWFkb25seSBwYW5lbFNpemUgPSB0aGlzLnBhbmVsU2l6ZSQuYXNPYnNlcnZhYmxlKCk7XHJcbiAgcmVhZG9ubHkgd2FzT3BlbkJlZm9yZURyYWcgPSB0aGlzLndhc09wZW5CZWZvcmVEcmFnJC5hc09ic2VydmFibGUoKTtcclxuICByZWFkb25seSBzaWRlYmFyU2lkZSA9IHRoaXMuc2lkZWJhclNpZGUkLmFzT2JzZXJ2YWJsZSgpO1xyXG5cclxuICBwcml2YXRlIHdzU3ViOiBTdWJzY3JpcHRpb24gfCBudWxsID0gbnVsbDtcclxuICBwcml2YXRlIGRlc3Ryb3kkID0gbmV3IFN1YmplY3Q8dm9pZD4oKTtcclxuICBwcml2YXRlIHBvbGxUaW1lcjogYW55ID0gbnVsbDtcclxuICBwcml2YXRlIGdyb3VwU2V0dGluZ3MkID0gbmV3IEJlaGF2aW9yU3ViamVjdDx7IGNvbnZlcnNhdGlvbklkOiBzdHJpbmc7IG5hbWU6IHN0cmluZyB9IHwgbnVsbD4obnVsbCk7XHJcblxyXG4gIHJlYWRvbmx5IGdyb3VwU2V0dGluZ3MgPSB0aGlzLmdyb3VwU2V0dGluZ3MkLmFzT2JzZXJ2YWJsZSgpO1xyXG5cclxuICBjb25zdHJ1Y3RvcihcclxuICAgIHByaXZhdGUgYXV0aDogQXV0aFNlcnZpY2UsXHJcbiAgICBwcml2YXRlIGFwaTogTWVzc2FnaW5nQXBpU2VydmljZSxcclxuICAgIHByaXZhdGUgd3NTZXJ2aWNlOiBNZXNzYWdpbmdXZWJTb2NrZXRTZXJ2aWNlXHJcbiAgKSB7XHJcbiAgICAodGhpcyBhcyBhbnkpLndzU3RhdHVzID0gdGhpcy53c1NlcnZpY2Uuc3RhdHVzJDtcclxuICB9XHJcblxyXG4gIC8vIOKUgOKUgCBJbml0aWFsaXphdGlvbiDilIDilIBcclxuICBpbml0aWFsaXplKCk6IHZvaWQge1xyXG4gICAgaWYgKCF0aGlzLmF1dGguaXNBdXRoZW50aWNhdGVkKCkpIHJldHVybjtcclxuXHJcbiAgICBjb25zdCBjb250YWN0SWQgPSB0aGlzLmF1dGguY29udGFjdElkITtcclxuICAgIGNvbnN0IHNlc3Npb25HaWQgPSB0aGlzLmF1dGguc2Vzc2lvbkdpZCE7XHJcblxyXG4gICAgdGhpcy5sb2FkSW5ib3goKTtcclxuICAgIHRoaXMubG9hZFZpc2libGVDb250YWN0cygpO1xyXG5cclxuICAgIHRoaXMud3NTZXJ2aWNlLmNvbm5lY3QoY29udGFjdElkLCBzZXNzaW9uR2lkKTtcclxuICAgIHRoaXMubGlzdGVuV2ViU29ja2V0KCk7XHJcbiAgICB0aGlzLnN0YXJ0UG9sbGluZygpO1xyXG4gIH1cclxuXHJcbiAgdGVhcmRvd24oKTogdm9pZCB7XHJcbiAgICB0aGlzLnN0b3BQb2xsaW5nKCk7XHJcbiAgICB0aGlzLndzU2VydmljZS5kaXNjb25uZWN0KCk7XHJcbiAgICB0aGlzLndzU3ViPy51bnN1YnNjcmliZSgpO1xyXG4gICAgdGhpcy5pbmJveCQubmV4dChbXSk7XHJcbiAgICB0aGlzLm1lc3NhZ2VzTWFwJC5uZXh0KG5ldyBNYXAoKSk7XHJcbiAgICB0aGlzLm9wZW5DaGF0cyQubmV4dChbXSk7XHJcbiAgICB0aGlzLnBhbmVsT3BlbiQubmV4dChmYWxzZSk7XHJcbiAgICB0aGlzLmFjdGl2ZVZpZXckLm5leHQoJ2luYm94Jyk7XHJcbiAgICB0aGlzLmFjdGl2ZUNvbnZlcnNhdGlvbklkJC5uZXh0KG51bGwpO1xyXG4gICAgdGhpcy50b3RhbFVucmVhZCQubmV4dCgwKTtcclxuICB9XHJcblxyXG4gIC8vIOKUgOKUgCBQb2xsaW5nIGZhbGxiYWNrIChpbmJveCBvbmx5IC0gbWVzc2FnZXMgcmVseSBvbiBXZWJTb2NrZXQpIOKUgOKUgFxyXG4gIHByaXZhdGUgc3RhcnRQb2xsaW5nKCk6IHZvaWQge1xyXG4gICAgdGhpcy5zdG9wUG9sbGluZygpO1xyXG4gICAgdGhpcy5wb2xsVGltZXIgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XHJcbiAgICAgIHRoaXMubG9hZEluYm94KCk7XHJcbiAgICB9LCAzMDAwMCk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHN0b3BQb2xsaW5nKCk6IHZvaWQge1xyXG4gICAgaWYgKHRoaXMucG9sbFRpbWVyKSB7XHJcbiAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy5wb2xsVGltZXIpO1xyXG4gICAgICB0aGlzLnBvbGxUaW1lciA9IG51bGw7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBuZ09uRGVzdHJveSgpOiB2b2lkIHtcclxuICAgIHRoaXMudGVhcmRvd24oKTtcclxuICAgIHRoaXMuZGVzdHJveSQubmV4dCgpO1xyXG4gICAgdGhpcy5kZXN0cm95JC5jb21wbGV0ZSgpO1xyXG4gIH1cclxuXHJcbiAgLy8g4pSA4pSAIFBhbmVsIGNvbnRyb2xzIOKUgOKUgFxyXG4gIHRvZ2dsZVBhbmVsKGJ1dHRvblg/OiBudW1iZXIsIGJ1dHRvblk/OiBudW1iZXIpOiB2b2lkIHtcclxuICAgIGlmIChidXR0b25YICE9PSB1bmRlZmluZWQgJiYgYnV0dG9uWSAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgIHRoaXMucGFuZWxQb3NpdGlvbiQubmV4dCh7IHg6IGJ1dHRvblgsIHk6IGJ1dHRvblkgfSk7XHJcbiAgICB9XHJcbiAgICB0aGlzLnBhbmVsT3BlbiQubmV4dCghdGhpcy5wYW5lbE9wZW4kLnZhbHVlKTtcclxuICB9XHJcblxyXG4gIG9wZW5QYW5lbChidXR0b25YPzogbnVtYmVyLCBidXR0b25ZPzogbnVtYmVyKTogdm9pZCB7XHJcbiAgICBpZiAoYnV0dG9uWCAhPT0gdW5kZWZpbmVkICYmIGJ1dHRvblkgIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICB0aGlzLnBhbmVsUG9zaXRpb24kLm5leHQoeyB4OiBidXR0b25YLCB5OiBidXR0b25ZIH0pO1xyXG4gICAgfVxyXG4gICAgdGhpcy5wYW5lbE9wZW4kLm5leHQodHJ1ZSk7XHJcbiAgfVxyXG5cclxuICBjbG9zZVBhbmVsKCk6IHZvaWQge1xyXG4gICAgdGhpcy5wYW5lbE9wZW4kLm5leHQoZmFsc2UpO1xyXG4gIH1cclxuXHJcbiAgc2V0UGFuZWxTaXplKHdpZHRoOiBudW1iZXIsIGhlaWdodDogbnVtYmVyKTogdm9pZCB7XHJcbiAgICB0aGlzLnBhbmVsU2l6ZSQubmV4dCh7IHdpZHRoLCBoZWlnaHQgfSk7XHJcbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnbWVzc2FnaW5nX3BhbmVsX3NpemUnLCBKU09OLnN0cmluZ2lmeSh7IHdpZHRoLCBoZWlnaHQgfSkpO1xyXG4gIH1cclxuXHJcbiAgZ2V0UGFuZWxTaXplKCk6IHsgd2lkdGg6IG51bWJlcjsgaGVpZ2h0OiBudW1iZXIgfSB7XHJcbiAgICBjb25zdCBzYXZlZCA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdtZXNzYWdpbmdfcGFuZWxfc2l6ZScpO1xyXG4gICAgaWYgKHNhdmVkKSB7XHJcbiAgICAgIHRyeSB7XHJcbiAgICAgICAgY29uc3QgcGFyc2VkID0gSlNPTi5wYXJzZShzYXZlZCk7XHJcbiAgICAgICAgaWYgKHBhcnNlZC53aWR0aCAmJiBwYXJzZWQuaGVpZ2h0KSB7XHJcbiAgICAgICAgICB0aGlzLnBhbmVsU2l6ZSQubmV4dChwYXJzZWQpO1xyXG4gICAgICAgICAgcmV0dXJuIHBhcnNlZDtcclxuICAgICAgICB9XHJcbiAgICAgIH0gY2F0Y2gge31cclxuICAgIH1cclxuICAgIHJldHVybiB0aGlzLnBhbmVsU2l6ZSQudmFsdWU7XHJcbiAgfVxyXG5cclxuICBvbkJ1dHRvbkRyYWdTdGFydCgpOiB2b2lkIHtcclxuICAgIHRoaXMud2FzT3BlbkJlZm9yZURyYWckLm5leHQodGhpcy5wYW5lbE9wZW4kLnZhbHVlKTtcclxuICAgIGlmICh0aGlzLnBhbmVsT3BlbiQudmFsdWUpIHtcclxuICAgICAgdGhpcy5wYW5lbE9wZW4kLm5leHQoZmFsc2UpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgb25CdXR0b25EcmFnRW5kKGJ1dHRvblg6IG51bWJlciwgYnV0dG9uWTogbnVtYmVyKTogdm9pZCB7XHJcbiAgICBpZiAodGhpcy53YXNPcGVuQmVmb3JlRHJhZyQudmFsdWUpIHtcclxuICAgICAgdGhpcy5vcGVuUGFuZWwoYnV0dG9uWCwgYnV0dG9uWSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBzZXRWaWV3KHZpZXc6ICdpbmJveCcgfCAnY2hhdCcgfCAnbmV3LWNvbnZlcnNhdGlvbicgfCAnZ3JvdXAtbWFuYWdlcicgfCAnY29udmVyc2F0aW9uLXNldHRpbmdzJyk6IHZvaWQge1xyXG4gICAgdGhpcy5hY3RpdmVWaWV3JC5uZXh0KHZpZXcpO1xyXG4gIH1cclxuXHJcbiAgdG9nZ2xlU2lkZWJhclNpZGUoKTogdm9pZCB7XHJcbiAgICBjb25zdCBuZXh0ID0gdGhpcy5zaWRlYmFyU2lkZSQudmFsdWUgPT09ICdyaWdodCcgPyAnbGVmdCcgOiAncmlnaHQnO1xyXG4gICAgdGhpcy5zaWRlYmFyU2lkZSQubmV4dChuZXh0KTtcclxuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdtZXNzYWdpbmdfc2lkZWJhcl9zaWRlJywgbmV4dCk7XHJcbiAgfVxyXG5cclxuICBnZXRTaWRlYmFyU2lkZSgpOiBTaWRlYmFyU2lkZSB7XHJcbiAgICByZXR1cm4gdGhpcy5zaWRlYmFyU2lkZSQudmFsdWU7XHJcbiAgfVxyXG5cclxuICAvLyDilIDilIAgSW5ib3gg4pSA4pSAXHJcbiAgbG9hZEluYm94KCk6IHZvaWQge1xyXG4gICAgY29uc3QgY29udGFjdElkID0gdGhpcy5hdXRoLmNvbnRhY3RJZDtcclxuICAgIGlmICghY29udGFjdElkKSByZXR1cm47XHJcblxyXG4gICAgdGhpcy5hcGkuZ2V0SW5ib3goY29udGFjdElkKS5zdWJzY3JpYmUoe1xyXG4gICAgICBuZXh0OiAoaXRlbXMpID0+IHtcclxuICAgICAgICBjb25zdCBtYXBwZWQgPSBpdGVtcy5tYXAoaXRlbSA9PiB7XHJcbiAgICAgICAgICBjb25zdCBpc0dyb3VwID0gaXRlbS5pc19ncm91cCA9PT0gdHJ1ZSB8fCAoaXRlbS5pc19ncm91cCBhcyBhbnkpID09PSAnVHJ1ZSc7XHJcbiAgICAgICAgICBcclxuICAgICAgICAgIGlmICghaXNHcm91cCAmJiAhaXRlbS5uYW1lICYmIGl0ZW0ub3RoZXJfcGFydGljaXBhbnRfbmFtZSkge1xyXG4gICAgICAgICAgICByZXR1cm4geyAuLi5pdGVtLCBuYW1lOiBpdGVtLm90aGVyX3BhcnRpY2lwYW50X25hbWUsIGlzX2dyb3VwOiBmYWxzZSB9O1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgcmV0dXJuIHsgLi4uaXRlbSwgaXNfZ3JvdXA6IGlzR3JvdXAgfTtcclxuICAgICAgICB9KTtcclxuICAgICAgICB0aGlzLmluYm94JC5uZXh0KG1hcHBlZCk7XHJcbiAgICAgICAgdGhpcy5yZWNhbGNVbnJlYWQobWFwcGVkKTtcclxuXHJcbiAgICAgICAgY29uc3QgaWRzID0gbWFwcGVkLm1hcCgoaSkgPT4gaS5jb252ZXJzYXRpb25faWQpO1xyXG4gICAgICAgIHRoaXMud3NTZXJ2aWNlLnN1YnNjcmliZUFsbChpZHMpO1xyXG4gICAgICB9LFxyXG4gICAgICBlcnJvcjogKCkgPT4ge30sXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8vIOKUgOKUgCBDb250YWN0cyDilIDilIBcclxuICBsb2FkVmlzaWJsZUNvbnRhY3RzKCk6IHZvaWQge1xyXG4gICAgY29uc3QgY29udGFjdElkID0gdGhpcy5hdXRoLmNvbnRhY3RJZDtcclxuICAgIGlmICghY29udGFjdElkKSByZXR1cm47XHJcblxyXG4gICAgdGhpcy5hcGkuZ2V0VmlzaWJsZUNvbnRhY3RzKGNvbnRhY3RJZCkuc3Vic2NyaWJlKHtcclxuICAgICAgbmV4dDogKGNvbnRhY3RzKSA9PiB7XHJcbiAgICAgICAgdGhpcy52aXNpYmxlQ29udGFjdHMkLm5leHQoY29udGFjdHMpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGNvbnN0IGN1cnJlbnRDb250YWN0ID0gdGhpcy5hdXRoLmN1cnJlbnRDb250YWN0O1xyXG4gICAgICAgIGlmIChjdXJyZW50Q29udGFjdCAmJiBjdXJyZW50Q29udGFjdC5lbWFpbCkge1xyXG4gICAgICAgICAgY29uc3QgbWF0Y2ggPSBjb250YWN0cy5maW5kKGMgPT4gYy5lbWFpbCA9PT0gY3VycmVudENvbnRhY3QuZW1haWwpO1xyXG4gICAgICAgICAgaWYgKFxyXG4gICAgICAgICAgICBtYXRjaCAmJlxyXG4gICAgICAgICAgICBTdHJpbmcobWF0Y2guY29udGFjdF9pZCkgIT09IFN0cmluZyhjdXJyZW50Q29udGFjdC5jb250YWN0X2lkKVxyXG4gICAgICAgICAgKSB7XHJcbiAgICAgICAgICAgIHRoaXMuYXV0aC5zZXRTZXNzaW9uKHRoaXMuYXV0aC5zZXNzaW9uR2lkISwgeyAuLi5jdXJyZW50Q29udGFjdCwgY29udGFjdF9pZDogbWF0Y2guY29udGFjdF9pZCB9KTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHRoaXMud3NTZXJ2aWNlLmRpc2Nvbm5lY3QoKTtcclxuICAgICAgICAgICAgdGhpcy53c1NlcnZpY2UuY29ubmVjdChtYXRjaC5jb250YWN0X2lkLCB0aGlzLmF1dGguc2Vzc2lvbkdpZCEpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgfSxcclxuICAgICAgZXJyb3I6ICgpID0+IHt9LFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvLyDilIDilIAgQ29udmVyc2F0aW9ucyDilIDilIBcclxuICBvcGVuQ29udmVyc2F0aW9uKGNvbnZlcnNhdGlvbklkOiBzdHJpbmcsIG5hbWU6IHN0cmluZywgaXNHcm91cCA9IGZhbHNlKTogdm9pZCB7XHJcbiAgICBpZiAoIWNvbnZlcnNhdGlvbklkIHx8IGNvbnZlcnNhdGlvbklkID09PSAndW5kZWZpbmVkJykge1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICB0aGlzLmFjdGl2ZUNvbnZlcnNhdGlvbklkJC5uZXh0KGNvbnZlcnNhdGlvbklkKTtcclxuICAgIHRoaXMuYWN0aXZlVmlldyQubmV4dCgnY2hhdCcpO1xyXG4gICAgdGhpcy5vcGVuUGFuZWwoKTtcclxuXHJcbiAgICBjb25zdCBjaGF0cyA9IHRoaXMub3BlbkNoYXRzJC52YWx1ZTtcclxuICAgIGlmICghY2hhdHMuZmluZCgoYykgPT4gYy5jb252ZXJzYXRpb25JZCA9PT0gY29udmVyc2F0aW9uSWQpKSB7XHJcbiAgICAgIHRoaXMub3BlbkNoYXRzJC5uZXh0KFtcclxuICAgICAgICAuLi5jaGF0cyxcclxuICAgICAgICB7IGNvbnZlcnNhdGlvbklkLCBuYW1lLCBpc0dyb3VwLCBpc01pbmltaXplZDogZmFsc2UsIHVucmVhZENvdW50OiAwIH0sXHJcbiAgICAgIF0pO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGV4aXN0aW5nID0gdGhpcy5tZXNzYWdlc01hcCQudmFsdWUuZ2V0KGNvbnZlcnNhdGlvbklkKTtcclxuICAgIGlmIChleGlzdGluZyAmJiBleGlzdGluZy5sZW5ndGggPiAwKSB7XHJcbiAgICAgIC8vIEFscmVhZHkgY2FjaGVkIOKAlCBzaWxlbnQgYmFja2dyb3VuZCByZWZyZXNoIGZvciBuZXcgbWVzc2FnZXMsIHNraXAgcmVhY3Rpb24gaHlkcmF0aW9uXHJcbiAgICAgIHRoaXMubG9hZE1lc3NhZ2VzKGNvbnZlcnNhdGlvbklkLCB1bmRlZmluZWQsIHRydWUpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgdGhpcy5sb2FkTWVzc2FnZXMoY29udmVyc2F0aW9uSWQpO1xyXG4gICAgfVxyXG4gICAgdGhpcy5tYXJrQXNSZWFkKGNvbnZlcnNhdGlvbklkKTtcclxuICAgIHRoaXMud3NTZXJ2aWNlLnN1YnNjcmliZShjb252ZXJzYXRpb25JZCk7XHJcbiAgfVxyXG5cclxuICBjbG9zZUNoYXQoY29udmVyc2F0aW9uSWQ6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgY29uc3QgY2hhdHMgPSB0aGlzLm9wZW5DaGF0cyQudmFsdWUuZmlsdGVyKChjKSA9PiBjLmNvbnZlcnNhdGlvbklkICE9PSBjb252ZXJzYXRpb25JZCk7XHJcbiAgICB0aGlzLm9wZW5DaGF0cyQubmV4dChjaGF0cyk7XHJcblxyXG4gICAgaWYgKHRoaXMuYWN0aXZlQ29udmVyc2F0aW9uSWQkLnZhbHVlID09PSBjb252ZXJzYXRpb25JZCkge1xyXG4gICAgICB0aGlzLmFjdGl2ZUNvbnZlcnNhdGlvbklkJC5uZXh0KG51bGwpO1xyXG4gICAgICB0aGlzLmFjdGl2ZVZpZXckLm5leHQoJ2luYm94Jyk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvLyDilIDilIAgTWVzc2FnZXMg4pSA4pSAXHJcbiAgbG9hZE1lc3NhZ2VzKGNvbnZlcnNhdGlvbklkOiBzdHJpbmcsIGJlZm9yZU1lc3NhZ2VJZD86IHN0cmluZywgc2tpcFJlYWN0aW9uSHlkcmF0aW9uID0gZmFsc2UpOiB2b2lkIHtcclxuICAgIGlmICghY29udmVyc2F0aW9uSWQgfHwgY29udmVyc2F0aW9uSWQgPT09ICd1bmRlZmluZWQnKSB7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIGNvbnN0IGNvbnRhY3RJZCA9IHRoaXMuYXV0aC5jb250YWN0SWQ7XHJcbiAgICBpZiAoIWNvbnRhY3RJZCkgcmV0dXJuO1xyXG5cclxuICAgIHRoaXMubG9hZGluZ01lc3NhZ2VzJC5uZXh0KHRydWUpO1xyXG5cclxuICAgIHRoaXMuYXBpLmdldE1lc3NhZ2VzKGNvbnZlcnNhdGlvbklkLCBjb250YWN0SWQsIGJlZm9yZU1lc3NhZ2VJZCwgNTApLnN1YnNjcmliZSh7XHJcbiAgICAgIG5leHQ6IChtZXNzYWdlcykgPT4ge1xyXG4gICAgICAgIGNvbnN0IG1hcCA9IG5ldyBNYXAodGhpcy5tZXNzYWdlc01hcCQudmFsdWUpO1xyXG4gICAgICAgIGNvbnN0IGV4aXN0aW5nID0gbWFwLmdldChjb252ZXJzYXRpb25JZCkgfHwgW107XHJcblxyXG4gICAgICAgIGNvbnN0IG5vcm1hbGl6ZWQgPSBtZXNzYWdlcy5tYXAoKG06IGFueSkgPT4gdGhpcy5ub3JtYWxpemVNZXNzYWdlU2hhcGUobSkpO1xyXG4gICAgICAgIGNvbnN0IHNvcnRlZCA9IFsuLi5ub3JtYWxpemVkXS5zb3J0KChhLCBiKSA9PiBcclxuICAgICAgICAgIG5ldyBEYXRlKGEuY3JlYXRlZF9hdCkuZ2V0VGltZSgpIC0gbmV3IERhdGUoYi5jcmVhdGVkX2F0KS5nZXRUaW1lKClcclxuICAgICAgICApO1xyXG5cclxuICAgICAgICBpZiAoYmVmb3JlTWVzc2FnZUlkKSB7XHJcbiAgICAgICAgICAvLyBQcmVwZW5kIG9sZGVyIG1lc3NhZ2VzLCBwcmVzZXJ2aW5nIGV4aXN0aW5nIHJlYWN0aW9uc1xyXG4gICAgICAgICAgY29uc3QgbWVyZ2VkID0gWy4uLnNvcnRlZCwgLi4uZXhpc3RpbmddO1xyXG4gICAgICAgICAgbWFwLnNldChjb252ZXJzYXRpb25JZCwgbWVyZ2VkKTtcclxuICAgICAgICB9IGVsc2UgaWYgKHNraXBSZWFjdGlvbkh5ZHJhdGlvbikge1xyXG4gICAgICAgICAgLy8gU2lsZW50IHJlZnJlc2gg4oCUIG1lcmdlIG5ldyBtZXNzYWdlcyBidXQgcHJlc2VydmUgZXhpc3RpbmcgcmVhY3Rpb24gc3RhdGVcclxuICAgICAgICAgIGNvbnN0IGV4aXN0aW5nQnlJZCA9IG5ldyBNYXAoZXhpc3RpbmcubWFwKG0gPT4gW1N0cmluZyhtLm1lc3NhZ2VfaWQpLCBtXSkpO1xyXG4gICAgICAgICAgY29uc3QgbWVyZ2VkID0gc29ydGVkLm1hcChtID0+IHtcclxuICAgICAgICAgICAgY29uc3QgY2FjaGVkID0gZXhpc3RpbmdCeUlkLmdldChTdHJpbmcobS5tZXNzYWdlX2lkKSk7XHJcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWQgPyB7IC4uLm0sIHJlYWN0aW9uczogY2FjaGVkLnJlYWN0aW9ucyB9IDogbTtcclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgbWFwLnNldChjb252ZXJzYXRpb25JZCwgbWVyZ2VkKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgbWFwLnNldChjb252ZXJzYXRpb25JZCwgc29ydGVkKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMubWVzc2FnZXNNYXAkLm5leHQobWFwKTtcclxuICAgICAgICBpZiAoIXNraXBSZWFjdGlvbkh5ZHJhdGlvbikge1xyXG4gICAgICAgICAgdGhpcy5oeWRyYXRlUmVhY3Rpb25zRm9yQ29udmVyc2F0aW9uKGNvbnZlcnNhdGlvbklkLCBtYXAuZ2V0KGNvbnZlcnNhdGlvbklkKSB8fCBbXSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMubG9hZGluZ01lc3NhZ2VzJC5uZXh0KGZhbHNlKTtcclxuICAgICAgfSxcclxuICAgICAgZXJyb3I6ICgpID0+IHtcclxuICAgICAgICB0aGlzLmxvYWRpbmdNZXNzYWdlcyQubmV4dChmYWxzZSk7XHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHNlbmRNZXNzYWdlKGNvbnZlcnNhdGlvbklkOiBzdHJpbmcgfCBudWxsLCBjb250ZW50OiBzdHJpbmcsIG1lc3NhZ2VUeXBlOiAnVEVYVCcgfCAnSU1BR0UnID0gJ1RFWFQnKTogdm9pZCB7XHJcbiAgICBjb25zdCBjb250YWN0SWQgPSB0aGlzLmF1dGguY29udGFjdElkO1xyXG4gICAgaWYgKCFjb250YWN0SWQpIHJldHVybjtcclxuXHJcbiAgICBjb25zdCBwZW5kaW5nID0gdGhpcy5wZW5kaW5nRG1SZWNpcGllbnQkLnZhbHVlO1xyXG4gICAgaWYgKCFjb252ZXJzYXRpb25JZCAmJiBwZW5kaW5nKSB7XHJcbiAgICAgIHRoaXMuc2VuZERpcmVjdE1lc3NhZ2UocGVuZGluZy5jb250YWN0SWQsIGNvbnRlbnQpO1xyXG4gICAgICB0aGlzLnBlbmRpbmdEbVJlY2lwaWVudCQubmV4dChudWxsKTtcclxuICAgICAgY29uc3QgY2hhdHMgPSB0aGlzLm9wZW5DaGF0cyQudmFsdWUuZmlsdGVyKGMgPT4gYy5jb252ZXJzYXRpb25JZCAhPT0gJ3BlbmRpbmcnKTtcclxuICAgICAgdGhpcy5vcGVuQ2hhdHMkLm5leHQoY2hhdHMpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKCFjb252ZXJzYXRpb25JZCkgcmV0dXJuO1xyXG5cclxuICAgIGNvbnN0IHRlbXBNZXNzYWdlSWQgPSAndGVtcC0nICsgRGF0ZS5ub3coKTtcclxuICAgIGNvbnN0IG9wdGltaXN0aWM6IE1lc3NhZ2UgPSB7XHJcbiAgICAgIG1lc3NhZ2VfaWQ6IHRlbXBNZXNzYWdlSWQsXHJcbiAgICAgIGNvbnZlcnNhdGlvbl9pZDogY29udmVyc2F0aW9uSWQsXHJcbiAgICAgIHNlbmRlcl9pZDogY29udGFjdElkLFxyXG4gICAgICBzZW5kZXJfbmFtZTogJ1lvdScsXHJcbiAgICAgIG1lc3NhZ2VfdHlwZTogbWVzc2FnZVR5cGUsXHJcbiAgICAgIGNvbnRlbnQsXHJcbiAgICAgIGNyZWF0ZWRfYXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcclxuICAgICAgaXNfcmVhZDogdHJ1ZSxcclxuICAgIH07XHJcbiAgICB0aGlzLmFwcGVuZE1lc3NhZ2Uob3B0aW1pc3RpYyk7XHJcblxyXG4gICAgdGhpcy5hcGkuc2VuZE1lc3NhZ2UoY29udmVyc2F0aW9uSWQsIGNvbnRhY3RJZCwgY29udGVudCwgbWVzc2FnZVR5cGUpLnN1YnNjcmliZSh7XHJcbiAgICAgIG5leHQ6IChyZXMpID0+IHtcclxuICAgICAgICBjb25zdCByZWFsSWQgPSByZXM/Lm1lc3NhZ2VfaWQgPz8gcmVzPy5pZCA/PyByZXM/Lm1lc3NhZ2VJZDtcclxuICAgICAgICBpZiAocmVhbElkID09IG51bGwgfHwgU3RyaW5nKHJlYWxJZCkuc3RhcnRzV2l0aCgndGVtcC0nKSkge1xyXG4gICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgICBjb25zdCBwaWNrZWRDb250ZW50ID0gdGhpcy5jb2FsZXNjZU1lc3NhZ2VUZXh0KHJlcywgb3B0aW1pc3RpYy5jb250ZW50KTtcclxuICAgICAgICBjb25zdCBtZXJnZWQgPSB0aGlzLm5vcm1hbGl6ZU1lc3NhZ2VTaGFwZSh7XHJcbiAgICAgICAgICAuLi5vcHRpbWlzdGljLFxyXG4gICAgICAgICAgLi4ucmVzLFxyXG4gICAgICAgICAgbWVzc2FnZV9pZDogU3RyaW5nKHJlYWxJZCksXHJcbiAgICAgICAgICBjb252ZXJzYXRpb25faWQ6IGNvbnZlcnNhdGlvbklkLFxyXG4gICAgICAgICAgY29udGVudDogcGlja2VkQ29udGVudCxcclxuICAgICAgICB9KTtcclxuICAgICAgICBjb25zdCBtYXAgPSBuZXcgTWFwKHRoaXMubWVzc2FnZXNNYXAkLnZhbHVlKTtcclxuICAgICAgICBjb25zdCBtc2dzID0gWy4uLihtYXAuZ2V0KGNvbnZlcnNhdGlvbklkKSB8fCBbXSldO1xyXG4gICAgICAgIGNvbnN0IGlkeCA9IG1zZ3MuZmluZEluZGV4KChtKSA9PiBtLm1lc3NhZ2VfaWQgPT09IHRlbXBNZXNzYWdlSWQpO1xyXG4gICAgICAgIGlmIChpZHggPj0gMCkge1xyXG4gICAgICAgICAgbXNnc1tpZHhdID0gbWVyZ2VkO1xyXG4gICAgICAgICAgbWFwLnNldChjb252ZXJzYXRpb25JZCwgdGhpcy5kZWR1cGVNZXNzYWdlc0J5SWRLZWVwRmlyc3QobXNncykpO1xyXG4gICAgICAgICAgdGhpcy5tZXNzYWdlc01hcCQubmV4dChtYXApO1xyXG4gICAgICAgICAgdGhpcy5yZWZyZXNoTWVzc2FnZVJlYWN0aW9ucyhtZXJnZWQubWVzc2FnZV9pZCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9LFxyXG4gICAgICBlcnJvcjogKCkgPT4ge30sXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIG9wZW5EaXJlY3RDb252ZXJzYXRpb24ocmVjaXBpZW50Q29udGFjdElkOiBzdHJpbmcsIGRpc3BsYXlOYW1lOiBzdHJpbmcpOiB2b2lkIHtcclxuICAgIGNvbnN0IGV4aXN0aW5nID0gdGhpcy5pbmJveCQudmFsdWUuZmluZChpdGVtID0+IFxyXG4gICAgICAhaXRlbS5pc19ncm91cCAmJiBpdGVtLm5hbWUgPT09IGRpc3BsYXlOYW1lXHJcbiAgICApO1xyXG4gICAgXHJcbiAgICBpZiAoZXhpc3RpbmcpIHtcclxuICAgICAgdGhpcy5wZW5kaW5nRG1SZWNpcGllbnQkLm5leHQobnVsbCk7XHJcbiAgICAgIHRoaXMub3BlbkNvbnZlcnNhdGlvbihleGlzdGluZy5jb252ZXJzYXRpb25faWQsIGRpc3BsYXlOYW1lLCBmYWxzZSk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICB0aGlzLnBlbmRpbmdEbVJlY2lwaWVudCQubmV4dCh7Y29udGFjdElkOiByZWNpcGllbnRDb250YWN0SWQsIG5hbWU6IGRpc3BsYXlOYW1lfSk7XHJcbiAgICAgIHRoaXMuYWN0aXZlQ29udmVyc2F0aW9uSWQkLm5leHQobnVsbCk7XHJcbiAgICAgIHRoaXMuYWN0aXZlVmlldyQubmV4dCgnY2hhdCcpO1xyXG4gICAgICB0aGlzLm9wZW5QYW5lbCgpO1xyXG4gICAgICBcclxuICAgICAgY29uc3QgY2hhdHMgPSB0aGlzLm9wZW5DaGF0cyQudmFsdWU7XHJcbiAgICAgIGlmICghY2hhdHMuZmluZChjID0+IGMuY29udmVyc2F0aW9uSWQgPT09ICdwZW5kaW5nJykpIHtcclxuICAgICAgICB0aGlzLm9wZW5DaGF0cyQubmV4dChbLi4uY2hhdHMsIHtcclxuICAgICAgICAgIGNvbnZlcnNhdGlvbklkOiAncGVuZGluZycsXHJcbiAgICAgICAgICBuYW1lOiBkaXNwbGF5TmFtZSxcclxuICAgICAgICAgIGlzR3JvdXA6IGZhbHNlLFxyXG4gICAgICAgICAgaXNNaW5pbWl6ZWQ6IGZhbHNlLFxyXG4gICAgICAgICAgdW5yZWFkQ291bnQ6IDBcclxuICAgICAgICB9XSk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcblxyXG4gIHNlbmREaXJlY3RNZXNzYWdlKHJlY2lwaWVudENvbnRhY3RJZDogc3RyaW5nLCBjb250ZW50OiBzdHJpbmcpOiB2b2lkIHtcclxuICAgIGNvbnN0IGNvbnRhY3RJZCA9IHRoaXMuYXV0aC5jb250YWN0SWQ7XHJcbiAgICBpZiAoIWNvbnRhY3RJZCkgcmV0dXJuO1xyXG5cclxuICAgIHRoaXMuYXBpLnNlbmREaXJlY3RNZXNzYWdlKGNvbnRhY3RJZCwgcmVjaXBpZW50Q29udGFjdElkLCBjb250ZW50KS5zdWJzY3JpYmUoe1xyXG4gICAgICBuZXh0OiAocmVzKSA9PiB7XHJcbiAgICAgICAgdGhpcy5sb2FkSW5ib3goKTtcclxuICAgICAgICAvLyBCYWNrZW5kIG1heSByZXR1cm4gY29udmVyc2F0aW9uX2lkLCBpZCwgb3IgY29udmVyc2F0aW9uSWRcclxuICAgICAgICBjb25zdCBjb252SWQgPSBTdHJpbmcocmVzPy5jb252ZXJzYXRpb25faWQgfHwgcmVzPy5pZCB8fCByZXM/LmNvbnZlcnNhdGlvbklkIHx8ICcnKTtcclxuICAgICAgICBpZiAoY29udklkKSB7XHJcbiAgICAgICAgICBjb25zdCByZWNpcGllbnQgPSB0aGlzLnZpc2libGVDb250YWN0cyQudmFsdWUuZmluZChcclxuICAgICAgICAgICAgKGMpID0+IGMuY29udGFjdF9pZCA9PT0gcmVjaXBpZW50Q29udGFjdElkXHJcbiAgICAgICAgICApO1xyXG4gICAgICAgICAgY29uc3QgbmFtZSA9IHJlY2lwaWVudCA/IGdldENvbnRhY3REaXNwbGF5TmFtZShyZWNpcGllbnQpIDogJ0RpcmVjdCBNZXNzYWdlJztcclxuICAgICAgICAgIHRoaXMub3BlbkNvbnZlcnNhdGlvbihjb252SWQsIG5hbWUsIGZhbHNlKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0sXHJcbiAgICAgIGVycm9yOiAoKSA9PiB7fSxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgY3JlYXRlR3JvdXBDb252ZXJzYXRpb24ocGFydGljaXBhbnRJZHM6IHN0cmluZ1tdLCBuYW1lOiBzdHJpbmcpOiB2b2lkIHtcclxuICAgIGNvbnN0IGNvbnRhY3RJZCA9IHRoaXMuYXV0aC5jb250YWN0SWQ7XHJcbiAgICBpZiAoIWNvbnRhY3RJZCkgcmV0dXJuO1xyXG5cclxuICAgIGNvbnN0IGFsbFBhcnRpY2lwYW50cyA9IHBhcnRpY2lwYW50SWRzLmluY2x1ZGVzKGNvbnRhY3RJZClcclxuICAgICAgPyBwYXJ0aWNpcGFudElkc1xyXG4gICAgICA6IFtjb250YWN0SWQsIC4uLnBhcnRpY2lwYW50SWRzXTtcclxuXHJcbiAgICB0aGlzLmFwaS5jcmVhdGVDb252ZXJzYXRpb24oY29udGFjdElkLCBhbGxQYXJ0aWNpcGFudHMsIG5hbWUpLnN1YnNjcmliZSh7XHJcbiAgICAgIG5leHQ6IChjb252KSA9PiB7XHJcbiAgICAgICAgLy8gQmFja2VuZCBtYXkgcmV0dXJuIGNvbnZlcnNhdGlvbl9pZCwgaWQsIG9yIGNvbnZlcnNhdGlvbklkXHJcbiAgICAgICAgY29uc3QgY29udklkID0gU3RyaW5nKChjb252IGFzIGFueSk/LmNvbnZlcnNhdGlvbl9pZCB8fCAoY29udiBhcyBhbnkpPy5pZCB8fCAoY29udiBhcyBhbnkpPy5jb252ZXJzYXRpb25JZCB8fCAnJyk7XHJcbiAgICAgICAgaWYgKCFjb252SWQpIHtcclxuICAgICAgICAgIHRoaXMubG9hZEluYm94KCk7XHJcbiAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMubG9hZEluYm94KCk7XHJcbiAgICAgICAgdGhpcy5vcGVuQ29udmVyc2F0aW9uKGNvbnZJZCwgbmFtZSwgdHJ1ZSk7XHJcbiAgICAgIH0sXHJcbiAgICAgIGVycm9yOiAoKSA9PiB7fSxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgb3Blbkdyb3VwU2V0dGluZ3MoY29udmVyc2F0aW9uSWQ6IHN0cmluZywgbmFtZTogc3RyaW5nKTogdm9pZCB7XHJcbiAgICB0aGlzLmdyb3VwU2V0dGluZ3MkLm5leHQoeyBjb252ZXJzYXRpb25JZCwgbmFtZSB9KTtcclxuICAgIHRoaXMuc2V0VmlldygnZ3JvdXAtbWFuYWdlcicpO1xyXG4gIH1cclxuXHJcbiAgY2xlYXJHcm91cFNldHRpbmdzKCk6IHZvaWQge1xyXG4gICAgdGhpcy5ncm91cFNldHRpbmdzJC5uZXh0KG51bGwpO1xyXG4gIH1cclxuXHJcbiAgbWFya0FzUmVhZChjb252ZXJzYXRpb25JZDogc3RyaW5nKTogdm9pZCB7XHJcbiAgICBpZiAoIWNvbnZlcnNhdGlvbklkIHx8IGNvbnZlcnNhdGlvbklkID09PSAndW5kZWZpbmVkJykgcmV0dXJuO1xyXG4gICAgY29uc3QgY29udGFjdElkID0gdGhpcy5hdXRoLmNvbnRhY3RJZDtcclxuICAgIGlmICghY29udGFjdElkKSByZXR1cm47XHJcblxyXG4gICAgdGhpcy5hcGkubWFya0NvbnZlcnNhdGlvblJlYWQoY29udmVyc2F0aW9uSWQsIGNvbnRhY3RJZCkuc3Vic2NyaWJlKHtcclxuICAgICAgbmV4dDogKCkgPT4ge1xyXG4gICAgICAgIGNvbnN0IGl0ZW1zID0gdGhpcy5pbmJveCQudmFsdWUubWFwKChpdGVtKSA9PlxyXG4gICAgICAgICAgaXRlbS5jb252ZXJzYXRpb25faWQgPT09IGNvbnZlcnNhdGlvbklkID8geyAuLi5pdGVtLCB1bnJlYWRfY291bnQ6IDAgfSA6IGl0ZW1cclxuICAgICAgICApO1xyXG4gICAgICAgIHRoaXMuaW5ib3gkLm5leHQoaXRlbXMpO1xyXG4gICAgICAgIHRoaXMucmVjYWxjVW5yZWFkKGl0ZW1zKTtcclxuICAgICAgfSxcclxuICAgICAgZXJyb3I6ICgpID0+IHt9LFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvLyDilIDilIAgR3JvdXAgbWFuYWdlbWVudCDilIDilIBcclxuICBtYW5hZ2VHcm91cChcclxuICAgIGFjdGlvbjogJ2NyZWF0ZScgfCAnYWRkJyB8ICdyZW1vdmUnIHwgJ3JlbmFtZScsXHJcbiAgICBjb252ZXJzYXRpb25JZD86IHN0cmluZyxcclxuICAgIGdyb3VwTmFtZT86IHN0cmluZyxcclxuICAgIHBhcnRpY2lwYW50Q29udGFjdElkcz86IHN0cmluZ1tdXHJcbiAgKTogdm9pZCB7XHJcbiAgICBjb25zdCBjb250YWN0SWQgPSB0aGlzLmF1dGguY29udGFjdElkO1xyXG4gICAgaWYgKCFjb250YWN0SWQpIHJldHVybjtcclxuXHJcbiAgICB0aGlzLmFwaS5tYW5hZ2VHcm91cChjb250YWN0SWQsIGFjdGlvbiwgY29udmVyc2F0aW9uSWQsIGdyb3VwTmFtZSwgcGFydGljaXBhbnRDb250YWN0SWRzKS5zdWJzY3JpYmUoe1xyXG4gICAgICBuZXh0OiAoKSA9PiB0aGlzLmxvYWRJbmJveCgpLFxyXG4gICAgICBlcnJvcjogKCkgPT4ge30sXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8vIOKUgOKUgCBEZWxldGUgLyBDbGVhciDilIDilIBcclxuICBkZWxldGVDb252ZXJzYXRpb24oY29udmVyc2F0aW9uSWQ6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgY29uc3QgY29udGFjdElkID0gdGhpcy5hdXRoLmNvbnRhY3RJZDtcclxuICAgIGlmICghY29udGFjdElkKSByZXR1cm47XHJcblxyXG4gICAgdGhpcy5hcGkuZGVsZXRlQ29udmVyc2F0aW9uKGNvbnZlcnNhdGlvbklkLCBjb250YWN0SWQpLnN1YnNjcmliZSh7XHJcbiAgICAgIG5leHQ6ICgpID0+IHtcclxuICAgICAgICBjb25zdCBpdGVtcyA9IHRoaXMuaW5ib3gkLnZhbHVlLmZpbHRlcihpID0+IGkuY29udmVyc2F0aW9uX2lkICE9PSBjb252ZXJzYXRpb25JZCk7XHJcbiAgICAgICAgdGhpcy5pbmJveCQubmV4dChpdGVtcyk7XHJcbiAgICAgICAgdGhpcy5yZWNhbGNVbnJlYWQoaXRlbXMpO1xyXG4gICAgICAgIGNvbnN0IG1hcCA9IG5ldyBNYXAodGhpcy5tZXNzYWdlc01hcCQudmFsdWUpO1xyXG4gICAgICAgIG1hcC5kZWxldGUoY29udmVyc2F0aW9uSWQpO1xyXG4gICAgICAgIHRoaXMubWVzc2FnZXNNYXAkLm5leHQobWFwKTtcclxuICAgICAgICBpZiAodGhpcy5hY3RpdmVDb252ZXJzYXRpb25JZCQudmFsdWUgPT09IGNvbnZlcnNhdGlvbklkKSB7XHJcbiAgICAgICAgICB0aGlzLmFjdGl2ZUNvbnZlcnNhdGlvbklkJC5uZXh0KG51bGwpO1xyXG4gICAgICAgICAgdGhpcy5hY3RpdmVWaWV3JC5uZXh0KCdpbmJveCcpO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLmNsb3NlQ2hhdChjb252ZXJzYXRpb25JZCk7XHJcbiAgICAgIH0sXHJcbiAgICAgIGVycm9yOiAoKSA9PiB7fSxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgY2xlYXJDb252ZXJzYXRpb24oY29udmVyc2F0aW9uSWQ6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgY29uc3QgY29udGFjdElkID0gdGhpcy5hdXRoLmNvbnRhY3RJZDtcclxuICAgIGlmICghY29udGFjdElkKSByZXR1cm47XHJcblxyXG4gICAgdGhpcy5hcGkuY2xlYXJDb252ZXJzYXRpb24oY29udmVyc2F0aW9uSWQsIGNvbnRhY3RJZCkuc3Vic2NyaWJlKHtcclxuICAgICAgbmV4dDogKCkgPT4ge1xyXG4gICAgICAgIGNvbnN0IG1hcCA9IG5ldyBNYXAodGhpcy5tZXNzYWdlc01hcCQudmFsdWUpO1xyXG4gICAgICAgIG1hcC5zZXQoY29udmVyc2F0aW9uSWQsIFtdKTtcclxuICAgICAgICB0aGlzLm1lc3NhZ2VzTWFwJC5uZXh0KG1hcCk7XHJcbiAgICAgICAgY29uc3QgaXRlbXMgPSB0aGlzLmluYm94JC52YWx1ZS5tYXAoaSA9PlxyXG4gICAgICAgICAgaS5jb252ZXJzYXRpb25faWQgPT09IGNvbnZlcnNhdGlvbklkXHJcbiAgICAgICAgICAgID8geyAuLi5pLCBsYXN0X21lc3NhZ2VfcHJldmlldzogJycsIGxhc3RfbWVzc2FnZV9hdDogaS5sYXN0X21lc3NhZ2VfYXQgfVxyXG4gICAgICAgICAgICA6IGlcclxuICAgICAgICApO1xyXG4gICAgICAgIHRoaXMuaW5ib3gkLm5leHQoaXRlbXMpO1xyXG4gICAgICB9LFxyXG4gICAgICBlcnJvcjogKCkgPT4ge30sXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIGRlbGV0ZUdyb3VwKGNvbnZlcnNhdGlvbklkOiBzdHJpbmcpOiB2b2lkIHtcclxuICAgIGNvbnN0IGNvbnRhY3RJZCA9IHRoaXMuYXV0aC5jb250YWN0SWQ7XHJcbiAgICBpZiAoIWNvbnRhY3RJZCkgcmV0dXJuO1xyXG5cclxuICAgIHRoaXMuYXBpLmRlbGV0ZUdyb3VwKGNvbnZlcnNhdGlvbklkLCBjb250YWN0SWQpLnN1YnNjcmliZSh7XHJcbiAgICAgIG5leHQ6ICgpID0+IHtcclxuICAgICAgICBjb25zdCBpdGVtcyA9IHRoaXMuaW5ib3gkLnZhbHVlLmZpbHRlcihpID0+IGkuY29udmVyc2F0aW9uX2lkICE9PSBjb252ZXJzYXRpb25JZCk7XHJcbiAgICAgICAgdGhpcy5pbmJveCQubmV4dChpdGVtcyk7XHJcbiAgICAgICAgdGhpcy5yZWNhbGNVbnJlYWQoaXRlbXMpO1xyXG4gICAgICAgIGNvbnN0IG1hcCA9IG5ldyBNYXAodGhpcy5tZXNzYWdlc01hcCQudmFsdWUpO1xyXG4gICAgICAgIG1hcC5kZWxldGUoY29udmVyc2F0aW9uSWQpO1xyXG4gICAgICAgIHRoaXMubWVzc2FnZXNNYXAkLm5leHQobWFwKTtcclxuICAgICAgICBpZiAodGhpcy5hY3RpdmVDb252ZXJzYXRpb25JZCQudmFsdWUgPT09IGNvbnZlcnNhdGlvbklkKSB7XHJcbiAgICAgICAgICB0aGlzLmFjdGl2ZUNvbnZlcnNhdGlvbklkJC5uZXh0KG51bGwpO1xyXG4gICAgICAgICAgdGhpcy5hY3RpdmVWaWV3JC5uZXh0KCdpbmJveCcpO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLmNsb3NlQ2hhdChjb252ZXJzYXRpb25JZCk7XHJcbiAgICAgIH0sXHJcbiAgICAgIGVycm9yOiAoKSA9PiB7fSxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLy8g4pSA4pSAIFJlYWN0aW9ucyDilIDilIBcclxuICBhZGRSZWFjdGlvbihtZXNzYWdlSWQ6IHN0cmluZywgZW1vamk6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgY29uc3QgY29udGFjdElkID0gdGhpcy5hdXRoLmNvbnRhY3RJZDtcclxuICAgIGlmICghY29udGFjdElkKSByZXR1cm47XHJcblxyXG4gICAgLy8gRW5mb3JjZSBvbmUgcmVhY3Rpb24gcGVyIHVzZXIg4oCUIHJlbW92ZSBhbnkgZXhpc3RpbmcgcmVhY3Rpb24gd2l0aCBhIGRpZmZlcmVudCBlbW9qaVxyXG4gICAgZm9yIChjb25zdCBtc2dzIG9mIHRoaXMubWVzc2FnZXNNYXAkLnZhbHVlLnZhbHVlcygpKSB7XHJcbiAgICAgIGNvbnN0IG1zZyA9IG1zZ3MuZmluZChtID0+IFN0cmluZyhtLm1lc3NhZ2VfaWQpID09PSBTdHJpbmcobWVzc2FnZUlkKSk7XHJcbiAgICAgIGlmIChtc2c/LnJlYWN0aW9ucykge1xyXG4gICAgICAgIGZvciAoY29uc3QgciBvZiBtc2cucmVhY3Rpb25zKSB7XHJcbiAgICAgICAgICBpZiAoci5oYXNSZWFjdGVkICYmIHIuZW1vamkgIT09IGVtb2ppKSB7XHJcbiAgICAgICAgICAgIHRoaXMuYXBwbHlSZWFjdGlvbk9wdGltaXN0aWNhbGx5KG1lc3NhZ2VJZCwgci5lbW9qaSwgZmFsc2UpO1xyXG4gICAgICAgICAgICB0aGlzLmFwaS5yZW1vdmVSZWFjdGlvbihtZXNzYWdlSWQsIGNvbnRhY3RJZCwgci5lbW9qaSkuc3Vic2NyaWJlKHsgZXJyb3I6ICgpID0+IHt9IH0pO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgICBicmVhaztcclxuICAgIH1cclxuXHJcbiAgICAvLyBPcHRpbWlzdGljIFVJIHNvIHVzZXIgc2VlcyByZWFjdGlvbiBpbW1lZGlhdGVseS5cclxuICAgIHRoaXMuYXBwbHlSZWFjdGlvbk9wdGltaXN0aWNhbGx5KG1lc3NhZ2VJZCwgZW1vamksIHRydWUpO1xyXG5cclxuICAgIHRoaXMuYXBpLmFkZFJlYWN0aW9uKG1lc3NhZ2VJZCwgY29udGFjdElkLCBlbW9qaSkuc3Vic2NyaWJlKHtcclxuICAgICAgbmV4dDogKCkgPT4ge1xyXG4gICAgICAgIHRoaXMucmVmcmVzaE1lc3NhZ2VSZWFjdGlvbnMobWVzc2FnZUlkKTtcclxuICAgICAgfSxcclxuICAgICAgZXJyb3I6ICgpID0+IHtcclxuICAgICAgICAvLyBSZXZlcnQgb3B0aW1pc3RpYyB1cGRhdGUgd2hlbiByZXF1ZXN0IGZhaWxzLlxyXG4gICAgICAgIHRoaXMuYXBwbHlSZWFjdGlvbk9wdGltaXN0aWNhbGx5KG1lc3NhZ2VJZCwgZW1vamksIGZhbHNlKTtcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcmVtb3ZlUmVhY3Rpb24obWVzc2FnZUlkOiBzdHJpbmcsIGVtb2ppOiBzdHJpbmcpOiB2b2lkIHtcclxuICAgIGNvbnN0IGNvbnRhY3RJZCA9IHRoaXMuYXV0aC5jb250YWN0SWQ7XHJcbiAgICBpZiAoIWNvbnRhY3RJZCkgcmV0dXJuO1xyXG5cclxuICAgIC8vIE9wdGltaXN0aWMgVUkgc28gdXNlciBzZWVzIHJlYWN0aW9uIHJlbW92YWwgaW1tZWRpYXRlbHkuXHJcbiAgICB0aGlzLmFwcGx5UmVhY3Rpb25PcHRpbWlzdGljYWxseShtZXNzYWdlSWQsIGVtb2ppLCBmYWxzZSk7XHJcblxyXG4gICAgdGhpcy5hcGkucmVtb3ZlUmVhY3Rpb24obWVzc2FnZUlkLCBjb250YWN0SWQsIGVtb2ppKS5zdWJzY3JpYmUoe1xyXG4gICAgICBuZXh0OiAoKSA9PiB7XHJcbiAgICAgICAgdGhpcy5yZWZyZXNoTWVzc2FnZVJlYWN0aW9ucyhtZXNzYWdlSWQpO1xyXG4gICAgICB9LFxyXG4gICAgICBlcnJvcjogKCkgPT4ge1xyXG4gICAgICAgIC8vIFJldmVydCBvcHRpbWlzdGljIHVwZGF0ZSB3aGVuIHJlcXVlc3QgZmFpbHMuXHJcbiAgICAgICAgdGhpcy5hcHBseVJlYWN0aW9uT3B0aW1pc3RpY2FsbHkobWVzc2FnZUlkLCBlbW9qaSwgdHJ1ZSk7XHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIGdldEFjdGl2ZUNvbnZlcnNhdGlvbklkKCk6IHN0cmluZyB8IG51bGwge1xyXG4gICAgcmV0dXJuIHRoaXMuYWN0aXZlQ29udmVyc2F0aW9uSWQkLnZhbHVlO1xyXG4gIH1cclxuXHJcbiAgLy8g4pSA4pSAIEdldHRlcnMg4pSA4pSAXHJcbiAgZ2V0TWVzc2FnZXNGb3JDb252ZXJzYXRpb24oY29udmVyc2F0aW9uSWQ6IHN0cmluZyk6IE1lc3NhZ2VbXSB7XHJcbiAgICByZXR1cm4gdGhpcy5tZXNzYWdlc01hcCQudmFsdWUuZ2V0KGNvbnZlcnNhdGlvbklkKSB8fCBbXTtcclxuICB9XHJcblxyXG4gIGdldEN1cnJlbnRJbmJveCgpOiBJbmJveEl0ZW1bXSB7XHJcbiAgICByZXR1cm4gdGhpcy5pbmJveCQudmFsdWU7XHJcbiAgfVxyXG5cclxuICAvLyDilIDilIAgUHJpdmF0ZSBoZWxwZXJzIOKUgOKUgFxyXG4gIC8qKlxyXG4gICAqIFByZWZlciBgeyB0eXBlLCBkYXRhIH1gOyBzdXBwb3J0IGZsYXQgYHsgdHlwZSwgLi4uZmllbGRzIH1gIGVudmVsb3BlcyBmcm9tIG9sZGVyIGJhY2tlbmRzLlxyXG4gICAqL1xyXG4gIHByaXZhdGUgd3NFdmVudFBheWxvYWQobXNnOiBXZWJTb2NrZXRNZXNzYWdlKTogYW55IHtcclxuICAgIGlmIChtc2cuZGF0YSAhPT0gdW5kZWZpbmVkICYmIG1zZy5kYXRhICE9PSBudWxsKSB7XHJcbiAgICAgIHJldHVybiBtc2cuZGF0YTtcclxuICAgIH1cclxuICAgIGNvbnN0IHJhdyA9IG1zZyBhcyB1bmtub3duIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+O1xyXG4gICAgY29uc3QgeyB0eXBlOiBfdCwgZGF0YTogX2QsIHRpbWVzdGFtcDogX3RzLCBtZXNzYWdlOiBfbXNnLCAuLi5yZXN0IH0gPSByYXc7XHJcbiAgICByZXR1cm4gT2JqZWN0LmtleXMocmVzdCkubGVuZ3RoID8gcmVzdCA6IG51bGw7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGxpc3RlbldlYlNvY2tldCgpOiB2b2lkIHtcclxuICAgIHRoaXMud3NTdWI/LnVuc3Vic2NyaWJlKCk7XHJcbiAgICB0aGlzLndzU3ViID0gdGhpcy53c1NlcnZpY2Uub25NZXNzYWdlJC5zdWJzY3JpYmUoKG1zZykgPT4gdGhpcy5oYW5kbGVXc01lc3NhZ2UobXNnKSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGhhbmRsZVdzTWVzc2FnZShtc2c6IFdlYlNvY2tldE1lc3NhZ2UpOiB2b2lkIHtcclxuICAgIHN3aXRjaCAobXNnLnR5cGUpIHtcclxuICAgICAgY2FzZSAnbmV3X21lc3NhZ2UnOlxyXG4gICAgICAgIHRoaXMuaGFuZGxlTmV3TWVzc2FnZSh0aGlzLndzRXZlbnRQYXlsb2FkKG1zZykpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICBjYXNlICdjb252ZXJzYXRpb25fdXBkYXRlZCc6XHJcbiAgICAgICAgdGhpcy5sb2FkSW5ib3goKTtcclxuICAgICAgICBpZiAodGhpcy5hY3RpdmVDb252ZXJzYXRpb25JZCQudmFsdWUpIHtcclxuICAgICAgICAgIHRoaXMubG9hZE1lc3NhZ2VzKHRoaXMuYWN0aXZlQ29udmVyc2F0aW9uSWQkLnZhbHVlKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgIGNhc2UgJ2dyb3VwX3VwZGF0ZWQnOlxyXG4gICAgICAgIHRoaXMuaGFuZGxlR3JvdXBVcGRhdGVkKHRoaXMud3NFdmVudFBheWxvYWQobXNnKSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgIGNhc2UgJ2Vycm9yJzpcclxuICAgICAgICB0aGlzLmhhbmRsZVdlYlNvY2tldEVycm9yKG1zZy5tZXNzYWdlKTtcclxuICAgICAgICBicmVhaztcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHByaXZhdGUgaGFuZGxlR3JvdXBVcGRhdGVkKGRhdGE6IGFueSk6IHZvaWQge1xyXG4gICAgdGhpcy5sb2FkSW5ib3goKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgaGFuZGxlV2ViU29ja2V0RXJyb3IoZXJyb3JNZXNzYWdlOiBzdHJpbmcgfCB1bmRlZmluZWQpOiB2b2lkIHtcclxuICAgIHZvaWQgZXJyb3JNZXNzYWdlO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBoYW5kbGVOZXdNZXNzYWdlKGRhdGE6IGFueSk6IHZvaWQge1xyXG4gICAgaWYgKCFkYXRhKSByZXR1cm47XHJcblxyXG4gICAgbGV0IG1lc3NhZ2U6IE1lc3NhZ2UgPSB0aGlzLm5vcm1hbGl6ZU1lc3NhZ2VTaGFwZShkYXRhKTtcclxuICAgIGNvbnN0IG15Q29udGFjdElkID0gU3RyaW5nKHRoaXMuYXV0aC5jb250YWN0SWQgPz8gJycpO1xyXG4gICAgY29uc3QgY29udklkID0gU3RyaW5nKG1lc3NhZ2UuY29udmVyc2F0aW9uX2lkID8/ICcnKTtcclxuICAgIGNvbnN0IGV4aXN0aW5nID0gdGhpcy5tZXNzYWdlc01hcCQudmFsdWUuZ2V0KGNvbnZJZCkgfHwgW107XHJcblxyXG4gICAgY29uc3Qgb3duRWNobyA9XHJcbiAgICAgIG15Q29udGFjdElkICYmXHJcbiAgICAgIFN0cmluZyhtZXNzYWdlLnNlbmRlcl9pZCkgPT09IG15Q29udGFjdElkICYmXHJcbiAgICAgICEhbWVzc2FnZS5tZXNzYWdlX2lkICYmXHJcbiAgICAgICFTdHJpbmcobWVzc2FnZS5tZXNzYWdlX2lkKS5zdGFydHNXaXRoKCd0ZW1wLScpO1xyXG5cclxuICAgIC8vIFdTIG9mdGVuIGFycml2ZXMgYmVmb3JlIEhUVFAgZmluaXNoZXMgcmVwbGFjaW5nIHRlbXAtOyBtZXJnZSBpbnRvIHRlbXAgaW5zdGVhZCBvZiBhcHBlbmRpbmcgYSBkdXBsaWNhdGUgcm93LlxyXG4gICAgaWYgKG93bkVjaG8pIHtcclxuICAgICAgY29uc3QgdGVtcElkeCA9IGV4aXN0aW5nLmZpbmRJbmRleCgobSkgPT4ge1xyXG4gICAgICAgIGlmICghU3RyaW5nKG0ubWVzc2FnZV9pZCkuc3RhcnRzV2l0aCgndGVtcC0nKSkgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIGlmIChTdHJpbmcobS5jb252ZXJzYXRpb25faWQpICE9PSBjb252SWQpIHJldHVybiBmYWxzZTtcclxuICAgICAgICBpZiAoU3RyaW5nKG0uc2VuZGVyX2lkKSAhPT0gbXlDb250YWN0SWQpIHJldHVybiBmYWxzZTtcclxuICAgICAgICBjb25zdCBkdCA9IE1hdGguYWJzKFxyXG4gICAgICAgICAgbmV3IERhdGUobS5jcmVhdGVkX2F0KS5nZXRUaW1lKCkgLSBuZXcgRGF0ZShtZXNzYWdlLmNyZWF0ZWRfYXQpLmdldFRpbWUoKVxyXG4gICAgICAgICk7XHJcbiAgICAgICAgaWYgKGR0ID49IDEyMF8wMDApIHJldHVybiBmYWxzZTtcclxuICAgICAgICBjb25zdCBhID0gU3RyaW5nKG0uY29udGVudCA/PyAnJykudHJpbSgpO1xyXG4gICAgICAgIGNvbnN0IGIgPSBTdHJpbmcobWVzc2FnZS5jb250ZW50ID8/ICcnKS50cmltKCk7XHJcbiAgICAgICAgcmV0dXJuIGEgPT09IGIgfHwgIWI7XHJcbiAgICAgIH0pO1xyXG4gICAgICBpZiAodGVtcElkeCA+PSAwKSB7XHJcbiAgICAgICAgY29uc3QgbWVyZ2VkOiBNZXNzYWdlID0gdGhpcy5ub3JtYWxpemVNZXNzYWdlU2hhcGUoe1xyXG4gICAgICAgICAgLi4uZXhpc3RpbmdbdGVtcElkeF0sXHJcbiAgICAgICAgICAuLi5kYXRhLFxyXG4gICAgICAgICAgbWVzc2FnZV9pZDogbWVzc2FnZS5tZXNzYWdlX2lkLFxyXG4gICAgICAgICAgY29udmVyc2F0aW9uX2lkOiBjb252SWQsXHJcbiAgICAgICAgICBjb250ZW50OiB0aGlzLmNvYWxlc2NlTWVzc2FnZVRleHQoZGF0YSwgZXhpc3RpbmdbdGVtcElkeF0uY29udGVudCksXHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgY29uc3QgbWFwID0gbmV3IE1hcCh0aGlzLm1lc3NhZ2VzTWFwJC52YWx1ZSk7XHJcbiAgICAgICAgY29uc3QgbXNncyA9IHRoaXMuZGVkdXBlTWVzc2FnZXNCeUlkS2VlcEZpcnN0KFsuLi5leGlzdGluZ10pO1xyXG4gICAgICAgIG1zZ3NbdGVtcElkeF0gPSBtZXJnZWQ7XHJcbiAgICAgICAgbWFwLnNldChjb252SWQsIHRoaXMuZGVkdXBlTWVzc2FnZXNCeUlkS2VlcEZpcnN0KG1zZ3MpKTtcclxuICAgICAgICB0aGlzLm1lc3NhZ2VzTWFwJC5uZXh0KG1hcCk7XHJcbiAgICAgICAgdGhpcy5yZWZyZXNoTWVzc2FnZVJlYWN0aW9ucyhtZXJnZWQubWVzc2FnZV9pZCk7XHJcbiAgICAgICAgbWVzc2FnZSA9IG1lcmdlZDtcclxuICAgICAgICB0aGlzLnVwZGF0ZUluYm94UHJldmlldyhtZXNzYWdlKTtcclxuICAgICAgICBpZiAodGhpcy5hY3RpdmVDb252ZXJzYXRpb25JZCQudmFsdWUgPT09IG1lc3NhZ2UuY29udmVyc2F0aW9uX2lkKSB7XHJcbiAgICAgICAgICB0aGlzLm1hcmtBc1JlYWQobWVzc2FnZS5jb252ZXJzYXRpb25faWQpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm47XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBpc0Zyb21PdGhlciA9IFN0cmluZyhtZXNzYWdlLnNlbmRlcl9pZCkgIT09IG15Q29udGFjdElkO1xyXG5cclxuICAgIGNvbnN0IGlzRHVwbGljYXRlID0gZXhpc3Rpbmcuc29tZShcclxuICAgICAgKG0pID0+XHJcbiAgICAgICAgU3RyaW5nKG0ubWVzc2FnZV9pZCkgPT09IFN0cmluZyhtZXNzYWdlLm1lc3NhZ2VfaWQpIHx8XHJcbiAgICAgICAgKFN0cmluZyhtLnNlbmRlcl9pZCkgPT09IFN0cmluZyhtZXNzYWdlLnNlbmRlcl9pZCkgJiZcclxuICAgICAgICAgIFN0cmluZyhtLmNvbnRlbnQgPz8gJycpID09PSBTdHJpbmcobWVzc2FnZS5jb250ZW50ID8/ICcnKSAmJlxyXG4gICAgICAgICAgTWF0aC5hYnMobmV3IERhdGUobS5jcmVhdGVkX2F0KS5nZXRUaW1lKCkgLSBuZXcgRGF0ZShtZXNzYWdlLmNyZWF0ZWRfYXQpLmdldFRpbWUoKSkgPCAyMDAwKVxyXG4gICAgKTtcclxuXHJcbiAgICBpZiAoIWlzRHVwbGljYXRlKSB7XHJcbiAgICAgIHRoaXMuYXBwZW5kTWVzc2FnZShtZXNzYWdlKTtcclxuXHJcbiAgICAgIGlmIChpc0Zyb21PdGhlcikge1xyXG4gICAgICAgIHRoaXMucGxheU5vdGlmaWNhdGlvblNvdW5kKCk7XHJcbiAgICAgIH1cclxuICAgICAgdGhpcy51cGRhdGVJbmJveFByZXZpZXcobWVzc2FnZSk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKHRoaXMuYWN0aXZlQ29udmVyc2F0aW9uSWQkLnZhbHVlICE9PSBtZXNzYWdlLmNvbnZlcnNhdGlvbl9pZCkge1xyXG4gICAgICBpZiAoaXNGcm9tT3RoZXIgJiYgIWlzRHVwbGljYXRlKSB7XHJcbiAgICAgICAgdGhpcy5pbmNyZW1lbnRVbnJlYWQobWVzc2FnZS5jb252ZXJzYXRpb25faWQpO1xyXG4gICAgICB9XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICB0aGlzLm1hcmtBc1JlYWQobWVzc2FnZS5jb252ZXJzYXRpb25faWQpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqIFB1YmxpYyDigJQgbGV0cyBjb21wb25lbnRzIGFkZCBhbiBvcHRpbWlzdGljIG1lc3NhZ2Ugd2l0aG91dCBhIHJvdW5kLXRyaXAuICovXHJcbiAgYXBwZW5kT3B0aW1pc3RpY01lc3NhZ2UobWVzc2FnZTogTWVzc2FnZSk6IHZvaWQge1xyXG4gICAgdGhpcy5hcHBlbmRNZXNzYWdlKG1lc3NhZ2UpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBhcHBlbmRNZXNzYWdlKG1lc3NhZ2U6IE1lc3NhZ2UpOiB2b2lkIHtcclxuICAgIGNvbnN0IG1hcCA9IG5ldyBNYXAodGhpcy5tZXNzYWdlc01hcCQudmFsdWUpO1xyXG4gICAgY29uc3QgbXNncyA9IFsuLi4obWFwLmdldChtZXNzYWdlLmNvbnZlcnNhdGlvbl9pZCkgfHwgW10pLCBtZXNzYWdlXTtcclxuICAgIG1hcC5zZXQobWVzc2FnZS5jb252ZXJzYXRpb25faWQsIG1zZ3MpO1xyXG4gICAgdGhpcy5tZXNzYWdlc01hcCQubmV4dChtYXApO1xyXG4gICAgdGhpcy5yZWZyZXNoTWVzc2FnZVJlYWN0aW9ucyhtZXNzYWdlLm1lc3NhZ2VfaWQpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSB1cGRhdGVJbmJveFByZXZpZXcobWVzc2FnZTogTWVzc2FnZSk6IHZvaWQge1xyXG4gICAgY29uc3QgdGV4dCA9IFN0cmluZyhtZXNzYWdlLmNvbnRlbnQgPz8gJycpLnRyaW0oKTtcclxuICAgIGNvbnN0IG1lZGlhID0gdGhpcy5tZXNzYWdlTG9va3NMaWtlTWVkaWEobWVzc2FnZSk7XHJcbiAgICBpZiAoIXRleHQgJiYgIW1lZGlhKSB7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIGNvbnN0IHByZXZpZXcgPSB0ZXh0IHx8ICdbSW1hZ2VdJztcclxuICAgIGNvbnN0IGl0ZW1zID0gdGhpcy5pbmJveCQudmFsdWUubWFwKChpdGVtKSA9PiB7XHJcbiAgICAgIGlmIChpdGVtLmNvbnZlcnNhdGlvbl9pZCA9PT0gbWVzc2FnZS5jb252ZXJzYXRpb25faWQpIHtcclxuICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgLi4uaXRlbSxcclxuICAgICAgICAgIGxhc3RfbWVzc2FnZV9wcmV2aWV3OiBwcmV2aWV3LFxyXG4gICAgICAgICAgbGFzdF9tZXNzYWdlX2F0OiBtZXNzYWdlLmNyZWF0ZWRfYXQsXHJcbiAgICAgICAgfTtcclxuICAgICAgfVxyXG4gICAgICByZXR1cm4gaXRlbTtcclxuICAgIH0pO1xyXG5cclxuICAgIGl0ZW1zLnNvcnQoKGEsIGIpID0+IG5ldyBEYXRlKGIubGFzdF9tZXNzYWdlX2F0KS5nZXRUaW1lKCkgLSBuZXcgRGF0ZShhLmxhc3RfbWVzc2FnZV9hdCkuZ2V0VGltZSgpKTtcclxuICAgIHRoaXMuaW5ib3gkLm5leHQoaXRlbXMpO1xyXG4gIH1cclxuXHJcbiAgLyoqIEZpcnN0IG5vbi1lbXB0eSB0ZXh0IGZpZWxkIGZyb20gQVBJIC8gV1Mgb2JqZWN0cyAoUE9TVCBib2RpZXMgb2Z0ZW4gb21pdCBgY29udGVudGApLiAqL1xyXG4gIHByaXZhdGUgY29hbGVzY2VNZXNzYWdlVGV4dChyYXc6IGFueSwgZmFsbGJhY2sgPSAnJyk6IHN0cmluZyB7XHJcbiAgICBjb25zdCBjYW5kcyA9IFtyYXc/LmNvbnRlbnQsIHJhdz8uYm9keSwgcmF3Py50ZXh0LCBmYWxsYmFja107XHJcbiAgICBmb3IgKGNvbnN0IGMgb2YgY2FuZHMpIHtcclxuICAgICAgaWYgKHR5cGVvZiBjID09PSAnc3RyaW5nJyAmJiBjLnRyaW0oKSkgcmV0dXJuIGM7XHJcbiAgICAgIGlmIChjICE9IG51bGwgJiYgdHlwZW9mIGMgIT09ICdvYmplY3QnICYmIFN0cmluZyhjKS50cmltKCkpIHJldHVybiBTdHJpbmcoYykudHJpbSgpO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHR5cGVvZiBmYWxsYmFjayA9PT0gJ3N0cmluZycgPyBmYWxsYmFjayA6IFN0cmluZyhmYWxsYmFjayA/PyAnJyk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIG1lc3NhZ2VMb29rc0xpa2VNZWRpYShtOiBNZXNzYWdlKTogYm9vbGVhbiB7XHJcbiAgICBjb25zdCB0ID0gbS5tZXNzYWdlX3R5cGU7XHJcbiAgICBpZiAodCAmJiB0ICE9PSAnVEVYVCcpIHJldHVybiB0cnVlO1xyXG4gICAgY29uc3QgdSA9IFN0cmluZyhtLm1lZGlhX3VybCA/PyAnJykudHJpbSgpO1xyXG4gICAgaWYgKHUgJiYgKHUuc3RhcnRzV2l0aCgnaHR0cDovLycpIHx8IHUuc3RhcnRzV2l0aCgnaHR0cHM6Ly8nKSB8fCB1LnN0YXJ0c1dpdGgoJ2RhdGE6JykpKSB7XHJcbiAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIEFycmF5LmlzQXJyYXkobS5hdHRhY2htZW50cykgJiYgbS5hdHRhY2htZW50cy5sZW5ndGggPiAwO1xyXG4gIH1cclxuXHJcbiAgLyoqIFNhbWUgbG9naWNhbCBtZXNzYWdlX2lkIGNhbiBhcHBlYXIgdHdpY2Ugd2hlbiBXUyBiZWF0cyBIVFRQIHRlbXAgcmVwbGFjZW1lbnQg4oCUIGtlZXAgZmlyc3Qgcm93LiAqL1xyXG4gIHByaXZhdGUgZGVkdXBlTWVzc2FnZXNCeUlkS2VlcEZpcnN0KG1zZ3M6IE1lc3NhZ2VbXSk6IE1lc3NhZ2VbXSB7XHJcbiAgICBjb25zdCBzZWVuID0gbmV3IFNldDxzdHJpbmc+KCk7XHJcbiAgICByZXR1cm4gbXNncy5maWx0ZXIoKG0pID0+IHtcclxuICAgICAgY29uc3QgaWQgPSBTdHJpbmcobS5tZXNzYWdlX2lkID8/ICcnKTtcclxuICAgICAgaWYgKCFpZCkgcmV0dXJuIHRydWU7XHJcbiAgICAgIGlmIChzZWVuLmhhcyhpZCkpIHJldHVybiBmYWxzZTtcclxuICAgICAgc2Vlbi5hZGQoaWQpO1xyXG4gICAgICByZXR1cm4gdHJ1ZTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBpbmNyZW1lbnRVbnJlYWQoY29udmVyc2F0aW9uSWQ6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgY29uc3QgaXRlbXMgPSB0aGlzLmluYm94JC52YWx1ZS5tYXAoKGl0ZW0pID0+XHJcbiAgICAgIGl0ZW0uY29udmVyc2F0aW9uX2lkID09PSBjb252ZXJzYXRpb25JZFxyXG4gICAgICAgID8geyAuLi5pdGVtLCB1bnJlYWRfY291bnQ6IE51bWJlcihpdGVtLnVucmVhZF9jb3VudCkgKyAxIH1cclxuICAgICAgICA6IGl0ZW1cclxuICAgICk7XHJcbiAgICB0aGlzLmluYm94JC5uZXh0KGl0ZW1zKTtcclxuICAgIHRoaXMucmVjYWxjVW5yZWFkKGl0ZW1zKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIE5vcm1hbGl6ZSBiYWNrZW5kIG1lc3NhZ2Ugc2hhcGVzIHNvIFVJIGNhbiByZWxpYWJseSByZW5kZXIgYXR0YWNobWVudHMvbWVkaWEuXHJcbiAgICogU3VwcG9ydHMgbGVnYWN5IGFuZCBjdXJyZW50IGZpZWxkIG5hbWVzIHJldHVybmVkIGJ5IEFQSS9XUyBwYXlsb2Fkcy5cclxuICAgKi9cclxuICBwcml2YXRlIG5vcm1hbGl6ZU1lc3NhZ2VTaGFwZShyYXc6IGFueSk6IE1lc3NhZ2Uge1xyXG4gICAgY29uc3QgYmFzZTogTWVzc2FnZSA9IHtcclxuICAgICAgbWVzc2FnZV9pZDogU3RyaW5nKHJhdz8ubWVzc2FnZV9pZCA/PyByYXc/LmlkID8/ICcnKSxcclxuICAgICAgY29udmVyc2F0aW9uX2lkOiBTdHJpbmcocmF3Py5jb252ZXJzYXRpb25faWQgPz8gcmF3Py5jb252ZXJzYXRpb25JZCA/PyAnJyksXHJcbiAgICAgIHNlbmRlcl9pZDogU3RyaW5nKHJhdz8uc2VuZGVyX2lkID8/IHJhdz8uc2VuZGVySWQgPz8gJycpLFxyXG4gICAgICBzZW5kZXJfbmFtZTogcmF3Py5zZW5kZXJfbmFtZSxcclxuICAgICAgc2VuZGVyX3VzZXJuYW1lOiByYXc/LnNlbmRlcl91c2VybmFtZSxcclxuICAgICAgc2VuZGVyX2ZpcnN0X25hbWU6IHJhdz8uc2VuZGVyX2ZpcnN0X25hbWUsXHJcbiAgICAgIHNlbmRlcl9sYXN0X25hbWU6IHJhdz8uc2VuZGVyX2xhc3RfbmFtZSxcclxuICAgICAgbWVzc2FnZV90eXBlOiAocmF3Py5tZXNzYWdlX3R5cGUgPz8gcmF3Py5tZXNzYWdlVHlwZSA/PyAnVEVYVCcpIGFzIE1lc3NhZ2VbJ21lc3NhZ2VfdHlwZSddLFxyXG4gICAgICBjb250ZW50OiByYXc/LmNvbnRlbnQgPz8gcmF3Py5ib2R5ID8/IHJhdz8udGV4dCA/PyAnJyxcclxuICAgICAgbWVkaWFfdXJsOiByYXc/Lm1lZGlhX3VybCA/PyByYXc/Lm1lZGlhVXJsID8/IHJhdz8udXJsID8/IHJhdz8uZmlsZV91cmwsXHJcbiAgICAgIGNyZWF0ZWRfYXQ6IHJhdz8uY3JlYXRlZF9hdCA/PyByYXc/LmNyZWF0ZWRBdCA/PyBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXHJcbiAgICAgIGlzX3JlYWQ6IHJhdz8uaXNfcmVhZCxcclxuICAgICAgcmVhY3Rpb25zOiByYXc/LnJlYWN0aW9ucyxcclxuICAgICAgbWVudGlvbnM6IHJhdz8ubWVudGlvbnMsXHJcbiAgICAgIGF0dGFjaG1lbnRzOiByYXc/LmF0dGFjaG1lbnRzLFxyXG4gICAgICBpc19waW5uZWQ6IHJhdz8uaXNfcGlubmVkLFxyXG4gICAgICBwaW5uZWRfYXQ6IHJhdz8ucGlubmVkX2F0LFxyXG4gICAgICBwaW5uZWRfYnk6IHJhdz8ucGlubmVkX2J5LFxyXG4gICAgfTtcclxuXHJcbiAgICBjb25zdCB1dWlkUmUgPVxyXG4gICAgICAvXlswLTlhLWZdezh9LVswLTlhLWZdezR9LVsxLTVdWzAtOWEtZl17M30tWzg5YWJdWzAtOWEtZl17M30tWzAtOWEtZl17MTJ9JC9pO1xyXG5cclxuICAgIC8vIE5vcm1hbGl6ZSBhdHRhY2htZW50IG9iamVjdHMgKEFQSSBtYXkgdXNlIGZpbGVJZCAvIGlkIGluc3RlYWQgb2YgZmlsZV9pZCkuXHJcbiAgICBpZiAoQXJyYXkuaXNBcnJheShiYXNlLmF0dGFjaG1lbnRzKSAmJiBiYXNlLmF0dGFjaG1lbnRzLmxlbmd0aCA+IDApIHtcclxuICAgICAgY29uc3QgbWFwcGVkOiBBdHRhY2htZW50W10gPSAoYmFzZS5hdHRhY2htZW50cyBhcyBhbnlbXSkubWFwKChhKSA9PiAoe1xyXG4gICAgICAgIGZpbGVfaWQ6IFN0cmluZyhcclxuICAgICAgICAgIGE/LmZpbGVfaWQgPz8gYT8uZmlsZUlkID8/IGE/LmlkID8/IGE/LmF0dGFjaG1lbnRfaWQgPz8gYT8uc3RvcmFnZV9maWxlX2lkID8/ICcnXHJcbiAgICAgICAgKS50cmltKCksXHJcbiAgICAgICAgZmlsZW5hbWU6IFN0cmluZyhhPy5maWxlbmFtZSA/PyBhPy5maWxlX25hbWUgPz8gYT8ubmFtZSA/PyBhPy5vcmlnaW5hbF9maWxlbmFtZSA/PyAnJyksXHJcbiAgICAgICAgbWltZV90eXBlOiBhPy5taW1lX3R5cGUgPz8gYT8ubWltZVR5cGUsXHJcbiAgICAgICAgdXJsOiBhPy51cmwgPz8gYT8uZmlsZV91cmwgPz8gYT8uZG93bmxvYWRfdXJsLFxyXG4gICAgICB9KSkuZmlsdGVyKChhKSA9PiAhIWEuZmlsZV9pZCAmJiAhYS5maWxlX2lkLnN0YXJ0c1dpdGgoJ3RlbXAtJykpO1xyXG5cclxuICAgICAgaWYgKG1hcHBlZC5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgcmV0dXJuIHsgLi4uYmFzZSwgYXR0YWNobWVudHM6IG1hcHBlZCB9O1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLy8gUmVjb25zdHJ1Y3QgYXR0YWNobWVudHMgZnJvbSBhbHRlcm5hdGUgQVBJIGZpZWxkcy5cclxuICAgIGxldCBhdHRhY2htZW50SWRzOiBzdHJpbmdbXSA9IFtdO1xyXG4gICAgaWYgKEFycmF5LmlzQXJyYXkocmF3Py5hdHRhY2htZW50X2lkcykpIHtcclxuICAgICAgYXR0YWNobWVudElkcyA9IHJhdy5hdHRhY2htZW50X2lkcy5tYXAoKHg6IGFueSkgPT4gU3RyaW5nKHgpLnRyaW0oKSkuZmlsdGVyKEJvb2xlYW4pO1xyXG4gICAgfSBlbHNlIGlmICh0eXBlb2YgcmF3Py5hdHRhY2htZW50X2lkcyA9PT0gJ3N0cmluZycgJiYgcmF3LmF0dGFjaG1lbnRfaWRzLnRyaW0oKSkge1xyXG4gICAgICBhdHRhY2htZW50SWRzID0gcmF3LmF0dGFjaG1lbnRfaWRzXHJcbiAgICAgICAgLnNwbGl0KC9bLFxcc10rLylcclxuICAgICAgICAubWFwKChzOiBzdHJpbmcpID0+IHMudHJpbSgpKVxyXG4gICAgICAgIC5maWx0ZXIoQm9vbGVhbik7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGF0dGFjaG1lbnRJZHMubGVuZ3RoID09PSAwICYmIEFycmF5LmlzQXJyYXkocmF3Py5maWxlX2lkcykpIHtcclxuICAgICAgYXR0YWNobWVudElkcyA9IHJhdy5maWxlX2lkcy5tYXAoKHg6IGFueSkgPT4gU3RyaW5nKHgpLnRyaW0oKSkuZmlsdGVyKEJvb2xlYW4pO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHB1c2hJZCA9ICh2OiBhbnkpID0+IHtcclxuICAgICAgY29uc3QgcyA9IHYgIT0gbnVsbCAmJiB2ICE9PSAnJyA/IFN0cmluZyh2KS50cmltKCkgOiAnJztcclxuICAgICAgaWYgKHMgJiYgIWF0dGFjaG1lbnRJZHMuaW5jbHVkZXMocykpIGF0dGFjaG1lbnRJZHMucHVzaChzKTtcclxuICAgIH07XHJcblxyXG4gICAgcHVzaElkKHJhdz8uZmlsZV9pZCk7XHJcbiAgICBwdXNoSWQocmF3Py5hdHRhY2htZW50X2lkKTtcclxuICAgIHB1c2hJZChyYXc/LnN0b3JhZ2VfZmlsZV9pZCk7XHJcbiAgICBwdXNoSWQocmF3Py5ibG9iX2lkKTtcclxuXHJcbiAgICAvLyBCYWNrZW5kIHN0b3JlcyBmaXJzdCBhdHRhY2htZW50IGlkIGluIG1lc3NhZ2luZy5tZXNzYWdlLm1lZGlhX3VybCAoVVVJRCksIG5vdCBhIHB1YmxpYyBVUkwuXHJcbiAgICBjb25zdCBtZWRpYUFzSWQgPSBTdHJpbmcoYmFzZS5tZWRpYV91cmwgfHwgJycpLnRyaW0oKTtcclxuICAgIGlmIChcclxuICAgICAgbWVkaWFBc0lkICYmXHJcbiAgICAgICFtZWRpYUFzSWQuc3RhcnRzV2l0aCgnaHR0cDovLycpICYmXHJcbiAgICAgICFtZWRpYUFzSWQuc3RhcnRzV2l0aCgnaHR0cHM6Ly8nKSAmJlxyXG4gICAgICAhbWVkaWFBc0lkLnN0YXJ0c1dpdGgoJ2RhdGE6JylcclxuICAgICkge1xyXG4gICAgICBwdXNoSWQobWVkaWFBc0lkKTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBjb250ZW50VHJpbSA9IFN0cmluZyhiYXNlLmNvbnRlbnQgfHwgJycpLnRyaW0oKTtcclxuICAgIGlmIChhdHRhY2htZW50SWRzLmxlbmd0aCA9PT0gMCAmJiB1dWlkUmUudGVzdChjb250ZW50VHJpbSkpIHtcclxuICAgICAgYXR0YWNobWVudElkcy5wdXNoKGNvbnRlbnRUcmltKTtcclxuICAgIH1cclxuICAgIC8vIFNvbWUgQVBJcyBzdG9yZSBzdG9yYWdlIC8gYXR0YWNobWVudCBpZCBhcyBudW1lcmljIHN0cmluZyBpbiBjb250ZW50IGZvciBGSUxFIG1lc3NhZ2VzLlxyXG4gICAgaWYgKFxyXG4gICAgICBhdHRhY2htZW50SWRzLmxlbmd0aCA9PT0gMCAmJlxyXG4gICAgICAvXlxcZCskLy50ZXN0KGNvbnRlbnRUcmltKSAmJlxyXG4gICAgICAoYmFzZS5tZXNzYWdlX3R5cGUgPT09ICdGSUxFJyB8fCBiYXNlLm1lc3NhZ2VfdHlwZSA9PT0gJ0lNQUdFJylcclxuICAgICkge1xyXG4gICAgICBhdHRhY2htZW50SWRzLnB1c2goY29udGVudFRyaW0pO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGZpbGVuYW1lczogc3RyaW5nW10gPSBBcnJheS5pc0FycmF5KHJhdz8uZmlsZW5hbWVzKVxyXG4gICAgICA/IHJhdy5maWxlbmFtZXMubWFwKCh4OiBhbnkpID0+IFN0cmluZyh4KSlcclxuICAgICAgOiByYXc/LmZpbGVuYW1lXHJcbiAgICAgID8gW1N0cmluZyhyYXcuZmlsZW5hbWUpXVxyXG4gICAgICA6IHJhdz8uZmlsZV9uYW1lXHJcbiAgICAgID8gW1N0cmluZyhyYXcuZmlsZV9uYW1lKV1cclxuICAgICAgOiBiYXNlLmNvbnRlbnQgJiYgIXV1aWRSZS50ZXN0KGNvbnRlbnRUcmltKVxyXG4gICAgICA/IFtTdHJpbmcoYmFzZS5jb250ZW50KV1cclxuICAgICAgOiBbXTtcclxuXHJcbiAgICBpZiAoYXR0YWNobWVudElkcy5sZW5ndGggPiAwIHx8IGZpbGVuYW1lcy5sZW5ndGggPiAwKSB7XHJcbiAgICAgIGNvbnN0IGZhbGxiYWNrTWltZSA9IHJhdz8ubWltZV90eXBlID8/IHJhdz8uYXR0YWNobWVudF9taW1lX3R5cGU7XHJcbiAgICAgIGNvbnN0IHVybEZhbGxiYWNrID0gcmF3Py5maWxlX3VybCA/PyByYXc/LnVybCA/PyByYXc/Lm1lZGlhX3VybCA/PyByYXc/Lm1lZGlhVXJsO1xyXG4gICAgICBjb25zdCBpZHMgPSBhdHRhY2htZW50SWRzLmxlbmd0aCA+IDAgPyBhdHRhY2htZW50SWRzIDogW107XHJcbiAgICAgIGNvbnN0IGJ1aWx0OiBBdHRhY2htZW50W10gPSBpZHMubWFwKChpZCwgaWR4KSA9PiAoe1xyXG4gICAgICAgIGZpbGVfaWQ6IGlkLFxyXG4gICAgICAgIGZpbGVuYW1lOiBmaWxlbmFtZXNbaWR4XSB8fCBmaWxlbmFtZXNbMF0gfHwgYEF0dGFjaG1lbnQgJHtpZHggKyAxfWAsXHJcbiAgICAgICAgbWltZV90eXBlOiBmYWxsYmFja01pbWUsXHJcbiAgICAgICAgdXJsOiB1cmxGYWxsYmFjayxcclxuICAgICAgfSkpO1xyXG5cclxuICAgICAgLy8gRmlsZW5hbWUgb25seSArIGRpcmVjdCBVUkwgKG5vIHN0b3JhZ2UgaWQpOiBzdGlsbCByZW5kZXJhYmxlIGFzIDxpbWcgc3JjPi5cclxuICAgICAgaWYgKFxyXG4gICAgICAgIGJ1aWx0Lmxlbmd0aCA9PT0gMCAmJlxyXG4gICAgICAgIGZpbGVuYW1lcy5sZW5ndGggPiAwICYmXHJcbiAgICAgICAgdXJsRmFsbGJhY2sgJiZcclxuICAgICAgICBTdHJpbmcodXJsRmFsbGJhY2spLm1hdGNoKC9eaHR0cHM/OlxcL1xcLy9pKVxyXG4gICAgICApIHtcclxuICAgICAgICBidWlsdC5wdXNoKHtcclxuICAgICAgICAgIGZpbGVfaWQ6ICcnLFxyXG4gICAgICAgICAgZmlsZW5hbWU6IGZpbGVuYW1lc1swXSxcclxuICAgICAgICAgIG1pbWVfdHlwZTogZmFsbGJhY2tNaW1lLFxyXG4gICAgICAgICAgdXJsOiBTdHJpbmcodXJsRmFsbGJhY2spLFxyXG4gICAgICAgIH0pO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBpZiAoYnVpbHQubGVuZ3RoID4gMCkge1xyXG4gICAgICAgIHJldHVybiB7IC4uLmJhc2UsIGF0dGFjaG1lbnRzOiBidWlsdCB9O1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIGJhc2U7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHBsYXlOb3RpZmljYXRpb25Tb3VuZCgpOiB2b2lkIHtcclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IGF1ZGlvID0gbmV3IEF1ZGlvKCdkYXRhOmF1ZGlvL3dhdjtiYXNlNjQsVWtsR1Jub0dBQUJYUVZaRlptMTBJQkFBQUFBQkFBRUFRQjhBQUVBZkFBQUJBQWdBWkdGMFlRb0dBQUNCaFlxRmJGMWZkSml2ckpCaE5qVmdvZERicTJFY0JqK2EyL0xEY2lVRkxJSE84dGlKTndnWmFMdnQ1NTlORUF4UXArUHd0bU1jQmppUjEvTE1lU3dGSkhmSDhOMlFRQW9VWHJUcDY2aFZGQXBHbitEeXZtd2hCU3VCenZMWmlUWUlHR1M1N09paFVCRUxUS1hoOGJsbEhBVTJqZFh6em4wdkJTaCt6UExhaXpzS0ZHQ3o2T3lyV0JRTFNLRGY4c0Z1SXdVdWc4L3kyNGszQ0Joa3Urem9vVkFSQzB5bDRmRzVaUndGTm8zVjg4NTlMd1VvZnN6eTJvczdDaFJncytqc3ExZ1ZDMGlnMy9MQmJpTUZMb0xQOHR1Sk53Z1laTHZzNktGUUVRdE1wZUh4dVdVY0JUYU4xZlBPZlM4RktIN004dHFMT3dvVVlMUG83S3RZRlF0SW9OL3l3VzRqQlM2Q3ovTGJpVGNJR0dTNzdPaWhVQkVMVEtYaDhibGxIQVUyamRYenpuMHZCU2grelBMYWl6c0tGR0N6Nk95cldCVUxTS0RmOHNGdUl3VXVncy95MjRrM0NCaGt1K3pvb1ZBUkMweWw0Zkc1WlJ3Rk5vM1Y4ODU5THdVb2Zzenkyb3M3Q2hSZ3MranNxMWdWQzBpZzMvTEJiaU1GTG9MUDh0dUpOd2dZWkx2czZLRlFFUXRNcGVIeHVXVWNCVGFOMWZQT2ZTOEZLSDdNOHRxTE93b1VZTFBvN0t0WUZRdElvTi95d1c0akJTNkN6L0xiaVRjSUdHUzc3T2loVUJFTFRLWGg4YmxsSEFVMmpkWHp6bjB2QlNoK3pQTGFpenNLRkdDejZPeXJXQlVMU0tEZjhzRnVJd1V1Z3MveTI0azNDQmhrdSt6b29WQVJDMHlsNGZHNVpSd0ZObzNWODg1OUx3VW9mc3p5Mm9zN0NoUmdzK2pzcTFnVkMwaWczL0xCYmlNRkxvTFA4dHVKTndnWVpMdnM2S0ZRRVF0TXBlSHh1V1VjQlRhTjFmUE9mUzhGS0g3TTh0cUxPd29VWUxQbzdLdFlGUXRJb04veXdXNGpCUzZDei9MYmlUY0lHR1M3N09paFVCRUxUS1hoOGJsbEhBVTJqZFh6em4wdkJTaCt6UExhaXpzS0ZHQ3o2T3lyV0JVTFNLRGY4c0Z1SXdVdWdzL3kyNGszQ0Joa3Urem9vVkFSQzB5bDRmRzVaUndGTm8zVjg4NTlMd1VvZnN6eTJvczdDaFJncytqc3ExZ1ZDMGlnMy9MQmJpTUZMb0xQOHR1Sk53Z1laTHZzNktGUUVRdE1wZUh4dVdVY0JUYU4xZlBPZlM4RktIN004dHFMT3dvVVlMUG83S3RZRlF0SW9OL3l3VzRqQlM2Q3ovTGJpVGNJR0dTNzdPaWhVQkVMVEtYaDhibGxIQVUyamRYenpuMHZCU2grelBMYWl6c0tGR0N6Nk95cldCVUxTS0RmOHNGdUl3VXVncy95MjRrM0NCaGt1K3pvb1ZBUkMweWw0Zkc1WlJ3Rk5vM1Y4ODU5THdVb2Zzenkyb3M3Q2hSZ3MranNxMWdWQzBpZzMvTEJiaU1GTG9MUDh0dUpOd2dZWkx2czZLRlFFUXRNcGVIeHVXVWNCVGFOMWZQT2ZTOEZLSDdNOHRxTE93b1VZTFBvN0t0WUZRdElvTi95d1c0akJTNkN6L0xiaVRjSUdHUzc3T2loVUJFTFRLWGg4YmxsSEFVMmpkWHp6bjB2QlNoK3pQTGFpenNLRkdDejZPeXJXQlVMU0tEZjhzRnVJd1V1Z3MveTI0azNDQmhrdSt6b29WQVJDMHlsNGZHNVpSd0ZObzNWODg1OUx3VW9mc3p5Jyk7XHJcbiAgICAgIGF1ZGlvLnZvbHVtZSA9IDAuMztcclxuICAgICAgYXVkaW8ucGxheSgpLmNhdGNoKCgpID0+IHt9KTtcclxuICAgIH0gY2F0Y2gge1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSByZWNhbGNVbnJlYWQoaXRlbXM6IEluYm94SXRlbVtdKTogdm9pZCB7XHJcbiAgICBjb25zdCB0b3RhbCA9IGl0ZW1zLnJlZHVjZSgoc3VtLCBpKSA9PiBzdW0gKyBOdW1iZXIoaS51bnJlYWRfY291bnQgfHwgMCksIDApO1xyXG4gICAgdGhpcy50b3RhbFVucmVhZCQubmV4dCh0b3RhbCk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGh5ZHJhdGVSZWFjdGlvbnNGb3JDb252ZXJzYXRpb24oY29udmVyc2F0aW9uSWQ6IHN0cmluZywgbWVzc2FnZXM6IE1lc3NhZ2VbXSk6IHZvaWQge1xyXG4gICAgY29uc3QgZmV0Y2hhYmxlID0gbWVzc2FnZXMuZmlsdGVyKFxyXG4gICAgICAobSkgPT4gISFtLm1lc3NhZ2VfaWQgJiYgIVN0cmluZyhtLm1lc3NhZ2VfaWQpLnN0YXJ0c1dpdGgoJ3RlbXAtJylcclxuICAgICk7XHJcbiAgICBpZiAoIWZldGNoYWJsZS5sZW5ndGgpIHJldHVybjtcclxuXHJcbiAgICBjb25zdCBqb2JzID0gZmV0Y2hhYmxlLm1hcCgobSkgPT5cclxuICAgICAgdGhpcy5hcGkuZ2V0UmVhY3Rpb25zKG0ubWVzc2FnZV9pZCkucGlwZShcclxuICAgICAgICBtYXAoKHJvd3MpID0+ICh7IG1lc3NhZ2VJZDogbS5tZXNzYWdlX2lkLCByZWFjdGlvbnM6IHRoaXMubm9ybWFsaXplUmVhY3Rpb25Sb3dzKHJvd3MpIH0pKSxcclxuICAgICAgICBjYXRjaEVycm9yKCgpID0+IG9mKHsgbWVzc2FnZUlkOiBtLm1lc3NhZ2VfaWQsIHJlYWN0aW9uczogW10gfSkpXHJcbiAgICAgIClcclxuICAgICk7XHJcblxyXG4gICAgZm9ya0pvaW4oam9icykuc3Vic2NyaWJlKChyZXN1bHRzKSA9PiB7XHJcbiAgICAgIGNvbnN0IG1hcCA9IG5ldyBNYXAodGhpcy5tZXNzYWdlc01hcCQudmFsdWUpO1xyXG4gICAgICBjb25zdCBjdXJyZW50ID0gWy4uLihtYXAuZ2V0KGNvbnZlcnNhdGlvbklkKSB8fCBbXSldO1xyXG4gICAgICBpZiAoIWN1cnJlbnQubGVuZ3RoKSByZXR1cm47XHJcblxyXG4gICAgICBsZXQgY2hhbmdlZCA9IGZhbHNlO1xyXG4gICAgICBmb3IgKGNvbnN0IHJlc3VsdCBvZiByZXN1bHRzKSB7XHJcbiAgICAgICAgY29uc3QgaWR4ID0gY3VycmVudC5maW5kSW5kZXgoKG0pID0+IFN0cmluZyhtLm1lc3NhZ2VfaWQpID09PSBTdHJpbmcocmVzdWx0Lm1lc3NhZ2VJZCkpO1xyXG4gICAgICAgIGlmIChpZHggPT09IC0xKSBjb250aW51ZTtcclxuICAgICAgICBjdXJyZW50W2lkeF0gPSB7IC4uLmN1cnJlbnRbaWR4XSwgcmVhY3Rpb25zOiByZXN1bHQucmVhY3Rpb25zIH07XHJcbiAgICAgICAgY2hhbmdlZCA9IHRydWU7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGlmIChjaGFuZ2VkKSB7XHJcbiAgICAgICAgbWFwLnNldChjb252ZXJzYXRpb25JZCwgY3VycmVudCk7XHJcbiAgICAgICAgdGhpcy5tZXNzYWdlc01hcCQubmV4dChtYXApO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgcmVmcmVzaE1lc3NhZ2VSZWFjdGlvbnMobWVzc2FnZUlkOiBzdHJpbmcpOiB2b2lkIHtcclxuICAgIGlmICghbWVzc2FnZUlkIHx8IFN0cmluZyhtZXNzYWdlSWQpLnN0YXJ0c1dpdGgoJ3RlbXAtJykpIHJldHVybjtcclxuXHJcbiAgICB0aGlzLmFwaS5nZXRSZWFjdGlvbnMobWVzc2FnZUlkKS5zdWJzY3JpYmUoe1xyXG4gICAgICBuZXh0OiAocm93cykgPT4ge1xyXG4gICAgICAgIGNvbnN0IG5vcm1hbGl6ZWQgPSB0aGlzLm5vcm1hbGl6ZVJlYWN0aW9uUm93cyhyb3dzKTtcclxuICAgICAgICBjb25zdCBtYXAgPSBuZXcgTWFwKHRoaXMubWVzc2FnZXNNYXAkLnZhbHVlKTtcclxuICAgICAgICBsZXQgY2hhbmdlZCA9IGZhbHNlO1xyXG5cclxuICAgICAgICBmb3IgKGNvbnN0IFtjb252ZXJzYXRpb25JZCwgbXNnc10gb2YgbWFwLmVudHJpZXMoKSkge1xyXG4gICAgICAgICAgY29uc3QgaWR4ID0gbXNncy5maW5kSW5kZXgoKG0pID0+IFN0cmluZyhtLm1lc3NhZ2VfaWQpID09PSBTdHJpbmcobWVzc2FnZUlkKSk7XHJcbiAgICAgICAgICBpZiAoaWR4ID09PSAtMSkgY29udGludWU7XHJcbiAgICAgICAgICBjb25zdCBuZXh0TXNncyA9IFsuLi5tc2dzXTtcclxuICAgICAgICAgIG5leHRNc2dzW2lkeF0gPSB7IC4uLm5leHRNc2dzW2lkeF0sIHJlYWN0aW9uczogbm9ybWFsaXplZCB9O1xyXG4gICAgICAgICAgbWFwLnNldChjb252ZXJzYXRpb25JZCwgbmV4dE1zZ3MpO1xyXG4gICAgICAgICAgY2hhbmdlZCA9IHRydWU7XHJcbiAgICAgICAgICBicmVhaztcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmIChjaGFuZ2VkKSB7XHJcbiAgICAgICAgICB0aGlzLm1lc3NhZ2VzTWFwJC5uZXh0KG1hcCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9LFxyXG4gICAgICBlcnJvcjogKCkgPT4ge30sXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgbm9ybWFsaXplUmVhY3Rpb25Sb3dzKHJvd3M6IGFueVtdKTogYW55W10ge1xyXG4gICAgY29uc3QgYnlFbW9qaSA9IG5ldyBNYXA8c3RyaW5nLCB7IGVtb2ppOiBzdHJpbmc7IGNvdW50OiBudW1iZXI7IGhhc1JlYWN0ZWQ6IGJvb2xlYW47IHJlYWN0b3JzOiBzdHJpbmdbXSB9PigpO1xyXG4gICAgY29uc3QgbXlDb250YWN0SWQgPSBTdHJpbmcodGhpcy5hdXRoLmNvbnRhY3RJZCB8fCAnJyk7XHJcbiAgICBjb25zdCBjb250YWN0cyA9IHRoaXMudmlzaWJsZUNvbnRhY3RzJC52YWx1ZTtcclxuXHJcbiAgICBmb3IgKGNvbnN0IHJvdyBvZiByb3dzIHx8IFtdKSB7XHJcbiAgICAgIGNvbnN0IGVtb2ppID0gU3RyaW5nKHJvdz8uZW1vamkgfHwgJycpLnRyaW0oKTtcclxuICAgICAgaWYgKCFlbW9qaSkgY29udGludWU7XHJcblxyXG4gICAgICBjb25zdCBjb250YWN0SWQgPSBTdHJpbmcocm93Py5jb250YWN0X2lkID8/IHJvdz8uY29udGFjdElkID8/ICcnKTtcclxuICAgICAgY29uc3QgZXhwbGljaXRIYXNSZWFjdGVkID0gcm93Py5oYXNSZWFjdGVkID8/IHJvdz8uaGFzX3JlYWN0ZWQ7XHJcbiAgICAgIGNvbnN0IGhhc1JlYWN0ZWQgPSBleHBsaWNpdEhhc1JlYWN0ZWQgPT09IHRydWUgfHwgKGNvbnRhY3RJZCAmJiBjb250YWN0SWQgPT09IG15Q29udGFjdElkKTtcclxuXHJcbiAgICAgIGNvbnN0IGNvdW50RnJvbVJvdyA9IE51bWJlcihyb3c/LmNvdW50ID8/IHJvdz8ucmVhY3Rpb25fY291bnQgPz8gMCk7XHJcbiAgICAgIGNvbnN0IGV4aXN0aW5nID0gYnlFbW9qaS5nZXQoZW1vamkpIHx8IHsgZW1vamksIGNvdW50OiAwLCBoYXNSZWFjdGVkOiBmYWxzZSwgcmVhY3RvcnM6IFtdIH07XHJcblxyXG4gICAgICAvLyBTb21lIEFQSXMgcmV0dXJuIG9uZSByb3cgcGVyIHJlYWN0aW9uOyBzb21lIHJldHVybiBwcmUtYWdncmVnYXRlZCBjb3VudC5cclxuICAgICAgZXhpc3RpbmcuY291bnQgKz0gY291bnRGcm9tUm93ID4gMCA/IGNvdW50RnJvbVJvdyA6IDE7XHJcbiAgICAgIGV4aXN0aW5nLmhhc1JlYWN0ZWQgPSBleGlzdGluZy5oYXNSZWFjdGVkIHx8ICEhaGFzUmVhY3RlZDtcclxuXHJcbiAgICAgIC8vIFRyYWNrIHJlYWN0b3IgZGlzcGxheSBuYW1lcyB3aGVuIGluZGl2aWR1YWwgY29udGFjdElkIGlzIGF2YWlsYWJsZVxyXG4gICAgICBpZiAoY29udGFjdElkICYmIGNvdW50RnJvbVJvdyA8PSAxKSB7XHJcbiAgICAgICAgbGV0IG5hbWU6IHN0cmluZztcclxuICAgICAgICBpZiAoY29udGFjdElkID09PSBteUNvbnRhY3RJZCkge1xyXG4gICAgICAgICAgbmFtZSA9ICdZb3UnO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICBjb25zdCBjb250YWN0ID0gY29udGFjdHMuZmluZChjID0+IFN0cmluZyhjLmNvbnRhY3RfaWQpID09PSBjb250YWN0SWQpO1xyXG4gICAgICAgICAgbmFtZSA9IGNvbnRhY3QgPyBnZXRDb250YWN0RGlzcGxheU5hbWUoY29udGFjdCkgOiBgVXNlciAke2NvbnRhY3RJZH1gO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoIWV4aXN0aW5nLnJlYWN0b3JzLmluY2x1ZGVzKG5hbWUpKSB7XHJcbiAgICAgICAgICBleGlzdGluZy5yZWFjdG9ycy5wdXNoKG5hbWUpO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG5cclxuICAgICAgYnlFbW9qaS5zZXQoZW1vamksIGV4aXN0aW5nKTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gQXJyYXkuZnJvbShieUVtb2ppLnZhbHVlcygpKS5maWx0ZXIoKHIpID0+IHIuY291bnQgPiAwKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgYXBwbHlSZWFjdGlvbk9wdGltaXN0aWNhbGx5KG1lc3NhZ2VJZDogc3RyaW5nLCBlbW9qaTogc3RyaW5nLCBhZGQ6IGJvb2xlYW4pOiB2b2lkIHtcclxuICAgIGNvbnN0IG1hcCA9IG5ldyBNYXAodGhpcy5tZXNzYWdlc01hcCQudmFsdWUpO1xyXG4gICAgbGV0IGRpZFVwZGF0ZSA9IGZhbHNlO1xyXG5cclxuICAgIGZvciAoY29uc3QgW2NvbnZlcnNhdGlvbklkLCBtc2dzXSBvZiBtYXAuZW50cmllcygpKSB7XHJcbiAgICAgIGNvbnN0IGlkeCA9IG1zZ3MuZmluZEluZGV4KChtKSA9PiBTdHJpbmcobS5tZXNzYWdlX2lkKSA9PT0gU3RyaW5nKG1lc3NhZ2VJZCkpO1xyXG4gICAgICBpZiAoaWR4ID09PSAtMSkgY29udGludWU7XHJcblxyXG4gICAgICBjb25zdCB0YXJnZXQgPSBtc2dzW2lkeF07XHJcbiAgICAgIGNvbnN0IG5leHRSZWFjdGlvbnMgPSBbLi4uKHRhcmdldC5yZWFjdGlvbnMgfHwgW10pXTtcclxuICAgICAgY29uc3QgcklkeCA9IG5leHRSZWFjdGlvbnMuZmluZEluZGV4KChyKSA9PiByLmVtb2ppID09PSBlbW9qaSk7XHJcblxyXG4gICAgICBpZiAoYWRkKSB7XHJcbiAgICAgICAgaWYgKHJJZHggPj0gMCkge1xyXG4gICAgICAgICAgY29uc3QgY3VycmVudCA9IG5leHRSZWFjdGlvbnNbcklkeF07XHJcbiAgICAgICAgICBpZiAoIWN1cnJlbnQuaGFzUmVhY3RlZCkge1xyXG4gICAgICAgICAgICBuZXh0UmVhY3Rpb25zW3JJZHhdID0ge1xyXG4gICAgICAgICAgICAgIC4uLmN1cnJlbnQsXHJcbiAgICAgICAgICAgICAgaGFzUmVhY3RlZDogdHJ1ZSxcclxuICAgICAgICAgICAgICBjb3VudDogTnVtYmVyKGN1cnJlbnQuY291bnQgfHwgMCkgKyAxLFxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICBuZXh0UmVhY3Rpb25zLnB1c2goeyBlbW9qaSwgY291bnQ6IDEsIGhhc1JlYWN0ZWQ6IHRydWUgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIGlmIChySWR4ID49IDApIHtcclxuICAgICAgICAgIGNvbnN0IGN1cnJlbnQgPSBuZXh0UmVhY3Rpb25zW3JJZHhdO1xyXG4gICAgICAgICAgY29uc3QgbmV4dENvdW50ID0gTWF0aC5tYXgoTnVtYmVyKGN1cnJlbnQuY291bnQgfHwgMCkgLSAoY3VycmVudC5oYXNSZWFjdGVkID8gMSA6IDApLCAwKTtcclxuICAgICAgICAgIGlmIChuZXh0Q291bnQgPT09IDApIHtcclxuICAgICAgICAgICAgbmV4dFJlYWN0aW9ucy5zcGxpY2UocklkeCwgMSk7XHJcbiAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBuZXh0UmVhY3Rpb25zW3JJZHhdID0ge1xyXG4gICAgICAgICAgICAgIC4uLmN1cnJlbnQsXHJcbiAgICAgICAgICAgICAgaGFzUmVhY3RlZDogZmFsc2UsXHJcbiAgICAgICAgICAgICAgY291bnQ6IG5leHRDb3VudCxcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGNvbnN0IHVwZGF0ZWRNc2c6IE1lc3NhZ2UgPSB7IC4uLnRhcmdldCwgcmVhY3Rpb25zOiBuZXh0UmVhY3Rpb25zIH07XHJcbiAgICAgIGNvbnN0IHVwZGF0ZWRNc2dzID0gWy4uLm1zZ3NdO1xyXG4gICAgICB1cGRhdGVkTXNnc1tpZHhdID0gdXBkYXRlZE1zZztcclxuICAgICAgbWFwLnNldChjb252ZXJzYXRpb25JZCwgdXBkYXRlZE1zZ3MpO1xyXG4gICAgICBkaWRVcGRhdGUgPSB0cnVlO1xyXG4gICAgICBicmVhaztcclxuICAgIH1cclxuXHJcbiAgICBpZiAoZGlkVXBkYXRlKSB7XHJcbiAgICAgIHRoaXMubWVzc2FnZXNNYXAkLm5leHQobWFwKTtcclxuICAgIH1cclxuICB9XHJcbn1cclxuIl19