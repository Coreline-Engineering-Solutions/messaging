import { OnInit } from '@angular/core';
import { MessagingStoreService } from './services/messaging-store.service';
import { AuthService } from './services/auth.service';
import * as i0 from "@angular/core";
export declare class MessagingOverlayComponent implements OnInit {
    private store;
    private auth;
    isAuthenticated: boolean;
    constructor(store: MessagingStoreService, auth: AuthService);
    ngOnInit(): void;
    private initializeMessagingAuth;
    static ɵfac: i0.ɵɵFactoryDeclaration<MessagingOverlayComponent, never>;
    static ɵcmp: i0.ɵɵComponentDeclaration<MessagingOverlayComponent, "app-messaging-overlay", never, {}, {}, never, never, true, never>;
}
