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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVzc2FnaW5nLXN0b3JlLnNlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvbGliL3NlcnZpY2VzL21lc3NhZ2luZy1zdG9yZS5zZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxVQUFVLEVBQWEsTUFBTSxlQUFlLENBQUM7QUFDdEQsT0FBTyxFQUFFLGVBQWUsRUFBRSxVQUFVLEVBQUUsT0FBTyxFQUFnQixRQUFRLEVBQUUsRUFBRSxFQUFFLE1BQU0sTUFBTSxDQUFDO0FBQ3hGLE9BQU8sRUFBRSxVQUFVLEVBQUUsR0FBRyxFQUFFLE1BQU0sZ0JBQWdCLENBQUM7QUFJakQsT0FBTyxFQUlMLHlCQUF5QixFQU16QixxQkFBcUIsRUFDckIsb0JBQW9CLEdBQ3JCLE1BQU0sNEJBQTRCLENBQUM7Ozs7O0FBR3BDLE1BQU0sT0FBTyxxQkFBcUI7SUF3RXRCO0lBQ0E7SUFDQTtJQXpFVix1QkFBdUI7SUFDZixNQUFNLEdBQUcsSUFBSSxlQUFlLENBQWMsRUFBRSxDQUFDLENBQUM7SUFDOUMsWUFBWSxHQUFHLElBQUksZUFBZSxDQUF5QixJQUFJLEdBQUcsRUFBRSxDQUFDLENBQUM7SUFDdEUsVUFBVSxHQUFHLElBQUksZUFBZSxDQUFlLEVBQUUsQ0FBQyxDQUFDO0lBQ25ELGdCQUFnQixHQUFHLElBQUksZUFBZSxDQUFZLEVBQUUsQ0FBQyxDQUFDO0lBQ3RELFVBQVUsR0FBRyxJQUFJLGVBQWUsQ0FBVSxLQUFLLENBQUMsQ0FBQztJQUNqRCxXQUFXLEdBQUcsSUFBSSxlQUFlLENBQW9GLE9BQU8sQ0FBQyxDQUFDO0lBQzlILFlBQVksR0FBRyxJQUFJLGVBQWUsQ0FDdkMsWUFBWSxDQUFDLE9BQU8sQ0FBQyx3QkFBd0IsQ0FBaUIsSUFBSSxPQUFPLENBQzNFLENBQUM7SUFDTSxxQkFBcUIsR0FBRyxJQUFJLGVBQWUsQ0FBZ0IsSUFBSSxDQUFDLENBQUM7SUFDakUsbUJBQW1CLEdBQUcsSUFBSSxlQUFlLENBQTJDLElBQUksQ0FBQyxDQUFDO0lBQzFGLFlBQVksR0FBRyxJQUFJLGVBQWUsQ0FBUyxDQUFDLENBQUMsQ0FBQztJQUM5QyxnQkFBZ0IsR0FBRyxJQUFJLGVBQWUsQ0FBVSxLQUFLLENBQUMsQ0FBQztJQUN2RCxjQUFjLEdBQUcsSUFBSSxlQUFlLENBQWtDLElBQUksQ0FBQyxDQUFDO0lBQzVFLFVBQVUsR0FBRyxJQUFJLGVBQWUsQ0FBb0MsRUFBRSxLQUFLLEVBQUUsR0FBRyxFQUFFLE1BQU0sRUFBRSxHQUFHLEVBQUUsQ0FBQyxDQUFDO0lBQ2pHLGtCQUFrQixHQUFHLElBQUksZUFBZSxDQUFVLEtBQUssQ0FBQyxDQUFDO0lBQ3pELGNBQWMsR0FBRyxJQUFJLGVBQWUsQ0FBVSxLQUFLLENBQUMsQ0FBQztJQUNyRCxtQkFBbUIsR0FBRyxJQUFJLGVBQWUsQ0FDL0MsTUFBTSxDQUFDLFlBQVksQ0FBQyxPQUFPLENBQUMsK0JBQStCLENBQUMsSUFBSSxNQUFNLENBQUMsQ0FDeEUsQ0FBQztJQUNNLG1CQUFtQixHQUFHLElBQUksZUFBZSxDQUMvQyxZQUFZLENBQUMsT0FBTyxDQUFDLCtCQUErQixDQUFDLEtBQUssTUFBTSxDQUNqRSxDQUFDO0lBQ00saUJBQWlCLEdBQUcsSUFBSSxlQUFlLENBQzdDLE1BQU0sQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDLDhCQUE4QixDQUFDLElBQUksR0FBRyxDQUFDLENBQ3BFLENBQUM7SUFDTSxjQUFjLEdBQUcsSUFBSSxlQUFlLENBQzFDLE1BQU0sQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDLDJCQUEyQixDQUFDLElBQUksR0FBRyxDQUFDLENBQ2pFLENBQUM7SUFDTSxNQUFNLEdBQUcsSUFBSSxlQUFlLENBQWlFLElBQUksQ0FBQyxDQUFDO0lBQ25HLGdCQUFnQixHQUFHLElBQUksZUFBZSxDQUFjLElBQUksR0FBRyxFQUFFLENBQUMsQ0FBQztJQUMvRCx1QkFBdUIsR0FBRyxJQUFJLGVBQWUsQ0FBYyxJQUFJLEdBQUcsRUFBRSxDQUFDLENBQUM7SUFDdEUsdUJBQXVCLEdBQUcsSUFBSSxlQUFlLENBQVMsQ0FBQyxDQUFDLENBQUM7SUFFakUsMkJBQTJCO0lBQ2xCLEtBQUssR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLFlBQVksRUFBRSxDQUFDO0lBQ25DLFdBQVcsR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLFlBQVksRUFBRSxDQUFDO0lBQy9DLFNBQVMsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLFlBQVksRUFBRSxDQUFDO0lBQzNDLGVBQWUsR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsWUFBWSxFQUFFLENBQUM7SUFDdkQsU0FBUyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsWUFBWSxFQUFFLENBQUM7SUFDM0MsVUFBVSxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsWUFBWSxFQUFFLENBQUM7SUFDN0Msb0JBQW9CLEdBQUcsSUFBSSxDQUFDLHFCQUFxQixDQUFDLFlBQVksRUFBRSxDQUFDO0lBQ2pFLFdBQVcsR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLFlBQVksRUFBRSxDQUFDO0lBQy9DLGVBQWUsR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsWUFBWSxFQUFFLENBQUM7SUFDaEUsUUFBUSxHQUF1QixJQUFJLFVBQVUsRUFBVSxDQUFDO0lBQy9DLGFBQWEsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLFlBQVksRUFBRSxDQUFDO0lBQ25ELFNBQVMsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLFlBQVksRUFBRSxDQUFDO0lBQzNDLGlCQUFpQixHQUFHLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxZQUFZLEVBQUUsQ0FBQztJQUMzRCxXQUFXLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxZQUFZLEVBQUUsQ0FBQztJQUMvQyxhQUFhLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxZQUFZLEVBQUUsQ0FBQztJQUNuRCxrQkFBa0IsR0FBRyxJQUFJLENBQUMsbUJBQW1CLENBQUMsWUFBWSxFQUFFLENBQUM7SUFDN0Qsa0JBQWtCLEdBQUcsSUFBSSxDQUFDLG1CQUFtQixDQUFDLFlBQVksRUFBRSxDQUFDO0lBQzdELGdCQUFnQixHQUFHLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxZQUFZLEVBQUUsQ0FBQztJQUN6RCxhQUFhLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxZQUFZLEVBQUUsQ0FBQztJQUNuRCxLQUFLLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxZQUFZLEVBQUUsQ0FBQztJQUNuQyxlQUFlLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLFlBQVksRUFBRSxDQUFDO0lBQ3ZELHNCQUFzQixHQUFHLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxZQUFZLEVBQUUsQ0FBQztJQUNyRSxzQkFBc0IsR0FBRyxJQUFJLENBQUMsdUJBQXVCLENBQUMsWUFBWSxFQUFFLENBQUM7SUFFdEUsS0FBSyxHQUF3QixJQUFJLENBQUM7SUFDbEMsUUFBUSxHQUFHLElBQUksT0FBTyxFQUFRLENBQUM7SUFDL0IsU0FBUyxHQUFRLElBQUksQ0FBQztJQUN0QixjQUFjLEdBQUcsSUFBSSxlQUFlLENBQWtELElBQUksQ0FBQyxDQUFDO0lBQzVGLHVCQUF1QixHQUFHLElBQUksR0FBRyxFQUFVLENBQUM7SUFDNUMsaUJBQWlCLEdBQUcsSUFBSSxHQUFHLEVBQVUsQ0FBQztJQUN0QyxVQUFVLEdBQVEsSUFBSSxDQUFDO0lBRXRCLGFBQWEsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLFlBQVksRUFBRSxDQUFDO0lBRTVELFlBQ1UsSUFBaUIsRUFDakIsR0FBd0IsRUFDeEIsU0FBb0M7UUFGcEMsU0FBSSxHQUFKLElBQUksQ0FBYTtRQUNqQixRQUFHLEdBQUgsR0FBRyxDQUFxQjtRQUN4QixjQUFTLEdBQVQsU0FBUyxDQUEyQjtRQUUzQyxJQUFZLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDO0lBQ2xELENBQUM7SUFFRCx1QkFBdUI7SUFDdkIsVUFBVTtRQUNSLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGVBQWUsRUFBRTtZQUFFLE9BQU87UUFFekMsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFVLENBQUM7UUFDdkMsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFXLENBQUM7UUFFekMsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO1FBQ2pCLElBQUksQ0FBQyxtQkFBbUIsRUFBRSxDQUFDO1FBRTNCLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLFNBQVMsRUFBRSxVQUFVLENBQUMsQ0FBQztRQUM5QyxJQUFJLENBQUMsZUFBZSxFQUFFLENBQUM7UUFDdkIsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO0lBQ3RCLENBQUM7SUFFRCxRQUFRO1FBQ04sSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO1FBQ25CLElBQUksSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO1lBQ3BCLFlBQVksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7WUFDOUIsSUFBSSxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUM7UUFDekIsQ0FBQztRQUNELElBQUksQ0FBQyxTQUFTLENBQUMsVUFBVSxFQUFFLENBQUM7UUFDNUIsSUFBSSxDQUFDLEtBQUssRUFBRSxXQUFXLEVBQUUsQ0FBQztRQUMxQixJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUNyQixJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxJQUFJLEdBQUcsRUFBRSxDQUFDLENBQUM7UUFDbEMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDekIsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDNUIsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDL0IsSUFBSSxDQUFDLHFCQUFxQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN0QyxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUMxQixJQUFJLENBQUMsdUJBQXVCLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDckMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLEtBQUssRUFBRSxDQUFDO1FBQy9CLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsSUFBSSxHQUFHLEVBQUUsQ0FBQyxDQUFDO1FBQ3RDLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxJQUFJLENBQUMsSUFBSSxHQUFHLEVBQUUsQ0FBQyxDQUFDO1FBQzdDLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDckMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDekIsQ0FBQztJQUVELG1FQUFtRTtJQUMzRCxZQUFZO1FBQ2xCLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztRQUNuQixJQUFJLENBQUMsU0FBUyxHQUFHLFdBQVcsQ0FBQyxHQUFHLEVBQUU7WUFDaEMsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO1FBQ25CLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQztJQUNaLENBQUM7SUFFTyxXQUFXO1FBQ2pCLElBQUksSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO1lBQ25CLGFBQWEsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7WUFDOUIsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUM7UUFDeEIsQ0FBQztJQUNILENBQUM7SUFFRCxXQUFXO1FBQ1QsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO1FBQ2hCLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDckIsSUFBSSxDQUFDLFFBQVEsQ0FBQyxRQUFRLEVBQUUsQ0FBQztJQUMzQixDQUFDO0lBRUQsdUJBQXVCO0lBQ3ZCLFdBQVcsQ0FBQyxPQUFnQixFQUFFLE9BQWdCO1FBQzVDLElBQUksT0FBTyxLQUFLLFNBQVMsSUFBSSxPQUFPLEtBQUssU0FBUyxFQUFFLENBQUM7WUFDbkQsSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLEVBQUUsT0FBTyxFQUFFLENBQUMsRUFBRSxPQUFPLEVBQUUsQ0FBQyxDQUFDO1FBQ3ZELENBQUM7UUFDRCxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDL0MsQ0FBQztJQUVELFNBQVMsQ0FBQyxPQUFnQixFQUFFLE9BQWdCO1FBQzFDLElBQUksT0FBTyxLQUFLLFNBQVMsSUFBSSxPQUFPLEtBQUssU0FBUyxFQUFFLENBQUM7WUFDbkQsSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLEVBQUUsT0FBTyxFQUFFLENBQUMsRUFBRSxPQUFPLEVBQUUsQ0FBQyxDQUFDO1FBQ3ZELENBQUM7UUFDRCxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUM3QixDQUFDO0lBRUQsVUFBVTtRQUNSLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQzlCLENBQUM7SUFFRCxZQUFZLENBQUMsS0FBYSxFQUFFLE1BQWM7UUFDeEMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLENBQUMsQ0FBQztRQUN4QyxZQUFZLENBQUMsT0FBTyxDQUFDLHNCQUFzQixFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ2xGLENBQUM7SUFFRCxZQUFZO1FBQ1YsTUFBTSxLQUFLLEdBQUcsWUFBWSxDQUFDLE9BQU8sQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO1FBQzNELElBQUksS0FBSyxFQUFFLENBQUM7WUFDVixJQUFJLENBQUM7Z0JBQ0gsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQztnQkFDakMsSUFBSSxNQUFNLENBQUMsS0FBSyxJQUFJLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQztvQkFDbEMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7b0JBQzdCLE9BQU8sTUFBTSxDQUFDO2dCQUNoQixDQUFDO1lBQ0gsQ0FBQztZQUFDLE1BQU0sQ0FBQyxDQUFBLENBQUM7UUFDWixDQUFDO1FBQ0QsT0FBTyxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQztJQUMvQixDQUFDO0lBRUQsaUJBQWlCO1FBQ2YsSUFBSSxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ3BELElBQUksSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUMxQixJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUM5QixDQUFDO0lBQ0gsQ0FBQztJQUVELGVBQWUsQ0FBQyxPQUFlLEVBQUUsT0FBZTtRQUM5QyxJQUFJLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUNsQyxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sRUFBRSxPQUFPLENBQUMsQ0FBQztRQUNuQyxDQUFDO0lBQ0gsQ0FBQztJQUVELE9BQU8sQ0FBQyxJQUF1RjtRQUM3RixJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUM5QixDQUFDO0lBRUQsaUJBQWlCO1FBQ2YsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxLQUFLLEtBQUssT0FBTyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQztRQUNwRSxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUM3QixZQUFZLENBQUMsT0FBTyxDQUFDLHdCQUF3QixFQUFFLElBQUksQ0FBQyxDQUFDO0lBQ3ZELENBQUM7SUFFRCxnQkFBZ0IsQ0FBQyxVQUFtQjtRQUNsQyxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUN2QyxDQUFDO0lBRUQscUJBQXFCLENBQUMsTUFBYztRQUNsQyxNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzVELElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDMUMsWUFBWSxDQUFDLE9BQU8sQ0FBQywrQkFBK0IsRUFBRSxNQUFNLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztRQUMxRSxJQUFJLFVBQVUsR0FBRyxDQUFDLElBQUksSUFBSSxDQUFDLG1CQUFtQixDQUFDLEtBQUssRUFBRSxDQUFDO1lBQ3JELElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUNwQyxDQUFDO0lBQ0gsQ0FBQztJQUVELHFCQUFxQixDQUFDLEtBQWM7UUFDbEMsSUFBSSxDQUFDLG1CQUFtQixDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUNyQyxZQUFZLENBQUMsT0FBTyxDQUFDLCtCQUErQixFQUFFLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0lBQ3ZFLENBQUM7SUFFRCxtQkFBbUIsQ0FBQyxLQUFhO1FBQy9CLE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDL0QsSUFBSSxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUN4QyxZQUFZLENBQUMsT0FBTyxDQUFDLDhCQUE4QixFQUFFLE1BQU0sQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO0lBQzNFLENBQUM7SUFFRCxnQkFBZ0IsQ0FBQyxLQUFhO1FBQzVCLE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDL0QsSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDckMsWUFBWSxDQUFDLE9BQU8sQ0FBQywyQkFBMkIsRUFBRSxNQUFNLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztJQUN4RSxDQUFDO0lBRUQscUJBQXFCO1FBQ25CLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUN2QyxDQUFDO0lBRUQsNkJBQTZCLENBQUMsT0FBZSxFQUFFLE9BQXdCLEVBQUUsY0FBd0I7UUFDL0YsTUFBTSxJQUFJLEdBQUcsTUFBTSxDQUFDLE9BQU8sSUFBSSxFQUFFLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUMxQyxNQUFNLFNBQVMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRTtZQUN4QyxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsa0JBQWtCLENBQUMsT0FBTyxDQUFDLENBQUM7WUFDL0MsTUFBTSxNQUFNLEdBQUcsQ0FBQyxLQUFLLENBQUMsV0FBVyxJQUFJLFNBQVMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDMUUsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxLQUFLLENBQUMsT0FBTyxJQUFJLEVBQUUsQ0FBQyxDQUFDO1lBQ3ZELE9BQU8sYUFBYSxNQUFNLFFBQVEsT0FBTyxPQUFPLElBQUksRUFBRSxDQUFDO1FBQ3pELENBQUMsQ0FBQyxFQUFFLENBQUM7UUFDTCxPQUFPLGNBQWMsQ0FBQyxDQUFDLENBQUMsR0FBRyx5QkFBeUIsR0FBRyxTQUFTLEVBQUUsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO0lBQ2pGLENBQUM7SUFFRCxrQkFBa0IsQ0FBQyxPQUFnQjtRQUNqQyxPQUFPO1lBQ0wsVUFBVSxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsVUFBVSxJQUFJLEVBQUUsQ0FBQztZQUM1QyxXQUFXLEVBQUUsb0JBQW9CLENBQUMsT0FBTyxDQUFDLEtBQUssU0FBUztnQkFDdEQsQ0FBQyxDQUFDLG9CQUFvQixDQUFDLE9BQU8sQ0FBQztnQkFDL0IsQ0FBQyxDQUFDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDO1lBQzlDLE9BQU8sRUFBRSxJQUFJLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxJQUFJLEVBQUUsQ0FBQyxDQUFDO1NBQzFELENBQUM7SUFDSixDQUFDO0lBRUQsU0FBUyxDQUFDLE9BQWUsRUFBRSxPQUFxQyxNQUFNLEVBQUUsVUFBVSxHQUFHLElBQUk7UUFDdkYsSUFBSSxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7WUFDcEIsWUFBWSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztZQUM5QixJQUFJLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQztRQUN6QixDQUFDO1FBQ0QsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztRQUNwQyxJQUFJLENBQUMsVUFBVSxHQUFHLFVBQVUsQ0FBQyxHQUFHLEVBQUU7WUFDaEMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDdkIsSUFBSSxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUM7UUFDekIsQ0FBQyxFQUFFLFVBQVUsQ0FBQyxDQUFDO0lBQ2pCLENBQUM7SUFFRCxjQUFjO1FBQ1osT0FBTyxJQUFJLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQztJQUNqQyxDQUFDO0lBRUQsY0FBYztJQUNkLFNBQVM7UUFDUCxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQztRQUN0QyxJQUFJLENBQUMsU0FBUztZQUFFLE9BQU87UUFFdkIsSUFBSSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLENBQUMsU0FBUyxDQUFDO1lBQ3JDLElBQUksRUFBRSxDQUFDLEtBQUssRUFBRSxFQUFFO2dCQUNkLE1BQU0sTUFBTSxHQUFHLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUU7b0JBQzlCLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxRQUFRLEtBQUssSUFBSSxJQUFLLElBQUksQ0FBQyxRQUFnQixLQUFLLE1BQU0sQ0FBQztvQkFDNUUsTUFBTSxjQUFjLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQztvQkFDcEQsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsb0JBQW9CLElBQUksRUFBRSxDQUFDLENBQUM7b0JBQ3BFLE1BQU0sVUFBVSxHQUNkLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLGNBQWMsQ0FBQzt3QkFDdEQsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFlBQVksSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksSUFBSSxDQUFDLDhCQUE4QixDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7b0JBRXZGLElBQUksQ0FBQyxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxJQUFJLElBQUksQ0FBQyxzQkFBc0IsRUFBRSxDQUFDO3dCQUMxRCxPQUFPLEVBQUUsR0FBRyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxzQkFBc0IsRUFBRSxvQkFBb0IsRUFBRSxPQUFPLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxXQUFXLEVBQUUsVUFBVSxFQUFFLENBQUM7b0JBQ2pJLENBQUM7b0JBQ0QsT0FBTyxFQUFFLEdBQUcsSUFBSSxFQUFFLG9CQUFvQixFQUFFLE9BQU8sRUFBRSxRQUFRLEVBQUUsT0FBTyxFQUFFLFdBQVcsRUFBRSxVQUFVLEVBQUUsQ0FBQztnQkFDaEcsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQ2YsQ0FBQyxJQUFJLENBQUMsdUJBQXVCLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLENBQUM7b0JBQy9ELENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUMvRCxDQUFDO2dCQUNGLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO2dCQUN6QixJQUFJLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQyxDQUFDO2dCQUUxQixNQUFNLEdBQUcsR0FBRyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsZUFBZSxDQUFDLENBQUM7Z0JBQ2pELElBQUksQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQ25DLENBQUM7WUFDRCxLQUFLLEVBQUUsR0FBRyxFQUFFLEdBQUUsQ0FBQztTQUNoQixDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQsaUJBQWlCO0lBQ2pCLG1CQUFtQjtRQUNqQixNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQztRQUN0QyxJQUFJLENBQUMsU0FBUztZQUFFLE9BQU87UUFFdkIsSUFBSSxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsQ0FBQyxTQUFTLENBQUMsQ0FBQyxTQUFTLENBQUM7WUFDL0MsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFLEVBQUU7Z0JBQ2pCLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7Z0JBRXJDLE1BQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDO2dCQUNoRCxJQUFJLGNBQWMsSUFBSSxjQUFjLENBQUMsS0FBSyxFQUFFLENBQUM7b0JBQzNDLE1BQU0sS0FBSyxHQUFHLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsS0FBSyxLQUFLLGNBQWMsQ0FBQyxLQUFLLENBQUMsQ0FBQztvQkFDbkUsSUFDRSxLQUFLO3dCQUNMLE1BQU0sQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLEtBQUssTUFBTSxDQUFDLGNBQWMsQ0FBQyxVQUFVLENBQUMsRUFDOUQsQ0FBQzt3QkFDRCxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVcsRUFBRSxFQUFFLEdBQUcsY0FBYyxFQUFFLFVBQVUsRUFBRSxLQUFLLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQzt3QkFFakcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxVQUFVLEVBQUUsQ0FBQzt3QkFDNUIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLFVBQVUsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVcsQ0FBQyxDQUFDO29CQUNsRSxDQUFDO2dCQUNILENBQUM7WUFDSCxDQUFDO1lBQ0QsS0FBSyxFQUFFLEdBQUcsRUFBRSxHQUFFLENBQUM7U0FDaEIsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVELHNCQUFzQjtJQUN0QixnQkFBZ0IsQ0FBQyxjQUFzQixFQUFFLElBQVksRUFBRSxPQUFPLEdBQUcsS0FBSztRQUNwRSxJQUFJLENBQUMsY0FBYyxJQUFJLGNBQWMsS0FBSyxXQUFXLEVBQUUsQ0FBQztZQUN0RCxPQUFPO1FBQ1QsQ0FBQztRQUNELElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUM7UUFDaEQsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDOUIsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO1FBRWpCLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDO1FBQ3BDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsY0FBYyxLQUFLLGNBQWMsQ0FBQyxFQUFFLENBQUM7WUFDNUQsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUM7Z0JBQ25CLEdBQUcsS0FBSztnQkFDUixFQUFFLGNBQWMsRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFLFdBQVcsRUFBRSxLQUFLLEVBQUUsV0FBVyxFQUFFLENBQUMsRUFBRTthQUN0RSxDQUFDLENBQUM7UUFDTCxDQUFDO1FBRUQsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLGNBQWMsQ0FBQyxDQUFDO1FBQzdELElBQUksQ0FBQyxRQUFRLElBQUksUUFBUSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQztZQUN2QyxJQUFJLENBQUMsWUFBWSxDQUFDLGNBQWMsQ0FBQyxDQUFDO1FBQ3BDLENBQUM7UUFDRCxJQUFJLENBQUMsVUFBVSxDQUFDLGNBQWMsQ0FBQyxDQUFDO1FBQ2hDLElBQUksQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLGNBQWMsQ0FBQyxDQUFDO0lBQzNDLENBQUM7SUFFRCxTQUFTLENBQUMsY0FBc0I7UUFDOUIsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsY0FBYyxLQUFLLGNBQWMsQ0FBQyxDQUFDO1FBQ3ZGLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBRTVCLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxLQUFLLENBQUMsS0FBSyxNQUFNLENBQUMsY0FBYyxDQUFDLEVBQUUsQ0FBQztZQUN4RSxJQUFJLENBQUMscUJBQXFCLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ3RDLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ2pDLENBQUM7SUFDSCxDQUFDO0lBRUQsZ0JBQWdCLENBQUMsY0FBc0I7UUFDckMsTUFBTSxFQUFFLEdBQUcsTUFBTSxDQUFDLGNBQWMsQ0FBQyxDQUFDO1FBQ2xDLElBQUksQ0FBQyxFQUFFLElBQUksRUFBRSxLQUFLLFdBQVc7WUFBRSxPQUFPO1FBRXRDLE1BQU0sSUFBSSxHQUFHLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUNsRCxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQ2IsSUFBSSxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUVqQyxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLGVBQWUsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDO1FBQzlFLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ3hCLElBQUksQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLENBQUM7UUFFekIsSUFBSSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQztZQUNwQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1lBQy9CLElBQUksQ0FBQyxTQUFTLENBQUMsa0NBQWtDLEVBQUUsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ25FLENBQUM7SUFDSCxDQUFDO0lBRUQsZ0JBQWdCLENBQUMsY0FBc0I7UUFDckMsTUFBTSxFQUFFLEdBQUcsTUFBTSxDQUFDLGNBQWMsQ0FBQyxDQUFDO1FBQ2xDLE1BQU0sSUFBSSxHQUFHLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUNsRCxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQ2hCLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDakMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUNsQyxJQUFJLENBQUMsd0JBQXdCLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDcEMsQ0FBQztJQUVELGlCQUFpQjtJQUNqQixZQUFZLENBQUMsY0FBc0IsRUFBRSxlQUF3QixFQUFFLHFCQUFxQixHQUFHLEtBQUs7UUFDMUYsSUFBSSxDQUFDLGNBQWMsSUFBSSxjQUFjLEtBQUssV0FBVyxFQUFFLENBQUM7WUFDdEQsT0FBTztRQUNULENBQUM7UUFDRCxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQztRQUN0QyxJQUFJLENBQUMsU0FBUztZQUFFLE9BQU87UUFFdkIsSUFBSSxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUVqQyxJQUFJLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxjQUFjLEVBQUUsU0FBUyxFQUFFLGVBQWUsRUFBRSxFQUFFLENBQUMsQ0FBQyxTQUFTLENBQUM7WUFDN0UsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFLEVBQUU7Z0JBQ2pCLE1BQU0sR0FBRyxHQUFHLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBQzdDLE1BQU0sUUFBUSxHQUFHLEdBQUcsQ0FBQyxHQUFHLENBQUMsY0FBYyxDQUFDLElBQUksRUFBRSxDQUFDO2dCQUUvQyxNQUFNLFVBQVUsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBTSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMscUJBQXFCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDM0UsTUFBTSxNQUFNLEdBQUcsQ0FBQyxHQUFHLFVBQVUsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUMzQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsT0FBTyxFQUFFLEdBQUcsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUNwRSxDQUFDO2dCQUNGLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxnQ0FBZ0MsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUVoRSxNQUFNLFlBQVksR0FBRyxJQUFJLEdBQUcsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFFM0UsSUFBSSxlQUFlLEVBQUUsQ0FBQztvQkFDcEIsd0RBQXdEO29CQUN4RCxNQUFNLE1BQU0sR0FBRyxDQUFDLEdBQUcsTUFBTSxFQUFFLEdBQUcsUUFBUSxDQUFDLENBQUM7b0JBQ3hDLEdBQUcsQ0FBQyxHQUFHLENBQUMsY0FBYyxFQUFFLE1BQU0sQ0FBQyxDQUFDO2dCQUNsQyxDQUFDO3FCQUFNLENBQUM7b0JBQ04saUZBQWlGO29CQUNqRix1RkFBdUY7b0JBQ3ZGLE1BQU0sTUFBTSxHQUFHLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUU7d0JBQzVCLE1BQU0sTUFBTSxHQUFHLFlBQVksQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO3dCQUN0RCxJQUFJLENBQUMsTUFBTTs0QkFBRSxPQUFPLENBQUMsQ0FBQzt3QkFDdEIsT0FBTyxJQUFJLENBQUMsdUJBQXVCLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO29CQUNqRCxDQUFDLENBQUMsQ0FBQztvQkFDSCxHQUFHLENBQUMsR0FBRyxDQUFDLGNBQWMsRUFBRSxNQUFNLENBQUMsQ0FBQztnQkFDbEMsQ0FBQztnQkFFRCxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFDNUIsSUFBSSxDQUFDLCtCQUErQixDQUNsQyxjQUFjLEVBQ2QsR0FBRyxDQUFDLEdBQUcsQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLEVBQzdCLHFCQUFxQixDQUN0QixDQUFDO2dCQUNGLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDcEMsQ0FBQztZQUNELEtBQUssRUFBRSxHQUFHLEVBQUU7Z0JBQ1YsSUFBSSxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUNwQyxDQUFDO1NBQ0YsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVELFdBQVcsQ0FDVCxjQUE2QixFQUM3QixPQUFlLEVBQ2YsY0FBMkMsTUFBTSxFQUNqRCxPQUFxRjtRQUVyRixNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQztRQUN0QyxJQUFJLENBQUMsU0FBUztZQUFFLE9BQU87UUFFdkIsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLG1CQUFtQixDQUFDLEtBQUssQ0FBQztRQUMvQyxJQUFJLENBQUMsY0FBYyxJQUFJLE9BQU8sRUFBRSxDQUFDO1lBQy9CLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxPQUFPLENBQUMsU0FBUyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1lBQ25ELElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDcEMsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLGNBQWMsS0FBSyxTQUFTLENBQUMsQ0FBQztZQUNoRixJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUM1QixPQUFPO1FBQ1QsQ0FBQztRQUVELElBQUksQ0FBQyxjQUFjO1lBQUUsT0FBTztRQUU1QixNQUFNLGVBQWUsR0FBRyxJQUFJLENBQUMsNkJBQTZCLENBQUMsT0FBTyxFQUFFLE9BQU8sRUFBRSxPQUFPLElBQUksSUFBSSxFQUFFLE9BQU8sRUFBRSxjQUFjLENBQUMsQ0FBQztRQUN2SCxNQUFNLE9BQU8sR0FBRyxPQUFPLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7UUFDeEYsTUFBTSxhQUFhLEdBQUcsT0FBTyxHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztRQUMzQyxNQUFNLFVBQVUsR0FBWTtZQUMxQixVQUFVLEVBQUUsYUFBYTtZQUN6QixlQUFlLEVBQUUsY0FBYztZQUMvQixTQUFTLEVBQUUsU0FBUztZQUNwQixXQUFXLEVBQUUsS0FBSztZQUNsQixZQUFZLEVBQUUsV0FBVztZQUN6QixPQUFPO1lBQ1AsUUFBUSxFQUFFLE9BQU87WUFDakIsUUFBUSxFQUFFLE9BQU8sRUFBRSxRQUFRO1lBQzNCLG9CQUFvQixFQUFFLE9BQU8sRUFBRSxjQUFjO1lBQzdDLFVBQVUsRUFBRSxJQUFJLElBQUksRUFBRSxDQUFDLFdBQVcsRUFBRTtZQUNwQyxPQUFPLEVBQUUsS0FBSztTQUNmLENBQUM7UUFDRixJQUFJLENBQUMsYUFBYSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBRS9CLElBQUksQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLGNBQWMsRUFBRSxTQUFTLEVBQUUsZUFBZSxFQUFFLFdBQVcsQ0FBQyxDQUFDLFNBQVMsQ0FBQztZQUN0RixJQUFJLEVBQUUsQ0FBQyxHQUFHLEVBQUUsRUFBRTtnQkFDWixNQUFNLE1BQU0sR0FBRyxHQUFHLEVBQUUsVUFBVSxJQUFJLEdBQUcsRUFBRSxFQUFFLElBQUksR0FBRyxFQUFFLFNBQVMsQ0FBQztnQkFDNUQsSUFBSSxNQUFNLElBQUksSUFBSSxJQUFJLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztvQkFDekQsT0FBTztnQkFDVCxDQUFDO2dCQUNELE1BQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxHQUFHLEVBQUUsZUFBZSxJQUFJLFVBQVUsQ0FBQyxPQUFPLENBQUMsQ0FBQztnQkFDM0YsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLHFCQUFxQixDQUFDO29CQUN4QyxHQUFHLFVBQVU7b0JBQ2IsR0FBRyxHQUFHO29CQUNOLFVBQVUsRUFBRSxNQUFNLENBQUMsTUFBTSxDQUFDO29CQUMxQixlQUFlLEVBQUUsY0FBYztvQkFDL0IsWUFBWSxFQUFFLFdBQVcsS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLFlBQVksSUFBSSxVQUFVLENBQUMsWUFBWTtvQkFDaEcsT0FBTyxFQUFFLGFBQWE7b0JBQ3RCLFFBQVEsRUFBRSxPQUFPLElBQUksR0FBRyxFQUFFLFFBQVE7b0JBQ2xDLFFBQVEsRUFBRSxPQUFPLEVBQUUsUUFBUSxJQUFJLEdBQUcsRUFBRSxRQUFRO29CQUM1QyxvQkFBb0IsRUFBRSxPQUFPLEVBQUUsY0FBYztpQkFDOUMsQ0FBQyxDQUFDO2dCQUNILE1BQU0sR0FBRyxHQUFHLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBQzdDLE1BQU0sSUFBSSxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsY0FBYyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQztnQkFDbEQsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLFVBQVUsS0FBSyxhQUFhLENBQUMsQ0FBQztnQkFDbEUsSUFBSSxHQUFHLElBQUksQ0FBQyxFQUFFLENBQUM7b0JBQ2IsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLE1BQU0sQ0FBQztvQkFDbkIsR0FBRyxDQUFDLEdBQUcsQ0FBQyxjQUFjLEVBQUUsSUFBSSxDQUFDLDJCQUEyQixDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7b0JBQ2hFLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO29CQUM1QixJQUFJLENBQUMsdUJBQXVCLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxDQUFDO2dCQUNsRCxDQUFDO1lBQ0gsQ0FBQztZQUNELEtBQUssRUFBRSxHQUFHLEVBQUUsR0FBRSxDQUFDO1NBQ2hCLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRCxzQkFBc0IsQ0FBQyxrQkFBMEIsRUFBRSxXQUFtQjtRQUNwRSxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FDN0MsQ0FBQyxJQUFJLENBQUMsUUFBUSxJQUFJLElBQUksQ0FBQyxJQUFJLEtBQUssV0FBVyxDQUM1QyxDQUFDO1FBRUYsSUFBSSxRQUFRLEVBQUUsQ0FBQztZQUNiLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDcEMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLFFBQVEsQ0FBQyxlQUFlLEVBQUUsV0FBVyxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQ3RFLENBQUM7YUFBTSxDQUFDO1lBQ04sSUFBSSxDQUFDLG1CQUFtQixDQUFDLElBQUksQ0FBQyxFQUFDLFNBQVMsRUFBRSxrQkFBa0IsRUFBRSxJQUFJLEVBQUUsV0FBVyxFQUFDLENBQUMsQ0FBQztZQUNsRixJQUFJLENBQUMscUJBQXFCLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ3RDLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBQzlCLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQztZQUVqQixNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQztZQUNwQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxjQUFjLEtBQUssU0FBUyxDQUFDLEVBQUUsQ0FBQztnQkFDckQsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLEtBQUssRUFBRTt3QkFDOUIsY0FBYyxFQUFFLFNBQVM7d0JBQ3pCLElBQUksRUFBRSxXQUFXO3dCQUNqQixPQUFPLEVBQUUsS0FBSzt3QkFDZCxXQUFXLEVBQUUsS0FBSzt3QkFDbEIsV0FBVyxFQUFFLENBQUM7cUJBQ2YsQ0FBQyxDQUFDLENBQUM7WUFDTixDQUFDO1FBQ0gsQ0FBQztJQUNILENBQUM7SUFFRCxpQkFBaUIsQ0FBQyxrQkFBMEIsRUFBRSxPQUFlO1FBQzNELE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDO1FBQ3RDLElBQUksQ0FBQyxTQUFTO1lBQUUsT0FBTztRQUV2QixJQUFJLENBQUMsR0FBRyxDQUFDLGlCQUFpQixDQUFDLFNBQVMsRUFBRSxrQkFBa0IsRUFBRSxPQUFPLENBQUMsQ0FBQyxTQUFTLENBQUM7WUFDM0UsSUFBSSxFQUFFLENBQUMsR0FBRyxFQUFFLEVBQUU7Z0JBQ1osSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO2dCQUNqQiw0REFBNEQ7Z0JBQzVELE1BQU0sTUFBTSxHQUFHLE1BQU0sQ0FBQyxHQUFHLEVBQUUsZUFBZSxJQUFJLEdBQUcsRUFBRSxFQUFFLElBQUksR0FBRyxFQUFFLGNBQWMsSUFBSSxFQUFFLENBQUMsQ0FBQztnQkFDcEYsSUFBSSxNQUFNLEVBQUUsQ0FBQztvQkFDWCxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLElBQUksQ0FDaEQsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxVQUFVLEtBQUssa0JBQWtCLENBQzNDLENBQUM7b0JBQ0YsTUFBTSxJQUFJLEdBQUcsU0FBUyxDQUFDLENBQUMsQ0FBQyxxQkFBcUIsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsZ0JBQWdCLENBQUM7b0JBQzdFLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxNQUFNLEVBQUUsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDO2dCQUM3QyxDQUFDO1lBQ0gsQ0FBQztZQUNELEtBQUssRUFBRSxHQUFHLEVBQUUsR0FBRSxDQUFDO1NBQ2hCLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRCx1QkFBdUIsQ0FDckIsY0FBd0IsRUFDeEIsSUFBWSxFQUNaLFNBQXdEO1FBRXhELE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDO1FBQ3RDLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQztZQUNmLFNBQVMsRUFBRSxLQUFLLEVBQUUsRUFBRSxDQUFDO1lBQ3JCLE9BQU87UUFDVCxDQUFDO1FBRUQsTUFBTSxlQUFlLEdBQUcsY0FBYyxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUM7WUFDeEQsQ0FBQyxDQUFDLGNBQWM7WUFDaEIsQ0FBQyxDQUFDLENBQUMsU0FBUyxFQUFFLEdBQUcsY0FBYyxDQUFDLENBQUM7UUFFbkMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsQ0FBQyxTQUFTLEVBQUUsZUFBZSxFQUFFLElBQUksQ0FBQyxDQUFDLFNBQVMsQ0FBQztZQUN0RSxJQUFJLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRTtnQkFDYiw0REFBNEQ7Z0JBQzVELE1BQU0sTUFBTSxHQUFHLE1BQU0sQ0FDbkIsT0FBTyxJQUFJLEtBQUssUUFBUSxJQUFJLE9BQU8sSUFBSSxLQUFLLFFBQVE7b0JBQ2xELENBQUMsQ0FBQyxJQUFJO29CQUNOLENBQUMsQ0FBRSxJQUFZLEVBQUUsZUFBZSxJQUFLLElBQVksRUFBRSxFQUFFLElBQUssSUFBWSxFQUFFLGNBQWMsSUFBSSxFQUFFLENBQy9GLENBQUM7Z0JBQ0YsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO29CQUNaLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQztvQkFDakIsU0FBUyxFQUFFLEtBQUssRUFBRSxFQUFFLENBQUM7b0JBQ3JCLE9BQU87Z0JBQ1QsQ0FBQztnQkFDRCxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7Z0JBQ2pCLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO2dCQUMxQixJQUFJLENBQUMsZ0JBQWdCLENBQUMsTUFBTSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztnQkFDMUMsU0FBUyxFQUFFLE9BQU8sRUFBRSxFQUFFLENBQUM7WUFDekIsQ0FBQztZQUNELEtBQUssRUFBRSxHQUFHLEVBQUU7Z0JBQ1YsU0FBUyxFQUFFLEtBQUssRUFBRSxFQUFFLENBQUM7WUFDdkIsQ0FBQztTQUNGLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRCxpQkFBaUIsQ0FBQyxjQUFzQixFQUFFLElBQVk7UUFDcEQsSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsRUFBRSxjQUFjLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztRQUNuRCxJQUFJLENBQUMsT0FBTyxDQUFDLGVBQWUsQ0FBQyxDQUFDO0lBQ2hDLENBQUM7SUFFRCxrQkFBa0I7UUFDaEIsSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDakMsQ0FBQztJQUVELFVBQVUsQ0FBQyxjQUFzQjtRQUMvQixJQUFJLENBQUMsY0FBYyxJQUFJLGNBQWMsS0FBSyxXQUFXO1lBQUUsT0FBTztRQUM5RCxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQztRQUN0QyxJQUFJLENBQUMsU0FBUztZQUFFLE9BQU87UUFFdkIsSUFBSSxDQUFDLEdBQUcsQ0FBQyxvQkFBb0IsQ0FBQyxjQUFjLEVBQUUsU0FBUyxDQUFDLENBQUMsU0FBUyxDQUFDO1lBQ2pFLElBQUksRUFBRSxHQUFHLEVBQUU7Z0JBQ1QsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FDM0MsSUFBSSxDQUFDLGVBQWUsS0FBSyxjQUFjLENBQUMsQ0FBQyxDQUFDLEVBQUUsR0FBRyxJQUFJLEVBQUUsWUFBWSxFQUFFLENBQUMsRUFBRSxXQUFXLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FDbEcsQ0FBQztnQkFDRixJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztnQkFDeEIsSUFBSSxDQUFDLFlBQVksQ0FBQyxLQUFLLENBQUMsQ0FBQztnQkFDekIsSUFBSSxDQUFDLHNCQUFzQixDQUFDLGNBQWMsRUFBRSxLQUFLLENBQUMsQ0FBQztZQUNyRCxDQUFDO1lBQ0QsS0FBSyxFQUFFLEdBQUcsRUFBRSxHQUFFLENBQUM7U0FDaEIsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVELHlCQUF5QjtJQUN6QixXQUFXLENBQ1QsTUFBOEMsRUFDOUMsY0FBdUIsRUFDdkIsU0FBa0IsRUFDbEIscUJBQWdDLEVBQ2hDLFNBQXdEO1FBRXhELE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDO1FBQ3RDLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQztZQUNmLFNBQVMsRUFBRSxLQUFLLEVBQUUsRUFBRSxDQUFDO1lBQ3JCLE9BQU87UUFDVCxDQUFDO1FBRUQsSUFBSSxNQUFNLEtBQUssUUFBUSxJQUFJLGNBQWMsSUFBSSxxQkFBcUIsRUFBRSxNQUFNLEVBQUUsQ0FBQztZQUMzRSxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsa0JBQWtCLENBQUMsU0FBUyxDQUFDLENBQUM7WUFDckQsTUFBTSxVQUFVLEdBQUcscUJBQXFCLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FDbEQsSUFBSSxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQ2xCLGNBQWMsRUFDZCxTQUFTLEVBQ1QsR0FBRyxTQUFTLFlBQVksSUFBSSxDQUFDLGtCQUFrQixDQUFDLEVBQUUsQ0FBQyxpQkFBaUIsRUFDcEUsUUFBUSxDQUNULENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUNuQyxDQUFDO1lBQ0YsTUFBTSxVQUFVLEdBQUcscUJBQXFCLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FDbEQsSUFBSSxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsRUFBRSxFQUFFLE1BQU0sRUFBRSxjQUFjLEVBQUUsU0FBUyxDQUFDLENBQzVELENBQUM7WUFFRixRQUFRLENBQUMsVUFBVSxDQUFDLENBQUMsU0FBUyxDQUFDO2dCQUM3QixJQUFJLEVBQUUsR0FBRyxFQUFFO29CQUNULFFBQVEsQ0FBQyxVQUFVLENBQUMsQ0FBQyxTQUFTLENBQUM7d0JBQzdCLElBQUksRUFBRSxHQUFHLEVBQUU7NEJBQ1QsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDOzRCQUNqQixJQUFJLENBQUMsNEJBQTRCLEVBQUUsQ0FBQzs0QkFDcEMsU0FBUyxFQUFFLE9BQU8sRUFBRSxFQUFFLENBQUM7d0JBQ3pCLENBQUM7d0JBQ0QsS0FBSyxFQUFFLEdBQUcsRUFBRTs0QkFDVixTQUFTLEVBQUUsS0FBSyxFQUFFLEVBQUUsQ0FBQzt3QkFDdkIsQ0FBQztxQkFDRixDQUFDLENBQUM7Z0JBQ0wsQ0FBQztnQkFDRCxLQUFLLEVBQUUsR0FBRyxFQUFFO29CQUNWLFNBQVMsRUFBRSxLQUFLLEVBQUUsRUFBRSxDQUFDO2dCQUN2QixDQUFDO2FBQ0YsQ0FBQyxDQUFDO1lBQ0gsT0FBTztRQUNULENBQUM7UUFFRCxJQUFJLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxTQUFTLEVBQUUsTUFBTSxFQUFFLGNBQWMsRUFBRSxTQUFTLEVBQUUscUJBQXFCLENBQUMsQ0FBQyxTQUFTLENBQUM7WUFDbEcsSUFBSSxFQUFFLEdBQUcsRUFBRTtnQkFDVCxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7Z0JBQ2pCLElBQUksTUFBTSxLQUFLLEtBQUssSUFBSSxjQUFjLElBQUkscUJBQXFCLEVBQUUsTUFBTSxFQUFFLENBQUM7b0JBQ3hFLElBQUksQ0FBQyw0QkFBNEIsRUFBRSxDQUFDO29CQUNwQyxNQUFNLFVBQVUsR0FBRyxxQkFBcUIsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO29CQUNsRixNQUFNLElBQUksR0FBRyxHQUFHLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxTQUFTLENBQUMsVUFBVSxVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUM7b0JBQ2pHLElBQUksQ0FBQyxXQUFXLENBQUMsY0FBYyxFQUFFLElBQUksRUFBRSxRQUFRLENBQUMsQ0FBQztnQkFDbkQsQ0FBQztnQkFDRCxTQUFTLEVBQUUsT0FBTyxFQUFFLEVBQUUsQ0FBQztZQUN6QixDQUFDO1lBQ0QsS0FBSyxFQUFFLEdBQUcsRUFBRTtnQkFDVixTQUFTLEVBQUUsS0FBSyxFQUFFLEVBQUUsQ0FBQztZQUN2QixDQUFDO1NBQ0YsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVELHVCQUF1QjtJQUN2QixrQkFBa0IsQ0FBQyxjQUFzQjtRQUN2QyxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQztRQUN0QyxJQUFJLENBQUMsU0FBUztZQUFFLE9BQU87UUFFdkIsSUFBSSxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsQ0FBQyxjQUFjLEVBQUUsU0FBUyxDQUFDLENBQUMsU0FBUyxDQUFDO1lBQy9ELElBQUksRUFBRSxHQUFHLEVBQUU7Z0JBQ1QsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLGVBQWUsS0FBSyxjQUFjLENBQUMsQ0FBQztnQkFDbEYsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBQ3hCLElBQUksQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBQ3pCLE1BQU0sR0FBRyxHQUFHLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBQzdDLEdBQUcsQ0FBQyxNQUFNLENBQUMsY0FBYyxDQUFDLENBQUM7Z0JBQzNCLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUM1QixJQUFJLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxLQUFLLEtBQUssY0FBYyxFQUFFLENBQUM7b0JBQ3hELElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7b0JBQ3RDLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO2dCQUNqQyxDQUFDO2dCQUNELElBQUksQ0FBQyxTQUFTLENBQUMsY0FBYyxDQUFDLENBQUM7WUFDakMsQ0FBQztZQUNELEtBQUssRUFBRSxHQUFHLEVBQUUsR0FBRSxDQUFDO1NBQ2hCLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRCxpQkFBaUIsQ0FBQyxjQUFzQjtRQUN0QyxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQztRQUN0QyxJQUFJLENBQUMsU0FBUztZQUFFLE9BQU87UUFFdkIsSUFBSSxDQUFDLEdBQUcsQ0FBQyxpQkFBaUIsQ0FBQyxjQUFjLEVBQUUsU0FBUyxDQUFDLENBQUMsU0FBUyxDQUFDO1lBQzlELElBQUksRUFBRSxHQUFHLEVBQUU7Z0JBQ1QsTUFBTSxHQUFHLEdBQUcsSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxLQUFLLENBQUMsQ0FBQztnQkFDN0MsR0FBRyxDQUFDLEdBQUcsQ0FBQyxjQUFjLEVBQUUsRUFBRSxDQUFDLENBQUM7Z0JBQzVCLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUM1QixNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FDdEMsQ0FBQyxDQUFDLGVBQWUsS0FBSyxjQUFjO29CQUNsQyxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsRUFBRSxvQkFBb0IsRUFBRSxFQUFFLEVBQUUsZUFBZSxFQUFFLENBQUMsQ0FBQyxlQUFlLEVBQUU7b0JBQ3hFLENBQUMsQ0FBQyxDQUFDLENBQ04sQ0FBQztnQkFDRixJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUMxQixDQUFDO1lBQ0QsS0FBSyxFQUFFLEdBQUcsRUFBRSxHQUFFLENBQUM7U0FDaEIsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVELFdBQVcsQ0FBQyxjQUFzQixFQUFFLFNBQXdEO1FBQzFGLE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDO1FBQ3RDLElBQUksQ0FBQyxTQUFTLElBQUksSUFBSSxDQUFDLHVCQUF1QixDQUFDLEdBQUcsQ0FBQyxjQUFjLENBQUMsRUFBRSxDQUFDO1lBQ25FLFNBQVMsRUFBRSxLQUFLLEVBQUUsRUFBRSxDQUFDO1lBQ3JCLE9BQU87UUFDVCxDQUFDO1FBRUQsTUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUM7UUFDeEMsTUFBTSxtQkFBbUIsR0FBRyxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQzdELE1BQU0saUJBQWlCLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUM7UUFDaEQsTUFBTSw0QkFBNEIsR0FBRyxJQUFJLENBQUMscUJBQXFCLENBQUMsS0FBSyxDQUFDO1FBQ3RFLE1BQU0sa0JBQWtCLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUM7UUFDbEQsTUFBTSxxQkFBcUIsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQztRQUV4RCxJQUFJLENBQUMsdUJBQXVCLENBQUMsR0FBRyxDQUFDLGNBQWMsQ0FBQyxDQUFDO1FBQ2pELElBQUksQ0FBQyxTQUFTLENBQUMsa0JBQWtCLEVBQUUsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ2pELElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUU5QyxJQUFJLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxjQUFjLEVBQUUsU0FBUyxDQUFDLENBQUMsU0FBUyxDQUFDO1lBQ3hELElBQUksRUFBRSxHQUFHLEVBQUU7Z0JBQ1QsSUFBSSxDQUFDLHVCQUF1QixDQUFDLE1BQU0sQ0FBQyxjQUFjLENBQUMsQ0FBQztnQkFDcEQsSUFBSSxDQUFDLFNBQVMsQ0FBQyxjQUFjLEVBQUUsU0FBUyxDQUFDLENBQUM7Z0JBQzFDLFNBQVMsRUFBRSxPQUFPLEVBQUUsRUFBRSxDQUFDO1lBQ3pCLENBQUM7WUFDRCxLQUFLLEVBQUUsR0FBRyxFQUFFO2dCQUNWLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxNQUFNLENBQUMsY0FBYyxDQUFDLENBQUM7Z0JBQ3BELElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDO2dCQUNoQyxJQUFJLENBQUMsWUFBWSxDQUFDLGFBQWEsQ0FBQyxDQUFDO2dCQUNqQyxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO2dCQUM1QyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO2dCQUN4QyxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDO2dCQUNoRCxJQUFJLENBQUMscUJBQXFCLENBQUMsSUFBSSxDQUFDLDRCQUE0QixDQUFDLENBQUM7Z0JBQzlELElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLENBQUM7Z0JBQzFDLElBQUksQ0FBQyxTQUFTLENBQUMsc0JBQXNCLEVBQUUsT0FBTyxDQUFDLENBQUM7Z0JBQ2hELFNBQVMsRUFBRSxLQUFLLEVBQUUsRUFBRSxDQUFDO1lBQ3ZCLENBQUM7U0FDRixDQUFDLENBQUM7SUFDTCxDQUFDO0lBRU8sd0JBQXdCLENBQUMsY0FBc0I7UUFDckQsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxlQUFlLENBQUMsS0FBSyxNQUFNLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQztRQUNsRyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUN4QixJQUFJLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBRXpCLE1BQU0sR0FBRyxHQUFHLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDN0MsR0FBRyxDQUFDLE1BQU0sQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUMzQixJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUU1QixJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLGNBQWMsQ0FBQyxLQUFLLE1BQU0sQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDN0csSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLHFCQUFxQixDQUFDLEtBQUssQ0FBQyxLQUFLLE1BQU0sQ0FBQyxjQUFjLENBQUMsRUFBRSxDQUFDO1lBQ3hFLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDdEMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDakMsQ0FBQztRQUNELE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDO1FBQzNDLElBQUksUUFBUSxFQUFFLGNBQWMsS0FBSyxjQUFjLEVBQUUsQ0FBQztZQUNoRCxJQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztRQUM1QixDQUFDO0lBQ0gsQ0FBQztJQUVELGtCQUFrQjtJQUNsQixXQUFXLENBQUMsU0FBaUIsRUFBRSxLQUFhO1FBQzFDLE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDO1FBQ3RDLElBQUksQ0FBQyxTQUFTO1lBQUUsT0FBTztRQUV2QixzRkFBc0Y7UUFDdEYsS0FBSyxNQUFNLElBQUksSUFBSSxJQUFJLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDO1lBQ3BELE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxLQUFLLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO1lBQ3ZFLElBQUksR0FBRyxFQUFFLFNBQVMsRUFBRSxDQUFDO2dCQUNuQixLQUFLLE1BQU0sQ0FBQyxJQUFJLEdBQUcsQ0FBQyxTQUFTLEVBQUUsQ0FBQztvQkFDOUIsSUFBSSxDQUFDLENBQUMsVUFBVSxJQUFJLENBQUMsQ0FBQyxLQUFLLEtBQUssS0FBSyxFQUFFLENBQUM7d0JBQ3RDLElBQUksQ0FBQywyQkFBMkIsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLEtBQUssRUFBRSxLQUFLLENBQUMsQ0FBQzt3QkFDNUQsSUFBSSxDQUFDLEdBQUcsQ0FBQyxjQUFjLENBQUMsU0FBUyxFQUFFLFNBQVMsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsU0FBUyxDQUFDLEVBQUUsS0FBSyxFQUFFLEdBQUcsRUFBRSxHQUFFLENBQUMsRUFBRSxDQUFDLENBQUM7b0JBQ3hGLENBQUM7Z0JBQ0gsQ0FBQztZQUNILENBQUM7WUFDRCxNQUFNO1FBQ1IsQ0FBQztRQUVELG1EQUFtRDtRQUNuRCxJQUFJLENBQUMsMkJBQTJCLENBQUMsU0FBUyxFQUFFLEtBQUssRUFBRSxJQUFJLENBQUMsQ0FBQztRQUV6RCxJQUFJLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxTQUFTLEVBQUUsU0FBUyxFQUFFLEtBQUssQ0FBQyxDQUFDLFNBQVMsQ0FBQztZQUMxRCxJQUFJLEVBQUUsR0FBRyxFQUFFO2dCQUNULElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUMxQyxDQUFDO1lBQ0QsS0FBSyxFQUFFLEdBQUcsRUFBRTtnQkFDViwrQ0FBK0M7Z0JBQy9DLElBQUksQ0FBQywyQkFBMkIsQ0FBQyxTQUFTLEVBQUUsS0FBSyxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBQzVELENBQUM7U0FDRixDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQsY0FBYyxDQUFDLFNBQWlCLEVBQUUsS0FBYTtRQUM3QyxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQztRQUN0QyxJQUFJLENBQUMsU0FBUztZQUFFLE9BQU87UUFFdkIsMkRBQTJEO1FBQzNELElBQUksQ0FBQywyQkFBMkIsQ0FBQyxTQUFTLEVBQUUsS0FBSyxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRTFELElBQUksQ0FBQyxHQUFHLENBQUMsY0FBYyxDQUFDLFNBQVMsRUFBRSxTQUFTLEVBQUUsS0FBSyxDQUFDLENBQUMsU0FBUyxDQUFDO1lBQzdELElBQUksRUFBRSxHQUFHLEVBQUU7Z0JBQ1QsSUFBSSxDQUFDLHVCQUF1QixDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBQzFDLENBQUM7WUFDRCxLQUFLLEVBQUUsR0FBRyxFQUFFO2dCQUNWLCtDQUErQztnQkFDL0MsSUFBSSxDQUFDLDJCQUEyQixDQUFDLFNBQVMsRUFBRSxLQUFLLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDM0QsQ0FBQztTQUNGLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRCx1QkFBdUI7UUFDckIsT0FBTyxJQUFJLENBQUMscUJBQXFCLENBQUMsS0FBSyxDQUFDO0lBQzFDLENBQUM7SUFFRCxnQkFBZ0I7SUFDaEIsMEJBQTBCLENBQUMsY0FBc0I7UUFDL0MsT0FBTyxJQUFJLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsY0FBYyxDQUFDLElBQUksRUFBRSxDQUFDO0lBQzNELENBQUM7SUFFRCxlQUFlO1FBQ2IsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQztJQUMzQixDQUFDO0lBRUQsd0JBQXdCO0lBQ3hCOztPQUVHO0lBQ0ssY0FBYyxDQUFDLEdBQXFCO1FBQzFDLElBQUksR0FBRyxDQUFDLElBQUksS0FBSyxTQUFTLElBQUksR0FBRyxDQUFDLElBQUksS0FBSyxJQUFJLEVBQUUsQ0FBQztZQUNoRCxPQUFPLEdBQUcsQ0FBQyxJQUFJLENBQUM7UUFDbEIsQ0FBQztRQUNELE1BQU0sR0FBRyxHQUFHLEdBQXlDLENBQUM7UUFDdEQsTUFBTSxFQUFFLElBQUksRUFBRSxFQUFFLEVBQUUsSUFBSSxFQUFFLEVBQUUsRUFBRSxTQUFTLEVBQUUsR0FBRyxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsR0FBRyxJQUFJLEVBQUUsR0FBRyxHQUFHLENBQUM7UUFDM0UsT0FBTyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7SUFDaEQsQ0FBQztJQUVPLGVBQWU7UUFDckIsSUFBSSxDQUFDLEtBQUssRUFBRSxXQUFXLEVBQUUsQ0FBQztRQUMxQixJQUFJLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBQ3ZGLENBQUM7SUFFTyxlQUFlLENBQUMsR0FBcUI7UUFDM0MsUUFBUSxHQUFHLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDakIsS0FBSyxhQUFhO2dCQUNoQixJQUFJLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO2dCQUNoRCxNQUFNO1lBQ1IsS0FBSyxzQkFBc0I7Z0JBQ3pCLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQztnQkFDakIsTUFBTTtZQUNSLEtBQUssZUFBZTtnQkFDbEIsSUFBSSxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztnQkFDbEQsTUFBTTtZQUNSLEtBQUssT0FBTztnQkFDVixJQUFJLENBQUMsb0JBQW9CLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDO2dCQUN2QyxNQUFNO1FBQ1YsQ0FBQztJQUNILENBQUM7SUFFTyxrQkFBa0IsQ0FBQyxJQUFTO1FBQ2xDLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQztJQUNuQixDQUFDO0lBRU8sb0JBQW9CLENBQUMsWUFBZ0M7UUFDM0QsS0FBSyxZQUFZLENBQUM7SUFDcEIsQ0FBQztJQUVPLGdCQUFnQixDQUFDLElBQVM7UUFDaEMsSUFBSSxDQUFDLElBQUk7WUFBRSxPQUFPO1FBRWxCLElBQUksT0FBTyxHQUFZLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN4RCxJQUFJLENBQUMsZ0NBQWdDLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDL0MsTUFBTSxXQUFXLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBQ3RELE1BQU0sTUFBTSxHQUFHLE1BQU0sQ0FBQyxPQUFPLENBQUMsZUFBZSxJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBQ3JELE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLENBQUM7UUFFM0QsTUFBTSxPQUFPLEdBQ1gsV0FBVztZQUNYLE1BQU0sQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLEtBQUssV0FBVztZQUN6QyxDQUFDLENBQUMsT0FBTyxDQUFDLFVBQVU7WUFDcEIsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUVsRCwrR0FBK0c7UUFDL0csSUFBSSxPQUFPLEVBQUUsQ0FBQztZQUNaLE1BQU0sT0FBTyxHQUFHLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRTtnQkFDdkMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQztvQkFBRSxPQUFPLEtBQUssQ0FBQztnQkFDNUQsSUFBSSxNQUFNLENBQUMsQ0FBQyxDQUFDLGVBQWUsQ0FBQyxLQUFLLE1BQU07b0JBQUUsT0FBTyxLQUFLLENBQUM7Z0JBQ3ZELElBQUksTUFBTSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsS0FBSyxXQUFXO29CQUFFLE9BQU8sS0FBSyxDQUFDO2dCQUN0RCxNQUFNLEVBQUUsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUNqQixJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsT0FBTyxFQUFFLEdBQUcsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUMxRSxDQUFDO2dCQUNGLElBQUksRUFBRSxJQUFJLE9BQU87b0JBQUUsT0FBTyxLQUFLLENBQUM7Z0JBQ2hDLE1BQU0sQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDLENBQUMsT0FBTyxJQUFJLEVBQUUsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDO2dCQUN6QyxNQUFNLENBQUMsR0FBRyxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sSUFBSSxFQUFFLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQztnQkFDL0MsT0FBTyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1lBQ3ZCLENBQUMsQ0FBQyxDQUFDO1lBQ0gsSUFBSSxPQUFPLElBQUksQ0FBQyxFQUFFLENBQUM7Z0JBQ2pCLE1BQU0sTUFBTSxHQUFZLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLEVBQUUsSUFBSSxDQUFDLHFCQUFxQixDQUFDO29CQUNqRyxHQUFHLFFBQVEsQ0FBQyxPQUFPLENBQUM7b0JBQ3BCLEdBQUcsSUFBSTtvQkFDUCxVQUFVLEVBQUUsT0FBTyxDQUFDLFVBQVU7b0JBQzlCLGVBQWUsRUFBRSxNQUFNO29CQUN2QixPQUFPLEVBQUUsSUFBSSxDQUFDLG1CQUFtQixDQUFDLElBQUksRUFBRSxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsT0FBTyxDQUFDO2lCQUNuRSxDQUFDLENBQUMsQ0FBQztnQkFDSixNQUFNLEdBQUcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQyxDQUFDO2dCQUM3QyxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsMkJBQTJCLENBQUMsQ0FBQyxHQUFHLFFBQVEsQ0FBQyxDQUFDLENBQUM7Z0JBQzdELElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxNQUFNLENBQUM7Z0JBQ3ZCLEdBQUcsQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQywyQkFBMkIsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO2dCQUN4RCxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFDNUIsSUFBSSxDQUFDLHVCQUF1QixDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsQ0FBQztnQkFDaEQsT0FBTyxHQUFHLE1BQU0sQ0FBQztnQkFDakIsSUFBSSxDQUFDLGtCQUFrQixDQUFDLE9BQU8sQ0FBQyxDQUFDO2dCQUNqQyxJQUFJLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxLQUFLLEtBQUssT0FBTyxDQUFDLGVBQWUsRUFBRSxDQUFDO29CQUNqRSxJQUFJLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxlQUFlLENBQUMsQ0FBQztnQkFDM0MsQ0FBQztnQkFDRCxPQUFPO1lBQ1QsQ0FBQztRQUNILENBQUM7UUFFRCxNQUFNLFdBQVcsR0FBRyxNQUFNLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxLQUFLLFdBQVcsQ0FBQztRQUM5RCxNQUFNLFVBQVUsR0FBRyxXQUFXLElBQUksSUFBSSxDQUFDLDBCQUEwQixDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBRTNFLE1BQU0sWUFBWSxHQUFHLFFBQVEsQ0FBQyxTQUFTLENBQ3JDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FDSixNQUFNLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxLQUFLLE1BQU0sQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDO1lBQ25ELENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsS0FBSyxNQUFNLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQztnQkFDaEQsTUFBTSxDQUFDLENBQUMsQ0FBQyxPQUFPLElBQUksRUFBRSxDQUFDLEtBQUssTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLElBQUksRUFBRSxDQUFDO2dCQUN6RCxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxPQUFPLEVBQUUsR0FBRyxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLENBQUMsT0FBTyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FDaEcsQ0FBQztRQUNGLE1BQU0sV0FBVyxHQUFHLFlBQVksSUFBSSxDQUFDLENBQUM7UUFFdEMsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO1lBQ2pCLElBQUksQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLENBQUM7WUFFNUIsSUFBSSxXQUFXLEVBQUUsQ0FBQztnQkFDaEIsSUFBSSxDQUFDLHlCQUF5QixFQUFFLENBQUM7WUFDbkMsQ0FBQztZQUNELElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUNuQyxDQUFDO2FBQU0sQ0FBQztZQUNOLE1BQU0sR0FBRyxHQUFHLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDN0MsTUFBTSxJQUFJLEdBQUcsQ0FBQyxHQUFHLFFBQVEsQ0FBQyxDQUFDO1lBQzNCLElBQUksQ0FBQyxZQUFZLENBQUMsR0FBRyxJQUFJLENBQUMsdUJBQXVCLENBQUMsUUFBUSxDQUFDLFlBQVksQ0FBQyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1lBQ25GLEdBQUcsQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQ3RCLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQzlCLENBQUM7UUFFRCxJQUFJLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxLQUFLLEtBQUssT0FBTyxDQUFDLGVBQWUsRUFBRSxDQUFDO1lBQ2pFLElBQUksV0FBVyxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7Z0JBQ2hDLElBQUksQ0FBQyxlQUFlLENBQUMsT0FBTyxDQUFDLGVBQWUsQ0FBQyxDQUFDO2dCQUM5QyxJQUFJLFVBQVUsRUFBRSxDQUFDO29CQUNmLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxPQUFPLENBQUMsZUFBZSxFQUFFLElBQUksQ0FBQyxDQUFDO2dCQUM3RCxDQUFDO1lBQ0gsQ0FBQztRQUNILENBQUM7YUFBTSxDQUFDO1lBQ04sSUFBSSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsZUFBZSxDQUFDLENBQUM7UUFDM0MsQ0FBQztJQUNILENBQUM7SUFFRCwrRUFBK0U7SUFDL0UsdUJBQXVCLENBQUMsT0FBZ0I7UUFDdEMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUM5QixDQUFDO0lBRU8sYUFBYSxDQUFDLE9BQWdCO1FBQ3BDLE1BQU0sR0FBRyxHQUFHLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDN0MsTUFBTSxPQUFPLEdBQUcsR0FBRyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsZUFBZSxDQUFDLElBQUksRUFBRSxDQUFDO1FBQ3ZELE1BQU0sU0FBUyxHQUFHLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLEtBQUssTUFBTSxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO1FBQ2hHLElBQUksU0FBUyxJQUFJLENBQUMsRUFBRSxDQUFDO1lBQ25CLE1BQU0sSUFBSSxHQUFHLENBQUMsR0FBRyxPQUFPLENBQUMsQ0FBQztZQUMxQixJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsSUFBSSxDQUFDLHVCQUF1QixDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsRUFBRSxPQUFPLENBQUMsQ0FBQztZQUM1RSxHQUFHLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxlQUFlLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDdkMsSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDNUIsSUFBSSxDQUFDLHVCQUF1QixDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQztZQUNqRCxPQUFPO1FBQ1QsQ0FBQztRQUVELE1BQU0sSUFBSSxHQUFHLENBQUMsR0FBRyxPQUFPLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDbkMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsZUFBZSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ3ZDLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQzVCLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLENBQUM7SUFDbkQsQ0FBQztJQUVPLHVCQUF1QixDQUFDLFFBQWlCLEVBQUUsUUFBaUI7UUFDbEUsTUFBTSxtQkFBbUIsR0FBRyxJQUFJLENBQUMsdUJBQXVCLENBQUMsUUFBUSxDQUFDLFdBQVcsSUFBSSxFQUFFLENBQUMsQ0FBQztRQUNyRixNQUFNLG1CQUFtQixHQUFHLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxRQUFRLENBQUMsV0FBVyxJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBQ3JGLE1BQU0sV0FBVyxHQUNmLG1CQUFtQixDQUFDLE1BQU0sSUFBSSxtQkFBbUIsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLG1CQUFtQixDQUFDLENBQUMsQ0FBQyxtQkFBbUIsQ0FBQztRQUV2RyxPQUFPO1lBQ0wsR0FBRyxRQUFRO1lBQ1gsR0FBRyxRQUFRO1lBQ1gsU0FBUyxFQUFFLFFBQVEsQ0FBQyxTQUFTLElBQUksUUFBUSxDQUFDLFNBQVM7WUFDbkQsV0FBVyxFQUFFLFdBQVcsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxXQUFXLElBQUksUUFBUSxDQUFDLFdBQVc7U0FDakcsQ0FBQztJQUNKLENBQUM7SUFFTyx1QkFBdUIsQ0FBQyxXQUF5QjtRQUN2RCxNQUFNLElBQUksR0FBRyxJQUFJLEdBQUcsRUFBc0IsQ0FBQztRQUMzQyxLQUFLLE1BQU0sVUFBVSxJQUFJLFdBQVcsRUFBRSxDQUFDO1lBQ3JDLE1BQU0sTUFBTSxHQUFHLE1BQU0sQ0FBQyxVQUFVLEVBQUUsT0FBTyxJQUFJLEVBQUUsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDO1lBQ3hELElBQUksQ0FBQyxNQUFNLElBQUksTUFBTSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUM7Z0JBQUUsU0FBUztZQUNwRCxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRTtnQkFDZixHQUFHLFVBQVU7Z0JBQ2IsT0FBTyxFQUFFLE1BQU07Z0JBQ2YsUUFBUSxFQUFFLFVBQVUsQ0FBQyxRQUFRLElBQUksTUFBTTthQUN4QyxDQUFDLENBQUM7UUFDTCxDQUFDO1FBQ0QsT0FBTyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO0lBQ25DLENBQUM7SUFFTyxrQkFBa0IsQ0FBQyxPQUFnQjtRQUN6QyxNQUFNLElBQUksR0FBRyxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sSUFBSSxFQUFFLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUNsRCxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMscUJBQXFCLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDbEQsSUFBSSxDQUFDLElBQUksSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO1lBQ3BCLE9BQU87UUFDVCxDQUFDO1FBQ0QsTUFBTSxPQUFPLEdBQUcsSUFBSSxJQUFJLFNBQVMsQ0FBQztRQUNsQyxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLEVBQUUsRUFBRTtZQUMzQyxJQUFJLElBQUksQ0FBQyxlQUFlLEtBQUssT0FBTyxDQUFDLGVBQWUsRUFBRSxDQUFDO2dCQUNyRCxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsV0FBVyxJQUFJLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQztnQkFDM0csT0FBTztvQkFDTCxHQUFHLElBQUk7b0JBQ1Asb0JBQW9CLEVBQUUsT0FBTztvQkFDN0IsZUFBZSxFQUFFLE9BQU8sQ0FBQyxVQUFVO29CQUNuQyxXQUFXLEVBQUUsU0FBUztpQkFDdkIsQ0FBQztZQUNKLENBQUM7WUFDRCxPQUFPLElBQUksQ0FBQztRQUNkLENBQUMsQ0FBQyxDQUFDO1FBRUgsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxlQUFlLENBQUMsQ0FBQyxPQUFPLEVBQUUsR0FBRyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsZUFBZSxDQUFDLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQztRQUNwRyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUMxQixDQUFDO0lBRUQsMkZBQTJGO0lBQ25GLG1CQUFtQixDQUFDLEdBQVEsRUFBRSxRQUFRLEdBQUcsRUFBRTtRQUNqRCxNQUFNLEtBQUssR0FBRyxDQUFDLEdBQUcsRUFBRSxPQUFPLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRSxHQUFHLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBQzdELEtBQUssTUFBTSxDQUFDLElBQUksS0FBSyxFQUFFLENBQUM7WUFDdEIsSUFBSSxPQUFPLENBQUMsS0FBSyxRQUFRLElBQUksQ0FBQyxDQUFDLElBQUksRUFBRTtnQkFBRSxPQUFPLENBQUMsQ0FBQztZQUNoRCxJQUFJLENBQUMsSUFBSSxJQUFJLElBQUksT0FBTyxDQUFDLEtBQUssUUFBUSxJQUFJLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUU7Z0JBQUUsT0FBTyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDdEYsQ0FBQztRQUNELE9BQU8sT0FBTyxRQUFRLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxRQUFRLElBQUksRUFBRSxDQUFDLENBQUM7SUFDMUUsQ0FBQztJQUVPLGlCQUFpQixDQUFDLE9BQWU7UUFDdkMsTUFBTSxLQUFLLEdBQUcsTUFBTSxDQUFDLE9BQU8sSUFBSSxFQUFFLENBQUMsQ0FBQztRQUNwQyxNQUFNLEtBQUssR0FBRyxLQUFLLENBQUMsS0FBSyxDQUFDLGtEQUFrRCxDQUFDLENBQUM7UUFDOUUsSUFBSSxDQUFDLEtBQUs7WUFBRSxPQUFPLElBQUksQ0FBQztRQUN4QixPQUFPO1lBQ0wsS0FBSyxFQUFFO2dCQUNMLFdBQVcsRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFO2dCQUM1QixPQUFPLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRTthQUN6QjtZQUNELElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDO1NBQ2YsQ0FBQztJQUNKLENBQUM7SUFFTyxhQUFhLENBQUMsT0FBZTtRQUNuQyxPQUFPLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxPQUFPLENBQUMsRUFBRSxJQUFJLElBQUksTUFBTSxDQUFDLE9BQU8sSUFBSSxFQUFFLENBQUMsQ0FBQztJQUN4RSxDQUFDO0lBRU8sNEJBQTRCO1FBQ2xDLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLHVCQUF1QixDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQztJQUM1RSxDQUFDO0lBRU8sWUFBWSxDQUFDLE9BQWU7UUFDbEMsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQy9DLE1BQU0sSUFBSSxHQUFHLENBQUMsTUFBTSxFQUFFLElBQUksSUFBSSxPQUFPLENBQUMsQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFFLEdBQUcsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDO1FBQ25FLE9BQU8sSUFBSSxDQUFDLE1BQU0sR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxJQUFJLFlBQVksQ0FBQztJQUMvRSxDQUFDO0lBRU8sb0JBQW9CO1FBQzFCLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDO1FBQ3pDLE1BQU0sTUFBTSxHQUFHO1lBQ2IsT0FBTyxFQUFFLFFBQVE7WUFDakIsT0FBTyxFQUFFLEtBQUssRUFBRSxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQzdCLE9BQU8sRUFBRSxVQUFVO1lBQ25CLE9BQU8sRUFBRSxTQUFTO1lBQ2xCLE9BQU8sRUFBRSxLQUFLO1NBQ2YsQ0FBQztRQUNGLE9BQU8sTUFBTTthQUNWLEdBQUcsQ0FBQyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsTUFBTSxDQUFDLEtBQUssSUFBSSxFQUFFLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxXQUFXLEVBQUUsQ0FBQzthQUN4RCxNQUFNLENBQUMsT0FBTyxDQUFDO2FBQ2YsR0FBRyxDQUFDLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQzdDLENBQUM7SUFFTyw4QkFBOEIsQ0FBQyxPQUFlO1FBQ3BELE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxvQkFBb0IsRUFBRSxDQUFDO1FBQzNDLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTTtZQUFFLE9BQU8sS0FBSyxDQUFDO1FBQ2pDLE1BQU0sUUFBUSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sSUFBSSxFQUFFLENBQUMsQ0FBQyxRQUFRLENBQUMsd0NBQXdDLENBQUMsQ0FBQzthQUNsRyxHQUFHLENBQUMsQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDO1FBQzFDLE9BQU8sUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sRUFBRSxFQUFFLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO0lBQzlELENBQUM7SUFFTywwQkFBMEIsQ0FBQyxPQUFnQjtRQUNqRCxNQUFNLElBQUksR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLElBQUksRUFBRSxDQUFDLENBQUM7UUFDL0MsTUFBTSxnQkFBZ0IsR0FBRyxLQUFLLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUM7WUFDdEQsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDMUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztRQUNQLE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFBSSxJQUFJLGdCQUFnQixDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNoRCxJQUFJLENBQUMsOEJBQThCLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQztJQUN2RSxDQUFDO0lBRU8sc0JBQXNCLENBQUMsY0FBc0IsRUFBRSxVQUFtQjtRQUN4RSxNQUFNLEVBQUUsR0FBRyxNQUFNLENBQUMsY0FBYyxJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBQ3hDLElBQUksQ0FBQyxFQUFFO1lBQUUsT0FBTztRQUNoQixNQUFNLElBQUksR0FBRyxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsdUJBQXVCLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDekQsSUFBSSxVQUFVLEVBQUUsQ0FBQztZQUNmLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDZixDQUFDO2FBQU0sQ0FBQztZQUNOLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDbEIsQ0FBQztRQUNELElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDeEMsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FDM0MsTUFBTSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsR0FBRyxJQUFJLEVBQUUsV0FBVyxFQUFFLFVBQVUsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQ2xGLENBQUM7UUFDRixJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUMxQixDQUFDO0lBRU8scUJBQXFCLENBQUMsQ0FBVTtRQUN0QyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsWUFBWSxDQUFDO1FBQ3pCLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxNQUFNO1lBQUUsT0FBTyxJQUFJLENBQUM7UUFDbkMsTUFBTSxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUMsQ0FBQyxTQUFTLElBQUksRUFBRSxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDM0MsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFFLENBQUM7WUFDeEYsT0FBTyxJQUFJLENBQUM7UUFDZCxDQUFDO1FBQ0QsT0FBTyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUMsV0FBVyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUM7SUFDbEUsQ0FBQztJQUVELHFHQUFxRztJQUM3RiwyQkFBMkIsQ0FBQyxJQUFlO1FBQ2pELE1BQU0sSUFBSSxHQUFHLElBQUksR0FBRyxFQUFVLENBQUM7UUFDL0IsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUU7WUFDdkIsTUFBTSxFQUFFLEdBQUcsTUFBTSxDQUFDLENBQUMsQ0FBQyxVQUFVLElBQUksRUFBRSxDQUFDLENBQUM7WUFDdEMsSUFBSSxDQUFDLEVBQUU7Z0JBQUUsT0FBTyxJQUFJLENBQUM7WUFDckIsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQztnQkFBRSxPQUFPLEtBQUssQ0FBQztZQUMvQixJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1lBQ2IsT0FBTyxJQUFJLENBQUM7UUFDZCxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFTyxlQUFlLENBQUMsY0FBc0I7UUFDNUMsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FDM0MsSUFBSSxDQUFDLGVBQWUsS0FBSyxjQUFjO1lBQ3JDLENBQUMsQ0FBQyxFQUFFLEdBQUcsSUFBSSxFQUFFLFlBQVksRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUMsRUFBRTtZQUMxRCxDQUFDLENBQUMsSUFBSSxDQUNULENBQUM7UUFDRixJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUN4QixJQUFJLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQzNCLENBQUM7SUFFRDs7O09BR0c7SUFDSyxxQkFBcUIsQ0FBQyxHQUFRO1FBQ3BDLE1BQU0sSUFBSSxHQUFZO1lBQ3BCLFVBQVUsRUFBRSxNQUFNLENBQUMsR0FBRyxFQUFFLFVBQVUsSUFBSSxHQUFHLEVBQUUsRUFBRSxJQUFJLEVBQUUsQ0FBQztZQUNwRCxlQUFlLEVBQUUsTUFBTSxDQUFDLEdBQUcsRUFBRSxlQUFlLElBQUksR0FBRyxFQUFFLGNBQWMsSUFBSSxFQUFFLENBQUM7WUFDMUUsU0FBUyxFQUFFLE1BQU0sQ0FBQyxHQUFHLEVBQUUsU0FBUyxJQUFJLEdBQUcsRUFBRSxRQUFRLElBQUksRUFBRSxDQUFDO1lBQ3hELFdBQVcsRUFBRSxHQUFHLEVBQUUsV0FBVztZQUM3QixlQUFlLEVBQUUsR0FBRyxFQUFFLGVBQWU7WUFDckMsaUJBQWlCLEVBQUUsR0FBRyxFQUFFLGlCQUFpQjtZQUN6QyxnQkFBZ0IsRUFBRSxHQUFHLEVBQUUsZ0JBQWdCO1lBQ3ZDLFlBQVksRUFBRSxDQUFDLEdBQUcsRUFBRSxZQUFZLElBQUksR0FBRyxFQUFFLFdBQVcsSUFBSSxNQUFNLENBQTRCO1lBQzFGLE9BQU8sRUFBRSxHQUFHLEVBQUUsT0FBTyxJQUFJLEdBQUcsRUFBRSxJQUFJLElBQUksR0FBRyxFQUFFLElBQUksSUFBSSxFQUFFO1lBQ3JELFNBQVMsRUFBRSxHQUFHLEVBQUUsU0FBUyxJQUFJLEdBQUcsRUFBRSxRQUFRLElBQUksR0FBRyxFQUFFLEdBQUcsSUFBSSxHQUFHLEVBQUUsUUFBUTtZQUN2RSxVQUFVLEVBQUUsR0FBRyxFQUFFLFVBQVUsSUFBSSxHQUFHLEVBQUUsU0FBUyxJQUFJLElBQUksSUFBSSxFQUFFLENBQUMsV0FBVyxFQUFFO1lBQ3pFLE9BQU8sRUFBRSxHQUFHLEVBQUUsT0FBTztZQUNyQixTQUFTLEVBQUUsR0FBRyxFQUFFLFNBQVM7WUFDekIsUUFBUSxFQUFFLEdBQUcsRUFBRSxRQUFRO1lBQ3ZCLFdBQVcsRUFBRSxHQUFHLEVBQUUsV0FBVztZQUM3QixTQUFTLEVBQUUsR0FBRyxFQUFFLFNBQVM7WUFDekIsU0FBUyxFQUFFLEdBQUcsRUFBRSxTQUFTO1lBQ3pCLFNBQVMsRUFBRSxHQUFHLEVBQUUsU0FBUztTQUMxQixDQUFDO1FBRUYsTUFBTSxVQUFVLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLElBQUksRUFBRSxDQUFDLENBQUM7UUFDOUMsSUFBSSxVQUFVLENBQUMsVUFBVSxDQUFDLHlCQUF5QixDQUFDLEVBQUUsQ0FBQztZQUNyRCxJQUFJLENBQUMsT0FBTyxHQUFHLFVBQVUsQ0FBQyxLQUFLLENBQUMseUJBQXlCLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDbEUsSUFBSSxDQUFDLG9CQUFvQixHQUFHLElBQUksQ0FBQztRQUNuQyxDQUFDO2FBQU0sQ0FBQztZQUNOLElBQUksQ0FBQyxvQkFBb0IsR0FBRyxHQUFHLEVBQUUsb0JBQW9CLElBQUksR0FBRyxFQUFFLGlCQUFpQixDQUFDO1FBQ2xGLENBQUM7UUFFRCxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsaUJBQWlCLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQztRQUN2RSxJQUFJLFdBQVcsRUFBRSxDQUFDO1lBQ2hCLElBQUksQ0FBQyxPQUFPLEdBQUcsV0FBVyxDQUFDLElBQUksQ0FBQztZQUNoQyxJQUFJLENBQUMsUUFBUSxHQUFHLEdBQUcsRUFBRSxRQUFRLElBQUksR0FBRyxFQUFFLE9BQU8sSUFBSSxXQUFXLENBQUMsS0FBSyxDQUFDO1FBQ3JFLENBQUM7YUFBTSxDQUFDO1lBQ04sSUFBSSxDQUFDLFFBQVEsR0FBRyxHQUFHLEVBQUUsUUFBUSxJQUFJLEdBQUcsRUFBRSxPQUFPLENBQUM7UUFDaEQsQ0FBQztRQUVELE1BQU0sTUFBTSxHQUNWLDRFQUE0RSxDQUFDO1FBRS9FLE1BQU0sYUFBYSxHQUFHLENBQUMsS0FBVSxFQUFZLEVBQUU7WUFDN0MsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUM7Z0JBQ3pCLE9BQU8sS0FBSztxQkFDVCxHQUFHLENBQUMsQ0FBQyxDQUFNLEVBQUUsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxPQUFPLElBQUksQ0FBQyxFQUFFLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztxQkFDeEUsR0FBRyxDQUFDLENBQUMsQ0FBTSxFQUFFLEVBQUUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUM7cUJBQ2pDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUNyQixDQUFDO1lBQ0QsSUFBSSxPQUFPLEtBQUssS0FBSyxRQUFRLElBQUksS0FBSyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUM7Z0JBQzlDLE1BQU0sT0FBTyxHQUFHLEtBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQztnQkFDN0IsSUFBSSxPQUFPLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQztvQkFDdkQsSUFBSSxDQUFDO3dCQUNILE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUM7d0JBQ25DLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUM7NEJBQUUsT0FBTyxhQUFhLENBQUMsTUFBTSxDQUFDLENBQUM7d0JBQ3hELE9BQU8sYUFBYSxDQUFDLE1BQU0sRUFBRSxHQUFHLElBQUksTUFBTSxFQUFFLFFBQVEsSUFBSSxNQUFNLEVBQUUsY0FBYyxJQUFJLE1BQU0sRUFBRSxXQUFXLENBQUMsQ0FBQztvQkFDekcsQ0FBQztvQkFBQyxNQUFNLENBQUM7d0JBQ1AsT0FBTyxFQUFFLENBQUM7b0JBQ1osQ0FBQztnQkFDSCxDQUFDO2dCQUNELE9BQU8sT0FBTyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFTLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUM5RSxDQUFDO1lBQ0QsT0FBTyxFQUFFLENBQUM7UUFDWixDQUFDLENBQUM7UUFFRixNQUFNLG1CQUFtQixHQUFHLENBQUMsQ0FBTSxFQUFxQixFQUFFO1lBQ3hELE1BQU0sTUFBTSxHQUFHLE1BQU0sQ0FDbkIsT0FBTyxDQUFDLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDM0IsQ0FBQyxFQUFFLE9BQU8sSUFBSSxDQUFDLEVBQUUsTUFBTSxJQUFJLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQyxFQUFFLGFBQWEsSUFBSSxDQUFDLEVBQUUsZUFBZSxJQUFJLEVBQUUsQ0FDakYsQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUNULElBQUksQ0FBQyxNQUFNLElBQUksTUFBTSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUM7Z0JBQUUsT0FBTyxJQUFJLENBQUM7WUFDdkQsT0FBTztnQkFDTCxPQUFPLEVBQUUsTUFBTTtnQkFDZixRQUFRLEVBQUUsTUFBTSxDQUFDLENBQUMsRUFBRSxRQUFRLElBQUksQ0FBQyxFQUFFLFNBQVMsSUFBSSxDQUFDLEVBQUUsSUFBSSxJQUFJLENBQUMsRUFBRSxpQkFBaUIsSUFBSSxNQUFNLENBQUM7Z0JBQzFGLFNBQVMsRUFBRSxDQUFDLEVBQUUsU0FBUyxJQUFJLENBQUMsRUFBRSxRQUFRO2dCQUN0QyxVQUFVLEVBQUUsQ0FBQyxFQUFFLFVBQVUsSUFBSSxDQUFDLEVBQUUsU0FBUztnQkFDekMsR0FBRyxFQUFFLENBQUMsRUFBRSxHQUFHLElBQUksQ0FBQyxFQUFFLFFBQVEsSUFBSSxDQUFDLEVBQUUsWUFBWTthQUM5QyxDQUFDO1FBQ0osQ0FBQyxDQUFDO1FBRUYsSUFBSSxxQkFBcUIsR0FBaUIsRUFBRSxDQUFDO1FBQzdDLE1BQU0sYUFBYSxHQUFHLENBQUMsVUFBNkIsRUFBUSxFQUFFO1lBQzVELElBQUksQ0FBQyxVQUFVO2dCQUFFLE9BQU87WUFDeEIsTUFBTSxNQUFNLEdBQUcsTUFBTSxDQUFDLFVBQVUsQ0FBQyxPQUFPLElBQUksRUFBRSxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDdkQsTUFBTSxHQUFHLEdBQUcsTUFBTSxDQUFDLFVBQVUsQ0FBQyxHQUFHLElBQUksRUFBRSxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDaEQsSUFBSSxNQUFNLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxJQUFJLE1BQU0sQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQztnQkFDckQsTUFBTSxHQUFHLEdBQUcsYUFBYSxDQUFDLE1BQU0sQ0FBQyxDQUFDO2dCQUNsQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUMsRUFBRSxFQUFFLEdBQUcsRUFBRSxFQUFFO29CQUN0QixhQUFhLENBQUM7d0JBQ1osR0FBRyxVQUFVO3dCQUNiLE9BQU8sRUFBRSxFQUFFO3dCQUNYLFFBQVEsRUFBRSxVQUFVLENBQUMsUUFBUSxJQUFJLGNBQWMsR0FBRyxHQUFHLENBQUMsRUFBRTtxQkFDekQsQ0FBQyxDQUFDO2dCQUNMLENBQUMsQ0FBQyxDQUFDO2dCQUNILE9BQU87WUFDVCxDQUFDO1lBQ0QsSUFBSSxNQUFNLElBQUkscUJBQXFCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsT0FBTyxLQUFLLE1BQU0sQ0FBQztnQkFBRSxPQUFPO1lBQzlFLElBQUksQ0FBQyxNQUFNLElBQUksR0FBRyxJQUFJLHFCQUFxQixDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsS0FBSyxHQUFHLENBQUM7Z0JBQUUsT0FBTztZQUMvRSxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDekMsQ0FBQyxDQUFDO1FBRUYsNkVBQTZFO1FBQzdFLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUM7WUFDbEUsSUFBSSxDQUFDLFdBQXFCLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxhQUFhLENBQUMsbUJBQW1CLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3BGLENBQUM7UUFFRCxNQUFNLFVBQVUsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsSUFBSSxFQUFFLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUN2RCxJQUFJLFVBQVUsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLElBQUksVUFBVSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDO1lBQzdELElBQUksQ0FBQztnQkFDSCxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxDQUFDO2dCQUN0QyxNQUFNLGNBQWMsR0FBRyxLQUFLLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE1BQU0sRUFBRSxXQUFXLENBQUM7Z0JBQzVFLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsRUFBRSxDQUFDO29CQUNsQyxjQUFjLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxhQUFhLENBQUMsbUJBQW1CLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUN2RSxDQUFDO2dCQUNELElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUM7b0JBQzNCLE1BQU0sUUFBUSxHQUFHLGFBQWEsQ0FBQyxNQUFNLEVBQUUsR0FBRyxJQUFJLE1BQU0sRUFBRSxRQUFRLElBQUksTUFBTSxFQUFFLGNBQWMsQ0FBQyxDQUFDO29CQUMxRixNQUFNLGNBQWMsR0FBRyxhQUFhLENBQUMsTUFBTSxFQUFFLFNBQVMsQ0FBQyxDQUFDO29CQUN4RCxNQUFNLGNBQWMsR0FBRyxhQUFhLENBQUMsTUFBTSxFQUFFLFVBQVUsSUFBSSxNQUFNLEVBQUUsU0FBUyxDQUFDLENBQUM7b0JBQzlFLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFFLEVBQUUsR0FBRyxFQUFFLEVBQUU7d0JBQzNCLGFBQWEsQ0FBQzs0QkFDWixPQUFPLEVBQUUsRUFBRTs0QkFDWCxRQUFRLEVBQUUsY0FBYyxDQUFDLEdBQUcsQ0FBQyxJQUFJLGNBQWMsQ0FBQyxDQUFDLENBQUMsSUFBSSxjQUFjLEdBQUcsR0FBRyxDQUFDLEVBQUU7NEJBQzdFLFNBQVMsRUFBRSxjQUFjLENBQUMsR0FBRyxDQUFDO3lCQUMvQixDQUFDLENBQUM7b0JBQ0wsQ0FBQyxDQUFDLENBQUM7Z0JBQ0wsQ0FBQztZQUNILENBQUM7WUFBQyxNQUFNLENBQUM7Z0JBQ1AsMERBQTBEO1lBQzVELENBQUM7UUFDSCxDQUFDO1FBRUQscURBQXFEO1FBQ3JELElBQUksYUFBYSxHQUFhLEVBQUUsQ0FBQztRQUNqQyxhQUFhLEdBQUcsYUFBYSxDQUFDLEdBQUcsRUFBRSxjQUFjLENBQUMsQ0FBQztRQUVuRCxJQUFJLGFBQWEsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDL0IsYUFBYSxHQUFHLGFBQWEsQ0FBQyxHQUFHLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFDL0MsQ0FBQztRQUVELE1BQU0sTUFBTSxHQUFHLENBQUMsQ0FBTSxFQUFFLEVBQUU7WUFDeEIsTUFBTSxDQUFDLEdBQUcsQ0FBQyxJQUFJLElBQUksSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztZQUN4RCxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO2dCQUFFLGFBQWEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDN0QsQ0FBQyxDQUFDO1FBRUYsTUFBTSxDQUFDLEdBQUcsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUNyQixNQUFNLENBQUMsR0FBRyxFQUFFLGFBQWEsQ0FBQyxDQUFDO1FBQzNCLE1BQU0sQ0FBQyxHQUFHLEVBQUUsZUFBZSxDQUFDLENBQUM7UUFDN0IsTUFBTSxDQUFDLEdBQUcsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUVyQiw4RkFBOEY7UUFDOUYsTUFBTSxTQUFTLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLElBQUksRUFBRSxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDdEQsSUFDRSxTQUFTO1lBQ1QsQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQztZQUMxQixDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDO1lBQzFCLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUM7WUFDaEMsQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLFVBQVUsQ0FBQztZQUNqQyxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLEVBQzlCLENBQUM7WUFDRCxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDcEIsQ0FBQztRQUVELE1BQU0sV0FBVyxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxJQUFJLEVBQUUsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDO1FBQ3RELElBQUksYUFBYSxDQUFDLE1BQU0sS0FBSyxDQUFDLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsRUFBRSxDQUFDO1lBQzNELGFBQWEsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDbEMsQ0FBQztRQUNELDBGQUEwRjtRQUMxRixJQUNFLGFBQWEsQ0FBQyxNQUFNLEtBQUssQ0FBQztZQUMxQixPQUFPLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQztZQUN6QixDQUFDLElBQUksQ0FBQyxZQUFZLEtBQUssTUFBTSxJQUFJLElBQUksQ0FBQyxZQUFZLEtBQUssT0FBTyxDQUFDLEVBQy9ELENBQUM7WUFDRCxhQUFhLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQ2xDLENBQUM7UUFFRCxNQUFNLFNBQVMsR0FBYSxhQUFhLENBQUMsR0FBRyxFQUFFLFNBQVMsQ0FBQyxDQUFDLE1BQU07WUFDOUQsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxHQUFHLEVBQUUsU0FBUyxDQUFDO1lBQy9CLENBQUMsQ0FBQyxHQUFHLEVBQUUsUUFBUTtnQkFDZixDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDO2dCQUN4QixDQUFDLENBQUMsR0FBRyxFQUFFLFNBQVM7b0JBQ2hCLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUM7b0JBQ3pCLENBQUMsQ0FBQyxFQUFFLENBQUM7UUFFUCxNQUFNLFNBQVMsR0FBYSxhQUFhLENBQUMsR0FBRyxFQUFFLFVBQVUsQ0FBQyxDQUFDLE1BQU07WUFDL0QsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxHQUFHLEVBQUUsVUFBVSxDQUFDO1lBQ2hDLENBQUMsQ0FBQyxhQUFhLENBQUMsR0FBRyxFQUFFLFNBQVMsQ0FBQyxDQUFDO1FBRWxDLElBQUksYUFBYSxDQUFDLE1BQU0sR0FBRyxDQUFDLElBQUksU0FBUyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsQ0FBQztZQUNyRCxNQUFNLFlBQVksR0FBRyxHQUFHLEVBQUUsU0FBUyxJQUFJLEdBQUcsRUFBRSxvQkFBb0IsSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLEtBQUssT0FBTyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBQzVILE1BQU0sV0FBVyxHQUFHLEdBQUcsRUFBRSxRQUFRLElBQUksR0FBRyxFQUFFLEdBQUcsSUFBSSxHQUFHLEVBQUUsU0FBUyxJQUFJLEdBQUcsRUFBRSxRQUFRLENBQUM7WUFDakYsTUFBTSxHQUFHLEdBQUcsYUFBYSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO1lBQzFELE1BQU0sS0FBSyxHQUFpQixHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsQ0FBQztnQkFDaEQsT0FBTyxFQUFFLEVBQUU7Z0JBQ1gsUUFBUSxFQUFFLFNBQVMsQ0FBQyxHQUFHLENBQUMsSUFBSSxTQUFTLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxLQUFLLE9BQU8sQ0FBQyxDQUFDLENBQUMsU0FBUyxHQUFHLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLGNBQWMsR0FBRyxHQUFHLENBQUMsRUFBRSxDQUFDO2dCQUMxSCxTQUFTLEVBQUUsU0FBUyxDQUFDLEdBQUcsQ0FBQyxJQUFJLFlBQVk7Z0JBQ3pDLEdBQUcsRUFBRSxXQUFXO2FBQ2pCLENBQUMsQ0FBQyxDQUFDO1lBRUosNkVBQTZFO1lBQzdFLElBQ0UsS0FBSyxDQUFDLE1BQU0sS0FBSyxDQUFDO2dCQUNsQixTQUFTLENBQUMsTUFBTSxHQUFHLENBQUM7Z0JBQ3BCLFdBQVc7Z0JBQ1gsTUFBTSxDQUFDLFdBQVcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxlQUFlLENBQUMsRUFDMUMsQ0FBQztnQkFDRCxLQUFLLENBQUMsSUFBSSxDQUFDO29CQUNULE9BQU8sRUFBRSxFQUFFO29CQUNYLFFBQVEsRUFBRSxTQUFTLENBQUMsQ0FBQyxDQUFDO29CQUN0QixTQUFTLEVBQUUsWUFBWTtvQkFDdkIsR0FBRyxFQUFFLE1BQU0sQ0FBQyxXQUFXLENBQUM7aUJBQ3pCLENBQUMsQ0FBQztZQUNMLENBQUM7WUFFRCxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsVUFBVSxFQUFFLEVBQUUsQ0FBQyxhQUFhLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztRQUMzRCxDQUFDO1FBRUQsSUFBSSxxQkFBcUIsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUM7WUFDckMsT0FBTyxFQUFFLEdBQUcsSUFBSSxFQUFFLFdBQVcsRUFBRSxxQkFBcUIsRUFBRSxDQUFDO1FBQ3pELENBQUM7UUFFRCxPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFFTyx5QkFBeUIsQ0FBQyxLQUFLLEdBQUcsS0FBSztRQUM3QyxJQUFJLENBQUMsS0FBSyxJQUFJLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxLQUFLO1lBQUUsT0FBTztRQUNyRCxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsbUJBQW1CLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztRQUN4RSxJQUFJLE1BQU0sSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLO1lBQUUsT0FBTztRQUVsQyxJQUFJLENBQUM7WUFDSCxNQUFNLFFBQVEsR0FBSSxNQUFjLENBQUMsWUFBWSxJQUFLLE1BQWMsQ0FBQyxrQkFBa0IsQ0FBQztZQUNwRixJQUFJLENBQUMsUUFBUTtnQkFBRSxPQUFPO1lBQ3RCLE1BQU0sR0FBRyxHQUFHLElBQUksUUFBUSxFQUFFLENBQUM7WUFDM0IsTUFBTSxNQUFNLEdBQUcsR0FBRyxDQUFDLFVBQVUsRUFBRSxDQUFDO1lBQ2hDLE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBQzNDLE1BQU0sQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLE1BQU0sRUFBRSxHQUFHLENBQUMsV0FBVyxDQUFDLENBQUM7WUFDcEQsTUFBTSxDQUFDLElBQUksQ0FBQyw0QkFBNEIsQ0FBQyxVQUFVLEVBQUUsR0FBRyxDQUFDLFdBQVcsR0FBRyxLQUFLLENBQUMsQ0FBQztZQUM5RSxNQUFNLENBQUMsSUFBSSxDQUFDLDRCQUE0QixDQUFDLE1BQU0sRUFBRSxHQUFHLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQyxDQUFDO1lBQ3pFLE1BQU0sQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxDQUFDO1lBRWhDLE1BQU0sUUFBUSxHQUFHLENBQUMsU0FBaUIsRUFBRSxLQUFhLEVBQUUsUUFBZ0IsRUFBRSxFQUFFO2dCQUN0RSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztnQkFDbkMsTUFBTSxJQUFJLEdBQUcsR0FBRyxDQUFDLFVBQVUsRUFBRSxDQUFDO2dCQUM5QixHQUFHLENBQUMsSUFBSSxHQUFHLE1BQU0sQ0FBQztnQkFDbEIsR0FBRyxDQUFDLFNBQVMsQ0FBQyxjQUFjLENBQUMsU0FBUyxFQUFFLEdBQUcsQ0FBQyxXQUFXLEdBQUcsS0FBSyxDQUFDLENBQUM7Z0JBQ2pFLElBQUksQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLE1BQU0sRUFBRSxHQUFHLENBQUMsV0FBVyxHQUFHLEtBQUssQ0FBQyxDQUFDO2dCQUMxRCxJQUFJLENBQUMsSUFBSSxDQUFDLDRCQUE0QixDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsV0FBVyxHQUFHLEtBQUssR0FBRyxLQUFLLENBQUMsQ0FBQztnQkFDOUUsSUFBSSxDQUFDLElBQUksQ0FBQyw0QkFBNEIsQ0FBQyxNQUFNLEVBQUUsR0FBRyxDQUFDLFdBQVcsR0FBRyxLQUFLLEdBQUcsUUFBUSxDQUFDLENBQUM7Z0JBQ25GLEdBQUcsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ2xCLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUM7Z0JBQ3JCLEdBQUcsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLFdBQVcsR0FBRyxLQUFLLENBQUMsQ0FBQztnQkFDbkMsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsV0FBVyxHQUFHLEtBQUssR0FBRyxRQUFRLEdBQUcsSUFBSSxDQUFDLENBQUM7WUFDdEQsQ0FBQyxDQUFDO1lBRUYsUUFBUSxDQUFDLEdBQUcsRUFBRSxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDdkIsUUFBUSxDQUFDLEdBQUcsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDMUIsTUFBTSxDQUFDLFVBQVUsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSxHQUFFLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQzVELENBQUM7UUFBQyxNQUFNLENBQUM7UUFDVCxDQUFDO0lBQ0gsQ0FBQztJQUVPLHFCQUFxQjtRQUMzQixJQUFJLENBQUM7WUFDSCxNQUFNLEtBQUssR0FBRyxJQUFJLEtBQUssQ0FBQyxnOUNBQWc5QyxDQUFDLENBQUM7WUFDMStDLEtBQUssQ0FBQyxNQUFNLEdBQUcsR0FBRyxDQUFDO1lBQ25CLEtBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLEdBQUUsQ0FBQyxDQUFDLENBQUM7UUFDL0IsQ0FBQztRQUFDLE1BQU0sQ0FBQztRQUNULENBQUM7SUFDSCxDQUFDO0lBRU8sWUFBWSxDQUFDLEtBQWtCO1FBQ3JDLE1BQU0sS0FBSyxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxHQUFHLEdBQUcsTUFBTSxDQUFDLENBQUMsQ0FBQyxZQUFZLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDN0UsSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDaEMsQ0FBQztJQUVPLGtCQUFrQixDQUFDLFNBQWlCO1FBQzFDLE1BQU0sRUFBRSxHQUFHLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUM3QixJQUFJLEVBQUUsS0FBSyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLElBQUksRUFBRSxDQUFDLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQztZQUN6RSxPQUFPLHFCQUFxQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUM7UUFDekQsQ0FBQztRQUNELE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDO1FBQ3JGLE9BQU8sT0FBTyxDQUFDLENBQUMsQ0FBQyxxQkFBcUIsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxFQUFFLEVBQUUsQ0FBQztJQUNqRSxDQUFDO0lBRU8sZ0NBQWdDLENBQUMsT0FBZ0I7UUFDdkQsTUFBTSxPQUFPLEdBQUcsTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLElBQUksRUFBRSxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDckQsTUFBTSxLQUFLLEdBQUcsT0FBTyxDQUFDLEtBQUssQ0FBQyxvQ0FBb0MsQ0FBQyxDQUFDO1FBQ2xFLElBQUksQ0FBQyxLQUFLO1lBQUUsT0FBTztRQUVuQixNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQztRQUMzQyxNQUFNLE1BQU0sR0FBRyxTQUFTLENBQUMsQ0FBQyxDQUFDLHFCQUFxQixDQUFDLFNBQVMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7UUFDdEYsTUFBTSxXQUFXLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLElBQUksRUFBRSxDQUFDLFdBQVcsRUFBRSxDQUFDO1FBQ25ELElBQUksQ0FBQyxNQUFNLElBQUksV0FBVyxLQUFLLE1BQU07WUFBRSxPQUFPO1FBRTlDLE1BQU0sTUFBTSxHQUFHLE1BQU0sQ0FBQyxPQUFPLENBQUMsZUFBZSxJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBQ3JELElBQUksTUFBTSxFQUFFLENBQUM7WUFDWCxJQUFJLENBQUMsZ0JBQWdCLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDaEMsQ0FBQztJQUNILENBQUM7SUFFTywrQkFBK0IsQ0FBQyxjQUFzQixFQUFFLFFBQW1CLEVBQUUsV0FBVyxHQUFHLEtBQUs7UUFDdEcsTUFBTSxTQUFTLEdBQUcsUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFO1lBQ3RDLElBQUksQ0FBQyxDQUFDLENBQUMsVUFBVSxJQUFJLE1BQU0sQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQztnQkFBRSxPQUFPLEtBQUssQ0FBQztZQUM1RSxJQUFJLENBQUMsV0FBVztnQkFBRSxPQUFPLElBQUksQ0FBQztZQUM5QixPQUFPLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLFNBQVMsQ0FBQyxNQUFNLEtBQUssQ0FBQyxDQUFDO1FBQ2pFLENBQUMsQ0FBQyxDQUFDO1FBQ0gsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNO1lBQUUsT0FBTztRQUU5QixNQUFNLElBQUksR0FBRyxTQUFTLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FDL0IsSUFBSSxDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLElBQUksQ0FDdEMsR0FBRyxDQUFDLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxDQUFDLEVBQUUsU0FBUyxFQUFFLENBQUMsQ0FBQyxVQUFVLEVBQUUsU0FBUyxFQUFFLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsRUFDekYsVUFBVSxDQUFDLEdBQUcsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLFNBQVMsRUFBRSxDQUFDLENBQUMsVUFBVSxFQUFFLFNBQVMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQ2pFLENBQ0YsQ0FBQztRQUVGLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxPQUFPLEVBQUUsRUFBRTtZQUNuQyxNQUFNLEdBQUcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQzdDLE1BQU0sT0FBTyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsY0FBYyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQztZQUNyRCxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU07Z0JBQUUsT0FBTztZQUU1QixJQUFJLE9BQU8sR0FBRyxLQUFLLENBQUM7WUFDcEIsS0FBSyxNQUFNLE1BQU0sSUFBSSxPQUFPLEVBQUUsQ0FBQztnQkFDN0IsTUFBTSxHQUFHLEdBQUcsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsS0FBSyxNQUFNLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7Z0JBQ3hGLElBQUksR0FBRyxLQUFLLENBQUMsQ0FBQztvQkFBRSxTQUFTO2dCQUN6QixPQUFPLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsRUFBRSxTQUFTLEVBQUUsTUFBTSxDQUFDLFNBQVMsRUFBRSxDQUFDO2dCQUNoRSxPQUFPLEdBQUcsSUFBSSxDQUFDO1lBQ2pCLENBQUM7WUFFRCxJQUFJLE9BQU8sRUFBRSxDQUFDO2dCQUNaLEdBQUcsQ0FBQyxHQUFHLENBQUMsY0FBYyxFQUFFLE9BQU8sQ0FBQyxDQUFDO2dCQUNqQyxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUM5QixDQUFDO1FBQ0gsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0lBRU8sdUJBQXVCLENBQUMsU0FBaUI7UUFDL0MsSUFBSSxDQUFDLFNBQVMsSUFBSSxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQztZQUFFLE9BQU87UUFFaEUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDLENBQUMsU0FBUyxDQUFDO1lBQ3pDLElBQUksRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFO2dCQUNiLE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDcEQsTUFBTSxHQUFHLEdBQUcsSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxLQUFLLENBQUMsQ0FBQztnQkFDN0MsSUFBSSxPQUFPLEdBQUcsS0FBSyxDQUFDO2dCQUVwQixLQUFLLE1BQU0sQ0FBQyxjQUFjLEVBQUUsSUFBSSxDQUFDLElBQUksR0FBRyxDQUFDLE9BQU8sRUFBRSxFQUFFLENBQUM7b0JBQ25ELE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLEtBQUssTUFBTSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7b0JBQzlFLElBQUksR0FBRyxLQUFLLENBQUMsQ0FBQzt3QkFBRSxTQUFTO29CQUN6QixNQUFNLFFBQVEsR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUM7b0JBQzNCLFFBQVEsQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLEdBQUcsUUFBUSxDQUFDLEdBQUcsQ0FBQyxFQUFFLFNBQVMsRUFBRSxVQUFVLEVBQUUsQ0FBQztvQkFDNUQsR0FBRyxDQUFDLEdBQUcsQ0FBQyxjQUFjLEVBQUUsUUFBUSxDQUFDLENBQUM7b0JBQ2xDLE9BQU8sR0FBRyxJQUFJLENBQUM7b0JBQ2YsTUFBTTtnQkFDUixDQUFDO2dCQUVELElBQUksT0FBTyxFQUFFLENBQUM7b0JBQ1osSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7Z0JBQzlCLENBQUM7WUFDSCxDQUFDO1lBQ0QsS0FBSyxFQUFFLEdBQUcsRUFBRSxHQUFFLENBQUM7U0FDaEIsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVPLHFCQUFxQixDQUFDLElBQVc7UUFDdkMsTUFBTSxPQUFPLEdBQUcsSUFBSSxHQUFHLEVBQXFGLENBQUM7UUFDN0csTUFBTSxXQUFXLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBQ3RELE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUM7UUFDN0MsTUFBTSxhQUFhLEdBQUcsQ0FBQyxLQUFVLEVBQVMsRUFBRTtZQUMxQyxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDO2dCQUFFLE9BQU8sS0FBSyxDQUFDO1lBQ3ZDLElBQUksS0FBSyxJQUFJLE9BQU8sS0FBSyxLQUFLLFFBQVE7Z0JBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ3ZELElBQUksT0FBTyxLQUFLLEtBQUssUUFBUSxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRTtnQkFBRSxPQUFPLEVBQUUsQ0FBQztZQUUxRCxNQUFNLE9BQU8sR0FBRyxLQUFLLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDN0IsSUFBSSxPQUFPLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQztnQkFDdkQsSUFBSSxDQUFDO29CQUNILE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUM7b0JBQ25DLE9BQU8sS0FBSyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDO2dCQUNuRCxDQUFDO2dCQUFDLE1BQU0sQ0FBQztvQkFDUCxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUM7Z0JBQ25CLENBQUM7WUFDSCxDQUFDO1lBRUQsT0FBTyxPQUFPLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQVMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ3pFLENBQUMsQ0FBQztRQUVGLE1BQU0scUJBQXFCLEdBQUcsQ0FBQyxPQUFZLEVBQVUsRUFBRTtZQUNyRCxJQUFJLE9BQU8sSUFBSSxJQUFJO2dCQUFFLE9BQU8sRUFBRSxDQUFDO1lBQy9CLElBQUksT0FBTyxPQUFPLEtBQUssUUFBUSxFQUFFLENBQUM7Z0JBQ2hDLE1BQU0sT0FBTyxHQUFHLE9BQU8sQ0FBQyxJQUFJLEVBQUUsQ0FBQztnQkFDL0IsSUFBSSxDQUFDLE9BQU87b0JBQUUsT0FBTyxFQUFFLENBQUM7Z0JBQ3hCLElBQUksT0FBTyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsSUFBSSxPQUFPLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUM7b0JBQ3ZELE1BQU0sTUFBTSxHQUFHLGFBQWEsQ0FBQyxPQUFPLENBQUMsQ0FBQztvQkFDdEMsT0FBTyxNQUFNLENBQUMsR0FBRyxDQUFDLHFCQUFxQixDQUFDLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDdEUsQ0FBQztnQkFDRCxPQUFPLE9BQU8sQ0FBQztZQUNqQixDQUFDO1lBRUQsTUFBTSxTQUFTLEdBQUcsTUFBTSxDQUFDLE9BQU8sRUFBRSxVQUFVLElBQUksT0FBTyxFQUFFLFNBQVMsSUFBSSxPQUFPLEVBQUUsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDO1lBQ2hHLElBQUksU0FBUyxJQUFJLFNBQVMsS0FBSyxXQUFXO2dCQUFFLE9BQU8sS0FBSyxDQUFDO1lBRXpELE1BQU0sWUFBWSxHQUFHLE1BQU0sQ0FDekIsT0FBTyxFQUFFLFFBQVE7Z0JBQ2pCLE9BQU8sRUFBRSxJQUFJO2dCQUNiLE9BQU8sRUFBRSxZQUFZO2dCQUNyQixPQUFPLEVBQUUsV0FBVztnQkFDcEIsT0FBTyxFQUFFLEtBQUs7Z0JBQ2QsRUFBRSxDQUNILENBQUMsSUFBSSxFQUFFLENBQUM7WUFDVCxJQUFJLFlBQVk7Z0JBQUUsT0FBTyxZQUFZLENBQUM7WUFFdEMsSUFBSSxTQUFTLEVBQUUsQ0FBQztnQkFDZCxNQUFNLE9BQU8sR0FBRyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsS0FBSyxTQUFTLENBQUMsQ0FBQztnQkFDdkUsT0FBTyxPQUFPLENBQUMsQ0FBQyxDQUFDLHFCQUFxQixDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLFNBQVMsRUFBRSxDQUFDO1lBQ3hFLENBQUM7WUFFRCxPQUFPLEVBQUUsQ0FBQztRQUNaLENBQUMsQ0FBQztRQUVGLEtBQUssTUFBTSxHQUFHLElBQUksSUFBSSxJQUFJLEVBQUUsRUFBRSxDQUFDO1lBQzdCLE1BQU0sS0FBSyxHQUFHLE1BQU0sQ0FBQyxHQUFHLEVBQUUsS0FBSyxJQUFJLEVBQUUsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDO1lBQzlDLElBQUksQ0FBQyxLQUFLO2dCQUFFLFNBQVM7WUFFckIsTUFBTSxTQUFTLEdBQUcsTUFBTSxDQUFDLEdBQUcsRUFBRSxVQUFVLElBQUksR0FBRyxFQUFFLFNBQVMsSUFBSSxFQUFFLENBQUMsQ0FBQztZQUNsRSxNQUFNLGtCQUFrQixHQUFHLEdBQUcsRUFBRSxVQUFVLElBQUksR0FBRyxFQUFFLFdBQVcsQ0FBQztZQUMvRCxNQUFNLFVBQVUsR0FBRyxrQkFBa0IsS0FBSyxJQUFJLElBQUksQ0FBQyxTQUFTLElBQUksU0FBUyxLQUFLLFdBQVcsQ0FBQyxDQUFDO1lBRTNGLE1BQU0sV0FBVyxHQUNmLEdBQUcsRUFBRSxRQUFRO2dCQUNiLEdBQUcsRUFBRSxhQUFhO2dCQUNsQixHQUFHLEVBQUUsWUFBWTtnQkFDakIsR0FBRyxFQUFFLFVBQVU7Z0JBQ2YsR0FBRyxFQUFFLFNBQVM7Z0JBQ2QsR0FBRyxFQUFFLEtBQUs7Z0JBQ1YsRUFBRSxDQUFDO1lBQ0wsTUFBTSxXQUFXLEdBQUcsYUFBYSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1lBQy9DLE1BQU0sWUFBWSxHQUFHLE1BQU0sQ0FBQyxHQUFHLEVBQUUsS0FBSyxJQUFJLEdBQUcsRUFBRSxjQUFjLElBQUksR0FBRyxFQUFFLGFBQWEsSUFBSSxXQUFXLENBQUMsTUFBTSxJQUFJLENBQUMsQ0FBQyxDQUFDO1lBQ2hILE1BQU0sUUFBUSxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxVQUFVLEVBQUUsS0FBSyxFQUFFLFFBQVEsRUFBRSxFQUFFLEVBQUUsQ0FBQztZQUU1RiwyRUFBMkU7WUFDM0UsUUFBUSxDQUFDLEtBQUssSUFBSSxZQUFZLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUN0RCxRQUFRLENBQUMsVUFBVSxHQUFHLFFBQVEsQ0FBQyxVQUFVLElBQUksQ0FBQyxDQUFDLFVBQVUsQ0FBQztZQUUxRCxxRUFBcUU7WUFDckUsSUFBSSxTQUFTLElBQUksWUFBWSxJQUFJLENBQUMsRUFBRSxDQUFDO2dCQUNuQyxJQUFJLElBQVksQ0FBQztnQkFDakIsSUFBSSxTQUFTLEtBQUssV0FBVyxFQUFFLENBQUM7b0JBQzlCLElBQUksR0FBRyxLQUFLLENBQUM7Z0JBQ2YsQ0FBQztxQkFBTSxDQUFDO29CQUNOLE1BQU0sT0FBTyxHQUFHLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxLQUFLLFNBQVMsQ0FBQyxDQUFDO29CQUN2RSxJQUFJLEdBQUcsT0FBTyxDQUFDLENBQUMsQ0FBQyxxQkFBcUIsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxTQUFTLEVBQUUsQ0FBQztnQkFDeEUsQ0FBQztnQkFDRCxJQUFJLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztvQkFDdEMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQy9CLENBQUM7WUFDSCxDQUFDO1lBRUQsS0FBSyxNQUFNLE9BQU8sSUFBSSxXQUFXLEVBQUUsQ0FBQztnQkFDbEMsTUFBTSxTQUFTLEdBQUcsTUFBTSxDQUN0QixPQUFPLE9BQU8sS0FBSyxRQUFRO29CQUN6QixDQUFDLENBQUMsT0FBTyxFQUFFLFVBQVUsSUFBSSxPQUFPLEVBQUUsU0FBUyxJQUFJLE9BQU8sRUFBRSxFQUFFLElBQUksRUFBRTtvQkFDaEUsQ0FBQyxDQUFDLEVBQUUsQ0FDUCxDQUFDLElBQUksRUFBRSxDQUFDO2dCQUNULE1BQU0sSUFBSSxHQUFHLHFCQUFxQixDQUFDLE9BQU8sQ0FBQyxDQUFDO2dCQUM1QyxJQUFJLFNBQVMsSUFBSSxTQUFTLEtBQUssV0FBVyxFQUFFLENBQUM7b0JBQzNDLFFBQVEsQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDO2dCQUM3QixDQUFDO2dCQUNELElBQUksSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztvQkFDOUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQy9CLENBQUM7WUFDSCxDQUFDO1lBRUQsTUFBTSxVQUFVLEdBQUcsTUFBTSxDQUN2QixHQUFHLEVBQUUsWUFBWTtnQkFDakIsR0FBRyxFQUFFLFdBQVc7Z0JBQ2hCLEdBQUcsRUFBRSxZQUFZO2dCQUNqQixHQUFHLEVBQUUsV0FBVztnQkFDaEIsR0FBRyxFQUFFLFFBQVE7Z0JBQ2IsR0FBRyxFQUFFLEtBQUs7Z0JBQ1YsRUFBRSxDQUNILENBQUMsSUFBSSxFQUFFLENBQUM7WUFDVCxJQUFJLFVBQVUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUM7Z0JBQzFELFFBQVEsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLFNBQVMsS0FBSyxXQUFXLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUM7WUFDekUsQ0FBQztZQUVELE9BQU8sQ0FBQyxHQUFHLENBQUMsS0FBSyxFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBQy9CLENBQUM7UUFFRCxPQUFPLEtBQUssQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBQ2pFLENBQUM7SUFFTywyQkFBMkIsQ0FBQyxTQUFpQixFQUFFLEtBQWEsRUFBRSxHQUFZO1FBQ2hGLE1BQU0sR0FBRyxHQUFHLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDN0MsSUFBSSxTQUFTLEdBQUcsS0FBSyxDQUFDO1FBRXRCLEtBQUssTUFBTSxDQUFDLGNBQWMsRUFBRSxJQUFJLENBQUMsSUFBSSxHQUFHLENBQUMsT0FBTyxFQUFFLEVBQUUsQ0FBQztZQUNuRCxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxLQUFLLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO1lBQzlFLElBQUksR0FBRyxLQUFLLENBQUMsQ0FBQztnQkFBRSxTQUFTO1lBRXpCLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUN6QixNQUFNLGFBQWEsR0FBRyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsU0FBUyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDcEQsTUFBTSxJQUFJLEdBQUcsYUFBYSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLEtBQUssS0FBSyxLQUFLLENBQUMsQ0FBQztZQUUvRCxJQUFJLEdBQUcsRUFBRSxDQUFDO2dCQUNSLElBQUksSUFBSSxJQUFJLENBQUMsRUFBRSxDQUFDO29CQUNkLE1BQU0sT0FBTyxHQUFHLGFBQWEsQ0FBQyxJQUFJLENBQUMsQ0FBQztvQkFDcEMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxVQUFVLEVBQUUsQ0FBQzt3QkFDeEIsTUFBTSxRQUFRLEdBQUcsS0FBSyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQzt3QkFDOUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDOzRCQUFFLFFBQVEsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUM7d0JBQ3ZELGFBQWEsQ0FBQyxJQUFJLENBQUMsR0FBRzs0QkFDcEIsR0FBRyxPQUFPOzRCQUNWLFVBQVUsRUFBRSxJQUFJOzRCQUNoQixLQUFLLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxLQUFLLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQzs0QkFDckMsUUFBUTt5QkFDVCxDQUFDO29CQUNKLENBQUM7Z0JBQ0gsQ0FBQztxQkFBTSxDQUFDO29CQUNOLGFBQWEsQ0FBQyxJQUFJLENBQUMsRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxVQUFVLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQztnQkFDL0UsQ0FBQztZQUNILENBQUM7aUJBQU0sQ0FBQztnQkFDTixJQUFJLElBQUksSUFBSSxDQUFDLEVBQUUsQ0FBQztvQkFDZCxNQUFNLE9BQU8sR0FBRyxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUM7b0JBQ3BDLE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxLQUFLLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO29CQUN6RixJQUFJLFNBQVMsS0FBSyxDQUFDLEVBQUUsQ0FBQzt3QkFDcEIsYUFBYSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUM7b0JBQ2hDLENBQUM7eUJBQU0sQ0FBQzt3QkFDTixhQUFhLENBQUMsSUFBSSxDQUFDLEdBQUc7NEJBQ3BCLEdBQUcsT0FBTzs0QkFDVixVQUFVLEVBQUUsS0FBSzs0QkFDakIsS0FBSyxFQUFFLFNBQVM7NEJBQ2hCLFFBQVEsRUFBRSxLQUFLLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUM7Z0NBQ3ZDLENBQUMsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQVksRUFBRSxFQUFFLENBQUMsSUFBSSxLQUFLLEtBQUssQ0FBQztnQ0FDM0QsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxRQUFRO3lCQUNyQixDQUFDO29CQUNKLENBQUM7Z0JBQ0gsQ0FBQztZQUNILENBQUM7WUFFRCxNQUFNLFVBQVUsR0FBWSxFQUFFLEdBQUcsTUFBTSxFQUFFLFNBQVMsRUFBRSxhQUFhLEVBQUUsQ0FBQztZQUNwRSxNQUFNLFdBQVcsR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUM7WUFDOUIsV0FBVyxDQUFDLEdBQUcsQ0FBQyxHQUFHLFVBQVUsQ0FBQztZQUM5QixHQUFHLENBQUMsR0FBRyxDQUFDLGNBQWMsRUFBRSxXQUFXLENBQUMsQ0FBQztZQUNyQyxTQUFTLEdBQUcsSUFBSSxDQUFDO1lBQ2pCLE1BQU07UUFDUixDQUFDO1FBRUQsSUFBSSxTQUFTLEVBQUUsQ0FBQztZQUNkLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQzlCLENBQUM7SUFDSCxDQUFDO3dHQXZzRFUscUJBQXFCOzRHQUFyQixxQkFBcUIsY0FEUixNQUFNOzs0RkFDbkIscUJBQXFCO2tCQURqQyxVQUFVO21CQUFDLEVBQUUsVUFBVSxFQUFFLE1BQU0sRUFBRSIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEluamVjdGFibGUsIE9uRGVzdHJveSB9IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xyXG5pbXBvcnQgeyBCZWhhdmlvclN1YmplY3QsIE9ic2VydmFibGUsIFN1YmplY3QsIFN1YnNjcmlwdGlvbiwgZm9ya0pvaW4sIG9mIH0gZnJvbSAncnhqcyc7XHJcbmltcG9ydCB7IGNhdGNoRXJyb3IsIG1hcCB9IGZyb20gJ3J4anMvb3BlcmF0b3JzJztcclxuaW1wb3J0IHsgQXV0aFNlcnZpY2UgfSBmcm9tICcuL2F1dGguc2VydmljZSc7XHJcbmltcG9ydCB7IE1lc3NhZ2luZ0FwaVNlcnZpY2UgfSBmcm9tICcuL21lc3NhZ2luZy1hcGkuc2VydmljZSc7XHJcbmltcG9ydCB7IE1lc3NhZ2luZ1dlYlNvY2tldFNlcnZpY2UgfSBmcm9tICcuL21lc3NhZ2luZy13ZWJzb2NrZXQuc2VydmljZSc7XHJcbmltcG9ydCB7XHJcbiAgSW5ib3hJdGVtLFxyXG4gIE1lc3NhZ2UsXHJcbiAgTWVzc2FnZVJlcGx5UHJldmlldyxcclxuICBQTEFJTl9URVhUX01FU1NBR0VfUFJFRklYLFxyXG4gIEF0dGFjaG1lbnQsXHJcbiAgQ29udGFjdCxcclxuICBDaGF0V2luZG93LFxyXG4gIFdlYlNvY2tldE1lc3NhZ2UsXHJcbiAgU2lkZWJhclNpZGUsXHJcbiAgZ2V0Q29udGFjdERpc3BsYXlOYW1lLFxyXG4gIGdldE1lc3NhZ2VTZW5kZXJOYW1lLFxyXG59IGZyb20gJy4uL21vZGVscy9tZXNzYWdpbmcubW9kZWxzJztcclxuXHJcbkBJbmplY3RhYmxlKHsgcHJvdmlkZWRJbjogJ3Jvb3QnIH0pXHJcbmV4cG9ydCBjbGFzcyBNZXNzYWdpbmdTdG9yZVNlcnZpY2UgaW1wbGVtZW50cyBPbkRlc3Ryb3kge1xyXG4gIC8vIOKUgOKUgCBTdGF0ZSBzdWJqZWN0cyDilIDilIBcclxuICBwcml2YXRlIGluYm94JCA9IG5ldyBCZWhhdmlvclN1YmplY3Q8SW5ib3hJdGVtW10+KFtdKTtcclxuICBwcml2YXRlIG1lc3NhZ2VzTWFwJCA9IG5ldyBCZWhhdmlvclN1YmplY3Q8TWFwPHN0cmluZywgTWVzc2FnZVtdPj4obmV3IE1hcCgpKTtcclxuICBwcml2YXRlIG9wZW5DaGF0cyQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PENoYXRXaW5kb3dbXT4oW10pO1xyXG4gIHByaXZhdGUgdmlzaWJsZUNvbnRhY3RzJCA9IG5ldyBCZWhhdmlvclN1YmplY3Q8Q29udGFjdFtdPihbXSk7XHJcbiAgcHJpdmF0ZSBwYW5lbE9wZW4kID0gbmV3IEJlaGF2aW9yU3ViamVjdDxib29sZWFuPihmYWxzZSk7XHJcbiAgcHJpdmF0ZSBhY3RpdmVWaWV3JCA9IG5ldyBCZWhhdmlvclN1YmplY3Q8J2luYm94JyB8ICdjaGF0JyB8ICduZXctY29udmVyc2F0aW9uJyB8ICdncm91cC1tYW5hZ2VyJyB8ICdjb252ZXJzYXRpb24tc2V0dGluZ3MnPignaW5ib3gnKTtcclxuICBwcml2YXRlIHNpZGViYXJTaWRlJCA9IG5ldyBCZWhhdmlvclN1YmplY3Q8U2lkZWJhclNpZGU+KFxyXG4gICAgKGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdtZXNzYWdpbmdfc2lkZWJhcl9zaWRlJykgYXMgU2lkZWJhclNpZGUpIHx8ICdyaWdodCdcclxuICApO1xyXG4gIHByaXZhdGUgYWN0aXZlQ29udmVyc2F0aW9uSWQkID0gbmV3IEJlaGF2aW9yU3ViamVjdDxzdHJpbmcgfCBudWxsPihudWxsKTtcclxuICBwcml2YXRlIHBlbmRpbmdEbVJlY2lwaWVudCQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PHtjb250YWN0SWQ6IHN0cmluZywgbmFtZTogc3RyaW5nfSB8IG51bGw+KG51bGwpO1xyXG4gIHByaXZhdGUgdG90YWxVbnJlYWQkID0gbmV3IEJlaGF2aW9yU3ViamVjdDxudW1iZXI+KDApO1xyXG4gIHByaXZhdGUgbG9hZGluZ01lc3NhZ2VzJCA9IG5ldyBCZWhhdmlvclN1YmplY3Q8Ym9vbGVhbj4oZmFsc2UpO1xyXG4gIHByaXZhdGUgcGFuZWxQb3NpdGlvbiQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PHsgeDogbnVtYmVyOyB5OiBudW1iZXIgfSB8IG51bGw+KG51bGwpO1xyXG4gIHByaXZhdGUgcGFuZWxTaXplJCA9IG5ldyBCZWhhdmlvclN1YmplY3Q8eyB3aWR0aDogbnVtYmVyOyBoZWlnaHQ6IG51bWJlciB9Pih7IHdpZHRoOiAzODAsIGhlaWdodDogNTYwIH0pO1xyXG4gIHByaXZhdGUgd2FzT3BlbkJlZm9yZURyYWckID0gbmV3IEJlaGF2aW9yU3ViamVjdDxib29sZWFuPihmYWxzZSk7XHJcbiAgcHJpdmF0ZSBwYW5lbEZsb2F0aW5nJCA9IG5ldyBCZWhhdmlvclN1YmplY3Q8Ym9vbGVhbj4oZmFsc2UpO1xyXG4gIHByaXZhdGUgbm90aWZpY2F0aW9uVm9sdW1lJCA9IG5ldyBCZWhhdmlvclN1YmplY3Q8bnVtYmVyPihcclxuICAgIE51bWJlcihsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnbWVzc2FnaW5nX25vdGlmaWNhdGlvbl92b2x1bWUnKSA/PyAnMC4zNScpXHJcbiAgKTtcclxuICBwcml2YXRlIG5vdGlmaWNhdGlvbnNNdXRlZCQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PGJvb2xlYW4+KFxyXG4gICAgbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ21lc3NhZ2luZ19ub3RpZmljYXRpb25zX211dGVkJykgPT09ICd0cnVlJ1xyXG4gICk7XHJcbiAgcHJpdmF0ZSBtZXNzYWdlVGV4dFNjYWxlJCA9IG5ldyBCZWhhdmlvclN1YmplY3Q8bnVtYmVyPihcclxuICAgIE51bWJlcihsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnbWVzc2FnaW5nX21lc3NhZ2VfdGV4dF9zY2FsZScpID8/ICcxJylcclxuICApO1xyXG4gIHByaXZhdGUgY29kZVRleHRTY2FsZSQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PG51bWJlcj4oXHJcbiAgICBOdW1iZXIobG9jYWxTdG9yYWdlLmdldEl0ZW0oJ21lc3NhZ2luZ19jb2RlX3RleHRfc2NhbGUnKSA/PyAnMScpXHJcbiAgKTtcclxuICBwcml2YXRlIHRvYXN0JCA9IG5ldyBCZWhhdmlvclN1YmplY3Q8eyBtZXNzYWdlOiBzdHJpbmc7IHR5cGU6ICdpbmZvJyB8ICdzdWNjZXNzJyB8ICdlcnJvcicgfSB8IG51bGw+KG51bGwpO1xyXG4gIHByaXZhdGUgcmVtb3ZlZEdyb3VwSWRzJCA9IG5ldyBCZWhhdmlvclN1YmplY3Q8U2V0PHN0cmluZz4+KG5ldyBTZXQoKSk7XHJcbiAgcHJpdmF0ZSBtZW50aW9uQ29udmVyc2F0aW9uSWRzJCA9IG5ldyBCZWhhdmlvclN1YmplY3Q8U2V0PHN0cmluZz4+KG5ldyBTZXQoKSk7XHJcbiAgcHJpdmF0ZSBncm91cE1lbWJlcnNoaXBWZXJzaW9uJCA9IG5ldyBCZWhhdmlvclN1YmplY3Q8bnVtYmVyPigwKTtcclxuXHJcbiAgLy8g4pSA4pSAIFB1YmxpYyBvYnNlcnZhYmxlcyDilIDilIBcclxuICByZWFkb25seSBpbmJveCA9IHRoaXMuaW5ib3gkLmFzT2JzZXJ2YWJsZSgpO1xyXG4gIHJlYWRvbmx5IG1lc3NhZ2VzTWFwID0gdGhpcy5tZXNzYWdlc01hcCQuYXNPYnNlcnZhYmxlKCk7XHJcbiAgcmVhZG9ubHkgb3BlbkNoYXRzID0gdGhpcy5vcGVuQ2hhdHMkLmFzT2JzZXJ2YWJsZSgpO1xyXG4gIHJlYWRvbmx5IHZpc2libGVDb250YWN0cyA9IHRoaXMudmlzaWJsZUNvbnRhY3RzJC5hc09ic2VydmFibGUoKTtcclxuICByZWFkb25seSBwYW5lbE9wZW4gPSB0aGlzLnBhbmVsT3BlbiQuYXNPYnNlcnZhYmxlKCk7XHJcbiAgcmVhZG9ubHkgYWN0aXZlVmlldyA9IHRoaXMuYWN0aXZlVmlldyQuYXNPYnNlcnZhYmxlKCk7XHJcbiAgcmVhZG9ubHkgYWN0aXZlQ29udmVyc2F0aW9uSWQgPSB0aGlzLmFjdGl2ZUNvbnZlcnNhdGlvbklkJC5hc09ic2VydmFibGUoKTtcclxuICByZWFkb25seSB0b3RhbFVucmVhZCA9IHRoaXMudG90YWxVbnJlYWQkLmFzT2JzZXJ2YWJsZSgpO1xyXG4gIHJlYWRvbmx5IGxvYWRpbmdNZXNzYWdlcyA9IHRoaXMubG9hZGluZ01lc3NhZ2VzJC5hc09ic2VydmFibGUoKTtcclxuICB3c1N0YXR1czogT2JzZXJ2YWJsZTxzdHJpbmc+ID0gbmV3IE9ic2VydmFibGU8c3RyaW5nPigpO1xyXG4gIHJlYWRvbmx5IHBhbmVsUG9zaXRpb24gPSB0aGlzLnBhbmVsUG9zaXRpb24kLmFzT2JzZXJ2YWJsZSgpO1xyXG4gIHJlYWRvbmx5IHBhbmVsU2l6ZSA9IHRoaXMucGFuZWxTaXplJC5hc09ic2VydmFibGUoKTtcclxuICByZWFkb25seSB3YXNPcGVuQmVmb3JlRHJhZyA9IHRoaXMud2FzT3BlbkJlZm9yZURyYWckLmFzT2JzZXJ2YWJsZSgpO1xyXG4gIHJlYWRvbmx5IHNpZGViYXJTaWRlID0gdGhpcy5zaWRlYmFyU2lkZSQuYXNPYnNlcnZhYmxlKCk7XHJcbiAgcmVhZG9ubHkgcGFuZWxGbG9hdGluZyA9IHRoaXMucGFuZWxGbG9hdGluZyQuYXNPYnNlcnZhYmxlKCk7XHJcbiAgcmVhZG9ubHkgbm90aWZpY2F0aW9uVm9sdW1lID0gdGhpcy5ub3RpZmljYXRpb25Wb2x1bWUkLmFzT2JzZXJ2YWJsZSgpO1xyXG4gIHJlYWRvbmx5IG5vdGlmaWNhdGlvbnNNdXRlZCA9IHRoaXMubm90aWZpY2F0aW9uc011dGVkJC5hc09ic2VydmFibGUoKTtcclxuICByZWFkb25seSBtZXNzYWdlVGV4dFNjYWxlID0gdGhpcy5tZXNzYWdlVGV4dFNjYWxlJC5hc09ic2VydmFibGUoKTtcclxuICByZWFkb25seSBjb2RlVGV4dFNjYWxlID0gdGhpcy5jb2RlVGV4dFNjYWxlJC5hc09ic2VydmFibGUoKTtcclxuICByZWFkb25seSB0b2FzdCA9IHRoaXMudG9hc3QkLmFzT2JzZXJ2YWJsZSgpO1xyXG4gIHJlYWRvbmx5IHJlbW92ZWRHcm91cElkcyA9IHRoaXMucmVtb3ZlZEdyb3VwSWRzJC5hc09ic2VydmFibGUoKTtcclxuICByZWFkb25seSBtZW50aW9uQ29udmVyc2F0aW9uSWRzID0gdGhpcy5tZW50aW9uQ29udmVyc2F0aW9uSWRzJC5hc09ic2VydmFibGUoKTtcclxuICByZWFkb25seSBncm91cE1lbWJlcnNoaXBWZXJzaW9uID0gdGhpcy5ncm91cE1lbWJlcnNoaXBWZXJzaW9uJC5hc09ic2VydmFibGUoKTtcclxuXHJcbiAgcHJpdmF0ZSB3c1N1YjogU3Vic2NyaXB0aW9uIHwgbnVsbCA9IG51bGw7XHJcbiAgcHJpdmF0ZSBkZXN0cm95JCA9IG5ldyBTdWJqZWN0PHZvaWQ+KCk7XHJcbiAgcHJpdmF0ZSBwb2xsVGltZXI6IGFueSA9IG51bGw7XHJcbiAgcHJpdmF0ZSBncm91cFNldHRpbmdzJCA9IG5ldyBCZWhhdmlvclN1YmplY3Q8eyBjb252ZXJzYXRpb25JZDogc3RyaW5nOyBuYW1lOiBzdHJpbmcgfSB8IG51bGw+KG51bGwpO1xyXG4gIHByaXZhdGUgZGVsZXRpbmdDb252ZXJzYXRpb25JZHMgPSBuZXcgU2V0PHN0cmluZz4oKTtcclxuICBwcml2YXRlIHJlbW92YWxUb2FzdFNob3duID0gbmV3IFNldDxzdHJpbmc+KCk7XHJcbiAgcHJpdmF0ZSB0b2FzdFRpbWVyOiBhbnkgPSBudWxsO1xyXG5cclxuICByZWFkb25seSBncm91cFNldHRpbmdzID0gdGhpcy5ncm91cFNldHRpbmdzJC5hc09ic2VydmFibGUoKTtcclxuXHJcbiAgY29uc3RydWN0b3IoXHJcbiAgICBwcml2YXRlIGF1dGg6IEF1dGhTZXJ2aWNlLFxyXG4gICAgcHJpdmF0ZSBhcGk6IE1lc3NhZ2luZ0FwaVNlcnZpY2UsXHJcbiAgICBwcml2YXRlIHdzU2VydmljZTogTWVzc2FnaW5nV2ViU29ja2V0U2VydmljZVxyXG4gICkge1xyXG4gICAgKHRoaXMgYXMgYW55KS53c1N0YXR1cyA9IHRoaXMud3NTZXJ2aWNlLnN0YXR1cyQ7XHJcbiAgfVxyXG5cclxuICAvLyDilIDilIAgSW5pdGlhbGl6YXRpb24g4pSA4pSAXHJcbiAgaW5pdGlhbGl6ZSgpOiB2b2lkIHtcclxuICAgIGlmICghdGhpcy5hdXRoLmlzQXV0aGVudGljYXRlZCgpKSByZXR1cm47XHJcblxyXG4gICAgY29uc3QgY29udGFjdElkID0gdGhpcy5hdXRoLmNvbnRhY3RJZCE7XHJcbiAgICBjb25zdCBzZXNzaW9uR2lkID0gdGhpcy5hdXRoLnNlc3Npb25HaWQhO1xyXG5cclxuICAgIHRoaXMubG9hZEluYm94KCk7XHJcbiAgICB0aGlzLmxvYWRWaXNpYmxlQ29udGFjdHMoKTtcclxuXHJcbiAgICB0aGlzLndzU2VydmljZS5jb25uZWN0KGNvbnRhY3RJZCwgc2Vzc2lvbkdpZCk7XHJcbiAgICB0aGlzLmxpc3RlbldlYlNvY2tldCgpO1xyXG4gICAgdGhpcy5zdGFydFBvbGxpbmcoKTtcclxuICB9XHJcblxyXG4gIHRlYXJkb3duKCk6IHZvaWQge1xyXG4gICAgdGhpcy5zdG9wUG9sbGluZygpO1xyXG4gICAgaWYgKHRoaXMudG9hc3RUaW1lcikge1xyXG4gICAgICBjbGVhclRpbWVvdXQodGhpcy50b2FzdFRpbWVyKTtcclxuICAgICAgdGhpcy50b2FzdFRpbWVyID0gbnVsbDtcclxuICAgIH1cclxuICAgIHRoaXMud3NTZXJ2aWNlLmRpc2Nvbm5lY3QoKTtcclxuICAgIHRoaXMud3NTdWI/LnVuc3Vic2NyaWJlKCk7XHJcbiAgICB0aGlzLmluYm94JC5uZXh0KFtdKTtcclxuICAgIHRoaXMubWVzc2FnZXNNYXAkLm5leHQobmV3IE1hcCgpKTtcclxuICAgIHRoaXMub3BlbkNoYXRzJC5uZXh0KFtdKTtcclxuICAgIHRoaXMucGFuZWxPcGVuJC5uZXh0KGZhbHNlKTtcclxuICAgIHRoaXMuYWN0aXZlVmlldyQubmV4dCgnaW5ib3gnKTtcclxuICAgIHRoaXMuYWN0aXZlQ29udmVyc2F0aW9uSWQkLm5leHQobnVsbCk7XHJcbiAgICB0aGlzLnRvdGFsVW5yZWFkJC5uZXh0KDApO1xyXG4gICAgdGhpcy5kZWxldGluZ0NvbnZlcnNhdGlvbklkcy5jbGVhcigpO1xyXG4gICAgdGhpcy5yZW1vdmFsVG9hc3RTaG93bi5jbGVhcigpO1xyXG4gICAgdGhpcy5yZW1vdmVkR3JvdXBJZHMkLm5leHQobmV3IFNldCgpKTtcclxuICAgIHRoaXMubWVudGlvbkNvbnZlcnNhdGlvbklkcyQubmV4dChuZXcgU2V0KCkpO1xyXG4gICAgdGhpcy5ncm91cE1lbWJlcnNoaXBWZXJzaW9uJC5uZXh0KDApO1xyXG4gICAgdGhpcy50b2FzdCQubmV4dChudWxsKTtcclxuICB9XHJcblxyXG4gIC8vIOKUgOKUgCBQb2xsaW5nIGZhbGxiYWNrIChpbmJveCBvbmx5IC0gbWVzc2FnZXMgcmVseSBvbiBXZWJTb2NrZXQpIOKUgOKUgFxyXG4gIHByaXZhdGUgc3RhcnRQb2xsaW5nKCk6IHZvaWQge1xyXG4gICAgdGhpcy5zdG9wUG9sbGluZygpO1xyXG4gICAgdGhpcy5wb2xsVGltZXIgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XHJcbiAgICAgIHRoaXMubG9hZEluYm94KCk7XHJcbiAgICB9LCAzMDAwMCk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHN0b3BQb2xsaW5nKCk6IHZvaWQge1xyXG4gICAgaWYgKHRoaXMucG9sbFRpbWVyKSB7XHJcbiAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy5wb2xsVGltZXIpO1xyXG4gICAgICB0aGlzLnBvbGxUaW1lciA9IG51bGw7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBuZ09uRGVzdHJveSgpOiB2b2lkIHtcclxuICAgIHRoaXMudGVhcmRvd24oKTtcclxuICAgIHRoaXMuZGVzdHJveSQubmV4dCgpO1xyXG4gICAgdGhpcy5kZXN0cm95JC5jb21wbGV0ZSgpO1xyXG4gIH1cclxuXHJcbiAgLy8g4pSA4pSAIFBhbmVsIGNvbnRyb2xzIOKUgOKUgFxyXG4gIHRvZ2dsZVBhbmVsKGJ1dHRvblg/OiBudW1iZXIsIGJ1dHRvblk/OiBudW1iZXIpOiB2b2lkIHtcclxuICAgIGlmIChidXR0b25YICE9PSB1bmRlZmluZWQgJiYgYnV0dG9uWSAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgIHRoaXMucGFuZWxQb3NpdGlvbiQubmV4dCh7IHg6IGJ1dHRvblgsIHk6IGJ1dHRvblkgfSk7XHJcbiAgICB9XHJcbiAgICB0aGlzLnBhbmVsT3BlbiQubmV4dCghdGhpcy5wYW5lbE9wZW4kLnZhbHVlKTtcclxuICB9XHJcblxyXG4gIG9wZW5QYW5lbChidXR0b25YPzogbnVtYmVyLCBidXR0b25ZPzogbnVtYmVyKTogdm9pZCB7XHJcbiAgICBpZiAoYnV0dG9uWCAhPT0gdW5kZWZpbmVkICYmIGJ1dHRvblkgIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICB0aGlzLnBhbmVsUG9zaXRpb24kLm5leHQoeyB4OiBidXR0b25YLCB5OiBidXR0b25ZIH0pO1xyXG4gICAgfVxyXG4gICAgdGhpcy5wYW5lbE9wZW4kLm5leHQodHJ1ZSk7XHJcbiAgfVxyXG5cclxuICBjbG9zZVBhbmVsKCk6IHZvaWQge1xyXG4gICAgdGhpcy5wYW5lbE9wZW4kLm5leHQoZmFsc2UpO1xyXG4gIH1cclxuXHJcbiAgc2V0UGFuZWxTaXplKHdpZHRoOiBudW1iZXIsIGhlaWdodDogbnVtYmVyKTogdm9pZCB7XHJcbiAgICB0aGlzLnBhbmVsU2l6ZSQubmV4dCh7IHdpZHRoLCBoZWlnaHQgfSk7XHJcbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnbWVzc2FnaW5nX3BhbmVsX3NpemUnLCBKU09OLnN0cmluZ2lmeSh7IHdpZHRoLCBoZWlnaHQgfSkpO1xyXG4gIH1cclxuXHJcbiAgZ2V0UGFuZWxTaXplKCk6IHsgd2lkdGg6IG51bWJlcjsgaGVpZ2h0OiBudW1iZXIgfSB7XHJcbiAgICBjb25zdCBzYXZlZCA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdtZXNzYWdpbmdfcGFuZWxfc2l6ZScpO1xyXG4gICAgaWYgKHNhdmVkKSB7XHJcbiAgICAgIHRyeSB7XHJcbiAgICAgICAgY29uc3QgcGFyc2VkID0gSlNPTi5wYXJzZShzYXZlZCk7XHJcbiAgICAgICAgaWYgKHBhcnNlZC53aWR0aCAmJiBwYXJzZWQuaGVpZ2h0KSB7XHJcbiAgICAgICAgICB0aGlzLnBhbmVsU2l6ZSQubmV4dChwYXJzZWQpO1xyXG4gICAgICAgICAgcmV0dXJuIHBhcnNlZDtcclxuICAgICAgICB9XHJcbiAgICAgIH0gY2F0Y2gge31cclxuICAgIH1cclxuICAgIHJldHVybiB0aGlzLnBhbmVsU2l6ZSQudmFsdWU7XHJcbiAgfVxyXG5cclxuICBvbkJ1dHRvbkRyYWdTdGFydCgpOiB2b2lkIHtcclxuICAgIHRoaXMud2FzT3BlbkJlZm9yZURyYWckLm5leHQodGhpcy5wYW5lbE9wZW4kLnZhbHVlKTtcclxuICAgIGlmICh0aGlzLnBhbmVsT3BlbiQudmFsdWUpIHtcclxuICAgICAgdGhpcy5wYW5lbE9wZW4kLm5leHQoZmFsc2UpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgb25CdXR0b25EcmFnRW5kKGJ1dHRvblg6IG51bWJlciwgYnV0dG9uWTogbnVtYmVyKTogdm9pZCB7XHJcbiAgICBpZiAodGhpcy53YXNPcGVuQmVmb3JlRHJhZyQudmFsdWUpIHtcclxuICAgICAgdGhpcy5vcGVuUGFuZWwoYnV0dG9uWCwgYnV0dG9uWSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBzZXRWaWV3KHZpZXc6ICdpbmJveCcgfCAnY2hhdCcgfCAnbmV3LWNvbnZlcnNhdGlvbicgfCAnZ3JvdXAtbWFuYWdlcicgfCAnY29udmVyc2F0aW9uLXNldHRpbmdzJyk6IHZvaWQge1xyXG4gICAgdGhpcy5hY3RpdmVWaWV3JC5uZXh0KHZpZXcpO1xyXG4gIH1cclxuXHJcbiAgdG9nZ2xlU2lkZWJhclNpZGUoKTogdm9pZCB7XHJcbiAgICBjb25zdCBuZXh0ID0gdGhpcy5zaWRlYmFyU2lkZSQudmFsdWUgPT09ICdyaWdodCcgPyAnbGVmdCcgOiAncmlnaHQnO1xyXG4gICAgdGhpcy5zaWRlYmFyU2lkZSQubmV4dChuZXh0KTtcclxuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdtZXNzYWdpbmdfc2lkZWJhcl9zaWRlJywgbmV4dCk7XHJcbiAgfVxyXG5cclxuICBzZXRQYW5lbEZsb2F0aW5nKGlzRmxvYXRpbmc6IGJvb2xlYW4pOiB2b2lkIHtcclxuICAgIHRoaXMucGFuZWxGbG9hdGluZyQubmV4dChpc0Zsb2F0aW5nKTtcclxuICB9XHJcblxyXG4gIHNldE5vdGlmaWNhdGlvblZvbHVtZSh2b2x1bWU6IG51bWJlcik6IHZvaWQge1xyXG4gICAgY29uc3Qgbm9ybWFsaXplZCA9IE1hdGgubWF4KDAsIE1hdGgubWluKDEsIE51bWJlcih2b2x1bWUpKSk7XHJcbiAgICB0aGlzLm5vdGlmaWNhdGlvblZvbHVtZSQubmV4dChub3JtYWxpemVkKTtcclxuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdtZXNzYWdpbmdfbm90aWZpY2F0aW9uX3ZvbHVtZScsIFN0cmluZyhub3JtYWxpemVkKSk7XHJcbiAgICBpZiAobm9ybWFsaXplZCA+IDAgJiYgdGhpcy5ub3RpZmljYXRpb25zTXV0ZWQkLnZhbHVlKSB7XHJcbiAgICAgIHRoaXMuc2V0Tm90aWZpY2F0aW9uc011dGVkKGZhbHNlKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHNldE5vdGlmaWNhdGlvbnNNdXRlZChtdXRlZDogYm9vbGVhbik6IHZvaWQge1xyXG4gICAgdGhpcy5ub3RpZmljYXRpb25zTXV0ZWQkLm5leHQobXV0ZWQpO1xyXG4gICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ21lc3NhZ2luZ19ub3RpZmljYXRpb25zX211dGVkJywgU3RyaW5nKG11dGVkKSk7XHJcbiAgfVxyXG5cclxuICBzZXRNZXNzYWdlVGV4dFNjYWxlKHNjYWxlOiBudW1iZXIpOiB2b2lkIHtcclxuICAgIGNvbnN0IG5vcm1hbGl6ZWQgPSBNYXRoLm1heCgwLjgsIE1hdGgubWluKDEuNSwgTnVtYmVyKHNjYWxlKSkpO1xyXG4gICAgdGhpcy5tZXNzYWdlVGV4dFNjYWxlJC5uZXh0KG5vcm1hbGl6ZWQpO1xyXG4gICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ21lc3NhZ2luZ19tZXNzYWdlX3RleHRfc2NhbGUnLCBTdHJpbmcobm9ybWFsaXplZCkpO1xyXG4gIH1cclxuXHJcbiAgc2V0Q29kZVRleHRTY2FsZShzY2FsZTogbnVtYmVyKTogdm9pZCB7XHJcbiAgICBjb25zdCBub3JtYWxpemVkID0gTWF0aC5tYXgoMC44LCBNYXRoLm1pbigxLjUsIE51bWJlcihzY2FsZSkpKTtcclxuICAgIHRoaXMuY29kZVRleHRTY2FsZSQubmV4dChub3JtYWxpemVkKTtcclxuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdtZXNzYWdpbmdfY29kZV90ZXh0X3NjYWxlJywgU3RyaW5nKG5vcm1hbGl6ZWQpKTtcclxuICB9XHJcblxyXG4gIHRlc3ROb3RpZmljYXRpb25Tb3VuZCgpOiB2b2lkIHtcclxuICAgIHRoaXMucGxheVNvZnROb3RpZmljYXRpb25Tb3VuZCh0cnVlKTtcclxuICB9XHJcblxyXG4gIHByZXBhcmVPdXRnb2luZ01lc3NhZ2VDb250ZW50KGNvbnRlbnQ6IHN0cmluZywgcmVwbHlUbz86IE1lc3NhZ2UgfCBudWxsLCBmb3JjZVBsYWluVGV4dD86IGJvb2xlYW4pOiBzdHJpbmcge1xyXG4gICAgY29uc3QgYm9keSA9IFN0cmluZyhjb250ZW50IHx8ICcnKS50cmltKCk7XHJcbiAgICBjb25zdCB3aXRoUmVwbHkgPSAhcmVwbHlUbyA/IGJvZHkgOiAoKCkgPT4ge1xyXG4gICAgICBjb25zdCByZXBseSA9IHRoaXMuY3JlYXRlUmVwbHlQcmV2aWV3KHJlcGx5VG8pO1xyXG4gICAgICBjb25zdCBzZW5kZXIgPSAocmVwbHkuc2VuZGVyX25hbWUgfHwgJ21lc3NhZ2UnKS5yZXBsYWNlKC9cXF0vZywgJycpLnRyaW0oKTtcclxuICAgICAgY29uc3QgZXhjZXJwdCA9IHRoaXMucmVwbHlFeGNlcnB0KHJlcGx5LmNvbnRlbnQgfHwgJycpO1xyXG4gICAgICByZXR1cm4gYFtSZXBseSB0byAke3NlbmRlcn1dXFxuPiAke2V4Y2VycHR9XFxuXFxuJHtib2R5fWA7XHJcbiAgICB9KSgpO1xyXG4gICAgcmV0dXJuIGZvcmNlUGxhaW5UZXh0ID8gYCR7UExBSU5fVEVYVF9NRVNTQUdFX1BSRUZJWH0ke3dpdGhSZXBseX1gIDogd2l0aFJlcGx5O1xyXG4gIH1cclxuXHJcbiAgY3JlYXRlUmVwbHlQcmV2aWV3KG1lc3NhZ2U6IE1lc3NhZ2UpOiBNZXNzYWdlUmVwbHlQcmV2aWV3IHtcclxuICAgIHJldHVybiB7XHJcbiAgICAgIG1lc3NhZ2VfaWQ6IFN0cmluZyhtZXNzYWdlLm1lc3NhZ2VfaWQgfHwgJycpLFxyXG4gICAgICBzZW5kZXJfbmFtZTogZ2V0TWVzc2FnZVNlbmRlck5hbWUobWVzc2FnZSkgIT09ICdVbmtub3duJ1xyXG4gICAgICAgID8gZ2V0TWVzc2FnZVNlbmRlck5hbWUobWVzc2FnZSlcclxuICAgICAgICA6IHRoaXMuZ2V0Q29udGFjdE5hbWVCeUlkKG1lc3NhZ2Uuc2VuZGVyX2lkKSxcclxuICAgICAgY29udGVudDogdGhpcy5yZXBseUV4Y2VycHQoU3RyaW5nKG1lc3NhZ2UuY29udGVudCB8fCAnJykpLFxyXG4gICAgfTtcclxuICB9XHJcblxyXG4gIHNob3dUb2FzdChtZXNzYWdlOiBzdHJpbmcsIHR5cGU6ICdpbmZvJyB8ICdzdWNjZXNzJyB8ICdlcnJvcicgPSAnaW5mbycsIGR1cmF0aW9uTXMgPSAzMDAwKTogdm9pZCB7XHJcbiAgICBpZiAodGhpcy50b2FzdFRpbWVyKSB7XHJcbiAgICAgIGNsZWFyVGltZW91dCh0aGlzLnRvYXN0VGltZXIpO1xyXG4gICAgICB0aGlzLnRvYXN0VGltZXIgPSBudWxsO1xyXG4gICAgfVxyXG4gICAgdGhpcy50b2FzdCQubmV4dCh7IG1lc3NhZ2UsIHR5cGUgfSk7XHJcbiAgICB0aGlzLnRvYXN0VGltZXIgPSBzZXRUaW1lb3V0KCgpID0+IHtcclxuICAgICAgdGhpcy50b2FzdCQubmV4dChudWxsKTtcclxuICAgICAgdGhpcy50b2FzdFRpbWVyID0gbnVsbDtcclxuICAgIH0sIGR1cmF0aW9uTXMpO1xyXG4gIH1cclxuXHJcbiAgZ2V0U2lkZWJhclNpZGUoKTogU2lkZWJhclNpZGUge1xyXG4gICAgcmV0dXJuIHRoaXMuc2lkZWJhclNpZGUkLnZhbHVlO1xyXG4gIH1cclxuXHJcbiAgLy8g4pSA4pSAIEluYm94IOKUgOKUgFxyXG4gIGxvYWRJbmJveCgpOiB2b2lkIHtcclxuICAgIGNvbnN0IGNvbnRhY3RJZCA9IHRoaXMuYXV0aC5jb250YWN0SWQ7XHJcbiAgICBpZiAoIWNvbnRhY3RJZCkgcmV0dXJuO1xyXG5cclxuICAgIHRoaXMuYXBpLmdldEluYm94KGNvbnRhY3RJZCkuc3Vic2NyaWJlKHtcclxuICAgICAgbmV4dDogKGl0ZW1zKSA9PiB7XHJcbiAgICAgICAgY29uc3QgbWFwcGVkID0gaXRlbXMubWFwKGl0ZW0gPT4ge1xyXG4gICAgICAgICAgY29uc3QgaXNHcm91cCA9IGl0ZW0uaXNfZ3JvdXAgPT09IHRydWUgfHwgKGl0ZW0uaXNfZ3JvdXAgYXMgYW55KSA9PT0gJ1RydWUnO1xyXG4gICAgICAgICAgY29uc3QgY29udmVyc2F0aW9uSWQgPSBTdHJpbmcoaXRlbS5jb252ZXJzYXRpb25faWQpO1xyXG4gICAgICAgICAgY29uc3QgcHJldmlldyA9IHRoaXMucmVwbHlCb2R5VGV4dChpdGVtLmxhc3RfbWVzc2FnZV9wcmV2aWV3IHx8ICcnKTtcclxuICAgICAgICAgIGNvbnN0IGhhc01lbnRpb24gPVxyXG4gICAgICAgICAgICB0aGlzLm1lbnRpb25Db252ZXJzYXRpb25JZHMkLnZhbHVlLmhhcyhjb252ZXJzYXRpb25JZCkgfHxcclxuICAgICAgICAgICAgKE51bWJlcihpdGVtLnVucmVhZF9jb3VudCB8fCAwKSA+IDAgJiYgdGhpcy5tZXNzYWdlVGV4dE1lbnRpb25zQ3VycmVudFVzZXIocHJldmlldykpO1xyXG4gICAgICAgICAgXHJcbiAgICAgICAgICBpZiAoIWlzR3JvdXAgJiYgIWl0ZW0ubmFtZSAmJiBpdGVtLm90aGVyX3BhcnRpY2lwYW50X25hbWUpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHsgLi4uaXRlbSwgbmFtZTogaXRlbS5vdGhlcl9wYXJ0aWNpcGFudF9uYW1lLCBsYXN0X21lc3NhZ2VfcHJldmlldzogcHJldmlldywgaXNfZ3JvdXA6IGZhbHNlLCBoYXNfbWVudGlvbjogaGFzTWVudGlvbiB9O1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgcmV0dXJuIHsgLi4uaXRlbSwgbGFzdF9tZXNzYWdlX3ByZXZpZXc6IHByZXZpZXcsIGlzX2dyb3VwOiBpc0dyb3VwLCBoYXNfbWVudGlvbjogaGFzTWVudGlvbiB9O1xyXG4gICAgICAgIH0pLmZpbHRlcihpdGVtID0+XHJcbiAgICAgICAgICAhdGhpcy5kZWxldGluZ0NvbnZlcnNhdGlvbklkcy5oYXMoU3RyaW5nKGl0ZW0uY29udmVyc2F0aW9uX2lkKSkgJiZcclxuICAgICAgICAgICF0aGlzLnJlbW92ZWRHcm91cElkcyQudmFsdWUuaGFzKFN0cmluZyhpdGVtLmNvbnZlcnNhdGlvbl9pZCkpXHJcbiAgICAgICAgKTtcclxuICAgICAgICB0aGlzLmluYm94JC5uZXh0KG1hcHBlZCk7XHJcbiAgICAgICAgdGhpcy5yZWNhbGNVbnJlYWQobWFwcGVkKTtcclxuXHJcbiAgICAgICAgY29uc3QgaWRzID0gbWFwcGVkLm1hcCgoaSkgPT4gaS5jb252ZXJzYXRpb25faWQpO1xyXG4gICAgICAgIHRoaXMud3NTZXJ2aWNlLnN1YnNjcmliZUFsbChpZHMpO1xyXG4gICAgICB9LFxyXG4gICAgICBlcnJvcjogKCkgPT4ge30sXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8vIOKUgOKUgCBDb250YWN0cyDilIDilIBcclxuICBsb2FkVmlzaWJsZUNvbnRhY3RzKCk6IHZvaWQge1xyXG4gICAgY29uc3QgY29udGFjdElkID0gdGhpcy5hdXRoLmNvbnRhY3RJZDtcclxuICAgIGlmICghY29udGFjdElkKSByZXR1cm47XHJcblxyXG4gICAgdGhpcy5hcGkuZ2V0VmlzaWJsZUNvbnRhY3RzKGNvbnRhY3RJZCkuc3Vic2NyaWJlKHtcclxuICAgICAgbmV4dDogKGNvbnRhY3RzKSA9PiB7XHJcbiAgICAgICAgdGhpcy52aXNpYmxlQ29udGFjdHMkLm5leHQoY29udGFjdHMpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGNvbnN0IGN1cnJlbnRDb250YWN0ID0gdGhpcy5hdXRoLmN1cnJlbnRDb250YWN0O1xyXG4gICAgICAgIGlmIChjdXJyZW50Q29udGFjdCAmJiBjdXJyZW50Q29udGFjdC5lbWFpbCkge1xyXG4gICAgICAgICAgY29uc3QgbWF0Y2ggPSBjb250YWN0cy5maW5kKGMgPT4gYy5lbWFpbCA9PT0gY3VycmVudENvbnRhY3QuZW1haWwpO1xyXG4gICAgICAgICAgaWYgKFxyXG4gICAgICAgICAgICBtYXRjaCAmJlxyXG4gICAgICAgICAgICBTdHJpbmcobWF0Y2guY29udGFjdF9pZCkgIT09IFN0cmluZyhjdXJyZW50Q29udGFjdC5jb250YWN0X2lkKVxyXG4gICAgICAgICAgKSB7XHJcbiAgICAgICAgICAgIHRoaXMuYXV0aC5zZXRTZXNzaW9uKHRoaXMuYXV0aC5zZXNzaW9uR2lkISwgeyAuLi5jdXJyZW50Q29udGFjdCwgY29udGFjdF9pZDogbWF0Y2guY29udGFjdF9pZCB9KTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHRoaXMud3NTZXJ2aWNlLmRpc2Nvbm5lY3QoKTtcclxuICAgICAgICAgICAgdGhpcy53c1NlcnZpY2UuY29ubmVjdChtYXRjaC5jb250YWN0X2lkLCB0aGlzLmF1dGguc2Vzc2lvbkdpZCEpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgfSxcclxuICAgICAgZXJyb3I6ICgpID0+IHt9LFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvLyDilIDilIAgQ29udmVyc2F0aW9ucyDilIDilIBcclxuICBvcGVuQ29udmVyc2F0aW9uKGNvbnZlcnNhdGlvbklkOiBzdHJpbmcsIG5hbWU6IHN0cmluZywgaXNHcm91cCA9IGZhbHNlKTogdm9pZCB7XHJcbiAgICBpZiAoIWNvbnZlcnNhdGlvbklkIHx8IGNvbnZlcnNhdGlvbklkID09PSAndW5kZWZpbmVkJykge1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICB0aGlzLmFjdGl2ZUNvbnZlcnNhdGlvbklkJC5uZXh0KGNvbnZlcnNhdGlvbklkKTtcclxuICAgIHRoaXMuYWN0aXZlVmlldyQubmV4dCgnY2hhdCcpO1xyXG4gICAgdGhpcy5vcGVuUGFuZWwoKTtcclxuXHJcbiAgICBjb25zdCBjaGF0cyA9IHRoaXMub3BlbkNoYXRzJC52YWx1ZTtcclxuICAgIGlmICghY2hhdHMuZmluZCgoYykgPT4gYy5jb252ZXJzYXRpb25JZCA9PT0gY29udmVyc2F0aW9uSWQpKSB7XHJcbiAgICAgIHRoaXMub3BlbkNoYXRzJC5uZXh0KFtcclxuICAgICAgICAuLi5jaGF0cyxcclxuICAgICAgICB7IGNvbnZlcnNhdGlvbklkLCBuYW1lLCBpc0dyb3VwLCBpc01pbmltaXplZDogZmFsc2UsIHVucmVhZENvdW50OiAwIH0sXHJcbiAgICAgIF0pO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGV4aXN0aW5nID0gdGhpcy5tZXNzYWdlc01hcCQudmFsdWUuZ2V0KGNvbnZlcnNhdGlvbklkKTtcclxuICAgIGlmICghZXhpc3RpbmcgfHwgZXhpc3RpbmcubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgIHRoaXMubG9hZE1lc3NhZ2VzKGNvbnZlcnNhdGlvbklkKTtcclxuICAgIH1cclxuICAgIHRoaXMubWFya0FzUmVhZChjb252ZXJzYXRpb25JZCk7XHJcbiAgICB0aGlzLndzU2VydmljZS5zdWJzY3JpYmUoY29udmVyc2F0aW9uSWQpO1xyXG4gIH1cclxuXHJcbiAgY2xvc2VDaGF0KGNvbnZlcnNhdGlvbklkOiBzdHJpbmcpOiB2b2lkIHtcclxuICAgIGNvbnN0IGNoYXRzID0gdGhpcy5vcGVuQ2hhdHMkLnZhbHVlLmZpbHRlcigoYykgPT4gYy5jb252ZXJzYXRpb25JZCAhPT0gY29udmVyc2F0aW9uSWQpO1xyXG4gICAgdGhpcy5vcGVuQ2hhdHMkLm5leHQoY2hhdHMpO1xyXG5cclxuICAgIGlmIChTdHJpbmcodGhpcy5hY3RpdmVDb252ZXJzYXRpb25JZCQudmFsdWUpID09PSBTdHJpbmcoY29udmVyc2F0aW9uSWQpKSB7XHJcbiAgICAgIHRoaXMuYWN0aXZlQ29udmVyc2F0aW9uSWQkLm5leHQobnVsbCk7XHJcbiAgICAgIHRoaXMuYWN0aXZlVmlldyQubmV4dCgnaW5ib3gnKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIG1hcmtHcm91cFJlbW92ZWQoY29udmVyc2F0aW9uSWQ6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgY29uc3QgaWQgPSBTdHJpbmcoY29udmVyc2F0aW9uSWQpO1xyXG4gICAgaWYgKCFpZCB8fCBpZCA9PT0gJ3VuZGVmaW5lZCcpIHJldHVybjtcclxuXHJcbiAgICBjb25zdCBuZXh0ID0gbmV3IFNldCh0aGlzLnJlbW92ZWRHcm91cElkcyQudmFsdWUpO1xyXG4gICAgbmV4dC5hZGQoaWQpO1xyXG4gICAgdGhpcy5yZW1vdmVkR3JvdXBJZHMkLm5leHQobmV4dCk7XHJcblxyXG4gICAgY29uc3QgaXRlbXMgPSB0aGlzLmluYm94JC52YWx1ZS5maWx0ZXIoaSA9PiBTdHJpbmcoaS5jb252ZXJzYXRpb25faWQpICE9PSBpZCk7XHJcbiAgICB0aGlzLmluYm94JC5uZXh0KGl0ZW1zKTtcclxuICAgIHRoaXMucmVjYWxjVW5yZWFkKGl0ZW1zKTtcclxuXHJcbiAgICBpZiAoIXRoaXMucmVtb3ZhbFRvYXN0U2hvd24uaGFzKGlkKSkge1xyXG4gICAgICB0aGlzLnJlbW92YWxUb2FzdFNob3duLmFkZChpZCk7XHJcbiAgICAgIHRoaXMuc2hvd1RvYXN0KCdZb3Ugd2VyZSByZW1vdmVkIGZyb20gdGhpcyBncm91cCcsICdpbmZvJywgNTAwMCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBleGl0UmVtb3ZlZEdyb3VwKGNvbnZlcnNhdGlvbklkOiBzdHJpbmcpOiB2b2lkIHtcclxuICAgIGNvbnN0IGlkID0gU3RyaW5nKGNvbnZlcnNhdGlvbklkKTtcclxuICAgIGNvbnN0IG5leHQgPSBuZXcgU2V0KHRoaXMucmVtb3ZlZEdyb3VwSWRzJC52YWx1ZSk7XHJcbiAgICBuZXh0LmRlbGV0ZShpZCk7XHJcbiAgICB0aGlzLnJlbW92ZWRHcm91cElkcyQubmV4dChuZXh0KTtcclxuICAgIHRoaXMucmVtb3ZhbFRvYXN0U2hvd24uZGVsZXRlKGlkKTtcclxuICAgIHRoaXMucmVtb3ZlQ29udmVyc2F0aW9uRnJvbVVpKGlkKTtcclxuICB9XHJcblxyXG4gIC8vIOKUgOKUgCBNZXNzYWdlcyDilIDilIBcclxuICBsb2FkTWVzc2FnZXMoY29udmVyc2F0aW9uSWQ6IHN0cmluZywgYmVmb3JlTWVzc2FnZUlkPzogc3RyaW5nLCBza2lwUmVhY3Rpb25IeWRyYXRpb24gPSBmYWxzZSk6IHZvaWQge1xyXG4gICAgaWYgKCFjb252ZXJzYXRpb25JZCB8fCBjb252ZXJzYXRpb25JZCA9PT0gJ3VuZGVmaW5lZCcpIHtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgY29uc3QgY29udGFjdElkID0gdGhpcy5hdXRoLmNvbnRhY3RJZDtcclxuICAgIGlmICghY29udGFjdElkKSByZXR1cm47XHJcblxyXG4gICAgdGhpcy5sb2FkaW5nTWVzc2FnZXMkLm5leHQodHJ1ZSk7XHJcblxyXG4gICAgdGhpcy5hcGkuZ2V0TWVzc2FnZXMoY29udmVyc2F0aW9uSWQsIGNvbnRhY3RJZCwgYmVmb3JlTWVzc2FnZUlkLCA1MCkuc3Vic2NyaWJlKHtcclxuICAgICAgbmV4dDogKG1lc3NhZ2VzKSA9PiB7XHJcbiAgICAgICAgY29uc3QgbWFwID0gbmV3IE1hcCh0aGlzLm1lc3NhZ2VzTWFwJC52YWx1ZSk7XHJcbiAgICAgICAgY29uc3QgZXhpc3RpbmcgPSBtYXAuZ2V0KGNvbnZlcnNhdGlvbklkKSB8fCBbXTtcclxuXHJcbiAgICAgICAgY29uc3Qgbm9ybWFsaXplZCA9IG1lc3NhZ2VzLm1hcCgobTogYW55KSA9PiB0aGlzLm5vcm1hbGl6ZU1lc3NhZ2VTaGFwZShtKSk7XHJcbiAgICAgICAgY29uc3Qgc29ydGVkID0gWy4uLm5vcm1hbGl6ZWRdLnNvcnQoKGEsIGIpID0+IFxyXG4gICAgICAgICAgbmV3IERhdGUoYS5jcmVhdGVkX2F0KS5nZXRUaW1lKCkgLSBuZXcgRGF0ZShiLmNyZWF0ZWRfYXQpLmdldFRpbWUoKVxyXG4gICAgICAgICk7XHJcbiAgICAgICAgc29ydGVkLmZvckVhY2goKG0pID0+IHRoaXMuZGV0ZWN0R3JvdXBSZW1vdmFsRm9yQ3VycmVudFVzZXIobSkpO1xyXG5cclxuICAgICAgICBjb25zdCBleGlzdGluZ0J5SWQgPSBuZXcgTWFwKGV4aXN0aW5nLm1hcChtID0+IFtTdHJpbmcobS5tZXNzYWdlX2lkKSwgbV0pKTtcclxuXHJcbiAgICAgICAgaWYgKGJlZm9yZU1lc3NhZ2VJZCkge1xyXG4gICAgICAgICAgLy8gUHJlcGVuZCBvbGRlciBtZXNzYWdlcywgcHJlc2VydmluZyBleGlzdGluZyByZWFjdGlvbnNcclxuICAgICAgICAgIGNvbnN0IG1lcmdlZCA9IFsuLi5zb3J0ZWQsIC4uLmV4aXN0aW5nXTtcclxuICAgICAgICAgIG1hcC5zZXQoY29udmVyc2F0aW9uSWQsIG1lcmdlZCk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIC8vIFJlcGxhY2Ugd2l0aCBzZXJ2ZXIgZGF0YSBidXQga2VlcCB0aGUgcmljaGVyIG9mIGV4aXN0aW5nIHZzIHNlcnZlciBhdHRhY2htZW50c1xyXG4gICAgICAgICAgLy8gKHRoZSBvcHRpbWlzdGljIHBhdGggbWF5IGhhdmUgbW9yZSBhdHRhY2htZW50IG1ldGFkYXRhIHRoYW4gdGhlIHNlcnZlciBlY2hvZXMgYmFjaykuXHJcbiAgICAgICAgICBjb25zdCBtZXJnZWQgPSBzb3J0ZWQubWFwKG0gPT4ge1xyXG4gICAgICAgICAgICBjb25zdCBjYWNoZWQgPSBleGlzdGluZ0J5SWQuZ2V0KFN0cmluZyhtLm1lc3NhZ2VfaWQpKTtcclxuICAgICAgICAgICAgaWYgKCFjYWNoZWQpIHJldHVybiBtO1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5tZXJnZU1lc3NhZ2VBdHRhY2htZW50cyhjYWNoZWQsIG0pO1xyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgICBtYXAuc2V0KGNvbnZlcnNhdGlvbklkLCBtZXJnZWQpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5tZXNzYWdlc01hcCQubmV4dChtYXApO1xyXG4gICAgICAgIHRoaXMuaHlkcmF0ZVJlYWN0aW9uc0ZvckNvbnZlcnNhdGlvbihcclxuICAgICAgICAgIGNvbnZlcnNhdGlvbklkLFxyXG4gICAgICAgICAgbWFwLmdldChjb252ZXJzYXRpb25JZCkgfHwgW10sXHJcbiAgICAgICAgICBza2lwUmVhY3Rpb25IeWRyYXRpb25cclxuICAgICAgICApO1xyXG4gICAgICAgIHRoaXMubG9hZGluZ01lc3NhZ2VzJC5uZXh0KGZhbHNlKTtcclxuICAgICAgfSxcclxuICAgICAgZXJyb3I6ICgpID0+IHtcclxuICAgICAgICB0aGlzLmxvYWRpbmdNZXNzYWdlcyQubmV4dChmYWxzZSk7XHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHNlbmRNZXNzYWdlKFxyXG4gICAgY29udmVyc2F0aW9uSWQ6IHN0cmluZyB8IG51bGwsXHJcbiAgICBjb250ZW50OiBzdHJpbmcsXHJcbiAgICBtZXNzYWdlVHlwZTogJ1RFWFQnIHwgJ0lNQUdFJyB8ICdTWVNURU0nID0gJ1RFWFQnLFxyXG4gICAgb3B0aW9ucz86IHsgcmVwbHlUbz86IE1lc3NhZ2UgfCBudWxsOyBtZW50aW9ucz86IHN0cmluZ1tdOyBmb3JjZVBsYWluVGV4dD86IGJvb2xlYW4gfVxyXG4gICk6IHZvaWQge1xyXG4gICAgY29uc3QgY29udGFjdElkID0gdGhpcy5hdXRoLmNvbnRhY3RJZDtcclxuICAgIGlmICghY29udGFjdElkKSByZXR1cm47XHJcblxyXG4gICAgY29uc3QgcGVuZGluZyA9IHRoaXMucGVuZGluZ0RtUmVjaXBpZW50JC52YWx1ZTtcclxuICAgIGlmICghY29udmVyc2F0aW9uSWQgJiYgcGVuZGluZykge1xyXG4gICAgICB0aGlzLnNlbmREaXJlY3RNZXNzYWdlKHBlbmRpbmcuY29udGFjdElkLCBjb250ZW50KTtcclxuICAgICAgdGhpcy5wZW5kaW5nRG1SZWNpcGllbnQkLm5leHQobnVsbCk7XHJcbiAgICAgIGNvbnN0IGNoYXRzID0gdGhpcy5vcGVuQ2hhdHMkLnZhbHVlLmZpbHRlcihjID0+IGMuY29udmVyc2F0aW9uSWQgIT09ICdwZW5kaW5nJyk7XHJcbiAgICAgIHRoaXMub3BlbkNoYXRzJC5uZXh0KGNoYXRzKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICghY29udmVyc2F0aW9uSWQpIHJldHVybjtcclxuXHJcbiAgICBjb25zdCBvdXRnb2luZ0NvbnRlbnQgPSB0aGlzLnByZXBhcmVPdXRnb2luZ01lc3NhZ2VDb250ZW50KGNvbnRlbnQsIG9wdGlvbnM/LnJlcGx5VG8gfHwgbnVsbCwgb3B0aW9ucz8uZm9yY2VQbGFpblRleHQpO1xyXG4gICAgY29uc3QgcmVwbHlUbyA9IG9wdGlvbnM/LnJlcGx5VG8gPyB0aGlzLmNyZWF0ZVJlcGx5UHJldmlldyhvcHRpb25zLnJlcGx5VG8pIDogdW5kZWZpbmVkO1xyXG4gICAgY29uc3QgdGVtcE1lc3NhZ2VJZCA9ICd0ZW1wLScgKyBEYXRlLm5vdygpO1xyXG4gICAgY29uc3Qgb3B0aW1pc3RpYzogTWVzc2FnZSA9IHtcclxuICAgICAgbWVzc2FnZV9pZDogdGVtcE1lc3NhZ2VJZCxcclxuICAgICAgY29udmVyc2F0aW9uX2lkOiBjb252ZXJzYXRpb25JZCxcclxuICAgICAgc2VuZGVyX2lkOiBjb250YWN0SWQsXHJcbiAgICAgIHNlbmRlcl9uYW1lOiAnWW91JyxcclxuICAgICAgbWVzc2FnZV90eXBlOiBtZXNzYWdlVHlwZSxcclxuICAgICAgY29udGVudCxcclxuICAgICAgcmVwbHlfdG86IHJlcGx5VG8sXHJcbiAgICAgIG1lbnRpb25zOiBvcHRpb25zPy5tZW50aW9ucyxcclxuICAgICAgcmVuZGVyX2FzX3BsYWluX3RleHQ6IG9wdGlvbnM/LmZvcmNlUGxhaW5UZXh0LFxyXG4gICAgICBjcmVhdGVkX2F0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXHJcbiAgICAgIGlzX3JlYWQ6IGZhbHNlLFxyXG4gICAgfTtcclxuICAgIHRoaXMuYXBwZW5kTWVzc2FnZShvcHRpbWlzdGljKTtcclxuXHJcbiAgICB0aGlzLmFwaS5zZW5kTWVzc2FnZShjb252ZXJzYXRpb25JZCwgY29udGFjdElkLCBvdXRnb2luZ0NvbnRlbnQsIG1lc3NhZ2VUeXBlKS5zdWJzY3JpYmUoe1xyXG4gICAgICBuZXh0OiAocmVzKSA9PiB7XHJcbiAgICAgICAgY29uc3QgcmVhbElkID0gcmVzPy5tZXNzYWdlX2lkID8/IHJlcz8uaWQgPz8gcmVzPy5tZXNzYWdlSWQ7XHJcbiAgICAgICAgaWYgKHJlYWxJZCA9PSBudWxsIHx8IFN0cmluZyhyZWFsSWQpLnN0YXJ0c1dpdGgoJ3RlbXAtJykpIHtcclxuICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgY29uc3QgcGlja2VkQ29udGVudCA9IHRoaXMuY29hbGVzY2VNZXNzYWdlVGV4dChyZXMsIG91dGdvaW5nQ29udGVudCB8fCBvcHRpbWlzdGljLmNvbnRlbnQpO1xyXG4gICAgICAgIGNvbnN0IG1lcmdlZCA9IHRoaXMubm9ybWFsaXplTWVzc2FnZVNoYXBlKHtcclxuICAgICAgICAgIC4uLm9wdGltaXN0aWMsXHJcbiAgICAgICAgICAuLi5yZXMsXHJcbiAgICAgICAgICBtZXNzYWdlX2lkOiBTdHJpbmcocmVhbElkKSxcclxuICAgICAgICAgIGNvbnZlcnNhdGlvbl9pZDogY29udmVyc2F0aW9uSWQsXHJcbiAgICAgICAgICBtZXNzYWdlX3R5cGU6IG1lc3NhZ2VUeXBlID09PSAnU1lTVEVNJyA/ICdTWVNURU0nIDogcmVzPy5tZXNzYWdlX3R5cGUgPz8gb3B0aW1pc3RpYy5tZXNzYWdlX3R5cGUsXHJcbiAgICAgICAgICBjb250ZW50OiBwaWNrZWRDb250ZW50LFxyXG4gICAgICAgICAgcmVwbHlfdG86IHJlcGx5VG8gPz8gcmVzPy5yZXBseV90byxcclxuICAgICAgICAgIG1lbnRpb25zOiBvcHRpb25zPy5tZW50aW9ucyA/PyByZXM/Lm1lbnRpb25zLFxyXG4gICAgICAgICAgcmVuZGVyX2FzX3BsYWluX3RleHQ6IG9wdGlvbnM/LmZvcmNlUGxhaW5UZXh0LFxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIGNvbnN0IG1hcCA9IG5ldyBNYXAodGhpcy5tZXNzYWdlc01hcCQudmFsdWUpO1xyXG4gICAgICAgIGNvbnN0IG1zZ3MgPSBbLi4uKG1hcC5nZXQoY29udmVyc2F0aW9uSWQpIHx8IFtdKV07XHJcbiAgICAgICAgY29uc3QgaWR4ID0gbXNncy5maW5kSW5kZXgoKG0pID0+IG0ubWVzc2FnZV9pZCA9PT0gdGVtcE1lc3NhZ2VJZCk7XHJcbiAgICAgICAgaWYgKGlkeCA+PSAwKSB7XHJcbiAgICAgICAgICBtc2dzW2lkeF0gPSBtZXJnZWQ7XHJcbiAgICAgICAgICBtYXAuc2V0KGNvbnZlcnNhdGlvbklkLCB0aGlzLmRlZHVwZU1lc3NhZ2VzQnlJZEtlZXBGaXJzdChtc2dzKSk7XHJcbiAgICAgICAgICB0aGlzLm1lc3NhZ2VzTWFwJC5uZXh0KG1hcCk7XHJcbiAgICAgICAgICB0aGlzLnJlZnJlc2hNZXNzYWdlUmVhY3Rpb25zKG1lcmdlZC5tZXNzYWdlX2lkKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0sXHJcbiAgICAgIGVycm9yOiAoKSA9PiB7fSxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgb3BlbkRpcmVjdENvbnZlcnNhdGlvbihyZWNpcGllbnRDb250YWN0SWQ6IHN0cmluZywgZGlzcGxheU5hbWU6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgY29uc3QgZXhpc3RpbmcgPSB0aGlzLmluYm94JC52YWx1ZS5maW5kKGl0ZW0gPT4gXHJcbiAgICAgICFpdGVtLmlzX2dyb3VwICYmIGl0ZW0ubmFtZSA9PT0gZGlzcGxheU5hbWVcclxuICAgICk7XHJcbiAgICBcclxuICAgIGlmIChleGlzdGluZykge1xyXG4gICAgICB0aGlzLnBlbmRpbmdEbVJlY2lwaWVudCQubmV4dChudWxsKTtcclxuICAgICAgdGhpcy5vcGVuQ29udmVyc2F0aW9uKGV4aXN0aW5nLmNvbnZlcnNhdGlvbl9pZCwgZGlzcGxheU5hbWUsIGZhbHNlKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHRoaXMucGVuZGluZ0RtUmVjaXBpZW50JC5uZXh0KHtjb250YWN0SWQ6IHJlY2lwaWVudENvbnRhY3RJZCwgbmFtZTogZGlzcGxheU5hbWV9KTtcclxuICAgICAgdGhpcy5hY3RpdmVDb252ZXJzYXRpb25JZCQubmV4dChudWxsKTtcclxuICAgICAgdGhpcy5hY3RpdmVWaWV3JC5uZXh0KCdjaGF0Jyk7XHJcbiAgICAgIHRoaXMub3BlblBhbmVsKCk7XHJcbiAgICAgIFxyXG4gICAgICBjb25zdCBjaGF0cyA9IHRoaXMub3BlbkNoYXRzJC52YWx1ZTtcclxuICAgICAgaWYgKCFjaGF0cy5maW5kKGMgPT4gYy5jb252ZXJzYXRpb25JZCA9PT0gJ3BlbmRpbmcnKSkge1xyXG4gICAgICAgIHRoaXMub3BlbkNoYXRzJC5uZXh0KFsuLi5jaGF0cywge1xyXG4gICAgICAgICAgY29udmVyc2F0aW9uSWQ6ICdwZW5kaW5nJyxcclxuICAgICAgICAgIG5hbWU6IGRpc3BsYXlOYW1lLFxyXG4gICAgICAgICAgaXNHcm91cDogZmFsc2UsXHJcbiAgICAgICAgICBpc01pbmltaXplZDogZmFsc2UsXHJcbiAgICAgICAgICB1bnJlYWRDb3VudDogMFxyXG4gICAgICAgIH1dKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgc2VuZERpcmVjdE1lc3NhZ2UocmVjaXBpZW50Q29udGFjdElkOiBzdHJpbmcsIGNvbnRlbnQ6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgY29uc3QgY29udGFjdElkID0gdGhpcy5hdXRoLmNvbnRhY3RJZDtcclxuICAgIGlmICghY29udGFjdElkKSByZXR1cm47XHJcblxyXG4gICAgdGhpcy5hcGkuc2VuZERpcmVjdE1lc3NhZ2UoY29udGFjdElkLCByZWNpcGllbnRDb250YWN0SWQsIGNvbnRlbnQpLnN1YnNjcmliZSh7XHJcbiAgICAgIG5leHQ6IChyZXMpID0+IHtcclxuICAgICAgICB0aGlzLmxvYWRJbmJveCgpO1xyXG4gICAgICAgIC8vIEJhY2tlbmQgbWF5IHJldHVybiBjb252ZXJzYXRpb25faWQsIGlkLCBvciBjb252ZXJzYXRpb25JZFxyXG4gICAgICAgIGNvbnN0IGNvbnZJZCA9IFN0cmluZyhyZXM/LmNvbnZlcnNhdGlvbl9pZCB8fCByZXM/LmlkIHx8IHJlcz8uY29udmVyc2F0aW9uSWQgfHwgJycpO1xyXG4gICAgICAgIGlmIChjb252SWQpIHtcclxuICAgICAgICAgIGNvbnN0IHJlY2lwaWVudCA9IHRoaXMudmlzaWJsZUNvbnRhY3RzJC52YWx1ZS5maW5kKFxyXG4gICAgICAgICAgICAoYykgPT4gYy5jb250YWN0X2lkID09PSByZWNpcGllbnRDb250YWN0SWRcclxuICAgICAgICAgICk7XHJcbiAgICAgICAgICBjb25zdCBuYW1lID0gcmVjaXBpZW50ID8gZ2V0Q29udGFjdERpc3BsYXlOYW1lKHJlY2lwaWVudCkgOiAnRGlyZWN0IE1lc3NhZ2UnO1xyXG4gICAgICAgICAgdGhpcy5vcGVuQ29udmVyc2F0aW9uKGNvbnZJZCwgbmFtZSwgZmFsc2UpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSxcclxuICAgICAgZXJyb3I6ICgpID0+IHt9LFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBjcmVhdGVHcm91cENvbnZlcnNhdGlvbihcclxuICAgIHBhcnRpY2lwYW50SWRzOiBzdHJpbmdbXSxcclxuICAgIG5hbWU6IHN0cmluZyxcclxuICAgIGNhbGxiYWNrcz86IHsgc3VjY2Vzcz86ICgpID0+IHZvaWQ7IGVycm9yPzogKCkgPT4gdm9pZCB9XHJcbiAgKTogdm9pZCB7XHJcbiAgICBjb25zdCBjb250YWN0SWQgPSB0aGlzLmF1dGguY29udGFjdElkO1xyXG4gICAgaWYgKCFjb250YWN0SWQpIHtcclxuICAgICAgY2FsbGJhY2tzPy5lcnJvcj8uKCk7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBhbGxQYXJ0aWNpcGFudHMgPSBwYXJ0aWNpcGFudElkcy5pbmNsdWRlcyhjb250YWN0SWQpXHJcbiAgICAgID8gcGFydGljaXBhbnRJZHNcclxuICAgICAgOiBbY29udGFjdElkLCAuLi5wYXJ0aWNpcGFudElkc107XHJcblxyXG4gICAgdGhpcy5hcGkuY3JlYXRlQ29udmVyc2F0aW9uKGNvbnRhY3RJZCwgYWxsUGFydGljaXBhbnRzLCBuYW1lKS5zdWJzY3JpYmUoe1xyXG4gICAgICBuZXh0OiAoY29udikgPT4ge1xyXG4gICAgICAgIC8vIEJhY2tlbmQgbWF5IHJldHVybiBjb252ZXJzYXRpb25faWQsIGlkLCBvciBjb252ZXJzYXRpb25JZFxyXG4gICAgICAgIGNvbnN0IGNvbnZJZCA9IFN0cmluZyhcclxuICAgICAgICAgIHR5cGVvZiBjb252ID09PSAnc3RyaW5nJyB8fCB0eXBlb2YgY29udiA9PT0gJ251bWJlcidcclxuICAgICAgICAgICAgPyBjb252XHJcbiAgICAgICAgICAgIDogKGNvbnYgYXMgYW55KT8uY29udmVyc2F0aW9uX2lkIHx8IChjb252IGFzIGFueSk/LmlkIHx8IChjb252IGFzIGFueSk/LmNvbnZlcnNhdGlvbklkIHx8ICcnXHJcbiAgICAgICAgKTtcclxuICAgICAgICBpZiAoIWNvbnZJZCkge1xyXG4gICAgICAgICAgdGhpcy5sb2FkSW5ib3goKTtcclxuICAgICAgICAgIGNhbGxiYWNrcz8uZXJyb3I/LigpO1xyXG4gICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLmxvYWRJbmJveCgpO1xyXG4gICAgICAgIHRoaXMuY2xlYXJHcm91cFNldHRpbmdzKCk7XHJcbiAgICAgICAgdGhpcy5vcGVuQ29udmVyc2F0aW9uKGNvbnZJZCwgbmFtZSwgdHJ1ZSk7XHJcbiAgICAgICAgY2FsbGJhY2tzPy5zdWNjZXNzPy4oKTtcclxuICAgICAgfSxcclxuICAgICAgZXJyb3I6ICgpID0+IHtcclxuICAgICAgICBjYWxsYmFja3M/LmVycm9yPy4oKTtcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgb3Blbkdyb3VwU2V0dGluZ3MoY29udmVyc2F0aW9uSWQ6IHN0cmluZywgbmFtZTogc3RyaW5nKTogdm9pZCB7XHJcbiAgICB0aGlzLmdyb3VwU2V0dGluZ3MkLm5leHQoeyBjb252ZXJzYXRpb25JZCwgbmFtZSB9KTtcclxuICAgIHRoaXMuc2V0VmlldygnZ3JvdXAtbWFuYWdlcicpO1xyXG4gIH1cclxuXHJcbiAgY2xlYXJHcm91cFNldHRpbmdzKCk6IHZvaWQge1xyXG4gICAgdGhpcy5ncm91cFNldHRpbmdzJC5uZXh0KG51bGwpO1xyXG4gIH1cclxuXHJcbiAgbWFya0FzUmVhZChjb252ZXJzYXRpb25JZDogc3RyaW5nKTogdm9pZCB7XHJcbiAgICBpZiAoIWNvbnZlcnNhdGlvbklkIHx8IGNvbnZlcnNhdGlvbklkID09PSAndW5kZWZpbmVkJykgcmV0dXJuO1xyXG4gICAgY29uc3QgY29udGFjdElkID0gdGhpcy5hdXRoLmNvbnRhY3RJZDtcclxuICAgIGlmICghY29udGFjdElkKSByZXR1cm47XHJcblxyXG4gICAgdGhpcy5hcGkubWFya0NvbnZlcnNhdGlvblJlYWQoY29udmVyc2F0aW9uSWQsIGNvbnRhY3RJZCkuc3Vic2NyaWJlKHtcclxuICAgICAgbmV4dDogKCkgPT4ge1xyXG4gICAgICAgIGNvbnN0IGl0ZW1zID0gdGhpcy5pbmJveCQudmFsdWUubWFwKChpdGVtKSA9PlxyXG4gICAgICAgICAgaXRlbS5jb252ZXJzYXRpb25faWQgPT09IGNvbnZlcnNhdGlvbklkID8geyAuLi5pdGVtLCB1bnJlYWRfY291bnQ6IDAsIGhhc19tZW50aW9uOiBmYWxzZSB9IDogaXRlbVxyXG4gICAgICAgICk7XHJcbiAgICAgICAgdGhpcy5pbmJveCQubmV4dChpdGVtcyk7XHJcbiAgICAgICAgdGhpcy5yZWNhbGNVbnJlYWQoaXRlbXMpO1xyXG4gICAgICAgIHRoaXMuc2V0Q29udmVyc2F0aW9uTWVudGlvbihjb252ZXJzYXRpb25JZCwgZmFsc2UpO1xyXG4gICAgICB9LFxyXG4gICAgICBlcnJvcjogKCkgPT4ge30sXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8vIOKUgOKUgCBHcm91cCBtYW5hZ2VtZW50IOKUgOKUgFxyXG4gIG1hbmFnZUdyb3VwKFxyXG4gICAgYWN0aW9uOiAnY3JlYXRlJyB8ICdhZGQnIHwgJ3JlbW92ZScgfCAncmVuYW1lJyxcclxuICAgIGNvbnZlcnNhdGlvbklkPzogc3RyaW5nLFxyXG4gICAgZ3JvdXBOYW1lPzogc3RyaW5nLFxyXG4gICAgcGFydGljaXBhbnRDb250YWN0SWRzPzogc3RyaW5nW10sXHJcbiAgICBjYWxsYmFja3M/OiB7IHN1Y2Nlc3M/OiAoKSA9PiB2b2lkOyBlcnJvcj86ICgpID0+IHZvaWQgfVxyXG4gICk6IHZvaWQge1xyXG4gICAgY29uc3QgY29udGFjdElkID0gdGhpcy5hdXRoLmNvbnRhY3RJZDtcclxuICAgIGlmICghY29udGFjdElkKSB7XHJcbiAgICAgIGNhbGxiYWNrcz8uZXJyb3I/LigpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGFjdGlvbiA9PT0gJ3JlbW92ZScgJiYgY29udmVyc2F0aW9uSWQgJiYgcGFydGljaXBhbnRDb250YWN0SWRzPy5sZW5ndGgpIHtcclxuICAgICAgY29uc3QgYWN0b3JOYW1lID0gdGhpcy5nZXRDb250YWN0TmFtZUJ5SWQoY29udGFjdElkKTtcclxuICAgICAgY29uc3Qgbm90aWNlSm9icyA9IHBhcnRpY2lwYW50Q29udGFjdElkcy5tYXAoKGlkKSA9PlxyXG4gICAgICAgIHRoaXMuYXBpLnNlbmRNZXNzYWdlKFxyXG4gICAgICAgICAgY29udmVyc2F0aW9uSWQsXHJcbiAgICAgICAgICBjb250YWN0SWQsXHJcbiAgICAgICAgICBgJHthY3Rvck5hbWV9IHJlbW92ZWQgJHt0aGlzLmdldENvbnRhY3ROYW1lQnlJZChpZCl9IGZyb20gdGhlIGdyb3VwYCxcclxuICAgICAgICAgICdTWVNURU0nXHJcbiAgICAgICAgKS5waXBlKGNhdGNoRXJyb3IoKCkgPT4gb2YobnVsbCkpKVxyXG4gICAgICApO1xyXG4gICAgICBjb25zdCByZW1vdmVKb2JzID0gcGFydGljaXBhbnRDb250YWN0SWRzLm1hcCgoaWQpID0+XHJcbiAgICAgICAgdGhpcy5hcGkubWFuYWdlR3JvdXAoaWQsIGFjdGlvbiwgY29udmVyc2F0aW9uSWQsIGdyb3VwTmFtZSlcclxuICAgICAgKTtcclxuXHJcbiAgICAgIGZvcmtKb2luKG5vdGljZUpvYnMpLnN1YnNjcmliZSh7XHJcbiAgICAgICAgbmV4dDogKCkgPT4ge1xyXG4gICAgICAgICAgZm9ya0pvaW4ocmVtb3ZlSm9icykuc3Vic2NyaWJlKHtcclxuICAgICAgICAgICAgbmV4dDogKCkgPT4ge1xyXG4gICAgICAgICAgICAgIHRoaXMubG9hZEluYm94KCk7XHJcbiAgICAgICAgICAgICAgdGhpcy5ub3RpZnlHcm91cE1lbWJlcnNoaXBDaGFuZ2VkKCk7XHJcbiAgICAgICAgICAgICAgY2FsbGJhY2tzPy5zdWNjZXNzPy4oKTtcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgZXJyb3I6ICgpID0+IHtcclxuICAgICAgICAgICAgICBjYWxsYmFja3M/LmVycm9yPy4oKTtcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgZXJyb3I6ICgpID0+IHtcclxuICAgICAgICAgIGNhbGxiYWNrcz8uZXJyb3I/LigpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgIH0pO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5hcGkubWFuYWdlR3JvdXAoY29udGFjdElkLCBhY3Rpb24sIGNvbnZlcnNhdGlvbklkLCBncm91cE5hbWUsIHBhcnRpY2lwYW50Q29udGFjdElkcykuc3Vic2NyaWJlKHtcclxuICAgICAgbmV4dDogKCkgPT4ge1xyXG4gICAgICAgIHRoaXMubG9hZEluYm94KCk7XHJcbiAgICAgICAgaWYgKGFjdGlvbiA9PT0gJ2FkZCcgJiYgY29udmVyc2F0aW9uSWQgJiYgcGFydGljaXBhbnRDb250YWN0SWRzPy5sZW5ndGgpIHtcclxuICAgICAgICAgIHRoaXMubm90aWZ5R3JvdXBNZW1iZXJzaGlwQ2hhbmdlZCgpO1xyXG4gICAgICAgICAgY29uc3QgYWRkZWROYW1lcyA9IHBhcnRpY2lwYW50Q29udGFjdElkcy5tYXAoKGlkKSA9PiB0aGlzLmdldENvbnRhY3ROYW1lQnlJZChpZCkpO1xyXG4gICAgICAgICAgY29uc3QgdGV4dCA9IGAke3RoaXMuZ2V0Q29udGFjdE5hbWVCeUlkKGNvbnRhY3RJZCl9IGFkZGVkICR7YWRkZWROYW1lcy5qb2luKCcsICcpfSB0byB0aGUgZ3JvdXBgO1xyXG4gICAgICAgICAgdGhpcy5zZW5kTWVzc2FnZShjb252ZXJzYXRpb25JZCwgdGV4dCwgJ1NZU1RFTScpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBjYWxsYmFja3M/LnN1Y2Nlc3M/LigpO1xyXG4gICAgICB9LFxyXG4gICAgICBlcnJvcjogKCkgPT4ge1xyXG4gICAgICAgIGNhbGxiYWNrcz8uZXJyb3I/LigpO1xyXG4gICAgICB9LFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvLyDilIDilIAgRGVsZXRlIC8gQ2xlYXIg4pSA4pSAXHJcbiAgZGVsZXRlQ29udmVyc2F0aW9uKGNvbnZlcnNhdGlvbklkOiBzdHJpbmcpOiB2b2lkIHtcclxuICAgIGNvbnN0IGNvbnRhY3RJZCA9IHRoaXMuYXV0aC5jb250YWN0SWQ7XHJcbiAgICBpZiAoIWNvbnRhY3RJZCkgcmV0dXJuO1xyXG5cclxuICAgIHRoaXMuYXBpLmRlbGV0ZUNvbnZlcnNhdGlvbihjb252ZXJzYXRpb25JZCwgY29udGFjdElkKS5zdWJzY3JpYmUoe1xyXG4gICAgICBuZXh0OiAoKSA9PiB7XHJcbiAgICAgICAgY29uc3QgaXRlbXMgPSB0aGlzLmluYm94JC52YWx1ZS5maWx0ZXIoaSA9PiBpLmNvbnZlcnNhdGlvbl9pZCAhPT0gY29udmVyc2F0aW9uSWQpO1xyXG4gICAgICAgIHRoaXMuaW5ib3gkLm5leHQoaXRlbXMpO1xyXG4gICAgICAgIHRoaXMucmVjYWxjVW5yZWFkKGl0ZW1zKTtcclxuICAgICAgICBjb25zdCBtYXAgPSBuZXcgTWFwKHRoaXMubWVzc2FnZXNNYXAkLnZhbHVlKTtcclxuICAgICAgICBtYXAuZGVsZXRlKGNvbnZlcnNhdGlvbklkKTtcclxuICAgICAgICB0aGlzLm1lc3NhZ2VzTWFwJC5uZXh0KG1hcCk7XHJcbiAgICAgICAgaWYgKHRoaXMuYWN0aXZlQ29udmVyc2F0aW9uSWQkLnZhbHVlID09PSBjb252ZXJzYXRpb25JZCkge1xyXG4gICAgICAgICAgdGhpcy5hY3RpdmVDb252ZXJzYXRpb25JZCQubmV4dChudWxsKTtcclxuICAgICAgICAgIHRoaXMuYWN0aXZlVmlldyQubmV4dCgnaW5ib3gnKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5jbG9zZUNoYXQoY29udmVyc2F0aW9uSWQpO1xyXG4gICAgICB9LFxyXG4gICAgICBlcnJvcjogKCkgPT4ge30sXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIGNsZWFyQ29udmVyc2F0aW9uKGNvbnZlcnNhdGlvbklkOiBzdHJpbmcpOiB2b2lkIHtcclxuICAgIGNvbnN0IGNvbnRhY3RJZCA9IHRoaXMuYXV0aC5jb250YWN0SWQ7XHJcbiAgICBpZiAoIWNvbnRhY3RJZCkgcmV0dXJuO1xyXG5cclxuICAgIHRoaXMuYXBpLmNsZWFyQ29udmVyc2F0aW9uKGNvbnZlcnNhdGlvbklkLCBjb250YWN0SWQpLnN1YnNjcmliZSh7XHJcbiAgICAgIG5leHQ6ICgpID0+IHtcclxuICAgICAgICBjb25zdCBtYXAgPSBuZXcgTWFwKHRoaXMubWVzc2FnZXNNYXAkLnZhbHVlKTtcclxuICAgICAgICBtYXAuc2V0KGNvbnZlcnNhdGlvbklkLCBbXSk7XHJcbiAgICAgICAgdGhpcy5tZXNzYWdlc01hcCQubmV4dChtYXApO1xyXG4gICAgICAgIGNvbnN0IGl0ZW1zID0gdGhpcy5pbmJveCQudmFsdWUubWFwKGkgPT5cclxuICAgICAgICAgIGkuY29udmVyc2F0aW9uX2lkID09PSBjb252ZXJzYXRpb25JZFxyXG4gICAgICAgICAgICA/IHsgLi4uaSwgbGFzdF9tZXNzYWdlX3ByZXZpZXc6ICcnLCBsYXN0X21lc3NhZ2VfYXQ6IGkubGFzdF9tZXNzYWdlX2F0IH1cclxuICAgICAgICAgICAgOiBpXHJcbiAgICAgICAgKTtcclxuICAgICAgICB0aGlzLmluYm94JC5uZXh0KGl0ZW1zKTtcclxuICAgICAgfSxcclxuICAgICAgZXJyb3I6ICgpID0+IHt9LFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBkZWxldGVHcm91cChjb252ZXJzYXRpb25JZDogc3RyaW5nLCBjYWxsYmFja3M/OiB7IHN1Y2Nlc3M/OiAoKSA9PiB2b2lkOyBlcnJvcj86ICgpID0+IHZvaWQgfSk6IHZvaWQge1xyXG4gICAgY29uc3QgY29udGFjdElkID0gdGhpcy5hdXRoLmNvbnRhY3RJZDtcclxuICAgIGlmICghY29udGFjdElkIHx8IHRoaXMuZGVsZXRpbmdDb252ZXJzYXRpb25JZHMuaGFzKGNvbnZlcnNhdGlvbklkKSkge1xyXG4gICAgICBjYWxsYmFja3M/LmVycm9yPy4oKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHByZXZpb3VzSW5ib3ggPSB0aGlzLmluYm94JC52YWx1ZTtcclxuICAgIGNvbnN0IHByZXZpb3VzTWVzc2FnZXNNYXAgPSBuZXcgTWFwKHRoaXMubWVzc2FnZXNNYXAkLnZhbHVlKTtcclxuICAgIGNvbnN0IHByZXZpb3VzT3BlbkNoYXRzID0gdGhpcy5vcGVuQ2hhdHMkLnZhbHVlO1xyXG4gICAgY29uc3QgcHJldmlvdXNBY3RpdmVDb252ZXJzYXRpb25JZCA9IHRoaXMuYWN0aXZlQ29udmVyc2F0aW9uSWQkLnZhbHVlO1xyXG4gICAgY29uc3QgcHJldmlvdXNBY3RpdmVWaWV3ID0gdGhpcy5hY3RpdmVWaWV3JC52YWx1ZTtcclxuICAgIGNvbnN0IHByZXZpb3VzR3JvdXBTZXR0aW5ncyA9IHRoaXMuZ3JvdXBTZXR0aW5ncyQudmFsdWU7XHJcblxyXG4gICAgdGhpcy5kZWxldGluZ0NvbnZlcnNhdGlvbklkcy5hZGQoY29udmVyc2F0aW9uSWQpO1xyXG4gICAgdGhpcy5zaG93VG9hc3QoJ0V4aXRpbmcgZ3JvdXAuLi4nLCAnaW5mbycsIDE1MDApO1xyXG4gICAgdGhpcy5yZW1vdmVDb252ZXJzYXRpb25Gcm9tVWkoY29udmVyc2F0aW9uSWQpO1xyXG5cclxuICAgIHRoaXMuYXBpLmRlbGV0ZUdyb3VwKGNvbnZlcnNhdGlvbklkLCBjb250YWN0SWQpLnN1YnNjcmliZSh7XHJcbiAgICAgIG5leHQ6ICgpID0+IHtcclxuICAgICAgICB0aGlzLmRlbGV0aW5nQ29udmVyc2F0aW9uSWRzLmRlbGV0ZShjb252ZXJzYXRpb25JZCk7XHJcbiAgICAgICAgdGhpcy5zaG93VG9hc3QoJ0V4aXRlZCBncm91cCcsICdzdWNjZXNzJyk7XHJcbiAgICAgICAgY2FsbGJhY2tzPy5zdWNjZXNzPy4oKTtcclxuICAgICAgfSxcclxuICAgICAgZXJyb3I6ICgpID0+IHtcclxuICAgICAgICB0aGlzLmRlbGV0aW5nQ29udmVyc2F0aW9uSWRzLmRlbGV0ZShjb252ZXJzYXRpb25JZCk7XHJcbiAgICAgICAgdGhpcy5pbmJveCQubmV4dChwcmV2aW91c0luYm94KTtcclxuICAgICAgICB0aGlzLnJlY2FsY1VucmVhZChwcmV2aW91c0luYm94KTtcclxuICAgICAgICB0aGlzLm1lc3NhZ2VzTWFwJC5uZXh0KHByZXZpb3VzTWVzc2FnZXNNYXApO1xyXG4gICAgICAgIHRoaXMub3BlbkNoYXRzJC5uZXh0KHByZXZpb3VzT3BlbkNoYXRzKTtcclxuICAgICAgICB0aGlzLmdyb3VwU2V0dGluZ3MkLm5leHQocHJldmlvdXNHcm91cFNldHRpbmdzKTtcclxuICAgICAgICB0aGlzLmFjdGl2ZUNvbnZlcnNhdGlvbklkJC5uZXh0KHByZXZpb3VzQWN0aXZlQ29udmVyc2F0aW9uSWQpO1xyXG4gICAgICAgIHRoaXMuYWN0aXZlVmlldyQubmV4dChwcmV2aW91c0FjdGl2ZVZpZXcpO1xyXG4gICAgICAgIHRoaXMuc2hvd1RvYXN0KCdDb3VsZCBub3QgZXhpdCBncm91cCcsICdlcnJvcicpO1xyXG4gICAgICAgIGNhbGxiYWNrcz8uZXJyb3I/LigpO1xyXG4gICAgICB9LFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHJlbW92ZUNvbnZlcnNhdGlvbkZyb21VaShjb252ZXJzYXRpb25JZDogc3RyaW5nKTogdm9pZCB7XHJcbiAgICBjb25zdCBpdGVtcyA9IHRoaXMuaW5ib3gkLnZhbHVlLmZpbHRlcihpID0+IFN0cmluZyhpLmNvbnZlcnNhdGlvbl9pZCkgIT09IFN0cmluZyhjb252ZXJzYXRpb25JZCkpO1xyXG4gICAgdGhpcy5pbmJveCQubmV4dChpdGVtcyk7XHJcbiAgICB0aGlzLnJlY2FsY1VucmVhZChpdGVtcyk7XHJcblxyXG4gICAgY29uc3QgbWFwID0gbmV3IE1hcCh0aGlzLm1lc3NhZ2VzTWFwJC52YWx1ZSk7XHJcbiAgICBtYXAuZGVsZXRlKGNvbnZlcnNhdGlvbklkKTtcclxuICAgIHRoaXMubWVzc2FnZXNNYXAkLm5leHQobWFwKTtcclxuXHJcbiAgICB0aGlzLm9wZW5DaGF0cyQubmV4dCh0aGlzLm9wZW5DaGF0cyQudmFsdWUuZmlsdGVyKGMgPT4gU3RyaW5nKGMuY29udmVyc2F0aW9uSWQpICE9PSBTdHJpbmcoY29udmVyc2F0aW9uSWQpKSk7XHJcbiAgICBpZiAoU3RyaW5nKHRoaXMuYWN0aXZlQ29udmVyc2F0aW9uSWQkLnZhbHVlKSA9PT0gU3RyaW5nKGNvbnZlcnNhdGlvbklkKSkge1xyXG4gICAgICB0aGlzLmFjdGl2ZUNvbnZlcnNhdGlvbklkJC5uZXh0KG51bGwpO1xyXG4gICAgICB0aGlzLmFjdGl2ZVZpZXckLm5leHQoJ2luYm94Jyk7XHJcbiAgICB9XHJcbiAgICBjb25zdCBzZXR0aW5ncyA9IHRoaXMuZ3JvdXBTZXR0aW5ncyQudmFsdWU7XHJcbiAgICBpZiAoc2V0dGluZ3M/LmNvbnZlcnNhdGlvbklkID09PSBjb252ZXJzYXRpb25JZCkge1xyXG4gICAgICB0aGlzLmNsZWFyR3JvdXBTZXR0aW5ncygpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLy8g4pSA4pSAIFJlYWN0aW9ucyDilIDilIBcclxuICBhZGRSZWFjdGlvbihtZXNzYWdlSWQ6IHN0cmluZywgZW1vamk6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgY29uc3QgY29udGFjdElkID0gdGhpcy5hdXRoLmNvbnRhY3RJZDtcclxuICAgIGlmICghY29udGFjdElkKSByZXR1cm47XHJcblxyXG4gICAgLy8gRW5mb3JjZSBvbmUgcmVhY3Rpb24gcGVyIHVzZXIg4oCUIHJlbW92ZSBhbnkgZXhpc3RpbmcgcmVhY3Rpb24gd2l0aCBhIGRpZmZlcmVudCBlbW9qaVxyXG4gICAgZm9yIChjb25zdCBtc2dzIG9mIHRoaXMubWVzc2FnZXNNYXAkLnZhbHVlLnZhbHVlcygpKSB7XHJcbiAgICAgIGNvbnN0IG1zZyA9IG1zZ3MuZmluZChtID0+IFN0cmluZyhtLm1lc3NhZ2VfaWQpID09PSBTdHJpbmcobWVzc2FnZUlkKSk7XHJcbiAgICAgIGlmIChtc2c/LnJlYWN0aW9ucykge1xyXG4gICAgICAgIGZvciAoY29uc3QgciBvZiBtc2cucmVhY3Rpb25zKSB7XHJcbiAgICAgICAgICBpZiAoci5oYXNSZWFjdGVkICYmIHIuZW1vamkgIT09IGVtb2ppKSB7XHJcbiAgICAgICAgICAgIHRoaXMuYXBwbHlSZWFjdGlvbk9wdGltaXN0aWNhbGx5KG1lc3NhZ2VJZCwgci5lbW9qaSwgZmFsc2UpO1xyXG4gICAgICAgICAgICB0aGlzLmFwaS5yZW1vdmVSZWFjdGlvbihtZXNzYWdlSWQsIGNvbnRhY3RJZCwgci5lbW9qaSkuc3Vic2NyaWJlKHsgZXJyb3I6ICgpID0+IHt9IH0pO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgICBicmVhaztcclxuICAgIH1cclxuXHJcbiAgICAvLyBPcHRpbWlzdGljIFVJIHNvIHVzZXIgc2VlcyByZWFjdGlvbiBpbW1lZGlhdGVseS5cclxuICAgIHRoaXMuYXBwbHlSZWFjdGlvbk9wdGltaXN0aWNhbGx5KG1lc3NhZ2VJZCwgZW1vamksIHRydWUpO1xyXG5cclxuICAgIHRoaXMuYXBpLmFkZFJlYWN0aW9uKG1lc3NhZ2VJZCwgY29udGFjdElkLCBlbW9qaSkuc3Vic2NyaWJlKHtcclxuICAgICAgbmV4dDogKCkgPT4ge1xyXG4gICAgICAgIHRoaXMucmVmcmVzaE1lc3NhZ2VSZWFjdGlvbnMobWVzc2FnZUlkKTtcclxuICAgICAgfSxcclxuICAgICAgZXJyb3I6ICgpID0+IHtcclxuICAgICAgICAvLyBSZXZlcnQgb3B0aW1pc3RpYyB1cGRhdGUgd2hlbiByZXF1ZXN0IGZhaWxzLlxyXG4gICAgICAgIHRoaXMuYXBwbHlSZWFjdGlvbk9wdGltaXN0aWNhbGx5KG1lc3NhZ2VJZCwgZW1vamksIGZhbHNlKTtcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcmVtb3ZlUmVhY3Rpb24obWVzc2FnZUlkOiBzdHJpbmcsIGVtb2ppOiBzdHJpbmcpOiB2b2lkIHtcclxuICAgIGNvbnN0IGNvbnRhY3RJZCA9IHRoaXMuYXV0aC5jb250YWN0SWQ7XHJcbiAgICBpZiAoIWNvbnRhY3RJZCkgcmV0dXJuO1xyXG5cclxuICAgIC8vIE9wdGltaXN0aWMgVUkgc28gdXNlciBzZWVzIHJlYWN0aW9uIHJlbW92YWwgaW1tZWRpYXRlbHkuXHJcbiAgICB0aGlzLmFwcGx5UmVhY3Rpb25PcHRpbWlzdGljYWxseShtZXNzYWdlSWQsIGVtb2ppLCBmYWxzZSk7XHJcblxyXG4gICAgdGhpcy5hcGkucmVtb3ZlUmVhY3Rpb24obWVzc2FnZUlkLCBjb250YWN0SWQsIGVtb2ppKS5zdWJzY3JpYmUoe1xyXG4gICAgICBuZXh0OiAoKSA9PiB7XHJcbiAgICAgICAgdGhpcy5yZWZyZXNoTWVzc2FnZVJlYWN0aW9ucyhtZXNzYWdlSWQpO1xyXG4gICAgICB9LFxyXG4gICAgICBlcnJvcjogKCkgPT4ge1xyXG4gICAgICAgIC8vIFJldmVydCBvcHRpbWlzdGljIHVwZGF0ZSB3aGVuIHJlcXVlc3QgZmFpbHMuXHJcbiAgICAgICAgdGhpcy5hcHBseVJlYWN0aW9uT3B0aW1pc3RpY2FsbHkobWVzc2FnZUlkLCBlbW9qaSwgdHJ1ZSk7XHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIGdldEFjdGl2ZUNvbnZlcnNhdGlvbklkKCk6IHN0cmluZyB8IG51bGwge1xyXG4gICAgcmV0dXJuIHRoaXMuYWN0aXZlQ29udmVyc2F0aW9uSWQkLnZhbHVlO1xyXG4gIH1cclxuXHJcbiAgLy8g4pSA4pSAIEdldHRlcnMg4pSA4pSAXHJcbiAgZ2V0TWVzc2FnZXNGb3JDb252ZXJzYXRpb24oY29udmVyc2F0aW9uSWQ6IHN0cmluZyk6IE1lc3NhZ2VbXSB7XHJcbiAgICByZXR1cm4gdGhpcy5tZXNzYWdlc01hcCQudmFsdWUuZ2V0KGNvbnZlcnNhdGlvbklkKSB8fCBbXTtcclxuICB9XHJcblxyXG4gIGdldEN1cnJlbnRJbmJveCgpOiBJbmJveEl0ZW1bXSB7XHJcbiAgICByZXR1cm4gdGhpcy5pbmJveCQudmFsdWU7XHJcbiAgfVxyXG5cclxuICAvLyDilIDilIAgUHJpdmF0ZSBoZWxwZXJzIOKUgOKUgFxyXG4gIC8qKlxyXG4gICAqIFByZWZlciBgeyB0eXBlLCBkYXRhIH1gOyBzdXBwb3J0IGZsYXQgYHsgdHlwZSwgLi4uZmllbGRzIH1gIGVudmVsb3BlcyBmcm9tIG9sZGVyIGJhY2tlbmRzLlxyXG4gICAqL1xyXG4gIHByaXZhdGUgd3NFdmVudFBheWxvYWQobXNnOiBXZWJTb2NrZXRNZXNzYWdlKTogYW55IHtcclxuICAgIGlmIChtc2cuZGF0YSAhPT0gdW5kZWZpbmVkICYmIG1zZy5kYXRhICE9PSBudWxsKSB7XHJcbiAgICAgIHJldHVybiBtc2cuZGF0YTtcclxuICAgIH1cclxuICAgIGNvbnN0IHJhdyA9IG1zZyBhcyB1bmtub3duIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+O1xyXG4gICAgY29uc3QgeyB0eXBlOiBfdCwgZGF0YTogX2QsIHRpbWVzdGFtcDogX3RzLCBtZXNzYWdlOiBfbXNnLCAuLi5yZXN0IH0gPSByYXc7XHJcbiAgICByZXR1cm4gT2JqZWN0LmtleXMocmVzdCkubGVuZ3RoID8gcmVzdCA6IG51bGw7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGxpc3RlbldlYlNvY2tldCgpOiB2b2lkIHtcclxuICAgIHRoaXMud3NTdWI/LnVuc3Vic2NyaWJlKCk7XHJcbiAgICB0aGlzLndzU3ViID0gdGhpcy53c1NlcnZpY2Uub25NZXNzYWdlJC5zdWJzY3JpYmUoKG1zZykgPT4gdGhpcy5oYW5kbGVXc01lc3NhZ2UobXNnKSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGhhbmRsZVdzTWVzc2FnZShtc2c6IFdlYlNvY2tldE1lc3NhZ2UpOiB2b2lkIHtcclxuICAgIHN3aXRjaCAobXNnLnR5cGUpIHtcclxuICAgICAgY2FzZSAnbmV3X21lc3NhZ2UnOlxyXG4gICAgICAgIHRoaXMuaGFuZGxlTmV3TWVzc2FnZSh0aGlzLndzRXZlbnRQYXlsb2FkKG1zZykpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICBjYXNlICdjb252ZXJzYXRpb25fdXBkYXRlZCc6XHJcbiAgICAgICAgdGhpcy5sb2FkSW5ib3goKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgY2FzZSAnZ3JvdXBfdXBkYXRlZCc6XHJcbiAgICAgICAgdGhpcy5oYW5kbGVHcm91cFVwZGF0ZWQodGhpcy53c0V2ZW50UGF5bG9hZChtc2cpKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgY2FzZSAnZXJyb3InOlxyXG4gICAgICAgIHRoaXMuaGFuZGxlV2ViU29ja2V0RXJyb3IobXNnLm1lc3NhZ2UpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBoYW5kbGVHcm91cFVwZGF0ZWQoZGF0YTogYW55KTogdm9pZCB7XHJcbiAgICB0aGlzLmxvYWRJbmJveCgpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBoYW5kbGVXZWJTb2NrZXRFcnJvcihlcnJvck1lc3NhZ2U6IHN0cmluZyB8IHVuZGVmaW5lZCk6IHZvaWQge1xyXG4gICAgdm9pZCBlcnJvck1lc3NhZ2U7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGhhbmRsZU5ld01lc3NhZ2UoZGF0YTogYW55KTogdm9pZCB7XHJcbiAgICBpZiAoIWRhdGEpIHJldHVybjtcclxuXHJcbiAgICBsZXQgbWVzc2FnZTogTWVzc2FnZSA9IHRoaXMubm9ybWFsaXplTWVzc2FnZVNoYXBlKGRhdGEpO1xyXG4gICAgdGhpcy5kZXRlY3RHcm91cFJlbW92YWxGb3JDdXJyZW50VXNlcihtZXNzYWdlKTtcclxuICAgIGNvbnN0IG15Q29udGFjdElkID0gU3RyaW5nKHRoaXMuYXV0aC5jb250YWN0SWQgPz8gJycpO1xyXG4gICAgY29uc3QgY29udklkID0gU3RyaW5nKG1lc3NhZ2UuY29udmVyc2F0aW9uX2lkID8/ICcnKTtcclxuICAgIGNvbnN0IGV4aXN0aW5nID0gdGhpcy5tZXNzYWdlc01hcCQudmFsdWUuZ2V0KGNvbnZJZCkgfHwgW107XHJcblxyXG4gICAgY29uc3Qgb3duRWNobyA9XHJcbiAgICAgIG15Q29udGFjdElkICYmXHJcbiAgICAgIFN0cmluZyhtZXNzYWdlLnNlbmRlcl9pZCkgPT09IG15Q29udGFjdElkICYmXHJcbiAgICAgICEhbWVzc2FnZS5tZXNzYWdlX2lkICYmXHJcbiAgICAgICFTdHJpbmcobWVzc2FnZS5tZXNzYWdlX2lkKS5zdGFydHNXaXRoKCd0ZW1wLScpO1xyXG5cclxuICAgIC8vIFdTIG9mdGVuIGFycml2ZXMgYmVmb3JlIEhUVFAgZmluaXNoZXMgcmVwbGFjaW5nIHRlbXAtOyBtZXJnZSBpbnRvIHRlbXAgaW5zdGVhZCBvZiBhcHBlbmRpbmcgYSBkdXBsaWNhdGUgcm93LlxyXG4gICAgaWYgKG93bkVjaG8pIHtcclxuICAgICAgY29uc3QgdGVtcElkeCA9IGV4aXN0aW5nLmZpbmRJbmRleCgobSkgPT4ge1xyXG4gICAgICAgIGlmICghU3RyaW5nKG0ubWVzc2FnZV9pZCkuc3RhcnRzV2l0aCgndGVtcC0nKSkgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIGlmIChTdHJpbmcobS5jb252ZXJzYXRpb25faWQpICE9PSBjb252SWQpIHJldHVybiBmYWxzZTtcclxuICAgICAgICBpZiAoU3RyaW5nKG0uc2VuZGVyX2lkKSAhPT0gbXlDb250YWN0SWQpIHJldHVybiBmYWxzZTtcclxuICAgICAgICBjb25zdCBkdCA9IE1hdGguYWJzKFxyXG4gICAgICAgICAgbmV3IERhdGUobS5jcmVhdGVkX2F0KS5nZXRUaW1lKCkgLSBuZXcgRGF0ZShtZXNzYWdlLmNyZWF0ZWRfYXQpLmdldFRpbWUoKVxyXG4gICAgICAgICk7XHJcbiAgICAgICAgaWYgKGR0ID49IDEyMF8wMDApIHJldHVybiBmYWxzZTtcclxuICAgICAgICBjb25zdCBhID0gU3RyaW5nKG0uY29udGVudCA/PyAnJykudHJpbSgpO1xyXG4gICAgICAgIGNvbnN0IGIgPSBTdHJpbmcobWVzc2FnZS5jb250ZW50ID8/ICcnKS50cmltKCk7XHJcbiAgICAgICAgcmV0dXJuIGEgPT09IGIgfHwgIWI7XHJcbiAgICAgIH0pO1xyXG4gICAgICBpZiAodGVtcElkeCA+PSAwKSB7XHJcbiAgICAgICAgY29uc3QgbWVyZ2VkOiBNZXNzYWdlID0gdGhpcy5tZXJnZU1lc3NhZ2VBdHRhY2htZW50cyhleGlzdGluZ1t0ZW1wSWR4XSwgdGhpcy5ub3JtYWxpemVNZXNzYWdlU2hhcGUoe1xyXG4gICAgICAgICAgLi4uZXhpc3RpbmdbdGVtcElkeF0sXHJcbiAgICAgICAgICAuLi5kYXRhLFxyXG4gICAgICAgICAgbWVzc2FnZV9pZDogbWVzc2FnZS5tZXNzYWdlX2lkLFxyXG4gICAgICAgICAgY29udmVyc2F0aW9uX2lkOiBjb252SWQsXHJcbiAgICAgICAgICBjb250ZW50OiB0aGlzLmNvYWxlc2NlTWVzc2FnZVRleHQoZGF0YSwgZXhpc3RpbmdbdGVtcElkeF0uY29udGVudCksXHJcbiAgICAgICAgfSkpO1xyXG4gICAgICAgIGNvbnN0IG1hcCA9IG5ldyBNYXAodGhpcy5tZXNzYWdlc01hcCQudmFsdWUpO1xyXG4gICAgICAgIGNvbnN0IG1zZ3MgPSB0aGlzLmRlZHVwZU1lc3NhZ2VzQnlJZEtlZXBGaXJzdChbLi4uZXhpc3RpbmddKTtcclxuICAgICAgICBtc2dzW3RlbXBJZHhdID0gbWVyZ2VkO1xyXG4gICAgICAgIG1hcC5zZXQoY29udklkLCB0aGlzLmRlZHVwZU1lc3NhZ2VzQnlJZEtlZXBGaXJzdChtc2dzKSk7XHJcbiAgICAgICAgdGhpcy5tZXNzYWdlc01hcCQubmV4dChtYXApO1xyXG4gICAgICAgIHRoaXMucmVmcmVzaE1lc3NhZ2VSZWFjdGlvbnMobWVyZ2VkLm1lc3NhZ2VfaWQpO1xyXG4gICAgICAgIG1lc3NhZ2UgPSBtZXJnZWQ7XHJcbiAgICAgICAgdGhpcy51cGRhdGVJbmJveFByZXZpZXcobWVzc2FnZSk7XHJcbiAgICAgICAgaWYgKHRoaXMuYWN0aXZlQ29udmVyc2F0aW9uSWQkLnZhbHVlID09PSBtZXNzYWdlLmNvbnZlcnNhdGlvbl9pZCkge1xyXG4gICAgICAgICAgdGhpcy5tYXJrQXNSZWFkKG1lc3NhZ2UuY29udmVyc2F0aW9uX2lkKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgaXNGcm9tT3RoZXIgPSBTdHJpbmcobWVzc2FnZS5zZW5kZXJfaWQpICE9PSBteUNvbnRhY3RJZDtcclxuICAgIGNvbnN0IG1lbnRpb25zTWUgPSBpc0Zyb21PdGhlciAmJiB0aGlzLm1lc3NhZ2VNZW50aW9uc0N1cnJlbnRVc2VyKG1lc3NhZ2UpO1xyXG5cclxuICAgIGNvbnN0IGR1cGxpY2F0ZUlkeCA9IGV4aXN0aW5nLmZpbmRJbmRleChcclxuICAgICAgKG0pID0+XHJcbiAgICAgICAgU3RyaW5nKG0ubWVzc2FnZV9pZCkgPT09IFN0cmluZyhtZXNzYWdlLm1lc3NhZ2VfaWQpIHx8XHJcbiAgICAgICAgKFN0cmluZyhtLnNlbmRlcl9pZCkgPT09IFN0cmluZyhtZXNzYWdlLnNlbmRlcl9pZCkgJiZcclxuICAgICAgICAgIFN0cmluZyhtLmNvbnRlbnQgPz8gJycpID09PSBTdHJpbmcobWVzc2FnZS5jb250ZW50ID8/ICcnKSAmJlxyXG4gICAgICAgICAgTWF0aC5hYnMobmV3IERhdGUobS5jcmVhdGVkX2F0KS5nZXRUaW1lKCkgLSBuZXcgRGF0ZShtZXNzYWdlLmNyZWF0ZWRfYXQpLmdldFRpbWUoKSkgPCAyMDAwKVxyXG4gICAgKTtcclxuICAgIGNvbnN0IGlzRHVwbGljYXRlID0gZHVwbGljYXRlSWR4ID49IDA7XHJcblxyXG4gICAgaWYgKCFpc0R1cGxpY2F0ZSkge1xyXG4gICAgICB0aGlzLmFwcGVuZE1lc3NhZ2UobWVzc2FnZSk7XHJcblxyXG4gICAgICBpZiAoaXNGcm9tT3RoZXIpIHtcclxuICAgICAgICB0aGlzLnBsYXlTb2Z0Tm90aWZpY2F0aW9uU291bmQoKTtcclxuICAgICAgfVxyXG4gICAgICB0aGlzLnVwZGF0ZUluYm94UHJldmlldyhtZXNzYWdlKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIGNvbnN0IG1hcCA9IG5ldyBNYXAodGhpcy5tZXNzYWdlc01hcCQudmFsdWUpO1xyXG4gICAgICBjb25zdCBtc2dzID0gWy4uLmV4aXN0aW5nXTtcclxuICAgICAgbXNnc1tkdXBsaWNhdGVJZHhdID0gdGhpcy5tZXJnZU1lc3NhZ2VBdHRhY2htZW50cyhleGlzdGluZ1tkdXBsaWNhdGVJZHhdLCBtZXNzYWdlKTtcclxuICAgICAgbWFwLnNldChjb252SWQsIG1zZ3MpO1xyXG4gICAgICB0aGlzLm1lc3NhZ2VzTWFwJC5uZXh0KG1hcCk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKHRoaXMuYWN0aXZlQ29udmVyc2F0aW9uSWQkLnZhbHVlICE9PSBtZXNzYWdlLmNvbnZlcnNhdGlvbl9pZCkge1xyXG4gICAgICBpZiAoaXNGcm9tT3RoZXIgJiYgIWlzRHVwbGljYXRlKSB7XHJcbiAgICAgICAgdGhpcy5pbmNyZW1lbnRVbnJlYWQobWVzc2FnZS5jb252ZXJzYXRpb25faWQpO1xyXG4gICAgICAgIGlmIChtZW50aW9uc01lKSB7XHJcbiAgICAgICAgICB0aGlzLnNldENvbnZlcnNhdGlvbk1lbnRpb24obWVzc2FnZS5jb252ZXJzYXRpb25faWQsIHRydWUpO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfSBlbHNlIHtcclxuICAgICAgdGhpcy5tYXJrQXNSZWFkKG1lc3NhZ2UuY29udmVyc2F0aW9uX2lkKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKiBQdWJsaWMg4oCUIGxldHMgY29tcG9uZW50cyBhZGQgYW4gb3B0aW1pc3RpYyBtZXNzYWdlIHdpdGhvdXQgYSByb3VuZC10cmlwLiAqL1xyXG4gIGFwcGVuZE9wdGltaXN0aWNNZXNzYWdlKG1lc3NhZ2U6IE1lc3NhZ2UpOiB2b2lkIHtcclxuICAgIHRoaXMuYXBwZW5kTWVzc2FnZShtZXNzYWdlKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgYXBwZW5kTWVzc2FnZShtZXNzYWdlOiBNZXNzYWdlKTogdm9pZCB7XHJcbiAgICBjb25zdCBtYXAgPSBuZXcgTWFwKHRoaXMubWVzc2FnZXNNYXAkLnZhbHVlKTtcclxuICAgIGNvbnN0IGN1cnJlbnQgPSBtYXAuZ2V0KG1lc3NhZ2UuY29udmVyc2F0aW9uX2lkKSB8fCBbXTtcclxuICAgIGNvbnN0IHNhbWVJZElkeCA9IGN1cnJlbnQuZmluZEluZGV4KChtKSA9PiBTdHJpbmcobS5tZXNzYWdlX2lkKSA9PT0gU3RyaW5nKG1lc3NhZ2UubWVzc2FnZV9pZCkpO1xyXG4gICAgaWYgKHNhbWVJZElkeCA+PSAwKSB7XHJcbiAgICAgIGNvbnN0IG1zZ3MgPSBbLi4uY3VycmVudF07XHJcbiAgICAgIG1zZ3Nbc2FtZUlkSWR4XSA9IHRoaXMubWVyZ2VNZXNzYWdlQXR0YWNobWVudHMoY3VycmVudFtzYW1lSWRJZHhdLCBtZXNzYWdlKTtcclxuICAgICAgbWFwLnNldChtZXNzYWdlLmNvbnZlcnNhdGlvbl9pZCwgbXNncyk7XHJcbiAgICAgIHRoaXMubWVzc2FnZXNNYXAkLm5leHQobWFwKTtcclxuICAgICAgdGhpcy5yZWZyZXNoTWVzc2FnZVJlYWN0aW9ucyhtZXNzYWdlLm1lc3NhZ2VfaWQpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgbXNncyA9IFsuLi5jdXJyZW50LCBtZXNzYWdlXTtcclxuICAgIG1hcC5zZXQobWVzc2FnZS5jb252ZXJzYXRpb25faWQsIG1zZ3MpO1xyXG4gICAgdGhpcy5tZXNzYWdlc01hcCQubmV4dChtYXApO1xyXG4gICAgdGhpcy5yZWZyZXNoTWVzc2FnZVJlYWN0aW9ucyhtZXNzYWdlLm1lc3NhZ2VfaWQpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBtZXJnZU1lc3NhZ2VBdHRhY2htZW50cyhleGlzdGluZzogTWVzc2FnZSwgaW5jb21pbmc6IE1lc3NhZ2UpOiBNZXNzYWdlIHtcclxuICAgIGNvbnN0IGV4aXN0aW5nQXR0YWNobWVudHMgPSB0aGlzLm5vcm1hbGl6ZUF0dGFjaG1lbnRMaXN0KGV4aXN0aW5nLmF0dGFjaG1lbnRzIHx8IFtdKTtcclxuICAgIGNvbnN0IGluY29taW5nQXR0YWNobWVudHMgPSB0aGlzLm5vcm1hbGl6ZUF0dGFjaG1lbnRMaXN0KGluY29taW5nLmF0dGFjaG1lbnRzIHx8IFtdKTtcclxuICAgIGNvbnN0IGF0dGFjaG1lbnRzID1cclxuICAgICAgaW5jb21pbmdBdHRhY2htZW50cy5sZW5ndGggPj0gZXhpc3RpbmdBdHRhY2htZW50cy5sZW5ndGggPyBpbmNvbWluZ0F0dGFjaG1lbnRzIDogZXhpc3RpbmdBdHRhY2htZW50cztcclxuXHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAuLi5leGlzdGluZyxcclxuICAgICAgLi4uaW5jb21pbmcsXHJcbiAgICAgIHJlYWN0aW9uczogaW5jb21pbmcucmVhY3Rpb25zIHx8IGV4aXN0aW5nLnJlYWN0aW9ucyxcclxuICAgICAgYXR0YWNobWVudHM6IGF0dGFjaG1lbnRzLmxlbmd0aCA+IDAgPyBhdHRhY2htZW50cyA6IGluY29taW5nLmF0dGFjaG1lbnRzIHx8IGV4aXN0aW5nLmF0dGFjaG1lbnRzLFxyXG4gICAgfTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgbm9ybWFsaXplQXR0YWNobWVudExpc3QoYXR0YWNobWVudHM6IEF0dGFjaG1lbnRbXSk6IEF0dGFjaG1lbnRbXSB7XHJcbiAgICBjb25zdCBieUlkID0gbmV3IE1hcDxzdHJpbmcsIEF0dGFjaG1lbnQ+KCk7XHJcbiAgICBmb3IgKGNvbnN0IGF0dGFjaG1lbnQgb2YgYXR0YWNobWVudHMpIHtcclxuICAgICAgY29uc3QgZmlsZUlkID0gU3RyaW5nKGF0dGFjaG1lbnQ/LmZpbGVfaWQgfHwgJycpLnRyaW0oKTtcclxuICAgICAgaWYgKCFmaWxlSWQgfHwgZmlsZUlkLnN0YXJ0c1dpdGgoJ3RlbXAtJykpIGNvbnRpbnVlO1xyXG4gICAgICBieUlkLnNldChmaWxlSWQsIHtcclxuICAgICAgICAuLi5hdHRhY2htZW50LFxyXG4gICAgICAgIGZpbGVfaWQ6IGZpbGVJZCxcclxuICAgICAgICBmaWxlbmFtZTogYXR0YWNobWVudC5maWxlbmFtZSB8fCAnRmlsZScsXHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIEFycmF5LmZyb20oYnlJZC52YWx1ZXMoKSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHVwZGF0ZUluYm94UHJldmlldyhtZXNzYWdlOiBNZXNzYWdlKTogdm9pZCB7XHJcbiAgICBjb25zdCB0ZXh0ID0gU3RyaW5nKG1lc3NhZ2UuY29udGVudCA/PyAnJykudHJpbSgpO1xyXG4gICAgY29uc3QgbWVkaWEgPSB0aGlzLm1lc3NhZ2VMb29rc0xpa2VNZWRpYShtZXNzYWdlKTtcclxuICAgIGlmICghdGV4dCAmJiAhbWVkaWEpIHtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgY29uc3QgcHJldmlldyA9IHRleHQgfHwgJ1tJbWFnZV0nO1xyXG4gICAgY29uc3QgaXRlbXMgPSB0aGlzLmluYm94JC52YWx1ZS5tYXAoKGl0ZW0pID0+IHtcclxuICAgICAgaWYgKGl0ZW0uY29udmVyc2F0aW9uX2lkID09PSBtZXNzYWdlLmNvbnZlcnNhdGlvbl9pZCkge1xyXG4gICAgICAgIGNvbnN0IG1lbnRpb25lZCA9IGl0ZW0uaGFzX21lbnRpb24gfHwgdGhpcy5tZW50aW9uQ29udmVyc2F0aW9uSWRzJC52YWx1ZS5oYXMoU3RyaW5nKGl0ZW0uY29udmVyc2F0aW9uX2lkKSk7XHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgIC4uLml0ZW0sXHJcbiAgICAgICAgICBsYXN0X21lc3NhZ2VfcHJldmlldzogcHJldmlldyxcclxuICAgICAgICAgIGxhc3RfbWVzc2FnZV9hdDogbWVzc2FnZS5jcmVhdGVkX2F0LFxyXG4gICAgICAgICAgaGFzX21lbnRpb246IG1lbnRpb25lZCxcclxuICAgICAgICB9O1xyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiBpdGVtO1xyXG4gICAgfSk7XHJcblxyXG4gICAgaXRlbXMuc29ydCgoYSwgYikgPT4gbmV3IERhdGUoYi5sYXN0X21lc3NhZ2VfYXQpLmdldFRpbWUoKSAtIG5ldyBEYXRlKGEubGFzdF9tZXNzYWdlX2F0KS5nZXRUaW1lKCkpO1xyXG4gICAgdGhpcy5pbmJveCQubmV4dChpdGVtcyk7XHJcbiAgfVxyXG5cclxuICAvKiogRmlyc3Qgbm9uLWVtcHR5IHRleHQgZmllbGQgZnJvbSBBUEkgLyBXUyBvYmplY3RzIChQT1NUIGJvZGllcyBvZnRlbiBvbWl0IGBjb250ZW50YCkuICovXHJcbiAgcHJpdmF0ZSBjb2FsZXNjZU1lc3NhZ2VUZXh0KHJhdzogYW55LCBmYWxsYmFjayA9ICcnKTogc3RyaW5nIHtcclxuICAgIGNvbnN0IGNhbmRzID0gW3Jhdz8uY29udGVudCwgcmF3Py5ib2R5LCByYXc/LnRleHQsIGZhbGxiYWNrXTtcclxuICAgIGZvciAoY29uc3QgYyBvZiBjYW5kcykge1xyXG4gICAgICBpZiAodHlwZW9mIGMgPT09ICdzdHJpbmcnICYmIGMudHJpbSgpKSByZXR1cm4gYztcclxuICAgICAgaWYgKGMgIT0gbnVsbCAmJiB0eXBlb2YgYyAhPT0gJ29iamVjdCcgJiYgU3RyaW5nKGMpLnRyaW0oKSkgcmV0dXJuIFN0cmluZyhjKS50cmltKCk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdHlwZW9mIGZhbGxiYWNrID09PSAnc3RyaW5nJyA/IGZhbGxiYWNrIDogU3RyaW5nKGZhbGxiYWNrID8/ICcnKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgcGFyc2VSZXBseUNvbnRlbnQoY29udGVudDogc3RyaW5nKTogeyByZXBseTogTWVzc2FnZVJlcGx5UHJldmlldzsgYm9keTogc3RyaW5nIH0gfCBudWxsIHtcclxuICAgIGNvbnN0IHZhbHVlID0gU3RyaW5nKGNvbnRlbnQgfHwgJycpO1xyXG4gICAgY29uc3QgbWF0Y2ggPSB2YWx1ZS5tYXRjaCgvXlxcW1JlcGx5IHRvIChbXlxcXV0rKVxcXVxcbj4gKFteXFxuXSopXFxuXFxuKFtcXHNcXFNdKikkLyk7XHJcbiAgICBpZiAoIW1hdGNoKSByZXR1cm4gbnVsbDtcclxuICAgIHJldHVybiB7XHJcbiAgICAgIHJlcGx5OiB7XHJcbiAgICAgICAgc2VuZGVyX25hbWU6IG1hdGNoWzFdLnRyaW0oKSxcclxuICAgICAgICBjb250ZW50OiBtYXRjaFsyXS50cmltKCksXHJcbiAgICAgIH0sXHJcbiAgICAgIGJvZHk6IG1hdGNoWzNdLFxyXG4gICAgfTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgcmVwbHlCb2R5VGV4dChjb250ZW50OiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gICAgcmV0dXJuIHRoaXMucGFyc2VSZXBseUNvbnRlbnQoY29udGVudCk/LmJvZHkgPz8gU3RyaW5nKGNvbnRlbnQgfHwgJycpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBub3RpZnlHcm91cE1lbWJlcnNoaXBDaGFuZ2VkKCk6IHZvaWQge1xyXG4gICAgdGhpcy5ncm91cE1lbWJlcnNoaXBWZXJzaW9uJC5uZXh0KHRoaXMuZ3JvdXBNZW1iZXJzaGlwVmVyc2lvbiQudmFsdWUgKyAxKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgcmVwbHlFeGNlcnB0KGNvbnRlbnQ6IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgICBjb25zdCBwYXJzZWQgPSB0aGlzLnBhcnNlUmVwbHlDb250ZW50KGNvbnRlbnQpO1xyXG4gICAgY29uc3QgYmFzZSA9IChwYXJzZWQ/LmJvZHkgPz8gY29udGVudCkucmVwbGFjZSgvXFxzKy9nLCAnICcpLnRyaW0oKTtcclxuICAgIHJldHVybiBiYXNlLmxlbmd0aCA+IDEyMCA/IGAke2Jhc2Uuc2xpY2UoMCwgMTE3KX0uLi5gIDogYmFzZSB8fCAnQXR0YWNobWVudCc7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGN1cnJlbnRNZW50aW9uVG9rZW5zKCk6IHN0cmluZ1tdIHtcclxuICAgIGNvbnN0IGN1cnJlbnQgPSB0aGlzLmF1dGguY3VycmVudENvbnRhY3Q7XHJcbiAgICBjb25zdCB2YWx1ZXMgPSBbXHJcbiAgICAgIGN1cnJlbnQ/LnVzZXJuYW1lLFxyXG4gICAgICBjdXJyZW50Py5lbWFpbD8uc3BsaXQoJ0AnKVswXSxcclxuICAgICAgY3VycmVudD8uZmlyc3RfbmFtZSxcclxuICAgICAgY3VycmVudD8ubGFzdF9uYW1lLFxyXG4gICAgICBjdXJyZW50Py5lbWFpbCxcclxuICAgIF07XHJcbiAgICByZXR1cm4gdmFsdWVzXHJcbiAgICAgIC5tYXAoKHZhbHVlKSA9PiBTdHJpbmcodmFsdWUgfHwgJycpLnRyaW0oKS50b0xvd2VyQ2FzZSgpKVxyXG4gICAgICAuZmlsdGVyKEJvb2xlYW4pXHJcbiAgICAgIC5tYXAoKHZhbHVlKSA9PiB2YWx1ZS5yZXBsYWNlKC9eQC8sICcnKSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIG1lc3NhZ2VUZXh0TWVudGlvbnNDdXJyZW50VXNlcihjb250ZW50OiBzdHJpbmcpOiBib29sZWFuIHtcclxuICAgIGNvbnN0IHRva2VucyA9IHRoaXMuY3VycmVudE1lbnRpb25Ub2tlbnMoKTtcclxuICAgIGlmICghdG9rZW5zLmxlbmd0aCkgcmV0dXJuIGZhbHNlO1xyXG4gICAgY29uc3QgbWVudGlvbnMgPSBBcnJheS5mcm9tKFN0cmluZyhjb250ZW50IHx8ICcnKS5tYXRjaEFsbCgvKF58W15hLXpBLVowLTkuXy1dKUAoW2EtekEtWjAtOS5fLV0rKS9nKSlcclxuICAgICAgLm1hcCgobWF0Y2gpID0+IG1hdGNoWzJdLnRvTG93ZXJDYXNlKCkpO1xyXG4gICAgcmV0dXJuIG1lbnRpb25zLnNvbWUoKG1lbnRpb24pID0+IHRva2Vucy5pbmNsdWRlcyhtZW50aW9uKSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIG1lc3NhZ2VNZW50aW9uc0N1cnJlbnRVc2VyKG1lc3NhZ2U6IE1lc3NhZ2UpOiBib29sZWFuIHtcclxuICAgIGNvbnN0IG15SWQgPSBTdHJpbmcodGhpcy5hdXRoLmNvbnRhY3RJZCB8fCAnJyk7XHJcbiAgICBjb25zdCBleHBsaWNpdE1lbnRpb25zID0gQXJyYXkuaXNBcnJheShtZXNzYWdlLm1lbnRpb25zKVxyXG4gICAgICA/IG1lc3NhZ2UubWVudGlvbnMubWFwKChpZCkgPT4gU3RyaW5nKGlkKSlcclxuICAgICAgOiBbXTtcclxuICAgIHJldHVybiAoISFteUlkICYmIGV4cGxpY2l0TWVudGlvbnMuaW5jbHVkZXMobXlJZCkpIHx8XHJcbiAgICAgIHRoaXMubWVzc2FnZVRleHRNZW50aW9uc0N1cnJlbnRVc2VyKFN0cmluZyhtZXNzYWdlLmNvbnRlbnQgfHwgJycpKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgc2V0Q29udmVyc2F0aW9uTWVudGlvbihjb252ZXJzYXRpb25JZDogc3RyaW5nLCBoYXNNZW50aW9uOiBib29sZWFuKTogdm9pZCB7XHJcbiAgICBjb25zdCBpZCA9IFN0cmluZyhjb252ZXJzYXRpb25JZCB8fCAnJyk7XHJcbiAgICBpZiAoIWlkKSByZXR1cm47XHJcbiAgICBjb25zdCBuZXh0ID0gbmV3IFNldCh0aGlzLm1lbnRpb25Db252ZXJzYXRpb25JZHMkLnZhbHVlKTtcclxuICAgIGlmIChoYXNNZW50aW9uKSB7XHJcbiAgICAgIG5leHQuYWRkKGlkKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIG5leHQuZGVsZXRlKGlkKTtcclxuICAgIH1cclxuICAgIHRoaXMubWVudGlvbkNvbnZlcnNhdGlvbklkcyQubmV4dChuZXh0KTtcclxuICAgIGNvbnN0IGl0ZW1zID0gdGhpcy5pbmJveCQudmFsdWUubWFwKChpdGVtKSA9PlxyXG4gICAgICBTdHJpbmcoaXRlbS5jb252ZXJzYXRpb25faWQpID09PSBpZCA/IHsgLi4uaXRlbSwgaGFzX21lbnRpb246IGhhc01lbnRpb24gfSA6IGl0ZW1cclxuICAgICk7XHJcbiAgICB0aGlzLmluYm94JC5uZXh0KGl0ZW1zKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgbWVzc2FnZUxvb2tzTGlrZU1lZGlhKG06IE1lc3NhZ2UpOiBib29sZWFuIHtcclxuICAgIGNvbnN0IHQgPSBtLm1lc3NhZ2VfdHlwZTtcclxuICAgIGlmICh0ICYmIHQgIT09ICdURVhUJykgcmV0dXJuIHRydWU7XHJcbiAgICBjb25zdCB1ID0gU3RyaW5nKG0ubWVkaWFfdXJsID8/ICcnKS50cmltKCk7XHJcbiAgICBpZiAodSAmJiAodS5zdGFydHNXaXRoKCdodHRwOi8vJykgfHwgdS5zdGFydHNXaXRoKCdodHRwczovLycpIHx8IHUuc3RhcnRzV2l0aCgnZGF0YTonKSkpIHtcclxuICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gQXJyYXkuaXNBcnJheShtLmF0dGFjaG1lbnRzKSAmJiBtLmF0dGFjaG1lbnRzLmxlbmd0aCA+IDA7XHJcbiAgfVxyXG5cclxuICAvKiogU2FtZSBsb2dpY2FsIG1lc3NhZ2VfaWQgY2FuIGFwcGVhciB0d2ljZSB3aGVuIFdTIGJlYXRzIEhUVFAgdGVtcCByZXBsYWNlbWVudCDigJQga2VlcCBmaXJzdCByb3cuICovXHJcbiAgcHJpdmF0ZSBkZWR1cGVNZXNzYWdlc0J5SWRLZWVwRmlyc3QobXNnczogTWVzc2FnZVtdKTogTWVzc2FnZVtdIHtcclxuICAgIGNvbnN0IHNlZW4gPSBuZXcgU2V0PHN0cmluZz4oKTtcclxuICAgIHJldHVybiBtc2dzLmZpbHRlcigobSkgPT4ge1xyXG4gICAgICBjb25zdCBpZCA9IFN0cmluZyhtLm1lc3NhZ2VfaWQgPz8gJycpO1xyXG4gICAgICBpZiAoIWlkKSByZXR1cm4gdHJ1ZTtcclxuICAgICAgaWYgKHNlZW4uaGFzKGlkKSkgcmV0dXJuIGZhbHNlO1xyXG4gICAgICBzZWVuLmFkZChpZCk7XHJcbiAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGluY3JlbWVudFVucmVhZChjb252ZXJzYXRpb25JZDogc3RyaW5nKTogdm9pZCB7XHJcbiAgICBjb25zdCBpdGVtcyA9IHRoaXMuaW5ib3gkLnZhbHVlLm1hcCgoaXRlbSkgPT5cclxuICAgICAgaXRlbS5jb252ZXJzYXRpb25faWQgPT09IGNvbnZlcnNhdGlvbklkXHJcbiAgICAgICAgPyB7IC4uLml0ZW0sIHVucmVhZF9jb3VudDogTnVtYmVyKGl0ZW0udW5yZWFkX2NvdW50KSArIDEgfVxyXG4gICAgICAgIDogaXRlbVxyXG4gICAgKTtcclxuICAgIHRoaXMuaW5ib3gkLm5leHQoaXRlbXMpO1xyXG4gICAgdGhpcy5yZWNhbGNVbnJlYWQoaXRlbXMpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogTm9ybWFsaXplIGJhY2tlbmQgbWVzc2FnZSBzaGFwZXMgc28gVUkgY2FuIHJlbGlhYmx5IHJlbmRlciBhdHRhY2htZW50cy9tZWRpYS5cclxuICAgKiBTdXBwb3J0cyBsZWdhY3kgYW5kIGN1cnJlbnQgZmllbGQgbmFtZXMgcmV0dXJuZWQgYnkgQVBJL1dTIHBheWxvYWRzLlxyXG4gICAqL1xyXG4gIHByaXZhdGUgbm9ybWFsaXplTWVzc2FnZVNoYXBlKHJhdzogYW55KTogTWVzc2FnZSB7XHJcbiAgICBjb25zdCBiYXNlOiBNZXNzYWdlID0ge1xyXG4gICAgICBtZXNzYWdlX2lkOiBTdHJpbmcocmF3Py5tZXNzYWdlX2lkID8/IHJhdz8uaWQgPz8gJycpLFxyXG4gICAgICBjb252ZXJzYXRpb25faWQ6IFN0cmluZyhyYXc/LmNvbnZlcnNhdGlvbl9pZCA/PyByYXc/LmNvbnZlcnNhdGlvbklkID8/ICcnKSxcclxuICAgICAgc2VuZGVyX2lkOiBTdHJpbmcocmF3Py5zZW5kZXJfaWQgPz8gcmF3Py5zZW5kZXJJZCA/PyAnJyksXHJcbiAgICAgIHNlbmRlcl9uYW1lOiByYXc/LnNlbmRlcl9uYW1lLFxyXG4gICAgICBzZW5kZXJfdXNlcm5hbWU6IHJhdz8uc2VuZGVyX3VzZXJuYW1lLFxyXG4gICAgICBzZW5kZXJfZmlyc3RfbmFtZTogcmF3Py5zZW5kZXJfZmlyc3RfbmFtZSxcclxuICAgICAgc2VuZGVyX2xhc3RfbmFtZTogcmF3Py5zZW5kZXJfbGFzdF9uYW1lLFxyXG4gICAgICBtZXNzYWdlX3R5cGU6IChyYXc/Lm1lc3NhZ2VfdHlwZSA/PyByYXc/Lm1lc3NhZ2VUeXBlID8/ICdURVhUJykgYXMgTWVzc2FnZVsnbWVzc2FnZV90eXBlJ10sXHJcbiAgICAgIGNvbnRlbnQ6IHJhdz8uY29udGVudCA/PyByYXc/LmJvZHkgPz8gcmF3Py50ZXh0ID8/ICcnLFxyXG4gICAgICBtZWRpYV91cmw6IHJhdz8ubWVkaWFfdXJsID8/IHJhdz8ubWVkaWFVcmwgPz8gcmF3Py51cmwgPz8gcmF3Py5maWxlX3VybCxcclxuICAgICAgY3JlYXRlZF9hdDogcmF3Py5jcmVhdGVkX2F0ID8/IHJhdz8uY3JlYXRlZEF0ID8/IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcclxuICAgICAgaXNfcmVhZDogcmF3Py5pc19yZWFkLFxyXG4gICAgICByZWFjdGlvbnM6IHJhdz8ucmVhY3Rpb25zLFxyXG4gICAgICBtZW50aW9uczogcmF3Py5tZW50aW9ucyxcclxuICAgICAgYXR0YWNobWVudHM6IHJhdz8uYXR0YWNobWVudHMsXHJcbiAgICAgIGlzX3Bpbm5lZDogcmF3Py5pc19waW5uZWQsXHJcbiAgICAgIHBpbm5lZF9hdDogcmF3Py5waW5uZWRfYXQsXHJcbiAgICAgIHBpbm5lZF9ieTogcmF3Py5waW5uZWRfYnksXHJcbiAgICB9O1xyXG5cclxuICAgIGNvbnN0IHJhd0NvbnRlbnQgPSBTdHJpbmcoYmFzZS5jb250ZW50IHx8ICcnKTtcclxuICAgIGlmIChyYXdDb250ZW50LnN0YXJ0c1dpdGgoUExBSU5fVEVYVF9NRVNTQUdFX1BSRUZJWCkpIHtcclxuICAgICAgYmFzZS5jb250ZW50ID0gcmF3Q29udGVudC5zbGljZShQTEFJTl9URVhUX01FU1NBR0VfUFJFRklYLmxlbmd0aCk7XHJcbiAgICAgIGJhc2UucmVuZGVyX2FzX3BsYWluX3RleHQgPSB0cnVlO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgYmFzZS5yZW5kZXJfYXNfcGxhaW5fdGV4dCA9IHJhdz8ucmVuZGVyX2FzX3BsYWluX3RleHQgPz8gcmF3Py5yZW5kZXJBc1BsYWluVGV4dDtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBwYXJzZWRSZXBseSA9IHRoaXMucGFyc2VSZXBseUNvbnRlbnQoU3RyaW5nKGJhc2UuY29udGVudCB8fCAnJykpO1xyXG4gICAgaWYgKHBhcnNlZFJlcGx5KSB7XHJcbiAgICAgIGJhc2UuY29udGVudCA9IHBhcnNlZFJlcGx5LmJvZHk7XHJcbiAgICAgIGJhc2UucmVwbHlfdG8gPSByYXc/LnJlcGx5X3RvID8/IHJhdz8ucmVwbHlUbyA/PyBwYXJzZWRSZXBseS5yZXBseTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIGJhc2UucmVwbHlfdG8gPSByYXc/LnJlcGx5X3RvID8/IHJhdz8ucmVwbHlUbztcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCB1dWlkUmUgPVxyXG4gICAgICAvXlswLTlhLWZdezh9LVswLTlhLWZdezR9LVsxLTVdWzAtOWEtZl17M30tWzg5YWJdWzAtOWEtZl17M30tWzAtOWEtZl17MTJ9JC9pO1xyXG5cclxuICAgIGNvbnN0IHRvU3RyaW5nQXJyYXkgPSAodmFsdWU6IGFueSk6IHN0cmluZ1tdID0+IHtcclxuICAgICAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSB7XHJcbiAgICAgICAgcmV0dXJuIHZhbHVlXHJcbiAgICAgICAgICAubWFwKCh4OiBhbnkpID0+ICh0eXBlb2YgeCA9PT0gJ3N0cmluZycgPyB4IDogeD8uZmlsZV9pZCA/PyB4Py5pZCA/PyAnJykpXHJcbiAgICAgICAgICAubWFwKCh4OiBhbnkpID0+IFN0cmluZyh4KS50cmltKCkpXHJcbiAgICAgICAgICAuZmlsdGVyKEJvb2xlYW4pO1xyXG4gICAgICB9XHJcbiAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnICYmIHZhbHVlLnRyaW0oKSkge1xyXG4gICAgICAgIGNvbnN0IHRyaW1tZWQgPSB2YWx1ZS50cmltKCk7XHJcbiAgICAgICAgaWYgKHRyaW1tZWQuc3RhcnRzV2l0aCgneycpIHx8IHRyaW1tZWQuc3RhcnRzV2l0aCgnWycpKSB7XHJcbiAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBjb25zdCBwYXJzZWQgPSBKU09OLnBhcnNlKHRyaW1tZWQpO1xyXG4gICAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShwYXJzZWQpKSByZXR1cm4gdG9TdHJpbmdBcnJheShwYXJzZWQpO1xyXG4gICAgICAgICAgICByZXR1cm4gdG9TdHJpbmdBcnJheShwYXJzZWQ/LmlkcyA/PyBwYXJzZWQ/LmZpbGVfaWRzID8/IHBhcnNlZD8uYXR0YWNobWVudF9pZHMgPz8gcGFyc2VkPy5hdHRhY2htZW50cyk7XHJcbiAgICAgICAgICB9IGNhdGNoIHtcclxuICAgICAgICAgICAgcmV0dXJuIFtdO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gdHJpbW1lZC5zcGxpdCgvWyxcXHNdKy8pLm1hcCgoczogc3RyaW5nKSA9PiBzLnRyaW0oKSkuZmlsdGVyKEJvb2xlYW4pO1xyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiBbXTtcclxuICAgIH07XHJcblxyXG4gICAgY29uc3Qgbm9ybWFsaXplQXR0YWNobWVudCA9IChhOiBhbnkpOiBBdHRhY2htZW50IHwgbnVsbCA9PiB7XHJcbiAgICAgIGNvbnN0IGZpbGVJZCA9IFN0cmluZyhcclxuICAgICAgICB0eXBlb2YgYSA9PT0gJ3N0cmluZycgPyBhIDpcclxuICAgICAgICBhPy5maWxlX2lkID8/IGE/LmZpbGVJZCA/PyBhPy5pZCA/PyBhPy5hdHRhY2htZW50X2lkID8/IGE/LnN0b3JhZ2VfZmlsZV9pZCA/PyAnJ1xyXG4gICAgICApLnRyaW0oKTtcclxuICAgICAgaWYgKCFmaWxlSWQgfHwgZmlsZUlkLnN0YXJ0c1dpdGgoJ3RlbXAtJykpIHJldHVybiBudWxsO1xyXG4gICAgICByZXR1cm4ge1xyXG4gICAgICAgIGZpbGVfaWQ6IGZpbGVJZCxcclxuICAgICAgICBmaWxlbmFtZTogU3RyaW5nKGE/LmZpbGVuYW1lID8/IGE/LmZpbGVfbmFtZSA/PyBhPy5uYW1lID8/IGE/Lm9yaWdpbmFsX2ZpbGVuYW1lID8/ICdGaWxlJyksXHJcbiAgICAgICAgbWltZV90eXBlOiBhPy5taW1lX3R5cGUgPz8gYT8ubWltZVR5cGUsXHJcbiAgICAgICAgc2l6ZV9ieXRlczogYT8uc2l6ZV9ieXRlcyA/PyBhPy5zaXplQnl0ZXMsXHJcbiAgICAgICAgdXJsOiBhPy51cmwgPz8gYT8uZmlsZV91cmwgPz8gYT8uZG93bmxvYWRfdXJsLFxyXG4gICAgICB9O1xyXG4gICAgfTtcclxuXHJcbiAgICBsZXQgbm9ybWFsaXplZEF0dGFjaG1lbnRzOiBBdHRhY2htZW50W10gPSBbXTtcclxuICAgIGNvbnN0IGFkZEF0dGFjaG1lbnQgPSAoYXR0YWNobWVudDogQXR0YWNobWVudCB8IG51bGwpOiB2b2lkID0+IHtcclxuICAgICAgaWYgKCFhdHRhY2htZW50KSByZXR1cm47XHJcbiAgICAgIGNvbnN0IGZpbGVJZCA9IFN0cmluZyhhdHRhY2htZW50LmZpbGVfaWQgfHwgJycpLnRyaW0oKTtcclxuICAgICAgY29uc3QgdXJsID0gU3RyaW5nKGF0dGFjaG1lbnQudXJsIHx8ICcnKS50cmltKCk7XHJcbiAgICAgIGlmIChmaWxlSWQuc3RhcnRzV2l0aCgneycpIHx8IGZpbGVJZC5zdGFydHNXaXRoKCdbJykpIHtcclxuICAgICAgICBjb25zdCBpZHMgPSB0b1N0cmluZ0FycmF5KGZpbGVJZCk7XHJcbiAgICAgICAgaWRzLmZvckVhY2goKGlkLCBpZHgpID0+IHtcclxuICAgICAgICAgIGFkZEF0dGFjaG1lbnQoe1xyXG4gICAgICAgICAgICAuLi5hdHRhY2htZW50LFxyXG4gICAgICAgICAgICBmaWxlX2lkOiBpZCxcclxuICAgICAgICAgICAgZmlsZW5hbWU6IGF0dGFjaG1lbnQuZmlsZW5hbWUgfHwgYEF0dGFjaG1lbnQgJHtpZHggKyAxfWAsXHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICB9KTtcclxuICAgICAgICByZXR1cm47XHJcbiAgICAgIH1cclxuICAgICAgaWYgKGZpbGVJZCAmJiBub3JtYWxpemVkQXR0YWNobWVudHMuc29tZSgoYSkgPT4gYS5maWxlX2lkID09PSBmaWxlSWQpKSByZXR1cm47XHJcbiAgICAgIGlmICghZmlsZUlkICYmIHVybCAmJiBub3JtYWxpemVkQXR0YWNobWVudHMuc29tZSgoYSkgPT4gYS51cmwgPT09IHVybCkpIHJldHVybjtcclxuICAgICAgbm9ybWFsaXplZEF0dGFjaG1lbnRzLnB1c2goYXR0YWNobWVudCk7XHJcbiAgICB9O1xyXG5cclxuICAgIC8vIE5vcm1hbGl6ZSBhdHRhY2htZW50IG9iamVjdHMgKEFQSSBtYXkgdXNlIGZpbGVJZCAvIGlkIGluc3RlYWQgb2YgZmlsZV9pZCkuXHJcbiAgICBpZiAoQXJyYXkuaXNBcnJheShiYXNlLmF0dGFjaG1lbnRzKSAmJiBiYXNlLmF0dGFjaG1lbnRzLmxlbmd0aCA+IDApIHtcclxuICAgICAgKGJhc2UuYXR0YWNobWVudHMgYXMgYW55W10pLmZvckVhY2goKGEpID0+IGFkZEF0dGFjaG1lbnQobm9ybWFsaXplQXR0YWNobWVudChhKSkpO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IG1lZGlhVmFsdWUgPSBTdHJpbmcoYmFzZS5tZWRpYV91cmwgfHwgJycpLnRyaW0oKTtcclxuICAgIGlmIChtZWRpYVZhbHVlLnN0YXJ0c1dpdGgoJ3snKSB8fCBtZWRpYVZhbHVlLnN0YXJ0c1dpdGgoJ1snKSkge1xyXG4gICAgICB0cnkge1xyXG4gICAgICAgIGNvbnN0IHBhcnNlZCA9IEpTT04ucGFyc2UobWVkaWFWYWx1ZSk7XHJcbiAgICAgICAgY29uc3QgcmF3QXR0YWNobWVudHMgPSBBcnJheS5pc0FycmF5KHBhcnNlZCkgPyBwYXJzZWQgOiBwYXJzZWQ/LmF0dGFjaG1lbnRzO1xyXG4gICAgICAgIGlmIChBcnJheS5pc0FycmF5KHJhd0F0dGFjaG1lbnRzKSkge1xyXG4gICAgICAgICAgcmF3QXR0YWNobWVudHMuZm9yRWFjaCgoYSkgPT4gYWRkQXR0YWNobWVudChub3JtYWxpemVBdHRhY2htZW50KGEpKSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICghQXJyYXkuaXNBcnJheShwYXJzZWQpKSB7XHJcbiAgICAgICAgICBjb25zdCBtZWRpYUlkcyA9IHRvU3RyaW5nQXJyYXkocGFyc2VkPy5pZHMgPz8gcGFyc2VkPy5maWxlX2lkcyA/PyBwYXJzZWQ/LmF0dGFjaG1lbnRfaWRzKTtcclxuICAgICAgICAgIGNvbnN0IG1lZGlhRmlsZW5hbWVzID0gdG9TdHJpbmdBcnJheShwYXJzZWQ/LmZpbGVuYW1lcyk7XHJcbiAgICAgICAgICBjb25zdCBtZWRpYU1pbWVUeXBlcyA9IHRvU3RyaW5nQXJyYXkocGFyc2VkPy5taW1lX3R5cGVzID8/IHBhcnNlZD8ubWltZVR5cGVzKTtcclxuICAgICAgICAgIG1lZGlhSWRzLmZvckVhY2goKGlkLCBpZHgpID0+IHtcclxuICAgICAgICAgICAgYWRkQXR0YWNobWVudCh7XHJcbiAgICAgICAgICAgICAgZmlsZV9pZDogaWQsXHJcbiAgICAgICAgICAgICAgZmlsZW5hbWU6IG1lZGlhRmlsZW5hbWVzW2lkeF0gfHwgbWVkaWFGaWxlbmFtZXNbMF0gfHwgYEF0dGFjaG1lbnQgJHtpZHggKyAxfWAsXHJcbiAgICAgICAgICAgICAgbWltZV90eXBlOiBtZWRpYU1pbWVUeXBlc1tpZHhdLFxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgICAgfSBjYXRjaCB7XHJcbiAgICAgICAgLy8gRmFsbCB0aHJvdWdoIHRvIGxlZ2FjeSBhdHRhY2htZW50IHJlY29uc3RydWN0aW9uIGJlbG93LlxyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLy8gUmVjb25zdHJ1Y3QgYXR0YWNobWVudHMgZnJvbSBhbHRlcm5hdGUgQVBJIGZpZWxkcy5cclxuICAgIGxldCBhdHRhY2htZW50SWRzOiBzdHJpbmdbXSA9IFtdO1xyXG4gICAgYXR0YWNobWVudElkcyA9IHRvU3RyaW5nQXJyYXkocmF3Py5hdHRhY2htZW50X2lkcyk7XHJcblxyXG4gICAgaWYgKGF0dGFjaG1lbnRJZHMubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgIGF0dGFjaG1lbnRJZHMgPSB0b1N0cmluZ0FycmF5KHJhdz8uZmlsZV9pZHMpO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHB1c2hJZCA9ICh2OiBhbnkpID0+IHtcclxuICAgICAgY29uc3QgcyA9IHYgIT0gbnVsbCAmJiB2ICE9PSAnJyA/IFN0cmluZyh2KS50cmltKCkgOiAnJztcclxuICAgICAgaWYgKHMgJiYgIWF0dGFjaG1lbnRJZHMuaW5jbHVkZXMocykpIGF0dGFjaG1lbnRJZHMucHVzaChzKTtcclxuICAgIH07XHJcblxyXG4gICAgcHVzaElkKHJhdz8uZmlsZV9pZCk7XHJcbiAgICBwdXNoSWQocmF3Py5hdHRhY2htZW50X2lkKTtcclxuICAgIHB1c2hJZChyYXc/LnN0b3JhZ2VfZmlsZV9pZCk7XHJcbiAgICBwdXNoSWQocmF3Py5ibG9iX2lkKTtcclxuXHJcbiAgICAvLyBCYWNrZW5kIHN0b3JlcyBmaXJzdCBhdHRhY2htZW50IGlkIGluIG1lc3NhZ2luZy5tZXNzYWdlLm1lZGlhX3VybCAoVVVJRCksIG5vdCBhIHB1YmxpYyBVUkwuXHJcbiAgICBjb25zdCBtZWRpYUFzSWQgPSBTdHJpbmcoYmFzZS5tZWRpYV91cmwgfHwgJycpLnRyaW0oKTtcclxuICAgIGlmIChcclxuICAgICAgbWVkaWFBc0lkICYmXHJcbiAgICAgICFtZWRpYUFzSWQuc3RhcnRzV2l0aCgneycpICYmXHJcbiAgICAgICFtZWRpYUFzSWQuc3RhcnRzV2l0aCgnWycpICYmXHJcbiAgICAgICFtZWRpYUFzSWQuc3RhcnRzV2l0aCgnaHR0cDovLycpICYmXHJcbiAgICAgICFtZWRpYUFzSWQuc3RhcnRzV2l0aCgnaHR0cHM6Ly8nKSAmJlxyXG4gICAgICAhbWVkaWFBc0lkLnN0YXJ0c1dpdGgoJ2RhdGE6JylcclxuICAgICkge1xyXG4gICAgICBwdXNoSWQobWVkaWFBc0lkKTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBjb250ZW50VHJpbSA9IFN0cmluZyhiYXNlLmNvbnRlbnQgfHwgJycpLnRyaW0oKTtcclxuICAgIGlmIChhdHRhY2htZW50SWRzLmxlbmd0aCA9PT0gMCAmJiB1dWlkUmUudGVzdChjb250ZW50VHJpbSkpIHtcclxuICAgICAgYXR0YWNobWVudElkcy5wdXNoKGNvbnRlbnRUcmltKTtcclxuICAgIH1cclxuICAgIC8vIFNvbWUgQVBJcyBzdG9yZSBzdG9yYWdlIC8gYXR0YWNobWVudCBpZCBhcyBudW1lcmljIHN0cmluZyBpbiBjb250ZW50IGZvciBGSUxFIG1lc3NhZ2VzLlxyXG4gICAgaWYgKFxyXG4gICAgICBhdHRhY2htZW50SWRzLmxlbmd0aCA9PT0gMCAmJlxyXG4gICAgICAvXlxcZCskLy50ZXN0KGNvbnRlbnRUcmltKSAmJlxyXG4gICAgICAoYmFzZS5tZXNzYWdlX3R5cGUgPT09ICdGSUxFJyB8fCBiYXNlLm1lc3NhZ2VfdHlwZSA9PT0gJ0lNQUdFJylcclxuICAgICkge1xyXG4gICAgICBhdHRhY2htZW50SWRzLnB1c2goY29udGVudFRyaW0pO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGZpbGVuYW1lczogc3RyaW5nW10gPSB0b1N0cmluZ0FycmF5KHJhdz8uZmlsZW5hbWVzKS5sZW5ndGhcclxuICAgICAgPyB0b1N0cmluZ0FycmF5KHJhdz8uZmlsZW5hbWVzKVxyXG4gICAgICA6IHJhdz8uZmlsZW5hbWVcclxuICAgICAgPyBbU3RyaW5nKHJhdy5maWxlbmFtZSldXHJcbiAgICAgIDogcmF3Py5maWxlX25hbWVcclxuICAgICAgPyBbU3RyaW5nKHJhdy5maWxlX25hbWUpXVxyXG4gICAgICA6IFtdO1xyXG5cclxuICAgIGNvbnN0IG1pbWVUeXBlczogc3RyaW5nW10gPSB0b1N0cmluZ0FycmF5KHJhdz8ubWltZV90eXBlcykubGVuZ3RoXHJcbiAgICAgID8gdG9TdHJpbmdBcnJheShyYXc/Lm1pbWVfdHlwZXMpXHJcbiAgICAgIDogdG9TdHJpbmdBcnJheShyYXc/Lm1pbWVUeXBlcyk7XHJcblxyXG4gICAgaWYgKGF0dGFjaG1lbnRJZHMubGVuZ3RoID4gMCB8fCBmaWxlbmFtZXMubGVuZ3RoID4gMCkge1xyXG4gICAgICBjb25zdCBmYWxsYmFja01pbWUgPSByYXc/Lm1pbWVfdHlwZSA/PyByYXc/LmF0dGFjaG1lbnRfbWltZV90eXBlID8/IChiYXNlLm1lc3NhZ2VfdHlwZSA9PT0gJ0lNQUdFJyA/ICdpbWFnZS8qJyA6IHVuZGVmaW5lZCk7XHJcbiAgICAgIGNvbnN0IHVybEZhbGxiYWNrID0gcmF3Py5maWxlX3VybCA/PyByYXc/LnVybCA/PyByYXc/Lm1lZGlhX3VybCA/PyByYXc/Lm1lZGlhVXJsO1xyXG4gICAgICBjb25zdCBpZHMgPSBhdHRhY2htZW50SWRzLmxlbmd0aCA+IDAgPyBhdHRhY2htZW50SWRzIDogW107XHJcbiAgICAgIGNvbnN0IGJ1aWx0OiBBdHRhY2htZW50W10gPSBpZHMubWFwKChpZCwgaWR4KSA9PiAoe1xyXG4gICAgICAgIGZpbGVfaWQ6IGlkLFxyXG4gICAgICAgIGZpbGVuYW1lOiBmaWxlbmFtZXNbaWR4XSB8fCBmaWxlbmFtZXNbMF0gfHwgKGJhc2UubWVzc2FnZV90eXBlID09PSAnSU1BR0UnID8gYEltYWdlICR7aWR4ICsgMX1gIDogYEF0dGFjaG1lbnQgJHtpZHggKyAxfWApLFxyXG4gICAgICAgIG1pbWVfdHlwZTogbWltZVR5cGVzW2lkeF0gfHwgZmFsbGJhY2tNaW1lLFxyXG4gICAgICAgIHVybDogdXJsRmFsbGJhY2ssXHJcbiAgICAgIH0pKTtcclxuXHJcbiAgICAgIC8vIEZpbGVuYW1lIG9ubHkgKyBkaXJlY3QgVVJMIChubyBzdG9yYWdlIGlkKTogc3RpbGwgcmVuZGVyYWJsZSBhcyA8aW1nIHNyYz4uXHJcbiAgICAgIGlmIChcclxuICAgICAgICBidWlsdC5sZW5ndGggPT09IDAgJiZcclxuICAgICAgICBmaWxlbmFtZXMubGVuZ3RoID4gMCAmJlxyXG4gICAgICAgIHVybEZhbGxiYWNrICYmXHJcbiAgICAgICAgU3RyaW5nKHVybEZhbGxiYWNrKS5tYXRjaCgvXmh0dHBzPzpcXC9cXC8vaSlcclxuICAgICAgKSB7XHJcbiAgICAgICAgYnVpbHQucHVzaCh7XHJcbiAgICAgICAgICBmaWxlX2lkOiAnJyxcclxuICAgICAgICAgIGZpbGVuYW1lOiBmaWxlbmFtZXNbMF0sXHJcbiAgICAgICAgICBtaW1lX3R5cGU6IGZhbGxiYWNrTWltZSxcclxuICAgICAgICAgIHVybDogU3RyaW5nKHVybEZhbGxiYWNrKSxcclxuICAgICAgICB9KTtcclxuICAgICAgfVxyXG5cclxuICAgICAgYnVpbHQuZm9yRWFjaCgoYXR0YWNobWVudCkgPT4gYWRkQXR0YWNobWVudChhdHRhY2htZW50KSk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKG5vcm1hbGl6ZWRBdHRhY2htZW50cy5sZW5ndGggPiAwKSB7XHJcbiAgICAgIHJldHVybiB7IC4uLmJhc2UsIGF0dGFjaG1lbnRzOiBub3JtYWxpemVkQXR0YWNobWVudHMgfTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gYmFzZTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgcGxheVNvZnROb3RpZmljYXRpb25Tb3VuZChmb3JjZSA9IGZhbHNlKTogdm9pZCB7XHJcbiAgICBpZiAoIWZvcmNlICYmIHRoaXMubm90aWZpY2F0aW9uc011dGVkJC52YWx1ZSkgcmV0dXJuO1xyXG4gICAgY29uc3Qgdm9sdW1lID0gTWF0aC5tYXgoMCwgTWF0aC5taW4oMSwgdGhpcy5ub3RpZmljYXRpb25Wb2x1bWUkLnZhbHVlKSk7XHJcbiAgICBpZiAodm9sdW1lIDw9IDAgJiYgIWZvcmNlKSByZXR1cm47XHJcblxyXG4gICAgdHJ5IHtcclxuICAgICAgY29uc3QgQXVkaW9DdHggPSAod2luZG93IGFzIGFueSkuQXVkaW9Db250ZXh0IHx8ICh3aW5kb3cgYXMgYW55KS53ZWJraXRBdWRpb0NvbnRleHQ7XHJcbiAgICAgIGlmICghQXVkaW9DdHgpIHJldHVybjtcclxuICAgICAgY29uc3QgY3R4ID0gbmV3IEF1ZGlvQ3R4KCk7XHJcbiAgICAgIGNvbnN0IG1hc3RlciA9IGN0eC5jcmVhdGVHYWluKCk7XHJcbiAgICAgIGNvbnN0IG91dHB1dEdhaW4gPSBNYXRoLm1heCh2b2x1bWUsIDAuMDAxKTtcclxuICAgICAgbWFzdGVyLmdhaW4uc2V0VmFsdWVBdFRpbWUoMC4wMDAxLCBjdHguY3VycmVudFRpbWUpO1xyXG4gICAgICBtYXN0ZXIuZ2Fpbi5leHBvbmVudGlhbFJhbXBUb1ZhbHVlQXRUaW1lKG91dHB1dEdhaW4sIGN0eC5jdXJyZW50VGltZSArIDAuMDE1KTtcclxuICAgICAgbWFzdGVyLmdhaW4uZXhwb25lbnRpYWxSYW1wVG9WYWx1ZUF0VGltZSgwLjAwMDEsIGN0eC5jdXJyZW50VGltZSArIDAuNDIpO1xyXG4gICAgICBtYXN0ZXIuY29ubmVjdChjdHguZGVzdGluYXRpb24pO1xyXG5cclxuICAgICAgY29uc3QgcGxheVRvbmUgPSAoZnJlcXVlbmN5OiBudW1iZXIsIHN0YXJ0OiBudW1iZXIsIGR1cmF0aW9uOiBudW1iZXIpID0+IHtcclxuICAgICAgICBjb25zdCBvc2MgPSBjdHguY3JlYXRlT3NjaWxsYXRvcigpO1xyXG4gICAgICAgIGNvbnN0IGdhaW4gPSBjdHguY3JlYXRlR2FpbigpO1xyXG4gICAgICAgIG9zYy50eXBlID0gJ3NpbmUnO1xyXG4gICAgICAgIG9zYy5mcmVxdWVuY3kuc2V0VmFsdWVBdFRpbWUoZnJlcXVlbmN5LCBjdHguY3VycmVudFRpbWUgKyBzdGFydCk7XHJcbiAgICAgICAgZ2Fpbi5nYWluLnNldFZhbHVlQXRUaW1lKDAuMDAwMSwgY3R4LmN1cnJlbnRUaW1lICsgc3RhcnQpO1xyXG4gICAgICAgIGdhaW4uZ2Fpbi5leHBvbmVudGlhbFJhbXBUb1ZhbHVlQXRUaW1lKDAuNTUsIGN0eC5jdXJyZW50VGltZSArIHN0YXJ0ICsgMC4wMjUpO1xyXG4gICAgICAgIGdhaW4uZ2Fpbi5leHBvbmVudGlhbFJhbXBUb1ZhbHVlQXRUaW1lKDAuMDAwMSwgY3R4LmN1cnJlbnRUaW1lICsgc3RhcnQgKyBkdXJhdGlvbik7XHJcbiAgICAgICAgb3NjLmNvbm5lY3QoZ2Fpbik7XHJcbiAgICAgICAgZ2Fpbi5jb25uZWN0KG1hc3Rlcik7XHJcbiAgICAgICAgb3NjLnN0YXJ0KGN0eC5jdXJyZW50VGltZSArIHN0YXJ0KTtcclxuICAgICAgICBvc2Muc3RvcChjdHguY3VycmVudFRpbWUgKyBzdGFydCArIGR1cmF0aW9uICsgMC4wMik7XHJcbiAgICAgIH07XHJcblxyXG4gICAgICBwbGF5VG9uZSg3NDAsIDAsIDAuMTgpO1xyXG4gICAgICBwbGF5VG9uZSg5ODgsIDAuMTIsIDAuMjIpO1xyXG4gICAgICB3aW5kb3cuc2V0VGltZW91dCgoKSA9PiBjdHguY2xvc2UoKS5jYXRjaCgoKSA9PiB7fSksIDYwMCk7XHJcbiAgICB9IGNhdGNoIHtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHByaXZhdGUgcGxheU5vdGlmaWNhdGlvblNvdW5kKCk6IHZvaWQge1xyXG4gICAgdHJ5IHtcclxuICAgICAgY29uc3QgYXVkaW8gPSBuZXcgQXVkaW8oJ2RhdGE6YXVkaW8vd2F2O2Jhc2U2NCxVa2xHUm5vR0FBQlhRVlpGWm0xMElCQUFBQUFCQUFFQVFCOEFBRUFmQUFBQkFBZ0FaR0YwWVFvR0FBQ0JoWXFGYkYxZmRKaXZySkJoTmpWZ29kRGJxMkVjQmorYTIvTERjaVVGTElITzh0aUpOd2daYUx2dDU1OU5FQXhRcCtQd3RtTWNCamlSMS9MTWVTd0ZKSGZIOE4yUVFBb1VYclRwNjZoVkZBcEduK0R5dm13aEJTdUJ6dkxaaVRZSUdHUzU3T2loVUJFTFRLWGg4YmxsSEFVMmpkWHp6bjB2QlNoK3pQTGFpenNLRkdDejZPeXJXQlFMU0tEZjhzRnVJd1V1ZzgveTI0azNDQmhrdSt6b29WQVJDMHlsNGZHNVpSd0ZObzNWODg1OUx3VW9mc3p5Mm9zN0NoUmdzK2pzcTFnVkMwaWczL0xCYmlNRkxvTFA4dHVKTndnWVpMdnM2S0ZRRVF0TXBlSHh1V1VjQlRhTjFmUE9mUzhGS0g3TTh0cUxPd29VWUxQbzdLdFlGUXRJb04veXdXNGpCUzZDei9MYmlUY0lHR1M3N09paFVCRUxUS1hoOGJsbEhBVTJqZFh6em4wdkJTaCt6UExhaXpzS0ZHQ3o2T3lyV0JVTFNLRGY4c0Z1SXdVdWdzL3kyNGszQ0Joa3Urem9vVkFSQzB5bDRmRzVaUndGTm8zVjg4NTlMd1VvZnN6eTJvczdDaFJncytqc3ExZ1ZDMGlnMy9MQmJpTUZMb0xQOHR1Sk53Z1laTHZzNktGUUVRdE1wZUh4dVdVY0JUYU4xZlBPZlM4RktIN004dHFMT3dvVVlMUG83S3RZRlF0SW9OL3l3VzRqQlM2Q3ovTGJpVGNJR0dTNzdPaWhVQkVMVEtYaDhibGxIQVUyamRYenpuMHZCU2grelBMYWl6c0tGR0N6Nk95cldCVUxTS0RmOHNGdUl3VXVncy95MjRrM0NCaGt1K3pvb1ZBUkMweWw0Zkc1WlJ3Rk5vM1Y4ODU5THdVb2Zzenkyb3M3Q2hSZ3MranNxMWdWQzBpZzMvTEJiaU1GTG9MUDh0dUpOd2dZWkx2czZLRlFFUXRNcGVIeHVXVWNCVGFOMWZQT2ZTOEZLSDdNOHRxTE93b1VZTFBvN0t0WUZRdElvTi95d1c0akJTNkN6L0xiaVRjSUdHUzc3T2loVUJFTFRLWGg4YmxsSEFVMmpkWHp6bjB2QlNoK3pQTGFpenNLRkdDejZPeXJXQlVMU0tEZjhzRnVJd1V1Z3MveTI0azNDQmhrdSt6b29WQVJDMHlsNGZHNVpSd0ZObzNWODg1OUx3VW9mc3p5Mm9zN0NoUmdzK2pzcTFnVkMwaWczL0xCYmlNRkxvTFA4dHVKTndnWVpMdnM2S0ZRRVF0TXBlSHh1V1VjQlRhTjFmUE9mUzhGS0g3TTh0cUxPd29VWUxQbzdLdFlGUXRJb04veXdXNGpCUzZDei9MYmlUY0lHR1M3N09paFVCRUxUS1hoOGJsbEhBVTJqZFh6em4wdkJTaCt6UExhaXpzS0ZHQ3o2T3lyV0JVTFNLRGY4c0Z1SXdVdWdzL3kyNGszQ0Joa3Urem9vVkFSQzB5bDRmRzVaUndGTm8zVjg4NTlMd1VvZnN6eTJvczdDaFJncytqc3ExZ1ZDMGlnMy9MQmJpTUZMb0xQOHR1Sk53Z1laTHZzNktGUUVRdE1wZUh4dVdVY0JUYU4xZlBPZlM4RktIN004dHFMT3dvVVlMUG83S3RZRlF0SW9OL3l3VzRqQlM2Q3ovTGJpVGNJR0dTNzdPaWhVQkVMVEtYaDhibGxIQVUyamRYenpuMHZCU2grelBMYWl6c0tGR0N6Nk95cldCVUxTS0RmOHNGdUl3VXVncy95MjRrM0NCaGt1K3pvb1ZBUkMweWw0Zkc1WlJ3Rk5vM1Y4ODU5THdVb2ZzenknKTtcclxuICAgICAgYXVkaW8udm9sdW1lID0gMC4zO1xyXG4gICAgICBhdWRpby5wbGF5KCkuY2F0Y2goKCkgPT4ge30pO1xyXG4gICAgfSBjYXRjaCB7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHJlY2FsY1VucmVhZChpdGVtczogSW5ib3hJdGVtW10pOiB2b2lkIHtcclxuICAgIGNvbnN0IHRvdGFsID0gaXRlbXMucmVkdWNlKChzdW0sIGkpID0+IHN1bSArIE51bWJlcihpLnVucmVhZF9jb3VudCB8fCAwKSwgMCk7XHJcbiAgICB0aGlzLnRvdGFsVW5yZWFkJC5uZXh0KHRvdGFsKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgZ2V0Q29udGFjdE5hbWVCeUlkKGNvbnRhY3RJZDogc3RyaW5nKTogc3RyaW5nIHtcclxuICAgIGNvbnN0IGlkID0gU3RyaW5nKGNvbnRhY3RJZCk7XHJcbiAgICBpZiAoaWQgPT09IFN0cmluZyh0aGlzLmF1dGguY29udGFjdElkIHx8ICcnKSAmJiB0aGlzLmF1dGguY3VycmVudENvbnRhY3QpIHtcclxuICAgICAgcmV0dXJuIGdldENvbnRhY3REaXNwbGF5TmFtZSh0aGlzLmF1dGguY3VycmVudENvbnRhY3QpO1xyXG4gICAgfVxyXG4gICAgY29uc3QgY29udGFjdCA9IHRoaXMudmlzaWJsZUNvbnRhY3RzJC52YWx1ZS5maW5kKChjKSA9PiBTdHJpbmcoYy5jb250YWN0X2lkKSA9PT0gaWQpO1xyXG4gICAgcmV0dXJuIGNvbnRhY3QgPyBnZXRDb250YWN0RGlzcGxheU5hbWUoY29udGFjdCkgOiBgVXNlciAke2lkfWA7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGRldGVjdEdyb3VwUmVtb3ZhbEZvckN1cnJlbnRVc2VyKG1lc3NhZ2U6IE1lc3NhZ2UpOiB2b2lkIHtcclxuICAgIGNvbnN0IGNvbnRlbnQgPSBTdHJpbmcobWVzc2FnZS5jb250ZW50IHx8ICcnKS50cmltKCk7XHJcbiAgICBjb25zdCBtYXRjaCA9IGNvbnRlbnQubWF0Y2goL14oLispIHJlbW92ZWQgKC4rKSBmcm9tIHRoZSBncm91cCQvKTtcclxuICAgIGlmICghbWF0Y2gpIHJldHVybjtcclxuXHJcbiAgICBjb25zdCBteUNvbnRhY3QgPSB0aGlzLmF1dGguY3VycmVudENvbnRhY3Q7XHJcbiAgICBjb25zdCBteU5hbWUgPSBteUNvbnRhY3QgPyBnZXRDb250YWN0RGlzcGxheU5hbWUobXlDb250YWN0KS50cmltKCkudG9Mb3dlckNhc2UoKSA6ICcnO1xyXG4gICAgY29uc3QgcmVtb3ZlZE5hbWUgPSBtYXRjaFsyXT8udHJpbSgpLnRvTG93ZXJDYXNlKCk7XHJcbiAgICBpZiAoIW15TmFtZSB8fCByZW1vdmVkTmFtZSAhPT0gbXlOYW1lKSByZXR1cm47XHJcblxyXG4gICAgY29uc3QgY29udklkID0gU3RyaW5nKG1lc3NhZ2UuY29udmVyc2F0aW9uX2lkIHx8ICcnKTtcclxuICAgIGlmIChjb252SWQpIHtcclxuICAgICAgdGhpcy5tYXJrR3JvdXBSZW1vdmVkKGNvbnZJZCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGh5ZHJhdGVSZWFjdGlvbnNGb3JDb252ZXJzYXRpb24oY29udmVyc2F0aW9uSWQ6IHN0cmluZywgbWVzc2FnZXM6IE1lc3NhZ2VbXSwgb25seU1pc3NpbmcgPSBmYWxzZSk6IHZvaWQge1xyXG4gICAgY29uc3QgZmV0Y2hhYmxlID0gbWVzc2FnZXMuZmlsdGVyKChtKSA9PiB7XHJcbiAgICAgIGlmICghbS5tZXNzYWdlX2lkIHx8IFN0cmluZyhtLm1lc3NhZ2VfaWQpLnN0YXJ0c1dpdGgoJ3RlbXAtJykpIHJldHVybiBmYWxzZTtcclxuICAgICAgaWYgKCFvbmx5TWlzc2luZykgcmV0dXJuIHRydWU7XHJcbiAgICAgIHJldHVybiAhQXJyYXkuaXNBcnJheShtLnJlYWN0aW9ucykgfHwgbS5yZWFjdGlvbnMubGVuZ3RoID09PSAwO1xyXG4gICAgfSk7XHJcbiAgICBpZiAoIWZldGNoYWJsZS5sZW5ndGgpIHJldHVybjtcclxuXHJcbiAgICBjb25zdCBqb2JzID0gZmV0Y2hhYmxlLm1hcCgobSkgPT5cclxuICAgICAgdGhpcy5hcGkuZ2V0UmVhY3Rpb25zKG0ubWVzc2FnZV9pZCkucGlwZShcclxuICAgICAgICBtYXAoKHJvd3MpID0+ICh7IG1lc3NhZ2VJZDogbS5tZXNzYWdlX2lkLCByZWFjdGlvbnM6IHRoaXMubm9ybWFsaXplUmVhY3Rpb25Sb3dzKHJvd3MpIH0pKSxcclxuICAgICAgICBjYXRjaEVycm9yKCgpID0+IG9mKHsgbWVzc2FnZUlkOiBtLm1lc3NhZ2VfaWQsIHJlYWN0aW9uczogW10gfSkpXHJcbiAgICAgIClcclxuICAgICk7XHJcblxyXG4gICAgZm9ya0pvaW4oam9icykuc3Vic2NyaWJlKChyZXN1bHRzKSA9PiB7XHJcbiAgICAgIGNvbnN0IG1hcCA9IG5ldyBNYXAodGhpcy5tZXNzYWdlc01hcCQudmFsdWUpO1xyXG4gICAgICBjb25zdCBjdXJyZW50ID0gWy4uLihtYXAuZ2V0KGNvbnZlcnNhdGlvbklkKSB8fCBbXSldO1xyXG4gICAgICBpZiAoIWN1cnJlbnQubGVuZ3RoKSByZXR1cm47XHJcblxyXG4gICAgICBsZXQgY2hhbmdlZCA9IGZhbHNlO1xyXG4gICAgICBmb3IgKGNvbnN0IHJlc3VsdCBvZiByZXN1bHRzKSB7XHJcbiAgICAgICAgY29uc3QgaWR4ID0gY3VycmVudC5maW5kSW5kZXgoKG0pID0+IFN0cmluZyhtLm1lc3NhZ2VfaWQpID09PSBTdHJpbmcocmVzdWx0Lm1lc3NhZ2VJZCkpO1xyXG4gICAgICAgIGlmIChpZHggPT09IC0xKSBjb250aW51ZTtcclxuICAgICAgICBjdXJyZW50W2lkeF0gPSB7IC4uLmN1cnJlbnRbaWR4XSwgcmVhY3Rpb25zOiByZXN1bHQucmVhY3Rpb25zIH07XHJcbiAgICAgICAgY2hhbmdlZCA9IHRydWU7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGlmIChjaGFuZ2VkKSB7XHJcbiAgICAgICAgbWFwLnNldChjb252ZXJzYXRpb25JZCwgY3VycmVudCk7XHJcbiAgICAgICAgdGhpcy5tZXNzYWdlc01hcCQubmV4dChtYXApO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgcmVmcmVzaE1lc3NhZ2VSZWFjdGlvbnMobWVzc2FnZUlkOiBzdHJpbmcpOiB2b2lkIHtcclxuICAgIGlmICghbWVzc2FnZUlkIHx8IFN0cmluZyhtZXNzYWdlSWQpLnN0YXJ0c1dpdGgoJ3RlbXAtJykpIHJldHVybjtcclxuXHJcbiAgICB0aGlzLmFwaS5nZXRSZWFjdGlvbnMobWVzc2FnZUlkKS5zdWJzY3JpYmUoe1xyXG4gICAgICBuZXh0OiAocm93cykgPT4ge1xyXG4gICAgICAgIGNvbnN0IG5vcm1hbGl6ZWQgPSB0aGlzLm5vcm1hbGl6ZVJlYWN0aW9uUm93cyhyb3dzKTtcclxuICAgICAgICBjb25zdCBtYXAgPSBuZXcgTWFwKHRoaXMubWVzc2FnZXNNYXAkLnZhbHVlKTtcclxuICAgICAgICBsZXQgY2hhbmdlZCA9IGZhbHNlO1xyXG5cclxuICAgICAgICBmb3IgKGNvbnN0IFtjb252ZXJzYXRpb25JZCwgbXNnc10gb2YgbWFwLmVudHJpZXMoKSkge1xyXG4gICAgICAgICAgY29uc3QgaWR4ID0gbXNncy5maW5kSW5kZXgoKG0pID0+IFN0cmluZyhtLm1lc3NhZ2VfaWQpID09PSBTdHJpbmcobWVzc2FnZUlkKSk7XHJcbiAgICAgICAgICBpZiAoaWR4ID09PSAtMSkgY29udGludWU7XHJcbiAgICAgICAgICBjb25zdCBuZXh0TXNncyA9IFsuLi5tc2dzXTtcclxuICAgICAgICAgIG5leHRNc2dzW2lkeF0gPSB7IC4uLm5leHRNc2dzW2lkeF0sIHJlYWN0aW9uczogbm9ybWFsaXplZCB9O1xyXG4gICAgICAgICAgbWFwLnNldChjb252ZXJzYXRpb25JZCwgbmV4dE1zZ3MpO1xyXG4gICAgICAgICAgY2hhbmdlZCA9IHRydWU7XHJcbiAgICAgICAgICBicmVhaztcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmIChjaGFuZ2VkKSB7XHJcbiAgICAgICAgICB0aGlzLm1lc3NhZ2VzTWFwJC5uZXh0KG1hcCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9LFxyXG4gICAgICBlcnJvcjogKCkgPT4ge30sXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgbm9ybWFsaXplUmVhY3Rpb25Sb3dzKHJvd3M6IGFueVtdKTogYW55W10ge1xyXG4gICAgY29uc3QgYnlFbW9qaSA9IG5ldyBNYXA8c3RyaW5nLCB7IGVtb2ppOiBzdHJpbmc7IGNvdW50OiBudW1iZXI7IGhhc1JlYWN0ZWQ6IGJvb2xlYW47IHJlYWN0b3JzOiBzdHJpbmdbXSB9PigpO1xyXG4gICAgY29uc3QgbXlDb250YWN0SWQgPSBTdHJpbmcodGhpcy5hdXRoLmNvbnRhY3RJZCB8fCAnJyk7XHJcbiAgICBjb25zdCBjb250YWN0cyA9IHRoaXMudmlzaWJsZUNvbnRhY3RzJC52YWx1ZTtcclxuICAgIGNvbnN0IHBhcnNlUmVhY3RvcnMgPSAodmFsdWU6IGFueSk6IGFueVtdID0+IHtcclxuICAgICAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSByZXR1cm4gdmFsdWU7XHJcbiAgICAgIGlmICh2YWx1ZSAmJiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnKSByZXR1cm4gW3ZhbHVlXTtcclxuICAgICAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gJ3N0cmluZycgfHwgIXZhbHVlLnRyaW0oKSkgcmV0dXJuIFtdO1xyXG5cclxuICAgICAgY29uc3QgdHJpbW1lZCA9IHZhbHVlLnRyaW0oKTtcclxuICAgICAgaWYgKHRyaW1tZWQuc3RhcnRzV2l0aCgneycpIHx8IHRyaW1tZWQuc3RhcnRzV2l0aCgnWycpKSB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgIGNvbnN0IHBhcnNlZCA9IEpTT04ucGFyc2UodHJpbW1lZCk7XHJcbiAgICAgICAgICByZXR1cm4gQXJyYXkuaXNBcnJheShwYXJzZWQpID8gcGFyc2VkIDogW3BhcnNlZF07XHJcbiAgICAgICAgfSBjYXRjaCB7XHJcbiAgICAgICAgICByZXR1cm4gW3RyaW1tZWRdO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG5cclxuICAgICAgcmV0dXJuIHRyaW1tZWQuc3BsaXQoJywnKS5tYXAoKHg6IHN0cmluZykgPT4geC50cmltKCkpLmZpbHRlcihCb29sZWFuKTtcclxuICAgIH07XHJcblxyXG4gICAgY29uc3QgZGlzcGxheU5hbWVGb3JSZWFjdG9yID0gKHJlYWN0b3I6IGFueSk6IHN0cmluZyA9PiB7XHJcbiAgICAgIGlmIChyZWFjdG9yID09IG51bGwpIHJldHVybiAnJztcclxuICAgICAgaWYgKHR5cGVvZiByZWFjdG9yID09PSAnc3RyaW5nJykge1xyXG4gICAgICAgIGNvbnN0IHRyaW1tZWQgPSByZWFjdG9yLnRyaW0oKTtcclxuICAgICAgICBpZiAoIXRyaW1tZWQpIHJldHVybiAnJztcclxuICAgICAgICBpZiAodHJpbW1lZC5zdGFydHNXaXRoKCd7JykgfHwgdHJpbW1lZC5zdGFydHNXaXRoKCdbJykpIHtcclxuICAgICAgICAgIGNvbnN0IHBhcnNlZCA9IHBhcnNlUmVhY3RvcnModHJpbW1lZCk7XHJcbiAgICAgICAgICByZXR1cm4gcGFyc2VkLm1hcChkaXNwbGF5TmFtZUZvclJlYWN0b3IpLmZpbHRlcihCb29sZWFuKS5qb2luKCcsICcpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gdHJpbW1lZDtcclxuICAgICAgfVxyXG5cclxuICAgICAgY29uc3QgcmVhY3RvcklkID0gU3RyaW5nKHJlYWN0b3I/LmNvbnRhY3RfaWQgPz8gcmVhY3Rvcj8uY29udGFjdElkID8/IHJlYWN0b3I/LmlkID8/ICcnKS50cmltKCk7XHJcbiAgICAgIGlmIChyZWFjdG9ySWQgJiYgcmVhY3RvcklkID09PSBteUNvbnRhY3RJZCkgcmV0dXJuICdZb3UnO1xyXG5cclxuICAgICAgY29uc3QgZXhwbGljaXROYW1lID0gU3RyaW5nKFxyXG4gICAgICAgIHJlYWN0b3I/LnVzZXJuYW1lID8/XHJcbiAgICAgICAgcmVhY3Rvcj8ubmFtZSA/P1xyXG4gICAgICAgIHJlYWN0b3I/LmRpc3BsYXlfbmFtZSA/P1xyXG4gICAgICAgIHJlYWN0b3I/LmRpc3BsYXlOYW1lID8/XHJcbiAgICAgICAgcmVhY3Rvcj8uZW1haWwgPz9cclxuICAgICAgICAnJ1xyXG4gICAgICApLnRyaW0oKTtcclxuICAgICAgaWYgKGV4cGxpY2l0TmFtZSkgcmV0dXJuIGV4cGxpY2l0TmFtZTtcclxuXHJcbiAgICAgIGlmIChyZWFjdG9ySWQpIHtcclxuICAgICAgICBjb25zdCBjb250YWN0ID0gY29udGFjdHMuZmluZChjID0+IFN0cmluZyhjLmNvbnRhY3RfaWQpID09PSByZWFjdG9ySWQpO1xyXG4gICAgICAgIHJldHVybiBjb250YWN0ID8gZ2V0Q29udGFjdERpc3BsYXlOYW1lKGNvbnRhY3QpIDogYFVzZXIgJHtyZWFjdG9ySWR9YDtcclxuICAgICAgfVxyXG5cclxuICAgICAgcmV0dXJuICcnO1xyXG4gICAgfTtcclxuXHJcbiAgICBmb3IgKGNvbnN0IHJvdyBvZiByb3dzIHx8IFtdKSB7XHJcbiAgICAgIGNvbnN0IGVtb2ppID0gU3RyaW5nKHJvdz8uZW1vamkgfHwgJycpLnRyaW0oKTtcclxuICAgICAgaWYgKCFlbW9qaSkgY29udGludWU7XHJcblxyXG4gICAgICBjb25zdCBjb250YWN0SWQgPSBTdHJpbmcocm93Py5jb250YWN0X2lkID8/IHJvdz8uY29udGFjdElkID8/ICcnKTtcclxuICAgICAgY29uc3QgZXhwbGljaXRIYXNSZWFjdGVkID0gcm93Py5oYXNSZWFjdGVkID8/IHJvdz8uaGFzX3JlYWN0ZWQ7XHJcbiAgICAgIGNvbnN0IGhhc1JlYWN0ZWQgPSBleHBsaWNpdEhhc1JlYWN0ZWQgPT09IHRydWUgfHwgKGNvbnRhY3RJZCAmJiBjb250YWN0SWQgPT09IG15Q29udGFjdElkKTtcclxuXHJcbiAgICAgIGNvbnN0IHJhd1JlYWN0b3JzID1cclxuICAgICAgICByb3c/LnJlYWN0b3JzID8/XHJcbiAgICAgICAgcm93Py5yZWFjdG9yX25hbWVzID8/XHJcbiAgICAgICAgcm93Py5yZWFjdG9yTmFtZXMgPz9cclxuICAgICAgICByb3c/LnJlYWN0ZWRfYnkgPz9cclxuICAgICAgICByb3c/LnJlYWN0ZWRCeSA/P1xyXG4gICAgICAgIHJvdz8udXNlcnMgPz9cclxuICAgICAgICBbXTtcclxuICAgICAgY29uc3QgcmVhY3RvclJvd3MgPSBwYXJzZVJlYWN0b3JzKHJhd1JlYWN0b3JzKTtcclxuICAgICAgY29uc3QgY291bnRGcm9tUm93ID0gTnVtYmVyKHJvdz8uY291bnQgPz8gcm93Py5yZWFjdGlvbl9jb3VudCA/PyByb3c/LnJlYWN0aW9uQ291bnQgPz8gcmVhY3RvclJvd3MubGVuZ3RoID8/IDApO1xyXG4gICAgICBjb25zdCBleGlzdGluZyA9IGJ5RW1vamkuZ2V0KGVtb2ppKSB8fCB7IGVtb2ppLCBjb3VudDogMCwgaGFzUmVhY3RlZDogZmFsc2UsIHJlYWN0b3JzOiBbXSB9O1xyXG5cclxuICAgICAgLy8gU29tZSBBUElzIHJldHVybiBvbmUgcm93IHBlciByZWFjdGlvbjsgc29tZSByZXR1cm4gcHJlLWFnZ3JlZ2F0ZWQgY291bnQuXHJcbiAgICAgIGV4aXN0aW5nLmNvdW50ICs9IGNvdW50RnJvbVJvdyA+IDAgPyBjb3VudEZyb21Sb3cgOiAxO1xyXG4gICAgICBleGlzdGluZy5oYXNSZWFjdGVkID0gZXhpc3RpbmcuaGFzUmVhY3RlZCB8fCAhIWhhc1JlYWN0ZWQ7XHJcblxyXG4gICAgICAvLyBUcmFjayByZWFjdG9yIGRpc3BsYXkgbmFtZXMgd2hlbiBpbmRpdmlkdWFsIGNvbnRhY3RJZCBpcyBhdmFpbGFibGVcclxuICAgICAgaWYgKGNvbnRhY3RJZCAmJiBjb3VudEZyb21Sb3cgPD0gMSkge1xyXG4gICAgICAgIGxldCBuYW1lOiBzdHJpbmc7XHJcbiAgICAgICAgaWYgKGNvbnRhY3RJZCA9PT0gbXlDb250YWN0SWQpIHtcclxuICAgICAgICAgIG5hbWUgPSAnWW91JztcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgY29uc3QgY29udGFjdCA9IGNvbnRhY3RzLmZpbmQoYyA9PiBTdHJpbmcoYy5jb250YWN0X2lkKSA9PT0gY29udGFjdElkKTtcclxuICAgICAgICAgIG5hbWUgPSBjb250YWN0ID8gZ2V0Q29udGFjdERpc3BsYXlOYW1lKGNvbnRhY3QpIDogYFVzZXIgJHtjb250YWN0SWR9YDtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKCFleGlzdGluZy5yZWFjdG9ycy5pbmNsdWRlcyhuYW1lKSkge1xyXG4gICAgICAgICAgZXhpc3RpbmcucmVhY3RvcnMucHVzaChuYW1lKTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGZvciAoY29uc3QgcmVhY3RvciBvZiByZWFjdG9yUm93cykge1xyXG4gICAgICAgIGNvbnN0IHJlYWN0b3JJZCA9IFN0cmluZyhcclxuICAgICAgICAgIHR5cGVvZiByZWFjdG9yID09PSAnb2JqZWN0J1xyXG4gICAgICAgICAgICA/IHJlYWN0b3I/LmNvbnRhY3RfaWQgPz8gcmVhY3Rvcj8uY29udGFjdElkID8/IHJlYWN0b3I/LmlkID8/ICcnXHJcbiAgICAgICAgICAgIDogJydcclxuICAgICAgICApLnRyaW0oKTtcclxuICAgICAgICBjb25zdCBuYW1lID0gZGlzcGxheU5hbWVGb3JSZWFjdG9yKHJlYWN0b3IpO1xyXG4gICAgICAgIGlmIChyZWFjdG9ySWQgJiYgcmVhY3RvcklkID09PSBteUNvbnRhY3RJZCkge1xyXG4gICAgICAgICAgZXhpc3RpbmcuaGFzUmVhY3RlZCA9IHRydWU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChuYW1lICYmICFleGlzdGluZy5yZWFjdG9ycy5pbmNsdWRlcyhuYW1lKSkge1xyXG4gICAgICAgICAgZXhpc3RpbmcucmVhY3RvcnMucHVzaChuYW1lKTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGNvbnN0IGRpcmVjdE5hbWUgPSBTdHJpbmcoXHJcbiAgICAgICAgcm93Py5yZWFjdG9yX25hbWUgPz9cclxuICAgICAgICByb3c/LnJlYWN0b3JOYW1lID8/XHJcbiAgICAgICAgcm93Py5jb250YWN0X25hbWUgPz9cclxuICAgICAgICByb3c/LmNvbnRhY3ROYW1lID8/XHJcbiAgICAgICAgcm93Py51c2VybmFtZSA/P1xyXG4gICAgICAgIHJvdz8uZW1haWwgPz9cclxuICAgICAgICAnJ1xyXG4gICAgICApLnRyaW0oKTtcclxuICAgICAgaWYgKGRpcmVjdE5hbWUgJiYgIWV4aXN0aW5nLnJlYWN0b3JzLmluY2x1ZGVzKGRpcmVjdE5hbWUpKSB7XHJcbiAgICAgICAgZXhpc3RpbmcucmVhY3RvcnMucHVzaChjb250YWN0SWQgPT09IG15Q29udGFjdElkID8gJ1lvdScgOiBkaXJlY3ROYW1lKTtcclxuICAgICAgfVxyXG5cclxuICAgICAgYnlFbW9qaS5zZXQoZW1vamksIGV4aXN0aW5nKTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gQXJyYXkuZnJvbShieUVtb2ppLnZhbHVlcygpKS5maWx0ZXIoKHIpID0+IHIuY291bnQgPiAwKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgYXBwbHlSZWFjdGlvbk9wdGltaXN0aWNhbGx5KG1lc3NhZ2VJZDogc3RyaW5nLCBlbW9qaTogc3RyaW5nLCBhZGQ6IGJvb2xlYW4pOiB2b2lkIHtcclxuICAgIGNvbnN0IG1hcCA9IG5ldyBNYXAodGhpcy5tZXNzYWdlc01hcCQudmFsdWUpO1xyXG4gICAgbGV0IGRpZFVwZGF0ZSA9IGZhbHNlO1xyXG5cclxuICAgIGZvciAoY29uc3QgW2NvbnZlcnNhdGlvbklkLCBtc2dzXSBvZiBtYXAuZW50cmllcygpKSB7XHJcbiAgICAgIGNvbnN0IGlkeCA9IG1zZ3MuZmluZEluZGV4KChtKSA9PiBTdHJpbmcobS5tZXNzYWdlX2lkKSA9PT0gU3RyaW5nKG1lc3NhZ2VJZCkpO1xyXG4gICAgICBpZiAoaWR4ID09PSAtMSkgY29udGludWU7XHJcblxyXG4gICAgICBjb25zdCB0YXJnZXQgPSBtc2dzW2lkeF07XHJcbiAgICAgIGNvbnN0IG5leHRSZWFjdGlvbnMgPSBbLi4uKHRhcmdldC5yZWFjdGlvbnMgfHwgW10pXTtcclxuICAgICAgY29uc3QgcklkeCA9IG5leHRSZWFjdGlvbnMuZmluZEluZGV4KChyKSA9PiByLmVtb2ppID09PSBlbW9qaSk7XHJcblxyXG4gICAgICBpZiAoYWRkKSB7XHJcbiAgICAgICAgaWYgKHJJZHggPj0gMCkge1xyXG4gICAgICAgICAgY29uc3QgY3VycmVudCA9IG5leHRSZWFjdGlvbnNbcklkeF07XHJcbiAgICAgICAgICBpZiAoIWN1cnJlbnQuaGFzUmVhY3RlZCkge1xyXG4gICAgICAgICAgICBjb25zdCByZWFjdG9ycyA9IEFycmF5LmlzQXJyYXkoY3VycmVudC5yZWFjdG9ycykgPyBbLi4uY3VycmVudC5yZWFjdG9yc10gOiBbXTtcclxuICAgICAgICAgICAgaWYgKCFyZWFjdG9ycy5pbmNsdWRlcygnWW91JykpIHJlYWN0b3JzLnVuc2hpZnQoJ1lvdScpO1xyXG4gICAgICAgICAgICBuZXh0UmVhY3Rpb25zW3JJZHhdID0ge1xyXG4gICAgICAgICAgICAgIC4uLmN1cnJlbnQsXHJcbiAgICAgICAgICAgICAgaGFzUmVhY3RlZDogdHJ1ZSxcclxuICAgICAgICAgICAgICBjb3VudDogTnVtYmVyKGN1cnJlbnQuY291bnQgfHwgMCkgKyAxLFxyXG4gICAgICAgICAgICAgIHJlYWN0b3JzLFxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICBuZXh0UmVhY3Rpb25zLnB1c2goeyBlbW9qaSwgY291bnQ6IDEsIGhhc1JlYWN0ZWQ6IHRydWUsIHJlYWN0b3JzOiBbJ1lvdSddIH0pO1xyXG4gICAgICAgIH1cclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBpZiAocklkeCA+PSAwKSB7XHJcbiAgICAgICAgICBjb25zdCBjdXJyZW50ID0gbmV4dFJlYWN0aW9uc1tySWR4XTtcclxuICAgICAgICAgIGNvbnN0IG5leHRDb3VudCA9IE1hdGgubWF4KE51bWJlcihjdXJyZW50LmNvdW50IHx8IDApIC0gKGN1cnJlbnQuaGFzUmVhY3RlZCA/IDEgOiAwKSwgMCk7XHJcbiAgICAgICAgICBpZiAobmV4dENvdW50ID09PSAwKSB7XHJcbiAgICAgICAgICAgIG5leHRSZWFjdGlvbnMuc3BsaWNlKHJJZHgsIDEpO1xyXG4gICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgbmV4dFJlYWN0aW9uc1tySWR4XSA9IHtcclxuICAgICAgICAgICAgICAuLi5jdXJyZW50LFxyXG4gICAgICAgICAgICAgIGhhc1JlYWN0ZWQ6IGZhbHNlLFxyXG4gICAgICAgICAgICAgIGNvdW50OiBuZXh0Q291bnQsXHJcbiAgICAgICAgICAgICAgcmVhY3RvcnM6IEFycmF5LmlzQXJyYXkoY3VycmVudC5yZWFjdG9ycylcclxuICAgICAgICAgICAgICAgID8gY3VycmVudC5yZWFjdG9ycy5maWx0ZXIoKG5hbWU6IHN0cmluZykgPT4gbmFtZSAhPT0gJ1lvdScpXHJcbiAgICAgICAgICAgICAgICA6IGN1cnJlbnQucmVhY3RvcnMsXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcblxyXG4gICAgICBjb25zdCB1cGRhdGVkTXNnOiBNZXNzYWdlID0geyAuLi50YXJnZXQsIHJlYWN0aW9uczogbmV4dFJlYWN0aW9ucyB9O1xyXG4gICAgICBjb25zdCB1cGRhdGVkTXNncyA9IFsuLi5tc2dzXTtcclxuICAgICAgdXBkYXRlZE1zZ3NbaWR4XSA9IHVwZGF0ZWRNc2c7XHJcbiAgICAgIG1hcC5zZXQoY29udmVyc2F0aW9uSWQsIHVwZGF0ZWRNc2dzKTtcclxuICAgICAgZGlkVXBkYXRlID0gdHJ1ZTtcclxuICAgICAgYnJlYWs7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGRpZFVwZGF0ZSkge1xyXG4gICAgICB0aGlzLm1lc3NhZ2VzTWFwJC5uZXh0KG1hcCk7XHJcbiAgICB9XHJcbiAgfVxyXG59XHJcbiJdfQ==