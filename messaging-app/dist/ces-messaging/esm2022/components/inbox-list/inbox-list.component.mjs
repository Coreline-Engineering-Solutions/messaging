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
import * as i7 from "@angular/material/tooltip";
export class InboxListComponent {
    store;
    inbox = [];
    searchQuery = '';
    activeTab = 'all';
    notificationVolume = 0.35;
    notificationsMuted = false;
    messageTextScale = 1;
    codeTextScale = 1;
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
        this.sub.add(this.store.messageTextScale.subscribe((scale) => (this.messageTextScale = scale)));
        this.sub.add(this.store.codeTextScale.subscribe((scale) => (this.codeTextScale = scale)));
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
    onMessageTextScaleChange(value) {
        this.store.setMessageTextScale(Number(value));
    }
    onCodeTextScaleChange(value) {
        this.store.setCodeTextScale(Number(value));
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
              <span
                *ngIf="item.has_mention"
                class="mention-badge"
                matTooltip="You were mentioned"
                matTooltipPosition="above"
              >&#64;</span>
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

          <div class="settings-card">
            <div class="settings-header">
              <div class="settings-icon display-icon">
                <mat-icon>text_fields</mat-icon>
              </div>
              <div>
                <h4>Display Size</h4>
                <p>Adjust message text and programming block sizes.</p>
              </div>
            </div>

            <label class="volume-label" for="messaging-message-size-slider">
              Message size
              <span>{{ (messageTextScale * 100) | number:'1.0-0' }}%</span>
            </label>
            <input
              id="messaging-message-size-slider"
              type="range"
              min="0.8"
              max="1.5"
              step="0.05"
              class="settings-volume"
              [(ngModel)]="messageTextScale"
              (ngModelChange)="onMessageTextScaleChange($event)"
            />
            <div class="settings-preview message-preview" [style.font-size.px]="13 * messageTextScale">
              This is how normal message text will appear in chat.
            </div>

            <label class="volume-label" for="messaging-code-size-slider">
              Programming size
              <span>{{ (codeTextScale * 100) | number:'1.0-0' }}%</span>
            </label>
            <input
              id="messaging-code-size-slider"
              type="range"
              min="0.8"
              max="1.5"
              step="0.05"
              class="settings-volume"
              [(ngModel)]="codeTextScale"
              (ngModelChange)="onCodeTextScaleChange($event)"
            />
            <pre class="settings-preview code-preview" [style.font-size.px]="12 * codeTextScale"><code>SELECT ticket_ref, status
FROM logging.ticket
WHERE status = 'Open';</code></pre>
          </div>
        </div>
      </div>

      <div class="inbox-tabs" role="tablist" aria-label="Conversation filters">
        <button
          type="button"
          class="inbox-tab"
          [class.active]="activeTab === 'all'"
          (click)="setActiveTab('all')"
          matTooltip="All"
          matTooltipPosition="above"
        >
          <mat-icon>forum</mat-icon>
        </button>
        <button
          type="button"
          class="inbox-tab"
          [class.active]="activeTab === 'direct'"
          (click)="setActiveTab('direct')"
          matTooltip="Chats"
          matTooltipPosition="above"
        >
          <mat-icon>chat</mat-icon>
        </button>
        <button
          type="button"
          class="inbox-tab"
          [class.active]="activeTab === 'groups'"
          (click)="setActiveTab('groups')"
          matTooltip="Groups"
          matTooltipPosition="above"
        >
          <mat-icon>groups</mat-icon>
        </button>
        <button
          type="button"
          class="inbox-tab"
          [class.active]="activeTab === 'projects'"
          (click)="setActiveTab('projects')"
          matTooltip="Projects"
          matTooltipPosition="above"
        >
          <mat-icon>workspaces</mat-icon>
        </button>
        <button
          type="button"
          class="inbox-tab"
          [class.active]="activeTab === 'settings'"
          (click)="setActiveTab('settings')"
          matTooltip="Settings"
          matTooltipPosition="above"
        >
          <mat-icon>settings</mat-icon>
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
  `, isInline: true, styles: [".inbox-container{display:flex;flex-direction:column;height:100%;background:transparent;container-type:inline-size}.search-bar{display:flex;align-items:center;margin:8px 16px;padding:8px 12px;background:transparent;border-radius:10px}.search-icon{color:#ffffffb3;font-size:18px;width:20px;height:20px;margin-right:8px}.search-input{flex:1;border:none;outline:none;background:transparent;font-size:14px;color:#fff}.search-input::placeholder{color:#fff9}.inbox-tabs{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:5px;padding:10px 16px 12px;border-top:1px solid rgba(255,255,255,.1);flex-shrink:0}.inbox-tab{min-width:0;border:1px solid rgba(255,255,255,.14);background:#ffffff0f;color:#ffffffb8;border-radius:999px;padding:6px 4px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:background .15s,border-color .15s,color .15s}.inbox-tab mat-icon{font-size:clamp(17px,6cqw,21px);width:clamp(17px,6cqw,21px);height:clamp(17px,6cqw,21px);line-height:clamp(17px,6cqw,21px)}.inbox-tab:hover{background:#ffffff1f;color:#fff}.inbox-tab.active{background:#1a5fa859;border-color:#7fb4ff73;color:#fff}@container (max-width: 330px){.inbox-tabs{gap:3px;padding:8px 8px 10px}.inbox-tab{padding:6px 2px;letter-spacing:-.2px}}@container (max-width: 280px){.inbox-tabs{gap:2px;padding-left:6px;padding-right:6px}.inbox-tab{font-size:8.5px}}.conversation-list{flex:1;overflow-y:auto;scrollbar-width:none;-ms-overflow-style:none}.conversation-list::-webkit-scrollbar{display:none}.conversation-item{display:flex;align-items:center;padding:12px 16px;cursor:pointer;transition:background .15s;gap:12px}.conversation-item:hover{background:#ffffff1a}.conversation-item.has-unread{background:#ffffff26}.avatar{width:48px;height:48px;border-radius:50%;background:#0d2540;display:flex;align-items:center;justify-content:center;flex-shrink:0}.avatar mat-icon{color:#ffffffb3;font-size:24px}.group-avatar{background:#0a1f38}.group-avatar mat-icon{color:#ffffffb3}.conversation-info{flex:1;min-width:0}.info-top{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:2px}.conv-name{font-weight:600;font-size:14px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px}.conv-time{font-size:11px;color:#ffffffb3;flex-shrink:0;margin-left:8px}.info-bottom{display:flex;justify-content:space-between;align-items:center;gap:6px}.conv-preview{font-size:13px;color:#ffffffb3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px}.has-unread .conv-name{color:#fff}.has-unread .conv-preview{color:#ffffffe6;font-weight:500}.unread-badge{background:#1a5fa8;color:#fff;border-radius:10px;min-width:20px;height:20px;font-size:11px;font-weight:600;display:flex;align-items:center;justify-content:center;padding:0 6px;flex-shrink:0}.mention-badge{width:20px;height:20px;border-radius:999px;background:#7fb4ff33;border:1px solid rgba(127,180,255,.55);color:#bfdbfe;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex-shrink:0;margin-left:6px;box-shadow:0 0 0 2px #7fb4ff0f}.empty-state{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 24px;color:#9ca3af}.empty-state mat-icon{font-size:48px;width:48px;height:48px;margin-bottom:12px}.empty-state p{margin:0 0 16px;font-size:14px}.projects-state p{margin-bottom:0}.settings-panel{padding:16px;color:#fff;display:flex;flex-direction:column;gap:12px}.settings-card{border-radius:14px;background:#ffffff12;border:1px solid rgba(255,255,255,.12);padding:16px;box-shadow:0 10px 28px #0000002e}.settings-header{display:flex;gap:12px;align-items:flex-start;margin-bottom:16px}.settings-icon{width:36px;height:36px;border-radius:10px;background:#1a5fa859;display:flex;align-items:center;justify-content:center;flex-shrink:0}.settings-icon mat-icon{color:#bfdbfe}.settings-icon.display-icon{background:#86efac24}.settings-icon.display-icon mat-icon{color:#bbf7d0}.settings-header h4{margin:0 0 4px;font-size:15px;font-weight:700}.settings-header p{margin:0;color:#ffffffa6;font-size:12px;line-height:1.4}.settings-toggle{width:100%;justify-content:center;border-radius:10px;color:#fff!important;border-color:#fff3!important;margin-bottom:16px}.settings-toggle mat-icon{margin-right:8px;font-size:18px;width:18px;height:18px}.volume-label{display:flex;justify-content:space-between;align-items:center;color:#ffffffc7;font-size:12px;font-weight:600;margin-bottom:8px}.settings-volume{width:100%;accent-color:#7fb4ff;cursor:pointer;margin-bottom:12px}.settings-preview{margin:0 0 16px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:#ffffff0f;color:#f5f7ff;box-sizing:border-box}.message-preview{padding:9px 11px;line-height:1.35}.code-preview{padding:10px 11px;overflow:hidden;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,Liberation Mono,monospace;line-height:1.45;white-space:pre-wrap;color:#dbeafe;background:#061827;margin-bottom:0}.context-menu{position:fixed;z-index:10001;background:#071d30;border-radius:8px;padding:4px 0;box-shadow:0 8px 24px #0000004d;min-width:200px}.ctx-item{display:flex;align-items:center;gap:10px;padding:10px 16px;cursor:pointer;color:#ffffffe6;font-size:13px;transition:background .15s}.ctx-item:hover{background:#ffffff1a}.ctx-item mat-icon{font-size:18px;width:18px;height:18px}.ctx-danger{color:#f87171}.ctx-danger:hover{background:#f8717126}.ctx-backdrop{position:fixed;inset:0;z-index:10000}\n"], dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i2.NgForOf, selector: "[ngFor][ngForOf]", inputs: ["ngForOf", "ngForTrackBy", "ngForTemplate"] }, { kind: "directive", type: i2.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "pipe", type: i2.DecimalPipe, name: "number" }, { kind: "ngmodule", type: FormsModule }, { kind: "directive", type: i3.DefaultValueAccessor, selector: "input:not([type=checkbox])[formControlName],textarea[formControlName],input:not([type=checkbox])[formControl],textarea[formControl],input:not([type=checkbox])[ngModel],textarea[ngModel],[ngDefaultControl]" }, { kind: "directive", type: i3.RangeValueAccessor, selector: "input[type=range][formControlName],input[type=range][formControl],input[type=range][ngModel]" }, { kind: "directive", type: i3.NgControlStatus, selector: "[formControlName],[ngModel],[formControl]" }, { kind: "directive", type: i3.NgModel, selector: "[ngModel]:not([formControlName]):not([formControl])", inputs: ["name", "disabled", "ngModel", "ngModelOptions"], outputs: ["ngModelChange"], exportAs: ["ngModel"] }, { kind: "ngmodule", type: MatIconModule }, { kind: "component", type: i4.MatIcon, selector: "mat-icon", inputs: ["color", "inline", "svgIcon", "fontSet", "fontIcon"], exportAs: ["matIcon"] }, { kind: "ngmodule", type: MatButtonModule }, { kind: "component", type: i5.MatButton, selector: "    button[mat-button], button[mat-raised-button], button[mat-flat-button],    button[mat-stroked-button]  ", exportAs: ["matButton"] }, { kind: "ngmodule", type: MatRippleModule }, { kind: "directive", type: i6.MatRipple, selector: "[mat-ripple], [matRipple]", inputs: ["matRippleColor", "matRippleUnbounded", "matRippleCentered", "matRippleRadius", "matRippleAnimation", "matRippleDisabled", "matRippleTrigger"], exportAs: ["matRipple"] }, { kind: "ngmodule", type: MatTooltipModule }, { kind: "directive", type: i7.MatTooltip, selector: "[matTooltip]", inputs: ["matTooltipPosition", "matTooltipPositionAtOrigin", "matTooltipDisabled", "matTooltipShowDelay", "matTooltipHideDelay", "matTooltipTouchGestures", "matTooltip", "matTooltipClass"], exportAs: ["matTooltip"] }] });
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
              <span
                *ngIf="item.has_mention"
                class="mention-badge"
                matTooltip="You were mentioned"
                matTooltipPosition="above"
              >&#64;</span>
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

          <div class="settings-card">
            <div class="settings-header">
              <div class="settings-icon display-icon">
                <mat-icon>text_fields</mat-icon>
              </div>
              <div>
                <h4>Display Size</h4>
                <p>Adjust message text and programming block sizes.</p>
              </div>
            </div>

            <label class="volume-label" for="messaging-message-size-slider">
              Message size
              <span>{{ (messageTextScale * 100) | number:'1.0-0' }}%</span>
            </label>
            <input
              id="messaging-message-size-slider"
              type="range"
              min="0.8"
              max="1.5"
              step="0.05"
              class="settings-volume"
              [(ngModel)]="messageTextScale"
              (ngModelChange)="onMessageTextScaleChange($event)"
            />
            <div class="settings-preview message-preview" [style.font-size.px]="13 * messageTextScale">
              This is how normal message text will appear in chat.
            </div>

            <label class="volume-label" for="messaging-code-size-slider">
              Programming size
              <span>{{ (codeTextScale * 100) | number:'1.0-0' }}%</span>
            </label>
            <input
              id="messaging-code-size-slider"
              type="range"
              min="0.8"
              max="1.5"
              step="0.05"
              class="settings-volume"
              [(ngModel)]="codeTextScale"
              (ngModelChange)="onCodeTextScaleChange($event)"
            />
            <pre class="settings-preview code-preview" [style.font-size.px]="12 * codeTextScale"><code>SELECT ticket_ref, status
FROM logging.ticket
WHERE status = 'Open';</code></pre>
          </div>
        </div>
      </div>

      <div class="inbox-tabs" role="tablist" aria-label="Conversation filters">
        <button
          type="button"
          class="inbox-tab"
          [class.active]="activeTab === 'all'"
          (click)="setActiveTab('all')"
          matTooltip="All"
          matTooltipPosition="above"
        >
          <mat-icon>forum</mat-icon>
        </button>
        <button
          type="button"
          class="inbox-tab"
          [class.active]="activeTab === 'direct'"
          (click)="setActiveTab('direct')"
          matTooltip="Chats"
          matTooltipPosition="above"
        >
          <mat-icon>chat</mat-icon>
        </button>
        <button
          type="button"
          class="inbox-tab"
          [class.active]="activeTab === 'groups'"
          (click)="setActiveTab('groups')"
          matTooltip="Groups"
          matTooltipPosition="above"
        >
          <mat-icon>groups</mat-icon>
        </button>
        <button
          type="button"
          class="inbox-tab"
          [class.active]="activeTab === 'projects'"
          (click)="setActiveTab('projects')"
          matTooltip="Projects"
          matTooltipPosition="above"
        >
          <mat-icon>workspaces</mat-icon>
        </button>
        <button
          type="button"
          class="inbox-tab"
          [class.active]="activeTab === 'settings'"
          (click)="setActiveTab('settings')"
          matTooltip="Settings"
          matTooltipPosition="above"
        >
          <mat-icon>settings</mat-icon>
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
  `, styles: [".inbox-container{display:flex;flex-direction:column;height:100%;background:transparent;container-type:inline-size}.search-bar{display:flex;align-items:center;margin:8px 16px;padding:8px 12px;background:transparent;border-radius:10px}.search-icon{color:#ffffffb3;font-size:18px;width:20px;height:20px;margin-right:8px}.search-input{flex:1;border:none;outline:none;background:transparent;font-size:14px;color:#fff}.search-input::placeholder{color:#fff9}.inbox-tabs{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:5px;padding:10px 16px 12px;border-top:1px solid rgba(255,255,255,.1);flex-shrink:0}.inbox-tab{min-width:0;border:1px solid rgba(255,255,255,.14);background:#ffffff0f;color:#ffffffb8;border-radius:999px;padding:6px 4px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:background .15s,border-color .15s,color .15s}.inbox-tab mat-icon{font-size:clamp(17px,6cqw,21px);width:clamp(17px,6cqw,21px);height:clamp(17px,6cqw,21px);line-height:clamp(17px,6cqw,21px)}.inbox-tab:hover{background:#ffffff1f;color:#fff}.inbox-tab.active{background:#1a5fa859;border-color:#7fb4ff73;color:#fff}@container (max-width: 330px){.inbox-tabs{gap:3px;padding:8px 8px 10px}.inbox-tab{padding:6px 2px;letter-spacing:-.2px}}@container (max-width: 280px){.inbox-tabs{gap:2px;padding-left:6px;padding-right:6px}.inbox-tab{font-size:8.5px}}.conversation-list{flex:1;overflow-y:auto;scrollbar-width:none;-ms-overflow-style:none}.conversation-list::-webkit-scrollbar{display:none}.conversation-item{display:flex;align-items:center;padding:12px 16px;cursor:pointer;transition:background .15s;gap:12px}.conversation-item:hover{background:#ffffff1a}.conversation-item.has-unread{background:#ffffff26}.avatar{width:48px;height:48px;border-radius:50%;background:#0d2540;display:flex;align-items:center;justify-content:center;flex-shrink:0}.avatar mat-icon{color:#ffffffb3;font-size:24px}.group-avatar{background:#0a1f38}.group-avatar mat-icon{color:#ffffffb3}.conversation-info{flex:1;min-width:0}.info-top{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:2px}.conv-name{font-weight:600;font-size:14px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px}.conv-time{font-size:11px;color:#ffffffb3;flex-shrink:0;margin-left:8px}.info-bottom{display:flex;justify-content:space-between;align-items:center;gap:6px}.conv-preview{font-size:13px;color:#ffffffb3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px}.has-unread .conv-name{color:#fff}.has-unread .conv-preview{color:#ffffffe6;font-weight:500}.unread-badge{background:#1a5fa8;color:#fff;border-radius:10px;min-width:20px;height:20px;font-size:11px;font-weight:600;display:flex;align-items:center;justify-content:center;padding:0 6px;flex-shrink:0}.mention-badge{width:20px;height:20px;border-radius:999px;background:#7fb4ff33;border:1px solid rgba(127,180,255,.55);color:#bfdbfe;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex-shrink:0;margin-left:6px;box-shadow:0 0 0 2px #7fb4ff0f}.empty-state{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 24px;color:#9ca3af}.empty-state mat-icon{font-size:48px;width:48px;height:48px;margin-bottom:12px}.empty-state p{margin:0 0 16px;font-size:14px}.projects-state p{margin-bottom:0}.settings-panel{padding:16px;color:#fff;display:flex;flex-direction:column;gap:12px}.settings-card{border-radius:14px;background:#ffffff12;border:1px solid rgba(255,255,255,.12);padding:16px;box-shadow:0 10px 28px #0000002e}.settings-header{display:flex;gap:12px;align-items:flex-start;margin-bottom:16px}.settings-icon{width:36px;height:36px;border-radius:10px;background:#1a5fa859;display:flex;align-items:center;justify-content:center;flex-shrink:0}.settings-icon mat-icon{color:#bfdbfe}.settings-icon.display-icon{background:#86efac24}.settings-icon.display-icon mat-icon{color:#bbf7d0}.settings-header h4{margin:0 0 4px;font-size:15px;font-weight:700}.settings-header p{margin:0;color:#ffffffa6;font-size:12px;line-height:1.4}.settings-toggle{width:100%;justify-content:center;border-radius:10px;color:#fff!important;border-color:#fff3!important;margin-bottom:16px}.settings-toggle mat-icon{margin-right:8px;font-size:18px;width:18px;height:18px}.volume-label{display:flex;justify-content:space-between;align-items:center;color:#ffffffc7;font-size:12px;font-weight:600;margin-bottom:8px}.settings-volume{width:100%;accent-color:#7fb4ff;cursor:pointer;margin-bottom:12px}.settings-preview{margin:0 0 16px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:#ffffff0f;color:#f5f7ff;box-sizing:border-box}.message-preview{padding:9px 11px;line-height:1.35}.code-preview{padding:10px 11px;overflow:hidden;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,Liberation Mono,monospace;line-height:1.45;white-space:pre-wrap;color:#dbeafe;background:#061827;margin-bottom:0}.context-menu{position:fixed;z-index:10001;background:#071d30;border-radius:8px;padding:4px 0;box-shadow:0 8px 24px #0000004d;min-width:200px}.ctx-item{display:flex;align-items:center;gap:10px;padding:10px 16px;cursor:pointer;color:#ffffffe6;font-size:13px;transition:background .15s}.ctx-item:hover{background:#ffffff1a}.ctx-item mat-icon{font-size:18px;width:18px;height:18px}.ctx-danger{color:#f87171}.ctx-danger:hover{background:#f8717126}.ctx-backdrop{position:fixed;inset:0;z-index:10000}\n"] }]
        }], ctorParameters: () => [{ type: i1.MessagingStoreService }] });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5ib3gtbGlzdC5jb21wb25lbnQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvbGliL2NvbXBvbmVudHMvaW5ib3gtbGlzdC9pbmJveC1saXN0LmNvbXBvbmVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsU0FBUyxFQUFxQixNQUFNLGVBQWUsQ0FBQztBQUM3RCxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDL0MsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLGdCQUFnQixDQUFDO0FBQzdDLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSx3QkFBd0IsQ0FBQztBQUN2RCxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFDM0QsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHdCQUF3QixDQUFDO0FBQ3pELE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBQzdELE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxNQUFNLENBQUM7Ozs7Ozs7OztBQW9wQnBDLE1BQU0sT0FBTyxrQkFBa0I7SUFZVDtJQVhwQixLQUFLLEdBQWdCLEVBQUUsQ0FBQztJQUN4QixXQUFXLEdBQUcsRUFBRSxDQUFDO0lBQ2pCLFNBQVMsR0FBMEQsS0FBSyxDQUFDO0lBQ3pFLGtCQUFrQixHQUFHLElBQUksQ0FBQztJQUMxQixrQkFBa0IsR0FBRyxLQUFLLENBQUM7SUFDM0IsZ0JBQWdCLEdBQUcsQ0FBQyxDQUFDO0lBQ3JCLGFBQWEsR0FBRyxDQUFDLENBQUM7SUFDbEIsV0FBVyxHQUFxRCxJQUFJLENBQUM7SUFDcEQsYUFBYSxHQUFHLDRCQUE0QixDQUFDO0lBQ3RELEdBQUcsQ0FBZ0I7SUFFM0IsWUFBb0IsS0FBNEI7UUFBNUIsVUFBSyxHQUFMLEtBQUssQ0FBdUI7SUFBRyxDQUFDO0lBRXBELFFBQVE7UUFDTixJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztRQUNwQyxJQUFJLENBQUMsR0FBRyxHQUFHLElBQUksWUFBWSxFQUFFLENBQUM7UUFDOUIsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzFFLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsa0JBQWtCLENBQUMsU0FBUyxDQUFDLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxrQkFBa0IsR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDdEcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxTQUFTLENBQUMsQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLGtCQUFrQixHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNwRyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLGdCQUFnQixDQUFDLFNBQVMsQ0FBQyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ2hHLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLFNBQVMsQ0FBQyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsYUFBYSxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUM1RixDQUFDO0lBRUQsV0FBVztRQUNULElBQUksQ0FBQyxHQUFHLEVBQUUsV0FBVyxFQUFFLENBQUM7SUFDMUIsQ0FBQztJQUVELElBQUksYUFBYTtRQUNmLElBQUksSUFBSSxDQUFDLFNBQVMsS0FBSyxVQUFVLElBQUksSUFBSSxDQUFDLFNBQVMsS0FBSyxVQUFVO1lBQUUsT0FBTyxFQUFFLENBQUM7UUFDOUUsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLEVBQUUsRUFBRTtZQUN4QyxJQUFJLElBQUksQ0FBQyxTQUFTLEtBQUssUUFBUTtnQkFBRSxPQUFPLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQztZQUN2RCxJQUFJLElBQUksQ0FBQyxTQUFTLEtBQUssUUFBUTtnQkFBRSxPQUFPLElBQUksQ0FBQyxRQUFRLENBQUM7WUFDdEQsT0FBTyxJQUFJLENBQUM7UUFDZCxDQUFDLENBQUMsQ0FBQztRQUNILElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksRUFBRTtZQUFFLE9BQU8sTUFBTSxDQUFDO1FBQzVDLE1BQU0sQ0FBQyxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsV0FBVyxFQUFFLENBQUM7UUFDekMsT0FBTyxNQUFNLENBQUMsTUFBTSxDQUNsQixDQUFDLElBQUksRUFBRSxFQUFFLENBQ1AsQ0FBQyxJQUFJLENBQUMsSUFBSSxJQUFJLEVBQUUsQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7WUFDM0MsQ0FBQyxJQUFJLENBQUMsb0JBQW9CLElBQUksRUFBRSxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUM5RCxDQUFDO0lBQ0osQ0FBQztJQUVELElBQUksY0FBYztRQUNoQixJQUFJLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxFQUFFO1lBQUUsT0FBTywyQkFBMkIsQ0FBQztRQUNoRSxJQUFJLElBQUksQ0FBQyxTQUFTLEtBQUssUUFBUTtZQUFFLE9BQU8sY0FBYyxDQUFDO1FBQ3ZELElBQUksSUFBSSxDQUFDLFNBQVMsS0FBSyxRQUFRO1lBQUUsT0FBTyxlQUFlLENBQUM7UUFDeEQsT0FBTyxzQkFBc0IsQ0FBQztJQUNoQyxDQUFDO0lBRUQsWUFBWSxDQUFDLEdBQTBEO1FBQ3JFLElBQUksQ0FBQyxTQUFTLEdBQUcsR0FBRyxDQUFDO1FBQ3JCLFlBQVksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRSxHQUFHLENBQUMsQ0FBQztRQUM5QyxJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQztJQUMxQixDQUFDO0lBRU8sV0FBVztRQUNqQixNQUFNLEtBQUssR0FBRyxZQUFZLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQztRQUN2RCxPQUFPLEtBQUssS0FBSyxRQUFRLElBQUksS0FBSyxLQUFLLFFBQVEsSUFBSSxLQUFLLEtBQUssVUFBVSxJQUFJLEtBQUssS0FBSyxVQUFVLElBQUksS0FBSyxLQUFLLEtBQUs7WUFDaEgsQ0FBQyxDQUFDLEtBQUs7WUFDUCxDQUFDLENBQUMsS0FBSyxDQUFDO0lBQ1osQ0FBQztJQUVELHdCQUF3QjtRQUN0QixNQUFNLFNBQVMsR0FBRyxDQUFDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQztRQUMzQyxJQUFJLENBQUMsS0FBSyxDQUFDLHFCQUFxQixDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQzVDLElBQUksQ0FBQyxTQUFTLElBQUksSUFBSSxDQUFDLGtCQUFrQixHQUFHLENBQUMsRUFBRSxDQUFDO1lBQzlDLElBQUksQ0FBQyxLQUFLLENBQUMscUJBQXFCLEVBQUUsQ0FBQztRQUNyQyxDQUFDO0lBQ0gsQ0FBQztJQUVELDBCQUEwQixDQUFDLEtBQXNCO1FBQy9DLElBQUksQ0FBQyxLQUFLLENBQUMscUJBQXFCLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7SUFDbEQsQ0FBQztJQUVELHdCQUF3QjtRQUN0QixJQUFJLENBQUMsSUFBSSxDQUFDLGtCQUFrQixJQUFJLElBQUksQ0FBQyxrQkFBa0IsR0FBRyxDQUFDLEVBQUUsQ0FBQztZQUM1RCxJQUFJLENBQUMsS0FBSyxDQUFDLHFCQUFxQixFQUFFLENBQUM7UUFDckMsQ0FBQztJQUNILENBQUM7SUFFRCx3QkFBd0IsQ0FBQyxLQUFzQjtRQUM3QyxJQUFJLENBQUMsS0FBSyxDQUFDLG1CQUFtQixDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0lBQ2hELENBQUM7SUFFRCxxQkFBcUIsQ0FBQyxLQUFzQjtRQUMxQyxJQUFJLENBQUMsS0FBSyxDQUFDLGdCQUFnQixDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0lBQzdDLENBQUM7SUFFRCxnQkFBZ0IsQ0FBQyxJQUFlO1FBQzlCLElBQUksQ0FBQyxLQUFLLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLGVBQWUsRUFBRSxJQUFJLENBQUMsSUFBSSxJQUFJLE1BQU0sRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDeEYsQ0FBQztJQUVELGlCQUFpQjtRQUNmLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLGtCQUFrQixDQUFDLENBQUM7SUFDekMsQ0FBQztJQUVELGFBQWE7UUFDWCxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxlQUFlLENBQUMsQ0FBQztJQUN0QyxDQUFDO0lBRUQsYUFBYSxDQUFDLEtBQWlCLEVBQUUsSUFBZTtRQUM5QyxLQUFLLENBQUMsY0FBYyxFQUFFLENBQUM7UUFDdkIsS0FBSyxDQUFDLGVBQWUsRUFBRSxDQUFDO1FBQ3hCLElBQUksQ0FBQyxXQUFXLEdBQUcsRUFBRSxDQUFDLEVBQUUsS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDLEVBQUUsS0FBSyxDQUFDLE9BQU8sRUFBRSxJQUFJLEVBQUUsQ0FBQztJQUNsRSxDQUFDO0lBRUQsZ0JBQWdCO1FBQ2QsSUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUM7SUFDMUIsQ0FBQztJQUVELFNBQVM7UUFDUCxJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVc7WUFBRSxPQUFPO1FBQzlCLE1BQU0sRUFBRSxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQztRQUNqRCxJQUFJLENBQUMsS0FBSyxDQUFDLGlCQUFpQixDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQ2pDLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDO0lBQzFCLENBQUM7SUFFRCxVQUFVO1FBQ1IsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXO1lBQUUsT0FBTztRQUM5QixNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQztRQUNuQyxJQUFJLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUNsQixJQUFJLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLENBQUM7UUFDL0MsQ0FBQzthQUFNLENBQUM7WUFDTixJQUFJLENBQUMsS0FBSyxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQztRQUN0RCxDQUFDO1FBQ0QsSUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUM7SUFDMUIsQ0FBQztJQUVELFVBQVUsQ0FBQyxPQUFlO1FBQ3hCLElBQUksQ0FBQyxPQUFPO1lBQUUsT0FBTyxFQUFFLENBQUM7UUFDeEIsTUFBTSxJQUFJLEdBQUcsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDL0IsTUFBTSxHQUFHLEdBQUcsSUFBSSxJQUFJLEVBQUUsQ0FBQztRQUN2QixNQUFNLE1BQU0sR0FBRyxHQUFHLENBQUMsT0FBTyxFQUFFLEdBQUcsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQzlDLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLEtBQUssQ0FBQyxDQUFDO1FBQzVDLE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLE9BQU8sQ0FBQyxDQUFDO1FBQy9DLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLFFBQVEsQ0FBQyxDQUFDO1FBRS9DLElBQUksUUFBUSxHQUFHLENBQUM7WUFBRSxPQUFPLEtBQUssQ0FBQztRQUMvQixJQUFJLFFBQVEsR0FBRyxFQUFFO1lBQUUsT0FBTyxHQUFHLFFBQVEsR0FBRyxDQUFDO1FBQ3pDLElBQUksU0FBUyxHQUFHLEVBQUU7WUFBRSxPQUFPLEdBQUcsU0FBUyxHQUFHLENBQUM7UUFDM0MsSUFBSSxRQUFRLEdBQUcsQ0FBQztZQUFFLE9BQU8sR0FBRyxRQUFRLEdBQUcsQ0FBQztRQUV4QyxPQUFPLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxPQUFPLEVBQUUsRUFBRSxHQUFHLEVBQUUsU0FBUyxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsQ0FBQyxDQUFDO0lBQzlFLENBQUM7d0dBakpVLGtCQUFrQjs0RkFBbEIsa0JBQWtCLDBFQTVvQm5COzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBNE5ULDQ3S0E3TlMsWUFBWSx1VEFBRSxXQUFXLDR3QkFBRSxhQUFhLG1MQUFFLGVBQWUsMk5BQUUsZUFBZSxrU0FBRSxnQkFBZ0I7OzRGQTZvQjNGLGtCQUFrQjtrQkFocEI5QixTQUFTOytCQUNFLGdCQUFnQixjQUNkLElBQUksV0FDUCxDQUFDLFlBQVksRUFBRSxXQUFXLEVBQUUsYUFBYSxFQUFFLGVBQWUsRUFBRSxlQUFlLEVBQUUsZ0JBQWdCLENBQUMsWUFDN0Y7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7R0E0TlQiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBDb21wb25lbnQsIE9uSW5pdCwgT25EZXN0cm95IH0gZnJvbSAnQGFuZ3VsYXIvY29yZSc7XHJcbmltcG9ydCB7IENvbW1vbk1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL2NvbW1vbic7XHJcbmltcG9ydCB7IEZvcm1zTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvZm9ybXMnO1xyXG5pbXBvcnQgeyBNYXRJY29uTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvbWF0ZXJpYWwvaWNvbic7XHJcbmltcG9ydCB7IE1hdEJ1dHRvbk1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL21hdGVyaWFsL2J1dHRvbic7XHJcbmltcG9ydCB7IE1hdFJpcHBsZU1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL21hdGVyaWFsL2NvcmUnO1xyXG5pbXBvcnQgeyBNYXRUb29sdGlwTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvbWF0ZXJpYWwvdG9vbHRpcCc7XHJcbmltcG9ydCB7IFN1YnNjcmlwdGlvbiB9IGZyb20gJ3J4anMnO1xyXG5pbXBvcnQgeyBNZXNzYWdpbmdTdG9yZVNlcnZpY2UgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9tZXNzYWdpbmctc3RvcmUuc2VydmljZSc7XHJcbmltcG9ydCB7IEluYm94SXRlbSB9IGZyb20gJy4uLy4uL21vZGVscy9tZXNzYWdpbmcubW9kZWxzJztcclxuXHJcbkBDb21wb25lbnQoe1xyXG4gIHNlbGVjdG9yOiAnYXBwLWluYm94LWxpc3QnLFxyXG4gIHN0YW5kYWxvbmU6IHRydWUsXHJcbiAgaW1wb3J0czogW0NvbW1vbk1vZHVsZSwgRm9ybXNNb2R1bGUsIE1hdEljb25Nb2R1bGUsIE1hdEJ1dHRvbk1vZHVsZSwgTWF0UmlwcGxlTW9kdWxlLCBNYXRUb29sdGlwTW9kdWxlXSxcclxuICB0ZW1wbGF0ZTogYFxyXG4gICAgPGRpdiBjbGFzcz1cImluYm94LWNvbnRhaW5lclwiPlxyXG4gICAgICA8ZGl2ICpuZ0lmPVwiYWN0aXZlVGFiICE9PSAncHJvamVjdHMnICYmIGFjdGl2ZVRhYiAhPT0gJ3NldHRpbmdzJ1wiIGNsYXNzPVwic2VhcmNoLWJhclwiPlxyXG4gICAgICAgIDxtYXQtaWNvbiBjbGFzcz1cInNlYXJjaC1pY29uXCI+c2VhcmNoPC9tYXQtaWNvbj5cclxuICAgICAgICA8aW5wdXRcclxuICAgICAgICAgIHR5cGU9XCJ0ZXh0XCJcclxuICAgICAgICAgIFsobmdNb2RlbCldPVwic2VhcmNoUXVlcnlcIlxyXG4gICAgICAgICAgcGxhY2Vob2xkZXI9XCJTZWFyY2ggY29udmVyc2F0aW9ucy4uLlwiXHJcbiAgICAgICAgICBjbGFzcz1cInNlYXJjaC1pbnB1dFwiXHJcbiAgICAgICAgLz5cclxuICAgICAgPC9kaXY+XHJcblxyXG4gICAgICA8ZGl2IGNsYXNzPVwiY29udmVyc2F0aW9uLWxpc3RcIj5cclxuICAgICAgICA8ZGl2XHJcbiAgICAgICAgICAqbmdGb3I9XCJsZXQgaXRlbSBvZiBmaWx0ZXJlZEluYm94XCJcclxuICAgICAgICAgIGNsYXNzPVwiY29udmVyc2F0aW9uLWl0ZW1cIlxyXG4gICAgICAgICAgbWF0UmlwcGxlXHJcbiAgICAgICAgICBbY2xhc3MuaGFzLXVucmVhZF09XCJpdGVtLnVucmVhZF9jb3VudCA+IDBcIlxyXG4gICAgICAgICAgKGNsaWNrKT1cIm9wZW5Db252ZXJzYXRpb24oaXRlbSlcIlxyXG4gICAgICAgICAgKGNvbnRleHRtZW51KT1cIm9uQ29udGV4dE1lbnUoJGV2ZW50LCBpdGVtKVwiXHJcbiAgICAgICAgPlxyXG4gICAgICAgICAgPGRpdiBjbGFzcz1cImF2YXRhclwiIFtjbGFzcy5ncm91cC1hdmF0YXJdPVwiaXRlbS5pc19ncm91cFwiPlxyXG4gICAgICAgICAgICA8bWF0LWljb24+e3sgaXRlbS5pc19ncm91cCA/ICdncm91cCcgOiAncGVyc29uJyB9fTwvbWF0LWljb24+XHJcbiAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJjb252ZXJzYXRpb24taW5mb1wiPlxyXG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwiaW5mby10b3BcIj5cclxuICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cImNvbnYtbmFtZVwiPnt7IGl0ZW0ubmFtZSB8fCAnRGlyZWN0IE1lc3NhZ2UnIH19PC9zcGFuPlxyXG4gICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwiY29udi10aW1lXCI+e3sgZm9ybWF0VGltZShpdGVtLmxhc3RfbWVzc2FnZV9hdCkgfX08L3NwYW4+XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwiaW5mby1ib3R0b21cIj5cclxuICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cImNvbnYtcHJldmlld1wiPnt7IGl0ZW0ubGFzdF9tZXNzYWdlX3ByZXZpZXcgfHwgJ05vIG1lc3NhZ2VzIHlldCcgfX08L3NwYW4+XHJcbiAgICAgICAgICAgICAgPHNwYW5cclxuICAgICAgICAgICAgICAgICpuZ0lmPVwiaXRlbS5oYXNfbWVudGlvblwiXHJcbiAgICAgICAgICAgICAgICBjbGFzcz1cIm1lbnRpb24tYmFkZ2VcIlxyXG4gICAgICAgICAgICAgICAgbWF0VG9vbHRpcD1cIllvdSB3ZXJlIG1lbnRpb25lZFwiXHJcbiAgICAgICAgICAgICAgICBtYXRUb29sdGlwUG9zaXRpb249XCJhYm92ZVwiXHJcbiAgICAgICAgICAgICAgPiYjNjQ7PC9zcGFuPlxyXG4gICAgICAgICAgICAgIDxzcGFuICpuZ0lmPVwiaXRlbS51bnJlYWRfY291bnQgPiAwXCIgY2xhc3M9XCJ1bnJlYWQtYmFkZ2VcIj5cclxuICAgICAgICAgICAgICAgIHt7IGl0ZW0udW5yZWFkX2NvdW50ID4gOTkgPyAnOTkrJyA6IGl0ZW0udW5yZWFkX2NvdW50IH19XHJcbiAgICAgICAgICAgICAgPC9zcGFuPlxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICA8ZGl2ICpuZ0lmPVwiZmlsdGVyZWRJbmJveC5sZW5ndGggPT09IDAgJiYgYWN0aXZlVGFiICE9PSAncHJvamVjdHMnICYmIGFjdGl2ZVRhYiAhPT0gJ3NldHRpbmdzJ1wiIGNsYXNzPVwiZW1wdHktc3RhdGVcIj5cclxuICAgICAgICAgIDxtYXQtaWNvbj57eyBhY3RpdmVUYWIgPT09ICdncm91cHMnID8gJ2dyb3VwJyA6ICdmb3J1bScgfX08L21hdC1pY29uPlxyXG4gICAgICAgICAgPHA+e3sgZW1wdHlTdGF0ZVRleHQgfX08L3A+XHJcbiAgICAgICAgICA8YnV0dG9uICpuZ0lmPVwiIXNlYXJjaFF1ZXJ5ICYmIGFjdGl2ZVRhYiAhPT0gJ2dyb3VwcydcIiBtYXQtc3Ryb2tlZC1idXR0b24gY29sb3I9XCJwcmltYXJ5XCIgKGNsaWNrKT1cIm9uTmV3Q29udmVyc2F0aW9uKClcIj5cclxuICAgICAgICAgICAgU3RhcnQgYSBjb252ZXJzYXRpb25cclxuICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgPGJ1dHRvbiAqbmdJZj1cIiFzZWFyY2hRdWVyeSAmJiBhY3RpdmVUYWIgPT09ICdncm91cHMnXCIgbWF0LXN0cm9rZWQtYnV0dG9uIGNvbG9yPVwicHJpbWFyeVwiIChjbGljayk9XCJvbkNyZWF0ZUdyb3VwKClcIj5cclxuICAgICAgICAgICAgQ3JlYXRlIGEgZ3JvdXBcclxuICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICA8ZGl2ICpuZ0lmPVwiYWN0aXZlVGFiID09PSAncHJvamVjdHMnXCIgY2xhc3M9XCJlbXB0eS1zdGF0ZSBwcm9qZWN0cy1zdGF0ZVwiPlxyXG4gICAgICAgICAgPG1hdC1pY29uPndvcmtzcGFjZXM8L21hdC1pY29uPlxyXG4gICAgICAgICAgPHA+Q29taW5nIHNvb248L3A+XHJcbiAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgIDxkaXYgKm5nSWY9XCJhY3RpdmVUYWIgPT09ICdzZXR0aW5ncydcIiBjbGFzcz1cInNldHRpbmdzLXBhbmVsXCI+XHJcbiAgICAgICAgICA8ZGl2IGNsYXNzPVwic2V0dGluZ3MtY2FyZFwiPlxyXG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwic2V0dGluZ3MtaGVhZGVyXCI+XHJcbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInNldHRpbmdzLWljb25cIj5cclxuICAgICAgICAgICAgICAgIDxtYXQtaWNvbj57eyBub3RpZmljYXRpb25zTXV0ZWQgfHwgbm90aWZpY2F0aW9uVm9sdW1lIDw9IDAgPyAndm9sdW1lX29mZicgOiAndm9sdW1lX3VwJyB9fTwvbWF0LWljb24+XHJcbiAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgPGRpdj5cclxuICAgICAgICAgICAgICAgIDxoND5Ob3RpZmljYXRpb24gU291bmQ8L2g0PlxyXG4gICAgICAgICAgICAgICAgPHA+Q29udHJvbCBtZXNzYWdlIGFsZXJ0cyBmb3IgdGhpcyBicm93c2VyLjwvcD5cclxuICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgICA8YnV0dG9uXHJcbiAgICAgICAgICAgICAgdHlwZT1cImJ1dHRvblwiXHJcbiAgICAgICAgICAgICAgbWF0LXN0cm9rZWQtYnV0dG9uXHJcbiAgICAgICAgICAgICAgY2xhc3M9XCJzZXR0aW5ncy10b2dnbGVcIlxyXG4gICAgICAgICAgICAgIChjbGljayk9XCJ0b2dnbGVOb3RpZmljYXRpb25zTXV0ZWQoKVwiXHJcbiAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICA8bWF0LWljb24+e3sgbm90aWZpY2F0aW9uc011dGVkID8gJ3ZvbHVtZV91cCcgOiAndm9sdW1lX29mZicgfX08L21hdC1pY29uPlxyXG4gICAgICAgICAgICAgIHt7IG5vdGlmaWNhdGlvbnNNdXRlZCA/ICdVbm11dGUgbm90aWZpY2F0aW9ucycgOiAnTXV0ZSBub3RpZmljYXRpb25zJyB9fVxyXG4gICAgICAgICAgICA8L2J1dHRvbj5cclxuXHJcbiAgICAgICAgICAgIDxsYWJlbCBjbGFzcz1cInZvbHVtZS1sYWJlbFwiIGZvcj1cIm1lc3NhZ2luZy12b2x1bWUtc2xpZGVyXCI+XHJcbiAgICAgICAgICAgICAgVm9sdW1lXHJcbiAgICAgICAgICAgICAgPHNwYW4+e3sgKG5vdGlmaWNhdGlvblZvbHVtZSAqIDEwMCkgfCBudW1iZXI6JzEuMC0wJyB9fSU8L3NwYW4+XHJcbiAgICAgICAgICAgIDwvbGFiZWw+XHJcbiAgICAgICAgICAgIDxpbnB1dFxyXG4gICAgICAgICAgICAgIGlkPVwibWVzc2FnaW5nLXZvbHVtZS1zbGlkZXJcIlxyXG4gICAgICAgICAgICAgIHR5cGU9XCJyYW5nZVwiXHJcbiAgICAgICAgICAgICAgbWluPVwiMFwiXHJcbiAgICAgICAgICAgICAgbWF4PVwiMVwiXHJcbiAgICAgICAgICAgICAgc3RlcD1cIjAuMDVcIlxyXG4gICAgICAgICAgICAgIGNsYXNzPVwic2V0dGluZ3Mtdm9sdW1lXCJcclxuICAgICAgICAgICAgICBbKG5nTW9kZWwpXT1cIm5vdGlmaWNhdGlvblZvbHVtZVwiXHJcbiAgICAgICAgICAgICAgKG5nTW9kZWxDaGFuZ2UpPVwib25Ob3RpZmljYXRpb25Wb2x1bWVDaGFuZ2UoJGV2ZW50KVwiXHJcbiAgICAgICAgICAgICAgKGNoYW5nZSk9XCJwcmV2aWV3Tm90aWZpY2F0aW9uU291bmQoKVwiXHJcbiAgICAgICAgICAgIC8+XHJcbiAgICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgICA8ZGl2IGNsYXNzPVwic2V0dGluZ3MtY2FyZFwiPlxyXG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwic2V0dGluZ3MtaGVhZGVyXCI+XHJcbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInNldHRpbmdzLWljb24gZGlzcGxheS1pY29uXCI+XHJcbiAgICAgICAgICAgICAgICA8bWF0LWljb24+dGV4dF9maWVsZHM8L21hdC1pY29uPlxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgIDxkaXY+XHJcbiAgICAgICAgICAgICAgICA8aDQ+RGlzcGxheSBTaXplPC9oND5cclxuICAgICAgICAgICAgICAgIDxwPkFkanVzdCBtZXNzYWdlIHRleHQgYW5kIHByb2dyYW1taW5nIGJsb2NrIHNpemVzLjwvcD5cclxuICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgICA8bGFiZWwgY2xhc3M9XCJ2b2x1bWUtbGFiZWxcIiBmb3I9XCJtZXNzYWdpbmctbWVzc2FnZS1zaXplLXNsaWRlclwiPlxyXG4gICAgICAgICAgICAgIE1lc3NhZ2Ugc2l6ZVxyXG4gICAgICAgICAgICAgIDxzcGFuPnt7IChtZXNzYWdlVGV4dFNjYWxlICogMTAwKSB8IG51bWJlcjonMS4wLTAnIH19JTwvc3Bhbj5cclxuICAgICAgICAgICAgPC9sYWJlbD5cclxuICAgICAgICAgICAgPGlucHV0XHJcbiAgICAgICAgICAgICAgaWQ9XCJtZXNzYWdpbmctbWVzc2FnZS1zaXplLXNsaWRlclwiXHJcbiAgICAgICAgICAgICAgdHlwZT1cInJhbmdlXCJcclxuICAgICAgICAgICAgICBtaW49XCIwLjhcIlxyXG4gICAgICAgICAgICAgIG1heD1cIjEuNVwiXHJcbiAgICAgICAgICAgICAgc3RlcD1cIjAuMDVcIlxyXG4gICAgICAgICAgICAgIGNsYXNzPVwic2V0dGluZ3Mtdm9sdW1lXCJcclxuICAgICAgICAgICAgICBbKG5nTW9kZWwpXT1cIm1lc3NhZ2VUZXh0U2NhbGVcIlxyXG4gICAgICAgICAgICAgIChuZ01vZGVsQ2hhbmdlKT1cIm9uTWVzc2FnZVRleHRTY2FsZUNoYW5nZSgkZXZlbnQpXCJcclxuICAgICAgICAgICAgLz5cclxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cInNldHRpbmdzLXByZXZpZXcgbWVzc2FnZS1wcmV2aWV3XCIgW3N0eWxlLmZvbnQtc2l6ZS5weF09XCIxMyAqIG1lc3NhZ2VUZXh0U2NhbGVcIj5cclxuICAgICAgICAgICAgICBUaGlzIGlzIGhvdyBub3JtYWwgbWVzc2FnZSB0ZXh0IHdpbGwgYXBwZWFyIGluIGNoYXQuXHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgICAgPGxhYmVsIGNsYXNzPVwidm9sdW1lLWxhYmVsXCIgZm9yPVwibWVzc2FnaW5nLWNvZGUtc2l6ZS1zbGlkZXJcIj5cclxuICAgICAgICAgICAgICBQcm9ncmFtbWluZyBzaXplXHJcbiAgICAgICAgICAgICAgPHNwYW4+e3sgKGNvZGVUZXh0U2NhbGUgKiAxMDApIHwgbnVtYmVyOicxLjAtMCcgfX0lPC9zcGFuPlxyXG4gICAgICAgICAgICA8L2xhYmVsPlxyXG4gICAgICAgICAgICA8aW5wdXRcclxuICAgICAgICAgICAgICBpZD1cIm1lc3NhZ2luZy1jb2RlLXNpemUtc2xpZGVyXCJcclxuICAgICAgICAgICAgICB0eXBlPVwicmFuZ2VcIlxyXG4gICAgICAgICAgICAgIG1pbj1cIjAuOFwiXHJcbiAgICAgICAgICAgICAgbWF4PVwiMS41XCJcclxuICAgICAgICAgICAgICBzdGVwPVwiMC4wNVwiXHJcbiAgICAgICAgICAgICAgY2xhc3M9XCJzZXR0aW5ncy12b2x1bWVcIlxyXG4gICAgICAgICAgICAgIFsobmdNb2RlbCldPVwiY29kZVRleHRTY2FsZVwiXHJcbiAgICAgICAgICAgICAgKG5nTW9kZWxDaGFuZ2UpPVwib25Db2RlVGV4dFNjYWxlQ2hhbmdlKCRldmVudClcIlxyXG4gICAgICAgICAgICAvPlxyXG4gICAgICAgICAgICA8cHJlIGNsYXNzPVwic2V0dGluZ3MtcHJldmlldyBjb2RlLXByZXZpZXdcIiBbc3R5bGUuZm9udC1zaXplLnB4XT1cIjEyICogY29kZVRleHRTY2FsZVwiPjxjb2RlPlNFTEVDVCB0aWNrZXRfcmVmLCBzdGF0dXNcclxuRlJPTSBsb2dnaW5nLnRpY2tldFxyXG5XSEVSRSBzdGF0dXMgPSAnT3Blbic7PC9jb2RlPjwvcHJlPlxyXG4gICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgPC9kaXY+XHJcbiAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgPGRpdiBjbGFzcz1cImluYm94LXRhYnNcIiByb2xlPVwidGFibGlzdFwiIGFyaWEtbGFiZWw9XCJDb252ZXJzYXRpb24gZmlsdGVyc1wiPlxyXG4gICAgICAgIDxidXR0b25cclxuICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxyXG4gICAgICAgICAgY2xhc3M9XCJpbmJveC10YWJcIlxyXG4gICAgICAgICAgW2NsYXNzLmFjdGl2ZV09XCJhY3RpdmVUYWIgPT09ICdhbGwnXCJcclxuICAgICAgICAgIChjbGljayk9XCJzZXRBY3RpdmVUYWIoJ2FsbCcpXCJcclxuICAgICAgICAgIG1hdFRvb2x0aXA9XCJBbGxcIlxyXG4gICAgICAgICAgbWF0VG9vbHRpcFBvc2l0aW9uPVwiYWJvdmVcIlxyXG4gICAgICAgID5cclxuICAgICAgICAgIDxtYXQtaWNvbj5mb3J1bTwvbWF0LWljb24+XHJcbiAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgdHlwZT1cImJ1dHRvblwiXHJcbiAgICAgICAgICBjbGFzcz1cImluYm94LXRhYlwiXHJcbiAgICAgICAgICBbY2xhc3MuYWN0aXZlXT1cImFjdGl2ZVRhYiA9PT0gJ2RpcmVjdCdcIlxyXG4gICAgICAgICAgKGNsaWNrKT1cInNldEFjdGl2ZVRhYignZGlyZWN0JylcIlxyXG4gICAgICAgICAgbWF0VG9vbHRpcD1cIkNoYXRzXCJcclxuICAgICAgICAgIG1hdFRvb2x0aXBQb3NpdGlvbj1cImFib3ZlXCJcclxuICAgICAgICA+XHJcbiAgICAgICAgICA8bWF0LWljb24+Y2hhdDwvbWF0LWljb24+XHJcbiAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgdHlwZT1cImJ1dHRvblwiXHJcbiAgICAgICAgICBjbGFzcz1cImluYm94LXRhYlwiXHJcbiAgICAgICAgICBbY2xhc3MuYWN0aXZlXT1cImFjdGl2ZVRhYiA9PT0gJ2dyb3VwcydcIlxyXG4gICAgICAgICAgKGNsaWNrKT1cInNldEFjdGl2ZVRhYignZ3JvdXBzJylcIlxyXG4gICAgICAgICAgbWF0VG9vbHRpcD1cIkdyb3Vwc1wiXHJcbiAgICAgICAgICBtYXRUb29sdGlwUG9zaXRpb249XCJhYm92ZVwiXHJcbiAgICAgICAgPlxyXG4gICAgICAgICAgPG1hdC1pY29uPmdyb3VwczwvbWF0LWljb24+XHJcbiAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgdHlwZT1cImJ1dHRvblwiXHJcbiAgICAgICAgICBjbGFzcz1cImluYm94LXRhYlwiXHJcbiAgICAgICAgICBbY2xhc3MuYWN0aXZlXT1cImFjdGl2ZVRhYiA9PT0gJ3Byb2plY3RzJ1wiXHJcbiAgICAgICAgICAoY2xpY2spPVwic2V0QWN0aXZlVGFiKCdwcm9qZWN0cycpXCJcclxuICAgICAgICAgIG1hdFRvb2x0aXA9XCJQcm9qZWN0c1wiXHJcbiAgICAgICAgICBtYXRUb29sdGlwUG9zaXRpb249XCJhYm92ZVwiXHJcbiAgICAgICAgPlxyXG4gICAgICAgICAgPG1hdC1pY29uPndvcmtzcGFjZXM8L21hdC1pY29uPlxyXG4gICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgIDxidXR0b25cclxuICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxyXG4gICAgICAgICAgY2xhc3M9XCJpbmJveC10YWJcIlxyXG4gICAgICAgICAgW2NsYXNzLmFjdGl2ZV09XCJhY3RpdmVUYWIgPT09ICdzZXR0aW5ncydcIlxyXG4gICAgICAgICAgKGNsaWNrKT1cInNldEFjdGl2ZVRhYignc2V0dGluZ3MnKVwiXHJcbiAgICAgICAgICBtYXRUb29sdGlwPVwiU2V0dGluZ3NcIlxyXG4gICAgICAgICAgbWF0VG9vbHRpcFBvc2l0aW9uPVwiYWJvdmVcIlxyXG4gICAgICAgID5cclxuICAgICAgICAgIDxtYXQtaWNvbj5zZXR0aW5nczwvbWF0LWljb24+XHJcbiAgICAgICAgPC9idXR0b24+XHJcbiAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgPCEtLSBDb250ZXh0IE1lbnUgLS0+XHJcbiAgICAgIDxkaXZcclxuICAgICAgICAqbmdJZj1cImNvbnRleHRNZW51XCJcclxuICAgICAgICBjbGFzcz1cImNvbnRleHQtbWVudVwiXHJcbiAgICAgICAgW3N0eWxlLnRvcC5weF09XCJjb250ZXh0TWVudS55XCJcclxuICAgICAgICBbc3R5bGUubGVmdC5weF09XCJjb250ZXh0TWVudS54XCJcclxuICAgICAgPlxyXG4gICAgICAgIDxkaXYgY2xhc3M9XCJjdHgtaXRlbVwiIChjbGljayk9XCJjbGVhckNoYXQoKVwiPlxyXG4gICAgICAgICAgPG1hdC1pY29uPmNsZWFuaW5nX3NlcnZpY2VzPC9tYXQtaWNvbj5cclxuICAgICAgICAgIDxzcGFuPkNsZWFyIGNvbnZlcnNhdGlvbjwvc3Bhbj5cclxuICAgICAgICA8L2Rpdj5cclxuICAgICAgICA8ZGl2IGNsYXNzPVwiY3R4LWl0ZW0gY3R4LWRhbmdlclwiIChjbGljayk9XCJkZWxldGVDaGF0KClcIj5cclxuICAgICAgICAgIDxtYXQtaWNvbj57eyBjb250ZXh0TWVudS5pdGVtLmlzX2dyb3VwID8gJ2xvZ291dCcgOiAnZGVsZXRlJyB9fTwvbWF0LWljb24+XHJcbiAgICAgICAgICA8c3Bhbj57eyBjb250ZXh0TWVudS5pdGVtLmlzX2dyb3VwID8gJ0V4aXQgZ3JvdXAnIDogJ0RlbGV0ZSBjb252ZXJzYXRpb24nIH19PC9zcGFuPlxyXG4gICAgICAgIDwvZGl2PlxyXG4gICAgICA8L2Rpdj5cclxuICAgICAgPGRpdiAqbmdJZj1cImNvbnRleHRNZW51XCIgY2xhc3M9XCJjdHgtYmFja2Ryb3BcIiAoY2xpY2spPVwiY2xvc2VDb250ZXh0TWVudSgpXCI+PC9kaXY+XHJcbiAgICA8L2Rpdj5cclxuICBgLFxyXG4gIHN0eWxlczogW2BcclxuICAgIC5pbmJveC1jb250YWluZXIge1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xyXG4gICAgICBoZWlnaHQ6IDEwMCU7XHJcbiAgICAgIGJhY2tncm91bmQ6IHRyYW5zcGFyZW50O1xyXG4gICAgICBjb250YWluZXItdHlwZTogaW5saW5lLXNpemU7XHJcbiAgICB9XHJcblxyXG4gICAgLnNlYXJjaC1iYXIge1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBtYXJnaW46IDhweCAxNnB4O1xyXG4gICAgICBwYWRkaW5nOiA4cHggMTJweDtcclxuICAgICAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQ7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDEwcHg7XHJcbiAgICB9XHJcblxyXG4gICAgLnNlYXJjaC1pY29uIHtcclxuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC43KTtcclxuICAgICAgZm9udC1zaXplOiAxOHB4O1xyXG4gICAgICB3aWR0aDogMjBweDtcclxuICAgICAgaGVpZ2h0OiAyMHB4O1xyXG4gICAgICBtYXJnaW4tcmlnaHQ6IDhweDtcclxuICAgIH1cclxuXHJcbiAgICAuc2VhcmNoLWlucHV0IHtcclxuICAgICAgZmxleDogMTtcclxuICAgICAgYm9yZGVyOiBub25lO1xyXG4gICAgICBvdXRsaW5lOiBub25lO1xyXG4gICAgICBiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudDtcclxuICAgICAgZm9udC1zaXplOiAxNHB4O1xyXG4gICAgICBjb2xvcjogI2ZmZjtcclxuICAgIH1cclxuXHJcbiAgICAuc2VhcmNoLWlucHV0OjpwbGFjZWhvbGRlciB7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNik7XHJcbiAgICB9XHJcblxyXG4gICAgLmluYm94LXRhYnMge1xyXG4gICAgICBkaXNwbGF5OiBncmlkO1xyXG4gICAgICBncmlkLXRlbXBsYXRlLWNvbHVtbnM6IHJlcGVhdCg1LCBtaW5tYXgoMCwgMWZyKSk7XHJcbiAgICAgIGdhcDogNXB4O1xyXG4gICAgICBwYWRkaW5nOiAxMHB4IDE2cHggMTJweDtcclxuICAgICAgYm9yZGVyLXRvcDogMXB4IHNvbGlkIHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xKTtcclxuICAgICAgZmxleC1zaHJpbms6IDA7XHJcbiAgICB9XHJcblxyXG4gICAgLmluYm94LXRhYiB7XHJcbiAgICAgIG1pbi13aWR0aDogMDtcclxuICAgICAgYm9yZGVyOiAxcHggc29saWQgcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjE0KTtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjA2KTtcclxuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC43Mik7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDk5OXB4O1xyXG4gICAgICBwYWRkaW5nOiA2cHggNHB4O1xyXG4gICAgICBmb250LXdlaWdodDogNjAwO1xyXG4gICAgICBjdXJzb3I6IHBvaW50ZXI7XHJcbiAgICAgIGRpc3BsYXk6IGlubGluZS1mbGV4O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcclxuICAgICAgdHJhbnNpdGlvbjogYmFja2dyb3VuZCAwLjE1cywgYm9yZGVyLWNvbG9yIDAuMTVzLCBjb2xvciAwLjE1cztcclxuICAgIH1cclxuXHJcbiAgICAuaW5ib3gtdGFiIG1hdC1pY29uIHtcclxuICAgICAgZm9udC1zaXplOiBjbGFtcCgxN3B4LCA2Y3F3LCAyMXB4KTtcclxuICAgICAgd2lkdGg6IGNsYW1wKDE3cHgsIDZjcXcsIDIxcHgpO1xyXG4gICAgICBoZWlnaHQ6IGNsYW1wKDE3cHgsIDZjcXcsIDIxcHgpO1xyXG4gICAgICBsaW5lLWhlaWdodDogY2xhbXAoMTdweCwgNmNxdywgMjFweCk7XHJcbiAgICB9XHJcblxyXG4gICAgLmluYm94LXRhYjpob3ZlciB7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xMik7XHJcbiAgICAgIGNvbG9yOiAjZmZmO1xyXG4gICAgfVxyXG5cclxuICAgIC5pbmJveC10YWIuYWN0aXZlIHtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNiwgOTUsIDE2OCwgMC4zNSk7XHJcbiAgICAgIGJvcmRlci1jb2xvcjogcmdiYSgxMjcsIDE4MCwgMjU1LCAwLjQ1KTtcclxuICAgICAgY29sb3I6ICNmZmY7XHJcbiAgICB9XHJcblxyXG4gICAgQGNvbnRhaW5lciAobWF4LXdpZHRoOiAzMzBweCkge1xyXG4gICAgICAuaW5ib3gtdGFicyB7XHJcbiAgICAgICAgZ2FwOiAzcHg7XHJcbiAgICAgICAgcGFkZGluZzogOHB4IDhweCAxMHB4O1xyXG4gICAgICB9XHJcblxyXG4gICAgICAuaW5ib3gtdGFiIHtcclxuICAgICAgICBwYWRkaW5nOiA2cHggMnB4O1xyXG4gICAgICAgIGxldHRlci1zcGFjaW5nOiAtMC4ycHg7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBAY29udGFpbmVyIChtYXgtd2lkdGg6IDI4MHB4KSB7XHJcbiAgICAgIC5pbmJveC10YWJzIHtcclxuICAgICAgICBnYXA6IDJweDtcclxuICAgICAgICBwYWRkaW5nLWxlZnQ6IDZweDtcclxuICAgICAgICBwYWRkaW5nLXJpZ2h0OiA2cHg7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIC5pbmJveC10YWIge1xyXG4gICAgICAgIGZvbnQtc2l6ZTogOC41cHg7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAuY29udmVyc2F0aW9uLWxpc3Qge1xyXG4gICAgICBmbGV4OiAxO1xyXG4gICAgICBvdmVyZmxvdy15OiBhdXRvO1xyXG4gICAgICBzY3JvbGxiYXItd2lkdGg6IG5vbmU7XHJcbiAgICAgIC1tcy1vdmVyZmxvdy1zdHlsZTogbm9uZTtcclxuICAgIH1cclxuXHJcbiAgICAuY29udmVyc2F0aW9uLWxpc3Q6Oi13ZWJraXQtc2Nyb2xsYmFyIHtcclxuICAgICAgZGlzcGxheTogbm9uZTtcclxuICAgIH1cclxuXHJcbiAgICAuY29udmVyc2F0aW9uLWl0ZW0ge1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBwYWRkaW5nOiAxMnB4IDE2cHg7XHJcbiAgICAgIGN1cnNvcjogcG9pbnRlcjtcclxuICAgICAgdHJhbnNpdGlvbjogYmFja2dyb3VuZCAwLjE1cztcclxuICAgICAgZ2FwOiAxMnB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5jb252ZXJzYXRpb24taXRlbTpob3ZlciB7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xKTtcclxuICAgIH1cclxuXHJcbiAgICAuY29udmVyc2F0aW9uLWl0ZW0uaGFzLXVucmVhZCB7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xNSk7XHJcbiAgICB9XHJcblxyXG4gICAgLmF2YXRhciB7XHJcbiAgICAgIHdpZHRoOiA0OHB4O1xyXG4gICAgICBoZWlnaHQ6IDQ4cHg7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDUwJTtcclxuICAgICAgYmFja2dyb3VuZDogIzBkMjU0MDtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XHJcbiAgICAgIGZsZXgtc2hyaW5rOiAwO1xyXG4gICAgfVxyXG5cclxuICAgIC5hdmF0YXIgbWF0LWljb24ge1xyXG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjcpO1xyXG4gICAgICBmb250LXNpemU6IDI0cHg7XHJcbiAgICB9XHJcblxyXG4gICAgLmdyb3VwLWF2YXRhciB7XHJcbiAgICAgIGJhY2tncm91bmQ6ICMwYTFmMzg7XHJcbiAgICB9XHJcblxyXG4gICAgLmdyb3VwLWF2YXRhciBtYXQtaWNvbiB7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNyk7XHJcbiAgICB9XHJcblxyXG4gICAgLmNvbnZlcnNhdGlvbi1pbmZvIHtcclxuICAgICAgZmxleDogMTtcclxuICAgICAgbWluLXdpZHRoOiAwO1xyXG4gICAgfVxyXG5cclxuICAgIC5pbmZvLXRvcCB7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGp1c3RpZnktY29udGVudDogc3BhY2UtYmV0d2VlbjtcclxuICAgICAgYWxpZ24taXRlbXM6IGJhc2VsaW5lO1xyXG4gICAgICBtYXJnaW4tYm90dG9tOiAycHg7XHJcbiAgICB9XHJcblxyXG4gICAgLmNvbnYtbmFtZSB7XHJcbiAgICAgIGZvbnQtd2VpZ2h0OiA2MDA7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTRweDtcclxuICAgICAgY29sb3I6ICNmZmY7XHJcbiAgICAgIHdoaXRlLXNwYWNlOiBub3dyYXA7XHJcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XHJcbiAgICAgIHRleHQtb3ZlcmZsb3c6IGVsbGlwc2lzO1xyXG4gICAgICBtYXgtd2lkdGg6IDIwMHB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5jb252LXRpbWUge1xyXG4gICAgICBmb250LXNpemU6IDExcHg7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNyk7XHJcbiAgICAgIGZsZXgtc2hyaW5rOiAwO1xyXG4gICAgICBtYXJnaW4tbGVmdDogOHB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5pbmZvLWJvdHRvbSB7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGp1c3RpZnktY29udGVudDogc3BhY2UtYmV0d2VlbjtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAgZ2FwOiA2cHg7XHJcbiAgICB9XHJcblxyXG4gICAgLmNvbnYtcHJldmlldyB7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTNweDtcclxuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC43KTtcclxuICAgICAgd2hpdGUtc3BhY2U6IG5vd3JhcDtcclxuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcclxuICAgICAgdGV4dC1vdmVyZmxvdzogZWxsaXBzaXM7XHJcbiAgICAgIG1heC13aWR0aDogMjIwcHg7XHJcbiAgICB9XHJcblxyXG4gICAgLmhhcy11bnJlYWQgLmNvbnYtbmFtZSB7XHJcbiAgICAgIGNvbG9yOiAjZmZmO1xyXG4gICAgfVxyXG5cclxuICAgIC5oYXMtdW5yZWFkIC5jb252LXByZXZpZXcge1xyXG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjkpO1xyXG4gICAgICBmb250LXdlaWdodDogNTAwO1xyXG4gICAgfVxyXG5cclxuICAgIC51bnJlYWQtYmFkZ2Uge1xyXG4gICAgICBiYWNrZ3JvdW5kOiAjMWE1ZmE4O1xyXG4gICAgICBjb2xvcjogI2ZmZjtcclxuICAgICAgYm9yZGVyLXJhZGl1czogMTBweDtcclxuICAgICAgbWluLXdpZHRoOiAyMHB4O1xyXG4gICAgICBoZWlnaHQ6IDIwcHg7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTFweDtcclxuICAgICAgZm9udC13ZWlnaHQ6IDYwMDtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XHJcbiAgICAgIHBhZGRpbmc6IDAgNnB4O1xyXG4gICAgICBmbGV4LXNocmluazogMDtcclxuICAgIH1cclxuXHJcbiAgICAubWVudGlvbi1iYWRnZSB7XHJcbiAgICAgIHdpZHRoOiAyMHB4O1xyXG4gICAgICBoZWlnaHQ6IDIwcHg7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDk5OXB4O1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDEyNywgMTgwLCAyNTUsIDAuMik7XHJcbiAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHJnYmEoMTI3LCAxODAsIDI1NSwgMC41NSk7XHJcbiAgICAgIGNvbG9yOiAjYmZkYmZlO1xyXG4gICAgICBkaXNwbGF5OiBpbmxpbmUtZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTJweDtcclxuICAgICAgZm9udC13ZWlnaHQ6IDgwMDtcclxuICAgICAgZmxleC1zaHJpbms6IDA7XHJcbiAgICAgIG1hcmdpbi1sZWZ0OiA2cHg7XHJcbiAgICAgIGJveC1zaGFkb3c6IDAgMCAwIDJweCByZ2JhKDEyNywgMTgwLCAyNTUsIDAuMDYpO1xyXG4gICAgfVxyXG5cclxuICAgIC5lbXB0eS1zdGF0ZSB7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xyXG4gICAgICBwYWRkaW5nOiA0OHB4IDI0cHg7XHJcbiAgICAgIGNvbG9yOiAjOWNhM2FmO1xyXG4gICAgfVxyXG5cclxuICAgIC5lbXB0eS1zdGF0ZSBtYXQtaWNvbiB7XHJcbiAgICAgIGZvbnQtc2l6ZTogNDhweDtcclxuICAgICAgd2lkdGg6IDQ4cHg7XHJcbiAgICAgIGhlaWdodDogNDhweDtcclxuICAgICAgbWFyZ2luLWJvdHRvbTogMTJweDtcclxuICAgIH1cclxuXHJcbiAgICAuZW1wdHktc3RhdGUgcCB7XHJcbiAgICAgIG1hcmdpbjogMCAwIDE2cHg7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTRweDtcclxuICAgIH1cclxuXHJcbiAgICAucHJvamVjdHMtc3RhdGUgcCB7XHJcbiAgICAgIG1hcmdpbi1ib3R0b206IDA7XHJcbiAgICB9XHJcblxyXG4gICAgLnNldHRpbmdzLXBhbmVsIHtcclxuICAgICAgcGFkZGluZzogMTZweDtcclxuICAgICAgY29sb3I6ICNmZmY7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XHJcbiAgICAgIGdhcDogMTJweDtcclxuICAgIH1cclxuXHJcbiAgICAuc2V0dGluZ3MtY2FyZCB7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDE0cHg7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4wNyk7XHJcbiAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xMik7XHJcbiAgICAgIHBhZGRpbmc6IDE2cHg7XHJcbiAgICAgIGJveC1zaGFkb3c6IDAgMTBweCAyOHB4IHJnYmEoMCwgMCwgMCwgMC4xOCk7XHJcbiAgICB9XHJcblxyXG4gICAgLnNldHRpbmdzLWhlYWRlciB7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGdhcDogMTJweDtcclxuICAgICAgYWxpZ24taXRlbXM6IGZsZXgtc3RhcnQ7XHJcbiAgICAgIG1hcmdpbi1ib3R0b206IDE2cHg7XHJcbiAgICB9XHJcblxyXG4gICAgLnNldHRpbmdzLWljb24ge1xyXG4gICAgICB3aWR0aDogMzZweDtcclxuICAgICAgaGVpZ2h0OiAzNnB4O1xyXG4gICAgICBib3JkZXItcmFkaXVzOiAxMHB4O1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI2LCA5NSwgMTY4LCAwLjM1KTtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XHJcbiAgICAgIGZsZXgtc2hyaW5rOiAwO1xyXG4gICAgfVxyXG5cclxuICAgIC5zZXR0aW5ncy1pY29uIG1hdC1pY29uIHtcclxuICAgICAgY29sb3I6ICNiZmRiZmU7XHJcbiAgICB9XHJcblxyXG4gICAgLnNldHRpbmdzLWljb24uZGlzcGxheS1pY29uIHtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgxMzQsIDIzOSwgMTcyLCAwLjE0KTtcclxuICAgIH1cclxuXHJcbiAgICAuc2V0dGluZ3MtaWNvbi5kaXNwbGF5LWljb24gbWF0LWljb24ge1xyXG4gICAgICBjb2xvcjogI2JiZjdkMDtcclxuICAgIH1cclxuXHJcbiAgICAuc2V0dGluZ3MtaGVhZGVyIGg0IHtcclxuICAgICAgbWFyZ2luOiAwIDAgNHB4O1xyXG4gICAgICBmb250LXNpemU6IDE1cHg7XHJcbiAgICAgIGZvbnQtd2VpZ2h0OiA3MDA7XHJcbiAgICB9XHJcblxyXG4gICAgLnNldHRpbmdzLWhlYWRlciBwIHtcclxuICAgICAgbWFyZ2luOiAwO1xyXG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjY1KTtcclxuICAgICAgZm9udC1zaXplOiAxMnB4O1xyXG4gICAgICBsaW5lLWhlaWdodDogMS40O1xyXG4gICAgfVxyXG5cclxuICAgIC5zZXR0aW5ncy10b2dnbGUge1xyXG4gICAgICB3aWR0aDogMTAwJTtcclxuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDEwcHg7XHJcbiAgICAgIGNvbG9yOiAjZmZmICFpbXBvcnRhbnQ7XHJcbiAgICAgIGJvcmRlci1jb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjIpICFpbXBvcnRhbnQ7XHJcbiAgICAgIG1hcmdpbi1ib3R0b206IDE2cHg7XHJcbiAgICB9XHJcblxyXG4gICAgLnNldHRpbmdzLXRvZ2dsZSBtYXQtaWNvbiB7XHJcbiAgICAgIG1hcmdpbi1yaWdodDogOHB4O1xyXG4gICAgICBmb250LXNpemU6IDE4cHg7XHJcbiAgICAgIHdpZHRoOiAxOHB4O1xyXG4gICAgICBoZWlnaHQ6IDE4cHg7XHJcbiAgICB9XHJcblxyXG4gICAgLnZvbHVtZS1sYWJlbCB7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGp1c3RpZnktY29udGVudDogc3BhY2UtYmV0d2VlbjtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC43OCk7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTJweDtcclxuICAgICAgZm9udC13ZWlnaHQ6IDYwMDtcclxuICAgICAgbWFyZ2luLWJvdHRvbTogOHB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5zZXR0aW5ncy12b2x1bWUge1xyXG4gICAgICB3aWR0aDogMTAwJTtcclxuICAgICAgYWNjZW50LWNvbG9yOiAjN2ZiNGZmO1xyXG4gICAgICBjdXJzb3I6IHBvaW50ZXI7XHJcbiAgICAgIG1hcmdpbi1ib3R0b206IDEycHg7XHJcbiAgICB9XHJcblxyXG4gICAgLnNldHRpbmdzLXByZXZpZXcge1xyXG4gICAgICBtYXJnaW46IDAgMCAxNnB4O1xyXG4gICAgICBib3JkZXItcmFkaXVzOiAxMHB4O1xyXG4gICAgICBib3JkZXI6IDFweCBzb2xpZCByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMTIpO1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMDYpO1xyXG4gICAgICBjb2xvcjogI2Y1ZjdmZjtcclxuICAgICAgYm94LXNpemluZzogYm9yZGVyLWJveDtcclxuICAgIH1cclxuXHJcbiAgICAubWVzc2FnZS1wcmV2aWV3IHtcclxuICAgICAgcGFkZGluZzogOXB4IDExcHg7XHJcbiAgICAgIGxpbmUtaGVpZ2h0OiAxLjM1O1xyXG4gICAgfVxyXG5cclxuICAgIC5jb2RlLXByZXZpZXcge1xyXG4gICAgICBwYWRkaW5nOiAxMHB4IDExcHg7XHJcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XHJcbiAgICAgIGZvbnQtZmFtaWx5OiB1aS1tb25vc3BhY2UsIFNGTW9uby1SZWd1bGFyLCBNZW5sbywgTW9uYWNvLCBDb25zb2xhcywgXCJMaWJlcmF0aW9uIE1vbm9cIiwgbW9ub3NwYWNlO1xyXG4gICAgICBsaW5lLWhlaWdodDogMS40NTtcclxuICAgICAgd2hpdGUtc3BhY2U6IHByZS13cmFwO1xyXG4gICAgICBjb2xvcjogI2RiZWFmZTtcclxuICAgICAgYmFja2dyb3VuZDogIzA2MTgyNztcclxuICAgICAgbWFyZ2luLWJvdHRvbTogMDtcclxuICAgIH1cclxuXHJcbiAgICAuY29udGV4dC1tZW51IHtcclxuICAgICAgcG9zaXRpb246IGZpeGVkO1xyXG4gICAgICB6LWluZGV4OiAxMDAwMTtcclxuICAgICAgYmFja2dyb3VuZDogIzA3MWQzMDtcclxuICAgICAgYm9yZGVyLXJhZGl1czogOHB4O1xyXG4gICAgICBwYWRkaW5nOiA0cHggMDtcclxuICAgICAgYm94LXNoYWRvdzogMCA4cHggMjRweCByZ2JhKDAsIDAsIDAsIDAuMyk7XHJcbiAgICAgIG1pbi13aWR0aDogMjAwcHg7XHJcbiAgICB9XHJcblxyXG4gICAgLmN0eC1pdGVtIHtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAgZ2FwOiAxMHB4O1xyXG4gICAgICBwYWRkaW5nOiAxMHB4IDE2cHg7XHJcbiAgICAgIGN1cnNvcjogcG9pbnRlcjtcclxuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC45KTtcclxuICAgICAgZm9udC1zaXplOiAxM3B4O1xyXG4gICAgICB0cmFuc2l0aW9uOiBiYWNrZ3JvdW5kIDAuMTVzO1xyXG4gICAgfVxyXG5cclxuICAgIC5jdHgtaXRlbTpob3ZlciB7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xKTtcclxuICAgIH1cclxuXHJcbiAgICAuY3R4LWl0ZW0gbWF0LWljb24ge1xyXG4gICAgICBmb250LXNpemU6IDE4cHg7XHJcbiAgICAgIHdpZHRoOiAxOHB4O1xyXG4gICAgICBoZWlnaHQ6IDE4cHg7XHJcbiAgICB9XHJcblxyXG4gICAgLmN0eC1kYW5nZXIge1xyXG4gICAgICBjb2xvcjogI2Y4NzE3MTtcclxuICAgIH1cclxuXHJcbiAgICAuY3R4LWRhbmdlcjpob3ZlciB7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjQ4LCAxMTMsIDExMywgMC4xNSk7XHJcbiAgICB9XHJcblxyXG4gICAgLmN0eC1iYWNrZHJvcCB7XHJcbiAgICAgIHBvc2l0aW9uOiBmaXhlZDtcclxuICAgICAgaW5zZXQ6IDA7XHJcbiAgICAgIHotaW5kZXg6IDEwMDAwO1xyXG4gICAgfVxyXG4gIGBdLFxyXG59KVxyXG5leHBvcnQgY2xhc3MgSW5ib3hMaXN0Q29tcG9uZW50IGltcGxlbWVudHMgT25Jbml0LCBPbkRlc3Ryb3kge1xyXG4gIGluYm94OiBJbmJveEl0ZW1bXSA9IFtdO1xyXG4gIHNlYXJjaFF1ZXJ5ID0gJyc7XHJcbiAgYWN0aXZlVGFiOiAnYWxsJyB8ICdkaXJlY3QnIHwgJ2dyb3VwcycgfCAncHJvamVjdHMnIHwgJ3NldHRpbmdzJyA9ICdhbGwnO1xyXG4gIG5vdGlmaWNhdGlvblZvbHVtZSA9IDAuMzU7XHJcbiAgbm90aWZpY2F0aW9uc011dGVkID0gZmFsc2U7XHJcbiAgbWVzc2FnZVRleHRTY2FsZSA9IDE7XHJcbiAgY29kZVRleHRTY2FsZSA9IDE7XHJcbiAgY29udGV4dE1lbnU6IHsgeDogbnVtYmVyOyB5OiBudW1iZXI7IGl0ZW06IEluYm94SXRlbSB9IHwgbnVsbCA9IG51bGw7XHJcbiAgcHJpdmF0ZSByZWFkb25seSB0YWJTdG9yYWdlS2V5ID0gJ21lc3NhZ2luZ19pbmJveF9hY3RpdmVfdGFiJztcclxuICBwcml2YXRlIHN1YiE6IFN1YnNjcmlwdGlvbjtcclxuXHJcbiAgY29uc3RydWN0b3IocHJpdmF0ZSBzdG9yZTogTWVzc2FnaW5nU3RvcmVTZXJ2aWNlKSB7fVxyXG5cclxuICBuZ09uSW5pdCgpOiB2b2lkIHtcclxuICAgIHRoaXMuYWN0aXZlVGFiID0gdGhpcy5nZXRTYXZlZFRhYigpO1xyXG4gICAgdGhpcy5zdWIgPSBuZXcgU3Vic2NyaXB0aW9uKCk7XHJcbiAgICB0aGlzLnN1Yi5hZGQodGhpcy5zdG9yZS5pbmJveC5zdWJzY3JpYmUoKGl0ZW1zKSA9PiAodGhpcy5pbmJveCA9IGl0ZW1zKSkpO1xyXG4gICAgdGhpcy5zdWIuYWRkKHRoaXMuc3RvcmUubm90aWZpY2F0aW9uVm9sdW1lLnN1YnNjcmliZSgodm9sdW1lKSA9PiAodGhpcy5ub3RpZmljYXRpb25Wb2x1bWUgPSB2b2x1bWUpKSk7XHJcbiAgICB0aGlzLnN1Yi5hZGQodGhpcy5zdG9yZS5ub3RpZmljYXRpb25zTXV0ZWQuc3Vic2NyaWJlKChtdXRlZCkgPT4gKHRoaXMubm90aWZpY2F0aW9uc011dGVkID0gbXV0ZWQpKSk7XHJcbiAgICB0aGlzLnN1Yi5hZGQodGhpcy5zdG9yZS5tZXNzYWdlVGV4dFNjYWxlLnN1YnNjcmliZSgoc2NhbGUpID0+ICh0aGlzLm1lc3NhZ2VUZXh0U2NhbGUgPSBzY2FsZSkpKTtcclxuICAgIHRoaXMuc3ViLmFkZCh0aGlzLnN0b3JlLmNvZGVUZXh0U2NhbGUuc3Vic2NyaWJlKChzY2FsZSkgPT4gKHRoaXMuY29kZVRleHRTY2FsZSA9IHNjYWxlKSkpO1xyXG4gIH1cclxuXHJcbiAgbmdPbkRlc3Ryb3koKTogdm9pZCB7XHJcbiAgICB0aGlzLnN1Yj8udW5zdWJzY3JpYmUoKTtcclxuICB9XHJcblxyXG4gIGdldCBmaWx0ZXJlZEluYm94KCk6IEluYm94SXRlbVtdIHtcclxuICAgIGlmICh0aGlzLmFjdGl2ZVRhYiA9PT0gJ3Byb2plY3RzJyB8fCB0aGlzLmFjdGl2ZVRhYiA9PT0gJ3NldHRpbmdzJykgcmV0dXJuIFtdO1xyXG4gICAgY29uc3QgdGFiYmVkID0gdGhpcy5pbmJveC5maWx0ZXIoKGl0ZW0pID0+IHtcclxuICAgICAgaWYgKHRoaXMuYWN0aXZlVGFiID09PSAnZGlyZWN0JykgcmV0dXJuICFpdGVtLmlzX2dyb3VwO1xyXG4gICAgICBpZiAodGhpcy5hY3RpdmVUYWIgPT09ICdncm91cHMnKSByZXR1cm4gaXRlbS5pc19ncm91cDtcclxuICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICB9KTtcclxuICAgIGlmICghdGhpcy5zZWFyY2hRdWVyeS50cmltKCkpIHJldHVybiB0YWJiZWQ7XHJcbiAgICBjb25zdCBxID0gdGhpcy5zZWFyY2hRdWVyeS50b0xvd2VyQ2FzZSgpO1xyXG4gICAgcmV0dXJuIHRhYmJlZC5maWx0ZXIoXHJcbiAgICAgIChpdGVtKSA9PlxyXG4gICAgICAgIChpdGVtLm5hbWUgfHwgJycpLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMocSkgfHxcclxuICAgICAgICAoaXRlbS5sYXN0X21lc3NhZ2VfcHJldmlldyB8fCAnJykudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhxKVxyXG4gICAgKTtcclxuICB9XHJcblxyXG4gIGdldCBlbXB0eVN0YXRlVGV4dCgpOiBzdHJpbmcge1xyXG4gICAgaWYgKHRoaXMuc2VhcmNoUXVlcnkudHJpbSgpKSByZXR1cm4gJ05vIG1hdGNoaW5nIGNvbnZlcnNhdGlvbnMnO1xyXG4gICAgaWYgKHRoaXMuYWN0aXZlVGFiID09PSAnZGlyZWN0JykgcmV0dXJuICdObyBjaGF0cyB5ZXQnO1xyXG4gICAgaWYgKHRoaXMuYWN0aXZlVGFiID09PSAnZ3JvdXBzJykgcmV0dXJuICdObyBncm91cHMgeWV0JztcclxuICAgIHJldHVybiAnTm8gY29udmVyc2F0aW9ucyB5ZXQnO1xyXG4gIH1cclxuXHJcbiAgc2V0QWN0aXZlVGFiKHRhYjogJ2FsbCcgfCAnZGlyZWN0JyB8ICdncm91cHMnIHwgJ3Byb2plY3RzJyB8ICdzZXR0aW5ncycpOiB2b2lkIHtcclxuICAgIHRoaXMuYWN0aXZlVGFiID0gdGFiO1xyXG4gICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0odGhpcy50YWJTdG9yYWdlS2V5LCB0YWIpO1xyXG4gICAgdGhpcy5jb250ZXh0TWVudSA9IG51bGw7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGdldFNhdmVkVGFiKCk6ICdhbGwnIHwgJ2RpcmVjdCcgfCAnZ3JvdXBzJyB8ICdwcm9qZWN0cycgfCAnc2V0dGluZ3MnIHtcclxuICAgIGNvbnN0IHNhdmVkID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0odGhpcy50YWJTdG9yYWdlS2V5KTtcclxuICAgIHJldHVybiBzYXZlZCA9PT0gJ2RpcmVjdCcgfHwgc2F2ZWQgPT09ICdncm91cHMnIHx8IHNhdmVkID09PSAncHJvamVjdHMnIHx8IHNhdmVkID09PSAnc2V0dGluZ3MnIHx8IHNhdmVkID09PSAnYWxsJ1xyXG4gICAgICA/IHNhdmVkXHJcbiAgICAgIDogJ2FsbCc7XHJcbiAgfVxyXG5cclxuICB0b2dnbGVOb3RpZmljYXRpb25zTXV0ZWQoKTogdm9pZCB7XHJcbiAgICBjb25zdCBuZXh0TXV0ZWQgPSAhdGhpcy5ub3RpZmljYXRpb25zTXV0ZWQ7XHJcbiAgICB0aGlzLnN0b3JlLnNldE5vdGlmaWNhdGlvbnNNdXRlZChuZXh0TXV0ZWQpO1xyXG4gICAgaWYgKCFuZXh0TXV0ZWQgJiYgdGhpcy5ub3RpZmljYXRpb25Wb2x1bWUgPiAwKSB7XHJcbiAgICAgIHRoaXMuc3RvcmUudGVzdE5vdGlmaWNhdGlvblNvdW5kKCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBvbk5vdGlmaWNhdGlvblZvbHVtZUNoYW5nZSh2YWx1ZTogbnVtYmVyIHwgc3RyaW5nKTogdm9pZCB7XHJcbiAgICB0aGlzLnN0b3JlLnNldE5vdGlmaWNhdGlvblZvbHVtZShOdW1iZXIodmFsdWUpKTtcclxuICB9XHJcblxyXG4gIHByZXZpZXdOb3RpZmljYXRpb25Tb3VuZCgpOiB2b2lkIHtcclxuICAgIGlmICghdGhpcy5ub3RpZmljYXRpb25zTXV0ZWQgJiYgdGhpcy5ub3RpZmljYXRpb25Wb2x1bWUgPiAwKSB7XHJcbiAgICAgIHRoaXMuc3RvcmUudGVzdE5vdGlmaWNhdGlvblNvdW5kKCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBvbk1lc3NhZ2VUZXh0U2NhbGVDaGFuZ2UodmFsdWU6IG51bWJlciB8IHN0cmluZyk6IHZvaWQge1xyXG4gICAgdGhpcy5zdG9yZS5zZXRNZXNzYWdlVGV4dFNjYWxlKE51bWJlcih2YWx1ZSkpO1xyXG4gIH1cclxuXHJcbiAgb25Db2RlVGV4dFNjYWxlQ2hhbmdlKHZhbHVlOiBudW1iZXIgfCBzdHJpbmcpOiB2b2lkIHtcclxuICAgIHRoaXMuc3RvcmUuc2V0Q29kZVRleHRTY2FsZShOdW1iZXIodmFsdWUpKTtcclxuICB9XHJcblxyXG4gIG9wZW5Db252ZXJzYXRpb24oaXRlbTogSW5ib3hJdGVtKTogdm9pZCB7XHJcbiAgICB0aGlzLnN0b3JlLm9wZW5Db252ZXJzYXRpb24oaXRlbS5jb252ZXJzYXRpb25faWQsIGl0ZW0ubmFtZSB8fCAnQ2hhdCcsIGl0ZW0uaXNfZ3JvdXApO1xyXG4gIH1cclxuXHJcbiAgb25OZXdDb252ZXJzYXRpb24oKTogdm9pZCB7XHJcbiAgICB0aGlzLnN0b3JlLnNldFZpZXcoJ25ldy1jb252ZXJzYXRpb24nKTtcclxuICB9XHJcblxyXG4gIG9uQ3JlYXRlR3JvdXAoKTogdm9pZCB7XHJcbiAgICB0aGlzLnN0b3JlLnNldFZpZXcoJ2dyb3VwLW1hbmFnZXInKTtcclxuICB9XHJcblxyXG4gIG9uQ29udGV4dE1lbnUoZXZlbnQ6IE1vdXNlRXZlbnQsIGl0ZW06IEluYm94SXRlbSk6IHZvaWQge1xyXG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuICAgIGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xyXG4gICAgdGhpcy5jb250ZXh0TWVudSA9IHsgeDogZXZlbnQuY2xpZW50WCwgeTogZXZlbnQuY2xpZW50WSwgaXRlbSB9O1xyXG4gIH1cclxuXHJcbiAgY2xvc2VDb250ZXh0TWVudSgpOiB2b2lkIHtcclxuICAgIHRoaXMuY29udGV4dE1lbnUgPSBudWxsO1xyXG4gIH1cclxuXHJcbiAgY2xlYXJDaGF0KCk6IHZvaWQge1xyXG4gICAgaWYgKCF0aGlzLmNvbnRleHRNZW51KSByZXR1cm47XHJcbiAgICBjb25zdCBpZCA9IHRoaXMuY29udGV4dE1lbnUuaXRlbS5jb252ZXJzYXRpb25faWQ7XHJcbiAgICB0aGlzLnN0b3JlLmNsZWFyQ29udmVyc2F0aW9uKGlkKTtcclxuICAgIHRoaXMuY29udGV4dE1lbnUgPSBudWxsO1xyXG4gIH1cclxuXHJcbiAgZGVsZXRlQ2hhdCgpOiB2b2lkIHtcclxuICAgIGlmICghdGhpcy5jb250ZXh0TWVudSkgcmV0dXJuO1xyXG4gICAgY29uc3QgaXRlbSA9IHRoaXMuY29udGV4dE1lbnUuaXRlbTtcclxuICAgIGlmIChpdGVtLmlzX2dyb3VwKSB7XHJcbiAgICAgIHRoaXMuc3RvcmUuZGVsZXRlR3JvdXAoaXRlbS5jb252ZXJzYXRpb25faWQpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgdGhpcy5zdG9yZS5kZWxldGVDb252ZXJzYXRpb24oaXRlbS5jb252ZXJzYXRpb25faWQpO1xyXG4gICAgfVxyXG4gICAgdGhpcy5jb250ZXh0TWVudSA9IG51bGw7XHJcbiAgfVxyXG5cclxuICBmb3JtYXRUaW1lKGRhdGVTdHI6IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgICBpZiAoIWRhdGVTdHIpIHJldHVybiAnJztcclxuICAgIGNvbnN0IGRhdGUgPSBuZXcgRGF0ZShkYXRlU3RyKTtcclxuICAgIGNvbnN0IG5vdyA9IG5ldyBEYXRlKCk7XHJcbiAgICBjb25zdCBkaWZmTXMgPSBub3cuZ2V0VGltZSgpIC0gZGF0ZS5nZXRUaW1lKCk7XHJcbiAgICBjb25zdCBkaWZmTWlucyA9IE1hdGguZmxvb3IoZGlmZk1zIC8gNjAwMDApO1xyXG4gICAgY29uc3QgZGlmZkhvdXJzID0gTWF0aC5mbG9vcihkaWZmTXMgLyAzNjAwMDAwKTtcclxuICAgIGNvbnN0IGRpZmZEYXlzID0gTWF0aC5mbG9vcihkaWZmTXMgLyA4NjQwMDAwMCk7XHJcblxyXG4gICAgaWYgKGRpZmZNaW5zIDwgMSkgcmV0dXJuICdub3cnO1xyXG4gICAgaWYgKGRpZmZNaW5zIDwgNjApIHJldHVybiBgJHtkaWZmTWluc31tYDtcclxuICAgIGlmIChkaWZmSG91cnMgPCAyNCkgcmV0dXJuIGAke2RpZmZIb3Vyc31oYDtcclxuICAgIGlmIChkaWZmRGF5cyA8IDcpIHJldHVybiBgJHtkaWZmRGF5c31kYDtcclxuXHJcbiAgICByZXR1cm4gZGF0ZS50b0xvY2FsZURhdGVTdHJpbmcoJ2VuLUdCJywgeyBkYXk6ICdudW1lcmljJywgbW9udGg6ICdzaG9ydCcgfSk7XHJcbiAgfVxyXG59XHJcbiJdfQ==