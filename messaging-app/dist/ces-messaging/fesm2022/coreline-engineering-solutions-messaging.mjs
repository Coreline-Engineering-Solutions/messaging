import * as i0 from '@angular/core';
import { InjectionToken, Inject, Injectable, Component, EventEmitter, ViewChild, Output, Input, ViewChildren, ViewEncapsulation } from '@angular/core';
import { BehaviorSubject, Subject, of, from, throwError, Observable, forkJoin, combineLatest, Subscription, debounceTime } from 'rxjs';
import { tap, concatMap, toArray, catchError, map } from 'rxjs/operators';
import * as i1 from '@angular/common/http';
import { HttpParams } from '@angular/common/http';
import * as i1$1 from '@angular/common';
import { CommonModule } from '@angular/common';
import * as i3 from '@angular/forms';
import { FormsModule } from '@angular/forms';
import * as i4 from '@angular/material/icon';
import { MatIconModule } from '@angular/material/icon';
import * as i6 from '@angular/material/button';
import { MatButtonModule } from '@angular/material/button';
import * as i7 from '@angular/material/tooltip';
import { MatTooltipModule } from '@angular/material/tooltip';
import * as i6$1 from '@angular/material/core';
import { MatRippleModule, MatNativeDateModule } from '@angular/material/core';
import * as i9 from '@angular/material/progress-spinner';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import * as i5 from '@angular/platform-browser';
import * as i4$1 from '@angular/material/menu';
import { MatMenuModule } from '@angular/material/menu';
import * as i7$1 from '@angular/material/input';
import { MatInputModule } from '@angular/material/input';
import * as i8 from '@angular/material/form-field';
import { MatFormFieldModule } from '@angular/material/form-field';
import * as i10 from '@angular/material/datepicker';
import { MatDatepickerModule } from '@angular/material/datepicker';

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
function isProjectConversation(item) {
    return item.is_project === true || item.conversation_type?.toLowerCase() === 'project' || !!item.project_gid;
}
const PLAIN_TEXT_MESSAGE_PREFIX = '[messaging:plain-text]\n';
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
/**
 * Helper function to create a Contact object from common user data shapes.
 * Reduces boilerplate when integrating with existing auth systems.
 *
 * **`contact_id` must match your backend**
 * Many APIs (including typical CES / FastAPI bigint routes) expect a **numeric** contact id in
 * URL paths such as `/messaging/contacts/{contact_id}/...`. Email is a common human identifier
 * but is often **wrong** for those routes. Prefer:
 * - resolving the server contact id first (e.g. `GET .../messaging/contacts/by-email?email=...` when your API provides it), then passing that id as `contact_id`, or
 * - `contactIdHint: 'id'` / `'userId'` when your auth user already carries the numeric messaging id.
 *
 * @param user - User object with email and optional fields
 * @param sessionGid - Session GUID from authentication
 * @param contactIdHint - Optional field name for `contact_id` (see `MessagingConfig.contactIdHint`)
 * @returns Contact object ready for `setSession()`
 *
 * @example
 * // Backend expects numeric id — use server lookup first, then set contact_id
 * // const numericId = await fetchByEmail(user.email);
 * // createContactFromUser({ ...user, id: numericId }, sessionGid, 'id');
 *
 * @example
 * // Using email as contact_id (only if your backend truly accepts email in paths)
 * const contact = createContactFromUser({
 *   email: 'user@example.com',
 *   firstName: 'John',
 *   lastName: 'Doe',
 *   company: 'Acme Corp'
 * }, sessionGid);
 *
 * @example
 * const contact = createContactFromUser({
 *   email: 'user@example.com',
 *   id: '12345',
 *   firstName: 'John'
 * }, sessionGid, 'id');
 *
 * messagingAuth.setSession(sessionGid, contact);
 */
function createContactFromUser(user, sessionGid, contactIdHint) {
    // Determine contact_id based on hint or default to email
    let contactId = user.email;
    if (contactIdHint && user[contactIdHint]) {
        contactId = String(user[contactIdHint]);
    }
    return {
        contact_id: contactId,
        user_gid: sessionGid,
        email: user.email,
        first_name: user.firstName || '',
        last_name: user.lastName || '',
        company_name: user.company || '',
        is_active: true
    };
}

/**
 * One-shot dev warnings for common misconfiguration. Safe to call from services;
 * each logical warning fires at most once per process for a given contact id / prefix check.
 */
const warnedEmailLikeContactIds = new Set();
let warnedWsApiPrefixMismatch = false;
function warnEmailLikeContactId(contactId) {
    if (!contactId?.includes('@'))
        return;
    if (warnedEmailLikeContactIds.has(contactId))
        return;
    warnedEmailLikeContactIds.add(contactId);
    console.warn('[@coreline-engineering-solutions/messaging] contact_id looks like an email. Many backends expect a numeric contact id in REST paths and WebSockets. Resolve the numeric id first when your API supports it (for example GET .../messaging/contacts/by-email?email=...), then set Contact.contact_id to that value.');
}
function warnIfWsBaseUrlMissingApiPrefixWhenApiHasIt(apiBaseUrl, wsBaseUrl) {
    if (warnedWsApiPrefixMismatch)
        return;
    const api = apiBaseUrl ?? '';
    const ws = wsBaseUrl ?? '';
    if (!api.includes('/api') || ws.includes('/api'))
        return;
    warnedWsApiPrefixMismatch = true;
    console.warn('[@coreline-engineering-solutions/messaging] apiBaseUrl includes "/api" but wsBaseUrl does not. If REST is mounted under /api, wsBaseUrl should usually use the same URL path prefix (e.g. wss://your-host/api). Some deployments mount WebSockets at the root; this is only a warning.');
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
    login(email, password, apiBaseUrlOverride) {
        const base = (apiBaseUrlOverride ?? this.config.apiBaseUrl).replace(/\/$/, '');
        return this.http.post(`${base}/auth`, {
            function: '_login',
            email,
            password,
        }).pipe(tap((res) => {
            this.sessionGid$.next(res.session_gid);
            this.persistSession();
        }));
    }
    setSession(sessionGid, contact) {
        warnEmailLikeContactId(contact.contact_id);
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
        warnEmailLikeContactId(contactId);
        return this.http.get(`${this.base}/contacts/${contactId}/inbox`);
    }
    // ── Messages ──
    getMessages(conversationId, contactId, beforeMessageId, limit = 50) {
        let params = new HttpParams()
            .set('contact_id', contactId)
            .set('limit', limit.toString());
        if (beforeMessageId) {
            params = params.set('before', beforeMessageId);
        }
        return this.http.get(`${this.base}/conversations/${conversationId}/messages`, { params });
    }
    sendMessage(conversationId, senderContactId, content, messageType = 'TEXT', mediaUrl) {
        const body = {
            sender_id: parseInt(senderContactId),
            content,
        };
        return this.http.post(`${this.base}/conversations/${conversationId}/messages`, body);
    }
    sendDirectMessage(senderContactId, recipientContactId, content, messageType = 'TEXT') {
        return this.http.post(`${this.base}/direct-messages`, {
            sender_id: parseInt(senderContactId),
            recipient_id: parseInt(recipientContactId),
            content,
        });
    }
    markConversationRead(conversationId, contactId) {
        return this.http.post(`${this.base}/conversations/${conversationId}/read`, {
            contact_id: parseInt(contactId, 10),
        });
    }
    // ── Conversations ──
    createConversation(creatorContactId, participantContactIds, name) {
        return this.http.post(`${this.base}/conversations`, {
            creator_id: parseInt(creatorContactId),
            participants: participantContactIds.map(id => parseInt(id)),
            name: name || null,
        });
    }
    getDirectConversation(contactA, contactB) {
        const params = new HttpParams()
            .set('contactA', contactA)
            .set('contactB', contactB);
        return this.http.get(`${this.base}/conversations/direct`, { params });
    }
    getConversationParticipants(conversationId) {
        return this.http.get(`${this.base}/conversations/${conversationId}/participants`);
    }
    // ── Contacts ──
    getVisibleContacts(contactId) {
        warnEmailLikeContactId(contactId);
        return this.http.get(`${this.base}/contacts/${contactId}/visible-contacts`);
    }
    checkContactProfile(contactId, updates) {
        return this.http.post(`${this.base}/contacts/check`, {
            contact_id: parseInt(contactId),
        });
    }
    // ── Groups ──
    manageGroup(contactId, action, conversationId, groupName, participantContactIds) {
        const payload = {
            contact_id: parseInt(contactId),
        };
        if (conversationId)
            payload.conversation_id = parseInt(conversationId);
        if (groupName)
            payload.name = groupName;
        if (participantContactIds)
            payload.participant_ids = participantContactIds.map(id => parseInt(id));
        return this.http.post(`${this.base}/groups`, {
            action,
            payload,
        });
    }
    // ── Delete / Clear ──
    deleteConversation(conversationId, contactId) {
        return this.http.post(`${this.base}/conversations/${conversationId}/delete`, {
            contactId,
        });
    }
    clearConversation(conversationId, contactId) {
        return this.http.post(`${this.base}/conversations/${conversationId}/clear`, {
            contactId,
        });
    }
    deleteGroup(conversationId, contactId) {
        return this.manageGroup(contactId, 'remove', conversationId);
    }
    // ── Attachments ──
    uploadAttachment(file) {
        const formData = new FormData();
        formData.append('file', file, file.name);
        return this.http.post(`${this.base}/attachments/upload`, formData);
    }
    // ── Reactions ──
    addReaction(messageId, contactId, emoji) {
        return this.http.post(`${this.base}/messages/${messageId}/reactions`, {
            contact_id: parseInt(contactId),
            emoji,
        });
    }
    removeReaction(messageId, contactId, emoji) {
        return this.http.delete(`${this.base}/messages/${messageId}/reactions`, {
            body: {
                contact_id: parseInt(contactId),
                emoji,
            },
        });
    }
    getReactions(messageId) {
        return this.http.get(`${this.base}/messages/${messageId}/reactions`);
    }
    // ── Threads ──
    getThreadMessages(parentMessageId, contactId) {
        const params = new HttpParams()
            .set('contact_id', contactId);
        return this.http.get(`${this.base}/messages/${parentMessageId}/thread`, { params });
    }
    sendThreadReply(parentMessageId, senderContactId, content) {
        return this.http.post(`${this.base}/messages/${parentMessageId}/replies`, {
            sender_id: parseInt(senderContactId),
            content,
        });
    }
    // ── Message Actions ──
    editMessage(messageId, contactId, newContent) {
        return this.http.put(`${this.base}/messages/${messageId}`, {
            contactId,
            content: newContent,
        });
    }
    deleteMessage(messageId, contactId) {
        return this.http.delete(`${this.base}/messages/${messageId}`, {
            body: {
                contactId,
            },
        });
    }
    pinMessage(messageId, conversationId, contactId) {
        return this.http.post(`${this.base}/messages/${messageId}/pin`, {
            conversationId,
            contactId,
        });
    }
    unpinMessage(messageId, contactId) {
        return this.http.delete(`${this.base}/messages/${messageId}/pin`, {
            body: {
                contactId,
            },
        });
    }
    // ── Presence ──
    updatePresence(contactId, status, customStatus) {
        warnEmailLikeContactId(contactId);
        const params = new HttpParams().set('status', status);
        return this.http.put(`${this.base}/contacts/${contactId}/presence`, null, { params });
    }
    getPresence(contactId) {
        warnEmailLikeContactId(contactId);
        return this.http.get(`${this.base}/contacts/${contactId}/presence`);
    }
    // ── Search ──
    searchMessages(contactId, query, conversationId) {
        return this.http.post(`${this.base}/search`, {
            contact_id: parseInt(contactId),
            query,
            conversation_id: conversationId ? parseInt(conversationId) : null,
        });
    }
    // ── Notifications ──
    updateNotificationSettings(conversationId, contactId, settings) {
        return this.http.put(`${this.base}/conversations/${conversationId}/notifications`, {
            contactId,
            ...settings,
        });
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
    /** Drop any in-flight or previous socket so a new WebSocket() never overlaps CONNECTING + OPEN. */
    abandonCurrentSocket() {
        if (!this.ws)
            return;
        this.ws.onopen = null;
        this.ws.onmessage = null;
        this.ws.onerror = null;
        this.ws.onclose = null;
        try {
            this.ws.close();
        }
        catch {
            /* ignore */
        }
        this.ws = null;
    }
    disconnect() {
        this.stopPing();
        clearTimeout(this.reconnectTimer);
        this.abandonCurrentSocket();
        this.connectionStatus$.next('disconnected');
    }
    subscribe(conversationId) {
        this.subscribedConversations.add(conversationId);
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.send({ type: 'subscribe', conversation_id: conversationId });
        }
    }
    unsubscribe(conversationId) {
        this.subscribedConversations.delete(conversationId);
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.send({ type: 'unsubscribe', conversation_id: conversationId });
        }
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
        warnIfWsBaseUrlMissingApiPrefixWhenApiHasIt(this.config.apiBaseUrl, this.config.wsBaseUrl);
        warnEmailLikeContactId(this.contactId);
        this.abandonCurrentSocket();
        try {
            this.ws = new WebSocket(`${this.config.wsBaseUrl}/messaging/ws/${this.contactId}`);
        }
        catch {
            this.attemptReconnect();
            return;
        }
        this.ws.onopen = () => {
            this.connectionStatus$.next('connected');
            this.reconnectAttempts = 0;
            this.authenticate();
            this.resubscribe();
            this.startPing();
        };
        this.ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'auth_success') {
                    this.connectionStatus$.next('authenticated');
                }
                this.messages$.next(msg);
            }
            catch {
            }
        };
        this.ws.onerror = () => {
            // onerror is followed by onclose
        };
        this.ws.onclose = (event) => {
            this.connectionStatus$.next('disconnected');
            this.stopPing();
            this.attemptReconnect();
        };
    }
    authenticate() {
        this.send({ type: 'auth', session_gid: this.sessionGid });
    }
    resubscribe() {
        this.subscribedConversations.forEach((id) => {
            this.send({ type: 'subscribe', conversation_id: id });
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
            this.send({ type: 'ping' });
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
            this.ws.send(JSON.stringify(data));
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

/** Sentinel prefix — never send these IDs to any API. */
const TEMP_PREFIX = 'temp-';
function isTempId(id) {
    return !id || id.startsWith(TEMP_PREFIX);
}
function isStructuredId(id) {
    const value = String(id || '').trim();
    return value.startsWith('{') || value.startsWith('[');
}
class MessagingFileService {
    http;
    auth;
    config;
    /** Base URL, e.g. https://ces-ticketing-system-db.onrender.com/api */
    base;
    /** Ordered fallback lists — tried top-to-bottom on 404 / network error. */
    uploadEndpoints;
    retrieveEndpoints;
    deleteEndpoints;
    /** In-session cache: file_id → data URL. Cleared on page reload. */
    mediaCache = new Map();
    mediaFailures = new Set();
    constructor(http, auth, config) {
        this.http = http;
        this.auth = auth;
        this.config = config;
        this.base = this.config.apiBaseUrl.replace(/\/+$/, '');
        this.uploadEndpoints = [`${this.base}/storage/upload`, `${this.base}/files/upload`, `${this.base}/messaging/storage/upload`, `${this.base}/messaging/files/upload`];
        this.retrieveEndpoints = [`${this.base}/storage/retrieve`, `${this.base}/files/retrieve`, `${this.base}/messaging/storage/retrieve`, `${this.base}/messaging/files/retrieve`];
        this.deleteEndpoints = [`${this.base}/storage/delete`, `${this.base}/files/delete`, `${this.base}/messaging/storage/delete`, `${this.base}/messaging/files/delete`];
    }
    // ── Upload ───────────────────────────────────────────────────────────────
    uploadFile(file, category = 'messaging_attachments') {
        const makeBody = () => {
            const fd = new FormData();
            fd.append('file', file, file.name);
            fd.append('category', category);
            return fd;
        };
        return this.tryEndpoints(this.uploadEndpoints, makeBody);
    }
    uploadFiles(files) {
        if (files.length === 0)
            return of([]);
        return from(files).pipe(concatMap((file) => this.uploadFile(file)), toArray());
    }
    // ── Retrieve ─────────────────────────────────────────────────────────────
    retrieveFile(fileId) {
        if (isTempId(fileId)) {
            return throwError(() => new Error('Cannot retrieve file: upload not complete yet.'));
        }
        if (isStructuredId(fileId)) {
            return throwError(() => new Error('Cannot retrieve file: invalid structured attachment id.'));
        }
        if (this.mediaFailures.has(fileId)) {
            return throwError(() => new Error('Cannot retrieve file: previous retrieve failed.'));
        }
        const makeBody = () => {
            const fd = new FormData();
            fd.append('file_id', fileId);
            return fd;
        };
        return this.tryEndpoints(this.retrieveEndpoints, makeBody, false).pipe(catchError((err) => {
            this.mediaFailures.add(fileId);
            return throwError(() => err);
        }));
    }
    /**
     * Returns a data URL for the given file_id.
     * Cached in memory for the session lifetime — never re-fetched if already loaded.
     */
    getFileDataUrl(fileId) {
        if (isTempId(fileId)) {
            return throwError(() => new Error('Cannot retrieve file: upload not complete yet.'));
        }
        if (isStructuredId(fileId)) {
            return throwError(() => new Error('Cannot retrieve file: invalid structured attachment id.'));
        }
        if (this.mediaFailures.has(fileId)) {
            return throwError(() => new Error('Cannot retrieve file: previous retrieve failed.'));
        }
        const cached = this.mediaCache.get(fileId);
        if (cached)
            return of(cached);
        return this.retrieveFile(fileId).pipe(map((r) => `data:${r.mime_type};base64,${r.base64_data}`), tap((dataUrl) => this.mediaCache.set(fileId, dataUrl)));
    }
    /** Synchronous cache lookup — null if not loaded yet. */
    getCachedDataUrl(fileId) {
        if (isTempId(fileId) || isStructuredId(fileId) || this.mediaFailures.has(fileId))
            return null;
        return this.mediaCache.get(fileId) ?? null;
    }
    /** Pre-warm cache for a list of file IDs (fire-and-forget, skips temp/cached). */
    prewarmCache(fileIds) {
        for (const id of fileIds) {
            if (!isTempId(id) && !isStructuredId(id) && !this.mediaFailures.has(id) && !this.mediaCache.has(id)) {
                this.getFileDataUrl(id).subscribe({ error: () => { } });
            }
        }
    }
    // ── Delete ────────────────────────────────────────────────────────────────
    deleteFile(fileId) {
        if (isTempId(fileId) || isStructuredId(fileId)) {
            return of(null);
        }
        this.mediaCache.delete(fileId);
        const makeBody = () => {
            const fd = new FormData();
            fd.append('file_id', fileId);
            return fd;
        };
        return this.tryEndpoints(this.deleteEndpoints, makeBody, false);
    }
    // ── Send message with attachments ────────────────────────────────────────
    sendMessageWithAttachments(conversationId, senderContactId, content, fileIds, filenames, mimeTypes = []) {
        // Guard: never send temp file IDs to the backend
        const realIds = fileIds.filter(id => !isTempId(id));
        if (realIds.length !== fileIds.length) {
            return throwError(() => new Error('Upload not finished — cannot attach temp file.'));
        }
        const messagingBase = `${this.base}/messaging`;
        return this.http.post(`${messagingBase}/conversations/${conversationId}/messages`, {
            sender_id: parseInt(senderContactId, 10),
            content: content || '',
            attachment_ids: realIds,
            filenames,
            mime_types: mimeTypes,
        });
    }
    // ── Fallback engine ───────────────────────────────────────────────────────
    /**
     * POST each URL in `urls` sequentially (using the body from `bodyFn()`).
     * Falls back to the next URL only on 404 or network error (status 0).
     * Logs every attempt with its result.
     */
    tryEndpoints(urls, bodyFn, fallbackOnNetwork = true) {
        if (urls.length === 0) {
            return throwError(() => new Error('All storage endpoints exhausted.'));
        }
        const [url, ...rest] = urls;
        return this.http.post(url, bodyFn()).pipe(catchError((err) => {
            // Only fall through on not-found or network issues
            if ((err.status === 404 || (fallbackOnNetwork && err.status === 0)) && rest.length > 0) {
                return this.tryEndpoints(rest, bodyFn, fallbackOnNetwork);
            }
            // Translate to a friendly error
            return throwError(() => this.toFriendlyError(err, url));
        }));
    }
    toFriendlyError(err, url) {
        const detail = err.error?.detail || err.error?.message || '';
        if (err.status === 404 && detail.toLowerCase().includes('not found')) {
            return new Error('Attachment not available or not uploaded yet.');
        }
        if (err.status === 401)
            return new Error('Unauthorized — check storage API key configuration.');
        if (err.status === 0)
            return new Error('Network error — storage service unreachable.');
        return new Error(detail || `Storage request failed (${err.status}) — ${url}`);
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
    isFloating = false;
    sub;
    constructor(store) {
        this.store = store;
    }
    ngOnInit() {
        this.sub = combineLatest([
            this.store.totalUnread,
            this.store.sidebarSide,
            this.store.panelOpen,
            this.store.panelFloating,
        ]).subscribe(([count, side, open, floating]) => {
            this.unreadCount = count;
            this.side = side;
            this.isOpen = open;
            this.isFloating = floating;
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
      *ngIf="!isOpen || isFloating"
      class="floating-btn"
      [class.side-left]="side === 'left'"
      [class.side-right]="side === 'right'"
      [class.panel-open]="isOpen"
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
  `, isInline: true, styles: [".floating-btn{position:fixed;bottom:20px;z-index:10000;cursor:pointer;-webkit-user-select:none;user-select:none}.floating-btn.side-right{right:20px}.floating-btn.side-left{left:20px}.fab-inner{width:44px;height:44px;border-radius:50%;background:#041322;border:2px solid rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;box-shadow:0 3px 16px #0009;transition:transform .2s ease,box-shadow .2s ease,border-color .2s ease;position:relative}.fab-inner:hover{transform:scale(1.1);border-color:#fff6;box-shadow:0 4px 20px #000c}.fab-inner.has-unread{animation:pulse 2s infinite}.floating-btn.panel-open .fab-inner{background:#0a3d62;border-color:#ffffff59}.ces-logo{width:24px;height:24px}.badge{position:absolute;top:-4px;right:-4px;background:#ef4444;color:#fff;border-radius:10px;min-width:18px;height:18px;font-size:10px;font-weight:600;display:flex;align-items:center;justify-content:center;padding:0 4px;border:2px solid #fff}@keyframes pulse{0%,to{box-shadow:0 3px 16px #0009;border-color:#ffffff2e}50%{box-shadow:0 3px 24px #ffffff26;border-color:#fff6}}\n"], dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i1$1.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: FloatingButtonComponent, decorators: [{
            type: Component,
            args: [{ selector: 'app-floating-button', standalone: true, imports: [CommonModule], template: `
    <div
      *ngIf="!isOpen || isFloating"
      class="floating-btn"
      [class.side-left]="side === 'left'"
      [class.side-right]="side === 'right'"
      [class.panel-open]="isOpen"
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
  `, styles: [".floating-btn{position:fixed;bottom:20px;z-index:10000;cursor:pointer;-webkit-user-select:none;user-select:none}.floating-btn.side-right{right:20px}.floating-btn.side-left{left:20px}.fab-inner{width:44px;height:44px;border-radius:50%;background:#041322;border:2px solid rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;box-shadow:0 3px 16px #0009;transition:transform .2s ease,box-shadow .2s ease,border-color .2s ease;position:relative}.fab-inner:hover{transform:scale(1.1);border-color:#fff6;box-shadow:0 4px 20px #000c}.fab-inner.has-unread{animation:pulse 2s infinite}.floating-btn.panel-open .fab-inner{background:#0a3d62;border-color:#ffffff59}.ces-logo{width:24px;height:24px}.badge{position:absolute;top:-4px;right:-4px;background:#ef4444;color:#fff;border-radius:10px;min-width:18px;height:18px;font-size:10px;font-weight:600;display:flex;align-items:center;justify-content:center;padding:0 4px;border:2px solid #fff}@keyframes pulse{0%,to{box-shadow:0 3px 16px #0009;border-color:#ffffff2e}50%{box-shadow:0 3px 24px #ffffff26;border-color:#fff6}}\n"] }]
        }], ctorParameters: () => [{ type: MessagingStoreService }] });

class InboxListComponent {
    store;
    inbox = [];
    searchQuery = '';
    activeTab = 'all';
    notificationVolume = 0.35;
    notificationsMuted = false;
    messageTextScale = 1;
    codeTextScale = 1;
    contextMenu = null;
    tabStorageKey = 'messaging_inbox_active_tab';
    sub;
    constructor(store) {
        this.store = store;
    }
    ngOnInit() {
        this.activeTab = this.getSavedTab();
        this.sub = new Subscription();
        this.sub.add(this.store.inbox.subscribe((items) => (this.inbox = items)));
        this.sub.add(this.store.notificationVolume.subscribe((volume) => (this.notificationVolume = volume)));
        this.sub.add(this.store.notificationsMuted.subscribe((muted) => (this.notificationsMuted = muted)));
        this.sub.add(this.store.messageTextScale.subscribe((scale) => (this.messageTextScale = scale)));
        this.sub.add(this.store.codeTextScale.subscribe((scale) => (this.codeTextScale = scale)));
    }
    ngOnDestroy() {
        this.sub?.unsubscribe();
    }
    get filteredInbox() {
        if (this.activeTab === 'settings')
            return [];
        const tabbed = this.inbox.filter((item) => {
            const project = this.isProject(item);
            if (this.activeTab === 'direct')
                return !item.is_group;
            if (this.activeTab === 'groups')
                return item.is_group && !project;
            if (this.activeTab === 'projects')
                return project;
            return true;
        });
        if (!this.searchQuery.trim())
            return tabbed;
        const q = this.searchQuery.toLowerCase();
        return tabbed.filter((item) => (item.name || '').toLowerCase().includes(q) ||
            (item.last_message_preview || '').toLowerCase().includes(q));
    }
    get emptyStateText() {
        if (this.searchQuery.trim())
            return 'No matching conversations';
        if (this.activeTab === 'direct')
            return 'No chats yet';
        if (this.activeTab === 'groups')
            return 'No groups yet';
        if (this.activeTab === 'projects')
            return 'No project chats yet';
        return 'No conversations yet';
    }
    isProject(item) {
        return isProjectConversation(item);
    }
    setActiveTab(tab) {
        this.activeTab = tab;
        localStorage.setItem(this.tabStorageKey, tab);
        this.contextMenu = null;
    }
    getSavedTab() {
        const saved = localStorage.getItem(this.tabStorageKey);
        return saved === 'direct' || saved === 'groups' || saved === 'projects' || saved === 'settings' || saved === 'all'
            ? saved
            : 'all';
    }
    toggleNotificationsMuted() {
        const nextMuted = !this.notificationsMuted;
        this.store.setNotificationsMuted(nextMuted);
        if (!nextMuted && this.notificationVolume > 0) {
            this.store.testNotificationSound();
        }
    }
    onNotificationVolumeChange(value) {
        this.store.setNotificationVolume(Number(value));
    }
    previewNotificationSound() {
        if (!this.notificationsMuted && this.notificationVolume > 0) {
            this.store.testNotificationSound();
        }
    }
    onMessageTextScaleChange(value) {
        this.store.setMessageTextScale(Number(value));
    }
    onCodeTextScaleChange(value) {
        this.store.setCodeTextScale(Number(value));
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
      <div *ngIf="activeTab !== 'settings'" class="search-bar">
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
          <div
            class="avatar"
            [class.group-avatar]="item.is_group && !isProject(item)"
            [class.project-avatar]="isProject(item)"
          >
            <mat-icon>{{ isProject(item) ? 'workspaces' : item.is_group ? 'group' : 'person' }}</mat-icon>
          </div>
          <div class="conversation-info">
            <div class="info-top">
              <span class="conv-name">{{ item.name || 'Direct Message' }}</span>
              <span class="conv-time">{{ formatTime(item.last_message_at) }}</span>
            </div>
            <div class="info-bottom">
              <span class="conv-preview">{{ item.last_message_preview || 'No messages yet' }}</span>
              <span
                *ngIf="item.has_mention"
                class="mention-badge"
                matTooltip="You were mentioned"
                matTooltipPosition="above"
              >&#64;</span>
              <span *ngIf="item.unread_count > 0" class="unread-badge">
                {{ item.unread_count > 99 ? '99+' : item.unread_count }}
              </span>
            </div>
          </div>
        </div>

        <div *ngIf="filteredInbox.length === 0 && activeTab !== 'settings'" class="empty-state">
          <mat-icon>{{ activeTab === 'projects' ? 'workspaces' : activeTab === 'groups' ? 'group' : 'forum' }}</mat-icon>
          <p>{{ emptyStateText }}</p>
          <button *ngIf="!searchQuery && activeTab !== 'groups' && activeTab !== 'projects'" mat-stroked-button color="primary" (click)="onNewConversation()">
            Start a conversation
          </button>
          <button *ngIf="!searchQuery && activeTab === 'groups'" mat-stroked-button color="primary" (click)="onCreateGroup()">
            Create a group
          </button>
        </div>

        <div *ngIf="activeTab === 'settings'" class="settings-panel">
          <div class="settings-card">
            <div class="settings-header">
              <div class="settings-icon">
                <mat-icon>{{ notificationsMuted || notificationVolume <= 0 ? 'volume_off' : 'volume_up' }}</mat-icon>
              </div>
              <div>
                <h4>Notification Sound</h4>
                <p>Control message alerts for this browser.</p>
              </div>
            </div>

            <button
              type="button"
              mat-stroked-button
              class="settings-toggle"
              (click)="toggleNotificationsMuted()"
            >
              <mat-icon>{{ notificationsMuted ? 'volume_up' : 'volume_off' }}</mat-icon>
              {{ notificationsMuted ? 'Unmute notifications' : 'Mute notifications' }}
            </button>

            <label class="volume-label" for="messaging-volume-slider">
              Volume
              <span>{{ (notificationVolume * 100) | number:'1.0-0' }}%</span>
            </label>
            <input
              id="messaging-volume-slider"
              type="range"
              min="0"
              max="1"
              step="0.05"
              class="settings-volume"
              [(ngModel)]="notificationVolume"
              (ngModelChange)="onNotificationVolumeChange($event)"
              (change)="previewNotificationSound()"
            />
          </div>

          <div class="settings-card">
            <div class="settings-header">
              <div class="settings-icon display-icon">
                <mat-icon>text_fields</mat-icon>
              </div>
              <div>
                <h4>Display Size</h4>
                <p>Adjust message text and programming block sizes.</p>
              </div>
            </div>

            <label class="volume-label" for="messaging-message-size-slider">
              Message size
              <span>{{ (messageTextScale * 100) | number:'1.0-0' }}%</span>
            </label>
            <input
              id="messaging-message-size-slider"
              type="range"
              min="0.8"
              max="1.5"
              step="0.05"
              class="settings-volume"
              [(ngModel)]="messageTextScale"
              (ngModelChange)="onMessageTextScaleChange($event)"
            />
            <div class="settings-preview message-preview" [style.font-size.px]="13 * messageTextScale">
              This is how normal message text will appear in chat.
            </div>

            <label class="volume-label" for="messaging-code-size-slider">
              Programming size
              <span>{{ (codeTextScale * 100) | number:'1.0-0' }}%</span>
            </label>
            <input
              id="messaging-code-size-slider"
              type="range"
              min="0.8"
              max="1.5"
              step="0.05"
              class="settings-volume"
              [(ngModel)]="codeTextScale"
              (ngModelChange)="onCodeTextScaleChange($event)"
            />
            <pre class="settings-preview code-preview" [style.font-size.px]="12 * codeTextScale"><code>SELECT ticket_ref, status
FROM logging.ticket
WHERE status = 'Open';</code></pre>
          </div>
        </div>
      </div>

      <div class="inbox-tabs" role="tablist" aria-label="Conversation filters">
        <button
          type="button"
          class="inbox-tab"
          [class.active]="activeTab === 'all'"
          (click)="setActiveTab('all')"
          matTooltip="All"
          matTooltipPosition="above"
        >
          <mat-icon>forum</mat-icon>
        </button>
        <button
          type="button"
          class="inbox-tab"
          [class.active]="activeTab === 'direct'"
          (click)="setActiveTab('direct')"
          matTooltip="Chats"
          matTooltipPosition="above"
        >
          <mat-icon>chat</mat-icon>
        </button>
        <button
          type="button"
          class="inbox-tab"
          [class.active]="activeTab === 'groups'"
          (click)="setActiveTab('groups')"
          matTooltip="Groups"
          matTooltipPosition="above"
        >
          <mat-icon>groups</mat-icon>
        </button>
        <button
          type="button"
          class="inbox-tab"
          [class.active]="activeTab === 'projects'"
          (click)="setActiveTab('projects')"
          matTooltip="Projects"
          matTooltipPosition="above"
        >
          <mat-icon>workspaces</mat-icon>
        </button>
        <button
          type="button"
          class="inbox-tab"
          [class.active]="activeTab === 'settings'"
          (click)="setActiveTab('settings')"
          matTooltip="Settings"
          matTooltipPosition="above"
        >
          <mat-icon>settings</mat-icon>
        </button>
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
          <mat-icon>{{ contextMenu.item.is_group ? 'logout' : 'delete' }}</mat-icon>
          <span>{{ contextMenu.item.is_group ? 'Exit group' : 'Delete conversation' }}</span>
        </div>
      </div>
      <div *ngIf="contextMenu" class="ctx-backdrop" (click)="closeContextMenu()"></div>
    </div>
  `, isInline: true, styles: [".inbox-container{display:flex;flex-direction:column;height:100%;background:transparent;container-type:inline-size}.search-bar{display:flex;align-items:center;margin:8px 16px;padding:8px 12px;background:transparent;border-radius:10px}.search-icon{color:#ffffffb3;font-size:18px;width:20px;height:20px;margin-right:8px}.search-input{flex:1;border:none;outline:none;background:transparent;font-size:14px;color:#fff}.search-input::placeholder{color:#fff9}.inbox-tabs{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:5px;padding:10px 16px 12px;border-top:1px solid rgba(255,255,255,.1);flex-shrink:0}.inbox-tab{min-width:0;border:1px solid rgba(255,255,255,.14);background:#ffffff0f;color:#ffffffb8;border-radius:999px;padding:6px 4px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:background .15s,border-color .15s,color .15s}.inbox-tab mat-icon{font-size:clamp(17px,6cqw,21px);width:clamp(17px,6cqw,21px);height:clamp(17px,6cqw,21px);line-height:clamp(17px,6cqw,21px)}.inbox-tab:hover{background:#ffffff1f;color:#fff}.inbox-tab.active{background:#1a5fa859;border-color:#7fb4ff73;color:#fff}@container (max-width: 330px){.inbox-tabs{gap:3px;padding:8px 8px 10px}.inbox-tab{padding:6px 2px;letter-spacing:-.2px}}@container (max-width: 280px){.inbox-tabs{gap:2px;padding-left:6px;padding-right:6px}.inbox-tab{font-size:8.5px}}.conversation-list{flex:1;overflow-y:auto;scrollbar-width:none;-ms-overflow-style:none}.conversation-list::-webkit-scrollbar{display:none}.conversation-item{display:flex;align-items:center;padding:12px 16px;cursor:pointer;transition:background .15s;gap:12px}.conversation-item:hover{background:#ffffff1a}.conversation-item.has-unread{background:#ffffff26}.avatar{width:48px;height:48px;border-radius:50%;background:#0d2540;display:flex;align-items:center;justify-content:center;flex-shrink:0}.avatar mat-icon{color:#ffffffb3;font-size:24px}.group-avatar{background:#0a1f38}.group-avatar mat-icon{color:#ffffffb3}.project-avatar{background:#2563eb33}.project-avatar mat-icon{color:#bfdbfe}.conversation-info{flex:1;min-width:0}.info-top{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:2px}.conv-name{font-weight:600;font-size:14px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px}.conv-time{font-size:11px;color:#ffffffb3;flex-shrink:0;margin-left:8px}.info-bottom{display:flex;justify-content:space-between;align-items:center;gap:6px}.conv-preview{font-size:13px;color:#ffffffb3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px}.has-unread .conv-name{color:#fff}.has-unread .conv-preview{color:#ffffffe6;font-weight:500}.unread-badge{background:#1a5fa8;color:#fff;border-radius:10px;min-width:20px;height:20px;font-size:11px;font-weight:600;display:flex;align-items:center;justify-content:center;padding:0 6px;flex-shrink:0}.mention-badge{width:20px;height:20px;border-radius:999px;background:#7fb4ff33;border:1px solid rgba(127,180,255,.55);color:#bfdbfe;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex-shrink:0;margin-left:6px;box-shadow:0 0 0 2px #7fb4ff0f}.empty-state{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 24px;color:#9ca3af}.empty-state mat-icon{font-size:48px;width:48px;height:48px;margin-bottom:12px}.empty-state p{margin:0 0 16px;font-size:14px}.settings-panel{padding:16px;color:#fff;display:flex;flex-direction:column;gap:12px}.settings-card{border-radius:14px;background:#ffffff12;border:1px solid rgba(255,255,255,.12);padding:16px;box-shadow:0 10px 28px #0000002e}.settings-header{display:flex;gap:12px;align-items:flex-start;margin-bottom:16px}.settings-icon{width:36px;height:36px;border-radius:10px;background:#1a5fa859;display:flex;align-items:center;justify-content:center;flex-shrink:0}.settings-icon mat-icon{color:#bfdbfe}.settings-icon.display-icon{background:#86efac24}.settings-icon.display-icon mat-icon{color:#bbf7d0}.settings-header h4{margin:0 0 4px;font-size:15px;font-weight:700}.settings-header p{margin:0;color:#ffffffa6;font-size:12px;line-height:1.4}.settings-toggle{width:100%;justify-content:center;border-radius:10px;color:#fff!important;border-color:#fff3!important;margin-bottom:16px}.settings-toggle mat-icon{margin-right:8px;font-size:18px;width:18px;height:18px}.volume-label{display:flex;justify-content:space-between;align-items:center;color:#ffffffc7;font-size:12px;font-weight:600;margin-bottom:8px}.settings-volume{width:100%;accent-color:#7fb4ff;cursor:pointer;margin-bottom:12px}.settings-preview{margin:0 0 16px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:#ffffff0f;color:#f5f7ff;box-sizing:border-box}.message-preview{padding:9px 11px;line-height:1.35}.code-preview{padding:10px 11px;overflow:hidden;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,Liberation Mono,monospace;line-height:1.45;white-space:pre-wrap;color:#dbeafe;background:#061827;margin-bottom:0}.context-menu{position:fixed;z-index:10001;background:#071d30;border-radius:8px;padding:4px 0;box-shadow:0 8px 24px #0000004d;min-width:200px}.ctx-item{display:flex;align-items:center;gap:10px;padding:10px 16px;cursor:pointer;color:#ffffffe6;font-size:13px;transition:background .15s}.ctx-item:hover{background:#ffffff1a}.ctx-item mat-icon{font-size:18px;width:18px;height:18px}.ctx-danger{color:#f87171}.ctx-danger:hover{background:#f8717126}.ctx-backdrop{position:fixed;inset:0;z-index:10000}\n"], dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i1$1.NgForOf, selector: "[ngFor][ngForOf]", inputs: ["ngForOf", "ngForTrackBy", "ngForTemplate"] }, { kind: "directive", type: i1$1.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "pipe", type: i1$1.DecimalPipe, name: "number" }, { kind: "ngmodule", type: FormsModule }, { kind: "directive", type: i3.DefaultValueAccessor, selector: "input:not([type=checkbox])[formControlName],textarea[formControlName],input:not([type=checkbox])[formControl],textarea[formControl],input:not([type=checkbox])[ngModel],textarea[ngModel],[ngDefaultControl]" }, { kind: "directive", type: i3.RangeValueAccessor, selector: "input[type=range][formControlName],input[type=range][formControl],input[type=range][ngModel]" }, { kind: "directive", type: i3.NgControlStatus, selector: "[formControlName],[ngModel],[formControl]" }, { kind: "directive", type: i3.NgModel, selector: "[ngModel]:not([formControlName]):not([formControl])", inputs: ["name", "disabled", "ngModel", "ngModelOptions"], outputs: ["ngModelChange"], exportAs: ["ngModel"] }, { kind: "ngmodule", type: MatIconModule }, { kind: "component", type: i4.MatIcon, selector: "mat-icon", inputs: ["color", "inline", "svgIcon", "fontSet", "fontIcon"], exportAs: ["matIcon"] }, { kind: "ngmodule", type: MatButtonModule }, { kind: "component", type: i6.MatButton, selector: "    button[mat-button], button[mat-raised-button], button[mat-flat-button],    button[mat-stroked-button]  ", exportAs: ["matButton"] }, { kind: "ngmodule", type: MatRippleModule }, { kind: "directive", type: i6$1.MatRipple, selector: "[mat-ripple], [matRipple]", inputs: ["matRippleColor", "matRippleUnbounded", "matRippleCentered", "matRippleRadius", "matRippleAnimation", "matRippleDisabled", "matRippleTrigger"], exportAs: ["matRipple"] }, { kind: "ngmodule", type: MatTooltipModule }, { kind: "directive", type: i7.MatTooltip, selector: "[matTooltip]", inputs: ["matTooltipPosition", "matTooltipPositionAtOrigin", "matTooltipDisabled", "matTooltipShowDelay", "matTooltipHideDelay", "matTooltipTouchGestures", "matTooltip", "matTooltipClass"], exportAs: ["matTooltip"] }] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: InboxListComponent, decorators: [{
            type: Component,
            args: [{ selector: 'app-inbox-list', standalone: true, imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatRippleModule, MatTooltipModule], template: `
    <div class="inbox-container">
      <div *ngIf="activeTab !== 'settings'" class="search-bar">
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
          <div
            class="avatar"
            [class.group-avatar]="item.is_group && !isProject(item)"
            [class.project-avatar]="isProject(item)"
          >
            <mat-icon>{{ isProject(item) ? 'workspaces' : item.is_group ? 'group' : 'person' }}</mat-icon>
          </div>
          <div class="conversation-info">
            <div class="info-top">
              <span class="conv-name">{{ item.name || 'Direct Message' }}</span>
              <span class="conv-time">{{ formatTime(item.last_message_at) }}</span>
            </div>
            <div class="info-bottom">
              <span class="conv-preview">{{ item.last_message_preview || 'No messages yet' }}</span>
              <span
                *ngIf="item.has_mention"
                class="mention-badge"
                matTooltip="You were mentioned"
                matTooltipPosition="above"
              >&#64;</span>
              <span *ngIf="item.unread_count > 0" class="unread-badge">
                {{ item.unread_count > 99 ? '99+' : item.unread_count }}
              </span>
            </div>
          </div>
        </div>

        <div *ngIf="filteredInbox.length === 0 && activeTab !== 'settings'" class="empty-state">
          <mat-icon>{{ activeTab === 'projects' ? 'workspaces' : activeTab === 'groups' ? 'group' : 'forum' }}</mat-icon>
          <p>{{ emptyStateText }}</p>
          <button *ngIf="!searchQuery && activeTab !== 'groups' && activeTab !== 'projects'" mat-stroked-button color="primary" (click)="onNewConversation()">
            Start a conversation
          </button>
          <button *ngIf="!searchQuery && activeTab === 'groups'" mat-stroked-button color="primary" (click)="onCreateGroup()">
            Create a group
          </button>
        </div>

        <div *ngIf="activeTab === 'settings'" class="settings-panel">
          <div class="settings-card">
            <div class="settings-header">
              <div class="settings-icon">
                <mat-icon>{{ notificationsMuted || notificationVolume <= 0 ? 'volume_off' : 'volume_up' }}</mat-icon>
              </div>
              <div>
                <h4>Notification Sound</h4>
                <p>Control message alerts for this browser.</p>
              </div>
            </div>

            <button
              type="button"
              mat-stroked-button
              class="settings-toggle"
              (click)="toggleNotificationsMuted()"
            >
              <mat-icon>{{ notificationsMuted ? 'volume_up' : 'volume_off' }}</mat-icon>
              {{ notificationsMuted ? 'Unmute notifications' : 'Mute notifications' }}
            </button>

            <label class="volume-label" for="messaging-volume-slider">
              Volume
              <span>{{ (notificationVolume * 100) | number:'1.0-0' }}%</span>
            </label>
            <input
              id="messaging-volume-slider"
              type="range"
              min="0"
              max="1"
              step="0.05"
              class="settings-volume"
              [(ngModel)]="notificationVolume"
              (ngModelChange)="onNotificationVolumeChange($event)"
              (change)="previewNotificationSound()"
            />
          </div>

          <div class="settings-card">
            <div class="settings-header">
              <div class="settings-icon display-icon">
                <mat-icon>text_fields</mat-icon>
              </div>
              <div>
                <h4>Display Size</h4>
                <p>Adjust message text and programming block sizes.</p>
              </div>
            </div>

            <label class="volume-label" for="messaging-message-size-slider">
              Message size
              <span>{{ (messageTextScale * 100) | number:'1.0-0' }}%</span>
            </label>
            <input
              id="messaging-message-size-slider"
              type="range"
              min="0.8"
              max="1.5"
              step="0.05"
              class="settings-volume"
              [(ngModel)]="messageTextScale"
              (ngModelChange)="onMessageTextScaleChange($event)"
            />
            <div class="settings-preview message-preview" [style.font-size.px]="13 * messageTextScale">
              This is how normal message text will appear in chat.
            </div>

            <label class="volume-label" for="messaging-code-size-slider">
              Programming size
              <span>{{ (codeTextScale * 100) | number:'1.0-0' }}%</span>
            </label>
            <input
              id="messaging-code-size-slider"
              type="range"
              min="0.8"
              max="1.5"
              step="0.05"
              class="settings-volume"
              [(ngModel)]="codeTextScale"
              (ngModelChange)="onCodeTextScaleChange($event)"
            />
            <pre class="settings-preview code-preview" [style.font-size.px]="12 * codeTextScale"><code>SELECT ticket_ref, status
FROM logging.ticket
WHERE status = 'Open';</code></pre>
          </div>
        </div>
      </div>

      <div class="inbox-tabs" role="tablist" aria-label="Conversation filters">
        <button
          type="button"
          class="inbox-tab"
          [class.active]="activeTab === 'all'"
          (click)="setActiveTab('all')"
          matTooltip="All"
          matTooltipPosition="above"
        >
          <mat-icon>forum</mat-icon>
        </button>
        <button
          type="button"
          class="inbox-tab"
          [class.active]="activeTab === 'direct'"
          (click)="setActiveTab('direct')"
          matTooltip="Chats"
          matTooltipPosition="above"
        >
          <mat-icon>chat</mat-icon>
        </button>
        <button
          type="button"
          class="inbox-tab"
          [class.active]="activeTab === 'groups'"
          (click)="setActiveTab('groups')"
          matTooltip="Groups"
          matTooltipPosition="above"
        >
          <mat-icon>groups</mat-icon>
        </button>
        <button
          type="button"
          class="inbox-tab"
          [class.active]="activeTab === 'projects'"
          (click)="setActiveTab('projects')"
          matTooltip="Projects"
          matTooltipPosition="above"
        >
          <mat-icon>workspaces</mat-icon>
        </button>
        <button
          type="button"
          class="inbox-tab"
          [class.active]="activeTab === 'settings'"
          (click)="setActiveTab('settings')"
          matTooltip="Settings"
          matTooltipPosition="above"
        >
          <mat-icon>settings</mat-icon>
        </button>
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
          <mat-icon>{{ contextMenu.item.is_group ? 'logout' : 'delete' }}</mat-icon>
          <span>{{ contextMenu.item.is_group ? 'Exit group' : 'Delete conversation' }}</span>
        </div>
      </div>
      <div *ngIf="contextMenu" class="ctx-backdrop" (click)="closeContextMenu()"></div>
    </div>
  `, styles: [".inbox-container{display:flex;flex-direction:column;height:100%;background:transparent;container-type:inline-size}.search-bar{display:flex;align-items:center;margin:8px 16px;padding:8px 12px;background:transparent;border-radius:10px}.search-icon{color:#ffffffb3;font-size:18px;width:20px;height:20px;margin-right:8px}.search-input{flex:1;border:none;outline:none;background:transparent;font-size:14px;color:#fff}.search-input::placeholder{color:#fff9}.inbox-tabs{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:5px;padding:10px 16px 12px;border-top:1px solid rgba(255,255,255,.1);flex-shrink:0}.inbox-tab{min-width:0;border:1px solid rgba(255,255,255,.14);background:#ffffff0f;color:#ffffffb8;border-radius:999px;padding:6px 4px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:background .15s,border-color .15s,color .15s}.inbox-tab mat-icon{font-size:clamp(17px,6cqw,21px);width:clamp(17px,6cqw,21px);height:clamp(17px,6cqw,21px);line-height:clamp(17px,6cqw,21px)}.inbox-tab:hover{background:#ffffff1f;color:#fff}.inbox-tab.active{background:#1a5fa859;border-color:#7fb4ff73;color:#fff}@container (max-width: 330px){.inbox-tabs{gap:3px;padding:8px 8px 10px}.inbox-tab{padding:6px 2px;letter-spacing:-.2px}}@container (max-width: 280px){.inbox-tabs{gap:2px;padding-left:6px;padding-right:6px}.inbox-tab{font-size:8.5px}}.conversation-list{flex:1;overflow-y:auto;scrollbar-width:none;-ms-overflow-style:none}.conversation-list::-webkit-scrollbar{display:none}.conversation-item{display:flex;align-items:center;padding:12px 16px;cursor:pointer;transition:background .15s;gap:12px}.conversation-item:hover{background:#ffffff1a}.conversation-item.has-unread{background:#ffffff26}.avatar{width:48px;height:48px;border-radius:50%;background:#0d2540;display:flex;align-items:center;justify-content:center;flex-shrink:0}.avatar mat-icon{color:#ffffffb3;font-size:24px}.group-avatar{background:#0a1f38}.group-avatar mat-icon{color:#ffffffb3}.project-avatar{background:#2563eb33}.project-avatar mat-icon{color:#bfdbfe}.conversation-info{flex:1;min-width:0}.info-top{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:2px}.conv-name{font-weight:600;font-size:14px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px}.conv-time{font-size:11px;color:#ffffffb3;flex-shrink:0;margin-left:8px}.info-bottom{display:flex;justify-content:space-between;align-items:center;gap:6px}.conv-preview{font-size:13px;color:#ffffffb3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px}.has-unread .conv-name{color:#fff}.has-unread .conv-preview{color:#ffffffe6;font-weight:500}.unread-badge{background:#1a5fa8;color:#fff;border-radius:10px;min-width:20px;height:20px;font-size:11px;font-weight:600;display:flex;align-items:center;justify-content:center;padding:0 6px;flex-shrink:0}.mention-badge{width:20px;height:20px;border-radius:999px;background:#7fb4ff33;border:1px solid rgba(127,180,255,.55);color:#bfdbfe;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex-shrink:0;margin-left:6px;box-shadow:0 0 0 2px #7fb4ff0f}.empty-state{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 24px;color:#9ca3af}.empty-state mat-icon{font-size:48px;width:48px;height:48px;margin-bottom:12px}.empty-state p{margin:0 0 16px;font-size:14px}.settings-panel{padding:16px;color:#fff;display:flex;flex-direction:column;gap:12px}.settings-card{border-radius:14px;background:#ffffff12;border:1px solid rgba(255,255,255,.12);padding:16px;box-shadow:0 10px 28px #0000002e}.settings-header{display:flex;gap:12px;align-items:flex-start;margin-bottom:16px}.settings-icon{width:36px;height:36px;border-radius:10px;background:#1a5fa859;display:flex;align-items:center;justify-content:center;flex-shrink:0}.settings-icon mat-icon{color:#bfdbfe}.settings-icon.display-icon{background:#86efac24}.settings-icon.display-icon mat-icon{color:#bbf7d0}.settings-header h4{margin:0 0 4px;font-size:15px;font-weight:700}.settings-header p{margin:0;color:#ffffffa6;font-size:12px;line-height:1.4}.settings-toggle{width:100%;justify-content:center;border-radius:10px;color:#fff!important;border-color:#fff3!important;margin-bottom:16px}.settings-toggle mat-icon{margin-right:8px;font-size:18px;width:18px;height:18px}.volume-label{display:flex;justify-content:space-between;align-items:center;color:#ffffffc7;font-size:12px;font-weight:600;margin-bottom:8px}.settings-volume{width:100%;accent-color:#7fb4ff;cursor:pointer;margin-bottom:12px}.settings-preview{margin:0 0 16px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:#ffffff0f;color:#f5f7ff;box-sizing:border-box}.message-preview{padding:9px 11px;line-height:1.35}.code-preview{padding:10px 11px;overflow:hidden;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,Liberation Mono,monospace;line-height:1.45;white-space:pre-wrap;color:#dbeafe;background:#061827;margin-bottom:0}.context-menu{position:fixed;z-index:10001;background:#071d30;border-radius:8px;padding:4px 0;box-shadow:0 8px 24px #0000004d;min-width:200px}.ctx-item{display:flex;align-items:center;gap:10px;padding:10px 16px;cursor:pointer;color:#ffffffe6;font-size:13px;transition:background .15s}.ctx-item:hover{background:#ffffff1a}.ctx-item mat-icon{font-size:18px;width:18px;height:18px}.ctx-danger{color:#f87171}.ctx-danger:hover{background:#f8717126}.ctx-backdrop{position:fixed;inset:0;z-index:10000}\n"] }]
        }], ctorParameters: () => [{ type: MessagingStoreService }] });

class MessageInputComponent {
    conversationId = null;
    replyTo = null;
    enableMentions = false;
    mentionOptions = [];
    messageSent = new EventEmitter();
    messageWithFiles = new EventEmitter();
    replyCancelled = new EventEmitter();
    fileInput;
    messageTextarea;
    messageText = '';
    selectedFiles = [];
    textareaHeight = 36;
    mentionSuggestions = [];
    detectedCodeLanguage = null;
    codeDetectionDismissed = false;
    draftPrefix = 'messaging_draft_';
    lastConversationId = null;
    resizing = false;
    resizeStartY = 0;
    resizeStartHeight = 0;
    minTextareaHeight = 36;
    maxTextareaHeight = 180;
    manualTextareaHeight = this.minTextareaHeight;
    activeMentionStart = -1;
    activeMentionEnd = -1;
    boundResizeMove = this.onResizeMove.bind(this);
    boundResizeEnd = this.onResizeEnd.bind(this);
    ngOnChanges(changes) {
        if (!changes['conversationId'])
            return;
        if (this.lastConversationId && this.lastConversationId !== this.conversationId) {
            this.persistDraft(this.lastConversationId, this.messageText);
        }
        this.lastConversationId = this.conversationId;
        this.messageText = this.loadDraft(this.conversationId);
        this.updateCodeDetection(this.messageText);
        this.queueAutoResize();
    }
    ngAfterViewInit() {
        this.queueAutoResize();
    }
    ngOnDestroy() {
        document.removeEventListener('mousemove', this.boundResizeMove);
        document.removeEventListener('mouseup', this.boundResizeEnd);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    }
    get canSend() {
        return this.messageText.trim().length > 0 || this.selectedFiles.length > 0;
    }
    send() {
        if (!this.canSend)
            return;
        const text = this.messageText.trim();
        const forcePlainText = !!this.detectedCodeLanguage && this.codeDetectionDismissed;
        if (this.selectedFiles.length > 0) {
            this.messageWithFiles.emit({ text, files: [...this.selectedFiles], forcePlainText });
        }
        else {
            this.messageSent.emit({ text, forcePlainText });
        }
        this.resetComposer(true);
    }
    resetComposer(clearDraft) {
        this.messageText = '';
        this.selectedFiles = [];
        this.mentionSuggestions = [];
        this.detectedCodeLanguage = null;
        this.codeDetectionDismissed = false;
        this.manualTextareaHeight = this.minTextareaHeight;
        if (clearDraft)
            this.clearDraft(this.conversationId);
        if (this.fileInput)
            this.fileInput.nativeElement.value = '';
        this.queueAutoResize();
    }
    onTextChange(value) {
        this.messageText = value;
        this.persistDraft(this.conversationId, value);
        this.updateMentionSuggestions();
        this.updateCodeDetection(value);
        this.queueAutoResize();
    }
    onPaste(event) {
        const clipboardItems = Array.from(event.clipboardData?.items || []);
        const imageFiles = clipboardItems
            .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
            .map((item) => item.getAsFile())
            .filter((file) => !!file)
            .map((file) => this.nameClipboardImage(file));
        if (imageFiles.length > 0) {
            this.addFiles(imageFiles);
            const text = event.clipboardData?.getData('text/plain') || '';
            if (!text.trim()) {
                event.preventDefault();
            }
        }
        const html = event.clipboardData?.getData('text/html') || '';
        if (!html || !/<table[\s>]/i.test(html))
            return;
        const tableText = this.htmlTableToText(html);
        if (!tableText)
            return;
        event.preventDefault();
        this.insertTextAtCursor(tableText);
    }
    autoResize() {
        const el = this.messageTextarea?.nativeElement;
        if (!el)
            return;
        el.style.height = 'auto';
        const nextHeight = Math.min(Math.max(el.scrollHeight, this.manualTextareaHeight, this.minTextareaHeight), this.maxTextareaHeight);
        this.textareaHeight = nextHeight;
        el.style.height = `${nextHeight}px`;
        el.style.overflowY = nextHeight >= this.maxTextareaHeight ? 'auto' : 'hidden';
    }
    onResizeStart(event) {
        event.preventDefault();
        this.resizing = true;
        this.resizeStartY = event.clientY;
        this.resizeStartHeight = this.textareaHeight;
        document.body.style.cursor = 'ns-resize';
        document.body.style.userSelect = 'none';
        document.addEventListener('mousemove', this.boundResizeMove);
        document.addEventListener('mouseup', this.boundResizeEnd);
    }
    onResizeMove(event) {
        if (!this.resizing)
            return;
        const dy = this.resizeStartY - event.clientY;
        const nextHeight = Math.max(this.minTextareaHeight, Math.min(this.maxTextareaHeight, this.resizeStartHeight + dy));
        this.manualTextareaHeight = nextHeight;
        this.textareaHeight = nextHeight;
    }
    onResizeEnd() {
        if (!this.resizing)
            return;
        this.resizing = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', this.boundResizeMove);
        document.removeEventListener('mouseup', this.boundResizeEnd);
    }
    queueAutoResize() {
        setTimeout(() => this.autoResize());
    }
    draftKey(conversationId) {
        return `${this.draftPrefix}${conversationId}`;
    }
    loadDraft(conversationId) {
        if (!conversationId)
            return '';
        return localStorage.getItem(this.draftKey(conversationId)) || '';
    }
    persistDraft(conversationId, value) {
        if (!conversationId)
            return;
        const key = this.draftKey(conversationId);
        if (value.trim()) {
            localStorage.setItem(key, value);
        }
        else {
            localStorage.removeItem(key);
        }
    }
    clearDraft(conversationId) {
        if (!conversationId)
            return;
        localStorage.removeItem(this.draftKey(conversationId));
    }
    htmlTableToText(html) {
        try {
            const doc = new DOMParser().parseFromString(html, 'text/html');
            const table = doc.querySelector('table');
            if (!table)
                return '';
            const rows = Array.from(table.querySelectorAll('tr'));
            return rows
                .map((row) => Array.from(row.querySelectorAll('th,td'))
                .map((cell) => (cell.textContent || '').replace(/\s+/g, ' ').trim())
                .join('\t'))
                .filter(Boolean)
                .join('\n');
        }
        catch {
            return '';
        }
    }
    insertTextAtCursor(text) {
        const textarea = this.messageTextarea?.nativeElement;
        if (!textarea) {
            this.onTextChange(`${this.messageText}${text}`);
            return;
        }
        const start = textarea.selectionStart ?? this.messageText.length;
        const end = textarea.selectionEnd ?? this.messageText.length;
        const next = `${this.messageText.slice(0, start)}${text}${this.messageText.slice(end)}`;
        this.onTextChange(next);
        setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = start + text.length;
        });
    }
    nameClipboardImage(file) {
        const extension = file.type.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
        const filename = `clipboard-image-${new Date().toISOString().replace(/[:.]/g, '-')}.${extension}`;
        return new File([file], filename, { type: file.type || 'image/png', lastModified: Date.now() });
    }
    focus() {
        setTimeout(() => this.messageTextarea?.nativeElement?.focus());
    }
    updateMentionSuggestions() {
        if (!this.enableMentions || !this.mentionOptions.length) {
            this.mentionSuggestions = [];
            return;
        }
        const textarea = this.messageTextarea?.nativeElement;
        const caret = textarea?.selectionStart ?? this.messageText.length;
        const beforeCaret = this.messageText.slice(0, caret);
        const match = beforeCaret.match(/(^|\s)@([a-zA-Z0-9._-]{0,32})$/);
        if (!match) {
            this.mentionSuggestions = [];
            this.activeMentionStart = -1;
            this.activeMentionEnd = -1;
            return;
        }
        const query = (match[2] || '').toLowerCase();
        this.activeMentionEnd = caret;
        this.activeMentionStart = caret - query.length - 1;
        this.mentionSuggestions = this.mentionOptions
            .filter((option) => option.token.toLowerCase().includes(query) ||
            option.label.toLowerCase().includes(query))
            .slice(0, 5);
    }
    insertMention(option) {
        if (this.activeMentionStart < 0)
            return;
        const start = this.activeMentionStart;
        const end = this.activeMentionEnd >= start ? this.activeMentionEnd : this.messageText.length;
        const mentionText = `@${option.token} `;
        const next = `${this.messageText.slice(0, start)}${mentionText}${this.messageText.slice(end)}`;
        this.onTextChange(next);
        this.mentionSuggestions = [];
        setTimeout(() => {
            const textarea = this.messageTextarea?.nativeElement;
            if (!textarea)
                return;
            const caret = start + mentionText.length;
            textarea.focus();
            textarea.selectionStart = textarea.selectionEnd = caret;
            this.queueAutoResize();
        });
    }
    dismissCodeDetection() {
        this.codeDetectionDismissed = true;
    }
    updateCodeDetection(value) {
        const language = this.detectCodeLanguage(value);
        if (!language) {
            this.detectedCodeLanguage = null;
            this.codeDetectionDismissed = false;
            return;
        }
        if (language !== this.detectedCodeLanguage) {
            this.codeDetectionDismissed = false;
        }
        this.detectedCodeLanguage = language;
    }
    detectCodeLanguage(value) {
        const trimmed = value.trim();
        if (!trimmed || this.looksLikeMarkdown(trimmed) || this.isTableContent(trimmed))
            return null;
        const fenced = trimmed.match(/^```([a-zA-Z0-9_+-]*)\s*\n?[\s\S]*?```$/);
        if (fenced)
            return (fenced[1] || 'code').toLowerCase();
        if (!trimmed.includes('\n') && trimmed.length < 40)
            return null;
        if (/^\s*(select|with|insert|update|delete|create|alter|drop)\b/i.test(trimmed))
            return 'sql';
        const jsDeclaration = /\b(function|const|let|var)\s+[A-Za-z_$][\w$]*\s*(=|=>|\(|:)/.test(trimmed);
        const jsSyntax = /(=>|console\.log|import\s+.*from|export\s+|[{};])/.test(trimmed);
        if (jsDeclaration || jsSyntax)
            return 'javascript';
        if (/\b(def|import|from|print|class)\b/.test(trimmed) && /:\s*$|^\s{4}/m.test(trimmed))
            return 'python';
        if (/<\/?[a-z][\s\S]*>/i.test(trimmed))
            return 'html';
        if (/[{};]/.test(trimmed) && /[:=]/.test(trimmed))
            return 'code';
        return null;
    }
    looksLikeMarkdown(content) {
        return /(^#{1,6}\s)|(^[-*]\s)|(^\d+\.\s)|(^>\s)|(\*\*[^*]+\*\*)|(`[^`]+`)|(\[[^\]]+\]\([^)]+\))|(^---$)|(^-\s\[[ x]\]\s)|(^```[a-zA-Z0-9_+-]*\s*$)/m.test(content);
    }
    isTableContent(content) {
        if (!content.includes('\t'))
            return false;
        const rows = content
            .split(/\r?\n/)
            .map((row) => row.split('\t').map((cell) => cell.trim()))
            .filter((row) => row.some(Boolean));
        return rows.length >= 2 && rows.some((row) => row.length >= 2);
    }
    onKeydown(event) {
        if (event.key === 'Escape' && this.mentionSuggestions.length > 0) {
            this.mentionSuggestions = [];
            event.preventDefault();
            return;
        }
        if (event.key === 'Enter' && this.mentionSuggestions.length > 0) {
            event.preventDefault();
            this.insertMention(this.mentionSuggestions[0]);
            return;
        }
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            this.send();
        }
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
            this.addFiles(Array.from(input.files));
        }
    }
    addFiles(files) {
        if (!files.length)
            return;
        this.selectedFiles = [...this.selectedFiles, ...files];
    }
    removeFile(index) {
        this.selectedFiles.splice(index, 1);
        this.selectedFiles = [...this.selectedFiles];
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
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "17.3.12", type: MessageInputComponent, isStandalone: true, selector: "app-message-input", inputs: { conversationId: "conversationId", replyTo: "replyTo", enableMentions: "enableMentions", mentionOptions: "mentionOptions" }, outputs: { messageSent: "messageSent", messageWithFiles: "messageWithFiles", replyCancelled: "replyCancelled" }, viewQueries: [{ propertyName: "fileInput", first: true, predicate: ["fileInput"], descendants: true }, { propertyName: "messageTextarea", first: true, predicate: ["messageTextarea"], descendants: true }], usesOnChanges: true, ngImport: i0, template: `
    <div
      class="message-input-container"
    >
      <div
        class="input-resize-handle"
        title="Drag up to expand message box"
        (mousedown)="onResizeStart($event)"
      >
        <span></span>
      </div>

      <div *ngIf="replyTo" class="reply-compose-preview">
        <mat-icon>reply</mat-icon>
        <div class="compose-preview-text">
          <span>Replying to {{ replyTo.senderName }}</span>
          <p>{{ replyTo.content }}</p>
        </div>
        <button type="button" class="compose-cancel-btn" (click)="replyCancelled.emit()" title="Cancel reply">
          <mat-icon>close</mat-icon>
        </button>
      </div>

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

      <div *ngIf="mentionSuggestions.length > 0" class="mention-suggestions">
        <button
          type="button"
          *ngFor="let option of mentionSuggestions"
          class="mention-suggestion"
          (mousedown)="$event.preventDefault()"
          (click)="insertMention(option)"
        >
          <span class="mention-avatar">&#64;</span>
          <span>{{ option.label }}</span>
          <small>&#64;{{ option.token }}</small>
        </button>
      </div>

      <div *ngIf="detectedCodeLanguage && !codeDetectionDismissed" class="code-detection-chip">
        <mat-icon>code</mat-icon>
        <span>Looks like {{ detectedCodeLanguage }} code</span>
        <button
          type="button"
          class="code-detection-close"
          (click)="dismissCodeDetection()"
          title="Send as normal text"
        >
          <mat-icon>close</mat-icon>
        </button>
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
          #messageTextarea
          [ngModel]="messageText"
          (ngModelChange)="onTextChange($event)"
          (input)="autoResize()"
          (paste)="onPaste($event)"
          (click)="updateMentionSuggestions()"
          (keyup)="updateMentionSuggestions()"
          (keydown)="onKeydown($event)"
          placeholder="Type a message..."
          rows="1"
          class="message-textarea"
          [style.height.px]="textareaHeight"
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

    </div>
  `, isInline: true, styles: [".message-input-container{padding:8px 12px;border-top:1px solid rgba(255,255,255,.15);background:transparent;position:relative}.input-resize-handle{position:absolute;top:-5px;left:0;right:0;height:10px;display:flex;align-items:center;justify-content:center;cursor:ns-resize;z-index:2}.input-resize-handle span{width:42px;height:3px;border-radius:999px;background:#ffffff38;transition:background .15s,width .15s}.input-resize-handle:hover span{width:56px;background:#ffffff6b}.file-previews{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;max-height:80px;overflow-y:auto}.reply-compose-preview{display:flex;align-items:center;gap:8px;margin-bottom:8px;padding:8px 10px;border-radius:12px;background:#7fb4ff1f;border-left:3px solid rgba(127,180,255,.8);color:#fff}.reply-compose-preview>mat-icon{color:#bfdbfe;font-size:18px;width:18px;height:18px;flex-shrink:0}.compose-preview-text{min-width:0;flex:1}.compose-preview-text span{display:block;font-size:11px;font-weight:700;color:#bfdbfe;margin-bottom:2px}.compose-preview-text p{margin:0;font-size:12px;color:#ffffffc7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.compose-cancel-btn{width:24px;height:24px;border:none;border-radius:999px;background:#ffffff14;color:#fffc;display:inline-flex;align-items:center;justify-content:center;padding:0;cursor:pointer;flex-shrink:0}.compose-cancel-btn mat-icon{font-size:16px;width:16px;height:16px}.mention-suggestions{margin-bottom:8px;border-radius:12px;overflow:hidden;background:#071d30;border:1px solid rgba(127,180,255,.22);box-shadow:0 10px 24px #0000003d}.mention-suggestion{width:100%;border:none;background:transparent;color:#fff;display:flex;align-items:center;gap:8px;padding:8px 10px;cursor:pointer;text-align:left}.mention-suggestion:hover,.mention-suggestion:focus{background:#7fb4ff24;outline:none}.mention-avatar{width:22px;height:22px;border-radius:999px;background:#7fb4ff38;color:#bfdbfe;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex-shrink:0}.mention-suggestion small{margin-left:auto;color:#ffffff85;font-size:11px}.code-detection-chip{display:inline-flex;align-items:center;gap:7px;margin-bottom:8px;padding:6px 8px;border-radius:999px;background:#7fb4ff24;border:1px solid rgba(127,180,255,.32);color:#bfdbfe;font-size:12px;font-weight:700}.code-detection-chip>mat-icon{font-size:15px;width:15px;height:15px}.code-detection-close{width:20px;height:20px;border:none;border-radius:999px;background:#ffffff14;color:#ffffffd1;display:inline-flex;align-items:center;justify-content:center;padding:0;cursor:pointer}.code-detection-close mat-icon{font-size:14px;width:14px;height:14px}.file-chip{display:flex;align-items:center;gap:4px;background:#ffffff26;border-radius:8px;padding:4px 4px 4px 8px;max-width:200px}.file-icon{font-size:16px;width:16px;height:16px;color:#fffc}.file-name{font-size:12px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100px}.file-size{font-size:10px;color:#ffffff80;flex-shrink:0}.file-remove{width:20px!important;height:20px!important}.file-remove mat-icon{font-size:14px;width:14px;height:14px;color:#fff9}.input-wrapper{display:flex;align-items:flex-end;gap:4px;background:#ffffff1a;border-radius:24px;padding:2px 4px}.attach-btn,.send-btn{flex-shrink:0;width:36px;height:36px;padding:0!important;margin:0;min-width:36px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;line-height:0!important}.attach-btn mat-icon,.send-btn mat-icon{color:#ffffffb3;font-size:20px;width:20px;height:20px;line-height:20px;margin:0;display:flex;align-items:center;justify-content:center}.send-btn mat-icon{color:#ffffffe6}.message-textarea{flex:1;border:none;outline:none;background:transparent;resize:none;font-size:14px;font-family:inherit;line-height:1.5;min-height:24px;max-height:180px;padding:7px 0;color:#fff;overflow-y:hidden;box-sizing:border-box}.message-textarea::placeholder{color:#ffffff80}.send-btn:disabled mat-icon{color:#ffffff4d}:host ::ng-deep .attach-btn .mat-mdc-button-touch-target,:host ::ng-deep .send-btn .mat-mdc-button-touch-target{height:36px!important;width:36px!important}:host ::ng-deep .attach-btn .mdc-icon-button__icon,:host ::ng-deep .send-btn .mdc-icon-button__icon{display:flex!important;align-items:center!important;justify-content:center!important;margin:0!important;padding:0!important}\n"], dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i1$1.NgForOf, selector: "[ngFor][ngForOf]", inputs: ["ngForOf", "ngForTrackBy", "ngForTemplate"] }, { kind: "directive", type: i1$1.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "ngmodule", type: FormsModule }, { kind: "directive", type: i3.DefaultValueAccessor, selector: "input:not([type=checkbox])[formControlName],textarea[formControlName],input:not([type=checkbox])[formControl],textarea[formControl],input:not([type=checkbox])[ngModel],textarea[ngModel],[ngDefaultControl]" }, { kind: "directive", type: i3.NgControlStatus, selector: "[formControlName],[ngModel],[formControl]" }, { kind: "directive", type: i3.NgModel, selector: "[ngModel]:not([formControlName]):not([formControl])", inputs: ["name", "disabled", "ngModel", "ngModelOptions"], outputs: ["ngModelChange"], exportAs: ["ngModel"] }, { kind: "ngmodule", type: MatIconModule }, { kind: "component", type: i4.MatIcon, selector: "mat-icon", inputs: ["color", "inline", "svgIcon", "fontSet", "fontIcon"], exportAs: ["matIcon"] }, { kind: "ngmodule", type: MatButtonModule }, { kind: "component", type: i6.MatIconButton, selector: "button[mat-icon-button]", exportAs: ["matButton"] }] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: MessageInputComponent, decorators: [{
            type: Component,
            args: [{ selector: 'app-message-input', standalone: true, imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule], template: `
    <div
      class="message-input-container"
    >
      <div
        class="input-resize-handle"
        title="Drag up to expand message box"
        (mousedown)="onResizeStart($event)"
      >
        <span></span>
      </div>

      <div *ngIf="replyTo" class="reply-compose-preview">
        <mat-icon>reply</mat-icon>
        <div class="compose-preview-text">
          <span>Replying to {{ replyTo.senderName }}</span>
          <p>{{ replyTo.content }}</p>
        </div>
        <button type="button" class="compose-cancel-btn" (click)="replyCancelled.emit()" title="Cancel reply">
          <mat-icon>close</mat-icon>
        </button>
      </div>

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

      <div *ngIf="mentionSuggestions.length > 0" class="mention-suggestions">
        <button
          type="button"
          *ngFor="let option of mentionSuggestions"
          class="mention-suggestion"
          (mousedown)="$event.preventDefault()"
          (click)="insertMention(option)"
        >
          <span class="mention-avatar">&#64;</span>
          <span>{{ option.label }}</span>
          <small>&#64;{{ option.token }}</small>
        </button>
      </div>

      <div *ngIf="detectedCodeLanguage && !codeDetectionDismissed" class="code-detection-chip">
        <mat-icon>code</mat-icon>
        <span>Looks like {{ detectedCodeLanguage }} code</span>
        <button
          type="button"
          class="code-detection-close"
          (click)="dismissCodeDetection()"
          title="Send as normal text"
        >
          <mat-icon>close</mat-icon>
        </button>
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
          #messageTextarea
          [ngModel]="messageText"
          (ngModelChange)="onTextChange($event)"
          (input)="autoResize()"
          (paste)="onPaste($event)"
          (click)="updateMentionSuggestions()"
          (keyup)="updateMentionSuggestions()"
          (keydown)="onKeydown($event)"
          placeholder="Type a message..."
          rows="1"
          class="message-textarea"
          [style.height.px]="textareaHeight"
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

    </div>
  `, styles: [".message-input-container{padding:8px 12px;border-top:1px solid rgba(255,255,255,.15);background:transparent;position:relative}.input-resize-handle{position:absolute;top:-5px;left:0;right:0;height:10px;display:flex;align-items:center;justify-content:center;cursor:ns-resize;z-index:2}.input-resize-handle span{width:42px;height:3px;border-radius:999px;background:#ffffff38;transition:background .15s,width .15s}.input-resize-handle:hover span{width:56px;background:#ffffff6b}.file-previews{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;max-height:80px;overflow-y:auto}.reply-compose-preview{display:flex;align-items:center;gap:8px;margin-bottom:8px;padding:8px 10px;border-radius:12px;background:#7fb4ff1f;border-left:3px solid rgba(127,180,255,.8);color:#fff}.reply-compose-preview>mat-icon{color:#bfdbfe;font-size:18px;width:18px;height:18px;flex-shrink:0}.compose-preview-text{min-width:0;flex:1}.compose-preview-text span{display:block;font-size:11px;font-weight:700;color:#bfdbfe;margin-bottom:2px}.compose-preview-text p{margin:0;font-size:12px;color:#ffffffc7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.compose-cancel-btn{width:24px;height:24px;border:none;border-radius:999px;background:#ffffff14;color:#fffc;display:inline-flex;align-items:center;justify-content:center;padding:0;cursor:pointer;flex-shrink:0}.compose-cancel-btn mat-icon{font-size:16px;width:16px;height:16px}.mention-suggestions{margin-bottom:8px;border-radius:12px;overflow:hidden;background:#071d30;border:1px solid rgba(127,180,255,.22);box-shadow:0 10px 24px #0000003d}.mention-suggestion{width:100%;border:none;background:transparent;color:#fff;display:flex;align-items:center;gap:8px;padding:8px 10px;cursor:pointer;text-align:left}.mention-suggestion:hover,.mention-suggestion:focus{background:#7fb4ff24;outline:none}.mention-avatar{width:22px;height:22px;border-radius:999px;background:#7fb4ff38;color:#bfdbfe;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex-shrink:0}.mention-suggestion small{margin-left:auto;color:#ffffff85;font-size:11px}.code-detection-chip{display:inline-flex;align-items:center;gap:7px;margin-bottom:8px;padding:6px 8px;border-radius:999px;background:#7fb4ff24;border:1px solid rgba(127,180,255,.32);color:#bfdbfe;font-size:12px;font-weight:700}.code-detection-chip>mat-icon{font-size:15px;width:15px;height:15px}.code-detection-close{width:20px;height:20px;border:none;border-radius:999px;background:#ffffff14;color:#ffffffd1;display:inline-flex;align-items:center;justify-content:center;padding:0;cursor:pointer}.code-detection-close mat-icon{font-size:14px;width:14px;height:14px}.file-chip{display:flex;align-items:center;gap:4px;background:#ffffff26;border-radius:8px;padding:4px 4px 4px 8px;max-width:200px}.file-icon{font-size:16px;width:16px;height:16px;color:#fffc}.file-name{font-size:12px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100px}.file-size{font-size:10px;color:#ffffff80;flex-shrink:0}.file-remove{width:20px!important;height:20px!important}.file-remove mat-icon{font-size:14px;width:14px;height:14px;color:#fff9}.input-wrapper{display:flex;align-items:flex-end;gap:4px;background:#ffffff1a;border-radius:24px;padding:2px 4px}.attach-btn,.send-btn{flex-shrink:0;width:36px;height:36px;padding:0!important;margin:0;min-width:36px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;line-height:0!important}.attach-btn mat-icon,.send-btn mat-icon{color:#ffffffb3;font-size:20px;width:20px;height:20px;line-height:20px;margin:0;display:flex;align-items:center;justify-content:center}.send-btn mat-icon{color:#ffffffe6}.message-textarea{flex:1;border:none;outline:none;background:transparent;resize:none;font-size:14px;font-family:inherit;line-height:1.5;min-height:24px;max-height:180px;padding:7px 0;color:#fff;overflow-y:hidden;box-sizing:border-box}.message-textarea::placeholder{color:#ffffff80}.send-btn:disabled mat-icon{color:#ffffff4d}:host ::ng-deep .attach-btn .mat-mdc-button-touch-target,:host ::ng-deep .send-btn .mat-mdc-button-touch-target{height:36px!important;width:36px!important}:host ::ng-deep .attach-btn .mdc-icon-button__icon,:host ::ng-deep .send-btn .mdc-icon-button__icon{display:flex!important;align-items:center!important;justify-content:center!important;margin:0!important;padding:0!important}\n"] }]
        }], propDecorators: { conversationId: [{
                type: Input
            }], replyTo: [{
                type: Input
            }], enableMentions: [{
                type: Input
            }], mentionOptions: [{
                type: Input
            }], messageSent: [{
                type: Output
            }], messageWithFiles: [{
                type: Output
            }], replyCancelled: [{
                type: Output
            }], fileInput: [{
                type: ViewChild,
                args: ['fileInput']
            }], messageTextarea: [{
                type: ViewChild,
                args: ['messageTextarea']
            }] } });

class ChatThreadComponent {
    store;
    api;
    auth;
    fileService;
    cdr;
    sanitizer;
    scrollContainer;
    threadRoot;
    inlineEditTextareas;
    messageInput;
    lightboxOpen = new EventEmitter();
    messages = [];
    visibleContacts = [];
    conversationName = '';
    isGroup = false;
    isRemovedFromGroup = false;
    messageTextScale = 1;
    codeTextScale = 1;
    loading = false;
    myContactId = null;
    replyToMessage = null;
    editingMessage = null;
    editingDraft = '';
    mentionOptions = [];
    conversationId = null;
    sub;
    shouldScrollToBottom = true;
    uploading = false;
    hoveredMessageId = null;
    messageContextMenu = null;
    quickEmojis = ['❤️', '👍', '😂', '😮', '😢', '🔥'];
    threadDragOver = false;
    threadDragDepth = 0;
    boundResetThreadDrag = this.resetThreadDrag.bind(this);
    /** Tracks which file IDs are currently being fetched to avoid duplicate requests */
    mediaLoading = new Set();
    /** Tracks file IDs where retrieval failed so UI doesn't spin forever. */
    mediaFailed = new Set();
    mediaQueue = [];
    activeMediaRequests = 0;
    maxMediaRequests = 2;
    lastMentionConversationId = null;
    lastGroupMembershipVersion = -1;
    constructor(store, api, auth, fileService, cdr, sanitizer) {
        this.store = store;
        this.api = api;
        this.auth = auth;
        this.fileService = fileService;
        this.cdr = cdr;
        this.sanitizer = sanitizer;
    }
    ngOnInit() {
        this.myContactId = this.auth.contactId;
        document.addEventListener('drop', this.boundResetThreadDrag, true);
        document.addEventListener('dragend', this.boundResetThreadDrag, true);
        this.sub = combineLatest([
            this.store.activeConversationId,
            this.store.messagesMap,
            this.store.openChats,
            this.store.visibleContacts,
            this.store.loadingMessages,
            this.store.removedGroupIds,
            this.store.messageTextScale,
            this.store.codeTextScale,
            this.store.groupMembershipVersion,
        ]).subscribe(([convId, msgMap, chats, contacts, loading, removedGroupIds, messageTextScale, codeTextScale, groupMembershipVersion]) => {
            this.loading = loading;
            this.visibleContacts = contacts || [];
            this.messageTextScale = messageTextScale;
            this.codeTextScale = codeTextScale;
            if (this.isGroup && this.conversationId && this.mentionOptions.length === 0) {
                this.refreshMentionOptions();
            }
            if (this.isGroup &&
                this.conversationId &&
                groupMembershipVersion !== this.lastGroupMembershipVersion) {
                this.lastGroupMembershipVersion = groupMembershipVersion;
                this.refreshMentionOptions(true);
            }
            if (convId && convId !== this.conversationId) {
                this.conversationId = convId;
                this.resetMediaQueue();
                this.clearReply();
                this.clearEdit();
                this.shouldScrollToBottom = true;
                const chat = chats.find((c) => c.conversationId === convId);
                this.conversationName = chat?.name || 'Chat';
                this.isGroup = chat?.isGroup || false;
                this.refreshMentionOptions(true);
            }
            if (this.conversationId) {
                const prevLen = this.messages.length;
                this.messages = msgMap.get(this.conversationId) || [];
                if (this.messages.length > prevLen) {
                    this.shouldScrollToBottom = true;
                }
                // Pre-warm media cache for any image/file messages visible
                this.prewarmMedia(this.messages);
            }
            this.isRemovedFromGroup = !!this.conversationId && removedGroupIds.has(String(this.conversationId));
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
        document.removeEventListener('drop', this.boundResetThreadDrag, true);
        document.removeEventListener('dragend', this.boundResetThreadDrag, true);
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
    onGroupSettings() {
        if (this.isRemovedFromGroup)
            return;
        if (this.conversationId) {
            this.store.openGroupSettings(this.conversationId, this.conversationName);
        }
    }
    startReply(message, event) {
        event?.stopPropagation();
        if (this.isDeletedMessage(message) || this.isSystemMessage(message))
            return;
        this.clearEdit();
        this.replyToMessage = message;
        this.messageInput?.focus();
    }
    openMessageContextMenu(message, event) {
        event.preventDefault();
        event.stopPropagation();
        if (this.isDeletedMessage(message) || this.isSystemMessage(message))
            return;
        const hasActions = this.canReplyMessage(message) ||
            this.canEditMessage(message) ||
            this.canDeleteMessage(message);
        if (!hasActions)
            return;
        this.messageContextMenu = {
            message,
            ...this.getContextMenuPosition(event),
            confirmDelete: false,
        };
    }
    getContextMenuPosition(event) {
        const rect = this.threadRoot?.nativeElement?.getBoundingClientRect();
        if (!rect) {
            return {
                x: Math.min(event.clientX, window.innerWidth - 220),
                y: Math.min(event.clientY, window.innerHeight - 160),
            };
        }
        const menuWidth = 210;
        const menuHeight = 170;
        const padding = 8;
        const rawX = event.clientX - rect.left;
        const rawY = event.clientY - rect.top;
        return {
            x: Math.max(padding, Math.min(rawX, rect.width - menuWidth - padding)),
            y: Math.max(padding, Math.min(rawY, rect.height - menuHeight - padding)),
        };
    }
    closeMessageContextMenu() {
        this.messageContextMenu = null;
    }
    replyFromContextMenu() {
        const message = this.messageContextMenu?.message;
        if (!message || !this.canReplyMessage(message))
            return;
        this.startReply(message);
        this.closeMessageContextMenu();
    }
    editFromContextMenu() {
        const message = this.messageContextMenu?.message;
        if (!message || !this.canEditMessage(message))
            return;
        this.closeMessageContextMenu();
        this.startEditMessage(message);
    }
    requestDeleteFromContextMenu() {
        if (!this.messageContextMenu || !this.canDeleteMessage(this.messageContextMenu.message))
            return;
        this.messageContextMenu = { ...this.messageContextMenu, confirmDelete: true };
    }
    confirmDeleteFromContextMenu() {
        const message = this.messageContextMenu?.message;
        if (!message || !this.canDeleteMessage(message))
            return;
        this.closeMessageContextMenu();
        this.store.deleteMessage(message.message_id);
    }
    clearReply() {
        this.replyToMessage = null;
    }
    clearEdit() {
        this.editingMessage = null;
        this.editingDraft = '';
    }
    getReplyPreview(message) {
        const reply = message.reply_to;
        if (!reply)
            return null;
        return {
            senderName: reply.sender_name || 'Message',
            content: this.truncateReplyText(reply.content || 'Attachment'),
        };
    }
    getComposeReplyPreview(message) {
        return {
            senderName: this.getSenderName(message),
            content: this.truncateReplyText(this.getMessageBody(message) || this.getAttachmentName(message)),
        };
    }
    getMessageBody(message) {
        if (this.isDeletedMessage(message))
            return '[This message was deleted]';
        return String(message.content || '');
    }
    isDeletedMessage(message) {
        return Boolean(message.is_deleted || message.deleted_at || message.content === '[deleted]');
    }
    truncateReplyText(value) {
        const text = String(value || '').replace(/\s+/g, ' ').trim();
        return text.length > 120 ? `${text.slice(0, 117)}...` : text || 'Attachment';
    }
    refreshMentionOptions(force = false) {
        if (!this.isGroup || !this.conversationId) {
            this.mentionOptions = [];
            this.lastMentionConversationId = null;
            return;
        }
        const convId = this.conversationId;
        if (!force && this.lastMentionConversationId === convId && this.mentionOptions.length > 0)
            return;
        this.lastMentionConversationId = convId;
        this.api.getConversationParticipants(convId).subscribe({
            next: (members) => {
                const options = members
                    .filter((member) => String(member.contact_id) !== String(this.auth.contactId || ''))
                    .map((member) => this.participantToMentionOption(member))
                    .filter((option) => !!option);
                this.mentionOptions = options.length ? options : this.contactsToMentionOptions();
                this.cdr.markForCheck();
            },
            error: () => {
                this.mentionOptions = this.contactsToMentionOptions();
                this.cdr.markForCheck();
            },
        });
    }
    participantToMentionOption(member) {
        const token = this.toMentionToken(member.username || member.email || String(member.contact_id));
        if (!token)
            return null;
        return {
            contactId: String(member.contact_id),
            label: member.username || member.email || `Contact ${member.contact_id}`,
            token,
        };
    }
    contactsToMentionOptions() {
        return this.visibleContacts
            .filter((contact) => String(contact.contact_id) !== String(this.auth.contactId || ''))
            .map((contact) => {
            const label = getContactDisplayName(contact);
            return {
                contactId: String(contact.contact_id),
                label,
                token: this.toMentionToken(contact.username || contact.email?.split('@')[0] || label),
            };
        })
            .filter((option) => !!option.token);
    }
    toMentionToken(value) {
        return String(value || '')
            .trim()
            .replace(/^@/, '')
            .replace(/@.*$/, '')
            .replace(/[^a-zA-Z0-9._-]/g, '')
            .slice(0, 32);
    }
    getMentionIdsFromContent(content) {
        if (!this.isGroup || !content || !this.mentionOptions.length)
            return [];
        const mentionedTokens = new Set(Array.from(content.matchAll(/(^|[^a-zA-Z0-9._-])@([a-zA-Z0-9._-]+)/g))
            .map((match) => match[2].toLowerCase()));
        return this.mentionOptions
            .filter((option) => mentionedTokens.has(option.token.toLowerCase()))
            .map((option) => option.contactId);
    }
    onSendMessage(payload) {
        if (this.isRemovedFromGroup)
            return;
        const content = payload.text;
        const mentions = this.getMentionIdsFromContent(content);
        this.store.sendMessage(this.conversationId, content, 'TEXT', {
            replyTo: this.replyToMessage,
            mentions,
            forcePlainText: payload.forcePlainText,
        });
        this.clearReply();
        this.shouldScrollToBottom = true;
    }
    onSendWithFiles(payload) {
        if (this.isRemovedFromGroup)
            return;
        if (!this.conversationId || !this.auth.contactId)
            return;
        this.uploading = true;
        // Step 1: Upload all files and obtain real file_ids from the server.
        // Temp IDs are NEVER sent to any API — we wait for real IDs here.
        this.fileService.uploadFiles(payload.files).subscribe({
            next: (responses) => {
                const fileIds = responses.map((r) => r.file_id);
                const filenames = responses.map((r) => r.filename);
                const mimeTypes = responses.map((r, idx) => r.mime_type || payload.files[idx]?.type || '');
                // Guard: ensure all IDs are real (not temp)
                const hasTemp = fileIds.some(id => id?.startsWith('temp-'));
                if (hasTemp) {
                    this.uploading = false;
                    return;
                }
                // Step 2: Pre-warm image cache so the optimistic bubble renders immediately.
                this.fileService.prewarmCache(fileIds);
                // Step 3: Send the message with the real file_ids.
                const messageText = payload.text || filenames.join(', ');
                const outgoingText = this.store.prepareOutgoingMessageContent(messageText, this.replyToMessage, payload.forcePlainText);
                const replyTo = this.replyToMessage ? {
                    message_id: String(this.replyToMessage.message_id || ''),
                    sender_name: this.getSenderName(this.replyToMessage),
                    content: this.truncateReplyText(this.getMessageBody(this.replyToMessage) || this.getAttachmentName(this.replyToMessage)),
                } : undefined;
                const mentions = this.getMentionIdsFromContent(messageText);
                this.fileService
                    .sendMessageWithAttachments(this.conversationId, this.auth.contactId, outgoingText, fileIds, filenames, mimeTypes)
                    .subscribe({
                    next: (res) => {
                        this.uploading = false;
                        this.shouldScrollToBottom = true;
                        // Add optimistic message so the image appears instantly —
                        // the WebSocket event may arrive a moment later and dedup it.
                        const firstId = fileIds[0] || '';
                        const isImg = (mimeTypes[0] || '').startsWith('image/') ||
                            /\.(png|jpe?g|gif|webp|bmp|svg|heic|heif)$/i.test(filenames[0] || '');
                        const optimistic = {
                            message_id: res?.message_id ? String(res.message_id) : 'temp-' + Date.now(),
                            conversation_id: this.conversationId,
                            sender_id: this.auth.contactId,
                            sender_name: 'You',
                            message_type: isImg ? 'IMAGE' : 'FILE',
                            content: messageText,
                            reply_to: replyTo,
                            mentions,
                            render_as_plain_text: payload.forcePlainText,
                            media_url: firstId,
                            created_at: new Date().toISOString(),
                            is_read: false,
                            attachments: fileIds.map((id, idx) => ({
                                file_id: id,
                                filename: filenames[idx] || filenames[0] || `Attachment ${idx + 1}`,
                                mime_type: mimeTypes[idx] || undefined,
                                size_bytes: payload.files[idx]?.size,
                                url: responses[idx]?.url,
                            })),
                        };
                        this.store.appendOptimisticMessage(optimistic);
                        this.clearReply();
                        this.cdr.markForCheck();
                    },
                    error: () => {
                        this.uploading = false;
                    },
                });
            },
            error: () => {
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
    onThreadDragEnter(event) {
        if (this.isRemovedFromGroup)
            return;
        if (!this.dragHasFiles(event))
            return;
        event.preventDefault();
        event.stopPropagation();
        this.threadDragDepth++;
        this.threadDragOver = true;
    }
    onThreadDragOver(event) {
        if (this.isRemovedFromGroup)
            return;
        if (!this.dragHasFiles(event))
            return;
        event.preventDefault();
        event.stopPropagation();
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = 'copy';
        }
        this.threadDragOver = true;
    }
    onThreadDragLeave(event) {
        if (!this.dragHasFiles(event))
            return;
        event.preventDefault();
        event.stopPropagation();
        this.threadDragDepth = Math.max(0, this.threadDragDepth - 1);
        this.threadDragOver = this.threadDragDepth > 0;
    }
    onThreadDrop(event) {
        if (this.isRemovedFromGroup)
            return;
        if (!this.dragHasFiles(event))
            return;
        event.preventDefault();
        event.stopPropagation();
        this.resetThreadDrag();
        const files = event.dataTransfer?.files ? Array.from(event.dataTransfer.files) : [];
        this.messageInput?.addFiles(files);
    }
    resetThreadDrag() {
        this.threadDragDepth = 0;
        this.threadDragOver = false;
    }
    exitRemovedGroup() {
        if (this.conversationId) {
            this.store.exitRemovedGroup(this.conversationId);
        }
    }
    dragHasFiles(event) {
        const types = event.dataTransfer?.types;
        if (!types)
            return false;
        return Array.from(types).includes('Files');
    }
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
        const currentContactId = this.auth.contactId || this.myContactId;
        if (currentContactId && String(msg.sender_id) === String(currentContactId))
            return true;
        if (String(msg.sender_name || '').trim().toLowerCase() === 'you')
            return true;
        const current = this.auth.currentContact;
        const senderUsername = String(msg.sender_username || '').trim().toLowerCase();
        const currentUsername = String(current?.username || '').trim().toLowerCase();
        if (senderUsername && currentUsername && senderUsername === currentUsername)
            return true;
        const senderName = getMessageSenderName(msg).trim().toLowerCase();
        const currentName = current ? getContactDisplayName(current).trim().toLowerCase() : '';
        return !!senderName && !!currentName && senderName === currentName;
    }
    canEditMessage(msg) {
        return (this.isOwnMessage(msg) &&
            !this.isDeletedMessage(msg) &&
            String(msg.message_type || '').toUpperCase() === 'TEXT' &&
            !String(msg.message_id || '').startsWith('temp-'));
    }
    canDeleteMessage(msg) {
        return (this.isOwnMessage(msg) &&
            !this.isDeletedMessage(msg));
    }
    canManageMessage(msg) {
        return this.canEditMessage(msg) || this.canDeleteMessage(msg);
    }
    canReplyMessage(msg) {
        return !this.isDeletedMessage(msg) && !this.isSystemMessage(msg);
    }
    isEditingMessage(msg) {
        return !!this.editingMessage && String(this.editingMessage.message_id) === String(msg.message_id);
    }
    onInlineEditInput(event) {
        this.editingDraft = event.target.value;
    }
    onInlineEditKeydown(event) {
        if (event.key === 'Escape') {
            event.preventDefault();
            this.clearEdit();
            return;
        }
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            event.preventDefault();
            this.saveInlineEdit(event);
        }
    }
    canSaveInlineEdit() {
        const message = this.editingMessage;
        if (!message || !this.canEditMessage(message))
            return false;
        const next = this.editingDraft.trim();
        return !!next && next !== this.getMessageBody(message).trim();
    }
    saveInlineEdit(event) {
        event?.stopPropagation();
        const message = this.editingMessage;
        if (!message || !this.canSaveInlineEdit())
            return;
        this.store.editMessage(message.message_id, this.editingDraft.trim());
        this.clearEdit();
    }
    cancelInlineEdit(event) {
        event?.stopPropagation();
        this.clearEdit();
    }
    startEditMessage(msg) {
        if (!this.canEditMessage(msg))
            return;
        this.clearReply();
        this.editingMessage = msg;
        this.editingDraft = this.getMessageBody(msg);
        setTimeout(() => {
            const textarea = this.inlineEditTextareas?.first?.nativeElement;
            textarea?.focus();
            textarea?.select();
        });
    }
    isSystemMessage(msg) {
        const content = String(msg.content || '').trim();
        return msg.message_type === 'SYSTEM' ||
            /^.+ added .+ to the group$/.test(content) ||
            /^.+ removed .+ from the group$/.test(content);
    }
    isPreformattedText(msg) {
        return this.isPreformattedContent(this.getMessageBody(msg));
    }
    isPreformattedContent(content) {
        return content.includes('\t') || content.includes('\n') || / {2,}/.test(content);
    }
    getMessageCaption(msg) {
        const content = this.getMessageBody(msg).trim();
        if (!content)
            return '';
        const attachmentNames = this.getRenderableAttachments(msg)
            .map((attachment) => String(attachment.filename || '').trim())
            .filter(Boolean);
        if (!attachmentNames.length)
            return content;
        const namesText = attachmentNames.join(', ');
        if (content === namesText || attachmentNames.includes(content))
            return '';
        return content;
    }
    isCodeText(msg) {
        return this.isCodeContent(this.getMessageBody(msg), msg);
    }
    isCodeContent(value, msg) {
        const content = value.trim();
        if (msg?.render_as_plain_text)
            return false;
        if (!content || (msg ? this.isTableText(msg) : this.isTableContent(content)))
            return false;
        if (this.looksLikeMarkdown(content) && !this.isSingleFencedCodeBlock(content))
            return false;
        if (/^```[\s\S]*```$/.test(content))
            return true;
        return this.detectCodeLanguage(content) !== null;
    }
    isMarkdownText(msg) {
        return this.isMarkdownContent(this.getMessageBody(msg), msg);
    }
    isMarkdownContent(value, msg) {
        const content = value.trim();
        if (!content || (msg ? this.isTableText(msg) : this.isTableContent(content)) || this.isSingleFencedCodeBlock(content))
            return false;
        return this.looksLikeMarkdown(content);
    }
    getCodeLanguage(msg) {
        return this.getCodeLanguageContent(this.getMessageBody(msg));
    }
    getCodeLanguageContent(content) {
        const parsed = this.parseCodeBlock(content);
        return parsed.language || this.detectCodeLanguage(parsed.code) || 'code';
    }
    getHighlightedCode(msg) {
        return this.getHighlightedCodeContent(this.getMessageBody(msg));
    }
    getHighlightedCodeContent(content) {
        const parsed = this.parseCodeBlock(content);
        const language = parsed.language || this.detectCodeLanguage(parsed.code) || 'code';
        const escaped = this.escapeHtml(parsed.code);
        const highlighted = this.highlightCode(escaped, language);
        return this.sanitizer.bypassSecurityTrustHtml(highlighted);
    }
    getMarkdownHtml(msg) {
        return this.getMarkdownHtmlContent(this.getMessageBody(msg));
    }
    getMarkdownHtmlContent(content) {
        return this.sanitizer.bypassSecurityTrustHtml(this.renderMarkdown(content));
    }
    copyCode(msg, event) {
        event.stopPropagation();
        const content = this.getMessageBody(msg);
        const parsed = this.parseCodeBlock(content);
        this.copyText(parsed.code || content);
    }
    copyMessageText(msg, event) {
        event.stopPropagation();
        this.copyText(this.getMessageBody(msg));
    }
    copyTextValue(text, event) {
        event.stopPropagation();
        this.copyText(text);
    }
    parseCodeBlock(content) {
        const trimmed = content.trim();
        const match = trimmed.match(/^```([a-zA-Z0-9_+-]*)\s*\n?([\s\S]*?)```$/);
        if (!match)
            return { language: '', code: content };
        return { language: (match[1] || '').toLowerCase(), code: match[2] || '' };
    }
    isSingleFencedCodeBlock(content) {
        return /^```[a-zA-Z0-9_+-]*\s*\n?[\s\S]*?```$/.test(content.trim());
    }
    looksLikeMarkdown(content) {
        return /(^#{1,6}\s)|(^[-*]\s)|(^\d+\.\s)|(^>\s)|(\*\*[^*]+\*\*)|(`[^`]+`)|(\[[^\]]+\]\([^)]+\))|(^---$)|(^-\s\[[ x]\]\s)|(^```[a-zA-Z0-9_+-]*\s*$)/m.test(content);
    }
    detectCodeLanguage(code) {
        const trimmed = code.trim();
        if (!trimmed.includes('\n') && trimmed.length < 40)
            return null;
        if (/^\s*(select|with|insert|update|delete|create|alter|drop)\b/i.test(trimmed))
            return 'sql';
        const jsDeclaration = /\b(function|const|let|var)\s+[A-Za-z_$][\w$]*\s*(=|=>|\(|:)/.test(trimmed);
        const jsSyntax = /(=>|console\.log|import\s+.*from|export\s+|[{};])/.test(trimmed);
        if (jsDeclaration || jsSyntax)
            return 'javascript';
        if (/\b(def|import|from|print|class)\b/.test(trimmed) && /:\s*$|^\s{4}/m.test(trimmed))
            return 'python';
        if (/<\/?[a-z][\s\S]*>/i.test(trimmed))
            return 'html';
        if (/[{};]/.test(trimmed) && /[:=]/.test(trimmed))
            return 'code';
        return null;
    }
    highlightCode(escapedCode, language) {
        const protectedTokens = [];
        const protect = (value, regex, className) => value.replace(regex, (match) => {
            const token = `__CODE_TOKEN_${protectedTokens.length}__`;
            protectedTokens.push(`<span class="${className}">${match}</span>`);
            return token;
        });
        let highlighted = escapedCode;
        if (language === 'sql') {
            highlighted = protect(highlighted, /(--.*)$/gm, 'code-token-comment');
            highlighted = protect(highlighted, /(&quot;.*?&quot;|&#39;.*?&#39;|`.*?`)/g, 'code-token-string');
            highlighted = highlighted.replace(/\b(SELECT|FROM|WHERE|JOIN|LEFT|RIGHT|INNER|OUTER|ON|GROUP BY|ORDER BY|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|ALTER|DROP|AND|OR|NULL|IS|NOT|AS|LIMIT)\b/gi, '<span class="code-token-keyword">$1</span>');
            highlighted = highlighted.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="code-token-number">$1</span>');
            return this.restoreCodeTokens(highlighted, protectedTokens);
        }
        highlighted = protect(highlighted, /(\/\/.*|#.*)$/gm, 'code-token-comment');
        highlighted = protect(highlighted, /(&quot;.*?&quot;|&#39;.*?&#39;|`.*?`)/g, 'code-token-string');
        highlighted = highlighted.replace(/\b(function|const|let|var|return|if|else|for|while|class|import|from|export|async|await|def|print|try|catch|new|true|false|null|None)\b/g, '<span class="code-token-keyword">$1</span>');
        highlighted = highlighted.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="code-token-number">$1</span>');
        highlighted = highlighted.replace(/\b([a-zA-Z_$][\w$]*)(?=\()/g, '<span class="code-token-function">$1</span>');
        return this.restoreCodeTokens(highlighted, protectedTokens);
    }
    restoreCodeTokens(value, protectedTokens) {
        return protectedTokens.reduce((html, token, index) => html.replace(new RegExp(`__CODE_TOKEN_${index}__`, 'g'), token), value);
    }
    renderMarkdown(raw) {
        const codeBlocks = [];
        const withoutCode = raw.replace(/```([a-zA-Z0-9_+-]*)\s*\n?([\s\S]*?)```/g, (_match, lang, code) => {
            const language = String(lang || 'code').toLowerCase();
            const token = `__MD_CODE_${codeBlocks.length}__`;
            codeBlocks.push(`<pre><code data-language="${this.escapeHtml(language)}">${this.escapeHtml(String(code || ''))}</code></pre>`);
            return token;
        });
        const lines = withoutCode.split(/\r?\n/);
        const html = [];
        let listType = null;
        const closeList = () => {
            if (listType) {
                html.push(`</${listType}>`);
                listType = null;
            }
        };
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) {
                closeList();
                continue;
            }
            const tokenMatch = trimmed.match(/^__MD_CODE_(\d+)__$/);
            if (tokenMatch) {
                closeList();
                html.push(codeBlocks[Number(tokenMatch[1])] || '');
                continue;
            }
            const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
            if (heading) {
                closeList();
                html.push(`<h${heading[1].length}>${this.renderMarkdownInline(heading[2])}</h${heading[1].length}>`);
                continue;
            }
            if (/^---+$/.test(trimmed)) {
                closeList();
                html.push('<hr>');
                continue;
            }
            const unordered = trimmed.match(/^[-*]\s+(?:\[[ x]\]\s+)?(.+)$/i);
            if (unordered) {
                if (listType !== 'ul') {
                    closeList();
                    html.push('<ul>');
                    listType = 'ul';
                }
                html.push(`<li>${this.renderMarkdownInline(unordered[1])}</li>`);
                continue;
            }
            const ordered = trimmed.match(/^\d+\.\s+(.+)$/);
            if (ordered) {
                if (listType !== 'ol') {
                    closeList();
                    html.push('<ol>');
                    listType = 'ol';
                }
                html.push(`<li>${this.renderMarkdownInline(ordered[1])}</li>`);
                continue;
            }
            const quote = trimmed.match(/^>\s+(.+)$/);
            if (quote) {
                closeList();
                html.push(`<blockquote>${this.renderMarkdownInline(quote[1])}</blockquote>`);
                continue;
            }
            closeList();
            html.push(`<p>${this.renderMarkdownInline(trimmed)}</p>`);
        }
        closeList();
        return html.join('');
    }
    renderMarkdownInline(value) {
        let html = this.escapeHtml(value);
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
        html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
        return html;
    }
    copyText(text) {
        if (!text)
            return;
        if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(text).then(() => this.store.showToast('Copied to clipboard', 'success', 1600), () => this.fallbackCopyText(text));
            return;
        }
        this.fallbackCopyText(text);
    }
    fallbackCopyText(text) {
        try {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.left = '-9999px';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            this.store.showToast('Copied to clipboard', 'success', 1600);
        }
        catch {
            this.store.showToast('Could not copy', 'error', 2200);
        }
    }
    escapeHtml(value) {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
    isTableText(msg) {
        const rows = this.getTableRows(msg);
        return rows.length >= 2 && rows.some((row) => row.length >= 2);
    }
    isTableContent(content) {
        const rows = this.getTableRowsFromContent(content);
        return rows.length >= 2 && rows.some((row) => row.length >= 2);
    }
    getTableRows(msg) {
        return this.getTableRowsFromContent(this.getMessageBody(msg));
    }
    getTableRowsFromContent(value) {
        const content = value.trim();
        if (!content.includes('\t'))
            return [];
        const rows = content
            .split(/\r?\n/)
            .map((line) => line.split('\t').map((cell) => cell.trim()))
            .filter((row) => row.some((cell) => cell.length > 0));
        const maxColumns = Math.max(0, ...rows.map((row) => row.length));
        if (maxColumns < 2)
            return [];
        return rows.map((row) => [
            ...row,
            ...Array.from({ length: maxColumns - row.length }, () => ''),
        ]);
    }
    isMessageRead(msg) {
        const value = msg.is_read;
        return value === true || value === 'true' || value === 'True' || value === '1';
    }
    getReadTooltip(msg) {
        if (!this.isGroup)
            return 'Read';
        const names = this.getReadByNames(msg);
        if (names.length > 0) {
            return `Read by ${names.join(', ')}`;
        }
        return 'Read';
    }
    getReadByNames(msg) {
        const anyMsg = msg;
        const rawNames = [
            ...this.toReadArray(anyMsg.read_by_names),
            ...this.toReadArray(anyMsg.readByNames),
            ...this.toReadArray(anyMsg.reader_names),
            ...this.toReadArray(anyMsg.readers),
            ...this.toReadArray(anyMsg.read_by),
            ...this.toReadArray(anyMsg.readBy),
        ];
        const names = rawNames
            .map((entry) => this.readEntryToName(entry))
            .filter((name) => !!name && name !== 'You');
        return Array.from(new Set(names));
    }
    toReadArray(value) {
        if (!value)
            return [];
        if (Array.isArray(value))
            return value;
        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (!trimmed)
                return [];
            try {
                const parsed = JSON.parse(trimmed);
                return Array.isArray(parsed) ? parsed : [parsed];
            }
            catch {
                return trimmed.includes(',') ? trimmed.split(',').map((v) => v.trim()) : [trimmed];
            }
        }
        return [value];
    }
    readEntryToName(entry) {
        if (entry == null)
            return null;
        if (typeof entry === 'string' || typeof entry === 'number') {
            const idOrName = String(entry).trim();
            const contact = this.visibleContacts.find((c) => String(c.contact_id) === idOrName);
            return contact ? getContactDisplayName(contact) : idOrName;
        }
        if (typeof entry === 'object') {
            const obj = entry;
            const explicit = obj.username || obj.name || obj.display_name || obj.displayName || obj.email;
            if (explicit)
                return String(explicit);
            if (obj.contact_id || obj.contactId) {
                return this.readEntryToName(obj.contact_id || obj.contactId);
            }
        }
        return null;
    }
    getSenderName(msg) {
        const fromMessage = getMessageSenderName(msg);
        if (fromMessage && fromMessage !== 'Unknown') {
            return fromMessage;
        }
        const fromContacts = this.visibleContacts.find((c) => String(c.contact_id) === String(msg.sender_id));
        if (fromContacts) {
            return getContactDisplayName(fromContacts);
        }
        if (this.isOwnMessage(msg)) {
            return 'You';
        }
        return `User ${msg.sender_id}`;
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
    // ── Media helpers ────────────────────────────────────────────────────────
    getFilenameLike(msg, attachment) {
        const anyMsg = msg;
        return String(attachment?.filename ||
            this.getPrimaryAttachment(msg)?.filename ||
            anyMsg?.filename ||
            anyMsg?.file_name ||
            msg.content ||
            '').toLowerCase();
    }
    getRenderableAttachments(msg) {
        const attachments = this.getAllAttachments(msg);
        if (attachments.length > 0)
            return attachments;
        const primary = this.getPrimaryAttachment(msg);
        return primary ? [primary] : [];
    }
    trackByAttachment(index, attachment) {
        return attachment.file_id || attachment.url || `${attachment.filename}-${index}`;
    }
    getAllAttachments(msg) {
        const anyMsg = msg;
        const attachments = [];
        const add = (attachment) => {
            const raw = attachment;
            const fileId = String(typeof attachment === 'string' ? attachment :
                raw?.file_id ??
                    raw?.fileId ??
                    raw?.id ??
                    raw?.attachment_id ??
                    raw?.storage_file_id ??
                    '').trim();
            if (fileId.startsWith('{') || fileId.startsWith('[')) {
                const ids = this.toArray(fileId);
                const filenames = this.toArray(raw?.filenames ?? raw?.filename ?? raw?.file_name);
                const mimeTypes = this.toArray(raw?.mime_types ?? raw?.mimeTypes ?? raw?.mime_type);
                ids.forEach((id, idx) => {
                    add({
                        file_id: id,
                        filename: filenames[idx] || filenames[0] || raw?.filename || raw?.file_name || `Attachment ${idx + 1}`,
                        mime_type: mimeTypes[idx] || raw?.mime_type || raw?.mimeType,
                    });
                });
                return;
            }
            const url = String(raw?.url ?? raw?.file_url ?? raw?.download_url ?? '').trim();
            if (!fileId && !url)
                return;
            if (fileId && attachments.some((a) => a.file_id === fileId))
                return;
            if (!fileId && url && attachments.some((a) => a.url === url))
                return;
            attachments.push({
                file_id: fileId,
                filename: String(raw?.filename ??
                    raw?.file_name ??
                    raw?.name ??
                    (msg.message_type === 'IMAGE' ? 'Image' : 'File')),
                mime_type: raw?.mime_type ?? raw?.mimeType ?? (msg.message_type === 'IMAGE' ? 'image/*' : undefined),
                size_bytes: raw?.size_bytes ?? raw?.sizeBytes,
                url: url || undefined,
            });
        };
        if (Array.isArray(msg.attachments)) {
            msg.attachments.forEach(add);
        }
        const mediaValue = String(msg.media_url || '').trim();
        if (mediaValue.startsWith('{') || mediaValue.startsWith('[')) {
            try {
                const parsed = JSON.parse(mediaValue);
                const mediaAttachments = Array.isArray(parsed) ? parsed : parsed?.attachments;
                if (Array.isArray(mediaAttachments)) {
                    mediaAttachments.forEach(add);
                }
                if (!Array.isArray(parsed)) {
                    const ids = this.toArray(parsed?.ids ?? parsed?.file_ids ?? parsed?.attachment_ids);
                    const filenames = this.toArray(parsed?.filenames);
                    const mimeTypes = this.toArray(parsed?.mime_types ?? parsed?.mimeTypes);
                    ids.forEach((id, idx) => {
                        add({
                            file_id: id,
                            filename: filenames[idx] || filenames[0] || (msg.message_type === 'IMAGE' ? `Image ${idx + 1}` : `Attachment ${idx + 1}`),
                            mime_type: mimeTypes[idx] || (msg.message_type === 'IMAGE' ? 'image/*' : undefined),
                        });
                    });
                }
            }
            catch {
                // Non-JSON media_url values are handled by getPrimaryAttachment().
            }
        }
        const ids = this.toArray(anyMsg?.attachment_ids ?? anyMsg?.file_ids);
        const filenames = this.toArray(anyMsg?.filenames);
        const mimeTypes = this.toArray(anyMsg?.mime_types ?? anyMsg?.mimeTypes);
        ids.forEach((id, idx) => {
            add({
                file_id: id,
                filename: filenames[idx] || filenames[0] || (msg.message_type === 'IMAGE' ? `Image ${idx + 1}` : `Attachment ${idx + 1}`),
                mime_type: mimeTypes[idx] || anyMsg?.mime_type || anyMsg?.attachment_mime_type || (msg.message_type === 'IMAGE' ? 'image/*' : undefined),
            });
        });
        return attachments;
    }
    toArray(value) {
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
                        return this.toArray(parsed);
                    return this.toArray(parsed?.ids ?? parsed?.file_ids ?? parsed?.attachment_ids ?? parsed?.attachments);
                }
                catch {
                    return [];
                }
            }
            return value
                .split(/[,\s]+/)
                .map((x) => x.trim())
                .filter(Boolean);
        }
        return [];
    }
    /** Returns the primary attachment for a message, if any. */
    getPrimaryAttachment(msg) {
        const attachments = this.getAllAttachments(msg);
        if (attachments.length > 0)
            return attachments[0];
        // Some API responses provide file metadata in alternate fields.
        const anyMsg = msg;
        const mu = String(msg.media_url || '').trim();
        const mediaIsDirectUrl = mu.startsWith('http://') || mu.startsWith('https://') || mu.startsWith('data:');
        const mediaIsStructured = mu.startsWith('{') || mu.startsWith('[');
        const fileId = anyMsg?.file_id ||
            anyMsg?.attachment_id ||
            anyMsg?.attachment_ids?.[0] ||
            (!mediaIsDirectUrl && !mediaIsStructured && mu ? mu : undefined);
        const mime = anyMsg?.mime_type || anyMsg?.attachment_mime_type || (msg.message_type === 'IMAGE' ? 'image/*' : undefined);
        const explicitFilename = anyMsg?.filename || anyMsg?.file_name;
        const filename = explicitFilename ||
            (msg.message_type === 'IMAGE' ? 'Image' : msg.message_type === 'FILE' ? 'File' : '');
        if (fileId || explicitFilename || mime || msg.message_type === 'FILE' || msg.message_type === 'IMAGE') {
            return {
                file_id: String(fileId || ''),
                filename: String(filename || 'File'),
                mime_type: mime ? String(mime) : undefined,
                url: mediaIsDirectUrl ? mu : undefined,
            };
        }
        return null;
    }
    isImageAttachment(msg, attachment) {
        const mime = attachment?.mime_type || this.getPrimaryAttachment(msg)?.mime_type || '';
        if (mime.startsWith('image/'))
            return true;
        const name = this.getFilenameLike(msg, attachment);
        if (/\.(png|jpe?g|gif|webp|bmp|svg|heic|heif)$/i.test(name))
            return true;
        return msg.message_type === 'IMAGE';
    }
    /** Returns the cached data URL for a message's media, or null and triggers background load. */
    getMediaUrl(msg, attachment) {
        const att = attachment || this.getPrimaryAttachment(msg);
        const fileId = att?.file_id?.trim();
        const directUrl = att?.url ||
            (!attachment ? msg.media_url : undefined) ||
            (!attachment ? msg?.url : undefined) ||
            (!attachment ? msg?.file_url : undefined);
        if (directUrl &&
            (directUrl.startsWith('http://') ||
                directUrl.startsWith('https://') ||
                directUrl.startsWith('data:'))) {
            return directUrl;
        }
        if (!fileId) {
            return null;
        }
        const cached = this.fileService.getCachedDataUrl(fileId);
        if (cached)
            return cached;
        if (this.mediaFailed.has(fileId))
            return null;
        // Not yet cached — kick off a background fetch
        this.fetchMedia(fileId);
        return null;
    }
    prewarmMedia(messages) {
        for (const msg of messages) {
            for (const att of this.getRenderableAttachments(msg)) {
                if (!this.isImageAttachment(msg, att))
                    continue;
                const fileId = att.file_id?.trim();
                if (!fileId || fileId.startsWith('temp-'))
                    continue;
                if (this.mediaFailed.has(fileId))
                    continue;
                if (this.fileService.getCachedDataUrl(fileId))
                    continue;
                // Queue all files so download links appear once retrieval completes.
                this.fetchMedia(fileId);
            }
        }
    }
    fetchMedia(fileId) {
        if (!fileId || fileId.startsWith('temp-') || this.mediaLoading.has(fileId) || this.mediaFailed.has(fileId))
            return;
        this.mediaLoading.add(fileId);
        this.mediaQueue.push(fileId);
        this.pumpMediaQueue();
    }
    pumpMediaQueue() {
        while (this.activeMediaRequests < this.maxMediaRequests && this.mediaQueue.length > 0) {
            const fileId = this.mediaQueue.shift();
            if (!fileId)
                continue;
            this.activeMediaRequests += 1;
            this.fileService.getFileDataUrl(fileId).subscribe({
                next: () => {
                    this.finishMediaRequest(fileId);
                },
                error: () => {
                    this.mediaFailed.add(fileId);
                    this.finishMediaRequest(fileId);
                },
            });
        }
    }
    finishMediaRequest(fileId) {
        this.activeMediaRequests = Math.max(0, this.activeMediaRequests - 1);
        this.mediaLoading.delete(fileId);
        this.cdr.markForCheck();
        this.pumpMediaQueue();
    }
    resetMediaQueue() {
        this.mediaQueue = [];
        this.mediaLoading.clear();
        this.activeMediaRequests = 0;
    }
    shouldShowMediaSpinner(target) {
        const fileId = this.getAttachmentFileId(target);
        if (!fileId || fileId.startsWith('temp-'))
            return false;
        return this.mediaLoading.has(fileId) && !this.mediaFailed.has(fileId);
    }
    isVideoAttachment(msg, attachment) {
        const mime = attachment?.mime_type || this.getPrimaryAttachment(msg)?.mime_type || '';
        if (mime.startsWith('video/'))
            return true;
        const name = this.getFilenameLike(msg, attachment);
        return /\.(mp4|webm|mov|m4v|avi|mkv)$/i.test(name);
    }
    getAttachmentMimeType(msg, attachment) {
        return attachment?.mime_type || this.getPrimaryAttachment(msg)?.mime_type || 'application/octet-stream';
    }
    getAttachmentName(msg, attachment) {
        return attachment?.filename || this.getPrimaryAttachment(msg)?.filename || msg.content || 'File';
    }
    hasFileAttachment(msg) {
        return msg.message_type === 'FILE' || this.getRenderableAttachments(msg).length > 0;
    }
    hasMediaFailed(target) {
        const fileId = this.getAttachmentFileId(target);
        return !!fileId && this.mediaFailed.has(fileId);
    }
    getAttachmentFileId(target) {
        if ('file_id' in target)
            return target.file_id;
        return this.getPrimaryAttachment(target)?.file_id;
    }
    getFileIcon(msg, attachment) {
        const mime = this.getAttachmentMimeType(msg, attachment);
        const name = this.getAttachmentName(msg, attachment).toLowerCase();
        if (mime.startsWith('video/') || /\.(mp4|webm|mov|m4v|avi|mkv)$/i.test(name))
            return 'videocam';
        if (mime.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|flac)$/i.test(name))
            return 'audiotrack';
        if (mime.includes('pdf') || name.endsWith('.pdf'))
            return 'picture_as_pdf';
        if (mime.includes('spreadsheet') || mime.includes('excel') || /\.(xls|xlsx|csv)$/i.test(name))
            return 'table_chart';
        if (mime.includes('document') || mime.includes('word') || /\.(doc|docx|txt|rtf)$/i.test(name))
            return 'description';
        if (mime.includes('zip') || /\.(zip|rar|7z|tar|gz)$/i.test(name))
            return 'folder_zip';
        return 'insert_drive_file';
    }
    openLightbox(dataUrl, event) {
        event?.stopPropagation();
        this.lightboxOpen.emit(dataUrl);
    }
    downloadAttachment(msg, attachment, event) {
        event?.preventDefault();
        event?.stopPropagation();
        const directUrl = attachment.url;
        if (directUrl && /^(https?:|data:)/i.test(directUrl)) {
            this.triggerDownload(directUrl, this.getAttachmentName(msg, attachment));
            return;
        }
        const fileId = attachment.file_id?.trim();
        if (!fileId || fileId.startsWith('temp-') || fileId.startsWith('{') || fileId.startsWith('[')) {
            return;
        }
        const cached = this.fileService.getCachedDataUrl(fileId);
        if (cached) {
            this.triggerDownload(cached, this.getAttachmentName(msg, attachment));
            return;
        }
        this.mediaLoading.add(fileId);
        this.fileService.getFileDataUrl(fileId).subscribe({
            next: (dataUrl) => {
                this.mediaLoading.delete(fileId);
                this.triggerDownload(dataUrl, this.getAttachmentName(msg, attachment));
                this.cdr.markForCheck();
            },
            error: () => {
                this.mediaLoading.delete(fileId);
                this.mediaFailed.add(fileId);
                this.cdr.markForCheck();
            },
        });
    }
    triggerDownload(url, filename) {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename || 'attachment';
        link.target = '_blank';
        link.rel = 'noopener';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    // ── Reactions ────────────────────────────────────────────────────────────
    onEmojiSelected(emoji, messageId) {
        this.toggleReaction(emoji, messageId);
    }
    toggleReaction(emoji, messageId) {
        const msg = this.messages.find(m => m.message_id === messageId);
        if (!msg)
            return;
        const reaction = msg.reactions?.find(r => r.emoji === emoji);
        if (reaction?.hasReacted) {
            this.store.removeReaction(messageId, emoji);
        }
        else {
            this.store.addReaction(messageId, emoji);
        }
    }
    getReactorTooltip(reaction) {
        if (!reaction?.reactors?.length)
            return '';
        return reaction.reactors.join(', ');
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: ChatThreadComponent, deps: [{ token: MessagingStoreService }, { token: MessagingApiService }, { token: AuthService }, { token: MessagingFileService }, { token: i0.ChangeDetectorRef }, { token: i5.DomSanitizer }], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "17.3.12", type: ChatThreadComponent, isStandalone: true, selector: "app-chat-thread", outputs: { lightboxOpen: "lightboxOpen" }, viewQueries: [{ propertyName: "scrollContainer", first: true, predicate: ["scrollContainer"], descendants: true }, { propertyName: "threadRoot", first: true, predicate: ["threadRoot"], descendants: true }, { propertyName: "messageInput", first: true, predicate: MessageInputComponent, descendants: true }, { propertyName: "inlineEditTextareas", predicate: ["inlineEditTextarea"], descendants: true }], ngImport: i0, template: `
    <div
      #threadRoot
      class="chat-thread"
      [class.drag-over]="threadDragOver"
      [style.--message-text-scale]="messageTextScale"
      [style.--code-text-scale]="codeTextScale"
      (click)="closeMessageContextMenu()"
      (dragenter)="onThreadDragEnter($event)"
      (dragover)="onThreadDragOver($event)"
      (dragleave)="onThreadDragLeave($event)"
      (drop)="onThreadDrop($event)"
    >
      <div class="chat-header">
        <button mat-icon-button class="hdr-btn" (click)="goBack()" matTooltip="Back" matTooltipPosition="below">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <div class="header-info">
          <span class="chat-name">{{ conversationName }}</span>
        </div>
        <div class="header-actions">
          <button *ngIf="isGroup && !isRemovedFromGroup" mat-icon-button class="hdr-btn" (click)="onGroupSettings()" matTooltip="Group settings" matTooltipPosition="below">
            <mat-icon>settings</mat-icon>
          </button>
        </div>
      </div>

      <div class="messages-area" #scrollContainer (scroll)="onScroll()">
        <div *ngIf="threadDragOver" class="thread-drag-overlay">
          <mat-icon>cloud_upload</mat-icon>
          <span>Drop files anywhere in this chat</span>
        </div>

        <div *ngIf="isRemovedFromGroup" class="removed-group-state">
          <mat-icon>block</mat-icon>
          <h4>You were removed from this group</h4>
          <p>Messages, attachments, and group settings are no longer available.</p>
          <button type="button" mat-raised-button class="removed-exit-btn" (click)="exitRemovedGroup()">
            Exit Group
          </button>
        </div>

        <div *ngIf="!isRemovedFromGroup && loading" class="loading-indicator">
          <mat-spinner diameter="24"></mat-spinner>
          <span>Loading messages...</span>
        </div>

        <button
          *ngIf="!isRemovedFromGroup && messages.length >= 50 && !loading"
          mat-stroked-button
          class="load-more-btn"
          (click)="loadOlder()"
        >
          Load older messages
        </button>

        <div *ngIf="!isRemovedFromGroup" class="messages-list">
          <ng-container *ngFor="let msg of messages; let i = index">
            <div
              *ngIf="shouldShowDateSeparator(i)"
              class="date-separator"
            >
              <span>{{ formatDate(msg.created_at) }}</span>
            </div>

            <div
              *ngIf="isSystemMessage(msg); else chatMessage"
              class="system-message-row"
            >
              <span class="system-message-text">{{ msg.content }}</span>
            </div>

            <ng-template #chatMessage>
              <div
                class="message-bubble-row"
                [class.own]="isOwnMessage(msg)"
                [class.other]="!isOwnMessage(msg)"
                (contextmenu)="openMessageContextMenu(msg, $event)"
              >
              <div *ngIf="!isOwnMessage(msg)" class="sender-name">
                {{ getSenderName(msg) }}
              </div>
              <div
                class="message-bubble"
                [class.own-bubble]="isOwnMessage(msg)"
                (mouseenter)="hoveredMessageId = msg.message_id"
                (mouseleave)="hoveredMessageId = null"
                (contextmenu)="openMessageContextMenu(msg, $event)"
              >
                <div *ngIf="getReplyPreview(msg) as reply" class="reply-context">
                  <mat-icon>reply</mat-icon>
                  <div>
                    <span>{{ reply.senderName }}</span>
                    <p>{{ reply.content }}</p>
                  </div>
                </div>
                <!-- ATTACHMENTS ───────────────────────────────── -->
                <div *ngIf="hasFileAttachment(msg)" class="attachments-list">
                  <div *ngFor="let attachment of getRenderableAttachments(msg); trackBy: trackByAttachment" class="attachment-item">
                    <ng-container *ngIf="isImageAttachment(msg, attachment); else nonImageAttachment">
                      <div class="image-message">
                        <ng-container *ngIf="getMediaUrl(msg, attachment) as dataUrl; else imgFallback">
                          <div class="media-wrapper">
                            <img
                              [src]="dataUrl"
                              alt="Image"
                              class="media-img"
                              (mousedown)="$event.stopPropagation()"
                              (click)="openLightbox(dataUrl, $event)"
                            />
                            <div class="attachment-actions">
                              <button
                                type="button"
                                class="attachment-action-btn"
                                (click)="openLightbox(dataUrl, $event)"
                                title="Open image"
                              >
                                <mat-icon>open_in_full</mat-icon>
                              </button>
                              <button
                                type="button"
                                class="attachment-action-btn"
                                (click)="downloadAttachment(msg, attachment, $event)"
                                title="Download image"
                              >
                                <mat-icon>download</mat-icon>
                              </button>
                            </div>
                          </div>
                        </ng-container>
                        <ng-template #imgFallback>
                          <div *ngIf="shouldShowMediaSpinner(attachment); else imgAsFile" class="media-placeholder">
                            <mat-spinner diameter="22"></mat-spinner>
                          </div>
                          <ng-template #imgAsFile>
                            <div class="file-message">
                              <mat-icon class="file-msg-icon">image</mat-icon>
                              <span class="file-msg-name">{{ getAttachmentName(msg, attachment) }}</span>
                            </div>
                          </ng-template>
                        </ng-template>
                      </div>
                    </ng-container>

                    <ng-template #nonImageAttachment>
                      <div class="file-message attachment-thumb">
                        <button
                          type="button"
                          class="file-download-btn"
                          (click)="downloadAttachment(msg, attachment, $event)"
                          title="Download file"
                        >
                          <mat-icon class="file-download-icon">download</mat-icon>
                        </button>
                        <mat-icon class="file-msg-icon">{{ getFileIcon(msg, attachment) }}</mat-icon>
                        <span class="file-msg-name" [title]="getAttachmentName(msg, attachment)">
                          {{ getAttachmentName(msg, attachment) }}
                        </span>
                        <button
                          type="button"
                          class="file-download-link"
                          (click)="downloadAttachment(msg, attachment, $event)"
                          title="Download file"
                        >
                          Download
                        </button>
                      </div>
                    </ng-template>
                  </div>
                </div>
                <div
                  *ngIf="hasFileAttachment(msg) && getMessageCaption(msg)"
                  class="attachment-caption"
                >
                  <div *ngIf="isCodeContent(getMessageCaption(msg), msg); else nonCodeCaption" class="code-message-wrap attachment-render-block">
                    <button type="button" class="render-copy-btn" (click)="copyTextValue(getMessageCaption(msg), $event)" title="Copy code">
                      <mat-icon>content_copy</mat-icon>
                    </button>
                    <pre class="code-message"><code [innerHTML]="getHighlightedCodeContent(getMessageCaption(msg))"></code></pre>
                    <span class="code-language">{{ getCodeLanguageContent(getMessageCaption(msg)) }}</span>
                  </div>
                  <ng-template #nonCodeCaption>
                    <div *ngIf="isMarkdownContent(getMessageCaption(msg)); else plainCaption" class="md-message-wrap attachment-render-block">
                      <button type="button" class="render-copy-btn" (click)="copyTextValue(getMessageCaption(msg), $event)" title="Copy markdown">
                        <mat-icon>content_copy</mat-icon>
                      </button>
                      <div class="md-message" [innerHTML]="getMarkdownHtmlContent(getMessageCaption(msg))"></div>
                      <span class="md-language">md</span>
                    </div>
                    <ng-template #plainCaption>
                      <div
                        class="text-content"
                        [class.preformatted-text]="isPreformattedContent(getMessageCaption(msg))"
                      >
                        {{ getMessageCaption(msg) }}
                      </div>
                    </ng-template>
                  </ng-template>
                </div>
                <ng-container *ngIf="msg.message_type === 'TEXT' && !hasFileAttachment(msg)">
                  <ng-container *ngIf="isEditingMessage(msg); else textMessageRender">
                    <div class="inline-edit-wrap" (click)="$event.stopPropagation()" (contextmenu)="$event.stopPropagation()">
                      <textarea
                        #inlineEditTextarea
                        class="inline-edit-textarea"
                        [value]="editingDraft"
                        (input)="onInlineEditInput($event)"
                        (keydown)="onInlineEditKeydown($event)"
                        rows="2"
                      ></textarea>
                      <div class="inline-edit-actions">
                        <button type="button" class="inline-edit-cancel" (click)="cancelInlineEdit($event)">Cancel</button>
                        <button
                          type="button"
                          class="inline-edit-save"
                          [disabled]="!canSaveInlineEdit()"
                          (click)="saveInlineEdit($event)"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  </ng-container>
                  <ng-template #textMessageRender>
                    <div *ngIf="isCodeText(msg); else nonCodeTextMessage" class="code-message-wrap">
                      <button type="button" class="render-copy-btn" (click)="copyCode(msg, $event)" title="Copy code">
                        <mat-icon>content_copy</mat-icon>
                      </button>
                      <pre class="code-message"><code [innerHTML]="getHighlightedCode(msg)"></code></pre>
                      <span class="code-language">{{ getCodeLanguage(msg) }}</span>
                    </div>
                    <ng-template #nonCodeTextMessage>
                    <div *ngIf="isTableText(msg); else plainTextMessage" class="table-message-wrap">
                      <button type="button" class="render-copy-btn" (click)="copyMessageText(msg, $event)" title="Copy table">
                        <mat-icon>content_copy</mat-icon>
                      </button>
                      <table class="pasted-table">
                        <tbody>
                          <tr *ngFor="let row of getTableRows(msg); let rowIndex = index">
                            <ng-container *ngFor="let cell of row">
                              <th *ngIf="rowIndex === 0; else tableCell">{{ cell }}</th>
                              <ng-template #tableCell>
                                <td>{{ cell }}</td>
                              </ng-template>
                            </ng-container>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <ng-template #plainTextMessage>
                      <div *ngIf="isMarkdownText(msg); else rawTextMessage" class="md-message-wrap">
                        <button type="button" class="render-copy-btn" (click)="copyMessageText(msg, $event)" title="Copy markdown">
                          <mat-icon>content_copy</mat-icon>
                        </button>
                        <div class="md-message" [innerHTML]="getMarkdownHtml(msg)"></div>
                        <span class="md-language">md</span>
                      </div>
                      <ng-template #rawTextMessage>
                        <div
                          class="text-content"
                          [class.preformatted-text]="isPreformattedText(msg)"
                        >
                          {{ getMessageBody(msg) }}
                        </div>
                      </ng-template>
                    </ng-template>
                    </ng-template>
                  </ng-template>
                </ng-container>
                <div class="message-meta">
                  <span *ngIf="msg.edited_at && !isDeletedMessage(msg)" class="edited-label">edited</span>
                  <span class="msg-time">{{ formatTime(msg.created_at) }}</span>
                  <mat-icon
                    *ngIf="isOwnMessage(msg) && isMessageRead(msg)"
                    class="read-icon read"
                    [matTooltip]="getReadTooltip(msg)"
                    matTooltipPosition="above"
                  >done_all</mat-icon>
                  <mat-icon
                    *ngIf="isOwnMessage(msg) && !isMessageRead(msg)"
                    class="read-icon unread"
                    matTooltip="Sent"
                    matTooltipPosition="above"
                  >done</mat-icon>
                </div>
                <div *ngIf="hoveredMessageId === msg.message_id && !isDeletedMessage(msg)" class="quick-reactions">
                  <button
                    *ngFor="let emoji of quickEmojis"
                    class="quick-emoji-btn"
                    (click)="onEmojiSelected(emoji, msg.message_id)"
                    [attr.aria-label]="'React with ' + emoji"
                  >
                    {{ emoji }}
                  </button>
                </div>
                <div *ngIf="!isDeletedMessage(msg) && msg.reactions && msg.reactions.length > 0" class="reactions-row">
                  <button 
                    *ngFor="let r of msg.reactions" 
                    class="reaction-chip"
                    (click)="toggleReaction(r.emoji, msg.message_id)"
                    [class.own-reaction]="r.hasReacted"
                    [matTooltip]="getReactorTooltip(r)"
                    matTooltipPosition="above"
                  >
                    <span class="reaction-emoji">{{ r.emoji }}</span>
                    <span class="reaction-count">{{ r.count }}</span>
                  </button>
                </div>
              </div>
              </div>
            </ng-template>
          </ng-container>
        </div>

        <div *ngIf="!isRemovedFromGroup && messages.length === 0 && !loading" class="empty-chat">
          <mat-icon>chat_bubble_outline</mat-icon>
          <p>No messages yet. Say hello!</p>
        </div>
      </div>

      <div
        *ngIf="messageContextMenu as menu"
        class="message-context-menu"
        [style.left.px]="menu.x"
        [style.top.px]="menu.y"
        (click)="$event.stopPropagation()"
        (contextmenu)="$event.preventDefault()"
      >
        <ng-container *ngIf="!menu.confirmDelete; else deleteConfirmMenu">
          <button
            *ngIf="canReplyMessage(menu.message)"
            type="button"
            class="context-menu-item"
            (click)="replyFromContextMenu()"
          >
            <mat-icon>reply</mat-icon>
            <span>Reply</span>
          </button>
          <button
            *ngIf="canEditMessage(menu.message)"
            type="button"
            class="context-menu-item"
            (click)="editFromContextMenu()"
          >
            <mat-icon>edit</mat-icon>
            <span>Edit</span>
          </button>
          <button
            *ngIf="canDeleteMessage(menu.message)"
            type="button"
            class="context-menu-item danger"
            (click)="requestDeleteFromContextMenu()"
          >
            <mat-icon>delete</mat-icon>
            <span>Delete</span>
          </button>
        </ng-container>
        <ng-template #deleteConfirmMenu>
          <div class="context-menu-confirm">
            <div class="confirm-title">Delete this message?</div>
            <div class="confirm-actions">
              <button type="button" class="confirm-cancel" (click)="closeMessageContextMenu()">Cancel</button>
              <button type="button" class="confirm-delete" (click)="confirmDeleteFromContextMenu()">Delete</button>
            </div>
          </div>
        </ng-template>
      </div>

      <app-message-input
        *ngIf="!isRemovedFromGroup"
        [conversationId]="conversationId"
        [replyTo]="replyToMessage ? getComposeReplyPreview(replyToMessage) : null"
        [enableMentions]="isGroup"
        [mentionOptions]="mentionOptions"
        (messageSent)="onSendMessage($event)"
        (messageWithFiles)="onSendWithFiles($event)"
        (replyCancelled)="clearReply()"
      ></app-message-input>
    </div>

  `, isInline: true, styles: [":host{--attachment-thumb-size: 180px}.chat-thread{display:flex;flex-direction:column;height:100%;background:#041322;position:relative;container-type:inline-size;--attachment-thumb-size: clamp(120px, 48cqw, 180px)}.chat-thread.drag-over{outline:2px dashed rgba(255,255,255,.45);outline-offset:-6px}.thread-drag-overlay{position:absolute;inset:8px;z-index:20;pointer-events:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:#fff;background:#1f4bd852;border:2px dashed rgba(255,255,255,.55);border-radius:14px;font-size:14px;font-weight:600}.thread-drag-overlay mat-icon{font-size:36px;width:36px;height:36px}.chat-header{display:flex;align-items:center;padding:8px 8px 8px 4px;border-bottom:1px solid rgba(255,255,255,.15);gap:4px;flex-shrink:0}.chat-header button mat-icon{color:#fffc}.chat-name{font-size:16px;font-weight:600;color:#fff}.header-info{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;padding:0 4px}.header-actions{display:flex;align-items:center;gap:0}.header-actions button{width:32px;height:32px;min-width:32px!important;padding:0!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;--mdc-icon-button-state-layer-size: 32px}.hdr-btn{border-radius:6px!important;transition:background .15s,box-shadow .15s}.hdr-btn:hover{background:#ffffff26!important;box-shadow:0 2px 8px #0003}.hdr-btn mat-icon{font-size:20px;width:20px;height:20px;line-height:20px;margin:0;display:flex;align-items:center;justify-content:center}:host ::ng-deep .hdr-btn .mat-mdc-button-touch-target{width:32px!important;height:32px!important}.messages-area{flex:1;overflow-y:auto;padding:12px;background:transparent;scrollbar-width:none;-ms-overflow-style:none}.messages-area::-webkit-scrollbar{display:none}.loading-indicator{display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;color:#ffffffb3;font-size:13px}.removed-group-state{height:100%;min-height:260px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:10px;padding:32px 24px;color:#ffffffc7;box-sizing:border-box}.removed-group-state mat-icon{width:44px;height:44px;font-size:44px;color:#f87171;margin-bottom:4px}.removed-group-state h4{margin:0;color:#fff;font-size:17px;font-weight:700}.removed-group-state p{margin:0 0 8px;max-width:280px;font-size:13px;line-height:1.4;color:#ffffff9e}.removed-exit-btn{border-radius:10px;background:#ffffff2e!important;color:#fff!important;font-weight:700;padding:0 18px}.load-more-btn{align-self:center;margin-bottom:16px;font-size:12px;color:#fff}.messages-list{display:flex;flex-direction:column;gap:1px;flex:1}.date-separator{text-align:center;margin:16px 0 8px;font-size:12px;color:#ffffffb3;font-weight:500}.message-bubble-row{display:flex;flex-direction:column;max-width:88%;margin-bottom:2px}.message-bubble-row.own{align-self:flex-end;align-items:flex-end}.message-bubble-row.other{align-self:flex-start;align-items:flex-start}.sender-name{font-size:11px;font-weight:700;color:#fffffff2;margin-bottom:3px;letter-spacing:.2px;padding:0 10px;text-shadow:0 1px 3px rgba(0,0,0,.4)}.system-message-row{align-self:center;max-width:88%;margin:8px auto;text-align:center}.system-message-text{display:inline-flex;align-items:center;justify-content:center;padding:5px 11px;border-radius:999px;background:#ffffff17;border:1px solid rgba(255,255,255,.12);color:#ffffffb8;font-size:11px;line-height:1.35}.message-bubble{padding:8px 14px 7px;border-radius:14px;font-size:calc(clamp(11px,3.4cqw,13px) * var(--message-text-scale, 1));line-height:1.32;word-break:break-word;color:#f5f7ff;position:relative;display:inline-block;min-width:fit-content}.message-bubble-row.other .message-bubble{background:#0d2540;border-bottom-left-radius:5px;box-shadow:0 1px 4px #0006}.message-bubble.own-bubble{background:#0a3d62;border-bottom-right-radius:5px;box-shadow:0 1px 4px #0006}.reply-context{display:flex;align-items:center;gap:7px;margin-bottom:7px;padding:7px 9px;border-radius:10px;background:#ffffff14;border-left:3px solid rgba(127,180,255,.78);max-width:min(68cqw,420px)}.reply-context mat-icon{color:#bfdbfe;font-size:16px;width:16px;height:16px;flex-shrink:0}.reply-context div{min-width:0}.reply-context span{display:block;color:#bfdbfe;font-size:11px;font-weight:700;margin-bottom:2px}.reply-context p{margin:0;color:#ffffffc7;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.text-content{white-space:pre-wrap;tab-size:4}.text-content.preformatted-text{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,Liberation Mono,monospace;font-size:calc(clamp(10px,3.1cqw,12px) * var(--code-text-scale, 1));line-height:1.45;overflow-x:auto;max-width:min(72cqw,520px);scrollbar-width:none;-ms-overflow-style:none}.text-content.preformatted-text::-webkit-scrollbar{display:none}.inline-edit-wrap{width:min(76cqw,520px);min-width:min(56cqw,260px)}.inline-edit-textarea{width:100%;min-height:72px;max-height:220px;box-sizing:border-box;border:1px solid rgba(255,255,255,.28);border-radius:10px;outline:none;resize:vertical;padding:9px 10px;background:#ffffff1a;color:#fff;font:inherit;line-height:1.35;white-space:pre-wrap}.inline-edit-textarea:focus{border-color:#bfdbfee6;box-shadow:0 0 0 2px #7fb4ff2e}.inline-edit-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:8px}.inline-edit-cancel,.inline-edit-save{border:0;border-radius:8px;padding:6px 10px;color:#f8fafc;cursor:pointer;font-size:12px;font-weight:700}.inline-edit-cancel{background:#ffffff1f}.inline-edit-save{background:#2563eb}.inline-edit-save:disabled{cursor:not-allowed;opacity:.45}.attachment-caption{margin-top:8px;width:var(--attachment-thumb-size);max-width:var(--attachment-thumb-size);box-sizing:border-box}.attachment-caption .text-content{white-space:pre-wrap;overflow-wrap:anywhere;max-width:100%}.attachment-render-block{width:100%;max-width:100%}.code-message-wrap{position:relative;max-width:min(76cqw,560px);border-radius:10px;overflow:hidden;border:1px solid rgba(255,255,255,.14);background:#061827}.render-copy-btn{position:absolute;top:6px;right:6px;z-index:2;width:26px;height:26px;border:none;border-radius:7px;display:inline-flex;align-items:center;justify-content:center;padding:0;background:#071d30d1;color:#ffffffc7;cursor:pointer;opacity:0;transition:opacity .12s,background .12s,color .12s}.code-message-wrap:hover .render-copy-btn,.table-message-wrap:hover .render-copy-btn,.md-message-wrap:hover .render-copy-btn,.render-copy-btn:focus{opacity:1}.render-copy-btn:hover{background:#7fb4ff38;color:#fff}.render-copy-btn mat-icon{font-size:16px;width:16px;height:16px;line-height:16px}.code-message{margin:0;padding:12px 42px 28px 12px;overflow-x:auto;color:#dbeafe;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,Liberation Mono,monospace;font-size:calc(clamp(10px,3.1cqw,12px) * var(--code-text-scale, 1));line-height:1.45;white-space:pre;tab-size:2;scrollbar-width:none;-ms-overflow-style:none}.code-message::-webkit-scrollbar{display:none}.code-language{position:absolute;right:8px;bottom:6px;padding:2px 7px;border-radius:999px;background:#7fb4ff29;color:#bfdbfe;font-size:10px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;pointer-events:none}.md-language{position:absolute;right:8px;bottom:6px;padding:2px 7px;border-radius:999px;background:#86efac24;color:#bbf7d0;font-size:10px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;pointer-events:none}:host ::ng-deep .code-token-keyword{color:#93c5fd;font-weight:700}:host ::ng-deep .code-token-string{color:#86efac}:host ::ng-deep .code-token-number{color:#fbbf24}:host ::ng-deep .code-token-comment{color:#94a3b8;font-style:italic}:host ::ng-deep .code-token-function{color:#c4b5fd}.table-message-wrap{position:relative;max-width:min(76cqw,560px);overflow-x:auto;border-radius:9px;border:1px solid rgba(255,255,255,.16);background:#ffffff0a;scrollbar-width:none;-ms-overflow-style:none}.table-message-wrap::-webkit-scrollbar{display:none}.pasted-table{border-collapse:collapse;min-width:100%;font-size:calc(clamp(10px,3.1cqw,12px) * var(--code-text-scale, 1));line-height:1.35;color:#f5f7ff}.pasted-table th,.pasted-table td{padding:6px 9px;border-right:1px solid rgba(255,255,255,.12);border-bottom:1px solid rgba(255,255,255,.12);text-align:left;white-space:pre-wrap;vertical-align:top}.pasted-table th{background:#ffffff1a;font-weight:700}.pasted-table tr:last-child td,.pasted-table tr:last-child th{border-bottom:none}.pasted-table th:last-child,.pasted-table td:last-child{border-right:none}.md-message-wrap{position:relative;max-width:min(76cqw,560px);overflow-x:auto;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:#ffffff0d;scrollbar-width:none;-ms-overflow-style:none}.md-message-wrap::-webkit-scrollbar{display:none}.md-message{padding:10px 42px 28px 12px;color:#f5f7ff;font-size:calc(clamp(11px,3.4cqw,13px) * var(--message-text-scale, 1));line-height:1.45;overflow-wrap:anywhere}:host ::ng-deep .md-message h1,:host ::ng-deep .md-message h2,:host ::ng-deep .md-message h3{margin:8px 0 6px;color:#fff;line-height:1.25}:host ::ng-deep .md-message h1{font-size:18px}:host ::ng-deep .md-message h2{font-size:16px}:host ::ng-deep .md-message h3{font-size:14px}:host ::ng-deep .md-message p{margin:6px 0}:host ::ng-deep .md-message ul,:host ::ng-deep .md-message ol{margin:6px 0;padding-left:20px}:host ::ng-deep .md-message blockquote{margin:8px 0;padding-left:10px;border-left:3px solid rgba(127,180,255,.55);color:#ffffffc7}:host ::ng-deep .md-message code{padding:1px 5px;border-radius:5px;background:#00000040;color:#bfdbfe;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,Liberation Mono,monospace;font-size:12px}:host ::ng-deep .md-message pre{margin:8px 0;padding:9px;border-radius:8px;overflow-x:auto;background:#061827;scrollbar-width:none;-ms-overflow-style:none}:host ::ng-deep .md-message pre::-webkit-scrollbar{display:none}:host ::ng-deep .md-message pre code{padding:0;background:transparent;color:#dbeafe;white-space:pre}.image-message{line-height:0}.media-wrapper{position:relative;display:inline-block;line-height:0;width:var(--attachment-thumb-size);height:var(--attachment-thumb-size);overflow:hidden;border-radius:10px;background:#ffffff14}.media-img{width:100%;height:100%;border-radius:inherit;display:block;cursor:zoom-in;object-fit:cover}.attachment-actions{position:absolute;right:6px;top:6px;display:flex;gap:4px;opacity:0;transition:opacity .12s ease;pointer-events:none}.media-wrapper:hover .attachment-actions{opacity:1;pointer-events:auto}.attachment-action-btn,.file-download-btn{border:none;border-radius:999px;background:#071d30d1;color:#fff;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0}.attachment-action-btn{width:28px;height:28px}.attachment-action-btn mat-icon{font-size:17px;width:17px;height:17px}.media-video{max-width:240px;max-height:260px;border-radius:10px;display:block;background:#000}.video-message{display:flex;flex-direction:column;gap:6px}.video-download{color:#ffffffc7;font-size:12px;text-decoration:underline;text-underline-offset:2px}.media-placeholder{display:flex;align-items:center;justify-content:center;gap:8px;width:var(--attachment-thumb-size);height:var(--attachment-thumb-size);border-radius:10px;background:#ffffff14;color:#fff9;font-size:11px}.media-load-label{font-size:11px;color:#fff9}.attachments-list{display:flex;flex-direction:column;gap:8px;max-width:100%}.attachment-item{max-width:100%}.file-message{display:flex;align-items:center;gap:8px;padding:4px 0}.attachment-thumb.file-message{position:relative;width:var(--attachment-thumb-size);height:var(--attachment-thumb-size);padding:12px;border-radius:10px;background:#ffffff14;flex-direction:column;justify-content:center;box-sizing:border-box;overflow:hidden}.file-download{display:inline-flex;align-items:center;gap:8px;color:#fff;text-decoration:none;max-width:240px}.file-msg-icon{font-size:42px;width:42px;height:42px;color:#fffc;flex-shrink:0}.file-msg-name{font-size:13px;color:#fff;line-height:1.2;max-width:100%;overflow:hidden;text-align:center;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;word-break:break-word}.file-download-icon{font-size:18px;width:18px;height:18px;color:#ffffffb3;flex-shrink:0}.file-download-btn{width:24px;height:24px;flex-shrink:0;position:absolute;right:6px;top:6px}.file-download-link{border:none;border-radius:999px;background:#ffffff29;color:#fff;cursor:pointer;font-size:11px;padding:4px 10px;margin-top:4px}.message-meta{display:flex;align-items:center;gap:4px;margin-top:3px}.msg-time{font-size:10px;color:#dae0faa8}.message-bubble-row.other .msg-time{color:#d8dff694}.edited-label{font-size:10px;font-style:italic;color:#dae0fa9e}.read-icon{font-size:14px;width:14px;height:14px;opacity:.7}.read-icon.read{color:#60a5fa;opacity:1}.read-icon.unread{color:#dae0fa80;opacity:1}.reply-message-btn{position:absolute;right:-10px;bottom:-10px;width:24px;height:24px;border:1px solid rgba(255,255,255,.16);border-radius:999px;background:#071d30;color:#ffffffc7;display:inline-flex;align-items:center;justify-content:center;padding:0;cursor:pointer;opacity:0;transform:scale(.92);transition:opacity .12s,transform .12s,background .12s,color .12s;z-index:3}.message-bubble:hover .reply-message-btn,.reply-message-btn:focus{opacity:1;transform:scale(1)}.reply-message-btn:hover{background:#7fb4ff38;color:#fff}.reply-message-btn mat-icon{font-size:15px;width:15px;height:15px;line-height:15px}.quick-reactions{position:absolute;top:-18px;right:0;display:flex;align-items:center;gap:4px;padding:3px 5px;background:#071d30;border:1px solid rgba(255,255,255,.14);border-radius:999px;box-shadow:0 6px 14px #00000047;z-index:4}.message-bubble-row.other .quick-reactions{left:0;right:auto}.message-bubble-row.own .quick-reactions{left:auto;right:0}.quick-emoji-btn{width:20px;height:20px;border:none;border-radius:999px;background:transparent;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:13px;line-height:1;cursor:pointer;padding:0;transition:transform .12s ease,background .12s ease}.quick-emoji-btn:hover{background:#ffffff2e;transform:scale(1.14)}.reactions-row{display:flex;flex-wrap:wrap;gap:3px;margin-top:5px}.reaction-chip{background:#ffffff14;border:1px solid rgba(255,255,255,.2);border-radius:999px;padding:2px 7px;font-size:11px;color:#f2f6ff;cursor:pointer;transition:all .2s;display:inline-flex;align-items:center;gap:3px;max-width:180px}.reaction-chip:hover{background:#ffffff40;transform:scale(1.05)}.reaction-chip.own-reaction{background:#2a5bff4d;border-color:#2a5bff80}.empty-chat{display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;color:#9ca3af}.empty-chat mat-icon{font-size:48px;width:48px;height:48px;margin-bottom:8px}.empty-chat p{font-size:14px;margin:0}.message-context-menu{position:absolute;z-index:10000;min-width:150px;padding:6px;border:1px solid rgba(255,255,255,.14);border-radius:12px;background:#07111efa;box-shadow:0 18px 45px #00000061;color:#f8fafc}.context-menu-item{width:100%;border:0;border-radius:9px;padding:9px 10px;background:transparent;color:inherit;display:flex;align-items:center;gap:9px;cursor:pointer;font-size:13px;text-align:left}.context-menu-item:hover{background:#ffffff17}.context-menu-item mat-icon{font-size:17px;width:17px;height:17px}.context-menu-item.danger{color:#fecaca}.context-menu-confirm{padding:8px;width:190px}.confirm-title{color:#f8fafc;font-size:13px;font-weight:600;margin-bottom:10px}.confirm-actions{display:flex;justify-content:flex-end;gap:8px}.confirm-cancel,.confirm-delete{border:0;border-radius:8px;padding:7px 10px;color:#f8fafc;cursor:pointer;font-size:12px}.confirm-cancel{background:#ffffff1f}.confirm-delete{background:#dc2626}\n"], dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i1$1.NgForOf, selector: "[ngFor][ngForOf]", inputs: ["ngForOf", "ngForTrackBy", "ngForTemplate"] }, { kind: "directive", type: i1$1.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "ngmodule", type: MatIconModule }, { kind: "component", type: i4.MatIcon, selector: "mat-icon", inputs: ["color", "inline", "svgIcon", "fontSet", "fontIcon"], exportAs: ["matIcon"] }, { kind: "ngmodule", type: MatButtonModule }, { kind: "component", type: i6.MatButton, selector: "    button[mat-button], button[mat-raised-button], button[mat-flat-button],    button[mat-stroked-button]  ", exportAs: ["matButton"] }, { kind: "component", type: i6.MatIconButton, selector: "button[mat-icon-button]", exportAs: ["matButton"] }, { kind: "ngmodule", type: MatProgressSpinnerModule }, { kind: "component", type: i9.MatProgressSpinner, selector: "mat-progress-spinner, mat-spinner", inputs: ["color", "mode", "value", "diameter", "strokeWidth"], exportAs: ["matProgressSpinner"] }, { kind: "ngmodule", type: MatTooltipModule }, { kind: "directive", type: i7.MatTooltip, selector: "[matTooltip]", inputs: ["matTooltipPosition", "matTooltipPositionAtOrigin", "matTooltipDisabled", "matTooltipShowDelay", "matTooltipHideDelay", "matTooltipTouchGestures", "matTooltip", "matTooltipClass"], exportAs: ["matTooltip"] }, { kind: "component", type: MessageInputComponent, selector: "app-message-input", inputs: ["conversationId", "replyTo", "enableMentions", "mentionOptions"], outputs: ["messageSent", "messageWithFiles", "replyCancelled"] }] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: ChatThreadComponent, decorators: [{
            type: Component,
            args: [{ selector: 'app-chat-thread', standalone: true, imports: [
                        CommonModule, MatIconModule, MatButtonModule,
                        MatProgressSpinnerModule, MatTooltipModule, MessageInputComponent,
                    ], template: `
    <div
      #threadRoot
      class="chat-thread"
      [class.drag-over]="threadDragOver"
      [style.--message-text-scale]="messageTextScale"
      [style.--code-text-scale]="codeTextScale"
      (click)="closeMessageContextMenu()"
      (dragenter)="onThreadDragEnter($event)"
      (dragover)="onThreadDragOver($event)"
      (dragleave)="onThreadDragLeave($event)"
      (drop)="onThreadDrop($event)"
    >
      <div class="chat-header">
        <button mat-icon-button class="hdr-btn" (click)="goBack()" matTooltip="Back" matTooltipPosition="below">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <div class="header-info">
          <span class="chat-name">{{ conversationName }}</span>
        </div>
        <div class="header-actions">
          <button *ngIf="isGroup && !isRemovedFromGroup" mat-icon-button class="hdr-btn" (click)="onGroupSettings()" matTooltip="Group settings" matTooltipPosition="below">
            <mat-icon>settings</mat-icon>
          </button>
        </div>
      </div>

      <div class="messages-area" #scrollContainer (scroll)="onScroll()">
        <div *ngIf="threadDragOver" class="thread-drag-overlay">
          <mat-icon>cloud_upload</mat-icon>
          <span>Drop files anywhere in this chat</span>
        </div>

        <div *ngIf="isRemovedFromGroup" class="removed-group-state">
          <mat-icon>block</mat-icon>
          <h4>You were removed from this group</h4>
          <p>Messages, attachments, and group settings are no longer available.</p>
          <button type="button" mat-raised-button class="removed-exit-btn" (click)="exitRemovedGroup()">
            Exit Group
          </button>
        </div>

        <div *ngIf="!isRemovedFromGroup && loading" class="loading-indicator">
          <mat-spinner diameter="24"></mat-spinner>
          <span>Loading messages...</span>
        </div>

        <button
          *ngIf="!isRemovedFromGroup && messages.length >= 50 && !loading"
          mat-stroked-button
          class="load-more-btn"
          (click)="loadOlder()"
        >
          Load older messages
        </button>

        <div *ngIf="!isRemovedFromGroup" class="messages-list">
          <ng-container *ngFor="let msg of messages; let i = index">
            <div
              *ngIf="shouldShowDateSeparator(i)"
              class="date-separator"
            >
              <span>{{ formatDate(msg.created_at) }}</span>
            </div>

            <div
              *ngIf="isSystemMessage(msg); else chatMessage"
              class="system-message-row"
            >
              <span class="system-message-text">{{ msg.content }}</span>
            </div>

            <ng-template #chatMessage>
              <div
                class="message-bubble-row"
                [class.own]="isOwnMessage(msg)"
                [class.other]="!isOwnMessage(msg)"
                (contextmenu)="openMessageContextMenu(msg, $event)"
              >
              <div *ngIf="!isOwnMessage(msg)" class="sender-name">
                {{ getSenderName(msg) }}
              </div>
              <div
                class="message-bubble"
                [class.own-bubble]="isOwnMessage(msg)"
                (mouseenter)="hoveredMessageId = msg.message_id"
                (mouseleave)="hoveredMessageId = null"
                (contextmenu)="openMessageContextMenu(msg, $event)"
              >
                <div *ngIf="getReplyPreview(msg) as reply" class="reply-context">
                  <mat-icon>reply</mat-icon>
                  <div>
                    <span>{{ reply.senderName }}</span>
                    <p>{{ reply.content }}</p>
                  </div>
                </div>
                <!-- ATTACHMENTS ───────────────────────────────── -->
                <div *ngIf="hasFileAttachment(msg)" class="attachments-list">
                  <div *ngFor="let attachment of getRenderableAttachments(msg); trackBy: trackByAttachment" class="attachment-item">
                    <ng-container *ngIf="isImageAttachment(msg, attachment); else nonImageAttachment">
                      <div class="image-message">
                        <ng-container *ngIf="getMediaUrl(msg, attachment) as dataUrl; else imgFallback">
                          <div class="media-wrapper">
                            <img
                              [src]="dataUrl"
                              alt="Image"
                              class="media-img"
                              (mousedown)="$event.stopPropagation()"
                              (click)="openLightbox(dataUrl, $event)"
                            />
                            <div class="attachment-actions">
                              <button
                                type="button"
                                class="attachment-action-btn"
                                (click)="openLightbox(dataUrl, $event)"
                                title="Open image"
                              >
                                <mat-icon>open_in_full</mat-icon>
                              </button>
                              <button
                                type="button"
                                class="attachment-action-btn"
                                (click)="downloadAttachment(msg, attachment, $event)"
                                title="Download image"
                              >
                                <mat-icon>download</mat-icon>
                              </button>
                            </div>
                          </div>
                        </ng-container>
                        <ng-template #imgFallback>
                          <div *ngIf="shouldShowMediaSpinner(attachment); else imgAsFile" class="media-placeholder">
                            <mat-spinner diameter="22"></mat-spinner>
                          </div>
                          <ng-template #imgAsFile>
                            <div class="file-message">
                              <mat-icon class="file-msg-icon">image</mat-icon>
                              <span class="file-msg-name">{{ getAttachmentName(msg, attachment) }}</span>
                            </div>
                          </ng-template>
                        </ng-template>
                      </div>
                    </ng-container>

                    <ng-template #nonImageAttachment>
                      <div class="file-message attachment-thumb">
                        <button
                          type="button"
                          class="file-download-btn"
                          (click)="downloadAttachment(msg, attachment, $event)"
                          title="Download file"
                        >
                          <mat-icon class="file-download-icon">download</mat-icon>
                        </button>
                        <mat-icon class="file-msg-icon">{{ getFileIcon(msg, attachment) }}</mat-icon>
                        <span class="file-msg-name" [title]="getAttachmentName(msg, attachment)">
                          {{ getAttachmentName(msg, attachment) }}
                        </span>
                        <button
                          type="button"
                          class="file-download-link"
                          (click)="downloadAttachment(msg, attachment, $event)"
                          title="Download file"
                        >
                          Download
                        </button>
                      </div>
                    </ng-template>
                  </div>
                </div>
                <div
                  *ngIf="hasFileAttachment(msg) && getMessageCaption(msg)"
                  class="attachment-caption"
                >
                  <div *ngIf="isCodeContent(getMessageCaption(msg), msg); else nonCodeCaption" class="code-message-wrap attachment-render-block">
                    <button type="button" class="render-copy-btn" (click)="copyTextValue(getMessageCaption(msg), $event)" title="Copy code">
                      <mat-icon>content_copy</mat-icon>
                    </button>
                    <pre class="code-message"><code [innerHTML]="getHighlightedCodeContent(getMessageCaption(msg))"></code></pre>
                    <span class="code-language">{{ getCodeLanguageContent(getMessageCaption(msg)) }}</span>
                  </div>
                  <ng-template #nonCodeCaption>
                    <div *ngIf="isMarkdownContent(getMessageCaption(msg)); else plainCaption" class="md-message-wrap attachment-render-block">
                      <button type="button" class="render-copy-btn" (click)="copyTextValue(getMessageCaption(msg), $event)" title="Copy markdown">
                        <mat-icon>content_copy</mat-icon>
                      </button>
                      <div class="md-message" [innerHTML]="getMarkdownHtmlContent(getMessageCaption(msg))"></div>
                      <span class="md-language">md</span>
                    </div>
                    <ng-template #plainCaption>
                      <div
                        class="text-content"
                        [class.preformatted-text]="isPreformattedContent(getMessageCaption(msg))"
                      >
                        {{ getMessageCaption(msg) }}
                      </div>
                    </ng-template>
                  </ng-template>
                </div>
                <ng-container *ngIf="msg.message_type === 'TEXT' && !hasFileAttachment(msg)">
                  <ng-container *ngIf="isEditingMessage(msg); else textMessageRender">
                    <div class="inline-edit-wrap" (click)="$event.stopPropagation()" (contextmenu)="$event.stopPropagation()">
                      <textarea
                        #inlineEditTextarea
                        class="inline-edit-textarea"
                        [value]="editingDraft"
                        (input)="onInlineEditInput($event)"
                        (keydown)="onInlineEditKeydown($event)"
                        rows="2"
                      ></textarea>
                      <div class="inline-edit-actions">
                        <button type="button" class="inline-edit-cancel" (click)="cancelInlineEdit($event)">Cancel</button>
                        <button
                          type="button"
                          class="inline-edit-save"
                          [disabled]="!canSaveInlineEdit()"
                          (click)="saveInlineEdit($event)"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  </ng-container>
                  <ng-template #textMessageRender>
                    <div *ngIf="isCodeText(msg); else nonCodeTextMessage" class="code-message-wrap">
                      <button type="button" class="render-copy-btn" (click)="copyCode(msg, $event)" title="Copy code">
                        <mat-icon>content_copy</mat-icon>
                      </button>
                      <pre class="code-message"><code [innerHTML]="getHighlightedCode(msg)"></code></pre>
                      <span class="code-language">{{ getCodeLanguage(msg) }}</span>
                    </div>
                    <ng-template #nonCodeTextMessage>
                    <div *ngIf="isTableText(msg); else plainTextMessage" class="table-message-wrap">
                      <button type="button" class="render-copy-btn" (click)="copyMessageText(msg, $event)" title="Copy table">
                        <mat-icon>content_copy</mat-icon>
                      </button>
                      <table class="pasted-table">
                        <tbody>
                          <tr *ngFor="let row of getTableRows(msg); let rowIndex = index">
                            <ng-container *ngFor="let cell of row">
                              <th *ngIf="rowIndex === 0; else tableCell">{{ cell }}</th>
                              <ng-template #tableCell>
                                <td>{{ cell }}</td>
                              </ng-template>
                            </ng-container>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <ng-template #plainTextMessage>
                      <div *ngIf="isMarkdownText(msg); else rawTextMessage" class="md-message-wrap">
                        <button type="button" class="render-copy-btn" (click)="copyMessageText(msg, $event)" title="Copy markdown">
                          <mat-icon>content_copy</mat-icon>
                        </button>
                        <div class="md-message" [innerHTML]="getMarkdownHtml(msg)"></div>
                        <span class="md-language">md</span>
                      </div>
                      <ng-template #rawTextMessage>
                        <div
                          class="text-content"
                          [class.preformatted-text]="isPreformattedText(msg)"
                        >
                          {{ getMessageBody(msg) }}
                        </div>
                      </ng-template>
                    </ng-template>
                    </ng-template>
                  </ng-template>
                </ng-container>
                <div class="message-meta">
                  <span *ngIf="msg.edited_at && !isDeletedMessage(msg)" class="edited-label">edited</span>
                  <span class="msg-time">{{ formatTime(msg.created_at) }}</span>
                  <mat-icon
                    *ngIf="isOwnMessage(msg) && isMessageRead(msg)"
                    class="read-icon read"
                    [matTooltip]="getReadTooltip(msg)"
                    matTooltipPosition="above"
                  >done_all</mat-icon>
                  <mat-icon
                    *ngIf="isOwnMessage(msg) && !isMessageRead(msg)"
                    class="read-icon unread"
                    matTooltip="Sent"
                    matTooltipPosition="above"
                  >done</mat-icon>
                </div>
                <div *ngIf="hoveredMessageId === msg.message_id && !isDeletedMessage(msg)" class="quick-reactions">
                  <button
                    *ngFor="let emoji of quickEmojis"
                    class="quick-emoji-btn"
                    (click)="onEmojiSelected(emoji, msg.message_id)"
                    [attr.aria-label]="'React with ' + emoji"
                  >
                    {{ emoji }}
                  </button>
                </div>
                <div *ngIf="!isDeletedMessage(msg) && msg.reactions && msg.reactions.length > 0" class="reactions-row">
                  <button 
                    *ngFor="let r of msg.reactions" 
                    class="reaction-chip"
                    (click)="toggleReaction(r.emoji, msg.message_id)"
                    [class.own-reaction]="r.hasReacted"
                    [matTooltip]="getReactorTooltip(r)"
                    matTooltipPosition="above"
                  >
                    <span class="reaction-emoji">{{ r.emoji }}</span>
                    <span class="reaction-count">{{ r.count }}</span>
                  </button>
                </div>
              </div>
              </div>
            </ng-template>
          </ng-container>
        </div>

        <div *ngIf="!isRemovedFromGroup && messages.length === 0 && !loading" class="empty-chat">
          <mat-icon>chat_bubble_outline</mat-icon>
          <p>No messages yet. Say hello!</p>
        </div>
      </div>

      <div
        *ngIf="messageContextMenu as menu"
        class="message-context-menu"
        [style.left.px]="menu.x"
        [style.top.px]="menu.y"
        (click)="$event.stopPropagation()"
        (contextmenu)="$event.preventDefault()"
      >
        <ng-container *ngIf="!menu.confirmDelete; else deleteConfirmMenu">
          <button
            *ngIf="canReplyMessage(menu.message)"
            type="button"
            class="context-menu-item"
            (click)="replyFromContextMenu()"
          >
            <mat-icon>reply</mat-icon>
            <span>Reply</span>
          </button>
          <button
            *ngIf="canEditMessage(menu.message)"
            type="button"
            class="context-menu-item"
            (click)="editFromContextMenu()"
          >
            <mat-icon>edit</mat-icon>
            <span>Edit</span>
          </button>
          <button
            *ngIf="canDeleteMessage(menu.message)"
            type="button"
            class="context-menu-item danger"
            (click)="requestDeleteFromContextMenu()"
          >
            <mat-icon>delete</mat-icon>
            <span>Delete</span>
          </button>
        </ng-container>
        <ng-template #deleteConfirmMenu>
          <div class="context-menu-confirm">
            <div class="confirm-title">Delete this message?</div>
            <div class="confirm-actions">
              <button type="button" class="confirm-cancel" (click)="closeMessageContextMenu()">Cancel</button>
              <button type="button" class="confirm-delete" (click)="confirmDeleteFromContextMenu()">Delete</button>
            </div>
          </div>
        </ng-template>
      </div>

      <app-message-input
        *ngIf="!isRemovedFromGroup"
        [conversationId]="conversationId"
        [replyTo]="replyToMessage ? getComposeReplyPreview(replyToMessage) : null"
        [enableMentions]="isGroup"
        [mentionOptions]="mentionOptions"
        (messageSent)="onSendMessage($event)"
        (messageWithFiles)="onSendWithFiles($event)"
        (replyCancelled)="clearReply()"
      ></app-message-input>
    </div>

  `, styles: [":host{--attachment-thumb-size: 180px}.chat-thread{display:flex;flex-direction:column;height:100%;background:#041322;position:relative;container-type:inline-size;--attachment-thumb-size: clamp(120px, 48cqw, 180px)}.chat-thread.drag-over{outline:2px dashed rgba(255,255,255,.45);outline-offset:-6px}.thread-drag-overlay{position:absolute;inset:8px;z-index:20;pointer-events:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:#fff;background:#1f4bd852;border:2px dashed rgba(255,255,255,.55);border-radius:14px;font-size:14px;font-weight:600}.thread-drag-overlay mat-icon{font-size:36px;width:36px;height:36px}.chat-header{display:flex;align-items:center;padding:8px 8px 8px 4px;border-bottom:1px solid rgba(255,255,255,.15);gap:4px;flex-shrink:0}.chat-header button mat-icon{color:#fffc}.chat-name{font-size:16px;font-weight:600;color:#fff}.header-info{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;padding:0 4px}.header-actions{display:flex;align-items:center;gap:0}.header-actions button{width:32px;height:32px;min-width:32px!important;padding:0!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;--mdc-icon-button-state-layer-size: 32px}.hdr-btn{border-radius:6px!important;transition:background .15s,box-shadow .15s}.hdr-btn:hover{background:#ffffff26!important;box-shadow:0 2px 8px #0003}.hdr-btn mat-icon{font-size:20px;width:20px;height:20px;line-height:20px;margin:0;display:flex;align-items:center;justify-content:center}:host ::ng-deep .hdr-btn .mat-mdc-button-touch-target{width:32px!important;height:32px!important}.messages-area{flex:1;overflow-y:auto;padding:12px;background:transparent;scrollbar-width:none;-ms-overflow-style:none}.messages-area::-webkit-scrollbar{display:none}.loading-indicator{display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;color:#ffffffb3;font-size:13px}.removed-group-state{height:100%;min-height:260px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:10px;padding:32px 24px;color:#ffffffc7;box-sizing:border-box}.removed-group-state mat-icon{width:44px;height:44px;font-size:44px;color:#f87171;margin-bottom:4px}.removed-group-state h4{margin:0;color:#fff;font-size:17px;font-weight:700}.removed-group-state p{margin:0 0 8px;max-width:280px;font-size:13px;line-height:1.4;color:#ffffff9e}.removed-exit-btn{border-radius:10px;background:#ffffff2e!important;color:#fff!important;font-weight:700;padding:0 18px}.load-more-btn{align-self:center;margin-bottom:16px;font-size:12px;color:#fff}.messages-list{display:flex;flex-direction:column;gap:1px;flex:1}.date-separator{text-align:center;margin:16px 0 8px;font-size:12px;color:#ffffffb3;font-weight:500}.message-bubble-row{display:flex;flex-direction:column;max-width:88%;margin-bottom:2px}.message-bubble-row.own{align-self:flex-end;align-items:flex-end}.message-bubble-row.other{align-self:flex-start;align-items:flex-start}.sender-name{font-size:11px;font-weight:700;color:#fffffff2;margin-bottom:3px;letter-spacing:.2px;padding:0 10px;text-shadow:0 1px 3px rgba(0,0,0,.4)}.system-message-row{align-self:center;max-width:88%;margin:8px auto;text-align:center}.system-message-text{display:inline-flex;align-items:center;justify-content:center;padding:5px 11px;border-radius:999px;background:#ffffff17;border:1px solid rgba(255,255,255,.12);color:#ffffffb8;font-size:11px;line-height:1.35}.message-bubble{padding:8px 14px 7px;border-radius:14px;font-size:calc(clamp(11px,3.4cqw,13px) * var(--message-text-scale, 1));line-height:1.32;word-break:break-word;color:#f5f7ff;position:relative;display:inline-block;min-width:fit-content}.message-bubble-row.other .message-bubble{background:#0d2540;border-bottom-left-radius:5px;box-shadow:0 1px 4px #0006}.message-bubble.own-bubble{background:#0a3d62;border-bottom-right-radius:5px;box-shadow:0 1px 4px #0006}.reply-context{display:flex;align-items:center;gap:7px;margin-bottom:7px;padding:7px 9px;border-radius:10px;background:#ffffff14;border-left:3px solid rgba(127,180,255,.78);max-width:min(68cqw,420px)}.reply-context mat-icon{color:#bfdbfe;font-size:16px;width:16px;height:16px;flex-shrink:0}.reply-context div{min-width:0}.reply-context span{display:block;color:#bfdbfe;font-size:11px;font-weight:700;margin-bottom:2px}.reply-context p{margin:0;color:#ffffffc7;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.text-content{white-space:pre-wrap;tab-size:4}.text-content.preformatted-text{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,Liberation Mono,monospace;font-size:calc(clamp(10px,3.1cqw,12px) * var(--code-text-scale, 1));line-height:1.45;overflow-x:auto;max-width:min(72cqw,520px);scrollbar-width:none;-ms-overflow-style:none}.text-content.preformatted-text::-webkit-scrollbar{display:none}.inline-edit-wrap{width:min(76cqw,520px);min-width:min(56cqw,260px)}.inline-edit-textarea{width:100%;min-height:72px;max-height:220px;box-sizing:border-box;border:1px solid rgba(255,255,255,.28);border-radius:10px;outline:none;resize:vertical;padding:9px 10px;background:#ffffff1a;color:#fff;font:inherit;line-height:1.35;white-space:pre-wrap}.inline-edit-textarea:focus{border-color:#bfdbfee6;box-shadow:0 0 0 2px #7fb4ff2e}.inline-edit-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:8px}.inline-edit-cancel,.inline-edit-save{border:0;border-radius:8px;padding:6px 10px;color:#f8fafc;cursor:pointer;font-size:12px;font-weight:700}.inline-edit-cancel{background:#ffffff1f}.inline-edit-save{background:#2563eb}.inline-edit-save:disabled{cursor:not-allowed;opacity:.45}.attachment-caption{margin-top:8px;width:var(--attachment-thumb-size);max-width:var(--attachment-thumb-size);box-sizing:border-box}.attachment-caption .text-content{white-space:pre-wrap;overflow-wrap:anywhere;max-width:100%}.attachment-render-block{width:100%;max-width:100%}.code-message-wrap{position:relative;max-width:min(76cqw,560px);border-radius:10px;overflow:hidden;border:1px solid rgba(255,255,255,.14);background:#061827}.render-copy-btn{position:absolute;top:6px;right:6px;z-index:2;width:26px;height:26px;border:none;border-radius:7px;display:inline-flex;align-items:center;justify-content:center;padding:0;background:#071d30d1;color:#ffffffc7;cursor:pointer;opacity:0;transition:opacity .12s,background .12s,color .12s}.code-message-wrap:hover .render-copy-btn,.table-message-wrap:hover .render-copy-btn,.md-message-wrap:hover .render-copy-btn,.render-copy-btn:focus{opacity:1}.render-copy-btn:hover{background:#7fb4ff38;color:#fff}.render-copy-btn mat-icon{font-size:16px;width:16px;height:16px;line-height:16px}.code-message{margin:0;padding:12px 42px 28px 12px;overflow-x:auto;color:#dbeafe;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,Liberation Mono,monospace;font-size:calc(clamp(10px,3.1cqw,12px) * var(--code-text-scale, 1));line-height:1.45;white-space:pre;tab-size:2;scrollbar-width:none;-ms-overflow-style:none}.code-message::-webkit-scrollbar{display:none}.code-language{position:absolute;right:8px;bottom:6px;padding:2px 7px;border-radius:999px;background:#7fb4ff29;color:#bfdbfe;font-size:10px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;pointer-events:none}.md-language{position:absolute;right:8px;bottom:6px;padding:2px 7px;border-radius:999px;background:#86efac24;color:#bbf7d0;font-size:10px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;pointer-events:none}:host ::ng-deep .code-token-keyword{color:#93c5fd;font-weight:700}:host ::ng-deep .code-token-string{color:#86efac}:host ::ng-deep .code-token-number{color:#fbbf24}:host ::ng-deep .code-token-comment{color:#94a3b8;font-style:italic}:host ::ng-deep .code-token-function{color:#c4b5fd}.table-message-wrap{position:relative;max-width:min(76cqw,560px);overflow-x:auto;border-radius:9px;border:1px solid rgba(255,255,255,.16);background:#ffffff0a;scrollbar-width:none;-ms-overflow-style:none}.table-message-wrap::-webkit-scrollbar{display:none}.pasted-table{border-collapse:collapse;min-width:100%;font-size:calc(clamp(10px,3.1cqw,12px) * var(--code-text-scale, 1));line-height:1.35;color:#f5f7ff}.pasted-table th,.pasted-table td{padding:6px 9px;border-right:1px solid rgba(255,255,255,.12);border-bottom:1px solid rgba(255,255,255,.12);text-align:left;white-space:pre-wrap;vertical-align:top}.pasted-table th{background:#ffffff1a;font-weight:700}.pasted-table tr:last-child td,.pasted-table tr:last-child th{border-bottom:none}.pasted-table th:last-child,.pasted-table td:last-child{border-right:none}.md-message-wrap{position:relative;max-width:min(76cqw,560px);overflow-x:auto;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:#ffffff0d;scrollbar-width:none;-ms-overflow-style:none}.md-message-wrap::-webkit-scrollbar{display:none}.md-message{padding:10px 42px 28px 12px;color:#f5f7ff;font-size:calc(clamp(11px,3.4cqw,13px) * var(--message-text-scale, 1));line-height:1.45;overflow-wrap:anywhere}:host ::ng-deep .md-message h1,:host ::ng-deep .md-message h2,:host ::ng-deep .md-message h3{margin:8px 0 6px;color:#fff;line-height:1.25}:host ::ng-deep .md-message h1{font-size:18px}:host ::ng-deep .md-message h2{font-size:16px}:host ::ng-deep .md-message h3{font-size:14px}:host ::ng-deep .md-message p{margin:6px 0}:host ::ng-deep .md-message ul,:host ::ng-deep .md-message ol{margin:6px 0;padding-left:20px}:host ::ng-deep .md-message blockquote{margin:8px 0;padding-left:10px;border-left:3px solid rgba(127,180,255,.55);color:#ffffffc7}:host ::ng-deep .md-message code{padding:1px 5px;border-radius:5px;background:#00000040;color:#bfdbfe;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,Liberation Mono,monospace;font-size:12px}:host ::ng-deep .md-message pre{margin:8px 0;padding:9px;border-radius:8px;overflow-x:auto;background:#061827;scrollbar-width:none;-ms-overflow-style:none}:host ::ng-deep .md-message pre::-webkit-scrollbar{display:none}:host ::ng-deep .md-message pre code{padding:0;background:transparent;color:#dbeafe;white-space:pre}.image-message{line-height:0}.media-wrapper{position:relative;display:inline-block;line-height:0;width:var(--attachment-thumb-size);height:var(--attachment-thumb-size);overflow:hidden;border-radius:10px;background:#ffffff14}.media-img{width:100%;height:100%;border-radius:inherit;display:block;cursor:zoom-in;object-fit:cover}.attachment-actions{position:absolute;right:6px;top:6px;display:flex;gap:4px;opacity:0;transition:opacity .12s ease;pointer-events:none}.media-wrapper:hover .attachment-actions{opacity:1;pointer-events:auto}.attachment-action-btn,.file-download-btn{border:none;border-radius:999px;background:#071d30d1;color:#fff;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0}.attachment-action-btn{width:28px;height:28px}.attachment-action-btn mat-icon{font-size:17px;width:17px;height:17px}.media-video{max-width:240px;max-height:260px;border-radius:10px;display:block;background:#000}.video-message{display:flex;flex-direction:column;gap:6px}.video-download{color:#ffffffc7;font-size:12px;text-decoration:underline;text-underline-offset:2px}.media-placeholder{display:flex;align-items:center;justify-content:center;gap:8px;width:var(--attachment-thumb-size);height:var(--attachment-thumb-size);border-radius:10px;background:#ffffff14;color:#fff9;font-size:11px}.media-load-label{font-size:11px;color:#fff9}.attachments-list{display:flex;flex-direction:column;gap:8px;max-width:100%}.attachment-item{max-width:100%}.file-message{display:flex;align-items:center;gap:8px;padding:4px 0}.attachment-thumb.file-message{position:relative;width:var(--attachment-thumb-size);height:var(--attachment-thumb-size);padding:12px;border-radius:10px;background:#ffffff14;flex-direction:column;justify-content:center;box-sizing:border-box;overflow:hidden}.file-download{display:inline-flex;align-items:center;gap:8px;color:#fff;text-decoration:none;max-width:240px}.file-msg-icon{font-size:42px;width:42px;height:42px;color:#fffc;flex-shrink:0}.file-msg-name{font-size:13px;color:#fff;line-height:1.2;max-width:100%;overflow:hidden;text-align:center;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;word-break:break-word}.file-download-icon{font-size:18px;width:18px;height:18px;color:#ffffffb3;flex-shrink:0}.file-download-btn{width:24px;height:24px;flex-shrink:0;position:absolute;right:6px;top:6px}.file-download-link{border:none;border-radius:999px;background:#ffffff29;color:#fff;cursor:pointer;font-size:11px;padding:4px 10px;margin-top:4px}.message-meta{display:flex;align-items:center;gap:4px;margin-top:3px}.msg-time{font-size:10px;color:#dae0faa8}.message-bubble-row.other .msg-time{color:#d8dff694}.edited-label{font-size:10px;font-style:italic;color:#dae0fa9e}.read-icon{font-size:14px;width:14px;height:14px;opacity:.7}.read-icon.read{color:#60a5fa;opacity:1}.read-icon.unread{color:#dae0fa80;opacity:1}.reply-message-btn{position:absolute;right:-10px;bottom:-10px;width:24px;height:24px;border:1px solid rgba(255,255,255,.16);border-radius:999px;background:#071d30;color:#ffffffc7;display:inline-flex;align-items:center;justify-content:center;padding:0;cursor:pointer;opacity:0;transform:scale(.92);transition:opacity .12s,transform .12s,background .12s,color .12s;z-index:3}.message-bubble:hover .reply-message-btn,.reply-message-btn:focus{opacity:1;transform:scale(1)}.reply-message-btn:hover{background:#7fb4ff38;color:#fff}.reply-message-btn mat-icon{font-size:15px;width:15px;height:15px;line-height:15px}.quick-reactions{position:absolute;top:-18px;right:0;display:flex;align-items:center;gap:4px;padding:3px 5px;background:#071d30;border:1px solid rgba(255,255,255,.14);border-radius:999px;box-shadow:0 6px 14px #00000047;z-index:4}.message-bubble-row.other .quick-reactions{left:0;right:auto}.message-bubble-row.own .quick-reactions{left:auto;right:0}.quick-emoji-btn{width:20px;height:20px;border:none;border-radius:999px;background:transparent;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:13px;line-height:1;cursor:pointer;padding:0;transition:transform .12s ease,background .12s ease}.quick-emoji-btn:hover{background:#ffffff2e;transform:scale(1.14)}.reactions-row{display:flex;flex-wrap:wrap;gap:3px;margin-top:5px}.reaction-chip{background:#ffffff14;border:1px solid rgba(255,255,255,.2);border-radius:999px;padding:2px 7px;font-size:11px;color:#f2f6ff;cursor:pointer;transition:all .2s;display:inline-flex;align-items:center;gap:3px;max-width:180px}.reaction-chip:hover{background:#ffffff40;transform:scale(1.05)}.reaction-chip.own-reaction{background:#2a5bff4d;border-color:#2a5bff80}.empty-chat{display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;color:#9ca3af}.empty-chat mat-icon{font-size:48px;width:48px;height:48px;margin-bottom:8px}.empty-chat p{font-size:14px;margin:0}.message-context-menu{position:absolute;z-index:10000;min-width:150px;padding:6px;border:1px solid rgba(255,255,255,.14);border-radius:12px;background:#07111efa;box-shadow:0 18px 45px #00000061;color:#f8fafc}.context-menu-item{width:100%;border:0;border-radius:9px;padding:9px 10px;background:transparent;color:inherit;display:flex;align-items:center;gap:9px;cursor:pointer;font-size:13px;text-align:left}.context-menu-item:hover{background:#ffffff17}.context-menu-item mat-icon{font-size:17px;width:17px;height:17px}.context-menu-item.danger{color:#fecaca}.context-menu-confirm{padding:8px;width:190px}.confirm-title{color:#f8fafc;font-size:13px;font-weight:600;margin-bottom:10px}.confirm-actions{display:flex;justify-content:flex-end;gap:8px}.confirm-cancel,.confirm-delete{border:0;border-radius:8px;padding:7px 10px;color:#f8fafc;cursor:pointer;font-size:12px}.confirm-cancel{background:#ffffff1f}.confirm-delete{background:#dc2626}\n"] }]
        }], ctorParameters: () => [{ type: MessagingStoreService }, { type: MessagingApiService }, { type: AuthService }, { type: MessagingFileService }, { type: i0.ChangeDetectorRef }, { type: i5.DomSanitizer }], propDecorators: { scrollContainer: [{
                type: ViewChild,
                args: ['scrollContainer']
            }], threadRoot: [{
                type: ViewChild,
                args: ['threadRoot']
            }], inlineEditTextareas: [{
                type: ViewChildren,
                args: ['inlineEditTextarea']
            }], messageInput: [{
                type: ViewChild,
                args: [MessageInputComponent]
            }], lightboxOpen: [{
                type: Output
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
  `, isInline: true, styles: [".new-conv-container{display:flex;flex-direction:column;height:100%}.header{display:flex;align-items:center;padding:12px 8px 12px 4px;border-bottom:1px solid rgba(255,255,255,.15);gap:4px}.header h3{margin:0;font-size:18px;font-weight:600;color:#fff}.hdr-btn{border-radius:6px!important;transition:background .15s,box-shadow .15s}.hdr-btn:hover{background:#ffffff26!important;box-shadow:0 2px 8px #0003}.hdr-btn mat-icon{color:#fffc}.search-bar{display:flex;align-items:center;margin:12px 16px;padding:8px 12px;background:#ffffff26;border-radius:10px}.search-icon{color:#fff9;font-size:20px;width:20px;height:20px;margin-right:8px}.search-input{flex:1;border:none;outline:none;background:transparent;font-size:14px;color:#fff}.search-input::placeholder{color:#fff9}.contacts-list{flex:1;overflow-y:auto}.contact-item{display:flex;align-items:center;padding:10px 16px;cursor:pointer;transition:background .15s;gap:12px}.contact-item:hover{background:#ffffff1a}.contact-avatar{width:40px;height:40px;border-radius:50%;background:#0d2540;display:flex;align-items:center;justify-content:center;flex-shrink:0}.contact-avatar mat-icon{color:#ffffffb3}.contact-info{display:flex;flex-direction:column}.contact-name{font-weight:500;font-size:14px;color:#fff}.contact-company{font-size:12px;color:#ffffffb3}.empty-state{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 24px;color:#fff9}.empty-state mat-icon{font-size:48px;width:48px;height:48px;margin-bottom:12px}.empty-state p{font-size:14px;margin:0}\n"], dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i1$1.NgForOf, selector: "[ngFor][ngForOf]", inputs: ["ngForOf", "ngForTrackBy", "ngForTemplate"] }, { kind: "directive", type: i1$1.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "ngmodule", type: FormsModule }, { kind: "directive", type: i3.DefaultValueAccessor, selector: "input:not([type=checkbox])[formControlName],textarea[formControlName],input:not([type=checkbox])[formControl],textarea[formControl],input:not([type=checkbox])[ngModel],textarea[ngModel],[ngDefaultControl]" }, { kind: "directive", type: i3.NgControlStatus, selector: "[formControlName],[ngModel],[formControl]" }, { kind: "directive", type: i3.NgModel, selector: "[ngModel]:not([formControlName]):not([formControl])", inputs: ["name", "disabled", "ngModel", "ngModelOptions"], outputs: ["ngModelChange"], exportAs: ["ngModel"] }, { kind: "ngmodule", type: MatIconModule }, { kind: "component", type: i4.MatIcon, selector: "mat-icon", inputs: ["color", "inline", "svgIcon", "fontSet", "fontIcon"], exportAs: ["matIcon"] }, { kind: "ngmodule", type: MatButtonModule }, { kind: "component", type: i6.MatIconButton, selector: "button[mat-icon-button]", exportAs: ["matButton"] }, { kind: "ngmodule", type: MatRippleModule }, { kind: "directive", type: i6$1.MatRipple, selector: "[mat-ripple], [matRipple]", inputs: ["matRippleColor", "matRippleUnbounded", "matRippleCentered", "matRippleRadius", "matRippleAnimation", "matRippleDisabled", "matRippleTrigger"], exportAs: ["matRipple"] }, { kind: "ngmodule", type: MatTooltipModule }, { kind: "directive", type: i7.MatTooltip, selector: "[matTooltip]", inputs: ["matTooltipPosition", "matTooltipPositionAtOrigin", "matTooltipDisabled", "matTooltipShowDelay", "matTooltipHideDelay", "matTooltipTouchGestures", "matTooltip", "matTooltipClass"], exportAs: ["matTooltip"] }] });
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
  `, styles: [".new-conv-container{display:flex;flex-direction:column;height:100%}.header{display:flex;align-items:center;padding:12px 8px 12px 4px;border-bottom:1px solid rgba(255,255,255,.15);gap:4px}.header h3{margin:0;font-size:18px;font-weight:600;color:#fff}.hdr-btn{border-radius:6px!important;transition:background .15s,box-shadow .15s}.hdr-btn:hover{background:#ffffff26!important;box-shadow:0 2px 8px #0003}.hdr-btn mat-icon{color:#fffc}.search-bar{display:flex;align-items:center;margin:12px 16px;padding:8px 12px;background:#ffffff26;border-radius:10px}.search-icon{color:#fff9;font-size:20px;width:20px;height:20px;margin-right:8px}.search-input{flex:1;border:none;outline:none;background:transparent;font-size:14px;color:#fff}.search-input::placeholder{color:#fff9}.contacts-list{flex:1;overflow-y:auto}.contact-item{display:flex;align-items:center;padding:10px 16px;cursor:pointer;transition:background .15s;gap:12px}.contact-item:hover{background:#ffffff1a}.contact-avatar{width:40px;height:40px;border-radius:50%;background:#0d2540;display:flex;align-items:center;justify-content:center;flex-shrink:0}.contact-avatar mat-icon{color:#ffffffb3}.contact-info{display:flex;flex-direction:column}.contact-name{font-weight:500;font-size:14px;color:#fff}.contact-company{font-size:12px;color:#ffffffb3}.empty-state{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 24px;color:#fff9}.empty-state mat-icon{font-size:48px;width:48px;height:48px;margin-bottom:12px}.empty-state p{font-size:14px;margin:0}\n"] }]
        }], ctorParameters: () => [{ type: MessagingStoreService }] });

class GroupManagerComponent {
    store;
    api;
    auth;
    contacts = [];
    selectedContacts = [];
    currentMembers = [];
    groupName = '';
    originalGroupName = '';
    searchQuery = '';
    isEditMode = false;
    editingConversationId = null;
    creatorContactId = null;
    loadingMembers = false;
    creatingGroup = false;
    deletingGroup = false;
    showDeleteConfirm = false;
    subs = [];
    constructor(store, api, auth) {
        this.store = store;
        this.api = api;
        this.auth = auth;
    }
    ngOnInit() {
        this.creatorContactId = this.auth.contactId;
        this.store.loadVisibleContacts();
        this.subs.push(this.store.visibleContacts.subscribe((c) => (this.contacts = c)));
        this.subs.push(this.store.groupSettings.subscribe((settings) => {
            if (settings) {
                this.isEditMode = true;
                this.editingConversationId = settings.conversationId;
                this.groupName = settings.name;
                this.originalGroupName = settings.name;
                this.selectedContacts = [];
                this.showDeleteConfirm = false;
                this.loadCurrentMembers(settings.conversationId);
            }
            else {
                this.isEditMode = false;
                this.editingConversationId = null;
                this.groupName = '';
                this.originalGroupName = '';
                this.selectedContacts = [];
                this.currentMembers = [];
                this.showDeleteConfirm = false;
            }
        }));
    }
    ngOnDestroy() {
        this.subs.forEach((s) => s.unsubscribe());
    }
    loadCurrentMembers(conversationId) {
        this.loadingMembers = true;
        this.api.getConversationParticipants(conversationId).subscribe({
            next: (members) => {
                this.currentMembers = members;
                this.loadingMembers = false;
            },
            error: () => {
                this.loadingMembers = false;
            },
        });
    }
    get filteredContacts() {
        const alreadyInGroup = new Set(this.currentMembers.map((m) => m.contact_id));
        let list = this.contacts.filter((c) => c.contact_id !== this.creatorContactId && !alreadyInGroup.has(c.contact_id));
        if (this.searchQuery.trim()) {
            const q = this.searchQuery.toLowerCase();
            list = list.filter((c) => this.getDisplayName(c).toLowerCase().includes(q) ||
                (c.company_name || '').toLowerCase().includes(q));
        }
        return list;
    }
    getDisplayName(contact) {
        return getContactDisplayName(contact);
    }
    getMemberName(member) {
        return member.username || member.email || `Contact ${member.contact_id}`;
    }
    get canSubmit() {
        if (this.creatingGroup)
            return false;
        if (!this.groupName.trim())
            return false;
        if (this.isEditMode) {
            return this.groupName.trim() !== this.originalGroupName || this.selectedContacts.length > 0;
        }
        return this.selectedContacts.length >= 1;
    }
    isSelected(contact) {
        return this.selectedContacts.some((c) => c.contact_id === contact.contact_id);
    }
    toggleContact(contact) {
        if (this.isSelected(contact)) {
            this.removeContact(contact);
        }
        else {
            this.selectedContacts = [...this.selectedContacts, contact];
        }
    }
    removeContact(contact) {
        this.selectedContacts = this.selectedContacts.filter((c) => c.contact_id !== contact.contact_id);
    }
    removeMember(member) {
        if (!this.editingConversationId)
            return;
        if (confirm(`Remove ${this.getMemberName(member)} from this group?`)) {
            this.store.manageGroup('remove', this.editingConversationId, undefined, [member.contact_id], {
                success: () => {
                    this.currentMembers = this.currentMembers.filter(m => m.contact_id !== member.contact_id);
                },
            });
        }
    }
    onSubmit() {
        if (!this.canSubmit)
            return;
        if (this.isEditMode && this.editingConversationId) {
            if (this.groupName.trim() !== this.originalGroupName) {
                this.store.manageGroup('rename', this.editingConversationId, this.groupName.trim());
            }
            if (this.selectedContacts.length > 0) {
                const ids = this.selectedContacts.map((c) => c.contact_id);
                this.store.manageGroup('add', this.editingConversationId, undefined, ids);
            }
            this.store.clearGroupSettings();
            this.store.setView('chat');
        }
        else {
            this.creatingGroup = true;
            const ids = this.selectedContacts.map((c) => c.contact_id);
            this.store.createGroupConversation(ids, this.groupName.trim(), {
                error: () => {
                    this.creatingGroup = false;
                },
            });
        }
    }
    requestDeleteGroup() {
        if (!this.editingConversationId || this.deletingGroup)
            return;
        this.showDeleteConfirm = true;
    }
    cancelDeleteGroup() {
        if (this.deletingGroup)
            return;
        this.showDeleteConfirm = false;
    }
    confirmDeleteGroup() {
        if (this.editingConversationId && !this.deletingGroup) {
            this.deletingGroup = true;
            this.store.deleteGroup(this.editingConversationId, {
                error: () => {
                    this.deletingGroup = false;
                    this.showDeleteConfirm = false;
                },
            });
        }
    }
    goBack() {
        if (this.isEditMode) {
            this.store.clearGroupSettings();
            this.store.setView('chat');
        }
        else {
            this.store.setView('inbox');
        }
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: GroupManagerComponent, deps: [{ token: MessagingStoreService }, { token: MessagingApiService }, { token: AuthService }], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "17.3.12", type: GroupManagerComponent, isStandalone: true, selector: "app-group-manager", ngImport: i0, template: `
    <div class="group-manager">
      <div class="header">
        <button mat-icon-button class="hdr-btn" (click)="goBack()" matTooltip="Back" matTooltipPosition="below">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <h3>{{ isEditMode ? 'Group Settings' : 'Create Group' }}</h3>
      </div>

      <div class="scrollable">
        <div class="form-section">
          <label class="field-label">Group Name</label>
          <input
            type="text"
            [(ngModel)]="groupName"
            placeholder="Enter group name..."
            class="text-field"
          />
        </div>

        <ng-container *ngIf="isEditMode">
          <div class="form-section section-gap">
            <label class="field-label">Current Members</label>
            <div *ngIf="loadingMembers" class="loading-row">
              <mat-spinner diameter="18"></mat-spinner>
              <span>Loading members...</span>
            </div>
            <div *ngIf="!loadingMembers" class="members-list">
              <div *ngFor="let m of currentMembers" class="member-row">
                <div class="member-avatar"><mat-icon>person</mat-icon></div>
                <div class="member-info">
                  <span class="member-name">{{ getMemberName(m) }}{{ m.contact_id === creatorContactId ? ' (you)' : '' }}</span>
                  <span class="member-sub">{{ m.company || m.email }}</span>
                </div>
                <button 
                  *ngIf="m.contact_id !== creatorContactId" 
                  mat-icon-button 
                  class="remove-member-btn"
                  (click)="removeMember(m)"
                  matTooltip="Remove from group"
                  matTooltipPosition="left"
                >
                  <mat-icon>person_remove</mat-icon>
                </button>
              </div>
              <div *ngIf="currentMembers.length === 0" class="empty-members">No members found</div>
            </div>
          </div>

          <div class="form-section section-gap">
            <label class="field-label">Add Members</label>
            <div class="search-bar">
              <mat-icon class="search-icon">search</mat-icon>
              <input type="text" [(ngModel)]="searchQuery" placeholder="Search contacts..." class="search-input" />
            </div>
          </div>
        </ng-container>

        <ng-container *ngIf="!isEditMode">
          <div class="form-section section-gap">
            <label class="field-label">Add Members (min 1 other person)</label>
            <div class="search-bar">
              <mat-icon class="search-icon">search</mat-icon>
              <input type="text" [(ngModel)]="searchQuery" placeholder="Search contacts..." class="search-input" />
            </div>
          </div>
        </ng-container>

        <div *ngIf="selectedContacts.length > 0" class="selected-chips">
          <div *ngFor="let c of selectedContacts" class="chip">
            <span>{{ getDisplayName(c) }}</span>
            <button mat-icon-button class="chip-remove" (click)="removeContact(c)">
              <mat-icon>close</mat-icon>
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
      </div>

      <div class="action-bar">
        <button
          mat-raised-button
          [disabled]="!canSubmit"
          (click)="onSubmit()"
          class="create-btn"
        >
          <mat-icon>{{ isEditMode ? 'save' : 'group_add' }}</mat-icon>
          <ng-container *ngIf="!isEditMode && !creatingGroup">Create Group ({{ selectedContacts.length + 1 }} members)</ng-container>
          <ng-container *ngIf="!isEditMode && creatingGroup">Creating group...</ng-container>
          <ng-container *ngIf="isEditMode">Save Changes</ng-container>
        </button>
        <button
          *ngIf="isEditMode"
          mat-stroked-button
          class="delete-btn"
          [disabled]="deletingGroup"
          (click)="requestDeleteGroup()"
        >
          <mat-icon>logout</mat-icon>
          {{ deletingGroup ? 'Exiting group...' : 'Exit Group' }}
        </button>
      </div>

      <div *ngIf="showDeleteConfirm" class="confirm-overlay">
        <div class="confirm-card">
          <div class="confirm-icon">
            <mat-icon>warning</mat-icon>
          </div>
          <div class="confirm-copy">
            <h4>Exit group?</h4>
            <p>Are you sure you want to exit "{{ groupName.trim() || 'this group' }}"?</p>
          </div>
          <div class="confirm-actions">
            <button mat-stroked-button class="confirm-cancel" [disabled]="deletingGroup" (click)="cancelDeleteGroup()">
              Cancel
            </button>
            <button mat-raised-button class="confirm-delete" [disabled]="deletingGroup" (click)="confirmDeleteGroup()">
              <mat-icon>logout</mat-icon>
              {{ deletingGroup ? 'Exiting...' : 'Exit Group' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `, isInline: true, styles: [".group-manager{display:flex;flex-direction:column;height:100%;position:relative}.header{display:flex;align-items:center;padding:12px 8px 12px 4px;border-bottom:1px solid rgba(255,255,255,.15);gap:4px;flex-shrink:0}.header h3{margin:0;font-size:18px;font-weight:600;color:#fff}.hdr-btn{border-radius:6px!important;transition:background .15s,box-shadow .15s}.hdr-btn:hover{background:#ffffff26!important;box-shadow:0 2px 8px #0003}.hdr-btn mat-icon{color:#fffc}.scrollable{flex:1;overflow-y:auto}.form-section{padding:12px 16px 0}.section-gap{padding-top:16px}.field-label{display:block;font-size:12px;font-weight:600;color:#ffffffb3;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px}.text-field{width:100%;padding:10px 12px;border:1px solid rgba(255,255,255,.25);border-radius:8px;font-size:14px;color:#fff;background:#ffffff1a;outline:none;transition:border-color .2s;box-sizing:border-box}.text-field:focus{border-color:#ffffff80}.text-field::placeholder{color:#ffffff80}.loading-row{display:flex;align-items:center;gap:8px;color:#fff9;font-size:13px;padding:8px 0}.members-list{border-radius:8px;overflow:hidden}.member-row{display:flex;align-items:center;padding:8px 12px;gap:10px;background:#ffffff12;border-bottom:1px solid rgba(255,255,255,.06)}.member-row:last-child{border-bottom:none}.member-avatar{width:30px;height:30px;border-radius:50%;background:#fff3;display:flex;align-items:center;justify-content:center;flex-shrink:0}.member-avatar mat-icon{color:#fff;font-size:18px}.member-info{display:flex;flex-direction:column}.member-name{font-size:13px;font-weight:500;color:#fff}.member-sub{font-size:11px;color:#ffffff80}.remove-member-btn{margin-left:auto;color:#fff9!important}.remove-member-btn:hover{color:#f87171!important;background:#f871711a!important}.empty-members{font-size:13px;color:#ffffff80;padding:8px 0}.search-bar{display:flex;align-items:center;padding:8px 12px;background:#ffffff1a;border-radius:10px}.search-icon{color:#fff9;font-size:20px;width:20px;height:20px;margin-right:8px}.search-input{flex:1;border:none;outline:none;background:transparent;font-size:14px;color:#fff}.search-input::placeholder{color:#ffffff80}.selected-chips{display:flex;flex-wrap:wrap;gap:6px;padding:8px 16px}.chip{display:flex;align-items:center;background:#fff3;color:#fff;border-radius:16px;padding:4px 6px 4px 12px;font-size:12px;font-weight:500}.chip-remove{width:20px!important;height:20px!important;line-height:20px!important}.chip-remove mat-icon{font-size:14px;width:14px;height:14px;color:#fffc}.contacts-list{padding-top:4px}.contact-item{display:flex;align-items:center;padding:10px 16px;cursor:pointer;transition:background .15s;gap:12px}.contact-item:hover{background:#ffffff14}.contact-item.selected{background:#ffffff26}.contact-avatar{width:36px;height:36px;border-radius:50%;background:#fff3;display:flex;align-items:center;justify-content:center;flex-shrink:0}.contact-avatar mat-icon{color:#fff;font-size:20px}.contact-info{flex:1;display:flex;flex-direction:column}.contact-name{font-weight:500;font-size:14px;color:#fff}.contact-company{font-size:12px;color:#fff9}.check-icon{color:#22c55e;font-size:22px}.action-bar{padding:12px 16px;border-top:1px solid rgba(255,255,255,.1);display:flex;flex-direction:column;gap:8px;flex-shrink:0}.create-btn{width:100%;background:#fff3!important;color:#fff!important;border-radius:10px;font-weight:600}.create-btn:disabled{opacity:.5}.create-btn mat-icon{margin-right:8px}.delete-btn{width:100%;color:#f87171!important;border-color:#f8717166!important;border-radius:10px;font-weight:600}.delete-btn mat-icon{margin-right:8px}.confirm-overlay{position:absolute;inset:0;z-index:10;display:flex;align-items:flex-end;padding:16px;background:#0413229e;-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);box-sizing:border-box}.confirm-card{width:100%;padding:16px;border-radius:14px;background:#0c1f35;border:1px solid rgba(255,255,255,.14);box-shadow:0 16px 40px #00000073;color:#fff}.confirm-icon{width:36px;height:36px;border-radius:50%;background:#f8717124;display:flex;align-items:center;justify-content:center;margin-bottom:10px}.confirm-icon mat-icon{color:#f87171}.confirm-copy h4{margin:0 0 6px;font-size:16px;font-weight:700}.confirm-copy p{margin:0;color:#ffffffb3;font-size:13px;line-height:1.4}.confirm-actions{display:flex;gap:8px;margin-top:16px}.confirm-cancel,.confirm-delete{flex:1;border-radius:10px;font-weight:600}.confirm-cancel{color:#fff!important;border-color:#ffffff40!important}.confirm-delete{background:#dc2626e6!important;color:#fff!important}.confirm-delete mat-icon{margin-right:6px;font-size:18px;width:18px;height:18px}\n"], dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i1$1.NgForOf, selector: "[ngFor][ngForOf]", inputs: ["ngForOf", "ngForTrackBy", "ngForTemplate"] }, { kind: "directive", type: i1$1.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "ngmodule", type: FormsModule }, { kind: "directive", type: i3.DefaultValueAccessor, selector: "input:not([type=checkbox])[formControlName],textarea[formControlName],input:not([type=checkbox])[formControl],textarea[formControl],input:not([type=checkbox])[ngModel],textarea[ngModel],[ngDefaultControl]" }, { kind: "directive", type: i3.NgControlStatus, selector: "[formControlName],[ngModel],[formControl]" }, { kind: "directive", type: i3.NgModel, selector: "[ngModel]:not([formControlName]):not([formControl])", inputs: ["name", "disabled", "ngModel", "ngModelOptions"], outputs: ["ngModelChange"], exportAs: ["ngModel"] }, { kind: "ngmodule", type: MatIconModule }, { kind: "component", type: i4.MatIcon, selector: "mat-icon", inputs: ["color", "inline", "svgIcon", "fontSet", "fontIcon"], exportAs: ["matIcon"] }, { kind: "ngmodule", type: MatButtonModule }, { kind: "component", type: i6.MatButton, selector: "    button[mat-button], button[mat-raised-button], button[mat-flat-button],    button[mat-stroked-button]  ", exportAs: ["matButton"] }, { kind: "component", type: i6.MatIconButton, selector: "button[mat-icon-button]", exportAs: ["matButton"] }, { kind: "ngmodule", type: MatRippleModule }, { kind: "directive", type: i6$1.MatRipple, selector: "[mat-ripple], [matRipple]", inputs: ["matRippleColor", "matRippleUnbounded", "matRippleCentered", "matRippleRadius", "matRippleAnimation", "matRippleDisabled", "matRippleTrigger"], exportAs: ["matRipple"] }, { kind: "ngmodule", type: MatTooltipModule }, { kind: "directive", type: i7.MatTooltip, selector: "[matTooltip]", inputs: ["matTooltipPosition", "matTooltipPositionAtOrigin", "matTooltipDisabled", "matTooltipShowDelay", "matTooltipHideDelay", "matTooltipTouchGestures", "matTooltip", "matTooltipClass"], exportAs: ["matTooltip"] }, { kind: "ngmodule", type: MatProgressSpinnerModule }, { kind: "component", type: i9.MatProgressSpinner, selector: "mat-progress-spinner, mat-spinner", inputs: ["color", "mode", "value", "diameter", "strokeWidth"], exportAs: ["matProgressSpinner"] }] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: GroupManagerComponent, decorators: [{
            type: Component,
            args: [{ selector: 'app-group-manager', standalone: true, imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatRippleModule, MatTooltipModule, MatProgressSpinnerModule], template: `
    <div class="group-manager">
      <div class="header">
        <button mat-icon-button class="hdr-btn" (click)="goBack()" matTooltip="Back" matTooltipPosition="below">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <h3>{{ isEditMode ? 'Group Settings' : 'Create Group' }}</h3>
      </div>

      <div class="scrollable">
        <div class="form-section">
          <label class="field-label">Group Name</label>
          <input
            type="text"
            [(ngModel)]="groupName"
            placeholder="Enter group name..."
            class="text-field"
          />
        </div>

        <ng-container *ngIf="isEditMode">
          <div class="form-section section-gap">
            <label class="field-label">Current Members</label>
            <div *ngIf="loadingMembers" class="loading-row">
              <mat-spinner diameter="18"></mat-spinner>
              <span>Loading members...</span>
            </div>
            <div *ngIf="!loadingMembers" class="members-list">
              <div *ngFor="let m of currentMembers" class="member-row">
                <div class="member-avatar"><mat-icon>person</mat-icon></div>
                <div class="member-info">
                  <span class="member-name">{{ getMemberName(m) }}{{ m.contact_id === creatorContactId ? ' (you)' : '' }}</span>
                  <span class="member-sub">{{ m.company || m.email }}</span>
                </div>
                <button 
                  *ngIf="m.contact_id !== creatorContactId" 
                  mat-icon-button 
                  class="remove-member-btn"
                  (click)="removeMember(m)"
                  matTooltip="Remove from group"
                  matTooltipPosition="left"
                >
                  <mat-icon>person_remove</mat-icon>
                </button>
              </div>
              <div *ngIf="currentMembers.length === 0" class="empty-members">No members found</div>
            </div>
          </div>

          <div class="form-section section-gap">
            <label class="field-label">Add Members</label>
            <div class="search-bar">
              <mat-icon class="search-icon">search</mat-icon>
              <input type="text" [(ngModel)]="searchQuery" placeholder="Search contacts..." class="search-input" />
            </div>
          </div>
        </ng-container>

        <ng-container *ngIf="!isEditMode">
          <div class="form-section section-gap">
            <label class="field-label">Add Members (min 1 other person)</label>
            <div class="search-bar">
              <mat-icon class="search-icon">search</mat-icon>
              <input type="text" [(ngModel)]="searchQuery" placeholder="Search contacts..." class="search-input" />
            </div>
          </div>
        </ng-container>

        <div *ngIf="selectedContacts.length > 0" class="selected-chips">
          <div *ngFor="let c of selectedContacts" class="chip">
            <span>{{ getDisplayName(c) }}</span>
            <button mat-icon-button class="chip-remove" (click)="removeContact(c)">
              <mat-icon>close</mat-icon>
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
      </div>

      <div class="action-bar">
        <button
          mat-raised-button
          [disabled]="!canSubmit"
          (click)="onSubmit()"
          class="create-btn"
        >
          <mat-icon>{{ isEditMode ? 'save' : 'group_add' }}</mat-icon>
          <ng-container *ngIf="!isEditMode && !creatingGroup">Create Group ({{ selectedContacts.length + 1 }} members)</ng-container>
          <ng-container *ngIf="!isEditMode && creatingGroup">Creating group...</ng-container>
          <ng-container *ngIf="isEditMode">Save Changes</ng-container>
        </button>
        <button
          *ngIf="isEditMode"
          mat-stroked-button
          class="delete-btn"
          [disabled]="deletingGroup"
          (click)="requestDeleteGroup()"
        >
          <mat-icon>logout</mat-icon>
          {{ deletingGroup ? 'Exiting group...' : 'Exit Group' }}
        </button>
      </div>

      <div *ngIf="showDeleteConfirm" class="confirm-overlay">
        <div class="confirm-card">
          <div class="confirm-icon">
            <mat-icon>warning</mat-icon>
          </div>
          <div class="confirm-copy">
            <h4>Exit group?</h4>
            <p>Are you sure you want to exit "{{ groupName.trim() || 'this group' }}"?</p>
          </div>
          <div class="confirm-actions">
            <button mat-stroked-button class="confirm-cancel" [disabled]="deletingGroup" (click)="cancelDeleteGroup()">
              Cancel
            </button>
            <button mat-raised-button class="confirm-delete" [disabled]="deletingGroup" (click)="confirmDeleteGroup()">
              <mat-icon>logout</mat-icon>
              {{ deletingGroup ? 'Exiting...' : 'Exit Group' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `, styles: [".group-manager{display:flex;flex-direction:column;height:100%;position:relative}.header{display:flex;align-items:center;padding:12px 8px 12px 4px;border-bottom:1px solid rgba(255,255,255,.15);gap:4px;flex-shrink:0}.header h3{margin:0;font-size:18px;font-weight:600;color:#fff}.hdr-btn{border-radius:6px!important;transition:background .15s,box-shadow .15s}.hdr-btn:hover{background:#ffffff26!important;box-shadow:0 2px 8px #0003}.hdr-btn mat-icon{color:#fffc}.scrollable{flex:1;overflow-y:auto}.form-section{padding:12px 16px 0}.section-gap{padding-top:16px}.field-label{display:block;font-size:12px;font-weight:600;color:#ffffffb3;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px}.text-field{width:100%;padding:10px 12px;border:1px solid rgba(255,255,255,.25);border-radius:8px;font-size:14px;color:#fff;background:#ffffff1a;outline:none;transition:border-color .2s;box-sizing:border-box}.text-field:focus{border-color:#ffffff80}.text-field::placeholder{color:#ffffff80}.loading-row{display:flex;align-items:center;gap:8px;color:#fff9;font-size:13px;padding:8px 0}.members-list{border-radius:8px;overflow:hidden}.member-row{display:flex;align-items:center;padding:8px 12px;gap:10px;background:#ffffff12;border-bottom:1px solid rgba(255,255,255,.06)}.member-row:last-child{border-bottom:none}.member-avatar{width:30px;height:30px;border-radius:50%;background:#fff3;display:flex;align-items:center;justify-content:center;flex-shrink:0}.member-avatar mat-icon{color:#fff;font-size:18px}.member-info{display:flex;flex-direction:column}.member-name{font-size:13px;font-weight:500;color:#fff}.member-sub{font-size:11px;color:#ffffff80}.remove-member-btn{margin-left:auto;color:#fff9!important}.remove-member-btn:hover{color:#f87171!important;background:#f871711a!important}.empty-members{font-size:13px;color:#ffffff80;padding:8px 0}.search-bar{display:flex;align-items:center;padding:8px 12px;background:#ffffff1a;border-radius:10px}.search-icon{color:#fff9;font-size:20px;width:20px;height:20px;margin-right:8px}.search-input{flex:1;border:none;outline:none;background:transparent;font-size:14px;color:#fff}.search-input::placeholder{color:#ffffff80}.selected-chips{display:flex;flex-wrap:wrap;gap:6px;padding:8px 16px}.chip{display:flex;align-items:center;background:#fff3;color:#fff;border-radius:16px;padding:4px 6px 4px 12px;font-size:12px;font-weight:500}.chip-remove{width:20px!important;height:20px!important;line-height:20px!important}.chip-remove mat-icon{font-size:14px;width:14px;height:14px;color:#fffc}.contacts-list{padding-top:4px}.contact-item{display:flex;align-items:center;padding:10px 16px;cursor:pointer;transition:background .15s;gap:12px}.contact-item:hover{background:#ffffff14}.contact-item.selected{background:#ffffff26}.contact-avatar{width:36px;height:36px;border-radius:50%;background:#fff3;display:flex;align-items:center;justify-content:center;flex-shrink:0}.contact-avatar mat-icon{color:#fff;font-size:20px}.contact-info{flex:1;display:flex;flex-direction:column}.contact-name{font-weight:500;font-size:14px;color:#fff}.contact-company{font-size:12px;color:#fff9}.check-icon{color:#22c55e;font-size:22px}.action-bar{padding:12px 16px;border-top:1px solid rgba(255,255,255,.1);display:flex;flex-direction:column;gap:8px;flex-shrink:0}.create-btn{width:100%;background:#fff3!important;color:#fff!important;border-radius:10px;font-weight:600}.create-btn:disabled{opacity:.5}.create-btn mat-icon{margin-right:8px}.delete-btn{width:100%;color:#f87171!important;border-color:#f8717166!important;border-radius:10px;font-weight:600}.delete-btn mat-icon{margin-right:8px}.confirm-overlay{position:absolute;inset:0;z-index:10;display:flex;align-items:flex-end;padding:16px;background:#0413229e;-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);box-sizing:border-box}.confirm-card{width:100%;padding:16px;border-radius:14px;background:#0c1f35;border:1px solid rgba(255,255,255,.14);box-shadow:0 16px 40px #00000073;color:#fff}.confirm-icon{width:36px;height:36px;border-radius:50%;background:#f8717124;display:flex;align-items:center;justify-content:center;margin-bottom:10px}.confirm-icon mat-icon{color:#f87171}.confirm-copy h4{margin:0 0 6px;font-size:16px;font-weight:700}.confirm-copy p{margin:0;color:#ffffffb3;font-size:13px;line-height:1.4}.confirm-actions{display:flex;gap:8px;margin-top:16px}.confirm-cancel,.confirm-delete{flex:1;border-radius:10px;font-weight:600}.confirm-cancel{color:#fff!important;border-color:#ffffff40!important}.confirm-delete{background:#dc2626e6!important;color:#fff!important}.confirm-delete mat-icon{margin-right:6px;font-size:18px;width:18px;height:18px}\n"] }]
        }], ctorParameters: () => [{ type: MessagingStoreService }, { type: MessagingApiService }, { type: AuthService }] });

class ChatPanelComponent {
    store;
    isOpen = false;
    activeView = 'inbox';
    wsStatus = 'disconnected';
    side = 'right';
    sidebarWidth = 400;
    toast = null;
    // ── Floating window state ──
    isFloating = false;
    floatX = 80;
    floatY = 80;
    floatWidth = 380;
    floatHeight = 540;
    defaultWidth = 400;
    resizing = false;
    resizeStartX = 0;
    resizeStartWidth = 0;
    boundResizeMove = this.onResizeMove.bind(this);
    boundResizeEnd = this.onResizeEnd.bind(this);
    // float drag
    floatDragging = false;
    floatDragOffX = 0;
    floatDragOffY = 0;
    boundFloatMove = this.onFloatDragMove.bind(this);
    boundFloatEnd = this.onFloatDragEnd.bind(this);
    // float resize
    floatResizing = false;
    floatResizeStartX = 0;
    floatResizeStartY = 0;
    floatResizeStartW = 0;
    floatResizeStartH = 0;
    boundFloatResizeMove = this.onFloatResizeMove.bind(this);
    boundFloatResizeEnd = this.onFloatResizeEnd.bind(this);
    sub;
    // ── Lightbox state ──
    lightboxUrl = null;
    lightboxDetached = false;
    lightboxX = 100;
    lightboxY = 80;
    lightboxW = 560;
    lightboxH = 460;
    lbDragging = false;
    lbDragOffX = 0;
    lbDragOffY = 0;
    lbResizing = false;
    lbResizeStartX = 0;
    lbResizeStartY = 0;
    lbResizeStartW = 0;
    lbResizeStartH = 0;
    boundLbMove = this.onLbDragMove.bind(this);
    boundLbEnd = this.onLbDragEnd.bind(this);
    boundLbResizeMove = this.onLbResizeMove.bind(this);
    boundLbResizeEnd = this.onLbResizeEnd.bind(this);
    constructor(store) {
        this.store = store;
    }
    ngOnInit() {
        this.side = this.store.getSidebarSide();
        const saved = localStorage.getItem('messaging_sidebar_width');
        if (saved)
            this.sidebarWidth = parseInt(saved, 10) || this.defaultWidth;
        const savedFloat = localStorage.getItem('messaging_float_state');
        if (savedFloat) {
            try {
                const f = JSON.parse(savedFloat);
                this.isFloating = f.isFloating ?? false;
                this.store.setPanelFloating(this.isFloating);
                this.floatX = f.x ?? 80;
                this.floatY = f.y ?? 80;
                this.floatWidth = f.w ?? 380;
                this.floatHeight = f.h ?? 540;
            }
            catch { }
        }
        this.sub = combineLatest([
            this.store.panelOpen,
            this.store.activeView,
            this.store.wsStatus,
            this.store.sidebarSide,
            this.store.toast,
        ]).subscribe(([open, view, ws, side, toast]) => {
            this.isOpen = open;
            this.activeView = view;
            this.wsStatus = ws;
            this.side = side;
            this.toast = toast;
        });
    }
    ngOnDestroy() {
        this.sub?.unsubscribe();
        document.removeEventListener('mousemove', this.boundResizeMove);
        document.removeEventListener('mouseup', this.boundResizeEnd);
        document.removeEventListener('mousemove', this.boundFloatMove);
        document.removeEventListener('mouseup', this.boundFloatEnd);
        document.removeEventListener('mousemove', this.boundFloatResizeMove);
        document.removeEventListener('mouseup', this.boundFloatResizeEnd);
        document.removeEventListener('mousemove', this.boundLbMove);
        document.removeEventListener('mouseup', this.boundLbEnd);
        document.removeEventListener('mousemove', this.boundLbResizeMove);
        document.removeEventListener('mouseup', this.boundLbResizeEnd);
    }
    // ── Lightbox ──
    openLightbox(url) {
        this.lightboxUrl = url;
        this.lightboxDetached = false;
    }
    onLightboxBackdropClick(event) {
        if (this.lightboxDetached)
            return;
        if (event.target !== event.currentTarget)
            return;
        this.lightboxUrl = null;
    }
    detachLightbox() {
        this.lightboxDetached = true;
        this.lightboxX = Math.max(20, Math.round((window.innerWidth - this.lightboxW) / 2));
        this.lightboxY = Math.max(20, Math.round((window.innerHeight - this.lightboxH) / 2));
    }
    onLbDragStart(event) {
        if (event.target.closest('button'))
            return;
        event.preventDefault();
        this.lbDragging = true;
        this.lbDragOffX = event.clientX - this.lightboxX;
        this.lbDragOffY = event.clientY - this.lightboxY;
        document.body.style.userSelect = 'none';
        document.addEventListener('mousemove', this.boundLbMove);
        document.addEventListener('mouseup', this.boundLbEnd);
    }
    onLbDragMove(event) {
        if (!this.lbDragging)
            return;
        this.lightboxX = Math.max(0, Math.min(event.clientX - this.lbDragOffX, window.innerWidth - this.lightboxW));
        this.lightboxY = Math.max(0, Math.min(event.clientY - this.lbDragOffY, window.innerHeight - 60));
    }
    onLbDragEnd() {
        if (!this.lbDragging)
            return;
        this.lbDragging = false;
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', this.boundLbMove);
        document.removeEventListener('mouseup', this.boundLbEnd);
    }
    onLbResizeStart(event) {
        event.preventDefault();
        event.stopPropagation();
        this.lbResizing = true;
        this.lbResizeStartX = event.clientX;
        this.lbResizeStartY = event.clientY;
        this.lbResizeStartW = this.lightboxW;
        this.lbResizeStartH = this.lightboxH;
        document.body.style.cursor = 'se-resize';
        document.body.style.userSelect = 'none';
        document.addEventListener('mousemove', this.boundLbResizeMove);
        document.addEventListener('mouseup', this.boundLbResizeEnd);
    }
    onLbResizeMove(event) {
        if (!this.lbResizing)
            return;
        this.lightboxW = Math.max(240, this.lbResizeStartW + (event.clientX - this.lbResizeStartX));
        this.lightboxH = Math.max(200, this.lbResizeStartH + (event.clientY - this.lbResizeStartY));
    }
    onLbResizeEnd() {
        if (!this.lbResizing)
            return;
        this.lbResizing = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', this.boundLbResizeMove);
        document.removeEventListener('mouseup', this.boundLbResizeEnd);
    }
    toggleSide() {
        this.store.toggleSidebarSide();
    }
    openNewConversation() {
        this.store.setView('new-conversation');
    }
    openGroupManager() {
        this.store.setView('group-manager');
    }
    getStatusTooltip() {
        if (this.wsStatus === 'authenticated')
            return 'Connected';
        if (this.wsStatus === 'connecting')
            return 'Connecting';
        return 'Disconnected';
    }
    close() {
        this.store.closePanel();
    }
    toggleFloat() {
        this.isFloating = !this.isFloating;
        this.store.setPanelFloating(this.isFloating);
        if (this.isFloating) {
            // Centre the float window on screen when first popping out
            this.floatX = Math.max(20, Math.round((window.innerWidth - this.floatWidth) / 2));
            this.floatY = Math.max(20, Math.round((window.innerHeight - this.floatHeight) / 2));
        }
        this.saveFloatState();
    }
    // ── Sidebar resize ──
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
    // ── Floating panel drag ──
    onFloatDragStart(event) {
        // Ignore if coming from a button inside the header
        if (event.target.closest('button'))
            return;
        event.preventDefault();
        this.floatDragging = true;
        this.floatDragOffX = event.clientX - this.floatX;
        this.floatDragOffY = event.clientY - this.floatY;
        document.body.style.userSelect = 'none';
        document.addEventListener('mousemove', this.boundFloatMove);
        document.addEventListener('mouseup', this.boundFloatEnd);
    }
    onFloatDragMove(event) {
        if (!this.floatDragging)
            return;
        this.floatX = Math.max(0, Math.min(event.clientX - this.floatDragOffX, window.innerWidth - this.floatWidth));
        this.floatY = Math.max(0, Math.min(event.clientY - this.floatDragOffY, window.innerHeight - 60));
    }
    onFloatDragEnd() {
        if (!this.floatDragging)
            return;
        this.floatDragging = false;
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', this.boundFloatMove);
        document.removeEventListener('mouseup', this.boundFloatEnd);
        this.saveFloatState();
    }
    // ── Floating panel resize (SE corner) ──
    onFloatResizeStart(event) {
        event.preventDefault();
        event.stopPropagation();
        this.floatResizing = true;
        this.floatResizeStartX = event.clientX;
        this.floatResizeStartY = event.clientY;
        this.floatResizeStartW = this.floatWidth;
        this.floatResizeStartH = this.floatHeight;
        document.body.style.cursor = 'se-resize';
        document.body.style.userSelect = 'none';
        document.addEventListener('mousemove', this.boundFloatResizeMove);
        document.addEventListener('mouseup', this.boundFloatResizeEnd);
    }
    onFloatResizeMove(event) {
        if (!this.floatResizing)
            return;
        this.floatWidth = Math.max(280, this.floatResizeStartW + (event.clientX - this.floatResizeStartX));
        this.floatHeight = Math.max(320, this.floatResizeStartH + (event.clientY - this.floatResizeStartY));
    }
    onFloatResizeEnd() {
        if (!this.floatResizing)
            return;
        this.floatResizing = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', this.boundFloatResizeMove);
        document.removeEventListener('mouseup', this.boundFloatResizeEnd);
        this.saveFloatState();
    }
    saveFloatState() {
        localStorage.setItem('messaging_float_state', JSON.stringify({
            isFloating: this.isFloating,
            x: this.floatX,
            y: this.floatY,
            w: this.floatWidth,
            h: this.floatHeight,
        }));
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: ChatPanelComponent, deps: [{ token: MessagingStoreService }], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "17.3.12", type: ChatPanelComponent, isStandalone: true, selector: "app-chat-panel", ngImport: i0, template: `
    <!-- Sidebar / Floating panel -->
    <div
      class="sidebar"
      [class.open]="isOpen"
      [class.side-left]="!isFloating && side === 'left'"
      [class.side-right]="!isFloating && side === 'right'"
      [class.floating]="isFloating"
      [style.width.px]="isFloating ? floatWidth : sidebarWidth"
      [style.height.px]="isFloating ? floatHeight : null"
      [style.left.px]="isFloating ? floatX : null"
      [style.top.px]="isFloating ? floatY : null"
    >
      <!-- Resize handle (sidebar mode only) -->
      <div
        *ngIf="!isFloating"
        class="resize-handle"
        [class.handle-left]="side === 'right'"
        [class.handle-right]="side === 'left'"
        (mousedown)="onResizeStart($event)"
      ></div>

      <!-- Sidebar header (acts as drag handle in floating mode) -->
      <div
        class="sidebar-header"
        [class.drag-handle]="isFloating"
        (mousedown)="isFloating && onFloatDragStart($event)"
      >
        <div class="header-left">
          <span
            class="status-dot"
            [class.connected]="wsStatus === 'authenticated'"
            [class.connecting]="wsStatus === 'connecting'"
            [class.disconnected]="wsStatus === 'disconnected'"
            [matTooltip]="getStatusTooltip()"
            matTooltipPosition="below"
          ></span>
          <span class="header-title">Messages</span>
        </div>
        <div class="header-actions">
          <button
            *ngIf="activeView === 'inbox'"
            mat-icon-button
            class="hdr-btn"
            (click)="openNewConversation()"
            matTooltip="New conversation"
            matTooltipPosition="below"
          >
            <mat-icon>edit_square</mat-icon>
          </button>
          <button
            *ngIf="activeView === 'inbox'"
            mat-icon-button
            class="hdr-btn"
            (click)="openGroupManager()"
            matTooltip="Create group"
            matTooltipPosition="below"
          >
            <mat-icon>group_add</mat-icon>
          </button>
          <!-- Side-swap (sidebar mode only) -->
          <button *ngIf="!isFloating" mat-icon-button class="hdr-btn" (click)="toggleSide()"
            [matTooltip]="'Move to ' + (side === 'right' ? 'left' : 'right')" matTooltipPosition="below">
            <mat-icon>{{ side === 'right' ? 'chevron_left' : 'chevron_right' }}</mat-icon>
          </button>
          <!-- Pop-out / dock toggle -->
          <button mat-icon-button class="hdr-btn"
            (click)="toggleFloat()"
            [matTooltip]="isFloating ? 'Dock to sidebar' : 'Pop out to floating window'"
            matTooltipPosition="below">
            <mat-icon>{{ isFloating ? 'picture_in_picture_alt' : 'open_in_new' }}</mat-icon>
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
        <app-chat-thread
          *ngIf="activeView === 'chat'"
          (lightboxOpen)="openLightbox($event)"
        ></app-chat-thread>
        <app-new-conversation *ngIf="activeView === 'new-conversation'"></app-new-conversation>
        <app-group-manager *ngIf="activeView === 'group-manager'"></app-group-manager>
      </div>

      <div *ngIf="toast" class="messaging-toast" [class.success]="toast.type === 'success'" [class.error]="toast.type === 'error'">
        <mat-icon>{{ toast.type === 'error' ? 'error' : toast.type === 'success' ? 'check_circle' : 'info' }}</mat-icon>
        <span>{{ toast.message }}</span>
      </div>

      <!-- Resize corner (floating mode only) -->
      <div *ngIf="isFloating" class="float-resize-corner" (mousedown)="onFloatResizeStart($event)"></div>
    </div>

    <!-- ── Lightbox: sibling of .sidebar so position:fixed is relative to viewport ── -->
    <div
      *ngIf="lightboxUrl"
      class="lb-overlay"
      [class.lb-detached]="lightboxDetached"
      [style.left.px]="lightboxDetached ? lightboxX : null"
      [style.top.px]="lightboxDetached ? lightboxY : null"
      [style.width.px]="lightboxDetached ? lightboxW : null"
      [style.height.px]="lightboxDetached ? lightboxH : null"
      (click)="onLightboxBackdropClick($event)"
    >
      <div *ngIf="lightboxDetached" class="lb-drag-bar" (mousedown)="onLbDragStart($event)">
        <span class="lb-drag-title">Image viewer</span>
        <div class="lb-drag-actions">
          <button type="button" class="lb-action-btn"
            (click)="$event.stopPropagation(); lightboxDetached = false" title="Fullscreen">
            <mat-icon>fullscreen</mat-icon>
          </button>
          <button type="button" class="lb-action-btn"
            (click)="$event.stopPropagation(); lightboxUrl = null; lightboxDetached = false" title="Close">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>
      <img [src]="lightboxUrl" class="lb-img" [class.lb-img-detached]="lightboxDetached"
           (click)="$event.stopPropagation()" />
      <ng-container *ngIf="!lightboxDetached">
        <button class="lb-close" (click)="lightboxUrl = null"><mat-icon>close</mat-icon></button>
        <button class="lb-detach-btn" (click)="detachLightbox()" title="Detach to floating window">
          <mat-icon>picture_in_picture</mat-icon>
        </button>
      </ng-container>
      <div *ngIf="lightboxDetached" class="lb-resize-corner" (mousedown)="onLbResizeStart($event)"></div>
    </div>
  `, isInline: true, styles: [".sidebar{position:fixed;top:0;bottom:0;width:400px;background:#041322;z-index:9999;display:flex;flex-direction:column;box-shadow:0 0 40px #0009;transition:transform .3s cubic-bezier(.4,0,.2,1);container-type:inline-size}.sidebar.side-right{right:0;transform:translate(100%)}.sidebar.side-left{left:0;transform:translate(-100%)}.sidebar.open.side-right,.sidebar.open.side-left{transform:translate(0)}.resize-handle{position:absolute;top:0;bottom:0;width:5px;cursor:ew-resize;z-index:1;transition:background .15s}.resize-handle:hover,.resize-handle:active{background:#ffffff26}.resize-handle.handle-left{left:0}.resize-handle.handle-right{right:0}.sidebar-header{display:flex;align-items:center;justify-content:space-between;padding:8px 10px 8px 14px;border-bottom:1px solid rgba(255,255,255,.15);flex-shrink:0;position:relative;z-index:2;min-height:48px}.header-left{display:flex;align-items:center;gap:8px;min-width:0;flex:1 1 auto}.header-title{font-size:clamp(11px,5cqw,16px);font-weight:700;color:#fff;letter-spacing:.3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.header-actions{display:flex;align-items:center;gap:0;flex-shrink:0}.btn-spacer{width:12px}.hdr-btn{width:32px;height:32px;min-width:32px;padding:0;display:inline-flex;align-items:center;justify-content:center;border-radius:6px!important;transition:background .15s,box-shadow .15s;--mdc-icon-button-state-layer-size: 32px}.hdr-btn .mat-mdc-button-touch-target{width:32px;height:32px}.hdr-btn:hover{background:#ffffff26!important;box-shadow:0 2px 8px #0003}.hdr-btn mat-icon{font-size:20px;color:#ffffffd9}@container (max-width: 330px){.sidebar-header{padding:8px 6px 8px 10px}.header-title{display:none}.header-left{flex:0 0 auto;gap:0}.btn-spacer{width:4px}.hdr-btn{width:28px;height:28px;min-width:28px;--mdc-icon-button-state-layer-size: 28px}.hdr-btn mat-icon{font-size:18px}}.sidebar-content{flex:1;overflow:hidden}.messaging-toast{position:absolute;left:16px;right:16px;bottom:16px;z-index:5;display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:10px;background:#192a3ff5;border:1px solid rgba(255,255,255,.14);box-shadow:0 10px 26px #00000059;color:#fff;font-size:13px;pointer-events:none}.messaging-toast.success{background:#14532df5;border-color:#22c55e66}.messaging-toast.error{background:#7f1d1df5;border-color:#f8717173}.messaging-toast mat-icon{font-size:18px;width:18px;height:18px}.status-dot{width:8px;height:8px;border-radius:50%;background:#fff6;flex-shrink:0}.status-dot.connected{background:#22c55e;box-shadow:0 0 0 3px #22c55e2e}.status-dot.connecting{background:#f59e0b;animation:blink 1s infinite}.status-dot.disconnected{background:#ef4444;box-shadow:0 0 0 3px #ef444424}@keyframes blink{50%{opacity:.3}}.sidebar.floating{position:fixed!important;right:unset!important;left:80px;top:80px;transform:none!important;border-radius:12px;overflow:hidden;resize:none;min-width:280px;min-height:320px}.sidebar.floating:not(.open){display:none}.drag-handle{cursor:grab;-webkit-user-select:none;user-select:none}.drag-handle:active{cursor:grabbing}.float-resize-corner{position:absolute;bottom:0;right:0;width:16px;height:16px;cursor:se-resize;background:linear-gradient(135deg,transparent 50%,rgba(255,255,255,.25) 50%);border-bottom-right-radius:12px}@media (max-width: 480px){.sidebar{width:100%!important}.resize-handle{display:none}}.lb-overlay{position:fixed;inset:0;background:#000000e0;display:flex;align-items:center;justify-content:center;z-index:99999;cursor:pointer}.lb-overlay.lb-detached{inset:unset;background:#0c1f35;border:1px solid rgba(255,255,255,.18);border-radius:12px;box-shadow:0 12px 48px #000000b3;display:flex;flex-direction:column;overflow:hidden;cursor:default;min-width:240px;min-height:200px}.lb-drag-bar{display:flex;align-items:center;justify-content:space-between;padding:6px 8px 6px 12px;background:#041322;border-bottom:1px solid rgba(255,255,255,.12);cursor:grab;flex-shrink:0;-webkit-user-select:none;user-select:none}.lb-drag-bar:active{cursor:grabbing}.lb-drag-title{font-size:12px;color:#fff9;letter-spacing:.4px}.lb-drag-actions{display:flex;gap:2px}.lb-action-btn{background:transparent;border:none;border-radius:6px;width:28px;height:28px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#ffffffb3;transition:background .15s}.lb-action-btn:hover{background:#ffffff26}.lb-action-btn mat-icon{font-size:16px;width:16px;height:16px}.lb-img{max-width:92vw;max-height:92vh;border-radius:8px;box-shadow:0 8px 40px #0009;cursor:default}.lb-img.lb-img-detached{max-width:100%;max-height:100%;border-radius:0;box-shadow:none;object-fit:contain;flex:1}.lb-close{position:absolute;top:16px;right:16px;background:#ffffff26;border:none;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#fff;transition:background .15s}.lb-close:hover{background:#ffffff4d}.lb-detach-btn{position:absolute;top:16px;right:60px;background:#ffffff26;border:none;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#fff;transition:background .15s}.lb-detach-btn:hover{background:#ffffff4d}.lb-resize-corner{position:absolute;bottom:0;right:0;width:16px;height:16px;cursor:se-resize;background:linear-gradient(135deg,transparent 50%,rgba(255,255,255,.2) 50%);border-bottom-right-radius:12px}\n"], dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i1$1.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "ngmodule", type: FormsModule }, { kind: "ngmodule", type: MatIconModule }, { kind: "component", type: i4.MatIcon, selector: "mat-icon", inputs: ["color", "inline", "svgIcon", "fontSet", "fontIcon"], exportAs: ["matIcon"] }, { kind: "ngmodule", type: MatButtonModule }, { kind: "component", type: i6.MatIconButton, selector: "button[mat-icon-button]", exportAs: ["matButton"] }, { kind: "ngmodule", type: MatTooltipModule }, { kind: "directive", type: i7.MatTooltip, selector: "[matTooltip]", inputs: ["matTooltipPosition", "matTooltipPositionAtOrigin", "matTooltipDisabled", "matTooltipShowDelay", "matTooltipHideDelay", "matTooltipTouchGestures", "matTooltip", "matTooltipClass"], exportAs: ["matTooltip"] }, { kind: "component", type: InboxListComponent, selector: "app-inbox-list" }, { kind: "component", type: ChatThreadComponent, selector: "app-chat-thread", outputs: ["lightboxOpen"] }, { kind: "component", type: NewConversationComponent, selector: "app-new-conversation" }, { kind: "component", type: GroupManagerComponent, selector: "app-group-manager" }] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: ChatPanelComponent, decorators: [{
            type: Component,
            args: [{ selector: 'app-chat-panel', standalone: true, imports: [
                        CommonModule, FormsModule, MatIconModule, MatButtonModule, MatTooltipModule,
                        InboxListComponent, ChatThreadComponent,
                        NewConversationComponent, GroupManagerComponent,
                    ], template: `
    <!-- Sidebar / Floating panel -->
    <div
      class="sidebar"
      [class.open]="isOpen"
      [class.side-left]="!isFloating && side === 'left'"
      [class.side-right]="!isFloating && side === 'right'"
      [class.floating]="isFloating"
      [style.width.px]="isFloating ? floatWidth : sidebarWidth"
      [style.height.px]="isFloating ? floatHeight : null"
      [style.left.px]="isFloating ? floatX : null"
      [style.top.px]="isFloating ? floatY : null"
    >
      <!-- Resize handle (sidebar mode only) -->
      <div
        *ngIf="!isFloating"
        class="resize-handle"
        [class.handle-left]="side === 'right'"
        [class.handle-right]="side === 'left'"
        (mousedown)="onResizeStart($event)"
      ></div>

      <!-- Sidebar header (acts as drag handle in floating mode) -->
      <div
        class="sidebar-header"
        [class.drag-handle]="isFloating"
        (mousedown)="isFloating && onFloatDragStart($event)"
      >
        <div class="header-left">
          <span
            class="status-dot"
            [class.connected]="wsStatus === 'authenticated'"
            [class.connecting]="wsStatus === 'connecting'"
            [class.disconnected]="wsStatus === 'disconnected'"
            [matTooltip]="getStatusTooltip()"
            matTooltipPosition="below"
          ></span>
          <span class="header-title">Messages</span>
        </div>
        <div class="header-actions">
          <button
            *ngIf="activeView === 'inbox'"
            mat-icon-button
            class="hdr-btn"
            (click)="openNewConversation()"
            matTooltip="New conversation"
            matTooltipPosition="below"
          >
            <mat-icon>edit_square</mat-icon>
          </button>
          <button
            *ngIf="activeView === 'inbox'"
            mat-icon-button
            class="hdr-btn"
            (click)="openGroupManager()"
            matTooltip="Create group"
            matTooltipPosition="below"
          >
            <mat-icon>group_add</mat-icon>
          </button>
          <!-- Side-swap (sidebar mode only) -->
          <button *ngIf="!isFloating" mat-icon-button class="hdr-btn" (click)="toggleSide()"
            [matTooltip]="'Move to ' + (side === 'right' ? 'left' : 'right')" matTooltipPosition="below">
            <mat-icon>{{ side === 'right' ? 'chevron_left' : 'chevron_right' }}</mat-icon>
          </button>
          <!-- Pop-out / dock toggle -->
          <button mat-icon-button class="hdr-btn"
            (click)="toggleFloat()"
            [matTooltip]="isFloating ? 'Dock to sidebar' : 'Pop out to floating window'"
            matTooltipPosition="below">
            <mat-icon>{{ isFloating ? 'picture_in_picture_alt' : 'open_in_new' }}</mat-icon>
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
        <app-chat-thread
          *ngIf="activeView === 'chat'"
          (lightboxOpen)="openLightbox($event)"
        ></app-chat-thread>
        <app-new-conversation *ngIf="activeView === 'new-conversation'"></app-new-conversation>
        <app-group-manager *ngIf="activeView === 'group-manager'"></app-group-manager>
      </div>

      <div *ngIf="toast" class="messaging-toast" [class.success]="toast.type === 'success'" [class.error]="toast.type === 'error'">
        <mat-icon>{{ toast.type === 'error' ? 'error' : toast.type === 'success' ? 'check_circle' : 'info' }}</mat-icon>
        <span>{{ toast.message }}</span>
      </div>

      <!-- Resize corner (floating mode only) -->
      <div *ngIf="isFloating" class="float-resize-corner" (mousedown)="onFloatResizeStart($event)"></div>
    </div>

    <!-- ── Lightbox: sibling of .sidebar so position:fixed is relative to viewport ── -->
    <div
      *ngIf="lightboxUrl"
      class="lb-overlay"
      [class.lb-detached]="lightboxDetached"
      [style.left.px]="lightboxDetached ? lightboxX : null"
      [style.top.px]="lightboxDetached ? lightboxY : null"
      [style.width.px]="lightboxDetached ? lightboxW : null"
      [style.height.px]="lightboxDetached ? lightboxH : null"
      (click)="onLightboxBackdropClick($event)"
    >
      <div *ngIf="lightboxDetached" class="lb-drag-bar" (mousedown)="onLbDragStart($event)">
        <span class="lb-drag-title">Image viewer</span>
        <div class="lb-drag-actions">
          <button type="button" class="lb-action-btn"
            (click)="$event.stopPropagation(); lightboxDetached = false" title="Fullscreen">
            <mat-icon>fullscreen</mat-icon>
          </button>
          <button type="button" class="lb-action-btn"
            (click)="$event.stopPropagation(); lightboxUrl = null; lightboxDetached = false" title="Close">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>
      <img [src]="lightboxUrl" class="lb-img" [class.lb-img-detached]="lightboxDetached"
           (click)="$event.stopPropagation()" />
      <ng-container *ngIf="!lightboxDetached">
        <button class="lb-close" (click)="lightboxUrl = null"><mat-icon>close</mat-icon></button>
        <button class="lb-detach-btn" (click)="detachLightbox()" title="Detach to floating window">
          <mat-icon>picture_in_picture</mat-icon>
        </button>
      </ng-container>
      <div *ngIf="lightboxDetached" class="lb-resize-corner" (mousedown)="onLbResizeStart($event)"></div>
    </div>
  `, styles: [".sidebar{position:fixed;top:0;bottom:0;width:400px;background:#041322;z-index:9999;display:flex;flex-direction:column;box-shadow:0 0 40px #0009;transition:transform .3s cubic-bezier(.4,0,.2,1);container-type:inline-size}.sidebar.side-right{right:0;transform:translate(100%)}.sidebar.side-left{left:0;transform:translate(-100%)}.sidebar.open.side-right,.sidebar.open.side-left{transform:translate(0)}.resize-handle{position:absolute;top:0;bottom:0;width:5px;cursor:ew-resize;z-index:1;transition:background .15s}.resize-handle:hover,.resize-handle:active{background:#ffffff26}.resize-handle.handle-left{left:0}.resize-handle.handle-right{right:0}.sidebar-header{display:flex;align-items:center;justify-content:space-between;padding:8px 10px 8px 14px;border-bottom:1px solid rgba(255,255,255,.15);flex-shrink:0;position:relative;z-index:2;min-height:48px}.header-left{display:flex;align-items:center;gap:8px;min-width:0;flex:1 1 auto}.header-title{font-size:clamp(11px,5cqw,16px);font-weight:700;color:#fff;letter-spacing:.3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.header-actions{display:flex;align-items:center;gap:0;flex-shrink:0}.btn-spacer{width:12px}.hdr-btn{width:32px;height:32px;min-width:32px;padding:0;display:inline-flex;align-items:center;justify-content:center;border-radius:6px!important;transition:background .15s,box-shadow .15s;--mdc-icon-button-state-layer-size: 32px}.hdr-btn .mat-mdc-button-touch-target{width:32px;height:32px}.hdr-btn:hover{background:#ffffff26!important;box-shadow:0 2px 8px #0003}.hdr-btn mat-icon{font-size:20px;color:#ffffffd9}@container (max-width: 330px){.sidebar-header{padding:8px 6px 8px 10px}.header-title{display:none}.header-left{flex:0 0 auto;gap:0}.btn-spacer{width:4px}.hdr-btn{width:28px;height:28px;min-width:28px;--mdc-icon-button-state-layer-size: 28px}.hdr-btn mat-icon{font-size:18px}}.sidebar-content{flex:1;overflow:hidden}.messaging-toast{position:absolute;left:16px;right:16px;bottom:16px;z-index:5;display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:10px;background:#192a3ff5;border:1px solid rgba(255,255,255,.14);box-shadow:0 10px 26px #00000059;color:#fff;font-size:13px;pointer-events:none}.messaging-toast.success{background:#14532df5;border-color:#22c55e66}.messaging-toast.error{background:#7f1d1df5;border-color:#f8717173}.messaging-toast mat-icon{font-size:18px;width:18px;height:18px}.status-dot{width:8px;height:8px;border-radius:50%;background:#fff6;flex-shrink:0}.status-dot.connected{background:#22c55e;box-shadow:0 0 0 3px #22c55e2e}.status-dot.connecting{background:#f59e0b;animation:blink 1s infinite}.status-dot.disconnected{background:#ef4444;box-shadow:0 0 0 3px #ef444424}@keyframes blink{50%{opacity:.3}}.sidebar.floating{position:fixed!important;right:unset!important;left:80px;top:80px;transform:none!important;border-radius:12px;overflow:hidden;resize:none;min-width:280px;min-height:320px}.sidebar.floating:not(.open){display:none}.drag-handle{cursor:grab;-webkit-user-select:none;user-select:none}.drag-handle:active{cursor:grabbing}.float-resize-corner{position:absolute;bottom:0;right:0;width:16px;height:16px;cursor:se-resize;background:linear-gradient(135deg,transparent 50%,rgba(255,255,255,.25) 50%);border-bottom-right-radius:12px}@media (max-width: 480px){.sidebar{width:100%!important}.resize-handle{display:none}}.lb-overlay{position:fixed;inset:0;background:#000000e0;display:flex;align-items:center;justify-content:center;z-index:99999;cursor:pointer}.lb-overlay.lb-detached{inset:unset;background:#0c1f35;border:1px solid rgba(255,255,255,.18);border-radius:12px;box-shadow:0 12px 48px #000000b3;display:flex;flex-direction:column;overflow:hidden;cursor:default;min-width:240px;min-height:200px}.lb-drag-bar{display:flex;align-items:center;justify-content:space-between;padding:6px 8px 6px 12px;background:#041322;border-bottom:1px solid rgba(255,255,255,.12);cursor:grab;flex-shrink:0;-webkit-user-select:none;user-select:none}.lb-drag-bar:active{cursor:grabbing}.lb-drag-title{font-size:12px;color:#fff9;letter-spacing:.4px}.lb-drag-actions{display:flex;gap:2px}.lb-action-btn{background:transparent;border:none;border-radius:6px;width:28px;height:28px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#ffffffb3;transition:background .15s}.lb-action-btn:hover{background:#ffffff26}.lb-action-btn mat-icon{font-size:16px;width:16px;height:16px}.lb-img{max-width:92vw;max-height:92vh;border-radius:8px;box-shadow:0 8px 40px #0009;cursor:default}.lb-img.lb-img-detached{max-width:100%;max-height:100%;border-radius:0;box-shadow:none;object-fit:contain;flex:1}.lb-close{position:absolute;top:16px;right:16px;background:#ffffff26;border:none;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#fff;transition:background .15s}.lb-close:hover{background:#ffffff4d}.lb-detach-btn{position:absolute;top:16px;right:60px;background:#ffffff26;border:none;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#fff;transition:background .15s}.lb-detach-btn:hover{background:#ffffff4d}.lb-resize-corner{position:absolute;bottom:0;right:0;width:16px;height:16px;cursor:se-resize;background:linear-gradient(135deg,transparent 50%,rgba(255,255,255,.2) 50%);border-bottom-right-radius:12px}\n"] }]
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
            return;
        }
        try {
            const parsed = JSON.parse(sessionData);
            const sessionId = parsed.session_id || parsed.sessionId;
            const email = parsed.email || parsed.user_email;
            const userName = parsed.user_name || parsed.name;
            if (!sessionId || !email) {
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
        catch {
        }
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: MessagingOverlayComponent, deps: [{ token: MessagingStoreService }, { token: AuthService }], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "17.3.12", type: MessagingOverlayComponent, isStandalone: true, selector: "app-messaging-overlay", ngImport: i0, template: `
    <ng-container *ngIf="isAuthenticated">
      <app-floating-button></app-floating-button>
      <app-chat-panel></app-chat-panel>
    </ng-container>
  `, isInline: true, styles: [":host{position:relative;z-index:1000}.cdk-overlay-container{z-index:10000!important}.mat-mdc-tooltip{z-index:10001!important}\n"], dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i1$1.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "component", type: FloatingButtonComponent, selector: "app-floating-button" }, { kind: "component", type: ChatPanelComponent, selector: "app-chat-panel" }], encapsulation: i0.ViewEncapsulation.None });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: MessagingOverlayComponent, decorators: [{
            type: Component,
            args: [{ selector: 'app-messaging-overlay', standalone: true, imports: [CommonModule, FloatingButtonComponent, ChatPanelComponent], template: `
    <ng-container *ngIf="isAuthenticated">
      <app-floating-button></app-floating-button>
      <app-chat-panel></app-chat-panel>
    </ng-container>
  `, encapsulation: ViewEncapsulation.None, styles: [":host{position:relative;z-index:1000}.cdk-overlay-container{z-index:10000!important}.mat-mdc-tooltip{z-index:10001!important}\n"] }]
        }], ctorParameters: () => [{ type: MessagingStoreService }, { type: AuthService }] });

class ThreadViewerComponent {
    api;
    auth;
    parentMessage;
    conversationId;
    close = new EventEmitter();
    replies = [];
    replyText = '';
    loading = false;
    isFollowing = true;
    constructor(api, auth) {
        this.api = api;
        this.auth = auth;
    }
    ngOnInit() {
        this.loadThread();
    }
    loadThread() {
        if (!this.parentMessage)
            return;
        this.loading = true;
        this.api.getThreadMessages(this.parentMessage.message_id, this.auth.contactId).subscribe({
            next: (messages) => {
                this.replies = messages;
                this.loading = false;
            },
            error: () => {
                this.loading = false;
            }
        });
    }
    sendReply() {
        if (!this.replyText.trim())
            return;
        this.api.sendThreadReply(this.parentMessage.message_id, this.auth.contactId, this.replyText).subscribe({
            next: () => {
                this.replyText = '';
                this.loadThread();
            },
            error: () => { }
        });
    }
    toggleFollow() {
        this.isFollowing = !this.isFollowing;
    }
    onClose() {
        this.close.emit();
    }
    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        if (hours < 24) {
            return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        }
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: ThreadViewerComponent, deps: [{ token: MessagingApiService }, { token: AuthService }], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "17.3.12", type: ThreadViewerComponent, isStandalone: true, selector: "app-thread-viewer", inputs: { parentMessage: "parentMessage", conversationId: "conversationId" }, outputs: { close: "close" }, ngImport: i0, template: `
    <div class="thread-viewer">
      <div class="thread-header">
        <button mat-icon-button (click)="onClose()">
          <mat-icon>close</mat-icon>
        </button>
        <h3>Thread</h3>
        <button mat-icon-button (click)="toggleFollow()">
          <mat-icon>{{ isFollowing ? 'notifications_active' : 'notifications_off' }}</mat-icon>
        </button>
      </div>

      <div class="parent-message" *ngIf="parentMessage">
        <div class="message-header">
          <strong>{{ parentMessage.sender_name || 'Unknown' }}</strong>
          <span class="timestamp">{{ formatTime(parentMessage.created_at) }}</span>
        </div>
        <div class="message-content">{{ parentMessage.content }}</div>
        <div class="reply-count">{{ replies.length }} {{ replies.length === 1 ? 'reply' : 'replies' }}</div>
      </div>

      <div class="thread-messages" *ngIf="!loading">
        <div *ngFor="let msg of replies" class="thread-message">
          <div class="message-header">
            <strong>{{ msg.sender_name || 'Unknown' }}</strong>
            <span class="timestamp">{{ formatTime(msg.created_at) }}</span>
          </div>
          <div class="message-content">{{ msg.content }}</div>
        </div>
      </div>

      <div class="loading" *ngIf="loading">
        <mat-spinner diameter="30"></mat-spinner>
      </div>

      <div class="thread-input">
        <input 
          type="text" 
          [(ngModel)]="replyText" 
          (keyup.enter)="sendReply()"
          placeholder="Reply in thread..."
        />
        <button mat-icon-button (click)="sendReply()" [disabled]="!replyText.trim()">
          <mat-icon>send</mat-icon>
        </button>
      </div>
    </div>
  `, isInline: true, styles: [".thread-viewer{display:flex;flex-direction:column;height:100%;background:#fff}.thread-header{display:flex;align-items:center;padding:12px;border-bottom:1px solid #e0e0e0;gap:8px}.thread-header h3{flex:1;margin:0;font-size:16px;font-weight:500}.parent-message{padding:16px;background:#f5f5f5;border-bottom:2px solid #1976d2}.message-header{display:flex;justify-content:space-between;margin-bottom:4px;font-size:14px}.timestamp{color:#666;font-size:12px}.message-content{margin:8px 0;line-height:1.4}.reply-count{font-size:12px;color:#1976d2;margin-top:8px}.thread-messages{flex:1;overflow-y:auto;padding:16px}.thread-message{margin-bottom:16px;padding:12px;background:#fafafa;border-radius:8px}.loading{display:flex;justify-content:center;align-items:center;flex:1}.thread-input{display:flex;padding:12px;border-top:1px solid #e0e0e0;gap:8px}.thread-input input{flex:1;padding:8px 12px;border:1px solid #ddd;border-radius:20px;outline:none}.thread-input input:focus{border-color:#1976d2}\n"], dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i1$1.NgForOf, selector: "[ngFor][ngForOf]", inputs: ["ngForOf", "ngForTrackBy", "ngForTemplate"] }, { kind: "directive", type: i1$1.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "ngmodule", type: FormsModule }, { kind: "directive", type: i3.DefaultValueAccessor, selector: "input:not([type=checkbox])[formControlName],textarea[formControlName],input:not([type=checkbox])[formControl],textarea[formControl],input:not([type=checkbox])[ngModel],textarea[ngModel],[ngDefaultControl]" }, { kind: "directive", type: i3.NgControlStatus, selector: "[formControlName],[ngModel],[formControl]" }, { kind: "directive", type: i3.NgModel, selector: "[ngModel]:not([formControlName]):not([formControl])", inputs: ["name", "disabled", "ngModel", "ngModelOptions"], outputs: ["ngModelChange"], exportAs: ["ngModel"] }, { kind: "ngmodule", type: MatIconModule }, { kind: "component", type: i4.MatIcon, selector: "mat-icon", inputs: ["color", "inline", "svgIcon", "fontSet", "fontIcon"], exportAs: ["matIcon"] }, { kind: "ngmodule", type: MatButtonModule }, { kind: "component", type: i6.MatIconButton, selector: "button[mat-icon-button]", exportAs: ["matButton"] }, { kind: "ngmodule", type: MatProgressSpinnerModule }, { kind: "component", type: i9.MatProgressSpinner, selector: "mat-progress-spinner, mat-spinner", inputs: ["color", "mode", "value", "diameter", "strokeWidth"], exportAs: ["matProgressSpinner"] }] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: ThreadViewerComponent, decorators: [{
            type: Component,
            args: [{ selector: 'app-thread-viewer', standalone: true, imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatProgressSpinnerModule], template: `
    <div class="thread-viewer">
      <div class="thread-header">
        <button mat-icon-button (click)="onClose()">
          <mat-icon>close</mat-icon>
        </button>
        <h3>Thread</h3>
        <button mat-icon-button (click)="toggleFollow()">
          <mat-icon>{{ isFollowing ? 'notifications_active' : 'notifications_off' }}</mat-icon>
        </button>
      </div>

      <div class="parent-message" *ngIf="parentMessage">
        <div class="message-header">
          <strong>{{ parentMessage.sender_name || 'Unknown' }}</strong>
          <span class="timestamp">{{ formatTime(parentMessage.created_at) }}</span>
        </div>
        <div class="message-content">{{ parentMessage.content }}</div>
        <div class="reply-count">{{ replies.length }} {{ replies.length === 1 ? 'reply' : 'replies' }}</div>
      </div>

      <div class="thread-messages" *ngIf="!loading">
        <div *ngFor="let msg of replies" class="thread-message">
          <div class="message-header">
            <strong>{{ msg.sender_name || 'Unknown' }}</strong>
            <span class="timestamp">{{ formatTime(msg.created_at) }}</span>
          </div>
          <div class="message-content">{{ msg.content }}</div>
        </div>
      </div>

      <div class="loading" *ngIf="loading">
        <mat-spinner diameter="30"></mat-spinner>
      </div>

      <div class="thread-input">
        <input 
          type="text" 
          [(ngModel)]="replyText" 
          (keyup.enter)="sendReply()"
          placeholder="Reply in thread..."
        />
        <button mat-icon-button (click)="sendReply()" [disabled]="!replyText.trim()">
          <mat-icon>send</mat-icon>
        </button>
      </div>
    </div>
  `, styles: [".thread-viewer{display:flex;flex-direction:column;height:100%;background:#fff}.thread-header{display:flex;align-items:center;padding:12px;border-bottom:1px solid #e0e0e0;gap:8px}.thread-header h3{flex:1;margin:0;font-size:16px;font-weight:500}.parent-message{padding:16px;background:#f5f5f5;border-bottom:2px solid #1976d2}.message-header{display:flex;justify-content:space-between;margin-bottom:4px;font-size:14px}.timestamp{color:#666;font-size:12px}.message-content{margin:8px 0;line-height:1.4}.reply-count{font-size:12px;color:#1976d2;margin-top:8px}.thread-messages{flex:1;overflow-y:auto;padding:16px}.thread-message{margin-bottom:16px;padding:12px;background:#fafafa;border-radius:8px}.loading{display:flex;justify-content:center;align-items:center;flex:1}.thread-input{display:flex;padding:12px;border-top:1px solid #e0e0e0;gap:8px}.thread-input input{flex:1;padding:8px 12px;border:1px solid #ddd;border-radius:20px;outline:none}.thread-input input:focus{border-color:#1976d2}\n"] }]
        }], ctorParameters: () => [{ type: MessagingApiService }, { type: AuthService }], propDecorators: { parentMessage: [{
                type: Input
            }], conversationId: [{
                type: Input
            }], close: [{
                type: Output
            }] } });

class ReactionPickerComponent {
    show = false;
    align = 'left';
    emojiSelected = new EventEmitter();
    emojis = ['👍', '❤️', '😂', '😮', '😢', '🎉', '🔥', '👏'];
    selectEmoji(emoji) {
        this.emojiSelected.emit(emoji);
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: ReactionPickerComponent, deps: [], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "17.3.12", type: ReactionPickerComponent, isStandalone: true, selector: "app-reaction-picker", inputs: { show: "show", align: "align" }, outputs: { emojiSelected: "emojiSelected" }, ngImport: i0, template: `
    <div class="reaction-picker" *ngIf="show" [class.align-right]="align === 'right'">
      <button 
        *ngFor="let emoji of emojis" 
        mat-icon-button 
        (click)="selectEmoji(emoji)"
        [matTooltip]="emoji"
        class="emoji-btn"
      >
        {{ emoji }}
      </button>
    </div>
  `, isInline: true, styles: [".reaction-picker{display:flex;gap:2px;align-items:center;justify-content:center;padding:5px 6px;background:linear-gradient(180deg,#1f4bd8,#173396);border:1px solid rgba(255,255,255,.24);border-radius:10px;box-shadow:0 6px 14px #00000038;position:absolute;z-index:1000;bottom:100%;left:0;margin-bottom:3px;white-space:nowrap;overflow:visible}.reaction-picker.align-right{left:auto;right:0}.emoji-btn{font-size:16px;width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;line-height:1;border-radius:7px;transition:transform .2s}.emoji-btn:hover{transform:scale(1.12);background:#ffffff2e}\n"], dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i1$1.NgForOf, selector: "[ngFor][ngForOf]", inputs: ["ngForOf", "ngForTrackBy", "ngForTemplate"] }, { kind: "directive", type: i1$1.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "ngmodule", type: MatIconModule }, { kind: "ngmodule", type: MatButtonModule }, { kind: "component", type: i6.MatIconButton, selector: "button[mat-icon-button]", exportAs: ["matButton"] }, { kind: "ngmodule", type: MatTooltipModule }, { kind: "directive", type: i7.MatTooltip, selector: "[matTooltip]", inputs: ["matTooltipPosition", "matTooltipPositionAtOrigin", "matTooltipDisabled", "matTooltipShowDelay", "matTooltipHideDelay", "matTooltipTouchGestures", "matTooltip", "matTooltipClass"], exportAs: ["matTooltip"] }] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: ReactionPickerComponent, decorators: [{
            type: Component,
            args: [{ selector: 'app-reaction-picker', standalone: true, imports: [CommonModule, MatIconModule, MatButtonModule, MatTooltipModule], template: `
    <div class="reaction-picker" *ngIf="show" [class.align-right]="align === 'right'">
      <button 
        *ngFor="let emoji of emojis" 
        mat-icon-button 
        (click)="selectEmoji(emoji)"
        [matTooltip]="emoji"
        class="emoji-btn"
      >
        {{ emoji }}
      </button>
    </div>
  `, styles: [".reaction-picker{display:flex;gap:2px;align-items:center;justify-content:center;padding:5px 6px;background:linear-gradient(180deg,#1f4bd8,#173396);border:1px solid rgba(255,255,255,.24);border-radius:10px;box-shadow:0 6px 14px #00000038;position:absolute;z-index:1000;bottom:100%;left:0;margin-bottom:3px;white-space:nowrap;overflow:visible}.reaction-picker.align-right{left:auto;right:0}.emoji-btn{font-size:16px;width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;line-height:1;border-radius:7px;transition:transform .2s}.emoji-btn:hover{transform:scale(1.12);background:#ffffff2e}\n"] }]
        }], propDecorators: { show: [{
                type: Input
            }], align: [{
                type: Input
            }], emojiSelected: [{
                type: Output
            }] } });

class MessageActionsComponent {
    message;
    currentUserId;
    canPin = false;
    reply = new EventEmitter();
    react = new EventEmitter();
    edit = new EventEmitter();
    delete = new EventEmitter();
    pin = new EventEmitter();
    copy = new EventEmitter();
    get canEdit() {
        return (this.message.sender_id === this.currentUserId &&
            this.message.message_type === 'TEXT' &&
            !this.isDeleted &&
            !String(this.message.message_id || '').startsWith('temp-'));
    }
    get canDelete() {
        return ((this.message.sender_id === this.currentUserId || this.canPin) &&
            !this.isDeleted &&
            !String(this.message.message_id || '').startsWith('temp-'));
    }
    get isDeleted() {
        return Boolean(this.message.is_deleted || this.message.deleted_at || this.message.content === '[deleted]');
    }
    onReply() {
        this.reply.emit(this.message);
    }
    onReact() {
        this.react.emit(this.message);
    }
    onEdit() {
        this.edit.emit(this.message);
    }
    onDelete() {
        if (confirm('Delete this message?')) {
            this.delete.emit(this.message);
        }
    }
    onPin() {
        this.pin.emit(this.message);
    }
    onCopy() {
        if (this.message.content) {
            navigator.clipboard.writeText(this.message.content);
        }
        this.copy.emit(this.message);
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: MessageActionsComponent, deps: [], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "17.3.12", type: MessageActionsComponent, isStandalone: true, selector: "app-message-actions", inputs: { message: "message", currentUserId: "currentUserId", canPin: "canPin" }, outputs: { reply: "reply", react: "react", edit: "edit", delete: "delete", pin: "pin", copy: "copy" }, ngImport: i0, template: `
    <div class="message-actions">
      <button mat-icon-button [matMenuTriggerFor]="menu" class="more-btn">
        <mat-icon>more_vert</mat-icon>
      </button>
      
      <mat-menu #menu="matMenu">
        <button mat-menu-item (click)="onReply()">
          <mat-icon>reply</mat-icon>
          <span>Reply in thread</span>
        </button>
        
        <button mat-menu-item (click)="onReact()">
          <mat-icon>add_reaction</mat-icon>
          <span>Add reaction</span>
        </button>
        
        <button mat-menu-item *ngIf="canEdit" (click)="onEdit()">
          <mat-icon>edit</mat-icon>
          <span>Edit message</span>
        </button>
        
        <button mat-menu-item (click)="onPin()">
          <mat-icon>{{ message.is_pinned ? 'push_pin' : 'push_pin' }}</mat-icon>
          <span>{{ message.is_pinned ? 'Unpin' : 'Pin' }} message</span>
        </button>
        
        <button mat-menu-item (click)="onCopy()">
          <mat-icon>content_copy</mat-icon>
          <span>Copy text</span>
        </button>
        
        <button mat-menu-item *ngIf="canDelete" (click)="onDelete()" class="delete-action">
          <mat-icon>delete</mat-icon>
          <span>Delete message</span>
        </button>
      </mat-menu>
    </div>
  `, isInline: true, styles: [".message-actions{opacity:0;transition:opacity .2s}:host:hover .message-actions,.message-actions:focus-within{opacity:1}.more-btn{width:28px;height:28px;line-height:28px}.more-btn mat-icon{font-size:18px;width:18px;height:18px}.delete-action{color:#d32f2f}\n"], dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i1$1.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "ngmodule", type: MatIconModule }, { kind: "component", type: i4.MatIcon, selector: "mat-icon", inputs: ["color", "inline", "svgIcon", "fontSet", "fontIcon"], exportAs: ["matIcon"] }, { kind: "ngmodule", type: MatButtonModule }, { kind: "component", type: i6.MatIconButton, selector: "button[mat-icon-button]", exportAs: ["matButton"] }, { kind: "ngmodule", type: MatMenuModule }, { kind: "component", type: i4$1.MatMenu, selector: "mat-menu", inputs: ["backdropClass", "aria-label", "aria-labelledby", "aria-describedby", "xPosition", "yPosition", "overlapTrigger", "hasBackdrop", "class", "classList"], outputs: ["closed", "close"], exportAs: ["matMenu"] }, { kind: "component", type: i4$1.MatMenuItem, selector: "[mat-menu-item]", inputs: ["role", "disabled", "disableRipple"], exportAs: ["matMenuItem"] }, { kind: "directive", type: i4$1.MatMenuTrigger, selector: "[mat-menu-trigger-for], [matMenuTriggerFor]", inputs: ["mat-menu-trigger-for", "matMenuTriggerFor", "matMenuTriggerData", "matMenuTriggerRestoreFocus"], outputs: ["menuOpened", "onMenuOpen", "menuClosed", "onMenuClose"], exportAs: ["matMenuTrigger"] }] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: MessageActionsComponent, decorators: [{
            type: Component,
            args: [{ selector: 'app-message-actions', standalone: true, imports: [CommonModule, MatIconModule, MatButtonModule, MatMenuModule], template: `
    <div class="message-actions">
      <button mat-icon-button [matMenuTriggerFor]="menu" class="more-btn">
        <mat-icon>more_vert</mat-icon>
      </button>
      
      <mat-menu #menu="matMenu">
        <button mat-menu-item (click)="onReply()">
          <mat-icon>reply</mat-icon>
          <span>Reply in thread</span>
        </button>
        
        <button mat-menu-item (click)="onReact()">
          <mat-icon>add_reaction</mat-icon>
          <span>Add reaction</span>
        </button>
        
        <button mat-menu-item *ngIf="canEdit" (click)="onEdit()">
          <mat-icon>edit</mat-icon>
          <span>Edit message</span>
        </button>
        
        <button mat-menu-item (click)="onPin()">
          <mat-icon>{{ message.is_pinned ? 'push_pin' : 'push_pin' }}</mat-icon>
          <span>{{ message.is_pinned ? 'Unpin' : 'Pin' }} message</span>
        </button>
        
        <button mat-menu-item (click)="onCopy()">
          <mat-icon>content_copy</mat-icon>
          <span>Copy text</span>
        </button>
        
        <button mat-menu-item *ngIf="canDelete" (click)="onDelete()" class="delete-action">
          <mat-icon>delete</mat-icon>
          <span>Delete message</span>
        </button>
      </mat-menu>
    </div>
  `, styles: [".message-actions{opacity:0;transition:opacity .2s}:host:hover .message-actions,.message-actions:focus-within{opacity:1}.more-btn{width:28px;height:28px;line-height:28px}.more-btn mat-icon{font-size:18px;width:18px;height:18px}.delete-action{color:#d32f2f}\n"] }]
        }], propDecorators: { message: [{
                type: Input
            }], currentUserId: [{
                type: Input
            }], canPin: [{
                type: Input
            }], reply: [{
                type: Output
            }], react: [{
                type: Output
            }], edit: [{
                type: Output
            }], delete: [{
                type: Output
            }], pin: [{
                type: Output
            }], copy: [{
                type: Output
            }] } });

class PresenceIndicatorComponent {
    status = 'offline';
    lastSeen;
    customStatus;
    getTooltip() {
        if (this.customStatus)
            return this.customStatus;
        switch (this.status) {
            case 'online': return 'Online';
            case 'away': return 'Away';
            case 'busy': return 'Busy';
            case 'offline':
                if (this.lastSeen) {
                    return `Last seen ${this.formatLastSeen(this.lastSeen)}`;
                }
                return 'Offline';
            default: return '';
        }
    }
    formatLastSeen(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / (1000 * 60));
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        if (minutes < 1)
            return 'just now';
        if (minutes < 60)
            return `${minutes}m ago`;
        if (hours < 24)
            return `${hours}h ago`;
        if (days < 7)
            return `${days}d ago`;
        return date.toLocaleDateString();
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: PresenceIndicatorComponent, deps: [], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "17.3.12", type: PresenceIndicatorComponent, isStandalone: true, selector: "app-presence-indicator", inputs: { status: "status", lastSeen: "lastSeen", customStatus: "customStatus" }, ngImport: i0, template: `
    <div 
      class="presence-indicator" 
      [class.online]="status === 'online'"
      [class.away]="status === 'away'"
      [class.busy]="status === 'busy'"
      [class.offline]="status === 'offline'"
      [matTooltip]="getTooltip()"
    ></div>
  `, isInline: true, styles: [".presence-indicator{width:10px;height:10px;border-radius:50%;border:2px solid white;position:absolute;bottom:0;right:0}.presence-indicator.online{background-color:#4caf50}.presence-indicator.away{background-color:#ff9800}.presence-indicator.busy{background-color:#f44336}.presence-indicator.offline{background-color:#9e9e9e}\n"], dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "ngmodule", type: MatTooltipModule }, { kind: "directive", type: i7.MatTooltip, selector: "[matTooltip]", inputs: ["matTooltipPosition", "matTooltipPositionAtOrigin", "matTooltipDisabled", "matTooltipShowDelay", "matTooltipHideDelay", "matTooltipTouchGestures", "matTooltip", "matTooltipClass"], exportAs: ["matTooltip"] }] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: PresenceIndicatorComponent, decorators: [{
            type: Component,
            args: [{ selector: 'app-presence-indicator', standalone: true, imports: [CommonModule, MatTooltipModule], template: `
    <div 
      class="presence-indicator" 
      [class.online]="status === 'online'"
      [class.away]="status === 'away'"
      [class.busy]="status === 'busy'"
      [class.offline]="status === 'offline'"
      [matTooltip]="getTooltip()"
    ></div>
  `, styles: [".presence-indicator{width:10px;height:10px;border-radius:50%;border:2px solid white;position:absolute;bottom:0;right:0}.presence-indicator.online{background-color:#4caf50}.presence-indicator.away{background-color:#ff9800}.presence-indicator.busy{background-color:#f44336}.presence-indicator.offline{background-color:#9e9e9e}\n"] }]
        }], propDecorators: { status: [{
                type: Input
            }], lastSeen: [{
                type: Input
            }], customStatus: [{
                type: Input
            }] } });

class TypingIndicatorComponent {
    typingUsers = [];
    get isTyping() {
        return this.typingUsers.length > 0;
    }
    get typingText() {
        if (this.typingUsers.length === 0)
            return '';
        if (this.typingUsers.length === 1)
            return `${this.typingUsers[0]} is typing`;
        if (this.typingUsers.length === 2)
            return `${this.typingUsers[0]} and ${this.typingUsers[1]} are typing`;
        return `${this.typingUsers.length} people are typing`;
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: TypingIndicatorComponent, deps: [], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "17.3.12", type: TypingIndicatorComponent, isStandalone: true, selector: "app-typing-indicator", inputs: { typingUsers: "typingUsers" }, ngImport: i0, template: `
    <div class="typing-indicator" *ngIf="isTyping">
      <span class="typing-text">{{ typingText }}</span>
      <span class="dots">
        <span class="dot"></span>
        <span class="dot"></span>
        <span class="dot"></span>
      </span>
    </div>
  `, isInline: true, styles: [".typing-indicator{display:flex;align-items:center;padding:8px 16px;font-size:13px;color:#666;gap:8px}.typing-text{font-style:italic}.dots{display:flex;gap:4px}.dot{width:4px;height:4px;background-color:#666;border-radius:50%;animation:typing 1.4s infinite}.dot:nth-child(2){animation-delay:.2s}.dot:nth-child(3){animation-delay:.4s}@keyframes typing{0%,60%,to{opacity:.3;transform:translateY(0)}30%{opacity:1;transform:translateY(-4px)}}\n"], dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i1$1.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: TypingIndicatorComponent, decorators: [{
            type: Component,
            args: [{ selector: 'app-typing-indicator', standalone: true, imports: [CommonModule], template: `
    <div class="typing-indicator" *ngIf="isTyping">
      <span class="typing-text">{{ typingText }}</span>
      <span class="dots">
        <span class="dot"></span>
        <span class="dot"></span>
        <span class="dot"></span>
      </span>
    </div>
  `, styles: [".typing-indicator{display:flex;align-items:center;padding:8px 16px;font-size:13px;color:#666;gap:8px}.typing-text{font-style:italic}.dots{display:flex;gap:4px}.dot{width:4px;height:4px;background-color:#666;border-radius:50%;animation:typing 1.4s infinite}.dot:nth-child(2){animation-delay:.2s}.dot:nth-child(3){animation-delay:.4s}@keyframes typing{0%,60%,to{opacity:.3;transform:translateY(0)}30%{opacity:1;transform:translateY(-4px)}}\n"] }]
        }], propDecorators: { typingUsers: [{
                type: Input
            }] } });

class SearchPanelComponent {
    api;
    auth;
    close = new EventEmitter();
    messageSelected = new EventEmitter();
    query = '';
    filters = {};
    showFilters = false;
    results = [];
    loading = false;
    searchSubject = new Subject();
    constructor(api, auth) {
        this.api = api;
        this.auth = auth;
        this.searchSubject.pipe(debounceTime(300)).subscribe(() => {
            this.performSearch();
        });
    }
    onQueryChange() {
        this.searchSubject.next(this.query);
    }
    performSearch() {
        if (!this.query.trim()) {
            this.results = [];
            return;
        }
        const contactId = this.auth.contactId;
        if (!contactId) {
            this.loading = false;
            return;
        }
        this.loading = true;
        const conversationId = this.filters.conversation_id?.toString();
        this.api.searchMessages(contactId, this.query, conversationId).subscribe({
            next: (messages) => {
                this.results = messages;
                this.loading = false;
            },
            error: () => {
                this.loading = false;
            }
        });
    }
    clearSearch() {
        this.query = '';
        this.results = [];
    }
    selectMessage(msg) {
        this.messageSelected.emit(msg);
    }
    onClose() {
        this.close.emit();
    }
    formatDate(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    }
    highlightQuery(text) {
        if (!this.query)
            return text;
        const regex = new RegExp(`(${this.query})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: SearchPanelComponent, deps: [{ token: MessagingApiService }, { token: AuthService }], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "17.3.12", type: SearchPanelComponent, isStandalone: true, selector: "app-search-panel", outputs: { close: "close", messageSelected: "messageSelected" }, ngImport: i0, template: `
    <div class="search-panel">
      <div class="search-header">
        <h3>Search Messages</h3>
        <button mat-icon-button (click)="onClose()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="search-input-container">
        <mat-form-field appearance="outline" class="search-field">
          <mat-icon matPrefix>search</mat-icon>
          <input 
            matInput 
            [(ngModel)]="query" 
            (ngModelChange)="onQueryChange()"
            placeholder="Search messages..."
          />
          <button mat-icon-button matSuffix *ngIf="query" (click)="clearSearch()">
            <mat-icon>clear</mat-icon>
          </button>
        </mat-form-field>

        <button mat-button (click)="showFilters = !showFilters">
          <mat-icon>filter_list</mat-icon>
          Filters
        </button>
      </div>

      <div class="filters" *ngIf="showFilters">
        <mat-form-field appearance="outline">
          <mat-label>From User</mat-label>
          <input matInput [(ngModel)]="filters.user_id" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Date From</mat-label>
          <input matInput [matDatepicker]="pickerFrom" [(ngModel)]="filters.date_from" />
          <mat-datepicker-toggle matSuffix [for]="pickerFrom"></mat-datepicker-toggle>
          <mat-datepicker #pickerFrom></mat-datepicker>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Date To</mat-label>
          <input matInput [matDatepicker]="pickerTo" [(ngModel)]="filters.date_to" />
          <mat-datepicker-toggle matSuffix [for]="pickerTo"></mat-datepicker-toggle>
          <mat-datepicker #pickerTo></mat-datepicker>
        </mat-form-field>
      </div>

      <div class="search-results">
        <div *ngIf="loading" class="loading">
          <mat-spinner diameter="40"></mat-spinner>
        </div>

        <div *ngIf="!loading && results.length === 0 && query" class="no-results">
          No messages found
        </div>

        <div *ngFor="let msg of results" class="result-item" (click)="selectMessage(msg)">
          <div class="result-header">
            <strong>{{ msg.sender_name || 'Unknown' }}</strong>
            <span class="timestamp">{{ formatDate(msg.created_at) }}</span>
          </div>
          <div class="result-content" [innerHTML]="highlightQuery(msg.content || '')"></div>
        </div>
      </div>
    </div>
  `, isInline: true, styles: [".search-panel{display:flex;flex-direction:column;height:100%;background:#fff}.search-header{display:flex;justify-content:space-between;align-items:center;padding:16px;border-bottom:1px solid #e0e0e0}.search-header h3{margin:0;font-size:18px;font-weight:500}.search-input-container{padding:16px;border-bottom:1px solid #e0e0e0}.search-field{width:100%;margin-bottom:8px}.filters{padding:16px;background:#f5f5f5;display:flex;flex-direction:column;gap:12px}.search-results{flex:1;overflow-y:auto;padding:16px}.loading{display:flex;justify-content:center;padding:32px}.no-results{text-align:center;color:#666;padding:32px}.result-item{padding:12px;border-bottom:1px solid #e0e0e0;cursor:pointer;transition:background .2s}.result-item:hover{background:#f5f5f5}.result-header{display:flex;justify-content:space-between;margin-bottom:4px;font-size:14px}.timestamp{color:#666;font-size:12px}.result-content{font-size:14px;color:#333;line-height:1.4}.result-content ::ng-deep mark{background-color:#ffeb3b;padding:2px 4px;border-radius:2px}\n"], dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i1$1.NgForOf, selector: "[ngFor][ngForOf]", inputs: ["ngForOf", "ngForTrackBy", "ngForTemplate"] }, { kind: "directive", type: i1$1.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "ngmodule", type: FormsModule }, { kind: "directive", type: i3.DefaultValueAccessor, selector: "input:not([type=checkbox])[formControlName],textarea[formControlName],input:not([type=checkbox])[formControl],textarea[formControl],input:not([type=checkbox])[ngModel],textarea[ngModel],[ngDefaultControl]" }, { kind: "directive", type: i3.NgControlStatus, selector: "[formControlName],[ngModel],[formControl]" }, { kind: "directive", type: i3.NgModel, selector: "[ngModel]:not([formControlName]):not([formControl])", inputs: ["name", "disabled", "ngModel", "ngModelOptions"], outputs: ["ngModelChange"], exportAs: ["ngModel"] }, { kind: "ngmodule", type: MatIconModule }, { kind: "component", type: i4.MatIcon, selector: "mat-icon", inputs: ["color", "inline", "svgIcon", "fontSet", "fontIcon"], exportAs: ["matIcon"] }, { kind: "ngmodule", type: MatButtonModule }, { kind: "component", type: i6.MatButton, selector: "    button[mat-button], button[mat-raised-button], button[mat-flat-button],    button[mat-stroked-button]  ", exportAs: ["matButton"] }, { kind: "component", type: i6.MatIconButton, selector: "button[mat-icon-button]", exportAs: ["matButton"] }, { kind: "ngmodule", type: MatInputModule }, { kind: "directive", type: i7$1.MatInput, selector: "input[matInput], textarea[matInput], select[matNativeControl],      input[matNativeControl], textarea[matNativeControl]", inputs: ["disabled", "id", "placeholder", "name", "required", "type", "errorStateMatcher", "aria-describedby", "value", "readonly"], exportAs: ["matInput"] }, { kind: "component", type: i8.MatFormField, selector: "mat-form-field", inputs: ["hideRequiredMarker", "color", "floatLabel", "appearance", "subscriptSizing", "hintLabel"], exportAs: ["matFormField"] }, { kind: "directive", type: i8.MatLabel, selector: "mat-label" }, { kind: "directive", type: i8.MatPrefix, selector: "[matPrefix], [matIconPrefix], [matTextPrefix]", inputs: ["matTextPrefix"] }, { kind: "directive", type: i8.MatSuffix, selector: "[matSuffix], [matIconSuffix], [matTextSuffix]", inputs: ["matTextSuffix"] }, { kind: "ngmodule", type: MatFormFieldModule }, { kind: "ngmodule", type: MatProgressSpinnerModule }, { kind: "component", type: i9.MatProgressSpinner, selector: "mat-progress-spinner, mat-spinner", inputs: ["color", "mode", "value", "diameter", "strokeWidth"], exportAs: ["matProgressSpinner"] }, { kind: "ngmodule", type: MatDatepickerModule }, { kind: "component", type: i10.MatDatepicker, selector: "mat-datepicker", exportAs: ["matDatepicker"] }, { kind: "directive", type: i10.MatDatepickerInput, selector: "input[matDatepicker]", inputs: ["matDatepicker", "min", "max", "matDatepickerFilter"], exportAs: ["matDatepickerInput"] }, { kind: "component", type: i10.MatDatepickerToggle, selector: "mat-datepicker-toggle", inputs: ["for", "tabIndex", "aria-label", "disabled", "disableRipple"], exportAs: ["matDatepickerToggle"] }, { kind: "ngmodule", type: MatNativeDateModule }] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: SearchPanelComponent, decorators: [{
            type: Component,
            args: [{ selector: 'app-search-panel', standalone: true, imports: [
                        CommonModule,
                        FormsModule,
                        MatIconModule,
                        MatButtonModule,
                        MatInputModule,
                        MatFormFieldModule,
                        MatProgressSpinnerModule,
                        MatDatepickerModule,
                        MatNativeDateModule
                    ], template: `
    <div class="search-panel">
      <div class="search-header">
        <h3>Search Messages</h3>
        <button mat-icon-button (click)="onClose()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="search-input-container">
        <mat-form-field appearance="outline" class="search-field">
          <mat-icon matPrefix>search</mat-icon>
          <input 
            matInput 
            [(ngModel)]="query" 
            (ngModelChange)="onQueryChange()"
            placeholder="Search messages..."
          />
          <button mat-icon-button matSuffix *ngIf="query" (click)="clearSearch()">
            <mat-icon>clear</mat-icon>
          </button>
        </mat-form-field>

        <button mat-button (click)="showFilters = !showFilters">
          <mat-icon>filter_list</mat-icon>
          Filters
        </button>
      </div>

      <div class="filters" *ngIf="showFilters">
        <mat-form-field appearance="outline">
          <mat-label>From User</mat-label>
          <input matInput [(ngModel)]="filters.user_id" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Date From</mat-label>
          <input matInput [matDatepicker]="pickerFrom" [(ngModel)]="filters.date_from" />
          <mat-datepicker-toggle matSuffix [for]="pickerFrom"></mat-datepicker-toggle>
          <mat-datepicker #pickerFrom></mat-datepicker>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Date To</mat-label>
          <input matInput [matDatepicker]="pickerTo" [(ngModel)]="filters.date_to" />
          <mat-datepicker-toggle matSuffix [for]="pickerTo"></mat-datepicker-toggle>
          <mat-datepicker #pickerTo></mat-datepicker>
        </mat-form-field>
      </div>

      <div class="search-results">
        <div *ngIf="loading" class="loading">
          <mat-spinner diameter="40"></mat-spinner>
        </div>

        <div *ngIf="!loading && results.length === 0 && query" class="no-results">
          No messages found
        </div>

        <div *ngFor="let msg of results" class="result-item" (click)="selectMessage(msg)">
          <div class="result-header">
            <strong>{{ msg.sender_name || 'Unknown' }}</strong>
            <span class="timestamp">{{ formatDate(msg.created_at) }}</span>
          </div>
          <div class="result-content" [innerHTML]="highlightQuery(msg.content || '')"></div>
        </div>
      </div>
    </div>
  `, styles: [".search-panel{display:flex;flex-direction:column;height:100%;background:#fff}.search-header{display:flex;justify-content:space-between;align-items:center;padding:16px;border-bottom:1px solid #e0e0e0}.search-header h3{margin:0;font-size:18px;font-weight:500}.search-input-container{padding:16px;border-bottom:1px solid #e0e0e0}.search-field{width:100%;margin-bottom:8px}.filters{padding:16px;background:#f5f5f5;display:flex;flex-direction:column;gap:12px}.search-results{flex:1;overflow-y:auto;padding:16px}.loading{display:flex;justify-content:center;padding:32px}.no-results{text-align:center;color:#666;padding:32px}.result-item{padding:12px;border-bottom:1px solid #e0e0e0;cursor:pointer;transition:background .2s}.result-item:hover{background:#f5f5f5}.result-header{display:flex;justify-content:space-between;margin-bottom:4px;font-size:14px}.timestamp{color:#666;font-size:12px}.result-content{font-size:14px;color:#333;line-height:1.4}.result-content ::ng-deep mark{background-color:#ffeb3b;padding:2px 4px;border-radius:2px}\n"] }]
        }], ctorParameters: () => [{ type: MessagingApiService }, { type: AuthService }], propDecorators: { close: [{
                type: Output
            }], messageSelected: [{
                type: Output
            }] } });

class MentionInputComponent {
    placeholder = 'Type a message...';
    contacts = [];
    textChange = new EventEmitter();
    mention = new EventEmitter();
    textInput;
    text = '';
    showSuggestions = false;
    filteredContacts = [];
    selectedIndex = 0;
    mentionStart = -1;
    mentionQuery = '';
    onTextChange() {
        this.textChange.emit(this.text);
        this.checkForMention();
    }
    checkForMention() {
        const cursorPos = this.textInput.nativeElement.selectionStart;
        const textBeforeCursor = this.text.substring(0, cursorPos);
        const lastAtIndex = textBeforeCursor.lastIndexOf('@');
        if (lastAtIndex === -1) {
            this.showSuggestions = false;
            return;
        }
        const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
        if (/\s/.test(textAfterAt)) {
            this.showSuggestions = false;
            return;
        }
        this.mentionStart = lastAtIndex;
        this.mentionQuery = textAfterAt.toLowerCase();
        this.filterContacts();
        this.showSuggestions = this.filteredContacts.length > 0;
        this.selectedIndex = 0;
    }
    filterContacts() {
        if (!this.mentionQuery) {
            this.filteredContacts = this.contacts.slice(0, 5);
            return;
        }
        this.filteredContacts = this.contacts.filter(c => {
            const name = (c.username || c.first_name || c.email).toLowerCase();
            return name.includes(this.mentionQuery);
        }).slice(0, 5);
    }
    selectContact(contact) {
        const displayName = contact.username || contact.first_name || contact.email;
        const before = this.text.substring(0, this.mentionStart);
        const after = this.text.substring(this.textInput.nativeElement.selectionStart);
        this.text = `${before}@${displayName} ${after}`;
        this.showSuggestions = false;
        this.mention.emit(contact);
        this.textChange.emit(this.text);
        setTimeout(() => {
            const newPos = this.mentionStart + displayName.length + 2;
            this.textInput.nativeElement.setSelectionRange(newPos, newPos);
            this.textInput.nativeElement.focus();
        });
    }
    onKeyDown(event) {
        if (!this.showSuggestions)
            return;
        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                this.selectedIndex = Math.min(this.selectedIndex + 1, this.filteredContacts.length - 1);
                break;
            case 'ArrowUp':
                event.preventDefault();
                this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
                break;
            case 'Enter':
                if (this.filteredContacts[this.selectedIndex]) {
                    event.preventDefault();
                    this.selectContact(this.filteredContacts[this.selectedIndex]);
                }
                break;
            case 'Escape':
                this.showSuggestions = false;
                break;
        }
    }
    getText() {
        return this.text;
    }
    setText(value) {
        this.text = value;
    }
    clear() {
        this.text = '';
        this.showSuggestions = false;
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: MentionInputComponent, deps: [], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "17.3.12", type: MentionInputComponent, isStandalone: true, selector: "app-mention-input", inputs: { placeholder: "placeholder", contacts: "contacts" }, outputs: { textChange: "textChange", mention: "mention" }, viewQueries: [{ propertyName: "textInput", first: true, predicate: ["textInput"], descendants: true }], ngImport: i0, template: `
    <div class="mention-input-container">
      <textarea
        #textInput
        [(ngModel)]="text"
        (ngModelChange)="onTextChange()"
        (keydown)="onKeyDown($event)"
        [placeholder]="placeholder"
        rows="1"
      ></textarea>

      <div class="mention-suggestions" *ngIf="showSuggestions">
        <div 
          *ngFor="let contact of filteredContacts; let i = index"
          class="suggestion-item"
          [class.selected]="i === selectedIndex"
          (click)="selectContact(contact)"
          (mouseenter)="selectedIndex = i"
        >
          <strong>{{ contact.username || contact.first_name || contact.email }}</strong>
          <span class="email">{{ contact.email }}</span>
        </div>
      </div>
    </div>
  `, isInline: true, styles: [".mention-input-container{position:relative;width:100%}textarea{width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:4px;resize:vertical;font-family:inherit;font-size:14px;outline:none}textarea:focus{border-color:#1976d2}.mention-suggestions{position:absolute;bottom:100%;left:0;right:0;background:#fff;border:1px solid #ddd;border-radius:4px;box-shadow:0 2px 8px #00000026;max-height:200px;overflow-y:auto;margin-bottom:4px;z-index:1000}.suggestion-item{padding:8px 12px;cursor:pointer;display:flex;flex-direction:column;gap:2px}.suggestion-item:hover,.suggestion-item.selected{background:#f5f5f5}.suggestion-item strong{font-size:14px}.suggestion-item .email{font-size:12px;color:#666}\n"], dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i1$1.NgForOf, selector: "[ngFor][ngForOf]", inputs: ["ngForOf", "ngForTrackBy", "ngForTemplate"] }, { kind: "directive", type: i1$1.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "ngmodule", type: FormsModule }, { kind: "directive", type: i3.DefaultValueAccessor, selector: "input:not([type=checkbox])[formControlName],textarea[formControlName],input:not([type=checkbox])[formControl],textarea[formControl],input:not([type=checkbox])[ngModel],textarea[ngModel],[ngDefaultControl]" }, { kind: "directive", type: i3.NgControlStatus, selector: "[formControlName],[ngModel],[formControl]" }, { kind: "directive", type: i3.NgModel, selector: "[ngModel]:not([formControlName]):not([formControl])", inputs: ["name", "disabled", "ngModel", "ngModelOptions"], outputs: ["ngModelChange"], exportAs: ["ngModel"] }] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: MentionInputComponent, decorators: [{
            type: Component,
            args: [{ selector: 'app-mention-input', standalone: true, imports: [CommonModule, FormsModule], template: `
    <div class="mention-input-container">
      <textarea
        #textInput
        [(ngModel)]="text"
        (ngModelChange)="onTextChange()"
        (keydown)="onKeyDown($event)"
        [placeholder]="placeholder"
        rows="1"
      ></textarea>

      <div class="mention-suggestions" *ngIf="showSuggestions">
        <div 
          *ngFor="let contact of filteredContacts; let i = index"
          class="suggestion-item"
          [class.selected]="i === selectedIndex"
          (click)="selectContact(contact)"
          (mouseenter)="selectedIndex = i"
        >
          <strong>{{ contact.username || contact.first_name || contact.email }}</strong>
          <span class="email">{{ contact.email }}</span>
        </div>
      </div>
    </div>
  `, styles: [".mention-input-container{position:relative;width:100%}textarea{width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:4px;resize:vertical;font-family:inherit;font-size:14px;outline:none}textarea:focus{border-color:#1976d2}.mention-suggestions{position:absolute;bottom:100%;left:0;right:0;background:#fff;border:1px solid #ddd;border-radius:4px;box-shadow:0 2px 8px #00000026;max-height:200px;overflow-y:auto;margin-bottom:4px;z-index:1000}.suggestion-item{padding:8px 12px;cursor:pointer;display:flex;flex-direction:column;gap:2px}.suggestion-item:hover,.suggestion-item.selected{background:#f5f5f5}.suggestion-item strong{font-size:14px}.suggestion-item .email{font-size:12px;color:#666}\n"] }]
        }], propDecorators: { placeholder: [{
                type: Input
            }], contacts: [{
                type: Input
            }], textChange: [{
                type: Output
            }], mention: [{
                type: Output
            }], textInput: [{
                type: ViewChild,
                args: ['textInput']
            }] } });

// ── Configuration ──

/**
 * Generated bundle index. Do not edit.
 */

export { AuthService, ChatPanelComponent, ChatThreadComponent, FloatingButtonComponent, GroupManagerComponent, InboxListComponent, MESSAGING_CONFIG, MentionInputComponent, MessageActionsComponent, MessageInputComponent, MessagingApiService, MessagingAuthBridgeService, MessagingFileService, MessagingOverlayComponent, MessagingStoreService, MessagingWebSocketService, NewConversationComponent, PresenceIndicatorComponent, ReactionPickerComponent, SearchPanelComponent, ThreadViewerComponent, TypingIndicatorComponent, createContactFromUser, getContactDisplayName, getMessageSenderName, isProjectConversation };
//# sourceMappingURL=coreline-engineering-solutions-messaging.mjs.map
