import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatRippleModule } from '@angular/material/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription } from 'rxjs';
import { isProjectContainer, isProjectConversation, isProjectSubgroup } from '../../models/messaging.models';
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
    expandedProjectIds = new Set();
    tabStorageKey = 'messaging_inbox_active_tab';
    sub;
    constructor(store) {
        this.store = store;
    }
    get projectGroupsEnabled() {
        return this.store.projectGroupsEnabled;
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
                return [];
            return !isProjectContainer(item);
        });
        if (!this.searchQuery.trim())
            return tabbed;
        const q = this.searchQuery.toLowerCase();
        return tabbed.filter((item) => (item.name || '').toLowerCase().includes(q) ||
            (item.last_message_preview || '').toLowerCase().includes(q));
    }
    get projectContainers() {
        const containers = this.inbox.filter((item) => isProjectContainer(item));
        if (!this.searchQuery.trim())
            return containers;
        const q = this.searchQuery.toLowerCase();
        return containers.filter((project) => {
            const projectMatch = (project.name || '').toLowerCase().includes(q);
            const subgroupMatch = this.projectSubgroups(project, false).some((item) => (item.name || '').toLowerCase().includes(q) ||
                (item.subgroup_subject || '').toLowerCase().includes(q) ||
                (item.last_message_preview || '').toLowerCase().includes(q));
            return projectMatch || subgroupMatch;
        });
    }
    get showEmptyState() {
        if (this.activeTab === 'settings')
            return false;
        if (this.activeTab === 'projects')
            return this.projectContainers.length === 0;
        return this.filteredInbox.length === 0;
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
    projectSubgroups(project, applySearch = true) {
        const parentId = String(project.conversation_id);
        let subgroups = this.inbox.filter((item) => isProjectSubgroup(item) && String(item.parent_conversation_id || '') === parentId);
        if (applySearch && this.searchQuery.trim()) {
            const q = this.searchQuery.toLowerCase();
            subgroups = subgroups.filter((item) => (item.name || '').toLowerCase().includes(q) ||
                (item.subgroup_subject || '').toLowerCase().includes(q) ||
                (item.last_message_preview || '').toLowerCase().includes(q));
        }
        return subgroups;
    }
    isProjectExpanded(project) {
        return this.expandedProjectIds.has(String(project.conversation_id));
    }
    toggleProject(project) {
        const id = String(project.conversation_id);
        const next = new Set(this.expandedProjectIds);
        if (next.has(id)) {
            next.delete(id);
        }
        else {
            next.add(id);
        }
        this.expandedProjectIds = next;
    }
    createSubgroup(project, event) {
        event.stopPropagation();
        this.expandedProjectIds.add(String(project.conversation_id));
        this.store.openProjectSubgroupCreator(project);
    }
    setActiveTab(tab) {
        if (tab === 'projects' && !this.projectGroupsEnabled)
            tab = 'all';
        this.activeTab = tab;
        localStorage.setItem(this.tabStorageKey, tab);
        this.contextMenu = null;
    }
    getSavedTab() {
        const saved = localStorage.getItem(this.tabStorageKey);
        if (saved === 'projects' && !this.projectGroupsEnabled)
            return 'all';
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
        if (isProjectContainer(item)) {
            this.toggleProject(item);
            return;
        }
        this.store.openConversation(item.conversation_id, item.name || 'Chat', item.is_group, this.isProject(item), isProjectSubgroup(item), item.db_gid, item.project_gid, item.parent_conversation_id, item.subgroup_subject);
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
        <ng-container *ngIf="activeTab === 'projects' && projectGroupsEnabled; else standardConversationList">
          <div *ngFor="let project of projectContainers" class="project-container">
            <div class="project-header" (click)="toggleProject(project)">
              <div class="avatar project-avatar">
                <mat-icon>workspaces</mat-icon>
              </div>
              <div class="conversation-info">
                <div class="info-top">
                  <span class="conv-name">{{ project.name || 'Project Group' }}</span>
                  <button
                    type="button"
                    class="subgroup-create"
                    (click)="createSubgroup(project, $event)"
                    matTooltip="Create subgroup"
                    matTooltipPosition="above"
                  >
                    <mat-icon>add</mat-icon>
                  </button>
                </div>
                <div class="info-bottom">
                  <span class="conv-preview">{{ projectSubgroups(project).length }} subgroup{{ projectSubgroups(project).length === 1 ? '' : 's' }}</span>
                  <mat-icon class="expand-icon">{{ isProjectExpanded(project) ? 'expand_less' : 'expand_more' }}</mat-icon>
                </div>
              </div>
            </div>

            <div *ngIf="isProjectExpanded(project)" class="subgroup-list">
              <div
                *ngFor="let item of projectSubgroups(project)"
                class="conversation-item subgroup-item"
                matRipple
                [class.has-unread]="item.unread_count > 0"
                (click)="openConversation(item)"
                (contextmenu)="onContextMenu($event, item)"
              >
                <div class="avatar subgroup-avatar">
                  <mat-icon>forum</mat-icon>
                </div>
                <div class="conversation-info">
                  <div class="info-top">
                    <span class="conv-name">{{ item.name || 'Subgroup' }}</span>
                    <span class="conv-time">{{ formatTime(item.last_message_at) }}</span>
                  </div>
                  <div class="info-bottom">
                    <span class="conv-preview">{{ item.subgroup_subject || item.last_message_preview || 'No messages yet' }}</span>
                    <span *ngIf="item.unread_count > 0" class="unread-badge">
                      {{ item.unread_count > 99 ? '99+' : item.unread_count }}
                    </span>
                  </div>
                </div>
              </div>
              <div *ngIf="projectSubgroups(project).length === 0" class="empty-subgroups">
                No subgroups yet
              </div>
            </div>
          </div>
        </ng-container>

        <ng-template #standardConversationList>
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
              <mat-icon>{{ isProject(item) ? 'forum' : item.is_group ? 'group' : 'person' }}</mat-icon>
            </div>
            <div class="conversation-info">
              <div class="info-top">
                <span class="conv-name">{{ item.name || 'Direct Message' }}</span>
                <span class="conv-time">{{ formatTime(item.last_message_at) }}</span>
              </div>
              <div class="info-bottom">
                <span class="conv-preview">{{ item.subgroup_subject || item.last_message_preview || 'No messages yet' }}</span>
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
        </ng-template>

        <div *ngIf="showEmptyState" class="empty-state">
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
          *ngIf="projectGroupsEnabled"
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
  `, isInline: true, styles: [".inbox-container{display:flex;flex-direction:column;height:100%;background:transparent;container-type:inline-size}.search-bar{display:flex;align-items:center;margin:8px 16px;padding:8px 12px;background:transparent;border-radius:10px}.search-icon{color:#ffffffb3;font-size:18px;width:20px;height:20px;margin-right:8px}.search-input{flex:1;border:none;outline:none;background:transparent;font-size:14px;color:#fff}.search-input::placeholder{color:#fff9}.inbox-tabs{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:5px;padding:10px 16px 12px;border-top:1px solid rgba(255,255,255,.1);flex-shrink:0}.inbox-tab{min-width:0;border:1px solid rgba(255,255,255,.14);background:#ffffff0f;color:#ffffffb8;border-radius:999px;padding:6px 4px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:background .15s,border-color .15s,color .15s}.inbox-tab mat-icon{font-size:clamp(17px,6cqw,21px);width:clamp(17px,6cqw,21px);height:clamp(17px,6cqw,21px);line-height:clamp(17px,6cqw,21px)}.inbox-tab:hover{background:#ffffff1f;color:#fff}.inbox-tab.active{background:#1a5fa859;border-color:#7fb4ff73;color:#fff}@container (max-width: 330px){.inbox-tabs{gap:3px;padding:8px 8px 10px}.inbox-tab{padding:6px 2px;letter-spacing:-.2px}}@container (max-width: 280px){.inbox-tabs{gap:2px;padding-left:6px;padding-right:6px}.inbox-tab{font-size:8.5px}}.conversation-list{flex:1;overflow-y:auto;scrollbar-width:none;-ms-overflow-style:none}.conversation-list::-webkit-scrollbar{display:none}.conversation-item{display:flex;align-items:center;padding:12px 16px;cursor:pointer;transition:background .15s;gap:12px}.conversation-item:hover{background:#ffffff1a}.conversation-item.has-unread{background:#ffffff26}.avatar{width:48px;height:48px;border-radius:50%;background:#0d2540;display:flex;align-items:center;justify-content:center;flex-shrink:0}.avatar mat-icon{color:#ffffffb3;font-size:24px}.group-avatar{background:#0a1f38}.group-avatar mat-icon{color:#ffffffb3}.project-avatar{background:#2563eb33}.project-avatar mat-icon{color:#bfdbfe}.project-container{border-bottom:1px solid rgba(255,255,255,.06)}.project-header{display:flex;align-items:center;padding:12px 16px;cursor:pointer;gap:12px;transition:background .15s}.project-header:hover{background:#ffffff14}.subgroup-create{width:28px;height:28px;border:1px solid rgba(191,219,254,.35);border-radius:999px;background:#2563eb2e;color:#bfdbfe;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0}.subgroup-create mat-icon{font-size:18px;width:18px;height:18px}.expand-icon{color:#fff9;font-size:20px;width:20px;height:20px;flex-shrink:0}.subgroup-list{padding-bottom:6px}.subgroup-item{padding-left:32px;background:#ffffff06}.subgroup-avatar{width:38px;height:38px;background:#3b82f624}.subgroup-avatar mat-icon{color:#dbeafe;font-size:21px}.empty-subgroups{padding:8px 16px 12px 92px;color:#ffffff8c;font-size:12px}.conversation-info{flex:1;min-width:0}.info-top{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:2px}.conv-name{font-weight:600;font-size:14px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px}.conv-time{font-size:11px;color:#ffffffb3;flex-shrink:0;margin-left:8px}.info-bottom{display:flex;justify-content:space-between;align-items:center;gap:6px}.conv-preview{font-size:13px;color:#ffffffb3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px}.has-unread .conv-name{color:#fff}.has-unread .conv-preview{color:#ffffffe6;font-weight:500}.unread-badge{background:#1a5fa8;color:#fff;border-radius:10px;min-width:20px;height:20px;font-size:11px;font-weight:600;display:flex;align-items:center;justify-content:center;padding:0 6px;flex-shrink:0}.mention-badge{width:20px;height:20px;border-radius:999px;background:#7fb4ff33;border:1px solid rgba(127,180,255,.55);color:#bfdbfe;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex-shrink:0;margin-left:6px;box-shadow:0 0 0 2px #7fb4ff0f}.empty-state{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 24px;color:#9ca3af}.empty-state mat-icon{font-size:48px;width:48px;height:48px;margin-bottom:12px}.empty-state p{margin:0 0 16px;font-size:14px}.settings-panel{padding:16px;color:#fff;display:flex;flex-direction:column;gap:12px}.settings-card{border-radius:14px;background:#ffffff12;border:1px solid rgba(255,255,255,.12);padding:16px;box-shadow:0 10px 28px #0000002e}.settings-header{display:flex;gap:12px;align-items:flex-start;margin-bottom:16px}.settings-icon{width:36px;height:36px;border-radius:10px;background:#1a5fa859;display:flex;align-items:center;justify-content:center;flex-shrink:0}.settings-icon mat-icon{color:#bfdbfe}.settings-icon.display-icon{background:#86efac24}.settings-icon.display-icon mat-icon{color:#bbf7d0}.settings-header h4{margin:0 0 4px;font-size:15px;font-weight:700}.settings-header p{margin:0;color:#ffffffa6;font-size:12px;line-height:1.4}.settings-toggle{width:100%;justify-content:center;border-radius:10px;color:#fff!important;border-color:#fff3!important;margin-bottom:16px}.settings-toggle mat-icon{margin-right:8px;font-size:18px;width:18px;height:18px}.volume-label{display:flex;justify-content:space-between;align-items:center;color:#ffffffc7;font-size:12px;font-weight:600;margin-bottom:8px}.settings-volume{width:100%;accent-color:#7fb4ff;cursor:pointer;margin-bottom:12px}.settings-preview{margin:0 0 16px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:#ffffff0f;color:#f5f7ff;box-sizing:border-box}.message-preview{padding:9px 11px;line-height:1.35}.code-preview{padding:10px 11px;overflow:hidden;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,Liberation Mono,monospace;line-height:1.45;white-space:pre-wrap;color:#dbeafe;background:#061827;margin-bottom:0}.context-menu{position:fixed;z-index:10001;background:#071d30;border-radius:8px;padding:4px 0;box-shadow:0 8px 24px #0000004d;min-width:200px}.ctx-item{display:flex;align-items:center;gap:10px;padding:10px 16px;cursor:pointer;color:#ffffffe6;font-size:13px;transition:background .15s}.ctx-item:hover{background:#ffffff1a}.ctx-item mat-icon{font-size:18px;width:18px;height:18px}.ctx-danger{color:#f87171}.ctx-danger:hover{background:#f8717126}.ctx-backdrop{position:fixed;inset:0;z-index:10000}\n"], dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i2.NgForOf, selector: "[ngFor][ngForOf]", inputs: ["ngForOf", "ngForTrackBy", "ngForTemplate"] }, { kind: "directive", type: i2.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "pipe", type: i2.DecimalPipe, name: "number" }, { kind: "ngmodule", type: FormsModule }, { kind: "directive", type: i3.DefaultValueAccessor, selector: "input:not([type=checkbox])[formControlName],textarea[formControlName],input:not([type=checkbox])[formControl],textarea[formControl],input:not([type=checkbox])[ngModel],textarea[ngModel],[ngDefaultControl]" }, { kind: "directive", type: i3.RangeValueAccessor, selector: "input[type=range][formControlName],input[type=range][formControl],input[type=range][ngModel]" }, { kind: "directive", type: i3.NgControlStatus, selector: "[formControlName],[ngModel],[formControl]" }, { kind: "directive", type: i3.NgModel, selector: "[ngModel]:not([formControlName]):not([formControl])", inputs: ["name", "disabled", "ngModel", "ngModelOptions"], outputs: ["ngModelChange"], exportAs: ["ngModel"] }, { kind: "ngmodule", type: MatIconModule }, { kind: "component", type: i4.MatIcon, selector: "mat-icon", inputs: ["color", "inline", "svgIcon", "fontSet", "fontIcon"], exportAs: ["matIcon"] }, { kind: "ngmodule", type: MatButtonModule }, { kind: "component", type: i5.MatButton, selector: "    button[mat-button], button[mat-raised-button], button[mat-flat-button],    button[mat-stroked-button]  ", exportAs: ["matButton"] }, { kind: "ngmodule", type: MatRippleModule }, { kind: "directive", type: i6.MatRipple, selector: "[mat-ripple], [matRipple]", inputs: ["matRippleColor", "matRippleUnbounded", "matRippleCentered", "matRippleRadius", "matRippleAnimation", "matRippleDisabled", "matRippleTrigger"], exportAs: ["matRipple"] }, { kind: "ngmodule", type: MatTooltipModule }, { kind: "directive", type: i7.MatTooltip, selector: "[matTooltip]", inputs: ["matTooltipPosition", "matTooltipPositionAtOrigin", "matTooltipDisabled", "matTooltipShowDelay", "matTooltipHideDelay", "matTooltipTouchGestures", "matTooltip", "matTooltipClass"], exportAs: ["matTooltip"] }] });
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
        <ng-container *ngIf="activeTab === 'projects' && projectGroupsEnabled; else standardConversationList">
          <div *ngFor="let project of projectContainers" class="project-container">
            <div class="project-header" (click)="toggleProject(project)">
              <div class="avatar project-avatar">
                <mat-icon>workspaces</mat-icon>
              </div>
              <div class="conversation-info">
                <div class="info-top">
                  <span class="conv-name">{{ project.name || 'Project Group' }}</span>
                  <button
                    type="button"
                    class="subgroup-create"
                    (click)="createSubgroup(project, $event)"
                    matTooltip="Create subgroup"
                    matTooltipPosition="above"
                  >
                    <mat-icon>add</mat-icon>
                  </button>
                </div>
                <div class="info-bottom">
                  <span class="conv-preview">{{ projectSubgroups(project).length }} subgroup{{ projectSubgroups(project).length === 1 ? '' : 's' }}</span>
                  <mat-icon class="expand-icon">{{ isProjectExpanded(project) ? 'expand_less' : 'expand_more' }}</mat-icon>
                </div>
              </div>
            </div>

            <div *ngIf="isProjectExpanded(project)" class="subgroup-list">
              <div
                *ngFor="let item of projectSubgroups(project)"
                class="conversation-item subgroup-item"
                matRipple
                [class.has-unread]="item.unread_count > 0"
                (click)="openConversation(item)"
                (contextmenu)="onContextMenu($event, item)"
              >
                <div class="avatar subgroup-avatar">
                  <mat-icon>forum</mat-icon>
                </div>
                <div class="conversation-info">
                  <div class="info-top">
                    <span class="conv-name">{{ item.name || 'Subgroup' }}</span>
                    <span class="conv-time">{{ formatTime(item.last_message_at) }}</span>
                  </div>
                  <div class="info-bottom">
                    <span class="conv-preview">{{ item.subgroup_subject || item.last_message_preview || 'No messages yet' }}</span>
                    <span *ngIf="item.unread_count > 0" class="unread-badge">
                      {{ item.unread_count > 99 ? '99+' : item.unread_count }}
                    </span>
                  </div>
                </div>
              </div>
              <div *ngIf="projectSubgroups(project).length === 0" class="empty-subgroups">
                No subgroups yet
              </div>
            </div>
          </div>
        </ng-container>

        <ng-template #standardConversationList>
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
              <mat-icon>{{ isProject(item) ? 'forum' : item.is_group ? 'group' : 'person' }}</mat-icon>
            </div>
            <div class="conversation-info">
              <div class="info-top">
                <span class="conv-name">{{ item.name || 'Direct Message' }}</span>
                <span class="conv-time">{{ formatTime(item.last_message_at) }}</span>
              </div>
              <div class="info-bottom">
                <span class="conv-preview">{{ item.subgroup_subject || item.last_message_preview || 'No messages yet' }}</span>
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
        </ng-template>

        <div *ngIf="showEmptyState" class="empty-state">
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
          *ngIf="projectGroupsEnabled"
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
  `, styles: [".inbox-container{display:flex;flex-direction:column;height:100%;background:transparent;container-type:inline-size}.search-bar{display:flex;align-items:center;margin:8px 16px;padding:8px 12px;background:transparent;border-radius:10px}.search-icon{color:#ffffffb3;font-size:18px;width:20px;height:20px;margin-right:8px}.search-input{flex:1;border:none;outline:none;background:transparent;font-size:14px;color:#fff}.search-input::placeholder{color:#fff9}.inbox-tabs{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:5px;padding:10px 16px 12px;border-top:1px solid rgba(255,255,255,.1);flex-shrink:0}.inbox-tab{min-width:0;border:1px solid rgba(255,255,255,.14);background:#ffffff0f;color:#ffffffb8;border-radius:999px;padding:6px 4px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:background .15s,border-color .15s,color .15s}.inbox-tab mat-icon{font-size:clamp(17px,6cqw,21px);width:clamp(17px,6cqw,21px);height:clamp(17px,6cqw,21px);line-height:clamp(17px,6cqw,21px)}.inbox-tab:hover{background:#ffffff1f;color:#fff}.inbox-tab.active{background:#1a5fa859;border-color:#7fb4ff73;color:#fff}@container (max-width: 330px){.inbox-tabs{gap:3px;padding:8px 8px 10px}.inbox-tab{padding:6px 2px;letter-spacing:-.2px}}@container (max-width: 280px){.inbox-tabs{gap:2px;padding-left:6px;padding-right:6px}.inbox-tab{font-size:8.5px}}.conversation-list{flex:1;overflow-y:auto;scrollbar-width:none;-ms-overflow-style:none}.conversation-list::-webkit-scrollbar{display:none}.conversation-item{display:flex;align-items:center;padding:12px 16px;cursor:pointer;transition:background .15s;gap:12px}.conversation-item:hover{background:#ffffff1a}.conversation-item.has-unread{background:#ffffff26}.avatar{width:48px;height:48px;border-radius:50%;background:#0d2540;display:flex;align-items:center;justify-content:center;flex-shrink:0}.avatar mat-icon{color:#ffffffb3;font-size:24px}.group-avatar{background:#0a1f38}.group-avatar mat-icon{color:#ffffffb3}.project-avatar{background:#2563eb33}.project-avatar mat-icon{color:#bfdbfe}.project-container{border-bottom:1px solid rgba(255,255,255,.06)}.project-header{display:flex;align-items:center;padding:12px 16px;cursor:pointer;gap:12px;transition:background .15s}.project-header:hover{background:#ffffff14}.subgroup-create{width:28px;height:28px;border:1px solid rgba(191,219,254,.35);border-radius:999px;background:#2563eb2e;color:#bfdbfe;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0}.subgroup-create mat-icon{font-size:18px;width:18px;height:18px}.expand-icon{color:#fff9;font-size:20px;width:20px;height:20px;flex-shrink:0}.subgroup-list{padding-bottom:6px}.subgroup-item{padding-left:32px;background:#ffffff06}.subgroup-avatar{width:38px;height:38px;background:#3b82f624}.subgroup-avatar mat-icon{color:#dbeafe;font-size:21px}.empty-subgroups{padding:8px 16px 12px 92px;color:#ffffff8c;font-size:12px}.conversation-info{flex:1;min-width:0}.info-top{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:2px}.conv-name{font-weight:600;font-size:14px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px}.conv-time{font-size:11px;color:#ffffffb3;flex-shrink:0;margin-left:8px}.info-bottom{display:flex;justify-content:space-between;align-items:center;gap:6px}.conv-preview{font-size:13px;color:#ffffffb3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px}.has-unread .conv-name{color:#fff}.has-unread .conv-preview{color:#ffffffe6;font-weight:500}.unread-badge{background:#1a5fa8;color:#fff;border-radius:10px;min-width:20px;height:20px;font-size:11px;font-weight:600;display:flex;align-items:center;justify-content:center;padding:0 6px;flex-shrink:0}.mention-badge{width:20px;height:20px;border-radius:999px;background:#7fb4ff33;border:1px solid rgba(127,180,255,.55);color:#bfdbfe;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex-shrink:0;margin-left:6px;box-shadow:0 0 0 2px #7fb4ff0f}.empty-state{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 24px;color:#9ca3af}.empty-state mat-icon{font-size:48px;width:48px;height:48px;margin-bottom:12px}.empty-state p{margin:0 0 16px;font-size:14px}.settings-panel{padding:16px;color:#fff;display:flex;flex-direction:column;gap:12px}.settings-card{border-radius:14px;background:#ffffff12;border:1px solid rgba(255,255,255,.12);padding:16px;box-shadow:0 10px 28px #0000002e}.settings-header{display:flex;gap:12px;align-items:flex-start;margin-bottom:16px}.settings-icon{width:36px;height:36px;border-radius:10px;background:#1a5fa859;display:flex;align-items:center;justify-content:center;flex-shrink:0}.settings-icon mat-icon{color:#bfdbfe}.settings-icon.display-icon{background:#86efac24}.settings-icon.display-icon mat-icon{color:#bbf7d0}.settings-header h4{margin:0 0 4px;font-size:15px;font-weight:700}.settings-header p{margin:0;color:#ffffffa6;font-size:12px;line-height:1.4}.settings-toggle{width:100%;justify-content:center;border-radius:10px;color:#fff!important;border-color:#fff3!important;margin-bottom:16px}.settings-toggle mat-icon{margin-right:8px;font-size:18px;width:18px;height:18px}.volume-label{display:flex;justify-content:space-between;align-items:center;color:#ffffffc7;font-size:12px;font-weight:600;margin-bottom:8px}.settings-volume{width:100%;accent-color:#7fb4ff;cursor:pointer;margin-bottom:12px}.settings-preview{margin:0 0 16px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:#ffffff0f;color:#f5f7ff;box-sizing:border-box}.message-preview{padding:9px 11px;line-height:1.35}.code-preview{padding:10px 11px;overflow:hidden;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,Liberation Mono,monospace;line-height:1.45;white-space:pre-wrap;color:#dbeafe;background:#061827;margin-bottom:0}.context-menu{position:fixed;z-index:10001;background:#071d30;border-radius:8px;padding:4px 0;box-shadow:0 8px 24px #0000004d;min-width:200px}.ctx-item{display:flex;align-items:center;gap:10px;padding:10px 16px;cursor:pointer;color:#ffffffe6;font-size:13px;transition:background .15s}.ctx-item:hover{background:#ffffff1a}.ctx-item mat-icon{font-size:18px;width:18px;height:18px}.ctx-danger{color:#f87171}.ctx-danger:hover{background:#f8717126}.ctx-backdrop{position:fixed;inset:0;z-index:10000}\n"] }]
        }], ctorParameters: () => [{ type: i1.MessagingStoreService }] });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5ib3gtbGlzdC5jb21wb25lbnQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvbGliL2NvbXBvbmVudHMvaW5ib3gtbGlzdC9pbmJveC1saXN0LmNvbXBvbmVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsU0FBUyxFQUFxQixNQUFNLGVBQWUsQ0FBQztBQUM3RCxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDL0MsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLGdCQUFnQixDQUFDO0FBQzdDLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSx3QkFBd0IsQ0FBQztBQUN2RCxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFDM0QsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHdCQUF3QixDQUFDO0FBQ3pELE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBQzdELE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxNQUFNLENBQUM7QUFFcEMsT0FBTyxFQUFhLGtCQUFrQixFQUFFLHFCQUFxQixFQUFFLGlCQUFpQixFQUFFLE1BQU0sK0JBQStCLENBQUM7Ozs7Ozs7OztBQXl4QnhILE1BQU0sT0FBTyxrQkFBa0I7SUFhVDtJQVpwQixLQUFLLEdBQWdCLEVBQUUsQ0FBQztJQUN4QixXQUFXLEdBQUcsRUFBRSxDQUFDO0lBQ2pCLFNBQVMsR0FBMEQsS0FBSyxDQUFDO0lBQ3pFLGtCQUFrQixHQUFHLElBQUksQ0FBQztJQUMxQixrQkFBa0IsR0FBRyxLQUFLLENBQUM7SUFDM0IsZ0JBQWdCLEdBQUcsQ0FBQyxDQUFDO0lBQ3JCLGFBQWEsR0FBRyxDQUFDLENBQUM7SUFDbEIsV0FBVyxHQUFxRCxJQUFJLENBQUM7SUFDckUsa0JBQWtCLEdBQUcsSUFBSSxHQUFHLEVBQVUsQ0FBQztJQUN0QixhQUFhLEdBQUcsNEJBQTRCLENBQUM7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QixrQkFBa0IsMEVBbnhCbkI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7R0F3UlQsNDBNQXpSUyxZQUFZLHVUQUFFLFdBQVcsNHdCQUFFLGFBQWEsbUxBQUUsZUFBZSwyTkFBRSxlQUFlLGtTQUFFLGdCQUFnQjs7NEZBb3hCM0Ysa0JBQWtCO2tCQXZ4QjlCLFNBQVM7K0JBQ0UsZ0JBQWdCLGNBQ2QsSUFBSSxXQUNQLENBQUMsWUFBWSxFQUFFLFdBQVcsRUFBRSxhQUFhLEVBQUUsZUFBZSxFQUFFLGVBQWUsRUFBRSxnQkFBZ0IsQ0FBQyxZQUM3Rjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQXdSVCIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IENvbXBvbmVudCwgT25Jbml0LCBPbkRlc3Ryb3kgfSBmcm9tICdAYW5ndWxhci9jb3JlJztcclxuaW1wb3J0IHsgQ29tbW9uTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvY29tbW9uJztcclxuaW1wb3J0IHsgRm9ybXNNb2R1bGUgfSBmcm9tICdAYW5ndWxhci9mb3Jtcyc7XHJcbmltcG9ydCB7IE1hdEljb25Nb2R1bGUgfSBmcm9tICdAYW5ndWxhci9tYXRlcmlhbC9pY29uJztcclxuaW1wb3J0IHsgTWF0QnV0dG9uTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvbWF0ZXJpYWwvYnV0dG9uJztcclxuaW1wb3J0IHsgTWF0UmlwcGxlTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvbWF0ZXJpYWwvY29yZSc7XHJcbmltcG9ydCB7IE1hdFRvb2x0aXBNb2R1bGUgfSBmcm9tICdAYW5ndWxhci9tYXRlcmlhbC90b29sdGlwJztcclxuaW1wb3J0IHsgU3Vic2NyaXB0aW9uIH0gZnJvbSAncnhqcyc7XHJcbmltcG9ydCB7IE1lc3NhZ2luZ1N0b3JlU2VydmljZSB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL21lc3NhZ2luZy1zdG9yZS5zZXJ2aWNlJztcclxuaW1wb3J0IHsgSW5ib3hJdGVtLCBpc1Byb2plY3RDb250YWluZXIsIGlzUHJvamVjdENvbnZlcnNhdGlvbiwgaXNQcm9qZWN0U3ViZ3JvdXAgfSBmcm9tICcuLi8uLi9tb2RlbHMvbWVzc2FnaW5nLm1vZGVscyc7XHJcblxyXG5AQ29tcG9uZW50KHtcclxuICBzZWxlY3RvcjogJ2FwcC1pbmJveC1saXN0JyxcclxuICBzdGFuZGFsb25lOiB0cnVlLFxyXG4gIGltcG9ydHM6IFtDb21tb25Nb2R1bGUsIEZvcm1zTW9kdWxlLCBNYXRJY29uTW9kdWxlLCBNYXRCdXR0b25Nb2R1bGUsIE1hdFJpcHBsZU1vZHVsZSwgTWF0VG9vbHRpcE1vZHVsZV0sXHJcbiAgdGVtcGxhdGU6IGBcclxuICAgIDxkaXYgY2xhc3M9XCJpbmJveC1jb250YWluZXJcIj5cclxuICAgICAgPGRpdiAqbmdJZj1cImFjdGl2ZVRhYiAhPT0gJ3NldHRpbmdzJ1wiIGNsYXNzPVwic2VhcmNoLWJhclwiPlxyXG4gICAgICAgIDxtYXQtaWNvbiBjbGFzcz1cInNlYXJjaC1pY29uXCI+c2VhcmNoPC9tYXQtaWNvbj5cclxuICAgICAgICA8aW5wdXRcclxuICAgICAgICAgIHR5cGU9XCJ0ZXh0XCJcclxuICAgICAgICAgIFsobmdNb2RlbCldPVwic2VhcmNoUXVlcnlcIlxyXG4gICAgICAgICAgcGxhY2Vob2xkZXI9XCJTZWFyY2ggY29udmVyc2F0aW9ucy4uLlwiXHJcbiAgICAgICAgICBjbGFzcz1cInNlYXJjaC1pbnB1dFwiXHJcbiAgICAgICAgLz5cclxuICAgICAgPC9kaXY+XHJcblxyXG4gICAgICA8ZGl2IGNsYXNzPVwiY29udmVyc2F0aW9uLWxpc3RcIj5cclxuICAgICAgICA8bmctY29udGFpbmVyICpuZ0lmPVwiYWN0aXZlVGFiID09PSAncHJvamVjdHMnICYmIHByb2plY3RHcm91cHNFbmFibGVkOyBlbHNlIHN0YW5kYXJkQ29udmVyc2F0aW9uTGlzdFwiPlxyXG4gICAgICAgICAgPGRpdiAqbmdGb3I9XCJsZXQgcHJvamVjdCBvZiBwcm9qZWN0Q29udGFpbmVyc1wiIGNsYXNzPVwicHJvamVjdC1jb250YWluZXJcIj5cclxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cInByb2plY3QtaGVhZGVyXCIgKGNsaWNrKT1cInRvZ2dsZVByb2plY3QocHJvamVjdClcIj5cclxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiYXZhdGFyIHByb2plY3QtYXZhdGFyXCI+XHJcbiAgICAgICAgICAgICAgICA8bWF0LWljb24+d29ya3NwYWNlczwvbWF0LWljb24+XHJcbiAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImNvbnZlcnNhdGlvbi1pbmZvXCI+XHJcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiaW5mby10b3BcIj5cclxuICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJjb252LW5hbWVcIj57eyBwcm9qZWN0Lm5hbWUgfHwgJ1Byb2plY3QgR3JvdXAnIH19PC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICA8YnV0dG9uXHJcbiAgICAgICAgICAgICAgICAgICAgdHlwZT1cImJ1dHRvblwiXHJcbiAgICAgICAgICAgICAgICAgICAgY2xhc3M9XCJzdWJncm91cC1jcmVhdGVcIlxyXG4gICAgICAgICAgICAgICAgICAgIChjbGljayk9XCJjcmVhdGVTdWJncm91cChwcm9qZWN0LCAkZXZlbnQpXCJcclxuICAgICAgICAgICAgICAgICAgICBtYXRUb29sdGlwPVwiQ3JlYXRlIHN1Ymdyb3VwXCJcclxuICAgICAgICAgICAgICAgICAgICBtYXRUb29sdGlwUG9zaXRpb249XCJhYm92ZVwiXHJcbiAgICAgICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgICAgICA8bWF0LWljb24+YWRkPC9tYXQtaWNvbj5cclxuICAgICAgICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJpbmZvLWJvdHRvbVwiPlxyXG4gICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cImNvbnYtcHJldmlld1wiPnt7IHByb2plY3RTdWJncm91cHMocHJvamVjdCkubGVuZ3RoIH19IHN1Ymdyb3Vwe3sgcHJvamVjdFN1Ymdyb3Vwcyhwcm9qZWN0KS5sZW5ndGggPT09IDEgPyAnJyA6ICdzJyB9fTwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgPG1hdC1pY29uIGNsYXNzPVwiZXhwYW5kLWljb25cIj57eyBpc1Byb2plY3RFeHBhbmRlZChwcm9qZWN0KSA/ICdleHBhbmRfbGVzcycgOiAnZXhwYW5kX21vcmUnIH19PC9tYXQtaWNvbj5cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgICAgIDxkaXYgKm5nSWY9XCJpc1Byb2plY3RFeHBhbmRlZChwcm9qZWN0KVwiIGNsYXNzPVwic3ViZ3JvdXAtbGlzdFwiPlxyXG4gICAgICAgICAgICAgIDxkaXZcclxuICAgICAgICAgICAgICAgICpuZ0Zvcj1cImxldCBpdGVtIG9mIHByb2plY3RTdWJncm91cHMocHJvamVjdClcIlxyXG4gICAgICAgICAgICAgICAgY2xhc3M9XCJjb252ZXJzYXRpb24taXRlbSBzdWJncm91cC1pdGVtXCJcclxuICAgICAgICAgICAgICAgIG1hdFJpcHBsZVxyXG4gICAgICAgICAgICAgICAgW2NsYXNzLmhhcy11bnJlYWRdPVwiaXRlbS51bnJlYWRfY291bnQgPiAwXCJcclxuICAgICAgICAgICAgICAgIChjbGljayk9XCJvcGVuQ29udmVyc2F0aW9uKGl0ZW0pXCJcclxuICAgICAgICAgICAgICAgIChjb250ZXh0bWVudSk9XCJvbkNvbnRleHRNZW51KCRldmVudCwgaXRlbSlcIlxyXG4gICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJhdmF0YXIgc3ViZ3JvdXAtYXZhdGFyXCI+XHJcbiAgICAgICAgICAgICAgICAgIDxtYXQtaWNvbj5mb3J1bTwvbWF0LWljb24+XHJcbiAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJjb252ZXJzYXRpb24taW5mb1wiPlxyXG4gICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiaW5mby10b3BcIj5cclxuICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cImNvbnYtbmFtZVwiPnt7IGl0ZW0ubmFtZSB8fCAnU3ViZ3JvdXAnIH19PC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwiY29udi10aW1lXCI+e3sgZm9ybWF0VGltZShpdGVtLmxhc3RfbWVzc2FnZV9hdCkgfX08L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiaW5mby1ib3R0b21cIj5cclxuICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cImNvbnYtcHJldmlld1wiPnt7IGl0ZW0uc3ViZ3JvdXBfc3ViamVjdCB8fCBpdGVtLmxhc3RfbWVzc2FnZV9wcmV2aWV3IHx8ICdObyBtZXNzYWdlcyB5ZXQnIH19PC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgIDxzcGFuICpuZ0lmPVwiaXRlbS51bnJlYWRfY291bnQgPiAwXCIgY2xhc3M9XCJ1bnJlYWQtYmFkZ2VcIj5cclxuICAgICAgICAgICAgICAgICAgICAgIHt7IGl0ZW0udW5yZWFkX2NvdW50ID4gOTkgPyAnOTkrJyA6IGl0ZW0udW5yZWFkX2NvdW50IH19XHJcbiAgICAgICAgICAgICAgICAgICAgPC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgIDxkaXYgKm5nSWY9XCJwcm9qZWN0U3ViZ3JvdXBzKHByb2plY3QpLmxlbmd0aCA9PT0gMFwiIGNsYXNzPVwiZW1wdHktc3ViZ3JvdXBzXCI+XHJcbiAgICAgICAgICAgICAgICBObyBzdWJncm91cHMgeWV0XHJcbiAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgPC9uZy1jb250YWluZXI+XHJcblxyXG4gICAgICAgIDxuZy10ZW1wbGF0ZSAjc3RhbmRhcmRDb252ZXJzYXRpb25MaXN0PlxyXG4gICAgICAgICAgPGRpdlxyXG4gICAgICAgICAgICAqbmdGb3I9XCJsZXQgaXRlbSBvZiBmaWx0ZXJlZEluYm94XCJcclxuICAgICAgICAgICAgY2xhc3M9XCJjb252ZXJzYXRpb24taXRlbVwiXHJcbiAgICAgICAgICAgIG1hdFJpcHBsZVxyXG4gICAgICAgICAgICBbY2xhc3MuaGFzLXVucmVhZF09XCJpdGVtLnVucmVhZF9jb3VudCA+IDBcIlxyXG4gICAgICAgICAgICAoY2xpY2spPVwib3BlbkNvbnZlcnNhdGlvbihpdGVtKVwiXHJcbiAgICAgICAgICAgIChjb250ZXh0bWVudSk9XCJvbkNvbnRleHRNZW51KCRldmVudCwgaXRlbSlcIlxyXG4gICAgICAgICAgPlxyXG4gICAgICAgICAgICA8ZGl2XHJcbiAgICAgICAgICAgICAgY2xhc3M9XCJhdmF0YXJcIlxyXG4gICAgICAgICAgICAgIFtjbGFzcy5ncm91cC1hdmF0YXJdPVwiaXRlbS5pc19ncm91cCAmJiAhaXNQcm9qZWN0KGl0ZW0pXCJcclxuICAgICAgICAgICAgICBbY2xhc3MucHJvamVjdC1hdmF0YXJdPVwiaXNQcm9qZWN0KGl0ZW0pXCJcclxuICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgIDxtYXQtaWNvbj57eyBpc1Byb2plY3QoaXRlbSkgPyAnZm9ydW0nIDogaXRlbS5pc19ncm91cCA/ICdncm91cCcgOiAncGVyc29uJyB9fTwvbWF0LWljb24+XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwiY29udmVyc2F0aW9uLWluZm9cIj5cclxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiaW5mby10b3BcIj5cclxuICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwiY29udi1uYW1lXCI+e3sgaXRlbS5uYW1lIHx8ICdEaXJlY3QgTWVzc2FnZScgfX08L3NwYW4+XHJcbiAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cImNvbnYtdGltZVwiPnt7IGZvcm1hdFRpbWUoaXRlbS5sYXN0X21lc3NhZ2VfYXQpIH19PC9zcGFuPlxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJpbmZvLWJvdHRvbVwiPlxyXG4gICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJjb252LXByZXZpZXdcIj57eyBpdGVtLnN1Ymdyb3VwX3N1YmplY3QgfHwgaXRlbS5sYXN0X21lc3NhZ2VfcHJldmlldyB8fCAnTm8gbWVzc2FnZXMgeWV0JyB9fTwvc3Bhbj5cclxuICAgICAgICAgICAgICAgIDxzcGFuXHJcbiAgICAgICAgICAgICAgICAgICpuZ0lmPVwiaXRlbS5oYXNfbWVudGlvblwiXHJcbiAgICAgICAgICAgICAgICAgIGNsYXNzPVwibWVudGlvbi1iYWRnZVwiXHJcbiAgICAgICAgICAgICAgICAgIG1hdFRvb2x0aXA9XCJZb3Ugd2VyZSBtZW50aW9uZWRcIlxyXG4gICAgICAgICAgICAgICAgICBtYXRUb29sdGlwUG9zaXRpb249XCJhYm92ZVwiXHJcbiAgICAgICAgICAgICAgICA+JiM2NDs8L3NwYW4+XHJcbiAgICAgICAgICAgICAgICA8c3BhbiAqbmdJZj1cIml0ZW0udW5yZWFkX2NvdW50ID4gMFwiIGNsYXNzPVwidW5yZWFkLWJhZGdlXCI+XHJcbiAgICAgICAgICAgICAgICAgIHt7IGl0ZW0udW5yZWFkX2NvdW50ID4gOTkgPyAnOTkrJyA6IGl0ZW0udW5yZWFkX2NvdW50IH19XHJcbiAgICAgICAgICAgICAgICA8L3NwYW4+XHJcbiAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgPC9uZy10ZW1wbGF0ZT5cclxuXHJcbiAgICAgICAgPGRpdiAqbmdJZj1cInNob3dFbXB0eVN0YXRlXCIgY2xhc3M9XCJlbXB0eS1zdGF0ZVwiPlxyXG4gICAgICAgICAgPG1hdC1pY29uPnt7IGFjdGl2ZVRhYiA9PT0gJ3Byb2plY3RzJyA/ICd3b3Jrc3BhY2VzJyA6IGFjdGl2ZVRhYiA9PT0gJ2dyb3VwcycgPyAnZ3JvdXAnIDogJ2ZvcnVtJyB9fTwvbWF0LWljb24+XHJcbiAgICAgICAgICA8cD57eyBlbXB0eVN0YXRlVGV4dCB9fTwvcD5cclxuICAgICAgICAgIDxidXR0b24gKm5nSWY9XCIhc2VhcmNoUXVlcnkgJiYgYWN0aXZlVGFiICE9PSAnZ3JvdXBzJyAmJiBhY3RpdmVUYWIgIT09ICdwcm9qZWN0cydcIiBtYXQtc3Ryb2tlZC1idXR0b24gY29sb3I9XCJwcmltYXJ5XCIgKGNsaWNrKT1cIm9uTmV3Q29udmVyc2F0aW9uKClcIj5cclxuICAgICAgICAgICAgU3RhcnQgYSBjb252ZXJzYXRpb25cclxuICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgPGJ1dHRvbiAqbmdJZj1cIiFzZWFyY2hRdWVyeSAmJiBhY3RpdmVUYWIgPT09ICdncm91cHMnXCIgbWF0LXN0cm9rZWQtYnV0dG9uIGNvbG9yPVwicHJpbWFyeVwiIChjbGljayk9XCJvbkNyZWF0ZUdyb3VwKClcIj5cclxuICAgICAgICAgICAgQ3JlYXRlIGEgZ3JvdXBcclxuICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICA8ZGl2ICpuZ0lmPVwiYWN0aXZlVGFiID09PSAnc2V0dGluZ3MnXCIgY2xhc3M9XCJzZXR0aW5ncy1wYW5lbFwiPlxyXG4gICAgICAgICAgPGRpdiBjbGFzcz1cInNldHRpbmdzLWNhcmRcIj5cclxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cInNldHRpbmdzLWhlYWRlclwiPlxyXG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJzZXR0aW5ncy1pY29uXCI+XHJcbiAgICAgICAgICAgICAgICA8bWF0LWljb24+e3sgbm90aWZpY2F0aW9uc011dGVkIHx8IG5vdGlmaWNhdGlvblZvbHVtZSA8PSAwID8gJ3ZvbHVtZV9vZmYnIDogJ3ZvbHVtZV91cCcgfX08L21hdC1pY29uPlxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgIDxkaXY+XHJcbiAgICAgICAgICAgICAgICA8aDQ+Tm90aWZpY2F0aW9uIFNvdW5kPC9oND5cclxuICAgICAgICAgICAgICAgIDxwPkNvbnRyb2wgbWVzc2FnZSBhbGVydHMgZm9yIHRoaXMgYnJvd3Nlci48L3A+XHJcbiAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxyXG4gICAgICAgICAgICAgIG1hdC1zdHJva2VkLWJ1dHRvblxyXG4gICAgICAgICAgICAgIGNsYXNzPVwic2V0dGluZ3MtdG9nZ2xlXCJcclxuICAgICAgICAgICAgICAoY2xpY2spPVwidG9nZ2xlTm90aWZpY2F0aW9uc011dGVkKClcIlxyXG4gICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgPG1hdC1pY29uPnt7IG5vdGlmaWNhdGlvbnNNdXRlZCA/ICd2b2x1bWVfdXAnIDogJ3ZvbHVtZV9vZmYnIH19PC9tYXQtaWNvbj5cclxuICAgICAgICAgICAgICB7eyBub3RpZmljYXRpb25zTXV0ZWQgPyAnVW5tdXRlIG5vdGlmaWNhdGlvbnMnIDogJ011dGUgbm90aWZpY2F0aW9ucycgfX1cclxuICAgICAgICAgICAgPC9idXR0b24+XHJcblxyXG4gICAgICAgICAgICA8bGFiZWwgY2xhc3M9XCJ2b2x1bWUtbGFiZWxcIiBmb3I9XCJtZXNzYWdpbmctdm9sdW1lLXNsaWRlclwiPlxyXG4gICAgICAgICAgICAgIFZvbHVtZVxyXG4gICAgICAgICAgICAgIDxzcGFuPnt7IChub3RpZmljYXRpb25Wb2x1bWUgKiAxMDApIHwgbnVtYmVyOicxLjAtMCcgfX0lPC9zcGFuPlxyXG4gICAgICAgICAgICA8L2xhYmVsPlxyXG4gICAgICAgICAgICA8aW5wdXRcclxuICAgICAgICAgICAgICBpZD1cIm1lc3NhZ2luZy12b2x1bWUtc2xpZGVyXCJcclxuICAgICAgICAgICAgICB0eXBlPVwicmFuZ2VcIlxyXG4gICAgICAgICAgICAgIG1pbj1cIjBcIlxyXG4gICAgICAgICAgICAgIG1heD1cIjFcIlxyXG4gICAgICAgICAgICAgIHN0ZXA9XCIwLjA1XCJcclxuICAgICAgICAgICAgICBjbGFzcz1cInNldHRpbmdzLXZvbHVtZVwiXHJcbiAgICAgICAgICAgICAgWyhuZ01vZGVsKV09XCJub3RpZmljYXRpb25Wb2x1bWVcIlxyXG4gICAgICAgICAgICAgIChuZ01vZGVsQ2hhbmdlKT1cIm9uTm90aWZpY2F0aW9uVm9sdW1lQ2hhbmdlKCRldmVudClcIlxyXG4gICAgICAgICAgICAgIChjaGFuZ2UpPVwicHJldmlld05vdGlmaWNhdGlvblNvdW5kKClcIlxyXG4gICAgICAgICAgICAvPlxyXG4gICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgPGRpdiBjbGFzcz1cInNldHRpbmdzLWNhcmRcIj5cclxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cInNldHRpbmdzLWhlYWRlclwiPlxyXG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJzZXR0aW5ncy1pY29uIGRpc3BsYXktaWNvblwiPlxyXG4gICAgICAgICAgICAgICAgPG1hdC1pY29uPnRleHRfZmllbGRzPC9tYXQtaWNvbj5cclxuICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICA8ZGl2PlxyXG4gICAgICAgICAgICAgICAgPGg0PkRpc3BsYXkgU2l6ZTwvaDQ+XHJcbiAgICAgICAgICAgICAgICA8cD5BZGp1c3QgbWVzc2FnZSB0ZXh0IGFuZCBwcm9ncmFtbWluZyBibG9jayBzaXplcy48L3A+XHJcbiAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgICAgPGxhYmVsIGNsYXNzPVwidm9sdW1lLWxhYmVsXCIgZm9yPVwibWVzc2FnaW5nLW1lc3NhZ2Utc2l6ZS1zbGlkZXJcIj5cclxuICAgICAgICAgICAgICBNZXNzYWdlIHNpemVcclxuICAgICAgICAgICAgICA8c3Bhbj57eyAobWVzc2FnZVRleHRTY2FsZSAqIDEwMCkgfCBudW1iZXI6JzEuMC0wJyB9fSU8L3NwYW4+XHJcbiAgICAgICAgICAgIDwvbGFiZWw+XHJcbiAgICAgICAgICAgIDxpbnB1dFxyXG4gICAgICAgICAgICAgIGlkPVwibWVzc2FnaW5nLW1lc3NhZ2Utc2l6ZS1zbGlkZXJcIlxyXG4gICAgICAgICAgICAgIHR5cGU9XCJyYW5nZVwiXHJcbiAgICAgICAgICAgICAgbWluPVwiMC44XCJcclxuICAgICAgICAgICAgICBtYXg9XCIxLjVcIlxyXG4gICAgICAgICAgICAgIHN0ZXA9XCIwLjA1XCJcclxuICAgICAgICAgICAgICBjbGFzcz1cInNldHRpbmdzLXZvbHVtZVwiXHJcbiAgICAgICAgICAgICAgWyhuZ01vZGVsKV09XCJtZXNzYWdlVGV4dFNjYWxlXCJcclxuICAgICAgICAgICAgICAobmdNb2RlbENoYW5nZSk9XCJvbk1lc3NhZ2VUZXh0U2NhbGVDaGFuZ2UoJGV2ZW50KVwiXHJcbiAgICAgICAgICAgIC8+XHJcbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJzZXR0aW5ncy1wcmV2aWV3IG1lc3NhZ2UtcHJldmlld1wiIFtzdHlsZS5mb250LXNpemUucHhdPVwiMTMgKiBtZXNzYWdlVGV4dFNjYWxlXCI+XHJcbiAgICAgICAgICAgICAgVGhpcyBpcyBob3cgbm9ybWFsIG1lc3NhZ2UgdGV4dCB3aWxsIGFwcGVhciBpbiBjaGF0LlxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgICAgIDxsYWJlbCBjbGFzcz1cInZvbHVtZS1sYWJlbFwiIGZvcj1cIm1lc3NhZ2luZy1jb2RlLXNpemUtc2xpZGVyXCI+XHJcbiAgICAgICAgICAgICAgUHJvZ3JhbW1pbmcgc2l6ZVxyXG4gICAgICAgICAgICAgIDxzcGFuPnt7IChjb2RlVGV4dFNjYWxlICogMTAwKSB8IG51bWJlcjonMS4wLTAnIH19JTwvc3Bhbj5cclxuICAgICAgICAgICAgPC9sYWJlbD5cclxuICAgICAgICAgICAgPGlucHV0XHJcbiAgICAgICAgICAgICAgaWQ9XCJtZXNzYWdpbmctY29kZS1zaXplLXNsaWRlclwiXHJcbiAgICAgICAgICAgICAgdHlwZT1cInJhbmdlXCJcclxuICAgICAgICAgICAgICBtaW49XCIwLjhcIlxyXG4gICAgICAgICAgICAgIG1heD1cIjEuNVwiXHJcbiAgICAgICAgICAgICAgc3RlcD1cIjAuMDVcIlxyXG4gICAgICAgICAgICAgIGNsYXNzPVwic2V0dGluZ3Mtdm9sdW1lXCJcclxuICAgICAgICAgICAgICBbKG5nTW9kZWwpXT1cImNvZGVUZXh0U2NhbGVcIlxyXG4gICAgICAgICAgICAgIChuZ01vZGVsQ2hhbmdlKT1cIm9uQ29kZVRleHRTY2FsZUNoYW5nZSgkZXZlbnQpXCJcclxuICAgICAgICAgICAgLz5cclxuICAgICAgICAgICAgPHByZSBjbGFzcz1cInNldHRpbmdzLXByZXZpZXcgY29kZS1wcmV2aWV3XCIgW3N0eWxlLmZvbnQtc2l6ZS5weF09XCIxMiAqIGNvZGVUZXh0U2NhbGVcIj48Y29kZT5TRUxFQ1QgdGlja2V0X3JlZiwgc3RhdHVzXHJcbkZST00gbG9nZ2luZy50aWNrZXRcclxuV0hFUkUgc3RhdHVzID0gJ09wZW4nOzwvY29kZT48L3ByZT5cclxuICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgIDwvZGl2PlxyXG4gICAgICA8L2Rpdj5cclxuXHJcbiAgICAgIDxkaXYgY2xhc3M9XCJpbmJveC10YWJzXCIgcm9sZT1cInRhYmxpc3RcIiBhcmlhLWxhYmVsPVwiQ29udmVyc2F0aW9uIGZpbHRlcnNcIj5cclxuICAgICAgICA8YnV0dG9uXHJcbiAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcclxuICAgICAgICAgIGNsYXNzPVwiaW5ib3gtdGFiXCJcclxuICAgICAgICAgIFtjbGFzcy5hY3RpdmVdPVwiYWN0aXZlVGFiID09PSAnYWxsJ1wiXHJcbiAgICAgICAgICAoY2xpY2spPVwic2V0QWN0aXZlVGFiKCdhbGwnKVwiXHJcbiAgICAgICAgICBtYXRUb29sdGlwPVwiQWxsXCJcclxuICAgICAgICAgIG1hdFRvb2x0aXBQb3NpdGlvbj1cImFib3ZlXCJcclxuICAgICAgICA+XHJcbiAgICAgICAgICA8bWF0LWljb24+Zm9ydW08L21hdC1pY29uPlxyXG4gICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgIDxidXR0b25cclxuICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxyXG4gICAgICAgICAgY2xhc3M9XCJpbmJveC10YWJcIlxyXG4gICAgICAgICAgW2NsYXNzLmFjdGl2ZV09XCJhY3RpdmVUYWIgPT09ICdkaXJlY3QnXCJcclxuICAgICAgICAgIChjbGljayk9XCJzZXRBY3RpdmVUYWIoJ2RpcmVjdCcpXCJcclxuICAgICAgICAgIG1hdFRvb2x0aXA9XCJDaGF0c1wiXHJcbiAgICAgICAgICBtYXRUb29sdGlwUG9zaXRpb249XCJhYm92ZVwiXHJcbiAgICAgICAgPlxyXG4gICAgICAgICAgPG1hdC1pY29uPmNoYXQ8L21hdC1pY29uPlxyXG4gICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgIDxidXR0b25cclxuICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxyXG4gICAgICAgICAgY2xhc3M9XCJpbmJveC10YWJcIlxyXG4gICAgICAgICAgW2NsYXNzLmFjdGl2ZV09XCJhY3RpdmVUYWIgPT09ICdncm91cHMnXCJcclxuICAgICAgICAgIChjbGljayk9XCJzZXRBY3RpdmVUYWIoJ2dyb3VwcycpXCJcclxuICAgICAgICAgIG1hdFRvb2x0aXA9XCJHcm91cHNcIlxyXG4gICAgICAgICAgbWF0VG9vbHRpcFBvc2l0aW9uPVwiYWJvdmVcIlxyXG4gICAgICAgID5cclxuICAgICAgICAgIDxtYXQtaWNvbj5ncm91cHM8L21hdC1pY29uPlxyXG4gICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgIDxidXR0b25cclxuICAgICAgICAgICpuZ0lmPVwicHJvamVjdEdyb3Vwc0VuYWJsZWRcIlxyXG4gICAgICAgICAgdHlwZT1cImJ1dHRvblwiXHJcbiAgICAgICAgICBjbGFzcz1cImluYm94LXRhYlwiXHJcbiAgICAgICAgICBbY2xhc3MuYWN0aXZlXT1cImFjdGl2ZVRhYiA9PT0gJ3Byb2plY3RzJ1wiXHJcbiAgICAgICAgICAoY2xpY2spPVwic2V0QWN0aXZlVGFiKCdwcm9qZWN0cycpXCJcclxuICAgICAgICAgIG1hdFRvb2x0aXA9XCJQcm9qZWN0c1wiXHJcbiAgICAgICAgICBtYXRUb29sdGlwUG9zaXRpb249XCJhYm92ZVwiXHJcbiAgICAgICAgPlxyXG4gICAgICAgICAgPG1hdC1pY29uPndvcmtzcGFjZXM8L21hdC1pY29uPlxyXG4gICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgIDxidXR0b25cclxuICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxyXG4gICAgICAgICAgY2xhc3M9XCJpbmJveC10YWJcIlxyXG4gICAgICAgICAgW2NsYXNzLmFjdGl2ZV09XCJhY3RpdmVUYWIgPT09ICdzZXR0aW5ncydcIlxyXG4gICAgICAgICAgKGNsaWNrKT1cInNldEFjdGl2ZVRhYignc2V0dGluZ3MnKVwiXHJcbiAgICAgICAgICBtYXRUb29sdGlwPVwiU2V0dGluZ3NcIlxyXG4gICAgICAgICAgbWF0VG9vbHRpcFBvc2l0aW9uPVwiYWJvdmVcIlxyXG4gICAgICAgID5cclxuICAgICAgICAgIDxtYXQtaWNvbj5zZXR0aW5nczwvbWF0LWljb24+XHJcbiAgICAgICAgPC9idXR0b24+XHJcbiAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgPCEtLSBDb250ZXh0IE1lbnUgLS0+XHJcbiAgICAgIDxkaXZcclxuICAgICAgICAqbmdJZj1cImNvbnRleHRNZW51XCJcclxuICAgICAgICBjbGFzcz1cImNvbnRleHQtbWVudVwiXHJcbiAgICAgICAgW3N0eWxlLnRvcC5weF09XCJjb250ZXh0TWVudS55XCJcclxuICAgICAgICBbc3R5bGUubGVmdC5weF09XCJjb250ZXh0TWVudS54XCJcclxuICAgICAgPlxyXG4gICAgICAgIDxkaXYgY2xhc3M9XCJjdHgtaXRlbVwiIChjbGljayk9XCJjbGVhckNoYXQoKVwiPlxyXG4gICAgICAgICAgPG1hdC1pY29uPmNsZWFuaW5nX3NlcnZpY2VzPC9tYXQtaWNvbj5cclxuICAgICAgICAgIDxzcGFuPkNsZWFyIGNvbnZlcnNhdGlvbjwvc3Bhbj5cclxuICAgICAgICA8L2Rpdj5cclxuICAgICAgICA8ZGl2IGNsYXNzPVwiY3R4LWl0ZW0gY3R4LWRhbmdlclwiIChjbGljayk9XCJkZWxldGVDaGF0KClcIj5cclxuICAgICAgICAgIDxtYXQtaWNvbj57eyBjb250ZXh0TWVudS5pdGVtLmlzX2dyb3VwID8gJ2xvZ291dCcgOiAnZGVsZXRlJyB9fTwvbWF0LWljb24+XHJcbiAgICAgICAgICA8c3Bhbj57eyBjb250ZXh0TWVudS5pdGVtLmlzX2dyb3VwID8gJ0V4aXQgZ3JvdXAnIDogJ0RlbGV0ZSBjb252ZXJzYXRpb24nIH19PC9zcGFuPlxyXG4gICAgICAgIDwvZGl2PlxyXG4gICAgICA8L2Rpdj5cclxuICAgICAgPGRpdiAqbmdJZj1cImNvbnRleHRNZW51XCIgY2xhc3M9XCJjdHgtYmFja2Ryb3BcIiAoY2xpY2spPVwiY2xvc2VDb250ZXh0TWVudSgpXCI+PC9kaXY+XHJcbiAgICA8L2Rpdj5cclxuICBgLFxyXG4gIHN0eWxlczogW2BcclxuICAgIC5pbmJveC1jb250YWluZXIge1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xyXG4gICAgICBoZWlnaHQ6IDEwMCU7XHJcbiAgICAgIGJhY2tncm91bmQ6IHRyYW5zcGFyZW50O1xyXG4gICAgICBjb250YWluZXItdHlwZTogaW5saW5lLXNpemU7XHJcbiAgICB9XHJcblxyXG4gICAgLnNlYXJjaC1iYXIge1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBtYXJnaW46IDhweCAxNnB4O1xyXG4gICAgICBwYWRkaW5nOiA4cHggMTJweDtcclxuICAgICAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQ7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDEwcHg7XHJcbiAgICB9XHJcblxyXG4gICAgLnNlYXJjaC1pY29uIHtcclxuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC43KTtcclxuICAgICAgZm9udC1zaXplOiAxOHB4O1xyXG4gICAgICB3aWR0aDogMjBweDtcclxuICAgICAgaGVpZ2h0OiAyMHB4O1xyXG4gICAgICBtYXJnaW4tcmlnaHQ6IDhweDtcclxuICAgIH1cclxuXHJcbiAgICAuc2VhcmNoLWlucHV0IHtcclxuICAgICAgZmxleDogMTtcclxuICAgICAgYm9yZGVyOiBub25lO1xyXG4gICAgICBvdXRsaW5lOiBub25lO1xyXG4gICAgICBiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudDtcclxuICAgICAgZm9udC1zaXplOiAxNHB4O1xyXG4gICAgICBjb2xvcjogI2ZmZjtcclxuICAgIH1cclxuXHJcbiAgICAuc2VhcmNoLWlucHV0OjpwbGFjZWhvbGRlciB7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNik7XHJcbiAgICB9XHJcblxyXG4gICAgLmluYm94LXRhYnMge1xyXG4gICAgICBkaXNwbGF5OiBncmlkO1xyXG4gICAgICBncmlkLXRlbXBsYXRlLWNvbHVtbnM6IHJlcGVhdCg1LCBtaW5tYXgoMCwgMWZyKSk7XHJcbiAgICAgIGdhcDogNXB4O1xyXG4gICAgICBwYWRkaW5nOiAxMHB4IDE2cHggMTJweDtcclxuICAgICAgYm9yZGVyLXRvcDogMXB4IHNvbGlkIHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xKTtcclxuICAgICAgZmxleC1zaHJpbms6IDA7XHJcbiAgICB9XHJcblxyXG4gICAgLmluYm94LXRhYiB7XHJcbiAgICAgIG1pbi13aWR0aDogMDtcclxuICAgICAgYm9yZGVyOiAxcHggc29saWQgcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjE0KTtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjA2KTtcclxuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC43Mik7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDk5OXB4O1xyXG4gICAgICBwYWRkaW5nOiA2cHggNHB4O1xyXG4gICAgICBmb250LXdlaWdodDogNjAwO1xyXG4gICAgICBjdXJzb3I6IHBvaW50ZXI7XHJcbiAgICAgIGRpc3BsYXk6IGlubGluZS1mbGV4O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcclxuICAgICAgdHJhbnNpdGlvbjogYmFja2dyb3VuZCAwLjE1cywgYm9yZGVyLWNvbG9yIDAuMTVzLCBjb2xvciAwLjE1cztcclxuICAgIH1cclxuXHJcbiAgICAuaW5ib3gtdGFiIG1hdC1pY29uIHtcclxuICAgICAgZm9udC1zaXplOiBjbGFtcCgxN3B4LCA2Y3F3LCAyMXB4KTtcclxuICAgICAgd2lkdGg6IGNsYW1wKDE3cHgsIDZjcXcsIDIxcHgpO1xyXG4gICAgICBoZWlnaHQ6IGNsYW1wKDE3cHgsIDZjcXcsIDIxcHgpO1xyXG4gICAgICBsaW5lLWhlaWdodDogY2xhbXAoMTdweCwgNmNxdywgMjFweCk7XHJcbiAgICB9XHJcblxyXG4gICAgLmluYm94LXRhYjpob3ZlciB7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xMik7XHJcbiAgICAgIGNvbG9yOiAjZmZmO1xyXG4gICAgfVxyXG5cclxuICAgIC5pbmJveC10YWIuYWN0aXZlIHtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNiwgOTUsIDE2OCwgMC4zNSk7XHJcbiAgICAgIGJvcmRlci1jb2xvcjogcmdiYSgxMjcsIDE4MCwgMjU1LCAwLjQ1KTtcclxuICAgICAgY29sb3I6ICNmZmY7XHJcbiAgICB9XHJcblxyXG4gICAgQGNvbnRhaW5lciAobWF4LXdpZHRoOiAzMzBweCkge1xyXG4gICAgICAuaW5ib3gtdGFicyB7XHJcbiAgICAgICAgZ2FwOiAzcHg7XHJcbiAgICAgICAgcGFkZGluZzogOHB4IDhweCAxMHB4O1xyXG4gICAgICB9XHJcblxyXG4gICAgICAuaW5ib3gtdGFiIHtcclxuICAgICAgICBwYWRkaW5nOiA2cHggMnB4O1xyXG4gICAgICAgIGxldHRlci1zcGFjaW5nOiAtMC4ycHg7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBAY29udGFpbmVyIChtYXgtd2lkdGg6IDI4MHB4KSB7XHJcbiAgICAgIC5pbmJveC10YWJzIHtcclxuICAgICAgICBnYXA6IDJweDtcclxuICAgICAgICBwYWRkaW5nLWxlZnQ6IDZweDtcclxuICAgICAgICBwYWRkaW5nLXJpZ2h0OiA2cHg7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIC5pbmJveC10YWIge1xyXG4gICAgICAgIGZvbnQtc2l6ZTogOC41cHg7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAuY29udmVyc2F0aW9uLWxpc3Qge1xyXG4gICAgICBmbGV4OiAxO1xyXG4gICAgICBvdmVyZmxvdy15OiBhdXRvO1xyXG4gICAgICBzY3JvbGxiYXItd2lkdGg6IG5vbmU7XHJcbiAgICAgIC1tcy1vdmVyZmxvdy1zdHlsZTogbm9uZTtcclxuICAgIH1cclxuXHJcbiAgICAuY29udmVyc2F0aW9uLWxpc3Q6Oi13ZWJraXQtc2Nyb2xsYmFyIHtcclxuICAgICAgZGlzcGxheTogbm9uZTtcclxuICAgIH1cclxuXHJcbiAgICAuY29udmVyc2F0aW9uLWl0ZW0ge1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBwYWRkaW5nOiAxMnB4IDE2cHg7XHJcbiAgICAgIGN1cnNvcjogcG9pbnRlcjtcclxuICAgICAgdHJhbnNpdGlvbjogYmFja2dyb3VuZCAwLjE1cztcclxuICAgICAgZ2FwOiAxMnB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5jb252ZXJzYXRpb24taXRlbTpob3ZlciB7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xKTtcclxuICAgIH1cclxuXHJcbiAgICAuY29udmVyc2F0aW9uLWl0ZW0uaGFzLXVucmVhZCB7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xNSk7XHJcbiAgICB9XHJcblxyXG4gICAgLmF2YXRhciB7XHJcbiAgICAgIHdpZHRoOiA0OHB4O1xyXG4gICAgICBoZWlnaHQ6IDQ4cHg7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDUwJTtcclxuICAgICAgYmFja2dyb3VuZDogIzBkMjU0MDtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XHJcbiAgICAgIGZsZXgtc2hyaW5rOiAwO1xyXG4gICAgfVxyXG5cclxuICAgIC5hdmF0YXIgbWF0LWljb24ge1xyXG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjcpO1xyXG4gICAgICBmb250LXNpemU6IDI0cHg7XHJcbiAgICB9XHJcblxyXG4gICAgLmdyb3VwLWF2YXRhciB7XHJcbiAgICAgIGJhY2tncm91bmQ6ICMwYTFmMzg7XHJcbiAgICB9XHJcblxyXG4gICAgLmdyb3VwLWF2YXRhciBtYXQtaWNvbiB7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNyk7XHJcbiAgICB9XHJcblxyXG4gICAgLnByb2plY3QtYXZhdGFyIHtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgzNywgOTksIDIzNSwgMC4yKTtcclxuICAgIH1cclxuXHJcbiAgICAucHJvamVjdC1hdmF0YXIgbWF0LWljb24ge1xyXG4gICAgICBjb2xvcjogI2JmZGJmZTtcclxuICAgIH1cclxuXHJcbiAgICAucHJvamVjdC1jb250YWluZXIge1xyXG4gICAgICBib3JkZXItYm90dG9tOiAxcHggc29saWQgcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjA2KTtcclxuICAgIH1cclxuXHJcbiAgICAucHJvamVjdC1oZWFkZXIge1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBwYWRkaW5nOiAxMnB4IDE2cHg7XHJcbiAgICAgIGN1cnNvcjogcG9pbnRlcjtcclxuICAgICAgZ2FwOiAxMnB4O1xyXG4gICAgICB0cmFuc2l0aW9uOiBiYWNrZ3JvdW5kIDAuMTVzO1xyXG4gICAgfVxyXG5cclxuICAgIC5wcm9qZWN0LWhlYWRlcjpob3ZlciB7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4wOCk7XHJcbiAgICB9XHJcblxyXG4gICAgLnN1Ymdyb3VwLWNyZWF0ZSB7XHJcbiAgICAgIHdpZHRoOiAyOHB4O1xyXG4gICAgICBoZWlnaHQ6IDI4cHg7XHJcbiAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHJnYmEoMTkxLCAyMTksIDI1NCwgMC4zNSk7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDk5OXB4O1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDM3LCA5OSwgMjM1LCAwLjE4KTtcclxuICAgICAgY29sb3I6ICNiZmRiZmU7XHJcbiAgICAgIGRpc3BsYXk6IGlubGluZS1mbGV4O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcclxuICAgICAgY3Vyc29yOiBwb2ludGVyO1xyXG4gICAgICBmbGV4LXNocmluazogMDtcclxuICAgIH1cclxuXHJcbiAgICAuc3ViZ3JvdXAtY3JlYXRlIG1hdC1pY29uIHtcclxuICAgICAgZm9udC1zaXplOiAxOHB4O1xyXG4gICAgICB3aWR0aDogMThweDtcclxuICAgICAgaGVpZ2h0OiAxOHB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5leHBhbmQtaWNvbiB7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNik7XHJcbiAgICAgIGZvbnQtc2l6ZTogMjBweDtcclxuICAgICAgd2lkdGg6IDIwcHg7XHJcbiAgICAgIGhlaWdodDogMjBweDtcclxuICAgICAgZmxleC1zaHJpbms6IDA7XHJcbiAgICB9XHJcblxyXG4gICAgLnN1Ymdyb3VwLWxpc3Qge1xyXG4gICAgICBwYWRkaW5nLWJvdHRvbTogNnB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5zdWJncm91cC1pdGVtIHtcclxuICAgICAgcGFkZGluZy1sZWZ0OiAzMnB4O1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMDI1KTtcclxuICAgIH1cclxuXHJcbiAgICAuc3ViZ3JvdXAtYXZhdGFyIHtcclxuICAgICAgd2lkdGg6IDM4cHg7XHJcbiAgICAgIGhlaWdodDogMzhweDtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSg1OSwgMTMwLCAyNDYsIDAuMTQpO1xyXG4gICAgfVxyXG5cclxuICAgIC5zdWJncm91cC1hdmF0YXIgbWF0LWljb24ge1xyXG4gICAgICBjb2xvcjogI2RiZWFmZTtcclxuICAgICAgZm9udC1zaXplOiAyMXB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5lbXB0eS1zdWJncm91cHMge1xyXG4gICAgICBwYWRkaW5nOiA4cHggMTZweCAxMnB4IDkycHg7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNTUpO1xyXG4gICAgICBmb250LXNpemU6IDEycHg7XHJcbiAgICB9XHJcblxyXG4gICAgLmNvbnZlcnNhdGlvbi1pbmZvIHtcclxuICAgICAgZmxleDogMTtcclxuICAgICAgbWluLXdpZHRoOiAwO1xyXG4gICAgfVxyXG5cclxuICAgIC5pbmZvLXRvcCB7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGp1c3RpZnktY29udGVudDogc3BhY2UtYmV0d2VlbjtcclxuICAgICAgYWxpZ24taXRlbXM6IGJhc2VsaW5lO1xyXG4gICAgICBtYXJnaW4tYm90dG9tOiAycHg7XHJcbiAgICB9XHJcblxyXG4gICAgLmNvbnYtbmFtZSB7XHJcbiAgICAgIGZvbnQtd2VpZ2h0OiA2MDA7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTRweDtcclxuICAgICAgY29sb3I6ICNmZmY7XHJcbiAgICAgIHdoaXRlLXNwYWNlOiBub3dyYXA7XHJcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XHJcbiAgICAgIHRleHQtb3ZlcmZsb3c6IGVsbGlwc2lzO1xyXG4gICAgICBtYXgtd2lkdGg6IDIwMHB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5jb252LXRpbWUge1xyXG4gICAgICBmb250LXNpemU6IDExcHg7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNyk7XHJcbiAgICAgIGZsZXgtc2hyaW5rOiAwO1xyXG4gICAgICBtYXJnaW4tbGVmdDogOHB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5pbmZvLWJvdHRvbSB7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGp1c3RpZnktY29udGVudDogc3BhY2UtYmV0d2VlbjtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAgZ2FwOiA2cHg7XHJcbiAgICB9XHJcblxyXG4gICAgLmNvbnYtcHJldmlldyB7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTNweDtcclxuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC43KTtcclxuICAgICAgd2hpdGUtc3BhY2U6IG5vd3JhcDtcclxuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcclxuICAgICAgdGV4dC1vdmVyZmxvdzogZWxsaXBzaXM7XHJcbiAgICAgIG1heC13aWR0aDogMjIwcHg7XHJcbiAgICB9XHJcblxyXG4gICAgLmhhcy11bnJlYWQgLmNvbnYtbmFtZSB7XHJcbiAgICAgIGNvbG9yOiAjZmZmO1xyXG4gICAgfVxyXG5cclxuICAgIC5oYXMtdW5yZWFkIC5jb252LXByZXZpZXcge1xyXG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjkpO1xyXG4gICAgICBmb250LXdlaWdodDogNTAwO1xyXG4gICAgfVxyXG5cclxuICAgIC51bnJlYWQtYmFkZ2Uge1xyXG4gICAgICBiYWNrZ3JvdW5kOiAjMWE1ZmE4O1xyXG4gICAgICBjb2xvcjogI2ZmZjtcclxuICAgICAgYm9yZGVyLXJhZGl1czogMTBweDtcclxuICAgICAgbWluLXdpZHRoOiAyMHB4O1xyXG4gICAgICBoZWlnaHQ6IDIwcHg7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTFweDtcclxuICAgICAgZm9udC13ZWlnaHQ6IDYwMDtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XHJcbiAgICAgIHBhZGRpbmc6IDAgNnB4O1xyXG4gICAgICBmbGV4LXNocmluazogMDtcclxuICAgIH1cclxuXHJcbiAgICAubWVudGlvbi1iYWRnZSB7XHJcbiAgICAgIHdpZHRoOiAyMHB4O1xyXG4gICAgICBoZWlnaHQ6IDIwcHg7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDk5OXB4O1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDEyNywgMTgwLCAyNTUsIDAuMik7XHJcbiAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHJnYmEoMTI3LCAxODAsIDI1NSwgMC41NSk7XHJcbiAgICAgIGNvbG9yOiAjYmZkYmZlO1xyXG4gICAgICBkaXNwbGF5OiBpbmxpbmUtZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTJweDtcclxuICAgICAgZm9udC13ZWlnaHQ6IDgwMDtcclxuICAgICAgZmxleC1zaHJpbms6IDA7XHJcbiAgICAgIG1hcmdpbi1sZWZ0OiA2cHg7XHJcbiAgICAgIGJveC1zaGFkb3c6IDAgMCAwIDJweCByZ2JhKDEyNywgMTgwLCAyNTUsIDAuMDYpO1xyXG4gICAgfVxyXG5cclxuICAgIC5lbXB0eS1zdGF0ZSB7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xyXG4gICAgICBwYWRkaW5nOiA0OHB4IDI0cHg7XHJcbiAgICAgIGNvbG9yOiAjOWNhM2FmO1xyXG4gICAgfVxyXG5cclxuICAgIC5lbXB0eS1zdGF0ZSBtYXQtaWNvbiB7XHJcbiAgICAgIGZvbnQtc2l6ZTogNDhweDtcclxuICAgICAgd2lkdGg6IDQ4cHg7XHJcbiAgICAgIGhlaWdodDogNDhweDtcclxuICAgICAgbWFyZ2luLWJvdHRvbTogMTJweDtcclxuICAgIH1cclxuXHJcbiAgICAuZW1wdHktc3RhdGUgcCB7XHJcbiAgICAgIG1hcmdpbjogMCAwIDE2cHg7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTRweDtcclxuICAgIH1cclxuXHJcbiAgICAuc2V0dGluZ3MtcGFuZWwge1xyXG4gICAgICBwYWRkaW5nOiAxNnB4O1xyXG4gICAgICBjb2xvcjogI2ZmZjtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcclxuICAgICAgZ2FwOiAxMnB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5zZXR0aW5ncy1jYXJkIHtcclxuICAgICAgYm9yZGVyLXJhZGl1czogMTRweDtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjA3KTtcclxuICAgICAgYm9yZGVyOiAxcHggc29saWQgcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjEyKTtcclxuICAgICAgcGFkZGluZzogMTZweDtcclxuICAgICAgYm94LXNoYWRvdzogMCAxMHB4IDI4cHggcmdiYSgwLCAwLCAwLCAwLjE4KTtcclxuICAgIH1cclxuXHJcbiAgICAuc2V0dGluZ3MtaGVhZGVyIHtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgZ2FwOiAxMnB4O1xyXG4gICAgICBhbGlnbi1pdGVtczogZmxleC1zdGFydDtcclxuICAgICAgbWFyZ2luLWJvdHRvbTogMTZweDtcclxuICAgIH1cclxuXHJcbiAgICAuc2V0dGluZ3MtaWNvbiB7XHJcbiAgICAgIHdpZHRoOiAzNnB4O1xyXG4gICAgICBoZWlnaHQ6IDM2cHg7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDEwcHg7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjYsIDk1LCAxNjgsIDAuMzUpO1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcclxuICAgICAgZmxleC1zaHJpbms6IDA7XHJcbiAgICB9XHJcblxyXG4gICAgLnNldHRpbmdzLWljb24gbWF0LWljb24ge1xyXG4gICAgICBjb2xvcjogI2JmZGJmZTtcclxuICAgIH1cclxuXHJcbiAgICAuc2V0dGluZ3MtaWNvbi5kaXNwbGF5LWljb24ge1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDEzNCwgMjM5LCAxNzIsIDAuMTQpO1xyXG4gICAgfVxyXG5cclxuICAgIC5zZXR0aW5ncy1pY29uLmRpc3BsYXktaWNvbiBtYXQtaWNvbiB7XHJcbiAgICAgIGNvbG9yOiAjYmJmN2QwO1xyXG4gICAgfVxyXG5cclxuICAgIC5zZXR0aW5ncy1oZWFkZXIgaDQge1xyXG4gICAgICBtYXJnaW46IDAgMCA0cHg7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTVweDtcclxuICAgICAgZm9udC13ZWlnaHQ6IDcwMDtcclxuICAgIH1cclxuXHJcbiAgICAuc2V0dGluZ3MtaGVhZGVyIHAge1xyXG4gICAgICBtYXJnaW46IDA7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNjUpO1xyXG4gICAgICBmb250LXNpemU6IDEycHg7XHJcbiAgICAgIGxpbmUtaGVpZ2h0OiAxLjQ7XHJcbiAgICB9XHJcblxyXG4gICAgLnNldHRpbmdzLXRvZ2dsZSB7XHJcbiAgICAgIHdpZHRoOiAxMDAlO1xyXG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcclxuICAgICAgYm9yZGVyLXJhZGl1czogMTBweDtcclxuICAgICAgY29sb3I6ICNmZmYgIWltcG9ydGFudDtcclxuICAgICAgYm9yZGVyLWNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMikgIWltcG9ydGFudDtcclxuICAgICAgbWFyZ2luLWJvdHRvbTogMTZweDtcclxuICAgIH1cclxuXHJcbiAgICAuc2V0dGluZ3MtdG9nZ2xlIG1hdC1pY29uIHtcclxuICAgICAgbWFyZ2luLXJpZ2h0OiA4cHg7XHJcbiAgICAgIGZvbnQtc2l6ZTogMThweDtcclxuICAgICAgd2lkdGg6IDE4cHg7XHJcbiAgICAgIGhlaWdodDogMThweDtcclxuICAgIH1cclxuXHJcbiAgICAudm9sdW1lLWxhYmVsIHtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAganVzdGlmeS1jb250ZW50OiBzcGFjZS1iZXR3ZWVuO1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjc4KTtcclxuICAgICAgZm9udC1zaXplOiAxMnB4O1xyXG4gICAgICBmb250LXdlaWdodDogNjAwO1xyXG4gICAgICBtYXJnaW4tYm90dG9tOiA4cHg7XHJcbiAgICB9XHJcblxyXG4gICAgLnNldHRpbmdzLXZvbHVtZSB7XHJcbiAgICAgIHdpZHRoOiAxMDAlO1xyXG4gICAgICBhY2NlbnQtY29sb3I6ICM3ZmI0ZmY7XHJcbiAgICAgIGN1cnNvcjogcG9pbnRlcjtcclxuICAgICAgbWFyZ2luLWJvdHRvbTogMTJweDtcclxuICAgIH1cclxuXHJcbiAgICAuc2V0dGluZ3MtcHJldmlldyB7XHJcbiAgICAgIG1hcmdpbjogMCAwIDE2cHg7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDEwcHg7XHJcbiAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xMik7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4wNik7XHJcbiAgICAgIGNvbG9yOiAjZjVmN2ZmO1xyXG4gICAgICBib3gtc2l6aW5nOiBib3JkZXItYm94O1xyXG4gICAgfVxyXG5cclxuICAgIC5tZXNzYWdlLXByZXZpZXcge1xyXG4gICAgICBwYWRkaW5nOiA5cHggMTFweDtcclxuICAgICAgbGluZS1oZWlnaHQ6IDEuMzU7XHJcbiAgICB9XHJcblxyXG4gICAgLmNvZGUtcHJldmlldyB7XHJcbiAgICAgIHBhZGRpbmc6IDEwcHggMTFweDtcclxuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcclxuICAgICAgZm9udC1mYW1pbHk6IHVpLW1vbm9zcGFjZSwgU0ZNb25vLVJlZ3VsYXIsIE1lbmxvLCBNb25hY28sIENvbnNvbGFzLCBcIkxpYmVyYXRpb24gTW9ub1wiLCBtb25vc3BhY2U7XHJcbiAgICAgIGxpbmUtaGVpZ2h0OiAxLjQ1O1xyXG4gICAgICB3aGl0ZS1zcGFjZTogcHJlLXdyYXA7XHJcbiAgICAgIGNvbG9yOiAjZGJlYWZlO1xyXG4gICAgICBiYWNrZ3JvdW5kOiAjMDYxODI3O1xyXG4gICAgICBtYXJnaW4tYm90dG9tOiAwO1xyXG4gICAgfVxyXG5cclxuICAgIC5jb250ZXh0LW1lbnUge1xyXG4gICAgICBwb3NpdGlvbjogZml4ZWQ7XHJcbiAgICAgIHotaW5kZXg6IDEwMDAxO1xyXG4gICAgICBiYWNrZ3JvdW5kOiAjMDcxZDMwO1xyXG4gICAgICBib3JkZXItcmFkaXVzOiA4cHg7XHJcbiAgICAgIHBhZGRpbmc6IDRweCAwO1xyXG4gICAgICBib3gtc2hhZG93OiAwIDhweCAyNHB4IHJnYmEoMCwgMCwgMCwgMC4zKTtcclxuICAgICAgbWluLXdpZHRoOiAyMDBweDtcclxuICAgIH1cclxuXHJcbiAgICAuY3R4LWl0ZW0ge1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBnYXA6IDEwcHg7XHJcbiAgICAgIHBhZGRpbmc6IDEwcHggMTZweDtcclxuICAgICAgY3Vyc29yOiBwb2ludGVyO1xyXG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjkpO1xyXG4gICAgICBmb250LXNpemU6IDEzcHg7XHJcbiAgICAgIHRyYW5zaXRpb246IGJhY2tncm91bmQgMC4xNXM7XHJcbiAgICB9XHJcblxyXG4gICAgLmN0eC1pdGVtOmhvdmVyIHtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjEpO1xyXG4gICAgfVxyXG5cclxuICAgIC5jdHgtaXRlbSBtYXQtaWNvbiB7XHJcbiAgICAgIGZvbnQtc2l6ZTogMThweDtcclxuICAgICAgd2lkdGg6IDE4cHg7XHJcbiAgICAgIGhlaWdodDogMThweDtcclxuICAgIH1cclxuXHJcbiAgICAuY3R4LWRhbmdlciB7XHJcbiAgICAgIGNvbG9yOiAjZjg3MTcxO1xyXG4gICAgfVxyXG5cclxuICAgIC5jdHgtZGFuZ2VyOmhvdmVyIHtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNDgsIDExMywgMTEzLCAwLjE1KTtcclxuICAgIH1cclxuXHJcbiAgICAuY3R4LWJhY2tkcm9wIHtcclxuICAgICAgcG9zaXRpb246IGZpeGVkO1xyXG4gICAgICBpbnNldDogMDtcclxuICAgICAgei1pbmRleDogMTAwMDA7XHJcbiAgICB9XHJcbiAgYF0sXHJcbn0pXHJcbmV4cG9ydCBjbGFzcyBJbmJveExpc3RDb21wb25lbnQgaW1wbGVtZW50cyBPbkluaXQsIE9uRGVzdHJveSB7XHJcbiAgaW5ib3g6IEluYm94SXRlbVtdID0gW107XHJcbiAgc2VhcmNoUXVlcnkgPSAnJztcclxuICBhY3RpdmVUYWI6ICdhbGwnIHwgJ2RpcmVjdCcgfCAnZ3JvdXBzJyB8ICdwcm9qZWN0cycgfCAnc2V0dGluZ3MnID0gJ2FsbCc7XHJcbiAgbm90aWZpY2F0aW9uVm9sdW1lID0gMC4zNTtcclxuICBub3RpZmljYXRpb25zTXV0ZWQgPSBmYWxzZTtcclxuICBtZXNzYWdlVGV4dFNjYWxlID0gMTtcclxuICBjb2RlVGV4dFNjYWxlID0gMTtcclxuICBjb250ZXh0TWVudTogeyB4OiBudW1iZXI7IHk6IG51bWJlcjsgaXRlbTogSW5ib3hJdGVtIH0gfCBudWxsID0gbnVsbDtcclxuICBleHBhbmRlZFByb2plY3RJZHMgPSBuZXcgU2V0PHN0cmluZz4oKTtcclxuICBwcml2YXRlIHJlYWRvbmx5IHRhYlN0b3JhZ2VLZXkgPSAnbWVzc2FnaW5nX2luYm94X2FjdGl2ZV90YWInO1xyXG4gIHByaXZhdGUgc3ViITogU3Vic2NyaXB0aW9uO1xyXG5cclxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHN0b3JlOiBNZXNzYWdpbmdTdG9yZVNlcnZpY2UpIHt9XHJcblxyXG4gIGdldCBwcm9qZWN0R3JvdXBzRW5hYmxlZCgpOiBib29sZWFuIHtcclxuICAgIHJldHVybiB0aGlzLnN0b3JlLnByb2plY3RHcm91cHNFbmFibGVkO1xyXG4gIH1cclxuXHJcbiAgbmdPbkluaXQoKTogdm9pZCB7XHJcbiAgICB0aGlzLmFjdGl2ZVRhYiA9IHRoaXMuZ2V0U2F2ZWRUYWIoKTtcclxuICAgIHRoaXMuc3ViID0gbmV3IFN1YnNjcmlwdGlvbigpO1xyXG4gICAgdGhpcy5zdWIuYWRkKHRoaXMuc3RvcmUuaW5ib3guc3Vic2NyaWJlKChpdGVtcykgPT4gKHRoaXMuaW5ib3ggPSBpdGVtcykpKTtcclxuICAgIHRoaXMuc3ViLmFkZCh0aGlzLnN0b3JlLm5vdGlmaWNhdGlvblZvbHVtZS5zdWJzY3JpYmUoKHZvbHVtZSkgPT4gKHRoaXMubm90aWZpY2F0aW9uVm9sdW1lID0gdm9sdW1lKSkpO1xyXG4gICAgdGhpcy5zdWIuYWRkKHRoaXMuc3RvcmUubm90aWZpY2F0aW9uc011dGVkLnN1YnNjcmliZSgobXV0ZWQpID0+ICh0aGlzLm5vdGlmaWNhdGlvbnNNdXRlZCA9IG11dGVkKSkpO1xyXG4gICAgdGhpcy5zdWIuYWRkKHRoaXMuc3RvcmUubWVzc2FnZVRleHRTY2FsZS5zdWJzY3JpYmUoKHNjYWxlKSA9PiAodGhpcy5tZXNzYWdlVGV4dFNjYWxlID0gc2NhbGUpKSk7XHJcbiAgICB0aGlzLnN1Yi5hZGQodGhpcy5zdG9yZS5jb2RlVGV4dFNjYWxlLnN1YnNjcmliZSgoc2NhbGUpID0+ICh0aGlzLmNvZGVUZXh0U2NhbGUgPSBzY2FsZSkpKTtcclxuICB9XHJcblxyXG4gIG5nT25EZXN0cm95KCk6IHZvaWQge1xyXG4gICAgdGhpcy5zdWI/LnVuc3Vic2NyaWJlKCk7XHJcbiAgfVxyXG5cclxuICBnZXQgZmlsdGVyZWRJbmJveCgpOiBJbmJveEl0ZW1bXSB7XHJcbiAgICBpZiAodGhpcy5hY3RpdmVUYWIgPT09ICdzZXR0aW5ncycpIHJldHVybiBbXTtcclxuICAgIGNvbnN0IHRhYmJlZCA9IHRoaXMuaW5ib3guZmlsdGVyKChpdGVtKSA9PiB7XHJcbiAgICAgIGNvbnN0IHByb2plY3QgPSB0aGlzLmlzUHJvamVjdChpdGVtKTtcclxuICAgICAgaWYgKHRoaXMuYWN0aXZlVGFiID09PSAnZGlyZWN0JykgcmV0dXJuICFpdGVtLmlzX2dyb3VwO1xyXG4gICAgICBpZiAodGhpcy5hY3RpdmVUYWIgPT09ICdncm91cHMnKSByZXR1cm4gaXRlbS5pc19ncm91cCAmJiAhcHJvamVjdDtcclxuICAgICAgaWYgKHRoaXMuYWN0aXZlVGFiID09PSAncHJvamVjdHMnKSByZXR1cm4gW107XHJcbiAgICAgIHJldHVybiAhaXNQcm9qZWN0Q29udGFpbmVyKGl0ZW0pO1xyXG4gICAgfSk7XHJcbiAgICBpZiAoIXRoaXMuc2VhcmNoUXVlcnkudHJpbSgpKSByZXR1cm4gdGFiYmVkO1xyXG4gICAgY29uc3QgcSA9IHRoaXMuc2VhcmNoUXVlcnkudG9Mb3dlckNhc2UoKTtcclxuICAgIHJldHVybiB0YWJiZWQuZmlsdGVyKFxyXG4gICAgICAoaXRlbSkgPT5cclxuICAgICAgICAoaXRlbS5uYW1lIHx8ICcnKS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKHEpIHx8XHJcbiAgICAgICAgKGl0ZW0ubGFzdF9tZXNzYWdlX3ByZXZpZXcgfHwgJycpLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMocSlcclxuICAgICk7XHJcbiAgfVxyXG5cclxuICBnZXQgcHJvamVjdENvbnRhaW5lcnMoKTogSW5ib3hJdGVtW10ge1xyXG4gICAgY29uc3QgY29udGFpbmVycyA9IHRoaXMuaW5ib3guZmlsdGVyKChpdGVtKSA9PiBpc1Byb2plY3RDb250YWluZXIoaXRlbSkpO1xyXG4gICAgaWYgKCF0aGlzLnNlYXJjaFF1ZXJ5LnRyaW0oKSkgcmV0dXJuIGNvbnRhaW5lcnM7XHJcbiAgICBjb25zdCBxID0gdGhpcy5zZWFyY2hRdWVyeS50b0xvd2VyQ2FzZSgpO1xyXG4gICAgcmV0dXJuIGNvbnRhaW5lcnMuZmlsdGVyKChwcm9qZWN0KSA9PiB7XHJcbiAgICAgIGNvbnN0IHByb2plY3RNYXRjaCA9IChwcm9qZWN0Lm5hbWUgfHwgJycpLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMocSk7XHJcbiAgICAgIGNvbnN0IHN1Ymdyb3VwTWF0Y2ggPSB0aGlzLnByb2plY3RTdWJncm91cHMocHJvamVjdCwgZmFsc2UpLnNvbWUoXHJcbiAgICAgICAgKGl0ZW0pID0+XHJcbiAgICAgICAgICAoaXRlbS5uYW1lIHx8ICcnKS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKHEpIHx8XHJcbiAgICAgICAgICAoaXRlbS5zdWJncm91cF9zdWJqZWN0IHx8ICcnKS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKHEpIHx8XHJcbiAgICAgICAgICAoaXRlbS5sYXN0X21lc3NhZ2VfcHJldmlldyB8fCAnJykudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhxKVxyXG4gICAgICApO1xyXG4gICAgICByZXR1cm4gcHJvamVjdE1hdGNoIHx8IHN1Ymdyb3VwTWF0Y2g7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIGdldCBzaG93RW1wdHlTdGF0ZSgpOiBib29sZWFuIHtcclxuICAgIGlmICh0aGlzLmFjdGl2ZVRhYiA9PT0gJ3NldHRpbmdzJykgcmV0dXJuIGZhbHNlO1xyXG4gICAgaWYgKHRoaXMuYWN0aXZlVGFiID09PSAncHJvamVjdHMnKSByZXR1cm4gdGhpcy5wcm9qZWN0Q29udGFpbmVycy5sZW5ndGggPT09IDA7XHJcbiAgICByZXR1cm4gdGhpcy5maWx0ZXJlZEluYm94Lmxlbmd0aCA9PT0gMDtcclxuICB9XHJcblxyXG4gIGdldCBlbXB0eVN0YXRlVGV4dCgpOiBzdHJpbmcge1xyXG4gICAgaWYgKHRoaXMuc2VhcmNoUXVlcnkudHJpbSgpKSByZXR1cm4gJ05vIG1hdGNoaW5nIGNvbnZlcnNhdGlvbnMnO1xyXG4gICAgaWYgKHRoaXMuYWN0aXZlVGFiID09PSAnZGlyZWN0JykgcmV0dXJuICdObyBjaGF0cyB5ZXQnO1xyXG4gICAgaWYgKHRoaXMuYWN0aXZlVGFiID09PSAnZ3JvdXBzJykgcmV0dXJuICdObyBncm91cHMgeWV0JztcclxuICAgIGlmICh0aGlzLmFjdGl2ZVRhYiA9PT0gJ3Byb2plY3RzJykgcmV0dXJuICdObyBwcm9qZWN0IGNoYXRzIHlldCc7XHJcbiAgICByZXR1cm4gJ05vIGNvbnZlcnNhdGlvbnMgeWV0JztcclxuICB9XHJcblxyXG4gIGlzUHJvamVjdChpdGVtOiBJbmJveEl0ZW0pOiBib29sZWFuIHtcclxuICAgIHJldHVybiBpc1Byb2plY3RDb252ZXJzYXRpb24oaXRlbSk7XHJcbiAgfVxyXG5cclxuICBwcm9qZWN0U3ViZ3JvdXBzKHByb2plY3Q6IEluYm94SXRlbSwgYXBwbHlTZWFyY2ggPSB0cnVlKTogSW5ib3hJdGVtW10ge1xyXG4gICAgY29uc3QgcGFyZW50SWQgPSBTdHJpbmcocHJvamVjdC5jb252ZXJzYXRpb25faWQpO1xyXG4gICAgbGV0IHN1Ymdyb3VwcyA9IHRoaXMuaW5ib3guZmlsdGVyKFxyXG4gICAgICAoaXRlbSkgPT4gaXNQcm9qZWN0U3ViZ3JvdXAoaXRlbSkgJiYgU3RyaW5nKGl0ZW0ucGFyZW50X2NvbnZlcnNhdGlvbl9pZCB8fCAnJykgPT09IHBhcmVudElkXHJcbiAgICApO1xyXG4gICAgaWYgKGFwcGx5U2VhcmNoICYmIHRoaXMuc2VhcmNoUXVlcnkudHJpbSgpKSB7XHJcbiAgICAgIGNvbnN0IHEgPSB0aGlzLnNlYXJjaFF1ZXJ5LnRvTG93ZXJDYXNlKCk7XHJcbiAgICAgIHN1Ymdyb3VwcyA9IHN1Ymdyb3Vwcy5maWx0ZXIoXHJcbiAgICAgICAgKGl0ZW0pID0+XHJcbiAgICAgICAgICAoaXRlbS5uYW1lIHx8ICcnKS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKHEpIHx8XHJcbiAgICAgICAgICAoaXRlbS5zdWJncm91cF9zdWJqZWN0IHx8ICcnKS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKHEpIHx8XHJcbiAgICAgICAgICAoaXRlbS5sYXN0X21lc3NhZ2VfcHJldmlldyB8fCAnJykudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhxKVxyXG4gICAgICApO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHN1Ymdyb3VwcztcclxuICB9XHJcblxyXG4gIGlzUHJvamVjdEV4cGFuZGVkKHByb2plY3Q6IEluYm94SXRlbSk6IGJvb2xlYW4ge1xyXG4gICAgcmV0dXJuIHRoaXMuZXhwYW5kZWRQcm9qZWN0SWRzLmhhcyhTdHJpbmcocHJvamVjdC5jb252ZXJzYXRpb25faWQpKTtcclxuICB9XHJcblxyXG4gIHRvZ2dsZVByb2plY3QocHJvamVjdDogSW5ib3hJdGVtKTogdm9pZCB7XHJcbiAgICBjb25zdCBpZCA9IFN0cmluZyhwcm9qZWN0LmNvbnZlcnNhdGlvbl9pZCk7XHJcbiAgICBjb25zdCBuZXh0ID0gbmV3IFNldCh0aGlzLmV4cGFuZGVkUHJvamVjdElkcyk7XHJcbiAgICBpZiAobmV4dC5oYXMoaWQpKSB7XHJcbiAgICAgIG5leHQuZGVsZXRlKGlkKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIG5leHQuYWRkKGlkKTtcclxuICAgIH1cclxuICAgIHRoaXMuZXhwYW5kZWRQcm9qZWN0SWRzID0gbmV4dDtcclxuICB9XHJcblxyXG4gIGNyZWF0ZVN1Ymdyb3VwKHByb2plY3Q6IEluYm94SXRlbSwgZXZlbnQ6IEV2ZW50KTogdm9pZCB7XHJcbiAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcclxuICAgIHRoaXMuZXhwYW5kZWRQcm9qZWN0SWRzLmFkZChTdHJpbmcocHJvamVjdC5jb252ZXJzYXRpb25faWQpKTtcclxuICAgIHRoaXMuc3RvcmUub3BlblByb2plY3RTdWJncm91cENyZWF0b3IocHJvamVjdCk7XHJcbiAgfVxyXG5cclxuICBzZXRBY3RpdmVUYWIodGFiOiAnYWxsJyB8ICdkaXJlY3QnIHwgJ2dyb3VwcycgfCAncHJvamVjdHMnIHwgJ3NldHRpbmdzJyk6IHZvaWQge1xyXG4gICAgaWYgKHRhYiA9PT0gJ3Byb2plY3RzJyAmJiAhdGhpcy5wcm9qZWN0R3JvdXBzRW5hYmxlZCkgdGFiID0gJ2FsbCc7XHJcbiAgICB0aGlzLmFjdGl2ZVRhYiA9IHRhYjtcclxuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKHRoaXMudGFiU3RvcmFnZUtleSwgdGFiKTtcclxuICAgIHRoaXMuY29udGV4dE1lbnUgPSBudWxsO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBnZXRTYXZlZFRhYigpOiAnYWxsJyB8ICdkaXJlY3QnIHwgJ2dyb3VwcycgfCAncHJvamVjdHMnIHwgJ3NldHRpbmdzJyB7XHJcbiAgICBjb25zdCBzYXZlZCA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKHRoaXMudGFiU3RvcmFnZUtleSk7XHJcbiAgICBpZiAoc2F2ZWQgPT09ICdwcm9qZWN0cycgJiYgIXRoaXMucHJvamVjdEdyb3Vwc0VuYWJsZWQpIHJldHVybiAnYWxsJztcclxuICAgIHJldHVybiBzYXZlZCA9PT0gJ2RpcmVjdCcgfHwgc2F2ZWQgPT09ICdncm91cHMnIHx8IHNhdmVkID09PSAncHJvamVjdHMnIHx8IHNhdmVkID09PSAnc2V0dGluZ3MnIHx8IHNhdmVkID09PSAnYWxsJ1xyXG4gICAgICA/IHNhdmVkXHJcbiAgICAgIDogJ2FsbCc7XHJcbiAgfVxyXG5cclxuICB0b2dnbGVOb3RpZmljYXRpb25zTXV0ZWQoKTogdm9pZCB7XHJcbiAgICBjb25zdCBuZXh0TXV0ZWQgPSAhdGhpcy5ub3RpZmljYXRpb25zTXV0ZWQ7XHJcbiAgICB0aGlzLnN0b3JlLnNldE5vdGlmaWNhdGlvbnNNdXRlZChuZXh0TXV0ZWQpO1xyXG4gICAgaWYgKCFuZXh0TXV0ZWQgJiYgdGhpcy5ub3RpZmljYXRpb25Wb2x1bWUgPiAwKSB7XHJcbiAgICAgIHRoaXMuc3RvcmUudGVzdE5vdGlmaWNhdGlvblNvdW5kKCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBvbk5vdGlmaWNhdGlvblZvbHVtZUNoYW5nZSh2YWx1ZTogbnVtYmVyIHwgc3RyaW5nKTogdm9pZCB7XHJcbiAgICB0aGlzLnN0b3JlLnNldE5vdGlmaWNhdGlvblZvbHVtZShOdW1iZXIodmFsdWUpKTtcclxuICB9XHJcblxyXG4gIHByZXZpZXdOb3RpZmljYXRpb25Tb3VuZCgpOiB2b2lkIHtcclxuICAgIGlmICghdGhpcy5ub3RpZmljYXRpb25zTXV0ZWQgJiYgdGhpcy5ub3RpZmljYXRpb25Wb2x1bWUgPiAwKSB7XHJcbiAgICAgIHRoaXMuc3RvcmUudGVzdE5vdGlmaWNhdGlvblNvdW5kKCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBvbk1lc3NhZ2VUZXh0U2NhbGVDaGFuZ2UodmFsdWU6IG51bWJlciB8IHN0cmluZyk6IHZvaWQge1xyXG4gICAgdGhpcy5zdG9yZS5zZXRNZXNzYWdlVGV4dFNjYWxlKE51bWJlcih2YWx1ZSkpO1xyXG4gIH1cclxuXHJcbiAgb25Db2RlVGV4dFNjYWxlQ2hhbmdlKHZhbHVlOiBudW1iZXIgfCBzdHJpbmcpOiB2b2lkIHtcclxuICAgIHRoaXMuc3RvcmUuc2V0Q29kZVRleHRTY2FsZShOdW1iZXIodmFsdWUpKTtcclxuICB9XHJcblxyXG4gIG9wZW5Db252ZXJzYXRpb24oaXRlbTogSW5ib3hJdGVtKTogdm9pZCB7XHJcbiAgICBpZiAoaXNQcm9qZWN0Q29udGFpbmVyKGl0ZW0pKSB7XHJcbiAgICAgIHRoaXMudG9nZ2xlUHJvamVjdChpdGVtKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgdGhpcy5zdG9yZS5vcGVuQ29udmVyc2F0aW9uKFxyXG4gICAgICBpdGVtLmNvbnZlcnNhdGlvbl9pZCxcclxuICAgICAgaXRlbS5uYW1lIHx8ICdDaGF0JyxcclxuICAgICAgaXRlbS5pc19ncm91cCxcclxuICAgICAgdGhpcy5pc1Byb2plY3QoaXRlbSksXHJcbiAgICAgIGlzUHJvamVjdFN1Ymdyb3VwKGl0ZW0pLFxyXG4gICAgICBpdGVtLmRiX2dpZCxcclxuICAgICAgaXRlbS5wcm9qZWN0X2dpZCxcclxuICAgICAgaXRlbS5wYXJlbnRfY29udmVyc2F0aW9uX2lkLFxyXG4gICAgICBpdGVtLnN1Ymdyb3VwX3N1YmplY3QsXHJcbiAgICApO1xyXG4gIH1cclxuXHJcbiAgb25OZXdDb252ZXJzYXRpb24oKTogdm9pZCB7XHJcbiAgICB0aGlzLnN0b3JlLnNldFZpZXcoJ25ldy1jb252ZXJzYXRpb24nKTtcclxuICB9XHJcblxyXG4gIG9uQ3JlYXRlR3JvdXAoKTogdm9pZCB7XHJcbiAgICB0aGlzLnN0b3JlLnNldFZpZXcoJ2dyb3VwLW1hbmFnZXInKTtcclxuICB9XHJcblxyXG4gIG9uQ29udGV4dE1lbnUoZXZlbnQ6IE1vdXNlRXZlbnQsIGl0ZW06IEluYm94SXRlbSk6IHZvaWQge1xyXG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuICAgIGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xyXG4gICAgdGhpcy5jb250ZXh0TWVudSA9IHsgeDogZXZlbnQuY2xpZW50WCwgeTogZXZlbnQuY2xpZW50WSwgaXRlbSB9O1xyXG4gIH1cclxuXHJcbiAgY2xvc2VDb250ZXh0TWVudSgpOiB2b2lkIHtcclxuICAgIHRoaXMuY29udGV4dE1lbnUgPSBudWxsO1xyXG4gIH1cclxuXHJcbiAgY2xlYXJDaGF0KCk6IHZvaWQge1xyXG4gICAgaWYgKCF0aGlzLmNvbnRleHRNZW51KSByZXR1cm47XHJcbiAgICBjb25zdCBpZCA9IHRoaXMuY29udGV4dE1lbnUuaXRlbS5jb252ZXJzYXRpb25faWQ7XHJcbiAgICB0aGlzLnN0b3JlLmNsZWFyQ29udmVyc2F0aW9uKGlkKTtcclxuICAgIHRoaXMuY29udGV4dE1lbnUgPSBudWxsO1xyXG4gIH1cclxuXHJcbiAgZGVsZXRlQ2hhdCgpOiB2b2lkIHtcclxuICAgIGlmICghdGhpcy5jb250ZXh0TWVudSkgcmV0dXJuO1xyXG4gICAgY29uc3QgaXRlbSA9IHRoaXMuY29udGV4dE1lbnUuaXRlbTtcclxuICAgIGlmIChpdGVtLmlzX2dyb3VwKSB7XHJcbiAgICAgIHRoaXMuc3RvcmUuZGVsZXRlR3JvdXAoaXRlbS5jb252ZXJzYXRpb25faWQpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgdGhpcy5zdG9yZS5kZWxldGVDb252ZXJzYXRpb24oaXRlbS5jb252ZXJzYXRpb25faWQpO1xyXG4gICAgfVxyXG4gICAgdGhpcy5jb250ZXh0TWVudSA9IG51bGw7XHJcbiAgfVxyXG5cclxuICBmb3JtYXRUaW1lKGRhdGVTdHI6IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgICBpZiAoIWRhdGVTdHIpIHJldHVybiAnJztcclxuICAgIGNvbnN0IGRhdGUgPSBuZXcgRGF0ZShkYXRlU3RyKTtcclxuICAgIGNvbnN0IG5vdyA9IG5ldyBEYXRlKCk7XHJcbiAgICBjb25zdCBkaWZmTXMgPSBub3cuZ2V0VGltZSgpIC0gZGF0ZS5nZXRUaW1lKCk7XHJcbiAgICBjb25zdCBkaWZmTWlucyA9IE1hdGguZmxvb3IoZGlmZk1zIC8gNjAwMDApO1xyXG4gICAgY29uc3QgZGlmZkhvdXJzID0gTWF0aC5mbG9vcihkaWZmTXMgLyAzNjAwMDAwKTtcclxuICAgIGNvbnN0IGRpZmZEYXlzID0gTWF0aC5mbG9vcihkaWZmTXMgLyA4NjQwMDAwMCk7XHJcblxyXG4gICAgaWYgKGRpZmZNaW5zIDwgMSkgcmV0dXJuICdub3cnO1xyXG4gICAgaWYgKGRpZmZNaW5zIDwgNjApIHJldHVybiBgJHtkaWZmTWluc31tYDtcclxuICAgIGlmIChkaWZmSG91cnMgPCAyNCkgcmV0dXJuIGAke2RpZmZIb3Vyc31oYDtcclxuICAgIGlmIChkaWZmRGF5cyA8IDcpIHJldHVybiBgJHtkaWZmRGF5c31kYDtcclxuXHJcbiAgICByZXR1cm4gZGF0ZS50b0xvY2FsZURhdGVTdHJpbmcoJ2VuLUdCJywgeyBkYXk6ICdudW1lcmljJywgbW9udGg6ICdzaG9ydCcgfSk7XHJcbiAgfVxyXG59XHJcbiJdfQ==