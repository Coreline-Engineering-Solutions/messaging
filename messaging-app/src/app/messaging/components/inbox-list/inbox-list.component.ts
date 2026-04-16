import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatRippleModule } from '@angular/material/core';
import { Subscription } from 'rxjs';
import { MessagingStoreService } from '../../services/messaging-store.service';
import { InboxItem } from '../../models/messaging.models';

@Component({
  selector: 'app-inbox-list',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatRippleModule],
  template: `
    <div class="inbox-container">
      <div class="inbox-header">
        <h3>Messages</h3>
        <div class="header-actions">
          <button mat-icon-button (click)="onNewConversation()" title="New conversation">
            <mat-icon>edit_square</mat-icon>
          </button>
          <button mat-icon-button (click)="onCreateGroup()" title="Create group">
            <mat-icon>group_add</mat-icon>
          </button>
        </div>
      </div>

      <div class="search-bar">
        <mat-icon class="search-icon">search</mat-icon>
        <input
          type="text"
          [(ngModel)]="searchQuery"
          placeholder="Search conversations..."
          class="search-input"
        />
      </div>

      <div class="conversation-list">
        <div
          *ngFor="let item of filteredInbox"
          class="conversation-item"
          matRipple
          [class.has-unread]="item.unread_count > 0"
          (click)="openConversation(item)"
        >
          <div class="avatar" [class.group-avatar]="item.is_group">
            <mat-icon>{{ item.is_group ? 'group' : 'person' }}</mat-icon>
          </div>
          <div class="conversation-info">
            <div class="info-top">
              <span class="conv-name">{{ item.name || 'Direct Message' }}</span>
              <span class="conv-time">{{ formatTime(item.last_message_at) }}</span>
            </div>
            <div class="info-bottom">
              <span class="conv-preview">{{ item.last_message_preview || 'No messages yet' }}</span>
              <span *ngIf="item.unread_count > 0" class="unread-badge">
                {{ item.unread_count > 99 ? '99+' : item.unread_count }}
              </span>
            </div>
          </div>
        </div>

        <div *ngIf="filteredInbox.length === 0" class="empty-state">
          <mat-icon>forum</mat-icon>
          <p>{{ searchQuery ? 'No matching conversations' : 'No conversations yet' }}</p>
          <button *ngIf="!searchQuery" mat-stroked-button color="primary" (click)="onNewConversation()">
            Start a conversation
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .inbox-container {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .inbox-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 16px 8px;
    }

    .inbox-header h3 {
      margin: 0;
      font-size: 20px;
      font-weight: 700;
      color: #1f2937;
    }

    .header-actions {
      display: flex;
      gap: 4px;
    }

    .header-actions button mat-icon {
      font-size: 20px;
      color: #6b7280;
    }

    .search-bar {
      display: flex;
      align-items: center;
      margin: 4px 16px 8px;
      padding: 8px 12px;
      background: #f3f4f6;
      border-radius: 10px;
    }

    .search-icon {
      color: #9ca3af;
      font-size: 20px;
      width: 20px;
      height: 20px;
      margin-right: 8px;
    }

    .search-input {
      flex: 1;
      border: none;
      outline: none;
      background: transparent;
      font-size: 14px;
      color: #1f2937;
    }

    .search-input::placeholder {
      color: #9ca3af;
    }

    .conversation-list {
      flex: 1;
      overflow-y: auto;
    }

    .conversation-item {
      display: flex;
      align-items: center;
      padding: 12px 16px;
      cursor: pointer;
      transition: background 0.15s;
      gap: 12px;
    }

    .conversation-item:hover {
      background: #f9fafb;
    }

    .conversation-item.has-unread {
      background: #f0f4ff;
    }

    .avatar {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .avatar mat-icon {
      color: #667eea;
      font-size: 24px;
    }

    .group-avatar {
      background: linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%);
    }

    .group-avatar mat-icon {
      color: #ec4899;
    }

    .conversation-info {
      flex: 1;
      min-width: 0;
    }

    .info-top {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 2px;
    }

    .conv-name {
      font-weight: 600;
      font-size: 14px;
      color: #1f2937;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 200px;
    }

    .conv-time {
      font-size: 11px;
      color: #9ca3af;
      flex-shrink: 0;
      margin-left: 8px;
    }

    .info-bottom {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .conv-preview {
      font-size: 13px;
      color: #6b7280;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 220px;
    }

    .has-unread .conv-name {
      color: #111827;
    }

    .has-unread .conv-preview {
      color: #374151;
      font-weight: 500;
    }

    .unread-badge {
      background: #667eea;
      color: #fff;
      border-radius: 10px;
      min-width: 20px;
      height: 20px;
      font-size: 11px;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 6px;
      flex-shrink: 0;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px 24px;
      color: #9ca3af;
    }

    .empty-state mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      margin-bottom: 12px;
    }

    .empty-state p {
      margin: 0 0 16px;
      font-size: 14px;
    }
  `],
})
export class InboxListComponent implements OnInit, OnDestroy {
  inbox: InboxItem[] = [];
  searchQuery = '';
  private sub!: Subscription;

  constructor(private store: MessagingStoreService) {}

  ngOnInit(): void {
    this.sub = this.store.inbox.subscribe((items) => (this.inbox = items));
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  get filteredInbox(): InboxItem[] {
    if (!this.searchQuery.trim()) return this.inbox;
    const q = this.searchQuery.toLowerCase();
    return this.inbox.filter(
      (item) =>
        (item.name || '').toLowerCase().includes(q) ||
        (item.last_message_preview || '').toLowerCase().includes(q)
    );
  }

  openConversation(item: InboxItem): void {
    this.store.openConversation(item.conversation_id, item.name, item.is_group);
  }

  onNewConversation(): void {
    this.store.setView('new-conversation');
  }

  onCreateGroup(): void {
    this.store.setView('group-manager');
  }

  formatTime(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;

    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }
}
