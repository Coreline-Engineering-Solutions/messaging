import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { MessagingConfig } from '../messaging.config';
import { AuthSession, Contact } from '../models/messaging.models';
import * as i0 from "@angular/core";
export declare class AuthService {
    private http;
    private config;
    private sessionGid$;
    private currentContact$;
    readonly session$: Observable<string>;
    readonly contact$: Observable<Contact>;
    constructor(http: HttpClient, config: MessagingConfig);
    get sessionGid(): string | null;
    get currentContact(): Contact | null;
    get contactId(): string | null;
    login(email: string, password: string): Observable<AuthSession>;
    setSession(sessionGid: string, contact: Contact): void;
    setDemoSession(sessionGid: string, contact: Contact): void;
    logout(): void;
    isAuthenticated(): boolean;
    private persistSession;
    static ɵfac: i0.ɵɵFactoryDeclaration<AuthService, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<AuthService>;
}
