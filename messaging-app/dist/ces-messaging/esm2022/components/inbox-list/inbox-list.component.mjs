import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatRippleModule } from '@angular/material/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription } from 'rxjs';
import { isProjectConversation } from '../../models/messaging.models';
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
        if (this.activeTab === 'settings')
            return [];
        const tabbed = this.inbox.filter((item) => {
            const project = this.isProject(item);
            if (this.activeTab === 'direct')
                return !item.is_group;
            if (this.activeTab === 'groups')
                return item.is_group && !project;
            if (this.activeTab === 'projects')
                return project;
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
        if (this.activeTab === 'projects')
            return 'No project chats yet';
        return 'No conversations yet';
    }
    isProject(item) {
        return isProjectConversation(item);
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
        this.store.openConversation(item.conversation_id, item.name || 'Chat', item.is_group, this.isProject(item));
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
      <div *ngIf="activeTab !== 'settings'" class="search-bar">
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
          <div
            class="avatar"
            [class.group-avatar]="item.is_group && !isProject(item)"
            [class.project-avatar]="isProject(item)"
          >
            <mat-icon>{{ isProject(item) ? 'workspaces' : item.is_group ? 'group' : 'person' }}</mat-icon>
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

        <div *ngIf="filteredInbox.length === 0 && activeTab !== 'settings'" class="empty-state">
          <mat-icon>{{ activeTab === 'projects' ? 'workspaces' : activeTab === 'groups' ? 'group' : 'forum' }}</mat-icon>
          <p>{{ emptyStateText }}</p>
          <button *ngIf="!searchQuery && activeTab !== 'groups' && activeTab !== 'projects'" mat-stroked-button color="primary" (click)="onNewConversation()">
            Start a conversation
          </button>
          <button *ngIf="!searchQuery && activeTab === 'groups'" mat-stroked-button color="primary" (click)="onCreateGroup()">
            Create a group
          </button>
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
  `, isInline: true, styles: [".inbox-container{display:flex;flex-direction:column;height:100%;background:transparent;container-type:inline-size}.search-bar{display:flex;align-items:center;margin:8px 16px;padding:8px 12px;background:transparent;border-radius:10px}.search-icon{color:#ffffffb3;font-size:18px;width:20px;height:20px;margin-right:8px}.search-input{flex:1;border:none;outline:none;background:transparent;font-size:14px;color:#fff}.search-input::placeholder{color:#fff9}.inbox-tabs{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:5px;padding:10px 16px 12px;border-top:1px solid rgba(255,255,255,.1);flex-shrink:0}.inbox-tab{min-width:0;border:1px solid rgba(255,255,255,.14);background:#ffffff0f;color:#ffffffb8;border-radius:999px;padding:6px 4px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:background .15s,border-color .15s,color .15s}.inbox-tab mat-icon{font-size:clamp(17px,6cqw,21px);width:clamp(17px,6cqw,21px);height:clamp(17px,6cqw,21px);line-height:clamp(17px,6cqw,21px)}.inbox-tab:hover{background:#ffffff1f;color:#fff}.inbox-tab.active{background:#1a5fa859;border-color:#7fb4ff73;color:#fff}@container (max-width: 330px){.inbox-tabs{gap:3px;padding:8px 8px 10px}.inbox-tab{padding:6px 2px;letter-spacing:-.2px}}@container (max-width: 280px){.inbox-tabs{gap:2px;padding-left:6px;padding-right:6px}.inbox-tab{font-size:8.5px}}.conversation-list{flex:1;overflow-y:auto;scrollbar-width:none;-ms-overflow-style:none}.conversation-list::-webkit-scrollbar{display:none}.conversation-item{display:flex;align-items:center;padding:12px 16px;cursor:pointer;transition:background .15s;gap:12px}.conversation-item:hover{background:#ffffff1a}.conversation-item.has-unread{background:#ffffff26}.avatar{width:48px;height:48px;border-radius:50%;background:#0d2540;display:flex;align-items:center;justify-content:center;flex-shrink:0}.avatar mat-icon{color:#ffffffb3;font-size:24px}.group-avatar{background:#0a1f38}.group-avatar mat-icon{color:#ffffffb3}.project-avatar{background:#2563eb33}.project-avatar mat-icon{color:#bfdbfe}.conversation-info{flex:1;min-width:0}.info-top{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:2px}.conv-name{font-weight:600;font-size:14px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px}.conv-time{font-size:11px;color:#ffffffb3;flex-shrink:0;margin-left:8px}.info-bottom{display:flex;justify-content:space-between;align-items:center;gap:6px}.conv-preview{font-size:13px;color:#ffffffb3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px}.has-unread .conv-name{color:#fff}.has-unread .conv-preview{color:#ffffffe6;font-weight:500}.unread-badge{background:#1a5fa8;color:#fff;border-radius:10px;min-width:20px;height:20px;font-size:11px;font-weight:600;display:flex;align-items:center;justify-content:center;padding:0 6px;flex-shrink:0}.mention-badge{width:20px;height:20px;border-radius:999px;background:#7fb4ff33;border:1px solid rgba(127,180,255,.55);color:#bfdbfe;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex-shrink:0;margin-left:6px;box-shadow:0 0 0 2px #7fb4ff0f}.empty-state{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 24px;color:#9ca3af}.empty-state mat-icon{font-size:48px;width:48px;height:48px;margin-bottom:12px}.empty-state p{margin:0 0 16px;font-size:14px}.settings-panel{padding:16px;color:#fff;display:flex;flex-direction:column;gap:12px}.settings-card{border-radius:14px;background:#ffffff12;border:1px solid rgba(255,255,255,.12);padding:16px;box-shadow:0 10px 28px #0000002e}.settings-header{display:flex;gap:12px;align-items:flex-start;margin-bottom:16px}.settings-icon{width:36px;height:36px;border-radius:10px;background:#1a5fa859;display:flex;align-items:center;justify-content:center;flex-shrink:0}.settings-icon mat-icon{color:#bfdbfe}.settings-icon.display-icon{background:#86efac24}.settings-icon.display-icon mat-icon{color:#bbf7d0}.settings-header h4{margin:0 0 4px;font-size:15px;font-weight:700}.settings-header p{margin:0;color:#ffffffa6;font-size:12px;line-height:1.4}.settings-toggle{width:100%;justify-content:center;border-radius:10px;color:#fff!important;border-color:#fff3!important;margin-bottom:16px}.settings-toggle mat-icon{margin-right:8px;font-size:18px;width:18px;height:18px}.volume-label{display:flex;justify-content:space-between;align-items:center;color:#ffffffc7;font-size:12px;font-weight:600;margin-bottom:8px}.settings-volume{width:100%;accent-color:#7fb4ff;cursor:pointer;margin-bottom:12px}.settings-preview{margin:0 0 16px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:#ffffff0f;color:#f5f7ff;box-sizing:border-box}.message-preview{padding:9px 11px;line-height:1.35}.code-preview{padding:10px 11px;overflow:hidden;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,Liberation Mono,monospace;line-height:1.45;white-space:pre-wrap;color:#dbeafe;background:#061827;margin-bottom:0}.context-menu{position:fixed;z-index:10001;background:#071d30;border-radius:8px;padding:4px 0;box-shadow:0 8px 24px #0000004d;min-width:200px}.ctx-item{display:flex;align-items:center;gap:10px;padding:10px 16px;cursor:pointer;color:#ffffffe6;font-size:13px;transition:background .15s}.ctx-item:hover{background:#ffffff1a}.ctx-item mat-icon{font-size:18px;width:18px;height:18px}.ctx-danger{color:#f87171}.ctx-danger:hover{background:#f8717126}.ctx-backdrop{position:fixed;inset:0;z-index:10000}\n"], dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i2.NgForOf, selector: "[ngFor][ngForOf]", inputs: ["ngForOf", "ngForTrackBy", "ngForTemplate"] }, { kind: "directive", type: i2.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "pipe", type: i2.DecimalPipe, name: "number" }, { kind: "ngmodule", type: FormsModule }, { kind: "directive", type: i3.DefaultValueAccessor, selector: "input:not([type=checkbox])[formControlName],textarea[formControlName],input:not([type=checkbox])[formControl],textarea[formControl],input:not([type=checkbox])[ngModel],textarea[ngModel],[ngDefaultControl]" }, { kind: "directive", type: i3.RangeValueAccessor, selector: "input[type=range][formControlName],input[type=range][formControl],input[type=range][ngModel]" }, { kind: "directive", type: i3.NgControlStatus, selector: "[formControlName],[ngModel],[formControl]" }, { kind: "directive", type: i3.NgModel, selector: "[ngModel]:not([formControlName]):not([formControl])", inputs: ["name", "disabled", "ngModel", "ngModelOptions"], outputs: ["ngModelChange"], exportAs: ["ngModel"] }, { kind: "ngmodule", type: MatIconModule }, { kind: "component", type: i4.MatIcon, selector: "mat-icon", inputs: ["color", "inline", "svgIcon", "fontSet", "fontIcon"], exportAs: ["matIcon"] }, { kind: "ngmodule", type: MatButtonModule }, { kind: "component", type: i5.MatButton, selector: "    button[mat-button], button[mat-raised-button], button[mat-flat-button],    button[mat-stroked-button]  ", exportAs: ["matButton"] }, { kind: "ngmodule", type: MatRippleModule }, { kind: "directive", type: i6.MatRipple, selector: "[mat-ripple], [matRipple]", inputs: ["matRippleColor", "matRippleUnbounded", "matRippleCentered", "matRippleRadius", "matRippleAnimation", "matRippleDisabled", "matRippleTrigger"], exportAs: ["matRipple"] }, { kind: "ngmodule", type: MatTooltipModule }, { kind: "directive", type: i7.MatTooltip, selector: "[matTooltip]", inputs: ["matTooltipPosition", "matTooltipPositionAtOrigin", "matTooltipDisabled", "matTooltipShowDelay", "matTooltipHideDelay", "matTooltipTouchGestures", "matTooltip", "matTooltipClass"], exportAs: ["matTooltip"] }] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: InboxListComponent, decorators: [{
            type: Component,
            args: [{ selector: 'app-inbox-list', standalone: true, imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatRippleModule, MatTooltipModule], template: `
    <div class="inbox-container">
      <div *ngIf="activeTab !== 'settings'" class="search-bar">
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
          <div
            class="avatar"
            [class.group-avatar]="item.is_group && !isProject(item)"
            [class.project-avatar]="isProject(item)"
          >
            <mat-icon>{{ isProject(item) ? 'workspaces' : item.is_group ? 'group' : 'person' }}</mat-icon>
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

        <div *ngIf="filteredInbox.length === 0 && activeTab !== 'settings'" class="empty-state">
          <mat-icon>{{ activeTab === 'projects' ? 'workspaces' : activeTab === 'groups' ? 'group' : 'forum' }}</mat-icon>
          <p>{{ emptyStateText }}</p>
          <button *ngIf="!searchQuery && activeTab !== 'groups' && activeTab !== 'projects'" mat-stroked-button color="primary" (click)="onNewConversation()">
            Start a conversation
          </button>
          <button *ngIf="!searchQuery && activeTab === 'groups'" mat-stroked-button color="primary" (click)="onCreateGroup()">
            Create a group
          </button>
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
  `, styles: [".inbox-container{display:flex;flex-direction:column;height:100%;background:transparent;container-type:inline-size}.search-bar{display:flex;align-items:center;margin:8px 16px;padding:8px 12px;background:transparent;border-radius:10px}.search-icon{color:#ffffffb3;font-size:18px;width:20px;height:20px;margin-right:8px}.search-input{flex:1;border:none;outline:none;background:transparent;font-size:14px;color:#fff}.search-input::placeholder{color:#fff9}.inbox-tabs{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:5px;padding:10px 16px 12px;border-top:1px solid rgba(255,255,255,.1);flex-shrink:0}.inbox-tab{min-width:0;border:1px solid rgba(255,255,255,.14);background:#ffffff0f;color:#ffffffb8;border-radius:999px;padding:6px 4px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:background .15s,border-color .15s,color .15s}.inbox-tab mat-icon{font-size:clamp(17px,6cqw,21px);width:clamp(17px,6cqw,21px);height:clamp(17px,6cqw,21px);line-height:clamp(17px,6cqw,21px)}.inbox-tab:hover{background:#ffffff1f;color:#fff}.inbox-tab.active{background:#1a5fa859;border-color:#7fb4ff73;color:#fff}@container (max-width: 330px){.inbox-tabs{gap:3px;padding:8px 8px 10px}.inbox-tab{padding:6px 2px;letter-spacing:-.2px}}@container (max-width: 280px){.inbox-tabs{gap:2px;padding-left:6px;padding-right:6px}.inbox-tab{font-size:8.5px}}.conversation-list{flex:1;overflow-y:auto;scrollbar-width:none;-ms-overflow-style:none}.conversation-list::-webkit-scrollbar{display:none}.conversation-item{display:flex;align-items:center;padding:12px 16px;cursor:pointer;transition:background .15s;gap:12px}.conversation-item:hover{background:#ffffff1a}.conversation-item.has-unread{background:#ffffff26}.avatar{width:48px;height:48px;border-radius:50%;background:#0d2540;display:flex;align-items:center;justify-content:center;flex-shrink:0}.avatar mat-icon{color:#ffffffb3;font-size:24px}.group-avatar{background:#0a1f38}.group-avatar mat-icon{color:#ffffffb3}.project-avatar{background:#2563eb33}.project-avatar mat-icon{color:#bfdbfe}.conversation-info{flex:1;min-width:0}.info-top{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:2px}.conv-name{font-weight:600;font-size:14px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px}.conv-time{font-size:11px;color:#ffffffb3;flex-shrink:0;margin-left:8px}.info-bottom{display:flex;justify-content:space-between;align-items:center;gap:6px}.conv-preview{font-size:13px;color:#ffffffb3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px}.has-unread .conv-name{color:#fff}.has-unread .conv-preview{color:#ffffffe6;font-weight:500}.unread-badge{background:#1a5fa8;color:#fff;border-radius:10px;min-width:20px;height:20px;font-size:11px;font-weight:600;display:flex;align-items:center;justify-content:center;padding:0 6px;flex-shrink:0}.mention-badge{width:20px;height:20px;border-radius:999px;background:#7fb4ff33;border:1px solid rgba(127,180,255,.55);color:#bfdbfe;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex-shrink:0;margin-left:6px;box-shadow:0 0 0 2px #7fb4ff0f}.empty-state{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 24px;color:#9ca3af}.empty-state mat-icon{font-size:48px;width:48px;height:48px;margin-bottom:12px}.empty-state p{margin:0 0 16px;font-size:14px}.settings-panel{padding:16px;color:#fff;display:flex;flex-direction:column;gap:12px}.settings-card{border-radius:14px;background:#ffffff12;border:1px solid rgba(255,255,255,.12);padding:16px;box-shadow:0 10px 28px #0000002e}.settings-header{display:flex;gap:12px;align-items:flex-start;margin-bottom:16px}.settings-icon{width:36px;height:36px;border-radius:10px;background:#1a5fa859;display:flex;align-items:center;justify-content:center;flex-shrink:0}.settings-icon mat-icon{color:#bfdbfe}.settings-icon.display-icon{background:#86efac24}.settings-icon.display-icon mat-icon{color:#bbf7d0}.settings-header h4{margin:0 0 4px;font-size:15px;font-weight:700}.settings-header p{margin:0;color:#ffffffa6;font-size:12px;line-height:1.4}.settings-toggle{width:100%;justify-content:center;border-radius:10px;color:#fff!important;border-color:#fff3!important;margin-bottom:16px}.settings-toggle mat-icon{margin-right:8px;font-size:18px;width:18px;height:18px}.volume-label{display:flex;justify-content:space-between;align-items:center;color:#ffffffc7;font-size:12px;font-weight:600;margin-bottom:8px}.settings-volume{width:100%;accent-color:#7fb4ff;cursor:pointer;margin-bottom:12px}.settings-preview{margin:0 0 16px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:#ffffff0f;color:#f5f7ff;box-sizing:border-box}.message-preview{padding:9px 11px;line-height:1.35}.code-preview{padding:10px 11px;overflow:hidden;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,Liberation Mono,monospace;line-height:1.45;white-space:pre-wrap;color:#dbeafe;background:#061827;margin-bottom:0}.context-menu{position:fixed;z-index:10001;background:#071d30;border-radius:8px;padding:4px 0;box-shadow:0 8px 24px #0000004d;min-width:200px}.ctx-item{display:flex;align-items:center;gap:10px;padding:10px 16px;cursor:pointer;color:#ffffffe6;font-size:13px;transition:background .15s}.ctx-item:hover{background:#ffffff1a}.ctx-item mat-icon{font-size:18px;width:18px;height:18px}.ctx-danger{color:#f87171}.ctx-danger:hover{background:#f8717126}.ctx-backdrop{position:fixed;inset:0;z-index:10000}\n"] }]
        }], ctorParameters: () => [{ type: i1.MessagingStoreService }] });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5ib3gtbGlzdC5jb21wb25lbnQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvbGliL2NvbXBvbmVudHMvaW5ib3gtbGlzdC9pbmJveC1saXN0LmNvbXBvbmVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsU0FBUyxFQUFxQixNQUFNLGVBQWUsQ0FBQztBQUM3RCxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDL0MsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLGdCQUFnQixDQUFDO0FBQzdDLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSx3QkFBd0IsQ0FBQztBQUN2RCxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFDM0QsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHdCQUF3QixDQUFDO0FBQ3pELE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBQzdELE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxNQUFNLENBQUM7QUFFcEMsT0FBTyxFQUFhLHFCQUFxQixFQUFFLE1BQU0sK0JBQStCLENBQUM7Ozs7Ozs7OztBQXFwQmpGLE1BQU0sT0FBTyxrQkFBa0I7SUFZVDtJQVhwQixLQUFLLEdBQWdCLEVBQUUsQ0FBQztJQUN4QixXQUFXLEdBQUcsRUFBRSxDQUFDO0lBQ2pCLFNBQVMsR0FBMEQsS0FBSyxDQUFDO0lBQ3pFLGtCQUFrQixHQUFHLElBQUksQ0FBQztJQUMxQixrQkFBa0IsR0FBRyxLQUFLLENBQUM7SUFDM0IsZ0JBQWdCLEdBQUcsQ0FBQyxDQUFDO0lBQ3JCLGFBQWEsR0FBRyxDQUFDLENBQUM7SUFDbEIsV0FBVyxHQUFxRCxJQUFJLENBQUM7SUFDcEQsYUFBYSxHQUFHLDRCQUE0QixDQUFDO0lBQ3RELEdBQUcsQ0FBZ0I7SUFFM0IsWUFBb0IsS0FBNEI7UUFBNUIsVUFBSyxHQUFMLEtBQUssQ0FBdUI7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TEFBRSxlQUFlLDJOQUFFLGVBQWUsa1NBQUUsZ0JBQWdCOzs0RkFncEIzRixrQkFBa0I7a0JBbnBCOUIsU0FBUzsrQkFDRSxnQkFBZ0IsY0FDZCxJQUFJLFdBQ1AsQ0FBQyxZQUFZLEVBQUUsV0FBVyxFQUFFLGFBQWEsRUFBRSxlQUFlLEVBQUUsZUFBZSxFQUFFLGdCQUFnQixDQUFDLFlBQzdGOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7R0EyTlQiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBDb21wb25lbnQsIE9uSW5pdCwgT25EZXN0cm95IH0gZnJvbSAnQGFuZ3VsYXIvY29yZSc7XHJcbmltcG9ydCB7IENvbW1vbk1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL2NvbW1vbic7XHJcbmltcG9ydCB7IEZvcm1zTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvZm9ybXMnO1xyXG5pbXBvcnQgeyBNYXRJY29uTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvbWF0ZXJpYWwvaWNvbic7XHJcbmltcG9ydCB7IE1hdEJ1dHRvbk1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL21hdGVyaWFsL2J1dHRvbic7XHJcbmltcG9ydCB7IE1hdFJpcHBsZU1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL21hdGVyaWFsL2NvcmUnO1xyXG5pbXBvcnQgeyBNYXRUb29sdGlwTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvbWF0ZXJpYWwvdG9vbHRpcCc7XHJcbmltcG9ydCB7IFN1YnNjcmlwdGlvbiB9IGZyb20gJ3J4anMnO1xyXG5pbXBvcnQgeyBNZXNzYWdpbmdTdG9yZVNlcnZpY2UgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9tZXNzYWdpbmctc3RvcmUuc2VydmljZSc7XHJcbmltcG9ydCB7IEluYm94SXRlbSwgaXNQcm9qZWN0Q29udmVyc2F0aW9uIH0gZnJvbSAnLi4vLi4vbW9kZWxzL21lc3NhZ2luZy5tb2RlbHMnO1xyXG5cclxuQENvbXBvbmVudCh7XHJcbiAgc2VsZWN0b3I6ICdhcHAtaW5ib3gtbGlzdCcsXHJcbiAgc3RhbmRhbG9uZTogdHJ1ZSxcclxuICBpbXBvcnRzOiBbQ29tbW9uTW9kdWxlLCBGb3Jtc01vZHVsZSwgTWF0SWNvbk1vZHVsZSwgTWF0QnV0dG9uTW9kdWxlLCBNYXRSaXBwbGVNb2R1bGUsIE1hdFRvb2x0aXBNb2R1bGVdLFxyXG4gIHRlbXBsYXRlOiBgXHJcbiAgICA8ZGl2IGNsYXNzPVwiaW5ib3gtY29udGFpbmVyXCI+XHJcbiAgICAgIDxkaXYgKm5nSWY9XCJhY3RpdmVUYWIgIT09ICdzZXR0aW5ncydcIiBjbGFzcz1cInNlYXJjaC1iYXJcIj5cclxuICAgICAgICA8bWF0LWljb24gY2xhc3M9XCJzZWFyY2gtaWNvblwiPnNlYXJjaDwvbWF0LWljb24+XHJcbiAgICAgICAgPGlucHV0XHJcbiAgICAgICAgICB0eXBlPVwidGV4dFwiXHJcbiAgICAgICAgICBbKG5nTW9kZWwpXT1cInNlYXJjaFF1ZXJ5XCJcclxuICAgICAgICAgIHBsYWNlaG9sZGVyPVwiU2VhcmNoIGNvbnZlcnNhdGlvbnMuLi5cIlxyXG4gICAgICAgICAgY2xhc3M9XCJzZWFyY2gtaW5wdXRcIlxyXG4gICAgICAgIC8+XHJcbiAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgPGRpdiBjbGFzcz1cImNvbnZlcnNhdGlvbi1saXN0XCI+XHJcbiAgICAgICAgPGRpdlxyXG4gICAgICAgICAgKm5nRm9yPVwibGV0IGl0ZW0gb2YgZmlsdGVyZWRJbmJveFwiXHJcbiAgICAgICAgICBjbGFzcz1cImNvbnZlcnNhdGlvbi1pdGVtXCJcclxuICAgICAgICAgIG1hdFJpcHBsZVxyXG4gICAgICAgICAgW2NsYXNzLmhhcy11bnJlYWRdPVwiaXRlbS51bnJlYWRfY291bnQgPiAwXCJcclxuICAgICAgICAgIChjbGljayk9XCJvcGVuQ29udmVyc2F0aW9uKGl0ZW0pXCJcclxuICAgICAgICAgIChjb250ZXh0bWVudSk9XCJvbkNvbnRleHRNZW51KCRldmVudCwgaXRlbSlcIlxyXG4gICAgICAgID5cclxuICAgICAgICAgIDxkaXZcclxuICAgICAgICAgICAgY2xhc3M9XCJhdmF0YXJcIlxyXG4gICAgICAgICAgICBbY2xhc3MuZ3JvdXAtYXZhdGFyXT1cIml0ZW0uaXNfZ3JvdXAgJiYgIWlzUHJvamVjdChpdGVtKVwiXHJcbiAgICAgICAgICAgIFtjbGFzcy5wcm9qZWN0LWF2YXRhcl09XCJpc1Byb2plY3QoaXRlbSlcIlxyXG4gICAgICAgICAgPlxyXG4gICAgICAgICAgICA8bWF0LWljb24+e3sgaXNQcm9qZWN0KGl0ZW0pID8gJ3dvcmtzcGFjZXMnIDogaXRlbS5pc19ncm91cCA/ICdncm91cCcgOiAncGVyc29uJyB9fTwvbWF0LWljb24+XHJcbiAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJjb252ZXJzYXRpb24taW5mb1wiPlxyXG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwiaW5mby10b3BcIj5cclxuICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cImNvbnYtbmFtZVwiPnt7IGl0ZW0ubmFtZSB8fCAnRGlyZWN0IE1lc3NhZ2UnIH19PC9zcGFuPlxyXG4gICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwiY29udi10aW1lXCI+e3sgZm9ybWF0VGltZShpdGVtLmxhc3RfbWVzc2FnZV9hdCkgfX08L3NwYW4+XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwiaW5mby1ib3R0b21cIj5cclxuICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cImNvbnYtcHJldmlld1wiPnt7IGl0ZW0ubGFzdF9tZXNzYWdlX3ByZXZpZXcgfHwgJ05vIG1lc3NhZ2VzIHlldCcgfX08L3NwYW4+XHJcbiAgICAgICAgICAgICAgPHNwYW5cclxuICAgICAgICAgICAgICAgICpuZ0lmPVwiaXRlbS5oYXNfbWVudGlvblwiXHJcbiAgICAgICAgICAgICAgICBjbGFzcz1cIm1lbnRpb24tYmFkZ2VcIlxyXG4gICAgICAgICAgICAgICAgbWF0VG9vbHRpcD1cIllvdSB3ZXJlIG1lbnRpb25lZFwiXHJcbiAgICAgICAgICAgICAgICBtYXRUb29sdGlwUG9zaXRpb249XCJhYm92ZVwiXHJcbiAgICAgICAgICAgICAgPiYjNjQ7PC9zcGFuPlxyXG4gICAgICAgICAgICAgIDxzcGFuICpuZ0lmPVwiaXRlbS51bnJlYWRfY291bnQgPiAwXCIgY2xhc3M9XCJ1bnJlYWQtYmFkZ2VcIj5cclxuICAgICAgICAgICAgICAgIHt7IGl0ZW0udW5yZWFkX2NvdW50ID4gOTkgPyAnOTkrJyA6IGl0ZW0udW5yZWFkX2NvdW50IH19XHJcbiAgICAgICAgICAgICAgPC9zcGFuPlxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICA8ZGl2ICpuZ0lmPVwiZmlsdGVyZWRJbmJveC5sZW5ndGggPT09IDAgJiYgYWN0aXZlVGFiICE9PSAnc2V0dGluZ3MnXCIgY2xhc3M9XCJlbXB0eS1zdGF0ZVwiPlxyXG4gICAgICAgICAgPG1hdC1pY29uPnt7IGFjdGl2ZVRhYiA9PT0gJ3Byb2plY3RzJyA/ICd3b3Jrc3BhY2VzJyA6IGFjdGl2ZVRhYiA9PT0gJ2dyb3VwcycgPyAnZ3JvdXAnIDogJ2ZvcnVtJyB9fTwvbWF0LWljb24+XHJcbiAgICAgICAgICA8cD57eyBlbXB0eVN0YXRlVGV4dCB9fTwvcD5cclxuICAgICAgICAgIDxidXR0b24gKm5nSWY9XCIhc2VhcmNoUXVlcnkgJiYgYWN0aXZlVGFiICE9PSAnZ3JvdXBzJyAmJiBhY3RpdmVUYWIgIT09ICdwcm9qZWN0cydcIiBtYXQtc3Ryb2tlZC1idXR0b24gY29sb3I9XCJwcmltYXJ5XCIgKGNsaWNrKT1cIm9uTmV3Q29udmVyc2F0aW9uKClcIj5cclxuICAgICAgICAgICAgU3RhcnQgYSBjb252ZXJzYXRpb25cclxuICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgPGJ1dHRvbiAqbmdJZj1cIiFzZWFyY2hRdWVyeSAmJiBhY3RpdmVUYWIgPT09ICdncm91cHMnXCIgbWF0LXN0cm9rZWQtYnV0dG9uIGNvbG9yPVwicHJpbWFyeVwiIChjbGljayk9XCJvbkNyZWF0ZUdyb3VwKClcIj5cclxuICAgICAgICAgICAgQ3JlYXRlIGEgZ3JvdXBcclxuICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICA8ZGl2ICpuZ0lmPVwiYWN0aXZlVGFiID09PSAnc2V0dGluZ3MnXCIgY2xhc3M9XCJzZXR0aW5ncy1wYW5lbFwiPlxyXG4gICAgICAgICAgPGRpdiBjbGFzcz1cInNldHRpbmdzLWNhcmRcIj5cclxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cInNldHRpbmdzLWhlYWRlclwiPlxyXG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJzZXR0aW5ncy1pY29uXCI+XHJcbiAgICAgICAgICAgICAgICA8bWF0LWljb24+e3sgbm90aWZpY2F0aW9uc011dGVkIHx8IG5vdGlmaWNhdGlvblZvbHVtZSA8PSAwID8gJ3ZvbHVtZV9vZmYnIDogJ3ZvbHVtZV91cCcgfX08L21hdC1pY29uPlxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgIDxkaXY+XHJcbiAgICAgICAgICAgICAgICA8aDQ+Tm90aWZpY2F0aW9uIFNvdW5kPC9oND5cclxuICAgICAgICAgICAgICAgIDxwPkNvbnRyb2wgbWVzc2FnZSBhbGVydHMgZm9yIHRoaXMgYnJvd3Nlci48L3A+XHJcbiAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxyXG4gICAgICAgICAgICAgIG1hdC1zdHJva2VkLWJ1dHRvblxyXG4gICAgICAgICAgICAgIGNsYXNzPVwic2V0dGluZ3MtdG9nZ2xlXCJcclxuICAgICAgICAgICAgICAoY2xpY2spPVwidG9nZ2xlTm90aWZpY2F0aW9uc011dGVkKClcIlxyXG4gICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgPG1hdC1pY29uPnt7IG5vdGlmaWNhdGlvbnNNdXRlZCA/ICd2b2x1bWVfdXAnIDogJ3ZvbHVtZV9vZmYnIH19PC9tYXQtaWNvbj5cclxuICAgICAgICAgICAgICB7eyBub3RpZmljYXRpb25zTXV0ZWQgPyAnVW5tdXRlIG5vdGlmaWNhdGlvbnMnIDogJ011dGUgbm90aWZpY2F0aW9ucycgfX1cclxuICAgICAgICAgICAgPC9idXR0b24+XHJcblxyXG4gICAgICAgICAgICA8bGFiZWwgY2xhc3M9XCJ2b2x1bWUtbGFiZWxcIiBmb3I9XCJtZXNzYWdpbmctdm9sdW1lLXNsaWRlclwiPlxyXG4gICAgICAgICAgICAgIFZvbHVtZVxyXG4gICAgICAgICAgICAgIDxzcGFuPnt7IChub3RpZmljYXRpb25Wb2x1bWUgKiAxMDApIHwgbnVtYmVyOicxLjAtMCcgfX0lPC9zcGFuPlxyXG4gICAgICAgICAgICA8L2xhYmVsPlxyXG4gICAgICAgICAgICA8aW5wdXRcclxuICAgICAgICAgICAgICBpZD1cIm1lc3NhZ2luZy12b2x1bWUtc2xpZGVyXCJcclxuICAgICAgICAgICAgICB0eXBlPVwicmFuZ2VcIlxyXG4gICAgICAgICAgICAgIG1pbj1cIjBcIlxyXG4gICAgICAgICAgICAgIG1heD1cIjFcIlxyXG4gICAgICAgICAgICAgIHN0ZXA9XCIwLjA1XCJcclxuICAgICAgICAgICAgICBjbGFzcz1cInNldHRpbmdzLXZvbHVtZVwiXHJcbiAgICAgICAgICAgICAgWyhuZ01vZGVsKV09XCJub3RpZmljYXRpb25Wb2x1bWVcIlxyXG4gICAgICAgICAgICAgIChuZ01vZGVsQ2hhbmdlKT1cIm9uTm90aWZpY2F0aW9uVm9sdW1lQ2hhbmdlKCRldmVudClcIlxyXG4gICAgICAgICAgICAgIChjaGFuZ2UpPVwicHJldmlld05vdGlmaWNhdGlvblNvdW5kKClcIlxyXG4gICAgICAgICAgICAvPlxyXG4gICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgPGRpdiBjbGFzcz1cInNldHRpbmdzLWNhcmRcIj5cclxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cInNldHRpbmdzLWhlYWRlclwiPlxyXG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJzZXR0aW5ncy1pY29uIGRpc3BsYXktaWNvblwiPlxyXG4gICAgICAgICAgICAgICAgPG1hdC1pY29uPnRleHRfZmllbGRzPC9tYXQtaWNvbj5cclxuICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICA8ZGl2PlxyXG4gICAgICAgICAgICAgICAgPGg0PkRpc3BsYXkgU2l6ZTwvaDQ+XHJcbiAgICAgICAgICAgICAgICA8cD5BZGp1c3QgbWVzc2FnZSB0ZXh0IGFuZCBwcm9ncmFtbWluZyBibG9jayBzaXplcy48L3A+XHJcbiAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgICAgPGxhYmVsIGNsYXNzPVwidm9sdW1lLWxhYmVsXCIgZm9yPVwibWVzc2FnaW5nLW1lc3NhZ2Utc2l6ZS1zbGlkZXJcIj5cclxuICAgICAgICAgICAgICBNZXNzYWdlIHNpemVcclxuICAgICAgICAgICAgICA8c3Bhbj57eyAobWVzc2FnZVRleHRTY2FsZSAqIDEwMCkgfCBudW1iZXI6JzEuMC0wJyB9fSU8L3NwYW4+XHJcbiAgICAgICAgICAgIDwvbGFiZWw+XHJcbiAgICAgICAgICAgIDxpbnB1dFxyXG4gICAgICAgICAgICAgIGlkPVwibWVzc2FnaW5nLW1lc3NhZ2Utc2l6ZS1zbGlkZXJcIlxyXG4gICAgICAgICAgICAgIHR5cGU9XCJyYW5nZVwiXHJcbiAgICAgICAgICAgICAgbWluPVwiMC44XCJcclxuICAgICAgICAgICAgICBtYXg9XCIxLjVcIlxyXG4gICAgICAgICAgICAgIHN0ZXA9XCIwLjA1XCJcclxuICAgICAgICAgICAgICBjbGFzcz1cInNldHRpbmdzLXZvbHVtZVwiXHJcbiAgICAgICAgICAgICAgWyhuZ01vZGVsKV09XCJtZXNzYWdlVGV4dFNjYWxlXCJcclxuICAgICAgICAgICAgICAobmdNb2RlbENoYW5nZSk9XCJvbk1lc3NhZ2VUZXh0U2NhbGVDaGFuZ2UoJGV2ZW50KVwiXHJcbiAgICAgICAgICAgIC8+XHJcbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJzZXR0aW5ncy1wcmV2aWV3IG1lc3NhZ2UtcHJldmlld1wiIFtzdHlsZS5mb250LXNpemUucHhdPVwiMTMgKiBtZXNzYWdlVGV4dFNjYWxlXCI+XHJcbiAgICAgICAgICAgICAgVGhpcyBpcyBob3cgbm9ybWFsIG1lc3NhZ2UgdGV4dCB3aWxsIGFwcGVhciBpbiBjaGF0LlxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgICAgIDxsYWJlbCBjbGFzcz1cInZvbHVtZS1sYWJlbFwiIGZvcj1cIm1lc3NhZ2luZy1jb2RlLXNpemUtc2xpZGVyXCI+XHJcbiAgICAgICAgICAgICAgUHJvZ3JhbW1pbmcgc2l6ZVxyXG4gICAgICAgICAgICAgIDxzcGFuPnt7IChjb2RlVGV4dFNjYWxlICogMTAwKSB8IG51bWJlcjonMS4wLTAnIH19JTwvc3Bhbj5cclxuICAgICAgICAgICAgPC9sYWJlbD5cclxuICAgICAgICAgICAgPGlucHV0XHJcbiAgICAgICAgICAgICAgaWQ9XCJtZXNzYWdpbmctY29kZS1zaXplLXNsaWRlclwiXHJcbiAgICAgICAgICAgICAgdHlwZT1cInJhbmdlXCJcclxuICAgICAgICAgICAgICBtaW49XCIwLjhcIlxyXG4gICAgICAgICAgICAgIG1heD1cIjEuNVwiXHJcbiAgICAgICAgICAgICAgc3RlcD1cIjAuMDVcIlxyXG4gICAgICAgICAgICAgIGNsYXNzPVwic2V0dGluZ3Mtdm9sdW1lXCJcclxuICAgICAgICAgICAgICBbKG5nTW9kZWwpXT1cImNvZGVUZXh0U2NhbGVcIlxyXG4gICAgICAgICAgICAgIChuZ01vZGVsQ2hhbmdlKT1cIm9uQ29kZVRleHRTY2FsZUNoYW5nZSgkZXZlbnQpXCJcclxuICAgICAgICAgICAgLz5cclxuICAgICAgICAgICAgPHByZSBjbGFzcz1cInNldHRpbmdzLXByZXZpZXcgY29kZS1wcmV2aWV3XCIgW3N0eWxlLmZvbnQtc2l6ZS5weF09XCIxMiAqIGNvZGVUZXh0U2NhbGVcIj48Y29kZT5TRUxFQ1QgdGlja2V0X3JlZiwgc3RhdHVzXHJcbkZST00gbG9nZ2luZy50aWNrZXRcclxuV0hFUkUgc3RhdHVzID0gJ09wZW4nOzwvY29kZT48L3ByZT5cclxuICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgIDwvZGl2PlxyXG4gICAgICA8L2Rpdj5cclxuXHJcbiAgICAgIDxkaXYgY2xhc3M9XCJpbmJveC10YWJzXCIgcm9sZT1cInRhYmxpc3RcIiBhcmlhLWxhYmVsPVwiQ29udmVyc2F0aW9uIGZpbHRlcnNcIj5cclxuICAgICAgICA8YnV0dG9uXHJcbiAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcclxuICAgICAgICAgIGNsYXNzPVwiaW5ib3gtdGFiXCJcclxuICAgICAgICAgIFtjbGFzcy5hY3RpdmVdPVwiYWN0aXZlVGFiID09PSAnYWxsJ1wiXHJcbiAgICAgICAgICAoY2xpY2spPVwic2V0QWN0aXZlVGFiKCdhbGwnKVwiXHJcbiAgICAgICAgICBtYXRUb29sdGlwPVwiQWxsXCJcclxuICAgICAgICAgIG1hdFRvb2x0aXBQb3NpdGlvbj1cImFib3ZlXCJcclxuICAgICAgICA+XHJcbiAgICAgICAgICA8bWF0LWljb24+Zm9ydW08L21hdC1pY29uPlxyXG4gICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgIDxidXR0b25cclxuICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxyXG4gICAgICAgICAgY2xhc3M9XCJpbmJveC10YWJcIlxyXG4gICAgICAgICAgW2NsYXNzLmFjdGl2ZV09XCJhY3RpdmVUYWIgPT09ICdkaXJlY3QnXCJcclxuICAgICAgICAgIChjbGljayk9XCJzZXRBY3RpdmVUYWIoJ2RpcmVjdCcpXCJcclxuICAgICAgICAgIG1hdFRvb2x0aXA9XCJDaGF0c1wiXHJcbiAgICAgICAgICBtYXRUb29sdGlwUG9zaXRpb249XCJhYm92ZVwiXHJcbiAgICAgICAgPlxyXG4gICAgICAgICAgPG1hdC1pY29uPmNoYXQ8L21hdC1pY29uPlxyXG4gICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgIDxidXR0b25cclxuICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxyXG4gICAgICAgICAgY2xhc3M9XCJpbmJveC10YWJcIlxyXG4gICAgICAgICAgW2NsYXNzLmFjdGl2ZV09XCJhY3RpdmVUYWIgPT09ICdncm91cHMnXCJcclxuICAgICAgICAgIChjbGljayk9XCJzZXRBY3RpdmVUYWIoJ2dyb3VwcycpXCJcclxuICAgICAgICAgIG1hdFRvb2x0aXA9XCJHcm91cHNcIlxyXG4gICAgICAgICAgbWF0VG9vbHRpcFBvc2l0aW9uPVwiYWJvdmVcIlxyXG4gICAgICAgID5cclxuICAgICAgICAgIDxtYXQtaWNvbj5ncm91cHM8L21hdC1pY29uPlxyXG4gICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgIDxidXR0b25cclxuICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxyXG4gICAgICAgICAgY2xhc3M9XCJpbmJveC10YWJcIlxyXG4gICAgICAgICAgW2NsYXNzLmFjdGl2ZV09XCJhY3RpdmVUYWIgPT09ICdwcm9qZWN0cydcIlxyXG4gICAgICAgICAgKGNsaWNrKT1cInNldEFjdGl2ZVRhYigncHJvamVjdHMnKVwiXHJcbiAgICAgICAgICBtYXRUb29sdGlwPVwiUHJvamVjdHNcIlxyXG4gICAgICAgICAgbWF0VG9vbHRpcFBvc2l0aW9uPVwiYWJvdmVcIlxyXG4gICAgICAgID5cclxuICAgICAgICAgIDxtYXQtaWNvbj53b3Jrc3BhY2VzPC9tYXQtaWNvbj5cclxuICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICA8YnV0dG9uXHJcbiAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcclxuICAgICAgICAgIGNsYXNzPVwiaW5ib3gtdGFiXCJcclxuICAgICAgICAgIFtjbGFzcy5hY3RpdmVdPVwiYWN0aXZlVGFiID09PSAnc2V0dGluZ3MnXCJcclxuICAgICAgICAgIChjbGljayk9XCJzZXRBY3RpdmVUYWIoJ3NldHRpbmdzJylcIlxyXG4gICAgICAgICAgbWF0VG9vbHRpcD1cIlNldHRpbmdzXCJcclxuICAgICAgICAgIG1hdFRvb2x0aXBQb3NpdGlvbj1cImFib3ZlXCJcclxuICAgICAgICA+XHJcbiAgICAgICAgICA8bWF0LWljb24+c2V0dGluZ3M8L21hdC1pY29uPlxyXG4gICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICA8L2Rpdj5cclxuXHJcbiAgICAgIDwhLS0gQ29udGV4dCBNZW51IC0tPlxyXG4gICAgICA8ZGl2XHJcbiAgICAgICAgKm5nSWY9XCJjb250ZXh0TWVudVwiXHJcbiAgICAgICAgY2xhc3M9XCJjb250ZXh0LW1lbnVcIlxyXG4gICAgICAgIFtzdHlsZS50b3AucHhdPVwiY29udGV4dE1lbnUueVwiXHJcbiAgICAgICAgW3N0eWxlLmxlZnQucHhdPVwiY29udGV4dE1lbnUueFwiXHJcbiAgICAgID5cclxuICAgICAgICA8ZGl2IGNsYXNzPVwiY3R4LWl0ZW1cIiAoY2xpY2spPVwiY2xlYXJDaGF0KClcIj5cclxuICAgICAgICAgIDxtYXQtaWNvbj5jbGVhbmluZ19zZXJ2aWNlczwvbWF0LWljb24+XHJcbiAgICAgICAgICA8c3Bhbj5DbGVhciBjb252ZXJzYXRpb248L3NwYW4+XHJcbiAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgPGRpdiBjbGFzcz1cImN0eC1pdGVtIGN0eC1kYW5nZXJcIiAoY2xpY2spPVwiZGVsZXRlQ2hhdCgpXCI+XHJcbiAgICAgICAgICA8bWF0LWljb24+e3sgY29udGV4dE1lbnUuaXRlbS5pc19ncm91cCA/ICdsb2dvdXQnIDogJ2RlbGV0ZScgfX08L21hdC1pY29uPlxyXG4gICAgICAgICAgPHNwYW4+e3sgY29udGV4dE1lbnUuaXRlbS5pc19ncm91cCA/ICdFeGl0IGdyb3VwJyA6ICdEZWxldGUgY29udmVyc2F0aW9uJyB9fTwvc3Bhbj5cclxuICAgICAgICA8L2Rpdj5cclxuICAgICAgPC9kaXY+XHJcbiAgICAgIDxkaXYgKm5nSWY9XCJjb250ZXh0TWVudVwiIGNsYXNzPVwiY3R4LWJhY2tkcm9wXCIgKGNsaWNrKT1cImNsb3NlQ29udGV4dE1lbnUoKVwiPjwvZGl2PlxyXG4gICAgPC9kaXY+XHJcbiAgYCxcclxuICBzdHlsZXM6IFtgXHJcbiAgICAuaW5ib3gtY29udGFpbmVyIHtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcclxuICAgICAgaGVpZ2h0OiAxMDAlO1xyXG4gICAgICBiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudDtcclxuICAgICAgY29udGFpbmVyLXR5cGU6IGlubGluZS1zaXplO1xyXG4gICAgfVxyXG5cclxuICAgIC5zZWFyY2gtYmFyIHtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAgbWFyZ2luOiA4cHggMTZweDtcclxuICAgICAgcGFkZGluZzogOHB4IDEycHg7XHJcbiAgICAgIGJhY2tncm91bmQ6IHRyYW5zcGFyZW50O1xyXG4gICAgICBib3JkZXItcmFkaXVzOiAxMHB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5zZWFyY2gtaWNvbiB7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNyk7XHJcbiAgICAgIGZvbnQtc2l6ZTogMThweDtcclxuICAgICAgd2lkdGg6IDIwcHg7XHJcbiAgICAgIGhlaWdodDogMjBweDtcclxuICAgICAgbWFyZ2luLXJpZ2h0OiA4cHg7XHJcbiAgICB9XHJcblxyXG4gICAgLnNlYXJjaC1pbnB1dCB7XHJcbiAgICAgIGZsZXg6IDE7XHJcbiAgICAgIGJvcmRlcjogbm9uZTtcclxuICAgICAgb3V0bGluZTogbm9uZTtcclxuICAgICAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQ7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTRweDtcclxuICAgICAgY29sb3I6ICNmZmY7XHJcbiAgICB9XHJcblxyXG4gICAgLnNlYXJjaC1pbnB1dDo6cGxhY2Vob2xkZXIge1xyXG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjYpO1xyXG4gICAgfVxyXG5cclxuICAgIC5pbmJveC10YWJzIHtcclxuICAgICAgZGlzcGxheTogZ3JpZDtcclxuICAgICAgZ3JpZC10ZW1wbGF0ZS1jb2x1bW5zOiByZXBlYXQoNSwgbWlubWF4KDAsIDFmcikpO1xyXG4gICAgICBnYXA6IDVweDtcclxuICAgICAgcGFkZGluZzogMTBweCAxNnB4IDEycHg7XHJcbiAgICAgIGJvcmRlci10b3A6IDFweCBzb2xpZCByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMSk7XHJcbiAgICAgIGZsZXgtc2hyaW5rOiAwO1xyXG4gICAgfVxyXG5cclxuICAgIC5pbmJveC10YWIge1xyXG4gICAgICBtaW4td2lkdGg6IDA7XHJcbiAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xNCk7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4wNik7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNzIpO1xyXG4gICAgICBib3JkZXItcmFkaXVzOiA5OTlweDtcclxuICAgICAgcGFkZGluZzogNnB4IDRweDtcclxuICAgICAgZm9udC13ZWlnaHQ6IDYwMDtcclxuICAgICAgY3Vyc29yOiBwb2ludGVyO1xyXG4gICAgICBkaXNwbGF5OiBpbmxpbmUtZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XHJcbiAgICAgIHRyYW5zaXRpb246IGJhY2tncm91bmQgMC4xNXMsIGJvcmRlci1jb2xvciAwLjE1cywgY29sb3IgMC4xNXM7XHJcbiAgICB9XHJcblxyXG4gICAgLmluYm94LXRhYiBtYXQtaWNvbiB7XHJcbiAgICAgIGZvbnQtc2l6ZTogY2xhbXAoMTdweCwgNmNxdywgMjFweCk7XHJcbiAgICAgIHdpZHRoOiBjbGFtcCgxN3B4LCA2Y3F3LCAyMXB4KTtcclxuICAgICAgaGVpZ2h0OiBjbGFtcCgxN3B4LCA2Y3F3LCAyMXB4KTtcclxuICAgICAgbGluZS1oZWlnaHQ6IGNsYW1wKDE3cHgsIDZjcXcsIDIxcHgpO1xyXG4gICAgfVxyXG5cclxuICAgIC5pbmJveC10YWI6aG92ZXIge1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMTIpO1xyXG4gICAgICBjb2xvcjogI2ZmZjtcclxuICAgIH1cclxuXHJcbiAgICAuaW5ib3gtdGFiLmFjdGl2ZSB7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjYsIDk1LCAxNjgsIDAuMzUpO1xyXG4gICAgICBib3JkZXItY29sb3I6IHJnYmEoMTI3LCAxODAsIDI1NSwgMC40NSk7XHJcbiAgICAgIGNvbG9yOiAjZmZmO1xyXG4gICAgfVxyXG5cclxuICAgIEBjb250YWluZXIgKG1heC13aWR0aDogMzMwcHgpIHtcclxuICAgICAgLmluYm94LXRhYnMge1xyXG4gICAgICAgIGdhcDogM3B4O1xyXG4gICAgICAgIHBhZGRpbmc6IDhweCA4cHggMTBweDtcclxuICAgICAgfVxyXG5cclxuICAgICAgLmluYm94LXRhYiB7XHJcbiAgICAgICAgcGFkZGluZzogNnB4IDJweDtcclxuICAgICAgICBsZXR0ZXItc3BhY2luZzogLTAuMnB4O1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgQGNvbnRhaW5lciAobWF4LXdpZHRoOiAyODBweCkge1xyXG4gICAgICAuaW5ib3gtdGFicyB7XHJcbiAgICAgICAgZ2FwOiAycHg7XHJcbiAgICAgICAgcGFkZGluZy1sZWZ0OiA2cHg7XHJcbiAgICAgICAgcGFkZGluZy1yaWdodDogNnB4O1xyXG4gICAgICB9XHJcblxyXG4gICAgICAuaW5ib3gtdGFiIHtcclxuICAgICAgICBmb250LXNpemU6IDguNXB4O1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLmNvbnZlcnNhdGlvbi1saXN0IHtcclxuICAgICAgZmxleDogMTtcclxuICAgICAgb3ZlcmZsb3cteTogYXV0bztcclxuICAgICAgc2Nyb2xsYmFyLXdpZHRoOiBub25lO1xyXG4gICAgICAtbXMtb3ZlcmZsb3ctc3R5bGU6IG5vbmU7XHJcbiAgICB9XHJcblxyXG4gICAgLmNvbnZlcnNhdGlvbi1saXN0Ojotd2Via2l0LXNjcm9sbGJhciB7XHJcbiAgICAgIGRpc3BsYXk6IG5vbmU7XHJcbiAgICB9XHJcblxyXG4gICAgLmNvbnZlcnNhdGlvbi1pdGVtIHtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAgcGFkZGluZzogMTJweCAxNnB4O1xyXG4gICAgICBjdXJzb3I6IHBvaW50ZXI7XHJcbiAgICAgIHRyYW5zaXRpb246IGJhY2tncm91bmQgMC4xNXM7XHJcbiAgICAgIGdhcDogMTJweDtcclxuICAgIH1cclxuXHJcbiAgICAuY29udmVyc2F0aW9uLWl0ZW06aG92ZXIge1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMSk7XHJcbiAgICB9XHJcblxyXG4gICAgLmNvbnZlcnNhdGlvbi1pdGVtLmhhcy11bnJlYWQge1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMTUpO1xyXG4gICAgfVxyXG5cclxuICAgIC5hdmF0YXIge1xyXG4gICAgICB3aWR0aDogNDhweDtcclxuICAgICAgaGVpZ2h0OiA0OHB4O1xyXG4gICAgICBib3JkZXItcmFkaXVzOiA1MCU7XHJcbiAgICAgIGJhY2tncm91bmQ6ICMwZDI1NDA7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xyXG4gICAgICBmbGV4LXNocmluazogMDtcclxuICAgIH1cclxuXHJcbiAgICAuYXZhdGFyIG1hdC1pY29uIHtcclxuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC43KTtcclxuICAgICAgZm9udC1zaXplOiAyNHB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5ncm91cC1hdmF0YXIge1xyXG4gICAgICBiYWNrZ3JvdW5kOiAjMGExZjM4O1xyXG4gICAgfVxyXG5cclxuICAgIC5ncm91cC1hdmF0YXIgbWF0LWljb24ge1xyXG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjcpO1xyXG4gICAgfVxyXG5cclxuICAgIC5wcm9qZWN0LWF2YXRhciB7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMzcsIDk5LCAyMzUsIDAuMik7XHJcbiAgICB9XHJcblxyXG4gICAgLnByb2plY3QtYXZhdGFyIG1hdC1pY29uIHtcclxuICAgICAgY29sb3I6ICNiZmRiZmU7XHJcbiAgICB9XHJcblxyXG4gICAgLmNvbnZlcnNhdGlvbi1pbmZvIHtcclxuICAgICAgZmxleDogMTtcclxuICAgICAgbWluLXdpZHRoOiAwO1xyXG4gICAgfVxyXG5cclxuICAgIC5pbmZvLXRvcCB7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGp1c3RpZnktY29udGVudDogc3BhY2UtYmV0d2VlbjtcclxuICAgICAgYWxpZ24taXRlbXM6IGJhc2VsaW5lO1xyXG4gICAgICBtYXJnaW4tYm90dG9tOiAycHg7XHJcbiAgICB9XHJcblxyXG4gICAgLmNvbnYtbmFtZSB7XHJcbiAgICAgIGZvbnQtd2VpZ2h0OiA2MDA7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTRweDtcclxuICAgICAgY29sb3I6ICNmZmY7XHJcbiAgICAgIHdoaXRlLXNwYWNlOiBub3dyYXA7XHJcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XHJcbiAgICAgIHRleHQtb3ZlcmZsb3c6IGVsbGlwc2lzO1xyXG4gICAgICBtYXgtd2lkdGg6IDIwMHB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5jb252LXRpbWUge1xyXG4gICAgICBmb250LXNpemU6IDExcHg7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNyk7XHJcbiAgICAgIGZsZXgtc2hyaW5rOiAwO1xyXG4gICAgICBtYXJnaW4tbGVmdDogOHB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5pbmZvLWJvdHRvbSB7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGp1c3RpZnktY29udGVudDogc3BhY2UtYmV0d2VlbjtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAgZ2FwOiA2cHg7XHJcbiAgICB9XHJcblxyXG4gICAgLmNvbnYtcHJldmlldyB7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTNweDtcclxuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC43KTtcclxuICAgICAgd2hpdGUtc3BhY2U6IG5vd3JhcDtcclxuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcclxuICAgICAgdGV4dC1vdmVyZmxvdzogZWxsaXBzaXM7XHJcbiAgICAgIG1heC13aWR0aDogMjIwcHg7XHJcbiAgICB9XHJcblxyXG4gICAgLmhhcy11bnJlYWQgLmNvbnYtbmFtZSB7XHJcbiAgICAgIGNvbG9yOiAjZmZmO1xyXG4gICAgfVxyXG5cclxuICAgIC5oYXMtdW5yZWFkIC5jb252LXByZXZpZXcge1xyXG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjkpO1xyXG4gICAgICBmb250LXdlaWdodDogNTAwO1xyXG4gICAgfVxyXG5cclxuICAgIC51bnJlYWQtYmFkZ2Uge1xyXG4gICAgICBiYWNrZ3JvdW5kOiAjMWE1ZmE4O1xyXG4gICAgICBjb2xvcjogI2ZmZjtcclxuICAgICAgYm9yZGVyLXJhZGl1czogMTBweDtcclxuICAgICAgbWluLXdpZHRoOiAyMHB4O1xyXG4gICAgICBoZWlnaHQ6IDIwcHg7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTFweDtcclxuICAgICAgZm9udC13ZWlnaHQ6IDYwMDtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XHJcbiAgICAgIHBhZGRpbmc6IDAgNnB4O1xyXG4gICAgICBmbGV4LXNocmluazogMDtcclxuICAgIH1cclxuXHJcbiAgICAubWVudGlvbi1iYWRnZSB7XHJcbiAgICAgIHdpZHRoOiAyMHB4O1xyXG4gICAgICBoZWlnaHQ6IDIwcHg7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDk5OXB4O1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDEyNywgMTgwLCAyNTUsIDAuMik7XHJcbiAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHJnYmEoMTI3LCAxODAsIDI1NSwgMC41NSk7XHJcbiAgICAgIGNvbG9yOiAjYmZkYmZlO1xyXG4gICAgICBkaXNwbGF5OiBpbmxpbmUtZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTJweDtcclxuICAgICAgZm9udC13ZWlnaHQ6IDgwMDtcclxuICAgICAgZmxleC1zaHJpbms6IDA7XHJcbiAgICAgIG1hcmdpbi1sZWZ0OiA2cHg7XHJcbiAgICAgIGJveC1zaGFkb3c6IDAgMCAwIDJweCByZ2JhKDEyNywgMTgwLCAyNTUsIDAuMDYpO1xyXG4gICAgfVxyXG5cclxuICAgIC5lbXB0eS1zdGF0ZSB7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xyXG4gICAgICBwYWRkaW5nOiA0OHB4IDI0cHg7XHJcbiAgICAgIGNvbG9yOiAjOWNhM2FmO1xyXG4gICAgfVxyXG5cclxuICAgIC5lbXB0eS1zdGF0ZSBtYXQtaWNvbiB7XHJcbiAgICAgIGZvbnQtc2l6ZTogNDhweDtcclxuICAgICAgd2lkdGg6IDQ4cHg7XHJcbiAgICAgIGhlaWdodDogNDhweDtcclxuICAgICAgbWFyZ2luLWJvdHRvbTogMTJweDtcclxuICAgIH1cclxuXHJcbiAgICAuZW1wdHktc3RhdGUgcCB7XHJcbiAgICAgIG1hcmdpbjogMCAwIDE2cHg7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTRweDtcclxuICAgIH1cclxuXHJcbiAgICAuc2V0dGluZ3MtcGFuZWwge1xyXG4gICAgICBwYWRkaW5nOiAxNnB4O1xyXG4gICAgICBjb2xvcjogI2ZmZjtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcclxuICAgICAgZ2FwOiAxMnB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5zZXR0aW5ncy1jYXJkIHtcclxuICAgICAgYm9yZGVyLXJhZGl1czogMTRweDtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjA3KTtcclxuICAgICAgYm9yZGVyOiAxcHggc29saWQgcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjEyKTtcclxuICAgICAgcGFkZGluZzogMTZweDtcclxuICAgICAgYm94LXNoYWRvdzogMCAxMHB4IDI4cHggcmdiYSgwLCAwLCAwLCAwLjE4KTtcclxuICAgIH1cclxuXHJcbiAgICAuc2V0dGluZ3MtaGVhZGVyIHtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgZ2FwOiAxMnB4O1xyXG4gICAgICBhbGlnbi1pdGVtczogZmxleC1zdGFydDtcclxuICAgICAgbWFyZ2luLWJvdHRvbTogMTZweDtcclxuICAgIH1cclxuXHJcbiAgICAuc2V0dGluZ3MtaWNvbiB7XHJcbiAgICAgIHdpZHRoOiAzNnB4O1xyXG4gICAgICBoZWlnaHQ6IDM2cHg7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDEwcHg7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjYsIDk1LCAxNjgsIDAuMzUpO1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcclxuICAgICAgZmxleC1zaHJpbms6IDA7XHJcbiAgICB9XHJcblxyXG4gICAgLnNldHRpbmdzLWljb24gbWF0LWljb24ge1xyXG4gICAgICBjb2xvcjogI2JmZGJmZTtcclxuICAgIH1cclxuXHJcbiAgICAuc2V0dGluZ3MtaWNvbi5kaXNwbGF5LWljb24ge1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDEzNCwgMjM5LCAxNzIsIDAuMTQpO1xyXG4gICAgfVxyXG5cclxuICAgIC5zZXR0aW5ncy1pY29uLmRpc3BsYXktaWNvbiBtYXQtaWNvbiB7XHJcbiAgICAgIGNvbG9yOiAjYmJmN2QwO1xyXG4gICAgfVxyXG5cclxuICAgIC5zZXR0aW5ncy1oZWFkZXIgaDQge1xyXG4gICAgICBtYXJnaW46IDAgMCA0cHg7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTVweDtcclxuICAgICAgZm9udC13ZWlnaHQ6IDcwMDtcclxuICAgIH1cclxuXHJcbiAgICAuc2V0dGluZ3MtaGVhZGVyIHAge1xyXG4gICAgICBtYXJnaW46IDA7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNjUpO1xyXG4gICAgICBmb250LXNpemU6IDEycHg7XHJcbiAgICAgIGxpbmUtaGVpZ2h0OiAxLjQ7XHJcbiAgICB9XHJcblxyXG4gICAgLnNldHRpbmdzLXRvZ2dsZSB7XHJcbiAgICAgIHdpZHRoOiAxMDAlO1xyXG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcclxuICAgICAgYm9yZGVyLXJhZGl1czogMTBweDtcclxuICAgICAgY29sb3I6ICNmZmYgIWltcG9ydGFudDtcclxuICAgICAgYm9yZGVyLWNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMikgIWltcG9ydGFudDtcclxuICAgICAgbWFyZ2luLWJvdHRvbTogMTZweDtcclxuICAgIH1cclxuXHJcbiAgICAuc2V0dGluZ3MtdG9nZ2xlIG1hdC1pY29uIHtcclxuICAgICAgbWFyZ2luLXJpZ2h0OiA4cHg7XHJcbiAgICAgIGZvbnQtc2l6ZTogMThweDtcclxuICAgICAgd2lkdGg6IDE4cHg7XHJcbiAgICAgIGhlaWdodDogMThweDtcclxuICAgIH1cclxuXHJcbiAgICAudm9sdW1lLWxhYmVsIHtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAganVzdGlmeS1jb250ZW50OiBzcGFjZS1iZXR3ZWVuO1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjc4KTtcclxuICAgICAgZm9udC1zaXplOiAxMnB4O1xyXG4gICAgICBmb250LXdlaWdodDogNjAwO1xyXG4gICAgICBtYXJnaW4tYm90dG9tOiA4cHg7XHJcbiAgICB9XHJcblxyXG4gICAgLnNldHRpbmdzLXZvbHVtZSB7XHJcbiAgICAgIHdpZHRoOiAxMDAlO1xyXG4gICAgICBhY2NlbnQtY29sb3I6ICM3ZmI0ZmY7XHJcbiAgICAgIGN1cnNvcjogcG9pbnRlcjtcclxuICAgICAgbWFyZ2luLWJvdHRvbTogMTJweDtcclxuICAgIH1cclxuXHJcbiAgICAuc2V0dGluZ3MtcHJldmlldyB7XHJcbiAgICAgIG1hcmdpbjogMCAwIDE2cHg7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDEwcHg7XHJcbiAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xMik7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4wNik7XHJcbiAgICAgIGNvbG9yOiAjZjVmN2ZmO1xyXG4gICAgICBib3gtc2l6aW5nOiBib3JkZXItYm94O1xyXG4gICAgfVxyXG5cclxuICAgIC5tZXNzYWdlLXByZXZpZXcge1xyXG4gICAgICBwYWRkaW5nOiA5cHggMTFweDtcclxuICAgICAgbGluZS1oZWlnaHQ6IDEuMzU7XHJcbiAgICB9XHJcblxyXG4gICAgLmNvZGUtcHJldmlldyB7XHJcbiAgICAgIHBhZGRpbmc6IDEwcHggMTFweDtcclxuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcclxuICAgICAgZm9udC1mYW1pbHk6IHVpLW1vbm9zcGFjZSwgU0ZNb25vLVJlZ3VsYXIsIE1lbmxvLCBNb25hY28sIENvbnNvbGFzLCBcIkxpYmVyYXRpb24gTW9ub1wiLCBtb25vc3BhY2U7XHJcbiAgICAgIGxpbmUtaGVpZ2h0OiAxLjQ1O1xyXG4gICAgICB3aGl0ZS1zcGFjZTogcHJlLXdyYXA7XHJcbiAgICAgIGNvbG9yOiAjZGJlYWZlO1xyXG4gICAgICBiYWNrZ3JvdW5kOiAjMDYxODI3O1xyXG4gICAgICBtYXJnaW4tYm90dG9tOiAwO1xyXG4gICAgfVxyXG5cclxuICAgIC5jb250ZXh0LW1lbnUge1xyXG4gICAgICBwb3NpdGlvbjogZml4ZWQ7XHJcbiAgICAgIHotaW5kZXg6IDEwMDAxO1xyXG4gICAgICBiYWNrZ3JvdW5kOiAjMDcxZDMwO1xyXG4gICAgICBib3JkZXItcmFkaXVzOiA4cHg7XHJcbiAgICAgIHBhZGRpbmc6IDRweCAwO1xyXG4gICAgICBib3gtc2hhZG93OiAwIDhweCAyNHB4IHJnYmEoMCwgMCwgMCwgMC4zKTtcclxuICAgICAgbWluLXdpZHRoOiAyMDBweDtcclxuICAgIH1cclxuXHJcbiAgICAuY3R4LWl0ZW0ge1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBnYXA6IDEwcHg7XHJcbiAgICAgIHBhZGRpbmc6IDEwcHggMTZweDtcclxuICAgICAgY3Vyc29yOiBwb2ludGVyO1xyXG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjkpO1xyXG4gICAgICBmb250LXNpemU6IDEzcHg7XHJcbiAgICAgIHRyYW5zaXRpb246IGJhY2tncm91bmQgMC4xNXM7XHJcbiAgICB9XHJcblxyXG4gICAgLmN0eC1pdGVtOmhvdmVyIHtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjEpO1xyXG4gICAgfVxyXG5cclxuICAgIC5jdHgtaXRlbSBtYXQtaWNvbiB7XHJcbiAgICAgIGZvbnQtc2l6ZTogMThweDtcclxuICAgICAgd2lkdGg6IDE4cHg7XHJcbiAgICAgIGhlaWdodDogMThweDtcclxuICAgIH1cclxuXHJcbiAgICAuY3R4LWRhbmdlciB7XHJcbiAgICAgIGNvbG9yOiAjZjg3MTcxO1xyXG4gICAgfVxyXG5cclxuICAgIC5jdHgtZGFuZ2VyOmhvdmVyIHtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNDgsIDExMywgMTEzLCAwLjE1KTtcclxuICAgIH1cclxuXHJcbiAgICAuY3R4LWJhY2tkcm9wIHtcclxuICAgICAgcG9zaXRpb246IGZpeGVkO1xyXG4gICAgICBpbnNldDogMDtcclxuICAgICAgei1pbmRleDogMTAwMDA7XHJcbiAgICB9XHJcbiAgYF0sXHJcbn0pXHJcbmV4cG9ydCBjbGFzcyBJbmJveExpc3RDb21wb25lbnQgaW1wbGVtZW50cyBPbkluaXQsIE9uRGVzdHJveSB7XHJcbiAgaW5ib3g6IEluYm94SXRlbVtdID0gW107XHJcbiAgc2VhcmNoUXVlcnkgPSAnJztcclxuICBhY3RpdmVUYWI6ICdhbGwnIHwgJ2RpcmVjdCcgfCAnZ3JvdXBzJyB8ICdwcm9qZWN0cycgfCAnc2V0dGluZ3MnID0gJ2FsbCc7XHJcbiAgbm90aWZpY2F0aW9uVm9sdW1lID0gMC4zNTtcclxuICBub3RpZmljYXRpb25zTXV0ZWQgPSBmYWxzZTtcclxuICBtZXNzYWdlVGV4dFNjYWxlID0gMTtcclxuICBjb2RlVGV4dFNjYWxlID0gMTtcclxuICBjb250ZXh0TWVudTogeyB4OiBudW1iZXI7IHk6IG51bWJlcjsgaXRlbTogSW5ib3hJdGVtIH0gfCBudWxsID0gbnVsbDtcclxuICBwcml2YXRlIHJlYWRvbmx5IHRhYlN0b3JhZ2VLZXkgPSAnbWVzc2FnaW5nX2luYm94X2FjdGl2ZV90YWInO1xyXG4gIHByaXZhdGUgc3ViITogU3Vic2NyaXB0aW9uO1xyXG5cclxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHN0b3JlOiBNZXNzYWdpbmdTdG9yZVNlcnZpY2UpIHt9XHJcblxyXG4gIG5nT25Jbml0KCk6IHZvaWQge1xyXG4gICAgdGhpcy5hY3RpdmVUYWIgPSB0aGlzLmdldFNhdmVkVGFiKCk7XHJcbiAgICB0aGlzLnN1YiA9IG5ldyBTdWJzY3JpcHRpb24oKTtcclxuICAgIHRoaXMuc3ViLmFkZCh0aGlzLnN0b3JlLmluYm94LnN1YnNjcmliZSgoaXRlbXMpID0+ICh0aGlzLmluYm94ID0gaXRlbXMpKSk7XHJcbiAgICB0aGlzLnN1Yi5hZGQodGhpcy5zdG9yZS5ub3RpZmljYXRpb25Wb2x1bWUuc3Vic2NyaWJlKCh2b2x1bWUpID0+ICh0aGlzLm5vdGlmaWNhdGlvblZvbHVtZSA9IHZvbHVtZSkpKTtcclxuICAgIHRoaXMuc3ViLmFkZCh0aGlzLnN0b3JlLm5vdGlmaWNhdGlvbnNNdXRlZC5zdWJzY3JpYmUoKG11dGVkKSA9PiAodGhpcy5ub3RpZmljYXRpb25zTXV0ZWQgPSBtdXRlZCkpKTtcclxuICAgIHRoaXMuc3ViLmFkZCh0aGlzLnN0b3JlLm1lc3NhZ2VUZXh0U2NhbGUuc3Vic2NyaWJlKChzY2FsZSkgPT4gKHRoaXMubWVzc2FnZVRleHRTY2FsZSA9IHNjYWxlKSkpO1xyXG4gICAgdGhpcy5zdWIuYWRkKHRoaXMuc3RvcmUuY29kZVRleHRTY2FsZS5zdWJzY3JpYmUoKHNjYWxlKSA9PiAodGhpcy5jb2RlVGV4dFNjYWxlID0gc2NhbGUpKSk7XHJcbiAgfVxyXG5cclxuICBuZ09uRGVzdHJveSgpOiB2b2lkIHtcclxuICAgIHRoaXMuc3ViPy51bnN1YnNjcmliZSgpO1xyXG4gIH1cclxuXHJcbiAgZ2V0IGZpbHRlcmVkSW5ib3goKTogSW5ib3hJdGVtW10ge1xyXG4gICAgaWYgKHRoaXMuYWN0aXZlVGFiID09PSAnc2V0dGluZ3MnKSByZXR1cm4gW107XHJcbiAgICBjb25zdCB0YWJiZWQgPSB0aGlzLmluYm94LmZpbHRlcigoaXRlbSkgPT4ge1xyXG4gICAgICBjb25zdCBwcm9qZWN0ID0gdGhpcy5pc1Byb2plY3QoaXRlbSk7XHJcbiAgICAgIGlmICh0aGlzLmFjdGl2ZVRhYiA9PT0gJ2RpcmVjdCcpIHJldHVybiAhaXRlbS5pc19ncm91cDtcclxuICAgICAgaWYgKHRoaXMuYWN0aXZlVGFiID09PSAnZ3JvdXBzJykgcmV0dXJuIGl0ZW0uaXNfZ3JvdXAgJiYgIXByb2plY3Q7XHJcbiAgICAgIGlmICh0aGlzLmFjdGl2ZVRhYiA9PT0gJ3Byb2plY3RzJykgcmV0dXJuIHByb2plY3Q7XHJcbiAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgfSk7XHJcbiAgICBpZiAoIXRoaXMuc2VhcmNoUXVlcnkudHJpbSgpKSByZXR1cm4gdGFiYmVkO1xyXG4gICAgY29uc3QgcSA9IHRoaXMuc2VhcmNoUXVlcnkudG9Mb3dlckNhc2UoKTtcclxuICAgIHJldHVybiB0YWJiZWQuZmlsdGVyKFxyXG4gICAgICAoaXRlbSkgPT5cclxuICAgICAgICAoaXRlbS5uYW1lIHx8ICcnKS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKHEpIHx8XHJcbiAgICAgICAgKGl0ZW0ubGFzdF9tZXNzYWdlX3ByZXZpZXcgfHwgJycpLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMocSlcclxuICAgICk7XHJcbiAgfVxyXG5cclxuICBnZXQgZW1wdHlTdGF0ZVRleHQoKTogc3RyaW5nIHtcclxuICAgIGlmICh0aGlzLnNlYXJjaFF1ZXJ5LnRyaW0oKSkgcmV0dXJuICdObyBtYXRjaGluZyBjb252ZXJzYXRpb25zJztcclxuICAgIGlmICh0aGlzLmFjdGl2ZVRhYiA9PT0gJ2RpcmVjdCcpIHJldHVybiAnTm8gY2hhdHMgeWV0JztcclxuICAgIGlmICh0aGlzLmFjdGl2ZVRhYiA9PT0gJ2dyb3VwcycpIHJldHVybiAnTm8gZ3JvdXBzIHlldCc7XHJcbiAgICBpZiAodGhpcy5hY3RpdmVUYWIgPT09ICdwcm9qZWN0cycpIHJldHVybiAnTm8gcHJvamVjdCBjaGF0cyB5ZXQnO1xyXG4gICAgcmV0dXJuICdObyBjb252ZXJzYXRpb25zIHlldCc7XHJcbiAgfVxyXG5cclxuICBpc1Byb2plY3QoaXRlbTogSW5ib3hJdGVtKTogYm9vbGVhbiB7XHJcbiAgICByZXR1cm4gaXNQcm9qZWN0Q29udmVyc2F0aW9uKGl0ZW0pO1xyXG4gIH1cclxuXHJcbiAgc2V0QWN0aXZlVGFiKHRhYjogJ2FsbCcgfCAnZGlyZWN0JyB8ICdncm91cHMnIHwgJ3Byb2plY3RzJyB8ICdzZXR0aW5ncycpOiB2b2lkIHtcclxuICAgIHRoaXMuYWN0aXZlVGFiID0gdGFiO1xyXG4gICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0odGhpcy50YWJTdG9yYWdlS2V5LCB0YWIpO1xyXG4gICAgdGhpcy5jb250ZXh0TWVudSA9IG51bGw7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGdldFNhdmVkVGFiKCk6ICdhbGwnIHwgJ2RpcmVjdCcgfCAnZ3JvdXBzJyB8ICdwcm9qZWN0cycgfCAnc2V0dGluZ3MnIHtcclxuICAgIGNvbnN0IHNhdmVkID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0odGhpcy50YWJTdG9yYWdlS2V5KTtcclxuICAgIHJldHVybiBzYXZlZCA9PT0gJ2RpcmVjdCcgfHwgc2F2ZWQgPT09ICdncm91cHMnIHx8IHNhdmVkID09PSAncHJvamVjdHMnIHx8IHNhdmVkID09PSAnc2V0dGluZ3MnIHx8IHNhdmVkID09PSAnYWxsJ1xyXG4gICAgICA/IHNhdmVkXHJcbiAgICAgIDogJ2FsbCc7XHJcbiAgfVxyXG5cclxuICB0b2dnbGVOb3RpZmljYXRpb25zTXV0ZWQoKTogdm9pZCB7XHJcbiAgICBjb25zdCBuZXh0TXV0ZWQgPSAhdGhpcy5ub3RpZmljYXRpb25zTXV0ZWQ7XHJcbiAgICB0aGlzLnN0b3JlLnNldE5vdGlmaWNhdGlvbnNNdXRlZChuZXh0TXV0ZWQpO1xyXG4gICAgaWYgKCFuZXh0TXV0ZWQgJiYgdGhpcy5ub3RpZmljYXRpb25Wb2x1bWUgPiAwKSB7XHJcbiAgICAgIHRoaXMuc3RvcmUudGVzdE5vdGlmaWNhdGlvblNvdW5kKCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBvbk5vdGlmaWNhdGlvblZvbHVtZUNoYW5nZSh2YWx1ZTogbnVtYmVyIHwgc3RyaW5nKTogdm9pZCB7XHJcbiAgICB0aGlzLnN0b3JlLnNldE5vdGlmaWNhdGlvblZvbHVtZShOdW1iZXIodmFsdWUpKTtcclxuICB9XHJcblxyXG4gIHByZXZpZXdOb3RpZmljYXRpb25Tb3VuZCgpOiB2b2lkIHtcclxuICAgIGlmICghdGhpcy5ub3RpZmljYXRpb25zTXV0ZWQgJiYgdGhpcy5ub3RpZmljYXRpb25Wb2x1bWUgPiAwKSB7XHJcbiAgICAgIHRoaXMuc3RvcmUudGVzdE5vdGlmaWNhdGlvblNvdW5kKCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBvbk1lc3NhZ2VUZXh0U2NhbGVDaGFuZ2UodmFsdWU6IG51bWJlciB8IHN0cmluZyk6IHZvaWQge1xyXG4gICAgdGhpcy5zdG9yZS5zZXRNZXNzYWdlVGV4dFNjYWxlKE51bWJlcih2YWx1ZSkpO1xyXG4gIH1cclxuXHJcbiAgb25Db2RlVGV4dFNjYWxlQ2hhbmdlKHZhbHVlOiBudW1iZXIgfCBzdHJpbmcpOiB2b2lkIHtcclxuICAgIHRoaXMuc3RvcmUuc2V0Q29kZVRleHRTY2FsZShOdW1iZXIodmFsdWUpKTtcclxuICB9XHJcblxyXG4gIG9wZW5Db252ZXJzYXRpb24oaXRlbTogSW5ib3hJdGVtKTogdm9pZCB7XHJcbiAgICB0aGlzLnN0b3JlLm9wZW5Db252ZXJzYXRpb24oaXRlbS5jb252ZXJzYXRpb25faWQsIGl0ZW0ubmFtZSB8fCAnQ2hhdCcsIGl0ZW0uaXNfZ3JvdXAsIHRoaXMuaXNQcm9qZWN0KGl0ZW0pKTtcclxuICB9XHJcblxyXG4gIG9uTmV3Q29udmVyc2F0aW9uKCk6IHZvaWQge1xyXG4gICAgdGhpcy5zdG9yZS5zZXRWaWV3KCduZXctY29udmVyc2F0aW9uJyk7XHJcbiAgfVxyXG5cclxuICBvbkNyZWF0ZUdyb3VwKCk6IHZvaWQge1xyXG4gICAgdGhpcy5zdG9yZS5zZXRWaWV3KCdncm91cC1tYW5hZ2VyJyk7XHJcbiAgfVxyXG5cclxuICBvbkNvbnRleHRNZW51KGV2ZW50OiBNb3VzZUV2ZW50LCBpdGVtOiBJbmJveEl0ZW0pOiB2b2lkIHtcclxuICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcclxuICAgIHRoaXMuY29udGV4dE1lbnUgPSB7IHg6IGV2ZW50LmNsaWVudFgsIHk6IGV2ZW50LmNsaWVudFksIGl0ZW0gfTtcclxuICB9XHJcblxyXG4gIGNsb3NlQ29udGV4dE1lbnUoKTogdm9pZCB7XHJcbiAgICB0aGlzLmNvbnRleHRNZW51ID0gbnVsbDtcclxuICB9XHJcblxyXG4gIGNsZWFyQ2hhdCgpOiB2b2lkIHtcclxuICAgIGlmICghdGhpcy5jb250ZXh0TWVudSkgcmV0dXJuO1xyXG4gICAgY29uc3QgaWQgPSB0aGlzLmNvbnRleHRNZW51Lml0ZW0uY29udmVyc2F0aW9uX2lkO1xyXG4gICAgdGhpcy5zdG9yZS5jbGVhckNvbnZlcnNhdGlvbihpZCk7XHJcbiAgICB0aGlzLmNvbnRleHRNZW51ID0gbnVsbDtcclxuICB9XHJcblxyXG4gIGRlbGV0ZUNoYXQoKTogdm9pZCB7XHJcbiAgICBpZiAoIXRoaXMuY29udGV4dE1lbnUpIHJldHVybjtcclxuICAgIGNvbnN0IGl0ZW0gPSB0aGlzLmNvbnRleHRNZW51Lml0ZW07XHJcbiAgICBpZiAoaXRlbS5pc19ncm91cCkge1xyXG4gICAgICB0aGlzLnN0b3JlLmRlbGV0ZUdyb3VwKGl0ZW0uY29udmVyc2F0aW9uX2lkKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHRoaXMuc3RvcmUuZGVsZXRlQ29udmVyc2F0aW9uKGl0ZW0uY29udmVyc2F0aW9uX2lkKTtcclxuICAgIH1cclxuICAgIHRoaXMuY29udGV4dE1lbnUgPSBudWxsO1xyXG4gIH1cclxuXHJcbiAgZm9ybWF0VGltZShkYXRlU3RyOiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gICAgaWYgKCFkYXRlU3RyKSByZXR1cm4gJyc7XHJcbiAgICBjb25zdCBkYXRlID0gbmV3IERhdGUoZGF0ZVN0cik7XHJcbiAgICBjb25zdCBub3cgPSBuZXcgRGF0ZSgpO1xyXG4gICAgY29uc3QgZGlmZk1zID0gbm93LmdldFRpbWUoKSAtIGRhdGUuZ2V0VGltZSgpO1xyXG4gICAgY29uc3QgZGlmZk1pbnMgPSBNYXRoLmZsb29yKGRpZmZNcyAvIDYwMDAwKTtcclxuICAgIGNvbnN0IGRpZmZIb3VycyA9IE1hdGguZmxvb3IoZGlmZk1zIC8gMzYwMDAwMCk7XHJcbiAgICBjb25zdCBkaWZmRGF5cyA9IE1hdGguZmxvb3IoZGlmZk1zIC8gODY0MDAwMDApO1xyXG5cclxuICAgIGlmIChkaWZmTWlucyA8IDEpIHJldHVybiAnbm93JztcclxuICAgIGlmIChkaWZmTWlucyA8IDYwKSByZXR1cm4gYCR7ZGlmZk1pbnN9bWA7XHJcbiAgICBpZiAoZGlmZkhvdXJzIDwgMjQpIHJldHVybiBgJHtkaWZmSG91cnN9aGA7XHJcbiAgICBpZiAoZGlmZkRheXMgPCA3KSByZXR1cm4gYCR7ZGlmZkRheXN9ZGA7XHJcblxyXG4gICAgcmV0dXJuIGRhdGUudG9Mb2NhbGVEYXRlU3RyaW5nKCdlbi1HQicsIHsgZGF5OiAnbnVtZXJpYycsIG1vbnRoOiAnc2hvcnQnIH0pO1xyXG4gIH1cclxufVxyXG4iXX0=