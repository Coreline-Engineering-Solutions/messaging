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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVzc2FnaW5nLXN0b3JlLnNlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvbGliL3NlcnZpY2VzL21lc3NhZ2luZy1zdG9yZS5zZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxVQUFVLEVBQWEsTUFBTSxlQUFlLENBQUM7QUFDdEQsT0FBTyxFQUFFLGVBQWUsRUFBRSxVQUFVLEVBQUUsT0FBTyxFQUFnQixRQUFRLEVBQUUsRUFBRSxFQUFFLE1BQU0sTUFBTSxDQUFDO0FBQ3hGLE9BQU8sRUFBRSxVQUFVLEVBQUUsR0FBRyxFQUFFLE1BQU0sZ0JBQWdCLENBQUM7QUFJakQsT0FBTyxFQVFMLHFCQUFxQixHQUV0QixNQUFNLDRCQUE0QixDQUFDOzs7OztBQUdwQyxNQUFNLE9BQU8scUJBQXFCO0lBMkN0QjtJQUNBO0lBQ0E7SUE1Q1YsdUJBQXVCO0lBQ2YsTUFBTSxHQUFHLElBQUksZUFBZSxDQUFjLEVBQUUsQ0FBQyxDQUFDO0lBQzlDLFlBQVksR0FBRyxJQUFJLGVBQWUsQ0FBeUIsSUFBSSxHQUFHLEVBQUUsQ0FBQyxDQUFDO0lBQ3RFLFVBQVUsR0FBRyxJQUFJLGVBQWUsQ0FBZSxFQUFFLENBQUMsQ0FBQztJQUNuRCxnQkFBZ0IsR0FBRyxJQUFJLGVBQWUsQ0FBWSxFQUFFLENBQUMsQ0FBQztJQUN0RCxVQUFVLEdBQUcsSUFBSSxlQUFlLENBQVUsS0FBSyxDQUFDLENBQUM7SUFDakQsV0FBVyxHQUFHLElBQUksZUFBZSxDQUFvRixPQUFPLENBQUMsQ0FBQztJQUM5SCxZQUFZLEdBQUcsSUFBSSxlQUFlLENBQ3ZDLFlBQVksQ0FBQyxPQUFPLENBQUMsd0JBQXdCLENBQWlCLElBQUksT0FBTyxDQUMzRSxDQUFDO0lBQ00scUJBQXFCLEdBQUcsSUFBSSxlQUFlLENBQWdCLElBQUksQ0FBQyxDQUFDO0lBQ2pFLG1CQUFtQixHQUFHLElBQUksZUFBZSxDQUEyQyxJQUFJLENB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QyxPQUFPLENBQUMsS0FBSyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztvQkFDekYsSUFBSSxTQUFTLEtBQUssQ0FBQyxFQUFFLENBQUM7d0JBQ3BCLGFBQWEsQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDO29CQUNoQyxDQUFDO3lCQUFNLENBQUM7d0JBQ04sYUFBYSxDQUFDLElBQUksQ0FBQyxHQUFHOzRCQUNwQixHQUFHLE9BQU87NEJBQ1YsVUFBVSxFQUFFLEtBQUs7NEJBQ2pCLEtBQUssRUFBRSxTQUFTO3lCQUNqQixDQUFDO29CQUNKLENBQUM7Z0JBQ0gsQ0FBQztZQUNILENBQUM7WUFFRCxNQUFNLFVBQVUsR0FBWSxFQUFFLEdBQUcsTUFBTSxFQUFFLFNBQVMsRUFBRSxhQUFhLEVBQUUsQ0FBQztZQUNwRSxNQUFNLFdBQVcsR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUM7WUFDOUIsV0FBVyxDQUFDLEdBQUcsQ0FBQyxHQUFHLFVBQVUsQ0FBQztZQUM5QixHQUFHLENBQUMsR0FBRyxDQUFDLGNBQWMsRUFBRSxXQUFXLENBQUMsQ0FBQztZQUNyQyxTQUFTLEdBQUcsSUFBSSxDQUFDO1lBQ2pCLE1BQU07UUFDUixDQUFDO1FBRUQsSUFBSSxTQUFTLEVBQUUsQ0FBQztZQUNkLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQzlCLENBQUM7SUFDSCxDQUFDO3dHQTE5QlUscUJBQXFCOzRHQUFyQixxQkFBcUIsY0FEUixNQUFNOzs0RkFDbkIscUJBQXFCO2tCQURqQyxVQUFVO21CQUFDLEVBQUUsVUFBVSxFQUFFLE1BQU0sRUFBRSIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEluamVjdGFibGUsIE9uRGVzdHJveSB9IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xuaW1wb3J0IHsgQmVoYXZpb3JTdWJqZWN0LCBPYnNlcnZhYmxlLCBTdWJqZWN0LCBTdWJzY3JpcHRpb24sIGZvcmtKb2luLCBvZiB9IGZyb20gJ3J4anMnO1xuaW1wb3J0IHsgY2F0Y2hFcnJvciwgbWFwIH0gZnJvbSAncnhqcy9vcGVyYXRvcnMnO1xuaW1wb3J0IHsgQXV0aFNlcnZpY2UgfSBmcm9tICcuL2F1dGguc2VydmljZSc7XG5pbXBvcnQgeyBNZXNzYWdpbmdBcGlTZXJ2aWNlIH0gZnJvbSAnLi9tZXNzYWdpbmctYXBpLnNlcnZpY2UnO1xuaW1wb3J0IHsgTWVzc2FnaW5nV2ViU29ja2V0U2VydmljZSB9IGZyb20gJy4vbWVzc2FnaW5nLXdlYnNvY2tldC5zZXJ2aWNlJztcbmltcG9ydCB7XG4gIEluYm94SXRlbSxcbiAgTWVzc2FnZSxcbiAgQXR0YWNobWVudCxcbiAgQ29udGFjdCxcbiAgQ2hhdFdpbmRvdyxcbiAgV2ViU29ja2V0TWVzc2FnZSxcbiAgU2lkZWJhclNpZGUsXG4gIGdldENvbnRhY3REaXNwbGF5TmFtZSxcbiAgZ2V0TWVzc2FnZVNlbmRlck5hbWUsXG59IGZyb20gJy4uL21vZGVscy9tZXNzYWdpbmcubW9kZWxzJztcblxuQEluamVjdGFibGUoeyBwcm92aWRlZEluOiAncm9vdCcgfSlcbmV4cG9ydCBjbGFzcyBNZXNzYWdpbmdTdG9yZVNlcnZpY2UgaW1wbGVtZW50cyBPbkRlc3Ryb3kge1xuICAvLyDilIDilIAgU3RhdGUgc3ViamVjdHMg4pSA4pSAXG4gIHByaXZhdGUgaW5ib3gkID0gbmV3IEJlaGF2aW9yU3ViamVjdDxJbmJveEl0ZW1bXT4oW10pO1xuICBwcml2YXRlIG1lc3NhZ2VzTWFwJCA9IG5ldyBCZWhhdmlvclN1YmplY3Q8TWFwPHN0cmluZywgTWVzc2FnZVtdPj4obmV3IE1hcCgpKTtcbiAgcHJpdmF0ZSBvcGVuQ2hhdHMkID0gbmV3IEJlaGF2aW9yU3ViamVjdDxDaGF0V2luZG93W10+KFtdKTtcbiAgcHJpdmF0ZSB2aXNpYmxlQ29udGFjdHMkID0gbmV3IEJlaGF2aW9yU3ViamVjdDxDb250YWN0W10+KFtdKTtcbiAgcHJpdmF0ZSBwYW5lbE9wZW4kID0gbmV3IEJlaGF2aW9yU3ViamVjdDxib29sZWFuPihmYWxzZSk7XG4gIHByaXZhdGUgYWN0aXZlVmlldyQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PCdpbmJveCcgfCAnY2hhdCcgfCAnbmV3LWNvbnZlcnNhdGlvbicgfCAnZ3JvdXAtbWFuYWdlcicgfCAnY29udmVyc2F0aW9uLXNldHRpbmdzJz4oJ2luYm94Jyk7XG4gIHByaXZhdGUgc2lkZWJhclNpZGUkID0gbmV3IEJlaGF2aW9yU3ViamVjdDxTaWRlYmFyU2lkZT4oXG4gICAgKGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdtZXNzYWdpbmdfc2lkZWJhcl9zaWRlJykgYXMgU2lkZWJhclNpZGUpIHx8ICdyaWdodCdcbiAgKTtcbiAgcHJpdmF0ZSBhY3RpdmVDb252ZXJzYXRpb25JZCQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PHN0cmluZyB8IG51bGw+KG51bGwpO1xuICBwcml2YXRlIHBlbmRpbmdEbVJlY2lwaWVudCQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PHtjb250YWN0SWQ6IHN0cmluZywgbmFtZTogc3RyaW5nfSB8IG51bGw+KG51bGwpO1xuICBwcml2YXRlIHRvdGFsVW5yZWFkJCA9IG5ldyBCZWhhdmlvclN1YmplY3Q8bnVtYmVyPigwKTtcbiAgcHJpdmF0ZSBsb2FkaW5nTWVzc2FnZXMkID0gbmV3IEJlaGF2aW9yU3ViamVjdDxib29sZWFuPihmYWxzZSk7XG4gIHByaXZhdGUgcGFuZWxQb3NpdGlvbiQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PHsgeDogbnVtYmVyOyB5OiBudW1iZXIgfSB8IG51bGw+KG51bGwpO1xuICBwcml2YXRlIHBhbmVsU2l6ZSQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PHsgd2lkdGg6IG51bWJlcjsgaGVpZ2h0OiBudW1iZXIgfT4oeyB3aWR0aDogMzgwLCBoZWlnaHQ6IDU2MCB9KTtcbiAgcHJpdmF0ZSB3YXNPcGVuQmVmb3JlRHJhZyQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PGJvb2xlYW4+KGZhbHNlKTtcblxuICAvLyDilIDilIAgUHVibGljIG9ic2VydmFibGVzIOKUgOKUgFxuICByZWFkb25seSBpbmJveCA9IHRoaXMuaW5ib3gkLmFzT2JzZXJ2YWJsZSgpO1xuICByZWFkb25seSBtZXNzYWdlc01hcCA9IHRoaXMubWVzc2FnZXNNYXAkLmFzT2JzZXJ2YWJsZSgpO1xuICByZWFkb25seSBvcGVuQ2hhdHMgPSB0aGlzLm9wZW5DaGF0cyQuYXNPYnNlcnZhYmxlKCk7XG4gIHJlYWRvbmx5IHZpc2libGVDb250YWN0cyA9IHRoaXMudmlzaWJsZUNvbnRhY3RzJC5hc09ic2VydmFibGUoKTtcbiAgcmVhZG9ubHkgcGFuZWxPcGVuID0gdGhpcy5wYW5lbE9wZW4kLmFzT2JzZXJ2YWJsZSgpO1xuICByZWFkb25seSBhY3RpdmVWaWV3ID0gdGhpcy5hY3RpdmVWaWV3JC5hc09ic2VydmFibGUoKTtcbiAgcmVhZG9ubHkgYWN0aXZlQ29udmVyc2F0aW9uSWQgPSB0aGlzLmFjdGl2ZUNvbnZlcnNhdGlvbklkJC5hc09ic2VydmFibGUoKTtcbiAgcmVhZG9ubHkgdG90YWxVbnJlYWQgPSB0aGlzLnRvdGFsVW5yZWFkJC5hc09ic2VydmFibGUoKTtcbiAgcmVhZG9ubHkgbG9hZGluZ01lc3NhZ2VzID0gdGhpcy5sb2FkaW5nTWVzc2FnZXMkLmFzT2JzZXJ2YWJsZSgpO1xuICB3c1N0YXR1czogT2JzZXJ2YWJsZTxzdHJpbmc+ID0gbmV3IE9ic2VydmFibGU8c3RyaW5nPigpO1xuICByZWFkb25seSBwYW5lbFBvc2l0aW9uID0gdGhpcy5wYW5lbFBvc2l0aW9uJC5hc09ic2VydmFibGUoKTtcbiAgcmVhZG9ubHkgcGFuZWxTaXplID0gdGhpcy5wYW5lbFNpemUkLmFzT2JzZXJ2YWJsZSgpO1xuICByZWFkb25seSB3YXNPcGVuQmVmb3JlRHJhZyA9IHRoaXMud2FzT3BlbkJlZm9yZURyYWckLmFzT2JzZXJ2YWJsZSgpO1xuICByZWFkb25seSBzaWRlYmFyU2lkZSA9IHRoaXMuc2lkZWJhclNpZGUkLmFzT2JzZXJ2YWJsZSgpO1xuXG4gIHByaXZhdGUgd3NTdWI6IFN1YnNjcmlwdGlvbiB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIGRlc3Ryb3kkID0gbmV3IFN1YmplY3Q8dm9pZD4oKTtcbiAgcHJpdmF0ZSBwb2xsVGltZXI6IGFueSA9IG51bGw7XG4gIHByaXZhdGUgZ3JvdXBTZXR0aW5ncyQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PHsgY29udmVyc2F0aW9uSWQ6IHN0cmluZzsgbmFtZTogc3RyaW5nIH0gfCBudWxsPihudWxsKTtcblxuICByZWFkb25seSBncm91cFNldHRpbmdzID0gdGhpcy5ncm91cFNldHRpbmdzJC5hc09ic2VydmFibGUoKTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIGF1dGg6IEF1dGhTZXJ2aWNlLFxuICAgIHByaXZhdGUgYXBpOiBNZXNzYWdpbmdBcGlTZXJ2aWNlLFxuICAgIHByaXZhdGUgd3NTZXJ2aWNlOiBNZXNzYWdpbmdXZWJTb2NrZXRTZXJ2aWNlXG4gICkge1xuICAgICh0aGlzIGFzIGFueSkud3NTdGF0dXMgPSB0aGlzLndzU2VydmljZS5zdGF0dXMkO1xuICB9XG5cbiAgLy8g4pSA4pSAIEluaXRpYWxpemF0aW9uIOKUgOKUgFxuICBpbml0aWFsaXplKCk6IHZvaWQge1xuICAgIGlmICghdGhpcy5hdXRoLmlzQXV0aGVudGljYXRlZCgpKSByZXR1cm47XG5cbiAgICBjb25zdCBjb250YWN0SWQgPSB0aGlzLmF1dGguY29udGFjdElkITtcbiAgICBjb25zdCBzZXNzaW9uR2lkID0gdGhpcy5hdXRoLnNlc3Npb25HaWQhO1xuXG4gICAgdGhpcy5sb2FkSW5ib3goKTtcbiAgICB0aGlzLmxvYWRWaXNpYmxlQ29udGFjdHMoKTtcblxuICAgIHRoaXMud3NTZXJ2aWNlLmNvbm5lY3QoY29udGFjdElkLCBzZXNzaW9uR2lkKTtcbiAgICB0aGlzLmxpc3RlbldlYlNvY2tldCgpO1xuICAgIHRoaXMuc3RhcnRQb2xsaW5nKCk7XG4gIH1cblxuICB0ZWFyZG93bigpOiB2b2lkIHtcbiAgICB0aGlzLnN0b3BQb2xsaW5nKCk7XG4gICAgdGhpcy53c1NlcnZpY2UuZGlzY29ubmVjdCgpO1xuICAgIHRoaXMud3NTdWI/LnVuc3Vic2NyaWJlKCk7XG4gICAgdGhpcy5pbmJveCQubmV4dChbXSk7XG4gICAgdGhpcy5tZXNzYWdlc01hcCQubmV4dChuZXcgTWFwKCkpO1xuICAgIHRoaXMub3BlbkNoYXRzJC5uZXh0KFtdKTtcbiAgICB0aGlzLnBhbmVsT3BlbiQubmV4dChmYWxzZSk7XG4gICAgdGhpcy5hY3RpdmVWaWV3JC5uZXh0KCdpbmJveCcpO1xuICAgIHRoaXMuYWN0aXZlQ29udmVyc2F0aW9uSWQkLm5leHQobnVsbCk7XG4gICAgdGhpcy50b3RhbFVucmVhZCQubmV4dCgwKTtcbiAgfVxuXG4gIC8vIOKUgOKUgCBQb2xsaW5nIGZhbGxiYWNrIChpbmJveCBvbmx5IC0gbWVzc2FnZXMgcmVseSBvbiBXZWJTb2NrZXQpIOKUgOKUgFxuICBwcml2YXRlIHN0YXJ0UG9sbGluZygpOiB2b2lkIHtcbiAgICB0aGlzLnN0b3BQb2xsaW5nKCk7XG4gICAgdGhpcy5wb2xsVGltZXIgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICB0aGlzLmxvYWRJbmJveCgpO1xuICAgIH0sIDMwMDAwKTtcbiAgfVxuXG4gIHByaXZhdGUgc3RvcFBvbGxpbmcoKTogdm9pZCB7XG4gICAgaWYgKHRoaXMucG9sbFRpbWVyKSB7XG4gICAgICBjbGVhckludGVydmFsKHRoaXMucG9sbFRpbWVyKTtcbiAgICAgIHRoaXMucG9sbFRpbWVyID0gbnVsbDtcbiAgICB9XG4gIH1cblxuICBuZ09uRGVzdHJveSgpOiB2b2lkIHtcbiAgICB0aGlzLnRlYXJkb3duKCk7XG4gICAgdGhpcy5kZXN0cm95JC5uZXh0KCk7XG4gICAgdGhpcy5kZXN0cm95JC5jb21wbGV0ZSgpO1xuICB9XG5cbiAgLy8g4pSA4pSAIFBhbmVsIGNvbnRyb2xzIOKUgOKUgFxuICB0b2dnbGVQYW5lbChidXR0b25YPzogbnVtYmVyLCBidXR0b25ZPzogbnVtYmVyKTogdm9pZCB7XG4gICAgaWYgKGJ1dHRvblggIT09IHVuZGVmaW5lZCAmJiBidXR0b25ZICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHRoaXMucGFuZWxQb3NpdGlvbiQubmV4dCh7IHg6IGJ1dHRvblgsIHk6IGJ1dHRvblkgfSk7XG4gICAgfVxuICAgIHRoaXMucGFuZWxPcGVuJC5uZXh0KCF0aGlzLnBhbmVsT3BlbiQudmFsdWUpO1xuICB9XG5cbiAgb3BlblBhbmVsKGJ1dHRvblg/OiBudW1iZXIsIGJ1dHRvblk/OiBudW1iZXIpOiB2b2lkIHtcbiAgICBpZiAoYnV0dG9uWCAhPT0gdW5kZWZpbmVkICYmIGJ1dHRvblkgIT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhpcy5wYW5lbFBvc2l0aW9uJC5uZXh0KHsgeDogYnV0dG9uWCwgeTogYnV0dG9uWSB9KTtcbiAgICB9XG4gICAgdGhpcy5wYW5lbE9wZW4kLm5leHQodHJ1ZSk7XG4gIH1cblxuICBjbG9zZVBhbmVsKCk6IHZvaWQge1xuICAgIHRoaXMucGFuZWxPcGVuJC5uZXh0KGZhbHNlKTtcbiAgfVxuXG4gIHNldFBhbmVsU2l6ZSh3aWR0aDogbnVtYmVyLCBoZWlnaHQ6IG51bWJlcik6IHZvaWQge1xuICAgIHRoaXMucGFuZWxTaXplJC5uZXh0KHsgd2lkdGgsIGhlaWdodCB9KTtcbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnbWVzc2FnaW5nX3BhbmVsX3NpemUnLCBKU09OLnN0cmluZ2lmeSh7IHdpZHRoLCBoZWlnaHQgfSkpO1xuICB9XG5cbiAgZ2V0UGFuZWxTaXplKCk6IHsgd2lkdGg6IG51bWJlcjsgaGVpZ2h0OiBudW1iZXIgfSB7XG4gICAgY29uc3Qgc2F2ZWQgPSBsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnbWVzc2FnaW5nX3BhbmVsX3NpemUnKTtcbiAgICBpZiAoc2F2ZWQpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHBhcnNlZCA9IEpTT04ucGFyc2Uoc2F2ZWQpO1xuICAgICAgICBpZiAocGFyc2VkLndpZHRoICYmIHBhcnNlZC5oZWlnaHQpIHtcbiAgICAgICAgICB0aGlzLnBhbmVsU2l6ZSQubmV4dChwYXJzZWQpO1xuICAgICAgICAgIHJldHVybiBwYXJzZWQ7XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2gge31cbiAgICB9XG4gICAgcmV0dXJuIHRoaXMucGFuZWxTaXplJC52YWx1ZTtcbiAgfVxuXG4gIG9uQnV0dG9uRHJhZ1N0YXJ0KCk6IHZvaWQge1xuICAgIHRoaXMud2FzT3BlbkJlZm9yZURyYWckLm5leHQodGhpcy5wYW5lbE9wZW4kLnZhbHVlKTtcbiAgICBpZiAodGhpcy5wYW5lbE9wZW4kLnZhbHVlKSB7XG4gICAgICB0aGlzLnBhbmVsT3BlbiQubmV4dChmYWxzZSk7XG4gICAgfVxuICB9XG5cbiAgb25CdXR0b25EcmFnRW5kKGJ1dHRvblg6IG51bWJlciwgYnV0dG9uWTogbnVtYmVyKTogdm9pZCB7XG4gICAgaWYgKHRoaXMud2FzT3BlbkJlZm9yZURyYWckLnZhbHVlKSB7XG4gICAgICB0aGlzLm9wZW5QYW5lbChidXR0b25YLCBidXR0b25ZKTtcbiAgICB9XG4gIH1cblxuICBzZXRWaWV3KHZpZXc6ICdpbmJveCcgfCAnY2hhdCcgfCAnbmV3LWNvbnZlcnNhdGlvbicgfCAnZ3JvdXAtbWFuYWdlcicgfCAnY29udmVyc2F0aW9uLXNldHRpbmdzJyk6IHZvaWQge1xuICAgIHRoaXMuYWN0aXZlVmlldyQubmV4dCh2aWV3KTtcbiAgfVxuXG4gIHRvZ2dsZVNpZGViYXJTaWRlKCk6IHZvaWQge1xuICAgIGNvbnN0IG5leHQgPSB0aGlzLnNpZGViYXJTaWRlJC52YWx1ZSA9PT0gJ3JpZ2h0JyA/ICdsZWZ0JyA6ICdyaWdodCc7XG4gICAgdGhpcy5zaWRlYmFyU2lkZSQubmV4dChuZXh0KTtcbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnbWVzc2FnaW5nX3NpZGViYXJfc2lkZScsIG5leHQpO1xuICB9XG5cbiAgZ2V0U2lkZWJhclNpZGUoKTogU2lkZWJhclNpZGUge1xuICAgIHJldHVybiB0aGlzLnNpZGViYXJTaWRlJC52YWx1ZTtcbiAgfVxuXG4gIC8vIOKUgOKUgCBJbmJveCDilIDilIBcbiAgbG9hZEluYm94KCk6IHZvaWQge1xuICAgIGNvbnN0IGNvbnRhY3RJZCA9IHRoaXMuYXV0aC5jb250YWN0SWQ7XG4gICAgaWYgKCFjb250YWN0SWQpIHJldHVybjtcblxuICAgIHRoaXMuYXBpLmdldEluYm94KGNvbnRhY3RJZCkuc3Vic2NyaWJlKHtcbiAgICAgIG5leHQ6IChpdGVtcykgPT4ge1xuICAgICAgICBjb25zdCBtYXBwZWQgPSBpdGVtcy5tYXAoaXRlbSA9PiB7XG4gICAgICAgICAgY29uc3QgaXNHcm91cCA9IGl0ZW0uaXNfZ3JvdXAgPT09IHRydWUgfHwgKGl0ZW0uaXNfZ3JvdXAgYXMgYW55KSA9PT0gJ1RydWUnO1xuICAgICAgICAgIFxuICAgICAgICAgIGlmICghaXNHcm91cCAmJiAhaXRlbS5uYW1lICYmIGl0ZW0ub3RoZXJfcGFydGljaXBhbnRfbmFtZSkge1xuICAgICAgICAgICAgcmV0dXJuIHsgLi4uaXRlbSwgbmFtZTogaXRlbS5vdGhlcl9wYXJ0aWNpcGFudF9uYW1lLCBpc19ncm91cDogZmFsc2UgfTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIHsgLi4uaXRlbSwgaXNfZ3JvdXA6IGlzR3JvdXAgfTtcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuaW5ib3gkLm5leHQobWFwcGVkKTtcbiAgICAgICAgdGhpcy5yZWNhbGNVbnJlYWQobWFwcGVkKTtcblxuICAgICAgICBjb25zdCBpZHMgPSBtYXBwZWQubWFwKChpKSA9PiBpLmNvbnZlcnNhdGlvbl9pZCk7XG4gICAgICAgIHRoaXMud3NTZXJ2aWNlLnN1YnNjcmliZUFsbChpZHMpO1xuICAgICAgfSxcbiAgICAgIGVycm9yOiAoKSA9PiB7fSxcbiAgICB9KTtcbiAgfVxuXG4gIC8vIOKUgOKUgCBDb250YWN0cyDilIDilIBcbiAgbG9hZFZpc2libGVDb250YWN0cygpOiB2b2lkIHtcbiAgICBjb25zdCBjb250YWN0SWQgPSB0aGlzLmF1dGguY29udGFjdElkO1xuICAgIGlmICghY29udGFjdElkKSByZXR1cm47XG5cbiAgICB0aGlzLmFwaS5nZXRWaXNpYmxlQ29udGFjdHMoY29udGFjdElkKS5zdWJzY3JpYmUoe1xuICAgICAgbmV4dDogKGNvbnRhY3RzKSA9PiB7XG4gICAgICAgIHRoaXMudmlzaWJsZUNvbnRhY3RzJC5uZXh0KGNvbnRhY3RzKTtcbiAgICAgICAgXG4gICAgICAgIGNvbnN0IGN1cnJlbnRDb250YWN0ID0gdGhpcy5hdXRoLmN1cnJlbnRDb250YWN0O1xuICAgICAgICBpZiAoY3VycmVudENvbnRhY3QgJiYgY3VycmVudENvbnRhY3QuZW1haWwpIHtcbiAgICAgICAgICBjb25zdCBtYXRjaCA9IGNvbnRhY3RzLmZpbmQoYyA9PiBjLmVtYWlsID09PSBjdXJyZW50Q29udGFjdC5lbWFpbCk7XG4gICAgICAgICAgaWYgKG1hdGNoICYmIG1hdGNoLmNvbnRhY3RfaWQgIT09IGN1cnJlbnRDb250YWN0LmNvbnRhY3RfaWQpIHtcbiAgICAgICAgICAgIHRoaXMuYXV0aC5zZXRTZXNzaW9uKHRoaXMuYXV0aC5zZXNzaW9uR2lkISwgeyAuLi5jdXJyZW50Q29udGFjdCwgY29udGFjdF9pZDogbWF0Y2guY29udGFjdF9pZCB9KTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgdGhpcy53c1NlcnZpY2UuZGlzY29ubmVjdCgpO1xuICAgICAgICAgICAgdGhpcy53c1NlcnZpY2UuY29ubmVjdChtYXRjaC5jb250YWN0X2lkLCB0aGlzLmF1dGguc2Vzc2lvbkdpZCEpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIGVycm9yOiAoKSA9PiB7fSxcbiAgICB9KTtcbiAgfVxuXG4gIC8vIOKUgOKUgCBDb252ZXJzYXRpb25zIOKUgOKUgFxuICBvcGVuQ29udmVyc2F0aW9uKGNvbnZlcnNhdGlvbklkOiBzdHJpbmcsIG5hbWU6IHN0cmluZywgaXNHcm91cCA9IGZhbHNlKTogdm9pZCB7XG4gICAgaWYgKCFjb252ZXJzYXRpb25JZCB8fCBjb252ZXJzYXRpb25JZCA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdGhpcy5hY3RpdmVDb252ZXJzYXRpb25JZCQubmV4dChjb252ZXJzYXRpb25JZCk7XG4gICAgdGhpcy5hY3RpdmVWaWV3JC5uZXh0KCdjaGF0Jyk7XG4gICAgdGhpcy5vcGVuUGFuZWwoKTtcblxuICAgIGNvbnN0IGNoYXRzID0gdGhpcy5vcGVuQ2hhdHMkLnZhbHVlO1xuICAgIGlmICghY2hhdHMuZmluZCgoYykgPT4gYy5jb252ZXJzYXRpb25JZCA9PT0gY29udmVyc2F0aW9uSWQpKSB7XG4gICAgICB0aGlzLm9wZW5DaGF0cyQubmV4dChbXG4gICAgICAgIC4uLmNoYXRzLFxuICAgICAgICB7IGNvbnZlcnNhdGlvbklkLCBuYW1lLCBpc0dyb3VwLCBpc01pbmltaXplZDogZmFsc2UsIHVucmVhZENvdW50OiAwIH0sXG4gICAgICBdKTtcbiAgICB9XG5cbiAgICBjb25zdCBleGlzdGluZyA9IHRoaXMubWVzc2FnZXNNYXAkLnZhbHVlLmdldChjb252ZXJzYXRpb25JZCk7XG4gICAgaWYgKGV4aXN0aW5nICYmIGV4aXN0aW5nLmxlbmd0aCA+IDApIHtcbiAgICAgIC8vIEFscmVhZHkgY2FjaGVkIOKAlCBzaWxlbnQgYmFja2dyb3VuZCByZWZyZXNoIGZvciBuZXcgbWVzc2FnZXMsIHNraXAgcmVhY3Rpb24gaHlkcmF0aW9uXG4gICAgICB0aGlzLmxvYWRNZXNzYWdlcyhjb252ZXJzYXRpb25JZCwgdW5kZWZpbmVkLCB0cnVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5sb2FkTWVzc2FnZXMoY29udmVyc2F0aW9uSWQpO1xuICAgIH1cbiAgICB0aGlzLm1hcmtBc1JlYWQoY29udmVyc2F0aW9uSWQpO1xuICAgIHRoaXMud3NTZXJ2aWNlLnN1YnNjcmliZShjb252ZXJzYXRpb25JZCk7XG4gIH1cblxuICBjbG9zZUNoYXQoY29udmVyc2F0aW9uSWQ6IHN0cmluZyk6IHZvaWQge1xuICAgIGNvbnN0IGNoYXRzID0gdGhpcy5vcGVuQ2hhdHMkLnZhbHVlLmZpbHRlcigoYykgPT4gYy5jb252ZXJzYXRpb25JZCAhPT0gY29udmVyc2F0aW9uSWQpO1xuICAgIHRoaXMub3BlbkNoYXRzJC5uZXh0KGNoYXRzKTtcblxuICAgIGlmICh0aGlzLmFjdGl2ZUNvbnZlcnNhdGlvbklkJC52YWx1ZSA9PT0gY29udmVyc2F0aW9uSWQpIHtcbiAgICAgIHRoaXMuYWN0aXZlQ29udmVyc2F0aW9uSWQkLm5leHQobnVsbCk7XG4gICAgICB0aGlzLmFjdGl2ZVZpZXckLm5leHQoJ2luYm94Jyk7XG4gICAgfVxuICB9XG5cbiAgLy8g4pSA4pSAIE1lc3NhZ2VzIOKUgOKUgFxuICBsb2FkTWVzc2FnZXMoY29udmVyc2F0aW9uSWQ6IHN0cmluZywgYmVmb3JlTWVzc2FnZUlkPzogc3RyaW5nLCBza2lwUmVhY3Rpb25IeWRyYXRpb24gPSBmYWxzZSk6IHZvaWQge1xuICAgIGlmICghY29udmVyc2F0aW9uSWQgfHwgY29udmVyc2F0aW9uSWQgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IGNvbnRhY3RJZCA9IHRoaXMuYXV0aC5jb250YWN0SWQ7XG4gICAgaWYgKCFjb250YWN0SWQpIHJldHVybjtcblxuICAgIHRoaXMubG9hZGluZ01lc3NhZ2VzJC5uZXh0KHRydWUpO1xuXG4gICAgdGhpcy5hcGkuZ2V0TWVzc2FnZXMoY29udmVyc2F0aW9uSWQsIGNvbnRhY3RJZCwgYmVmb3JlTWVzc2FnZUlkLCA1MCkuc3Vic2NyaWJlKHtcbiAgICAgIG5leHQ6IChtZXNzYWdlcykgPT4ge1xuICAgICAgICBjb25zdCBtYXAgPSBuZXcgTWFwKHRoaXMubWVzc2FnZXNNYXAkLnZhbHVlKTtcbiAgICAgICAgY29uc3QgZXhpc3RpbmcgPSBtYXAuZ2V0KGNvbnZlcnNhdGlvbklkKSB8fCBbXTtcblxuICAgICAgICBjb25zdCBub3JtYWxpemVkID0gbWVzc2FnZXMubWFwKChtOiBhbnkpID0+IHRoaXMubm9ybWFsaXplTWVzc2FnZVNoYXBlKG0pKTtcbiAgICAgICAgY29uc3Qgc29ydGVkID0gWy4uLm5vcm1hbGl6ZWRdLnNvcnQoKGEsIGIpID0+IFxuICAgICAgICAgIG5ldyBEYXRlKGEuY3JlYXRlZF9hdCkuZ2V0VGltZSgpIC0gbmV3IERhdGUoYi5jcmVhdGVkX2F0KS5nZXRUaW1lKClcbiAgICAgICAgKTtcblxuICAgICAgICBpZiAoYmVmb3JlTWVzc2FnZUlkKSB7XG4gICAgICAgICAgLy8gUHJlcGVuZCBvbGRlciBtZXNzYWdlcywgcHJlc2VydmluZyBleGlzdGluZyByZWFjdGlvbnNcbiAgICAgICAgICBjb25zdCBtZXJnZWQgPSBbLi4uc29ydGVkLCAuLi5leGlzdGluZ107XG4gICAgICAgICAgbWFwLnNldChjb252ZXJzYXRpb25JZCwgbWVyZ2VkKTtcbiAgICAgICAgfSBlbHNlIGlmIChza2lwUmVhY3Rpb25IeWRyYXRpb24pIHtcbiAgICAgICAgICAvLyBTaWxlbnQgcmVmcmVzaCDigJQgbWVyZ2UgbmV3IG1lc3NhZ2VzIGJ1dCBwcmVzZXJ2ZSBleGlzdGluZyByZWFjdGlvbiBzdGF0ZVxuICAgICAgICAgIGNvbnN0IGV4aXN0aW5nQnlJZCA9IG5ldyBNYXAoZXhpc3RpbmcubWFwKG0gPT4gW1N0cmluZyhtLm1lc3NhZ2VfaWQpLCBtXSkpO1xuICAgICAgICAgIGNvbnN0IG1lcmdlZCA9IHNvcnRlZC5tYXAobSA9PiB7XG4gICAgICAgICAgICBjb25zdCBjYWNoZWQgPSBleGlzdGluZ0J5SWQuZ2V0KFN0cmluZyhtLm1lc3NhZ2VfaWQpKTtcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWQgPyB7IC4uLm0sIHJlYWN0aW9uczogY2FjaGVkLnJlYWN0aW9ucyB9IDogbTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBtYXAuc2V0KGNvbnZlcnNhdGlvbklkLCBtZXJnZWQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG1hcC5zZXQoY29udmVyc2F0aW9uSWQsIHNvcnRlZCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLm1lc3NhZ2VzTWFwJC5uZXh0KG1hcCk7XG4gICAgICAgIGlmICghc2tpcFJlYWN0aW9uSHlkcmF0aW9uKSB7XG4gICAgICAgICAgdGhpcy5oeWRyYXRlUmVhY3Rpb25zRm9yQ29udmVyc2F0aW9uKGNvbnZlcnNhdGlvbklkLCBtYXAuZ2V0KGNvbnZlcnNhdGlvbklkKSB8fCBbXSk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5sb2FkaW5nTWVzc2FnZXMkLm5leHQoZmFsc2UpO1xuICAgICAgfSxcbiAgICAgIGVycm9yOiAoKSA9PiB7XG4gICAgICAgIHRoaXMubG9hZGluZ01lc3NhZ2VzJC5uZXh0KGZhbHNlKTtcbiAgICAgIH0sXG4gICAgfSk7XG4gIH1cblxuICBzZW5kTWVzc2FnZShjb252ZXJzYXRpb25JZDogc3RyaW5nIHwgbnVsbCwgY29udGVudDogc3RyaW5nLCBtZXNzYWdlVHlwZTogJ1RFWFQnIHwgJ0lNQUdFJyA9ICdURVhUJyk6IHZvaWQge1xuICAgIGNvbnN0IGNvbnRhY3RJZCA9IHRoaXMuYXV0aC5jb250YWN0SWQ7XG4gICAgaWYgKCFjb250YWN0SWQpIHJldHVybjtcblxuICAgIGNvbnN0IHBlbmRpbmcgPSB0aGlzLnBlbmRpbmdEbVJlY2lwaWVudCQudmFsdWU7XG4gICAgaWYgKCFjb252ZXJzYXRpb25JZCAmJiBwZW5kaW5nKSB7XG4gICAgICB0aGlzLnNlbmREaXJlY3RNZXNzYWdlKHBlbmRpbmcuY29udGFjdElkLCBjb250ZW50KTtcbiAgICAgIHRoaXMucGVuZGluZ0RtUmVjaXBpZW50JC5uZXh0KG51bGwpO1xuICAgICAgY29uc3QgY2hhdHMgPSB0aGlzLm9wZW5DaGF0cyQudmFsdWUuZmlsdGVyKGMgPT4gYy5jb252ZXJzYXRpb25JZCAhPT0gJ3BlbmRpbmcnKTtcbiAgICAgIHRoaXMub3BlbkNoYXRzJC5uZXh0KGNoYXRzKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoIWNvbnZlcnNhdGlvbklkKSByZXR1cm47XG5cbiAgICB0aGlzLmFwaS5zZW5kTWVzc2FnZShjb252ZXJzYXRpb25JZCwgY29udGFjdElkLCBjb250ZW50LCBtZXNzYWdlVHlwZSkuc3Vic2NyaWJlKHtcbiAgICAgIG5leHQ6IChyZXMpID0+IHtcbiAgICAgICAgY29uc3Qgb3B0aW1pc3RpYzogTWVzc2FnZSA9IHtcbiAgICAgICAgICBtZXNzYWdlX2lkOiAndGVtcC0nICsgRGF0ZS5ub3coKSxcbiAgICAgICAgICBjb252ZXJzYXRpb25faWQ6IGNvbnZlcnNhdGlvbklkLFxuICAgICAgICAgIHNlbmRlcl9pZDogY29udGFjdElkLFxuICAgICAgICAgIHNlbmRlcl9uYW1lOiAnWW91JyxcbiAgICAgICAgICBtZXNzYWdlX3R5cGU6IG1lc3NhZ2VUeXBlLFxuICAgICAgICAgIGNvbnRlbnQsXG4gICAgICAgICAgY3JlYXRlZF9hdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICAgIGlzX3JlYWQ6IHRydWUsXG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuYXBwZW5kTWVzc2FnZShvcHRpbWlzdGljKTtcbiAgICAgIH0sXG4gICAgICBlcnJvcjogKCkgPT4ge30sXG4gICAgfSk7XG4gIH1cblxuICBvcGVuRGlyZWN0Q29udmVyc2F0aW9uKHJlY2lwaWVudENvbnRhY3RJZDogc3RyaW5nLCBkaXNwbGF5TmFtZTogc3RyaW5nKTogdm9pZCB7XG4gICAgY29uc3QgZXhpc3RpbmcgPSB0aGlzLmluYm94JC52YWx1ZS5maW5kKGl0ZW0gPT4gXG4gICAgICAhaXRlbS5pc19ncm91cCAmJiBpdGVtLm5hbWUgPT09IGRpc3BsYXlOYW1lXG4gICAgKTtcbiAgICBcbiAgICBpZiAoZXhpc3RpbmcpIHtcbiAgICAgIHRoaXMucGVuZGluZ0RtUmVjaXBpZW50JC5uZXh0KG51bGwpO1xuICAgICAgdGhpcy5vcGVuQ29udmVyc2F0aW9uKGV4aXN0aW5nLmNvbnZlcnNhdGlvbl9pZCwgZGlzcGxheU5hbWUsIGZhbHNlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5wZW5kaW5nRG1SZWNpcGllbnQkLm5leHQoe2NvbnRhY3RJZDogcmVjaXBpZW50Q29udGFjdElkLCBuYW1lOiBkaXNwbGF5TmFtZX0pO1xuICAgICAgdGhpcy5hY3RpdmVDb252ZXJzYXRpb25JZCQubmV4dChudWxsKTtcbiAgICAgIHRoaXMuYWN0aXZlVmlldyQubmV4dCgnY2hhdCcpO1xuICAgICAgdGhpcy5vcGVuUGFuZWwoKTtcbiAgICAgIFxuICAgICAgY29uc3QgY2hhdHMgPSB0aGlzLm9wZW5DaGF0cyQudmFsdWU7XG4gICAgICBpZiAoIWNoYXRzLmZpbmQoYyA9PiBjLmNvbnZlcnNhdGlvbklkID09PSAncGVuZGluZycpKSB7XG4gICAgICAgIHRoaXMub3BlbkNoYXRzJC5uZXh0KFsuLi5jaGF0cywge1xuICAgICAgICAgIGNvbnZlcnNhdGlvbklkOiAncGVuZGluZycsXG4gICAgICAgICAgbmFtZTogZGlzcGxheU5hbWUsXG4gICAgICAgICAgaXNHcm91cDogZmFsc2UsXG4gICAgICAgICAgaXNNaW5pbWl6ZWQ6IGZhbHNlLFxuICAgICAgICAgIHVucmVhZENvdW50OiAwXG4gICAgICAgIH1dKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBzZW5kRGlyZWN0TWVzc2FnZShyZWNpcGllbnRDb250YWN0SWQ6IHN0cmluZywgY29udGVudDogc3RyaW5nKTogdm9pZCB7XG4gICAgY29uc3QgY29udGFjdElkID0gdGhpcy5hdXRoLmNvbnRhY3RJZDtcbiAgICBpZiAoIWNvbnRhY3RJZCkgcmV0dXJuO1xuXG4gICAgdGhpcy5hcGkuc2VuZERpcmVjdE1lc3NhZ2UoY29udGFjdElkLCByZWNpcGllbnRDb250YWN0SWQsIGNvbnRlbnQpLnN1YnNjcmliZSh7XG4gICAgICBuZXh0OiAocmVzKSA9PiB7XG4gICAgICAgIHRoaXMubG9hZEluYm94KCk7XG4gICAgICAgIC8vIEJhY2tlbmQgbWF5IHJldHVybiBjb252ZXJzYXRpb25faWQsIGlkLCBvciBjb252ZXJzYXRpb25JZFxuICAgICAgICBjb25zdCBjb252SWQgPSBTdHJpbmcocmVzPy5jb252ZXJzYXRpb25faWQgfHwgcmVzPy5pZCB8fCByZXM/LmNvbnZlcnNhdGlvbklkIHx8ICcnKTtcbiAgICAgICAgaWYgKGNvbnZJZCkge1xuICAgICAgICAgIGNvbnN0IHJlY2lwaWVudCA9IHRoaXMudmlzaWJsZUNvbnRhY3RzJC52YWx1ZS5maW5kKFxuICAgICAgICAgICAgKGMpID0+IGMuY29udGFjdF9pZCA9PT0gcmVjaXBpZW50Q29udGFjdElkXG4gICAgICAgICAgKTtcbiAgICAgICAgICBjb25zdCBuYW1lID0gcmVjaXBpZW50ID8gZ2V0Q29udGFjdERpc3BsYXlOYW1lKHJlY2lwaWVudCkgOiAnRGlyZWN0IE1lc3NhZ2UnO1xuICAgICAgICAgIHRoaXMub3BlbkNvbnZlcnNhdGlvbihjb252SWQsIG5hbWUsIGZhbHNlKTtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIGVycm9yOiAoKSA9PiB7fSxcbiAgICB9KTtcbiAgfVxuXG4gIGNyZWF0ZUdyb3VwQ29udmVyc2F0aW9uKHBhcnRpY2lwYW50SWRzOiBzdHJpbmdbXSwgbmFtZTogc3RyaW5nKTogdm9pZCB7XG4gICAgY29uc3QgY29udGFjdElkID0gdGhpcy5hdXRoLmNvbnRhY3RJZDtcbiAgICBpZiAoIWNvbnRhY3RJZCkgcmV0dXJuO1xuXG4gICAgY29uc3QgYWxsUGFydGljaXBhbnRzID0gcGFydGljaXBhbnRJZHMuaW5jbHVkZXMoY29udGFjdElkKVxuICAgICAgPyBwYXJ0aWNpcGFudElkc1xuICAgICAgOiBbY29udGFjdElkLCAuLi5wYXJ0aWNpcGFudElkc107XG5cbiAgICB0aGlzLmFwaS5jcmVhdGVDb252ZXJzYXRpb24oY29udGFjdElkLCBhbGxQYXJ0aWNpcGFudHMsIG5hbWUpLnN1YnNjcmliZSh7XG4gICAgICBuZXh0OiAoY29udikgPT4ge1xuICAgICAgICAvLyBCYWNrZW5kIG1heSByZXR1cm4gY29udmVyc2F0aW9uX2lkLCBpZCwgb3IgY29udmVyc2F0aW9uSWRcbiAgICAgICAgY29uc3QgY29udklkID0gU3RyaW5nKChjb252IGFzIGFueSk/LmNvbnZlcnNhdGlvbl9pZCB8fCAoY29udiBhcyBhbnkpPy5pZCB8fCAoY29udiBhcyBhbnkpPy5jb252ZXJzYXRpb25JZCB8fCAnJyk7XG4gICAgICAgIGlmICghY29udklkKSB7XG4gICAgICAgICAgdGhpcy5sb2FkSW5ib3goKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5sb2FkSW5ib3goKTtcbiAgICAgICAgdGhpcy5vcGVuQ29udmVyc2F0aW9uKGNvbnZJZCwgbmFtZSwgdHJ1ZSk7XG4gICAgICB9LFxuICAgICAgZXJyb3I6ICgpID0+IHt9LFxuICAgIH0pO1xuICB9XG5cbiAgb3Blbkdyb3VwU2V0dGluZ3MoY29udmVyc2F0aW9uSWQ6IHN0cmluZywgbmFtZTogc3RyaW5nKTogdm9pZCB7XG4gICAgdGhpcy5ncm91cFNldHRpbmdzJC5uZXh0KHsgY29udmVyc2F0aW9uSWQsIG5hbWUgfSk7XG4gICAgdGhpcy5zZXRWaWV3KCdncm91cC1tYW5hZ2VyJyk7XG4gIH1cblxuICBjbGVhckdyb3VwU2V0dGluZ3MoKTogdm9pZCB7XG4gICAgdGhpcy5ncm91cFNldHRpbmdzJC5uZXh0KG51bGwpO1xuICB9XG5cbiAgbWFya0FzUmVhZChjb252ZXJzYXRpb25JZDogc3RyaW5nKTogdm9pZCB7XG4gICAgaWYgKCFjb252ZXJzYXRpb25JZCB8fCBjb252ZXJzYXRpb25JZCA9PT0gJ3VuZGVmaW5lZCcpIHJldHVybjtcbiAgICBjb25zdCBjb250YWN0SWQgPSB0aGlzLmF1dGguY29udGFjdElkO1xuICAgIGlmICghY29udGFjdElkKSByZXR1cm47XG5cbiAgICB0aGlzLmFwaS5tYXJrQ29udmVyc2F0aW9uUmVhZChjb252ZXJzYXRpb25JZCwgY29udGFjdElkKS5zdWJzY3JpYmUoe1xuICAgICAgbmV4dDogKCkgPT4ge1xuICAgICAgICBjb25zdCBpdGVtcyA9IHRoaXMuaW5ib3gkLnZhbHVlLm1hcCgoaXRlbSkgPT5cbiAgICAgICAgICBpdGVtLmNvbnZlcnNhdGlvbl9pZCA9PT0gY29udmVyc2F0aW9uSWQgPyB7IC4uLml0ZW0sIHVucmVhZF9jb3VudDogMCB9IDogaXRlbVxuICAgICAgICApO1xuICAgICAgICB0aGlzLmluYm94JC5uZXh0KGl0ZW1zKTtcbiAgICAgICAgdGhpcy5yZWNhbGNVbnJlYWQoaXRlbXMpO1xuICAgICAgfSxcbiAgICAgIGVycm9yOiAoKSA9PiB7fSxcbiAgICB9KTtcbiAgfVxuXG4gIC8vIOKUgOKUgCBHcm91cCBtYW5hZ2VtZW50IOKUgOKUgFxuICBtYW5hZ2VHcm91cChcbiAgICBhY3Rpb246ICdjcmVhdGUnIHwgJ2FkZCcgfCAncmVtb3ZlJyB8ICdyZW5hbWUnLFxuICAgIGNvbnZlcnNhdGlvbklkPzogc3RyaW5nLFxuICAgIGdyb3VwTmFtZT86IHN0cmluZyxcbiAgICBwYXJ0aWNpcGFudENvbnRhY3RJZHM/OiBzdHJpbmdbXVxuICApOiB2b2lkIHtcbiAgICBjb25zdCBjb250YWN0SWQgPSB0aGlzLmF1dGguY29udGFjdElkO1xuICAgIGlmICghY29udGFjdElkKSByZXR1cm47XG5cbiAgICB0aGlzLmFwaS5tYW5hZ2VHcm91cChjb250YWN0SWQsIGFjdGlvbiwgY29udmVyc2F0aW9uSWQsIGdyb3VwTmFtZSwgcGFydGljaXBhbnRDb250YWN0SWRzKS5zdWJzY3JpYmUoe1xuICAgICAgbmV4dDogKCkgPT4gdGhpcy5sb2FkSW5ib3goKSxcbiAgICAgIGVycm9yOiAoKSA9PiB7fSxcbiAgICB9KTtcbiAgfVxuXG4gIC8vIOKUgOKUgCBEZWxldGUgLyBDbGVhciDilIDilIBcbiAgZGVsZXRlQ29udmVyc2F0aW9uKGNvbnZlcnNhdGlvbklkOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBjb25zdCBjb250YWN0SWQgPSB0aGlzLmF1dGguY29udGFjdElkO1xuICAgIGlmICghY29udGFjdElkKSByZXR1cm47XG5cbiAgICB0aGlzLmFwaS5kZWxldGVDb252ZXJzYXRpb24oY29udmVyc2F0aW9uSWQsIGNvbnRhY3RJZCkuc3Vic2NyaWJlKHtcbiAgICAgIG5leHQ6ICgpID0+IHtcbiAgICAgICAgY29uc3QgaXRlbXMgPSB0aGlzLmluYm94JC52YWx1ZS5maWx0ZXIoaSA9PiBpLmNvbnZlcnNhdGlvbl9pZCAhPT0gY29udmVyc2F0aW9uSWQpO1xuICAgICAgICB0aGlzLmluYm94JC5uZXh0KGl0ZW1zKTtcbiAgICAgICAgdGhpcy5yZWNhbGNVbnJlYWQoaXRlbXMpO1xuICAgICAgICBjb25zdCBtYXAgPSBuZXcgTWFwKHRoaXMubWVzc2FnZXNNYXAkLnZhbHVlKTtcbiAgICAgICAgbWFwLmRlbGV0ZShjb252ZXJzYXRpb25JZCk7XG4gICAgICAgIHRoaXMubWVzc2FnZXNNYXAkLm5leHQobWFwKTtcbiAgICAgICAgaWYgKHRoaXMuYWN0aXZlQ29udmVyc2F0aW9uSWQkLnZhbHVlID09PSBjb252ZXJzYXRpb25JZCkge1xuICAgICAgICAgIHRoaXMuYWN0aXZlQ29udmVyc2F0aW9uSWQkLm5leHQobnVsbCk7XG4gICAgICAgICAgdGhpcy5hY3RpdmVWaWV3JC5uZXh0KCdpbmJveCcpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuY2xvc2VDaGF0KGNvbnZlcnNhdGlvbklkKTtcbiAgICAgIH0sXG4gICAgICBlcnJvcjogKCkgPT4ge30sXG4gICAgfSk7XG4gIH1cblxuICBjbGVhckNvbnZlcnNhdGlvbihjb252ZXJzYXRpb25JZDogc3RyaW5nKTogdm9pZCB7XG4gICAgY29uc3QgY29udGFjdElkID0gdGhpcy5hdXRoLmNvbnRhY3RJZDtcbiAgICBpZiAoIWNvbnRhY3RJZCkgcmV0dXJuO1xuXG4gICAgdGhpcy5hcGkuY2xlYXJDb252ZXJzYXRpb24oY29udmVyc2F0aW9uSWQsIGNvbnRhY3RJZCkuc3Vic2NyaWJlKHtcbiAgICAgIG5leHQ6ICgpID0+IHtcbiAgICAgICAgY29uc3QgbWFwID0gbmV3IE1hcCh0aGlzLm1lc3NhZ2VzTWFwJC52YWx1ZSk7XG4gICAgICAgIG1hcC5zZXQoY29udmVyc2F0aW9uSWQsIFtdKTtcbiAgICAgICAgdGhpcy5tZXNzYWdlc01hcCQubmV4dChtYXApO1xuICAgICAgICBjb25zdCBpdGVtcyA9IHRoaXMuaW5ib3gkLnZhbHVlLm1hcChpID0+XG4gICAgICAgICAgaS5jb252ZXJzYXRpb25faWQgPT09IGNvbnZlcnNhdGlvbklkXG4gICAgICAgICAgICA/IHsgLi4uaSwgbGFzdF9tZXNzYWdlX3ByZXZpZXc6ICcnLCBsYXN0X21lc3NhZ2VfYXQ6IGkubGFzdF9tZXNzYWdlX2F0IH1cbiAgICAgICAgICAgIDogaVxuICAgICAgICApO1xuICAgICAgICB0aGlzLmluYm94JC5uZXh0KGl0ZW1zKTtcbiAgICAgIH0sXG4gICAgICBlcnJvcjogKCkgPT4ge30sXG4gICAgfSk7XG4gIH1cblxuICBkZWxldGVHcm91cChjb252ZXJzYXRpb25JZDogc3RyaW5nKTogdm9pZCB7XG4gICAgY29uc3QgY29udGFjdElkID0gdGhpcy5hdXRoLmNvbnRhY3RJZDtcbiAgICBpZiAoIWNvbnRhY3RJZCkgcmV0dXJuO1xuXG4gICAgdGhpcy5hcGkuZGVsZXRlR3JvdXAoY29udmVyc2F0aW9uSWQsIGNvbnRhY3RJZCkuc3Vic2NyaWJlKHtcbiAgICAgIG5leHQ6ICgpID0+IHtcbiAgICAgICAgY29uc3QgaXRlbXMgPSB0aGlzLmluYm94JC52YWx1ZS5maWx0ZXIoaSA9PiBpLmNvbnZlcnNhdGlvbl9pZCAhPT0gY29udmVyc2F0aW9uSWQpO1xuICAgICAgICB0aGlzLmluYm94JC5uZXh0KGl0ZW1zKTtcbiAgICAgICAgdGhpcy5yZWNhbGNVbnJlYWQoaXRlbXMpO1xuICAgICAgICBjb25zdCBtYXAgPSBuZXcgTWFwKHRoaXMubWVzc2FnZXNNYXAkLnZhbHVlKTtcbiAgICAgICAgbWFwLmRlbGV0ZShjb252ZXJzYXRpb25JZCk7XG4gICAgICAgIHRoaXMubWVzc2FnZXNNYXAkLm5leHQobWFwKTtcbiAgICAgICAgaWYgKHRoaXMuYWN0aXZlQ29udmVyc2F0aW9uSWQkLnZhbHVlID09PSBjb252ZXJzYXRpb25JZCkge1xuICAgICAgICAgIHRoaXMuYWN0aXZlQ29udmVyc2F0aW9uSWQkLm5leHQobnVsbCk7XG4gICAgICAgICAgdGhpcy5hY3RpdmVWaWV3JC5uZXh0KCdpbmJveCcpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuY2xvc2VDaGF0KGNvbnZlcnNhdGlvbklkKTtcbiAgICAgIH0sXG4gICAgICBlcnJvcjogKCkgPT4ge30sXG4gICAgfSk7XG4gIH1cblxuICAvLyDilIDilIAgUmVhY3Rpb25zIOKUgOKUgFxuICBhZGRSZWFjdGlvbihtZXNzYWdlSWQ6IHN0cmluZywgZW1vamk6IHN0cmluZyk6IHZvaWQge1xuICAgIGNvbnN0IGNvbnRhY3RJZCA9IHRoaXMuYXV0aC5jb250YWN0SWQ7XG4gICAgaWYgKCFjb250YWN0SWQpIHJldHVybjtcblxuICAgIC8vIEVuZm9yY2Ugb25lIHJlYWN0aW9uIHBlciB1c2VyIOKAlCByZW1vdmUgYW55IGV4aXN0aW5nIHJlYWN0aW9uIHdpdGggYSBkaWZmZXJlbnQgZW1vamlcbiAgICBmb3IgKGNvbnN0IG1zZ3Mgb2YgdGhpcy5tZXNzYWdlc01hcCQudmFsdWUudmFsdWVzKCkpIHtcbiAgICAgIGNvbnN0IG1zZyA9IG1zZ3MuZmluZChtID0+IFN0cmluZyhtLm1lc3NhZ2VfaWQpID09PSBTdHJpbmcobWVzc2FnZUlkKSk7XG4gICAgICBpZiAobXNnPy5yZWFjdGlvbnMpIHtcbiAgICAgICAgZm9yIChjb25zdCByIG9mIG1zZy5yZWFjdGlvbnMpIHtcbiAgICAgICAgICBpZiAoci5oYXNSZWFjdGVkICYmIHIuZW1vamkgIT09IGVtb2ppKSB7XG4gICAgICAgICAgICB0aGlzLmFwcGx5UmVhY3Rpb25PcHRpbWlzdGljYWxseShtZXNzYWdlSWQsIHIuZW1vamksIGZhbHNlKTtcbiAgICAgICAgICAgIHRoaXMuYXBpLnJlbW92ZVJlYWN0aW9uKG1lc3NhZ2VJZCwgY29udGFjdElkLCByLmVtb2ppKS5zdWJzY3JpYmUoeyBlcnJvcjogKCkgPT4ge30gfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBicmVhaztcbiAgICB9XG5cbiAgICAvLyBPcHRpbWlzdGljIFVJIHNvIHVzZXIgc2VlcyByZWFjdGlvbiBpbW1lZGlhdGVseS5cbiAgICB0aGlzLmFwcGx5UmVhY3Rpb25PcHRpbWlzdGljYWxseShtZXNzYWdlSWQsIGVtb2ppLCB0cnVlKTtcblxuICAgIHRoaXMuYXBpLmFkZFJlYWN0aW9uKG1lc3NhZ2VJZCwgY29udGFjdElkLCBlbW9qaSkuc3Vic2NyaWJlKHtcbiAgICAgIG5leHQ6ICgpID0+IHtcbiAgICAgICAgdGhpcy5yZWZyZXNoTWVzc2FnZVJlYWN0aW9ucyhtZXNzYWdlSWQpO1xuICAgICAgfSxcbiAgICAgIGVycm9yOiAoKSA9PiB7XG4gICAgICAgIC8vIFJldmVydCBvcHRpbWlzdGljIHVwZGF0ZSB3aGVuIHJlcXVlc3QgZmFpbHMuXG4gICAgICAgIHRoaXMuYXBwbHlSZWFjdGlvbk9wdGltaXN0aWNhbGx5KG1lc3NhZ2VJZCwgZW1vamksIGZhbHNlKTtcbiAgICAgIH0sXG4gICAgfSk7XG4gIH1cblxuICByZW1vdmVSZWFjdGlvbihtZXNzYWdlSWQ6IHN0cmluZywgZW1vamk6IHN0cmluZyk6IHZvaWQge1xuICAgIGNvbnN0IGNvbnRhY3RJZCA9IHRoaXMuYXV0aC5jb250YWN0SWQ7XG4gICAgaWYgKCFjb250YWN0SWQpIHJldHVybjtcblxuICAgIC8vIE9wdGltaXN0aWMgVUkgc28gdXNlciBzZWVzIHJlYWN0aW9uIHJlbW92YWwgaW1tZWRpYXRlbHkuXG4gICAgdGhpcy5hcHBseVJlYWN0aW9uT3B0aW1pc3RpY2FsbHkobWVzc2FnZUlkLCBlbW9qaSwgZmFsc2UpO1xuXG4gICAgdGhpcy5hcGkucmVtb3ZlUmVhY3Rpb24obWVzc2FnZUlkLCBjb250YWN0SWQsIGVtb2ppKS5zdWJzY3JpYmUoe1xuICAgICAgbmV4dDogKCkgPT4ge1xuICAgICAgICB0aGlzLnJlZnJlc2hNZXNzYWdlUmVhY3Rpb25zKG1lc3NhZ2VJZCk7XG4gICAgICB9LFxuICAgICAgZXJyb3I6ICgpID0+IHtcbiAgICAgICAgLy8gUmV2ZXJ0IG9wdGltaXN0aWMgdXBkYXRlIHdoZW4gcmVxdWVzdCBmYWlscy5cbiAgICAgICAgdGhpcy5hcHBseVJlYWN0aW9uT3B0aW1pc3RpY2FsbHkobWVzc2FnZUlkLCBlbW9qaSwgdHJ1ZSk7XG4gICAgICB9LFxuICAgIH0pO1xuICB9XG5cbiAgZ2V0QWN0aXZlQ29udmVyc2F0aW9uSWQoKTogc3RyaW5nIHwgbnVsbCB7XG4gICAgcmV0dXJuIHRoaXMuYWN0aXZlQ29udmVyc2F0aW9uSWQkLnZhbHVlO1xuICB9XG5cbiAgLy8g4pSA4pSAIEdldHRlcnMg4pSA4pSAXG4gIGdldE1lc3NhZ2VzRm9yQ29udmVyc2F0aW9uKGNvbnZlcnNhdGlvbklkOiBzdHJpbmcpOiBNZXNzYWdlW10ge1xuICAgIHJldHVybiB0aGlzLm1lc3NhZ2VzTWFwJC52YWx1ZS5nZXQoY29udmVyc2F0aW9uSWQpIHx8IFtdO1xuICB9XG5cbiAgZ2V0Q3VycmVudEluYm94KCk6IEluYm94SXRlbVtdIHtcbiAgICByZXR1cm4gdGhpcy5pbmJveCQudmFsdWU7XG4gIH1cblxuICAvLyDilIDilIAgUHJpdmF0ZSBoZWxwZXJzIOKUgOKUgFxuICBwcml2YXRlIGxpc3RlbldlYlNvY2tldCgpOiB2b2lkIHtcbiAgICB0aGlzLndzU3ViPy51bnN1YnNjcmliZSgpO1xuICAgIHRoaXMud3NTdWIgPSB0aGlzLndzU2VydmljZS5vbk1lc3NhZ2UkLnN1YnNjcmliZSgobXNnKSA9PiB0aGlzLmhhbmRsZVdzTWVzc2FnZShtc2cpKTtcbiAgfVxuXG4gIHByaXZhdGUgaGFuZGxlV3NNZXNzYWdlKG1zZzogV2ViU29ja2V0TWVzc2FnZSk6IHZvaWQge1xuICAgIHN3aXRjaCAobXNnLnR5cGUpIHtcbiAgICAgIGNhc2UgJ25ld19tZXNzYWdlJzpcbiAgICAgICAgdGhpcy5oYW5kbGVOZXdNZXNzYWdlKG1zZy5kYXRhKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdjb252ZXJzYXRpb25fdXBkYXRlZCc6XG4gICAgICAgIHRoaXMubG9hZEluYm94KCk7XG4gICAgICAgIGlmICh0aGlzLmFjdGl2ZUNvbnZlcnNhdGlvbklkJC52YWx1ZSkge1xuICAgICAgICAgIHRoaXMubG9hZE1lc3NhZ2VzKHRoaXMuYWN0aXZlQ29udmVyc2F0aW9uSWQkLnZhbHVlKTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ2dyb3VwX3VwZGF0ZWQnOlxuICAgICAgICB0aGlzLmhhbmRsZUdyb3VwVXBkYXRlZChtc2cuZGF0YSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnZXJyb3InOlxuICAgICAgICB0aGlzLmhhbmRsZVdlYlNvY2tldEVycm9yKG1zZy5tZXNzYWdlKTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBoYW5kbGVHcm91cFVwZGF0ZWQoZGF0YTogYW55KTogdm9pZCB7XG4gICAgdGhpcy5sb2FkSW5ib3goKTtcbiAgfVxuXG4gIHByaXZhdGUgaGFuZGxlV2ViU29ja2V0RXJyb3IoZXJyb3JNZXNzYWdlOiBzdHJpbmcgfCB1bmRlZmluZWQpOiB2b2lkIHtcbiAgICB2b2lkIGVycm9yTWVzc2FnZTtcbiAgfVxuXG4gIHByaXZhdGUgaGFuZGxlTmV3TWVzc2FnZShkYXRhOiBhbnkpOiB2b2lkIHtcbiAgICBpZiAoIWRhdGEpIHJldHVybjtcblxuICAgIC8vIFBhc3MgdGhyb3VnaCBmdWxsIHBheWxvYWQgc28gbmVzdGVkIC8gYWx0ZXJuYXRlIGF0dGFjaG1lbnQgZmllbGRzIGFyZSBub3QgZHJvcHBlZC5cbiAgICBjb25zdCBtZXNzYWdlOiBNZXNzYWdlID0gdGhpcy5ub3JtYWxpemVNZXNzYWdlU2hhcGUoZGF0YSk7XG5cbiAgICBjb25zdCBpc0Zyb21PdGhlciA9IFN0cmluZyhtZXNzYWdlLnNlbmRlcl9pZCkgIT09IFN0cmluZyh0aGlzLmF1dGguY29udGFjdElkKTtcblxuICAgIGNvbnN0IGV4aXN0aW5nID0gdGhpcy5tZXNzYWdlc01hcCQudmFsdWUuZ2V0KG1lc3NhZ2UuY29udmVyc2F0aW9uX2lkKSB8fCBbXTtcbiAgICBjb25zdCBpc0R1cGxpY2F0ZSA9IGV4aXN0aW5nLnNvbWUoXG4gICAgICAobSkgPT4gbS5tZXNzYWdlX2lkID09PSBtZXNzYWdlLm1lc3NhZ2VfaWQgfHxcbiAgICAgICAgICAgICAobS5zZW5kZXJfaWQgPT09IG1lc3NhZ2Uuc2VuZGVyX2lkICYmXG4gICAgICAgICAgICAgIG0uY29udGVudCA9PT0gbWVzc2FnZS5jb250ZW50ICYmXG4gICAgICAgICAgICAgIE1hdGguYWJzKG5ldyBEYXRlKG0uY3JlYXRlZF9hdCkuZ2V0VGltZSgpIC0gbmV3IERhdGUobWVzc2FnZS5jcmVhdGVkX2F0KS5nZXRUaW1lKCkpIDwgMjAwMClcbiAgICApO1xuXG4gICAgaWYgKCFpc0R1cGxpY2F0ZSkge1xuICAgICAgdGhpcy5hcHBlbmRNZXNzYWdlKG1lc3NhZ2UpO1xuICAgICAgXG4gICAgICBpZiAoaXNGcm9tT3RoZXIpIHtcbiAgICAgICAgdGhpcy5wbGF5Tm90aWZpY2F0aW9uU291bmQoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLnVwZGF0ZUluYm94UHJldmlldyhtZXNzYWdlKTtcblxuICAgIGlmICh0aGlzLmFjdGl2ZUNvbnZlcnNhdGlvbklkJC52YWx1ZSAhPT0gbWVzc2FnZS5jb252ZXJzYXRpb25faWQpIHtcbiAgICAgIGlmIChpc0Zyb21PdGhlcikge1xuICAgICAgICB0aGlzLmluY3JlbWVudFVucmVhZChtZXNzYWdlLmNvbnZlcnNhdGlvbl9pZCk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMubWFya0FzUmVhZChtZXNzYWdlLmNvbnZlcnNhdGlvbl9pZCk7XG4gICAgfVxuICB9XG5cbiAgLyoqIFB1YmxpYyDigJQgbGV0cyBjb21wb25lbnRzIGFkZCBhbiBvcHRpbWlzdGljIG1lc3NhZ2Ugd2l0aG91dCBhIHJvdW5kLXRyaXAuICovXG4gIGFwcGVuZE9wdGltaXN0aWNNZXNzYWdlKG1lc3NhZ2U6IE1lc3NhZ2UpOiB2b2lkIHtcbiAgICB0aGlzLmFwcGVuZE1lc3NhZ2UobWVzc2FnZSk7XG4gIH1cblxuICBwcml2YXRlIGFwcGVuZE1lc3NhZ2UobWVzc2FnZTogTWVzc2FnZSk6IHZvaWQge1xuICAgIGNvbnN0IG1hcCA9IG5ldyBNYXAodGhpcy5tZXNzYWdlc01hcCQudmFsdWUpO1xuICAgIGNvbnN0IG1zZ3MgPSBbLi4uKG1hcC5nZXQobWVzc2FnZS5jb252ZXJzYXRpb25faWQpIHx8IFtdKSwgbWVzc2FnZV07XG4gICAgbWFwLnNldChtZXNzYWdlLmNvbnZlcnNhdGlvbl9pZCwgbXNncyk7XG4gICAgdGhpcy5tZXNzYWdlc01hcCQubmV4dChtYXApO1xuICAgIHRoaXMucmVmcmVzaE1lc3NhZ2VSZWFjdGlvbnMobWVzc2FnZS5tZXNzYWdlX2lkKTtcbiAgfVxuXG4gIHByaXZhdGUgdXBkYXRlSW5ib3hQcmV2aWV3KG1lc3NhZ2U6IE1lc3NhZ2UpOiB2b2lkIHtcbiAgICBjb25zdCBpdGVtcyA9IHRoaXMuaW5ib3gkLnZhbHVlLm1hcCgoaXRlbSkgPT4ge1xuICAgICAgaWYgKGl0ZW0uY29udmVyc2F0aW9uX2lkID09PSBtZXNzYWdlLmNvbnZlcnNhdGlvbl9pZCkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIC4uLml0ZW0sXG4gICAgICAgICAgbGFzdF9tZXNzYWdlX3ByZXZpZXc6IG1lc3NhZ2UuY29udGVudCB8fCAnW0ltYWdlXScsXG4gICAgICAgICAgbGFzdF9tZXNzYWdlX2F0OiBtZXNzYWdlLmNyZWF0ZWRfYXQsXG4gICAgICAgIH07XG4gICAgICB9XG4gICAgICByZXR1cm4gaXRlbTtcbiAgICB9KTtcblxuICAgIGl0ZW1zLnNvcnQoKGEsIGIpID0+IG5ldyBEYXRlKGIubGFzdF9tZXNzYWdlX2F0KS5nZXRUaW1lKCkgLSBuZXcgRGF0ZShhLmxhc3RfbWVzc2FnZV9hdCkuZ2V0VGltZSgpKTtcbiAgICB0aGlzLmluYm94JC5uZXh0KGl0ZW1zKTtcbiAgfVxuXG4gIHByaXZhdGUgaW5jcmVtZW50VW5yZWFkKGNvbnZlcnNhdGlvbklkOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBjb25zdCBpdGVtcyA9IHRoaXMuaW5ib3gkLnZhbHVlLm1hcCgoaXRlbSkgPT5cbiAgICAgIGl0ZW0uY29udmVyc2F0aW9uX2lkID09PSBjb252ZXJzYXRpb25JZFxuICAgICAgICA/IHsgLi4uaXRlbSwgdW5yZWFkX2NvdW50OiBOdW1iZXIoaXRlbS51bnJlYWRfY291bnQpICsgMSB9XG4gICAgICAgIDogaXRlbVxuICAgICk7XG4gICAgdGhpcy5pbmJveCQubmV4dChpdGVtcyk7XG4gICAgdGhpcy5yZWNhbGNVbnJlYWQoaXRlbXMpO1xuICB9XG5cbiAgLyoqXG4gICAqIE5vcm1hbGl6ZSBiYWNrZW5kIG1lc3NhZ2Ugc2hhcGVzIHNvIFVJIGNhbiByZWxpYWJseSByZW5kZXIgYXR0YWNobWVudHMvbWVkaWEuXG4gICAqIFN1cHBvcnRzIGxlZ2FjeSBhbmQgY3VycmVudCBmaWVsZCBuYW1lcyByZXR1cm5lZCBieSBBUEkvV1MgcGF5bG9hZHMuXG4gICAqL1xuICBwcml2YXRlIG5vcm1hbGl6ZU1lc3NhZ2VTaGFwZShyYXc6IGFueSk6IE1lc3NhZ2Uge1xuICAgIGNvbnN0IGJhc2U6IE1lc3NhZ2UgPSB7XG4gICAgICBtZXNzYWdlX2lkOiBTdHJpbmcocmF3Py5tZXNzYWdlX2lkID8/IHJhdz8uaWQgPz8gJycpLFxuICAgICAgY29udmVyc2F0aW9uX2lkOiBTdHJpbmcocmF3Py5jb252ZXJzYXRpb25faWQgPz8gcmF3Py5jb252ZXJzYXRpb25JZCA/PyAnJyksXG4gICAgICBzZW5kZXJfaWQ6IFN0cmluZyhyYXc/LnNlbmRlcl9pZCA/PyByYXc/LnNlbmRlcklkID8/ICcnKSxcbiAgICAgIHNlbmRlcl9uYW1lOiByYXc/LnNlbmRlcl9uYW1lLFxuICAgICAgc2VuZGVyX3VzZXJuYW1lOiByYXc/LnNlbmRlcl91c2VybmFtZSxcbiAgICAgIHNlbmRlcl9maXJzdF9uYW1lOiByYXc/LnNlbmRlcl9maXJzdF9uYW1lLFxuICAgICAgc2VuZGVyX2xhc3RfbmFtZTogcmF3Py5zZW5kZXJfbGFzdF9uYW1lLFxuICAgICAgbWVzc2FnZV90eXBlOiAocmF3Py5tZXNzYWdlX3R5cGUgPz8gcmF3Py5tZXNzYWdlVHlwZSA/PyAnVEVYVCcpIGFzIE1lc3NhZ2VbJ21lc3NhZ2VfdHlwZSddLFxuICAgICAgY29udGVudDogcmF3Py5jb250ZW50ID8/ICcnLFxuICAgICAgbWVkaWFfdXJsOiByYXc/Lm1lZGlhX3VybCA/PyByYXc/Lm1lZGlhVXJsID8/IHJhdz8udXJsID8/IHJhdz8uZmlsZV91cmwsXG4gICAgICBjcmVhdGVkX2F0OiByYXc/LmNyZWF0ZWRfYXQgPz8gcmF3Py5jcmVhdGVkQXQgPz8gbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgaXNfcmVhZDogcmF3Py5pc19yZWFkLFxuICAgICAgcmVhY3Rpb25zOiByYXc/LnJlYWN0aW9ucyxcbiAgICAgIG1lbnRpb25zOiByYXc/Lm1lbnRpb25zLFxuICAgICAgYXR0YWNobWVudHM6IHJhdz8uYXR0YWNobWVudHMsXG4gICAgICBpc19waW5uZWQ6IHJhdz8uaXNfcGlubmVkLFxuICAgICAgcGlubmVkX2F0OiByYXc/LnBpbm5lZF9hdCxcbiAgICAgIHBpbm5lZF9ieTogcmF3Py5waW5uZWRfYnksXG4gICAgfTtcblxuICAgIGNvbnN0IHV1aWRSZSA9XG4gICAgICAvXlswLTlhLWZdezh9LVswLTlhLWZdezR9LVsxLTVdWzAtOWEtZl17M30tWzg5YWJdWzAtOWEtZl17M30tWzAtOWEtZl17MTJ9JC9pO1xuXG4gICAgLy8gTm9ybWFsaXplIGF0dGFjaG1lbnQgb2JqZWN0cyAoQVBJIG1heSB1c2UgZmlsZUlkIC8gaWQgaW5zdGVhZCBvZiBmaWxlX2lkKS5cbiAgICBpZiAoQXJyYXkuaXNBcnJheShiYXNlLmF0dGFjaG1lbnRzKSAmJiBiYXNlLmF0dGFjaG1lbnRzLmxlbmd0aCA+IDApIHtcbiAgICAgIGNvbnN0IG1hcHBlZDogQXR0YWNobWVudFtdID0gKGJhc2UuYXR0YWNobWVudHMgYXMgYW55W10pLm1hcCgoYSkgPT4gKHtcbiAgICAgICAgZmlsZV9pZDogU3RyaW5nKFxuICAgICAgICAgIGE/LmZpbGVfaWQgPz8gYT8uZmlsZUlkID8/IGE/LmlkID8/IGE/LmF0dGFjaG1lbnRfaWQgPz8gYT8uc3RvcmFnZV9maWxlX2lkID8/ICcnXG4gICAgICAgICkudHJpbSgpLFxuICAgICAgICBmaWxlbmFtZTogU3RyaW5nKGE/LmZpbGVuYW1lID8/IGE/LmZpbGVfbmFtZSA/PyBhPy5uYW1lID8/IGE/Lm9yaWdpbmFsX2ZpbGVuYW1lID8/ICcnKSxcbiAgICAgICAgbWltZV90eXBlOiBhPy5taW1lX3R5cGUgPz8gYT8ubWltZVR5cGUsXG4gICAgICAgIHVybDogYT8udXJsID8/IGE/LmZpbGVfdXJsID8/IGE/LmRvd25sb2FkX3VybCxcbiAgICAgIH0pKS5maWx0ZXIoKGEpID0+ICEhYS5maWxlX2lkICYmICFhLmZpbGVfaWQuc3RhcnRzV2l0aCgndGVtcC0nKSk7XG5cbiAgICAgIGlmIChtYXBwZWQubGVuZ3RoID4gMCkge1xuICAgICAgICByZXR1cm4geyAuLi5iYXNlLCBhdHRhY2htZW50czogbWFwcGVkIH07XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gUmVjb25zdHJ1Y3QgYXR0YWNobWVudHMgZnJvbSBhbHRlcm5hdGUgQVBJIGZpZWxkcy5cbiAgICBsZXQgYXR0YWNobWVudElkczogc3RyaW5nW10gPSBbXTtcbiAgICBpZiAoQXJyYXkuaXNBcnJheShyYXc/LmF0dGFjaG1lbnRfaWRzKSkge1xuICAgICAgYXR0YWNobWVudElkcyA9IHJhdy5hdHRhY2htZW50X2lkcy5tYXAoKHg6IGFueSkgPT4gU3RyaW5nKHgpLnRyaW0oKSkuZmlsdGVyKEJvb2xlYW4pO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIHJhdz8uYXR0YWNobWVudF9pZHMgPT09ICdzdHJpbmcnICYmIHJhdy5hdHRhY2htZW50X2lkcy50cmltKCkpIHtcbiAgICAgIGF0dGFjaG1lbnRJZHMgPSByYXcuYXR0YWNobWVudF9pZHNcbiAgICAgICAgLnNwbGl0KC9bLFxcc10rLylcbiAgICAgICAgLm1hcCgoczogc3RyaW5nKSA9PiBzLnRyaW0oKSlcbiAgICAgICAgLmZpbHRlcihCb29sZWFuKTtcbiAgICB9XG5cbiAgICBpZiAoYXR0YWNobWVudElkcy5sZW5ndGggPT09IDAgJiYgQXJyYXkuaXNBcnJheShyYXc/LmZpbGVfaWRzKSkge1xuICAgICAgYXR0YWNobWVudElkcyA9IHJhdy5maWxlX2lkcy5tYXAoKHg6IGFueSkgPT4gU3RyaW5nKHgpLnRyaW0oKSkuZmlsdGVyKEJvb2xlYW4pO1xuICAgIH1cblxuICAgIGNvbnN0IHB1c2hJZCA9ICh2OiBhbnkpID0+IHtcbiAgICAgIGNvbnN0IHMgPSB2ICE9IG51bGwgJiYgdiAhPT0gJycgPyBTdHJpbmcodikudHJpbSgpIDogJyc7XG4gICAgICBpZiAocyAmJiAhYXR0YWNobWVudElkcy5pbmNsdWRlcyhzKSkgYXR0YWNobWVudElkcy5wdXNoKHMpO1xuICAgIH07XG5cbiAgICBwdXNoSWQocmF3Py5maWxlX2lkKTtcbiAgICBwdXNoSWQocmF3Py5hdHRhY2htZW50X2lkKTtcbiAgICBwdXNoSWQocmF3Py5zdG9yYWdlX2ZpbGVfaWQpO1xuICAgIHB1c2hJZChyYXc/LmJsb2JfaWQpO1xuXG4gICAgLy8gQmFja2VuZCBzdG9yZXMgZmlyc3QgYXR0YWNobWVudCBpZCBpbiBtZXNzYWdpbmcubWVzc2FnZS5tZWRpYV91cmwgKFVVSUQpLCBub3QgYSBwdWJsaWMgVVJMLlxuICAgIGNvbnN0IG1lZGlhQXNJZCA9IFN0cmluZyhiYXNlLm1lZGlhX3VybCB8fCAnJykudHJpbSgpO1xuICAgIGlmIChcbiAgICAgIG1lZGlhQXNJZCAmJlxuICAgICAgIW1lZGlhQXNJZC5zdGFydHNXaXRoKCdodHRwOi8vJykgJiZcbiAgICAgICFtZWRpYUFzSWQuc3RhcnRzV2l0aCgnaHR0cHM6Ly8nKSAmJlxuICAgICAgIW1lZGlhQXNJZC5zdGFydHNXaXRoKCdkYXRhOicpXG4gICAgKSB7XG4gICAgICBwdXNoSWQobWVkaWFBc0lkKTtcbiAgICB9XG5cbiAgICBjb25zdCBjb250ZW50VHJpbSA9IFN0cmluZyhiYXNlLmNvbnRlbnQgfHwgJycpLnRyaW0oKTtcbiAgICBpZiAoYXR0YWNobWVudElkcy5sZW5ndGggPT09IDAgJiYgdXVpZFJlLnRlc3QoY29udGVudFRyaW0pKSB7XG4gICAgICBhdHRhY2htZW50SWRzLnB1c2goY29udGVudFRyaW0pO1xuICAgIH1cbiAgICAvLyBTb21lIEFQSXMgc3RvcmUgc3RvcmFnZSAvIGF0dGFjaG1lbnQgaWQgYXMgbnVtZXJpYyBzdHJpbmcgaW4gY29udGVudCBmb3IgRklMRSBtZXNzYWdlcy5cbiAgICBpZiAoXG4gICAgICBhdHRhY2htZW50SWRzLmxlbmd0aCA9PT0gMCAmJlxuICAgICAgL15cXGQrJC8udGVzdChjb250ZW50VHJpbSkgJiZcbiAgICAgIChiYXNlLm1lc3NhZ2VfdHlwZSA9PT0gJ0ZJTEUnIHx8IGJhc2UubWVzc2FnZV90eXBlID09PSAnSU1BR0UnKVxuICAgICkge1xuICAgICAgYXR0YWNobWVudElkcy5wdXNoKGNvbnRlbnRUcmltKTtcbiAgICB9XG5cbiAgICBjb25zdCBmaWxlbmFtZXM6IHN0cmluZ1tdID0gQXJyYXkuaXNBcnJheShyYXc/LmZpbGVuYW1lcylcbiAgICAgID8gcmF3LmZpbGVuYW1lcy5tYXAoKHg6IGFueSkgPT4gU3RyaW5nKHgpKVxuICAgICAgOiByYXc/LmZpbGVuYW1lXG4gICAgICA/IFtTdHJpbmcocmF3LmZpbGVuYW1lKV1cbiAgICAgIDogcmF3Py5maWxlX25hbWVcbiAgICAgID8gW1N0cmluZyhyYXcuZmlsZV9uYW1lKV1cbiAgICAgIDogYmFzZS5jb250ZW50ICYmICF1dWlkUmUudGVzdChjb250ZW50VHJpbSlcbiAgICAgID8gW1N0cmluZyhiYXNlLmNvbnRlbnQpXVxuICAgICAgOiBbXTtcblxuICAgIGlmIChhdHRhY2htZW50SWRzLmxlbmd0aCA+IDAgfHwgZmlsZW5hbWVzLmxlbmd0aCA+IDApIHtcbiAgICAgIGNvbnN0IGZhbGxiYWNrTWltZSA9IHJhdz8ubWltZV90eXBlID8/IHJhdz8uYXR0YWNobWVudF9taW1lX3R5cGU7XG4gICAgICBjb25zdCB1cmxGYWxsYmFjayA9IHJhdz8uZmlsZV91cmwgPz8gcmF3Py51cmwgPz8gcmF3Py5tZWRpYV91cmwgPz8gcmF3Py5tZWRpYVVybDtcbiAgICAgIGNvbnN0IGlkcyA9IGF0dGFjaG1lbnRJZHMubGVuZ3RoID4gMCA/IGF0dGFjaG1lbnRJZHMgOiBbXTtcbiAgICAgIGNvbnN0IGJ1aWx0OiBBdHRhY2htZW50W10gPSBpZHMubWFwKChpZCwgaWR4KSA9PiAoe1xuICAgICAgICBmaWxlX2lkOiBpZCxcbiAgICAgICAgZmlsZW5hbWU6IGZpbGVuYW1lc1tpZHhdIHx8IGZpbGVuYW1lc1swXSB8fCBgQXR0YWNobWVudCAke2lkeCArIDF9YCxcbiAgICAgICAgbWltZV90eXBlOiBmYWxsYmFja01pbWUsXG4gICAgICAgIHVybDogdXJsRmFsbGJhY2ssXG4gICAgICB9KSk7XG5cbiAgICAgIC8vIEZpbGVuYW1lIG9ubHkgKyBkaXJlY3QgVVJMIChubyBzdG9yYWdlIGlkKTogc3RpbGwgcmVuZGVyYWJsZSBhcyA8aW1nIHNyYz4uXG4gICAgICBpZiAoXG4gICAgICAgIGJ1aWx0Lmxlbmd0aCA9PT0gMCAmJlxuICAgICAgICBmaWxlbmFtZXMubGVuZ3RoID4gMCAmJlxuICAgICAgICB1cmxGYWxsYmFjayAmJlxuICAgICAgICBTdHJpbmcodXJsRmFsbGJhY2spLm1hdGNoKC9eaHR0cHM/OlxcL1xcLy9pKVxuICAgICAgKSB7XG4gICAgICAgIGJ1aWx0LnB1c2goe1xuICAgICAgICAgIGZpbGVfaWQ6ICcnLFxuICAgICAgICAgIGZpbGVuYW1lOiBmaWxlbmFtZXNbMF0sXG4gICAgICAgICAgbWltZV90eXBlOiBmYWxsYmFja01pbWUsXG4gICAgICAgICAgdXJsOiBTdHJpbmcodXJsRmFsbGJhY2spLFxuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgaWYgKGJ1aWx0Lmxlbmd0aCA+IDApIHtcbiAgICAgICAgcmV0dXJuIHsgLi4uYmFzZSwgYXR0YWNobWVudHM6IGJ1aWx0IH07XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGJhc2U7XG4gIH1cblxuICBwcml2YXRlIHBsYXlOb3RpZmljYXRpb25Tb3VuZCgpOiB2b2lkIHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgYXVkaW8gPSBuZXcgQXVkaW8oJ2RhdGE6YXVkaW8vd2F2O2Jhc2U2NCxVa2xHUm5vR0FBQlhRVlpGWm0xMElCQUFBQUFCQUFFQVFCOEFBRUFmQUFBQkFBZ0FaR0YwWVFvR0FBQ0JoWXFGYkYxZmRKaXZySkJoTmpWZ29kRGJxMkVjQmorYTIvTERjaVVGTElITzh0aUpOd2daYUx2dDU1OU5FQXhRcCtQd3RtTWNCamlSMS9MTWVTd0ZKSGZIOE4yUVFBb1VYclRwNjZoVkZBcEduK0R5dm13aEJTdUJ6dkxaaVRZSUdHUzU3T2loVUJFTFRLWGg4YmxsSEFVMmpkWHp6bjB2QlNoK3pQTGFpenNLRkdDejZPeXJXQlFMU0tEZjhzRnVJd1V1ZzgveTI0azNDQmhrdSt6b29WQVJDMHlsNGZHNVpSd0ZObzNWODg1OUx3VW9mc3p5Mm9zN0NoUmdzK2pzcTFnVkMwaWczL0xCYmlNRkxvTFA4dHVKTndnWVpMdnM2S0ZRRVF0TXBlSHh1V1VjQlRhTjFmUE9mUzhGS0g3TTh0cUxPd29VWUxQbzdLdFlGUXRJb04veXdXNGpCUzZDei9MYmlUY0lHR1M3N09paFVCRUxUS1hoOGJsbEhBVTJqZFh6em4wdkJTaCt6UExhaXpzS0ZHQ3o2T3lyV0JVTFNLRGY4c0Z1SXdVdWdzL3kyNGszQ0Joa3Urem9vVkFSQzB5bDRmRzVaUndGTm8zVjg4NTlMd1VvZnN6eTJvczdDaFJncytqc3ExZ1ZDMGlnMy9MQmJpTUZMb0xQOHR1Sk53Z1laTHZzNktGUUVRdE1wZUh4dVdVY0JUYU4xZlBPZlM4RktIN004dHFMT3dvVVlMUG83S3RZRlF0SW9OL3l3VzRqQlM2Q3ovTGJpVGNJR0dTNzdPaWhVQkVMVEtYaDhibGxIQVUyamRYenpuMHZCU2grelBMYWl6c0tGR0N6Nk95cldCVUxTS0RmOHNGdUl3VXVncy95MjRrM0NCaGt1K3pvb1ZBUkMweWw0Zkc1WlJ3Rk5vM1Y4ODU5THdVb2Zzenkyb3M3Q2hSZ3MranNxMWdWQzBpZzMvTEJiaU1GTG9MUDh0dUpOd2dZWkx2czZLRlFFUXRNcGVIeHVXVWNCVGFOMWZQT2ZTOEZLSDdNOHRxTE93b1VZTFBvN0t0WUZRdElvTi95d1c0akJTNkN6L0xiaVRjSUdHUzc3T2loVUJFTFRLWGg4YmxsSEFVMmpkWHp6bjB2QlNoK3pQTGFpenNLRkdDejZPeXJXQlVMU0tEZjhzRnVJd1V1Z3MveTI0azNDQmhrdSt6b29WQVJDMHlsNGZHNVpSd0ZObzNWODg1OUx3VW9mc3p5Mm9zN0NoUmdzK2pzcTFnVkMwaWczL0xCYmlNRkxvTFA4dHVKTndnWVpMdnM2S0ZRRVF0TXBlSHh1V1VjQlRhTjFmUE9mUzhGS0g3TTh0cUxPd29VWUxQbzdLdFlGUXRJb04veXdXNGpCUzZDei9MYmlUY0lHR1M3N09paFVCRUxUS1hoOGJsbEhBVTJqZFh6em4wdkJTaCt6UExhaXpzS0ZHQ3o2T3lyV0JVTFNLRGY4c0Z1SXdVdWdzL3kyNGszQ0Joa3Urem9vVkFSQzB5bDRmRzVaUndGTm8zVjg4NTlMd1VvZnN6eTJvczdDaFJncytqc3ExZ1ZDMGlnMy9MQmJpTUZMb0xQOHR1Sk53Z1laTHZzNktGUUVRdE1wZUh4dVdVY0JUYU4xZlBPZlM4RktIN004dHFMT3dvVVlMUG83S3RZRlF0SW9OL3l3VzRqQlM2Q3ovTGJpVGNJR0dTNzdPaWhVQkVMVEtYaDhibGxIQVUyamRYenpuMHZCU2grelBMYWl6c0tGR0N6Nk95cldCVUxTS0RmOHNGdUl3VXVncy95MjRrM0NCaGt1K3pvb1ZBUkMweWw0Zkc1WlJ3Rk5vM1Y4ODU5THdVb2ZzenknKTtcbiAgICAgIGF1ZGlvLnZvbHVtZSA9IDAuMztcbiAgICAgIGF1ZGlvLnBsYXkoKS5jYXRjaCgoKSA9PiB7fSk7XG4gICAgfSBjYXRjaCB7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSByZWNhbGNVbnJlYWQoaXRlbXM6IEluYm94SXRlbVtdKTogdm9pZCB7XG4gICAgY29uc3QgdG90YWwgPSBpdGVtcy5yZWR1Y2UoKHN1bSwgaSkgPT4gc3VtICsgTnVtYmVyKGkudW5yZWFkX2NvdW50IHx8IDApLCAwKTtcbiAgICB0aGlzLnRvdGFsVW5yZWFkJC5uZXh0KHRvdGFsKTtcbiAgfVxuXG4gIHByaXZhdGUgaHlkcmF0ZVJlYWN0aW9uc0ZvckNvbnZlcnNhdGlvbihjb252ZXJzYXRpb25JZDogc3RyaW5nLCBtZXNzYWdlczogTWVzc2FnZVtdKTogdm9pZCB7XG4gICAgY29uc3QgZmV0Y2hhYmxlID0gbWVzc2FnZXMuZmlsdGVyKFxuICAgICAgKG0pID0+ICEhbS5tZXNzYWdlX2lkICYmICFTdHJpbmcobS5tZXNzYWdlX2lkKS5zdGFydHNXaXRoKCd0ZW1wLScpXG4gICAgKTtcbiAgICBpZiAoIWZldGNoYWJsZS5sZW5ndGgpIHJldHVybjtcblxuICAgIGNvbnN0IGpvYnMgPSBmZXRjaGFibGUubWFwKChtKSA9PlxuICAgICAgdGhpcy5hcGkuZ2V0UmVhY3Rpb25zKG0ubWVzc2FnZV9pZCkucGlwZShcbiAgICAgICAgbWFwKChyb3dzKSA9PiAoeyBtZXNzYWdlSWQ6IG0ubWVzc2FnZV9pZCwgcmVhY3Rpb25zOiB0aGlzLm5vcm1hbGl6ZVJlYWN0aW9uUm93cyhyb3dzKSB9KSksXG4gICAgICAgIGNhdGNoRXJyb3IoKCkgPT4gb2YoeyBtZXNzYWdlSWQ6IG0ubWVzc2FnZV9pZCwgcmVhY3Rpb25zOiBbXSB9KSlcbiAgICAgIClcbiAgICApO1xuXG4gICAgZm9ya0pvaW4oam9icykuc3Vic2NyaWJlKChyZXN1bHRzKSA9PiB7XG4gICAgICBjb25zdCBtYXAgPSBuZXcgTWFwKHRoaXMubWVzc2FnZXNNYXAkLnZhbHVlKTtcbiAgICAgIGNvbnN0IGN1cnJlbnQgPSBbLi4uKG1hcC5nZXQoY29udmVyc2F0aW9uSWQpIHx8IFtdKV07XG4gICAgICBpZiAoIWN1cnJlbnQubGVuZ3RoKSByZXR1cm47XG5cbiAgICAgIGxldCBjaGFuZ2VkID0gZmFsc2U7XG4gICAgICBmb3IgKGNvbnN0IHJlc3VsdCBvZiByZXN1bHRzKSB7XG4gICAgICAgIGNvbnN0IGlkeCA9IGN1cnJlbnQuZmluZEluZGV4KChtKSA9PiBTdHJpbmcobS5tZXNzYWdlX2lkKSA9PT0gU3RyaW5nKHJlc3VsdC5tZXNzYWdlSWQpKTtcbiAgICAgICAgaWYgKGlkeCA9PT0gLTEpIGNvbnRpbnVlO1xuICAgICAgICBjdXJyZW50W2lkeF0gPSB7IC4uLmN1cnJlbnRbaWR4XSwgcmVhY3Rpb25zOiByZXN1bHQucmVhY3Rpb25zIH07XG4gICAgICAgIGNoYW5nZWQgPSB0cnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAoY2hhbmdlZCkge1xuICAgICAgICBtYXAuc2V0KGNvbnZlcnNhdGlvbklkLCBjdXJyZW50KTtcbiAgICAgICAgdGhpcy5tZXNzYWdlc01hcCQubmV4dChtYXApO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSByZWZyZXNoTWVzc2FnZVJlYWN0aW9ucyhtZXNzYWdlSWQ6IHN0cmluZyk6IHZvaWQge1xuICAgIGlmICghbWVzc2FnZUlkIHx8IFN0cmluZyhtZXNzYWdlSWQpLnN0YXJ0c1dpdGgoJ3RlbXAtJykpIHJldHVybjtcblxuICAgIHRoaXMuYXBpLmdldFJlYWN0aW9ucyhtZXNzYWdlSWQpLnN1YnNjcmliZSh7XG4gICAgICBuZXh0OiAocm93cykgPT4ge1xuICAgICAgICBjb25zdCBub3JtYWxpemVkID0gdGhpcy5ub3JtYWxpemVSZWFjdGlvblJvd3Mocm93cyk7XG4gICAgICAgIGNvbnN0IG1hcCA9IG5ldyBNYXAodGhpcy5tZXNzYWdlc01hcCQudmFsdWUpO1xuICAgICAgICBsZXQgY2hhbmdlZCA9IGZhbHNlO1xuXG4gICAgICAgIGZvciAoY29uc3QgW2NvbnZlcnNhdGlvbklkLCBtc2dzXSBvZiBtYXAuZW50cmllcygpKSB7XG4gICAgICAgICAgY29uc3QgaWR4ID0gbXNncy5maW5kSW5kZXgoKG0pID0+IFN0cmluZyhtLm1lc3NhZ2VfaWQpID09PSBTdHJpbmcobWVzc2FnZUlkKSk7XG4gICAgICAgICAgaWYgKGlkeCA9PT0gLTEpIGNvbnRpbnVlO1xuICAgICAgICAgIGNvbnN0IG5leHRNc2dzID0gWy4uLm1zZ3NdO1xuICAgICAgICAgIG5leHRNc2dzW2lkeF0gPSB7IC4uLm5leHRNc2dzW2lkeF0sIHJlYWN0aW9uczogbm9ybWFsaXplZCB9O1xuICAgICAgICAgIG1hcC5zZXQoY29udmVyc2F0aW9uSWQsIG5leHRNc2dzKTtcbiAgICAgICAgICBjaGFuZ2VkID0gdHJ1ZTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChjaGFuZ2VkKSB7XG4gICAgICAgICAgdGhpcy5tZXNzYWdlc01hcCQubmV4dChtYXApO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgZXJyb3I6ICgpID0+IHt9LFxuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBub3JtYWxpemVSZWFjdGlvblJvd3Mocm93czogYW55W10pOiBhbnlbXSB7XG4gICAgY29uc3QgYnlFbW9qaSA9IG5ldyBNYXA8c3RyaW5nLCB7IGVtb2ppOiBzdHJpbmc7IGNvdW50OiBudW1iZXI7IGhhc1JlYWN0ZWQ6IGJvb2xlYW47IHJlYWN0b3JzOiBzdHJpbmdbXSB9PigpO1xuICAgIGNvbnN0IG15Q29udGFjdElkID0gU3RyaW5nKHRoaXMuYXV0aC5jb250YWN0SWQgfHwgJycpO1xuICAgIGNvbnN0IGNvbnRhY3RzID0gdGhpcy52aXNpYmxlQ29udGFjdHMkLnZhbHVlO1xuXG4gICAgZm9yIChjb25zdCByb3cgb2Ygcm93cyB8fCBbXSkge1xuICAgICAgY29uc3QgZW1vamkgPSBTdHJpbmcocm93Py5lbW9qaSB8fCAnJykudHJpbSgpO1xuICAgICAgaWYgKCFlbW9qaSkgY29udGludWU7XG5cbiAgICAgIGNvbnN0IGNvbnRhY3RJZCA9IFN0cmluZyhyb3c/LmNvbnRhY3RfaWQgPz8gcm93Py5jb250YWN0SWQgPz8gJycpO1xuICAgICAgY29uc3QgZXhwbGljaXRIYXNSZWFjdGVkID0gcm93Py5oYXNSZWFjdGVkID8/IHJvdz8uaGFzX3JlYWN0ZWQ7XG4gICAgICBjb25zdCBoYXNSZWFjdGVkID0gZXhwbGljaXRIYXNSZWFjdGVkID09PSB0cnVlIHx8IChjb250YWN0SWQgJiYgY29udGFjdElkID09PSBteUNvbnRhY3RJZCk7XG5cbiAgICAgIGNvbnN0IGNvdW50RnJvbVJvdyA9IE51bWJlcihyb3c/LmNvdW50ID8/IHJvdz8ucmVhY3Rpb25fY291bnQgPz8gMCk7XG4gICAgICBjb25zdCBleGlzdGluZyA9IGJ5RW1vamkuZ2V0KGVtb2ppKSB8fCB7IGVtb2ppLCBjb3VudDogMCwgaGFzUmVhY3RlZDogZmFsc2UsIHJlYWN0b3JzOiBbXSB9O1xuXG4gICAgICAvLyBTb21lIEFQSXMgcmV0dXJuIG9uZSByb3cgcGVyIHJlYWN0aW9uOyBzb21lIHJldHVybiBwcmUtYWdncmVnYXRlZCBjb3VudC5cbiAgICAgIGV4aXN0aW5nLmNvdW50ICs9IGNvdW50RnJvbVJvdyA+IDAgPyBjb3VudEZyb21Sb3cgOiAxO1xuICAgICAgZXhpc3RpbmcuaGFzUmVhY3RlZCA9IGV4aXN0aW5nLmhhc1JlYWN0ZWQgfHwgISFoYXNSZWFjdGVkO1xuXG4gICAgICAvLyBUcmFjayByZWFjdG9yIGRpc3BsYXkgbmFtZXMgd2hlbiBpbmRpdmlkdWFsIGNvbnRhY3RJZCBpcyBhdmFpbGFibGVcbiAgICAgIGlmIChjb250YWN0SWQgJiYgY291bnRGcm9tUm93IDw9IDEpIHtcbiAgICAgICAgbGV0IG5hbWU6IHN0cmluZztcbiAgICAgICAgaWYgKGNvbnRhY3RJZCA9PT0gbXlDb250YWN0SWQpIHtcbiAgICAgICAgICBuYW1lID0gJ1lvdSc7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29uc3QgY29udGFjdCA9IGNvbnRhY3RzLmZpbmQoYyA9PiBTdHJpbmcoYy5jb250YWN0X2lkKSA9PT0gY29udGFjdElkKTtcbiAgICAgICAgICBuYW1lID0gY29udGFjdCA/IGdldENvbnRhY3REaXNwbGF5TmFtZShjb250YWN0KSA6IGBVc2VyICR7Y29udGFjdElkfWA7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFleGlzdGluZy5yZWFjdG9ycy5pbmNsdWRlcyhuYW1lKSkge1xuICAgICAgICAgIGV4aXN0aW5nLnJlYWN0b3JzLnB1c2gobmFtZSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgYnlFbW9qaS5zZXQoZW1vamksIGV4aXN0aW5nKTtcbiAgICB9XG5cbiAgICByZXR1cm4gQXJyYXkuZnJvbShieUVtb2ppLnZhbHVlcygpKS5maWx0ZXIoKHIpID0+IHIuY291bnQgPiAwKTtcbiAgfVxuXG4gIHByaXZhdGUgYXBwbHlSZWFjdGlvbk9wdGltaXN0aWNhbGx5KG1lc3NhZ2VJZDogc3RyaW5nLCBlbW9qaTogc3RyaW5nLCBhZGQ6IGJvb2xlYW4pOiB2b2lkIHtcbiAgICBjb25zdCBtYXAgPSBuZXcgTWFwKHRoaXMubWVzc2FnZXNNYXAkLnZhbHVlKTtcbiAgICBsZXQgZGlkVXBkYXRlID0gZmFsc2U7XG5cbiAgICBmb3IgKGNvbnN0IFtjb252ZXJzYXRpb25JZCwgbXNnc10gb2YgbWFwLmVudHJpZXMoKSkge1xuICAgICAgY29uc3QgaWR4ID0gbXNncy5maW5kSW5kZXgoKG0pID0+IFN0cmluZyhtLm1lc3NhZ2VfaWQpID09PSBTdHJpbmcobWVzc2FnZUlkKSk7XG4gICAgICBpZiAoaWR4ID09PSAtMSkgY29udGludWU7XG5cbiAgICAgIGNvbnN0IHRhcmdldCA9IG1zZ3NbaWR4XTtcbiAgICAgIGNvbnN0IG5leHRSZWFjdGlvbnMgPSBbLi4uKHRhcmdldC5yZWFjdGlvbnMgfHwgW10pXTtcbiAgICAgIGNvbnN0IHJJZHggPSBuZXh0UmVhY3Rpb25zLmZpbmRJbmRleCgocikgPT4gci5lbW9qaSA9PT0gZW1vamkpO1xuXG4gICAgICBpZiAoYWRkKSB7XG4gICAgICAgIGlmIChySWR4ID49IDApIHtcbiAgICAgICAgICBjb25zdCBjdXJyZW50ID0gbmV4dFJlYWN0aW9uc1tySWR4XTtcbiAgICAgICAgICBpZiAoIWN1cnJlbnQuaGFzUmVhY3RlZCkge1xuICAgICAgICAgICAgbmV4dFJlYWN0aW9uc1tySWR4XSA9IHtcbiAgICAgICAgICAgICAgLi4uY3VycmVudCxcbiAgICAgICAgICAgICAgaGFzUmVhY3RlZDogdHJ1ZSxcbiAgICAgICAgICAgICAgY291bnQ6IE51bWJlcihjdXJyZW50LmNvdW50IHx8IDApICsgMSxcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG5leHRSZWFjdGlvbnMucHVzaCh7IGVtb2ppLCBjb3VudDogMSwgaGFzUmVhY3RlZDogdHJ1ZSB9KTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKHJJZHggPj0gMCkge1xuICAgICAgICAgIGNvbnN0IGN1cnJlbnQgPSBuZXh0UmVhY3Rpb25zW3JJZHhdO1xuICAgICAgICAgIGNvbnN0IG5leHRDb3VudCA9IE1hdGgubWF4KE51bWJlcihjdXJyZW50LmNvdW50IHx8IDApIC0gKGN1cnJlbnQuaGFzUmVhY3RlZCA/IDEgOiAwKSwgMCk7XG4gICAgICAgICAgaWYgKG5leHRDb3VudCA9PT0gMCkge1xuICAgICAgICAgICAgbmV4dFJlYWN0aW9ucy5zcGxpY2UocklkeCwgMSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG5leHRSZWFjdGlvbnNbcklkeF0gPSB7XG4gICAgICAgICAgICAgIC4uLmN1cnJlbnQsXG4gICAgICAgICAgICAgIGhhc1JlYWN0ZWQ6IGZhbHNlLFxuICAgICAgICAgICAgICBjb3VudDogbmV4dENvdW50LFxuICAgICAgICAgICAgfTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgY29uc3QgdXBkYXRlZE1zZzogTWVzc2FnZSA9IHsgLi4udGFyZ2V0LCByZWFjdGlvbnM6IG5leHRSZWFjdGlvbnMgfTtcbiAgICAgIGNvbnN0IHVwZGF0ZWRNc2dzID0gWy4uLm1zZ3NdO1xuICAgICAgdXBkYXRlZE1zZ3NbaWR4XSA9IHVwZGF0ZWRNc2c7XG4gICAgICBtYXAuc2V0KGNvbnZlcnNhdGlvbklkLCB1cGRhdGVkTXNncyk7XG4gICAgICBkaWRVcGRhdGUgPSB0cnVlO1xuICAgICAgYnJlYWs7XG4gICAgfVxuXG4gICAgaWYgKGRpZFVwZGF0ZSkge1xuICAgICAgdGhpcy5tZXNzYWdlc01hcCQubmV4dChtYXApO1xuICAgIH1cbiAgfVxufVxuIl19