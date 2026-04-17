import { OnInit, OnDestroy } from '@angular/core';
import { MessagingStoreService } from '../../services/messaging-store.service';
import { Contact } from '../../models/messaging.models';
import * as i0 from "@angular/core";
export declare class NewConversationComponent implements OnInit, OnDestroy {
    private store;
    contacts: Contact[];
    searchQuery: string;
    private sub;
    constructor(store: MessagingStoreService);
    ngOnInit(): void;
    ngOnDestroy(): void;
    get filteredContacts(): Contact[];
    getDisplayName(contact: Contact): string;
    selectContact(contact: Contact): void;
    goBack(): void;
    static ɵfac: i0.ɵɵFactoryDeclaration<NewConversationComponent, never>;
    static ɵcmp: i0.ɵɵComponentDeclaration<NewConversationComponent, "app-new-conversation", never, {}, {}, never, never, true, never>;
}
