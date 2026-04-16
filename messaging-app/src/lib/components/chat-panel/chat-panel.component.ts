import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription, combineLatest } from 'rxjs';
import { MessagingStoreService } from '../../services/messaging-store.service';
import { SidebarSide } from '../../models/messaging.models';
import { InboxListComponent } from '../inbox-list/inbox-list.component';
import { ChatThreadComponent } from '../chat-thread/chat-thread.component';
import { NewConversationComponent } from '../new-conversation/new-conversation.component';
import { GroupManagerComponent } from '../group-manager/group-manager.component';

@Component({
  selector: 'app-chat-panel',
  standalone: true,
  imports: [
    CommonModule, MatIconModule, MatButtonModule, MatTooltipModule,
    InboxListComponent, ChatThreadComponent,
    NewConversationComponent, GroupManagerComponent,
  ],
  template: `
    <!-- Sidebar -->
    <div
      class="sidebar"
      [class.open]="isOpen"
      [class.side-left]="side === 'left'"
      [class.side-right]="side === 'right'"
      [style.width.px]="sidebarWidth"
    >
      <!-- Resize handle on inner edge -->
      <div
        class="resize-handle"
        [class.handle-left]="side === 'right'"
        [class.handle-right]="side === 'left'"
        (mousedown)="onResizeStart($event)"
      ></div>

      <!-- Sidebar header -->
      <div class="sidebar-header">
        <div class="header-left">
          <svg class="ces-logo-sm" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <path d="M 15 20 Q 15 15 20 15 L 80 15 Q 85 15 85 20 L 85 60 Q 85 65 80 65 L 35 65 L 20 80 L 20 65 Q 15 65 15 60 Z"
                  fill="none" stroke="white" stroke-width="3"/>
            <g transform="translate(50, 40) scale(0.35)">
              <path d="M 0,-30 L 25,-15 L 25,15 L 0,30 L -25,15 L -25,-15 Z" fill="white"/>
            </g>
          </svg>
          <span class="header-title">CES Messenger</span>
        </div>
        <div class="header-actions">
          <button mat-icon-button class="hdr-btn" (click)="toggleSide()" [matTooltip]="'Move to ' + (side === 'right' ? 'left' : 'right')" matTooltipPosition="below">
            <mat-icon>{{ side === 'right' ? 'chevron_left' : 'chevron_right' }}</mat-icon>
          </button>
          <div class="btn-spacer"></div>
          <button mat-icon-button class="hdr-btn" (click)="close()" matTooltip="Close messenger" matTooltipPosition="below">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>

      <!-- View container -->
      <div class="sidebar-content">
        <app-inbox-list *ngIf="activeView === 'inbox'"></app-inbox-list>
        <app-chat-thread *ngIf="activeView === 'chat'"></app-chat-thread>
        <app-new-conversation *ngIf="activeView === 'new-conversation'"></app-new-conversation>
        <app-group-manager *ngIf="activeView === 'group-manager'"></app-group-manager>
      </div>

      <!-- Status bar -->
      <div class="ws-status" [class.connected]="wsStatus === 'authenticated'" [class.connecting]="wsStatus === 'connecting'">
        <div class="status-dot"></div>
        <span *ngIf="wsStatus === 'authenticated'">Connected</span>
        <span *ngIf="wsStatus === 'connecting'">Connecting...</span>
        <span *ngIf="wsStatus === 'disconnected'">Disconnected</span>
      </div>
    </div>
  `,
  styles: [`
    .sidebar {
      position: fixed;
      top: 0;
      bottom: 0;
      width: 400px;
      background: linear-gradient(180deg, #1F4BD8 0%, #173396 100%);
      z-index: 9999;
      display: flex;
      flex-direction: column;
      box-shadow: 0 0 40px rgba(23, 51, 150, 0.3);
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .sidebar.side-right {
      right: 0;
      transform: translateX(100%);
    }

    .sidebar.side-left {
      left: 0;
      transform: translateX(-100%);
    }

    .sidebar.open.side-right {
      transform: translateX(0);
    }

    .sidebar.open.side-left {
      transform: translateX(0);
    }

    /* ── Resize handle ── */
    .resize-handle {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 5px;
      cursor: ew-resize;
      z-index: 10;
      transition: background 0.15s;
    }

    .resize-handle:hover,
    .resize-handle:active {
      background: rgba(255, 255, 255, 0.15);
    }

    .resize-handle.handle-left {
      left: 0;
    }

    .resize-handle.handle-right {
      right: 0;
    }

    /* ── Header ── */
    .sidebar-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 12px 12px 16px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.15);
      flex-shrink: 0;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .ces-logo-sm {
      width: 28px;
      height: 28px;
    }

    .header-title {
      font-size: 16px;
      font-weight: 700;
      color: #fff;
      letter-spacing: 0.3px;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 0;
    }

    .btn-spacer {
      width: 12px;
    }

    .hdr-btn {
      width: 32px;
      height: 32px;
      border-radius: 6px !important;
      transition: background 0.15s, box-shadow 0.15s;
    }

    .hdr-btn:hover {
      background: rgba(255, 255, 255, 0.15) !important;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }

    .hdr-btn mat-icon {
      font-size: 20px;
      color: rgba(255, 255, 255, 0.85);
    }

    /* ── Content ── */
    .sidebar-content {
      flex: 1;
      overflow: hidden;
    }

    /* ── Status bar ── */
    .ws-status {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 16px;
      font-size: 11px;
      color: rgba(255, 255, 255, 0.6);
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      flex-shrink: 0;
    }

    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.4);
    }

    .ws-status.connected .status-dot {
      background: #22c55e;
    }

    .ws-status.connecting .status-dot {
      background: #f59e0b;
      animation: blink 1s infinite;
    }

    @keyframes blink {
      50% { opacity: 0.3; }
    }

    @media (max-width: 480px) {
      .sidebar {
        width: 100% !important;
      }
      .resize-handle {
        display: none;
      }
    }
  `],
})
export class ChatPanelComponent implements OnInit, OnDestroy {
  isOpen = false;
  activeView: 'inbox' | 'chat' | 'new-conversation' | 'group-manager' | 'conversation-settings' = 'inbox';
  wsStatus: string = 'disconnected';
  side: SidebarSide = 'right';
  sidebarWidth = 400;

  private defaultWidth = 400;
  private resizing = false;
  private resizeStartX = 0;
  private resizeStartWidth = 0;
  private boundResizeMove = this.onResizeMove.bind(this);
  private boundResizeEnd = this.onResizeEnd.bind(this);

  private sub!: Subscription;

  constructor(private store: MessagingStoreService) {}

  ngOnInit(): void {
    this.side = this.store.getSidebarSide();
    const saved = localStorage.getItem('messaging_sidebar_width');
    if (saved) this.sidebarWidth = parseInt(saved, 10) || this.defaultWidth;

    this.sub = combineLatest([
      this.store.panelOpen,
      this.store.activeView,
      this.store.wsStatus,
      this.store.sidebarSide,
    ]).subscribe(([open, view, ws, side]) => {
      this.isOpen = open;
      this.activeView = view;
      this.wsStatus = ws;
      this.side = side;
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    document.removeEventListener('mousemove', this.boundResizeMove);
    document.removeEventListener('mouseup', this.boundResizeEnd);
  }

  toggleSide(): void {
    this.store.toggleSidebarSide();
  }

  close(): void {
    this.store.closePanel();
  }

  // ── Resize ──
  onResizeStart(event: MouseEvent): void {
    event.preventDefault();
    this.resizing = true;
    this.resizeStartX = event.clientX;
    this.resizeStartWidth = this.sidebarWidth;
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', this.boundResizeMove);
    document.addEventListener('mouseup', this.boundResizeEnd);
  }

  private onResizeMove(event: MouseEvent): void {
    if (!this.resizing) return;
    const dx = event.clientX - this.resizeStartX;

    if (this.side === 'right') {
      this.sidebarWidth = Math.max(200, this.resizeStartWidth - dx);
    } else {
      this.sidebarWidth = Math.max(200, this.resizeStartWidth + dx);
    }

    this.sidebarWidth = Math.min(this.sidebarWidth, window.innerWidth * 0.9);
  }

  private onResizeEnd(): void {
    if (!this.resizing) return;
    this.resizing = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    document.removeEventListener('mousemove', this.boundResizeMove);
    document.removeEventListener('mouseup', this.boundResizeEnd);
    localStorage.setItem('messaging_sidebar_width', String(this.sidebarWidth));
  }
}
