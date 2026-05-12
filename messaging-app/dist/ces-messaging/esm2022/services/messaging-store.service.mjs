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
                    if (match && match.contact_id !== currentContact.contact_id) {
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
        this.api.sendMessage(conversationId, contactId, content, messageType).subscribe({
            next: (res) => {
                const optimistic = {
                    message_id: 'temp-' + Date.now(),
                    conversation_id: conversationId,
                    sender_id: contactId,
                    sender_name: 'You',
                    message_type: messageType,
                    content,
                    created_at: new Date().toISOString(),
                    is_read: true,
                };
                this.appendMessage(optimistic);
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
    listenWebSocket() {
        this.wsSub?.unsubscribe();
        this.wsSub = this.wsService.onMessage$.subscribe((msg) => this.handleWsMessage(msg));
    }
    handleWsMessage(msg) {
        switch (msg.type) {
            case 'new_message':
                this.handleNewMessage(msg.data);
                break;
            case 'conversation_updated':
                this.loadInbox();
                if (this.activeConversationId$.value) {
                    this.loadMessages(this.activeConversationId$.value);
                }
                break;
            case 'group_updated':
                this.handleGroupUpdated(msg.data);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVzc2FnaW5nLXN0b3JlLnNlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvbGliL3NlcnZpY2VzL21lc3NhZ2luZy1zdG9yZS5zZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxVQUFVLEVBQWEsTUFBTSxlQUFlLENBQUM7QUFDdEQsT0FBTyxFQUFFLGVBQWUsRUFBRSxVQUFVLEVBQUUsT0FBTyxFQUFnQixRQUFRLEVBQUUsRUFBRSxFQUFFLE1BQU0sTUFBTSxDQUFDO0FBQ3hGLE9BQU8sRUFBRSxVQUFVLEVBQUUsR0FBRyxFQUFFLE1BQU0sZ0JBQWdCLENBQUM7QUFJakQsT0FBTyxFQVFMLHFCQUFxQixHQUV0QixNQUFNLDRCQUE0QixDQUFDOzs7OztBQUdwQyxNQUFNLE9BQU8scUJBQXFCO0lBMkN0QjtJQUNBO0lBQ0E7SUE1Q1YsdUJBQXVCO0lBQ2YsTUFBTSxHQUFHLElBQUksZUFBZSxDQUFjLEVBQUUsQ0FBQyxDQUFDO0lBQzlDLFlBQVksR0FBRyxJQUFJLGVBQWUsQ0FBeUIsSUFBSSxHQUFHLEVBQUUsQ0FBQyxDQUFDO0lBQ3RFLFVBQVUsR0FBRyxJQUFJLGVBQWUsQ0FBZSxFQUFFLENBQUMsQ0FBQztJQUNuRCxnQkFBZ0IsR0FBRyxJQUFJLGVBQWUsQ0FBWSxFQUFFLENBQUMsQ0FBQztJQUN0RCxVQUFVLEdBQUcsSUFBSSxlQUFlLENBQVUsS0FBSyxDQUFDLENBQUM7SUFDakQsV0FBVyxHQUFHLElBQUksZUFBZSxDQUFvRixPQUFPLENBQUMsQ0FBQztJQUM5SCxZQUFZLEdBQUcsSUFBSSxlQUFlLENBQ3ZDLFlBQVksQ0FBQyxPQUFPLENBQUMsd0JBQXdCLENBQWlCLElBQUksT0FBTyxDQUMzRSxDQUFDO0lBQ00scUJBQXFCLEdBQUcsSUFBSSxlQUFlLENBQWdCLElBQUksQ0FBQyxDQUFDO0lBQ2pFLG1CQUFtQixHQUFHLElBQUksZUFBZSxDQUEyQyxJQUFJLENB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QyxPQUFPLENBQUMsS0FBSyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztvQkFDekYsSUFBSSxTQUFTLEtBQUssQ0FBQyxFQUFFLENBQUM7d0JBQ3BCLGFBQWEsQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDO29CQUNoQyxDQUFDO3lCQUFNLENBQUM7d0JBQ04sYUFBYSxDQUFDLElBQUksQ0FBQyxHQUFHOzRCQUNwQixHQUFHLE9BQU87NEJBQ1YsVUFBVSxFQUFFLEtBQUs7NEJBQ2pCLEtBQUssRUFBRSxTQUFTO3lCQUNqQixDQUFDO29CQUNKLENBQUM7Z0JBQ0gsQ0FBQztZQUNILENBQUM7WUFFRCxNQUFNLFVBQVUsR0FBWSxFQUFFLEdBQUcsTUFBTSxFQUFFLFNBQVMsRUFBRSxhQUFhLEVBQUUsQ0FBQztZQUNwRSxNQUFNLFdBQVcsR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUM7WUFDOUIsV0FBVyxDQUFDLEdBQUcsQ0FBQyxHQUFHLFVBQVUsQ0FBQztZQUM5QixHQUFHLENBQUMsR0FBRyxDQUFDLGNBQWMsRUFBRSxXQUFXLENBQUMsQ0FBQztZQUNyQyxTQUFTLEdBQUcsSUFBSSxDQUFDO1lBQ2pCLE1BQU07UUFDUixDQUFDO1FBRUQsSUFBSSxTQUFTLEVBQUUsQ0FBQztZQUNkLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQzlCLENBQUM7SUFDSCxDQUFDO3dHQTE5QlUscUJBQXFCOzRHQUFyQixxQkFBcUIsY0FEUixNQUFNOzs0RkFDbkIscUJBQXFCO2tCQURqQyxVQUFVO21CQUFDLEVBQUUsVUFBVSxFQUFFLE1BQU0sRUFBRSIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEluamVjdGFibGUsIE9uRGVzdHJveSB9IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xyXG5pbXBvcnQgeyBCZWhhdmlvclN1YmplY3QsIE9ic2VydmFibGUsIFN1YmplY3QsIFN1YnNjcmlwdGlvbiwgZm9ya0pvaW4sIG9mIH0gZnJvbSAncnhqcyc7XHJcbmltcG9ydCB7IGNhdGNoRXJyb3IsIG1hcCB9IGZyb20gJ3J4anMvb3BlcmF0b3JzJztcclxuaW1wb3J0IHsgQXV0aFNlcnZpY2UgfSBmcm9tICcuL2F1dGguc2VydmljZSc7XHJcbmltcG9ydCB7IE1lc3NhZ2luZ0FwaVNlcnZpY2UgfSBmcm9tICcuL21lc3NhZ2luZy1hcGkuc2VydmljZSc7XHJcbmltcG9ydCB7IE1lc3NhZ2luZ1dlYlNvY2tldFNlcnZpY2UgfSBmcm9tICcuL21lc3NhZ2luZy13ZWJzb2NrZXQuc2VydmljZSc7XHJcbmltcG9ydCB7XHJcbiAgSW5ib3hJdGVtLFxyXG4gIE1lc3NhZ2UsXHJcbiAgQXR0YWNobWVudCxcclxuICBDb250YWN0LFxyXG4gIENoYXRXaW5kb3csXHJcbiAgV2ViU29ja2V0TWVzc2FnZSxcclxuICBTaWRlYmFyU2lkZSxcclxuICBnZXRDb250YWN0RGlzcGxheU5hbWUsXHJcbiAgZ2V0TWVzc2FnZVNlbmRlck5hbWUsXHJcbn0gZnJvbSAnLi4vbW9kZWxzL21lc3NhZ2luZy5tb2RlbHMnO1xyXG5cclxuQEluamVjdGFibGUoeyBwcm92aWRlZEluOiAncm9vdCcgfSlcclxuZXhwb3J0IGNsYXNzIE1lc3NhZ2luZ1N0b3JlU2VydmljZSBpbXBsZW1lbnRzIE9uRGVzdHJveSB7XHJcbiAgLy8g4pSA4pSAIFN0YXRlIHN1YmplY3RzIOKUgOKUgFxyXG4gIHByaXZhdGUgaW5ib3gkID0gbmV3IEJlaGF2aW9yU3ViamVjdDxJbmJveEl0ZW1bXT4oW10pO1xyXG4gIHByaXZhdGUgbWVzc2FnZXNNYXAkID0gbmV3IEJlaGF2aW9yU3ViamVjdDxNYXA8c3RyaW5nLCBNZXNzYWdlW10+PihuZXcgTWFwKCkpO1xyXG4gIHByaXZhdGUgb3BlbkNoYXRzJCA9IG5ldyBCZWhhdmlvclN1YmplY3Q8Q2hhdFdpbmRvd1tdPihbXSk7XHJcbiAgcHJpdmF0ZSB2aXNpYmxlQ29udGFjdHMkID0gbmV3IEJlaGF2aW9yU3ViamVjdDxDb250YWN0W10+KFtdKTtcclxuICBwcml2YXRlIHBhbmVsT3BlbiQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PGJvb2xlYW4+KGZhbHNlKTtcclxuICBwcml2YXRlIGFjdGl2ZVZpZXckID0gbmV3IEJlaGF2aW9yU3ViamVjdDwnaW5ib3gnIHwgJ2NoYXQnIHwgJ25ldy1jb252ZXJzYXRpb24nIHwgJ2dyb3VwLW1hbmFnZXInIHwgJ2NvbnZlcnNhdGlvbi1zZXR0aW5ncyc+KCdpbmJveCcpO1xyXG4gIHByaXZhdGUgc2lkZWJhclNpZGUkID0gbmV3IEJlaGF2aW9yU3ViamVjdDxTaWRlYmFyU2lkZT4oXHJcbiAgICAobG9jYWxTdG9yYWdlLmdldEl0ZW0oJ21lc3NhZ2luZ19zaWRlYmFyX3NpZGUnKSBhcyBTaWRlYmFyU2lkZSkgfHwgJ3JpZ2h0J1xyXG4gICk7XHJcbiAgcHJpdmF0ZSBhY3RpdmVDb252ZXJzYXRpb25JZCQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PHN0cmluZyB8IG51bGw+KG51bGwpO1xyXG4gIHByaXZhdGUgcGVuZGluZ0RtUmVjaXBpZW50JCA9IG5ldyBCZWhhdmlvclN1YmplY3Q8e2NvbnRhY3RJZDogc3RyaW5nLCBuYW1lOiBzdHJpbmd9IHwgbnVsbD4obnVsbCk7XHJcbiAgcHJpdmF0ZSB0b3RhbFVucmVhZCQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PG51bWJlcj4oMCk7XHJcbiAgcHJpdmF0ZSBsb2FkaW5nTWVzc2FnZXMkID0gbmV3IEJlaGF2aW9yU3ViamVjdDxib29sZWFuPihmYWxzZSk7XHJcbiAgcHJpdmF0ZSBwYW5lbFBvc2l0aW9uJCA9IG5ldyBCZWhhdmlvclN1YmplY3Q8eyB4OiBudW1iZXI7IHk6IG51bWJlciB9IHwgbnVsbD4obnVsbCk7XHJcbiAgcHJpdmF0ZSBwYW5lbFNpemUkID0gbmV3IEJlaGF2aW9yU3ViamVjdDx7IHdpZHRoOiBudW1iZXI7IGhlaWdodDogbnVtYmVyIH0+KHsgd2lkdGg6IDM4MCwgaGVpZ2h0OiA1NjAgfSk7XHJcbiAgcHJpdmF0ZSB3YXNPcGVuQmVmb3JlRHJhZyQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PGJvb2xlYW4+KGZhbHNlKTtcclxuXHJcbiAgLy8g4pSA4pSAIFB1YmxpYyBvYnNlcnZhYmxlcyDilIDilIBcclxuICByZWFkb25seSBpbmJveCA9IHRoaXMuaW5ib3gkLmFzT2JzZXJ2YWJsZSgpO1xyXG4gIHJlYWRvbmx5IG1lc3NhZ2VzTWFwID0gdGhpcy5tZXNzYWdlc01hcCQuYXNPYnNlcnZhYmxlKCk7XHJcbiAgcmVhZG9ubHkgb3BlbkNoYXRzID0gdGhpcy5vcGVuQ2hhdHMkLmFzT2JzZXJ2YWJsZSgpO1xyXG4gIHJlYWRvbmx5IHZpc2libGVDb250YWN0cyA9IHRoaXMudmlzaWJsZUNvbnRhY3RzJC5hc09ic2VydmFibGUoKTtcclxuICByZWFkb25seSBwYW5lbE9wZW4gPSB0aGlzLnBhbmVsT3BlbiQuYXNPYnNlcnZhYmxlKCk7XHJcbiAgcmVhZG9ubHkgYWN0aXZlVmlldyA9IHRoaXMuYWN0aXZlVmlldyQuYXNPYnNlcnZhYmxlKCk7XHJcbiAgcmVhZG9ubHkgYWN0aXZlQ29udmVyc2F0aW9uSWQgPSB0aGlzLmFjdGl2ZUNvbnZlcnNhdGlvbklkJC5hc09ic2VydmFibGUoKTtcclxuICByZWFkb25seSB0b3RhbFVucmVhZCA9IHRoaXMudG90YWxVbnJlYWQkLmFzT2JzZXJ2YWJsZSgpO1xyXG4gIHJlYWRvbmx5IGxvYWRpbmdNZXNzYWdlcyA9IHRoaXMubG9hZGluZ01lc3NhZ2VzJC5hc09ic2VydmFibGUoKTtcclxuICB3c1N0YXR1czogT2JzZXJ2YWJsZTxzdHJpbmc+ID0gbmV3IE9ic2VydmFibGU8c3RyaW5nPigpO1xyXG4gIHJlYWRvbmx5IHBhbmVsUG9zaXRpb24gPSB0aGlzLnBhbmVsUG9zaXRpb24kLmFzT2JzZXJ2YWJsZSgpO1xyXG4gIHJlYWRvbmx5IHBhbmVsU2l6ZSA9IHRoaXMucGFuZWxTaXplJC5hc09ic2VydmFibGUoKTtcclxuICByZWFkb25seSB3YXNPcGVuQmVmb3JlRHJhZyA9IHRoaXMud2FzT3BlbkJlZm9yZURyYWckLmFzT2JzZXJ2YWJsZSgpO1xyXG4gIHJlYWRvbmx5IHNpZGViYXJTaWRlID0gdGhpcy5zaWRlYmFyU2lkZSQuYXNPYnNlcnZhYmxlKCk7XHJcblxyXG4gIHByaXZhdGUgd3NTdWI6IFN1YnNjcmlwdGlvbiB8IG51bGwgPSBudWxsO1xyXG4gIHByaXZhdGUgZGVzdHJveSQgPSBuZXcgU3ViamVjdDx2b2lkPigpO1xyXG4gIHByaXZhdGUgcG9sbFRpbWVyOiBhbnkgPSBudWxsO1xyXG4gIHByaXZhdGUgZ3JvdXBTZXR0aW5ncyQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PHsgY29udmVyc2F0aW9uSWQ6IHN0cmluZzsgbmFtZTogc3RyaW5nIH0gfCBudWxsPihudWxsKTtcclxuXHJcbiAgcmVhZG9ubHkgZ3JvdXBTZXR0aW5ncyA9IHRoaXMuZ3JvdXBTZXR0aW5ncyQuYXNPYnNlcnZhYmxlKCk7XHJcblxyXG4gIGNvbnN0cnVjdG9yKFxyXG4gICAgcHJpdmF0ZSBhdXRoOiBBdXRoU2VydmljZSxcclxuICAgIHByaXZhdGUgYXBpOiBNZXNzYWdpbmdBcGlTZXJ2aWNlLFxyXG4gICAgcHJpdmF0ZSB3c1NlcnZpY2U6IE1lc3NhZ2luZ1dlYlNvY2tldFNlcnZpY2VcclxuICApIHtcclxuICAgICh0aGlzIGFzIGFueSkud3NTdGF0dXMgPSB0aGlzLndzU2VydmljZS5zdGF0dXMkO1xyXG4gIH1cclxuXHJcbiAgLy8g4pSA4pSAIEluaXRpYWxpemF0aW9uIOKUgOKUgFxyXG4gIGluaXRpYWxpemUoKTogdm9pZCB7XHJcbiAgICBpZiAoIXRoaXMuYXV0aC5pc0F1dGhlbnRpY2F0ZWQoKSkgcmV0dXJuO1xyXG5cclxuICAgIGNvbnN0IGNvbnRhY3RJZCA9IHRoaXMuYXV0aC5jb250YWN0SWQhO1xyXG4gICAgY29uc3Qgc2Vzc2lvbkdpZCA9IHRoaXMuYXV0aC5zZXNzaW9uR2lkITtcclxuXHJcbiAgICB0aGlzLmxvYWRJbmJveCgpO1xyXG4gICAgdGhpcy5sb2FkVmlzaWJsZUNvbnRhY3RzKCk7XHJcblxyXG4gICAgdGhpcy53c1NlcnZpY2UuY29ubmVjdChjb250YWN0SWQsIHNlc3Npb25HaWQpO1xyXG4gICAgdGhpcy5saXN0ZW5XZWJTb2NrZXQoKTtcclxuICAgIHRoaXMuc3RhcnRQb2xsaW5nKCk7XHJcbiAgfVxyXG5cclxuICB0ZWFyZG93bigpOiB2b2lkIHtcclxuICAgIHRoaXMuc3RvcFBvbGxpbmcoKTtcclxuICAgIHRoaXMud3NTZXJ2aWNlLmRpc2Nvbm5lY3QoKTtcclxuICAgIHRoaXMud3NTdWI/LnVuc3Vic2NyaWJlKCk7XHJcbiAgICB0aGlzLmluYm94JC5uZXh0KFtdKTtcclxuICAgIHRoaXMubWVzc2FnZXNNYXAkLm5leHQobmV3IE1hcCgpKTtcclxuICAgIHRoaXMub3BlbkNoYXRzJC5uZXh0KFtdKTtcclxuICAgIHRoaXMucGFuZWxPcGVuJC5uZXh0KGZhbHNlKTtcclxuICAgIHRoaXMuYWN0aXZlVmlldyQubmV4dCgnaW5ib3gnKTtcclxuICAgIHRoaXMuYWN0aXZlQ29udmVyc2F0aW9uSWQkLm5leHQobnVsbCk7XHJcbiAgICB0aGlzLnRvdGFsVW5yZWFkJC5uZXh0KDApO1xyXG4gIH1cclxuXHJcbiAgLy8g4pSA4pSAIFBvbGxpbmcgZmFsbGJhY2sgKGluYm94IG9ubHkgLSBtZXNzYWdlcyByZWx5IG9uIFdlYlNvY2tldCkg4pSA4pSAXHJcbiAgcHJpdmF0ZSBzdGFydFBvbGxpbmcoKTogdm9pZCB7XHJcbiAgICB0aGlzLnN0b3BQb2xsaW5nKCk7XHJcbiAgICB0aGlzLnBvbGxUaW1lciA9IHNldEludGVydmFsKCgpID0+IHtcclxuICAgICAgdGhpcy5sb2FkSW5ib3goKTtcclxuICAgIH0sIDMwMDAwKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgc3RvcFBvbGxpbmcoKTogdm9pZCB7XHJcbiAgICBpZiAodGhpcy5wb2xsVGltZXIpIHtcclxuICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLnBvbGxUaW1lcik7XHJcbiAgICAgIHRoaXMucG9sbFRpbWVyID0gbnVsbDtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIG5nT25EZXN0cm95KCk6IHZvaWQge1xyXG4gICAgdGhpcy50ZWFyZG93bigpO1xyXG4gICAgdGhpcy5kZXN0cm95JC5uZXh0KCk7XHJcbiAgICB0aGlzLmRlc3Ryb3kkLmNvbXBsZXRlKCk7XHJcbiAgfVxyXG5cclxuICAvLyDilIDilIAgUGFuZWwgY29udHJvbHMg4pSA4pSAXHJcbiAgdG9nZ2xlUGFuZWwoYnV0dG9uWD86IG51bWJlciwgYnV0dG9uWT86IG51bWJlcik6IHZvaWQge1xyXG4gICAgaWYgKGJ1dHRvblggIT09IHVuZGVmaW5lZCAmJiBidXR0b25ZICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgdGhpcy5wYW5lbFBvc2l0aW9uJC5uZXh0KHsgeDogYnV0dG9uWCwgeTogYnV0dG9uWSB9KTtcclxuICAgIH1cclxuICAgIHRoaXMucGFuZWxPcGVuJC5uZXh0KCF0aGlzLnBhbmVsT3BlbiQudmFsdWUpO1xyXG4gIH1cclxuXHJcbiAgb3BlblBhbmVsKGJ1dHRvblg/OiBudW1iZXIsIGJ1dHRvblk/OiBudW1iZXIpOiB2b2lkIHtcclxuICAgIGlmIChidXR0b25YICE9PSB1bmRlZmluZWQgJiYgYnV0dG9uWSAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgIHRoaXMucGFuZWxQb3NpdGlvbiQubmV4dCh7IHg6IGJ1dHRvblgsIHk6IGJ1dHRvblkgfSk7XHJcbiAgICB9XHJcbiAgICB0aGlzLnBhbmVsT3BlbiQubmV4dCh0cnVlKTtcclxuICB9XHJcblxyXG4gIGNsb3NlUGFuZWwoKTogdm9pZCB7XHJcbiAgICB0aGlzLnBhbmVsT3BlbiQubmV4dChmYWxzZSk7XHJcbiAgfVxyXG5cclxuICBzZXRQYW5lbFNpemUod2lkdGg6IG51bWJlciwgaGVpZ2h0OiBudW1iZXIpOiB2b2lkIHtcclxuICAgIHRoaXMucGFuZWxTaXplJC5uZXh0KHsgd2lkdGgsIGhlaWdodCB9KTtcclxuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdtZXNzYWdpbmdfcGFuZWxfc2l6ZScsIEpTT04uc3RyaW5naWZ5KHsgd2lkdGgsIGhlaWdodCB9KSk7XHJcbiAgfVxyXG5cclxuICBnZXRQYW5lbFNpemUoKTogeyB3aWR0aDogbnVtYmVyOyBoZWlnaHQ6IG51bWJlciB9IHtcclxuICAgIGNvbnN0IHNhdmVkID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ21lc3NhZ2luZ19wYW5lbF9zaXplJyk7XHJcbiAgICBpZiAoc2F2ZWQpIHtcclxuICAgICAgdHJ5IHtcclxuICAgICAgICBjb25zdCBwYXJzZWQgPSBKU09OLnBhcnNlKHNhdmVkKTtcclxuICAgICAgICBpZiAocGFyc2VkLndpZHRoICYmIHBhcnNlZC5oZWlnaHQpIHtcclxuICAgICAgICAgIHRoaXMucGFuZWxTaXplJC5uZXh0KHBhcnNlZCk7XHJcbiAgICAgICAgICByZXR1cm4gcGFyc2VkO1xyXG4gICAgICAgIH1cclxuICAgICAgfSBjYXRjaCB7fVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIHRoaXMucGFuZWxTaXplJC52YWx1ZTtcclxuICB9XHJcblxyXG4gIG9uQnV0dG9uRHJhZ1N0YXJ0KCk6IHZvaWQge1xyXG4gICAgdGhpcy53YXNPcGVuQmVmb3JlRHJhZyQubmV4dCh0aGlzLnBhbmVsT3BlbiQudmFsdWUpO1xyXG4gICAgaWYgKHRoaXMucGFuZWxPcGVuJC52YWx1ZSkge1xyXG4gICAgICB0aGlzLnBhbmVsT3BlbiQubmV4dChmYWxzZSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBvbkJ1dHRvbkRyYWdFbmQoYnV0dG9uWDogbnVtYmVyLCBidXR0b25ZOiBudW1iZXIpOiB2b2lkIHtcclxuICAgIGlmICh0aGlzLndhc09wZW5CZWZvcmVEcmFnJC52YWx1ZSkge1xyXG4gICAgICB0aGlzLm9wZW5QYW5lbChidXR0b25YLCBidXR0b25ZKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHNldFZpZXcodmlldzogJ2luYm94JyB8ICdjaGF0JyB8ICduZXctY29udmVyc2F0aW9uJyB8ICdncm91cC1tYW5hZ2VyJyB8ICdjb252ZXJzYXRpb24tc2V0dGluZ3MnKTogdm9pZCB7XHJcbiAgICB0aGlzLmFjdGl2ZVZpZXckLm5leHQodmlldyk7XHJcbiAgfVxyXG5cclxuICB0b2dnbGVTaWRlYmFyU2lkZSgpOiB2b2lkIHtcclxuICAgIGNvbnN0IG5leHQgPSB0aGlzLnNpZGViYXJTaWRlJC52YWx1ZSA9PT0gJ3JpZ2h0JyA/ICdsZWZ0JyA6ICdyaWdodCc7XHJcbiAgICB0aGlzLnNpZGViYXJTaWRlJC5uZXh0KG5leHQpO1xyXG4gICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ21lc3NhZ2luZ19zaWRlYmFyX3NpZGUnLCBuZXh0KTtcclxuICB9XHJcblxyXG4gIGdldFNpZGViYXJTaWRlKCk6IFNpZGViYXJTaWRlIHtcclxuICAgIHJldHVybiB0aGlzLnNpZGViYXJTaWRlJC52YWx1ZTtcclxuICB9XHJcblxyXG4gIC8vIOKUgOKUgCBJbmJveCDilIDilIBcclxuICBsb2FkSW5ib3goKTogdm9pZCB7XHJcbiAgICBjb25zdCBjb250YWN0SWQgPSB0aGlzLmF1dGguY29udGFjdElkO1xyXG4gICAgaWYgKCFjb250YWN0SWQpIHJldHVybjtcclxuXHJcbiAgICB0aGlzLmFwaS5nZXRJbmJveChjb250YWN0SWQpLnN1YnNjcmliZSh7XHJcbiAgICAgIG5leHQ6IChpdGVtcykgPT4ge1xyXG4gICAgICAgIGNvbnN0IG1hcHBlZCA9IGl0ZW1zLm1hcChpdGVtID0+IHtcclxuICAgICAgICAgIGNvbnN0IGlzR3JvdXAgPSBpdGVtLmlzX2dyb3VwID09PSB0cnVlIHx8IChpdGVtLmlzX2dyb3VwIGFzIGFueSkgPT09ICdUcnVlJztcclxuICAgICAgICAgIFxyXG4gICAgICAgICAgaWYgKCFpc0dyb3VwICYmICFpdGVtLm5hbWUgJiYgaXRlbS5vdGhlcl9wYXJ0aWNpcGFudF9uYW1lKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB7IC4uLml0ZW0sIG5hbWU6IGl0ZW0ub3RoZXJfcGFydGljaXBhbnRfbmFtZSwgaXNfZ3JvdXA6IGZhbHNlIH07XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICByZXR1cm4geyAuLi5pdGVtLCBpc19ncm91cDogaXNHcm91cCB9O1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIHRoaXMuaW5ib3gkLm5leHQobWFwcGVkKTtcclxuICAgICAgICB0aGlzLnJlY2FsY1VucmVhZChtYXBwZWQpO1xyXG5cclxuICAgICAgICBjb25zdCBpZHMgPSBtYXBwZWQubWFwKChpKSA9PiBpLmNvbnZlcnNhdGlvbl9pZCk7XHJcbiAgICAgICAgdGhpcy53c1NlcnZpY2Uuc3Vic2NyaWJlQWxsKGlkcyk7XHJcbiAgICAgIH0sXHJcbiAgICAgIGVycm9yOiAoKSA9PiB7fSxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLy8g4pSA4pSAIENvbnRhY3RzIOKUgOKUgFxyXG4gIGxvYWRWaXNpYmxlQ29udGFjdHMoKTogdm9pZCB7XHJcbiAgICBjb25zdCBjb250YWN0SWQgPSB0aGlzLmF1dGguY29udGFjdElkO1xyXG4gICAgaWYgKCFjb250YWN0SWQpIHJldHVybjtcclxuXHJcbiAgICB0aGlzLmFwaS5nZXRWaXNpYmxlQ29udGFjdHMoY29udGFjdElkKS5zdWJzY3JpYmUoe1xyXG4gICAgICBuZXh0OiAoY29udGFjdHMpID0+IHtcclxuICAgICAgICB0aGlzLnZpc2libGVDb250YWN0cyQubmV4dChjb250YWN0cyk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgY29uc3QgY3VycmVudENvbnRhY3QgPSB0aGlzLmF1dGguY3VycmVudENvbnRhY3Q7XHJcbiAgICAgICAgaWYgKGN1cnJlbnRDb250YWN0ICYmIGN1cnJlbnRDb250YWN0LmVtYWlsKSB7XHJcbiAgICAgICAgICBjb25zdCBtYXRjaCA9IGNvbnRhY3RzLmZpbmQoYyA9PiBjLmVtYWlsID09PSBjdXJyZW50Q29udGFjdC5lbWFpbCk7XHJcbiAgICAgICAgICBpZiAobWF0Y2ggJiYgbWF0Y2guY29udGFjdF9pZCAhPT0gY3VycmVudENvbnRhY3QuY29udGFjdF9pZCkge1xyXG4gICAgICAgICAgICB0aGlzLmF1dGguc2V0U2Vzc2lvbih0aGlzLmF1dGguc2Vzc2lvbkdpZCEsIHsgLi4uY3VycmVudENvbnRhY3QsIGNvbnRhY3RfaWQ6IG1hdGNoLmNvbnRhY3RfaWQgfSk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB0aGlzLndzU2VydmljZS5kaXNjb25uZWN0KCk7XHJcbiAgICAgICAgICAgIHRoaXMud3NTZXJ2aWNlLmNvbm5lY3QobWF0Y2guY29udGFjdF9pZCwgdGhpcy5hdXRoLnNlc3Npb25HaWQhKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgIH0sXHJcbiAgICAgIGVycm9yOiAoKSA9PiB7fSxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLy8g4pSA4pSAIENvbnZlcnNhdGlvbnMg4pSA4pSAXHJcbiAgb3BlbkNvbnZlcnNhdGlvbihjb252ZXJzYXRpb25JZDogc3RyaW5nLCBuYW1lOiBzdHJpbmcsIGlzR3JvdXAgPSBmYWxzZSk6IHZvaWQge1xyXG4gICAgaWYgKCFjb252ZXJzYXRpb25JZCB8fCBjb252ZXJzYXRpb25JZCA9PT0gJ3VuZGVmaW5lZCcpIHtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgdGhpcy5hY3RpdmVDb252ZXJzYXRpb25JZCQubmV4dChjb252ZXJzYXRpb25JZCk7XHJcbiAgICB0aGlzLmFjdGl2ZVZpZXckLm5leHQoJ2NoYXQnKTtcclxuICAgIHRoaXMub3BlblBhbmVsKCk7XHJcblxyXG4gICAgY29uc3QgY2hhdHMgPSB0aGlzLm9wZW5DaGF0cyQudmFsdWU7XHJcbiAgICBpZiAoIWNoYXRzLmZpbmQoKGMpID0+IGMuY29udmVyc2F0aW9uSWQgPT09IGNvbnZlcnNhdGlvbklkKSkge1xyXG4gICAgICB0aGlzLm9wZW5DaGF0cyQubmV4dChbXHJcbiAgICAgICAgLi4uY2hhdHMsXHJcbiAgICAgICAgeyBjb252ZXJzYXRpb25JZCwgbmFtZSwgaXNHcm91cCwgaXNNaW5pbWl6ZWQ6IGZhbHNlLCB1bnJlYWRDb3VudDogMCB9LFxyXG4gICAgICBdKTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBleGlzdGluZyA9IHRoaXMubWVzc2FnZXNNYXAkLnZhbHVlLmdldChjb252ZXJzYXRpb25JZCk7XHJcbiAgICBpZiAoZXhpc3RpbmcgJiYgZXhpc3RpbmcubGVuZ3RoID4gMCkge1xyXG4gICAgICAvLyBBbHJlYWR5IGNhY2hlZCDigJQgc2lsZW50IGJhY2tncm91bmQgcmVmcmVzaCBmb3IgbmV3IG1lc3NhZ2VzLCBza2lwIHJlYWN0aW9uIGh5ZHJhdGlvblxyXG4gICAgICB0aGlzLmxvYWRNZXNzYWdlcyhjb252ZXJzYXRpb25JZCwgdW5kZWZpbmVkLCB0cnVlKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHRoaXMubG9hZE1lc3NhZ2VzKGNvbnZlcnNhdGlvbklkKTtcclxuICAgIH1cclxuICAgIHRoaXMubWFya0FzUmVhZChjb252ZXJzYXRpb25JZCk7XHJcbiAgICB0aGlzLndzU2VydmljZS5zdWJzY3JpYmUoY29udmVyc2F0aW9uSWQpO1xyXG4gIH1cclxuXHJcbiAgY2xvc2VDaGF0KGNvbnZlcnNhdGlvbklkOiBzdHJpbmcpOiB2b2lkIHtcclxuICAgIGNvbnN0IGNoYXRzID0gdGhpcy5vcGVuQ2hhdHMkLnZhbHVlLmZpbHRlcigoYykgPT4gYy5jb252ZXJzYXRpb25JZCAhPT0gY29udmVyc2F0aW9uSWQpO1xyXG4gICAgdGhpcy5vcGVuQ2hhdHMkLm5leHQoY2hhdHMpO1xyXG5cclxuICAgIGlmICh0aGlzLmFjdGl2ZUNvbnZlcnNhdGlvbklkJC52YWx1ZSA9PT0gY29udmVyc2F0aW9uSWQpIHtcclxuICAgICAgdGhpcy5hY3RpdmVDb252ZXJzYXRpb25JZCQubmV4dChudWxsKTtcclxuICAgICAgdGhpcy5hY3RpdmVWaWV3JC5uZXh0KCdpbmJveCcpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLy8g4pSA4pSAIE1lc3NhZ2VzIOKUgOKUgFxyXG4gIGxvYWRNZXNzYWdlcyhjb252ZXJzYXRpb25JZDogc3RyaW5nLCBiZWZvcmVNZXNzYWdlSWQ/OiBzdHJpbmcsIHNraXBSZWFjdGlvbkh5ZHJhdGlvbiA9IGZhbHNlKTogdm9pZCB7XHJcbiAgICBpZiAoIWNvbnZlcnNhdGlvbklkIHx8IGNvbnZlcnNhdGlvbklkID09PSAndW5kZWZpbmVkJykge1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICBjb25zdCBjb250YWN0SWQgPSB0aGlzLmF1dGguY29udGFjdElkO1xyXG4gICAgaWYgKCFjb250YWN0SWQpIHJldHVybjtcclxuXHJcbiAgICB0aGlzLmxvYWRpbmdNZXNzYWdlcyQubmV4dCh0cnVlKTtcclxuXHJcbiAgICB0aGlzLmFwaS5nZXRNZXNzYWdlcyhjb252ZXJzYXRpb25JZCwgY29udGFjdElkLCBiZWZvcmVNZXNzYWdlSWQsIDUwKS5zdWJzY3JpYmUoe1xyXG4gICAgICBuZXh0OiAobWVzc2FnZXMpID0+IHtcclxuICAgICAgICBjb25zdCBtYXAgPSBuZXcgTWFwKHRoaXMubWVzc2FnZXNNYXAkLnZhbHVlKTtcclxuICAgICAgICBjb25zdCBleGlzdGluZyA9IG1hcC5nZXQoY29udmVyc2F0aW9uSWQpIHx8IFtdO1xyXG5cclxuICAgICAgICBjb25zdCBub3JtYWxpemVkID0gbWVzc2FnZXMubWFwKChtOiBhbnkpID0+IHRoaXMubm9ybWFsaXplTWVzc2FnZVNoYXBlKG0pKTtcclxuICAgICAgICBjb25zdCBzb3J0ZWQgPSBbLi4ubm9ybWFsaXplZF0uc29ydCgoYSwgYikgPT4gXHJcbiAgICAgICAgICBuZXcgRGF0ZShhLmNyZWF0ZWRfYXQpLmdldFRpbWUoKSAtIG5ldyBEYXRlKGIuY3JlYXRlZF9hdCkuZ2V0VGltZSgpXHJcbiAgICAgICAgKTtcclxuXHJcbiAgICAgICAgaWYgKGJlZm9yZU1lc3NhZ2VJZCkge1xyXG4gICAgICAgICAgLy8gUHJlcGVuZCBvbGRlciBtZXNzYWdlcywgcHJlc2VydmluZyBleGlzdGluZyByZWFjdGlvbnNcclxuICAgICAgICAgIGNvbnN0IG1lcmdlZCA9IFsuLi5zb3J0ZWQsIC4uLmV4aXN0aW5nXTtcclxuICAgICAgICAgIG1hcC5zZXQoY29udmVyc2F0aW9uSWQsIG1lcmdlZCk7XHJcbiAgICAgICAgfSBlbHNlIGlmIChza2lwUmVhY3Rpb25IeWRyYXRpb24pIHtcclxuICAgICAgICAgIC8vIFNpbGVudCByZWZyZXNoIOKAlCBtZXJnZSBuZXcgbWVzc2FnZXMgYnV0IHByZXNlcnZlIGV4aXN0aW5nIHJlYWN0aW9uIHN0YXRlXHJcbiAgICAgICAgICBjb25zdCBleGlzdGluZ0J5SWQgPSBuZXcgTWFwKGV4aXN0aW5nLm1hcChtID0+IFtTdHJpbmcobS5tZXNzYWdlX2lkKSwgbV0pKTtcclxuICAgICAgICAgIGNvbnN0IG1lcmdlZCA9IHNvcnRlZC5tYXAobSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnN0IGNhY2hlZCA9IGV4aXN0aW5nQnlJZC5nZXQoU3RyaW5nKG0ubWVzc2FnZV9pZCkpO1xyXG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkID8geyAuLi5tLCByZWFjdGlvbnM6IGNhY2hlZC5yZWFjdGlvbnMgfSA6IG07XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICAgIG1hcC5zZXQoY29udmVyc2F0aW9uSWQsIG1lcmdlZCk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIG1hcC5zZXQoY29udmVyc2F0aW9uSWQsIHNvcnRlZCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aGlzLm1lc3NhZ2VzTWFwJC5uZXh0KG1hcCk7XHJcbiAgICAgICAgaWYgKCFza2lwUmVhY3Rpb25IeWRyYXRpb24pIHtcclxuICAgICAgICAgIHRoaXMuaHlkcmF0ZVJlYWN0aW9uc0ZvckNvbnZlcnNhdGlvbihjb252ZXJzYXRpb25JZCwgbWFwLmdldChjb252ZXJzYXRpb25JZCkgfHwgW10pO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLmxvYWRpbmdNZXNzYWdlcyQubmV4dChmYWxzZSk7XHJcbiAgICAgIH0sXHJcbiAgICAgIGVycm9yOiAoKSA9PiB7XHJcbiAgICAgICAgdGhpcy5sb2FkaW5nTWVzc2FnZXMkLm5leHQoZmFsc2UpO1xyXG4gICAgICB9LFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBzZW5kTWVzc2FnZShjb252ZXJzYXRpb25JZDogc3RyaW5nIHwgbnVsbCwgY29udGVudDogc3RyaW5nLCBtZXNzYWdlVHlwZTogJ1RFWFQnIHwgJ0lNQUdFJyA9ICdURVhUJyk6IHZvaWQge1xyXG4gICAgY29uc3QgY29udGFjdElkID0gdGhpcy5hdXRoLmNvbnRhY3RJZDtcclxuICAgIGlmICghY29udGFjdElkKSByZXR1cm47XHJcblxyXG4gICAgY29uc3QgcGVuZGluZyA9IHRoaXMucGVuZGluZ0RtUmVjaXBpZW50JC52YWx1ZTtcclxuICAgIGlmICghY29udmVyc2F0aW9uSWQgJiYgcGVuZGluZykge1xyXG4gICAgICB0aGlzLnNlbmREaXJlY3RNZXNzYWdlKHBlbmRpbmcuY29udGFjdElkLCBjb250ZW50KTtcclxuICAgICAgdGhpcy5wZW5kaW5nRG1SZWNpcGllbnQkLm5leHQobnVsbCk7XHJcbiAgICAgIGNvbnN0IGNoYXRzID0gdGhpcy5vcGVuQ2hhdHMkLnZhbHVlLmZpbHRlcihjID0+IGMuY29udmVyc2F0aW9uSWQgIT09ICdwZW5kaW5nJyk7XHJcbiAgICAgIHRoaXMub3BlbkNoYXRzJC5uZXh0KGNoYXRzKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICghY29udmVyc2F0aW9uSWQpIHJldHVybjtcclxuXHJcbiAgICB0aGlzLmFwaS5zZW5kTWVzc2FnZShjb252ZXJzYXRpb25JZCwgY29udGFjdElkLCBjb250ZW50LCBtZXNzYWdlVHlwZSkuc3Vic2NyaWJlKHtcclxuICAgICAgbmV4dDogKHJlcykgPT4ge1xyXG4gICAgICAgIGNvbnN0IG9wdGltaXN0aWM6IE1lc3NhZ2UgPSB7XHJcbiAgICAgICAgICBtZXNzYWdlX2lkOiAndGVtcC0nICsgRGF0ZS5ub3coKSxcclxuICAgICAgICAgIGNvbnZlcnNhdGlvbl9pZDogY29udmVyc2F0aW9uSWQsXHJcbiAgICAgICAgICBzZW5kZXJfaWQ6IGNvbnRhY3RJZCxcclxuICAgICAgICAgIHNlbmRlcl9uYW1lOiAnWW91JyxcclxuICAgICAgICAgIG1lc3NhZ2VfdHlwZTogbWVzc2FnZVR5cGUsXHJcbiAgICAgICAgICBjb250ZW50LFxyXG4gICAgICAgICAgY3JlYXRlZF9hdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxyXG4gICAgICAgICAgaXNfcmVhZDogdHJ1ZSxcclxuICAgICAgICB9O1xyXG4gICAgICAgIHRoaXMuYXBwZW5kTWVzc2FnZShvcHRpbWlzdGljKTtcclxuICAgICAgfSxcclxuICAgICAgZXJyb3I6ICgpID0+IHt9LFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBvcGVuRGlyZWN0Q29udmVyc2F0aW9uKHJlY2lwaWVudENvbnRhY3RJZDogc3RyaW5nLCBkaXNwbGF5TmFtZTogc3RyaW5nKTogdm9pZCB7XHJcbiAgICBjb25zdCBleGlzdGluZyA9IHRoaXMuaW5ib3gkLnZhbHVlLmZpbmQoaXRlbSA9PiBcclxuICAgICAgIWl0ZW0uaXNfZ3JvdXAgJiYgaXRlbS5uYW1lID09PSBkaXNwbGF5TmFtZVxyXG4gICAgKTtcclxuICAgIFxyXG4gICAgaWYgKGV4aXN0aW5nKSB7XHJcbiAgICAgIHRoaXMucGVuZGluZ0RtUmVjaXBpZW50JC5uZXh0KG51bGwpO1xyXG4gICAgICB0aGlzLm9wZW5Db252ZXJzYXRpb24oZXhpc3RpbmcuY29udmVyc2F0aW9uX2lkLCBkaXNwbGF5TmFtZSwgZmFsc2UpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgdGhpcy5wZW5kaW5nRG1SZWNpcGllbnQkLm5leHQoe2NvbnRhY3RJZDogcmVjaXBpZW50Q29udGFjdElkLCBuYW1lOiBkaXNwbGF5TmFtZX0pO1xyXG4gICAgICB0aGlzLmFjdGl2ZUNvbnZlcnNhdGlvbklkJC5uZXh0KG51bGwpO1xyXG4gICAgICB0aGlzLmFjdGl2ZVZpZXckLm5leHQoJ2NoYXQnKTtcclxuICAgICAgdGhpcy5vcGVuUGFuZWwoKTtcclxuICAgICAgXHJcbiAgICAgIGNvbnN0IGNoYXRzID0gdGhpcy5vcGVuQ2hhdHMkLnZhbHVlO1xyXG4gICAgICBpZiAoIWNoYXRzLmZpbmQoYyA9PiBjLmNvbnZlcnNhdGlvbklkID09PSAncGVuZGluZycpKSB7XHJcbiAgICAgICAgdGhpcy5vcGVuQ2hhdHMkLm5leHQoWy4uLmNoYXRzLCB7XHJcbiAgICAgICAgICBjb252ZXJzYXRpb25JZDogJ3BlbmRpbmcnLFxyXG4gICAgICAgICAgbmFtZTogZGlzcGxheU5hbWUsXHJcbiAgICAgICAgICBpc0dyb3VwOiBmYWxzZSxcclxuICAgICAgICAgIGlzTWluaW1pemVkOiBmYWxzZSxcclxuICAgICAgICAgIHVucmVhZENvdW50OiAwXHJcbiAgICAgICAgfV0pO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBzZW5kRGlyZWN0TWVzc2FnZShyZWNpcGllbnRDb250YWN0SWQ6IHN0cmluZywgY29udGVudDogc3RyaW5nKTogdm9pZCB7XHJcbiAgICBjb25zdCBjb250YWN0SWQgPSB0aGlzLmF1dGguY29udGFjdElkO1xyXG4gICAgaWYgKCFjb250YWN0SWQpIHJldHVybjtcclxuXHJcbiAgICB0aGlzLmFwaS5zZW5kRGlyZWN0TWVzc2FnZShjb250YWN0SWQsIHJlY2lwaWVudENvbnRhY3RJZCwgY29udGVudCkuc3Vic2NyaWJlKHtcclxuICAgICAgbmV4dDogKHJlcykgPT4ge1xyXG4gICAgICAgIHRoaXMubG9hZEluYm94KCk7XHJcbiAgICAgICAgLy8gQmFja2VuZCBtYXkgcmV0dXJuIGNvbnZlcnNhdGlvbl9pZCwgaWQsIG9yIGNvbnZlcnNhdGlvbklkXHJcbiAgICAgICAgY29uc3QgY29udklkID0gU3RyaW5nKHJlcz8uY29udmVyc2F0aW9uX2lkIHx8IHJlcz8uaWQgfHwgcmVzPy5jb252ZXJzYXRpb25JZCB8fCAnJyk7XHJcbiAgICAgICAgaWYgKGNvbnZJZCkge1xyXG4gICAgICAgICAgY29uc3QgcmVjaXBpZW50ID0gdGhpcy52aXNpYmxlQ29udGFjdHMkLnZhbHVlLmZpbmQoXHJcbiAgICAgICAgICAgIChjKSA9PiBjLmNvbnRhY3RfaWQgPT09IHJlY2lwaWVudENvbnRhY3RJZFxyXG4gICAgICAgICAgKTtcclxuICAgICAgICAgIGNvbnN0IG5hbWUgPSByZWNpcGllbnQgPyBnZXRDb250YWN0RGlzcGxheU5hbWUocmVjaXBpZW50KSA6ICdEaXJlY3QgTWVzc2FnZSc7XHJcbiAgICAgICAgICB0aGlzLm9wZW5Db252ZXJzYXRpb24oY29udklkLCBuYW1lLCBmYWxzZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9LFxyXG4gICAgICBlcnJvcjogKCkgPT4ge30sXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIGNyZWF0ZUdyb3VwQ29udmVyc2F0aW9uKHBhcnRpY2lwYW50SWRzOiBzdHJpbmdbXSwgbmFtZTogc3RyaW5nKTogdm9pZCB7XHJcbiAgICBjb25zdCBjb250YWN0SWQgPSB0aGlzLmF1dGguY29udGFjdElkO1xyXG4gICAgaWYgKCFjb250YWN0SWQpIHJldHVybjtcclxuXHJcbiAgICBjb25zdCBhbGxQYXJ0aWNpcGFudHMgPSBwYXJ0aWNpcGFudElkcy5pbmNsdWRlcyhjb250YWN0SWQpXHJcbiAgICAgID8gcGFydGljaXBhbnRJZHNcclxuICAgICAgOiBbY29udGFjdElkLCAuLi5wYXJ0aWNpcGFudElkc107XHJcblxyXG4gICAgdGhpcy5hcGkuY3JlYXRlQ29udmVyc2F0aW9uKGNvbnRhY3RJZCwgYWxsUGFydGljaXBhbnRzLCBuYW1lKS5zdWJzY3JpYmUoe1xyXG4gICAgICBuZXh0OiAoY29udikgPT4ge1xyXG4gICAgICAgIC8vIEJhY2tlbmQgbWF5IHJldHVybiBjb252ZXJzYXRpb25faWQsIGlkLCBvciBjb252ZXJzYXRpb25JZFxyXG4gICAgICAgIGNvbnN0IGNvbnZJZCA9IFN0cmluZygoY29udiBhcyBhbnkpPy5jb252ZXJzYXRpb25faWQgfHwgKGNvbnYgYXMgYW55KT8uaWQgfHwgKGNvbnYgYXMgYW55KT8uY29udmVyc2F0aW9uSWQgfHwgJycpO1xyXG4gICAgICAgIGlmICghY29udklkKSB7XHJcbiAgICAgICAgICB0aGlzLmxvYWRJbmJveCgpO1xyXG4gICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLmxvYWRJbmJveCgpO1xyXG4gICAgICAgIHRoaXMub3BlbkNvbnZlcnNhdGlvbihjb252SWQsIG5hbWUsIHRydWUpO1xyXG4gICAgICB9LFxyXG4gICAgICBlcnJvcjogKCkgPT4ge30sXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIG9wZW5Hcm91cFNldHRpbmdzKGNvbnZlcnNhdGlvbklkOiBzdHJpbmcsIG5hbWU6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgdGhpcy5ncm91cFNldHRpbmdzJC5uZXh0KHsgY29udmVyc2F0aW9uSWQsIG5hbWUgfSk7XHJcbiAgICB0aGlzLnNldFZpZXcoJ2dyb3VwLW1hbmFnZXInKTtcclxuICB9XHJcblxyXG4gIGNsZWFyR3JvdXBTZXR0aW5ncygpOiB2b2lkIHtcclxuICAgIHRoaXMuZ3JvdXBTZXR0aW5ncyQubmV4dChudWxsKTtcclxuICB9XHJcblxyXG4gIG1hcmtBc1JlYWQoY29udmVyc2F0aW9uSWQ6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgaWYgKCFjb252ZXJzYXRpb25JZCB8fCBjb252ZXJzYXRpb25JZCA9PT0gJ3VuZGVmaW5lZCcpIHJldHVybjtcclxuICAgIGNvbnN0IGNvbnRhY3RJZCA9IHRoaXMuYXV0aC5jb250YWN0SWQ7XHJcbiAgICBpZiAoIWNvbnRhY3RJZCkgcmV0dXJuO1xyXG5cclxuICAgIHRoaXMuYXBpLm1hcmtDb252ZXJzYXRpb25SZWFkKGNvbnZlcnNhdGlvbklkLCBjb250YWN0SWQpLnN1YnNjcmliZSh7XHJcbiAgICAgIG5leHQ6ICgpID0+IHtcclxuICAgICAgICBjb25zdCBpdGVtcyA9IHRoaXMuaW5ib3gkLnZhbHVlLm1hcCgoaXRlbSkgPT5cclxuICAgICAgICAgIGl0ZW0uY29udmVyc2F0aW9uX2lkID09PSBjb252ZXJzYXRpb25JZCA/IHsgLi4uaXRlbSwgdW5yZWFkX2NvdW50OiAwIH0gOiBpdGVtXHJcbiAgICAgICAgKTtcclxuICAgICAgICB0aGlzLmluYm94JC5uZXh0KGl0ZW1zKTtcclxuICAgICAgICB0aGlzLnJlY2FsY1VucmVhZChpdGVtcyk7XHJcbiAgICAgIH0sXHJcbiAgICAgIGVycm9yOiAoKSA9PiB7fSxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLy8g4pSA4pSAIEdyb3VwIG1hbmFnZW1lbnQg4pSA4pSAXHJcbiAgbWFuYWdlR3JvdXAoXHJcbiAgICBhY3Rpb246ICdjcmVhdGUnIHwgJ2FkZCcgfCAncmVtb3ZlJyB8ICdyZW5hbWUnLFxyXG4gICAgY29udmVyc2F0aW9uSWQ/OiBzdHJpbmcsXHJcbiAgICBncm91cE5hbWU/OiBzdHJpbmcsXHJcbiAgICBwYXJ0aWNpcGFudENvbnRhY3RJZHM/OiBzdHJpbmdbXVxyXG4gICk6IHZvaWQge1xyXG4gICAgY29uc3QgY29udGFjdElkID0gdGhpcy5hdXRoLmNvbnRhY3RJZDtcclxuICAgIGlmICghY29udGFjdElkKSByZXR1cm47XHJcblxyXG4gICAgdGhpcy5hcGkubWFuYWdlR3JvdXAoY29udGFjdElkLCBhY3Rpb24sIGNvbnZlcnNhdGlvbklkLCBncm91cE5hbWUsIHBhcnRpY2lwYW50Q29udGFjdElkcykuc3Vic2NyaWJlKHtcclxuICAgICAgbmV4dDogKCkgPT4gdGhpcy5sb2FkSW5ib3goKSxcclxuICAgICAgZXJyb3I6ICgpID0+IHt9LFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvLyDilIDilIAgRGVsZXRlIC8gQ2xlYXIg4pSA4pSAXHJcbiAgZGVsZXRlQ29udmVyc2F0aW9uKGNvbnZlcnNhdGlvbklkOiBzdHJpbmcpOiB2b2lkIHtcclxuICAgIGNvbnN0IGNvbnRhY3RJZCA9IHRoaXMuYXV0aC5jb250YWN0SWQ7XHJcbiAgICBpZiAoIWNvbnRhY3RJZCkgcmV0dXJuO1xyXG5cclxuICAgIHRoaXMuYXBpLmRlbGV0ZUNvbnZlcnNhdGlvbihjb252ZXJzYXRpb25JZCwgY29udGFjdElkKS5zdWJzY3JpYmUoe1xyXG4gICAgICBuZXh0OiAoKSA9PiB7XHJcbiAgICAgICAgY29uc3QgaXRlbXMgPSB0aGlzLmluYm94JC52YWx1ZS5maWx0ZXIoaSA9PiBpLmNvbnZlcnNhdGlvbl9pZCAhPT0gY29udmVyc2F0aW9uSWQpO1xyXG4gICAgICAgIHRoaXMuaW5ib3gkLm5leHQoaXRlbXMpO1xyXG4gICAgICAgIHRoaXMucmVjYWxjVW5yZWFkKGl0ZW1zKTtcclxuICAgICAgICBjb25zdCBtYXAgPSBuZXcgTWFwKHRoaXMubWVzc2FnZXNNYXAkLnZhbHVlKTtcclxuICAgICAgICBtYXAuZGVsZXRlKGNvbnZlcnNhdGlvbklkKTtcclxuICAgICAgICB0aGlzLm1lc3NhZ2VzTWFwJC5uZXh0KG1hcCk7XHJcbiAgICAgICAgaWYgKHRoaXMuYWN0aXZlQ29udmVyc2F0aW9uSWQkLnZhbHVlID09PSBjb252ZXJzYXRpb25JZCkge1xyXG4gICAgICAgICAgdGhpcy5hY3RpdmVDb252ZXJzYXRpb25JZCQubmV4dChudWxsKTtcclxuICAgICAgICAgIHRoaXMuYWN0aXZlVmlldyQubmV4dCgnaW5ib3gnKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5jbG9zZUNoYXQoY29udmVyc2F0aW9uSWQpO1xyXG4gICAgICB9LFxyXG4gICAgICBlcnJvcjogKCkgPT4ge30sXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIGNsZWFyQ29udmVyc2F0aW9uKGNvbnZlcnNhdGlvbklkOiBzdHJpbmcpOiB2b2lkIHtcclxuICAgIGNvbnN0IGNvbnRhY3RJZCA9IHRoaXMuYXV0aC5jb250YWN0SWQ7XHJcbiAgICBpZiAoIWNvbnRhY3RJZCkgcmV0dXJuO1xyXG5cclxuICAgIHRoaXMuYXBpLmNsZWFyQ29udmVyc2F0aW9uKGNvbnZlcnNhdGlvbklkLCBjb250YWN0SWQpLnN1YnNjcmliZSh7XHJcbiAgICAgIG5leHQ6ICgpID0+IHtcclxuICAgICAgICBjb25zdCBtYXAgPSBuZXcgTWFwKHRoaXMubWVzc2FnZXNNYXAkLnZhbHVlKTtcclxuICAgICAgICBtYXAuc2V0KGNvbnZlcnNhdGlvbklkLCBbXSk7XHJcbiAgICAgICAgdGhpcy5tZXNzYWdlc01hcCQubmV4dChtYXApO1xyXG4gICAgICAgIGNvbnN0IGl0ZW1zID0gdGhpcy5pbmJveCQudmFsdWUubWFwKGkgPT5cclxuICAgICAgICAgIGkuY29udmVyc2F0aW9uX2lkID09PSBjb252ZXJzYXRpb25JZFxyXG4gICAgICAgICAgICA/IHsgLi4uaSwgbGFzdF9tZXNzYWdlX3ByZXZpZXc6ICcnLCBsYXN0X21lc3NhZ2VfYXQ6IGkubGFzdF9tZXNzYWdlX2F0IH1cclxuICAgICAgICAgICAgOiBpXHJcbiAgICAgICAgKTtcclxuICAgICAgICB0aGlzLmluYm94JC5uZXh0KGl0ZW1zKTtcclxuICAgICAgfSxcclxuICAgICAgZXJyb3I6ICgpID0+IHt9LFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBkZWxldGVHcm91cChjb252ZXJzYXRpb25JZDogc3RyaW5nKTogdm9pZCB7XHJcbiAgICBjb25zdCBjb250YWN0SWQgPSB0aGlzLmF1dGguY29udGFjdElkO1xyXG4gICAgaWYgKCFjb250YWN0SWQpIHJldHVybjtcclxuXHJcbiAgICB0aGlzLmFwaS5kZWxldGVHcm91cChjb252ZXJzYXRpb25JZCwgY29udGFjdElkKS5zdWJzY3JpYmUoe1xyXG4gICAgICBuZXh0OiAoKSA9PiB7XHJcbiAgICAgICAgY29uc3QgaXRlbXMgPSB0aGlzLmluYm94JC52YWx1ZS5maWx0ZXIoaSA9PiBpLmNvbnZlcnNhdGlvbl9pZCAhPT0gY29udmVyc2F0aW9uSWQpO1xyXG4gICAgICAgIHRoaXMuaW5ib3gkLm5leHQoaXRlbXMpO1xyXG4gICAgICAgIHRoaXMucmVjYWxjVW5yZWFkKGl0ZW1zKTtcclxuICAgICAgICBjb25zdCBtYXAgPSBuZXcgTWFwKHRoaXMubWVzc2FnZXNNYXAkLnZhbHVlKTtcclxuICAgICAgICBtYXAuZGVsZXRlKGNvbnZlcnNhdGlvbklkKTtcclxuICAgICAgICB0aGlzLm1lc3NhZ2VzTWFwJC5uZXh0KG1hcCk7XHJcbiAgICAgICAgaWYgKHRoaXMuYWN0aXZlQ29udmVyc2F0aW9uSWQkLnZhbHVlID09PSBjb252ZXJzYXRpb25JZCkge1xyXG4gICAgICAgICAgdGhpcy5hY3RpdmVDb252ZXJzYXRpb25JZCQubmV4dChudWxsKTtcclxuICAgICAgICAgIHRoaXMuYWN0aXZlVmlldyQubmV4dCgnaW5ib3gnKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5jbG9zZUNoYXQoY29udmVyc2F0aW9uSWQpO1xyXG4gICAgICB9LFxyXG4gICAgICBlcnJvcjogKCkgPT4ge30sXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8vIOKUgOKUgCBSZWFjdGlvbnMg4pSA4pSAXHJcbiAgYWRkUmVhY3Rpb24obWVzc2FnZUlkOiBzdHJpbmcsIGVtb2ppOiBzdHJpbmcpOiB2b2lkIHtcclxuICAgIGNvbnN0IGNvbnRhY3RJZCA9IHRoaXMuYXV0aC5jb250YWN0SWQ7XHJcbiAgICBpZiAoIWNvbnRhY3RJZCkgcmV0dXJuO1xyXG5cclxuICAgIC8vIEVuZm9yY2Ugb25lIHJlYWN0aW9uIHBlciB1c2VyIOKAlCByZW1vdmUgYW55IGV4aXN0aW5nIHJlYWN0aW9uIHdpdGggYSBkaWZmZXJlbnQgZW1vamlcclxuICAgIGZvciAoY29uc3QgbXNncyBvZiB0aGlzLm1lc3NhZ2VzTWFwJC52YWx1ZS52YWx1ZXMoKSkge1xyXG4gICAgICBjb25zdCBtc2cgPSBtc2dzLmZpbmQobSA9PiBTdHJpbmcobS5tZXNzYWdlX2lkKSA9PT0gU3RyaW5nKG1lc3NhZ2VJZCkpO1xyXG4gICAgICBpZiAobXNnPy5yZWFjdGlvbnMpIHtcclxuICAgICAgICBmb3IgKGNvbnN0IHIgb2YgbXNnLnJlYWN0aW9ucykge1xyXG4gICAgICAgICAgaWYgKHIuaGFzUmVhY3RlZCAmJiByLmVtb2ppICE9PSBlbW9qaSkge1xyXG4gICAgICAgICAgICB0aGlzLmFwcGx5UmVhY3Rpb25PcHRpbWlzdGljYWxseShtZXNzYWdlSWQsIHIuZW1vamksIGZhbHNlKTtcclxuICAgICAgICAgICAgdGhpcy5hcGkucmVtb3ZlUmVhY3Rpb24obWVzc2FnZUlkLCBjb250YWN0SWQsIHIuZW1vamkpLnN1YnNjcmliZSh7IGVycm9yOiAoKSA9PiB7fSB9KTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgICAgYnJlYWs7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gT3B0aW1pc3RpYyBVSSBzbyB1c2VyIHNlZXMgcmVhY3Rpb24gaW1tZWRpYXRlbHkuXHJcbiAgICB0aGlzLmFwcGx5UmVhY3Rpb25PcHRpbWlzdGljYWxseShtZXNzYWdlSWQsIGVtb2ppLCB0cnVlKTtcclxuXHJcbiAgICB0aGlzLmFwaS5hZGRSZWFjdGlvbihtZXNzYWdlSWQsIGNvbnRhY3RJZCwgZW1vamkpLnN1YnNjcmliZSh7XHJcbiAgICAgIG5leHQ6ICgpID0+IHtcclxuICAgICAgICB0aGlzLnJlZnJlc2hNZXNzYWdlUmVhY3Rpb25zKG1lc3NhZ2VJZCk7XHJcbiAgICAgIH0sXHJcbiAgICAgIGVycm9yOiAoKSA9PiB7XHJcbiAgICAgICAgLy8gUmV2ZXJ0IG9wdGltaXN0aWMgdXBkYXRlIHdoZW4gcmVxdWVzdCBmYWlscy5cclxuICAgICAgICB0aGlzLmFwcGx5UmVhY3Rpb25PcHRpbWlzdGljYWxseShtZXNzYWdlSWQsIGVtb2ppLCBmYWxzZSk7XHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHJlbW92ZVJlYWN0aW9uKG1lc3NhZ2VJZDogc3RyaW5nLCBlbW9qaTogc3RyaW5nKTogdm9pZCB7XHJcbiAgICBjb25zdCBjb250YWN0SWQgPSB0aGlzLmF1dGguY29udGFjdElkO1xyXG4gICAgaWYgKCFjb250YWN0SWQpIHJldHVybjtcclxuXHJcbiAgICAvLyBPcHRpbWlzdGljIFVJIHNvIHVzZXIgc2VlcyByZWFjdGlvbiByZW1vdmFsIGltbWVkaWF0ZWx5LlxyXG4gICAgdGhpcy5hcHBseVJlYWN0aW9uT3B0aW1pc3RpY2FsbHkobWVzc2FnZUlkLCBlbW9qaSwgZmFsc2UpO1xyXG5cclxuICAgIHRoaXMuYXBpLnJlbW92ZVJlYWN0aW9uKG1lc3NhZ2VJZCwgY29udGFjdElkLCBlbW9qaSkuc3Vic2NyaWJlKHtcclxuICAgICAgbmV4dDogKCkgPT4ge1xyXG4gICAgICAgIHRoaXMucmVmcmVzaE1lc3NhZ2VSZWFjdGlvbnMobWVzc2FnZUlkKTtcclxuICAgICAgfSxcclxuICAgICAgZXJyb3I6ICgpID0+IHtcclxuICAgICAgICAvLyBSZXZlcnQgb3B0aW1pc3RpYyB1cGRhdGUgd2hlbiByZXF1ZXN0IGZhaWxzLlxyXG4gICAgICAgIHRoaXMuYXBwbHlSZWFjdGlvbk9wdGltaXN0aWNhbGx5KG1lc3NhZ2VJZCwgZW1vamksIHRydWUpO1xyXG4gICAgICB9LFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBnZXRBY3RpdmVDb252ZXJzYXRpb25JZCgpOiBzdHJpbmcgfCBudWxsIHtcclxuICAgIHJldHVybiB0aGlzLmFjdGl2ZUNvbnZlcnNhdGlvbklkJC52YWx1ZTtcclxuICB9XHJcblxyXG4gIC8vIOKUgOKUgCBHZXR0ZXJzIOKUgOKUgFxyXG4gIGdldE1lc3NhZ2VzRm9yQ29udmVyc2F0aW9uKGNvbnZlcnNhdGlvbklkOiBzdHJpbmcpOiBNZXNzYWdlW10ge1xyXG4gICAgcmV0dXJuIHRoaXMubWVzc2FnZXNNYXAkLnZhbHVlLmdldChjb252ZXJzYXRpb25JZCkgfHwgW107XHJcbiAgfVxyXG5cclxuICBnZXRDdXJyZW50SW5ib3goKTogSW5ib3hJdGVtW10ge1xyXG4gICAgcmV0dXJuIHRoaXMuaW5ib3gkLnZhbHVlO1xyXG4gIH1cclxuXHJcbiAgLy8g4pSA4pSAIFByaXZhdGUgaGVscGVycyDilIDilIBcclxuICBwcml2YXRlIGxpc3RlbldlYlNvY2tldCgpOiB2b2lkIHtcclxuICAgIHRoaXMud3NTdWI/LnVuc3Vic2NyaWJlKCk7XHJcbiAgICB0aGlzLndzU3ViID0gdGhpcy53c1NlcnZpY2Uub25NZXNzYWdlJC5zdWJzY3JpYmUoKG1zZykgPT4gdGhpcy5oYW5kbGVXc01lc3NhZ2UobXNnKSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGhhbmRsZVdzTWVzc2FnZShtc2c6IFdlYlNvY2tldE1lc3NhZ2UpOiB2b2lkIHtcclxuICAgIHN3aXRjaCAobXNnLnR5cGUpIHtcclxuICAgICAgY2FzZSAnbmV3X21lc3NhZ2UnOlxyXG4gICAgICAgIHRoaXMuaGFuZGxlTmV3TWVzc2FnZShtc2cuZGF0YSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgIGNhc2UgJ2NvbnZlcnNhdGlvbl91cGRhdGVkJzpcclxuICAgICAgICB0aGlzLmxvYWRJbmJveCgpO1xyXG4gICAgICAgIGlmICh0aGlzLmFjdGl2ZUNvbnZlcnNhdGlvbklkJC52YWx1ZSkge1xyXG4gICAgICAgICAgdGhpcy5sb2FkTWVzc2FnZXModGhpcy5hY3RpdmVDb252ZXJzYXRpb25JZCQudmFsdWUpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBicmVhaztcclxuICAgICAgY2FzZSAnZ3JvdXBfdXBkYXRlZCc6XHJcbiAgICAgICAgdGhpcy5oYW5kbGVHcm91cFVwZGF0ZWQobXNnLmRhdGEpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICBjYXNlICdlcnJvcic6XHJcbiAgICAgICAgdGhpcy5oYW5kbGVXZWJTb2NrZXRFcnJvcihtc2cubWVzc2FnZSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGhhbmRsZUdyb3VwVXBkYXRlZChkYXRhOiBhbnkpOiB2b2lkIHtcclxuICAgIHRoaXMubG9hZEluYm94KCk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGhhbmRsZVdlYlNvY2tldEVycm9yKGVycm9yTWVzc2FnZTogc3RyaW5nIHwgdW5kZWZpbmVkKTogdm9pZCB7XHJcbiAgICB2b2lkIGVycm9yTWVzc2FnZTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgaGFuZGxlTmV3TWVzc2FnZShkYXRhOiBhbnkpOiB2b2lkIHtcclxuICAgIGlmICghZGF0YSkgcmV0dXJuO1xyXG5cclxuICAgIC8vIFBhc3MgdGhyb3VnaCBmdWxsIHBheWxvYWQgc28gbmVzdGVkIC8gYWx0ZXJuYXRlIGF0dGFjaG1lbnQgZmllbGRzIGFyZSBub3QgZHJvcHBlZC5cclxuICAgIGNvbnN0IG1lc3NhZ2U6IE1lc3NhZ2UgPSB0aGlzLm5vcm1hbGl6ZU1lc3NhZ2VTaGFwZShkYXRhKTtcclxuXHJcbiAgICBjb25zdCBpc0Zyb21PdGhlciA9IFN0cmluZyhtZXNzYWdlLnNlbmRlcl9pZCkgIT09IFN0cmluZyh0aGlzLmF1dGguY29udGFjdElkKTtcclxuXHJcbiAgICBjb25zdCBleGlzdGluZyA9IHRoaXMubWVzc2FnZXNNYXAkLnZhbHVlLmdldChtZXNzYWdlLmNvbnZlcnNhdGlvbl9pZCkgfHwgW107XHJcbiAgICBjb25zdCBpc0R1cGxpY2F0ZSA9IGV4aXN0aW5nLnNvbWUoXHJcbiAgICAgIChtKSA9PiBtLm1lc3NhZ2VfaWQgPT09IG1lc3NhZ2UubWVzc2FnZV9pZCB8fFxyXG4gICAgICAgICAgICAgKG0uc2VuZGVyX2lkID09PSBtZXNzYWdlLnNlbmRlcl9pZCAmJlxyXG4gICAgICAgICAgICAgIG0uY29udGVudCA9PT0gbWVzc2FnZS5jb250ZW50ICYmXHJcbiAgICAgICAgICAgICAgTWF0aC5hYnMobmV3IERhdGUobS5jcmVhdGVkX2F0KS5nZXRUaW1lKCkgLSBuZXcgRGF0ZShtZXNzYWdlLmNyZWF0ZWRfYXQpLmdldFRpbWUoKSkgPCAyMDAwKVxyXG4gICAgKTtcclxuXHJcbiAgICBpZiAoIWlzRHVwbGljYXRlKSB7XHJcbiAgICAgIHRoaXMuYXBwZW5kTWVzc2FnZShtZXNzYWdlKTtcclxuICAgICAgXHJcbiAgICAgIGlmIChpc0Zyb21PdGhlcikge1xyXG4gICAgICAgIHRoaXMucGxheU5vdGlmaWNhdGlvblNvdW5kKCk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICB0aGlzLnVwZGF0ZUluYm94UHJldmlldyhtZXNzYWdlKTtcclxuXHJcbiAgICBpZiAodGhpcy5hY3RpdmVDb252ZXJzYXRpb25JZCQudmFsdWUgIT09IG1lc3NhZ2UuY29udmVyc2F0aW9uX2lkKSB7XHJcbiAgICAgIGlmIChpc0Zyb21PdGhlcikge1xyXG4gICAgICAgIHRoaXMuaW5jcmVtZW50VW5yZWFkKG1lc3NhZ2UuY29udmVyc2F0aW9uX2lkKTtcclxuICAgICAgfVxyXG4gICAgfSBlbHNlIHtcclxuICAgICAgdGhpcy5tYXJrQXNSZWFkKG1lc3NhZ2UuY29udmVyc2F0aW9uX2lkKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKiBQdWJsaWMg4oCUIGxldHMgY29tcG9uZW50cyBhZGQgYW4gb3B0aW1pc3RpYyBtZXNzYWdlIHdpdGhvdXQgYSByb3VuZC10cmlwLiAqL1xyXG4gIGFwcGVuZE9wdGltaXN0aWNNZXNzYWdlKG1lc3NhZ2U6IE1lc3NhZ2UpOiB2b2lkIHtcclxuICAgIHRoaXMuYXBwZW5kTWVzc2FnZShtZXNzYWdlKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgYXBwZW5kTWVzc2FnZShtZXNzYWdlOiBNZXNzYWdlKTogdm9pZCB7XHJcbiAgICBjb25zdCBtYXAgPSBuZXcgTWFwKHRoaXMubWVzc2FnZXNNYXAkLnZhbHVlKTtcclxuICAgIGNvbnN0IG1zZ3MgPSBbLi4uKG1hcC5nZXQobWVzc2FnZS5jb252ZXJzYXRpb25faWQpIHx8IFtdKSwgbWVzc2FnZV07XHJcbiAgICBtYXAuc2V0KG1lc3NhZ2UuY29udmVyc2F0aW9uX2lkLCBtc2dzKTtcclxuICAgIHRoaXMubWVzc2FnZXNNYXAkLm5leHQobWFwKTtcclxuICAgIHRoaXMucmVmcmVzaE1lc3NhZ2VSZWFjdGlvbnMobWVzc2FnZS5tZXNzYWdlX2lkKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgdXBkYXRlSW5ib3hQcmV2aWV3KG1lc3NhZ2U6IE1lc3NhZ2UpOiB2b2lkIHtcclxuICAgIGNvbnN0IGl0ZW1zID0gdGhpcy5pbmJveCQudmFsdWUubWFwKChpdGVtKSA9PiB7XHJcbiAgICAgIGlmIChpdGVtLmNvbnZlcnNhdGlvbl9pZCA9PT0gbWVzc2FnZS5jb252ZXJzYXRpb25faWQpIHtcclxuICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgLi4uaXRlbSxcclxuICAgICAgICAgIGxhc3RfbWVzc2FnZV9wcmV2aWV3OiBtZXNzYWdlLmNvbnRlbnQgfHwgJ1tJbWFnZV0nLFxyXG4gICAgICAgICAgbGFzdF9tZXNzYWdlX2F0OiBtZXNzYWdlLmNyZWF0ZWRfYXQsXHJcbiAgICAgICAgfTtcclxuICAgICAgfVxyXG4gICAgICByZXR1cm4gaXRlbTtcclxuICAgIH0pO1xyXG5cclxuICAgIGl0ZW1zLnNvcnQoKGEsIGIpID0+IG5ldyBEYXRlKGIubGFzdF9tZXNzYWdlX2F0KS5nZXRUaW1lKCkgLSBuZXcgRGF0ZShhLmxhc3RfbWVzc2FnZV9hdCkuZ2V0VGltZSgpKTtcclxuICAgIHRoaXMuaW5ib3gkLm5leHQoaXRlbXMpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBpbmNyZW1lbnRVbnJlYWQoY29udmVyc2F0aW9uSWQ6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgY29uc3QgaXRlbXMgPSB0aGlzLmluYm94JC52YWx1ZS5tYXAoKGl0ZW0pID0+XHJcbiAgICAgIGl0ZW0uY29udmVyc2F0aW9uX2lkID09PSBjb252ZXJzYXRpb25JZFxyXG4gICAgICAgID8geyAuLi5pdGVtLCB1bnJlYWRfY291bnQ6IE51bWJlcihpdGVtLnVucmVhZF9jb3VudCkgKyAxIH1cclxuICAgICAgICA6IGl0ZW1cclxuICAgICk7XHJcbiAgICB0aGlzLmluYm94JC5uZXh0KGl0ZW1zKTtcclxuICAgIHRoaXMucmVjYWxjVW5yZWFkKGl0ZW1zKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIE5vcm1hbGl6ZSBiYWNrZW5kIG1lc3NhZ2Ugc2hhcGVzIHNvIFVJIGNhbiByZWxpYWJseSByZW5kZXIgYXR0YWNobWVudHMvbWVkaWEuXHJcbiAgICogU3VwcG9ydHMgbGVnYWN5IGFuZCBjdXJyZW50IGZpZWxkIG5hbWVzIHJldHVybmVkIGJ5IEFQSS9XUyBwYXlsb2Fkcy5cclxuICAgKi9cclxuICBwcml2YXRlIG5vcm1hbGl6ZU1lc3NhZ2VTaGFwZShyYXc6IGFueSk6IE1lc3NhZ2Uge1xyXG4gICAgY29uc3QgYmFzZTogTWVzc2FnZSA9IHtcclxuICAgICAgbWVzc2FnZV9pZDogU3RyaW5nKHJhdz8ubWVzc2FnZV9pZCA/PyByYXc/LmlkID8/ICcnKSxcclxuICAgICAgY29udmVyc2F0aW9uX2lkOiBTdHJpbmcocmF3Py5jb252ZXJzYXRpb25faWQgPz8gcmF3Py5jb252ZXJzYXRpb25JZCA/PyAnJyksXHJcbiAgICAgIHNlbmRlcl9pZDogU3RyaW5nKHJhdz8uc2VuZGVyX2lkID8/IHJhdz8uc2VuZGVySWQgPz8gJycpLFxyXG4gICAgICBzZW5kZXJfbmFtZTogcmF3Py5zZW5kZXJfbmFtZSxcclxuICAgICAgc2VuZGVyX3VzZXJuYW1lOiByYXc/LnNlbmRlcl91c2VybmFtZSxcclxuICAgICAgc2VuZGVyX2ZpcnN0X25hbWU6IHJhdz8uc2VuZGVyX2ZpcnN0X25hbWUsXHJcbiAgICAgIHNlbmRlcl9sYXN0X25hbWU6IHJhdz8uc2VuZGVyX2xhc3RfbmFtZSxcclxuICAgICAgbWVzc2FnZV90eXBlOiAocmF3Py5tZXNzYWdlX3R5cGUgPz8gcmF3Py5tZXNzYWdlVHlwZSA/PyAnVEVYVCcpIGFzIE1lc3NhZ2VbJ21lc3NhZ2VfdHlwZSddLFxyXG4gICAgICBjb250ZW50OiByYXc/LmNvbnRlbnQgPz8gJycsXHJcbiAgICAgIG1lZGlhX3VybDogcmF3Py5tZWRpYV91cmwgPz8gcmF3Py5tZWRpYVVybCA/PyByYXc/LnVybCA/PyByYXc/LmZpbGVfdXJsLFxyXG4gICAgICBjcmVhdGVkX2F0OiByYXc/LmNyZWF0ZWRfYXQgPz8gcmF3Py5jcmVhdGVkQXQgPz8gbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxyXG4gICAgICBpc19yZWFkOiByYXc/LmlzX3JlYWQsXHJcbiAgICAgIHJlYWN0aW9uczogcmF3Py5yZWFjdGlvbnMsXHJcbiAgICAgIG1lbnRpb25zOiByYXc/Lm1lbnRpb25zLFxyXG4gICAgICBhdHRhY2htZW50czogcmF3Py5hdHRhY2htZW50cyxcclxuICAgICAgaXNfcGlubmVkOiByYXc/LmlzX3Bpbm5lZCxcclxuICAgICAgcGlubmVkX2F0OiByYXc/LnBpbm5lZF9hdCxcclxuICAgICAgcGlubmVkX2J5OiByYXc/LnBpbm5lZF9ieSxcclxuICAgIH07XHJcblxyXG4gICAgY29uc3QgdXVpZFJlID1cclxuICAgICAgL15bMC05YS1mXXs4fS1bMC05YS1mXXs0fS1bMS01XVswLTlhLWZdezN9LVs4OWFiXVswLTlhLWZdezN9LVswLTlhLWZdezEyfSQvaTtcclxuXHJcbiAgICAvLyBOb3JtYWxpemUgYXR0YWNobWVudCBvYmplY3RzIChBUEkgbWF5IHVzZSBmaWxlSWQgLyBpZCBpbnN0ZWFkIG9mIGZpbGVfaWQpLlxyXG4gICAgaWYgKEFycmF5LmlzQXJyYXkoYmFzZS5hdHRhY2htZW50cykgJiYgYmFzZS5hdHRhY2htZW50cy5sZW5ndGggPiAwKSB7XHJcbiAgICAgIGNvbnN0IG1hcHBlZDogQXR0YWNobWVudFtdID0gKGJhc2UuYXR0YWNobWVudHMgYXMgYW55W10pLm1hcCgoYSkgPT4gKHtcclxuICAgICAgICBmaWxlX2lkOiBTdHJpbmcoXHJcbiAgICAgICAgICBhPy5maWxlX2lkID8/IGE/LmZpbGVJZCA/PyBhPy5pZCA/PyBhPy5hdHRhY2htZW50X2lkID8/IGE/LnN0b3JhZ2VfZmlsZV9pZCA/PyAnJ1xyXG4gICAgICAgICkudHJpbSgpLFxyXG4gICAgICAgIGZpbGVuYW1lOiBTdHJpbmcoYT8uZmlsZW5hbWUgPz8gYT8uZmlsZV9uYW1lID8/IGE/Lm5hbWUgPz8gYT8ub3JpZ2luYWxfZmlsZW5hbWUgPz8gJycpLFxyXG4gICAgICAgIG1pbWVfdHlwZTogYT8ubWltZV90eXBlID8/IGE/Lm1pbWVUeXBlLFxyXG4gICAgICAgIHVybDogYT8udXJsID8/IGE/LmZpbGVfdXJsID8/IGE/LmRvd25sb2FkX3VybCxcclxuICAgICAgfSkpLmZpbHRlcigoYSkgPT4gISFhLmZpbGVfaWQgJiYgIWEuZmlsZV9pZC5zdGFydHNXaXRoKCd0ZW1wLScpKTtcclxuXHJcbiAgICAgIGlmIChtYXBwZWQubGVuZ3RoID4gMCkge1xyXG4gICAgICAgIHJldHVybiB7IC4uLmJhc2UsIGF0dGFjaG1lbnRzOiBtYXBwZWQgfTtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8vIFJlY29uc3RydWN0IGF0dGFjaG1lbnRzIGZyb20gYWx0ZXJuYXRlIEFQSSBmaWVsZHMuXHJcbiAgICBsZXQgYXR0YWNobWVudElkczogc3RyaW5nW10gPSBbXTtcclxuICAgIGlmIChBcnJheS5pc0FycmF5KHJhdz8uYXR0YWNobWVudF9pZHMpKSB7XHJcbiAgICAgIGF0dGFjaG1lbnRJZHMgPSByYXcuYXR0YWNobWVudF9pZHMubWFwKCh4OiBhbnkpID0+IFN0cmluZyh4KS50cmltKCkpLmZpbHRlcihCb29sZWFuKTtcclxuICAgIH0gZWxzZSBpZiAodHlwZW9mIHJhdz8uYXR0YWNobWVudF9pZHMgPT09ICdzdHJpbmcnICYmIHJhdy5hdHRhY2htZW50X2lkcy50cmltKCkpIHtcclxuICAgICAgYXR0YWNobWVudElkcyA9IHJhdy5hdHRhY2htZW50X2lkc1xyXG4gICAgICAgIC5zcGxpdCgvWyxcXHNdKy8pXHJcbiAgICAgICAgLm1hcCgoczogc3RyaW5nKSA9PiBzLnRyaW0oKSlcclxuICAgICAgICAuZmlsdGVyKEJvb2xlYW4pO1xyXG4gICAgfVxyXG5cclxuICAgIGlmIChhdHRhY2htZW50SWRzLmxlbmd0aCA9PT0gMCAmJiBBcnJheS5pc0FycmF5KHJhdz8uZmlsZV9pZHMpKSB7XHJcbiAgICAgIGF0dGFjaG1lbnRJZHMgPSByYXcuZmlsZV9pZHMubWFwKCh4OiBhbnkpID0+IFN0cmluZyh4KS50cmltKCkpLmZpbHRlcihCb29sZWFuKTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBwdXNoSWQgPSAodjogYW55KSA9PiB7XHJcbiAgICAgIGNvbnN0IHMgPSB2ICE9IG51bGwgJiYgdiAhPT0gJycgPyBTdHJpbmcodikudHJpbSgpIDogJyc7XHJcbiAgICAgIGlmIChzICYmICFhdHRhY2htZW50SWRzLmluY2x1ZGVzKHMpKSBhdHRhY2htZW50SWRzLnB1c2gocyk7XHJcbiAgICB9O1xyXG5cclxuICAgIHB1c2hJZChyYXc/LmZpbGVfaWQpO1xyXG4gICAgcHVzaElkKHJhdz8uYXR0YWNobWVudF9pZCk7XHJcbiAgICBwdXNoSWQocmF3Py5zdG9yYWdlX2ZpbGVfaWQpO1xyXG4gICAgcHVzaElkKHJhdz8uYmxvYl9pZCk7XHJcblxyXG4gICAgLy8gQmFja2VuZCBzdG9yZXMgZmlyc3QgYXR0YWNobWVudCBpZCBpbiBtZXNzYWdpbmcubWVzc2FnZS5tZWRpYV91cmwgKFVVSUQpLCBub3QgYSBwdWJsaWMgVVJMLlxyXG4gICAgY29uc3QgbWVkaWFBc0lkID0gU3RyaW5nKGJhc2UubWVkaWFfdXJsIHx8ICcnKS50cmltKCk7XHJcbiAgICBpZiAoXHJcbiAgICAgIG1lZGlhQXNJZCAmJlxyXG4gICAgICAhbWVkaWFBc0lkLnN0YXJ0c1dpdGgoJ2h0dHA6Ly8nKSAmJlxyXG4gICAgICAhbWVkaWFBc0lkLnN0YXJ0c1dpdGgoJ2h0dHBzOi8vJykgJiZcclxuICAgICAgIW1lZGlhQXNJZC5zdGFydHNXaXRoKCdkYXRhOicpXHJcbiAgICApIHtcclxuICAgICAgcHVzaElkKG1lZGlhQXNJZCk7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgY29udGVudFRyaW0gPSBTdHJpbmcoYmFzZS5jb250ZW50IHx8ICcnKS50cmltKCk7XHJcbiAgICBpZiAoYXR0YWNobWVudElkcy5sZW5ndGggPT09IDAgJiYgdXVpZFJlLnRlc3QoY29udGVudFRyaW0pKSB7XHJcbiAgICAgIGF0dGFjaG1lbnRJZHMucHVzaChjb250ZW50VHJpbSk7XHJcbiAgICB9XHJcbiAgICAvLyBTb21lIEFQSXMgc3RvcmUgc3RvcmFnZSAvIGF0dGFjaG1lbnQgaWQgYXMgbnVtZXJpYyBzdHJpbmcgaW4gY29udGVudCBmb3IgRklMRSBtZXNzYWdlcy5cclxuICAgIGlmIChcclxuICAgICAgYXR0YWNobWVudElkcy5sZW5ndGggPT09IDAgJiZcclxuICAgICAgL15cXGQrJC8udGVzdChjb250ZW50VHJpbSkgJiZcclxuICAgICAgKGJhc2UubWVzc2FnZV90eXBlID09PSAnRklMRScgfHwgYmFzZS5tZXNzYWdlX3R5cGUgPT09ICdJTUFHRScpXHJcbiAgICApIHtcclxuICAgICAgYXR0YWNobWVudElkcy5wdXNoKGNvbnRlbnRUcmltKTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBmaWxlbmFtZXM6IHN0cmluZ1tdID0gQXJyYXkuaXNBcnJheShyYXc/LmZpbGVuYW1lcylcclxuICAgICAgPyByYXcuZmlsZW5hbWVzLm1hcCgoeDogYW55KSA9PiBTdHJpbmcoeCkpXHJcbiAgICAgIDogcmF3Py5maWxlbmFtZVxyXG4gICAgICA/IFtTdHJpbmcocmF3LmZpbGVuYW1lKV1cclxuICAgICAgOiByYXc/LmZpbGVfbmFtZVxyXG4gICAgICA/IFtTdHJpbmcocmF3LmZpbGVfbmFtZSldXHJcbiAgICAgIDogYmFzZS5jb250ZW50ICYmICF1dWlkUmUudGVzdChjb250ZW50VHJpbSlcclxuICAgICAgPyBbU3RyaW5nKGJhc2UuY29udGVudCldXHJcbiAgICAgIDogW107XHJcblxyXG4gICAgaWYgKGF0dGFjaG1lbnRJZHMubGVuZ3RoID4gMCB8fCBmaWxlbmFtZXMubGVuZ3RoID4gMCkge1xyXG4gICAgICBjb25zdCBmYWxsYmFja01pbWUgPSByYXc/Lm1pbWVfdHlwZSA/PyByYXc/LmF0dGFjaG1lbnRfbWltZV90eXBlO1xyXG4gICAgICBjb25zdCB1cmxGYWxsYmFjayA9IHJhdz8uZmlsZV91cmwgPz8gcmF3Py51cmwgPz8gcmF3Py5tZWRpYV91cmwgPz8gcmF3Py5tZWRpYVVybDtcclxuICAgICAgY29uc3QgaWRzID0gYXR0YWNobWVudElkcy5sZW5ndGggPiAwID8gYXR0YWNobWVudElkcyA6IFtdO1xyXG4gICAgICBjb25zdCBidWlsdDogQXR0YWNobWVudFtdID0gaWRzLm1hcCgoaWQsIGlkeCkgPT4gKHtcclxuICAgICAgICBmaWxlX2lkOiBpZCxcclxuICAgICAgICBmaWxlbmFtZTogZmlsZW5hbWVzW2lkeF0gfHwgZmlsZW5hbWVzWzBdIHx8IGBBdHRhY2htZW50ICR7aWR4ICsgMX1gLFxyXG4gICAgICAgIG1pbWVfdHlwZTogZmFsbGJhY2tNaW1lLFxyXG4gICAgICAgIHVybDogdXJsRmFsbGJhY2ssXHJcbiAgICAgIH0pKTtcclxuXHJcbiAgICAgIC8vIEZpbGVuYW1lIG9ubHkgKyBkaXJlY3QgVVJMIChubyBzdG9yYWdlIGlkKTogc3RpbGwgcmVuZGVyYWJsZSBhcyA8aW1nIHNyYz4uXHJcbiAgICAgIGlmIChcclxuICAgICAgICBidWlsdC5sZW5ndGggPT09IDAgJiZcclxuICAgICAgICBmaWxlbmFtZXMubGVuZ3RoID4gMCAmJlxyXG4gICAgICAgIHVybEZhbGxiYWNrICYmXHJcbiAgICAgICAgU3RyaW5nKHVybEZhbGxiYWNrKS5tYXRjaCgvXmh0dHBzPzpcXC9cXC8vaSlcclxuICAgICAgKSB7XHJcbiAgICAgICAgYnVpbHQucHVzaCh7XHJcbiAgICAgICAgICBmaWxlX2lkOiAnJyxcclxuICAgICAgICAgIGZpbGVuYW1lOiBmaWxlbmFtZXNbMF0sXHJcbiAgICAgICAgICBtaW1lX3R5cGU6IGZhbGxiYWNrTWltZSxcclxuICAgICAgICAgIHVybDogU3RyaW5nKHVybEZhbGxiYWNrKSxcclxuICAgICAgICB9KTtcclxuICAgICAgfVxyXG5cclxuICAgICAgaWYgKGJ1aWx0Lmxlbmd0aCA+IDApIHtcclxuICAgICAgICByZXR1cm4geyAuLi5iYXNlLCBhdHRhY2htZW50czogYnVpbHQgfTtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBiYXNlO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBwbGF5Tm90aWZpY2F0aW9uU291bmQoKTogdm9pZCB7XHJcbiAgICB0cnkge1xyXG4gICAgICBjb25zdCBhdWRpbyA9IG5ldyBBdWRpbygnZGF0YTphdWRpby93YXY7YmFzZTY0LFVrbEdSbm9HQUFCWFFWWkZabTEwSUJBQUFBQUJBQUVBUUI4QUFFQWZBQUFCQUFnQVpHRjBZUW9HQUFDQmhZcUZiRjFmZEppdnJKQmhOalZnb2REYnEyRWNCaithMi9MRGNpVUZMSUhPOHRpSk53Z1phTHZ0NTU5TkVBeFFwK1B3dG1NY0JqaVIxL0xNZVN3RkpIZkg4TjJRUUFvVVhyVHA2NmhWRkFwR24rRHl2bXdoQlN1Qnp2TFppVFlJR0dTNTdPaWhVQkVMVEtYaDhibGxIQVUyamRYenpuMHZCU2grelBMYWl6c0tGR0N6Nk95cldCUUxTS0RmOHNGdUl3VXVnOC95MjRrM0NCaGt1K3pvb1ZBUkMweWw0Zkc1WlJ3Rk5vM1Y4ODU5THdVb2Zzenkyb3M3Q2hSZ3MranNxMWdWQzBpZzMvTEJiaU1GTG9MUDh0dUpOd2dZWkx2czZLRlFFUXRNcGVIeHVXVWNCVGFOMWZQT2ZTOEZLSDdNOHRxTE93b1VZTFBvN0t0WUZRdElvTi95d1c0akJTNkN6L0xiaVRjSUdHUzc3T2loVUJFTFRLWGg4YmxsSEFVMmpkWHp6bjB2QlNoK3pQTGFpenNLRkdDejZPeXJXQlVMU0tEZjhzRnVJd1V1Z3MveTI0azNDQmhrdSt6b29WQVJDMHlsNGZHNVpSd0ZObzNWODg1OUx3VW9mc3p5Mm9zN0NoUmdzK2pzcTFnVkMwaWczL0xCYmlNRkxvTFA4dHVKTndnWVpMdnM2S0ZRRVF0TXBlSHh1V1VjQlRhTjFmUE9mUzhGS0g3TTh0cUxPd29VWUxQbzdLdFlGUXRJb04veXdXNGpCUzZDei9MYmlUY0lHR1M3N09paFVCRUxUS1hoOGJsbEhBVTJqZFh6em4wdkJTaCt6UExhaXpzS0ZHQ3o2T3lyV0JVTFNLRGY4c0Z1SXdVdWdzL3kyNGszQ0Joa3Urem9vVkFSQzB5bDRmRzVaUndGTm8zVjg4NTlMd1VvZnN6eTJvczdDaFJncytqc3ExZ1ZDMGlnMy9MQmJpTUZMb0xQOHR1Sk53Z1laTHZzNktGUUVRdE1wZUh4dVdVY0JUYU4xZlBPZlM4RktIN004dHFMT3dvVVlMUG83S3RZRlF0SW9OL3l3VzRqQlM2Q3ovTGJpVGNJR0dTNzdPaWhVQkVMVEtYaDhibGxIQVUyamRYenpuMHZCU2grelBMYWl6c0tGR0N6Nk95cldCVUxTS0RmOHNGdUl3VXVncy95MjRrM0NCaGt1K3pvb1ZBUkMweWw0Zkc1WlJ3Rk5vM1Y4ODU5THdVb2Zzenkyb3M3Q2hSZ3MranNxMWdWQzBpZzMvTEJiaU1GTG9MUDh0dUpOd2dZWkx2czZLRlFFUXRNcGVIeHVXVWNCVGFOMWZQT2ZTOEZLSDdNOHRxTE93b1VZTFBvN0t0WUZRdElvTi95d1c0akJTNkN6L0xiaVRjSUdHUzc3T2loVUJFTFRLWGg4YmxsSEFVMmpkWHp6bjB2QlNoK3pQTGFpenNLRkdDejZPeXJXQlVMU0tEZjhzRnVJd1V1Z3MveTI0azNDQmhrdSt6b29WQVJDMHlsNGZHNVpSd0ZObzNWODg1OUx3VW9mc3p5Mm9zN0NoUmdzK2pzcTFnVkMwaWczL0xCYmlNRkxvTFA4dHVKTndnWVpMdnM2S0ZRRVF0TXBlSHh1V1VjQlRhTjFmUE9mUzhGS0g3TTh0cUxPd29VWUxQbzdLdFlGUXRJb04veXdXNGpCUzZDei9MYmlUY0lHR1M3N09paFVCRUxUS1hoOGJsbEhBVTJqZFh6em4wdkJTaCt6UExhaXpzS0ZHQ3o2T3lyV0JVTFNLRGY4c0Z1SXdVdWdzL3kyNGszQ0Joa3Urem9vVkFSQzB5bDRmRzVaUndGTm8zVjg4NTlMd1VvZnN6eScpO1xyXG4gICAgICBhdWRpby52b2x1bWUgPSAwLjM7XHJcbiAgICAgIGF1ZGlvLnBsYXkoKS5jYXRjaCgoKSA9PiB7fSk7XHJcbiAgICB9IGNhdGNoIHtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHByaXZhdGUgcmVjYWxjVW5yZWFkKGl0ZW1zOiBJbmJveEl0ZW1bXSk6IHZvaWQge1xyXG4gICAgY29uc3QgdG90YWwgPSBpdGVtcy5yZWR1Y2UoKHN1bSwgaSkgPT4gc3VtICsgTnVtYmVyKGkudW5yZWFkX2NvdW50IHx8IDApLCAwKTtcclxuICAgIHRoaXMudG90YWxVbnJlYWQkLm5leHQodG90YWwpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBoeWRyYXRlUmVhY3Rpb25zRm9yQ29udmVyc2F0aW9uKGNvbnZlcnNhdGlvbklkOiBzdHJpbmcsIG1lc3NhZ2VzOiBNZXNzYWdlW10pOiB2b2lkIHtcclxuICAgIGNvbnN0IGZldGNoYWJsZSA9IG1lc3NhZ2VzLmZpbHRlcihcclxuICAgICAgKG0pID0+ICEhbS5tZXNzYWdlX2lkICYmICFTdHJpbmcobS5tZXNzYWdlX2lkKS5zdGFydHNXaXRoKCd0ZW1wLScpXHJcbiAgICApO1xyXG4gICAgaWYgKCFmZXRjaGFibGUubGVuZ3RoKSByZXR1cm47XHJcblxyXG4gICAgY29uc3Qgam9icyA9IGZldGNoYWJsZS5tYXAoKG0pID0+XHJcbiAgICAgIHRoaXMuYXBpLmdldFJlYWN0aW9ucyhtLm1lc3NhZ2VfaWQpLnBpcGUoXHJcbiAgICAgICAgbWFwKChyb3dzKSA9PiAoeyBtZXNzYWdlSWQ6IG0ubWVzc2FnZV9pZCwgcmVhY3Rpb25zOiB0aGlzLm5vcm1hbGl6ZVJlYWN0aW9uUm93cyhyb3dzKSB9KSksXHJcbiAgICAgICAgY2F0Y2hFcnJvcigoKSA9PiBvZih7IG1lc3NhZ2VJZDogbS5tZXNzYWdlX2lkLCByZWFjdGlvbnM6IFtdIH0pKVxyXG4gICAgICApXHJcbiAgICApO1xyXG5cclxuICAgIGZvcmtKb2luKGpvYnMpLnN1YnNjcmliZSgocmVzdWx0cykgPT4ge1xyXG4gICAgICBjb25zdCBtYXAgPSBuZXcgTWFwKHRoaXMubWVzc2FnZXNNYXAkLnZhbHVlKTtcclxuICAgICAgY29uc3QgY3VycmVudCA9IFsuLi4obWFwLmdldChjb252ZXJzYXRpb25JZCkgfHwgW10pXTtcclxuICAgICAgaWYgKCFjdXJyZW50Lmxlbmd0aCkgcmV0dXJuO1xyXG5cclxuICAgICAgbGV0IGNoYW5nZWQgPSBmYWxzZTtcclxuICAgICAgZm9yIChjb25zdCByZXN1bHQgb2YgcmVzdWx0cykge1xyXG4gICAgICAgIGNvbnN0IGlkeCA9IGN1cnJlbnQuZmluZEluZGV4KChtKSA9PiBTdHJpbmcobS5tZXNzYWdlX2lkKSA9PT0gU3RyaW5nKHJlc3VsdC5tZXNzYWdlSWQpKTtcclxuICAgICAgICBpZiAoaWR4ID09PSAtMSkgY29udGludWU7XHJcbiAgICAgICAgY3VycmVudFtpZHhdID0geyAuLi5jdXJyZW50W2lkeF0sIHJlYWN0aW9uczogcmVzdWx0LnJlYWN0aW9ucyB9O1xyXG4gICAgICAgIGNoYW5nZWQgPSB0cnVlO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBpZiAoY2hhbmdlZCkge1xyXG4gICAgICAgIG1hcC5zZXQoY29udmVyc2F0aW9uSWQsIGN1cnJlbnQpO1xyXG4gICAgICAgIHRoaXMubWVzc2FnZXNNYXAkLm5leHQobWFwKTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHJlZnJlc2hNZXNzYWdlUmVhY3Rpb25zKG1lc3NhZ2VJZDogc3RyaW5nKTogdm9pZCB7XHJcbiAgICBpZiAoIW1lc3NhZ2VJZCB8fCBTdHJpbmcobWVzc2FnZUlkKS5zdGFydHNXaXRoKCd0ZW1wLScpKSByZXR1cm47XHJcblxyXG4gICAgdGhpcy5hcGkuZ2V0UmVhY3Rpb25zKG1lc3NhZ2VJZCkuc3Vic2NyaWJlKHtcclxuICAgICAgbmV4dDogKHJvd3MpID0+IHtcclxuICAgICAgICBjb25zdCBub3JtYWxpemVkID0gdGhpcy5ub3JtYWxpemVSZWFjdGlvblJvd3Mocm93cyk7XHJcbiAgICAgICAgY29uc3QgbWFwID0gbmV3IE1hcCh0aGlzLm1lc3NhZ2VzTWFwJC52YWx1ZSk7XHJcbiAgICAgICAgbGV0IGNoYW5nZWQgPSBmYWxzZTtcclxuXHJcbiAgICAgICAgZm9yIChjb25zdCBbY29udmVyc2F0aW9uSWQsIG1zZ3NdIG9mIG1hcC5lbnRyaWVzKCkpIHtcclxuICAgICAgICAgIGNvbnN0IGlkeCA9IG1zZ3MuZmluZEluZGV4KChtKSA9PiBTdHJpbmcobS5tZXNzYWdlX2lkKSA9PT0gU3RyaW5nKG1lc3NhZ2VJZCkpO1xyXG4gICAgICAgICAgaWYgKGlkeCA9PT0gLTEpIGNvbnRpbnVlO1xyXG4gICAgICAgICAgY29uc3QgbmV4dE1zZ3MgPSBbLi4ubXNnc107XHJcbiAgICAgICAgICBuZXh0TXNnc1tpZHhdID0geyAuLi5uZXh0TXNnc1tpZHhdLCByZWFjdGlvbnM6IG5vcm1hbGl6ZWQgfTtcclxuICAgICAgICAgIG1hcC5zZXQoY29udmVyc2F0aW9uSWQsIG5leHRNc2dzKTtcclxuICAgICAgICAgIGNoYW5nZWQgPSB0cnVlO1xyXG4gICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoY2hhbmdlZCkge1xyXG4gICAgICAgICAgdGhpcy5tZXNzYWdlc01hcCQubmV4dChtYXApO1xyXG4gICAgICAgIH1cclxuICAgICAgfSxcclxuICAgICAgZXJyb3I6ICgpID0+IHt9LFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIG5vcm1hbGl6ZVJlYWN0aW9uUm93cyhyb3dzOiBhbnlbXSk6IGFueVtdIHtcclxuICAgIGNvbnN0IGJ5RW1vamkgPSBuZXcgTWFwPHN0cmluZywgeyBlbW9qaTogc3RyaW5nOyBjb3VudDogbnVtYmVyOyBoYXNSZWFjdGVkOiBib29sZWFuOyByZWFjdG9yczogc3RyaW5nW10gfT4oKTtcclxuICAgIGNvbnN0IG15Q29udGFjdElkID0gU3RyaW5nKHRoaXMuYXV0aC5jb250YWN0SWQgfHwgJycpO1xyXG4gICAgY29uc3QgY29udGFjdHMgPSB0aGlzLnZpc2libGVDb250YWN0cyQudmFsdWU7XHJcblxyXG4gICAgZm9yIChjb25zdCByb3cgb2Ygcm93cyB8fCBbXSkge1xyXG4gICAgICBjb25zdCBlbW9qaSA9IFN0cmluZyhyb3c/LmVtb2ppIHx8ICcnKS50cmltKCk7XHJcbiAgICAgIGlmICghZW1vamkpIGNvbnRpbnVlO1xyXG5cclxuICAgICAgY29uc3QgY29udGFjdElkID0gU3RyaW5nKHJvdz8uY29udGFjdF9pZCA/PyByb3c/LmNvbnRhY3RJZCA/PyAnJyk7XHJcbiAgICAgIGNvbnN0IGV4cGxpY2l0SGFzUmVhY3RlZCA9IHJvdz8uaGFzUmVhY3RlZCA/PyByb3c/Lmhhc19yZWFjdGVkO1xyXG4gICAgICBjb25zdCBoYXNSZWFjdGVkID0gZXhwbGljaXRIYXNSZWFjdGVkID09PSB0cnVlIHx8IChjb250YWN0SWQgJiYgY29udGFjdElkID09PSBteUNvbnRhY3RJZCk7XHJcblxyXG4gICAgICBjb25zdCBjb3VudEZyb21Sb3cgPSBOdW1iZXIocm93Py5jb3VudCA/PyByb3c/LnJlYWN0aW9uX2NvdW50ID8/IDApO1xyXG4gICAgICBjb25zdCBleGlzdGluZyA9IGJ5RW1vamkuZ2V0KGVtb2ppKSB8fCB7IGVtb2ppLCBjb3VudDogMCwgaGFzUmVhY3RlZDogZmFsc2UsIHJlYWN0b3JzOiBbXSB9O1xyXG5cclxuICAgICAgLy8gU29tZSBBUElzIHJldHVybiBvbmUgcm93IHBlciByZWFjdGlvbjsgc29tZSByZXR1cm4gcHJlLWFnZ3JlZ2F0ZWQgY291bnQuXHJcbiAgICAgIGV4aXN0aW5nLmNvdW50ICs9IGNvdW50RnJvbVJvdyA+IDAgPyBjb3VudEZyb21Sb3cgOiAxO1xyXG4gICAgICBleGlzdGluZy5oYXNSZWFjdGVkID0gZXhpc3RpbmcuaGFzUmVhY3RlZCB8fCAhIWhhc1JlYWN0ZWQ7XHJcblxyXG4gICAgICAvLyBUcmFjayByZWFjdG9yIGRpc3BsYXkgbmFtZXMgd2hlbiBpbmRpdmlkdWFsIGNvbnRhY3RJZCBpcyBhdmFpbGFibGVcclxuICAgICAgaWYgKGNvbnRhY3RJZCAmJiBjb3VudEZyb21Sb3cgPD0gMSkge1xyXG4gICAgICAgIGxldCBuYW1lOiBzdHJpbmc7XHJcbiAgICAgICAgaWYgKGNvbnRhY3RJZCA9PT0gbXlDb250YWN0SWQpIHtcclxuICAgICAgICAgIG5hbWUgPSAnWW91JztcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgY29uc3QgY29udGFjdCA9IGNvbnRhY3RzLmZpbmQoYyA9PiBTdHJpbmcoYy5jb250YWN0X2lkKSA9PT0gY29udGFjdElkKTtcclxuICAgICAgICAgIG5hbWUgPSBjb250YWN0ID8gZ2V0Q29udGFjdERpc3BsYXlOYW1lKGNvbnRhY3QpIDogYFVzZXIgJHtjb250YWN0SWR9YDtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKCFleGlzdGluZy5yZWFjdG9ycy5pbmNsdWRlcyhuYW1lKSkge1xyXG4gICAgICAgICAgZXhpc3RpbmcucmVhY3RvcnMucHVzaChuYW1lKTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGJ5RW1vamkuc2V0KGVtb2ppLCBleGlzdGluZyk7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIEFycmF5LmZyb20oYnlFbW9qaS52YWx1ZXMoKSkuZmlsdGVyKChyKSA9PiByLmNvdW50ID4gMCk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGFwcGx5UmVhY3Rpb25PcHRpbWlzdGljYWxseShtZXNzYWdlSWQ6IHN0cmluZywgZW1vamk6IHN0cmluZywgYWRkOiBib29sZWFuKTogdm9pZCB7XHJcbiAgICBjb25zdCBtYXAgPSBuZXcgTWFwKHRoaXMubWVzc2FnZXNNYXAkLnZhbHVlKTtcclxuICAgIGxldCBkaWRVcGRhdGUgPSBmYWxzZTtcclxuXHJcbiAgICBmb3IgKGNvbnN0IFtjb252ZXJzYXRpb25JZCwgbXNnc10gb2YgbWFwLmVudHJpZXMoKSkge1xyXG4gICAgICBjb25zdCBpZHggPSBtc2dzLmZpbmRJbmRleCgobSkgPT4gU3RyaW5nKG0ubWVzc2FnZV9pZCkgPT09IFN0cmluZyhtZXNzYWdlSWQpKTtcclxuICAgICAgaWYgKGlkeCA9PT0gLTEpIGNvbnRpbnVlO1xyXG5cclxuICAgICAgY29uc3QgdGFyZ2V0ID0gbXNnc1tpZHhdO1xyXG4gICAgICBjb25zdCBuZXh0UmVhY3Rpb25zID0gWy4uLih0YXJnZXQucmVhY3Rpb25zIHx8IFtdKV07XHJcbiAgICAgIGNvbnN0IHJJZHggPSBuZXh0UmVhY3Rpb25zLmZpbmRJbmRleCgocikgPT4gci5lbW9qaSA9PT0gZW1vamkpO1xyXG5cclxuICAgICAgaWYgKGFkZCkge1xyXG4gICAgICAgIGlmIChySWR4ID49IDApIHtcclxuICAgICAgICAgIGNvbnN0IGN1cnJlbnQgPSBuZXh0UmVhY3Rpb25zW3JJZHhdO1xyXG4gICAgICAgICAgaWYgKCFjdXJyZW50Lmhhc1JlYWN0ZWQpIHtcclxuICAgICAgICAgICAgbmV4dFJlYWN0aW9uc1tySWR4XSA9IHtcclxuICAgICAgICAgICAgICAuLi5jdXJyZW50LFxyXG4gICAgICAgICAgICAgIGhhc1JlYWN0ZWQ6IHRydWUsXHJcbiAgICAgICAgICAgICAgY291bnQ6IE51bWJlcihjdXJyZW50LmNvdW50IHx8IDApICsgMSxcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgbmV4dFJlYWN0aW9ucy5wdXNoKHsgZW1vamksIGNvdW50OiAxLCBoYXNSZWFjdGVkOiB0cnVlIH0pO1xyXG4gICAgICAgIH1cclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBpZiAocklkeCA+PSAwKSB7XHJcbiAgICAgICAgICBjb25zdCBjdXJyZW50ID0gbmV4dFJlYWN0aW9uc1tySWR4XTtcclxuICAgICAgICAgIGNvbnN0IG5leHRDb3VudCA9IE1hdGgubWF4KE51bWJlcihjdXJyZW50LmNvdW50IHx8IDApIC0gKGN1cnJlbnQuaGFzUmVhY3RlZCA/IDEgOiAwKSwgMCk7XHJcbiAgICAgICAgICBpZiAobmV4dENvdW50ID09PSAwKSB7XHJcbiAgICAgICAgICAgIG5leHRSZWFjdGlvbnMuc3BsaWNlKHJJZHgsIDEpO1xyXG4gICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgbmV4dFJlYWN0aW9uc1tySWR4XSA9IHtcclxuICAgICAgICAgICAgICAuLi5jdXJyZW50LFxyXG4gICAgICAgICAgICAgIGhhc1JlYWN0ZWQ6IGZhbHNlLFxyXG4gICAgICAgICAgICAgIGNvdW50OiBuZXh0Q291bnQsXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcblxyXG4gICAgICBjb25zdCB1cGRhdGVkTXNnOiBNZXNzYWdlID0geyAuLi50YXJnZXQsIHJlYWN0aW9uczogbmV4dFJlYWN0aW9ucyB9O1xyXG4gICAgICBjb25zdCB1cGRhdGVkTXNncyA9IFsuLi5tc2dzXTtcclxuICAgICAgdXBkYXRlZE1zZ3NbaWR4XSA9IHVwZGF0ZWRNc2c7XHJcbiAgICAgIG1hcC5zZXQoY29udmVyc2F0aW9uSWQsIHVwZGF0ZWRNc2dzKTtcclxuICAgICAgZGlkVXBkYXRlID0gdHJ1ZTtcclxuICAgICAgYnJlYWs7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGRpZFVwZGF0ZSkge1xyXG4gICAgICB0aGlzLm1lc3NhZ2VzTWFwJC5uZXh0KG1hcCk7XHJcbiAgICB9XHJcbiAgfVxyXG59XHJcbiJdfQ==