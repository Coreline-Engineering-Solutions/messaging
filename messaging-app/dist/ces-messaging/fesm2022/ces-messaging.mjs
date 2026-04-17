import * as i0 from '@angular/core';
import { InjectionToken, Inject, Injectable, Component, EventEmitter, ViewChild, Output } from '@angular/core';
import { BehaviorSubject, Subject, of, forkJoin, throwError, Observable, combineLatest } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import * as i1 from '@angular/common/http';
import { HttpParams } from '@angular/common/http';
import * as i2 from '@angular/common';
import { CommonModule } from '@angular/common';
import * as i4 from '@angular/material/icon';
import { MatIconModule } from '@angular/material/icon';
import * as i5 from '@angular/material/button';
import { MatButtonModule } from '@angular/material/button';
import * as i7 from '@angular/material/tooltip';
import { MatTooltipModule } from '@angular/material/tooltip';
import * as i3 from '@angular/forms';
import { FormsModule } from '@angular/forms';
import * as i6 from '@angular/material/core';
import { MatRippleModule } from '@angular/material/core';
import * as i7$1 from '@angular/material/progress-spinner';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

const MESSAGING_CONFIG = new InjectionToken('MESSAGING_CONFIG');

/** Get display name: username > first_name > email */
function getContactDisplayName(contact) {
    if (contact.username)
        return contact.username;
    if (contact.first_name) {
        return contact.last_name
            ? `${contact.first_name} ${contact.last_name}`
            : contact.first_name;
    }
    return contact.email;
}
/** Get display name from message sender fields */
function getMessageSenderName(msg) {
    if (msg.sender_name)
        return msg.sender_name;
    if (msg.sender_first_name) {
        return msg.sender_last_name
            ? `${msg.sender_first_name} ${msg.sender_last_name}`
            : msg.sender_first_name;
    }
    return msg.sender_username || 'Unknown';
}

class AuthService {
    http;
    config;
    sessionGid$ = new BehaviorSubject(null);
    currentContact$ = new BehaviorSubject(null);
    session$ = this.sessionGid$.asObservable();
    contact$ = this.currentContact$.asObservable();
    constructor(http, config) {
        this.http = http;
        this.config = config;
        const saved = localStorage.getItem('messaging_session');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                this.sessionGid$.next(parsed.session_gid);
                if (parsed.contact) {
                    this.currentContact$.next(parsed.contact);
                }
            }
            catch { /* ignore */ }
        }
    }
    get sessionGid() {
        return this.sessionGid$.value;
    }
    get currentContact() {
        return this.currentContact$.value;
    }
    get contactId() {
        return this.currentContact$.value?.contact_id ?? null;
    }
    login(email, password) {
        return this.http.post(`${this.config.apiBaseUrl}/auth`, {
            function: '_login',
            email,
            password,
        }).pipe(tap((res) => {
            this.sessionGid$.next(res.session_gid);
            this.persistSession();
        }));
    }
    setSession(sessionGid, contact) {
        this.sessionGid$.next(sessionGid);
        this.currentContact$.next(contact);
        this.persistSession();
    }
    setDemoSession(sessionGid, contact) {
        this.setSession(sessionGid, contact);
    }
    logout() {
        this.sessionGid$.next(null);
        this.currentContact$.next(null);
        localStorage.removeItem('messaging_session');
    }
    isAuthenticated() {
        return !!this.sessionGid$.value && !!this.currentContact$.value;
    }
    persistSession() {
        const data = {
            session_gid: this.sessionGid$.value,
            contact: this.currentContact$.value,
        };
        localStorage.setItem('messaging_session', JSON.stringify(data));
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: AuthService, deps: [{ token: i1.HttpClient }, { token: MESSAGING_CONFIG }], target: i0.ɵɵFactoryTarget.Injectable });
    static ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: AuthService, providedIn: 'root' });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: AuthService, decorators: [{
            type: Injectable,
            args: [{ providedIn: 'root' }]
        }], ctorParameters: () => [{ type: i1.HttpClient }, { type: undefined, decorators: [{
                    type: Inject,
                    args: [MESSAGING_CONFIG]
                }] }] });

class MessagingApiService {
    http;
    auth;
    config;
    base;
    constructor(http, auth, config) {
        this.http = http;
        this.auth = auth;
        this.config = config;
        this.base = `${this.config.apiBaseUrl}/messaging`;
    }
    // ── Inbox ──
    getInbox(contactId) {
        const params = new HttpParams().set('session_gid', this.auth.sessionGid);
        return this.http.get(`${this.base}/contacts/${contactId}/inbox`, { params });
    }
    // ── Messages ──
    getMessages(conversationId, contactId, beforeMessageId, limit = 50) {
        let params = new HttpParams()
            .set('contactId', contactId)
            .set('limit', limit.toString())
            .set('sessionGid', this.auth.sessionGid);
        if (beforeMessageId) {
            params = params.set('beforeMessageId', beforeMessageId);
        }
        return this.http.get(`${this.base}/conversations/${conversationId}/messages`, { params });
    }
    sendMessage(conversationId, senderContactId, content, messageType = 'TEXT', mediaUrl) {
        const body = {
            session_gid: this.auth.sessionGid,
            senderContactId,
            messageType,
        };
        if (messageType === 'TEXT') {
            body.content = content;
        }
        else {
            body.mediaUrl = mediaUrl || content;
        }
        return this.http.post(`${this.base}/conversations/${conversationId}/messages`, body);
    }
    sendDirectMessage(senderContactId, recipientContactId, content, messageType = 'TEXT') {
        return this.http.post(`${this.base}/direct-messages`, {
            session_gid: this.auth.sessionGid,
            senderContactId,
            recipientContactId,
            messageType,
            content,
        });
    }
    markConversationRead(conversationId, contactId) {
        return this.http.post(`${this.base}/conversations/${conversationId}/read`, {
            session_gid: this.auth.sessionGid,
            contactId,
        });
    }
    // ── Conversations ──
    createConversation(creatorContactId, participantContactIds, name) {
        return this.http.post(`${this.base}/conversations`, {
            session_gid: this.auth.sessionGid,
            creatorContactId,
            participantContactIds,
            name: name || null,
        });
    }
    getDirectConversation(contactA, contactB) {
        const params = new HttpParams()
            .set('contactA', contactA)
            .set('contactB', contactB)
            .set('sessionGid', this.auth.sessionGid);
        return this.http.get(`${this.base}/conversations/direct`, { params });
    }
    // ── Contacts ──
    getVisibleContacts(contactId) {
        const params = new HttpParams().set('session_gid', this.auth.sessionGid);
        return this.http.get(`${this.base}/contacts/${contactId}/visible-contacts`, { params });
    }
    checkContactProfile(userGid, updates) {
        return this.http.post(`${this.base}/contacts/check`, {
            session_gid: this.auth.sessionGid,
            userGid,
            updates: updates || {},
        });
    }
    // ── Groups ──
    manageGroup(contactId, action, conversationId, groupName, participantContactIds) {
        const body = {
            session_gid: this.auth.sessionGid,
            contactId,
            action,
        };
        if (conversationId)
            body.conversationId = conversationId;
        if (groupName)
            body.groupName = groupName;
        if (participantContactIds)
            body.participantContactIds = participantContactIds;
        return this.http.post(`${this.base}/groups`, body);
    }
    // ── Delete / Clear ──
    deleteConversation(conversationId, contactId) {
        return this.http.post(`${this.base}/conversations/${conversationId}/delete`, {
            session_gid: this.auth.sessionGid,
            contactId,
        });
    }
    clearConversation(conversationId, contactId) {
        return this.http.post(`${this.base}/conversations/${conversationId}/clear`, {
            session_gid: this.auth.sessionGid,
            contactId,
        });
    }
    deleteGroup(conversationId, contactId) {
        return this.http.post(`${this.base}/groups/${conversationId}/delete`, {
            session_gid: this.auth.sessionGid,
            contactId,
        });
    }
    // ── Attachments ──
    uploadAttachment(file) {
        const formData = new FormData();
        formData.append('file', file, file.name);
        formData.append('session_gid', this.auth.sessionGid);
        return this.http.post(`${this.base}/attachments/upload`, formData);
    }
    // ── Connections ──
    sendConnectionInvite(adminContactId, targetCompany) {
        return this.http.post(`${this.base}/connections/invites`, {
            session_gid: this.auth.sessionGid,
            adminContactId,
            targetCompany,
        });
    }
    respondToConnection(adminContactId, connectionId, accept) {
        return this.http.post(`${this.base}/connections/${connectionId}/respond`, {
            session_gid: this.auth.sessionGid,
            adminContactId,
            accept,
        });
    }
    getCompanyConnections(contactId) {
        const params = new HttpParams().set('session_gid', this.auth.sessionGid);
        return this.http.get(`${this.base}/contacts/${contactId}/connections`, { params });
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: MessagingApiService, deps: [{ token: i1.HttpClient }, { token: AuthService }, { token: MESSAGING_CONFIG }], target: i0.ɵɵFactoryTarget.Injectable });
    static ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: MessagingApiService, providedIn: 'root' });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: MessagingApiService, decorators: [{
            type: Injectable,
            args: [{ providedIn: 'root' }]
        }], ctorParameters: () => [{ type: i1.HttpClient }, { type: AuthService }, { type: undefined, decorators: [{
                    type: Inject,
                    args: [MESSAGING_CONFIG]
                }] }] });

class MessagingWebSocketService {
    config;
    ws = null;
    reconnectAttempts = 0;
    maxReconnectAttempts = 10;
    reconnectTimer = null;
    pingInterval = null;
    subscribedConversations = new Set();
    contactId = null;
    sessionGid = null;
    messages$ = new Subject();
    connectionStatus$ = new BehaviorSubject('disconnected');
    onMessage$ = this.messages$.asObservable();
    status$ = this.connectionStatus$.asObservable();
    constructor(config) {
        this.config = config;
    }
    get isConnected() {
        return this.ws?.readyState === WebSocket.OPEN;
    }
    connect(contactId, sessionGid) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN && this.contactId === contactId) {
            return;
        }
        this.contactId = contactId;
        this.sessionGid = sessionGid;
        this.reconnectAttempts = 0;
        this.doConnect();
    }
    disconnect() {
        this.stopPing();
        clearTimeout(this.reconnectTimer);
        if (this.ws) {
            this.ws.onclose = null;
            this.ws.close();
            this.ws = null;
        }
        this.connectionStatus$.next('disconnected');
    }
    subscribe(conversationId) {
        this.subscribedConversations.add(conversationId);
        this.send({ action: 'subscribe', conversation_id: conversationId });
    }
    unsubscribe(conversationId) {
        this.subscribedConversations.delete(conversationId);
        this.send({ action: 'unsubscribe', conversation_id: conversationId });
    }
    subscribeAll(conversationIds) {
        conversationIds.forEach((id) => this.subscribe(id));
    }
    ngOnDestroy() {
        this.disconnect();
        this.messages$.complete();
    }
    doConnect() {
        if (!this.contactId || !this.sessionGid)
            return;
        this.connectionStatus$.next('connecting');
        console.log('WebSocket connecting to:', `${this.config.wsBaseUrl}/messaging/ws/${this.contactId}`);
        try {
            this.ws = new WebSocket(`${this.config.wsBaseUrl}/messaging/ws/${this.contactId}`);
        }
        catch (err) {
            console.error('WebSocket connection failed:', err);
            this.attemptReconnect();
            return;
        }
        this.ws.onopen = () => {
            console.log('WebSocket connected');
            this.connectionStatus$.next('connected');
            this.reconnectAttempts = 0;
            this.authenticate();
            this.resubscribe();
            this.startPing();
        };
        this.ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                console.log('WebSocket message received:', msg.type, msg);
                if (msg.type === 'auth_success') {
                    console.log('WebSocket authenticated');
                    this.connectionStatus$.next('authenticated');
                }
                this.messages$.next(msg);
            }
            catch (err) {
                console.error('WebSocket message parse error:', err);
            }
        };
        this.ws.onerror = () => {
            // onerror is followed by onclose
        };
        this.ws.onclose = (event) => {
            console.log('WebSocket closed:', event.code, event.reason);
            this.connectionStatus$.next('disconnected');
            this.stopPing();
            this.attemptReconnect();
        };
    }
    authenticate() {
        this.send({ action: 'auth', session_gid: this.sessionGid });
    }
    resubscribe() {
        this.subscribedConversations.forEach((id) => {
            this.send({ action: 'subscribe', conversation_id: id });
        });
    }
    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts)
            return;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
        this.reconnectTimer = setTimeout(() => this.doConnect(), delay);
        this.reconnectAttempts++;
    }
    startPing() {
        this.stopPing();
        this.pingInterval = setInterval(() => {
            this.send({ action: 'ping' });
        }, 25000);
    }
    stopPing() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }
    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            console.log('WebSocket sending:', data.action);
            this.ws.send(JSON.stringify(data));
        }
        else {
            console.warn('WebSocket not open, cannot send:', data.action);
        }
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: MessagingWebSocketService, deps: [{ token: MESSAGING_CONFIG }], target: i0.ɵɵFactoryTarget.Injectable });
    static ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: MessagingWebSocketService, providedIn: 'root' });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: MessagingWebSocketService, decorators: [{
            type: Injectable,
            args: [{ providedIn: 'root' }]
        }], ctorParameters: () => [{ type: undefined, decorators: [{
                    type: Inject,
                    args: [MESSAGING_CONFIG]
                }] }] });

class MessagingFileService {
    http;
    auth;
    config;
    storageUrl;
    messagingUrl;
    constructor(http, auth, config) {
        this.http = http;
        this.auth = auth;
        this.config = config;
        this.storageUrl = config.storageApiUrl;
        this.messagingUrl = `${config.apiBaseUrl}/messaging`;
    }
    uploadFile(file, category = 'messaging_attachments') {
        const formData = new FormData();
        formData.append('file', file, file.name);
        formData.append('category', category);
        return this.http
            .post(`${this.storageUrl}/storage/upload`, formData)
            .pipe(catchError(this.handleError));
    }
    uploadFiles(files) {
        if (files.length === 0)
            return of([]);
        return forkJoin(files.map((f) => this.uploadFile(f)));
    }
    retrieveFile(fileId) {
        const formData = new FormData();
        formData.append('file_id', fileId);
        return this.http
            .post(`${this.storageUrl}/storage/retrieve`, formData)
            .pipe(catchError(this.handleError));
    }
    getFileDataUrl(fileId) {
        return this.retrieveFile(fileId).pipe(map((r) => `data:${r.mime_type};base64,${r.base64_data}`));
    }
    deleteFile(fileId) {
        const formData = new FormData();
        formData.append('file_id', fileId);
        return this.http
            .post(`${this.storageUrl}/storage/delete`, formData)
            .pipe(catchError(this.handleError));
    }
    sendMessageWithAttachments(conversationId, senderContactId, content, fileIds, filenames) {
        return this.http.post(`${this.messagingUrl}/conversations/${conversationId}/messages`, {
            session_gid: this.auth.sessionGid,
            senderContactId,
            messageType: fileIds.length > 0 ? 'FILE' : 'TEXT',
            content,
            attachment_ids: fileIds,
            filenames,
        });
    }
    handleError(error) {
        let msg = 'File operation failed';
        if (error.status === 401)
            msg = 'Unauthorized file access';
        else if (error.status === 404)
            msg = 'File not found';
        else if (error.status === 0)
            msg = 'Network error or CORS issue';
        else if (error.error?.detail)
            msg = error.error.detail;
        console.error('MessagingFileService error:', msg);
        return throwError(() => new Error(msg));
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: MessagingFileService, deps: [{ token: i1.HttpClient }, { token: AuthService }, { token: MESSAGING_CONFIG }], target: i0.ɵɵFactoryTarget.Injectable });
    static ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: MessagingFileService, providedIn: 'root' });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: MessagingFileService, decorators: [{
            type: Injectable,
            args: [{ providedIn: 'root' }]
        }], ctorParameters: () => [{ type: i1.HttpClient }, { type: AuthService }, { type: undefined, decorators: [{
                    type: Inject,
                    args: [MESSAGING_CONFIG]
                }] }] });

class MessagingAuthBridgeService {
    http;
    config;
    constructor(http, config) {
        this.http = http;
        this.config = config;
    }
    /**
     * Authenticate with auth-api using email and password.
     * Returns session_gid and contact information.
     */
    authenticateForMessaging(email, password) {
        return this.http.post(`${this.config.apiBaseUrl}/auth`, {
            function: '_login',
            email,
            password
        }).pipe(map(response => {
            const session = {
                session_gid: response.session_gid,
                session_expires: response.session_expires
            };
            const contact = {
                contact_id: response.contact_id || response.user_id,
                user_gid: response.user_gid || response.session_gid,
                first_name: response.first_name || email.split('@')[0],
                last_name: response.last_name || '',
                email: email,
                company_name: response.company_name || 'Coreline Engineering Solutions',
                is_active: true
            };
            return { session, contact };
        }), catchError(error => {
            console.error('Messaging authentication failed:', error);
            return throwError(() => error);
        }));
    }
    /**
     * Check if a messaging session exists in localStorage.
     */
    hasStoredSession() {
        const stored = localStorage.getItem('messaging_session');
        if (!stored)
            return false;
        try {
            const parsed = JSON.parse(stored);
            return !!parsed.session_gid && !!parsed.contact;
        }
        catch {
            return false;
        }
    }
    /**
     * Attempt to use existing session to get messaging session.
     */
    initializeFromExistingSession(email) {
        if (this.hasStoredSession()) {
            return of(null); // Already authenticated
        }
        console.log('Messaging authentication required for:', email);
        return of(null);
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: MessagingAuthBridgeService, deps: [{ token: i1.HttpClient }, { token: MESSAGING_CONFIG }], target: i0.ɵɵFactoryTarget.Injectable });
    static ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: MessagingAuthBridgeService, providedIn: 'root' });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: MessagingAuthBridgeService, decorators: [{
            type: Injectable,
            args: [{ providedIn: 'root' }]
        }], ctorParameters: () => [{ type: i1.HttpClient }, { type: undefined, decorators: [{
                    type: Inject,
                    args: [MESSAGING_CONFIG]
                }] }] });

class MessagingStoreService {
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
    // ── Polling fallback ──
    startPolling() {
        this.stopPolling();
        this.pollTimer = setInterval(() => {
            this.loadInbox();
            const activeId = this.activeConversationId$.value;
            if (activeId) {
                this.loadMessages(activeId);
            }
        }, 5000);
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
        this.loadMessages(conversationId);
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
    loadMessages(conversationId, beforeMessageId) {
        const contactId = this.auth.contactId;
        if (!contactId)
            return;
        this.loadingMessages$.next(true);
        this.api.getMessages(conversationId, contactId, beforeMessageId, 50).subscribe({
            next: (messages) => {
                const map = new Map(this.messagesMap$.value);
                const existing = map.get(conversationId) || [];
                const sorted = [...messages].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                if (beforeMessageId) {
                    map.set(conversationId, [...sorted, ...existing]);
                }
                else {
                    map.set(conversationId, sorted);
                }
                this.messagesMap$.next(map);
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
                if (res?.conversation_id) {
                    const recipient = this.visibleContacts$.value.find((c) => c.contact_id === recipientContactId);
                    const name = recipient ? getContactDisplayName(recipient) : 'Direct Message';
                    this.openConversation(res.conversation_id, name, false);
                }
            },
            error: (err) => console.error('Failed to send DM:', err),
        });
    }
    createGroupConversation(participantIds, name) {
        const contactId = this.auth.contactId;
        if (!contactId)
            return;
        this.api.createConversation(contactId, participantIds, name).subscribe({
            next: (conv) => {
                this.loadInbox();
                this.openConversation(conv.conversation_id, name, true);
            },
            error: (err) => console.error('Failed to create group:', err),
        });
    }
    markAsRead(conversationId) {
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
                break;
            case 'error':
                console.error('WebSocket error:', msg.message);
                break;
        }
    }
    handleNewMessage(data) {
        if (!data)
            return;
        const message = {
            message_id: data.message_id,
            conversation_id: data.conversation_id,
            sender_id: data.sender_id,
            sender_name: data.sender_name || data.sender_username,
            sender_username: data.sender_username,
            sender_first_name: data.sender_first_name,
            sender_last_name: data.sender_last_name,
            message_type: data.message_type,
            content: data.content,
            media_url: data.media_url,
            created_at: data.created_at,
            is_read: data.is_read,
        };
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
    appendMessage(message) {
        const map = new Map(this.messagesMap$.value);
        const msgs = [...(map.get(message.conversation_id) || []), message];
        map.set(message.conversation_id, msgs);
        this.messagesMap$.next(map);
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
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: MessagingStoreService, deps: [{ token: AuthService }, { token: MessagingApiService }, { token: MessagingWebSocketService }], target: i0.ɵɵFactoryTarget.Injectable });
    static ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: MessagingStoreService, providedIn: 'root' });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: MessagingStoreService, decorators: [{
            type: Injectable,
            args: [{ providedIn: 'root' }]
        }], ctorParameters: () => [{ type: AuthService }, { type: MessagingApiService }, { type: MessagingWebSocketService }] });

class FloatingButtonComponent {
    store;
    unreadCount = 0;
    side = 'right';
    isOpen = false;
    sub;
    constructor(store) {
        this.store = store;
    }
    ngOnInit() {
        this.sub = combineLatest([
            this.store.totalUnread,
            this.store.sidebarSide,
            this.store.panelOpen,
        ]).subscribe(([count, side, open]) => {
            this.unreadCount = count;
            this.side = side;
            this.isOpen = open;
        });
    }
    ngOnDestroy() {
        this.sub?.unsubscribe();
    }
    toggle() {
        this.store.togglePanel();
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: FloatingButtonComponent, deps: [{ token: MessagingStoreService }], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "17.3.12", type: FloatingButtonComponent, isStandalone: true, selector: "app-floating-button", ngImport: i0, template: `
    <div
      *ngIf="!isOpen"
      class="floating-btn"
      [class.side-left]="side === 'left'"
      [class.side-right]="side === 'right'"
      (click)="toggle()"
    >
      <div class="fab-inner" [class.has-unread]="unreadCount > 0">
        <svg class="ces-logo" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <path d="M 15 20 Q 15 15 20 15 L 80 15 Q 85 15 85 20 L 85 60 Q 85 65 80 65 L 35 65 L 20 80 L 20 65 Q 15 65 15 60 Z"
                fill="none" stroke="white" stroke-width="3"/>
          <g transform="translate(50, 40) scale(0.35)">
            <path d="M 0,-30 L 25,-15 L 25,15 L 0,30 L -25,15 L -25,-15 Z" fill="white"/>
          </g>
        </svg>
        <span *ngIf="unreadCount > 0" class="badge">{{ unreadCount > 99 ? '99+' : unreadCount }}</span>
      </div>
    </div>
  `, isInline: true, styles: [".floating-btn{position:fixed;bottom:20px;z-index:10000;cursor:pointer;-webkit-user-select:none;user-select:none}.floating-btn.side-right{right:20px}.floating-btn.side-left{left:20px}.fab-inner{width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#1f4bd8,#173396);display:flex;align-items:center;justify-content:center;box-shadow:0 3px 16px #17339666;transition:transform .2s ease,box-shadow .2s ease;position:relative}.fab-inner:hover{transform:scale(1.1);box-shadow:0 4px 20px #17339699}.fab-inner.has-unread{animation:pulse 2s infinite}.ces-logo{width:24px;height:24px}.badge{position:absolute;top:-4px;right:-4px;background:#ef4444;color:#fff;border-radius:10px;min-width:18px;height:18px;font-size:10px;font-weight:600;display:flex;align-items:center;justify-content:center;padding:0 4px;border:2px solid #fff}@keyframes pulse{0%,to{box-shadow:0 3px 16px #17339666}50%{box-shadow:0 3px 24px #173396b3}}\n"], dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i2.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: FloatingButtonComponent, decorators: [{
            type: Component,
            args: [{ selector: 'app-floating-button', standalone: true, imports: [CommonModule], template: `
    <div
      *ngIf="!isOpen"
      class="floating-btn"
      [class.side-left]="side === 'left'"
      [class.side-right]="side === 'right'"
      (click)="toggle()"
    >
      <div class="fab-inner" [class.has-unread]="unreadCount > 0">
        <svg class="ces-logo" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <path d="M 15 20 Q 15 15 20 15 L 80 15 Q 85 15 85 20 L 85 60 Q 85 65 80 65 L 35 65 L 20 80 L 20 65 Q 15 65 15 60 Z"
                fill="none" stroke="white" stroke-width="3"/>
          <g transform="translate(50, 40) scale(0.35)">
            <path d="M 0,-30 L 25,-15 L 25,15 L 0,30 L -25,15 L -25,-15 Z" fill="white"/>
          </g>
        </svg>
        <span *ngIf="unreadCount > 0" class="badge">{{ unreadCount > 99 ? '99+' : unreadCount }}</span>
      </div>
    </div>
  `, styles: [".floating-btn{position:fixed;bottom:20px;z-index:10000;cursor:pointer;-webkit-user-select:none;user-select:none}.floating-btn.side-right{right:20px}.floating-btn.side-left{left:20px}.fab-inner{width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#1f4bd8,#173396);display:flex;align-items:center;justify-content:center;box-shadow:0 3px 16px #17339666;transition:transform .2s ease,box-shadow .2s ease;position:relative}.fab-inner:hover{transform:scale(1.1);box-shadow:0 4px 20px #17339699}.fab-inner.has-unread{animation:pulse 2s infinite}.ces-logo{width:24px;height:24px}.badge{position:absolute;top:-4px;right:-4px;background:#ef4444;color:#fff;border-radius:10px;min-width:18px;height:18px;font-size:10px;font-weight:600;display:flex;align-items:center;justify-content:center;padding:0 4px;border:2px solid #fff}@keyframes pulse{0%,to{box-shadow:0 3px 16px #17339666}50%{box-shadow:0 3px 24px #173396b3}}\n"] }]
        }], ctorParameters: () => [{ type: MessagingStoreService }] });

class InboxListComponent {
    store;
    inbox = [];
    searchQuery = '';
    contextMenu = null;
    sub;
    constructor(store) {
        this.store = store;
    }
    ngOnInit() {
        this.sub = this.store.inbox.subscribe((items) => (this.inbox = items));
    }
    ngOnDestroy() {
        this.sub?.unsubscribe();
    }
    get filteredInbox() {
        if (!this.searchQuery.trim())
            return this.inbox;
        const q = this.searchQuery.toLowerCase();
        return this.inbox.filter((item) => (item.name || '').toLowerCase().includes(q) ||
            (item.last_message_preview || '').toLowerCase().includes(q));
    }
    openConversation(item) {
        this.store.openConversation(item.conversation_id, item.name || 'Chat', item.is_group);
    }
    onNewConversation() {
        this.store.setView('new-conversation');
    }
    onCreateGroup() {
        this.store.setView('group-manager');
    }
    onContextMenu(event, item) {
        event.preventDefault();
        event.stopPropagation();
        this.contextMenu = { x: event.clientX, y: event.clientY, item };
    }
    closeContextMenu() {
        this.contextMenu = null;
    }
    clearChat() {
        if (!this.contextMenu)
            return;
        const id = this.contextMenu.item.conversation_id;
        this.store.clearConversation(id);
        this.contextMenu = null;
    }
    deleteChat() {
        if (!this.contextMenu)
            return;
        const item = this.contextMenu.item;
        if (item.is_group) {
            this.store.deleteGroup(item.conversation_id);
        }
        else {
            this.store.deleteConversation(item.conversation_id);
        }
        this.contextMenu = null;
    }
    formatTime(dateStr) {
        if (!dateStr)
            return '';
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        if (diffMins < 1)
            return 'now';
        if (diffMins < 60)
            return `${diffMins}m`;
        if (diffHours < 24)
            return `${diffHours}h`;
        if (diffDays < 7)
            return `${diffDays}d`;
        return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: InboxListComponent, deps: [{ token: MessagingStoreService }], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "17.3.12", type: InboxListComponent, isStandalone: true, selector: "app-inbox-list", ngImport: i0, template: `
    <div class="inbox-container">
      <div class="inbox-header">
        <h3>Messages</h3>
        <div class="header-actions">
          <button mat-icon-button class="hdr-btn" (click)="onNewConversation()" matTooltip="New conversation" matTooltipPosition="below">
            <mat-icon>edit_square</mat-icon>
          </button>
          <button mat-icon-button class="hdr-btn" (click)="onCreateGroup()" matTooltip="Create group" matTooltipPosition="below">
            <mat-icon>group_add</mat-icon>
          </button>
        </div>
      </div>

      <div class="search-bar">
        <mat-icon class="search-icon">search</mat-icon>
        <input
          type="text"
          [(ngModel)]="searchQuery"
          placeholder="Search conversations..."
          class="search-input"
        />
      </div>

      <div class="conversation-list">
        <div
          *ngFor="let item of filteredInbox"
          class="conversation-item"
          matRipple
          [class.has-unread]="item.unread_count > 0"
          (click)="openConversation(item)"
          (contextmenu)="onContextMenu($event, item)"
        >
          <div class="avatar" [class.group-avatar]="item.is_group">
            <mat-icon>{{ item.is_group ? 'group' : 'person' }}</mat-icon>
          </div>
          <div class="conversation-info">
            <div class="info-top">
              <span class="conv-name">{{ item.name || 'Direct Message' }}</span>
              <span class="conv-time">{{ formatTime(item.last_message_at) }}</span>
            </div>
            <div class="info-bottom">
              <span class="conv-preview">{{ item.last_message_preview || 'No messages yet' }}</span>
              <span *ngIf="item.unread_count > 0" class="unread-badge">
                {{ item.unread_count > 99 ? '99+' : item.unread_count }}
              </span>
            </div>
          </div>
        </div>

        <div *ngIf="filteredInbox.length === 0" class="empty-state">
          <mat-icon>forum</mat-icon>
          <p>{{ searchQuery ? 'No matching conversations' : 'No conversations yet' }}</p>
          <button *ngIf="!searchQuery" mat-stroked-button color="primary" (click)="onNewConversation()">
            Start a conversation
          </button>
        </div>
      </div>

      <!-- Context Menu -->
      <div
        *ngIf="contextMenu"
        class="context-menu"
        [style.top.px]="contextMenu.y"
        [style.left.px]="contextMenu.x"
      >
        <div class="ctx-item" (click)="clearChat()">
          <mat-icon>cleaning_services</mat-icon>
          <span>Clear conversation</span>
        </div>
        <div class="ctx-item ctx-danger" (click)="deleteChat()">
          <mat-icon>delete</mat-icon>
          <span>{{ contextMenu.item.is_group ? 'Delete group' : 'Delete conversation' }}</span>
        </div>
      </div>
      <div *ngIf="contextMenu" class="ctx-backdrop" (click)="closeContextMenu()"></div>
    </div>
  `, isInline: true, styles: [".inbox-container{display:flex;flex-direction:column;height:100%;background:transparent}.inbox-header{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid rgba(255,255,255,.2)}.inbox-header h3{margin:0;font-size:20px;font-weight:700;color:#fff}.header-actions{display:flex;gap:4px}.hdr-btn{border-radius:6px!important;transition:background .15s,box-shadow .15s}.hdr-btn:hover{background:#ffffff26!important;box-shadow:0 2px 8px #0003}.hdr-btn mat-icon{font-size:20px;color:#ffffffe6}.search-bar{display:flex;align-items:center;margin:4px 16px 8px;padding:8px 12px;background:transparent;border-radius:10px}.search-icon{color:#ffffffb3;font-size:18px;width:20px;height:20px;margin-right:8px}.search-input{flex:1;border:none;outline:none;background:transparent;font-size:14px;color:#fff}.search-input::placeholder{color:#fff9}.conversation-list{flex:1;overflow-y:auto}.conversation-item{display:flex;align-items:center;padding:12px 16px;cursor:pointer;transition:background .15s;gap:12px}.conversation-item:hover{background:#ffffff1a}.conversation-item.has-unread{background:#ffffff26}.avatar{width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#dbeafe,#93c5fd);display:flex;align-items:center;justify-content:center;flex-shrink:0}.avatar mat-icon{color:#1f4bd8;font-size:24px}.group-avatar{background:linear-gradient(135deg,#dbeafe,#60a5fa)}.group-avatar mat-icon{color:#173396}.conversation-info{flex:1;min-width:0}.info-top{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:2px}.conv-name{font-weight:600;font-size:14px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px}.conv-time{font-size:11px;color:#ffffffb3;flex-shrink:0;margin-left:8px}.info-bottom{display:flex;justify-content:space-between;align-items:center}.conv-preview{font-size:13px;color:#ffffffb3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px}.has-unread .conv-name{color:#fff}.has-unread .conv-preview{color:#374151;font-weight:500}.unread-badge{background:#1f4bd8;color:#fff;border-radius:10px;min-width:20px;height:20px;font-size:11px;font-weight:600;display:flex;align-items:center;justify-content:center;padding:0 6px;flex-shrink:0}.empty-state{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 24px;color:#9ca3af}.empty-state mat-icon{font-size:48px;width:48px;height:48px;margin-bottom:12px}.empty-state p{margin:0 0 16px;font-size:14px}.context-menu{position:fixed;z-index:10001;background:#1e1e2e;border-radius:8px;padding:4px 0;box-shadow:0 8px 24px #0000004d;min-width:200px}.ctx-item{display:flex;align-items:center;gap:10px;padding:10px 16px;cursor:pointer;color:#ffffffe6;font-size:13px;transition:background .15s}.ctx-item:hover{background:#ffffff1a}.ctx-item mat-icon{font-size:18px;width:18px;height:18px}.ctx-danger{color:#f87171}.ctx-danger:hover{background:#f8717126}.ctx-backdrop{position:fixed;inset:0;z-index:10000}\n"], dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i2.NgForOf, selector: "[ngFor][ngForOf]", inputs: ["ngForOf", "ngForTrackBy", "ngForTemplate"] }, { kind: "directive", type: i2.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "ngmodule", type: FormsModule }, { kind: "directive", type: i3.DefaultValueAccessor, selector: "input:not([type=checkbox])[formControlName],textarea[formControlName],input:not([type=checkbox])[formControl],textarea[formControl],input:not([type=checkbox])[ngModel],textarea[ngModel],[ngDefaultControl]" }, { kind: "directive", type: i3.NgControlStatus, selector: "[formControlName],[ngModel],[formControl]" }, { kind: "directive", type: i3.NgModel, selector: "[ngModel]:not([formControlName]):not([formControl])", inputs: ["name", "disabled", "ngModel", "ngModelOptions"], outputs: ["ngModelChange"], exportAs: ["ngModel"] }, { kind: "ngmodule", type: MatIconModule }, { kind: "component", type: i4.MatIcon, selector: "mat-icon", inputs: ["color", "inline", "svgIcon", "fontSet", "fontIcon"], exportAs: ["matIcon"] }, { kind: "ngmodule", type: MatButtonModule }, { kind: "component", type: i5.MatButton, selector: "    button[mat-button], button[mat-raised-button], button[mat-flat-button],    button[mat-stroked-button]  ", exportAs: ["matButton"] }, { kind: "component", type: i5.MatIconButton, selector: "button[mat-icon-button]", exportAs: ["matButton"] }, { kind: "ngmodule", type: MatRippleModule }, { kind: "directive", type: i6.MatRipple, selector: "[mat-ripple], [matRipple]", inputs: ["matRippleColor", "matRippleUnbounded", "matRippleCentered", "matRippleRadius", "matRippleAnimation", "matRippleDisabled", "matRippleTrigger"], exportAs: ["matRipple"] }, { kind: "ngmodule", type: MatTooltipModule }, { kind: "directive", type: i7.MatTooltip, selector: "[matTooltip]", inputs: ["matTooltipPosition", "matTooltipPositionAtOrigin", "matTooltipDisabled", "matTooltipShowDelay", "matTooltipHideDelay", "matTooltipTouchGestures", "matTooltip", "matTooltipClass"], exportAs: ["matTooltip"] }] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: InboxListComponent, decorators: [{
            type: Component,
            args: [{ selector: 'app-inbox-list', standalone: true, imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatRippleModule, MatTooltipModule], template: `
    <div class="inbox-container">
      <div class="inbox-header">
        <h3>Messages</h3>
        <div class="header-actions">
          <button mat-icon-button class="hdr-btn" (click)="onNewConversation()" matTooltip="New conversation" matTooltipPosition="below">
            <mat-icon>edit_square</mat-icon>
          </button>
          <button mat-icon-button class="hdr-btn" (click)="onCreateGroup()" matTooltip="Create group" matTooltipPosition="below">
            <mat-icon>group_add</mat-icon>
          </button>
        </div>
      </div>

      <div class="search-bar">
        <mat-icon class="search-icon">search</mat-icon>
        <input
          type="text"
          [(ngModel)]="searchQuery"
          placeholder="Search conversations..."
          class="search-input"
        />
      </div>

      <div class="conversation-list">
        <div
          *ngFor="let item of filteredInbox"
          class="conversation-item"
          matRipple
          [class.has-unread]="item.unread_count > 0"
          (click)="openConversation(item)"
          (contextmenu)="onContextMenu($event, item)"
        >
          <div class="avatar" [class.group-avatar]="item.is_group">
            <mat-icon>{{ item.is_group ? 'group' : 'person' }}</mat-icon>
          </div>
          <div class="conversation-info">
            <div class="info-top">
              <span class="conv-name">{{ item.name || 'Direct Message' }}</span>
              <span class="conv-time">{{ formatTime(item.last_message_at) }}</span>
            </div>
            <div class="info-bottom">
              <span class="conv-preview">{{ item.last_message_preview || 'No messages yet' }}</span>
              <span *ngIf="item.unread_count > 0" class="unread-badge">
                {{ item.unread_count > 99 ? '99+' : item.unread_count }}
              </span>
            </div>
          </div>
        </div>

        <div *ngIf="filteredInbox.length === 0" class="empty-state">
          <mat-icon>forum</mat-icon>
          <p>{{ searchQuery ? 'No matching conversations' : 'No conversations yet' }}</p>
          <button *ngIf="!searchQuery" mat-stroked-button color="primary" (click)="onNewConversation()">
            Start a conversation
          </button>
        </div>
      </div>

      <!-- Context Menu -->
      <div
        *ngIf="contextMenu"
        class="context-menu"
        [style.top.px]="contextMenu.y"
        [style.left.px]="contextMenu.x"
      >
        <div class="ctx-item" (click)="clearChat()">
          <mat-icon>cleaning_services</mat-icon>
          <span>Clear conversation</span>
        </div>
        <div class="ctx-item ctx-danger" (click)="deleteChat()">
          <mat-icon>delete</mat-icon>
          <span>{{ contextMenu.item.is_group ? 'Delete group' : 'Delete conversation' }}</span>
        </div>
      </div>
      <div *ngIf="contextMenu" class="ctx-backdrop" (click)="closeContextMenu()"></div>
    </div>
  `, styles: [".inbox-container{display:flex;flex-direction:column;height:100%;background:transparent}.inbox-header{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid rgba(255,255,255,.2)}.inbox-header h3{margin:0;font-size:20px;font-weight:700;color:#fff}.header-actions{display:flex;gap:4px}.hdr-btn{border-radius:6px!important;transition:background .15s,box-shadow .15s}.hdr-btn:hover{background:#ffffff26!important;box-shadow:0 2px 8px #0003}.hdr-btn mat-icon{font-size:20px;color:#ffffffe6}.search-bar{display:flex;align-items:center;margin:4px 16px 8px;padding:8px 12px;background:transparent;border-radius:10px}.search-icon{color:#ffffffb3;font-size:18px;width:20px;height:20px;margin-right:8px}.search-input{flex:1;border:none;outline:none;background:transparent;font-size:14px;color:#fff}.search-input::placeholder{color:#fff9}.conversation-list{flex:1;overflow-y:auto}.conversation-item{display:flex;align-items:center;padding:12px 16px;cursor:pointer;transition:background .15s;gap:12px}.conversation-item:hover{background:#ffffff1a}.conversation-item.has-unread{background:#ffffff26}.avatar{width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#dbeafe,#93c5fd);display:flex;align-items:center;justify-content:center;flex-shrink:0}.avatar mat-icon{color:#1f4bd8;font-size:24px}.group-avatar{background:linear-gradient(135deg,#dbeafe,#60a5fa)}.group-avatar mat-icon{color:#173396}.conversation-info{flex:1;min-width:0}.info-top{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:2px}.conv-name{font-weight:600;font-size:14px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px}.conv-time{font-size:11px;color:#ffffffb3;flex-shrink:0;margin-left:8px}.info-bottom{display:flex;justify-content:space-between;align-items:center}.conv-preview{font-size:13px;color:#ffffffb3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px}.has-unread .conv-name{color:#fff}.has-unread .conv-preview{color:#374151;font-weight:500}.unread-badge{background:#1f4bd8;color:#fff;border-radius:10px;min-width:20px;height:20px;font-size:11px;font-weight:600;display:flex;align-items:center;justify-content:center;padding:0 6px;flex-shrink:0}.empty-state{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 24px;color:#9ca3af}.empty-state mat-icon{font-size:48px;width:48px;height:48px;margin-bottom:12px}.empty-state p{margin:0 0 16px;font-size:14px}.context-menu{position:fixed;z-index:10001;background:#1e1e2e;border-radius:8px;padding:4px 0;box-shadow:0 8px 24px #0000004d;min-width:200px}.ctx-item{display:flex;align-items:center;gap:10px;padding:10px 16px;cursor:pointer;color:#ffffffe6;font-size:13px;transition:background .15s}.ctx-item:hover{background:#ffffff1a}.ctx-item mat-icon{font-size:18px;width:18px;height:18px}.ctx-danger{color:#f87171}.ctx-danger:hover{background:#f8717126}.ctx-backdrop{position:fixed;inset:0;z-index:10000}\n"] }]
        }], ctorParameters: () => [{ type: MessagingStoreService }] });

class MessageInputComponent {
    messageSent = new EventEmitter();
    messageWithFiles = new EventEmitter();
    fileInput;
    messageText = '';
    selectedFiles = [];
    isDragOver = false;
    get canSend() {
        return this.messageText.trim().length > 0 || this.selectedFiles.length > 0;
    }
    send() {
        if (!this.canSend)
            return;
        const text = this.messageText.trim();
        if (this.selectedFiles.length > 0) {
            this.messageWithFiles.emit({ text, files: [...this.selectedFiles] });
        }
        else {
            this.messageSent.emit(text);
        }
        this.messageText = '';
        this.selectedFiles = [];
        if (this.fileInput)
            this.fileInput.nativeElement.value = '';
    }
    onEnter(event) {
        const ke = event;
        if (!ke.shiftKey) {
            ke.preventDefault();
            this.send();
        }
    }
    onFilesSelected(event) {
        const input = event.target;
        if (input.files) {
            this.selectedFiles = [...this.selectedFiles, ...Array.from(input.files)];
        }
    }
    removeFile(index) {
        this.selectedFiles.splice(index, 1);
        this.selectedFiles = [...this.selectedFiles];
    }
    onDragOver(event) {
        event.preventDefault();
        event.stopPropagation();
        this.isDragOver = true;
    }
    onDragLeave(event) {
        event.preventDefault();
        event.stopPropagation();
        this.isDragOver = false;
    }
    onDrop(event) {
        event.preventDefault();
        event.stopPropagation();
        this.isDragOver = false;
        if (event.dataTransfer?.files) {
            this.selectedFiles = [...this.selectedFiles, ...Array.from(event.dataTransfer.files)];
        }
    }
    getFileIcon(file) {
        const type = file.type;
        if (type.startsWith('image/'))
            return 'image';
        if (type.startsWith('video/'))
            return 'videocam';
        if (type.startsWith('audio/'))
            return 'audiotrack';
        if (type.includes('pdf'))
            return 'picture_as_pdf';
        if (type.includes('spreadsheet') || type.includes('excel'))
            return 'table_chart';
        if (type.includes('document') || type.includes('word'))
            return 'description';
        return 'insert_drive_file';
    }
    formatSize(bytes) {
        if (bytes < 1024)
            return bytes + ' B';
        if (bytes < 1024 * 1024)
            return (bytes / 1024).toFixed(0) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: MessageInputComponent, deps: [], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "17.3.12", type: MessageInputComponent, isStandalone: true, selector: "app-message-input", outputs: { messageSent: "messageSent", messageWithFiles: "messageWithFiles" }, viewQueries: [{ propertyName: "fileInput", first: true, predicate: ["fileInput"], descendants: true }], ngImport: i0, template: `
    <div
      class="message-input-container"
      (dragover)="onDragOver($event)"
      (dragleave)="onDragLeave($event)"
      (drop)="onDrop($event)"
      [class.drag-over]="isDragOver"
    >
      <!-- File previews -->
      <div *ngIf="selectedFiles.length > 0" class="file-previews">
        <div *ngFor="let file of selectedFiles; let i = index" class="file-chip">
          <mat-icon class="file-icon">{{ getFileIcon(file) }}</mat-icon>
          <span class="file-name">{{ file.name }}</span>
          <span class="file-size">{{ formatSize(file.size) }}</span>
          <button mat-icon-button class="file-remove" (click)="removeFile(i)">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>

      <div class="input-wrapper">
        <button mat-icon-button class="attach-btn" (click)="fileInput.click()" title="Attach files">
          <mat-icon>attach_file</mat-icon>
        </button>
        <input
          #fileInput
          type="file"
          multiple
          style="display:none"
          (change)="onFilesSelected($event)"
        />
        <textarea
          [(ngModel)]="messageText"
          (keydown.enter)="onEnter($event)"
          placeholder="Type a message..."
          rows="1"
          class="message-textarea"
        ></textarea>
        <button
          mat-icon-button
          class="send-btn"
          [disabled]="!canSend"
          (click)="send()"
        >
          <mat-icon>send</mat-icon>
        </button>
      </div>

      <!-- Drag overlay -->
      <div *ngIf="isDragOver" class="drag-overlay">
        <mat-icon>cloud_upload</mat-icon>
        <span>Drop files here</span>
      </div>
    </div>
  `, isInline: true, styles: [".message-input-container{padding:8px 12px;border-top:1px solid rgba(255,255,255,.15);background:transparent;position:relative}.message-input-container.drag-over{background:#ffffff1a}.file-previews{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;max-height:80px;overflow-y:auto}.file-chip{display:flex;align-items:center;gap:4px;background:#ffffff26;border-radius:8px;padding:4px 4px 4px 8px;max-width:200px}.file-icon{font-size:16px;width:16px;height:16px;color:#fffc}.file-name{font-size:12px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100px}.file-size{font-size:10px;color:#ffffff80;flex-shrink:0}.file-remove{width:20px!important;height:20px!important}.file-remove mat-icon{font-size:14px;width:14px;height:14px;color:#fff9}.input-wrapper{display:flex;align-items:flex-end;gap:4px;background:#ffffff1a;border-radius:24px;padding:2px 4px}.attach-btn{width:32px;height:32px;flex-shrink:0}.attach-btn mat-icon{color:#ffffffb3;font-size:20px;width:20px;height:20px}.message-textarea{flex:1;border:none;outline:none;background:transparent;resize:none;font-size:14px;font-family:inherit;line-height:1.5;max-height:100px;padding:6px 0;color:#fff}.message-textarea::placeholder{color:#ffffff80}.send-btn{width:32px;height:32px;flex-shrink:0}.send-btn mat-icon{color:#ffffffe6;font-size:20px;width:20px;height:20px}.send-btn:disabled mat-icon{color:#ffffff4d}.drag-overlay{position:absolute;inset:0;background:#1f4bd84d;border:2px dashed rgba(255,255,255,.5);border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;color:#fff;font-size:13px;z-index:5}.drag-overlay mat-icon{font-size:28px;width:28px;height:28px}\n"], dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i2.NgForOf, selector: "[ngFor][ngForOf]", inputs: ["ngForOf", "ngForTrackBy", "ngForTemplate"] }, { kind: "directive", type: i2.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "ngmodule", type: FormsModule }, { kind: "directive", type: i3.DefaultValueAccessor, selector: "input:not([type=checkbox])[formControlName],textarea[formControlName],input:not([type=checkbox])[formControl],textarea[formControl],input:not([type=checkbox])[ngModel],textarea[ngModel],[ngDefaultControl]" }, { kind: "directive", type: i3.NgControlStatus, selector: "[formControlName],[ngModel],[formControl]" }, { kind: "directive", type: i3.NgModel, selector: "[ngModel]:not([formControlName]):not([formControl])", inputs: ["name", "disabled", "ngModel", "ngModelOptions"], outputs: ["ngModelChange"], exportAs: ["ngModel"] }, { kind: "ngmodule", type: MatIconModule }, { kind: "component", type: i4.MatIcon, selector: "mat-icon", inputs: ["color", "inline", "svgIcon", "fontSet", "fontIcon"], exportAs: ["matIcon"] }, { kind: "ngmodule", type: MatButtonModule }, { kind: "component", type: i5.MatIconButton, selector: "button[mat-icon-button]", exportAs: ["matButton"] }] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: MessageInputComponent, decorators: [{
            type: Component,
            args: [{ selector: 'app-message-input', standalone: true, imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule], template: `
    <div
      class="message-input-container"
      (dragover)="onDragOver($event)"
      (dragleave)="onDragLeave($event)"
      (drop)="onDrop($event)"
      [class.drag-over]="isDragOver"
    >
      <!-- File previews -->
      <div *ngIf="selectedFiles.length > 0" class="file-previews">
        <div *ngFor="let file of selectedFiles; let i = index" class="file-chip">
          <mat-icon class="file-icon">{{ getFileIcon(file) }}</mat-icon>
          <span class="file-name">{{ file.name }}</span>
          <span class="file-size">{{ formatSize(file.size) }}</span>
          <button mat-icon-button class="file-remove" (click)="removeFile(i)">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>

      <div class="input-wrapper">
        <button mat-icon-button class="attach-btn" (click)="fileInput.click()" title="Attach files">
          <mat-icon>attach_file</mat-icon>
        </button>
        <input
          #fileInput
          type="file"
          multiple
          style="display:none"
          (change)="onFilesSelected($event)"
        />
        <textarea
          [(ngModel)]="messageText"
          (keydown.enter)="onEnter($event)"
          placeholder="Type a message..."
          rows="1"
          class="message-textarea"
        ></textarea>
        <button
          mat-icon-button
          class="send-btn"
          [disabled]="!canSend"
          (click)="send()"
        >
          <mat-icon>send</mat-icon>
        </button>
      </div>

      <!-- Drag overlay -->
      <div *ngIf="isDragOver" class="drag-overlay">
        <mat-icon>cloud_upload</mat-icon>
        <span>Drop files here</span>
      </div>
    </div>
  `, styles: [".message-input-container{padding:8px 12px;border-top:1px solid rgba(255,255,255,.15);background:transparent;position:relative}.message-input-container.drag-over{background:#ffffff1a}.file-previews{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;max-height:80px;overflow-y:auto}.file-chip{display:flex;align-items:center;gap:4px;background:#ffffff26;border-radius:8px;padding:4px 4px 4px 8px;max-width:200px}.file-icon{font-size:16px;width:16px;height:16px;color:#fffc}.file-name{font-size:12px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100px}.file-size{font-size:10px;color:#ffffff80;flex-shrink:0}.file-remove{width:20px!important;height:20px!important}.file-remove mat-icon{font-size:14px;width:14px;height:14px;color:#fff9}.input-wrapper{display:flex;align-items:flex-end;gap:4px;background:#ffffff1a;border-radius:24px;padding:2px 4px}.attach-btn{width:32px;height:32px;flex-shrink:0}.attach-btn mat-icon{color:#ffffffb3;font-size:20px;width:20px;height:20px}.message-textarea{flex:1;border:none;outline:none;background:transparent;resize:none;font-size:14px;font-family:inherit;line-height:1.5;max-height:100px;padding:6px 0;color:#fff}.message-textarea::placeholder{color:#ffffff80}.send-btn{width:32px;height:32px;flex-shrink:0}.send-btn mat-icon{color:#ffffffe6;font-size:20px;width:20px;height:20px}.send-btn:disabled mat-icon{color:#ffffff4d}.drag-overlay{position:absolute;inset:0;background:#1f4bd84d;border:2px dashed rgba(255,255,255,.5);border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;color:#fff;font-size:13px;z-index:5}.drag-overlay mat-icon{font-size:28px;width:28px;height:28px}\n"] }]
        }], propDecorators: { messageSent: [{
                type: Output
            }], messageWithFiles: [{
                type: Output
            }], fileInput: [{
                type: ViewChild,
                args: ['fileInput']
            }] } });

class ChatThreadComponent {
    store;
    auth;
    fileService;
    scrollContainer;
    messages = [];
    conversationName = '';
    loading = false;
    myContactId = null;
    conversationId = null;
    sub;
    shouldScrollToBottom = true;
    uploading = false;
    constructor(store, auth, fileService) {
        this.store = store;
        this.auth = auth;
        this.fileService = fileService;
    }
    ngOnInit() {
        this.myContactId = this.auth.contactId;
        this.sub = combineLatest([
            this.store.activeConversationId,
            this.store.messagesMap,
            this.store.openChats,
            this.store.loadingMessages,
        ]).subscribe(([convId, msgMap, chats, loading]) => {
            this.loading = loading;
            if (convId && convId !== this.conversationId) {
                this.conversationId = convId;
                this.shouldScrollToBottom = true;
                const chat = chats.find((c) => c.conversationId === convId);
                this.conversationName = chat?.name || 'Chat';
            }
            if (this.conversationId) {
                const prevLen = this.messages.length;
                this.messages = msgMap.get(this.conversationId) || [];
                if (this.messages.length > prevLen) {
                    this.shouldScrollToBottom = true;
                }
            }
        });
    }
    ngAfterViewChecked() {
        if (this.shouldScrollToBottom) {
            this.scrollToBottom();
            this.shouldScrollToBottom = false;
        }
    }
    ngOnDestroy() {
        this.sub?.unsubscribe();
    }
    goBack() {
        this.store.setView('inbox');
    }
    onClearConversation() {
        if (this.conversationId) {
            this.store.clearConversation(this.conversationId);
        }
    }
    onDeleteConversation() {
        if (this.conversationId) {
            this.store.deleteConversation(this.conversationId);
        }
    }
    onSendMessage(content) {
        this.store.sendMessage(this.conversationId, content);
        this.shouldScrollToBottom = true;
    }
    onSendWithFiles(payload) {
        if (!this.conversationId)
            return;
        this.uploading = true;
        this.fileService.uploadFiles(payload.files).subscribe({
            next: (responses) => {
                const fileIds = responses.map((r) => r.file_id);
                const filenames = responses.map((r) => r.filename);
                this.fileService
                    .sendMessageWithAttachments(this.conversationId, this.auth.contactId, payload.text || filenames.join(', '), fileIds, filenames)
                    .subscribe({
                    next: () => {
                        this.uploading = false;
                        this.shouldScrollToBottom = true;
                    },
                    error: (err) => {
                        console.error('Failed to send attachments:', err);
                        this.uploading = false;
                    },
                });
            },
            error: (err) => {
                console.error('File upload failed:', err);
                this.uploading = false;
            },
        });
    }
    loadOlder() {
        if (this.conversationId && this.messages.length > 0) {
            this.store.loadMessages(this.conversationId, this.messages[0].message_id);
        }
    }
    onScroll() { }
    shouldShowDateSeparator(index) {
        if (index === 0)
            return true;
        const curr = new Date(this.messages[index].created_at).toDateString();
        const prev = new Date(this.messages[index - 1].created_at).toDateString();
        return curr !== prev;
    }
    shouldShowSender(index) {
        if (index === 0)
            return true;
        return this.messages[index].sender_id !== this.messages[index - 1].sender_id;
    }
    isOwnMessage(msg) {
        return String(msg.sender_id) === String(this.myContactId);
    }
    getSenderName(msg) {
        return getMessageSenderName(msg);
    }
    formatTime(dateStr) {
        if (!dateStr)
            return '';
        const d = new Date(dateStr);
        return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    }
    formatDate(dateStr) {
        const d = new Date(dateStr);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        if (d.toDateString() === today.toDateString())
            return 'Today';
        if (d.toDateString() === yesterday.toDateString())
            return 'Yesterday';
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    scrollToBottom() {
        try {
            const el = this.scrollContainer?.nativeElement;
            if (el) {
                el.scrollTop = el.scrollHeight;
            }
        }
        catch { /* ignore */ }
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: ChatThreadComponent, deps: [{ token: MessagingStoreService }, { token: AuthService }, { token: MessagingFileService }], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "17.3.12", type: ChatThreadComponent, isStandalone: true, selector: "app-chat-thread", viewQueries: [{ propertyName: "scrollContainer", first: true, predicate: ["scrollContainer"], descendants: true }], ngImport: i0, template: `
    <div class="chat-thread">
      <div class="chat-header">
        <button mat-icon-button class="hdr-btn" (click)="goBack()" matTooltip="Back" matTooltipPosition="below">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <div class="header-info">
          <span class="chat-name">{{ conversationName }}</span>
        </div>
        <div class="header-actions">
          <button mat-icon-button class="hdr-btn" (click)="onClearConversation()" matTooltip="Clear conversation" matTooltipPosition="below">
            <mat-icon>cleaning_services</mat-icon>
          </button>
          <button mat-icon-button class="hdr-btn" (click)="onDeleteConversation()" matTooltip="Delete conversation" matTooltipPosition="below">
            <mat-icon>delete_outline</mat-icon>
          </button>
        </div>
      </div>

      <div class="messages-area" #scrollContainer (scroll)="onScroll()">
        <div *ngIf="loading" class="loading-indicator">
          <mat-spinner diameter="24"></mat-spinner>
          <span>Loading messages...</span>
        </div>

        <button
          *ngIf="messages.length >= 50 && !loading"
          mat-stroked-button
          class="load-more-btn"
          (click)="loadOlder()"
        >
          Load older messages
        </button>

        <div class="messages-list">
          <ng-container *ngFor="let msg of messages; let i = index">
            <div
              *ngIf="shouldShowDateSeparator(i)"
              class="date-separator"
            >
              <span>{{ formatDate(msg.created_at) }}</span>
            </div>

            <div
              class="message-bubble-row"
              [class.own]="isOwnMessage(msg)"
              [class.other]="!isOwnMessage(msg)"
            >
              <div *ngIf="!isOwnMessage(msg) && shouldShowSender(i)" class="sender-name">
                {{ getSenderName(msg) }}
              </div>
              <div class="message-bubble" [class.own-bubble]="isOwnMessage(msg)">
                <div *ngIf="msg.message_type === 'IMAGE'" class="image-message">
                  <img [src]="msg.media_url || msg.content" alt="Image" />
                </div>
                <div *ngIf="msg.message_type === 'FILE'" class="file-message">
                  <mat-icon class="file-msg-icon">insert_drive_file</mat-icon>
                  <span class="file-msg-name">{{ msg.content }}</span>
                </div>
                <div *ngIf="msg.message_type === 'TEXT'" class="text-content">
                  {{ msg.content }}
                </div>
                <div class="message-meta">
                  <span class="msg-time">{{ formatTime(msg.created_at) }}</span>
                  <mat-icon *ngIf="isOwnMessage(msg) && msg.is_read" class="read-icon">done_all</mat-icon>
                  <mat-icon *ngIf="isOwnMessage(msg) && !msg.is_read" class="read-icon unread">done</mat-icon>
                </div>
              </div>
            </div>
          </ng-container>
        </div>

        <div *ngIf="messages.length === 0 && !loading" class="empty-chat">
          <mat-icon>chat_bubble_outline</mat-icon>
          <p>No messages yet. Say hello!</p>
        </div>
      </div>

      <app-message-input
        (messageSent)="onSendMessage($event)"
        (messageWithFiles)="onSendWithFiles($event)"
      ></app-message-input>
    </div>
  `, isInline: true, styles: [".chat-thread{display:flex;flex-direction:column;height:100%;background:linear-gradient(180deg,#1f4bd8,#173396)}.chat-header{display:flex;align-items:center;padding:8px 8px 8px 4px;border-bottom:1px solid rgba(255,255,255,.15);gap:4px;flex-shrink:0}.chat-header button mat-icon{color:#fffc}.chat-name{font-size:16px;font-weight:600;color:#fff}.header-info{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;padding:0 4px}.header-actions{display:flex;gap:0}.header-actions button{width:32px;height:32px}.hdr-btn{border-radius:6px!important;transition:background .15s,box-shadow .15s}.hdr-btn:hover{background:#ffffff26!important;box-shadow:0 2px 8px #0003}.messages-area{flex:1;overflow-y:auto;padding:12px}.loading-indicator{display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;color:#ffffffb3;font-size:13px}.load-more-btn{align-self:center;margin-bottom:16px;font-size:12px;color:#fff}.messages-list{display:flex;flex-direction:column;gap:2px;flex:1}.date-separator{text-align:center;margin:16px 0 8px;font-size:12px;color:#ffffffb3;font-weight:500}.message-bubble-row{display:flex;flex-direction:column;max-width:80%;margin-bottom:4px}.message-bubble-row.own{align-self:flex-end;align-items:flex-end}.message-bubble-row.other{align-self:flex-start;align-items:flex-start}.sender-name{font-size:11px;color:#fff9;margin-bottom:2px;margin-left:12px}.message-bubble{padding:10px 14px;border-radius:18px;font-size:14px;line-height:1.4;word-break:break-word;color:#fff}.message-bubble-row.other .message-bubble{background:#ffffff1a;border-bottom-left-radius:6px;box-shadow:0 1px 2px #0000001a}.message-bubble.own-bubble{background:linear-gradient(135deg,#2a5bff,#1f4bd8);border-bottom-right-radius:6px}.image-message img{max-width:240px;border-radius:12px;display:block}.file-message{display:flex;align-items:center;gap:8px;padding:4px 0}.file-msg-icon{font-size:20px;width:20px;height:20px;color:#fffc}.file-msg-name{font-size:13px;color:#fff;word-break:break-all}.message-meta{display:flex;align-items:center;gap:4px;margin-top:4px}.msg-time{font-size:11px;color:#fff9}.message-bubble-row.other .msg-time{color:#9ca3af}.read-icon{font-size:14px;width:14px;height:14px;opacity:.7}.read-icon.unread{opacity:.4}.empty-chat{display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;color:#9ca3af}.empty-chat mat-icon{font-size:48px;width:48px;height:48px;margin-bottom:8px}.empty-chat p{font-size:14px;margin:0}\n"], dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i2.NgForOf, selector: "[ngFor][ngForOf]", inputs: ["ngForOf", "ngForTrackBy", "ngForTemplate"] }, { kind: "directive", type: i2.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "ngmodule", type: MatIconModule }, { kind: "component", type: i4.MatIcon, selector: "mat-icon", inputs: ["color", "inline", "svgIcon", "fontSet", "fontIcon"], exportAs: ["matIcon"] }, { kind: "ngmodule", type: MatButtonModule }, { kind: "component", type: i5.MatButton, selector: "    button[mat-button], button[mat-raised-button], button[mat-flat-button],    button[mat-stroked-button]  ", exportAs: ["matButton"] }, { kind: "component", type: i5.MatIconButton, selector: "button[mat-icon-button]", exportAs: ["matButton"] }, { kind: "ngmodule", type: MatProgressSpinnerModule }, { kind: "component", type: i7$1.MatProgressSpinner, selector: "mat-progress-spinner, mat-spinner", inputs: ["color", "mode", "value", "diameter", "strokeWidth"], exportAs: ["matProgressSpinner"] }, { kind: "ngmodule", type: MatTooltipModule }, { kind: "directive", type: i7.MatTooltip, selector: "[matTooltip]", inputs: ["matTooltipPosition", "matTooltipPositionAtOrigin", "matTooltipDisabled", "matTooltipShowDelay", "matTooltipHideDelay", "matTooltipTouchGestures", "matTooltip", "matTooltipClass"], exportAs: ["matTooltip"] }, { kind: "component", type: MessageInputComponent, selector: "app-message-input", outputs: ["messageSent", "messageWithFiles"] }] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: ChatThreadComponent, decorators: [{
            type: Component,
            args: [{ selector: 'app-chat-thread', standalone: true, imports: [
                        CommonModule, MatIconModule, MatButtonModule,
                        MatProgressSpinnerModule, MatTooltipModule, MessageInputComponent,
                    ], template: `
    <div class="chat-thread">
      <div class="chat-header">
        <button mat-icon-button class="hdr-btn" (click)="goBack()" matTooltip="Back" matTooltipPosition="below">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <div class="header-info">
          <span class="chat-name">{{ conversationName }}</span>
        </div>
        <div class="header-actions">
          <button mat-icon-button class="hdr-btn" (click)="onClearConversation()" matTooltip="Clear conversation" matTooltipPosition="below">
            <mat-icon>cleaning_services</mat-icon>
          </button>
          <button mat-icon-button class="hdr-btn" (click)="onDeleteConversation()" matTooltip="Delete conversation" matTooltipPosition="below">
            <mat-icon>delete_outline</mat-icon>
          </button>
        </div>
      </div>

      <div class="messages-area" #scrollContainer (scroll)="onScroll()">
        <div *ngIf="loading" class="loading-indicator">
          <mat-spinner diameter="24"></mat-spinner>
          <span>Loading messages...</span>
        </div>

        <button
          *ngIf="messages.length >= 50 && !loading"
          mat-stroked-button
          class="load-more-btn"
          (click)="loadOlder()"
        >
          Load older messages
        </button>

        <div class="messages-list">
          <ng-container *ngFor="let msg of messages; let i = index">
            <div
              *ngIf="shouldShowDateSeparator(i)"
              class="date-separator"
            >
              <span>{{ formatDate(msg.created_at) }}</span>
            </div>

            <div
              class="message-bubble-row"
              [class.own]="isOwnMessage(msg)"
              [class.other]="!isOwnMessage(msg)"
            >
              <div *ngIf="!isOwnMessage(msg) && shouldShowSender(i)" class="sender-name">
                {{ getSenderName(msg) }}
              </div>
              <div class="message-bubble" [class.own-bubble]="isOwnMessage(msg)">
                <div *ngIf="msg.message_type === 'IMAGE'" class="image-message">
                  <img [src]="msg.media_url || msg.content" alt="Image" />
                </div>
                <div *ngIf="msg.message_type === 'FILE'" class="file-message">
                  <mat-icon class="file-msg-icon">insert_drive_file</mat-icon>
                  <span class="file-msg-name">{{ msg.content }}</span>
                </div>
                <div *ngIf="msg.message_type === 'TEXT'" class="text-content">
                  {{ msg.content }}
                </div>
                <div class="message-meta">
                  <span class="msg-time">{{ formatTime(msg.created_at) }}</span>
                  <mat-icon *ngIf="isOwnMessage(msg) && msg.is_read" class="read-icon">done_all</mat-icon>
                  <mat-icon *ngIf="isOwnMessage(msg) && !msg.is_read" class="read-icon unread">done</mat-icon>
                </div>
              </div>
            </div>
          </ng-container>
        </div>

        <div *ngIf="messages.length === 0 && !loading" class="empty-chat">
          <mat-icon>chat_bubble_outline</mat-icon>
          <p>No messages yet. Say hello!</p>
        </div>
      </div>

      <app-message-input
        (messageSent)="onSendMessage($event)"
        (messageWithFiles)="onSendWithFiles($event)"
      ></app-message-input>
    </div>
  `, styles: [".chat-thread{display:flex;flex-direction:column;height:100%;background:linear-gradient(180deg,#1f4bd8,#173396)}.chat-header{display:flex;align-items:center;padding:8px 8px 8px 4px;border-bottom:1px solid rgba(255,255,255,.15);gap:4px;flex-shrink:0}.chat-header button mat-icon{color:#fffc}.chat-name{font-size:16px;font-weight:600;color:#fff}.header-info{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;padding:0 4px}.header-actions{display:flex;gap:0}.header-actions button{width:32px;height:32px}.hdr-btn{border-radius:6px!important;transition:background .15s,box-shadow .15s}.hdr-btn:hover{background:#ffffff26!important;box-shadow:0 2px 8px #0003}.messages-area{flex:1;overflow-y:auto;padding:12px}.loading-indicator{display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;color:#ffffffb3;font-size:13px}.load-more-btn{align-self:center;margin-bottom:16px;font-size:12px;color:#fff}.messages-list{display:flex;flex-direction:column;gap:2px;flex:1}.date-separator{text-align:center;margin:16px 0 8px;font-size:12px;color:#ffffffb3;font-weight:500}.message-bubble-row{display:flex;flex-direction:column;max-width:80%;margin-bottom:4px}.message-bubble-row.own{align-self:flex-end;align-items:flex-end}.message-bubble-row.other{align-self:flex-start;align-items:flex-start}.sender-name{font-size:11px;color:#fff9;margin-bottom:2px;margin-left:12px}.message-bubble{padding:10px 14px;border-radius:18px;font-size:14px;line-height:1.4;word-break:break-word;color:#fff}.message-bubble-row.other .message-bubble{background:#ffffff1a;border-bottom-left-radius:6px;box-shadow:0 1px 2px #0000001a}.message-bubble.own-bubble{background:linear-gradient(135deg,#2a5bff,#1f4bd8);border-bottom-right-radius:6px}.image-message img{max-width:240px;border-radius:12px;display:block}.file-message{display:flex;align-items:center;gap:8px;padding:4px 0}.file-msg-icon{font-size:20px;width:20px;height:20px;color:#fffc}.file-msg-name{font-size:13px;color:#fff;word-break:break-all}.message-meta{display:flex;align-items:center;gap:4px;margin-top:4px}.msg-time{font-size:11px;color:#fff9}.message-bubble-row.other .msg-time{color:#9ca3af}.read-icon{font-size:14px;width:14px;height:14px;opacity:.7}.read-icon.unread{opacity:.4}.empty-chat{display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;color:#9ca3af}.empty-chat mat-icon{font-size:48px;width:48px;height:48px;margin-bottom:8px}.empty-chat p{font-size:14px;margin:0}\n"] }]
        }], ctorParameters: () => [{ type: MessagingStoreService }, { type: AuthService }, { type: MessagingFileService }], propDecorators: { scrollContainer: [{
                type: ViewChild,
                args: ['scrollContainer']
            }] } });

class NewConversationComponent {
    store;
    contacts = [];
    searchQuery = '';
    sub;
    constructor(store) {
        this.store = store;
    }
    ngOnInit() {
        this.store.loadVisibleContacts();
        this.sub = this.store.visibleContacts.subscribe((c) => (this.contacts = c));
    }
    ngOnDestroy() {
        this.sub?.unsubscribe();
    }
    get filteredContacts() {
        if (!this.searchQuery.trim())
            return this.contacts;
        const q = this.searchQuery.toLowerCase();
        return this.contacts.filter((c) => this.getDisplayName(c).toLowerCase().includes(q) ||
            (c.company_name || '').toLowerCase().includes(q) ||
            (c.email || '').toLowerCase().includes(q));
    }
    getDisplayName(contact) {
        return getContactDisplayName(contact);
    }
    selectContact(contact) {
        const displayName = this.getDisplayName(contact);
        this.store.openDirectConversation(contact.contact_id, displayName);
    }
    goBack() {
        this.store.setView('inbox');
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: NewConversationComponent, deps: [{ token: MessagingStoreService }], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "17.3.12", type: NewConversationComponent, isStandalone: true, selector: "app-new-conversation", ngImport: i0, template: `
    <div class="new-conv-container">
      <div class="header">
        <button mat-icon-button class="hdr-btn" (click)="goBack()" matTooltip="Back" matTooltipPosition="below">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <h3>New Message</h3>
      </div>

      <div class="search-bar">
        <mat-icon class="search-icon">search</mat-icon>
        <input
          type="text"
          [(ngModel)]="searchQuery"
          placeholder="Search contacts..."
          class="search-input"
        />
      </div>

      <div class="contacts-list">
        <div
          *ngFor="let contact of filteredContacts"
          class="contact-item"
          matRipple
          (click)="selectContact(contact)"
        >
          <div class="contact-avatar">
            <mat-icon>person</mat-icon>
          </div>
          <div class="contact-info">
            <span class="contact-name">{{ getDisplayName(contact) }}</span>
            <span class="contact-company">{{ contact.company_name }}</span>
          </div>
        </div>

        <div *ngIf="filteredContacts.length === 0" class="empty-state">
          <mat-icon>person_search</mat-icon>
          <p>{{ searchQuery ? 'No contacts found' : 'No visible contacts' }}</p>
        </div>
      </div>
    </div>
  `, isInline: true, styles: [".new-conv-container{display:flex;flex-direction:column;height:100%}.header{display:flex;align-items:center;padding:12px 8px 12px 4px;border-bottom:1px solid rgba(255,255,255,.15);gap:4px}.header h3{margin:0;font-size:18px;font-weight:600;color:#fff}.hdr-btn{border-radius:6px!important;transition:background .15s,box-shadow .15s}.hdr-btn:hover{background:#ffffff26!important;box-shadow:0 2px 8px #0003}.hdr-btn mat-icon{color:#fffc}.search-bar{display:flex;align-items:center;margin:12px 16px;padding:8px 12px;background:#ffffff26;border-radius:10px}.search-icon{color:#fff9;font-size:20px;width:20px;height:20px;margin-right:8px}.search-input{flex:1;border:none;outline:none;background:transparent;font-size:14px;color:#fff}.search-input::placeholder{color:#fff9}.contacts-list{flex:1;overflow-y:auto}.contact-item{display:flex;align-items:center;padding:10px 16px;cursor:pointer;transition:background .15s;gap:12px}.contact-item:hover{background:#ffffff1a}.contact-avatar{width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#dbeafe,#93c5fd);display:flex;align-items:center;justify-content:center;flex-shrink:0}.contact-avatar mat-icon{color:#1f4bd8}.contact-info{display:flex;flex-direction:column}.contact-name{font-weight:500;font-size:14px;color:#fff}.contact-company{font-size:12px;color:#ffffffb3}.empty-state{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 24px;color:#fff9}.empty-state mat-icon{font-size:48px;width:48px;height:48px;margin-bottom:12px}.empty-state p{font-size:14px;margin:0}\n"], dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i2.NgForOf, selector: "[ngFor][ngForOf]", inputs: ["ngForOf", "ngForTrackBy", "ngForTemplate"] }, { kind: "directive", type: i2.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "ngmodule", type: FormsModule }, { kind: "directive", type: i3.DefaultValueAccessor, selector: "input:not([type=checkbox])[formControlName],textarea[formControlName],input:not([type=checkbox])[formControl],textarea[formControl],input:not([type=checkbox])[ngModel],textarea[ngModel],[ngDefaultControl]" }, { kind: "directive", type: i3.NgControlStatus, selector: "[formControlName],[ngModel],[formControl]" }, { kind: "directive", type: i3.NgModel, selector: "[ngModel]:not([formControlName]):not([formControl])", inputs: ["name", "disabled", "ngModel", "ngModelOptions"], outputs: ["ngModelChange"], exportAs: ["ngModel"] }, { kind: "ngmodule", type: MatIconModule }, { kind: "component", type: i4.MatIcon, selector: "mat-icon", inputs: ["color", "inline", "svgIcon", "fontSet", "fontIcon"], exportAs: ["matIcon"] }, { kind: "ngmodule", type: MatButtonModule }, { kind: "component", type: i5.MatIconButton, selector: "button[mat-icon-button]", exportAs: ["matButton"] }, { kind: "ngmodule", type: MatRippleModule }, { kind: "directive", type: i6.MatRipple, selector: "[mat-ripple], [matRipple]", inputs: ["matRippleColor", "matRippleUnbounded", "matRippleCentered", "matRippleRadius", "matRippleAnimation", "matRippleDisabled", "matRippleTrigger"], exportAs: ["matRipple"] }, { kind: "ngmodule", type: MatTooltipModule }, { kind: "directive", type: i7.MatTooltip, selector: "[matTooltip]", inputs: ["matTooltipPosition", "matTooltipPositionAtOrigin", "matTooltipDisabled", "matTooltipShowDelay", "matTooltipHideDelay", "matTooltipTouchGestures", "matTooltip", "matTooltipClass"], exportAs: ["matTooltip"] }] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: NewConversationComponent, decorators: [{
            type: Component,
            args: [{ selector: 'app-new-conversation', standalone: true, imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatRippleModule, MatTooltipModule], template: `
    <div class="new-conv-container">
      <div class="header">
        <button mat-icon-button class="hdr-btn" (click)="goBack()" matTooltip="Back" matTooltipPosition="below">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <h3>New Message</h3>
      </div>

      <div class="search-bar">
        <mat-icon class="search-icon">search</mat-icon>
        <input
          type="text"
          [(ngModel)]="searchQuery"
          placeholder="Search contacts..."
          class="search-input"
        />
      </div>

      <div class="contacts-list">
        <div
          *ngFor="let contact of filteredContacts"
          class="contact-item"
          matRipple
          (click)="selectContact(contact)"
        >
          <div class="contact-avatar">
            <mat-icon>person</mat-icon>
          </div>
          <div class="contact-info">
            <span class="contact-name">{{ getDisplayName(contact) }}</span>
            <span class="contact-company">{{ contact.company_name }}</span>
          </div>
        </div>

        <div *ngIf="filteredContacts.length === 0" class="empty-state">
          <mat-icon>person_search</mat-icon>
          <p>{{ searchQuery ? 'No contacts found' : 'No visible contacts' }}</p>
        </div>
      </div>
    </div>
  `, styles: [".new-conv-container{display:flex;flex-direction:column;height:100%}.header{display:flex;align-items:center;padding:12px 8px 12px 4px;border-bottom:1px solid rgba(255,255,255,.15);gap:4px}.header h3{margin:0;font-size:18px;font-weight:600;color:#fff}.hdr-btn{border-radius:6px!important;transition:background .15s,box-shadow .15s}.hdr-btn:hover{background:#ffffff26!important;box-shadow:0 2px 8px #0003}.hdr-btn mat-icon{color:#fffc}.search-bar{display:flex;align-items:center;margin:12px 16px;padding:8px 12px;background:#ffffff26;border-radius:10px}.search-icon{color:#fff9;font-size:20px;width:20px;height:20px;margin-right:8px}.search-input{flex:1;border:none;outline:none;background:transparent;font-size:14px;color:#fff}.search-input::placeholder{color:#fff9}.contacts-list{flex:1;overflow-y:auto}.contact-item{display:flex;align-items:center;padding:10px 16px;cursor:pointer;transition:background .15s;gap:12px}.contact-item:hover{background:#ffffff1a}.contact-avatar{width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#dbeafe,#93c5fd);display:flex;align-items:center;justify-content:center;flex-shrink:0}.contact-avatar mat-icon{color:#1f4bd8}.contact-info{display:flex;flex-direction:column}.contact-name{font-weight:500;font-size:14px;color:#fff}.contact-company{font-size:12px;color:#ffffffb3}.empty-state{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 24px;color:#fff9}.empty-state mat-icon{font-size:48px;width:48px;height:48px;margin-bottom:12px}.empty-state p{font-size:14px;margin:0}\n"] }]
        }], ctorParameters: () => [{ type: MessagingStoreService }] });

class GroupManagerComponent {
    store;
    contacts = [];
    selectedContacts = [];
    groupName = '';
    searchQuery = '';
    isEditMode = false;
    editingConversationId = null;
    creatorContactId = null;
    sub;
    constructor(store) {
        this.store = store;
    }
    ngOnInit() {
        this.store.loadVisibleContacts();
        this.sub = this.store.visibleContacts.subscribe((c) => (this.contacts = c));
    }
    ngOnDestroy() {
        this.sub?.unsubscribe();
    }
    get filteredContacts() {
        if (!this.searchQuery.trim())
            return this.contacts;
        const q = this.searchQuery.toLowerCase();
        return this.contacts.filter((c) => this.getDisplayName(c).toLowerCase().includes(q) ||
            (c.company_name || '').toLowerCase().includes(q));
    }
    getDisplayName(contact) {
        return getContactDisplayName(contact);
    }
    get canCreate() {
        return this.groupName.trim().length > 0 && this.selectedContacts.length >= 1;
    }
    isSelected(contact) {
        return this.selectedContacts.some((c) => c.contact_id === contact.contact_id);
    }
    isCreator(contact) {
        return contact.contact_id === this.creatorContactId;
    }
    toggleContact(contact) {
        if (this.isCreator(contact))
            return;
        if (this.isSelected(contact)) {
            this.removeContact(contact);
        }
        else {
            this.selectedContacts = [...this.selectedContacts, contact];
        }
    }
    removeContact(contact) {
        if (this.isCreator(contact))
            return;
        this.selectedContacts = this.selectedContacts.filter((c) => c.contact_id !== contact.contact_id);
    }
    onSubmit() {
        if (!this.canCreate)
            return;
        if (this.isEditMode && this.editingConversationId) {
            this.store.manageGroup('rename', this.editingConversationId, this.groupName.trim());
        }
        else {
            const ids = this.selectedContacts.map((c) => c.contact_id);
            this.store.createGroupConversation(ids, this.groupName.trim());
        }
        this.goBack();
    }
    onDelete() {
        if (this.editingConversationId) {
            this.store.deleteGroup(this.editingConversationId);
            this.goBack();
        }
    }
    goBack() {
        this.store.setView('inbox');
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: GroupManagerComponent, deps: [{ token: MessagingStoreService }], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "17.3.12", type: GroupManagerComponent, isStandalone: true, selector: "app-group-manager", ngImport: i0, template: `
    <div class="group-manager">
      <div class="header">
        <button mat-icon-button class="hdr-btn" (click)="goBack()" matTooltip="Back" matTooltipPosition="below">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <h3>{{ isEditMode ? 'Edit Group' : 'Create Group' }}</h3>
      </div>

      <div class="form-section">
        <label class="field-label">Group Name</label>
        <input
          type="text"
          [(ngModel)]="groupName"
          placeholder="Enter group name..."
          class="text-field"
        />
      </div>

      <div class="form-section">
        <label class="field-label">Members (min 2 including you)</label>
        <div class="search-bar">
          <mat-icon class="search-icon">search</mat-icon>
          <input
            type="text"
            [(ngModel)]="searchQuery"
            placeholder="Search contacts..."
            class="search-input"
          />
        </div>
      </div>

      <div *ngIf="selectedContacts.length > 0" class="selected-chips">
        <div *ngFor="let c of selectedContacts" class="chip">
          <span>{{ getDisplayName(c) }}</span>
          <button mat-icon-button class="chip-remove" (click)="removeContact(c)" [disabled]="isCreator(c)">
            <mat-icon>{{ isCreator(c) ? 'star' : 'close' }}</mat-icon>
          </button>
        </div>
      </div>

      <div class="contacts-list">
        <div
          *ngFor="let contact of filteredContacts"
          class="contact-item"
          matRipple
          [class.selected]="isSelected(contact)"
          (click)="toggleContact(contact)"
        >
          <div class="contact-avatar">
            <mat-icon>person</mat-icon>
          </div>
          <div class="contact-info">
            <span class="contact-name">{{ getDisplayName(contact) }}</span>
            <span class="contact-company">{{ contact.company_name }}</span>
          </div>
          <mat-icon *ngIf="isSelected(contact)" class="check-icon">check_circle</mat-icon>
        </div>
      </div>

      <div class="action-bar">
        <button
          mat-raised-button
          [disabled]="!canCreate"
          (click)="onSubmit()"
          class="create-btn"
        >
          <mat-icon>{{ isEditMode ? 'save' : 'group_add' }}</mat-icon>
          {{ isEditMode ? 'Save Changes' : 'Create Group' }} ({{ selectedContacts.length + 1 }} members)
        </button>
        <button
          *ngIf="isEditMode"
          mat-stroked-button
          class="delete-btn"
          (click)="onDelete()"
        >
          <mat-icon>delete</mat-icon>
          Delete Group
        </button>
      </div>
    </div>
  `, isInline: true, styles: [".group-manager{display:flex;flex-direction:column;height:100%}.header{display:flex;align-items:center;padding:12px 8px 12px 4px;border-bottom:1px solid rgba(255,255,255,.15);gap:4px}.header h3{margin:0;font-size:18px;font-weight:600;color:#fff}.hdr-btn{border-radius:6px!important;transition:background .15s,box-shadow .15s}.hdr-btn:hover{background:#ffffff26!important;box-shadow:0 2px 8px #0003}.hdr-btn mat-icon{color:#fffc}.form-section{padding:12px 16px 0}.field-label{display:block;font-size:12px;font-weight:600;color:#ffffffb3;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px}.text-field{width:100%;padding:10px 12px;border:1px solid rgba(255,255,255,.25);border-radius:8px;font-size:14px;color:#fff;background:#ffffff1a;outline:none;transition:border-color .2s;box-sizing:border-box}.text-field:focus{border-color:#ffffff80}.text-field::placeholder{color:#ffffff80}.search-bar{display:flex;align-items:center;padding:8px 12px;background:#ffffff1a;border-radius:10px}.search-icon{color:#fff9;font-size:20px;width:20px;height:20px;margin-right:8px}.search-input{flex:1;border:none;outline:none;background:transparent;font-size:14px;color:#fff}.search-input::placeholder{color:#ffffff80}.selected-chips{display:flex;flex-wrap:wrap;gap:6px;padding:8px 16px}.chip{display:flex;align-items:center;background:#fff3;color:#fff;border-radius:16px;padding:4px 6px 4px 12px;font-size:12px;font-weight:500}.chip-remove{width:20px!important;height:20px!important;line-height:20px!important}.chip-remove mat-icon{font-size:14px;width:14px;height:14px;color:#fffc}.contacts-list{flex:1;overflow-y:auto;padding-top:4px}.contact-item{display:flex;align-items:center;padding:10px 16px;cursor:pointer;transition:background .15s;gap:12px}.contact-item:hover{background:#ffffff14}.contact-item.selected{background:#ffffff26}.contact-avatar{width:36px;height:36px;border-radius:50%;background:#fff3;display:flex;align-items:center;justify-content:center;flex-shrink:0}.contact-avatar mat-icon{color:#fff;font-size:20px}.contact-info{flex:1;display:flex;flex-direction:column}.contact-name{font-weight:500;font-size:14px;color:#fff}.contact-company{font-size:12px;color:#fff9}.check-icon{color:#22c55e;font-size:22px}.action-bar{padding:12px 16px;border-top:1px solid rgba(255,255,255,.1);display:flex;flex-direction:column;gap:8px}.create-btn{width:100%;background:#fff3!important;color:#fff!important;border-radius:10px;font-weight:600}.create-btn:disabled{opacity:.5}.create-btn mat-icon{margin-right:8px}.delete-btn{width:100%;color:#f87171!important;border-color:#f8717166!important;border-radius:10px;font-weight:600}.delete-btn mat-icon{margin-right:8px}\n"], dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i2.NgForOf, selector: "[ngFor][ngForOf]", inputs: ["ngForOf", "ngForTrackBy", "ngForTemplate"] }, { kind: "directive", type: i2.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "ngmodule", type: FormsModule }, { kind: "directive", type: i3.DefaultValueAccessor, selector: "input:not([type=checkbox])[formControlName],textarea[formControlName],input:not([type=checkbox])[formControl],textarea[formControl],input:not([type=checkbox])[ngModel],textarea[ngModel],[ngDefaultControl]" }, { kind: "directive", type: i3.NgControlStatus, selector: "[formControlName],[ngModel],[formControl]" }, { kind: "directive", type: i3.NgModel, selector: "[ngModel]:not([formControlName]):not([formControl])", inputs: ["name", "disabled", "ngModel", "ngModelOptions"], outputs: ["ngModelChange"], exportAs: ["ngModel"] }, { kind: "ngmodule", type: MatIconModule }, { kind: "component", type: i4.MatIcon, selector: "mat-icon", inputs: ["color", "inline", "svgIcon", "fontSet", "fontIcon"], exportAs: ["matIcon"] }, { kind: "ngmodule", type: MatButtonModule }, { kind: "component", type: i5.MatButton, selector: "    button[mat-button], button[mat-raised-button], button[mat-flat-button],    button[mat-stroked-button]  ", exportAs: ["matButton"] }, { kind: "component", type: i5.MatIconButton, selector: "button[mat-icon-button]", exportAs: ["matButton"] }, { kind: "ngmodule", type: MatRippleModule }, { kind: "directive", type: i6.MatRipple, selector: "[mat-ripple], [matRipple]", inputs: ["matRippleColor", "matRippleUnbounded", "matRippleCentered", "matRippleRadius", "matRippleAnimation", "matRippleDisabled", "matRippleTrigger"], exportAs: ["matRipple"] }, { kind: "ngmodule", type: MatTooltipModule }, { kind: "directive", type: i7.MatTooltip, selector: "[matTooltip]", inputs: ["matTooltipPosition", "matTooltipPositionAtOrigin", "matTooltipDisabled", "matTooltipShowDelay", "matTooltipHideDelay", "matTooltipTouchGestures", "matTooltip", "matTooltipClass"], exportAs: ["matTooltip"] }] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: GroupManagerComponent, decorators: [{
            type: Component,
            args: [{ selector: 'app-group-manager', standalone: true, imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatRippleModule, MatTooltipModule], template: `
    <div class="group-manager">
      <div class="header">
        <button mat-icon-button class="hdr-btn" (click)="goBack()" matTooltip="Back" matTooltipPosition="below">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <h3>{{ isEditMode ? 'Edit Group' : 'Create Group' }}</h3>
      </div>

      <div class="form-section">
        <label class="field-label">Group Name</label>
        <input
          type="text"
          [(ngModel)]="groupName"
          placeholder="Enter group name..."
          class="text-field"
        />
      </div>

      <div class="form-section">
        <label class="field-label">Members (min 2 including you)</label>
        <div class="search-bar">
          <mat-icon class="search-icon">search</mat-icon>
          <input
            type="text"
            [(ngModel)]="searchQuery"
            placeholder="Search contacts..."
            class="search-input"
          />
        </div>
      </div>

      <div *ngIf="selectedContacts.length > 0" class="selected-chips">
        <div *ngFor="let c of selectedContacts" class="chip">
          <span>{{ getDisplayName(c) }}</span>
          <button mat-icon-button class="chip-remove" (click)="removeContact(c)" [disabled]="isCreator(c)">
            <mat-icon>{{ isCreator(c) ? 'star' : 'close' }}</mat-icon>
          </button>
        </div>
      </div>

      <div class="contacts-list">
        <div
          *ngFor="let contact of filteredContacts"
          class="contact-item"
          matRipple
          [class.selected]="isSelected(contact)"
          (click)="toggleContact(contact)"
        >
          <div class="contact-avatar">
            <mat-icon>person</mat-icon>
          </div>
          <div class="contact-info">
            <span class="contact-name">{{ getDisplayName(contact) }}</span>
            <span class="contact-company">{{ contact.company_name }}</span>
          </div>
          <mat-icon *ngIf="isSelected(contact)" class="check-icon">check_circle</mat-icon>
        </div>
      </div>

      <div class="action-bar">
        <button
          mat-raised-button
          [disabled]="!canCreate"
          (click)="onSubmit()"
          class="create-btn"
        >
          <mat-icon>{{ isEditMode ? 'save' : 'group_add' }}</mat-icon>
          {{ isEditMode ? 'Save Changes' : 'Create Group' }} ({{ selectedContacts.length + 1 }} members)
        </button>
        <button
          *ngIf="isEditMode"
          mat-stroked-button
          class="delete-btn"
          (click)="onDelete()"
        >
          <mat-icon>delete</mat-icon>
          Delete Group
        </button>
      </div>
    </div>
  `, styles: [".group-manager{display:flex;flex-direction:column;height:100%}.header{display:flex;align-items:center;padding:12px 8px 12px 4px;border-bottom:1px solid rgba(255,255,255,.15);gap:4px}.header h3{margin:0;font-size:18px;font-weight:600;color:#fff}.hdr-btn{border-radius:6px!important;transition:background .15s,box-shadow .15s}.hdr-btn:hover{background:#ffffff26!important;box-shadow:0 2px 8px #0003}.hdr-btn mat-icon{color:#fffc}.form-section{padding:12px 16px 0}.field-label{display:block;font-size:12px;font-weight:600;color:#ffffffb3;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px}.text-field{width:100%;padding:10px 12px;border:1px solid rgba(255,255,255,.25);border-radius:8px;font-size:14px;color:#fff;background:#ffffff1a;outline:none;transition:border-color .2s;box-sizing:border-box}.text-field:focus{border-color:#ffffff80}.text-field::placeholder{color:#ffffff80}.search-bar{display:flex;align-items:center;padding:8px 12px;background:#ffffff1a;border-radius:10px}.search-icon{color:#fff9;font-size:20px;width:20px;height:20px;margin-right:8px}.search-input{flex:1;border:none;outline:none;background:transparent;font-size:14px;color:#fff}.search-input::placeholder{color:#ffffff80}.selected-chips{display:flex;flex-wrap:wrap;gap:6px;padding:8px 16px}.chip{display:flex;align-items:center;background:#fff3;color:#fff;border-radius:16px;padding:4px 6px 4px 12px;font-size:12px;font-weight:500}.chip-remove{width:20px!important;height:20px!important;line-height:20px!important}.chip-remove mat-icon{font-size:14px;width:14px;height:14px;color:#fffc}.contacts-list{flex:1;overflow-y:auto;padding-top:4px}.contact-item{display:flex;align-items:center;padding:10px 16px;cursor:pointer;transition:background .15s;gap:12px}.contact-item:hover{background:#ffffff14}.contact-item.selected{background:#ffffff26}.contact-avatar{width:36px;height:36px;border-radius:50%;background:#fff3;display:flex;align-items:center;justify-content:center;flex-shrink:0}.contact-avatar mat-icon{color:#fff;font-size:20px}.contact-info{flex:1;display:flex;flex-direction:column}.contact-name{font-weight:500;font-size:14px;color:#fff}.contact-company{font-size:12px;color:#fff9}.check-icon{color:#22c55e;font-size:22px}.action-bar{padding:12px 16px;border-top:1px solid rgba(255,255,255,.1);display:flex;flex-direction:column;gap:8px}.create-btn{width:100%;background:#fff3!important;color:#fff!important;border-radius:10px;font-weight:600}.create-btn:disabled{opacity:.5}.create-btn mat-icon{margin-right:8px}.delete-btn{width:100%;color:#f87171!important;border-color:#f8717166!important;border-radius:10px;font-weight:600}.delete-btn mat-icon{margin-right:8px}\n"] }]
        }], ctorParameters: () => [{ type: MessagingStoreService }] });

class ChatPanelComponent {
    store;
    isOpen = false;
    activeView = 'inbox';
    wsStatus = 'disconnected';
    side = 'right';
    sidebarWidth = 400;
    defaultWidth = 400;
    resizing = false;
    resizeStartX = 0;
    resizeStartWidth = 0;
    boundResizeMove = this.onResizeMove.bind(this);
    boundResizeEnd = this.onResizeEnd.bind(this);
    sub;
    constructor(store) {
        this.store = store;
    }
    ngOnInit() {
        this.side = this.store.getSidebarSide();
        const saved = localStorage.getItem('messaging_sidebar_width');
        if (saved)
            this.sidebarWidth = parseInt(saved, 10) || this.defaultWidth;
        this.sub = combineLatest([
            this.store.panelOpen,
            this.store.activeView,
            this.store.wsStatus,
            this.store.sidebarSide,
        ]).subscribe(([open, view, ws, side]) => {
            this.isOpen = open;
            this.activeView = view;
            this.wsStatus = ws;
            this.side = side;
        });
    }
    ngOnDestroy() {
        this.sub?.unsubscribe();
        document.removeEventListener('mousemove', this.boundResizeMove);
        document.removeEventListener('mouseup', this.boundResizeEnd);
    }
    toggleSide() {
        this.store.toggleSidebarSide();
    }
    close() {
        this.store.closePanel();
    }
    // ── Resize ──
    onResizeStart(event) {
        event.preventDefault();
        this.resizing = true;
        this.resizeStartX = event.clientX;
        this.resizeStartWidth = this.sidebarWidth;
        document.body.style.cursor = 'ew-resize';
        document.body.style.userSelect = 'none';
        document.addEventListener('mousemove', this.boundResizeMove);
        document.addEventListener('mouseup', this.boundResizeEnd);
    }
    onResizeMove(event) {
        if (!this.resizing)
            return;
        const dx = event.clientX - this.resizeStartX;
        if (this.side === 'right') {
            this.sidebarWidth = Math.max(200, this.resizeStartWidth - dx);
        }
        else {
            this.sidebarWidth = Math.max(200, this.resizeStartWidth + dx);
        }
        this.sidebarWidth = Math.min(this.sidebarWidth, window.innerWidth * 0.9);
    }
    onResizeEnd() {
        if (!this.resizing)
            return;
        this.resizing = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', this.boundResizeMove);
        document.removeEventListener('mouseup', this.boundResizeEnd);
        localStorage.setItem('messaging_sidebar_width', String(this.sidebarWidth));
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: ChatPanelComponent, deps: [{ token: MessagingStoreService }], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "17.3.12", type: ChatPanelComponent, isStandalone: true, selector: "app-chat-panel", ngImport: i0, template: `
    <!-- Sidebar -->
    <div
      class="sidebar"
      [class.open]="isOpen"
      [class.side-left]="side === 'left'"
      [class.side-right]="side === 'right'"
      [style.width.px]="sidebarWidth"
    >
      <!-- Resize handle on inner edge -->
      <div
        class="resize-handle"
        [class.handle-left]="side === 'right'"
        [class.handle-right]="side === 'left'"
        (mousedown)="onResizeStart($event)"
      ></div>

      <!-- Sidebar header -->
      <div class="sidebar-header">
        <div class="header-left">
          <svg class="ces-logo-sm" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <path d="M 15 20 Q 15 15 20 15 L 80 15 Q 85 15 85 20 L 85 60 Q 85 65 80 65 L 35 65 L 20 80 L 20 65 Q 15 65 15 60 Z"
                  fill="none" stroke="white" stroke-width="3"/>
            <g transform="translate(50, 40) scale(0.35)">
              <path d="M 0,-30 L 25,-15 L 25,15 L 0,30 L -25,15 L -25,-15 Z" fill="white"/>
            </g>
          </svg>
          <span class="header-title">CES Messenger</span>
        </div>
        <div class="header-actions">
          <button mat-icon-button class="hdr-btn" (click)="toggleSide()" [matTooltip]="'Move to ' + (side === 'right' ? 'left' : 'right')" matTooltipPosition="below">
            <mat-icon>{{ side === 'right' ? 'chevron_left' : 'chevron_right' }}</mat-icon>
          </button>
          <div class="btn-spacer"></div>
          <button mat-icon-button class="hdr-btn" (click)="close()" matTooltip="Close messenger" matTooltipPosition="below">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>

      <!-- View container -->
      <div class="sidebar-content">
        <app-inbox-list *ngIf="activeView === 'inbox'"></app-inbox-list>
        <app-chat-thread *ngIf="activeView === 'chat'"></app-chat-thread>
        <app-new-conversation *ngIf="activeView === 'new-conversation'"></app-new-conversation>
        <app-group-manager *ngIf="activeView === 'group-manager'"></app-group-manager>
      </div>

      <!-- Status bar -->
      <div class="ws-status" [class.connected]="wsStatus === 'authenticated'" [class.connecting]="wsStatus === 'connecting'">
        <div class="status-dot"></div>
        <span *ngIf="wsStatus === 'authenticated'">Connected</span>
        <span *ngIf="wsStatus === 'connecting'">Connecting...</span>
        <span *ngIf="wsStatus === 'disconnected'">Disconnected</span>
      </div>
    </div>
  `, isInline: true, styles: [".sidebar{position:fixed;top:0;bottom:0;width:400px;background:linear-gradient(180deg,#1f4bd8,#173396);z-index:9999;display:flex;flex-direction:column;box-shadow:0 0 40px #1733964d;transition:transform .3s cubic-bezier(.4,0,.2,1)}.sidebar.side-right{right:0;transform:translate(100%)}.sidebar.side-left{left:0;transform:translate(-100%)}.sidebar.open.side-right,.sidebar.open.side-left{transform:translate(0)}.resize-handle{position:absolute;top:0;bottom:0;width:5px;cursor:ew-resize;z-index:10;transition:background .15s}.resize-handle:hover,.resize-handle:active{background:#ffffff26}.resize-handle.handle-left{left:0}.resize-handle.handle-right{right:0}.sidebar-header{display:flex;align-items:center;justify-content:space-between;padding:12px 12px 12px 16px;border-bottom:1px solid rgba(255,255,255,.15);flex-shrink:0}.header-left{display:flex;align-items:center;gap:10px}.ces-logo-sm{width:28px;height:28px}.header-title{font-size:16px;font-weight:700;color:#fff;letter-spacing:.3px}.header-actions{display:flex;align-items:center;gap:0}.btn-spacer{width:12px}.hdr-btn{width:32px;height:32px;border-radius:6px!important;transition:background .15s,box-shadow .15s}.hdr-btn:hover{background:#ffffff26!important;box-shadow:0 2px 8px #0003}.hdr-btn mat-icon{font-size:20px;color:#ffffffd9}.sidebar-content{flex:1;overflow:hidden}.ws-status{display:flex;align-items:center;gap:6px;padding:6px 16px;font-size:11px;color:#fff9;border-top:1px solid rgba(255,255,255,.1);flex-shrink:0}.status-dot{width:6px;height:6px;border-radius:50%;background:#fff6}.ws-status.connected .status-dot{background:#22c55e}.ws-status.connecting .status-dot{background:#f59e0b;animation:blink 1s infinite}@keyframes blink{50%{opacity:.3}}@media (max-width: 480px){.sidebar{width:100%!important}.resize-handle{display:none}}\n"], dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i2.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "ngmodule", type: MatIconModule }, { kind: "component", type: i4.MatIcon, selector: "mat-icon", inputs: ["color", "inline", "svgIcon", "fontSet", "fontIcon"], exportAs: ["matIcon"] }, { kind: "ngmodule", type: MatButtonModule }, { kind: "component", type: i5.MatIconButton, selector: "button[mat-icon-button]", exportAs: ["matButton"] }, { kind: "ngmodule", type: MatTooltipModule }, { kind: "directive", type: i7.MatTooltip, selector: "[matTooltip]", inputs: ["matTooltipPosition", "matTooltipPositionAtOrigin", "matTooltipDisabled", "matTooltipShowDelay", "matTooltipHideDelay", "matTooltipTouchGestures", "matTooltip", "matTooltipClass"], exportAs: ["matTooltip"] }, { kind: "component", type: InboxListComponent, selector: "app-inbox-list" }, { kind: "component", type: ChatThreadComponent, selector: "app-chat-thread" }, { kind: "component", type: NewConversationComponent, selector: "app-new-conversation" }, { kind: "component", type: GroupManagerComponent, selector: "app-group-manager" }] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: ChatPanelComponent, decorators: [{
            type: Component,
            args: [{ selector: 'app-chat-panel', standalone: true, imports: [
                        CommonModule, MatIconModule, MatButtonModule, MatTooltipModule,
                        InboxListComponent, ChatThreadComponent,
                        NewConversationComponent, GroupManagerComponent,
                    ], template: `
    <!-- Sidebar -->
    <div
      class="sidebar"
      [class.open]="isOpen"
      [class.side-left]="side === 'left'"
      [class.side-right]="side === 'right'"
      [style.width.px]="sidebarWidth"
    >
      <!-- Resize handle on inner edge -->
      <div
        class="resize-handle"
        [class.handle-left]="side === 'right'"
        [class.handle-right]="side === 'left'"
        (mousedown)="onResizeStart($event)"
      ></div>

      <!-- Sidebar header -->
      <div class="sidebar-header">
        <div class="header-left">
          <svg class="ces-logo-sm" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <path d="M 15 20 Q 15 15 20 15 L 80 15 Q 85 15 85 20 L 85 60 Q 85 65 80 65 L 35 65 L 20 80 L 20 65 Q 15 65 15 60 Z"
                  fill="none" stroke="white" stroke-width="3"/>
            <g transform="translate(50, 40) scale(0.35)">
              <path d="M 0,-30 L 25,-15 L 25,15 L 0,30 L -25,15 L -25,-15 Z" fill="white"/>
            </g>
          </svg>
          <span class="header-title">CES Messenger</span>
        </div>
        <div class="header-actions">
          <button mat-icon-button class="hdr-btn" (click)="toggleSide()" [matTooltip]="'Move to ' + (side === 'right' ? 'left' : 'right')" matTooltipPosition="below">
            <mat-icon>{{ side === 'right' ? 'chevron_left' : 'chevron_right' }}</mat-icon>
          </button>
          <div class="btn-spacer"></div>
          <button mat-icon-button class="hdr-btn" (click)="close()" matTooltip="Close messenger" matTooltipPosition="below">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>

      <!-- View container -->
      <div class="sidebar-content">
        <app-inbox-list *ngIf="activeView === 'inbox'"></app-inbox-list>
        <app-chat-thread *ngIf="activeView === 'chat'"></app-chat-thread>
        <app-new-conversation *ngIf="activeView === 'new-conversation'"></app-new-conversation>
        <app-group-manager *ngIf="activeView === 'group-manager'"></app-group-manager>
      </div>

      <!-- Status bar -->
      <div class="ws-status" [class.connected]="wsStatus === 'authenticated'" [class.connecting]="wsStatus === 'connecting'">
        <div class="status-dot"></div>
        <span *ngIf="wsStatus === 'authenticated'">Connected</span>
        <span *ngIf="wsStatus === 'connecting'">Connecting...</span>
        <span *ngIf="wsStatus === 'disconnected'">Disconnected</span>
      </div>
    </div>
  `, styles: [".sidebar{position:fixed;top:0;bottom:0;width:400px;background:linear-gradient(180deg,#1f4bd8,#173396);z-index:9999;display:flex;flex-direction:column;box-shadow:0 0 40px #1733964d;transition:transform .3s cubic-bezier(.4,0,.2,1)}.sidebar.side-right{right:0;transform:translate(100%)}.sidebar.side-left{left:0;transform:translate(-100%)}.sidebar.open.side-right,.sidebar.open.side-left{transform:translate(0)}.resize-handle{position:absolute;top:0;bottom:0;width:5px;cursor:ew-resize;z-index:10;transition:background .15s}.resize-handle:hover,.resize-handle:active{background:#ffffff26}.resize-handle.handle-left{left:0}.resize-handle.handle-right{right:0}.sidebar-header{display:flex;align-items:center;justify-content:space-between;padding:12px 12px 12px 16px;border-bottom:1px solid rgba(255,255,255,.15);flex-shrink:0}.header-left{display:flex;align-items:center;gap:10px}.ces-logo-sm{width:28px;height:28px}.header-title{font-size:16px;font-weight:700;color:#fff;letter-spacing:.3px}.header-actions{display:flex;align-items:center;gap:0}.btn-spacer{width:12px}.hdr-btn{width:32px;height:32px;border-radius:6px!important;transition:background .15s,box-shadow .15s}.hdr-btn:hover{background:#ffffff26!important;box-shadow:0 2px 8px #0003}.hdr-btn mat-icon{font-size:20px;color:#ffffffd9}.sidebar-content{flex:1;overflow:hidden}.ws-status{display:flex;align-items:center;gap:6px;padding:6px 16px;font-size:11px;color:#fff9;border-top:1px solid rgba(255,255,255,.1);flex-shrink:0}.status-dot{width:6px;height:6px;border-radius:50%;background:#fff6}.ws-status.connected .status-dot{background:#22c55e}.ws-status.connecting .status-dot{background:#f59e0b;animation:blink 1s infinite}@keyframes blink{50%{opacity:.3}}@media (max-width: 480px){.sidebar{width:100%!important}.resize-handle{display:none}}\n"] }]
        }], ctorParameters: () => [{ type: MessagingStoreService }] });

class MessagingOverlayComponent {
    store;
    auth;
    isAuthenticated = false;
    constructor(store, auth) {
        this.store = store;
        this.auth = auth;
    }
    ngOnInit() {
        // Auto-init messaging session from localStorage
        this.initializeMessagingAuth();
        this.auth.session$.subscribe((session) => {
            this.isAuthenticated = this.auth.isAuthenticated();
            if (this.isAuthenticated) {
                this.store.initialize();
            }
        });
    }
    initializeMessagingAuth() {
        // Check if messaging already authenticated
        if (this.auth.isAuthenticated())
            return;
        // Get session from localStorage (host app session)
        const sessionData = localStorage.getItem('session');
        if (!sessionData) {
            console.warn('Messaging: No session in localStorage');
            return;
        }
        try {
            const parsed = JSON.parse(sessionData);
            const sessionId = parsed.session_id || parsed.sessionId;
            const email = parsed.email || parsed.user_email;
            const userName = parsed.user_name || parsed.name;
            if (!sessionId || !email) {
                console.warn('Messaging: Invalid session data');
                return;
            }
            // Create contact from session data
            const tempContactId = email.split('@')[0];
            const contact = {
                contact_id: tempContactId,
                user_gid: sessionId,
                username: userName || tempContactId,
                first_name: userName?.split(' ')[0],
                last_name: userName?.split(' ').slice(1).join(' '),
                email: email,
                company_name: 'CES',
                is_active: true
            };
            // Set messaging session
            this.auth.setSession(sessionId, contact);
        }
        catch (err) {
            console.error('Messaging: Failed to parse session:', err);
        }
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: MessagingOverlayComponent, deps: [{ token: MessagingStoreService }, { token: AuthService }], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "17.3.12", type: MessagingOverlayComponent, isStandalone: true, selector: "app-messaging-overlay", ngImport: i0, template: `
    <ng-container *ngIf="isAuthenticated">
      <app-floating-button></app-floating-button>
      <app-chat-panel></app-chat-panel>
    </ng-container>
  `, isInline: true, dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i2.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "component", type: FloatingButtonComponent, selector: "app-floating-button" }, { kind: "component", type: ChatPanelComponent, selector: "app-chat-panel" }] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: MessagingOverlayComponent, decorators: [{
            type: Component,
            args: [{
                    selector: 'app-messaging-overlay',
                    standalone: true,
                    imports: [CommonModule, FloatingButtonComponent, ChatPanelComponent],
                    template: `
    <ng-container *ngIf="isAuthenticated">
      <app-floating-button></app-floating-button>
      <app-chat-panel></app-chat-panel>
    </ng-container>
  `,
                }]
        }], ctorParameters: () => [{ type: MessagingStoreService }, { type: AuthService }] });

// ── Configuration ──

/**
 * Generated bundle index. Do not edit.
 */

export { AuthService, ChatPanelComponent, ChatThreadComponent, FloatingButtonComponent, GroupManagerComponent, InboxListComponent, MESSAGING_CONFIG, MessageInputComponent, MessagingApiService, MessagingAuthBridgeService, MessagingFileService, MessagingOverlayComponent, MessagingStoreService, MessagingWebSocketService, NewConversationComponent, getContactDisplayName, getMessageSenderName };
//# sourceMappingURL=ces-messaging.mjs.map
