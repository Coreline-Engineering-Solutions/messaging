import { OnInit, OnDestroy } from '@angular/core';
import { MessagingStoreService } from '../../services/messaging-store.service';
import { SidebarSide } from '../../models/messaging.models';
import * as i0 from "@angular/core";
export declare class ChatPanelComponent implements OnInit, OnDestroy {
    private store;
    isOpen: boolean;
    activeView: 'inbox' | 'chat' | 'new-conversation' | 'group-manager' | 'conversation-settings';
    wsStatus: string;
    side: SidebarSide;
    sidebarWidth: number;
    private defaultWidth;
    private resizing;
    private resizeStartX;
    private resizeStartWidth;
    private boundResizeMove;
    private boundResizeEnd;
    private sub;
    constructor(store: MessagingStoreService);
    ngOnInit(): void;
    ngOnDestroy(): void;
    toggleSide(): void;
    close(): void;
    onResizeStart(event: MouseEvent): void;
    private onResizeMove;
    private onResizeEnd;
    static ɵfac: i0.ɵɵFactoryDeclaration<ChatPanelComponent, never>;
    static ɵcmp: i0.ɵɵComponentDeclaration<ChatPanelComponent, "app-chat-panel", never, {}, {}, never, never, true, never>;
}
