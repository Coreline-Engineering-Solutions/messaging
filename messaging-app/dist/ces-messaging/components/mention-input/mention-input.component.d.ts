import { EventEmitter, ElementRef } from '@angular/core';
import { Contact } from '../../models/messaging.models';
import * as i0 from "@angular/core";
export declare class MentionInputComponent {
    placeholder: string;
    contacts: Contact[];
    textChange: EventEmitter<string>;
    mention: EventEmitter<Contact>;
    textInput: ElementRef<HTMLTextAreaElement>;
    text: string;
    showSuggestions: boolean;
    filteredContacts: Contact[];
    selectedIndex: number;
    mentionStart: number;
    mentionQuery: string;
    onTextChange(): void;
    checkForMention(): void;
    filterContacts(): void;
    selectContact(contact: Contact): void;
    onKeyDown(event: KeyboardEvent): void;
    getText(): string;
    setText(value: string): void;
    clear(): void;
    static ɵfac: i0.ɵɵFactoryDeclaration<MentionInputComponent, never>;
    static ɵcmp: i0.ɵɵComponentDeclaration<MentionInputComponent, "app-mention-input", never, { "placeholder": { "alias": "placeholder"; "required": false; }; "contacts": { "alias": "contacts"; "required": false; }; }, { "textChange": "textChange"; "mention": "mention"; }, never, never, true, never>;
}
