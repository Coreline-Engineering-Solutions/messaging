import { EventEmitter, ElementRef } from '@angular/core';
import * as i0 from "@angular/core";
export interface MessagePayload {
    text: string;
    files: File[];
}
export declare class MessageInputComponent {
    messageSent: EventEmitter<string>;
    messageWithFiles: EventEmitter<MessagePayload>;
    fileInput: ElementRef<HTMLInputElement>;
    messageText: string;
    selectedFiles: File[];
    isDragOver: boolean;
    get canSend(): boolean;
    send(): void;
    onEnter(event: Event): void;
    onFilesSelected(event: Event): void;
    removeFile(index: number): void;
    onDragOver(event: DragEvent): void;
    onDragLeave(event: DragEvent): void;
    onDrop(event: DragEvent): void;
    getFileIcon(file: File): string;
    formatSize(bytes: number): string;
    static ɵfac: i0.ɵɵFactoryDeclaration<MessageInputComponent, never>;
    static ɵcmp: i0.ɵɵComponentDeclaration<MessageInputComponent, "app-message-input", never, {}, { "messageSent": "messageSent"; "messageWithFiles": "messageWithFiles"; }, never, never, true, never>;
}
