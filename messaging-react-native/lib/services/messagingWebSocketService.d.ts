import type { WebSocketMessage, WsStatus } from '../types/messaging';
type StatusListener = (status: WsStatus) => void;
type MessageListener = (msg: WebSocketMessage) => void;
export declare class MessagingWebSocketClient {
    private ws;
    private contactId;
    private sessionGid;
    private reconnectAttempts;
    private maxReconnectAttempts;
    private reconnectTimer;
    private pingInterval;
    private subscribed;
    private status;
    private statusListeners;
    private messageListeners;
    onStatus(listener: StatusListener): () => void;
    onMessage(listener: MessageListener): () => void;
    connect(contactId: string, sessionGid: string): void;
    /** Reset backoff and reconnect (e.g. after network or app foreground recovery). */
    reconnect(): void;
    getStatus(): WsStatus;
    disconnect(): void;
    subscribe(conversationId: string): void;
    subscribeAll(ids: string[]): void;
    private setStatus;
    private doConnect;
    private abandonSocket;
    private scheduleReconnect;
    private startPing;
    private stopPing;
    private send;
}
export declare const messagingWebSocket: MessagingWebSocketClient;
export {};
//# sourceMappingURL=messagingWebSocketService.d.ts.map