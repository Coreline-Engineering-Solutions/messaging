import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatRippleModule } from '@angular/material/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription } from 'rxjs';
import * as i0 from "@angular/core";
import * as i1 from "../../services/messaging-store.service";
import * as i2 from "@angular/common";
import * as i3 from "@angular/forms";
import * as i4 from "@angular/material/icon";
import * as i5 from "@angular/material/button";
import * as i6 from "@angular/material/core";
export class InboxListComponent {
    store;
    inbox = [];
    searchQuery = '';
    activeTab = 'all';
    notificationVolume = 0.35;
    notificationsMuted = false;
    contextMenu = null;
    tabStorageKey = 'messaging_inbox_active_tab';
    sub;
    constructor(store) {
        this.store = store;
    }
    ngOnInit() {
        this.activeTab = this.getSavedTab();
        this.sub = new Subscription();
        this.sub.add(this.store.inbox.subscribe((items) => (this.inbox = items)));
        this.sub.add(this.store.notificationVolume.subscribe((volume) => (this.notificationVolume = volume)));
        this.sub.add(this.store.notificationsMuted.subscribe((muted) => (this.notificationsMuted = muted)));
    }
    ngOnDestroy() {
        this.sub?.unsubscribe();
    }
    get filteredInbox() {
        if (this.activeTab === 'projects' || this.activeTab === 'settings')
            return [];
        const tabbed = this.inbox.filter((item) => {
            if (this.activeTab === 'direct')
                return !item.is_group;
            if (this.activeTab === 'groups')
                return item.is_group;
            return true;
        });
        if (!this.searchQuery.trim())
            return tabbed;
        const q = this.searchQuery.toLowerCase();
        return tabbed.filter((item) => (item.name || '').toLowerCase().includes(q) ||
            (item.last_message_preview || '').toLowerCase().includes(q));
    }
    get emptyStateText() {
        if (this.searchQuery.trim())
            return 'No matching conversations';
        if (this.activeTab === 'direct')
            return 'No chats yet';
        if (this.activeTab === 'groups')
            return 'No groups yet';
        return 'No conversations yet';
    }
    setActiveTab(tab) {
        this.activeTab = tab;
        localStorage.setItem(this.tabStorageKey, tab);
        this.contextMenu = null;
    }
    getSavedTab() {
        const saved = localStorage.getItem(this.tabStorageKey);
        return saved === 'direct' || saved === 'groups' || saved === 'projects' || saved === 'settings' || saved === 'all'
            ? saved
            : 'all';
    }
    toggleNotificationsMuted() {
        const nextMuted = !this.notificationsMuted;
        this.store.setNotificationsMuted(nextMuted);
        if (!nextMuted && this.notificationVolume > 0) {
            this.store.testNotificationSound();
        }
    }
    onNotificationVolumeChange(value) {
        this.store.setNotificationVolume(Number(value));
    }
    previewNotificationSound() {
        if (!this.notificationsMuted && this.notificationVolume > 0) {
            this.store.testNotificationSound();
        }
    }
    openConversation(item) {
        this.store.openConversation(item.conversation_id, item.name || 'Chat', item.is_group);
    }
    onNewConversation() {
        this.store.setView('new-conversation');
    }
    onCreateGroup() {
        this.store.setView('group-manager');
    }
    onContextMenu(event, item) {
        event.preventDefault();
        event.stopPropagation();
        this.contextMenu = { x: event.clientX, y: event.clientY, item };
    }
    closeContextMenu() {
        this.contextMenu = null;
    }
    clearChat() {
        if (!this.contextMenu)
            return;
        const id = this.contextMenu.item.conversation_id;
        this.store.clearConversation(id);
        this.contextMenu = null;
    }
    deleteChat() {
        if (!this.contextMenu)
            return;
        const item = this.contextMenu.item;
        if (item.is_group) {
            this.store.deleteGroup(item.conversation_id);
        }
        else {
            this.store.deleteConversation(item.conversation_id);
        }
        this.contextMenu = null;
    }
    formatTime(dateStr) {
        if (!dateStr)
            return '';
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        if (diffMins < 1)
            return 'now';
        if (diffMins < 60)
            return `${diffMins}m`;
        if (diffHours < 24)
            return `${diffHours}h`;
        if (diffDays < 7)
            return `${diffDays}d`;
        return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: InboxListComponent, deps: [{ token: i1.MessagingStoreService }], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "17.3.12", type: InboxListComponent, isStandalone: true, selector: "app-inbox-list", ngImport: i0, template: `
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
  `, isInline: true, styles: [".inbox-container{display:flex;flex-direction:column;height:100%;background:transparent;container-type:inline-size}.search-bar{display:flex;align-items:center;margin:8px 16px;padding:8px 12px;background:transparent;border-radius:10px}.search-icon{color:#ffffffb3;font-size:18px;width:20px;height:20px;margin-right:8px}.search-input{flex:1;border:none;outline:none;background:transparent;font-size:14px;color:#fff}.search-input::placeholder{color:#fff9}.inbox-tabs{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:5px;padding:10px 16px 12px;border-top:1px solid rgba(255,255,255,.1);flex-shrink:0}.inbox-tab{min-width:0;border:1px solid rgba(255,255,255,.14);background:#ffffff0f;color:#ffffffb8;border-radius:999px;padding:7px 4px;font-size:clamp(9px,3.1cqw,11px);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;text-align:center;transition:background .15s,border-color .15s,color .15s}.inbox-tab:hover{background:#ffffff1f;color:#fff}.inbox-tab.active{background:#1a5fa859;border-color:#7fb4ff73;color:#fff}@container (max-width: 330px){.inbox-tabs{gap:3px;padding:8px 8px 10px}.inbox-tab{padding:6px 2px;letter-spacing:-.2px}}@container (max-width: 280px){.inbox-tabs{gap:2px;padding-left:6px;padding-right:6px}.inbox-tab{font-size:8.5px}}.conversation-list{flex:1;overflow-y:auto;scrollbar-width:none;-ms-overflow-style:none}.conversation-list::-webkit-scrollbar{display:none}.conversation-item{display:flex;align-items:center;padding:12px 16px;cursor:pointer;transition:background .15s;gap:12px}.conversation-item:hover{background:#ffffff1a}.conversation-item.has-unread{background:#ffffff26}.avatar{width:48px;height:48px;border-radius:50%;background:#0d2540;display:flex;align-items:center;justify-content:center;flex-shrink:0}.avatar mat-icon{color:#ffffffb3;font-size:24px}.group-avatar{background:#0a1f38}.group-avatar mat-icon{color:#ffffffb3}.conversation-info{flex:1;min-width:0}.info-top{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:2px}.conv-name{font-weight:600;font-size:14px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px}.conv-time{font-size:11px;color:#ffffffb3;flex-shrink:0;margin-left:8px}.info-bottom{display:flex;justify-content:space-between;align-items:center}.conv-preview{font-size:13px;color:#ffffffb3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px}.has-unread .conv-name{color:#fff}.has-unread .conv-preview{color:#ffffffe6;font-weight:500}.unread-badge{background:#1a5fa8;color:#fff;border-radius:10px;min-width:20px;height:20px;font-size:11px;font-weight:600;display:flex;align-items:center;justify-content:center;padding:0 6px;flex-shrink:0}.empty-state{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 24px;color:#9ca3af}.empty-state mat-icon{font-size:48px;width:48px;height:48px;margin-bottom:12px}.empty-state p{margin:0 0 16px;font-size:14px}.projects-state p{margin-bottom:0}.settings-panel{padding:16px;color:#fff}.settings-card{border-radius:14px;background:#ffffff12;border:1px solid rgba(255,255,255,.12);padding:16px;box-shadow:0 10px 28px #0000002e}.settings-header{display:flex;gap:12px;align-items:flex-start;margin-bottom:16px}.settings-icon{width:36px;height:36px;border-radius:10px;background:#1a5fa859;display:flex;align-items:center;justify-content:center;flex-shrink:0}.settings-icon mat-icon{color:#bfdbfe}.settings-header h4{margin:0 0 4px;font-size:15px;font-weight:700}.settings-header p{margin:0;color:#ffffffa6;font-size:12px;line-height:1.4}.settings-toggle{width:100%;justify-content:center;border-radius:10px;color:#fff!important;border-color:#fff3!important;margin-bottom:16px}.settings-toggle mat-icon{margin-right:8px;font-size:18px;width:18px;height:18px}.volume-label{display:flex;justify-content:space-between;align-items:center;color:#ffffffc7;font-size:12px;font-weight:600;margin-bottom:8px}.settings-volume{width:100%;accent-color:#7fb4ff;cursor:pointer}.context-menu{position:fixed;z-index:10001;background:#071d30;border-radius:8px;padding:4px 0;box-shadow:0 8px 24px #0000004d;min-width:200px}.ctx-item{display:flex;align-items:center;gap:10px;padding:10px 16px;cursor:pointer;color:#ffffffe6;font-size:13px;transition:background .15s}.ctx-item:hover{background:#ffffff1a}.ctx-item mat-icon{font-size:18px;width:18px;height:18px}.ctx-danger{color:#f87171}.ctx-danger:hover{background:#f8717126}.ctx-backdrop{position:fixed;inset:0;z-index:10000}\n"], dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i2.NgForOf, selector: "[ngFor][ngForOf]", inputs: ["ngForOf", "ngForTrackBy", "ngForTemplate"] }, { kind: "directive", type: i2.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "pipe", type: i2.DecimalPipe, name: "number" }, { kind: "ngmodule", type: FormsModule }, { kind: "directive", type: i3.DefaultValueAccessor, selector: "input:not([type=checkbox])[formControlName],textarea[formControlName],input:not([type=checkbox])[formControl],textarea[formControl],input:not([type=checkbox])[ngModel],textarea[ngModel],[ngDefaultControl]" }, { kind: "directive", type: i3.RangeValueAccessor, selector: "input[type=range][formControlName],input[type=range][formControl],input[type=range][ngModel]" }, { kind: "directive", type: i3.NgControlStatus, selector: "[formControlName],[ngModel],[formControl]" }, { kind: "directive", type: i3.NgModel, selector: "[ngModel]:not([formControlName]):not([formControl])", inputs: ["name", "disabled", "ngModel", "ngModelOptions"], outputs: ["ngModelChange"], exportAs: ["ngModel"] }, { kind: "ngmodule", type: MatIconModule }, { kind: "component", type: i4.MatIcon, selector: "mat-icon", inputs: ["color", "inline", "svgIcon", "fontSet", "fontIcon"], exportAs: ["matIcon"] }, { kind: "ngmodule", type: MatButtonModule }, { kind: "component", type: i5.MatButton, selector: "    button[mat-button], button[mat-raised-button], button[mat-flat-button],    button[mat-stroked-button]  ", exportAs: ["matButton"] }, { kind: "ngmodule", type: MatRippleModule }, { kind: "directive", type: i6.MatRipple, selector: "[mat-ripple], [matRipple]", inputs: ["matRippleColor", "matRippleUnbounded", "matRippleCentered", "matRippleRadius", "matRippleAnimation", "matRippleDisabled", "matRippleTrigger"], exportAs: ["matRipple"] }, { kind: "ngmodule", type: MatTooltipModule }] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: InboxListComponent, decorators: [{
            type: Component,
            args: [{ selector: 'app-inbox-list', standalone: true, imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatRippleModule, MatTooltipModule], template: `
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
  `, styles: [".inbox-container{display:flex;flex-direction:column;height:100%;background:transparent;container-type:inline-size}.search-bar{display:flex;align-items:center;margin:8px 16px;padding:8px 12px;background:transparent;border-radius:10px}.search-icon{color:#ffffffb3;font-size:18px;width:20px;height:20px;margin-right:8px}.search-input{flex:1;border:none;outline:none;background:transparent;font-size:14px;color:#fff}.search-input::placeholder{color:#fff9}.inbox-tabs{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:5px;padding:10px 16px 12px;border-top:1px solid rgba(255,255,255,.1);flex-shrink:0}.inbox-tab{min-width:0;border:1px solid rgba(255,255,255,.14);background:#ffffff0f;color:#ffffffb8;border-radius:999px;padding:7px 4px;font-size:clamp(9px,3.1cqw,11px);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;text-align:center;transition:background .15s,border-color .15s,color .15s}.inbox-tab:hover{background:#ffffff1f;color:#fff}.inbox-tab.active{background:#1a5fa859;border-color:#7fb4ff73;color:#fff}@container (max-width: 330px){.inbox-tabs{gap:3px;padding:8px 8px 10px}.inbox-tab{padding:6px 2px;letter-spacing:-.2px}}@container (max-width: 280px){.inbox-tabs{gap:2px;padding-left:6px;padding-right:6px}.inbox-tab{font-size:8.5px}}.conversation-list{flex:1;overflow-y:auto;scrollbar-width:none;-ms-overflow-style:none}.conversation-list::-webkit-scrollbar{display:none}.conversation-item{display:flex;align-items:center;padding:12px 16px;cursor:pointer;transition:background .15s;gap:12px}.conversation-item:hover{background:#ffffff1a}.conversation-item.has-unread{background:#ffffff26}.avatar{width:48px;height:48px;border-radius:50%;background:#0d2540;display:flex;align-items:center;justify-content:center;flex-shrink:0}.avatar mat-icon{color:#ffffffb3;font-size:24px}.group-avatar{background:#0a1f38}.group-avatar mat-icon{color:#ffffffb3}.conversation-info{flex:1;min-width:0}.info-top{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:2px}.conv-name{font-weight:600;font-size:14px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px}.conv-time{font-size:11px;color:#ffffffb3;flex-shrink:0;margin-left:8px}.info-bottom{display:flex;justify-content:space-between;align-items:center}.conv-preview{font-size:13px;color:#ffffffb3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px}.has-unread .conv-name{color:#fff}.has-unread .conv-preview{color:#ffffffe6;font-weight:500}.unread-badge{background:#1a5fa8;color:#fff;border-radius:10px;min-width:20px;height:20px;font-size:11px;font-weight:600;display:flex;align-items:center;justify-content:center;padding:0 6px;flex-shrink:0}.empty-state{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 24px;color:#9ca3af}.empty-state mat-icon{font-size:48px;width:48px;height:48px;margin-bottom:12px}.empty-state p{margin:0 0 16px;font-size:14px}.projects-state p{margin-bottom:0}.settings-panel{padding:16px;color:#fff}.settings-card{border-radius:14px;background:#ffffff12;border:1px solid rgba(255,255,255,.12);padding:16px;box-shadow:0 10px 28px #0000002e}.settings-header{display:flex;gap:12px;align-items:flex-start;margin-bottom:16px}.settings-icon{width:36px;height:36px;border-radius:10px;background:#1a5fa859;display:flex;align-items:center;justify-content:center;flex-shrink:0}.settings-icon mat-icon{color:#bfdbfe}.settings-header h4{margin:0 0 4px;font-size:15px;font-weight:700}.settings-header p{margin:0;color:#ffffffa6;font-size:12px;line-height:1.4}.settings-toggle{width:100%;justify-content:center;border-radius:10px;color:#fff!important;border-color:#fff3!important;margin-bottom:16px}.settings-toggle mat-icon{margin-right:8px;font-size:18px;width:18px;height:18px}.volume-label{display:flex;justify-content:space-between;align-items:center;color:#ffffffc7;font-size:12px;font-weight:600;margin-bottom:8px}.settings-volume{width:100%;accent-color:#7fb4ff;cursor:pointer}.context-menu{position:fixed;z-index:10001;background:#071d30;border-radius:8px;padding:4px 0;box-shadow:0 8px 24px #0000004d;min-width:200px}.ctx-item{display:flex;align-items:center;gap:10px;padding:10px 16px;cursor:pointer;color:#ffffffe6;font-size:13px;transition:background .15s}.ctx-item:hover{background:#ffffff1a}.ctx-item mat-icon{font-size:18px;width:18px;height:18px}.ctx-danger{color:#f87171}.ctx-danger:hover{background:#f8717126}.ctx-backdrop{position:fixed;inset:0;z-index:10000}\n"] }]
        }], ctorParameters: () => [{ type: i1.MessagingStoreService }] });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5ib3gtbGlzdC5jb21wb25lbnQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvbGliL2NvbXBvbmVudHMvaW5ib3gtbGlzdC9pbmJveC1saXN0LmNvbXBvbmVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsU0FBUyxFQUFxQixNQUFNLGVBQWUsQ0FBQztBQUM3RCxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDL0MsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLGdCQUFnQixDQUFDO0FBQzdDLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSx3QkFBd0IsQ0FBQztBQUN2RCxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFDM0QsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHdCQUF3QixDQUFDO0FBQ3pELE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBQzdELE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxNQUFNLENBQUM7Ozs7Ozs7O0FBd2hCcEMsTUFBTSxPQUFPLGtCQUFrQjtJQVVUO0lBVHBCLEtBQUssR0FBZ0IsRUFBRSxDQUFDO0lBQ3hCLFdBQVcsR0FBRyxFQUFFLENBQUM7SUFDakIsU0FBUyxHQUEwRCxLQUFLLENBQUM7SUFDekUsa0JBQWtCLEdBQUcsSUFBSSxDQUFDO0lBQzFCLGtCQUFrQixHQUFHLEtBQUssQ0FBQztJQUMzQixXQUFXLEdBQXFELElBQUksQ0FBQztJQUNwRCxhQUFhLEdBQUcsNEJBQTRCLENBQUM7SUFDdEQsR0FBRyxDQUFnQjtJQUUzQixZQUFvQixLQUE0QjtRQUE1QixVQUFLLEdBQUwsS0FBSyxDQUF1QjtJQUFHLENBQUM7SUFFcEQsUUFBUTtRQUNOLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO1FBQ3BDLElBQUksQ0FBQyxHQUFHLEdBQUcsSUFB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Ozs0RkFpaEIzRixrQkFBa0I7a0JBcGhCOUIsU0FBUzsrQkFDRSxnQkFBZ0IsY0FDZCxJQUFJLFdBQ1AsQ0FBQyxZQUFZLEVBQUUsV0FBVyxFQUFFLGFBQWEsRUFBRSxlQUFlLEVBQUUsZUFBZSxFQUFFLGdCQUFnQixDQUFDLFlBQzdGOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7R0E0SlQiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBDb21wb25lbnQsIE9uSW5pdCwgT25EZXN0cm95IH0gZnJvbSAnQGFuZ3VsYXIvY29yZSc7XHJcbmltcG9ydCB7IENvbW1vbk1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL2NvbW1vbic7XHJcbmltcG9ydCB7IEZvcm1zTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvZm9ybXMnO1xyXG5pbXBvcnQgeyBNYXRJY29uTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvbWF0ZXJpYWwvaWNvbic7XHJcbmltcG9ydCB7IE1hdEJ1dHRvbk1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL21hdGVyaWFsL2J1dHRvbic7XHJcbmltcG9ydCB7IE1hdFJpcHBsZU1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL21hdGVyaWFsL2NvcmUnO1xyXG5pbXBvcnQgeyBNYXRUb29sdGlwTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvbWF0ZXJpYWwvdG9vbHRpcCc7XHJcbmltcG9ydCB7IFN1YnNjcmlwdGlvbiB9IGZyb20gJ3J4anMnO1xyXG5pbXBvcnQgeyBNZXNzYWdpbmdTdG9yZVNlcnZpY2UgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9tZXNzYWdpbmctc3RvcmUuc2VydmljZSc7XHJcbmltcG9ydCB7IEluYm94SXRlbSB9IGZyb20gJy4uLy4uL21vZGVscy9tZXNzYWdpbmcubW9kZWxzJztcclxuXHJcbkBDb21wb25lbnQoe1xyXG4gIHNlbGVjdG9yOiAnYXBwLWluYm94LWxpc3QnLFxyXG4gIHN0YW5kYWxvbmU6IHRydWUsXHJcbiAgaW1wb3J0czogW0NvbW1vbk1vZHVsZSwgRm9ybXNNb2R1bGUsIE1hdEljb25Nb2R1bGUsIE1hdEJ1dHRvbk1vZHVsZSwgTWF0UmlwcGxlTW9kdWxlLCBNYXRUb29sdGlwTW9kdWxlXSxcclxuICB0ZW1wbGF0ZTogYFxyXG4gICAgPGRpdiBjbGFzcz1cImluYm94LWNvbnRhaW5lclwiPlxyXG4gICAgICA8ZGl2ICpuZ0lmPVwiYWN0aXZlVGFiICE9PSAncHJvamVjdHMnICYmIGFjdGl2ZVRhYiAhPT0gJ3NldHRpbmdzJ1wiIGNsYXNzPVwic2VhcmNoLWJhclwiPlxyXG4gICAgICAgIDxtYXQtaWNvbiBjbGFzcz1cInNlYXJjaC1pY29uXCI+c2VhcmNoPC9tYXQtaWNvbj5cclxuICAgICAgICA8aW5wdXRcclxuICAgICAgICAgIHR5cGU9XCJ0ZXh0XCJcclxuICAgICAgICAgIFsobmdNb2RlbCldPVwic2VhcmNoUXVlcnlcIlxyXG4gICAgICAgICAgcGxhY2Vob2xkZXI9XCJTZWFyY2ggY29udmVyc2F0aW9ucy4uLlwiXHJcbiAgICAgICAgICBjbGFzcz1cInNlYXJjaC1pbnB1dFwiXHJcbiAgICAgICAgLz5cclxuICAgICAgPC9kaXY+XHJcblxyXG4gICAgICA8ZGl2IGNsYXNzPVwiY29udmVyc2F0aW9uLWxpc3RcIj5cclxuICAgICAgICA8ZGl2XHJcbiAgICAgICAgICAqbmdGb3I9XCJsZXQgaXRlbSBvZiBmaWx0ZXJlZEluYm94XCJcclxuICAgICAgICAgIGNsYXNzPVwiY29udmVyc2F0aW9uLWl0ZW1cIlxyXG4gICAgICAgICAgbWF0UmlwcGxlXHJcbiAgICAgICAgICBbY2xhc3MuaGFzLXVucmVhZF09XCJpdGVtLnVucmVhZF9jb3VudCA+IDBcIlxyXG4gICAgICAgICAgKGNsaWNrKT1cIm9wZW5Db252ZXJzYXRpb24oaXRlbSlcIlxyXG4gICAgICAgICAgKGNvbnRleHRtZW51KT1cIm9uQ29udGV4dE1lbnUoJGV2ZW50LCBpdGVtKVwiXHJcbiAgICAgICAgPlxyXG4gICAgICAgICAgPGRpdiBjbGFzcz1cImF2YXRhclwiIFtjbGFzcy5ncm91cC1hdmF0YXJdPVwiaXRlbS5pc19ncm91cFwiPlxyXG4gICAgICAgICAgICA8bWF0LWljb24+e3sgaXRlbS5pc19ncm91cCA/ICdncm91cCcgOiAncGVyc29uJyB9fTwvbWF0LWljb24+XHJcbiAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJjb252ZXJzYXRpb24taW5mb1wiPlxyXG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwiaW5mby10b3BcIj5cclxuICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cImNvbnYtbmFtZVwiPnt7IGl0ZW0ubmFtZSB8fCAnRGlyZWN0IE1lc3NhZ2UnIH19PC9zcGFuPlxyXG4gICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwiY29udi10aW1lXCI+e3sgZm9ybWF0VGltZShpdGVtLmxhc3RfbWVzc2FnZV9hdCkgfX08L3NwYW4+XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwiaW5mby1ib3R0b21cIj5cclxuICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cImNvbnYtcHJldmlld1wiPnt7IGl0ZW0ubGFzdF9tZXNzYWdlX3ByZXZpZXcgfHwgJ05vIG1lc3NhZ2VzIHlldCcgfX08L3NwYW4+XHJcbiAgICAgICAgICAgICAgPHNwYW4gKm5nSWY9XCJpdGVtLnVucmVhZF9jb3VudCA+IDBcIiBjbGFzcz1cInVucmVhZC1iYWRnZVwiPlxyXG4gICAgICAgICAgICAgICAge3sgaXRlbS51bnJlYWRfY291bnQgPiA5OSA/ICc5OSsnIDogaXRlbS51bnJlYWRfY291bnQgfX1cclxuICAgICAgICAgICAgICA8L3NwYW4+XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgIDxkaXYgKm5nSWY9XCJmaWx0ZXJlZEluYm94Lmxlbmd0aCA9PT0gMCAmJiBhY3RpdmVUYWIgIT09ICdwcm9qZWN0cycgJiYgYWN0aXZlVGFiICE9PSAnc2V0dGluZ3MnXCIgY2xhc3M9XCJlbXB0eS1zdGF0ZVwiPlxyXG4gICAgICAgICAgPG1hdC1pY29uPnt7IGFjdGl2ZVRhYiA9PT0gJ2dyb3VwcycgPyAnZ3JvdXAnIDogJ2ZvcnVtJyB9fTwvbWF0LWljb24+XHJcbiAgICAgICAgICA8cD57eyBlbXB0eVN0YXRlVGV4dCB9fTwvcD5cclxuICAgICAgICAgIDxidXR0b24gKm5nSWY9XCIhc2VhcmNoUXVlcnkgJiYgYWN0aXZlVGFiICE9PSAnZ3JvdXBzJ1wiIG1hdC1zdHJva2VkLWJ1dHRvbiBjb2xvcj1cInByaW1hcnlcIiAoY2xpY2spPVwib25OZXdDb252ZXJzYXRpb24oKVwiPlxyXG4gICAgICAgICAgICBTdGFydCBhIGNvbnZlcnNhdGlvblxyXG4gICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICA8YnV0dG9uICpuZ0lmPVwiIXNlYXJjaFF1ZXJ5ICYmIGFjdGl2ZVRhYiA9PT0gJ2dyb3VwcydcIiBtYXQtc3Ryb2tlZC1idXR0b24gY29sb3I9XCJwcmltYXJ5XCIgKGNsaWNrKT1cIm9uQ3JlYXRlR3JvdXAoKVwiPlxyXG4gICAgICAgICAgICBDcmVhdGUgYSBncm91cFxyXG4gICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgIDxkaXYgKm5nSWY9XCJhY3RpdmVUYWIgPT09ICdwcm9qZWN0cydcIiBjbGFzcz1cImVtcHR5LXN0YXRlIHByb2plY3RzLXN0YXRlXCI+XHJcbiAgICAgICAgICA8bWF0LWljb24+d29ya3NwYWNlczwvbWF0LWljb24+XHJcbiAgICAgICAgICA8cD5Db21pbmcgc29vbjwvcD5cclxuICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgPGRpdiAqbmdJZj1cImFjdGl2ZVRhYiA9PT0gJ3NldHRpbmdzJ1wiIGNsYXNzPVwic2V0dGluZ3MtcGFuZWxcIj5cclxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJzZXR0aW5ncy1jYXJkXCI+XHJcbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJzZXR0aW5ncy1oZWFkZXJcIj5cclxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwic2V0dGluZ3MtaWNvblwiPlxyXG4gICAgICAgICAgICAgICAgPG1hdC1pY29uPnt7IG5vdGlmaWNhdGlvbnNNdXRlZCB8fCBub3RpZmljYXRpb25Wb2x1bWUgPD0gMCA/ICd2b2x1bWVfb2ZmJyA6ICd2b2x1bWVfdXAnIH19PC9tYXQtaWNvbj5cclxuICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICA8ZGl2PlxyXG4gICAgICAgICAgICAgICAgPGg0Pk5vdGlmaWNhdGlvbiBTb3VuZDwvaDQ+XHJcbiAgICAgICAgICAgICAgICA8cD5Db250cm9sIG1lc3NhZ2UgYWxlcnRzIGZvciB0aGlzIGJyb3dzZXIuPC9wPlxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgICAgIDxidXR0b25cclxuICAgICAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcclxuICAgICAgICAgICAgICBtYXQtc3Ryb2tlZC1idXR0b25cclxuICAgICAgICAgICAgICBjbGFzcz1cInNldHRpbmdzLXRvZ2dsZVwiXHJcbiAgICAgICAgICAgICAgKGNsaWNrKT1cInRvZ2dsZU5vdGlmaWNhdGlvbnNNdXRlZCgpXCJcclxuICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgIDxtYXQtaWNvbj57eyBub3RpZmljYXRpb25zTXV0ZWQgPyAndm9sdW1lX3VwJyA6ICd2b2x1bWVfb2ZmJyB9fTwvbWF0LWljb24+XHJcbiAgICAgICAgICAgICAge3sgbm90aWZpY2F0aW9uc011dGVkID8gJ1VubXV0ZSBub3RpZmljYXRpb25zJyA6ICdNdXRlIG5vdGlmaWNhdGlvbnMnIH19XHJcbiAgICAgICAgICAgIDwvYnV0dG9uPlxyXG5cclxuICAgICAgICAgICAgPGxhYmVsIGNsYXNzPVwidm9sdW1lLWxhYmVsXCIgZm9yPVwibWVzc2FnaW5nLXZvbHVtZS1zbGlkZXJcIj5cclxuICAgICAgICAgICAgICBWb2x1bWVcclxuICAgICAgICAgICAgICA8c3Bhbj57eyAobm90aWZpY2F0aW9uVm9sdW1lICogMTAwKSB8IG51bWJlcjonMS4wLTAnIH19JTwvc3Bhbj5cclxuICAgICAgICAgICAgPC9sYWJlbD5cclxuICAgICAgICAgICAgPGlucHV0XHJcbiAgICAgICAgICAgICAgaWQ9XCJtZXNzYWdpbmctdm9sdW1lLXNsaWRlclwiXHJcbiAgICAgICAgICAgICAgdHlwZT1cInJhbmdlXCJcclxuICAgICAgICAgICAgICBtaW49XCIwXCJcclxuICAgICAgICAgICAgICBtYXg9XCIxXCJcclxuICAgICAgICAgICAgICBzdGVwPVwiMC4wNVwiXHJcbiAgICAgICAgICAgICAgY2xhc3M9XCJzZXR0aW5ncy12b2x1bWVcIlxyXG4gICAgICAgICAgICAgIFsobmdNb2RlbCldPVwibm90aWZpY2F0aW9uVm9sdW1lXCJcclxuICAgICAgICAgICAgICAobmdNb2RlbENoYW5nZSk9XCJvbk5vdGlmaWNhdGlvblZvbHVtZUNoYW5nZSgkZXZlbnQpXCJcclxuICAgICAgICAgICAgICAoY2hhbmdlKT1cInByZXZpZXdOb3RpZmljYXRpb25Tb3VuZCgpXCJcclxuICAgICAgICAgICAgLz5cclxuICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgIDwvZGl2PlxyXG4gICAgICA8L2Rpdj5cclxuXHJcbiAgICAgIDxkaXYgY2xhc3M9XCJpbmJveC10YWJzXCIgcm9sZT1cInRhYmxpc3RcIiBhcmlhLWxhYmVsPVwiQ29udmVyc2F0aW9uIGZpbHRlcnNcIj5cclxuICAgICAgICA8YnV0dG9uXHJcbiAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcclxuICAgICAgICAgIGNsYXNzPVwiaW5ib3gtdGFiXCJcclxuICAgICAgICAgIFtjbGFzcy5hY3RpdmVdPVwiYWN0aXZlVGFiID09PSAnYWxsJ1wiXHJcbiAgICAgICAgICAoY2xpY2spPVwic2V0QWN0aXZlVGFiKCdhbGwnKVwiXHJcbiAgICAgICAgPlxyXG4gICAgICAgICAgQWxsXHJcbiAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgdHlwZT1cImJ1dHRvblwiXHJcbiAgICAgICAgICBjbGFzcz1cImluYm94LXRhYlwiXHJcbiAgICAgICAgICBbY2xhc3MuYWN0aXZlXT1cImFjdGl2ZVRhYiA9PT0gJ2RpcmVjdCdcIlxyXG4gICAgICAgICAgKGNsaWNrKT1cInNldEFjdGl2ZVRhYignZGlyZWN0JylcIlxyXG4gICAgICAgID5cclxuICAgICAgICAgIENoYXRzXHJcbiAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgdHlwZT1cImJ1dHRvblwiXHJcbiAgICAgICAgICBjbGFzcz1cImluYm94LXRhYlwiXHJcbiAgICAgICAgICBbY2xhc3MuYWN0aXZlXT1cImFjdGl2ZVRhYiA9PT0gJ2dyb3VwcydcIlxyXG4gICAgICAgICAgKGNsaWNrKT1cInNldEFjdGl2ZVRhYignZ3JvdXBzJylcIlxyXG4gICAgICAgID5cclxuICAgICAgICAgIEdyb3Vwc1xyXG4gICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgIDxidXR0b25cclxuICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxyXG4gICAgICAgICAgY2xhc3M9XCJpbmJveC10YWJcIlxyXG4gICAgICAgICAgW2NsYXNzLmFjdGl2ZV09XCJhY3RpdmVUYWIgPT09ICdwcm9qZWN0cydcIlxyXG4gICAgICAgICAgKGNsaWNrKT1cInNldEFjdGl2ZVRhYigncHJvamVjdHMnKVwiXHJcbiAgICAgICAgPlxyXG4gICAgICAgICAgUHJvamVjdHNcclxuICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICA8YnV0dG9uXHJcbiAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcclxuICAgICAgICAgIGNsYXNzPVwiaW5ib3gtdGFiXCJcclxuICAgICAgICAgIFtjbGFzcy5hY3RpdmVdPVwiYWN0aXZlVGFiID09PSAnc2V0dGluZ3MnXCJcclxuICAgICAgICAgIChjbGljayk9XCJzZXRBY3RpdmVUYWIoJ3NldHRpbmdzJylcIlxyXG4gICAgICAgID5cclxuICAgICAgICAgIFNldHRpbmdzXHJcbiAgICAgICAgPC9idXR0b24+XHJcbiAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgPCEtLSBDb250ZXh0IE1lbnUgLS0+XHJcbiAgICAgIDxkaXZcclxuICAgICAgICAqbmdJZj1cImNvbnRleHRNZW51XCJcclxuICAgICAgICBjbGFzcz1cImNvbnRleHQtbWVudVwiXHJcbiAgICAgICAgW3N0eWxlLnRvcC5weF09XCJjb250ZXh0TWVudS55XCJcclxuICAgICAgICBbc3R5bGUubGVmdC5weF09XCJjb250ZXh0TWVudS54XCJcclxuICAgICAgPlxyXG4gICAgICAgIDxkaXYgY2xhc3M9XCJjdHgtaXRlbVwiIChjbGljayk9XCJjbGVhckNoYXQoKVwiPlxyXG4gICAgICAgICAgPG1hdC1pY29uPmNsZWFuaW5nX3NlcnZpY2VzPC9tYXQtaWNvbj5cclxuICAgICAgICAgIDxzcGFuPkNsZWFyIGNvbnZlcnNhdGlvbjwvc3Bhbj5cclxuICAgICAgICA8L2Rpdj5cclxuICAgICAgICA8ZGl2IGNsYXNzPVwiY3R4LWl0ZW0gY3R4LWRhbmdlclwiIChjbGljayk9XCJkZWxldGVDaGF0KClcIj5cclxuICAgICAgICAgIDxtYXQtaWNvbj57eyBjb250ZXh0TWVudS5pdGVtLmlzX2dyb3VwID8gJ2xvZ291dCcgOiAnZGVsZXRlJyB9fTwvbWF0LWljb24+XHJcbiAgICAgICAgICA8c3Bhbj57eyBjb250ZXh0TWVudS5pdGVtLmlzX2dyb3VwID8gJ0V4aXQgZ3JvdXAnIDogJ0RlbGV0ZSBjb252ZXJzYXRpb24nIH19PC9zcGFuPlxyXG4gICAgICAgIDwvZGl2PlxyXG4gICAgICA8L2Rpdj5cclxuICAgICAgPGRpdiAqbmdJZj1cImNvbnRleHRNZW51XCIgY2xhc3M9XCJjdHgtYmFja2Ryb3BcIiAoY2xpY2spPVwiY2xvc2VDb250ZXh0TWVudSgpXCI+PC9kaXY+XHJcbiAgICA8L2Rpdj5cclxuICBgLFxyXG4gIHN0eWxlczogW2BcclxuICAgIC5pbmJveC1jb250YWluZXIge1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xyXG4gICAgICBoZWlnaHQ6IDEwMCU7XHJcbiAgICAgIGJhY2tncm91bmQ6IHRyYW5zcGFyZW50O1xyXG4gICAgICBjb250YWluZXItdHlwZTogaW5saW5lLXNpemU7XHJcbiAgICB9XHJcblxyXG4gICAgLnNlYXJjaC1iYXIge1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBtYXJnaW46IDhweCAxNnB4O1xyXG4gICAgICBwYWRkaW5nOiA4cHggMTJweDtcclxuICAgICAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQ7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDEwcHg7XHJcbiAgICB9XHJcblxyXG4gICAgLnNlYXJjaC1pY29uIHtcclxuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC43KTtcclxuICAgICAgZm9udC1zaXplOiAxOHB4O1xyXG4gICAgICB3aWR0aDogMjBweDtcclxuICAgICAgaGVpZ2h0OiAyMHB4O1xyXG4gICAgICBtYXJnaW4tcmlnaHQ6IDhweDtcclxuICAgIH1cclxuXHJcbiAgICAuc2VhcmNoLWlucHV0IHtcclxuICAgICAgZmxleDogMTtcclxuICAgICAgYm9yZGVyOiBub25lO1xyXG4gICAgICBvdXRsaW5lOiBub25lO1xyXG4gICAgICBiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudDtcclxuICAgICAgZm9udC1zaXplOiAxNHB4O1xyXG4gICAgICBjb2xvcjogI2ZmZjtcclxuICAgIH1cclxuXHJcbiAgICAuc2VhcmNoLWlucHV0OjpwbGFjZWhvbGRlciB7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNik7XHJcbiAgICB9XHJcblxyXG4gICAgLmluYm94LXRhYnMge1xyXG4gICAgICBkaXNwbGF5OiBncmlkO1xyXG4gICAgICBncmlkLXRlbXBsYXRlLWNvbHVtbnM6IHJlcGVhdCg1LCBtaW5tYXgoMCwgMWZyKSk7XHJcbiAgICAgIGdhcDogNXB4O1xyXG4gICAgICBwYWRkaW5nOiAxMHB4IDE2cHggMTJweDtcclxuICAgICAgYm9yZGVyLXRvcDogMXB4IHNvbGlkIHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xKTtcclxuICAgICAgZmxleC1zaHJpbms6IDA7XHJcbiAgICB9XHJcblxyXG4gICAgLmluYm94LXRhYiB7XHJcbiAgICAgIG1pbi13aWR0aDogMDtcclxuICAgICAgYm9yZGVyOiAxcHggc29saWQgcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjE0KTtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjA2KTtcclxuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC43Mik7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDk5OXB4O1xyXG4gICAgICBwYWRkaW5nOiA3cHggNHB4O1xyXG4gICAgICBmb250LXNpemU6IGNsYW1wKDlweCwgMy4xY3F3LCAxMXB4KTtcclxuICAgICAgZm9udC13ZWlnaHQ6IDYwMDtcclxuICAgICAgd2hpdGUtc3BhY2U6IG5vd3JhcDtcclxuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcclxuICAgICAgdGV4dC1vdmVyZmxvdzogZWxsaXBzaXM7XHJcbiAgICAgIGN1cnNvcjogcG9pbnRlcjtcclxuICAgICAgdGV4dC1hbGlnbjogY2VudGVyO1xyXG4gICAgICB0cmFuc2l0aW9uOiBiYWNrZ3JvdW5kIDAuMTVzLCBib3JkZXItY29sb3IgMC4xNXMsIGNvbG9yIDAuMTVzO1xyXG4gICAgfVxyXG5cclxuICAgIC5pbmJveC10YWI6aG92ZXIge1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMTIpO1xyXG4gICAgICBjb2xvcjogI2ZmZjtcclxuICAgIH1cclxuXHJcbiAgICAuaW5ib3gtdGFiLmFjdGl2ZSB7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjYsIDk1LCAxNjgsIDAuMzUpO1xyXG4gICAgICBib3JkZXItY29sb3I6IHJnYmEoMTI3LCAxODAsIDI1NSwgMC40NSk7XHJcbiAgICAgIGNvbG9yOiAjZmZmO1xyXG4gICAgfVxyXG5cclxuICAgIEBjb250YWluZXIgKG1heC13aWR0aDogMzMwcHgpIHtcclxuICAgICAgLmluYm94LXRhYnMge1xyXG4gICAgICAgIGdhcDogM3B4O1xyXG4gICAgICAgIHBhZGRpbmc6IDhweCA4cHggMTBweDtcclxuICAgICAgfVxyXG5cclxuICAgICAgLmluYm94LXRhYiB7XHJcbiAgICAgICAgcGFkZGluZzogNnB4IDJweDtcclxuICAgICAgICBsZXR0ZXItc3BhY2luZzogLTAuMnB4O1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgQGNvbnRhaW5lciAobWF4LXdpZHRoOiAyODBweCkge1xyXG4gICAgICAuaW5ib3gtdGFicyB7XHJcbiAgICAgICAgZ2FwOiAycHg7XHJcbiAgICAgICAgcGFkZGluZy1sZWZ0OiA2cHg7XHJcbiAgICAgICAgcGFkZGluZy1yaWdodDogNnB4O1xyXG4gICAgICB9XHJcblxyXG4gICAgICAuaW5ib3gtdGFiIHtcclxuICAgICAgICBmb250LXNpemU6IDguNXB4O1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLmNvbnZlcnNhdGlvbi1saXN0IHtcclxuICAgICAgZmxleDogMTtcclxuICAgICAgb3ZlcmZsb3cteTogYXV0bztcclxuICAgICAgc2Nyb2xsYmFyLXdpZHRoOiBub25lO1xyXG4gICAgICAtbXMtb3ZlcmZsb3ctc3R5bGU6IG5vbmU7XHJcbiAgICB9XHJcblxyXG4gICAgLmNvbnZlcnNhdGlvbi1saXN0Ojotd2Via2l0LXNjcm9sbGJhciB7XHJcbiAgICAgIGRpc3BsYXk6IG5vbmU7XHJcbiAgICB9XHJcblxyXG4gICAgLmNvbnZlcnNhdGlvbi1pdGVtIHtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAgcGFkZGluZzogMTJweCAxNnB4O1xyXG4gICAgICBjdXJzb3I6IHBvaW50ZXI7XHJcbiAgICAgIHRyYW5zaXRpb246IGJhY2tncm91bmQgMC4xNXM7XHJcbiAgICAgIGdhcDogMTJweDtcclxuICAgIH1cclxuXHJcbiAgICAuY29udmVyc2F0aW9uLWl0ZW06aG92ZXIge1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMSk7XHJcbiAgICB9XHJcblxyXG4gICAgLmNvbnZlcnNhdGlvbi1pdGVtLmhhcy11bnJlYWQge1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMTUpO1xyXG4gICAgfVxyXG5cclxuICAgIC5hdmF0YXIge1xyXG4gICAgICB3aWR0aDogNDhweDtcclxuICAgICAgaGVpZ2h0OiA0OHB4O1xyXG4gICAgICBib3JkZXItcmFkaXVzOiA1MCU7XHJcbiAgICAgIGJhY2tncm91bmQ6ICMwZDI1NDA7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xyXG4gICAgICBmbGV4LXNocmluazogMDtcclxuICAgIH1cclxuXHJcbiAgICAuYXZhdGFyIG1hdC1pY29uIHtcclxuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC43KTtcclxuICAgICAgZm9udC1zaXplOiAyNHB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5ncm91cC1hdmF0YXIge1xyXG4gICAgICBiYWNrZ3JvdW5kOiAjMGExZjM4O1xyXG4gICAgfVxyXG5cclxuICAgIC5ncm91cC1hdmF0YXIgbWF0LWljb24ge1xyXG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjcpO1xyXG4gICAgfVxyXG5cclxuICAgIC5jb252ZXJzYXRpb24taW5mbyB7XHJcbiAgICAgIGZsZXg6IDE7XHJcbiAgICAgIG1pbi13aWR0aDogMDtcclxuICAgIH1cclxuXHJcbiAgICAuaW5mby10b3Age1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWJldHdlZW47XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBiYXNlbGluZTtcclxuICAgICAgbWFyZ2luLWJvdHRvbTogMnB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5jb252LW5hbWUge1xyXG4gICAgICBmb250LXdlaWdodDogNjAwO1xyXG4gICAgICBmb250LXNpemU6IDE0cHg7XHJcbiAgICAgIGNvbG9yOiAjZmZmO1xyXG4gICAgICB3aGl0ZS1zcGFjZTogbm93cmFwO1xyXG4gICAgICBvdmVyZmxvdzogaGlkZGVuO1xyXG4gICAgICB0ZXh0LW92ZXJmbG93OiBlbGxpcHNpcztcclxuICAgICAgbWF4LXdpZHRoOiAyMDBweDtcclxuICAgIH1cclxuXHJcbiAgICAuY29udi10aW1lIHtcclxuICAgICAgZm9udC1zaXplOiAxMXB4O1xyXG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjcpO1xyXG4gICAgICBmbGV4LXNocmluazogMDtcclxuICAgICAgbWFyZ2luLWxlZnQ6IDhweDtcclxuICAgIH1cclxuXHJcbiAgICAuaW5mby1ib3R0b20ge1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWJldHdlZW47XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICB9XHJcblxyXG4gICAgLmNvbnYtcHJldmlldyB7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTNweDtcclxuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC43KTtcclxuICAgICAgd2hpdGUtc3BhY2U6IG5vd3JhcDtcclxuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcclxuICAgICAgdGV4dC1vdmVyZmxvdzogZWxsaXBzaXM7XHJcbiAgICAgIG1heC13aWR0aDogMjIwcHg7XHJcbiAgICB9XHJcblxyXG4gICAgLmhhcy11bnJlYWQgLmNvbnYtbmFtZSB7XHJcbiAgICAgIGNvbG9yOiAjZmZmO1xyXG4gICAgfVxyXG5cclxuICAgIC5oYXMtdW5yZWFkIC5jb252LXByZXZpZXcge1xyXG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjkpO1xyXG4gICAgICBmb250LXdlaWdodDogNTAwO1xyXG4gICAgfVxyXG5cclxuICAgIC51bnJlYWQtYmFkZ2Uge1xyXG4gICAgICBiYWNrZ3JvdW5kOiAjMWE1ZmE4O1xyXG4gICAgICBjb2xvcjogI2ZmZjtcclxuICAgICAgYm9yZGVyLXJhZGl1czogMTBweDtcclxuICAgICAgbWluLXdpZHRoOiAyMHB4O1xyXG4gICAgICBoZWlnaHQ6IDIwcHg7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTFweDtcclxuICAgICAgZm9udC13ZWlnaHQ6IDYwMDtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XHJcbiAgICAgIHBhZGRpbmc6IDAgNnB4O1xyXG4gICAgICBmbGV4LXNocmluazogMDtcclxuICAgIH1cclxuXHJcbiAgICAuZW1wdHktc3RhdGUge1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcclxuICAgICAgcGFkZGluZzogNDhweCAyNHB4O1xyXG4gICAgICBjb2xvcjogIzljYTNhZjtcclxuICAgIH1cclxuXHJcbiAgICAuZW1wdHktc3RhdGUgbWF0LWljb24ge1xyXG4gICAgICBmb250LXNpemU6IDQ4cHg7XHJcbiAgICAgIHdpZHRoOiA0OHB4O1xyXG4gICAgICBoZWlnaHQ6IDQ4cHg7XHJcbiAgICAgIG1hcmdpbi1ib3R0b206IDEycHg7XHJcbiAgICB9XHJcblxyXG4gICAgLmVtcHR5LXN0YXRlIHAge1xyXG4gICAgICBtYXJnaW46IDAgMCAxNnB4O1xyXG4gICAgICBmb250LXNpemU6IDE0cHg7XHJcbiAgICB9XHJcblxyXG4gICAgLnByb2plY3RzLXN0YXRlIHAge1xyXG4gICAgICBtYXJnaW4tYm90dG9tOiAwO1xyXG4gICAgfVxyXG5cclxuICAgIC5zZXR0aW5ncy1wYW5lbCB7XHJcbiAgICAgIHBhZGRpbmc6IDE2cHg7XHJcbiAgICAgIGNvbG9yOiAjZmZmO1xyXG4gICAgfVxyXG5cclxuICAgIC5zZXR0aW5ncy1jYXJkIHtcclxuICAgICAgYm9yZGVyLXJhZGl1czogMTRweDtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjA3KTtcclxuICAgICAgYm9yZGVyOiAxcHggc29saWQgcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjEyKTtcclxuICAgICAgcGFkZGluZzogMTZweDtcclxuICAgICAgYm94LXNoYWRvdzogMCAxMHB4IDI4cHggcmdiYSgwLCAwLCAwLCAwLjE4KTtcclxuICAgIH1cclxuXHJcbiAgICAuc2V0dGluZ3MtaGVhZGVyIHtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgZ2FwOiAxMnB4O1xyXG4gICAgICBhbGlnbi1pdGVtczogZmxleC1zdGFydDtcclxuICAgICAgbWFyZ2luLWJvdHRvbTogMTZweDtcclxuICAgIH1cclxuXHJcbiAgICAuc2V0dGluZ3MtaWNvbiB7XHJcbiAgICAgIHdpZHRoOiAzNnB4O1xyXG4gICAgICBoZWlnaHQ6IDM2cHg7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDEwcHg7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjYsIDk1LCAxNjgsIDAuMzUpO1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcclxuICAgICAgZmxleC1zaHJpbms6IDA7XHJcbiAgICB9XHJcblxyXG4gICAgLnNldHRpbmdzLWljb24gbWF0LWljb24ge1xyXG4gICAgICBjb2xvcjogI2JmZGJmZTtcclxuICAgIH1cclxuXHJcbiAgICAuc2V0dGluZ3MtaGVhZGVyIGg0IHtcclxuICAgICAgbWFyZ2luOiAwIDAgNHB4O1xyXG4gICAgICBmb250LXNpemU6IDE1cHg7XHJcbiAgICAgIGZvbnQtd2VpZ2h0OiA3MDA7XHJcbiAgICB9XHJcblxyXG4gICAgLnNldHRpbmdzLWhlYWRlciBwIHtcclxuICAgICAgbWFyZ2luOiAwO1xyXG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjY1KTtcclxuICAgICAgZm9udC1zaXplOiAxMnB4O1xyXG4gICAgICBsaW5lLWhlaWdodDogMS40O1xyXG4gICAgfVxyXG5cclxuICAgIC5zZXR0aW5ncy10b2dnbGUge1xyXG4gICAgICB3aWR0aDogMTAwJTtcclxuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDEwcHg7XHJcbiAgICAgIGNvbG9yOiAjZmZmICFpbXBvcnRhbnQ7XHJcbiAgICAgIGJvcmRlci1jb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjIpICFpbXBvcnRhbnQ7XHJcbiAgICAgIG1hcmdpbi1ib3R0b206IDE2cHg7XHJcbiAgICB9XHJcblxyXG4gICAgLnNldHRpbmdzLXRvZ2dsZSBtYXQtaWNvbiB7XHJcbiAgICAgIG1hcmdpbi1yaWdodDogOHB4O1xyXG4gICAgICBmb250LXNpemU6IDE4cHg7XHJcbiAgICAgIHdpZHRoOiAxOHB4O1xyXG4gICAgICBoZWlnaHQ6IDE4cHg7XHJcbiAgICB9XHJcblxyXG4gICAgLnZvbHVtZS1sYWJlbCB7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGp1c3RpZnktY29udGVudDogc3BhY2UtYmV0d2VlbjtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC43OCk7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTJweDtcclxuICAgICAgZm9udC13ZWlnaHQ6IDYwMDtcclxuICAgICAgbWFyZ2luLWJvdHRvbTogOHB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5zZXR0aW5ncy12b2x1bWUge1xyXG4gICAgICB3aWR0aDogMTAwJTtcclxuICAgICAgYWNjZW50LWNvbG9yOiAjN2ZiNGZmO1xyXG4gICAgICBjdXJzb3I6IHBvaW50ZXI7XHJcbiAgICB9XHJcblxyXG4gICAgLmNvbnRleHQtbWVudSB7XHJcbiAgICAgIHBvc2l0aW9uOiBmaXhlZDtcclxuICAgICAgei1pbmRleDogMTAwMDE7XHJcbiAgICAgIGJhY2tncm91bmQ6ICMwNzFkMzA7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDhweDtcclxuICAgICAgcGFkZGluZzogNHB4IDA7XHJcbiAgICAgIGJveC1zaGFkb3c6IDAgOHB4IDI0cHggcmdiYSgwLCAwLCAwLCAwLjMpO1xyXG4gICAgICBtaW4td2lkdGg6IDIwMHB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5jdHgtaXRlbSB7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgIGdhcDogMTBweDtcclxuICAgICAgcGFkZGluZzogMTBweCAxNnB4O1xyXG4gICAgICBjdXJzb3I6IHBvaW50ZXI7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuOSk7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTNweDtcclxuICAgICAgdHJhbnNpdGlvbjogYmFja2dyb3VuZCAwLjE1cztcclxuICAgIH1cclxuXHJcbiAgICAuY3R4LWl0ZW06aG92ZXIge1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMSk7XHJcbiAgICB9XHJcblxyXG4gICAgLmN0eC1pdGVtIG1hdC1pY29uIHtcclxuICAgICAgZm9udC1zaXplOiAxOHB4O1xyXG4gICAgICB3aWR0aDogMThweDtcclxuICAgICAgaGVpZ2h0OiAxOHB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5jdHgtZGFuZ2VyIHtcclxuICAgICAgY29sb3I6ICNmODcxNzE7XHJcbiAgICB9XHJcblxyXG4gICAgLmN0eC1kYW5nZXI6aG92ZXIge1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI0OCwgMTEzLCAxMTMsIDAuMTUpO1xyXG4gICAgfVxyXG5cclxuICAgIC5jdHgtYmFja2Ryb3Age1xyXG4gICAgICBwb3NpdGlvbjogZml4ZWQ7XHJcbiAgICAgIGluc2V0OiAwO1xyXG4gICAgICB6LWluZGV4OiAxMDAwMDtcclxuICAgIH1cclxuICBgXSxcclxufSlcclxuZXhwb3J0IGNsYXNzIEluYm94TGlzdENvbXBvbmVudCBpbXBsZW1lbnRzIE9uSW5pdCwgT25EZXN0cm95IHtcclxuICBpbmJveDogSW5ib3hJdGVtW10gPSBbXTtcclxuICBzZWFyY2hRdWVyeSA9ICcnO1xyXG4gIGFjdGl2ZVRhYjogJ2FsbCcgfCAnZGlyZWN0JyB8ICdncm91cHMnIHwgJ3Byb2plY3RzJyB8ICdzZXR0aW5ncycgPSAnYWxsJztcclxuICBub3RpZmljYXRpb25Wb2x1bWUgPSAwLjM1O1xyXG4gIG5vdGlmaWNhdGlvbnNNdXRlZCA9IGZhbHNlO1xyXG4gIGNvbnRleHRNZW51OiB7IHg6IG51bWJlcjsgeTogbnVtYmVyOyBpdGVtOiBJbmJveEl0ZW0gfSB8IG51bGwgPSBudWxsO1xyXG4gIHByaXZhdGUgcmVhZG9ubHkgdGFiU3RvcmFnZUtleSA9ICdtZXNzYWdpbmdfaW5ib3hfYWN0aXZlX3RhYic7XHJcbiAgcHJpdmF0ZSBzdWIhOiBTdWJzY3JpcHRpb247XHJcblxyXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgc3RvcmU6IE1lc3NhZ2luZ1N0b3JlU2VydmljZSkge31cclxuXHJcbiAgbmdPbkluaXQoKTogdm9pZCB7XHJcbiAgICB0aGlzLmFjdGl2ZVRhYiA9IHRoaXMuZ2V0U2F2ZWRUYWIoKTtcclxuICAgIHRoaXMuc3ViID0gbmV3IFN1YnNjcmlwdGlvbigpO1xyXG4gICAgdGhpcy5zdWIuYWRkKHRoaXMuc3RvcmUuaW5ib3guc3Vic2NyaWJlKChpdGVtcykgPT4gKHRoaXMuaW5ib3ggPSBpdGVtcykpKTtcclxuICAgIHRoaXMuc3ViLmFkZCh0aGlzLnN0b3JlLm5vdGlmaWNhdGlvblZvbHVtZS5zdWJzY3JpYmUoKHZvbHVtZSkgPT4gKHRoaXMubm90aWZpY2F0aW9uVm9sdW1lID0gdm9sdW1lKSkpO1xyXG4gICAgdGhpcy5zdWIuYWRkKHRoaXMuc3RvcmUubm90aWZpY2F0aW9uc011dGVkLnN1YnNjcmliZSgobXV0ZWQpID0+ICh0aGlzLm5vdGlmaWNhdGlvbnNNdXRlZCA9IG11dGVkKSkpO1xyXG4gIH1cclxuXHJcbiAgbmdPbkRlc3Ryb3koKTogdm9pZCB7XHJcbiAgICB0aGlzLnN1Yj8udW5zdWJzY3JpYmUoKTtcclxuICB9XHJcblxyXG4gIGdldCBmaWx0ZXJlZEluYm94KCk6IEluYm94SXRlbVtdIHtcclxuICAgIGlmICh0aGlzLmFjdGl2ZVRhYiA9PT0gJ3Byb2plY3RzJyB8fCB0aGlzLmFjdGl2ZVRhYiA9PT0gJ3NldHRpbmdzJykgcmV0dXJuIFtdO1xyXG4gICAgY29uc3QgdGFiYmVkID0gdGhpcy5pbmJveC5maWx0ZXIoKGl0ZW0pID0+IHtcclxuICAgICAgaWYgKHRoaXMuYWN0aXZlVGFiID09PSAnZGlyZWN0JykgcmV0dXJuICFpdGVtLmlzX2dyb3VwO1xyXG4gICAgICBpZiAodGhpcy5hY3RpdmVUYWIgPT09ICdncm91cHMnKSByZXR1cm4gaXRlbS5pc19ncm91cDtcclxuICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICB9KTtcclxuICAgIGlmICghdGhpcy5zZWFyY2hRdWVyeS50cmltKCkpIHJldHVybiB0YWJiZWQ7XHJcbiAgICBjb25zdCBxID0gdGhpcy5zZWFyY2hRdWVyeS50b0xvd2VyQ2FzZSgpO1xyXG4gICAgcmV0dXJuIHRhYmJlZC5maWx0ZXIoXHJcbiAgICAgIChpdGVtKSA9PlxyXG4gICAgICAgIChpdGVtLm5hbWUgfHwgJycpLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMocSkgfHxcclxuICAgICAgICAoaXRlbS5sYXN0X21lc3NhZ2VfcHJldmlldyB8fCAnJykudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhxKVxyXG4gICAgKTtcclxuICB9XHJcblxyXG4gIGdldCBlbXB0eVN0YXRlVGV4dCgpOiBzdHJpbmcge1xyXG4gICAgaWYgKHRoaXMuc2VhcmNoUXVlcnkudHJpbSgpKSByZXR1cm4gJ05vIG1hdGNoaW5nIGNvbnZlcnNhdGlvbnMnO1xyXG4gICAgaWYgKHRoaXMuYWN0aXZlVGFiID09PSAnZGlyZWN0JykgcmV0dXJuICdObyBjaGF0cyB5ZXQnO1xyXG4gICAgaWYgKHRoaXMuYWN0aXZlVGFiID09PSAnZ3JvdXBzJykgcmV0dXJuICdObyBncm91cHMgeWV0JztcclxuICAgIHJldHVybiAnTm8gY29udmVyc2F0aW9ucyB5ZXQnO1xyXG4gIH1cclxuXHJcbiAgc2V0QWN0aXZlVGFiKHRhYjogJ2FsbCcgfCAnZGlyZWN0JyB8ICdncm91cHMnIHwgJ3Byb2plY3RzJyB8ICdzZXR0aW5ncycpOiB2b2lkIHtcclxuICAgIHRoaXMuYWN0aXZlVGFiID0gdGFiO1xyXG4gICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0odGhpcy50YWJTdG9yYWdlS2V5LCB0YWIpO1xyXG4gICAgdGhpcy5jb250ZXh0TWVudSA9IG51bGw7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGdldFNhdmVkVGFiKCk6ICdhbGwnIHwgJ2RpcmVjdCcgfCAnZ3JvdXBzJyB8ICdwcm9qZWN0cycgfCAnc2V0dGluZ3MnIHtcclxuICAgIGNvbnN0IHNhdmVkID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0odGhpcy50YWJTdG9yYWdlS2V5KTtcclxuICAgIHJldHVybiBzYXZlZCA9PT0gJ2RpcmVjdCcgfHwgc2F2ZWQgPT09ICdncm91cHMnIHx8IHNhdmVkID09PSAncHJvamVjdHMnIHx8IHNhdmVkID09PSAnc2V0dGluZ3MnIHx8IHNhdmVkID09PSAnYWxsJ1xyXG4gICAgICA/IHNhdmVkXHJcbiAgICAgIDogJ2FsbCc7XHJcbiAgfVxyXG5cclxuICB0b2dnbGVOb3RpZmljYXRpb25zTXV0ZWQoKTogdm9pZCB7XHJcbiAgICBjb25zdCBuZXh0TXV0ZWQgPSAhdGhpcy5ub3RpZmljYXRpb25zTXV0ZWQ7XHJcbiAgICB0aGlzLnN0b3JlLnNldE5vdGlmaWNhdGlvbnNNdXRlZChuZXh0TXV0ZWQpO1xyXG4gICAgaWYgKCFuZXh0TXV0ZWQgJiYgdGhpcy5ub3RpZmljYXRpb25Wb2x1bWUgPiAwKSB7XHJcbiAgICAgIHRoaXMuc3RvcmUudGVzdE5vdGlmaWNhdGlvblNvdW5kKCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBvbk5vdGlmaWNhdGlvblZvbHVtZUNoYW5nZSh2YWx1ZTogbnVtYmVyIHwgc3RyaW5nKTogdm9pZCB7XHJcbiAgICB0aGlzLnN0b3JlLnNldE5vdGlmaWNhdGlvblZvbHVtZShOdW1iZXIodmFsdWUpKTtcclxuICB9XHJcblxyXG4gIHByZXZpZXdOb3RpZmljYXRpb25Tb3VuZCgpOiB2b2lkIHtcclxuICAgIGlmICghdGhpcy5ub3RpZmljYXRpb25zTXV0ZWQgJiYgdGhpcy5ub3RpZmljYXRpb25Wb2x1bWUgPiAwKSB7XHJcbiAgICAgIHRoaXMuc3RvcmUudGVzdE5vdGlmaWNhdGlvblNvdW5kKCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBvcGVuQ29udmVyc2F0aW9uKGl0ZW06IEluYm94SXRlbSk6IHZvaWQge1xyXG4gICAgdGhpcy5zdG9yZS5vcGVuQ29udmVyc2F0aW9uKGl0ZW0uY29udmVyc2F0aW9uX2lkLCBpdGVtLm5hbWUgfHwgJ0NoYXQnLCBpdGVtLmlzX2dyb3VwKTtcclxuICB9XHJcblxyXG4gIG9uTmV3Q29udmVyc2F0aW9uKCk6IHZvaWQge1xyXG4gICAgdGhpcy5zdG9yZS5zZXRWaWV3KCduZXctY29udmVyc2F0aW9uJyk7XHJcbiAgfVxyXG5cclxuICBvbkNyZWF0ZUdyb3VwKCk6IHZvaWQge1xyXG4gICAgdGhpcy5zdG9yZS5zZXRWaWV3KCdncm91cC1tYW5hZ2VyJyk7XHJcbiAgfVxyXG5cclxuICBvbkNvbnRleHRNZW51KGV2ZW50OiBNb3VzZUV2ZW50LCBpdGVtOiBJbmJveEl0ZW0pOiB2b2lkIHtcclxuICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcclxuICAgIHRoaXMuY29udGV4dE1lbnUgPSB7IHg6IGV2ZW50LmNsaWVudFgsIHk6IGV2ZW50LmNsaWVudFksIGl0ZW0gfTtcclxuICB9XHJcblxyXG4gIGNsb3NlQ29udGV4dE1lbnUoKTogdm9pZCB7XHJcbiAgICB0aGlzLmNvbnRleHRNZW51ID0gbnVsbDtcclxuICB9XHJcblxyXG4gIGNsZWFyQ2hhdCgpOiB2b2lkIHtcclxuICAgIGlmICghdGhpcy5jb250ZXh0TWVudSkgcmV0dXJuO1xyXG4gICAgY29uc3QgaWQgPSB0aGlzLmNvbnRleHRNZW51Lml0ZW0uY29udmVyc2F0aW9uX2lkO1xyXG4gICAgdGhpcy5zdG9yZS5jbGVhckNvbnZlcnNhdGlvbihpZCk7XHJcbiAgICB0aGlzLmNvbnRleHRNZW51ID0gbnVsbDtcclxuICB9XHJcblxyXG4gIGRlbGV0ZUNoYXQoKTogdm9pZCB7XHJcbiAgICBpZiAoIXRoaXMuY29udGV4dE1lbnUpIHJldHVybjtcclxuICAgIGNvbnN0IGl0ZW0gPSB0aGlzLmNvbnRleHRNZW51Lml0ZW07XHJcbiAgICBpZiAoaXRlbS5pc19ncm91cCkge1xyXG4gICAgICB0aGlzLnN0b3JlLmRlbGV0ZUdyb3VwKGl0ZW0uY29udmVyc2F0aW9uX2lkKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHRoaXMuc3RvcmUuZGVsZXRlQ29udmVyc2F0aW9uKGl0ZW0uY29udmVyc2F0aW9uX2lkKTtcclxuICAgIH1cclxuICAgIHRoaXMuY29udGV4dE1lbnUgPSBudWxsO1xyXG4gIH1cclxuXHJcbiAgZm9ybWF0VGltZShkYXRlU3RyOiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gICAgaWYgKCFkYXRlU3RyKSByZXR1cm4gJyc7XHJcbiAgICBjb25zdCBkYXRlID0gbmV3IERhdGUoZGF0ZVN0cik7XHJcbiAgICBjb25zdCBub3cgPSBuZXcgRGF0ZSgpO1xyXG4gICAgY29uc3QgZGlmZk1zID0gbm93LmdldFRpbWUoKSAtIGRhdGUuZ2V0VGltZSgpO1xyXG4gICAgY29uc3QgZGlmZk1pbnMgPSBNYXRoLmZsb29yKGRpZmZNcyAvIDYwMDAwKTtcclxuICAgIGNvbnN0IGRpZmZIb3VycyA9IE1hdGguZmxvb3IoZGlmZk1zIC8gMzYwMDAwMCk7XHJcbiAgICBjb25zdCBkaWZmRGF5cyA9IE1hdGguZmxvb3IoZGlmZk1zIC8gODY0MDAwMDApO1xyXG5cclxuICAgIGlmIChkaWZmTWlucyA8IDEpIHJldHVybiAnbm93JztcclxuICAgIGlmIChkaWZmTWlucyA8IDYwKSByZXR1cm4gYCR7ZGlmZk1pbnN9bWA7XHJcbiAgICBpZiAoZGlmZkhvdXJzIDwgMjQpIHJldHVybiBgJHtkaWZmSG91cnN9aGA7XHJcbiAgICBpZiAoZGlmZkRheXMgPCA3KSByZXR1cm4gYCR7ZGlmZkRheXN9ZGA7XHJcblxyXG4gICAgcmV0dXJuIGRhdGUudG9Mb2NhbGVEYXRlU3RyaW5nKCdlbi1HQicsIHsgZGF5OiAnbnVtZXJpYycsIG1vbnRoOiAnc2hvcnQnIH0pO1xyXG4gIH1cclxufVxyXG4iXX0=