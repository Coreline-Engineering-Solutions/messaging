import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { MessagingConfig } from '../messaging.config';
import { AuthSession, Contact } from '../models/messaging.models';
import * as i0 from "@angular/core";
export declare class MessagingAuthBridgeService {
    private http;
    private config;
    constructor(http: HttpClient, config: MessagingConfig);
    /**
     * Authenticate with auth-api using email and password.
     * Returns session_gid and contact information.
     */
    authenticateForMessaging(email: string, password: string): Observable<{
        session: AuthSession;
        contact: Contact;
    }>;
    /**
     * Check if a messaging session exists in localStorage.
     */
    hasStoredSession(): boolean;
    /**
     * Attempt to use existing session to get messaging session.
     */
    initializeFromExistingSession(email: string): Observable<{
        session: AuthSession;
        contact: Contact;
    } | null>;
    static ɵfac: i0.ɵɵFactoryDeclaration<MessagingAuthBridgeService, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<MessagingAuthBridgeService>;
}
