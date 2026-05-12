import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Message } from '../../models/messaging.models';
import { MessagingApiService } from '../../services/messaging-api.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-thread-viewer',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatProgressSpinnerModule],
  template: `
    <div class="thread-viewer">
      <div class="thread-header">
        <button mat-icon-button (click)="onClose()">
          <mat-icon>close</mat-icon>
        </button>
        <h3>Thread</h3>
        <button mat-icon-button (click)="toggleFollow()">
          <mat-icon>{{ isFollowing ? 'notifications_active' : 'notifications_off' }}</mat-icon>
        </button>
      </div>

      <div class="parent-message" *ngIf="parentMessage">
        <div class="message-header">
          <strong>{{ parentMessage.sender_name || 'Unknown' }}</strong>
          <span class="timestamp">{{ formatTime(parentMessage.created_at) }}</span>
        </div>
        <div class="message-content">{{ parentMessage.content }}</div>
        <div class="reply-count">{{ replies.length }} {{ replies.length === 1 ? 'reply' : 'replies' }}</div>
      </div>

      <div class="thread-messages" *ngIf="!loading">
        <div *ngFor="let msg of replies" class="thread-message">
          <div class="message-header">
            <strong>{{ msg.sender_name || 'Unknown' }}</strong>
            <span class="timestamp">{{ formatTime(msg.created_at) }}</span>
          </div>
          <div class="message-content">{{ msg.content }}</div>
        </div>
      </div>

      <div class="loading" *ngIf="loading">
        <mat-spinner diameter="30"></mat-spinner>
      </div>

      <div class="thread-input">
        <input 
          type="text" 
          [(ngModel)]="replyText" 
          (keyup.enter)="sendReply()"
          placeholder="Reply in thread..."
        />
        <button mat-icon-button (click)="sendReply()" [disabled]="!replyText.trim()">
          <mat-icon>send</mat-icon>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .thread-viewer {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: white;
    }

    .thread-header {
      display: flex;
      align-items: center;
      padding: 12px;
      border-bottom: 1px solid #e0e0e0;
      gap: 8px;
    }

    .thread-header h3 {
      flex: 1;
      margin: 0;
      font-size: 16px;
      font-weight: 500;
    }

    .parent-message {
      padding: 16px;
      background: #f5f5f5;
      border-bottom: 2px solid #1976d2;
    }

    .message-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
      font-size: 14px;
    }

    .timestamp {
      color: #666;
      font-size: 12px;
    }

    .message-content {
      margin: 8px 0;
      line-height: 1.4;
    }

    .reply-count {
      font-size: 12px;
      color: #1976d2;
      margin-top: 8px;
    }

    .thread-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
    }

    .thread-message {
      margin-bottom: 16px;
      padding: 12px;
      background: #fafafa;
      border-radius: 8px;
    }

    .loading {
      display: flex;
      justify-content: center;
      align-items: center;
      flex: 1;
    }

    .thread-input {
      display: flex;
      padding: 12px;
      border-top: 1px solid #e0e0e0;
      gap: 8px;
    }

    .thread-input input {
      flex: 1;
      padding: 8px 12px;
      border: 1px solid #ddd;
      border-radius: 20px;
      outline: none;
    }

    .thread-input input:focus {
      border-color: #1976d2;
    }
  `]
})
export class ThreadViewerComponent implements OnInit {
  @Input() parentMessage!: Message;
  @Input() conversationId!: string;
  @Output() close = new EventEmitter<void>();

  replies: Message[] = [];
  replyText = '';
  loading = false;
  isFollowing = true;

  constructor(
    private api: MessagingApiService,
    private auth: AuthService
  ) {}

  ngOnInit() {
    this.loadThread();
  }

  loadThread() {
    if (!this.parentMessage) return;
    
    this.loading = true;
    this.api.getThreadMessages(this.parentMessage.message_id, this.auth.contactId!).subscribe({
      next: (messages) => {
        this.replies = messages;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  sendReply() {
    if (!this.replyText.trim()) return;

    this.api.sendThreadReply(
      this.parentMessage.message_id,
      this.auth.contactId!,
      this.replyText
    ).subscribe({
      next: () => {
        this.replyText = '';
        this.loadThread();
      },
      error: () => {}
    });
  }

  toggleFollow() {
    this.isFollowing = !this.isFollowing;
  }

  onClose() {
    this.close.emit();
  }

  formatTime(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));

    if (hours < 24) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}
