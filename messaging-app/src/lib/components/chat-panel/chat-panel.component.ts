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
    <!-- Sidebar / Floating panel -->
    <div
      class="sidebar"
      [class.open]="isOpen"
      [class.side-left]="!isFloating && side === 'left'"
      [class.side-right]="!isFloating && side === 'right'"
      [class.floating]="isFloating"
      [style.width.px]="isFloating ? floatWidth : sidebarWidth"
      [style.height.px]="isFloating ? floatHeight : null"
      [style.left.px]="isFloating ? floatX : null"
      [style.top.px]="isFloating ? floatY : null"
    >
      <!-- Resize handle (sidebar mode only) -->
      <div
        *ngIf="!isFloating"
        class="resize-handle"
        [class.handle-left]="side === 'right'"
        [class.handle-right]="side === 'left'"
        (mousedown)="onResizeStart($event)"
      ></div>

      <!-- Sidebar header (acts as drag handle in floating mode) -->
      <div
        class="sidebar-header"
        [class.drag-handle]="isFloating"
        (mousedown)="isFloating && onFloatDragStart($event)"
      >
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
          <!-- Side-swap (sidebar mode only) -->
          <button *ngIf="!isFloating" mat-icon-button class="hdr-btn" (click)="toggleSide()"
            [matTooltip]="'Move to ' + (side === 'right' ? 'left' : 'right')" matTooltipPosition="below">
            <mat-icon>{{ side === 'right' ? 'chevron_left' : 'chevron_right' }}</mat-icon>
          </button>
          <!-- Pop-out / dock toggle -->
          <button mat-icon-button class="hdr-btn"
            (click)="toggleFloat()"
            [matTooltip]="isFloating ? 'Dock to sidebar' : 'Pop out to floating window'"
            matTooltipPosition="below">
            <mat-icon>{{ isFloating ? 'picture_in_picture_alt' : 'open_in_new' }}</mat-icon>
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

      <!-- Resize corner (floating mode only) -->
      <div *ngIf="isFloating" class="float-resize-corner" (mousedown)="onFloatResizeStart($event)"></div>
    </div>
  `,
  styles: [`
    .sidebar {
      position: fixed;
      top: 0;
      bottom: 0;
      width: 400px;
      background: #041322;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      box-shadow: 0 0 40px rgba(0, 0, 0, 0.6);
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

    /* ── Resize handle (below header so header controls stay clickable) ── */
    .resize-handle {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 5px;
      cursor: ew-resize;
      z-index: 1;
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
      position: relative;
      z-index: 2;
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
      min-width: 32px;
      padding: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px !important;
      transition: background 0.15s, box-shadow 0.15s;
      --mdc-icon-button-state-layer-size: 32px;
    }

    .hdr-btn .mat-mdc-button-touch-target {
      width: 32px;
      height: 32px;
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

    /* ── Floating mode ── */
    .sidebar.floating {
      position: fixed !important;
      right: unset !important;
      left: 80px;
      top: 80px;
      transform: none !important;
      border-radius: 12px;
      overflow: hidden;
      resize: none;
      min-width: 280px;
      min-height: 320px;
    }

    .drag-handle {
      cursor: grab;
      user-select: none;
    }

    .drag-handle:active {
      cursor: grabbing;
    }

    .float-resize-corner {
      position: absolute;
      bottom: 0;
      right: 0;
      width: 16px;
      height: 16px;
      cursor: se-resize;
      background: linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.25) 50%);
      border-bottom-right-radius: 12px;
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

  // ── Floating window state ──
  isFloating = false;
  floatX = 80;
  floatY = 80;
  floatWidth = 380;
  floatHeight = 540;

  private defaultWidth = 400;
  private resizing = false;
  private resizeStartX = 0;
  private resizeStartWidth = 0;
  private boundResizeMove = this.onResizeMove.bind(this);
  private boundResizeEnd = this.onResizeEnd.bind(this);

  // float drag
  private floatDragging = false;
  private floatDragOffX = 0;
  private floatDragOffY = 0;
  private boundFloatMove = this.onFloatDragMove.bind(this);
  private boundFloatEnd  = this.onFloatDragEnd.bind(this);

  // float resize
  private floatResizing = false;
  private floatResizeStartX = 0;
  private floatResizeStartY = 0;
  private floatResizeStartW = 0;
  private floatResizeStartH = 0;
  private boundFloatResizeMove = this.onFloatResizeMove.bind(this);
  private boundFloatResizeEnd  = this.onFloatResizeEnd.bind(this);

  private sub!: Subscription;

  constructor(private store: MessagingStoreService) {}

  ngOnInit(): void {
    this.side = this.store.getSidebarSide();
    const saved = localStorage.getItem('messaging_sidebar_width');
    if (saved) this.sidebarWidth = parseInt(saved, 10) || this.defaultWidth;

    const savedFloat = localStorage.getItem('messaging_float_state');
    if (savedFloat) {
      try {
        const f = JSON.parse(savedFloat);
        this.isFloating = f.isFloating ?? false;
        this.floatX = f.x ?? 80;
        this.floatY = f.y ?? 80;
        this.floatWidth = f.w ?? 380;
        this.floatHeight = f.h ?? 540;
      } catch {}
    }

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
    document.removeEventListener('mousemove', this.boundFloatMove);
    document.removeEventListener('mouseup', this.boundFloatEnd);
    document.removeEventListener('mousemove', this.boundFloatResizeMove);
    document.removeEventListener('mouseup', this.boundFloatResizeEnd);
  }

  toggleSide(): void {
    this.store.toggleSidebarSide();
  }

  close(): void {
    this.store.closePanel();
  }

  toggleFloat(): void {
    this.isFloating = !this.isFloating;
    if (this.isFloating) {
      // Centre the float window on screen when first popping out
      this.floatX = Math.max(20, Math.round((window.innerWidth  - this.floatWidth)  / 2));
      this.floatY = Math.max(20, Math.round((window.innerHeight - this.floatHeight) / 2));
    }
    this.saveFloatState();
  }

  // ── Sidebar resize ──
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

  // ── Floating panel drag ──
  onFloatDragStart(event: MouseEvent): void {
    // Ignore if coming from a button inside the header
    if ((event.target as HTMLElement).closest('button')) return;
    event.preventDefault();
    this.floatDragging = true;
    this.floatDragOffX = event.clientX - this.floatX;
    this.floatDragOffY = event.clientY - this.floatY;
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', this.boundFloatMove);
    document.addEventListener('mouseup', this.boundFloatEnd);
  }

  private onFloatDragMove(event: MouseEvent): void {
    if (!this.floatDragging) return;
    this.floatX = Math.max(0, Math.min(event.clientX - this.floatDragOffX, window.innerWidth  - this.floatWidth));
    this.floatY = Math.max(0, Math.min(event.clientY - this.floatDragOffY, window.innerHeight - 60));
  }

  private onFloatDragEnd(): void {
    if (!this.floatDragging) return;
    this.floatDragging = false;
    document.body.style.userSelect = '';
    document.removeEventListener('mousemove', this.boundFloatMove);
    document.removeEventListener('mouseup', this.boundFloatEnd);
    this.saveFloatState();
  }

  // ── Floating panel resize (SE corner) ──
  onFloatResizeStart(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.floatResizing = true;
    this.floatResizeStartX = event.clientX;
    this.floatResizeStartY = event.clientY;
    this.floatResizeStartW = this.floatWidth;
    this.floatResizeStartH = this.floatHeight;
    document.body.style.cursor = 'se-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', this.boundFloatResizeMove);
    document.addEventListener('mouseup', this.boundFloatResizeEnd);
  }

  private onFloatResizeMove(event: MouseEvent): void {
    if (!this.floatResizing) return;
    this.floatWidth  = Math.max(280, this.floatResizeStartW + (event.clientX - this.floatResizeStartX));
    this.floatHeight = Math.max(320, this.floatResizeStartH + (event.clientY - this.floatResizeStartY));
  }

  private onFloatResizeEnd(): void {
    if (!this.floatResizing) return;
    this.floatResizing = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    document.removeEventListener('mousemove', this.boundFloatResizeMove);
    document.removeEventListener('mouseup', this.boundFloatResizeEnd);
    this.saveFloatState();
  }

  private saveFloatState(): void {
    localStorage.setItem('messaging_float_state', JSON.stringify({
      isFloating: this.isFloating,
      x: this.floatX,
      y: this.floatY,
      w: this.floatWidth,
      h: this.floatHeight,
    }));
  }
}
