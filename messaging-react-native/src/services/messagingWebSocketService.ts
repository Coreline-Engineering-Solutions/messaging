import { getMessagingWsBaseUrl } from './messagingRuntime';
import type { WebSocketMessage, WsStatus } from '../types/messaging';

type StatusListener = (status: WsStatus) => void;
type MessageListener = (msg: WebSocketMessage) => void;

export class MessagingWebSocketClient {
  private ws: WebSocket | null = null;
  private contactId: string | null = null;
  private sessionGid: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private subscribed = new Set<string>();
  private status: WsStatus = 'disconnected';
  private statusListeners = new Set<StatusListener>();
  private messageListeners = new Set<MessageListener>();

  onStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => this.statusListeners.delete(listener);
  }

  onMessage(listener: MessageListener): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  connect(contactId: string, sessionGid: string): void {
    if (this.ws?.readyState === WebSocket.OPEN && this.contactId === contactId) return;
    this.contactId = contactId;
    this.sessionGid = sessionGid;
    this.reconnectAttempts = 0;
    this.doConnect();
  }

  disconnect(): void {
    this.stopPing();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.abandonSocket();
    this.setStatus('disconnected');
  }

  subscribe(conversationId: string): void {
    this.subscribed.add(conversationId);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({ type: 'subscribe', conversation_id: conversationId });
    }
  }

  subscribeAll(ids: string[]): void {
    ids.forEach((id) => this.subscribe(id));
  }

  private setStatus(next: WsStatus): void {
    this.status = next;
    this.statusListeners.forEach((l) => l(next));
  }

  private doConnect(): void {
    if (!this.contactId || !this.sessionGid) return;
    this.setStatus('connecting');
    this.abandonSocket();
    try {
      const url = `${getMessagingWsBaseUrl()}/messaging/ws/${this.contactId}`;
      this.ws = new WebSocket(url);
    } catch {
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
        const msg = JSON.parse(String(event.data)) as WebSocketMessage;
        if (msg.type === 'auth_success') this.setStatus('authenticated');
        this.messageListeners.forEach((l) => l(msg));
      } catch {
        /* ignore */
      }
    };

    this.ws.onclose = () => {
      this.setStatus('disconnected');
      this.stopPing();
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      /* onclose follows */
    };
  }

  private abandonSocket(): void {
    if (!this.ws) return;
    this.ws.onopen = null;
    this.ws.onmessage = null;
    this.ws.onclose = null;
    this.ws.onerror = null;
    try {
      this.ws.close();
    } catch {
      /* ignore */
    }
    this.ws = null;
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts || !this.contactId) return;
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30000);
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => this.doConnect(), delay);
  }

  private startPing(): void {
    this.stopPing();
    this.pingInterval = setInterval(() => this.send({ type: 'ping' }), 25000);
  }

  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private send(data: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }
}

export const messagingWebSocket = new MessagingWebSocketClient();
