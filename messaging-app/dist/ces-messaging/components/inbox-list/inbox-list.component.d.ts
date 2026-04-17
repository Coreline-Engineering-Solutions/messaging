import { OnInit, OnDestroy } from '@angular/core';
import { MessagingStoreService } from '../../services/messaging-store.service';
import { InboxItem } from '../../models/messaging.models';
import * as i0 from "@angular/core";
export declare class InboxListComponent implements OnInit, OnDestroy {
    private store;
    inbox: InboxItem[];
    searchQuery: string;
    contextMenu: {
        x: number;
        y: number;
        item: InboxItem;
    } | null;
    private sub;
    constructor(store: MessagingStoreService);
    ngOnInit(): void;
    ngOnDestroy(): void;
    get filteredInbox(): InboxItem[];
    openConversation(item: InboxItem): void;
    onNewConversation(): void;
    onCreateGroup(): void;
    onContextMenu(event: MouseEvent, item: InboxItem): void;
    closeContextMenu(): void;
    clearChat(): void;
    deleteChat(): void;
    formatTime(dateStr: string): string;
    static ɵfac: i0.ɵɵFactoryDeclaration<InboxListComponent, never>;
    static ɵcmp: i0.ɵɵComponentDeclaration<InboxListComponent, "app-inbox-list", never, {}, {}, never, never, true, never>;
}
