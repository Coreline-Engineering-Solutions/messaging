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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVzc2FnaW5nLXN0b3JlLnNlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvbGliL3NlcnZpY2VzL21lc3NhZ2luZy1zdG9yZS5zZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxVQUFVLEVBQWEsTUFBTSxlQUFlLENBQUM7QUFDdEQsT0FBTyxFQUFFLGVBQWUsRUFBRSxVQUFVLEVBQUUsT0FBTyxFQUFnQixRQUFRLEVBQUUsRUFBRSxFQUFFLE1BQU0sTUFBTSxDQUFDO0FBQ3hGLE9BQU8sRUFBRSxVQUFVLEVBQUUsR0FBRyxFQUFFLE1BQU0sZ0JBQWdCLENBQUM7QUFJakQsT0FBTyxFQVFMLHFCQUFxQixHQUV0QixNQUFNLDRCQUE0QixDQUFDOzs7OztBQUdwQyxNQUFNLE9BQU8scUJBQXFCO0lBMkN0QjtJQUNBO0lBQ0E7SUE1Q1YsdUJBQXVCO0lBQ2YsTUFBTSxHQUFHLElBQUksZUFBZSxDQUFjLEVBQUUsQ0FBQyxDQUFDO0lBQzlDLFlBQVksR0FBRyxJQUFJLGVBQWUsQ0FBeUIsSUFBSSxHQUFHLEVBQUUsQ0FBQyxDQUFDO0lBQ3RFLFVBQVUsR0FBRyxJQUFJLGVBQWUsQ0FBZSxFQUFFLENBQUMsQ0FBQztJQUNuRCxnQkFBZ0IsR0FBRyxJQUFJLGVBQWUsQ0FBWSxFQUFFLENBQUMsQ0FBQztJQUN0RCxVQUFVLEdBQUcsSUFBSSxlQUFlLENBQVUsS0FBSyxDQUFDLENBQUM7SUFDakQsV0FBVyxHQUFHLElBQUksZUFBZSxDQUFvRixPQUFPLENBQUMsQ0FBQztJQUM5SCxZQUFZLEdBQUcsSUFBSSxlQUFlLENBQ3ZDLFlBQVksQ0FBQyxPQUFPLENBQUMsd0JBQXdCLENBQWlCLElBQUksT0FBTyxDQUMzRSxDQUFDO0lBQ00scUJBQXFCLEdBQUcsSUFBSSxlQUFlLENBQWdCLElBQUksQ0FBQyxDQUFDO0lBQ2pFLG1CQUFtQixHQUFHLElBQUksZUFBZSxDQUEyQyxJQUFJLENB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Q0FBQztvQkFDaEMsQ0FBQzt5QkFBTSxDQUFDO3dCQUNOLGFBQWEsQ0FBQyxJQUFJLENBQUMsR0FBRzs0QkFDcEIsR0FBRyxPQUFPOzRCQUNWLFVBQVUsRUFBRSxLQUFLOzRCQUNqQixLQUFLLEVBQUUsU0FBUzt5QkFDakIsQ0FBQztvQkFDSixDQUFDO2dCQUNILENBQUM7WUFDSCxDQUFDO1lBRUQsTUFBTSxVQUFVLEdBQVksRUFBRSxHQUFHLE1BQU0sRUFBRSxTQUFTLEVBQUUsYUFBYSxFQUFFLENBQUM7WUFDcEUsTUFBTSxXQUFXLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDO1lBQzlCLFdBQVcsQ0FBQyxHQUFHLENBQUMsR0FBRyxVQUFVLENBQUM7WUFDOUIsR0FBRyxDQUFDLEdBQUcsQ0FBQyxjQUFjLEVBQUUsV0FBVyxDQUFDLENBQUM7WUFDckMsU0FBUyxHQUFHLElBQUksQ0FBQztZQUNqQixNQUFNO1FBQ1IsQ0FBQztRQUVELElBQUksU0FBUyxFQUFFLENBQUM7WUFDZCxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUM5QixDQUFDO0lBQ0gsQ0FBQzt3R0FsbENVLHFCQUFxQjs0R0FBckIscUJBQXFCLGNBRFIsTUFBTTs7NEZBQ25CLHFCQUFxQjtrQkFEakMsVUFBVTttQkFBQyxFQUFFLFVBQVUsRUFBRSxNQUFNLEVBQUUiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBJbmplY3RhYmxlLCBPbkRlc3Ryb3kgfSBmcm9tICdAYW5ndWxhci9jb3JlJztcbmltcG9ydCB7IEJlaGF2aW9yU3ViamVjdCwgT2JzZXJ2YWJsZSwgU3ViamVjdCwgU3Vic2NyaXB0aW9uLCBmb3JrSm9pbiwgb2YgfSBmcm9tICdyeGpzJztcbmltcG9ydCB7IGNhdGNoRXJyb3IsIG1hcCB9IGZyb20gJ3J4anMvb3BlcmF0b3JzJztcbmltcG9ydCB7IEF1dGhTZXJ2aWNlIH0gZnJvbSAnLi9hdXRoLnNlcnZpY2UnO1xuaW1wb3J0IHsgTWVzc2FnaW5nQXBpU2VydmljZSB9IGZyb20gJy4vbWVzc2FnaW5nLWFwaS5zZXJ2aWNlJztcbmltcG9ydCB7IE1lc3NhZ2luZ1dlYlNvY2tldFNlcnZpY2UgfSBmcm9tICcuL21lc3NhZ2luZy13ZWJzb2NrZXQuc2VydmljZSc7XG5pbXBvcnQge1xuICBJbmJveEl0ZW0sXG4gIE1lc3NhZ2UsXG4gIEF0dGFjaG1lbnQsXG4gIENvbnRhY3QsXG4gIENoYXRXaW5kb3csXG4gIFdlYlNvY2tldE1lc3NhZ2UsXG4gIFNpZGViYXJTaWRlLFxuICBnZXRDb250YWN0RGlzcGxheU5hbWUsXG4gIGdldE1lc3NhZ2VTZW5kZXJOYW1lLFxufSBmcm9tICcuLi9tb2RlbHMvbWVzc2FnaW5nLm1vZGVscyc7XG5cbkBJbmplY3RhYmxlKHsgcHJvdmlkZWRJbjogJ3Jvb3QnIH0pXG5leHBvcnQgY2xhc3MgTWVzc2FnaW5nU3RvcmVTZXJ2aWNlIGltcGxlbWVudHMgT25EZXN0cm95IHtcbiAgLy8g4pSA4pSAIFN0YXRlIHN1YmplY3RzIOKUgOKUgFxuICBwcml2YXRlIGluYm94JCA9IG5ldyBCZWhhdmlvclN1YmplY3Q8SW5ib3hJdGVtW10+KFtdKTtcbiAgcHJpdmF0ZSBtZXNzYWdlc01hcCQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PE1hcDxzdHJpbmcsIE1lc3NhZ2VbXT4+KG5ldyBNYXAoKSk7XG4gIHByaXZhdGUgb3BlbkNoYXRzJCA9IG5ldyBCZWhhdmlvclN1YmplY3Q8Q2hhdFdpbmRvd1tdPihbXSk7XG4gIHByaXZhdGUgdmlzaWJsZUNvbnRhY3RzJCA9IG5ldyBCZWhhdmlvclN1YmplY3Q8Q29udGFjdFtdPihbXSk7XG4gIHByaXZhdGUgcGFuZWxPcGVuJCA9IG5ldyBCZWhhdmlvclN1YmplY3Q8Ym9vbGVhbj4oZmFsc2UpO1xuICBwcml2YXRlIGFjdGl2ZVZpZXckID0gbmV3IEJlaGF2aW9yU3ViamVjdDwnaW5ib3gnIHwgJ2NoYXQnIHwgJ25ldy1jb252ZXJzYXRpb24nIHwgJ2dyb3VwLW1hbmFnZXInIHwgJ2NvbnZlcnNhdGlvbi1zZXR0aW5ncyc+KCdpbmJveCcpO1xuICBwcml2YXRlIHNpZGViYXJTaWRlJCA9IG5ldyBCZWhhdmlvclN1YmplY3Q8U2lkZWJhclNpZGU+KFxuICAgIChsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnbWVzc2FnaW5nX3NpZGViYXJfc2lkZScpIGFzIFNpZGViYXJTaWRlKSB8fCAncmlnaHQnXG4gICk7XG4gIHByaXZhdGUgYWN0aXZlQ29udmVyc2F0aW9uSWQkID0gbmV3IEJlaGF2aW9yU3ViamVjdDxzdHJpbmcgfCBudWxsPihudWxsKTtcbiAgcHJpdmF0ZSBwZW5kaW5nRG1SZWNpcGllbnQkID0gbmV3IEJlaGF2aW9yU3ViamVjdDx7Y29udGFjdElkOiBzdHJpbmcsIG5hbWU6IHN0cmluZ30gfCBudWxsPihudWxsKTtcbiAgcHJpdmF0ZSB0b3RhbFVucmVhZCQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PG51bWJlcj4oMCk7XG4gIHByaXZhdGUgbG9hZGluZ01lc3NhZ2VzJCA9IG5ldyBCZWhhdmlvclN1YmplY3Q8Ym9vbGVhbj4oZmFsc2UpO1xuICBwcml2YXRlIHBhbmVsUG9zaXRpb24kID0gbmV3IEJlaGF2aW9yU3ViamVjdDx7IHg6IG51bWJlcjsgeTogbnVtYmVyIH0gfCBudWxsPihudWxsKTtcbiAgcHJpdmF0ZSBwYW5lbFNpemUkID0gbmV3IEJlaGF2aW9yU3ViamVjdDx7IHdpZHRoOiBudW1iZXI7IGhlaWdodDogbnVtYmVyIH0+KHsgd2lkdGg6IDM4MCwgaGVpZ2h0OiA1NjAgfSk7XG4gIHByaXZhdGUgd2FzT3BlbkJlZm9yZURyYWckID0gbmV3IEJlaGF2aW9yU3ViamVjdDxib29sZWFuPihmYWxzZSk7XG5cbiAgLy8g4pSA4pSAIFB1YmxpYyBvYnNlcnZhYmxlcyDilIDilIBcbiAgcmVhZG9ubHkgaW5ib3ggPSB0aGlzLmluYm94JC5hc09ic2VydmFibGUoKTtcbiAgcmVhZG9ubHkgbWVzc2FnZXNNYXAgPSB0aGlzLm1lc3NhZ2VzTWFwJC5hc09ic2VydmFibGUoKTtcbiAgcmVhZG9ubHkgb3BlbkNoYXRzID0gdGhpcy5vcGVuQ2hhdHMkLmFzT2JzZXJ2YWJsZSgpO1xuICByZWFkb25seSB2aXNpYmxlQ29udGFjdHMgPSB0aGlzLnZpc2libGVDb250YWN0cyQuYXNPYnNlcnZhYmxlKCk7XG4gIHJlYWRvbmx5IHBhbmVsT3BlbiA9IHRoaXMucGFuZWxPcGVuJC5hc09ic2VydmFibGUoKTtcbiAgcmVhZG9ubHkgYWN0aXZlVmlldyA9IHRoaXMuYWN0aXZlVmlldyQuYXNPYnNlcnZhYmxlKCk7XG4gIHJlYWRvbmx5IGFjdGl2ZUNvbnZlcnNhdGlvbklkID0gdGhpcy5hY3RpdmVDb252ZXJzYXRpb25JZCQuYXNPYnNlcnZhYmxlKCk7XG4gIHJlYWRvbmx5IHRvdGFsVW5yZWFkID0gdGhpcy50b3RhbFVucmVhZCQuYXNPYnNlcnZhYmxlKCk7XG4gIHJlYWRvbmx5IGxvYWRpbmdNZXNzYWdlcyA9IHRoaXMubG9hZGluZ01lc3NhZ2VzJC5hc09ic2VydmFibGUoKTtcbiAgd3NTdGF0dXM6IE9ic2VydmFibGU8c3RyaW5nPiA9IG5ldyBPYnNlcnZhYmxlPHN0cmluZz4oKTtcbiAgcmVhZG9ubHkgcGFuZWxQb3NpdGlvbiA9IHRoaXMucGFuZWxQb3NpdGlvbiQuYXNPYnNlcnZhYmxlKCk7XG4gIHJlYWRvbmx5IHBhbmVsU2l6ZSA9IHRoaXMucGFuZWxTaXplJC5hc09ic2VydmFibGUoKTtcbiAgcmVhZG9ubHkgd2FzT3BlbkJlZm9yZURyYWcgPSB0aGlzLndhc09wZW5CZWZvcmVEcmFnJC5hc09ic2VydmFibGUoKTtcbiAgcmVhZG9ubHkgc2lkZWJhclNpZGUgPSB0aGlzLnNpZGViYXJTaWRlJC5hc09ic2VydmFibGUoKTtcblxuICBwcml2YXRlIHdzU3ViOiBTdWJzY3JpcHRpb24gfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBkZXN0cm95JCA9IG5ldyBTdWJqZWN0PHZvaWQ+KCk7XG4gIHByaXZhdGUgcG9sbFRpbWVyOiBhbnkgPSBudWxsO1xuICBwcml2YXRlIGdyb3VwU2V0dGluZ3MkID0gbmV3IEJlaGF2aW9yU3ViamVjdDx7IGNvbnZlcnNhdGlvbklkOiBzdHJpbmc7IG5hbWU6IHN0cmluZyB9IHwgbnVsbD4obnVsbCk7XG5cbiAgcmVhZG9ubHkgZ3JvdXBTZXR0aW5ncyA9IHRoaXMuZ3JvdXBTZXR0aW5ncyQuYXNPYnNlcnZhYmxlKCk7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSBhdXRoOiBBdXRoU2VydmljZSxcbiAgICBwcml2YXRlIGFwaTogTWVzc2FnaW5nQXBpU2VydmljZSxcbiAgICBwcml2YXRlIHdzU2VydmljZTogTWVzc2FnaW5nV2ViU29ja2V0U2VydmljZVxuICApIHtcbiAgICAodGhpcyBhcyBhbnkpLndzU3RhdHVzID0gdGhpcy53c1NlcnZpY2Uuc3RhdHVzJDtcbiAgfVxuXG4gIC8vIOKUgOKUgCBJbml0aWFsaXphdGlvbiDilIDilIBcbiAgaW5pdGlhbGl6ZSgpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMuYXV0aC5pc0F1dGhlbnRpY2F0ZWQoKSkgcmV0dXJuO1xuXG4gICAgY29uc3QgY29udGFjdElkID0gdGhpcy5hdXRoLmNvbnRhY3RJZCE7XG4gICAgY29uc3Qgc2Vzc2lvbkdpZCA9IHRoaXMuYXV0aC5zZXNzaW9uR2lkITtcblxuICAgIHRoaXMubG9hZEluYm94KCk7XG4gICAgdGhpcy5sb2FkVmlzaWJsZUNvbnRhY3RzKCk7XG5cbiAgICB0aGlzLndzU2VydmljZS5jb25uZWN0KGNvbnRhY3RJZCwgc2Vzc2lvbkdpZCk7XG4gICAgdGhpcy5saXN0ZW5XZWJTb2NrZXQoKTtcbiAgICB0aGlzLnN0YXJ0UG9sbGluZygpO1xuICB9XG5cbiAgdGVhcmRvd24oKTogdm9pZCB7XG4gICAgdGhpcy5zdG9wUG9sbGluZygpO1xuICAgIHRoaXMud3NTZXJ2aWNlLmRpc2Nvbm5lY3QoKTtcbiAgICB0aGlzLndzU3ViPy51bnN1YnNjcmliZSgpO1xuICAgIHRoaXMuaW5ib3gkLm5leHQoW10pO1xuICAgIHRoaXMubWVzc2FnZXNNYXAkLm5leHQobmV3IE1hcCgpKTtcbiAgICB0aGlzLm9wZW5DaGF0cyQubmV4dChbXSk7XG4gICAgdGhpcy5wYW5lbE9wZW4kLm5leHQoZmFsc2UpO1xuICAgIHRoaXMuYWN0aXZlVmlldyQubmV4dCgnaW5ib3gnKTtcbiAgICB0aGlzLmFjdGl2ZUNvbnZlcnNhdGlvbklkJC5uZXh0KG51bGwpO1xuICAgIHRoaXMudG90YWxVbnJlYWQkLm5leHQoMCk7XG4gIH1cblxuICAvLyDilIDilIAgUG9sbGluZyBmYWxsYmFjayAoaW5ib3ggb25seSAtIG1lc3NhZ2VzIHJlbHkgb24gV2ViU29ja2V0KSDilIDilIBcbiAgcHJpdmF0ZSBzdGFydFBvbGxpbmcoKTogdm9pZCB7XG4gICAgdGhpcy5zdG9wUG9sbGluZygpO1xuICAgIHRoaXMucG9sbFRpbWVyID0gc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgdGhpcy5sb2FkSW5ib3goKTtcbiAgICB9LCAzMDAwMCk7XG4gIH1cblxuICBwcml2YXRlIHN0b3BQb2xsaW5nKCk6IHZvaWQge1xuICAgIGlmICh0aGlzLnBvbGxUaW1lcikge1xuICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLnBvbGxUaW1lcik7XG4gICAgICB0aGlzLnBvbGxUaW1lciA9IG51bGw7XG4gICAgfVxuICB9XG5cbiAgbmdPbkRlc3Ryb3koKTogdm9pZCB7XG4gICAgdGhpcy50ZWFyZG93bigpO1xuICAgIHRoaXMuZGVzdHJveSQubmV4dCgpO1xuICAgIHRoaXMuZGVzdHJveSQuY29tcGxldGUoKTtcbiAgfVxuXG4gIC8vIOKUgOKUgCBQYW5lbCBjb250cm9scyDilIDilIBcbiAgdG9nZ2xlUGFuZWwoYnV0dG9uWD86IG51bWJlciwgYnV0dG9uWT86IG51bWJlcik6IHZvaWQge1xuICAgIGlmIChidXR0b25YICE9PSB1bmRlZmluZWQgJiYgYnV0dG9uWSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aGlzLnBhbmVsUG9zaXRpb24kLm5leHQoeyB4OiBidXR0b25YLCB5OiBidXR0b25ZIH0pO1xuICAgIH1cbiAgICB0aGlzLnBhbmVsT3BlbiQubmV4dCghdGhpcy5wYW5lbE9wZW4kLnZhbHVlKTtcbiAgfVxuXG4gIG9wZW5QYW5lbChidXR0b25YPzogbnVtYmVyLCBidXR0b25ZPzogbnVtYmVyKTogdm9pZCB7XG4gICAgaWYgKGJ1dHRvblggIT09IHVuZGVmaW5lZCAmJiBidXR0b25ZICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHRoaXMucGFuZWxQb3NpdGlvbiQubmV4dCh7IHg6IGJ1dHRvblgsIHk6IGJ1dHRvblkgfSk7XG4gICAgfVxuICAgIHRoaXMucGFuZWxPcGVuJC5uZXh0KHRydWUpO1xuICB9XG5cbiAgY2xvc2VQYW5lbCgpOiB2b2lkIHtcbiAgICB0aGlzLnBhbmVsT3BlbiQubmV4dChmYWxzZSk7XG4gIH1cblxuICBzZXRQYW5lbFNpemUod2lkdGg6IG51bWJlciwgaGVpZ2h0OiBudW1iZXIpOiB2b2lkIHtcbiAgICB0aGlzLnBhbmVsU2l6ZSQubmV4dCh7IHdpZHRoLCBoZWlnaHQgfSk7XG4gICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ21lc3NhZ2luZ19wYW5lbF9zaXplJywgSlNPTi5zdHJpbmdpZnkoeyB3aWR0aCwgaGVpZ2h0IH0pKTtcbiAgfVxuXG4gIGdldFBhbmVsU2l6ZSgpOiB7IHdpZHRoOiBudW1iZXI7IGhlaWdodDogbnVtYmVyIH0ge1xuICAgIGNvbnN0IHNhdmVkID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ21lc3NhZ2luZ19wYW5lbF9zaXplJyk7XG4gICAgaWYgKHNhdmVkKSB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBwYXJzZWQgPSBKU09OLnBhcnNlKHNhdmVkKTtcbiAgICAgICAgaWYgKHBhcnNlZC53aWR0aCAmJiBwYXJzZWQuaGVpZ2h0KSB7XG4gICAgICAgICAgdGhpcy5wYW5lbFNpemUkLm5leHQocGFyc2VkKTtcbiAgICAgICAgICByZXR1cm4gcGFyc2VkO1xuICAgICAgICB9XG4gICAgICB9IGNhdGNoIHt9XG4gICAgfVxuICAgIHJldHVybiB0aGlzLnBhbmVsU2l6ZSQudmFsdWU7XG4gIH1cblxuICBvbkJ1dHRvbkRyYWdTdGFydCgpOiB2b2lkIHtcbiAgICB0aGlzLndhc09wZW5CZWZvcmVEcmFnJC5uZXh0KHRoaXMucGFuZWxPcGVuJC52YWx1ZSk7XG4gICAgaWYgKHRoaXMucGFuZWxPcGVuJC52YWx1ZSkge1xuICAgICAgdGhpcy5wYW5lbE9wZW4kLm5leHQoZmFsc2UpO1xuICAgIH1cbiAgfVxuXG4gIG9uQnV0dG9uRHJhZ0VuZChidXR0b25YOiBudW1iZXIsIGJ1dHRvblk6IG51bWJlcik6IHZvaWQge1xuICAgIGlmICh0aGlzLndhc09wZW5CZWZvcmVEcmFnJC52YWx1ZSkge1xuICAgICAgdGhpcy5vcGVuUGFuZWwoYnV0dG9uWCwgYnV0dG9uWSk7XG4gICAgfVxuICB9XG5cbiAgc2V0Vmlldyh2aWV3OiAnaW5ib3gnIHwgJ2NoYXQnIHwgJ25ldy1jb252ZXJzYXRpb24nIHwgJ2dyb3VwLW1hbmFnZXInIHwgJ2NvbnZlcnNhdGlvbi1zZXR0aW5ncycpOiB2b2lkIHtcbiAgICB0aGlzLmFjdGl2ZVZpZXckLm5leHQodmlldyk7XG4gIH1cblxuICB0b2dnbGVTaWRlYmFyU2lkZSgpOiB2b2lkIHtcbiAgICBjb25zdCBuZXh0ID0gdGhpcy5zaWRlYmFyU2lkZSQudmFsdWUgPT09ICdyaWdodCcgPyAnbGVmdCcgOiAncmlnaHQnO1xuICAgIHRoaXMuc2lkZWJhclNpZGUkLm5leHQobmV4dCk7XG4gICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ21lc3NhZ2luZ19zaWRlYmFyX3NpZGUnLCBuZXh0KTtcbiAgfVxuXG4gIGdldFNpZGViYXJTaWRlKCk6IFNpZGViYXJTaWRlIHtcbiAgICByZXR1cm4gdGhpcy5zaWRlYmFyU2lkZSQudmFsdWU7XG4gIH1cblxuICAvLyDilIDilIAgSW5ib3gg4pSA4pSAXG4gIGxvYWRJbmJveCgpOiB2b2lkIHtcbiAgICBjb25zdCBjb250YWN0SWQgPSB0aGlzLmF1dGguY29udGFjdElkO1xuICAgIGlmICghY29udGFjdElkKSByZXR1cm47XG5cbiAgICB0aGlzLmFwaS5nZXRJbmJveChjb250YWN0SWQpLnN1YnNjcmliZSh7XG4gICAgICBuZXh0OiAoaXRlbXMpID0+IHtcbiAgICAgICAgY29uc3QgbWFwcGVkID0gaXRlbXMubWFwKGl0ZW0gPT4ge1xuICAgICAgICAgIGNvbnN0IGlzR3JvdXAgPSBpdGVtLmlzX2dyb3VwID09PSB0cnVlIHx8IChpdGVtLmlzX2dyb3VwIGFzIGFueSkgPT09ICdUcnVlJztcbiAgICAgICAgICBcbiAgICAgICAgICBpZiAoIWlzR3JvdXAgJiYgIWl0ZW0ubmFtZSAmJiBpdGVtLm90aGVyX3BhcnRpY2lwYW50X25hbWUpIHtcbiAgICAgICAgICAgIHJldHVybiB7IC4uLml0ZW0sIG5hbWU6IGl0ZW0ub3RoZXJfcGFydGljaXBhbnRfbmFtZSwgaXNfZ3JvdXA6IGZhbHNlIH07XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiB7IC4uLml0ZW0sIGlzX2dyb3VwOiBpc0dyb3VwIH07XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLmluYm94JC5uZXh0KG1hcHBlZCk7XG4gICAgICAgIHRoaXMucmVjYWxjVW5yZWFkKG1hcHBlZCk7XG5cbiAgICAgICAgY29uc3QgaWRzID0gbWFwcGVkLm1hcCgoaSkgPT4gaS5jb252ZXJzYXRpb25faWQpO1xuICAgICAgICB0aGlzLndzU2VydmljZS5zdWJzY3JpYmVBbGwoaWRzKTtcbiAgICAgIH0sXG4gICAgICBlcnJvcjogKCkgPT4ge30sXG4gICAgfSk7XG4gIH1cblxuICAvLyDilIDilIAgQ29udGFjdHMg4pSA4pSAXG4gIGxvYWRWaXNpYmxlQ29udGFjdHMoKTogdm9pZCB7XG4gICAgY29uc3QgY29udGFjdElkID0gdGhpcy5hdXRoLmNvbnRhY3RJZDtcbiAgICBpZiAoIWNvbnRhY3RJZCkgcmV0dXJuO1xuXG4gICAgdGhpcy5hcGkuZ2V0VmlzaWJsZUNvbnRhY3RzKGNvbnRhY3RJZCkuc3Vic2NyaWJlKHtcbiAgICAgIG5leHQ6IChjb250YWN0cykgPT4ge1xuICAgICAgICB0aGlzLnZpc2libGVDb250YWN0cyQubmV4dChjb250YWN0cyk7XG4gICAgICAgIFxuICAgICAgICBjb25zdCBjdXJyZW50Q29udGFjdCA9IHRoaXMuYXV0aC5jdXJyZW50Q29udGFjdDtcbiAgICAgICAgaWYgKGN1cnJlbnRDb250YWN0ICYmIGN1cnJlbnRDb250YWN0LmVtYWlsKSB7XG4gICAgICAgICAgY29uc3QgbWF0Y2ggPSBjb250YWN0cy5maW5kKGMgPT4gYy5lbWFpbCA9PT0gY3VycmVudENvbnRhY3QuZW1haWwpO1xuICAgICAgICAgIGlmIChcbiAgICAgICAgICAgIG1hdGNoICYmXG4gICAgICAgICAgICBTdHJpbmcobWF0Y2guY29udGFjdF9pZCkgIT09IFN0cmluZyhjdXJyZW50Q29udGFjdC5jb250YWN0X2lkKVxuICAgICAgICAgICkge1xuICAgICAgICAgICAgdGhpcy5hdXRoLnNldFNlc3Npb24odGhpcy5hdXRoLnNlc3Npb25HaWQhLCB7IC4uLmN1cnJlbnRDb250YWN0LCBjb250YWN0X2lkOiBtYXRjaC5jb250YWN0X2lkIH0pO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICB0aGlzLndzU2VydmljZS5kaXNjb25uZWN0KCk7XG4gICAgICAgICAgICB0aGlzLndzU2VydmljZS5jb25uZWN0KG1hdGNoLmNvbnRhY3RfaWQsIHRoaXMuYXV0aC5zZXNzaW9uR2lkISk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgZXJyb3I6ICgpID0+IHt9LFxuICAgIH0pO1xuICB9XG5cbiAgLy8g4pSA4pSAIENvbnZlcnNhdGlvbnMg4pSA4pSAXG4gIG9wZW5Db252ZXJzYXRpb24oY29udmVyc2F0aW9uSWQ6IHN0cmluZywgbmFtZTogc3RyaW5nLCBpc0dyb3VwID0gZmFsc2UpOiB2b2lkIHtcbiAgICBpZiAoIWNvbnZlcnNhdGlvbklkIHx8IGNvbnZlcnNhdGlvbklkID09PSAndW5kZWZpbmVkJykge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB0aGlzLmFjdGl2ZUNvbnZlcnNhdGlvbklkJC5uZXh0KGNvbnZlcnNhdGlvbklkKTtcbiAgICB0aGlzLmFjdGl2ZVZpZXckLm5leHQoJ2NoYXQnKTtcbiAgICB0aGlzLm9wZW5QYW5lbCgpO1xuXG4gICAgY29uc3QgY2hhdHMgPSB0aGlzLm9wZW5DaGF0cyQudmFsdWU7XG4gICAgaWYgKCFjaGF0cy5maW5kKChjKSA9PiBjLmNvbnZlcnNhdGlvbklkID09PSBjb252ZXJzYXRpb25JZCkpIHtcbiAgICAgIHRoaXMub3BlbkNoYXRzJC5uZXh0KFtcbiAgICAgICAgLi4uY2hhdHMsXG4gICAgICAgIHsgY29udmVyc2F0aW9uSWQsIG5hbWUsIGlzR3JvdXAsIGlzTWluaW1pemVkOiBmYWxzZSwgdW5yZWFkQ291bnQ6IDAgfSxcbiAgICAgIF0pO1xuICAgIH1cblxuICAgIGNvbnN0IGV4aXN0aW5nID0gdGhpcy5tZXNzYWdlc01hcCQudmFsdWUuZ2V0KGNvbnZlcnNhdGlvbklkKTtcbiAgICBpZiAoZXhpc3RpbmcgJiYgZXhpc3RpbmcubGVuZ3RoID4gMCkge1xuICAgICAgLy8gQWxyZWFkeSBjYWNoZWQg4oCUIHNpbGVudCBiYWNrZ3JvdW5kIHJlZnJlc2ggZm9yIG5ldyBtZXNzYWdlcywgc2tpcCByZWFjdGlvbiBoeWRyYXRpb25cbiAgICAgIHRoaXMubG9hZE1lc3NhZ2VzKGNvbnZlcnNhdGlvbklkLCB1bmRlZmluZWQsIHRydWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmxvYWRNZXNzYWdlcyhjb252ZXJzYXRpb25JZCk7XG4gICAgfVxuICAgIHRoaXMubWFya0FzUmVhZChjb252ZXJzYXRpb25JZCk7XG4gICAgdGhpcy53c1NlcnZpY2Uuc3Vic2NyaWJlKGNvbnZlcnNhdGlvbklkKTtcbiAgfVxuXG4gIGNsb3NlQ2hhdChjb252ZXJzYXRpb25JZDogc3RyaW5nKTogdm9pZCB7XG4gICAgY29uc3QgY2hhdHMgPSB0aGlzLm9wZW5DaGF0cyQudmFsdWUuZmlsdGVyKChjKSA9PiBjLmNvbnZlcnNhdGlvbklkICE9PSBjb252ZXJzYXRpb25JZCk7XG4gICAgdGhpcy5vcGVuQ2hhdHMkLm5leHQoY2hhdHMpO1xuXG4gICAgaWYgKHRoaXMuYWN0aXZlQ29udmVyc2F0aW9uSWQkLnZhbHVlID09PSBjb252ZXJzYXRpb25JZCkge1xuICAgICAgdGhpcy5hY3RpdmVDb252ZXJzYXRpb25JZCQubmV4dChudWxsKTtcbiAgICAgIHRoaXMuYWN0aXZlVmlldyQubmV4dCgnaW5ib3gnKTtcbiAgICB9XG4gIH1cblxuICAvLyDilIDilIAgTWVzc2FnZXMg4pSA4pSAXG4gIGxvYWRNZXNzYWdlcyhjb252ZXJzYXRpb25JZDogc3RyaW5nLCBiZWZvcmVNZXNzYWdlSWQ/OiBzdHJpbmcsIHNraXBSZWFjdGlvbkh5ZHJhdGlvbiA9IGZhbHNlKTogdm9pZCB7XG4gICAgaWYgKCFjb252ZXJzYXRpb25JZCB8fCBjb252ZXJzYXRpb25JZCA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3QgY29udGFjdElkID0gdGhpcy5hdXRoLmNvbnRhY3RJZDtcbiAgICBpZiAoIWNvbnRhY3RJZCkgcmV0dXJuO1xuXG4gICAgdGhpcy5sb2FkaW5nTWVzc2FnZXMkLm5leHQodHJ1ZSk7XG5cbiAgICB0aGlzLmFwaS5nZXRNZXNzYWdlcyhjb252ZXJzYXRpb25JZCwgY29udGFjdElkLCBiZWZvcmVNZXNzYWdlSWQsIDUwKS5zdWJzY3JpYmUoe1xuICAgICAgbmV4dDogKG1lc3NhZ2VzKSA9PiB7XG4gICAgICAgIGNvbnN0IG1hcCA9IG5ldyBNYXAodGhpcy5tZXNzYWdlc01hcCQudmFsdWUpO1xuICAgICAgICBjb25zdCBleGlzdGluZyA9IG1hcC5nZXQoY29udmVyc2F0aW9uSWQpIHx8IFtdO1xuXG4gICAgICAgIGNvbnN0IG5vcm1hbGl6ZWQgPSBtZXNzYWdlcy5tYXAoKG06IGFueSkgPT4gdGhpcy5ub3JtYWxpemVNZXNzYWdlU2hhcGUobSkpO1xuICAgICAgICBjb25zdCBzb3J0ZWQgPSBbLi4ubm9ybWFsaXplZF0uc29ydCgoYSwgYikgPT4gXG4gICAgICAgICAgbmV3IERhdGUoYS5jcmVhdGVkX2F0KS5nZXRUaW1lKCkgLSBuZXcgRGF0ZShiLmNyZWF0ZWRfYXQpLmdldFRpbWUoKVxuICAgICAgICApO1xuXG4gICAgICAgIGlmIChiZWZvcmVNZXNzYWdlSWQpIHtcbiAgICAgICAgICAvLyBQcmVwZW5kIG9sZGVyIG1lc3NhZ2VzLCBwcmVzZXJ2aW5nIGV4aXN0aW5nIHJlYWN0aW9uc1xuICAgICAgICAgIGNvbnN0IG1lcmdlZCA9IFsuLi5zb3J0ZWQsIC4uLmV4aXN0aW5nXTtcbiAgICAgICAgICBtYXAuc2V0KGNvbnZlcnNhdGlvbklkLCBtZXJnZWQpO1xuICAgICAgICB9IGVsc2UgaWYgKHNraXBSZWFjdGlvbkh5ZHJhdGlvbikge1xuICAgICAgICAgIC8vIFNpbGVudCByZWZyZXNoIOKAlCBtZXJnZSBuZXcgbWVzc2FnZXMgYnV0IHByZXNlcnZlIGV4aXN0aW5nIHJlYWN0aW9uIHN0YXRlXG4gICAgICAgICAgY29uc3QgZXhpc3RpbmdCeUlkID0gbmV3IE1hcChleGlzdGluZy5tYXAobSA9PiBbU3RyaW5nKG0ubWVzc2FnZV9pZCksIG1dKSk7XG4gICAgICAgICAgY29uc3QgbWVyZ2VkID0gc29ydGVkLm1hcChtID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGNhY2hlZCA9IGV4aXN0aW5nQnlJZC5nZXQoU3RyaW5nKG0ubWVzc2FnZV9pZCkpO1xuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZCA/IHsgLi4ubSwgcmVhY3Rpb25zOiBjYWNoZWQucmVhY3Rpb25zIH0gOiBtO1xuICAgICAgICAgIH0pO1xuICAgICAgICAgIG1hcC5zZXQoY29udmVyc2F0aW9uSWQsIG1lcmdlZCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbWFwLnNldChjb252ZXJzYXRpb25JZCwgc29ydGVkKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMubWVzc2FnZXNNYXAkLm5leHQobWFwKTtcbiAgICAgICAgaWYgKCFza2lwUmVhY3Rpb25IeWRyYXRpb24pIHtcbiAgICAgICAgICB0aGlzLmh5ZHJhdGVSZWFjdGlvbnNGb3JDb252ZXJzYXRpb24oY29udmVyc2F0aW9uSWQsIG1hcC5nZXQoY29udmVyc2F0aW9uSWQpIHx8IFtdKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmxvYWRpbmdNZXNzYWdlcyQubmV4dChmYWxzZSk7XG4gICAgICB9LFxuICAgICAgZXJyb3I6ICgpID0+IHtcbiAgICAgICAgdGhpcy5sb2FkaW5nTWVzc2FnZXMkLm5leHQoZmFsc2UpO1xuICAgICAgfSxcbiAgICB9KTtcbiAgfVxuXG4gIHNlbmRNZXNzYWdlKGNvbnZlcnNhdGlvbklkOiBzdHJpbmcgfCBudWxsLCBjb250ZW50OiBzdHJpbmcsIG1lc3NhZ2VUeXBlOiAnVEVYVCcgfCAnSU1BR0UnID0gJ1RFWFQnKTogdm9pZCB7XG4gICAgY29uc3QgY29udGFjdElkID0gdGhpcy5hdXRoLmNvbnRhY3RJZDtcbiAgICBpZiAoIWNvbnRhY3RJZCkgcmV0dXJuO1xuXG4gICAgY29uc3QgcGVuZGluZyA9IHRoaXMucGVuZGluZ0RtUmVjaXBpZW50JC52YWx1ZTtcbiAgICBpZiAoIWNvbnZlcnNhdGlvbklkICYmIHBlbmRpbmcpIHtcbiAgICAgIHRoaXMuc2VuZERpcmVjdE1lc3NhZ2UocGVuZGluZy5jb250YWN0SWQsIGNvbnRlbnQpO1xuICAgICAgdGhpcy5wZW5kaW5nRG1SZWNpcGllbnQkLm5leHQobnVsbCk7XG4gICAgICBjb25zdCBjaGF0cyA9IHRoaXMub3BlbkNoYXRzJC52YWx1ZS5maWx0ZXIoYyA9PiBjLmNvbnZlcnNhdGlvbklkICE9PSAncGVuZGluZycpO1xuICAgICAgdGhpcy5vcGVuQ2hhdHMkLm5leHQoY2hhdHMpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmICghY29udmVyc2F0aW9uSWQpIHJldHVybjtcblxuICAgIGNvbnN0IHRlbXBNZXNzYWdlSWQgPSAndGVtcC0nICsgRGF0ZS5ub3coKTtcbiAgICBjb25zdCBvcHRpbWlzdGljOiBNZXNzYWdlID0ge1xuICAgICAgbWVzc2FnZV9pZDogdGVtcE1lc3NhZ2VJZCxcbiAgICAgIGNvbnZlcnNhdGlvbl9pZDogY29udmVyc2F0aW9uSWQsXG4gICAgICBzZW5kZXJfaWQ6IGNvbnRhY3RJZCxcbiAgICAgIHNlbmRlcl9uYW1lOiAnWW91JyxcbiAgICAgIG1lc3NhZ2VfdHlwZTogbWVzc2FnZVR5cGUsXG4gICAgICBjb250ZW50LFxuICAgICAgY3JlYXRlZF9hdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgaXNfcmVhZDogdHJ1ZSxcbiAgICB9O1xuICAgIHRoaXMuYXBwZW5kTWVzc2FnZShvcHRpbWlzdGljKTtcblxuICAgIHRoaXMuYXBpLnNlbmRNZXNzYWdlKGNvbnZlcnNhdGlvbklkLCBjb250YWN0SWQsIGNvbnRlbnQsIG1lc3NhZ2VUeXBlKS5zdWJzY3JpYmUoe1xuICAgICAgbmV4dDogKHJlcykgPT4ge1xuICAgICAgICBjb25zdCByZWFsSWQgPSByZXM/Lm1lc3NhZ2VfaWQgPz8gcmVzPy5pZCA/PyByZXM/Lm1lc3NhZ2VJZDtcbiAgICAgICAgaWYgKHJlYWxJZCA9PSBudWxsIHx8IFN0cmluZyhyZWFsSWQpLnN0YXJ0c1dpdGgoJ3RlbXAtJykpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgcGlja2VkQ29udGVudCA9IHRoaXMuY29hbGVzY2VNZXNzYWdlVGV4dChyZXMsIG9wdGltaXN0aWMuY29udGVudCk7XG4gICAgICAgIGNvbnN0IG1lcmdlZCA9IHRoaXMubm9ybWFsaXplTWVzc2FnZVNoYXBlKHtcbiAgICAgICAgICAuLi5vcHRpbWlzdGljLFxuICAgICAgICAgIC4uLnJlcyxcbiAgICAgICAgICBtZXNzYWdlX2lkOiBTdHJpbmcocmVhbElkKSxcbiAgICAgICAgICBjb252ZXJzYXRpb25faWQ6IGNvbnZlcnNhdGlvbklkLFxuICAgICAgICAgIGNvbnRlbnQ6IHBpY2tlZENvbnRlbnQsXG4gICAgICAgIH0pO1xuICAgICAgICBjb25zdCBtYXAgPSBuZXcgTWFwKHRoaXMubWVzc2FnZXNNYXAkLnZhbHVlKTtcbiAgICAgICAgY29uc3QgbXNncyA9IFsuLi4obWFwLmdldChjb252ZXJzYXRpb25JZCkgfHwgW10pXTtcbiAgICAgICAgY29uc3QgaWR4ID0gbXNncy5maW5kSW5kZXgoKG0pID0+IG0ubWVzc2FnZV9pZCA9PT0gdGVtcE1lc3NhZ2VJZCk7XG4gICAgICAgIGlmIChpZHggPj0gMCkge1xuICAgICAgICAgIG1zZ3NbaWR4XSA9IG1lcmdlZDtcbiAgICAgICAgICBtYXAuc2V0KGNvbnZlcnNhdGlvbklkLCB0aGlzLmRlZHVwZU1lc3NhZ2VzQnlJZEtlZXBGaXJzdChtc2dzKSk7XG4gICAgICAgICAgdGhpcy5tZXNzYWdlc01hcCQubmV4dChtYXApO1xuICAgICAgICAgIHRoaXMucmVmcmVzaE1lc3NhZ2VSZWFjdGlvbnMobWVyZ2VkLm1lc3NhZ2VfaWQpO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgZXJyb3I6ICgpID0+IHt9LFxuICAgIH0pO1xuICB9XG5cbiAgb3BlbkRpcmVjdENvbnZlcnNhdGlvbihyZWNpcGllbnRDb250YWN0SWQ6IHN0cmluZywgZGlzcGxheU5hbWU6IHN0cmluZyk6IHZvaWQge1xuICAgIGNvbnN0IGV4aXN0aW5nID0gdGhpcy5pbmJveCQudmFsdWUuZmluZChpdGVtID0+IFxuICAgICAgIWl0ZW0uaXNfZ3JvdXAgJiYgaXRlbS5uYW1lID09PSBkaXNwbGF5TmFtZVxuICAgICk7XG4gICAgXG4gICAgaWYgKGV4aXN0aW5nKSB7XG4gICAgICB0aGlzLnBlbmRpbmdEbVJlY2lwaWVudCQubmV4dChudWxsKTtcbiAgICAgIHRoaXMub3BlbkNvbnZlcnNhdGlvbihleGlzdGluZy5jb252ZXJzYXRpb25faWQsIGRpc3BsYXlOYW1lLCBmYWxzZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMucGVuZGluZ0RtUmVjaXBpZW50JC5uZXh0KHtjb250YWN0SWQ6IHJlY2lwaWVudENvbnRhY3RJZCwgbmFtZTogZGlzcGxheU5hbWV9KTtcbiAgICAgIHRoaXMuYWN0aXZlQ29udmVyc2F0aW9uSWQkLm5leHQobnVsbCk7XG4gICAgICB0aGlzLmFjdGl2ZVZpZXckLm5leHQoJ2NoYXQnKTtcbiAgICAgIHRoaXMub3BlblBhbmVsKCk7XG4gICAgICBcbiAgICAgIGNvbnN0IGNoYXRzID0gdGhpcy5vcGVuQ2hhdHMkLnZhbHVlO1xuICAgICAgaWYgKCFjaGF0cy5maW5kKGMgPT4gYy5jb252ZXJzYXRpb25JZCA9PT0gJ3BlbmRpbmcnKSkge1xuICAgICAgICB0aGlzLm9wZW5DaGF0cyQubmV4dChbLi4uY2hhdHMsIHtcbiAgICAgICAgICBjb252ZXJzYXRpb25JZDogJ3BlbmRpbmcnLFxuICAgICAgICAgIG5hbWU6IGRpc3BsYXlOYW1lLFxuICAgICAgICAgIGlzR3JvdXA6IGZhbHNlLFxuICAgICAgICAgIGlzTWluaW1pemVkOiBmYWxzZSxcbiAgICAgICAgICB1bnJlYWRDb3VudDogMFxuICAgICAgICB9XSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgc2VuZERpcmVjdE1lc3NhZ2UocmVjaXBpZW50Q29udGFjdElkOiBzdHJpbmcsIGNvbnRlbnQ6IHN0cmluZyk6IHZvaWQge1xuICAgIGNvbnN0IGNvbnRhY3RJZCA9IHRoaXMuYXV0aC5jb250YWN0SWQ7XG4gICAgaWYgKCFjb250YWN0SWQpIHJldHVybjtcblxuICAgIHRoaXMuYXBpLnNlbmREaXJlY3RNZXNzYWdlKGNvbnRhY3RJZCwgcmVjaXBpZW50Q29udGFjdElkLCBjb250ZW50KS5zdWJzY3JpYmUoe1xuICAgICAgbmV4dDogKHJlcykgPT4ge1xuICAgICAgICB0aGlzLmxvYWRJbmJveCgpO1xuICAgICAgICAvLyBCYWNrZW5kIG1heSByZXR1cm4gY29udmVyc2F0aW9uX2lkLCBpZCwgb3IgY29udmVyc2F0aW9uSWRcbiAgICAgICAgY29uc3QgY29udklkID0gU3RyaW5nKHJlcz8uY29udmVyc2F0aW9uX2lkIHx8IHJlcz8uaWQgfHwgcmVzPy5jb252ZXJzYXRpb25JZCB8fCAnJyk7XG4gICAgICAgIGlmIChjb252SWQpIHtcbiAgICAgICAgICBjb25zdCByZWNpcGllbnQgPSB0aGlzLnZpc2libGVDb250YWN0cyQudmFsdWUuZmluZChcbiAgICAgICAgICAgIChjKSA9PiBjLmNvbnRhY3RfaWQgPT09IHJlY2lwaWVudENvbnRhY3RJZFxuICAgICAgICAgICk7XG4gICAgICAgICAgY29uc3QgbmFtZSA9IHJlY2lwaWVudCA/IGdldENvbnRhY3REaXNwbGF5TmFtZShyZWNpcGllbnQpIDogJ0RpcmVjdCBNZXNzYWdlJztcbiAgICAgICAgICB0aGlzLm9wZW5Db252ZXJzYXRpb24oY29udklkLCBuYW1lLCBmYWxzZSk7XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBlcnJvcjogKCkgPT4ge30sXG4gICAgfSk7XG4gIH1cblxuICBjcmVhdGVHcm91cENvbnZlcnNhdGlvbihwYXJ0aWNpcGFudElkczogc3RyaW5nW10sIG5hbWU6IHN0cmluZyk6IHZvaWQge1xuICAgIGNvbnN0IGNvbnRhY3RJZCA9IHRoaXMuYXV0aC5jb250YWN0SWQ7XG4gICAgaWYgKCFjb250YWN0SWQpIHJldHVybjtcblxuICAgIGNvbnN0IGFsbFBhcnRpY2lwYW50cyA9IHBhcnRpY2lwYW50SWRzLmluY2x1ZGVzKGNvbnRhY3RJZClcbiAgICAgID8gcGFydGljaXBhbnRJZHNcbiAgICAgIDogW2NvbnRhY3RJZCwgLi4ucGFydGljaXBhbnRJZHNdO1xuXG4gICAgdGhpcy5hcGkuY3JlYXRlQ29udmVyc2F0aW9uKGNvbnRhY3RJZCwgYWxsUGFydGljaXBhbnRzLCBuYW1lKS5zdWJzY3JpYmUoe1xuICAgICAgbmV4dDogKGNvbnYpID0+IHtcbiAgICAgICAgLy8gQmFja2VuZCBtYXkgcmV0dXJuIGNvbnZlcnNhdGlvbl9pZCwgaWQsIG9yIGNvbnZlcnNhdGlvbklkXG4gICAgICAgIGNvbnN0IGNvbnZJZCA9IFN0cmluZygoY29udiBhcyBhbnkpPy5jb252ZXJzYXRpb25faWQgfHwgKGNvbnYgYXMgYW55KT8uaWQgfHwgKGNvbnYgYXMgYW55KT8uY29udmVyc2F0aW9uSWQgfHwgJycpO1xuICAgICAgICBpZiAoIWNvbnZJZCkge1xuICAgICAgICAgIHRoaXMubG9hZEluYm94KCk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMubG9hZEluYm94KCk7XG4gICAgICAgIHRoaXMub3BlbkNvbnZlcnNhdGlvbihjb252SWQsIG5hbWUsIHRydWUpO1xuICAgICAgfSxcbiAgICAgIGVycm9yOiAoKSA9PiB7fSxcbiAgICB9KTtcbiAgfVxuXG4gIG9wZW5Hcm91cFNldHRpbmdzKGNvbnZlcnNhdGlvbklkOiBzdHJpbmcsIG5hbWU6IHN0cmluZyk6IHZvaWQge1xuICAgIHRoaXMuZ3JvdXBTZXR0aW5ncyQubmV4dCh7IGNvbnZlcnNhdGlvbklkLCBuYW1lIH0pO1xuICAgIHRoaXMuc2V0VmlldygnZ3JvdXAtbWFuYWdlcicpO1xuICB9XG5cbiAgY2xlYXJHcm91cFNldHRpbmdzKCk6IHZvaWQge1xuICAgIHRoaXMuZ3JvdXBTZXR0aW5ncyQubmV4dChudWxsKTtcbiAgfVxuXG4gIG1hcmtBc1JlYWQoY29udmVyc2F0aW9uSWQ6IHN0cmluZyk6IHZvaWQge1xuICAgIGlmICghY29udmVyc2F0aW9uSWQgfHwgY29udmVyc2F0aW9uSWQgPT09ICd1bmRlZmluZWQnKSByZXR1cm47XG4gICAgY29uc3QgY29udGFjdElkID0gdGhpcy5hdXRoLmNvbnRhY3RJZDtcbiAgICBpZiAoIWNvbnRhY3RJZCkgcmV0dXJuO1xuXG4gICAgdGhpcy5hcGkubWFya0NvbnZlcnNhdGlvblJlYWQoY29udmVyc2F0aW9uSWQsIGNvbnRhY3RJZCkuc3Vic2NyaWJlKHtcbiAgICAgIG5leHQ6ICgpID0+IHtcbiAgICAgICAgY29uc3QgaXRlbXMgPSB0aGlzLmluYm94JC52YWx1ZS5tYXAoKGl0ZW0pID0+XG4gICAgICAgICAgaXRlbS5jb252ZXJzYXRpb25faWQgPT09IGNvbnZlcnNhdGlvbklkID8geyAuLi5pdGVtLCB1bnJlYWRfY291bnQ6IDAgfSA6IGl0ZW1cbiAgICAgICAgKTtcbiAgICAgICAgdGhpcy5pbmJveCQubmV4dChpdGVtcyk7XG4gICAgICAgIHRoaXMucmVjYWxjVW5yZWFkKGl0ZW1zKTtcbiAgICAgIH0sXG4gICAgICBlcnJvcjogKCkgPT4ge30sXG4gICAgfSk7XG4gIH1cblxuICAvLyDilIDilIAgR3JvdXAgbWFuYWdlbWVudCDilIDilIBcbiAgbWFuYWdlR3JvdXAoXG4gICAgYWN0aW9uOiAnY3JlYXRlJyB8ICdhZGQnIHwgJ3JlbW92ZScgfCAncmVuYW1lJyxcbiAgICBjb252ZXJzYXRpb25JZD86IHN0cmluZyxcbiAgICBncm91cE5hbWU/OiBzdHJpbmcsXG4gICAgcGFydGljaXBhbnRDb250YWN0SWRzPzogc3RyaW5nW11cbiAgKTogdm9pZCB7XG4gICAgY29uc3QgY29udGFjdElkID0gdGhpcy5hdXRoLmNvbnRhY3RJZDtcbiAgICBpZiAoIWNvbnRhY3RJZCkgcmV0dXJuO1xuXG4gICAgdGhpcy5hcGkubWFuYWdlR3JvdXAoY29udGFjdElkLCBhY3Rpb24sIGNvbnZlcnNhdGlvbklkLCBncm91cE5hbWUsIHBhcnRpY2lwYW50Q29udGFjdElkcykuc3Vic2NyaWJlKHtcbiAgICAgIG5leHQ6ICgpID0+IHRoaXMubG9hZEluYm94KCksXG4gICAgICBlcnJvcjogKCkgPT4ge30sXG4gICAgfSk7XG4gIH1cblxuICAvLyDilIDilIAgRGVsZXRlIC8gQ2xlYXIg4pSA4pSAXG4gIGRlbGV0ZUNvbnZlcnNhdGlvbihjb252ZXJzYXRpb25JZDogc3RyaW5nKTogdm9pZCB7XG4gICAgY29uc3QgY29udGFjdElkID0gdGhpcy5hdXRoLmNvbnRhY3RJZDtcbiAgICBpZiAoIWNvbnRhY3RJZCkgcmV0dXJuO1xuXG4gICAgdGhpcy5hcGkuZGVsZXRlQ29udmVyc2F0aW9uKGNvbnZlcnNhdGlvbklkLCBjb250YWN0SWQpLnN1YnNjcmliZSh7XG4gICAgICBuZXh0OiAoKSA9PiB7XG4gICAgICAgIGNvbnN0IGl0ZW1zID0gdGhpcy5pbmJveCQudmFsdWUuZmlsdGVyKGkgPT4gaS5jb252ZXJzYXRpb25faWQgIT09IGNvbnZlcnNhdGlvbklkKTtcbiAgICAgICAgdGhpcy5pbmJveCQubmV4dChpdGVtcyk7XG4gICAgICAgIHRoaXMucmVjYWxjVW5yZWFkKGl0ZW1zKTtcbiAgICAgICAgY29uc3QgbWFwID0gbmV3IE1hcCh0aGlzLm1lc3NhZ2VzTWFwJC52YWx1ZSk7XG4gICAgICAgIG1hcC5kZWxldGUoY29udmVyc2F0aW9uSWQpO1xuICAgICAgICB0aGlzLm1lc3NhZ2VzTWFwJC5uZXh0KG1hcCk7XG4gICAgICAgIGlmICh0aGlzLmFjdGl2ZUNvbnZlcnNhdGlvbklkJC52YWx1ZSA9PT0gY29udmVyc2F0aW9uSWQpIHtcbiAgICAgICAgICB0aGlzLmFjdGl2ZUNvbnZlcnNhdGlvbklkJC5uZXh0KG51bGwpO1xuICAgICAgICAgIHRoaXMuYWN0aXZlVmlldyQubmV4dCgnaW5ib3gnKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmNsb3NlQ2hhdChjb252ZXJzYXRpb25JZCk7XG4gICAgICB9LFxuICAgICAgZXJyb3I6ICgpID0+IHt9LFxuICAgIH0pO1xuICB9XG5cbiAgY2xlYXJDb252ZXJzYXRpb24oY29udmVyc2F0aW9uSWQ6IHN0cmluZyk6IHZvaWQge1xuICAgIGNvbnN0IGNvbnRhY3RJZCA9IHRoaXMuYXV0aC5jb250YWN0SWQ7XG4gICAgaWYgKCFjb250YWN0SWQpIHJldHVybjtcblxuICAgIHRoaXMuYXBpLmNsZWFyQ29udmVyc2F0aW9uKGNvbnZlcnNhdGlvbklkLCBjb250YWN0SWQpLnN1YnNjcmliZSh7XG4gICAgICBuZXh0OiAoKSA9PiB7XG4gICAgICAgIGNvbnN0IG1hcCA9IG5ldyBNYXAodGhpcy5tZXNzYWdlc01hcCQudmFsdWUpO1xuICAgICAgICBtYXAuc2V0KGNvbnZlcnNhdGlvbklkLCBbXSk7XG4gICAgICAgIHRoaXMubWVzc2FnZXNNYXAkLm5leHQobWFwKTtcbiAgICAgICAgY29uc3QgaXRlbXMgPSB0aGlzLmluYm94JC52YWx1ZS5tYXAoaSA9PlxuICAgICAgICAgIGkuY29udmVyc2F0aW9uX2lkID09PSBjb252ZXJzYXRpb25JZFxuICAgICAgICAgICAgPyB7IC4uLmksIGxhc3RfbWVzc2FnZV9wcmV2aWV3OiAnJywgbGFzdF9tZXNzYWdlX2F0OiBpLmxhc3RfbWVzc2FnZV9hdCB9XG4gICAgICAgICAgICA6IGlcbiAgICAgICAgKTtcbiAgICAgICAgdGhpcy5pbmJveCQubmV4dChpdGVtcyk7XG4gICAgICB9LFxuICAgICAgZXJyb3I6ICgpID0+IHt9LFxuICAgIH0pO1xuICB9XG5cbiAgZGVsZXRlR3JvdXAoY29udmVyc2F0aW9uSWQ6IHN0cmluZyk6IHZvaWQge1xuICAgIGNvbnN0IGNvbnRhY3RJZCA9IHRoaXMuYXV0aC5jb250YWN0SWQ7XG4gICAgaWYgKCFjb250YWN0SWQpIHJldHVybjtcblxuICAgIHRoaXMuYXBpLmRlbGV0ZUdyb3VwKGNvbnZlcnNhdGlvbklkLCBjb250YWN0SWQpLnN1YnNjcmliZSh7XG4gICAgICBuZXh0OiAoKSA9PiB7XG4gICAgICAgIGNvbnN0IGl0ZW1zID0gdGhpcy5pbmJveCQudmFsdWUuZmlsdGVyKGkgPT4gaS5jb252ZXJzYXRpb25faWQgIT09IGNvbnZlcnNhdGlvbklkKTtcbiAgICAgICAgdGhpcy5pbmJveCQubmV4dChpdGVtcyk7XG4gICAgICAgIHRoaXMucmVjYWxjVW5yZWFkKGl0ZW1zKTtcbiAgICAgICAgY29uc3QgbWFwID0gbmV3IE1hcCh0aGlzLm1lc3NhZ2VzTWFwJC52YWx1ZSk7XG4gICAgICAgIG1hcC5kZWxldGUoY29udmVyc2F0aW9uSWQpO1xuICAgICAgICB0aGlzLm1lc3NhZ2VzTWFwJC5uZXh0KG1hcCk7XG4gICAgICAgIGlmICh0aGlzLmFjdGl2ZUNvbnZlcnNhdGlvbklkJC52YWx1ZSA9PT0gY29udmVyc2F0aW9uSWQpIHtcbiAgICAgICAgICB0aGlzLmFjdGl2ZUNvbnZlcnNhdGlvbklkJC5uZXh0KG51bGwpO1xuICAgICAgICAgIHRoaXMuYWN0aXZlVmlldyQubmV4dCgnaW5ib3gnKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmNsb3NlQ2hhdChjb252ZXJzYXRpb25JZCk7XG4gICAgICB9LFxuICAgICAgZXJyb3I6ICgpID0+IHt9LFxuICAgIH0pO1xuICB9XG5cbiAgLy8g4pSA4pSAIFJlYWN0aW9ucyDilIDilIBcbiAgYWRkUmVhY3Rpb24obWVzc2FnZUlkOiBzdHJpbmcsIGVtb2ppOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBjb25zdCBjb250YWN0SWQgPSB0aGlzLmF1dGguY29udGFjdElkO1xuICAgIGlmICghY29udGFjdElkKSByZXR1cm47XG5cbiAgICAvLyBFbmZvcmNlIG9uZSByZWFjdGlvbiBwZXIgdXNlciDigJQgcmVtb3ZlIGFueSBleGlzdGluZyByZWFjdGlvbiB3aXRoIGEgZGlmZmVyZW50IGVtb2ppXG4gICAgZm9yIChjb25zdCBtc2dzIG9mIHRoaXMubWVzc2FnZXNNYXAkLnZhbHVlLnZhbHVlcygpKSB7XG4gICAgICBjb25zdCBtc2cgPSBtc2dzLmZpbmQobSA9PiBTdHJpbmcobS5tZXNzYWdlX2lkKSA9PT0gU3RyaW5nKG1lc3NhZ2VJZCkpO1xuICAgICAgaWYgKG1zZz8ucmVhY3Rpb25zKSB7XG4gICAgICAgIGZvciAoY29uc3QgciBvZiBtc2cucmVhY3Rpb25zKSB7XG4gICAgICAgICAgaWYgKHIuaGFzUmVhY3RlZCAmJiByLmVtb2ppICE9PSBlbW9qaSkge1xuICAgICAgICAgICAgdGhpcy5hcHBseVJlYWN0aW9uT3B0aW1pc3RpY2FsbHkobWVzc2FnZUlkLCByLmVtb2ppLCBmYWxzZSk7XG4gICAgICAgICAgICB0aGlzLmFwaS5yZW1vdmVSZWFjdGlvbihtZXNzYWdlSWQsIGNvbnRhY3RJZCwgci5lbW9qaSkuc3Vic2NyaWJlKHsgZXJyb3I6ICgpID0+IHt9IH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgYnJlYWs7XG4gICAgfVxuXG4gICAgLy8gT3B0aW1pc3RpYyBVSSBzbyB1c2VyIHNlZXMgcmVhY3Rpb24gaW1tZWRpYXRlbHkuXG4gICAgdGhpcy5hcHBseVJlYWN0aW9uT3B0aW1pc3RpY2FsbHkobWVzc2FnZUlkLCBlbW9qaSwgdHJ1ZSk7XG5cbiAgICB0aGlzLmFwaS5hZGRSZWFjdGlvbihtZXNzYWdlSWQsIGNvbnRhY3RJZCwgZW1vamkpLnN1YnNjcmliZSh7XG4gICAgICBuZXh0OiAoKSA9PiB7XG4gICAgICAgIHRoaXMucmVmcmVzaE1lc3NhZ2VSZWFjdGlvbnMobWVzc2FnZUlkKTtcbiAgICAgIH0sXG4gICAgICBlcnJvcjogKCkgPT4ge1xuICAgICAgICAvLyBSZXZlcnQgb3B0aW1pc3RpYyB1cGRhdGUgd2hlbiByZXF1ZXN0IGZhaWxzLlxuICAgICAgICB0aGlzLmFwcGx5UmVhY3Rpb25PcHRpbWlzdGljYWxseShtZXNzYWdlSWQsIGVtb2ppLCBmYWxzZSk7XG4gICAgICB9LFxuICAgIH0pO1xuICB9XG5cbiAgcmVtb3ZlUmVhY3Rpb24obWVzc2FnZUlkOiBzdHJpbmcsIGVtb2ppOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBjb25zdCBjb250YWN0SWQgPSB0aGlzLmF1dGguY29udGFjdElkO1xuICAgIGlmICghY29udGFjdElkKSByZXR1cm47XG5cbiAgICAvLyBPcHRpbWlzdGljIFVJIHNvIHVzZXIgc2VlcyByZWFjdGlvbiByZW1vdmFsIGltbWVkaWF0ZWx5LlxuICAgIHRoaXMuYXBwbHlSZWFjdGlvbk9wdGltaXN0aWNhbGx5KG1lc3NhZ2VJZCwgZW1vamksIGZhbHNlKTtcblxuICAgIHRoaXMuYXBpLnJlbW92ZVJlYWN0aW9uKG1lc3NhZ2VJZCwgY29udGFjdElkLCBlbW9qaSkuc3Vic2NyaWJlKHtcbiAgICAgIG5leHQ6ICgpID0+IHtcbiAgICAgICAgdGhpcy5yZWZyZXNoTWVzc2FnZVJlYWN0aW9ucyhtZXNzYWdlSWQpO1xuICAgICAgfSxcbiAgICAgIGVycm9yOiAoKSA9PiB7XG4gICAgICAgIC8vIFJldmVydCBvcHRpbWlzdGljIHVwZGF0ZSB3aGVuIHJlcXVlc3QgZmFpbHMuXG4gICAgICAgIHRoaXMuYXBwbHlSZWFjdGlvbk9wdGltaXN0aWNhbGx5KG1lc3NhZ2VJZCwgZW1vamksIHRydWUpO1xuICAgICAgfSxcbiAgICB9KTtcbiAgfVxuXG4gIGdldEFjdGl2ZUNvbnZlcnNhdGlvbklkKCk6IHN0cmluZyB8IG51bGwge1xuICAgIHJldHVybiB0aGlzLmFjdGl2ZUNvbnZlcnNhdGlvbklkJC52YWx1ZTtcbiAgfVxuXG4gIC8vIOKUgOKUgCBHZXR0ZXJzIOKUgOKUgFxuICBnZXRNZXNzYWdlc0ZvckNvbnZlcnNhdGlvbihjb252ZXJzYXRpb25JZDogc3RyaW5nKTogTWVzc2FnZVtdIHtcbiAgICByZXR1cm4gdGhpcy5tZXNzYWdlc01hcCQudmFsdWUuZ2V0KGNvbnZlcnNhdGlvbklkKSB8fCBbXTtcbiAgfVxuXG4gIGdldEN1cnJlbnRJbmJveCgpOiBJbmJveEl0ZW1bXSB7XG4gICAgcmV0dXJuIHRoaXMuaW5ib3gkLnZhbHVlO1xuICB9XG5cbiAgLy8g4pSA4pSAIFByaXZhdGUgaGVscGVycyDilIDilIBcbiAgLyoqXG4gICAqIFByZWZlciBgeyB0eXBlLCBkYXRhIH1gOyBzdXBwb3J0IGZsYXQgYHsgdHlwZSwgLi4uZmllbGRzIH1gIGVudmVsb3BlcyBmcm9tIG9sZGVyIGJhY2tlbmRzLlxuICAgKi9cbiAgcHJpdmF0ZSB3c0V2ZW50UGF5bG9hZChtc2c6IFdlYlNvY2tldE1lc3NhZ2UpOiBhbnkge1xuICAgIGlmIChtc2cuZGF0YSAhPT0gdW5kZWZpbmVkICYmIG1zZy5kYXRhICE9PSBudWxsKSB7XG4gICAgICByZXR1cm4gbXNnLmRhdGE7XG4gICAgfVxuICAgIGNvbnN0IHJhdyA9IG1zZyBhcyB1bmtub3duIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+O1xuICAgIGNvbnN0IHsgdHlwZTogX3QsIGRhdGE6IF9kLCB0aW1lc3RhbXA6IF90cywgbWVzc2FnZTogX21zZywgLi4ucmVzdCB9ID0gcmF3O1xuICAgIHJldHVybiBPYmplY3Qua2V5cyhyZXN0KS5sZW5ndGggPyByZXN0IDogbnVsbDtcbiAgfVxuXG4gIHByaXZhdGUgbGlzdGVuV2ViU29ja2V0KCk6IHZvaWQge1xuICAgIHRoaXMud3NTdWI/LnVuc3Vic2NyaWJlKCk7XG4gICAgdGhpcy53c1N1YiA9IHRoaXMud3NTZXJ2aWNlLm9uTWVzc2FnZSQuc3Vic2NyaWJlKChtc2cpID0+IHRoaXMuaGFuZGxlV3NNZXNzYWdlKG1zZykpO1xuICB9XG5cbiAgcHJpdmF0ZSBoYW5kbGVXc01lc3NhZ2UobXNnOiBXZWJTb2NrZXRNZXNzYWdlKTogdm9pZCB7XG4gICAgc3dpdGNoIChtc2cudHlwZSkge1xuICAgICAgY2FzZSAnbmV3X21lc3NhZ2UnOlxuICAgICAgICB0aGlzLmhhbmRsZU5ld01lc3NhZ2UodGhpcy53c0V2ZW50UGF5bG9hZChtc2cpKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdjb252ZXJzYXRpb25fdXBkYXRlZCc6XG4gICAgICAgIHRoaXMubG9hZEluYm94KCk7XG4gICAgICAgIGlmICh0aGlzLmFjdGl2ZUNvbnZlcnNhdGlvbklkJC52YWx1ZSkge1xuICAgICAgICAgIHRoaXMubG9hZE1lc3NhZ2VzKHRoaXMuYWN0aXZlQ29udmVyc2F0aW9uSWQkLnZhbHVlKTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ2dyb3VwX3VwZGF0ZWQnOlxuICAgICAgICB0aGlzLmhhbmRsZUdyb3VwVXBkYXRlZCh0aGlzLndzRXZlbnRQYXlsb2FkKG1zZykpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ2Vycm9yJzpcbiAgICAgICAgdGhpcy5oYW5kbGVXZWJTb2NrZXRFcnJvcihtc2cubWVzc2FnZSk7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgaGFuZGxlR3JvdXBVcGRhdGVkKGRhdGE6IGFueSk6IHZvaWQge1xuICAgIHRoaXMubG9hZEluYm94KCk7XG4gIH1cblxuICBwcml2YXRlIGhhbmRsZVdlYlNvY2tldEVycm9yKGVycm9yTWVzc2FnZTogc3RyaW5nIHwgdW5kZWZpbmVkKTogdm9pZCB7XG4gICAgdm9pZCBlcnJvck1lc3NhZ2U7XG4gIH1cblxuICBwcml2YXRlIGhhbmRsZU5ld01lc3NhZ2UoZGF0YTogYW55KTogdm9pZCB7XG4gICAgaWYgKCFkYXRhKSByZXR1cm47XG5cbiAgICBsZXQgbWVzc2FnZTogTWVzc2FnZSA9IHRoaXMubm9ybWFsaXplTWVzc2FnZVNoYXBlKGRhdGEpO1xuICAgIGNvbnN0IG15Q29udGFjdElkID0gU3RyaW5nKHRoaXMuYXV0aC5jb250YWN0SWQgPz8gJycpO1xuICAgIGNvbnN0IGNvbnZJZCA9IFN0cmluZyhtZXNzYWdlLmNvbnZlcnNhdGlvbl9pZCA/PyAnJyk7XG4gICAgY29uc3QgZXhpc3RpbmcgPSB0aGlzLm1lc3NhZ2VzTWFwJC52YWx1ZS5nZXQoY29udklkKSB8fCBbXTtcblxuICAgIGNvbnN0IG93bkVjaG8gPVxuICAgICAgbXlDb250YWN0SWQgJiZcbiAgICAgIFN0cmluZyhtZXNzYWdlLnNlbmRlcl9pZCkgPT09IG15Q29udGFjdElkICYmXG4gICAgICAhIW1lc3NhZ2UubWVzc2FnZV9pZCAmJlxuICAgICAgIVN0cmluZyhtZXNzYWdlLm1lc3NhZ2VfaWQpLnN0YXJ0c1dpdGgoJ3RlbXAtJyk7XG5cbiAgICAvLyBXUyBvZnRlbiBhcnJpdmVzIGJlZm9yZSBIVFRQIGZpbmlzaGVzIHJlcGxhY2luZyB0ZW1wLTsgbWVyZ2UgaW50byB0ZW1wIGluc3RlYWQgb2YgYXBwZW5kaW5nIGEgZHVwbGljYXRlIHJvdy5cbiAgICBpZiAob3duRWNobykge1xuICAgICAgY29uc3QgdGVtcElkeCA9IGV4aXN0aW5nLmZpbmRJbmRleCgobSkgPT4ge1xuICAgICAgICBpZiAoIVN0cmluZyhtLm1lc3NhZ2VfaWQpLnN0YXJ0c1dpdGgoJ3RlbXAtJykpIHJldHVybiBmYWxzZTtcbiAgICAgICAgaWYgKFN0cmluZyhtLmNvbnZlcnNhdGlvbl9pZCkgIT09IGNvbnZJZCkgcmV0dXJuIGZhbHNlO1xuICAgICAgICBpZiAoU3RyaW5nKG0uc2VuZGVyX2lkKSAhPT0gbXlDb250YWN0SWQpIHJldHVybiBmYWxzZTtcbiAgICAgICAgY29uc3QgZHQgPSBNYXRoLmFicyhcbiAgICAgICAgICBuZXcgRGF0ZShtLmNyZWF0ZWRfYXQpLmdldFRpbWUoKSAtIG5ldyBEYXRlKG1lc3NhZ2UuY3JlYXRlZF9hdCkuZ2V0VGltZSgpXG4gICAgICAgICk7XG4gICAgICAgIGlmIChkdCA+PSAxMjBfMDAwKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIGNvbnN0IGEgPSBTdHJpbmcobS5jb250ZW50ID8/ICcnKS50cmltKCk7XG4gICAgICAgIGNvbnN0IGIgPSBTdHJpbmcobWVzc2FnZS5jb250ZW50ID8/ICcnKS50cmltKCk7XG4gICAgICAgIHJldHVybiBhID09PSBiIHx8ICFiO1xuICAgICAgfSk7XG4gICAgICBpZiAodGVtcElkeCA+PSAwKSB7XG4gICAgICAgIGNvbnN0IG1lcmdlZDogTWVzc2FnZSA9IHRoaXMubm9ybWFsaXplTWVzc2FnZVNoYXBlKHtcbiAgICAgICAgICAuLi5leGlzdGluZ1t0ZW1wSWR4XSxcbiAgICAgICAgICAuLi5kYXRhLFxuICAgICAgICAgIG1lc3NhZ2VfaWQ6IG1lc3NhZ2UubWVzc2FnZV9pZCxcbiAgICAgICAgICBjb252ZXJzYXRpb25faWQ6IGNvbnZJZCxcbiAgICAgICAgICBjb250ZW50OiB0aGlzLmNvYWxlc2NlTWVzc2FnZVRleHQoZGF0YSwgZXhpc3RpbmdbdGVtcElkeF0uY29udGVudCksXG4gICAgICAgIH0pO1xuICAgICAgICBjb25zdCBtYXAgPSBuZXcgTWFwKHRoaXMubWVzc2FnZXNNYXAkLnZhbHVlKTtcbiAgICAgICAgY29uc3QgbXNncyA9IHRoaXMuZGVkdXBlTWVzc2FnZXNCeUlkS2VlcEZpcnN0KFsuLi5leGlzdGluZ10pO1xuICAgICAgICBtc2dzW3RlbXBJZHhdID0gbWVyZ2VkO1xuICAgICAgICBtYXAuc2V0KGNvbnZJZCwgdGhpcy5kZWR1cGVNZXNzYWdlc0J5SWRLZWVwRmlyc3QobXNncykpO1xuICAgICAgICB0aGlzLm1lc3NhZ2VzTWFwJC5uZXh0KG1hcCk7XG4gICAgICAgIHRoaXMucmVmcmVzaE1lc3NhZ2VSZWFjdGlvbnMobWVyZ2VkLm1lc3NhZ2VfaWQpO1xuICAgICAgICBtZXNzYWdlID0gbWVyZ2VkO1xuICAgICAgICB0aGlzLnVwZGF0ZUluYm94UHJldmlldyhtZXNzYWdlKTtcbiAgICAgICAgaWYgKHRoaXMuYWN0aXZlQ29udmVyc2F0aW9uSWQkLnZhbHVlID09PSBtZXNzYWdlLmNvbnZlcnNhdGlvbl9pZCkge1xuICAgICAgICAgIHRoaXMubWFya0FzUmVhZChtZXNzYWdlLmNvbnZlcnNhdGlvbl9pZCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IGlzRnJvbU90aGVyID0gU3RyaW5nKG1lc3NhZ2Uuc2VuZGVyX2lkKSAhPT0gbXlDb250YWN0SWQ7XG5cbiAgICBjb25zdCBpc0R1cGxpY2F0ZSA9IGV4aXN0aW5nLnNvbWUoXG4gICAgICAobSkgPT5cbiAgICAgICAgU3RyaW5nKG0ubWVzc2FnZV9pZCkgPT09IFN0cmluZyhtZXNzYWdlLm1lc3NhZ2VfaWQpIHx8XG4gICAgICAgIChTdHJpbmcobS5zZW5kZXJfaWQpID09PSBTdHJpbmcobWVzc2FnZS5zZW5kZXJfaWQpICYmXG4gICAgICAgICAgU3RyaW5nKG0uY29udGVudCA/PyAnJykgPT09IFN0cmluZyhtZXNzYWdlLmNvbnRlbnQgPz8gJycpICYmXG4gICAgICAgICAgTWF0aC5hYnMobmV3IERhdGUobS5jcmVhdGVkX2F0KS5nZXRUaW1lKCkgLSBuZXcgRGF0ZShtZXNzYWdlLmNyZWF0ZWRfYXQpLmdldFRpbWUoKSkgPCAyMDAwKVxuICAgICk7XG5cbiAgICBpZiAoIWlzRHVwbGljYXRlKSB7XG4gICAgICB0aGlzLmFwcGVuZE1lc3NhZ2UobWVzc2FnZSk7XG5cbiAgICAgIGlmIChpc0Zyb21PdGhlcikge1xuICAgICAgICB0aGlzLnBsYXlOb3RpZmljYXRpb25Tb3VuZCgpO1xuICAgICAgfVxuICAgICAgdGhpcy51cGRhdGVJbmJveFByZXZpZXcobWVzc2FnZSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuYWN0aXZlQ29udmVyc2F0aW9uSWQkLnZhbHVlICE9PSBtZXNzYWdlLmNvbnZlcnNhdGlvbl9pZCkge1xuICAgICAgaWYgKGlzRnJvbU90aGVyICYmICFpc0R1cGxpY2F0ZSkge1xuICAgICAgICB0aGlzLmluY3JlbWVudFVucmVhZChtZXNzYWdlLmNvbnZlcnNhdGlvbl9pZCk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMubWFya0FzUmVhZChtZXNzYWdlLmNvbnZlcnNhdGlvbl9pZCk7XG4gICAgfVxuICB9XG5cbiAgLyoqIFB1YmxpYyDigJQgbGV0cyBjb21wb25lbnRzIGFkZCBhbiBvcHRpbWlzdGljIG1lc3NhZ2Ugd2l0aG91dCBhIHJvdW5kLXRyaXAuICovXG4gIGFwcGVuZE9wdGltaXN0aWNNZXNzYWdlKG1lc3NhZ2U6IE1lc3NhZ2UpOiB2b2lkIHtcbiAgICB0aGlzLmFwcGVuZE1lc3NhZ2UobWVzc2FnZSk7XG4gIH1cblxuICBwcml2YXRlIGFwcGVuZE1lc3NhZ2UobWVzc2FnZTogTWVzc2FnZSk6IHZvaWQge1xuICAgIGNvbnN0IG1hcCA9IG5ldyBNYXAodGhpcy5tZXNzYWdlc01hcCQudmFsdWUpO1xuICAgIGNvbnN0IG1zZ3MgPSBbLi4uKG1hcC5nZXQobWVzc2FnZS5jb252ZXJzYXRpb25faWQpIHx8IFtdKSwgbWVzc2FnZV07XG4gICAgbWFwLnNldChtZXNzYWdlLmNvbnZlcnNhdGlvbl9pZCwgbXNncyk7XG4gICAgdGhpcy5tZXNzYWdlc01hcCQubmV4dChtYXApO1xuICAgIHRoaXMucmVmcmVzaE1lc3NhZ2VSZWFjdGlvbnMobWVzc2FnZS5tZXNzYWdlX2lkKTtcbiAgfVxuXG4gIHByaXZhdGUgdXBkYXRlSW5ib3hQcmV2aWV3KG1lc3NhZ2U6IE1lc3NhZ2UpOiB2b2lkIHtcbiAgICBjb25zdCB0ZXh0ID0gU3RyaW5nKG1lc3NhZ2UuY29udGVudCA/PyAnJykudHJpbSgpO1xuICAgIGNvbnN0IG1lZGlhID0gdGhpcy5tZXNzYWdlTG9va3NMaWtlTWVkaWEobWVzc2FnZSk7XG4gICAgaWYgKCF0ZXh0ICYmICFtZWRpYSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCBwcmV2aWV3ID0gdGV4dCB8fCAnW0ltYWdlXSc7XG4gICAgY29uc3QgaXRlbXMgPSB0aGlzLmluYm94JC52YWx1ZS5tYXAoKGl0ZW0pID0+IHtcbiAgICAgIGlmIChpdGVtLmNvbnZlcnNhdGlvbl9pZCA9PT0gbWVzc2FnZS5jb252ZXJzYXRpb25faWQpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAuLi5pdGVtLFxuICAgICAgICAgIGxhc3RfbWVzc2FnZV9wcmV2aWV3OiBwcmV2aWV3LFxuICAgICAgICAgIGxhc3RfbWVzc2FnZV9hdDogbWVzc2FnZS5jcmVhdGVkX2F0LFxuICAgICAgICB9O1xuICAgICAgfVxuICAgICAgcmV0dXJuIGl0ZW07XG4gICAgfSk7XG5cbiAgICBpdGVtcy5zb3J0KChhLCBiKSA9PiBuZXcgRGF0ZShiLmxhc3RfbWVzc2FnZV9hdCkuZ2V0VGltZSgpIC0gbmV3IERhdGUoYS5sYXN0X21lc3NhZ2VfYXQpLmdldFRpbWUoKSk7XG4gICAgdGhpcy5pbmJveCQubmV4dChpdGVtcyk7XG4gIH1cblxuICAvKiogRmlyc3Qgbm9uLWVtcHR5IHRleHQgZmllbGQgZnJvbSBBUEkgLyBXUyBvYmplY3RzIChQT1NUIGJvZGllcyBvZnRlbiBvbWl0IGBjb250ZW50YCkuICovXG4gIHByaXZhdGUgY29hbGVzY2VNZXNzYWdlVGV4dChyYXc6IGFueSwgZmFsbGJhY2sgPSAnJyk6IHN0cmluZyB7XG4gICAgY29uc3QgY2FuZHMgPSBbcmF3Py5jb250ZW50LCByYXc/LmJvZHksIHJhdz8udGV4dCwgZmFsbGJhY2tdO1xuICAgIGZvciAoY29uc3QgYyBvZiBjYW5kcykge1xuICAgICAgaWYgKHR5cGVvZiBjID09PSAnc3RyaW5nJyAmJiBjLnRyaW0oKSkgcmV0dXJuIGM7XG4gICAgICBpZiAoYyAhPSBudWxsICYmIHR5cGVvZiBjICE9PSAnb2JqZWN0JyAmJiBTdHJpbmcoYykudHJpbSgpKSByZXR1cm4gU3RyaW5nKGMpLnRyaW0oKTtcbiAgICB9XG4gICAgcmV0dXJuIHR5cGVvZiBmYWxsYmFjayA9PT0gJ3N0cmluZycgPyBmYWxsYmFjayA6IFN0cmluZyhmYWxsYmFjayA/PyAnJyk7XG4gIH1cblxuICBwcml2YXRlIG1lc3NhZ2VMb29rc0xpa2VNZWRpYShtOiBNZXNzYWdlKTogYm9vbGVhbiB7XG4gICAgY29uc3QgdCA9IG0ubWVzc2FnZV90eXBlO1xuICAgIGlmICh0ICYmIHQgIT09ICdURVhUJykgcmV0dXJuIHRydWU7XG4gICAgY29uc3QgdSA9IFN0cmluZyhtLm1lZGlhX3VybCA/PyAnJykudHJpbSgpO1xuICAgIGlmICh1ICYmICh1LnN0YXJ0c1dpdGgoJ2h0dHA6Ly8nKSB8fCB1LnN0YXJ0c1dpdGgoJ2h0dHBzOi8vJykgfHwgdS5zdGFydHNXaXRoKCdkYXRhOicpKSkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIHJldHVybiBBcnJheS5pc0FycmF5KG0uYXR0YWNobWVudHMpICYmIG0uYXR0YWNobWVudHMubGVuZ3RoID4gMDtcbiAgfVxuXG4gIC8qKiBTYW1lIGxvZ2ljYWwgbWVzc2FnZV9pZCBjYW4gYXBwZWFyIHR3aWNlIHdoZW4gV1MgYmVhdHMgSFRUUCB0ZW1wIHJlcGxhY2VtZW50IOKAlCBrZWVwIGZpcnN0IHJvdy4gKi9cbiAgcHJpdmF0ZSBkZWR1cGVNZXNzYWdlc0J5SWRLZWVwRmlyc3QobXNnczogTWVzc2FnZVtdKTogTWVzc2FnZVtdIHtcbiAgICBjb25zdCBzZWVuID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgcmV0dXJuIG1zZ3MuZmlsdGVyKChtKSA9PiB7XG4gICAgICBjb25zdCBpZCA9IFN0cmluZyhtLm1lc3NhZ2VfaWQgPz8gJycpO1xuICAgICAgaWYgKCFpZCkgcmV0dXJuIHRydWU7XG4gICAgICBpZiAoc2Vlbi5oYXMoaWQpKSByZXR1cm4gZmFsc2U7XG4gICAgICBzZWVuLmFkZChpZCk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgaW5jcmVtZW50VW5yZWFkKGNvbnZlcnNhdGlvbklkOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBjb25zdCBpdGVtcyA9IHRoaXMuaW5ib3gkLnZhbHVlLm1hcCgoaXRlbSkgPT5cbiAgICAgIGl0ZW0uY29udmVyc2F0aW9uX2lkID09PSBjb252ZXJzYXRpb25JZFxuICAgICAgICA/IHsgLi4uaXRlbSwgdW5yZWFkX2NvdW50OiBOdW1iZXIoaXRlbS51bnJlYWRfY291bnQpICsgMSB9XG4gICAgICAgIDogaXRlbVxuICAgICk7XG4gICAgdGhpcy5pbmJveCQubmV4dChpdGVtcyk7XG4gICAgdGhpcy5yZWNhbGNVbnJlYWQoaXRlbXMpO1xuICB9XG5cbiAgLyoqXG4gICAqIE5vcm1hbGl6ZSBiYWNrZW5kIG1lc3NhZ2Ugc2hhcGVzIHNvIFVJIGNhbiByZWxpYWJseSByZW5kZXIgYXR0YWNobWVudHMvbWVkaWEuXG4gICAqIFN1cHBvcnRzIGxlZ2FjeSBhbmQgY3VycmVudCBmaWVsZCBuYW1lcyByZXR1cm5lZCBieSBBUEkvV1MgcGF5bG9hZHMuXG4gICAqL1xuICBwcml2YXRlIG5vcm1hbGl6ZU1lc3NhZ2VTaGFwZShyYXc6IGFueSk6IE1lc3NhZ2Uge1xuICAgIGNvbnN0IGJhc2U6IE1lc3NhZ2UgPSB7XG4gICAgICBtZXNzYWdlX2lkOiBTdHJpbmcocmF3Py5tZXNzYWdlX2lkID8/IHJhdz8uaWQgPz8gJycpLFxuICAgICAgY29udmVyc2F0aW9uX2lkOiBTdHJpbmcocmF3Py5jb252ZXJzYXRpb25faWQgPz8gcmF3Py5jb252ZXJzYXRpb25JZCA/PyAnJyksXG4gICAgICBzZW5kZXJfaWQ6IFN0cmluZyhyYXc/LnNlbmRlcl9pZCA/PyByYXc/LnNlbmRlcklkID8/ICcnKSxcbiAgICAgIHNlbmRlcl9uYW1lOiByYXc/LnNlbmRlcl9uYW1lLFxuICAgICAgc2VuZGVyX3VzZXJuYW1lOiByYXc/LnNlbmRlcl91c2VybmFtZSxcbiAgICAgIHNlbmRlcl9maXJzdF9uYW1lOiByYXc/LnNlbmRlcl9maXJzdF9uYW1lLFxuICAgICAgc2VuZGVyX2xhc3RfbmFtZTogcmF3Py5zZW5kZXJfbGFzdF9uYW1lLFxuICAgICAgbWVzc2FnZV90eXBlOiAocmF3Py5tZXNzYWdlX3R5cGUgPz8gcmF3Py5tZXNzYWdlVHlwZSA/PyAnVEVYVCcpIGFzIE1lc3NhZ2VbJ21lc3NhZ2VfdHlwZSddLFxuICAgICAgY29udGVudDogcmF3Py5jb250ZW50ID8/IHJhdz8uYm9keSA/PyByYXc/LnRleHQgPz8gJycsXG4gICAgICBtZWRpYV91cmw6IHJhdz8ubWVkaWFfdXJsID8/IHJhdz8ubWVkaWFVcmwgPz8gcmF3Py51cmwgPz8gcmF3Py5maWxlX3VybCxcbiAgICAgIGNyZWF0ZWRfYXQ6IHJhdz8uY3JlYXRlZF9hdCA/PyByYXc/LmNyZWF0ZWRBdCA/PyBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICBpc19yZWFkOiByYXc/LmlzX3JlYWQsXG4gICAgICByZWFjdGlvbnM6IHJhdz8ucmVhY3Rpb25zLFxuICAgICAgbWVudGlvbnM6IHJhdz8ubWVudGlvbnMsXG4gICAgICBhdHRhY2htZW50czogcmF3Py5hdHRhY2htZW50cyxcbiAgICAgIGlzX3Bpbm5lZDogcmF3Py5pc19waW5uZWQsXG4gICAgICBwaW5uZWRfYXQ6IHJhdz8ucGlubmVkX2F0LFxuICAgICAgcGlubmVkX2J5OiByYXc/LnBpbm5lZF9ieSxcbiAgICB9O1xuXG4gICAgY29uc3QgdXVpZFJlID1cbiAgICAgIC9eWzAtOWEtZl17OH0tWzAtOWEtZl17NH0tWzEtNV1bMC05YS1mXXszfS1bODlhYl1bMC05YS1mXXszfS1bMC05YS1mXXsxMn0kL2k7XG5cbiAgICAvLyBOb3JtYWxpemUgYXR0YWNobWVudCBvYmplY3RzIChBUEkgbWF5IHVzZSBmaWxlSWQgLyBpZCBpbnN0ZWFkIG9mIGZpbGVfaWQpLlxuICAgIGlmIChBcnJheS5pc0FycmF5KGJhc2UuYXR0YWNobWVudHMpICYmIGJhc2UuYXR0YWNobWVudHMubGVuZ3RoID4gMCkge1xuICAgICAgY29uc3QgbWFwcGVkOiBBdHRhY2htZW50W10gPSAoYmFzZS5hdHRhY2htZW50cyBhcyBhbnlbXSkubWFwKChhKSA9PiAoe1xuICAgICAgICBmaWxlX2lkOiBTdHJpbmcoXG4gICAgICAgICAgYT8uZmlsZV9pZCA/PyBhPy5maWxlSWQgPz8gYT8uaWQgPz8gYT8uYXR0YWNobWVudF9pZCA/PyBhPy5zdG9yYWdlX2ZpbGVfaWQgPz8gJydcbiAgICAgICAgKS50cmltKCksXG4gICAgICAgIGZpbGVuYW1lOiBTdHJpbmcoYT8uZmlsZW5hbWUgPz8gYT8uZmlsZV9uYW1lID8/IGE/Lm5hbWUgPz8gYT8ub3JpZ2luYWxfZmlsZW5hbWUgPz8gJycpLFxuICAgICAgICBtaW1lX3R5cGU6IGE/Lm1pbWVfdHlwZSA/PyBhPy5taW1lVHlwZSxcbiAgICAgICAgdXJsOiBhPy51cmwgPz8gYT8uZmlsZV91cmwgPz8gYT8uZG93bmxvYWRfdXJsLFxuICAgICAgfSkpLmZpbHRlcigoYSkgPT4gISFhLmZpbGVfaWQgJiYgIWEuZmlsZV9pZC5zdGFydHNXaXRoKCd0ZW1wLScpKTtcblxuICAgICAgaWYgKG1hcHBlZC5sZW5ndGggPiAwKSB7XG4gICAgICAgIHJldHVybiB7IC4uLmJhc2UsIGF0dGFjaG1lbnRzOiBtYXBwZWQgfTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBSZWNvbnN0cnVjdCBhdHRhY2htZW50cyBmcm9tIGFsdGVybmF0ZSBBUEkgZmllbGRzLlxuICAgIGxldCBhdHRhY2htZW50SWRzOiBzdHJpbmdbXSA9IFtdO1xuICAgIGlmIChBcnJheS5pc0FycmF5KHJhdz8uYXR0YWNobWVudF9pZHMpKSB7XG4gICAgICBhdHRhY2htZW50SWRzID0gcmF3LmF0dGFjaG1lbnRfaWRzLm1hcCgoeDogYW55KSA9PiBTdHJpbmcoeCkudHJpbSgpKS5maWx0ZXIoQm9vbGVhbik7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgcmF3Py5hdHRhY2htZW50X2lkcyA9PT0gJ3N0cmluZycgJiYgcmF3LmF0dGFjaG1lbnRfaWRzLnRyaW0oKSkge1xuICAgICAgYXR0YWNobWVudElkcyA9IHJhdy5hdHRhY2htZW50X2lkc1xuICAgICAgICAuc3BsaXQoL1ssXFxzXSsvKVxuICAgICAgICAubWFwKChzOiBzdHJpbmcpID0+IHMudHJpbSgpKVxuICAgICAgICAuZmlsdGVyKEJvb2xlYW4pO1xuICAgIH1cblxuICAgIGlmIChhdHRhY2htZW50SWRzLmxlbmd0aCA9PT0gMCAmJiBBcnJheS5pc0FycmF5KHJhdz8uZmlsZV9pZHMpKSB7XG4gICAgICBhdHRhY2htZW50SWRzID0gcmF3LmZpbGVfaWRzLm1hcCgoeDogYW55KSA9PiBTdHJpbmcoeCkudHJpbSgpKS5maWx0ZXIoQm9vbGVhbik7XG4gICAgfVxuXG4gICAgY29uc3QgcHVzaElkID0gKHY6IGFueSkgPT4ge1xuICAgICAgY29uc3QgcyA9IHYgIT0gbnVsbCAmJiB2ICE9PSAnJyA/IFN0cmluZyh2KS50cmltKCkgOiAnJztcbiAgICAgIGlmIChzICYmICFhdHRhY2htZW50SWRzLmluY2x1ZGVzKHMpKSBhdHRhY2htZW50SWRzLnB1c2gocyk7XG4gICAgfTtcblxuICAgIHB1c2hJZChyYXc/LmZpbGVfaWQpO1xuICAgIHB1c2hJZChyYXc/LmF0dGFjaG1lbnRfaWQpO1xuICAgIHB1c2hJZChyYXc/LnN0b3JhZ2VfZmlsZV9pZCk7XG4gICAgcHVzaElkKHJhdz8uYmxvYl9pZCk7XG5cbiAgICAvLyBCYWNrZW5kIHN0b3JlcyBmaXJzdCBhdHRhY2htZW50IGlkIGluIG1lc3NhZ2luZy5tZXNzYWdlLm1lZGlhX3VybCAoVVVJRCksIG5vdCBhIHB1YmxpYyBVUkwuXG4gICAgY29uc3QgbWVkaWFBc0lkID0gU3RyaW5nKGJhc2UubWVkaWFfdXJsIHx8ICcnKS50cmltKCk7XG4gICAgaWYgKFxuICAgICAgbWVkaWFBc0lkICYmXG4gICAgICAhbWVkaWFBc0lkLnN0YXJ0c1dpdGgoJ2h0dHA6Ly8nKSAmJlxuICAgICAgIW1lZGlhQXNJZC5zdGFydHNXaXRoKCdodHRwczovLycpICYmXG4gICAgICAhbWVkaWFBc0lkLnN0YXJ0c1dpdGgoJ2RhdGE6JylcbiAgICApIHtcbiAgICAgIHB1c2hJZChtZWRpYUFzSWQpO1xuICAgIH1cblxuICAgIGNvbnN0IGNvbnRlbnRUcmltID0gU3RyaW5nKGJhc2UuY29udGVudCB8fCAnJykudHJpbSgpO1xuICAgIGlmIChhdHRhY2htZW50SWRzLmxlbmd0aCA9PT0gMCAmJiB1dWlkUmUudGVzdChjb250ZW50VHJpbSkpIHtcbiAgICAgIGF0dGFjaG1lbnRJZHMucHVzaChjb250ZW50VHJpbSk7XG4gICAgfVxuICAgIC8vIFNvbWUgQVBJcyBzdG9yZSBzdG9yYWdlIC8gYXR0YWNobWVudCBpZCBhcyBudW1lcmljIHN0cmluZyBpbiBjb250ZW50IGZvciBGSUxFIG1lc3NhZ2VzLlxuICAgIGlmIChcbiAgICAgIGF0dGFjaG1lbnRJZHMubGVuZ3RoID09PSAwICYmXG4gICAgICAvXlxcZCskLy50ZXN0KGNvbnRlbnRUcmltKSAmJlxuICAgICAgKGJhc2UubWVzc2FnZV90eXBlID09PSAnRklMRScgfHwgYmFzZS5tZXNzYWdlX3R5cGUgPT09ICdJTUFHRScpXG4gICAgKSB7XG4gICAgICBhdHRhY2htZW50SWRzLnB1c2goY29udGVudFRyaW0pO1xuICAgIH1cblxuICAgIGNvbnN0IGZpbGVuYW1lczogc3RyaW5nW10gPSBBcnJheS5pc0FycmF5KHJhdz8uZmlsZW5hbWVzKVxuICAgICAgPyByYXcuZmlsZW5hbWVzLm1hcCgoeDogYW55KSA9PiBTdHJpbmcoeCkpXG4gICAgICA6IHJhdz8uZmlsZW5hbWVcbiAgICAgID8gW1N0cmluZyhyYXcuZmlsZW5hbWUpXVxuICAgICAgOiByYXc/LmZpbGVfbmFtZVxuICAgICAgPyBbU3RyaW5nKHJhdy5maWxlX25hbWUpXVxuICAgICAgOiBiYXNlLmNvbnRlbnQgJiYgIXV1aWRSZS50ZXN0KGNvbnRlbnRUcmltKVxuICAgICAgPyBbU3RyaW5nKGJhc2UuY29udGVudCldXG4gICAgICA6IFtdO1xuXG4gICAgaWYgKGF0dGFjaG1lbnRJZHMubGVuZ3RoID4gMCB8fCBmaWxlbmFtZXMubGVuZ3RoID4gMCkge1xuICAgICAgY29uc3QgZmFsbGJhY2tNaW1lID0gcmF3Py5taW1lX3R5cGUgPz8gcmF3Py5hdHRhY2htZW50X21pbWVfdHlwZTtcbiAgICAgIGNvbnN0IHVybEZhbGxiYWNrID0gcmF3Py5maWxlX3VybCA/PyByYXc/LnVybCA/PyByYXc/Lm1lZGlhX3VybCA/PyByYXc/Lm1lZGlhVXJsO1xuICAgICAgY29uc3QgaWRzID0gYXR0YWNobWVudElkcy5sZW5ndGggPiAwID8gYXR0YWNobWVudElkcyA6IFtdO1xuICAgICAgY29uc3QgYnVpbHQ6IEF0dGFjaG1lbnRbXSA9IGlkcy5tYXAoKGlkLCBpZHgpID0+ICh7XG4gICAgICAgIGZpbGVfaWQ6IGlkLFxuICAgICAgICBmaWxlbmFtZTogZmlsZW5hbWVzW2lkeF0gfHwgZmlsZW5hbWVzWzBdIHx8IGBBdHRhY2htZW50ICR7aWR4ICsgMX1gLFxuICAgICAgICBtaW1lX3R5cGU6IGZhbGxiYWNrTWltZSxcbiAgICAgICAgdXJsOiB1cmxGYWxsYmFjayxcbiAgICAgIH0pKTtcblxuICAgICAgLy8gRmlsZW5hbWUgb25seSArIGRpcmVjdCBVUkwgKG5vIHN0b3JhZ2UgaWQpOiBzdGlsbCByZW5kZXJhYmxlIGFzIDxpbWcgc3JjPi5cbiAgICAgIGlmIChcbiAgICAgICAgYnVpbHQubGVuZ3RoID09PSAwICYmXG4gICAgICAgIGZpbGVuYW1lcy5sZW5ndGggPiAwICYmXG4gICAgICAgIHVybEZhbGxiYWNrICYmXG4gICAgICAgIFN0cmluZyh1cmxGYWxsYmFjaykubWF0Y2goL15odHRwcz86XFwvXFwvL2kpXG4gICAgICApIHtcbiAgICAgICAgYnVpbHQucHVzaCh7XG4gICAgICAgICAgZmlsZV9pZDogJycsXG4gICAgICAgICAgZmlsZW5hbWU6IGZpbGVuYW1lc1swXSxcbiAgICAgICAgICBtaW1lX3R5cGU6IGZhbGxiYWNrTWltZSxcbiAgICAgICAgICB1cmw6IFN0cmluZyh1cmxGYWxsYmFjayksXG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICBpZiAoYnVpbHQubGVuZ3RoID4gMCkge1xuICAgICAgICByZXR1cm4geyAuLi5iYXNlLCBhdHRhY2htZW50czogYnVpbHQgfTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gYmFzZTtcbiAgfVxuXG4gIHByaXZhdGUgcGxheU5vdGlmaWNhdGlvblNvdW5kKCk6IHZvaWQge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBhdWRpbyA9IG5ldyBBdWRpbygnZGF0YTphdWRpby93YXY7YmFzZTY0LFVrbEdSbm9HQUFCWFFWWkZabTEwSUJBQUFBQUJBQUVBUUI4QUFFQWZBQUFCQUFnQVpHRjBZUW9HQUFDQmhZcUZiRjFmZEppdnJKQmhOalZnb2REYnEyRWNCaithMi9MRGNpVUZMSUhPOHRpSk53Z1phTHZ0NTU5TkVBeFFwK1B3dG1NY0JqaVIxL0xNZVN3RkpIZkg4TjJRUUFvVVhyVHA2NmhWRkFwR24rRHl2bXdoQlN1Qnp2TFppVFlJR0dTNTdPaWhVQkVMVEtYaDhibGxIQVUyamRYenpuMHZCU2grelBMYWl6c0tGR0N6Nk95cldCUUxTS0RmOHNGdUl3VXVnOC95MjRrM0NCaGt1K3pvb1ZBUkMweWw0Zkc1WlJ3Rk5vM1Y4ODU5THdVb2Zzenkyb3M3Q2hSZ3MranNxMWdWQzBpZzMvTEJiaU1GTG9MUDh0dUpOd2dZWkx2czZLRlFFUXRNcGVIeHVXVWNCVGFOMWZQT2ZTOEZLSDdNOHRxTE93b1VZTFBvN0t0WUZRdElvTi95d1c0akJTNkN6L0xiaVRjSUdHUzc3T2loVUJFTFRLWGg4YmxsSEFVMmpkWHp6bjB2QlNoK3pQTGFpenNLRkdDejZPeXJXQlVMU0tEZjhzRnVJd1V1Z3MveTI0azNDQmhrdSt6b29WQVJDMHlsNGZHNVpSd0ZObzNWODg1OUx3VW9mc3p5Mm9zN0NoUmdzK2pzcTFnVkMwaWczL0xCYmlNRkxvTFA4dHVKTndnWVpMdnM2S0ZRRVF0TXBlSHh1V1VjQlRhTjFmUE9mUzhGS0g3TTh0cUxPd29VWUxQbzdLdFlGUXRJb04veXdXNGpCUzZDei9MYmlUY0lHR1M3N09paFVCRUxUS1hoOGJsbEhBVTJqZFh6em4wdkJTaCt6UExhaXpzS0ZHQ3o2T3lyV0JVTFNLRGY4c0Z1SXdVdWdzL3kyNGszQ0Joa3Urem9vVkFSQzB5bDRmRzVaUndGTm8zVjg4NTlMd1VvZnN6eTJvczdDaFJncytqc3ExZ1ZDMGlnMy9MQmJpTUZMb0xQOHR1Sk53Z1laTHZzNktGUUVRdE1wZUh4dVdVY0JUYU4xZlBPZlM4RktIN004dHFMT3dvVVlMUG83S3RZRlF0SW9OL3l3VzRqQlM2Q3ovTGJpVGNJR0dTNzdPaWhVQkVMVEtYaDhibGxIQVUyamRYenpuMHZCU2grelBMYWl6c0tGR0N6Nk95cldCVUxTS0RmOHNGdUl3VXVncy95MjRrM0NCaGt1K3pvb1ZBUkMweWw0Zkc1WlJ3Rk5vM1Y4ODU5THdVb2Zzenkyb3M3Q2hSZ3MranNxMWdWQzBpZzMvTEJiaU1GTG9MUDh0dUpOd2dZWkx2czZLRlFFUXRNcGVIeHVXVWNCVGFOMWZQT2ZTOEZLSDdNOHRxTE93b1VZTFBvN0t0WUZRdElvTi95d1c0akJTNkN6L0xiaVRjSUdHUzc3T2loVUJFTFRLWGg4YmxsSEFVMmpkWHp6bjB2QlNoK3pQTGFpenNLRkdDejZPeXJXQlVMU0tEZjhzRnVJd1V1Z3MveTI0azNDQmhrdSt6b29WQVJDMHlsNGZHNVpSd0ZObzNWODg1OUx3VW9mc3p5Mm9zN0NoUmdzK2pzcTFnVkMwaWczL0xCYmlNRkxvTFA4dHVKTndnWVpMdnM2S0ZRRVF0TXBlSHh1V1VjQlRhTjFmUE9mUzhGS0g3TTh0cUxPd29VWUxQbzdLdFlGUXRJb04veXdXNGpCUzZDei9MYmlUY0lHR1M3N09paFVCRUxUS1hoOGJsbEhBVTJqZFh6em4wdkJTaCt6UExhaXpzS0ZHQ3o2T3lyV0JVTFNLRGY4c0Z1SXdVdWdzL3kyNGszQ0Joa3Urem9vVkFSQzB5bDRmRzVaUndGTm8zVjg4NTlMd1VvZnN6eScpO1xuICAgICAgYXVkaW8udm9sdW1lID0gMC4zO1xuICAgICAgYXVkaW8ucGxheSgpLmNhdGNoKCgpID0+IHt9KTtcbiAgICB9IGNhdGNoIHtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIHJlY2FsY1VucmVhZChpdGVtczogSW5ib3hJdGVtW10pOiB2b2lkIHtcbiAgICBjb25zdCB0b3RhbCA9IGl0ZW1zLnJlZHVjZSgoc3VtLCBpKSA9PiBzdW0gKyBOdW1iZXIoaS51bnJlYWRfY291bnQgfHwgMCksIDApO1xuICAgIHRoaXMudG90YWxVbnJlYWQkLm5leHQodG90YWwpO1xuICB9XG5cbiAgcHJpdmF0ZSBoeWRyYXRlUmVhY3Rpb25zRm9yQ29udmVyc2F0aW9uKGNvbnZlcnNhdGlvbklkOiBzdHJpbmcsIG1lc3NhZ2VzOiBNZXNzYWdlW10pOiB2b2lkIHtcbiAgICBjb25zdCBmZXRjaGFibGUgPSBtZXNzYWdlcy5maWx0ZXIoXG4gICAgICAobSkgPT4gISFtLm1lc3NhZ2VfaWQgJiYgIVN0cmluZyhtLm1lc3NhZ2VfaWQpLnN0YXJ0c1dpdGgoJ3RlbXAtJylcbiAgICApO1xuICAgIGlmICghZmV0Y2hhYmxlLmxlbmd0aCkgcmV0dXJuO1xuXG4gICAgY29uc3Qgam9icyA9IGZldGNoYWJsZS5tYXAoKG0pID0+XG4gICAgICB0aGlzLmFwaS5nZXRSZWFjdGlvbnMobS5tZXNzYWdlX2lkKS5waXBlKFxuICAgICAgICBtYXAoKHJvd3MpID0+ICh7IG1lc3NhZ2VJZDogbS5tZXNzYWdlX2lkLCByZWFjdGlvbnM6IHRoaXMubm9ybWFsaXplUmVhY3Rpb25Sb3dzKHJvd3MpIH0pKSxcbiAgICAgICAgY2F0Y2hFcnJvcigoKSA9PiBvZih7IG1lc3NhZ2VJZDogbS5tZXNzYWdlX2lkLCByZWFjdGlvbnM6IFtdIH0pKVxuICAgICAgKVxuICAgICk7XG5cbiAgICBmb3JrSm9pbihqb2JzKS5zdWJzY3JpYmUoKHJlc3VsdHMpID0+IHtcbiAgICAgIGNvbnN0IG1hcCA9IG5ldyBNYXAodGhpcy5tZXNzYWdlc01hcCQudmFsdWUpO1xuICAgICAgY29uc3QgY3VycmVudCA9IFsuLi4obWFwLmdldChjb252ZXJzYXRpb25JZCkgfHwgW10pXTtcbiAgICAgIGlmICghY3VycmVudC5sZW5ndGgpIHJldHVybjtcblxuICAgICAgbGV0IGNoYW5nZWQgPSBmYWxzZTtcbiAgICAgIGZvciAoY29uc3QgcmVzdWx0IG9mIHJlc3VsdHMpIHtcbiAgICAgICAgY29uc3QgaWR4ID0gY3VycmVudC5maW5kSW5kZXgoKG0pID0+IFN0cmluZyhtLm1lc3NhZ2VfaWQpID09PSBTdHJpbmcocmVzdWx0Lm1lc3NhZ2VJZCkpO1xuICAgICAgICBpZiAoaWR4ID09PSAtMSkgY29udGludWU7XG4gICAgICAgIGN1cnJlbnRbaWR4XSA9IHsgLi4uY3VycmVudFtpZHhdLCByZWFjdGlvbnM6IHJlc3VsdC5yZWFjdGlvbnMgfTtcbiAgICAgICAgY2hhbmdlZCA9IHRydWU7XG4gICAgICB9XG5cbiAgICAgIGlmIChjaGFuZ2VkKSB7XG4gICAgICAgIG1hcC5zZXQoY29udmVyc2F0aW9uSWQsIGN1cnJlbnQpO1xuICAgICAgICB0aGlzLm1lc3NhZ2VzTWFwJC5uZXh0KG1hcCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIHJlZnJlc2hNZXNzYWdlUmVhY3Rpb25zKG1lc3NhZ2VJZDogc3RyaW5nKTogdm9pZCB7XG4gICAgaWYgKCFtZXNzYWdlSWQgfHwgU3RyaW5nKG1lc3NhZ2VJZCkuc3RhcnRzV2l0aCgndGVtcC0nKSkgcmV0dXJuO1xuXG4gICAgdGhpcy5hcGkuZ2V0UmVhY3Rpb25zKG1lc3NhZ2VJZCkuc3Vic2NyaWJlKHtcbiAgICAgIG5leHQ6IChyb3dzKSA9PiB7XG4gICAgICAgIGNvbnN0IG5vcm1hbGl6ZWQgPSB0aGlzLm5vcm1hbGl6ZVJlYWN0aW9uUm93cyhyb3dzKTtcbiAgICAgICAgY29uc3QgbWFwID0gbmV3IE1hcCh0aGlzLm1lc3NhZ2VzTWFwJC52YWx1ZSk7XG4gICAgICAgIGxldCBjaGFuZ2VkID0gZmFsc2U7XG5cbiAgICAgICAgZm9yIChjb25zdCBbY29udmVyc2F0aW9uSWQsIG1zZ3NdIG9mIG1hcC5lbnRyaWVzKCkpIHtcbiAgICAgICAgICBjb25zdCBpZHggPSBtc2dzLmZpbmRJbmRleCgobSkgPT4gU3RyaW5nKG0ubWVzc2FnZV9pZCkgPT09IFN0cmluZyhtZXNzYWdlSWQpKTtcbiAgICAgICAgICBpZiAoaWR4ID09PSAtMSkgY29udGludWU7XG4gICAgICAgICAgY29uc3QgbmV4dE1zZ3MgPSBbLi4ubXNnc107XG4gICAgICAgICAgbmV4dE1zZ3NbaWR4XSA9IHsgLi4ubmV4dE1zZ3NbaWR4XSwgcmVhY3Rpb25zOiBub3JtYWxpemVkIH07XG4gICAgICAgICAgbWFwLnNldChjb252ZXJzYXRpb25JZCwgbmV4dE1zZ3MpO1xuICAgICAgICAgIGNoYW5nZWQgPSB0cnVlO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGNoYW5nZWQpIHtcbiAgICAgICAgICB0aGlzLm1lc3NhZ2VzTWFwJC5uZXh0KG1hcCk7XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBlcnJvcjogKCkgPT4ge30sXG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIG5vcm1hbGl6ZVJlYWN0aW9uUm93cyhyb3dzOiBhbnlbXSk6IGFueVtdIHtcbiAgICBjb25zdCBieUVtb2ppID0gbmV3IE1hcDxzdHJpbmcsIHsgZW1vamk6IHN0cmluZzsgY291bnQ6IG51bWJlcjsgaGFzUmVhY3RlZDogYm9vbGVhbjsgcmVhY3RvcnM6IHN0cmluZ1tdIH0+KCk7XG4gICAgY29uc3QgbXlDb250YWN0SWQgPSBTdHJpbmcodGhpcy5hdXRoLmNvbnRhY3RJZCB8fCAnJyk7XG4gICAgY29uc3QgY29udGFjdHMgPSB0aGlzLnZpc2libGVDb250YWN0cyQudmFsdWU7XG5cbiAgICBmb3IgKGNvbnN0IHJvdyBvZiByb3dzIHx8IFtdKSB7XG4gICAgICBjb25zdCBlbW9qaSA9IFN0cmluZyhyb3c/LmVtb2ppIHx8ICcnKS50cmltKCk7XG4gICAgICBpZiAoIWVtb2ppKSBjb250aW51ZTtcblxuICAgICAgY29uc3QgY29udGFjdElkID0gU3RyaW5nKHJvdz8uY29udGFjdF9pZCA/PyByb3c/LmNvbnRhY3RJZCA/PyAnJyk7XG4gICAgICBjb25zdCBleHBsaWNpdEhhc1JlYWN0ZWQgPSByb3c/Lmhhc1JlYWN0ZWQgPz8gcm93Py5oYXNfcmVhY3RlZDtcbiAgICAgIGNvbnN0IGhhc1JlYWN0ZWQgPSBleHBsaWNpdEhhc1JlYWN0ZWQgPT09IHRydWUgfHwgKGNvbnRhY3RJZCAmJiBjb250YWN0SWQgPT09IG15Q29udGFjdElkKTtcblxuICAgICAgY29uc3QgY291bnRGcm9tUm93ID0gTnVtYmVyKHJvdz8uY291bnQgPz8gcm93Py5yZWFjdGlvbl9jb3VudCA/PyAwKTtcbiAgICAgIGNvbnN0IGV4aXN0aW5nID0gYnlFbW9qaS5nZXQoZW1vamkpIHx8IHsgZW1vamksIGNvdW50OiAwLCBoYXNSZWFjdGVkOiBmYWxzZSwgcmVhY3RvcnM6IFtdIH07XG5cbiAgICAgIC8vIFNvbWUgQVBJcyByZXR1cm4gb25lIHJvdyBwZXIgcmVhY3Rpb247IHNvbWUgcmV0dXJuIHByZS1hZ2dyZWdhdGVkIGNvdW50LlxuICAgICAgZXhpc3RpbmcuY291bnQgKz0gY291bnRGcm9tUm93ID4gMCA/IGNvdW50RnJvbVJvdyA6IDE7XG4gICAgICBleGlzdGluZy5oYXNSZWFjdGVkID0gZXhpc3RpbmcuaGFzUmVhY3RlZCB8fCAhIWhhc1JlYWN0ZWQ7XG5cbiAgICAgIC8vIFRyYWNrIHJlYWN0b3IgZGlzcGxheSBuYW1lcyB3aGVuIGluZGl2aWR1YWwgY29udGFjdElkIGlzIGF2YWlsYWJsZVxuICAgICAgaWYgKGNvbnRhY3RJZCAmJiBjb3VudEZyb21Sb3cgPD0gMSkge1xuICAgICAgICBsZXQgbmFtZTogc3RyaW5nO1xuICAgICAgICBpZiAoY29udGFjdElkID09PSBteUNvbnRhY3RJZCkge1xuICAgICAgICAgIG5hbWUgPSAnWW91JztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb25zdCBjb250YWN0ID0gY29udGFjdHMuZmluZChjID0+IFN0cmluZyhjLmNvbnRhY3RfaWQpID09PSBjb250YWN0SWQpO1xuICAgICAgICAgIG5hbWUgPSBjb250YWN0ID8gZ2V0Q29udGFjdERpc3BsYXlOYW1lKGNvbnRhY3QpIDogYFVzZXIgJHtjb250YWN0SWR9YDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIWV4aXN0aW5nLnJlYWN0b3JzLmluY2x1ZGVzKG5hbWUpKSB7XG4gICAgICAgICAgZXhpc3RpbmcucmVhY3RvcnMucHVzaChuYW1lKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBieUVtb2ppLnNldChlbW9qaSwgZXhpc3RpbmcpO1xuICAgIH1cblxuICAgIHJldHVybiBBcnJheS5mcm9tKGJ5RW1vamkudmFsdWVzKCkpLmZpbHRlcigocikgPT4gci5jb3VudCA+IDApO1xuICB9XG5cbiAgcHJpdmF0ZSBhcHBseVJlYWN0aW9uT3B0aW1pc3RpY2FsbHkobWVzc2FnZUlkOiBzdHJpbmcsIGVtb2ppOiBzdHJpbmcsIGFkZDogYm9vbGVhbik6IHZvaWQge1xuICAgIGNvbnN0IG1hcCA9IG5ldyBNYXAodGhpcy5tZXNzYWdlc01hcCQudmFsdWUpO1xuICAgIGxldCBkaWRVcGRhdGUgPSBmYWxzZTtcblxuICAgIGZvciAoY29uc3QgW2NvbnZlcnNhdGlvbklkLCBtc2dzXSBvZiBtYXAuZW50cmllcygpKSB7XG4gICAgICBjb25zdCBpZHggPSBtc2dzLmZpbmRJbmRleCgobSkgPT4gU3RyaW5nKG0ubWVzc2FnZV9pZCkgPT09IFN0cmluZyhtZXNzYWdlSWQpKTtcbiAgICAgIGlmIChpZHggPT09IC0xKSBjb250aW51ZTtcblxuICAgICAgY29uc3QgdGFyZ2V0ID0gbXNnc1tpZHhdO1xuICAgICAgY29uc3QgbmV4dFJlYWN0aW9ucyA9IFsuLi4odGFyZ2V0LnJlYWN0aW9ucyB8fCBbXSldO1xuICAgICAgY29uc3QgcklkeCA9IG5leHRSZWFjdGlvbnMuZmluZEluZGV4KChyKSA9PiByLmVtb2ppID09PSBlbW9qaSk7XG5cbiAgICAgIGlmIChhZGQpIHtcbiAgICAgICAgaWYgKHJJZHggPj0gMCkge1xuICAgICAgICAgIGNvbnN0IGN1cnJlbnQgPSBuZXh0UmVhY3Rpb25zW3JJZHhdO1xuICAgICAgICAgIGlmICghY3VycmVudC5oYXNSZWFjdGVkKSB7XG4gICAgICAgICAgICBuZXh0UmVhY3Rpb25zW3JJZHhdID0ge1xuICAgICAgICAgICAgICAuLi5jdXJyZW50LFxuICAgICAgICAgICAgICBoYXNSZWFjdGVkOiB0cnVlLFxuICAgICAgICAgICAgICBjb3VudDogTnVtYmVyKGN1cnJlbnQuY291bnQgfHwgMCkgKyAxLFxuICAgICAgICAgICAgfTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbmV4dFJlYWN0aW9ucy5wdXNoKHsgZW1vamksIGNvdW50OiAxLCBoYXNSZWFjdGVkOiB0cnVlIH0pO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAocklkeCA+PSAwKSB7XG4gICAgICAgICAgY29uc3QgY3VycmVudCA9IG5leHRSZWFjdGlvbnNbcklkeF07XG4gICAgICAgICAgY29uc3QgbmV4dENvdW50ID0gTWF0aC5tYXgoTnVtYmVyKGN1cnJlbnQuY291bnQgfHwgMCkgLSAoY3VycmVudC5oYXNSZWFjdGVkID8gMSA6IDApLCAwKTtcbiAgICAgICAgICBpZiAobmV4dENvdW50ID09PSAwKSB7XG4gICAgICAgICAgICBuZXh0UmVhY3Rpb25zLnNwbGljZShySWR4LCAxKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbmV4dFJlYWN0aW9uc1tySWR4XSA9IHtcbiAgICAgICAgICAgICAgLi4uY3VycmVudCxcbiAgICAgICAgICAgICAgaGFzUmVhY3RlZDogZmFsc2UsXG4gICAgICAgICAgICAgIGNvdW50OiBuZXh0Q291bnQsXG4gICAgICAgICAgICB9O1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBjb25zdCB1cGRhdGVkTXNnOiBNZXNzYWdlID0geyAuLi50YXJnZXQsIHJlYWN0aW9uczogbmV4dFJlYWN0aW9ucyB9O1xuICAgICAgY29uc3QgdXBkYXRlZE1zZ3MgPSBbLi4ubXNnc107XG4gICAgICB1cGRhdGVkTXNnc1tpZHhdID0gdXBkYXRlZE1zZztcbiAgICAgIG1hcC5zZXQoY29udmVyc2F0aW9uSWQsIHVwZGF0ZWRNc2dzKTtcbiAgICAgIGRpZFVwZGF0ZSA9IHRydWU7XG4gICAgICBicmVhaztcbiAgICB9XG5cbiAgICBpZiAoZGlkVXBkYXRlKSB7XG4gICAgICB0aGlzLm1lc3NhZ2VzTWFwJC5uZXh0KG1hcCk7XG4gICAgfVxuICB9XG59XG4iXX0=