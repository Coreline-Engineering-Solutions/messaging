import { EventEmitter, OnInit } from '@angular/core';
import { Message } from '../../models/messaging.models';
import { MessagingApiService } from '../../services/messaging-api.service';
import { AuthService } from '../../services/auth.service';
import * as i0 from "@angular/core";
export declare class ThreadViewerComponent implements OnInit {
    private api;
    private auth;
    parentMessage: Message;
    conversationId: string;
    close: EventEmitter<void>;
    replies: Message[];
    replyText: string;
    loading: boolean;
    isFollowing: boolean;
    constructor(api: MessagingApiService, auth: AuthService);
    ngOnInit(): void;
    loadThread(): void;
    sendReply(): void;
    toggleFollow(): void;
    onClose(): void;
    formatTime(timestamp: string): string;
    static ɵfac: i0.ɵɵFactoryDeclaration<ThreadViewerComponent, never>;
    static ɵcmp: i0.ɵɵComponentDeclaration<ThreadViewerComponent, "app-thread-viewer", never, { "parentMessage": { "alias": "parentMessage"; "required": false; }; "conversationId": { "alias": "conversationId"; "required": false; }; }, { "close": "close"; }, never, never, true, never>;
}
