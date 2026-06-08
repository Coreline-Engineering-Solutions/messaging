"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.messagingWebSocket = exports.MessagingWebSocketClient = void 0;
const messagingRuntime_1 = require("./messagingRuntime");
class MessagingWebSocketClient {
    constructor() {
        this.ws = null;
        this.contactId = null;
        this.sessionGid = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectTimer = null;
        this.pingInterval = null;
        this.subscribed = new Set();
        this.status = 'disconnected';
        this.statusListeners = new Set();
        this.messageListeners = new Set();
    }
    onStatus(listener) {
        this.statusListeners.add(listener);
        listener(this.status);
        return () => this.statusListeners.delete(listener);
    }
    onMessage(listener) {
        this.messageListeners.add(listener);
        return () => this.messageListeners.delete(listener);
    }
    connect(contactId, sessionGid) {
        if (this.ws?.readyState === WebSocket.OPEN && this.contactId === contactId)
            return;
        this.contactId = contactId;
        this.sessionGid = sessionGid;
        this.reconnectAttempts = 0;
        this.doConnect();
    }
    disconnect() {
        this.stopPing();
        if (this.reconnectTimer)
            clearTimeout(this.reconnectTimer);
        this.abandonSocket();
        this.setStatus('disconnected');
    }
    subscribe(conversationId) {
        this.subscribed.add(conversationId);
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.send({ type: 'subscribe', conversation_id: conversationId });
        }
    }
    subscribeAll(ids) {
        ids.forEach((id) => this.subscribe(id));
    }
    setStatus(next) {
        this.status = next;
        this.statusListeners.forEach((l) => l(next));
    }
    doConnect() {
        if (!this.contactId || !this.sessionGid)
            return;
        this.setStatus('connecting');
        this.abandonSocket();
        try {
            const url = `${(0, messagingRuntime_1.getMessagingWsBaseUrl)()}/messaging/ws/${this.contactId}`;
            this.ws = new WebSocket(url);
        }
        catch {
            this.scheduleReconnect();
            return;
        }
        this.ws.onopen = () => {
            this.setStatus('connected');
            this.reconnectAttempts = 0;
            this.send({ type: 'auth', session_gid: this.sessionGid });
            this.subscribed.forEach((id) => this.send({ type: 'subscribe', conversation_id: id }));
            this.startPing();
        };
        this.ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(String(event.data));
                if (msg.type === 'auth_success')
                    this.setStatus('authenticated');
                this.messageListeners.forEach((l) => l(msg));
            }
            catch {
                /* ignore */
            }
        };
        this.ws.onclose = (event) => {
            this.setStatus('disconnected');
            this.stopPing();
            if (event.code === 4401 || event.code === 4403) {
                this.reconnectAttempts = this.maxReconnectAttempts;
                return;
            }
            this.scheduleReconnect();
        };
        this.ws.onerror = () => {
            /* onclose follows */
        };
    }
    abandonSocket() {
        if (!this.ws)
            return;
        this.ws.onopen = null;
        this.ws.onmessage = null;
        this.ws.onclose = null;
        this.ws.onerror = null;
        try {
            this.ws.close();
        }
        catch {
            /* ignore */
        }
        this.ws = null;
    }
    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts || !this.contactId)
            return;
        const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30000);
        this.reconnectAttempts += 1;
        this.reconnectTimer = setTimeout(() => this.doConnect(), delay);
    }
    startPing() {
        this.stopPing();
        this.pingInterval = setInterval(() => this.send({ type: 'ping' }), 25000);
    }
    stopPing() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }
    send(data) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }
}
exports.MessagingWebSocketClient = MessagingWebSocketClient;
exports.messagingWebSocket = new MessagingWebSocketClient();
