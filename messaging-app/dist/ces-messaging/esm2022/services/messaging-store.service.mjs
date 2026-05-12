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
            error: (err) => console.error('Failed to load inbox:', err),
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
            error: (err) => console.error('Failed to load contacts:', err),
        });
    }
    // ── Conversations ──
    openConversation(conversationId, name, isGroup = false) {
        if (!conversationId || conversationId === 'undefined') {
            console.error('[Store] openConversation called with invalid conversationId:', conversationId);
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
            console.error('[Store] loadMessages called with invalid conversationId:', conversationId);
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
            error: (err) => {
                console.error('Failed to load messages:', err);
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
            error: (err) => console.error('Failed to send message:', err),
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
            error: (err) => console.error('Failed to send DM:', err),
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
                    console.error('[Store] createGroupConversation: no conversation ID in response', conv);
                    this.loadInbox();
                    return;
                }
                this.loadInbox();
                this.openConversation(convId, name, true);
            },
            error: (err) => console.error('Failed to create group:', err),
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
            error: (err) => console.error('Group action failed:', err),
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
            error: (err) => console.error('Delete conversation failed:', err),
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
            error: (err) => console.error('Clear conversation failed:', err),
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
            error: (err) => console.error('Delete group failed:', err),
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
            error: (err) => {
                console.error('Add reaction failed:', err);
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
            error: (err) => {
                console.error('Remove reaction failed:', err);
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
        if (data.action === 'add' && data.group_name) {
            console.log(`✅ You were added to the group "${data.group_name}"`);
        }
    }
    handleWebSocketError(errorMessage) {
        const contactId = this.auth.contactId;
        if (!errorMessage) {
            console.error('WebSocket error: Unknown error');
            return;
        }
        if (errorMessage.includes('Contact not found') || errorMessage.includes('contact')) {
            console.error(`❌ Messaging contact not found for ID "${contactId}". ` +
                `Ensure a record exists in the messaging.contacts table. ` +
                `If the contact doesn't exist, create one via: POST /messaging/contacts with contact_id="${contactId}". ` +
                `Error: ${errorMessage}`);
        }
        else if (errorMessage.includes('unauthorized') || errorMessage.includes('auth')) {
            console.error(`❌ WebSocket authentication failed. ` +
                `Verify session_gid is valid and not expired. ` +
                `Re-authenticate and call messagingAuth.setSession() again. ` +
                `Error: ${errorMessage}`);
        }
        else if (errorMessage.includes('permission') || errorMessage.includes('forbidden')) {
            console.error(`❌ Permission denied for contact "${contactId}". ` +
                `Ensure the contact has access to the messaging system. ` +
                `Error: ${errorMessage}`);
        }
        else {
            console.error(`❌ WebSocket error: ${errorMessage}`);
        }
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
        catch (err) {
            console.warn('Notification sound failed:', err);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVzc2FnaW5nLXN0b3JlLnNlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvbGliL3NlcnZpY2VzL21lc3NhZ2luZy1zdG9yZS5zZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxVQUFVLEVBQWEsTUFBTSxlQUFlLENBQUM7QUFDdEQsT0FBTyxFQUFFLGVBQWUsRUFBRSxVQUFVLEVBQUUsT0FBTyxFQUFnQixRQUFRLEVBQUUsRUFBRSxFQUFFLE1BQU0sTUFBTSxDQUFDO0FBQ3hGLE9BQU8sRUFBRSxVQUFVLEVBQUUsR0FBRyxFQUFFLE1BQU0sZ0JBQWdCLENBQUM7QUFJakQsT0FBTyxFQVFMLHFCQUFxQixHQUV0QixNQUFNLDRCQUE0QixDQUFDOzs7OztBQUdwQyxNQUFNLE9BQU8scUJBQXFCO0lBMkN0QjtJQUNBO0lBQ0E7SUE1Q1YsdUJBQXVCO0lBQ2YsTUFBTSxHQUFHLElBQUksZUFBZSxDQUFjLEVBQUUsQ0FBQyxDQUFDO0lBQzlDLFlBQVksR0FBRyxJQUFJLGVBQWUsQ0FBeUIsSUFBSSxHQUFHLEVBQUUsQ0FBQyxDQUFDO0lBQ3RFLFVBQVUsR0FBRyxJQUFJLGVBQWUsQ0FBZSxFQUFFLENBQUMsQ0FBQztJQUNuRCxnQkFBZ0IsR0FBRyxJQUFJLGVBQWUsQ0FBWSxFQUFFLENBQUMsQ0FBQztJQUN0RCxVQUFVLEdBQUcsSUFBSSxlQUFlLENBQVUsS0FBSyxDQUFDLENBQUM7SUFDakQsV0FBVyxHQUFHLElBQUksZUFBZSxDQUFvRixPQUFPLENBQUMsQ0FBQztJQUM5SCxZQUFZLEdBQUcsSUFBSSxlQUFlLENBQ3ZDLFlBQVksQ0FBQyxPQUFPLENBQUMsd0JBQXdCLENBQWlCLElBQUksT0FBTyxDQUMzRSxDQUFDO0lBQ00scUJBQXFCLEdBQUcsSUFBSSxlQUFlLENBQWdCLElBQUksQ0FBQyxDQUFDO0lBQ2pFLG1CQUFtQixHQUFHLElBQUksZUFBZSxDQUEyQyxJQUFJLENB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QUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7b0JBQ3pGLElBQUksU0FBUyxLQUFLLENBQUMsRUFBRSxDQUFDO3dCQUNwQixhQUFhLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQztvQkFDaEMsQ0FBQzt5QkFBTSxDQUFDO3dCQUNOLGFBQWEsQ0FBQyxJQUFJLENBQUMsR0FBRzs0QkFDcEIsR0FBRyxPQUFPOzRCQUNWLFVBQVUsRUFBRSxLQUFLOzRCQUNqQixLQUFLLEVBQUUsU0FBUzt5QkFDakIsQ0FBQztvQkFDSixDQUFDO2dCQUNILENBQUM7WUFDSCxDQUFDO1lBRUQsTUFBTSxVQUFVLEdBQVksRUFBRSxHQUFHLE1BQU0sRUFBRSxTQUFTLEVBQUUsYUFBYSxFQUFFLENBQUM7WUFDcEUsTUFBTSxXQUFXLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDO1lBQzlCLFdBQVcsQ0FBQyxHQUFHLENBQUMsR0FBRyxVQUFVLENBQUM7WUFDOUIsR0FBRyxDQUFDLEdBQUcsQ0FBQyxjQUFjLEVBQUUsV0FBVyxDQUFDLENBQUM7WUFDckMsU0FBUyxHQUFHLElBQUksQ0FBQztZQUNqQixNQUFNO1FBQ1IsQ0FBQztRQUVELElBQUksU0FBUyxFQUFFLENBQUM7WUFDZCxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUM5QixDQUFDO0lBQ0gsQ0FBQzt3R0FsZ0NVLHFCQUFxQjs0R0FBckIscUJBQXFCLGNBRFIsTUFBTTs7NEZBQ25CLHFCQUFxQjtrQkFEakMsVUFBVTttQkFBQyxFQUFFLFVBQVUsRUFBRSxNQUFNLEVBQUUiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBJbmplY3RhYmxlLCBPbkRlc3Ryb3kgfSBmcm9tICdAYW5ndWxhci9jb3JlJztcclxuaW1wb3J0IHsgQmVoYXZpb3JTdWJqZWN0LCBPYnNlcnZhYmxlLCBTdWJqZWN0LCBTdWJzY3JpcHRpb24sIGZvcmtKb2luLCBvZiB9IGZyb20gJ3J4anMnO1xyXG5pbXBvcnQgeyBjYXRjaEVycm9yLCBtYXAgfSBmcm9tICdyeGpzL29wZXJhdG9ycyc7XHJcbmltcG9ydCB7IEF1dGhTZXJ2aWNlIH0gZnJvbSAnLi9hdXRoLnNlcnZpY2UnO1xyXG5pbXBvcnQgeyBNZXNzYWdpbmdBcGlTZXJ2aWNlIH0gZnJvbSAnLi9tZXNzYWdpbmctYXBpLnNlcnZpY2UnO1xyXG5pbXBvcnQgeyBNZXNzYWdpbmdXZWJTb2NrZXRTZXJ2aWNlIH0gZnJvbSAnLi9tZXNzYWdpbmctd2Vic29ja2V0LnNlcnZpY2UnO1xyXG5pbXBvcnQge1xyXG4gIEluYm94SXRlbSxcclxuICBNZXNzYWdlLFxyXG4gIEF0dGFjaG1lbnQsXHJcbiAgQ29udGFjdCxcclxuICBDaGF0V2luZG93LFxyXG4gIFdlYlNvY2tldE1lc3NhZ2UsXHJcbiAgU2lkZWJhclNpZGUsXHJcbiAgZ2V0Q29udGFjdERpc3BsYXlOYW1lLFxyXG4gIGdldE1lc3NhZ2VTZW5kZXJOYW1lLFxyXG59IGZyb20gJy4uL21vZGVscy9tZXNzYWdpbmcubW9kZWxzJztcclxuXHJcbkBJbmplY3RhYmxlKHsgcHJvdmlkZWRJbjogJ3Jvb3QnIH0pXHJcbmV4cG9ydCBjbGFzcyBNZXNzYWdpbmdTdG9yZVNlcnZpY2UgaW1wbGVtZW50cyBPbkRlc3Ryb3kge1xyXG4gIC8vIOKUgOKUgCBTdGF0ZSBzdWJqZWN0cyDilIDilIBcclxuICBwcml2YXRlIGluYm94JCA9IG5ldyBCZWhhdmlvclN1YmplY3Q8SW5ib3hJdGVtW10+KFtdKTtcclxuICBwcml2YXRlIG1lc3NhZ2VzTWFwJCA9IG5ldyBCZWhhdmlvclN1YmplY3Q8TWFwPHN0cmluZywgTWVzc2FnZVtdPj4obmV3IE1hcCgpKTtcclxuICBwcml2YXRlIG9wZW5DaGF0cyQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PENoYXRXaW5kb3dbXT4oW10pO1xyXG4gIHByaXZhdGUgdmlzaWJsZUNvbnRhY3RzJCA9IG5ldyBCZWhhdmlvclN1YmplY3Q8Q29udGFjdFtdPihbXSk7XHJcbiAgcHJpdmF0ZSBwYW5lbE9wZW4kID0gbmV3IEJlaGF2aW9yU3ViamVjdDxib29sZWFuPihmYWxzZSk7XHJcbiAgcHJpdmF0ZSBhY3RpdmVWaWV3JCA9IG5ldyBCZWhhdmlvclN1YmplY3Q8J2luYm94JyB8ICdjaGF0JyB8ICduZXctY29udmVyc2F0aW9uJyB8ICdncm91cC1tYW5hZ2VyJyB8ICdjb252ZXJzYXRpb24tc2V0dGluZ3MnPignaW5ib3gnKTtcclxuICBwcml2YXRlIHNpZGViYXJTaWRlJCA9IG5ldyBCZWhhdmlvclN1YmplY3Q8U2lkZWJhclNpZGU+KFxyXG4gICAgKGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdtZXNzYWdpbmdfc2lkZWJhcl9zaWRlJykgYXMgU2lkZWJhclNpZGUpIHx8ICdyaWdodCdcclxuICApO1xyXG4gIHByaXZhdGUgYWN0aXZlQ29udmVyc2F0aW9uSWQkID0gbmV3IEJlaGF2aW9yU3ViamVjdDxzdHJpbmcgfCBudWxsPihudWxsKTtcclxuICBwcml2YXRlIHBlbmRpbmdEbVJlY2lwaWVudCQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PHtjb250YWN0SWQ6IHN0cmluZywgbmFtZTogc3RyaW5nfSB8IG51bGw+KG51bGwpO1xyXG4gIHByaXZhdGUgdG90YWxVbnJlYWQkID0gbmV3IEJlaGF2aW9yU3ViamVjdDxudW1iZXI+KDApO1xyXG4gIHByaXZhdGUgbG9hZGluZ01lc3NhZ2VzJCA9IG5ldyBCZWhhdmlvclN1YmplY3Q8Ym9vbGVhbj4oZmFsc2UpO1xyXG4gIHByaXZhdGUgcGFuZWxQb3NpdGlvbiQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PHsgeDogbnVtYmVyOyB5OiBudW1iZXIgfSB8IG51bGw+KG51bGwpO1xyXG4gIHByaXZhdGUgcGFuZWxTaXplJCA9IG5ldyBCZWhhdmlvclN1YmplY3Q8eyB3aWR0aDogbnVtYmVyOyBoZWlnaHQ6IG51bWJlciB9Pih7IHdpZHRoOiAzODAsIGhlaWdodDogNTYwIH0pO1xyXG4gIHByaXZhdGUgd2FzT3BlbkJlZm9yZURyYWckID0gbmV3IEJlaGF2aW9yU3ViamVjdDxib29sZWFuPihmYWxzZSk7XHJcblxyXG4gIC8vIOKUgOKUgCBQdWJsaWMgb2JzZXJ2YWJsZXMg4pSA4pSAXHJcbiAgcmVhZG9ubHkgaW5ib3ggPSB0aGlzLmluYm94JC5hc09ic2VydmFibGUoKTtcclxuICByZWFkb25seSBtZXNzYWdlc01hcCA9IHRoaXMubWVzc2FnZXNNYXAkLmFzT2JzZXJ2YWJsZSgpO1xyXG4gIHJlYWRvbmx5IG9wZW5DaGF0cyA9IHRoaXMub3BlbkNoYXRzJC5hc09ic2VydmFibGUoKTtcclxuICByZWFkb25seSB2aXNpYmxlQ29udGFjdHMgPSB0aGlzLnZpc2libGVDb250YWN0cyQuYXNPYnNlcnZhYmxlKCk7XHJcbiAgcmVhZG9ubHkgcGFuZWxPcGVuID0gdGhpcy5wYW5lbE9wZW4kLmFzT2JzZXJ2YWJsZSgpO1xyXG4gIHJlYWRvbmx5IGFjdGl2ZVZpZXcgPSB0aGlzLmFjdGl2ZVZpZXckLmFzT2JzZXJ2YWJsZSgpO1xyXG4gIHJlYWRvbmx5IGFjdGl2ZUNvbnZlcnNhdGlvbklkID0gdGhpcy5hY3RpdmVDb252ZXJzYXRpb25JZCQuYXNPYnNlcnZhYmxlKCk7XHJcbiAgcmVhZG9ubHkgdG90YWxVbnJlYWQgPSB0aGlzLnRvdGFsVW5yZWFkJC5hc09ic2VydmFibGUoKTtcclxuICByZWFkb25seSBsb2FkaW5nTWVzc2FnZXMgPSB0aGlzLmxvYWRpbmdNZXNzYWdlcyQuYXNPYnNlcnZhYmxlKCk7XHJcbiAgd3NTdGF0dXM6IE9ic2VydmFibGU8c3RyaW5nPiA9IG5ldyBPYnNlcnZhYmxlPHN0cmluZz4oKTtcclxuICByZWFkb25seSBwYW5lbFBvc2l0aW9uID0gdGhpcy5wYW5lbFBvc2l0aW9uJC5hc09ic2VydmFibGUoKTtcclxuICByZWFkb25seSBwYW5lbFNpemUgPSB0aGlzLnBhbmVsU2l6ZSQuYXNPYnNlcnZhYmxlKCk7XHJcbiAgcmVhZG9ubHkgd2FzT3BlbkJlZm9yZURyYWcgPSB0aGlzLndhc09wZW5CZWZvcmVEcmFnJC5hc09ic2VydmFibGUoKTtcclxuICByZWFkb25seSBzaWRlYmFyU2lkZSA9IHRoaXMuc2lkZWJhclNpZGUkLmFzT2JzZXJ2YWJsZSgpO1xyXG5cclxuICBwcml2YXRlIHdzU3ViOiBTdWJzY3JpcHRpb24gfCBudWxsID0gbnVsbDtcclxuICBwcml2YXRlIGRlc3Ryb3kkID0gbmV3IFN1YmplY3Q8dm9pZD4oKTtcclxuICBwcml2YXRlIHBvbGxUaW1lcjogYW55ID0gbnVsbDtcclxuICBwcml2YXRlIGdyb3VwU2V0dGluZ3MkID0gbmV3IEJlaGF2aW9yU3ViamVjdDx7IGNvbnZlcnNhdGlvbklkOiBzdHJpbmc7IG5hbWU6IHN0cmluZyB9IHwgbnVsbD4obnVsbCk7XHJcblxyXG4gIHJlYWRvbmx5IGdyb3VwU2V0dGluZ3MgPSB0aGlzLmdyb3VwU2V0dGluZ3MkLmFzT2JzZXJ2YWJsZSgpO1xyXG5cclxuICBjb25zdHJ1Y3RvcihcclxuICAgIHByaXZhdGUgYXV0aDogQXV0aFNlcnZpY2UsXHJcbiAgICBwcml2YXRlIGFwaTogTWVzc2FnaW5nQXBpU2VydmljZSxcclxuICAgIHByaXZhdGUgd3NTZXJ2aWNlOiBNZXNzYWdpbmdXZWJTb2NrZXRTZXJ2aWNlXHJcbiAgKSB7XHJcbiAgICAodGhpcyBhcyBhbnkpLndzU3RhdHVzID0gdGhpcy53c1NlcnZpY2Uuc3RhdHVzJDtcclxuICB9XHJcblxyXG4gIC8vIOKUgOKUgCBJbml0aWFsaXphdGlvbiDilIDilIBcclxuICBpbml0aWFsaXplKCk6IHZvaWQge1xyXG4gICAgaWYgKCF0aGlzLmF1dGguaXNBdXRoZW50aWNhdGVkKCkpIHJldHVybjtcclxuXHJcbiAgICBjb25zdCBjb250YWN0SWQgPSB0aGlzLmF1dGguY29udGFjdElkITtcclxuICAgIGNvbnN0IHNlc3Npb25HaWQgPSB0aGlzLmF1dGguc2Vzc2lvbkdpZCE7XHJcblxyXG4gICAgdGhpcy5sb2FkSW5ib3goKTtcclxuICAgIHRoaXMubG9hZFZpc2libGVDb250YWN0cygpO1xyXG5cclxuICAgIHRoaXMud3NTZXJ2aWNlLmNvbm5lY3QoY29udGFjdElkLCBzZXNzaW9uR2lkKTtcclxuICAgIHRoaXMubGlzdGVuV2ViU29ja2V0KCk7XHJcbiAgICB0aGlzLnN0YXJ0UG9sbGluZygpO1xyXG4gIH1cclxuXHJcbiAgdGVhcmRvd24oKTogdm9pZCB7XHJcbiAgICB0aGlzLnN0b3BQb2xsaW5nKCk7XHJcbiAgICB0aGlzLndzU2VydmljZS5kaXNjb25uZWN0KCk7XHJcbiAgICB0aGlzLndzU3ViPy51bnN1YnNjcmliZSgpO1xyXG4gICAgdGhpcy5pbmJveCQubmV4dChbXSk7XHJcbiAgICB0aGlzLm1lc3NhZ2VzTWFwJC5uZXh0KG5ldyBNYXAoKSk7XHJcbiAgICB0aGlzLm9wZW5DaGF0cyQubmV4dChbXSk7XHJcbiAgICB0aGlzLnBhbmVsT3BlbiQubmV4dChmYWxzZSk7XHJcbiAgICB0aGlzLmFjdGl2ZVZpZXckLm5leHQoJ2luYm94Jyk7XHJcbiAgICB0aGlzLmFjdGl2ZUNvbnZlcnNhdGlvbklkJC5uZXh0KG51bGwpO1xyXG4gICAgdGhpcy50b3RhbFVucmVhZCQubmV4dCgwKTtcclxuICB9XHJcblxyXG4gIC8vIOKUgOKUgCBQb2xsaW5nIGZhbGxiYWNrIChpbmJveCBvbmx5IC0gbWVzc2FnZXMgcmVseSBvbiBXZWJTb2NrZXQpIOKUgOKUgFxyXG4gIHByaXZhdGUgc3RhcnRQb2xsaW5nKCk6IHZvaWQge1xyXG4gICAgdGhpcy5zdG9wUG9sbGluZygpO1xyXG4gICAgdGhpcy5wb2xsVGltZXIgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XHJcbiAgICAgIHRoaXMubG9hZEluYm94KCk7XHJcbiAgICB9LCAzMDAwMCk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHN0b3BQb2xsaW5nKCk6IHZvaWQge1xyXG4gICAgaWYgKHRoaXMucG9sbFRpbWVyKSB7XHJcbiAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy5wb2xsVGltZXIpO1xyXG4gICAgICB0aGlzLnBvbGxUaW1lciA9IG51bGw7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBuZ09uRGVzdHJveSgpOiB2b2lkIHtcclxuICAgIHRoaXMudGVhcmRvd24oKTtcclxuICAgIHRoaXMuZGVzdHJveSQubmV4dCgpO1xyXG4gICAgdGhpcy5kZXN0cm95JC5jb21wbGV0ZSgpO1xyXG4gIH1cclxuXHJcbiAgLy8g4pSA4pSAIFBhbmVsIGNvbnRyb2xzIOKUgOKUgFxyXG4gIHRvZ2dsZVBhbmVsKGJ1dHRvblg/OiBudW1iZXIsIGJ1dHRvblk/OiBudW1iZXIpOiB2b2lkIHtcclxuICAgIGlmIChidXR0b25YICE9PSB1bmRlZmluZWQgJiYgYnV0dG9uWSAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgIHRoaXMucGFuZWxQb3NpdGlvbiQubmV4dCh7IHg6IGJ1dHRvblgsIHk6IGJ1dHRvblkgfSk7XHJcbiAgICB9XHJcbiAgICB0aGlzLnBhbmVsT3BlbiQubmV4dCghdGhpcy5wYW5lbE9wZW4kLnZhbHVlKTtcclxuICB9XHJcblxyXG4gIG9wZW5QYW5lbChidXR0b25YPzogbnVtYmVyLCBidXR0b25ZPzogbnVtYmVyKTogdm9pZCB7XHJcbiAgICBpZiAoYnV0dG9uWCAhPT0gdW5kZWZpbmVkICYmIGJ1dHRvblkgIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICB0aGlzLnBhbmVsUG9zaXRpb24kLm5leHQoeyB4OiBidXR0b25YLCB5OiBidXR0b25ZIH0pO1xyXG4gICAgfVxyXG4gICAgdGhpcy5wYW5lbE9wZW4kLm5leHQodHJ1ZSk7XHJcbiAgfVxyXG5cclxuICBjbG9zZVBhbmVsKCk6IHZvaWQge1xyXG4gICAgdGhpcy5wYW5lbE9wZW4kLm5leHQoZmFsc2UpO1xyXG4gIH1cclxuXHJcbiAgc2V0UGFuZWxTaXplKHdpZHRoOiBudW1iZXIsIGhlaWdodDogbnVtYmVyKTogdm9pZCB7XHJcbiAgICB0aGlzLnBhbmVsU2l6ZSQubmV4dCh7IHdpZHRoLCBoZWlnaHQgfSk7XHJcbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnbWVzc2FnaW5nX3BhbmVsX3NpemUnLCBKU09OLnN0cmluZ2lmeSh7IHdpZHRoLCBoZWlnaHQgfSkpO1xyXG4gIH1cclxuXHJcbiAgZ2V0UGFuZWxTaXplKCk6IHsgd2lkdGg6IG51bWJlcjsgaGVpZ2h0OiBudW1iZXIgfSB7XHJcbiAgICBjb25zdCBzYXZlZCA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdtZXNzYWdpbmdfcGFuZWxfc2l6ZScpO1xyXG4gICAgaWYgKHNhdmVkKSB7XHJcbiAgICAgIHRyeSB7XHJcbiAgICAgICAgY29uc3QgcGFyc2VkID0gSlNPTi5wYXJzZShzYXZlZCk7XHJcbiAgICAgICAgaWYgKHBhcnNlZC53aWR0aCAmJiBwYXJzZWQuaGVpZ2h0KSB7XHJcbiAgICAgICAgICB0aGlzLnBhbmVsU2l6ZSQubmV4dChwYXJzZWQpO1xyXG4gICAgICAgICAgcmV0dXJuIHBhcnNlZDtcclxuICAgICAgICB9XHJcbiAgICAgIH0gY2F0Y2gge31cclxuICAgIH1cclxuICAgIHJldHVybiB0aGlzLnBhbmVsU2l6ZSQudmFsdWU7XHJcbiAgfVxyXG5cclxuICBvbkJ1dHRvbkRyYWdTdGFydCgpOiB2b2lkIHtcclxuICAgIHRoaXMud2FzT3BlbkJlZm9yZURyYWckLm5leHQodGhpcy5wYW5lbE9wZW4kLnZhbHVlKTtcclxuICAgIGlmICh0aGlzLnBhbmVsT3BlbiQudmFsdWUpIHtcclxuICAgICAgdGhpcy5wYW5lbE9wZW4kLm5leHQoZmFsc2UpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgb25CdXR0b25EcmFnRW5kKGJ1dHRvblg6IG51bWJlciwgYnV0dG9uWTogbnVtYmVyKTogdm9pZCB7XHJcbiAgICBpZiAodGhpcy53YXNPcGVuQmVmb3JlRHJhZyQudmFsdWUpIHtcclxuICAgICAgdGhpcy5vcGVuUGFuZWwoYnV0dG9uWCwgYnV0dG9uWSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBzZXRWaWV3KHZpZXc6ICdpbmJveCcgfCAnY2hhdCcgfCAnbmV3LWNvbnZlcnNhdGlvbicgfCAnZ3JvdXAtbWFuYWdlcicgfCAnY29udmVyc2F0aW9uLXNldHRpbmdzJyk6IHZvaWQge1xyXG4gICAgdGhpcy5hY3RpdmVWaWV3JC5uZXh0KHZpZXcpO1xyXG4gIH1cclxuXHJcbiAgdG9nZ2xlU2lkZWJhclNpZGUoKTogdm9pZCB7XHJcbiAgICBjb25zdCBuZXh0ID0gdGhpcy5zaWRlYmFyU2lkZSQudmFsdWUgPT09ICdyaWdodCcgPyAnbGVmdCcgOiAncmlnaHQnO1xyXG4gICAgdGhpcy5zaWRlYmFyU2lkZSQubmV4dChuZXh0KTtcclxuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdtZXNzYWdpbmdfc2lkZWJhcl9zaWRlJywgbmV4dCk7XHJcbiAgfVxyXG5cclxuICBnZXRTaWRlYmFyU2lkZSgpOiBTaWRlYmFyU2lkZSB7XHJcbiAgICByZXR1cm4gdGhpcy5zaWRlYmFyU2lkZSQudmFsdWU7XHJcbiAgfVxyXG5cclxuICAvLyDilIDilIAgSW5ib3gg4pSA4pSAXHJcbiAgbG9hZEluYm94KCk6IHZvaWQge1xyXG4gICAgY29uc3QgY29udGFjdElkID0gdGhpcy5hdXRoLmNvbnRhY3RJZDtcclxuICAgIGlmICghY29udGFjdElkKSByZXR1cm47XHJcblxyXG4gICAgdGhpcy5hcGkuZ2V0SW5ib3goY29udGFjdElkKS5zdWJzY3JpYmUoe1xyXG4gICAgICBuZXh0OiAoaXRlbXMpID0+IHtcclxuICAgICAgICBjb25zdCBtYXBwZWQgPSBpdGVtcy5tYXAoaXRlbSA9PiB7XHJcbiAgICAgICAgICBjb25zdCBpc0dyb3VwID0gaXRlbS5pc19ncm91cCA9PT0gdHJ1ZSB8fCAoaXRlbS5pc19ncm91cCBhcyBhbnkpID09PSAnVHJ1ZSc7XHJcbiAgICAgICAgICBcclxuICAgICAgICAgIGlmICghaXNHcm91cCAmJiAhaXRlbS5uYW1lICYmIGl0ZW0ub3RoZXJfcGFydGljaXBhbnRfbmFtZSkge1xyXG4gICAgICAgICAgICByZXR1cm4geyAuLi5pdGVtLCBuYW1lOiBpdGVtLm90aGVyX3BhcnRpY2lwYW50X25hbWUsIGlzX2dyb3VwOiBmYWxzZSB9O1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgcmV0dXJuIHsgLi4uaXRlbSwgaXNfZ3JvdXA6IGlzR3JvdXAgfTtcclxuICAgICAgICB9KTtcclxuICAgICAgICB0aGlzLmluYm94JC5uZXh0KG1hcHBlZCk7XHJcbiAgICAgICAgdGhpcy5yZWNhbGNVbnJlYWQobWFwcGVkKTtcclxuXHJcbiAgICAgICAgY29uc3QgaWRzID0gbWFwcGVkLm1hcCgoaSkgPT4gaS5jb252ZXJzYXRpb25faWQpO1xyXG4gICAgICAgIHRoaXMud3NTZXJ2aWNlLnN1YnNjcmliZUFsbChpZHMpO1xyXG4gICAgICB9LFxyXG4gICAgICBlcnJvcjogKGVycjogYW55KSA9PiBjb25zb2xlLmVycm9yKCdGYWlsZWQgdG8gbG9hZCBpbmJveDonLCBlcnIpLFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvLyDilIDilIAgQ29udGFjdHMg4pSA4pSAXHJcbiAgbG9hZFZpc2libGVDb250YWN0cygpOiB2b2lkIHtcclxuICAgIGNvbnN0IGNvbnRhY3RJZCA9IHRoaXMuYXV0aC5jb250YWN0SWQ7XHJcbiAgICBpZiAoIWNvbnRhY3RJZCkgcmV0dXJuO1xyXG5cclxuICAgIHRoaXMuYXBpLmdldFZpc2libGVDb250YWN0cyhjb250YWN0SWQpLnN1YnNjcmliZSh7XHJcbiAgICAgIG5leHQ6IChjb250YWN0cykgPT4ge1xyXG4gICAgICAgIHRoaXMudmlzaWJsZUNvbnRhY3RzJC5uZXh0KGNvbnRhY3RzKTtcclxuICAgICAgICBcclxuICAgICAgICBjb25zdCBjdXJyZW50Q29udGFjdCA9IHRoaXMuYXV0aC5jdXJyZW50Q29udGFjdDtcclxuICAgICAgICBpZiAoY3VycmVudENvbnRhY3QgJiYgY3VycmVudENvbnRhY3QuZW1haWwpIHtcclxuICAgICAgICAgIGNvbnN0IG1hdGNoID0gY29udGFjdHMuZmluZChjID0+IGMuZW1haWwgPT09IGN1cnJlbnRDb250YWN0LmVtYWlsKTtcclxuICAgICAgICAgIGlmIChtYXRjaCAmJiBtYXRjaC5jb250YWN0X2lkICE9PSBjdXJyZW50Q29udGFjdC5jb250YWN0X2lkKSB7XHJcbiAgICAgICAgICAgIHRoaXMuYXV0aC5zZXRTZXNzaW9uKHRoaXMuYXV0aC5zZXNzaW9uR2lkISwgeyAuLi5jdXJyZW50Q29udGFjdCwgY29udGFjdF9pZDogbWF0Y2guY29udGFjdF9pZCB9KTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHRoaXMud3NTZXJ2aWNlLmRpc2Nvbm5lY3QoKTtcclxuICAgICAgICAgICAgdGhpcy53c1NlcnZpY2UuY29ubmVjdChtYXRjaC5jb250YWN0X2lkLCB0aGlzLmF1dGguc2Vzc2lvbkdpZCEpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgfSxcclxuICAgICAgZXJyb3I6IChlcnI6IGFueSkgPT4gY29uc29sZS5lcnJvcignRmFpbGVkIHRvIGxvYWQgY29udGFjdHM6JywgZXJyKSxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLy8g4pSA4pSAIENvbnZlcnNhdGlvbnMg4pSA4pSAXHJcbiAgb3BlbkNvbnZlcnNhdGlvbihjb252ZXJzYXRpb25JZDogc3RyaW5nLCBuYW1lOiBzdHJpbmcsIGlzR3JvdXAgPSBmYWxzZSk6IHZvaWQge1xyXG4gICAgaWYgKCFjb252ZXJzYXRpb25JZCB8fCBjb252ZXJzYXRpb25JZCA9PT0gJ3VuZGVmaW5lZCcpIHtcclxuICAgICAgY29uc29sZS5lcnJvcignW1N0b3JlXSBvcGVuQ29udmVyc2F0aW9uIGNhbGxlZCB3aXRoIGludmFsaWQgY29udmVyc2F0aW9uSWQ6JywgY29udmVyc2F0aW9uSWQpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICB0aGlzLmFjdGl2ZUNvbnZlcnNhdGlvbklkJC5uZXh0KGNvbnZlcnNhdGlvbklkKTtcclxuICAgIHRoaXMuYWN0aXZlVmlldyQubmV4dCgnY2hhdCcpO1xyXG4gICAgdGhpcy5vcGVuUGFuZWwoKTtcclxuXHJcbiAgICBjb25zdCBjaGF0cyA9IHRoaXMub3BlbkNoYXRzJC52YWx1ZTtcclxuICAgIGlmICghY2hhdHMuZmluZCgoYykgPT4gYy5jb252ZXJzYXRpb25JZCA9PT0gY29udmVyc2F0aW9uSWQpKSB7XHJcbiAgICAgIHRoaXMub3BlbkNoYXRzJC5uZXh0KFtcclxuICAgICAgICAuLi5jaGF0cyxcclxuICAgICAgICB7IGNvbnZlcnNhdGlvbklkLCBuYW1lLCBpc0dyb3VwLCBpc01pbmltaXplZDogZmFsc2UsIHVucmVhZENvdW50OiAwIH0sXHJcbiAgICAgIF0pO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGV4aXN0aW5nID0gdGhpcy5tZXNzYWdlc01hcCQudmFsdWUuZ2V0KGNvbnZlcnNhdGlvbklkKTtcclxuICAgIGlmIChleGlzdGluZyAmJiBleGlzdGluZy5sZW5ndGggPiAwKSB7XHJcbiAgICAgIC8vIEFscmVhZHkgY2FjaGVkIOKAlCBzaWxlbnQgYmFja2dyb3VuZCByZWZyZXNoIGZvciBuZXcgbWVzc2FnZXMsIHNraXAgcmVhY3Rpb24gaHlkcmF0aW9uXHJcbiAgICAgIHRoaXMubG9hZE1lc3NhZ2VzKGNvbnZlcnNhdGlvbklkLCB1bmRlZmluZWQsIHRydWUpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgdGhpcy5sb2FkTWVzc2FnZXMoY29udmVyc2F0aW9uSWQpO1xyXG4gICAgfVxyXG4gICAgdGhpcy5tYXJrQXNSZWFkKGNvbnZlcnNhdGlvbklkKTtcclxuICAgIHRoaXMud3NTZXJ2aWNlLnN1YnNjcmliZShjb252ZXJzYXRpb25JZCk7XHJcbiAgfVxyXG5cclxuICBjbG9zZUNoYXQoY29udmVyc2F0aW9uSWQ6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgY29uc3QgY2hhdHMgPSB0aGlzLm9wZW5DaGF0cyQudmFsdWUuZmlsdGVyKChjKSA9PiBjLmNvbnZlcnNhdGlvbklkICE9PSBjb252ZXJzYXRpb25JZCk7XHJcbiAgICB0aGlzLm9wZW5DaGF0cyQubmV4dChjaGF0cyk7XHJcblxyXG4gICAgaWYgKHRoaXMuYWN0aXZlQ29udmVyc2F0aW9uSWQkLnZhbHVlID09PSBjb252ZXJzYXRpb25JZCkge1xyXG4gICAgICB0aGlzLmFjdGl2ZUNvbnZlcnNhdGlvbklkJC5uZXh0KG51bGwpO1xyXG4gICAgICB0aGlzLmFjdGl2ZVZpZXckLm5leHQoJ2luYm94Jyk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvLyDilIDilIAgTWVzc2FnZXMg4pSA4pSAXHJcbiAgbG9hZE1lc3NhZ2VzKGNvbnZlcnNhdGlvbklkOiBzdHJpbmcsIGJlZm9yZU1lc3NhZ2VJZD86IHN0cmluZywgc2tpcFJlYWN0aW9uSHlkcmF0aW9uID0gZmFsc2UpOiB2b2lkIHtcclxuICAgIGlmICghY29udmVyc2F0aW9uSWQgfHwgY29udmVyc2F0aW9uSWQgPT09ICd1bmRlZmluZWQnKSB7XHJcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tTdG9yZV0gbG9hZE1lc3NhZ2VzIGNhbGxlZCB3aXRoIGludmFsaWQgY29udmVyc2F0aW9uSWQ6JywgY29udmVyc2F0aW9uSWQpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICBjb25zdCBjb250YWN0SWQgPSB0aGlzLmF1dGguY29udGFjdElkO1xyXG4gICAgaWYgKCFjb250YWN0SWQpIHJldHVybjtcclxuXHJcbiAgICB0aGlzLmxvYWRpbmdNZXNzYWdlcyQubmV4dCh0cnVlKTtcclxuXHJcbiAgICB0aGlzLmFwaS5nZXRNZXNzYWdlcyhjb252ZXJzYXRpb25JZCwgY29udGFjdElkLCBiZWZvcmVNZXNzYWdlSWQsIDUwKS5zdWJzY3JpYmUoe1xyXG4gICAgICBuZXh0OiAobWVzc2FnZXMpID0+IHtcclxuICAgICAgICBjb25zdCBtYXAgPSBuZXcgTWFwKHRoaXMubWVzc2FnZXNNYXAkLnZhbHVlKTtcclxuICAgICAgICBjb25zdCBleGlzdGluZyA9IG1hcC5nZXQoY29udmVyc2F0aW9uSWQpIHx8IFtdO1xyXG5cclxuICAgICAgICBjb25zdCBub3JtYWxpemVkID0gbWVzc2FnZXMubWFwKChtOiBhbnkpID0+IHRoaXMubm9ybWFsaXplTWVzc2FnZVNoYXBlKG0pKTtcclxuICAgICAgICBjb25zdCBzb3J0ZWQgPSBbLi4ubm9ybWFsaXplZF0uc29ydCgoYSwgYikgPT4gXHJcbiAgICAgICAgICBuZXcgRGF0ZShhLmNyZWF0ZWRfYXQpLmdldFRpbWUoKSAtIG5ldyBEYXRlKGIuY3JlYXRlZF9hdCkuZ2V0VGltZSgpXHJcbiAgICAgICAgKTtcclxuXHJcbiAgICAgICAgaWYgKGJlZm9yZU1lc3NhZ2VJZCkge1xyXG4gICAgICAgICAgLy8gUHJlcGVuZCBvbGRlciBtZXNzYWdlcywgcHJlc2VydmluZyBleGlzdGluZyByZWFjdGlvbnNcclxuICAgICAgICAgIGNvbnN0IG1lcmdlZCA9IFsuLi5zb3J0ZWQsIC4uLmV4aXN0aW5nXTtcclxuICAgICAgICAgIG1hcC5zZXQoY29udmVyc2F0aW9uSWQsIG1lcmdlZCk7XHJcbiAgICAgICAgfSBlbHNlIGlmIChza2lwUmVhY3Rpb25IeWRyYXRpb24pIHtcclxuICAgICAgICAgIC8vIFNpbGVudCByZWZyZXNoIOKAlCBtZXJnZSBuZXcgbWVzc2FnZXMgYnV0IHByZXNlcnZlIGV4aXN0aW5nIHJlYWN0aW9uIHN0YXRlXHJcbiAgICAgICAgICBjb25zdCBleGlzdGluZ0J5SWQgPSBuZXcgTWFwKGV4aXN0aW5nLm1hcChtID0+IFtTdHJpbmcobS5tZXNzYWdlX2lkKSwgbV0pKTtcclxuICAgICAgICAgIGNvbnN0IG1lcmdlZCA9IHNvcnRlZC5tYXAobSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnN0IGNhY2hlZCA9IGV4aXN0aW5nQnlJZC5nZXQoU3RyaW5nKG0ubWVzc2FnZV9pZCkpO1xyXG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkID8geyAuLi5tLCByZWFjdGlvbnM6IGNhY2hlZC5yZWFjdGlvbnMgfSA6IG07XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICAgIG1hcC5zZXQoY29udmVyc2F0aW9uSWQsIG1lcmdlZCk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIG1hcC5zZXQoY29udmVyc2F0aW9uSWQsIHNvcnRlZCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aGlzLm1lc3NhZ2VzTWFwJC5uZXh0KG1hcCk7XHJcbiAgICAgICAgaWYgKCFza2lwUmVhY3Rpb25IeWRyYXRpb24pIHtcclxuICAgICAgICAgIHRoaXMuaHlkcmF0ZVJlYWN0aW9uc0ZvckNvbnZlcnNhdGlvbihjb252ZXJzYXRpb25JZCwgbWFwLmdldChjb252ZXJzYXRpb25JZCkgfHwgW10pO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLmxvYWRpbmdNZXNzYWdlcyQubmV4dChmYWxzZSk7XHJcbiAgICAgIH0sXHJcbiAgICAgIGVycm9yOiAoZXJyOiBhbnkpID0+IHtcclxuICAgICAgICBjb25zb2xlLmVycm9yKCdGYWlsZWQgdG8gbG9hZCBtZXNzYWdlczonLCBlcnIpO1xyXG4gICAgICAgIHRoaXMubG9hZGluZ01lc3NhZ2VzJC5uZXh0KGZhbHNlKTtcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgc2VuZE1lc3NhZ2UoY29udmVyc2F0aW9uSWQ6IHN0cmluZyB8IG51bGwsIGNvbnRlbnQ6IHN0cmluZywgbWVzc2FnZVR5cGU6ICdURVhUJyB8ICdJTUFHRScgPSAnVEVYVCcpOiB2b2lkIHtcclxuICAgIGNvbnN0IGNvbnRhY3RJZCA9IHRoaXMuYXV0aC5jb250YWN0SWQ7XHJcbiAgICBpZiAoIWNvbnRhY3RJZCkgcmV0dXJuO1xyXG5cclxuICAgIGNvbnN0IHBlbmRpbmcgPSB0aGlzLnBlbmRpbmdEbVJlY2lwaWVudCQudmFsdWU7XHJcbiAgICBpZiAoIWNvbnZlcnNhdGlvbklkICYmIHBlbmRpbmcpIHtcclxuICAgICAgdGhpcy5zZW5kRGlyZWN0TWVzc2FnZShwZW5kaW5nLmNvbnRhY3RJZCwgY29udGVudCk7XHJcbiAgICAgIHRoaXMucGVuZGluZ0RtUmVjaXBpZW50JC5uZXh0KG51bGwpO1xyXG4gICAgICBjb25zdCBjaGF0cyA9IHRoaXMub3BlbkNoYXRzJC52YWx1ZS5maWx0ZXIoYyA9PiBjLmNvbnZlcnNhdGlvbklkICE9PSAncGVuZGluZycpO1xyXG4gICAgICB0aGlzLm9wZW5DaGF0cyQubmV4dChjaGF0cyk7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoIWNvbnZlcnNhdGlvbklkKSByZXR1cm47XHJcblxyXG4gICAgdGhpcy5hcGkuc2VuZE1lc3NhZ2UoY29udmVyc2F0aW9uSWQsIGNvbnRhY3RJZCwgY29udGVudCwgbWVzc2FnZVR5cGUpLnN1YnNjcmliZSh7XHJcbiAgICAgIG5leHQ6IChyZXMpID0+IHtcclxuICAgICAgICBjb25zdCBvcHRpbWlzdGljOiBNZXNzYWdlID0ge1xyXG4gICAgICAgICAgbWVzc2FnZV9pZDogJ3RlbXAtJyArIERhdGUubm93KCksXHJcbiAgICAgICAgICBjb252ZXJzYXRpb25faWQ6IGNvbnZlcnNhdGlvbklkLFxyXG4gICAgICAgICAgc2VuZGVyX2lkOiBjb250YWN0SWQsXHJcbiAgICAgICAgICBzZW5kZXJfbmFtZTogJ1lvdScsXHJcbiAgICAgICAgICBtZXNzYWdlX3R5cGU6IG1lc3NhZ2VUeXBlLFxyXG4gICAgICAgICAgY29udGVudCxcclxuICAgICAgICAgIGNyZWF0ZWRfYXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcclxuICAgICAgICAgIGlzX3JlYWQ6IHRydWUsXHJcbiAgICAgICAgfTtcclxuICAgICAgICB0aGlzLmFwcGVuZE1lc3NhZ2Uob3B0aW1pc3RpYyk7XHJcbiAgICAgIH0sXHJcbiAgICAgIGVycm9yOiAoZXJyOiBhbnkpID0+IGNvbnNvbGUuZXJyb3IoJ0ZhaWxlZCB0byBzZW5kIG1lc3NhZ2U6JywgZXJyKSxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgb3BlbkRpcmVjdENvbnZlcnNhdGlvbihyZWNpcGllbnRDb250YWN0SWQ6IHN0cmluZywgZGlzcGxheU5hbWU6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgY29uc3QgZXhpc3RpbmcgPSB0aGlzLmluYm94JC52YWx1ZS5maW5kKGl0ZW0gPT4gXHJcbiAgICAgICFpdGVtLmlzX2dyb3VwICYmIGl0ZW0ubmFtZSA9PT0gZGlzcGxheU5hbWVcclxuICAgICk7XHJcbiAgICBcclxuICAgIGlmIChleGlzdGluZykge1xyXG4gICAgICB0aGlzLnBlbmRpbmdEbVJlY2lwaWVudCQubmV4dChudWxsKTtcclxuICAgICAgdGhpcy5vcGVuQ29udmVyc2F0aW9uKGV4aXN0aW5nLmNvbnZlcnNhdGlvbl9pZCwgZGlzcGxheU5hbWUsIGZhbHNlKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHRoaXMucGVuZGluZ0RtUmVjaXBpZW50JC5uZXh0KHtjb250YWN0SWQ6IHJlY2lwaWVudENvbnRhY3RJZCwgbmFtZTogZGlzcGxheU5hbWV9KTtcclxuICAgICAgdGhpcy5hY3RpdmVDb252ZXJzYXRpb25JZCQubmV4dChudWxsKTtcclxuICAgICAgdGhpcy5hY3RpdmVWaWV3JC5uZXh0KCdjaGF0Jyk7XHJcbiAgICAgIHRoaXMub3BlblBhbmVsKCk7XHJcbiAgICAgIFxyXG4gICAgICBjb25zdCBjaGF0cyA9IHRoaXMub3BlbkNoYXRzJC52YWx1ZTtcclxuICAgICAgaWYgKCFjaGF0cy5maW5kKGMgPT4gYy5jb252ZXJzYXRpb25JZCA9PT0gJ3BlbmRpbmcnKSkge1xyXG4gICAgICAgIHRoaXMub3BlbkNoYXRzJC5uZXh0KFsuLi5jaGF0cywge1xyXG4gICAgICAgICAgY29udmVyc2F0aW9uSWQ6ICdwZW5kaW5nJyxcclxuICAgICAgICAgIG5hbWU6IGRpc3BsYXlOYW1lLFxyXG4gICAgICAgICAgaXNHcm91cDogZmFsc2UsXHJcbiAgICAgICAgICBpc01pbmltaXplZDogZmFsc2UsXHJcbiAgICAgICAgICB1bnJlYWRDb3VudDogMFxyXG4gICAgICAgIH1dKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgc2VuZERpcmVjdE1lc3NhZ2UocmVjaXBpZW50Q29udGFjdElkOiBzdHJpbmcsIGNvbnRlbnQ6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgY29uc3QgY29udGFjdElkID0gdGhpcy5hdXRoLmNvbnRhY3RJZDtcclxuICAgIGlmICghY29udGFjdElkKSByZXR1cm47XHJcblxyXG4gICAgdGhpcy5hcGkuc2VuZERpcmVjdE1lc3NhZ2UoY29udGFjdElkLCByZWNpcGllbnRDb250YWN0SWQsIGNvbnRlbnQpLnN1YnNjcmliZSh7XHJcbiAgICAgIG5leHQ6IChyZXMpID0+IHtcclxuICAgICAgICB0aGlzLmxvYWRJbmJveCgpO1xyXG4gICAgICAgIC8vIEJhY2tlbmQgbWF5IHJldHVybiBjb252ZXJzYXRpb25faWQsIGlkLCBvciBjb252ZXJzYXRpb25JZFxyXG4gICAgICAgIGNvbnN0IGNvbnZJZCA9IFN0cmluZyhyZXM/LmNvbnZlcnNhdGlvbl9pZCB8fCByZXM/LmlkIHx8IHJlcz8uY29udmVyc2F0aW9uSWQgfHwgJycpO1xyXG4gICAgICAgIGlmIChjb252SWQpIHtcclxuICAgICAgICAgIGNvbnN0IHJlY2lwaWVudCA9IHRoaXMudmlzaWJsZUNvbnRhY3RzJC52YWx1ZS5maW5kKFxyXG4gICAgICAgICAgICAoYykgPT4gYy5jb250YWN0X2lkID09PSByZWNpcGllbnRDb250YWN0SWRcclxuICAgICAgICAgICk7XHJcbiAgICAgICAgICBjb25zdCBuYW1lID0gcmVjaXBpZW50ID8gZ2V0Q29udGFjdERpc3BsYXlOYW1lKHJlY2lwaWVudCkgOiAnRGlyZWN0IE1lc3NhZ2UnO1xyXG4gICAgICAgICAgdGhpcy5vcGVuQ29udmVyc2F0aW9uKGNvbnZJZCwgbmFtZSwgZmFsc2UpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSxcclxuICAgICAgZXJyb3I6IChlcnI6IGFueSkgPT4gY29uc29sZS5lcnJvcignRmFpbGVkIHRvIHNlbmQgRE06JywgZXJyKSxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgY3JlYXRlR3JvdXBDb252ZXJzYXRpb24ocGFydGljaXBhbnRJZHM6IHN0cmluZ1tdLCBuYW1lOiBzdHJpbmcpOiB2b2lkIHtcclxuICAgIGNvbnN0IGNvbnRhY3RJZCA9IHRoaXMuYXV0aC5jb250YWN0SWQ7XHJcbiAgICBpZiAoIWNvbnRhY3RJZCkgcmV0dXJuO1xyXG5cclxuICAgIGNvbnN0IGFsbFBhcnRpY2lwYW50cyA9IHBhcnRpY2lwYW50SWRzLmluY2x1ZGVzKGNvbnRhY3RJZClcclxuICAgICAgPyBwYXJ0aWNpcGFudElkc1xyXG4gICAgICA6IFtjb250YWN0SWQsIC4uLnBhcnRpY2lwYW50SWRzXTtcclxuXHJcbiAgICB0aGlzLmFwaS5jcmVhdGVDb252ZXJzYXRpb24oY29udGFjdElkLCBhbGxQYXJ0aWNpcGFudHMsIG5hbWUpLnN1YnNjcmliZSh7XHJcbiAgICAgIG5leHQ6IChjb252KSA9PiB7XHJcbiAgICAgICAgLy8gQmFja2VuZCBtYXkgcmV0dXJuIGNvbnZlcnNhdGlvbl9pZCwgaWQsIG9yIGNvbnZlcnNhdGlvbklkXHJcbiAgICAgICAgY29uc3QgY29udklkID0gU3RyaW5nKChjb252IGFzIGFueSk/LmNvbnZlcnNhdGlvbl9pZCB8fCAoY29udiBhcyBhbnkpPy5pZCB8fCAoY29udiBhcyBhbnkpPy5jb252ZXJzYXRpb25JZCB8fCAnJyk7XHJcbiAgICAgICAgaWYgKCFjb252SWQpIHtcclxuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tTdG9yZV0gY3JlYXRlR3JvdXBDb252ZXJzYXRpb246IG5vIGNvbnZlcnNhdGlvbiBJRCBpbiByZXNwb25zZScsIGNvbnYpO1xyXG4gICAgICAgICAgdGhpcy5sb2FkSW5ib3goKTtcclxuICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5sb2FkSW5ib3goKTtcclxuICAgICAgICB0aGlzLm9wZW5Db252ZXJzYXRpb24oY29udklkLCBuYW1lLCB0cnVlKTtcclxuICAgICAgfSxcclxuICAgICAgZXJyb3I6IChlcnI6IGFueSkgPT4gY29uc29sZS5lcnJvcignRmFpbGVkIHRvIGNyZWF0ZSBncm91cDonLCBlcnIpLFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBvcGVuR3JvdXBTZXR0aW5ncyhjb252ZXJzYXRpb25JZDogc3RyaW5nLCBuYW1lOiBzdHJpbmcpOiB2b2lkIHtcclxuICAgIHRoaXMuZ3JvdXBTZXR0aW5ncyQubmV4dCh7IGNvbnZlcnNhdGlvbklkLCBuYW1lIH0pO1xyXG4gICAgdGhpcy5zZXRWaWV3KCdncm91cC1tYW5hZ2VyJyk7XHJcbiAgfVxyXG5cclxuICBjbGVhckdyb3VwU2V0dGluZ3MoKTogdm9pZCB7XHJcbiAgICB0aGlzLmdyb3VwU2V0dGluZ3MkLm5leHQobnVsbCk7XHJcbiAgfVxyXG5cclxuICBtYXJrQXNSZWFkKGNvbnZlcnNhdGlvbklkOiBzdHJpbmcpOiB2b2lkIHtcclxuICAgIGlmICghY29udmVyc2F0aW9uSWQgfHwgY29udmVyc2F0aW9uSWQgPT09ICd1bmRlZmluZWQnKSByZXR1cm47XHJcbiAgICBjb25zdCBjb250YWN0SWQgPSB0aGlzLmF1dGguY29udGFjdElkO1xyXG4gICAgaWYgKCFjb250YWN0SWQpIHJldHVybjtcclxuXHJcbiAgICB0aGlzLmFwaS5tYXJrQ29udmVyc2F0aW9uUmVhZChjb252ZXJzYXRpb25JZCwgY29udGFjdElkKS5zdWJzY3JpYmUoe1xyXG4gICAgICBuZXh0OiAoKSA9PiB7XHJcbiAgICAgICAgY29uc3QgaXRlbXMgPSB0aGlzLmluYm94JC52YWx1ZS5tYXAoKGl0ZW0pID0+XHJcbiAgICAgICAgICBpdGVtLmNvbnZlcnNhdGlvbl9pZCA9PT0gY29udmVyc2F0aW9uSWQgPyB7IC4uLml0ZW0sIHVucmVhZF9jb3VudDogMCB9IDogaXRlbVxyXG4gICAgICAgICk7XHJcbiAgICAgICAgdGhpcy5pbmJveCQubmV4dChpdGVtcyk7XHJcbiAgICAgICAgdGhpcy5yZWNhbGNVbnJlYWQoaXRlbXMpO1xyXG4gICAgICB9LFxyXG4gICAgICBlcnJvcjogKCkgPT4ge30sXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8vIOKUgOKUgCBHcm91cCBtYW5hZ2VtZW50IOKUgOKUgFxyXG4gIG1hbmFnZUdyb3VwKFxyXG4gICAgYWN0aW9uOiAnY3JlYXRlJyB8ICdhZGQnIHwgJ3JlbW92ZScgfCAncmVuYW1lJyxcclxuICAgIGNvbnZlcnNhdGlvbklkPzogc3RyaW5nLFxyXG4gICAgZ3JvdXBOYW1lPzogc3RyaW5nLFxyXG4gICAgcGFydGljaXBhbnRDb250YWN0SWRzPzogc3RyaW5nW11cclxuICApOiB2b2lkIHtcclxuICAgIGNvbnN0IGNvbnRhY3RJZCA9IHRoaXMuYXV0aC5jb250YWN0SWQ7XHJcbiAgICBpZiAoIWNvbnRhY3RJZCkgcmV0dXJuO1xyXG5cclxuICAgIHRoaXMuYXBpLm1hbmFnZUdyb3VwKGNvbnRhY3RJZCwgYWN0aW9uLCBjb252ZXJzYXRpb25JZCwgZ3JvdXBOYW1lLCBwYXJ0aWNpcGFudENvbnRhY3RJZHMpLnN1YnNjcmliZSh7XHJcbiAgICAgIG5leHQ6ICgpID0+IHRoaXMubG9hZEluYm94KCksXHJcbiAgICAgIGVycm9yOiAoZXJyOiBhbnkpID0+IGNvbnNvbGUuZXJyb3IoJ0dyb3VwIGFjdGlvbiBmYWlsZWQ6JywgZXJyKSxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLy8g4pSA4pSAIERlbGV0ZSAvIENsZWFyIOKUgOKUgFxyXG4gIGRlbGV0ZUNvbnZlcnNhdGlvbihjb252ZXJzYXRpb25JZDogc3RyaW5nKTogdm9pZCB7XHJcbiAgICBjb25zdCBjb250YWN0SWQgPSB0aGlzLmF1dGguY29udGFjdElkO1xyXG4gICAgaWYgKCFjb250YWN0SWQpIHJldHVybjtcclxuXHJcbiAgICB0aGlzLmFwaS5kZWxldGVDb252ZXJzYXRpb24oY29udmVyc2F0aW9uSWQsIGNvbnRhY3RJZCkuc3Vic2NyaWJlKHtcclxuICAgICAgbmV4dDogKCkgPT4ge1xyXG4gICAgICAgIGNvbnN0IGl0ZW1zID0gdGhpcy5pbmJveCQudmFsdWUuZmlsdGVyKGkgPT4gaS5jb252ZXJzYXRpb25faWQgIT09IGNvbnZlcnNhdGlvbklkKTtcclxuICAgICAgICB0aGlzLmluYm94JC5uZXh0KGl0ZW1zKTtcclxuICAgICAgICB0aGlzLnJlY2FsY1VucmVhZChpdGVtcyk7XHJcbiAgICAgICAgY29uc3QgbWFwID0gbmV3IE1hcCh0aGlzLm1lc3NhZ2VzTWFwJC52YWx1ZSk7XHJcbiAgICAgICAgbWFwLmRlbGV0ZShjb252ZXJzYXRpb25JZCk7XHJcbiAgICAgICAgdGhpcy5tZXNzYWdlc01hcCQubmV4dChtYXApO1xyXG4gICAgICAgIGlmICh0aGlzLmFjdGl2ZUNvbnZlcnNhdGlvbklkJC52YWx1ZSA9PT0gY29udmVyc2F0aW9uSWQpIHtcclxuICAgICAgICAgIHRoaXMuYWN0aXZlQ29udmVyc2F0aW9uSWQkLm5leHQobnVsbCk7XHJcbiAgICAgICAgICB0aGlzLmFjdGl2ZVZpZXckLm5leHQoJ2luYm94Jyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMuY2xvc2VDaGF0KGNvbnZlcnNhdGlvbklkKTtcclxuICAgICAgfSxcclxuICAgICAgZXJyb3I6IChlcnI6IGFueSkgPT4gY29uc29sZS5lcnJvcignRGVsZXRlIGNvbnZlcnNhdGlvbiBmYWlsZWQ6JywgZXJyKSxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgY2xlYXJDb252ZXJzYXRpb24oY29udmVyc2F0aW9uSWQ6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgY29uc3QgY29udGFjdElkID0gdGhpcy5hdXRoLmNvbnRhY3RJZDtcclxuICAgIGlmICghY29udGFjdElkKSByZXR1cm47XHJcblxyXG4gICAgdGhpcy5hcGkuY2xlYXJDb252ZXJzYXRpb24oY29udmVyc2F0aW9uSWQsIGNvbnRhY3RJZCkuc3Vic2NyaWJlKHtcclxuICAgICAgbmV4dDogKCkgPT4ge1xyXG4gICAgICAgIGNvbnN0IG1hcCA9IG5ldyBNYXAodGhpcy5tZXNzYWdlc01hcCQudmFsdWUpO1xyXG4gICAgICAgIG1hcC5zZXQoY29udmVyc2F0aW9uSWQsIFtdKTtcclxuICAgICAgICB0aGlzLm1lc3NhZ2VzTWFwJC5uZXh0KG1hcCk7XHJcbiAgICAgICAgY29uc3QgaXRlbXMgPSB0aGlzLmluYm94JC52YWx1ZS5tYXAoaSA9PlxyXG4gICAgICAgICAgaS5jb252ZXJzYXRpb25faWQgPT09IGNvbnZlcnNhdGlvbklkXHJcbiAgICAgICAgICAgID8geyAuLi5pLCBsYXN0X21lc3NhZ2VfcHJldmlldzogJycsIGxhc3RfbWVzc2FnZV9hdDogaS5sYXN0X21lc3NhZ2VfYXQgfVxyXG4gICAgICAgICAgICA6IGlcclxuICAgICAgICApO1xyXG4gICAgICAgIHRoaXMuaW5ib3gkLm5leHQoaXRlbXMpO1xyXG4gICAgICB9LFxyXG4gICAgICBlcnJvcjogKGVycjogYW55KSA9PiBjb25zb2xlLmVycm9yKCdDbGVhciBjb252ZXJzYXRpb24gZmFpbGVkOicsIGVyciksXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIGRlbGV0ZUdyb3VwKGNvbnZlcnNhdGlvbklkOiBzdHJpbmcpOiB2b2lkIHtcclxuICAgIGNvbnN0IGNvbnRhY3RJZCA9IHRoaXMuYXV0aC5jb250YWN0SWQ7XHJcbiAgICBpZiAoIWNvbnRhY3RJZCkgcmV0dXJuO1xyXG5cclxuICAgIHRoaXMuYXBpLmRlbGV0ZUdyb3VwKGNvbnZlcnNhdGlvbklkLCBjb250YWN0SWQpLnN1YnNjcmliZSh7XHJcbiAgICAgIG5leHQ6ICgpID0+IHtcclxuICAgICAgICBjb25zdCBpdGVtcyA9IHRoaXMuaW5ib3gkLnZhbHVlLmZpbHRlcihpID0+IGkuY29udmVyc2F0aW9uX2lkICE9PSBjb252ZXJzYXRpb25JZCk7XHJcbiAgICAgICAgdGhpcy5pbmJveCQubmV4dChpdGVtcyk7XHJcbiAgICAgICAgdGhpcy5yZWNhbGNVbnJlYWQoaXRlbXMpO1xyXG4gICAgICAgIGNvbnN0IG1hcCA9IG5ldyBNYXAodGhpcy5tZXNzYWdlc01hcCQudmFsdWUpO1xyXG4gICAgICAgIG1hcC5kZWxldGUoY29udmVyc2F0aW9uSWQpO1xyXG4gICAgICAgIHRoaXMubWVzc2FnZXNNYXAkLm5leHQobWFwKTtcclxuICAgICAgICBpZiAodGhpcy5hY3RpdmVDb252ZXJzYXRpb25JZCQudmFsdWUgPT09IGNvbnZlcnNhdGlvbklkKSB7XHJcbiAgICAgICAgICB0aGlzLmFjdGl2ZUNvbnZlcnNhdGlvbklkJC5uZXh0KG51bGwpO1xyXG4gICAgICAgICAgdGhpcy5hY3RpdmVWaWV3JC5uZXh0KCdpbmJveCcpO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLmNsb3NlQ2hhdChjb252ZXJzYXRpb25JZCk7XHJcbiAgICAgIH0sXHJcbiAgICAgIGVycm9yOiAoZXJyOiBhbnkpID0+IGNvbnNvbGUuZXJyb3IoJ0RlbGV0ZSBncm91cCBmYWlsZWQ6JywgZXJyKSxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLy8g4pSA4pSAIFJlYWN0aW9ucyDilIDilIBcclxuICBhZGRSZWFjdGlvbihtZXNzYWdlSWQ6IHN0cmluZywgZW1vamk6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgY29uc3QgY29udGFjdElkID0gdGhpcy5hdXRoLmNvbnRhY3RJZDtcclxuICAgIGlmICghY29udGFjdElkKSByZXR1cm47XHJcblxyXG4gICAgLy8gRW5mb3JjZSBvbmUgcmVhY3Rpb24gcGVyIHVzZXIg4oCUIHJlbW92ZSBhbnkgZXhpc3RpbmcgcmVhY3Rpb24gd2l0aCBhIGRpZmZlcmVudCBlbW9qaVxyXG4gICAgZm9yIChjb25zdCBtc2dzIG9mIHRoaXMubWVzc2FnZXNNYXAkLnZhbHVlLnZhbHVlcygpKSB7XHJcbiAgICAgIGNvbnN0IG1zZyA9IG1zZ3MuZmluZChtID0+IFN0cmluZyhtLm1lc3NhZ2VfaWQpID09PSBTdHJpbmcobWVzc2FnZUlkKSk7XHJcbiAgICAgIGlmIChtc2c/LnJlYWN0aW9ucykge1xyXG4gICAgICAgIGZvciAoY29uc3QgciBvZiBtc2cucmVhY3Rpb25zKSB7XHJcbiAgICAgICAgICBpZiAoci5oYXNSZWFjdGVkICYmIHIuZW1vamkgIT09IGVtb2ppKSB7XHJcbiAgICAgICAgICAgIHRoaXMuYXBwbHlSZWFjdGlvbk9wdGltaXN0aWNhbGx5KG1lc3NhZ2VJZCwgci5lbW9qaSwgZmFsc2UpO1xyXG4gICAgICAgICAgICB0aGlzLmFwaS5yZW1vdmVSZWFjdGlvbihtZXNzYWdlSWQsIGNvbnRhY3RJZCwgci5lbW9qaSkuc3Vic2NyaWJlKHsgZXJyb3I6ICgpID0+IHt9IH0pO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgICBicmVhaztcclxuICAgIH1cclxuXHJcbiAgICAvLyBPcHRpbWlzdGljIFVJIHNvIHVzZXIgc2VlcyByZWFjdGlvbiBpbW1lZGlhdGVseS5cclxuICAgIHRoaXMuYXBwbHlSZWFjdGlvbk9wdGltaXN0aWNhbGx5KG1lc3NhZ2VJZCwgZW1vamksIHRydWUpO1xyXG5cclxuICAgIHRoaXMuYXBpLmFkZFJlYWN0aW9uKG1lc3NhZ2VJZCwgY29udGFjdElkLCBlbW9qaSkuc3Vic2NyaWJlKHtcclxuICAgICAgbmV4dDogKCkgPT4ge1xyXG4gICAgICAgIHRoaXMucmVmcmVzaE1lc3NhZ2VSZWFjdGlvbnMobWVzc2FnZUlkKTtcclxuICAgICAgfSxcclxuICAgICAgZXJyb3I6IChlcnI6IGFueSkgPT4ge1xyXG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ0FkZCByZWFjdGlvbiBmYWlsZWQ6JywgZXJyKTtcclxuICAgICAgICAvLyBSZXZlcnQgb3B0aW1pc3RpYyB1cGRhdGUgd2hlbiByZXF1ZXN0IGZhaWxzLlxyXG4gICAgICAgIHRoaXMuYXBwbHlSZWFjdGlvbk9wdGltaXN0aWNhbGx5KG1lc3NhZ2VJZCwgZW1vamksIGZhbHNlKTtcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcmVtb3ZlUmVhY3Rpb24obWVzc2FnZUlkOiBzdHJpbmcsIGVtb2ppOiBzdHJpbmcpOiB2b2lkIHtcclxuICAgIGNvbnN0IGNvbnRhY3RJZCA9IHRoaXMuYXV0aC5jb250YWN0SWQ7XHJcbiAgICBpZiAoIWNvbnRhY3RJZCkgcmV0dXJuO1xyXG5cclxuICAgIC8vIE9wdGltaXN0aWMgVUkgc28gdXNlciBzZWVzIHJlYWN0aW9uIHJlbW92YWwgaW1tZWRpYXRlbHkuXHJcbiAgICB0aGlzLmFwcGx5UmVhY3Rpb25PcHRpbWlzdGljYWxseShtZXNzYWdlSWQsIGVtb2ppLCBmYWxzZSk7XHJcblxyXG4gICAgdGhpcy5hcGkucmVtb3ZlUmVhY3Rpb24obWVzc2FnZUlkLCBjb250YWN0SWQsIGVtb2ppKS5zdWJzY3JpYmUoe1xyXG4gICAgICBuZXh0OiAoKSA9PiB7XHJcbiAgICAgICAgdGhpcy5yZWZyZXNoTWVzc2FnZVJlYWN0aW9ucyhtZXNzYWdlSWQpO1xyXG4gICAgICB9LFxyXG4gICAgICBlcnJvcjogKGVycjogYW55KSA9PiB7XHJcbiAgICAgICAgY29uc29sZS5lcnJvcignUmVtb3ZlIHJlYWN0aW9uIGZhaWxlZDonLCBlcnIpO1xyXG4gICAgICAgIC8vIFJldmVydCBvcHRpbWlzdGljIHVwZGF0ZSB3aGVuIHJlcXVlc3QgZmFpbHMuXHJcbiAgICAgICAgdGhpcy5hcHBseVJlYWN0aW9uT3B0aW1pc3RpY2FsbHkobWVzc2FnZUlkLCBlbW9qaSwgdHJ1ZSk7XHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIGdldEFjdGl2ZUNvbnZlcnNhdGlvbklkKCk6IHN0cmluZyB8IG51bGwge1xyXG4gICAgcmV0dXJuIHRoaXMuYWN0aXZlQ29udmVyc2F0aW9uSWQkLnZhbHVlO1xyXG4gIH1cclxuXHJcbiAgLy8g4pSA4pSAIEdldHRlcnMg4pSA4pSAXHJcbiAgZ2V0TWVzc2FnZXNGb3JDb252ZXJzYXRpb24oY29udmVyc2F0aW9uSWQ6IHN0cmluZyk6IE1lc3NhZ2VbXSB7XHJcbiAgICByZXR1cm4gdGhpcy5tZXNzYWdlc01hcCQudmFsdWUuZ2V0KGNvbnZlcnNhdGlvbklkKSB8fCBbXTtcclxuICB9XHJcblxyXG4gIGdldEN1cnJlbnRJbmJveCgpOiBJbmJveEl0ZW1bXSB7XHJcbiAgICByZXR1cm4gdGhpcy5pbmJveCQudmFsdWU7XHJcbiAgfVxyXG5cclxuICAvLyDilIDilIAgUHJpdmF0ZSBoZWxwZXJzIOKUgOKUgFxyXG4gIHByaXZhdGUgbGlzdGVuV2ViU29ja2V0KCk6IHZvaWQge1xyXG4gICAgdGhpcy53c1N1Yj8udW5zdWJzY3JpYmUoKTtcclxuICAgIHRoaXMud3NTdWIgPSB0aGlzLndzU2VydmljZS5vbk1lc3NhZ2UkLnN1YnNjcmliZSgobXNnKSA9PiB0aGlzLmhhbmRsZVdzTWVzc2FnZShtc2cpKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgaGFuZGxlV3NNZXNzYWdlKG1zZzogV2ViU29ja2V0TWVzc2FnZSk6IHZvaWQge1xyXG4gICAgc3dpdGNoIChtc2cudHlwZSkge1xyXG4gICAgICBjYXNlICduZXdfbWVzc2FnZSc6XHJcbiAgICAgICAgdGhpcy5oYW5kbGVOZXdNZXNzYWdlKG1zZy5kYXRhKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgY2FzZSAnY29udmVyc2F0aW9uX3VwZGF0ZWQnOlxyXG4gICAgICAgIHRoaXMubG9hZEluYm94KCk7XHJcbiAgICAgICAgaWYgKHRoaXMuYWN0aXZlQ29udmVyc2F0aW9uSWQkLnZhbHVlKSB7XHJcbiAgICAgICAgICB0aGlzLmxvYWRNZXNzYWdlcyh0aGlzLmFjdGl2ZUNvbnZlcnNhdGlvbklkJC52YWx1ZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICBjYXNlICdncm91cF91cGRhdGVkJzpcclxuICAgICAgICB0aGlzLmhhbmRsZUdyb3VwVXBkYXRlZChtc2cuZGF0YSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgIGNhc2UgJ2Vycm9yJzpcclxuICAgICAgICB0aGlzLmhhbmRsZVdlYlNvY2tldEVycm9yKG1zZy5tZXNzYWdlKTtcclxuICAgICAgICBicmVhaztcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHByaXZhdGUgaGFuZGxlR3JvdXBVcGRhdGVkKGRhdGE6IGFueSk6IHZvaWQge1xyXG4gICAgdGhpcy5sb2FkSW5ib3goKTtcclxuICAgIFxyXG4gICAgaWYgKGRhdGEuYWN0aW9uID09PSAnYWRkJyAmJiBkYXRhLmdyb3VwX25hbWUpIHtcclxuICAgICAgY29uc29sZS5sb2coYOKchSBZb3Ugd2VyZSBhZGRlZCB0byB0aGUgZ3JvdXAgXCIke2RhdGEuZ3JvdXBfbmFtZX1cImApO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBoYW5kbGVXZWJTb2NrZXRFcnJvcihlcnJvck1lc3NhZ2U6IHN0cmluZyB8IHVuZGVmaW5lZCk6IHZvaWQge1xyXG4gICAgY29uc3QgY29udGFjdElkID0gdGhpcy5hdXRoLmNvbnRhY3RJZDtcclxuICAgIFxyXG4gICAgaWYgKCFlcnJvck1lc3NhZ2UpIHtcclxuICAgICAgY29uc29sZS5lcnJvcignV2ViU29ja2V0IGVycm9yOiBVbmtub3duIGVycm9yJyk7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoZXJyb3JNZXNzYWdlLmluY2x1ZGVzKCdDb250YWN0IG5vdCBmb3VuZCcpIHx8IGVycm9yTWVzc2FnZS5pbmNsdWRlcygnY29udGFjdCcpKSB7XHJcbiAgICAgIGNvbnNvbGUuZXJyb3IoXHJcbiAgICAgICAgYOKdjCBNZXNzYWdpbmcgY29udGFjdCBub3QgZm91bmQgZm9yIElEIFwiJHtjb250YWN0SWR9XCIuIGAgK1xyXG4gICAgICAgIGBFbnN1cmUgYSByZWNvcmQgZXhpc3RzIGluIHRoZSBtZXNzYWdpbmcuY29udGFjdHMgdGFibGUuIGAgK1xyXG4gICAgICAgIGBJZiB0aGUgY29udGFjdCBkb2Vzbid0IGV4aXN0LCBjcmVhdGUgb25lIHZpYTogUE9TVCAvbWVzc2FnaW5nL2NvbnRhY3RzIHdpdGggY29udGFjdF9pZD1cIiR7Y29udGFjdElkfVwiLiBgICtcclxuICAgICAgICBgRXJyb3I6ICR7ZXJyb3JNZXNzYWdlfWBcclxuICAgICAgKTtcclxuICAgIH0gZWxzZSBpZiAoZXJyb3JNZXNzYWdlLmluY2x1ZGVzKCd1bmF1dGhvcml6ZWQnKSB8fCBlcnJvck1lc3NhZ2UuaW5jbHVkZXMoJ2F1dGgnKSkge1xyXG4gICAgICBjb25zb2xlLmVycm9yKFxyXG4gICAgICAgIGDinYwgV2ViU29ja2V0IGF1dGhlbnRpY2F0aW9uIGZhaWxlZC4gYCArXHJcbiAgICAgICAgYFZlcmlmeSBzZXNzaW9uX2dpZCBpcyB2YWxpZCBhbmQgbm90IGV4cGlyZWQuIGAgK1xyXG4gICAgICAgIGBSZS1hdXRoZW50aWNhdGUgYW5kIGNhbGwgbWVzc2FnaW5nQXV0aC5zZXRTZXNzaW9uKCkgYWdhaW4uIGAgK1xyXG4gICAgICAgIGBFcnJvcjogJHtlcnJvck1lc3NhZ2V9YFxyXG4gICAgICApO1xyXG4gICAgfSBlbHNlIGlmIChlcnJvck1lc3NhZ2UuaW5jbHVkZXMoJ3Blcm1pc3Npb24nKSB8fCBlcnJvck1lc3NhZ2UuaW5jbHVkZXMoJ2ZvcmJpZGRlbicpKSB7XHJcbiAgICAgIGNvbnNvbGUuZXJyb3IoXHJcbiAgICAgICAgYOKdjCBQZXJtaXNzaW9uIGRlbmllZCBmb3IgY29udGFjdCBcIiR7Y29udGFjdElkfVwiLiBgICtcclxuICAgICAgICBgRW5zdXJlIHRoZSBjb250YWN0IGhhcyBhY2Nlc3MgdG8gdGhlIG1lc3NhZ2luZyBzeXN0ZW0uIGAgK1xyXG4gICAgICAgIGBFcnJvcjogJHtlcnJvck1lc3NhZ2V9YFxyXG4gICAgICApO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgY29uc29sZS5lcnJvcihg4p2MIFdlYlNvY2tldCBlcnJvcjogJHtlcnJvck1lc3NhZ2V9YCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGhhbmRsZU5ld01lc3NhZ2UoZGF0YTogYW55KTogdm9pZCB7XHJcbiAgICBpZiAoIWRhdGEpIHJldHVybjtcclxuXHJcbiAgICAvLyBQYXNzIHRocm91Z2ggZnVsbCBwYXlsb2FkIHNvIG5lc3RlZCAvIGFsdGVybmF0ZSBhdHRhY2htZW50IGZpZWxkcyBhcmUgbm90IGRyb3BwZWQuXHJcbiAgICBjb25zdCBtZXNzYWdlOiBNZXNzYWdlID0gdGhpcy5ub3JtYWxpemVNZXNzYWdlU2hhcGUoZGF0YSk7XHJcblxyXG4gICAgY29uc3QgaXNGcm9tT3RoZXIgPSBTdHJpbmcobWVzc2FnZS5zZW5kZXJfaWQpICE9PSBTdHJpbmcodGhpcy5hdXRoLmNvbnRhY3RJZCk7XHJcblxyXG4gICAgY29uc3QgZXhpc3RpbmcgPSB0aGlzLm1lc3NhZ2VzTWFwJC52YWx1ZS5nZXQobWVzc2FnZS5jb252ZXJzYXRpb25faWQpIHx8IFtdO1xyXG4gICAgY29uc3QgaXNEdXBsaWNhdGUgPSBleGlzdGluZy5zb21lKFxyXG4gICAgICAobSkgPT4gbS5tZXNzYWdlX2lkID09PSBtZXNzYWdlLm1lc3NhZ2VfaWQgfHxcclxuICAgICAgICAgICAgIChtLnNlbmRlcl9pZCA9PT0gbWVzc2FnZS5zZW5kZXJfaWQgJiZcclxuICAgICAgICAgICAgICBtLmNvbnRlbnQgPT09IG1lc3NhZ2UuY29udGVudCAmJlxyXG4gICAgICAgICAgICAgIE1hdGguYWJzKG5ldyBEYXRlKG0uY3JlYXRlZF9hdCkuZ2V0VGltZSgpIC0gbmV3IERhdGUobWVzc2FnZS5jcmVhdGVkX2F0KS5nZXRUaW1lKCkpIDwgMjAwMClcclxuICAgICk7XHJcblxyXG4gICAgaWYgKCFpc0R1cGxpY2F0ZSkge1xyXG4gICAgICB0aGlzLmFwcGVuZE1lc3NhZ2UobWVzc2FnZSk7XHJcbiAgICAgIFxyXG4gICAgICBpZiAoaXNGcm9tT3RoZXIpIHtcclxuICAgICAgICB0aGlzLnBsYXlOb3RpZmljYXRpb25Tb3VuZCgpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy51cGRhdGVJbmJveFByZXZpZXcobWVzc2FnZSk7XHJcblxyXG4gICAgaWYgKHRoaXMuYWN0aXZlQ29udmVyc2F0aW9uSWQkLnZhbHVlICE9PSBtZXNzYWdlLmNvbnZlcnNhdGlvbl9pZCkge1xyXG4gICAgICBpZiAoaXNGcm9tT3RoZXIpIHtcclxuICAgICAgICB0aGlzLmluY3JlbWVudFVucmVhZChtZXNzYWdlLmNvbnZlcnNhdGlvbl9pZCk7XHJcbiAgICAgIH1cclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHRoaXMubWFya0FzUmVhZChtZXNzYWdlLmNvbnZlcnNhdGlvbl9pZCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKiogUHVibGljIOKAlCBsZXRzIGNvbXBvbmVudHMgYWRkIGFuIG9wdGltaXN0aWMgbWVzc2FnZSB3aXRob3V0IGEgcm91bmQtdHJpcC4gKi9cclxuICBhcHBlbmRPcHRpbWlzdGljTWVzc2FnZShtZXNzYWdlOiBNZXNzYWdlKTogdm9pZCB7XHJcbiAgICB0aGlzLmFwcGVuZE1lc3NhZ2UobWVzc2FnZSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGFwcGVuZE1lc3NhZ2UobWVzc2FnZTogTWVzc2FnZSk6IHZvaWQge1xyXG4gICAgY29uc3QgbWFwID0gbmV3IE1hcCh0aGlzLm1lc3NhZ2VzTWFwJC52YWx1ZSk7XHJcbiAgICBjb25zdCBtc2dzID0gWy4uLihtYXAuZ2V0KG1lc3NhZ2UuY29udmVyc2F0aW9uX2lkKSB8fCBbXSksIG1lc3NhZ2VdO1xyXG4gICAgbWFwLnNldChtZXNzYWdlLmNvbnZlcnNhdGlvbl9pZCwgbXNncyk7XHJcbiAgICB0aGlzLm1lc3NhZ2VzTWFwJC5uZXh0KG1hcCk7XHJcbiAgICB0aGlzLnJlZnJlc2hNZXNzYWdlUmVhY3Rpb25zKG1lc3NhZ2UubWVzc2FnZV9pZCk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHVwZGF0ZUluYm94UHJldmlldyhtZXNzYWdlOiBNZXNzYWdlKTogdm9pZCB7XHJcbiAgICBjb25zdCBpdGVtcyA9IHRoaXMuaW5ib3gkLnZhbHVlLm1hcCgoaXRlbSkgPT4ge1xyXG4gICAgICBpZiAoaXRlbS5jb252ZXJzYXRpb25faWQgPT09IG1lc3NhZ2UuY29udmVyc2F0aW9uX2lkKSB7XHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgIC4uLml0ZW0sXHJcbiAgICAgICAgICBsYXN0X21lc3NhZ2VfcHJldmlldzogbWVzc2FnZS5jb250ZW50IHx8ICdbSW1hZ2VdJyxcclxuICAgICAgICAgIGxhc3RfbWVzc2FnZV9hdDogbWVzc2FnZS5jcmVhdGVkX2F0LFxyXG4gICAgICAgIH07XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIGl0ZW07XHJcbiAgICB9KTtcclxuXHJcbiAgICBpdGVtcy5zb3J0KChhLCBiKSA9PiBuZXcgRGF0ZShiLmxhc3RfbWVzc2FnZV9hdCkuZ2V0VGltZSgpIC0gbmV3IERhdGUoYS5sYXN0X21lc3NhZ2VfYXQpLmdldFRpbWUoKSk7XHJcbiAgICB0aGlzLmluYm94JC5uZXh0KGl0ZW1zKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgaW5jcmVtZW50VW5yZWFkKGNvbnZlcnNhdGlvbklkOiBzdHJpbmcpOiB2b2lkIHtcclxuICAgIGNvbnN0IGl0ZW1zID0gdGhpcy5pbmJveCQudmFsdWUubWFwKChpdGVtKSA9PlxyXG4gICAgICBpdGVtLmNvbnZlcnNhdGlvbl9pZCA9PT0gY29udmVyc2F0aW9uSWRcclxuICAgICAgICA/IHsgLi4uaXRlbSwgdW5yZWFkX2NvdW50OiBOdW1iZXIoaXRlbS51bnJlYWRfY291bnQpICsgMSB9XHJcbiAgICAgICAgOiBpdGVtXHJcbiAgICApO1xyXG4gICAgdGhpcy5pbmJveCQubmV4dChpdGVtcyk7XHJcbiAgICB0aGlzLnJlY2FsY1VucmVhZChpdGVtcyk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBOb3JtYWxpemUgYmFja2VuZCBtZXNzYWdlIHNoYXBlcyBzbyBVSSBjYW4gcmVsaWFibHkgcmVuZGVyIGF0dGFjaG1lbnRzL21lZGlhLlxyXG4gICAqIFN1cHBvcnRzIGxlZ2FjeSBhbmQgY3VycmVudCBmaWVsZCBuYW1lcyByZXR1cm5lZCBieSBBUEkvV1MgcGF5bG9hZHMuXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBub3JtYWxpemVNZXNzYWdlU2hhcGUocmF3OiBhbnkpOiBNZXNzYWdlIHtcclxuICAgIGNvbnN0IGJhc2U6IE1lc3NhZ2UgPSB7XHJcbiAgICAgIG1lc3NhZ2VfaWQ6IFN0cmluZyhyYXc/Lm1lc3NhZ2VfaWQgPz8gcmF3Py5pZCA/PyAnJyksXHJcbiAgICAgIGNvbnZlcnNhdGlvbl9pZDogU3RyaW5nKHJhdz8uY29udmVyc2F0aW9uX2lkID8/IHJhdz8uY29udmVyc2F0aW9uSWQgPz8gJycpLFxyXG4gICAgICBzZW5kZXJfaWQ6IFN0cmluZyhyYXc/LnNlbmRlcl9pZCA/PyByYXc/LnNlbmRlcklkID8/ICcnKSxcclxuICAgICAgc2VuZGVyX25hbWU6IHJhdz8uc2VuZGVyX25hbWUsXHJcbiAgICAgIHNlbmRlcl91c2VybmFtZTogcmF3Py5zZW5kZXJfdXNlcm5hbWUsXHJcbiAgICAgIHNlbmRlcl9maXJzdF9uYW1lOiByYXc/LnNlbmRlcl9maXJzdF9uYW1lLFxyXG4gICAgICBzZW5kZXJfbGFzdF9uYW1lOiByYXc/LnNlbmRlcl9sYXN0X25hbWUsXHJcbiAgICAgIG1lc3NhZ2VfdHlwZTogKHJhdz8ubWVzc2FnZV90eXBlID8/IHJhdz8ubWVzc2FnZVR5cGUgPz8gJ1RFWFQnKSBhcyBNZXNzYWdlWydtZXNzYWdlX3R5cGUnXSxcclxuICAgICAgY29udGVudDogcmF3Py5jb250ZW50ID8/ICcnLFxyXG4gICAgICBtZWRpYV91cmw6IHJhdz8ubWVkaWFfdXJsID8/IHJhdz8ubWVkaWFVcmwgPz8gcmF3Py51cmwgPz8gcmF3Py5maWxlX3VybCxcclxuICAgICAgY3JlYXRlZF9hdDogcmF3Py5jcmVhdGVkX2F0ID8/IHJhdz8uY3JlYXRlZEF0ID8/IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcclxuICAgICAgaXNfcmVhZDogcmF3Py5pc19yZWFkLFxyXG4gICAgICByZWFjdGlvbnM6IHJhdz8ucmVhY3Rpb25zLFxyXG4gICAgICBtZW50aW9uczogcmF3Py5tZW50aW9ucyxcclxuICAgICAgYXR0YWNobWVudHM6IHJhdz8uYXR0YWNobWVudHMsXHJcbiAgICAgIGlzX3Bpbm5lZDogcmF3Py5pc19waW5uZWQsXHJcbiAgICAgIHBpbm5lZF9hdDogcmF3Py5waW5uZWRfYXQsXHJcbiAgICAgIHBpbm5lZF9ieTogcmF3Py5waW5uZWRfYnksXHJcbiAgICB9O1xyXG5cclxuICAgIGNvbnN0IHV1aWRSZSA9XHJcbiAgICAgIC9eWzAtOWEtZl17OH0tWzAtOWEtZl17NH0tWzEtNV1bMC05YS1mXXszfS1bODlhYl1bMC05YS1mXXszfS1bMC05YS1mXXsxMn0kL2k7XHJcblxyXG4gICAgLy8gTm9ybWFsaXplIGF0dGFjaG1lbnQgb2JqZWN0cyAoQVBJIG1heSB1c2UgZmlsZUlkIC8gaWQgaW5zdGVhZCBvZiBmaWxlX2lkKS5cclxuICAgIGlmIChBcnJheS5pc0FycmF5KGJhc2UuYXR0YWNobWVudHMpICYmIGJhc2UuYXR0YWNobWVudHMubGVuZ3RoID4gMCkge1xyXG4gICAgICBjb25zdCBtYXBwZWQ6IEF0dGFjaG1lbnRbXSA9IChiYXNlLmF0dGFjaG1lbnRzIGFzIGFueVtdKS5tYXAoKGEpID0+ICh7XHJcbiAgICAgICAgZmlsZV9pZDogU3RyaW5nKFxyXG4gICAgICAgICAgYT8uZmlsZV9pZCA/PyBhPy5maWxlSWQgPz8gYT8uaWQgPz8gYT8uYXR0YWNobWVudF9pZCA/PyBhPy5zdG9yYWdlX2ZpbGVfaWQgPz8gJydcclxuICAgICAgICApLnRyaW0oKSxcclxuICAgICAgICBmaWxlbmFtZTogU3RyaW5nKGE/LmZpbGVuYW1lID8/IGE/LmZpbGVfbmFtZSA/PyBhPy5uYW1lID8/IGE/Lm9yaWdpbmFsX2ZpbGVuYW1lID8/ICcnKSxcclxuICAgICAgICBtaW1lX3R5cGU6IGE/Lm1pbWVfdHlwZSA/PyBhPy5taW1lVHlwZSxcclxuICAgICAgICB1cmw6IGE/LnVybCA/PyBhPy5maWxlX3VybCA/PyBhPy5kb3dubG9hZF91cmwsXHJcbiAgICAgIH0pKS5maWx0ZXIoKGEpID0+ICEhYS5maWxlX2lkICYmICFhLmZpbGVfaWQuc3RhcnRzV2l0aCgndGVtcC0nKSk7XHJcblxyXG4gICAgICBpZiAobWFwcGVkLmxlbmd0aCA+IDApIHtcclxuICAgICAgICByZXR1cm4geyAuLi5iYXNlLCBhdHRhY2htZW50czogbWFwcGVkIH07XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvLyBSZWNvbnN0cnVjdCBhdHRhY2htZW50cyBmcm9tIGFsdGVybmF0ZSBBUEkgZmllbGRzLlxyXG4gICAgbGV0IGF0dGFjaG1lbnRJZHM6IHN0cmluZ1tdID0gW107XHJcbiAgICBpZiAoQXJyYXkuaXNBcnJheShyYXc/LmF0dGFjaG1lbnRfaWRzKSkge1xyXG4gICAgICBhdHRhY2htZW50SWRzID0gcmF3LmF0dGFjaG1lbnRfaWRzLm1hcCgoeDogYW55KSA9PiBTdHJpbmcoeCkudHJpbSgpKS5maWx0ZXIoQm9vbGVhbik7XHJcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiByYXc/LmF0dGFjaG1lbnRfaWRzID09PSAnc3RyaW5nJyAmJiByYXcuYXR0YWNobWVudF9pZHMudHJpbSgpKSB7XHJcbiAgICAgIGF0dGFjaG1lbnRJZHMgPSByYXcuYXR0YWNobWVudF9pZHNcclxuICAgICAgICAuc3BsaXQoL1ssXFxzXSsvKVxyXG4gICAgICAgIC5tYXAoKHM6IHN0cmluZykgPT4gcy50cmltKCkpXHJcbiAgICAgICAgLmZpbHRlcihCb29sZWFuKTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoYXR0YWNobWVudElkcy5sZW5ndGggPT09IDAgJiYgQXJyYXkuaXNBcnJheShyYXc/LmZpbGVfaWRzKSkge1xyXG4gICAgICBhdHRhY2htZW50SWRzID0gcmF3LmZpbGVfaWRzLm1hcCgoeDogYW55KSA9PiBTdHJpbmcoeCkudHJpbSgpKS5maWx0ZXIoQm9vbGVhbik7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgcHVzaElkID0gKHY6IGFueSkgPT4ge1xyXG4gICAgICBjb25zdCBzID0gdiAhPSBudWxsICYmIHYgIT09ICcnID8gU3RyaW5nKHYpLnRyaW0oKSA6ICcnO1xyXG4gICAgICBpZiAocyAmJiAhYXR0YWNobWVudElkcy5pbmNsdWRlcyhzKSkgYXR0YWNobWVudElkcy5wdXNoKHMpO1xyXG4gICAgfTtcclxuXHJcbiAgICBwdXNoSWQocmF3Py5maWxlX2lkKTtcclxuICAgIHB1c2hJZChyYXc/LmF0dGFjaG1lbnRfaWQpO1xyXG4gICAgcHVzaElkKHJhdz8uc3RvcmFnZV9maWxlX2lkKTtcclxuICAgIHB1c2hJZChyYXc/LmJsb2JfaWQpO1xyXG5cclxuICAgIC8vIEJhY2tlbmQgc3RvcmVzIGZpcnN0IGF0dGFjaG1lbnQgaWQgaW4gbWVzc2FnaW5nLm1lc3NhZ2UubWVkaWFfdXJsIChVVUlEKSwgbm90IGEgcHVibGljIFVSTC5cclxuICAgIGNvbnN0IG1lZGlhQXNJZCA9IFN0cmluZyhiYXNlLm1lZGlhX3VybCB8fCAnJykudHJpbSgpO1xyXG4gICAgaWYgKFxyXG4gICAgICBtZWRpYUFzSWQgJiZcclxuICAgICAgIW1lZGlhQXNJZC5zdGFydHNXaXRoKCdodHRwOi8vJykgJiZcclxuICAgICAgIW1lZGlhQXNJZC5zdGFydHNXaXRoKCdodHRwczovLycpICYmXHJcbiAgICAgICFtZWRpYUFzSWQuc3RhcnRzV2l0aCgnZGF0YTonKVxyXG4gICAgKSB7XHJcbiAgICAgIHB1c2hJZChtZWRpYUFzSWQpO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGNvbnRlbnRUcmltID0gU3RyaW5nKGJhc2UuY29udGVudCB8fCAnJykudHJpbSgpO1xyXG4gICAgaWYgKGF0dGFjaG1lbnRJZHMubGVuZ3RoID09PSAwICYmIHV1aWRSZS50ZXN0KGNvbnRlbnRUcmltKSkge1xyXG4gICAgICBhdHRhY2htZW50SWRzLnB1c2goY29udGVudFRyaW0pO1xyXG4gICAgfVxyXG4gICAgLy8gU29tZSBBUElzIHN0b3JlIHN0b3JhZ2UgLyBhdHRhY2htZW50IGlkIGFzIG51bWVyaWMgc3RyaW5nIGluIGNvbnRlbnQgZm9yIEZJTEUgbWVzc2FnZXMuXHJcbiAgICBpZiAoXHJcbiAgICAgIGF0dGFjaG1lbnRJZHMubGVuZ3RoID09PSAwICYmXHJcbiAgICAgIC9eXFxkKyQvLnRlc3QoY29udGVudFRyaW0pICYmXHJcbiAgICAgIChiYXNlLm1lc3NhZ2VfdHlwZSA9PT0gJ0ZJTEUnIHx8IGJhc2UubWVzc2FnZV90eXBlID09PSAnSU1BR0UnKVxyXG4gICAgKSB7XHJcbiAgICAgIGF0dGFjaG1lbnRJZHMucHVzaChjb250ZW50VHJpbSk7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgZmlsZW5hbWVzOiBzdHJpbmdbXSA9IEFycmF5LmlzQXJyYXkocmF3Py5maWxlbmFtZXMpXHJcbiAgICAgID8gcmF3LmZpbGVuYW1lcy5tYXAoKHg6IGFueSkgPT4gU3RyaW5nKHgpKVxyXG4gICAgICA6IHJhdz8uZmlsZW5hbWVcclxuICAgICAgPyBbU3RyaW5nKHJhdy5maWxlbmFtZSldXHJcbiAgICAgIDogcmF3Py5maWxlX25hbWVcclxuICAgICAgPyBbU3RyaW5nKHJhdy5maWxlX25hbWUpXVxyXG4gICAgICA6IGJhc2UuY29udGVudCAmJiAhdXVpZFJlLnRlc3QoY29udGVudFRyaW0pXHJcbiAgICAgID8gW1N0cmluZyhiYXNlLmNvbnRlbnQpXVxyXG4gICAgICA6IFtdO1xyXG5cclxuICAgIGlmIChhdHRhY2htZW50SWRzLmxlbmd0aCA+IDAgfHwgZmlsZW5hbWVzLmxlbmd0aCA+IDApIHtcclxuICAgICAgY29uc3QgZmFsbGJhY2tNaW1lID0gcmF3Py5taW1lX3R5cGUgPz8gcmF3Py5hdHRhY2htZW50X21pbWVfdHlwZTtcclxuICAgICAgY29uc3QgdXJsRmFsbGJhY2sgPSByYXc/LmZpbGVfdXJsID8/IHJhdz8udXJsID8/IHJhdz8ubWVkaWFfdXJsID8/IHJhdz8ubWVkaWFVcmw7XHJcbiAgICAgIGNvbnN0IGlkcyA9IGF0dGFjaG1lbnRJZHMubGVuZ3RoID4gMCA/IGF0dGFjaG1lbnRJZHMgOiBbXTtcclxuICAgICAgY29uc3QgYnVpbHQ6IEF0dGFjaG1lbnRbXSA9IGlkcy5tYXAoKGlkLCBpZHgpID0+ICh7XHJcbiAgICAgICAgZmlsZV9pZDogaWQsXHJcbiAgICAgICAgZmlsZW5hbWU6IGZpbGVuYW1lc1tpZHhdIHx8IGZpbGVuYW1lc1swXSB8fCBgQXR0YWNobWVudCAke2lkeCArIDF9YCxcclxuICAgICAgICBtaW1lX3R5cGU6IGZhbGxiYWNrTWltZSxcclxuICAgICAgICB1cmw6IHVybEZhbGxiYWNrLFxyXG4gICAgICB9KSk7XHJcblxyXG4gICAgICAvLyBGaWxlbmFtZSBvbmx5ICsgZGlyZWN0IFVSTCAobm8gc3RvcmFnZSBpZCk6IHN0aWxsIHJlbmRlcmFibGUgYXMgPGltZyBzcmM+LlxyXG4gICAgICBpZiAoXHJcbiAgICAgICAgYnVpbHQubGVuZ3RoID09PSAwICYmXHJcbiAgICAgICAgZmlsZW5hbWVzLmxlbmd0aCA+IDAgJiZcclxuICAgICAgICB1cmxGYWxsYmFjayAmJlxyXG4gICAgICAgIFN0cmluZyh1cmxGYWxsYmFjaykubWF0Y2goL15odHRwcz86XFwvXFwvL2kpXHJcbiAgICAgICkge1xyXG4gICAgICAgIGJ1aWx0LnB1c2goe1xyXG4gICAgICAgICAgZmlsZV9pZDogJycsXHJcbiAgICAgICAgICBmaWxlbmFtZTogZmlsZW5hbWVzWzBdLFxyXG4gICAgICAgICAgbWltZV90eXBlOiBmYWxsYmFja01pbWUsXHJcbiAgICAgICAgICB1cmw6IFN0cmluZyh1cmxGYWxsYmFjayksXHJcbiAgICAgICAgfSk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGlmIChidWlsdC5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgcmV0dXJuIHsgLi4uYmFzZSwgYXR0YWNobWVudHM6IGJ1aWx0IH07XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gYmFzZTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgcGxheU5vdGlmaWNhdGlvblNvdW5kKCk6IHZvaWQge1xyXG4gICAgdHJ5IHtcclxuICAgICAgY29uc3QgYXVkaW8gPSBuZXcgQXVkaW8oJ2RhdGE6YXVkaW8vd2F2O2Jhc2U2NCxVa2xHUm5vR0FBQlhRVlpGWm0xMElCQUFBQUFCQUFFQVFCOEFBRUFmQUFBQkFBZ0FaR0YwWVFvR0FBQ0JoWXFGYkYxZmRKaXZySkJoTmpWZ29kRGJxMkVjQmorYTIvTERjaVVGTElITzh0aUpOd2daYUx2dDU1OU5FQXhRcCtQd3RtTWNCamlSMS9MTWVTd0ZKSGZIOE4yUVFBb1VYclRwNjZoVkZBcEduK0R5dm13aEJTdUJ6dkxaaVRZSUdHUzU3T2loVUJFTFRLWGg4YmxsSEFVMmpkWHp6bjB2QlNoK3pQTGFpenNLRkdDejZPeXJXQlFMU0tEZjhzRnVJd1V1ZzgveTI0azNDQmhrdSt6b29WQVJDMHlsNGZHNVpSd0ZObzNWODg1OUx3VW9mc3p5Mm9zN0NoUmdzK2pzcTFnVkMwaWczL0xCYmlNRkxvTFA4dHVKTndnWVpMdnM2S0ZRRVF0TXBlSHh1V1VjQlRhTjFmUE9mUzhGS0g3TTh0cUxPd29VWUxQbzdLdFlGUXRJb04veXdXNGpCUzZDei9MYmlUY0lHR1M3N09paFVCRUxUS1hoOGJsbEhBVTJqZFh6em4wdkJTaCt6UExhaXpzS0ZHQ3o2T3lyV0JVTFNLRGY4c0Z1SXdVdWdzL3kyNGszQ0Joa3Urem9vVkFSQzB5bDRmRzVaUndGTm8zVjg4NTlMd1VvZnN6eTJvczdDaFJncytqc3ExZ1ZDMGlnMy9MQmJpTUZMb0xQOHR1Sk53Z1laTHZzNktGUUVRdE1wZUh4dVdVY0JUYU4xZlBPZlM4RktIN004dHFMT3dvVVlMUG83S3RZRlF0SW9OL3l3VzRqQlM2Q3ovTGJpVGNJR0dTNzdPaWhVQkVMVEtYaDhibGxIQVUyamRYenpuMHZCU2grelBMYWl6c0tGR0N6Nk95cldCVUxTS0RmOHNGdUl3VXVncy95MjRrM0NCaGt1K3pvb1ZBUkMweWw0Zkc1WlJ3Rk5vM1Y4ODU5THdVb2Zzenkyb3M3Q2hSZ3MranNxMWdWQzBpZzMvTEJiaU1GTG9MUDh0dUpOd2dZWkx2czZLRlFFUXRNcGVIeHVXVWNCVGFOMWZQT2ZTOEZLSDdNOHRxTE93b1VZTFBvN0t0WUZRdElvTi95d1c0akJTNkN6L0xiaVRjSUdHUzc3T2loVUJFTFRLWGg4YmxsSEFVMmpkWHp6bjB2QlNoK3pQTGFpenNLRkdDejZPeXJXQlVMU0tEZjhzRnVJd1V1Z3MveTI0azNDQmhrdSt6b29WQVJDMHlsNGZHNVpSd0ZObzNWODg1OUx3VW9mc3p5Mm9zN0NoUmdzK2pzcTFnVkMwaWczL0xCYmlNRkxvTFA4dHVKTndnWVpMdnM2S0ZRRVF0TXBlSHh1V1VjQlRhTjFmUE9mUzhGS0g3TTh0cUxPd29VWUxQbzdLdFlGUXRJb04veXdXNGpCUzZDei9MYmlUY0lHR1M3N09paFVCRUxUS1hoOGJsbEhBVTJqZFh6em4wdkJTaCt6UExhaXpzS0ZHQ3o2T3lyV0JVTFNLRGY4c0Z1SXdVdWdzL3kyNGszQ0Joa3Urem9vVkFSQzB5bDRmRzVaUndGTm8zVjg4NTlMd1VvZnN6eTJvczdDaFJncytqc3ExZ1ZDMGlnMy9MQmJpTUZMb0xQOHR1Sk53Z1laTHZzNktGUUVRdE1wZUh4dVdVY0JUYU4xZlBPZlM4RktIN004dHFMT3dvVVlMUG83S3RZRlF0SW9OL3l3VzRqQlM2Q3ovTGJpVGNJR0dTNzdPaWhVQkVMVEtYaDhibGxIQVUyamRYenpuMHZCU2grelBMYWl6c0tGR0N6Nk95cldCVUxTS0RmOHNGdUl3VXVncy95MjRrM0NCaGt1K3pvb1ZBUkMweWw0Zkc1WlJ3Rk5vM1Y4ODU5THdVb2ZzenknKTtcclxuICAgICAgYXVkaW8udm9sdW1lID0gMC4zO1xyXG4gICAgICBhdWRpby5wbGF5KCkuY2F0Y2goKCkgPT4ge30pO1xyXG4gICAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICAgIGNvbnNvbGUud2FybignTm90aWZpY2F0aW9uIHNvdW5kIGZhaWxlZDonLCBlcnIpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSByZWNhbGNVbnJlYWQoaXRlbXM6IEluYm94SXRlbVtdKTogdm9pZCB7XHJcbiAgICBjb25zdCB0b3RhbCA9IGl0ZW1zLnJlZHVjZSgoc3VtLCBpKSA9PiBzdW0gKyBOdW1iZXIoaS51bnJlYWRfY291bnQgfHwgMCksIDApO1xyXG4gICAgdGhpcy50b3RhbFVucmVhZCQubmV4dCh0b3RhbCk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGh5ZHJhdGVSZWFjdGlvbnNGb3JDb252ZXJzYXRpb24oY29udmVyc2F0aW9uSWQ6IHN0cmluZywgbWVzc2FnZXM6IE1lc3NhZ2VbXSk6IHZvaWQge1xyXG4gICAgY29uc3QgZmV0Y2hhYmxlID0gbWVzc2FnZXMuZmlsdGVyKFxyXG4gICAgICAobSkgPT4gISFtLm1lc3NhZ2VfaWQgJiYgIVN0cmluZyhtLm1lc3NhZ2VfaWQpLnN0YXJ0c1dpdGgoJ3RlbXAtJylcclxuICAgICk7XHJcbiAgICBpZiAoIWZldGNoYWJsZS5sZW5ndGgpIHJldHVybjtcclxuXHJcbiAgICBjb25zdCBqb2JzID0gZmV0Y2hhYmxlLm1hcCgobSkgPT5cclxuICAgICAgdGhpcy5hcGkuZ2V0UmVhY3Rpb25zKG0ubWVzc2FnZV9pZCkucGlwZShcclxuICAgICAgICBtYXAoKHJvd3MpID0+ICh7IG1lc3NhZ2VJZDogbS5tZXNzYWdlX2lkLCByZWFjdGlvbnM6IHRoaXMubm9ybWFsaXplUmVhY3Rpb25Sb3dzKHJvd3MpIH0pKSxcclxuICAgICAgICBjYXRjaEVycm9yKCgpID0+IG9mKHsgbWVzc2FnZUlkOiBtLm1lc3NhZ2VfaWQsIHJlYWN0aW9uczogW10gfSkpXHJcbiAgICAgIClcclxuICAgICk7XHJcblxyXG4gICAgZm9ya0pvaW4oam9icykuc3Vic2NyaWJlKChyZXN1bHRzKSA9PiB7XHJcbiAgICAgIGNvbnN0IG1hcCA9IG5ldyBNYXAodGhpcy5tZXNzYWdlc01hcCQudmFsdWUpO1xyXG4gICAgICBjb25zdCBjdXJyZW50ID0gWy4uLihtYXAuZ2V0KGNvbnZlcnNhdGlvbklkKSB8fCBbXSldO1xyXG4gICAgICBpZiAoIWN1cnJlbnQubGVuZ3RoKSByZXR1cm47XHJcblxyXG4gICAgICBsZXQgY2hhbmdlZCA9IGZhbHNlO1xyXG4gICAgICBmb3IgKGNvbnN0IHJlc3VsdCBvZiByZXN1bHRzKSB7XHJcbiAgICAgICAgY29uc3QgaWR4ID0gY3VycmVudC5maW5kSW5kZXgoKG0pID0+IFN0cmluZyhtLm1lc3NhZ2VfaWQpID09PSBTdHJpbmcocmVzdWx0Lm1lc3NhZ2VJZCkpO1xyXG4gICAgICAgIGlmIChpZHggPT09IC0xKSBjb250aW51ZTtcclxuICAgICAgICBjdXJyZW50W2lkeF0gPSB7IC4uLmN1cnJlbnRbaWR4XSwgcmVhY3Rpb25zOiByZXN1bHQucmVhY3Rpb25zIH07XHJcbiAgICAgICAgY2hhbmdlZCA9IHRydWU7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGlmIChjaGFuZ2VkKSB7XHJcbiAgICAgICAgbWFwLnNldChjb252ZXJzYXRpb25JZCwgY3VycmVudCk7XHJcbiAgICAgICAgdGhpcy5tZXNzYWdlc01hcCQubmV4dChtYXApO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgcmVmcmVzaE1lc3NhZ2VSZWFjdGlvbnMobWVzc2FnZUlkOiBzdHJpbmcpOiB2b2lkIHtcclxuICAgIGlmICghbWVzc2FnZUlkIHx8IFN0cmluZyhtZXNzYWdlSWQpLnN0YXJ0c1dpdGgoJ3RlbXAtJykpIHJldHVybjtcclxuXHJcbiAgICB0aGlzLmFwaS5nZXRSZWFjdGlvbnMobWVzc2FnZUlkKS5zdWJzY3JpYmUoe1xyXG4gICAgICBuZXh0OiAocm93cykgPT4ge1xyXG4gICAgICAgIGNvbnN0IG5vcm1hbGl6ZWQgPSB0aGlzLm5vcm1hbGl6ZVJlYWN0aW9uUm93cyhyb3dzKTtcclxuICAgICAgICBjb25zdCBtYXAgPSBuZXcgTWFwKHRoaXMubWVzc2FnZXNNYXAkLnZhbHVlKTtcclxuICAgICAgICBsZXQgY2hhbmdlZCA9IGZhbHNlO1xyXG5cclxuICAgICAgICBmb3IgKGNvbnN0IFtjb252ZXJzYXRpb25JZCwgbXNnc10gb2YgbWFwLmVudHJpZXMoKSkge1xyXG4gICAgICAgICAgY29uc3QgaWR4ID0gbXNncy5maW5kSW5kZXgoKG0pID0+IFN0cmluZyhtLm1lc3NhZ2VfaWQpID09PSBTdHJpbmcobWVzc2FnZUlkKSk7XHJcbiAgICAgICAgICBpZiAoaWR4ID09PSAtMSkgY29udGludWU7XHJcbiAgICAgICAgICBjb25zdCBuZXh0TXNncyA9IFsuLi5tc2dzXTtcclxuICAgICAgICAgIG5leHRNc2dzW2lkeF0gPSB7IC4uLm5leHRNc2dzW2lkeF0sIHJlYWN0aW9uczogbm9ybWFsaXplZCB9O1xyXG4gICAgICAgICAgbWFwLnNldChjb252ZXJzYXRpb25JZCwgbmV4dE1zZ3MpO1xyXG4gICAgICAgICAgY2hhbmdlZCA9IHRydWU7XHJcbiAgICAgICAgICBicmVhaztcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmIChjaGFuZ2VkKSB7XHJcbiAgICAgICAgICB0aGlzLm1lc3NhZ2VzTWFwJC5uZXh0KG1hcCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9LFxyXG4gICAgICBlcnJvcjogKCkgPT4ge30sXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgbm9ybWFsaXplUmVhY3Rpb25Sb3dzKHJvd3M6IGFueVtdKTogYW55W10ge1xyXG4gICAgY29uc3QgYnlFbW9qaSA9IG5ldyBNYXA8c3RyaW5nLCB7IGVtb2ppOiBzdHJpbmc7IGNvdW50OiBudW1iZXI7IGhhc1JlYWN0ZWQ6IGJvb2xlYW47IHJlYWN0b3JzOiBzdHJpbmdbXSB9PigpO1xyXG4gICAgY29uc3QgbXlDb250YWN0SWQgPSBTdHJpbmcodGhpcy5hdXRoLmNvbnRhY3RJZCB8fCAnJyk7XHJcbiAgICBjb25zdCBjb250YWN0cyA9IHRoaXMudmlzaWJsZUNvbnRhY3RzJC52YWx1ZTtcclxuXHJcbiAgICBmb3IgKGNvbnN0IHJvdyBvZiByb3dzIHx8IFtdKSB7XHJcbiAgICAgIGNvbnN0IGVtb2ppID0gU3RyaW5nKHJvdz8uZW1vamkgfHwgJycpLnRyaW0oKTtcclxuICAgICAgaWYgKCFlbW9qaSkgY29udGludWU7XHJcblxyXG4gICAgICBjb25zdCBjb250YWN0SWQgPSBTdHJpbmcocm93Py5jb250YWN0X2lkID8/IHJvdz8uY29udGFjdElkID8/ICcnKTtcclxuICAgICAgY29uc3QgZXhwbGljaXRIYXNSZWFjdGVkID0gcm93Py5oYXNSZWFjdGVkID8/IHJvdz8uaGFzX3JlYWN0ZWQ7XHJcbiAgICAgIGNvbnN0IGhhc1JlYWN0ZWQgPSBleHBsaWNpdEhhc1JlYWN0ZWQgPT09IHRydWUgfHwgKGNvbnRhY3RJZCAmJiBjb250YWN0SWQgPT09IG15Q29udGFjdElkKTtcclxuXHJcbiAgICAgIGNvbnN0IGNvdW50RnJvbVJvdyA9IE51bWJlcihyb3c/LmNvdW50ID8/IHJvdz8ucmVhY3Rpb25fY291bnQgPz8gMCk7XHJcbiAgICAgIGNvbnN0IGV4aXN0aW5nID0gYnlFbW9qaS5nZXQoZW1vamkpIHx8IHsgZW1vamksIGNvdW50OiAwLCBoYXNSZWFjdGVkOiBmYWxzZSwgcmVhY3RvcnM6IFtdIH07XHJcblxyXG4gICAgICAvLyBTb21lIEFQSXMgcmV0dXJuIG9uZSByb3cgcGVyIHJlYWN0aW9uOyBzb21lIHJldHVybiBwcmUtYWdncmVnYXRlZCBjb3VudC5cclxuICAgICAgZXhpc3RpbmcuY291bnQgKz0gY291bnRGcm9tUm93ID4gMCA/IGNvdW50RnJvbVJvdyA6IDE7XHJcbiAgICAgIGV4aXN0aW5nLmhhc1JlYWN0ZWQgPSBleGlzdGluZy5oYXNSZWFjdGVkIHx8ICEhaGFzUmVhY3RlZDtcclxuXHJcbiAgICAgIC8vIFRyYWNrIHJlYWN0b3IgZGlzcGxheSBuYW1lcyB3aGVuIGluZGl2aWR1YWwgY29udGFjdElkIGlzIGF2YWlsYWJsZVxyXG4gICAgICBpZiAoY29udGFjdElkICYmIGNvdW50RnJvbVJvdyA8PSAxKSB7XHJcbiAgICAgICAgbGV0IG5hbWU6IHN0cmluZztcclxuICAgICAgICBpZiAoY29udGFjdElkID09PSBteUNvbnRhY3RJZCkge1xyXG4gICAgICAgICAgbmFtZSA9ICdZb3UnO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICBjb25zdCBjb250YWN0ID0gY29udGFjdHMuZmluZChjID0+IFN0cmluZyhjLmNvbnRhY3RfaWQpID09PSBjb250YWN0SWQpO1xyXG4gICAgICAgICAgbmFtZSA9IGNvbnRhY3QgPyBnZXRDb250YWN0RGlzcGxheU5hbWUoY29udGFjdCkgOiBgVXNlciAke2NvbnRhY3RJZH1gO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoIWV4aXN0aW5nLnJlYWN0b3JzLmluY2x1ZGVzKG5hbWUpKSB7XHJcbiAgICAgICAgICBleGlzdGluZy5yZWFjdG9ycy5wdXNoKG5hbWUpO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG5cclxuICAgICAgYnlFbW9qaS5zZXQoZW1vamksIGV4aXN0aW5nKTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gQXJyYXkuZnJvbShieUVtb2ppLnZhbHVlcygpKS5maWx0ZXIoKHIpID0+IHIuY291bnQgPiAwKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgYXBwbHlSZWFjdGlvbk9wdGltaXN0aWNhbGx5KG1lc3NhZ2VJZDogc3RyaW5nLCBlbW9qaTogc3RyaW5nLCBhZGQ6IGJvb2xlYW4pOiB2b2lkIHtcclxuICAgIGNvbnN0IG1hcCA9IG5ldyBNYXAodGhpcy5tZXNzYWdlc01hcCQudmFsdWUpO1xyXG4gICAgbGV0IGRpZFVwZGF0ZSA9IGZhbHNlO1xyXG5cclxuICAgIGZvciAoY29uc3QgW2NvbnZlcnNhdGlvbklkLCBtc2dzXSBvZiBtYXAuZW50cmllcygpKSB7XHJcbiAgICAgIGNvbnN0IGlkeCA9IG1zZ3MuZmluZEluZGV4KChtKSA9PiBTdHJpbmcobS5tZXNzYWdlX2lkKSA9PT0gU3RyaW5nKG1lc3NhZ2VJZCkpO1xyXG4gICAgICBpZiAoaWR4ID09PSAtMSkgY29udGludWU7XHJcblxyXG4gICAgICBjb25zdCB0YXJnZXQgPSBtc2dzW2lkeF07XHJcbiAgICAgIGNvbnN0IG5leHRSZWFjdGlvbnMgPSBbLi4uKHRhcmdldC5yZWFjdGlvbnMgfHwgW10pXTtcclxuICAgICAgY29uc3QgcklkeCA9IG5leHRSZWFjdGlvbnMuZmluZEluZGV4KChyKSA9PiByLmVtb2ppID09PSBlbW9qaSk7XHJcblxyXG4gICAgICBpZiAoYWRkKSB7XHJcbiAgICAgICAgaWYgKHJJZHggPj0gMCkge1xyXG4gICAgICAgICAgY29uc3QgY3VycmVudCA9IG5leHRSZWFjdGlvbnNbcklkeF07XHJcbiAgICAgICAgICBpZiAoIWN1cnJlbnQuaGFzUmVhY3RlZCkge1xyXG4gICAgICAgICAgICBuZXh0UmVhY3Rpb25zW3JJZHhdID0ge1xyXG4gICAgICAgICAgICAgIC4uLmN1cnJlbnQsXHJcbiAgICAgICAgICAgICAgaGFzUmVhY3RlZDogdHJ1ZSxcclxuICAgICAgICAgICAgICBjb3VudDogTnVtYmVyKGN1cnJlbnQuY291bnQgfHwgMCkgKyAxLFxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICBuZXh0UmVhY3Rpb25zLnB1c2goeyBlbW9qaSwgY291bnQ6IDEsIGhhc1JlYWN0ZWQ6IHRydWUgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIGlmIChySWR4ID49IDApIHtcclxuICAgICAgICAgIGNvbnN0IGN1cnJlbnQgPSBuZXh0UmVhY3Rpb25zW3JJZHhdO1xyXG4gICAgICAgICAgY29uc3QgbmV4dENvdW50ID0gTWF0aC5tYXgoTnVtYmVyKGN1cnJlbnQuY291bnQgfHwgMCkgLSAoY3VycmVudC5oYXNSZWFjdGVkID8gMSA6IDApLCAwKTtcclxuICAgICAgICAgIGlmIChuZXh0Q291bnQgPT09IDApIHtcclxuICAgICAgICAgICAgbmV4dFJlYWN0aW9ucy5zcGxpY2UocklkeCwgMSk7XHJcbiAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBuZXh0UmVhY3Rpb25zW3JJZHhdID0ge1xyXG4gICAgICAgICAgICAgIC4uLmN1cnJlbnQsXHJcbiAgICAgICAgICAgICAgaGFzUmVhY3RlZDogZmFsc2UsXHJcbiAgICAgICAgICAgICAgY291bnQ6IG5leHRDb3VudCxcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGNvbnN0IHVwZGF0ZWRNc2c6IE1lc3NhZ2UgPSB7IC4uLnRhcmdldCwgcmVhY3Rpb25zOiBuZXh0UmVhY3Rpb25zIH07XHJcbiAgICAgIGNvbnN0IHVwZGF0ZWRNc2dzID0gWy4uLm1zZ3NdO1xyXG4gICAgICB1cGRhdGVkTXNnc1tpZHhdID0gdXBkYXRlZE1zZztcclxuICAgICAgbWFwLnNldChjb252ZXJzYXRpb25JZCwgdXBkYXRlZE1zZ3MpO1xyXG4gICAgICBkaWRVcGRhdGUgPSB0cnVlO1xyXG4gICAgICBicmVhaztcclxuICAgIH1cclxuXHJcbiAgICBpZiAoZGlkVXBkYXRlKSB7XHJcbiAgICAgIHRoaXMubWVzc2FnZXNNYXAkLm5leHQobWFwKTtcclxuICAgIH1cclxuICB9XHJcbn1cclxuIl19