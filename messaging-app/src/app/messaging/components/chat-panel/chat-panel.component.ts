import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { Subscription, combineLatest } from 'rxjs';
import { MessagingStoreService } from '../../services/messaging-store.service';
import { InboxListComponent } from '../inbox-list/inbox-list.component';
import { ChatThreadComponent } from '../chat-thread/chat-thread.component';
import { NewConversationComponent } from '../new-conversation/new-conversation.component';
import { GroupManagerComponent } from '../group-manager/group-manager.component';

@Component({
  selector: 'app-chat-panel',
  standalone: true,
  imports: [
    CommonModule, MatIconModule, MatButtonModule,
    InboxListComponent, ChatThreadComponent,
    NewConversationComponent, GroupManagerComponent,
  ],
  template: `
    <div
      class="chat-panel-backdrop"
      *ngIf="isOpen"
      (click)="close()"
    ></div>
    <div class="chat-panel" [class.open]="isOpen" [class.minimized]="isMinimized" [style.bottom.px]="panelBottom" [style.right.px]="panelRight" [style.left.px]="panelLeft" [style.top.px]="panelTop" [style.width.px]="panelWidth" [style.height.px]="panelHeight">
      <div *ngIf="isMinimized" class="minimized-bar" (click)="restore()">
        <mat-icon>chat</mat-icon>
        <span>Messages</span>
        <span *ngIf="unreadCount > 0" class="mini-badge">{{ unreadCount }}</span>
        <button mat-icon-button (click)="close(); $event.stopPropagation()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div *ngIf="!isMinimized && isOpen" class="panel-content">
        <div class="resize-handle-top" (mousedown)="onResizeStart($event, 'top')"></div>
        <div class="resize-handle-bottom" (mousedown)="onResizeStart($event, 'bottom')"></div>
        <div class="resize-handle-left" (mousedown)="onResizeStart($event, 'left')"></div>
        <div class="resize-handle-right" (mousedown)="onResizeStart($event, 'right')"></div>
        <div class="panel-toolbar">
          <button mat-icon-button (click)="minimize()" title="Minimize">
            <mat-icon>minimize</mat-icon>
          </button>
          <button mat-icon-button (click)="close()" title="Close">
            <mat-icon>close</mat-icon>
          </button>
        </div>

        <div class="view-container">
          <app-inbox-list *ngIf="activeView === 'inbox'"></app-inbox-list>
          <app-chat-thread *ngIf="activeView === 'chat'"></app-chat-thread>
          <app-new-conversation *ngIf="activeView === 'new-conversation'"></app-new-conversation>
          <app-group-manager *ngIf="activeView === 'group-manager'"></app-group-manager>
        </div>

        <div class="ws-status" [class.connected]="wsStatus === 'authenticated'" [class.connecting]="wsStatus === 'connecting'">
          <div class="status-dot"></div>
          <span *ngIf="wsStatus === 'authenticated'">Connected</span>
          <span *ngIf="wsStatus === 'connecting'">Connecting...</span>
          <span *ngIf="wsStatus === 'disconnected'">Disconnected</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .chat-panel-backdrop {
      position: fixed;
      inset: 0;
      z-index: 9998;
      background: transparent;
    }

    .chat-panel {
      position: fixed;
      min-width: 280px;
      max-width: 600px;
      min-height: 200px;
      max-height: 80vh;
      height: 0;
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 8px 40px rgba(0, 0, 0, 0.15), 0 2px 8px rgba(0, 0, 0, 0.08);
      z-index: 9999;
      overflow: hidden;
      transition: height 0.3s cubic-bezier(0.4, 0, 0.2, 1),
                  opacity 0.2s ease;
      opacity: 0;
      display: flex;
      flex-direction: column;
    }

    .chat-panel.open {
      opacity: 1;
    }

    .chat-panel.minimized {
      height: 48px !important;
      opacity: 1;
      border-radius: 24px;
      width: 240px !important;
    }

    .minimized-bar {
      display: flex;
      align-items: center;
      padding: 8px 8px 8px 16px;
      cursor: pointer;
      gap: 8px;
      height: 48px;
      box-sizing: border-box;
    }

    .minimized-bar mat-icon:first-child {
      color: #667eea;
      font-size: 20px;
    }

    .minimized-bar span {
      font-weight: 600;
      font-size: 14px;
      color: #1f2937;
      flex: 1;
    }

    .mini-badge {
      background: #ef4444;
      color: #fff !important;
      border-radius: 10px;
      min-width: 20px;
      height: 20px;
      font-size: 11px !important;
      font-weight: 600 !important;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 6px;
      flex: none !important;
    }

    .minimized-bar button mat-icon {
      font-size: 18px;
      color: #9ca3af;
    }

    .panel-content {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .panel-toolbar {
      display: flex;
      justify-content: flex-end;
      padding: 4px 4px 0;
      gap: 2px;
    }

    .panel-toolbar button {
      width: 32px;
      height: 32px;
    }

    .panel-toolbar mat-icon {
      font-size: 18px;
      color: #9ca3af;
    }

    .view-container {
      flex: 1;
      overflow: hidden;
    }

    .ws-status {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 16px;
      font-size: 11px;
      color: #9ca3af;
      border-top: 1px solid #f3f4f6;
    }

    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #9ca3af;
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

    .resize-handle-top,
    .resize-handle-bottom {
      position: absolute;
      left: 0;
      right: 0;
      height: 4px;
      cursor: ns-resize;
      z-index: 10;
    }

    .resize-handle-top {
      top: 0;
    }

    .resize-handle-bottom {
      bottom: 0;
    }

    .resize-handle-left,
    .resize-handle-right {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 4px;
      cursor: ew-resize;
      z-index: 10;
    }

    .resize-handle-left {
      left: 0;
    }

    .resize-handle-right {
      right: 0;
    }

    .resize-handle-top:hover,
    .resize-handle-bottom:hover,
    .resize-handle-left:hover,
    .resize-handle-right:hover {
      background: rgba(102, 126, 234, 0.2);
    }

    @media (max-width: 480px) {
      .chat-panel {
        right: 0;
        bottom: 0;
        width: 100%;
        border-radius: 16px 16px 0 0;
      }

      .chat-panel.open {
        height: 100vh;
        height: 100dvh;
        border-radius: 0;
      }

      .chat-panel.minimized {
        width: 100%;
        border-radius: 0;
      }
    }
  `],
})
export class ChatPanelComponent implements OnInit, OnDestroy {
  isOpen = false;
  isMinimized = false;
  activeView: 'inbox' | 'chat' | 'new-conversation' | 'group-manager' = 'inbox';
  wsStatus: 'disconnected' | 'connecting' | 'connected' | 'authenticated' = 'disconnected';
  unreadCount = 0;
  panelBottom: number | null = null;
  panelRight: number | null = null;
  panelLeft: number | null = null;
  panelTop: number | null = null;
  panelWidth = 380;
  panelHeight = 560;

  private resizing = false;
  private resizeEdge: 'top' | 'bottom' | 'left' | 'right' | null = null;
  private resizeStartX = 0;
  private resizeStartY = 0;
  private resizeStartWidth = 0;
  private resizeStartHeight = 0;
  private resizeStartPanelTop = 0;
  private resizeStartPanelBottom = 0;
  private resizeStartPanelLeft = 0;
  private resizeStartPanelRight = 0;
  private boundResizeMove = this.onResizeMove.bind(this);
  private boundResizeEnd = this.onResizeEnd.bind(this);

  private sub!: Subscription;

  constructor(private store: MessagingStoreService) {}

  ngOnInit(): void {
    const savedSize = this.store.getPanelSize();
    this.panelWidth = savedSize.width;
    this.panelHeight = savedSize.height;

    this.sub = combineLatest([
      this.store.panelOpen,
      this.store.activeView,
      this.store.wsStatus,
      this.store.totalUnread,
      this.store.panelPosition,
      this.store.panelSize,
    ]).subscribe(([open, view, ws, unread, position, size]) => {
      this.isOpen = open || this.isMinimized;
      this.activeView = view;
      this.wsStatus = ws;
      this.unreadCount = unread;
      this.panelWidth = size.width;
      this.panelHeight = size.height;
      this.updatePanelPosition(position);
    });
  }

  private updatePanelPosition(position: { x: number; y: number } | null): void {
    if (!position) {
      this.panelBottom = 90;
      this.panelRight = 20;
      this.panelLeft = null;
      this.panelTop = null;
      return;
    }

    const buttonX = position.x;
    const buttonY = position.y;
    const buttonSize = 56;
    const minimizedHeight = 48;
    const gap = 20;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    const height = this.isMinimized ? minimizedHeight : this.panelHeight;
    const width = this.isMinimized ? 240 : this.panelWidth;

    const isRightSide = buttonX > windowWidth / 2;
    const isBottomHalf = buttonY > windowHeight / 2;

    if (isRightSide) {
      const spaceOnRight = windowWidth - (buttonX + buttonSize);
      if (spaceOnRight >= width + gap) {
        this.panelRight = windowWidth - buttonX - buttonSize - gap;
        this.panelLeft = null;
      } else {
        this.panelLeft = Math.max(gap, buttonX - width - gap);
        this.panelRight = null;
      }
    } else {
      const spaceOnLeft = buttonX;
      if (spaceOnLeft >= width + gap) {
        this.panelLeft = Math.max(gap, buttonX - width - gap);
        this.panelRight = null;
      } else {
        this.panelRight = Math.max(gap, windowWidth - (buttonX + buttonSize) - gap);
        this.panelLeft = null;
      }
    }

    if (isBottomHalf) {
      const spaceBelow = windowHeight - (buttonY + buttonSize);
      if (spaceBelow >= height + gap) {
        this.panelBottom = windowHeight - buttonY - buttonSize - gap;
        this.panelTop = null;
      } else {
        this.panelTop = Math.max(gap, buttonY - height - gap);
        this.panelBottom = null;
      }
    } else {
      const spaceAbove = buttonY;
      if (spaceAbove >= height + gap) {
        this.panelTop = Math.max(gap, buttonY - height - gap);
        this.panelBottom = null;
      } else {
        this.panelBottom = Math.max(gap, windowHeight - (buttonY + buttonSize) - gap);
        this.panelTop = null;
      }
    }

    if (this.panelRight !== null && this.panelRight + width > windowWidth - gap) {
      this.panelRight = gap;
    }
    if (this.panelLeft !== null && this.panelLeft + width > windowWidth - gap) {
      this.panelLeft = Math.max(gap, windowWidth - width - gap);
    }
    if (this.panelBottom !== null && this.panelBottom + height > windowHeight - gap) {
      this.panelBottom = gap;
    }
    if (this.panelTop !== null && this.panelTop + height > windowHeight - gap) {
      this.panelTop = Math.max(gap, windowHeight - height - gap);
    }
  }

  onResizeStart(event: MouseEvent, edge: 'top' | 'bottom' | 'left' | 'right'): void {
    event.preventDefault();
    event.stopPropagation();
    this.resizing = true;
    this.resizeEdge = edge;
    this.resizeStartX = event.clientX;
    this.resizeStartY = event.clientY;
    this.resizeStartWidth = this.panelWidth;
    this.resizeStartHeight = this.panelHeight;
    this.resizeStartPanelTop = this.panelTop ?? 0;
    this.resizeStartPanelBottom = this.panelBottom ?? 0;
    this.resizeStartPanelLeft = this.panelLeft ?? 0;
    this.resizeStartPanelRight = this.panelRight ?? 0;
    document.addEventListener('mousemove', this.boundResizeMove);
    document.addEventListener('mouseup', this.boundResizeEnd);
  }

  onResizeMove(event: MouseEvent): void {
    if (!this.resizing || !this.resizeEdge) return;

    const deltaX = event.clientX - this.resizeStartX;
    const deltaY = event.clientY - this.resizeStartY;

    switch (this.resizeEdge) {
      case 'top':
        if (this.panelTop !== null) {
          const newHeight = this.resizeStartHeight - deltaY;
          if (newHeight >= 200 && newHeight <= window.innerHeight * 0.8) {
            this.panelHeight = newHeight;
            this.panelTop = this.resizeStartPanelTop + deltaY;
          }
        } else if (this.panelBottom !== null) {
          const newHeight = this.resizeStartHeight + deltaY;
          if (newHeight >= 200 && newHeight <= window.innerHeight * 0.8) {
            this.panelHeight = newHeight;
          }
        }
        break;

      case 'bottom':
        if (this.panelBottom !== null) {
          const newHeight = this.resizeStartHeight - deltaY;
          if (newHeight >= 200 && newHeight <= window.innerHeight * 0.8) {
            this.panelHeight = newHeight;
            this.panelBottom = this.resizeStartPanelBottom + deltaY;
          }
        } else if (this.panelTop !== null) {
          const newHeight = this.resizeStartHeight + deltaY;
          if (newHeight >= 200 && newHeight <= window.innerHeight * 0.8) {
            this.panelHeight = newHeight;
          }
        }
        break;

      case 'left':
        if (this.panelLeft !== null) {
          const newWidth = this.resizeStartWidth - deltaX;
          if (newWidth >= 280 && newWidth <= 600) {
            this.panelWidth = newWidth;
            this.panelLeft = this.resizeStartPanelLeft + deltaX;
          }
        } else if (this.panelRight !== null) {
          const newWidth = this.resizeStartWidth + deltaX;
          if (newWidth >= 280 && newWidth <= 600) {
            this.panelWidth = newWidth;
          }
        }
        break;

      case 'right':
        if (this.panelRight !== null) {
          const newWidth = this.resizeStartWidth - deltaX;
          if (newWidth >= 280 && newWidth <= 600) {
            this.panelWidth = newWidth;
            this.panelRight = this.resizeStartPanelRight + deltaX;
          }
        } else if (this.panelLeft !== null) {
          const newWidth = this.resizeStartWidth + deltaX;
          if (newWidth >= 280 && newWidth <= 600) {
            this.panelWidth = newWidth;
          }
        }
        break;
    }
  }

  onResizeEnd(): void {
    if (this.resizing) {
      this.resizing = false;
      this.resizeEdge = null;
      document.removeEventListener('mousemove', this.boundResizeMove);
      document.removeEventListener('mouseup', this.boundResizeEnd);
      this.store.setPanelSize(this.panelWidth, this.panelHeight);
    }
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    document.removeEventListener('mousemove', this.boundResizeMove);
    document.removeEventListener('mouseup', this.boundResizeEnd);
  }

  minimize(): void {
    this.isMinimized = true;
    this.store.closePanel();
  }

  restore(): void {
    this.isMinimized = false;
    this.store.openPanel();
  }

  close(): void {
    this.isMinimized = false;
    this.store.closePanel();
  }
}
