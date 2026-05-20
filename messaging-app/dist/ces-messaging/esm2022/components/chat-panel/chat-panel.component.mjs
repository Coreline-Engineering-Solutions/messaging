import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { combineLatest } from 'rxjs';
import { InboxListComponent } from '../inbox-list/inbox-list.component';
import { ChatThreadComponent } from '../chat-thread/chat-thread.component';
import { NewConversationComponent } from '../new-conversation/new-conversation.component';
import { GroupManagerComponent } from '../group-manager/group-manager.component';
import * as i0 from "@angular/core";
import * as i1 from "../../services/messaging-store.service";
import * as i2 from "@angular/common";
import * as i3 from "@angular/material/icon";
import * as i4 from "@angular/material/button";
import * as i5 from "@angular/material/tooltip";
export class ChatPanelComponent {
    store;
    isOpen = false;
    activeView = 'inbox';
    wsStatus = 'disconnected';
    side = 'right';
    sidebarWidth = 400;
    // ── Floating window state ──
    isFloating = false;
    floatX = 80;
    floatY = 80;
    floatWidth = 380;
    floatHeight = 540;
    defaultWidth = 400;
    resizing = false;
    resizeStartX = 0;
    resizeStartWidth = 0;
    boundResizeMove = this.onResizeMove.bind(this);
    boundResizeEnd = this.onResizeEnd.bind(this);
    // float drag
    floatDragging = false;
    floatDragOffX = 0;
    floatDragOffY = 0;
    boundFloatMove = this.onFloatDragMove.bind(this);
    boundFloatEnd = this.onFloatDragEnd.bind(this);
    // float resize
    floatResizing = false;
    floatResizeStartX = 0;
    floatResizeStartY = 0;
    floatResizeStartW = 0;
    floatResizeStartH = 0;
    boundFloatResizeMove = this.onFloatResizeMove.bind(this);
    boundFloatResizeEnd = this.onFloatResizeEnd.bind(this);
    sub;
    // ── Lightbox state ──
    lightboxUrl = null;
    lightboxDetached = false;
    lightboxX = 100;
    lightboxY = 80;
    lightboxW = 560;
    lightboxH = 460;
    lbDragging = false;
    lbDragOffX = 0;
    lbDragOffY = 0;
    lbResizing = false;
    lbResizeStartX = 0;
    lbResizeStartY = 0;
    lbResizeStartW = 0;
    lbResizeStartH = 0;
    boundLbMove = this.onLbDragMove.bind(this);
    boundLbEnd = this.onLbDragEnd.bind(this);
    boundLbResizeMove = this.onLbResizeMove.bind(this);
    boundLbResizeEnd = this.onLbResizeEnd.bind(this);
    constructor(store) {
        this.store = store;
    }
    ngOnInit() {
        this.side = this.store.getSidebarSide();
        const saved = localStorage.getItem('messaging_sidebar_width');
        if (saved)
            this.sidebarWidth = parseInt(saved, 10) || this.defaultWidth;
        const savedFloat = localStorage.getItem('messaging_float_state');
        if (savedFloat) {
            try {
                const f = JSON.parse(savedFloat);
                this.isFloating = f.isFloating ?? false;
                this.floatX = f.x ?? 80;
                this.floatY = f.y ?? 80;
                this.floatWidth = f.w ?? 380;
                this.floatHeight = f.h ?? 540;
            }
            catch { }
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
    ngOnDestroy() {
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
    openLightbox(url) {
        this.lightboxUrl = url;
        this.lightboxDetached = false;
    }
    onLightboxBackdropClick(event) {
        if (this.lightboxDetached)
            return;
        if (event.target !== event.currentTarget)
            return;
        this.lightboxUrl = null;
    }
    detachLightbox() {
        this.lightboxDetached = true;
        this.lightboxX = Math.max(20, Math.round((window.innerWidth - this.lightboxW) / 2));
        this.lightboxY = Math.max(20, Math.round((window.innerHeight - this.lightboxH) / 2));
    }
    onLbDragStart(event) {
        if (event.target.closest('button'))
            return;
        event.preventDefault();
        this.lbDragging = true;
        this.lbDragOffX = event.clientX - this.lightboxX;
        this.lbDragOffY = event.clientY - this.lightboxY;
        document.body.style.userSelect = 'none';
        document.addEventListener('mousemove', this.boundLbMove);
        document.addEventListener('mouseup', this.boundLbEnd);
    }
    onLbDragMove(event) {
        if (!this.lbDragging)
            return;
        this.lightboxX = Math.max(0, Math.min(event.clientX - this.lbDragOffX, window.innerWidth - this.lightboxW));
        this.lightboxY = Math.max(0, Math.min(event.clientY - this.lbDragOffY, window.innerHeight - 60));
    }
    onLbDragEnd() {
        if (!this.lbDragging)
            return;
        this.lbDragging = false;
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', this.boundLbMove);
        document.removeEventListener('mouseup', this.boundLbEnd);
    }
    onLbResizeStart(event) {
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
        document.addEventListener('mouseup', this.boundLbResizeEnd);
    }
    onLbResizeMove(event) {
        if (!this.lbResizing)
            return;
        this.lightboxW = Math.max(240, this.lbResizeStartW + (event.clientX - this.lbResizeStartX));
        this.lightboxH = Math.max(200, this.lbResizeStartH + (event.clientY - this.lbResizeStartY));
    }
    onLbResizeEnd() {
        if (!this.lbResizing)
            return;
        this.lbResizing = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', this.boundLbResizeMove);
        document.removeEventListener('mouseup', this.boundLbResizeEnd);
    }
    toggleSide() {
        this.store.toggleSidebarSide();
    }
    close() {
        this.store.closePanel();
    }
    toggleFloat() {
        this.isFloating = !this.isFloating;
        if (this.isFloating) {
            // Centre the float window on screen when first popping out
            this.floatX = Math.max(20, Math.round((window.innerWidth - this.floatWidth) / 2));
            this.floatY = Math.max(20, Math.round((window.innerHeight - this.floatHeight) / 2));
        }
        this.saveFloatState();
    }
    // ── Sidebar resize ──
    onResizeStart(event) {
        event.preventDefault();
        this.resizing = true;
        this.resizeStartX = event.clientX;
        this.resizeStartWidth = this.sidebarWidth;
        document.body.style.cursor = 'ew-resize';
        document.body.style.userSelect = 'none';
        document.addEventListener('mousemove', this.boundResizeMove);
        document.addEventListener('mouseup', this.boundResizeEnd);
    }
    onResizeMove(event) {
        if (!this.resizing)
            return;
        const dx = event.clientX - this.resizeStartX;
        if (this.side === 'right') {
            this.sidebarWidth = Math.max(200, this.resizeStartWidth - dx);
        }
        else {
            this.sidebarWidth = Math.max(200, this.resizeStartWidth + dx);
        }
        this.sidebarWidth = Math.min(this.sidebarWidth, window.innerWidth * 0.9);
    }
    onResizeEnd() {
        if (!this.resizing)
            return;
        this.resizing = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', this.boundResizeMove);
        document.removeEventListener('mouseup', this.boundResizeEnd);
        localStorage.setItem('messaging_sidebar_width', String(this.sidebarWidth));
    }
    // ── Floating panel drag ──
    onFloatDragStart(event) {
        // Ignore if coming from a button inside the header
        if (event.target.closest('button'))
            return;
        event.preventDefault();
        this.floatDragging = true;
        this.floatDragOffX = event.clientX - this.floatX;
        this.floatDragOffY = event.clientY - this.floatY;
        document.body.style.userSelect = 'none';
        document.addEventListener('mousemove', this.boundFloatMove);
        document.addEventListener('mouseup', this.boundFloatEnd);
    }
    onFloatDragMove(event) {
        if (!this.floatDragging)
            return;
        this.floatX = Math.max(0, Math.min(event.clientX - this.floatDragOffX, window.innerWidth - this.floatWidth));
        this.floatY = Math.max(0, Math.min(event.clientY - this.floatDragOffY, window.innerHeight - 60));
    }
    onFloatDragEnd() {
        if (!this.floatDragging)
            return;
        this.floatDragging = false;
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', this.boundFloatMove);
        document.removeEventListener('mouseup', this.boundFloatEnd);
        this.saveFloatState();
    }
    // ── Floating panel resize (SE corner) ──
    onFloatResizeStart(event) {
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
    onFloatResizeMove(event) {
        if (!this.floatResizing)
            return;
        this.floatWidth = Math.max(280, this.floatResizeStartW + (event.clientX - this.floatResizeStartX));
        this.floatHeight = Math.max(320, this.floatResizeStartH + (event.clientY - this.floatResizeStartY));
    }
    onFloatResizeEnd() {
        if (!this.floatResizing)
            return;
        this.floatResizing = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', this.boundFloatResizeMove);
        document.removeEventListener('mouseup', this.boundFloatResizeEnd);
        this.saveFloatState();
    }
    saveFloatState() {
        localStorage.setItem('messaging_float_state', JSON.stringify({
            isFloating: this.isFloating,
            x: this.floatX,
            y: this.floatY,
            w: this.floatWidth,
            h: this.floatHeight,
        }));
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: ChatPanelComponent, deps: [{ token: i1.MessagingStoreService }], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "17.3.12", type: ChatPanelComponent, isStandalone: true, selector: "app-chat-panel", ngImport: i0, template: `
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
        <app-chat-thread
          *ngIf="activeView === 'chat'"
          (lightboxOpen)="openLightbox($event)"
        ></app-chat-thread>
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
  `, isInline: true, styles: [".sidebar{position:fixed;top:0;bottom:0;width:400px;background:#041322;z-index:9999;display:flex;flex-direction:column;box-shadow:0 0 40px #0009;transition:transform .3s cubic-bezier(.4,0,.2,1)}.sidebar.side-right{right:0;transform:translate(100%)}.sidebar.side-left{left:0;transform:translate(-100%)}.sidebar.open.side-right,.sidebar.open.side-left{transform:translate(0)}.resize-handle{position:absolute;top:0;bottom:0;width:5px;cursor:ew-resize;z-index:1;transition:background .15s}.resize-handle:hover,.resize-handle:active{background:#ffffff26}.resize-handle.handle-left{left:0}.resize-handle.handle-right{right:0}.sidebar-header{display:flex;align-items:center;justify-content:space-between;padding:12px 12px 12px 16px;border-bottom:1px solid rgba(255,255,255,.15);flex-shrink:0;position:relative;z-index:2}.header-left{display:flex;align-items:center;gap:10px}.ces-logo-sm{width:28px;height:28px}.header-title{font-size:16px;font-weight:700;color:#fff;letter-spacing:.3px}.header-actions{display:flex;align-items:center;gap:0}.btn-spacer{width:12px}.hdr-btn{width:32px;height:32px;min-width:32px;padding:0;display:inline-flex;align-items:center;justify-content:center;border-radius:6px!important;transition:background .15s,box-shadow .15s;--mdc-icon-button-state-layer-size: 32px}.hdr-btn .mat-mdc-button-touch-target{width:32px;height:32px}.hdr-btn:hover{background:#ffffff26!important;box-shadow:0 2px 8px #0003}.hdr-btn mat-icon{font-size:20px;color:#ffffffd9}.sidebar-content{flex:1;overflow:hidden}.ws-status{display:flex;align-items:center;gap:6px;padding:6px 16px;font-size:11px;color:#fff9;border-top:1px solid rgba(255,255,255,.1);flex-shrink:0}.status-dot{width:6px;height:6px;border-radius:50%;background:#fff6}.ws-status.connected .status-dot{background:#22c55e}.ws-status.connecting .status-dot{background:#f59e0b;animation:blink 1s infinite}@keyframes blink{50%{opacity:.3}}.sidebar.floating{position:fixed!important;right:unset!important;left:80px;top:80px;transform:none!important;border-radius:12px;overflow:hidden;resize:none;min-width:280px;min-height:320px}.drag-handle{cursor:grab;-webkit-user-select:none;user-select:none}.drag-handle:active{cursor:grabbing}.float-resize-corner{position:absolute;bottom:0;right:0;width:16px;height:16px;cursor:se-resize;background:linear-gradient(135deg,transparent 50%,rgba(255,255,255,.25) 50%);border-bottom-right-radius:12px}@media (max-width: 480px){.sidebar{width:100%!important}.resize-handle{display:none}}.lb-overlay{position:fixed;inset:0;background:#000000e0;display:flex;align-items:center;justify-content:center;z-index:99999;cursor:pointer}.lb-overlay.lb-detached{inset:unset;background:#0c1f35;border:1px solid rgba(255,255,255,.18);border-radius:12px;box-shadow:0 12px 48px #000000b3;display:flex;flex-direction:column;overflow:hidden;cursor:default;min-width:240px;min-height:200px}.lb-drag-bar{display:flex;align-items:center;justify-content:space-between;padding:6px 8px 6px 12px;background:#041322;border-bottom:1px solid rgba(255,255,255,.12);cursor:grab;flex-shrink:0;-webkit-user-select:none;user-select:none}.lb-drag-bar:active{cursor:grabbing}.lb-drag-title{font-size:12px;color:#fff9;letter-spacing:.4px}.lb-drag-actions{display:flex;gap:2px}.lb-action-btn{background:transparent;border:none;border-radius:6px;width:28px;height:28px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#ffffffb3;transition:background .15s}.lb-action-btn:hover{background:#ffffff26}.lb-action-btn mat-icon{font-size:16px;width:16px;height:16px}.lb-img{max-width:92vw;max-height:92vh;border-radius:8px;box-shadow:0 8px 40px #0009;cursor:default}.lb-img.lb-img-detached{max-width:100%;max-height:100%;border-radius:0;box-shadow:none;object-fit:contain;flex:1}.lb-close{position:absolute;top:16px;right:16px;background:#ffffff26;border:none;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#fff;transition:background .15s}.lb-close:hover{background:#ffffff4d}.lb-detach-btn{position:absolute;top:16px;right:60px;background:#ffffff26;border:none;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#fff;transition:background .15s}.lb-detach-btn:hover{background:#ffffff4d}.lb-resize-corner{position:absolute;bottom:0;right:0;width:16px;height:16px;cursor:se-resize;background:linear-gradient(135deg,transparent 50%,rgba(255,255,255,.2) 50%);border-bottom-right-radius:12px}\n"], dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i2.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "ngmodule", type: MatIconModule }, { kind: "component", type: i3.MatIcon, selector: "mat-icon", inputs: ["color", "inline", "svgIcon", "fontSet", "fontIcon"], exportAs: ["matIcon"] }, { kind: "ngmodule", type: MatButtonModule }, { kind: "component", type: i4.MatIconButton, selector: "button[mat-icon-button]", exportAs: ["matButton"] }, { kind: "ngmodule", type: MatTooltipModule }, { kind: "directive", type: i5.MatTooltip, selector: "[matTooltip]", inputs: ["matTooltipPosition", "matTooltipPositionAtOrigin", "matTooltipDisabled", "matTooltipShowDelay", "matTooltipHideDelay", "matTooltipTouchGestures", "matTooltip", "matTooltipClass"], exportAs: ["matTooltip"] }, { kind: "component", type: InboxListComponent, selector: "app-inbox-list" }, { kind: "component", type: ChatThreadComponent, selector: "app-chat-thread", outputs: ["lightboxOpen"] }, { kind: "component", type: NewConversationComponent, selector: "app-new-conversation" }, { kind: "component", type: GroupManagerComponent, selector: "app-group-manager" }] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: ChatPanelComponent, decorators: [{
            type: Component,
            args: [{ selector: 'app-chat-panel', standalone: true, imports: [
                        CommonModule, MatIconModule, MatButtonModule, MatTooltipModule,
                        InboxListComponent, ChatThreadComponent,
                        NewConversationComponent, GroupManagerComponent,
                    ], template: `
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
        <app-chat-thread
          *ngIf="activeView === 'chat'"
          (lightboxOpen)="openLightbox($event)"
        ></app-chat-thread>
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
  `, styles: [".sidebar{position:fixed;top:0;bottom:0;width:400px;background:#041322;z-index:9999;display:flex;flex-direction:column;box-shadow:0 0 40px #0009;transition:transform .3s cubic-bezier(.4,0,.2,1)}.sidebar.side-right{right:0;transform:translate(100%)}.sidebar.side-left{left:0;transform:translate(-100%)}.sidebar.open.side-right,.sidebar.open.side-left{transform:translate(0)}.resize-handle{position:absolute;top:0;bottom:0;width:5px;cursor:ew-resize;z-index:1;transition:background .15s}.resize-handle:hover,.resize-handle:active{background:#ffffff26}.resize-handle.handle-left{left:0}.resize-handle.handle-right{right:0}.sidebar-header{display:flex;align-items:center;justify-content:space-between;padding:12px 12px 12px 16px;border-bottom:1px solid rgba(255,255,255,.15);flex-shrink:0;position:relative;z-index:2}.header-left{display:flex;align-items:center;gap:10px}.ces-logo-sm{width:28px;height:28px}.header-title{font-size:16px;font-weight:700;color:#fff;letter-spacing:.3px}.header-actions{display:flex;align-items:center;gap:0}.btn-spacer{width:12px}.hdr-btn{width:32px;height:32px;min-width:32px;padding:0;display:inline-flex;align-items:center;justify-content:center;border-radius:6px!important;transition:background .15s,box-shadow .15s;--mdc-icon-button-state-layer-size: 32px}.hdr-btn .mat-mdc-button-touch-target{width:32px;height:32px}.hdr-btn:hover{background:#ffffff26!important;box-shadow:0 2px 8px #0003}.hdr-btn mat-icon{font-size:20px;color:#ffffffd9}.sidebar-content{flex:1;overflow:hidden}.ws-status{display:flex;align-items:center;gap:6px;padding:6px 16px;font-size:11px;color:#fff9;border-top:1px solid rgba(255,255,255,.1);flex-shrink:0}.status-dot{width:6px;height:6px;border-radius:50%;background:#fff6}.ws-status.connected .status-dot{background:#22c55e}.ws-status.connecting .status-dot{background:#f59e0b;animation:blink 1s infinite}@keyframes blink{50%{opacity:.3}}.sidebar.floating{position:fixed!important;right:unset!important;left:80px;top:80px;transform:none!important;border-radius:12px;overflow:hidden;resize:none;min-width:280px;min-height:320px}.drag-handle{cursor:grab;-webkit-user-select:none;user-select:none}.drag-handle:active{cursor:grabbing}.float-resize-corner{position:absolute;bottom:0;right:0;width:16px;height:16px;cursor:se-resize;background:linear-gradient(135deg,transparent 50%,rgba(255,255,255,.25) 50%);border-bottom-right-radius:12px}@media (max-width: 480px){.sidebar{width:100%!important}.resize-handle{display:none}}.lb-overlay{position:fixed;inset:0;background:#000000e0;display:flex;align-items:center;justify-content:center;z-index:99999;cursor:pointer}.lb-overlay.lb-detached{inset:unset;background:#0c1f35;border:1px solid rgba(255,255,255,.18);border-radius:12px;box-shadow:0 12px 48px #000000b3;display:flex;flex-direction:column;overflow:hidden;cursor:default;min-width:240px;min-height:200px}.lb-drag-bar{display:flex;align-items:center;justify-content:space-between;padding:6px 8px 6px 12px;background:#041322;border-bottom:1px solid rgba(255,255,255,.12);cursor:grab;flex-shrink:0;-webkit-user-select:none;user-select:none}.lb-drag-bar:active{cursor:grabbing}.lb-drag-title{font-size:12px;color:#fff9;letter-spacing:.4px}.lb-drag-actions{display:flex;gap:2px}.lb-action-btn{background:transparent;border:none;border-radius:6px;width:28px;height:28px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#ffffffb3;transition:background .15s}.lb-action-btn:hover{background:#ffffff26}.lb-action-btn mat-icon{font-size:16px;width:16px;height:16px}.lb-img{max-width:92vw;max-height:92vh;border-radius:8px;box-shadow:0 8px 40px #0009;cursor:default}.lb-img.lb-img-detached{max-width:100%;max-height:100%;border-radius:0;box-shadow:none;object-fit:contain;flex:1}.lb-close{position:absolute;top:16px;right:16px;background:#ffffff26;border:none;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#fff;transition:background .15s}.lb-close:hover{background:#ffffff4d}.lb-detach-btn{position:absolute;top:16px;right:60px;background:#ffffff26;border:none;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#fff;transition:background .15s}.lb-detach-btn:hover{background:#ffffff4d}.lb-resize-corner{position:absolute;bottom:0;right:0;width:16px;height:16px;cursor:se-resize;background:linear-gradient(135deg,transparent 50%,rgba(255,255,255,.2) 50%);border-bottom-right-radius:12px}\n"] }]
        }], ctorParameters: () => [{ type: i1.MessagingStoreService }] });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdC1wYW5lbC5jb21wb25lbnQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvbGliL2NvbXBvbmVudHMvY2hhdC1wYW5lbC9jaGF0LXBhbmVsLmNvbXBvbmVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsU0FBUyxFQUFxQixNQUFNLGVBQWUsQ0FBQztBQUM3RCxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDL0MsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLHdCQUF3QixDQUFDO0FBQ3ZELE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUMzRCxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSwyQkFBMkIsQ0FBQztBQUM3RCxPQUFPLEVBQWdCLGFBQWEsRUFBRSxNQUFNLE1BQU0sQ0FBQztBQUduRCxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUN4RSxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUMzRSxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUMxRixPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQzs7Ozs7OztBQXlhakYsTUFBTSxPQUFPLGtCQUFrQjtJQTJEVDtJQTFEcEIsTUFBTSxHQUFHLEtBQUssQ0FBQztJQUNmLFVBQVUsR0FBc0YsT0FBTyxDQUFDO0lBQ3hHLFFBQVEsR0FBVyxjQUFjLENBQUM7SUFDbEMsSUFBSSxHQUFnQixPQUFPLENBQUM7SUFDNUIsWUFBWSxHQUFHLEdBQUcsQ0FBQztJQUVuQiw4QkFBOEI7SUFDOUIsVUFBVSxHQUFHLEtBQUssQ0FBQztJQUNuQixNQUFNLEdBQUcsRUFBRSxDQUFDO0lBQ1osTUFBTSxHQUFHLEVBQUUsQ0FBQztJQUNaLFVBQVUsR0FBRyxHQUFHLENBQUM7SUFDakIsV0FBVyxH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VUFBVTtZQUMzQixDQUFDLEVBQUUsSUFBSSxDQUFDLE1BQU07WUFDZCxDQUFDLEVBQUUsSUFBSSxDQUFDLE1BQU07WUFDZCxDQUFDLEVBQUUsSUFBSSxDQUFDLFVBQVU7WUFDbEIsQ0FBQyxFQUFFLElBQUksQ0FBQyxXQUFXO1NBQ3BCLENBQUMsQ0FBQyxDQUFDO0lBQ04sQ0FBQzt3R0F2U1Usa0JBQWtCOzRGQUFsQixrQkFBa0IsMEVBL1puQjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQW1IVCwyOUlBdkhDLFlBQVksa0lBQUUsYUFBYSxtTEFBRSxlQUFlLDJJQUFFLGdCQUFnQiw2VEFDOUQsa0JBQWtCLDJEQUFFLG1CQUFtQix1RkFDdkMsd0JBQXdCLGlFQUFFLHFCQUFxQjs7NEZBaWF0QyxrQkFBa0I7a0JBdmE5QixTQUFTOytCQUNFLGdCQUFnQixjQUNkLElBQUksV0FDUDt3QkFDUCxZQUFZLEVBQUUsYUFBYSxFQUFFLGVBQWUsRUFBRSxnQkFBZ0I7d0JBQzlELGtCQUFrQixFQUFFLG1CQUFtQjt3QkFDdkMsd0JBQXdCLEVBQUUscUJBQXFCO3FCQUNoRCxZQUNTOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBbUhUIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQ29tcG9uZW50LCBPbkluaXQsIE9uRGVzdHJveSB9IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xuaW1wb3J0IHsgQ29tbW9uTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvY29tbW9uJztcbmltcG9ydCB7IE1hdEljb25Nb2R1bGUgfSBmcm9tICdAYW5ndWxhci9tYXRlcmlhbC9pY29uJztcbmltcG9ydCB7IE1hdEJ1dHRvbk1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL21hdGVyaWFsL2J1dHRvbic7XG5pbXBvcnQgeyBNYXRUb29sdGlwTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvbWF0ZXJpYWwvdG9vbHRpcCc7XG5pbXBvcnQgeyBTdWJzY3JpcHRpb24sIGNvbWJpbmVMYXRlc3QgfSBmcm9tICdyeGpzJztcbmltcG9ydCB7IE1lc3NhZ2luZ1N0b3JlU2VydmljZSB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL21lc3NhZ2luZy1zdG9yZS5zZXJ2aWNlJztcbmltcG9ydCB7IFNpZGViYXJTaWRlIH0gZnJvbSAnLi4vLi4vbW9kZWxzL21lc3NhZ2luZy5tb2RlbHMnO1xuaW1wb3J0IHsgSW5ib3hMaXN0Q29tcG9uZW50IH0gZnJvbSAnLi4vaW5ib3gtbGlzdC9pbmJveC1saXN0LmNvbXBvbmVudCc7XG5pbXBvcnQgeyBDaGF0VGhyZWFkQ29tcG9uZW50IH0gZnJvbSAnLi4vY2hhdC10aHJlYWQvY2hhdC10aHJlYWQuY29tcG9uZW50JztcbmltcG9ydCB7IE5ld0NvbnZlcnNhdGlvbkNvbXBvbmVudCB9IGZyb20gJy4uL25ldy1jb252ZXJzYXRpb24vbmV3LWNvbnZlcnNhdGlvbi5jb21wb25lbnQnO1xuaW1wb3J0IHsgR3JvdXBNYW5hZ2VyQ29tcG9uZW50IH0gZnJvbSAnLi4vZ3JvdXAtbWFuYWdlci9ncm91cC1tYW5hZ2VyLmNvbXBvbmVudCc7XG5cbkBDb21wb25lbnQoe1xuICBzZWxlY3RvcjogJ2FwcC1jaGF0LXBhbmVsJyxcbiAgc3RhbmRhbG9uZTogdHJ1ZSxcbiAgaW1wb3J0czogW1xuICAgIENvbW1vbk1vZHVsZSwgTWF0SWNvbk1vZHVsZSwgTWF0QnV0dG9uTW9kdWxlLCBNYXRUb29sdGlwTW9kdWxlLFxuICAgIEluYm94TGlzdENvbXBvbmVudCwgQ2hhdFRocmVhZENvbXBvbmVudCxcbiAgICBOZXdDb252ZXJzYXRpb25Db21wb25lbnQsIEdyb3VwTWFuYWdlckNvbXBvbmVudCxcbiAgXSxcbiAgdGVtcGxhdGU6IGBcbiAgICA8IS0tIFNpZGViYXIgLyBGbG9hdGluZyBwYW5lbCAtLT5cbiAgICA8ZGl2XG4gICAgICBjbGFzcz1cInNpZGViYXJcIlxuICAgICAgW2NsYXNzLm9wZW5dPVwiaXNPcGVuXCJcbiAgICAgIFtjbGFzcy5zaWRlLWxlZnRdPVwiIWlzRmxvYXRpbmcgJiYgc2lkZSA9PT0gJ2xlZnQnXCJcbiAgICAgIFtjbGFzcy5zaWRlLXJpZ2h0XT1cIiFpc0Zsb2F0aW5nICYmIHNpZGUgPT09ICdyaWdodCdcIlxuICAgICAgW2NsYXNzLmZsb2F0aW5nXT1cImlzRmxvYXRpbmdcIlxuICAgICAgW3N0eWxlLndpZHRoLnB4XT1cImlzRmxvYXRpbmcgPyBmbG9hdFdpZHRoIDogc2lkZWJhcldpZHRoXCJcbiAgICAgIFtzdHlsZS5oZWlnaHQucHhdPVwiaXNGbG9hdGluZyA/IGZsb2F0SGVpZ2h0IDogbnVsbFwiXG4gICAgICBbc3R5bGUubGVmdC5weF09XCJpc0Zsb2F0aW5nID8gZmxvYXRYIDogbnVsbFwiXG4gICAgICBbc3R5bGUudG9wLnB4XT1cImlzRmxvYXRpbmcgPyBmbG9hdFkgOiBudWxsXCJcbiAgICA+XG4gICAgICA8IS0tIFJlc2l6ZSBoYW5kbGUgKHNpZGViYXIgbW9kZSBvbmx5KSAtLT5cbiAgICAgIDxkaXZcbiAgICAgICAgKm5nSWY9XCIhaXNGbG9hdGluZ1wiXG4gICAgICAgIGNsYXNzPVwicmVzaXplLWhhbmRsZVwiXG4gICAgICAgIFtjbGFzcy5oYW5kbGUtbGVmdF09XCJzaWRlID09PSAncmlnaHQnXCJcbiAgICAgICAgW2NsYXNzLmhhbmRsZS1yaWdodF09XCJzaWRlID09PSAnbGVmdCdcIlxuICAgICAgICAobW91c2Vkb3duKT1cIm9uUmVzaXplU3RhcnQoJGV2ZW50KVwiXG4gICAgICA+PC9kaXY+XG5cbiAgICAgIDwhLS0gU2lkZWJhciBoZWFkZXIgKGFjdHMgYXMgZHJhZyBoYW5kbGUgaW4gZmxvYXRpbmcgbW9kZSkgLS0+XG4gICAgICA8ZGl2XG4gICAgICAgIGNsYXNzPVwic2lkZWJhci1oZWFkZXJcIlxuICAgICAgICBbY2xhc3MuZHJhZy1oYW5kbGVdPVwiaXNGbG9hdGluZ1wiXG4gICAgICAgIChtb3VzZWRvd24pPVwiaXNGbG9hdGluZyAmJiBvbkZsb2F0RHJhZ1N0YXJ0KCRldmVudClcIlxuICAgICAgPlxuICAgICAgICA8ZGl2IGNsYXNzPVwiaGVhZGVyLWxlZnRcIj5cbiAgICAgICAgICA8c3ZnIGNsYXNzPVwiY2VzLWxvZ28tc21cIiB2aWV3Qm94PVwiMCAwIDEwMCAxMDBcIiB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCI+XG4gICAgICAgICAgICA8cGF0aCBkPVwiTSAxNSAyMCBRIDE1IDE1IDIwIDE1IEwgODAgMTUgUSA4NSAxNSA4NSAyMCBMIDg1IDYwIFEgODUgNjUgODAgNjUgTCAzNSA2NSBMIDIwIDgwIEwgMjAgNjUgUSAxNSA2NSAxNSA2MCBaXCJcbiAgICAgICAgICAgICAgICAgIGZpbGw9XCJub25lXCIgc3Ryb2tlPVwid2hpdGVcIiBzdHJva2Utd2lkdGg9XCIzXCIvPlxuICAgICAgICAgICAgPGcgdHJhbnNmb3JtPVwidHJhbnNsYXRlKDUwLCA0MCkgc2NhbGUoMC4zNSlcIj5cbiAgICAgICAgICAgICAgPHBhdGggZD1cIk0gMCwtMzAgTCAyNSwtMTUgTCAyNSwxNSBMIDAsMzAgTCAtMjUsMTUgTCAtMjUsLTE1IFpcIiBmaWxsPVwid2hpdGVcIi8+XG4gICAgICAgICAgICA8L2c+XG4gICAgICAgICAgPC9zdmc+XG4gICAgICAgICAgPHNwYW4gY2xhc3M9XCJoZWFkZXItdGl0bGVcIj5DRVMgTWVzc2VuZ2VyPC9zcGFuPlxuICAgICAgICA8L2Rpdj5cbiAgICAgICAgPGRpdiBjbGFzcz1cImhlYWRlci1hY3Rpb25zXCI+XG4gICAgICAgICAgPCEtLSBTaWRlLXN3YXAgKHNpZGViYXIgbW9kZSBvbmx5KSAtLT5cbiAgICAgICAgICA8YnV0dG9uICpuZ0lmPVwiIWlzRmxvYXRpbmdcIiBtYXQtaWNvbi1idXR0b24gY2xhc3M9XCJoZHItYnRuXCIgKGNsaWNrKT1cInRvZ2dsZVNpZGUoKVwiXG4gICAgICAgICAgICBbbWF0VG9vbHRpcF09XCInTW92ZSB0byAnICsgKHNpZGUgPT09ICdyaWdodCcgPyAnbGVmdCcgOiAncmlnaHQnKVwiIG1hdFRvb2x0aXBQb3NpdGlvbj1cImJlbG93XCI+XG4gICAgICAgICAgICA8bWF0LWljb24+e3sgc2lkZSA9PT0gJ3JpZ2h0JyA/ICdjaGV2cm9uX2xlZnQnIDogJ2NoZXZyb25fcmlnaHQnIH19PC9tYXQtaWNvbj5cbiAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICA8IS0tIFBvcC1vdXQgLyBkb2NrIHRvZ2dsZSAtLT5cbiAgICAgICAgICA8YnV0dG9uIG1hdC1pY29uLWJ1dHRvbiBjbGFzcz1cImhkci1idG5cIlxuICAgICAgICAgICAgKGNsaWNrKT1cInRvZ2dsZUZsb2F0KClcIlxuICAgICAgICAgICAgW21hdFRvb2x0aXBdPVwiaXNGbG9hdGluZyA/ICdEb2NrIHRvIHNpZGViYXInIDogJ1BvcCBvdXQgdG8gZmxvYXRpbmcgd2luZG93J1wiXG4gICAgICAgICAgICBtYXRUb29sdGlwUG9zaXRpb249XCJiZWxvd1wiPlxuICAgICAgICAgICAgPG1hdC1pY29uPnt7IGlzRmxvYXRpbmcgPyAncGljdHVyZV9pbl9waWN0dXJlX2FsdCcgOiAnb3Blbl9pbl9uZXcnIH19PC9tYXQtaWNvbj5cbiAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwiYnRuLXNwYWNlclwiPjwvZGl2PlxuICAgICAgICAgIDxidXR0b24gbWF0LWljb24tYnV0dG9uIGNsYXNzPVwiaGRyLWJ0blwiIChjbGljayk9XCJjbG9zZSgpXCIgbWF0VG9vbHRpcD1cIkNsb3NlIG1lc3NlbmdlclwiIG1hdFRvb2x0aXBQb3NpdGlvbj1cImJlbG93XCI+XG4gICAgICAgICAgICA8bWF0LWljb24+Y2xvc2U8L21hdC1pY29uPlxuICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuXG4gICAgICA8IS0tIFZpZXcgY29udGFpbmVyIC0tPlxuICAgICAgPGRpdiBjbGFzcz1cInNpZGViYXItY29udGVudFwiPlxuICAgICAgICA8YXBwLWluYm94LWxpc3QgKm5nSWY9XCJhY3RpdmVWaWV3ID09PSAnaW5ib3gnXCI+PC9hcHAtaW5ib3gtbGlzdD5cbiAgICAgICAgPGFwcC1jaGF0LXRocmVhZFxuICAgICAgICAgICpuZ0lmPVwiYWN0aXZlVmlldyA9PT0gJ2NoYXQnXCJcbiAgICAgICAgICAobGlnaHRib3hPcGVuKT1cIm9wZW5MaWdodGJveCgkZXZlbnQpXCJcbiAgICAgICAgPjwvYXBwLWNoYXQtdGhyZWFkPlxuICAgICAgICA8YXBwLW5ldy1jb252ZXJzYXRpb24gKm5nSWY9XCJhY3RpdmVWaWV3ID09PSAnbmV3LWNvbnZlcnNhdGlvbidcIj48L2FwcC1uZXctY29udmVyc2F0aW9uPlxuICAgICAgICA8YXBwLWdyb3VwLW1hbmFnZXIgKm5nSWY9XCJhY3RpdmVWaWV3ID09PSAnZ3JvdXAtbWFuYWdlcidcIj48L2FwcC1ncm91cC1tYW5hZ2VyPlxuICAgICAgPC9kaXY+XG5cbiAgICAgIDwhLS0gU3RhdHVzIGJhciAtLT5cbiAgICAgIDxkaXYgY2xhc3M9XCJ3cy1zdGF0dXNcIiBbY2xhc3MuY29ubmVjdGVkXT1cIndzU3RhdHVzID09PSAnYXV0aGVudGljYXRlZCdcIiBbY2xhc3MuY29ubmVjdGluZ109XCJ3c1N0YXR1cyA9PT0gJ2Nvbm5lY3RpbmcnXCI+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJzdGF0dXMtZG90XCI+PC9kaXY+XG4gICAgICAgIDxzcGFuICpuZ0lmPVwid3NTdGF0dXMgPT09ICdhdXRoZW50aWNhdGVkJ1wiPkNvbm5lY3RlZDwvc3Bhbj5cbiAgICAgICAgPHNwYW4gKm5nSWY9XCJ3c1N0YXR1cyA9PT0gJ2Nvbm5lY3RpbmcnXCI+Q29ubmVjdGluZy4uLjwvc3Bhbj5cbiAgICAgICAgPHNwYW4gKm5nSWY9XCJ3c1N0YXR1cyA9PT0gJ2Rpc2Nvbm5lY3RlZCdcIj5EaXNjb25uZWN0ZWQ8L3NwYW4+XG4gICAgICA8L2Rpdj5cblxuICAgICAgPCEtLSBSZXNpemUgY29ybmVyIChmbG9hdGluZyBtb2RlIG9ubHkpIC0tPlxuICAgICAgPGRpdiAqbmdJZj1cImlzRmxvYXRpbmdcIiBjbGFzcz1cImZsb2F0LXJlc2l6ZS1jb3JuZXJcIiAobW91c2Vkb3duKT1cIm9uRmxvYXRSZXNpemVTdGFydCgkZXZlbnQpXCI+PC9kaXY+XG4gICAgPC9kaXY+XG5cbiAgICA8IS0tIOKUgOKUgCBMaWdodGJveDogc2libGluZyBvZiAuc2lkZWJhciBzbyBwb3NpdGlvbjpmaXhlZCBpcyByZWxhdGl2ZSB0byB2aWV3cG9ydCDilIDilIAgLS0+XG4gICAgPGRpdlxuICAgICAgKm5nSWY9XCJsaWdodGJveFVybFwiXG4gICAgICBjbGFzcz1cImxiLW92ZXJsYXlcIlxuICAgICAgW2NsYXNzLmxiLWRldGFjaGVkXT1cImxpZ2h0Ym94RGV0YWNoZWRcIlxuICAgICAgW3N0eWxlLmxlZnQucHhdPVwibGlnaHRib3hEZXRhY2hlZCA/IGxpZ2h0Ym94WCA6IG51bGxcIlxuICAgICAgW3N0eWxlLnRvcC5weF09XCJsaWdodGJveERldGFjaGVkID8gbGlnaHRib3hZIDogbnVsbFwiXG4gICAgICBbc3R5bGUud2lkdGgucHhdPVwibGlnaHRib3hEZXRhY2hlZCA/IGxpZ2h0Ym94VyA6IG51bGxcIlxuICAgICAgW3N0eWxlLmhlaWdodC5weF09XCJsaWdodGJveERldGFjaGVkID8gbGlnaHRib3hIIDogbnVsbFwiXG4gICAgICAoY2xpY2spPVwib25MaWdodGJveEJhY2tkcm9wQ2xpY2soJGV2ZW50KVwiXG4gICAgPlxuICAgICAgPGRpdiAqbmdJZj1cImxpZ2h0Ym94RGV0YWNoZWRcIiBjbGFzcz1cImxiLWRyYWctYmFyXCIgKG1vdXNlZG93bik9XCJvbkxiRHJhZ1N0YXJ0KCRldmVudClcIj5cbiAgICAgICAgPHNwYW4gY2xhc3M9XCJsYi1kcmFnLXRpdGxlXCI+SW1hZ2Ugdmlld2VyPC9zcGFuPlxuICAgICAgICA8ZGl2IGNsYXNzPVwibGItZHJhZy1hY3Rpb25zXCI+XG4gICAgICAgICAgPGJ1dHRvbiB0eXBlPVwiYnV0dG9uXCIgY2xhc3M9XCJsYi1hY3Rpb24tYnRuXCJcbiAgICAgICAgICAgIChjbGljayk9XCIkZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7IGxpZ2h0Ym94RGV0YWNoZWQgPSBmYWxzZVwiIHRpdGxlPVwiRnVsbHNjcmVlblwiPlxuICAgICAgICAgICAgPG1hdC1pY29uPmZ1bGxzY3JlZW48L21hdC1pY29uPlxuICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgIDxidXR0b24gdHlwZT1cImJ1dHRvblwiIGNsYXNzPVwibGItYWN0aW9uLWJ0blwiXG4gICAgICAgICAgICAoY2xpY2spPVwiJGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpOyBsaWdodGJveFVybCA9IG51bGw7IGxpZ2h0Ym94RGV0YWNoZWQgPSBmYWxzZVwiIHRpdGxlPVwiQ2xvc2VcIj5cbiAgICAgICAgICAgIDxtYXQtaWNvbj5jbG9zZTwvbWF0LWljb24+XG4gICAgICAgICAgPC9idXR0b24+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgICA8aW1nIFtzcmNdPVwibGlnaHRib3hVcmxcIiBjbGFzcz1cImxiLWltZ1wiIFtjbGFzcy5sYi1pbWctZGV0YWNoZWRdPVwibGlnaHRib3hEZXRhY2hlZFwiXG4gICAgICAgICAgIChjbGljayk9XCIkZXZlbnQuc3RvcFByb3BhZ2F0aW9uKClcIiAvPlxuICAgICAgPG5nLWNvbnRhaW5lciAqbmdJZj1cIiFsaWdodGJveERldGFjaGVkXCI+XG4gICAgICAgIDxidXR0b24gY2xhc3M9XCJsYi1jbG9zZVwiIChjbGljayk9XCJsaWdodGJveFVybCA9IG51bGxcIj48bWF0LWljb24+Y2xvc2U8L21hdC1pY29uPjwvYnV0dG9uPlxuICAgICAgICA8YnV0dG9uIGNsYXNzPVwibGItZGV0YWNoLWJ0blwiIChjbGljayk9XCJkZXRhY2hMaWdodGJveCgpXCIgdGl0bGU9XCJEZXRhY2ggdG8gZmxvYXRpbmcgd2luZG93XCI+XG4gICAgICAgICAgPG1hdC1pY29uPnBpY3R1cmVfaW5fcGljdHVyZTwvbWF0LWljb24+XG4gICAgICAgIDwvYnV0dG9uPlxuICAgICAgPC9uZy1jb250YWluZXI+XG4gICAgICA8ZGl2ICpuZ0lmPVwibGlnaHRib3hEZXRhY2hlZFwiIGNsYXNzPVwibGItcmVzaXplLWNvcm5lclwiIChtb3VzZWRvd24pPVwib25MYlJlc2l6ZVN0YXJ0KCRldmVudClcIj48L2Rpdj5cbiAgICA8L2Rpdj5cbiAgYCxcbiAgc3R5bGVzOiBbYFxuICAgIC5zaWRlYmFyIHtcbiAgICAgIHBvc2l0aW9uOiBmaXhlZDtcbiAgICAgIHRvcDogMDtcbiAgICAgIGJvdHRvbTogMDtcbiAgICAgIHdpZHRoOiA0MDBweDtcbiAgICAgIGJhY2tncm91bmQ6ICMwNDEzMjI7XG4gICAgICB6LWluZGV4OiA5OTk5O1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAgICBib3gtc2hhZG93OiAwIDAgNDBweCByZ2JhKDAsIDAsIDAsIDAuNik7XG4gICAgICB0cmFuc2l0aW9uOiB0cmFuc2Zvcm0gMC4zcyBjdWJpYy1iZXppZXIoMC40LCAwLCAwLjIsIDEpO1xuICAgIH1cblxuICAgIC5zaWRlYmFyLnNpZGUtcmlnaHQge1xuICAgICAgcmlnaHQ6IDA7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVgoMTAwJSk7XG4gICAgfVxuXG4gICAgLnNpZGViYXIuc2lkZS1sZWZ0IHtcbiAgICAgIGxlZnQ6IDA7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVgoLTEwMCUpO1xuICAgIH1cblxuICAgIC5zaWRlYmFyLm9wZW4uc2lkZS1yaWdodCB7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVgoMCk7XG4gICAgfVxuXG4gICAgLnNpZGViYXIub3Blbi5zaWRlLWxlZnQge1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVYKDApO1xuICAgIH1cblxuICAgIC8qIOKUgOKUgCBSZXNpemUgaGFuZGxlIChiZWxvdyBoZWFkZXIgc28gaGVhZGVyIGNvbnRyb2xzIHN0YXkgY2xpY2thYmxlKSDilIDilIAgKi9cbiAgICAucmVzaXplLWhhbmRsZSB7XG4gICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XG4gICAgICB0b3A6IDA7XG4gICAgICBib3R0b206IDA7XG4gICAgICB3aWR0aDogNXB4O1xuICAgICAgY3Vyc29yOiBldy1yZXNpemU7XG4gICAgICB6LWluZGV4OiAxO1xuICAgICAgdHJhbnNpdGlvbjogYmFja2dyb3VuZCAwLjE1cztcbiAgICB9XG5cbiAgICAucmVzaXplLWhhbmRsZTpob3ZlcixcbiAgICAucmVzaXplLWhhbmRsZTphY3RpdmUge1xuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjE1KTtcbiAgICB9XG5cbiAgICAucmVzaXplLWhhbmRsZS5oYW5kbGUtbGVmdCB7XG4gICAgICBsZWZ0OiAwO1xuICAgIH1cblxuICAgIC5yZXNpemUtaGFuZGxlLmhhbmRsZS1yaWdodCB7XG4gICAgICByaWdodDogMDtcbiAgICB9XG5cbiAgICAvKiDilIDilIAgSGVhZGVyIOKUgOKUgCAqL1xuICAgIC5zaWRlYmFyLWhlYWRlciB7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGp1c3RpZnktY29udGVudDogc3BhY2UtYmV0d2VlbjtcbiAgICAgIHBhZGRpbmc6IDEycHggMTJweCAxMnB4IDE2cHg7XG4gICAgICBib3JkZXItYm90dG9tOiAxcHggc29saWQgcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjE1KTtcbiAgICAgIGZsZXgtc2hyaW5rOiAwO1xuICAgICAgcG9zaXRpb246IHJlbGF0aXZlO1xuICAgICAgei1pbmRleDogMjtcbiAgICB9XG5cbiAgICAuaGVhZGVyLWxlZnQge1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBnYXA6IDEwcHg7XG4gICAgfVxuXG4gICAgLmNlcy1sb2dvLXNtIHtcbiAgICAgIHdpZHRoOiAyOHB4O1xuICAgICAgaGVpZ2h0OiAyOHB4O1xuICAgIH1cblxuICAgIC5oZWFkZXItdGl0bGUge1xuICAgICAgZm9udC1zaXplOiAxNnB4O1xuICAgICAgZm9udC13ZWlnaHQ6IDcwMDtcbiAgICAgIGNvbG9yOiAjZmZmO1xuICAgICAgbGV0dGVyLXNwYWNpbmc6IDAuM3B4O1xuICAgIH1cblxuICAgIC5oZWFkZXItYWN0aW9ucyB7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGdhcDogMDtcbiAgICB9XG5cbiAgICAuYnRuLXNwYWNlciB7XG4gICAgICB3aWR0aDogMTJweDtcbiAgICB9XG5cbiAgICAuaGRyLWJ0biB7XG4gICAgICB3aWR0aDogMzJweDtcbiAgICAgIGhlaWdodDogMzJweDtcbiAgICAgIG1pbi13aWR0aDogMzJweDtcbiAgICAgIHBhZGRpbmc6IDA7XG4gICAgICBkaXNwbGF5OiBpbmxpbmUtZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDZweCAhaW1wb3J0YW50O1xuICAgICAgdHJhbnNpdGlvbjogYmFja2dyb3VuZCAwLjE1cywgYm94LXNoYWRvdyAwLjE1cztcbiAgICAgIC0tbWRjLWljb24tYnV0dG9uLXN0YXRlLWxheWVyLXNpemU6IDMycHg7XG4gICAgfVxuXG4gICAgLmhkci1idG4gLm1hdC1tZGMtYnV0dG9uLXRvdWNoLXRhcmdldCB7XG4gICAgICB3aWR0aDogMzJweDtcbiAgICAgIGhlaWdodDogMzJweDtcbiAgICB9XG5cbiAgICAuaGRyLWJ0bjpob3ZlciB7XG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMTUpICFpbXBvcnRhbnQ7XG4gICAgICBib3gtc2hhZG93OiAwIDJweCA4cHggcmdiYSgwLCAwLCAwLCAwLjIpO1xuICAgIH1cblxuICAgIC5oZHItYnRuIG1hdC1pY29uIHtcbiAgICAgIGZvbnQtc2l6ZTogMjBweDtcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuODUpO1xuICAgIH1cblxuICAgIC8qIOKUgOKUgCBDb250ZW50IOKUgOKUgCAqL1xuICAgIC5zaWRlYmFyLWNvbnRlbnQge1xuICAgICAgZmxleDogMTtcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgfVxuXG4gICAgLyog4pSA4pSAIFN0YXR1cyBiYXIg4pSA4pSAICovXG4gICAgLndzLXN0YXR1cyB7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGdhcDogNnB4O1xuICAgICAgcGFkZGluZzogNnB4IDE2cHg7XG4gICAgICBmb250LXNpemU6IDExcHg7XG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjYpO1xuICAgICAgYm9yZGVyLXRvcDogMXB4IHNvbGlkIHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xKTtcbiAgICAgIGZsZXgtc2hyaW5rOiAwO1xuICAgIH1cblxuICAgIC5zdGF0dXMtZG90IHtcbiAgICAgIHdpZHRoOiA2cHg7XG4gICAgICBoZWlnaHQ6IDZweDtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDUwJTtcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC40KTtcbiAgICB9XG5cbiAgICAud3Mtc3RhdHVzLmNvbm5lY3RlZCAuc3RhdHVzLWRvdCB7XG4gICAgICBiYWNrZ3JvdW5kOiAjMjJjNTVlO1xuICAgIH1cblxuICAgIC53cy1zdGF0dXMuY29ubmVjdGluZyAuc3RhdHVzLWRvdCB7XG4gICAgICBiYWNrZ3JvdW5kOiAjZjU5ZTBiO1xuICAgICAgYW5pbWF0aW9uOiBibGluayAxcyBpbmZpbml0ZTtcbiAgICB9XG5cbiAgICBAa2V5ZnJhbWVzIGJsaW5rIHtcbiAgICAgIDUwJSB7IG9wYWNpdHk6IDAuMzsgfVxuICAgIH1cblxuICAgIC8qIOKUgOKUgCBGbG9hdGluZyBtb2RlIOKUgOKUgCAqL1xuICAgIC5zaWRlYmFyLmZsb2F0aW5nIHtcbiAgICAgIHBvc2l0aW9uOiBmaXhlZCAhaW1wb3J0YW50O1xuICAgICAgcmlnaHQ6IHVuc2V0ICFpbXBvcnRhbnQ7XG4gICAgICBsZWZ0OiA4MHB4O1xuICAgICAgdG9wOiA4MHB4O1xuICAgICAgdHJhbnNmb3JtOiBub25lICFpbXBvcnRhbnQ7XG4gICAgICBib3JkZXItcmFkaXVzOiAxMnB4O1xuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICAgIHJlc2l6ZTogbm9uZTtcbiAgICAgIG1pbi13aWR0aDogMjgwcHg7XG4gICAgICBtaW4taGVpZ2h0OiAzMjBweDtcbiAgICB9XG5cbiAgICAuZHJhZy1oYW5kbGUge1xuICAgICAgY3Vyc29yOiBncmFiO1xuICAgICAgdXNlci1zZWxlY3Q6IG5vbmU7XG4gICAgfVxuXG4gICAgLmRyYWctaGFuZGxlOmFjdGl2ZSB7XG4gICAgICBjdXJzb3I6IGdyYWJiaW5nO1xuICAgIH1cblxuICAgIC5mbG9hdC1yZXNpemUtY29ybmVyIHtcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgIGJvdHRvbTogMDtcbiAgICAgIHJpZ2h0OiAwO1xuICAgICAgd2lkdGg6IDE2cHg7XG4gICAgICBoZWlnaHQ6IDE2cHg7XG4gICAgICBjdXJzb3I6IHNlLXJlc2l6ZTtcbiAgICAgIGJhY2tncm91bmQ6IGxpbmVhci1ncmFkaWVudCgxMzVkZWcsIHRyYW5zcGFyZW50IDUwJSwgcmdiYSgyNTUsMjU1LDI1NSwwLjI1KSA1MCUpO1xuICAgICAgYm9yZGVyLWJvdHRvbS1yaWdodC1yYWRpdXM6IDEycHg7XG4gICAgfVxuXG4gICAgQG1lZGlhIChtYXgtd2lkdGg6IDQ4MHB4KSB7XG4gICAgICAuc2lkZWJhciB7XG4gICAgICAgIHdpZHRoOiAxMDAlICFpbXBvcnRhbnQ7XG4gICAgICB9XG4gICAgICAucmVzaXplLWhhbmRsZSB7XG4gICAgICAgIGRpc3BsYXk6IG5vbmU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLyog4pSA4pSAIExpZ2h0Ym94IChvdXRzaWRlIC5zaWRlYmFyIHNvIHBvc2l0aW9uOmZpeGVkIGlzIHZpZXdwb3J0LXJlbGF0aXZlKSDilIDilIAgKi9cbiAgICAubGItb3ZlcmxheSB7XG4gICAgICBwb3NpdGlvbjogZml4ZWQ7XG4gICAgICBpbnNldDogMDtcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMCwwLDAsMC44OCk7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgICAgei1pbmRleDogOTk5OTk7XG4gICAgICBjdXJzb3I6IHBvaW50ZXI7XG4gICAgfVxuXG4gICAgLmxiLW92ZXJsYXkubGItZGV0YWNoZWQge1xuICAgICAgaW5zZXQ6IHVuc2V0O1xuICAgICAgYmFja2dyb3VuZDogIzBjMWYzNTtcbiAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHJnYmEoMjU1LDI1NSwyNTUsMC4xOCk7XG4gICAgICBib3JkZXItcmFkaXVzOiAxMnB4O1xuICAgICAgYm94LXNoYWRvdzogMCAxMnB4IDQ4cHggcmdiYSgwLDAsMCwwLjcpO1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgY3Vyc29yOiBkZWZhdWx0O1xuICAgICAgbWluLXdpZHRoOiAyNDBweDtcbiAgICAgIG1pbi1oZWlnaHQ6IDIwMHB4O1xuICAgIH1cblxuICAgIC5sYi1kcmFnLWJhciB7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGp1c3RpZnktY29udGVudDogc3BhY2UtYmV0d2VlbjtcbiAgICAgIHBhZGRpbmc6IDZweCA4cHggNnB4IDEycHg7XG4gICAgICBiYWNrZ3JvdW5kOiAjMDQxMzIyO1xuICAgICAgYm9yZGVyLWJvdHRvbTogMXB4IHNvbGlkIHJnYmEoMjU1LDI1NSwyNTUsMC4xMik7XG4gICAgICBjdXJzb3I6IGdyYWI7XG4gICAgICBmbGV4LXNocmluazogMDtcbiAgICAgIHVzZXItc2VsZWN0OiBub25lO1xuICAgIH1cbiAgICAubGItZHJhZy1iYXI6YWN0aXZlIHsgY3Vyc29yOiBncmFiYmluZzsgfVxuXG4gICAgLmxiLWRyYWctdGl0bGUgeyBmb250LXNpemU6IDEycHg7IGNvbG9yOiByZ2JhKDI1NSwyNTUsMjU1LDAuNik7IGxldHRlci1zcGFjaW5nOiAwLjRweDsgfVxuICAgIC5sYi1kcmFnLWFjdGlvbnMgeyBkaXNwbGF5OiBmbGV4OyBnYXA6IDJweDsgfVxuXG4gICAgLmxiLWFjdGlvbi1idG4ge1xuICAgICAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQ7XG4gICAgICBib3JkZXI6IG5vbmU7XG4gICAgICBib3JkZXItcmFkaXVzOiA2cHg7XG4gICAgICB3aWR0aDogMjhweDsgaGVpZ2h0OiAyOHB4O1xuICAgICAgZGlzcGxheTogZmxleDsgYWxpZ24taXRlbXM6IGNlbnRlcjsganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgICBjdXJzb3I6IHBvaW50ZXI7XG4gICAgICBjb2xvcjogcmdiYSgyNTUsMjU1LDI1NSwwLjcpO1xuICAgICAgdHJhbnNpdGlvbjogYmFja2dyb3VuZCAwLjE1cztcbiAgICB9XG4gICAgLmxiLWFjdGlvbi1idG46aG92ZXIgeyBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwyNTUsMjU1LDAuMTUpOyB9XG4gICAgLmxiLWFjdGlvbi1idG4gbWF0LWljb24geyBmb250LXNpemU6IDE2cHg7IHdpZHRoOiAxNnB4OyBoZWlnaHQ6IDE2cHg7IH1cblxuICAgIC5sYi1pbWcge1xuICAgICAgbWF4LXdpZHRoOiA5MnZ3OyBtYXgtaGVpZ2h0OiA5MnZoO1xuICAgICAgYm9yZGVyLXJhZGl1czogOHB4O1xuICAgICAgYm94LXNoYWRvdzogMCA4cHggNDBweCByZ2JhKDAsMCwwLDAuNik7XG4gICAgICBjdXJzb3I6IGRlZmF1bHQ7XG4gICAgfVxuICAgIC5sYi1pbWcubGItaW1nLWRldGFjaGVkIHtcbiAgICAgIG1heC13aWR0aDogMTAwJTsgbWF4LWhlaWdodDogMTAwJTtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDA7IGJveC1zaGFkb3c6IG5vbmU7XG4gICAgICBvYmplY3QtZml0OiBjb250YWluOyBmbGV4OiAxO1xuICAgIH1cblxuICAgIC5sYi1jbG9zZSB7XG4gICAgICBwb3NpdGlvbjogYWJzb2x1dGU7IHRvcDogMTZweDsgcmlnaHQ6IDE2cHg7XG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwyNTUsMjU1LDAuMTUpOyBib3JkZXI6IG5vbmU7IGJvcmRlci1yYWRpdXM6IDUwJTtcbiAgICAgIHdpZHRoOiAzNnB4OyBoZWlnaHQ6IDM2cHg7XG4gICAgICBkaXNwbGF5OiBmbGV4OyBhbGlnbi1pdGVtczogY2VudGVyOyBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgIGN1cnNvcjogcG9pbnRlcjsgY29sb3I6ICNmZmY7IHRyYW5zaXRpb246IGJhY2tncm91bmQgMC4xNXM7XG4gICAgfVxuICAgIC5sYi1jbG9zZTpob3ZlciB7IGJhY2tncm91bmQ6IHJnYmEoMjU1LDI1NSwyNTUsMC4zKTsgfVxuXG4gICAgLmxiLWRldGFjaC1idG4ge1xuICAgICAgcG9zaXRpb246IGFic29sdXRlOyB0b3A6IDE2cHg7IHJpZ2h0OiA2MHB4O1xuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsMjU1LDI1NSwwLjE1KTsgYm9yZGVyOiBub25lOyBib3JkZXItcmFkaXVzOiA1MCU7XG4gICAgICB3aWR0aDogMzZweDsgaGVpZ2h0OiAzNnB4O1xuICAgICAgZGlzcGxheTogZmxleDsgYWxpZ24taXRlbXM6IGNlbnRlcjsganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgICBjdXJzb3I6IHBvaW50ZXI7IGNvbG9yOiAjZmZmOyB0cmFuc2l0aW9uOiBiYWNrZ3JvdW5kIDAuMTVzO1xuICAgIH1cbiAgICAubGItZGV0YWNoLWJ0bjpob3ZlciB7IGJhY2tncm91bmQ6IHJnYmEoMjU1LDI1NSwyNTUsMC4zKTsgfVxuXG4gICAgLmxiLXJlc2l6ZS1jb3JuZXIge1xuICAgICAgcG9zaXRpb246IGFic29sdXRlOyBib3R0b206IDA7IHJpZ2h0OiAwO1xuICAgICAgd2lkdGg6IDE2cHg7IGhlaWdodDogMTZweDtcbiAgICAgIGN1cnNvcjogc2UtcmVzaXplO1xuICAgICAgYmFja2dyb3VuZDogbGluZWFyLWdyYWRpZW50KDEzNWRlZywgdHJhbnNwYXJlbnQgNTAlLCByZ2JhKDI1NSwyNTUsMjU1LDAuMikgNTAlKTtcbiAgICAgIGJvcmRlci1ib3R0b20tcmlnaHQtcmFkaXVzOiAxMnB4O1xuICAgIH1cbiAgYF0sXG59KVxuZXhwb3J0IGNsYXNzIENoYXRQYW5lbENvbXBvbmVudCBpbXBsZW1lbnRzIE9uSW5pdCwgT25EZXN0cm95IHtcbiAgaXNPcGVuID0gZmFsc2U7XG4gIGFjdGl2ZVZpZXc6ICdpbmJveCcgfCAnY2hhdCcgfCAnbmV3LWNvbnZlcnNhdGlvbicgfCAnZ3JvdXAtbWFuYWdlcicgfCAnY29udmVyc2F0aW9uLXNldHRpbmdzJyA9ICdpbmJveCc7XG4gIHdzU3RhdHVzOiBzdHJpbmcgPSAnZGlzY29ubmVjdGVkJztcbiAgc2lkZTogU2lkZWJhclNpZGUgPSAncmlnaHQnO1xuICBzaWRlYmFyV2lkdGggPSA0MDA7XG5cbiAgLy8g4pSA4pSAIEZsb2F0aW5nIHdpbmRvdyBzdGF0ZSDilIDilIBcbiAgaXNGbG9hdGluZyA9IGZhbHNlO1xuICBmbG9hdFggPSA4MDtcbiAgZmxvYXRZID0gODA7XG4gIGZsb2F0V2lkdGggPSAzODA7XG4gIGZsb2F0SGVpZ2h0ID0gNTQwO1xuXG4gIHByaXZhdGUgZGVmYXVsdFdpZHRoID0gNDAwO1xuICBwcml2YXRlIHJlc2l6aW5nID0gZmFsc2U7XG4gIHByaXZhdGUgcmVzaXplU3RhcnRYID0gMDtcbiAgcHJpdmF0ZSByZXNpemVTdGFydFdpZHRoID0gMDtcbiAgcHJpdmF0ZSBib3VuZFJlc2l6ZU1vdmUgPSB0aGlzLm9uUmVzaXplTW92ZS5iaW5kKHRoaXMpO1xuICBwcml2YXRlIGJvdW5kUmVzaXplRW5kID0gdGhpcy5vblJlc2l6ZUVuZC5iaW5kKHRoaXMpO1xuXG4gIC8vIGZsb2F0IGRyYWdcbiAgcHJpdmF0ZSBmbG9hdERyYWdnaW5nID0gZmFsc2U7XG4gIHByaXZhdGUgZmxvYXREcmFnT2ZmWCA9IDA7XG4gIHByaXZhdGUgZmxvYXREcmFnT2ZmWSA9IDA7XG4gIHByaXZhdGUgYm91bmRGbG9hdE1vdmUgPSB0aGlzLm9uRmxvYXREcmFnTW92ZS5iaW5kKHRoaXMpO1xuICBwcml2YXRlIGJvdW5kRmxvYXRFbmQgID0gdGhpcy5vbkZsb2F0RHJhZ0VuZC5iaW5kKHRoaXMpO1xuXG4gIC8vIGZsb2F0IHJlc2l6ZVxuICBwcml2YXRlIGZsb2F0UmVzaXppbmcgPSBmYWxzZTtcbiAgcHJpdmF0ZSBmbG9hdFJlc2l6ZVN0YXJ0WCA9IDA7XG4gIHByaXZhdGUgZmxvYXRSZXNpemVTdGFydFkgPSAwO1xuICBwcml2YXRlIGZsb2F0UmVzaXplU3RhcnRXID0gMDtcbiAgcHJpdmF0ZSBmbG9hdFJlc2l6ZVN0YXJ0SCA9IDA7XG4gIHByaXZhdGUgYm91bmRGbG9hdFJlc2l6ZU1vdmUgPSB0aGlzLm9uRmxvYXRSZXNpemVNb3ZlLmJpbmQodGhpcyk7XG4gIHByaXZhdGUgYm91bmRGbG9hdFJlc2l6ZUVuZCAgPSB0aGlzLm9uRmxvYXRSZXNpemVFbmQuYmluZCh0aGlzKTtcblxuICBwcml2YXRlIHN1YiE6IFN1YnNjcmlwdGlvbjtcblxuICAvLyDilIDilIAgTGlnaHRib3ggc3RhdGUg4pSA4pSAXG4gIGxpZ2h0Ym94VXJsOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcbiAgbGlnaHRib3hEZXRhY2hlZCA9IGZhbHNlO1xuICBsaWdodGJveFggPSAxMDA7XG4gIGxpZ2h0Ym94WSA9IDgwO1xuICBsaWdodGJveFcgPSA1NjA7XG4gIGxpZ2h0Ym94SCA9IDQ2MDtcbiAgcHJpdmF0ZSBsYkRyYWdnaW5nID0gZmFsc2U7XG4gIHByaXZhdGUgbGJEcmFnT2ZmWCA9IDA7XG4gIHByaXZhdGUgbGJEcmFnT2ZmWSA9IDA7XG4gIHByaXZhdGUgbGJSZXNpemluZyA9IGZhbHNlO1xuICBwcml2YXRlIGxiUmVzaXplU3RhcnRYID0gMDtcbiAgcHJpdmF0ZSBsYlJlc2l6ZVN0YXJ0WSA9IDA7XG4gIHByaXZhdGUgbGJSZXNpemVTdGFydFcgPSAwO1xuICBwcml2YXRlIGxiUmVzaXplU3RhcnRIID0gMDtcbiAgcHJpdmF0ZSBib3VuZExiTW92ZSAgICAgICAgPSB0aGlzLm9uTGJEcmFnTW92ZS5iaW5kKHRoaXMpO1xuICBwcml2YXRlIGJvdW5kTGJFbmQgICAgICAgICA9IHRoaXMub25MYkRyYWdFbmQuYmluZCh0aGlzKTtcbiAgcHJpdmF0ZSBib3VuZExiUmVzaXplTW92ZSAgPSB0aGlzLm9uTGJSZXNpemVNb3ZlLmJpbmQodGhpcyk7XG4gIHByaXZhdGUgYm91bmRMYlJlc2l6ZUVuZCAgID0gdGhpcy5vbkxiUmVzaXplRW5kLmJpbmQodGhpcyk7XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSBzdG9yZTogTWVzc2FnaW5nU3RvcmVTZXJ2aWNlKSB7fVxuXG4gIG5nT25Jbml0KCk6IHZvaWQge1xuICAgIHRoaXMuc2lkZSA9IHRoaXMuc3RvcmUuZ2V0U2lkZWJhclNpZGUoKTtcbiAgICBjb25zdCBzYXZlZCA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdtZXNzYWdpbmdfc2lkZWJhcl93aWR0aCcpO1xuICAgIGlmIChzYXZlZCkgdGhpcy5zaWRlYmFyV2lkdGggPSBwYXJzZUludChzYXZlZCwgMTApIHx8IHRoaXMuZGVmYXVsdFdpZHRoO1xuXG4gICAgY29uc3Qgc2F2ZWRGbG9hdCA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdtZXNzYWdpbmdfZmxvYXRfc3RhdGUnKTtcbiAgICBpZiAoc2F2ZWRGbG9hdCkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgZiA9IEpTT04ucGFyc2Uoc2F2ZWRGbG9hdCk7XG4gICAgICAgIHRoaXMuaXNGbG9hdGluZyA9IGYuaXNGbG9hdGluZyA/PyBmYWxzZTtcbiAgICAgICAgdGhpcy5mbG9hdFggPSBmLnggPz8gODA7XG4gICAgICAgIHRoaXMuZmxvYXRZID0gZi55ID8/IDgwO1xuICAgICAgICB0aGlzLmZsb2F0V2lkdGggPSBmLncgPz8gMzgwO1xuICAgICAgICB0aGlzLmZsb2F0SGVpZ2h0ID0gZi5oID8/IDU0MDtcbiAgICAgIH0gY2F0Y2gge31cbiAgICB9XG5cbiAgICB0aGlzLnN1YiA9IGNvbWJpbmVMYXRlc3QoW1xuICAgICAgdGhpcy5zdG9yZS5wYW5lbE9wZW4sXG4gICAgICB0aGlzLnN0b3JlLmFjdGl2ZVZpZXcsXG4gICAgICB0aGlzLnN0b3JlLndzU3RhdHVzLFxuICAgICAgdGhpcy5zdG9yZS5zaWRlYmFyU2lkZSxcbiAgICBdKS5zdWJzY3JpYmUoKFtvcGVuLCB2aWV3LCB3cywgc2lkZV0pID0+IHtcbiAgICAgIHRoaXMuaXNPcGVuID0gb3BlbjtcbiAgICAgIHRoaXMuYWN0aXZlVmlldyA9IHZpZXc7XG4gICAgICB0aGlzLndzU3RhdHVzID0gd3M7XG4gICAgICB0aGlzLnNpZGUgPSBzaWRlO1xuICAgIH0pO1xuICB9XG5cbiAgbmdPbkRlc3Ryb3koKTogdm9pZCB7XG4gICAgdGhpcy5zdWI/LnVuc3Vic2NyaWJlKCk7XG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgdGhpcy5ib3VuZFJlc2l6ZU1vdmUpO1xuICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCB0aGlzLmJvdW5kUmVzaXplRW5kKTtcbiAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCB0aGlzLmJvdW5kRmxvYXRNb3ZlKTtcbiAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgdGhpcy5ib3VuZEZsb2F0RW5kKTtcbiAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCB0aGlzLmJvdW5kRmxvYXRSZXNpemVNb3ZlKTtcbiAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgdGhpcy5ib3VuZEZsb2F0UmVzaXplRW5kKTtcbiAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCB0aGlzLmJvdW5kTGJNb3ZlKTtcbiAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgdGhpcy5ib3VuZExiRW5kKTtcbiAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCB0aGlzLmJvdW5kTGJSZXNpemVNb3ZlKTtcbiAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgdGhpcy5ib3VuZExiUmVzaXplRW5kKTtcbiAgfVxuXG4gIC8vIOKUgOKUgCBMaWdodGJveCDilIDilIBcbiAgb3BlbkxpZ2h0Ym94KHVybDogc3RyaW5nKTogdm9pZCB7XG4gICAgdGhpcy5saWdodGJveFVybCA9IHVybDtcbiAgICB0aGlzLmxpZ2h0Ym94RGV0YWNoZWQgPSBmYWxzZTtcbiAgfVxuXG4gIG9uTGlnaHRib3hCYWNrZHJvcENsaWNrKGV2ZW50OiBNb3VzZUV2ZW50KTogdm9pZCB7XG4gICAgaWYgKHRoaXMubGlnaHRib3hEZXRhY2hlZCkgcmV0dXJuO1xuICAgIGlmIChldmVudC50YXJnZXQgIT09IGV2ZW50LmN1cnJlbnRUYXJnZXQpIHJldHVybjtcbiAgICB0aGlzLmxpZ2h0Ym94VXJsID0gbnVsbDtcbiAgfVxuXG4gIGRldGFjaExpZ2h0Ym94KCk6IHZvaWQge1xuICAgIHRoaXMubGlnaHRib3hEZXRhY2hlZCA9IHRydWU7XG4gICAgdGhpcy5saWdodGJveFggPSBNYXRoLm1heCgyMCwgTWF0aC5yb3VuZCgod2luZG93LmlubmVyV2lkdGggIC0gdGhpcy5saWdodGJveFcpIC8gMikpO1xuICAgIHRoaXMubGlnaHRib3hZID0gTWF0aC5tYXgoMjAsIE1hdGgucm91bmQoKHdpbmRvdy5pbm5lckhlaWdodCAtIHRoaXMubGlnaHRib3hIKSAvIDIpKTtcbiAgfVxuXG4gIG9uTGJEcmFnU3RhcnQoZXZlbnQ6IE1vdXNlRXZlbnQpOiB2b2lkIHtcbiAgICBpZiAoKGV2ZW50LnRhcmdldCBhcyBIVE1MRWxlbWVudCkuY2xvc2VzdCgnYnV0dG9uJykpIHJldHVybjtcbiAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIHRoaXMubGJEcmFnZ2luZyA9IHRydWU7XG4gICAgdGhpcy5sYkRyYWdPZmZYID0gZXZlbnQuY2xpZW50WCAtIHRoaXMubGlnaHRib3hYO1xuICAgIHRoaXMubGJEcmFnT2ZmWSA9IGV2ZW50LmNsaWVudFkgLSB0aGlzLmxpZ2h0Ym94WTtcbiAgICBkb2N1bWVudC5ib2R5LnN0eWxlLnVzZXJTZWxlY3QgPSAnbm9uZSc7XG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgdGhpcy5ib3VuZExiTW92ZSk7XG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsICAgdGhpcy5ib3VuZExiRW5kKTtcbiAgfVxuXG4gIHByaXZhdGUgb25MYkRyYWdNb3ZlKGV2ZW50OiBNb3VzZUV2ZW50KTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLmxiRHJhZ2dpbmcpIHJldHVybjtcbiAgICB0aGlzLmxpZ2h0Ym94WCA9IE1hdGgubWF4KDAsIE1hdGgubWluKGV2ZW50LmNsaWVudFggLSB0aGlzLmxiRHJhZ09mZlgsIHdpbmRvdy5pbm5lcldpZHRoICAtIHRoaXMubGlnaHRib3hXKSk7XG4gICAgdGhpcy5saWdodGJveFkgPSBNYXRoLm1heCgwLCBNYXRoLm1pbihldmVudC5jbGllbnRZIC0gdGhpcy5sYkRyYWdPZmZZLCB3aW5kb3cuaW5uZXJIZWlnaHQgLSA2MCkpO1xuICB9XG5cbiAgcHJpdmF0ZSBvbkxiRHJhZ0VuZCgpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMubGJEcmFnZ2luZykgcmV0dXJuO1xuICAgIHRoaXMubGJEcmFnZ2luZyA9IGZhbHNlO1xuICAgIGRvY3VtZW50LmJvZHkuc3R5bGUudXNlclNlbGVjdCA9ICcnO1xuICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIHRoaXMuYm91bmRMYk1vdmUpO1xuICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCAgIHRoaXMuYm91bmRMYkVuZCk7XG4gIH1cblxuICBvbkxiUmVzaXplU3RhcnQoZXZlbnQ6IE1vdXNlRXZlbnQpOiB2b2lkIHtcbiAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuICAgIHRoaXMubGJSZXNpemluZyA9IHRydWU7XG4gICAgdGhpcy5sYlJlc2l6ZVN0YXJ0WCA9IGV2ZW50LmNsaWVudFg7XG4gICAgdGhpcy5sYlJlc2l6ZVN0YXJ0WSA9IGV2ZW50LmNsaWVudFk7XG4gICAgdGhpcy5sYlJlc2l6ZVN0YXJ0VyA9IHRoaXMubGlnaHRib3hXO1xuICAgIHRoaXMubGJSZXNpemVTdGFydEggPSB0aGlzLmxpZ2h0Ym94SDtcbiAgICBkb2N1bWVudC5ib2R5LnN0eWxlLmN1cnNvciA9ICdzZS1yZXNpemUnO1xuICAgIGRvY3VtZW50LmJvZHkuc3R5bGUudXNlclNlbGVjdCA9ICdub25lJztcbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCB0aGlzLmJvdW5kTGJSZXNpemVNb3ZlKTtcbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgICB0aGlzLmJvdW5kTGJSZXNpemVFbmQpO1xuICB9XG5cbiAgcHJpdmF0ZSBvbkxiUmVzaXplTW92ZShldmVudDogTW91c2VFdmVudCk6IHZvaWQge1xuICAgIGlmICghdGhpcy5sYlJlc2l6aW5nKSByZXR1cm47XG4gICAgdGhpcy5saWdodGJveFcgPSBNYXRoLm1heCgyNDAsIHRoaXMubGJSZXNpemVTdGFydFcgKyAoZXZlbnQuY2xpZW50WCAtIHRoaXMubGJSZXNpemVTdGFydFgpKTtcbiAgICB0aGlzLmxpZ2h0Ym94SCA9IE1hdGgubWF4KDIwMCwgdGhpcy5sYlJlc2l6ZVN0YXJ0SCArIChldmVudC5jbGllbnRZIC0gdGhpcy5sYlJlc2l6ZVN0YXJ0WSkpO1xuICB9XG5cbiAgcHJpdmF0ZSBvbkxiUmVzaXplRW5kKCk6IHZvaWQge1xuICAgIGlmICghdGhpcy5sYlJlc2l6aW5nKSByZXR1cm47XG4gICAgdGhpcy5sYlJlc2l6aW5nID0gZmFsc2U7XG4gICAgZG9jdW1lbnQuYm9keS5zdHlsZS5jdXJzb3IgPSAnJztcbiAgICBkb2N1bWVudC5ib2R5LnN0eWxlLnVzZXJTZWxlY3QgPSAnJztcbiAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCB0aGlzLmJvdW5kTGJSZXNpemVNb3ZlKTtcbiAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgICB0aGlzLmJvdW5kTGJSZXNpemVFbmQpO1xuICB9XG5cbiAgdG9nZ2xlU2lkZSgpOiB2b2lkIHtcbiAgICB0aGlzLnN0b3JlLnRvZ2dsZVNpZGViYXJTaWRlKCk7XG4gIH1cblxuICBjbG9zZSgpOiB2b2lkIHtcbiAgICB0aGlzLnN0b3JlLmNsb3NlUGFuZWwoKTtcbiAgfVxuXG4gIHRvZ2dsZUZsb2F0KCk6IHZvaWQge1xuICAgIHRoaXMuaXNGbG9hdGluZyA9ICF0aGlzLmlzRmxvYXRpbmc7XG4gICAgaWYgKHRoaXMuaXNGbG9hdGluZykge1xuICAgICAgLy8gQ2VudHJlIHRoZSBmbG9hdCB3aW5kb3cgb24gc2NyZWVuIHdoZW4gZmlyc3QgcG9wcGluZyBvdXRcbiAgICAgIHRoaXMuZmxvYXRYID0gTWF0aC5tYXgoMjAsIE1hdGgucm91bmQoKHdpbmRvdy5pbm5lcldpZHRoICAtIHRoaXMuZmxvYXRXaWR0aCkgIC8gMikpO1xuICAgICAgdGhpcy5mbG9hdFkgPSBNYXRoLm1heCgyMCwgTWF0aC5yb3VuZCgod2luZG93LmlubmVySGVpZ2h0IC0gdGhpcy5mbG9hdEhlaWdodCkgLyAyKSk7XG4gICAgfVxuICAgIHRoaXMuc2F2ZUZsb2F0U3RhdGUoKTtcbiAgfVxuXG4gIC8vIOKUgOKUgCBTaWRlYmFyIHJlc2l6ZSDilIDilIBcbiAgb25SZXNpemVTdGFydChldmVudDogTW91c2VFdmVudCk6IHZvaWQge1xuICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgdGhpcy5yZXNpemluZyA9IHRydWU7XG4gICAgdGhpcy5yZXNpemVTdGFydFggPSBldmVudC5jbGllbnRYO1xuICAgIHRoaXMucmVzaXplU3RhcnRXaWR0aCA9IHRoaXMuc2lkZWJhcldpZHRoO1xuICAgIGRvY3VtZW50LmJvZHkuc3R5bGUuY3Vyc29yID0gJ2V3LXJlc2l6ZSc7XG4gICAgZG9jdW1lbnQuYm9keS5zdHlsZS51c2VyU2VsZWN0ID0gJ25vbmUnO1xuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIHRoaXMuYm91bmRSZXNpemVNb3ZlKTtcbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgdGhpcy5ib3VuZFJlc2l6ZUVuZCk7XG4gIH1cblxuICBwcml2YXRlIG9uUmVzaXplTW92ZShldmVudDogTW91c2VFdmVudCk6IHZvaWQge1xuICAgIGlmICghdGhpcy5yZXNpemluZykgcmV0dXJuO1xuICAgIGNvbnN0IGR4ID0gZXZlbnQuY2xpZW50WCAtIHRoaXMucmVzaXplU3RhcnRYO1xuICAgIGlmICh0aGlzLnNpZGUgPT09ICdyaWdodCcpIHtcbiAgICAgIHRoaXMuc2lkZWJhcldpZHRoID0gTWF0aC5tYXgoMjAwLCB0aGlzLnJlc2l6ZVN0YXJ0V2lkdGggLSBkeCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuc2lkZWJhcldpZHRoID0gTWF0aC5tYXgoMjAwLCB0aGlzLnJlc2l6ZVN0YXJ0V2lkdGggKyBkeCk7XG4gICAgfVxuICAgIHRoaXMuc2lkZWJhcldpZHRoID0gTWF0aC5taW4odGhpcy5zaWRlYmFyV2lkdGgsIHdpbmRvdy5pbm5lcldpZHRoICogMC45KTtcbiAgfVxuXG4gIHByaXZhdGUgb25SZXNpemVFbmQoKTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLnJlc2l6aW5nKSByZXR1cm47XG4gICAgdGhpcy5yZXNpemluZyA9IGZhbHNlO1xuICAgIGRvY3VtZW50LmJvZHkuc3R5bGUuY3Vyc29yID0gJyc7XG4gICAgZG9jdW1lbnQuYm9keS5zdHlsZS51c2VyU2VsZWN0ID0gJyc7XG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgdGhpcy5ib3VuZFJlc2l6ZU1vdmUpO1xuICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCB0aGlzLmJvdW5kUmVzaXplRW5kKTtcbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnbWVzc2FnaW5nX3NpZGViYXJfd2lkdGgnLCBTdHJpbmcodGhpcy5zaWRlYmFyV2lkdGgpKTtcbiAgfVxuXG4gIC8vIOKUgOKUgCBGbG9hdGluZyBwYW5lbCBkcmFnIOKUgOKUgFxuICBvbkZsb2F0RHJhZ1N0YXJ0KGV2ZW50OiBNb3VzZUV2ZW50KTogdm9pZCB7XG4gICAgLy8gSWdub3JlIGlmIGNvbWluZyBmcm9tIGEgYnV0dG9uIGluc2lkZSB0aGUgaGVhZGVyXG4gICAgaWYgKChldmVudC50YXJnZXQgYXMgSFRNTEVsZW1lbnQpLmNsb3Nlc3QoJ2J1dHRvbicpKSByZXR1cm47XG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICB0aGlzLmZsb2F0RHJhZ2dpbmcgPSB0cnVlO1xuICAgIHRoaXMuZmxvYXREcmFnT2ZmWCA9IGV2ZW50LmNsaWVudFggLSB0aGlzLmZsb2F0WDtcbiAgICB0aGlzLmZsb2F0RHJhZ09mZlkgPSBldmVudC5jbGllbnRZIC0gdGhpcy5mbG9hdFk7XG4gICAgZG9jdW1lbnQuYm9keS5zdHlsZS51c2VyU2VsZWN0ID0gJ25vbmUnO1xuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIHRoaXMuYm91bmRGbG9hdE1vdmUpO1xuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCB0aGlzLmJvdW5kRmxvYXRFbmQpO1xuICB9XG5cbiAgcHJpdmF0ZSBvbkZsb2F0RHJhZ01vdmUoZXZlbnQ6IE1vdXNlRXZlbnQpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMuZmxvYXREcmFnZ2luZykgcmV0dXJuO1xuICAgIHRoaXMuZmxvYXRYID0gTWF0aC5tYXgoMCwgTWF0aC5taW4oZXZlbnQuY2xpZW50WCAtIHRoaXMuZmxvYXREcmFnT2ZmWCwgd2luZG93LmlubmVyV2lkdGggIC0gdGhpcy5mbG9hdFdpZHRoKSk7XG4gICAgdGhpcy5mbG9hdFkgPSBNYXRoLm1heCgwLCBNYXRoLm1pbihldmVudC5jbGllbnRZIC0gdGhpcy5mbG9hdERyYWdPZmZZLCB3aW5kb3cuaW5uZXJIZWlnaHQgLSA2MCkpO1xuICB9XG5cbiAgcHJpdmF0ZSBvbkZsb2F0RHJhZ0VuZCgpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMuZmxvYXREcmFnZ2luZykgcmV0dXJuO1xuICAgIHRoaXMuZmxvYXREcmFnZ2luZyA9IGZhbHNlO1xuICAgIGRvY3VtZW50LmJvZHkuc3R5bGUudXNlclNlbGVjdCA9ICcnO1xuICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIHRoaXMuYm91bmRGbG9hdE1vdmUpO1xuICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCB0aGlzLmJvdW5kRmxvYXRFbmQpO1xuICAgIHRoaXMuc2F2ZUZsb2F0U3RhdGUoKTtcbiAgfVxuXG4gIC8vIOKUgOKUgCBGbG9hdGluZyBwYW5lbCByZXNpemUgKFNFIGNvcm5lcikg4pSA4pSAXG4gIG9uRmxvYXRSZXNpemVTdGFydChldmVudDogTW91c2VFdmVudCk6IHZvaWQge1xuICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgdGhpcy5mbG9hdFJlc2l6aW5nID0gdHJ1ZTtcbiAgICB0aGlzLmZsb2F0UmVzaXplU3RhcnRYID0gZXZlbnQuY2xpZW50WDtcbiAgICB0aGlzLmZsb2F0UmVzaXplU3RhcnRZID0gZXZlbnQuY2xpZW50WTtcbiAgICB0aGlzLmZsb2F0UmVzaXplU3RhcnRXID0gdGhpcy5mbG9hdFdpZHRoO1xuICAgIHRoaXMuZmxvYXRSZXNpemVTdGFydEggPSB0aGlzLmZsb2F0SGVpZ2h0O1xuICAgIGRvY3VtZW50LmJvZHkuc3R5bGUuY3Vyc29yID0gJ3NlLXJlc2l6ZSc7XG4gICAgZG9jdW1lbnQuYm9keS5zdHlsZS51c2VyU2VsZWN0ID0gJ25vbmUnO1xuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIHRoaXMuYm91bmRGbG9hdFJlc2l6ZU1vdmUpO1xuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCB0aGlzLmJvdW5kRmxvYXRSZXNpemVFbmQpO1xuICB9XG5cbiAgcHJpdmF0ZSBvbkZsb2F0UmVzaXplTW92ZShldmVudDogTW91c2VFdmVudCk6IHZvaWQge1xuICAgIGlmICghdGhpcy5mbG9hdFJlc2l6aW5nKSByZXR1cm47XG4gICAgdGhpcy5mbG9hdFdpZHRoICA9IE1hdGgubWF4KDI4MCwgdGhpcy5mbG9hdFJlc2l6ZVN0YXJ0VyArIChldmVudC5jbGllbnRYIC0gdGhpcy5mbG9hdFJlc2l6ZVN0YXJ0WCkpO1xuICAgIHRoaXMuZmxvYXRIZWlnaHQgPSBNYXRoLm1heCgzMjAsIHRoaXMuZmxvYXRSZXNpemVTdGFydEggKyAoZXZlbnQuY2xpZW50WSAtIHRoaXMuZmxvYXRSZXNpemVTdGFydFkpKTtcbiAgfVxuXG4gIHByaXZhdGUgb25GbG9hdFJlc2l6ZUVuZCgpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMuZmxvYXRSZXNpemluZykgcmV0dXJuO1xuICAgIHRoaXMuZmxvYXRSZXNpemluZyA9IGZhbHNlO1xuICAgIGRvY3VtZW50LmJvZHkuc3R5bGUuY3Vyc29yID0gJyc7XG4gICAgZG9jdW1lbnQuYm9keS5zdHlsZS51c2VyU2VsZWN0ID0gJyc7XG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgdGhpcy5ib3VuZEZsb2F0UmVzaXplTW92ZSk7XG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIHRoaXMuYm91bmRGbG9hdFJlc2l6ZUVuZCk7XG4gICAgdGhpcy5zYXZlRmxvYXRTdGF0ZSgpO1xuICB9XG5cbiAgcHJpdmF0ZSBzYXZlRmxvYXRTdGF0ZSgpOiB2b2lkIHtcbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnbWVzc2FnaW5nX2Zsb2F0X3N0YXRlJywgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgaXNGbG9hdGluZzogdGhpcy5pc0Zsb2F0aW5nLFxuICAgICAgeDogdGhpcy5mbG9hdFgsXG4gICAgICB5OiB0aGlzLmZsb2F0WSxcbiAgICAgIHc6IHRoaXMuZmxvYXRXaWR0aCxcbiAgICAgIGg6IHRoaXMuZmxvYXRIZWlnaHQsXG4gICAgfSkpO1xuICB9XG59XG4iXX0=