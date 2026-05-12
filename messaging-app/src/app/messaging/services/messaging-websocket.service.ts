import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { WebSocketMessage } from '../models/messaging.models';

@Injectable({ providedIn: 'root' })
export class MessagingWebSocketService implements OnDestroy {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectTimer: any = null;
  private pingInterval: any = null;
  private subscribedConversations = new Set<string>();

  private contactId: string | null = null;
  private sessionGid: string | null = null;

  private messages$ = new Subject<WebSocketMessage>();
  private connectionStatus$ = new BehaviorSubject<'disconnected' | 'connecting' | 'connected' | 'authenticated'>('disconnected');

  readonly onMessage$ = this.messages$.asObservable();
  readonly status$ = this.connectionStatus$.asObservable();

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  connect(contactId: string, sessionGid: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.contactId === contactId) {
      return;
    }

    this.contactId = contactId;
    this.sessionGid = sessionGid;
    this.reconnectAttempts = 0;
    this.doConnect();
  }

  disconnect(): void {
    this.stopPing();
    clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this.connectionStatus$.next('disconnected');
  }

  subscribe(conversationId: string): void {
    this.subscribedConversations.add(conversationId);
    this.send({ action: 'subscribe', conversation_id: conversationId });
  }

  unsubscribe(conversationId: string): void {
    this.subscribedConversations.delete(conversationId);
    this.send({ action: 'unsubscribe', conversation_id: conversationId });
  }

  subscribeAll(conversationIds: string[]): void {
    conversationIds.forEach((id) => this.subscribe(id));
  }

  ngOnDestroy(): void {
    this.disconnect();
    this.messages$.complete();
  }

  private doConnect(): void {
    if (!this.contactId || !this.sessionGid) return;

    this.connectionStatus$.next('connecting');

    try {
      this.ws = new WebSocket(`${environment.wsBaseUrl}/messaging/ws/${this.contactId}`);
    } catch {
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

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const msg: WebSocketMessage = JSON.parse(event.data);
        if (msg.type === 'auth_success') {
          this.connectionStatus$.next('authenticated');
        }
        this.messages$.next(msg);
      } catch { /* ignore malformed */ }
    };

    this.ws.onerror = () => {
      // onerror is followed by onclose
    };

    this.ws.onclose = () => {
      this.connectionStatus$.next('disconnected');
      this.stopPing();
      this.attemptReconnect();
    };
  }

  private authenticate(): void {
    this.send({ action: 'auth', session_gid: this.sessionGid });
  }

  private resubscribe(): void {
    this.subscribedConversations.forEach((id) => {
      this.send({ action: 'subscribe', conversation_id: id });
    });
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectTimer = setTimeout(() => this.doConnect(), delay);
    this.reconnectAttempts++;
  }

  private startPing(): void {
    this.stopPing();
    this.pingInterval = setInterval(() => {
      this.send({ action: 'ping' });
    }, 25000);
  }

  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private send(data: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }
}
