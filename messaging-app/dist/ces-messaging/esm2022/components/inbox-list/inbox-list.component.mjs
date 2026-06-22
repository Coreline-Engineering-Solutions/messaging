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
import * as i2 from "../../services/ticket-notification.service";
import * as i3 from "@angular/common";
import * as i4 from "@angular/forms";
import * as i5 from "@angular/material/icon";
import * as i6 from "@angular/material/button";
import * as i7 from "@angular/material/core";
import * as i8 from "@angular/material/tooltip";
export class InboxListComponent {
    store;
    ticketNotifications;
    inbox = [];
    myTickets = [];
    ticketUnseenCount = 0;
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
    constructor(store, ticketNotifications) {
        this.store = store;
        this.ticketNotifications = ticketNotifications;
    }
    get projectGroupsEnabled() {
        return this.store.projectGroupsEnabled;
    }
    get ticketsTabVisible() {
        return this.ticketNotifications.enabled && this.myTickets.length > 0;
    }
    get visibleTabCount() {
        let count = 4;
        if (this.projectGroupsEnabled)
            count++;
        if (this.ticketsTabVisible)
            count++;
        return count;
    }
    ngOnInit() {
        const savedTab = this.getSavedTab();
        this.activeTab = savedTab === 'tickets' ? 'all' : savedTab;
        const restoreTicketsTab = savedTab === 'tickets';
        this.sub = new Subscription();
        this.sub.add(this.store.inbox.subscribe((items) => (this.inbox = items)));
        this.sub.add(this.store.notificationVolume.subscribe((volume) => (this.notificationVolume = volume)));
        this.sub.add(this.store.notificationsMuted.subscribe((muted) => (this.notificationsMuted = muted)));
        this.sub.add(this.store.messageTextScale.subscribe((scale) => (this.messageTextScale = scale)));
        this.sub.add(this.store.codeTextScale.subscribe((scale) => (this.codeTextScale = scale)));
        if (this.ticketNotifications.enabled) {
            let restoredTicketsTab = false;
            this.sub.add(this.ticketNotifications.tickets.subscribe((tickets) => {
                this.myTickets = tickets;
                if (!restoredTicketsTab && restoreTicketsTab && tickets.length > 0) {
                    restoredTicketsTab = true;
                    this.setActiveTab('tickets');
                }
                else if (this.activeTab === 'tickets' && tickets.length === 0) {
                    this.setActiveTab('all');
                }
            }));
            this.sub.add(this.ticketNotifications.unseenCount.subscribe((count) => (this.ticketUnseenCount = count)));
            this.ticketNotifications.loadTickets();
        }
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
        if (this.activeTab === 'tickets')
            return this.myTickets.length === 0;
        if (this.activeTab === 'projects')
            return this.projectContainers.length === 0;
        return this.filteredInbox.length === 0;
    }
    get emptyStateIcon() {
        if (this.activeTab === 'tickets')
            return 'confirmation_number';
        if (this.activeTab === 'projects')
            return 'workspaces';
        if (this.activeTab === 'groups')
            return 'group';
        return 'forum';
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
        if (this.activeTab === 'tickets')
            return 'No tickets assigned to you';
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
        if (tab === 'tickets' && !this.ticketsTabVisible)
            tab = 'all';
        this.activeTab = tab;
        localStorage.setItem(this.tabStorageKey, tab);
        this.contextMenu = null;
        if (tab === 'tickets') {
            this.ticketNotifications.loadTickets();
        }
    }
    getSavedTab() {
        const saved = localStorage.getItem(this.tabStorageKey);
        if (saved === 'projects' && !this.projectGroupsEnabled)
            return 'all';
        if (saved === 'tickets')
            return 'tickets';
        return saved === 'direct' || saved === 'groups' || saved === 'projects' || saved === 'settings' || saved === 'all'
            ? saved
            : 'all';
    }
    markTicketRead(ticket) {
        this.ticketNotifications.markSeen(ticket);
    }
    goToTicketingDashboard() {
        this.ticketNotifications.navigateToDashboard();
    }
    formatTicketDate(value) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime()))
            return value;
        return date.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
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
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: InboxListComponent, deps: [{ token: i1.MessagingStoreService }, { token: i2.TicketNotificationService }], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "17.3.12", type: InboxListComponent, isStandalone: true, selector: "app-inbox-list", ngImport: i0, template: `
    <div class="inbox-container">
      <div *ngIf="activeTab !== 'settings' && activeTab !== 'tickets'" class="search-bar">
        <mat-icon class="search-icon">search</mat-icon>
        <input
          type="text"
          [(ngModel)]="searchQuery"
          placeholder="Search conversations..."
          class="search-input"
        />
      </div>

      <div class="conversation-list">
        <ng-container *ngIf="activeTab === 'tickets'">
          <div
            *ngFor="let ticket of myTickets"
            class="ticket-item"
            [class.unseen]="!ticket.is_seen"
          >
            <div class="ticket-item-header">
              <span class="ticket-ref">{{ ticket.ticket_ref }}</span>
              <span class="ticket-status" [attr.data-status]="ticket.ticket_status">{{ ticket.ticket_status }}</span>
            </div>
            <div class="ticket-item-body">
              <p class="ticket-type">{{ ticket.type }}<ng-container *ngIf="ticket.type_detail"> — {{ ticket.type_detail }}</ng-container></p>
              <p class="ticket-meta" *ngIf="ticket.user_requested">Requested by {{ ticket.user_requested }}</p>
              <p class="ticket-meta" *ngIf="ticket.created_at">{{ formatTicketDate(ticket.created_at) }}</p>
            </div>
            <div class="ticket-item-actions">
              <button type="button" class="ticket-action-btn ticket-action-btn--primary" (click)="goToTicketingDashboard()">
                <mat-icon>open_in_new</mat-icon>
                Take me there
              </button>
              <button
                type="button"
                class="ticket-action-btn"
                *ngIf="!ticket.is_seen"
                (click)="markTicketRead(ticket)"
              >
                <mat-icon>done</mat-icon>
                Mark as read
              </button>
            </div>
            <span class="ticket-unseen-dot" *ngIf="!ticket.is_seen"></span>
          </div>
        </ng-container>

        <ng-container *ngIf="activeTab === 'projects' && projectGroupsEnabled">
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

        <ng-container *ngIf="activeTab !== 'tickets' && activeTab !== 'settings' && !(activeTab === 'projects' && projectGroupsEnabled)">
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
        </ng-container>

        <div *ngIf="showEmptyState" class="empty-state">
          <mat-icon>{{ emptyStateIcon }}</mat-icon>
          <p>{{ emptyStateText }}</p>
          <button *ngIf="!searchQuery && activeTab !== 'groups' && activeTab !== 'projects' && activeTab !== 'tickets'" mat-stroked-button color="primary" (click)="onNewConversation()">
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

      <div class="inbox-tabs" role="tablist" aria-label="Conversation filters" [style.--tab-count]="visibleTabCount">
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
          *ngIf="ticketsTabVisible"
          type="button"
          class="inbox-tab inbox-tab--tickets"
          [class.active]="activeTab === 'tickets'"
          (click)="setActiveTab('tickets')"
          matTooltip="Tickets"
          matTooltipPosition="above"
        >
          <mat-icon>confirmation_number</mat-icon>
          <span *ngIf="ticketUnseenCount > 0" class="tab-badge">{{ ticketUnseenCount > 9 ? '9+' : ticketUnseenCount }}</span>
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
  `, isInline: true, styles: [".inbox-container{display:flex;flex-direction:column;height:100%;background:transparent;container-type:inline-size}.search-bar{display:flex;align-items:center;margin:8px 16px;padding:8px 12px;background:transparent;border-radius:10px}.search-icon{color:#ffffffb3;font-size:18px;width:20px;height:20px;margin-right:8px}.search-input{flex:1;border:none;outline:none;background:transparent;font-size:14px;color:#fff}.search-input::placeholder{color:#fff9}.inbox-tabs{display:grid;grid-template-columns:repeat(var(--tab-count, 5),minmax(0,1fr));gap:5px;padding:10px 16px 12px;border-top:1px solid rgba(255,255,255,.1);flex-shrink:0}.inbox-tab--tickets{position:relative}.tab-badge{position:absolute;top:0;right:2px;min-width:14px;height:14px;padding:0 3px;border-radius:7px;background:#ef4444;color:#fff;font-size:9px;font-weight:700;line-height:14px;text-align:center}.ticket-item{position:relative;margin:8px 12px;padding:12px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:#ffffff0a}.ticket-item.unseen{border-color:#7fb4ff73;background:#1a5fa82e}.ticket-item-header{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px}.ticket-ref{font-weight:700;font-size:13px;color:#fff}.ticket-status{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.03em;padding:2px 6px;border-radius:4px;background:#ffffff1f;color:#ffffffd9;white-space:nowrap}.ticket-item-body{margin-bottom:10px}.ticket-type{margin:0 0 4px;font-size:12px;color:#ffffffe6}.ticket-meta{margin:0;font-size:11px;color:#ffffffa6}.ticket-item-actions{display:flex;flex-wrap:wrap;gap:6px}.ticket-action-btn{display:inline-flex;align-items:center;gap:4px;border:1px solid rgba(255,255,255,.2);background:#ffffff14;color:#ffffffe6;border-radius:6px;padding:5px 8px;font-size:11px;font-weight:600;cursor:pointer}.ticket-action-btn mat-icon{font-size:14px;width:14px;height:14px}.ticket-action-btn--primary{border-color:#7fb4ff80;background:#1a5fa859;color:#fff}.ticket-action-btn:hover{background:#ffffff24}.ticket-unseen-dot{position:absolute;top:10px;left:6px;width:6px;height:6px;border-radius:50%;background:#60a5fa}.inbox-tab{min-width:0;border:1px solid rgba(255,255,255,.14);background:#ffffff0f;color:#ffffffb8;border-radius:999px;padding:6px 4px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:background .15s,border-color .15s,color .15s}.inbox-tab mat-icon{font-size:clamp(17px,6cqw,21px);width:clamp(17px,6cqw,21px);height:clamp(17px,6cqw,21px);line-height:clamp(17px,6cqw,21px)}.inbox-tab:hover{background:#ffffff1f;color:#fff}.inbox-tab.active{background:#1a5fa859;border-color:#7fb4ff73;color:#fff}@container (max-width: 330px){.inbox-tabs{gap:3px;padding:8px 8px 10px}.inbox-tab{padding:6px 2px;letter-spacing:-.2px}}@container (max-width: 280px){.inbox-tabs{gap:2px;padding-left:6px;padding-right:6px}.inbox-tab{font-size:8.5px}}.conversation-list{flex:1;overflow-y:auto;scrollbar-width:none;-ms-overflow-style:none}.conversation-list::-webkit-scrollbar{display:none}.conversation-item{display:flex;align-items:center;padding:12px 16px;cursor:pointer;transition:background .15s;gap:12px}.conversation-item:hover{background:#ffffff1a}.conversation-item.has-unread{background:#ffffff26}.avatar{width:48px;height:48px;border-radius:50%;background:#0d2540;display:flex;align-items:center;justify-content:center;flex-shrink:0}.avatar mat-icon{color:#ffffffb3;font-size:24px}.group-avatar{background:#0a1f38}.group-avatar mat-icon{color:#ffffffb3}.project-avatar{background:#2563eb33}.project-avatar mat-icon{color:#bfdbfe}.project-container{border-bottom:1px solid rgba(255,255,255,.06)}.project-header{display:flex;align-items:center;padding:12px 16px;cursor:pointer;gap:12px;transition:background .15s}.project-header:hover{background:#ffffff14}.subgroup-create{width:28px;height:28px;border:1px solid rgba(191,219,254,.35);border-radius:999px;background:#2563eb2e;color:#bfdbfe;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0}.subgroup-create mat-icon{font-size:18px;width:18px;height:18px}.expand-icon{color:#fff9;font-size:20px;width:20px;height:20px;flex-shrink:0}.subgroup-list{padding-bottom:6px}.subgroup-item{padding-left:32px;background:#ffffff06}.subgroup-avatar{width:38px;height:38px;background:#3b82f624}.subgroup-avatar mat-icon{color:#dbeafe;font-size:21px}.empty-subgroups{padding:8px 16px 12px 92px;color:#ffffff8c;font-size:12px}.conversation-info{flex:1;min-width:0}.info-top{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:2px}.conv-name{font-weight:600;font-size:14px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px}.conv-time{font-size:11px;color:#ffffffb3;flex-shrink:0;margin-left:8px}.info-bottom{display:flex;justify-content:space-between;align-items:center;gap:6px}.conv-preview{font-size:13px;color:#ffffffb3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px}.has-unread .conv-name{color:#fff}.has-unread .conv-preview{color:#ffffffe6;font-weight:500}.unread-badge{background:#1a5fa8;color:#fff;border-radius:10px;min-width:20px;height:20px;font-size:11px;font-weight:600;display:flex;align-items:center;justify-content:center;padding:0 6px;flex-shrink:0}.mention-badge{width:20px;height:20px;border-radius:999px;background:#7fb4ff33;border:1px solid rgba(127,180,255,.55);color:#bfdbfe;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex-shrink:0;margin-left:6px;box-shadow:0 0 0 2px #7fb4ff0f}.empty-state{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 24px;color:#9ca3af}.empty-state mat-icon{font-size:48px;width:48px;height:48px;margin-bottom:12px}.empty-state p{margin:0 0 16px;font-size:14px}.settings-panel{padding:16px;color:#fff;display:flex;flex-direction:column;gap:12px}.settings-card{border-radius:14px;background:#ffffff12;border:1px solid rgba(255,255,255,.12);padding:16px;box-shadow:0 10px 28px #0000002e}.settings-header{display:flex;gap:12px;align-items:flex-start;margin-bottom:16px}.settings-icon{width:36px;height:36px;border-radius:10px;background:#1a5fa859;display:flex;align-items:center;justify-content:center;flex-shrink:0}.settings-icon mat-icon{color:#bfdbfe}.settings-icon.display-icon{background:#86efac24}.settings-icon.display-icon mat-icon{color:#bbf7d0}.settings-header h4{margin:0 0 4px;font-size:15px;font-weight:700}.settings-header p{margin:0;color:#ffffffa6;font-size:12px;line-height:1.4}.settings-toggle{width:100%;justify-content:center;border-radius:10px;color:#fff!important;border-color:#fff3!important;margin-bottom:16px}.settings-toggle mat-icon{margin-right:8px;font-size:18px;width:18px;height:18px}.volume-label{display:flex;justify-content:space-between;align-items:center;color:#ffffffc7;font-size:12px;font-weight:600;margin-bottom:8px}.settings-volume{width:100%;accent-color:#7fb4ff;cursor:pointer;margin-bottom:12px}.settings-preview{margin:0 0 16px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:#ffffff0f;color:#f5f7ff;box-sizing:border-box}.message-preview{padding:9px 11px;line-height:1.35}.code-preview{padding:10px 11px;overflow:hidden;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,Liberation Mono,monospace;line-height:1.45;white-space:pre-wrap;color:#dbeafe;background:#061827;margin-bottom:0}.context-menu{position:fixed;z-index:10001;background:#071d30;border-radius:8px;padding:4px 0;box-shadow:0 8px 24px #0000004d;min-width:200px}.ctx-item{display:flex;align-items:center;gap:10px;padding:10px 16px;cursor:pointer;color:#ffffffe6;font-size:13px;transition:background .15s}.ctx-item:hover{background:#ffffff1a}.ctx-item mat-icon{font-size:18px;width:18px;height:18px}.ctx-danger{color:#f87171}.ctx-danger:hover{background:#f8717126}.ctx-backdrop{position:fixed;inset:0;z-index:10000}\n"], dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i3.NgForOf, selector: "[ngFor][ngForOf]", inputs: ["ngForOf", "ngForTrackBy", "ngForTemplate"] }, { kind: "directive", type: i3.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "pipe", type: i3.DecimalPipe, name: "number" }, { kind: "ngmodule", type: FormsModule }, { kind: "directive", type: i4.DefaultValueAccessor, selector: "input:not([type=checkbox])[formControlName],textarea[formControlName],input:not([type=checkbox])[formControl],textarea[formControl],input:not([type=checkbox])[ngModel],textarea[ngModel],[ngDefaultControl]" }, { kind: "directive", type: i4.RangeValueAccessor, selector: "input[type=range][formControlName],input[type=range][formControl],input[type=range][ngModel]" }, { kind: "directive", type: i4.NgControlStatus, selector: "[formControlName],[ngModel],[formControl]" }, { kind: "directive", type: i4.NgModel, selector: "[ngModel]:not([formControlName]):not([formControl])", inputs: ["name", "disabled", "ngModel", "ngModelOptions"], outputs: ["ngModelChange"], exportAs: ["ngModel"] }, { kind: "ngmodule", type: MatIconModule }, { kind: "component", type: i5.MatIcon, selector: "mat-icon", inputs: ["color", "inline", "svgIcon", "fontSet", "fontIcon"], exportAs: ["matIcon"] }, { kind: "ngmodule", type: MatButtonModule }, { kind: "component", type: i6.MatButton, selector: "    button[mat-button], button[mat-raised-button], button[mat-flat-button],    button[mat-stroked-button]  ", exportAs: ["matButton"] }, { kind: "ngmodule", type: MatRippleModule }, { kind: "directive", type: i7.MatRipple, selector: "[mat-ripple], [matRipple]", inputs: ["matRippleColor", "matRippleUnbounded", "matRippleCentered", "matRippleRadius", "matRippleAnimation", "matRippleDisabled", "matRippleTrigger"], exportAs: ["matRipple"] }, { kind: "ngmodule", type: MatTooltipModule }, { kind: "directive", type: i8.MatTooltip, selector: "[matTooltip]", inputs: ["matTooltipPosition", "matTooltipPositionAtOrigin", "matTooltipDisabled", "matTooltipShowDelay", "matTooltipHideDelay", "matTooltipTouchGestures", "matTooltip", "matTooltipClass"], exportAs: ["matTooltip"] }] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: InboxListComponent, decorators: [{
            type: Component,
            args: [{ selector: 'app-inbox-list', standalone: true, imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatRippleModule, MatTooltipModule], template: `
    <div class="inbox-container">
      <div *ngIf="activeTab !== 'settings' && activeTab !== 'tickets'" class="search-bar">
        <mat-icon class="search-icon">search</mat-icon>
        <input
          type="text"
          [(ngModel)]="searchQuery"
          placeholder="Search conversations..."
          class="search-input"
        />
      </div>

      <div class="conversation-list">
        <ng-container *ngIf="activeTab === 'tickets'">
          <div
            *ngFor="let ticket of myTickets"
            class="ticket-item"
            [class.unseen]="!ticket.is_seen"
          >
            <div class="ticket-item-header">
              <span class="ticket-ref">{{ ticket.ticket_ref }}</span>
              <span class="ticket-status" [attr.data-status]="ticket.ticket_status">{{ ticket.ticket_status }}</span>
            </div>
            <div class="ticket-item-body">
              <p class="ticket-type">{{ ticket.type }}<ng-container *ngIf="ticket.type_detail"> — {{ ticket.type_detail }}</ng-container></p>
              <p class="ticket-meta" *ngIf="ticket.user_requested">Requested by {{ ticket.user_requested }}</p>
              <p class="ticket-meta" *ngIf="ticket.created_at">{{ formatTicketDate(ticket.created_at) }}</p>
            </div>
            <div class="ticket-item-actions">
              <button type="button" class="ticket-action-btn ticket-action-btn--primary" (click)="goToTicketingDashboard()">
                <mat-icon>open_in_new</mat-icon>
                Take me there
              </button>
              <button
                type="button"
                class="ticket-action-btn"
                *ngIf="!ticket.is_seen"
                (click)="markTicketRead(ticket)"
              >
                <mat-icon>done</mat-icon>
                Mark as read
              </button>
            </div>
            <span class="ticket-unseen-dot" *ngIf="!ticket.is_seen"></span>
          </div>
        </ng-container>

        <ng-container *ngIf="activeTab === 'projects' && projectGroupsEnabled">
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

        <ng-container *ngIf="activeTab !== 'tickets' && activeTab !== 'settings' && !(activeTab === 'projects' && projectGroupsEnabled)">
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
        </ng-container>

        <div *ngIf="showEmptyState" class="empty-state">
          <mat-icon>{{ emptyStateIcon }}</mat-icon>
          <p>{{ emptyStateText }}</p>
          <button *ngIf="!searchQuery && activeTab !== 'groups' && activeTab !== 'projects' && activeTab !== 'tickets'" mat-stroked-button color="primary" (click)="onNewConversation()">
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

      <div class="inbox-tabs" role="tablist" aria-label="Conversation filters" [style.--tab-count]="visibleTabCount">
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
          *ngIf="ticketsTabVisible"
          type="button"
          class="inbox-tab inbox-tab--tickets"
          [class.active]="activeTab === 'tickets'"
          (click)="setActiveTab('tickets')"
          matTooltip="Tickets"
          matTooltipPosition="above"
        >
          <mat-icon>confirmation_number</mat-icon>
          <span *ngIf="ticketUnseenCount > 0" class="tab-badge">{{ ticketUnseenCount > 9 ? '9+' : ticketUnseenCount }}</span>
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
  `, styles: [".inbox-container{display:flex;flex-direction:column;height:100%;background:transparent;container-type:inline-size}.search-bar{display:flex;align-items:center;margin:8px 16px;padding:8px 12px;background:transparent;border-radius:10px}.search-icon{color:#ffffffb3;font-size:18px;width:20px;height:20px;margin-right:8px}.search-input{flex:1;border:none;outline:none;background:transparent;font-size:14px;color:#fff}.search-input::placeholder{color:#fff9}.inbox-tabs{display:grid;grid-template-columns:repeat(var(--tab-count, 5),minmax(0,1fr));gap:5px;padding:10px 16px 12px;border-top:1px solid rgba(255,255,255,.1);flex-shrink:0}.inbox-tab--tickets{position:relative}.tab-badge{position:absolute;top:0;right:2px;min-width:14px;height:14px;padding:0 3px;border-radius:7px;background:#ef4444;color:#fff;font-size:9px;font-weight:700;line-height:14px;text-align:center}.ticket-item{position:relative;margin:8px 12px;padding:12px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:#ffffff0a}.ticket-item.unseen{border-color:#7fb4ff73;background:#1a5fa82e}.ticket-item-header{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px}.ticket-ref{font-weight:700;font-size:13px;color:#fff}.ticket-status{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.03em;padding:2px 6px;border-radius:4px;background:#ffffff1f;color:#ffffffd9;white-space:nowrap}.ticket-item-body{margin-bottom:10px}.ticket-type{margin:0 0 4px;font-size:12px;color:#ffffffe6}.ticket-meta{margin:0;font-size:11px;color:#ffffffa6}.ticket-item-actions{display:flex;flex-wrap:wrap;gap:6px}.ticket-action-btn{display:inline-flex;align-items:center;gap:4px;border:1px solid rgba(255,255,255,.2);background:#ffffff14;color:#ffffffe6;border-radius:6px;padding:5px 8px;font-size:11px;font-weight:600;cursor:pointer}.ticket-action-btn mat-icon{font-size:14px;width:14px;height:14px}.ticket-action-btn--primary{border-color:#7fb4ff80;background:#1a5fa859;color:#fff}.ticket-action-btn:hover{background:#ffffff24}.ticket-unseen-dot{position:absolute;top:10px;left:6px;width:6px;height:6px;border-radius:50%;background:#60a5fa}.inbox-tab{min-width:0;border:1px solid rgba(255,255,255,.14);background:#ffffff0f;color:#ffffffb8;border-radius:999px;padding:6px 4px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:background .15s,border-color .15s,color .15s}.inbox-tab mat-icon{font-size:clamp(17px,6cqw,21px);width:clamp(17px,6cqw,21px);height:clamp(17px,6cqw,21px);line-height:clamp(17px,6cqw,21px)}.inbox-tab:hover{background:#ffffff1f;color:#fff}.inbox-tab.active{background:#1a5fa859;border-color:#7fb4ff73;color:#fff}@container (max-width: 330px){.inbox-tabs{gap:3px;padding:8px 8px 10px}.inbox-tab{padding:6px 2px;letter-spacing:-.2px}}@container (max-width: 280px){.inbox-tabs{gap:2px;padding-left:6px;padding-right:6px}.inbox-tab{font-size:8.5px}}.conversation-list{flex:1;overflow-y:auto;scrollbar-width:none;-ms-overflow-style:none}.conversation-list::-webkit-scrollbar{display:none}.conversation-item{display:flex;align-items:center;padding:12px 16px;cursor:pointer;transition:background .15s;gap:12px}.conversation-item:hover{background:#ffffff1a}.conversation-item.has-unread{background:#ffffff26}.avatar{width:48px;height:48px;border-radius:50%;background:#0d2540;display:flex;align-items:center;justify-content:center;flex-shrink:0}.avatar mat-icon{color:#ffffffb3;font-size:24px}.group-avatar{background:#0a1f38}.group-avatar mat-icon{color:#ffffffb3}.project-avatar{background:#2563eb33}.project-avatar mat-icon{color:#bfdbfe}.project-container{border-bottom:1px solid rgba(255,255,255,.06)}.project-header{display:flex;align-items:center;padding:12px 16px;cursor:pointer;gap:12px;transition:background .15s}.project-header:hover{background:#ffffff14}.subgroup-create{width:28px;height:28px;border:1px solid rgba(191,219,254,.35);border-radius:999px;background:#2563eb2e;color:#bfdbfe;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0}.subgroup-create mat-icon{font-size:18px;width:18px;height:18px}.expand-icon{color:#fff9;font-size:20px;width:20px;height:20px;flex-shrink:0}.subgroup-list{padding-bottom:6px}.subgroup-item{padding-left:32px;background:#ffffff06}.subgroup-avatar{width:38px;height:38px;background:#3b82f624}.subgroup-avatar mat-icon{color:#dbeafe;font-size:21px}.empty-subgroups{padding:8px 16px 12px 92px;color:#ffffff8c;font-size:12px}.conversation-info{flex:1;min-width:0}.info-top{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:2px}.conv-name{font-weight:600;font-size:14px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px}.conv-time{font-size:11px;color:#ffffffb3;flex-shrink:0;margin-left:8px}.info-bottom{display:flex;justify-content:space-between;align-items:center;gap:6px}.conv-preview{font-size:13px;color:#ffffffb3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px}.has-unread .conv-name{color:#fff}.has-unread .conv-preview{color:#ffffffe6;font-weight:500}.unread-badge{background:#1a5fa8;color:#fff;border-radius:10px;min-width:20px;height:20px;font-size:11px;font-weight:600;display:flex;align-items:center;justify-content:center;padding:0 6px;flex-shrink:0}.mention-badge{width:20px;height:20px;border-radius:999px;background:#7fb4ff33;border:1px solid rgba(127,180,255,.55);color:#bfdbfe;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex-shrink:0;margin-left:6px;box-shadow:0 0 0 2px #7fb4ff0f}.empty-state{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 24px;color:#9ca3af}.empty-state mat-icon{font-size:48px;width:48px;height:48px;margin-bottom:12px}.empty-state p{margin:0 0 16px;font-size:14px}.settings-panel{padding:16px;color:#fff;display:flex;flex-direction:column;gap:12px}.settings-card{border-radius:14px;background:#ffffff12;border:1px solid rgba(255,255,255,.12);padding:16px;box-shadow:0 10px 28px #0000002e}.settings-header{display:flex;gap:12px;align-items:flex-start;margin-bottom:16px}.settings-icon{width:36px;height:36px;border-radius:10px;background:#1a5fa859;display:flex;align-items:center;justify-content:center;flex-shrink:0}.settings-icon mat-icon{color:#bfdbfe}.settings-icon.display-icon{background:#86efac24}.settings-icon.display-icon mat-icon{color:#bbf7d0}.settings-header h4{margin:0 0 4px;font-size:15px;font-weight:700}.settings-header p{margin:0;color:#ffffffa6;font-size:12px;line-height:1.4}.settings-toggle{width:100%;justify-content:center;border-radius:10px;color:#fff!important;border-color:#fff3!important;margin-bottom:16px}.settings-toggle mat-icon{margin-right:8px;font-size:18px;width:18px;height:18px}.volume-label{display:flex;justify-content:space-between;align-items:center;color:#ffffffc7;font-size:12px;font-weight:600;margin-bottom:8px}.settings-volume{width:100%;accent-color:#7fb4ff;cursor:pointer;margin-bottom:12px}.settings-preview{margin:0 0 16px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:#ffffff0f;color:#f5f7ff;box-sizing:border-box}.message-preview{padding:9px 11px;line-height:1.35}.code-preview{padding:10px 11px;overflow:hidden;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,Liberation Mono,monospace;line-height:1.45;white-space:pre-wrap;color:#dbeafe;background:#061827;margin-bottom:0}.context-menu{position:fixed;z-index:10001;background:#071d30;border-radius:8px;padding:4px 0;box-shadow:0 8px 24px #0000004d;min-width:200px}.ctx-item{display:flex;align-items:center;gap:10px;padding:10px 16px;cursor:pointer;color:#ffffffe6;font-size:13px;transition:background .15s}.ctx-item:hover{background:#ffffff1a}.ctx-item mat-icon{font-size:18px;width:18px;height:18px}.ctx-danger{color:#f87171}.ctx-danger:hover{background:#f8717126}.ctx-backdrop{position:fixed;inset:0;z-index:10000}\n"] }]
        }], ctorParameters: () => [{ type: i1.MessagingStoreService }, { type: i2.TicketNotificationService }] });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5ib3gtbGlzdC5jb21wb25lbnQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvbGliL2NvbXBvbmVudHMvaW5ib3gtbGlzdC9pbmJveC1saXN0LmNvbXBvbmVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsU0FBUyxFQUFxQixNQUFNLGVBQWUsQ0FBQztBQUM3RCxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDL0MsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLGdCQUFnQixDQUFDO0FBQzdDLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSx3QkFBd0IsQ0FBQztBQUN2RCxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFDM0QsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHdCQUF3QixDQUFDO0FBQ3pELE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBQzdELE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxNQUFNLENBQUM7QUFHcEMsT0FBTyxFQUFhLGtCQUFrQixFQUFFLHFCQUFxQixFQUFFLGlCQUFpQixFQUFFLE1BQU0sK0JBQStCLENBQUM7Ozs7Ozs7Ozs7QUFvOEJ4SCxNQUFNLE9BQU8sa0JBQWtCO0lBZ0JuQjtJQUNBO0lBaEJWLEtBQUssR0FBZ0IsRUFBRSxDQUFDO0lBQ3hCLFNBQVMsR0FBNkIsRUFBRSxDQUFDO0lBQ3pDLGlCQUFpQixHQUFHLENBQUMsQ0FBQztJQUN0QixXQUFXLEdBQUcsRUFBRSxDQUFDO0lBQ2pCLFNBQVMsR0FBYSxLQUFLLENBQUM7SUFDNUIsa0JBQWtCLEdBQUcsSUFBSSxDQUFDO0lBQzFCLGtCQUFrQixHQUFHLEtBQUssQ0FBQztJQUMzQixnQkFBZ0IsR0FBRyxDQUFDLENBQUM7SUFDckIsYUFBYSxHQUFHLENBQUMsQ0FBQztJQUNsQixXQUFXLEdBQXFELElBQUksQ0FBQztJQUNy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LElBQUksV0FDUCxDQUFDLFlBQVksRUFBRSxXQUFXLEVBQUUsYUFBYSxFQUFFLGVBQWUsRUFBRSxlQUFlLEVBQUUsZ0JBQWdCLENBQUMsWUFDN0Y7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBc1VUIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQ29tcG9uZW50LCBPbkluaXQsIE9uRGVzdHJveSB9IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xyXG5pbXBvcnQgeyBDb21tb25Nb2R1bGUgfSBmcm9tICdAYW5ndWxhci9jb21tb24nO1xyXG5pbXBvcnQgeyBGb3Jtc01vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL2Zvcm1zJztcclxuaW1wb3J0IHsgTWF0SWNvbk1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL21hdGVyaWFsL2ljb24nO1xyXG5pbXBvcnQgeyBNYXRCdXR0b25Nb2R1bGUgfSBmcm9tICdAYW5ndWxhci9tYXRlcmlhbC9idXR0b24nO1xyXG5pbXBvcnQgeyBNYXRSaXBwbGVNb2R1bGUgfSBmcm9tICdAYW5ndWxhci9tYXRlcmlhbC9jb3JlJztcclxuaW1wb3J0IHsgTWF0VG9vbHRpcE1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL21hdGVyaWFsL3Rvb2x0aXAnO1xyXG5pbXBvcnQgeyBTdWJzY3JpcHRpb24gfSBmcm9tICdyeGpzJztcclxuaW1wb3J0IHsgTWVzc2FnaW5nU3RvcmVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvbWVzc2FnaW5nLXN0b3JlLnNlcnZpY2UnO1xyXG5pbXBvcnQgeyBUaWNrZXROb3RpZmljYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvdGlja2V0LW5vdGlmaWNhdGlvbi5zZXJ2aWNlJztcclxuaW1wb3J0IHsgSW5ib3hJdGVtLCBpc1Byb2plY3RDb250YWluZXIsIGlzUHJvamVjdENvbnZlcnNhdGlvbiwgaXNQcm9qZWN0U3ViZ3JvdXAgfSBmcm9tICcuLi8uLi9tb2RlbHMvbWVzc2FnaW5nLm1vZGVscyc7XHJcbmltcG9ydCB7IFRpY2tldE5vdGlmaWNhdGlvbkl0ZW0gfSBmcm9tICcuLi8uLi9tb2RlbHMvdGlja2V0LW5vdGlmaWNhdGlvbi5tb2RlbCc7XHJcblxyXG50eXBlIEluYm94VGFiID0gJ2FsbCcgfCAnZGlyZWN0JyB8ICdncm91cHMnIHwgJ3Byb2plY3RzJyB8ICd0aWNrZXRzJyB8ICdzZXR0aW5ncyc7XHJcblxyXG5AQ29tcG9uZW50KHtcclxuICBzZWxlY3RvcjogJ2FwcC1pbmJveC1saXN0JyxcclxuICBzdGFuZGFsb25lOiB0cnVlLFxyXG4gIGltcG9ydHM6IFtDb21tb25Nb2R1bGUsIEZvcm1zTW9kdWxlLCBNYXRJY29uTW9kdWxlLCBNYXRCdXR0b25Nb2R1bGUsIE1hdFJpcHBsZU1vZHVsZSwgTWF0VG9vbHRpcE1vZHVsZV0sXHJcbiAgdGVtcGxhdGU6IGBcclxuICAgIDxkaXYgY2xhc3M9XCJpbmJveC1jb250YWluZXJcIj5cclxuICAgICAgPGRpdiAqbmdJZj1cImFjdGl2ZVRhYiAhPT0gJ3NldHRpbmdzJyAmJiBhY3RpdmVUYWIgIT09ICd0aWNrZXRzJ1wiIGNsYXNzPVwic2VhcmNoLWJhclwiPlxyXG4gICAgICAgIDxtYXQtaWNvbiBjbGFzcz1cInNlYXJjaC1pY29uXCI+c2VhcmNoPC9tYXQtaWNvbj5cclxuICAgICAgICA8aW5wdXRcclxuICAgICAgICAgIHR5cGU9XCJ0ZXh0XCJcclxuICAgICAgICAgIFsobmdNb2RlbCldPVwic2VhcmNoUXVlcnlcIlxyXG4gICAgICAgICAgcGxhY2Vob2xkZXI9XCJTZWFyY2ggY29udmVyc2F0aW9ucy4uLlwiXHJcbiAgICAgICAgICBjbGFzcz1cInNlYXJjaC1pbnB1dFwiXHJcbiAgICAgICAgLz5cclxuICAgICAgPC9kaXY+XHJcblxyXG4gICAgICA8ZGl2IGNsYXNzPVwiY29udmVyc2F0aW9uLWxpc3RcIj5cclxuICAgICAgICA8bmctY29udGFpbmVyICpuZ0lmPVwiYWN0aXZlVGFiID09PSAndGlja2V0cydcIj5cclxuICAgICAgICAgIDxkaXZcclxuICAgICAgICAgICAgKm5nRm9yPVwibGV0IHRpY2tldCBvZiBteVRpY2tldHNcIlxyXG4gICAgICAgICAgICBjbGFzcz1cInRpY2tldC1pdGVtXCJcclxuICAgICAgICAgICAgW2NsYXNzLnVuc2Vlbl09XCIhdGlja2V0LmlzX3NlZW5cIlxyXG4gICAgICAgICAgPlxyXG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwidGlja2V0LWl0ZW0taGVhZGVyXCI+XHJcbiAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJ0aWNrZXQtcmVmXCI+e3sgdGlja2V0LnRpY2tldF9yZWYgfX08L3NwYW4+XHJcbiAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJ0aWNrZXQtc3RhdHVzXCIgW2F0dHIuZGF0YS1zdGF0dXNdPVwidGlja2V0LnRpY2tldF9zdGF0dXNcIj57eyB0aWNrZXQudGlja2V0X3N0YXR1cyB9fTwvc3Bhbj5cclxuICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0aWNrZXQtaXRlbS1ib2R5XCI+XHJcbiAgICAgICAgICAgICAgPHAgY2xhc3M9XCJ0aWNrZXQtdHlwZVwiPnt7IHRpY2tldC50eXBlIH19PG5nLWNvbnRhaW5lciAqbmdJZj1cInRpY2tldC50eXBlX2RldGFpbFwiPiDigJQge3sgdGlja2V0LnR5cGVfZGV0YWlsIH19PC9uZy1jb250YWluZXI+PC9wPlxyXG4gICAgICAgICAgICAgIDxwIGNsYXNzPVwidGlja2V0LW1ldGFcIiAqbmdJZj1cInRpY2tldC51c2VyX3JlcXVlc3RlZFwiPlJlcXVlc3RlZCBieSB7eyB0aWNrZXQudXNlcl9yZXF1ZXN0ZWQgfX08L3A+XHJcbiAgICAgICAgICAgICAgPHAgY2xhc3M9XCJ0aWNrZXQtbWV0YVwiICpuZ0lmPVwidGlja2V0LmNyZWF0ZWRfYXRcIj57eyBmb3JtYXRUaWNrZXREYXRlKHRpY2tldC5jcmVhdGVkX2F0KSB9fTwvcD5cclxuICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0aWNrZXQtaXRlbS1hY3Rpb25zXCI+XHJcbiAgICAgICAgICAgICAgPGJ1dHRvbiB0eXBlPVwiYnV0dG9uXCIgY2xhc3M9XCJ0aWNrZXQtYWN0aW9uLWJ0biB0aWNrZXQtYWN0aW9uLWJ0bi0tcHJpbWFyeVwiIChjbGljayk9XCJnb1RvVGlja2V0aW5nRGFzaGJvYXJkKClcIj5cclxuICAgICAgICAgICAgICAgIDxtYXQtaWNvbj5vcGVuX2luX25ldzwvbWF0LWljb24+XHJcbiAgICAgICAgICAgICAgICBUYWtlIG1lIHRoZXJlXHJcbiAgICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgICAgICAgdHlwZT1cImJ1dHRvblwiXHJcbiAgICAgICAgICAgICAgICBjbGFzcz1cInRpY2tldC1hY3Rpb24tYnRuXCJcclxuICAgICAgICAgICAgICAgICpuZ0lmPVwiIXRpY2tldC5pc19zZWVuXCJcclxuICAgICAgICAgICAgICAgIChjbGljayk9XCJtYXJrVGlja2V0UmVhZCh0aWNrZXQpXCJcclxuICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICA8bWF0LWljb24+ZG9uZTwvbWF0LWljb24+XHJcbiAgICAgICAgICAgICAgICBNYXJrIGFzIHJlYWRcclxuICAgICAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwidGlja2V0LXVuc2Vlbi1kb3RcIiAqbmdJZj1cIiF0aWNrZXQuaXNfc2VlblwiPjwvc3Bhbj5cclxuICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgIDwvbmctY29udGFpbmVyPlxyXG5cclxuICAgICAgICA8bmctY29udGFpbmVyICpuZ0lmPVwiYWN0aXZlVGFiID09PSAncHJvamVjdHMnICYmIHByb2plY3RHcm91cHNFbmFibGVkXCI+XHJcbiAgICAgICAgICA8ZGl2ICpuZ0Zvcj1cImxldCBwcm9qZWN0IG9mIHByb2plY3RDb250YWluZXJzXCIgY2xhc3M9XCJwcm9qZWN0LWNvbnRhaW5lclwiPlxyXG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwicHJvamVjdC1oZWFkZXJcIiAoY2xpY2spPVwidG9nZ2xlUHJvamVjdChwcm9qZWN0KVwiPlxyXG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJhdmF0YXIgcHJvamVjdC1hdmF0YXJcIj5cclxuICAgICAgICAgICAgICAgIDxtYXQtaWNvbj53b3Jrc3BhY2VzPC9tYXQtaWNvbj5cclxuICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiY29udmVyc2F0aW9uLWluZm9cIj5cclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJpbmZvLXRvcFwiPlxyXG4gICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cImNvbnYtbmFtZVwiPnt7IHByb2plY3QubmFtZSB8fCAnUHJvamVjdCBHcm91cCcgfX08L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgIDxidXR0b25cclxuICAgICAgICAgICAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcclxuICAgICAgICAgICAgICAgICAgICBjbGFzcz1cInN1Ymdyb3VwLWNyZWF0ZVwiXHJcbiAgICAgICAgICAgICAgICAgICAgKGNsaWNrKT1cImNyZWF0ZVN1Ymdyb3VwKHByb2plY3QsICRldmVudClcIlxyXG4gICAgICAgICAgICAgICAgICAgIG1hdFRvb2x0aXA9XCJDcmVhdGUgc3ViZ3JvdXBcIlxyXG4gICAgICAgICAgICAgICAgICAgIG1hdFRvb2x0aXBQb3NpdGlvbj1cImFib3ZlXCJcclxuICAgICAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgICAgIDxtYXQtaWNvbj5hZGQ8L21hdC1pY29uPlxyXG4gICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImluZm8tYm90dG9tXCI+XHJcbiAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwiY29udi1wcmV2aWV3XCI+e3sgcHJvamVjdFN1Ymdyb3Vwcyhwcm9qZWN0KS5sZW5ndGggfX0gc3ViZ3JvdXB7eyBwcm9qZWN0U3ViZ3JvdXBzKHByb2plY3QpLmxlbmd0aCA9PT0gMSA/ICcnIDogJ3MnIH19PC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICA8bWF0LWljb24gY2xhc3M9XCJleHBhbmQtaWNvblwiPnt7IGlzUHJvamVjdEV4cGFuZGVkKHByb2plY3QpID8gJ2V4cGFuZF9sZXNzJyA6ICdleHBhbmRfbW9yZScgfX08L21hdC1pY29uPlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgICAgPGRpdiAqbmdJZj1cImlzUHJvamVjdEV4cGFuZGVkKHByb2plY3QpXCIgY2xhc3M9XCJzdWJncm91cC1saXN0XCI+XHJcbiAgICAgICAgICAgICAgPGRpdlxyXG4gICAgICAgICAgICAgICAgKm5nRm9yPVwibGV0IGl0ZW0gb2YgcHJvamVjdFN1Ymdyb3Vwcyhwcm9qZWN0KVwiXHJcbiAgICAgICAgICAgICAgICBjbGFzcz1cImNvbnZlcnNhdGlvbi1pdGVtIHN1Ymdyb3VwLWl0ZW1cIlxyXG4gICAgICAgICAgICAgICAgbWF0UmlwcGxlXHJcbiAgICAgICAgICAgICAgICBbY2xhc3MuaGFzLXVucmVhZF09XCJpdGVtLnVucmVhZF9jb3VudCA+IDBcIlxyXG4gICAgICAgICAgICAgICAgKGNsaWNrKT1cIm9wZW5Db252ZXJzYXRpb24oaXRlbSlcIlxyXG4gICAgICAgICAgICAgICAgKGNvbnRleHRtZW51KT1cIm9uQ29udGV4dE1lbnUoJGV2ZW50LCBpdGVtKVwiXHJcbiAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImF2YXRhciBzdWJncm91cC1hdmF0YXJcIj5cclxuICAgICAgICAgICAgICAgICAgPG1hdC1pY29uPmZvcnVtPC9tYXQtaWNvbj5cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImNvbnZlcnNhdGlvbi1pbmZvXCI+XHJcbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJpbmZvLXRvcFwiPlxyXG4gICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwiY29udi1uYW1lXCI+e3sgaXRlbS5uYW1lIHx8ICdTdWJncm91cCcgfX08L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJjb252LXRpbWVcIj57eyBmb3JtYXRUaW1lKGl0ZW0ubGFzdF9tZXNzYWdlX2F0KSB9fTwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJpbmZvLWJvdHRvbVwiPlxyXG4gICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwiY29udi1wcmV2aWV3XCI+e3sgaXRlbS5zdWJncm91cF9zdWJqZWN0IHx8IGl0ZW0ubGFzdF9tZXNzYWdlX3ByZXZpZXcgfHwgJ05vIG1lc3NhZ2VzIHlldCcgfX08L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgPHNwYW4gKm5nSWY9XCJpdGVtLnVucmVhZF9jb3VudCA+IDBcIiBjbGFzcz1cInVucmVhZC1iYWRnZVwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAge3sgaXRlbS51bnJlYWRfY291bnQgPiA5OSA/ICc5OSsnIDogaXRlbS51bnJlYWRfY291bnQgfX1cclxuICAgICAgICAgICAgICAgICAgICA8L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgPGRpdiAqbmdJZj1cInByb2plY3RTdWJncm91cHMocHJvamVjdCkubGVuZ3RoID09PSAwXCIgY2xhc3M9XCJlbXB0eS1zdWJncm91cHNcIj5cclxuICAgICAgICAgICAgICAgIE5vIHN1Ymdyb3VwcyB5ZXRcclxuICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICA8L25nLWNvbnRhaW5lcj5cclxuXHJcbiAgICAgICAgPG5nLWNvbnRhaW5lciAqbmdJZj1cImFjdGl2ZVRhYiAhPT0gJ3RpY2tldHMnICYmIGFjdGl2ZVRhYiAhPT0gJ3NldHRpbmdzJyAmJiAhKGFjdGl2ZVRhYiA9PT0gJ3Byb2plY3RzJyAmJiBwcm9qZWN0R3JvdXBzRW5hYmxlZClcIj5cclxuICAgICAgICAgIDxkaXZcclxuICAgICAgICAgICAgKm5nRm9yPVwibGV0IGl0ZW0gb2YgZmlsdGVyZWRJbmJveFwiXHJcbiAgICAgICAgICAgIGNsYXNzPVwiY29udmVyc2F0aW9uLWl0ZW1cIlxyXG4gICAgICAgICAgICBtYXRSaXBwbGVcclxuICAgICAgICAgICAgW2NsYXNzLmhhcy11bnJlYWRdPVwiaXRlbS51bnJlYWRfY291bnQgPiAwXCJcclxuICAgICAgICAgICAgKGNsaWNrKT1cIm9wZW5Db252ZXJzYXRpb24oaXRlbSlcIlxyXG4gICAgICAgICAgICAoY29udGV4dG1lbnUpPVwib25Db250ZXh0TWVudSgkZXZlbnQsIGl0ZW0pXCJcclxuICAgICAgICAgID5cclxuICAgICAgICAgICAgPGRpdlxyXG4gICAgICAgICAgICAgIGNsYXNzPVwiYXZhdGFyXCJcclxuICAgICAgICAgICAgICBbY2xhc3MuZ3JvdXAtYXZhdGFyXT1cIml0ZW0uaXNfZ3JvdXAgJiYgIWlzUHJvamVjdChpdGVtKVwiXHJcbiAgICAgICAgICAgICAgW2NsYXNzLnByb2plY3QtYXZhdGFyXT1cImlzUHJvamVjdChpdGVtKVwiXHJcbiAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICA8bWF0LWljb24+e3sgaXNQcm9qZWN0KGl0ZW0pID8gJ2ZvcnVtJyA6IGl0ZW0uaXNfZ3JvdXAgPyAnZ3JvdXAnIDogJ3BlcnNvbicgfX08L21hdC1pY29uPlxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cImNvbnZlcnNhdGlvbi1pbmZvXCI+XHJcbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImluZm8tdG9wXCI+XHJcbiAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cImNvbnYtbmFtZVwiPnt7IGl0ZW0ubmFtZSB8fCAnRGlyZWN0IE1lc3NhZ2UnIH19PC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJjb252LXRpbWVcIj57eyBmb3JtYXRUaW1lKGl0ZW0ubGFzdF9tZXNzYWdlX2F0KSB9fTwvc3Bhbj5cclxuICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiaW5mby1ib3R0b21cIj5cclxuICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwiY29udi1wcmV2aWV3XCI+e3sgaXRlbS5zdWJncm91cF9zdWJqZWN0IHx8IGl0ZW0ubGFzdF9tZXNzYWdlX3ByZXZpZXcgfHwgJ05vIG1lc3NhZ2VzIHlldCcgfX08L3NwYW4+XHJcbiAgICAgICAgICAgICAgICA8c3BhblxyXG4gICAgICAgICAgICAgICAgICAqbmdJZj1cIml0ZW0uaGFzX21lbnRpb25cIlxyXG4gICAgICAgICAgICAgICAgICBjbGFzcz1cIm1lbnRpb24tYmFkZ2VcIlxyXG4gICAgICAgICAgICAgICAgICBtYXRUb29sdGlwPVwiWW91IHdlcmUgbWVudGlvbmVkXCJcclxuICAgICAgICAgICAgICAgICAgbWF0VG9vbHRpcFBvc2l0aW9uPVwiYWJvdmVcIlxyXG4gICAgICAgICAgICAgICAgPiYjNjQ7PC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgPHNwYW4gKm5nSWY9XCJpdGVtLnVucmVhZF9jb3VudCA+IDBcIiBjbGFzcz1cInVucmVhZC1iYWRnZVwiPlxyXG4gICAgICAgICAgICAgICAgICB7eyBpdGVtLnVucmVhZF9jb3VudCA+IDk5ID8gJzk5KycgOiBpdGVtLnVucmVhZF9jb3VudCB9fVxyXG4gICAgICAgICAgICAgICAgPC9zcGFuPlxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgIDwvbmctY29udGFpbmVyPlxyXG5cclxuICAgICAgICA8ZGl2ICpuZ0lmPVwic2hvd0VtcHR5U3RhdGVcIiBjbGFzcz1cImVtcHR5LXN0YXRlXCI+XHJcbiAgICAgICAgICA8bWF0LWljb24+e3sgZW1wdHlTdGF0ZUljb24gfX08L21hdC1pY29uPlxyXG4gICAgICAgICAgPHA+e3sgZW1wdHlTdGF0ZVRleHQgfX08L3A+XHJcbiAgICAgICAgICA8YnV0dG9uICpuZ0lmPVwiIXNlYXJjaFF1ZXJ5ICYmIGFjdGl2ZVRhYiAhPT0gJ2dyb3VwcycgJiYgYWN0aXZlVGFiICE9PSAncHJvamVjdHMnICYmIGFjdGl2ZVRhYiAhPT0gJ3RpY2tldHMnXCIgbWF0LXN0cm9rZWQtYnV0dG9uIGNvbG9yPVwicHJpbWFyeVwiIChjbGljayk9XCJvbk5ld0NvbnZlcnNhdGlvbigpXCI+XHJcbiAgICAgICAgICAgIFN0YXJ0IGEgY29udmVyc2F0aW9uXHJcbiAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgIDxidXR0b24gKm5nSWY9XCIhc2VhcmNoUXVlcnkgJiYgYWN0aXZlVGFiID09PSAnZ3JvdXBzJ1wiIG1hdC1zdHJva2VkLWJ1dHRvbiBjb2xvcj1cInByaW1hcnlcIiAoY2xpY2spPVwib25DcmVhdGVHcm91cCgpXCI+XHJcbiAgICAgICAgICAgIENyZWF0ZSBhIGdyb3VwXHJcbiAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgPGRpdiAqbmdJZj1cImFjdGl2ZVRhYiA9PT0gJ3NldHRpbmdzJ1wiIGNsYXNzPVwic2V0dGluZ3MtcGFuZWxcIj5cclxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJzZXR0aW5ncy1jYXJkXCI+XHJcbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJzZXR0aW5ncy1oZWFkZXJcIj5cclxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwic2V0dGluZ3MtaWNvblwiPlxyXG4gICAgICAgICAgICAgICAgPG1hdC1pY29uPnt7IG5vdGlmaWNhdGlvbnNNdXRlZCB8fCBub3RpZmljYXRpb25Wb2x1bWUgPD0gMCA/ICd2b2x1bWVfb2ZmJyA6ICd2b2x1bWVfdXAnIH19PC9tYXQtaWNvbj5cclxuICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICA8ZGl2PlxyXG4gICAgICAgICAgICAgICAgPGg0Pk5vdGlmaWNhdGlvbiBTb3VuZDwvaDQ+XHJcbiAgICAgICAgICAgICAgICA8cD5Db250cm9sIG1lc3NhZ2UgYWxlcnRzIGZvciB0aGlzIGJyb3dzZXIuPC9wPlxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgICAgIDxidXR0b25cclxuICAgICAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcclxuICAgICAgICAgICAgICBtYXQtc3Ryb2tlZC1idXR0b25cclxuICAgICAgICAgICAgICBjbGFzcz1cInNldHRpbmdzLXRvZ2dsZVwiXHJcbiAgICAgICAgICAgICAgKGNsaWNrKT1cInRvZ2dsZU5vdGlmaWNhdGlvbnNNdXRlZCgpXCJcclxuICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgIDxtYXQtaWNvbj57eyBub3RpZmljYXRpb25zTXV0ZWQgPyAndm9sdW1lX3VwJyA6ICd2b2x1bWVfb2ZmJyB9fTwvbWF0LWljb24+XHJcbiAgICAgICAgICAgICAge3sgbm90aWZpY2F0aW9uc011dGVkID8gJ1VubXV0ZSBub3RpZmljYXRpb25zJyA6ICdNdXRlIG5vdGlmaWNhdGlvbnMnIH19XHJcbiAgICAgICAgICAgIDwvYnV0dG9uPlxyXG5cclxuICAgICAgICAgICAgPGxhYmVsIGNsYXNzPVwidm9sdW1lLWxhYmVsXCIgZm9yPVwibWVzc2FnaW5nLXZvbHVtZS1zbGlkZXJcIj5cclxuICAgICAgICAgICAgICBWb2x1bWVcclxuICAgICAgICAgICAgICA8c3Bhbj57eyAobm90aWZpY2F0aW9uVm9sdW1lICogMTAwKSB8IG51bWJlcjonMS4wLTAnIH19JTwvc3Bhbj5cclxuICAgICAgICAgICAgPC9sYWJlbD5cclxuICAgICAgICAgICAgPGlucHV0XHJcbiAgICAgICAgICAgICAgaWQ9XCJtZXNzYWdpbmctdm9sdW1lLXNsaWRlclwiXHJcbiAgICAgICAgICAgICAgdHlwZT1cInJhbmdlXCJcclxuICAgICAgICAgICAgICBtaW49XCIwXCJcclxuICAgICAgICAgICAgICBtYXg9XCIxXCJcclxuICAgICAgICAgICAgICBzdGVwPVwiMC4wNVwiXHJcbiAgICAgICAgICAgICAgY2xhc3M9XCJzZXR0aW5ncy12b2x1bWVcIlxyXG4gICAgICAgICAgICAgIFsobmdNb2RlbCldPVwibm90aWZpY2F0aW9uVm9sdW1lXCJcclxuICAgICAgICAgICAgICAobmdNb2RlbENoYW5nZSk9XCJvbk5vdGlmaWNhdGlvblZvbHVtZUNoYW5nZSgkZXZlbnQpXCJcclxuICAgICAgICAgICAgICAoY2hhbmdlKT1cInByZXZpZXdOb3RpZmljYXRpb25Tb3VuZCgpXCJcclxuICAgICAgICAgICAgLz5cclxuICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJzZXR0aW5ncy1jYXJkXCI+XHJcbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJzZXR0aW5ncy1oZWFkZXJcIj5cclxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwic2V0dGluZ3MtaWNvbiBkaXNwbGF5LWljb25cIj5cclxuICAgICAgICAgICAgICAgIDxtYXQtaWNvbj50ZXh0X2ZpZWxkczwvbWF0LWljb24+XHJcbiAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgPGRpdj5cclxuICAgICAgICAgICAgICAgIDxoND5EaXNwbGF5IFNpemU8L2g0PlxyXG4gICAgICAgICAgICAgICAgPHA+QWRqdXN0IG1lc3NhZ2UgdGV4dCBhbmQgcHJvZ3JhbW1pbmcgYmxvY2sgc2l6ZXMuPC9wPlxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgICAgIDxsYWJlbCBjbGFzcz1cInZvbHVtZS1sYWJlbFwiIGZvcj1cIm1lc3NhZ2luZy1tZXNzYWdlLXNpemUtc2xpZGVyXCI+XHJcbiAgICAgICAgICAgICAgTWVzc2FnZSBzaXplXHJcbiAgICAgICAgICAgICAgPHNwYW4+e3sgKG1lc3NhZ2VUZXh0U2NhbGUgKiAxMDApIHwgbnVtYmVyOicxLjAtMCcgfX0lPC9zcGFuPlxyXG4gICAgICAgICAgICA8L2xhYmVsPlxyXG4gICAgICAgICAgICA8aW5wdXRcclxuICAgICAgICAgICAgICBpZD1cIm1lc3NhZ2luZy1tZXNzYWdlLXNpemUtc2xpZGVyXCJcclxuICAgICAgICAgICAgICB0eXBlPVwicmFuZ2VcIlxyXG4gICAgICAgICAgICAgIG1pbj1cIjAuOFwiXHJcbiAgICAgICAgICAgICAgbWF4PVwiMS41XCJcclxuICAgICAgICAgICAgICBzdGVwPVwiMC4wNVwiXHJcbiAgICAgICAgICAgICAgY2xhc3M9XCJzZXR0aW5ncy12b2x1bWVcIlxyXG4gICAgICAgICAgICAgIFsobmdNb2RlbCldPVwibWVzc2FnZVRleHRTY2FsZVwiXHJcbiAgICAgICAgICAgICAgKG5nTW9kZWxDaGFuZ2UpPVwib25NZXNzYWdlVGV4dFNjYWxlQ2hhbmdlKCRldmVudClcIlxyXG4gICAgICAgICAgICAvPlxyXG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwic2V0dGluZ3MtcHJldmlldyBtZXNzYWdlLXByZXZpZXdcIiBbc3R5bGUuZm9udC1zaXplLnB4XT1cIjEzICogbWVzc2FnZVRleHRTY2FsZVwiPlxyXG4gICAgICAgICAgICAgIFRoaXMgaXMgaG93IG5vcm1hbCBtZXNzYWdlIHRleHQgd2lsbCBhcHBlYXIgaW4gY2hhdC5cclxuICAgICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgICA8bGFiZWwgY2xhc3M9XCJ2b2x1bWUtbGFiZWxcIiBmb3I9XCJtZXNzYWdpbmctY29kZS1zaXplLXNsaWRlclwiPlxyXG4gICAgICAgICAgICAgIFByb2dyYW1taW5nIHNpemVcclxuICAgICAgICAgICAgICA8c3Bhbj57eyAoY29kZVRleHRTY2FsZSAqIDEwMCkgfCBudW1iZXI6JzEuMC0wJyB9fSU8L3NwYW4+XHJcbiAgICAgICAgICAgIDwvbGFiZWw+XHJcbiAgICAgICAgICAgIDxpbnB1dFxyXG4gICAgICAgICAgICAgIGlkPVwibWVzc2FnaW5nLWNvZGUtc2l6ZS1zbGlkZXJcIlxyXG4gICAgICAgICAgICAgIHR5cGU9XCJyYW5nZVwiXHJcbiAgICAgICAgICAgICAgbWluPVwiMC44XCJcclxuICAgICAgICAgICAgICBtYXg9XCIxLjVcIlxyXG4gICAgICAgICAgICAgIHN0ZXA9XCIwLjA1XCJcclxuICAgICAgICAgICAgICBjbGFzcz1cInNldHRpbmdzLXZvbHVtZVwiXHJcbiAgICAgICAgICAgICAgWyhuZ01vZGVsKV09XCJjb2RlVGV4dFNjYWxlXCJcclxuICAgICAgICAgICAgICAobmdNb2RlbENoYW5nZSk9XCJvbkNvZGVUZXh0U2NhbGVDaGFuZ2UoJGV2ZW50KVwiXHJcbiAgICAgICAgICAgIC8+XHJcbiAgICAgICAgICAgIDxwcmUgY2xhc3M9XCJzZXR0aW5ncy1wcmV2aWV3IGNvZGUtcHJldmlld1wiIFtzdHlsZS5mb250LXNpemUucHhdPVwiMTIgKiBjb2RlVGV4dFNjYWxlXCI+PGNvZGU+U0VMRUNUIHRpY2tldF9yZWYsIHN0YXR1c1xyXG5GUk9NIGxvZ2dpbmcudGlja2V0XHJcbldIRVJFIHN0YXR1cyA9ICdPcGVuJzs8L2NvZGU+PC9wcmU+XHJcbiAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICA8L2Rpdj5cclxuICAgICAgPC9kaXY+XHJcblxyXG4gICAgICA8ZGl2IGNsYXNzPVwiaW5ib3gtdGFic1wiIHJvbGU9XCJ0YWJsaXN0XCIgYXJpYS1sYWJlbD1cIkNvbnZlcnNhdGlvbiBmaWx0ZXJzXCIgW3N0eWxlLi0tdGFiLWNvdW50XT1cInZpc2libGVUYWJDb3VudFwiPlxyXG4gICAgICAgIDxidXR0b25cclxuICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxyXG4gICAgICAgICAgY2xhc3M9XCJpbmJveC10YWJcIlxyXG4gICAgICAgICAgW2NsYXNzLmFjdGl2ZV09XCJhY3RpdmVUYWIgPT09ICdhbGwnXCJcclxuICAgICAgICAgIChjbGljayk9XCJzZXRBY3RpdmVUYWIoJ2FsbCcpXCJcclxuICAgICAgICAgIG1hdFRvb2x0aXA9XCJBbGxcIlxyXG4gICAgICAgICAgbWF0VG9vbHRpcFBvc2l0aW9uPVwiYWJvdmVcIlxyXG4gICAgICAgID5cclxuICAgICAgICAgIDxtYXQtaWNvbj5mb3J1bTwvbWF0LWljb24+XHJcbiAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgdHlwZT1cImJ1dHRvblwiXHJcbiAgICAgICAgICBjbGFzcz1cImluYm94LXRhYlwiXHJcbiAgICAgICAgICBbY2xhc3MuYWN0aXZlXT1cImFjdGl2ZVRhYiA9PT0gJ2RpcmVjdCdcIlxyXG4gICAgICAgICAgKGNsaWNrKT1cInNldEFjdGl2ZVRhYignZGlyZWN0JylcIlxyXG4gICAgICAgICAgbWF0VG9vbHRpcD1cIkNoYXRzXCJcclxuICAgICAgICAgIG1hdFRvb2x0aXBQb3NpdGlvbj1cImFib3ZlXCJcclxuICAgICAgICA+XHJcbiAgICAgICAgICA8bWF0LWljb24+Y2hhdDwvbWF0LWljb24+XHJcbiAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgdHlwZT1cImJ1dHRvblwiXHJcbiAgICAgICAgICBjbGFzcz1cImluYm94LXRhYlwiXHJcbiAgICAgICAgICBbY2xhc3MuYWN0aXZlXT1cImFjdGl2ZVRhYiA9PT0gJ2dyb3VwcydcIlxyXG4gICAgICAgICAgKGNsaWNrKT1cInNldEFjdGl2ZVRhYignZ3JvdXBzJylcIlxyXG4gICAgICAgICAgbWF0VG9vbHRpcD1cIkdyb3Vwc1wiXHJcbiAgICAgICAgICBtYXRUb29sdGlwUG9zaXRpb249XCJhYm92ZVwiXHJcbiAgICAgICAgPlxyXG4gICAgICAgICAgPG1hdC1pY29uPmdyb3VwczwvbWF0LWljb24+XHJcbiAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgKm5nSWY9XCJwcm9qZWN0R3JvdXBzRW5hYmxlZFwiXHJcbiAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcclxuICAgICAgICAgIGNsYXNzPVwiaW5ib3gtdGFiXCJcclxuICAgICAgICAgIFtjbGFzcy5hY3RpdmVdPVwiYWN0aXZlVGFiID09PSAncHJvamVjdHMnXCJcclxuICAgICAgICAgIChjbGljayk9XCJzZXRBY3RpdmVUYWIoJ3Byb2plY3RzJylcIlxyXG4gICAgICAgICAgbWF0VG9vbHRpcD1cIlByb2plY3RzXCJcclxuICAgICAgICAgIG1hdFRvb2x0aXBQb3NpdGlvbj1cImFib3ZlXCJcclxuICAgICAgICA+XHJcbiAgICAgICAgICA8bWF0LWljb24+d29ya3NwYWNlczwvbWF0LWljb24+XHJcbiAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgKm5nSWY9XCJ0aWNrZXRzVGFiVmlzaWJsZVwiXHJcbiAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcclxuICAgICAgICAgIGNsYXNzPVwiaW5ib3gtdGFiIGluYm94LXRhYi0tdGlja2V0c1wiXHJcbiAgICAgICAgICBbY2xhc3MuYWN0aXZlXT1cImFjdGl2ZVRhYiA9PT0gJ3RpY2tldHMnXCJcclxuICAgICAgICAgIChjbGljayk9XCJzZXRBY3RpdmVUYWIoJ3RpY2tldHMnKVwiXHJcbiAgICAgICAgICBtYXRUb29sdGlwPVwiVGlja2V0c1wiXHJcbiAgICAgICAgICBtYXRUb29sdGlwUG9zaXRpb249XCJhYm92ZVwiXHJcbiAgICAgICAgPlxyXG4gICAgICAgICAgPG1hdC1pY29uPmNvbmZpcm1hdGlvbl9udW1iZXI8L21hdC1pY29uPlxyXG4gICAgICAgICAgPHNwYW4gKm5nSWY9XCJ0aWNrZXRVbnNlZW5Db3VudCA+IDBcIiBjbGFzcz1cInRhYi1iYWRnZVwiPnt7IHRpY2tldFVuc2VlbkNvdW50ID4gOSA/ICc5KycgOiB0aWNrZXRVbnNlZW5Db3VudCB9fTwvc3Bhbj5cclxuICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICA8YnV0dG9uXHJcbiAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcclxuICAgICAgICAgIGNsYXNzPVwiaW5ib3gtdGFiXCJcclxuICAgICAgICAgIFtjbGFzcy5hY3RpdmVdPVwiYWN0aXZlVGFiID09PSAnc2V0dGluZ3MnXCJcclxuICAgICAgICAgIChjbGljayk9XCJzZXRBY3RpdmVUYWIoJ3NldHRpbmdzJylcIlxyXG4gICAgICAgICAgbWF0VG9vbHRpcD1cIlNldHRpbmdzXCJcclxuICAgICAgICAgIG1hdFRvb2x0aXBQb3NpdGlvbj1cImFib3ZlXCJcclxuICAgICAgICA+XHJcbiAgICAgICAgICA8bWF0LWljb24+c2V0dGluZ3M8L21hdC1pY29uPlxyXG4gICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICA8L2Rpdj5cclxuXHJcbiAgICAgIDwhLS0gQ29udGV4dCBNZW51IC0tPlxyXG4gICAgICA8ZGl2XHJcbiAgICAgICAgKm5nSWY9XCJjb250ZXh0TWVudVwiXHJcbiAgICAgICAgY2xhc3M9XCJjb250ZXh0LW1lbnVcIlxyXG4gICAgICAgIFtzdHlsZS50b3AucHhdPVwiY29udGV4dE1lbnUueVwiXHJcbiAgICAgICAgW3N0eWxlLmxlZnQucHhdPVwiY29udGV4dE1lbnUueFwiXHJcbiAgICAgID5cclxuICAgICAgICA8ZGl2IGNsYXNzPVwiY3R4LWl0ZW1cIiAoY2xpY2spPVwiY2xlYXJDaGF0KClcIj5cclxuICAgICAgICAgIDxtYXQtaWNvbj5jbGVhbmluZ19zZXJ2aWNlczwvbWF0LWljb24+XHJcbiAgICAgICAgICA8c3Bhbj5DbGVhciBjb252ZXJzYXRpb248L3NwYW4+XHJcbiAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgPGRpdiBjbGFzcz1cImN0eC1pdGVtIGN0eC1kYW5nZXJcIiAoY2xpY2spPVwiZGVsZXRlQ2hhdCgpXCI+XHJcbiAgICAgICAgICA8bWF0LWljb24+e3sgY29udGV4dE1lbnUuaXRlbS5pc19ncm91cCA/ICdsb2dvdXQnIDogJ2RlbGV0ZScgfX08L21hdC1pY29uPlxyXG4gICAgICAgICAgPHNwYW4+e3sgY29udGV4dE1lbnUuaXRlbS5pc19ncm91cCA/ICdFeGl0IGdyb3VwJyA6ICdEZWxldGUgY29udmVyc2F0aW9uJyB9fTwvc3Bhbj5cclxuICAgICAgICA8L2Rpdj5cclxuICAgICAgPC9kaXY+XHJcbiAgICAgIDxkaXYgKm5nSWY9XCJjb250ZXh0TWVudVwiIGNsYXNzPVwiY3R4LWJhY2tkcm9wXCIgKGNsaWNrKT1cImNsb3NlQ29udGV4dE1lbnUoKVwiPjwvZGl2PlxyXG4gICAgPC9kaXY+XHJcbiAgYCxcclxuICBzdHlsZXM6IFtgXHJcbiAgICAuaW5ib3gtY29udGFpbmVyIHtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcclxuICAgICAgaGVpZ2h0OiAxMDAlO1xyXG4gICAgICBiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudDtcclxuICAgICAgY29udGFpbmVyLXR5cGU6IGlubGluZS1zaXplO1xyXG4gICAgfVxyXG5cclxuICAgIC5zZWFyY2gtYmFyIHtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAgbWFyZ2luOiA4cHggMTZweDtcclxuICAgICAgcGFkZGluZzogOHB4IDEycHg7XHJcbiAgICAgIGJhY2tncm91bmQ6IHRyYW5zcGFyZW50O1xyXG4gICAgICBib3JkZXItcmFkaXVzOiAxMHB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5zZWFyY2gtaWNvbiB7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNyk7XHJcbiAgICAgIGZvbnQtc2l6ZTogMThweDtcclxuICAgICAgd2lkdGg6IDIwcHg7XHJcbiAgICAgIGhlaWdodDogMjBweDtcclxuICAgICAgbWFyZ2luLXJpZ2h0OiA4cHg7XHJcbiAgICB9XHJcblxyXG4gICAgLnNlYXJjaC1pbnB1dCB7XHJcbiAgICAgIGZsZXg6IDE7XHJcbiAgICAgIGJvcmRlcjogbm9uZTtcclxuICAgICAgb3V0bGluZTogbm9uZTtcclxuICAgICAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQ7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTRweDtcclxuICAgICAgY29sb3I6ICNmZmY7XHJcbiAgICB9XHJcblxyXG4gICAgLnNlYXJjaC1pbnB1dDo6cGxhY2Vob2xkZXIge1xyXG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjYpO1xyXG4gICAgfVxyXG5cclxuICAgIC5pbmJveC10YWJzIHtcclxuICAgICAgZGlzcGxheTogZ3JpZDtcclxuICAgICAgZ3JpZC10ZW1wbGF0ZS1jb2x1bW5zOiByZXBlYXQodmFyKC0tdGFiLWNvdW50LCA1KSwgbWlubWF4KDAsIDFmcikpO1xyXG4gICAgICBnYXA6IDVweDtcclxuICAgICAgcGFkZGluZzogMTBweCAxNnB4IDEycHg7XHJcbiAgICAgIGJvcmRlci10b3A6IDFweCBzb2xpZCByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMSk7XHJcbiAgICAgIGZsZXgtc2hyaW5rOiAwO1xyXG4gICAgfVxyXG5cclxuICAgIC5pbmJveC10YWItLXRpY2tldHMge1xyXG4gICAgICBwb3NpdGlvbjogcmVsYXRpdmU7XHJcbiAgICB9XHJcblxyXG4gICAgLnRhYi1iYWRnZSB7XHJcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcclxuICAgICAgdG9wOiAwO1xyXG4gICAgICByaWdodDogMnB4O1xyXG4gICAgICBtaW4td2lkdGg6IDE0cHg7XHJcbiAgICAgIGhlaWdodDogMTRweDtcclxuICAgICAgcGFkZGluZzogMCAzcHg7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDdweDtcclxuICAgICAgYmFja2dyb3VuZDogI2VmNDQ0NDtcclxuICAgICAgY29sb3I6ICNmZmY7XHJcbiAgICAgIGZvbnQtc2l6ZTogOXB4O1xyXG4gICAgICBmb250LXdlaWdodDogNzAwO1xyXG4gICAgICBsaW5lLWhlaWdodDogMTRweDtcclxuICAgICAgdGV4dC1hbGlnbjogY2VudGVyO1xyXG4gICAgfVxyXG5cclxuICAgIC50aWNrZXQtaXRlbSB7XHJcbiAgICAgIHBvc2l0aW9uOiByZWxhdGl2ZTtcclxuICAgICAgbWFyZ2luOiA4cHggMTJweDtcclxuICAgICAgcGFkZGluZzogMTJweDtcclxuICAgICAgYm9yZGVyLXJhZGl1czogMTBweDtcclxuICAgICAgYm9yZGVyOiAxcHggc29saWQgcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjEyKTtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjA0KTtcclxuICAgIH1cclxuXHJcbiAgICAudGlja2V0LWl0ZW0udW5zZWVuIHtcclxuICAgICAgYm9yZGVyLWNvbG9yOiByZ2JhKDEyNywgMTgwLCAyNTUsIDAuNDUpO1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI2LCA5NSwgMTY4LCAwLjE4KTtcclxuICAgIH1cclxuXHJcbiAgICAudGlja2V0LWl0ZW0taGVhZGVyIHtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAganVzdGlmeS1jb250ZW50OiBzcGFjZS1iZXR3ZWVuO1xyXG4gICAgICBnYXA6IDhweDtcclxuICAgICAgbWFyZ2luLWJvdHRvbTogNnB4O1xyXG4gICAgfVxyXG5cclxuICAgIC50aWNrZXQtcmVmIHtcclxuICAgICAgZm9udC13ZWlnaHQ6IDcwMDtcclxuICAgICAgZm9udC1zaXplOiAxM3B4O1xyXG4gICAgICBjb2xvcjogI2ZmZjtcclxuICAgIH1cclxuXHJcbiAgICAudGlja2V0LXN0YXR1cyB7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTBweDtcclxuICAgICAgZm9udC13ZWlnaHQ6IDYwMDtcclxuICAgICAgdGV4dC10cmFuc2Zvcm06IHVwcGVyY2FzZTtcclxuICAgICAgbGV0dGVyLXNwYWNpbmc6IDAuMDNlbTtcclxuICAgICAgcGFkZGluZzogMnB4IDZweDtcclxuICAgICAgYm9yZGVyLXJhZGl1czogNHB4O1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMTIpO1xyXG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjg1KTtcclxuICAgICAgd2hpdGUtc3BhY2U6IG5vd3JhcDtcclxuICAgIH1cclxuXHJcbiAgICAudGlja2V0LWl0ZW0tYm9keSB7XHJcbiAgICAgIG1hcmdpbi1ib3R0b206IDEwcHg7XHJcbiAgICB9XHJcblxyXG4gICAgLnRpY2tldC10eXBlIHtcclxuICAgICAgbWFyZ2luOiAwIDAgNHB4O1xyXG4gICAgICBmb250LXNpemU6IDEycHg7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuOSk7XHJcbiAgICB9XHJcblxyXG4gICAgLnRpY2tldC1tZXRhIHtcclxuICAgICAgbWFyZ2luOiAwO1xyXG4gICAgICBmb250LXNpemU6IDExcHg7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNjUpO1xyXG4gICAgfVxyXG5cclxuICAgIC50aWNrZXQtaXRlbS1hY3Rpb25zIHtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgZmxleC13cmFwOiB3cmFwO1xyXG4gICAgICBnYXA6IDZweDtcclxuICAgIH1cclxuXHJcbiAgICAudGlja2V0LWFjdGlvbi1idG4ge1xyXG4gICAgICBkaXNwbGF5OiBpbmxpbmUtZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAgZ2FwOiA0cHg7XHJcbiAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4yKTtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjA4KTtcclxuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC45KTtcclxuICAgICAgYm9yZGVyLXJhZGl1czogNnB4O1xyXG4gICAgICBwYWRkaW5nOiA1cHggOHB4O1xyXG4gICAgICBmb250LXNpemU6IDExcHg7XHJcbiAgICAgIGZvbnQtd2VpZ2h0OiA2MDA7XHJcbiAgICAgIGN1cnNvcjogcG9pbnRlcjtcclxuICAgIH1cclxuXHJcbiAgICAudGlja2V0LWFjdGlvbi1idG4gbWF0LWljb24ge1xyXG4gICAgICBmb250LXNpemU6IDE0cHg7XHJcbiAgICAgIHdpZHRoOiAxNHB4O1xyXG4gICAgICBoZWlnaHQ6IDE0cHg7XHJcbiAgICB9XHJcblxyXG4gICAgLnRpY2tldC1hY3Rpb24tYnRuLS1wcmltYXJ5IHtcclxuICAgICAgYm9yZGVyLWNvbG9yOiByZ2JhKDEyNywgMTgwLCAyNTUsIDAuNSk7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjYsIDk1LCAxNjgsIDAuMzUpO1xyXG4gICAgICBjb2xvcjogI2ZmZjtcclxuICAgIH1cclxuXHJcbiAgICAudGlja2V0LWFjdGlvbi1idG46aG92ZXIge1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMTQpO1xyXG4gICAgfVxyXG5cclxuICAgIC50aWNrZXQtdW5zZWVuLWRvdCB7XHJcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcclxuICAgICAgdG9wOiAxMHB4O1xyXG4gICAgICBsZWZ0OiA2cHg7XHJcbiAgICAgIHdpZHRoOiA2cHg7XHJcbiAgICAgIGhlaWdodDogNnB4O1xyXG4gICAgICBib3JkZXItcmFkaXVzOiA1MCU7XHJcbiAgICAgIGJhY2tncm91bmQ6ICM2MGE1ZmE7XHJcbiAgICB9XHJcblxyXG4gICAgLmluYm94LXRhYiB7XHJcbiAgICAgIG1pbi13aWR0aDogMDtcclxuICAgICAgYm9yZGVyOiAxcHggc29saWQgcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjE0KTtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjA2KTtcclxuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC43Mik7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDk5OXB4O1xyXG4gICAgICBwYWRkaW5nOiA2cHggNHB4O1xyXG4gICAgICBmb250LXdlaWdodDogNjAwO1xyXG4gICAgICBjdXJzb3I6IHBvaW50ZXI7XHJcbiAgICAgIGRpc3BsYXk6IGlubGluZS1mbGV4O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcclxuICAgICAgdHJhbnNpdGlvbjogYmFja2dyb3VuZCAwLjE1cywgYm9yZGVyLWNvbG9yIDAuMTVzLCBjb2xvciAwLjE1cztcclxuICAgIH1cclxuXHJcbiAgICAuaW5ib3gtdGFiIG1hdC1pY29uIHtcclxuICAgICAgZm9udC1zaXplOiBjbGFtcCgxN3B4LCA2Y3F3LCAyMXB4KTtcclxuICAgICAgd2lkdGg6IGNsYW1wKDE3cHgsIDZjcXcsIDIxcHgpO1xyXG4gICAgICBoZWlnaHQ6IGNsYW1wKDE3cHgsIDZjcXcsIDIxcHgpO1xyXG4gICAgICBsaW5lLWhlaWdodDogY2xhbXAoMTdweCwgNmNxdywgMjFweCk7XHJcbiAgICB9XHJcblxyXG4gICAgLmluYm94LXRhYjpob3ZlciB7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xMik7XHJcbiAgICAgIGNvbG9yOiAjZmZmO1xyXG4gICAgfVxyXG5cclxuICAgIC5pbmJveC10YWIuYWN0aXZlIHtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNiwgOTUsIDE2OCwgMC4zNSk7XHJcbiAgICAgIGJvcmRlci1jb2xvcjogcmdiYSgxMjcsIDE4MCwgMjU1LCAwLjQ1KTtcclxuICAgICAgY29sb3I6ICNmZmY7XHJcbiAgICB9XHJcblxyXG4gICAgQGNvbnRhaW5lciAobWF4LXdpZHRoOiAzMzBweCkge1xyXG4gICAgICAuaW5ib3gtdGFicyB7XHJcbiAgICAgICAgZ2FwOiAzcHg7XHJcbiAgICAgICAgcGFkZGluZzogOHB4IDhweCAxMHB4O1xyXG4gICAgICB9XHJcblxyXG4gICAgICAuaW5ib3gtdGFiIHtcclxuICAgICAgICBwYWRkaW5nOiA2cHggMnB4O1xyXG4gICAgICAgIGxldHRlci1zcGFjaW5nOiAtMC4ycHg7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBAY29udGFpbmVyIChtYXgtd2lkdGg6IDI4MHB4KSB7XHJcbiAgICAgIC5pbmJveC10YWJzIHtcclxuICAgICAgICBnYXA6IDJweDtcclxuICAgICAgICBwYWRkaW5nLWxlZnQ6IDZweDtcclxuICAgICAgICBwYWRkaW5nLXJpZ2h0OiA2cHg7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIC5pbmJveC10YWIge1xyXG4gICAgICAgIGZvbnQtc2l6ZTogOC41cHg7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAuY29udmVyc2F0aW9uLWxpc3Qge1xyXG4gICAgICBmbGV4OiAxO1xyXG4gICAgICBvdmVyZmxvdy15OiBhdXRvO1xyXG4gICAgICBzY3JvbGxiYXItd2lkdGg6IG5vbmU7XHJcbiAgICAgIC1tcy1vdmVyZmxvdy1zdHlsZTogbm9uZTtcclxuICAgIH1cclxuXHJcbiAgICAuY29udmVyc2F0aW9uLWxpc3Q6Oi13ZWJraXQtc2Nyb2xsYmFyIHtcclxuICAgICAgZGlzcGxheTogbm9uZTtcclxuICAgIH1cclxuXHJcbiAgICAuY29udmVyc2F0aW9uLWl0ZW0ge1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBwYWRkaW5nOiAxMnB4IDE2cHg7XHJcbiAgICAgIGN1cnNvcjogcG9pbnRlcjtcclxuICAgICAgdHJhbnNpdGlvbjogYmFja2dyb3VuZCAwLjE1cztcclxuICAgICAgZ2FwOiAxMnB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5jb252ZXJzYXRpb24taXRlbTpob3ZlciB7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xKTtcclxuICAgIH1cclxuXHJcbiAgICAuY29udmVyc2F0aW9uLWl0ZW0uaGFzLXVucmVhZCB7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xNSk7XHJcbiAgICB9XHJcblxyXG4gICAgLmF2YXRhciB7XHJcbiAgICAgIHdpZHRoOiA0OHB4O1xyXG4gICAgICBoZWlnaHQ6IDQ4cHg7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDUwJTtcclxuICAgICAgYmFja2dyb3VuZDogIzBkMjU0MDtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XHJcbiAgICAgIGZsZXgtc2hyaW5rOiAwO1xyXG4gICAgfVxyXG5cclxuICAgIC5hdmF0YXIgbWF0LWljb24ge1xyXG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjcpO1xyXG4gICAgICBmb250LXNpemU6IDI0cHg7XHJcbiAgICB9XHJcblxyXG4gICAgLmdyb3VwLWF2YXRhciB7XHJcbiAgICAgIGJhY2tncm91bmQ6ICMwYTFmMzg7XHJcbiAgICB9XHJcblxyXG4gICAgLmdyb3VwLWF2YXRhciBtYXQtaWNvbiB7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNyk7XHJcbiAgICB9XHJcblxyXG4gICAgLnByb2plY3QtYXZhdGFyIHtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgzNywgOTksIDIzNSwgMC4yKTtcclxuICAgIH1cclxuXHJcbiAgICAucHJvamVjdC1hdmF0YXIgbWF0LWljb24ge1xyXG4gICAgICBjb2xvcjogI2JmZGJmZTtcclxuICAgIH1cclxuXHJcbiAgICAucHJvamVjdC1jb250YWluZXIge1xyXG4gICAgICBib3JkZXItYm90dG9tOiAxcHggc29saWQgcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjA2KTtcclxuICAgIH1cclxuXHJcbiAgICAucHJvamVjdC1oZWFkZXIge1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBwYWRkaW5nOiAxMnB4IDE2cHg7XHJcbiAgICAgIGN1cnNvcjogcG9pbnRlcjtcclxuICAgICAgZ2FwOiAxMnB4O1xyXG4gICAgICB0cmFuc2l0aW9uOiBiYWNrZ3JvdW5kIDAuMTVzO1xyXG4gICAgfVxyXG5cclxuICAgIC5wcm9qZWN0LWhlYWRlcjpob3ZlciB7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4wOCk7XHJcbiAgICB9XHJcblxyXG4gICAgLnN1Ymdyb3VwLWNyZWF0ZSB7XHJcbiAgICAgIHdpZHRoOiAyOHB4O1xyXG4gICAgICBoZWlnaHQ6IDI4cHg7XHJcbiAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHJnYmEoMTkxLCAyMTksIDI1NCwgMC4zNSk7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDk5OXB4O1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDM3LCA5OSwgMjM1LCAwLjE4KTtcclxuICAgICAgY29sb3I6ICNiZmRiZmU7XHJcbiAgICAgIGRpc3BsYXk6IGlubGluZS1mbGV4O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcclxuICAgICAgY3Vyc29yOiBwb2ludGVyO1xyXG4gICAgICBmbGV4LXNocmluazogMDtcclxuICAgIH1cclxuXHJcbiAgICAuc3ViZ3JvdXAtY3JlYXRlIG1hdC1pY29uIHtcclxuICAgICAgZm9udC1zaXplOiAxOHB4O1xyXG4gICAgICB3aWR0aDogMThweDtcclxuICAgICAgaGVpZ2h0OiAxOHB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5leHBhbmQtaWNvbiB7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNik7XHJcbiAgICAgIGZvbnQtc2l6ZTogMjBweDtcclxuICAgICAgd2lkdGg6IDIwcHg7XHJcbiAgICAgIGhlaWdodDogMjBweDtcclxuICAgICAgZmxleC1zaHJpbms6IDA7XHJcbiAgICB9XHJcblxyXG4gICAgLnN1Ymdyb3VwLWxpc3Qge1xyXG4gICAgICBwYWRkaW5nLWJvdHRvbTogNnB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5zdWJncm91cC1pdGVtIHtcclxuICAgICAgcGFkZGluZy1sZWZ0OiAzMnB4O1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMDI1KTtcclxuICAgIH1cclxuXHJcbiAgICAuc3ViZ3JvdXAtYXZhdGFyIHtcclxuICAgICAgd2lkdGg6IDM4cHg7XHJcbiAgICAgIGhlaWdodDogMzhweDtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSg1OSwgMTMwLCAyNDYsIDAuMTQpO1xyXG4gICAgfVxyXG5cclxuICAgIC5zdWJncm91cC1hdmF0YXIgbWF0LWljb24ge1xyXG4gICAgICBjb2xvcjogI2RiZWFmZTtcclxuICAgICAgZm9udC1zaXplOiAyMXB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5lbXB0eS1zdWJncm91cHMge1xyXG4gICAgICBwYWRkaW5nOiA4cHggMTZweCAxMnB4IDkycHg7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNTUpO1xyXG4gICAgICBmb250LXNpemU6IDEycHg7XHJcbiAgICB9XHJcblxyXG4gICAgLmNvbnZlcnNhdGlvbi1pbmZvIHtcclxuICAgICAgZmxleDogMTtcclxuICAgICAgbWluLXdpZHRoOiAwO1xyXG4gICAgfVxyXG5cclxuICAgIC5pbmZvLXRvcCB7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGp1c3RpZnktY29udGVudDogc3BhY2UtYmV0d2VlbjtcclxuICAgICAgYWxpZ24taXRlbXM6IGJhc2VsaW5lO1xyXG4gICAgICBtYXJnaW4tYm90dG9tOiAycHg7XHJcbiAgICB9XHJcblxyXG4gICAgLmNvbnYtbmFtZSB7XHJcbiAgICAgIGZvbnQtd2VpZ2h0OiA2MDA7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTRweDtcclxuICAgICAgY29sb3I6ICNmZmY7XHJcbiAgICAgIHdoaXRlLXNwYWNlOiBub3dyYXA7XHJcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XHJcbiAgICAgIHRleHQtb3ZlcmZsb3c6IGVsbGlwc2lzO1xyXG4gICAgICBtYXgtd2lkdGg6IDIwMHB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5jb252LXRpbWUge1xyXG4gICAgICBmb250LXNpemU6IDExcHg7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNyk7XHJcbiAgICAgIGZsZXgtc2hyaW5rOiAwO1xyXG4gICAgICBtYXJnaW4tbGVmdDogOHB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5pbmZvLWJvdHRvbSB7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGp1c3RpZnktY29udGVudDogc3BhY2UtYmV0d2VlbjtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAgZ2FwOiA2cHg7XHJcbiAgICB9XHJcblxyXG4gICAgLmNvbnYtcHJldmlldyB7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTNweDtcclxuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC43KTtcclxuICAgICAgd2hpdGUtc3BhY2U6IG5vd3JhcDtcclxuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcclxuICAgICAgdGV4dC1vdmVyZmxvdzogZWxsaXBzaXM7XHJcbiAgICAgIG1heC13aWR0aDogMjIwcHg7XHJcbiAgICB9XHJcblxyXG4gICAgLmhhcy11bnJlYWQgLmNvbnYtbmFtZSB7XHJcbiAgICAgIGNvbG9yOiAjZmZmO1xyXG4gICAgfVxyXG5cclxuICAgIC5oYXMtdW5yZWFkIC5jb252LXByZXZpZXcge1xyXG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjkpO1xyXG4gICAgICBmb250LXdlaWdodDogNTAwO1xyXG4gICAgfVxyXG5cclxuICAgIC51bnJlYWQtYmFkZ2Uge1xyXG4gICAgICBiYWNrZ3JvdW5kOiAjMWE1ZmE4O1xyXG4gICAgICBjb2xvcjogI2ZmZjtcclxuICAgICAgYm9yZGVyLXJhZGl1czogMTBweDtcclxuICAgICAgbWluLXdpZHRoOiAyMHB4O1xyXG4gICAgICBoZWlnaHQ6IDIwcHg7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTFweDtcclxuICAgICAgZm9udC13ZWlnaHQ6IDYwMDtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XHJcbiAgICAgIHBhZGRpbmc6IDAgNnB4O1xyXG4gICAgICBmbGV4LXNocmluazogMDtcclxuICAgIH1cclxuXHJcbiAgICAubWVudGlvbi1iYWRnZSB7XHJcbiAgICAgIHdpZHRoOiAyMHB4O1xyXG4gICAgICBoZWlnaHQ6IDIwcHg7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDk5OXB4O1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDEyNywgMTgwLCAyNTUsIDAuMik7XHJcbiAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHJnYmEoMTI3LCAxODAsIDI1NSwgMC41NSk7XHJcbiAgICAgIGNvbG9yOiAjYmZkYmZlO1xyXG4gICAgICBkaXNwbGF5OiBpbmxpbmUtZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTJweDtcclxuICAgICAgZm9udC13ZWlnaHQ6IDgwMDtcclxuICAgICAgZmxleC1zaHJpbms6IDA7XHJcbiAgICAgIG1hcmdpbi1sZWZ0OiA2cHg7XHJcbiAgICAgIGJveC1zaGFkb3c6IDAgMCAwIDJweCByZ2JhKDEyNywgMTgwLCAyNTUsIDAuMDYpO1xyXG4gICAgfVxyXG5cclxuICAgIC5lbXB0eS1zdGF0ZSB7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xyXG4gICAgICBwYWRkaW5nOiA0OHB4IDI0cHg7XHJcbiAgICAgIGNvbG9yOiAjOWNhM2FmO1xyXG4gICAgfVxyXG5cclxuICAgIC5lbXB0eS1zdGF0ZSBtYXQtaWNvbiB7XHJcbiAgICAgIGZvbnQtc2l6ZTogNDhweDtcclxuICAgICAgd2lkdGg6IDQ4cHg7XHJcbiAgICAgIGhlaWdodDogNDhweDtcclxuICAgICAgbWFyZ2luLWJvdHRvbTogMTJweDtcclxuICAgIH1cclxuXHJcbiAgICAuZW1wdHktc3RhdGUgcCB7XHJcbiAgICAgIG1hcmdpbjogMCAwIDE2cHg7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTRweDtcclxuICAgIH1cclxuXHJcbiAgICAuc2V0dGluZ3MtcGFuZWwge1xyXG4gICAgICBwYWRkaW5nOiAxNnB4O1xyXG4gICAgICBjb2xvcjogI2ZmZjtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcclxuICAgICAgZ2FwOiAxMnB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5zZXR0aW5ncy1jYXJkIHtcclxuICAgICAgYm9yZGVyLXJhZGl1czogMTRweDtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjA3KTtcclxuICAgICAgYm9yZGVyOiAxcHggc29saWQgcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjEyKTtcclxuICAgICAgcGFkZGluZzogMTZweDtcclxuICAgICAgYm94LXNoYWRvdzogMCAxMHB4IDI4cHggcmdiYSgwLCAwLCAwLCAwLjE4KTtcclxuICAgIH1cclxuXHJcbiAgICAuc2V0dGluZ3MtaGVhZGVyIHtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgZ2FwOiAxMnB4O1xyXG4gICAgICBhbGlnbi1pdGVtczogZmxleC1zdGFydDtcclxuICAgICAgbWFyZ2luLWJvdHRvbTogMTZweDtcclxuICAgIH1cclxuXHJcbiAgICAuc2V0dGluZ3MtaWNvbiB7XHJcbiAgICAgIHdpZHRoOiAzNnB4O1xyXG4gICAgICBoZWlnaHQ6IDM2cHg7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDEwcHg7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjYsIDk1LCAxNjgsIDAuMzUpO1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcclxuICAgICAgZmxleC1zaHJpbms6IDA7XHJcbiAgICB9XHJcblxyXG4gICAgLnNldHRpbmdzLWljb24gbWF0LWljb24ge1xyXG4gICAgICBjb2xvcjogI2JmZGJmZTtcclxuICAgIH1cclxuXHJcbiAgICAuc2V0dGluZ3MtaWNvbi5kaXNwbGF5LWljb24ge1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDEzNCwgMjM5LCAxNzIsIDAuMTQpO1xyXG4gICAgfVxyXG5cclxuICAgIC5zZXR0aW5ncy1pY29uLmRpc3BsYXktaWNvbiBtYXQtaWNvbiB7XHJcbiAgICAgIGNvbG9yOiAjYmJmN2QwO1xyXG4gICAgfVxyXG5cclxuICAgIC5zZXR0aW5ncy1oZWFkZXIgaDQge1xyXG4gICAgICBtYXJnaW46IDAgMCA0cHg7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTVweDtcclxuICAgICAgZm9udC13ZWlnaHQ6IDcwMDtcclxuICAgIH1cclxuXHJcbiAgICAuc2V0dGluZ3MtaGVhZGVyIHAge1xyXG4gICAgICBtYXJnaW46IDA7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNjUpO1xyXG4gICAgICBmb250LXNpemU6IDEycHg7XHJcbiAgICAgIGxpbmUtaGVpZ2h0OiAxLjQ7XHJcbiAgICB9XHJcblxyXG4gICAgLnNldHRpbmdzLXRvZ2dsZSB7XHJcbiAgICAgIHdpZHRoOiAxMDAlO1xyXG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcclxuICAgICAgYm9yZGVyLXJhZGl1czogMTBweDtcclxuICAgICAgY29sb3I6ICNmZmYgIWltcG9ydGFudDtcclxuICAgICAgYm9yZGVyLWNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMikgIWltcG9ydGFudDtcclxuICAgICAgbWFyZ2luLWJvdHRvbTogMTZweDtcclxuICAgIH1cclxuXHJcbiAgICAuc2V0dGluZ3MtdG9nZ2xlIG1hdC1pY29uIHtcclxuICAgICAgbWFyZ2luLXJpZ2h0OiA4cHg7XHJcbiAgICAgIGZvbnQtc2l6ZTogMThweDtcclxuICAgICAgd2lkdGg6IDE4cHg7XHJcbiAgICAgIGhlaWdodDogMThweDtcclxuICAgIH1cclxuXHJcbiAgICAudm9sdW1lLWxhYmVsIHtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAganVzdGlmeS1jb250ZW50OiBzcGFjZS1iZXR3ZWVuO1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjc4KTtcclxuICAgICAgZm9udC1zaXplOiAxMnB4O1xyXG4gICAgICBmb250LXdlaWdodDogNjAwO1xyXG4gICAgICBtYXJnaW4tYm90dG9tOiA4cHg7XHJcbiAgICB9XHJcblxyXG4gICAgLnNldHRpbmdzLXZvbHVtZSB7XHJcbiAgICAgIHdpZHRoOiAxMDAlO1xyXG4gICAgICBhY2NlbnQtY29sb3I6ICM3ZmI0ZmY7XHJcbiAgICAgIGN1cnNvcjogcG9pbnRlcjtcclxuICAgICAgbWFyZ2luLWJvdHRvbTogMTJweDtcclxuICAgIH1cclxuXHJcbiAgICAuc2V0dGluZ3MtcHJldmlldyB7XHJcbiAgICAgIG1hcmdpbjogMCAwIDE2cHg7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDEwcHg7XHJcbiAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xMik7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4wNik7XHJcbiAgICAgIGNvbG9yOiAjZjVmN2ZmO1xyXG4gICAgICBib3gtc2l6aW5nOiBib3JkZXItYm94O1xyXG4gICAgfVxyXG5cclxuICAgIC5tZXNzYWdlLXByZXZpZXcge1xyXG4gICAgICBwYWRkaW5nOiA5cHggMTFweDtcclxuICAgICAgbGluZS1oZWlnaHQ6IDEuMzU7XHJcbiAgICB9XHJcblxyXG4gICAgLmNvZGUtcHJldmlldyB7XHJcbiAgICAgIHBhZGRpbmc6IDEwcHggMTFweDtcclxuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcclxuICAgICAgZm9udC1mYW1pbHk6IHVpLW1vbm9zcGFjZSwgU0ZNb25vLVJlZ3VsYXIsIE1lbmxvLCBNb25hY28sIENvbnNvbGFzLCBcIkxpYmVyYXRpb24gTW9ub1wiLCBtb25vc3BhY2U7XHJcbiAgICAgIGxpbmUtaGVpZ2h0OiAxLjQ1O1xyXG4gICAgICB3aGl0ZS1zcGFjZTogcHJlLXdyYXA7XHJcbiAgICAgIGNvbG9yOiAjZGJlYWZlO1xyXG4gICAgICBiYWNrZ3JvdW5kOiAjMDYxODI3O1xyXG4gICAgICBtYXJnaW4tYm90dG9tOiAwO1xyXG4gICAgfVxyXG5cclxuICAgIC5jb250ZXh0LW1lbnUge1xyXG4gICAgICBwb3NpdGlvbjogZml4ZWQ7XHJcbiAgICAgIHotaW5kZXg6IDEwMDAxO1xyXG4gICAgICBiYWNrZ3JvdW5kOiAjMDcxZDMwO1xyXG4gICAgICBib3JkZXItcmFkaXVzOiA4cHg7XHJcbiAgICAgIHBhZGRpbmc6IDRweCAwO1xyXG4gICAgICBib3gtc2hhZG93OiAwIDhweCAyNHB4IHJnYmEoMCwgMCwgMCwgMC4zKTtcclxuICAgICAgbWluLXdpZHRoOiAyMDBweDtcclxuICAgIH1cclxuXHJcbiAgICAuY3R4LWl0ZW0ge1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBnYXA6IDEwcHg7XHJcbiAgICAgIHBhZGRpbmc6IDEwcHggMTZweDtcclxuICAgICAgY3Vyc29yOiBwb2ludGVyO1xyXG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjkpO1xyXG4gICAgICBmb250LXNpemU6IDEzcHg7XHJcbiAgICAgIHRyYW5zaXRpb246IGJhY2tncm91bmQgMC4xNXM7XHJcbiAgICB9XHJcblxyXG4gICAgLmN0eC1pdGVtOmhvdmVyIHtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjEpO1xyXG4gICAgfVxyXG5cclxuICAgIC5jdHgtaXRlbSBtYXQtaWNvbiB7XHJcbiAgICAgIGZvbnQtc2l6ZTogMThweDtcclxuICAgICAgd2lkdGg6IDE4cHg7XHJcbiAgICAgIGhlaWdodDogMThweDtcclxuICAgIH1cclxuXHJcbiAgICAuY3R4LWRhbmdlciB7XHJcbiAgICAgIGNvbG9yOiAjZjg3MTcxO1xyXG4gICAgfVxyXG5cclxuICAgIC5jdHgtZGFuZ2VyOmhvdmVyIHtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNDgsIDExMywgMTEzLCAwLjE1KTtcclxuICAgIH1cclxuXHJcbiAgICAuY3R4LWJhY2tkcm9wIHtcclxuICAgICAgcG9zaXRpb246IGZpeGVkO1xyXG4gICAgICBpbnNldDogMDtcclxuICAgICAgei1pbmRleDogMTAwMDA7XHJcbiAgICB9XHJcbiAgYF0sXHJcbn0pXHJcbmV4cG9ydCBjbGFzcyBJbmJveExpc3RDb21wb25lbnQgaW1wbGVtZW50cyBPbkluaXQsIE9uRGVzdHJveSB7XHJcbiAgaW5ib3g6IEluYm94SXRlbVtdID0gW107XHJcbiAgbXlUaWNrZXRzOiBUaWNrZXROb3RpZmljYXRpb25JdGVtW10gPSBbXTtcclxuICB0aWNrZXRVbnNlZW5Db3VudCA9IDA7XHJcbiAgc2VhcmNoUXVlcnkgPSAnJztcclxuICBhY3RpdmVUYWI6IEluYm94VGFiID0gJ2FsbCc7XHJcbiAgbm90aWZpY2F0aW9uVm9sdW1lID0gMC4zNTtcclxuICBub3RpZmljYXRpb25zTXV0ZWQgPSBmYWxzZTtcclxuICBtZXNzYWdlVGV4dFNjYWxlID0gMTtcclxuICBjb2RlVGV4dFNjYWxlID0gMTtcclxuICBjb250ZXh0TWVudTogeyB4OiBudW1iZXI7IHk6IG51bWJlcjsgaXRlbTogSW5ib3hJdGVtIH0gfCBudWxsID0gbnVsbDtcclxuICBleHBhbmRlZFByb2plY3RJZHMgPSBuZXcgU2V0PHN0cmluZz4oKTtcclxuICBwcml2YXRlIHJlYWRvbmx5IHRhYlN0b3JhZ2VLZXkgPSAnbWVzc2FnaW5nX2luYm94X2FjdGl2ZV90YWInO1xyXG4gIHByaXZhdGUgc3ViITogU3Vic2NyaXB0aW9uO1xyXG5cclxuICBjb25zdHJ1Y3RvcihcclxuICAgIHByaXZhdGUgc3RvcmU6IE1lc3NhZ2luZ1N0b3JlU2VydmljZSxcclxuICAgIHByaXZhdGUgdGlja2V0Tm90aWZpY2F0aW9uczogVGlja2V0Tm90aWZpY2F0aW9uU2VydmljZVxyXG4gICkge31cclxuXHJcbiAgZ2V0IHByb2plY3RHcm91cHNFbmFibGVkKCk6IGJvb2xlYW4ge1xyXG4gICAgcmV0dXJuIHRoaXMuc3RvcmUucHJvamVjdEdyb3Vwc0VuYWJsZWQ7XHJcbiAgfVxyXG5cclxuICBnZXQgdGlja2V0c1RhYlZpc2libGUoKTogYm9vbGVhbiB7XHJcbiAgICByZXR1cm4gdGhpcy50aWNrZXROb3RpZmljYXRpb25zLmVuYWJsZWQgJiYgdGhpcy5teVRpY2tldHMubGVuZ3RoID4gMDtcclxuICB9XHJcblxyXG4gIGdldCB2aXNpYmxlVGFiQ291bnQoKTogbnVtYmVyIHtcclxuICAgIGxldCBjb3VudCA9IDQ7XHJcbiAgICBpZiAodGhpcy5wcm9qZWN0R3JvdXBzRW5hYmxlZCkgY291bnQrKztcclxuICAgIGlmICh0aGlzLnRpY2tldHNUYWJWaXNpYmxlKSBjb3VudCsrO1xyXG4gICAgcmV0dXJuIGNvdW50O1xyXG4gIH1cclxuXHJcbiAgbmdPbkluaXQoKTogdm9pZCB7XHJcbiAgICBjb25zdCBzYXZlZFRhYiA9IHRoaXMuZ2V0U2F2ZWRUYWIoKTtcclxuICAgIHRoaXMuYWN0aXZlVGFiID0gc2F2ZWRUYWIgPT09ICd0aWNrZXRzJyA/ICdhbGwnIDogc2F2ZWRUYWI7XHJcbiAgICBjb25zdCByZXN0b3JlVGlja2V0c1RhYiA9IHNhdmVkVGFiID09PSAndGlja2V0cyc7XHJcbiAgICB0aGlzLnN1YiA9IG5ldyBTdWJzY3JpcHRpb24oKTtcclxuICAgIHRoaXMuc3ViLmFkZCh0aGlzLnN0b3JlLmluYm94LnN1YnNjcmliZSgoaXRlbXMpID0+ICh0aGlzLmluYm94ID0gaXRlbXMpKSk7XHJcbiAgICB0aGlzLnN1Yi5hZGQodGhpcy5zdG9yZS5ub3RpZmljYXRpb25Wb2x1bWUuc3Vic2NyaWJlKCh2b2x1bWUpID0+ICh0aGlzLm5vdGlmaWNhdGlvblZvbHVtZSA9IHZvbHVtZSkpKTtcclxuICAgIHRoaXMuc3ViLmFkZCh0aGlzLnN0b3JlLm5vdGlmaWNhdGlvbnNNdXRlZC5zdWJzY3JpYmUoKG11dGVkKSA9PiAodGhpcy5ub3RpZmljYXRpb25zTXV0ZWQgPSBtdXRlZCkpKTtcclxuICAgIHRoaXMuc3ViLmFkZCh0aGlzLnN0b3JlLm1lc3NhZ2VUZXh0U2NhbGUuc3Vic2NyaWJlKChzY2FsZSkgPT4gKHRoaXMubWVzc2FnZVRleHRTY2FsZSA9IHNjYWxlKSkpO1xyXG4gICAgdGhpcy5zdWIuYWRkKHRoaXMuc3RvcmUuY29kZVRleHRTY2FsZS5zdWJzY3JpYmUoKHNjYWxlKSA9PiAodGhpcy5jb2RlVGV4dFNjYWxlID0gc2NhbGUpKSk7XHJcbiAgICBpZiAodGhpcy50aWNrZXROb3RpZmljYXRpb25zLmVuYWJsZWQpIHtcclxuICAgICAgbGV0IHJlc3RvcmVkVGlja2V0c1RhYiA9IGZhbHNlO1xyXG4gICAgICB0aGlzLnN1Yi5hZGQodGhpcy50aWNrZXROb3RpZmljYXRpb25zLnRpY2tldHMuc3Vic2NyaWJlKCh0aWNrZXRzKSA9PiB7XHJcbiAgICAgICAgdGhpcy5teVRpY2tldHMgPSB0aWNrZXRzO1xyXG4gICAgICAgIGlmICghcmVzdG9yZWRUaWNrZXRzVGFiICYmIHJlc3RvcmVUaWNrZXRzVGFiICYmIHRpY2tldHMubGVuZ3RoID4gMCkge1xyXG4gICAgICAgICAgcmVzdG9yZWRUaWNrZXRzVGFiID0gdHJ1ZTtcclxuICAgICAgICAgIHRoaXMuc2V0QWN0aXZlVGFiKCd0aWNrZXRzJyk7XHJcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLmFjdGl2ZVRhYiA9PT0gJ3RpY2tldHMnICYmIHRpY2tldHMubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgICAgICB0aGlzLnNldEFjdGl2ZVRhYignYWxsJyk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9KSk7XHJcbiAgICAgIHRoaXMuc3ViLmFkZCh0aGlzLnRpY2tldE5vdGlmaWNhdGlvbnMudW5zZWVuQ291bnQuc3Vic2NyaWJlKChjb3VudCkgPT4gKHRoaXMudGlja2V0VW5zZWVuQ291bnQgPSBjb3VudCkpKTtcclxuICAgICAgdGhpcy50aWNrZXROb3RpZmljYXRpb25zLmxvYWRUaWNrZXRzKCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBuZ09uRGVzdHJveSgpOiB2b2lkIHtcclxuICAgIHRoaXMuc3ViPy51bnN1YnNjcmliZSgpO1xyXG4gIH1cclxuXHJcbiAgZ2V0IGZpbHRlcmVkSW5ib3goKTogSW5ib3hJdGVtW10ge1xyXG4gICAgaWYgKHRoaXMuYWN0aXZlVGFiID09PSAnc2V0dGluZ3MnKSByZXR1cm4gW107XHJcbiAgICBjb25zdCB0YWJiZWQgPSB0aGlzLmluYm94LmZpbHRlcigoaXRlbSkgPT4ge1xyXG4gICAgICBjb25zdCBwcm9qZWN0ID0gdGhpcy5pc1Byb2plY3QoaXRlbSk7XHJcbiAgICAgIGlmICh0aGlzLmFjdGl2ZVRhYiA9PT0gJ2RpcmVjdCcpIHJldHVybiAhaXRlbS5pc19ncm91cDtcclxuICAgICAgaWYgKHRoaXMuYWN0aXZlVGFiID09PSAnZ3JvdXBzJykgcmV0dXJuIGl0ZW0uaXNfZ3JvdXAgJiYgIXByb2plY3Q7XHJcbiAgICAgIGlmICh0aGlzLmFjdGl2ZVRhYiA9PT0gJ3Byb2plY3RzJykgcmV0dXJuIFtdO1xyXG4gICAgICByZXR1cm4gIWlzUHJvamVjdENvbnRhaW5lcihpdGVtKTtcclxuICAgIH0pO1xyXG4gICAgaWYgKCF0aGlzLnNlYXJjaFF1ZXJ5LnRyaW0oKSkgcmV0dXJuIHRhYmJlZDtcclxuICAgIGNvbnN0IHEgPSB0aGlzLnNlYXJjaFF1ZXJ5LnRvTG93ZXJDYXNlKCk7XHJcbiAgICByZXR1cm4gdGFiYmVkLmZpbHRlcihcclxuICAgICAgKGl0ZW0pID0+XHJcbiAgICAgICAgKGl0ZW0ubmFtZSB8fCAnJykudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhxKSB8fFxyXG4gICAgICAgIChpdGVtLmxhc3RfbWVzc2FnZV9wcmV2aWV3IHx8ICcnKS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKHEpXHJcbiAgICApO1xyXG4gIH1cclxuXHJcbiAgZ2V0IHByb2plY3RDb250YWluZXJzKCk6IEluYm94SXRlbVtdIHtcclxuICAgIGNvbnN0IGNvbnRhaW5lcnMgPSB0aGlzLmluYm94LmZpbHRlcigoaXRlbSkgPT4gaXNQcm9qZWN0Q29udGFpbmVyKGl0ZW0pKTtcclxuICAgIGlmICghdGhpcy5zZWFyY2hRdWVyeS50cmltKCkpIHJldHVybiBjb250YWluZXJzO1xyXG4gICAgY29uc3QgcSA9IHRoaXMuc2VhcmNoUXVlcnkudG9Mb3dlckNhc2UoKTtcclxuICAgIHJldHVybiBjb250YWluZXJzLmZpbHRlcigocHJvamVjdCkgPT4ge1xyXG4gICAgICBjb25zdCBwcm9qZWN0TWF0Y2ggPSAocHJvamVjdC5uYW1lIHx8ICcnKS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKHEpO1xyXG4gICAgICBjb25zdCBzdWJncm91cE1hdGNoID0gdGhpcy5wcm9qZWN0U3ViZ3JvdXBzKHByb2plY3QsIGZhbHNlKS5zb21lKFxyXG4gICAgICAgIChpdGVtKSA9PlxyXG4gICAgICAgICAgKGl0ZW0ubmFtZSB8fCAnJykudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhxKSB8fFxyXG4gICAgICAgICAgKGl0ZW0uc3ViZ3JvdXBfc3ViamVjdCB8fCAnJykudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhxKSB8fFxyXG4gICAgICAgICAgKGl0ZW0ubGFzdF9tZXNzYWdlX3ByZXZpZXcgfHwgJycpLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMocSlcclxuICAgICAgKTtcclxuICAgICAgcmV0dXJuIHByb2plY3RNYXRjaCB8fCBzdWJncm91cE1hdGNoO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBnZXQgc2hvd0VtcHR5U3RhdGUoKTogYm9vbGVhbiB7XHJcbiAgICBpZiAodGhpcy5hY3RpdmVUYWIgPT09ICdzZXR0aW5ncycpIHJldHVybiBmYWxzZTtcclxuICAgIGlmICh0aGlzLmFjdGl2ZVRhYiA9PT0gJ3RpY2tldHMnKSByZXR1cm4gdGhpcy5teVRpY2tldHMubGVuZ3RoID09PSAwO1xyXG4gICAgaWYgKHRoaXMuYWN0aXZlVGFiID09PSAncHJvamVjdHMnKSByZXR1cm4gdGhpcy5wcm9qZWN0Q29udGFpbmVycy5sZW5ndGggPT09IDA7XHJcbiAgICByZXR1cm4gdGhpcy5maWx0ZXJlZEluYm94Lmxlbmd0aCA9PT0gMDtcclxuICB9XHJcblxyXG4gIGdldCBlbXB0eVN0YXRlSWNvbigpOiBzdHJpbmcge1xyXG4gICAgaWYgKHRoaXMuYWN0aXZlVGFiID09PSAndGlja2V0cycpIHJldHVybiAnY29uZmlybWF0aW9uX251bWJlcic7XHJcbiAgICBpZiAodGhpcy5hY3RpdmVUYWIgPT09ICdwcm9qZWN0cycpIHJldHVybiAnd29ya3NwYWNlcyc7XHJcbiAgICBpZiAodGhpcy5hY3RpdmVUYWIgPT09ICdncm91cHMnKSByZXR1cm4gJ2dyb3VwJztcclxuICAgIHJldHVybiAnZm9ydW0nO1xyXG4gIH1cclxuXHJcbiAgZ2V0IGVtcHR5U3RhdGVUZXh0KCk6IHN0cmluZyB7XHJcbiAgICBpZiAodGhpcy5zZWFyY2hRdWVyeS50cmltKCkpIHJldHVybiAnTm8gbWF0Y2hpbmcgY29udmVyc2F0aW9ucyc7XHJcbiAgICBpZiAodGhpcy5hY3RpdmVUYWIgPT09ICdkaXJlY3QnKSByZXR1cm4gJ05vIGNoYXRzIHlldCc7XHJcbiAgICBpZiAodGhpcy5hY3RpdmVUYWIgPT09ICdncm91cHMnKSByZXR1cm4gJ05vIGdyb3VwcyB5ZXQnO1xyXG4gICAgaWYgKHRoaXMuYWN0aXZlVGFiID09PSAncHJvamVjdHMnKSByZXR1cm4gJ05vIHByb2plY3QgY2hhdHMgeWV0JztcclxuICAgIGlmICh0aGlzLmFjdGl2ZVRhYiA9PT0gJ3RpY2tldHMnKSByZXR1cm4gJ05vIHRpY2tldHMgYXNzaWduZWQgdG8geW91JztcclxuICAgIHJldHVybiAnTm8gY29udmVyc2F0aW9ucyB5ZXQnO1xyXG4gIH1cclxuXHJcbiAgaXNQcm9qZWN0KGl0ZW06IEluYm94SXRlbSk6IGJvb2xlYW4ge1xyXG4gICAgcmV0dXJuIGlzUHJvamVjdENvbnZlcnNhdGlvbihpdGVtKTtcclxuICB9XHJcblxyXG4gIHByb2plY3RTdWJncm91cHMocHJvamVjdDogSW5ib3hJdGVtLCBhcHBseVNlYXJjaCA9IHRydWUpOiBJbmJveEl0ZW1bXSB7XHJcbiAgICBjb25zdCBwYXJlbnRJZCA9IFN0cmluZyhwcm9qZWN0LmNvbnZlcnNhdGlvbl9pZCk7XHJcbiAgICBsZXQgc3ViZ3JvdXBzID0gdGhpcy5pbmJveC5maWx0ZXIoXHJcbiAgICAgIChpdGVtKSA9PiBpc1Byb2plY3RTdWJncm91cChpdGVtKSAmJiBTdHJpbmcoaXRlbS5wYXJlbnRfY29udmVyc2F0aW9uX2lkIHx8ICcnKSA9PT0gcGFyZW50SWRcclxuICAgICk7XHJcbiAgICBpZiAoYXBwbHlTZWFyY2ggJiYgdGhpcy5zZWFyY2hRdWVyeS50cmltKCkpIHtcclxuICAgICAgY29uc3QgcSA9IHRoaXMuc2VhcmNoUXVlcnkudG9Mb3dlckNhc2UoKTtcclxuICAgICAgc3ViZ3JvdXBzID0gc3ViZ3JvdXBzLmZpbHRlcihcclxuICAgICAgICAoaXRlbSkgPT5cclxuICAgICAgICAgIChpdGVtLm5hbWUgfHwgJycpLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMocSkgfHxcclxuICAgICAgICAgIChpdGVtLnN1Ymdyb3VwX3N1YmplY3QgfHwgJycpLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMocSkgfHxcclxuICAgICAgICAgIChpdGVtLmxhc3RfbWVzc2FnZV9wcmV2aWV3IHx8ICcnKS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKHEpXHJcbiAgICAgICk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gc3ViZ3JvdXBzO1xyXG4gIH1cclxuXHJcbiAgaXNQcm9qZWN0RXhwYW5kZWQocHJvamVjdDogSW5ib3hJdGVtKTogYm9vbGVhbiB7XHJcbiAgICByZXR1cm4gdGhpcy5leHBhbmRlZFByb2plY3RJZHMuaGFzKFN0cmluZyhwcm9qZWN0LmNvbnZlcnNhdGlvbl9pZCkpO1xyXG4gIH1cclxuXHJcbiAgdG9nZ2xlUHJvamVjdChwcm9qZWN0OiBJbmJveEl0ZW0pOiB2b2lkIHtcclxuICAgIGNvbnN0IGlkID0gU3RyaW5nKHByb2plY3QuY29udmVyc2F0aW9uX2lkKTtcclxuICAgIGNvbnN0IG5leHQgPSBuZXcgU2V0KHRoaXMuZXhwYW5kZWRQcm9qZWN0SWRzKTtcclxuICAgIGlmIChuZXh0LmhhcyhpZCkpIHtcclxuICAgICAgbmV4dC5kZWxldGUoaWQpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgbmV4dC5hZGQoaWQpO1xyXG4gICAgfVxyXG4gICAgdGhpcy5leHBhbmRlZFByb2plY3RJZHMgPSBuZXh0O1xyXG4gIH1cclxuXHJcbiAgY3JlYXRlU3ViZ3JvdXAocHJvamVjdDogSW5ib3hJdGVtLCBldmVudDogRXZlbnQpOiB2b2lkIHtcclxuICAgIGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xyXG4gICAgdGhpcy5leHBhbmRlZFByb2plY3RJZHMuYWRkKFN0cmluZyhwcm9qZWN0LmNvbnZlcnNhdGlvbl9pZCkpO1xyXG4gICAgdGhpcy5zdG9yZS5vcGVuUHJvamVjdFN1Ymdyb3VwQ3JlYXRvcihwcm9qZWN0KTtcclxuICB9XHJcblxyXG4gIHNldEFjdGl2ZVRhYih0YWI6IEluYm94VGFiKTogdm9pZCB7XHJcbiAgICBpZiAodGFiID09PSAncHJvamVjdHMnICYmICF0aGlzLnByb2plY3RHcm91cHNFbmFibGVkKSB0YWIgPSAnYWxsJztcclxuICAgIGlmICh0YWIgPT09ICd0aWNrZXRzJyAmJiAhdGhpcy50aWNrZXRzVGFiVmlzaWJsZSkgdGFiID0gJ2FsbCc7XHJcbiAgICB0aGlzLmFjdGl2ZVRhYiA9IHRhYjtcclxuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKHRoaXMudGFiU3RvcmFnZUtleSwgdGFiKTtcclxuICAgIHRoaXMuY29udGV4dE1lbnUgPSBudWxsO1xyXG4gICAgaWYgKHRhYiA9PT0gJ3RpY2tldHMnKSB7XHJcbiAgICAgIHRoaXMudGlja2V0Tm90aWZpY2F0aW9ucy5sb2FkVGlja2V0cygpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBnZXRTYXZlZFRhYigpOiBJbmJveFRhYiB7XHJcbiAgICBjb25zdCBzYXZlZCA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKHRoaXMudGFiU3RvcmFnZUtleSk7XHJcbiAgICBpZiAoc2F2ZWQgPT09ICdwcm9qZWN0cycgJiYgIXRoaXMucHJvamVjdEdyb3Vwc0VuYWJsZWQpIHJldHVybiAnYWxsJztcclxuICAgIGlmIChzYXZlZCA9PT0gJ3RpY2tldHMnKSByZXR1cm4gJ3RpY2tldHMnO1xyXG4gICAgcmV0dXJuIHNhdmVkID09PSAnZGlyZWN0JyB8fCBzYXZlZCA9PT0gJ2dyb3VwcycgfHwgc2F2ZWQgPT09ICdwcm9qZWN0cycgfHwgc2F2ZWQgPT09ICdzZXR0aW5ncycgfHwgc2F2ZWQgPT09ICdhbGwnXHJcbiAgICAgID8gc2F2ZWRcclxuICAgICAgOiAnYWxsJztcclxuICB9XHJcblxyXG4gIG1hcmtUaWNrZXRSZWFkKHRpY2tldDogVGlja2V0Tm90aWZpY2F0aW9uSXRlbSk6IHZvaWQge1xyXG4gICAgdGhpcy50aWNrZXROb3RpZmljYXRpb25zLm1hcmtTZWVuKHRpY2tldCk7XHJcbiAgfVxyXG5cclxuICBnb1RvVGlja2V0aW5nRGFzaGJvYXJkKCk6IHZvaWQge1xyXG4gICAgdGhpcy50aWNrZXROb3RpZmljYXRpb25zLm5hdmlnYXRlVG9EYXNoYm9hcmQoKTtcclxuICB9XHJcblxyXG4gIGZvcm1hdFRpY2tldERhdGUodmFsdWU6IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgICBjb25zdCBkYXRlID0gbmV3IERhdGUodmFsdWUpO1xyXG4gICAgaWYgKE51bWJlci5pc05hTihkYXRlLmdldFRpbWUoKSkpIHJldHVybiB2YWx1ZTtcclxuICAgIHJldHVybiBkYXRlLnRvTG9jYWxlU3RyaW5nKHVuZGVmaW5lZCwgeyBkYXRlU3R5bGU6ICdzaG9ydCcsIHRpbWVTdHlsZTogJ3Nob3J0JyB9KTtcclxuICB9XHJcblxyXG4gIHRvZ2dsZU5vdGlmaWNhdGlvbnNNdXRlZCgpOiB2b2lkIHtcclxuICAgIGNvbnN0IG5leHRNdXRlZCA9ICF0aGlzLm5vdGlmaWNhdGlvbnNNdXRlZDtcclxuICAgIHRoaXMuc3RvcmUuc2V0Tm90aWZpY2F0aW9uc011dGVkKG5leHRNdXRlZCk7XHJcbiAgICBpZiAoIW5leHRNdXRlZCAmJiB0aGlzLm5vdGlmaWNhdGlvblZvbHVtZSA+IDApIHtcclxuICAgICAgdGhpcy5zdG9yZS50ZXN0Tm90aWZpY2F0aW9uU291bmQoKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIG9uTm90aWZpY2F0aW9uVm9sdW1lQ2hhbmdlKHZhbHVlOiBudW1iZXIgfCBzdHJpbmcpOiB2b2lkIHtcclxuICAgIHRoaXMuc3RvcmUuc2V0Tm90aWZpY2F0aW9uVm9sdW1lKE51bWJlcih2YWx1ZSkpO1xyXG4gIH1cclxuXHJcbiAgcHJldmlld05vdGlmaWNhdGlvblNvdW5kKCk6IHZvaWQge1xyXG4gICAgaWYgKCF0aGlzLm5vdGlmaWNhdGlvbnNNdXRlZCAmJiB0aGlzLm5vdGlmaWNhdGlvblZvbHVtZSA+IDApIHtcclxuICAgICAgdGhpcy5zdG9yZS50ZXN0Tm90aWZpY2F0aW9uU291bmQoKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIG9uTWVzc2FnZVRleHRTY2FsZUNoYW5nZSh2YWx1ZTogbnVtYmVyIHwgc3RyaW5nKTogdm9pZCB7XHJcbiAgICB0aGlzLnN0b3JlLnNldE1lc3NhZ2VUZXh0U2NhbGUoTnVtYmVyKHZhbHVlKSk7XHJcbiAgfVxyXG5cclxuICBvbkNvZGVUZXh0U2NhbGVDaGFuZ2UodmFsdWU6IG51bWJlciB8IHN0cmluZyk6IHZvaWQge1xyXG4gICAgdGhpcy5zdG9yZS5zZXRDb2RlVGV4dFNjYWxlKE51bWJlcih2YWx1ZSkpO1xyXG4gIH1cclxuXHJcbiAgb3BlbkNvbnZlcnNhdGlvbihpdGVtOiBJbmJveEl0ZW0pOiB2b2lkIHtcclxuICAgIGlmIChpc1Byb2plY3RDb250YWluZXIoaXRlbSkpIHtcclxuICAgICAgdGhpcy50b2dnbGVQcm9qZWN0KGl0ZW0pO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICB0aGlzLnN0b3JlLm9wZW5Db252ZXJzYXRpb24oXHJcbiAgICAgIGl0ZW0uY29udmVyc2F0aW9uX2lkLFxyXG4gICAgICBpdGVtLm5hbWUgfHwgJ0NoYXQnLFxyXG4gICAgICBpdGVtLmlzX2dyb3VwLFxyXG4gICAgICB0aGlzLmlzUHJvamVjdChpdGVtKSxcclxuICAgICAgaXNQcm9qZWN0U3ViZ3JvdXAoaXRlbSksXHJcbiAgICAgIGl0ZW0uZGJfZ2lkLFxyXG4gICAgICBpdGVtLnByb2plY3RfZ2lkLFxyXG4gICAgICBpdGVtLnBhcmVudF9jb252ZXJzYXRpb25faWQsXHJcbiAgICAgIGl0ZW0uc3ViZ3JvdXBfc3ViamVjdCxcclxuICAgICk7XHJcbiAgfVxyXG5cclxuICBvbk5ld0NvbnZlcnNhdGlvbigpOiB2b2lkIHtcclxuICAgIHRoaXMuc3RvcmUuc2V0VmlldygnbmV3LWNvbnZlcnNhdGlvbicpO1xyXG4gIH1cclxuXHJcbiAgb25DcmVhdGVHcm91cCgpOiB2b2lkIHtcclxuICAgIHRoaXMuc3RvcmUuc2V0VmlldygnZ3JvdXAtbWFuYWdlcicpO1xyXG4gIH1cclxuXHJcbiAgb25Db250ZXh0TWVudShldmVudDogTW91c2VFdmVudCwgaXRlbTogSW5ib3hJdGVtKTogdm9pZCB7XHJcbiAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XHJcbiAgICB0aGlzLmNvbnRleHRNZW51ID0geyB4OiBldmVudC5jbGllbnRYLCB5OiBldmVudC5jbGllbnRZLCBpdGVtIH07XHJcbiAgfVxyXG5cclxuICBjbG9zZUNvbnRleHRNZW51KCk6IHZvaWQge1xyXG4gICAgdGhpcy5jb250ZXh0TWVudSA9IG51bGw7XHJcbiAgfVxyXG5cclxuICBjbGVhckNoYXQoKTogdm9pZCB7XHJcbiAgICBpZiAoIXRoaXMuY29udGV4dE1lbnUpIHJldHVybjtcclxuICAgIGNvbnN0IGlkID0gdGhpcy5jb250ZXh0TWVudS5pdGVtLmNvbnZlcnNhdGlvbl9pZDtcclxuICAgIHRoaXMuc3RvcmUuY2xlYXJDb252ZXJzYXRpb24oaWQpO1xyXG4gICAgdGhpcy5jb250ZXh0TWVudSA9IG51bGw7XHJcbiAgfVxyXG5cclxuICBkZWxldGVDaGF0KCk6IHZvaWQge1xyXG4gICAgaWYgKCF0aGlzLmNvbnRleHRNZW51KSByZXR1cm47XHJcbiAgICBjb25zdCBpdGVtID0gdGhpcy5jb250ZXh0TWVudS5pdGVtO1xyXG4gICAgaWYgKGl0ZW0uaXNfZ3JvdXApIHtcclxuICAgICAgdGhpcy5zdG9yZS5kZWxldGVHcm91cChpdGVtLmNvbnZlcnNhdGlvbl9pZCk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICB0aGlzLnN0b3JlLmRlbGV0ZUNvbnZlcnNhdGlvbihpdGVtLmNvbnZlcnNhdGlvbl9pZCk7XHJcbiAgICB9XHJcbiAgICB0aGlzLmNvbnRleHRNZW51ID0gbnVsbDtcclxuICB9XHJcblxyXG4gIGZvcm1hdFRpbWUoZGF0ZVN0cjogc3RyaW5nKTogc3RyaW5nIHtcclxuICAgIGlmICghZGF0ZVN0cikgcmV0dXJuICcnO1xyXG4gICAgY29uc3QgZGF0ZSA9IG5ldyBEYXRlKGRhdGVTdHIpO1xyXG4gICAgY29uc3Qgbm93ID0gbmV3IERhdGUoKTtcclxuICAgIGNvbnN0IGRpZmZNcyA9IG5vdy5nZXRUaW1lKCkgLSBkYXRlLmdldFRpbWUoKTtcclxuICAgIGNvbnN0IGRpZmZNaW5zID0gTWF0aC5mbG9vcihkaWZmTXMgLyA2MDAwMCk7XHJcbiAgICBjb25zdCBkaWZmSG91cnMgPSBNYXRoLmZsb29yKGRpZmZNcyAvIDM2MDAwMDApO1xyXG4gICAgY29uc3QgZGlmZkRheXMgPSBNYXRoLmZsb29yKGRpZmZNcyAvIDg2NDAwMDAwKTtcclxuXHJcbiAgICBpZiAoZGlmZk1pbnMgPCAxKSByZXR1cm4gJ25vdyc7XHJcbiAgICBpZiAoZGlmZk1pbnMgPCA2MCkgcmV0dXJuIGAke2RpZmZNaW5zfW1gO1xyXG4gICAgaWYgKGRpZmZIb3VycyA8IDI0KSByZXR1cm4gYCR7ZGlmZkhvdXJzfWhgO1xyXG4gICAgaWYgKGRpZmZEYXlzIDwgNykgcmV0dXJuIGAke2RpZmZEYXlzfWRgO1xyXG5cclxuICAgIHJldHVybiBkYXRlLnRvTG9jYWxlRGF0ZVN0cmluZygnZW4tR0InLCB7IGRheTogJ251bWVyaWMnLCBtb250aDogJ3Nob3J0JyB9KTtcclxuICB9XHJcbn1cclxuIl19