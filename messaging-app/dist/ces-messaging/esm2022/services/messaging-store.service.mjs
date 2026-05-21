import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject, forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { getContactDisplayName, getMessageSenderName, } from '../models/messaging.models';
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
    messageTextScale$ = new BehaviorSubject(Number(localStorage.getItem('messaging_message_text_scale') ?? '1'));
    codeTextScale$ = new BehaviorSubject(Number(localStorage.getItem('messaging_code_text_scale') ?? '1'));
    toast$ = new BehaviorSubject(null);
    removedGroupIds$ = new BehaviorSubject(new Set());
    mentionConversationIds$ = new BehaviorSubject(new Set());
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
    messageTextScale = this.messageTextScale$.asObservable();
    codeTextScale = this.codeTextScale$.asObservable();
    toast = this.toast$.asObservable();
    removedGroupIds = this.removedGroupIds$.asObservable();
    mentionConversationIds = this.mentionConversationIds$.asObservable();
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
        this.mentionConversationIds$.next(new Set());
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
    setMessageTextScale(scale) {
        const normalized = Math.max(0.8, Math.min(1.5, Number(scale)));
        this.messageTextScale$.next(normalized);
        localStorage.setItem('messaging_message_text_scale', String(normalized));
    }
    setCodeTextScale(scale) {
        const normalized = Math.max(0.8, Math.min(1.5, Number(scale)));
        this.codeTextScale$.next(normalized);
        localStorage.setItem('messaging_code_text_scale', String(normalized));
    }
    testNotificationSound() {
        this.playSoftNotificationSound(true);
    }
    prepareOutgoingMessageContent(content, replyTo) {
        const body = String(content || '').trim();
        if (!replyTo)
            return body;
        const reply = this.createReplyPreview(replyTo);
        const sender = (reply.sender_name || 'message').replace(/\]/g, '').trim();
        const excerpt = this.replyExcerpt(reply.content || '');
        return `[Reply to ${sender}]\n> ${excerpt}\n\n${body}`;
    }
    createReplyPreview(message) {
        return {
            message_id: String(message.message_id || ''),
            sender_name: getMessageSenderName(message) !== 'Unknown'
                ? getMessageSenderName(message)
                : this.getContactNameById(message.sender_id),
            content: this.replyExcerpt(String(message.content || '')),
        };
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
                    const conversationId = String(item.conversation_id);
                    const preview = this.replyBodyText(item.last_message_preview || '');
                    const hasMention = this.mentionConversationIds$.value.has(conversationId) ||
                        (Number(item.unread_count || 0) > 0 && this.messageTextMentionsCurrentUser(preview));
                    if (!isGroup && !item.name && item.other_participant_name) {
                        return { ...item, name: item.other_participant_name, last_message_preview: preview, is_group: false, has_mention: hasMention };
                    }
                    return { ...item, last_message_preview: preview, is_group: isGroup, has_mention: hasMention };
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
    sendMessage(conversationId, content, messageType = 'TEXT', options) {
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
        const outgoingContent = this.prepareOutgoingMessageContent(content, options?.replyTo || null);
        const replyTo = options?.replyTo ? this.createReplyPreview(options.replyTo) : undefined;
        const tempMessageId = 'temp-' + Date.now();
        const optimistic = {
            message_id: tempMessageId,
            conversation_id: conversationId,
            sender_id: contactId,
            sender_name: 'You',
            message_type: messageType,
            content,
            reply_to: replyTo,
            mentions: options?.mentions,
            created_at: new Date().toISOString(),
            is_read: false,
        };
        this.appendMessage(optimistic);
        this.api.sendMessage(conversationId, contactId, outgoingContent, messageType).subscribe({
            next: (res) => {
                const realId = res?.message_id ?? res?.id ?? res?.messageId;
                if (realId == null || String(realId).startsWith('temp-')) {
                    return;
                }
                const pickedContent = this.coalesceMessageText(res, outgoingContent || optimistic.content);
                const merged = this.normalizeMessageShape({
                    ...optimistic,
                    ...res,
                    message_id: String(realId),
                    conversation_id: conversationId,
                    message_type: messageType === 'SYSTEM' ? 'SYSTEM' : res?.message_type ?? optimistic.message_type,
                    content: pickedContent,
                    reply_to: replyTo ?? res?.reply_to,
                    mentions: options?.mentions ?? res?.mentions,
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
                const items = this.inbox$.value.map((item) => item.conversation_id === conversationId ? { ...item, unread_count: 0, has_mention: false } : item);
                this.inbox$.next(items);
                this.recalcUnread(items);
                this.setConversationMention(conversationId, false);
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
        const mentionsMe = isFromOther && this.messageMentionsCurrentUser(message);
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
                if (mentionsMe) {
                    this.setConversationMention(message.conversation_id, true);
                }
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
                const mentioned = item.has_mention || this.mentionConversationIds$.value.has(String(item.conversation_id));
                return {
                    ...item,
                    last_message_preview: preview,
                    last_message_at: message.created_at,
                    has_mention: mentioned,
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
    parseReplyContent(content) {
        const value = String(content || '');
        const match = value.match(/^\[Reply to ([^\]]+)\]\n> ([^\n]*)\n\n([\s\S]*)$/);
        if (!match)
            return null;
        return {
            reply: {
                sender_name: match[1].trim(),
                content: match[2].trim(),
            },
            body: match[3],
        };
    }
    replyBodyText(content) {
        return this.parseReplyContent(content)?.body ?? String(content || '');
    }
    replyExcerpt(content) {
        const parsed = this.parseReplyContent(content);
        const base = (parsed?.body ?? content).replace(/\s+/g, ' ').trim();
        return base.length > 120 ? `${base.slice(0, 117)}...` : base || 'Attachment';
    }
    currentMentionTokens() {
        const current = this.auth.currentContact;
        const values = [
            current?.username,
            current?.email?.split('@')[0],
            current?.first_name,
            current?.last_name,
            current?.email,
        ];
        return values
            .map((value) => String(value || '').trim().toLowerCase())
            .filter(Boolean)
            .map((value) => value.replace(/^@/, ''));
    }
    messageTextMentionsCurrentUser(content) {
        const tokens = this.currentMentionTokens();
        if (!tokens.length)
            return false;
        const mentions = Array.from(String(content || '').matchAll(/(^|[^a-zA-Z0-9._-])@([a-zA-Z0-9._-]+)/g))
            .map((match) => match[2].toLowerCase());
        return mentions.some((mention) => tokens.includes(mention));
    }
    messageMentionsCurrentUser(message) {
        const myId = String(this.auth.contactId || '');
        const explicitMentions = Array.isArray(message.mentions)
            ? message.mentions.map((id) => String(id))
            : [];
        return (!!myId && explicitMentions.includes(myId)) ||
            this.messageTextMentionsCurrentUser(String(message.content || ''));
    }
    setConversationMention(conversationId, hasMention) {
        const id = String(conversationId || '');
        if (!id)
            return;
        const next = new Set(this.mentionConversationIds$.value);
        if (hasMention) {
            next.add(id);
        }
        else {
            next.delete(id);
        }
        this.mentionConversationIds$.next(next);
        const items = this.inbox$.value.map((item) => String(item.conversation_id) === id ? { ...item, has_mention: hasMention } : item);
        this.inbox$.next(items);
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
        const parsedReply = this.parseReplyContent(String(base.content || ''));
        if (parsedReply) {
            base.content = parsedReply.body;
            base.reply_to = raw?.reply_to ?? raw?.replyTo ?? parsedReply.reply;
        }
        else {
            base.reply_to = raw?.reply_to ?? raw?.replyTo;
        }
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
                    : [];
        const mimeTypes = toStringArray(raw?.mime_types).length
            ? toStringArray(raw?.mime_types)
            : toStringArray(raw?.mimeTypes);
        if (attachmentIds.length > 0 || filenames.length > 0) {
            const fallbackMime = raw?.mime_type ?? raw?.attachment_mime_type ?? (base.message_type === 'IMAGE' ? 'image/*' : undefined);
            const urlFallback = raw?.file_url ?? raw?.url ?? raw?.media_url ?? raw?.mediaUrl;
            const ids = attachmentIds.length > 0 ? attachmentIds : [];
            const built = ids.map((id, idx) => ({
                file_id: id,
                filename: filenames[idx] || filenames[0] || (base.message_type === 'IMAGE' ? `Image ${idx + 1}` : `Attachment ${idx + 1}`),
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVzc2FnaW5nLXN0b3JlLnNlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvbGliL3NlcnZpY2VzL21lc3NhZ2luZy1zdG9yZS5zZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxVQUFVLEVBQWEsTUFBTSxlQUFlLENBQUM7QUFDdEQsT0FBTyxFQUFFLGVBQWUsRUFBRSxVQUFVLEVBQUUsT0FBTyxFQUFnQixRQUFRLEVBQUUsRUFBRSxFQUFFLE1BQU0sTUFBTSxDQUFDO0FBQ3hGLE9BQU8sRUFBRSxVQUFVLEVBQUUsR0FBRyxFQUFFLE1BQU0sZ0JBQWdCLENBQUM7QUFJakQsT0FBTyxFQVNMLHFCQUFxQixFQUNyQixvQkFBb0IsR0FDckIsTUFBTSw0QkFBNEIsQ0FBQzs7Ozs7QUFHcEMsTUFBTSxPQUFPLHFCQUFxQjtJQXNFdEI7SUFDQTtJQUNBO0lBdkVWLHVCQUF1QjtJQUNmLE1BQU0sR0FBRyxJQUFJLGVBQWUsQ0FBYyxFQUFFLENBQUMsQ0FBQztJQUM5QyxZQUFZLEdBQUcsSUFBSSxlQUFlLENBQXlCLElBQUksR0FBRyxFQUFFLENBQUMsQ0FBQztJQUN0RSxVQUFVLEdBQUcsSUFBSSxlQUFlLENBQWUsRUFBRSxDQUFDLENBQUM7SUFDbkQsZ0JBQWdCLEdBQUcsSUFBSSxlQUFlLENBQVksRUFBRSxDQUFDLENBQUM7SUFDdEQsVUFBVSxHQUFHLElBQUksZUFBZSxDQUFVLEtBQUssQ0FBQyxDQUFDO0lBQ2pELFdBQVcsR0FBRyxJQUFJLGVBQWUsQ0FBb0YsT0FBTyxDQUFDLENBQUM7SUFDOUgsWUFBWSxHQUFHLElBQUksZUFBZSxDQUN2QyxZQUFZLENBQUMsT0FBTyxDQUFDLHdCQUF3QixDQUFpQixJQUFJLE9BQU8sQ0FDM0UsQ0FBQztJQUNNLHFCQUFxQixHQUFHLElBQUksZUFBZSxDQUFnQixJQUFJLENBQUMsQ0FBQztJQUNqRSxtQkFBbUIsR0FBRyxJQUFJLGVBQWUs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WyJpbXBvcnQgeyBJbmplY3RhYmxlLCBPbkRlc3Ryb3kgfSBmcm9tICdAYW5ndWxhci9jb3JlJztcclxuaW1wb3J0IHsgQmVoYXZpb3JTdWJqZWN0LCBPYnNlcnZhYmxlLCBTdWJqZWN0LCBTdWJzY3JpcHRpb24sIGZvcmtKb2luLCBvZiB9IGZyb20gJ3J4anMnO1xyXG5pbXBvcnQgeyBjYXRjaEVycm9yLCBtYXAgfSBmcm9tICdyeGpzL29wZXJhdG9ycyc7XHJcbmltcG9ydCB7IEF1dGhTZXJ2aWNlIH0gZnJvbSAnLi9hdXRoLnNlcnZpY2UnO1xyXG5pbXBvcnQgeyBNZXNzYWdpbmdBcGlTZXJ2aWNlIH0gZnJvbSAnLi9tZXNzYWdpbmctYXBpLnNlcnZpY2UnO1xyXG5pbXBvcnQgeyBNZXNzYWdpbmdXZWJTb2NrZXRTZXJ2aWNlIH0gZnJvbSAnLi9tZXNzYWdpbmctd2Vic29ja2V0LnNlcnZpY2UnO1xyXG5pbXBvcnQge1xyXG4gIEluYm94SXRlbSxcclxuICBNZXNzYWdlLFxyXG4gIE1lc3NhZ2VSZXBseVByZXZpZXcsXHJcbiAgQXR0YWNobWVudCxcclxuICBDb250YWN0LFxyXG4gIENoYXRXaW5kb3csXHJcbiAgV2ViU29ja2V0TWVzc2FnZSxcclxuICBTaWRlYmFyU2lkZSxcclxuICBnZXRDb250YWN0RGlzcGxheU5hbWUsXHJcbiAgZ2V0TWVzc2FnZVNlbmRlck5hbWUsXHJcbn0gZnJvbSAnLi4vbW9kZWxzL21lc3NhZ2luZy5tb2RlbHMnO1xyXG5cclxuQEluamVjdGFibGUoeyBwcm92aWRlZEluOiAncm9vdCcgfSlcclxuZXhwb3J0IGNsYXNzIE1lc3NhZ2luZ1N0b3JlU2VydmljZSBpbXBsZW1lbnRzIE9uRGVzdHJveSB7XHJcbiAgLy8g4pSA4pSAIFN0YXRlIHN1YmplY3RzIOKUgOKUgFxyXG4gIHByaXZhdGUgaW5ib3gkID0gbmV3IEJlaGF2aW9yU3ViamVjdDxJbmJveEl0ZW1bXT4oW10pO1xyXG4gIHByaXZhdGUgbWVzc2FnZXNNYXAkID0gbmV3IEJlaGF2aW9yU3ViamVjdDxNYXA8c3RyaW5nLCBNZXNzYWdlW10+PihuZXcgTWFwKCkpO1xyXG4gIHByaXZhdGUgb3BlbkNoYXRzJCA9IG5ldyBCZWhhdmlvclN1YmplY3Q8Q2hhdFdpbmRvd1tdPihbXSk7XHJcbiAgcHJpdmF0ZSB2aXNpYmxlQ29udGFjdHMkID0gbmV3IEJlaGF2aW9yU3ViamVjdDxDb250YWN0W10+KFtdKTtcclxuICBwcml2YXRlIHBhbmVsT3BlbiQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PGJvb2xlYW4+KGZhbHNlKTtcclxuICBwcml2YXRlIGFjdGl2ZVZpZXckID0gbmV3IEJlaGF2aW9yU3ViamVjdDwnaW5ib3gnIHwgJ2NoYXQnIHwgJ25ldy1jb252ZXJzYXRpb24nIHwgJ2dyb3VwLW1hbmFnZXInIHwgJ2NvbnZlcnNhdGlvbi1zZXR0aW5ncyc+KCdpbmJveCcpO1xyXG4gIHByaXZhdGUgc2lkZWJhclNpZGUkID0gbmV3IEJlaGF2aW9yU3ViamVjdDxTaWRlYmFyU2lkZT4oXHJcbiAgICAobG9jYWxTdG9yYWdlLmdldEl0ZW0oJ21lc3NhZ2luZ19zaWRlYmFyX3NpZGUnKSBhcyBTaWRlYmFyU2lkZSkgfHwgJ3JpZ2h0J1xyXG4gICk7XHJcbiAgcHJpdmF0ZSBhY3RpdmVDb252ZXJzYXRpb25JZCQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PHN0cmluZyB8IG51bGw+KG51bGwpO1xyXG4gIHByaXZhdGUgcGVuZGluZ0RtUmVjaXBpZW50JCA9IG5ldyBCZWhhdmlvclN1YmplY3Q8e2NvbnRhY3RJZDogc3RyaW5nLCBuYW1lOiBzdHJpbmd9IHwgbnVsbD4obnVsbCk7XHJcbiAgcHJpdmF0ZSB0b3RhbFVucmVhZCQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PG51bWJlcj4oMCk7XHJcbiAgcHJpdmF0ZSBsb2FkaW5nTWVzc2FnZXMkID0gbmV3IEJlaGF2aW9yU3ViamVjdDxib29sZWFuPihmYWxzZSk7XHJcbiAgcHJpdmF0ZSBwYW5lbFBvc2l0aW9uJCA9IG5ldyBCZWhhdmlvclN1YmplY3Q8eyB4OiBudW1iZXI7IHk6IG51bWJlciB9IHwgbnVsbD4obnVsbCk7XHJcbiAgcHJpdmF0ZSBwYW5lbFNpemUkID0gbmV3IEJlaGF2aW9yU3ViamVjdDx7IHdpZHRoOiBudW1iZXI7IGhlaWdodDogbnVtYmVyIH0+KHsgd2lkdGg6IDM4MCwgaGVpZ2h0OiA1NjAgfSk7XHJcbiAgcHJpdmF0ZSB3YXNPcGVuQmVmb3JlRHJhZyQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PGJvb2xlYW4+KGZhbHNlKTtcclxuICBwcml2YXRlIHBhbmVsRmxvYXRpbmckID0gbmV3IEJlaGF2aW9yU3ViamVjdDxib29sZWFuPihmYWxzZSk7XHJcbiAgcHJpdmF0ZSBub3RpZmljYXRpb25Wb2x1bWUkID0gbmV3IEJlaGF2aW9yU3ViamVjdDxudW1iZXI+KFxyXG4gICAgTnVtYmVyKGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdtZXNzYWdpbmdfbm90aWZpY2F0aW9uX3ZvbHVtZScpID8/ICcwLjM1JylcclxuICApO1xyXG4gIHByaXZhdGUgbm90aWZpY2F0aW9uc011dGVkJCA9IG5ldyBCZWhhdmlvclN1YmplY3Q8Ym9vbGVhbj4oXHJcbiAgICBsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnbWVzc2FnaW5nX25vdGlmaWNhdGlvbnNfbXV0ZWQnKSA9PT0gJ3RydWUnXHJcbiAgKTtcclxuICBwcml2YXRlIG1lc3NhZ2VUZXh0U2NhbGUkID0gbmV3IEJlaGF2aW9yU3ViamVjdDxudW1iZXI+KFxyXG4gICAgTnVtYmVyKGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdtZXNzYWdpbmdfbWVzc2FnZV90ZXh0X3NjYWxlJykgPz8gJzEnKVxyXG4gICk7XHJcbiAgcHJpdmF0ZSBjb2RlVGV4dFNjYWxlJCA9IG5ldyBCZWhhdmlvclN1YmplY3Q8bnVtYmVyPihcclxuICAgIE51bWJlcihsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnbWVzc2FnaW5nX2NvZGVfdGV4dF9zY2FsZScpID8/ICcxJylcclxuICApO1xyXG4gIHByaXZhdGUgdG9hc3QkID0gbmV3IEJlaGF2aW9yU3ViamVjdDx7IG1lc3NhZ2U6IHN0cmluZzsgdHlwZTogJ2luZm8nIHwgJ3N1Y2Nlc3MnIHwgJ2Vycm9yJyB9IHwgbnVsbD4obnVsbCk7XHJcbiAgcHJpdmF0ZSByZW1vdmVkR3JvdXBJZHMkID0gbmV3IEJlaGF2aW9yU3ViamVjdDxTZXQ8c3RyaW5nPj4obmV3IFNldCgpKTtcclxuICBwcml2YXRlIG1lbnRpb25Db252ZXJzYXRpb25JZHMkID0gbmV3IEJlaGF2aW9yU3ViamVjdDxTZXQ8c3RyaW5nPj4obmV3IFNldCgpKTtcclxuXHJcbiAgLy8g4pSA4pSAIFB1YmxpYyBvYnNlcnZhYmxlcyDilIDilIBcclxuICByZWFkb25seSBpbmJveCA9IHRoaXMuaW5ib3gkLmFzT2JzZXJ2YWJsZSgpO1xyXG4gIHJlYWRvbmx5IG1lc3NhZ2VzTWFwID0gdGhpcy5tZXNzYWdlc01hcCQuYXNPYnNlcnZhYmxlKCk7XHJcbiAgcmVhZG9ubHkgb3BlbkNoYXRzID0gdGhpcy5vcGVuQ2hhdHMkLmFzT2JzZXJ2YWJsZSgpO1xyXG4gIHJlYWRvbmx5IHZpc2libGVDb250YWN0cyA9IHRoaXMudmlzaWJsZUNvbnRhY3RzJC5hc09ic2VydmFibGUoKTtcclxuICByZWFkb25seSBwYW5lbE9wZW4gPSB0aGlzLnBhbmVsT3BlbiQuYXNPYnNlcnZhYmxlKCk7XHJcbiAgcmVhZG9ubHkgYWN0aXZlVmlldyA9IHRoaXMuYWN0aXZlVmlldyQuYXNPYnNlcnZhYmxlKCk7XHJcbiAgcmVhZG9ubHkgYWN0aXZlQ29udmVyc2F0aW9uSWQgPSB0aGlzLmFjdGl2ZUNvbnZlcnNhdGlvbklkJC5hc09ic2VydmFibGUoKTtcclxuICByZWFkb25seSB0b3RhbFVucmVhZCA9IHRoaXMudG90YWxVbnJlYWQkLmFzT2JzZXJ2YWJsZSgpO1xyXG4gIHJlYWRvbmx5IGxvYWRpbmdNZXNzYWdlcyA9IHRoaXMubG9hZGluZ01lc3NhZ2VzJC5hc09ic2VydmFibGUoKTtcclxuICB3c1N0YXR1czogT2JzZXJ2YWJsZTxzdHJpbmc+ID0gbmV3IE9ic2VydmFibGU8c3RyaW5nPigpO1xyXG4gIHJlYWRvbmx5IHBhbmVsUG9zaXRpb24gPSB0aGlzLnBhbmVsUG9zaXRpb24kLmFzT2JzZXJ2YWJsZSgpO1xyXG4gIHJlYWRvbmx5IHBhbmVsU2l6ZSA9IHRoaXMucGFuZWxTaXplJC5hc09ic2VydmFibGUoKTtcclxuICByZWFkb25seSB3YXNPcGVuQmVmb3JlRHJhZyA9IHRoaXMud2FzT3BlbkJlZm9yZURyYWckLmFzT2JzZXJ2YWJsZSgpO1xyXG4gIHJlYWRvbmx5IHNpZGViYXJTaWRlID0gdGhpcy5zaWRlYmFyU2lkZSQuYXNPYnNlcnZhYmxlKCk7XHJcbiAgcmVhZG9ubHkgcGFuZWxGbG9hdGluZyA9IHRoaXMucGFuZWxGbG9hdGluZyQuYXNPYnNlcnZhYmxlKCk7XHJcbiAgcmVhZG9ubHkgbm90aWZpY2F0aW9uVm9sdW1lID0gdGhpcy5ub3RpZmljYXRpb25Wb2x1bWUkLmFzT2JzZXJ2YWJsZSgpO1xyXG4gIHJlYWRvbmx5IG5vdGlmaWNhdGlvbnNNdXRlZCA9IHRoaXMubm90aWZpY2F0aW9uc011dGVkJC5hc09ic2VydmFibGUoKTtcclxuICByZWFkb25seSBtZXNzYWdlVGV4dFNjYWxlID0gdGhpcy5tZXNzYWdlVGV4dFNjYWxlJC5hc09ic2VydmFibGUoKTtcclxuICByZWFkb25seSBjb2RlVGV4dFNjYWxlID0gdGhpcy5jb2RlVGV4dFNjYWxlJC5hc09ic2VydmFibGUoKTtcclxuICByZWFkb25seSB0b2FzdCA9IHRoaXMudG9hc3QkLmFzT2JzZXJ2YWJsZSgpO1xyXG4gIHJlYWRvbmx5IHJlbW92ZWRHcm91cElkcyA9IHRoaXMucmVtb3ZlZEdyb3VwSWRzJC5hc09ic2VydmFibGUoKTtcclxuICByZWFkb25seSBtZW50aW9uQ29udmVyc2F0aW9uSWRzID0gdGhpcy5tZW50aW9uQ29udmVyc2F0aW9uSWRzJC5hc09ic2VydmFibGUoKTtcclxuXHJcbiAgcHJpdmF0ZSB3c1N1YjogU3Vic2NyaXB0aW9uIHwgbnVsbCA9IG51bGw7XHJcbiAgcHJpdmF0ZSBkZXN0cm95JCA9IG5ldyBTdWJqZWN0PHZvaWQ+KCk7XHJcbiAgcHJpdmF0ZSBwb2xsVGltZXI6IGFueSA9IG51bGw7XHJcbiAgcHJpdmF0ZSBncm91cFNldHRpbmdzJCA9IG5ldyBCZWhhdmlvclN1YmplY3Q8eyBjb252ZXJzYXRpb25JZDogc3RyaW5nOyBuYW1lOiBzdHJpbmcgfSB8IG51bGw+KG51bGwpO1xyXG4gIHByaXZhdGUgZGVsZXRpbmdDb252ZXJzYXRpb25JZHMgPSBuZXcgU2V0PHN0cmluZz4oKTtcclxuICBwcml2YXRlIHJlbW92YWxUb2FzdFNob3duID0gbmV3IFNldDxzdHJpbmc+KCk7XHJcbiAgcHJpdmF0ZSB0b2FzdFRpbWVyOiBhbnkgPSBudWxsO1xyXG5cclxuICByZWFkb25seSBncm91cFNldHRpbmdzID0gdGhpcy5ncm91cFNldHRpbmdzJC5hc09ic2VydmFibGUoKTtcclxuXHJcbiAgY29uc3RydWN0b3IoXHJcbiAgICBwcml2YXRlIGF1dGg6IEF1dGhTZXJ2aWNlLFxyXG4gICAgcHJpdmF0ZSBhcGk6IE1lc3NhZ2luZ0FwaVNlcnZpY2UsXHJcbiAgICBwcml2YXRlIHdzU2VydmljZTogTWVzc2FnaW5nV2ViU29ja2V0U2VydmljZVxyXG4gICkge1xyXG4gICAgKHRoaXMgYXMgYW55KS53c1N0YXR1cyA9IHRoaXMud3NTZXJ2aWNlLnN0YXR1cyQ7XHJcbiAgfVxyXG5cclxuICAvLyDilIDilIAgSW5pdGlhbGl6YXRpb24g4pSA4pSAXHJcbiAgaW5pdGlhbGl6ZSgpOiB2b2lkIHtcclxuICAgIGlmICghdGhpcy5hdXRoLmlzQXV0aGVudGljYXRlZCgpKSByZXR1cm47XHJcblxyXG4gICAgY29uc3QgY29udGFjdElkID0gdGhpcy5hdXRoLmNvbnRhY3RJZCE7XHJcbiAgICBjb25zdCBzZXNzaW9uR2lkID0gdGhpcy5hdXRoLnNlc3Npb25HaWQhO1xyXG5cclxuICAgIHRoaXMubG9hZEluYm94KCk7XHJcbiAgICB0aGlzLmxvYWRWaXNpYmxlQ29udGFjdHMoKTtcclxuXHJcbiAgICB0aGlzLndzU2VydmljZS5jb25uZWN0KGNvbnRhY3RJZCwgc2Vzc2lvbkdpZCk7XHJcbiAgICB0aGlzLmxpc3RlbldlYlNvY2tldCgpO1xyXG4gICAgdGhpcy5zdGFydFBvbGxpbmcoKTtcclxuICB9XHJcblxyXG4gIHRlYXJkb3duKCk6IHZvaWQge1xyXG4gICAgdGhpcy5zdG9wUG9sbGluZygpO1xyXG4gICAgaWYgKHRoaXMudG9hc3RUaW1lcikge1xyXG4gICAgICBjbGVhclRpbWVvdXQodGhpcy50b2FzdFRpbWVyKTtcclxuICAgICAgdGhpcy50b2FzdFRpbWVyID0gbnVsbDtcclxuICAgIH1cclxuICAgIHRoaXMud3NTZXJ2aWNlLmRpc2Nvbm5lY3QoKTtcclxuICAgIHRoaXMud3NTdWI/LnVuc3Vic2NyaWJlKCk7XHJcbiAgICB0aGlzLmluYm94JC5uZXh0KFtdKTtcclxuICAgIHRoaXMubWVzc2FnZXNNYXAkLm5leHQobmV3IE1hcCgpKTtcclxuICAgIHRoaXMub3BlbkNoYXRzJC5uZXh0KFtdKTtcclxuICAgIHRoaXMucGFuZWxPcGVuJC5uZXh0KGZhbHNlKTtcclxuICAgIHRoaXMuYWN0aXZlVmlldyQubmV4dCgnaW5ib3gnKTtcclxuICAgIHRoaXMuYWN0aXZlQ29udmVyc2F0aW9uSWQkLm5leHQobnVsbCk7XHJcbiAgICB0aGlzLnRvdGFsVW5yZWFkJC5uZXh0KDApO1xyXG4gICAgdGhpcy5kZWxldGluZ0NvbnZlcnNhdGlvbklkcy5jbGVhcigpO1xyXG4gICAgdGhpcy5yZW1vdmFsVG9hc3RTaG93bi5jbGVhcigpO1xyXG4gICAgdGhpcy5yZW1vdmVkR3JvdXBJZHMkLm5leHQobmV3IFNldCgpKTtcclxuICAgIHRoaXMubWVudGlvbkNvbnZlcnNhdGlvbklkcyQubmV4dChuZXcgU2V0KCkpO1xyXG4gICAgdGhpcy50b2FzdCQubmV4dChudWxsKTtcclxuICB9XHJcblxyXG4gIC8vIOKUgOKUgCBQb2xsaW5nIGZhbGxiYWNrIChpbmJveCBvbmx5IC0gbWVzc2FnZXMgcmVseSBvbiBXZWJTb2NrZXQpIOKUgOKUgFxyXG4gIHByaXZhdGUgc3RhcnRQb2xsaW5nKCk6IHZvaWQge1xyXG4gICAgdGhpcy5zdG9wUG9sbGluZygpO1xyXG4gICAgdGhpcy5wb2xsVGltZXIgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XHJcbiAgICAgIHRoaXMubG9hZEluYm94KCk7XHJcbiAgICB9LCAzMDAwMCk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHN0b3BQb2xsaW5nKCk6IHZvaWQge1xyXG4gICAgaWYgKHRoaXMucG9sbFRpbWVyKSB7XHJcbiAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy5wb2xsVGltZXIpO1xyXG4gICAgICB0aGlzLnBvbGxUaW1lciA9IG51bGw7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBuZ09uRGVzdHJveSgpOiB2b2lkIHtcclxuICAgIHRoaXMudGVhcmRvd24oKTtcclxuICAgIHRoaXMuZGVzdHJveSQubmV4dCgpO1xyXG4gICAgdGhpcy5kZXN0cm95JC5jb21wbGV0ZSgpO1xyXG4gIH1cclxuXHJcbiAgLy8g4pSA4pSAIFBhbmVsIGNvbnRyb2xzIOKUgOKUgFxyXG4gIHRvZ2dsZVBhbmVsKGJ1dHRvblg/OiBudW1iZXIsIGJ1dHRvblk/OiBudW1iZXIpOiB2b2lkIHtcclxuICAgIGlmIChidXR0b25YICE9PSB1bmRlZmluZWQgJiYgYnV0dG9uWSAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgIHRoaXMucGFuZWxQb3NpdGlvbiQubmV4dCh7IHg6IGJ1dHRvblgsIHk6IGJ1dHRvblkgfSk7XHJcbiAgICB9XHJcbiAgICB0aGlzLnBhbmVsT3BlbiQubmV4dCghdGhpcy5wYW5lbE9wZW4kLnZhbHVlKTtcclxuICB9XHJcblxyXG4gIG9wZW5QYW5lbChidXR0b25YPzogbnVtYmVyLCBidXR0b25ZPzogbnVtYmVyKTogdm9pZCB7XHJcbiAgICBpZiAoYnV0dG9uWCAhPT0gdW5kZWZpbmVkICYmIGJ1dHRvblkgIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICB0aGlzLnBhbmVsUG9zaXRpb24kLm5leHQoeyB4OiBidXR0b25YLCB5OiBidXR0b25ZIH0pO1xyXG4gICAgfVxyXG4gICAgdGhpcy5wYW5lbE9wZW4kLm5leHQodHJ1ZSk7XHJcbiAgfVxyXG5cclxuICBjbG9zZVBhbmVsKCk6IHZvaWQge1xyXG4gICAgdGhpcy5wYW5lbE9wZW4kLm5leHQoZmFsc2UpO1xyXG4gIH1cclxuXHJcbiAgc2V0UGFuZWxTaXplKHdpZHRoOiBudW1iZXIsIGhlaWdodDogbnVtYmVyKTogdm9pZCB7XHJcbiAgICB0aGlzLnBhbmVsU2l6ZSQubmV4dCh7IHdpZHRoLCBoZWlnaHQgfSk7XHJcbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnbWVzc2FnaW5nX3BhbmVsX3NpemUnLCBKU09OLnN0cmluZ2lmeSh7IHdpZHRoLCBoZWlnaHQgfSkpO1xyXG4gIH1cclxuXHJcbiAgZ2V0UGFuZWxTaXplKCk6IHsgd2lkdGg6IG51bWJlcjsgaGVpZ2h0OiBudW1iZXIgfSB7XHJcbiAgICBjb25zdCBzYXZlZCA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdtZXNzYWdpbmdfcGFuZWxfc2l6ZScpO1xyXG4gICAgaWYgKHNhdmVkKSB7XHJcbiAgICAgIHRyeSB7XHJcbiAgICAgICAgY29uc3QgcGFyc2VkID0gSlNPTi5wYXJzZShzYXZlZCk7XHJcbiAgICAgICAgaWYgKHBhcnNlZC53aWR0aCAmJiBwYXJzZWQuaGVpZ2h0KSB7XHJcbiAgICAgICAgICB0aGlzLnBhbmVsU2l6ZSQubmV4dChwYXJzZWQpO1xyXG4gICAgICAgICAgcmV0dXJuIHBhcnNlZDtcclxuICAgICAgICB9XHJcbiAgICAgIH0gY2F0Y2gge31cclxuICAgIH1cclxuICAgIHJldHVybiB0aGlzLnBhbmVsU2l6ZSQudmFsdWU7XHJcbiAgfVxyXG5cclxuICBvbkJ1dHRvbkRyYWdTdGFydCgpOiB2b2lkIHtcclxuICAgIHRoaXMud2FzT3BlbkJlZm9yZURyYWckLm5leHQodGhpcy5wYW5lbE9wZW4kLnZhbHVlKTtcclxuICAgIGlmICh0aGlzLnBhbmVsT3BlbiQudmFsdWUpIHtcclxuICAgICAgdGhpcy5wYW5lbE9wZW4kLm5leHQoZmFsc2UpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgb25CdXR0b25EcmFnRW5kKGJ1dHRvblg6IG51bWJlciwgYnV0dG9uWTogbnVtYmVyKTogdm9pZCB7XHJcbiAgICBpZiAodGhpcy53YXNPcGVuQmVmb3JlRHJhZyQudmFsdWUpIHtcclxuICAgICAgdGhpcy5vcGVuUGFuZWwoYnV0dG9uWCwgYnV0dG9uWSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBzZXRWaWV3KHZpZXc6ICdpbmJveCcgfCAnY2hhdCcgfCAnbmV3LWNvbnZlcnNhdGlvbicgfCAnZ3JvdXAtbWFuYWdlcicgfCAnY29udmVyc2F0aW9uLXNldHRpbmdzJyk6IHZvaWQge1xyXG4gICAgdGhpcy5hY3RpdmVWaWV3JC5uZXh0KHZpZXcpO1xyXG4gIH1cclxuXHJcbiAgdG9nZ2xlU2lkZWJhclNpZGUoKTogdm9pZCB7XHJcbiAgICBjb25zdCBuZXh0ID0gdGhpcy5zaWRlYmFyU2lkZSQudmFsdWUgPT09ICdyaWdodCcgPyAnbGVmdCcgOiAncmlnaHQnO1xyXG4gICAgdGhpcy5zaWRlYmFyU2lkZSQubmV4dChuZXh0KTtcclxuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdtZXNzYWdpbmdfc2lkZWJhcl9zaWRlJywgbmV4dCk7XHJcbiAgfVxyXG5cclxuICBzZXRQYW5lbEZsb2F0aW5nKGlzRmxvYXRpbmc6IGJvb2xlYW4pOiB2b2lkIHtcclxuICAgIHRoaXMucGFuZWxGbG9hdGluZyQubmV4dChpc0Zsb2F0aW5nKTtcclxuICB9XHJcblxyXG4gIHNldE5vdGlmaWNhdGlvblZvbHVtZSh2b2x1bWU6IG51bWJlcik6IHZvaWQge1xyXG4gICAgY29uc3Qgbm9ybWFsaXplZCA9IE1hdGgubWF4KDAsIE1hdGgubWluKDEsIE51bWJlcih2b2x1bWUpKSk7XHJcbiAgICB0aGlzLm5vdGlmaWNhdGlvblZvbHVtZSQubmV4dChub3JtYWxpemVkKTtcclxuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdtZXNzYWdpbmdfbm90aWZpY2F0aW9uX3ZvbHVtZScsIFN0cmluZyhub3JtYWxpemVkKSk7XHJcbiAgICBpZiAobm9ybWFsaXplZCA+IDAgJiYgdGhpcy5ub3RpZmljYXRpb25zTXV0ZWQkLnZhbHVlKSB7XHJcbiAgICAgIHRoaXMuc2V0Tm90aWZpY2F0aW9uc011dGVkKGZhbHNlKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHNldE5vdGlmaWNhdGlvbnNNdXRlZChtdXRlZDogYm9vbGVhbik6IHZvaWQge1xyXG4gICAgdGhpcy5ub3RpZmljYXRpb25zTXV0ZWQkLm5leHQobXV0ZWQpO1xyXG4gICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ21lc3NhZ2luZ19ub3RpZmljYXRpb25zX211dGVkJywgU3RyaW5nKG11dGVkKSk7XHJcbiAgfVxyXG5cclxuICBzZXRNZXNzYWdlVGV4dFNjYWxlKHNjYWxlOiBudW1iZXIpOiB2b2lkIHtcclxuICAgIGNvbnN0IG5vcm1hbGl6ZWQgPSBNYXRoLm1heCgwLjgsIE1hdGgubWluKDEuNSwgTnVtYmVyKHNjYWxlKSkpO1xyXG4gICAgdGhpcy5tZXNzYWdlVGV4dFNjYWxlJC5uZXh0KG5vcm1hbGl6ZWQpO1xyXG4gICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ21lc3NhZ2luZ19tZXNzYWdlX3RleHRfc2NhbGUnLCBTdHJpbmcobm9ybWFsaXplZCkpO1xyXG4gIH1cclxuXHJcbiAgc2V0Q29kZVRleHRTY2FsZShzY2FsZTogbnVtYmVyKTogdm9pZCB7XHJcbiAgICBjb25zdCBub3JtYWxpemVkID0gTWF0aC5tYXgoMC44LCBNYXRoLm1pbigxLjUsIE51bWJlcihzY2FsZSkpKTtcclxuICAgIHRoaXMuY29kZVRleHRTY2FsZSQubmV4dChub3JtYWxpemVkKTtcclxuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdtZXNzYWdpbmdfY29kZV90ZXh0X3NjYWxlJywgU3RyaW5nKG5vcm1hbGl6ZWQpKTtcclxuICB9XHJcblxyXG4gIHRlc3ROb3RpZmljYXRpb25Tb3VuZCgpOiB2b2lkIHtcclxuICAgIHRoaXMucGxheVNvZnROb3RpZmljYXRpb25Tb3VuZCh0cnVlKTtcclxuICB9XHJcblxyXG4gIHByZXBhcmVPdXRnb2luZ01lc3NhZ2VDb250ZW50KGNvbnRlbnQ6IHN0cmluZywgcmVwbHlUbz86IE1lc3NhZ2UgfCBudWxsKTogc3RyaW5nIHtcclxuICAgIGNvbnN0IGJvZHkgPSBTdHJpbmcoY29udGVudCB8fCAnJykudHJpbSgpO1xyXG4gICAgaWYgKCFyZXBseVRvKSByZXR1cm4gYm9keTtcclxuICAgIGNvbnN0IHJlcGx5ID0gdGhpcy5jcmVhdGVSZXBseVByZXZpZXcocmVwbHlUbyk7XHJcbiAgICBjb25zdCBzZW5kZXIgPSAocmVwbHkuc2VuZGVyX25hbWUgfHwgJ21lc3NhZ2UnKS5yZXBsYWNlKC9cXF0vZywgJycpLnRyaW0oKTtcclxuICAgIGNvbnN0IGV4Y2VycHQgPSB0aGlzLnJlcGx5RXhjZXJwdChyZXBseS5jb250ZW50IHx8ICcnKTtcclxuICAgIHJldHVybiBgW1JlcGx5IHRvICR7c2VuZGVyfV1cXG4+ICR7ZXhjZXJwdH1cXG5cXG4ke2JvZHl9YDtcclxuICB9XHJcblxyXG4gIGNyZWF0ZVJlcGx5UHJldmlldyhtZXNzYWdlOiBNZXNzYWdlKTogTWVzc2FnZVJlcGx5UHJldmlldyB7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICBtZXNzYWdlX2lkOiBTdHJpbmcobWVzc2FnZS5tZXNzYWdlX2lkIHx8ICcnKSxcclxuICAgICAgc2VuZGVyX25hbWU6IGdldE1lc3NhZ2VTZW5kZXJOYW1lKG1lc3NhZ2UpICE9PSAnVW5rbm93bidcclxuICAgICAgICA/IGdldE1lc3NhZ2VTZW5kZXJOYW1lKG1lc3NhZ2UpXHJcbiAgICAgICAgOiB0aGlzLmdldENvbnRhY3ROYW1lQnlJZChtZXNzYWdlLnNlbmRlcl9pZCksXHJcbiAgICAgIGNvbnRlbnQ6IHRoaXMucmVwbHlFeGNlcnB0KFN0cmluZyhtZXNzYWdlLmNvbnRlbnQgfHwgJycpKSxcclxuICAgIH07XHJcbiAgfVxyXG5cclxuICBzaG93VG9hc3QobWVzc2FnZTogc3RyaW5nLCB0eXBlOiAnaW5mbycgfCAnc3VjY2VzcycgfCAnZXJyb3InID0gJ2luZm8nLCBkdXJhdGlvbk1zID0gMzAwMCk6IHZvaWQge1xyXG4gICAgaWYgKHRoaXMudG9hc3RUaW1lcikge1xyXG4gICAgICBjbGVhclRpbWVvdXQodGhpcy50b2FzdFRpbWVyKTtcclxuICAgICAgdGhpcy50b2FzdFRpbWVyID0gbnVsbDtcclxuICAgIH1cclxuICAgIHRoaXMudG9hc3QkLm5leHQoeyBtZXNzYWdlLCB0eXBlIH0pO1xyXG4gICAgdGhpcy50b2FzdFRpbWVyID0gc2V0VGltZW91dCgoKSA9PiB7XHJcbiAgICAgIHRoaXMudG9hc3QkLm5leHQobnVsbCk7XHJcbiAgICAgIHRoaXMudG9hc3RUaW1lciA9IG51bGw7XHJcbiAgICB9LCBkdXJhdGlvbk1zKTtcclxuICB9XHJcblxyXG4gIGdldFNpZGViYXJTaWRlKCk6IFNpZGViYXJTaWRlIHtcclxuICAgIHJldHVybiB0aGlzLnNpZGViYXJTaWRlJC52YWx1ZTtcclxuICB9XHJcblxyXG4gIC8vIOKUgOKUgCBJbmJveCDilIDilIBcclxuICBsb2FkSW5ib3goKTogdm9pZCB7XHJcbiAgICBjb25zdCBjb250YWN0SWQgPSB0aGlzLmF1dGguY29udGFjdElkO1xyXG4gICAgaWYgKCFjb250YWN0SWQpIHJldHVybjtcclxuXHJcbiAgICB0aGlzLmFwaS5nZXRJbmJveChjb250YWN0SWQpLnN1YnNjcmliZSh7XHJcbiAgICAgIG5leHQ6IChpdGVtcykgPT4ge1xyXG4gICAgICAgIGNvbnN0IG1hcHBlZCA9IGl0ZW1zLm1hcChpdGVtID0+IHtcclxuICAgICAgICAgIGNvbnN0IGlzR3JvdXAgPSBpdGVtLmlzX2dyb3VwID09PSB0cnVlIHx8IChpdGVtLmlzX2dyb3VwIGFzIGFueSkgPT09ICdUcnVlJztcclxuICAgICAgICAgIGNvbnN0IGNvbnZlcnNhdGlvbklkID0gU3RyaW5nKGl0ZW0uY29udmVyc2F0aW9uX2lkKTtcclxuICAgICAgICAgIGNvbnN0IHByZXZpZXcgPSB0aGlzLnJlcGx5Qm9keVRleHQoaXRlbS5sYXN0X21lc3NhZ2VfcHJldmlldyB8fCAnJyk7XHJcbiAgICAgICAgICBjb25zdCBoYXNNZW50aW9uID1cclxuICAgICAgICAgICAgdGhpcy5tZW50aW9uQ29udmVyc2F0aW9uSWRzJC52YWx1ZS5oYXMoY29udmVyc2F0aW9uSWQpIHx8XHJcbiAgICAgICAgICAgIChOdW1iZXIoaXRlbS51bnJlYWRfY291bnQgfHwgMCkgPiAwICYmIHRoaXMubWVzc2FnZVRleHRNZW50aW9uc0N1cnJlbnRVc2VyKHByZXZpZXcpKTtcclxuICAgICAgICAgIFxyXG4gICAgICAgICAgaWYgKCFpc0dyb3VwICYmICFpdGVtLm5hbWUgJiYgaXRlbS5vdGhlcl9wYXJ0aWNpcGFudF9uYW1lKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB7IC4uLml0ZW0sIG5hbWU6IGl0ZW0ub3RoZXJfcGFydGljaXBhbnRfbmFtZSwgbGFzdF9tZXNzYWdlX3ByZXZpZXc6IHByZXZpZXcsIGlzX2dyb3VwOiBmYWxzZSwgaGFzX21lbnRpb246IGhhc01lbnRpb24gfTtcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIHJldHVybiB7IC4uLml0ZW0sIGxhc3RfbWVzc2FnZV9wcmV2aWV3OiBwcmV2aWV3LCBpc19ncm91cDogaXNHcm91cCwgaGFzX21lbnRpb246IGhhc01lbnRpb24gfTtcclxuICAgICAgICB9KS5maWx0ZXIoaXRlbSA9PlxyXG4gICAgICAgICAgIXRoaXMuZGVsZXRpbmdDb252ZXJzYXRpb25JZHMuaGFzKFN0cmluZyhpdGVtLmNvbnZlcnNhdGlvbl9pZCkpICYmXHJcbiAgICAgICAgICAhdGhpcy5yZW1vdmVkR3JvdXBJZHMkLnZhbHVlLmhhcyhTdHJpbmcoaXRlbS5jb252ZXJzYXRpb25faWQpKVxyXG4gICAgICAgICk7XHJcbiAgICAgICAgdGhpcy5pbmJveCQubmV4dChtYXBwZWQpO1xyXG4gICAgICAgIHRoaXMucmVjYWxjVW5yZWFkKG1hcHBlZCk7XHJcblxyXG4gICAgICAgIGNvbnN0IGlkcyA9IG1hcHBlZC5tYXAoKGkpID0+IGkuY29udmVyc2F0aW9uX2lkKTtcclxuICAgICAgICB0aGlzLndzU2VydmljZS5zdWJzY3JpYmVBbGwoaWRzKTtcclxuICAgICAgfSxcclxuICAgICAgZXJyb3I6ICgpID0+IHt9LFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvLyDilIDilIAgQ29udGFjdHMg4pSA4pSAXHJcbiAgbG9hZFZpc2libGVDb250YWN0cygpOiB2b2lkIHtcclxuICAgIGNvbnN0IGNvbnRhY3RJZCA9IHRoaXMuYXV0aC5jb250YWN0SWQ7XHJcbiAgICBpZiAoIWNvbnRhY3RJZCkgcmV0dXJuO1xyXG5cclxuICAgIHRoaXMuYXBpLmdldFZpc2libGVDb250YWN0cyhjb250YWN0SWQpLnN1YnNjcmliZSh7XHJcbiAgICAgIG5leHQ6IChjb250YWN0cykgPT4ge1xyXG4gICAgICAgIHRoaXMudmlzaWJsZUNvbnRhY3RzJC5uZXh0KGNvbnRhY3RzKTtcclxuICAgICAgICBcclxuICAgICAgICBjb25zdCBjdXJyZW50Q29udGFjdCA9IHRoaXMuYXV0aC5jdXJyZW50Q29udGFjdDtcclxuICAgICAgICBpZiAoY3VycmVudENvbnRhY3QgJiYgY3VycmVudENvbnRhY3QuZW1haWwpIHtcclxuICAgICAgICAgIGNvbnN0IG1hdGNoID0gY29udGFjdHMuZmluZChjID0+IGMuZW1haWwgPT09IGN1cnJlbnRDb250YWN0LmVtYWlsKTtcclxuICAgICAgICAgIGlmIChcclxuICAgICAgICAgICAgbWF0Y2ggJiZcclxuICAgICAgICAgICAgU3RyaW5nKG1hdGNoLmNvbnRhY3RfaWQpICE9PSBTdHJpbmcoY3VycmVudENvbnRhY3QuY29udGFjdF9pZClcclxuICAgICAgICAgICkge1xyXG4gICAgICAgICAgICB0aGlzLmF1dGguc2V0U2Vzc2lvbih0aGlzLmF1dGguc2Vzc2lvbkdpZCEsIHsgLi4uY3VycmVudENvbnRhY3QsIGNvbnRhY3RfaWQ6IG1hdGNoLmNvbnRhY3RfaWQgfSk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB0aGlzLndzU2VydmljZS5kaXNjb25uZWN0KCk7XHJcbiAgICAgICAgICAgIHRoaXMud3NTZXJ2aWNlLmNvbm5lY3QobWF0Y2guY29udGFjdF9pZCwgdGhpcy5hdXRoLnNlc3Npb25HaWQhKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgIH0sXHJcbiAgICAgIGVycm9yOiAoKSA9PiB7fSxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLy8g4pSA4pSAIENvbnZlcnNhdGlvbnMg4pSA4pSAXHJcbiAgb3BlbkNvbnZlcnNhdGlvbihjb252ZXJzYXRpb25JZDogc3RyaW5nLCBuYW1lOiBzdHJpbmcsIGlzR3JvdXAgPSBmYWxzZSk6IHZvaWQge1xyXG4gICAgaWYgKCFjb252ZXJzYXRpb25JZCB8fCBjb252ZXJzYXRpb25JZCA9PT0gJ3VuZGVmaW5lZCcpIHtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgdGhpcy5hY3RpdmVDb252ZXJzYXRpb25JZCQubmV4dChjb252ZXJzYXRpb25JZCk7XHJcbiAgICB0aGlzLmFjdGl2ZVZpZXckLm5leHQoJ2NoYXQnKTtcclxuICAgIHRoaXMub3BlblBhbmVsKCk7XHJcblxyXG4gICAgY29uc3QgY2hhdHMgPSB0aGlzLm9wZW5DaGF0cyQudmFsdWU7XHJcbiAgICBpZiAoIWNoYXRzLmZpbmQoKGMpID0+IGMuY29udmVyc2F0aW9uSWQgPT09IGNvbnZlcnNhdGlvbklkKSkge1xyXG4gICAgICB0aGlzLm9wZW5DaGF0cyQubmV4dChbXHJcbiAgICAgICAgLi4uY2hhdHMsXHJcbiAgICAgICAgeyBjb252ZXJzYXRpb25JZCwgbmFtZSwgaXNHcm91cCwgaXNNaW5pbWl6ZWQ6IGZhbHNlLCB1bnJlYWRDb3VudDogMCB9LFxyXG4gICAgICBdKTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBleGlzdGluZyA9IHRoaXMubWVzc2FnZXNNYXAkLnZhbHVlLmdldChjb252ZXJzYXRpb25JZCk7XHJcbiAgICBpZiAoIWV4aXN0aW5nIHx8IGV4aXN0aW5nLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICB0aGlzLmxvYWRNZXNzYWdlcyhjb252ZXJzYXRpb25JZCk7XHJcbiAgICB9XHJcbiAgICB0aGlzLm1hcmtBc1JlYWQoY29udmVyc2F0aW9uSWQpO1xyXG4gICAgdGhpcy53c1NlcnZpY2Uuc3Vic2NyaWJlKGNvbnZlcnNhdGlvbklkKTtcclxuICB9XHJcblxyXG4gIGNsb3NlQ2hhdChjb252ZXJzYXRpb25JZDogc3RyaW5nKTogdm9pZCB7XHJcbiAgICBjb25zdCBjaGF0cyA9IHRoaXMub3BlbkNoYXRzJC52YWx1ZS5maWx0ZXIoKGMpID0+IGMuY29udmVyc2F0aW9uSWQgIT09IGNvbnZlcnNhdGlvbklkKTtcclxuICAgIHRoaXMub3BlbkNoYXRzJC5uZXh0KGNoYXRzKTtcclxuXHJcbiAgICBpZiAoU3RyaW5nKHRoaXMuYWN0aXZlQ29udmVyc2F0aW9uSWQkLnZhbHVlKSA9PT0gU3RyaW5nKGNvbnZlcnNhdGlvbklkKSkge1xyXG4gICAgICB0aGlzLmFjdGl2ZUNvbnZlcnNhdGlvbklkJC5uZXh0KG51bGwpO1xyXG4gICAgICB0aGlzLmFjdGl2ZVZpZXckLm5leHQoJ2luYm94Jyk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBtYXJrR3JvdXBSZW1vdmVkKGNvbnZlcnNhdGlvbklkOiBzdHJpbmcpOiB2b2lkIHtcclxuICAgIGNvbnN0IGlkID0gU3RyaW5nKGNvbnZlcnNhdGlvbklkKTtcclxuICAgIGlmICghaWQgfHwgaWQgPT09ICd1bmRlZmluZWQnKSByZXR1cm47XHJcblxyXG4gICAgY29uc3QgbmV4dCA9IG5ldyBTZXQodGhpcy5yZW1vdmVkR3JvdXBJZHMkLnZhbHVlKTtcclxuICAgIG5leHQuYWRkKGlkKTtcclxuICAgIHRoaXMucmVtb3ZlZEdyb3VwSWRzJC5uZXh0KG5leHQpO1xyXG5cclxuICAgIGNvbnN0IGl0ZW1zID0gdGhpcy5pbmJveCQudmFsdWUuZmlsdGVyKGkgPT4gU3RyaW5nKGkuY29udmVyc2F0aW9uX2lkKSAhPT0gaWQpO1xyXG4gICAgdGhpcy5pbmJveCQubmV4dChpdGVtcyk7XHJcbiAgICB0aGlzLnJlY2FsY1VucmVhZChpdGVtcyk7XHJcblxyXG4gICAgaWYgKCF0aGlzLnJlbW92YWxUb2FzdFNob3duLmhhcyhpZCkpIHtcclxuICAgICAgdGhpcy5yZW1vdmFsVG9hc3RTaG93bi5hZGQoaWQpO1xyXG4gICAgICB0aGlzLnNob3dUb2FzdCgnWW91IHdlcmUgcmVtb3ZlZCBmcm9tIHRoaXMgZ3JvdXAnLCAnaW5mbycsIDUwMDApO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgZXhpdFJlbW92ZWRHcm91cChjb252ZXJzYXRpb25JZDogc3RyaW5nKTogdm9pZCB7XHJcbiAgICBjb25zdCBpZCA9IFN0cmluZyhjb252ZXJzYXRpb25JZCk7XHJcbiAgICBjb25zdCBuZXh0ID0gbmV3IFNldCh0aGlzLnJlbW92ZWRHcm91cElkcyQudmFsdWUpO1xyXG4gICAgbmV4dC5kZWxldGUoaWQpO1xyXG4gICAgdGhpcy5yZW1vdmVkR3JvdXBJZHMkLm5leHQobmV4dCk7XHJcbiAgICB0aGlzLnJlbW92YWxUb2FzdFNob3duLmRlbGV0ZShpZCk7XHJcbiAgICB0aGlzLnJlbW92ZUNvbnZlcnNhdGlvbkZyb21VaShpZCk7XHJcbiAgfVxyXG5cclxuICAvLyDilIDilIAgTWVzc2FnZXMg4pSA4pSAXHJcbiAgbG9hZE1lc3NhZ2VzKGNvbnZlcnNhdGlvbklkOiBzdHJpbmcsIGJlZm9yZU1lc3NhZ2VJZD86IHN0cmluZywgc2tpcFJlYWN0aW9uSHlkcmF0aW9uID0gZmFsc2UpOiB2b2lkIHtcclxuICAgIGlmICghY29udmVyc2F0aW9uSWQgfHwgY29udmVyc2F0aW9uSWQgPT09ICd1bmRlZmluZWQnKSB7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIGNvbnN0IGNvbnRhY3RJZCA9IHRoaXMuYXV0aC5jb250YWN0SWQ7XHJcbiAgICBpZiAoIWNvbnRhY3RJZCkgcmV0dXJuO1xyXG5cclxuICAgIHRoaXMubG9hZGluZ01lc3NhZ2VzJC5uZXh0KHRydWUpO1xyXG5cclxuICAgIHRoaXMuYXBpLmdldE1lc3NhZ2VzKGNvbnZlcnNhdGlvbklkLCBjb250YWN0SWQsIGJlZm9yZU1lc3NhZ2VJZCwgNTApLnN1YnNjcmliZSh7XHJcbiAgICAgIG5leHQ6IChtZXNzYWdlcykgPT4ge1xyXG4gICAgICAgIGNvbnN0IG1hcCA9IG5ldyBNYXAodGhpcy5tZXNzYWdlc01hcCQudmFsdWUpO1xyXG4gICAgICAgIGNvbnN0IGV4aXN0aW5nID0gbWFwLmdldChjb252ZXJzYXRpb25JZCkgfHwgW107XHJcblxyXG4gICAgICAgIGNvbnN0IG5vcm1hbGl6ZWQgPSBtZXNzYWdlcy5tYXAoKG06IGFueSkgPT4gdGhpcy5ub3JtYWxpemVNZXNzYWdlU2hhcGUobSkpO1xyXG4gICAgICAgIGNvbnN0IHNvcnRlZCA9IFsuLi5ub3JtYWxpemVkXS5zb3J0KChhLCBiKSA9PiBcclxuICAgICAgICAgIG5ldyBEYXRlKGEuY3JlYXRlZF9hdCkuZ2V0VGltZSgpIC0gbmV3IERhdGUoYi5jcmVhdGVkX2F0KS5nZXRUaW1lKClcclxuICAgICAgICApO1xyXG4gICAgICAgIHNvcnRlZC5mb3JFYWNoKChtKSA9PiB0aGlzLmRldGVjdEdyb3VwUmVtb3ZhbEZvckN1cnJlbnRVc2VyKG0pKTtcclxuXHJcbiAgICAgICAgY29uc3QgZXhpc3RpbmdCeUlkID0gbmV3IE1hcChleGlzdGluZy5tYXAobSA9PiBbU3RyaW5nKG0ubWVzc2FnZV9pZCksIG1dKSk7XHJcblxyXG4gICAgICAgIGlmIChiZWZvcmVNZXNzYWdlSWQpIHtcclxuICAgICAgICAgIC8vIFByZXBlbmQgb2xkZXIgbWVzc2FnZXMsIHByZXNlcnZpbmcgZXhpc3RpbmcgcmVhY3Rpb25zXHJcbiAgICAgICAgICBjb25zdCBtZXJnZWQgPSBbLi4uc29ydGVkLCAuLi5leGlzdGluZ107XHJcbiAgICAgICAgICBtYXAuc2V0KGNvbnZlcnNhdGlvbklkLCBtZXJnZWQpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAvLyBSZXBsYWNlIHdpdGggc2VydmVyIGRhdGEgYnV0IGtlZXAgdGhlIHJpY2hlciBvZiBleGlzdGluZyB2cyBzZXJ2ZXIgYXR0YWNobWVudHNcclxuICAgICAgICAgIC8vICh0aGUgb3B0aW1pc3RpYyBwYXRoIG1heSBoYXZlIG1vcmUgYXR0YWNobWVudCBtZXRhZGF0YSB0aGFuIHRoZSBzZXJ2ZXIgZWNob2VzIGJhY2spLlxyXG4gICAgICAgICAgY29uc3QgbWVyZ2VkID0gc29ydGVkLm1hcChtID0+IHtcclxuICAgICAgICAgICAgY29uc3QgY2FjaGVkID0gZXhpc3RpbmdCeUlkLmdldChTdHJpbmcobS5tZXNzYWdlX2lkKSk7XHJcbiAgICAgICAgICAgIGlmICghY2FjaGVkKSByZXR1cm4gbTtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMubWVyZ2VNZXNzYWdlQXR0YWNobWVudHMoY2FjaGVkLCBtKTtcclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgbWFwLnNldChjb252ZXJzYXRpb25JZCwgbWVyZ2VkKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMubWVzc2FnZXNNYXAkLm5leHQobWFwKTtcclxuICAgICAgICB0aGlzLmh5ZHJhdGVSZWFjdGlvbnNGb3JDb252ZXJzYXRpb24oXHJcbiAgICAgICAgICBjb252ZXJzYXRpb25JZCxcclxuICAgICAgICAgIG1hcC5nZXQoY29udmVyc2F0aW9uSWQpIHx8IFtdLFxyXG4gICAgICAgICAgc2tpcFJlYWN0aW9uSHlkcmF0aW9uXHJcbiAgICAgICAgKTtcclxuICAgICAgICB0aGlzLmxvYWRpbmdNZXNzYWdlcyQubmV4dChmYWxzZSk7XHJcbiAgICAgIH0sXHJcbiAgICAgIGVycm9yOiAoKSA9PiB7XHJcbiAgICAgICAgdGhpcy5sb2FkaW5nTWVzc2FnZXMkLm5leHQoZmFsc2UpO1xyXG4gICAgICB9LFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBzZW5kTWVzc2FnZShcclxuICAgIGNvbnZlcnNhdGlvbklkOiBzdHJpbmcgfCBudWxsLFxyXG4gICAgY29udGVudDogc3RyaW5nLFxyXG4gICAgbWVzc2FnZVR5cGU6ICdURVhUJyB8ICdJTUFHRScgfCAnU1lTVEVNJyA9ICdURVhUJyxcclxuICAgIG9wdGlvbnM/OiB7IHJlcGx5VG8/OiBNZXNzYWdlIHwgbnVsbDsgbWVudGlvbnM/OiBzdHJpbmdbXSB9XHJcbiAgKTogdm9pZCB7XHJcbiAgICBjb25zdCBjb250YWN0SWQgPSB0aGlzLmF1dGguY29udGFjdElkO1xyXG4gICAgaWYgKCFjb250YWN0SWQpIHJldHVybjtcclxuXHJcbiAgICBjb25zdCBwZW5kaW5nID0gdGhpcy5wZW5kaW5nRG1SZWNpcGllbnQkLnZhbHVlO1xyXG4gICAgaWYgKCFjb252ZXJzYXRpb25JZCAmJiBwZW5kaW5nKSB7XHJcbiAgICAgIHRoaXMuc2VuZERpcmVjdE1lc3NhZ2UocGVuZGluZy5jb250YWN0SWQsIGNvbnRlbnQpO1xyXG4gICAgICB0aGlzLnBlbmRpbmdEbVJlY2lwaWVudCQubmV4dChudWxsKTtcclxuICAgICAgY29uc3QgY2hhdHMgPSB0aGlzLm9wZW5DaGF0cyQudmFsdWUuZmlsdGVyKGMgPT4gYy5jb252ZXJzYXRpb25JZCAhPT0gJ3BlbmRpbmcnKTtcclxuICAgICAgdGhpcy5vcGVuQ2hhdHMkLm5leHQoY2hhdHMpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKCFjb252ZXJzYXRpb25JZCkgcmV0dXJuO1xyXG5cclxuICAgIGNvbnN0IG91dGdvaW5nQ29udGVudCA9IHRoaXMucHJlcGFyZU91dGdvaW5nTWVzc2FnZUNvbnRlbnQoY29udGVudCwgb3B0aW9ucz8ucmVwbHlUbyB8fCBudWxsKTtcclxuICAgIGNvbnN0IHJlcGx5VG8gPSBvcHRpb25zPy5yZXBseVRvID8gdGhpcy5jcmVhdGVSZXBseVByZXZpZXcob3B0aW9ucy5yZXBseVRvKSA6IHVuZGVmaW5lZDtcclxuICAgIGNvbnN0IHRlbXBNZXNzYWdlSWQgPSAndGVtcC0nICsgRGF0ZS5ub3coKTtcclxuICAgIGNvbnN0IG9wdGltaXN0aWM6IE1lc3NhZ2UgPSB7XHJcbiAgICAgIG1lc3NhZ2VfaWQ6IHRlbXBNZXNzYWdlSWQsXHJcbiAgICAgIGNvbnZlcnNhdGlvbl9pZDogY29udmVyc2F0aW9uSWQsXHJcbiAgICAgIHNlbmRlcl9pZDogY29udGFjdElkLFxyXG4gICAgICBzZW5kZXJfbmFtZTogJ1lvdScsXHJcbiAgICAgIG1lc3NhZ2VfdHlwZTogbWVzc2FnZVR5cGUsXHJcbiAgICAgIGNvbnRlbnQsXHJcbiAgICAgIHJlcGx5X3RvOiByZXBseVRvLFxyXG4gICAgICBtZW50aW9uczogb3B0aW9ucz8ubWVudGlvbnMsXHJcbiAgICAgIGNyZWF0ZWRfYXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcclxuICAgICAgaXNfcmVhZDogZmFsc2UsXHJcbiAgICB9O1xyXG4gICAgdGhpcy5hcHBlbmRNZXNzYWdlKG9wdGltaXN0aWMpO1xyXG5cclxuICAgIHRoaXMuYXBpLnNlbmRNZXNzYWdlKGNvbnZlcnNhdGlvbklkLCBjb250YWN0SWQsIG91dGdvaW5nQ29udGVudCwgbWVzc2FnZVR5cGUpLnN1YnNjcmliZSh7XHJcbiAgICAgIG5leHQ6IChyZXMpID0+IHtcclxuICAgICAgICBjb25zdCByZWFsSWQgPSByZXM/Lm1lc3NhZ2VfaWQgPz8gcmVzPy5pZCA/PyByZXM/Lm1lc3NhZ2VJZDtcclxuICAgICAgICBpZiAocmVhbElkID09IG51bGwgfHwgU3RyaW5nKHJlYWxJZCkuc3RhcnRzV2l0aCgndGVtcC0nKSkge1xyXG4gICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgICBjb25zdCBwaWNrZWRDb250ZW50ID0gdGhpcy5jb2FsZXNjZU1lc3NhZ2VUZXh0KHJlcywgb3V0Z29pbmdDb250ZW50IHx8IG9wdGltaXN0aWMuY29udGVudCk7XHJcbiAgICAgICAgY29uc3QgbWVyZ2VkID0gdGhpcy5ub3JtYWxpemVNZXNzYWdlU2hhcGUoe1xyXG4gICAgICAgICAgLi4ub3B0aW1pc3RpYyxcclxuICAgICAgICAgIC4uLnJlcyxcclxuICAgICAgICAgIG1lc3NhZ2VfaWQ6IFN0cmluZyhyZWFsSWQpLFxyXG4gICAgICAgICAgY29udmVyc2F0aW9uX2lkOiBjb252ZXJzYXRpb25JZCxcclxuICAgICAgICAgIG1lc3NhZ2VfdHlwZTogbWVzc2FnZVR5cGUgPT09ICdTWVNURU0nID8gJ1NZU1RFTScgOiByZXM/Lm1lc3NhZ2VfdHlwZSA/PyBvcHRpbWlzdGljLm1lc3NhZ2VfdHlwZSxcclxuICAgICAgICAgIGNvbnRlbnQ6IHBpY2tlZENvbnRlbnQsXHJcbiAgICAgICAgICByZXBseV90bzogcmVwbHlUbyA/PyByZXM/LnJlcGx5X3RvLFxyXG4gICAgICAgICAgbWVudGlvbnM6IG9wdGlvbnM/Lm1lbnRpb25zID8/IHJlcz8ubWVudGlvbnMsXHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgY29uc3QgbWFwID0gbmV3IE1hcCh0aGlzLm1lc3NhZ2VzTWFwJC52YWx1ZSk7XHJcbiAgICAgICAgY29uc3QgbXNncyA9IFsuLi4obWFwLmdldChjb252ZXJzYXRpb25JZCkgfHwgW10pXTtcclxuICAgICAgICBjb25zdCBpZHggPSBtc2dzLmZpbmRJbmRleCgobSkgPT4gbS5tZXNzYWdlX2lkID09PSB0ZW1wTWVzc2FnZUlkKTtcclxuICAgICAgICBpZiAoaWR4ID49IDApIHtcclxuICAgICAgICAgIG1zZ3NbaWR4XSA9IG1lcmdlZDtcclxuICAgICAgICAgIG1hcC5zZXQoY29udmVyc2F0aW9uSWQsIHRoaXMuZGVkdXBlTWVzc2FnZXNCeUlkS2VlcEZpcnN0KG1zZ3MpKTtcclxuICAgICAgICAgIHRoaXMubWVzc2FnZXNNYXAkLm5leHQobWFwKTtcclxuICAgICAgICAgIHRoaXMucmVmcmVzaE1lc3NhZ2VSZWFjdGlvbnMobWVyZ2VkLm1lc3NhZ2VfaWQpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSxcclxuICAgICAgZXJyb3I6ICgpID0+IHt9LFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBvcGVuRGlyZWN0Q29udmVyc2F0aW9uKHJlY2lwaWVudENvbnRhY3RJZDogc3RyaW5nLCBkaXNwbGF5TmFtZTogc3RyaW5nKTogdm9pZCB7XHJcbiAgICBjb25zdCBleGlzdGluZyA9IHRoaXMuaW5ib3gkLnZhbHVlLmZpbmQoaXRlbSA9PiBcclxuICAgICAgIWl0ZW0uaXNfZ3JvdXAgJiYgaXRlbS5uYW1lID09PSBkaXNwbGF5TmFtZVxyXG4gICAgKTtcclxuICAgIFxyXG4gICAgaWYgKGV4aXN0aW5nKSB7XHJcbiAgICAgIHRoaXMucGVuZGluZ0RtUmVjaXBpZW50JC5uZXh0KG51bGwpO1xyXG4gICAgICB0aGlzLm9wZW5Db252ZXJzYXRpb24oZXhpc3RpbmcuY29udmVyc2F0aW9uX2lkLCBkaXNwbGF5TmFtZSwgZmFsc2UpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgdGhpcy5wZW5kaW5nRG1SZWNpcGllbnQkLm5leHQoe2NvbnRhY3RJZDogcmVjaXBpZW50Q29udGFjdElkLCBuYW1lOiBkaXNwbGF5TmFtZX0pO1xyXG4gICAgICB0aGlzLmFjdGl2ZUNvbnZlcnNhdGlvbklkJC5uZXh0KG51bGwpO1xyXG4gICAgICB0aGlzLmFjdGl2ZVZpZXckLm5leHQoJ2NoYXQnKTtcclxuICAgICAgdGhpcy5vcGVuUGFuZWwoKTtcclxuICAgICAgXHJcbiAgICAgIGNvbnN0IGNoYXRzID0gdGhpcy5vcGVuQ2hhdHMkLnZhbHVlO1xyXG4gICAgICBpZiAoIWNoYXRzLmZpbmQoYyA9PiBjLmNvbnZlcnNhdGlvbklkID09PSAncGVuZGluZycpKSB7XHJcbiAgICAgICAgdGhpcy5vcGVuQ2hhdHMkLm5leHQoWy4uLmNoYXRzLCB7XHJcbiAgICAgICAgICBjb252ZXJzYXRpb25JZDogJ3BlbmRpbmcnLFxyXG4gICAgICAgICAgbmFtZTogZGlzcGxheU5hbWUsXHJcbiAgICAgICAgICBpc0dyb3VwOiBmYWxzZSxcclxuICAgICAgICAgIGlzTWluaW1pemVkOiBmYWxzZSxcclxuICAgICAgICAgIHVucmVhZENvdW50OiAwXHJcbiAgICAgICAgfV0pO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBzZW5kRGlyZWN0TWVzc2FnZShyZWNpcGllbnRDb250YWN0SWQ6IHN0cmluZywgY29udGVudDogc3RyaW5nKTogdm9pZCB7XHJcbiAgICBjb25zdCBjb250YWN0SWQgPSB0aGlzLmF1dGguY29udGFjdElkO1xyXG4gICAgaWYgKCFjb250YWN0SWQpIHJldHVybjtcclxuXHJcbiAgICB0aGlzLmFwaS5zZW5kRGlyZWN0TWVzc2FnZShjb250YWN0SWQsIHJlY2lwaWVudENvbnRhY3RJZCwgY29udGVudCkuc3Vic2NyaWJlKHtcclxuICAgICAgbmV4dDogKHJlcykgPT4ge1xyXG4gICAgICAgIHRoaXMubG9hZEluYm94KCk7XHJcbiAgICAgICAgLy8gQmFja2VuZCBtYXkgcmV0dXJuIGNvbnZlcnNhdGlvbl9pZCwgaWQsIG9yIGNvbnZlcnNhdGlvbklkXHJcbiAgICAgICAgY29uc3QgY29udklkID0gU3RyaW5nKHJlcz8uY29udmVyc2F0aW9uX2lkIHx8IHJlcz8uaWQgfHwgcmVzPy5jb252ZXJzYXRpb25JZCB8fCAnJyk7XHJcbiAgICAgICAgaWYgKGNvbnZJZCkge1xyXG4gICAgICAgICAgY29uc3QgcmVjaXBpZW50ID0gdGhpcy52aXNpYmxlQ29udGFjdHMkLnZhbHVlLmZpbmQoXHJcbiAgICAgICAgICAgIChjKSA9PiBjLmNvbnRhY3RfaWQgPT09IHJlY2lwaWVudENvbnRhY3RJZFxyXG4gICAgICAgICAgKTtcclxuICAgICAgICAgIGNvbnN0IG5hbWUgPSByZWNpcGllbnQgPyBnZXRDb250YWN0RGlzcGxheU5hbWUocmVjaXBpZW50KSA6ICdEaXJlY3QgTWVzc2FnZSc7XHJcbiAgICAgICAgICB0aGlzLm9wZW5Db252ZXJzYXRpb24oY29udklkLCBuYW1lLCBmYWxzZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9LFxyXG4gICAgICBlcnJvcjogKCkgPT4ge30sXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIGNyZWF0ZUdyb3VwQ29udmVyc2F0aW9uKFxyXG4gICAgcGFydGljaXBhbnRJZHM6IHN0cmluZ1tdLFxyXG4gICAgbmFtZTogc3RyaW5nLFxyXG4gICAgY2FsbGJhY2tzPzogeyBzdWNjZXNzPzogKCkgPT4gdm9pZDsgZXJyb3I/OiAoKSA9PiB2b2lkIH1cclxuICApOiB2b2lkIHtcclxuICAgIGNvbnN0IGNvbnRhY3RJZCA9IHRoaXMuYXV0aC5jb250YWN0SWQ7XHJcbiAgICBpZiAoIWNvbnRhY3RJZCkge1xyXG4gICAgICBjYWxsYmFja3M/LmVycm9yPy4oKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGFsbFBhcnRpY2lwYW50cyA9IHBhcnRpY2lwYW50SWRzLmluY2x1ZGVzKGNvbnRhY3RJZClcclxuICAgICAgPyBwYXJ0aWNpcGFudElkc1xyXG4gICAgICA6IFtjb250YWN0SWQsIC4uLnBhcnRpY2lwYW50SWRzXTtcclxuXHJcbiAgICB0aGlzLmFwaS5jcmVhdGVDb252ZXJzYXRpb24oY29udGFjdElkLCBhbGxQYXJ0aWNpcGFudHMsIG5hbWUpLnN1YnNjcmliZSh7XHJcbiAgICAgIG5leHQ6IChjb252KSA9PiB7XHJcbiAgICAgICAgLy8gQmFja2VuZCBtYXkgcmV0dXJuIGNvbnZlcnNhdGlvbl9pZCwgaWQsIG9yIGNvbnZlcnNhdGlvbklkXHJcbiAgICAgICAgY29uc3QgY29udklkID0gU3RyaW5nKFxyXG4gICAgICAgICAgdHlwZW9mIGNvbnYgPT09ICdzdHJpbmcnIHx8IHR5cGVvZiBjb252ID09PSAnbnVtYmVyJ1xyXG4gICAgICAgICAgICA/IGNvbnZcclxuICAgICAgICAgICAgOiAoY29udiBhcyBhbnkpPy5jb252ZXJzYXRpb25faWQgfHwgKGNvbnYgYXMgYW55KT8uaWQgfHwgKGNvbnYgYXMgYW55KT8uY29udmVyc2F0aW9uSWQgfHwgJydcclxuICAgICAgICApO1xyXG4gICAgICAgIGlmICghY29udklkKSB7XHJcbiAgICAgICAgICB0aGlzLmxvYWRJbmJveCgpO1xyXG4gICAgICAgICAgY2FsbGJhY2tzPy5lcnJvcj8uKCk7XHJcbiAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMubG9hZEluYm94KCk7XHJcbiAgICAgICAgdGhpcy5jbGVhckdyb3VwU2V0dGluZ3MoKTtcclxuICAgICAgICB0aGlzLm9wZW5Db252ZXJzYXRpb24oY29udklkLCBuYW1lLCB0cnVlKTtcclxuICAgICAgICBjYWxsYmFja3M/LnN1Y2Nlc3M/LigpO1xyXG4gICAgICB9LFxyXG4gICAgICBlcnJvcjogKCkgPT4ge1xyXG4gICAgICAgIGNhbGxiYWNrcz8uZXJyb3I/LigpO1xyXG4gICAgICB9LFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBvcGVuR3JvdXBTZXR0aW5ncyhjb252ZXJzYXRpb25JZDogc3RyaW5nLCBuYW1lOiBzdHJpbmcpOiB2b2lkIHtcclxuICAgIHRoaXMuZ3JvdXBTZXR0aW5ncyQubmV4dCh7IGNvbnZlcnNhdGlvbklkLCBuYW1lIH0pO1xyXG4gICAgdGhpcy5zZXRWaWV3KCdncm91cC1tYW5hZ2VyJyk7XHJcbiAgfVxyXG5cclxuICBjbGVhckdyb3VwU2V0dGluZ3MoKTogdm9pZCB7XHJcbiAgICB0aGlzLmdyb3VwU2V0dGluZ3MkLm5leHQobnVsbCk7XHJcbiAgfVxyXG5cclxuICBtYXJrQXNSZWFkKGNvbnZlcnNhdGlvbklkOiBzdHJpbmcpOiB2b2lkIHtcclxuICAgIGlmICghY29udmVyc2F0aW9uSWQgfHwgY29udmVyc2F0aW9uSWQgPT09ICd1bmRlZmluZWQnKSByZXR1cm47XHJcbiAgICBjb25zdCBjb250YWN0SWQgPSB0aGlzLmF1dGguY29udGFjdElkO1xyXG4gICAgaWYgKCFjb250YWN0SWQpIHJldHVybjtcclxuXHJcbiAgICB0aGlzLmFwaS5tYXJrQ29udmVyc2F0aW9uUmVhZChjb252ZXJzYXRpb25JZCwgY29udGFjdElkKS5zdWJzY3JpYmUoe1xyXG4gICAgICBuZXh0OiAoKSA9PiB7XHJcbiAgICAgICAgY29uc3QgaXRlbXMgPSB0aGlzLmluYm94JC52YWx1ZS5tYXAoKGl0ZW0pID0+XHJcbiAgICAgICAgICBpdGVtLmNvbnZlcnNhdGlvbl9pZCA9PT0gY29udmVyc2F0aW9uSWQgPyB7IC4uLml0ZW0sIHVucmVhZF9jb3VudDogMCwgaGFzX21lbnRpb246IGZhbHNlIH0gOiBpdGVtXHJcbiAgICAgICAgKTtcclxuICAgICAgICB0aGlzLmluYm94JC5uZXh0KGl0ZW1zKTtcclxuICAgICAgICB0aGlzLnJlY2FsY1VucmVhZChpdGVtcyk7XHJcbiAgICAgICAgdGhpcy5zZXRDb252ZXJzYXRpb25NZW50aW9uKGNvbnZlcnNhdGlvbklkLCBmYWxzZSk7XHJcbiAgICAgIH0sXHJcbiAgICAgIGVycm9yOiAoKSA9PiB7fSxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLy8g4pSA4pSAIEdyb3VwIG1hbmFnZW1lbnQg4pSA4pSAXHJcbiAgbWFuYWdlR3JvdXAoXHJcbiAgICBhY3Rpb246ICdjcmVhdGUnIHwgJ2FkZCcgfCAncmVtb3ZlJyB8ICdyZW5hbWUnLFxyXG4gICAgY29udmVyc2F0aW9uSWQ/OiBzdHJpbmcsXHJcbiAgICBncm91cE5hbWU/OiBzdHJpbmcsXHJcbiAgICBwYXJ0aWNpcGFudENvbnRhY3RJZHM/OiBzdHJpbmdbXSxcclxuICAgIGNhbGxiYWNrcz86IHsgc3VjY2Vzcz86ICgpID0+IHZvaWQ7IGVycm9yPzogKCkgPT4gdm9pZCB9XHJcbiAgKTogdm9pZCB7XHJcbiAgICBjb25zdCBjb250YWN0SWQgPSB0aGlzLmF1dGguY29udGFjdElkO1xyXG4gICAgaWYgKCFjb250YWN0SWQpIHtcclxuICAgICAgY2FsbGJhY2tzPy5lcnJvcj8uKCk7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoYWN0aW9uID09PSAncmVtb3ZlJyAmJiBjb252ZXJzYXRpb25JZCAmJiBwYXJ0aWNpcGFudENvbnRhY3RJZHM/Lmxlbmd0aCkge1xyXG4gICAgICBjb25zdCBhY3Rvck5hbWUgPSB0aGlzLmdldENvbnRhY3ROYW1lQnlJZChjb250YWN0SWQpO1xyXG4gICAgICBjb25zdCBub3RpY2VKb2JzID0gcGFydGljaXBhbnRDb250YWN0SWRzLm1hcCgoaWQpID0+XHJcbiAgICAgICAgdGhpcy5hcGkuc2VuZE1lc3NhZ2UoXHJcbiAgICAgICAgICBjb252ZXJzYXRpb25JZCxcclxuICAgICAgICAgIGNvbnRhY3RJZCxcclxuICAgICAgICAgIGAke2FjdG9yTmFtZX0gcmVtb3ZlZCAke3RoaXMuZ2V0Q29udGFjdE5hbWVCeUlkKGlkKX0gZnJvbSB0aGUgZ3JvdXBgLFxyXG4gICAgICAgICAgJ1NZU1RFTSdcclxuICAgICAgICApLnBpcGUoY2F0Y2hFcnJvcigoKSA9PiBvZihudWxsKSkpXHJcbiAgICAgICk7XHJcbiAgICAgIGNvbnN0IHJlbW92ZUpvYnMgPSBwYXJ0aWNpcGFudENvbnRhY3RJZHMubWFwKChpZCkgPT5cclxuICAgICAgICB0aGlzLmFwaS5tYW5hZ2VHcm91cChpZCwgYWN0aW9uLCBjb252ZXJzYXRpb25JZCwgZ3JvdXBOYW1lKVxyXG4gICAgICApO1xyXG5cclxuICAgICAgZm9ya0pvaW4obm90aWNlSm9icykuc3Vic2NyaWJlKHtcclxuICAgICAgICBuZXh0OiAoKSA9PiB7XHJcbiAgICAgICAgICBmb3JrSm9pbihyZW1vdmVKb2JzKS5zdWJzY3JpYmUoe1xyXG4gICAgICAgICAgICBuZXh0OiAoKSA9PiB7XHJcbiAgICAgICAgICAgICAgdGhpcy5sb2FkSW5ib3goKTtcclxuICAgICAgICAgICAgICBjYWxsYmFja3M/LnN1Y2Nlc3M/LigpO1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBlcnJvcjogKCkgPT4ge1xyXG4gICAgICAgICAgICAgIGNhbGxiYWNrcz8uZXJyb3I/LigpO1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBlcnJvcjogKCkgPT4ge1xyXG4gICAgICAgICAgY2FsbGJhY2tzPy5lcnJvcj8uKCk7XHJcbiAgICAgICAgfSxcclxuICAgICAgfSk7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLmFwaS5tYW5hZ2VHcm91cChjb250YWN0SWQsIGFjdGlvbiwgY29udmVyc2F0aW9uSWQsIGdyb3VwTmFtZSwgcGFydGljaXBhbnRDb250YWN0SWRzKS5zdWJzY3JpYmUoe1xyXG4gICAgICBuZXh0OiAoKSA9PiB7XHJcbiAgICAgICAgdGhpcy5sb2FkSW5ib3goKTtcclxuICAgICAgICBpZiAoYWN0aW9uID09PSAnYWRkJyAmJiBjb252ZXJzYXRpb25JZCAmJiBwYXJ0aWNpcGFudENvbnRhY3RJZHM/Lmxlbmd0aCkge1xyXG4gICAgICAgICAgY29uc3QgYWRkZWROYW1lcyA9IHBhcnRpY2lwYW50Q29udGFjdElkcy5tYXAoKGlkKSA9PiB0aGlzLmdldENvbnRhY3ROYW1lQnlJZChpZCkpO1xyXG4gICAgICAgICAgY29uc3QgdGV4dCA9IGAke3RoaXMuZ2V0Q29udGFjdE5hbWVCeUlkKGNvbnRhY3RJZCl9IGFkZGVkICR7YWRkZWROYW1lcy5qb2luKCcsICcpfSB0byB0aGUgZ3JvdXBgO1xyXG4gICAgICAgICAgdGhpcy5zZW5kTWVzc2FnZShjb252ZXJzYXRpb25JZCwgdGV4dCwgJ1NZU1RFTScpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBjYWxsYmFja3M/LnN1Y2Nlc3M/LigpO1xyXG4gICAgICB9LFxyXG4gICAgICBlcnJvcjogKCkgPT4ge1xyXG4gICAgICAgIGNhbGxiYWNrcz8uZXJyb3I/LigpO1xyXG4gICAgICB9LFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvLyDilIDilIAgRGVsZXRlIC8gQ2xlYXIg4pSA4pSAXHJcbiAgZGVsZXRlQ29udmVyc2F0aW9uKGNvbnZlcnNhdGlvbklkOiBzdHJpbmcpOiB2b2lkIHtcclxuICAgIGNvbnN0IGNvbnRhY3RJZCA9IHRoaXMuYXV0aC5jb250YWN0SWQ7XHJcbiAgICBpZiAoIWNvbnRhY3RJZCkgcmV0dXJuO1xyXG5cclxuICAgIHRoaXMuYXBpLmRlbGV0ZUNvbnZlcnNhdGlvbihjb252ZXJzYXRpb25JZCwgY29udGFjdElkKS5zdWJzY3JpYmUoe1xyXG4gICAgICBuZXh0OiAoKSA9PiB7XHJcbiAgICAgICAgY29uc3QgaXRlbXMgPSB0aGlzLmluYm94JC52YWx1ZS5maWx0ZXIoaSA9PiBpLmNvbnZlcnNhdGlvbl9pZCAhPT0gY29udmVyc2F0aW9uSWQpO1xyXG4gICAgICAgIHRoaXMuaW5ib3gkLm5leHQoaXRlbXMpO1xyXG4gICAgICAgIHRoaXMucmVjYWxjVW5yZWFkKGl0ZW1zKTtcclxuICAgICAgICBjb25zdCBtYXAgPSBuZXcgTWFwKHRoaXMubWVzc2FnZXNNYXAkLnZhbHVlKTtcclxuICAgICAgICBtYXAuZGVsZXRlKGNvbnZlcnNhdGlvbklkKTtcclxuICAgICAgICB0aGlzLm1lc3NhZ2VzTWFwJC5uZXh0KG1hcCk7XHJcbiAgICAgICAgaWYgKHRoaXMuYWN0aXZlQ29udmVyc2F0aW9uSWQkLnZhbHVlID09PSBjb252ZXJzYXRpb25JZCkge1xyXG4gICAgICAgICAgdGhpcy5hY3RpdmVDb252ZXJzYXRpb25JZCQubmV4dChudWxsKTtcclxuICAgICAgICAgIHRoaXMuYWN0aXZlVmlldyQubmV4dCgnaW5ib3gnKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5jbG9zZUNoYXQoY29udmVyc2F0aW9uSWQpO1xyXG4gICAgICB9LFxyXG4gICAgICBlcnJvcjogKCkgPT4ge30sXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIGNsZWFyQ29udmVyc2F0aW9uKGNvbnZlcnNhdGlvbklkOiBzdHJpbmcpOiB2b2lkIHtcclxuICAgIGNvbnN0IGNvbnRhY3RJZCA9IHRoaXMuYXV0aC5jb250YWN0SWQ7XHJcbiAgICBpZiAoIWNvbnRhY3RJZCkgcmV0dXJuO1xyXG5cclxuICAgIHRoaXMuYXBpLmNsZWFyQ29udmVyc2F0aW9uKGNvbnZlcnNhdGlvbklkLCBjb250YWN0SWQpLnN1YnNjcmliZSh7XHJcbiAgICAgIG5leHQ6ICgpID0+IHtcclxuICAgICAgICBjb25zdCBtYXAgPSBuZXcgTWFwKHRoaXMubWVzc2FnZXNNYXAkLnZhbHVlKTtcclxuICAgICAgICBtYXAuc2V0KGNvbnZlcnNhdGlvbklkLCBbXSk7XHJcbiAgICAgICAgdGhpcy5tZXNzYWdlc01hcCQubmV4dChtYXApO1xyXG4gICAgICAgIGNvbnN0IGl0ZW1zID0gdGhpcy5pbmJveCQudmFsdWUubWFwKGkgPT5cclxuICAgICAgICAgIGkuY29udmVyc2F0aW9uX2lkID09PSBjb252ZXJzYXRpb25JZFxyXG4gICAgICAgICAgICA/IHsgLi4uaSwgbGFzdF9tZXNzYWdlX3ByZXZpZXc6ICcnLCBsYXN0X21lc3NhZ2VfYXQ6IGkubGFzdF9tZXNzYWdlX2F0IH1cclxuICAgICAgICAgICAgOiBpXHJcbiAgICAgICAgKTtcclxuICAgICAgICB0aGlzLmluYm94JC5uZXh0KGl0ZW1zKTtcclxuICAgICAgfSxcclxuICAgICAgZXJyb3I6ICgpID0+IHt9LFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBkZWxldGVHcm91cChjb252ZXJzYXRpb25JZDogc3RyaW5nLCBjYWxsYmFja3M/OiB7IHN1Y2Nlc3M/OiAoKSA9PiB2b2lkOyBlcnJvcj86ICgpID0+IHZvaWQgfSk6IHZvaWQge1xyXG4gICAgY29uc3QgY29udGFjdElkID0gdGhpcy5hdXRoLmNvbnRhY3RJZDtcclxuICAgIGlmICghY29udGFjdElkIHx8IHRoaXMuZGVsZXRpbmdDb252ZXJzYXRpb25JZHMuaGFzKGNvbnZlcnNhdGlvbklkKSkge1xyXG4gICAgICBjYWxsYmFja3M/LmVycm9yPy4oKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHByZXZpb3VzSW5ib3ggPSB0aGlzLmluYm94JC52YWx1ZTtcclxuICAgIGNvbnN0IHByZXZpb3VzTWVzc2FnZXNNYXAgPSBuZXcgTWFwKHRoaXMubWVzc2FnZXNNYXAkLnZhbHVlKTtcclxuICAgIGNvbnN0IHByZXZpb3VzT3BlbkNoYXRzID0gdGhpcy5vcGVuQ2hhdHMkLnZhbHVlO1xyXG4gICAgY29uc3QgcHJldmlvdXNBY3RpdmVDb252ZXJzYXRpb25JZCA9IHRoaXMuYWN0aXZlQ29udmVyc2F0aW9uSWQkLnZhbHVlO1xyXG4gICAgY29uc3QgcHJldmlvdXNBY3RpdmVWaWV3ID0gdGhpcy5hY3RpdmVWaWV3JC52YWx1ZTtcclxuICAgIGNvbnN0IHByZXZpb3VzR3JvdXBTZXR0aW5ncyA9IHRoaXMuZ3JvdXBTZXR0aW5ncyQudmFsdWU7XHJcblxyXG4gICAgdGhpcy5kZWxldGluZ0NvbnZlcnNhdGlvbklkcy5hZGQoY29udmVyc2F0aW9uSWQpO1xyXG4gICAgdGhpcy5zaG93VG9hc3QoJ0V4aXRpbmcgZ3JvdXAuLi4nLCAnaW5mbycsIDE1MDApO1xyXG4gICAgdGhpcy5yZW1vdmVDb252ZXJzYXRpb25Gcm9tVWkoY29udmVyc2F0aW9uSWQpO1xyXG5cclxuICAgIHRoaXMuYXBpLmRlbGV0ZUdyb3VwKGNvbnZlcnNhdGlvbklkLCBjb250YWN0SWQpLnN1YnNjcmliZSh7XHJcbiAgICAgIG5leHQ6ICgpID0+IHtcclxuICAgICAgICB0aGlzLmRlbGV0aW5nQ29udmVyc2F0aW9uSWRzLmRlbGV0ZShjb252ZXJzYXRpb25JZCk7XHJcbiAgICAgICAgdGhpcy5zaG93VG9hc3QoJ0V4aXRlZCBncm91cCcsICdzdWNjZXNzJyk7XHJcbiAgICAgICAgY2FsbGJhY2tzPy5zdWNjZXNzPy4oKTtcclxuICAgICAgfSxcclxuICAgICAgZXJyb3I6ICgpID0+IHtcclxuICAgICAgICB0aGlzLmRlbGV0aW5nQ29udmVyc2F0aW9uSWRzLmRlbGV0ZShjb252ZXJzYXRpb25JZCk7XHJcbiAgICAgICAgdGhpcy5pbmJveCQubmV4dChwcmV2aW91c0luYm94KTtcclxuICAgICAgICB0aGlzLnJlY2FsY1VucmVhZChwcmV2aW91c0luYm94KTtcclxuICAgICAgICB0aGlzLm1lc3NhZ2VzTWFwJC5uZXh0KHByZXZpb3VzTWVzc2FnZXNNYXApO1xyXG4gICAgICAgIHRoaXMub3BlbkNoYXRzJC5uZXh0KHByZXZpb3VzT3BlbkNoYXRzKTtcclxuICAgICAgICB0aGlzLmdyb3VwU2V0dGluZ3MkLm5leHQocHJldmlvdXNHcm91cFNldHRpbmdzKTtcclxuICAgICAgICB0aGlzLmFjdGl2ZUNvbnZlcnNhdGlvbklkJC5uZXh0KHByZXZpb3VzQWN0aXZlQ29udmVyc2F0aW9uSWQpO1xyXG4gICAgICAgIHRoaXMuYWN0aXZlVmlldyQubmV4dChwcmV2aW91c0FjdGl2ZVZpZXcpO1xyXG4gICAgICAgIHRoaXMuc2hvd1RvYXN0KCdDb3VsZCBub3QgZXhpdCBncm91cCcsICdlcnJvcicpO1xyXG4gICAgICAgIGNhbGxiYWNrcz8uZXJyb3I/LigpO1xyXG4gICAgICB9LFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHJlbW92ZUNvbnZlcnNhdGlvbkZyb21VaShjb252ZXJzYXRpb25JZDogc3RyaW5nKTogdm9pZCB7XHJcbiAgICBjb25zdCBpdGVtcyA9IHRoaXMuaW5ib3gkLnZhbHVlLmZpbHRlcihpID0+IFN0cmluZyhpLmNvbnZlcnNhdGlvbl9pZCkgIT09IFN0cmluZyhjb252ZXJzYXRpb25JZCkpO1xyXG4gICAgdGhpcy5pbmJveCQubmV4dChpdGVtcyk7XHJcbiAgICB0aGlzLnJlY2FsY1VucmVhZChpdGVtcyk7XHJcblxyXG4gICAgY29uc3QgbWFwID0gbmV3IE1hcCh0aGlzLm1lc3NhZ2VzTWFwJC52YWx1ZSk7XHJcbiAgICBtYXAuZGVsZXRlKGNvbnZlcnNhdGlvbklkKTtcclxuICAgIHRoaXMubWVzc2FnZXNNYXAkLm5leHQobWFwKTtcclxuXHJcbiAgICB0aGlzLm9wZW5DaGF0cyQubmV4dCh0aGlzLm9wZW5DaGF0cyQudmFsdWUuZmlsdGVyKGMgPT4gU3RyaW5nKGMuY29udmVyc2F0aW9uSWQpICE9PSBTdHJpbmcoY29udmVyc2F0aW9uSWQpKSk7XHJcbiAgICBpZiAoU3RyaW5nKHRoaXMuYWN0aXZlQ29udmVyc2F0aW9uSWQkLnZhbHVlKSA9PT0gU3RyaW5nKGNvbnZlcnNhdGlvbklkKSkge1xyXG4gICAgICB0aGlzLmFjdGl2ZUNvbnZlcnNhdGlvbklkJC5uZXh0KG51bGwpO1xyXG4gICAgICB0aGlzLmFjdGl2ZVZpZXckLm5leHQoJ2luYm94Jyk7XHJcbiAgICB9XHJcbiAgICBjb25zdCBzZXR0aW5ncyA9IHRoaXMuZ3JvdXBTZXR0aW5ncyQudmFsdWU7XHJcbiAgICBpZiAoc2V0dGluZ3M/LmNvbnZlcnNhdGlvbklkID09PSBjb252ZXJzYXRpb25JZCkge1xyXG4gICAgICB0aGlzLmNsZWFyR3JvdXBTZXR0aW5ncygpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLy8g4pSA4pSAIFJlYWN0aW9ucyDilIDilIBcclxuICBhZGRSZWFjdGlvbihtZXNzYWdlSWQ6IHN0cmluZywgZW1vamk6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgY29uc3QgY29udGFjdElkID0gdGhpcy5hdXRoLmNvbnRhY3RJZDtcclxuICAgIGlmICghY29udGFjdElkKSByZXR1cm47XHJcblxyXG4gICAgLy8gRW5mb3JjZSBvbmUgcmVhY3Rpb24gcGVyIHVzZXIg4oCUIHJlbW92ZSBhbnkgZXhpc3RpbmcgcmVhY3Rpb24gd2l0aCBhIGRpZmZlcmVudCBlbW9qaVxyXG4gICAgZm9yIChjb25zdCBtc2dzIG9mIHRoaXMubWVzc2FnZXNNYXAkLnZhbHVlLnZhbHVlcygpKSB7XHJcbiAgICAgIGNvbnN0IG1zZyA9IG1zZ3MuZmluZChtID0+IFN0cmluZyhtLm1lc3NhZ2VfaWQpID09PSBTdHJpbmcobWVzc2FnZUlkKSk7XHJcbiAgICAgIGlmIChtc2c/LnJlYWN0aW9ucykge1xyXG4gICAgICAgIGZvciAoY29uc3QgciBvZiBtc2cucmVhY3Rpb25zKSB7XHJcbiAgICAgICAgICBpZiAoci5oYXNSZWFjdGVkICYmIHIuZW1vamkgIT09IGVtb2ppKSB7XHJcbiAgICAgICAgICAgIHRoaXMuYXBwbHlSZWFjdGlvbk9wdGltaXN0aWNhbGx5KG1lc3NhZ2VJZCwgci5lbW9qaSwgZmFsc2UpO1xyXG4gICAgICAgICAgICB0aGlzLmFwaS5yZW1vdmVSZWFjdGlvbihtZXNzYWdlSWQsIGNvbnRhY3RJZCwgci5lbW9qaSkuc3Vic2NyaWJlKHsgZXJyb3I6ICgpID0+IHt9IH0pO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgICBicmVhaztcclxuICAgIH1cclxuXHJcbiAgICAvLyBPcHRpbWlzdGljIFVJIHNvIHVzZXIgc2VlcyByZWFjdGlvbiBpbW1lZGlhdGVseS5cclxuICAgIHRoaXMuYXBwbHlSZWFjdGlvbk9wdGltaXN0aWNhbGx5KG1lc3NhZ2VJZCwgZW1vamksIHRydWUpO1xyXG5cclxuICAgIHRoaXMuYXBpLmFkZFJlYWN0aW9uKG1lc3NhZ2VJZCwgY29udGFjdElkLCBlbW9qaSkuc3Vic2NyaWJlKHtcclxuICAgICAgbmV4dDogKCkgPT4ge1xyXG4gICAgICAgIHRoaXMucmVmcmVzaE1lc3NhZ2VSZWFjdGlvbnMobWVzc2FnZUlkKTtcclxuICAgICAgfSxcclxuICAgICAgZXJyb3I6ICgpID0+IHtcclxuICAgICAgICAvLyBSZXZlcnQgb3B0aW1pc3RpYyB1cGRhdGUgd2hlbiByZXF1ZXN0IGZhaWxzLlxyXG4gICAgICAgIHRoaXMuYXBwbHlSZWFjdGlvbk9wdGltaXN0aWNhbGx5KG1lc3NhZ2VJZCwgZW1vamksIGZhbHNlKTtcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcmVtb3ZlUmVhY3Rpb24obWVzc2FnZUlkOiBzdHJpbmcsIGVtb2ppOiBzdHJpbmcpOiB2b2lkIHtcclxuICAgIGNvbnN0IGNvbnRhY3RJZCA9IHRoaXMuYXV0aC5jb250YWN0SWQ7XHJcbiAgICBpZiAoIWNvbnRhY3RJZCkgcmV0dXJuO1xyXG5cclxuICAgIC8vIE9wdGltaXN0aWMgVUkgc28gdXNlciBzZWVzIHJlYWN0aW9uIHJlbW92YWwgaW1tZWRpYXRlbHkuXHJcbiAgICB0aGlzLmFwcGx5UmVhY3Rpb25PcHRpbWlzdGljYWxseShtZXNzYWdlSWQsIGVtb2ppLCBmYWxzZSk7XHJcblxyXG4gICAgdGhpcy5hcGkucmVtb3ZlUmVhY3Rpb24obWVzc2FnZUlkLCBjb250YWN0SWQsIGVtb2ppKS5zdWJzY3JpYmUoe1xyXG4gICAgICBuZXh0OiAoKSA9PiB7XHJcbiAgICAgICAgdGhpcy5yZWZyZXNoTWVzc2FnZVJlYWN0aW9ucyhtZXNzYWdlSWQpO1xyXG4gICAgICB9LFxyXG4gICAgICBlcnJvcjogKCkgPT4ge1xyXG4gICAgICAgIC8vIFJldmVydCBvcHRpbWlzdGljIHVwZGF0ZSB3aGVuIHJlcXVlc3QgZmFpbHMuXHJcbiAgICAgICAgdGhpcy5hcHBseVJlYWN0aW9uT3B0aW1pc3RpY2FsbHkobWVzc2FnZUlkLCBlbW9qaSwgdHJ1ZSk7XHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIGdldEFjdGl2ZUNvbnZlcnNhdGlvbklkKCk6IHN0cmluZyB8IG51bGwge1xyXG4gICAgcmV0dXJuIHRoaXMuYWN0aXZlQ29udmVyc2F0aW9uSWQkLnZhbHVlO1xyXG4gIH1cclxuXHJcbiAgLy8g4pSA4pSAIEdldHRlcnMg4pSA4pSAXHJcbiAgZ2V0TWVzc2FnZXNGb3JDb252ZXJzYXRpb24oY29udmVyc2F0aW9uSWQ6IHN0cmluZyk6IE1lc3NhZ2VbXSB7XHJcbiAgICByZXR1cm4gdGhpcy5tZXNzYWdlc01hcCQudmFsdWUuZ2V0KGNvbnZlcnNhdGlvbklkKSB8fCBbXTtcclxuICB9XHJcblxyXG4gIGdldEN1cnJlbnRJbmJveCgpOiBJbmJveEl0ZW1bXSB7XHJcbiAgICByZXR1cm4gdGhpcy5pbmJveCQudmFsdWU7XHJcbiAgfVxyXG5cclxuICAvLyDilIDilIAgUHJpdmF0ZSBoZWxwZXJzIOKUgOKUgFxyXG4gIC8qKlxyXG4gICAqIFByZWZlciBgeyB0eXBlLCBkYXRhIH1gOyBzdXBwb3J0IGZsYXQgYHsgdHlwZSwgLi4uZmllbGRzIH1gIGVudmVsb3BlcyBmcm9tIG9sZGVyIGJhY2tlbmRzLlxyXG4gICAqL1xyXG4gIHByaXZhdGUgd3NFdmVudFBheWxvYWQobXNnOiBXZWJTb2NrZXRNZXNzYWdlKTogYW55IHtcclxuICAgIGlmIChtc2cuZGF0YSAhPT0gdW5kZWZpbmVkICYmIG1zZy5kYXRhICE9PSBudWxsKSB7XHJcbiAgICAgIHJldHVybiBtc2cuZGF0YTtcclxuICAgIH1cclxuICAgIGNvbnN0IHJhdyA9IG1zZyBhcyB1bmtub3duIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+O1xyXG4gICAgY29uc3QgeyB0eXBlOiBfdCwgZGF0YTogX2QsIHRpbWVzdGFtcDogX3RzLCBtZXNzYWdlOiBfbXNnLCAuLi5yZXN0IH0gPSByYXc7XHJcbiAgICByZXR1cm4gT2JqZWN0LmtleXMocmVzdCkubGVuZ3RoID8gcmVzdCA6IG51bGw7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGxpc3RlbldlYlNvY2tldCgpOiB2b2lkIHtcclxuICAgIHRoaXMud3NTdWI/LnVuc3Vic2NyaWJlKCk7XHJcbiAgICB0aGlzLndzU3ViID0gdGhpcy53c1NlcnZpY2Uub25NZXNzYWdlJC5zdWJzY3JpYmUoKG1zZykgPT4gdGhpcy5oYW5kbGVXc01lc3NhZ2UobXNnKSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGhhbmRsZVdzTWVzc2FnZShtc2c6IFdlYlNvY2tldE1lc3NhZ2UpOiB2b2lkIHtcclxuICAgIHN3aXRjaCAobXNnLnR5cGUpIHtcclxuICAgICAgY2FzZSAnbmV3X21lc3NhZ2UnOlxyXG4gICAgICAgIHRoaXMuaGFuZGxlTmV3TWVzc2FnZSh0aGlzLndzRXZlbnRQYXlsb2FkKG1zZykpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICBjYXNlICdjb252ZXJzYXRpb25fdXBkYXRlZCc6XHJcbiAgICAgICAgdGhpcy5sb2FkSW5ib3goKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgY2FzZSAnZ3JvdXBfdXBkYXRlZCc6XHJcbiAgICAgICAgdGhpcy5oYW5kbGVHcm91cFVwZGF0ZWQodGhpcy53c0V2ZW50UGF5bG9hZChtc2cpKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgY2FzZSAnZXJyb3InOlxyXG4gICAgICAgIHRoaXMuaGFuZGxlV2ViU29ja2V0RXJyb3IobXNnLm1lc3NhZ2UpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBoYW5kbGVHcm91cFVwZGF0ZWQoZGF0YTogYW55KTogdm9pZCB7XHJcbiAgICB0aGlzLmxvYWRJbmJveCgpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBoYW5kbGVXZWJTb2NrZXRFcnJvcihlcnJvck1lc3NhZ2U6IHN0cmluZyB8IHVuZGVmaW5lZCk6IHZvaWQge1xyXG4gICAgdm9pZCBlcnJvck1lc3NhZ2U7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGhhbmRsZU5ld01lc3NhZ2UoZGF0YTogYW55KTogdm9pZCB7XHJcbiAgICBpZiAoIWRhdGEpIHJldHVybjtcclxuXHJcbiAgICBsZXQgbWVzc2FnZTogTWVzc2FnZSA9IHRoaXMubm9ybWFsaXplTWVzc2FnZVNoYXBlKGRhdGEpO1xyXG4gICAgdGhpcy5kZXRlY3RHcm91cFJlbW92YWxGb3JDdXJyZW50VXNlcihtZXNzYWdlKTtcclxuICAgIGNvbnN0IG15Q29udGFjdElkID0gU3RyaW5nKHRoaXMuYXV0aC5jb250YWN0SWQgPz8gJycpO1xyXG4gICAgY29uc3QgY29udklkID0gU3RyaW5nKG1lc3NhZ2UuY29udmVyc2F0aW9uX2lkID8/ICcnKTtcclxuICAgIGNvbnN0IGV4aXN0aW5nID0gdGhpcy5tZXNzYWdlc01hcCQudmFsdWUuZ2V0KGNvbnZJZCkgfHwgW107XHJcblxyXG4gICAgY29uc3Qgb3duRWNobyA9XHJcbiAgICAgIG15Q29udGFjdElkICYmXHJcbiAgICAgIFN0cmluZyhtZXNzYWdlLnNlbmRlcl9pZCkgPT09IG15Q29udGFjdElkICYmXHJcbiAgICAgICEhbWVzc2FnZS5tZXNzYWdlX2lkICYmXHJcbiAgICAgICFTdHJpbmcobWVzc2FnZS5tZXNzYWdlX2lkKS5zdGFydHNXaXRoKCd0ZW1wLScpO1xyXG5cclxuICAgIC8vIFdTIG9mdGVuIGFycml2ZXMgYmVmb3JlIEhUVFAgZmluaXNoZXMgcmVwbGFjaW5nIHRlbXAtOyBtZXJnZSBpbnRvIHRlbXAgaW5zdGVhZCBvZiBhcHBlbmRpbmcgYSBkdXBsaWNhdGUgcm93LlxyXG4gICAgaWYgKG93bkVjaG8pIHtcclxuICAgICAgY29uc3QgdGVtcElkeCA9IGV4aXN0aW5nLmZpbmRJbmRleCgobSkgPT4ge1xyXG4gICAgICAgIGlmICghU3RyaW5nKG0ubWVzc2FnZV9pZCkuc3RhcnRzV2l0aCgndGVtcC0nKSkgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIGlmIChTdHJpbmcobS5jb252ZXJzYXRpb25faWQpICE9PSBjb252SWQpIHJldHVybiBmYWxzZTtcclxuICAgICAgICBpZiAoU3RyaW5nKG0uc2VuZGVyX2lkKSAhPT0gbXlDb250YWN0SWQpIHJldHVybiBmYWxzZTtcclxuICAgICAgICBjb25zdCBkdCA9IE1hdGguYWJzKFxyXG4gICAgICAgICAgbmV3IERhdGUobS5jcmVhdGVkX2F0KS5nZXRUaW1lKCkgLSBuZXcgRGF0ZShtZXNzYWdlLmNyZWF0ZWRfYXQpLmdldFRpbWUoKVxyXG4gICAgICAgICk7XHJcbiAgICAgICAgaWYgKGR0ID49IDEyMF8wMDApIHJldHVybiBmYWxzZTtcclxuICAgICAgICBjb25zdCBhID0gU3RyaW5nKG0uY29udGVudCA/PyAnJykudHJpbSgpO1xyXG4gICAgICAgIGNvbnN0IGIgPSBTdHJpbmcobWVzc2FnZS5jb250ZW50ID8/ICcnKS50cmltKCk7XHJcbiAgICAgICAgcmV0dXJuIGEgPT09IGIgfHwgIWI7XHJcbiAgICAgIH0pO1xyXG4gICAgICBpZiAodGVtcElkeCA+PSAwKSB7XHJcbiAgICAgICAgY29uc3QgbWVyZ2VkOiBNZXNzYWdlID0gdGhpcy5tZXJnZU1lc3NhZ2VBdHRhY2htZW50cyhleGlzdGluZ1t0ZW1wSWR4XSwgdGhpcy5ub3JtYWxpemVNZXNzYWdlU2hhcGUoe1xyXG4gICAgICAgICAgLi4uZXhpc3RpbmdbdGVtcElkeF0sXHJcbiAgICAgICAgICAuLi5kYXRhLFxyXG4gICAgICAgICAgbWVzc2FnZV9pZDogbWVzc2FnZS5tZXNzYWdlX2lkLFxyXG4gICAgICAgICAgY29udmVyc2F0aW9uX2lkOiBjb252SWQsXHJcbiAgICAgICAgICBjb250ZW50OiB0aGlzLmNvYWxlc2NlTWVzc2FnZVRleHQoZGF0YSwgZXhpc3RpbmdbdGVtcElkeF0uY29udGVudCksXHJcbiAgICAgICAgfSkpO1xyXG4gICAgICAgIGNvbnN0IG1hcCA9IG5ldyBNYXAodGhpcy5tZXNzYWdlc01hcCQudmFsdWUpO1xyXG4gICAgICAgIGNvbnN0IG1zZ3MgPSB0aGlzLmRlZHVwZU1lc3NhZ2VzQnlJZEtlZXBGaXJzdChbLi4uZXhpc3RpbmddKTtcclxuICAgICAgICBtc2dzW3RlbXBJZHhdID0gbWVyZ2VkO1xyXG4gICAgICAgIG1hcC5zZXQoY29udklkLCB0aGlzLmRlZHVwZU1lc3NhZ2VzQnlJZEtlZXBGaXJzdChtc2dzKSk7XHJcbiAgICAgICAgdGhpcy5tZXNzYWdlc01hcCQubmV4dChtYXApO1xyXG4gICAgICAgIHRoaXMucmVmcmVzaE1lc3NhZ2VSZWFjdGlvbnMobWVyZ2VkLm1lc3NhZ2VfaWQpO1xyXG4gICAgICAgIG1lc3NhZ2UgPSBtZXJnZWQ7XHJcbiAgICAgICAgdGhpcy51cGRhdGVJbmJveFByZXZpZXcobWVzc2FnZSk7XHJcbiAgICAgICAgaWYgKHRoaXMuYWN0aXZlQ29udmVyc2F0aW9uSWQkLnZhbHVlID09PSBtZXNzYWdlLmNvbnZlcnNhdGlvbl9pZCkge1xyXG4gICAgICAgICAgdGhpcy5tYXJrQXNSZWFkKG1lc3NhZ2UuY29udmVyc2F0aW9uX2lkKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgaXNGcm9tT3RoZXIgPSBTdHJpbmcobWVzc2FnZS5zZW5kZXJfaWQpICE9PSBteUNvbnRhY3RJZDtcclxuICAgIGNvbnN0IG1lbnRpb25zTWUgPSBpc0Zyb21PdGhlciAmJiB0aGlzLm1lc3NhZ2VNZW50aW9uc0N1cnJlbnRVc2VyKG1lc3NhZ2UpO1xyXG5cclxuICAgIGNvbnN0IGR1cGxpY2F0ZUlkeCA9IGV4aXN0aW5nLmZpbmRJbmRleChcclxuICAgICAgKG0pID0+XHJcbiAgICAgICAgU3RyaW5nKG0ubWVzc2FnZV9pZCkgPT09IFN0cmluZyhtZXNzYWdlLm1lc3NhZ2VfaWQpIHx8XHJcbiAgICAgICAgKFN0cmluZyhtLnNlbmRlcl9pZCkgPT09IFN0cmluZyhtZXNzYWdlLnNlbmRlcl9pZCkgJiZcclxuICAgICAgICAgIFN0cmluZyhtLmNvbnRlbnQgPz8gJycpID09PSBTdHJpbmcobWVzc2FnZS5jb250ZW50ID8/ICcnKSAmJlxyXG4gICAgICAgICAgTWF0aC5hYnMobmV3IERhdGUobS5jcmVhdGVkX2F0KS5nZXRUaW1lKCkgLSBuZXcgRGF0ZShtZXNzYWdlLmNyZWF0ZWRfYXQpLmdldFRpbWUoKSkgPCAyMDAwKVxyXG4gICAgKTtcclxuICAgIGNvbnN0IGlzRHVwbGljYXRlID0gZHVwbGljYXRlSWR4ID49IDA7XHJcblxyXG4gICAgaWYgKCFpc0R1cGxpY2F0ZSkge1xyXG4gICAgICB0aGlzLmFwcGVuZE1lc3NhZ2UobWVzc2FnZSk7XHJcblxyXG4gICAgICBpZiAoaXNGcm9tT3RoZXIpIHtcclxuICAgICAgICB0aGlzLnBsYXlTb2Z0Tm90aWZpY2F0aW9uU291bmQoKTtcclxuICAgICAgfVxyXG4gICAgICB0aGlzLnVwZGF0ZUluYm94UHJldmlldyhtZXNzYWdlKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIGNvbnN0IG1hcCA9IG5ldyBNYXAodGhpcy5tZXNzYWdlc01hcCQudmFsdWUpO1xyXG4gICAgICBjb25zdCBtc2dzID0gWy4uLmV4aXN0aW5nXTtcclxuICAgICAgbXNnc1tkdXBsaWNhdGVJZHhdID0gdGhpcy5tZXJnZU1lc3NhZ2VBdHRhY2htZW50cyhleGlzdGluZ1tkdXBsaWNhdGVJZHhdLCBtZXNzYWdlKTtcclxuICAgICAgbWFwLnNldChjb252SWQsIG1zZ3MpO1xyXG4gICAgICB0aGlzLm1lc3NhZ2VzTWFwJC5uZXh0KG1hcCk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKHRoaXMuYWN0aXZlQ29udmVyc2F0aW9uSWQkLnZhbHVlICE9PSBtZXNzYWdlLmNvbnZlcnNhdGlvbl9pZCkge1xyXG4gICAgICBpZiAoaXNGcm9tT3RoZXIgJiYgIWlzRHVwbGljYXRlKSB7XHJcbiAgICAgICAgdGhpcy5pbmNyZW1lbnRVbnJlYWQobWVzc2FnZS5jb252ZXJzYXRpb25faWQpO1xyXG4gICAgICAgIGlmIChtZW50aW9uc01lKSB7XHJcbiAgICAgICAgICB0aGlzLnNldENvbnZlcnNhdGlvbk1lbnRpb24obWVzc2FnZS5jb252ZXJzYXRpb25faWQsIHRydWUpO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfSBlbHNlIHtcclxuICAgICAgdGhpcy5tYXJrQXNSZWFkKG1lc3NhZ2UuY29udmVyc2F0aW9uX2lkKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKiBQdWJsaWMg4oCUIGxldHMgY29tcG9uZW50cyBhZGQgYW4gb3B0aW1pc3RpYyBtZXNzYWdlIHdpdGhvdXQgYSByb3VuZC10cmlwLiAqL1xyXG4gIGFwcGVuZE9wdGltaXN0aWNNZXNzYWdlKG1lc3NhZ2U6IE1lc3NhZ2UpOiB2b2lkIHtcclxuICAgIHRoaXMuYXBwZW5kTWVzc2FnZShtZXNzYWdlKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgYXBwZW5kTWVzc2FnZShtZXNzYWdlOiBNZXNzYWdlKTogdm9pZCB7XHJcbiAgICBjb25zdCBtYXAgPSBuZXcgTWFwKHRoaXMubWVzc2FnZXNNYXAkLnZhbHVlKTtcclxuICAgIGNvbnN0IGN1cnJlbnQgPSBtYXAuZ2V0KG1lc3NhZ2UuY29udmVyc2F0aW9uX2lkKSB8fCBbXTtcclxuICAgIGNvbnN0IHNhbWVJZElkeCA9IGN1cnJlbnQuZmluZEluZGV4KChtKSA9PiBTdHJpbmcobS5tZXNzYWdlX2lkKSA9PT0gU3RyaW5nKG1lc3NhZ2UubWVzc2FnZV9pZCkpO1xyXG4gICAgaWYgKHNhbWVJZElkeCA+PSAwKSB7XHJcbiAgICAgIGNvbnN0IG1zZ3MgPSBbLi4uY3VycmVudF07XHJcbiAgICAgIG1zZ3Nbc2FtZUlkSWR4XSA9IHRoaXMubWVyZ2VNZXNzYWdlQXR0YWNobWVudHMoY3VycmVudFtzYW1lSWRJZHhdLCBtZXNzYWdlKTtcclxuICAgICAgbWFwLnNldChtZXNzYWdlLmNvbnZlcnNhdGlvbl9pZCwgbXNncyk7XHJcbiAgICAgIHRoaXMubWVzc2FnZXNNYXAkLm5leHQobWFwKTtcclxuICAgICAgdGhpcy5yZWZyZXNoTWVzc2FnZVJlYWN0aW9ucyhtZXNzYWdlLm1lc3NhZ2VfaWQpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgbXNncyA9IFsuLi5jdXJyZW50LCBtZXNzYWdlXTtcclxuICAgIG1hcC5zZXQobWVzc2FnZS5jb252ZXJzYXRpb25faWQsIG1zZ3MpO1xyXG4gICAgdGhpcy5tZXNzYWdlc01hcCQubmV4dChtYXApO1xyXG4gICAgdGhpcy5yZWZyZXNoTWVzc2FnZVJlYWN0aW9ucyhtZXNzYWdlLm1lc3NhZ2VfaWQpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBtZXJnZU1lc3NhZ2VBdHRhY2htZW50cyhleGlzdGluZzogTWVzc2FnZSwgaW5jb21pbmc6IE1lc3NhZ2UpOiBNZXNzYWdlIHtcclxuICAgIGNvbnN0IGV4aXN0aW5nQXR0YWNobWVudHMgPSB0aGlzLm5vcm1hbGl6ZUF0dGFjaG1lbnRMaXN0KGV4aXN0aW5nLmF0dGFjaG1lbnRzIHx8IFtdKTtcclxuICAgIGNvbnN0IGluY29taW5nQXR0YWNobWVudHMgPSB0aGlzLm5vcm1hbGl6ZUF0dGFjaG1lbnRMaXN0KGluY29taW5nLmF0dGFjaG1lbnRzIHx8IFtdKTtcclxuICAgIGNvbnN0IGF0dGFjaG1lbnRzID1cclxuICAgICAgaW5jb21pbmdBdHRhY2htZW50cy5sZW5ndGggPj0gZXhpc3RpbmdBdHRhY2htZW50cy5sZW5ndGggPyBpbmNvbWluZ0F0dGFjaG1lbnRzIDogZXhpc3RpbmdBdHRhY2htZW50cztcclxuXHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAuLi5leGlzdGluZyxcclxuICAgICAgLi4uaW5jb21pbmcsXHJcbiAgICAgIHJlYWN0aW9uczogaW5jb21pbmcucmVhY3Rpb25zIHx8IGV4aXN0aW5nLnJlYWN0aW9ucyxcclxuICAgICAgYXR0YWNobWVudHM6IGF0dGFjaG1lbnRzLmxlbmd0aCA+IDAgPyBhdHRhY2htZW50cyA6IGluY29taW5nLmF0dGFjaG1lbnRzIHx8IGV4aXN0aW5nLmF0dGFjaG1lbnRzLFxyXG4gICAgfTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgbm9ybWFsaXplQXR0YWNobWVudExpc3QoYXR0YWNobWVudHM6IEF0dGFjaG1lbnRbXSk6IEF0dGFjaG1lbnRbXSB7XHJcbiAgICBjb25zdCBieUlkID0gbmV3IE1hcDxzdHJpbmcsIEF0dGFjaG1lbnQ+KCk7XHJcbiAgICBmb3IgKGNvbnN0IGF0dGFjaG1lbnQgb2YgYXR0YWNobWVudHMpIHtcclxuICAgICAgY29uc3QgZmlsZUlkID0gU3RyaW5nKGF0dGFjaG1lbnQ/LmZpbGVfaWQgfHwgJycpLnRyaW0oKTtcclxuICAgICAgaWYgKCFmaWxlSWQgfHwgZmlsZUlkLnN0YXJ0c1dpdGgoJ3RlbXAtJykpIGNvbnRpbnVlO1xyXG4gICAgICBieUlkLnNldChmaWxlSWQsIHtcclxuICAgICAgICAuLi5hdHRhY2htZW50LFxyXG4gICAgICAgIGZpbGVfaWQ6IGZpbGVJZCxcclxuICAgICAgICBmaWxlbmFtZTogYXR0YWNobWVudC5maWxlbmFtZSB8fCAnRmlsZScsXHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIEFycmF5LmZyb20oYnlJZC52YWx1ZXMoKSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHVwZGF0ZUluYm94UHJldmlldyhtZXNzYWdlOiBNZXNzYWdlKTogdm9pZCB7XHJcbiAgICBjb25zdCB0ZXh0ID0gU3RyaW5nKG1lc3NhZ2UuY29udGVudCA/PyAnJykudHJpbSgpO1xyXG4gICAgY29uc3QgbWVkaWEgPSB0aGlzLm1lc3NhZ2VMb29rc0xpa2VNZWRpYShtZXNzYWdlKTtcclxuICAgIGlmICghdGV4dCAmJiAhbWVkaWEpIHtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgY29uc3QgcHJldmlldyA9IHRleHQgfHwgJ1tJbWFnZV0nO1xyXG4gICAgY29uc3QgaXRlbXMgPSB0aGlzLmluYm94JC52YWx1ZS5tYXAoKGl0ZW0pID0+IHtcclxuICAgICAgaWYgKGl0ZW0uY29udmVyc2F0aW9uX2lkID09PSBtZXNzYWdlLmNvbnZlcnNhdGlvbl9pZCkge1xyXG4gICAgICAgIGNvbnN0IG1lbnRpb25lZCA9IGl0ZW0uaGFzX21lbnRpb24gfHwgdGhpcy5tZW50aW9uQ29udmVyc2F0aW9uSWRzJC52YWx1ZS5oYXMoU3RyaW5nKGl0ZW0uY29udmVyc2F0aW9uX2lkKSk7XHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgIC4uLml0ZW0sXHJcbiAgICAgICAgICBsYXN0X21lc3NhZ2VfcHJldmlldzogcHJldmlldyxcclxuICAgICAgICAgIGxhc3RfbWVzc2FnZV9hdDogbWVzc2FnZS5jcmVhdGVkX2F0LFxyXG4gICAgICAgICAgaGFzX21lbnRpb246IG1lbnRpb25lZCxcclxuICAgICAgICB9O1xyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiBpdGVtO1xyXG4gICAgfSk7XHJcblxyXG4gICAgaXRlbXMuc29ydCgoYSwgYikgPT4gbmV3IERhdGUoYi5sYXN0X21lc3NhZ2VfYXQpLmdldFRpbWUoKSAtIG5ldyBEYXRlKGEubGFzdF9tZXNzYWdlX2F0KS5nZXRUaW1lKCkpO1xyXG4gICAgdGhpcy5pbmJveCQubmV4dChpdGVtcyk7XHJcbiAgfVxyXG5cclxuICAvKiogRmlyc3Qgbm9uLWVtcHR5IHRleHQgZmllbGQgZnJvbSBBUEkgLyBXUyBvYmplY3RzIChQT1NUIGJvZGllcyBvZnRlbiBvbWl0IGBjb250ZW50YCkuICovXHJcbiAgcHJpdmF0ZSBjb2FsZXNjZU1lc3NhZ2VUZXh0KHJhdzogYW55LCBmYWxsYmFjayA9ICcnKTogc3RyaW5nIHtcclxuICAgIGNvbnN0IGNhbmRzID0gW3Jhdz8uY29udGVudCwgcmF3Py5ib2R5LCByYXc/LnRleHQsIGZhbGxiYWNrXTtcclxuICAgIGZvciAoY29uc3QgYyBvZiBjYW5kcykge1xyXG4gICAgICBpZiAodHlwZW9mIGMgPT09ICdzdHJpbmcnICYmIGMudHJpbSgpKSByZXR1cm4gYztcclxuICAgICAgaWYgKGMgIT0gbnVsbCAmJiB0eXBlb2YgYyAhPT0gJ29iamVjdCcgJiYgU3RyaW5nKGMpLnRyaW0oKSkgcmV0dXJuIFN0cmluZyhjKS50cmltKCk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdHlwZW9mIGZhbGxiYWNrID09PSAnc3RyaW5nJyA/IGZhbGxiYWNrIDogU3RyaW5nKGZhbGxiYWNrID8/ICcnKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgcGFyc2VSZXBseUNvbnRlbnQoY29udGVudDogc3RyaW5nKTogeyByZXBseTogTWVzc2FnZVJlcGx5UHJldmlldzsgYm9keTogc3RyaW5nIH0gfCBudWxsIHtcclxuICAgIGNvbnN0IHZhbHVlID0gU3RyaW5nKGNvbnRlbnQgfHwgJycpO1xyXG4gICAgY29uc3QgbWF0Y2ggPSB2YWx1ZS5tYXRjaCgvXlxcW1JlcGx5IHRvIChbXlxcXV0rKVxcXVxcbj4gKFteXFxuXSopXFxuXFxuKFtcXHNcXFNdKikkLyk7XHJcbiAgICBpZiAoIW1hdGNoKSByZXR1cm4gbnVsbDtcclxuICAgIHJldHVybiB7XHJcbiAgICAgIHJlcGx5OiB7XHJcbiAgICAgICAgc2VuZGVyX25hbWU6IG1hdGNoWzFdLnRyaW0oKSxcclxuICAgICAgICBjb250ZW50OiBtYXRjaFsyXS50cmltKCksXHJcbiAgICAgIH0sXHJcbiAgICAgIGJvZHk6IG1hdGNoWzNdLFxyXG4gICAgfTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgcmVwbHlCb2R5VGV4dChjb250ZW50OiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gICAgcmV0dXJuIHRoaXMucGFyc2VSZXBseUNvbnRlbnQoY29udGVudCk/LmJvZHkgPz8gU3RyaW5nKGNvbnRlbnQgfHwgJycpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSByZXBseUV4Y2VycHQoY29udGVudDogc3RyaW5nKTogc3RyaW5nIHtcclxuICAgIGNvbnN0IHBhcnNlZCA9IHRoaXMucGFyc2VSZXBseUNvbnRlbnQoY29udGVudCk7XHJcbiAgICBjb25zdCBiYXNlID0gKHBhcnNlZD8uYm9keSA/PyBjb250ZW50KS5yZXBsYWNlKC9cXHMrL2csICcgJykudHJpbSgpO1xyXG4gICAgcmV0dXJuIGJhc2UubGVuZ3RoID4gMTIwID8gYCR7YmFzZS5zbGljZSgwLCAxMTcpfS4uLmAgOiBiYXNlIHx8ICdBdHRhY2htZW50JztcclxuICB9XHJcblxyXG4gIHByaXZhdGUgY3VycmVudE1lbnRpb25Ub2tlbnMoKTogc3RyaW5nW10ge1xyXG4gICAgY29uc3QgY3VycmVudCA9IHRoaXMuYXV0aC5jdXJyZW50Q29udGFjdDtcclxuICAgIGNvbnN0IHZhbHVlcyA9IFtcclxuICAgICAgY3VycmVudD8udXNlcm5hbWUsXHJcbiAgICAgIGN1cnJlbnQ/LmVtYWlsPy5zcGxpdCgnQCcpWzBdLFxyXG4gICAgICBjdXJyZW50Py5maXJzdF9uYW1lLFxyXG4gICAgICBjdXJyZW50Py5sYXN0X25hbWUsXHJcbiAgICAgIGN1cnJlbnQ/LmVtYWlsLFxyXG4gICAgXTtcclxuICAgIHJldHVybiB2YWx1ZXNcclxuICAgICAgLm1hcCgodmFsdWUpID0+IFN0cmluZyh2YWx1ZSB8fCAnJykudHJpbSgpLnRvTG93ZXJDYXNlKCkpXHJcbiAgICAgIC5maWx0ZXIoQm9vbGVhbilcclxuICAgICAgLm1hcCgodmFsdWUpID0+IHZhbHVlLnJlcGxhY2UoL15ALywgJycpKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgbWVzc2FnZVRleHRNZW50aW9uc0N1cnJlbnRVc2VyKGNvbnRlbnQ6IHN0cmluZyk6IGJvb2xlYW4ge1xyXG4gICAgY29uc3QgdG9rZW5zID0gdGhpcy5jdXJyZW50TWVudGlvblRva2VucygpO1xyXG4gICAgaWYgKCF0b2tlbnMubGVuZ3RoKSByZXR1cm4gZmFsc2U7XHJcbiAgICBjb25zdCBtZW50aW9ucyA9IEFycmF5LmZyb20oU3RyaW5nKGNvbnRlbnQgfHwgJycpLm1hdGNoQWxsKC8oXnxbXmEtekEtWjAtOS5fLV0pQChbYS16QS1aMC05Ll8tXSspL2cpKVxyXG4gICAgICAubWFwKChtYXRjaCkgPT4gbWF0Y2hbMl0udG9Mb3dlckNhc2UoKSk7XHJcbiAgICByZXR1cm4gbWVudGlvbnMuc29tZSgobWVudGlvbikgPT4gdG9rZW5zLmluY2x1ZGVzKG1lbnRpb24pKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgbWVzc2FnZU1lbnRpb25zQ3VycmVudFVzZXIobWVzc2FnZTogTWVzc2FnZSk6IGJvb2xlYW4ge1xyXG4gICAgY29uc3QgbXlJZCA9IFN0cmluZyh0aGlzLmF1dGguY29udGFjdElkIHx8ICcnKTtcclxuICAgIGNvbnN0IGV4cGxpY2l0TWVudGlvbnMgPSBBcnJheS5pc0FycmF5KG1lc3NhZ2UubWVudGlvbnMpXHJcbiAgICAgID8gbWVzc2FnZS5tZW50aW9ucy5tYXAoKGlkKSA9PiBTdHJpbmcoaWQpKVxyXG4gICAgICA6IFtdO1xyXG4gICAgcmV0dXJuICghIW15SWQgJiYgZXhwbGljaXRNZW50aW9ucy5pbmNsdWRlcyhteUlkKSkgfHxcclxuICAgICAgdGhpcy5tZXNzYWdlVGV4dE1lbnRpb25zQ3VycmVudFVzZXIoU3RyaW5nKG1lc3NhZ2UuY29udGVudCB8fCAnJykpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBzZXRDb252ZXJzYXRpb25NZW50aW9uKGNvbnZlcnNhdGlvbklkOiBzdHJpbmcsIGhhc01lbnRpb246IGJvb2xlYW4pOiB2b2lkIHtcclxuICAgIGNvbnN0IGlkID0gU3RyaW5nKGNvbnZlcnNhdGlvbklkIHx8ICcnKTtcclxuICAgIGlmICghaWQpIHJldHVybjtcclxuICAgIGNvbnN0IG5leHQgPSBuZXcgU2V0KHRoaXMubWVudGlvbkNvbnZlcnNhdGlvbklkcyQudmFsdWUpO1xyXG4gICAgaWYgKGhhc01lbnRpb24pIHtcclxuICAgICAgbmV4dC5hZGQoaWQpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgbmV4dC5kZWxldGUoaWQpO1xyXG4gICAgfVxyXG4gICAgdGhpcy5tZW50aW9uQ29udmVyc2F0aW9uSWRzJC5uZXh0KG5leHQpO1xyXG4gICAgY29uc3QgaXRlbXMgPSB0aGlzLmluYm94JC52YWx1ZS5tYXAoKGl0ZW0pID0+XHJcbiAgICAgIFN0cmluZyhpdGVtLmNvbnZlcnNhdGlvbl9pZCkgPT09IGlkID8geyAuLi5pdGVtLCBoYXNfbWVudGlvbjogaGFzTWVudGlvbiB9IDogaXRlbVxyXG4gICAgKTtcclxuICAgIHRoaXMuaW5ib3gkLm5leHQoaXRlbXMpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBtZXNzYWdlTG9va3NMaWtlTWVkaWEobTogTWVzc2FnZSk6IGJvb2xlYW4ge1xyXG4gICAgY29uc3QgdCA9IG0ubWVzc2FnZV90eXBlO1xyXG4gICAgaWYgKHQgJiYgdCAhPT0gJ1RFWFQnKSByZXR1cm4gdHJ1ZTtcclxuICAgIGNvbnN0IHUgPSBTdHJpbmcobS5tZWRpYV91cmwgPz8gJycpLnRyaW0oKTtcclxuICAgIGlmICh1ICYmICh1LnN0YXJ0c1dpdGgoJ2h0dHA6Ly8nKSB8fCB1LnN0YXJ0c1dpdGgoJ2h0dHBzOi8vJykgfHwgdS5zdGFydHNXaXRoKCdkYXRhOicpKSkge1xyXG4gICAgICByZXR1cm4gdHJ1ZTtcclxuICAgIH1cclxuICAgIHJldHVybiBBcnJheS5pc0FycmF5KG0uYXR0YWNobWVudHMpICYmIG0uYXR0YWNobWVudHMubGVuZ3RoID4gMDtcclxuICB9XHJcblxyXG4gIC8qKiBTYW1lIGxvZ2ljYWwgbWVzc2FnZV9pZCBjYW4gYXBwZWFyIHR3aWNlIHdoZW4gV1MgYmVhdHMgSFRUUCB0ZW1wIHJlcGxhY2VtZW50IOKAlCBrZWVwIGZpcnN0IHJvdy4gKi9cclxuICBwcml2YXRlIGRlZHVwZU1lc3NhZ2VzQnlJZEtlZXBGaXJzdChtc2dzOiBNZXNzYWdlW10pOiBNZXNzYWdlW10ge1xyXG4gICAgY29uc3Qgc2VlbiA9IG5ldyBTZXQ8c3RyaW5nPigpO1xyXG4gICAgcmV0dXJuIG1zZ3MuZmlsdGVyKChtKSA9PiB7XHJcbiAgICAgIGNvbnN0IGlkID0gU3RyaW5nKG0ubWVzc2FnZV9pZCA/PyAnJyk7XHJcbiAgICAgIGlmICghaWQpIHJldHVybiB0cnVlO1xyXG4gICAgICBpZiAoc2Vlbi5oYXMoaWQpKSByZXR1cm4gZmFsc2U7XHJcbiAgICAgIHNlZW4uYWRkKGlkKTtcclxuICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgaW5jcmVtZW50VW5yZWFkKGNvbnZlcnNhdGlvbklkOiBzdHJpbmcpOiB2b2lkIHtcclxuICAgIGNvbnN0IGl0ZW1zID0gdGhpcy5pbmJveCQudmFsdWUubWFwKChpdGVtKSA9PlxyXG4gICAgICBpdGVtLmNvbnZlcnNhdGlvbl9pZCA9PT0gY29udmVyc2F0aW9uSWRcclxuICAgICAgICA/IHsgLi4uaXRlbSwgdW5yZWFkX2NvdW50OiBOdW1iZXIoaXRlbS51bnJlYWRfY291bnQpICsgMSB9XHJcbiAgICAgICAgOiBpdGVtXHJcbiAgICApO1xyXG4gICAgdGhpcy5pbmJveCQubmV4dChpdGVtcyk7XHJcbiAgICB0aGlzLnJlY2FsY1VucmVhZChpdGVtcyk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBOb3JtYWxpemUgYmFja2VuZCBtZXNzYWdlIHNoYXBlcyBzbyBVSSBjYW4gcmVsaWFibHkgcmVuZGVyIGF0dGFjaG1lbnRzL21lZGlhLlxyXG4gICAqIFN1cHBvcnRzIGxlZ2FjeSBhbmQgY3VycmVudCBmaWVsZCBuYW1lcyByZXR1cm5lZCBieSBBUEkvV1MgcGF5bG9hZHMuXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBub3JtYWxpemVNZXNzYWdlU2hhcGUocmF3OiBhbnkpOiBNZXNzYWdlIHtcclxuICAgIGNvbnN0IGJhc2U6IE1lc3NhZ2UgPSB7XHJcbiAgICAgIG1lc3NhZ2VfaWQ6IFN0cmluZyhyYXc/Lm1lc3NhZ2VfaWQgPz8gcmF3Py5pZCA/PyAnJyksXHJcbiAgICAgIGNvbnZlcnNhdGlvbl9pZDogU3RyaW5nKHJhdz8uY29udmVyc2F0aW9uX2lkID8/IHJhdz8uY29udmVyc2F0aW9uSWQgPz8gJycpLFxyXG4gICAgICBzZW5kZXJfaWQ6IFN0cmluZyhyYXc/LnNlbmRlcl9pZCA/PyByYXc/LnNlbmRlcklkID8/ICcnKSxcclxuICAgICAgc2VuZGVyX25hbWU6IHJhdz8uc2VuZGVyX25hbWUsXHJcbiAgICAgIHNlbmRlcl91c2VybmFtZTogcmF3Py5zZW5kZXJfdXNlcm5hbWUsXHJcbiAgICAgIHNlbmRlcl9maXJzdF9uYW1lOiByYXc/LnNlbmRlcl9maXJzdF9uYW1lLFxyXG4gICAgICBzZW5kZXJfbGFzdF9uYW1lOiByYXc/LnNlbmRlcl9sYXN0X25hbWUsXHJcbiAgICAgIG1lc3NhZ2VfdHlwZTogKHJhdz8ubWVzc2FnZV90eXBlID8/IHJhdz8ubWVzc2FnZVR5cGUgPz8gJ1RFWFQnKSBhcyBNZXNzYWdlWydtZXNzYWdlX3R5cGUnXSxcclxuICAgICAgY29udGVudDogcmF3Py5jb250ZW50ID8/IHJhdz8uYm9keSA/PyByYXc/LnRleHQgPz8gJycsXHJcbiAgICAgIG1lZGlhX3VybDogcmF3Py5tZWRpYV91cmwgPz8gcmF3Py5tZWRpYVVybCA/PyByYXc/LnVybCA/PyByYXc/LmZpbGVfdXJsLFxyXG4gICAgICBjcmVhdGVkX2F0OiByYXc/LmNyZWF0ZWRfYXQgPz8gcmF3Py5jcmVhdGVkQXQgPz8gbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxyXG4gICAgICBpc19yZWFkOiByYXc/LmlzX3JlYWQsXHJcbiAgICAgIHJlYWN0aW9uczogcmF3Py5yZWFjdGlvbnMsXHJcbiAgICAgIG1lbnRpb25zOiByYXc/Lm1lbnRpb25zLFxyXG4gICAgICBhdHRhY2htZW50czogcmF3Py5hdHRhY2htZW50cyxcclxuICAgICAgaXNfcGlubmVkOiByYXc/LmlzX3Bpbm5lZCxcclxuICAgICAgcGlubmVkX2F0OiByYXc/LnBpbm5lZF9hdCxcclxuICAgICAgcGlubmVkX2J5OiByYXc/LnBpbm5lZF9ieSxcclxuICAgIH07XHJcblxyXG4gICAgY29uc3QgcGFyc2VkUmVwbHkgPSB0aGlzLnBhcnNlUmVwbHlDb250ZW50KFN0cmluZyhiYXNlLmNvbnRlbnQgfHwgJycpKTtcclxuICAgIGlmIChwYXJzZWRSZXBseSkge1xyXG4gICAgICBiYXNlLmNvbnRlbnQgPSBwYXJzZWRSZXBseS5ib2R5O1xyXG4gICAgICBiYXNlLnJlcGx5X3RvID0gcmF3Py5yZXBseV90byA/PyByYXc/LnJlcGx5VG8gPz8gcGFyc2VkUmVwbHkucmVwbHk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBiYXNlLnJlcGx5X3RvID0gcmF3Py5yZXBseV90byA/PyByYXc/LnJlcGx5VG87XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgdXVpZFJlID1cclxuICAgICAgL15bMC05YS1mXXs4fS1bMC05YS1mXXs0fS1bMS01XVswLTlhLWZdezN9LVs4OWFiXVswLTlhLWZdezN9LVswLTlhLWZdezEyfSQvaTtcclxuXHJcbiAgICBjb25zdCB0b1N0cmluZ0FycmF5ID0gKHZhbHVlOiBhbnkpOiBzdHJpbmdbXSA9PiB7XHJcbiAgICAgIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkge1xyXG4gICAgICAgIHJldHVybiB2YWx1ZVxyXG4gICAgICAgICAgLm1hcCgoeDogYW55KSA9PiAodHlwZW9mIHggPT09ICdzdHJpbmcnID8geCA6IHg/LmZpbGVfaWQgPz8geD8uaWQgPz8gJycpKVxyXG4gICAgICAgICAgLm1hcCgoeDogYW55KSA9PiBTdHJpbmcoeCkudHJpbSgpKVxyXG4gICAgICAgICAgLmZpbHRlcihCb29sZWFuKTtcclxuICAgICAgfVxyXG4gICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJyAmJiB2YWx1ZS50cmltKCkpIHtcclxuICAgICAgICBjb25zdCB0cmltbWVkID0gdmFsdWUudHJpbSgpO1xyXG4gICAgICAgIGlmICh0cmltbWVkLnN0YXJ0c1dpdGgoJ3snKSB8fCB0cmltbWVkLnN0YXJ0c1dpdGgoJ1snKSkge1xyXG4gICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgY29uc3QgcGFyc2VkID0gSlNPTi5wYXJzZSh0cmltbWVkKTtcclxuICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkocGFyc2VkKSkgcmV0dXJuIHRvU3RyaW5nQXJyYXkocGFyc2VkKTtcclxuICAgICAgICAgICAgcmV0dXJuIHRvU3RyaW5nQXJyYXkocGFyc2VkPy5pZHMgPz8gcGFyc2VkPy5maWxlX2lkcyA/PyBwYXJzZWQ/LmF0dGFjaG1lbnRfaWRzID8/IHBhcnNlZD8uYXR0YWNobWVudHMpO1xyXG4gICAgICAgICAgfSBjYXRjaCB7XHJcbiAgICAgICAgICAgIHJldHVybiBbXTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHRyaW1tZWQuc3BsaXQoL1ssXFxzXSsvKS5tYXAoKHM6IHN0cmluZykgPT4gcy50cmltKCkpLmZpbHRlcihCb29sZWFuKTtcclxuICAgICAgfVxyXG4gICAgICByZXR1cm4gW107XHJcbiAgICB9O1xyXG5cclxuICAgIGNvbnN0IG5vcm1hbGl6ZUF0dGFjaG1lbnQgPSAoYTogYW55KTogQXR0YWNobWVudCB8IG51bGwgPT4ge1xyXG4gICAgICBjb25zdCBmaWxlSWQgPSBTdHJpbmcoXHJcbiAgICAgICAgdHlwZW9mIGEgPT09ICdzdHJpbmcnID8gYSA6XHJcbiAgICAgICAgYT8uZmlsZV9pZCA/PyBhPy5maWxlSWQgPz8gYT8uaWQgPz8gYT8uYXR0YWNobWVudF9pZCA/PyBhPy5zdG9yYWdlX2ZpbGVfaWQgPz8gJydcclxuICAgICAgKS50cmltKCk7XHJcbiAgICAgIGlmICghZmlsZUlkIHx8IGZpbGVJZC5zdGFydHNXaXRoKCd0ZW1wLScpKSByZXR1cm4gbnVsbDtcclxuICAgICAgcmV0dXJuIHtcclxuICAgICAgICBmaWxlX2lkOiBmaWxlSWQsXHJcbiAgICAgICAgZmlsZW5hbWU6IFN0cmluZyhhPy5maWxlbmFtZSA/PyBhPy5maWxlX25hbWUgPz8gYT8ubmFtZSA/PyBhPy5vcmlnaW5hbF9maWxlbmFtZSA/PyAnRmlsZScpLFxyXG4gICAgICAgIG1pbWVfdHlwZTogYT8ubWltZV90eXBlID8/IGE/Lm1pbWVUeXBlLFxyXG4gICAgICAgIHNpemVfYnl0ZXM6IGE/LnNpemVfYnl0ZXMgPz8gYT8uc2l6ZUJ5dGVzLFxyXG4gICAgICAgIHVybDogYT8udXJsID8/IGE/LmZpbGVfdXJsID8/IGE/LmRvd25sb2FkX3VybCxcclxuICAgICAgfTtcclxuICAgIH07XHJcblxyXG4gICAgbGV0IG5vcm1hbGl6ZWRBdHRhY2htZW50czogQXR0YWNobWVudFtdID0gW107XHJcbiAgICBjb25zdCBhZGRBdHRhY2htZW50ID0gKGF0dGFjaG1lbnQ6IEF0dGFjaG1lbnQgfCBudWxsKTogdm9pZCA9PiB7XHJcbiAgICAgIGlmICghYXR0YWNobWVudCkgcmV0dXJuO1xyXG4gICAgICBjb25zdCBmaWxlSWQgPSBTdHJpbmcoYXR0YWNobWVudC5maWxlX2lkIHx8ICcnKS50cmltKCk7XHJcbiAgICAgIGNvbnN0IHVybCA9IFN0cmluZyhhdHRhY2htZW50LnVybCB8fCAnJykudHJpbSgpO1xyXG4gICAgICBpZiAoZmlsZUlkLnN0YXJ0c1dpdGgoJ3snKSB8fCBmaWxlSWQuc3RhcnRzV2l0aCgnWycpKSB7XHJcbiAgICAgICAgY29uc3QgaWRzID0gdG9TdHJpbmdBcnJheShmaWxlSWQpO1xyXG4gICAgICAgIGlkcy5mb3JFYWNoKChpZCwgaWR4KSA9PiB7XHJcbiAgICAgICAgICBhZGRBdHRhY2htZW50KHtcclxuICAgICAgICAgICAgLi4uYXR0YWNobWVudCxcclxuICAgICAgICAgICAgZmlsZV9pZDogaWQsXHJcbiAgICAgICAgICAgIGZpbGVuYW1lOiBhdHRhY2htZW50LmZpbGVuYW1lIHx8IGBBdHRhY2htZW50ICR7aWR4ICsgMX1gLFxyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICB9XHJcbiAgICAgIGlmIChmaWxlSWQgJiYgbm9ybWFsaXplZEF0dGFjaG1lbnRzLnNvbWUoKGEpID0+IGEuZmlsZV9pZCA9PT0gZmlsZUlkKSkgcmV0dXJuO1xyXG4gICAgICBpZiAoIWZpbGVJZCAmJiB1cmwgJiYgbm9ybWFsaXplZEF0dGFjaG1lbnRzLnNvbWUoKGEpID0+IGEudXJsID09PSB1cmwpKSByZXR1cm47XHJcbiAgICAgIG5vcm1hbGl6ZWRBdHRhY2htZW50cy5wdXNoKGF0dGFjaG1lbnQpO1xyXG4gICAgfTtcclxuXHJcbiAgICAvLyBOb3JtYWxpemUgYXR0YWNobWVudCBvYmplY3RzIChBUEkgbWF5IHVzZSBmaWxlSWQgLyBpZCBpbnN0ZWFkIG9mIGZpbGVfaWQpLlxyXG4gICAgaWYgKEFycmF5LmlzQXJyYXkoYmFzZS5hdHRhY2htZW50cykgJiYgYmFzZS5hdHRhY2htZW50cy5sZW5ndGggPiAwKSB7XHJcbiAgICAgIChiYXNlLmF0dGFjaG1lbnRzIGFzIGFueVtdKS5mb3JFYWNoKChhKSA9PiBhZGRBdHRhY2htZW50KG5vcm1hbGl6ZUF0dGFjaG1lbnQoYSkpKTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBtZWRpYVZhbHVlID0gU3RyaW5nKGJhc2UubWVkaWFfdXJsIHx8ICcnKS50cmltKCk7XHJcbiAgICBpZiAobWVkaWFWYWx1ZS5zdGFydHNXaXRoKCd7JykgfHwgbWVkaWFWYWx1ZS5zdGFydHNXaXRoKCdbJykpIHtcclxuICAgICAgdHJ5IHtcclxuICAgICAgICBjb25zdCBwYXJzZWQgPSBKU09OLnBhcnNlKG1lZGlhVmFsdWUpO1xyXG4gICAgICAgIGNvbnN0IHJhd0F0dGFjaG1lbnRzID0gQXJyYXkuaXNBcnJheShwYXJzZWQpID8gcGFyc2VkIDogcGFyc2VkPy5hdHRhY2htZW50cztcclxuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShyYXdBdHRhY2htZW50cykpIHtcclxuICAgICAgICAgIHJhd0F0dGFjaG1lbnRzLmZvckVhY2goKGEpID0+IGFkZEF0dGFjaG1lbnQobm9ybWFsaXplQXR0YWNobWVudChhKSkpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkocGFyc2VkKSkge1xyXG4gICAgICAgICAgY29uc3QgbWVkaWFJZHMgPSB0b1N0cmluZ0FycmF5KHBhcnNlZD8uaWRzID8/IHBhcnNlZD8uZmlsZV9pZHMgPz8gcGFyc2VkPy5hdHRhY2htZW50X2lkcyk7XHJcbiAgICAgICAgICBjb25zdCBtZWRpYUZpbGVuYW1lcyA9IHRvU3RyaW5nQXJyYXkocGFyc2VkPy5maWxlbmFtZXMpO1xyXG4gICAgICAgICAgY29uc3QgbWVkaWFNaW1lVHlwZXMgPSB0b1N0cmluZ0FycmF5KHBhcnNlZD8ubWltZV90eXBlcyA/PyBwYXJzZWQ/Lm1pbWVUeXBlcyk7XHJcbiAgICAgICAgICBtZWRpYUlkcy5mb3JFYWNoKChpZCwgaWR4KSA9PiB7XHJcbiAgICAgICAgICAgIGFkZEF0dGFjaG1lbnQoe1xyXG4gICAgICAgICAgICAgIGZpbGVfaWQ6IGlkLFxyXG4gICAgICAgICAgICAgIGZpbGVuYW1lOiBtZWRpYUZpbGVuYW1lc1tpZHhdIHx8IG1lZGlhRmlsZW5hbWVzWzBdIHx8IGBBdHRhY2htZW50ICR7aWR4ICsgMX1gLFxyXG4gICAgICAgICAgICAgIG1pbWVfdHlwZTogbWVkaWFNaW1lVHlwZXNbaWR4XSxcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICAgIH0gY2F0Y2gge1xyXG4gICAgICAgIC8vIEZhbGwgdGhyb3VnaCB0byBsZWdhY3kgYXR0YWNobWVudCByZWNvbnN0cnVjdGlvbiBiZWxvdy5cclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8vIFJlY29uc3RydWN0IGF0dGFjaG1lbnRzIGZyb20gYWx0ZXJuYXRlIEFQSSBmaWVsZHMuXHJcbiAgICBsZXQgYXR0YWNobWVudElkczogc3RyaW5nW10gPSBbXTtcclxuICAgIGF0dGFjaG1lbnRJZHMgPSB0b1N0cmluZ0FycmF5KHJhdz8uYXR0YWNobWVudF9pZHMpO1xyXG5cclxuICAgIGlmIChhdHRhY2htZW50SWRzLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICBhdHRhY2htZW50SWRzID0gdG9TdHJpbmdBcnJheShyYXc/LmZpbGVfaWRzKTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBwdXNoSWQgPSAodjogYW55KSA9PiB7XHJcbiAgICAgIGNvbnN0IHMgPSB2ICE9IG51bGwgJiYgdiAhPT0gJycgPyBTdHJpbmcodikudHJpbSgpIDogJyc7XHJcbiAgICAgIGlmIChzICYmICFhdHRhY2htZW50SWRzLmluY2x1ZGVzKHMpKSBhdHRhY2htZW50SWRzLnB1c2gocyk7XHJcbiAgICB9O1xyXG5cclxuICAgIHB1c2hJZChyYXc/LmZpbGVfaWQpO1xyXG4gICAgcHVzaElkKHJhdz8uYXR0YWNobWVudF9pZCk7XHJcbiAgICBwdXNoSWQocmF3Py5zdG9yYWdlX2ZpbGVfaWQpO1xyXG4gICAgcHVzaElkKHJhdz8uYmxvYl9pZCk7XHJcblxyXG4gICAgLy8gQmFja2VuZCBzdG9yZXMgZmlyc3QgYXR0YWNobWVudCBpZCBpbiBtZXNzYWdpbmcubWVzc2FnZS5tZWRpYV91cmwgKFVVSUQpLCBub3QgYSBwdWJsaWMgVVJMLlxyXG4gICAgY29uc3QgbWVkaWFBc0lkID0gU3RyaW5nKGJhc2UubWVkaWFfdXJsIHx8ICcnKS50cmltKCk7XHJcbiAgICBpZiAoXHJcbiAgICAgIG1lZGlhQXNJZCAmJlxyXG4gICAgICAhbWVkaWFBc0lkLnN0YXJ0c1dpdGgoJ3snKSAmJlxyXG4gICAgICAhbWVkaWFBc0lkLnN0YXJ0c1dpdGgoJ1snKSAmJlxyXG4gICAgICAhbWVkaWFBc0lkLnN0YXJ0c1dpdGgoJ2h0dHA6Ly8nKSAmJlxyXG4gICAgICAhbWVkaWFBc0lkLnN0YXJ0c1dpdGgoJ2h0dHBzOi8vJykgJiZcclxuICAgICAgIW1lZGlhQXNJZC5zdGFydHNXaXRoKCdkYXRhOicpXHJcbiAgICApIHtcclxuICAgICAgcHVzaElkKG1lZGlhQXNJZCk7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgY29udGVudFRyaW0gPSBTdHJpbmcoYmFzZS5jb250ZW50IHx8ICcnKS50cmltKCk7XHJcbiAgICBpZiAoYXR0YWNobWVudElkcy5sZW5ndGggPT09IDAgJiYgdXVpZFJlLnRlc3QoY29udGVudFRyaW0pKSB7XHJcbiAgICAgIGF0dGFjaG1lbnRJZHMucHVzaChjb250ZW50VHJpbSk7XHJcbiAgICB9XHJcbiAgICAvLyBTb21lIEFQSXMgc3RvcmUgc3RvcmFnZSAvIGF0dGFjaG1lbnQgaWQgYXMgbnVtZXJpYyBzdHJpbmcgaW4gY29udGVudCBmb3IgRklMRSBtZXNzYWdlcy5cclxuICAgIGlmIChcclxuICAgICAgYXR0YWNobWVudElkcy5sZW5ndGggPT09IDAgJiZcclxuICAgICAgL15cXGQrJC8udGVzdChjb250ZW50VHJpbSkgJiZcclxuICAgICAgKGJhc2UubWVzc2FnZV90eXBlID09PSAnRklMRScgfHwgYmFzZS5tZXNzYWdlX3R5cGUgPT09ICdJTUFHRScpXHJcbiAgICApIHtcclxuICAgICAgYXR0YWNobWVudElkcy5wdXNoKGNvbnRlbnRUcmltKTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBmaWxlbmFtZXM6IHN0cmluZ1tdID0gdG9TdHJpbmdBcnJheShyYXc/LmZpbGVuYW1lcykubGVuZ3RoXHJcbiAgICAgID8gdG9TdHJpbmdBcnJheShyYXc/LmZpbGVuYW1lcylcclxuICAgICAgOiByYXc/LmZpbGVuYW1lXHJcbiAgICAgID8gW1N0cmluZyhyYXcuZmlsZW5hbWUpXVxyXG4gICAgICA6IHJhdz8uZmlsZV9uYW1lXHJcbiAgICAgID8gW1N0cmluZyhyYXcuZmlsZV9uYW1lKV1cclxuICAgICAgOiBbXTtcclxuXHJcbiAgICBjb25zdCBtaW1lVHlwZXM6IHN0cmluZ1tdID0gdG9TdHJpbmdBcnJheShyYXc/Lm1pbWVfdHlwZXMpLmxlbmd0aFxyXG4gICAgICA/IHRvU3RyaW5nQXJyYXkocmF3Py5taW1lX3R5cGVzKVxyXG4gICAgICA6IHRvU3RyaW5nQXJyYXkocmF3Py5taW1lVHlwZXMpO1xyXG5cclxuICAgIGlmIChhdHRhY2htZW50SWRzLmxlbmd0aCA+IDAgfHwgZmlsZW5hbWVzLmxlbmd0aCA+IDApIHtcclxuICAgICAgY29uc3QgZmFsbGJhY2tNaW1lID0gcmF3Py5taW1lX3R5cGUgPz8gcmF3Py5hdHRhY2htZW50X21pbWVfdHlwZSA/PyAoYmFzZS5tZXNzYWdlX3R5cGUgPT09ICdJTUFHRScgPyAnaW1hZ2UvKicgOiB1bmRlZmluZWQpO1xyXG4gICAgICBjb25zdCB1cmxGYWxsYmFjayA9IHJhdz8uZmlsZV91cmwgPz8gcmF3Py51cmwgPz8gcmF3Py5tZWRpYV91cmwgPz8gcmF3Py5tZWRpYVVybDtcclxuICAgICAgY29uc3QgaWRzID0gYXR0YWNobWVudElkcy5sZW5ndGggPiAwID8gYXR0YWNobWVudElkcyA6IFtdO1xyXG4gICAgICBjb25zdCBidWlsdDogQXR0YWNobWVudFtdID0gaWRzLm1hcCgoaWQsIGlkeCkgPT4gKHtcclxuICAgICAgICBmaWxlX2lkOiBpZCxcclxuICAgICAgICBmaWxlbmFtZTogZmlsZW5hbWVzW2lkeF0gfHwgZmlsZW5hbWVzWzBdIHx8IChiYXNlLm1lc3NhZ2VfdHlwZSA9PT0gJ0lNQUdFJyA/IGBJbWFnZSAke2lkeCArIDF9YCA6IGBBdHRhY2htZW50ICR7aWR4ICsgMX1gKSxcclxuICAgICAgICBtaW1lX3R5cGU6IG1pbWVUeXBlc1tpZHhdIHx8IGZhbGxiYWNrTWltZSxcclxuICAgICAgICB1cmw6IHVybEZhbGxiYWNrLFxyXG4gICAgICB9KSk7XHJcblxyXG4gICAgICAvLyBGaWxlbmFtZSBvbmx5ICsgZGlyZWN0IFVSTCAobm8gc3RvcmFnZSBpZCk6IHN0aWxsIHJlbmRlcmFibGUgYXMgPGltZyBzcmM+LlxyXG4gICAgICBpZiAoXHJcbiAgICAgICAgYnVpbHQubGVuZ3RoID09PSAwICYmXHJcbiAgICAgICAgZmlsZW5hbWVzLmxlbmd0aCA+IDAgJiZcclxuICAgICAgICB1cmxGYWxsYmFjayAmJlxyXG4gICAgICAgIFN0cmluZyh1cmxGYWxsYmFjaykubWF0Y2goL15odHRwcz86XFwvXFwvL2kpXHJcbiAgICAgICkge1xyXG4gICAgICAgIGJ1aWx0LnB1c2goe1xyXG4gICAgICAgICAgZmlsZV9pZDogJycsXHJcbiAgICAgICAgICBmaWxlbmFtZTogZmlsZW5hbWVzWzBdLFxyXG4gICAgICAgICAgbWltZV90eXBlOiBmYWxsYmFja01pbWUsXHJcbiAgICAgICAgICB1cmw6IFN0cmluZyh1cmxGYWxsYmFjayksXHJcbiAgICAgICAgfSk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGJ1aWx0LmZvckVhY2goKGF0dGFjaG1lbnQpID0+IGFkZEF0dGFjaG1lbnQoYXR0YWNobWVudCkpO1xyXG4gICAgfVxyXG5cclxuICAgIGlmIChub3JtYWxpemVkQXR0YWNobWVudHMubGVuZ3RoID4gMCkge1xyXG4gICAgICByZXR1cm4geyAuLi5iYXNlLCBhdHRhY2htZW50czogbm9ybWFsaXplZEF0dGFjaG1lbnRzIH07XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIGJhc2U7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHBsYXlTb2Z0Tm90aWZpY2F0aW9uU291bmQoZm9yY2UgPSBmYWxzZSk6IHZvaWQge1xyXG4gICAgaWYgKCFmb3JjZSAmJiB0aGlzLm5vdGlmaWNhdGlvbnNNdXRlZCQudmFsdWUpIHJldHVybjtcclxuICAgIGNvbnN0IHZvbHVtZSA9IE1hdGgubWF4KDAsIE1hdGgubWluKDEsIHRoaXMubm90aWZpY2F0aW9uVm9sdW1lJC52YWx1ZSkpO1xyXG4gICAgaWYgKHZvbHVtZSA8PSAwICYmICFmb3JjZSkgcmV0dXJuO1xyXG5cclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IEF1ZGlvQ3R4ID0gKHdpbmRvdyBhcyBhbnkpLkF1ZGlvQ29udGV4dCB8fCAod2luZG93IGFzIGFueSkud2Via2l0QXVkaW9Db250ZXh0O1xyXG4gICAgICBpZiAoIUF1ZGlvQ3R4KSByZXR1cm47XHJcbiAgICAgIGNvbnN0IGN0eCA9IG5ldyBBdWRpb0N0eCgpO1xyXG4gICAgICBjb25zdCBtYXN0ZXIgPSBjdHguY3JlYXRlR2FpbigpO1xyXG4gICAgICBjb25zdCBvdXRwdXRHYWluID0gTWF0aC5tYXgodm9sdW1lLCAwLjAwMSk7XHJcbiAgICAgIG1hc3Rlci5nYWluLnNldFZhbHVlQXRUaW1lKDAuMDAwMSwgY3R4LmN1cnJlbnRUaW1lKTtcclxuICAgICAgbWFzdGVyLmdhaW4uZXhwb25lbnRpYWxSYW1wVG9WYWx1ZUF0VGltZShvdXRwdXRHYWluLCBjdHguY3VycmVudFRpbWUgKyAwLjAxNSk7XHJcbiAgICAgIG1hc3Rlci5nYWluLmV4cG9uZW50aWFsUmFtcFRvVmFsdWVBdFRpbWUoMC4wMDAxLCBjdHguY3VycmVudFRpbWUgKyAwLjQyKTtcclxuICAgICAgbWFzdGVyLmNvbm5lY3QoY3R4LmRlc3RpbmF0aW9uKTtcclxuXHJcbiAgICAgIGNvbnN0IHBsYXlUb25lID0gKGZyZXF1ZW5jeTogbnVtYmVyLCBzdGFydDogbnVtYmVyLCBkdXJhdGlvbjogbnVtYmVyKSA9PiB7XHJcbiAgICAgICAgY29uc3Qgb3NjID0gY3R4LmNyZWF0ZU9zY2lsbGF0b3IoKTtcclxuICAgICAgICBjb25zdCBnYWluID0gY3R4LmNyZWF0ZUdhaW4oKTtcclxuICAgICAgICBvc2MudHlwZSA9ICdzaW5lJztcclxuICAgICAgICBvc2MuZnJlcXVlbmN5LnNldFZhbHVlQXRUaW1lKGZyZXF1ZW5jeSwgY3R4LmN1cnJlbnRUaW1lICsgc3RhcnQpO1xyXG4gICAgICAgIGdhaW4uZ2Fpbi5zZXRWYWx1ZUF0VGltZSgwLjAwMDEsIGN0eC5jdXJyZW50VGltZSArIHN0YXJ0KTtcclxuICAgICAgICBnYWluLmdhaW4uZXhwb25lbnRpYWxSYW1wVG9WYWx1ZUF0VGltZSgwLjU1LCBjdHguY3VycmVudFRpbWUgKyBzdGFydCArIDAuMDI1KTtcclxuICAgICAgICBnYWluLmdhaW4uZXhwb25lbnRpYWxSYW1wVG9WYWx1ZUF0VGltZSgwLjAwMDEsIGN0eC5jdXJyZW50VGltZSArIHN0YXJ0ICsgZHVyYXRpb24pO1xyXG4gICAgICAgIG9zYy5jb25uZWN0KGdhaW4pO1xyXG4gICAgICAgIGdhaW4uY29ubmVjdChtYXN0ZXIpO1xyXG4gICAgICAgIG9zYy5zdGFydChjdHguY3VycmVudFRpbWUgKyBzdGFydCk7XHJcbiAgICAgICAgb3NjLnN0b3AoY3R4LmN1cnJlbnRUaW1lICsgc3RhcnQgKyBkdXJhdGlvbiArIDAuMDIpO1xyXG4gICAgICB9O1xyXG5cclxuICAgICAgcGxheVRvbmUoNzQwLCAwLCAwLjE4KTtcclxuICAgICAgcGxheVRvbmUoOTg4LCAwLjEyLCAwLjIyKTtcclxuICAgICAgd2luZG93LnNldFRpbWVvdXQoKCkgPT4gY3R4LmNsb3NlKCkuY2F0Y2goKCkgPT4ge30pLCA2MDApO1xyXG4gICAgfSBjYXRjaCB7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHBsYXlOb3RpZmljYXRpb25Tb3VuZCgpOiB2b2lkIHtcclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IGF1ZGlvID0gbmV3IEF1ZGlvKCdkYXRhOmF1ZGlvL3dhdjtiYXNlNjQsVWtsR1Jub0dBQUJYUVZaRlptMTBJQkFBQUFBQkFBRUFRQjhBQUVBZkFBQUJBQWdBWkdGMFlRb0dBQUNCaFlxRmJGMWZkSml2ckpCaE5qVmdvZERicTJFY0JqK2EyL0xEY2lVRkxJSE84dGlKTndnWmFMdnQ1NTlORUF4UXArUHd0bU1jQmppUjEvTE1lU3dGSkhmSDhOMlFRQW9VWHJUcDY2aFZGQXBHbitEeXZtd2hCU3VCenZMWmlUWUlHR1M1N09paFVCRUxUS1hoOGJsbEhBVTJqZFh6em4wdkJTaCt6UExhaXpzS0ZHQ3o2T3lyV0JRTFNLRGY4c0Z1SXdVdWc4L3kyNGszQ0Joa3Urem9vVkFSQzB5bDRmRzVaUndGTm8zVjg4NTlMd1VvZnN6eTJvczdDaFJncytqc3ExZ1ZDMGlnMy9MQmJpTUZMb0xQOHR1Sk53Z1laTHZzNktGUUVRdE1wZUh4dVdVY0JUYU4xZlBPZlM4RktIN004dHFMT3dvVVlMUG83S3RZRlF0SW9OL3l3VzRqQlM2Q3ovTGJpVGNJR0dTNzdPaWhVQkVMVEtYaDhibGxIQVUyamRYenpuMHZCU2grelBMYWl6c0tGR0N6Nk95cldCVUxTS0RmOHNGdUl3VXVncy95MjRrM0NCaGt1K3pvb1ZBUkMweWw0Zkc1WlJ3Rk5vM1Y4ODU5THdVb2Zzenkyb3M3Q2hSZ3MranNxMWdWQzBpZzMvTEJiaU1GTG9MUDh0dUpOd2dZWkx2czZLRlFFUXRNcGVIeHVXVWNCVGFOMWZQT2ZTOEZLSDdNOHRxTE93b1VZTFBvN0t0WUZRdElvTi95d1c0akJTNkN6L0xiaVRjSUdHUzc3T2loVUJFTFRLWGg4YmxsSEFVMmpkWHp6bjB2QlNoK3pQTGFpenNLRkdDejZPeXJXQlVMU0tEZjhzRnVJd1V1Z3MveTI0azNDQmhrdSt6b29WQVJDMHlsNGZHNVpSd0ZObzNWODg1OUx3VW9mc3p5Mm9zN0NoUmdzK2pzcTFnVkMwaWczL0xCYmlNRkxvTFA4dHVKTndnWVpMdnM2S0ZRRVF0TXBlSHh1V1VjQlRhTjFmUE9mUzhGS0g3TTh0cUxPd29VWUxQbzdLdFlGUXRJb04veXdXNGpCUzZDei9MYmlUY0lHR1M3N09paFVCRUxUS1hoOGJsbEhBVTJqZFh6em4wdkJTaCt6UExhaXpzS0ZHQ3o2T3lyV0JVTFNLRGY4c0Z1SXdVdWdzL3kyNGszQ0Joa3Urem9vVkFSQzB5bDRmRzVaUndGTm8zVjg4NTlMd1VvZnN6eTJvczdDaFJncytqc3ExZ1ZDMGlnMy9MQmJpTUZMb0xQOHR1Sk53Z1laTHZzNktGUUVRdE1wZUh4dVdVY0JUYU4xZlBPZlM4RktIN004dHFMT3dvVVlMUG83S3RZRlF0SW9OL3l3VzRqQlM2Q3ovTGJpVGNJR0dTNzdPaWhVQkVMVEtYaDhibGxIQVUyamRYenpuMHZCU2grelBMYWl6c0tGR0N6Nk95cldCVUxTS0RmOHNGdUl3VXVncy95MjRrM0NCaGt1K3pvb1ZBUkMweWw0Zkc1WlJ3Rk5vM1Y4ODU5THdVb2Zzenkyb3M3Q2hSZ3MranNxMWdWQzBpZzMvTEJiaU1GTG9MUDh0dUpOd2dZWkx2czZLRlFFUXRNcGVIeHVXVWNCVGFOMWZQT2ZTOEZLSDdNOHRxTE93b1VZTFBvN0t0WUZRdElvTi95d1c0akJTNkN6L0xiaVRjSUdHUzc3T2loVUJFTFRLWGg4YmxsSEFVMmpkWHp6bjB2QlNoK3pQTGFpenNLRkdDejZPeXJXQlVMU0tEZjhzRnVJd1V1Z3MveTI0azNDQmhrdSt6b29WQVJDMHlsNGZHNVpSd0ZObzNWODg1OUx3VW9mc3p5Jyk7XHJcbiAgICAgIGF1ZGlvLnZvbHVtZSA9IDAuMztcclxuICAgICAgYXVkaW8ucGxheSgpLmNhdGNoKCgpID0+IHt9KTtcclxuICAgIH0gY2F0Y2gge1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSByZWNhbGNVbnJlYWQoaXRlbXM6IEluYm94SXRlbVtdKTogdm9pZCB7XHJcbiAgICBjb25zdCB0b3RhbCA9IGl0ZW1zLnJlZHVjZSgoc3VtLCBpKSA9PiBzdW0gKyBOdW1iZXIoaS51bnJlYWRfY291bnQgfHwgMCksIDApO1xyXG4gICAgdGhpcy50b3RhbFVucmVhZCQubmV4dCh0b3RhbCk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGdldENvbnRhY3ROYW1lQnlJZChjb250YWN0SWQ6IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgICBjb25zdCBpZCA9IFN0cmluZyhjb250YWN0SWQpO1xyXG4gICAgaWYgKGlkID09PSBTdHJpbmcodGhpcy5hdXRoLmNvbnRhY3RJZCB8fCAnJykgJiYgdGhpcy5hdXRoLmN1cnJlbnRDb250YWN0KSB7XHJcbiAgICAgIHJldHVybiBnZXRDb250YWN0RGlzcGxheU5hbWUodGhpcy5hdXRoLmN1cnJlbnRDb250YWN0KTtcclxuICAgIH1cclxuICAgIGNvbnN0IGNvbnRhY3QgPSB0aGlzLnZpc2libGVDb250YWN0cyQudmFsdWUuZmluZCgoYykgPT4gU3RyaW5nKGMuY29udGFjdF9pZCkgPT09IGlkKTtcclxuICAgIHJldHVybiBjb250YWN0ID8gZ2V0Q29udGFjdERpc3BsYXlOYW1lKGNvbnRhY3QpIDogYFVzZXIgJHtpZH1gO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBkZXRlY3RHcm91cFJlbW92YWxGb3JDdXJyZW50VXNlcihtZXNzYWdlOiBNZXNzYWdlKTogdm9pZCB7XHJcbiAgICBjb25zdCBjb250ZW50ID0gU3RyaW5nKG1lc3NhZ2UuY29udGVudCB8fCAnJykudHJpbSgpO1xyXG4gICAgY29uc3QgbWF0Y2ggPSBjb250ZW50Lm1hdGNoKC9eKC4rKSByZW1vdmVkICguKykgZnJvbSB0aGUgZ3JvdXAkLyk7XHJcbiAgICBpZiAoIW1hdGNoKSByZXR1cm47XHJcblxyXG4gICAgY29uc3QgbXlDb250YWN0ID0gdGhpcy5hdXRoLmN1cnJlbnRDb250YWN0O1xyXG4gICAgY29uc3QgbXlOYW1lID0gbXlDb250YWN0ID8gZ2V0Q29udGFjdERpc3BsYXlOYW1lKG15Q29udGFjdCkudHJpbSgpLnRvTG93ZXJDYXNlKCkgOiAnJztcclxuICAgIGNvbnN0IHJlbW92ZWROYW1lID0gbWF0Y2hbMl0/LnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xyXG4gICAgaWYgKCFteU5hbWUgfHwgcmVtb3ZlZE5hbWUgIT09IG15TmFtZSkgcmV0dXJuO1xyXG5cclxuICAgIGNvbnN0IGNvbnZJZCA9IFN0cmluZyhtZXNzYWdlLmNvbnZlcnNhdGlvbl9pZCB8fCAnJyk7XHJcbiAgICBpZiAoY29udklkKSB7XHJcbiAgICAgIHRoaXMubWFya0dyb3VwUmVtb3ZlZChjb252SWQpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBoeWRyYXRlUmVhY3Rpb25zRm9yQ29udmVyc2F0aW9uKGNvbnZlcnNhdGlvbklkOiBzdHJpbmcsIG1lc3NhZ2VzOiBNZXNzYWdlW10sIG9ubHlNaXNzaW5nID0gZmFsc2UpOiB2b2lkIHtcclxuICAgIGNvbnN0IGZldGNoYWJsZSA9IG1lc3NhZ2VzLmZpbHRlcigobSkgPT4ge1xyXG4gICAgICBpZiAoIW0ubWVzc2FnZV9pZCB8fCBTdHJpbmcobS5tZXNzYWdlX2lkKS5zdGFydHNXaXRoKCd0ZW1wLScpKSByZXR1cm4gZmFsc2U7XHJcbiAgICAgIGlmICghb25seU1pc3NpbmcpIHJldHVybiB0cnVlO1xyXG4gICAgICByZXR1cm4gIUFycmF5LmlzQXJyYXkobS5yZWFjdGlvbnMpIHx8IG0ucmVhY3Rpb25zLmxlbmd0aCA9PT0gMDtcclxuICAgIH0pO1xyXG4gICAgaWYgKCFmZXRjaGFibGUubGVuZ3RoKSByZXR1cm47XHJcblxyXG4gICAgY29uc3Qgam9icyA9IGZldGNoYWJsZS5tYXAoKG0pID0+XHJcbiAgICAgIHRoaXMuYXBpLmdldFJlYWN0aW9ucyhtLm1lc3NhZ2VfaWQpLnBpcGUoXHJcbiAgICAgICAgbWFwKChyb3dzKSA9PiAoeyBtZXNzYWdlSWQ6IG0ubWVzc2FnZV9pZCwgcmVhY3Rpb25zOiB0aGlzLm5vcm1hbGl6ZVJlYWN0aW9uUm93cyhyb3dzKSB9KSksXHJcbiAgICAgICAgY2F0Y2hFcnJvcigoKSA9PiBvZih7IG1lc3NhZ2VJZDogbS5tZXNzYWdlX2lkLCByZWFjdGlvbnM6IFtdIH0pKVxyXG4gICAgICApXHJcbiAgICApO1xyXG5cclxuICAgIGZvcmtKb2luKGpvYnMpLnN1YnNjcmliZSgocmVzdWx0cykgPT4ge1xyXG4gICAgICBjb25zdCBtYXAgPSBuZXcgTWFwKHRoaXMubWVzc2FnZXNNYXAkLnZhbHVlKTtcclxuICAgICAgY29uc3QgY3VycmVudCA9IFsuLi4obWFwLmdldChjb252ZXJzYXRpb25JZCkgfHwgW10pXTtcclxuICAgICAgaWYgKCFjdXJyZW50Lmxlbmd0aCkgcmV0dXJuO1xyXG5cclxuICAgICAgbGV0IGNoYW5nZWQgPSBmYWxzZTtcclxuICAgICAgZm9yIChjb25zdCByZXN1bHQgb2YgcmVzdWx0cykge1xyXG4gICAgICAgIGNvbnN0IGlkeCA9IGN1cnJlbnQuZmluZEluZGV4KChtKSA9PiBTdHJpbmcobS5tZXNzYWdlX2lkKSA9PT0gU3RyaW5nKHJlc3VsdC5tZXNzYWdlSWQpKTtcclxuICAgICAgICBpZiAoaWR4ID09PSAtMSkgY29udGludWU7XHJcbiAgICAgICAgY3VycmVudFtpZHhdID0geyAuLi5jdXJyZW50W2lkeF0sIHJlYWN0aW9uczogcmVzdWx0LnJlYWN0aW9ucyB9O1xyXG4gICAgICAgIGNoYW5nZWQgPSB0cnVlO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBpZiAoY2hhbmdlZCkge1xyXG4gICAgICAgIG1hcC5zZXQoY29udmVyc2F0aW9uSWQsIGN1cnJlbnQpO1xyXG4gICAgICAgIHRoaXMubWVzc2FnZXNNYXAkLm5leHQobWFwKTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHJlZnJlc2hNZXNzYWdlUmVhY3Rpb25zKG1lc3NhZ2VJZDogc3RyaW5nKTogdm9pZCB7XHJcbiAgICBpZiAoIW1lc3NhZ2VJZCB8fCBTdHJpbmcobWVzc2FnZUlkKS5zdGFydHNXaXRoKCd0ZW1wLScpKSByZXR1cm47XHJcblxyXG4gICAgdGhpcy5hcGkuZ2V0UmVhY3Rpb25zKG1lc3NhZ2VJZCkuc3Vic2NyaWJlKHtcclxuICAgICAgbmV4dDogKHJvd3MpID0+IHtcclxuICAgICAgICBjb25zdCBub3JtYWxpemVkID0gdGhpcy5ub3JtYWxpemVSZWFjdGlvblJvd3Mocm93cyk7XHJcbiAgICAgICAgY29uc3QgbWFwID0gbmV3IE1hcCh0aGlzLm1lc3NhZ2VzTWFwJC52YWx1ZSk7XHJcbiAgICAgICAgbGV0IGNoYW5nZWQgPSBmYWxzZTtcclxuXHJcbiAgICAgICAgZm9yIChjb25zdCBbY29udmVyc2F0aW9uSWQsIG1zZ3NdIG9mIG1hcC5lbnRyaWVzKCkpIHtcclxuICAgICAgICAgIGNvbnN0IGlkeCA9IG1zZ3MuZmluZEluZGV4KChtKSA9PiBTdHJpbmcobS5tZXNzYWdlX2lkKSA9PT0gU3RyaW5nKG1lc3NhZ2VJZCkpO1xyXG4gICAgICAgICAgaWYgKGlkeCA9PT0gLTEpIGNvbnRpbnVlO1xyXG4gICAgICAgICAgY29uc3QgbmV4dE1zZ3MgPSBbLi4ubXNnc107XHJcbiAgICAgICAgICBuZXh0TXNnc1tpZHhdID0geyAuLi5uZXh0TXNnc1tpZHhdLCByZWFjdGlvbnM6IG5vcm1hbGl6ZWQgfTtcclxuICAgICAgICAgIG1hcC5zZXQoY29udmVyc2F0aW9uSWQsIG5leHRNc2dzKTtcclxuICAgICAgICAgIGNoYW5nZWQgPSB0cnVlO1xyXG4gICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoY2hhbmdlZCkge1xyXG4gICAgICAgICAgdGhpcy5tZXNzYWdlc01hcCQubmV4dChtYXApO1xyXG4gICAgICAgIH1cclxuICAgICAgfSxcclxuICAgICAgZXJyb3I6ICgpID0+IHt9LFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIG5vcm1hbGl6ZVJlYWN0aW9uUm93cyhyb3dzOiBhbnlbXSk6IGFueVtdIHtcclxuICAgIGNvbnN0IGJ5RW1vamkgPSBuZXcgTWFwPHN0cmluZywgeyBlbW9qaTogc3RyaW5nOyBjb3VudDogbnVtYmVyOyBoYXNSZWFjdGVkOiBib29sZWFuOyByZWFjdG9yczogc3RyaW5nW10gfT4oKTtcclxuICAgIGNvbnN0IG15Q29udGFjdElkID0gU3RyaW5nKHRoaXMuYXV0aC5jb250YWN0SWQgfHwgJycpO1xyXG4gICAgY29uc3QgY29udGFjdHMgPSB0aGlzLnZpc2libGVDb250YWN0cyQudmFsdWU7XHJcbiAgICBjb25zdCBwYXJzZVJlYWN0b3JzID0gKHZhbHVlOiBhbnkpOiBhbnlbXSA9PiB7XHJcbiAgICAgIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkgcmV0dXJuIHZhbHVlO1xyXG4gICAgICBpZiAodmFsdWUgJiYgdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JykgcmV0dXJuIFt2YWx1ZV07XHJcbiAgICAgIGlmICh0eXBlb2YgdmFsdWUgIT09ICdzdHJpbmcnIHx8ICF2YWx1ZS50cmltKCkpIHJldHVybiBbXTtcclxuXHJcbiAgICAgIGNvbnN0IHRyaW1tZWQgPSB2YWx1ZS50cmltKCk7XHJcbiAgICAgIGlmICh0cmltbWVkLnN0YXJ0c1dpdGgoJ3snKSB8fCB0cmltbWVkLnN0YXJ0c1dpdGgoJ1snKSkge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICBjb25zdCBwYXJzZWQgPSBKU09OLnBhcnNlKHRyaW1tZWQpO1xyXG4gICAgICAgICAgcmV0dXJuIEFycmF5LmlzQXJyYXkocGFyc2VkKSA/IHBhcnNlZCA6IFtwYXJzZWRdO1xyXG4gICAgICAgIH0gY2F0Y2gge1xyXG4gICAgICAgICAgcmV0dXJuIFt0cmltbWVkXTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIHJldHVybiB0cmltbWVkLnNwbGl0KCcsJykubWFwKCh4OiBzdHJpbmcpID0+IHgudHJpbSgpKS5maWx0ZXIoQm9vbGVhbik7XHJcbiAgICB9O1xyXG5cclxuICAgIGNvbnN0IGRpc3BsYXlOYW1lRm9yUmVhY3RvciA9IChyZWFjdG9yOiBhbnkpOiBzdHJpbmcgPT4ge1xyXG4gICAgICBpZiAocmVhY3RvciA9PSBudWxsKSByZXR1cm4gJyc7XHJcbiAgICAgIGlmICh0eXBlb2YgcmVhY3RvciA9PT0gJ3N0cmluZycpIHtcclxuICAgICAgICBjb25zdCB0cmltbWVkID0gcmVhY3Rvci50cmltKCk7XHJcbiAgICAgICAgaWYgKCF0cmltbWVkKSByZXR1cm4gJyc7XHJcbiAgICAgICAgaWYgKHRyaW1tZWQuc3RhcnRzV2l0aCgneycpIHx8IHRyaW1tZWQuc3RhcnRzV2l0aCgnWycpKSB7XHJcbiAgICAgICAgICBjb25zdCBwYXJzZWQgPSBwYXJzZVJlYWN0b3JzKHRyaW1tZWQpO1xyXG4gICAgICAgICAgcmV0dXJuIHBhcnNlZC5tYXAoZGlzcGxheU5hbWVGb3JSZWFjdG9yKS5maWx0ZXIoQm9vbGVhbikuam9pbignLCAnKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHRyaW1tZWQ7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGNvbnN0IHJlYWN0b3JJZCA9IFN0cmluZyhyZWFjdG9yPy5jb250YWN0X2lkID8/IHJlYWN0b3I/LmNvbnRhY3RJZCA/PyByZWFjdG9yPy5pZCA/PyAnJykudHJpbSgpO1xyXG4gICAgICBpZiAocmVhY3RvcklkICYmIHJlYWN0b3JJZCA9PT0gbXlDb250YWN0SWQpIHJldHVybiAnWW91JztcclxuXHJcbiAgICAgIGNvbnN0IGV4cGxpY2l0TmFtZSA9IFN0cmluZyhcclxuICAgICAgICByZWFjdG9yPy51c2VybmFtZSA/P1xyXG4gICAgICAgIHJlYWN0b3I/Lm5hbWUgPz9cclxuICAgICAgICByZWFjdG9yPy5kaXNwbGF5X25hbWUgPz9cclxuICAgICAgICByZWFjdG9yPy5kaXNwbGF5TmFtZSA/P1xyXG4gICAgICAgIHJlYWN0b3I/LmVtYWlsID8/XHJcbiAgICAgICAgJydcclxuICAgICAgKS50cmltKCk7XHJcbiAgICAgIGlmIChleHBsaWNpdE5hbWUpIHJldHVybiBleHBsaWNpdE5hbWU7XHJcblxyXG4gICAgICBpZiAocmVhY3RvcklkKSB7XHJcbiAgICAgICAgY29uc3QgY29udGFjdCA9IGNvbnRhY3RzLmZpbmQoYyA9PiBTdHJpbmcoYy5jb250YWN0X2lkKSA9PT0gcmVhY3RvcklkKTtcclxuICAgICAgICByZXR1cm4gY29udGFjdCA/IGdldENvbnRhY3REaXNwbGF5TmFtZShjb250YWN0KSA6IGBVc2VyICR7cmVhY3RvcklkfWA7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIHJldHVybiAnJztcclxuICAgIH07XHJcblxyXG4gICAgZm9yIChjb25zdCByb3cgb2Ygcm93cyB8fCBbXSkge1xyXG4gICAgICBjb25zdCBlbW9qaSA9IFN0cmluZyhyb3c/LmVtb2ppIHx8ICcnKS50cmltKCk7XHJcbiAgICAgIGlmICghZW1vamkpIGNvbnRpbnVlO1xyXG5cclxuICAgICAgY29uc3QgY29udGFjdElkID0gU3RyaW5nKHJvdz8uY29udGFjdF9pZCA/PyByb3c/LmNvbnRhY3RJZCA/PyAnJyk7XHJcbiAgICAgIGNvbnN0IGV4cGxpY2l0SGFzUmVhY3RlZCA9IHJvdz8uaGFzUmVhY3RlZCA/PyByb3c/Lmhhc19yZWFjdGVkO1xyXG4gICAgICBjb25zdCBoYXNSZWFjdGVkID0gZXhwbGljaXRIYXNSZWFjdGVkID09PSB0cnVlIHx8IChjb250YWN0SWQgJiYgY29udGFjdElkID09PSBteUNvbnRhY3RJZCk7XHJcblxyXG4gICAgICBjb25zdCByYXdSZWFjdG9ycyA9XHJcbiAgICAgICAgcm93Py5yZWFjdG9ycyA/P1xyXG4gICAgICAgIHJvdz8ucmVhY3Rvcl9uYW1lcyA/P1xyXG4gICAgICAgIHJvdz8ucmVhY3Rvck5hbWVzID8/XHJcbiAgICAgICAgcm93Py5yZWFjdGVkX2J5ID8/XHJcbiAgICAgICAgcm93Py5yZWFjdGVkQnkgPz9cclxuICAgICAgICByb3c/LnVzZXJzID8/XHJcbiAgICAgICAgW107XHJcbiAgICAgIGNvbnN0IHJlYWN0b3JSb3dzID0gcGFyc2VSZWFjdG9ycyhyYXdSZWFjdG9ycyk7XHJcbiAgICAgIGNvbnN0IGNvdW50RnJvbVJvdyA9IE51bWJlcihyb3c/LmNvdW50ID8/IHJvdz8ucmVhY3Rpb25fY291bnQgPz8gcm93Py5yZWFjdGlvbkNvdW50ID8/IHJlYWN0b3JSb3dzLmxlbmd0aCA/PyAwKTtcclxuICAgICAgY29uc3QgZXhpc3RpbmcgPSBieUVtb2ppLmdldChlbW9qaSkgfHwgeyBlbW9qaSwgY291bnQ6IDAsIGhhc1JlYWN0ZWQ6IGZhbHNlLCByZWFjdG9yczogW10gfTtcclxuXHJcbiAgICAgIC8vIFNvbWUgQVBJcyByZXR1cm4gb25lIHJvdyBwZXIgcmVhY3Rpb247IHNvbWUgcmV0dXJuIHByZS1hZ2dyZWdhdGVkIGNvdW50LlxyXG4gICAgICBleGlzdGluZy5jb3VudCArPSBjb3VudEZyb21Sb3cgPiAwID8gY291bnRGcm9tUm93IDogMTtcclxuICAgICAgZXhpc3RpbmcuaGFzUmVhY3RlZCA9IGV4aXN0aW5nLmhhc1JlYWN0ZWQgfHwgISFoYXNSZWFjdGVkO1xyXG5cclxuICAgICAgLy8gVHJhY2sgcmVhY3RvciBkaXNwbGF5IG5hbWVzIHdoZW4gaW5kaXZpZHVhbCBjb250YWN0SWQgaXMgYXZhaWxhYmxlXHJcbiAgICAgIGlmIChjb250YWN0SWQgJiYgY291bnRGcm9tUm93IDw9IDEpIHtcclxuICAgICAgICBsZXQgbmFtZTogc3RyaW5nO1xyXG4gICAgICAgIGlmIChjb250YWN0SWQgPT09IG15Q29udGFjdElkKSB7XHJcbiAgICAgICAgICBuYW1lID0gJ1lvdSc7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIGNvbnN0IGNvbnRhY3QgPSBjb250YWN0cy5maW5kKGMgPT4gU3RyaW5nKGMuY29udGFjdF9pZCkgPT09IGNvbnRhY3RJZCk7XHJcbiAgICAgICAgICBuYW1lID0gY29udGFjdCA/IGdldENvbnRhY3REaXNwbGF5TmFtZShjb250YWN0KSA6IGBVc2VyICR7Y29udGFjdElkfWA7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICghZXhpc3RpbmcucmVhY3RvcnMuaW5jbHVkZXMobmFtZSkpIHtcclxuICAgICAgICAgIGV4aXN0aW5nLnJlYWN0b3JzLnB1c2gobmFtZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcblxyXG4gICAgICBmb3IgKGNvbnN0IHJlYWN0b3Igb2YgcmVhY3RvclJvd3MpIHtcclxuICAgICAgICBjb25zdCByZWFjdG9ySWQgPSBTdHJpbmcoXHJcbiAgICAgICAgICB0eXBlb2YgcmVhY3RvciA9PT0gJ29iamVjdCdcclxuICAgICAgICAgICAgPyByZWFjdG9yPy5jb250YWN0X2lkID8/IHJlYWN0b3I/LmNvbnRhY3RJZCA/PyByZWFjdG9yPy5pZCA/PyAnJ1xyXG4gICAgICAgICAgICA6ICcnXHJcbiAgICAgICAgKS50cmltKCk7XHJcbiAgICAgICAgY29uc3QgbmFtZSA9IGRpc3BsYXlOYW1lRm9yUmVhY3RvcihyZWFjdG9yKTtcclxuICAgICAgICBpZiAocmVhY3RvcklkICYmIHJlYWN0b3JJZCA9PT0gbXlDb250YWN0SWQpIHtcclxuICAgICAgICAgIGV4aXN0aW5nLmhhc1JlYWN0ZWQgPSB0cnVlO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAobmFtZSAmJiAhZXhpc3RpbmcucmVhY3RvcnMuaW5jbHVkZXMobmFtZSkpIHtcclxuICAgICAgICAgIGV4aXN0aW5nLnJlYWN0b3JzLnB1c2gobmFtZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcblxyXG4gICAgICBjb25zdCBkaXJlY3ROYW1lID0gU3RyaW5nKFxyXG4gICAgICAgIHJvdz8ucmVhY3Rvcl9uYW1lID8/XHJcbiAgICAgICAgcm93Py5yZWFjdG9yTmFtZSA/P1xyXG4gICAgICAgIHJvdz8uY29udGFjdF9uYW1lID8/XHJcbiAgICAgICAgcm93Py5jb250YWN0TmFtZSA/P1xyXG4gICAgICAgIHJvdz8udXNlcm5hbWUgPz9cclxuICAgICAgICByb3c/LmVtYWlsID8/XHJcbiAgICAgICAgJydcclxuICAgICAgKS50cmltKCk7XHJcbiAgICAgIGlmIChkaXJlY3ROYW1lICYmICFleGlzdGluZy5yZWFjdG9ycy5pbmNsdWRlcyhkaXJlY3ROYW1lKSkge1xyXG4gICAgICAgIGV4aXN0aW5nLnJlYWN0b3JzLnB1c2goY29udGFjdElkID09PSBteUNvbnRhY3RJZCA/ICdZb3UnIDogZGlyZWN0TmFtZSk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGJ5RW1vamkuc2V0KGVtb2ppLCBleGlzdGluZyk7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIEFycmF5LmZyb20oYnlFbW9qaS52YWx1ZXMoKSkuZmlsdGVyKChyKSA9PiByLmNvdW50ID4gMCk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGFwcGx5UmVhY3Rpb25PcHRpbWlzdGljYWxseShtZXNzYWdlSWQ6IHN0cmluZywgZW1vamk6IHN0cmluZywgYWRkOiBib29sZWFuKTogdm9pZCB7XHJcbiAgICBjb25zdCBtYXAgPSBuZXcgTWFwKHRoaXMubWVzc2FnZXNNYXAkLnZhbHVlKTtcclxuICAgIGxldCBkaWRVcGRhdGUgPSBmYWxzZTtcclxuXHJcbiAgICBmb3IgKGNvbnN0IFtjb252ZXJzYXRpb25JZCwgbXNnc10gb2YgbWFwLmVudHJpZXMoKSkge1xyXG4gICAgICBjb25zdCBpZHggPSBtc2dzLmZpbmRJbmRleCgobSkgPT4gU3RyaW5nKG0ubWVzc2FnZV9pZCkgPT09IFN0cmluZyhtZXNzYWdlSWQpKTtcclxuICAgICAgaWYgKGlkeCA9PT0gLTEpIGNvbnRpbnVlO1xyXG5cclxuICAgICAgY29uc3QgdGFyZ2V0ID0gbXNnc1tpZHhdO1xyXG4gICAgICBjb25zdCBuZXh0UmVhY3Rpb25zID0gWy4uLih0YXJnZXQucmVhY3Rpb25zIHx8IFtdKV07XHJcbiAgICAgIGNvbnN0IHJJZHggPSBuZXh0UmVhY3Rpb25zLmZpbmRJbmRleCgocikgPT4gci5lbW9qaSA9PT0gZW1vamkpO1xyXG5cclxuICAgICAgaWYgKGFkZCkge1xyXG4gICAgICAgIGlmIChySWR4ID49IDApIHtcclxuICAgICAgICAgIGNvbnN0IGN1cnJlbnQgPSBuZXh0UmVhY3Rpb25zW3JJZHhdO1xyXG4gICAgICAgICAgaWYgKCFjdXJyZW50Lmhhc1JlYWN0ZWQpIHtcclxuICAgICAgICAgICAgY29uc3QgcmVhY3RvcnMgPSBBcnJheS5pc0FycmF5KGN1cnJlbnQucmVhY3RvcnMpID8gWy4uLmN1cnJlbnQucmVhY3RvcnNdIDogW107XHJcbiAgICAgICAgICAgIGlmICghcmVhY3RvcnMuaW5jbHVkZXMoJ1lvdScpKSByZWFjdG9ycy51bnNoaWZ0KCdZb3UnKTtcclxuICAgICAgICAgICAgbmV4dFJlYWN0aW9uc1tySWR4XSA9IHtcclxuICAgICAgICAgICAgICAuLi5jdXJyZW50LFxyXG4gICAgICAgICAgICAgIGhhc1JlYWN0ZWQ6IHRydWUsXHJcbiAgICAgICAgICAgICAgY291bnQ6IE51bWJlcihjdXJyZW50LmNvdW50IHx8IDApICsgMSxcclxuICAgICAgICAgICAgICByZWFjdG9ycyxcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgbmV4dFJlYWN0aW9ucy5wdXNoKHsgZW1vamksIGNvdW50OiAxLCBoYXNSZWFjdGVkOiB0cnVlLCByZWFjdG9yczogWydZb3UnXSB9KTtcclxuICAgICAgICB9XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgaWYgKHJJZHggPj0gMCkge1xyXG4gICAgICAgICAgY29uc3QgY3VycmVudCA9IG5leHRSZWFjdGlvbnNbcklkeF07XHJcbiAgICAgICAgICBjb25zdCBuZXh0Q291bnQgPSBNYXRoLm1heChOdW1iZXIoY3VycmVudC5jb3VudCB8fCAwKSAtIChjdXJyZW50Lmhhc1JlYWN0ZWQgPyAxIDogMCksIDApO1xyXG4gICAgICAgICAgaWYgKG5leHRDb3VudCA9PT0gMCkge1xyXG4gICAgICAgICAgICBuZXh0UmVhY3Rpb25zLnNwbGljZShySWR4LCAxKTtcclxuICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIG5leHRSZWFjdGlvbnNbcklkeF0gPSB7XHJcbiAgICAgICAgICAgICAgLi4uY3VycmVudCxcclxuICAgICAgICAgICAgICBoYXNSZWFjdGVkOiBmYWxzZSxcclxuICAgICAgICAgICAgICBjb3VudDogbmV4dENvdW50LFxyXG4gICAgICAgICAgICAgIHJlYWN0b3JzOiBBcnJheS5pc0FycmF5KGN1cnJlbnQucmVhY3RvcnMpXHJcbiAgICAgICAgICAgICAgICA/IGN1cnJlbnQucmVhY3RvcnMuZmlsdGVyKChuYW1lOiBzdHJpbmcpID0+IG5hbWUgIT09ICdZb3UnKVxyXG4gICAgICAgICAgICAgICAgOiBjdXJyZW50LnJlYWN0b3JzLFxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG5cclxuICAgICAgY29uc3QgdXBkYXRlZE1zZzogTWVzc2FnZSA9IHsgLi4udGFyZ2V0LCByZWFjdGlvbnM6IG5leHRSZWFjdGlvbnMgfTtcclxuICAgICAgY29uc3QgdXBkYXRlZE1zZ3MgPSBbLi4ubXNnc107XHJcbiAgICAgIHVwZGF0ZWRNc2dzW2lkeF0gPSB1cGRhdGVkTXNnO1xyXG4gICAgICBtYXAuc2V0KGNvbnZlcnNhdGlvbklkLCB1cGRhdGVkTXNncyk7XHJcbiAgICAgIGRpZFVwZGF0ZSA9IHRydWU7XHJcbiAgICAgIGJyZWFrO1xyXG4gICAgfVxyXG5cclxuICAgIGlmIChkaWRVcGRhdGUpIHtcclxuICAgICAgdGhpcy5tZXNzYWdlc01hcCQubmV4dChtYXApO1xyXG4gICAgfVxyXG4gIH1cclxufVxyXG4iXX0=