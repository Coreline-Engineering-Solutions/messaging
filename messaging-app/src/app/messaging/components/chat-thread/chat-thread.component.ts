import {
  Component, OnInit, OnDestroy, Input, ViewChild, ViewChildren, QueryList, ElementRef, AfterViewChecked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subscription, combineLatest } from 'rxjs';
import { MessagingStoreService } from '../../services/messaging-store.service';
import { AuthService } from '../../services/auth.service';
import { Message } from '../../models/messaging.models';
import { MessageInputComponent } from '../message-input/message-input.component';

@Component({
  selector: 'app-chat-thread',
  standalone: true,
  imports: [
    CommonModule, MatIconModule, MatButtonModule,
    MatProgressSpinnerModule, MessageInputComponent,
  ],
  template: `
    <div class="chat-thread">
      <div class="chat-header">
        <button mat-icon-button (click)="goBack()">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <div class="header-info">
          <span class="chat-name">{{ conversationName }}</span>
        </div>
        <button mat-icon-button (click)="onInfoClick()" title="Info">
          <mat-icon>info_outline</mat-icon>
        </button>
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
              [class.own]="msg.sender_id === myContactId"
              [class.other]="msg.sender_id !== myContactId"
            >
              <div *ngIf="msg.sender_id !== myContactId && shouldShowSender(i)" class="sender-name">
                {{ msg.sender_name }}
              </div>
              <div class="message-bubble" [class.own-bubble]="msg.sender_id === myContactId">
                <div *ngIf="msg.message_type === 'IMAGE'" class="image-message">
                  <img [src]="msg.media_url || msg.content" alt="Image" />
                </div>
                <div *ngIf="msg.message_type === 'TEXT'" class="text-content">
                  <ng-container *ngIf="isEditingMessage(msg); else messageText">
                    <div class="inline-edit-wrap" (click)="$event.stopPropagation()">
                      <textarea
                        #inlineEditTextarea
                        class="inline-edit-textarea"
                        [value]="editingDraft"
                        (input)="onInlineEditInput($event)"
                        (keydown)="onInlineEditKeydown($event)"
                        rows="2"
                      ></textarea>
                      <div class="inline-edit-actions">
                        <button type="button" class="inline-edit-cancel" (click)="cancelInlineEdit($event)">Cancel</button>
                        <button
                          type="button"
                          class="inline-edit-save"
                          [disabled]="!canSaveInlineEdit()"
                          (click)="saveInlineEdit($event)"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  </ng-container>
                  <ng-template #messageText>{{ getMessageBody(msg) }}</ng-template>
                </div>
                <div class="message-meta">
                  <span *ngIf="msg.edited_at && !isDeletedMessage(msg)" class="edited-label">edited</span>
                  <span class="msg-time">{{ formatTime(msg.created_at) }}</span>
                  <mat-icon *ngIf="msg.sender_id === myContactId && msg.is_read" class="read-icon">done_all</mat-icon>
                  <mat-icon *ngIf="msg.sender_id === myContactId && !msg.is_read" class="read-icon unread">done</mat-icon>
                  <button
                    *ngIf="canEditMessage(msg)"
                    type="button"
                    class="message-action-btn"
                    (click)="onEditMessage(msg)"
                    title="Edit message"
                  >
                    <mat-icon>edit</mat-icon>
                  </button>
                  <button
                    *ngIf="canDeleteMessage(msg)"
                    type="button"
                    class="message-action-btn danger"
                    (click)="onDeleteMessage(msg)"
                    title="Delete message"
                  >
                    <mat-icon>delete</mat-icon>
                  </button>
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

      <app-message-input (messageSent)="onSendMessage($event)"></app-message-input>
    </div>
  `,
  styles: [`
    .chat-thread {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .chat-header {
      display: flex;
      align-items: center;
      padding: 8px 8px 8px 4px;
      border-bottom: 1px solid #e5e7eb;
      background: #fff;
      gap: 4px;
    }

    .chat-header button mat-icon {
      color: #6b7280;
    }

    .header-info {
      flex: 1;
      min-width: 0;
    }

    .chat-name {
      font-weight: 600;
      font-size: 16px;
      color: #1f2937;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      display: block;
    }

    .messages-area {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      background: #f9fafb;
      display: flex;
      flex-direction: column;
    }

    .loading-indicator {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px;
      color: #9ca3af;
      font-size: 13px;
    }

    .load-more-btn {
      align-self: center;
      margin-bottom: 16px;
      font-size: 12px;
    }

    .messages-list {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1;
    }

    .date-separator {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 12px 0;
    }

    .date-separator span {
      background: #e5e7eb;
      color: #6b7280;
      font-size: 11px;
      font-weight: 500;
      padding: 4px 12px;
      border-radius: 12px;
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
      color: #9ca3af;
      margin-bottom: 2px;
      margin-left: 12px;
    }

    .message-bubble {
      padding: 10px 14px;
      border-radius: 18px;
      font-size: 14px;
      line-height: 1.4;
      word-break: break-word;
    }

    .message-bubble-row.other .message-bubble {
      background: #fff;
      color: #1f2937;
      border-bottom-left-radius: 6px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    }

    .message-bubble.own-bubble {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #fff;
      border-bottom-right-radius: 6px;
    }

    .image-message img {
      max-width: 240px;
      border-radius: 12px;
      display: block;
    }

    .message-meta {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-top: 4px;
      justify-content: flex-end;
    }

    .msg-time {
      font-size: 10px;
      opacity: 0.7;
    }

    .edited-label {
      font-size: 10px;
      font-style: italic;
      opacity: 0.7;
    }

    .message-action-btn {
      border: 0;
      background: transparent;
      color: inherit;
      opacity: 0.72;
      padding: 0;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
    }

    .message-action-btn mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }

    .message-action-btn.danger {
      color: #fecaca;
    }

    .inline-edit-wrap {
      min-width: 240px;
    }

    .inline-edit-textarea {
      width: 100%;
      min-height: 72px;
      box-sizing: border-box;
      border: 1px solid rgba(255, 255, 255, 0.4);
      border-radius: 10px;
      outline: none;
      resize: vertical;
      padding: 8px 10px;
      background: rgba(255, 255, 255, 0.16);
      color: inherit;
      font: inherit;
      line-height: 1.4;
    }

    .inline-edit-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 8px;
    }

    .inline-edit-cancel,
    .inline-edit-save {
      border: 0;
      border-radius: 8px;
      padding: 6px 10px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 700;
    }

    .inline-edit-cancel {
      background: rgba(255, 255, 255, 0.24);
      color: inherit;
    }

    .inline-edit-save {
      background: #2563eb;
      color: #fff;
    }

    .inline-edit-save:disabled {
      cursor: not-allowed;
      opacity: 0.45;
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
  @ViewChildren('inlineEditTextarea') inlineEditTextareas!: QueryList<ElementRef<HTMLTextAreaElement>>;

  messages: Message[] = [];
  conversationName = '';
  loading = false;
  myContactId: string | null = null;
  editingMessage: Message | null = null;
  editingDraft = '';

  private conversationId: string | null = null;
  private sub!: Subscription;
  private shouldScrollToBottom = true;

  constructor(
    private store: MessagingStoreService,
    private auth: AuthService
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

  onInfoClick(): void {
    // Could open group manager or conversation details
  }

  onSendMessage(content: string): void {
    if (this.conversationId) {
      this.store.sendMessage(this.conversationId, content);
      this.shouldScrollToBottom = true;
    }
  }

  loadOlder(): void {
    if (this.conversationId && this.messages.length > 0) {
      this.store.loadMessages(this.conversationId, this.messages[0].message_id);
    }
  }

  onScroll(): void {
    // Could detect scroll to top for auto-loading older messages
  }

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

  getMessageBody(message: Message): string {
    return this.isDeletedMessage(message) ? '[This message was deleted]' : String(message.content || '');
  }

  isDeletedMessage(message: Message): boolean {
    return Boolean(message.is_deleted || message.deleted_at || message.content === '[deleted]');
  }

  canEditMessage(message: Message): boolean {
    return (
      String(message.sender_id) === String(this.auth.contactId || this.myContactId) &&
      !this.isDeletedMessage(message) &&
      String(message.message_type || '').toUpperCase() === 'TEXT' &&
      !String(message.message_id || '').startsWith('temp-')
    );
  }

  canDeleteMessage(message: Message): boolean {
    return (
      String(message.sender_id) === String(this.auth.contactId || this.myContactId) &&
      !this.isDeletedMessage(message)
    );
  }

  onEditMessage(message: Message): void {
    if (!this.canEditMessage(message)) return;
    this.editingMessage = message;
    this.editingDraft = this.getMessageBody(message);
    setTimeout(() => {
      const textarea = this.inlineEditTextareas?.first?.nativeElement;
      textarea?.focus();
      textarea?.select();
    });
  }

  isEditingMessage(message: Message): boolean {
    return !!this.editingMessage && String(this.editingMessage.message_id) === String(message.message_id);
  }

  onInlineEditInput(event: Event): void {
    this.editingDraft = (event.target as HTMLTextAreaElement).value;
  }

  onInlineEditKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.clearEdit();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      this.saveInlineEdit(event);
    }
  }

  canSaveInlineEdit(): boolean {
    const message = this.editingMessage;
    if (!message || !this.canEditMessage(message)) return false;
    const trimmed = this.editingDraft.trim();
    return !!trimmed && trimmed !== this.getMessageBody(message).trim();
  }

  saveInlineEdit(event?: Event): void {
    event?.stopPropagation();
    const message = this.editingMessage;
    if (!message || !this.canSaveInlineEdit()) return;
    this.store.editMessage(message.message_id, this.editingDraft.trim());
    this.clearEdit();
  }

  cancelInlineEdit(event?: Event): void {
    event?.stopPropagation();
    this.clearEdit();
  }

  clearEdit(): void {
    this.editingMessage = null;
    this.editingDraft = '';
  }

  onDeleteMessage(message: Message): void {
    if (!this.canDeleteMessage(message)) return;
    if (window.confirm('Delete this message?')) {
      this.store.deleteMessage(message.message_id);
    }
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
