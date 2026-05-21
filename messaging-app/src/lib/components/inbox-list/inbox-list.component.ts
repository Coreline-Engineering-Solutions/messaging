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
      <div *ngIf="activeTab !== 'projects' && activeTab !== 'settings'" class="search-bar">
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

        <div *ngIf="filteredInbox.length === 0 && activeTab !== 'projects' && activeTab !== 'settings'" class="empty-state">
          <mat-icon>{{ activeTab === 'groups' ? 'group' : 'forum' }}</mat-icon>
          <p>{{ emptyStateText }}</p>
          <button *ngIf="!searchQuery && activeTab !== 'groups'" mat-stroked-button color="primary" (click)="onNewConversation()">
            Start a conversation
          </button>
          <button *ngIf="!searchQuery && activeTab === 'groups'" mat-stroked-button color="primary" (click)="onCreateGroup()">
            Create a group
          </button>
        </div>

        <div *ngIf="activeTab === 'projects'" class="empty-state projects-state">
          <mat-icon>workspaces</mat-icon>
          <p>Coming soon</p>
        </div>

        <div *ngIf="activeTab === 'settings'" class="settings-panel">
          <div class="settings-card">
            <div class="settings-header">
              <div class="settings-icon">
                <mat-icon>{{ notificationsMuted || notificationVolume <= 0 ? 'volume_off' : 'volume_up' }}</mat-icon>
              </div>
              <div>
                <h4>Notification Sound</h4>
                <p>Control message alerts for this browser.</p>
              </div>
            </div>

            <button
              type="button"
              mat-stroked-button
              class="settings-toggle"
              (click)="toggleNotificationsMuted()"
            >
              <mat-icon>{{ notificationsMuted ? 'volume_up' : 'volume_off' }}</mat-icon>
              {{ notificationsMuted ? 'Unmute notifications' : 'Mute notifications' }}
            </button>

            <label class="volume-label" for="messaging-volume-slider">
              Volume
              <span>{{ (notificationVolume * 100) | number:'1.0-0' }}%</span>
            </label>
            <input
              id="messaging-volume-slider"
              type="range"
              min="0"
              max="1"
              step="0.05"
              class="settings-volume"
              [(ngModel)]="notificationVolume"
              (ngModelChange)="onNotificationVolumeChange($event)"
              (change)="previewNotificationSound()"
            />
          </div>
        </div>
      </div>

      <div class="inbox-tabs" role="tablist" aria-label="Conversation filters">
        <button
          type="button"
          class="inbox-tab"
          [class.active]="activeTab === 'all'"
          (click)="setActiveTab('all')"
        >
          All
        </button>
        <button
          type="button"
          class="inbox-tab"
          [class.active]="activeTab === 'direct'"
          (click)="setActiveTab('direct')"
        >
          Chats
        </button>
        <button
          type="button"
          class="inbox-tab"
          [class.active]="activeTab === 'groups'"
          (click)="setActiveTab('groups')"
        >
          Groups
        </button>
        <button
          type="button"
          class="inbox-tab"
          [class.active]="activeTab === 'projects'"
          (click)="setActiveTab('projects')"
        >
          Projects
        </button>
        <button
          type="button"
          class="inbox-tab"
          [class.active]="activeTab === 'settings'"
          (click)="setActiveTab('settings')"
        >
          Settings
        </button>
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
          <mat-icon>{{ contextMenu.item.is_group ? 'logout' : 'delete' }}</mat-icon>
          <span>{{ contextMenu.item.is_group ? 'Exit group' : 'Delete conversation' }}</span>
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
      container-type: inline-size;
    }

    .search-bar {
      display: flex;
      align-items: center;
      margin: 8px 16px;
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

    .inbox-tabs {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 5px;
      padding: 10px 16px 12px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      flex-shrink: 0;
    }

    .inbox-tab {
      min-width: 0;
      border: 1px solid rgba(255, 255, 255, 0.14);
      background: rgba(255, 255, 255, 0.06);
      color: rgba(255, 255, 255, 0.72);
      border-radius: 999px;
      padding: 7px 4px;
      font-size: clamp(9px, 3.1cqw, 11px);
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      cursor: pointer;
      text-align: center;
      transition: background 0.15s, border-color 0.15s, color 0.15s;
    }

    .inbox-tab:hover {
      background: rgba(255, 255, 255, 0.12);
      color: #fff;
    }

    .inbox-tab.active {
      background: rgba(26, 95, 168, 0.35);
      border-color: rgba(127, 180, 255, 0.45);
      color: #fff;
    }

    @container (max-width: 330px) {
      .inbox-tabs {
        gap: 3px;
        padding: 8px 8px 10px;
      }

      .inbox-tab {
        padding: 6px 2px;
        letter-spacing: -0.2px;
      }
    }

    @container (max-width: 280px) {
      .inbox-tabs {
        gap: 2px;
        padding-left: 6px;
        padding-right: 6px;
      }

      .inbox-tab {
        font-size: 8.5px;
      }
    }

    .conversation-list {
      flex: 1;
      overflow-y: auto;
      scrollbar-width: none;
      -ms-overflow-style: none;
    }

    .conversation-list::-webkit-scrollbar {
      display: none;
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
      background: #0d2540;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .avatar mat-icon {
      color: rgba(255, 255, 255, 0.7);
      font-size: 24px;
    }

    .group-avatar {
      background: #0a1f38;
    }

    .group-avatar mat-icon {
      color: rgba(255, 255, 255, 0.7);
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
      color: rgba(255, 255, 255, 0.9);
      font-weight: 500;
    }

    .unread-badge {
      background: #1a5fa8;
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

    .projects-state p {
      margin-bottom: 0;
    }

    .settings-panel {
      padding: 16px;
      color: #fff;
    }

    .settings-card {
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.07);
      border: 1px solid rgba(255, 255, 255, 0.12);
      padding: 16px;
      box-shadow: 0 10px 28px rgba(0, 0, 0, 0.18);
    }

    .settings-header {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      margin-bottom: 16px;
    }

    .settings-icon {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: rgba(26, 95, 168, 0.35);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .settings-icon mat-icon {
      color: #bfdbfe;
    }

    .settings-header h4 {
      margin: 0 0 4px;
      font-size: 15px;
      font-weight: 700;
    }

    .settings-header p {
      margin: 0;
      color: rgba(255, 255, 255, 0.65);
      font-size: 12px;
      line-height: 1.4;
    }

    .settings-toggle {
      width: 100%;
      justify-content: center;
      border-radius: 10px;
      color: #fff !important;
      border-color: rgba(255, 255, 255, 0.2) !important;
      margin-bottom: 16px;
    }

    .settings-toggle mat-icon {
      margin-right: 8px;
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .volume-label {
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: rgba(255, 255, 255, 0.78);
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 8px;
    }

    .settings-volume {
      width: 100%;
      accent-color: #7fb4ff;
      cursor: pointer;
    }

    .context-menu {
      position: fixed;
      z-index: 10001;
      background: #071d30;
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
  activeTab: 'all' | 'direct' | 'groups' | 'projects' | 'settings' = 'all';
  notificationVolume = 0.35;
  notificationsMuted = false;
  contextMenu: { x: number; y: number; item: InboxItem } | null = null;
  private readonly tabStorageKey = 'messaging_inbox_active_tab';
  private sub!: Subscription;

  constructor(private store: MessagingStoreService) {}

  ngOnInit(): void {
    this.activeTab = this.getSavedTab();
    this.sub = new Subscription();
    this.sub.add(this.store.inbox.subscribe((items) => (this.inbox = items)));
    this.sub.add(this.store.notificationVolume.subscribe((volume) => (this.notificationVolume = volume)));
    this.sub.add(this.store.notificationsMuted.subscribe((muted) => (this.notificationsMuted = muted)));
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  get filteredInbox(): InboxItem[] {
    if (this.activeTab === 'projects' || this.activeTab === 'settings') return [];
    const tabbed = this.inbox.filter((item) => {
      if (this.activeTab === 'direct') return !item.is_group;
      if (this.activeTab === 'groups') return item.is_group;
      return true;
    });
    if (!this.searchQuery.trim()) return tabbed;
    const q = this.searchQuery.toLowerCase();
    return tabbed.filter(
      (item) =>
        (item.name || '').toLowerCase().includes(q) ||
        (item.last_message_preview || '').toLowerCase().includes(q)
    );
  }

  get emptyStateText(): string {
    if (this.searchQuery.trim()) return 'No matching conversations';
    if (this.activeTab === 'direct') return 'No chats yet';
    if (this.activeTab === 'groups') return 'No groups yet';
    return 'No conversations yet';
  }

  setActiveTab(tab: 'all' | 'direct' | 'groups' | 'projects' | 'settings'): void {
    this.activeTab = tab;
    localStorage.setItem(this.tabStorageKey, tab);
    this.contextMenu = null;
  }

  private getSavedTab(): 'all' | 'direct' | 'groups' | 'projects' | 'settings' {
    const saved = localStorage.getItem(this.tabStorageKey);
    return saved === 'direct' || saved === 'groups' || saved === 'projects' || saved === 'settings' || saved === 'all'
      ? saved
      : 'all';
  }

  toggleNotificationsMuted(): void {
    const nextMuted = !this.notificationsMuted;
    this.store.setNotificationsMuted(nextMuted);
    if (!nextMuted && this.notificationVolume > 0) {
      this.store.testNotificationSound();
    }
  }

  onNotificationVolumeChange(value: number | string): void {
    this.store.setNotificationVolume(Number(value));
  }

  previewNotificationSound(): void {
    if (!this.notificationsMuted && this.notificationVolume > 0) {
      this.store.testNotificationSound();
    }
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
