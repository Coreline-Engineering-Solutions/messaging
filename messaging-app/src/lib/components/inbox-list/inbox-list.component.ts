import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatRippleModule } from '@angular/material/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription } from 'rxjs';
import { MessagingStoreService } from '../../services/messaging-store.service';
import { InboxItem } from '../../models/messaging.models';

@Component({
  selector: 'app-inbox-list',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatRippleModule, MatTooltipModule],
  template: `
    <div class="inbox-container">
      <div class="inbox-header">
        <h3>Messages</h3>
        <div class="header-actions">
          <button mat-icon-button class="hdr-btn" (click)="onNewConversation()" matTooltip="New conversation" matTooltipPosition="below">
            <mat-icon>edit_square</mat-icon>
          </button>
          <button mat-icon-button class="hdr-btn" (click)="onCreateGroup()" matTooltip="Create group" matTooltipPosition="below">
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
          (contextmenu)="onContextMenu($event, item)"
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

      <!-- Context Menu -->
      <div
        *ngIf="contextMenu"
        class="context-menu"
        [style.top.px]="contextMenu.y"
        [style.left.px]="contextMenu.x"
      >
        <div class="ctx-item" (click)="clearChat()">
          <mat-icon>cleaning_services</mat-icon>
          <span>Clear conversation</span>
        </div>
        <div class="ctx-item ctx-danger" (click)="deleteChat()">
          <mat-icon>delete</mat-icon>
          <span>{{ contextMenu.item.is_group ? 'Delete group' : 'Delete conversation' }}</span>
        </div>
      </div>
      <div *ngIf="contextMenu" class="ctx-backdrop" (click)="closeContextMenu()"></div>
    </div>
  `,
  styles: [`
    .inbox-container {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: transparent;
    }

    .inbox-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.2);
    }

    .inbox-header h3 {
      margin: 0;
      font-size: 20px;
      font-weight: 700;
      color: #fff;
    }

    .header-actions {
      display: flex;
      gap: 4px;
    }

    .hdr-btn {
      border-radius: 6px !important;
      transition: background 0.15s, box-shadow 0.15s;
    }

    .hdr-btn:hover {
      background: rgba(255, 255, 255, 0.15) !important;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }

    .hdr-btn mat-icon {
      font-size: 20px;
      color: rgba(255, 255, 255, 0.9);
    }

    .search-bar {
      display: flex;
      align-items: center;
      margin: 4px 16px 8px;
      padding: 8px 12px;
      background: transparent;
      border-radius: 10px;
    }

    .search-icon {
      color: rgba(255, 255, 255, 0.7);
      font-size: 18px;
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
      color: #fff;
    }

    .search-input::placeholder {
      color: rgba(255, 255, 255, 0.6);
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
      background: rgba(255, 255, 255, 0.1);
    }

    .conversation-item.has-unread {
      background: rgba(255, 255, 255, 0.15);
    }

    .avatar {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: linear-gradient(135deg, #dbeafe 0%, #93c5fd 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .avatar mat-icon {
      color: #1F4BD8;
      font-size: 24px;
    }

    .group-avatar {
      background: linear-gradient(135deg, #dbeafe 0%, #60a5fa 100%);
    }

    .group-avatar mat-icon {
      color: #173396;
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
      color: #fff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 200px;
    }

    .conv-time {
      font-size: 11px;
      color: rgba(255, 255, 255, 0.7);
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
      color: rgba(255, 255, 255, 0.7);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 220px;
    }

    .has-unread .conv-name {
      color: #fff;
    }

    .has-unread .conv-preview {
      color: #374151;
      font-weight: 500;
    }

    .unread-badge {
      background: #1F4BD8;
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

    .context-menu {
      position: fixed;
      z-index: 10001;
      background: #1e1e2e;
      border-radius: 8px;
      padding: 4px 0;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
      min-width: 200px;
    }

    .ctx-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 16px;
      cursor: pointer;
      color: rgba(255, 255, 255, 0.9);
      font-size: 13px;
      transition: background 0.15s;
    }

    .ctx-item:hover {
      background: rgba(255, 255, 255, 0.1);
    }

    .ctx-item mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .ctx-danger {
      color: #f87171;
    }

    .ctx-danger:hover {
      background: rgba(248, 113, 113, 0.15);
    }

    .ctx-backdrop {
      position: fixed;
      inset: 0;
      z-index: 10000;
    }
  `],
})
export class InboxListComponent implements OnInit, OnDestroy {
  inbox: InboxItem[] = [];
  searchQuery = '';
  contextMenu: { x: number; y: number; item: InboxItem } | null = null;
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
    this.store.openConversation(item.conversation_id, item.name || 'Chat', item.is_group);
  }

  onNewConversation(): void {
    this.store.setView('new-conversation');
  }

  onCreateGroup(): void {
    this.store.setView('group-manager');
  }

  onContextMenu(event: MouseEvent, item: InboxItem): void {
    event.preventDefault();
    event.stopPropagation();
    this.contextMenu = { x: event.clientX, y: event.clientY, item };
  }

  closeContextMenu(): void {
    this.contextMenu = null;
  }

  clearChat(): void {
    if (!this.contextMenu) return;
    const id = this.contextMenu.item.conversation_id;
    this.store.clearConversation(id);
    this.contextMenu = null;
  }

  deleteChat(): void {
    if (!this.contextMenu) return;
    const item = this.contextMenu.item;
    if (item.is_group) {
      this.store.deleteGroup(item.conversation_id);
    } else {
      this.store.deleteConversation(item.conversation_id);
    }
    this.contextMenu = null;
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
