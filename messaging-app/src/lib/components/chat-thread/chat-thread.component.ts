import {
  Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription, combineLatest } from 'rxjs';
import { MessagingStoreService } from '../../services/messaging-store.service';
import { MessagingFileService } from '../../services/messaging-file.service';
import { AuthService } from '../../services/auth.service';
import { Message, getMessageSenderName } from '../../models/messaging.models';
import { MessageInputComponent, MessagePayload } from '../message-input/message-input.component';

@Component({
  selector: 'app-chat-thread',
  standalone: true,
  imports: [
    CommonModule, MatIconModule, MatButtonModule,
    MatProgressSpinnerModule, MatTooltipModule, MessageInputComponent,
  ],
  template: `
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
  `,
  styles: [`
    .chat-thread {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: linear-gradient(180deg, #1F4BD8 0%, #173396 100%);
    }

    .chat-header {
      display: flex;
      align-items: center;
      padding: 8px 8px 8px 4px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.15);
      gap: 4px;
      flex-shrink: 0;
    }

    .chat-header button mat-icon {
      color: rgba(255, 255, 255, 0.8);
    }

    .chat-name {
      font-size: 16px;
      font-weight: 600;
      color: #fff;
    }

    .header-info {
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      display: block;
      padding: 0 4px;
    }

    .header-actions {
      display: flex;
      gap: 0;
    }

    .header-actions button {
      width: 32px;
      height: 32px;
    }

    .hdr-btn {
      border-radius: 6px !important;
      transition: background 0.15s, box-shadow 0.15s;
    }

    .hdr-btn:hover {
      background: rgba(255, 255, 255, 0.15) !important;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }

    .messages-area {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
    }

    .loading-indicator {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px;
      color: rgba(255, 255, 255, 0.7);
      font-size: 13px;
    }

    .load-more-btn {
      align-self: center;
      margin-bottom: 16px;
      font-size: 12px;
      color: #fff;
    }

    .messages-list {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1;
    }

    .date-separator {
      text-align: center;
      margin: 16px 0 8px;
      font-size: 12px;
      color: rgba(255, 255, 255, 0.7);
      font-weight: 500;
    }

    .message-bubble-row {
      display: flex;
      flex-direction: column;
      max-width: 80%;
      margin-bottom: 4px;
    }

    .message-bubble-row.own {
      align-self: flex-end;
      align-items: flex-end;
    }

    .message-bubble-row.other {
      align-self: flex-start;
      align-items: flex-start;
    }

    .sender-name {
      font-size: 11px;
      color: rgba(255, 255, 255, 0.6);
      margin-bottom: 2px;
      margin-left: 12px;
    }

    .message-bubble {
      padding: 10px 14px;
      border-radius: 18px;
      font-size: 14px;
      line-height: 1.4;
      word-break: break-word;
      color: #fff;
    }

    .message-bubble-row.other .message-bubble {
      background: rgba(255, 255, 255, 0.1);
      border-bottom-left-radius: 6px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    }

    .message-bubble.own-bubble {
      background: linear-gradient(135deg, #2A5BFF 0%, #1F4BD8 100%);
      border-bottom-right-radius: 6px;
    }

    .image-message img {
      max-width: 240px;
      border-radius: 12px;
      display: block;
    }

    .file-message {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 0;
    }

    .file-msg-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      color: rgba(255, 255, 255, 0.8);
    }

    .file-msg-name {
      font-size: 13px;
      color: #fff;
      word-break: break-all;
    }

    .message-meta {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-top: 4px;
    }

    .msg-time {
      font-size: 11px;
      color: rgba(255, 255, 255, 0.6);
    }

    .message-bubble-row.other .msg-time {
      color: #9ca3af;
    }

    .read-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
      opacity: 0.7;
    }

    .read-icon.unread {
      opacity: 0.4;
    }

    .empty-chat {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      flex: 1;
      color: #9ca3af;
    }

    .empty-chat mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      margin-bottom: 8px;
    }

    .empty-chat p {
      font-size: 14px;
      margin: 0;
    }
  `],
})
export class ChatThreadComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('scrollContainer') scrollContainer!: ElementRef;

  messages: Message[] = [];
  conversationName = '';
  loading = false;
  myContactId: string | null = null;

  private conversationId: string | null = null;
  private sub!: Subscription;
  private shouldScrollToBottom = true;

  uploading = false;

  constructor(
    private store: MessagingStoreService,
    private auth: AuthService,
    private fileService: MessagingFileService
  ) {}

  ngOnInit(): void {
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

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  goBack(): void {
    this.store.setView('inbox');
  }

  onClearConversation(): void {
    if (this.conversationId) {
      this.store.clearConversation(this.conversationId);
    }
  }

  onDeleteConversation(): void {
    if (this.conversationId) {
      this.store.deleteConversation(this.conversationId);
    }
  }

  onSendMessage(content: string): void {
    this.store.sendMessage(this.conversationId, content);
    this.shouldScrollToBottom = true;
  }

  onSendWithFiles(payload: MessagePayload): void {
    if (!this.conversationId) return;
    this.uploading = true;
    this.fileService.uploadFiles(payload.files).subscribe({
      next: (responses) => {
        const fileIds = responses.map((r) => r.file_id);
        const filenames = responses.map((r) => r.filename);
        this.fileService
          .sendMessageWithAttachments(
            this.conversationId!,
            this.auth.contactId!,
            payload.text || filenames.join(', '),
            fileIds,
            filenames
          )
          .subscribe({
            next: () => {
              this.uploading = false;
              this.shouldScrollToBottom = true;
            },
            error: (err: any) => {
              console.error('Failed to send attachments:', err);
              this.uploading = false;
            },
          });
      },
      error: (err: any) => {
        console.error('File upload failed:', err);
        this.uploading = false;
      },
    });
  }

  loadOlder(): void {
    if (this.conversationId && this.messages.length > 0) {
      this.store.loadMessages(this.conversationId, this.messages[0].message_id);
    }
  }

  onScroll(): void {}

  shouldShowDateSeparator(index: number): boolean {
    if (index === 0) return true;
    const curr = new Date(this.messages[index].created_at).toDateString();
    const prev = new Date(this.messages[index - 1].created_at).toDateString();
    return curr !== prev;
  }

  shouldShowSender(index: number): boolean {
    if (index === 0) return true;
    return this.messages[index].sender_id !== this.messages[index - 1].sender_id;
  }

  isOwnMessage(msg: Message): boolean {
    return String(msg.sender_id) === String(this.myContactId);
  }

  getSenderName(msg: Message): string {
    return getMessageSenderName(msg);
  }

  formatTime(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  private scrollToBottom(): void {
    try {
      const el = this.scrollContainer?.nativeElement;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    } catch { /* ignore */ }
  }
}
