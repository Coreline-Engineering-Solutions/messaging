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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5ib3gtbGlzdC5jb21wb25lbnQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvbGliL2NvbXBvbmVudHMvaW5ib3gtbGlzdC9pbmJveC1saXN0LmNvbXBvbmVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsU0FBUyxFQUFxQixNQUFNLGVBQWUsQ0FBQztBQUM3RCxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDL0MsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLGdCQUFnQixDQUFDO0FBQzdDLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSx3QkFBd0IsQ0FBQztBQUN2RCxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFDM0QsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHdCQUF3QixDQUFDO0FBQ3pELE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBQzdELE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxNQUFNLENBQUM7QUFFcEMsT0FBTyxFQUFhLHFCQUFxQixFQUFFLE1BQU0sK0JBQStCLENBQUM7Ozs7Ozs7OztBQXFwQmpGLE1BQU0sT0FBTyxrQkFBa0I7SUFZVDtJQVhwQixLQUFLLEdBQWdCLEVBQUUsQ0FBQztJQUN4QixXQUFXLEdBQUcsRUFBRSxDQUFDO0lBQ2pCLFNBQVMsR0FBMEQsS0FBSyxDQUFDO0lBQ3pFLGtCQUFrQixHQUFHLElBQUksQ0FBQztJQUMxQixrQkFBa0IsR0FBRyxLQUFLLENBQUM7SUFDM0IsZ0JBQWdCLEdBQUcsQ0FBQyxDQUFDO0lBQ3JCLGFBQWEsR0FBRyxDQUFDLENBQUM7SUFDbEIsV0FBVyxHQUFxRCxJQUFJLENBQUM7SUFDcEQsYUFBYSxHQUFHLDRCQUE0QixDQUFDO0lBQ3RELEdBQUcsQ0FBZ0I7SUFFM0IsWUFBb0IsS0FBNEI7UUFBNUIsVUFBSyxHQUFMLEtBQUssQ0FBdUI7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NEZBZ3BCM0Ysa0JBQWtCO2tCQW5wQjlCLFNBQVM7K0JBQ0UsZ0JBQWdCLGNBQ2QsSUFBSSxXQUNQLENBQUMsWUFBWSxFQUFFLFdBQVcsRUFBRSxhQUFhLEVBQUUsZUFBZSxFQUFFLGVBQWUsRUFBRSxnQkFBZ0IsQ0FBQyxZQUM3Rjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBMk5UIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQ29tcG9uZW50LCBPbkluaXQsIE9uRGVzdHJveSB9IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xyXG5pbXBvcnQgeyBDb21tb25Nb2R1bGUgfSBmcm9tICdAYW5ndWxhci9jb21tb24nO1xyXG5pbXBvcnQgeyBGb3Jtc01vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL2Zvcm1zJztcclxuaW1wb3J0IHsgTWF0SWNvbk1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL21hdGVyaWFsL2ljb24nO1xyXG5pbXBvcnQgeyBNYXRCdXR0b25Nb2R1bGUgfSBmcm9tICdAYW5ndWxhci9tYXRlcmlhbC9idXR0b24nO1xyXG5pbXBvcnQgeyBNYXRSaXBwbGVNb2R1bGUgfSBmcm9tICdAYW5ndWxhci9tYXRlcmlhbC9jb3JlJztcclxuaW1wb3J0IHsgTWF0VG9vbHRpcE1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL21hdGVyaWFsL3Rvb2x0aXAnO1xyXG5pbXBvcnQgeyBTdWJzY3JpcHRpb24gfSBmcm9tICdyeGpzJztcclxuaW1wb3J0IHsgTWVzc2FnaW5nU3RvcmVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvbWVzc2FnaW5nLXN0b3JlLnNlcnZpY2UnO1xyXG5pbXBvcnQgeyBJbmJveEl0ZW0sIGlzUHJvamVjdENvbnZlcnNhdGlvbiB9IGZyb20gJy4uLy4uL21vZGVscy9tZXNzYWdpbmcubW9kZWxzJztcclxuXHJcbkBDb21wb25lbnQoe1xyXG4gIHNlbGVjdG9yOiAnYXBwLWluYm94LWxpc3QnLFxyXG4gIHN0YW5kYWxvbmU6IHRydWUsXHJcbiAgaW1wb3J0czogW0NvbW1vbk1vZHVsZSwgRm9ybXNNb2R1bGUsIE1hdEljb25Nb2R1bGUsIE1hdEJ1dHRvbk1vZHVsZSwgTWF0UmlwcGxlTW9kdWxlLCBNYXRUb29sdGlwTW9kdWxlXSxcclxuICB0ZW1wbGF0ZTogYFxyXG4gICAgPGRpdiBjbGFzcz1cImluYm94LWNvbnRhaW5lclwiPlxyXG4gICAgICA8ZGl2ICpuZ0lmPVwiYWN0aXZlVGFiICE9PSAnc2V0dGluZ3MnXCIgY2xhc3M9XCJzZWFyY2gtYmFyXCI+XHJcbiAgICAgICAgPG1hdC1pY29uIGNsYXNzPVwic2VhcmNoLWljb25cIj5zZWFyY2g8L21hdC1pY29uPlxyXG4gICAgICAgIDxpbnB1dFxyXG4gICAgICAgICAgdHlwZT1cInRleHRcIlxyXG4gICAgICAgICAgWyhuZ01vZGVsKV09XCJzZWFyY2hRdWVyeVwiXHJcbiAgICAgICAgICBwbGFjZWhvbGRlcj1cIlNlYXJjaCBjb252ZXJzYXRpb25zLi4uXCJcclxuICAgICAgICAgIGNsYXNzPVwic2VhcmNoLWlucHV0XCJcclxuICAgICAgICAvPlxyXG4gICAgICA8L2Rpdj5cclxuXHJcbiAgICAgIDxkaXYgY2xhc3M9XCJjb252ZXJzYXRpb24tbGlzdFwiPlxyXG4gICAgICAgIDxkaXZcclxuICAgICAgICAgICpuZ0Zvcj1cImxldCBpdGVtIG9mIGZpbHRlcmVkSW5ib3hcIlxyXG4gICAgICAgICAgY2xhc3M9XCJjb252ZXJzYXRpb24taXRlbVwiXHJcbiAgICAgICAgICBtYXRSaXBwbGVcclxuICAgICAgICAgIFtjbGFzcy5oYXMtdW5yZWFkXT1cIml0ZW0udW5yZWFkX2NvdW50ID4gMFwiXHJcbiAgICAgICAgICAoY2xpY2spPVwib3BlbkNvbnZlcnNhdGlvbihpdGVtKVwiXHJcbiAgICAgICAgICAoY29udGV4dG1lbnUpPVwib25Db250ZXh0TWVudSgkZXZlbnQsIGl0ZW0pXCJcclxuICAgICAgICA+XHJcbiAgICAgICAgICA8ZGl2XHJcbiAgICAgICAgICAgIGNsYXNzPVwiYXZhdGFyXCJcclxuICAgICAgICAgICAgW2NsYXNzLmdyb3VwLWF2YXRhcl09XCJpdGVtLmlzX2dyb3VwICYmICFpc1Byb2plY3QoaXRlbSlcIlxyXG4gICAgICAgICAgICBbY2xhc3MucHJvamVjdC1hdmF0YXJdPVwiaXNQcm9qZWN0KGl0ZW0pXCJcclxuICAgICAgICAgID5cclxuICAgICAgICAgICAgPG1hdC1pY29uPnt7IGlzUHJvamVjdChpdGVtKSA/ICd3b3Jrc3BhY2VzJyA6IGl0ZW0uaXNfZ3JvdXAgPyAnZ3JvdXAnIDogJ3BlcnNvbicgfX08L21hdC1pY29uPlxyXG4gICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICA8ZGl2IGNsYXNzPVwiY29udmVyc2F0aW9uLWluZm9cIj5cclxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cImluZm8tdG9wXCI+XHJcbiAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJjb252LW5hbWVcIj57eyBpdGVtLm5hbWUgfHwgJ0RpcmVjdCBNZXNzYWdlJyB9fTwvc3Bhbj5cclxuICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cImNvbnYtdGltZVwiPnt7IGZvcm1hdFRpbWUoaXRlbS5sYXN0X21lc3NhZ2VfYXQpIH19PC9zcGFuPlxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cImluZm8tYm90dG9tXCI+XHJcbiAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJjb252LXByZXZpZXdcIj57eyBpdGVtLmxhc3RfbWVzc2FnZV9wcmV2aWV3IHx8ICdObyBtZXNzYWdlcyB5ZXQnIH19PC9zcGFuPlxyXG4gICAgICAgICAgICAgIDxzcGFuXHJcbiAgICAgICAgICAgICAgICAqbmdJZj1cIml0ZW0uaGFzX21lbnRpb25cIlxyXG4gICAgICAgICAgICAgICAgY2xhc3M9XCJtZW50aW9uLWJhZGdlXCJcclxuICAgICAgICAgICAgICAgIG1hdFRvb2x0aXA9XCJZb3Ugd2VyZSBtZW50aW9uZWRcIlxyXG4gICAgICAgICAgICAgICAgbWF0VG9vbHRpcFBvc2l0aW9uPVwiYWJvdmVcIlxyXG4gICAgICAgICAgICAgID4mIzY0Ozwvc3Bhbj5cclxuICAgICAgICAgICAgICA8c3BhbiAqbmdJZj1cIml0ZW0udW5yZWFkX2NvdW50ID4gMFwiIGNsYXNzPVwidW5yZWFkLWJhZGdlXCI+XHJcbiAgICAgICAgICAgICAgICB7eyBpdGVtLnVucmVhZF9jb3VudCA+IDk5ID8gJzk5KycgOiBpdGVtLnVucmVhZF9jb3VudCB9fVxyXG4gICAgICAgICAgICAgIDwvc3Bhbj5cclxuICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgPGRpdiAqbmdJZj1cImZpbHRlcmVkSW5ib3gubGVuZ3RoID09PSAwICYmIGFjdGl2ZVRhYiAhPT0gJ3NldHRpbmdzJ1wiIGNsYXNzPVwiZW1wdHktc3RhdGVcIj5cclxuICAgICAgICAgIDxtYXQtaWNvbj57eyBhY3RpdmVUYWIgPT09ICdwcm9qZWN0cycgPyAnd29ya3NwYWNlcycgOiBhY3RpdmVUYWIgPT09ICdncm91cHMnID8gJ2dyb3VwJyA6ICdmb3J1bScgfX08L21hdC1pY29uPlxyXG4gICAgICAgICAgPHA+e3sgZW1wdHlTdGF0ZVRleHQgfX08L3A+XHJcbiAgICAgICAgICA8YnV0dG9uICpuZ0lmPVwiIXNlYXJjaFF1ZXJ5ICYmIGFjdGl2ZVRhYiAhPT0gJ2dyb3VwcycgJiYgYWN0aXZlVGFiICE9PSAncHJvamVjdHMnXCIgbWF0LXN0cm9rZWQtYnV0dG9uIGNvbG9yPVwicHJpbWFyeVwiIChjbGljayk9XCJvbk5ld0NvbnZlcnNhdGlvbigpXCI+XHJcbiAgICAgICAgICAgIFN0YXJ0IGEgY29udmVyc2F0aW9uXHJcbiAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgIDxidXR0b24gKm5nSWY9XCIhc2VhcmNoUXVlcnkgJiYgYWN0aXZlVGFiID09PSAnZ3JvdXBzJ1wiIG1hdC1zdHJva2VkLWJ1dHRvbiBjb2xvcj1cInByaW1hcnlcIiAoY2xpY2spPVwib25DcmVhdGVHcm91cCgpXCI+XHJcbiAgICAgICAgICAgIENyZWF0ZSBhIGdyb3VwXHJcbiAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgPGRpdiAqbmdJZj1cImFjdGl2ZVRhYiA9PT0gJ3NldHRpbmdzJ1wiIGNsYXNzPVwic2V0dGluZ3MtcGFuZWxcIj5cclxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJzZXR0aW5ncy1jYXJkXCI+XHJcbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJzZXR0aW5ncy1oZWFkZXJcIj5cclxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwic2V0dGluZ3MtaWNvblwiPlxyXG4gICAgICAgICAgICAgICAgPG1hdC1pY29uPnt7IG5vdGlmaWNhdGlvbnNNdXRlZCB8fCBub3RpZmljYXRpb25Wb2x1bWUgPD0gMCA/ICd2b2x1bWVfb2ZmJyA6ICd2b2x1bWVfdXAnIH19PC9tYXQtaWNvbj5cclxuICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICA8ZGl2PlxyXG4gICAgICAgICAgICAgICAgPGg0Pk5vdGlmaWNhdGlvbiBTb3VuZDwvaDQ+XHJcbiAgICAgICAgICAgICAgICA8cD5Db250cm9sIG1lc3NhZ2UgYWxlcnRzIGZvciB0aGlzIGJyb3dzZXIuPC9wPlxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgICAgIDxidXR0b25cclxuICAgICAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcclxuICAgICAgICAgICAgICBtYXQtc3Ryb2tlZC1idXR0b25cclxuICAgICAgICAgICAgICBjbGFzcz1cInNldHRpbmdzLXRvZ2dsZVwiXHJcbiAgICAgICAgICAgICAgKGNsaWNrKT1cInRvZ2dsZU5vdGlmaWNhdGlvbnNNdXRlZCgpXCJcclxuICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgIDxtYXQtaWNvbj57eyBub3RpZmljYXRpb25zTXV0ZWQgPyAndm9sdW1lX3VwJyA6ICd2b2x1bWVfb2ZmJyB9fTwvbWF0LWljb24+XHJcbiAgICAgICAgICAgICAge3sgbm90aWZpY2F0aW9uc011dGVkID8gJ1VubXV0ZSBub3RpZmljYXRpb25zJyA6ICdNdXRlIG5vdGlmaWNhdGlvbnMnIH19XHJcbiAgICAgICAgICAgIDwvYnV0dG9uPlxyXG5cclxuICAgICAgICAgICAgPGxhYmVsIGNsYXNzPVwidm9sdW1lLWxhYmVsXCIgZm9yPVwibWVzc2FnaW5nLXZvbHVtZS1zbGlkZXJcIj5cclxuICAgICAgICAgICAgICBWb2x1bWVcclxuICAgICAgICAgICAgICA8c3Bhbj57eyAobm90aWZpY2F0aW9uVm9sdW1lICogMTAwKSB8IG51bWJlcjonMS4wLTAnIH19JTwvc3Bhbj5cclxuICAgICAgICAgICAgPC9sYWJlbD5cclxuICAgICAgICAgICAgPGlucHV0XHJcbiAgICAgICAgICAgICAgaWQ9XCJtZXNzYWdpbmctdm9sdW1lLXNsaWRlclwiXHJcbiAgICAgICAgICAgICAgdHlwZT1cInJhbmdlXCJcclxuICAgICAgICAgICAgICBtaW49XCIwXCJcclxuICAgICAgICAgICAgICBtYXg9XCIxXCJcclxuICAgICAgICAgICAgICBzdGVwPVwiMC4wNVwiXHJcbiAgICAgICAgICAgICAgY2xhc3M9XCJzZXR0aW5ncy12b2x1bWVcIlxyXG4gICAgICAgICAgICAgIFsobmdNb2RlbCldPVwibm90aWZpY2F0aW9uVm9sdW1lXCJcclxuICAgICAgICAgICAgICAobmdNb2RlbENoYW5nZSk9XCJvbk5vdGlmaWNhdGlvblZvbHVtZUNoYW5nZSgkZXZlbnQpXCJcclxuICAgICAgICAgICAgICAoY2hhbmdlKT1cInByZXZpZXdOb3RpZmljYXRpb25Tb3VuZCgpXCJcclxuICAgICAgICAgICAgLz5cclxuICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJzZXR0aW5ncy1jYXJkXCI+XHJcbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJzZXR0aW5ncy1oZWFkZXJcIj5cclxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwic2V0dGluZ3MtaWNvbiBkaXNwbGF5LWljb25cIj5cclxuICAgICAgICAgICAgICAgIDxtYXQtaWNvbj50ZXh0X2ZpZWxkczwvbWF0LWljb24+XHJcbiAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgPGRpdj5cclxuICAgICAgICAgICAgICAgIDxoND5EaXNwbGF5IFNpemU8L2g0PlxyXG4gICAgICAgICAgICAgICAgPHA+QWRqdXN0IG1lc3NhZ2UgdGV4dCBhbmQgcHJvZ3JhbW1pbmcgYmxvY2sgc2l6ZXMuPC9wPlxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgICAgIDxsYWJlbCBjbGFzcz1cInZvbHVtZS1sYWJlbFwiIGZvcj1cIm1lc3NhZ2luZy1tZXNzYWdlLXNpemUtc2xpZGVyXCI+XHJcbiAgICAgICAgICAgICAgTWVzc2FnZSBzaXplXHJcbiAgICAgICAgICAgICAgPHNwYW4+e3sgKG1lc3NhZ2VUZXh0U2NhbGUgKiAxMDApIHwgbnVtYmVyOicxLjAtMCcgfX0lPC9zcGFuPlxyXG4gICAgICAgICAgICA8L2xhYmVsPlxyXG4gICAgICAgICAgICA8aW5wdXRcclxuICAgICAgICAgICAgICBpZD1cIm1lc3NhZ2luZy1tZXNzYWdlLXNpemUtc2xpZGVyXCJcclxuICAgICAgICAgICAgICB0eXBlPVwicmFuZ2VcIlxyXG4gICAgICAgICAgICAgIG1pbj1cIjAuOFwiXHJcbiAgICAgICAgICAgICAgbWF4PVwiMS41XCJcclxuICAgICAgICAgICAgICBzdGVwPVwiMC4wNVwiXHJcbiAgICAgICAgICAgICAgY2xhc3M9XCJzZXR0aW5ncy12b2x1bWVcIlxyXG4gICAgICAgICAgICAgIFsobmdNb2RlbCldPVwibWVzc2FnZVRleHRTY2FsZVwiXHJcbiAgICAgICAgICAgICAgKG5nTW9kZWxDaGFuZ2UpPVwib25NZXNzYWdlVGV4dFNjYWxlQ2hhbmdlKCRldmVudClcIlxyXG4gICAgICAgICAgICAvPlxyXG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwic2V0dGluZ3MtcHJldmlldyBtZXNzYWdlLXByZXZpZXdcIiBbc3R5bGUuZm9udC1zaXplLnB4XT1cIjEzICogbWVzc2FnZVRleHRTY2FsZVwiPlxyXG4gICAgICAgICAgICAgIFRoaXMgaXMgaG93IG5vcm1hbCBtZXNzYWdlIHRleHQgd2lsbCBhcHBlYXIgaW4gY2hhdC5cclxuICAgICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgICA8bGFiZWwgY2xhc3M9XCJ2b2x1bWUtbGFiZWxcIiBmb3I9XCJtZXNzYWdpbmctY29kZS1zaXplLXNsaWRlclwiPlxyXG4gICAgICAgICAgICAgIFByb2dyYW1taW5nIHNpemVcclxuICAgICAgICAgICAgICA8c3Bhbj57eyAoY29kZVRleHRTY2FsZSAqIDEwMCkgfCBudW1iZXI6JzEuMC0wJyB9fSU8L3NwYW4+XHJcbiAgICAgICAgICAgIDwvbGFiZWw+XHJcbiAgICAgICAgICAgIDxpbnB1dFxyXG4gICAgICAgICAgICAgIGlkPVwibWVzc2FnaW5nLWNvZGUtc2l6ZS1zbGlkZXJcIlxyXG4gICAgICAgICAgICAgIHR5cGU9XCJyYW5nZVwiXHJcbiAgICAgICAgICAgICAgbWluPVwiMC44XCJcclxuICAgICAgICAgICAgICBtYXg9XCIxLjVcIlxyXG4gICAgICAgICAgICAgIHN0ZXA9XCIwLjA1XCJcclxuICAgICAgICAgICAgICBjbGFzcz1cInNldHRpbmdzLXZvbHVtZVwiXHJcbiAgICAgICAgICAgICAgWyhuZ01vZGVsKV09XCJjb2RlVGV4dFNjYWxlXCJcclxuICAgICAgICAgICAgICAobmdNb2RlbENoYW5nZSk9XCJvbkNvZGVUZXh0U2NhbGVDaGFuZ2UoJGV2ZW50KVwiXHJcbiAgICAgICAgICAgIC8+XHJcbiAgICAgICAgICAgIDxwcmUgY2xhc3M9XCJzZXR0aW5ncy1wcmV2aWV3IGNvZGUtcHJldmlld1wiIFtzdHlsZS5mb250LXNpemUucHhdPVwiMTIgKiBjb2RlVGV4dFNjYWxlXCI+PGNvZGU+U0VMRUNUIHRpY2tldF9yZWYsIHN0YXR1c1xyXG5GUk9NIGxvZ2dpbmcudGlja2V0XHJcbldIRVJFIHN0YXR1cyA9ICdPcGVuJzs8L2NvZGU+PC9wcmU+XHJcbiAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICA8L2Rpdj5cclxuICAgICAgPC9kaXY+XHJcblxyXG4gICAgICA8ZGl2IGNsYXNzPVwiaW5ib3gtdGFic1wiIHJvbGU9XCJ0YWJsaXN0XCIgYXJpYS1sYWJlbD1cIkNvbnZlcnNhdGlvbiBmaWx0ZXJzXCI+XHJcbiAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgdHlwZT1cImJ1dHRvblwiXHJcbiAgICAgICAgICBjbGFzcz1cImluYm94LXRhYlwiXHJcbiAgICAgICAgICBbY2xhc3MuYWN0aXZlXT1cImFjdGl2ZVRhYiA9PT0gJ2FsbCdcIlxyXG4gICAgICAgICAgKGNsaWNrKT1cInNldEFjdGl2ZVRhYignYWxsJylcIlxyXG4gICAgICAgICAgbWF0VG9vbHRpcD1cIkFsbFwiXHJcbiAgICAgICAgICBtYXRUb29sdGlwUG9zaXRpb249XCJhYm92ZVwiXHJcbiAgICAgICAgPlxyXG4gICAgICAgICAgPG1hdC1pY29uPmZvcnVtPC9tYXQtaWNvbj5cclxuICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICA8YnV0dG9uXHJcbiAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcclxuICAgICAgICAgIGNsYXNzPVwiaW5ib3gtdGFiXCJcclxuICAgICAgICAgIFtjbGFzcy5hY3RpdmVdPVwiYWN0aXZlVGFiID09PSAnZGlyZWN0J1wiXHJcbiAgICAgICAgICAoY2xpY2spPVwic2V0QWN0aXZlVGFiKCdkaXJlY3QnKVwiXHJcbiAgICAgICAgICBtYXRUb29sdGlwPVwiQ2hhdHNcIlxyXG4gICAgICAgICAgbWF0VG9vbHRpcFBvc2l0aW9uPVwiYWJvdmVcIlxyXG4gICAgICAgID5cclxuICAgICAgICAgIDxtYXQtaWNvbj5jaGF0PC9tYXQtaWNvbj5cclxuICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICA8YnV0dG9uXHJcbiAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcclxuICAgICAgICAgIGNsYXNzPVwiaW5ib3gtdGFiXCJcclxuICAgICAgICAgIFtjbGFzcy5hY3RpdmVdPVwiYWN0aXZlVGFiID09PSAnZ3JvdXBzJ1wiXHJcbiAgICAgICAgICAoY2xpY2spPVwic2V0QWN0aXZlVGFiKCdncm91cHMnKVwiXHJcbiAgICAgICAgICBtYXRUb29sdGlwPVwiR3JvdXBzXCJcclxuICAgICAgICAgIG1hdFRvb2x0aXBQb3NpdGlvbj1cImFib3ZlXCJcclxuICAgICAgICA+XHJcbiAgICAgICAgICA8bWF0LWljb24+Z3JvdXBzPC9tYXQtaWNvbj5cclxuICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICA8YnV0dG9uXHJcbiAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcclxuICAgICAgICAgIGNsYXNzPVwiaW5ib3gtdGFiXCJcclxuICAgICAgICAgIFtjbGFzcy5hY3RpdmVdPVwiYWN0aXZlVGFiID09PSAncHJvamVjdHMnXCJcclxuICAgICAgICAgIChjbGljayk9XCJzZXRBY3RpdmVUYWIoJ3Byb2plY3RzJylcIlxyXG4gICAgICAgICAgbWF0VG9vbHRpcD1cIlByb2plY3RzXCJcclxuICAgICAgICAgIG1hdFRvb2x0aXBQb3NpdGlvbj1cImFib3ZlXCJcclxuICAgICAgICA+XHJcbiAgICAgICAgICA8bWF0LWljb24+d29ya3NwYWNlczwvbWF0LWljb24+XHJcbiAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgdHlwZT1cImJ1dHRvblwiXHJcbiAgICAgICAgICBjbGFzcz1cImluYm94LXRhYlwiXHJcbiAgICAgICAgICBbY2xhc3MuYWN0aXZlXT1cImFjdGl2ZVRhYiA9PT0gJ3NldHRpbmdzJ1wiXHJcbiAgICAgICAgICAoY2xpY2spPVwic2V0QWN0aXZlVGFiKCdzZXR0aW5ncycpXCJcclxuICAgICAgICAgIG1hdFRvb2x0aXA9XCJTZXR0aW5nc1wiXHJcbiAgICAgICAgICBtYXRUb29sdGlwUG9zaXRpb249XCJhYm92ZVwiXHJcbiAgICAgICAgPlxyXG4gICAgICAgICAgPG1hdC1pY29uPnNldHRpbmdzPC9tYXQtaWNvbj5cclxuICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgPC9kaXY+XHJcblxyXG4gICAgICA8IS0tIENvbnRleHQgTWVudSAtLT5cclxuICAgICAgPGRpdlxyXG4gICAgICAgICpuZ0lmPVwiY29udGV4dE1lbnVcIlxyXG4gICAgICAgIGNsYXNzPVwiY29udGV4dC1tZW51XCJcclxuICAgICAgICBbc3R5bGUudG9wLnB4XT1cImNvbnRleHRNZW51LnlcIlxyXG4gICAgICAgIFtzdHlsZS5sZWZ0LnB4XT1cImNvbnRleHRNZW51LnhcIlxyXG4gICAgICA+XHJcbiAgICAgICAgPGRpdiBjbGFzcz1cImN0eC1pdGVtXCIgKGNsaWNrKT1cImNsZWFyQ2hhdCgpXCI+XHJcbiAgICAgICAgICA8bWF0LWljb24+Y2xlYW5pbmdfc2VydmljZXM8L21hdC1pY29uPlxyXG4gICAgICAgICAgPHNwYW4+Q2xlYXIgY29udmVyc2F0aW9uPC9zcGFuPlxyXG4gICAgICAgIDwvZGl2PlxyXG4gICAgICAgIDxkaXYgY2xhc3M9XCJjdHgtaXRlbSBjdHgtZGFuZ2VyXCIgKGNsaWNrKT1cImRlbGV0ZUNoYXQoKVwiPlxyXG4gICAgICAgICAgPG1hdC1pY29uPnt7IGNvbnRleHRNZW51Lml0ZW0uaXNfZ3JvdXAgPyAnbG9nb3V0JyA6ICdkZWxldGUnIH19PC9tYXQtaWNvbj5cclxuICAgICAgICAgIDxzcGFuPnt7IGNvbnRleHRNZW51Lml0ZW0uaXNfZ3JvdXAgPyAnRXhpdCBncm91cCcgOiAnRGVsZXRlIGNvbnZlcnNhdGlvbicgfX08L3NwYW4+XHJcbiAgICAgICAgPC9kaXY+XHJcbiAgICAgIDwvZGl2PlxyXG4gICAgICA8ZGl2ICpuZ0lmPVwiY29udGV4dE1lbnVcIiBjbGFzcz1cImN0eC1iYWNrZHJvcFwiIChjbGljayk9XCJjbG9zZUNvbnRleHRNZW51KClcIj48L2Rpdj5cclxuICAgIDwvZGl2PlxyXG4gIGAsXHJcbiAgc3R5bGVzOiBbYFxyXG4gICAgLmluYm94LWNvbnRhaW5lciB7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XHJcbiAgICAgIGhlaWdodDogMTAwJTtcclxuICAgICAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQ7XHJcbiAgICAgIGNvbnRhaW5lci10eXBlOiBpbmxpbmUtc2l6ZTtcclxuICAgIH1cclxuXHJcbiAgICAuc2VhcmNoLWJhciB7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgIG1hcmdpbjogOHB4IDE2cHg7XHJcbiAgICAgIHBhZGRpbmc6IDhweCAxMnB4O1xyXG4gICAgICBiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudDtcclxuICAgICAgYm9yZGVyLXJhZGl1czogMTBweDtcclxuICAgIH1cclxuXHJcbiAgICAuc2VhcmNoLWljb24ge1xyXG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjcpO1xyXG4gICAgICBmb250LXNpemU6IDE4cHg7XHJcbiAgICAgIHdpZHRoOiAyMHB4O1xyXG4gICAgICBoZWlnaHQ6IDIwcHg7XHJcbiAgICAgIG1hcmdpbi1yaWdodDogOHB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5zZWFyY2gtaW5wdXQge1xyXG4gICAgICBmbGV4OiAxO1xyXG4gICAgICBib3JkZXI6IG5vbmU7XHJcbiAgICAgIG91dGxpbmU6IG5vbmU7XHJcbiAgICAgIGJhY2tncm91bmQ6IHRyYW5zcGFyZW50O1xyXG4gICAgICBmb250LXNpemU6IDE0cHg7XHJcbiAgICAgIGNvbG9yOiAjZmZmO1xyXG4gICAgfVxyXG5cclxuICAgIC5zZWFyY2gtaW5wdXQ6OnBsYWNlaG9sZGVyIHtcclxuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC42KTtcclxuICAgIH1cclxuXHJcbiAgICAuaW5ib3gtdGFicyB7XHJcbiAgICAgIGRpc3BsYXk6IGdyaWQ7XHJcbiAgICAgIGdyaWQtdGVtcGxhdGUtY29sdW1uczogcmVwZWF0KDUsIG1pbm1heCgwLCAxZnIpKTtcclxuICAgICAgZ2FwOiA1cHg7XHJcbiAgICAgIHBhZGRpbmc6IDEwcHggMTZweCAxMnB4O1xyXG4gICAgICBib3JkZXItdG9wOiAxcHggc29saWQgcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjEpO1xyXG4gICAgICBmbGV4LXNocmluazogMDtcclxuICAgIH1cclxuXHJcbiAgICAuaW5ib3gtdGFiIHtcclxuICAgICAgbWluLXdpZHRoOiAwO1xyXG4gICAgICBib3JkZXI6IDFweCBzb2xpZCByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMTQpO1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMDYpO1xyXG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjcyKTtcclxuICAgICAgYm9yZGVyLXJhZGl1czogOTk5cHg7XHJcbiAgICAgIHBhZGRpbmc6IDZweCA0cHg7XHJcbiAgICAgIGZvbnQtd2VpZ2h0OiA2MDA7XHJcbiAgICAgIGN1cnNvcjogcG9pbnRlcjtcclxuICAgICAgZGlzcGxheTogaW5saW5lLWZsZXg7XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xyXG4gICAgICB0cmFuc2l0aW9uOiBiYWNrZ3JvdW5kIDAuMTVzLCBib3JkZXItY29sb3IgMC4xNXMsIGNvbG9yIDAuMTVzO1xyXG4gICAgfVxyXG5cclxuICAgIC5pbmJveC10YWIgbWF0LWljb24ge1xyXG4gICAgICBmb250LXNpemU6IGNsYW1wKDE3cHgsIDZjcXcsIDIxcHgpO1xyXG4gICAgICB3aWR0aDogY2xhbXAoMTdweCwgNmNxdywgMjFweCk7XHJcbiAgICAgIGhlaWdodDogY2xhbXAoMTdweCwgNmNxdywgMjFweCk7XHJcbiAgICAgIGxpbmUtaGVpZ2h0OiBjbGFtcCgxN3B4LCA2Y3F3LCAyMXB4KTtcclxuICAgIH1cclxuXHJcbiAgICAuaW5ib3gtdGFiOmhvdmVyIHtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjEyKTtcclxuICAgICAgY29sb3I6ICNmZmY7XHJcbiAgICB9XHJcblxyXG4gICAgLmluYm94LXRhYi5hY3RpdmUge1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI2LCA5NSwgMTY4LCAwLjM1KTtcclxuICAgICAgYm9yZGVyLWNvbG9yOiByZ2JhKDEyNywgMTgwLCAyNTUsIDAuNDUpO1xyXG4gICAgICBjb2xvcjogI2ZmZjtcclxuICAgIH1cclxuXHJcbiAgICBAY29udGFpbmVyIChtYXgtd2lkdGg6IDMzMHB4KSB7XHJcbiAgICAgIC5pbmJveC10YWJzIHtcclxuICAgICAgICBnYXA6IDNweDtcclxuICAgICAgICBwYWRkaW5nOiA4cHggOHB4IDEwcHg7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIC5pbmJveC10YWIge1xyXG4gICAgICAgIHBhZGRpbmc6IDZweCAycHg7XHJcbiAgICAgICAgbGV0dGVyLXNwYWNpbmc6IC0wLjJweDtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIEBjb250YWluZXIgKG1heC13aWR0aDogMjgwcHgpIHtcclxuICAgICAgLmluYm94LXRhYnMge1xyXG4gICAgICAgIGdhcDogMnB4O1xyXG4gICAgICAgIHBhZGRpbmctbGVmdDogNnB4O1xyXG4gICAgICAgIHBhZGRpbmctcmlnaHQ6IDZweDtcclxuICAgICAgfVxyXG5cclxuICAgICAgLmluYm94LXRhYiB7XHJcbiAgICAgICAgZm9udC1zaXplOiA4LjVweDtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC5jb252ZXJzYXRpb24tbGlzdCB7XHJcbiAgICAgIGZsZXg6IDE7XHJcbiAgICAgIG92ZXJmbG93LXk6IGF1dG87XHJcbiAgICAgIHNjcm9sbGJhci13aWR0aDogbm9uZTtcclxuICAgICAgLW1zLW92ZXJmbG93LXN0eWxlOiBub25lO1xyXG4gICAgfVxyXG5cclxuICAgIC5jb252ZXJzYXRpb24tbGlzdDo6LXdlYmtpdC1zY3JvbGxiYXIge1xyXG4gICAgICBkaXNwbGF5OiBub25lO1xyXG4gICAgfVxyXG5cclxuICAgIC5jb252ZXJzYXRpb24taXRlbSB7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgIHBhZGRpbmc6IDEycHggMTZweDtcclxuICAgICAgY3Vyc29yOiBwb2ludGVyO1xyXG4gICAgICB0cmFuc2l0aW9uOiBiYWNrZ3JvdW5kIDAuMTVzO1xyXG4gICAgICBnYXA6IDEycHg7XHJcbiAgICB9XHJcblxyXG4gICAgLmNvbnZlcnNhdGlvbi1pdGVtOmhvdmVyIHtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjEpO1xyXG4gICAgfVxyXG5cclxuICAgIC5jb252ZXJzYXRpb24taXRlbS5oYXMtdW5yZWFkIHtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjE1KTtcclxuICAgIH1cclxuXHJcbiAgICAuYXZhdGFyIHtcclxuICAgICAgd2lkdGg6IDQ4cHg7XHJcbiAgICAgIGhlaWdodDogNDhweDtcclxuICAgICAgYm9yZGVyLXJhZGl1czogNTAlO1xyXG4gICAgICBiYWNrZ3JvdW5kOiAjMGQyNTQwO1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcclxuICAgICAgZmxleC1zaHJpbms6IDA7XHJcbiAgICB9XHJcblxyXG4gICAgLmF2YXRhciBtYXQtaWNvbiB7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNyk7XHJcbiAgICAgIGZvbnQtc2l6ZTogMjRweDtcclxuICAgIH1cclxuXHJcbiAgICAuZ3JvdXAtYXZhdGFyIHtcclxuICAgICAgYmFja2dyb3VuZDogIzBhMWYzODtcclxuICAgIH1cclxuXHJcbiAgICAuZ3JvdXAtYXZhdGFyIG1hdC1pY29uIHtcclxuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC43KTtcclxuICAgIH1cclxuXHJcbiAgICAucHJvamVjdC1hdmF0YXIge1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDM3LCA5OSwgMjM1LCAwLjIpO1xyXG4gICAgfVxyXG5cclxuICAgIC5wcm9qZWN0LWF2YXRhciBtYXQtaWNvbiB7XHJcbiAgICAgIGNvbG9yOiAjYmZkYmZlO1xyXG4gICAgfVxyXG5cclxuICAgIC5jb252ZXJzYXRpb24taW5mbyB7XHJcbiAgICAgIGZsZXg6IDE7XHJcbiAgICAgIG1pbi13aWR0aDogMDtcclxuICAgIH1cclxuXHJcbiAgICAuaW5mby10b3Age1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWJldHdlZW47XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBiYXNlbGluZTtcclxuICAgICAgbWFyZ2luLWJvdHRvbTogMnB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5jb252LW5hbWUge1xyXG4gICAgICBmb250LXdlaWdodDogNjAwO1xyXG4gICAgICBmb250LXNpemU6IDE0cHg7XHJcbiAgICAgIGNvbG9yOiAjZmZmO1xyXG4gICAgICB3aGl0ZS1zcGFjZTogbm93cmFwO1xyXG4gICAgICBvdmVyZmxvdzogaGlkZGVuO1xyXG4gICAgICB0ZXh0LW92ZXJmbG93OiBlbGxpcHNpcztcclxuICAgICAgbWF4LXdpZHRoOiAyMDBweDtcclxuICAgIH1cclxuXHJcbiAgICAuY29udi10aW1lIHtcclxuICAgICAgZm9udC1zaXplOiAxMXB4O1xyXG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjcpO1xyXG4gICAgICBmbGV4LXNocmluazogMDtcclxuICAgICAgbWFyZ2luLWxlZnQ6IDhweDtcclxuICAgIH1cclxuXHJcbiAgICAuaW5mby1ib3R0b20ge1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWJldHdlZW47XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgIGdhcDogNnB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5jb252LXByZXZpZXcge1xyXG4gICAgICBmb250LXNpemU6IDEzcHg7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNyk7XHJcbiAgICAgIHdoaXRlLXNwYWNlOiBub3dyYXA7XHJcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XHJcbiAgICAgIHRleHQtb3ZlcmZsb3c6IGVsbGlwc2lzO1xyXG4gICAgICBtYXgtd2lkdGg6IDIyMHB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5oYXMtdW5yZWFkIC5jb252LW5hbWUge1xyXG4gICAgICBjb2xvcjogI2ZmZjtcclxuICAgIH1cclxuXHJcbiAgICAuaGFzLXVucmVhZCAuY29udi1wcmV2aWV3IHtcclxuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC45KTtcclxuICAgICAgZm9udC13ZWlnaHQ6IDUwMDtcclxuICAgIH1cclxuXHJcbiAgICAudW5yZWFkLWJhZGdlIHtcclxuICAgICAgYmFja2dyb3VuZDogIzFhNWZhODtcclxuICAgICAgY29sb3I6ICNmZmY7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDEwcHg7XHJcbiAgICAgIG1pbi13aWR0aDogMjBweDtcclxuICAgICAgaGVpZ2h0OiAyMHB4O1xyXG4gICAgICBmb250LXNpemU6IDExcHg7XHJcbiAgICAgIGZvbnQtd2VpZ2h0OiA2MDA7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xyXG4gICAgICBwYWRkaW5nOiAwIDZweDtcclxuICAgICAgZmxleC1zaHJpbms6IDA7XHJcbiAgICB9XHJcblxyXG4gICAgLm1lbnRpb24tYmFkZ2Uge1xyXG4gICAgICB3aWR0aDogMjBweDtcclxuICAgICAgaGVpZ2h0OiAyMHB4O1xyXG4gICAgICBib3JkZXItcmFkaXVzOiA5OTlweDtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgxMjcsIDE4MCwgMjU1LCAwLjIpO1xyXG4gICAgICBib3JkZXI6IDFweCBzb2xpZCByZ2JhKDEyNywgMTgwLCAyNTUsIDAuNTUpO1xyXG4gICAgICBjb2xvcjogI2JmZGJmZTtcclxuICAgICAgZGlzcGxheTogaW5saW5lLWZsZXg7XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xyXG4gICAgICBmb250LXNpemU6IDEycHg7XHJcbiAgICAgIGZvbnQtd2VpZ2h0OiA4MDA7XHJcbiAgICAgIGZsZXgtc2hyaW5rOiAwO1xyXG4gICAgICBtYXJnaW4tbGVmdDogNnB4O1xyXG4gICAgICBib3gtc2hhZG93OiAwIDAgMCAycHggcmdiYSgxMjcsIDE4MCwgMjU1LCAwLjA2KTtcclxuICAgIH1cclxuXHJcbiAgICAuZW1wdHktc3RhdGUge1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcclxuICAgICAgcGFkZGluZzogNDhweCAyNHB4O1xyXG4gICAgICBjb2xvcjogIzljYTNhZjtcclxuICAgIH1cclxuXHJcbiAgICAuZW1wdHktc3RhdGUgbWF0LWljb24ge1xyXG4gICAgICBmb250LXNpemU6IDQ4cHg7XHJcbiAgICAgIHdpZHRoOiA0OHB4O1xyXG4gICAgICBoZWlnaHQ6IDQ4cHg7XHJcbiAgICAgIG1hcmdpbi1ib3R0b206IDEycHg7XHJcbiAgICB9XHJcblxyXG4gICAgLmVtcHR5LXN0YXRlIHAge1xyXG4gICAgICBtYXJnaW46IDAgMCAxNnB4O1xyXG4gICAgICBmb250LXNpemU6IDE0cHg7XHJcbiAgICB9XHJcblxyXG4gICAgLnNldHRpbmdzLXBhbmVsIHtcclxuICAgICAgcGFkZGluZzogMTZweDtcclxuICAgICAgY29sb3I6ICNmZmY7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XHJcbiAgICAgIGdhcDogMTJweDtcclxuICAgIH1cclxuXHJcbiAgICAuc2V0dGluZ3MtY2FyZCB7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDE0cHg7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4wNyk7XHJcbiAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xMik7XHJcbiAgICAgIHBhZGRpbmc6IDE2cHg7XHJcbiAgICAgIGJveC1zaGFkb3c6IDAgMTBweCAyOHB4IHJnYmEoMCwgMCwgMCwgMC4xOCk7XHJcbiAgICB9XHJcblxyXG4gICAgLnNldHRpbmdzLWhlYWRlciB7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGdhcDogMTJweDtcclxuICAgICAgYWxpZ24taXRlbXM6IGZsZXgtc3RhcnQ7XHJcbiAgICAgIG1hcmdpbi1ib3R0b206IDE2cHg7XHJcbiAgICB9XHJcblxyXG4gICAgLnNldHRpbmdzLWljb24ge1xyXG4gICAgICB3aWR0aDogMzZweDtcclxuICAgICAgaGVpZ2h0OiAzNnB4O1xyXG4gICAgICBib3JkZXItcmFkaXVzOiAxMHB4O1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI2LCA5NSwgMTY4LCAwLjM1KTtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XHJcbiAgICAgIGZsZXgtc2hyaW5rOiAwO1xyXG4gICAgfVxyXG5cclxuICAgIC5zZXR0aW5ncy1pY29uIG1hdC1pY29uIHtcclxuICAgICAgY29sb3I6ICNiZmRiZmU7XHJcbiAgICB9XHJcblxyXG4gICAgLnNldHRpbmdzLWljb24uZGlzcGxheS1pY29uIHtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgxMzQsIDIzOSwgMTcyLCAwLjE0KTtcclxuICAgIH1cclxuXHJcbiAgICAuc2V0dGluZ3MtaWNvbi5kaXNwbGF5LWljb24gbWF0LWljb24ge1xyXG4gICAgICBjb2xvcjogI2JiZjdkMDtcclxuICAgIH1cclxuXHJcbiAgICAuc2V0dGluZ3MtaGVhZGVyIGg0IHtcclxuICAgICAgbWFyZ2luOiAwIDAgNHB4O1xyXG4gICAgICBmb250LXNpemU6IDE1cHg7XHJcbiAgICAgIGZvbnQtd2VpZ2h0OiA3MDA7XHJcbiAgICB9XHJcblxyXG4gICAgLnNldHRpbmdzLWhlYWRlciBwIHtcclxuICAgICAgbWFyZ2luOiAwO1xyXG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjY1KTtcclxuICAgICAgZm9udC1zaXplOiAxMnB4O1xyXG4gICAgICBsaW5lLWhlaWdodDogMS40O1xyXG4gICAgfVxyXG5cclxuICAgIC5zZXR0aW5ncy10b2dnbGUge1xyXG4gICAgICB3aWR0aDogMTAwJTtcclxuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDEwcHg7XHJcbiAgICAgIGNvbG9yOiAjZmZmICFpbXBvcnRhbnQ7XHJcbiAgICAgIGJvcmRlci1jb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjIpICFpbXBvcnRhbnQ7XHJcbiAgICAgIG1hcmdpbi1ib3R0b206IDE2cHg7XHJcbiAgICB9XHJcblxyXG4gICAgLnNldHRpbmdzLXRvZ2dsZSBtYXQtaWNvbiB7XHJcbiAgICAgIG1hcmdpbi1yaWdodDogOHB4O1xyXG4gICAgICBmb250LXNpemU6IDE4cHg7XHJcbiAgICAgIHdpZHRoOiAxOHB4O1xyXG4gICAgICBoZWlnaHQ6IDE4cHg7XHJcbiAgICB9XHJcblxyXG4gICAgLnZvbHVtZS1sYWJlbCB7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGp1c3RpZnktY29udGVudDogc3BhY2UtYmV0d2VlbjtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC43OCk7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTJweDtcclxuICAgICAgZm9udC13ZWlnaHQ6IDYwMDtcclxuICAgICAgbWFyZ2luLWJvdHRvbTogOHB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5zZXR0aW5ncy12b2x1bWUge1xyXG4gICAgICB3aWR0aDogMTAwJTtcclxuICAgICAgYWNjZW50LWNvbG9yOiAjN2ZiNGZmO1xyXG4gICAgICBjdXJzb3I6IHBvaW50ZXI7XHJcbiAgICAgIG1hcmdpbi1ib3R0b206IDEycHg7XHJcbiAgICB9XHJcblxyXG4gICAgLnNldHRpbmdzLXByZXZpZXcge1xyXG4gICAgICBtYXJnaW46IDAgMCAxNnB4O1xyXG4gICAgICBib3JkZXItcmFkaXVzOiAxMHB4O1xyXG4gICAgICBib3JkZXI6IDFweCBzb2xpZCByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMTIpO1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMDYpO1xyXG4gICAgICBjb2xvcjogI2Y1ZjdmZjtcclxuICAgICAgYm94LXNpemluZzogYm9yZGVyLWJveDtcclxuICAgIH1cclxuXHJcbiAgICAubWVzc2FnZS1wcmV2aWV3IHtcclxuICAgICAgcGFkZGluZzogOXB4IDExcHg7XHJcbiAgICAgIGxpbmUtaGVpZ2h0OiAxLjM1O1xyXG4gICAgfVxyXG5cclxuICAgIC5jb2RlLXByZXZpZXcge1xyXG4gICAgICBwYWRkaW5nOiAxMHB4IDExcHg7XHJcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XHJcbiAgICAgIGZvbnQtZmFtaWx5OiB1aS1tb25vc3BhY2UsIFNGTW9uby1SZWd1bGFyLCBNZW5sbywgTW9uYWNvLCBDb25zb2xhcywgXCJMaWJlcmF0aW9uIE1vbm9cIiwgbW9ub3NwYWNlO1xyXG4gICAgICBsaW5lLWhlaWdodDogMS40NTtcclxuICAgICAgd2hpdGUtc3BhY2U6IHByZS13cmFwO1xyXG4gICAgICBjb2xvcjogI2RiZWFmZTtcclxuICAgICAgYmFja2dyb3VuZDogIzA2MTgyNztcclxuICAgICAgbWFyZ2luLWJvdHRvbTogMDtcclxuICAgIH1cclxuXHJcbiAgICAuY29udGV4dC1tZW51IHtcclxuICAgICAgcG9zaXRpb246IGZpeGVkO1xyXG4gICAgICB6LWluZGV4OiAxMDAwMTtcclxuICAgICAgYmFja2dyb3VuZDogIzA3MWQzMDtcclxuICAgICAgYm9yZGVyLXJhZGl1czogOHB4O1xyXG4gICAgICBwYWRkaW5nOiA0cHggMDtcclxuICAgICAgYm94LXNoYWRvdzogMCA4cHggMjRweCByZ2JhKDAsIDAsIDAsIDAuMyk7XHJcbiAgICAgIG1pbi13aWR0aDogMjAwcHg7XHJcbiAgICB9XHJcblxyXG4gICAgLmN0eC1pdGVtIHtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAgZ2FwOiAxMHB4O1xyXG4gICAgICBwYWRkaW5nOiAxMHB4IDE2cHg7XHJcbiAgICAgIGN1cnNvcjogcG9pbnRlcjtcclxuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC45KTtcclxuICAgICAgZm9udC1zaXplOiAxM3B4O1xyXG4gICAgICB0cmFuc2l0aW9uOiBiYWNrZ3JvdW5kIDAuMTVzO1xyXG4gICAgfVxyXG5cclxuICAgIC5jdHgtaXRlbTpob3ZlciB7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xKTtcclxuICAgIH1cclxuXHJcbiAgICAuY3R4LWl0ZW0gbWF0LWljb24ge1xyXG4gICAgICBmb250LXNpemU6IDE4cHg7XHJcbiAgICAgIHdpZHRoOiAxOHB4O1xyXG4gICAgICBoZWlnaHQ6IDE4cHg7XHJcbiAgICB9XHJcblxyXG4gICAgLmN0eC1kYW5nZXIge1xyXG4gICAgICBjb2xvcjogI2Y4NzE3MTtcclxuICAgIH1cclxuXHJcbiAgICAuY3R4LWRhbmdlcjpob3ZlciB7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjQ4LCAxMTMsIDExMywgMC4xNSk7XHJcbiAgICB9XHJcblxyXG4gICAgLmN0eC1iYWNrZHJvcCB7XHJcbiAgICAgIHBvc2l0aW9uOiBmaXhlZDtcclxuICAgICAgaW5zZXQ6IDA7XHJcbiAgICAgIHotaW5kZXg6IDEwMDAwO1xyXG4gICAgfVxyXG4gIGBdLFxyXG59KVxyXG5leHBvcnQgY2xhc3MgSW5ib3hMaXN0Q29tcG9uZW50IGltcGxlbWVudHMgT25Jbml0LCBPbkRlc3Ryb3kge1xyXG4gIGluYm94OiBJbmJveEl0ZW1bXSA9IFtdO1xyXG4gIHNlYXJjaFF1ZXJ5ID0gJyc7XHJcbiAgYWN0aXZlVGFiOiAnYWxsJyB8ICdkaXJlY3QnIHwgJ2dyb3VwcycgfCAncHJvamVjdHMnIHwgJ3NldHRpbmdzJyA9ICdhbGwnO1xyXG4gIG5vdGlmaWNhdGlvblZvbHVtZSA9IDAuMzU7XHJcbiAgbm90aWZpY2F0aW9uc011dGVkID0gZmFsc2U7XHJcbiAgbWVzc2FnZVRleHRTY2FsZSA9IDE7XHJcbiAgY29kZVRleHRTY2FsZSA9IDE7XHJcbiAgY29udGV4dE1lbnU6IHsgeDogbnVtYmVyOyB5OiBudW1iZXI7IGl0ZW06IEluYm94SXRlbSB9IHwgbnVsbCA9IG51bGw7XHJcbiAgcHJpdmF0ZSByZWFkb25seSB0YWJTdG9yYWdlS2V5ID0gJ21lc3NhZ2luZ19pbmJveF9hY3RpdmVfdGFiJztcclxuICBwcml2YXRlIHN1YiE6IFN1YnNjcmlwdGlvbjtcclxuXHJcbiAgY29uc3RydWN0b3IocHJpdmF0ZSBzdG9yZTogTWVzc2FnaW5nU3RvcmVTZXJ2aWNlKSB7fVxyXG5cclxuICBuZ09uSW5pdCgpOiB2b2lkIHtcclxuICAgIHRoaXMuYWN0aXZlVGFiID0gdGhpcy5nZXRTYXZlZFRhYigpO1xyXG4gICAgdGhpcy5zdWIgPSBuZXcgU3Vic2NyaXB0aW9uKCk7XHJcbiAgICB0aGlzLnN1Yi5hZGQodGhpcy5zdG9yZS5pbmJveC5zdWJzY3JpYmUoKGl0ZW1zKSA9PiAodGhpcy5pbmJveCA9IGl0ZW1zKSkpO1xyXG4gICAgdGhpcy5zdWIuYWRkKHRoaXMuc3RvcmUubm90aWZpY2F0aW9uVm9sdW1lLnN1YnNjcmliZSgodm9sdW1lKSA9PiAodGhpcy5ub3RpZmljYXRpb25Wb2x1bWUgPSB2b2x1bWUpKSk7XHJcbiAgICB0aGlzLnN1Yi5hZGQodGhpcy5zdG9yZS5ub3RpZmljYXRpb25zTXV0ZWQuc3Vic2NyaWJlKChtdXRlZCkgPT4gKHRoaXMubm90aWZpY2F0aW9uc011dGVkID0gbXV0ZWQpKSk7XHJcbiAgICB0aGlzLnN1Yi5hZGQodGhpcy5zdG9yZS5tZXNzYWdlVGV4dFNjYWxlLnN1YnNjcmliZSgoc2NhbGUpID0+ICh0aGlzLm1lc3NhZ2VUZXh0U2NhbGUgPSBzY2FsZSkpKTtcclxuICAgIHRoaXMuc3ViLmFkZCh0aGlzLnN0b3JlLmNvZGVUZXh0U2NhbGUuc3Vic2NyaWJlKChzY2FsZSkgPT4gKHRoaXMuY29kZVRleHRTY2FsZSA9IHNjYWxlKSkpO1xyXG4gIH1cclxuXHJcbiAgbmdPbkRlc3Ryb3koKTogdm9pZCB7XHJcbiAgICB0aGlzLnN1Yj8udW5zdWJzY3JpYmUoKTtcclxuICB9XHJcblxyXG4gIGdldCBmaWx0ZXJlZEluYm94KCk6IEluYm94SXRlbVtdIHtcclxuICAgIGlmICh0aGlzLmFjdGl2ZVRhYiA9PT0gJ3NldHRpbmdzJykgcmV0dXJuIFtdO1xyXG4gICAgY29uc3QgdGFiYmVkID0gdGhpcy5pbmJveC5maWx0ZXIoKGl0ZW0pID0+IHtcclxuICAgICAgY29uc3QgcHJvamVjdCA9IHRoaXMuaXNQcm9qZWN0KGl0ZW0pO1xyXG4gICAgICBpZiAodGhpcy5hY3RpdmVUYWIgPT09ICdkaXJlY3QnKSByZXR1cm4gIWl0ZW0uaXNfZ3JvdXA7XHJcbiAgICAgIGlmICh0aGlzLmFjdGl2ZVRhYiA9PT0gJ2dyb3VwcycpIHJldHVybiBpdGVtLmlzX2dyb3VwICYmICFwcm9qZWN0O1xyXG4gICAgICBpZiAodGhpcy5hY3RpdmVUYWIgPT09ICdwcm9qZWN0cycpIHJldHVybiBwcm9qZWN0O1xyXG4gICAgICByZXR1cm4gdHJ1ZTtcclxuICAgIH0pO1xyXG4gICAgaWYgKCF0aGlzLnNlYXJjaFF1ZXJ5LnRyaW0oKSkgcmV0dXJuIHRhYmJlZDtcclxuICAgIGNvbnN0IHEgPSB0aGlzLnNlYXJjaFF1ZXJ5LnRvTG93ZXJDYXNlKCk7XHJcbiAgICByZXR1cm4gdGFiYmVkLmZpbHRlcihcclxuICAgICAgKGl0ZW0pID0+XHJcbiAgICAgICAgKGl0ZW0ubmFtZSB8fCAnJykudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhxKSB8fFxyXG4gICAgICAgIChpdGVtLmxhc3RfbWVzc2FnZV9wcmV2aWV3IHx8ICcnKS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKHEpXHJcbiAgICApO1xyXG4gIH1cclxuXHJcbiAgZ2V0IGVtcHR5U3RhdGVUZXh0KCk6IHN0cmluZyB7XHJcbiAgICBpZiAodGhpcy5zZWFyY2hRdWVyeS50cmltKCkpIHJldHVybiAnTm8gbWF0Y2hpbmcgY29udmVyc2F0aW9ucyc7XHJcbiAgICBpZiAodGhpcy5hY3RpdmVUYWIgPT09ICdkaXJlY3QnKSByZXR1cm4gJ05vIGNoYXRzIHlldCc7XHJcbiAgICBpZiAodGhpcy5hY3RpdmVUYWIgPT09ICdncm91cHMnKSByZXR1cm4gJ05vIGdyb3VwcyB5ZXQnO1xyXG4gICAgaWYgKHRoaXMuYWN0aXZlVGFiID09PSAncHJvamVjdHMnKSByZXR1cm4gJ05vIHByb2plY3QgY2hhdHMgeWV0JztcclxuICAgIHJldHVybiAnTm8gY29udmVyc2F0aW9ucyB5ZXQnO1xyXG4gIH1cclxuXHJcbiAgaXNQcm9qZWN0KGl0ZW06IEluYm94SXRlbSk6IGJvb2xlYW4ge1xyXG4gICAgcmV0dXJuIGlzUHJvamVjdENvbnZlcnNhdGlvbihpdGVtKTtcclxuICB9XHJcblxyXG4gIHNldEFjdGl2ZVRhYih0YWI6ICdhbGwnIHwgJ2RpcmVjdCcgfCAnZ3JvdXBzJyB8ICdwcm9qZWN0cycgfCAnc2V0dGluZ3MnKTogdm9pZCB7XHJcbiAgICB0aGlzLmFjdGl2ZVRhYiA9IHRhYjtcclxuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKHRoaXMudGFiU3RvcmFnZUtleSwgdGFiKTtcclxuICAgIHRoaXMuY29udGV4dE1lbnUgPSBudWxsO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBnZXRTYXZlZFRhYigpOiAnYWxsJyB8ICdkaXJlY3QnIHwgJ2dyb3VwcycgfCAncHJvamVjdHMnIHwgJ3NldHRpbmdzJyB7XHJcbiAgICBjb25zdCBzYXZlZCA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKHRoaXMudGFiU3RvcmFnZUtleSk7XHJcbiAgICByZXR1cm4gc2F2ZWQgPT09ICdkaXJlY3QnIHx8IHNhdmVkID09PSAnZ3JvdXBzJyB8fCBzYXZlZCA9PT0gJ3Byb2plY3RzJyB8fCBzYXZlZCA9PT0gJ3NldHRpbmdzJyB8fCBzYXZlZCA9PT0gJ2FsbCdcclxuICAgICAgPyBzYXZlZFxyXG4gICAgICA6ICdhbGwnO1xyXG4gIH1cclxuXHJcbiAgdG9nZ2xlTm90aWZpY2F0aW9uc011dGVkKCk6IHZvaWQge1xyXG4gICAgY29uc3QgbmV4dE11dGVkID0gIXRoaXMubm90aWZpY2F0aW9uc011dGVkO1xyXG4gICAgdGhpcy5zdG9yZS5zZXROb3RpZmljYXRpb25zTXV0ZWQobmV4dE11dGVkKTtcclxuICAgIGlmICghbmV4dE11dGVkICYmIHRoaXMubm90aWZpY2F0aW9uVm9sdW1lID4gMCkge1xyXG4gICAgICB0aGlzLnN0b3JlLnRlc3ROb3RpZmljYXRpb25Tb3VuZCgpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgb25Ob3RpZmljYXRpb25Wb2x1bWVDaGFuZ2UodmFsdWU6IG51bWJlciB8IHN0cmluZyk6IHZvaWQge1xyXG4gICAgdGhpcy5zdG9yZS5zZXROb3RpZmljYXRpb25Wb2x1bWUoTnVtYmVyKHZhbHVlKSk7XHJcbiAgfVxyXG5cclxuICBwcmV2aWV3Tm90aWZpY2F0aW9uU291bmQoKTogdm9pZCB7XHJcbiAgICBpZiAoIXRoaXMubm90aWZpY2F0aW9uc011dGVkICYmIHRoaXMubm90aWZpY2F0aW9uVm9sdW1lID4gMCkge1xyXG4gICAgICB0aGlzLnN0b3JlLnRlc3ROb3RpZmljYXRpb25Tb3VuZCgpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgb25NZXNzYWdlVGV4dFNjYWxlQ2hhbmdlKHZhbHVlOiBudW1iZXIgfCBzdHJpbmcpOiB2b2lkIHtcclxuICAgIHRoaXMuc3RvcmUuc2V0TWVzc2FnZVRleHRTY2FsZShOdW1iZXIodmFsdWUpKTtcclxuICB9XHJcblxyXG4gIG9uQ29kZVRleHRTY2FsZUNoYW5nZSh2YWx1ZTogbnVtYmVyIHwgc3RyaW5nKTogdm9pZCB7XHJcbiAgICB0aGlzLnN0b3JlLnNldENvZGVUZXh0U2NhbGUoTnVtYmVyKHZhbHVlKSk7XHJcbiAgfVxyXG5cclxuICBvcGVuQ29udmVyc2F0aW9uKGl0ZW06IEluYm94SXRlbSk6IHZvaWQge1xyXG4gICAgdGhpcy5zdG9yZS5vcGVuQ29udmVyc2F0aW9uKGl0ZW0uY29udmVyc2F0aW9uX2lkLCBpdGVtLm5hbWUgfHwgJ0NoYXQnLCBpdGVtLmlzX2dyb3VwKTtcclxuICB9XHJcblxyXG4gIG9uTmV3Q29udmVyc2F0aW9uKCk6IHZvaWQge1xyXG4gICAgdGhpcy5zdG9yZS5zZXRWaWV3KCduZXctY29udmVyc2F0aW9uJyk7XHJcbiAgfVxyXG5cclxuICBvbkNyZWF0ZUdyb3VwKCk6IHZvaWQge1xyXG4gICAgdGhpcy5zdG9yZS5zZXRWaWV3KCdncm91cC1tYW5hZ2VyJyk7XHJcbiAgfVxyXG5cclxuICBvbkNvbnRleHRNZW51KGV2ZW50OiBNb3VzZUV2ZW50LCBpdGVtOiBJbmJveEl0ZW0pOiB2b2lkIHtcclxuICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcclxuICAgIHRoaXMuY29udGV4dE1lbnUgPSB7IHg6IGV2ZW50LmNsaWVudFgsIHk6IGV2ZW50LmNsaWVudFksIGl0ZW0gfTtcclxuICB9XHJcblxyXG4gIGNsb3NlQ29udGV4dE1lbnUoKTogdm9pZCB7XHJcbiAgICB0aGlzLmNvbnRleHRNZW51ID0gbnVsbDtcclxuICB9XHJcblxyXG4gIGNsZWFyQ2hhdCgpOiB2b2lkIHtcclxuICAgIGlmICghdGhpcy5jb250ZXh0TWVudSkgcmV0dXJuO1xyXG4gICAgY29uc3QgaWQgPSB0aGlzLmNvbnRleHRNZW51Lml0ZW0uY29udmVyc2F0aW9uX2lkO1xyXG4gICAgdGhpcy5zdG9yZS5jbGVhckNvbnZlcnNhdGlvbihpZCk7XHJcbiAgICB0aGlzLmNvbnRleHRNZW51ID0gbnVsbDtcclxuICB9XHJcblxyXG4gIGRlbGV0ZUNoYXQoKTogdm9pZCB7XHJcbiAgICBpZiAoIXRoaXMuY29udGV4dE1lbnUpIHJldHVybjtcclxuICAgIGNvbnN0IGl0ZW0gPSB0aGlzLmNvbnRleHRNZW51Lml0ZW07XHJcbiAgICBpZiAoaXRlbS5pc19ncm91cCkge1xyXG4gICAgICB0aGlzLnN0b3JlLmRlbGV0ZUdyb3VwKGl0ZW0uY29udmVyc2F0aW9uX2lkKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHRoaXMuc3RvcmUuZGVsZXRlQ29udmVyc2F0aW9uKGl0ZW0uY29udmVyc2F0aW9uX2lkKTtcclxuICAgIH1cclxuICAgIHRoaXMuY29udGV4dE1lbnUgPSBudWxsO1xyXG4gIH1cclxuXHJcbiAgZm9ybWF0VGltZShkYXRlU3RyOiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gICAgaWYgKCFkYXRlU3RyKSByZXR1cm4gJyc7XHJcbiAgICBjb25zdCBkYXRlID0gbmV3IERhdGUoZGF0ZVN0cik7XHJcbiAgICBjb25zdCBub3cgPSBuZXcgRGF0ZSgpO1xyXG4gICAgY29uc3QgZGlmZk1zID0gbm93LmdldFRpbWUoKSAtIGRhdGUuZ2V0VGltZSgpO1xyXG4gICAgY29uc3QgZGlmZk1pbnMgPSBNYXRoLmZsb29yKGRpZmZNcyAvIDYwMDAwKTtcclxuICAgIGNvbnN0IGRpZmZIb3VycyA9IE1hdGguZmxvb3IoZGlmZk1zIC8gMzYwMDAwMCk7XHJcbiAgICBjb25zdCBkaWZmRGF5cyA9IE1hdGguZmxvb3IoZGlmZk1zIC8gODY0MDAwMDApO1xyXG5cclxuICAgIGlmIChkaWZmTWlucyA8IDEpIHJldHVybiAnbm93JztcclxuICAgIGlmIChkaWZmTWlucyA8IDYwKSByZXR1cm4gYCR7ZGlmZk1pbnN9bWA7XHJcbiAgICBpZiAoZGlmZkhvdXJzIDwgMjQpIHJldHVybiBgJHtkaWZmSG91cnN9aGA7XHJcbiAgICBpZiAoZGlmZkRheXMgPCA3KSByZXR1cm4gYCR7ZGlmZkRheXN9ZGA7XHJcblxyXG4gICAgcmV0dXJuIGRhdGUudG9Mb2NhbGVEYXRlU3RyaW5nKCdlbi1HQicsIHsgZGF5OiAnbnVtZXJpYycsIG1vbnRoOiAnc2hvcnQnIH0pO1xyXG4gIH1cclxufVxyXG4iXX0=