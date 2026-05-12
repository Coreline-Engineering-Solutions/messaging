import { EventEmitter } from '@angular/core';
import { Message, SearchFilter } from '../../models/messaging.models';
import { MessagingApiService } from '../../services/messaging-api.service';
import { AuthService } from '../../services/auth.service';
import * as i0 from "@angular/core";
export declare class SearchPanelComponent {
    private api;
    private auth;
    close: EventEmitter<void>;
    messageSelected: EventEmitter<Message>;
    query: string;
    filters: Partial<SearchFilter>;
    showFilters: boolean;
    results: Message[];
    loading: boolean;
    private searchSubject;
    constructor(api: MessagingApiService, auth: AuthService);
    onQueryChange(): void;
    performSearch(): void;
    clearSearch(): void;
    selectMessage(msg: Message): void;
    onClose(): void;
    formatDate(timestamp: string): string;
    highlightQuery(text: string): string;
    static ɵfac: i0.ɵɵFactoryDeclaration<SearchPanelComponent, never>;
    static ɵcmp: i0.ɵɵComponentDeclaration<SearchPanelComponent, "app-search-panel", never, {}, { "close": "close"; "messageSelected": "messageSelected"; }, never, never, true, never>;
}
