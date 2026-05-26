import { EventEmitter } from '@angular/core';
import { Message } from '../../models/messaging.models';
import * as i0 from "@angular/core";
export declare class MessageActionsComponent {
    message: Message;
    currentUserId: string;
    canPin: boolean;
    reply: EventEmitter<Message>;
    react: EventEmitter<Message>;
    edit: EventEmitter<Message>;
    delete: EventEmitter<Message>;
    pin: EventEmitter<Message>;
    copy: EventEmitter<Message>;
    get canEdit(): boolean;
    get canDelete(): boolean;
    private get isDeleted();
    onReply(): void;
    onReact(): void;
    onEdit(): void;
    onDelete(): void;
    onPin(): void;
    onCopy(): void;
    static ɵfac: i0.ɵɵFactoryDeclaration<MessageActionsComponent, never>;
    static ɵcmp: i0.ɵɵComponentDeclaration<MessageActionsComponent, "app-message-actions", never, { "message": { "alias": "message"; "required": false; }; "currentUserId": { "alias": "currentUserId"; "required": false; }; "canPin": { "alias": "canPin"; "required": false; }; }, { "reply": "reply"; "react": "react"; "edit": "edit"; "delete": "delete"; "pin": "pin"; "copy": "copy"; }, never, never, true, never>;
}
