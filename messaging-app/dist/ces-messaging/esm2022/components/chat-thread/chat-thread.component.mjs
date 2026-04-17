import { Component, ViewChild, } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { combineLatest } from 'rxjs';
import { getMessageSenderName } from '../../models/messaging.models';
import { MessageInputComponent } from '../message-input/message-input.component';
import * as i0 from "@angular/core";
import * as i1 from "../../services/messaging-store.service";
import * as i2 from "../../services/auth.service";
import * as i3 from "../../services/messaging-file.service";
import * as i4 from "@angular/common";
import * as i5 from "@angular/material/icon";
import * as i6 from "@angular/material/button";
import * as i7 from "@angular/material/progress-spinner";
import * as i8 from "@angular/material/tooltip";
export class ChatThreadComponent {
    store;
    auth;
    fileService;
    scrollContainer;
    messages = [];
    conversationName = '';
    loading = false;
    myContactId = null;
    conversationId = null;
    sub;
    shouldScrollToBottom = true;
    uploading = false;
    constructor(store, auth, fileService) {
        this.store = store;
        this.auth = auth;
        this.fileService = fileService;
    }
    ngOnInit() {
        this.myContactId = this.auth.contactId;
        this.sub = combineLatest([
            this.store.activeConversationId,
            this.store.messagesMap,
            this.store.openChats,
            this.store.loadingMessages,
        ]).subscribe(([convId, msgMap, chats, loading]) => {
            this.loading = loading;
            if (convId && convId !== this.conversationId) {
                this.conversationId = convId;
                this.shouldScrollToBottom = true;
                const chat = chats.find((c) => c.conversationId === convId);
                this.conversationName = chat?.name || 'Chat';
            }
            if (this.conversationId) {
                const prevLen = this.messages.length;
                this.messages = msgMap.get(this.conversationId) || [];
                if (this.messages.length > prevLen) {
                    this.shouldScrollToBottom = true;
                }
            }
        });
    }
    ngAfterViewChecked() {
        if (this.shouldScrollToBottom) {
            this.scrollToBottom();
            this.shouldScrollToBottom = false;
        }
    }
    ngOnDestroy() {
        this.sub?.unsubscribe();
    }
    goBack() {
        this.store.setView('inbox');
    }
    onClearConversation() {
        if (this.conversationId) {
            this.store.clearConversation(this.conversationId);
        }
    }
    onDeleteConversation() {
        if (this.conversationId) {
            this.store.deleteConversation(this.conversationId);
        }
    }
    onSendMessage(content) {
        this.store.sendMessage(this.conversationId, content);
        this.shouldScrollToBottom = true;
    }
    onSendWithFiles(payload) {
        if (!this.conversationId)
            return;
        this.uploading = true;
        this.fileService.uploadFiles(payload.files).subscribe({
            next: (responses) => {
                const fileIds = responses.map((r) => r.file_id);
                const filenames = responses.map((r) => r.filename);
                this.fileService
                    .sendMessageWithAttachments(this.conversationId, this.auth.contactId, payload.text || filenames.join(', '), fileIds, filenames)
                    .subscribe({
                    next: () => {
                        this.uploading = false;
                        this.shouldScrollToBottom = true;
                    },
                    error: (err) => {
                        console.error('Failed to send attachments:', err);
                        this.uploading = false;
                    },
                });
            },
            error: (err) => {
                console.error('File upload failed:', err);
                this.uploading = false;
            },
        });
    }
    loadOlder() {
        if (this.conversationId && this.messages.length > 0) {
            this.store.loadMessages(this.conversationId, this.messages[0].message_id);
        }
    }
    onScroll() { }
    shouldShowDateSeparator(index) {
        if (index === 0)
            return true;
        const curr = new Date(this.messages[index].created_at).toDateString();
        const prev = new Date(this.messages[index - 1].created_at).toDateString();
        return curr !== prev;
    }
    shouldShowSender(index) {
        if (index === 0)
            return true;
        return this.messages[index].sender_id !== this.messages[index - 1].sender_id;
    }
    isOwnMessage(msg) {
        return String(msg.sender_id) === String(this.myContactId);
    }
    getSenderName(msg) {
        return getMessageSenderName(msg);
    }
    formatTime(dateStr) {
        if (!dateStr)
            return '';
        const d = new Date(dateStr);
        return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    }
    formatDate(dateStr) {
        const d = new Date(dateStr);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        if (d.toDateString() === today.toDateString())
            return 'Today';
        if (d.toDateString() === yesterday.toDateString())
            return 'Yesterday';
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    scrollToBottom() {
        try {
            const el = this.scrollContainer?.nativeElement;
            if (el) {
                el.scrollTop = el.scrollHeight;
            }
        }
        catch { /* ignore */ }
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: ChatThreadComponent, deps: [{ token: i1.MessagingStoreService }, { token: i2.AuthService }, { token: i3.MessagingFileService }], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "17.3.12", type: ChatThreadComponent, isStandalone: true, selector: "app-chat-thread", viewQueries: [{ propertyName: "scrollContainer", first: true, predicate: ["scrollContainer"], descendants: true }], ngImport: i0, template: `
    <div class="chat-thread">
      <div class="chat-header">
        <button mat-icon-button class="hdr-btn" (click)="goBack()" matTooltip="Back" matTooltipPosition="below">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <div class="header-info">
          <span class="chat-name">{{ conversationName }}</span>
        </div>
        <div class="header-actions">
          <button mat-icon-button class="hdr-btn" (click)="onClearConversation()" matTooltip="Clear conversation" matTooltipPosition="below">
            <mat-icon>cleaning_services</mat-icon>
          </button>
          <button mat-icon-button class="hdr-btn" (click)="onDeleteConversation()" matTooltip="Delete conversation" matTooltipPosition="below">
            <mat-icon>delete_outline</mat-icon>
          </button>
        </div>
      </div>

      <div class="messages-area" #scrollContainer (scroll)="onScroll()">
        <div *ngIf="loading" class="loading-indicator">
          <mat-spinner diameter="24"></mat-spinner>
          <span>Loading messages...</span>
        </div>

        <button
          *ngIf="messages.length >= 50 && !loading"
          mat-stroked-button
          class="load-more-btn"
          (click)="loadOlder()"
        >
          Load older messages
        </button>

        <div class="messages-list">
          <ng-container *ngFor="let msg of messages; let i = index">
            <div
              *ngIf="shouldShowDateSeparator(i)"
              class="date-separator"
            >
              <span>{{ formatDate(msg.created_at) }}</span>
            </div>

            <div
              class="message-bubble-row"
              [class.own]="isOwnMessage(msg)"
              [class.other]="!isOwnMessage(msg)"
            >
              <div *ngIf="!isOwnMessage(msg) && shouldShowSender(i)" class="sender-name">
                {{ getSenderName(msg) }}
              </div>
              <div class="message-bubble" [class.own-bubble]="isOwnMessage(msg)">
                <div *ngIf="msg.message_type === 'IMAGE'" class="image-message">
                  <img [src]="msg.media_url || msg.content" alt="Image" />
                </div>
                <div *ngIf="msg.message_type === 'FILE'" class="file-message">
                  <mat-icon class="file-msg-icon">insert_drive_file</mat-icon>
                  <span class="file-msg-name">{{ msg.content }}</span>
                </div>
                <div *ngIf="msg.message_type === 'TEXT'" class="text-content">
                  {{ msg.content }}
                </div>
                <div class="message-meta">
                  <span class="msg-time">{{ formatTime(msg.created_at) }}</span>
                  <mat-icon *ngIf="isOwnMessage(msg) && msg.is_read" class="read-icon">done_all</mat-icon>
                  <mat-icon *ngIf="isOwnMessage(msg) && !msg.is_read" class="read-icon unread">done</mat-icon>
                </div>
              </div>
            </div>
          </ng-container>
        </div>

        <div *ngIf="messages.length === 0 && !loading" class="empty-chat">
          <mat-icon>chat_bubble_outline</mat-icon>
          <p>No messages yet. Say hello!</p>
        </div>
      </div>

      <app-message-input
        (messageSent)="onSendMessage($event)"
        (messageWithFiles)="onSendWithFiles($event)"
      ></app-message-input>
    </div>
  `, isInline: true, styles: [".chat-thread{display:flex;flex-direction:column;height:100%;background:linear-gradient(180deg,#1f4bd8,#173396)}.chat-header{display:flex;align-items:center;padding:8px 8px 8px 4px;border-bottom:1px solid rgba(255,255,255,.15);gap:4px;flex-shrink:0}.chat-header button mat-icon{color:#fffc}.chat-name{font-size:16px;font-weight:600;color:#fff}.header-info{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;padding:0 4px}.header-actions{display:flex;gap:0}.header-actions button{width:32px;height:32px}.hdr-btn{border-radius:6px!important;transition:background .15s,box-shadow .15s}.hdr-btn:hover{background:#ffffff26!important;box-shadow:0 2px 8px #0003}.messages-area{flex:1;overflow-y:auto;padding:12px}.loading-indicator{display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;color:#ffffffb3;font-size:13px}.load-more-btn{align-self:center;margin-bottom:16px;font-size:12px;color:#fff}.messages-list{display:flex;flex-direction:column;gap:2px;flex:1}.date-separator{text-align:center;margin:16px 0 8px;font-size:12px;color:#ffffffb3;font-weight:500}.message-bubble-row{display:flex;flex-direction:column;max-width:80%;margin-bottom:4px}.message-bubble-row.own{align-self:flex-end;align-items:flex-end}.message-bubble-row.other{align-self:flex-start;align-items:flex-start}.sender-name{font-size:11px;color:#fff9;margin-bottom:2px;margin-left:12px}.message-bubble{padding:10px 14px;border-radius:18px;font-size:14px;line-height:1.4;word-break:break-word;color:#fff}.message-bubble-row.other .message-bubble{background:#ffffff1a;border-bottom-left-radius:6px;box-shadow:0 1px 2px #0000001a}.message-bubble.own-bubble{background:linear-gradient(135deg,#2a5bff,#1f4bd8);border-bottom-right-radius:6px}.image-message img{max-width:240px;border-radius:12px;display:block}.file-message{display:flex;align-items:center;gap:8px;padding:4px 0}.file-msg-icon{font-size:20px;width:20px;height:20px;color:#fffc}.file-msg-name{font-size:13px;color:#fff;word-break:break-all}.message-meta{display:flex;align-items:center;gap:4px;margin-top:4px}.msg-time{font-size:11px;color:#fff9}.message-bubble-row.other .msg-time{color:#9ca3af}.read-icon{font-size:14px;width:14px;height:14px;opacity:.7}.read-icon.unread{opacity:.4}.empty-chat{display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;color:#9ca3af}.empty-chat mat-icon{font-size:48px;width:48px;height:48px;margin-bottom:8px}.empty-chat p{font-size:14px;margin:0}\n"], dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i4.NgForOf, selector: "[ngFor][ngForOf]", inputs: ["ngForOf", "ngForTrackBy", "ngForTemplate"] }, { kind: "directive", type: i4.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "ngmodule", type: MatIconModule }, { kind: "component", type: i5.MatIcon, selector: "mat-icon", inputs: ["color", "inline", "svgIcon", "fontSet", "fontIcon"], exportAs: ["matIcon"] }, { kind: "ngmodule", type: MatButtonModule }, { kind: "component", type: i6.MatButton, selector: "    button[mat-button], button[mat-raised-button], button[mat-flat-button],    button[mat-stroked-button]  ", exportAs: ["matButton"] }, { kind: "component", type: i6.MatIconButton, selector: "button[mat-icon-button]", exportAs: ["matButton"] }, { kind: "ngmodule", type: MatProgressSpinnerModule }, { kind: "component", type: i7.MatProgressSpinner, selector: "mat-progress-spinner, mat-spinner", inputs: ["color", "mode", "value", "diameter", "strokeWidth"], exportAs: ["matProgressSpinner"] }, { kind: "ngmodule", type: MatTooltipModule }, { kind: "directive", type: i8.MatTooltip, selector: "[matTooltip]", inputs: ["matTooltipPosition", "matTooltipPositionAtOrigin", "matTooltipDisabled", "matTooltipShowDelay", "matTooltipHideDelay", "matTooltipTouchGestures", "matTooltip", "matTooltipClass"], exportAs: ["matTooltip"] }, { kind: "component", type: MessageInputComponent, selector: "app-message-input", outputs: ["messageSent", "messageWithFiles"] }] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: ChatThreadComponent, decorators: [{
            type: Component,
            args: [{ selector: 'app-chat-thread', standalone: true, imports: [
                        CommonModule, MatIconModule, MatButtonModule,
                        MatProgressSpinnerModule, MatTooltipModule, MessageInputComponent,
                    ], template: `
    <div class="chat-thread">
      <div class="chat-header">
        <button mat-icon-button class="hdr-btn" (click)="goBack()" matTooltip="Back" matTooltipPosition="below">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <div class="header-info">
          <span class="chat-name">{{ conversationName }}</span>
        </div>
        <div class="header-actions">
          <button mat-icon-button class="hdr-btn" (click)="onClearConversation()" matTooltip="Clear conversation" matTooltipPosition="below">
            <mat-icon>cleaning_services</mat-icon>
          </button>
          <button mat-icon-button class="hdr-btn" (click)="onDeleteConversation()" matTooltip="Delete conversation" matTooltipPosition="below">
            <mat-icon>delete_outline</mat-icon>
          </button>
        </div>
      </div>

      <div class="messages-area" #scrollContainer (scroll)="onScroll()">
        <div *ngIf="loading" class="loading-indicator">
          <mat-spinner diameter="24"></mat-spinner>
          <span>Loading messages...</span>
        </div>

        <button
          *ngIf="messages.length >= 50 && !loading"
          mat-stroked-button
          class="load-more-btn"
          (click)="loadOlder()"
        >
          Load older messages
        </button>

        <div class="messages-list">
          <ng-container *ngFor="let msg of messages; let i = index">
            <div
              *ngIf="shouldShowDateSeparator(i)"
              class="date-separator"
            >
              <span>{{ formatDate(msg.created_at) }}</span>
            </div>

            <div
              class="message-bubble-row"
              [class.own]="isOwnMessage(msg)"
              [class.other]="!isOwnMessage(msg)"
            >
              <div *ngIf="!isOwnMessage(msg) && shouldShowSender(i)" class="sender-name">
                {{ getSenderName(msg) }}
              </div>
              <div class="message-bubble" [class.own-bubble]="isOwnMessage(msg)">
                <div *ngIf="msg.message_type === 'IMAGE'" class="image-message">
                  <img [src]="msg.media_url || msg.content" alt="Image" />
                </div>
                <div *ngIf="msg.message_type === 'FILE'" class="file-message">
                  <mat-icon class="file-msg-icon">insert_drive_file</mat-icon>
                  <span class="file-msg-name">{{ msg.content }}</span>
                </div>
                <div *ngIf="msg.message_type === 'TEXT'" class="text-content">
                  {{ msg.content }}
                </div>
                <div class="message-meta">
                  <span class="msg-time">{{ formatTime(msg.created_at) }}</span>
                  <mat-icon *ngIf="isOwnMessage(msg) && msg.is_read" class="read-icon">done_all</mat-icon>
                  <mat-icon *ngIf="isOwnMessage(msg) && !msg.is_read" class="read-icon unread">done</mat-icon>
                </div>
              </div>
            </div>
          </ng-container>
        </div>

        <div *ngIf="messages.length === 0 && !loading" class="empty-chat">
          <mat-icon>chat_bubble_outline</mat-icon>
          <p>No messages yet. Say hello!</p>
        </div>
      </div>

      <app-message-input
        (messageSent)="onSendMessage($event)"
        (messageWithFiles)="onSendWithFiles($event)"
      ></app-message-input>
    </div>
  `, styles: [".chat-thread{display:flex;flex-direction:column;height:100%;background:linear-gradient(180deg,#1f4bd8,#173396)}.chat-header{display:flex;align-items:center;padding:8px 8px 8px 4px;border-bottom:1px solid rgba(255,255,255,.15);gap:4px;flex-shrink:0}.chat-header button mat-icon{color:#fffc}.chat-name{font-size:16px;font-weight:600;color:#fff}.header-info{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;padding:0 4px}.header-actions{display:flex;gap:0}.header-actions button{width:32px;height:32px}.hdr-btn{border-radius:6px!important;transition:background .15s,box-shadow .15s}.hdr-btn:hover{background:#ffffff26!important;box-shadow:0 2px 8px #0003}.messages-area{flex:1;overflow-y:auto;padding:12px}.loading-indicator{display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;color:#ffffffb3;font-size:13px}.load-more-btn{align-self:center;margin-bottom:16px;font-size:12px;color:#fff}.messages-list{display:flex;flex-direction:column;gap:2px;flex:1}.date-separator{text-align:center;margin:16px 0 8px;font-size:12px;color:#ffffffb3;font-weight:500}.message-bubble-row{display:flex;flex-direction:column;max-width:80%;margin-bottom:4px}.message-bubble-row.own{align-self:flex-end;align-items:flex-end}.message-bubble-row.other{align-self:flex-start;align-items:flex-start}.sender-name{font-size:11px;color:#fff9;margin-bottom:2px;margin-left:12px}.message-bubble{padding:10px 14px;border-radius:18px;font-size:14px;line-height:1.4;word-break:break-word;color:#fff}.message-bubble-row.other .message-bubble{background:#ffffff1a;border-bottom-left-radius:6px;box-shadow:0 1px 2px #0000001a}.message-bubble.own-bubble{background:linear-gradient(135deg,#2a5bff,#1f4bd8);border-bottom-right-radius:6px}.image-message img{max-width:240px;border-radius:12px;display:block}.file-message{display:flex;align-items:center;gap:8px;padding:4px 0}.file-msg-icon{font-size:20px;width:20px;height:20px;color:#fffc}.file-msg-name{font-size:13px;color:#fff;word-break:break-all}.message-meta{display:flex;align-items:center;gap:4px;margin-top:4px}.msg-time{font-size:11px;color:#fff9}.message-bubble-row.other .msg-time{color:#9ca3af}.read-icon{font-size:14px;width:14px;height:14px;opacity:.7}.read-icon.unread{opacity:.4}.empty-chat{display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;color:#9ca3af}.empty-chat mat-icon{font-size:48px;width:48px;height:48px;margin-bottom:8px}.empty-chat p{font-size:14px;margin:0}\n"] }]
        }], ctorParameters: () => [{ type: i1.MessagingStoreService }, { type: i2.AuthService }, { type: i3.MessagingFileService }], propDecorators: { scrollContainer: [{
                type: ViewChild,
                args: ['scrollContainer']
            }] } });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdC10aHJlYWQuY29tcG9uZW50LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL2xpYi9jb21wb25lbnRzL2NoYXQtdGhyZWFkL2NoYXQtdGhyZWFkLmNvbXBvbmVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQ0wsU0FBUyxFQUFxQixTQUFTLEdBQ3hDLE1BQU0sZUFBZSxDQUFDO0FBQ3ZCLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUMvQyxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sd0JBQXdCLENBQUM7QUFDdkQsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBQzNELE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQzlFLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBQzdELE9BQU8sRUFBZ0IsYUFBYSxFQUFFLE1BQU0sTUFBTSxDQUFDO0FBSW5ELE9BQU8sRUFBVyxvQkFBb0IsRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQzlFLE9BQU8sRUFBRSxxQkFBcUIsRUFBa0IsTUFBTSwwQ0FBMEMsQ0FBQzs7Ozs7Ozs7OztBQWtUakcsTUFBTSxPQUFPLG1CQUFtQjtJQWVwQjtJQUNBO0lBQ0E7SUFoQm9CLGVBQWUsQ0FBYztJQUUzRCxRQUFRLEdBQWMsRUFBRSxDQUFDO0lBQ3pCLGdCQUFnQixHQUFHLEVBQUUsQ0FBQztJQUN0QixPQUFPLEdBQUcsS0FBSyxDQUFDO0lBQ2hCLFdBQVcsR0FBa0IsSUFBSSxDQUFDO0lBRTFCLGNBQWMsR0FBa0IsSUFBSSxDQUFDO0lBQ3JDLEdBQUcsQ0FBZ0I7SUFDbkIsb0JBQW9CLEdBQUcsSUFBSSxDQUFDO0lBRXBDLFNBQVMsR0FBRyxLQUFLLENBQUM7SUFFbEIsWUFDVSxLQUE0QixFQUM1QixJQUFpQixFQUNqQixXQUFpQztRQUZqQyxVQUFLLEdB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QUNQLEVBQUUsQ0FBQyxTQUFTLEdBQUcsRUFBRSxDQUFDLFlBQVksQ0FBQztZQUNqQyxDQUFDO1FBQ0gsQ0FBQztRQUFDLE1BQU0sQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDO0lBQzFCLENBQUM7d0dBcktVLG1CQUFtQjs0RkFBbkIsbUJBQW1CLCtMQXpTcEI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBbUZULDYvRUF0RkMsWUFBWSwrUEFBRSxhQUFhLG1MQUFFLGVBQWUsd1VBQzVDLHdCQUF3QixrT0FBRSxnQkFBZ0IsNlRBQUUscUJBQXFCOzs0RkEyU3hELG1CQUFtQjtrQkFoVC9CLFNBQVM7K0JBQ0UsaUJBQWlCLGNBQ2YsSUFBSSxXQUNQO3dCQUNQLFlBQVksRUFBRSxhQUFhLEVBQUUsZUFBZTt3QkFDNUMsd0JBQXdCLEVBQUUsZ0JBQWdCLEVBQUUscUJBQXFCO3FCQUNsRSxZQUNTOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQW1GVDt1SkF1TjZCLGVBQWU7c0JBQTVDLFNBQVM7dUJBQUMsaUJBQWlCIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtcbiAgQ29tcG9uZW50LCBPbkluaXQsIE9uRGVzdHJveSwgVmlld0NoaWxkLCBFbGVtZW50UmVmLCBBZnRlclZpZXdDaGVja2VkLFxufSBmcm9tICdAYW5ndWxhci9jb3JlJztcbmltcG9ydCB7IENvbW1vbk1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL2NvbW1vbic7XG5pbXBvcnQgeyBNYXRJY29uTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvbWF0ZXJpYWwvaWNvbic7XG5pbXBvcnQgeyBNYXRCdXR0b25Nb2R1bGUgfSBmcm9tICdAYW5ndWxhci9tYXRlcmlhbC9idXR0b24nO1xuaW1wb3J0IHsgTWF0UHJvZ3Jlc3NTcGlubmVyTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvbWF0ZXJpYWwvcHJvZ3Jlc3Mtc3Bpbm5lcic7XG5pbXBvcnQgeyBNYXRUb29sdGlwTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvbWF0ZXJpYWwvdG9vbHRpcCc7XG5pbXBvcnQgeyBTdWJzY3JpcHRpb24sIGNvbWJpbmVMYXRlc3QgfSBmcm9tICdyeGpzJztcbmltcG9ydCB7IE1lc3NhZ2luZ1N0b3JlU2VydmljZSB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL21lc3NhZ2luZy1zdG9yZS5zZXJ2aWNlJztcbmltcG9ydCB7IE1lc3NhZ2luZ0ZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvbWVzc2FnaW5nLWZpbGUuc2VydmljZSc7XG5pbXBvcnQgeyBBdXRoU2VydmljZSB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL2F1dGguc2VydmljZSc7XG5pbXBvcnQgeyBNZXNzYWdlLCBnZXRNZXNzYWdlU2VuZGVyTmFtZSB9IGZyb20gJy4uLy4uL21vZGVscy9tZXNzYWdpbmcubW9kZWxzJztcbmltcG9ydCB7IE1lc3NhZ2VJbnB1dENvbXBvbmVudCwgTWVzc2FnZVBheWxvYWQgfSBmcm9tICcuLi9tZXNzYWdlLWlucHV0L21lc3NhZ2UtaW5wdXQuY29tcG9uZW50JztcblxuQENvbXBvbmVudCh7XG4gIHNlbGVjdG9yOiAnYXBwLWNoYXQtdGhyZWFkJyxcbiAgc3RhbmRhbG9uZTogdHJ1ZSxcbiAgaW1wb3J0czogW1xuICAgIENvbW1vbk1vZHVsZSwgTWF0SWNvbk1vZHVsZSwgTWF0QnV0dG9uTW9kdWxlLFxuICAgIE1hdFByb2dyZXNzU3Bpbm5lck1vZHVsZSwgTWF0VG9vbHRpcE1vZHVsZSwgTWVzc2FnZUlucHV0Q29tcG9uZW50LFxuICBdLFxuICB0ZW1wbGF0ZTogYFxuICAgIDxkaXYgY2xhc3M9XCJjaGF0LXRocmVhZFwiPlxuICAgICAgPGRpdiBjbGFzcz1cImNoYXQtaGVhZGVyXCI+XG4gICAgICAgIDxidXR0b24gbWF0LWljb24tYnV0dG9uIGNsYXNzPVwiaGRyLWJ0blwiIChjbGljayk9XCJnb0JhY2soKVwiIG1hdFRvb2x0aXA9XCJCYWNrXCIgbWF0VG9vbHRpcFBvc2l0aW9uPVwiYmVsb3dcIj5cbiAgICAgICAgICA8bWF0LWljb24+YXJyb3dfYmFjazwvbWF0LWljb24+XG4gICAgICAgIDwvYnV0dG9uPlxuICAgICAgICA8ZGl2IGNsYXNzPVwiaGVhZGVyLWluZm9cIj5cbiAgICAgICAgICA8c3BhbiBjbGFzcz1cImNoYXQtbmFtZVwiPnt7IGNvbnZlcnNhdGlvbk5hbWUgfX08L3NwYW4+XG4gICAgICAgIDwvZGl2PlxuICAgICAgICA8ZGl2IGNsYXNzPVwiaGVhZGVyLWFjdGlvbnNcIj5cbiAgICAgICAgICA8YnV0dG9uIG1hdC1pY29uLWJ1dHRvbiBjbGFzcz1cImhkci1idG5cIiAoY2xpY2spPVwib25DbGVhckNvbnZlcnNhdGlvbigpXCIgbWF0VG9vbHRpcD1cIkNsZWFyIGNvbnZlcnNhdGlvblwiIG1hdFRvb2x0aXBQb3NpdGlvbj1cImJlbG93XCI+XG4gICAgICAgICAgICA8bWF0LWljb24+Y2xlYW5pbmdfc2VydmljZXM8L21hdC1pY29uPlxuICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgIDxidXR0b24gbWF0LWljb24tYnV0dG9uIGNsYXNzPVwiaGRyLWJ0blwiIChjbGljayk9XCJvbkRlbGV0ZUNvbnZlcnNhdGlvbigpXCIgbWF0VG9vbHRpcD1cIkRlbGV0ZSBjb252ZXJzYXRpb25cIiBtYXRUb29sdGlwUG9zaXRpb249XCJiZWxvd1wiPlxuICAgICAgICAgICAgPG1hdC1pY29uPmRlbGV0ZV9vdXRsaW5lPC9tYXQtaWNvbj5cbiAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cblxuICAgICAgPGRpdiBjbGFzcz1cIm1lc3NhZ2VzLWFyZWFcIiAjc2Nyb2xsQ29udGFpbmVyIChzY3JvbGwpPVwib25TY3JvbGwoKVwiPlxuICAgICAgICA8ZGl2ICpuZ0lmPVwibG9hZGluZ1wiIGNsYXNzPVwibG9hZGluZy1pbmRpY2F0b3JcIj5cbiAgICAgICAgICA8bWF0LXNwaW5uZXIgZGlhbWV0ZXI9XCIyNFwiPjwvbWF0LXNwaW5uZXI+XG4gICAgICAgICAgPHNwYW4+TG9hZGluZyBtZXNzYWdlcy4uLjwvc3Bhbj5cbiAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICpuZ0lmPVwibWVzc2FnZXMubGVuZ3RoID49IDUwICYmICFsb2FkaW5nXCJcbiAgICAgICAgICBtYXQtc3Ryb2tlZC1idXR0b25cbiAgICAgICAgICBjbGFzcz1cImxvYWQtbW9yZS1idG5cIlxuICAgICAgICAgIChjbGljayk9XCJsb2FkT2xkZXIoKVwiXG4gICAgICAgID5cbiAgICAgICAgICBMb2FkIG9sZGVyIG1lc3NhZ2VzXG4gICAgICAgIDwvYnV0dG9uPlxuXG4gICAgICAgIDxkaXYgY2xhc3M9XCJtZXNzYWdlcy1saXN0XCI+XG4gICAgICAgICAgPG5nLWNvbnRhaW5lciAqbmdGb3I9XCJsZXQgbXNnIG9mIG1lc3NhZ2VzOyBsZXQgaSA9IGluZGV4XCI+XG4gICAgICAgICAgICA8ZGl2XG4gICAgICAgICAgICAgICpuZ0lmPVwic2hvdWxkU2hvd0RhdGVTZXBhcmF0b3IoaSlcIlxuICAgICAgICAgICAgICBjbGFzcz1cImRhdGUtc2VwYXJhdG9yXCJcbiAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgPHNwYW4+e3sgZm9ybWF0RGF0ZShtc2cuY3JlYXRlZF9hdCkgfX08L3NwYW4+XG4gICAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgICAgPGRpdlxuICAgICAgICAgICAgICBjbGFzcz1cIm1lc3NhZ2UtYnViYmxlLXJvd1wiXG4gICAgICAgICAgICAgIFtjbGFzcy5vd25dPVwiaXNPd25NZXNzYWdlKG1zZylcIlxuICAgICAgICAgICAgICBbY2xhc3Mub3RoZXJdPVwiIWlzT3duTWVzc2FnZShtc2cpXCJcbiAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgPGRpdiAqbmdJZj1cIiFpc093bk1lc3NhZ2UobXNnKSAmJiBzaG91bGRTaG93U2VuZGVyKGkpXCIgY2xhc3M9XCJzZW5kZXItbmFtZVwiPlxuICAgICAgICAgICAgICAgIHt7IGdldFNlbmRlck5hbWUobXNnKSB9fVxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cIm1lc3NhZ2UtYnViYmxlXCIgW2NsYXNzLm93bi1idWJibGVdPVwiaXNPd25NZXNzYWdlKG1zZylcIj5cbiAgICAgICAgICAgICAgICA8ZGl2ICpuZ0lmPVwibXNnLm1lc3NhZ2VfdHlwZSA9PT0gJ0lNQUdFJ1wiIGNsYXNzPVwiaW1hZ2UtbWVzc2FnZVwiPlxuICAgICAgICAgICAgICAgICAgPGltZyBbc3JjXT1cIm1zZy5tZWRpYV91cmwgfHwgbXNnLmNvbnRlbnRcIiBhbHQ9XCJJbWFnZVwiIC8+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgPGRpdiAqbmdJZj1cIm1zZy5tZXNzYWdlX3R5cGUgPT09ICdGSUxFJ1wiIGNsYXNzPVwiZmlsZS1tZXNzYWdlXCI+XG4gICAgICAgICAgICAgICAgICA8bWF0LWljb24gY2xhc3M9XCJmaWxlLW1zZy1pY29uXCI+aW5zZXJ0X2RyaXZlX2ZpbGU8L21hdC1pY29uPlxuICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJmaWxlLW1zZy1uYW1lXCI+e3sgbXNnLmNvbnRlbnQgfX08L3NwYW4+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgPGRpdiAqbmdJZj1cIm1zZy5tZXNzYWdlX3R5cGUgPT09ICdURVhUJ1wiIGNsYXNzPVwidGV4dC1jb250ZW50XCI+XG4gICAgICAgICAgICAgICAgICB7eyBtc2cuY29udGVudCB9fVxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJtZXNzYWdlLW1ldGFcIj5cbiAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwibXNnLXRpbWVcIj57eyBmb3JtYXRUaW1lKG1zZy5jcmVhdGVkX2F0KSB9fTwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgIDxtYXQtaWNvbiAqbmdJZj1cImlzT3duTWVzc2FnZShtc2cpICYmIG1zZy5pc19yZWFkXCIgY2xhc3M9XCJyZWFkLWljb25cIj5kb25lX2FsbDwvbWF0LWljb24+XG4gICAgICAgICAgICAgICAgICA8bWF0LWljb24gKm5nSWY9XCJpc093bk1lc3NhZ2UobXNnKSAmJiAhbXNnLmlzX3JlYWRcIiBjbGFzcz1cInJlYWQtaWNvbiB1bnJlYWRcIj5kb25lPC9tYXQtaWNvbj5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8L25nLWNvbnRhaW5lcj5cbiAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgPGRpdiAqbmdJZj1cIm1lc3NhZ2VzLmxlbmd0aCA9PT0gMCAmJiAhbG9hZGluZ1wiIGNsYXNzPVwiZW1wdHktY2hhdFwiPlxuICAgICAgICAgIDxtYXQtaWNvbj5jaGF0X2J1YmJsZV9vdXRsaW5lPC9tYXQtaWNvbj5cbiAgICAgICAgICA8cD5ObyBtZXNzYWdlcyB5ZXQuIFNheSBoZWxsbyE8L3A+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG5cbiAgICAgIDxhcHAtbWVzc2FnZS1pbnB1dFxuICAgICAgICAobWVzc2FnZVNlbnQpPVwib25TZW5kTWVzc2FnZSgkZXZlbnQpXCJcbiAgICAgICAgKG1lc3NhZ2VXaXRoRmlsZXMpPVwib25TZW5kV2l0aEZpbGVzKCRldmVudClcIlxuICAgICAgPjwvYXBwLW1lc3NhZ2UtaW5wdXQ+XG4gICAgPC9kaXY+XG4gIGAsXG4gIHN0eWxlczogW2BcbiAgICAuY2hhdC10aHJlYWQge1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAgICBoZWlnaHQ6IDEwMCU7XG4gICAgICBiYWNrZ3JvdW5kOiBsaW5lYXItZ3JhZGllbnQoMTgwZGVnLCAjMUY0QkQ4IDAlLCAjMTczMzk2IDEwMCUpO1xuICAgIH1cblxuICAgIC5jaGF0LWhlYWRlciB7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIHBhZGRpbmc6IDhweCA4cHggOHB4IDRweDtcbiAgICAgIGJvcmRlci1ib3R0b206IDFweCBzb2xpZCByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMTUpO1xuICAgICAgZ2FwOiA0cHg7XG4gICAgICBmbGV4LXNocmluazogMDtcbiAgICB9XG5cbiAgICAuY2hhdC1oZWFkZXIgYnV0dG9uIG1hdC1pY29uIHtcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuOCk7XG4gICAgfVxuXG4gICAgLmNoYXQtbmFtZSB7XG4gICAgICBmb250LXNpemU6IDE2cHg7XG4gICAgICBmb250LXdlaWdodDogNjAwO1xuICAgICAgY29sb3I6ICNmZmY7XG4gICAgfVxuXG4gICAgLmhlYWRlci1pbmZvIHtcbiAgICAgIGZsZXg6IDE7XG4gICAgICB3aGl0ZS1zcGFjZTogbm93cmFwO1xuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICAgIHRleHQtb3ZlcmZsb3c6IGVsbGlwc2lzO1xuICAgICAgZGlzcGxheTogYmxvY2s7XG4gICAgICBwYWRkaW5nOiAwIDRweDtcbiAgICB9XG5cbiAgICAuaGVhZGVyLWFjdGlvbnMge1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGdhcDogMDtcbiAgICB9XG5cbiAgICAuaGVhZGVyLWFjdGlvbnMgYnV0dG9uIHtcbiAgICAgIHdpZHRoOiAzMnB4O1xuICAgICAgaGVpZ2h0OiAzMnB4O1xuICAgIH1cblxuICAgIC5oZHItYnRuIHtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDZweCAhaW1wb3J0YW50O1xuICAgICAgdHJhbnNpdGlvbjogYmFja2dyb3VuZCAwLjE1cywgYm94LXNoYWRvdyAwLjE1cztcbiAgICB9XG5cbiAgICAuaGRyLWJ0bjpob3ZlciB7XG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMTUpICFpbXBvcnRhbnQ7XG4gICAgICBib3gtc2hhZG93OiAwIDJweCA4cHggcmdiYSgwLCAwLCAwLCAwLjIpO1xuICAgIH1cblxuICAgIC5tZXNzYWdlcy1hcmVhIHtcbiAgICAgIGZsZXg6IDE7XG4gICAgICBvdmVyZmxvdy15OiBhdXRvO1xuICAgICAgcGFkZGluZzogMTJweDtcbiAgICB9XG5cbiAgICAubG9hZGluZy1pbmRpY2F0b3Ige1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgIGdhcDogOHB4O1xuICAgICAgcGFkZGluZzogMTJweDtcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNyk7XG4gICAgICBmb250LXNpemU6IDEzcHg7XG4gICAgfVxuXG4gICAgLmxvYWQtbW9yZS1idG4ge1xuICAgICAgYWxpZ24tc2VsZjogY2VudGVyO1xuICAgICAgbWFyZ2luLWJvdHRvbTogMTZweDtcbiAgICAgIGZvbnQtc2l6ZTogMTJweDtcbiAgICAgIGNvbG9yOiAjZmZmO1xuICAgIH1cblxuICAgIC5tZXNzYWdlcy1saXN0IHtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgZ2FwOiAycHg7XG4gICAgICBmbGV4OiAxO1xuICAgIH1cblxuICAgIC5kYXRlLXNlcGFyYXRvciB7XG4gICAgICB0ZXh0LWFsaWduOiBjZW50ZXI7XG4gICAgICBtYXJnaW46IDE2cHggMCA4cHg7XG4gICAgICBmb250LXNpemU6IDEycHg7XG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjcpO1xuICAgICAgZm9udC13ZWlnaHQ6IDUwMDtcbiAgICB9XG5cbiAgICAubWVzc2FnZS1idWJibGUtcm93IHtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgbWF4LXdpZHRoOiA4MCU7XG4gICAgICBtYXJnaW4tYm90dG9tOiA0cHg7XG4gICAgfVxuXG4gICAgLm1lc3NhZ2UtYnViYmxlLXJvdy5vd24ge1xuICAgICAgYWxpZ24tc2VsZjogZmxleC1lbmQ7XG4gICAgICBhbGlnbi1pdGVtczogZmxleC1lbmQ7XG4gICAgfVxuXG4gICAgLm1lc3NhZ2UtYnViYmxlLXJvdy5vdGhlciB7XG4gICAgICBhbGlnbi1zZWxmOiBmbGV4LXN0YXJ0O1xuICAgICAgYWxpZ24taXRlbXM6IGZsZXgtc3RhcnQ7XG4gICAgfVxuXG4gICAgLnNlbmRlci1uYW1lIHtcbiAgICAgIGZvbnQtc2l6ZTogMTFweDtcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNik7XG4gICAgICBtYXJnaW4tYm90dG9tOiAycHg7XG4gICAgICBtYXJnaW4tbGVmdDogMTJweDtcbiAgICB9XG5cbiAgICAubWVzc2FnZS1idWJibGUge1xuICAgICAgcGFkZGluZzogMTBweCAxNHB4O1xuICAgICAgYm9yZGVyLXJhZGl1czogMThweDtcbiAgICAgIGZvbnQtc2l6ZTogMTRweDtcbiAgICAgIGxpbmUtaGVpZ2h0OiAxLjQ7XG4gICAgICB3b3JkLWJyZWFrOiBicmVhay13b3JkO1xuICAgICAgY29sb3I6ICNmZmY7XG4gICAgfVxuXG4gICAgLm1lc3NhZ2UtYnViYmxlLXJvdy5vdGhlciAubWVzc2FnZS1idWJibGUge1xuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjEpO1xuICAgICAgYm9yZGVyLWJvdHRvbS1sZWZ0LXJhZGl1czogNnB4O1xuICAgICAgYm94LXNoYWRvdzogMCAxcHggMnB4IHJnYmEoMCwgMCwgMCwgMC4xKTtcbiAgICB9XG5cbiAgICAubWVzc2FnZS1idWJibGUub3duLWJ1YmJsZSB7XG4gICAgICBiYWNrZ3JvdW5kOiBsaW5lYXItZ3JhZGllbnQoMTM1ZGVnLCAjMkE1QkZGIDAlLCAjMUY0QkQ4IDEwMCUpO1xuICAgICAgYm9yZGVyLWJvdHRvbS1yaWdodC1yYWRpdXM6IDZweDtcbiAgICB9XG5cbiAgICAuaW1hZ2UtbWVzc2FnZSBpbWcge1xuICAgICAgbWF4LXdpZHRoOiAyNDBweDtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDEycHg7XG4gICAgICBkaXNwbGF5OiBibG9jaztcbiAgICB9XG5cbiAgICAuZmlsZS1tZXNzYWdlIHtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgZ2FwOiA4cHg7XG4gICAgICBwYWRkaW5nOiA0cHggMDtcbiAgICB9XG5cbiAgICAuZmlsZS1tc2ctaWNvbiB7XG4gICAgICBmb250LXNpemU6IDIwcHg7XG4gICAgICB3aWR0aDogMjBweDtcbiAgICAgIGhlaWdodDogMjBweDtcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuOCk7XG4gICAgfVxuXG4gICAgLmZpbGUtbXNnLW5hbWUge1xuICAgICAgZm9udC1zaXplOiAxM3B4O1xuICAgICAgY29sb3I6ICNmZmY7XG4gICAgICB3b3JkLWJyZWFrOiBicmVhay1hbGw7XG4gICAgfVxuXG4gICAgLm1lc3NhZ2UtbWV0YSB7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGdhcDogNHB4O1xuICAgICAgbWFyZ2luLXRvcDogNHB4O1xuICAgIH1cblxuICAgIC5tc2ctdGltZSB7XG4gICAgICBmb250LXNpemU6IDExcHg7XG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjYpO1xuICAgIH1cblxuICAgIC5tZXNzYWdlLWJ1YmJsZS1yb3cub3RoZXIgLm1zZy10aW1lIHtcbiAgICAgIGNvbG9yOiAjOWNhM2FmO1xuICAgIH1cblxuICAgIC5yZWFkLWljb24ge1xuICAgICAgZm9udC1zaXplOiAxNHB4O1xuICAgICAgd2lkdGg6IDE0cHg7XG4gICAgICBoZWlnaHQ6IDE0cHg7XG4gICAgICBvcGFjaXR5OiAwLjc7XG4gICAgfVxuXG4gICAgLnJlYWQtaWNvbi51bnJlYWQge1xuICAgICAgb3BhY2l0eTogMC40O1xuICAgIH1cblxuICAgIC5lbXB0eS1jaGF0IHtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgICAgZmxleDogMTtcbiAgICAgIGNvbG9yOiAjOWNhM2FmO1xuICAgIH1cblxuICAgIC5lbXB0eS1jaGF0IG1hdC1pY29uIHtcbiAgICAgIGZvbnQtc2l6ZTogNDhweDtcbiAgICAgIHdpZHRoOiA0OHB4O1xuICAgICAgaGVpZ2h0OiA0OHB4O1xuICAgICAgbWFyZ2luLWJvdHRvbTogOHB4O1xuICAgIH1cblxuICAgIC5lbXB0eS1jaGF0IHAge1xuICAgICAgZm9udC1zaXplOiAxNHB4O1xuICAgICAgbWFyZ2luOiAwO1xuICAgIH1cbiAgYF0sXG59KVxuZXhwb3J0IGNsYXNzIENoYXRUaHJlYWRDb21wb25lbnQgaW1wbGVtZW50cyBPbkluaXQsIE9uRGVzdHJveSwgQWZ0ZXJWaWV3Q2hlY2tlZCB7XG4gIEBWaWV3Q2hpbGQoJ3Njcm9sbENvbnRhaW5lcicpIHNjcm9sbENvbnRhaW5lciE6IEVsZW1lbnRSZWY7XG5cbiAgbWVzc2FnZXM6IE1lc3NhZ2VbXSA9IFtdO1xuICBjb252ZXJzYXRpb25OYW1lID0gJyc7XG4gIGxvYWRpbmcgPSBmYWxzZTtcbiAgbXlDb250YWN0SWQ6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuXG4gIHByaXZhdGUgY29udmVyc2F0aW9uSWQ6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIHN1YiE6IFN1YnNjcmlwdGlvbjtcbiAgcHJpdmF0ZSBzaG91bGRTY3JvbGxUb0JvdHRvbSA9IHRydWU7XG5cbiAgdXBsb2FkaW5nID0gZmFsc2U7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSBzdG9yZTogTWVzc2FnaW5nU3RvcmVTZXJ2aWNlLFxuICAgIHByaXZhdGUgYXV0aDogQXV0aFNlcnZpY2UsXG4gICAgcHJpdmF0ZSBmaWxlU2VydmljZTogTWVzc2FnaW5nRmlsZVNlcnZpY2VcbiAgKSB7fVxuXG4gIG5nT25Jbml0KCk6IHZvaWQge1xuICAgIHRoaXMubXlDb250YWN0SWQgPSB0aGlzLmF1dGguY29udGFjdElkO1xuXG4gICAgdGhpcy5zdWIgPSBjb21iaW5lTGF0ZXN0KFtcbiAgICAgIHRoaXMuc3RvcmUuYWN0aXZlQ29udmVyc2F0aW9uSWQsXG4gICAgICB0aGlzLnN0b3JlLm1lc3NhZ2VzTWFwLFxuICAgICAgdGhpcy5zdG9yZS5vcGVuQ2hhdHMsXG4gICAgICB0aGlzLnN0b3JlLmxvYWRpbmdNZXNzYWdlcyxcbiAgICBdKS5zdWJzY3JpYmUoKFtjb252SWQsIG1zZ01hcCwgY2hhdHMsIGxvYWRpbmddKSA9PiB7XG4gICAgICB0aGlzLmxvYWRpbmcgPSBsb2FkaW5nO1xuXG4gICAgICBpZiAoY29udklkICYmIGNvbnZJZCAhPT0gdGhpcy5jb252ZXJzYXRpb25JZCkge1xuICAgICAgICB0aGlzLmNvbnZlcnNhdGlvbklkID0gY29udklkO1xuICAgICAgICB0aGlzLnNob3VsZFNjcm9sbFRvQm90dG9tID0gdHJ1ZTtcbiAgICAgICAgY29uc3QgY2hhdCA9IGNoYXRzLmZpbmQoKGMpID0+IGMuY29udmVyc2F0aW9uSWQgPT09IGNvbnZJZCk7XG4gICAgICAgIHRoaXMuY29udmVyc2F0aW9uTmFtZSA9IGNoYXQ/Lm5hbWUgfHwgJ0NoYXQnO1xuICAgICAgfVxuXG4gICAgICBpZiAodGhpcy5jb252ZXJzYXRpb25JZCkge1xuICAgICAgICBjb25zdCBwcmV2TGVuID0gdGhpcy5tZXNzYWdlcy5sZW5ndGg7XG4gICAgICAgIHRoaXMubWVzc2FnZXMgPSBtc2dNYXAuZ2V0KHRoaXMuY29udmVyc2F0aW9uSWQpIHx8IFtdO1xuICAgICAgICBpZiAodGhpcy5tZXNzYWdlcy5sZW5ndGggPiBwcmV2TGVuKSB7XG4gICAgICAgICAgdGhpcy5zaG91bGRTY3JvbGxUb0JvdHRvbSA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIG5nQWZ0ZXJWaWV3Q2hlY2tlZCgpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5zaG91bGRTY3JvbGxUb0JvdHRvbSkge1xuICAgICAgdGhpcy5zY3JvbGxUb0JvdHRvbSgpO1xuICAgICAgdGhpcy5zaG91bGRTY3JvbGxUb0JvdHRvbSA9IGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIG5nT25EZXN0cm95KCk6IHZvaWQge1xuICAgIHRoaXMuc3ViPy51bnN1YnNjcmliZSgpO1xuICB9XG5cbiAgZ29CYWNrKCk6IHZvaWQge1xuICAgIHRoaXMuc3RvcmUuc2V0VmlldygnaW5ib3gnKTtcbiAgfVxuXG4gIG9uQ2xlYXJDb252ZXJzYXRpb24oKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuY29udmVyc2F0aW9uSWQpIHtcbiAgICAgIHRoaXMuc3RvcmUuY2xlYXJDb252ZXJzYXRpb24odGhpcy5jb252ZXJzYXRpb25JZCk7XG4gICAgfVxuICB9XG5cbiAgb25EZWxldGVDb252ZXJzYXRpb24oKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuY29udmVyc2F0aW9uSWQpIHtcbiAgICAgIHRoaXMuc3RvcmUuZGVsZXRlQ29udmVyc2F0aW9uKHRoaXMuY29udmVyc2F0aW9uSWQpO1xuICAgIH1cbiAgfVxuXG4gIG9uU2VuZE1lc3NhZ2UoY29udGVudDogc3RyaW5nKTogdm9pZCB7XG4gICAgdGhpcy5zdG9yZS5zZW5kTWVzc2FnZSh0aGlzLmNvbnZlcnNhdGlvbklkLCBjb250ZW50KTtcbiAgICB0aGlzLnNob3VsZFNjcm9sbFRvQm90dG9tID0gdHJ1ZTtcbiAgfVxuXG4gIG9uU2VuZFdpdGhGaWxlcyhwYXlsb2FkOiBNZXNzYWdlUGF5bG9hZCk6IHZvaWQge1xuICAgIGlmICghdGhpcy5jb252ZXJzYXRpb25JZCkgcmV0dXJuO1xuICAgIHRoaXMudXBsb2FkaW5nID0gdHJ1ZTtcbiAgICB0aGlzLmZpbGVTZXJ2aWNlLnVwbG9hZEZpbGVzKHBheWxvYWQuZmlsZXMpLnN1YnNjcmliZSh7XG4gICAgICBuZXh0OiAocmVzcG9uc2VzKSA9PiB7XG4gICAgICAgIGNvbnN0IGZpbGVJZHMgPSByZXNwb25zZXMubWFwKChyKSA9PiByLmZpbGVfaWQpO1xuICAgICAgICBjb25zdCBmaWxlbmFtZXMgPSByZXNwb25zZXMubWFwKChyKSA9PiByLmZpbGVuYW1lKTtcbiAgICAgICAgdGhpcy5maWxlU2VydmljZVxuICAgICAgICAgIC5zZW5kTWVzc2FnZVdpdGhBdHRhY2htZW50cyhcbiAgICAgICAgICAgIHRoaXMuY29udmVyc2F0aW9uSWQhLFxuICAgICAgICAgICAgdGhpcy5hdXRoLmNvbnRhY3RJZCEsXG4gICAgICAgICAgICBwYXlsb2FkLnRleHQgfHwgZmlsZW5hbWVzLmpvaW4oJywgJyksXG4gICAgICAgICAgICBmaWxlSWRzLFxuICAgICAgICAgICAgZmlsZW5hbWVzXG4gICAgICAgICAgKVxuICAgICAgICAgIC5zdWJzY3JpYmUoe1xuICAgICAgICAgICAgbmV4dDogKCkgPT4ge1xuICAgICAgICAgICAgICB0aGlzLnVwbG9hZGluZyA9IGZhbHNlO1xuICAgICAgICAgICAgICB0aGlzLnNob3VsZFNjcm9sbFRvQm90dG9tID0gdHJ1ZTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBlcnJvcjogKGVycjogYW55KSA9PiB7XG4gICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0ZhaWxlZCB0byBzZW5kIGF0dGFjaG1lbnRzOicsIGVycik7XG4gICAgICAgICAgICAgIHRoaXMudXBsb2FkaW5nID0gZmFsc2U7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0pO1xuICAgICAgfSxcbiAgICAgIGVycm9yOiAoZXJyOiBhbnkpID0+IHtcbiAgICAgICAgY29uc29sZS5lcnJvcignRmlsZSB1cGxvYWQgZmFpbGVkOicsIGVycik7XG4gICAgICAgIHRoaXMudXBsb2FkaW5nID0gZmFsc2U7XG4gICAgICB9LFxuICAgIH0pO1xuICB9XG5cbiAgbG9hZE9sZGVyKCk6IHZvaWQge1xuICAgIGlmICh0aGlzLmNvbnZlcnNhdGlvbklkICYmIHRoaXMubWVzc2FnZXMubGVuZ3RoID4gMCkge1xuICAgICAgdGhpcy5zdG9yZS5sb2FkTWVzc2FnZXModGhpcy5jb252ZXJzYXRpb25JZCwgdGhpcy5tZXNzYWdlc1swXS5tZXNzYWdlX2lkKTtcbiAgICB9XG4gIH1cblxuICBvblNjcm9sbCgpOiB2b2lkIHt9XG5cbiAgc2hvdWxkU2hvd0RhdGVTZXBhcmF0b3IoaW5kZXg6IG51bWJlcik6IGJvb2xlYW4ge1xuICAgIGlmIChpbmRleCA9PT0gMCkgcmV0dXJuIHRydWU7XG4gICAgY29uc3QgY3VyciA9IG5ldyBEYXRlKHRoaXMubWVzc2FnZXNbaW5kZXhdLmNyZWF0ZWRfYXQpLnRvRGF0ZVN0cmluZygpO1xuICAgIGNvbnN0IHByZXYgPSBuZXcgRGF0ZSh0aGlzLm1lc3NhZ2VzW2luZGV4IC0gMV0uY3JlYXRlZF9hdCkudG9EYXRlU3RyaW5nKCk7XG4gICAgcmV0dXJuIGN1cnIgIT09IHByZXY7XG4gIH1cblxuICBzaG91bGRTaG93U2VuZGVyKGluZGV4OiBudW1iZXIpOiBib29sZWFuIHtcbiAgICBpZiAoaW5kZXggPT09IDApIHJldHVybiB0cnVlO1xuICAgIHJldHVybiB0aGlzLm1lc3NhZ2VzW2luZGV4XS5zZW5kZXJfaWQgIT09IHRoaXMubWVzc2FnZXNbaW5kZXggLSAxXS5zZW5kZXJfaWQ7XG4gIH1cblxuICBpc093bk1lc3NhZ2UobXNnOiBNZXNzYWdlKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIFN0cmluZyhtc2cuc2VuZGVyX2lkKSA9PT0gU3RyaW5nKHRoaXMubXlDb250YWN0SWQpO1xuICB9XG5cbiAgZ2V0U2VuZGVyTmFtZShtc2c6IE1lc3NhZ2UpOiBzdHJpbmcge1xuICAgIHJldHVybiBnZXRNZXNzYWdlU2VuZGVyTmFtZShtc2cpO1xuICB9XG5cbiAgZm9ybWF0VGltZShkYXRlU3RyOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIGlmICghZGF0ZVN0cikgcmV0dXJuICcnO1xuICAgIGNvbnN0IGQgPSBuZXcgRGF0ZShkYXRlU3RyKTtcbiAgICByZXR1cm4gZC50b0xvY2FsZVRpbWVTdHJpbmcoJ2VuLUdCJywgeyBob3VyOiAnMi1kaWdpdCcsIG1pbnV0ZTogJzItZGlnaXQnIH0pO1xuICB9XG5cbiAgZm9ybWF0RGF0ZShkYXRlU3RyOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIGNvbnN0IGQgPSBuZXcgRGF0ZShkYXRlU3RyKTtcbiAgICBjb25zdCB0b2RheSA9IG5ldyBEYXRlKCk7XG4gICAgY29uc3QgeWVzdGVyZGF5ID0gbmV3IERhdGUodG9kYXkpO1xuICAgIHllc3RlcmRheS5zZXREYXRlKHllc3RlcmRheS5nZXREYXRlKCkgLSAxKTtcblxuICAgIGlmIChkLnRvRGF0ZVN0cmluZygpID09PSB0b2RheS50b0RhdGVTdHJpbmcoKSkgcmV0dXJuICdUb2RheSc7XG4gICAgaWYgKGQudG9EYXRlU3RyaW5nKCkgPT09IHllc3RlcmRheS50b0RhdGVTdHJpbmcoKSkgcmV0dXJuICdZZXN0ZXJkYXknO1xuICAgIHJldHVybiBkLnRvTG9jYWxlRGF0ZVN0cmluZygnZW4tR0InLCB7IGRheTogJ251bWVyaWMnLCBtb250aDogJ3Nob3J0JywgeWVhcjogJ251bWVyaWMnIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBzY3JvbGxUb0JvdHRvbSgpOiB2b2lkIHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgZWwgPSB0aGlzLnNjcm9sbENvbnRhaW5lcj8ubmF0aXZlRWxlbWVudDtcbiAgICAgIGlmIChlbCkge1xuICAgICAgICBlbC5zY3JvbGxUb3AgPSBlbC5zY3JvbGxIZWlnaHQ7XG4gICAgICB9XG4gICAgfSBjYXRjaCB7IC8qIGlnbm9yZSAqLyB9XG4gIH1cbn1cbiJdfQ==