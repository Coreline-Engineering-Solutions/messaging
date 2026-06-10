import { Inject, Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject, forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { PLAIN_TEXT_MESSAGE_PREFIX, isProjectContainer, isProjectConversation, isProjectSubgroup, getContactDisplayName, getMessageSenderName, } from '../models/messaging.models';
import { MESSAGING_CONFIG } from '../messaging.config';
import * as i0 from "@angular/core";
import * as i1 from "./auth.service";
import * as i2 from "./messaging-api.service";
import * as i3 from "./messaging-websocket.service";
export class MessagingStoreService {
    auth;
    api;
    wsService;
    config;
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
    activeDbGid$ = new BehaviorSubject(null);
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
    activeDbGid = this.activeDbGid$.asObservable();
    wsSub = null;
    destroy$ = new Subject();
    pollTimer = null;
    groupSettings$ = new BehaviorSubject(null);
    deletingConversationIds = new Set();
    removalToastShown = new Set();
    toastTimer = null;
    groupSettings = this.groupSettings$.asObservable();
    constructor(auth, api, wsService, config) {
        this.auth = auth;
        this.api = api;
        this.wsService = wsService;
        this.config = config;
        this.wsStatus = this.wsService.status$;
    }
    get projectGroupsEnabled() {
        return this.config.enableProjectGroups === true;
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
    setActiveDbGid(dbGid) {
        const normalized = String(dbGid || '').trim() || null;
        if (normalized === this.activeDbGid$.value)
            return;
        this.activeDbGid$.next(normalized);
        this.api.setActiveDbGid(normalized);
        this.removeProjectConversationsFromUi();
        if (this.auth.isAuthenticated()) {
            this.loadInbox();
        }
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
                    const isProject = this.projectGroupsEnabled && isProjectConversation(item);
                    const isSubgroup = this.projectGroupsEnabled && isProjectSubgroup(item);
                    const conversationId = String(item.conversation_id);
                    const preview = this.replyBodyText(item.last_message_preview || '');
                    const hasMention = this.mentionConversationIds$.value.has(conversationId) ||
                        (Number(item.unread_count || 0) > 0 && this.messageTextMentionsCurrentUser(preview));
                    if (!isGroup && !item.name && item.other_participant_name) {
                        return { ...item, name: item.other_participant_name, last_message_preview: preview, is_group: false, is_project: isProject, is_project_subgroup: isSubgroup, has_mention: hasMention };
                    }
                    return { ...item, last_message_preview: preview, is_group: isGroup, is_project: isProject, is_project_subgroup: isSubgroup, has_mention: hasMention };
                }).filter(item => (!isProjectConversation(item) || this.projectGroupsEnabled) &&
                    !this.deletingConversationIds.has(String(item.conversation_id)) &&
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
    openConversation(conversationId, name, isGroup = false, isProject = false, isProjectSubgroup = false, dbGid, projectGid, parentConversationId, subgroupSubject) {
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
                {
                    conversationId,
                    name,
                    isGroup,
                    isProject,
                    isProjectSubgroup,
                    dbGid,
                    projectGid,
                    parentConversationId,
                    subgroupSubject,
                    isMinimized: false,
                    unreadCount: 0,
                },
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
    openGroupSettings(conversationId, name, isProject = false, isProjectSubgroup = false, dbGid, projectGid, parentConversationId, subject) {
        this.groupSettings$.next({
            conversationId,
            name,
            isProject,
            isProjectSubgroup,
            dbGid,
            projectGid,
            parentConversationId,
            subject,
        });
        this.setView('group-manager');
    }
    openProjectSubgroupCreator(parent) {
        if (!this.projectGroupsEnabled || !isProjectContainer(parent))
            return;
        this.groupSettings$.next({
            conversationId: String(parent.conversation_id),
            name: '',
            isProject: true,
            isProjectSubgroup: true,
            isProjectSubgroupCreate: true,
            dbGid: parent.db_gid,
            projectGid: parent.project_gid,
            parentConversationId: String(parent.conversation_id),
        });
        this.setView('group-manager');
        this.openPanel();
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
    setGroupAdmin(conversationId, targetContactId, isAdmin, callbacks) {
        if (!this.auth.contactId) {
            callbacks?.error?.();
            return;
        }
        this.api.setGroupAdmin(conversationId, targetContactId, isAdmin).subscribe({
            next: () => {
                this.loadInbox();
                this.notifyGroupMembershipChanged();
                callbacks?.success?.();
            },
            error: () => callbacks?.error?.(),
        });
    }
    createProjectSubgroup(parentConversationId, name, subject, participantIds, callbacks) {
        this.api.createProjectSubgroup(parentConversationId, {
            name,
            subject: subject || null,
            participant_ids: participantIds,
        }).subscribe({
            next: (subgroup) => {
                const convId = String(subgroup?.conversation_id || subgroup?.id || '');
                this.loadInbox();
                this.clearGroupSettings();
                if (convId) {
                    this.openConversation(convId, subgroup?.name || name, true, true, true, subgroup?.db_gid, subgroup?.project_gid, subgroup?.parent_conversation_id || parentConversationId, subgroup?.subject || subject || undefined);
                }
                callbacks?.success?.();
            },
            error: () => callbacks?.error?.(),
        });
    }
    updateProjectSubgroup(conversationId, name, subject, callbacks) {
        this.api.updateProjectSubgroup(conversationId, { name, subject: subject || null }).subscribe({
            next: (subgroup) => {
                const updatedName = subgroup?.name || name;
                this.openChats$.next(this.openChats$.value.map((chat) => String(chat.conversationId) === String(conversationId)
                    ? { ...chat, name: updatedName, subgroupSubject: subgroup?.subject || subject || undefined }
                    : chat));
                this.loadInbox();
                this.notifyGroupMembershipChanged();
                callbacks?.success?.();
            },
            error: () => callbacks?.error?.(),
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
    removeProjectConversationsFromUi() {
        const projectIds = new Set(this.inbox$.value
            .filter((item) => isProjectConversation(item))
            .map((item) => String(item.conversation_id)));
        this.openChats$.value
            .filter((chat) => chat.isProject)
            .forEach((chat) => projectIds.add(String(chat.conversationId)));
        if (projectIds.size === 0)
            return;
        const items = this.inbox$.value.filter((item) => !projectIds.has(String(item.conversation_id)));
        this.inbox$.next(items);
        this.recalcUnread(items);
        const map = new Map(this.messagesMap$.value);
        projectIds.forEach((id) => map.delete(id));
        this.messagesMap$.next(map);
        this.openChats$.next(this.openChats$.value.filter((chat) => !projectIds.has(String(chat.conversationId))));
        if (this.activeConversationId$.value && projectIds.has(String(this.activeConversationId$.value))) {
            this.activeConversationId$.next(null);
            this.activeView$.next('inbox');
        }
        const settings = this.groupSettings$.value;
        if (settings && projectIds.has(String(settings.conversationId))) {
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
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: MessagingStoreService, deps: [{ token: i1.AuthService }, { token: i2.MessagingApiService }, { token: i3.MessagingWebSocketService }, { token: MESSAGING_CONFIG }], target: i0.ɵɵFactoryTarget.Injectable });
    static ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: MessagingStoreService, providedIn: 'root' });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: MessagingStoreService, decorators: [{
            type: Injectable,
            args: [{ providedIn: 'root' }]
        }], ctorParameters: () => [{ type: i1.AuthService }, { type: i2.MessagingApiService }, { type: i3.MessagingWebSocketService }, { type: undefined, decorators: [{
                    type: Inject,
                    args: [MESSAGING_CONFIG]
                }] }] });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVzc2FnaW5nLXN0b3JlLnNlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvbGliL3NlcnZpY2VzL21lc3NhZ2luZy1zdG9yZS5zZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxNQUFNLEVBQUUsVUFBVSxFQUFhLE1BQU0sZUFBZSxDQUFDO0FBQzlELE9BQU8sRUFBRSxlQUFlLEVBQUUsVUFBVSxFQUFFLE9BQU8sRUFBZ0IsUUFBUSxFQUFFLEVBQUUsRUFBRSxNQUFNLE1BQU0sQ0FBQztBQUN4RixPQUFPLEVBQUUsVUFBVSxFQUFFLEdBQUcsRUFBRSxNQUFNLGdCQUFnQixDQUFDO0FBSWpELE9BQU8sRUFJTCx5QkFBeUIsRUFNekIsa0JBQWtCLEVBQ2xCLHFCQUFxQixFQUNyQixpQkFBaUIsRUFDakIscUJBQXFCLEVBQ3JCLG9CQUFvQixHQUNyQixNQUFNLDRCQUE0QixDQUFDO0FBQ3BDLE9BQU8sRUFBRSxnQkFBZ0IsRUFBbUIsTUFBTSxxQkFBcUIsQ0FBQzs7Ozs7QUFHeEUsTUFBTSxPQUFPLHFCQUFxQjtJQW9GdEI7SUFDQTtJQUNBO0lBQzBCO0lBdEZwQyx1QkFBdUI7SUFDZixNQUFNLEdBQUcsSUFBSSxlQUFlLENBQWMsRUFBRSxDQUFDLENBQUM7SUFDOUMsWUFBWSxHQUFHLElBQUksZUFBZSxDQUF5QixJQUFJLEdBQUcsRUFBRSxDQUFDLENBQUM7SUFDdEUsVUFBVSxHQUFHLElBQUksZUFBZSxDQUFlLEVBQUUsQ0FBQyxDQUFDO0lBQ25ELGdCQUFnQixHQUFHLElBQUksZUFBZSxDQUFZLEVBQUUsQ0FBQyxDQUFDO0lBQ3RELFVBQVUsR0FBRyxJQUFJLGVBQWUsQ0FBVSxLQUFLLENBQUMsQ0FBQztJQUNqRCxXQUFXLEdBQUcsSUFBSSxlQUFlLENBQW9GLE9BQU8sQ0FBQyxDQUFDO0lBQzlILFlBQVksR0FBRyxJQUFJLGVBQWUsQ0FDdkMsWUFBWSxDQUFDLE9BQU8s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QztZQUVELE1BQU0sVUFBVSxHQUFZLEVBQUUsR0FBRyxNQUFNLEVBQUUsU0FBUyxFQUFFLGFBQWEsRUFBRSxDQUFDO1lBQ3BFLE1BQU0sV0FBVyxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQztZQUM5QixXQUFXLENBQUMsR0FBRyxDQUFDLEdBQUcsVUFBVSxDQUFDO1lBQzlCLEdBQUcsQ0FBQyxHQUFHLENBQUMsY0FBYyxFQUFFLFdBQVcsQ0FBQyxDQUFDO1lBQ3JDLFNBQVMsR0FBRyxJQUFJLENBQUM7WUFDakIsTUFBTTtRQUNSLENBQUM7UUFFRCxJQUFJLFNBQVMsRUFBRSxDQUFDO1lBQ2QsSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDOUIsQ0FBQztJQUNILENBQUM7d0dBOStEVSxxQkFBcUIseUhBdUZ0QixnQkFBZ0I7NEdBdkZmLHFCQUFxQixjQURSLE1BQU07OzRGQUNuQixxQkFBcUI7a0JBRGpDLFVBQVU7bUJBQUMsRUFBRSxVQUFVLEVBQUUsTUFBTSxFQUFFOzswQkF3RjdCLE1BQU07MkJBQUMsZ0JBQWdCIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgSW5qZWN0LCBJbmplY3RhYmxlLCBPbkRlc3Ryb3kgfSBmcm9tICdAYW5ndWxhci9jb3JlJztcclxuaW1wb3J0IHsgQmVoYXZpb3JTdWJqZWN0LCBPYnNlcnZhYmxlLCBTdWJqZWN0LCBTdWJzY3JpcHRpb24sIGZvcmtKb2luLCBvZiB9IGZyb20gJ3J4anMnO1xyXG5pbXBvcnQgeyBjYXRjaEVycm9yLCBtYXAgfSBmcm9tICdyeGpzL29wZXJhdG9ycyc7XHJcbmltcG9ydCB7IEF1dGhTZXJ2aWNlIH0gZnJvbSAnLi9hdXRoLnNlcnZpY2UnO1xyXG5pbXBvcnQgeyBNZXNzYWdpbmdBcGlTZXJ2aWNlIH0gZnJvbSAnLi9tZXNzYWdpbmctYXBpLnNlcnZpY2UnO1xyXG5pbXBvcnQgeyBNZXNzYWdpbmdXZWJTb2NrZXRTZXJ2aWNlIH0gZnJvbSAnLi9tZXNzYWdpbmctd2Vic29ja2V0LnNlcnZpY2UnO1xyXG5pbXBvcnQge1xyXG4gIEluYm94SXRlbSxcclxuICBNZXNzYWdlLFxyXG4gIE1lc3NhZ2VSZXBseVByZXZpZXcsXHJcbiAgUExBSU5fVEVYVF9NRVNTQUdFX1BSRUZJWCxcclxuICBBdHRhY2htZW50LFxyXG4gIENvbnRhY3QsXHJcbiAgQ2hhdFdpbmRvdyxcclxuICBXZWJTb2NrZXRNZXNzYWdlLFxyXG4gIFNpZGViYXJTaWRlLFxyXG4gIGlzUHJvamVjdENvbnRhaW5lcixcclxuICBpc1Byb2plY3RDb252ZXJzYXRpb24sXHJcbiAgaXNQcm9qZWN0U3ViZ3JvdXAsXHJcbiAgZ2V0Q29udGFjdERpc3BsYXlOYW1lLFxyXG4gIGdldE1lc3NhZ2VTZW5kZXJOYW1lLFxyXG59IGZyb20gJy4uL21vZGVscy9tZXNzYWdpbmcubW9kZWxzJztcclxuaW1wb3J0IHsgTUVTU0FHSU5HX0NPTkZJRywgTWVzc2FnaW5nQ29uZmlnIH0gZnJvbSAnLi4vbWVzc2FnaW5nLmNvbmZpZyc7XHJcblxyXG5ASW5qZWN0YWJsZSh7IHByb3ZpZGVkSW46ICdyb290JyB9KVxyXG5leHBvcnQgY2xhc3MgTWVzc2FnaW5nU3RvcmVTZXJ2aWNlIGltcGxlbWVudHMgT25EZXN0cm95IHtcclxuICAvLyDilIDilIAgU3RhdGUgc3ViamVjdHMg4pSA4pSAXHJcbiAgcHJpdmF0ZSBpbmJveCQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PEluYm94SXRlbVtdPihbXSk7XHJcbiAgcHJpdmF0ZSBtZXNzYWdlc01hcCQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PE1hcDxzdHJpbmcsIE1lc3NhZ2VbXT4+KG5ldyBNYXAoKSk7XHJcbiAgcHJpdmF0ZSBvcGVuQ2hhdHMkID0gbmV3IEJlaGF2aW9yU3ViamVjdDxDaGF0V2luZG93W10+KFtdKTtcclxuICBwcml2YXRlIHZpc2libGVDb250YWN0cyQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PENvbnRhY3RbXT4oW10pO1xyXG4gIHByaXZhdGUgcGFuZWxPcGVuJCA9IG5ldyBCZWhhdmlvclN1YmplY3Q8Ym9vbGVhbj4oZmFsc2UpO1xyXG4gIHByaXZhdGUgYWN0aXZlVmlldyQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PCdpbmJveCcgfCAnY2hhdCcgfCAnbmV3LWNvbnZlcnNhdGlvbicgfCAnZ3JvdXAtbWFuYWdlcicgfCAnY29udmVyc2F0aW9uLXNldHRpbmdzJz4oJ2luYm94Jyk7XHJcbiAgcHJpdmF0ZSBzaWRlYmFyU2lkZSQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PFNpZGViYXJTaWRlPihcclxuICAgIChsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnbWVzc2FnaW5nX3NpZGViYXJfc2lkZScpIGFzIFNpZGViYXJTaWRlKSB8fCAncmlnaHQnXHJcbiAgKTtcclxuICBwcml2YXRlIGFjdGl2ZUNvbnZlcnNhdGlvbklkJCA9IG5ldyBCZWhhdmlvclN1YmplY3Q8c3RyaW5nIHwgbnVsbD4obnVsbCk7XHJcbiAgcHJpdmF0ZSBwZW5kaW5nRG1SZWNpcGllbnQkID0gbmV3IEJlaGF2aW9yU3ViamVjdDx7Y29udGFjdElkOiBzdHJpbmcsIG5hbWU6IHN0cmluZ30gfCBudWxsPihudWxsKTtcclxuICBwcml2YXRlIHRvdGFsVW5yZWFkJCA9IG5ldyBCZWhhdmlvclN1YmplY3Q8bnVtYmVyPigwKTtcclxuICBwcml2YXRlIGxvYWRpbmdNZXNzYWdlcyQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PGJvb2xlYW4+KGZhbHNlKTtcclxuICBwcml2YXRlIHBhbmVsUG9zaXRpb24kID0gbmV3IEJlaGF2aW9yU3ViamVjdDx7IHg6IG51bWJlcjsgeTogbnVtYmVyIH0gfCBudWxsPihudWxsKTtcclxuICBwcml2YXRlIHBhbmVsU2l6ZSQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PHsgd2lkdGg6IG51bWJlcjsgaGVpZ2h0OiBudW1iZXIgfT4oeyB3aWR0aDogMzgwLCBoZWlnaHQ6IDU2MCB9KTtcclxuICBwcml2YXRlIHdhc09wZW5CZWZvcmVEcmFnJCA9IG5ldyBCZWhhdmlvclN1YmplY3Q8Ym9vbGVhbj4oZmFsc2UpO1xyXG4gIHByaXZhdGUgcGFuZWxGbG9hdGluZyQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PGJvb2xlYW4+KGZhbHNlKTtcclxuICBwcml2YXRlIG5vdGlmaWNhdGlvblZvbHVtZSQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PG51bWJlcj4oXHJcbiAgICBOdW1iZXIobG9jYWxTdG9yYWdlLmdldEl0ZW0oJ21lc3NhZ2luZ19ub3RpZmljYXRpb25fdm9sdW1lJykgPz8gJzAuMzUnKVxyXG4gICk7XHJcbiAgcHJpdmF0ZSBub3RpZmljYXRpb25zTXV0ZWQkID0gbmV3IEJlaGF2aW9yU3ViamVjdDxib29sZWFuPihcclxuICAgIGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdtZXNzYWdpbmdfbm90aWZpY2F0aW9uc19tdXRlZCcpID09PSAndHJ1ZSdcclxuICApO1xyXG4gIHByaXZhdGUgbWVzc2FnZVRleHRTY2FsZSQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PG51bWJlcj4oXHJcbiAgICBOdW1iZXIobG9jYWxTdG9yYWdlLmdldEl0ZW0oJ21lc3NhZ2luZ19tZXNzYWdlX3RleHRfc2NhbGUnKSA/PyAnMScpXHJcbiAgKTtcclxuICBwcml2YXRlIGNvZGVUZXh0U2NhbGUkID0gbmV3IEJlaGF2aW9yU3ViamVjdDxudW1iZXI+KFxyXG4gICAgTnVtYmVyKGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdtZXNzYWdpbmdfY29kZV90ZXh0X3NjYWxlJykgPz8gJzEnKVxyXG4gICk7XHJcbiAgcHJpdmF0ZSB0b2FzdCQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PHsgbWVzc2FnZTogc3RyaW5nOyB0eXBlOiAnaW5mbycgfCAnc3VjY2VzcycgfCAnZXJyb3InIH0gfCBudWxsPihudWxsKTtcclxuICBwcml2YXRlIHJlbW92ZWRHcm91cElkcyQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PFNldDxzdHJpbmc+PihuZXcgU2V0KCkpO1xyXG4gIHByaXZhdGUgbWVudGlvbkNvbnZlcnNhdGlvbklkcyQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PFNldDxzdHJpbmc+PihuZXcgU2V0KCkpO1xyXG4gIHByaXZhdGUgZ3JvdXBNZW1iZXJzaGlwVmVyc2lvbiQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PG51bWJlcj4oMCk7XHJcbiAgcHJpdmF0ZSBhY3RpdmVEYkdpZCQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PHN0cmluZyB8IG51bGw+KG51bGwpO1xyXG5cclxuICAvLyDilIDilIAgUHVibGljIG9ic2VydmFibGVzIOKUgOKUgFxyXG4gIHJlYWRvbmx5IGluYm94ID0gdGhpcy5pbmJveCQuYXNPYnNlcnZhYmxlKCk7XHJcbiAgcmVhZG9ubHkgbWVzc2FnZXNNYXAgPSB0aGlzLm1lc3NhZ2VzTWFwJC5hc09ic2VydmFibGUoKTtcclxuICByZWFkb25seSBvcGVuQ2hhdHMgPSB0aGlzLm9wZW5DaGF0cyQuYXNPYnNlcnZhYmxlKCk7XHJcbiAgcmVhZG9ubHkgdmlzaWJsZUNvbnRhY3RzID0gdGhpcy52aXNpYmxlQ29udGFjdHMkLmFzT2JzZXJ2YWJsZSgpO1xyXG4gIHJlYWRvbmx5IHBhbmVsT3BlbiA9IHRoaXMucGFuZWxPcGVuJC5hc09ic2VydmFibGUoKTtcclxuICByZWFkb25seSBhY3RpdmVWaWV3ID0gdGhpcy5hY3RpdmVWaWV3JC5hc09ic2VydmFibGUoKTtcclxuICByZWFkb25seSBhY3RpdmVDb252ZXJzYXRpb25JZCA9IHRoaXMuYWN0aXZlQ29udmVyc2F0aW9uSWQkLmFzT2JzZXJ2YWJsZSgpO1xyXG4gIHJlYWRvbmx5IHRvdGFsVW5yZWFkID0gdGhpcy50b3RhbFVucmVhZCQuYXNPYnNlcnZhYmxlKCk7XHJcbiAgcmVhZG9ubHkgbG9hZGluZ01lc3NhZ2VzID0gdGhpcy5sb2FkaW5nTWVzc2FnZXMkLmFzT2JzZXJ2YWJsZSgpO1xyXG4gIHdzU3RhdHVzOiBPYnNlcnZhYmxlPHN0cmluZz4gPSBuZXcgT2JzZXJ2YWJsZTxzdHJpbmc+KCk7XHJcbiAgcmVhZG9ubHkgcGFuZWxQb3NpdGlvbiA9IHRoaXMucGFuZWxQb3NpdGlvbiQuYXNPYnNlcnZhYmxlKCk7XHJcbiAgcmVhZG9ubHkgcGFuZWxTaXplID0gdGhpcy5wYW5lbFNpemUkLmFzT2JzZXJ2YWJsZSgpO1xyXG4gIHJlYWRvbmx5IHdhc09wZW5CZWZvcmVEcmFnID0gdGhpcy53YXNPcGVuQmVmb3JlRHJhZyQuYXNPYnNlcnZhYmxlKCk7XHJcbiAgcmVhZG9ubHkgc2lkZWJhclNpZGUgPSB0aGlzLnNpZGViYXJTaWRlJC5hc09ic2VydmFibGUoKTtcclxuICByZWFkb25seSBwYW5lbEZsb2F0aW5nID0gdGhpcy5wYW5lbEZsb2F0aW5nJC5hc09ic2VydmFibGUoKTtcclxuICByZWFkb25seSBub3RpZmljYXRpb25Wb2x1bWUgPSB0aGlzLm5vdGlmaWNhdGlvblZvbHVtZSQuYXNPYnNlcnZhYmxlKCk7XHJcbiAgcmVhZG9ubHkgbm90aWZpY2F0aW9uc011dGVkID0gdGhpcy5ub3RpZmljYXRpb25zTXV0ZWQkLmFzT2JzZXJ2YWJsZSgpO1xyXG4gIHJlYWRvbmx5IG1lc3NhZ2VUZXh0U2NhbGUgPSB0aGlzLm1lc3NhZ2VUZXh0U2NhbGUkLmFzT2JzZXJ2YWJsZSgpO1xyXG4gIHJlYWRvbmx5IGNvZGVUZXh0U2NhbGUgPSB0aGlzLmNvZGVUZXh0U2NhbGUkLmFzT2JzZXJ2YWJsZSgpO1xyXG4gIHJlYWRvbmx5IHRvYXN0ID0gdGhpcy50b2FzdCQuYXNPYnNlcnZhYmxlKCk7XHJcbiAgcmVhZG9ubHkgcmVtb3ZlZEdyb3VwSWRzID0gdGhpcy5yZW1vdmVkR3JvdXBJZHMkLmFzT2JzZXJ2YWJsZSgpO1xyXG4gIHJlYWRvbmx5IG1lbnRpb25Db252ZXJzYXRpb25JZHMgPSB0aGlzLm1lbnRpb25Db252ZXJzYXRpb25JZHMkLmFzT2JzZXJ2YWJsZSgpO1xyXG4gIHJlYWRvbmx5IGdyb3VwTWVtYmVyc2hpcFZlcnNpb24gPSB0aGlzLmdyb3VwTWVtYmVyc2hpcFZlcnNpb24kLmFzT2JzZXJ2YWJsZSgpO1xyXG4gIHJlYWRvbmx5IGFjdGl2ZURiR2lkID0gdGhpcy5hY3RpdmVEYkdpZCQuYXNPYnNlcnZhYmxlKCk7XHJcblxyXG4gIHByaXZhdGUgd3NTdWI6IFN1YnNjcmlwdGlvbiB8IG51bGwgPSBudWxsO1xyXG4gIHByaXZhdGUgZGVzdHJveSQgPSBuZXcgU3ViamVjdDx2b2lkPigpO1xyXG4gIHByaXZhdGUgcG9sbFRpbWVyOiBhbnkgPSBudWxsO1xyXG4gIHByaXZhdGUgZ3JvdXBTZXR0aW5ncyQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PHtcclxuICAgIGNvbnZlcnNhdGlvbklkOiBzdHJpbmc7XHJcbiAgICBuYW1lOiBzdHJpbmc7XHJcbiAgICBpc1Byb2plY3Q/OiBib29sZWFuO1xyXG4gICAgaXNQcm9qZWN0U3ViZ3JvdXA/OiBib29sZWFuO1xyXG4gICAgaXNQcm9qZWN0U3ViZ3JvdXBDcmVhdGU/OiBib29sZWFuO1xyXG4gICAgZGJHaWQ/OiBzdHJpbmc7XHJcbiAgICBwcm9qZWN0R2lkPzogc3RyaW5nO1xyXG4gICAgcGFyZW50Q29udmVyc2F0aW9uSWQ/OiBzdHJpbmc7XHJcbiAgICBzdWJqZWN0Pzogc3RyaW5nO1xyXG4gIH0gfCBudWxsPihudWxsKTtcclxuICBwcml2YXRlIGRlbGV0aW5nQ29udmVyc2F0aW9uSWRzID0gbmV3IFNldDxzdHJpbmc+KCk7XHJcbiAgcHJpdmF0ZSByZW1vdmFsVG9hc3RTaG93biA9IG5ldyBTZXQ8c3RyaW5nPigpO1xyXG4gIHByaXZhdGUgdG9hc3RUaW1lcjogYW55ID0gbnVsbDtcclxuXHJcbiAgcmVhZG9ubHkgZ3JvdXBTZXR0aW5ncyA9IHRoaXMuZ3JvdXBTZXR0aW5ncyQuYXNPYnNlcnZhYmxlKCk7XHJcblxyXG4gIGNvbnN0cnVjdG9yKFxyXG4gICAgcHJpdmF0ZSBhdXRoOiBBdXRoU2VydmljZSxcclxuICAgIHByaXZhdGUgYXBpOiBNZXNzYWdpbmdBcGlTZXJ2aWNlLFxyXG4gICAgcHJpdmF0ZSB3c1NlcnZpY2U6IE1lc3NhZ2luZ1dlYlNvY2tldFNlcnZpY2UsXHJcbiAgICBASW5qZWN0KE1FU1NBR0lOR19DT05GSUcpIHByaXZhdGUgY29uZmlnOiBNZXNzYWdpbmdDb25maWdcclxuICApIHtcclxuICAgICh0aGlzIGFzIGFueSkud3NTdGF0dXMgPSB0aGlzLndzU2VydmljZS5zdGF0dXMkO1xyXG4gIH1cclxuXHJcbiAgZ2V0IHByb2plY3RHcm91cHNFbmFibGVkKCk6IGJvb2xlYW4ge1xyXG4gICAgcmV0dXJuIHRoaXMuY29uZmlnLmVuYWJsZVByb2plY3RHcm91cHMgPT09IHRydWU7XHJcbiAgfVxyXG5cclxuICAvLyDilIDilIAgSW5pdGlhbGl6YXRpb24g4pSA4pSAXHJcbiAgaW5pdGlhbGl6ZSgpOiB2b2lkIHtcclxuICAgIGlmICghdGhpcy5hdXRoLmlzQXV0aGVudGljYXRlZCgpKSByZXR1cm47XHJcblxyXG4gICAgdGhpcy5hdXRoLnJlZnJlc2hNZXNzYWdpbmdTZXNzaW9uKCkuc3Vic2NyaWJlKHtcclxuICAgICAgbmV4dDogKGNvbnRhY3QpID0+IHtcclxuICAgICAgICBpZiAoIWNvbnRhY3QpIHtcclxuICAgICAgICAgIHRoaXMudGVhcmRvd24oKTtcclxuICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5pbml0aWFsaXplV2l0aFZlcmlmaWVkU2Vzc2lvbigpO1xyXG4gICAgICB9LFxyXG4gICAgICBlcnJvcjogKCkgPT4gdGhpcy50ZWFyZG93bigpLFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGluaXRpYWxpemVXaXRoVmVyaWZpZWRTZXNzaW9uKCk6IHZvaWQge1xyXG4gICAgY29uc3QgY29udGFjdElkID0gdGhpcy5hdXRoLmNvbnRhY3RJZCE7XHJcbiAgICBjb25zdCBzZXNzaW9uR2lkID0gdGhpcy5hdXRoLnNlc3Npb25HaWQhO1xyXG5cclxuICAgIHRoaXMubG9hZEluYm94KCk7XHJcbiAgICB0aGlzLmxvYWRWaXNpYmxlQ29udGFjdHMoKTtcclxuXHJcbiAgICB0aGlzLndzU2VydmljZS5jb25uZWN0KGNvbnRhY3RJZCwgc2Vzc2lvbkdpZCk7XHJcbiAgICB0aGlzLmxpc3RlbldlYlNvY2tldCgpO1xyXG4gICAgdGhpcy5zdGFydFBvbGxpbmcoKTtcclxuICB9XHJcblxyXG4gIHRlYXJkb3duKCk6IHZvaWQge1xyXG4gICAgdGhpcy5zdG9wUG9sbGluZygpO1xyXG4gICAgaWYgKHRoaXMudG9hc3RUaW1lcikge1xyXG4gICAgICBjbGVhclRpbWVvdXQodGhpcy50b2FzdFRpbWVyKTtcclxuICAgICAgdGhpcy50b2FzdFRpbWVyID0gbnVsbDtcclxuICAgIH1cclxuICAgIHRoaXMud3NTZXJ2aWNlLmRpc2Nvbm5lY3QoKTtcclxuICAgIHRoaXMud3NTdWI/LnVuc3Vic2NyaWJlKCk7XHJcbiAgICB0aGlzLmluYm94JC5uZXh0KFtdKTtcclxuICAgIHRoaXMubWVzc2FnZXNNYXAkLm5leHQobmV3IE1hcCgpKTtcclxuICAgIHRoaXMub3BlbkNoYXRzJC5uZXh0KFtdKTtcclxuICAgIHRoaXMucGFuZWxPcGVuJC5uZXh0KGZhbHNlKTtcclxuICAgIHRoaXMuYWN0aXZlVmlldyQubmV4dCgnaW5ib3gnKTtcclxuICAgIHRoaXMuYWN0aXZlQ29udmVyc2F0aW9uSWQkLm5leHQobnVsbCk7XHJcbiAgICB0aGlzLnRvdGFsVW5yZWFkJC5uZXh0KDApO1xyXG4gICAgdGhpcy5kZWxldGluZ0NvbnZlcnNhdGlvbklkcy5jbGVhcigpO1xyXG4gICAgdGhpcy5yZW1vdmFsVG9hc3RTaG93bi5jbGVhcigpO1xyXG4gICAgdGhpcy5yZW1vdmVkR3JvdXBJZHMkLm5leHQobmV3IFNldCgpKTtcclxuICAgIHRoaXMubWVudGlvbkNvbnZlcnNhdGlvbklkcyQubmV4dChuZXcgU2V0KCkpO1xyXG4gICAgdGhpcy5ncm91cE1lbWJlcnNoaXBWZXJzaW9uJC5uZXh0KDApO1xyXG4gICAgdGhpcy50b2FzdCQubmV4dChudWxsKTtcclxuICB9XHJcblxyXG4gIC8vIOKUgOKUgCBQb2xsaW5nIGZhbGxiYWNrIChpbmJveCBvbmx5IC0gbWVzc2FnZXMgcmVseSBvbiBXZWJTb2NrZXQpIOKUgOKUgFxyXG4gIHByaXZhdGUgc3RhcnRQb2xsaW5nKCk6IHZvaWQge1xyXG4gICAgdGhpcy5zdG9wUG9sbGluZygpO1xyXG4gICAgdGhpcy5wb2xsVGltZXIgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XHJcbiAgICAgIHRoaXMubG9hZEluYm94KCk7XHJcbiAgICB9LCAzMDAwMCk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHN0b3BQb2xsaW5nKCk6IHZvaWQge1xyXG4gICAgaWYgKHRoaXMucG9sbFRpbWVyKSB7XHJcbiAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy5wb2xsVGltZXIpO1xyXG4gICAgICB0aGlzLnBvbGxUaW1lciA9IG51bGw7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBuZ09uRGVzdHJveSgpOiB2b2lkIHtcclxuICAgIHRoaXMudGVhcmRvd24oKTtcclxuICAgIHRoaXMuZGVzdHJveSQubmV4dCgpO1xyXG4gICAgdGhpcy5kZXN0cm95JC5jb21wbGV0ZSgpO1xyXG4gIH1cclxuXHJcbiAgLy8g4pSA4pSAIFBhbmVsIGNvbnRyb2xzIOKUgOKUgFxyXG4gIHRvZ2dsZVBhbmVsKGJ1dHRvblg/OiBudW1iZXIsIGJ1dHRvblk/OiBudW1iZXIpOiB2b2lkIHtcclxuICAgIGlmIChidXR0b25YICE9PSB1bmRlZmluZWQgJiYgYnV0dG9uWSAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgIHRoaXMucGFuZWxQb3NpdGlvbiQubmV4dCh7IHg6IGJ1dHRvblgsIHk6IGJ1dHRvblkgfSk7XHJcbiAgICB9XHJcbiAgICB0aGlzLnBhbmVsT3BlbiQubmV4dCghdGhpcy5wYW5lbE9wZW4kLnZhbHVlKTtcclxuICB9XHJcblxyXG4gIG9wZW5QYW5lbChidXR0b25YPzogbnVtYmVyLCBidXR0b25ZPzogbnVtYmVyKTogdm9pZCB7XHJcbiAgICBpZiAoYnV0dG9uWCAhPT0gdW5kZWZpbmVkICYmIGJ1dHRvblkgIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICB0aGlzLnBhbmVsUG9zaXRpb24kLm5leHQoeyB4OiBidXR0b25YLCB5OiBidXR0b25ZIH0pO1xyXG4gICAgfVxyXG4gICAgdGhpcy5wYW5lbE9wZW4kLm5leHQodHJ1ZSk7XHJcbiAgfVxyXG5cclxuICBjbG9zZVBhbmVsKCk6IHZvaWQge1xyXG4gICAgdGhpcy5wYW5lbE9wZW4kLm5leHQoZmFsc2UpO1xyXG4gIH1cclxuXHJcbiAgc2V0UGFuZWxTaXplKHdpZHRoOiBudW1iZXIsIGhlaWdodDogbnVtYmVyKTogdm9pZCB7XHJcbiAgICB0aGlzLnBhbmVsU2l6ZSQubmV4dCh7IHdpZHRoLCBoZWlnaHQgfSk7XHJcbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnbWVzc2FnaW5nX3BhbmVsX3NpemUnLCBKU09OLnN0cmluZ2lmeSh7IHdpZHRoLCBoZWlnaHQgfSkpO1xyXG4gIH1cclxuXHJcbiAgZ2V0UGFuZWxTaXplKCk6IHsgd2lkdGg6IG51bWJlcjsgaGVpZ2h0OiBudW1iZXIgfSB7XHJcbiAgICBjb25zdCBzYXZlZCA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdtZXNzYWdpbmdfcGFuZWxfc2l6ZScpO1xyXG4gICAgaWYgKHNhdmVkKSB7XHJcbiAgICAgIHRyeSB7XHJcbiAgICAgICAgY29uc3QgcGFyc2VkID0gSlNPTi5wYXJzZShzYXZlZCk7XHJcbiAgICAgICAgaWYgKHBhcnNlZC53aWR0aCAmJiBwYXJzZWQuaGVpZ2h0KSB7XHJcbiAgICAgICAgICB0aGlzLnBhbmVsU2l6ZSQubmV4dChwYXJzZWQpO1xyXG4gICAgICAgICAgcmV0dXJuIHBhcnNlZDtcclxuICAgICAgICB9XHJcbiAgICAgIH0gY2F0Y2gge31cclxuICAgIH1cclxuICAgIHJldHVybiB0aGlzLnBhbmVsU2l6ZSQudmFsdWU7XHJcbiAgfVxyXG5cclxuICBvbkJ1dHRvbkRyYWdTdGFydCgpOiB2b2lkIHtcclxuICAgIHRoaXMud2FzT3BlbkJlZm9yZURyYWckLm5leHQodGhpcy5wYW5lbE9wZW4kLnZhbHVlKTtcclxuICAgIGlmICh0aGlzLnBhbmVsT3BlbiQudmFsdWUpIHtcclxuICAgICAgdGhpcy5wYW5lbE9wZW4kLm5leHQoZmFsc2UpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgb25CdXR0b25EcmFnRW5kKGJ1dHRvblg6IG51bWJlciwgYnV0dG9uWTogbnVtYmVyKTogdm9pZCB7XHJcbiAgICBpZiAodGhpcy53YXNPcGVuQmVmb3JlRHJhZyQudmFsdWUpIHtcclxuICAgICAgdGhpcy5vcGVuUGFuZWwoYnV0dG9uWCwgYnV0dG9uWSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBzZXRWaWV3KHZpZXc6ICdpbmJveCcgfCAnY2hhdCcgfCAnbmV3LWNvbnZlcnNhdGlvbicgfCAnZ3JvdXAtbWFuYWdlcicgfCAnY29udmVyc2F0aW9uLXNldHRpbmdzJyk6IHZvaWQge1xyXG4gICAgdGhpcy5hY3RpdmVWaWV3JC5uZXh0KHZpZXcpO1xyXG4gIH1cclxuXHJcbiAgdG9nZ2xlU2lkZWJhclNpZGUoKTogdm9pZCB7XHJcbiAgICBjb25zdCBuZXh0ID0gdGhpcy5zaWRlYmFyU2lkZSQudmFsdWUgPT09ICdyaWdodCcgPyAnbGVmdCcgOiAncmlnaHQnO1xyXG4gICAgdGhpcy5zaWRlYmFyU2lkZSQubmV4dChuZXh0KTtcclxuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdtZXNzYWdpbmdfc2lkZWJhcl9zaWRlJywgbmV4dCk7XHJcbiAgfVxyXG5cclxuICBzZXRQYW5lbEZsb2F0aW5nKGlzRmxvYXRpbmc6IGJvb2xlYW4pOiB2b2lkIHtcclxuICAgIHRoaXMucGFuZWxGbG9hdGluZyQubmV4dChpc0Zsb2F0aW5nKTtcclxuICB9XHJcblxyXG4gIHNldE5vdGlmaWNhdGlvblZvbHVtZSh2b2x1bWU6IG51bWJlcik6IHZvaWQge1xyXG4gICAgY29uc3Qgbm9ybWFsaXplZCA9IE1hdGgubWF4KDAsIE1hdGgubWluKDEsIE51bWJlcih2b2x1bWUpKSk7XHJcbiAgICB0aGlzLm5vdGlmaWNhdGlvblZvbHVtZSQubmV4dChub3JtYWxpemVkKTtcclxuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdtZXNzYWdpbmdfbm90aWZpY2F0aW9uX3ZvbHVtZScsIFN0cmluZyhub3JtYWxpemVkKSk7XHJcbiAgICBpZiAobm9ybWFsaXplZCA+IDAgJiYgdGhpcy5ub3RpZmljYXRpb25zTXV0ZWQkLnZhbHVlKSB7XHJcbiAgICAgIHRoaXMuc2V0Tm90aWZpY2F0aW9uc011dGVkKGZhbHNlKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHNldE5vdGlmaWNhdGlvbnNNdXRlZChtdXRlZDogYm9vbGVhbik6IHZvaWQge1xyXG4gICAgdGhpcy5ub3RpZmljYXRpb25zTXV0ZWQkLm5leHQobXV0ZWQpO1xyXG4gICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ21lc3NhZ2luZ19ub3RpZmljYXRpb25zX211dGVkJywgU3RyaW5nKG11dGVkKSk7XHJcbiAgfVxyXG5cclxuICBzZXRNZXNzYWdlVGV4dFNjYWxlKHNjYWxlOiBudW1iZXIpOiB2b2lkIHtcclxuICAgIGNvbnN0IG5vcm1hbGl6ZWQgPSBNYXRoLm1heCgwLjgsIE1hdGgubWluKDEuNSwgTnVtYmVyKHNjYWxlKSkpO1xyXG4gICAgdGhpcy5tZXNzYWdlVGV4dFNjYWxlJC5uZXh0KG5vcm1hbGl6ZWQpO1xyXG4gICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ21lc3NhZ2luZ19tZXNzYWdlX3RleHRfc2NhbGUnLCBTdHJpbmcobm9ybWFsaXplZCkpO1xyXG4gIH1cclxuXHJcbiAgc2V0Q29kZVRleHRTY2FsZShzY2FsZTogbnVtYmVyKTogdm9pZCB7XHJcbiAgICBjb25zdCBub3JtYWxpemVkID0gTWF0aC5tYXgoMC44LCBNYXRoLm1pbigxLjUsIE51bWJlcihzY2FsZSkpKTtcclxuICAgIHRoaXMuY29kZVRleHRTY2FsZSQubmV4dChub3JtYWxpemVkKTtcclxuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdtZXNzYWdpbmdfY29kZV90ZXh0X3NjYWxlJywgU3RyaW5nKG5vcm1hbGl6ZWQpKTtcclxuICB9XHJcblxyXG4gIHRlc3ROb3RpZmljYXRpb25Tb3VuZCgpOiB2b2lkIHtcclxuICAgIHRoaXMucGxheVNvZnROb3RpZmljYXRpb25Tb3VuZCh0cnVlKTtcclxuICB9XHJcblxyXG4gIHByZXBhcmVPdXRnb2luZ01lc3NhZ2VDb250ZW50KGNvbnRlbnQ6IHN0cmluZywgcmVwbHlUbz86IE1lc3NhZ2UgfCBudWxsLCBmb3JjZVBsYWluVGV4dD86IGJvb2xlYW4pOiBzdHJpbmcge1xyXG4gICAgY29uc3QgYm9keSA9IFN0cmluZyhjb250ZW50IHx8ICcnKS50cmltKCk7XHJcbiAgICBjb25zdCB3aXRoUmVwbHkgPSAhcmVwbHlUbyA/IGJvZHkgOiAoKCkgPT4ge1xyXG4gICAgICBjb25zdCByZXBseSA9IHRoaXMuY3JlYXRlUmVwbHlQcmV2aWV3KHJlcGx5VG8pO1xyXG4gICAgICBjb25zdCBzZW5kZXIgPSAocmVwbHkuc2VuZGVyX25hbWUgfHwgJ21lc3NhZ2UnKS5yZXBsYWNlKC9cXF0vZywgJycpLnRyaW0oKTtcclxuICAgICAgY29uc3QgZXhjZXJwdCA9IHRoaXMucmVwbHlFeGNlcnB0KHJlcGx5LmNvbnRlbnQgfHwgJycpO1xyXG4gICAgICByZXR1cm4gYFtSZXBseSB0byAke3NlbmRlcn1dXFxuPiAke2V4Y2VycHR9XFxuXFxuJHtib2R5fWA7XHJcbiAgICB9KSgpO1xyXG4gICAgcmV0dXJuIGZvcmNlUGxhaW5UZXh0ID8gYCR7UExBSU5fVEVYVF9NRVNTQUdFX1BSRUZJWH0ke3dpdGhSZXBseX1gIDogd2l0aFJlcGx5O1xyXG4gIH1cclxuXHJcbiAgY3JlYXRlUmVwbHlQcmV2aWV3KG1lc3NhZ2U6IE1lc3NhZ2UpOiBNZXNzYWdlUmVwbHlQcmV2aWV3IHtcclxuICAgIHJldHVybiB7XHJcbiAgICAgIG1lc3NhZ2VfaWQ6IFN0cmluZyhtZXNzYWdlLm1lc3NhZ2VfaWQgfHwgJycpLFxyXG4gICAgICBzZW5kZXJfbmFtZTogZ2V0TWVzc2FnZVNlbmRlck5hbWUobWVzc2FnZSkgIT09ICdVbmtub3duJ1xyXG4gICAgICAgID8gZ2V0TWVzc2FnZVNlbmRlck5hbWUobWVzc2FnZSlcclxuICAgICAgICA6IHRoaXMuZ2V0Q29udGFjdE5hbWVCeUlkKG1lc3NhZ2Uuc2VuZGVyX2lkKSxcclxuICAgICAgY29udGVudDogdGhpcy5yZXBseUV4Y2VycHQoU3RyaW5nKG1lc3NhZ2UuY29udGVudCB8fCAnJykpLFxyXG4gICAgfTtcclxuICB9XHJcblxyXG4gIHNob3dUb2FzdChtZXNzYWdlOiBzdHJpbmcsIHR5cGU6ICdpbmZvJyB8ICdzdWNjZXNzJyB8ICdlcnJvcicgPSAnaW5mbycsIGR1cmF0aW9uTXMgPSAzMDAwKTogdm9pZCB7XHJcbiAgICBpZiAodGhpcy50b2FzdFRpbWVyKSB7XHJcbiAgICAgIGNsZWFyVGltZW91dCh0aGlzLnRvYXN0VGltZXIpO1xyXG4gICAgICB0aGlzLnRvYXN0VGltZXIgPSBudWxsO1xyXG4gICAgfVxyXG4gICAgdGhpcy50b2FzdCQubmV4dCh7IG1lc3NhZ2UsIHR5cGUgfSk7XHJcbiAgICB0aGlzLnRvYXN0VGltZXIgPSBzZXRUaW1lb3V0KCgpID0+IHtcclxuICAgICAgdGhpcy50b2FzdCQubmV4dChudWxsKTtcclxuICAgICAgdGhpcy50b2FzdFRpbWVyID0gbnVsbDtcclxuICAgIH0sIGR1cmF0aW9uTXMpO1xyXG4gIH1cclxuXHJcbiAgZ2V0U2lkZWJhclNpZGUoKTogU2lkZWJhclNpZGUge1xyXG4gICAgcmV0dXJuIHRoaXMuc2lkZWJhclNpZGUkLnZhbHVlO1xyXG4gIH1cclxuXHJcbiAgc2V0QWN0aXZlRGJHaWQoZGJHaWQ6IHN0cmluZyB8IG51bGwgfCB1bmRlZmluZWQpOiB2b2lkIHtcclxuICAgIGNvbnN0IG5vcm1hbGl6ZWQgPSBTdHJpbmcoZGJHaWQgfHwgJycpLnRyaW0oKSB8fCBudWxsO1xyXG4gICAgaWYgKG5vcm1hbGl6ZWQgPT09IHRoaXMuYWN0aXZlRGJHaWQkLnZhbHVlKSByZXR1cm47XHJcblxyXG4gICAgdGhpcy5hY3RpdmVEYkdpZCQubmV4dChub3JtYWxpemVkKTtcclxuICAgIHRoaXMuYXBpLnNldEFjdGl2ZURiR2lkKG5vcm1hbGl6ZWQpO1xyXG4gICAgdGhpcy5yZW1vdmVQcm9qZWN0Q29udmVyc2F0aW9uc0Zyb21VaSgpO1xyXG5cclxuICAgIGlmICh0aGlzLmF1dGguaXNBdXRoZW50aWNhdGVkKCkpIHtcclxuICAgICAgdGhpcy5sb2FkSW5ib3goKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8vIOKUgOKUgCBJbmJveCDilIDilIBcclxuICBsb2FkSW5ib3goKTogdm9pZCB7XHJcbiAgICBjb25zdCBjb250YWN0SWQgPSB0aGlzLmF1dGguY29udGFjdElkO1xyXG4gICAgaWYgKCFjb250YWN0SWQpIHJldHVybjtcclxuXHJcbiAgICB0aGlzLmFwaS5nZXRJbmJveChjb250YWN0SWQpLnN1YnNjcmliZSh7XHJcbiAgICAgIG5leHQ6IChpdGVtcykgPT4ge1xyXG4gICAgICAgIGNvbnN0IG1hcHBlZCA9IGl0ZW1zLm1hcChpdGVtID0+IHtcclxuICAgICAgICAgIGNvbnN0IGlzR3JvdXAgPSBpdGVtLmlzX2dyb3VwID09PSB0cnVlIHx8IChpdGVtLmlzX2dyb3VwIGFzIGFueSkgPT09ICdUcnVlJztcclxuICAgICAgICAgIGNvbnN0IGlzUHJvamVjdCA9IHRoaXMucHJvamVjdEdyb3Vwc0VuYWJsZWQgJiYgaXNQcm9qZWN0Q29udmVyc2F0aW9uKGl0ZW0pO1xyXG4gICAgICAgICAgY29uc3QgaXNTdWJncm91cCA9IHRoaXMucHJvamVjdEdyb3Vwc0VuYWJsZWQgJiYgaXNQcm9qZWN0U3ViZ3JvdXAoaXRlbSk7XHJcbiAgICAgICAgICBjb25zdCBjb252ZXJzYXRpb25JZCA9IFN0cmluZyhpdGVtLmNvbnZlcnNhdGlvbl9pZCk7XHJcbiAgICAgICAgICBjb25zdCBwcmV2aWV3ID0gdGhpcy5yZXBseUJvZHlUZXh0KGl0ZW0ubGFzdF9tZXNzYWdlX3ByZXZpZXcgfHwgJycpO1xyXG4gICAgICAgICAgY29uc3QgaGFzTWVudGlvbiA9XHJcbiAgICAgICAgICAgIHRoaXMubWVudGlvbkNvbnZlcnNhdGlvbklkcyQudmFsdWUuaGFzKGNvbnZlcnNhdGlvbklkKSB8fFxyXG4gICAgICAgICAgICAoTnVtYmVyKGl0ZW0udW5yZWFkX2NvdW50IHx8IDApID4gMCAmJiB0aGlzLm1lc3NhZ2VUZXh0TWVudGlvbnNDdXJyZW50VXNlcihwcmV2aWV3KSk7XHJcbiAgICAgICAgICBcclxuICAgICAgICAgIGlmICghaXNHcm91cCAmJiAhaXRlbS5uYW1lICYmIGl0ZW0ub3RoZXJfcGFydGljaXBhbnRfbmFtZSkge1xyXG4gICAgICAgICAgICByZXR1cm4geyAuLi5pdGVtLCBuYW1lOiBpdGVtLm90aGVyX3BhcnRpY2lwYW50X25hbWUsIGxhc3RfbWVzc2FnZV9wcmV2aWV3OiBwcmV2aWV3LCBpc19ncm91cDogZmFsc2UsIGlzX3Byb2plY3Q6IGlzUHJvamVjdCwgaXNfcHJvamVjdF9zdWJncm91cDogaXNTdWJncm91cCwgaGFzX21lbnRpb246IGhhc01lbnRpb24gfTtcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIHJldHVybiB7IC4uLml0ZW0sIGxhc3RfbWVzc2FnZV9wcmV2aWV3OiBwcmV2aWV3LCBpc19ncm91cDogaXNHcm91cCwgaXNfcHJvamVjdDogaXNQcm9qZWN0LCBpc19wcm9qZWN0X3N1Ymdyb3VwOiBpc1N1Ymdyb3VwLCBoYXNfbWVudGlvbjogaGFzTWVudGlvbiB9O1xyXG4gICAgICAgIH0pLmZpbHRlcihpdGVtID0+XHJcbiAgICAgICAgICAoIWlzUHJvamVjdENvbnZlcnNhdGlvbihpdGVtKSB8fCB0aGlzLnByb2plY3RHcm91cHNFbmFibGVkKSAmJlxyXG4gICAgICAgICAgIXRoaXMuZGVsZXRpbmdDb252ZXJzYXRpb25JZHMuaGFzKFN0cmluZyhpdGVtLmNvbnZlcnNhdGlvbl9pZCkpICYmXHJcbiAgICAgICAgICAhdGhpcy5yZW1vdmVkR3JvdXBJZHMkLnZhbHVlLmhhcyhTdHJpbmcoaXRlbS5jb252ZXJzYXRpb25faWQpKVxyXG4gICAgICAgICk7XHJcbiAgICAgICAgdGhpcy5pbmJveCQubmV4dChtYXBwZWQpO1xyXG4gICAgICAgIHRoaXMucmVjYWxjVW5yZWFkKG1hcHBlZCk7XHJcblxyXG4gICAgICAgIGNvbnN0IGlkcyA9IG1hcHBlZC5tYXAoKGkpID0+IGkuY29udmVyc2F0aW9uX2lkKTtcclxuICAgICAgICB0aGlzLndzU2VydmljZS5zdWJzY3JpYmVBbGwoaWRzKTtcclxuICAgICAgfSxcclxuICAgICAgZXJyb3I6ICgpID0+IHt9LFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvLyDilIDilIAgQ29udGFjdHMg4pSA4pSAXHJcbiAgbG9hZFZpc2libGVDb250YWN0cygpOiB2b2lkIHtcclxuICAgIGNvbnN0IGNvbnRhY3RJZCA9IHRoaXMuYXV0aC5jb250YWN0SWQ7XHJcbiAgICBpZiAoIWNvbnRhY3RJZCkgcmV0dXJuO1xyXG5cclxuICAgIHRoaXMuYXBpLmdldFZpc2libGVDb250YWN0cyhjb250YWN0SWQpLnN1YnNjcmliZSh7XHJcbiAgICAgIG5leHQ6IChjb250YWN0cykgPT4ge1xyXG4gICAgICAgIHRoaXMudmlzaWJsZUNvbnRhY3RzJC5uZXh0KGNvbnRhY3RzKTtcclxuICAgICAgICBcclxuICAgICAgICBjb25zdCBjdXJyZW50Q29udGFjdCA9IHRoaXMuYXV0aC5jdXJyZW50Q29udGFjdDtcclxuICAgICAgICBpZiAoY3VycmVudENvbnRhY3QgJiYgY3VycmVudENvbnRhY3QuZW1haWwpIHtcclxuICAgICAgICAgIGNvbnN0IG1hdGNoID0gY29udGFjdHMuZmluZChjID0+IGMuZW1haWwgPT09IGN1cnJlbnRDb250YWN0LmVtYWlsKTtcclxuICAgICAgICAgIGlmIChcclxuICAgICAgICAgICAgbWF0Y2ggJiZcclxuICAgICAgICAgICAgU3RyaW5nKG1hdGNoLmNvbnRhY3RfaWQpICE9PSBTdHJpbmcoY3VycmVudENvbnRhY3QuY29udGFjdF9pZClcclxuICAgICAgICAgICkge1xyXG4gICAgICAgICAgICB0aGlzLmF1dGguc2V0U2Vzc2lvbih0aGlzLmF1dGguc2Vzc2lvbkdpZCEsIHsgLi4uY3VycmVudENvbnRhY3QsIGNvbnRhY3RfaWQ6IG1hdGNoLmNvbnRhY3RfaWQgfSk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB0aGlzLndzU2VydmljZS5kaXNjb25uZWN0KCk7XHJcbiAgICAgICAgICAgIHRoaXMud3NTZXJ2aWNlLmNvbm5lY3QobWF0Y2guY29udGFjdF9pZCwgdGhpcy5hdXRoLnNlc3Npb25HaWQhKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgIH0sXHJcbiAgICAgIGVycm9yOiAoKSA9PiB7fSxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLy8g4pSA4pSAIENvbnZlcnNhdGlvbnMg4pSA4pSAXHJcbiAgb3BlbkNvbnZlcnNhdGlvbihcclxuICAgIGNvbnZlcnNhdGlvbklkOiBzdHJpbmcsXHJcbiAgICBuYW1lOiBzdHJpbmcsXHJcbiAgICBpc0dyb3VwID0gZmFsc2UsXHJcbiAgICBpc1Byb2plY3QgPSBmYWxzZSxcclxuICAgIGlzUHJvamVjdFN1Ymdyb3VwID0gZmFsc2UsXHJcbiAgICBkYkdpZD86IHN0cmluZyxcclxuICAgIHByb2plY3RHaWQ/OiBzdHJpbmcsXHJcbiAgICBwYXJlbnRDb252ZXJzYXRpb25JZD86IHN0cmluZyxcclxuICAgIHN1Ymdyb3VwU3ViamVjdD86IHN0cmluZyxcclxuICApOiB2b2lkIHtcclxuICAgIGlmICghY29udmVyc2F0aW9uSWQgfHwgY29udmVyc2F0aW9uSWQgPT09ICd1bmRlZmluZWQnKSB7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIHRoaXMuYWN0aXZlQ29udmVyc2F0aW9uSWQkLm5leHQoY29udmVyc2F0aW9uSWQpO1xyXG4gICAgdGhpcy5hY3RpdmVWaWV3JC5uZXh0KCdjaGF0Jyk7XHJcbiAgICB0aGlzLm9wZW5QYW5lbCgpO1xyXG5cclxuICAgIGNvbnN0IGNoYXRzID0gdGhpcy5vcGVuQ2hhdHMkLnZhbHVlO1xyXG4gICAgaWYgKCFjaGF0cy5maW5kKChjKSA9PiBjLmNvbnZlcnNhdGlvbklkID09PSBjb252ZXJzYXRpb25JZCkpIHtcclxuICAgICAgdGhpcy5vcGVuQ2hhdHMkLm5leHQoW1xyXG4gICAgICAgIC4uLmNoYXRzLFxyXG4gICAgICAgIHtcclxuICAgICAgICAgIGNvbnZlcnNhdGlvbklkLFxyXG4gICAgICAgICAgbmFtZSxcclxuICAgICAgICAgIGlzR3JvdXAsXHJcbiAgICAgICAgICBpc1Byb2plY3QsXHJcbiAgICAgICAgICBpc1Byb2plY3RTdWJncm91cCxcclxuICAgICAgICAgIGRiR2lkLFxyXG4gICAgICAgICAgcHJvamVjdEdpZCxcclxuICAgICAgICAgIHBhcmVudENvbnZlcnNhdGlvbklkLFxyXG4gICAgICAgICAgc3ViZ3JvdXBTdWJqZWN0LFxyXG4gICAgICAgICAgaXNNaW5pbWl6ZWQ6IGZhbHNlLFxyXG4gICAgICAgICAgdW5yZWFkQ291bnQ6IDAsXHJcbiAgICAgICAgfSxcclxuICAgICAgXSk7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgZXhpc3RpbmcgPSB0aGlzLm1lc3NhZ2VzTWFwJC52YWx1ZS5nZXQoY29udmVyc2F0aW9uSWQpO1xyXG4gICAgaWYgKCFleGlzdGluZyB8fCBleGlzdGluZy5sZW5ndGggPT09IDApIHtcclxuICAgICAgdGhpcy5sb2FkTWVzc2FnZXMoY29udmVyc2F0aW9uSWQpO1xyXG4gICAgfVxyXG4gICAgdGhpcy5tYXJrQXNSZWFkKGNvbnZlcnNhdGlvbklkKTtcclxuICAgIHRoaXMud3NTZXJ2aWNlLnN1YnNjcmliZShjb252ZXJzYXRpb25JZCk7XHJcbiAgfVxyXG5cclxuICBjbG9zZUNoYXQoY29udmVyc2F0aW9uSWQ6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgY29uc3QgY2hhdHMgPSB0aGlzLm9wZW5DaGF0cyQudmFsdWUuZmlsdGVyKChjKSA9PiBjLmNvbnZlcnNhdGlvbklkICE9PSBjb252ZXJzYXRpb25JZCk7XHJcbiAgICB0aGlzLm9wZW5DaGF0cyQubmV4dChjaGF0cyk7XHJcblxyXG4gICAgaWYgKFN0cmluZyh0aGlzLmFjdGl2ZUNvbnZlcnNhdGlvbklkJC52YWx1ZSkgPT09IFN0cmluZyhjb252ZXJzYXRpb25JZCkpIHtcclxuICAgICAgdGhpcy5hY3RpdmVDb252ZXJzYXRpb25JZCQubmV4dChudWxsKTtcclxuICAgICAgdGhpcy5hY3RpdmVWaWV3JC5uZXh0KCdpbmJveCcpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgbWFya0dyb3VwUmVtb3ZlZChjb252ZXJzYXRpb25JZDogc3RyaW5nKTogdm9pZCB7XHJcbiAgICBjb25zdCBpZCA9IFN0cmluZyhjb252ZXJzYXRpb25JZCk7XHJcbiAgICBpZiAoIWlkIHx8IGlkID09PSAndW5kZWZpbmVkJykgcmV0dXJuO1xyXG5cclxuICAgIGNvbnN0IG5leHQgPSBuZXcgU2V0KHRoaXMucmVtb3ZlZEdyb3VwSWRzJC52YWx1ZSk7XHJcbiAgICBuZXh0LmFkZChpZCk7XHJcbiAgICB0aGlzLnJlbW92ZWRHcm91cElkcyQubmV4dChuZXh0KTtcclxuXHJcbiAgICBjb25zdCBpdGVtcyA9IHRoaXMuaW5ib3gkLnZhbHVlLmZpbHRlcihpID0+IFN0cmluZyhpLmNvbnZlcnNhdGlvbl9pZCkgIT09IGlkKTtcclxuICAgIHRoaXMuaW5ib3gkLm5leHQoaXRlbXMpO1xyXG4gICAgdGhpcy5yZWNhbGNVbnJlYWQoaXRlbXMpO1xyXG5cclxuICAgIGlmICghdGhpcy5yZW1vdmFsVG9hc3RTaG93bi5oYXMoaWQpKSB7XHJcbiAgICAgIHRoaXMucmVtb3ZhbFRvYXN0U2hvd24uYWRkKGlkKTtcclxuICAgICAgdGhpcy5zaG93VG9hc3QoJ1lvdSB3ZXJlIHJlbW92ZWQgZnJvbSB0aGlzIGdyb3VwJywgJ2luZm8nLCA1MDAwKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIGV4aXRSZW1vdmVkR3JvdXAoY29udmVyc2F0aW9uSWQ6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgY29uc3QgaWQgPSBTdHJpbmcoY29udmVyc2F0aW9uSWQpO1xyXG4gICAgY29uc3QgbmV4dCA9IG5ldyBTZXQodGhpcy5yZW1vdmVkR3JvdXBJZHMkLnZhbHVlKTtcclxuICAgIG5leHQuZGVsZXRlKGlkKTtcclxuICAgIHRoaXMucmVtb3ZlZEdyb3VwSWRzJC5uZXh0KG5leHQpO1xyXG4gICAgdGhpcy5yZW1vdmFsVG9hc3RTaG93bi5kZWxldGUoaWQpO1xyXG4gICAgdGhpcy5yZW1vdmVDb252ZXJzYXRpb25Gcm9tVWkoaWQpO1xyXG4gIH1cclxuXHJcbiAgLy8g4pSA4pSAIE1lc3NhZ2VzIOKUgOKUgFxyXG4gIGxvYWRNZXNzYWdlcyhjb252ZXJzYXRpb25JZDogc3RyaW5nLCBiZWZvcmVNZXNzYWdlSWQ/OiBzdHJpbmcsIHNraXBSZWFjdGlvbkh5ZHJhdGlvbiA9IGZhbHNlKTogdm9pZCB7XHJcbiAgICBpZiAoIWNvbnZlcnNhdGlvbklkIHx8IGNvbnZlcnNhdGlvbklkID09PSAndW5kZWZpbmVkJykge1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICBjb25zdCBjb250YWN0SWQgPSB0aGlzLmF1dGguY29udGFjdElkO1xyXG4gICAgaWYgKCFjb250YWN0SWQpIHJldHVybjtcclxuXHJcbiAgICB0aGlzLmxvYWRpbmdNZXNzYWdlcyQubmV4dCh0cnVlKTtcclxuXHJcbiAgICB0aGlzLmFwaS5nZXRNZXNzYWdlcyhjb252ZXJzYXRpb25JZCwgY29udGFjdElkLCBiZWZvcmVNZXNzYWdlSWQsIDUwKS5zdWJzY3JpYmUoe1xyXG4gICAgICBuZXh0OiAobWVzc2FnZXMpID0+IHtcclxuICAgICAgICBjb25zdCBtYXAgPSBuZXcgTWFwKHRoaXMubWVzc2FnZXNNYXAkLnZhbHVlKTtcclxuICAgICAgICBjb25zdCBleGlzdGluZyA9IG1hcC5nZXQoY29udmVyc2F0aW9uSWQpIHx8IFtdO1xyXG5cclxuICAgICAgICBjb25zdCBub3JtYWxpemVkID0gbWVzc2FnZXMubWFwKChtOiBhbnkpID0+IHRoaXMubm9ybWFsaXplTWVzc2FnZVNoYXBlKG0pKTtcclxuICAgICAgICBjb25zdCBzb3J0ZWQgPSBbLi4ubm9ybWFsaXplZF0uc29ydCgoYSwgYikgPT4gXHJcbiAgICAgICAgICBuZXcgRGF0ZShhLmNyZWF0ZWRfYXQpLmdldFRpbWUoKSAtIG5ldyBEYXRlKGIuY3JlYXRlZF9hdCkuZ2V0VGltZSgpXHJcbiAgICAgICAgKTtcclxuICAgICAgICBzb3J0ZWQuZm9yRWFjaCgobSkgPT4gdGhpcy5kZXRlY3RHcm91cFJlbW92YWxGb3JDdXJyZW50VXNlcihtKSk7XHJcblxyXG4gICAgICAgIGNvbnN0IGV4aXN0aW5nQnlJZCA9IG5ldyBNYXAoZXhpc3RpbmcubWFwKG0gPT4gW1N0cmluZyhtLm1lc3NhZ2VfaWQpLCBtXSkpO1xyXG5cclxuICAgICAgICBpZiAoYmVmb3JlTWVzc2FnZUlkKSB7XHJcbiAgICAgICAgICAvLyBQcmVwZW5kIG9sZGVyIG1lc3NhZ2VzLCBwcmVzZXJ2aW5nIGV4aXN0aW5nIHJlYWN0aW9uc1xyXG4gICAgICAgICAgY29uc3QgbWVyZ2VkID0gWy4uLnNvcnRlZCwgLi4uZXhpc3RpbmddO1xyXG4gICAgICAgICAgbWFwLnNldChjb252ZXJzYXRpb25JZCwgbWVyZ2VkKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgLy8gUmVwbGFjZSB3aXRoIHNlcnZlciBkYXRhIGJ1dCBrZWVwIHRoZSByaWNoZXIgb2YgZXhpc3RpbmcgdnMgc2VydmVyIGF0dGFjaG1lbnRzXHJcbiAgICAgICAgICAvLyAodGhlIG9wdGltaXN0aWMgcGF0aCBtYXkgaGF2ZSBtb3JlIGF0dGFjaG1lbnQgbWV0YWRhdGEgdGhhbiB0aGUgc2VydmVyIGVjaG9lcyBiYWNrKS5cclxuICAgICAgICAgIGNvbnN0IG1lcmdlZCA9IHNvcnRlZC5tYXAobSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnN0IGNhY2hlZCA9IGV4aXN0aW5nQnlJZC5nZXQoU3RyaW5nKG0ubWVzc2FnZV9pZCkpO1xyXG4gICAgICAgICAgICBpZiAoIWNhY2hlZCkgcmV0dXJuIG07XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLm1lcmdlTWVzc2FnZUF0dGFjaG1lbnRzKGNhY2hlZCwgbSk7XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICAgIG1hcC5zZXQoY29udmVyc2F0aW9uSWQsIG1lcmdlZCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aGlzLm1lc3NhZ2VzTWFwJC5uZXh0KG1hcCk7XHJcbiAgICAgICAgdGhpcy5oeWRyYXRlUmVhY3Rpb25zRm9yQ29udmVyc2F0aW9uKFxyXG4gICAgICAgICAgY29udmVyc2F0aW9uSWQsXHJcbiAgICAgICAgICBtYXAuZ2V0KGNvbnZlcnNhdGlvbklkKSB8fCBbXSxcclxuICAgICAgICAgIHNraXBSZWFjdGlvbkh5ZHJhdGlvblxyXG4gICAgICAgICk7XHJcbiAgICAgICAgdGhpcy5sb2FkaW5nTWVzc2FnZXMkLm5leHQoZmFsc2UpO1xyXG4gICAgICB9LFxyXG4gICAgICBlcnJvcjogKCkgPT4ge1xyXG4gICAgICAgIHRoaXMubG9hZGluZ01lc3NhZ2VzJC5uZXh0KGZhbHNlKTtcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgc2VuZE1lc3NhZ2UoXHJcbiAgICBjb252ZXJzYXRpb25JZDogc3RyaW5nIHwgbnVsbCxcclxuICAgIGNvbnRlbnQ6IHN0cmluZyxcclxuICAgIG1lc3NhZ2VUeXBlOiAnVEVYVCcgfCAnSU1BR0UnIHwgJ1NZU1RFTScgPSAnVEVYVCcsXHJcbiAgICBvcHRpb25zPzogeyByZXBseVRvPzogTWVzc2FnZSB8IG51bGw7IG1lbnRpb25zPzogc3RyaW5nW107IGZvcmNlUGxhaW5UZXh0PzogYm9vbGVhbiB9XHJcbiAgKTogdm9pZCB7XHJcbiAgICBjb25zdCBjb250YWN0SWQgPSB0aGlzLmF1dGguY29udGFjdElkO1xyXG4gICAgaWYgKCFjb250YWN0SWQpIHJldHVybjtcclxuXHJcbiAgICBjb25zdCBwZW5kaW5nID0gdGhpcy5wZW5kaW5nRG1SZWNpcGllbnQkLnZhbHVlO1xyXG4gICAgaWYgKCFjb252ZXJzYXRpb25JZCAmJiBwZW5kaW5nKSB7XHJcbiAgICAgIHRoaXMuc2VuZERpcmVjdE1lc3NhZ2UocGVuZGluZy5jb250YWN0SWQsIGNvbnRlbnQpO1xyXG4gICAgICB0aGlzLnBlbmRpbmdEbVJlY2lwaWVudCQubmV4dChudWxsKTtcclxuICAgICAgY29uc3QgY2hhdHMgPSB0aGlzLm9wZW5DaGF0cyQudmFsdWUuZmlsdGVyKGMgPT4gYy5jb252ZXJzYXRpb25JZCAhPT0gJ3BlbmRpbmcnKTtcclxuICAgICAgdGhpcy5vcGVuQ2hhdHMkLm5leHQoY2hhdHMpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKCFjb252ZXJzYXRpb25JZCkgcmV0dXJuO1xyXG5cclxuICAgIGNvbnN0IG91dGdvaW5nQ29udGVudCA9IHRoaXMucHJlcGFyZU91dGdvaW5nTWVzc2FnZUNvbnRlbnQoY29udGVudCwgb3B0aW9ucz8ucmVwbHlUbyB8fCBudWxsLCBvcHRpb25zPy5mb3JjZVBsYWluVGV4dCk7XHJcbiAgICBjb25zdCByZXBseVRvID0gb3B0aW9ucz8ucmVwbHlUbyA/IHRoaXMuY3JlYXRlUmVwbHlQcmV2aWV3KG9wdGlvbnMucmVwbHlUbykgOiB1bmRlZmluZWQ7XHJcbiAgICBjb25zdCB0ZW1wTWVzc2FnZUlkID0gJ3RlbXAtJyArIERhdGUubm93KCk7XHJcbiAgICBjb25zdCBvcHRpbWlzdGljOiBNZXNzYWdlID0ge1xyXG4gICAgICBtZXNzYWdlX2lkOiB0ZW1wTWVzc2FnZUlkLFxyXG4gICAgICBjb252ZXJzYXRpb25faWQ6IGNvbnZlcnNhdGlvbklkLFxyXG4gICAgICBzZW5kZXJfaWQ6IGNvbnRhY3RJZCxcclxuICAgICAgc2VuZGVyX25hbWU6ICdZb3UnLFxyXG4gICAgICBtZXNzYWdlX3R5cGU6IG1lc3NhZ2VUeXBlLFxyXG4gICAgICBjb250ZW50LFxyXG4gICAgICByZXBseV90bzogcmVwbHlUbyxcclxuICAgICAgbWVudGlvbnM6IG9wdGlvbnM/Lm1lbnRpb25zLFxyXG4gICAgICByZW5kZXJfYXNfcGxhaW5fdGV4dDogb3B0aW9ucz8uZm9yY2VQbGFpblRleHQsXHJcbiAgICAgIGNyZWF0ZWRfYXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcclxuICAgICAgaXNfcmVhZDogZmFsc2UsXHJcbiAgICB9O1xyXG4gICAgdGhpcy5hcHBlbmRNZXNzYWdlKG9wdGltaXN0aWMpO1xyXG5cclxuICAgIHRoaXMuYXBpLnNlbmRNZXNzYWdlKGNvbnZlcnNhdGlvbklkLCBjb250YWN0SWQsIG91dGdvaW5nQ29udGVudCwgbWVzc2FnZVR5cGUpLnN1YnNjcmliZSh7XHJcbiAgICAgIG5leHQ6IChyZXMpID0+IHtcclxuICAgICAgICBjb25zdCByZWFsSWQgPSByZXM/Lm1lc3NhZ2VfaWQgPz8gcmVzPy5pZCA/PyByZXM/Lm1lc3NhZ2VJZDtcclxuICAgICAgICBpZiAocmVhbElkID09IG51bGwgfHwgU3RyaW5nKHJlYWxJZCkuc3RhcnRzV2l0aCgndGVtcC0nKSkge1xyXG4gICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgICBjb25zdCBwaWNrZWRDb250ZW50ID0gdGhpcy5jb2FsZXNjZU1lc3NhZ2VUZXh0KHJlcywgb3V0Z29pbmdDb250ZW50IHx8IG9wdGltaXN0aWMuY29udGVudCk7XHJcbiAgICAgICAgY29uc3QgbWVyZ2VkID0gdGhpcy5ub3JtYWxpemVNZXNzYWdlU2hhcGUoe1xyXG4gICAgICAgICAgLi4ub3B0aW1pc3RpYyxcclxuICAgICAgICAgIC4uLnJlcyxcclxuICAgICAgICAgIG1lc3NhZ2VfaWQ6IFN0cmluZyhyZWFsSWQpLFxyXG4gICAgICAgICAgY29udmVyc2F0aW9uX2lkOiBjb252ZXJzYXRpb25JZCxcclxuICAgICAgICAgIG1lc3NhZ2VfdHlwZTogbWVzc2FnZVR5cGUgPT09ICdTWVNURU0nID8gJ1NZU1RFTScgOiByZXM/Lm1lc3NhZ2VfdHlwZSA/PyBvcHRpbWlzdGljLm1lc3NhZ2VfdHlwZSxcclxuICAgICAgICAgIGNvbnRlbnQ6IHBpY2tlZENvbnRlbnQsXHJcbiAgICAgICAgICByZXBseV90bzogcmVwbHlUbyA/PyByZXM/LnJlcGx5X3RvLFxyXG4gICAgICAgICAgbWVudGlvbnM6IG9wdGlvbnM/Lm1lbnRpb25zID8/IHJlcz8ubWVudGlvbnMsXHJcbiAgICAgICAgICByZW5kZXJfYXNfcGxhaW5fdGV4dDogb3B0aW9ucz8uZm9yY2VQbGFpblRleHQsXHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgY29uc3QgbWFwID0gbmV3IE1hcCh0aGlzLm1lc3NhZ2VzTWFwJC52YWx1ZSk7XHJcbiAgICAgICAgY29uc3QgbXNncyA9IFsuLi4obWFwLmdldChjb252ZXJzYXRpb25JZCkgfHwgW10pXTtcclxuICAgICAgICBjb25zdCBpZHggPSBtc2dzLmZpbmRJbmRleCgobSkgPT4gbS5tZXNzYWdlX2lkID09PSB0ZW1wTWVzc2FnZUlkKTtcclxuICAgICAgICBpZiAoaWR4ID49IDApIHtcclxuICAgICAgICAgIG1zZ3NbaWR4XSA9IG1lcmdlZDtcclxuICAgICAgICAgIG1hcC5zZXQoY29udmVyc2F0aW9uSWQsIHRoaXMuZGVkdXBlTWVzc2FnZXNCeUlkS2VlcEZpcnN0KG1zZ3MpKTtcclxuICAgICAgICAgIHRoaXMubWVzc2FnZXNNYXAkLm5leHQobWFwKTtcclxuICAgICAgICAgIHRoaXMucmVmcmVzaE1lc3NhZ2VSZWFjdGlvbnMobWVyZ2VkLm1lc3NhZ2VfaWQpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSxcclxuICAgICAgZXJyb3I6ICgpID0+IHt9LFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBvcGVuRGlyZWN0Q29udmVyc2F0aW9uKHJlY2lwaWVudENvbnRhY3RJZDogc3RyaW5nLCBkaXNwbGF5TmFtZTogc3RyaW5nKTogdm9pZCB7XHJcbiAgICBjb25zdCBleGlzdGluZyA9IHRoaXMuaW5ib3gkLnZhbHVlLmZpbmQoaXRlbSA9PiBcclxuICAgICAgIWl0ZW0uaXNfZ3JvdXAgJiYgaXRlbS5uYW1lID09PSBkaXNwbGF5TmFtZVxyXG4gICAgKTtcclxuICAgIFxyXG4gICAgaWYgKGV4aXN0aW5nKSB7XHJcbiAgICAgIHRoaXMucGVuZGluZ0RtUmVjaXBpZW50JC5uZXh0KG51bGwpO1xyXG4gICAgICB0aGlzLm9wZW5Db252ZXJzYXRpb24oZXhpc3RpbmcuY29udmVyc2F0aW9uX2lkLCBkaXNwbGF5TmFtZSwgZmFsc2UpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgdGhpcy5wZW5kaW5nRG1SZWNpcGllbnQkLm5leHQoe2NvbnRhY3RJZDogcmVjaXBpZW50Q29udGFjdElkLCBuYW1lOiBkaXNwbGF5TmFtZX0pO1xyXG4gICAgICB0aGlzLmFjdGl2ZUNvbnZlcnNhdGlvbklkJC5uZXh0KG51bGwpO1xyXG4gICAgICB0aGlzLmFjdGl2ZVZpZXckLm5leHQoJ2NoYXQnKTtcclxuICAgICAgdGhpcy5vcGVuUGFuZWwoKTtcclxuICAgICAgXHJcbiAgICAgIGNvbnN0IGNoYXRzID0gdGhpcy5vcGVuQ2hhdHMkLnZhbHVlO1xyXG4gICAgICBpZiAoIWNoYXRzLmZpbmQoYyA9PiBjLmNvbnZlcnNhdGlvbklkID09PSAncGVuZGluZycpKSB7XHJcbiAgICAgICAgdGhpcy5vcGVuQ2hhdHMkLm5leHQoWy4uLmNoYXRzLCB7XHJcbiAgICAgICAgICBjb252ZXJzYXRpb25JZDogJ3BlbmRpbmcnLFxyXG4gICAgICAgICAgbmFtZTogZGlzcGxheU5hbWUsXHJcbiAgICAgICAgICBpc0dyb3VwOiBmYWxzZSxcclxuICAgICAgICAgIGlzTWluaW1pemVkOiBmYWxzZSxcclxuICAgICAgICAgIHVucmVhZENvdW50OiAwXHJcbiAgICAgICAgfV0pO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBzZW5kRGlyZWN0TWVzc2FnZShyZWNpcGllbnRDb250YWN0SWQ6IHN0cmluZywgY29udGVudDogc3RyaW5nKTogdm9pZCB7XHJcbiAgICBjb25zdCBjb250YWN0SWQgPSB0aGlzLmF1dGguY29udGFjdElkO1xyXG4gICAgaWYgKCFjb250YWN0SWQpIHJldHVybjtcclxuXHJcbiAgICB0aGlzLmFwaS5zZW5kRGlyZWN0TWVzc2FnZShjb250YWN0SWQsIHJlY2lwaWVudENvbnRhY3RJZCwgY29udGVudCkuc3Vic2NyaWJlKHtcclxuICAgICAgbmV4dDogKHJlcykgPT4ge1xyXG4gICAgICAgIHRoaXMubG9hZEluYm94KCk7XHJcbiAgICAgICAgLy8gQmFja2VuZCBtYXkgcmV0dXJuIGNvbnZlcnNhdGlvbl9pZCwgaWQsIG9yIGNvbnZlcnNhdGlvbklkXHJcbiAgICAgICAgY29uc3QgY29udklkID0gU3RyaW5nKHJlcz8uY29udmVyc2F0aW9uX2lkIHx8IHJlcz8uaWQgfHwgcmVzPy5jb252ZXJzYXRpb25JZCB8fCAnJyk7XHJcbiAgICAgICAgaWYgKGNvbnZJZCkge1xyXG4gICAgICAgICAgY29uc3QgcmVjaXBpZW50ID0gdGhpcy52aXNpYmxlQ29udGFjdHMkLnZhbHVlLmZpbmQoXHJcbiAgICAgICAgICAgIChjKSA9PiBjLmNvbnRhY3RfaWQgPT09IHJlY2lwaWVudENvbnRhY3RJZFxyXG4gICAgICAgICAgKTtcclxuICAgICAgICAgIGNvbnN0IG5hbWUgPSByZWNpcGllbnQgPyBnZXRDb250YWN0RGlzcGxheU5hbWUocmVjaXBpZW50KSA6ICdEaXJlY3QgTWVzc2FnZSc7XHJcbiAgICAgICAgICB0aGlzLm9wZW5Db252ZXJzYXRpb24oY29udklkLCBuYW1lLCBmYWxzZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9LFxyXG4gICAgICBlcnJvcjogKCkgPT4ge30sXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIGNyZWF0ZUdyb3VwQ29udmVyc2F0aW9uKFxyXG4gICAgcGFydGljaXBhbnRJZHM6IHN0cmluZ1tdLFxyXG4gICAgbmFtZTogc3RyaW5nLFxyXG4gICAgY2FsbGJhY2tzPzogeyBzdWNjZXNzPzogKCkgPT4gdm9pZDsgZXJyb3I/OiAoKSA9PiB2b2lkIH1cclxuICApOiB2b2lkIHtcclxuICAgIGNvbnN0IGNvbnRhY3RJZCA9IHRoaXMuYXV0aC5jb250YWN0SWQ7XHJcbiAgICBpZiAoIWNvbnRhY3RJZCkge1xyXG4gICAgICBjYWxsYmFja3M/LmVycm9yPy4oKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGFsbFBhcnRpY2lwYW50cyA9IHBhcnRpY2lwYW50SWRzLmluY2x1ZGVzKGNvbnRhY3RJZClcclxuICAgICAgPyBwYXJ0aWNpcGFudElkc1xyXG4gICAgICA6IFtjb250YWN0SWQsIC4uLnBhcnRpY2lwYW50SWRzXTtcclxuXHJcbiAgICB0aGlzLmFwaS5jcmVhdGVDb252ZXJzYXRpb24oY29udGFjdElkLCBhbGxQYXJ0aWNpcGFudHMsIG5hbWUpLnN1YnNjcmliZSh7XHJcbiAgICAgIG5leHQ6IChjb252KSA9PiB7XHJcbiAgICAgICAgLy8gQmFja2VuZCBtYXkgcmV0dXJuIGNvbnZlcnNhdGlvbl9pZCwgaWQsIG9yIGNvbnZlcnNhdGlvbklkXHJcbiAgICAgICAgY29uc3QgY29udklkID0gU3RyaW5nKFxyXG4gICAgICAgICAgdHlwZW9mIGNvbnYgPT09ICdzdHJpbmcnIHx8IHR5cGVvZiBjb252ID09PSAnbnVtYmVyJ1xyXG4gICAgICAgICAgICA/IGNvbnZcclxuICAgICAgICAgICAgOiAoY29udiBhcyBhbnkpPy5jb252ZXJzYXRpb25faWQgfHwgKGNvbnYgYXMgYW55KT8uaWQgfHwgKGNvbnYgYXMgYW55KT8uY29udmVyc2F0aW9uSWQgfHwgJydcclxuICAgICAgICApO1xyXG4gICAgICAgIGlmICghY29udklkKSB7XHJcbiAgICAgICAgICB0aGlzLmxvYWRJbmJveCgpO1xyXG4gICAgICAgICAgY2FsbGJhY2tzPy5lcnJvcj8uKCk7XHJcbiAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMubG9hZEluYm94KCk7XHJcbiAgICAgICAgdGhpcy5jbGVhckdyb3VwU2V0dGluZ3MoKTtcclxuICAgICAgICB0aGlzLm9wZW5Db252ZXJzYXRpb24oY29udklkLCBuYW1lLCB0cnVlKTtcclxuICAgICAgICBjYWxsYmFja3M/LnN1Y2Nlc3M/LigpO1xyXG4gICAgICB9LFxyXG4gICAgICBlcnJvcjogKCkgPT4ge1xyXG4gICAgICAgIGNhbGxiYWNrcz8uZXJyb3I/LigpO1xyXG4gICAgICB9LFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBvcGVuR3JvdXBTZXR0aW5ncyhcclxuICAgIGNvbnZlcnNhdGlvbklkOiBzdHJpbmcsXHJcbiAgICBuYW1lOiBzdHJpbmcsXHJcbiAgICBpc1Byb2plY3QgPSBmYWxzZSxcclxuICAgIGlzUHJvamVjdFN1Ymdyb3VwID0gZmFsc2UsXHJcbiAgICBkYkdpZD86IHN0cmluZyxcclxuICAgIHByb2plY3RHaWQ/OiBzdHJpbmcsXHJcbiAgICBwYXJlbnRDb252ZXJzYXRpb25JZD86IHN0cmluZyxcclxuICAgIHN1YmplY3Q/OiBzdHJpbmcsXHJcbiAgKTogdm9pZCB7XHJcbiAgICB0aGlzLmdyb3VwU2V0dGluZ3MkLm5leHQoe1xyXG4gICAgICBjb252ZXJzYXRpb25JZCxcclxuICAgICAgbmFtZSxcclxuICAgICAgaXNQcm9qZWN0LFxyXG4gICAgICBpc1Byb2plY3RTdWJncm91cCxcclxuICAgICAgZGJHaWQsXHJcbiAgICAgIHByb2plY3RHaWQsXHJcbiAgICAgIHBhcmVudENvbnZlcnNhdGlvbklkLFxyXG4gICAgICBzdWJqZWN0LFxyXG4gICAgfSk7XHJcbiAgICB0aGlzLnNldFZpZXcoJ2dyb3VwLW1hbmFnZXInKTtcclxuICB9XHJcblxyXG4gIG9wZW5Qcm9qZWN0U3ViZ3JvdXBDcmVhdG9yKHBhcmVudDogSW5ib3hJdGVtKTogdm9pZCB7XHJcbiAgICBpZiAoIXRoaXMucHJvamVjdEdyb3Vwc0VuYWJsZWQgfHwgIWlzUHJvamVjdENvbnRhaW5lcihwYXJlbnQpKSByZXR1cm47XHJcbiAgICB0aGlzLmdyb3VwU2V0dGluZ3MkLm5leHQoe1xyXG4gICAgICBjb252ZXJzYXRpb25JZDogU3RyaW5nKHBhcmVudC5jb252ZXJzYXRpb25faWQpLFxyXG4gICAgICBuYW1lOiAnJyxcclxuICAgICAgaXNQcm9qZWN0OiB0cnVlLFxyXG4gICAgICBpc1Byb2plY3RTdWJncm91cDogdHJ1ZSxcclxuICAgICAgaXNQcm9qZWN0U3ViZ3JvdXBDcmVhdGU6IHRydWUsXHJcbiAgICAgIGRiR2lkOiBwYXJlbnQuZGJfZ2lkLFxyXG4gICAgICBwcm9qZWN0R2lkOiBwYXJlbnQucHJvamVjdF9naWQsXHJcbiAgICAgIHBhcmVudENvbnZlcnNhdGlvbklkOiBTdHJpbmcocGFyZW50LmNvbnZlcnNhdGlvbl9pZCksXHJcbiAgICB9KTtcclxuICAgIHRoaXMuc2V0VmlldygnZ3JvdXAtbWFuYWdlcicpO1xyXG4gICAgdGhpcy5vcGVuUGFuZWwoKTtcclxuICB9XHJcblxyXG4gIGNsZWFyR3JvdXBTZXR0aW5ncygpOiB2b2lkIHtcclxuICAgIHRoaXMuZ3JvdXBTZXR0aW5ncyQubmV4dChudWxsKTtcclxuICB9XHJcblxyXG4gIG1hcmtBc1JlYWQoY29udmVyc2F0aW9uSWQ6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgaWYgKCFjb252ZXJzYXRpb25JZCB8fCBjb252ZXJzYXRpb25JZCA9PT0gJ3VuZGVmaW5lZCcpIHJldHVybjtcclxuICAgIGNvbnN0IGNvbnRhY3RJZCA9IHRoaXMuYXV0aC5jb250YWN0SWQ7XHJcbiAgICBpZiAoIWNvbnRhY3RJZCkgcmV0dXJuO1xyXG5cclxuICAgIHRoaXMuYXBpLm1hcmtDb252ZXJzYXRpb25SZWFkKGNvbnZlcnNhdGlvbklkLCBjb250YWN0SWQpLnN1YnNjcmliZSh7XHJcbiAgICAgIG5leHQ6ICgpID0+IHtcclxuICAgICAgICBjb25zdCBpdGVtcyA9IHRoaXMuaW5ib3gkLnZhbHVlLm1hcCgoaXRlbSkgPT5cclxuICAgICAgICAgIGl0ZW0uY29udmVyc2F0aW9uX2lkID09PSBjb252ZXJzYXRpb25JZCA/IHsgLi4uaXRlbSwgdW5yZWFkX2NvdW50OiAwLCBoYXNfbWVudGlvbjogZmFsc2UgfSA6IGl0ZW1cclxuICAgICAgICApO1xyXG4gICAgICAgIHRoaXMuaW5ib3gkLm5leHQoaXRlbXMpO1xyXG4gICAgICAgIHRoaXMucmVjYWxjVW5yZWFkKGl0ZW1zKTtcclxuICAgICAgICB0aGlzLnNldENvbnZlcnNhdGlvbk1lbnRpb24oY29udmVyc2F0aW9uSWQsIGZhbHNlKTtcclxuICAgICAgfSxcclxuICAgICAgZXJyb3I6ICgpID0+IHt9LFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvLyDilIDilIAgR3JvdXAgbWFuYWdlbWVudCDilIDilIBcclxuICBtYW5hZ2VHcm91cChcclxuICAgIGFjdGlvbjogJ2NyZWF0ZScgfCAnYWRkJyB8ICdyZW1vdmUnIHwgJ3JlbmFtZScsXHJcbiAgICBjb252ZXJzYXRpb25JZD86IHN0cmluZyxcclxuICAgIGdyb3VwTmFtZT86IHN0cmluZyxcclxuICAgIHBhcnRpY2lwYW50Q29udGFjdElkcz86IHN0cmluZ1tdLFxyXG4gICAgY2FsbGJhY2tzPzogeyBzdWNjZXNzPzogKCkgPT4gdm9pZDsgZXJyb3I/OiAoKSA9PiB2b2lkIH1cclxuICApOiB2b2lkIHtcclxuICAgIGNvbnN0IGNvbnRhY3RJZCA9IHRoaXMuYXV0aC5jb250YWN0SWQ7XHJcbiAgICBpZiAoIWNvbnRhY3RJZCkge1xyXG4gICAgICBjYWxsYmFja3M/LmVycm9yPy4oKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIGlmIChhY3Rpb24gPT09ICdyZW1vdmUnICYmIGNvbnZlcnNhdGlvbklkICYmIHBhcnRpY2lwYW50Q29udGFjdElkcz8ubGVuZ3RoKSB7XHJcbiAgICAgIGNvbnN0IGFjdG9yTmFtZSA9IHRoaXMuZ2V0Q29udGFjdE5hbWVCeUlkKGNvbnRhY3RJZCk7XHJcbiAgICAgIGNvbnN0IG5vdGljZUpvYnMgPSBwYXJ0aWNpcGFudENvbnRhY3RJZHMubWFwKChpZCkgPT5cclxuICAgICAgICB0aGlzLmFwaS5zZW5kTWVzc2FnZShcclxuICAgICAgICAgIGNvbnZlcnNhdGlvbklkLFxyXG4gICAgICAgICAgY29udGFjdElkLFxyXG4gICAgICAgICAgYCR7YWN0b3JOYW1lfSByZW1vdmVkICR7dGhpcy5nZXRDb250YWN0TmFtZUJ5SWQoaWQpfSBmcm9tIHRoZSBncm91cGAsXHJcbiAgICAgICAgICAnU1lTVEVNJ1xyXG4gICAgICAgICkucGlwZShjYXRjaEVycm9yKCgpID0+IG9mKG51bGwpKSlcclxuICAgICAgKTtcclxuICAgICAgY29uc3QgcmVtb3ZlSm9icyA9IHBhcnRpY2lwYW50Q29udGFjdElkcy5tYXAoKGlkKSA9PlxyXG4gICAgICAgIHRoaXMuYXBpLm1hbmFnZUdyb3VwKGlkLCBhY3Rpb24sIGNvbnZlcnNhdGlvbklkLCBncm91cE5hbWUpXHJcbiAgICAgICk7XHJcblxyXG4gICAgICBmb3JrSm9pbihub3RpY2VKb2JzKS5zdWJzY3JpYmUoe1xyXG4gICAgICAgIG5leHQ6ICgpID0+IHtcclxuICAgICAgICAgIGZvcmtKb2luKHJlbW92ZUpvYnMpLnN1YnNjcmliZSh7XHJcbiAgICAgICAgICAgIG5leHQ6ICgpID0+IHtcclxuICAgICAgICAgICAgICB0aGlzLmxvYWRJbmJveCgpO1xyXG4gICAgICAgICAgICAgIHRoaXMubm90aWZ5R3JvdXBNZW1iZXJzaGlwQ2hhbmdlZCgpO1xyXG4gICAgICAgICAgICAgIGNhbGxiYWNrcz8uc3VjY2Vzcz8uKCk7XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIGVycm9yOiAoKSA9PiB7XHJcbiAgICAgICAgICAgICAgY2FsbGJhY2tzPy5lcnJvcj8uKCk7XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGVycm9yOiAoKSA9PiB7XHJcbiAgICAgICAgICBjYWxsYmFja3M/LmVycm9yPy4oKTtcclxuICAgICAgICB9LFxyXG4gICAgICB9KTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuYXBpLm1hbmFnZUdyb3VwKGNvbnRhY3RJZCwgYWN0aW9uLCBjb252ZXJzYXRpb25JZCwgZ3JvdXBOYW1lLCBwYXJ0aWNpcGFudENvbnRhY3RJZHMpLnN1YnNjcmliZSh7XHJcbiAgICAgIG5leHQ6ICgpID0+IHtcclxuICAgICAgICB0aGlzLmxvYWRJbmJveCgpO1xyXG4gICAgICAgIGlmIChhY3Rpb24gPT09ICdhZGQnICYmIGNvbnZlcnNhdGlvbklkICYmIHBhcnRpY2lwYW50Q29udGFjdElkcz8ubGVuZ3RoKSB7XHJcbiAgICAgICAgICB0aGlzLm5vdGlmeUdyb3VwTWVtYmVyc2hpcENoYW5nZWQoKTtcclxuICAgICAgICAgIGNvbnN0IGFkZGVkTmFtZXMgPSBwYXJ0aWNpcGFudENvbnRhY3RJZHMubWFwKChpZCkgPT4gdGhpcy5nZXRDb250YWN0TmFtZUJ5SWQoaWQpKTtcclxuICAgICAgICAgIGNvbnN0IHRleHQgPSBgJHt0aGlzLmdldENvbnRhY3ROYW1lQnlJZChjb250YWN0SWQpfSBhZGRlZCAke2FkZGVkTmFtZXMuam9pbignLCAnKX0gdG8gdGhlIGdyb3VwYDtcclxuICAgICAgICAgIHRoaXMuc2VuZE1lc3NhZ2UoY29udmVyc2F0aW9uSWQsIHRleHQsICdTWVNURU0nKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgY2FsbGJhY2tzPy5zdWNjZXNzPy4oKTtcclxuICAgICAgfSxcclxuICAgICAgZXJyb3I6ICgpID0+IHtcclxuICAgICAgICBjYWxsYmFja3M/LmVycm9yPy4oKTtcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgc2V0R3JvdXBBZG1pbihcclxuICAgIGNvbnZlcnNhdGlvbklkOiBzdHJpbmcsXHJcbiAgICB0YXJnZXRDb250YWN0SWQ6IHN0cmluZyxcclxuICAgIGlzQWRtaW46IGJvb2xlYW4sXHJcbiAgICBjYWxsYmFja3M/OiB7IHN1Y2Nlc3M/OiAoKSA9PiB2b2lkOyBlcnJvcj86ICgpID0+IHZvaWQgfVxyXG4gICk6IHZvaWQge1xyXG4gICAgaWYgKCF0aGlzLmF1dGguY29udGFjdElkKSB7XHJcbiAgICAgIGNhbGxiYWNrcz8uZXJyb3I/LigpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5hcGkuc2V0R3JvdXBBZG1pbihjb252ZXJzYXRpb25JZCwgdGFyZ2V0Q29udGFjdElkLCBpc0FkbWluKS5zdWJzY3JpYmUoe1xyXG4gICAgICBuZXh0OiAoKSA9PiB7XHJcbiAgICAgICAgdGhpcy5sb2FkSW5ib3goKTtcclxuICAgICAgICB0aGlzLm5vdGlmeUdyb3VwTWVtYmVyc2hpcENoYW5nZWQoKTtcclxuICAgICAgICBjYWxsYmFja3M/LnN1Y2Nlc3M/LigpO1xyXG4gICAgICB9LFxyXG4gICAgICBlcnJvcjogKCkgPT4gY2FsbGJhY2tzPy5lcnJvcj8uKCksXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIGNyZWF0ZVByb2plY3RTdWJncm91cChcclxuICAgIHBhcmVudENvbnZlcnNhdGlvbklkOiBzdHJpbmcsXHJcbiAgICBuYW1lOiBzdHJpbmcsXHJcbiAgICBzdWJqZWN0OiBzdHJpbmcgfCBudWxsIHwgdW5kZWZpbmVkLFxyXG4gICAgcGFydGljaXBhbnRJZHM6IHN0cmluZ1tdLFxyXG4gICAgY2FsbGJhY2tzPzogeyBzdWNjZXNzPzogKCkgPT4gdm9pZDsgZXJyb3I/OiAoKSA9PiB2b2lkIH1cclxuICApOiB2b2lkIHtcclxuICAgIHRoaXMuYXBpLmNyZWF0ZVByb2plY3RTdWJncm91cChwYXJlbnRDb252ZXJzYXRpb25JZCwge1xyXG4gICAgICBuYW1lLFxyXG4gICAgICBzdWJqZWN0OiBzdWJqZWN0IHx8IG51bGwsXHJcbiAgICAgIHBhcnRpY2lwYW50X2lkczogcGFydGljaXBhbnRJZHMsXHJcbiAgICB9KS5zdWJzY3JpYmUoe1xyXG4gICAgICBuZXh0OiAoc3ViZ3JvdXApID0+IHtcclxuICAgICAgICBjb25zdCBjb252SWQgPSBTdHJpbmcoc3ViZ3JvdXA/LmNvbnZlcnNhdGlvbl9pZCB8fCBzdWJncm91cD8uaWQgfHwgJycpO1xyXG4gICAgICAgIHRoaXMubG9hZEluYm94KCk7XHJcbiAgICAgICAgdGhpcy5jbGVhckdyb3VwU2V0dGluZ3MoKTtcclxuICAgICAgICBpZiAoY29udklkKSB7XHJcbiAgICAgICAgICB0aGlzLm9wZW5Db252ZXJzYXRpb24oXHJcbiAgICAgICAgICAgIGNvbnZJZCxcclxuICAgICAgICAgICAgc3ViZ3JvdXA/Lm5hbWUgfHwgbmFtZSxcclxuICAgICAgICAgICAgdHJ1ZSxcclxuICAgICAgICAgICAgdHJ1ZSxcclxuICAgICAgICAgICAgdHJ1ZSxcclxuICAgICAgICAgICAgc3ViZ3JvdXA/LmRiX2dpZCxcclxuICAgICAgICAgICAgc3ViZ3JvdXA/LnByb2plY3RfZ2lkLFxyXG4gICAgICAgICAgICBzdWJncm91cD8ucGFyZW50X2NvbnZlcnNhdGlvbl9pZCB8fCBwYXJlbnRDb252ZXJzYXRpb25JZCxcclxuICAgICAgICAgICAgc3ViZ3JvdXA/LnN1YmplY3QgfHwgc3ViamVjdCB8fCB1bmRlZmluZWQsXHJcbiAgICAgICAgICApO1xyXG4gICAgICAgIH1cclxuICAgICAgICBjYWxsYmFja3M/LnN1Y2Nlc3M/LigpO1xyXG4gICAgICB9LFxyXG4gICAgICBlcnJvcjogKCkgPT4gY2FsbGJhY2tzPy5lcnJvcj8uKCksXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHVwZGF0ZVByb2plY3RTdWJncm91cChcclxuICAgIGNvbnZlcnNhdGlvbklkOiBzdHJpbmcsXHJcbiAgICBuYW1lOiBzdHJpbmcsXHJcbiAgICBzdWJqZWN0OiBzdHJpbmcgfCBudWxsIHwgdW5kZWZpbmVkLFxyXG4gICAgY2FsbGJhY2tzPzogeyBzdWNjZXNzPzogKCkgPT4gdm9pZDsgZXJyb3I/OiAoKSA9PiB2b2lkIH1cclxuICApOiB2b2lkIHtcclxuICAgIHRoaXMuYXBpLnVwZGF0ZVByb2plY3RTdWJncm91cChjb252ZXJzYXRpb25JZCwgeyBuYW1lLCBzdWJqZWN0OiBzdWJqZWN0IHx8IG51bGwgfSkuc3Vic2NyaWJlKHtcclxuICAgICAgbmV4dDogKHN1Ymdyb3VwKSA9PiB7XHJcbiAgICAgICAgY29uc3QgdXBkYXRlZE5hbWUgPSBzdWJncm91cD8ubmFtZSB8fCBuYW1lO1xyXG4gICAgICAgIHRoaXMub3BlbkNoYXRzJC5uZXh0KHRoaXMub3BlbkNoYXRzJC52YWx1ZS5tYXAoKGNoYXQpID0+XHJcbiAgICAgICAgICBTdHJpbmcoY2hhdC5jb252ZXJzYXRpb25JZCkgPT09IFN0cmluZyhjb252ZXJzYXRpb25JZClcclxuICAgICAgICAgICAgPyB7IC4uLmNoYXQsIG5hbWU6IHVwZGF0ZWROYW1lLCBzdWJncm91cFN1YmplY3Q6IHN1Ymdyb3VwPy5zdWJqZWN0IHx8IHN1YmplY3QgfHwgdW5kZWZpbmVkIH1cclxuICAgICAgICAgICAgOiBjaGF0XHJcbiAgICAgICAgKSk7XHJcbiAgICAgICAgdGhpcy5sb2FkSW5ib3goKTtcclxuICAgICAgICB0aGlzLm5vdGlmeUdyb3VwTWVtYmVyc2hpcENoYW5nZWQoKTtcclxuICAgICAgICBjYWxsYmFja3M/LnN1Y2Nlc3M/LigpO1xyXG4gICAgICB9LFxyXG4gICAgICBlcnJvcjogKCkgPT4gY2FsbGJhY2tzPy5lcnJvcj8uKCksXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8vIOKUgOKUgCBEZWxldGUgLyBDbGVhciDilIDilIBcclxuICBkZWxldGVDb252ZXJzYXRpb24oY29udmVyc2F0aW9uSWQ6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgY29uc3QgY29udGFjdElkID0gdGhpcy5hdXRoLmNvbnRhY3RJZDtcclxuICAgIGlmICghY29udGFjdElkKSByZXR1cm47XHJcblxyXG4gICAgdGhpcy5hcGkuZGVsZXRlQ29udmVyc2F0aW9uKGNvbnZlcnNhdGlvbklkLCBjb250YWN0SWQpLnN1YnNjcmliZSh7XHJcbiAgICAgIG5leHQ6ICgpID0+IHtcclxuICAgICAgICBjb25zdCBpdGVtcyA9IHRoaXMuaW5ib3gkLnZhbHVlLmZpbHRlcihpID0+IGkuY29udmVyc2F0aW9uX2lkICE9PSBjb252ZXJzYXRpb25JZCk7XHJcbiAgICAgICAgdGhpcy5pbmJveCQubmV4dChpdGVtcyk7XHJcbiAgICAgICAgdGhpcy5yZWNhbGNVbnJlYWQoaXRlbXMpO1xyXG4gICAgICAgIGNvbnN0IG1hcCA9IG5ldyBNYXAodGhpcy5tZXNzYWdlc01hcCQudmFsdWUpO1xyXG4gICAgICAgIG1hcC5kZWxldGUoY29udmVyc2F0aW9uSWQpO1xyXG4gICAgICAgIHRoaXMubWVzc2FnZXNNYXAkLm5leHQobWFwKTtcclxuICAgICAgICBpZiAodGhpcy5hY3RpdmVDb252ZXJzYXRpb25JZCQudmFsdWUgPT09IGNvbnZlcnNhdGlvbklkKSB7XHJcbiAgICAgICAgICB0aGlzLmFjdGl2ZUNvbnZlcnNhdGlvbklkJC5uZXh0KG51bGwpO1xyXG4gICAgICAgICAgdGhpcy5hY3RpdmVWaWV3JC5uZXh0KCdpbmJveCcpO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLmNsb3NlQ2hhdChjb252ZXJzYXRpb25JZCk7XHJcbiAgICAgIH0sXHJcbiAgICAgIGVycm9yOiAoKSA9PiB7fSxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgY2xlYXJDb252ZXJzYXRpb24oY29udmVyc2F0aW9uSWQ6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgY29uc3QgY29udGFjdElkID0gdGhpcy5hdXRoLmNvbnRhY3RJZDtcclxuICAgIGlmICghY29udGFjdElkKSByZXR1cm47XHJcblxyXG4gICAgdGhpcy5hcGkuY2xlYXJDb252ZXJzYXRpb24oY29udmVyc2F0aW9uSWQsIGNvbnRhY3RJZCkuc3Vic2NyaWJlKHtcclxuICAgICAgbmV4dDogKCkgPT4ge1xyXG4gICAgICAgIGNvbnN0IG1hcCA9IG5ldyBNYXAodGhpcy5tZXNzYWdlc01hcCQudmFsdWUpO1xyXG4gICAgICAgIG1hcC5zZXQoY29udmVyc2F0aW9uSWQsIFtdKTtcclxuICAgICAgICB0aGlzLm1lc3NhZ2VzTWFwJC5uZXh0KG1hcCk7XHJcbiAgICAgICAgY29uc3QgaXRlbXMgPSB0aGlzLmluYm94JC52YWx1ZS5tYXAoaSA9PlxyXG4gICAgICAgICAgaS5jb252ZXJzYXRpb25faWQgPT09IGNvbnZlcnNhdGlvbklkXHJcbiAgICAgICAgICAgID8geyAuLi5pLCBsYXN0X21lc3NhZ2VfcHJldmlldzogJycsIGxhc3RfbWVzc2FnZV9hdDogaS5sYXN0X21lc3NhZ2VfYXQgfVxyXG4gICAgICAgICAgICA6IGlcclxuICAgICAgICApO1xyXG4gICAgICAgIHRoaXMuaW5ib3gkLm5leHQoaXRlbXMpO1xyXG4gICAgICB9LFxyXG4gICAgICBlcnJvcjogKCkgPT4ge30sXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIGRlbGV0ZUdyb3VwKGNvbnZlcnNhdGlvbklkOiBzdHJpbmcsIGNhbGxiYWNrcz86IHsgc3VjY2Vzcz86ICgpID0+IHZvaWQ7IGVycm9yPzogKCkgPT4gdm9pZCB9KTogdm9pZCB7XHJcbiAgICBjb25zdCBjb250YWN0SWQgPSB0aGlzLmF1dGguY29udGFjdElkO1xyXG4gICAgaWYgKCFjb250YWN0SWQgfHwgdGhpcy5kZWxldGluZ0NvbnZlcnNhdGlvbklkcy5oYXMoY29udmVyc2F0aW9uSWQpKSB7XHJcbiAgICAgIGNhbGxiYWNrcz8uZXJyb3I/LigpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgcHJldmlvdXNJbmJveCA9IHRoaXMuaW5ib3gkLnZhbHVlO1xyXG4gICAgY29uc3QgcHJldmlvdXNNZXNzYWdlc01hcCA9IG5ldyBNYXAodGhpcy5tZXNzYWdlc01hcCQudmFsdWUpO1xyXG4gICAgY29uc3QgcHJldmlvdXNPcGVuQ2hhdHMgPSB0aGlzLm9wZW5DaGF0cyQudmFsdWU7XHJcbiAgICBjb25zdCBwcmV2aW91c0FjdGl2ZUNvbnZlcnNhdGlvbklkID0gdGhpcy5hY3RpdmVDb252ZXJzYXRpb25JZCQudmFsdWU7XHJcbiAgICBjb25zdCBwcmV2aW91c0FjdGl2ZVZpZXcgPSB0aGlzLmFjdGl2ZVZpZXckLnZhbHVlO1xyXG4gICAgY29uc3QgcHJldmlvdXNHcm91cFNldHRpbmdzID0gdGhpcy5ncm91cFNldHRpbmdzJC52YWx1ZTtcclxuXHJcbiAgICB0aGlzLmRlbGV0aW5nQ29udmVyc2F0aW9uSWRzLmFkZChjb252ZXJzYXRpb25JZCk7XHJcbiAgICB0aGlzLnNob3dUb2FzdCgnRXhpdGluZyBncm91cC4uLicsICdpbmZvJywgMTUwMCk7XHJcbiAgICB0aGlzLnJlbW92ZUNvbnZlcnNhdGlvbkZyb21VaShjb252ZXJzYXRpb25JZCk7XHJcblxyXG4gICAgdGhpcy5hcGkuZGVsZXRlR3JvdXAoY29udmVyc2F0aW9uSWQsIGNvbnRhY3RJZCkuc3Vic2NyaWJlKHtcclxuICAgICAgbmV4dDogKCkgPT4ge1xyXG4gICAgICAgIHRoaXMuZGVsZXRpbmdDb252ZXJzYXRpb25JZHMuZGVsZXRlKGNvbnZlcnNhdGlvbklkKTtcclxuICAgICAgICB0aGlzLnNob3dUb2FzdCgnRXhpdGVkIGdyb3VwJywgJ3N1Y2Nlc3MnKTtcclxuICAgICAgICBjYWxsYmFja3M/LnN1Y2Nlc3M/LigpO1xyXG4gICAgICB9LFxyXG4gICAgICBlcnJvcjogKCkgPT4ge1xyXG4gICAgICAgIHRoaXMuZGVsZXRpbmdDb252ZXJzYXRpb25JZHMuZGVsZXRlKGNvbnZlcnNhdGlvbklkKTtcclxuICAgICAgICB0aGlzLmluYm94JC5uZXh0KHByZXZpb3VzSW5ib3gpO1xyXG4gICAgICAgIHRoaXMucmVjYWxjVW5yZWFkKHByZXZpb3VzSW5ib3gpO1xyXG4gICAgICAgIHRoaXMubWVzc2FnZXNNYXAkLm5leHQocHJldmlvdXNNZXNzYWdlc01hcCk7XHJcbiAgICAgICAgdGhpcy5vcGVuQ2hhdHMkLm5leHQocHJldmlvdXNPcGVuQ2hhdHMpO1xyXG4gICAgICAgIHRoaXMuZ3JvdXBTZXR0aW5ncyQubmV4dChwcmV2aW91c0dyb3VwU2V0dGluZ3MpO1xyXG4gICAgICAgIHRoaXMuYWN0aXZlQ29udmVyc2F0aW9uSWQkLm5leHQocHJldmlvdXNBY3RpdmVDb252ZXJzYXRpb25JZCk7XHJcbiAgICAgICAgdGhpcy5hY3RpdmVWaWV3JC5uZXh0KHByZXZpb3VzQWN0aXZlVmlldyk7XHJcbiAgICAgICAgdGhpcy5zaG93VG9hc3QoJ0NvdWxkIG5vdCBleGl0IGdyb3VwJywgJ2Vycm9yJyk7XHJcbiAgICAgICAgY2FsbGJhY2tzPy5lcnJvcj8uKCk7XHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgcmVtb3ZlQ29udmVyc2F0aW9uRnJvbVVpKGNvbnZlcnNhdGlvbklkOiBzdHJpbmcpOiB2b2lkIHtcclxuICAgIGNvbnN0IGl0ZW1zID0gdGhpcy5pbmJveCQudmFsdWUuZmlsdGVyKGkgPT4gU3RyaW5nKGkuY29udmVyc2F0aW9uX2lkKSAhPT0gU3RyaW5nKGNvbnZlcnNhdGlvbklkKSk7XHJcbiAgICB0aGlzLmluYm94JC5uZXh0KGl0ZW1zKTtcclxuICAgIHRoaXMucmVjYWxjVW5yZWFkKGl0ZW1zKTtcclxuXHJcbiAgICBjb25zdCBtYXAgPSBuZXcgTWFwKHRoaXMubWVzc2FnZXNNYXAkLnZhbHVlKTtcclxuICAgIG1hcC5kZWxldGUoY29udmVyc2F0aW9uSWQpO1xyXG4gICAgdGhpcy5tZXNzYWdlc01hcCQubmV4dChtYXApO1xyXG5cclxuICAgIHRoaXMub3BlbkNoYXRzJC5uZXh0KHRoaXMub3BlbkNoYXRzJC52YWx1ZS5maWx0ZXIoYyA9PiBTdHJpbmcoYy5jb252ZXJzYXRpb25JZCkgIT09IFN0cmluZyhjb252ZXJzYXRpb25JZCkpKTtcclxuICAgIGlmIChTdHJpbmcodGhpcy5hY3RpdmVDb252ZXJzYXRpb25JZCQudmFsdWUpID09PSBTdHJpbmcoY29udmVyc2F0aW9uSWQpKSB7XHJcbiAgICAgIHRoaXMuYWN0aXZlQ29udmVyc2F0aW9uSWQkLm5leHQobnVsbCk7XHJcbiAgICAgIHRoaXMuYWN0aXZlVmlldyQubmV4dCgnaW5ib3gnKTtcclxuICAgIH1cclxuICAgIGNvbnN0IHNldHRpbmdzID0gdGhpcy5ncm91cFNldHRpbmdzJC52YWx1ZTtcclxuICAgIGlmIChzZXR0aW5ncz8uY29udmVyc2F0aW9uSWQgPT09IGNvbnZlcnNhdGlvbklkKSB7XHJcbiAgICAgIHRoaXMuY2xlYXJHcm91cFNldHRpbmdzKCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHJlbW92ZVByb2plY3RDb252ZXJzYXRpb25zRnJvbVVpKCk6IHZvaWQge1xyXG4gICAgY29uc3QgcHJvamVjdElkcyA9IG5ldyBTZXQoXHJcbiAgICAgIHRoaXMuaW5ib3gkLnZhbHVlXHJcbiAgICAgICAgLmZpbHRlcigoaXRlbSkgPT4gaXNQcm9qZWN0Q29udmVyc2F0aW9uKGl0ZW0pKVxyXG4gICAgICAgIC5tYXAoKGl0ZW0pID0+IFN0cmluZyhpdGVtLmNvbnZlcnNhdGlvbl9pZCkpXHJcbiAgICApO1xyXG4gICAgdGhpcy5vcGVuQ2hhdHMkLnZhbHVlXHJcbiAgICAgIC5maWx0ZXIoKGNoYXQpID0+IGNoYXQuaXNQcm9qZWN0KVxyXG4gICAgICAuZm9yRWFjaCgoY2hhdCkgPT4gcHJvamVjdElkcy5hZGQoU3RyaW5nKGNoYXQuY29udmVyc2F0aW9uSWQpKSk7XHJcblxyXG4gICAgaWYgKHByb2plY3RJZHMuc2l6ZSA9PT0gMCkgcmV0dXJuO1xyXG5cclxuICAgIGNvbnN0IGl0ZW1zID0gdGhpcy5pbmJveCQudmFsdWUuZmlsdGVyKChpdGVtKSA9PiAhcHJvamVjdElkcy5oYXMoU3RyaW5nKGl0ZW0uY29udmVyc2F0aW9uX2lkKSkpO1xyXG4gICAgdGhpcy5pbmJveCQubmV4dChpdGVtcyk7XHJcbiAgICB0aGlzLnJlY2FsY1VucmVhZChpdGVtcyk7XHJcblxyXG4gICAgY29uc3QgbWFwID0gbmV3IE1hcCh0aGlzLm1lc3NhZ2VzTWFwJC52YWx1ZSk7XHJcbiAgICBwcm9qZWN0SWRzLmZvckVhY2goKGlkKSA9PiBtYXAuZGVsZXRlKGlkKSk7XHJcbiAgICB0aGlzLm1lc3NhZ2VzTWFwJC5uZXh0KG1hcCk7XHJcbiAgICB0aGlzLm9wZW5DaGF0cyQubmV4dCh0aGlzLm9wZW5DaGF0cyQudmFsdWUuZmlsdGVyKChjaGF0KSA9PiAhcHJvamVjdElkcy5oYXMoU3RyaW5nKGNoYXQuY29udmVyc2F0aW9uSWQpKSkpO1xyXG5cclxuICAgIGlmICh0aGlzLmFjdGl2ZUNvbnZlcnNhdGlvbklkJC52YWx1ZSAmJiBwcm9qZWN0SWRzLmhhcyhTdHJpbmcodGhpcy5hY3RpdmVDb252ZXJzYXRpb25JZCQudmFsdWUpKSkge1xyXG4gICAgICB0aGlzLmFjdGl2ZUNvbnZlcnNhdGlvbklkJC5uZXh0KG51bGwpO1xyXG4gICAgICB0aGlzLmFjdGl2ZVZpZXckLm5leHQoJ2luYm94Jyk7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3Qgc2V0dGluZ3MgPSB0aGlzLmdyb3VwU2V0dGluZ3MkLnZhbHVlO1xyXG4gICAgaWYgKHNldHRpbmdzICYmIHByb2plY3RJZHMuaGFzKFN0cmluZyhzZXR0aW5ncy5jb252ZXJzYXRpb25JZCkpKSB7XHJcbiAgICAgIHRoaXMuY2xlYXJHcm91cFNldHRpbmdzKCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvLyDilIDilIAgUmVhY3Rpb25zIOKUgOKUgFxyXG4gIGFkZFJlYWN0aW9uKG1lc3NhZ2VJZDogc3RyaW5nLCBlbW9qaTogc3RyaW5nKTogdm9pZCB7XHJcbiAgICBjb25zdCBjb250YWN0SWQgPSB0aGlzLmF1dGguY29udGFjdElkO1xyXG4gICAgaWYgKCFjb250YWN0SWQpIHJldHVybjtcclxuXHJcbiAgICAvLyBFbmZvcmNlIG9uZSByZWFjdGlvbiBwZXIgdXNlciDigJQgcmVtb3ZlIGFueSBleGlzdGluZyByZWFjdGlvbiB3aXRoIGEgZGlmZmVyZW50IGVtb2ppXHJcbiAgICBmb3IgKGNvbnN0IG1zZ3Mgb2YgdGhpcy5tZXNzYWdlc01hcCQudmFsdWUudmFsdWVzKCkpIHtcclxuICAgICAgY29uc3QgbXNnID0gbXNncy5maW5kKG0gPT4gU3RyaW5nKG0ubWVzc2FnZV9pZCkgPT09IFN0cmluZyhtZXNzYWdlSWQpKTtcclxuICAgICAgaWYgKG1zZz8ucmVhY3Rpb25zKSB7XHJcbiAgICAgICAgZm9yIChjb25zdCByIG9mIG1zZy5yZWFjdGlvbnMpIHtcclxuICAgICAgICAgIGlmIChyLmhhc1JlYWN0ZWQgJiYgci5lbW9qaSAhPT0gZW1vamkpIHtcclxuICAgICAgICAgICAgdGhpcy5hcHBseVJlYWN0aW9uT3B0aW1pc3RpY2FsbHkobWVzc2FnZUlkLCByLmVtb2ppLCBmYWxzZSk7XHJcbiAgICAgICAgICAgIHRoaXMuYXBpLnJlbW92ZVJlYWN0aW9uKG1lc3NhZ2VJZCwgY29udGFjdElkLCByLmVtb2ppKS5zdWJzY3JpYmUoeyBlcnJvcjogKCkgPT4ge30gfSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIGJyZWFrO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIE9wdGltaXN0aWMgVUkgc28gdXNlciBzZWVzIHJlYWN0aW9uIGltbWVkaWF0ZWx5LlxyXG4gICAgdGhpcy5hcHBseVJlYWN0aW9uT3B0aW1pc3RpY2FsbHkobWVzc2FnZUlkLCBlbW9qaSwgdHJ1ZSk7XHJcblxyXG4gICAgdGhpcy5hcGkuYWRkUmVhY3Rpb24obWVzc2FnZUlkLCBjb250YWN0SWQsIGVtb2ppKS5zdWJzY3JpYmUoe1xyXG4gICAgICBuZXh0OiAoKSA9PiB7XHJcbiAgICAgICAgdGhpcy5yZWZyZXNoTWVzc2FnZVJlYWN0aW9ucyhtZXNzYWdlSWQpO1xyXG4gICAgICB9LFxyXG4gICAgICBlcnJvcjogKCkgPT4ge1xyXG4gICAgICAgIC8vIFJldmVydCBvcHRpbWlzdGljIHVwZGF0ZSB3aGVuIHJlcXVlc3QgZmFpbHMuXHJcbiAgICAgICAgdGhpcy5hcHBseVJlYWN0aW9uT3B0aW1pc3RpY2FsbHkobWVzc2FnZUlkLCBlbW9qaSwgZmFsc2UpO1xyXG4gICAgICB9LFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICByZW1vdmVSZWFjdGlvbihtZXNzYWdlSWQ6IHN0cmluZywgZW1vamk6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgY29uc3QgY29udGFjdElkID0gdGhpcy5hdXRoLmNvbnRhY3RJZDtcclxuICAgIGlmICghY29udGFjdElkKSByZXR1cm47XHJcblxyXG4gICAgLy8gT3B0aW1pc3RpYyBVSSBzbyB1c2VyIHNlZXMgcmVhY3Rpb24gcmVtb3ZhbCBpbW1lZGlhdGVseS5cclxuICAgIHRoaXMuYXBwbHlSZWFjdGlvbk9wdGltaXN0aWNhbGx5KG1lc3NhZ2VJZCwgZW1vamksIGZhbHNlKTtcclxuXHJcbiAgICB0aGlzLmFwaS5yZW1vdmVSZWFjdGlvbihtZXNzYWdlSWQsIGNvbnRhY3RJZCwgZW1vamkpLnN1YnNjcmliZSh7XHJcbiAgICAgIG5leHQ6ICgpID0+IHtcclxuICAgICAgICB0aGlzLnJlZnJlc2hNZXNzYWdlUmVhY3Rpb25zKG1lc3NhZ2VJZCk7XHJcbiAgICAgIH0sXHJcbiAgICAgIGVycm9yOiAoKSA9PiB7XHJcbiAgICAgICAgLy8gUmV2ZXJ0IG9wdGltaXN0aWMgdXBkYXRlIHdoZW4gcmVxdWVzdCBmYWlscy5cclxuICAgICAgICB0aGlzLmFwcGx5UmVhY3Rpb25PcHRpbWlzdGljYWxseShtZXNzYWdlSWQsIGVtb2ppLCB0cnVlKTtcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgZWRpdE1lc3NhZ2UobWVzc2FnZUlkOiBzdHJpbmcsIGNvbnRlbnQ6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgY29uc3QgY29udGFjdElkID0gdGhpcy5hdXRoLmNvbnRhY3RJZDtcclxuICAgIGNvbnN0IGNvbnZlcnNhdGlvbklkID0gdGhpcy5hY3RpdmVDb252ZXJzYXRpb25JZCQudmFsdWU7XHJcbiAgICBjb25zdCBuZXh0Q29udGVudCA9IGNvbnRlbnQudHJpbSgpO1xyXG4gICAgaWYgKCFjb250YWN0SWQgfHwgIWNvbnZlcnNhdGlvbklkIHx8ICFtZXNzYWdlSWQgfHwgIW5leHRDb250ZW50KSByZXR1cm47XHJcblxyXG4gICAgdGhpcy5hcGkuZWRpdE1lc3NhZ2UobWVzc2FnZUlkLCBjb250YWN0SWQsIG5leHRDb250ZW50KS5zdWJzY3JpYmUoe1xyXG4gICAgICBuZXh0OiAocmVzKSA9PiB7XHJcbiAgICAgICAgY29uc3Qgc2VydmVyTWVzc2FnZSA9IHJlcz8ubWVzc2FnZSA/IHRoaXMubm9ybWFsaXplTWVzc2FnZVNoYXBlKHJlcy5tZXNzYWdlKSA6IG51bGw7XHJcbiAgICAgICAgdGhpcy51cGRhdGVNZXNzYWdlSW5Db252ZXJzYXRpb24oXHJcbiAgICAgICAgICBjb252ZXJzYXRpb25JZCxcclxuICAgICAgICAgIG1lc3NhZ2VJZCxcclxuICAgICAgICAgIHNlcnZlck1lc3NhZ2UgfHwge1xyXG4gICAgICAgICAgICBjb250ZW50OiBuZXh0Q29udGVudCxcclxuICAgICAgICAgICAgZWRpdGVkX2F0OiByZXM/LmVkaXRlZF9hdCB8fCBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgKTtcclxuICAgICAgICB0aGlzLmxvYWRJbmJveCgpO1xyXG4gICAgICB9LFxyXG4gICAgICBlcnJvcjogKCkgPT4ge30sXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIGRlbGV0ZU1lc3NhZ2UobWVzc2FnZUlkOiBzdHJpbmcpOiB2b2lkIHtcclxuICAgIGNvbnN0IGNvbnRhY3RJZCA9IHRoaXMuYXV0aC5jb250YWN0SWQ7XHJcbiAgICBjb25zdCBjb252ZXJzYXRpb25JZCA9IHRoaXMuYWN0aXZlQ29udmVyc2F0aW9uSWQkLnZhbHVlO1xyXG4gICAgaWYgKCFjb250YWN0SWQgfHwgIWNvbnZlcnNhdGlvbklkIHx8ICFtZXNzYWdlSWQpIHJldHVybjtcclxuXHJcbiAgICBpZiAoU3RyaW5nKG1lc3NhZ2VJZCkuc3RhcnRzV2l0aCgndGVtcC0nKSkge1xyXG4gICAgICB0aGlzLnJlbW92ZU1lc3NhZ2VGcm9tQ29udmVyc2F0aW9uKGNvbnZlcnNhdGlvbklkLCBtZXNzYWdlSWQpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5hcGkuZGVsZXRlTWVzc2FnZShtZXNzYWdlSWQsIGNvbnRhY3RJZCkuc3Vic2NyaWJlKHtcclxuICAgICAgbmV4dDogKCkgPT4ge1xyXG4gICAgICAgIHRoaXMudXBkYXRlTWVzc2FnZUluQ29udmVyc2F0aW9uKGNvbnZlcnNhdGlvbklkLCBtZXNzYWdlSWQsIHtcclxuICAgICAgICAgIGNvbnRlbnQ6ICdbZGVsZXRlZF0nLFxyXG4gICAgICAgICAgaXNfZGVsZXRlZDogdHJ1ZSxcclxuICAgICAgICB9KTtcclxuICAgICAgICB0aGlzLmxvYWRJbmJveCgpO1xyXG4gICAgICB9LFxyXG4gICAgICBlcnJvcjogKCkgPT4ge30sXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIGdldEFjdGl2ZUNvbnZlcnNhdGlvbklkKCk6IHN0cmluZyB8IG51bGwge1xyXG4gICAgcmV0dXJuIHRoaXMuYWN0aXZlQ29udmVyc2F0aW9uSWQkLnZhbHVlO1xyXG4gIH1cclxuXHJcbiAgLy8g4pSA4pSAIEdldHRlcnMg4pSA4pSAXHJcbiAgZ2V0TWVzc2FnZXNGb3JDb252ZXJzYXRpb24oY29udmVyc2F0aW9uSWQ6IHN0cmluZyk6IE1lc3NhZ2VbXSB7XHJcbiAgICByZXR1cm4gdGhpcy5tZXNzYWdlc01hcCQudmFsdWUuZ2V0KGNvbnZlcnNhdGlvbklkKSB8fCBbXTtcclxuICB9XHJcblxyXG4gIGdldEN1cnJlbnRJbmJveCgpOiBJbmJveEl0ZW1bXSB7XHJcbiAgICByZXR1cm4gdGhpcy5pbmJveCQudmFsdWU7XHJcbiAgfVxyXG5cclxuICAvLyDilIDilIAgUHJpdmF0ZSBoZWxwZXJzIOKUgOKUgFxyXG4gIC8qKlxyXG4gICAqIFByZWZlciBgeyB0eXBlLCBkYXRhIH1gOyBzdXBwb3J0IGZsYXQgYHsgdHlwZSwgLi4uZmllbGRzIH1gIGVudmVsb3BlcyBmcm9tIG9sZGVyIGJhY2tlbmRzLlxyXG4gICAqL1xyXG4gIHByaXZhdGUgd3NFdmVudFBheWxvYWQobXNnOiBXZWJTb2NrZXRNZXNzYWdlKTogYW55IHtcclxuICAgIGlmIChtc2cuZGF0YSAhPT0gdW5kZWZpbmVkICYmIG1zZy5kYXRhICE9PSBudWxsKSB7XHJcbiAgICAgIHJldHVybiBtc2cuZGF0YTtcclxuICAgIH1cclxuICAgIGNvbnN0IHJhdyA9IG1zZyBhcyB1bmtub3duIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+O1xyXG4gICAgY29uc3QgeyB0eXBlOiBfdCwgZGF0YTogX2QsIHRpbWVzdGFtcDogX3RzLCBtZXNzYWdlOiBfbXNnLCAuLi5yZXN0IH0gPSByYXc7XHJcbiAgICByZXR1cm4gT2JqZWN0LmtleXMocmVzdCkubGVuZ3RoID8gcmVzdCA6IG51bGw7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGxpc3RlbldlYlNvY2tldCgpOiB2b2lkIHtcclxuICAgIHRoaXMud3NTdWI/LnVuc3Vic2NyaWJlKCk7XHJcbiAgICB0aGlzLndzU3ViID0gdGhpcy53c1NlcnZpY2Uub25NZXNzYWdlJC5zdWJzY3JpYmUoKG1zZykgPT4gdGhpcy5oYW5kbGVXc01lc3NhZ2UobXNnKSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGhhbmRsZVdzTWVzc2FnZShtc2c6IFdlYlNvY2tldE1lc3NhZ2UpOiB2b2lkIHtcclxuICAgIHN3aXRjaCAobXNnLnR5cGUpIHtcclxuICAgICAgY2FzZSAnbmV3X21lc3NhZ2UnOlxyXG4gICAgICAgIHRoaXMuaGFuZGxlTmV3TWVzc2FnZSh0aGlzLndzRXZlbnRQYXlsb2FkKG1zZykpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICBjYXNlICdjb252ZXJzYXRpb25fdXBkYXRlZCc6XHJcbiAgICAgICAgdGhpcy5oYW5kbGVDb252ZXJzYXRpb25VcGRhdGVkKHRoaXMud3NFdmVudFBheWxvYWQobXNnKSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgIGNhc2UgJ2dyb3VwX3VwZGF0ZWQnOlxyXG4gICAgICAgIHRoaXMuaGFuZGxlR3JvdXBVcGRhdGVkKHRoaXMud3NFdmVudFBheWxvYWQobXNnKSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgIGNhc2UgJ2Vycm9yJzpcclxuICAgICAgICB0aGlzLmhhbmRsZVdlYlNvY2tldEVycm9yKG1zZy5tZXNzYWdlKTtcclxuICAgICAgICBicmVhaztcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHByaXZhdGUgaGFuZGxlQ29udmVyc2F0aW9uVXBkYXRlZChkYXRhOiBhbnkpOiB2b2lkIHtcclxuICAgIHRoaXMubG9hZEluYm94KCk7XHJcbiAgICBjb25zdCBhY3RpdmVJZCA9IHRoaXMuYWN0aXZlQ29udmVyc2F0aW9uSWQkLnZhbHVlO1xyXG4gICAgY29uc3QgZXZlbnRDb252ZXJzYXRpb25JZCA9IGRhdGE/LmNvbnZlcnNhdGlvbl9pZCA/PyBkYXRhPy5jb252ZXJzYXRpb25JZDtcclxuICAgIGlmIChhY3RpdmVJZCAmJiAoIWV2ZW50Q29udmVyc2F0aW9uSWQgfHwgU3RyaW5nKGV2ZW50Q29udmVyc2F0aW9uSWQpID09PSBTdHJpbmcoYWN0aXZlSWQpKSkge1xyXG4gICAgICB0aGlzLmxvYWRNZXNzYWdlcyhhY3RpdmVJZCwgdW5kZWZpbmVkLCB0cnVlKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHByaXZhdGUgaGFuZGxlR3JvdXBVcGRhdGVkKGRhdGE6IGFueSk6IHZvaWQge1xyXG4gICAgdGhpcy5oYW5kbGVDb252ZXJzYXRpb25VcGRhdGVkKGRhdGEpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBoYW5kbGVXZWJTb2NrZXRFcnJvcihlcnJvck1lc3NhZ2U6IHN0cmluZyB8IHVuZGVmaW5lZCk6IHZvaWQge1xyXG4gICAgdm9pZCBlcnJvck1lc3NhZ2U7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGhhbmRsZU5ld01lc3NhZ2UoZGF0YTogYW55KTogdm9pZCB7XHJcbiAgICBpZiAoIWRhdGEpIHJldHVybjtcclxuXHJcbiAgICBsZXQgbWVzc2FnZTogTWVzc2FnZSA9IHRoaXMubm9ybWFsaXplTWVzc2FnZVNoYXBlKGRhdGEpO1xyXG4gICAgdGhpcy5kZXRlY3RHcm91cFJlbW92YWxGb3JDdXJyZW50VXNlcihtZXNzYWdlKTtcclxuICAgIGNvbnN0IG15Q29udGFjdElkID0gU3RyaW5nKHRoaXMuYXV0aC5jb250YWN0SWQgPz8gJycpO1xyXG4gICAgY29uc3QgY29udklkID0gU3RyaW5nKG1lc3NhZ2UuY29udmVyc2F0aW9uX2lkID8/ICcnKTtcclxuICAgIGNvbnN0IGV4aXN0aW5nID0gdGhpcy5tZXNzYWdlc01hcCQudmFsdWUuZ2V0KGNvbnZJZCkgfHwgW107XHJcblxyXG4gICAgY29uc3Qgb3duRWNobyA9XHJcbiAgICAgIG15Q29udGFjdElkICYmXHJcbiAgICAgIFN0cmluZyhtZXNzYWdlLnNlbmRlcl9pZCkgPT09IG15Q29udGFjdElkICYmXHJcbiAgICAgICEhbWVzc2FnZS5tZXNzYWdlX2lkICYmXHJcbiAgICAgICFTdHJpbmcobWVzc2FnZS5tZXNzYWdlX2lkKS5zdGFydHNXaXRoKCd0ZW1wLScpO1xyXG5cclxuICAgIC8vIFdTIG9mdGVuIGFycml2ZXMgYmVmb3JlIEhUVFAgZmluaXNoZXMgcmVwbGFjaW5nIHRlbXAtOyBtZXJnZSBpbnRvIHRlbXAgaW5zdGVhZCBvZiBhcHBlbmRpbmcgYSBkdXBsaWNhdGUgcm93LlxyXG4gICAgaWYgKG93bkVjaG8pIHtcclxuICAgICAgY29uc3QgdGVtcElkeCA9IGV4aXN0aW5nLmZpbmRJbmRleCgobSkgPT4ge1xyXG4gICAgICAgIGlmICghU3RyaW5nKG0ubWVzc2FnZV9pZCkuc3RhcnRzV2l0aCgndGVtcC0nKSkgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIGlmIChTdHJpbmcobS5jb252ZXJzYXRpb25faWQpICE9PSBjb252SWQpIHJldHVybiBmYWxzZTtcclxuICAgICAgICBpZiAoU3RyaW5nKG0uc2VuZGVyX2lkKSAhPT0gbXlDb250YWN0SWQpIHJldHVybiBmYWxzZTtcclxuICAgICAgICBjb25zdCBkdCA9IE1hdGguYWJzKFxyXG4gICAgICAgICAgbmV3IERhdGUobS5jcmVhdGVkX2F0KS5nZXRUaW1lKCkgLSBuZXcgRGF0ZShtZXNzYWdlLmNyZWF0ZWRfYXQpLmdldFRpbWUoKVxyXG4gICAgICAgICk7XHJcbiAgICAgICAgaWYgKGR0ID49IDEyMF8wMDApIHJldHVybiBmYWxzZTtcclxuICAgICAgICBjb25zdCBhID0gU3RyaW5nKG0uY29udGVudCA/PyAnJykudHJpbSgpO1xyXG4gICAgICAgIGNvbnN0IGIgPSBTdHJpbmcobWVzc2FnZS5jb250ZW50ID8/ICcnKS50cmltKCk7XHJcbiAgICAgICAgcmV0dXJuIGEgPT09IGIgfHwgIWI7XHJcbiAgICAgIH0pO1xyXG4gICAgICBpZiAodGVtcElkeCA+PSAwKSB7XHJcbiAgICAgICAgY29uc3QgbWVyZ2VkOiBNZXNzYWdlID0gdGhpcy5tZXJnZU1lc3NhZ2VBdHRhY2htZW50cyhleGlzdGluZ1t0ZW1wSWR4XSwgdGhpcy5ub3JtYWxpemVNZXNzYWdlU2hhcGUoe1xyXG4gICAgICAgICAgLi4uZXhpc3RpbmdbdGVtcElkeF0sXHJcbiAgICAgICAgICAuLi5kYXRhLFxyXG4gICAgICAgICAgbWVzc2FnZV9pZDogbWVzc2FnZS5tZXNzYWdlX2lkLFxyXG4gICAgICAgICAgY29udmVyc2F0aW9uX2lkOiBjb252SWQsXHJcbiAgICAgICAgICBjb250ZW50OiB0aGlzLmNvYWxlc2NlTWVzc2FnZVRleHQoZGF0YSwgZXhpc3RpbmdbdGVtcElkeF0uY29udGVudCksXHJcbiAgICAgICAgfSkpO1xyXG4gICAgICAgIGNvbnN0IG1hcCA9IG5ldyBNYXAodGhpcy5tZXNzYWdlc01hcCQudmFsdWUpO1xyXG4gICAgICAgIGNvbnN0IG1zZ3MgPSB0aGlzLmRlZHVwZU1lc3NhZ2VzQnlJZEtlZXBGaXJzdChbLi4uZXhpc3RpbmddKTtcclxuICAgICAgICBtc2dzW3RlbXBJZHhdID0gbWVyZ2VkO1xyXG4gICAgICAgIG1hcC5zZXQoY29udklkLCB0aGlzLmRlZHVwZU1lc3NhZ2VzQnlJZEtlZXBGaXJzdChtc2dzKSk7XHJcbiAgICAgICAgdGhpcy5tZXNzYWdlc01hcCQubmV4dChtYXApO1xyXG4gICAgICAgIHRoaXMucmVmcmVzaE1lc3NhZ2VSZWFjdGlvbnMobWVyZ2VkLm1lc3NhZ2VfaWQpO1xyXG4gICAgICAgIG1lc3NhZ2UgPSBtZXJnZWQ7XHJcbiAgICAgICAgdGhpcy51cGRhdGVJbmJveFByZXZpZXcobWVzc2FnZSk7XHJcbiAgICAgICAgaWYgKHRoaXMuYWN0aXZlQ29udmVyc2F0aW9uSWQkLnZhbHVlID09PSBtZXNzYWdlLmNvbnZlcnNhdGlvbl9pZCkge1xyXG4gICAgICAgICAgdGhpcy5tYXJrQXNSZWFkKG1lc3NhZ2UuY29udmVyc2F0aW9uX2lkKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgaXNGcm9tT3RoZXIgPSBTdHJpbmcobWVzc2FnZS5zZW5kZXJfaWQpICE9PSBteUNvbnRhY3RJZDtcclxuICAgIGNvbnN0IG1lbnRpb25zTWUgPSBpc0Zyb21PdGhlciAmJiB0aGlzLm1lc3NhZ2VNZW50aW9uc0N1cnJlbnRVc2VyKG1lc3NhZ2UpO1xyXG5cclxuICAgIGNvbnN0IGR1cGxpY2F0ZUlkeCA9IGV4aXN0aW5nLmZpbmRJbmRleChcclxuICAgICAgKG0pID0+XHJcbiAgICAgICAgU3RyaW5nKG0ubWVzc2FnZV9pZCkgPT09IFN0cmluZyhtZXNzYWdlLm1lc3NhZ2VfaWQpIHx8XHJcbiAgICAgICAgKFN0cmluZyhtLnNlbmRlcl9pZCkgPT09IFN0cmluZyhtZXNzYWdlLnNlbmRlcl9pZCkgJiZcclxuICAgICAgICAgIFN0cmluZyhtLmNvbnRlbnQgPz8gJycpID09PSBTdHJpbmcobWVzc2FnZS5jb250ZW50ID8/ICcnKSAmJlxyXG4gICAgICAgICAgTWF0aC5hYnMobmV3IERhdGUobS5jcmVhdGVkX2F0KS5nZXRUaW1lKCkgLSBuZXcgRGF0ZShtZXNzYWdlLmNyZWF0ZWRfYXQpLmdldFRpbWUoKSkgPCAyMDAwKVxyXG4gICAgKTtcclxuICAgIGNvbnN0IGlzRHVwbGljYXRlID0gZHVwbGljYXRlSWR4ID49IDA7XHJcblxyXG4gICAgaWYgKCFpc0R1cGxpY2F0ZSkge1xyXG4gICAgICB0aGlzLmFwcGVuZE1lc3NhZ2UobWVzc2FnZSk7XHJcblxyXG4gICAgICBpZiAoaXNGcm9tT3RoZXIpIHtcclxuICAgICAgICB0aGlzLnBsYXlTb2Z0Tm90aWZpY2F0aW9uU291bmQoKTtcclxuICAgICAgfVxyXG4gICAgICB0aGlzLnVwZGF0ZUluYm94UHJldmlldyhtZXNzYWdlKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIGNvbnN0IG1hcCA9IG5ldyBNYXAodGhpcy5tZXNzYWdlc01hcCQudmFsdWUpO1xyXG4gICAgICBjb25zdCBtc2dzID0gWy4uLmV4aXN0aW5nXTtcclxuICAgICAgbXNnc1tkdXBsaWNhdGVJZHhdID0gdGhpcy5tZXJnZU1lc3NhZ2VBdHRhY2htZW50cyhleGlzdGluZ1tkdXBsaWNhdGVJZHhdLCBtZXNzYWdlKTtcclxuICAgICAgbWFwLnNldChjb252SWQsIG1zZ3MpO1xyXG4gICAgICB0aGlzLm1lc3NhZ2VzTWFwJC5uZXh0KG1hcCk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKHRoaXMuYWN0aXZlQ29udmVyc2F0aW9uSWQkLnZhbHVlICE9PSBtZXNzYWdlLmNvbnZlcnNhdGlvbl9pZCkge1xyXG4gICAgICBpZiAoaXNGcm9tT3RoZXIgJiYgIWlzRHVwbGljYXRlKSB7XHJcbiAgICAgICAgdGhpcy5pbmNyZW1lbnRVbnJlYWQobWVzc2FnZS5jb252ZXJzYXRpb25faWQpO1xyXG4gICAgICAgIGlmIChtZW50aW9uc01lKSB7XHJcbiAgICAgICAgICB0aGlzLnNldENvbnZlcnNhdGlvbk1lbnRpb24obWVzc2FnZS5jb252ZXJzYXRpb25faWQsIHRydWUpO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfSBlbHNlIHtcclxuICAgICAgdGhpcy5tYXJrQXNSZWFkKG1lc3NhZ2UuY29udmVyc2F0aW9uX2lkKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKiBQdWJsaWMg4oCUIGxldHMgY29tcG9uZW50cyBhZGQgYW4gb3B0aW1pc3RpYyBtZXNzYWdlIHdpdGhvdXQgYSByb3VuZC10cmlwLiAqL1xyXG4gIGFwcGVuZE9wdGltaXN0aWNNZXNzYWdlKG1lc3NhZ2U6IE1lc3NhZ2UpOiB2b2lkIHtcclxuICAgIHRoaXMuYXBwZW5kTWVzc2FnZShtZXNzYWdlKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgYXBwZW5kTWVzc2FnZShtZXNzYWdlOiBNZXNzYWdlKTogdm9pZCB7XHJcbiAgICBjb25zdCBtYXAgPSBuZXcgTWFwKHRoaXMubWVzc2FnZXNNYXAkLnZhbHVlKTtcclxuICAgIGNvbnN0IGN1cnJlbnQgPSBtYXAuZ2V0KG1lc3NhZ2UuY29udmVyc2F0aW9uX2lkKSB8fCBbXTtcclxuICAgIGNvbnN0IHNhbWVJZElkeCA9IGN1cnJlbnQuZmluZEluZGV4KChtKSA9PiBTdHJpbmcobS5tZXNzYWdlX2lkKSA9PT0gU3RyaW5nKG1lc3NhZ2UubWVzc2FnZV9pZCkpO1xyXG4gICAgaWYgKHNhbWVJZElkeCA+PSAwKSB7XHJcbiAgICAgIGNvbnN0IG1zZ3MgPSBbLi4uY3VycmVudF07XHJcbiAgICAgIG1zZ3Nbc2FtZUlkSWR4XSA9IHRoaXMubWVyZ2VNZXNzYWdlQXR0YWNobWVudHMoY3VycmVudFtzYW1lSWRJZHhdLCBtZXNzYWdlKTtcclxuICAgICAgbWFwLnNldChtZXNzYWdlLmNvbnZlcnNhdGlvbl9pZCwgbXNncyk7XHJcbiAgICAgIHRoaXMubWVzc2FnZXNNYXAkLm5leHQobWFwKTtcclxuICAgICAgdGhpcy5yZWZyZXNoTWVzc2FnZVJlYWN0aW9ucyhtZXNzYWdlLm1lc3NhZ2VfaWQpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgbXNncyA9IFsuLi5jdXJyZW50LCBtZXNzYWdlXTtcclxuICAgIG1hcC5zZXQobWVzc2FnZS5jb252ZXJzYXRpb25faWQsIG1zZ3MpO1xyXG4gICAgdGhpcy5tZXNzYWdlc01hcCQubmV4dChtYXApO1xyXG4gICAgdGhpcy5yZWZyZXNoTWVzc2FnZVJlYWN0aW9ucyhtZXNzYWdlLm1lc3NhZ2VfaWQpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSB1cGRhdGVNZXNzYWdlSW5Db252ZXJzYXRpb24oXHJcbiAgICBjb252ZXJzYXRpb25JZDogc3RyaW5nLFxyXG4gICAgbWVzc2FnZUlkOiBzdHJpbmcsXHJcbiAgICBwYXRjaDogUGFydGlhbDxNZXNzYWdlPlxyXG4gICk6IHZvaWQge1xyXG4gICAgY29uc3QgbWFwID0gbmV3IE1hcCh0aGlzLm1lc3NhZ2VzTWFwJC52YWx1ZSk7XHJcbiAgICBjb25zdCBjdXJyZW50ID0gbWFwLmdldChjb252ZXJzYXRpb25JZCkgfHwgW107XHJcbiAgICBjb25zdCBuZXh0ID0gY3VycmVudC5tYXAoKG1lc3NhZ2UpID0+XHJcbiAgICAgIFN0cmluZyhtZXNzYWdlLm1lc3NhZ2VfaWQpID09PSBTdHJpbmcobWVzc2FnZUlkKVxyXG4gICAgICAgID8gdGhpcy5ub3JtYWxpemVNZXNzYWdlU2hhcGUoeyAuLi5tZXNzYWdlLCAuLi5wYXRjaCB9KVxyXG4gICAgICAgIDogbWVzc2FnZVxyXG4gICAgKTtcclxuICAgIG1hcC5zZXQoY29udmVyc2F0aW9uSWQsIG5leHQpO1xyXG4gICAgdGhpcy5tZXNzYWdlc01hcCQubmV4dChtYXApO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSByZW1vdmVNZXNzYWdlRnJvbUNvbnZlcnNhdGlvbihjb252ZXJzYXRpb25JZDogc3RyaW5nLCBtZXNzYWdlSWQ6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgY29uc3QgbWFwID0gbmV3IE1hcCh0aGlzLm1lc3NhZ2VzTWFwJC52YWx1ZSk7XHJcbiAgICBjb25zdCBjdXJyZW50ID0gbWFwLmdldChjb252ZXJzYXRpb25JZCkgfHwgW107XHJcbiAgICBtYXAuc2V0KFxyXG4gICAgICBjb252ZXJzYXRpb25JZCxcclxuICAgICAgY3VycmVudC5maWx0ZXIoKG1lc3NhZ2UpID0+IFN0cmluZyhtZXNzYWdlLm1lc3NhZ2VfaWQpICE9PSBTdHJpbmcobWVzc2FnZUlkKSlcclxuICAgICk7XHJcbiAgICB0aGlzLm1lc3NhZ2VzTWFwJC5uZXh0KG1hcCk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIG1lcmdlTWVzc2FnZUF0dGFjaG1lbnRzKGV4aXN0aW5nOiBNZXNzYWdlLCBpbmNvbWluZzogTWVzc2FnZSk6IE1lc3NhZ2Uge1xyXG4gICAgY29uc3QgZXhpc3RpbmdBdHRhY2htZW50cyA9IHRoaXMubm9ybWFsaXplQXR0YWNobWVudExpc3QoZXhpc3RpbmcuYXR0YWNobWVudHMgfHwgW10pO1xyXG4gICAgY29uc3QgaW5jb21pbmdBdHRhY2htZW50cyA9IHRoaXMubm9ybWFsaXplQXR0YWNobWVudExpc3QoaW5jb21pbmcuYXR0YWNobWVudHMgfHwgW10pO1xyXG4gICAgY29uc3QgYXR0YWNobWVudHMgPVxyXG4gICAgICBpbmNvbWluZ0F0dGFjaG1lbnRzLmxlbmd0aCA+PSBleGlzdGluZ0F0dGFjaG1lbnRzLmxlbmd0aCA/IGluY29taW5nQXR0YWNobWVudHMgOiBleGlzdGluZ0F0dGFjaG1lbnRzO1xyXG5cclxuICAgIHJldHVybiB7XHJcbiAgICAgIC4uLmV4aXN0aW5nLFxyXG4gICAgICAuLi5pbmNvbWluZyxcclxuICAgICAgcmVhY3Rpb25zOiBpbmNvbWluZy5yZWFjdGlvbnMgfHwgZXhpc3RpbmcucmVhY3Rpb25zLFxyXG4gICAgICBhdHRhY2htZW50czogYXR0YWNobWVudHMubGVuZ3RoID4gMCA/IGF0dGFjaG1lbnRzIDogaW5jb21pbmcuYXR0YWNobWVudHMgfHwgZXhpc3RpbmcuYXR0YWNobWVudHMsXHJcbiAgICB9O1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBub3JtYWxpemVBdHRhY2htZW50TGlzdChhdHRhY2htZW50czogQXR0YWNobWVudFtdKTogQXR0YWNobWVudFtdIHtcclxuICAgIGNvbnN0IGJ5SWQgPSBuZXcgTWFwPHN0cmluZywgQXR0YWNobWVudD4oKTtcclxuICAgIGZvciAoY29uc3QgYXR0YWNobWVudCBvZiBhdHRhY2htZW50cykge1xyXG4gICAgICBjb25zdCBmaWxlSWQgPSBTdHJpbmcoYXR0YWNobWVudD8uZmlsZV9pZCB8fCAnJykudHJpbSgpO1xyXG4gICAgICBpZiAoIWZpbGVJZCB8fCBmaWxlSWQuc3RhcnRzV2l0aCgndGVtcC0nKSkgY29udGludWU7XHJcbiAgICAgIGJ5SWQuc2V0KGZpbGVJZCwge1xyXG4gICAgICAgIC4uLmF0dGFjaG1lbnQsXHJcbiAgICAgICAgZmlsZV9pZDogZmlsZUlkLFxyXG4gICAgICAgIGZpbGVuYW1lOiBhdHRhY2htZW50LmZpbGVuYW1lIHx8ICdGaWxlJyxcclxuICAgICAgfSk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gQXJyYXkuZnJvbShieUlkLnZhbHVlcygpKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgdXBkYXRlSW5ib3hQcmV2aWV3KG1lc3NhZ2U6IE1lc3NhZ2UpOiB2b2lkIHtcclxuICAgIGNvbnN0IHRleHQgPSBTdHJpbmcobWVzc2FnZS5jb250ZW50ID8/ICcnKS50cmltKCk7XHJcbiAgICBjb25zdCBtZWRpYSA9IHRoaXMubWVzc2FnZUxvb2tzTGlrZU1lZGlhKG1lc3NhZ2UpO1xyXG4gICAgaWYgKCF0ZXh0ICYmICFtZWRpYSkge1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICBjb25zdCBwcmV2aWV3ID0gdGV4dCB8fCAnW0ltYWdlXSc7XHJcbiAgICBjb25zdCBpdGVtcyA9IHRoaXMuaW5ib3gkLnZhbHVlLm1hcCgoaXRlbSkgPT4ge1xyXG4gICAgICBpZiAoaXRlbS5jb252ZXJzYXRpb25faWQgPT09IG1lc3NhZ2UuY29udmVyc2F0aW9uX2lkKSB7XHJcbiAgICAgICAgY29uc3QgbWVudGlvbmVkID0gaXRlbS5oYXNfbWVudGlvbiB8fCB0aGlzLm1lbnRpb25Db252ZXJzYXRpb25JZHMkLnZhbHVlLmhhcyhTdHJpbmcoaXRlbS5jb252ZXJzYXRpb25faWQpKTtcclxuICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgLi4uaXRlbSxcclxuICAgICAgICAgIGxhc3RfbWVzc2FnZV9wcmV2aWV3OiBwcmV2aWV3LFxyXG4gICAgICAgICAgbGFzdF9tZXNzYWdlX2F0OiBtZXNzYWdlLmNyZWF0ZWRfYXQsXHJcbiAgICAgICAgICBoYXNfbWVudGlvbjogbWVudGlvbmVkLFxyXG4gICAgICAgIH07XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIGl0ZW07XHJcbiAgICB9KTtcclxuXHJcbiAgICBpdGVtcy5zb3J0KChhLCBiKSA9PiBuZXcgRGF0ZShiLmxhc3RfbWVzc2FnZV9hdCkuZ2V0VGltZSgpIC0gbmV3IERhdGUoYS5sYXN0X21lc3NhZ2VfYXQpLmdldFRpbWUoKSk7XHJcbiAgICB0aGlzLmluYm94JC5uZXh0KGl0ZW1zKTtcclxuICB9XHJcblxyXG4gIC8qKiBGaXJzdCBub24tZW1wdHkgdGV4dCBmaWVsZCBmcm9tIEFQSSAvIFdTIG9iamVjdHMgKFBPU1QgYm9kaWVzIG9mdGVuIG9taXQgYGNvbnRlbnRgKS4gKi9cclxuICBwcml2YXRlIGNvYWxlc2NlTWVzc2FnZVRleHQocmF3OiBhbnksIGZhbGxiYWNrID0gJycpOiBzdHJpbmcge1xyXG4gICAgY29uc3QgY2FuZHMgPSBbcmF3Py5jb250ZW50LCByYXc/LmJvZHksIHJhdz8udGV4dCwgZmFsbGJhY2tdO1xyXG4gICAgZm9yIChjb25zdCBjIG9mIGNhbmRzKSB7XHJcbiAgICAgIGlmICh0eXBlb2YgYyA9PT0gJ3N0cmluZycgJiYgYy50cmltKCkpIHJldHVybiBjO1xyXG4gICAgICBpZiAoYyAhPSBudWxsICYmIHR5cGVvZiBjICE9PSAnb2JqZWN0JyAmJiBTdHJpbmcoYykudHJpbSgpKSByZXR1cm4gU3RyaW5nKGMpLnRyaW0oKTtcclxuICAgIH1cclxuICAgIHJldHVybiB0eXBlb2YgZmFsbGJhY2sgPT09ICdzdHJpbmcnID8gZmFsbGJhY2sgOiBTdHJpbmcoZmFsbGJhY2sgPz8gJycpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBwYXJzZVJlcGx5Q29udGVudChjb250ZW50OiBzdHJpbmcpOiB7IHJlcGx5OiBNZXNzYWdlUmVwbHlQcmV2aWV3OyBib2R5OiBzdHJpbmcgfSB8IG51bGwge1xyXG4gICAgY29uc3QgdmFsdWUgPSBTdHJpbmcoY29udGVudCB8fCAnJyk7XHJcbiAgICBjb25zdCBtYXRjaCA9IHZhbHVlLm1hdGNoKC9eXFxbUmVwbHkgdG8gKFteXFxdXSspXFxdXFxuPiAoW15cXG5dKilcXG5cXG4oW1xcc1xcU10qKSQvKTtcclxuICAgIGlmICghbWF0Y2gpIHJldHVybiBudWxsO1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgcmVwbHk6IHtcclxuICAgICAgICBzZW5kZXJfbmFtZTogbWF0Y2hbMV0udHJpbSgpLFxyXG4gICAgICAgIGNvbnRlbnQ6IG1hdGNoWzJdLnRyaW0oKSxcclxuICAgICAgfSxcclxuICAgICAgYm9keTogbWF0Y2hbM10sXHJcbiAgICB9O1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSByZXBseUJvZHlUZXh0KGNvbnRlbnQ6IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgICByZXR1cm4gdGhpcy5wYXJzZVJlcGx5Q29udGVudChjb250ZW50KT8uYm9keSA/PyBTdHJpbmcoY29udGVudCB8fCAnJyk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIG5vdGlmeUdyb3VwTWVtYmVyc2hpcENoYW5nZWQoKTogdm9pZCB7XHJcbiAgICB0aGlzLmdyb3VwTWVtYmVyc2hpcFZlcnNpb24kLm5leHQodGhpcy5ncm91cE1lbWJlcnNoaXBWZXJzaW9uJC52YWx1ZSArIDEpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSByZXBseUV4Y2VycHQoY29udGVudDogc3RyaW5nKTogc3RyaW5nIHtcclxuICAgIGNvbnN0IHBhcnNlZCA9IHRoaXMucGFyc2VSZXBseUNvbnRlbnQoY29udGVudCk7XHJcbiAgICBjb25zdCBiYXNlID0gKHBhcnNlZD8uYm9keSA/PyBjb250ZW50KS5yZXBsYWNlKC9cXHMrL2csICcgJykudHJpbSgpO1xyXG4gICAgcmV0dXJuIGJhc2UubGVuZ3RoID4gMTIwID8gYCR7YmFzZS5zbGljZSgwLCAxMTcpfS4uLmAgOiBiYXNlIHx8ICdBdHRhY2htZW50JztcclxuICB9XHJcblxyXG4gIHByaXZhdGUgY3VycmVudE1lbnRpb25Ub2tlbnMoKTogc3RyaW5nW10ge1xyXG4gICAgY29uc3QgY3VycmVudCA9IHRoaXMuYXV0aC5jdXJyZW50Q29udGFjdDtcclxuICAgIGNvbnN0IHZhbHVlcyA9IFtcclxuICAgICAgY3VycmVudD8udXNlcm5hbWUsXHJcbiAgICAgIGN1cnJlbnQ/LmVtYWlsPy5zcGxpdCgnQCcpWzBdLFxyXG4gICAgICBjdXJyZW50Py5maXJzdF9uYW1lLFxyXG4gICAgICBjdXJyZW50Py5sYXN0X25hbWUsXHJcbiAgICAgIGN1cnJlbnQ/LmVtYWlsLFxyXG4gICAgXTtcclxuICAgIHJldHVybiB2YWx1ZXNcclxuICAgICAgLm1hcCgodmFsdWUpID0+IFN0cmluZyh2YWx1ZSB8fCAnJykudHJpbSgpLnRvTG93ZXJDYXNlKCkpXHJcbiAgICAgIC5maWx0ZXIoQm9vbGVhbilcclxuICAgICAgLm1hcCgodmFsdWUpID0+IHZhbHVlLnJlcGxhY2UoL15ALywgJycpKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgbWVzc2FnZVRleHRNZW50aW9uc0N1cnJlbnRVc2VyKGNvbnRlbnQ6IHN0cmluZyk6IGJvb2xlYW4ge1xyXG4gICAgY29uc3QgdG9rZW5zID0gdGhpcy5jdXJyZW50TWVudGlvblRva2VucygpO1xyXG4gICAgaWYgKCF0b2tlbnMubGVuZ3RoKSByZXR1cm4gZmFsc2U7XHJcbiAgICBjb25zdCBtZW50aW9ucyA9IEFycmF5LmZyb20oU3RyaW5nKGNvbnRlbnQgfHwgJycpLm1hdGNoQWxsKC8oXnxbXmEtekEtWjAtOS5fLV0pQChbYS16QS1aMC05Ll8tXSspL2cpKVxyXG4gICAgICAubWFwKChtYXRjaCkgPT4gbWF0Y2hbMl0udG9Mb3dlckNhc2UoKSk7XHJcbiAgICByZXR1cm4gbWVudGlvbnMuc29tZSgobWVudGlvbikgPT4gdG9rZW5zLmluY2x1ZGVzKG1lbnRpb24pKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgbWVzc2FnZU1lbnRpb25zQ3VycmVudFVzZXIobWVzc2FnZTogTWVzc2FnZSk6IGJvb2xlYW4ge1xyXG4gICAgY29uc3QgbXlJZCA9IFN0cmluZyh0aGlzLmF1dGguY29udGFjdElkIHx8ICcnKTtcclxuICAgIGNvbnN0IGV4cGxpY2l0TWVudGlvbnMgPSBBcnJheS5pc0FycmF5KG1lc3NhZ2UubWVudGlvbnMpXHJcbiAgICAgID8gbWVzc2FnZS5tZW50aW9ucy5tYXAoKGlkKSA9PiBTdHJpbmcoaWQpKVxyXG4gICAgICA6IFtdO1xyXG4gICAgcmV0dXJuICghIW15SWQgJiYgZXhwbGljaXRNZW50aW9ucy5pbmNsdWRlcyhteUlkKSkgfHxcclxuICAgICAgdGhpcy5tZXNzYWdlVGV4dE1lbnRpb25zQ3VycmVudFVzZXIoU3RyaW5nKG1lc3NhZ2UuY29udGVudCB8fCAnJykpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBzZXRDb252ZXJzYXRpb25NZW50aW9uKGNvbnZlcnNhdGlvbklkOiBzdHJpbmcsIGhhc01lbnRpb246IGJvb2xlYW4pOiB2b2lkIHtcclxuICAgIGNvbnN0IGlkID0gU3RyaW5nKGNvbnZlcnNhdGlvbklkIHx8ICcnKTtcclxuICAgIGlmICghaWQpIHJldHVybjtcclxuICAgIGNvbnN0IG5leHQgPSBuZXcgU2V0KHRoaXMubWVudGlvbkNvbnZlcnNhdGlvbklkcyQudmFsdWUpO1xyXG4gICAgaWYgKGhhc01lbnRpb24pIHtcclxuICAgICAgbmV4dC5hZGQoaWQpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgbmV4dC5kZWxldGUoaWQpO1xyXG4gICAgfVxyXG4gICAgdGhpcy5tZW50aW9uQ29udmVyc2F0aW9uSWRzJC5uZXh0KG5leHQpO1xyXG4gICAgY29uc3QgaXRlbXMgPSB0aGlzLmluYm94JC52YWx1ZS5tYXAoKGl0ZW0pID0+XHJcbiAgICAgIFN0cmluZyhpdGVtLmNvbnZlcnNhdGlvbl9pZCkgPT09IGlkID8geyAuLi5pdGVtLCBoYXNfbWVudGlvbjogaGFzTWVudGlvbiB9IDogaXRlbVxyXG4gICAgKTtcclxuICAgIHRoaXMuaW5ib3gkLm5leHQoaXRlbXMpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBtZXNzYWdlTG9va3NMaWtlTWVkaWEobTogTWVzc2FnZSk6IGJvb2xlYW4ge1xyXG4gICAgY29uc3QgdCA9IG0ubWVzc2FnZV90eXBlO1xyXG4gICAgaWYgKHQgJiYgdCAhPT0gJ1RFWFQnKSByZXR1cm4gdHJ1ZTtcclxuICAgIGNvbnN0IHUgPSBTdHJpbmcobS5tZWRpYV91cmwgPz8gJycpLnRyaW0oKTtcclxuICAgIGlmICh1ICYmICh1LnN0YXJ0c1dpdGgoJ2h0dHA6Ly8nKSB8fCB1LnN0YXJ0c1dpdGgoJ2h0dHBzOi8vJykgfHwgdS5zdGFydHNXaXRoKCdkYXRhOicpKSkge1xyXG4gICAgICByZXR1cm4gdHJ1ZTtcclxuICAgIH1cclxuICAgIHJldHVybiBBcnJheS5pc0FycmF5KG0uYXR0YWNobWVudHMpICYmIG0uYXR0YWNobWVudHMubGVuZ3RoID4gMDtcclxuICB9XHJcblxyXG4gIC8qKiBTYW1lIGxvZ2ljYWwgbWVzc2FnZV9pZCBjYW4gYXBwZWFyIHR3aWNlIHdoZW4gV1MgYmVhdHMgSFRUUCB0ZW1wIHJlcGxhY2VtZW50IOKAlCBrZWVwIGZpcnN0IHJvdy4gKi9cclxuICBwcml2YXRlIGRlZHVwZU1lc3NhZ2VzQnlJZEtlZXBGaXJzdChtc2dzOiBNZXNzYWdlW10pOiBNZXNzYWdlW10ge1xyXG4gICAgY29uc3Qgc2VlbiA9IG5ldyBTZXQ8c3RyaW5nPigpO1xyXG4gICAgcmV0dXJuIG1zZ3MuZmlsdGVyKChtKSA9PiB7XHJcbiAgICAgIGNvbnN0IGlkID0gU3RyaW5nKG0ubWVzc2FnZV9pZCA/PyAnJyk7XHJcbiAgICAgIGlmICghaWQpIHJldHVybiB0cnVlO1xyXG4gICAgICBpZiAoc2Vlbi5oYXMoaWQpKSByZXR1cm4gZmFsc2U7XHJcbiAgICAgIHNlZW4uYWRkKGlkKTtcclxuICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgaW5jcmVtZW50VW5yZWFkKGNvbnZlcnNhdGlvbklkOiBzdHJpbmcpOiB2b2lkIHtcclxuICAgIGNvbnN0IGl0ZW1zID0gdGhpcy5pbmJveCQudmFsdWUubWFwKChpdGVtKSA9PlxyXG4gICAgICBpdGVtLmNvbnZlcnNhdGlvbl9pZCA9PT0gY29udmVyc2F0aW9uSWRcclxuICAgICAgICA/IHsgLi4uaXRlbSwgdW5yZWFkX2NvdW50OiBOdW1iZXIoaXRlbS51bnJlYWRfY291bnQpICsgMSB9XHJcbiAgICAgICAgOiBpdGVtXHJcbiAgICApO1xyXG4gICAgdGhpcy5pbmJveCQubmV4dChpdGVtcyk7XHJcbiAgICB0aGlzLnJlY2FsY1VucmVhZChpdGVtcyk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBOb3JtYWxpemUgYmFja2VuZCBtZXNzYWdlIHNoYXBlcyBzbyBVSSBjYW4gcmVsaWFibHkgcmVuZGVyIGF0dGFjaG1lbnRzL21lZGlhLlxyXG4gICAqIFN1cHBvcnRzIGxlZ2FjeSBhbmQgY3VycmVudCBmaWVsZCBuYW1lcyByZXR1cm5lZCBieSBBUEkvV1MgcGF5bG9hZHMuXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBub3JtYWxpemVNZXNzYWdlU2hhcGUocmF3OiBhbnkpOiBNZXNzYWdlIHtcclxuICAgIGNvbnN0IGJhc2U6IE1lc3NhZ2UgPSB7XHJcbiAgICAgIG1lc3NhZ2VfaWQ6IFN0cmluZyhyYXc/Lm1lc3NhZ2VfaWQgPz8gcmF3Py5pZCA/PyAnJyksXHJcbiAgICAgIGNvbnZlcnNhdGlvbl9pZDogU3RyaW5nKHJhdz8uY29udmVyc2F0aW9uX2lkID8/IHJhdz8uY29udmVyc2F0aW9uSWQgPz8gJycpLFxyXG4gICAgICBzZW5kZXJfaWQ6IFN0cmluZyhyYXc/LnNlbmRlcl9pZCA/PyByYXc/LnNlbmRlcklkID8/ICcnKSxcclxuICAgICAgc2VuZGVyX25hbWU6IHJhdz8uc2VuZGVyX25hbWUsXHJcbiAgICAgIHNlbmRlcl91c2VybmFtZTogcmF3Py5zZW5kZXJfdXNlcm5hbWUsXHJcbiAgICAgIHNlbmRlcl9maXJzdF9uYW1lOiByYXc/LnNlbmRlcl9maXJzdF9uYW1lLFxyXG4gICAgICBzZW5kZXJfbGFzdF9uYW1lOiByYXc/LnNlbmRlcl9sYXN0X25hbWUsXHJcbiAgICAgIG1lc3NhZ2VfdHlwZTogKHJhdz8ubWVzc2FnZV90eXBlID8/IHJhdz8ubWVzc2FnZVR5cGUgPz8gJ1RFWFQnKSBhcyBNZXNzYWdlWydtZXNzYWdlX3R5cGUnXSxcclxuICAgICAgY29udGVudDogcmF3Py5jb250ZW50ID8/IHJhdz8uYm9keSA/PyByYXc/LnRleHQgPz8gJycsXHJcbiAgICAgIG1lZGlhX3VybDogcmF3Py5tZWRpYV91cmwgPz8gcmF3Py5tZWRpYVVybCA/PyByYXc/LnVybCA/PyByYXc/LmZpbGVfdXJsLFxyXG4gICAgICBjcmVhdGVkX2F0OiByYXc/LmNyZWF0ZWRfYXQgPz8gcmF3Py5jcmVhdGVkQXQgPz8gbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxyXG4gICAgICBpc19yZWFkOiByYXc/LmlzX3JlYWQsXHJcbiAgICAgIGVkaXRlZF9hdDogcmF3Py5lZGl0ZWRfYXQgPz8gcmF3Py5lZGl0ZWRBdCxcclxuICAgICAgaXNfZGVsZXRlZDogQm9vbGVhbihyYXc/LmlzX2RlbGV0ZWQgPz8gcmF3Py5pc0RlbGV0ZWQgPz8gZmFsc2UpLFxyXG4gICAgICBkZWxldGVkX2F0OiByYXc/LmRlbGV0ZWRfYXQgPz8gcmF3Py5kZWxldGVkQXQsXHJcbiAgICAgIHJlYWN0aW9uczogcmF3Py5yZWFjdGlvbnMsXHJcbiAgICAgIG1lbnRpb25zOiByYXc/Lm1lbnRpb25zLFxyXG4gICAgICBhdHRhY2htZW50czogcmF3Py5hdHRhY2htZW50cyxcclxuICAgICAgaXNfcGlubmVkOiByYXc/LmlzX3Bpbm5lZCxcclxuICAgICAgcGlubmVkX2F0OiByYXc/LnBpbm5lZF9hdCxcclxuICAgICAgcGlubmVkX2J5OiByYXc/LnBpbm5lZF9ieSxcclxuICAgIH07XHJcblxyXG4gICAgY29uc3QgcmF3Q29udGVudCA9IFN0cmluZyhiYXNlLmNvbnRlbnQgfHwgJycpO1xyXG4gICAgaWYgKHJhd0NvbnRlbnQuc3RhcnRzV2l0aChQTEFJTl9URVhUX01FU1NBR0VfUFJFRklYKSkge1xyXG4gICAgICBiYXNlLmNvbnRlbnQgPSByYXdDb250ZW50LnNsaWNlKFBMQUlOX1RFWFRfTUVTU0FHRV9QUkVGSVgubGVuZ3RoKTtcclxuICAgICAgYmFzZS5yZW5kZXJfYXNfcGxhaW5fdGV4dCA9IHRydWU7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBiYXNlLnJlbmRlcl9hc19wbGFpbl90ZXh0ID0gcmF3Py5yZW5kZXJfYXNfcGxhaW5fdGV4dCA/PyByYXc/LnJlbmRlckFzUGxhaW5UZXh0O1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHBhcnNlZFJlcGx5ID0gdGhpcy5wYXJzZVJlcGx5Q29udGVudChTdHJpbmcoYmFzZS5jb250ZW50IHx8ICcnKSk7XHJcbiAgICBpZiAocGFyc2VkUmVwbHkpIHtcclxuICAgICAgYmFzZS5jb250ZW50ID0gcGFyc2VkUmVwbHkuYm9keTtcclxuICAgICAgYmFzZS5yZXBseV90byA9IHJhdz8ucmVwbHlfdG8gPz8gcmF3Py5yZXBseVRvID8/IHBhcnNlZFJlcGx5LnJlcGx5O1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgYmFzZS5yZXBseV90byA9IHJhdz8ucmVwbHlfdG8gPz8gcmF3Py5yZXBseVRvO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHV1aWRSZSA9XHJcbiAgICAgIC9eWzAtOWEtZl17OH0tWzAtOWEtZl17NH0tWzEtNV1bMC05YS1mXXszfS1bODlhYl1bMC05YS1mXXszfS1bMC05YS1mXXsxMn0kL2k7XHJcblxyXG4gICAgY29uc3QgdG9TdHJpbmdBcnJheSA9ICh2YWx1ZTogYW55KTogc3RyaW5nW10gPT4ge1xyXG4gICAgICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcclxuICAgICAgICByZXR1cm4gdmFsdWVcclxuICAgICAgICAgIC5tYXAoKHg6IGFueSkgPT4gKHR5cGVvZiB4ID09PSAnc3RyaW5nJyA/IHggOiB4Py5maWxlX2lkID8/IHg/LmlkID8/ICcnKSlcclxuICAgICAgICAgIC5tYXAoKHg6IGFueSkgPT4gU3RyaW5nKHgpLnRyaW0oKSlcclxuICAgICAgICAgIC5maWx0ZXIoQm9vbGVhbik7XHJcbiAgICAgIH1cclxuICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycgJiYgdmFsdWUudHJpbSgpKSB7XHJcbiAgICAgICAgY29uc3QgdHJpbW1lZCA9IHZhbHVlLnRyaW0oKTtcclxuICAgICAgICBpZiAodHJpbW1lZC5zdGFydHNXaXRoKCd7JykgfHwgdHJpbW1lZC5zdGFydHNXaXRoKCdbJykpIHtcclxuICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHBhcnNlZCA9IEpTT04ucGFyc2UodHJpbW1lZCk7XHJcbiAgICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KHBhcnNlZCkpIHJldHVybiB0b1N0cmluZ0FycmF5KHBhcnNlZCk7XHJcbiAgICAgICAgICAgIHJldHVybiB0b1N0cmluZ0FycmF5KHBhcnNlZD8uaWRzID8/IHBhcnNlZD8uZmlsZV9pZHMgPz8gcGFyc2VkPy5hdHRhY2htZW50X2lkcyA/PyBwYXJzZWQ/LmF0dGFjaG1lbnRzKTtcclxuICAgICAgICAgIH0gY2F0Y2gge1xyXG4gICAgICAgICAgICByZXR1cm4gW107XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiB0cmltbWVkLnNwbGl0KC9bLFxcc10rLykubWFwKChzOiBzdHJpbmcpID0+IHMudHJpbSgpKS5maWx0ZXIoQm9vbGVhbik7XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIFtdO1xyXG4gICAgfTtcclxuXHJcbiAgICBjb25zdCBub3JtYWxpemVBdHRhY2htZW50ID0gKGE6IGFueSk6IEF0dGFjaG1lbnQgfCBudWxsID0+IHtcclxuICAgICAgY29uc3QgZmlsZUlkID0gU3RyaW5nKFxyXG4gICAgICAgIHR5cGVvZiBhID09PSAnc3RyaW5nJyA/IGEgOlxyXG4gICAgICAgIGE/LmZpbGVfaWQgPz8gYT8uZmlsZUlkID8/IGE/LmlkID8/IGE/LmF0dGFjaG1lbnRfaWQgPz8gYT8uc3RvcmFnZV9maWxlX2lkID8/ICcnXHJcbiAgICAgICkudHJpbSgpO1xyXG4gICAgICBpZiAoIWZpbGVJZCB8fCBmaWxlSWQuc3RhcnRzV2l0aCgndGVtcC0nKSkgcmV0dXJuIG51bGw7XHJcbiAgICAgIHJldHVybiB7XHJcbiAgICAgICAgZmlsZV9pZDogZmlsZUlkLFxyXG4gICAgICAgIGZpbGVuYW1lOiBTdHJpbmcoYT8uZmlsZW5hbWUgPz8gYT8uZmlsZV9uYW1lID8/IGE/Lm5hbWUgPz8gYT8ub3JpZ2luYWxfZmlsZW5hbWUgPz8gJ0ZpbGUnKSxcclxuICAgICAgICBtaW1lX3R5cGU6IGE/Lm1pbWVfdHlwZSA/PyBhPy5taW1lVHlwZSxcclxuICAgICAgICBzaXplX2J5dGVzOiBhPy5zaXplX2J5dGVzID8/IGE/LnNpemVCeXRlcyxcclxuICAgICAgICB1cmw6IGE/LnVybCA/PyBhPy5maWxlX3VybCA/PyBhPy5kb3dubG9hZF91cmwsXHJcbiAgICAgIH07XHJcbiAgICB9O1xyXG5cclxuICAgIGxldCBub3JtYWxpemVkQXR0YWNobWVudHM6IEF0dGFjaG1lbnRbXSA9IFtdO1xyXG4gICAgY29uc3QgYWRkQXR0YWNobWVudCA9IChhdHRhY2htZW50OiBBdHRhY2htZW50IHwgbnVsbCk6IHZvaWQgPT4ge1xyXG4gICAgICBpZiAoIWF0dGFjaG1lbnQpIHJldHVybjtcclxuICAgICAgY29uc3QgZmlsZUlkID0gU3RyaW5nKGF0dGFjaG1lbnQuZmlsZV9pZCB8fCAnJykudHJpbSgpO1xyXG4gICAgICBjb25zdCB1cmwgPSBTdHJpbmcoYXR0YWNobWVudC51cmwgfHwgJycpLnRyaW0oKTtcclxuICAgICAgaWYgKGZpbGVJZC5zdGFydHNXaXRoKCd7JykgfHwgZmlsZUlkLnN0YXJ0c1dpdGgoJ1snKSkge1xyXG4gICAgICAgIGNvbnN0IGlkcyA9IHRvU3RyaW5nQXJyYXkoZmlsZUlkKTtcclxuICAgICAgICBpZHMuZm9yRWFjaCgoaWQsIGlkeCkgPT4ge1xyXG4gICAgICAgICAgYWRkQXR0YWNobWVudCh7XHJcbiAgICAgICAgICAgIC4uLmF0dGFjaG1lbnQsXHJcbiAgICAgICAgICAgIGZpbGVfaWQ6IGlkLFxyXG4gICAgICAgICAgICBmaWxlbmFtZTogYXR0YWNobWVudC5maWxlbmFtZSB8fCBgQXR0YWNobWVudCAke2lkeCArIDF9YCxcclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIHJldHVybjtcclxuICAgICAgfVxyXG4gICAgICBpZiAoZmlsZUlkICYmIG5vcm1hbGl6ZWRBdHRhY2htZW50cy5zb21lKChhKSA9PiBhLmZpbGVfaWQgPT09IGZpbGVJZCkpIHJldHVybjtcclxuICAgICAgaWYgKCFmaWxlSWQgJiYgdXJsICYmIG5vcm1hbGl6ZWRBdHRhY2htZW50cy5zb21lKChhKSA9PiBhLnVybCA9PT0gdXJsKSkgcmV0dXJuO1xyXG4gICAgICBub3JtYWxpemVkQXR0YWNobWVudHMucHVzaChhdHRhY2htZW50KTtcclxuICAgIH07XHJcblxyXG4gICAgLy8gTm9ybWFsaXplIGF0dGFjaG1lbnQgb2JqZWN0cyAoQVBJIG1heSB1c2UgZmlsZUlkIC8gaWQgaW5zdGVhZCBvZiBmaWxlX2lkKS5cclxuICAgIGlmIChBcnJheS5pc0FycmF5KGJhc2UuYXR0YWNobWVudHMpICYmIGJhc2UuYXR0YWNobWVudHMubGVuZ3RoID4gMCkge1xyXG4gICAgICAoYmFzZS5hdHRhY2htZW50cyBhcyBhbnlbXSkuZm9yRWFjaCgoYSkgPT4gYWRkQXR0YWNobWVudChub3JtYWxpemVBdHRhY2htZW50KGEpKSk7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgbWVkaWFWYWx1ZSA9IFN0cmluZyhiYXNlLm1lZGlhX3VybCB8fCAnJykudHJpbSgpO1xyXG4gICAgaWYgKG1lZGlhVmFsdWUuc3RhcnRzV2l0aCgneycpIHx8IG1lZGlhVmFsdWUuc3RhcnRzV2l0aCgnWycpKSB7XHJcbiAgICAgIHRyeSB7XHJcbiAgICAgICAgY29uc3QgcGFyc2VkID0gSlNPTi5wYXJzZShtZWRpYVZhbHVlKTtcclxuICAgICAgICBjb25zdCByYXdBdHRhY2htZW50cyA9IEFycmF5LmlzQXJyYXkocGFyc2VkKSA/IHBhcnNlZCA6IHBhcnNlZD8uYXR0YWNobWVudHM7XHJcbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkocmF3QXR0YWNobWVudHMpKSB7XHJcbiAgICAgICAgICByYXdBdHRhY2htZW50cy5mb3JFYWNoKChhKSA9PiBhZGRBdHRhY2htZW50KG5vcm1hbGl6ZUF0dGFjaG1lbnQoYSkpKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKCFBcnJheS5pc0FycmF5KHBhcnNlZCkpIHtcclxuICAgICAgICAgIGNvbnN0IG1lZGlhSWRzID0gdG9TdHJpbmdBcnJheShwYXJzZWQ/LmlkcyA/PyBwYXJzZWQ/LmZpbGVfaWRzID8/IHBhcnNlZD8uYXR0YWNobWVudF9pZHMpO1xyXG4gICAgICAgICAgY29uc3QgbWVkaWFGaWxlbmFtZXMgPSB0b1N0cmluZ0FycmF5KHBhcnNlZD8uZmlsZW5hbWVzKTtcclxuICAgICAgICAgIGNvbnN0IG1lZGlhTWltZVR5cGVzID0gdG9TdHJpbmdBcnJheShwYXJzZWQ/Lm1pbWVfdHlwZXMgPz8gcGFyc2VkPy5taW1lVHlwZXMpO1xyXG4gICAgICAgICAgbWVkaWFJZHMuZm9yRWFjaCgoaWQsIGlkeCkgPT4ge1xyXG4gICAgICAgICAgICBhZGRBdHRhY2htZW50KHtcclxuICAgICAgICAgICAgICBmaWxlX2lkOiBpZCxcclxuICAgICAgICAgICAgICBmaWxlbmFtZTogbWVkaWFGaWxlbmFtZXNbaWR4XSB8fCBtZWRpYUZpbGVuYW1lc1swXSB8fCBgQXR0YWNobWVudCAke2lkeCArIDF9YCxcclxuICAgICAgICAgICAgICBtaW1lX3R5cGU6IG1lZGlhTWltZVR5cGVzW2lkeF0sXHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9IGNhdGNoIHtcclxuICAgICAgICAvLyBGYWxsIHRocm91Z2ggdG8gbGVnYWN5IGF0dGFjaG1lbnQgcmVjb25zdHJ1Y3Rpb24gYmVsb3cuXHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvLyBSZWNvbnN0cnVjdCBhdHRhY2htZW50cyBmcm9tIGFsdGVybmF0ZSBBUEkgZmllbGRzLlxyXG4gICAgbGV0IGF0dGFjaG1lbnRJZHM6IHN0cmluZ1tdID0gW107XHJcbiAgICBhdHRhY2htZW50SWRzID0gdG9TdHJpbmdBcnJheShyYXc/LmF0dGFjaG1lbnRfaWRzKTtcclxuXHJcbiAgICBpZiAoYXR0YWNobWVudElkcy5sZW5ndGggPT09IDApIHtcclxuICAgICAgYXR0YWNobWVudElkcyA9IHRvU3RyaW5nQXJyYXkocmF3Py5maWxlX2lkcyk7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgcHVzaElkID0gKHY6IGFueSkgPT4ge1xyXG4gICAgICBjb25zdCBzID0gdiAhPSBudWxsICYmIHYgIT09ICcnID8gU3RyaW5nKHYpLnRyaW0oKSA6ICcnO1xyXG4gICAgICBpZiAocyAmJiAhYXR0YWNobWVudElkcy5pbmNsdWRlcyhzKSkgYXR0YWNobWVudElkcy5wdXNoKHMpO1xyXG4gICAgfTtcclxuXHJcbiAgICBwdXNoSWQocmF3Py5maWxlX2lkKTtcclxuICAgIHB1c2hJZChyYXc/LmF0dGFjaG1lbnRfaWQpO1xyXG4gICAgcHVzaElkKHJhdz8uc3RvcmFnZV9maWxlX2lkKTtcclxuICAgIHB1c2hJZChyYXc/LmJsb2JfaWQpO1xyXG5cclxuICAgIC8vIEJhY2tlbmQgc3RvcmVzIGZpcnN0IGF0dGFjaG1lbnQgaWQgaW4gbWVzc2FnaW5nLm1lc3NhZ2UubWVkaWFfdXJsIChVVUlEKSwgbm90IGEgcHVibGljIFVSTC5cclxuICAgIGNvbnN0IG1lZGlhQXNJZCA9IFN0cmluZyhiYXNlLm1lZGlhX3VybCB8fCAnJykudHJpbSgpO1xyXG4gICAgaWYgKFxyXG4gICAgICBtZWRpYUFzSWQgJiZcclxuICAgICAgIW1lZGlhQXNJZC5zdGFydHNXaXRoKCd7JykgJiZcclxuICAgICAgIW1lZGlhQXNJZC5zdGFydHNXaXRoKCdbJykgJiZcclxuICAgICAgIW1lZGlhQXNJZC5zdGFydHNXaXRoKCdodHRwOi8vJykgJiZcclxuICAgICAgIW1lZGlhQXNJZC5zdGFydHNXaXRoKCdodHRwczovLycpICYmXHJcbiAgICAgICFtZWRpYUFzSWQuc3RhcnRzV2l0aCgnZGF0YTonKVxyXG4gICAgKSB7XHJcbiAgICAgIHB1c2hJZChtZWRpYUFzSWQpO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGNvbnRlbnRUcmltID0gU3RyaW5nKGJhc2UuY29udGVudCB8fCAnJykudHJpbSgpO1xyXG4gICAgaWYgKGF0dGFjaG1lbnRJZHMubGVuZ3RoID09PSAwICYmIHV1aWRSZS50ZXN0KGNvbnRlbnRUcmltKSkge1xyXG4gICAgICBhdHRhY2htZW50SWRzLnB1c2goY29udGVudFRyaW0pO1xyXG4gICAgfVxyXG4gICAgLy8gU29tZSBBUElzIHN0b3JlIHN0b3JhZ2UgLyBhdHRhY2htZW50IGlkIGFzIG51bWVyaWMgc3RyaW5nIGluIGNvbnRlbnQgZm9yIEZJTEUgbWVzc2FnZXMuXHJcbiAgICBpZiAoXHJcbiAgICAgIGF0dGFjaG1lbnRJZHMubGVuZ3RoID09PSAwICYmXHJcbiAgICAgIC9eXFxkKyQvLnRlc3QoY29udGVudFRyaW0pICYmXHJcbiAgICAgIChiYXNlLm1lc3NhZ2VfdHlwZSA9PT0gJ0ZJTEUnIHx8IGJhc2UubWVzc2FnZV90eXBlID09PSAnSU1BR0UnKVxyXG4gICAgKSB7XHJcbiAgICAgIGF0dGFjaG1lbnRJZHMucHVzaChjb250ZW50VHJpbSk7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgZmlsZW5hbWVzOiBzdHJpbmdbXSA9IHRvU3RyaW5nQXJyYXkocmF3Py5maWxlbmFtZXMpLmxlbmd0aFxyXG4gICAgICA/IHRvU3RyaW5nQXJyYXkocmF3Py5maWxlbmFtZXMpXHJcbiAgICAgIDogcmF3Py5maWxlbmFtZVxyXG4gICAgICA/IFtTdHJpbmcocmF3LmZpbGVuYW1lKV1cclxuICAgICAgOiByYXc/LmZpbGVfbmFtZVxyXG4gICAgICA/IFtTdHJpbmcocmF3LmZpbGVfbmFtZSldXHJcbiAgICAgIDogW107XHJcblxyXG4gICAgY29uc3QgbWltZVR5cGVzOiBzdHJpbmdbXSA9IHRvU3RyaW5nQXJyYXkocmF3Py5taW1lX3R5cGVzKS5sZW5ndGhcclxuICAgICAgPyB0b1N0cmluZ0FycmF5KHJhdz8ubWltZV90eXBlcylcclxuICAgICAgOiB0b1N0cmluZ0FycmF5KHJhdz8ubWltZVR5cGVzKTtcclxuXHJcbiAgICBpZiAoYXR0YWNobWVudElkcy5sZW5ndGggPiAwIHx8IGZpbGVuYW1lcy5sZW5ndGggPiAwKSB7XHJcbiAgICAgIGNvbnN0IGZhbGxiYWNrTWltZSA9IHJhdz8ubWltZV90eXBlID8/IHJhdz8uYXR0YWNobWVudF9taW1lX3R5cGUgPz8gKGJhc2UubWVzc2FnZV90eXBlID09PSAnSU1BR0UnID8gJ2ltYWdlLyonIDogdW5kZWZpbmVkKTtcclxuICAgICAgY29uc3QgdXJsRmFsbGJhY2sgPSByYXc/LmZpbGVfdXJsID8/IHJhdz8udXJsID8/IHJhdz8ubWVkaWFfdXJsID8/IHJhdz8ubWVkaWFVcmw7XHJcbiAgICAgIGNvbnN0IGlkcyA9IGF0dGFjaG1lbnRJZHMubGVuZ3RoID4gMCA/IGF0dGFjaG1lbnRJZHMgOiBbXTtcclxuICAgICAgY29uc3QgYnVpbHQ6IEF0dGFjaG1lbnRbXSA9IGlkcy5tYXAoKGlkLCBpZHgpID0+ICh7XHJcbiAgICAgICAgZmlsZV9pZDogaWQsXHJcbiAgICAgICAgZmlsZW5hbWU6IGZpbGVuYW1lc1tpZHhdIHx8IGZpbGVuYW1lc1swXSB8fCAoYmFzZS5tZXNzYWdlX3R5cGUgPT09ICdJTUFHRScgPyBgSW1hZ2UgJHtpZHggKyAxfWAgOiBgQXR0YWNobWVudCAke2lkeCArIDF9YCksXHJcbiAgICAgICAgbWltZV90eXBlOiBtaW1lVHlwZXNbaWR4XSB8fCBmYWxsYmFja01pbWUsXHJcbiAgICAgICAgdXJsOiB1cmxGYWxsYmFjayxcclxuICAgICAgfSkpO1xyXG5cclxuICAgICAgLy8gRmlsZW5hbWUgb25seSArIGRpcmVjdCBVUkwgKG5vIHN0b3JhZ2UgaWQpOiBzdGlsbCByZW5kZXJhYmxlIGFzIDxpbWcgc3JjPi5cclxuICAgICAgaWYgKFxyXG4gICAgICAgIGJ1aWx0Lmxlbmd0aCA9PT0gMCAmJlxyXG4gICAgICAgIGZpbGVuYW1lcy5sZW5ndGggPiAwICYmXHJcbiAgICAgICAgdXJsRmFsbGJhY2sgJiZcclxuICAgICAgICBTdHJpbmcodXJsRmFsbGJhY2spLm1hdGNoKC9eaHR0cHM/OlxcL1xcLy9pKVxyXG4gICAgICApIHtcclxuICAgICAgICBidWlsdC5wdXNoKHtcclxuICAgICAgICAgIGZpbGVfaWQ6ICcnLFxyXG4gICAgICAgICAgZmlsZW5hbWU6IGZpbGVuYW1lc1swXSxcclxuICAgICAgICAgIG1pbWVfdHlwZTogZmFsbGJhY2tNaW1lLFxyXG4gICAgICAgICAgdXJsOiBTdHJpbmcodXJsRmFsbGJhY2spLFxyXG4gICAgICAgIH0pO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBidWlsdC5mb3JFYWNoKChhdHRhY2htZW50KSA9PiBhZGRBdHRhY2htZW50KGF0dGFjaG1lbnQpKTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAobm9ybWFsaXplZEF0dGFjaG1lbnRzLmxlbmd0aCA+IDApIHtcclxuICAgICAgcmV0dXJuIHsgLi4uYmFzZSwgYXR0YWNobWVudHM6IG5vcm1hbGl6ZWRBdHRhY2htZW50cyB9O1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBiYXNlO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBwbGF5U29mdE5vdGlmaWNhdGlvblNvdW5kKGZvcmNlID0gZmFsc2UpOiB2b2lkIHtcclxuICAgIGlmICghZm9yY2UgJiYgdGhpcy5ub3RpZmljYXRpb25zTXV0ZWQkLnZhbHVlKSByZXR1cm47XHJcbiAgICBjb25zdCB2b2x1bWUgPSBNYXRoLm1heCgwLCBNYXRoLm1pbigxLCB0aGlzLm5vdGlmaWNhdGlvblZvbHVtZSQudmFsdWUpKTtcclxuICAgIGlmICh2b2x1bWUgPD0gMCAmJiAhZm9yY2UpIHJldHVybjtcclxuXHJcbiAgICB0cnkge1xyXG4gICAgICBjb25zdCBBdWRpb0N0eCA9ICh3aW5kb3cgYXMgYW55KS5BdWRpb0NvbnRleHQgfHwgKHdpbmRvdyBhcyBhbnkpLndlYmtpdEF1ZGlvQ29udGV4dDtcclxuICAgICAgaWYgKCFBdWRpb0N0eCkgcmV0dXJuO1xyXG4gICAgICBjb25zdCBjdHggPSBuZXcgQXVkaW9DdHgoKTtcclxuICAgICAgY29uc3QgbWFzdGVyID0gY3R4LmNyZWF0ZUdhaW4oKTtcclxuICAgICAgY29uc3Qgb3V0cHV0R2FpbiA9IE1hdGgubWF4KHZvbHVtZSwgMC4wMDEpO1xyXG4gICAgICBtYXN0ZXIuZ2Fpbi5zZXRWYWx1ZUF0VGltZSgwLjAwMDEsIGN0eC5jdXJyZW50VGltZSk7XHJcbiAgICAgIG1hc3Rlci5nYWluLmV4cG9uZW50aWFsUmFtcFRvVmFsdWVBdFRpbWUob3V0cHV0R2FpbiwgY3R4LmN1cnJlbnRUaW1lICsgMC4wMTUpO1xyXG4gICAgICBtYXN0ZXIuZ2Fpbi5leHBvbmVudGlhbFJhbXBUb1ZhbHVlQXRUaW1lKDAuMDAwMSwgY3R4LmN1cnJlbnRUaW1lICsgMC40Mik7XHJcbiAgICAgIG1hc3Rlci5jb25uZWN0KGN0eC5kZXN0aW5hdGlvbik7XHJcblxyXG4gICAgICBjb25zdCBwbGF5VG9uZSA9IChmcmVxdWVuY3k6IG51bWJlciwgc3RhcnQ6IG51bWJlciwgZHVyYXRpb246IG51bWJlcikgPT4ge1xyXG4gICAgICAgIGNvbnN0IG9zYyA9IGN0eC5jcmVhdGVPc2NpbGxhdG9yKCk7XHJcbiAgICAgICAgY29uc3QgZ2FpbiA9IGN0eC5jcmVhdGVHYWluKCk7XHJcbiAgICAgICAgb3NjLnR5cGUgPSAnc2luZSc7XHJcbiAgICAgICAgb3NjLmZyZXF1ZW5jeS5zZXRWYWx1ZUF0VGltZShmcmVxdWVuY3ksIGN0eC5jdXJyZW50VGltZSArIHN0YXJ0KTtcclxuICAgICAgICBnYWluLmdhaW4uc2V0VmFsdWVBdFRpbWUoMC4wMDAxLCBjdHguY3VycmVudFRpbWUgKyBzdGFydCk7XHJcbiAgICAgICAgZ2Fpbi5nYWluLmV4cG9uZW50aWFsUmFtcFRvVmFsdWVBdFRpbWUoMC41NSwgY3R4LmN1cnJlbnRUaW1lICsgc3RhcnQgKyAwLjAyNSk7XHJcbiAgICAgICAgZ2Fpbi5nYWluLmV4cG9uZW50aWFsUmFtcFRvVmFsdWVBdFRpbWUoMC4wMDAxLCBjdHguY3VycmVudFRpbWUgKyBzdGFydCArIGR1cmF0aW9uKTtcclxuICAgICAgICBvc2MuY29ubmVjdChnYWluKTtcclxuICAgICAgICBnYWluLmNvbm5lY3QobWFzdGVyKTtcclxuICAgICAgICBvc2Muc3RhcnQoY3R4LmN1cnJlbnRUaW1lICsgc3RhcnQpO1xyXG4gICAgICAgIG9zYy5zdG9wKGN0eC5jdXJyZW50VGltZSArIHN0YXJ0ICsgZHVyYXRpb24gKyAwLjAyKTtcclxuICAgICAgfTtcclxuXHJcbiAgICAgIHBsYXlUb25lKDc0MCwgMCwgMC4xOCk7XHJcbiAgICAgIHBsYXlUb25lKDk4OCwgMC4xMiwgMC4yMik7XHJcbiAgICAgIHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IGN0eC5jbG9zZSgpLmNhdGNoKCgpID0+IHt9KSwgNjAwKTtcclxuICAgIH0gY2F0Y2gge1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBwbGF5Tm90aWZpY2F0aW9uU291bmQoKTogdm9pZCB7XHJcbiAgICB0cnkge1xyXG4gICAgICBjb25zdCBhdWRpbyA9IG5ldyBBdWRpbygnZGF0YTphdWRpby93YXY7YmFzZTY0LFVrbEdSbm9HQUFCWFFWWkZabTEwSUJBQUFBQUJBQUVBUUI4QUFFQWZBQUFCQUFnQVpHRjBZUW9HQUFDQmhZcUZiRjFmZEppdnJKQmhOalZnb2REYnEyRWNCaithMi9MRGNpVUZMSUhPOHRpSk53Z1phTHZ0NTU5TkVBeFFwK1B3dG1NY0JqaVIxL0xNZVN3RkpIZkg4TjJRUUFvVVhyVHA2NmhWRkFwR24rRHl2bXdoQlN1Qnp2TFppVFlJR0dTNTdPaWhVQkVMVEtYaDhibGxIQVUyamRYenpuMHZCU2grelBMYWl6c0tGR0N6Nk95cldCUUxTS0RmOHNGdUl3VXVnOC95MjRrM0NCaGt1K3pvb1ZBUkMweWw0Zkc1WlJ3Rk5vM1Y4ODU5THdVb2Zzenkyb3M3Q2hSZ3MranNxMWdWQzBpZzMvTEJiaU1GTG9MUDh0dUpOd2dZWkx2czZLRlFFUXRNcGVIeHVXVWNCVGFOMWZQT2ZTOEZLSDdNOHRxTE93b1VZTFBvN0t0WUZRdElvTi95d1c0akJTNkN6L0xiaVRjSUdHUzc3T2loVUJFTFRLWGg4YmxsSEFVMmpkWHp6bjB2QlNoK3pQTGFpenNLRkdDejZPeXJXQlVMU0tEZjhzRnVJd1V1Z3MveTI0azNDQmhrdSt6b29WQVJDMHlsNGZHNVpSd0ZObzNWODg1OUx3VW9mc3p5Mm9zN0NoUmdzK2pzcTFnVkMwaWczL0xCYmlNRkxvTFA4dHVKTndnWVpMdnM2S0ZRRVF0TXBlSHh1V1VjQlRhTjFmUE9mUzhGS0g3TTh0cUxPd29VWUxQbzdLdFlGUXRJb04veXdXNGpCUzZDei9MYmlUY0lHR1M3N09paFVCRUxUS1hoOGJsbEhBVTJqZFh6em4wdkJTaCt6UExhaXpzS0ZHQ3o2T3lyV0JVTFNLRGY4c0Z1SXdVdWdzL3kyNGszQ0Joa3Urem9vVkFSQzB5bDRmRzVaUndGTm8zVjg4NTlMd1VvZnN6eTJvczdDaFJncytqc3ExZ1ZDMGlnMy9MQmJpTUZMb0xQOHR1Sk53Z1laTHZzNktGUUVRdE1wZUh4dVdVY0JUYU4xZlBPZlM4RktIN004dHFMT3dvVVlMUG83S3RZRlF0SW9OL3l3VzRqQlM2Q3ovTGJpVGNJR0dTNzdPaWhVQkVMVEtYaDhibGxIQVUyamRYenpuMHZCU2grelBMYWl6c0tGR0N6Nk95cldCVUxTS0RmOHNGdUl3VXVncy95MjRrM0NCaGt1K3pvb1ZBUkMweWw0Zkc1WlJ3Rk5vM1Y4ODU5THdVb2Zzenkyb3M3Q2hSZ3MranNxMWdWQzBpZzMvTEJiaU1GTG9MUDh0dUpOd2dZWkx2czZLRlFFUXRNcGVIeHVXVWNCVGFOMWZQT2ZTOEZLSDdNOHRxTE93b1VZTFBvN0t0WUZRdElvTi95d1c0akJTNkN6L0xiaVRjSUdHUzc3T2loVUJFTFRLWGg4YmxsSEFVMmpkWHp6bjB2QlNoK3pQTGFpenNLRkdDejZPeXJXQlVMU0tEZjhzRnVJd1V1Z3MveTI0azNDQmhrdSt6b29WQVJDMHlsNGZHNVpSd0ZObzNWODg1OUx3VW9mc3p5Mm9zN0NoUmdzK2pzcTFnVkMwaWczL0xCYmlNRkxvTFA4dHVKTndnWVpMdnM2S0ZRRVF0TXBlSHh1V1VjQlRhTjFmUE9mUzhGS0g3TTh0cUxPd29VWUxQbzdLdFlGUXRJb04veXdXNGpCUzZDei9MYmlUY0lHR1M3N09paFVCRUxUS1hoOGJsbEhBVTJqZFh6em4wdkJTaCt6UExhaXpzS0ZHQ3o2T3lyV0JVTFNLRGY4c0Z1SXdVdWdzL3kyNGszQ0Joa3Urem9vVkFSQzB5bDRmRzVaUndGTm8zVjg4NTlMd1VvZnN6eScpO1xyXG4gICAgICBhdWRpby52b2x1bWUgPSAwLjM7XHJcbiAgICAgIGF1ZGlvLnBsYXkoKS5jYXRjaCgoKSA9PiB7fSk7XHJcbiAgICB9IGNhdGNoIHtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHByaXZhdGUgcmVjYWxjVW5yZWFkKGl0ZW1zOiBJbmJveEl0ZW1bXSk6IHZvaWQge1xyXG4gICAgY29uc3QgdG90YWwgPSBpdGVtcy5yZWR1Y2UoKHN1bSwgaSkgPT4gc3VtICsgTnVtYmVyKGkudW5yZWFkX2NvdW50IHx8IDApLCAwKTtcclxuICAgIHRoaXMudG90YWxVbnJlYWQkLm5leHQodG90YWwpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBnZXRDb250YWN0TmFtZUJ5SWQoY29udGFjdElkOiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gICAgY29uc3QgaWQgPSBTdHJpbmcoY29udGFjdElkKTtcclxuICAgIGlmIChpZCA9PT0gU3RyaW5nKHRoaXMuYXV0aC5jb250YWN0SWQgfHwgJycpICYmIHRoaXMuYXV0aC5jdXJyZW50Q29udGFjdCkge1xyXG4gICAgICByZXR1cm4gZ2V0Q29udGFjdERpc3BsYXlOYW1lKHRoaXMuYXV0aC5jdXJyZW50Q29udGFjdCk7XHJcbiAgICB9XHJcbiAgICBjb25zdCBjb250YWN0ID0gdGhpcy52aXNpYmxlQ29udGFjdHMkLnZhbHVlLmZpbmQoKGMpID0+IFN0cmluZyhjLmNvbnRhY3RfaWQpID09PSBpZCk7XHJcbiAgICByZXR1cm4gY29udGFjdCA/IGdldENvbnRhY3REaXNwbGF5TmFtZShjb250YWN0KSA6IGBVc2VyICR7aWR9YDtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgZGV0ZWN0R3JvdXBSZW1vdmFsRm9yQ3VycmVudFVzZXIobWVzc2FnZTogTWVzc2FnZSk6IHZvaWQge1xyXG4gICAgY29uc3QgY29udGVudCA9IFN0cmluZyhtZXNzYWdlLmNvbnRlbnQgfHwgJycpLnRyaW0oKTtcclxuICAgIGNvbnN0IG1hdGNoID0gY29udGVudC5tYXRjaCgvXiguKykgcmVtb3ZlZCAoLispIGZyb20gdGhlIGdyb3VwJC8pO1xyXG4gICAgaWYgKCFtYXRjaCkgcmV0dXJuO1xyXG5cclxuICAgIGNvbnN0IG15Q29udGFjdCA9IHRoaXMuYXV0aC5jdXJyZW50Q29udGFjdDtcclxuICAgIGNvbnN0IG15TmFtZSA9IG15Q29udGFjdCA/IGdldENvbnRhY3REaXNwbGF5TmFtZShteUNvbnRhY3QpLnRyaW0oKS50b0xvd2VyQ2FzZSgpIDogJyc7XHJcbiAgICBjb25zdCByZW1vdmVkTmFtZSA9IG1hdGNoWzJdPy50cmltKCkudG9Mb3dlckNhc2UoKTtcclxuICAgIGlmICghbXlOYW1lIHx8IHJlbW92ZWROYW1lICE9PSBteU5hbWUpIHJldHVybjtcclxuXHJcbiAgICBjb25zdCBjb252SWQgPSBTdHJpbmcobWVzc2FnZS5jb252ZXJzYXRpb25faWQgfHwgJycpO1xyXG4gICAgaWYgKGNvbnZJZCkge1xyXG4gICAgICB0aGlzLm1hcmtHcm91cFJlbW92ZWQoY29udklkKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHByaXZhdGUgaHlkcmF0ZVJlYWN0aW9uc0ZvckNvbnZlcnNhdGlvbihjb252ZXJzYXRpb25JZDogc3RyaW5nLCBtZXNzYWdlczogTWVzc2FnZVtdLCBvbmx5TWlzc2luZyA9IGZhbHNlKTogdm9pZCB7XHJcbiAgICBjb25zdCBmZXRjaGFibGUgPSBtZXNzYWdlcy5maWx0ZXIoKG0pID0+IHtcclxuICAgICAgaWYgKCFtLm1lc3NhZ2VfaWQgfHwgU3RyaW5nKG0ubWVzc2FnZV9pZCkuc3RhcnRzV2l0aCgndGVtcC0nKSkgcmV0dXJuIGZhbHNlO1xyXG4gICAgICBpZiAoIW9ubHlNaXNzaW5nKSByZXR1cm4gdHJ1ZTtcclxuICAgICAgcmV0dXJuICFBcnJheS5pc0FycmF5KG0ucmVhY3Rpb25zKSB8fCBtLnJlYWN0aW9ucy5sZW5ndGggPT09IDA7XHJcbiAgICB9KTtcclxuICAgIGlmICghZmV0Y2hhYmxlLmxlbmd0aCkgcmV0dXJuO1xyXG5cclxuICAgIGNvbnN0IGpvYnMgPSBmZXRjaGFibGUubWFwKChtKSA9PlxyXG4gICAgICB0aGlzLmFwaS5nZXRSZWFjdGlvbnMobS5tZXNzYWdlX2lkKS5waXBlKFxyXG4gICAgICAgIG1hcCgocm93cykgPT4gKHsgbWVzc2FnZUlkOiBtLm1lc3NhZ2VfaWQsIHJlYWN0aW9uczogdGhpcy5ub3JtYWxpemVSZWFjdGlvblJvd3Mocm93cykgfSkpLFxyXG4gICAgICAgIGNhdGNoRXJyb3IoKCkgPT4gb2YoeyBtZXNzYWdlSWQ6IG0ubWVzc2FnZV9pZCwgcmVhY3Rpb25zOiBbXSB9KSlcclxuICAgICAgKVxyXG4gICAgKTtcclxuXHJcbiAgICBmb3JrSm9pbihqb2JzKS5zdWJzY3JpYmUoKHJlc3VsdHMpID0+IHtcclxuICAgICAgY29uc3QgbWFwID0gbmV3IE1hcCh0aGlzLm1lc3NhZ2VzTWFwJC52YWx1ZSk7XHJcbiAgICAgIGNvbnN0IGN1cnJlbnQgPSBbLi4uKG1hcC5nZXQoY29udmVyc2F0aW9uSWQpIHx8IFtdKV07XHJcbiAgICAgIGlmICghY3VycmVudC5sZW5ndGgpIHJldHVybjtcclxuXHJcbiAgICAgIGxldCBjaGFuZ2VkID0gZmFsc2U7XHJcbiAgICAgIGZvciAoY29uc3QgcmVzdWx0IG9mIHJlc3VsdHMpIHtcclxuICAgICAgICBjb25zdCBpZHggPSBjdXJyZW50LmZpbmRJbmRleCgobSkgPT4gU3RyaW5nKG0ubWVzc2FnZV9pZCkgPT09IFN0cmluZyhyZXN1bHQubWVzc2FnZUlkKSk7XHJcbiAgICAgICAgaWYgKGlkeCA9PT0gLTEpIGNvbnRpbnVlO1xyXG4gICAgICAgIGN1cnJlbnRbaWR4XSA9IHsgLi4uY3VycmVudFtpZHhdLCByZWFjdGlvbnM6IHJlc3VsdC5yZWFjdGlvbnMgfTtcclxuICAgICAgICBjaGFuZ2VkID0gdHJ1ZTtcclxuICAgICAgfVxyXG5cclxuICAgICAgaWYgKGNoYW5nZWQpIHtcclxuICAgICAgICBtYXAuc2V0KGNvbnZlcnNhdGlvbklkLCBjdXJyZW50KTtcclxuICAgICAgICB0aGlzLm1lc3NhZ2VzTWFwJC5uZXh0KG1hcCk7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSByZWZyZXNoTWVzc2FnZVJlYWN0aW9ucyhtZXNzYWdlSWQ6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgaWYgKCFtZXNzYWdlSWQgfHwgU3RyaW5nKG1lc3NhZ2VJZCkuc3RhcnRzV2l0aCgndGVtcC0nKSkgcmV0dXJuO1xyXG5cclxuICAgIHRoaXMuYXBpLmdldFJlYWN0aW9ucyhtZXNzYWdlSWQpLnN1YnNjcmliZSh7XHJcbiAgICAgIG5leHQ6IChyb3dzKSA9PiB7XHJcbiAgICAgICAgY29uc3Qgbm9ybWFsaXplZCA9IHRoaXMubm9ybWFsaXplUmVhY3Rpb25Sb3dzKHJvd3MpO1xyXG4gICAgICAgIGNvbnN0IG1hcCA9IG5ldyBNYXAodGhpcy5tZXNzYWdlc01hcCQudmFsdWUpO1xyXG4gICAgICAgIGxldCBjaGFuZ2VkID0gZmFsc2U7XHJcblxyXG4gICAgICAgIGZvciAoY29uc3QgW2NvbnZlcnNhdGlvbklkLCBtc2dzXSBvZiBtYXAuZW50cmllcygpKSB7XHJcbiAgICAgICAgICBjb25zdCBpZHggPSBtc2dzLmZpbmRJbmRleCgobSkgPT4gU3RyaW5nKG0ubWVzc2FnZV9pZCkgPT09IFN0cmluZyhtZXNzYWdlSWQpKTtcclxuICAgICAgICAgIGlmIChpZHggPT09IC0xKSBjb250aW51ZTtcclxuICAgICAgICAgIGNvbnN0IG5leHRNc2dzID0gWy4uLm1zZ3NdO1xyXG4gICAgICAgICAgbmV4dE1zZ3NbaWR4XSA9IHsgLi4ubmV4dE1zZ3NbaWR4XSwgcmVhY3Rpb25zOiBub3JtYWxpemVkIH07XHJcbiAgICAgICAgICBtYXAuc2V0KGNvbnZlcnNhdGlvbklkLCBuZXh0TXNncyk7XHJcbiAgICAgICAgICBjaGFuZ2VkID0gdHJ1ZTtcclxuICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKGNoYW5nZWQpIHtcclxuICAgICAgICAgIHRoaXMubWVzc2FnZXNNYXAkLm5leHQobWFwKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0sXHJcbiAgICAgIGVycm9yOiAoKSA9PiB7fSxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBub3JtYWxpemVSZWFjdGlvblJvd3Mocm93czogYW55W10pOiBhbnlbXSB7XHJcbiAgICBjb25zdCBieUVtb2ppID0gbmV3IE1hcDxzdHJpbmcsIHsgZW1vamk6IHN0cmluZzsgY291bnQ6IG51bWJlcjsgaGFzUmVhY3RlZDogYm9vbGVhbjsgcmVhY3RvcnM6IHN0cmluZ1tdIH0+KCk7XHJcbiAgICBjb25zdCBteUNvbnRhY3RJZCA9IFN0cmluZyh0aGlzLmF1dGguY29udGFjdElkIHx8ICcnKTtcclxuICAgIGNvbnN0IGNvbnRhY3RzID0gdGhpcy52aXNpYmxlQ29udGFjdHMkLnZhbHVlO1xyXG4gICAgY29uc3QgcGFyc2VSZWFjdG9ycyA9ICh2YWx1ZTogYW55KTogYW55W10gPT4ge1xyXG4gICAgICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHJldHVybiB2YWx1ZTtcclxuICAgICAgaWYgKHZhbHVlICYmIHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcpIHJldHVybiBbdmFsdWVdO1xyXG4gICAgICBpZiAodHlwZW9mIHZhbHVlICE9PSAnc3RyaW5nJyB8fCAhdmFsdWUudHJpbSgpKSByZXR1cm4gW107XHJcblxyXG4gICAgICBjb25zdCB0cmltbWVkID0gdmFsdWUudHJpbSgpO1xyXG4gICAgICBpZiAodHJpbW1lZC5zdGFydHNXaXRoKCd7JykgfHwgdHJpbW1lZC5zdGFydHNXaXRoKCdbJykpIHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgY29uc3QgcGFyc2VkID0gSlNPTi5wYXJzZSh0cmltbWVkKTtcclxuICAgICAgICAgIHJldHVybiBBcnJheS5pc0FycmF5KHBhcnNlZCkgPyBwYXJzZWQgOiBbcGFyc2VkXTtcclxuICAgICAgICB9IGNhdGNoIHtcclxuICAgICAgICAgIHJldHVybiBbdHJpbW1lZF07XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcblxyXG4gICAgICByZXR1cm4gdHJpbW1lZC5zcGxpdCgnLCcpLm1hcCgoeDogc3RyaW5nKSA9PiB4LnRyaW0oKSkuZmlsdGVyKEJvb2xlYW4pO1xyXG4gICAgfTtcclxuXHJcbiAgICBjb25zdCBkaXNwbGF5TmFtZUZvclJlYWN0b3IgPSAocmVhY3RvcjogYW55KTogc3RyaW5nID0+IHtcclxuICAgICAgaWYgKHJlYWN0b3IgPT0gbnVsbCkgcmV0dXJuICcnO1xyXG4gICAgICBpZiAodHlwZW9mIHJlYWN0b3IgPT09ICdzdHJpbmcnKSB7XHJcbiAgICAgICAgY29uc3QgdHJpbW1lZCA9IHJlYWN0b3IudHJpbSgpO1xyXG4gICAgICAgIGlmICghdHJpbW1lZCkgcmV0dXJuICcnO1xyXG4gICAgICAgIGlmICh0cmltbWVkLnN0YXJ0c1dpdGgoJ3snKSB8fCB0cmltbWVkLnN0YXJ0c1dpdGgoJ1snKSkge1xyXG4gICAgICAgICAgY29uc3QgcGFyc2VkID0gcGFyc2VSZWFjdG9ycyh0cmltbWVkKTtcclxuICAgICAgICAgIHJldHVybiBwYXJzZWQubWFwKGRpc3BsYXlOYW1lRm9yUmVhY3RvcikuZmlsdGVyKEJvb2xlYW4pLmpvaW4oJywgJyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiB0cmltbWVkO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBjb25zdCByZWFjdG9ySWQgPSBTdHJpbmcocmVhY3Rvcj8uY29udGFjdF9pZCA/PyByZWFjdG9yPy5jb250YWN0SWQgPz8gcmVhY3Rvcj8uaWQgPz8gJycpLnRyaW0oKTtcclxuICAgICAgaWYgKHJlYWN0b3JJZCAmJiByZWFjdG9ySWQgPT09IG15Q29udGFjdElkKSByZXR1cm4gJ1lvdSc7XHJcblxyXG4gICAgICBjb25zdCBleHBsaWNpdE5hbWUgPSBTdHJpbmcoXHJcbiAgICAgICAgcmVhY3Rvcj8udXNlcm5hbWUgPz9cclxuICAgICAgICByZWFjdG9yPy5uYW1lID8/XHJcbiAgICAgICAgcmVhY3Rvcj8uZGlzcGxheV9uYW1lID8/XHJcbiAgICAgICAgcmVhY3Rvcj8uZGlzcGxheU5hbWUgPz9cclxuICAgICAgICByZWFjdG9yPy5lbWFpbCA/P1xyXG4gICAgICAgICcnXHJcbiAgICAgICkudHJpbSgpO1xyXG4gICAgICBpZiAoZXhwbGljaXROYW1lKSByZXR1cm4gZXhwbGljaXROYW1lO1xyXG5cclxuICAgICAgaWYgKHJlYWN0b3JJZCkge1xyXG4gICAgICAgIGNvbnN0IGNvbnRhY3QgPSBjb250YWN0cy5maW5kKGMgPT4gU3RyaW5nKGMuY29udGFjdF9pZCkgPT09IHJlYWN0b3JJZCk7XHJcbiAgICAgICAgcmV0dXJuIGNvbnRhY3QgPyBnZXRDb250YWN0RGlzcGxheU5hbWUoY29udGFjdCkgOiBgVXNlciAke3JlYWN0b3JJZH1gO1xyXG4gICAgICB9XHJcblxyXG4gICAgICByZXR1cm4gJyc7XHJcbiAgICB9O1xyXG5cclxuICAgIGZvciAoY29uc3Qgcm93IG9mIHJvd3MgfHwgW10pIHtcclxuICAgICAgY29uc3QgZW1vamkgPSBTdHJpbmcocm93Py5lbW9qaSB8fCAnJykudHJpbSgpO1xyXG4gICAgICBpZiAoIWVtb2ppKSBjb250aW51ZTtcclxuXHJcbiAgICAgIGNvbnN0IGNvbnRhY3RJZCA9IFN0cmluZyhyb3c/LmNvbnRhY3RfaWQgPz8gcm93Py5jb250YWN0SWQgPz8gJycpO1xyXG4gICAgICBjb25zdCBleHBsaWNpdEhhc1JlYWN0ZWQgPSByb3c/Lmhhc1JlYWN0ZWQgPz8gcm93Py5oYXNfcmVhY3RlZDtcclxuICAgICAgY29uc3QgaGFzUmVhY3RlZCA9IGV4cGxpY2l0SGFzUmVhY3RlZCA9PT0gdHJ1ZSB8fCAoY29udGFjdElkICYmIGNvbnRhY3RJZCA9PT0gbXlDb250YWN0SWQpO1xyXG5cclxuICAgICAgY29uc3QgcmF3UmVhY3RvcnMgPVxyXG4gICAgICAgIHJvdz8ucmVhY3RvcnMgPz9cclxuICAgICAgICByb3c/LnJlYWN0b3JfbmFtZXMgPz9cclxuICAgICAgICByb3c/LnJlYWN0b3JOYW1lcyA/P1xyXG4gICAgICAgIHJvdz8ucmVhY3RlZF9ieSA/P1xyXG4gICAgICAgIHJvdz8ucmVhY3RlZEJ5ID8/XHJcbiAgICAgICAgcm93Py51c2VycyA/P1xyXG4gICAgICAgIFtdO1xyXG4gICAgICBjb25zdCByZWFjdG9yUm93cyA9IHBhcnNlUmVhY3RvcnMocmF3UmVhY3RvcnMpO1xyXG4gICAgICBjb25zdCBjb3VudEZyb21Sb3cgPSBOdW1iZXIocm93Py5jb3VudCA/PyByb3c/LnJlYWN0aW9uX2NvdW50ID8/IHJvdz8ucmVhY3Rpb25Db3VudCA/PyByZWFjdG9yUm93cy5sZW5ndGggPz8gMCk7XHJcbiAgICAgIGNvbnN0IGV4aXN0aW5nID0gYnlFbW9qaS5nZXQoZW1vamkpIHx8IHsgZW1vamksIGNvdW50OiAwLCBoYXNSZWFjdGVkOiBmYWxzZSwgcmVhY3RvcnM6IFtdIH07XHJcblxyXG4gICAgICAvLyBTb21lIEFQSXMgcmV0dXJuIG9uZSByb3cgcGVyIHJlYWN0aW9uOyBzb21lIHJldHVybiBwcmUtYWdncmVnYXRlZCBjb3VudC5cclxuICAgICAgZXhpc3RpbmcuY291bnQgKz0gY291bnRGcm9tUm93ID4gMCA/IGNvdW50RnJvbVJvdyA6IDE7XHJcbiAgICAgIGV4aXN0aW5nLmhhc1JlYWN0ZWQgPSBleGlzdGluZy5oYXNSZWFjdGVkIHx8ICEhaGFzUmVhY3RlZDtcclxuXHJcbiAgICAgIC8vIFRyYWNrIHJlYWN0b3IgZGlzcGxheSBuYW1lcyB3aGVuIGluZGl2aWR1YWwgY29udGFjdElkIGlzIGF2YWlsYWJsZVxyXG4gICAgICBpZiAoY29udGFjdElkICYmIGNvdW50RnJvbVJvdyA8PSAxKSB7XHJcbiAgICAgICAgbGV0IG5hbWU6IHN0cmluZztcclxuICAgICAgICBpZiAoY29udGFjdElkID09PSBteUNvbnRhY3RJZCkge1xyXG4gICAgICAgICAgbmFtZSA9ICdZb3UnO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICBjb25zdCBjb250YWN0ID0gY29udGFjdHMuZmluZChjID0+IFN0cmluZyhjLmNvbnRhY3RfaWQpID09PSBjb250YWN0SWQpO1xyXG4gICAgICAgICAgbmFtZSA9IGNvbnRhY3QgPyBnZXRDb250YWN0RGlzcGxheU5hbWUoY29udGFjdCkgOiBgVXNlciAke2NvbnRhY3RJZH1gO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoIWV4aXN0aW5nLnJlYWN0b3JzLmluY2x1ZGVzKG5hbWUpKSB7XHJcbiAgICAgICAgICBleGlzdGluZy5yZWFjdG9ycy5wdXNoKG5hbWUpO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG5cclxuICAgICAgZm9yIChjb25zdCByZWFjdG9yIG9mIHJlYWN0b3JSb3dzKSB7XHJcbiAgICAgICAgY29uc3QgcmVhY3RvcklkID0gU3RyaW5nKFxyXG4gICAgICAgICAgdHlwZW9mIHJlYWN0b3IgPT09ICdvYmplY3QnXHJcbiAgICAgICAgICAgID8gcmVhY3Rvcj8uY29udGFjdF9pZCA/PyByZWFjdG9yPy5jb250YWN0SWQgPz8gcmVhY3Rvcj8uaWQgPz8gJydcclxuICAgICAgICAgICAgOiAnJ1xyXG4gICAgICAgICkudHJpbSgpO1xyXG4gICAgICAgIGNvbnN0IG5hbWUgPSBkaXNwbGF5TmFtZUZvclJlYWN0b3IocmVhY3Rvcik7XHJcbiAgICAgICAgaWYgKHJlYWN0b3JJZCAmJiByZWFjdG9ySWQgPT09IG15Q29udGFjdElkKSB7XHJcbiAgICAgICAgICBleGlzdGluZy5oYXNSZWFjdGVkID0gdHJ1ZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKG5hbWUgJiYgIWV4aXN0aW5nLnJlYWN0b3JzLmluY2x1ZGVzKG5hbWUpKSB7XHJcbiAgICAgICAgICBleGlzdGluZy5yZWFjdG9ycy5wdXNoKG5hbWUpO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG5cclxuICAgICAgY29uc3QgZGlyZWN0TmFtZSA9IFN0cmluZyhcclxuICAgICAgICByb3c/LnJlYWN0b3JfbmFtZSA/P1xyXG4gICAgICAgIHJvdz8ucmVhY3Rvck5hbWUgPz9cclxuICAgICAgICByb3c/LmNvbnRhY3RfbmFtZSA/P1xyXG4gICAgICAgIHJvdz8uY29udGFjdE5hbWUgPz9cclxuICAgICAgICByb3c/LnVzZXJuYW1lID8/XHJcbiAgICAgICAgcm93Py5lbWFpbCA/P1xyXG4gICAgICAgICcnXHJcbiAgICAgICkudHJpbSgpO1xyXG4gICAgICBpZiAoZGlyZWN0TmFtZSAmJiAhZXhpc3RpbmcucmVhY3RvcnMuaW5jbHVkZXMoZGlyZWN0TmFtZSkpIHtcclxuICAgICAgICBleGlzdGluZy5yZWFjdG9ycy5wdXNoKGNvbnRhY3RJZCA9PT0gbXlDb250YWN0SWQgPyAnWW91JyA6IGRpcmVjdE5hbWUpO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBieUVtb2ppLnNldChlbW9qaSwgZXhpc3RpbmcpO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBBcnJheS5mcm9tKGJ5RW1vamkudmFsdWVzKCkpLmZpbHRlcigocikgPT4gci5jb3VudCA+IDApO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBhcHBseVJlYWN0aW9uT3B0aW1pc3RpY2FsbHkobWVzc2FnZUlkOiBzdHJpbmcsIGVtb2ppOiBzdHJpbmcsIGFkZDogYm9vbGVhbik6IHZvaWQge1xyXG4gICAgY29uc3QgbWFwID0gbmV3IE1hcCh0aGlzLm1lc3NhZ2VzTWFwJC52YWx1ZSk7XHJcbiAgICBsZXQgZGlkVXBkYXRlID0gZmFsc2U7XHJcblxyXG4gICAgZm9yIChjb25zdCBbY29udmVyc2F0aW9uSWQsIG1zZ3NdIG9mIG1hcC5lbnRyaWVzKCkpIHtcclxuICAgICAgY29uc3QgaWR4ID0gbXNncy5maW5kSW5kZXgoKG0pID0+IFN0cmluZyhtLm1lc3NhZ2VfaWQpID09PSBTdHJpbmcobWVzc2FnZUlkKSk7XHJcbiAgICAgIGlmIChpZHggPT09IC0xKSBjb250aW51ZTtcclxuXHJcbiAgICAgIGNvbnN0IHRhcmdldCA9IG1zZ3NbaWR4XTtcclxuICAgICAgY29uc3QgbmV4dFJlYWN0aW9ucyA9IFsuLi4odGFyZ2V0LnJlYWN0aW9ucyB8fCBbXSldO1xyXG4gICAgICBjb25zdCBySWR4ID0gbmV4dFJlYWN0aW9ucy5maW5kSW5kZXgoKHIpID0+IHIuZW1vamkgPT09IGVtb2ppKTtcclxuXHJcbiAgICAgIGlmIChhZGQpIHtcclxuICAgICAgICBpZiAocklkeCA+PSAwKSB7XHJcbiAgICAgICAgICBjb25zdCBjdXJyZW50ID0gbmV4dFJlYWN0aW9uc1tySWR4XTtcclxuICAgICAgICAgIGlmICghY3VycmVudC5oYXNSZWFjdGVkKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHJlYWN0b3JzID0gQXJyYXkuaXNBcnJheShjdXJyZW50LnJlYWN0b3JzKSA/IFsuLi5jdXJyZW50LnJlYWN0b3JzXSA6IFtdO1xyXG4gICAgICAgICAgICBpZiAoIXJlYWN0b3JzLmluY2x1ZGVzKCdZb3UnKSkgcmVhY3RvcnMudW5zaGlmdCgnWW91Jyk7XHJcbiAgICAgICAgICAgIG5leHRSZWFjdGlvbnNbcklkeF0gPSB7XHJcbiAgICAgICAgICAgICAgLi4uY3VycmVudCxcclxuICAgICAgICAgICAgICBoYXNSZWFjdGVkOiB0cnVlLFxyXG4gICAgICAgICAgICAgIGNvdW50OiBOdW1iZXIoY3VycmVudC5jb3VudCB8fCAwKSArIDEsXHJcbiAgICAgICAgICAgICAgcmVhY3RvcnMsXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIG5leHRSZWFjdGlvbnMucHVzaCh7IGVtb2ppLCBjb3VudDogMSwgaGFzUmVhY3RlZDogdHJ1ZSwgcmVhY3RvcnM6IFsnWW91J10gfSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIGlmIChySWR4ID49IDApIHtcclxuICAgICAgICAgIGNvbnN0IGN1cnJlbnQgPSBuZXh0UmVhY3Rpb25zW3JJZHhdO1xyXG4gICAgICAgICAgY29uc3QgbmV4dENvdW50ID0gTWF0aC5tYXgoTnVtYmVyKGN1cnJlbnQuY291bnQgfHwgMCkgLSAoY3VycmVudC5oYXNSZWFjdGVkID8gMSA6IDApLCAwKTtcclxuICAgICAgICAgIGlmIChuZXh0Q291bnQgPT09IDApIHtcclxuICAgICAgICAgICAgbmV4dFJlYWN0aW9ucy5zcGxpY2UocklkeCwgMSk7XHJcbiAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBuZXh0UmVhY3Rpb25zW3JJZHhdID0ge1xyXG4gICAgICAgICAgICAgIC4uLmN1cnJlbnQsXHJcbiAgICAgICAgICAgICAgaGFzUmVhY3RlZDogZmFsc2UsXHJcbiAgICAgICAgICAgICAgY291bnQ6IG5leHRDb3VudCxcclxuICAgICAgICAgICAgICByZWFjdG9yczogQXJyYXkuaXNBcnJheShjdXJyZW50LnJlYWN0b3JzKVxyXG4gICAgICAgICAgICAgICAgPyBjdXJyZW50LnJlYWN0b3JzLmZpbHRlcigobmFtZTogc3RyaW5nKSA9PiBuYW1lICE9PSAnWW91JylcclxuICAgICAgICAgICAgICAgIDogY3VycmVudC5yZWFjdG9ycyxcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGNvbnN0IHVwZGF0ZWRNc2c6IE1lc3NhZ2UgPSB7IC4uLnRhcmdldCwgcmVhY3Rpb25zOiBuZXh0UmVhY3Rpb25zIH07XHJcbiAgICAgIGNvbnN0IHVwZGF0ZWRNc2dzID0gWy4uLm1zZ3NdO1xyXG4gICAgICB1cGRhdGVkTXNnc1tpZHhdID0gdXBkYXRlZE1zZztcclxuICAgICAgbWFwLnNldChjb252ZXJzYXRpb25JZCwgdXBkYXRlZE1zZ3MpO1xyXG4gICAgICBkaWRVcGRhdGUgPSB0cnVlO1xyXG4gICAgICBicmVhaztcclxuICAgIH1cclxuXHJcbiAgICBpZiAoZGlkVXBkYXRlKSB7XHJcbiAgICAgIHRoaXMubWVzc2FnZXNNYXAkLm5leHQobWFwKTtcclxuICAgIH1cclxuICB9XHJcbn1cclxuIl19