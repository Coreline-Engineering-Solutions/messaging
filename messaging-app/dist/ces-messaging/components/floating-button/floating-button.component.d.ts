import { OnInit, OnDestroy } from '@angular/core';
import { MessagingStoreService } from '../../services/messaging-store.service';
import { SidebarSide } from '../../models/messaging.models';
import * as i0 from "@angular/core";
export declare class FloatingButtonComponent implements OnInit, OnDestroy {
    private store;
    unreadCount: number;
    side: SidebarSide;
    isOpen: boolean;
    private sub;
    constructor(store: MessagingStoreService);
    ngOnInit(): void;
    ngOnDestroy(): void;
    toggle(): void;
    static ɵfac: i0.ɵɵFactoryDeclaration<FloatingButtonComponent, never>;
    static ɵcmp: i0.ɵɵComponentDeclaration<FloatingButtonComponent, "app-floating-button", never, {}, {}, never, never, true, never>;
}
