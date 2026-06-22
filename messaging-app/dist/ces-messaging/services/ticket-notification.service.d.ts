import { OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { MessagingConfig } from '../messaging.config';
import { AuthService } from './auth.service';
import { MessagingWebSocketService } from './messaging-websocket.service';
import { TicketNotificationItem } from '../models/ticket-notification.model';
import * as i0 from "@angular/core";
export declare class TicketNotificationService implements OnDestroy {
    private http;
    private auth;
    private ws;
    private config;
    private readonly tickets$;
    private readonly unseenCount$;
    private wsSub;
    private wsStatusSub;
    private listening;
    readonly tickets: Observable<TicketNotificationItem[]>;
    readonly unseenCount: Observable<number>;
    constructor(http: HttpClient, auth: AuthService, ws: MessagingWebSocketService, config: MessagingConfig);
    get enabled(): boolean;
    get hasTickets(): boolean;
    ngOnDestroy(): void;
    /** @deprecated Use startListening */
    startPolling(): void;
    /** @deprecated Use stopListening */
    stopPolling(): void;
    startListening(): void;
    stopListening(): void;
    refresh(): void;
    loadTickets(): void;
    markSeen(ticket: TicketNotificationItem): void;
    navigateToDashboard(): void;
    private handleTicketEvent;
    private apiBase;
    private fetchTickets;
    private fetchUnseenCount;
    private getUserEmail;
    private getCookie;
    static ɵfac: i0.ɵɵFactoryDeclaration<TicketNotificationService, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<TicketNotificationService>;
}
