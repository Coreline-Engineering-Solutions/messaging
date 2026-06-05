import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject, forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { PLAIN_TEXT_MESSAGE_PREFIX, getContactDisplayName, getMessageSenderName, } from '../models/messaging.models';
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
    groupMembershipVersion$ = new BehaviorSubject(0);
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
    groupMembershipVersion = this.groupMembershipVersion$.asObservable();
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
        this.auth.refreshMessagingSession().subscribe({
            next: (contact) => {
                if (!contact) {
                    this.teardown();
                    return;
                }
                this.initializeWithVerifiedSession();
            },
            error: () => this.teardown(),
        });
    }
    initializeWithVerifiedSession() {
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
        this.groupMembershipVersion$.next(0);
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
    prepareOutgoingMessageContent(content, replyTo, forcePlainText) {
        const body = String(content || '').trim();
        const withReply = !replyTo ? body : (() => {
            const reply = this.createReplyPreview(replyTo);
            const sender = (reply.sender_name || 'message').replace(/\]/g, '').trim();
            const excerpt = this.replyExcerpt(reply.content || '');
            return `[Reply to ${sender}]\n> ${excerpt}\n\n${body}`;
        })();
        return forcePlainText ? `${PLAIN_TEXT_MESSAGE_PREFIX}${withReply}` : withReply;
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
        const outgoingContent = this.prepareOutgoingMessageContent(content, options?.replyTo || null, options?.forcePlainText);
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
            render_as_plain_text: options?.forcePlainText,
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
                    render_as_plain_text: options?.forcePlainText,
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
                            this.notifyGroupMembershipChanged();
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
                    this.notifyGroupMembershipChanged();
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
    editMessage(messageId, content) {
        const contactId = this.auth.contactId;
        const conversationId = this.activeConversationId$.value;
        const nextContent = content.trim();
        if (!contactId || !conversationId || !messageId || !nextContent)
            return;
        this.api.editMessage(messageId, contactId, nextContent).subscribe({
            next: (res) => {
                const serverMessage = res?.message ? this.normalizeMessageShape(res.message) : null;
                this.updateMessageInConversation(conversationId, messageId, serverMessage || {
                    content: nextContent,
                    edited_at: res?.edited_at || new Date().toISOString(),
                });
                this.loadInbox();
            },
            error: () => { },
        });
    }
    deleteMessage(messageId) {
        const contactId = this.auth.contactId;
        const conversationId = this.activeConversationId$.value;
        if (!contactId || !conversationId || !messageId)
            return;
        if (String(messageId).startsWith('temp-')) {
            this.removeMessageFromConversation(conversationId, messageId);
            return;
        }
        this.api.deleteMessage(messageId, contactId).subscribe({
            next: () => {
                this.updateMessageInConversation(conversationId, messageId, {
                    content: '[deleted]',
                    is_deleted: true,
                });
                this.loadInbox();
            },
            error: () => { },
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
                this.handleConversationUpdated(this.wsEventPayload(msg));
                break;
            case 'group_updated':
                this.handleGroupUpdated(this.wsEventPayload(msg));
                break;
            case 'error':
                this.handleWebSocketError(msg.message);
                break;
        }
    }
    handleConversationUpdated(data) {
        this.loadInbox();
        const activeId = this.activeConversationId$.value;
        const eventConversationId = data?.conversation_id ?? data?.conversationId;
        if (activeId && (!eventConversationId || String(eventConversationId) === String(activeId))) {
            this.loadMessages(activeId, undefined, true);
        }
    }
    handleGroupUpdated(data) {
        this.handleConversationUpdated(data);
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
    updateMessageInConversation(conversationId, messageId, patch) {
        const map = new Map(this.messagesMap$.value);
        const current = map.get(conversationId) || [];
        const next = current.map((message) => String(message.message_id) === String(messageId)
            ? this.normalizeMessageShape({ ...message, ...patch })
            : message);
        map.set(conversationId, next);
        this.messagesMap$.next(map);
    }
    removeMessageFromConversation(conversationId, messageId) {
        const map = new Map(this.messagesMap$.value);
        const current = map.get(conversationId) || [];
        map.set(conversationId, current.filter((message) => String(message.message_id) !== String(messageId)));
        this.messagesMap$.next(map);
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
    notifyGroupMembershipChanged() {
        this.groupMembershipVersion$.next(this.groupMembershipVersion$.value + 1);
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
            edited_at: raw?.edited_at ?? raw?.editedAt,
            is_deleted: Boolean(raw?.is_deleted ?? raw?.isDeleted ?? false),
            deleted_at: raw?.deleted_at ?? raw?.deletedAt,
            reactions: raw?.reactions,
            mentions: raw?.mentions,
            attachments: raw?.attachments,
            is_pinned: raw?.is_pinned,
            pinned_at: raw?.pinned_at,
            pinned_by: raw?.pinned_by,
        };
        const rawContent = String(base.content || '');
        if (rawContent.startsWith(PLAIN_TEXT_MESSAGE_PREFIX)) {
            base.content = rawContent.slice(PLAIN_TEXT_MESSAGE_PREFIX.length);
            base.render_as_plain_text = true;
        }
        else {
            base.render_as_plain_text = raw?.render_as_plain_text ?? raw?.renderAsPlainText;
        }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVzc2FnaW5nLXN0b3JlLnNlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvbGliL3NlcnZpY2VzL21lc3NhZ2luZy1zdG9yZS5zZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxVQUFVLEVBQWEsTUFBTSxlQUFlLENBQUM7QUFDdEQsT0FBTyxFQUFFLGVBQWUsRUFBRSxVQUFVLEVBQUUsT0FBTyxFQUFnQixRQUFRLEVBQUUsRUFBRSxFQUFFLE1BQU0sTUFBTSxDQUFDO0FBQ3hGLE9BQU8sRUFBRSxVQUFVLEVBQUUsR0FBRyxFQUFFLE1BQU0sZ0JBQWdCLENBQUM7QUFJakQsT0FBTyxFQUlMLHlCQUF5QixFQU16QixxQkFBcUIsRUFDckIsb0JBQW9CLEdBQ3JCLE1BQU0sNEJBQTRCLENBQUM7Ozs7O0FBR3BDLE1BQU0sT0FBTyxxQkFBcUI7SUF3RXRCO0lBQ0E7SUFDQTtJQXpFVix1QkFBdUI7SUFDZixNQUFNLEdBQUcsSUFBSSxlQUFlLENBQWMsRUFBRSxDQUFDLENBQUM7SUFDOUMsWUFBWSxHQUFHLElBQUksZUFBZSxDQUF5QixJQUFJLEdBQUcsRUFBRSxDQUFDLENBQUM7SUFDdEUsVUFBVSxHQUFHLElBQUksZUFBZSxDQUFlLEVBQUUsQ0FBQyxDQUFDO0lBQ25ELGdCQUFnQixHQUFHLElBQUksZUFBZSxDQUFZLEVBQUUsQ0FBQyxDQUFDO0lBQ3RELFVBQVUsR0FBRyxJQUFJLGVBQWUsQ0FBVSxLQUFLLENBQUMsQ0FBQztJQUNqRCxXQUFXLEdBQUcsSUFBSSxlQUFlLENBQW9GLE9BQU8sQ0FBQyxDQUFDO0lBQzlILFlBQVksR0FBRyxJQUFJLGVBQWUsQ0FDdkMsWUFBWSxDQUFDLE9BQU8sQ0FBQyx3QkFBd0IsQ0FBaUIsSUFBSSxPQUFPLENBQzNFLENBQUM7SUFDTSxxQkFBcUIsR0FBRyxJQUFJLGVBQWUsQ0FBZ0IsSUFBSSxDQUFDLENBQUM7SUFDakUsbUJBQW1CLEdB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QUFPLENBQUMsUUFBUTt5QkFDckIsQ0FBQztvQkFDSixDQUFDO2dCQUNILENBQUM7WUFDSCxDQUFDO1lBRUQsTUFBTSxVQUFVLEdBQVksRUFBRSxHQUFHLE1BQU0sRUFBRSxTQUFTLEVBQUUsYUFBYSxFQUFFLENBQUM7WUFDcEUsTUFBTSxXQUFXLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDO1lBQzlCLFdBQVcsQ0FBQyxHQUFHLENBQUMsR0FBRyxVQUFVLENBQUM7WUFDOUIsR0FBRyxDQUFDLEdBQUcsQ0FBQyxjQUFjLEVBQUUsV0FBVyxDQUFDLENBQUM7WUFDckMsU0FBUyxHQUFHLElBQUksQ0FBQztZQUNqQixNQUFNO1FBQ1IsQ0FBQztRQUVELElBQUksU0FBUyxFQUFFLENBQUM7WUFDZCxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUM5QixDQUFDO0lBQ0gsQ0FBQzt3R0F2eURVLHFCQUFxQjs0R0FBckIscUJBQXFCLGNBRFIsTUFBTTs7NEZBQ25CLHFCQUFxQjtrQkFEakMsVUFBVTttQkFBQyxFQUFFLFVBQVUsRUFBRSxNQUFNLEVBQUUiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBJbmplY3RhYmxlLCBPbkRlc3Ryb3kgfSBmcm9tICdAYW5ndWxhci9jb3JlJztcclxuaW1wb3J0IHsgQmVoYXZpb3JTdWJqZWN0LCBPYnNlcnZhYmxlLCBTdWJqZWN0LCBTdWJzY3JpcHRpb24sIGZvcmtKb2luLCBvZiB9IGZyb20gJ3J4anMnO1xyXG5pbXBvcnQgeyBjYXRjaEVycm9yLCBtYXAgfSBmcm9tICdyeGpzL29wZXJhdG9ycyc7XHJcbmltcG9ydCB7IEF1dGhTZXJ2aWNlIH0gZnJvbSAnLi9hdXRoLnNlcnZpY2UnO1xyXG5pbXBvcnQgeyBNZXNzYWdpbmdBcGlTZXJ2aWNlIH0gZnJvbSAnLi9tZXNzYWdpbmctYXBpLnNlcnZpY2UnO1xyXG5pbXBvcnQgeyBNZXNzYWdpbmdXZWJTb2NrZXRTZXJ2aWNlIH0gZnJvbSAnLi9tZXNzYWdpbmctd2Vic29ja2V0LnNlcnZpY2UnO1xyXG5pbXBvcnQge1xyXG4gIEluYm94SXRlbSxcclxuICBNZXNzYWdlLFxyXG4gIE1lc3NhZ2VSZXBseVByZXZpZXcsXHJcbiAgUExBSU5fVEVYVF9NRVNTQUdFX1BSRUZJWCxcclxuICBBdHRhY2htZW50LFxyXG4gIENvbnRhY3QsXHJcbiAgQ2hhdFdpbmRvdyxcclxuICBXZWJTb2NrZXRNZXNzYWdlLFxyXG4gIFNpZGViYXJTaWRlLFxyXG4gIGdldENvbnRhY3REaXNwbGF5TmFtZSxcclxuICBnZXRNZXNzYWdlU2VuZGVyTmFtZSxcclxufSBmcm9tICcuLi9tb2RlbHMvbWVzc2FnaW5nLm1vZGVscyc7XHJcblxyXG5ASW5qZWN0YWJsZSh7IHByb3ZpZGVkSW46ICdyb290JyB9KVxyXG5leHBvcnQgY2xhc3MgTWVzc2FnaW5nU3RvcmVTZXJ2aWNlIGltcGxlbWVudHMgT25EZXN0cm95IHtcclxuICAvLyDilIDilIAgU3RhdGUgc3ViamVjdHMg4pSA4pSAXHJcbiAgcHJpdmF0ZSBpbmJveCQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PEluYm94SXRlbVtdPihbXSk7XHJcbiAgcHJpdmF0ZSBtZXNzYWdlc01hcCQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PE1hcDxzdHJpbmcsIE1lc3NhZ2VbXT4+KG5ldyBNYXAoKSk7XHJcbiAgcHJpdmF0ZSBvcGVuQ2hhdHMkID0gbmV3IEJlaGF2aW9yU3ViamVjdDxDaGF0V2luZG93W10+KFtdKTtcclxuICBwcml2YXRlIHZpc2libGVDb250YWN0cyQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PENvbnRhY3RbXT4oW10pO1xyXG4gIHByaXZhdGUgcGFuZWxPcGVuJCA9IG5ldyBCZWhhdmlvclN1YmplY3Q8Ym9vbGVhbj4oZmFsc2UpO1xyXG4gIHByaXZhdGUgYWN0aXZlVmlldyQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PCdpbmJveCcgfCAnY2hhdCcgfCAnbmV3LWNvbnZlcnNhdGlvbicgfCAnZ3JvdXAtbWFuYWdlcicgfCAnY29udmVyc2F0aW9uLXNldHRpbmdzJz4oJ2luYm94Jyk7XHJcbiAgcHJpdmF0ZSBzaWRlYmFyU2lkZSQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PFNpZGViYXJTaWRlPihcclxuICAgIChsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnbWVzc2FnaW5nX3NpZGViYXJfc2lkZScpIGFzIFNpZGViYXJTaWRlKSB8fCAncmlnaHQnXHJcbiAgKTtcclxuICBwcml2YXRlIGFjdGl2ZUNvbnZlcnNhdGlvbklkJCA9IG5ldyBCZWhhdmlvclN1YmplY3Q8c3RyaW5nIHwgbnVsbD4obnVsbCk7XHJcbiAgcHJpdmF0ZSBwZW5kaW5nRG1SZWNpcGllbnQkID0gbmV3IEJlaGF2aW9yU3ViamVjdDx7Y29udGFjdElkOiBzdHJpbmcsIG5hbWU6IHN0cmluZ30gfCBudWxsPihudWxsKTtcclxuICBwcml2YXRlIHRvdGFsVW5yZWFkJCA9IG5ldyBCZWhhdmlvclN1YmplY3Q8bnVtYmVyPigwKTtcclxuICBwcml2YXRlIGxvYWRpbmdNZXNzYWdlcyQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PGJvb2xlYW4+KGZhbHNlKTtcclxuICBwcml2YXRlIHBhbmVsUG9zaXRpb24kID0gbmV3IEJlaGF2aW9yU3ViamVjdDx7IHg6IG51bWJlcjsgeTogbnVtYmVyIH0gfCBudWxsPihudWxsKTtcclxuICBwcml2YXRlIHBhbmVsU2l6ZSQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PHsgd2lkdGg6IG51bWJlcjsgaGVpZ2h0OiBudW1iZXIgfT4oeyB3aWR0aDogMzgwLCBoZWlnaHQ6IDU2MCB9KTtcclxuICBwcml2YXRlIHdhc09wZW5CZWZvcmVEcmFnJCA9IG5ldyBCZWhhdmlvclN1YmplY3Q8Ym9vbGVhbj4oZmFsc2UpO1xyXG4gIHByaXZhdGUgcGFuZWxGbG9hdGluZyQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PGJvb2xlYW4+KGZhbHNlKTtcclxuICBwcml2YXRlIG5vdGlmaWNhdGlvblZvbHVtZSQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PG51bWJlcj4oXHJcbiAgICBOdW1iZXIobG9jYWxTdG9yYWdlLmdldEl0ZW0oJ21lc3NhZ2luZ19ub3RpZmljYXRpb25fdm9sdW1lJykgPz8gJzAuMzUnKVxyXG4gICk7XHJcbiAgcHJpdmF0ZSBub3RpZmljYXRpb25zTXV0ZWQkID0gbmV3IEJlaGF2aW9yU3ViamVjdDxib29sZWFuPihcclxuICAgIGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdtZXNzYWdpbmdfbm90aWZpY2F0aW9uc19tdXRlZCcpID09PSAndHJ1ZSdcclxuICApO1xyXG4gIHByaXZhdGUgbWVzc2FnZVRleHRTY2FsZSQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PG51bWJlcj4oXHJcbiAgICBOdW1iZXIobG9jYWxTdG9yYWdlLmdldEl0ZW0oJ21lc3NhZ2luZ19tZXNzYWdlX3RleHRfc2NhbGUnKSA/PyAnMScpXHJcbiAgKTtcclxuICBwcml2YXRlIGNvZGVUZXh0U2NhbGUkID0gbmV3IEJlaGF2aW9yU3ViamVjdDxudW1iZXI+KFxyXG4gICAgTnVtYmVyKGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdtZXNzYWdpbmdfY29kZV90ZXh0X3NjYWxlJykgPz8gJzEnKVxyXG4gICk7XHJcbiAgcHJpdmF0ZSB0b2FzdCQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PHsgbWVzc2FnZTogc3RyaW5nOyB0eXBlOiAnaW5mbycgfCAnc3VjY2VzcycgfCAnZXJyb3InIH0gfCBudWxsPihudWxsKTtcclxuICBwcml2YXRlIHJlbW92ZWRHcm91cElkcyQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PFNldDxzdHJpbmc+PihuZXcgU2V0KCkpO1xyXG4gIHByaXZhdGUgbWVudGlvbkNvbnZlcnNhdGlvbklkcyQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PFNldDxzdHJpbmc+PihuZXcgU2V0KCkpO1xyXG4gIHByaXZhdGUgZ3JvdXBNZW1iZXJzaGlwVmVyc2lvbiQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PG51bWJlcj4oMCk7XHJcblxyXG4gIC8vIOKUgOKUgCBQdWJsaWMgb2JzZXJ2YWJsZXMg4pSA4pSAXHJcbiAgcmVhZG9ubHkgaW5ib3ggPSB0aGlzLmluYm94JC5hc09ic2VydmFibGUoKTtcclxuICByZWFkb25seSBtZXNzYWdlc01hcCA9IHRoaXMubWVzc2FnZXNNYXAkLmFzT2JzZXJ2YWJsZSgpO1xyXG4gIHJlYWRvbmx5IG9wZW5DaGF0cyA9IHRoaXMub3BlbkNoYXRzJC5hc09ic2VydmFibGUoKTtcclxuICByZWFkb25seSB2aXNpYmxlQ29udGFjdHMgPSB0aGlzLnZpc2libGVDb250YWN0cyQuYXNPYnNlcnZhYmxlKCk7XHJcbiAgcmVhZG9ubHkgcGFuZWxPcGVuID0gdGhpcy5wYW5lbE9wZW4kLmFzT2JzZXJ2YWJsZSgpO1xyXG4gIHJlYWRvbmx5IGFjdGl2ZVZpZXcgPSB0aGlzLmFjdGl2ZVZpZXckLmFzT2JzZXJ2YWJsZSgpO1xyXG4gIHJlYWRvbmx5IGFjdGl2ZUNvbnZlcnNhdGlvbklkID0gdGhpcy5hY3RpdmVDb252ZXJzYXRpb25JZCQuYXNPYnNlcnZhYmxlKCk7XHJcbiAgcmVhZG9ubHkgdG90YWxVbnJlYWQgPSB0aGlzLnRvdGFsVW5yZWFkJC5hc09ic2VydmFibGUoKTtcclxuICByZWFkb25seSBsb2FkaW5nTWVzc2FnZXMgPSB0aGlzLmxvYWRpbmdNZXNzYWdlcyQuYXNPYnNlcnZhYmxlKCk7XHJcbiAgd3NTdGF0dXM6IE9ic2VydmFibGU8c3RyaW5nPiA9IG5ldyBPYnNlcnZhYmxlPHN0cmluZz4oKTtcclxuICByZWFkb25seSBwYW5lbFBvc2l0aW9uID0gdGhpcy5wYW5lbFBvc2l0aW9uJC5hc09ic2VydmFibGUoKTtcclxuICByZWFkb25seSBwYW5lbFNpemUgPSB0aGlzLnBhbmVsU2l6ZSQuYXNPYnNlcnZhYmxlKCk7XHJcbiAgcmVhZG9ubHkgd2FzT3BlbkJlZm9yZURyYWcgPSB0aGlzLndhc09wZW5CZWZvcmVEcmFnJC5hc09ic2VydmFibGUoKTtcclxuICByZWFkb25seSBzaWRlYmFyU2lkZSA9IHRoaXMuc2lkZWJhclNpZGUkLmFzT2JzZXJ2YWJsZSgpO1xyXG4gIHJlYWRvbmx5IHBhbmVsRmxvYXRpbmcgPSB0aGlzLnBhbmVsRmxvYXRpbmckLmFzT2JzZXJ2YWJsZSgpO1xyXG4gIHJlYWRvbmx5IG5vdGlmaWNhdGlvblZvbHVtZSA9IHRoaXMubm90aWZpY2F0aW9uVm9sdW1lJC5hc09ic2VydmFibGUoKTtcclxuICByZWFkb25seSBub3RpZmljYXRpb25zTXV0ZWQgPSB0aGlzLm5vdGlmaWNhdGlvbnNNdXRlZCQuYXNPYnNlcnZhYmxlKCk7XHJcbiAgcmVhZG9ubHkgbWVzc2FnZVRleHRTY2FsZSA9IHRoaXMubWVzc2FnZVRleHRTY2FsZSQuYXNPYnNlcnZhYmxlKCk7XHJcbiAgcmVhZG9ubHkgY29kZVRleHRTY2FsZSA9IHRoaXMuY29kZVRleHRTY2FsZSQuYXNPYnNlcnZhYmxlKCk7XHJcbiAgcmVhZG9ubHkgdG9hc3QgPSB0aGlzLnRvYXN0JC5hc09ic2VydmFibGUoKTtcclxuICByZWFkb25seSByZW1vdmVkR3JvdXBJZHMgPSB0aGlzLnJlbW92ZWRHcm91cElkcyQuYXNPYnNlcnZhYmxlKCk7XHJcbiAgcmVhZG9ubHkgbWVudGlvbkNvbnZlcnNhdGlvbklkcyA9IHRoaXMubWVudGlvbkNvbnZlcnNhdGlvbklkcyQuYXNPYnNlcnZhYmxlKCk7XHJcbiAgcmVhZG9ubHkgZ3JvdXBNZW1iZXJzaGlwVmVyc2lvbiA9IHRoaXMuZ3JvdXBNZW1iZXJzaGlwVmVyc2lvbiQuYXNPYnNlcnZhYmxlKCk7XHJcblxyXG4gIHByaXZhdGUgd3NTdWI6IFN1YnNjcmlwdGlvbiB8IG51bGwgPSBudWxsO1xyXG4gIHByaXZhdGUgZGVzdHJveSQgPSBuZXcgU3ViamVjdDx2b2lkPigpO1xyXG4gIHByaXZhdGUgcG9sbFRpbWVyOiBhbnkgPSBudWxsO1xyXG4gIHByaXZhdGUgZ3JvdXBTZXR0aW5ncyQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PHsgY29udmVyc2F0aW9uSWQ6IHN0cmluZzsgbmFtZTogc3RyaW5nIH0gfCBudWxsPihudWxsKTtcclxuICBwcml2YXRlIGRlbGV0aW5nQ29udmVyc2F0aW9uSWRzID0gbmV3IFNldDxzdHJpbmc+KCk7XHJcbiAgcHJpdmF0ZSByZW1vdmFsVG9hc3RTaG93biA9IG5ldyBTZXQ8c3RyaW5nPigpO1xyXG4gIHByaXZhdGUgdG9hc3RUaW1lcjogYW55ID0gbnVsbDtcclxuXHJcbiAgcmVhZG9ubHkgZ3JvdXBTZXR0aW5ncyA9IHRoaXMuZ3JvdXBTZXR0aW5ncyQuYXNPYnNlcnZhYmxlKCk7XHJcblxyXG4gIGNvbnN0cnVjdG9yKFxyXG4gICAgcHJpdmF0ZSBhdXRoOiBBdXRoU2VydmljZSxcclxuICAgIHByaXZhdGUgYXBpOiBNZXNzYWdpbmdBcGlTZXJ2aWNlLFxyXG4gICAgcHJpdmF0ZSB3c1NlcnZpY2U6IE1lc3NhZ2luZ1dlYlNvY2tldFNlcnZpY2VcclxuICApIHtcclxuICAgICh0aGlzIGFzIGFueSkud3NTdGF0dXMgPSB0aGlzLndzU2VydmljZS5zdGF0dXMkO1xyXG4gIH1cclxuXHJcbiAgLy8g4pSA4pSAIEluaXRpYWxpemF0aW9uIOKUgOKUgFxyXG4gIGluaXRpYWxpemUoKTogdm9pZCB7XHJcbiAgICBpZiAoIXRoaXMuYXV0aC5pc0F1dGhlbnRpY2F0ZWQoKSkgcmV0dXJuO1xyXG5cclxuICAgIHRoaXMuYXV0aC5yZWZyZXNoTWVzc2FnaW5nU2Vzc2lvbigpLnN1YnNjcmliZSh7XHJcbiAgICAgIG5leHQ6IChjb250YWN0KSA9PiB7XHJcbiAgICAgICAgaWYgKCFjb250YWN0KSB7XHJcbiAgICAgICAgICB0aGlzLnRlYXJkb3duKCk7XHJcbiAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMuaW5pdGlhbGl6ZVdpdGhWZXJpZmllZFNlc3Npb24oKTtcclxuICAgICAgfSxcclxuICAgICAgZXJyb3I6ICgpID0+IHRoaXMudGVhcmRvd24oKSxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBpbml0aWFsaXplV2l0aFZlcmlmaWVkU2Vzc2lvbigpOiB2b2lkIHtcclxuICAgIGNvbnN0IGNvbnRhY3RJZCA9IHRoaXMuYXV0aC5jb250YWN0SWQhO1xyXG4gICAgY29uc3Qgc2Vzc2lvbkdpZCA9IHRoaXMuYXV0aC5zZXNzaW9uR2lkITtcclxuXHJcbiAgICB0aGlzLmxvYWRJbmJveCgpO1xyXG4gICAgdGhpcy5sb2FkVmlzaWJsZUNvbnRhY3RzKCk7XHJcblxyXG4gICAgdGhpcy53c1NlcnZpY2UuY29ubmVjdChjb250YWN0SWQsIHNlc3Npb25HaWQpO1xyXG4gICAgdGhpcy5saXN0ZW5XZWJTb2NrZXQoKTtcclxuICAgIHRoaXMuc3RhcnRQb2xsaW5nKCk7XHJcbiAgfVxyXG5cclxuICB0ZWFyZG93bigpOiB2b2lkIHtcclxuICAgIHRoaXMuc3RvcFBvbGxpbmcoKTtcclxuICAgIGlmICh0aGlzLnRvYXN0VGltZXIpIHtcclxuICAgICAgY2xlYXJUaW1lb3V0KHRoaXMudG9hc3RUaW1lcik7XHJcbiAgICAgIHRoaXMudG9hc3RUaW1lciA9IG51bGw7XHJcbiAgICB9XHJcbiAgICB0aGlzLndzU2VydmljZS5kaXNjb25uZWN0KCk7XHJcbiAgICB0aGlzLndzU3ViPy51bnN1YnNjcmliZSgpO1xyXG4gICAgdGhpcy5pbmJveCQubmV4dChbXSk7XHJcbiAgICB0aGlzLm1lc3NhZ2VzTWFwJC5uZXh0KG5ldyBNYXAoKSk7XHJcbiAgICB0aGlzLm9wZW5DaGF0cyQubmV4dChbXSk7XHJcbiAgICB0aGlzLnBhbmVsT3BlbiQubmV4dChmYWxzZSk7XHJcbiAgICB0aGlzLmFjdGl2ZVZpZXckLm5leHQoJ2luYm94Jyk7XHJcbiAgICB0aGlzLmFjdGl2ZUNvbnZlcnNhdGlvbklkJC5uZXh0KG51bGwpO1xyXG4gICAgdGhpcy50b3RhbFVucmVhZCQubmV4dCgwKTtcclxuICAgIHRoaXMuZGVsZXRpbmdDb252ZXJzYXRpb25JZHMuY2xlYXIoKTtcclxuICAgIHRoaXMucmVtb3ZhbFRvYXN0U2hvd24uY2xlYXIoKTtcclxuICAgIHRoaXMucmVtb3ZlZEdyb3VwSWRzJC5uZXh0KG5ldyBTZXQoKSk7XHJcbiAgICB0aGlzLm1lbnRpb25Db252ZXJzYXRpb25JZHMkLm5leHQobmV3IFNldCgpKTtcclxuICAgIHRoaXMuZ3JvdXBNZW1iZXJzaGlwVmVyc2lvbiQubmV4dCgwKTtcclxuICAgIHRoaXMudG9hc3QkLm5leHQobnVsbCk7XHJcbiAgfVxyXG5cclxuICAvLyDilIDilIAgUG9sbGluZyBmYWxsYmFjayAoaW5ib3ggb25seSAtIG1lc3NhZ2VzIHJlbHkgb24gV2ViU29ja2V0KSDilIDilIBcclxuICBwcml2YXRlIHN0YXJ0UG9sbGluZygpOiB2b2lkIHtcclxuICAgIHRoaXMuc3RvcFBvbGxpbmcoKTtcclxuICAgIHRoaXMucG9sbFRpbWVyID0gc2V0SW50ZXJ2YWwoKCkgPT4ge1xyXG4gICAgICB0aGlzLmxvYWRJbmJveCgpO1xyXG4gICAgfSwgMzAwMDApO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBzdG9wUG9sbGluZygpOiB2b2lkIHtcclxuICAgIGlmICh0aGlzLnBvbGxUaW1lcikge1xyXG4gICAgICBjbGVhckludGVydmFsKHRoaXMucG9sbFRpbWVyKTtcclxuICAgICAgdGhpcy5wb2xsVGltZXIgPSBudWxsO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgbmdPbkRlc3Ryb3koKTogdm9pZCB7XHJcbiAgICB0aGlzLnRlYXJkb3duKCk7XHJcbiAgICB0aGlzLmRlc3Ryb3kkLm5leHQoKTtcclxuICAgIHRoaXMuZGVzdHJveSQuY29tcGxldGUoKTtcclxuICB9XHJcblxyXG4gIC8vIOKUgOKUgCBQYW5lbCBjb250cm9scyDilIDilIBcclxuICB0b2dnbGVQYW5lbChidXR0b25YPzogbnVtYmVyLCBidXR0b25ZPzogbnVtYmVyKTogdm9pZCB7XHJcbiAgICBpZiAoYnV0dG9uWCAhPT0gdW5kZWZpbmVkICYmIGJ1dHRvblkgIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICB0aGlzLnBhbmVsUG9zaXRpb24kLm5leHQoeyB4OiBidXR0b25YLCB5OiBidXR0b25ZIH0pO1xyXG4gICAgfVxyXG4gICAgdGhpcy5wYW5lbE9wZW4kLm5leHQoIXRoaXMucGFuZWxPcGVuJC52YWx1ZSk7XHJcbiAgfVxyXG5cclxuICBvcGVuUGFuZWwoYnV0dG9uWD86IG51bWJlciwgYnV0dG9uWT86IG51bWJlcik6IHZvaWQge1xyXG4gICAgaWYgKGJ1dHRvblggIT09IHVuZGVmaW5lZCAmJiBidXR0b25ZICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgdGhpcy5wYW5lbFBvc2l0aW9uJC5uZXh0KHsgeDogYnV0dG9uWCwgeTogYnV0dG9uWSB9KTtcclxuICAgIH1cclxuICAgIHRoaXMucGFuZWxPcGVuJC5uZXh0KHRydWUpO1xyXG4gIH1cclxuXHJcbiAgY2xvc2VQYW5lbCgpOiB2b2lkIHtcclxuICAgIHRoaXMucGFuZWxPcGVuJC5uZXh0KGZhbHNlKTtcclxuICB9XHJcblxyXG4gIHNldFBhbmVsU2l6ZSh3aWR0aDogbnVtYmVyLCBoZWlnaHQ6IG51bWJlcik6IHZvaWQge1xyXG4gICAgdGhpcy5wYW5lbFNpemUkLm5leHQoeyB3aWR0aCwgaGVpZ2h0IH0pO1xyXG4gICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ21lc3NhZ2luZ19wYW5lbF9zaXplJywgSlNPTi5zdHJpbmdpZnkoeyB3aWR0aCwgaGVpZ2h0IH0pKTtcclxuICB9XHJcblxyXG4gIGdldFBhbmVsU2l6ZSgpOiB7IHdpZHRoOiBudW1iZXI7IGhlaWdodDogbnVtYmVyIH0ge1xyXG4gICAgY29uc3Qgc2F2ZWQgPSBsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnbWVzc2FnaW5nX3BhbmVsX3NpemUnKTtcclxuICAgIGlmIChzYXZlZCkge1xyXG4gICAgICB0cnkge1xyXG4gICAgICAgIGNvbnN0IHBhcnNlZCA9IEpTT04ucGFyc2Uoc2F2ZWQpO1xyXG4gICAgICAgIGlmIChwYXJzZWQud2lkdGggJiYgcGFyc2VkLmhlaWdodCkge1xyXG4gICAgICAgICAgdGhpcy5wYW5lbFNpemUkLm5leHQocGFyc2VkKTtcclxuICAgICAgICAgIHJldHVybiBwYXJzZWQ7XHJcbiAgICAgICAgfVxyXG4gICAgICB9IGNhdGNoIHt9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdGhpcy5wYW5lbFNpemUkLnZhbHVlO1xyXG4gIH1cclxuXHJcbiAgb25CdXR0b25EcmFnU3RhcnQoKTogdm9pZCB7XHJcbiAgICB0aGlzLndhc09wZW5CZWZvcmVEcmFnJC5uZXh0KHRoaXMucGFuZWxPcGVuJC52YWx1ZSk7XHJcbiAgICBpZiAodGhpcy5wYW5lbE9wZW4kLnZhbHVlKSB7XHJcbiAgICAgIHRoaXMucGFuZWxPcGVuJC5uZXh0KGZhbHNlKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIG9uQnV0dG9uRHJhZ0VuZChidXR0b25YOiBudW1iZXIsIGJ1dHRvblk6IG51bWJlcik6IHZvaWQge1xyXG4gICAgaWYgKHRoaXMud2FzT3BlbkJlZm9yZURyYWckLnZhbHVlKSB7XHJcbiAgICAgIHRoaXMub3BlblBhbmVsKGJ1dHRvblgsIGJ1dHRvblkpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgc2V0Vmlldyh2aWV3OiAnaW5ib3gnIHwgJ2NoYXQnIHwgJ25ldy1jb252ZXJzYXRpb24nIHwgJ2dyb3VwLW1hbmFnZXInIHwgJ2NvbnZlcnNhdGlvbi1zZXR0aW5ncycpOiB2b2lkIHtcclxuICAgIHRoaXMuYWN0aXZlVmlldyQubmV4dCh2aWV3KTtcclxuICB9XHJcblxyXG4gIHRvZ2dsZVNpZGViYXJTaWRlKCk6IHZvaWQge1xyXG4gICAgY29uc3QgbmV4dCA9IHRoaXMuc2lkZWJhclNpZGUkLnZhbHVlID09PSAncmlnaHQnID8gJ2xlZnQnIDogJ3JpZ2h0JztcclxuICAgIHRoaXMuc2lkZWJhclNpZGUkLm5leHQobmV4dCk7XHJcbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnbWVzc2FnaW5nX3NpZGViYXJfc2lkZScsIG5leHQpO1xyXG4gIH1cclxuXHJcbiAgc2V0UGFuZWxGbG9hdGluZyhpc0Zsb2F0aW5nOiBib29sZWFuKTogdm9pZCB7XHJcbiAgICB0aGlzLnBhbmVsRmxvYXRpbmckLm5leHQoaXNGbG9hdGluZyk7XHJcbiAgfVxyXG5cclxuICBzZXROb3RpZmljYXRpb25Wb2x1bWUodm9sdW1lOiBudW1iZXIpOiB2b2lkIHtcclxuICAgIGNvbnN0IG5vcm1hbGl6ZWQgPSBNYXRoLm1heCgwLCBNYXRoLm1pbigxLCBOdW1iZXIodm9sdW1lKSkpO1xyXG4gICAgdGhpcy5ub3RpZmljYXRpb25Wb2x1bWUkLm5leHQobm9ybWFsaXplZCk7XHJcbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnbWVzc2FnaW5nX25vdGlmaWNhdGlvbl92b2x1bWUnLCBTdHJpbmcobm9ybWFsaXplZCkpO1xyXG4gICAgaWYgKG5vcm1hbGl6ZWQgPiAwICYmIHRoaXMubm90aWZpY2F0aW9uc011dGVkJC52YWx1ZSkge1xyXG4gICAgICB0aGlzLnNldE5vdGlmaWNhdGlvbnNNdXRlZChmYWxzZSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBzZXROb3RpZmljYXRpb25zTXV0ZWQobXV0ZWQ6IGJvb2xlYW4pOiB2b2lkIHtcclxuICAgIHRoaXMubm90aWZpY2F0aW9uc011dGVkJC5uZXh0KG11dGVkKTtcclxuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdtZXNzYWdpbmdfbm90aWZpY2F0aW9uc19tdXRlZCcsIFN0cmluZyhtdXRlZCkpO1xyXG4gIH1cclxuXHJcbiAgc2V0TWVzc2FnZVRleHRTY2FsZShzY2FsZTogbnVtYmVyKTogdm9pZCB7XHJcbiAgICBjb25zdCBub3JtYWxpemVkID0gTWF0aC5tYXgoMC44LCBNYXRoLm1pbigxLjUsIE51bWJlcihzY2FsZSkpKTtcclxuICAgIHRoaXMubWVzc2FnZVRleHRTY2FsZSQubmV4dChub3JtYWxpemVkKTtcclxuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdtZXNzYWdpbmdfbWVzc2FnZV90ZXh0X3NjYWxlJywgU3RyaW5nKG5vcm1hbGl6ZWQpKTtcclxuICB9XHJcblxyXG4gIHNldENvZGVUZXh0U2NhbGUoc2NhbGU6IG51bWJlcik6IHZvaWQge1xyXG4gICAgY29uc3Qgbm9ybWFsaXplZCA9IE1hdGgubWF4KDAuOCwgTWF0aC5taW4oMS41LCBOdW1iZXIoc2NhbGUpKSk7XHJcbiAgICB0aGlzLmNvZGVUZXh0U2NhbGUkLm5leHQobm9ybWFsaXplZCk7XHJcbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnbWVzc2FnaW5nX2NvZGVfdGV4dF9zY2FsZScsIFN0cmluZyhub3JtYWxpemVkKSk7XHJcbiAgfVxyXG5cclxuICB0ZXN0Tm90aWZpY2F0aW9uU291bmQoKTogdm9pZCB7XHJcbiAgICB0aGlzLnBsYXlTb2Z0Tm90aWZpY2F0aW9uU291bmQodHJ1ZSk7XHJcbiAgfVxyXG5cclxuICBwcmVwYXJlT3V0Z29pbmdNZXNzYWdlQ29udGVudChjb250ZW50OiBzdHJpbmcsIHJlcGx5VG8/OiBNZXNzYWdlIHwgbnVsbCwgZm9yY2VQbGFpblRleHQ/OiBib29sZWFuKTogc3RyaW5nIHtcclxuICAgIGNvbnN0IGJvZHkgPSBTdHJpbmcoY29udGVudCB8fCAnJykudHJpbSgpO1xyXG4gICAgY29uc3Qgd2l0aFJlcGx5ID0gIXJlcGx5VG8gPyBib2R5IDogKCgpID0+IHtcclxuICAgICAgY29uc3QgcmVwbHkgPSB0aGlzLmNyZWF0ZVJlcGx5UHJldmlldyhyZXBseVRvKTtcclxuICAgICAgY29uc3Qgc2VuZGVyID0gKHJlcGx5LnNlbmRlcl9uYW1lIHx8ICdtZXNzYWdlJykucmVwbGFjZSgvXFxdL2csICcnKS50cmltKCk7XHJcbiAgICAgIGNvbnN0IGV4Y2VycHQgPSB0aGlzLnJlcGx5RXhjZXJwdChyZXBseS5jb250ZW50IHx8ICcnKTtcclxuICAgICAgcmV0dXJuIGBbUmVwbHkgdG8gJHtzZW5kZXJ9XVxcbj4gJHtleGNlcnB0fVxcblxcbiR7Ym9keX1gO1xyXG4gICAgfSkoKTtcclxuICAgIHJldHVybiBmb3JjZVBsYWluVGV4dCA/IGAke1BMQUlOX1RFWFRfTUVTU0FHRV9QUkVGSVh9JHt3aXRoUmVwbHl9YCA6IHdpdGhSZXBseTtcclxuICB9XHJcblxyXG4gIGNyZWF0ZVJlcGx5UHJldmlldyhtZXNzYWdlOiBNZXNzYWdlKTogTWVzc2FnZVJlcGx5UHJldmlldyB7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICBtZXNzYWdlX2lkOiBTdHJpbmcobWVzc2FnZS5tZXNzYWdlX2lkIHx8ICcnKSxcclxuICAgICAgc2VuZGVyX25hbWU6IGdldE1lc3NhZ2VTZW5kZXJOYW1lKG1lc3NhZ2UpICE9PSAnVW5rbm93bidcclxuICAgICAgICA/IGdldE1lc3NhZ2VTZW5kZXJOYW1lKG1lc3NhZ2UpXHJcbiAgICAgICAgOiB0aGlzLmdldENvbnRhY3ROYW1lQnlJZChtZXNzYWdlLnNlbmRlcl9pZCksXHJcbiAgICAgIGNvbnRlbnQ6IHRoaXMucmVwbHlFeGNlcnB0KFN0cmluZyhtZXNzYWdlLmNvbnRlbnQgfHwgJycpKSxcclxuICAgIH07XHJcbiAgfVxyXG5cclxuICBzaG93VG9hc3QobWVzc2FnZTogc3RyaW5nLCB0eXBlOiAnaW5mbycgfCAnc3VjY2VzcycgfCAnZXJyb3InID0gJ2luZm8nLCBkdXJhdGlvbk1zID0gMzAwMCk6IHZvaWQge1xyXG4gICAgaWYgKHRoaXMudG9hc3RUaW1lcikge1xyXG4gICAgICBjbGVhclRpbWVvdXQodGhpcy50b2FzdFRpbWVyKTtcclxuICAgICAgdGhpcy50b2FzdFRpbWVyID0gbnVsbDtcclxuICAgIH1cclxuICAgIHRoaXMudG9hc3QkLm5leHQoeyBtZXNzYWdlLCB0eXBlIH0pO1xyXG4gICAgdGhpcy50b2FzdFRpbWVyID0gc2V0VGltZW91dCgoKSA9PiB7XHJcbiAgICAgIHRoaXMudG9hc3QkLm5leHQobnVsbCk7XHJcbiAgICAgIHRoaXMudG9hc3RUaW1lciA9IG51bGw7XHJcbiAgICB9LCBkdXJhdGlvbk1zKTtcclxuICB9XHJcblxyXG4gIGdldFNpZGViYXJTaWRlKCk6IFNpZGViYXJTaWRlIHtcclxuICAgIHJldHVybiB0aGlzLnNpZGViYXJTaWRlJC52YWx1ZTtcclxuICB9XHJcblxyXG4gIC8vIOKUgOKUgCBJbmJveCDilIDilIBcclxuICBsb2FkSW5ib3goKTogdm9pZCB7XHJcbiAgICBjb25zdCBjb250YWN0SWQgPSB0aGlzLmF1dGguY29udGFjdElkO1xyXG4gICAgaWYgKCFjb250YWN0SWQpIHJldHVybjtcclxuXHJcbiAgICB0aGlzLmFwaS5nZXRJbmJveChjb250YWN0SWQpLnN1YnNjcmliZSh7XHJcbiAgICAgIG5leHQ6IChpdGVtcykgPT4ge1xyXG4gICAgICAgIGNvbnN0IG1hcHBlZCA9IGl0ZW1zLm1hcChpdGVtID0+IHtcclxuICAgICAgICAgIGNvbnN0IGlzR3JvdXAgPSBpdGVtLmlzX2dyb3VwID09PSB0cnVlIHx8IChpdGVtLmlzX2dyb3VwIGFzIGFueSkgPT09ICdUcnVlJztcclxuICAgICAgICAgIGNvbnN0IGNvbnZlcnNhdGlvbklkID0gU3RyaW5nKGl0ZW0uY29udmVyc2F0aW9uX2lkKTtcclxuICAgICAgICAgIGNvbnN0IHByZXZpZXcgPSB0aGlzLnJlcGx5Qm9keVRleHQoaXRlbS5sYXN0X21lc3NhZ2VfcHJldmlldyB8fCAnJyk7XHJcbiAgICAgICAgICBjb25zdCBoYXNNZW50aW9uID1cclxuICAgICAgICAgICAgdGhpcy5tZW50aW9uQ29udmVyc2F0aW9uSWRzJC52YWx1ZS5oYXMoY29udmVyc2F0aW9uSWQpIHx8XHJcbiAgICAgICAgICAgIChOdW1iZXIoaXRlbS51bnJlYWRfY291bnQgfHwgMCkgPiAwICYmIHRoaXMubWVzc2FnZVRleHRNZW50aW9uc0N1cnJlbnRVc2VyKHByZXZpZXcpKTtcclxuICAgICAgICAgIFxyXG4gICAgICAgICAgaWYgKCFpc0dyb3VwICYmICFpdGVtLm5hbWUgJiYgaXRlbS5vdGhlcl9wYXJ0aWNpcGFudF9uYW1lKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB7IC4uLml0ZW0sIG5hbWU6IGl0ZW0ub3RoZXJfcGFydGljaXBhbnRfbmFtZSwgbGFzdF9tZXNzYWdlX3ByZXZpZXc6IHByZXZpZXcsIGlzX2dyb3VwOiBmYWxzZSwgaGFzX21lbnRpb246IGhhc01lbnRpb24gfTtcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIHJldHVybiB7IC4uLml0ZW0sIGxhc3RfbWVzc2FnZV9wcmV2aWV3OiBwcmV2aWV3LCBpc19ncm91cDogaXNHcm91cCwgaGFzX21lbnRpb246IGhhc01lbnRpb24gfTtcclxuICAgICAgICB9KS5maWx0ZXIoaXRlbSA9PlxyXG4gICAgICAgICAgIXRoaXMuZGVsZXRpbmdDb252ZXJzYXRpb25JZHMuaGFzKFN0cmluZyhpdGVtLmNvbnZlcnNhdGlvbl9pZCkpICYmXHJcbiAgICAgICAgICAhdGhpcy5yZW1vdmVkR3JvdXBJZHMkLnZhbHVlLmhhcyhTdHJpbmcoaXRlbS5jb252ZXJzYXRpb25faWQpKVxyXG4gICAgICAgICk7XHJcbiAgICAgICAgdGhpcy5pbmJveCQubmV4dChtYXBwZWQpO1xyXG4gICAgICAgIHRoaXMucmVjYWxjVW5yZWFkKG1hcHBlZCk7XHJcblxyXG4gICAgICAgIGNvbnN0IGlkcyA9IG1hcHBlZC5tYXAoKGkpID0+IGkuY29udmVyc2F0aW9uX2lkKTtcclxuICAgICAgICB0aGlzLndzU2VydmljZS5zdWJzY3JpYmVBbGwoaWRzKTtcclxuICAgICAgfSxcclxuICAgICAgZXJyb3I6ICgpID0+IHt9LFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvLyDilIDilIAgQ29udGFjdHMg4pSA4pSAXHJcbiAgbG9hZFZpc2libGVDb250YWN0cygpOiB2b2lkIHtcclxuICAgIGNvbnN0IGNvbnRhY3RJZCA9IHRoaXMuYXV0aC5jb250YWN0SWQ7XHJcbiAgICBpZiAoIWNvbnRhY3RJZCkgcmV0dXJuO1xyXG5cclxuICAgIHRoaXMuYXBpLmdldFZpc2libGVDb250YWN0cyhjb250YWN0SWQpLnN1YnNjcmliZSh7XHJcbiAgICAgIG5leHQ6IChjb250YWN0cykgPT4ge1xyXG4gICAgICAgIHRoaXMudmlzaWJsZUNvbnRhY3RzJC5uZXh0KGNvbnRhY3RzKTtcclxuICAgICAgICBcclxuICAgICAgICBjb25zdCBjdXJyZW50Q29udGFjdCA9IHRoaXMuYXV0aC5jdXJyZW50Q29udGFjdDtcclxuICAgICAgICBpZiAoY3VycmVudENvbnRhY3QgJiYgY3VycmVudENvbnRhY3QuZW1haWwpIHtcclxuICAgICAgICAgIGNvbnN0IG1hdGNoID0gY29udGFjdHMuZmluZChjID0+IGMuZW1haWwgPT09IGN1cnJlbnRDb250YWN0LmVtYWlsKTtcclxuICAgICAgICAgIGlmIChcclxuICAgICAgICAgICAgbWF0Y2ggJiZcclxuICAgICAgICAgICAgU3RyaW5nKG1hdGNoLmNvbnRhY3RfaWQpICE9PSBTdHJpbmcoY3VycmVudENvbnRhY3QuY29udGFjdF9pZClcclxuICAgICAgICAgICkge1xyXG4gICAgICAgICAgICB0aGlzLmF1dGguc2V0U2Vzc2lvbih0aGlzLmF1dGguc2Vzc2lvbkdpZCEsIHsgLi4uY3VycmVudENvbnRhY3QsIGNvbnRhY3RfaWQ6IG1hdGNoLmNvbnRhY3RfaWQgfSk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB0aGlzLndzU2VydmljZS5kaXNjb25uZWN0KCk7XHJcbiAgICAgICAgICAgIHRoaXMud3NTZXJ2aWNlLmNvbm5lY3QobWF0Y2guY29udGFjdF9pZCwgdGhpcy5hdXRoLnNlc3Npb25HaWQhKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgIH0sXHJcbiAgICAgIGVycm9yOiAoKSA9PiB7fSxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLy8g4pSA4pSAIENvbnZlcnNhdGlvbnMg4pSA4pSAXHJcbiAgb3BlbkNvbnZlcnNhdGlvbihjb252ZXJzYXRpb25JZDogc3RyaW5nLCBuYW1lOiBzdHJpbmcsIGlzR3JvdXAgPSBmYWxzZSk6IHZvaWQge1xyXG4gICAgaWYgKCFjb252ZXJzYXRpb25JZCB8fCBjb252ZXJzYXRpb25JZCA9PT0gJ3VuZGVmaW5lZCcpIHtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgdGhpcy5hY3RpdmVDb252ZXJzYXRpb25JZCQubmV4dChjb252ZXJzYXRpb25JZCk7XHJcbiAgICB0aGlzLmFjdGl2ZVZpZXckLm5leHQoJ2NoYXQnKTtcclxuICAgIHRoaXMub3BlblBhbmVsKCk7XHJcblxyXG4gICAgY29uc3QgY2hhdHMgPSB0aGlzLm9wZW5DaGF0cyQudmFsdWU7XHJcbiAgICBpZiAoIWNoYXRzLmZpbmQoKGMpID0+IGMuY29udmVyc2F0aW9uSWQgPT09IGNvbnZlcnNhdGlvbklkKSkge1xyXG4gICAgICB0aGlzLm9wZW5DaGF0cyQubmV4dChbXHJcbiAgICAgICAgLi4uY2hhdHMsXHJcbiAgICAgICAgeyBjb252ZXJzYXRpb25JZCwgbmFtZSwgaXNHcm91cCwgaXNNaW5pbWl6ZWQ6IGZhbHNlLCB1bnJlYWRDb3VudDogMCB9LFxyXG4gICAgICBdKTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBleGlzdGluZyA9IHRoaXMubWVzc2FnZXNNYXAkLnZhbHVlLmdldChjb252ZXJzYXRpb25JZCk7XHJcbiAgICBpZiAoIWV4aXN0aW5nIHx8IGV4aXN0aW5nLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICB0aGlzLmxvYWRNZXNzYWdlcyhjb252ZXJzYXRpb25JZCk7XHJcbiAgICB9XHJcbiAgICB0aGlzLm1hcmtBc1JlYWQoY29udmVyc2F0aW9uSWQpO1xyXG4gICAgdGhpcy53c1NlcnZpY2Uuc3Vic2NyaWJlKGNvbnZlcnNhdGlvbklkKTtcclxuICB9XHJcblxyXG4gIGNsb3NlQ2hhdChjb252ZXJzYXRpb25JZDogc3RyaW5nKTogdm9pZCB7XHJcbiAgICBjb25zdCBjaGF0cyA9IHRoaXMub3BlbkNoYXRzJC52YWx1ZS5maWx0ZXIoKGMpID0+IGMuY29udmVyc2F0aW9uSWQgIT09IGNvbnZlcnNhdGlvbklkKTtcclxuICAgIHRoaXMub3BlbkNoYXRzJC5uZXh0KGNoYXRzKTtcclxuXHJcbiAgICBpZiAoU3RyaW5nKHRoaXMuYWN0aXZlQ29udmVyc2F0aW9uSWQkLnZhbHVlKSA9PT0gU3RyaW5nKGNvbnZlcnNhdGlvbklkKSkge1xyXG4gICAgICB0aGlzLmFjdGl2ZUNvbnZlcnNhdGlvbklkJC5uZXh0KG51bGwpO1xyXG4gICAgICB0aGlzLmFjdGl2ZVZpZXckLm5leHQoJ2luYm94Jyk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBtYXJrR3JvdXBSZW1vdmVkKGNvbnZlcnNhdGlvbklkOiBzdHJpbmcpOiB2b2lkIHtcclxuICAgIGNvbnN0IGlkID0gU3RyaW5nKGNvbnZlcnNhdGlvbklkKTtcclxuICAgIGlmICghaWQgfHwgaWQgPT09ICd1bmRlZmluZWQnKSByZXR1cm47XHJcblxyXG4gICAgY29uc3QgbmV4dCA9IG5ldyBTZXQodGhpcy5yZW1vdmVkR3JvdXBJZHMkLnZhbHVlKTtcclxuICAgIG5leHQuYWRkKGlkKTtcclxuICAgIHRoaXMucmVtb3ZlZEdyb3VwSWRzJC5uZXh0KG5leHQpO1xyXG5cclxuICAgIGNvbnN0IGl0ZW1zID0gdGhpcy5pbmJveCQudmFsdWUuZmlsdGVyKGkgPT4gU3RyaW5nKGkuY29udmVyc2F0aW9uX2lkKSAhPT0gaWQpO1xyXG4gICAgdGhpcy5pbmJveCQubmV4dChpdGVtcyk7XHJcbiAgICB0aGlzLnJlY2FsY1VucmVhZChpdGVtcyk7XHJcblxyXG4gICAgaWYgKCF0aGlzLnJlbW92YWxUb2FzdFNob3duLmhhcyhpZCkpIHtcclxuICAgICAgdGhpcy5yZW1vdmFsVG9hc3RTaG93bi5hZGQoaWQpO1xyXG4gICAgICB0aGlzLnNob3dUb2FzdCgnWW91IHdlcmUgcmVtb3ZlZCBmcm9tIHRoaXMgZ3JvdXAnLCAnaW5mbycsIDUwMDApO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgZXhpdFJlbW92ZWRHcm91cChjb252ZXJzYXRpb25JZDogc3RyaW5nKTogdm9pZCB7XHJcbiAgICBjb25zdCBpZCA9IFN0cmluZyhjb252ZXJzYXRpb25JZCk7XHJcbiAgICBjb25zdCBuZXh0ID0gbmV3IFNldCh0aGlzLnJlbW92ZWRHcm91cElkcyQudmFsdWUpO1xyXG4gICAgbmV4dC5kZWxldGUoaWQpO1xyXG4gICAgdGhpcy5yZW1vdmVkR3JvdXBJZHMkLm5leHQobmV4dCk7XHJcbiAgICB0aGlzLnJlbW92YWxUb2FzdFNob3duLmRlbGV0ZShpZCk7XHJcbiAgICB0aGlzLnJlbW92ZUNvbnZlcnNhdGlvbkZyb21VaShpZCk7XHJcbiAgfVxyXG5cclxuICAvLyDilIDilIAgTWVzc2FnZXMg4pSA4pSAXHJcbiAgbG9hZE1lc3NhZ2VzKGNvbnZlcnNhdGlvbklkOiBzdHJpbmcsIGJlZm9yZU1lc3NhZ2VJZD86IHN0cmluZywgc2tpcFJlYWN0aW9uSHlkcmF0aW9uID0gZmFsc2UpOiB2b2lkIHtcclxuICAgIGlmICghY29udmVyc2F0aW9uSWQgfHwgY29udmVyc2F0aW9uSWQgPT09ICd1bmRlZmluZWQnKSB7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIGNvbnN0IGNvbnRhY3RJZCA9IHRoaXMuYXV0aC5jb250YWN0SWQ7XHJcbiAgICBpZiAoIWNvbnRhY3RJZCkgcmV0dXJuO1xyXG5cclxuICAgIHRoaXMubG9hZGluZ01lc3NhZ2VzJC5uZXh0KHRydWUpO1xyXG5cclxuICAgIHRoaXMuYXBpLmdldE1lc3NhZ2VzKGNvbnZlcnNhdGlvbklkLCBjb250YWN0SWQsIGJlZm9yZU1lc3NhZ2VJZCwgNTApLnN1YnNjcmliZSh7XHJcbiAgICAgIG5leHQ6IChtZXNzYWdlcykgPT4ge1xyXG4gICAgICAgIGNvbnN0IG1hcCA9IG5ldyBNYXAodGhpcy5tZXNzYWdlc01hcCQudmFsdWUpO1xyXG4gICAgICAgIGNvbnN0IGV4aXN0aW5nID0gbWFwLmdldChjb252ZXJzYXRpb25JZCkgfHwgW107XHJcblxyXG4gICAgICAgIGNvbnN0IG5vcm1hbGl6ZWQgPSBtZXNzYWdlcy5tYXAoKG06IGFueSkgPT4gdGhpcy5ub3JtYWxpemVNZXNzYWdlU2hhcGUobSkpO1xyXG4gICAgICAgIGNvbnN0IHNvcnRlZCA9IFsuLi5ub3JtYWxpemVkXS5zb3J0KChhLCBiKSA9PiBcclxuICAgICAgICAgIG5ldyBEYXRlKGEuY3JlYXRlZF9hdCkuZ2V0VGltZSgpIC0gbmV3IERhdGUoYi5jcmVhdGVkX2F0KS5nZXRUaW1lKClcclxuICAgICAgICApO1xyXG4gICAgICAgIHNvcnRlZC5mb3JFYWNoKChtKSA9PiB0aGlzLmRldGVjdEdyb3VwUmVtb3ZhbEZvckN1cnJlbnRVc2VyKG0pKTtcclxuXHJcbiAgICAgICAgY29uc3QgZXhpc3RpbmdCeUlkID0gbmV3IE1hcChleGlzdGluZy5tYXAobSA9PiBbU3RyaW5nKG0ubWVzc2FnZV9pZCksIG1dKSk7XHJcblxyXG4gICAgICAgIGlmIChiZWZvcmVNZXNzYWdlSWQpIHtcclxuICAgICAgICAgIC8vIFByZXBlbmQgb2xkZXIgbWVzc2FnZXMsIHByZXNlcnZpbmcgZXhpc3RpbmcgcmVhY3Rpb25zXHJcbiAgICAgICAgICBjb25zdCBtZXJnZWQgPSBbLi4uc29ydGVkLCAuLi5leGlzdGluZ107XHJcbiAgICAgICAgICBtYXAuc2V0KGNvbnZlcnNhdGlvbklkLCBtZXJnZWQpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAvLyBSZXBsYWNlIHdpdGggc2VydmVyIGRhdGEgYnV0IGtlZXAgdGhlIHJpY2hlciBvZiBleGlzdGluZyB2cyBzZXJ2ZXIgYXR0YWNobWVudHNcclxuICAgICAgICAgIC8vICh0aGUgb3B0aW1pc3RpYyBwYXRoIG1heSBoYXZlIG1vcmUgYXR0YWNobWVudCBtZXRhZGF0YSB0aGFuIHRoZSBzZXJ2ZXIgZWNob2VzIGJhY2spLlxyXG4gICAgICAgICAgY29uc3QgbWVyZ2VkID0gc29ydGVkLm1hcChtID0+IHtcclxuICAgICAgICAgICAgY29uc3QgY2FjaGVkID0gZXhpc3RpbmdCeUlkLmdldChTdHJpbmcobS5tZXNzYWdlX2lkKSk7XHJcbiAgICAgICAgICAgIGlmICghY2FjaGVkKSByZXR1cm4gbTtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMubWVyZ2VNZXNzYWdlQXR0YWNobWVudHMoY2FjaGVkLCBtKTtcclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgbWFwLnNldChjb252ZXJzYXRpb25JZCwgbWVyZ2VkKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMubWVzc2FnZXNNYXAkLm5leHQobWFwKTtcclxuICAgICAgICB0aGlzLmh5ZHJhdGVSZWFjdGlvbnNGb3JDb252ZXJzYXRpb24oXHJcbiAgICAgICAgICBjb252ZXJzYXRpb25JZCxcclxuICAgICAgICAgIG1hcC5nZXQoY29udmVyc2F0aW9uSWQpIHx8IFtdLFxyXG4gICAgICAgICAgc2tpcFJlYWN0aW9uSHlkcmF0aW9uXHJcbiAgICAgICAgKTtcclxuICAgICAgICB0aGlzLmxvYWRpbmdNZXNzYWdlcyQubmV4dChmYWxzZSk7XHJcbiAgICAgIH0sXHJcbiAgICAgIGVycm9yOiAoKSA9PiB7XHJcbiAgICAgICAgdGhpcy5sb2FkaW5nTWVzc2FnZXMkLm5leHQoZmFsc2UpO1xyXG4gICAgICB9LFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBzZW5kTWVzc2FnZShcclxuICAgIGNvbnZlcnNhdGlvbklkOiBzdHJpbmcgfCBudWxsLFxyXG4gICAgY29udGVudDogc3RyaW5nLFxyXG4gICAgbWVzc2FnZVR5cGU6ICdURVhUJyB8ICdJTUFHRScgfCAnU1lTVEVNJyA9ICdURVhUJyxcclxuICAgIG9wdGlvbnM/OiB7IHJlcGx5VG8/OiBNZXNzYWdlIHwgbnVsbDsgbWVudGlvbnM/OiBzdHJpbmdbXTsgZm9yY2VQbGFpblRleHQ/OiBib29sZWFuIH1cclxuICApOiB2b2lkIHtcclxuICAgIGNvbnN0IGNvbnRhY3RJZCA9IHRoaXMuYXV0aC5jb250YWN0SWQ7XHJcbiAgICBpZiAoIWNvbnRhY3RJZCkgcmV0dXJuO1xyXG5cclxuICAgIGNvbnN0IHBlbmRpbmcgPSB0aGlzLnBlbmRpbmdEbVJlY2lwaWVudCQudmFsdWU7XHJcbiAgICBpZiAoIWNvbnZlcnNhdGlvbklkICYmIHBlbmRpbmcpIHtcclxuICAgICAgdGhpcy5zZW5kRGlyZWN0TWVzc2FnZShwZW5kaW5nLmNvbnRhY3RJZCwgY29udGVudCk7XHJcbiAgICAgIHRoaXMucGVuZGluZ0RtUmVjaXBpZW50JC5uZXh0KG51bGwpO1xyXG4gICAgICBjb25zdCBjaGF0cyA9IHRoaXMub3BlbkNoYXRzJC52YWx1ZS5maWx0ZXIoYyA9PiBjLmNvbnZlcnNhdGlvbklkICE9PSAncGVuZGluZycpO1xyXG4gICAgICB0aGlzLm9wZW5DaGF0cyQubmV4dChjaGF0cyk7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoIWNvbnZlcnNhdGlvbklkKSByZXR1cm47XHJcblxyXG4gICAgY29uc3Qgb3V0Z29pbmdDb250ZW50ID0gdGhpcy5wcmVwYXJlT3V0Z29pbmdNZXNzYWdlQ29udGVudChjb250ZW50LCBvcHRpb25zPy5yZXBseVRvIHx8IG51bGwsIG9wdGlvbnM/LmZvcmNlUGxhaW5UZXh0KTtcclxuICAgIGNvbnN0IHJlcGx5VG8gPSBvcHRpb25zPy5yZXBseVRvID8gdGhpcy5jcmVhdGVSZXBseVByZXZpZXcob3B0aW9ucy5yZXBseVRvKSA6IHVuZGVmaW5lZDtcclxuICAgIGNvbnN0IHRlbXBNZXNzYWdlSWQgPSAndGVtcC0nICsgRGF0ZS5ub3coKTtcclxuICAgIGNvbnN0IG9wdGltaXN0aWM6IE1lc3NhZ2UgPSB7XHJcbiAgICAgIG1lc3NhZ2VfaWQ6IHRlbXBNZXNzYWdlSWQsXHJcbiAgICAgIGNvbnZlcnNhdGlvbl9pZDogY29udmVyc2F0aW9uSWQsXHJcbiAgICAgIHNlbmRlcl9pZDogY29udGFjdElkLFxyXG4gICAgICBzZW5kZXJfbmFtZTogJ1lvdScsXHJcbiAgICAgIG1lc3NhZ2VfdHlwZTogbWVzc2FnZVR5cGUsXHJcbiAgICAgIGNvbnRlbnQsXHJcbiAgICAgIHJlcGx5X3RvOiByZXBseVRvLFxyXG4gICAgICBtZW50aW9uczogb3B0aW9ucz8ubWVudGlvbnMsXHJcbiAgICAgIHJlbmRlcl9hc19wbGFpbl90ZXh0OiBvcHRpb25zPy5mb3JjZVBsYWluVGV4dCxcclxuICAgICAgY3JlYXRlZF9hdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxyXG4gICAgICBpc19yZWFkOiBmYWxzZSxcclxuICAgIH07XHJcbiAgICB0aGlzLmFwcGVuZE1lc3NhZ2Uob3B0aW1pc3RpYyk7XHJcblxyXG4gICAgdGhpcy5hcGkuc2VuZE1lc3NhZ2UoY29udmVyc2F0aW9uSWQsIGNvbnRhY3RJZCwgb3V0Z29pbmdDb250ZW50LCBtZXNzYWdlVHlwZSkuc3Vic2NyaWJlKHtcclxuICAgICAgbmV4dDogKHJlcykgPT4ge1xyXG4gICAgICAgIGNvbnN0IHJlYWxJZCA9IHJlcz8ubWVzc2FnZV9pZCA/PyByZXM/LmlkID8/IHJlcz8ubWVzc2FnZUlkO1xyXG4gICAgICAgIGlmIChyZWFsSWQgPT0gbnVsbCB8fCBTdHJpbmcocmVhbElkKS5zdGFydHNXaXRoKCd0ZW1wLScpKSB7XHJcbiAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGNvbnN0IHBpY2tlZENvbnRlbnQgPSB0aGlzLmNvYWxlc2NlTWVzc2FnZVRleHQocmVzLCBvdXRnb2luZ0NvbnRlbnQgfHwgb3B0aW1pc3RpYy5jb250ZW50KTtcclxuICAgICAgICBjb25zdCBtZXJnZWQgPSB0aGlzLm5vcm1hbGl6ZU1lc3NhZ2VTaGFwZSh7XHJcbiAgICAgICAgICAuLi5vcHRpbWlzdGljLFxyXG4gICAgICAgICAgLi4ucmVzLFxyXG4gICAgICAgICAgbWVzc2FnZV9pZDogU3RyaW5nKHJlYWxJZCksXHJcbiAgICAgICAgICBjb252ZXJzYXRpb25faWQ6IGNvbnZlcnNhdGlvbklkLFxyXG4gICAgICAgICAgbWVzc2FnZV90eXBlOiBtZXNzYWdlVHlwZSA9PT0gJ1NZU1RFTScgPyAnU1lTVEVNJyA6IHJlcz8ubWVzc2FnZV90eXBlID8/IG9wdGltaXN0aWMubWVzc2FnZV90eXBlLFxyXG4gICAgICAgICAgY29udGVudDogcGlja2VkQ29udGVudCxcclxuICAgICAgICAgIHJlcGx5X3RvOiByZXBseVRvID8/IHJlcz8ucmVwbHlfdG8sXHJcbiAgICAgICAgICBtZW50aW9uczogb3B0aW9ucz8ubWVudGlvbnMgPz8gcmVzPy5tZW50aW9ucyxcclxuICAgICAgICAgIHJlbmRlcl9hc19wbGFpbl90ZXh0OiBvcHRpb25zPy5mb3JjZVBsYWluVGV4dCxcclxuICAgICAgICB9KTtcclxuICAgICAgICBjb25zdCBtYXAgPSBuZXcgTWFwKHRoaXMubWVzc2FnZXNNYXAkLnZhbHVlKTtcclxuICAgICAgICBjb25zdCBtc2dzID0gWy4uLihtYXAuZ2V0KGNvbnZlcnNhdGlvbklkKSB8fCBbXSldO1xyXG4gICAgICAgIGNvbnN0IGlkeCA9IG1zZ3MuZmluZEluZGV4KChtKSA9PiBtLm1lc3NhZ2VfaWQgPT09IHRlbXBNZXNzYWdlSWQpO1xyXG4gICAgICAgIGlmIChpZHggPj0gMCkge1xyXG4gICAgICAgICAgbXNnc1tpZHhdID0gbWVyZ2VkO1xyXG4gICAgICAgICAgbWFwLnNldChjb252ZXJzYXRpb25JZCwgdGhpcy5kZWR1cGVNZXNzYWdlc0J5SWRLZWVwRmlyc3QobXNncykpO1xyXG4gICAgICAgICAgdGhpcy5tZXNzYWdlc01hcCQubmV4dChtYXApO1xyXG4gICAgICAgICAgdGhpcy5yZWZyZXNoTWVzc2FnZVJlYWN0aW9ucyhtZXJnZWQubWVzc2FnZV9pZCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9LFxyXG4gICAgICBlcnJvcjogKCkgPT4ge30sXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIG9wZW5EaXJlY3RDb252ZXJzYXRpb24ocmVjaXBpZW50Q29udGFjdElkOiBzdHJpbmcsIGRpc3BsYXlOYW1lOiBzdHJpbmcpOiB2b2lkIHtcclxuICAgIGNvbnN0IGV4aXN0aW5nID0gdGhpcy5pbmJveCQudmFsdWUuZmluZChpdGVtID0+IFxyXG4gICAgICAhaXRlbS5pc19ncm91cCAmJiBpdGVtLm5hbWUgPT09IGRpc3BsYXlOYW1lXHJcbiAgICApO1xyXG4gICAgXHJcbiAgICBpZiAoZXhpc3RpbmcpIHtcclxuICAgICAgdGhpcy5wZW5kaW5nRG1SZWNpcGllbnQkLm5leHQobnVsbCk7XHJcbiAgICAgIHRoaXMub3BlbkNvbnZlcnNhdGlvbihleGlzdGluZy5jb252ZXJzYXRpb25faWQsIGRpc3BsYXlOYW1lLCBmYWxzZSk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICB0aGlzLnBlbmRpbmdEbVJlY2lwaWVudCQubmV4dCh7Y29udGFjdElkOiByZWNpcGllbnRDb250YWN0SWQsIG5hbWU6IGRpc3BsYXlOYW1lfSk7XHJcbiAgICAgIHRoaXMuYWN0aXZlQ29udmVyc2F0aW9uSWQkLm5leHQobnVsbCk7XHJcbiAgICAgIHRoaXMuYWN0aXZlVmlldyQubmV4dCgnY2hhdCcpO1xyXG4gICAgICB0aGlzLm9wZW5QYW5lbCgpO1xyXG4gICAgICBcclxuICAgICAgY29uc3QgY2hhdHMgPSB0aGlzLm9wZW5DaGF0cyQudmFsdWU7XHJcbiAgICAgIGlmICghY2hhdHMuZmluZChjID0+IGMuY29udmVyc2F0aW9uSWQgPT09ICdwZW5kaW5nJykpIHtcclxuICAgICAgICB0aGlzLm9wZW5DaGF0cyQubmV4dChbLi4uY2hhdHMsIHtcclxuICAgICAgICAgIGNvbnZlcnNhdGlvbklkOiAncGVuZGluZycsXHJcbiAgICAgICAgICBuYW1lOiBkaXNwbGF5TmFtZSxcclxuICAgICAgICAgIGlzR3JvdXA6IGZhbHNlLFxyXG4gICAgICAgICAgaXNNaW5pbWl6ZWQ6IGZhbHNlLFxyXG4gICAgICAgICAgdW5yZWFkQ291bnQ6IDBcclxuICAgICAgICB9XSk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcblxyXG4gIHNlbmREaXJlY3RNZXNzYWdlKHJlY2lwaWVudENvbnRhY3RJZDogc3RyaW5nLCBjb250ZW50OiBzdHJpbmcpOiB2b2lkIHtcclxuICAgIGNvbnN0IGNvbnRhY3RJZCA9IHRoaXMuYXV0aC5jb250YWN0SWQ7XHJcbiAgICBpZiAoIWNvbnRhY3RJZCkgcmV0dXJuO1xyXG5cclxuICAgIHRoaXMuYXBpLnNlbmREaXJlY3RNZXNzYWdlKGNvbnRhY3RJZCwgcmVjaXBpZW50Q29udGFjdElkLCBjb250ZW50KS5zdWJzY3JpYmUoe1xyXG4gICAgICBuZXh0OiAocmVzKSA9PiB7XHJcbiAgICAgICAgdGhpcy5sb2FkSW5ib3goKTtcclxuICAgICAgICAvLyBCYWNrZW5kIG1heSByZXR1cm4gY29udmVyc2F0aW9uX2lkLCBpZCwgb3IgY29udmVyc2F0aW9uSWRcclxuICAgICAgICBjb25zdCBjb252SWQgPSBTdHJpbmcocmVzPy5jb252ZXJzYXRpb25faWQgfHwgcmVzPy5pZCB8fCByZXM/LmNvbnZlcnNhdGlvbklkIHx8ICcnKTtcclxuICAgICAgICBpZiAoY29udklkKSB7XHJcbiAgICAgICAgICBjb25zdCByZWNpcGllbnQgPSB0aGlzLnZpc2libGVDb250YWN0cyQudmFsdWUuZmluZChcclxuICAgICAgICAgICAgKGMpID0+IGMuY29udGFjdF9pZCA9PT0gcmVjaXBpZW50Q29udGFjdElkXHJcbiAgICAgICAgICApO1xyXG4gICAgICAgICAgY29uc3QgbmFtZSA9IHJlY2lwaWVudCA/IGdldENvbnRhY3REaXNwbGF5TmFtZShyZWNpcGllbnQpIDogJ0RpcmVjdCBNZXNzYWdlJztcclxuICAgICAgICAgIHRoaXMub3BlbkNvbnZlcnNhdGlvbihjb252SWQsIG5hbWUsIGZhbHNlKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0sXHJcbiAgICAgIGVycm9yOiAoKSA9PiB7fSxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgY3JlYXRlR3JvdXBDb252ZXJzYXRpb24oXHJcbiAgICBwYXJ0aWNpcGFudElkczogc3RyaW5nW10sXHJcbiAgICBuYW1lOiBzdHJpbmcsXHJcbiAgICBjYWxsYmFja3M/OiB7IHN1Y2Nlc3M/OiAoKSA9PiB2b2lkOyBlcnJvcj86ICgpID0+IHZvaWQgfVxyXG4gICk6IHZvaWQge1xyXG4gICAgY29uc3QgY29udGFjdElkID0gdGhpcy5hdXRoLmNvbnRhY3RJZDtcclxuICAgIGlmICghY29udGFjdElkKSB7XHJcbiAgICAgIGNhbGxiYWNrcz8uZXJyb3I/LigpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgYWxsUGFydGljaXBhbnRzID0gcGFydGljaXBhbnRJZHMuaW5jbHVkZXMoY29udGFjdElkKVxyXG4gICAgICA/IHBhcnRpY2lwYW50SWRzXHJcbiAgICAgIDogW2NvbnRhY3RJZCwgLi4ucGFydGljaXBhbnRJZHNdO1xyXG5cclxuICAgIHRoaXMuYXBpLmNyZWF0ZUNvbnZlcnNhdGlvbihjb250YWN0SWQsIGFsbFBhcnRpY2lwYW50cywgbmFtZSkuc3Vic2NyaWJlKHtcclxuICAgICAgbmV4dDogKGNvbnYpID0+IHtcclxuICAgICAgICAvLyBCYWNrZW5kIG1heSByZXR1cm4gY29udmVyc2F0aW9uX2lkLCBpZCwgb3IgY29udmVyc2F0aW9uSWRcclxuICAgICAgICBjb25zdCBjb252SWQgPSBTdHJpbmcoXHJcbiAgICAgICAgICB0eXBlb2YgY29udiA9PT0gJ3N0cmluZycgfHwgdHlwZW9mIGNvbnYgPT09ICdudW1iZXInXHJcbiAgICAgICAgICAgID8gY29udlxyXG4gICAgICAgICAgICA6IChjb252IGFzIGFueSk/LmNvbnZlcnNhdGlvbl9pZCB8fCAoY29udiBhcyBhbnkpPy5pZCB8fCAoY29udiBhcyBhbnkpPy5jb252ZXJzYXRpb25JZCB8fCAnJ1xyXG4gICAgICAgICk7XHJcbiAgICAgICAgaWYgKCFjb252SWQpIHtcclxuICAgICAgICAgIHRoaXMubG9hZEluYm94KCk7XHJcbiAgICAgICAgICBjYWxsYmFja3M/LmVycm9yPy4oKTtcclxuICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5sb2FkSW5ib3goKTtcclxuICAgICAgICB0aGlzLmNsZWFyR3JvdXBTZXR0aW5ncygpO1xyXG4gICAgICAgIHRoaXMub3BlbkNvbnZlcnNhdGlvbihjb252SWQsIG5hbWUsIHRydWUpO1xyXG4gICAgICAgIGNhbGxiYWNrcz8uc3VjY2Vzcz8uKCk7XHJcbiAgICAgIH0sXHJcbiAgICAgIGVycm9yOiAoKSA9PiB7XHJcbiAgICAgICAgY2FsbGJhY2tzPy5lcnJvcj8uKCk7XHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIG9wZW5Hcm91cFNldHRpbmdzKGNvbnZlcnNhdGlvbklkOiBzdHJpbmcsIG5hbWU6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgdGhpcy5ncm91cFNldHRpbmdzJC5uZXh0KHsgY29udmVyc2F0aW9uSWQsIG5hbWUgfSk7XHJcbiAgICB0aGlzLnNldFZpZXcoJ2dyb3VwLW1hbmFnZXInKTtcclxuICB9XHJcblxyXG4gIGNsZWFyR3JvdXBTZXR0aW5ncygpOiB2b2lkIHtcclxuICAgIHRoaXMuZ3JvdXBTZXR0aW5ncyQubmV4dChudWxsKTtcclxuICB9XHJcblxyXG4gIG1hcmtBc1JlYWQoY29udmVyc2F0aW9uSWQ6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgaWYgKCFjb252ZXJzYXRpb25JZCB8fCBjb252ZXJzYXRpb25JZCA9PT0gJ3VuZGVmaW5lZCcpIHJldHVybjtcclxuICAgIGNvbnN0IGNvbnRhY3RJZCA9IHRoaXMuYXV0aC5jb250YWN0SWQ7XHJcbiAgICBpZiAoIWNvbnRhY3RJZCkgcmV0dXJuO1xyXG5cclxuICAgIHRoaXMuYXBpLm1hcmtDb252ZXJzYXRpb25SZWFkKGNvbnZlcnNhdGlvbklkLCBjb250YWN0SWQpLnN1YnNjcmliZSh7XHJcbiAgICAgIG5leHQ6ICgpID0+IHtcclxuICAgICAgICBjb25zdCBpdGVtcyA9IHRoaXMuaW5ib3gkLnZhbHVlLm1hcCgoaXRlbSkgPT5cclxuICAgICAgICAgIGl0ZW0uY29udmVyc2F0aW9uX2lkID09PSBjb252ZXJzYXRpb25JZCA/IHsgLi4uaXRlbSwgdW5yZWFkX2NvdW50OiAwLCBoYXNfbWVudGlvbjogZmFsc2UgfSA6IGl0ZW1cclxuICAgICAgICApO1xyXG4gICAgICAgIHRoaXMuaW5ib3gkLm5leHQoaXRlbXMpO1xyXG4gICAgICAgIHRoaXMucmVjYWxjVW5yZWFkKGl0ZW1zKTtcclxuICAgICAgICB0aGlzLnNldENvbnZlcnNhdGlvbk1lbnRpb24oY29udmVyc2F0aW9uSWQsIGZhbHNlKTtcclxuICAgICAgfSxcclxuICAgICAgZXJyb3I6ICgpID0+IHt9LFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvLyDilIDilIAgR3JvdXAgbWFuYWdlbWVudCDilIDilIBcclxuICBtYW5hZ2VHcm91cChcclxuICAgIGFjdGlvbjogJ2NyZWF0ZScgfCAnYWRkJyB8ICdyZW1vdmUnIHwgJ3JlbmFtZScsXHJcbiAgICBjb252ZXJzYXRpb25JZD86IHN0cmluZyxcclxuICAgIGdyb3VwTmFtZT86IHN0cmluZyxcclxuICAgIHBhcnRpY2lwYW50Q29udGFjdElkcz86IHN0cmluZ1tdLFxyXG4gICAgY2FsbGJhY2tzPzogeyBzdWNjZXNzPzogKCkgPT4gdm9pZDsgZXJyb3I/OiAoKSA9PiB2b2lkIH1cclxuICApOiB2b2lkIHtcclxuICAgIGNvbnN0IGNvbnRhY3RJZCA9IHRoaXMuYXV0aC5jb250YWN0SWQ7XHJcbiAgICBpZiAoIWNvbnRhY3RJZCkge1xyXG4gICAgICBjYWxsYmFja3M/LmVycm9yPy4oKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIGlmIChhY3Rpb24gPT09ICdyZW1vdmUnICYmIGNvbnZlcnNhdGlvbklkICYmIHBhcnRpY2lwYW50Q29udGFjdElkcz8ubGVuZ3RoKSB7XHJcbiAgICAgIGNvbnN0IGFjdG9yTmFtZSA9IHRoaXMuZ2V0Q29udGFjdE5hbWVCeUlkKGNvbnRhY3RJZCk7XHJcbiAgICAgIGNvbnN0IG5vdGljZUpvYnMgPSBwYXJ0aWNpcGFudENvbnRhY3RJZHMubWFwKChpZCkgPT5cclxuICAgICAgICB0aGlzLmFwaS5zZW5kTWVzc2FnZShcclxuICAgICAgICAgIGNvbnZlcnNhdGlvbklkLFxyXG4gICAgICAgICAgY29udGFjdElkLFxyXG4gICAgICAgICAgYCR7YWN0b3JOYW1lfSByZW1vdmVkICR7dGhpcy5nZXRDb250YWN0TmFtZUJ5SWQoaWQpfSBmcm9tIHRoZSBncm91cGAsXHJcbiAgICAgICAgICAnU1lTVEVNJ1xyXG4gICAgICAgICkucGlwZShjYXRjaEVycm9yKCgpID0+IG9mKG51bGwpKSlcclxuICAgICAgKTtcclxuICAgICAgY29uc3QgcmVtb3ZlSm9icyA9IHBhcnRpY2lwYW50Q29udGFjdElkcy5tYXAoKGlkKSA9PlxyXG4gICAgICAgIHRoaXMuYXBpLm1hbmFnZUdyb3VwKGlkLCBhY3Rpb24sIGNvbnZlcnNhdGlvbklkLCBncm91cE5hbWUpXHJcbiAgICAgICk7XHJcblxyXG4gICAgICBmb3JrSm9pbihub3RpY2VKb2JzKS5zdWJzY3JpYmUoe1xyXG4gICAgICAgIG5leHQ6ICgpID0+IHtcclxuICAgICAgICAgIGZvcmtKb2luKHJlbW92ZUpvYnMpLnN1YnNjcmliZSh7XHJcbiAgICAgICAgICAgIG5leHQ6ICgpID0+IHtcclxuICAgICAgICAgICAgICB0aGlzLmxvYWRJbmJveCgpO1xyXG4gICAgICAgICAgICAgIHRoaXMubm90aWZ5R3JvdXBNZW1iZXJzaGlwQ2hhbmdlZCgpO1xyXG4gICAgICAgICAgICAgIGNhbGxiYWNrcz8uc3VjY2Vzcz8uKCk7XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIGVycm9yOiAoKSA9PiB7XHJcbiAgICAgICAgICAgICAgY2FsbGJhY2tzPy5lcnJvcj8uKCk7XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGVycm9yOiAoKSA9PiB7XHJcbiAgICAgICAgICBjYWxsYmFja3M/LmVycm9yPy4oKTtcclxuICAgICAgICB9LFxyXG4gICAgICB9KTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuYXBpLm1hbmFnZUdyb3VwKGNvbnRhY3RJZCwgYWN0aW9uLCBjb252ZXJzYXRpb25JZCwgZ3JvdXBOYW1lLCBwYXJ0aWNpcGFudENvbnRhY3RJZHMpLnN1YnNjcmliZSh7XHJcbiAgICAgIG5leHQ6ICgpID0+IHtcclxuICAgICAgICB0aGlzLmxvYWRJbmJveCgpO1xyXG4gICAgICAgIGlmIChhY3Rpb24gPT09ICdhZGQnICYmIGNvbnZlcnNhdGlvbklkICYmIHBhcnRpY2lwYW50Q29udGFjdElkcz8ubGVuZ3RoKSB7XHJcbiAgICAgICAgICB0aGlzLm5vdGlmeUdyb3VwTWVtYmVyc2hpcENoYW5nZWQoKTtcclxuICAgICAgICAgIGNvbnN0IGFkZGVkTmFtZXMgPSBwYXJ0aWNpcGFudENvbnRhY3RJZHMubWFwKChpZCkgPT4gdGhpcy5nZXRDb250YWN0TmFtZUJ5SWQoaWQpKTtcclxuICAgICAgICAgIGNvbnN0IHRleHQgPSBgJHt0aGlzLmdldENvbnRhY3ROYW1lQnlJZChjb250YWN0SWQpfSBhZGRlZCAke2FkZGVkTmFtZXMuam9pbignLCAnKX0gdG8gdGhlIGdyb3VwYDtcclxuICAgICAgICAgIHRoaXMuc2VuZE1lc3NhZ2UoY29udmVyc2F0aW9uSWQsIHRleHQsICdTWVNURU0nKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgY2FsbGJhY2tzPy5zdWNjZXNzPy4oKTtcclxuICAgICAgfSxcclxuICAgICAgZXJyb3I6ICgpID0+IHtcclxuICAgICAgICBjYWxsYmFja3M/LmVycm9yPy4oKTtcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLy8g4pSA4pSAIERlbGV0ZSAvIENsZWFyIOKUgOKUgFxyXG4gIGRlbGV0ZUNvbnZlcnNhdGlvbihjb252ZXJzYXRpb25JZDogc3RyaW5nKTogdm9pZCB7XHJcbiAgICBjb25zdCBjb250YWN0SWQgPSB0aGlzLmF1dGguY29udGFjdElkO1xyXG4gICAgaWYgKCFjb250YWN0SWQpIHJldHVybjtcclxuXHJcbiAgICB0aGlzLmFwaS5kZWxldGVDb252ZXJzYXRpb24oY29udmVyc2F0aW9uSWQsIGNvbnRhY3RJZCkuc3Vic2NyaWJlKHtcclxuICAgICAgbmV4dDogKCkgPT4ge1xyXG4gICAgICAgIGNvbnN0IGl0ZW1zID0gdGhpcy5pbmJveCQudmFsdWUuZmlsdGVyKGkgPT4gaS5jb252ZXJzYXRpb25faWQgIT09IGNvbnZlcnNhdGlvbklkKTtcclxuICAgICAgICB0aGlzLmluYm94JC5uZXh0KGl0ZW1zKTtcclxuICAgICAgICB0aGlzLnJlY2FsY1VucmVhZChpdGVtcyk7XHJcbiAgICAgICAgY29uc3QgbWFwID0gbmV3IE1hcCh0aGlzLm1lc3NhZ2VzTWFwJC52YWx1ZSk7XHJcbiAgICAgICAgbWFwLmRlbGV0ZShjb252ZXJzYXRpb25JZCk7XHJcbiAgICAgICAgdGhpcy5tZXNzYWdlc01hcCQubmV4dChtYXApO1xyXG4gICAgICAgIGlmICh0aGlzLmFjdGl2ZUNvbnZlcnNhdGlvbklkJC52YWx1ZSA9PT0gY29udmVyc2F0aW9uSWQpIHtcclxuICAgICAgICAgIHRoaXMuYWN0aXZlQ29udmVyc2F0aW9uSWQkLm5leHQobnVsbCk7XHJcbiAgICAgICAgICB0aGlzLmFjdGl2ZVZpZXckLm5leHQoJ2luYm94Jyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMuY2xvc2VDaGF0KGNvbnZlcnNhdGlvbklkKTtcclxuICAgICAgfSxcclxuICAgICAgZXJyb3I6ICgpID0+IHt9LFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBjbGVhckNvbnZlcnNhdGlvbihjb252ZXJzYXRpb25JZDogc3RyaW5nKTogdm9pZCB7XHJcbiAgICBjb25zdCBjb250YWN0SWQgPSB0aGlzLmF1dGguY29udGFjdElkO1xyXG4gICAgaWYgKCFjb250YWN0SWQpIHJldHVybjtcclxuXHJcbiAgICB0aGlzLmFwaS5jbGVhckNvbnZlcnNhdGlvbihjb252ZXJzYXRpb25JZCwgY29udGFjdElkKS5zdWJzY3JpYmUoe1xyXG4gICAgICBuZXh0OiAoKSA9PiB7XHJcbiAgICAgICAgY29uc3QgbWFwID0gbmV3IE1hcCh0aGlzLm1lc3NhZ2VzTWFwJC52YWx1ZSk7XHJcbiAgICAgICAgbWFwLnNldChjb252ZXJzYXRpb25JZCwgW10pO1xyXG4gICAgICAgIHRoaXMubWVzc2FnZXNNYXAkLm5leHQobWFwKTtcclxuICAgICAgICBjb25zdCBpdGVtcyA9IHRoaXMuaW5ib3gkLnZhbHVlLm1hcChpID0+XHJcbiAgICAgICAgICBpLmNvbnZlcnNhdGlvbl9pZCA9PT0gY29udmVyc2F0aW9uSWRcclxuICAgICAgICAgICAgPyB7IC4uLmksIGxhc3RfbWVzc2FnZV9wcmV2aWV3OiAnJywgbGFzdF9tZXNzYWdlX2F0OiBpLmxhc3RfbWVzc2FnZV9hdCB9XHJcbiAgICAgICAgICAgIDogaVxyXG4gICAgICAgICk7XHJcbiAgICAgICAgdGhpcy5pbmJveCQubmV4dChpdGVtcyk7XHJcbiAgICAgIH0sXHJcbiAgICAgIGVycm9yOiAoKSA9PiB7fSxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgZGVsZXRlR3JvdXAoY29udmVyc2F0aW9uSWQ6IHN0cmluZywgY2FsbGJhY2tzPzogeyBzdWNjZXNzPzogKCkgPT4gdm9pZDsgZXJyb3I/OiAoKSA9PiB2b2lkIH0pOiB2b2lkIHtcclxuICAgIGNvbnN0IGNvbnRhY3RJZCA9IHRoaXMuYXV0aC5jb250YWN0SWQ7XHJcbiAgICBpZiAoIWNvbnRhY3RJZCB8fCB0aGlzLmRlbGV0aW5nQ29udmVyc2F0aW9uSWRzLmhhcyhjb252ZXJzYXRpb25JZCkpIHtcclxuICAgICAgY2FsbGJhY2tzPy5lcnJvcj8uKCk7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBwcmV2aW91c0luYm94ID0gdGhpcy5pbmJveCQudmFsdWU7XHJcbiAgICBjb25zdCBwcmV2aW91c01lc3NhZ2VzTWFwID0gbmV3IE1hcCh0aGlzLm1lc3NhZ2VzTWFwJC52YWx1ZSk7XHJcbiAgICBjb25zdCBwcmV2aW91c09wZW5DaGF0cyA9IHRoaXMub3BlbkNoYXRzJC52YWx1ZTtcclxuICAgIGNvbnN0IHByZXZpb3VzQWN0aXZlQ29udmVyc2F0aW9uSWQgPSB0aGlzLmFjdGl2ZUNvbnZlcnNhdGlvbklkJC52YWx1ZTtcclxuICAgIGNvbnN0IHByZXZpb3VzQWN0aXZlVmlldyA9IHRoaXMuYWN0aXZlVmlldyQudmFsdWU7XHJcbiAgICBjb25zdCBwcmV2aW91c0dyb3VwU2V0dGluZ3MgPSB0aGlzLmdyb3VwU2V0dGluZ3MkLnZhbHVlO1xyXG5cclxuICAgIHRoaXMuZGVsZXRpbmdDb252ZXJzYXRpb25JZHMuYWRkKGNvbnZlcnNhdGlvbklkKTtcclxuICAgIHRoaXMuc2hvd1RvYXN0KCdFeGl0aW5nIGdyb3VwLi4uJywgJ2luZm8nLCAxNTAwKTtcclxuICAgIHRoaXMucmVtb3ZlQ29udmVyc2F0aW9uRnJvbVVpKGNvbnZlcnNhdGlvbklkKTtcclxuXHJcbiAgICB0aGlzLmFwaS5kZWxldGVHcm91cChjb252ZXJzYXRpb25JZCwgY29udGFjdElkKS5zdWJzY3JpYmUoe1xyXG4gICAgICBuZXh0OiAoKSA9PiB7XHJcbiAgICAgICAgdGhpcy5kZWxldGluZ0NvbnZlcnNhdGlvbklkcy5kZWxldGUoY29udmVyc2F0aW9uSWQpO1xyXG4gICAgICAgIHRoaXMuc2hvd1RvYXN0KCdFeGl0ZWQgZ3JvdXAnLCAnc3VjY2VzcycpO1xyXG4gICAgICAgIGNhbGxiYWNrcz8uc3VjY2Vzcz8uKCk7XHJcbiAgICAgIH0sXHJcbiAgICAgIGVycm9yOiAoKSA9PiB7XHJcbiAgICAgICAgdGhpcy5kZWxldGluZ0NvbnZlcnNhdGlvbklkcy5kZWxldGUoY29udmVyc2F0aW9uSWQpO1xyXG4gICAgICAgIHRoaXMuaW5ib3gkLm5leHQocHJldmlvdXNJbmJveCk7XHJcbiAgICAgICAgdGhpcy5yZWNhbGNVbnJlYWQocHJldmlvdXNJbmJveCk7XHJcbiAgICAgICAgdGhpcy5tZXNzYWdlc01hcCQubmV4dChwcmV2aW91c01lc3NhZ2VzTWFwKTtcclxuICAgICAgICB0aGlzLm9wZW5DaGF0cyQubmV4dChwcmV2aW91c09wZW5DaGF0cyk7XHJcbiAgICAgICAgdGhpcy5ncm91cFNldHRpbmdzJC5uZXh0KHByZXZpb3VzR3JvdXBTZXR0aW5ncyk7XHJcbiAgICAgICAgdGhpcy5hY3RpdmVDb252ZXJzYXRpb25JZCQubmV4dChwcmV2aW91c0FjdGl2ZUNvbnZlcnNhdGlvbklkKTtcclxuICAgICAgICB0aGlzLmFjdGl2ZVZpZXckLm5leHQocHJldmlvdXNBY3RpdmVWaWV3KTtcclxuICAgICAgICB0aGlzLnNob3dUb2FzdCgnQ291bGQgbm90IGV4aXQgZ3JvdXAnLCAnZXJyb3InKTtcclxuICAgICAgICBjYWxsYmFja3M/LmVycm9yPy4oKTtcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSByZW1vdmVDb252ZXJzYXRpb25Gcm9tVWkoY29udmVyc2F0aW9uSWQ6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgY29uc3QgaXRlbXMgPSB0aGlzLmluYm94JC52YWx1ZS5maWx0ZXIoaSA9PiBTdHJpbmcoaS5jb252ZXJzYXRpb25faWQpICE9PSBTdHJpbmcoY29udmVyc2F0aW9uSWQpKTtcclxuICAgIHRoaXMuaW5ib3gkLm5leHQoaXRlbXMpO1xyXG4gICAgdGhpcy5yZWNhbGNVbnJlYWQoaXRlbXMpO1xyXG5cclxuICAgIGNvbnN0IG1hcCA9IG5ldyBNYXAodGhpcy5tZXNzYWdlc01hcCQudmFsdWUpO1xyXG4gICAgbWFwLmRlbGV0ZShjb252ZXJzYXRpb25JZCk7XHJcbiAgICB0aGlzLm1lc3NhZ2VzTWFwJC5uZXh0KG1hcCk7XHJcblxyXG4gICAgdGhpcy5vcGVuQ2hhdHMkLm5leHQodGhpcy5vcGVuQ2hhdHMkLnZhbHVlLmZpbHRlcihjID0+IFN0cmluZyhjLmNvbnZlcnNhdGlvbklkKSAhPT0gU3RyaW5nKGNvbnZlcnNhdGlvbklkKSkpO1xyXG4gICAgaWYgKFN0cmluZyh0aGlzLmFjdGl2ZUNvbnZlcnNhdGlvbklkJC52YWx1ZSkgPT09IFN0cmluZyhjb252ZXJzYXRpb25JZCkpIHtcclxuICAgICAgdGhpcy5hY3RpdmVDb252ZXJzYXRpb25JZCQubmV4dChudWxsKTtcclxuICAgICAgdGhpcy5hY3RpdmVWaWV3JC5uZXh0KCdpbmJveCcpO1xyXG4gICAgfVxyXG4gICAgY29uc3Qgc2V0dGluZ3MgPSB0aGlzLmdyb3VwU2V0dGluZ3MkLnZhbHVlO1xyXG4gICAgaWYgKHNldHRpbmdzPy5jb252ZXJzYXRpb25JZCA9PT0gY29udmVyc2F0aW9uSWQpIHtcclxuICAgICAgdGhpcy5jbGVhckdyb3VwU2V0dGluZ3MoKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8vIOKUgOKUgCBSZWFjdGlvbnMg4pSA4pSAXHJcbiAgYWRkUmVhY3Rpb24obWVzc2FnZUlkOiBzdHJpbmcsIGVtb2ppOiBzdHJpbmcpOiB2b2lkIHtcclxuICAgIGNvbnN0IGNvbnRhY3RJZCA9IHRoaXMuYXV0aC5jb250YWN0SWQ7XHJcbiAgICBpZiAoIWNvbnRhY3RJZCkgcmV0dXJuO1xyXG5cclxuICAgIC8vIEVuZm9yY2Ugb25lIHJlYWN0aW9uIHBlciB1c2VyIOKAlCByZW1vdmUgYW55IGV4aXN0aW5nIHJlYWN0aW9uIHdpdGggYSBkaWZmZXJlbnQgZW1vamlcclxuICAgIGZvciAoY29uc3QgbXNncyBvZiB0aGlzLm1lc3NhZ2VzTWFwJC52YWx1ZS52YWx1ZXMoKSkge1xyXG4gICAgICBjb25zdCBtc2cgPSBtc2dzLmZpbmQobSA9PiBTdHJpbmcobS5tZXNzYWdlX2lkKSA9PT0gU3RyaW5nKG1lc3NhZ2VJZCkpO1xyXG4gICAgICBpZiAobXNnPy5yZWFjdGlvbnMpIHtcclxuICAgICAgICBmb3IgKGNvbnN0IHIgb2YgbXNnLnJlYWN0aW9ucykge1xyXG4gICAgICAgICAgaWYgKHIuaGFzUmVhY3RlZCAmJiByLmVtb2ppICE9PSBlbW9qaSkge1xyXG4gICAgICAgICAgICB0aGlzLmFwcGx5UmVhY3Rpb25PcHRpbWlzdGljYWxseShtZXNzYWdlSWQsIHIuZW1vamksIGZhbHNlKTtcclxuICAgICAgICAgICAgdGhpcy5hcGkucmVtb3ZlUmVhY3Rpb24obWVzc2FnZUlkLCBjb250YWN0SWQsIHIuZW1vamkpLnN1YnNjcmliZSh7IGVycm9yOiAoKSA9PiB7fSB9KTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgICAgYnJlYWs7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gT3B0aW1pc3RpYyBVSSBzbyB1c2VyIHNlZXMgcmVhY3Rpb24gaW1tZWRpYXRlbHkuXHJcbiAgICB0aGlzLmFwcGx5UmVhY3Rpb25PcHRpbWlzdGljYWxseShtZXNzYWdlSWQsIGVtb2ppLCB0cnVlKTtcclxuXHJcbiAgICB0aGlzLmFwaS5hZGRSZWFjdGlvbihtZXNzYWdlSWQsIGNvbnRhY3RJZCwgZW1vamkpLnN1YnNjcmliZSh7XHJcbiAgICAgIG5leHQ6ICgpID0+IHtcclxuICAgICAgICB0aGlzLnJlZnJlc2hNZXNzYWdlUmVhY3Rpb25zKG1lc3NhZ2VJZCk7XHJcbiAgICAgIH0sXHJcbiAgICAgIGVycm9yOiAoKSA9PiB7XHJcbiAgICAgICAgLy8gUmV2ZXJ0IG9wdGltaXN0aWMgdXBkYXRlIHdoZW4gcmVxdWVzdCBmYWlscy5cclxuICAgICAgICB0aGlzLmFwcGx5UmVhY3Rpb25PcHRpbWlzdGljYWxseShtZXNzYWdlSWQsIGVtb2ppLCBmYWxzZSk7XHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHJlbW92ZVJlYWN0aW9uKG1lc3NhZ2VJZDogc3RyaW5nLCBlbW9qaTogc3RyaW5nKTogdm9pZCB7XHJcbiAgICBjb25zdCBjb250YWN0SWQgPSB0aGlzLmF1dGguY29udGFjdElkO1xyXG4gICAgaWYgKCFjb250YWN0SWQpIHJldHVybjtcclxuXHJcbiAgICAvLyBPcHRpbWlzdGljIFVJIHNvIHVzZXIgc2VlcyByZWFjdGlvbiByZW1vdmFsIGltbWVkaWF0ZWx5LlxyXG4gICAgdGhpcy5hcHBseVJlYWN0aW9uT3B0aW1pc3RpY2FsbHkobWVzc2FnZUlkLCBlbW9qaSwgZmFsc2UpO1xyXG5cclxuICAgIHRoaXMuYXBpLnJlbW92ZVJlYWN0aW9uKG1lc3NhZ2VJZCwgY29udGFjdElkLCBlbW9qaSkuc3Vic2NyaWJlKHtcclxuICAgICAgbmV4dDogKCkgPT4ge1xyXG4gICAgICAgIHRoaXMucmVmcmVzaE1lc3NhZ2VSZWFjdGlvbnMobWVzc2FnZUlkKTtcclxuICAgICAgfSxcclxuICAgICAgZXJyb3I6ICgpID0+IHtcclxuICAgICAgICAvLyBSZXZlcnQgb3B0aW1pc3RpYyB1cGRhdGUgd2hlbiByZXF1ZXN0IGZhaWxzLlxyXG4gICAgICAgIHRoaXMuYXBwbHlSZWFjdGlvbk9wdGltaXN0aWNhbGx5KG1lc3NhZ2VJZCwgZW1vamksIHRydWUpO1xyXG4gICAgICB9LFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBlZGl0TWVzc2FnZShtZXNzYWdlSWQ6IHN0cmluZywgY29udGVudDogc3RyaW5nKTogdm9pZCB7XHJcbiAgICBjb25zdCBjb250YWN0SWQgPSB0aGlzLmF1dGguY29udGFjdElkO1xyXG4gICAgY29uc3QgY29udmVyc2F0aW9uSWQgPSB0aGlzLmFjdGl2ZUNvbnZlcnNhdGlvbklkJC52YWx1ZTtcclxuICAgIGNvbnN0IG5leHRDb250ZW50ID0gY29udGVudC50cmltKCk7XHJcbiAgICBpZiAoIWNvbnRhY3RJZCB8fCAhY29udmVyc2F0aW9uSWQgfHwgIW1lc3NhZ2VJZCB8fCAhbmV4dENvbnRlbnQpIHJldHVybjtcclxuXHJcbiAgICB0aGlzLmFwaS5lZGl0TWVzc2FnZShtZXNzYWdlSWQsIGNvbnRhY3RJZCwgbmV4dENvbnRlbnQpLnN1YnNjcmliZSh7XHJcbiAgICAgIG5leHQ6IChyZXMpID0+IHtcclxuICAgICAgICBjb25zdCBzZXJ2ZXJNZXNzYWdlID0gcmVzPy5tZXNzYWdlID8gdGhpcy5ub3JtYWxpemVNZXNzYWdlU2hhcGUocmVzLm1lc3NhZ2UpIDogbnVsbDtcclxuICAgICAgICB0aGlzLnVwZGF0ZU1lc3NhZ2VJbkNvbnZlcnNhdGlvbihcclxuICAgICAgICAgIGNvbnZlcnNhdGlvbklkLFxyXG4gICAgICAgICAgbWVzc2FnZUlkLFxyXG4gICAgICAgICAgc2VydmVyTWVzc2FnZSB8fCB7XHJcbiAgICAgICAgICAgIGNvbnRlbnQ6IG5leHRDb250ZW50LFxyXG4gICAgICAgICAgICBlZGl0ZWRfYXQ6IHJlcz8uZWRpdGVkX2F0IHx8IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcclxuICAgICAgICAgIH1cclxuICAgICAgICApO1xyXG4gICAgICAgIHRoaXMubG9hZEluYm94KCk7XHJcbiAgICAgIH0sXHJcbiAgICAgIGVycm9yOiAoKSA9PiB7fSxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgZGVsZXRlTWVzc2FnZShtZXNzYWdlSWQ6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgY29uc3QgY29udGFjdElkID0gdGhpcy5hdXRoLmNvbnRhY3RJZDtcclxuICAgIGNvbnN0IGNvbnZlcnNhdGlvbklkID0gdGhpcy5hY3RpdmVDb252ZXJzYXRpb25JZCQudmFsdWU7XHJcbiAgICBpZiAoIWNvbnRhY3RJZCB8fCAhY29udmVyc2F0aW9uSWQgfHwgIW1lc3NhZ2VJZCkgcmV0dXJuO1xyXG5cclxuICAgIGlmIChTdHJpbmcobWVzc2FnZUlkKS5zdGFydHNXaXRoKCd0ZW1wLScpKSB7XHJcbiAgICAgIHRoaXMucmVtb3ZlTWVzc2FnZUZyb21Db252ZXJzYXRpb24oY29udmVyc2F0aW9uSWQsIG1lc3NhZ2VJZCk7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLmFwaS5kZWxldGVNZXNzYWdlKG1lc3NhZ2VJZCwgY29udGFjdElkKS5zdWJzY3JpYmUoe1xyXG4gICAgICBuZXh0OiAoKSA9PiB7XHJcbiAgICAgICAgdGhpcy51cGRhdGVNZXNzYWdlSW5Db252ZXJzYXRpb24oY29udmVyc2F0aW9uSWQsIG1lc3NhZ2VJZCwge1xyXG4gICAgICAgICAgY29udGVudDogJ1tkZWxldGVkXScsXHJcbiAgICAgICAgICBpc19kZWxldGVkOiB0cnVlLFxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIHRoaXMubG9hZEluYm94KCk7XHJcbiAgICAgIH0sXHJcbiAgICAgIGVycm9yOiAoKSA9PiB7fSxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgZ2V0QWN0aXZlQ29udmVyc2F0aW9uSWQoKTogc3RyaW5nIHwgbnVsbCB7XHJcbiAgICByZXR1cm4gdGhpcy5hY3RpdmVDb252ZXJzYXRpb25JZCQudmFsdWU7XHJcbiAgfVxyXG5cclxuICAvLyDilIDilIAgR2V0dGVycyDilIDilIBcclxuICBnZXRNZXNzYWdlc0ZvckNvbnZlcnNhdGlvbihjb252ZXJzYXRpb25JZDogc3RyaW5nKTogTWVzc2FnZVtdIHtcclxuICAgIHJldHVybiB0aGlzLm1lc3NhZ2VzTWFwJC52YWx1ZS5nZXQoY29udmVyc2F0aW9uSWQpIHx8IFtdO1xyXG4gIH1cclxuXHJcbiAgZ2V0Q3VycmVudEluYm94KCk6IEluYm94SXRlbVtdIHtcclxuICAgIHJldHVybiB0aGlzLmluYm94JC52YWx1ZTtcclxuICB9XHJcblxyXG4gIC8vIOKUgOKUgCBQcml2YXRlIGhlbHBlcnMg4pSA4pSAXHJcbiAgLyoqXHJcbiAgICogUHJlZmVyIGB7IHR5cGUsIGRhdGEgfWA7IHN1cHBvcnQgZmxhdCBgeyB0eXBlLCAuLi5maWVsZHMgfWAgZW52ZWxvcGVzIGZyb20gb2xkZXIgYmFja2VuZHMuXHJcbiAgICovXHJcbiAgcHJpdmF0ZSB3c0V2ZW50UGF5bG9hZChtc2c6IFdlYlNvY2tldE1lc3NhZ2UpOiBhbnkge1xyXG4gICAgaWYgKG1zZy5kYXRhICE9PSB1bmRlZmluZWQgJiYgbXNnLmRhdGEgIT09IG51bGwpIHtcclxuICAgICAgcmV0dXJuIG1zZy5kYXRhO1xyXG4gICAgfVxyXG4gICAgY29uc3QgcmF3ID0gbXNnIGFzIHVua25vd24gYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj47XHJcbiAgICBjb25zdCB7IHR5cGU6IF90LCBkYXRhOiBfZCwgdGltZXN0YW1wOiBfdHMsIG1lc3NhZ2U6IF9tc2csIC4uLnJlc3QgfSA9IHJhdztcclxuICAgIHJldHVybiBPYmplY3Qua2V5cyhyZXN0KS5sZW5ndGggPyByZXN0IDogbnVsbDtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgbGlzdGVuV2ViU29ja2V0KCk6IHZvaWQge1xyXG4gICAgdGhpcy53c1N1Yj8udW5zdWJzY3JpYmUoKTtcclxuICAgIHRoaXMud3NTdWIgPSB0aGlzLndzU2VydmljZS5vbk1lc3NhZ2UkLnN1YnNjcmliZSgobXNnKSA9PiB0aGlzLmhhbmRsZVdzTWVzc2FnZShtc2cpKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgaGFuZGxlV3NNZXNzYWdlKG1zZzogV2ViU29ja2V0TWVzc2FnZSk6IHZvaWQge1xyXG4gICAgc3dpdGNoIChtc2cudHlwZSkge1xyXG4gICAgICBjYXNlICduZXdfbWVzc2FnZSc6XHJcbiAgICAgICAgdGhpcy5oYW5kbGVOZXdNZXNzYWdlKHRoaXMud3NFdmVudFBheWxvYWQobXNnKSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgIGNhc2UgJ2NvbnZlcnNhdGlvbl91cGRhdGVkJzpcclxuICAgICAgICB0aGlzLmhhbmRsZUNvbnZlcnNhdGlvblVwZGF0ZWQodGhpcy53c0V2ZW50UGF5bG9hZChtc2cpKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgY2FzZSAnZ3JvdXBfdXBkYXRlZCc6XHJcbiAgICAgICAgdGhpcy5oYW5kbGVHcm91cFVwZGF0ZWQodGhpcy53c0V2ZW50UGF5bG9hZChtc2cpKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgY2FzZSAnZXJyb3InOlxyXG4gICAgICAgIHRoaXMuaGFuZGxlV2ViU29ja2V0RXJyb3IobXNnLm1lc3NhZ2UpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBoYW5kbGVDb252ZXJzYXRpb25VcGRhdGVkKGRhdGE6IGFueSk6IHZvaWQge1xyXG4gICAgdGhpcy5sb2FkSW5ib3goKTtcclxuICAgIGNvbnN0IGFjdGl2ZUlkID0gdGhpcy5hY3RpdmVDb252ZXJzYXRpb25JZCQudmFsdWU7XHJcbiAgICBjb25zdCBldmVudENvbnZlcnNhdGlvbklkID0gZGF0YT8uY29udmVyc2F0aW9uX2lkID8/IGRhdGE/LmNvbnZlcnNhdGlvbklkO1xyXG4gICAgaWYgKGFjdGl2ZUlkICYmICghZXZlbnRDb252ZXJzYXRpb25JZCB8fCBTdHJpbmcoZXZlbnRDb252ZXJzYXRpb25JZCkgPT09IFN0cmluZyhhY3RpdmVJZCkpKSB7XHJcbiAgICAgIHRoaXMubG9hZE1lc3NhZ2VzKGFjdGl2ZUlkLCB1bmRlZmluZWQsIHRydWUpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBoYW5kbGVHcm91cFVwZGF0ZWQoZGF0YTogYW55KTogdm9pZCB7XHJcbiAgICB0aGlzLmhhbmRsZUNvbnZlcnNhdGlvblVwZGF0ZWQoZGF0YSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGhhbmRsZVdlYlNvY2tldEVycm9yKGVycm9yTWVzc2FnZTogc3RyaW5nIHwgdW5kZWZpbmVkKTogdm9pZCB7XHJcbiAgICB2b2lkIGVycm9yTWVzc2FnZTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgaGFuZGxlTmV3TWVzc2FnZShkYXRhOiBhbnkpOiB2b2lkIHtcclxuICAgIGlmICghZGF0YSkgcmV0dXJuO1xyXG5cclxuICAgIGxldCBtZXNzYWdlOiBNZXNzYWdlID0gdGhpcy5ub3JtYWxpemVNZXNzYWdlU2hhcGUoZGF0YSk7XHJcbiAgICB0aGlzLmRldGVjdEdyb3VwUmVtb3ZhbEZvckN1cnJlbnRVc2VyKG1lc3NhZ2UpO1xyXG4gICAgY29uc3QgbXlDb250YWN0SWQgPSBTdHJpbmcodGhpcy5hdXRoLmNvbnRhY3RJZCA/PyAnJyk7XHJcbiAgICBjb25zdCBjb252SWQgPSBTdHJpbmcobWVzc2FnZS5jb252ZXJzYXRpb25faWQgPz8gJycpO1xyXG4gICAgY29uc3QgZXhpc3RpbmcgPSB0aGlzLm1lc3NhZ2VzTWFwJC52YWx1ZS5nZXQoY29udklkKSB8fCBbXTtcclxuXHJcbiAgICBjb25zdCBvd25FY2hvID1cclxuICAgICAgbXlDb250YWN0SWQgJiZcclxuICAgICAgU3RyaW5nKG1lc3NhZ2Uuc2VuZGVyX2lkKSA9PT0gbXlDb250YWN0SWQgJiZcclxuICAgICAgISFtZXNzYWdlLm1lc3NhZ2VfaWQgJiZcclxuICAgICAgIVN0cmluZyhtZXNzYWdlLm1lc3NhZ2VfaWQpLnN0YXJ0c1dpdGgoJ3RlbXAtJyk7XHJcblxyXG4gICAgLy8gV1Mgb2Z0ZW4gYXJyaXZlcyBiZWZvcmUgSFRUUCBmaW5pc2hlcyByZXBsYWNpbmcgdGVtcC07IG1lcmdlIGludG8gdGVtcCBpbnN0ZWFkIG9mIGFwcGVuZGluZyBhIGR1cGxpY2F0ZSByb3cuXHJcbiAgICBpZiAob3duRWNobykge1xyXG4gICAgICBjb25zdCB0ZW1wSWR4ID0gZXhpc3RpbmcuZmluZEluZGV4KChtKSA9PiB7XHJcbiAgICAgICAgaWYgKCFTdHJpbmcobS5tZXNzYWdlX2lkKS5zdGFydHNXaXRoKCd0ZW1wLScpKSByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgaWYgKFN0cmluZyhtLmNvbnZlcnNhdGlvbl9pZCkgIT09IGNvbnZJZCkgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIGlmIChTdHJpbmcobS5zZW5kZXJfaWQpICE9PSBteUNvbnRhY3RJZCkgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIGNvbnN0IGR0ID0gTWF0aC5hYnMoXHJcbiAgICAgICAgICBuZXcgRGF0ZShtLmNyZWF0ZWRfYXQpLmdldFRpbWUoKSAtIG5ldyBEYXRlKG1lc3NhZ2UuY3JlYXRlZF9hdCkuZ2V0VGltZSgpXHJcbiAgICAgICAgKTtcclxuICAgICAgICBpZiAoZHQgPj0gMTIwXzAwMCkgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIGNvbnN0IGEgPSBTdHJpbmcobS5jb250ZW50ID8/ICcnKS50cmltKCk7XHJcbiAgICAgICAgY29uc3QgYiA9IFN0cmluZyhtZXNzYWdlLmNvbnRlbnQgPz8gJycpLnRyaW0oKTtcclxuICAgICAgICByZXR1cm4gYSA9PT0gYiB8fCAhYjtcclxuICAgICAgfSk7XHJcbiAgICAgIGlmICh0ZW1wSWR4ID49IDApIHtcclxuICAgICAgICBjb25zdCBtZXJnZWQ6IE1lc3NhZ2UgPSB0aGlzLm1lcmdlTWVzc2FnZUF0dGFjaG1lbnRzKGV4aXN0aW5nW3RlbXBJZHhdLCB0aGlzLm5vcm1hbGl6ZU1lc3NhZ2VTaGFwZSh7XHJcbiAgICAgICAgICAuLi5leGlzdGluZ1t0ZW1wSWR4XSxcclxuICAgICAgICAgIC4uLmRhdGEsXHJcbiAgICAgICAgICBtZXNzYWdlX2lkOiBtZXNzYWdlLm1lc3NhZ2VfaWQsXHJcbiAgICAgICAgICBjb252ZXJzYXRpb25faWQ6IGNvbnZJZCxcclxuICAgICAgICAgIGNvbnRlbnQ6IHRoaXMuY29hbGVzY2VNZXNzYWdlVGV4dChkYXRhLCBleGlzdGluZ1t0ZW1wSWR4XS5jb250ZW50KSxcclxuICAgICAgICB9KSk7XHJcbiAgICAgICAgY29uc3QgbWFwID0gbmV3IE1hcCh0aGlzLm1lc3NhZ2VzTWFwJC52YWx1ZSk7XHJcbiAgICAgICAgY29uc3QgbXNncyA9IHRoaXMuZGVkdXBlTWVzc2FnZXNCeUlkS2VlcEZpcnN0KFsuLi5leGlzdGluZ10pO1xyXG4gICAgICAgIG1zZ3NbdGVtcElkeF0gPSBtZXJnZWQ7XHJcbiAgICAgICAgbWFwLnNldChjb252SWQsIHRoaXMuZGVkdXBlTWVzc2FnZXNCeUlkS2VlcEZpcnN0KG1zZ3MpKTtcclxuICAgICAgICB0aGlzLm1lc3NhZ2VzTWFwJC5uZXh0KG1hcCk7XHJcbiAgICAgICAgdGhpcy5yZWZyZXNoTWVzc2FnZVJlYWN0aW9ucyhtZXJnZWQubWVzc2FnZV9pZCk7XHJcbiAgICAgICAgbWVzc2FnZSA9IG1lcmdlZDtcclxuICAgICAgICB0aGlzLnVwZGF0ZUluYm94UHJldmlldyhtZXNzYWdlKTtcclxuICAgICAgICBpZiAodGhpcy5hY3RpdmVDb252ZXJzYXRpb25JZCQudmFsdWUgPT09IG1lc3NhZ2UuY29udmVyc2F0aW9uX2lkKSB7XHJcbiAgICAgICAgICB0aGlzLm1hcmtBc1JlYWQobWVzc2FnZS5jb252ZXJzYXRpb25faWQpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm47XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBpc0Zyb21PdGhlciA9IFN0cmluZyhtZXNzYWdlLnNlbmRlcl9pZCkgIT09IG15Q29udGFjdElkO1xyXG4gICAgY29uc3QgbWVudGlvbnNNZSA9IGlzRnJvbU90aGVyICYmIHRoaXMubWVzc2FnZU1lbnRpb25zQ3VycmVudFVzZXIobWVzc2FnZSk7XHJcblxyXG4gICAgY29uc3QgZHVwbGljYXRlSWR4ID0gZXhpc3RpbmcuZmluZEluZGV4KFxyXG4gICAgICAobSkgPT5cclxuICAgICAgICBTdHJpbmcobS5tZXNzYWdlX2lkKSA9PT0gU3RyaW5nKG1lc3NhZ2UubWVzc2FnZV9pZCkgfHxcclxuICAgICAgICAoU3RyaW5nKG0uc2VuZGVyX2lkKSA9PT0gU3RyaW5nKG1lc3NhZ2Uuc2VuZGVyX2lkKSAmJlxyXG4gICAgICAgICAgU3RyaW5nKG0uY29udGVudCA/PyAnJykgPT09IFN0cmluZyhtZXNzYWdlLmNvbnRlbnQgPz8gJycpICYmXHJcbiAgICAgICAgICBNYXRoLmFicyhuZXcgRGF0ZShtLmNyZWF0ZWRfYXQpLmdldFRpbWUoKSAtIG5ldyBEYXRlKG1lc3NhZ2UuY3JlYXRlZF9hdCkuZ2V0VGltZSgpKSA8IDIwMDApXHJcbiAgICApO1xyXG4gICAgY29uc3QgaXNEdXBsaWNhdGUgPSBkdXBsaWNhdGVJZHggPj0gMDtcclxuXHJcbiAgICBpZiAoIWlzRHVwbGljYXRlKSB7XHJcbiAgICAgIHRoaXMuYXBwZW5kTWVzc2FnZShtZXNzYWdlKTtcclxuXHJcbiAgICAgIGlmIChpc0Zyb21PdGhlcikge1xyXG4gICAgICAgIHRoaXMucGxheVNvZnROb3RpZmljYXRpb25Tb3VuZCgpO1xyXG4gICAgICB9XHJcbiAgICAgIHRoaXMudXBkYXRlSW5ib3hQcmV2aWV3KG1lc3NhZ2UpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgY29uc3QgbWFwID0gbmV3IE1hcCh0aGlzLm1lc3NhZ2VzTWFwJC52YWx1ZSk7XHJcbiAgICAgIGNvbnN0IG1zZ3MgPSBbLi4uZXhpc3RpbmddO1xyXG4gICAgICBtc2dzW2R1cGxpY2F0ZUlkeF0gPSB0aGlzLm1lcmdlTWVzc2FnZUF0dGFjaG1lbnRzKGV4aXN0aW5nW2R1cGxpY2F0ZUlkeF0sIG1lc3NhZ2UpO1xyXG4gICAgICBtYXAuc2V0KGNvbnZJZCwgbXNncyk7XHJcbiAgICAgIHRoaXMubWVzc2FnZXNNYXAkLm5leHQobWFwKTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAodGhpcy5hY3RpdmVDb252ZXJzYXRpb25JZCQudmFsdWUgIT09IG1lc3NhZ2UuY29udmVyc2F0aW9uX2lkKSB7XHJcbiAgICAgIGlmIChpc0Zyb21PdGhlciAmJiAhaXNEdXBsaWNhdGUpIHtcclxuICAgICAgICB0aGlzLmluY3JlbWVudFVucmVhZChtZXNzYWdlLmNvbnZlcnNhdGlvbl9pZCk7XHJcbiAgICAgICAgaWYgKG1lbnRpb25zTWUpIHtcclxuICAgICAgICAgIHRoaXMuc2V0Q29udmVyc2F0aW9uTWVudGlvbihtZXNzYWdlLmNvbnZlcnNhdGlvbl9pZCwgdHJ1ZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICB0aGlzLm1hcmtBc1JlYWQobWVzc2FnZS5jb252ZXJzYXRpb25faWQpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqIFB1YmxpYyDigJQgbGV0cyBjb21wb25lbnRzIGFkZCBhbiBvcHRpbWlzdGljIG1lc3NhZ2Ugd2l0aG91dCBhIHJvdW5kLXRyaXAuICovXHJcbiAgYXBwZW5kT3B0aW1pc3RpY01lc3NhZ2UobWVzc2FnZTogTWVzc2FnZSk6IHZvaWQge1xyXG4gICAgdGhpcy5hcHBlbmRNZXNzYWdlKG1lc3NhZ2UpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBhcHBlbmRNZXNzYWdlKG1lc3NhZ2U6IE1lc3NhZ2UpOiB2b2lkIHtcclxuICAgIGNvbnN0IG1hcCA9IG5ldyBNYXAodGhpcy5tZXNzYWdlc01hcCQudmFsdWUpO1xyXG4gICAgY29uc3QgY3VycmVudCA9IG1hcC5nZXQobWVzc2FnZS5jb252ZXJzYXRpb25faWQpIHx8IFtdO1xyXG4gICAgY29uc3Qgc2FtZUlkSWR4ID0gY3VycmVudC5maW5kSW5kZXgoKG0pID0+IFN0cmluZyhtLm1lc3NhZ2VfaWQpID09PSBTdHJpbmcobWVzc2FnZS5tZXNzYWdlX2lkKSk7XHJcbiAgICBpZiAoc2FtZUlkSWR4ID49IDApIHtcclxuICAgICAgY29uc3QgbXNncyA9IFsuLi5jdXJyZW50XTtcclxuICAgICAgbXNnc1tzYW1lSWRJZHhdID0gdGhpcy5tZXJnZU1lc3NhZ2VBdHRhY2htZW50cyhjdXJyZW50W3NhbWVJZElkeF0sIG1lc3NhZ2UpO1xyXG4gICAgICBtYXAuc2V0KG1lc3NhZ2UuY29udmVyc2F0aW9uX2lkLCBtc2dzKTtcclxuICAgICAgdGhpcy5tZXNzYWdlc01hcCQubmV4dChtYXApO1xyXG4gICAgICB0aGlzLnJlZnJlc2hNZXNzYWdlUmVhY3Rpb25zKG1lc3NhZ2UubWVzc2FnZV9pZCk7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBtc2dzID0gWy4uLmN1cnJlbnQsIG1lc3NhZ2VdO1xyXG4gICAgbWFwLnNldChtZXNzYWdlLmNvbnZlcnNhdGlvbl9pZCwgbXNncyk7XHJcbiAgICB0aGlzLm1lc3NhZ2VzTWFwJC5uZXh0KG1hcCk7XHJcbiAgICB0aGlzLnJlZnJlc2hNZXNzYWdlUmVhY3Rpb25zKG1lc3NhZ2UubWVzc2FnZV9pZCk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHVwZGF0ZU1lc3NhZ2VJbkNvbnZlcnNhdGlvbihcclxuICAgIGNvbnZlcnNhdGlvbklkOiBzdHJpbmcsXHJcbiAgICBtZXNzYWdlSWQ6IHN0cmluZyxcclxuICAgIHBhdGNoOiBQYXJ0aWFsPE1lc3NhZ2U+XHJcbiAgKTogdm9pZCB7XHJcbiAgICBjb25zdCBtYXAgPSBuZXcgTWFwKHRoaXMubWVzc2FnZXNNYXAkLnZhbHVlKTtcclxuICAgIGNvbnN0IGN1cnJlbnQgPSBtYXAuZ2V0KGNvbnZlcnNhdGlvbklkKSB8fCBbXTtcclxuICAgIGNvbnN0IG5leHQgPSBjdXJyZW50Lm1hcCgobWVzc2FnZSkgPT5cclxuICAgICAgU3RyaW5nKG1lc3NhZ2UubWVzc2FnZV9pZCkgPT09IFN0cmluZyhtZXNzYWdlSWQpXHJcbiAgICAgICAgPyB0aGlzLm5vcm1hbGl6ZU1lc3NhZ2VTaGFwZSh7IC4uLm1lc3NhZ2UsIC4uLnBhdGNoIH0pXHJcbiAgICAgICAgOiBtZXNzYWdlXHJcbiAgICApO1xyXG4gICAgbWFwLnNldChjb252ZXJzYXRpb25JZCwgbmV4dCk7XHJcbiAgICB0aGlzLm1lc3NhZ2VzTWFwJC5uZXh0KG1hcCk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHJlbW92ZU1lc3NhZ2VGcm9tQ29udmVyc2F0aW9uKGNvbnZlcnNhdGlvbklkOiBzdHJpbmcsIG1lc3NhZ2VJZDogc3RyaW5nKTogdm9pZCB7XHJcbiAgICBjb25zdCBtYXAgPSBuZXcgTWFwKHRoaXMubWVzc2FnZXNNYXAkLnZhbHVlKTtcclxuICAgIGNvbnN0IGN1cnJlbnQgPSBtYXAuZ2V0KGNvbnZlcnNhdGlvbklkKSB8fCBbXTtcclxuICAgIG1hcC5zZXQoXHJcbiAgICAgIGNvbnZlcnNhdGlvbklkLFxyXG4gICAgICBjdXJyZW50LmZpbHRlcigobWVzc2FnZSkgPT4gU3RyaW5nKG1lc3NhZ2UubWVzc2FnZV9pZCkgIT09IFN0cmluZyhtZXNzYWdlSWQpKVxyXG4gICAgKTtcclxuICAgIHRoaXMubWVzc2FnZXNNYXAkLm5leHQobWFwKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgbWVyZ2VNZXNzYWdlQXR0YWNobWVudHMoZXhpc3Rpbmc6IE1lc3NhZ2UsIGluY29taW5nOiBNZXNzYWdlKTogTWVzc2FnZSB7XHJcbiAgICBjb25zdCBleGlzdGluZ0F0dGFjaG1lbnRzID0gdGhpcy5ub3JtYWxpemVBdHRhY2htZW50TGlzdChleGlzdGluZy5hdHRhY2htZW50cyB8fCBbXSk7XHJcbiAgICBjb25zdCBpbmNvbWluZ0F0dGFjaG1lbnRzID0gdGhpcy5ub3JtYWxpemVBdHRhY2htZW50TGlzdChpbmNvbWluZy5hdHRhY2htZW50cyB8fCBbXSk7XHJcbiAgICBjb25zdCBhdHRhY2htZW50cyA9XHJcbiAgICAgIGluY29taW5nQXR0YWNobWVudHMubGVuZ3RoID49IGV4aXN0aW5nQXR0YWNobWVudHMubGVuZ3RoID8gaW5jb21pbmdBdHRhY2htZW50cyA6IGV4aXN0aW5nQXR0YWNobWVudHM7XHJcblxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgLi4uZXhpc3RpbmcsXHJcbiAgICAgIC4uLmluY29taW5nLFxyXG4gICAgICByZWFjdGlvbnM6IGluY29taW5nLnJlYWN0aW9ucyB8fCBleGlzdGluZy5yZWFjdGlvbnMsXHJcbiAgICAgIGF0dGFjaG1lbnRzOiBhdHRhY2htZW50cy5sZW5ndGggPiAwID8gYXR0YWNobWVudHMgOiBpbmNvbWluZy5hdHRhY2htZW50cyB8fCBleGlzdGluZy5hdHRhY2htZW50cyxcclxuICAgIH07XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIG5vcm1hbGl6ZUF0dGFjaG1lbnRMaXN0KGF0dGFjaG1lbnRzOiBBdHRhY2htZW50W10pOiBBdHRhY2htZW50W10ge1xyXG4gICAgY29uc3QgYnlJZCA9IG5ldyBNYXA8c3RyaW5nLCBBdHRhY2htZW50PigpO1xyXG4gICAgZm9yIChjb25zdCBhdHRhY2htZW50IG9mIGF0dGFjaG1lbnRzKSB7XHJcbiAgICAgIGNvbnN0IGZpbGVJZCA9IFN0cmluZyhhdHRhY2htZW50Py5maWxlX2lkIHx8ICcnKS50cmltKCk7XHJcbiAgICAgIGlmICghZmlsZUlkIHx8IGZpbGVJZC5zdGFydHNXaXRoKCd0ZW1wLScpKSBjb250aW51ZTtcclxuICAgICAgYnlJZC5zZXQoZmlsZUlkLCB7XHJcbiAgICAgICAgLi4uYXR0YWNobWVudCxcclxuICAgICAgICBmaWxlX2lkOiBmaWxlSWQsXHJcbiAgICAgICAgZmlsZW5hbWU6IGF0dGFjaG1lbnQuZmlsZW5hbWUgfHwgJ0ZpbGUnLFxyXG4gICAgICB9KTtcclxuICAgIH1cclxuICAgIHJldHVybiBBcnJheS5mcm9tKGJ5SWQudmFsdWVzKCkpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSB1cGRhdGVJbmJveFByZXZpZXcobWVzc2FnZTogTWVzc2FnZSk6IHZvaWQge1xyXG4gICAgY29uc3QgdGV4dCA9IFN0cmluZyhtZXNzYWdlLmNvbnRlbnQgPz8gJycpLnRyaW0oKTtcclxuICAgIGNvbnN0IG1lZGlhID0gdGhpcy5tZXNzYWdlTG9va3NMaWtlTWVkaWEobWVzc2FnZSk7XHJcbiAgICBpZiAoIXRleHQgJiYgIW1lZGlhKSB7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIGNvbnN0IHByZXZpZXcgPSB0ZXh0IHx8ICdbSW1hZ2VdJztcclxuICAgIGNvbnN0IGl0ZW1zID0gdGhpcy5pbmJveCQudmFsdWUubWFwKChpdGVtKSA9PiB7XHJcbiAgICAgIGlmIChpdGVtLmNvbnZlcnNhdGlvbl9pZCA9PT0gbWVzc2FnZS5jb252ZXJzYXRpb25faWQpIHtcclxuICAgICAgICBjb25zdCBtZW50aW9uZWQgPSBpdGVtLmhhc19tZW50aW9uIHx8IHRoaXMubWVudGlvbkNvbnZlcnNhdGlvbklkcyQudmFsdWUuaGFzKFN0cmluZyhpdGVtLmNvbnZlcnNhdGlvbl9pZCkpO1xyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAuLi5pdGVtLFxyXG4gICAgICAgICAgbGFzdF9tZXNzYWdlX3ByZXZpZXc6IHByZXZpZXcsXHJcbiAgICAgICAgICBsYXN0X21lc3NhZ2VfYXQ6IG1lc3NhZ2UuY3JlYXRlZF9hdCxcclxuICAgICAgICAgIGhhc19tZW50aW9uOiBtZW50aW9uZWQsXHJcbiAgICAgICAgfTtcclxuICAgICAgfVxyXG4gICAgICByZXR1cm4gaXRlbTtcclxuICAgIH0pO1xyXG5cclxuICAgIGl0ZW1zLnNvcnQoKGEsIGIpID0+IG5ldyBEYXRlKGIubGFzdF9tZXNzYWdlX2F0KS5nZXRUaW1lKCkgLSBuZXcgRGF0ZShhLmxhc3RfbWVzc2FnZV9hdCkuZ2V0VGltZSgpKTtcclxuICAgIHRoaXMuaW5ib3gkLm5leHQoaXRlbXMpO1xyXG4gIH1cclxuXHJcbiAgLyoqIEZpcnN0IG5vbi1lbXB0eSB0ZXh0IGZpZWxkIGZyb20gQVBJIC8gV1Mgb2JqZWN0cyAoUE9TVCBib2RpZXMgb2Z0ZW4gb21pdCBgY29udGVudGApLiAqL1xyXG4gIHByaXZhdGUgY29hbGVzY2VNZXNzYWdlVGV4dChyYXc6IGFueSwgZmFsbGJhY2sgPSAnJyk6IHN0cmluZyB7XHJcbiAgICBjb25zdCBjYW5kcyA9IFtyYXc/LmNvbnRlbnQsIHJhdz8uYm9keSwgcmF3Py50ZXh0LCBmYWxsYmFja107XHJcbiAgICBmb3IgKGNvbnN0IGMgb2YgY2FuZHMpIHtcclxuICAgICAgaWYgKHR5cGVvZiBjID09PSAnc3RyaW5nJyAmJiBjLnRyaW0oKSkgcmV0dXJuIGM7XHJcbiAgICAgIGlmIChjICE9IG51bGwgJiYgdHlwZW9mIGMgIT09ICdvYmplY3QnICYmIFN0cmluZyhjKS50cmltKCkpIHJldHVybiBTdHJpbmcoYykudHJpbSgpO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHR5cGVvZiBmYWxsYmFjayA9PT0gJ3N0cmluZycgPyBmYWxsYmFjayA6IFN0cmluZyhmYWxsYmFjayA/PyAnJyk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHBhcnNlUmVwbHlDb250ZW50KGNvbnRlbnQ6IHN0cmluZyk6IHsgcmVwbHk6IE1lc3NhZ2VSZXBseVByZXZpZXc7IGJvZHk6IHN0cmluZyB9IHwgbnVsbCB7XHJcbiAgICBjb25zdCB2YWx1ZSA9IFN0cmluZyhjb250ZW50IHx8ICcnKTtcclxuICAgIGNvbnN0IG1hdGNoID0gdmFsdWUubWF0Y2goL15cXFtSZXBseSB0byAoW15cXF1dKylcXF1cXG4+IChbXlxcbl0qKVxcblxcbihbXFxzXFxTXSopJC8pO1xyXG4gICAgaWYgKCFtYXRjaCkgcmV0dXJuIG51bGw7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICByZXBseToge1xyXG4gICAgICAgIHNlbmRlcl9uYW1lOiBtYXRjaFsxXS50cmltKCksXHJcbiAgICAgICAgY29udGVudDogbWF0Y2hbMl0udHJpbSgpLFxyXG4gICAgICB9LFxyXG4gICAgICBib2R5OiBtYXRjaFszXSxcclxuICAgIH07XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHJlcGx5Qm9keVRleHQoY29udGVudDogc3RyaW5nKTogc3RyaW5nIHtcclxuICAgIHJldHVybiB0aGlzLnBhcnNlUmVwbHlDb250ZW50KGNvbnRlbnQpPy5ib2R5ID8/IFN0cmluZyhjb250ZW50IHx8ICcnKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgbm90aWZ5R3JvdXBNZW1iZXJzaGlwQ2hhbmdlZCgpOiB2b2lkIHtcclxuICAgIHRoaXMuZ3JvdXBNZW1iZXJzaGlwVmVyc2lvbiQubmV4dCh0aGlzLmdyb3VwTWVtYmVyc2hpcFZlcnNpb24kLnZhbHVlICsgMSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHJlcGx5RXhjZXJwdChjb250ZW50OiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gICAgY29uc3QgcGFyc2VkID0gdGhpcy5wYXJzZVJlcGx5Q29udGVudChjb250ZW50KTtcclxuICAgIGNvbnN0IGJhc2UgPSAocGFyc2VkPy5ib2R5ID8/IGNvbnRlbnQpLnJlcGxhY2UoL1xccysvZywgJyAnKS50cmltKCk7XHJcbiAgICByZXR1cm4gYmFzZS5sZW5ndGggPiAxMjAgPyBgJHtiYXNlLnNsaWNlKDAsIDExNyl9Li4uYCA6IGJhc2UgfHwgJ0F0dGFjaG1lbnQnO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBjdXJyZW50TWVudGlvblRva2VucygpOiBzdHJpbmdbXSB7XHJcbiAgICBjb25zdCBjdXJyZW50ID0gdGhpcy5hdXRoLmN1cnJlbnRDb250YWN0O1xyXG4gICAgY29uc3QgdmFsdWVzID0gW1xyXG4gICAgICBjdXJyZW50Py51c2VybmFtZSxcclxuICAgICAgY3VycmVudD8uZW1haWw/LnNwbGl0KCdAJylbMF0sXHJcbiAgICAgIGN1cnJlbnQ/LmZpcnN0X25hbWUsXHJcbiAgICAgIGN1cnJlbnQ/Lmxhc3RfbmFtZSxcclxuICAgICAgY3VycmVudD8uZW1haWwsXHJcbiAgICBdO1xyXG4gICAgcmV0dXJuIHZhbHVlc1xyXG4gICAgICAubWFwKCh2YWx1ZSkgPT4gU3RyaW5nKHZhbHVlIHx8ICcnKS50cmltKCkudG9Mb3dlckNhc2UoKSlcclxuICAgICAgLmZpbHRlcihCb29sZWFuKVxyXG4gICAgICAubWFwKCh2YWx1ZSkgPT4gdmFsdWUucmVwbGFjZSgvXkAvLCAnJykpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBtZXNzYWdlVGV4dE1lbnRpb25zQ3VycmVudFVzZXIoY29udGVudDogc3RyaW5nKTogYm9vbGVhbiB7XHJcbiAgICBjb25zdCB0b2tlbnMgPSB0aGlzLmN1cnJlbnRNZW50aW9uVG9rZW5zKCk7XHJcbiAgICBpZiAoIXRva2Vucy5sZW5ndGgpIHJldHVybiBmYWxzZTtcclxuICAgIGNvbnN0IG1lbnRpb25zID0gQXJyYXkuZnJvbShTdHJpbmcoY29udGVudCB8fCAnJykubWF0Y2hBbGwoLyhefFteYS16QS1aMC05Ll8tXSlAKFthLXpBLVowLTkuXy1dKykvZykpXHJcbiAgICAgIC5tYXAoKG1hdGNoKSA9PiBtYXRjaFsyXS50b0xvd2VyQ2FzZSgpKTtcclxuICAgIHJldHVybiBtZW50aW9ucy5zb21lKChtZW50aW9uKSA9PiB0b2tlbnMuaW5jbHVkZXMobWVudGlvbikpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBtZXNzYWdlTWVudGlvbnNDdXJyZW50VXNlcihtZXNzYWdlOiBNZXNzYWdlKTogYm9vbGVhbiB7XHJcbiAgICBjb25zdCBteUlkID0gU3RyaW5nKHRoaXMuYXV0aC5jb250YWN0SWQgfHwgJycpO1xyXG4gICAgY29uc3QgZXhwbGljaXRNZW50aW9ucyA9IEFycmF5LmlzQXJyYXkobWVzc2FnZS5tZW50aW9ucylcclxuICAgICAgPyBtZXNzYWdlLm1lbnRpb25zLm1hcCgoaWQpID0+IFN0cmluZyhpZCkpXHJcbiAgICAgIDogW107XHJcbiAgICByZXR1cm4gKCEhbXlJZCAmJiBleHBsaWNpdE1lbnRpb25zLmluY2x1ZGVzKG15SWQpKSB8fFxyXG4gICAgICB0aGlzLm1lc3NhZ2VUZXh0TWVudGlvbnNDdXJyZW50VXNlcihTdHJpbmcobWVzc2FnZS5jb250ZW50IHx8ICcnKSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHNldENvbnZlcnNhdGlvbk1lbnRpb24oY29udmVyc2F0aW9uSWQ6IHN0cmluZywgaGFzTWVudGlvbjogYm9vbGVhbik6IHZvaWQge1xyXG4gICAgY29uc3QgaWQgPSBTdHJpbmcoY29udmVyc2F0aW9uSWQgfHwgJycpO1xyXG4gICAgaWYgKCFpZCkgcmV0dXJuO1xyXG4gICAgY29uc3QgbmV4dCA9IG5ldyBTZXQodGhpcy5tZW50aW9uQ29udmVyc2F0aW9uSWRzJC52YWx1ZSk7XHJcbiAgICBpZiAoaGFzTWVudGlvbikge1xyXG4gICAgICBuZXh0LmFkZChpZCk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBuZXh0LmRlbGV0ZShpZCk7XHJcbiAgICB9XHJcbiAgICB0aGlzLm1lbnRpb25Db252ZXJzYXRpb25JZHMkLm5leHQobmV4dCk7XHJcbiAgICBjb25zdCBpdGVtcyA9IHRoaXMuaW5ib3gkLnZhbHVlLm1hcCgoaXRlbSkgPT5cclxuICAgICAgU3RyaW5nKGl0ZW0uY29udmVyc2F0aW9uX2lkKSA9PT0gaWQgPyB7IC4uLml0ZW0sIGhhc19tZW50aW9uOiBoYXNNZW50aW9uIH0gOiBpdGVtXHJcbiAgICApO1xyXG4gICAgdGhpcy5pbmJveCQubmV4dChpdGVtcyk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIG1lc3NhZ2VMb29rc0xpa2VNZWRpYShtOiBNZXNzYWdlKTogYm9vbGVhbiB7XHJcbiAgICBjb25zdCB0ID0gbS5tZXNzYWdlX3R5cGU7XHJcbiAgICBpZiAodCAmJiB0ICE9PSAnVEVYVCcpIHJldHVybiB0cnVlO1xyXG4gICAgY29uc3QgdSA9IFN0cmluZyhtLm1lZGlhX3VybCA/PyAnJykudHJpbSgpO1xyXG4gICAgaWYgKHUgJiYgKHUuc3RhcnRzV2l0aCgnaHR0cDovLycpIHx8IHUuc3RhcnRzV2l0aCgnaHR0cHM6Ly8nKSB8fCB1LnN0YXJ0c1dpdGgoJ2RhdGE6JykpKSB7XHJcbiAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIEFycmF5LmlzQXJyYXkobS5hdHRhY2htZW50cykgJiYgbS5hdHRhY2htZW50cy5sZW5ndGggPiAwO1xyXG4gIH1cclxuXHJcbiAgLyoqIFNhbWUgbG9naWNhbCBtZXNzYWdlX2lkIGNhbiBhcHBlYXIgdHdpY2Ugd2hlbiBXUyBiZWF0cyBIVFRQIHRlbXAgcmVwbGFjZW1lbnQg4oCUIGtlZXAgZmlyc3Qgcm93LiAqL1xyXG4gIHByaXZhdGUgZGVkdXBlTWVzc2FnZXNCeUlkS2VlcEZpcnN0KG1zZ3M6IE1lc3NhZ2VbXSk6IE1lc3NhZ2VbXSB7XHJcbiAgICBjb25zdCBzZWVuID0gbmV3IFNldDxzdHJpbmc+KCk7XHJcbiAgICByZXR1cm4gbXNncy5maWx0ZXIoKG0pID0+IHtcclxuICAgICAgY29uc3QgaWQgPSBTdHJpbmcobS5tZXNzYWdlX2lkID8/ICcnKTtcclxuICAgICAgaWYgKCFpZCkgcmV0dXJuIHRydWU7XHJcbiAgICAgIGlmIChzZWVuLmhhcyhpZCkpIHJldHVybiBmYWxzZTtcclxuICAgICAgc2Vlbi5hZGQoaWQpO1xyXG4gICAgICByZXR1cm4gdHJ1ZTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBpbmNyZW1lbnRVbnJlYWQoY29udmVyc2F0aW9uSWQ6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgY29uc3QgaXRlbXMgPSB0aGlzLmluYm94JC52YWx1ZS5tYXAoKGl0ZW0pID0+XHJcbiAgICAgIGl0ZW0uY29udmVyc2F0aW9uX2lkID09PSBjb252ZXJzYXRpb25JZFxyXG4gICAgICAgID8geyAuLi5pdGVtLCB1bnJlYWRfY291bnQ6IE51bWJlcihpdGVtLnVucmVhZF9jb3VudCkgKyAxIH1cclxuICAgICAgICA6IGl0ZW1cclxuICAgICk7XHJcbiAgICB0aGlzLmluYm94JC5uZXh0KGl0ZW1zKTtcclxuICAgIHRoaXMucmVjYWxjVW5yZWFkKGl0ZW1zKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIE5vcm1hbGl6ZSBiYWNrZW5kIG1lc3NhZ2Ugc2hhcGVzIHNvIFVJIGNhbiByZWxpYWJseSByZW5kZXIgYXR0YWNobWVudHMvbWVkaWEuXHJcbiAgICogU3VwcG9ydHMgbGVnYWN5IGFuZCBjdXJyZW50IGZpZWxkIG5hbWVzIHJldHVybmVkIGJ5IEFQSS9XUyBwYXlsb2Fkcy5cclxuICAgKi9cclxuICBwcml2YXRlIG5vcm1hbGl6ZU1lc3NhZ2VTaGFwZShyYXc6IGFueSk6IE1lc3NhZ2Uge1xyXG4gICAgY29uc3QgYmFzZTogTWVzc2FnZSA9IHtcclxuICAgICAgbWVzc2FnZV9pZDogU3RyaW5nKHJhdz8ubWVzc2FnZV9pZCA/PyByYXc/LmlkID8/ICcnKSxcclxuICAgICAgY29udmVyc2F0aW9uX2lkOiBTdHJpbmcocmF3Py5jb252ZXJzYXRpb25faWQgPz8gcmF3Py5jb252ZXJzYXRpb25JZCA/PyAnJyksXHJcbiAgICAgIHNlbmRlcl9pZDogU3RyaW5nKHJhdz8uc2VuZGVyX2lkID8/IHJhdz8uc2VuZGVySWQgPz8gJycpLFxyXG4gICAgICBzZW5kZXJfbmFtZTogcmF3Py5zZW5kZXJfbmFtZSxcclxuICAgICAgc2VuZGVyX3VzZXJuYW1lOiByYXc/LnNlbmRlcl91c2VybmFtZSxcclxuICAgICAgc2VuZGVyX2ZpcnN0X25hbWU6IHJhdz8uc2VuZGVyX2ZpcnN0X25hbWUsXHJcbiAgICAgIHNlbmRlcl9sYXN0X25hbWU6IHJhdz8uc2VuZGVyX2xhc3RfbmFtZSxcclxuICAgICAgbWVzc2FnZV90eXBlOiAocmF3Py5tZXNzYWdlX3R5cGUgPz8gcmF3Py5tZXNzYWdlVHlwZSA/PyAnVEVYVCcpIGFzIE1lc3NhZ2VbJ21lc3NhZ2VfdHlwZSddLFxyXG4gICAgICBjb250ZW50OiByYXc/LmNvbnRlbnQgPz8gcmF3Py5ib2R5ID8/IHJhdz8udGV4dCA/PyAnJyxcclxuICAgICAgbWVkaWFfdXJsOiByYXc/Lm1lZGlhX3VybCA/PyByYXc/Lm1lZGlhVXJsID8/IHJhdz8udXJsID8/IHJhdz8uZmlsZV91cmwsXHJcbiAgICAgIGNyZWF0ZWRfYXQ6IHJhdz8uY3JlYXRlZF9hdCA/PyByYXc/LmNyZWF0ZWRBdCA/PyBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXHJcbiAgICAgIGlzX3JlYWQ6IHJhdz8uaXNfcmVhZCxcclxuICAgICAgZWRpdGVkX2F0OiByYXc/LmVkaXRlZF9hdCA/PyByYXc/LmVkaXRlZEF0LFxyXG4gICAgICBpc19kZWxldGVkOiBCb29sZWFuKHJhdz8uaXNfZGVsZXRlZCA/PyByYXc/LmlzRGVsZXRlZCA/PyBmYWxzZSksXHJcbiAgICAgIGRlbGV0ZWRfYXQ6IHJhdz8uZGVsZXRlZF9hdCA/PyByYXc/LmRlbGV0ZWRBdCxcclxuICAgICAgcmVhY3Rpb25zOiByYXc/LnJlYWN0aW9ucyxcclxuICAgICAgbWVudGlvbnM6IHJhdz8ubWVudGlvbnMsXHJcbiAgICAgIGF0dGFjaG1lbnRzOiByYXc/LmF0dGFjaG1lbnRzLFxyXG4gICAgICBpc19waW5uZWQ6IHJhdz8uaXNfcGlubmVkLFxyXG4gICAgICBwaW5uZWRfYXQ6IHJhdz8ucGlubmVkX2F0LFxyXG4gICAgICBwaW5uZWRfYnk6IHJhdz8ucGlubmVkX2J5LFxyXG4gICAgfTtcclxuXHJcbiAgICBjb25zdCByYXdDb250ZW50ID0gU3RyaW5nKGJhc2UuY29udGVudCB8fCAnJyk7XHJcbiAgICBpZiAocmF3Q29udGVudC5zdGFydHNXaXRoKFBMQUlOX1RFWFRfTUVTU0FHRV9QUkVGSVgpKSB7XHJcbiAgICAgIGJhc2UuY29udGVudCA9IHJhd0NvbnRlbnQuc2xpY2UoUExBSU5fVEVYVF9NRVNTQUdFX1BSRUZJWC5sZW5ndGgpO1xyXG4gICAgICBiYXNlLnJlbmRlcl9hc19wbGFpbl90ZXh0ID0gdHJ1ZTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIGJhc2UucmVuZGVyX2FzX3BsYWluX3RleHQgPSByYXc/LnJlbmRlcl9hc19wbGFpbl90ZXh0ID8/IHJhdz8ucmVuZGVyQXNQbGFpblRleHQ7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgcGFyc2VkUmVwbHkgPSB0aGlzLnBhcnNlUmVwbHlDb250ZW50KFN0cmluZyhiYXNlLmNvbnRlbnQgfHwgJycpKTtcclxuICAgIGlmIChwYXJzZWRSZXBseSkge1xyXG4gICAgICBiYXNlLmNvbnRlbnQgPSBwYXJzZWRSZXBseS5ib2R5O1xyXG4gICAgICBiYXNlLnJlcGx5X3RvID0gcmF3Py5yZXBseV90byA/PyByYXc/LnJlcGx5VG8gPz8gcGFyc2VkUmVwbHkucmVwbHk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBiYXNlLnJlcGx5X3RvID0gcmF3Py5yZXBseV90byA/PyByYXc/LnJlcGx5VG87XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgdXVpZFJlID1cclxuICAgICAgL15bMC05YS1mXXs4fS1bMC05YS1mXXs0fS1bMS01XVswLTlhLWZdezN9LVs4OWFiXVswLTlhLWZdezN9LVswLTlhLWZdezEyfSQvaTtcclxuXHJcbiAgICBjb25zdCB0b1N0cmluZ0FycmF5ID0gKHZhbHVlOiBhbnkpOiBzdHJpbmdbXSA9PiB7XHJcbiAgICAgIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkge1xyXG4gICAgICAgIHJldHVybiB2YWx1ZVxyXG4gICAgICAgICAgLm1hcCgoeDogYW55KSA9PiAodHlwZW9mIHggPT09ICdzdHJpbmcnID8geCA6IHg/LmZpbGVfaWQgPz8geD8uaWQgPz8gJycpKVxyXG4gICAgICAgICAgLm1hcCgoeDogYW55KSA9PiBTdHJpbmcoeCkudHJpbSgpKVxyXG4gICAgICAgICAgLmZpbHRlcihCb29sZWFuKTtcclxuICAgICAgfVxyXG4gICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJyAmJiB2YWx1ZS50cmltKCkpIHtcclxuICAgICAgICBjb25zdCB0cmltbWVkID0gdmFsdWUudHJpbSgpO1xyXG4gICAgICAgIGlmICh0cmltbWVkLnN0YXJ0c1dpdGgoJ3snKSB8fCB0cmltbWVkLnN0YXJ0c1dpdGgoJ1snKSkge1xyXG4gICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgY29uc3QgcGFyc2VkID0gSlNPTi5wYXJzZSh0cmltbWVkKTtcclxuICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkocGFyc2VkKSkgcmV0dXJuIHRvU3RyaW5nQXJyYXkocGFyc2VkKTtcclxuICAgICAgICAgICAgcmV0dXJuIHRvU3RyaW5nQXJyYXkocGFyc2VkPy5pZHMgPz8gcGFyc2VkPy5maWxlX2lkcyA/PyBwYXJzZWQ/LmF0dGFjaG1lbnRfaWRzID8/IHBhcnNlZD8uYXR0YWNobWVudHMpO1xyXG4gICAgICAgICAgfSBjYXRjaCB7XHJcbiAgICAgICAgICAgIHJldHVybiBbXTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHRyaW1tZWQuc3BsaXQoL1ssXFxzXSsvKS5tYXAoKHM6IHN0cmluZykgPT4gcy50cmltKCkpLmZpbHRlcihCb29sZWFuKTtcclxuICAgICAgfVxyXG4gICAgICByZXR1cm4gW107XHJcbiAgICB9O1xyXG5cclxuICAgIGNvbnN0IG5vcm1hbGl6ZUF0dGFjaG1lbnQgPSAoYTogYW55KTogQXR0YWNobWVudCB8IG51bGwgPT4ge1xyXG4gICAgICBjb25zdCBmaWxlSWQgPSBTdHJpbmcoXHJcbiAgICAgICAgdHlwZW9mIGEgPT09ICdzdHJpbmcnID8gYSA6XHJcbiAgICAgICAgYT8uZmlsZV9pZCA/PyBhPy5maWxlSWQgPz8gYT8uaWQgPz8gYT8uYXR0YWNobWVudF9pZCA/PyBhPy5zdG9yYWdlX2ZpbGVfaWQgPz8gJydcclxuICAgICAgKS50cmltKCk7XHJcbiAgICAgIGlmICghZmlsZUlkIHx8IGZpbGVJZC5zdGFydHNXaXRoKCd0ZW1wLScpKSByZXR1cm4gbnVsbDtcclxuICAgICAgcmV0dXJuIHtcclxuICAgICAgICBmaWxlX2lkOiBmaWxlSWQsXHJcbiAgICAgICAgZmlsZW5hbWU6IFN0cmluZyhhPy5maWxlbmFtZSA/PyBhPy5maWxlX25hbWUgPz8gYT8ubmFtZSA/PyBhPy5vcmlnaW5hbF9maWxlbmFtZSA/PyAnRmlsZScpLFxyXG4gICAgICAgIG1pbWVfdHlwZTogYT8ubWltZV90eXBlID8/IGE/Lm1pbWVUeXBlLFxyXG4gICAgICAgIHNpemVfYnl0ZXM6IGE/LnNpemVfYnl0ZXMgPz8gYT8uc2l6ZUJ5dGVzLFxyXG4gICAgICAgIHVybDogYT8udXJsID8/IGE/LmZpbGVfdXJsID8/IGE/LmRvd25sb2FkX3VybCxcclxuICAgICAgfTtcclxuICAgIH07XHJcblxyXG4gICAgbGV0IG5vcm1hbGl6ZWRBdHRhY2htZW50czogQXR0YWNobWVudFtdID0gW107XHJcbiAgICBjb25zdCBhZGRBdHRhY2htZW50ID0gKGF0dGFjaG1lbnQ6IEF0dGFjaG1lbnQgfCBudWxsKTogdm9pZCA9PiB7XHJcbiAgICAgIGlmICghYXR0YWNobWVudCkgcmV0dXJuO1xyXG4gICAgICBjb25zdCBmaWxlSWQgPSBTdHJpbmcoYXR0YWNobWVudC5maWxlX2lkIHx8ICcnKS50cmltKCk7XHJcbiAgICAgIGNvbnN0IHVybCA9IFN0cmluZyhhdHRhY2htZW50LnVybCB8fCAnJykudHJpbSgpO1xyXG4gICAgICBpZiAoZmlsZUlkLnN0YXJ0c1dpdGgoJ3snKSB8fCBmaWxlSWQuc3RhcnRzV2l0aCgnWycpKSB7XHJcbiAgICAgICAgY29uc3QgaWRzID0gdG9TdHJpbmdBcnJheShmaWxlSWQpO1xyXG4gICAgICAgIGlkcy5mb3JFYWNoKChpZCwgaWR4KSA9PiB7XHJcbiAgICAgICAgICBhZGRBdHRhY2htZW50KHtcclxuICAgICAgICAgICAgLi4uYXR0YWNobWVudCxcclxuICAgICAgICAgICAgZmlsZV9pZDogaWQsXHJcbiAgICAgICAgICAgIGZpbGVuYW1lOiBhdHRhY2htZW50LmZpbGVuYW1lIHx8IGBBdHRhY2htZW50ICR7aWR4ICsgMX1gLFxyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICB9XHJcbiAgICAgIGlmIChmaWxlSWQgJiYgbm9ybWFsaXplZEF0dGFjaG1lbnRzLnNvbWUoKGEpID0+IGEuZmlsZV9pZCA9PT0gZmlsZUlkKSkgcmV0dXJuO1xyXG4gICAgICBpZiAoIWZpbGVJZCAmJiB1cmwgJiYgbm9ybWFsaXplZEF0dGFjaG1lbnRzLnNvbWUoKGEpID0+IGEudXJsID09PSB1cmwpKSByZXR1cm47XHJcbiAgICAgIG5vcm1hbGl6ZWRBdHRhY2htZW50cy5wdXNoKGF0dGFjaG1lbnQpO1xyXG4gICAgfTtcclxuXHJcbiAgICAvLyBOb3JtYWxpemUgYXR0YWNobWVudCBvYmplY3RzIChBUEkgbWF5IHVzZSBmaWxlSWQgLyBpZCBpbnN0ZWFkIG9mIGZpbGVfaWQpLlxyXG4gICAgaWYgKEFycmF5LmlzQXJyYXkoYmFzZS5hdHRhY2htZW50cykgJiYgYmFzZS5hdHRhY2htZW50cy5sZW5ndGggPiAwKSB7XHJcbiAgICAgIChiYXNlLmF0dGFjaG1lbnRzIGFzIGFueVtdKS5mb3JFYWNoKChhKSA9PiBhZGRBdHRhY2htZW50KG5vcm1hbGl6ZUF0dGFjaG1lbnQoYSkpKTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBtZWRpYVZhbHVlID0gU3RyaW5nKGJhc2UubWVkaWFfdXJsIHx8ICcnKS50cmltKCk7XHJcbiAgICBpZiAobWVkaWFWYWx1ZS5zdGFydHNXaXRoKCd7JykgfHwgbWVkaWFWYWx1ZS5zdGFydHNXaXRoKCdbJykpIHtcclxuICAgICAgdHJ5IHtcclxuICAgICAgICBjb25zdCBwYXJzZWQgPSBKU09OLnBhcnNlKG1lZGlhVmFsdWUpO1xyXG4gICAgICAgIGNvbnN0IHJhd0F0dGFjaG1lbnRzID0gQXJyYXkuaXNBcnJheShwYXJzZWQpID8gcGFyc2VkIDogcGFyc2VkPy5hdHRhY2htZW50cztcclxuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShyYXdBdHRhY2htZW50cykpIHtcclxuICAgICAgICAgIHJhd0F0dGFjaG1lbnRzLmZvckVhY2goKGEpID0+IGFkZEF0dGFjaG1lbnQobm9ybWFsaXplQXR0YWNobWVudChhKSkpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkocGFyc2VkKSkge1xyXG4gICAgICAgICAgY29uc3QgbWVkaWFJZHMgPSB0b1N0cmluZ0FycmF5KHBhcnNlZD8uaWRzID8/IHBhcnNlZD8uZmlsZV9pZHMgPz8gcGFyc2VkPy5hdHRhY2htZW50X2lkcyk7XHJcbiAgICAgICAgICBjb25zdCBtZWRpYUZpbGVuYW1lcyA9IHRvU3RyaW5nQXJyYXkocGFyc2VkPy5maWxlbmFtZXMpO1xyXG4gICAgICAgICAgY29uc3QgbWVkaWFNaW1lVHlwZXMgPSB0b1N0cmluZ0FycmF5KHBhcnNlZD8ubWltZV90eXBlcyA/PyBwYXJzZWQ/Lm1pbWVUeXBlcyk7XHJcbiAgICAgICAgICBtZWRpYUlkcy5mb3JFYWNoKChpZCwgaWR4KSA9PiB7XHJcbiAgICAgICAgICAgIGFkZEF0dGFjaG1lbnQoe1xyXG4gICAgICAgICAgICAgIGZpbGVfaWQ6IGlkLFxyXG4gICAgICAgICAgICAgIGZpbGVuYW1lOiBtZWRpYUZpbGVuYW1lc1tpZHhdIHx8IG1lZGlhRmlsZW5hbWVzWzBdIHx8IGBBdHRhY2htZW50ICR7aWR4ICsgMX1gLFxyXG4gICAgICAgICAgICAgIG1pbWVfdHlwZTogbWVkaWFNaW1lVHlwZXNbaWR4XSxcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICAgIH0gY2F0Y2gge1xyXG4gICAgICAgIC8vIEZhbGwgdGhyb3VnaCB0byBsZWdhY3kgYXR0YWNobWVudCByZWNvbnN0cnVjdGlvbiBiZWxvdy5cclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8vIFJlY29uc3RydWN0IGF0dGFjaG1lbnRzIGZyb20gYWx0ZXJuYXRlIEFQSSBmaWVsZHMuXHJcbiAgICBsZXQgYXR0YWNobWVudElkczogc3RyaW5nW10gPSBbXTtcclxuICAgIGF0dGFjaG1lbnRJZHMgPSB0b1N0cmluZ0FycmF5KHJhdz8uYXR0YWNobWVudF9pZHMpO1xyXG5cclxuICAgIGlmIChhdHRhY2htZW50SWRzLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICBhdHRhY2htZW50SWRzID0gdG9TdHJpbmdBcnJheShyYXc/LmZpbGVfaWRzKTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBwdXNoSWQgPSAodjogYW55KSA9PiB7XHJcbiAgICAgIGNvbnN0IHMgPSB2ICE9IG51bGwgJiYgdiAhPT0gJycgPyBTdHJpbmcodikudHJpbSgpIDogJyc7XHJcbiAgICAgIGlmIChzICYmICFhdHRhY2htZW50SWRzLmluY2x1ZGVzKHMpKSBhdHRhY2htZW50SWRzLnB1c2gocyk7XHJcbiAgICB9O1xyXG5cclxuICAgIHB1c2hJZChyYXc/LmZpbGVfaWQpO1xyXG4gICAgcHVzaElkKHJhdz8uYXR0YWNobWVudF9pZCk7XHJcbiAgICBwdXNoSWQocmF3Py5zdG9yYWdlX2ZpbGVfaWQpO1xyXG4gICAgcHVzaElkKHJhdz8uYmxvYl9pZCk7XHJcblxyXG4gICAgLy8gQmFja2VuZCBzdG9yZXMgZmlyc3QgYXR0YWNobWVudCBpZCBpbiBtZXNzYWdpbmcubWVzc2FnZS5tZWRpYV91cmwgKFVVSUQpLCBub3QgYSBwdWJsaWMgVVJMLlxyXG4gICAgY29uc3QgbWVkaWFBc0lkID0gU3RyaW5nKGJhc2UubWVkaWFfdXJsIHx8ICcnKS50cmltKCk7XHJcbiAgICBpZiAoXHJcbiAgICAgIG1lZGlhQXNJZCAmJlxyXG4gICAgICAhbWVkaWFBc0lkLnN0YXJ0c1dpdGgoJ3snKSAmJlxyXG4gICAgICAhbWVkaWFBc0lkLnN0YXJ0c1dpdGgoJ1snKSAmJlxyXG4gICAgICAhbWVkaWFBc0lkLnN0YXJ0c1dpdGgoJ2h0dHA6Ly8nKSAmJlxyXG4gICAgICAhbWVkaWFBc0lkLnN0YXJ0c1dpdGgoJ2h0dHBzOi8vJykgJiZcclxuICAgICAgIW1lZGlhQXNJZC5zdGFydHNXaXRoKCdkYXRhOicpXHJcbiAgICApIHtcclxuICAgICAgcHVzaElkKG1lZGlhQXNJZCk7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgY29udGVudFRyaW0gPSBTdHJpbmcoYmFzZS5jb250ZW50IHx8ICcnKS50cmltKCk7XHJcbiAgICBpZiAoYXR0YWNobWVudElkcy5sZW5ndGggPT09IDAgJiYgdXVpZFJlLnRlc3QoY29udGVudFRyaW0pKSB7XHJcbiAgICAgIGF0dGFjaG1lbnRJZHMucHVzaChjb250ZW50VHJpbSk7XHJcbiAgICB9XHJcbiAgICAvLyBTb21lIEFQSXMgc3RvcmUgc3RvcmFnZSAvIGF0dGFjaG1lbnQgaWQgYXMgbnVtZXJpYyBzdHJpbmcgaW4gY29udGVudCBmb3IgRklMRSBtZXNzYWdlcy5cclxuICAgIGlmIChcclxuICAgICAgYXR0YWNobWVudElkcy5sZW5ndGggPT09IDAgJiZcclxuICAgICAgL15cXGQrJC8udGVzdChjb250ZW50VHJpbSkgJiZcclxuICAgICAgKGJhc2UubWVzc2FnZV90eXBlID09PSAnRklMRScgfHwgYmFzZS5tZXNzYWdlX3R5cGUgPT09ICdJTUFHRScpXHJcbiAgICApIHtcclxuICAgICAgYXR0YWNobWVudElkcy5wdXNoKGNvbnRlbnRUcmltKTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBmaWxlbmFtZXM6IHN0cmluZ1tdID0gdG9TdHJpbmdBcnJheShyYXc/LmZpbGVuYW1lcykubGVuZ3RoXHJcbiAgICAgID8gdG9TdHJpbmdBcnJheShyYXc/LmZpbGVuYW1lcylcclxuICAgICAgOiByYXc/LmZpbGVuYW1lXHJcbiAgICAgID8gW1N0cmluZyhyYXcuZmlsZW5hbWUpXVxyXG4gICAgICA6IHJhdz8uZmlsZV9uYW1lXHJcbiAgICAgID8gW1N0cmluZyhyYXcuZmlsZV9uYW1lKV1cclxuICAgICAgOiBbXTtcclxuXHJcbiAgICBjb25zdCBtaW1lVHlwZXM6IHN0cmluZ1tdID0gdG9TdHJpbmdBcnJheShyYXc/Lm1pbWVfdHlwZXMpLmxlbmd0aFxyXG4gICAgICA/IHRvU3RyaW5nQXJyYXkocmF3Py5taW1lX3R5cGVzKVxyXG4gICAgICA6IHRvU3RyaW5nQXJyYXkocmF3Py5taW1lVHlwZXMpO1xyXG5cclxuICAgIGlmIChhdHRhY2htZW50SWRzLmxlbmd0aCA+IDAgfHwgZmlsZW5hbWVzLmxlbmd0aCA+IDApIHtcclxuICAgICAgY29uc3QgZmFsbGJhY2tNaW1lID0gcmF3Py5taW1lX3R5cGUgPz8gcmF3Py5hdHRhY2htZW50X21pbWVfdHlwZSA/PyAoYmFzZS5tZXNzYWdlX3R5cGUgPT09ICdJTUFHRScgPyAnaW1hZ2UvKicgOiB1bmRlZmluZWQpO1xyXG4gICAgICBjb25zdCB1cmxGYWxsYmFjayA9IHJhdz8uZmlsZV91cmwgPz8gcmF3Py51cmwgPz8gcmF3Py5tZWRpYV91cmwgPz8gcmF3Py5tZWRpYVVybDtcclxuICAgICAgY29uc3QgaWRzID0gYXR0YWNobWVudElkcy5sZW5ndGggPiAwID8gYXR0YWNobWVudElkcyA6IFtdO1xyXG4gICAgICBjb25zdCBidWlsdDogQXR0YWNobWVudFtdID0gaWRzLm1hcCgoaWQsIGlkeCkgPT4gKHtcclxuICAgICAgICBmaWxlX2lkOiBpZCxcclxuICAgICAgICBmaWxlbmFtZTogZmlsZW5hbWVzW2lkeF0gfHwgZmlsZW5hbWVzWzBdIHx8IChiYXNlLm1lc3NhZ2VfdHlwZSA9PT0gJ0lNQUdFJyA/IGBJbWFnZSAke2lkeCArIDF9YCA6IGBBdHRhY2htZW50ICR7aWR4ICsgMX1gKSxcclxuICAgICAgICBtaW1lX3R5cGU6IG1pbWVUeXBlc1tpZHhdIHx8IGZhbGxiYWNrTWltZSxcclxuICAgICAgICB1cmw6IHVybEZhbGxiYWNrLFxyXG4gICAgICB9KSk7XHJcblxyXG4gICAgICAvLyBGaWxlbmFtZSBvbmx5ICsgZGlyZWN0IFVSTCAobm8gc3RvcmFnZSBpZCk6IHN0aWxsIHJlbmRlcmFibGUgYXMgPGltZyBzcmM+LlxyXG4gICAgICBpZiAoXHJcbiAgICAgICAgYnVpbHQubGVuZ3RoID09PSAwICYmXHJcbiAgICAgICAgZmlsZW5hbWVzLmxlbmd0aCA+IDAgJiZcclxuICAgICAgICB1cmxGYWxsYmFjayAmJlxyXG4gICAgICAgIFN0cmluZyh1cmxGYWxsYmFjaykubWF0Y2goL15odHRwcz86XFwvXFwvL2kpXHJcbiAgICAgICkge1xyXG4gICAgICAgIGJ1aWx0LnB1c2goe1xyXG4gICAgICAgICAgZmlsZV9pZDogJycsXHJcbiAgICAgICAgICBmaWxlbmFtZTogZmlsZW5hbWVzWzBdLFxyXG4gICAgICAgICAgbWltZV90eXBlOiBmYWxsYmFja01pbWUsXHJcbiAgICAgICAgICB1cmw6IFN0cmluZyh1cmxGYWxsYmFjayksXHJcbiAgICAgICAgfSk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGJ1aWx0LmZvckVhY2goKGF0dGFjaG1lbnQpID0+IGFkZEF0dGFjaG1lbnQoYXR0YWNobWVudCkpO1xyXG4gICAgfVxyXG5cclxuICAgIGlmIChub3JtYWxpemVkQXR0YWNobWVudHMubGVuZ3RoID4gMCkge1xyXG4gICAgICByZXR1cm4geyAuLi5iYXNlLCBhdHRhY2htZW50czogbm9ybWFsaXplZEF0dGFjaG1lbnRzIH07XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIGJhc2U7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHBsYXlTb2Z0Tm90aWZpY2F0aW9uU291bmQoZm9yY2UgPSBmYWxzZSk6IHZvaWQge1xyXG4gICAgaWYgKCFmb3JjZSAmJiB0aGlzLm5vdGlmaWNhdGlvbnNNdXRlZCQudmFsdWUpIHJldHVybjtcclxuICAgIGNvbnN0IHZvbHVtZSA9IE1hdGgubWF4KDAsIE1hdGgubWluKDEsIHRoaXMubm90aWZpY2F0aW9uVm9sdW1lJC52YWx1ZSkpO1xyXG4gICAgaWYgKHZvbHVtZSA8PSAwICYmICFmb3JjZSkgcmV0dXJuO1xyXG5cclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IEF1ZGlvQ3R4ID0gKHdpbmRvdyBhcyBhbnkpLkF1ZGlvQ29udGV4dCB8fCAod2luZG93IGFzIGFueSkud2Via2l0QXVkaW9Db250ZXh0O1xyXG4gICAgICBpZiAoIUF1ZGlvQ3R4KSByZXR1cm47XHJcbiAgICAgIGNvbnN0IGN0eCA9IG5ldyBBdWRpb0N0eCgpO1xyXG4gICAgICBjb25zdCBtYXN0ZXIgPSBjdHguY3JlYXRlR2FpbigpO1xyXG4gICAgICBjb25zdCBvdXRwdXRHYWluID0gTWF0aC5tYXgodm9sdW1lLCAwLjAwMSk7XHJcbiAgICAgIG1hc3Rlci5nYWluLnNldFZhbHVlQXRUaW1lKDAuMDAwMSwgY3R4LmN1cnJlbnRUaW1lKTtcclxuICAgICAgbWFzdGVyLmdhaW4uZXhwb25lbnRpYWxSYW1wVG9WYWx1ZUF0VGltZShvdXRwdXRHYWluLCBjdHguY3VycmVudFRpbWUgKyAwLjAxNSk7XHJcbiAgICAgIG1hc3Rlci5nYWluLmV4cG9uZW50aWFsUmFtcFRvVmFsdWVBdFRpbWUoMC4wMDAxLCBjdHguY3VycmVudFRpbWUgKyAwLjQyKTtcclxuICAgICAgbWFzdGVyLmNvbm5lY3QoY3R4LmRlc3RpbmF0aW9uKTtcclxuXHJcbiAgICAgIGNvbnN0IHBsYXlUb25lID0gKGZyZXF1ZW5jeTogbnVtYmVyLCBzdGFydDogbnVtYmVyLCBkdXJhdGlvbjogbnVtYmVyKSA9PiB7XHJcbiAgICAgICAgY29uc3Qgb3NjID0gY3R4LmNyZWF0ZU9zY2lsbGF0b3IoKTtcclxuICAgICAgICBjb25zdCBnYWluID0gY3R4LmNyZWF0ZUdhaW4oKTtcclxuICAgICAgICBvc2MudHlwZSA9ICdzaW5lJztcclxuICAgICAgICBvc2MuZnJlcXVlbmN5LnNldFZhbHVlQXRUaW1lKGZyZXF1ZW5jeSwgY3R4LmN1cnJlbnRUaW1lICsgc3RhcnQpO1xyXG4gICAgICAgIGdhaW4uZ2Fpbi5zZXRWYWx1ZUF0VGltZSgwLjAwMDEsIGN0eC5jdXJyZW50VGltZSArIHN0YXJ0KTtcclxuICAgICAgICBnYWluLmdhaW4uZXhwb25lbnRpYWxSYW1wVG9WYWx1ZUF0VGltZSgwLjU1LCBjdHguY3VycmVudFRpbWUgKyBzdGFydCArIDAuMDI1KTtcclxuICAgICAgICBnYWluLmdhaW4uZXhwb25lbnRpYWxSYW1wVG9WYWx1ZUF0VGltZSgwLjAwMDEsIGN0eC5jdXJyZW50VGltZSArIHN0YXJ0ICsgZHVyYXRpb24pO1xyXG4gICAgICAgIG9zYy5jb25uZWN0KGdhaW4pO1xyXG4gICAgICAgIGdhaW4uY29ubmVjdChtYXN0ZXIpO1xyXG4gICAgICAgIG9zYy5zdGFydChjdHguY3VycmVudFRpbWUgKyBzdGFydCk7XHJcbiAgICAgICAgb3NjLnN0b3AoY3R4LmN1cnJlbnRUaW1lICsgc3RhcnQgKyBkdXJhdGlvbiArIDAuMDIpO1xyXG4gICAgICB9O1xyXG5cclxuICAgICAgcGxheVRvbmUoNzQwLCAwLCAwLjE4KTtcclxuICAgICAgcGxheVRvbmUoOTg4LCAwLjEyLCAwLjIyKTtcclxuICAgICAgd2luZG93LnNldFRpbWVvdXQoKCkgPT4gY3R4LmNsb3NlKCkuY2F0Y2goKCkgPT4ge30pLCA2MDApO1xyXG4gICAgfSBjYXRjaCB7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHBsYXlOb3RpZmljYXRpb25Tb3VuZCgpOiB2b2lkIHtcclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IGF1ZGlvID0gbmV3IEF1ZGlvKCdkYXRhOmF1ZGlvL3dhdjtiYXNlNjQsVWtsR1Jub0dBQUJYUVZaRlptMTBJQkFBQUFBQkFBRUFRQjhBQUVBZkFBQUJBQWdBWkdGMFlRb0dBQUNCaFlxRmJGMWZkSml2ckpCaE5qVmdvZERicTJFY0JqK2EyL0xEY2lVRkxJSE84dGlKTndnWmFMdnQ1NTlORUF4UXArUHd0bU1jQmppUjEvTE1lU3dGSkhmSDhOMlFRQW9VWHJUcDY2aFZGQXBHbitEeXZtd2hCU3VCenZMWmlUWUlHR1M1N09paFVCRUxUS1hoOGJsbEhBVTJqZFh6em4wdkJTaCt6UExhaXpzS0ZHQ3o2T3lyV0JRTFNLRGY4c0Z1SXdVdWc4L3kyNGszQ0Joa3Urem9vVkFSQzB5bDRmRzVaUndGTm8zVjg4NTlMd1VvZnN6eTJvczdDaFJncytqc3ExZ1ZDMGlnMy9MQmJpTUZMb0xQOHR1Sk53Z1laTHZzNktGUUVRdE1wZUh4dVdVY0JUYU4xZlBPZlM4RktIN004dHFMT3dvVVlMUG83S3RZRlF0SW9OL3l3VzRqQlM2Q3ovTGJpVGNJR0dTNzdPaWhVQkVMVEtYaDhibGxIQVUyamRYenpuMHZCU2grelBMYWl6c0tGR0N6Nk95cldCVUxTS0RmOHNGdUl3VXVncy95MjRrM0NCaGt1K3pvb1ZBUkMweWw0Zkc1WlJ3Rk5vM1Y4ODU5THdVb2Zzenkyb3M3Q2hSZ3MranNxMWdWQzBpZzMvTEJiaU1GTG9MUDh0dUpOd2dZWkx2czZLRlFFUXRNcGVIeHVXVWNCVGFOMWZQT2ZTOEZLSDdNOHRxTE93b1VZTFBvN0t0WUZRdElvTi95d1c0akJTNkN6L0xiaVRjSUdHUzc3T2loVUJFTFRLWGg4YmxsSEFVMmpkWHp6bjB2QlNoK3pQTGFpenNLRkdDejZPeXJXQlVMU0tEZjhzRnVJd1V1Z3MveTI0azNDQmhrdSt6b29WQVJDMHlsNGZHNVpSd0ZObzNWODg1OUx3VW9mc3p5Mm9zN0NoUmdzK2pzcTFnVkMwaWczL0xCYmlNRkxvTFA4dHVKTndnWVpMdnM2S0ZRRVF0TXBlSHh1V1VjQlRhTjFmUE9mUzhGS0g3TTh0cUxPd29VWUxQbzdLdFlGUXRJb04veXdXNGpCUzZDei9MYmlUY0lHR1M3N09paFVCRUxUS1hoOGJsbEhBVTJqZFh6em4wdkJTaCt6UExhaXpzS0ZHQ3o2T3lyV0JVTFNLRGY4c0Z1SXdVdWdzL3kyNGszQ0Joa3Urem9vVkFSQzB5bDRmRzVaUndGTm8zVjg4NTlMd1VvZnN6eTJvczdDaFJncytqc3ExZ1ZDMGlnMy9MQmJpTUZMb0xQOHR1Sk53Z1laTHZzNktGUUVRdE1wZUh4dVdVY0JUYU4xZlBPZlM4RktIN004dHFMT3dvVVlMUG83S3RZRlF0SW9OL3l3VzRqQlM2Q3ovTGJpVGNJR0dTNzdPaWhVQkVMVEtYaDhibGxIQVUyamRYenpuMHZCU2grelBMYWl6c0tGR0N6Nk95cldCVUxTS0RmOHNGdUl3VXVncy95MjRrM0NCaGt1K3pvb1ZBUkMweWw0Zkc1WlJ3Rk5vM1Y4ODU5THdVb2Zzenkyb3M3Q2hSZ3MranNxMWdWQzBpZzMvTEJiaU1GTG9MUDh0dUpOd2dZWkx2czZLRlFFUXRNcGVIeHVXVWNCVGFOMWZQT2ZTOEZLSDdNOHRxTE93b1VZTFBvN0t0WUZRdElvTi95d1c0akJTNkN6L0xiaVRjSUdHUzc3T2loVUJFTFRLWGg4YmxsSEFVMmpkWHp6bjB2QlNoK3pQTGFpenNLRkdDejZPeXJXQlVMU0tEZjhzRnVJd1V1Z3MveTI0azNDQmhrdSt6b29WQVJDMHlsNGZHNVpSd0ZObzNWODg1OUx3VW9mc3p5Jyk7XHJcbiAgICAgIGF1ZGlvLnZvbHVtZSA9IDAuMztcclxuICAgICAgYXVkaW8ucGxheSgpLmNhdGNoKCgpID0+IHt9KTtcclxuICAgIH0gY2F0Y2gge1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSByZWNhbGNVbnJlYWQoaXRlbXM6IEluYm94SXRlbVtdKTogdm9pZCB7XHJcbiAgICBjb25zdCB0b3RhbCA9IGl0ZW1zLnJlZHVjZSgoc3VtLCBpKSA9PiBzdW0gKyBOdW1iZXIoaS51bnJlYWRfY291bnQgfHwgMCksIDApO1xyXG4gICAgdGhpcy50b3RhbFVucmVhZCQubmV4dCh0b3RhbCk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGdldENvbnRhY3ROYW1lQnlJZChjb250YWN0SWQ6IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgICBjb25zdCBpZCA9IFN0cmluZyhjb250YWN0SWQpO1xyXG4gICAgaWYgKGlkID09PSBTdHJpbmcodGhpcy5hdXRoLmNvbnRhY3RJZCB8fCAnJykgJiYgdGhpcy5hdXRoLmN1cnJlbnRDb250YWN0KSB7XHJcbiAgICAgIHJldHVybiBnZXRDb250YWN0RGlzcGxheU5hbWUodGhpcy5hdXRoLmN1cnJlbnRDb250YWN0KTtcclxuICAgIH1cclxuICAgIGNvbnN0IGNvbnRhY3QgPSB0aGlzLnZpc2libGVDb250YWN0cyQudmFsdWUuZmluZCgoYykgPT4gU3RyaW5nKGMuY29udGFjdF9pZCkgPT09IGlkKTtcclxuICAgIHJldHVybiBjb250YWN0ID8gZ2V0Q29udGFjdERpc3BsYXlOYW1lKGNvbnRhY3QpIDogYFVzZXIgJHtpZH1gO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBkZXRlY3RHcm91cFJlbW92YWxGb3JDdXJyZW50VXNlcihtZXNzYWdlOiBNZXNzYWdlKTogdm9pZCB7XHJcbiAgICBjb25zdCBjb250ZW50ID0gU3RyaW5nKG1lc3NhZ2UuY29udGVudCB8fCAnJykudHJpbSgpO1xyXG4gICAgY29uc3QgbWF0Y2ggPSBjb250ZW50Lm1hdGNoKC9eKC4rKSByZW1vdmVkICguKykgZnJvbSB0aGUgZ3JvdXAkLyk7XHJcbiAgICBpZiAoIW1hdGNoKSByZXR1cm47XHJcblxyXG4gICAgY29uc3QgbXlDb250YWN0ID0gdGhpcy5hdXRoLmN1cnJlbnRDb250YWN0O1xyXG4gICAgY29uc3QgbXlOYW1lID0gbXlDb250YWN0ID8gZ2V0Q29udGFjdERpc3BsYXlOYW1lKG15Q29udGFjdCkudHJpbSgpLnRvTG93ZXJDYXNlKCkgOiAnJztcclxuICAgIGNvbnN0IHJlbW92ZWROYW1lID0gbWF0Y2hbMl0/LnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xyXG4gICAgaWYgKCFteU5hbWUgfHwgcmVtb3ZlZE5hbWUgIT09IG15TmFtZSkgcmV0dXJuO1xyXG5cclxuICAgIGNvbnN0IGNvbnZJZCA9IFN0cmluZyhtZXNzYWdlLmNvbnZlcnNhdGlvbl9pZCB8fCAnJyk7XHJcbiAgICBpZiAoY29udklkKSB7XHJcbiAgICAgIHRoaXMubWFya0dyb3VwUmVtb3ZlZChjb252SWQpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBoeWRyYXRlUmVhY3Rpb25zRm9yQ29udmVyc2F0aW9uKGNvbnZlcnNhdGlvbklkOiBzdHJpbmcsIG1lc3NhZ2VzOiBNZXNzYWdlW10sIG9ubHlNaXNzaW5nID0gZmFsc2UpOiB2b2lkIHtcclxuICAgIGNvbnN0IGZldGNoYWJsZSA9IG1lc3NhZ2VzLmZpbHRlcigobSkgPT4ge1xyXG4gICAgICBpZiAoIW0ubWVzc2FnZV9pZCB8fCBTdHJpbmcobS5tZXNzYWdlX2lkKS5zdGFydHNXaXRoKCd0ZW1wLScpKSByZXR1cm4gZmFsc2U7XHJcbiAgICAgIGlmICghb25seU1pc3NpbmcpIHJldHVybiB0cnVlO1xyXG4gICAgICByZXR1cm4gIUFycmF5LmlzQXJyYXkobS5yZWFjdGlvbnMpIHx8IG0ucmVhY3Rpb25zLmxlbmd0aCA9PT0gMDtcclxuICAgIH0pO1xyXG4gICAgaWYgKCFmZXRjaGFibGUubGVuZ3RoKSByZXR1cm47XHJcblxyXG4gICAgY29uc3Qgam9icyA9IGZldGNoYWJsZS5tYXAoKG0pID0+XHJcbiAgICAgIHRoaXMuYXBpLmdldFJlYWN0aW9ucyhtLm1lc3NhZ2VfaWQpLnBpcGUoXHJcbiAgICAgICAgbWFwKChyb3dzKSA9PiAoeyBtZXNzYWdlSWQ6IG0ubWVzc2FnZV9pZCwgcmVhY3Rpb25zOiB0aGlzLm5vcm1hbGl6ZVJlYWN0aW9uUm93cyhyb3dzKSB9KSksXHJcbiAgICAgICAgY2F0Y2hFcnJvcigoKSA9PiBvZih7IG1lc3NhZ2VJZDogbS5tZXNzYWdlX2lkLCByZWFjdGlvbnM6IFtdIH0pKVxyXG4gICAgICApXHJcbiAgICApO1xyXG5cclxuICAgIGZvcmtKb2luKGpvYnMpLnN1YnNjcmliZSgocmVzdWx0cykgPT4ge1xyXG4gICAgICBjb25zdCBtYXAgPSBuZXcgTWFwKHRoaXMubWVzc2FnZXNNYXAkLnZhbHVlKTtcclxuICAgICAgY29uc3QgY3VycmVudCA9IFsuLi4obWFwLmdldChjb252ZXJzYXRpb25JZCkgfHwgW10pXTtcclxuICAgICAgaWYgKCFjdXJyZW50Lmxlbmd0aCkgcmV0dXJuO1xyXG5cclxuICAgICAgbGV0IGNoYW5nZWQgPSBmYWxzZTtcclxuICAgICAgZm9yIChjb25zdCByZXN1bHQgb2YgcmVzdWx0cykge1xyXG4gICAgICAgIGNvbnN0IGlkeCA9IGN1cnJlbnQuZmluZEluZGV4KChtKSA9PiBTdHJpbmcobS5tZXNzYWdlX2lkKSA9PT0gU3RyaW5nKHJlc3VsdC5tZXNzYWdlSWQpKTtcclxuICAgICAgICBpZiAoaWR4ID09PSAtMSkgY29udGludWU7XHJcbiAgICAgICAgY3VycmVudFtpZHhdID0geyAuLi5jdXJyZW50W2lkeF0sIHJlYWN0aW9uczogcmVzdWx0LnJlYWN0aW9ucyB9O1xyXG4gICAgICAgIGNoYW5nZWQgPSB0cnVlO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBpZiAoY2hhbmdlZCkge1xyXG4gICAgICAgIG1hcC5zZXQoY29udmVyc2F0aW9uSWQsIGN1cnJlbnQpO1xyXG4gICAgICAgIHRoaXMubWVzc2FnZXNNYXAkLm5leHQobWFwKTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHJlZnJlc2hNZXNzYWdlUmVhY3Rpb25zKG1lc3NhZ2VJZDogc3RyaW5nKTogdm9pZCB7XHJcbiAgICBpZiAoIW1lc3NhZ2VJZCB8fCBTdHJpbmcobWVzc2FnZUlkKS5zdGFydHNXaXRoKCd0ZW1wLScpKSByZXR1cm47XHJcblxyXG4gICAgdGhpcy5hcGkuZ2V0UmVhY3Rpb25zKG1lc3NhZ2VJZCkuc3Vic2NyaWJlKHtcclxuICAgICAgbmV4dDogKHJvd3MpID0+IHtcclxuICAgICAgICBjb25zdCBub3JtYWxpemVkID0gdGhpcy5ub3JtYWxpemVSZWFjdGlvblJvd3Mocm93cyk7XHJcbiAgICAgICAgY29uc3QgbWFwID0gbmV3IE1hcCh0aGlzLm1lc3NhZ2VzTWFwJC52YWx1ZSk7XHJcbiAgICAgICAgbGV0IGNoYW5nZWQgPSBmYWxzZTtcclxuXHJcbiAgICAgICAgZm9yIChjb25zdCBbY29udmVyc2F0aW9uSWQsIG1zZ3NdIG9mIG1hcC5lbnRyaWVzKCkpIHtcclxuICAgICAgICAgIGNvbnN0IGlkeCA9IG1zZ3MuZmluZEluZGV4KChtKSA9PiBTdHJpbmcobS5tZXNzYWdlX2lkKSA9PT0gU3RyaW5nKG1lc3NhZ2VJZCkpO1xyXG4gICAgICAgICAgaWYgKGlkeCA9PT0gLTEpIGNvbnRpbnVlO1xyXG4gICAgICAgICAgY29uc3QgbmV4dE1zZ3MgPSBbLi4ubXNnc107XHJcbiAgICAgICAgICBuZXh0TXNnc1tpZHhdID0geyAuLi5uZXh0TXNnc1tpZHhdLCByZWFjdGlvbnM6IG5vcm1hbGl6ZWQgfTtcclxuICAgICAgICAgIG1hcC5zZXQoY29udmVyc2F0aW9uSWQsIG5leHRNc2dzKTtcclxuICAgICAgICAgIGNoYW5nZWQgPSB0cnVlO1xyXG4gICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoY2hhbmdlZCkge1xyXG4gICAgICAgICAgdGhpcy5tZXNzYWdlc01hcCQubmV4dChtYXApO1xyXG4gICAgICAgIH1cclxuICAgICAgfSxcclxuICAgICAgZXJyb3I6ICgpID0+IHt9LFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIG5vcm1hbGl6ZVJlYWN0aW9uUm93cyhyb3dzOiBhbnlbXSk6IGFueVtdIHtcclxuICAgIGNvbnN0IGJ5RW1vamkgPSBuZXcgTWFwPHN0cmluZywgeyBlbW9qaTogc3RyaW5nOyBjb3VudDogbnVtYmVyOyBoYXNSZWFjdGVkOiBib29sZWFuOyByZWFjdG9yczogc3RyaW5nW10gfT4oKTtcclxuICAgIGNvbnN0IG15Q29udGFjdElkID0gU3RyaW5nKHRoaXMuYXV0aC5jb250YWN0SWQgfHwgJycpO1xyXG4gICAgY29uc3QgY29udGFjdHMgPSB0aGlzLnZpc2libGVDb250YWN0cyQudmFsdWU7XHJcbiAgICBjb25zdCBwYXJzZVJlYWN0b3JzID0gKHZhbHVlOiBhbnkpOiBhbnlbXSA9PiB7XHJcbiAgICAgIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkgcmV0dXJuIHZhbHVlO1xyXG4gICAgICBpZiAodmFsdWUgJiYgdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JykgcmV0dXJuIFt2YWx1ZV07XHJcbiAgICAgIGlmICh0eXBlb2YgdmFsdWUgIT09ICdzdHJpbmcnIHx8ICF2YWx1ZS50cmltKCkpIHJldHVybiBbXTtcclxuXHJcbiAgICAgIGNvbnN0IHRyaW1tZWQgPSB2YWx1ZS50cmltKCk7XHJcbiAgICAgIGlmICh0cmltbWVkLnN0YXJ0c1dpdGgoJ3snKSB8fCB0cmltbWVkLnN0YXJ0c1dpdGgoJ1snKSkge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICBjb25zdCBwYXJzZWQgPSBKU09OLnBhcnNlKHRyaW1tZWQpO1xyXG4gICAgICAgICAgcmV0dXJuIEFycmF5LmlzQXJyYXkocGFyc2VkKSA/IHBhcnNlZCA6IFtwYXJzZWRdO1xyXG4gICAgICAgIH0gY2F0Y2gge1xyXG4gICAgICAgICAgcmV0dXJuIFt0cmltbWVkXTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIHJldHVybiB0cmltbWVkLnNwbGl0KCcsJykubWFwKCh4OiBzdHJpbmcpID0+IHgudHJpbSgpKS5maWx0ZXIoQm9vbGVhbik7XHJcbiAgICB9O1xyXG5cclxuICAgIGNvbnN0IGRpc3BsYXlOYW1lRm9yUmVhY3RvciA9IChyZWFjdG9yOiBhbnkpOiBzdHJpbmcgPT4ge1xyXG4gICAgICBpZiAocmVhY3RvciA9PSBudWxsKSByZXR1cm4gJyc7XHJcbiAgICAgIGlmICh0eXBlb2YgcmVhY3RvciA9PT0gJ3N0cmluZycpIHtcclxuICAgICAgICBjb25zdCB0cmltbWVkID0gcmVhY3Rvci50cmltKCk7XHJcbiAgICAgICAgaWYgKCF0cmltbWVkKSByZXR1cm4gJyc7XHJcbiAgICAgICAgaWYgKHRyaW1tZWQuc3RhcnRzV2l0aCgneycpIHx8IHRyaW1tZWQuc3RhcnRzV2l0aCgnWycpKSB7XHJcbiAgICAgICAgICBjb25zdCBwYXJzZWQgPSBwYXJzZVJlYWN0b3JzKHRyaW1tZWQpO1xyXG4gICAgICAgICAgcmV0dXJuIHBhcnNlZC5tYXAoZGlzcGxheU5hbWVGb3JSZWFjdG9yKS5maWx0ZXIoQm9vbGVhbikuam9pbignLCAnKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHRyaW1tZWQ7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGNvbnN0IHJlYWN0b3JJZCA9IFN0cmluZyhyZWFjdG9yPy5jb250YWN0X2lkID8/IHJlYWN0b3I/LmNvbnRhY3RJZCA/PyByZWFjdG9yPy5pZCA/PyAnJykudHJpbSgpO1xyXG4gICAgICBpZiAocmVhY3RvcklkICYmIHJlYWN0b3JJZCA9PT0gbXlDb250YWN0SWQpIHJldHVybiAnWW91JztcclxuXHJcbiAgICAgIGNvbnN0IGV4cGxpY2l0TmFtZSA9IFN0cmluZyhcclxuICAgICAgICByZWFjdG9yPy51c2VybmFtZSA/P1xyXG4gICAgICAgIHJlYWN0b3I/Lm5hbWUgPz9cclxuICAgICAgICByZWFjdG9yPy5kaXNwbGF5X25hbWUgPz9cclxuICAgICAgICByZWFjdG9yPy5kaXNwbGF5TmFtZSA/P1xyXG4gICAgICAgIHJlYWN0b3I/LmVtYWlsID8/XHJcbiAgICAgICAgJydcclxuICAgICAgKS50cmltKCk7XHJcbiAgICAgIGlmIChleHBsaWNpdE5hbWUpIHJldHVybiBleHBsaWNpdE5hbWU7XHJcblxyXG4gICAgICBpZiAocmVhY3RvcklkKSB7XHJcbiAgICAgICAgY29uc3QgY29udGFjdCA9IGNvbnRhY3RzLmZpbmQoYyA9PiBTdHJpbmcoYy5jb250YWN0X2lkKSA9PT0gcmVhY3RvcklkKTtcclxuICAgICAgICByZXR1cm4gY29udGFjdCA/IGdldENvbnRhY3REaXNwbGF5TmFtZShjb250YWN0KSA6IGBVc2VyICR7cmVhY3RvcklkfWA7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIHJldHVybiAnJztcclxuICAgIH07XHJcblxyXG4gICAgZm9yIChjb25zdCByb3cgb2Ygcm93cyB8fCBbXSkge1xyXG4gICAgICBjb25zdCBlbW9qaSA9IFN0cmluZyhyb3c/LmVtb2ppIHx8ICcnKS50cmltKCk7XHJcbiAgICAgIGlmICghZW1vamkpIGNvbnRpbnVlO1xyXG5cclxuICAgICAgY29uc3QgY29udGFjdElkID0gU3RyaW5nKHJvdz8uY29udGFjdF9pZCA/PyByb3c/LmNvbnRhY3RJZCA/PyAnJyk7XHJcbiAgICAgIGNvbnN0IGV4cGxpY2l0SGFzUmVhY3RlZCA9IHJvdz8uaGFzUmVhY3RlZCA/PyByb3c/Lmhhc19yZWFjdGVkO1xyXG4gICAgICBjb25zdCBoYXNSZWFjdGVkID0gZXhwbGljaXRIYXNSZWFjdGVkID09PSB0cnVlIHx8IChjb250YWN0SWQgJiYgY29udGFjdElkID09PSBteUNvbnRhY3RJZCk7XHJcblxyXG4gICAgICBjb25zdCByYXdSZWFjdG9ycyA9XHJcbiAgICAgICAgcm93Py5yZWFjdG9ycyA/P1xyXG4gICAgICAgIHJvdz8ucmVhY3Rvcl9uYW1lcyA/P1xyXG4gICAgICAgIHJvdz8ucmVhY3Rvck5hbWVzID8/XHJcbiAgICAgICAgcm93Py5yZWFjdGVkX2J5ID8/XHJcbiAgICAgICAgcm93Py5yZWFjdGVkQnkgPz9cclxuICAgICAgICByb3c/LnVzZXJzID8/XHJcbiAgICAgICAgW107XHJcbiAgICAgIGNvbnN0IHJlYWN0b3JSb3dzID0gcGFyc2VSZWFjdG9ycyhyYXdSZWFjdG9ycyk7XHJcbiAgICAgIGNvbnN0IGNvdW50RnJvbVJvdyA9IE51bWJlcihyb3c/LmNvdW50ID8/IHJvdz8ucmVhY3Rpb25fY291bnQgPz8gcm93Py5yZWFjdGlvbkNvdW50ID8/IHJlYWN0b3JSb3dzLmxlbmd0aCA/PyAwKTtcclxuICAgICAgY29uc3QgZXhpc3RpbmcgPSBieUVtb2ppLmdldChlbW9qaSkgfHwgeyBlbW9qaSwgY291bnQ6IDAsIGhhc1JlYWN0ZWQ6IGZhbHNlLCByZWFjdG9yczogW10gfTtcclxuXHJcbiAgICAgIC8vIFNvbWUgQVBJcyByZXR1cm4gb25lIHJvdyBwZXIgcmVhY3Rpb247IHNvbWUgcmV0dXJuIHByZS1hZ2dyZWdhdGVkIGNvdW50LlxyXG4gICAgICBleGlzdGluZy5jb3VudCArPSBjb3VudEZyb21Sb3cgPiAwID8gY291bnRGcm9tUm93IDogMTtcclxuICAgICAgZXhpc3RpbmcuaGFzUmVhY3RlZCA9IGV4aXN0aW5nLmhhc1JlYWN0ZWQgfHwgISFoYXNSZWFjdGVkO1xyXG5cclxuICAgICAgLy8gVHJhY2sgcmVhY3RvciBkaXNwbGF5IG5hbWVzIHdoZW4gaW5kaXZpZHVhbCBjb250YWN0SWQgaXMgYXZhaWxhYmxlXHJcbiAgICAgIGlmIChjb250YWN0SWQgJiYgY291bnRGcm9tUm93IDw9IDEpIHtcclxuICAgICAgICBsZXQgbmFtZTogc3RyaW5nO1xyXG4gICAgICAgIGlmIChjb250YWN0SWQgPT09IG15Q29udGFjdElkKSB7XHJcbiAgICAgICAgICBuYW1lID0gJ1lvdSc7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIGNvbnN0IGNvbnRhY3QgPSBjb250YWN0cy5maW5kKGMgPT4gU3RyaW5nKGMuY29udGFjdF9pZCkgPT09IGNvbnRhY3RJZCk7XHJcbiAgICAgICAgICBuYW1lID0gY29udGFjdCA/IGdldENvbnRhY3REaXNwbGF5TmFtZShjb250YWN0KSA6IGBVc2VyICR7Y29udGFjdElkfWA7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICghZXhpc3RpbmcucmVhY3RvcnMuaW5jbHVkZXMobmFtZSkpIHtcclxuICAgICAgICAgIGV4aXN0aW5nLnJlYWN0b3JzLnB1c2gobmFtZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcblxyXG4gICAgICBmb3IgKGNvbnN0IHJlYWN0b3Igb2YgcmVhY3RvclJvd3MpIHtcclxuICAgICAgICBjb25zdCByZWFjdG9ySWQgPSBTdHJpbmcoXHJcbiAgICAgICAgICB0eXBlb2YgcmVhY3RvciA9PT0gJ29iamVjdCdcclxuICAgICAgICAgICAgPyByZWFjdG9yPy5jb250YWN0X2lkID8/IHJlYWN0b3I/LmNvbnRhY3RJZCA/PyByZWFjdG9yPy5pZCA/PyAnJ1xyXG4gICAgICAgICAgICA6ICcnXHJcbiAgICAgICAgKS50cmltKCk7XHJcbiAgICAgICAgY29uc3QgbmFtZSA9IGRpc3BsYXlOYW1lRm9yUmVhY3RvcihyZWFjdG9yKTtcclxuICAgICAgICBpZiAocmVhY3RvcklkICYmIHJlYWN0b3JJZCA9PT0gbXlDb250YWN0SWQpIHtcclxuICAgICAgICAgIGV4aXN0aW5nLmhhc1JlYWN0ZWQgPSB0cnVlO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAobmFtZSAmJiAhZXhpc3RpbmcucmVhY3RvcnMuaW5jbHVkZXMobmFtZSkpIHtcclxuICAgICAgICAgIGV4aXN0aW5nLnJlYWN0b3JzLnB1c2gobmFtZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcblxyXG4gICAgICBjb25zdCBkaXJlY3ROYW1lID0gU3RyaW5nKFxyXG4gICAgICAgIHJvdz8ucmVhY3Rvcl9uYW1lID8/XHJcbiAgICAgICAgcm93Py5yZWFjdG9yTmFtZSA/P1xyXG4gICAgICAgIHJvdz8uY29udGFjdF9uYW1lID8/XHJcbiAgICAgICAgcm93Py5jb250YWN0TmFtZSA/P1xyXG4gICAgICAgIHJvdz8udXNlcm5hbWUgPz9cclxuICAgICAgICByb3c/LmVtYWlsID8/XHJcbiAgICAgICAgJydcclxuICAgICAgKS50cmltKCk7XHJcbiAgICAgIGlmIChkaXJlY3ROYW1lICYmICFleGlzdGluZy5yZWFjdG9ycy5pbmNsdWRlcyhkaXJlY3ROYW1lKSkge1xyXG4gICAgICAgIGV4aXN0aW5nLnJlYWN0b3JzLnB1c2goY29udGFjdElkID09PSBteUNvbnRhY3RJZCA/ICdZb3UnIDogZGlyZWN0TmFtZSk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGJ5RW1vamkuc2V0KGVtb2ppLCBleGlzdGluZyk7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIEFycmF5LmZyb20oYnlFbW9qaS52YWx1ZXMoKSkuZmlsdGVyKChyKSA9PiByLmNvdW50ID4gMCk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGFwcGx5UmVhY3Rpb25PcHRpbWlzdGljYWxseShtZXNzYWdlSWQ6IHN0cmluZywgZW1vamk6IHN0cmluZywgYWRkOiBib29sZWFuKTogdm9pZCB7XHJcbiAgICBjb25zdCBtYXAgPSBuZXcgTWFwKHRoaXMubWVzc2FnZXNNYXAkLnZhbHVlKTtcclxuICAgIGxldCBkaWRVcGRhdGUgPSBmYWxzZTtcclxuXHJcbiAgICBmb3IgKGNvbnN0IFtjb252ZXJzYXRpb25JZCwgbXNnc10gb2YgbWFwLmVudHJpZXMoKSkge1xyXG4gICAgICBjb25zdCBpZHggPSBtc2dzLmZpbmRJbmRleCgobSkgPT4gU3RyaW5nKG0ubWVzc2FnZV9pZCkgPT09IFN0cmluZyhtZXNzYWdlSWQpKTtcclxuICAgICAgaWYgKGlkeCA9PT0gLTEpIGNvbnRpbnVlO1xyXG5cclxuICAgICAgY29uc3QgdGFyZ2V0ID0gbXNnc1tpZHhdO1xyXG4gICAgICBjb25zdCBuZXh0UmVhY3Rpb25zID0gWy4uLih0YXJnZXQucmVhY3Rpb25zIHx8IFtdKV07XHJcbiAgICAgIGNvbnN0IHJJZHggPSBuZXh0UmVhY3Rpb25zLmZpbmRJbmRleCgocikgPT4gci5lbW9qaSA9PT0gZW1vamkpO1xyXG5cclxuICAgICAgaWYgKGFkZCkge1xyXG4gICAgICAgIGlmIChySWR4ID49IDApIHtcclxuICAgICAgICAgIGNvbnN0IGN1cnJlbnQgPSBuZXh0UmVhY3Rpb25zW3JJZHhdO1xyXG4gICAgICAgICAgaWYgKCFjdXJyZW50Lmhhc1JlYWN0ZWQpIHtcclxuICAgICAgICAgICAgY29uc3QgcmVhY3RvcnMgPSBBcnJheS5pc0FycmF5KGN1cnJlbnQucmVhY3RvcnMpID8gWy4uLmN1cnJlbnQucmVhY3RvcnNdIDogW107XHJcbiAgICAgICAgICAgIGlmICghcmVhY3RvcnMuaW5jbHVkZXMoJ1lvdScpKSByZWFjdG9ycy51bnNoaWZ0KCdZb3UnKTtcclxuICAgICAgICAgICAgbmV4dFJlYWN0aW9uc1tySWR4XSA9IHtcclxuICAgICAgICAgICAgICAuLi5jdXJyZW50LFxyXG4gICAgICAgICAgICAgIGhhc1JlYWN0ZWQ6IHRydWUsXHJcbiAgICAgICAgICAgICAgY291bnQ6IE51bWJlcihjdXJyZW50LmNvdW50IHx8IDApICsgMSxcclxuICAgICAgICAgICAgICByZWFjdG9ycyxcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgbmV4dFJlYWN0aW9ucy5wdXNoKHsgZW1vamksIGNvdW50OiAxLCBoYXNSZWFjdGVkOiB0cnVlLCByZWFjdG9yczogWydZb3UnXSB9KTtcclxuICAgICAgICB9XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgaWYgKHJJZHggPj0gMCkge1xyXG4gICAgICAgICAgY29uc3QgY3VycmVudCA9IG5leHRSZWFjdGlvbnNbcklkeF07XHJcbiAgICAgICAgICBjb25zdCBuZXh0Q291bnQgPSBNYXRoLm1heChOdW1iZXIoY3VycmVudC5jb3VudCB8fCAwKSAtIChjdXJyZW50Lmhhc1JlYWN0ZWQgPyAxIDogMCksIDApO1xyXG4gICAgICAgICAgaWYgKG5leHRDb3VudCA9PT0gMCkge1xyXG4gICAgICAgICAgICBuZXh0UmVhY3Rpb25zLnNwbGljZShySWR4LCAxKTtcclxuICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIG5leHRSZWFjdGlvbnNbcklkeF0gPSB7XHJcbiAgICAgICAgICAgICAgLi4uY3VycmVudCxcclxuICAgICAgICAgICAgICBoYXNSZWFjdGVkOiBmYWxzZSxcclxuICAgICAgICAgICAgICBjb3VudDogbmV4dENvdW50LFxyXG4gICAgICAgICAgICAgIHJlYWN0b3JzOiBBcnJheS5pc0FycmF5KGN1cnJlbnQucmVhY3RvcnMpXHJcbiAgICAgICAgICAgICAgICA/IGN1cnJlbnQucmVhY3RvcnMuZmlsdGVyKChuYW1lOiBzdHJpbmcpID0+IG5hbWUgIT09ICdZb3UnKVxyXG4gICAgICAgICAgICAgICAgOiBjdXJyZW50LnJlYWN0b3JzLFxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG5cclxuICAgICAgY29uc3QgdXBkYXRlZE1zZzogTWVzc2FnZSA9IHsgLi4udGFyZ2V0LCByZWFjdGlvbnM6IG5leHRSZWFjdGlvbnMgfTtcclxuICAgICAgY29uc3QgdXBkYXRlZE1zZ3MgPSBbLi4ubXNnc107XHJcbiAgICAgIHVwZGF0ZWRNc2dzW2lkeF0gPSB1cGRhdGVkTXNnO1xyXG4gICAgICBtYXAuc2V0KGNvbnZlcnNhdGlvbklkLCB1cGRhdGVkTXNncyk7XHJcbiAgICAgIGRpZFVwZGF0ZSA9IHRydWU7XHJcbiAgICAgIGJyZWFrO1xyXG4gICAgfVxyXG5cclxuICAgIGlmIChkaWRVcGRhdGUpIHtcclxuICAgICAgdGhpcy5tZXNzYWdlc01hcCQubmV4dChtYXApO1xyXG4gICAgfVxyXG4gIH1cclxufVxyXG4iXX0=