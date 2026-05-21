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
          <span
            class="status-dot"
            [class.connected]="wsStatus === 'authenticated'"
            [class.connecting]="wsStatus === 'connecting'"
            [class.disconnected]="wsStatus === 'disconnected'"
            [matTooltip]="getStatusTooltip()"
            matTooltipPosition="below"
          ></span>
          <span class="header-title">Messages</span>
        </div>
        <div class="header-actions">
          <button
            *ngIf="activeView === 'inbox'"
            mat-icon-button
            class="hdr-btn"
            (click)="openNewConversation()"
            matTooltip="New conversation"
            matTooltipPosition="below"
          >
            <mat-icon>edit_square</mat-icon>
          </button>
          <button
            *ngIf="activeView === 'inbox'"
            mat-icon-button
            class="hdr-btn"
            (click)="openGroupManager()"
            matTooltip="Create group"
            matTooltipPosition="below"
          >
            <mat-icon>group_add</mat-icon>
          </button>
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
        <app-chat-thread
          *ngIf="activeView === 'chat'"
          (lightboxOpen)="openLightbox($event)"
        ></app-chat-thread>
        <app-new-conversation *ngIf="activeView === 'new-conversation'"></app-new-conversation>
        <app-group-manager *ngIf="activeView === 'group-manager'"></app-group-manager>
      </div>

      <!-- Resize corner (floating mode only) -->
      <div *ngIf="isFloating" class="float-resize-corner" (mousedown)="onFloatResizeStart($event)"></div>
    </div>

    <!-- ── Lightbox: sibling of .sidebar so position:fixed is relative to viewport ── -->
    <div
      *ngIf="lightboxUrl"
      class="lb-overlay"
      [class.lb-detached]="lightboxDetached"
      [style.left.px]="lightboxDetached ? lightboxX : null"
      [style.top.px]="lightboxDetached ? lightboxY : null"
      [style.width.px]="lightboxDetached ? lightboxW : null"
      [style.height.px]="lightboxDetached ? lightboxH : null"
      (click)="onLightboxBackdropClick($event)"
    >
      <div *ngIf="lightboxDetached" class="lb-drag-bar" (mousedown)="onLbDragStart($event)">
        <span class="lb-drag-title">Image viewer</span>
        <div class="lb-drag-actions">
          <button type="button" class="lb-action-btn"
            (click)="$event.stopPropagation(); lightboxDetached = false" title="Fullscreen">
            <mat-icon>fullscreen</mat-icon>
          </button>
          <button type="button" class="lb-action-btn"
            (click)="$event.stopPropagation(); lightboxUrl = null; lightboxDetached = false" title="Close">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>
      <img [src]="lightboxUrl" class="lb-img" [class.lb-img-detached]="lightboxDetached"
           (click)="$event.stopPropagation()" />
      <ng-container *ngIf="!lightboxDetached">
        <button class="lb-close" (click)="lightboxUrl = null"><mat-icon>close</mat-icon></button>
        <button class="lb-detach-btn" (click)="detachLightbox()" title="Detach to floating window">
          <mat-icon>picture_in_picture</mat-icon>
        </button>
      </ng-container>
      <div *ngIf="lightboxDetached" class="lb-resize-corner" (mousedown)="onLbResizeStart($event)"></div>
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
      padding: 8px 10px 8px 14px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.15);
      flex-shrink: 0;
      position: relative;
      z-index: 2;
      min-height: 48px;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }

    .header-title {
      font-size: 16px;
      font-weight: 700;
      color: #fff;
      letter-spacing: 0.3px;
      white-space: nowrap;
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

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.4);
      flex-shrink: 0;
    }

    .status-dot.connected {
      background: #22c55e;
      box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.18);
    }

    .status-dot.connecting {
      background: #f59e0b;
      animation: blink 1s infinite;
    }

    .status-dot.disconnected {
      background: #ef4444;
      box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.14);
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

    /* ── Lightbox (outside .sidebar so position:fixed is viewport-relative) ── */
    .lb-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.88);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 99999;
      cursor: pointer;
    }

    .lb-overlay.lb-detached {
      inset: unset;
      background: #0c1f35;
      border: 1px solid rgba(255,255,255,0.18);
      border-radius: 12px;
      box-shadow: 0 12px 48px rgba(0,0,0,0.7);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      cursor: default;
      min-width: 240px;
      min-height: 200px;
    }

    .lb-drag-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 8px 6px 12px;
      background: #041322;
      border-bottom: 1px solid rgba(255,255,255,0.12);
      cursor: grab;
      flex-shrink: 0;
      user-select: none;
    }
    .lb-drag-bar:active { cursor: grabbing; }

    .lb-drag-title { font-size: 12px; color: rgba(255,255,255,0.6); letter-spacing: 0.4px; }
    .lb-drag-actions { display: flex; gap: 2px; }

    .lb-action-btn {
      background: transparent;
      border: none;
      border-radius: 6px;
      width: 28px; height: 28px;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer;
      color: rgba(255,255,255,0.7);
      transition: background 0.15s;
    }
    .lb-action-btn:hover { background: rgba(255,255,255,0.15); }
    .lb-action-btn mat-icon { font-size: 16px; width: 16px; height: 16px; }

    .lb-img {
      max-width: 92vw; max-height: 92vh;
      border-radius: 8px;
      box-shadow: 0 8px 40px rgba(0,0,0,0.6);
      cursor: default;
    }
    .lb-img.lb-img-detached {
      max-width: 100%; max-height: 100%;
      border-radius: 0; box-shadow: none;
      object-fit: contain; flex: 1;
    }

    .lb-close {
      position: absolute; top: 16px; right: 16px;
      background: rgba(255,255,255,0.15); border: none; border-radius: 50%;
      width: 36px; height: 36px;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; color: #fff; transition: background 0.15s;
    }
    .lb-close:hover { background: rgba(255,255,255,0.3); }

    .lb-detach-btn {
      position: absolute; top: 16px; right: 60px;
      background: rgba(255,255,255,0.15); border: none; border-radius: 50%;
      width: 36px; height: 36px;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; color: #fff; transition: background 0.15s;
    }
    .lb-detach-btn:hover { background: rgba(255,255,255,0.3); }

    .lb-resize-corner {
      position: absolute; bottom: 0; right: 0;
      width: 16px; height: 16px;
      cursor: se-resize;
      background: linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.2) 50%);
      border-bottom-right-radius: 12px;
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

  // ── Lightbox state ──
  lightboxUrl: string | null = null;
  lightboxDetached = false;
  lightboxX = 100;
  lightboxY = 80;
  lightboxW = 560;
  lightboxH = 460;
  private lbDragging = false;
  private lbDragOffX = 0;
  private lbDragOffY = 0;
  private lbResizing = false;
  private lbResizeStartX = 0;
  private lbResizeStartY = 0;
  private lbResizeStartW = 0;
  private lbResizeStartH = 0;
  private boundLbMove        = this.onLbDragMove.bind(this);
  private boundLbEnd         = this.onLbDragEnd.bind(this);
  private boundLbResizeMove  = this.onLbResizeMove.bind(this);
  private boundLbResizeEnd   = this.onLbResizeEnd.bind(this);

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
    document.removeEventListener('mousemove', this.boundLbMove);
    document.removeEventListener('mouseup', this.boundLbEnd);
    document.removeEventListener('mousemove', this.boundLbResizeMove);
    document.removeEventListener('mouseup', this.boundLbResizeEnd);
  }

  // ── Lightbox ──
  openLightbox(url: string): void {
    this.lightboxUrl = url;
    this.lightboxDetached = false;
  }

  onLightboxBackdropClick(event: MouseEvent): void {
    if (this.lightboxDetached) return;
    if (event.target !== event.currentTarget) return;
    this.lightboxUrl = null;
  }

  detachLightbox(): void {
    this.lightboxDetached = true;
    this.lightboxX = Math.max(20, Math.round((window.innerWidth  - this.lightboxW) / 2));
    this.lightboxY = Math.max(20, Math.round((window.innerHeight - this.lightboxH) / 2));
  }

  onLbDragStart(event: MouseEvent): void {
    if ((event.target as HTMLElement).closest('button')) return;
    event.preventDefault();
    this.lbDragging = true;
    this.lbDragOffX = event.clientX - this.lightboxX;
    this.lbDragOffY = event.clientY - this.lightboxY;
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', this.boundLbMove);
    document.addEventListener('mouseup',   this.boundLbEnd);
  }

  private onLbDragMove(event: MouseEvent): void {
    if (!this.lbDragging) return;
    this.lightboxX = Math.max(0, Math.min(event.clientX - this.lbDragOffX, window.innerWidth  - this.lightboxW));
    this.lightboxY = Math.max(0, Math.min(event.clientY - this.lbDragOffY, window.innerHeight - 60));
  }

  private onLbDragEnd(): void {
    if (!this.lbDragging) return;
    this.lbDragging = false;
    document.body.style.userSelect = '';
    document.removeEventListener('mousemove', this.boundLbMove);
    document.removeEventListener('mouseup',   this.boundLbEnd);
  }

  onLbResizeStart(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.lbResizing = true;
    this.lbResizeStartX = event.clientX;
    this.lbResizeStartY = event.clientY;
    this.lbResizeStartW = this.lightboxW;
    this.lbResizeStartH = this.lightboxH;
    document.body.style.cursor = 'se-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', this.boundLbResizeMove);
    document.addEventListener('mouseup',   this.boundLbResizeEnd);
  }

  private onLbResizeMove(event: MouseEvent): void {
    if (!this.lbResizing) return;
    this.lightboxW = Math.max(240, this.lbResizeStartW + (event.clientX - this.lbResizeStartX));
    this.lightboxH = Math.max(200, this.lbResizeStartH + (event.clientY - this.lbResizeStartY));
  }

  private onLbResizeEnd(): void {
    if (!this.lbResizing) return;
    this.lbResizing = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    document.removeEventListener('mousemove', this.boundLbResizeMove);
    document.removeEventListener('mouseup',   this.boundLbResizeEnd);
  }

  toggleSide(): void {
    this.store.toggleSidebarSide();
  }

  openNewConversation(): void {
    this.store.setView('new-conversation');
  }

  openGroupManager(): void {
    this.store.setView('group-manager');
  }

  getStatusTooltip(): string {
    if (this.wsStatus === 'authenticated') return 'Connected';
    if (this.wsStatus === 'connecting') return 'Connecting';
    return 'Disconnected';
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
