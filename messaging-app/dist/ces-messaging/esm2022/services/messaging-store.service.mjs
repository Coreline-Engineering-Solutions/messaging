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
    panelFloating$ = new BehaviorSubject(false);
    notificationVolume$ = new BehaviorSubject(Number(localStorage.getItem('messaging_notification_volume') ?? '0.35'));
    notificationsMuted$ = new BehaviorSubject(localStorage.getItem('messaging_notifications_muted') === 'true');
    toast$ = new BehaviorSubject(null);
    removedGroupIds$ = new BehaviorSubject(new Set());
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
    panelFloating = this.panelFloating$.asObservable();
    notificationVolume = this.notificationVolume$.asObservable();
    notificationsMuted = this.notificationsMuted$.asObservable();
    toast = this.toast$.asObservable();
    removedGroupIds = this.removedGroupIds$.asObservable();
    wsSub = null;
    destroy$ = new Subject();
    pollTimer = null;
    groupSettings$ = new BehaviorSubject(null);
    deletingConversationIds = new Set();
    removalToastShown = new Set();
    toastTimer = null;
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
        if (this.toastTimer) {
            clearTimeout(this.toastTimer);
            this.toastTimer = null;
        }
        this.wsService.disconnect();
        this.wsSub?.unsubscribe();
        this.inbox$.next([]);
        this.messagesMap$.next(new Map());
        this.openChats$.next([]);
        this.panelOpen$.next(false);
        this.activeView$.next('inbox');
        this.activeConversationId$.next(null);
        this.totalUnread$.next(0);
        this.deletingConversationIds.clear();
        this.removalToastShown.clear();
        this.removedGroupIds$.next(new Set());
        this.toast$.next(null);
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
    setPanelFloating(isFloating) {
        this.panelFloating$.next(isFloating);
    }
    setNotificationVolume(volume) {
        const normalized = Math.max(0, Math.min(1, Number(volume)));
        this.notificationVolume$.next(normalized);
        localStorage.setItem('messaging_notification_volume', String(normalized));
        if (normalized > 0 && this.notificationsMuted$.value) {
            this.setNotificationsMuted(false);
        }
    }
    setNotificationsMuted(muted) {
        this.notificationsMuted$.next(muted);
        localStorage.setItem('messaging_notifications_muted', String(muted));
    }
    testNotificationSound() {
        this.playSoftNotificationSound(true);
    }
    showToast(message, type = 'info', durationMs = 3000) {
        if (this.toastTimer) {
            clearTimeout(this.toastTimer);
            this.toastTimer = null;
        }
        this.toast$.next({ message, type });
        this.toastTimer = setTimeout(() => {
            this.toast$.next(null);
            this.toastTimer = null;
        }, durationMs);
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
                }).filter(item => !this.deletingConversationIds.has(String(item.conversation_id)) &&
                    !this.removedGroupIds$.value.has(String(item.conversation_id)));
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
        if (!existing || existing.length === 0) {
            this.loadMessages(conversationId);
        }
        this.markAsRead(conversationId);
        this.wsService.subscribe(conversationId);
    }
    closeChat(conversationId) {
        const chats = this.openChats$.value.filter((c) => c.conversationId !== conversationId);
        this.openChats$.next(chats);
        if (String(this.activeConversationId$.value) === String(conversationId)) {
            this.activeConversationId$.next(null);
            this.activeView$.next('inbox');
        }
    }
    markGroupRemoved(conversationId) {
        const id = String(conversationId);
        if (!id || id === 'undefined')
            return;
        const next = new Set(this.removedGroupIds$.value);
        next.add(id);
        this.removedGroupIds$.next(next);
        const items = this.inbox$.value.filter(i => String(i.conversation_id) !== id);
        this.inbox$.next(items);
        this.recalcUnread(items);
        if (!this.removalToastShown.has(id)) {
            this.removalToastShown.add(id);
            this.showToast('You were removed from this group', 'info', 5000);
        }
    }
    exitRemovedGroup(conversationId) {
        const id = String(conversationId);
        const next = new Set(this.removedGroupIds$.value);
        next.delete(id);
        this.removedGroupIds$.next(next);
        this.removalToastShown.delete(id);
        this.removeConversationFromUi(id);
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
                sorted.forEach((m) => this.detectGroupRemovalForCurrentUser(m));
                const existingById = new Map(existing.map(m => [String(m.message_id), m]));
                if (beforeMessageId) {
                    // Prepend older messages, preserving existing reactions
                    const merged = [...sorted, ...existing];
                    map.set(conversationId, merged);
                }
                else {
                    // Replace with server data but keep the richer of existing vs server attachments
                    // (the optimistic path may have more attachment metadata than the server echoes back).
                    const merged = sorted.map(m => {
                        const cached = existingById.get(String(m.message_id));
                        if (!cached)
                            return m;
                        return this.mergeMessageAttachments(cached, m);
                    });
                    map.set(conversationId, merged);
                }
                this.messagesMap$.next(map);
                this.hydrateReactionsForConversation(conversationId, map.get(conversationId) || [], skipReactionHydration);
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
            is_read: false,
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
                    message_type: messageType === 'SYSTEM' ? 'SYSTEM' : res?.message_type ?? optimistic.message_type,
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
    createGroupConversation(participantIds, name, callbacks) {
        const contactId = this.auth.contactId;
        if (!contactId) {
            callbacks?.error?.();
            return;
        }
        const allParticipants = participantIds.includes(contactId)
            ? participantIds
            : [contactId, ...participantIds];
        this.api.createConversation(contactId, allParticipants, name).subscribe({
            next: (conv) => {
                // Backend may return conversation_id, id, or conversationId
                const convId = String(typeof conv === 'string' || typeof conv === 'number'
                    ? conv
                    : conv?.conversation_id || conv?.id || conv?.conversationId || '');
                if (!convId) {
                    this.loadInbox();
                    callbacks?.error?.();
                    return;
                }
                this.loadInbox();
                this.clearGroupSettings();
                this.openConversation(convId, name, true);
                callbacks?.success?.();
            },
            error: () => {
                callbacks?.error?.();
            },
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
    manageGroup(action, conversationId, groupName, participantContactIds, callbacks) {
        const contactId = this.auth.contactId;
        if (!contactId) {
            callbacks?.error?.();
            return;
        }
        if (action === 'remove' && conversationId && participantContactIds?.length) {
            const actorName = this.getContactNameById(contactId);
            const noticeJobs = participantContactIds.map((id) => this.api.sendMessage(conversationId, contactId, `${actorName} removed ${this.getContactNameById(id)} from the group`, 'SYSTEM').pipe(catchError(() => of(null))));
            const removeJobs = participantContactIds.map((id) => this.api.manageGroup(id, action, conversationId, groupName));
            forkJoin(noticeJobs).subscribe({
                next: () => {
                    forkJoin(removeJobs).subscribe({
                        next: () => {
                            this.loadInbox();
                            callbacks?.success?.();
                        },
                        error: () => {
                            callbacks?.error?.();
                        },
                    });
                },
                error: () => {
                    callbacks?.error?.();
                },
            });
            return;
        }
        this.api.manageGroup(contactId, action, conversationId, groupName, participantContactIds).subscribe({
            next: () => {
                this.loadInbox();
                if (action === 'add' && conversationId && participantContactIds?.length) {
                    const addedNames = participantContactIds.map((id) => this.getContactNameById(id));
                    const text = `${this.getContactNameById(contactId)} added ${addedNames.join(', ')} to the group`;
                    this.sendMessage(conversationId, text, 'SYSTEM');
                }
                callbacks?.success?.();
            },
            error: () => {
                callbacks?.error?.();
            },
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
    deleteGroup(conversationId, callbacks) {
        const contactId = this.auth.contactId;
        if (!contactId || this.deletingConversationIds.has(conversationId)) {
            callbacks?.error?.();
            return;
        }
        const previousInbox = this.inbox$.value;
        const previousMessagesMap = new Map(this.messagesMap$.value);
        const previousOpenChats = this.openChats$.value;
        const previousActiveConversationId = this.activeConversationId$.value;
        const previousActiveView = this.activeView$.value;
        const previousGroupSettings = this.groupSettings$.value;
        this.deletingConversationIds.add(conversationId);
        this.showToast('Exiting group...', 'info', 1500);
        this.removeConversationFromUi(conversationId);
        this.api.deleteGroup(conversationId, contactId).subscribe({
            next: () => {
                this.deletingConversationIds.delete(conversationId);
                this.showToast('Exited group', 'success');
                callbacks?.success?.();
            },
            error: () => {
                this.deletingConversationIds.delete(conversationId);
                this.inbox$.next(previousInbox);
                this.recalcUnread(previousInbox);
                this.messagesMap$.next(previousMessagesMap);
                this.openChats$.next(previousOpenChats);
                this.groupSettings$.next(previousGroupSettings);
                this.activeConversationId$.next(previousActiveConversationId);
                this.activeView$.next(previousActiveView);
                this.showToast('Could not exit group', 'error');
                callbacks?.error?.();
            },
        });
    }
    removeConversationFromUi(conversationId) {
        const items = this.inbox$.value.filter(i => String(i.conversation_id) !== String(conversationId));
        this.inbox$.next(items);
        this.recalcUnread(items);
        const map = new Map(this.messagesMap$.value);
        map.delete(conversationId);
        this.messagesMap$.next(map);
        this.openChats$.next(this.openChats$.value.filter(c => String(c.conversationId) !== String(conversationId)));
        if (String(this.activeConversationId$.value) === String(conversationId)) {
            this.activeConversationId$.next(null);
            this.activeView$.next('inbox');
        }
        const settings = this.groupSettings$.value;
        if (settings?.conversationId === conversationId) {
            this.clearGroupSettings();
        }
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
        this.detectGroupRemovalForCurrentUser(message);
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
                const merged = this.mergeMessageAttachments(existing[tempIdx], this.normalizeMessageShape({
                    ...existing[tempIdx],
                    ...data,
                    message_id: message.message_id,
                    conversation_id: convId,
                    content: this.coalesceMessageText(data, existing[tempIdx].content),
                }));
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
        const duplicateIdx = existing.findIndex((m) => String(m.message_id) === String(message.message_id) ||
            (String(m.sender_id) === String(message.sender_id) &&
                String(m.content ?? '') === String(message.content ?? '') &&
                Math.abs(new Date(m.created_at).getTime() - new Date(message.created_at).getTime()) < 2000));
        const isDuplicate = duplicateIdx >= 0;
        if (!isDuplicate) {
            this.appendMessage(message);
            if (isFromOther) {
                this.playSoftNotificationSound();
            }
            this.updateInboxPreview(message);
        }
        else {
            const map = new Map(this.messagesMap$.value);
            const msgs = [...existing];
            msgs[duplicateIdx] = this.mergeMessageAttachments(existing[duplicateIdx], message);
            map.set(convId, msgs);
            this.messagesMap$.next(map);
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
        const current = map.get(message.conversation_id) || [];
        const sameIdIdx = current.findIndex((m) => String(m.message_id) === String(message.message_id));
        if (sameIdIdx >= 0) {
            const msgs = [...current];
            msgs[sameIdIdx] = this.mergeMessageAttachments(current[sameIdIdx], message);
            map.set(message.conversation_id, msgs);
            this.messagesMap$.next(map);
            this.refreshMessageReactions(message.message_id);
            return;
        }
        const msgs = [...current, message];
        map.set(message.conversation_id, msgs);
        this.messagesMap$.next(map);
        this.refreshMessageReactions(message.message_id);
    }
    mergeMessageAttachments(existing, incoming) {
        const existingAttachments = this.normalizeAttachmentList(existing.attachments || []);
        const incomingAttachments = this.normalizeAttachmentList(incoming.attachments || []);
        const attachments = incomingAttachments.length >= existingAttachments.length ? incomingAttachments : existingAttachments;
        return {
            ...existing,
            ...incoming,
            reactions: incoming.reactions || existing.reactions,
            attachments: attachments.length > 0 ? attachments : incoming.attachments || existing.attachments,
        };
    }
    normalizeAttachmentList(attachments) {
        const byId = new Map();
        for (const attachment of attachments) {
            const fileId = String(attachment?.file_id || '').trim();
            if (!fileId || fileId.startsWith('temp-'))
                continue;
            byId.set(fileId, {
                ...attachment,
                file_id: fileId,
                filename: attachment.filename || 'File',
            });
        }
        return Array.from(byId.values());
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
        const toStringArray = (value) => {
            if (Array.isArray(value)) {
                return value
                    .map((x) => (typeof x === 'string' ? x : x?.file_id ?? x?.id ?? ''))
                    .map((x) => String(x).trim())
                    .filter(Boolean);
            }
            if (typeof value === 'string' && value.trim()) {
                const trimmed = value.trim();
                if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                    try {
                        const parsed = JSON.parse(trimmed);
                        if (Array.isArray(parsed))
                            return toStringArray(parsed);
                        return toStringArray(parsed?.ids ?? parsed?.file_ids ?? parsed?.attachment_ids ?? parsed?.attachments);
                    }
                    catch {
                        return [];
                    }
                }
                return trimmed.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
            }
            return [];
        };
        const normalizeAttachment = (a) => {
            const fileId = String(typeof a === 'string' ? a :
                a?.file_id ?? a?.fileId ?? a?.id ?? a?.attachment_id ?? a?.storage_file_id ?? '').trim();
            if (!fileId || fileId.startsWith('temp-'))
                return null;
            return {
                file_id: fileId,
                filename: String(a?.filename ?? a?.file_name ?? a?.name ?? a?.original_filename ?? 'File'),
                mime_type: a?.mime_type ?? a?.mimeType,
                size_bytes: a?.size_bytes ?? a?.sizeBytes,
                url: a?.url ?? a?.file_url ?? a?.download_url,
            };
        };
        let normalizedAttachments = [];
        const addAttachment = (attachment) => {
            if (!attachment)
                return;
            const fileId = String(attachment.file_id || '').trim();
            const url = String(attachment.url || '').trim();
            if (fileId.startsWith('{') || fileId.startsWith('[')) {
                const ids = toStringArray(fileId);
                ids.forEach((id, idx) => {
                    addAttachment({
                        ...attachment,
                        file_id: id,
                        filename: attachment.filename || `Attachment ${idx + 1}`,
                    });
                });
                return;
            }
            if (fileId && normalizedAttachments.some((a) => a.file_id === fileId))
                return;
            if (!fileId && url && normalizedAttachments.some((a) => a.url === url))
                return;
            normalizedAttachments.push(attachment);
        };
        // Normalize attachment objects (API may use fileId / id instead of file_id).
        if (Array.isArray(base.attachments) && base.attachments.length > 0) {
            base.attachments.forEach((a) => addAttachment(normalizeAttachment(a)));
        }
        const mediaValue = String(base.media_url || '').trim();
        if (mediaValue.startsWith('{') || mediaValue.startsWith('[')) {
            try {
                const parsed = JSON.parse(mediaValue);
                const rawAttachments = Array.isArray(parsed) ? parsed : parsed?.attachments;
                if (Array.isArray(rawAttachments)) {
                    rawAttachments.forEach((a) => addAttachment(normalizeAttachment(a)));
                }
                if (!Array.isArray(parsed)) {
                    const mediaIds = toStringArray(parsed?.ids ?? parsed?.file_ids ?? parsed?.attachment_ids);
                    const mediaFilenames = toStringArray(parsed?.filenames);
                    const mediaMimeTypes = toStringArray(parsed?.mime_types ?? parsed?.mimeTypes);
                    mediaIds.forEach((id, idx) => {
                        addAttachment({
                            file_id: id,
                            filename: mediaFilenames[idx] || mediaFilenames[0] || `Attachment ${idx + 1}`,
                            mime_type: mediaMimeTypes[idx],
                        });
                    });
                }
            }
            catch {
                // Fall through to legacy attachment reconstruction below.
            }
        }
        // Reconstruct attachments from alternate API fields.
        let attachmentIds = [];
        attachmentIds = toStringArray(raw?.attachment_ids);
        if (attachmentIds.length === 0) {
            attachmentIds = toStringArray(raw?.file_ids);
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
            !mediaAsId.startsWith('{') &&
            !mediaAsId.startsWith('[') &&
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
        const filenames = toStringArray(raw?.filenames).length
            ? toStringArray(raw?.filenames)
            : raw?.filename
                ? [String(raw.filename)]
                : raw?.file_name
                    ? [String(raw.file_name)]
                    : base.content && !uuidRe.test(contentTrim)
                        ? [String(base.content)]
                        : [];
        const mimeTypes = toStringArray(raw?.mime_types).length
            ? toStringArray(raw?.mime_types)
            : toStringArray(raw?.mimeTypes);
        if (attachmentIds.length > 0 || filenames.length > 0) {
            const fallbackMime = raw?.mime_type ?? raw?.attachment_mime_type;
            const urlFallback = raw?.file_url ?? raw?.url ?? raw?.media_url ?? raw?.mediaUrl;
            const ids = attachmentIds.length > 0 ? attachmentIds : [];
            const built = ids.map((id, idx) => ({
                file_id: id,
                filename: filenames[idx] || filenames[0] || `Attachment ${idx + 1}`,
                mime_type: mimeTypes[idx] || fallbackMime,
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
            built.forEach((attachment) => addAttachment(attachment));
        }
        if (normalizedAttachments.length > 0) {
            return { ...base, attachments: normalizedAttachments };
        }
        return base;
    }
    playSoftNotificationSound(force = false) {
        if (!force && this.notificationsMuted$.value)
            return;
        const volume = Math.max(0, Math.min(1, this.notificationVolume$.value));
        if (volume <= 0 && !force)
            return;
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx)
                return;
            const ctx = new AudioCtx();
            const master = ctx.createGain();
            const outputGain = Math.max(volume, 0.001);
            master.gain.setValueAtTime(0.0001, ctx.currentTime);
            master.gain.exponentialRampToValueAtTime(outputGain, ctx.currentTime + 0.015);
            master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.42);
            master.connect(ctx.destination);
            const playTone = (frequency, start, duration) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(frequency, ctx.currentTime + start);
                gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
                gain.gain.exponentialRampToValueAtTime(0.55, ctx.currentTime + start + 0.025);
                gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + duration);
                osc.connect(gain);
                gain.connect(master);
                osc.start(ctx.currentTime + start);
                osc.stop(ctx.currentTime + start + duration + 0.02);
            };
            playTone(740, 0, 0.18);
            playTone(988, 0.12, 0.22);
            window.setTimeout(() => ctx.close().catch(() => { }), 600);
        }
        catch {
        }
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
    getContactNameById(contactId) {
        const id = String(contactId);
        if (id === String(this.auth.contactId || '') && this.auth.currentContact) {
            return getContactDisplayName(this.auth.currentContact);
        }
        const contact = this.visibleContacts$.value.find((c) => String(c.contact_id) === id);
        return contact ? getContactDisplayName(contact) : `User ${id}`;
    }
    detectGroupRemovalForCurrentUser(message) {
        const content = String(message.content || '').trim();
        const match = content.match(/^(.+) removed (.+) from the group$/);
        if (!match)
            return;
        const myContact = this.auth.currentContact;
        const myName = myContact ? getContactDisplayName(myContact).trim().toLowerCase() : '';
        const removedName = match[2]?.trim().toLowerCase();
        if (!myName || removedName !== myName)
            return;
        const convId = String(message.conversation_id || '');
        if (convId) {
            this.markGroupRemoved(convId);
        }
    }
    hydrateReactionsForConversation(conversationId, messages, onlyMissing = false) {
        const fetchable = messages.filter((m) => {
            if (!m.message_id || String(m.message_id).startsWith('temp-'))
                return false;
            if (!onlyMissing)
                return true;
            return !Array.isArray(m.reactions) || m.reactions.length === 0;
        });
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
        const parseReactors = (value) => {
            if (Array.isArray(value))
                return value;
            if (value && typeof value === 'object')
                return [value];
            if (typeof value !== 'string' || !value.trim())
                return [];
            const trimmed = value.trim();
            if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                try {
                    const parsed = JSON.parse(trimmed);
                    return Array.isArray(parsed) ? parsed : [parsed];
                }
                catch {
                    return [trimmed];
                }
            }
            return trimmed.split(',').map((x) => x.trim()).filter(Boolean);
        };
        const displayNameForReactor = (reactor) => {
            if (reactor == null)
                return '';
            if (typeof reactor === 'string') {
                const trimmed = reactor.trim();
                if (!trimmed)
                    return '';
                if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                    const parsed = parseReactors(trimmed);
                    return parsed.map(displayNameForReactor).filter(Boolean).join(', ');
                }
                return trimmed;
            }
            const reactorId = String(reactor?.contact_id ?? reactor?.contactId ?? reactor?.id ?? '').trim();
            if (reactorId && reactorId === myContactId)
                return 'You';
            const explicitName = String(reactor?.username ??
                reactor?.name ??
                reactor?.display_name ??
                reactor?.displayName ??
                reactor?.email ??
                '').trim();
            if (explicitName)
                return explicitName;
            if (reactorId) {
                const contact = contacts.find(c => String(c.contact_id) === reactorId);
                return contact ? getContactDisplayName(contact) : `User ${reactorId}`;
            }
            return '';
        };
        for (const row of rows || []) {
            const emoji = String(row?.emoji || '').trim();
            if (!emoji)
                continue;
            const contactId = String(row?.contact_id ?? row?.contactId ?? '');
            const explicitHasReacted = row?.hasReacted ?? row?.has_reacted;
            const hasReacted = explicitHasReacted === true || (contactId && contactId === myContactId);
            const rawReactors = row?.reactors ??
                row?.reactor_names ??
                row?.reactorNames ??
                row?.reacted_by ??
                row?.reactedBy ??
                row?.users ??
                [];
            const reactorRows = parseReactors(rawReactors);
            const countFromRow = Number(row?.count ?? row?.reaction_count ?? row?.reactionCount ?? reactorRows.length ?? 0);
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
            for (const reactor of reactorRows) {
                const reactorId = String(typeof reactor === 'object'
                    ? reactor?.contact_id ?? reactor?.contactId ?? reactor?.id ?? ''
                    : '').trim();
                const name = displayNameForReactor(reactor);
                if (reactorId && reactorId === myContactId) {
                    existing.hasReacted = true;
                }
                if (name && !existing.reactors.includes(name)) {
                    existing.reactors.push(name);
                }
            }
            const directName = String(row?.reactor_name ??
                row?.reactorName ??
                row?.contact_name ??
                row?.contactName ??
                row?.username ??
                row?.email ??
                '').trim();
            if (directName && !existing.reactors.includes(directName)) {
                existing.reactors.push(contactId === myContactId ? 'You' : directName);
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
                        const reactors = Array.isArray(current.reactors) ? [...current.reactors] : [];
                        if (!reactors.includes('You'))
                            reactors.unshift('You');
                        nextReactions[rIdx] = {
                            ...current,
                            hasReacted: true,
                            count: Number(current.count || 0) + 1,
                            reactors,
                        };
                    }
                }
                else {
                    nextReactions.push({ emoji, count: 1, hasReacted: true, reactors: ['You'] });
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
                            reactors: Array.isArray(current.reactors)
                                ? current.reactors.filter((name) => name !== 'You')
                                : current.reactors,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVzc2FnaW5nLXN0b3JlLnNlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvbGliL3NlcnZpY2VzL21lc3NhZ2luZy1zdG9yZS5zZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxVQUFVLEVBQWEsTUFBTSxlQUFlLENBQUM7QUFDdEQsT0FBTyxFQUFFLGVBQWUsRUFBRSxVQUFVLEVBQUUsT0FBTyxFQUFnQixRQUFRLEVBQUUsRUFBRSxFQUFFLE1BQU0sTUFBTSxDQUFDO0FBQ3hGLE9BQU8sRUFBRSxVQUFVLEVBQUUsR0FBRyxFQUFFLE1BQU0sZ0JBQWdCLENBQUM7QUFJakQsT0FBTyxFQVFMLHFCQUFxQixHQUV0QixNQUFNLDRCQUE0QixDQUFDOzs7OztBQUdwQyxNQUFNLE9BQU8scUJBQXFCO0lBNER0QjtJQUNBO0lBQ0E7SUE3RFYsdUJBQXVCO0lBQ2YsTUFBTSxHQUFHLElBQUksZUFBZSxDQUFjLEVBQUUsQ0FBQyxDQUFDO0lBQzlDLFlBQVksR0FBRyxJQUFJLGVBQWUsQ0FBeUIsSUFBSSxHQUFHLEVBQUUsQ0FBQyxDQUFDO0lBQ3RFLFVBQVUsR0FBRyxJQUFJLGVBQWUsQ0FBZSxFQUFFLENBQUMsQ0FBQztJQUNuRCxnQkFBZ0IsR0FBRyxJQUFJLGVBQWUsQ0FBWSxFQUFFLENBQUMsQ0FBQztJQUN0RCxVQUFVLEdBQUcsSUFBSSxlQUFlLENBQVUsS0FBSyxDQUFDLENBQUM7SUFDakQsV0FBVyxHQUFHLElBQUksZUFBZSxDQUFvRixPQUFPLENBQUMsQ0FBQztJQUM5SCxZQUFZLEdBQUcsSUFBSSxlQUFlLENBQ3ZDLFlBQVksQ0FBQyxPQUFPLENBQUMsd0JBQXdCLENBQWlCLElBQUksT0FBTyxDQUMzRSxDQUFDO0lBQ00scUJBQXFCLEdBQUcsSUFBSSxlQUFlLENBQWdCLElBQUksQ0FBQyxDQUFDO0lBQ2pFLG1CQUFtQixHQUFHLElBQUksZUFBZSxDQUEyQyxJQUFJLENB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QkFBcUIsY0FEUixNQUFNOzs0RkFDbkIscUJBQXFCO2tCQURqQyxVQUFVO21CQUFDLEVBQUUsVUFBVSxFQUFFLE1BQU0sRUFBRSIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEluamVjdGFibGUsIE9uRGVzdHJveSB9IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xyXG5pbXBvcnQgeyBCZWhhdmlvclN1YmplY3QsIE9ic2VydmFibGUsIFN1YmplY3QsIFN1YnNjcmlwdGlvbiwgZm9ya0pvaW4sIG9mIH0gZnJvbSAncnhqcyc7XHJcbmltcG9ydCB7IGNhdGNoRXJyb3IsIG1hcCB9IGZyb20gJ3J4anMvb3BlcmF0b3JzJztcclxuaW1wb3J0IHsgQXV0aFNlcnZpY2UgfSBmcm9tICcuL2F1dGguc2VydmljZSc7XHJcbmltcG9ydCB7IE1lc3NhZ2luZ0FwaVNlcnZpY2UgfSBmcm9tICcuL21lc3NhZ2luZy1hcGkuc2VydmljZSc7XHJcbmltcG9ydCB7IE1lc3NhZ2luZ1dlYlNvY2tldFNlcnZpY2UgfSBmcm9tICcuL21lc3NhZ2luZy13ZWJzb2NrZXQuc2VydmljZSc7XHJcbmltcG9ydCB7XHJcbiAgSW5ib3hJdGVtLFxyXG4gIE1lc3NhZ2UsXHJcbiAgQXR0YWNobWVudCxcclxuICBDb250YWN0LFxyXG4gIENoYXRXaW5kb3csXHJcbiAgV2ViU29ja2V0TWVzc2FnZSxcclxuICBTaWRlYmFyU2lkZSxcclxuICBnZXRDb250YWN0RGlzcGxheU5hbWUsXHJcbiAgZ2V0TWVzc2FnZVNlbmRlck5hbWUsXHJcbn0gZnJvbSAnLi4vbW9kZWxzL21lc3NhZ2luZy5tb2RlbHMnO1xyXG5cclxuQEluamVjdGFibGUoeyBwcm92aWRlZEluOiAncm9vdCcgfSlcclxuZXhwb3J0IGNsYXNzIE1lc3NhZ2luZ1N0b3JlU2VydmljZSBpbXBsZW1lbnRzIE9uRGVzdHJveSB7XHJcbiAgLy8g4pSA4pSAIFN0YXRlIHN1YmplY3RzIOKUgOKUgFxyXG4gIHByaXZhdGUgaW5ib3gkID0gbmV3IEJlaGF2aW9yU3ViamVjdDxJbmJveEl0ZW1bXT4oW10pO1xyXG4gIHByaXZhdGUgbWVzc2FnZXNNYXAkID0gbmV3IEJlaGF2aW9yU3ViamVjdDxNYXA8c3RyaW5nLCBNZXNzYWdlW10+PihuZXcgTWFwKCkpO1xyXG4gIHByaXZhdGUgb3BlbkNoYXRzJCA9IG5ldyBCZWhhdmlvclN1YmplY3Q8Q2hhdFdpbmRvd1tdPihbXSk7XHJcbiAgcHJpdmF0ZSB2aXNpYmxlQ29udGFjdHMkID0gbmV3IEJlaGF2aW9yU3ViamVjdDxDb250YWN0W10+KFtdKTtcclxuICBwcml2YXRlIHBhbmVsT3BlbiQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PGJvb2xlYW4+KGZhbHNlKTtcclxuICBwcml2YXRlIGFjdGl2ZVZpZXckID0gbmV3IEJlaGF2aW9yU3ViamVjdDwnaW5ib3gnIHwgJ2NoYXQnIHwgJ25ldy1jb252ZXJzYXRpb24nIHwgJ2dyb3VwLW1hbmFnZXInIHwgJ2NvbnZlcnNhdGlvbi1zZXR0aW5ncyc+KCdpbmJveCcpO1xyXG4gIHByaXZhdGUgc2lkZWJhclNpZGUkID0gbmV3IEJlaGF2aW9yU3ViamVjdDxTaWRlYmFyU2lkZT4oXHJcbiAgICAobG9jYWxTdG9yYWdlLmdldEl0ZW0oJ21lc3NhZ2luZ19zaWRlYmFyX3NpZGUnKSBhcyBTaWRlYmFyU2lkZSkgfHwgJ3JpZ2h0J1xyXG4gICk7XHJcbiAgcHJpdmF0ZSBhY3RpdmVDb252ZXJzYXRpb25JZCQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PHN0cmluZyB8IG51bGw+KG51bGwpO1xyXG4gIHByaXZhdGUgcGVuZGluZ0RtUmVjaXBpZW50JCA9IG5ldyBCZWhhdmlvclN1YmplY3Q8e2NvbnRhY3RJZDogc3RyaW5nLCBuYW1lOiBzdHJpbmd9IHwgbnVsbD4obnVsbCk7XHJcbiAgcHJpdmF0ZSB0b3RhbFVucmVhZCQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PG51bWJlcj4oMCk7XHJcbiAgcHJpdmF0ZSBsb2FkaW5nTWVzc2FnZXMkID0gbmV3IEJlaGF2aW9yU3ViamVjdDxib29sZWFuPihmYWxzZSk7XHJcbiAgcHJpdmF0ZSBwYW5lbFBvc2l0aW9uJCA9IG5ldyBCZWhhdmlvclN1YmplY3Q8eyB4OiBudW1iZXI7IHk6IG51bWJlciB9IHwgbnVsbD4obnVsbCk7XHJcbiAgcHJpdmF0ZSBwYW5lbFNpemUkID0gbmV3IEJlaGF2aW9yU3ViamVjdDx7IHdpZHRoOiBudW1iZXI7IGhlaWdodDogbnVtYmVyIH0+KHsgd2lkdGg6IDM4MCwgaGVpZ2h0OiA1NjAgfSk7XHJcbiAgcHJpdmF0ZSB3YXNPcGVuQmVmb3JlRHJhZyQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PGJvb2xlYW4+KGZhbHNlKTtcclxuICBwcml2YXRlIHBhbmVsRmxvYXRpbmckID0gbmV3IEJlaGF2aW9yU3ViamVjdDxib29sZWFuPihmYWxzZSk7XHJcbiAgcHJpdmF0ZSBub3RpZmljYXRpb25Wb2x1bWUkID0gbmV3IEJlaGF2aW9yU3ViamVjdDxudW1iZXI+KFxyXG4gICAgTnVtYmVyKGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdtZXNzYWdpbmdfbm90aWZpY2F0aW9uX3ZvbHVtZScpID8/ICcwLjM1JylcclxuICApO1xyXG4gIHByaXZhdGUgbm90aWZpY2F0aW9uc011dGVkJCA9IG5ldyBCZWhhdmlvclN1YmplY3Q8Ym9vbGVhbj4oXHJcbiAgICBsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnbWVzc2FnaW5nX25vdGlmaWNhdGlvbnNfbXV0ZWQnKSA9PT0gJ3RydWUnXHJcbiAgKTtcclxuICBwcml2YXRlIHRvYXN0JCA9IG5ldyBCZWhhdmlvclN1YmplY3Q8eyBtZXNzYWdlOiBzdHJpbmc7IHR5cGU6ICdpbmZvJyB8ICdzdWNjZXNzJyB8ICdlcnJvcicgfSB8IG51bGw+KG51bGwpO1xyXG4gIHByaXZhdGUgcmVtb3ZlZEdyb3VwSWRzJCA9IG5ldyBCZWhhdmlvclN1YmplY3Q8U2V0PHN0cmluZz4+KG5ldyBTZXQoKSk7XHJcblxyXG4gIC8vIOKUgOKUgCBQdWJsaWMgb2JzZXJ2YWJsZXMg4pSA4pSAXHJcbiAgcmVhZG9ubHkgaW5ib3ggPSB0aGlzLmluYm94JC5hc09ic2VydmFibGUoKTtcclxuICByZWFkb25seSBtZXNzYWdlc01hcCA9IHRoaXMubWVzc2FnZXNNYXAkLmFzT2JzZXJ2YWJsZSgpO1xyXG4gIHJlYWRvbmx5IG9wZW5DaGF0cyA9IHRoaXMub3BlbkNoYXRzJC5hc09ic2VydmFibGUoKTtcclxuICByZWFkb25seSB2aXNpYmxlQ29udGFjdHMgPSB0aGlzLnZpc2libGVDb250YWN0cyQuYXNPYnNlcnZhYmxlKCk7XHJcbiAgcmVhZG9ubHkgcGFuZWxPcGVuID0gdGhpcy5wYW5lbE9wZW4kLmFzT2JzZXJ2YWJsZSgpO1xyXG4gIHJlYWRvbmx5IGFjdGl2ZVZpZXcgPSB0aGlzLmFjdGl2ZVZpZXckLmFzT2JzZXJ2YWJsZSgpO1xyXG4gIHJlYWRvbmx5IGFjdGl2ZUNvbnZlcnNhdGlvbklkID0gdGhpcy5hY3RpdmVDb252ZXJzYXRpb25JZCQuYXNPYnNlcnZhYmxlKCk7XHJcbiAgcmVhZG9ubHkgdG90YWxVbnJlYWQgPSB0aGlzLnRvdGFsVW5yZWFkJC5hc09ic2VydmFibGUoKTtcclxuICByZWFkb25seSBsb2FkaW5nTWVzc2FnZXMgPSB0aGlzLmxvYWRpbmdNZXNzYWdlcyQuYXNPYnNlcnZhYmxlKCk7XHJcbiAgd3NTdGF0dXM6IE9ic2VydmFibGU8c3RyaW5nPiA9IG5ldyBPYnNlcnZhYmxlPHN0cmluZz4oKTtcclxuICByZWFkb25seSBwYW5lbFBvc2l0aW9uID0gdGhpcy5wYW5lbFBvc2l0aW9uJC5hc09ic2VydmFibGUoKTtcclxuICByZWFkb25seSBwYW5lbFNpemUgPSB0aGlzLnBhbmVsU2l6ZSQuYXNPYnNlcnZhYmxlKCk7XHJcbiAgcmVhZG9ubHkgd2FzT3BlbkJlZm9yZURyYWcgPSB0aGlzLndhc09wZW5CZWZvcmVEcmFnJC5hc09ic2VydmFibGUoKTtcclxuICByZWFkb25seSBzaWRlYmFyU2lkZSA9IHRoaXMuc2lkZWJhclNpZGUkLmFzT2JzZXJ2YWJsZSgpO1xyXG4gIHJlYWRvbmx5IHBhbmVsRmxvYXRpbmcgPSB0aGlzLnBhbmVsRmxvYXRpbmckLmFzT2JzZXJ2YWJsZSgpO1xyXG4gIHJlYWRvbmx5IG5vdGlmaWNhdGlvblZvbHVtZSA9IHRoaXMubm90aWZpY2F0aW9uVm9sdW1lJC5hc09ic2VydmFibGUoKTtcclxuICByZWFkb25seSBub3RpZmljYXRpb25zTXV0ZWQgPSB0aGlzLm5vdGlmaWNhdGlvbnNNdXRlZCQuYXNPYnNlcnZhYmxlKCk7XHJcbiAgcmVhZG9ubHkgdG9hc3QgPSB0aGlzLnRvYXN0JC5hc09ic2VydmFibGUoKTtcclxuICByZWFkb25seSByZW1vdmVkR3JvdXBJZHMgPSB0aGlzLnJlbW92ZWRHcm91cElkcyQuYXNPYnNlcnZhYmxlKCk7XHJcblxyXG4gIHByaXZhdGUgd3NTdWI6IFN1YnNjcmlwdGlvbiB8IG51bGwgPSBudWxsO1xyXG4gIHByaXZhdGUgZGVzdHJveSQgPSBuZXcgU3ViamVjdDx2b2lkPigpO1xyXG4gIHByaXZhdGUgcG9sbFRpbWVyOiBhbnkgPSBudWxsO1xyXG4gIHByaXZhdGUgZ3JvdXBTZXR0aW5ncyQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PHsgY29udmVyc2F0aW9uSWQ6IHN0cmluZzsgbmFtZTogc3RyaW5nIH0gfCBudWxsPihudWxsKTtcclxuICBwcml2YXRlIGRlbGV0aW5nQ29udmVyc2F0aW9uSWRzID0gbmV3IFNldDxzdHJpbmc+KCk7XHJcbiAgcHJpdmF0ZSByZW1vdmFsVG9hc3RTaG93biA9IG5ldyBTZXQ8c3RyaW5nPigpO1xyXG4gIHByaXZhdGUgdG9hc3RUaW1lcjogYW55ID0gbnVsbDtcclxuXHJcbiAgcmVhZG9ubHkgZ3JvdXBTZXR0aW5ncyA9IHRoaXMuZ3JvdXBTZXR0aW5ncyQuYXNPYnNlcnZhYmxlKCk7XHJcblxyXG4gIGNvbnN0cnVjdG9yKFxyXG4gICAgcHJpdmF0ZSBhdXRoOiBBdXRoU2VydmljZSxcclxuICAgIHByaXZhdGUgYXBpOiBNZXNzYWdpbmdBcGlTZXJ2aWNlLFxyXG4gICAgcHJpdmF0ZSB3c1NlcnZpY2U6IE1lc3NhZ2luZ1dlYlNvY2tldFNlcnZpY2VcclxuICApIHtcclxuICAgICh0aGlzIGFzIGFueSkud3NTdGF0dXMgPSB0aGlzLndzU2VydmljZS5zdGF0dXMkO1xyXG4gIH1cclxuXHJcbiAgLy8g4pSA4pSAIEluaXRpYWxpemF0aW9uIOKUgOKUgFxyXG4gIGluaXRpYWxpemUoKTogdm9pZCB7XHJcbiAgICBpZiAoIXRoaXMuYXV0aC5pc0F1dGhlbnRpY2F0ZWQoKSkgcmV0dXJuO1xyXG5cclxuICAgIGNvbnN0IGNvbnRhY3RJZCA9IHRoaXMuYXV0aC5jb250YWN0SWQhO1xyXG4gICAgY29uc3Qgc2Vzc2lvbkdpZCA9IHRoaXMuYXV0aC5zZXNzaW9uR2lkITtcclxuXHJcbiAgICB0aGlzLmxvYWRJbmJveCgpO1xyXG4gICAgdGhpcy5sb2FkVmlzaWJsZUNvbnRhY3RzKCk7XHJcblxyXG4gICAgdGhpcy53c1NlcnZpY2UuY29ubmVjdChjb250YWN0SWQsIHNlc3Npb25HaWQpO1xyXG4gICAgdGhpcy5saXN0ZW5XZWJTb2NrZXQoKTtcclxuICAgIHRoaXMuc3RhcnRQb2xsaW5nKCk7XHJcbiAgfVxyXG5cclxuICB0ZWFyZG93bigpOiB2b2lkIHtcclxuICAgIHRoaXMuc3RvcFBvbGxpbmcoKTtcclxuICAgIGlmICh0aGlzLnRvYXN0VGltZXIpIHtcclxuICAgICAgY2xlYXJUaW1lb3V0KHRoaXMudG9hc3RUaW1lcik7XHJcbiAgICAgIHRoaXMudG9hc3RUaW1lciA9IG51bGw7XHJcbiAgICB9XHJcbiAgICB0aGlzLndzU2VydmljZS5kaXNjb25uZWN0KCk7XHJcbiAgICB0aGlzLndzU3ViPy51bnN1YnNjcmliZSgpO1xyXG4gICAgdGhpcy5pbmJveCQubmV4dChbXSk7XHJcbiAgICB0aGlzLm1lc3NhZ2VzTWFwJC5uZXh0KG5ldyBNYXAoKSk7XHJcbiAgICB0aGlzLm9wZW5DaGF0cyQubmV4dChbXSk7XHJcbiAgICB0aGlzLnBhbmVsT3BlbiQubmV4dChmYWxzZSk7XHJcbiAgICB0aGlzLmFjdGl2ZVZpZXckLm5leHQoJ2luYm94Jyk7XHJcbiAgICB0aGlzLmFjdGl2ZUNvbnZlcnNhdGlvbklkJC5uZXh0KG51bGwpO1xyXG4gICAgdGhpcy50b3RhbFVucmVhZCQubmV4dCgwKTtcclxuICAgIHRoaXMuZGVsZXRpbmdDb252ZXJzYXRpb25JZHMuY2xlYXIoKTtcclxuICAgIHRoaXMucmVtb3ZhbFRvYXN0U2hvd24uY2xlYXIoKTtcclxuICAgIHRoaXMucmVtb3ZlZEdyb3VwSWRzJC5uZXh0KG5ldyBTZXQoKSk7XHJcbiAgICB0aGlzLnRvYXN0JC5uZXh0KG51bGwpO1xyXG4gIH1cclxuXHJcbiAgLy8g4pSA4pSAIFBvbGxpbmcgZmFsbGJhY2sgKGluYm94IG9ubHkgLSBtZXNzYWdlcyByZWx5IG9uIFdlYlNvY2tldCkg4pSA4pSAXHJcbiAgcHJpdmF0ZSBzdGFydFBvbGxpbmcoKTogdm9pZCB7XHJcbiAgICB0aGlzLnN0b3BQb2xsaW5nKCk7XHJcbiAgICB0aGlzLnBvbGxUaW1lciA9IHNldEludGVydmFsKCgpID0+IHtcclxuICAgICAgdGhpcy5sb2FkSW5ib3goKTtcclxuICAgIH0sIDMwMDAwKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgc3RvcFBvbGxpbmcoKTogdm9pZCB7XHJcbiAgICBpZiAodGhpcy5wb2xsVGltZXIpIHtcclxuICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLnBvbGxUaW1lcik7XHJcbiAgICAgIHRoaXMucG9sbFRpbWVyID0gbnVsbDtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIG5nT25EZXN0cm95KCk6IHZvaWQge1xyXG4gICAgdGhpcy50ZWFyZG93bigpO1xyXG4gICAgdGhpcy5kZXN0cm95JC5uZXh0KCk7XHJcbiAgICB0aGlzLmRlc3Ryb3kkLmNvbXBsZXRlKCk7XHJcbiAgfVxyXG5cclxuICAvLyDilIDilIAgUGFuZWwgY29udHJvbHMg4pSA4pSAXHJcbiAgdG9nZ2xlUGFuZWwoYnV0dG9uWD86IG51bWJlciwgYnV0dG9uWT86IG51bWJlcik6IHZvaWQge1xyXG4gICAgaWYgKGJ1dHRvblggIT09IHVuZGVmaW5lZCAmJiBidXR0b25ZICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgdGhpcy5wYW5lbFBvc2l0aW9uJC5uZXh0KHsgeDogYnV0dG9uWCwgeTogYnV0dG9uWSB9KTtcclxuICAgIH1cclxuICAgIHRoaXMucGFuZWxPcGVuJC5uZXh0KCF0aGlzLnBhbmVsT3BlbiQudmFsdWUpO1xyXG4gIH1cclxuXHJcbiAgb3BlblBhbmVsKGJ1dHRvblg/OiBudW1iZXIsIGJ1dHRvblk/OiBudW1iZXIpOiB2b2lkIHtcclxuICAgIGlmIChidXR0b25YICE9PSB1bmRlZmluZWQgJiYgYnV0dG9uWSAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgIHRoaXMucGFuZWxQb3NpdGlvbiQubmV4dCh7IHg6IGJ1dHRvblgsIHk6IGJ1dHRvblkgfSk7XHJcbiAgICB9XHJcbiAgICB0aGlzLnBhbmVsT3BlbiQubmV4dCh0cnVlKTtcclxuICB9XHJcblxyXG4gIGNsb3NlUGFuZWwoKTogdm9pZCB7XHJcbiAgICB0aGlzLnBhbmVsT3BlbiQubmV4dChmYWxzZSk7XHJcbiAgfVxyXG5cclxuICBzZXRQYW5lbFNpemUod2lkdGg6IG51bWJlciwgaGVpZ2h0OiBudW1iZXIpOiB2b2lkIHtcclxuICAgIHRoaXMucGFuZWxTaXplJC5uZXh0KHsgd2lkdGgsIGhlaWdodCB9KTtcclxuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdtZXNzYWdpbmdfcGFuZWxfc2l6ZScsIEpTT04uc3RyaW5naWZ5KHsgd2lkdGgsIGhlaWdodCB9KSk7XHJcbiAgfVxyXG5cclxuICBnZXRQYW5lbFNpemUoKTogeyB3aWR0aDogbnVtYmVyOyBoZWlnaHQ6IG51bWJlciB9IHtcclxuICAgIGNvbnN0IHNhdmVkID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ21lc3NhZ2luZ19wYW5lbF9zaXplJyk7XHJcbiAgICBpZiAoc2F2ZWQpIHtcclxuICAgICAgdHJ5IHtcclxuICAgICAgICBjb25zdCBwYXJzZWQgPSBKU09OLnBhcnNlKHNhdmVkKTtcclxuICAgICAgICBpZiAocGFyc2VkLndpZHRoICYmIHBhcnNlZC5oZWlnaHQpIHtcclxuICAgICAgICAgIHRoaXMucGFuZWxTaXplJC5uZXh0KHBhcnNlZCk7XHJcbiAgICAgICAgICByZXR1cm4gcGFyc2VkO1xyXG4gICAgICAgIH1cclxuICAgICAgfSBjYXRjaCB7fVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIHRoaXMucGFuZWxTaXplJC52YWx1ZTtcclxuICB9XHJcblxyXG4gIG9uQnV0dG9uRHJhZ1N0YXJ0KCk6IHZvaWQge1xyXG4gICAgdGhpcy53YXNPcGVuQmVmb3JlRHJhZyQubmV4dCh0aGlzLnBhbmVsT3BlbiQudmFsdWUpO1xyXG4gICAgaWYgKHRoaXMucGFuZWxPcGVuJC52YWx1ZSkge1xyXG4gICAgICB0aGlzLnBhbmVsT3BlbiQubmV4dChmYWxzZSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBvbkJ1dHRvbkRyYWdFbmQoYnV0dG9uWDogbnVtYmVyLCBidXR0b25ZOiBudW1iZXIpOiB2b2lkIHtcclxuICAgIGlmICh0aGlzLndhc09wZW5CZWZvcmVEcmFnJC52YWx1ZSkge1xyXG4gICAgICB0aGlzLm9wZW5QYW5lbChidXR0b25YLCBidXR0b25ZKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHNldFZpZXcodmlldzogJ2luYm94JyB8ICdjaGF0JyB8ICduZXctY29udmVyc2F0aW9uJyB8ICdncm91cC1tYW5hZ2VyJyB8ICdjb252ZXJzYXRpb24tc2V0dGluZ3MnKTogdm9pZCB7XHJcbiAgICB0aGlzLmFjdGl2ZVZpZXckLm5leHQodmlldyk7XHJcbiAgfVxyXG5cclxuICB0b2dnbGVTaWRlYmFyU2lkZSgpOiB2b2lkIHtcclxuICAgIGNvbnN0IG5leHQgPSB0aGlzLnNpZGViYXJTaWRlJC52YWx1ZSA9PT0gJ3JpZ2h0JyA/ICdsZWZ0JyA6ICdyaWdodCc7XHJcbiAgICB0aGlzLnNpZGViYXJTaWRlJC5uZXh0KG5leHQpO1xyXG4gICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ21lc3NhZ2luZ19zaWRlYmFyX3NpZGUnLCBuZXh0KTtcclxuICB9XHJcblxyXG4gIHNldFBhbmVsRmxvYXRpbmcoaXNGbG9hdGluZzogYm9vbGVhbik6IHZvaWQge1xyXG4gICAgdGhpcy5wYW5lbEZsb2F0aW5nJC5uZXh0KGlzRmxvYXRpbmcpO1xyXG4gIH1cclxuXHJcbiAgc2V0Tm90aWZpY2F0aW9uVm9sdW1lKHZvbHVtZTogbnVtYmVyKTogdm9pZCB7XHJcbiAgICBjb25zdCBub3JtYWxpemVkID0gTWF0aC5tYXgoMCwgTWF0aC5taW4oMSwgTnVtYmVyKHZvbHVtZSkpKTtcclxuICAgIHRoaXMubm90aWZpY2F0aW9uVm9sdW1lJC5uZXh0KG5vcm1hbGl6ZWQpO1xyXG4gICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ21lc3NhZ2luZ19ub3RpZmljYXRpb25fdm9sdW1lJywgU3RyaW5nKG5vcm1hbGl6ZWQpKTtcclxuICAgIGlmIChub3JtYWxpemVkID4gMCAmJiB0aGlzLm5vdGlmaWNhdGlvbnNNdXRlZCQudmFsdWUpIHtcclxuICAgICAgdGhpcy5zZXROb3RpZmljYXRpb25zTXV0ZWQoZmFsc2UpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgc2V0Tm90aWZpY2F0aW9uc011dGVkKG11dGVkOiBib29sZWFuKTogdm9pZCB7XHJcbiAgICB0aGlzLm5vdGlmaWNhdGlvbnNNdXRlZCQubmV4dChtdXRlZCk7XHJcbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnbWVzc2FnaW5nX25vdGlmaWNhdGlvbnNfbXV0ZWQnLCBTdHJpbmcobXV0ZWQpKTtcclxuICB9XHJcblxyXG4gIHRlc3ROb3RpZmljYXRpb25Tb3VuZCgpOiB2b2lkIHtcclxuICAgIHRoaXMucGxheVNvZnROb3RpZmljYXRpb25Tb3VuZCh0cnVlKTtcclxuICB9XHJcblxyXG4gIHNob3dUb2FzdChtZXNzYWdlOiBzdHJpbmcsIHR5cGU6ICdpbmZvJyB8ICdzdWNjZXNzJyB8ICdlcnJvcicgPSAnaW5mbycsIGR1cmF0aW9uTXMgPSAzMDAwKTogdm9pZCB7XHJcbiAgICBpZiAodGhpcy50b2FzdFRpbWVyKSB7XHJcbiAgICAgIGNsZWFyVGltZW91dCh0aGlzLnRvYXN0VGltZXIpO1xyXG4gICAgICB0aGlzLnRvYXN0VGltZXIgPSBudWxsO1xyXG4gICAgfVxyXG4gICAgdGhpcy50b2FzdCQubmV4dCh7IG1lc3NhZ2UsIHR5cGUgfSk7XHJcbiAgICB0aGlzLnRvYXN0VGltZXIgPSBzZXRUaW1lb3V0KCgpID0+IHtcclxuICAgICAgdGhpcy50b2FzdCQubmV4dChudWxsKTtcclxuICAgICAgdGhpcy50b2FzdFRpbWVyID0gbnVsbDtcclxuICAgIH0sIGR1cmF0aW9uTXMpO1xyXG4gIH1cclxuXHJcbiAgZ2V0U2lkZWJhclNpZGUoKTogU2lkZWJhclNpZGUge1xyXG4gICAgcmV0dXJuIHRoaXMuc2lkZWJhclNpZGUkLnZhbHVlO1xyXG4gIH1cclxuXHJcbiAgLy8g4pSA4pSAIEluYm94IOKUgOKUgFxyXG4gIGxvYWRJbmJveCgpOiB2b2lkIHtcclxuICAgIGNvbnN0IGNvbnRhY3RJZCA9IHRoaXMuYXV0aC5jb250YWN0SWQ7XHJcbiAgICBpZiAoIWNvbnRhY3RJZCkgcmV0dXJuO1xyXG5cclxuICAgIHRoaXMuYXBpLmdldEluYm94KGNvbnRhY3RJZCkuc3Vic2NyaWJlKHtcclxuICAgICAgbmV4dDogKGl0ZW1zKSA9PiB7XHJcbiAgICAgICAgY29uc3QgbWFwcGVkID0gaXRlbXMubWFwKGl0ZW0gPT4ge1xyXG4gICAgICAgICAgY29uc3QgaXNHcm91cCA9IGl0ZW0uaXNfZ3JvdXAgPT09IHRydWUgfHwgKGl0ZW0uaXNfZ3JvdXAgYXMgYW55KSA9PT0gJ1RydWUnO1xyXG4gICAgICAgICAgXHJcbiAgICAgICAgICBpZiAoIWlzR3JvdXAgJiYgIWl0ZW0ubmFtZSAmJiBpdGVtLm90aGVyX3BhcnRpY2lwYW50X25hbWUpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHsgLi4uaXRlbSwgbmFtZTogaXRlbS5vdGhlcl9wYXJ0aWNpcGFudF9uYW1lLCBpc19ncm91cDogZmFsc2UgfTtcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIHJldHVybiB7IC4uLml0ZW0sIGlzX2dyb3VwOiBpc0dyb3VwIH07XHJcbiAgICAgICAgfSkuZmlsdGVyKGl0ZW0gPT5cclxuICAgICAgICAgICF0aGlzLmRlbGV0aW5nQ29udmVyc2F0aW9uSWRzLmhhcyhTdHJpbmcoaXRlbS5jb252ZXJzYXRpb25faWQpKSAmJlxyXG4gICAgICAgICAgIXRoaXMucmVtb3ZlZEdyb3VwSWRzJC52YWx1ZS5oYXMoU3RyaW5nKGl0ZW0uY29udmVyc2F0aW9uX2lkKSlcclxuICAgICAgICApO1xyXG4gICAgICAgIHRoaXMuaW5ib3gkLm5leHQobWFwcGVkKTtcclxuICAgICAgICB0aGlzLnJlY2FsY1VucmVhZChtYXBwZWQpO1xyXG5cclxuICAgICAgICBjb25zdCBpZHMgPSBtYXBwZWQubWFwKChpKSA9PiBpLmNvbnZlcnNhdGlvbl9pZCk7XHJcbiAgICAgICAgdGhpcy53c1NlcnZpY2Uuc3Vic2NyaWJlQWxsKGlkcyk7XHJcbiAgICAgIH0sXHJcbiAgICAgIGVycm9yOiAoKSA9PiB7fSxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLy8g4pSA4pSAIENvbnRhY3RzIOKUgOKUgFxyXG4gIGxvYWRWaXNpYmxlQ29udGFjdHMoKTogdm9pZCB7XHJcbiAgICBjb25zdCBjb250YWN0SWQgPSB0aGlzLmF1dGguY29udGFjdElkO1xyXG4gICAgaWYgKCFjb250YWN0SWQpIHJldHVybjtcclxuXHJcbiAgICB0aGlzLmFwaS5nZXRWaXNpYmxlQ29udGFjdHMoY29udGFjdElkKS5zdWJzY3JpYmUoe1xyXG4gICAgICBuZXh0OiAoY29udGFjdHMpID0+IHtcclxuICAgICAgICB0aGlzLnZpc2libGVDb250YWN0cyQubmV4dChjb250YWN0cyk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgY29uc3QgY3VycmVudENvbnRhY3QgPSB0aGlzLmF1dGguY3VycmVudENvbnRhY3Q7XHJcbiAgICAgICAgaWYgKGN1cnJlbnRDb250YWN0ICYmIGN1cnJlbnRDb250YWN0LmVtYWlsKSB7XHJcbiAgICAgICAgICBjb25zdCBtYXRjaCA9IGNvbnRhY3RzLmZpbmQoYyA9PiBjLmVtYWlsID09PSBjdXJyZW50Q29udGFjdC5lbWFpbCk7XHJcbiAgICAgICAgICBpZiAoXHJcbiAgICAgICAgICAgIG1hdGNoICYmXHJcbiAgICAgICAgICAgIFN0cmluZyhtYXRjaC5jb250YWN0X2lkKSAhPT0gU3RyaW5nKGN1cnJlbnRDb250YWN0LmNvbnRhY3RfaWQpXHJcbiAgICAgICAgICApIHtcclxuICAgICAgICAgICAgdGhpcy5hdXRoLnNldFNlc3Npb24odGhpcy5hdXRoLnNlc3Npb25HaWQhLCB7IC4uLmN1cnJlbnRDb250YWN0LCBjb250YWN0X2lkOiBtYXRjaC5jb250YWN0X2lkIH0pO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgdGhpcy53c1NlcnZpY2UuZGlzY29ubmVjdCgpO1xyXG4gICAgICAgICAgICB0aGlzLndzU2VydmljZS5jb25uZWN0KG1hdGNoLmNvbnRhY3RfaWQsIHRoaXMuYXV0aC5zZXNzaW9uR2lkISk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICB9LFxyXG4gICAgICBlcnJvcjogKCkgPT4ge30sXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8vIOKUgOKUgCBDb252ZXJzYXRpb25zIOKUgOKUgFxyXG4gIG9wZW5Db252ZXJzYXRpb24oY29udmVyc2F0aW9uSWQ6IHN0cmluZywgbmFtZTogc3RyaW5nLCBpc0dyb3VwID0gZmFsc2UpOiB2b2lkIHtcclxuICAgIGlmICghY29udmVyc2F0aW9uSWQgfHwgY29udmVyc2F0aW9uSWQgPT09ICd1bmRlZmluZWQnKSB7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIHRoaXMuYWN0aXZlQ29udmVyc2F0aW9uSWQkLm5leHQoY29udmVyc2F0aW9uSWQpO1xyXG4gICAgdGhpcy5hY3RpdmVWaWV3JC5uZXh0KCdjaGF0Jyk7XHJcbiAgICB0aGlzLm9wZW5QYW5lbCgpO1xyXG5cclxuICAgIGNvbnN0IGNoYXRzID0gdGhpcy5vcGVuQ2hhdHMkLnZhbHVlO1xyXG4gICAgaWYgKCFjaGF0cy5maW5kKChjKSA9PiBjLmNvbnZlcnNhdGlvbklkID09PSBjb252ZXJzYXRpb25JZCkpIHtcclxuICAgICAgdGhpcy5vcGVuQ2hhdHMkLm5leHQoW1xyXG4gICAgICAgIC4uLmNoYXRzLFxyXG4gICAgICAgIHsgY29udmVyc2F0aW9uSWQsIG5hbWUsIGlzR3JvdXAsIGlzTWluaW1pemVkOiBmYWxzZSwgdW5yZWFkQ291bnQ6IDAgfSxcclxuICAgICAgXSk7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgZXhpc3RpbmcgPSB0aGlzLm1lc3NhZ2VzTWFwJC52YWx1ZS5nZXQoY29udmVyc2F0aW9uSWQpO1xyXG4gICAgaWYgKCFleGlzdGluZyB8fCBleGlzdGluZy5sZW5ndGggPT09IDApIHtcclxuICAgICAgdGhpcy5sb2FkTWVzc2FnZXMoY29udmVyc2F0aW9uSWQpO1xyXG4gICAgfVxyXG4gICAgdGhpcy5tYXJrQXNSZWFkKGNvbnZlcnNhdGlvbklkKTtcclxuICAgIHRoaXMud3NTZXJ2aWNlLnN1YnNjcmliZShjb252ZXJzYXRpb25JZCk7XHJcbiAgfVxyXG5cclxuICBjbG9zZUNoYXQoY29udmVyc2F0aW9uSWQ6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgY29uc3QgY2hhdHMgPSB0aGlzLm9wZW5DaGF0cyQudmFsdWUuZmlsdGVyKChjKSA9PiBjLmNvbnZlcnNhdGlvbklkICE9PSBjb252ZXJzYXRpb25JZCk7XHJcbiAgICB0aGlzLm9wZW5DaGF0cyQubmV4dChjaGF0cyk7XHJcblxyXG4gICAgaWYgKFN0cmluZyh0aGlzLmFjdGl2ZUNvbnZlcnNhdGlvbklkJC52YWx1ZSkgPT09IFN0cmluZyhjb252ZXJzYXRpb25JZCkpIHtcclxuICAgICAgdGhpcy5hY3RpdmVDb252ZXJzYXRpb25JZCQubmV4dChudWxsKTtcclxuICAgICAgdGhpcy5hY3RpdmVWaWV3JC5uZXh0KCdpbmJveCcpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgbWFya0dyb3VwUmVtb3ZlZChjb252ZXJzYXRpb25JZDogc3RyaW5nKTogdm9pZCB7XHJcbiAgICBjb25zdCBpZCA9IFN0cmluZyhjb252ZXJzYXRpb25JZCk7XHJcbiAgICBpZiAoIWlkIHx8IGlkID09PSAndW5kZWZpbmVkJykgcmV0dXJuO1xyXG5cclxuICAgIGNvbnN0IG5leHQgPSBuZXcgU2V0KHRoaXMucmVtb3ZlZEdyb3VwSWRzJC52YWx1ZSk7XHJcbiAgICBuZXh0LmFkZChpZCk7XHJcbiAgICB0aGlzLnJlbW92ZWRHcm91cElkcyQubmV4dChuZXh0KTtcclxuXHJcbiAgICBjb25zdCBpdGVtcyA9IHRoaXMuaW5ib3gkLnZhbHVlLmZpbHRlcihpID0+IFN0cmluZyhpLmNvbnZlcnNhdGlvbl9pZCkgIT09IGlkKTtcclxuICAgIHRoaXMuaW5ib3gkLm5leHQoaXRlbXMpO1xyXG4gICAgdGhpcy5yZWNhbGNVbnJlYWQoaXRlbXMpO1xyXG5cclxuICAgIGlmICghdGhpcy5yZW1vdmFsVG9hc3RTaG93bi5oYXMoaWQpKSB7XHJcbiAgICAgIHRoaXMucmVtb3ZhbFRvYXN0U2hvd24uYWRkKGlkKTtcclxuICAgICAgdGhpcy5zaG93VG9hc3QoJ1lvdSB3ZXJlIHJlbW92ZWQgZnJvbSB0aGlzIGdyb3VwJywgJ2luZm8nLCA1MDAwKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIGV4aXRSZW1vdmVkR3JvdXAoY29udmVyc2F0aW9uSWQ6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgY29uc3QgaWQgPSBTdHJpbmcoY29udmVyc2F0aW9uSWQpO1xyXG4gICAgY29uc3QgbmV4dCA9IG5ldyBTZXQodGhpcy5yZW1vdmVkR3JvdXBJZHMkLnZhbHVlKTtcclxuICAgIG5leHQuZGVsZXRlKGlkKTtcclxuICAgIHRoaXMucmVtb3ZlZEdyb3VwSWRzJC5uZXh0KG5leHQpO1xyXG4gICAgdGhpcy5yZW1vdmFsVG9hc3RTaG93bi5kZWxldGUoaWQpO1xyXG4gICAgdGhpcy5yZW1vdmVDb252ZXJzYXRpb25Gcm9tVWkoaWQpO1xyXG4gIH1cclxuXHJcbiAgLy8g4pSA4pSAIE1lc3NhZ2VzIOKUgOKUgFxyXG4gIGxvYWRNZXNzYWdlcyhjb252ZXJzYXRpb25JZDogc3RyaW5nLCBiZWZvcmVNZXNzYWdlSWQ/OiBzdHJpbmcsIHNraXBSZWFjdGlvbkh5ZHJhdGlvbiA9IGZhbHNlKTogdm9pZCB7XHJcbiAgICBpZiAoIWNvbnZlcnNhdGlvbklkIHx8IGNvbnZlcnNhdGlvbklkID09PSAndW5kZWZpbmVkJykge1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICBjb25zdCBjb250YWN0SWQgPSB0aGlzLmF1dGguY29udGFjdElkO1xyXG4gICAgaWYgKCFjb250YWN0SWQpIHJldHVybjtcclxuXHJcbiAgICB0aGlzLmxvYWRpbmdNZXNzYWdlcyQubmV4dCh0cnVlKTtcclxuXHJcbiAgICB0aGlzLmFwaS5nZXRNZXNzYWdlcyhjb252ZXJzYXRpb25JZCwgY29udGFjdElkLCBiZWZvcmVNZXNzYWdlSWQsIDUwKS5zdWJzY3JpYmUoe1xyXG4gICAgICBuZXh0OiAobWVzc2FnZXMpID0+IHtcclxuICAgICAgICBjb25zdCBtYXAgPSBuZXcgTWFwKHRoaXMubWVzc2FnZXNNYXAkLnZhbHVlKTtcclxuICAgICAgICBjb25zdCBleGlzdGluZyA9IG1hcC5nZXQoY29udmVyc2F0aW9uSWQpIHx8IFtdO1xyXG5cclxuICAgICAgICBjb25zdCBub3JtYWxpemVkID0gbWVzc2FnZXMubWFwKChtOiBhbnkpID0+IHRoaXMubm9ybWFsaXplTWVzc2FnZVNoYXBlKG0pKTtcclxuICAgICAgICBjb25zdCBzb3J0ZWQgPSBbLi4ubm9ybWFsaXplZF0uc29ydCgoYSwgYikgPT4gXHJcbiAgICAgICAgICBuZXcgRGF0ZShhLmNyZWF0ZWRfYXQpLmdldFRpbWUoKSAtIG5ldyBEYXRlKGIuY3JlYXRlZF9hdCkuZ2V0VGltZSgpXHJcbiAgICAgICAgKTtcclxuICAgICAgICBzb3J0ZWQuZm9yRWFjaCgobSkgPT4gdGhpcy5kZXRlY3RHcm91cFJlbW92YWxGb3JDdXJyZW50VXNlcihtKSk7XHJcblxyXG4gICAgICAgIGNvbnN0IGV4aXN0aW5nQnlJZCA9IG5ldyBNYXAoZXhpc3RpbmcubWFwKG0gPT4gW1N0cmluZyhtLm1lc3NhZ2VfaWQpLCBtXSkpO1xyXG5cclxuICAgICAgICBpZiAoYmVmb3JlTWVzc2FnZUlkKSB7XHJcbiAgICAgICAgICAvLyBQcmVwZW5kIG9sZGVyIG1lc3NhZ2VzLCBwcmVzZXJ2aW5nIGV4aXN0aW5nIHJlYWN0aW9uc1xyXG4gICAgICAgICAgY29uc3QgbWVyZ2VkID0gWy4uLnNvcnRlZCwgLi4uZXhpc3RpbmddO1xyXG4gICAgICAgICAgbWFwLnNldChjb252ZXJzYXRpb25JZCwgbWVyZ2VkKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgLy8gUmVwbGFjZSB3aXRoIHNlcnZlciBkYXRhIGJ1dCBrZWVwIHRoZSByaWNoZXIgb2YgZXhpc3RpbmcgdnMgc2VydmVyIGF0dGFjaG1lbnRzXHJcbiAgICAgICAgICAvLyAodGhlIG9wdGltaXN0aWMgcGF0aCBtYXkgaGF2ZSBtb3JlIGF0dGFjaG1lbnQgbWV0YWRhdGEgdGhhbiB0aGUgc2VydmVyIGVjaG9lcyBiYWNrKS5cclxuICAgICAgICAgIGNvbnN0IG1lcmdlZCA9IHNvcnRlZC5tYXAobSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnN0IGNhY2hlZCA9IGV4aXN0aW5nQnlJZC5nZXQoU3RyaW5nKG0ubWVzc2FnZV9pZCkpO1xyXG4gICAgICAgICAgICBpZiAoIWNhY2hlZCkgcmV0dXJuIG07XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLm1lcmdlTWVzc2FnZUF0dGFjaG1lbnRzKGNhY2hlZCwgbSk7XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICAgIG1hcC5zZXQoY29udmVyc2F0aW9uSWQsIG1lcmdlZCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aGlzLm1lc3NhZ2VzTWFwJC5uZXh0KG1hcCk7XHJcbiAgICAgICAgdGhpcy5oeWRyYXRlUmVhY3Rpb25zRm9yQ29udmVyc2F0aW9uKFxyXG4gICAgICAgICAgY29udmVyc2F0aW9uSWQsXHJcbiAgICAgICAgICBtYXAuZ2V0KGNvbnZlcnNhdGlvbklkKSB8fCBbXSxcclxuICAgICAgICAgIHNraXBSZWFjdGlvbkh5ZHJhdGlvblxyXG4gICAgICAgICk7XHJcbiAgICAgICAgdGhpcy5sb2FkaW5nTWVzc2FnZXMkLm5leHQoZmFsc2UpO1xyXG4gICAgICB9LFxyXG4gICAgICBlcnJvcjogKCkgPT4ge1xyXG4gICAgICAgIHRoaXMubG9hZGluZ01lc3NhZ2VzJC5uZXh0KGZhbHNlKTtcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgc2VuZE1lc3NhZ2UoY29udmVyc2F0aW9uSWQ6IHN0cmluZyB8IG51bGwsIGNvbnRlbnQ6IHN0cmluZywgbWVzc2FnZVR5cGU6ICdURVhUJyB8ICdJTUFHRScgfCAnU1lTVEVNJyA9ICdURVhUJyk6IHZvaWQge1xyXG4gICAgY29uc3QgY29udGFjdElkID0gdGhpcy5hdXRoLmNvbnRhY3RJZDtcclxuICAgIGlmICghY29udGFjdElkKSByZXR1cm47XHJcblxyXG4gICAgY29uc3QgcGVuZGluZyA9IHRoaXMucGVuZGluZ0RtUmVjaXBpZW50JC52YWx1ZTtcclxuICAgIGlmICghY29udmVyc2F0aW9uSWQgJiYgcGVuZGluZykge1xyXG4gICAgICB0aGlzLnNlbmREaXJlY3RNZXNzYWdlKHBlbmRpbmcuY29udGFjdElkLCBjb250ZW50KTtcclxuICAgICAgdGhpcy5wZW5kaW5nRG1SZWNpcGllbnQkLm5leHQobnVsbCk7XHJcbiAgICAgIGNvbnN0IGNoYXRzID0gdGhpcy5vcGVuQ2hhdHMkLnZhbHVlLmZpbHRlcihjID0+IGMuY29udmVyc2F0aW9uSWQgIT09ICdwZW5kaW5nJyk7XHJcbiAgICAgIHRoaXMub3BlbkNoYXRzJC5uZXh0KGNoYXRzKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICghY29udmVyc2F0aW9uSWQpIHJldHVybjtcclxuXHJcbiAgICBjb25zdCB0ZW1wTWVzc2FnZUlkID0gJ3RlbXAtJyArIERhdGUubm93KCk7XHJcbiAgICBjb25zdCBvcHRpbWlzdGljOiBNZXNzYWdlID0ge1xyXG4gICAgICBtZXNzYWdlX2lkOiB0ZW1wTWVzc2FnZUlkLFxyXG4gICAgICBjb252ZXJzYXRpb25faWQ6IGNvbnZlcnNhdGlvbklkLFxyXG4gICAgICBzZW5kZXJfaWQ6IGNvbnRhY3RJZCxcclxuICAgICAgc2VuZGVyX25hbWU6ICdZb3UnLFxyXG4gICAgICBtZXNzYWdlX3R5cGU6IG1lc3NhZ2VUeXBlLFxyXG4gICAgICBjb250ZW50LFxyXG4gICAgICBjcmVhdGVkX2F0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXHJcbiAgICAgIGlzX3JlYWQ6IGZhbHNlLFxyXG4gICAgfTtcclxuICAgIHRoaXMuYXBwZW5kTWVzc2FnZShvcHRpbWlzdGljKTtcclxuXHJcbiAgICB0aGlzLmFwaS5zZW5kTWVzc2FnZShjb252ZXJzYXRpb25JZCwgY29udGFjdElkLCBjb250ZW50LCBtZXNzYWdlVHlwZSkuc3Vic2NyaWJlKHtcclxuICAgICAgbmV4dDogKHJlcykgPT4ge1xyXG4gICAgICAgIGNvbnN0IHJlYWxJZCA9IHJlcz8ubWVzc2FnZV9pZCA/PyByZXM/LmlkID8/IHJlcz8ubWVzc2FnZUlkO1xyXG4gICAgICAgIGlmIChyZWFsSWQgPT0gbnVsbCB8fCBTdHJpbmcocmVhbElkKS5zdGFydHNXaXRoKCd0ZW1wLScpKSB7XHJcbiAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGNvbnN0IHBpY2tlZENvbnRlbnQgPSB0aGlzLmNvYWxlc2NlTWVzc2FnZVRleHQocmVzLCBvcHRpbWlzdGljLmNvbnRlbnQpO1xyXG4gICAgICAgIGNvbnN0IG1lcmdlZCA9IHRoaXMubm9ybWFsaXplTWVzc2FnZVNoYXBlKHtcclxuICAgICAgICAgIC4uLm9wdGltaXN0aWMsXHJcbiAgICAgICAgICAuLi5yZXMsXHJcbiAgICAgICAgICBtZXNzYWdlX2lkOiBTdHJpbmcocmVhbElkKSxcclxuICAgICAgICAgIGNvbnZlcnNhdGlvbl9pZDogY29udmVyc2F0aW9uSWQsXHJcbiAgICAgICAgICBtZXNzYWdlX3R5cGU6IG1lc3NhZ2VUeXBlID09PSAnU1lTVEVNJyA/ICdTWVNURU0nIDogcmVzPy5tZXNzYWdlX3R5cGUgPz8gb3B0aW1pc3RpYy5tZXNzYWdlX3R5cGUsXHJcbiAgICAgICAgICBjb250ZW50OiBwaWNrZWRDb250ZW50LFxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIGNvbnN0IG1hcCA9IG5ldyBNYXAodGhpcy5tZXNzYWdlc01hcCQudmFsdWUpO1xyXG4gICAgICAgIGNvbnN0IG1zZ3MgPSBbLi4uKG1hcC5nZXQoY29udmVyc2F0aW9uSWQpIHx8IFtdKV07XHJcbiAgICAgICAgY29uc3QgaWR4ID0gbXNncy5maW5kSW5kZXgoKG0pID0+IG0ubWVzc2FnZV9pZCA9PT0gdGVtcE1lc3NhZ2VJZCk7XHJcbiAgICAgICAgaWYgKGlkeCA+PSAwKSB7XHJcbiAgICAgICAgICBtc2dzW2lkeF0gPSBtZXJnZWQ7XHJcbiAgICAgICAgICBtYXAuc2V0KGNvbnZlcnNhdGlvbklkLCB0aGlzLmRlZHVwZU1lc3NhZ2VzQnlJZEtlZXBGaXJzdChtc2dzKSk7XHJcbiAgICAgICAgICB0aGlzLm1lc3NhZ2VzTWFwJC5uZXh0KG1hcCk7XHJcbiAgICAgICAgICB0aGlzLnJlZnJlc2hNZXNzYWdlUmVhY3Rpb25zKG1lcmdlZC5tZXNzYWdlX2lkKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0sXHJcbiAgICAgIGVycm9yOiAoKSA9PiB7fSxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgb3BlbkRpcmVjdENvbnZlcnNhdGlvbihyZWNpcGllbnRDb250YWN0SWQ6IHN0cmluZywgZGlzcGxheU5hbWU6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgY29uc3QgZXhpc3RpbmcgPSB0aGlzLmluYm94JC52YWx1ZS5maW5kKGl0ZW0gPT4gXHJcbiAgICAgICFpdGVtLmlzX2dyb3VwICYmIGl0ZW0ubmFtZSA9PT0gZGlzcGxheU5hbWVcclxuICAgICk7XHJcbiAgICBcclxuICAgIGlmIChleGlzdGluZykge1xyXG4gICAgICB0aGlzLnBlbmRpbmdEbVJlY2lwaWVudCQubmV4dChudWxsKTtcclxuICAgICAgdGhpcy5vcGVuQ29udmVyc2F0aW9uKGV4aXN0aW5nLmNvbnZlcnNhdGlvbl9pZCwgZGlzcGxheU5hbWUsIGZhbHNlKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHRoaXMucGVuZGluZ0RtUmVjaXBpZW50JC5uZXh0KHtjb250YWN0SWQ6IHJlY2lwaWVudENvbnRhY3RJZCwgbmFtZTogZGlzcGxheU5hbWV9KTtcclxuICAgICAgdGhpcy5hY3RpdmVDb252ZXJzYXRpb25JZCQubmV4dChudWxsKTtcclxuICAgICAgdGhpcy5hY3RpdmVWaWV3JC5uZXh0KCdjaGF0Jyk7XHJcbiAgICAgIHRoaXMub3BlblBhbmVsKCk7XHJcbiAgICAgIFxyXG4gICAgICBjb25zdCBjaGF0cyA9IHRoaXMub3BlbkNoYXRzJC52YWx1ZTtcclxuICAgICAgaWYgKCFjaGF0cy5maW5kKGMgPT4gYy5jb252ZXJzYXRpb25JZCA9PT0gJ3BlbmRpbmcnKSkge1xyXG4gICAgICAgIHRoaXMub3BlbkNoYXRzJC5uZXh0KFsuLi5jaGF0cywge1xyXG4gICAgICAgICAgY29udmVyc2F0aW9uSWQ6ICdwZW5kaW5nJyxcclxuICAgICAgICAgIG5hbWU6IGRpc3BsYXlOYW1lLFxyXG4gICAgICAgICAgaXNHcm91cDogZmFsc2UsXHJcbiAgICAgICAgICBpc01pbmltaXplZDogZmFsc2UsXHJcbiAgICAgICAgICB1bnJlYWRDb3VudDogMFxyXG4gICAgICAgIH1dKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgc2VuZERpcmVjdE1lc3NhZ2UocmVjaXBpZW50Q29udGFjdElkOiBzdHJpbmcsIGNvbnRlbnQ6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgY29uc3QgY29udGFjdElkID0gdGhpcy5hdXRoLmNvbnRhY3RJZDtcclxuICAgIGlmICghY29udGFjdElkKSByZXR1cm47XHJcblxyXG4gICAgdGhpcy5hcGkuc2VuZERpcmVjdE1lc3NhZ2UoY29udGFjdElkLCByZWNpcGllbnRDb250YWN0SWQsIGNvbnRlbnQpLnN1YnNjcmliZSh7XHJcbiAgICAgIG5leHQ6IChyZXMpID0+IHtcclxuICAgICAgICB0aGlzLmxvYWRJbmJveCgpO1xyXG4gICAgICAgIC8vIEJhY2tlbmQgbWF5IHJldHVybiBjb252ZXJzYXRpb25faWQsIGlkLCBvciBjb252ZXJzYXRpb25JZFxyXG4gICAgICAgIGNvbnN0IGNvbnZJZCA9IFN0cmluZyhyZXM/LmNvbnZlcnNhdGlvbl9pZCB8fCByZXM/LmlkIHx8IHJlcz8uY29udmVyc2F0aW9uSWQgfHwgJycpO1xyXG4gICAgICAgIGlmIChjb252SWQpIHtcclxuICAgICAgICAgIGNvbnN0IHJlY2lwaWVudCA9IHRoaXMudmlzaWJsZUNvbnRhY3RzJC52YWx1ZS5maW5kKFxyXG4gICAgICAgICAgICAoYykgPT4gYy5jb250YWN0X2lkID09PSByZWNpcGllbnRDb250YWN0SWRcclxuICAgICAgICAgICk7XHJcbiAgICAgICAgICBjb25zdCBuYW1lID0gcmVjaXBpZW50ID8gZ2V0Q29udGFjdERpc3BsYXlOYW1lKHJlY2lwaWVudCkgOiAnRGlyZWN0IE1lc3NhZ2UnO1xyXG4gICAgICAgICAgdGhpcy5vcGVuQ29udmVyc2F0aW9uKGNvbnZJZCwgbmFtZSwgZmFsc2UpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSxcclxuICAgICAgZXJyb3I6ICgpID0+IHt9LFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBjcmVhdGVHcm91cENvbnZlcnNhdGlvbihcclxuICAgIHBhcnRpY2lwYW50SWRzOiBzdHJpbmdbXSxcclxuICAgIG5hbWU6IHN0cmluZyxcclxuICAgIGNhbGxiYWNrcz86IHsgc3VjY2Vzcz86ICgpID0+IHZvaWQ7IGVycm9yPzogKCkgPT4gdm9pZCB9XHJcbiAgKTogdm9pZCB7XHJcbiAgICBjb25zdCBjb250YWN0SWQgPSB0aGlzLmF1dGguY29udGFjdElkO1xyXG4gICAgaWYgKCFjb250YWN0SWQpIHtcclxuICAgICAgY2FsbGJhY2tzPy5lcnJvcj8uKCk7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBhbGxQYXJ0aWNpcGFudHMgPSBwYXJ0aWNpcGFudElkcy5pbmNsdWRlcyhjb250YWN0SWQpXHJcbiAgICAgID8gcGFydGljaXBhbnRJZHNcclxuICAgICAgOiBbY29udGFjdElkLCAuLi5wYXJ0aWNpcGFudElkc107XHJcblxyXG4gICAgdGhpcy5hcGkuY3JlYXRlQ29udmVyc2F0aW9uKGNvbnRhY3RJZCwgYWxsUGFydGljaXBhbnRzLCBuYW1lKS5zdWJzY3JpYmUoe1xyXG4gICAgICBuZXh0OiAoY29udikgPT4ge1xyXG4gICAgICAgIC8vIEJhY2tlbmQgbWF5IHJldHVybiBjb252ZXJzYXRpb25faWQsIGlkLCBvciBjb252ZXJzYXRpb25JZFxyXG4gICAgICAgIGNvbnN0IGNvbnZJZCA9IFN0cmluZyhcclxuICAgICAgICAgIHR5cGVvZiBjb252ID09PSAnc3RyaW5nJyB8fCB0eXBlb2YgY29udiA9PT0gJ251bWJlcidcclxuICAgICAgICAgICAgPyBjb252XHJcbiAgICAgICAgICAgIDogKGNvbnYgYXMgYW55KT8uY29udmVyc2F0aW9uX2lkIHx8IChjb252IGFzIGFueSk/LmlkIHx8IChjb252IGFzIGFueSk/LmNvbnZlcnNhdGlvbklkIHx8ICcnXHJcbiAgICAgICAgKTtcclxuICAgICAgICBpZiAoIWNvbnZJZCkge1xyXG4gICAgICAgICAgdGhpcy5sb2FkSW5ib3goKTtcclxuICAgICAgICAgIGNhbGxiYWNrcz8uZXJyb3I/LigpO1xyXG4gICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLmxvYWRJbmJveCgpO1xyXG4gICAgICAgIHRoaXMuY2xlYXJHcm91cFNldHRpbmdzKCk7XHJcbiAgICAgICAgdGhpcy5vcGVuQ29udmVyc2F0aW9uKGNvbnZJZCwgbmFtZSwgdHJ1ZSk7XHJcbiAgICAgICAgY2FsbGJhY2tzPy5zdWNjZXNzPy4oKTtcclxuICAgICAgfSxcclxuICAgICAgZXJyb3I6ICgpID0+IHtcclxuICAgICAgICBjYWxsYmFja3M/LmVycm9yPy4oKTtcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgb3Blbkdyb3VwU2V0dGluZ3MoY29udmVyc2F0aW9uSWQ6IHN0cmluZywgbmFtZTogc3RyaW5nKTogdm9pZCB7XHJcbiAgICB0aGlzLmdyb3VwU2V0dGluZ3MkLm5leHQoeyBjb252ZXJzYXRpb25JZCwgbmFtZSB9KTtcclxuICAgIHRoaXMuc2V0VmlldygnZ3JvdXAtbWFuYWdlcicpO1xyXG4gIH1cclxuXHJcbiAgY2xlYXJHcm91cFNldHRpbmdzKCk6IHZvaWQge1xyXG4gICAgdGhpcy5ncm91cFNldHRpbmdzJC5uZXh0KG51bGwpO1xyXG4gIH1cclxuXHJcbiAgbWFya0FzUmVhZChjb252ZXJzYXRpb25JZDogc3RyaW5nKTogdm9pZCB7XHJcbiAgICBpZiAoIWNvbnZlcnNhdGlvbklkIHx8IGNvbnZlcnNhdGlvbklkID09PSAndW5kZWZpbmVkJykgcmV0dXJuO1xyXG4gICAgY29uc3QgY29udGFjdElkID0gdGhpcy5hdXRoLmNvbnRhY3RJZDtcclxuICAgIGlmICghY29udGFjdElkKSByZXR1cm47XHJcblxyXG4gICAgdGhpcy5hcGkubWFya0NvbnZlcnNhdGlvblJlYWQoY29udmVyc2F0aW9uSWQsIGNvbnRhY3RJZCkuc3Vic2NyaWJlKHtcclxuICAgICAgbmV4dDogKCkgPT4ge1xyXG4gICAgICAgIGNvbnN0IGl0ZW1zID0gdGhpcy5pbmJveCQudmFsdWUubWFwKChpdGVtKSA9PlxyXG4gICAgICAgICAgaXRlbS5jb252ZXJzYXRpb25faWQgPT09IGNvbnZlcnNhdGlvbklkID8geyAuLi5pdGVtLCB1bnJlYWRfY291bnQ6IDAgfSA6IGl0ZW1cclxuICAgICAgICApO1xyXG4gICAgICAgIHRoaXMuaW5ib3gkLm5leHQoaXRlbXMpO1xyXG4gICAgICAgIHRoaXMucmVjYWxjVW5yZWFkKGl0ZW1zKTtcclxuICAgICAgfSxcclxuICAgICAgZXJyb3I6ICgpID0+IHt9LFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvLyDilIDilIAgR3JvdXAgbWFuYWdlbWVudCDilIDilIBcclxuICBtYW5hZ2VHcm91cChcclxuICAgIGFjdGlvbjogJ2NyZWF0ZScgfCAnYWRkJyB8ICdyZW1vdmUnIHwgJ3JlbmFtZScsXHJcbiAgICBjb252ZXJzYXRpb25JZD86IHN0cmluZyxcclxuICAgIGdyb3VwTmFtZT86IHN0cmluZyxcclxuICAgIHBhcnRpY2lwYW50Q29udGFjdElkcz86IHN0cmluZ1tdLFxyXG4gICAgY2FsbGJhY2tzPzogeyBzdWNjZXNzPzogKCkgPT4gdm9pZDsgZXJyb3I/OiAoKSA9PiB2b2lkIH1cclxuICApOiB2b2lkIHtcclxuICAgIGNvbnN0IGNvbnRhY3RJZCA9IHRoaXMuYXV0aC5jb250YWN0SWQ7XHJcbiAgICBpZiAoIWNvbnRhY3RJZCkge1xyXG4gICAgICBjYWxsYmFja3M/LmVycm9yPy4oKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIGlmIChhY3Rpb24gPT09ICdyZW1vdmUnICYmIGNvbnZlcnNhdGlvbklkICYmIHBhcnRpY2lwYW50Q29udGFjdElkcz8ubGVuZ3RoKSB7XHJcbiAgICAgIGNvbnN0IGFjdG9yTmFtZSA9IHRoaXMuZ2V0Q29udGFjdE5hbWVCeUlkKGNvbnRhY3RJZCk7XHJcbiAgICAgIGNvbnN0IG5vdGljZUpvYnMgPSBwYXJ0aWNpcGFudENvbnRhY3RJZHMubWFwKChpZCkgPT5cclxuICAgICAgICB0aGlzLmFwaS5zZW5kTWVzc2FnZShcclxuICAgICAgICAgIGNvbnZlcnNhdGlvbklkLFxyXG4gICAgICAgICAgY29udGFjdElkLFxyXG4gICAgICAgICAgYCR7YWN0b3JOYW1lfSByZW1vdmVkICR7dGhpcy5nZXRDb250YWN0TmFtZUJ5SWQoaWQpfSBmcm9tIHRoZSBncm91cGAsXHJcbiAgICAgICAgICAnU1lTVEVNJ1xyXG4gICAgICAgICkucGlwZShjYXRjaEVycm9yKCgpID0+IG9mKG51bGwpKSlcclxuICAgICAgKTtcclxuICAgICAgY29uc3QgcmVtb3ZlSm9icyA9IHBhcnRpY2lwYW50Q29udGFjdElkcy5tYXAoKGlkKSA9PlxyXG4gICAgICAgIHRoaXMuYXBpLm1hbmFnZUdyb3VwKGlkLCBhY3Rpb24sIGNvbnZlcnNhdGlvbklkLCBncm91cE5hbWUpXHJcbiAgICAgICk7XHJcblxyXG4gICAgICBmb3JrSm9pbihub3RpY2VKb2JzKS5zdWJzY3JpYmUoe1xyXG4gICAgICAgIG5leHQ6ICgpID0+IHtcclxuICAgICAgICAgIGZvcmtKb2luKHJlbW92ZUpvYnMpLnN1YnNjcmliZSh7XHJcbiAgICAgICAgICAgIG5leHQ6ICgpID0+IHtcclxuICAgICAgICAgICAgICB0aGlzLmxvYWRJbmJveCgpO1xyXG4gICAgICAgICAgICAgIGNhbGxiYWNrcz8uc3VjY2Vzcz8uKCk7XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIGVycm9yOiAoKSA9PiB7XHJcbiAgICAgICAgICAgICAgY2FsbGJhY2tzPy5lcnJvcj8uKCk7XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGVycm9yOiAoKSA9PiB7XHJcbiAgICAgICAgICBjYWxsYmFja3M/LmVycm9yPy4oKTtcclxuICAgICAgICB9LFxyXG4gICAgICB9KTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuYXBpLm1hbmFnZUdyb3VwKGNvbnRhY3RJZCwgYWN0aW9uLCBjb252ZXJzYXRpb25JZCwgZ3JvdXBOYW1lLCBwYXJ0aWNpcGFudENvbnRhY3RJZHMpLnN1YnNjcmliZSh7XHJcbiAgICAgIG5leHQ6ICgpID0+IHtcclxuICAgICAgICB0aGlzLmxvYWRJbmJveCgpO1xyXG4gICAgICAgIGlmIChhY3Rpb24gPT09ICdhZGQnICYmIGNvbnZlcnNhdGlvbklkICYmIHBhcnRpY2lwYW50Q29udGFjdElkcz8ubGVuZ3RoKSB7XHJcbiAgICAgICAgICBjb25zdCBhZGRlZE5hbWVzID0gcGFydGljaXBhbnRDb250YWN0SWRzLm1hcCgoaWQpID0+IHRoaXMuZ2V0Q29udGFjdE5hbWVCeUlkKGlkKSk7XHJcbiAgICAgICAgICBjb25zdCB0ZXh0ID0gYCR7dGhpcy5nZXRDb250YWN0TmFtZUJ5SWQoY29udGFjdElkKX0gYWRkZWQgJHthZGRlZE5hbWVzLmpvaW4oJywgJyl9IHRvIHRoZSBncm91cGA7XHJcbiAgICAgICAgICB0aGlzLnNlbmRNZXNzYWdlKGNvbnZlcnNhdGlvbklkLCB0ZXh0LCAnU1lTVEVNJyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGNhbGxiYWNrcz8uc3VjY2Vzcz8uKCk7XHJcbiAgICAgIH0sXHJcbiAgICAgIGVycm9yOiAoKSA9PiB7XHJcbiAgICAgICAgY2FsbGJhY2tzPy5lcnJvcj8uKCk7XHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8vIOKUgOKUgCBEZWxldGUgLyBDbGVhciDilIDilIBcclxuICBkZWxldGVDb252ZXJzYXRpb24oY29udmVyc2F0aW9uSWQ6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgY29uc3QgY29udGFjdElkID0gdGhpcy5hdXRoLmNvbnRhY3RJZDtcclxuICAgIGlmICghY29udGFjdElkKSByZXR1cm47XHJcblxyXG4gICAgdGhpcy5hcGkuZGVsZXRlQ29udmVyc2F0aW9uKGNvbnZlcnNhdGlvbklkLCBjb250YWN0SWQpLnN1YnNjcmliZSh7XHJcbiAgICAgIG5leHQ6ICgpID0+IHtcclxuICAgICAgICBjb25zdCBpdGVtcyA9IHRoaXMuaW5ib3gkLnZhbHVlLmZpbHRlcihpID0+IGkuY29udmVyc2F0aW9uX2lkICE9PSBjb252ZXJzYXRpb25JZCk7XHJcbiAgICAgICAgdGhpcy5pbmJveCQubmV4dChpdGVtcyk7XHJcbiAgICAgICAgdGhpcy5yZWNhbGNVbnJlYWQoaXRlbXMpO1xyXG4gICAgICAgIGNvbnN0IG1hcCA9IG5ldyBNYXAodGhpcy5tZXNzYWdlc01hcCQudmFsdWUpO1xyXG4gICAgICAgIG1hcC5kZWxldGUoY29udmVyc2F0aW9uSWQpO1xyXG4gICAgICAgIHRoaXMubWVzc2FnZXNNYXAkLm5leHQobWFwKTtcclxuICAgICAgICBpZiAodGhpcy5hY3RpdmVDb252ZXJzYXRpb25JZCQudmFsdWUgPT09IGNvbnZlcnNhdGlvbklkKSB7XHJcbiAgICAgICAgICB0aGlzLmFjdGl2ZUNvbnZlcnNhdGlvbklkJC5uZXh0KG51bGwpO1xyXG4gICAgICAgICAgdGhpcy5hY3RpdmVWaWV3JC5uZXh0KCdpbmJveCcpO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLmNsb3NlQ2hhdChjb252ZXJzYXRpb25JZCk7XHJcbiAgICAgIH0sXHJcbiAgICAgIGVycm9yOiAoKSA9PiB7fSxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgY2xlYXJDb252ZXJzYXRpb24oY29udmVyc2F0aW9uSWQ6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgY29uc3QgY29udGFjdElkID0gdGhpcy5hdXRoLmNvbnRhY3RJZDtcclxuICAgIGlmICghY29udGFjdElkKSByZXR1cm47XHJcblxyXG4gICAgdGhpcy5hcGkuY2xlYXJDb252ZXJzYXRpb24oY29udmVyc2F0aW9uSWQsIGNvbnRhY3RJZCkuc3Vic2NyaWJlKHtcclxuICAgICAgbmV4dDogKCkgPT4ge1xyXG4gICAgICAgIGNvbnN0IG1hcCA9IG5ldyBNYXAodGhpcy5tZXNzYWdlc01hcCQudmFsdWUpO1xyXG4gICAgICAgIG1hcC5zZXQoY29udmVyc2F0aW9uSWQsIFtdKTtcclxuICAgICAgICB0aGlzLm1lc3NhZ2VzTWFwJC5uZXh0KG1hcCk7XHJcbiAgICAgICAgY29uc3QgaXRlbXMgPSB0aGlzLmluYm94JC52YWx1ZS5tYXAoaSA9PlxyXG4gICAgICAgICAgaS5jb252ZXJzYXRpb25faWQgPT09IGNvbnZlcnNhdGlvbklkXHJcbiAgICAgICAgICAgID8geyAuLi5pLCBsYXN0X21lc3NhZ2VfcHJldmlldzogJycsIGxhc3RfbWVzc2FnZV9hdDogaS5sYXN0X21lc3NhZ2VfYXQgfVxyXG4gICAgICAgICAgICA6IGlcclxuICAgICAgICApO1xyXG4gICAgICAgIHRoaXMuaW5ib3gkLm5leHQoaXRlbXMpO1xyXG4gICAgICB9LFxyXG4gICAgICBlcnJvcjogKCkgPT4ge30sXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIGRlbGV0ZUdyb3VwKGNvbnZlcnNhdGlvbklkOiBzdHJpbmcsIGNhbGxiYWNrcz86IHsgc3VjY2Vzcz86ICgpID0+IHZvaWQ7IGVycm9yPzogKCkgPT4gdm9pZCB9KTogdm9pZCB7XHJcbiAgICBjb25zdCBjb250YWN0SWQgPSB0aGlzLmF1dGguY29udGFjdElkO1xyXG4gICAgaWYgKCFjb250YWN0SWQgfHwgdGhpcy5kZWxldGluZ0NvbnZlcnNhdGlvbklkcy5oYXMoY29udmVyc2F0aW9uSWQpKSB7XHJcbiAgICAgIGNhbGxiYWNrcz8uZXJyb3I/LigpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgcHJldmlvdXNJbmJveCA9IHRoaXMuaW5ib3gkLnZhbHVlO1xyXG4gICAgY29uc3QgcHJldmlvdXNNZXNzYWdlc01hcCA9IG5ldyBNYXAodGhpcy5tZXNzYWdlc01hcCQudmFsdWUpO1xyXG4gICAgY29uc3QgcHJldmlvdXNPcGVuQ2hhdHMgPSB0aGlzLm9wZW5DaGF0cyQudmFsdWU7XHJcbiAgICBjb25zdCBwcmV2aW91c0FjdGl2ZUNvbnZlcnNhdGlvbklkID0gdGhpcy5hY3RpdmVDb252ZXJzYXRpb25JZCQudmFsdWU7XHJcbiAgICBjb25zdCBwcmV2aW91c0FjdGl2ZVZpZXcgPSB0aGlzLmFjdGl2ZVZpZXckLnZhbHVlO1xyXG4gICAgY29uc3QgcHJldmlvdXNHcm91cFNldHRpbmdzID0gdGhpcy5ncm91cFNldHRpbmdzJC52YWx1ZTtcclxuXHJcbiAgICB0aGlzLmRlbGV0aW5nQ29udmVyc2F0aW9uSWRzLmFkZChjb252ZXJzYXRpb25JZCk7XHJcbiAgICB0aGlzLnNob3dUb2FzdCgnRXhpdGluZyBncm91cC4uLicsICdpbmZvJywgMTUwMCk7XHJcbiAgICB0aGlzLnJlbW92ZUNvbnZlcnNhdGlvbkZyb21VaShjb252ZXJzYXRpb25JZCk7XHJcblxyXG4gICAgdGhpcy5hcGkuZGVsZXRlR3JvdXAoY29udmVyc2F0aW9uSWQsIGNvbnRhY3RJZCkuc3Vic2NyaWJlKHtcclxuICAgICAgbmV4dDogKCkgPT4ge1xyXG4gICAgICAgIHRoaXMuZGVsZXRpbmdDb252ZXJzYXRpb25JZHMuZGVsZXRlKGNvbnZlcnNhdGlvbklkKTtcclxuICAgICAgICB0aGlzLnNob3dUb2FzdCgnRXhpdGVkIGdyb3VwJywgJ3N1Y2Nlc3MnKTtcclxuICAgICAgICBjYWxsYmFja3M/LnN1Y2Nlc3M/LigpO1xyXG4gICAgICB9LFxyXG4gICAgICBlcnJvcjogKCkgPT4ge1xyXG4gICAgICAgIHRoaXMuZGVsZXRpbmdDb252ZXJzYXRpb25JZHMuZGVsZXRlKGNvbnZlcnNhdGlvbklkKTtcclxuICAgICAgICB0aGlzLmluYm94JC5uZXh0KHByZXZpb3VzSW5ib3gpO1xyXG4gICAgICAgIHRoaXMucmVjYWxjVW5yZWFkKHByZXZpb3VzSW5ib3gpO1xyXG4gICAgICAgIHRoaXMubWVzc2FnZXNNYXAkLm5leHQocHJldmlvdXNNZXNzYWdlc01hcCk7XHJcbiAgICAgICAgdGhpcy5vcGVuQ2hhdHMkLm5leHQocHJldmlvdXNPcGVuQ2hhdHMpO1xyXG4gICAgICAgIHRoaXMuZ3JvdXBTZXR0aW5ncyQubmV4dChwcmV2aW91c0dyb3VwU2V0dGluZ3MpO1xyXG4gICAgICAgIHRoaXMuYWN0aXZlQ29udmVyc2F0aW9uSWQkLm5leHQocHJldmlvdXNBY3RpdmVDb252ZXJzYXRpb25JZCk7XHJcbiAgICAgICAgdGhpcy5hY3RpdmVWaWV3JC5uZXh0KHByZXZpb3VzQWN0aXZlVmlldyk7XHJcbiAgICAgICAgdGhpcy5zaG93VG9hc3QoJ0NvdWxkIG5vdCBleGl0IGdyb3VwJywgJ2Vycm9yJyk7XHJcbiAgICAgICAgY2FsbGJhY2tzPy5lcnJvcj8uKCk7XHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgcmVtb3ZlQ29udmVyc2F0aW9uRnJvbVVpKGNvbnZlcnNhdGlvbklkOiBzdHJpbmcpOiB2b2lkIHtcclxuICAgIGNvbnN0IGl0ZW1zID0gdGhpcy5pbmJveCQudmFsdWUuZmlsdGVyKGkgPT4gU3RyaW5nKGkuY29udmVyc2F0aW9uX2lkKSAhPT0gU3RyaW5nKGNvbnZlcnNhdGlvbklkKSk7XHJcbiAgICB0aGlzLmluYm94JC5uZXh0KGl0ZW1zKTtcclxuICAgIHRoaXMucmVjYWxjVW5yZWFkKGl0ZW1zKTtcclxuXHJcbiAgICBjb25zdCBtYXAgPSBuZXcgTWFwKHRoaXMubWVzc2FnZXNNYXAkLnZhbHVlKTtcclxuICAgIG1hcC5kZWxldGUoY29udmVyc2F0aW9uSWQpO1xyXG4gICAgdGhpcy5tZXNzYWdlc01hcCQubmV4dChtYXApO1xyXG5cclxuICAgIHRoaXMub3BlbkNoYXRzJC5uZXh0KHRoaXMub3BlbkNoYXRzJC52YWx1ZS5maWx0ZXIoYyA9PiBTdHJpbmcoYy5jb252ZXJzYXRpb25JZCkgIT09IFN0cmluZyhjb252ZXJzYXRpb25JZCkpKTtcclxuICAgIGlmIChTdHJpbmcodGhpcy5hY3RpdmVDb252ZXJzYXRpb25JZCQudmFsdWUpID09PSBTdHJpbmcoY29udmVyc2F0aW9uSWQpKSB7XHJcbiAgICAgIHRoaXMuYWN0aXZlQ29udmVyc2F0aW9uSWQkLm5leHQobnVsbCk7XHJcbiAgICAgIHRoaXMuYWN0aXZlVmlldyQubmV4dCgnaW5ib3gnKTtcclxuICAgIH1cclxuICAgIGNvbnN0IHNldHRpbmdzID0gdGhpcy5ncm91cFNldHRpbmdzJC52YWx1ZTtcclxuICAgIGlmIChzZXR0aW5ncz8uY29udmVyc2F0aW9uSWQgPT09IGNvbnZlcnNhdGlvbklkKSB7XHJcbiAgICAgIHRoaXMuY2xlYXJHcm91cFNldHRpbmdzKCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvLyDilIDilIAgUmVhY3Rpb25zIOKUgOKUgFxyXG4gIGFkZFJlYWN0aW9uKG1lc3NhZ2VJZDogc3RyaW5nLCBlbW9qaTogc3RyaW5nKTogdm9pZCB7XHJcbiAgICBjb25zdCBjb250YWN0SWQgPSB0aGlzLmF1dGguY29udGFjdElkO1xyXG4gICAgaWYgKCFjb250YWN0SWQpIHJldHVybjtcclxuXHJcbiAgICAvLyBFbmZvcmNlIG9uZSByZWFjdGlvbiBwZXIgdXNlciDigJQgcmVtb3ZlIGFueSBleGlzdGluZyByZWFjdGlvbiB3aXRoIGEgZGlmZmVyZW50IGVtb2ppXHJcbiAgICBmb3IgKGNvbnN0IG1zZ3Mgb2YgdGhpcy5tZXNzYWdlc01hcCQudmFsdWUudmFsdWVzKCkpIHtcclxuICAgICAgY29uc3QgbXNnID0gbXNncy5maW5kKG0gPT4gU3RyaW5nKG0ubWVzc2FnZV9pZCkgPT09IFN0cmluZyhtZXNzYWdlSWQpKTtcclxuICAgICAgaWYgKG1zZz8ucmVhY3Rpb25zKSB7XHJcbiAgICAgICAgZm9yIChjb25zdCByIG9mIG1zZy5yZWFjdGlvbnMpIHtcclxuICAgICAgICAgIGlmIChyLmhhc1JlYWN0ZWQgJiYgci5lbW9qaSAhPT0gZW1vamkpIHtcclxuICAgICAgICAgICAgdGhpcy5hcHBseVJlYWN0aW9uT3B0aW1pc3RpY2FsbHkobWVzc2FnZUlkLCByLmVtb2ppLCBmYWxzZSk7XHJcbiAgICAgICAgICAgIHRoaXMuYXBpLnJlbW92ZVJlYWN0aW9uKG1lc3NhZ2VJZCwgY29udGFjdElkLCByLmVtb2ppKS5zdWJzY3JpYmUoeyBlcnJvcjogKCkgPT4ge30gfSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIGJyZWFrO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIE9wdGltaXN0aWMgVUkgc28gdXNlciBzZWVzIHJlYWN0aW9uIGltbWVkaWF0ZWx5LlxyXG4gICAgdGhpcy5hcHBseVJlYWN0aW9uT3B0aW1pc3RpY2FsbHkobWVzc2FnZUlkLCBlbW9qaSwgdHJ1ZSk7XHJcblxyXG4gICAgdGhpcy5hcGkuYWRkUmVhY3Rpb24obWVzc2FnZUlkLCBjb250YWN0SWQsIGVtb2ppKS5zdWJzY3JpYmUoe1xyXG4gICAgICBuZXh0OiAoKSA9PiB7XHJcbiAgICAgICAgdGhpcy5yZWZyZXNoTWVzc2FnZVJlYWN0aW9ucyhtZXNzYWdlSWQpO1xyXG4gICAgICB9LFxyXG4gICAgICBlcnJvcjogKCkgPT4ge1xyXG4gICAgICAgIC8vIFJldmVydCBvcHRpbWlzdGljIHVwZGF0ZSB3aGVuIHJlcXVlc3QgZmFpbHMuXHJcbiAgICAgICAgdGhpcy5hcHBseVJlYWN0aW9uT3B0aW1pc3RpY2FsbHkobWVzc2FnZUlkLCBlbW9qaSwgZmFsc2UpO1xyXG4gICAgICB9LFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICByZW1vdmVSZWFjdGlvbihtZXNzYWdlSWQ6IHN0cmluZywgZW1vamk6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgY29uc3QgY29udGFjdElkID0gdGhpcy5hdXRoLmNvbnRhY3RJZDtcclxuICAgIGlmICghY29udGFjdElkKSByZXR1cm47XHJcblxyXG4gICAgLy8gT3B0aW1pc3RpYyBVSSBzbyB1c2VyIHNlZXMgcmVhY3Rpb24gcmVtb3ZhbCBpbW1lZGlhdGVseS5cclxuICAgIHRoaXMuYXBwbHlSZWFjdGlvbk9wdGltaXN0aWNhbGx5KG1lc3NhZ2VJZCwgZW1vamksIGZhbHNlKTtcclxuXHJcbiAgICB0aGlzLmFwaS5yZW1vdmVSZWFjdGlvbihtZXNzYWdlSWQsIGNvbnRhY3RJZCwgZW1vamkpLnN1YnNjcmliZSh7XHJcbiAgICAgIG5leHQ6ICgpID0+IHtcclxuICAgICAgICB0aGlzLnJlZnJlc2hNZXNzYWdlUmVhY3Rpb25zKG1lc3NhZ2VJZCk7XHJcbiAgICAgIH0sXHJcbiAgICAgIGVycm9yOiAoKSA9PiB7XHJcbiAgICAgICAgLy8gUmV2ZXJ0IG9wdGltaXN0aWMgdXBkYXRlIHdoZW4gcmVxdWVzdCBmYWlscy5cclxuICAgICAgICB0aGlzLmFwcGx5UmVhY3Rpb25PcHRpbWlzdGljYWxseShtZXNzYWdlSWQsIGVtb2ppLCB0cnVlKTtcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgZ2V0QWN0aXZlQ29udmVyc2F0aW9uSWQoKTogc3RyaW5nIHwgbnVsbCB7XHJcbiAgICByZXR1cm4gdGhpcy5hY3RpdmVDb252ZXJzYXRpb25JZCQudmFsdWU7XHJcbiAgfVxyXG5cclxuICAvLyDilIDilIAgR2V0dGVycyDilIDilIBcclxuICBnZXRNZXNzYWdlc0ZvckNvbnZlcnNhdGlvbihjb252ZXJzYXRpb25JZDogc3RyaW5nKTogTWVzc2FnZVtdIHtcclxuICAgIHJldHVybiB0aGlzLm1lc3NhZ2VzTWFwJC52YWx1ZS5nZXQoY29udmVyc2F0aW9uSWQpIHx8IFtdO1xyXG4gIH1cclxuXHJcbiAgZ2V0Q3VycmVudEluYm94KCk6IEluYm94SXRlbVtdIHtcclxuICAgIHJldHVybiB0aGlzLmluYm94JC52YWx1ZTtcclxuICB9XHJcblxyXG4gIC8vIOKUgOKUgCBQcml2YXRlIGhlbHBlcnMg4pSA4pSAXHJcbiAgLyoqXHJcbiAgICogUHJlZmVyIGB7IHR5cGUsIGRhdGEgfWA7IHN1cHBvcnQgZmxhdCBgeyB0eXBlLCAuLi5maWVsZHMgfWAgZW52ZWxvcGVzIGZyb20gb2xkZXIgYmFja2VuZHMuXHJcbiAgICovXHJcbiAgcHJpdmF0ZSB3c0V2ZW50UGF5bG9hZChtc2c6IFdlYlNvY2tldE1lc3NhZ2UpOiBhbnkge1xyXG4gICAgaWYgKG1zZy5kYXRhICE9PSB1bmRlZmluZWQgJiYgbXNnLmRhdGEgIT09IG51bGwpIHtcclxuICAgICAgcmV0dXJuIG1zZy5kYXRhO1xyXG4gICAgfVxyXG4gICAgY29uc3QgcmF3ID0gbXNnIGFzIHVua25vd24gYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj47XHJcbiAgICBjb25zdCB7IHR5cGU6IF90LCBkYXRhOiBfZCwgdGltZXN0YW1wOiBfdHMsIG1lc3NhZ2U6IF9tc2csIC4uLnJlc3QgfSA9IHJhdztcclxuICAgIHJldHVybiBPYmplY3Qua2V5cyhyZXN0KS5sZW5ndGggPyByZXN0IDogbnVsbDtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgbGlzdGVuV2ViU29ja2V0KCk6IHZvaWQge1xyXG4gICAgdGhpcy53c1N1Yj8udW5zdWJzY3JpYmUoKTtcclxuICAgIHRoaXMud3NTdWIgPSB0aGlzLndzU2VydmljZS5vbk1lc3NhZ2UkLnN1YnNjcmliZSgobXNnKSA9PiB0aGlzLmhhbmRsZVdzTWVzc2FnZShtc2cpKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgaGFuZGxlV3NNZXNzYWdlKG1zZzogV2ViU29ja2V0TWVzc2FnZSk6IHZvaWQge1xyXG4gICAgc3dpdGNoIChtc2cudHlwZSkge1xyXG4gICAgICBjYXNlICduZXdfbWVzc2FnZSc6XHJcbiAgICAgICAgdGhpcy5oYW5kbGVOZXdNZXNzYWdlKHRoaXMud3NFdmVudFBheWxvYWQobXNnKSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgIGNhc2UgJ2NvbnZlcnNhdGlvbl91cGRhdGVkJzpcclxuICAgICAgICB0aGlzLmxvYWRJbmJveCgpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICBjYXNlICdncm91cF91cGRhdGVkJzpcclxuICAgICAgICB0aGlzLmhhbmRsZUdyb3VwVXBkYXRlZCh0aGlzLndzRXZlbnRQYXlsb2FkKG1zZykpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICBjYXNlICdlcnJvcic6XHJcbiAgICAgICAgdGhpcy5oYW5kbGVXZWJTb2NrZXRFcnJvcihtc2cubWVzc2FnZSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGhhbmRsZUdyb3VwVXBkYXRlZChkYXRhOiBhbnkpOiB2b2lkIHtcclxuICAgIHRoaXMubG9hZEluYm94KCk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGhhbmRsZVdlYlNvY2tldEVycm9yKGVycm9yTWVzc2FnZTogc3RyaW5nIHwgdW5kZWZpbmVkKTogdm9pZCB7XHJcbiAgICB2b2lkIGVycm9yTWVzc2FnZTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgaGFuZGxlTmV3TWVzc2FnZShkYXRhOiBhbnkpOiB2b2lkIHtcclxuICAgIGlmICghZGF0YSkgcmV0dXJuO1xyXG5cclxuICAgIGxldCBtZXNzYWdlOiBNZXNzYWdlID0gdGhpcy5ub3JtYWxpemVNZXNzYWdlU2hhcGUoZGF0YSk7XHJcbiAgICB0aGlzLmRldGVjdEdyb3VwUmVtb3ZhbEZvckN1cnJlbnRVc2VyKG1lc3NhZ2UpO1xyXG4gICAgY29uc3QgbXlDb250YWN0SWQgPSBTdHJpbmcodGhpcy5hdXRoLmNvbnRhY3RJZCA/PyAnJyk7XHJcbiAgICBjb25zdCBjb252SWQgPSBTdHJpbmcobWVzc2FnZS5jb252ZXJzYXRpb25faWQgPz8gJycpO1xyXG4gICAgY29uc3QgZXhpc3RpbmcgPSB0aGlzLm1lc3NhZ2VzTWFwJC52YWx1ZS5nZXQoY29udklkKSB8fCBbXTtcclxuXHJcbiAgICBjb25zdCBvd25FY2hvID1cclxuICAgICAgbXlDb250YWN0SWQgJiZcclxuICAgICAgU3RyaW5nKG1lc3NhZ2Uuc2VuZGVyX2lkKSA9PT0gbXlDb250YWN0SWQgJiZcclxuICAgICAgISFtZXNzYWdlLm1lc3NhZ2VfaWQgJiZcclxuICAgICAgIVN0cmluZyhtZXNzYWdlLm1lc3NhZ2VfaWQpLnN0YXJ0c1dpdGgoJ3RlbXAtJyk7XHJcblxyXG4gICAgLy8gV1Mgb2Z0ZW4gYXJyaXZlcyBiZWZvcmUgSFRUUCBmaW5pc2hlcyByZXBsYWNpbmcgdGVtcC07IG1lcmdlIGludG8gdGVtcCBpbnN0ZWFkIG9mIGFwcGVuZGluZyBhIGR1cGxpY2F0ZSByb3cuXHJcbiAgICBpZiAob3duRWNobykge1xyXG4gICAgICBjb25zdCB0ZW1wSWR4ID0gZXhpc3RpbmcuZmluZEluZGV4KChtKSA9PiB7XHJcbiAgICAgICAgaWYgKCFTdHJpbmcobS5tZXNzYWdlX2lkKS5zdGFydHNXaXRoKCd0ZW1wLScpKSByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgaWYgKFN0cmluZyhtLmNvbnZlcnNhdGlvbl9pZCkgIT09IGNvbnZJZCkgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIGlmIChTdHJpbmcobS5zZW5kZXJfaWQpICE9PSBteUNvbnRhY3RJZCkgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIGNvbnN0IGR0ID0gTWF0aC5hYnMoXHJcbiAgICAgICAgICBuZXcgRGF0ZShtLmNyZWF0ZWRfYXQpLmdldFRpbWUoKSAtIG5ldyBEYXRlKG1lc3NhZ2UuY3JlYXRlZF9hdCkuZ2V0VGltZSgpXHJcbiAgICAgICAgKTtcclxuICAgICAgICBpZiAoZHQgPj0gMTIwXzAwMCkgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIGNvbnN0IGEgPSBTdHJpbmcobS5jb250ZW50ID8/ICcnKS50cmltKCk7XHJcbiAgICAgICAgY29uc3QgYiA9IFN0cmluZyhtZXNzYWdlLmNvbnRlbnQgPz8gJycpLnRyaW0oKTtcclxuICAgICAgICByZXR1cm4gYSA9PT0gYiB8fCAhYjtcclxuICAgICAgfSk7XHJcbiAgICAgIGlmICh0ZW1wSWR4ID49IDApIHtcclxuICAgICAgICBjb25zdCBtZXJnZWQ6IE1lc3NhZ2UgPSB0aGlzLm1lcmdlTWVzc2FnZUF0dGFjaG1lbnRzKGV4aXN0aW5nW3RlbXBJZHhdLCB0aGlzLm5vcm1hbGl6ZU1lc3NhZ2VTaGFwZSh7XHJcbiAgICAgICAgICAuLi5leGlzdGluZ1t0ZW1wSWR4XSxcclxuICAgICAgICAgIC4uLmRhdGEsXHJcbiAgICAgICAgICBtZXNzYWdlX2lkOiBtZXNzYWdlLm1lc3NhZ2VfaWQsXHJcbiAgICAgICAgICBjb252ZXJzYXRpb25faWQ6IGNvbnZJZCxcclxuICAgICAgICAgIGNvbnRlbnQ6IHRoaXMuY29hbGVzY2VNZXNzYWdlVGV4dChkYXRhLCBleGlzdGluZ1t0ZW1wSWR4XS5jb250ZW50KSxcclxuICAgICAgICB9KSk7XHJcbiAgICAgICAgY29uc3QgbWFwID0gbmV3IE1hcCh0aGlzLm1lc3NhZ2VzTWFwJC52YWx1ZSk7XHJcbiAgICAgICAgY29uc3QgbXNncyA9IHRoaXMuZGVkdXBlTWVzc2FnZXNCeUlkS2VlcEZpcnN0KFsuLi5leGlzdGluZ10pO1xyXG4gICAgICAgIG1zZ3NbdGVtcElkeF0gPSBtZXJnZWQ7XHJcbiAgICAgICAgbWFwLnNldChjb252SWQsIHRoaXMuZGVkdXBlTWVzc2FnZXNCeUlkS2VlcEZpcnN0KG1zZ3MpKTtcclxuICAgICAgICB0aGlzLm1lc3NhZ2VzTWFwJC5uZXh0KG1hcCk7XHJcbiAgICAgICAgdGhpcy5yZWZyZXNoTWVzc2FnZVJlYWN0aW9ucyhtZXJnZWQubWVzc2FnZV9pZCk7XHJcbiAgICAgICAgbWVzc2FnZSA9IG1lcmdlZDtcclxuICAgICAgICB0aGlzLnVwZGF0ZUluYm94UHJldmlldyhtZXNzYWdlKTtcclxuICAgICAgICBpZiAodGhpcy5hY3RpdmVDb252ZXJzYXRpb25JZCQudmFsdWUgPT09IG1lc3NhZ2UuY29udmVyc2F0aW9uX2lkKSB7XHJcbiAgICAgICAgICB0aGlzLm1hcmtBc1JlYWQobWVzc2FnZS5jb252ZXJzYXRpb25faWQpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm47XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBpc0Zyb21PdGhlciA9IFN0cmluZyhtZXNzYWdlLnNlbmRlcl9pZCkgIT09IG15Q29udGFjdElkO1xyXG5cclxuICAgIGNvbnN0IGR1cGxpY2F0ZUlkeCA9IGV4aXN0aW5nLmZpbmRJbmRleChcclxuICAgICAgKG0pID0+XHJcbiAgICAgICAgU3RyaW5nKG0ubWVzc2FnZV9pZCkgPT09IFN0cmluZyhtZXNzYWdlLm1lc3NhZ2VfaWQpIHx8XHJcbiAgICAgICAgKFN0cmluZyhtLnNlbmRlcl9pZCkgPT09IFN0cmluZyhtZXNzYWdlLnNlbmRlcl9pZCkgJiZcclxuICAgICAgICAgIFN0cmluZyhtLmNvbnRlbnQgPz8gJycpID09PSBTdHJpbmcobWVzc2FnZS5jb250ZW50ID8/ICcnKSAmJlxyXG4gICAgICAgICAgTWF0aC5hYnMobmV3IERhdGUobS5jcmVhdGVkX2F0KS5nZXRUaW1lKCkgLSBuZXcgRGF0ZShtZXNzYWdlLmNyZWF0ZWRfYXQpLmdldFRpbWUoKSkgPCAyMDAwKVxyXG4gICAgKTtcclxuICAgIGNvbnN0IGlzRHVwbGljYXRlID0gZHVwbGljYXRlSWR4ID49IDA7XHJcblxyXG4gICAgaWYgKCFpc0R1cGxpY2F0ZSkge1xyXG4gICAgICB0aGlzLmFwcGVuZE1lc3NhZ2UobWVzc2FnZSk7XHJcblxyXG4gICAgICBpZiAoaXNGcm9tT3RoZXIpIHtcclxuICAgICAgICB0aGlzLnBsYXlTb2Z0Tm90aWZpY2F0aW9uU291bmQoKTtcclxuICAgICAgfVxyXG4gICAgICB0aGlzLnVwZGF0ZUluYm94UHJldmlldyhtZXNzYWdlKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIGNvbnN0IG1hcCA9IG5ldyBNYXAodGhpcy5tZXNzYWdlc01hcCQudmFsdWUpO1xyXG4gICAgICBjb25zdCBtc2dzID0gWy4uLmV4aXN0aW5nXTtcclxuICAgICAgbXNnc1tkdXBsaWNhdGVJZHhdID0gdGhpcy5tZXJnZU1lc3NhZ2VBdHRhY2htZW50cyhleGlzdGluZ1tkdXBsaWNhdGVJZHhdLCBtZXNzYWdlKTtcclxuICAgICAgbWFwLnNldChjb252SWQsIG1zZ3MpO1xyXG4gICAgICB0aGlzLm1lc3NhZ2VzTWFwJC5uZXh0KG1hcCk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKHRoaXMuYWN0aXZlQ29udmVyc2F0aW9uSWQkLnZhbHVlICE9PSBtZXNzYWdlLmNvbnZlcnNhdGlvbl9pZCkge1xyXG4gICAgICBpZiAoaXNGcm9tT3RoZXIgJiYgIWlzRHVwbGljYXRlKSB7XHJcbiAgICAgICAgdGhpcy5pbmNyZW1lbnRVbnJlYWQobWVzc2FnZS5jb252ZXJzYXRpb25faWQpO1xyXG4gICAgICB9XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICB0aGlzLm1hcmtBc1JlYWQobWVzc2FnZS5jb252ZXJzYXRpb25faWQpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqIFB1YmxpYyDigJQgbGV0cyBjb21wb25lbnRzIGFkZCBhbiBvcHRpbWlzdGljIG1lc3NhZ2Ugd2l0aG91dCBhIHJvdW5kLXRyaXAuICovXHJcbiAgYXBwZW5kT3B0aW1pc3RpY01lc3NhZ2UobWVzc2FnZTogTWVzc2FnZSk6IHZvaWQge1xyXG4gICAgdGhpcy5hcHBlbmRNZXNzYWdlKG1lc3NhZ2UpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBhcHBlbmRNZXNzYWdlKG1lc3NhZ2U6IE1lc3NhZ2UpOiB2b2lkIHtcclxuICAgIGNvbnN0IG1hcCA9IG5ldyBNYXAodGhpcy5tZXNzYWdlc01hcCQudmFsdWUpO1xyXG4gICAgY29uc3QgY3VycmVudCA9IG1hcC5nZXQobWVzc2FnZS5jb252ZXJzYXRpb25faWQpIHx8IFtdO1xyXG4gICAgY29uc3Qgc2FtZUlkSWR4ID0gY3VycmVudC5maW5kSW5kZXgoKG0pID0+IFN0cmluZyhtLm1lc3NhZ2VfaWQpID09PSBTdHJpbmcobWVzc2FnZS5tZXNzYWdlX2lkKSk7XHJcbiAgICBpZiAoc2FtZUlkSWR4ID49IDApIHtcclxuICAgICAgY29uc3QgbXNncyA9IFsuLi5jdXJyZW50XTtcclxuICAgICAgbXNnc1tzYW1lSWRJZHhdID0gdGhpcy5tZXJnZU1lc3NhZ2VBdHRhY2htZW50cyhjdXJyZW50W3NhbWVJZElkeF0sIG1lc3NhZ2UpO1xyXG4gICAgICBtYXAuc2V0KG1lc3NhZ2UuY29udmVyc2F0aW9uX2lkLCBtc2dzKTtcclxuICAgICAgdGhpcy5tZXNzYWdlc01hcCQubmV4dChtYXApO1xyXG4gICAgICB0aGlzLnJlZnJlc2hNZXNzYWdlUmVhY3Rpb25zKG1lc3NhZ2UubWVzc2FnZV9pZCk7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBtc2dzID0gWy4uLmN1cnJlbnQsIG1lc3NhZ2VdO1xyXG4gICAgbWFwLnNldChtZXNzYWdlLmNvbnZlcnNhdGlvbl9pZCwgbXNncyk7XHJcbiAgICB0aGlzLm1lc3NhZ2VzTWFwJC5uZXh0KG1hcCk7XHJcbiAgICB0aGlzLnJlZnJlc2hNZXNzYWdlUmVhY3Rpb25zKG1lc3NhZ2UubWVzc2FnZV9pZCk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIG1lcmdlTWVzc2FnZUF0dGFjaG1lbnRzKGV4aXN0aW5nOiBNZXNzYWdlLCBpbmNvbWluZzogTWVzc2FnZSk6IE1lc3NhZ2Uge1xyXG4gICAgY29uc3QgZXhpc3RpbmdBdHRhY2htZW50cyA9IHRoaXMubm9ybWFsaXplQXR0YWNobWVudExpc3QoZXhpc3RpbmcuYXR0YWNobWVudHMgfHwgW10pO1xyXG4gICAgY29uc3QgaW5jb21pbmdBdHRhY2htZW50cyA9IHRoaXMubm9ybWFsaXplQXR0YWNobWVudExpc3QoaW5jb21pbmcuYXR0YWNobWVudHMgfHwgW10pO1xyXG4gICAgY29uc3QgYXR0YWNobWVudHMgPVxyXG4gICAgICBpbmNvbWluZ0F0dGFjaG1lbnRzLmxlbmd0aCA+PSBleGlzdGluZ0F0dGFjaG1lbnRzLmxlbmd0aCA/IGluY29taW5nQXR0YWNobWVudHMgOiBleGlzdGluZ0F0dGFjaG1lbnRzO1xyXG5cclxuICAgIHJldHVybiB7XHJcbiAgICAgIC4uLmV4aXN0aW5nLFxyXG4gICAgICAuLi5pbmNvbWluZyxcclxuICAgICAgcmVhY3Rpb25zOiBpbmNvbWluZy5yZWFjdGlvbnMgfHwgZXhpc3RpbmcucmVhY3Rpb25zLFxyXG4gICAgICBhdHRhY2htZW50czogYXR0YWNobWVudHMubGVuZ3RoID4gMCA/IGF0dGFjaG1lbnRzIDogaW5jb21pbmcuYXR0YWNobWVudHMgfHwgZXhpc3RpbmcuYXR0YWNobWVudHMsXHJcbiAgICB9O1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBub3JtYWxpemVBdHRhY2htZW50TGlzdChhdHRhY2htZW50czogQXR0YWNobWVudFtdKTogQXR0YWNobWVudFtdIHtcclxuICAgIGNvbnN0IGJ5SWQgPSBuZXcgTWFwPHN0cmluZywgQXR0YWNobWVudD4oKTtcclxuICAgIGZvciAoY29uc3QgYXR0YWNobWVudCBvZiBhdHRhY2htZW50cykge1xyXG4gICAgICBjb25zdCBmaWxlSWQgPSBTdHJpbmcoYXR0YWNobWVudD8uZmlsZV9pZCB8fCAnJykudHJpbSgpO1xyXG4gICAgICBpZiAoIWZpbGVJZCB8fCBmaWxlSWQuc3RhcnRzV2l0aCgndGVtcC0nKSkgY29udGludWU7XHJcbiAgICAgIGJ5SWQuc2V0KGZpbGVJZCwge1xyXG4gICAgICAgIC4uLmF0dGFjaG1lbnQsXHJcbiAgICAgICAgZmlsZV9pZDogZmlsZUlkLFxyXG4gICAgICAgIGZpbGVuYW1lOiBhdHRhY2htZW50LmZpbGVuYW1lIHx8ICdGaWxlJyxcclxuICAgICAgfSk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gQXJyYXkuZnJvbShieUlkLnZhbHVlcygpKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgdXBkYXRlSW5ib3hQcmV2aWV3KG1lc3NhZ2U6IE1lc3NhZ2UpOiB2b2lkIHtcclxuICAgIGNvbnN0IHRleHQgPSBTdHJpbmcobWVzc2FnZS5jb250ZW50ID8/ICcnKS50cmltKCk7XHJcbiAgICBjb25zdCBtZWRpYSA9IHRoaXMubWVzc2FnZUxvb2tzTGlrZU1lZGlhKG1lc3NhZ2UpO1xyXG4gICAgaWYgKCF0ZXh0ICYmICFtZWRpYSkge1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICBjb25zdCBwcmV2aWV3ID0gdGV4dCB8fCAnW0ltYWdlXSc7XHJcbiAgICBjb25zdCBpdGVtcyA9IHRoaXMuaW5ib3gkLnZhbHVlLm1hcCgoaXRlbSkgPT4ge1xyXG4gICAgICBpZiAoaXRlbS5jb252ZXJzYXRpb25faWQgPT09IG1lc3NhZ2UuY29udmVyc2F0aW9uX2lkKSB7XHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgIC4uLml0ZW0sXHJcbiAgICAgICAgICBsYXN0X21lc3NhZ2VfcHJldmlldzogcHJldmlldyxcclxuICAgICAgICAgIGxhc3RfbWVzc2FnZV9hdDogbWVzc2FnZS5jcmVhdGVkX2F0LFxyXG4gICAgICAgIH07XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIGl0ZW07XHJcbiAgICB9KTtcclxuXHJcbiAgICBpdGVtcy5zb3J0KChhLCBiKSA9PiBuZXcgRGF0ZShiLmxhc3RfbWVzc2FnZV9hdCkuZ2V0VGltZSgpIC0gbmV3IERhdGUoYS5sYXN0X21lc3NhZ2VfYXQpLmdldFRpbWUoKSk7XHJcbiAgICB0aGlzLmluYm94JC5uZXh0KGl0ZW1zKTtcclxuICB9XHJcblxyXG4gIC8qKiBGaXJzdCBub24tZW1wdHkgdGV4dCBmaWVsZCBmcm9tIEFQSSAvIFdTIG9iamVjdHMgKFBPU1QgYm9kaWVzIG9mdGVuIG9taXQgYGNvbnRlbnRgKS4gKi9cclxuICBwcml2YXRlIGNvYWxlc2NlTWVzc2FnZVRleHQocmF3OiBhbnksIGZhbGxiYWNrID0gJycpOiBzdHJpbmcge1xyXG4gICAgY29uc3QgY2FuZHMgPSBbcmF3Py5jb250ZW50LCByYXc/LmJvZHksIHJhdz8udGV4dCwgZmFsbGJhY2tdO1xyXG4gICAgZm9yIChjb25zdCBjIG9mIGNhbmRzKSB7XHJcbiAgICAgIGlmICh0eXBlb2YgYyA9PT0gJ3N0cmluZycgJiYgYy50cmltKCkpIHJldHVybiBjO1xyXG4gICAgICBpZiAoYyAhPSBudWxsICYmIHR5cGVvZiBjICE9PSAnb2JqZWN0JyAmJiBTdHJpbmcoYykudHJpbSgpKSByZXR1cm4gU3RyaW5nKGMpLnRyaW0oKTtcclxuICAgIH1cclxuICAgIHJldHVybiB0eXBlb2YgZmFsbGJhY2sgPT09ICdzdHJpbmcnID8gZmFsbGJhY2sgOiBTdHJpbmcoZmFsbGJhY2sgPz8gJycpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBtZXNzYWdlTG9va3NMaWtlTWVkaWEobTogTWVzc2FnZSk6IGJvb2xlYW4ge1xyXG4gICAgY29uc3QgdCA9IG0ubWVzc2FnZV90eXBlO1xyXG4gICAgaWYgKHQgJiYgdCAhPT0gJ1RFWFQnKSByZXR1cm4gdHJ1ZTtcclxuICAgIGNvbnN0IHUgPSBTdHJpbmcobS5tZWRpYV91cmwgPz8gJycpLnRyaW0oKTtcclxuICAgIGlmICh1ICYmICh1LnN0YXJ0c1dpdGgoJ2h0dHA6Ly8nKSB8fCB1LnN0YXJ0c1dpdGgoJ2h0dHBzOi8vJykgfHwgdS5zdGFydHNXaXRoKCdkYXRhOicpKSkge1xyXG4gICAgICByZXR1cm4gdHJ1ZTtcclxuICAgIH1cclxuICAgIHJldHVybiBBcnJheS5pc0FycmF5KG0uYXR0YWNobWVudHMpICYmIG0uYXR0YWNobWVudHMubGVuZ3RoID4gMDtcclxuICB9XHJcblxyXG4gIC8qKiBTYW1lIGxvZ2ljYWwgbWVzc2FnZV9pZCBjYW4gYXBwZWFyIHR3aWNlIHdoZW4gV1MgYmVhdHMgSFRUUCB0ZW1wIHJlcGxhY2VtZW50IOKAlCBrZWVwIGZpcnN0IHJvdy4gKi9cclxuICBwcml2YXRlIGRlZHVwZU1lc3NhZ2VzQnlJZEtlZXBGaXJzdChtc2dzOiBNZXNzYWdlW10pOiBNZXNzYWdlW10ge1xyXG4gICAgY29uc3Qgc2VlbiA9IG5ldyBTZXQ8c3RyaW5nPigpO1xyXG4gICAgcmV0dXJuIG1zZ3MuZmlsdGVyKChtKSA9PiB7XHJcbiAgICAgIGNvbnN0IGlkID0gU3RyaW5nKG0ubWVzc2FnZV9pZCA/PyAnJyk7XHJcbiAgICAgIGlmICghaWQpIHJldHVybiB0cnVlO1xyXG4gICAgICBpZiAoc2Vlbi5oYXMoaWQpKSByZXR1cm4gZmFsc2U7XHJcbiAgICAgIHNlZW4uYWRkKGlkKTtcclxuICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgaW5jcmVtZW50VW5yZWFkKGNvbnZlcnNhdGlvbklkOiBzdHJpbmcpOiB2b2lkIHtcclxuICAgIGNvbnN0IGl0ZW1zID0gdGhpcy5pbmJveCQudmFsdWUubWFwKChpdGVtKSA9PlxyXG4gICAgICBpdGVtLmNvbnZlcnNhdGlvbl9pZCA9PT0gY29udmVyc2F0aW9uSWRcclxuICAgICAgICA/IHsgLi4uaXRlbSwgdW5yZWFkX2NvdW50OiBOdW1iZXIoaXRlbS51bnJlYWRfY291bnQpICsgMSB9XHJcbiAgICAgICAgOiBpdGVtXHJcbiAgICApO1xyXG4gICAgdGhpcy5pbmJveCQubmV4dChpdGVtcyk7XHJcbiAgICB0aGlzLnJlY2FsY1VucmVhZChpdGVtcyk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBOb3JtYWxpemUgYmFja2VuZCBtZXNzYWdlIHNoYXBlcyBzbyBVSSBjYW4gcmVsaWFibHkgcmVuZGVyIGF0dGFjaG1lbnRzL21lZGlhLlxyXG4gICAqIFN1cHBvcnRzIGxlZ2FjeSBhbmQgY3VycmVudCBmaWVsZCBuYW1lcyByZXR1cm5lZCBieSBBUEkvV1MgcGF5bG9hZHMuXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBub3JtYWxpemVNZXNzYWdlU2hhcGUocmF3OiBhbnkpOiBNZXNzYWdlIHtcclxuICAgIGNvbnN0IGJhc2U6IE1lc3NhZ2UgPSB7XHJcbiAgICAgIG1lc3NhZ2VfaWQ6IFN0cmluZyhyYXc/Lm1lc3NhZ2VfaWQgPz8gcmF3Py5pZCA/PyAnJyksXHJcbiAgICAgIGNvbnZlcnNhdGlvbl9pZDogU3RyaW5nKHJhdz8uY29udmVyc2F0aW9uX2lkID8/IHJhdz8uY29udmVyc2F0aW9uSWQgPz8gJycpLFxyXG4gICAgICBzZW5kZXJfaWQ6IFN0cmluZyhyYXc/LnNlbmRlcl9pZCA/PyByYXc/LnNlbmRlcklkID8/ICcnKSxcclxuICAgICAgc2VuZGVyX25hbWU6IHJhdz8uc2VuZGVyX25hbWUsXHJcbiAgICAgIHNlbmRlcl91c2VybmFtZTogcmF3Py5zZW5kZXJfdXNlcm5hbWUsXHJcbiAgICAgIHNlbmRlcl9maXJzdF9uYW1lOiByYXc/LnNlbmRlcl9maXJzdF9uYW1lLFxyXG4gICAgICBzZW5kZXJfbGFzdF9uYW1lOiByYXc/LnNlbmRlcl9sYXN0X25hbWUsXHJcbiAgICAgIG1lc3NhZ2VfdHlwZTogKHJhdz8ubWVzc2FnZV90eXBlID8/IHJhdz8ubWVzc2FnZVR5cGUgPz8gJ1RFWFQnKSBhcyBNZXNzYWdlWydtZXNzYWdlX3R5cGUnXSxcclxuICAgICAgY29udGVudDogcmF3Py5jb250ZW50ID8/IHJhdz8uYm9keSA/PyByYXc/LnRleHQgPz8gJycsXHJcbiAgICAgIG1lZGlhX3VybDogcmF3Py5tZWRpYV91cmwgPz8gcmF3Py5tZWRpYVVybCA/PyByYXc/LnVybCA/PyByYXc/LmZpbGVfdXJsLFxyXG4gICAgICBjcmVhdGVkX2F0OiByYXc/LmNyZWF0ZWRfYXQgPz8gcmF3Py5jcmVhdGVkQXQgPz8gbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxyXG4gICAgICBpc19yZWFkOiByYXc/LmlzX3JlYWQsXHJcbiAgICAgIHJlYWN0aW9uczogcmF3Py5yZWFjdGlvbnMsXHJcbiAgICAgIG1lbnRpb25zOiByYXc/Lm1lbnRpb25zLFxyXG4gICAgICBhdHRhY2htZW50czogcmF3Py5hdHRhY2htZW50cyxcclxuICAgICAgaXNfcGlubmVkOiByYXc/LmlzX3Bpbm5lZCxcclxuICAgICAgcGlubmVkX2F0OiByYXc/LnBpbm5lZF9hdCxcclxuICAgICAgcGlubmVkX2J5OiByYXc/LnBpbm5lZF9ieSxcclxuICAgIH07XHJcblxyXG4gICAgY29uc3QgdXVpZFJlID1cclxuICAgICAgL15bMC05YS1mXXs4fS1bMC05YS1mXXs0fS1bMS01XVswLTlhLWZdezN9LVs4OWFiXVswLTlhLWZdezN9LVswLTlhLWZdezEyfSQvaTtcclxuXHJcbiAgICBjb25zdCB0b1N0cmluZ0FycmF5ID0gKHZhbHVlOiBhbnkpOiBzdHJpbmdbXSA9PiB7XHJcbiAgICAgIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkge1xyXG4gICAgICAgIHJldHVybiB2YWx1ZVxyXG4gICAgICAgICAgLm1hcCgoeDogYW55KSA9PiAodHlwZW9mIHggPT09ICdzdHJpbmcnID8geCA6IHg/LmZpbGVfaWQgPz8geD8uaWQgPz8gJycpKVxyXG4gICAgICAgICAgLm1hcCgoeDogYW55KSA9PiBTdHJpbmcoeCkudHJpbSgpKVxyXG4gICAgICAgICAgLmZpbHRlcihCb29sZWFuKTtcclxuICAgICAgfVxyXG4gICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJyAmJiB2YWx1ZS50cmltKCkpIHtcclxuICAgICAgICBjb25zdCB0cmltbWVkID0gdmFsdWUudHJpbSgpO1xyXG4gICAgICAgIGlmICh0cmltbWVkLnN0YXJ0c1dpdGgoJ3snKSB8fCB0cmltbWVkLnN0YXJ0c1dpdGgoJ1snKSkge1xyXG4gICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgY29uc3QgcGFyc2VkID0gSlNPTi5wYXJzZSh0cmltbWVkKTtcclxuICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkocGFyc2VkKSkgcmV0dXJuIHRvU3RyaW5nQXJyYXkocGFyc2VkKTtcclxuICAgICAgICAgICAgcmV0dXJuIHRvU3RyaW5nQXJyYXkocGFyc2VkPy5pZHMgPz8gcGFyc2VkPy5maWxlX2lkcyA/PyBwYXJzZWQ/LmF0dGFjaG1lbnRfaWRzID8/IHBhcnNlZD8uYXR0YWNobWVudHMpO1xyXG4gICAgICAgICAgfSBjYXRjaCB7XHJcbiAgICAgICAgICAgIHJldHVybiBbXTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHRyaW1tZWQuc3BsaXQoL1ssXFxzXSsvKS5tYXAoKHM6IHN0cmluZykgPT4gcy50cmltKCkpLmZpbHRlcihCb29sZWFuKTtcclxuICAgICAgfVxyXG4gICAgICByZXR1cm4gW107XHJcbiAgICB9O1xyXG5cclxuICAgIGNvbnN0IG5vcm1hbGl6ZUF0dGFjaG1lbnQgPSAoYTogYW55KTogQXR0YWNobWVudCB8IG51bGwgPT4ge1xyXG4gICAgICBjb25zdCBmaWxlSWQgPSBTdHJpbmcoXHJcbiAgICAgICAgdHlwZW9mIGEgPT09ICdzdHJpbmcnID8gYSA6XHJcbiAgICAgICAgYT8uZmlsZV9pZCA/PyBhPy5maWxlSWQgPz8gYT8uaWQgPz8gYT8uYXR0YWNobWVudF9pZCA/PyBhPy5zdG9yYWdlX2ZpbGVfaWQgPz8gJydcclxuICAgICAgKS50cmltKCk7XHJcbiAgICAgIGlmICghZmlsZUlkIHx8IGZpbGVJZC5zdGFydHNXaXRoKCd0ZW1wLScpKSByZXR1cm4gbnVsbDtcclxuICAgICAgcmV0dXJuIHtcclxuICAgICAgICBmaWxlX2lkOiBmaWxlSWQsXHJcbiAgICAgICAgZmlsZW5hbWU6IFN0cmluZyhhPy5maWxlbmFtZSA/PyBhPy5maWxlX25hbWUgPz8gYT8ubmFtZSA/PyBhPy5vcmlnaW5hbF9maWxlbmFtZSA/PyAnRmlsZScpLFxyXG4gICAgICAgIG1pbWVfdHlwZTogYT8ubWltZV90eXBlID8/IGE/Lm1pbWVUeXBlLFxyXG4gICAgICAgIHNpemVfYnl0ZXM6IGE/LnNpemVfYnl0ZXMgPz8gYT8uc2l6ZUJ5dGVzLFxyXG4gICAgICAgIHVybDogYT8udXJsID8/IGE/LmZpbGVfdXJsID8/IGE/LmRvd25sb2FkX3VybCxcclxuICAgICAgfTtcclxuICAgIH07XHJcblxyXG4gICAgbGV0IG5vcm1hbGl6ZWRBdHRhY2htZW50czogQXR0YWNobWVudFtdID0gW107XHJcbiAgICBjb25zdCBhZGRBdHRhY2htZW50ID0gKGF0dGFjaG1lbnQ6IEF0dGFjaG1lbnQgfCBudWxsKTogdm9pZCA9PiB7XHJcbiAgICAgIGlmICghYXR0YWNobWVudCkgcmV0dXJuO1xyXG4gICAgICBjb25zdCBmaWxlSWQgPSBTdHJpbmcoYXR0YWNobWVudC5maWxlX2lkIHx8ICcnKS50cmltKCk7XHJcbiAgICAgIGNvbnN0IHVybCA9IFN0cmluZyhhdHRhY2htZW50LnVybCB8fCAnJykudHJpbSgpO1xyXG4gICAgICBpZiAoZmlsZUlkLnN0YXJ0c1dpdGgoJ3snKSB8fCBmaWxlSWQuc3RhcnRzV2l0aCgnWycpKSB7XHJcbiAgICAgICAgY29uc3QgaWRzID0gdG9TdHJpbmdBcnJheShmaWxlSWQpO1xyXG4gICAgICAgIGlkcy5mb3JFYWNoKChpZCwgaWR4KSA9PiB7XHJcbiAgICAgICAgICBhZGRBdHRhY2htZW50KHtcclxuICAgICAgICAgICAgLi4uYXR0YWNobWVudCxcclxuICAgICAgICAgICAgZmlsZV9pZDogaWQsXHJcbiAgICAgICAgICAgIGZpbGVuYW1lOiBhdHRhY2htZW50LmZpbGVuYW1lIHx8IGBBdHRhY2htZW50ICR7aWR4ICsgMX1gLFxyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICB9XHJcbiAgICAgIGlmIChmaWxlSWQgJiYgbm9ybWFsaXplZEF0dGFjaG1lbnRzLnNvbWUoKGEpID0+IGEuZmlsZV9pZCA9PT0gZmlsZUlkKSkgcmV0dXJuO1xyXG4gICAgICBpZiAoIWZpbGVJZCAmJiB1cmwgJiYgbm9ybWFsaXplZEF0dGFjaG1lbnRzLnNvbWUoKGEpID0+IGEudXJsID09PSB1cmwpKSByZXR1cm47XHJcbiAgICAgIG5vcm1hbGl6ZWRBdHRhY2htZW50cy5wdXNoKGF0dGFjaG1lbnQpO1xyXG4gICAgfTtcclxuXHJcbiAgICAvLyBOb3JtYWxpemUgYXR0YWNobWVudCBvYmplY3RzIChBUEkgbWF5IHVzZSBmaWxlSWQgLyBpZCBpbnN0ZWFkIG9mIGZpbGVfaWQpLlxyXG4gICAgaWYgKEFycmF5LmlzQXJyYXkoYmFzZS5hdHRhY2htZW50cykgJiYgYmFzZS5hdHRhY2htZW50cy5sZW5ndGggPiAwKSB7XHJcbiAgICAgIChiYXNlLmF0dGFjaG1lbnRzIGFzIGFueVtdKS5mb3JFYWNoKChhKSA9PiBhZGRBdHRhY2htZW50KG5vcm1hbGl6ZUF0dGFjaG1lbnQoYSkpKTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBtZWRpYVZhbHVlID0gU3RyaW5nKGJhc2UubWVkaWFfdXJsIHx8ICcnKS50cmltKCk7XHJcbiAgICBpZiAobWVkaWFWYWx1ZS5zdGFydHNXaXRoKCd7JykgfHwgbWVkaWFWYWx1ZS5zdGFydHNXaXRoKCdbJykpIHtcclxuICAgICAgdHJ5IHtcclxuICAgICAgICBjb25zdCBwYXJzZWQgPSBKU09OLnBhcnNlKG1lZGlhVmFsdWUpO1xyXG4gICAgICAgIGNvbnN0IHJhd0F0dGFjaG1lbnRzID0gQXJyYXkuaXNBcnJheShwYXJzZWQpID8gcGFyc2VkIDogcGFyc2VkPy5hdHRhY2htZW50cztcclxuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShyYXdBdHRhY2htZW50cykpIHtcclxuICAgICAgICAgIHJhd0F0dGFjaG1lbnRzLmZvckVhY2goKGEpID0+IGFkZEF0dGFjaG1lbnQobm9ybWFsaXplQXR0YWNobWVudChhKSkpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkocGFyc2VkKSkge1xyXG4gICAgICAgICAgY29uc3QgbWVkaWFJZHMgPSB0b1N0cmluZ0FycmF5KHBhcnNlZD8uaWRzID8/IHBhcnNlZD8uZmlsZV9pZHMgPz8gcGFyc2VkPy5hdHRhY2htZW50X2lkcyk7XHJcbiAgICAgICAgICBjb25zdCBtZWRpYUZpbGVuYW1lcyA9IHRvU3RyaW5nQXJyYXkocGFyc2VkPy5maWxlbmFtZXMpO1xyXG4gICAgICAgICAgY29uc3QgbWVkaWFNaW1lVHlwZXMgPSB0b1N0cmluZ0FycmF5KHBhcnNlZD8ubWltZV90eXBlcyA/PyBwYXJzZWQ/Lm1pbWVUeXBlcyk7XHJcbiAgICAgICAgICBtZWRpYUlkcy5mb3JFYWNoKChpZCwgaWR4KSA9PiB7XHJcbiAgICAgICAgICAgIGFkZEF0dGFjaG1lbnQoe1xyXG4gICAgICAgICAgICAgIGZpbGVfaWQ6IGlkLFxyXG4gICAgICAgICAgICAgIGZpbGVuYW1lOiBtZWRpYUZpbGVuYW1lc1tpZHhdIHx8IG1lZGlhRmlsZW5hbWVzWzBdIHx8IGBBdHRhY2htZW50ICR7aWR4ICsgMX1gLFxyXG4gICAgICAgICAgICAgIG1pbWVfdHlwZTogbWVkaWFNaW1lVHlwZXNbaWR4XSxcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICAgIH0gY2F0Y2gge1xyXG4gICAgICAgIC8vIEZhbGwgdGhyb3VnaCB0byBsZWdhY3kgYXR0YWNobWVudCByZWNvbnN0cnVjdGlvbiBiZWxvdy5cclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8vIFJlY29uc3RydWN0IGF0dGFjaG1lbnRzIGZyb20gYWx0ZXJuYXRlIEFQSSBmaWVsZHMuXHJcbiAgICBsZXQgYXR0YWNobWVudElkczogc3RyaW5nW10gPSBbXTtcclxuICAgIGF0dGFjaG1lbnRJZHMgPSB0b1N0cmluZ0FycmF5KHJhdz8uYXR0YWNobWVudF9pZHMpO1xyXG5cclxuICAgIGlmIChhdHRhY2htZW50SWRzLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICBhdHRhY2htZW50SWRzID0gdG9TdHJpbmdBcnJheShyYXc/LmZpbGVfaWRzKTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBwdXNoSWQgPSAodjogYW55KSA9PiB7XHJcbiAgICAgIGNvbnN0IHMgPSB2ICE9IG51bGwgJiYgdiAhPT0gJycgPyBTdHJpbmcodikudHJpbSgpIDogJyc7XHJcbiAgICAgIGlmIChzICYmICFhdHRhY2htZW50SWRzLmluY2x1ZGVzKHMpKSBhdHRhY2htZW50SWRzLnB1c2gocyk7XHJcbiAgICB9O1xyXG5cclxuICAgIHB1c2hJZChyYXc/LmZpbGVfaWQpO1xyXG4gICAgcHVzaElkKHJhdz8uYXR0YWNobWVudF9pZCk7XHJcbiAgICBwdXNoSWQocmF3Py5zdG9yYWdlX2ZpbGVfaWQpO1xyXG4gICAgcHVzaElkKHJhdz8uYmxvYl9pZCk7XHJcblxyXG4gICAgLy8gQmFja2VuZCBzdG9yZXMgZmlyc3QgYXR0YWNobWVudCBpZCBpbiBtZXNzYWdpbmcubWVzc2FnZS5tZWRpYV91cmwgKFVVSUQpLCBub3QgYSBwdWJsaWMgVVJMLlxyXG4gICAgY29uc3QgbWVkaWFBc0lkID0gU3RyaW5nKGJhc2UubWVkaWFfdXJsIHx8ICcnKS50cmltKCk7XHJcbiAgICBpZiAoXHJcbiAgICAgIG1lZGlhQXNJZCAmJlxyXG4gICAgICAhbWVkaWFBc0lkLnN0YXJ0c1dpdGgoJ3snKSAmJlxyXG4gICAgICAhbWVkaWFBc0lkLnN0YXJ0c1dpdGgoJ1snKSAmJlxyXG4gICAgICAhbWVkaWFBc0lkLnN0YXJ0c1dpdGgoJ2h0dHA6Ly8nKSAmJlxyXG4gICAgICAhbWVkaWFBc0lkLnN0YXJ0c1dpdGgoJ2h0dHBzOi8vJykgJiZcclxuICAgICAgIW1lZGlhQXNJZC5zdGFydHNXaXRoKCdkYXRhOicpXHJcbiAgICApIHtcclxuICAgICAgcHVzaElkKG1lZGlhQXNJZCk7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgY29udGVudFRyaW0gPSBTdHJpbmcoYmFzZS5jb250ZW50IHx8ICcnKS50cmltKCk7XHJcbiAgICBpZiAoYXR0YWNobWVudElkcy5sZW5ndGggPT09IDAgJiYgdXVpZFJlLnRlc3QoY29udGVudFRyaW0pKSB7XHJcbiAgICAgIGF0dGFjaG1lbnRJZHMucHVzaChjb250ZW50VHJpbSk7XHJcbiAgICB9XHJcbiAgICAvLyBTb21lIEFQSXMgc3RvcmUgc3RvcmFnZSAvIGF0dGFjaG1lbnQgaWQgYXMgbnVtZXJpYyBzdHJpbmcgaW4gY29udGVudCBmb3IgRklMRSBtZXNzYWdlcy5cclxuICAgIGlmIChcclxuICAgICAgYXR0YWNobWVudElkcy5sZW5ndGggPT09IDAgJiZcclxuICAgICAgL15cXGQrJC8udGVzdChjb250ZW50VHJpbSkgJiZcclxuICAgICAgKGJhc2UubWVzc2FnZV90eXBlID09PSAnRklMRScgfHwgYmFzZS5tZXNzYWdlX3R5cGUgPT09ICdJTUFHRScpXHJcbiAgICApIHtcclxuICAgICAgYXR0YWNobWVudElkcy5wdXNoKGNvbnRlbnRUcmltKTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBmaWxlbmFtZXM6IHN0cmluZ1tdID0gdG9TdHJpbmdBcnJheShyYXc/LmZpbGVuYW1lcykubGVuZ3RoXHJcbiAgICAgID8gdG9TdHJpbmdBcnJheShyYXc/LmZpbGVuYW1lcylcclxuICAgICAgOiByYXc/LmZpbGVuYW1lXHJcbiAgICAgID8gW1N0cmluZyhyYXcuZmlsZW5hbWUpXVxyXG4gICAgICA6IHJhdz8uZmlsZV9uYW1lXHJcbiAgICAgID8gW1N0cmluZyhyYXcuZmlsZV9uYW1lKV1cclxuICAgICAgOiBiYXNlLmNvbnRlbnQgJiYgIXV1aWRSZS50ZXN0KGNvbnRlbnRUcmltKVxyXG4gICAgICA/IFtTdHJpbmcoYmFzZS5jb250ZW50KV1cclxuICAgICAgOiBbXTtcclxuXHJcbiAgICBjb25zdCBtaW1lVHlwZXM6IHN0cmluZ1tdID0gdG9TdHJpbmdBcnJheShyYXc/Lm1pbWVfdHlwZXMpLmxlbmd0aFxyXG4gICAgICA/IHRvU3RyaW5nQXJyYXkocmF3Py5taW1lX3R5cGVzKVxyXG4gICAgICA6IHRvU3RyaW5nQXJyYXkocmF3Py5taW1lVHlwZXMpO1xyXG5cclxuICAgIGlmIChhdHRhY2htZW50SWRzLmxlbmd0aCA+IDAgfHwgZmlsZW5hbWVzLmxlbmd0aCA+IDApIHtcclxuICAgICAgY29uc3QgZmFsbGJhY2tNaW1lID0gcmF3Py5taW1lX3R5cGUgPz8gcmF3Py5hdHRhY2htZW50X21pbWVfdHlwZTtcclxuICAgICAgY29uc3QgdXJsRmFsbGJhY2sgPSByYXc/LmZpbGVfdXJsID8/IHJhdz8udXJsID8/IHJhdz8ubWVkaWFfdXJsID8/IHJhdz8ubWVkaWFVcmw7XHJcbiAgICAgIGNvbnN0IGlkcyA9IGF0dGFjaG1lbnRJZHMubGVuZ3RoID4gMCA/IGF0dGFjaG1lbnRJZHMgOiBbXTtcclxuICAgICAgY29uc3QgYnVpbHQ6IEF0dGFjaG1lbnRbXSA9IGlkcy5tYXAoKGlkLCBpZHgpID0+ICh7XHJcbiAgICAgICAgZmlsZV9pZDogaWQsXHJcbiAgICAgICAgZmlsZW5hbWU6IGZpbGVuYW1lc1tpZHhdIHx8IGZpbGVuYW1lc1swXSB8fCBgQXR0YWNobWVudCAke2lkeCArIDF9YCxcclxuICAgICAgICBtaW1lX3R5cGU6IG1pbWVUeXBlc1tpZHhdIHx8IGZhbGxiYWNrTWltZSxcclxuICAgICAgICB1cmw6IHVybEZhbGxiYWNrLFxyXG4gICAgICB9KSk7XHJcblxyXG4gICAgICAvLyBGaWxlbmFtZSBvbmx5ICsgZGlyZWN0IFVSTCAobm8gc3RvcmFnZSBpZCk6IHN0aWxsIHJlbmRlcmFibGUgYXMgPGltZyBzcmM+LlxyXG4gICAgICBpZiAoXHJcbiAgICAgICAgYnVpbHQubGVuZ3RoID09PSAwICYmXHJcbiAgICAgICAgZmlsZW5hbWVzLmxlbmd0aCA+IDAgJiZcclxuICAgICAgICB1cmxGYWxsYmFjayAmJlxyXG4gICAgICAgIFN0cmluZyh1cmxGYWxsYmFjaykubWF0Y2goL15odHRwcz86XFwvXFwvL2kpXHJcbiAgICAgICkge1xyXG4gICAgICAgIGJ1aWx0LnB1c2goe1xyXG4gICAgICAgICAgZmlsZV9pZDogJycsXHJcbiAgICAgICAgICBmaWxlbmFtZTogZmlsZW5hbWVzWzBdLFxyXG4gICAgICAgICAgbWltZV90eXBlOiBmYWxsYmFja01pbWUsXHJcbiAgICAgICAgICB1cmw6IFN0cmluZyh1cmxGYWxsYmFjayksXHJcbiAgICAgICAgfSk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGJ1aWx0LmZvckVhY2goKGF0dGFjaG1lbnQpID0+IGFkZEF0dGFjaG1lbnQoYXR0YWNobWVudCkpO1xyXG4gICAgfVxyXG5cclxuICAgIGlmIChub3JtYWxpemVkQXR0YWNobWVudHMubGVuZ3RoID4gMCkge1xyXG4gICAgICByZXR1cm4geyAuLi5iYXNlLCBhdHRhY2htZW50czogbm9ybWFsaXplZEF0dGFjaG1lbnRzIH07XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIGJhc2U7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHBsYXlTb2Z0Tm90aWZpY2F0aW9uU291bmQoZm9yY2UgPSBmYWxzZSk6IHZvaWQge1xyXG4gICAgaWYgKCFmb3JjZSAmJiB0aGlzLm5vdGlmaWNhdGlvbnNNdXRlZCQudmFsdWUpIHJldHVybjtcclxuICAgIGNvbnN0IHZvbHVtZSA9IE1hdGgubWF4KDAsIE1hdGgubWluKDEsIHRoaXMubm90aWZpY2F0aW9uVm9sdW1lJC52YWx1ZSkpO1xyXG4gICAgaWYgKHZvbHVtZSA8PSAwICYmICFmb3JjZSkgcmV0dXJuO1xyXG5cclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IEF1ZGlvQ3R4ID0gKHdpbmRvdyBhcyBhbnkpLkF1ZGlvQ29udGV4dCB8fCAod2luZG93IGFzIGFueSkud2Via2l0QXVkaW9Db250ZXh0O1xyXG4gICAgICBpZiAoIUF1ZGlvQ3R4KSByZXR1cm47XHJcbiAgICAgIGNvbnN0IGN0eCA9IG5ldyBBdWRpb0N0eCgpO1xyXG4gICAgICBjb25zdCBtYXN0ZXIgPSBjdHguY3JlYXRlR2FpbigpO1xyXG4gICAgICBjb25zdCBvdXRwdXRHYWluID0gTWF0aC5tYXgodm9sdW1lLCAwLjAwMSk7XHJcbiAgICAgIG1hc3Rlci5nYWluLnNldFZhbHVlQXRUaW1lKDAuMDAwMSwgY3R4LmN1cnJlbnRUaW1lKTtcclxuICAgICAgbWFzdGVyLmdhaW4uZXhwb25lbnRpYWxSYW1wVG9WYWx1ZUF0VGltZShvdXRwdXRHYWluLCBjdHguY3VycmVudFRpbWUgKyAwLjAxNSk7XHJcbiAgICAgIG1hc3Rlci5nYWluLmV4cG9uZW50aWFsUmFtcFRvVmFsdWVBdFRpbWUoMC4wMDAxLCBjdHguY3VycmVudFRpbWUgKyAwLjQyKTtcclxuICAgICAgbWFzdGVyLmNvbm5lY3QoY3R4LmRlc3RpbmF0aW9uKTtcclxuXHJcbiAgICAgIGNvbnN0IHBsYXlUb25lID0gKGZyZXF1ZW5jeTogbnVtYmVyLCBzdGFydDogbnVtYmVyLCBkdXJhdGlvbjogbnVtYmVyKSA9PiB7XHJcbiAgICAgICAgY29uc3Qgb3NjID0gY3R4LmNyZWF0ZU9zY2lsbGF0b3IoKTtcclxuICAgICAgICBjb25zdCBnYWluID0gY3R4LmNyZWF0ZUdhaW4oKTtcclxuICAgICAgICBvc2MudHlwZSA9ICdzaW5lJztcclxuICAgICAgICBvc2MuZnJlcXVlbmN5LnNldFZhbHVlQXRUaW1lKGZyZXF1ZW5jeSwgY3R4LmN1cnJlbnRUaW1lICsgc3RhcnQpO1xyXG4gICAgICAgIGdhaW4uZ2Fpbi5zZXRWYWx1ZUF0VGltZSgwLjAwMDEsIGN0eC5jdXJyZW50VGltZSArIHN0YXJ0KTtcclxuICAgICAgICBnYWluLmdhaW4uZXhwb25lbnRpYWxSYW1wVG9WYWx1ZUF0VGltZSgwLjU1LCBjdHguY3VycmVudFRpbWUgKyBzdGFydCArIDAuMDI1KTtcclxuICAgICAgICBnYWluLmdhaW4uZXhwb25lbnRpYWxSYW1wVG9WYWx1ZUF0VGltZSgwLjAwMDEsIGN0eC5jdXJyZW50VGltZSArIHN0YXJ0ICsgZHVyYXRpb24pO1xyXG4gICAgICAgIG9zYy5jb25uZWN0KGdhaW4pO1xyXG4gICAgICAgIGdhaW4uY29ubmVjdChtYXN0ZXIpO1xyXG4gICAgICAgIG9zYy5zdGFydChjdHguY3VycmVudFRpbWUgKyBzdGFydCk7XHJcbiAgICAgICAgb3NjLnN0b3AoY3R4LmN1cnJlbnRUaW1lICsgc3RhcnQgKyBkdXJhdGlvbiArIDAuMDIpO1xyXG4gICAgICB9O1xyXG5cclxuICAgICAgcGxheVRvbmUoNzQwLCAwLCAwLjE4KTtcclxuICAgICAgcGxheVRvbmUoOTg4LCAwLjEyLCAwLjIyKTtcclxuICAgICAgd2luZG93LnNldFRpbWVvdXQoKCkgPT4gY3R4LmNsb3NlKCkuY2F0Y2goKCkgPT4ge30pLCA2MDApO1xyXG4gICAgfSBjYXRjaCB7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHBsYXlOb3RpZmljYXRpb25Tb3VuZCgpOiB2b2lkIHtcclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IGF1ZGlvID0gbmV3IEF1ZGlvKCdkYXRhOmF1ZGlvL3dhdjtiYXNlNjQsVWtsR1Jub0dBQUJYUVZaRlptMTBJQkFBQUFBQkFBRUFRQjhBQUVBZkFBQUJBQWdBWkdGMFlRb0dBQUNCaFlxRmJGMWZkSml2ckpCaE5qVmdvZERicTJFY0JqK2EyL0xEY2lVRkxJSE84dGlKTndnWmFMdnQ1NTlORUF4UXArUHd0bU1jQmppUjEvTE1lU3dGSkhmSDhOMlFRQW9VWHJUcDY2aFZGQXBHbitEeXZtd2hCU3VCenZMWmlUWUlHR1M1N09paFVCRUxUS1hoOGJsbEhBVTJqZFh6em4wdkJTaCt6UExhaXpzS0ZHQ3o2T3lyV0JRTFNLRGY4c0Z1SXdVdWc4L3kyNGszQ0Joa3Urem9vVkFSQzB5bDRmRzVaUndGTm8zVjg4NTlMd1VvZnN6eTJvczdDaFJncytqc3ExZ1ZDMGlnMy9MQmJpTUZMb0xQOHR1Sk53Z1laTHZzNktGUUVRdE1wZUh4dVdVY0JUYU4xZlBPZlM4RktIN004dHFMT3dvVVlMUG83S3RZRlF0SW9OL3l3VzRqQlM2Q3ovTGJpVGNJR0dTNzdPaWhVQkVMVEtYaDhibGxIQVUyamRYenpuMHZCU2grelBMYWl6c0tGR0N6Nk95cldCVUxTS0RmOHNGdUl3VXVncy95MjRrM0NCaGt1K3pvb1ZBUkMweWw0Zkc1WlJ3Rk5vM1Y4ODU5THdVb2Zzenkyb3M3Q2hSZ3MranNxMWdWQzBpZzMvTEJiaU1GTG9MUDh0dUpOd2dZWkx2czZLRlFFUXRNcGVIeHVXVWNCVGFOMWZQT2ZTOEZLSDdNOHRxTE93b1VZTFBvN0t0WUZRdElvTi95d1c0akJTNkN6L0xiaVRjSUdHUzc3T2loVUJFTFRLWGg4YmxsSEFVMmpkWHp6bjB2QlNoK3pQTGFpenNLRkdDejZPeXJXQlVMU0tEZjhzRnVJd1V1Z3MveTI0azNDQmhrdSt6b29WQVJDMHlsNGZHNVpSd0ZObzNWODg1OUx3VW9mc3p5Mm9zN0NoUmdzK2pzcTFnVkMwaWczL0xCYmlNRkxvTFA4dHVKTndnWVpMdnM2S0ZRRVF0TXBlSHh1V1VjQlRhTjFmUE9mUzhGS0g3TTh0cUxPd29VWUxQbzdLdFlGUXRJb04veXdXNGpCUzZDei9MYmlUY0lHR1M3N09paFVCRUxUS1hoOGJsbEhBVTJqZFh6em4wdkJTaCt6UExhaXpzS0ZHQ3o2T3lyV0JVTFNLRGY4c0Z1SXdVdWdzL3kyNGszQ0Joa3Urem9vVkFSQzB5bDRmRzVaUndGTm8zVjg4NTlMd1VvZnN6eTJvczdDaFJncytqc3ExZ1ZDMGlnMy9MQmJpTUZMb0xQOHR1Sk53Z1laTHZzNktGUUVRdE1wZUh4dVdVY0JUYU4xZlBPZlM4RktIN004dHFMT3dvVVlMUG83S3RZRlF0SW9OL3l3VzRqQlM2Q3ovTGJpVGNJR0dTNzdPaWhVQkVMVEtYaDhibGxIQVUyamRYenpuMHZCU2grelBMYWl6c0tGR0N6Nk95cldCVUxTS0RmOHNGdUl3VXVncy95MjRrM0NCaGt1K3pvb1ZBUkMweWw0Zkc1WlJ3Rk5vM1Y4ODU5THdVb2Zzenkyb3M3Q2hSZ3MranNxMWdWQzBpZzMvTEJiaU1GTG9MUDh0dUpOd2dZWkx2czZLRlFFUXRNcGVIeHVXVWNCVGFOMWZQT2ZTOEZLSDdNOHRxTE93b1VZTFBvN0t0WUZRdElvTi95d1c0akJTNkN6L0xiaVRjSUdHUzc3T2loVUJFTFRLWGg4YmxsSEFVMmpkWHp6bjB2QlNoK3pQTGFpenNLRkdDejZPeXJXQlVMU0tEZjhzRnVJd1V1Z3MveTI0azNDQmhrdSt6b29WQVJDMHlsNGZHNVpSd0ZObzNWODg1OUx3VW9mc3p5Jyk7XHJcbiAgICAgIGF1ZGlvLnZvbHVtZSA9IDAuMztcclxuICAgICAgYXVkaW8ucGxheSgpLmNhdGNoKCgpID0+IHt9KTtcclxuICAgIH0gY2F0Y2gge1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSByZWNhbGNVbnJlYWQoaXRlbXM6IEluYm94SXRlbVtdKTogdm9pZCB7XHJcbiAgICBjb25zdCB0b3RhbCA9IGl0ZW1zLnJlZHVjZSgoc3VtLCBpKSA9PiBzdW0gKyBOdW1iZXIoaS51bnJlYWRfY291bnQgfHwgMCksIDApO1xyXG4gICAgdGhpcy50b3RhbFVucmVhZCQubmV4dCh0b3RhbCk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGdldENvbnRhY3ROYW1lQnlJZChjb250YWN0SWQ6IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgICBjb25zdCBpZCA9IFN0cmluZyhjb250YWN0SWQpO1xyXG4gICAgaWYgKGlkID09PSBTdHJpbmcodGhpcy5hdXRoLmNvbnRhY3RJZCB8fCAnJykgJiYgdGhpcy5hdXRoLmN1cnJlbnRDb250YWN0KSB7XHJcbiAgICAgIHJldHVybiBnZXRDb250YWN0RGlzcGxheU5hbWUodGhpcy5hdXRoLmN1cnJlbnRDb250YWN0KTtcclxuICAgIH1cclxuICAgIGNvbnN0IGNvbnRhY3QgPSB0aGlzLnZpc2libGVDb250YWN0cyQudmFsdWUuZmluZCgoYykgPT4gU3RyaW5nKGMuY29udGFjdF9pZCkgPT09IGlkKTtcclxuICAgIHJldHVybiBjb250YWN0ID8gZ2V0Q29udGFjdERpc3BsYXlOYW1lKGNvbnRhY3QpIDogYFVzZXIgJHtpZH1gO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBkZXRlY3RHcm91cFJlbW92YWxGb3JDdXJyZW50VXNlcihtZXNzYWdlOiBNZXNzYWdlKTogdm9pZCB7XHJcbiAgICBjb25zdCBjb250ZW50ID0gU3RyaW5nKG1lc3NhZ2UuY29udGVudCB8fCAnJykudHJpbSgpO1xyXG4gICAgY29uc3QgbWF0Y2ggPSBjb250ZW50Lm1hdGNoKC9eKC4rKSByZW1vdmVkICguKykgZnJvbSB0aGUgZ3JvdXAkLyk7XHJcbiAgICBpZiAoIW1hdGNoKSByZXR1cm47XHJcblxyXG4gICAgY29uc3QgbXlDb250YWN0ID0gdGhpcy5hdXRoLmN1cnJlbnRDb250YWN0O1xyXG4gICAgY29uc3QgbXlOYW1lID0gbXlDb250YWN0ID8gZ2V0Q29udGFjdERpc3BsYXlOYW1lKG15Q29udGFjdCkudHJpbSgpLnRvTG93ZXJDYXNlKCkgOiAnJztcclxuICAgIGNvbnN0IHJlbW92ZWROYW1lID0gbWF0Y2hbMl0/LnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xyXG4gICAgaWYgKCFteU5hbWUgfHwgcmVtb3ZlZE5hbWUgIT09IG15TmFtZSkgcmV0dXJuO1xyXG5cclxuICAgIGNvbnN0IGNvbnZJZCA9IFN0cmluZyhtZXNzYWdlLmNvbnZlcnNhdGlvbl9pZCB8fCAnJyk7XHJcbiAgICBpZiAoY29udklkKSB7XHJcbiAgICAgIHRoaXMubWFya0dyb3VwUmVtb3ZlZChjb252SWQpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBoeWRyYXRlUmVhY3Rpb25zRm9yQ29udmVyc2F0aW9uKGNvbnZlcnNhdGlvbklkOiBzdHJpbmcsIG1lc3NhZ2VzOiBNZXNzYWdlW10sIG9ubHlNaXNzaW5nID0gZmFsc2UpOiB2b2lkIHtcclxuICAgIGNvbnN0IGZldGNoYWJsZSA9IG1lc3NhZ2VzLmZpbHRlcigobSkgPT4ge1xyXG4gICAgICBpZiAoIW0ubWVzc2FnZV9pZCB8fCBTdHJpbmcobS5tZXNzYWdlX2lkKS5zdGFydHNXaXRoKCd0ZW1wLScpKSByZXR1cm4gZmFsc2U7XHJcbiAgICAgIGlmICghb25seU1pc3NpbmcpIHJldHVybiB0cnVlO1xyXG4gICAgICByZXR1cm4gIUFycmF5LmlzQXJyYXkobS5yZWFjdGlvbnMpIHx8IG0ucmVhY3Rpb25zLmxlbmd0aCA9PT0gMDtcclxuICAgIH0pO1xyXG4gICAgaWYgKCFmZXRjaGFibGUubGVuZ3RoKSByZXR1cm47XHJcblxyXG4gICAgY29uc3Qgam9icyA9IGZldGNoYWJsZS5tYXAoKG0pID0+XHJcbiAgICAgIHRoaXMuYXBpLmdldFJlYWN0aW9ucyhtLm1lc3NhZ2VfaWQpLnBpcGUoXHJcbiAgICAgICAgbWFwKChyb3dzKSA9PiAoeyBtZXNzYWdlSWQ6IG0ubWVzc2FnZV9pZCwgcmVhY3Rpb25zOiB0aGlzLm5vcm1hbGl6ZVJlYWN0aW9uUm93cyhyb3dzKSB9KSksXHJcbiAgICAgICAgY2F0Y2hFcnJvcigoKSA9PiBvZih7IG1lc3NhZ2VJZDogbS5tZXNzYWdlX2lkLCByZWFjdGlvbnM6IFtdIH0pKVxyXG4gICAgICApXHJcbiAgICApO1xyXG5cclxuICAgIGZvcmtKb2luKGpvYnMpLnN1YnNjcmliZSgocmVzdWx0cykgPT4ge1xyXG4gICAgICBjb25zdCBtYXAgPSBuZXcgTWFwKHRoaXMubWVzc2FnZXNNYXAkLnZhbHVlKTtcclxuICAgICAgY29uc3QgY3VycmVudCA9IFsuLi4obWFwLmdldChjb252ZXJzYXRpb25JZCkgfHwgW10pXTtcclxuICAgICAgaWYgKCFjdXJyZW50Lmxlbmd0aCkgcmV0dXJuO1xyXG5cclxuICAgICAgbGV0IGNoYW5nZWQgPSBmYWxzZTtcclxuICAgICAgZm9yIChjb25zdCByZXN1bHQgb2YgcmVzdWx0cykge1xyXG4gICAgICAgIGNvbnN0IGlkeCA9IGN1cnJlbnQuZmluZEluZGV4KChtKSA9PiBTdHJpbmcobS5tZXNzYWdlX2lkKSA9PT0gU3RyaW5nKHJlc3VsdC5tZXNzYWdlSWQpKTtcclxuICAgICAgICBpZiAoaWR4ID09PSAtMSkgY29udGludWU7XHJcbiAgICAgICAgY3VycmVudFtpZHhdID0geyAuLi5jdXJyZW50W2lkeF0sIHJlYWN0aW9uczogcmVzdWx0LnJlYWN0aW9ucyB9O1xyXG4gICAgICAgIGNoYW5nZWQgPSB0cnVlO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBpZiAoY2hhbmdlZCkge1xyXG4gICAgICAgIG1hcC5zZXQoY29udmVyc2F0aW9uSWQsIGN1cnJlbnQpO1xyXG4gICAgICAgIHRoaXMubWVzc2FnZXNNYXAkLm5leHQobWFwKTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHJlZnJlc2hNZXNzYWdlUmVhY3Rpb25zKG1lc3NhZ2VJZDogc3RyaW5nKTogdm9pZCB7XHJcbiAgICBpZiAoIW1lc3NhZ2VJZCB8fCBTdHJpbmcobWVzc2FnZUlkKS5zdGFydHNXaXRoKCd0ZW1wLScpKSByZXR1cm47XHJcblxyXG4gICAgdGhpcy5hcGkuZ2V0UmVhY3Rpb25zKG1lc3NhZ2VJZCkuc3Vic2NyaWJlKHtcclxuICAgICAgbmV4dDogKHJvd3MpID0+IHtcclxuICAgICAgICBjb25zdCBub3JtYWxpemVkID0gdGhpcy5ub3JtYWxpemVSZWFjdGlvblJvd3Mocm93cyk7XHJcbiAgICAgICAgY29uc3QgbWFwID0gbmV3IE1hcCh0aGlzLm1lc3NhZ2VzTWFwJC52YWx1ZSk7XHJcbiAgICAgICAgbGV0IGNoYW5nZWQgPSBmYWxzZTtcclxuXHJcbiAgICAgICAgZm9yIChjb25zdCBbY29udmVyc2F0aW9uSWQsIG1zZ3NdIG9mIG1hcC5lbnRyaWVzKCkpIHtcclxuICAgICAgICAgIGNvbnN0IGlkeCA9IG1zZ3MuZmluZEluZGV4KChtKSA9PiBTdHJpbmcobS5tZXNzYWdlX2lkKSA9PT0gU3RyaW5nKG1lc3NhZ2VJZCkpO1xyXG4gICAgICAgICAgaWYgKGlkeCA9PT0gLTEpIGNvbnRpbnVlO1xyXG4gICAgICAgICAgY29uc3QgbmV4dE1zZ3MgPSBbLi4ubXNnc107XHJcbiAgICAgICAgICBuZXh0TXNnc1tpZHhdID0geyAuLi5uZXh0TXNnc1tpZHhdLCByZWFjdGlvbnM6IG5vcm1hbGl6ZWQgfTtcclxuICAgICAgICAgIG1hcC5zZXQoY29udmVyc2F0aW9uSWQsIG5leHRNc2dzKTtcclxuICAgICAgICAgIGNoYW5nZWQgPSB0cnVlO1xyXG4gICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoY2hhbmdlZCkge1xyXG4gICAgICAgICAgdGhpcy5tZXNzYWdlc01hcCQubmV4dChtYXApO1xyXG4gICAgICAgIH1cclxuICAgICAgfSxcclxuICAgICAgZXJyb3I6ICgpID0+IHt9LFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIG5vcm1hbGl6ZVJlYWN0aW9uUm93cyhyb3dzOiBhbnlbXSk6IGFueVtdIHtcclxuICAgIGNvbnN0IGJ5RW1vamkgPSBuZXcgTWFwPHN0cmluZywgeyBlbW9qaTogc3RyaW5nOyBjb3VudDogbnVtYmVyOyBoYXNSZWFjdGVkOiBib29sZWFuOyByZWFjdG9yczogc3RyaW5nW10gfT4oKTtcclxuICAgIGNvbnN0IG15Q29udGFjdElkID0gU3RyaW5nKHRoaXMuYXV0aC5jb250YWN0SWQgfHwgJycpO1xyXG4gICAgY29uc3QgY29udGFjdHMgPSB0aGlzLnZpc2libGVDb250YWN0cyQudmFsdWU7XHJcbiAgICBjb25zdCBwYXJzZVJlYWN0b3JzID0gKHZhbHVlOiBhbnkpOiBhbnlbXSA9PiB7XHJcbiAgICAgIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkgcmV0dXJuIHZhbHVlO1xyXG4gICAgICBpZiAodmFsdWUgJiYgdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JykgcmV0dXJuIFt2YWx1ZV07XHJcbiAgICAgIGlmICh0eXBlb2YgdmFsdWUgIT09ICdzdHJpbmcnIHx8ICF2YWx1ZS50cmltKCkpIHJldHVybiBbXTtcclxuXHJcbiAgICAgIGNvbnN0IHRyaW1tZWQgPSB2YWx1ZS50cmltKCk7XHJcbiAgICAgIGlmICh0cmltbWVkLnN0YXJ0c1dpdGgoJ3snKSB8fCB0cmltbWVkLnN0YXJ0c1dpdGgoJ1snKSkge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICBjb25zdCBwYXJzZWQgPSBKU09OLnBhcnNlKHRyaW1tZWQpO1xyXG4gICAgICAgICAgcmV0dXJuIEFycmF5LmlzQXJyYXkocGFyc2VkKSA/IHBhcnNlZCA6IFtwYXJzZWRdO1xyXG4gICAgICAgIH0gY2F0Y2gge1xyXG4gICAgICAgICAgcmV0dXJuIFt0cmltbWVkXTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIHJldHVybiB0cmltbWVkLnNwbGl0KCcsJykubWFwKCh4OiBzdHJpbmcpID0+IHgudHJpbSgpKS5maWx0ZXIoQm9vbGVhbik7XHJcbiAgICB9O1xyXG5cclxuICAgIGNvbnN0IGRpc3BsYXlOYW1lRm9yUmVhY3RvciA9IChyZWFjdG9yOiBhbnkpOiBzdHJpbmcgPT4ge1xyXG4gICAgICBpZiAocmVhY3RvciA9PSBudWxsKSByZXR1cm4gJyc7XHJcbiAgICAgIGlmICh0eXBlb2YgcmVhY3RvciA9PT0gJ3N0cmluZycpIHtcclxuICAgICAgICBjb25zdCB0cmltbWVkID0gcmVhY3Rvci50cmltKCk7XHJcbiAgICAgICAgaWYgKCF0cmltbWVkKSByZXR1cm4gJyc7XHJcbiAgICAgICAgaWYgKHRyaW1tZWQuc3RhcnRzV2l0aCgneycpIHx8IHRyaW1tZWQuc3RhcnRzV2l0aCgnWycpKSB7XHJcbiAgICAgICAgICBjb25zdCBwYXJzZWQgPSBwYXJzZVJlYWN0b3JzKHRyaW1tZWQpO1xyXG4gICAgICAgICAgcmV0dXJuIHBhcnNlZC5tYXAoZGlzcGxheU5hbWVGb3JSZWFjdG9yKS5maWx0ZXIoQm9vbGVhbikuam9pbignLCAnKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHRyaW1tZWQ7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGNvbnN0IHJlYWN0b3JJZCA9IFN0cmluZyhyZWFjdG9yPy5jb250YWN0X2lkID8/IHJlYWN0b3I/LmNvbnRhY3RJZCA/PyByZWFjdG9yPy5pZCA/PyAnJykudHJpbSgpO1xyXG4gICAgICBpZiAocmVhY3RvcklkICYmIHJlYWN0b3JJZCA9PT0gbXlDb250YWN0SWQpIHJldHVybiAnWW91JztcclxuXHJcbiAgICAgIGNvbnN0IGV4cGxpY2l0TmFtZSA9IFN0cmluZyhcclxuICAgICAgICByZWFjdG9yPy51c2VybmFtZSA/P1xyXG4gICAgICAgIHJlYWN0b3I/Lm5hbWUgPz9cclxuICAgICAgICByZWFjdG9yPy5kaXNwbGF5X25hbWUgPz9cclxuICAgICAgICByZWFjdG9yPy5kaXNwbGF5TmFtZSA/P1xyXG4gICAgICAgIHJlYWN0b3I/LmVtYWlsID8/XHJcbiAgICAgICAgJydcclxuICAgICAgKS50cmltKCk7XHJcbiAgICAgIGlmIChleHBsaWNpdE5hbWUpIHJldHVybiBleHBsaWNpdE5hbWU7XHJcblxyXG4gICAgICBpZiAocmVhY3RvcklkKSB7XHJcbiAgICAgICAgY29uc3QgY29udGFjdCA9IGNvbnRhY3RzLmZpbmQoYyA9PiBTdHJpbmcoYy5jb250YWN0X2lkKSA9PT0gcmVhY3RvcklkKTtcclxuICAgICAgICByZXR1cm4gY29udGFjdCA/IGdldENvbnRhY3REaXNwbGF5TmFtZShjb250YWN0KSA6IGBVc2VyICR7cmVhY3RvcklkfWA7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIHJldHVybiAnJztcclxuICAgIH07XHJcblxyXG4gICAgZm9yIChjb25zdCByb3cgb2Ygcm93cyB8fCBbXSkge1xyXG4gICAgICBjb25zdCBlbW9qaSA9IFN0cmluZyhyb3c/LmVtb2ppIHx8ICcnKS50cmltKCk7XHJcbiAgICAgIGlmICghZW1vamkpIGNvbnRpbnVlO1xyXG5cclxuICAgICAgY29uc3QgY29udGFjdElkID0gU3RyaW5nKHJvdz8uY29udGFjdF9pZCA/PyByb3c/LmNvbnRhY3RJZCA/PyAnJyk7XHJcbiAgICAgIGNvbnN0IGV4cGxpY2l0SGFzUmVhY3RlZCA9IHJvdz8uaGFzUmVhY3RlZCA/PyByb3c/Lmhhc19yZWFjdGVkO1xyXG4gICAgICBjb25zdCBoYXNSZWFjdGVkID0gZXhwbGljaXRIYXNSZWFjdGVkID09PSB0cnVlIHx8IChjb250YWN0SWQgJiYgY29udGFjdElkID09PSBteUNvbnRhY3RJZCk7XHJcblxyXG4gICAgICBjb25zdCByYXdSZWFjdG9ycyA9XHJcbiAgICAgICAgcm93Py5yZWFjdG9ycyA/P1xyXG4gICAgICAgIHJvdz8ucmVhY3Rvcl9uYW1lcyA/P1xyXG4gICAgICAgIHJvdz8ucmVhY3Rvck5hbWVzID8/XHJcbiAgICAgICAgcm93Py5yZWFjdGVkX2J5ID8/XHJcbiAgICAgICAgcm93Py5yZWFjdGVkQnkgPz9cclxuICAgICAgICByb3c/LnVzZXJzID8/XHJcbiAgICAgICAgW107XHJcbiAgICAgIGNvbnN0IHJlYWN0b3JSb3dzID0gcGFyc2VSZWFjdG9ycyhyYXdSZWFjdG9ycyk7XHJcbiAgICAgIGNvbnN0IGNvdW50RnJvbVJvdyA9IE51bWJlcihyb3c/LmNvdW50ID8/IHJvdz8ucmVhY3Rpb25fY291bnQgPz8gcm93Py5yZWFjdGlvbkNvdW50ID8/IHJlYWN0b3JSb3dzLmxlbmd0aCA/PyAwKTtcclxuICAgICAgY29uc3QgZXhpc3RpbmcgPSBieUVtb2ppLmdldChlbW9qaSkgfHwgeyBlbW9qaSwgY291bnQ6IDAsIGhhc1JlYWN0ZWQ6IGZhbHNlLCByZWFjdG9yczogW10gfTtcclxuXHJcbiAgICAgIC8vIFNvbWUgQVBJcyByZXR1cm4gb25lIHJvdyBwZXIgcmVhY3Rpb247IHNvbWUgcmV0dXJuIHByZS1hZ2dyZWdhdGVkIGNvdW50LlxyXG4gICAgICBleGlzdGluZy5jb3VudCArPSBjb3VudEZyb21Sb3cgPiAwID8gY291bnRGcm9tUm93IDogMTtcclxuICAgICAgZXhpc3RpbmcuaGFzUmVhY3RlZCA9IGV4aXN0aW5nLmhhc1JlYWN0ZWQgfHwgISFoYXNSZWFjdGVkO1xyXG5cclxuICAgICAgLy8gVHJhY2sgcmVhY3RvciBkaXNwbGF5IG5hbWVzIHdoZW4gaW5kaXZpZHVhbCBjb250YWN0SWQgaXMgYXZhaWxhYmxlXHJcbiAgICAgIGlmIChjb250YWN0SWQgJiYgY291bnRGcm9tUm93IDw9IDEpIHtcclxuICAgICAgICBsZXQgbmFtZTogc3RyaW5nO1xyXG4gICAgICAgIGlmIChjb250YWN0SWQgPT09IG15Q29udGFjdElkKSB7XHJcbiAgICAgICAgICBuYW1lID0gJ1lvdSc7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIGNvbnN0IGNvbnRhY3QgPSBjb250YWN0cy5maW5kKGMgPT4gU3RyaW5nKGMuY29udGFjdF9pZCkgPT09IGNvbnRhY3RJZCk7XHJcbiAgICAgICAgICBuYW1lID0gY29udGFjdCA/IGdldENvbnRhY3REaXNwbGF5TmFtZShjb250YWN0KSA6IGBVc2VyICR7Y29udGFjdElkfWA7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICghZXhpc3RpbmcucmVhY3RvcnMuaW5jbHVkZXMobmFtZSkpIHtcclxuICAgICAgICAgIGV4aXN0aW5nLnJlYWN0b3JzLnB1c2gobmFtZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcblxyXG4gICAgICBmb3IgKGNvbnN0IHJlYWN0b3Igb2YgcmVhY3RvclJvd3MpIHtcclxuICAgICAgICBjb25zdCByZWFjdG9ySWQgPSBTdHJpbmcoXHJcbiAgICAgICAgICB0eXBlb2YgcmVhY3RvciA9PT0gJ29iamVjdCdcclxuICAgICAgICAgICAgPyByZWFjdG9yPy5jb250YWN0X2lkID8/IHJlYWN0b3I/LmNvbnRhY3RJZCA/PyByZWFjdG9yPy5pZCA/PyAnJ1xyXG4gICAgICAgICAgICA6ICcnXHJcbiAgICAgICAgKS50cmltKCk7XHJcbiAgICAgICAgY29uc3QgbmFtZSA9IGRpc3BsYXlOYW1lRm9yUmVhY3RvcihyZWFjdG9yKTtcclxuICAgICAgICBpZiAocmVhY3RvcklkICYmIHJlYWN0b3JJZCA9PT0gbXlDb250YWN0SWQpIHtcclxuICAgICAgICAgIGV4aXN0aW5nLmhhc1JlYWN0ZWQgPSB0cnVlO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAobmFtZSAmJiAhZXhpc3RpbmcucmVhY3RvcnMuaW5jbHVkZXMobmFtZSkpIHtcclxuICAgICAgICAgIGV4aXN0aW5nLnJlYWN0b3JzLnB1c2gobmFtZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcblxyXG4gICAgICBjb25zdCBkaXJlY3ROYW1lID0gU3RyaW5nKFxyXG4gICAgICAgIHJvdz8ucmVhY3Rvcl9uYW1lID8/XHJcbiAgICAgICAgcm93Py5yZWFjdG9yTmFtZSA/P1xyXG4gICAgICAgIHJvdz8uY29udGFjdF9uYW1lID8/XHJcbiAgICAgICAgcm93Py5jb250YWN0TmFtZSA/P1xyXG4gICAgICAgIHJvdz8udXNlcm5hbWUgPz9cclxuICAgICAgICByb3c/LmVtYWlsID8/XHJcbiAgICAgICAgJydcclxuICAgICAgKS50cmltKCk7XHJcbiAgICAgIGlmIChkaXJlY3ROYW1lICYmICFleGlzdGluZy5yZWFjdG9ycy5pbmNsdWRlcyhkaXJlY3ROYW1lKSkge1xyXG4gICAgICAgIGV4aXN0aW5nLnJlYWN0b3JzLnB1c2goY29udGFjdElkID09PSBteUNvbnRhY3RJZCA/ICdZb3UnIDogZGlyZWN0TmFtZSk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGJ5RW1vamkuc2V0KGVtb2ppLCBleGlzdGluZyk7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIEFycmF5LmZyb20oYnlFbW9qaS52YWx1ZXMoKSkuZmlsdGVyKChyKSA9PiByLmNvdW50ID4gMCk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGFwcGx5UmVhY3Rpb25PcHRpbWlzdGljYWxseShtZXNzYWdlSWQ6IHN0cmluZywgZW1vamk6IHN0cmluZywgYWRkOiBib29sZWFuKTogdm9pZCB7XHJcbiAgICBjb25zdCBtYXAgPSBuZXcgTWFwKHRoaXMubWVzc2FnZXNNYXAkLnZhbHVlKTtcclxuICAgIGxldCBkaWRVcGRhdGUgPSBmYWxzZTtcclxuXHJcbiAgICBmb3IgKGNvbnN0IFtjb252ZXJzYXRpb25JZCwgbXNnc10gb2YgbWFwLmVudHJpZXMoKSkge1xyXG4gICAgICBjb25zdCBpZHggPSBtc2dzLmZpbmRJbmRleCgobSkgPT4gU3RyaW5nKG0ubWVzc2FnZV9pZCkgPT09IFN0cmluZyhtZXNzYWdlSWQpKTtcclxuICAgICAgaWYgKGlkeCA9PT0gLTEpIGNvbnRpbnVlO1xyXG5cclxuICAgICAgY29uc3QgdGFyZ2V0ID0gbXNnc1tpZHhdO1xyXG4gICAgICBjb25zdCBuZXh0UmVhY3Rpb25zID0gWy4uLih0YXJnZXQucmVhY3Rpb25zIHx8IFtdKV07XHJcbiAgICAgIGNvbnN0IHJJZHggPSBuZXh0UmVhY3Rpb25zLmZpbmRJbmRleCgocikgPT4gci5lbW9qaSA9PT0gZW1vamkpO1xyXG5cclxuICAgICAgaWYgKGFkZCkge1xyXG4gICAgICAgIGlmIChySWR4ID49IDApIHtcclxuICAgICAgICAgIGNvbnN0IGN1cnJlbnQgPSBuZXh0UmVhY3Rpb25zW3JJZHhdO1xyXG4gICAgICAgICAgaWYgKCFjdXJyZW50Lmhhc1JlYWN0ZWQpIHtcclxuICAgICAgICAgICAgY29uc3QgcmVhY3RvcnMgPSBBcnJheS5pc0FycmF5KGN1cnJlbnQucmVhY3RvcnMpID8gWy4uLmN1cnJlbnQucmVhY3RvcnNdIDogW107XHJcbiAgICAgICAgICAgIGlmICghcmVhY3RvcnMuaW5jbHVkZXMoJ1lvdScpKSByZWFjdG9ycy51bnNoaWZ0KCdZb3UnKTtcclxuICAgICAgICAgICAgbmV4dFJlYWN0aW9uc1tySWR4XSA9IHtcclxuICAgICAgICAgICAgICAuLi5jdXJyZW50LFxyXG4gICAgICAgICAgICAgIGhhc1JlYWN0ZWQ6IHRydWUsXHJcbiAgICAgICAgICAgICAgY291bnQ6IE51bWJlcihjdXJyZW50LmNvdW50IHx8IDApICsgMSxcclxuICAgICAgICAgICAgICByZWFjdG9ycyxcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgbmV4dFJlYWN0aW9ucy5wdXNoKHsgZW1vamksIGNvdW50OiAxLCBoYXNSZWFjdGVkOiB0cnVlLCByZWFjdG9yczogWydZb3UnXSB9KTtcclxuICAgICAgICB9XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgaWYgKHJJZHggPj0gMCkge1xyXG4gICAgICAgICAgY29uc3QgY3VycmVudCA9IG5leHRSZWFjdGlvbnNbcklkeF07XHJcbiAgICAgICAgICBjb25zdCBuZXh0Q291bnQgPSBNYXRoLm1heChOdW1iZXIoY3VycmVudC5jb3VudCB8fCAwKSAtIChjdXJyZW50Lmhhc1JlYWN0ZWQgPyAxIDogMCksIDApO1xyXG4gICAgICAgICAgaWYgKG5leHRDb3VudCA9PT0gMCkge1xyXG4gICAgICAgICAgICBuZXh0UmVhY3Rpb25zLnNwbGljZShySWR4LCAxKTtcclxuICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIG5leHRSZWFjdGlvbnNbcklkeF0gPSB7XHJcbiAgICAgICAgICAgICAgLi4uY3VycmVudCxcclxuICAgICAgICAgICAgICBoYXNSZWFjdGVkOiBmYWxzZSxcclxuICAgICAgICAgICAgICBjb3VudDogbmV4dENvdW50LFxyXG4gICAgICAgICAgICAgIHJlYWN0b3JzOiBBcnJheS5pc0FycmF5KGN1cnJlbnQucmVhY3RvcnMpXHJcbiAgICAgICAgICAgICAgICA/IGN1cnJlbnQucmVhY3RvcnMuZmlsdGVyKChuYW1lOiBzdHJpbmcpID0+IG5hbWUgIT09ICdZb3UnKVxyXG4gICAgICAgICAgICAgICAgOiBjdXJyZW50LnJlYWN0b3JzLFxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG5cclxuICAgICAgY29uc3QgdXBkYXRlZE1zZzogTWVzc2FnZSA9IHsgLi4udGFyZ2V0LCByZWFjdGlvbnM6IG5leHRSZWFjdGlvbnMgfTtcclxuICAgICAgY29uc3QgdXBkYXRlZE1zZ3MgPSBbLi4ubXNnc107XHJcbiAgICAgIHVwZGF0ZWRNc2dzW2lkeF0gPSB1cGRhdGVkTXNnO1xyXG4gICAgICBtYXAuc2V0KGNvbnZlcnNhdGlvbklkLCB1cGRhdGVkTXNncyk7XHJcbiAgICAgIGRpZFVwZGF0ZSA9IHRydWU7XHJcbiAgICAgIGJyZWFrO1xyXG4gICAgfVxyXG5cclxuICAgIGlmIChkaWRVcGRhdGUpIHtcclxuICAgICAgdGhpcy5tZXNzYWdlc01hcCQubmV4dChtYXApO1xyXG4gICAgfVxyXG4gIH1cclxufVxyXG4iXX0=