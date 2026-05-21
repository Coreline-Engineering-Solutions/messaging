import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
    toast = null;
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
                this.store.setPanelFloating(this.isFloating);
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
            this.store.toast,
        ]).subscribe(([open, view, ws, side, toast]) => {
            this.isOpen = open;
            this.activeView = view;
            this.wsStatus = ws;
            this.side = side;
            this.toast = toast;
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
    openNewConversation() {
        this.store.setView('new-conversation');
    }
    openGroupManager() {
        this.store.setView('group-manager');
    }
    getStatusTooltip() {
        if (this.wsStatus === 'authenticated')
            return 'Connected';
        if (this.wsStatus === 'connecting')
            return 'Connecting';
        return 'Disconnected';
    }
    close() {
        this.store.closePanel();
    }
    toggleFloat() {
        this.isFloating = !this.isFloating;
        this.store.setPanelFloating(this.isFloating);
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

      <div *ngIf="toast" class="messaging-toast" [class.success]="toast.type === 'success'" [class.error]="toast.type === 'error'">
        <mat-icon>{{ toast.type === 'error' ? 'error' : toast.type === 'success' ? 'check_circle' : 'info' }}</mat-icon>
        <span>{{ toast.message }}</span>
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
  `, isInline: true, styles: [".sidebar{position:fixed;top:0;bottom:0;width:400px;background:#041322;z-index:9999;display:flex;flex-direction:column;box-shadow:0 0 40px #0009;transition:transform .3s cubic-bezier(.4,0,.2,1);container-type:inline-size}.sidebar.side-right{right:0;transform:translate(100%)}.sidebar.side-left{left:0;transform:translate(-100%)}.sidebar.open.side-right,.sidebar.open.side-left{transform:translate(0)}.resize-handle{position:absolute;top:0;bottom:0;width:5px;cursor:ew-resize;z-index:1;transition:background .15s}.resize-handle:hover,.resize-handle:active{background:#ffffff26}.resize-handle.handle-left{left:0}.resize-handle.handle-right{right:0}.sidebar-header{display:flex;align-items:center;justify-content:space-between;padding:8px 10px 8px 14px;border-bottom:1px solid rgba(255,255,255,.15);flex-shrink:0;position:relative;z-index:2;min-height:48px}.header-left{display:flex;align-items:center;gap:8px;min-width:0;flex:1 1 auto}.header-title{font-size:clamp(11px,5cqw,16px);font-weight:700;color:#fff;letter-spacing:.3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.header-actions{display:flex;align-items:center;gap:0;flex-shrink:0}.btn-spacer{width:12px}.hdr-btn{width:32px;height:32px;min-width:32px;padding:0;display:inline-flex;align-items:center;justify-content:center;border-radius:6px!important;transition:background .15s,box-shadow .15s;--mdc-icon-button-state-layer-size: 32px}.hdr-btn .mat-mdc-button-touch-target{width:32px;height:32px}.hdr-btn:hover{background:#ffffff26!important;box-shadow:0 2px 8px #0003}.hdr-btn mat-icon{font-size:20px;color:#ffffffd9}@container (max-width: 330px){.sidebar-header{padding:8px 6px 8px 10px}.header-title{display:none}.header-left{flex:0 0 auto;gap:0}.btn-spacer{width:4px}.hdr-btn{width:28px;height:28px;min-width:28px;--mdc-icon-button-state-layer-size: 28px}.hdr-btn mat-icon{font-size:18px}}.sidebar-content{flex:1;overflow:hidden}.messaging-toast{position:absolute;left:16px;right:16px;bottom:16px;z-index:5;display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:10px;background:#192a3ff5;border:1px solid rgba(255,255,255,.14);box-shadow:0 10px 26px #00000059;color:#fff;font-size:13px;pointer-events:none}.messaging-toast.success{background:#14532df5;border-color:#22c55e66}.messaging-toast.error{background:#7f1d1df5;border-color:#f8717173}.messaging-toast mat-icon{font-size:18px;width:18px;height:18px}.status-dot{width:8px;height:8px;border-radius:50%;background:#fff6;flex-shrink:0}.status-dot.connected{background:#22c55e;box-shadow:0 0 0 3px #22c55e2e}.status-dot.connecting{background:#f59e0b;animation:blink 1s infinite}.status-dot.disconnected{background:#ef4444;box-shadow:0 0 0 3px #ef444424}@keyframes blink{50%{opacity:.3}}.sidebar.floating{position:fixed!important;right:unset!important;left:80px;top:80px;transform:none!important;border-radius:12px;overflow:hidden;resize:none;min-width:280px;min-height:320px}.sidebar.floating:not(.open){display:none}.drag-handle{cursor:grab;-webkit-user-select:none;user-select:none}.drag-handle:active{cursor:grabbing}.float-resize-corner{position:absolute;bottom:0;right:0;width:16px;height:16px;cursor:se-resize;background:linear-gradient(135deg,transparent 50%,rgba(255,255,255,.25) 50%);border-bottom-right-radius:12px}@media (max-width: 480px){.sidebar{width:100%!important}.resize-handle{display:none}}.lb-overlay{position:fixed;inset:0;background:#000000e0;display:flex;align-items:center;justify-content:center;z-index:99999;cursor:pointer}.lb-overlay.lb-detached{inset:unset;background:#0c1f35;border:1px solid rgba(255,255,255,.18);border-radius:12px;box-shadow:0 12px 48px #000000b3;display:flex;flex-direction:column;overflow:hidden;cursor:default;min-width:240px;min-height:200px}.lb-drag-bar{display:flex;align-items:center;justify-content:space-between;padding:6px 8px 6px 12px;background:#041322;border-bottom:1px solid rgba(255,255,255,.12);cursor:grab;flex-shrink:0;-webkit-user-select:none;user-select:none}.lb-drag-bar:active{cursor:grabbing}.lb-drag-title{font-size:12px;color:#fff9;letter-spacing:.4px}.lb-drag-actions{display:flex;gap:2px}.lb-action-btn{background:transparent;border:none;border-radius:6px;width:28px;height:28px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#ffffffb3;transition:background .15s}.lb-action-btn:hover{background:#ffffff26}.lb-action-btn mat-icon{font-size:16px;width:16px;height:16px}.lb-img{max-width:92vw;max-height:92vh;border-radius:8px;box-shadow:0 8px 40px #0009;cursor:default}.lb-img.lb-img-detached{max-width:100%;max-height:100%;border-radius:0;box-shadow:none;object-fit:contain;flex:1}.lb-close{position:absolute;top:16px;right:16px;background:#ffffff26;border:none;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#fff;transition:background .15s}.lb-close:hover{background:#ffffff4d}.lb-detach-btn{position:absolute;top:16px;right:60px;background:#ffffff26;border:none;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#fff;transition:background .15s}.lb-detach-btn:hover{background:#ffffff4d}.lb-resize-corner{position:absolute;bottom:0;right:0;width:16px;height:16px;cursor:se-resize;background:linear-gradient(135deg,transparent 50%,rgba(255,255,255,.2) 50%);border-bottom-right-radius:12px}\n"], dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i2.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "ngmodule", type: FormsModule }, { kind: "ngmodule", type: MatIconModule }, { kind: "component", type: i3.MatIcon, selector: "mat-icon", inputs: ["color", "inline", "svgIcon", "fontSet", "fontIcon"], exportAs: ["matIcon"] }, { kind: "ngmodule", type: MatButtonModule }, { kind: "component", type: i4.MatIconButton, selector: "button[mat-icon-button]", exportAs: ["matButton"] }, { kind: "ngmodule", type: MatTooltipModule }, { kind: "directive", type: i5.MatTooltip, selector: "[matTooltip]", inputs: ["matTooltipPosition", "matTooltipPositionAtOrigin", "matTooltipDisabled", "matTooltipShowDelay", "matTooltipHideDelay", "matTooltipTouchGestures", "matTooltip", "matTooltipClass"], exportAs: ["matTooltip"] }, { kind: "component", type: InboxListComponent, selector: "app-inbox-list" }, { kind: "component", type: ChatThreadComponent, selector: "app-chat-thread", outputs: ["lightboxOpen"] }, { kind: "component", type: NewConversationComponent, selector: "app-new-conversation" }, { kind: "component", type: GroupManagerComponent, selector: "app-group-manager" }] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: ChatPanelComponent, decorators: [{
            type: Component,
            args: [{ selector: 'app-chat-panel', standalone: true, imports: [
                        CommonModule, FormsModule, MatIconModule, MatButtonModule, MatTooltipModule,
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

      <div *ngIf="toast" class="messaging-toast" [class.success]="toast.type === 'success'" [class.error]="toast.type === 'error'">
        <mat-icon>{{ toast.type === 'error' ? 'error' : toast.type === 'success' ? 'check_circle' : 'info' }}</mat-icon>
        <span>{{ toast.message }}</span>
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
  `, styles: [".sidebar{position:fixed;top:0;bottom:0;width:400px;background:#041322;z-index:9999;display:flex;flex-direction:column;box-shadow:0 0 40px #0009;transition:transform .3s cubic-bezier(.4,0,.2,1);container-type:inline-size}.sidebar.side-right{right:0;transform:translate(100%)}.sidebar.side-left{left:0;transform:translate(-100%)}.sidebar.open.side-right,.sidebar.open.side-left{transform:translate(0)}.resize-handle{position:absolute;top:0;bottom:0;width:5px;cursor:ew-resize;z-index:1;transition:background .15s}.resize-handle:hover,.resize-handle:active{background:#ffffff26}.resize-handle.handle-left{left:0}.resize-handle.handle-right{right:0}.sidebar-header{display:flex;align-items:center;justify-content:space-between;padding:8px 10px 8px 14px;border-bottom:1px solid rgba(255,255,255,.15);flex-shrink:0;position:relative;z-index:2;min-height:48px}.header-left{display:flex;align-items:center;gap:8px;min-width:0;flex:1 1 auto}.header-title{font-size:clamp(11px,5cqw,16px);font-weight:700;color:#fff;letter-spacing:.3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.header-actions{display:flex;align-items:center;gap:0;flex-shrink:0}.btn-spacer{width:12px}.hdr-btn{width:32px;height:32px;min-width:32px;padding:0;display:inline-flex;align-items:center;justify-content:center;border-radius:6px!important;transition:background .15s,box-shadow .15s;--mdc-icon-button-state-layer-size: 32px}.hdr-btn .mat-mdc-button-touch-target{width:32px;height:32px}.hdr-btn:hover{background:#ffffff26!important;box-shadow:0 2px 8px #0003}.hdr-btn mat-icon{font-size:20px;color:#ffffffd9}@container (max-width: 330px){.sidebar-header{padding:8px 6px 8px 10px}.header-title{display:none}.header-left{flex:0 0 auto;gap:0}.btn-spacer{width:4px}.hdr-btn{width:28px;height:28px;min-width:28px;--mdc-icon-button-state-layer-size: 28px}.hdr-btn mat-icon{font-size:18px}}.sidebar-content{flex:1;overflow:hidden}.messaging-toast{position:absolute;left:16px;right:16px;bottom:16px;z-index:5;display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:10px;background:#192a3ff5;border:1px solid rgba(255,255,255,.14);box-shadow:0 10px 26px #00000059;color:#fff;font-size:13px;pointer-events:none}.messaging-toast.success{background:#14532df5;border-color:#22c55e66}.messaging-toast.error{background:#7f1d1df5;border-color:#f8717173}.messaging-toast mat-icon{font-size:18px;width:18px;height:18px}.status-dot{width:8px;height:8px;border-radius:50%;background:#fff6;flex-shrink:0}.status-dot.connected{background:#22c55e;box-shadow:0 0 0 3px #22c55e2e}.status-dot.connecting{background:#f59e0b;animation:blink 1s infinite}.status-dot.disconnected{background:#ef4444;box-shadow:0 0 0 3px #ef444424}@keyframes blink{50%{opacity:.3}}.sidebar.floating{position:fixed!important;right:unset!important;left:80px;top:80px;transform:none!important;border-radius:12px;overflow:hidden;resize:none;min-width:280px;min-height:320px}.sidebar.floating:not(.open){display:none}.drag-handle{cursor:grab;-webkit-user-select:none;user-select:none}.drag-handle:active{cursor:grabbing}.float-resize-corner{position:absolute;bottom:0;right:0;width:16px;height:16px;cursor:se-resize;background:linear-gradient(135deg,transparent 50%,rgba(255,255,255,.25) 50%);border-bottom-right-radius:12px}@media (max-width: 480px){.sidebar{width:100%!important}.resize-handle{display:none}}.lb-overlay{position:fixed;inset:0;background:#000000e0;display:flex;align-items:center;justify-content:center;z-index:99999;cursor:pointer}.lb-overlay.lb-detached{inset:unset;background:#0c1f35;border:1px solid rgba(255,255,255,.18);border-radius:12px;box-shadow:0 12px 48px #000000b3;display:flex;flex-direction:column;overflow:hidden;cursor:default;min-width:240px;min-height:200px}.lb-drag-bar{display:flex;align-items:center;justify-content:space-between;padding:6px 8px 6px 12px;background:#041322;border-bottom:1px solid rgba(255,255,255,.12);cursor:grab;flex-shrink:0;-webkit-user-select:none;user-select:none}.lb-drag-bar:active{cursor:grabbing}.lb-drag-title{font-size:12px;color:#fff9;letter-spacing:.4px}.lb-drag-actions{display:flex;gap:2px}.lb-action-btn{background:transparent;border:none;border-radius:6px;width:28px;height:28px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#ffffffb3;transition:background .15s}.lb-action-btn:hover{background:#ffffff26}.lb-action-btn mat-icon{font-size:16px;width:16px;height:16px}.lb-img{max-width:92vw;max-height:92vh;border-radius:8px;box-shadow:0 8px 40px #0009;cursor:default}.lb-img.lb-img-detached{max-width:100%;max-height:100%;border-radius:0;box-shadow:none;object-fit:contain;flex:1}.lb-close{position:absolute;top:16px;right:16px;background:#ffffff26;border:none;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#fff;transition:background .15s}.lb-close:hover{background:#ffffff4d}.lb-detach-btn{position:absolute;top:16px;right:60px;background:#ffffff26;border:none;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#fff;transition:background .15s}.lb-detach-btn:hover{background:#ffffff4d}.lb-resize-corner{position:absolute;bottom:0;right:0;width:16px;height:16px;cursor:se-resize;background:linear-gradient(135deg,transparent 50%,rgba(255,255,255,.2) 50%);border-bottom-right-radius:12px}\n"] }]
        }], ctorParameters: () => [{ type: i1.MessagingStoreService }] });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdC1wYW5lbC5jb21wb25lbnQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvbGliL2NvbXBvbmVudHMvY2hhdC1wYW5lbC9jaGF0LXBhbmVsLmNvbXBvbmVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsU0FBUyxFQUFxQixNQUFNLGVBQWUsQ0FBQztBQUM3RCxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDL0MsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLGdCQUFnQixDQUFDO0FBQzdDLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSx3QkFBd0IsQ0FBQztBQUN2RCxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFDM0QsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sMkJBQTJCLENBQUM7QUFDN0QsT0FBTyxFQUFnQixhQUFhLEVBQUUsTUFBTSxNQUFNLENBQUM7QUFHbkQsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDeEUsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDM0UsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFDMUYsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sMENBQTBDLENBQUM7Ozs7Ozs7QUE4ZmpGLE1BQU0sT0FBTyxrQkFBa0I7SUE0RFQ7SUEzRHBCLE1BQU0sR0FBRyxLQUFLLENBQUM7SUFDZixVQUFVLEdBQXNGLE9BQU8sQ0FBQztJQUN4RyxRQUFRLEdBQVcsY0FBYyxDQUFDO0lBQ2xDLElBQUksR0FBZ0IsT0FBTyxDQUFDO0lBQzVCLFlBQVksR0FBRyxHQUFHLENBQUM7SUFDbkIsS0FBSyxHQUFtRSxJQUFJLENBQUM7SUFFN0UsOEJBQThCO0lBQzlCLFVBQVUsR0FBRyxLQUFLLENBQUM7SUFDbkIsTUFBTSxHQUFHLEVBQUUsQ0FBQztJQUNaLE1BQU0sR0FBRyxFQUFFLENBQUM7SUFDWixVQUFVLEdBQUcsR0FBRyxDQUFDO0lBQ2pCLFdBQVcsR0FBRyxHQUFHLENBQUM7SUFFVixZQUFZLEdBQUcsR0FBRyxDQUFDO0lBQ25CLFFBQVEsR0FBRyxLQUFLLENBQUM7SUFDakIsWUFBWSxHQUFHLENBQUMsQ0FBQztJQUNqQixnQkFBZ0IsR0FBRyxDQUFDLENBQUM7SUFDckIsZUFBZSxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQy9DLGNBQWMsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUVyRCxhQUFhO0lBQ0wsYUFBYSxHQUFHLEtBQUssQ0FBQztJQUN0QixhQUFhLEdBQUcsQ0FBQyxDQUFDO0lBQ2xCLGFBQWEsR0FBRyxDQUFDLENBQUM7SUFDbEIsY0FBYyxHQUFHLElBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ2pELGFBQWEsR0FBSSxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUV4RCxlQUFlO0lBQ1AsYUFBYSxHQUFHLEtBQUssQ0FBQztJQUN0QixpQkFBaUIsR0FBRyxDQUFDLENBQUM7SUFDdEIsaUJBQWlCLEdBQUcsQ0FBQyxDQUFDO0lBQ3RCLGlCQUFpQixHQUFHLENBQUMsQ0FBQztJQUN0QixpQkFBaUIsR0FBRyxDQUFDLENBQUM7SUFDdEIsb0JBQW9CLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUN6RCxtQkFBbUIsR0FBSSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBRXhELEdBQUcsQ0FBZ0I7SUFFM0IsdUJBQXVCO0lBQ3ZCLFdBQVcsR0FBa0IsSUFBSSxDQUFDO0lBQ2xDLGdCQUFnQixHQUFHLEtBQUssQ0FBQztJQUN6QixTQUFTLEdBQUcsR0FBRyxDQUFDO0lBQ2hCLFNBQVMsR0FBRyxFQUFFLENBQUM7SUFDZixTQUFTLEdBQUcsR0FBRyxDQUFDO0lBQ2hCLFNBQVMsR0FBRyxHQUFHLENBQUM7SUFDUixVQUFVLEdBQUcsS0FBSyxDQUFDO0lBQ25CLFVBQVUsR0FBRyxDQUFDLENBQUM7SUFDZixVQUFVLEdBQUcsQ0FBQyxDQUFDO0lBQ2YsVUFBVSxHQUFHLEtBQUssQ0FBQztJQUNuQixjQUFjLEdBQUcsQ0FBQyxDQUFDO0lBQ25CLGNBQWMsR0FBRyxDQUFDLENBQUM7SUFDbkIsY0FBYyxHQUFHLENBQUMsQ0FBQztJQUNuQixjQUFjLEdBQUcsQ0FBQyxDQUFDO0lBQ25CLFdBQVcsR0FBVSxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUNsRCxVQUFVLEdBQVcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDakQsaUJBQWlCLEdBQUksSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDcEQsZ0JBQWdCLEdBQUssSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7SUFFM0QsWUFBb0IsS0FBNEI7UUFBNUIsVUFBSyxHQUFMLEtBQUssQ0FBdUI7SUFBRyxDQUFDO0lBRXBELFFBQVE7UUFDTixJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsY0FBYyxFQUFFLENBQUM7UUFDeEMsTUFBTSxLQUFLLEdBQUcsWUFBWSxDQUFDLE9BQU8sQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO1FBQzlELElBQUksS0FBSztZQUFFLElBQUksQ0FBQyxZQUFZLEdBQUcsUUFBUSxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsSUFBSSxJQUFJLENBQUMsWUFBWSxDQUFDO1FBRXhFLE1BQU0sVUFBVSxHQUFHLFlBQVksQ0FBQyxPQUFPLENBQUMsdUJBQXVCLENBQUMsQ0FBQztRQUNqRSxJQUFJLFVBQVUsRUFBRSxDQUFDO1lBQ2YsSUFBSSxDQUFDO2dCQUNILE1BQU0sQ0FBQyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLENBQUM7Z0JBQ2pDLElBQUksQ0FBQyxVQUFVLEdBQUcsQ0FBQyxDQUFDLFVBQVUsSUFBSSxLQUFLLENBQUM7Z0JBQ3hDLElBQUksQ0FBQyxLQUFLLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO2dCQUM3QyxJQUFJLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDO2dCQUN4QixJQUFJLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDO2dCQUN4QixJQUFJLENBQUMsVUFBVSxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksR0FBRyxDQUFDO2dCQUM3QixJQUFJLENBQUMsV0FBVyxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksR0FBRyxDQUFDO1lBQ2hDLENBQUM7WUFBQyxNQUFNLENBQUMsQ0FBQSxDQUFDO1FBQ1osQ0FBQztRQUVELElBQUksQ0FBQyxHQUFHLEdBQUcsYUFBYSxDQUFDO1lBQ3ZCLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUztZQUNwQixJQUFJLENBQUMsS0FBSyxDQUFDLFVBQVU7WUFDckIsSUFBSSxDQUFDLEtBQUssQ0FBQyxRQUFRO1lBQ25CLElBQUksQ0FBQyxLQUFLLENBQUMsV0FBVztZQUN0QixJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUs7U0FDakIsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxFQUFFLEVBQUUsSUFBSSxFQUFFLEtBQUssQ0FBQyxFQUFFLEVBQUU7WUFDN0MsSUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUM7WUFDbkIsSUFBSSxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUM7WUFDdkIsSUFBSSxDQUFDLFFBQVEsR0FBRyxFQUFFLENBQUM7WUFDbkIsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUM7WUFDakIsSUFBSSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7UUFDckIsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQsV0FBVztRQUNULElBQUksQ0FBQyxHQUFHLEVBQUUsV0FBVyxFQUFFLENBQUM7UUFDeEIsUUFBUSxDQUFDLG1CQUFtQixDQUFDLFdBQVcsRUFBRSxJQUFJLENBQUMsZUFBZSxDQUFDLENBQUM7UUFDaEUsUUFBUSxDQUFDLG1CQUFtQixDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUM7UUFDN0QsUUFBUSxDQUFDLG1CQUFtQixDQUFDLFdBQVcsRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUM7UUFDL0QsUUFBUSxDQUFDLG1CQUFtQixDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUM7UUFDNUQsUUFBUSxDQUFDLG1CQUFtQixDQUFDLFdBQVcsRUFBRSxJQUFJLENBQUMsb0JBQW9CLENBQUMsQ0FBQztRQUNyRSxRQUFRLENBQUMsbUJBQW1CLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO1FBQ2xFLFFBQVEsQ0FBQyxtQkFBbUIsQ0FBQyxXQUFXLEVBQUUsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQzVELFFBQVEsQ0FBQyxtQkFBbUIsQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQ3pELFFBQVEsQ0FBQyxtQkFBbUIsQ0FBQyxXQUFXLEVBQUUsSUFBSSxDQUFDLGlCQUFpQixDQUFDLENBQUM7UUFDbEUsUUFBUSxDQUFDLG1CQUFtQixDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztJQUNqRSxDQUFDO0lBRUQsaUJBQWlCO0lBQ2pCLFlBQVksQ0FBQyxHQUFXO1FBQ3RCLElBQUksQ0FBQyxXQUFXLEdBQUcsR0FBRyxDQUFDO1FBQ3ZCLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxLQUFLLENBQUM7SUFDaEMsQ0FBQztJQUVELHVCQUF1QixDQUFDLEtBQWlCO1FBQ3ZDLElBQUksSUFBSSxDQUFDLGdCQUFnQjtZQUFFLE9BQU87UUFDbEMsSUFBSSxLQUFLLENBQUMsTUFBTSxLQUFLLEtBQUssQ0FBQyxhQUFhO1lBQUUsT0FBTztRQUNqRCxJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQztJQUMxQixDQUFDO0lBRUQsY0FBYztRQUNaLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxJQUFJLENBQUM7UUFDN0IsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsTUFBTSxDQUFDLFVBQVUsR0FBSSxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNyRixJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxNQUFNLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3ZGLENBQUM7SUFFRCxhQUFhLENBQUMsS0FBaUI7UUFDN0IsSUFBSyxLQUFLLENBQUMsTUFBc0IsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDO1lBQUUsT0FBTztRQUM1RCxLQUFLLENBQUMsY0FBYyxFQUFFLENBQUM7UUFDdkIsSUFBSSxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUM7UUFDdkIsSUFBSSxDQUFDLFVBQVUsR0FBRyxLQUFLLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUM7UUFDakQsSUFBSSxDQUFDLFVBQVUsR0FBRyxLQUFLLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUM7UUFDakQsUUFBUSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsVUFBVSxHQUFHLE1BQU0sQ0FBQztRQUN4QyxRQUFRLENBQUMsZ0JBQWdCLENBQUMsV0FBVyxFQUFFLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUN6RCxRQUFRLENBQUMsZ0JBQWdCLENBQUMsU0FBUyxFQUFJLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUMxRCxDQUFDO0lBRU8sWUFBWSxDQUFDLEtBQWlCO1FBQ3BDLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVTtZQUFFLE9BQU87UUFDN0IsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDLFVBQVUsRUFBRSxNQUFNLENBQUMsVUFBVSxHQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO1FBQzdHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQyxVQUFVLEVBQUUsTUFBTSxDQUFDLFdBQVcsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ25HLENBQUM7SUFFTyxXQUFXO1FBQ2pCLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVTtZQUFFLE9BQU87UUFDN0IsSUFBSSxDQUFDLFVBQVUsR0FBRyxLQUFLLENBQUM7UUFDeEIsUUFBUSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsVUFBVSxHQUFHLEVBQUUsQ0FBQztRQUNwQyxRQUFRLENBQUMsbUJBQW1CLENBQUMsV0FBVyxFQUFFLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUM1RCxRQUFRLENBQUMsbUJBQW1CLENBQUMsU0FBUyxFQUFJLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUM3RCxDQUFDO0lBRUQsZUFBZSxDQUFDLEtBQWlCO1FBQy9CLEtBQUssQ0FBQyxjQUFjLEVBQUUsQ0FBQztRQUN2QixLQUFLLENBQUMsZUFBZSxFQUFFLENBQUM7UUFDeEIsSUFBSSxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUM7UUFDdkIsSUFBSSxDQUFDLGNBQWMsR0FBRyxLQUFLLENBQUMsT0FBTyxDQUFDO1FBQ3BDLElBQUksQ0FBQyxjQUFjLEdBQUcsS0FBSyxDQUFDLE9BQU8sQ0FBQztRQUNwQyxJQUFJLENBQUMsY0FBYyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUM7UUFDckMsSUFBSSxDQUFDLGNBQWMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDO1FBQ3JDLFFBQVEsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxXQUFXLENBQUM7UUFDekMsUUFBUSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsVUFBVSxHQUFHLE1BQU0sQ0FBQztRQUN4QyxRQUFRLENBQUMsZ0JBQWdCLENBQUMsV0FBVyxFQUFFLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO1FBQy9ELFFBQVEsQ0FBQyxnQkFBZ0IsQ0FBQyxTQUFTLEVBQUksSUFBSSxDQUFDLGdCQUFnQixDQUFDLENBQUM7SUFDaEUsQ0FBQztJQUVPLGNBQWMsQ0FBQyxLQUFpQjtRQUN0QyxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVU7WUFBRSxPQUFPO1FBQzdCLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLGNBQWMsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUM7UUFDNUYsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsY0FBYyxHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQztJQUM5RixDQUFDO0lBRU8sYUFBYTtRQUNuQixJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVU7WUFBRSxPQUFPO1FBQzdCLElBQUksQ0FBQyxVQUFVLEdBQUcsS0FBSyxDQUFDO1FBQ3hCLFFBQVEsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxFQUFFLENBQUM7UUFDaEMsUUFBUSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsVUFBVSxHQUFHLEVBQUUsQ0FBQztRQUNwQyxRQUFRLENBQUMsbUJBQW1CLENBQUMsV0FBVyxFQUFFLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO1FBQ2xFLFFBQVEsQ0FBQyxtQkFBbUIsQ0FBQyxTQUFTLEVBQUksSUFBSSxDQUFDLGdCQUFnQixDQUFDLENBQUM7SUFDbkUsQ0FBQztJQUVELFVBQVU7UUFDUixJQUFJLENBQUMsS0FBSyxDQUFDLGlCQUFpQixFQUFFLENBQUM7SUFDakMsQ0FBQztJQUVELG1CQUFtQjtRQUNqQixJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO0lBQ3pDLENBQUM7SUFFRCxnQkFBZ0I7UUFDZCxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxlQUFlLENBQUMsQ0FBQztJQUN0QyxDQUFDO0lBRUQsZ0JBQWdCO1FBQ2QsSUFBSSxJQUFJLENBQUMsUUFBUSxLQUFLLGVBQWU7WUFBRSxPQUFPLFdBQVcsQ0FBQztRQUMxRCxJQUFJLElBQUksQ0FBQyxRQUFRLEtBQUssWUFBWTtZQUFFLE9BQU8sWUFBWSxDQUFDO1FBQ3hELE9BQU8sY0FBYyxDQUFDO0lBQ3hCLENBQUM7SUFFRCxLQUFLO1FBQ0gsSUFBSSxDQUFDLEtBQUssQ0FBQyxVQUFVLEVBQUUsQ0FBQztJQUMxQixDQUFDO0lBRUQsV0FBVztRQUNULElBQUksQ0FBQyxVQUFVLEdBQUcsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDO1FBQ25DLElBQUksQ0FBQyxLQUFLLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQzdDLElBQUksSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO1lBQ3BCLDJEQUEyRDtZQUMzRCxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxNQUFNLENBQUMsVUFBVSxHQUFJLElBQUksQ0FBQyxVQUFVLENBQUMsR0FBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ3BGLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLE1BQU0sQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDdEYsQ0FBQztRQUNELElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQztJQUN4QixDQUFDO0lBRUQsdUJBQXVCO0lBQ3ZCLGFBQWEsQ0FBQyxLQUFpQjtRQUM3QixLQUFLLENBQUMsY0FBYyxFQUFFLENBQUM7UUFDdkIsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUM7UUFDckIsSUFBSSxDQUFDLFlBQVksR0FBRyxLQUFLLENBQUMsT0FBTyxDQUFDO1FBQ2xDLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDO1FBQzFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxXQUFXLENBQUM7UUFDekMsUUFBUSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsVUFBVSxHQUFHLE1BQU0sQ0FBQztRQUN4QyxRQUFRLENBQUMsZ0JBQWdCLENBQUMsV0FBVyxFQUFFLElBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQztRQUM3RCxRQUFRLENBQUMsZ0JBQWdCLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQztJQUM1RCxDQUFDO0lBRU8sWUFBWSxDQUFDLEtBQWlCO1FBQ3BDLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUTtZQUFFLE9BQU87UUFDM0IsTUFBTSxFQUFFLEdBQUcsS0FBSyxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDO1FBQzdDLElBQUksSUFBSSxDQUFDLElBQUksS0FBSyxPQUFPLEVBQUUsQ0FBQztZQUMxQixJQUFJLENBQUMsWUFBWSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxFQUFFLENBQUMsQ0FBQztRQUNoRSxDQUFDO2FBQU0sQ0FBQztZQUNOLElBQUksQ0FBQyxZQUFZLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLGdCQUFnQixHQUFHLEVBQUUsQ0FBQyxDQUFDO1FBQ2hFLENBQUM7UUFDRCxJQUFJLENBQUMsWUFBWSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFlBQVksRUFBRSxNQUFNLENBQUMsVUFBVSxHQUFHLEdBQUcsQ0FBQyxDQUFDO0lBQzNFLENBQUM7SUFFTyxXQUFXO1FBQ2pCLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUTtZQUFFLE9BQU87UUFDM0IsSUFBSSxDQUFDLFFBQVEsR0FBRyxLQUFLLENBQUM7UUFDdEIsUUFBUSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLEVBQUUsQ0FBQztRQUNoQyxRQUFRLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxVQUFVLEdBQUcsRUFBRSxDQUFDO1FBQ3BDLFFBQVEsQ0FBQyxtQkFBbUIsQ0FBQyxXQUFXLEVBQUUsSUFBSSxDQUFDLGVBQWUsQ0FBQyxDQUFDO1FBQ2hFLFFBQVEsQ0FBQyxtQkFBbUIsQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDO1FBQzdELFlBQVksQ0FBQyxPQUFPLENBQUMseUJBQXlCLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDO0lBQzdFLENBQUM7SUFFRCw0QkFBNEI7SUFDNUIsZ0JBQWdCLENBQUMsS0FBaUI7UUFDaEMsbURBQW1EO1FBQ25ELElBQUssS0FBSyxDQUFDLE1BQXNCLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQztZQUFFLE9BQU87UUFDNUQsS0FBSyxDQUFDLGNBQWMsRUFBRSxDQUFDO1FBQ3ZCLElBQUksQ0FBQyxhQUFhLEdBQUcsSUFBSSxDQUFDO1FBQzFCLElBQUksQ0FBQyxhQUFhLEdBQUcsS0FBSyxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDO1FBQ2pELElBQUksQ0FBQyxhQUFhLEdBQUcsS0FBSyxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDO1FBQ2pELFFBQVEsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFVBQVUsR0FBRyxNQUFNLENBQUM7UUFDeEMsUUFBUSxDQUFDLGdCQUFnQixDQUFDLFdBQVcsRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUM7UUFDNUQsUUFBUSxDQUFDLGdCQUFnQixDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUM7SUFDM0QsQ0FBQztJQUVPLGVBQWUsQ0FBQyxLQUFpQjtRQUN2QyxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWE7WUFBRSxPQUFPO1FBQ2hDLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQyxhQUFhLEVBQUUsTUFBTSxDQUFDLFVBQVUsR0FBSSxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztRQUM5RyxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsYUFBYSxFQUFFLE1BQU0sQ0FBQyxXQUFXLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQztJQUNuRyxDQUFDO0lBRU8sY0FBYztRQUNwQixJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWE7WUFBRSxPQUFPO1FBQ2hDLElBQUksQ0FBQyxhQUFhLEdBQUcsS0FBSyxDQUFDO1FBQzNCLFFBQVEsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFVBQVUsR0FBRyxFQUFFLENBQUM7UUFDcEMsUUFBUSxDQUFDLG1CQUFtQixDQUFDLFdBQVcsRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUM7UUFDL0QsUUFBUSxDQUFDLG1CQUFtQixDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUM7UUFDNUQsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDO0lBQ3hCLENBQUM7SUFFRCwwQ0FBMEM7SUFDMUMsa0JBQWtCLENBQUMsS0FBaUI7UUFDbEMsS0FBSyxDQUFDLGNBQWMsRUFBRSxDQUFDO1FBQ3ZCLEtBQUssQ0FBQyxlQUFlLEVBQUUsQ0FBQztRQUN4QixJQUFJLENBQUMsYUFBYSxHQUFHLElBQUksQ0FBQztRQUMxQixJQUFJLENBQUMsaUJBQWlCLEdBQUcsS0FBSyxDQUFDLE9BQU8sQ0FBQztRQUN2QyxJQUFJLENBQUMsaUJBQWlCLEdBQUcsS0FBSyxDQUFDLE9BQU8sQ0FBQztRQUN2QyxJQUFJLENBQUMsaUJBQWlCLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQztRQUN6QyxJQUFJLENBQUMsaUJBQWlCLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQztRQUMxQyxRQUFRLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsV0FBVyxDQUFDO1FBQ3pDLFFBQVEsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFVBQVUsR0FBRyxNQUFNLENBQUM7UUFDeEMsUUFBUSxDQUFDLGdCQUFnQixDQUFDLFdBQVcsRUFBRSxJQUFJLENBQUMsb0JBQW9CLENBQUMsQ0FBQztRQUNsRSxRQUFRLENBQUMsZ0JBQWdCLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO0lBQ2pFLENBQUM7SUFFTyxpQkFBaUIsQ0FBQyxLQUFpQjtRQUN6QyxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWE7WUFBRSxPQUFPO1FBQ2hDLElBQUksQ0FBQyxVQUFVLEdBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLGlCQUFpQixHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDO1FBQ3BHLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLGlCQUFpQixHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDO0lBQ3RHLENBQUM7SUFFTyxnQkFBZ0I7UUFDdEIsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhO1lBQUUsT0FBTztRQUNoQyxJQUFJLENBQUMsYUFBYSxHQUFHLEtBQUssQ0FBQztRQUMzQixRQUFRLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsRUFBRSxDQUFDO1FBQ2hDLFFBQVEsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFVBQVUsR0FBRyxFQUFFLENBQUM7UUFDcEMsUUFBUSxDQUFDLG1CQUFtQixDQUFDLFdBQVcsRUFBRSxJQUFJLENBQUMsb0JBQW9CLENBQUMsQ0FBQztRQUNyRSxRQUFRLENBQUMsbUJBQW1CLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO1FBQ2xFLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQztJQUN4QixDQUFDO0lBRU8sY0FBYztRQUNwQixZQUFZLENBQUMsT0FBTyxDQUFDLHVCQUF1QixFQUFFLElBQUksQ0FBQyxTQUFTLENBQUM7WUFDM0QsVUFBVSxFQUFFLElBQUksQ0FBQyxVQUFVO1lBQzNCLENBQUMsRUFBRSxJQUFJLENBQUMsTUFBTTtZQUNkLENBQUMsRUFBRSxJQUFJLENBQUMsTUFBTTtZQUNkLENBQUMsRUFBRSxJQUFJLENBQUMsVUFBVTtZQUNsQixDQUFDLEVBQUUsSUFBSSxDQUFDLFdBQVc7U0FDcEIsQ0FBQyxDQUFDLENBQUM7SUFDTixDQUFDO3dHQTFUVSxrQkFBa0I7NEZBQWxCLGtCQUFrQiwwRUFwZm5COzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBcUlULHcwS0F6SUMsWUFBWSxrSUFBRSxXQUFXLDhCQUFFLGFBQWEsbUxBQUUsZUFBZSwySUFBRSxnQkFBZ0IsNlRBQzNFLGtCQUFrQiwyREFBRSxtQkFBbUIsdUZBQ3ZDLHdCQUF3QixpRUFBRSxxQkFBcUI7OzRGQXNmdEMsa0JBQWtCO2tCQTVmOUIsU0FBUzsrQkFDRSxnQkFBZ0IsY0FDZCxJQUFJLFdBQ1A7d0JBQ1AsWUFBWSxFQUFFLFdBQVcsRUFBRSxhQUFhLEVBQUUsZUFBZSxFQUFFLGdCQUFnQjt3QkFDM0Usa0JBQWtCLEVBQUUsbUJBQW1CO3dCQUN2Qyx3QkFBd0IsRUFBRSxxQkFBcUI7cUJBQ2hELFlBQ1M7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7R0FxSVQiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBDb21wb25lbnQsIE9uSW5pdCwgT25EZXN0cm95IH0gZnJvbSAnQGFuZ3VsYXIvY29yZSc7XG5pbXBvcnQgeyBDb21tb25Nb2R1bGUgfSBmcm9tICdAYW5ndWxhci9jb21tb24nO1xuaW1wb3J0IHsgRm9ybXNNb2R1bGUgfSBmcm9tICdAYW5ndWxhci9mb3Jtcyc7XG5pbXBvcnQgeyBNYXRJY29uTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvbWF0ZXJpYWwvaWNvbic7XG5pbXBvcnQgeyBNYXRCdXR0b25Nb2R1bGUgfSBmcm9tICdAYW5ndWxhci9tYXRlcmlhbC9idXR0b24nO1xuaW1wb3J0IHsgTWF0VG9vbHRpcE1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL21hdGVyaWFsL3Rvb2x0aXAnO1xuaW1wb3J0IHsgU3Vic2NyaXB0aW9uLCBjb21iaW5lTGF0ZXN0IH0gZnJvbSAncnhqcyc7XG5pbXBvcnQgeyBNZXNzYWdpbmdTdG9yZVNlcnZpY2UgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9tZXNzYWdpbmctc3RvcmUuc2VydmljZSc7XG5pbXBvcnQgeyBTaWRlYmFyU2lkZSB9IGZyb20gJy4uLy4uL21vZGVscy9tZXNzYWdpbmcubW9kZWxzJztcbmltcG9ydCB7IEluYm94TGlzdENvbXBvbmVudCB9IGZyb20gJy4uL2luYm94LWxpc3QvaW5ib3gtbGlzdC5jb21wb25lbnQnO1xuaW1wb3J0IHsgQ2hhdFRocmVhZENvbXBvbmVudCB9IGZyb20gJy4uL2NoYXQtdGhyZWFkL2NoYXQtdGhyZWFkLmNvbXBvbmVudCc7XG5pbXBvcnQgeyBOZXdDb252ZXJzYXRpb25Db21wb25lbnQgfSBmcm9tICcuLi9uZXctY29udmVyc2F0aW9uL25ldy1jb252ZXJzYXRpb24uY29tcG9uZW50JztcbmltcG9ydCB7IEdyb3VwTWFuYWdlckNvbXBvbmVudCB9IGZyb20gJy4uL2dyb3VwLW1hbmFnZXIvZ3JvdXAtbWFuYWdlci5jb21wb25lbnQnO1xuXG5AQ29tcG9uZW50KHtcbiAgc2VsZWN0b3I6ICdhcHAtY2hhdC1wYW5lbCcsXG4gIHN0YW5kYWxvbmU6IHRydWUsXG4gIGltcG9ydHM6IFtcbiAgICBDb21tb25Nb2R1bGUsIEZvcm1zTW9kdWxlLCBNYXRJY29uTW9kdWxlLCBNYXRCdXR0b25Nb2R1bGUsIE1hdFRvb2x0aXBNb2R1bGUsXG4gICAgSW5ib3hMaXN0Q29tcG9uZW50LCBDaGF0VGhyZWFkQ29tcG9uZW50LFxuICAgIE5ld0NvbnZlcnNhdGlvbkNvbXBvbmVudCwgR3JvdXBNYW5hZ2VyQ29tcG9uZW50LFxuICBdLFxuICB0ZW1wbGF0ZTogYFxuICAgIDwhLS0gU2lkZWJhciAvIEZsb2F0aW5nIHBhbmVsIC0tPlxuICAgIDxkaXZcbiAgICAgIGNsYXNzPVwic2lkZWJhclwiXG4gICAgICBbY2xhc3Mub3Blbl09XCJpc09wZW5cIlxuICAgICAgW2NsYXNzLnNpZGUtbGVmdF09XCIhaXNGbG9hdGluZyAmJiBzaWRlID09PSAnbGVmdCdcIlxuICAgICAgW2NsYXNzLnNpZGUtcmlnaHRdPVwiIWlzRmxvYXRpbmcgJiYgc2lkZSA9PT0gJ3JpZ2h0J1wiXG4gICAgICBbY2xhc3MuZmxvYXRpbmddPVwiaXNGbG9hdGluZ1wiXG4gICAgICBbc3R5bGUud2lkdGgucHhdPVwiaXNGbG9hdGluZyA/IGZsb2F0V2lkdGggOiBzaWRlYmFyV2lkdGhcIlxuICAgICAgW3N0eWxlLmhlaWdodC5weF09XCJpc0Zsb2F0aW5nID8gZmxvYXRIZWlnaHQgOiBudWxsXCJcbiAgICAgIFtzdHlsZS5sZWZ0LnB4XT1cImlzRmxvYXRpbmcgPyBmbG9hdFggOiBudWxsXCJcbiAgICAgIFtzdHlsZS50b3AucHhdPVwiaXNGbG9hdGluZyA/IGZsb2F0WSA6IG51bGxcIlxuICAgID5cbiAgICAgIDwhLS0gUmVzaXplIGhhbmRsZSAoc2lkZWJhciBtb2RlIG9ubHkpIC0tPlxuICAgICAgPGRpdlxuICAgICAgICAqbmdJZj1cIiFpc0Zsb2F0aW5nXCJcbiAgICAgICAgY2xhc3M9XCJyZXNpemUtaGFuZGxlXCJcbiAgICAgICAgW2NsYXNzLmhhbmRsZS1sZWZ0XT1cInNpZGUgPT09ICdyaWdodCdcIlxuICAgICAgICBbY2xhc3MuaGFuZGxlLXJpZ2h0XT1cInNpZGUgPT09ICdsZWZ0J1wiXG4gICAgICAgIChtb3VzZWRvd24pPVwib25SZXNpemVTdGFydCgkZXZlbnQpXCJcbiAgICAgID48L2Rpdj5cblxuICAgICAgPCEtLSBTaWRlYmFyIGhlYWRlciAoYWN0cyBhcyBkcmFnIGhhbmRsZSBpbiBmbG9hdGluZyBtb2RlKSAtLT5cbiAgICAgIDxkaXZcbiAgICAgICAgY2xhc3M9XCJzaWRlYmFyLWhlYWRlclwiXG4gICAgICAgIFtjbGFzcy5kcmFnLWhhbmRsZV09XCJpc0Zsb2F0aW5nXCJcbiAgICAgICAgKG1vdXNlZG93bik9XCJpc0Zsb2F0aW5nICYmIG9uRmxvYXREcmFnU3RhcnQoJGV2ZW50KVwiXG4gICAgICA+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJoZWFkZXItbGVmdFwiPlxuICAgICAgICAgIDxzcGFuXG4gICAgICAgICAgICBjbGFzcz1cInN0YXR1cy1kb3RcIlxuICAgICAgICAgICAgW2NsYXNzLmNvbm5lY3RlZF09XCJ3c1N0YXR1cyA9PT0gJ2F1dGhlbnRpY2F0ZWQnXCJcbiAgICAgICAgICAgIFtjbGFzcy5jb25uZWN0aW5nXT1cIndzU3RhdHVzID09PSAnY29ubmVjdGluZydcIlxuICAgICAgICAgICAgW2NsYXNzLmRpc2Nvbm5lY3RlZF09XCJ3c1N0YXR1cyA9PT0gJ2Rpc2Nvbm5lY3RlZCdcIlxuICAgICAgICAgICAgW21hdFRvb2x0aXBdPVwiZ2V0U3RhdHVzVG9vbHRpcCgpXCJcbiAgICAgICAgICAgIG1hdFRvb2x0aXBQb3NpdGlvbj1cImJlbG93XCJcbiAgICAgICAgICA+PC9zcGFuPlxuICAgICAgICAgIDxzcGFuIGNsYXNzPVwiaGVhZGVyLXRpdGxlXCI+TWVzc2FnZXM8L3NwYW4+XG4gICAgICAgIDwvZGl2PlxuICAgICAgICA8ZGl2IGNsYXNzPVwiaGVhZGVyLWFjdGlvbnNcIj5cbiAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAqbmdJZj1cImFjdGl2ZVZpZXcgPT09ICdpbmJveCdcIlxuICAgICAgICAgICAgbWF0LWljb24tYnV0dG9uXG4gICAgICAgICAgICBjbGFzcz1cImhkci1idG5cIlxuICAgICAgICAgICAgKGNsaWNrKT1cIm9wZW5OZXdDb252ZXJzYXRpb24oKVwiXG4gICAgICAgICAgICBtYXRUb29sdGlwPVwiTmV3IGNvbnZlcnNhdGlvblwiXG4gICAgICAgICAgICBtYXRUb29sdGlwUG9zaXRpb249XCJiZWxvd1wiXG4gICAgICAgICAgPlxuICAgICAgICAgICAgPG1hdC1pY29uPmVkaXRfc3F1YXJlPC9tYXQtaWNvbj5cbiAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAqbmdJZj1cImFjdGl2ZVZpZXcgPT09ICdpbmJveCdcIlxuICAgICAgICAgICAgbWF0LWljb24tYnV0dG9uXG4gICAgICAgICAgICBjbGFzcz1cImhkci1idG5cIlxuICAgICAgICAgICAgKGNsaWNrKT1cIm9wZW5Hcm91cE1hbmFnZXIoKVwiXG4gICAgICAgICAgICBtYXRUb29sdGlwPVwiQ3JlYXRlIGdyb3VwXCJcbiAgICAgICAgICAgIG1hdFRvb2x0aXBQb3NpdGlvbj1cImJlbG93XCJcbiAgICAgICAgICA+XG4gICAgICAgICAgICA8bWF0LWljb24+Z3JvdXBfYWRkPC9tYXQtaWNvbj5cbiAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICA8IS0tIFNpZGUtc3dhcCAoc2lkZWJhciBtb2RlIG9ubHkpIC0tPlxuICAgICAgICAgIDxidXR0b24gKm5nSWY9XCIhaXNGbG9hdGluZ1wiIG1hdC1pY29uLWJ1dHRvbiBjbGFzcz1cImhkci1idG5cIiAoY2xpY2spPVwidG9nZ2xlU2lkZSgpXCJcbiAgICAgICAgICAgIFttYXRUb29sdGlwXT1cIidNb3ZlIHRvICcgKyAoc2lkZSA9PT0gJ3JpZ2h0JyA/ICdsZWZ0JyA6ICdyaWdodCcpXCIgbWF0VG9vbHRpcFBvc2l0aW9uPVwiYmVsb3dcIj5cbiAgICAgICAgICAgIDxtYXQtaWNvbj57eyBzaWRlID09PSAncmlnaHQnID8gJ2NoZXZyb25fbGVmdCcgOiAnY2hldnJvbl9yaWdodCcgfX08L21hdC1pY29uPlxuICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgIDwhLS0gUG9wLW91dCAvIGRvY2sgdG9nZ2xlIC0tPlxuICAgICAgICAgIDxidXR0b24gbWF0LWljb24tYnV0dG9uIGNsYXNzPVwiaGRyLWJ0blwiXG4gICAgICAgICAgICAoY2xpY2spPVwidG9nZ2xlRmxvYXQoKVwiXG4gICAgICAgICAgICBbbWF0VG9vbHRpcF09XCJpc0Zsb2F0aW5nID8gJ0RvY2sgdG8gc2lkZWJhcicgOiAnUG9wIG91dCB0byBmbG9hdGluZyB3aW5kb3cnXCJcbiAgICAgICAgICAgIG1hdFRvb2x0aXBQb3NpdGlvbj1cImJlbG93XCI+XG4gICAgICAgICAgICA8bWF0LWljb24+e3sgaXNGbG9hdGluZyA/ICdwaWN0dXJlX2luX3BpY3R1cmVfYWx0JyA6ICdvcGVuX2luX25ldycgfX08L21hdC1pY29uPlxuICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJidG4tc3BhY2VyXCI+PC9kaXY+XG4gICAgICAgICAgPGJ1dHRvbiBtYXQtaWNvbi1idXR0b24gY2xhc3M9XCJoZHItYnRuXCIgKGNsaWNrKT1cImNsb3NlKClcIiBtYXRUb29sdGlwPVwiQ2xvc2UgbWVzc2VuZ2VyXCIgbWF0VG9vbHRpcFBvc2l0aW9uPVwiYmVsb3dcIj5cbiAgICAgICAgICAgIDxtYXQtaWNvbj5jbG9zZTwvbWF0LWljb24+XG4gICAgICAgICAgPC9idXR0b24+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG5cbiAgICAgIDwhLS0gVmlldyBjb250YWluZXIgLS0+XG4gICAgICA8ZGl2IGNsYXNzPVwic2lkZWJhci1jb250ZW50XCI+XG4gICAgICAgIDxhcHAtaW5ib3gtbGlzdCAqbmdJZj1cImFjdGl2ZVZpZXcgPT09ICdpbmJveCdcIj48L2FwcC1pbmJveC1saXN0PlxuICAgICAgICA8YXBwLWNoYXQtdGhyZWFkXG4gICAgICAgICAgKm5nSWY9XCJhY3RpdmVWaWV3ID09PSAnY2hhdCdcIlxuICAgICAgICAgIChsaWdodGJveE9wZW4pPVwib3BlbkxpZ2h0Ym94KCRldmVudClcIlxuICAgICAgICA+PC9hcHAtY2hhdC10aHJlYWQ+XG4gICAgICAgIDxhcHAtbmV3LWNvbnZlcnNhdGlvbiAqbmdJZj1cImFjdGl2ZVZpZXcgPT09ICduZXctY29udmVyc2F0aW9uJ1wiPjwvYXBwLW5ldy1jb252ZXJzYXRpb24+XG4gICAgICAgIDxhcHAtZ3JvdXAtbWFuYWdlciAqbmdJZj1cImFjdGl2ZVZpZXcgPT09ICdncm91cC1tYW5hZ2VyJ1wiPjwvYXBwLWdyb3VwLW1hbmFnZXI+XG4gICAgICA8L2Rpdj5cblxuICAgICAgPGRpdiAqbmdJZj1cInRvYXN0XCIgY2xhc3M9XCJtZXNzYWdpbmctdG9hc3RcIiBbY2xhc3Muc3VjY2Vzc109XCJ0b2FzdC50eXBlID09PSAnc3VjY2VzcydcIiBbY2xhc3MuZXJyb3JdPVwidG9hc3QudHlwZSA9PT0gJ2Vycm9yJ1wiPlxuICAgICAgICA8bWF0LWljb24+e3sgdG9hc3QudHlwZSA9PT0gJ2Vycm9yJyA/ICdlcnJvcicgOiB0b2FzdC50eXBlID09PSAnc3VjY2VzcycgPyAnY2hlY2tfY2lyY2xlJyA6ICdpbmZvJyB9fTwvbWF0LWljb24+XG4gICAgICAgIDxzcGFuPnt7IHRvYXN0Lm1lc3NhZ2UgfX08L3NwYW4+XG4gICAgICA8L2Rpdj5cblxuICAgICAgPCEtLSBSZXNpemUgY29ybmVyIChmbG9hdGluZyBtb2RlIG9ubHkpIC0tPlxuICAgICAgPGRpdiAqbmdJZj1cImlzRmxvYXRpbmdcIiBjbGFzcz1cImZsb2F0LXJlc2l6ZS1jb3JuZXJcIiAobW91c2Vkb3duKT1cIm9uRmxvYXRSZXNpemVTdGFydCgkZXZlbnQpXCI+PC9kaXY+XG4gICAgPC9kaXY+XG5cbiAgICA8IS0tIOKUgOKUgCBMaWdodGJveDogc2libGluZyBvZiAuc2lkZWJhciBzbyBwb3NpdGlvbjpmaXhlZCBpcyByZWxhdGl2ZSB0byB2aWV3cG9ydCDilIDilIAgLS0+XG4gICAgPGRpdlxuICAgICAgKm5nSWY9XCJsaWdodGJveFVybFwiXG4gICAgICBjbGFzcz1cImxiLW92ZXJsYXlcIlxuICAgICAgW2NsYXNzLmxiLWRldGFjaGVkXT1cImxpZ2h0Ym94RGV0YWNoZWRcIlxuICAgICAgW3N0eWxlLmxlZnQucHhdPVwibGlnaHRib3hEZXRhY2hlZCA/IGxpZ2h0Ym94WCA6IG51bGxcIlxuICAgICAgW3N0eWxlLnRvcC5weF09XCJsaWdodGJveERldGFjaGVkID8gbGlnaHRib3hZIDogbnVsbFwiXG4gICAgICBbc3R5bGUud2lkdGgucHhdPVwibGlnaHRib3hEZXRhY2hlZCA/IGxpZ2h0Ym94VyA6IG51bGxcIlxuICAgICAgW3N0eWxlLmhlaWdodC5weF09XCJsaWdodGJveERldGFjaGVkID8gbGlnaHRib3hIIDogbnVsbFwiXG4gICAgICAoY2xpY2spPVwib25MaWdodGJveEJhY2tkcm9wQ2xpY2soJGV2ZW50KVwiXG4gICAgPlxuICAgICAgPGRpdiAqbmdJZj1cImxpZ2h0Ym94RGV0YWNoZWRcIiBjbGFzcz1cImxiLWRyYWctYmFyXCIgKG1vdXNlZG93bik9XCJvbkxiRHJhZ1N0YXJ0KCRldmVudClcIj5cbiAgICAgICAgPHNwYW4gY2xhc3M9XCJsYi1kcmFnLXRpdGxlXCI+SW1hZ2Ugdmlld2VyPC9zcGFuPlxuICAgICAgICA8ZGl2IGNsYXNzPVwibGItZHJhZy1hY3Rpb25zXCI+XG4gICAgICAgICAgPGJ1dHRvbiB0eXBlPVwiYnV0dG9uXCIgY2xhc3M9XCJsYi1hY3Rpb24tYnRuXCJcbiAgICAgICAgICAgIChjbGljayk9XCIkZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7IGxpZ2h0Ym94RGV0YWNoZWQgPSBmYWxzZVwiIHRpdGxlPVwiRnVsbHNjcmVlblwiPlxuICAgICAgICAgICAgPG1hdC1pY29uPmZ1bGxzY3JlZW48L21hdC1pY29uPlxuICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgIDxidXR0b24gdHlwZT1cImJ1dHRvblwiIGNsYXNzPVwibGItYWN0aW9uLWJ0blwiXG4gICAgICAgICAgICAoY2xpY2spPVwiJGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpOyBsaWdodGJveFVybCA9IG51bGw7IGxpZ2h0Ym94RGV0YWNoZWQgPSBmYWxzZVwiIHRpdGxlPVwiQ2xvc2VcIj5cbiAgICAgICAgICAgIDxtYXQtaWNvbj5jbG9zZTwvbWF0LWljb24+XG4gICAgICAgICAgPC9idXR0b24+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgICA8aW1nIFtzcmNdPVwibGlnaHRib3hVcmxcIiBjbGFzcz1cImxiLWltZ1wiIFtjbGFzcy5sYi1pbWctZGV0YWNoZWRdPVwibGlnaHRib3hEZXRhY2hlZFwiXG4gICAgICAgICAgIChjbGljayk9XCIkZXZlbnQuc3RvcFByb3BhZ2F0aW9uKClcIiAvPlxuICAgICAgPG5nLWNvbnRhaW5lciAqbmdJZj1cIiFsaWdodGJveERldGFjaGVkXCI+XG4gICAgICAgIDxidXR0b24gY2xhc3M9XCJsYi1jbG9zZVwiIChjbGljayk9XCJsaWdodGJveFVybCA9IG51bGxcIj48bWF0LWljb24+Y2xvc2U8L21hdC1pY29uPjwvYnV0dG9uPlxuICAgICAgICA8YnV0dG9uIGNsYXNzPVwibGItZGV0YWNoLWJ0blwiIChjbGljayk9XCJkZXRhY2hMaWdodGJveCgpXCIgdGl0bGU9XCJEZXRhY2ggdG8gZmxvYXRpbmcgd2luZG93XCI+XG4gICAgICAgICAgPG1hdC1pY29uPnBpY3R1cmVfaW5fcGljdHVyZTwvbWF0LWljb24+XG4gICAgICAgIDwvYnV0dG9uPlxuICAgICAgPC9uZy1jb250YWluZXI+XG4gICAgICA8ZGl2ICpuZ0lmPVwibGlnaHRib3hEZXRhY2hlZFwiIGNsYXNzPVwibGItcmVzaXplLWNvcm5lclwiIChtb3VzZWRvd24pPVwib25MYlJlc2l6ZVN0YXJ0KCRldmVudClcIj48L2Rpdj5cbiAgICA8L2Rpdj5cbiAgYCxcbiAgc3R5bGVzOiBbYFxuICAgIC5zaWRlYmFyIHtcbiAgICAgIHBvc2l0aW9uOiBmaXhlZDtcbiAgICAgIHRvcDogMDtcbiAgICAgIGJvdHRvbTogMDtcbiAgICAgIHdpZHRoOiA0MDBweDtcbiAgICAgIGJhY2tncm91bmQ6ICMwNDEzMjI7XG4gICAgICB6LWluZGV4OiA5OTk5O1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAgICBib3gtc2hhZG93OiAwIDAgNDBweCByZ2JhKDAsIDAsIDAsIDAuNik7XG4gICAgICB0cmFuc2l0aW9uOiB0cmFuc2Zvcm0gMC4zcyBjdWJpYy1iZXppZXIoMC40LCAwLCAwLjIsIDEpO1xuICAgICAgY29udGFpbmVyLXR5cGU6IGlubGluZS1zaXplO1xuICAgIH1cblxuICAgIC5zaWRlYmFyLnNpZGUtcmlnaHQge1xuICAgICAgcmlnaHQ6IDA7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVgoMTAwJSk7XG4gICAgfVxuXG4gICAgLnNpZGViYXIuc2lkZS1sZWZ0IHtcbiAgICAgIGxlZnQ6IDA7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVgoLTEwMCUpO1xuICAgIH1cblxuICAgIC5zaWRlYmFyLm9wZW4uc2lkZS1yaWdodCB7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVgoMCk7XG4gICAgfVxuXG4gICAgLnNpZGViYXIub3Blbi5zaWRlLWxlZnQge1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVYKDApO1xuICAgIH1cblxuICAgIC8qIOKUgOKUgCBSZXNpemUgaGFuZGxlIChiZWxvdyBoZWFkZXIgc28gaGVhZGVyIGNvbnRyb2xzIHN0YXkgY2xpY2thYmxlKSDilIDilIAgKi9cbiAgICAucmVzaXplLWhhbmRsZSB7XG4gICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XG4gICAgICB0b3A6IDA7XG4gICAgICBib3R0b206IDA7XG4gICAgICB3aWR0aDogNXB4O1xuICAgICAgY3Vyc29yOiBldy1yZXNpemU7XG4gICAgICB6LWluZGV4OiAxO1xuICAgICAgdHJhbnNpdGlvbjogYmFja2dyb3VuZCAwLjE1cztcbiAgICB9XG5cbiAgICAucmVzaXplLWhhbmRsZTpob3ZlcixcbiAgICAucmVzaXplLWhhbmRsZTphY3RpdmUge1xuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjE1KTtcbiAgICB9XG5cbiAgICAucmVzaXplLWhhbmRsZS5oYW5kbGUtbGVmdCB7XG4gICAgICBsZWZ0OiAwO1xuICAgIH1cblxuICAgIC5yZXNpemUtaGFuZGxlLmhhbmRsZS1yaWdodCB7XG4gICAgICByaWdodDogMDtcbiAgICB9XG5cbiAgICAvKiDilIDilIAgSGVhZGVyIOKUgOKUgCAqL1xuICAgIC5zaWRlYmFyLWhlYWRlciB7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGp1c3RpZnktY29udGVudDogc3BhY2UtYmV0d2VlbjtcbiAgICAgIHBhZGRpbmc6IDhweCAxMHB4IDhweCAxNHB4O1xuICAgICAgYm9yZGVyLWJvdHRvbTogMXB4IHNvbGlkIHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xNSk7XG4gICAgICBmbGV4LXNocmluazogMDtcbiAgICAgIHBvc2l0aW9uOiByZWxhdGl2ZTtcbiAgICAgIHotaW5kZXg6IDI7XG4gICAgICBtaW4taGVpZ2h0OiA0OHB4O1xuICAgIH1cblxuICAgIC5oZWFkZXItbGVmdCB7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGdhcDogOHB4O1xuICAgICAgbWluLXdpZHRoOiAwO1xuICAgICAgZmxleDogMSAxIGF1dG87XG4gICAgfVxuXG4gICAgLmhlYWRlci10aXRsZSB7XG4gICAgICBmb250LXNpemU6IGNsYW1wKDExcHgsIDVjcXcsIDE2cHgpO1xuICAgICAgZm9udC13ZWlnaHQ6IDcwMDtcbiAgICAgIGNvbG9yOiAjZmZmO1xuICAgICAgbGV0dGVyLXNwYWNpbmc6IDAuM3B4O1xuICAgICAgd2hpdGUtc3BhY2U6IG5vd3JhcDtcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICB0ZXh0LW92ZXJmbG93OiBlbGxpcHNpcztcbiAgICB9XG5cbiAgICAuaGVhZGVyLWFjdGlvbnMge1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBnYXA6IDA7XG4gICAgICBmbGV4LXNocmluazogMDtcbiAgICB9XG5cbiAgICAuYnRuLXNwYWNlciB7XG4gICAgICB3aWR0aDogMTJweDtcbiAgICB9XG5cbiAgICAuaGRyLWJ0biB7XG4gICAgICB3aWR0aDogMzJweDtcbiAgICAgIGhlaWdodDogMzJweDtcbiAgICAgIG1pbi13aWR0aDogMzJweDtcbiAgICAgIHBhZGRpbmc6IDA7XG4gICAgICBkaXNwbGF5OiBpbmxpbmUtZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDZweCAhaW1wb3J0YW50O1xuICAgICAgdHJhbnNpdGlvbjogYmFja2dyb3VuZCAwLjE1cywgYm94LXNoYWRvdyAwLjE1cztcbiAgICAgIC0tbWRjLWljb24tYnV0dG9uLXN0YXRlLWxheWVyLXNpemU6IDMycHg7XG4gICAgfVxuXG4gICAgLmhkci1idG4gLm1hdC1tZGMtYnV0dG9uLXRvdWNoLXRhcmdldCB7XG4gICAgICB3aWR0aDogMzJweDtcbiAgICAgIGhlaWdodDogMzJweDtcbiAgICB9XG5cbiAgICAuaGRyLWJ0bjpob3ZlciB7XG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMTUpICFpbXBvcnRhbnQ7XG4gICAgICBib3gtc2hhZG93OiAwIDJweCA4cHggcmdiYSgwLCAwLCAwLCAwLjIpO1xuICAgIH1cblxuICAgIC5oZHItYnRuIG1hdC1pY29uIHtcbiAgICAgIGZvbnQtc2l6ZTogMjBweDtcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuODUpO1xuICAgIH1cblxuICAgIEBjb250YWluZXIgKG1heC13aWR0aDogMzMwcHgpIHtcbiAgICAgIC5zaWRlYmFyLWhlYWRlciB7XG4gICAgICAgIHBhZGRpbmc6IDhweCA2cHggOHB4IDEwcHg7XG4gICAgICB9XG5cbiAgICAgIC5oZWFkZXItdGl0bGUge1xuICAgICAgICBkaXNwbGF5OiBub25lO1xuICAgICAgfVxuXG4gICAgICAuaGVhZGVyLWxlZnQge1xuICAgICAgICBmbGV4OiAwIDAgYXV0bztcbiAgICAgICAgZ2FwOiAwO1xuICAgICAgfVxuXG4gICAgICAuYnRuLXNwYWNlciB7XG4gICAgICAgIHdpZHRoOiA0cHg7XG4gICAgICB9XG5cbiAgICAgIC5oZHItYnRuIHtcbiAgICAgICAgd2lkdGg6IDI4cHg7XG4gICAgICAgIGhlaWdodDogMjhweDtcbiAgICAgICAgbWluLXdpZHRoOiAyOHB4O1xuICAgICAgICAtLW1kYy1pY29uLWJ1dHRvbi1zdGF0ZS1sYXllci1zaXplOiAyOHB4O1xuICAgICAgfVxuXG4gICAgICAuaGRyLWJ0biBtYXQtaWNvbiB7XG4gICAgICAgIGZvbnQtc2l6ZTogMThweDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvKiDilIDilIAgQ29udGVudCDilIDilIAgKi9cbiAgICAuc2lkZWJhci1jb250ZW50IHtcbiAgICAgIGZsZXg6IDE7XG4gICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgIH1cblxuICAgIC5tZXNzYWdpbmctdG9hc3Qge1xuICAgICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgICAgbGVmdDogMTZweDtcbiAgICAgIHJpZ2h0OiAxNnB4O1xuICAgICAgYm90dG9tOiAxNnB4O1xuICAgICAgei1pbmRleDogNTtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgZ2FwOiA4cHg7XG4gICAgICBwYWRkaW5nOiAxMHB4IDEycHg7XG4gICAgICBib3JkZXItcmFkaXVzOiAxMHB4O1xuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNSwgNDIsIDYzLCAwLjk2KTtcbiAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xNCk7XG4gICAgICBib3gtc2hhZG93OiAwIDEwcHggMjZweCByZ2JhKDAsIDAsIDAsIDAuMzUpO1xuICAgICAgY29sb3I6ICNmZmY7XG4gICAgICBmb250LXNpemU6IDEzcHg7XG4gICAgICBwb2ludGVyLWV2ZW50czogbm9uZTtcbiAgICB9XG5cbiAgICAubWVzc2FnaW5nLXRvYXN0LnN1Y2Nlc3Mge1xuICAgICAgYmFja2dyb3VuZDogcmdiYSgyMCwgODMsIDQ1LCAwLjk2KTtcbiAgICAgIGJvcmRlci1jb2xvcjogcmdiYSgzNCwgMTk3LCA5NCwgMC40KTtcbiAgICB9XG5cbiAgICAubWVzc2FnaW5nLXRvYXN0LmVycm9yIHtcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMTI3LCAyOSwgMjksIDAuOTYpO1xuICAgICAgYm9yZGVyLWNvbG9yOiByZ2JhKDI0OCwgMTEzLCAxMTMsIDAuNDUpO1xuICAgIH1cblxuICAgIC5tZXNzYWdpbmctdG9hc3QgbWF0LWljb24ge1xuICAgICAgZm9udC1zaXplOiAxOHB4O1xuICAgICAgd2lkdGg6IDE4cHg7XG4gICAgICBoZWlnaHQ6IDE4cHg7XG4gICAgfVxuXG4gICAgLnN0YXR1cy1kb3Qge1xuICAgICAgd2lkdGg6IDhweDtcbiAgICAgIGhlaWdodDogOHB4O1xuICAgICAgYm9yZGVyLXJhZGl1czogNTAlO1xuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjQpO1xuICAgICAgZmxleC1zaHJpbms6IDA7XG4gICAgfVxuXG4gICAgLnN0YXR1cy1kb3QuY29ubmVjdGVkIHtcbiAgICAgIGJhY2tncm91bmQ6ICMyMmM1NWU7XG4gICAgICBib3gtc2hhZG93OiAwIDAgMCAzcHggcmdiYSgzNCwgMTk3LCA5NCwgMC4xOCk7XG4gICAgfVxuXG4gICAgLnN0YXR1cy1kb3QuY29ubmVjdGluZyB7XG4gICAgICBiYWNrZ3JvdW5kOiAjZjU5ZTBiO1xuICAgICAgYW5pbWF0aW9uOiBibGluayAxcyBpbmZpbml0ZTtcbiAgICB9XG5cbiAgICAuc3RhdHVzLWRvdC5kaXNjb25uZWN0ZWQge1xuICAgICAgYmFja2dyb3VuZDogI2VmNDQ0NDtcbiAgICAgIGJveC1zaGFkb3c6IDAgMCAwIDNweCByZ2JhKDIzOSwgNjgsIDY4LCAwLjE0KTtcbiAgICB9XG5cbiAgICBAa2V5ZnJhbWVzIGJsaW5rIHtcbiAgICAgIDUwJSB7IG9wYWNpdHk6IDAuMzsgfVxuICAgIH1cblxuICAgIC8qIOKUgOKUgCBGbG9hdGluZyBtb2RlIOKUgOKUgCAqL1xuICAgIC5zaWRlYmFyLmZsb2F0aW5nIHtcbiAgICAgIHBvc2l0aW9uOiBmaXhlZCAhaW1wb3J0YW50O1xuICAgICAgcmlnaHQ6IHVuc2V0ICFpbXBvcnRhbnQ7XG4gICAgICBsZWZ0OiA4MHB4O1xuICAgICAgdG9wOiA4MHB4O1xuICAgICAgdHJhbnNmb3JtOiBub25lICFpbXBvcnRhbnQ7XG4gICAgICBib3JkZXItcmFkaXVzOiAxMnB4O1xuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICAgIHJlc2l6ZTogbm9uZTtcbiAgICAgIG1pbi13aWR0aDogMjgwcHg7XG4gICAgICBtaW4taGVpZ2h0OiAzMjBweDtcbiAgICB9XG5cbiAgICAuc2lkZWJhci5mbG9hdGluZzpub3QoLm9wZW4pIHtcbiAgICAgIGRpc3BsYXk6IG5vbmU7XG4gICAgfVxuXG4gICAgLmRyYWctaGFuZGxlIHtcbiAgICAgIGN1cnNvcjogZ3JhYjtcbiAgICAgIHVzZXItc2VsZWN0OiBub25lO1xuICAgIH1cblxuICAgIC5kcmFnLWhhbmRsZTphY3RpdmUge1xuICAgICAgY3Vyc29yOiBncmFiYmluZztcbiAgICB9XG5cbiAgICAuZmxvYXQtcmVzaXplLWNvcm5lciB7XG4gICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XG4gICAgICBib3R0b206IDA7XG4gICAgICByaWdodDogMDtcbiAgICAgIHdpZHRoOiAxNnB4O1xuICAgICAgaGVpZ2h0OiAxNnB4O1xuICAgICAgY3Vyc29yOiBzZS1yZXNpemU7XG4gICAgICBiYWNrZ3JvdW5kOiBsaW5lYXItZ3JhZGllbnQoMTM1ZGVnLCB0cmFuc3BhcmVudCA1MCUsIHJnYmEoMjU1LDI1NSwyNTUsMC4yNSkgNTAlKTtcbiAgICAgIGJvcmRlci1ib3R0b20tcmlnaHQtcmFkaXVzOiAxMnB4O1xuICAgIH1cblxuICAgIEBtZWRpYSAobWF4LXdpZHRoOiA0ODBweCkge1xuICAgICAgLnNpZGViYXIge1xuICAgICAgICB3aWR0aDogMTAwJSAhaW1wb3J0YW50O1xuICAgICAgfVxuICAgICAgLnJlc2l6ZS1oYW5kbGUge1xuICAgICAgICBkaXNwbGF5OiBub25lO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8qIOKUgOKUgCBMaWdodGJveCAob3V0c2lkZSAuc2lkZWJhciBzbyBwb3NpdGlvbjpmaXhlZCBpcyB2aWV3cG9ydC1yZWxhdGl2ZSkg4pSA4pSAICovXG4gICAgLmxiLW92ZXJsYXkge1xuICAgICAgcG9zaXRpb246IGZpeGVkO1xuICAgICAgaW5zZXQ6IDA7XG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDAsMCwwLDAuODgpO1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgIHotaW5kZXg6IDk5OTk5O1xuICAgICAgY3Vyc29yOiBwb2ludGVyO1xuICAgIH1cblxuICAgIC5sYi1vdmVybGF5LmxiLWRldGFjaGVkIHtcbiAgICAgIGluc2V0OiB1bnNldDtcbiAgICAgIGJhY2tncm91bmQ6ICMwYzFmMzU7XG4gICAgICBib3JkZXI6IDFweCBzb2xpZCByZ2JhKDI1NSwyNTUsMjU1LDAuMTgpO1xuICAgICAgYm9yZGVyLXJhZGl1czogMTJweDtcbiAgICAgIGJveC1zaGFkb3c6IDAgMTJweCA0OHB4IHJnYmEoMCwwLDAsMC43KTtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICAgIGN1cnNvcjogZGVmYXVsdDtcbiAgICAgIG1pbi13aWR0aDogMjQwcHg7XG4gICAgICBtaW4taGVpZ2h0OiAyMDBweDtcbiAgICB9XG5cbiAgICAubGItZHJhZy1iYXIge1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWJldHdlZW47XG4gICAgICBwYWRkaW5nOiA2cHggOHB4IDZweCAxMnB4O1xuICAgICAgYmFja2dyb3VuZDogIzA0MTMyMjtcbiAgICAgIGJvcmRlci1ib3R0b206IDFweCBzb2xpZCByZ2JhKDI1NSwyNTUsMjU1LDAuMTIpO1xuICAgICAgY3Vyc29yOiBncmFiO1xuICAgICAgZmxleC1zaHJpbms6IDA7XG4gICAgICB1c2VyLXNlbGVjdDogbm9uZTtcbiAgICB9XG4gICAgLmxiLWRyYWctYmFyOmFjdGl2ZSB7IGN1cnNvcjogZ3JhYmJpbmc7IH1cblxuICAgIC5sYi1kcmFnLXRpdGxlIHsgZm9udC1zaXplOiAxMnB4OyBjb2xvcjogcmdiYSgyNTUsMjU1LDI1NSwwLjYpOyBsZXR0ZXItc3BhY2luZzogMC40cHg7IH1cbiAgICAubGItZHJhZy1hY3Rpb25zIHsgZGlzcGxheTogZmxleDsgZ2FwOiAycHg7IH1cblxuICAgIC5sYi1hY3Rpb24tYnRuIHtcbiAgICAgIGJhY2tncm91bmQ6IHRyYW5zcGFyZW50O1xuICAgICAgYm9yZGVyOiBub25lO1xuICAgICAgYm9yZGVyLXJhZGl1czogNnB4O1xuICAgICAgd2lkdGg6IDI4cHg7IGhlaWdodDogMjhweDtcbiAgICAgIGRpc3BsYXk6IGZsZXg7IGFsaWduLWl0ZW1zOiBjZW50ZXI7IGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgICAgY3Vyc29yOiBwb2ludGVyO1xuICAgICAgY29sb3I6IHJnYmEoMjU1LDI1NSwyNTUsMC43KTtcbiAgICAgIHRyYW5zaXRpb246IGJhY2tncm91bmQgMC4xNXM7XG4gICAgfVxuICAgIC5sYi1hY3Rpb24tYnRuOmhvdmVyIHsgYmFja2dyb3VuZDogcmdiYSgyNTUsMjU1LDI1NSwwLjE1KTsgfVxuICAgIC5sYi1hY3Rpb24tYnRuIG1hdC1pY29uIHsgZm9udC1zaXplOiAxNnB4OyB3aWR0aDogMTZweDsgaGVpZ2h0OiAxNnB4OyB9XG5cbiAgICAubGItaW1nIHtcbiAgICAgIG1heC13aWR0aDogOTJ2dzsgbWF4LWhlaWdodDogOTJ2aDtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDhweDtcbiAgICAgIGJveC1zaGFkb3c6IDAgOHB4IDQwcHggcmdiYSgwLDAsMCwwLjYpO1xuICAgICAgY3Vyc29yOiBkZWZhdWx0O1xuICAgIH1cbiAgICAubGItaW1nLmxiLWltZy1kZXRhY2hlZCB7XG4gICAgICBtYXgtd2lkdGg6IDEwMCU7IG1heC1oZWlnaHQ6IDEwMCU7XG4gICAgICBib3JkZXItcmFkaXVzOiAwOyBib3gtc2hhZG93OiBub25lO1xuICAgICAgb2JqZWN0LWZpdDogY29udGFpbjsgZmxleDogMTtcbiAgICB9XG5cbiAgICAubGItY2xvc2Uge1xuICAgICAgcG9zaXRpb246IGFic29sdXRlOyB0b3A6IDE2cHg7IHJpZ2h0OiAxNnB4O1xuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsMjU1LDI1NSwwLjE1KTsgYm9yZGVyOiBub25lOyBib3JkZXItcmFkaXVzOiA1MCU7XG4gICAgICB3aWR0aDogMzZweDsgaGVpZ2h0OiAzNnB4O1xuICAgICAgZGlzcGxheTogZmxleDsgYWxpZ24taXRlbXM6IGNlbnRlcjsganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgICBjdXJzb3I6IHBvaW50ZXI7IGNvbG9yOiAjZmZmOyB0cmFuc2l0aW9uOiBiYWNrZ3JvdW5kIDAuMTVzO1xuICAgIH1cbiAgICAubGItY2xvc2U6aG92ZXIgeyBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwyNTUsMjU1LDAuMyk7IH1cblxuICAgIC5sYi1kZXRhY2gtYnRuIHtcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTsgdG9wOiAxNnB4OyByaWdodDogNjBweDtcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LDI1NSwyNTUsMC4xNSk7IGJvcmRlcjogbm9uZTsgYm9yZGVyLXJhZGl1czogNTAlO1xuICAgICAgd2lkdGg6IDM2cHg7IGhlaWdodDogMzZweDtcbiAgICAgIGRpc3BsYXk6IGZsZXg7IGFsaWduLWl0ZW1zOiBjZW50ZXI7IGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgICAgY3Vyc29yOiBwb2ludGVyOyBjb2xvcjogI2ZmZjsgdHJhbnNpdGlvbjogYmFja2dyb3VuZCAwLjE1cztcbiAgICB9XG4gICAgLmxiLWRldGFjaC1idG46aG92ZXIgeyBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwyNTUsMjU1LDAuMyk7IH1cblxuICAgIC5sYi1yZXNpemUtY29ybmVyIHtcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTsgYm90dG9tOiAwOyByaWdodDogMDtcbiAgICAgIHdpZHRoOiAxNnB4OyBoZWlnaHQ6IDE2cHg7XG4gICAgICBjdXJzb3I6IHNlLXJlc2l6ZTtcbiAgICAgIGJhY2tncm91bmQ6IGxpbmVhci1ncmFkaWVudCgxMzVkZWcsIHRyYW5zcGFyZW50IDUwJSwgcmdiYSgyNTUsMjU1LDI1NSwwLjIpIDUwJSk7XG4gICAgICBib3JkZXItYm90dG9tLXJpZ2h0LXJhZGl1czogMTJweDtcbiAgICB9XG4gIGBdLFxufSlcbmV4cG9ydCBjbGFzcyBDaGF0UGFuZWxDb21wb25lbnQgaW1wbGVtZW50cyBPbkluaXQsIE9uRGVzdHJveSB7XG4gIGlzT3BlbiA9IGZhbHNlO1xuICBhY3RpdmVWaWV3OiAnaW5ib3gnIHwgJ2NoYXQnIHwgJ25ldy1jb252ZXJzYXRpb24nIHwgJ2dyb3VwLW1hbmFnZXInIHwgJ2NvbnZlcnNhdGlvbi1zZXR0aW5ncycgPSAnaW5ib3gnO1xuICB3c1N0YXR1czogc3RyaW5nID0gJ2Rpc2Nvbm5lY3RlZCc7XG4gIHNpZGU6IFNpZGViYXJTaWRlID0gJ3JpZ2h0JztcbiAgc2lkZWJhcldpZHRoID0gNDAwO1xuICB0b2FzdDogeyBtZXNzYWdlOiBzdHJpbmc7IHR5cGU6ICdpbmZvJyB8ICdzdWNjZXNzJyB8ICdlcnJvcicgfSB8IG51bGwgPSBudWxsO1xuXG4gIC8vIOKUgOKUgCBGbG9hdGluZyB3aW5kb3cgc3RhdGUg4pSA4pSAXG4gIGlzRmxvYXRpbmcgPSBmYWxzZTtcbiAgZmxvYXRYID0gODA7XG4gIGZsb2F0WSA9IDgwO1xuICBmbG9hdFdpZHRoID0gMzgwO1xuICBmbG9hdEhlaWdodCA9IDU0MDtcblxuICBwcml2YXRlIGRlZmF1bHRXaWR0aCA9IDQwMDtcbiAgcHJpdmF0ZSByZXNpemluZyA9IGZhbHNlO1xuICBwcml2YXRlIHJlc2l6ZVN0YXJ0WCA9IDA7XG4gIHByaXZhdGUgcmVzaXplU3RhcnRXaWR0aCA9IDA7XG4gIHByaXZhdGUgYm91bmRSZXNpemVNb3ZlID0gdGhpcy5vblJlc2l6ZU1vdmUuYmluZCh0aGlzKTtcbiAgcHJpdmF0ZSBib3VuZFJlc2l6ZUVuZCA9IHRoaXMub25SZXNpemVFbmQuYmluZCh0aGlzKTtcblxuICAvLyBmbG9hdCBkcmFnXG4gIHByaXZhdGUgZmxvYXREcmFnZ2luZyA9IGZhbHNlO1xuICBwcml2YXRlIGZsb2F0RHJhZ09mZlggPSAwO1xuICBwcml2YXRlIGZsb2F0RHJhZ09mZlkgPSAwO1xuICBwcml2YXRlIGJvdW5kRmxvYXRNb3ZlID0gdGhpcy5vbkZsb2F0RHJhZ01vdmUuYmluZCh0aGlzKTtcbiAgcHJpdmF0ZSBib3VuZEZsb2F0RW5kICA9IHRoaXMub25GbG9hdERyYWdFbmQuYmluZCh0aGlzKTtcblxuICAvLyBmbG9hdCByZXNpemVcbiAgcHJpdmF0ZSBmbG9hdFJlc2l6aW5nID0gZmFsc2U7XG4gIHByaXZhdGUgZmxvYXRSZXNpemVTdGFydFggPSAwO1xuICBwcml2YXRlIGZsb2F0UmVzaXplU3RhcnRZID0gMDtcbiAgcHJpdmF0ZSBmbG9hdFJlc2l6ZVN0YXJ0VyA9IDA7XG4gIHByaXZhdGUgZmxvYXRSZXNpemVTdGFydEggPSAwO1xuICBwcml2YXRlIGJvdW5kRmxvYXRSZXNpemVNb3ZlID0gdGhpcy5vbkZsb2F0UmVzaXplTW92ZS5iaW5kKHRoaXMpO1xuICBwcml2YXRlIGJvdW5kRmxvYXRSZXNpemVFbmQgID0gdGhpcy5vbkZsb2F0UmVzaXplRW5kLmJpbmQodGhpcyk7XG5cbiAgcHJpdmF0ZSBzdWIhOiBTdWJzY3JpcHRpb247XG5cbiAgLy8g4pSA4pSAIExpZ2h0Ym94IHN0YXRlIOKUgOKUgFxuICBsaWdodGJveFVybDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG4gIGxpZ2h0Ym94RGV0YWNoZWQgPSBmYWxzZTtcbiAgbGlnaHRib3hYID0gMTAwO1xuICBsaWdodGJveFkgPSA4MDtcbiAgbGlnaHRib3hXID0gNTYwO1xuICBsaWdodGJveEggPSA0NjA7XG4gIHByaXZhdGUgbGJEcmFnZ2luZyA9IGZhbHNlO1xuICBwcml2YXRlIGxiRHJhZ09mZlggPSAwO1xuICBwcml2YXRlIGxiRHJhZ09mZlkgPSAwO1xuICBwcml2YXRlIGxiUmVzaXppbmcgPSBmYWxzZTtcbiAgcHJpdmF0ZSBsYlJlc2l6ZVN0YXJ0WCA9IDA7XG4gIHByaXZhdGUgbGJSZXNpemVTdGFydFkgPSAwO1xuICBwcml2YXRlIGxiUmVzaXplU3RhcnRXID0gMDtcbiAgcHJpdmF0ZSBsYlJlc2l6ZVN0YXJ0SCA9IDA7XG4gIHByaXZhdGUgYm91bmRMYk1vdmUgICAgICAgID0gdGhpcy5vbkxiRHJhZ01vdmUuYmluZCh0aGlzKTtcbiAgcHJpdmF0ZSBib3VuZExiRW5kICAgICAgICAgPSB0aGlzLm9uTGJEcmFnRW5kLmJpbmQodGhpcyk7XG4gIHByaXZhdGUgYm91bmRMYlJlc2l6ZU1vdmUgID0gdGhpcy5vbkxiUmVzaXplTW92ZS5iaW5kKHRoaXMpO1xuICBwcml2YXRlIGJvdW5kTGJSZXNpemVFbmQgICA9IHRoaXMub25MYlJlc2l6ZUVuZC5iaW5kKHRoaXMpO1xuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgc3RvcmU6IE1lc3NhZ2luZ1N0b3JlU2VydmljZSkge31cblxuICBuZ09uSW5pdCgpOiB2b2lkIHtcbiAgICB0aGlzLnNpZGUgPSB0aGlzLnN0b3JlLmdldFNpZGViYXJTaWRlKCk7XG4gICAgY29uc3Qgc2F2ZWQgPSBsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnbWVzc2FnaW5nX3NpZGViYXJfd2lkdGgnKTtcbiAgICBpZiAoc2F2ZWQpIHRoaXMuc2lkZWJhcldpZHRoID0gcGFyc2VJbnQoc2F2ZWQsIDEwKSB8fCB0aGlzLmRlZmF1bHRXaWR0aDtcblxuICAgIGNvbnN0IHNhdmVkRmxvYXQgPSBsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnbWVzc2FnaW5nX2Zsb2F0X3N0YXRlJyk7XG4gICAgaWYgKHNhdmVkRmxvYXQpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGYgPSBKU09OLnBhcnNlKHNhdmVkRmxvYXQpO1xuICAgICAgICB0aGlzLmlzRmxvYXRpbmcgPSBmLmlzRmxvYXRpbmcgPz8gZmFsc2U7XG4gICAgICAgIHRoaXMuc3RvcmUuc2V0UGFuZWxGbG9hdGluZyh0aGlzLmlzRmxvYXRpbmcpO1xuICAgICAgICB0aGlzLmZsb2F0WCA9IGYueCA/PyA4MDtcbiAgICAgICAgdGhpcy5mbG9hdFkgPSBmLnkgPz8gODA7XG4gICAgICAgIHRoaXMuZmxvYXRXaWR0aCA9IGYudyA/PyAzODA7XG4gICAgICAgIHRoaXMuZmxvYXRIZWlnaHQgPSBmLmggPz8gNTQwO1xuICAgICAgfSBjYXRjaCB7fVxuICAgIH1cblxuICAgIHRoaXMuc3ViID0gY29tYmluZUxhdGVzdChbXG4gICAgICB0aGlzLnN0b3JlLnBhbmVsT3BlbixcbiAgICAgIHRoaXMuc3RvcmUuYWN0aXZlVmlldyxcbiAgICAgIHRoaXMuc3RvcmUud3NTdGF0dXMsXG4gICAgICB0aGlzLnN0b3JlLnNpZGViYXJTaWRlLFxuICAgICAgdGhpcy5zdG9yZS50b2FzdCxcbiAgICBdKS5zdWJzY3JpYmUoKFtvcGVuLCB2aWV3LCB3cywgc2lkZSwgdG9hc3RdKSA9PiB7XG4gICAgICB0aGlzLmlzT3BlbiA9IG9wZW47XG4gICAgICB0aGlzLmFjdGl2ZVZpZXcgPSB2aWV3O1xuICAgICAgdGhpcy53c1N0YXR1cyA9IHdzO1xuICAgICAgdGhpcy5zaWRlID0gc2lkZTtcbiAgICAgIHRoaXMudG9hc3QgPSB0b2FzdDtcbiAgICB9KTtcbiAgfVxuXG4gIG5nT25EZXN0cm95KCk6IHZvaWQge1xuICAgIHRoaXMuc3ViPy51bnN1YnNjcmliZSgpO1xuICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIHRoaXMuYm91bmRSZXNpemVNb3ZlKTtcbiAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgdGhpcy5ib3VuZFJlc2l6ZUVuZCk7XG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgdGhpcy5ib3VuZEZsb2F0TW92ZSk7XG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIHRoaXMuYm91bmRGbG9hdEVuZCk7XG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgdGhpcy5ib3VuZEZsb2F0UmVzaXplTW92ZSk7XG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIHRoaXMuYm91bmRGbG9hdFJlc2l6ZUVuZCk7XG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgdGhpcy5ib3VuZExiTW92ZSk7XG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIHRoaXMuYm91bmRMYkVuZCk7XG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgdGhpcy5ib3VuZExiUmVzaXplTW92ZSk7XG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIHRoaXMuYm91bmRMYlJlc2l6ZUVuZCk7XG4gIH1cblxuICAvLyDilIDilIAgTGlnaHRib3gg4pSA4pSAXG4gIG9wZW5MaWdodGJveCh1cmw6IHN0cmluZyk6IHZvaWQge1xuICAgIHRoaXMubGlnaHRib3hVcmwgPSB1cmw7XG4gICAgdGhpcy5saWdodGJveERldGFjaGVkID0gZmFsc2U7XG4gIH1cblxuICBvbkxpZ2h0Ym94QmFja2Ryb3BDbGljayhldmVudDogTW91c2VFdmVudCk6IHZvaWQge1xuICAgIGlmICh0aGlzLmxpZ2h0Ym94RGV0YWNoZWQpIHJldHVybjtcbiAgICBpZiAoZXZlbnQudGFyZ2V0ICE9PSBldmVudC5jdXJyZW50VGFyZ2V0KSByZXR1cm47XG4gICAgdGhpcy5saWdodGJveFVybCA9IG51bGw7XG4gIH1cblxuICBkZXRhY2hMaWdodGJveCgpOiB2b2lkIHtcbiAgICB0aGlzLmxpZ2h0Ym94RGV0YWNoZWQgPSB0cnVlO1xuICAgIHRoaXMubGlnaHRib3hYID0gTWF0aC5tYXgoMjAsIE1hdGgucm91bmQoKHdpbmRvdy5pbm5lcldpZHRoICAtIHRoaXMubGlnaHRib3hXKSAvIDIpKTtcbiAgICB0aGlzLmxpZ2h0Ym94WSA9IE1hdGgubWF4KDIwLCBNYXRoLnJvdW5kKCh3aW5kb3cuaW5uZXJIZWlnaHQgLSB0aGlzLmxpZ2h0Ym94SCkgLyAyKSk7XG4gIH1cblxuICBvbkxiRHJhZ1N0YXJ0KGV2ZW50OiBNb3VzZUV2ZW50KTogdm9pZCB7XG4gICAgaWYgKChldmVudC50YXJnZXQgYXMgSFRNTEVsZW1lbnQpLmNsb3Nlc3QoJ2J1dHRvbicpKSByZXR1cm47XG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICB0aGlzLmxiRHJhZ2dpbmcgPSB0cnVlO1xuICAgIHRoaXMubGJEcmFnT2ZmWCA9IGV2ZW50LmNsaWVudFggLSB0aGlzLmxpZ2h0Ym94WDtcbiAgICB0aGlzLmxiRHJhZ09mZlkgPSBldmVudC5jbGllbnRZIC0gdGhpcy5saWdodGJveFk7XG4gICAgZG9jdW1lbnQuYm9keS5zdHlsZS51c2VyU2VsZWN0ID0gJ25vbmUnO1xuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIHRoaXMuYm91bmRMYk1vdmUpO1xuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCAgIHRoaXMuYm91bmRMYkVuZCk7XG4gIH1cblxuICBwcml2YXRlIG9uTGJEcmFnTW92ZShldmVudDogTW91c2VFdmVudCk6IHZvaWQge1xuICAgIGlmICghdGhpcy5sYkRyYWdnaW5nKSByZXR1cm47XG4gICAgdGhpcy5saWdodGJveFggPSBNYXRoLm1heCgwLCBNYXRoLm1pbihldmVudC5jbGllbnRYIC0gdGhpcy5sYkRyYWdPZmZYLCB3aW5kb3cuaW5uZXJXaWR0aCAgLSB0aGlzLmxpZ2h0Ym94VykpO1xuICAgIHRoaXMubGlnaHRib3hZID0gTWF0aC5tYXgoMCwgTWF0aC5taW4oZXZlbnQuY2xpZW50WSAtIHRoaXMubGJEcmFnT2ZmWSwgd2luZG93LmlubmVySGVpZ2h0IC0gNjApKTtcbiAgfVxuXG4gIHByaXZhdGUgb25MYkRyYWdFbmQoKTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLmxiRHJhZ2dpbmcpIHJldHVybjtcbiAgICB0aGlzLmxiRHJhZ2dpbmcgPSBmYWxzZTtcbiAgICBkb2N1bWVudC5ib2R5LnN0eWxlLnVzZXJTZWxlY3QgPSAnJztcbiAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCB0aGlzLmJvdW5kTGJNb3ZlKTtcbiAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgICB0aGlzLmJvdW5kTGJFbmQpO1xuICB9XG5cbiAgb25MYlJlc2l6ZVN0YXJ0KGV2ZW50OiBNb3VzZUV2ZW50KTogdm9pZCB7XG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICB0aGlzLmxiUmVzaXppbmcgPSB0cnVlO1xuICAgIHRoaXMubGJSZXNpemVTdGFydFggPSBldmVudC5jbGllbnRYO1xuICAgIHRoaXMubGJSZXNpemVTdGFydFkgPSBldmVudC5jbGllbnRZO1xuICAgIHRoaXMubGJSZXNpemVTdGFydFcgPSB0aGlzLmxpZ2h0Ym94VztcbiAgICB0aGlzLmxiUmVzaXplU3RhcnRIID0gdGhpcy5saWdodGJveEg7XG4gICAgZG9jdW1lbnQuYm9keS5zdHlsZS5jdXJzb3IgPSAnc2UtcmVzaXplJztcbiAgICBkb2N1bWVudC5ib2R5LnN0eWxlLnVzZXJTZWxlY3QgPSAnbm9uZSc7XG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgdGhpcy5ib3VuZExiUmVzaXplTW92ZSk7XG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsICAgdGhpcy5ib3VuZExiUmVzaXplRW5kKTtcbiAgfVxuXG4gIHByaXZhdGUgb25MYlJlc2l6ZU1vdmUoZXZlbnQ6IE1vdXNlRXZlbnQpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMubGJSZXNpemluZykgcmV0dXJuO1xuICAgIHRoaXMubGlnaHRib3hXID0gTWF0aC5tYXgoMjQwLCB0aGlzLmxiUmVzaXplU3RhcnRXICsgKGV2ZW50LmNsaWVudFggLSB0aGlzLmxiUmVzaXplU3RhcnRYKSk7XG4gICAgdGhpcy5saWdodGJveEggPSBNYXRoLm1heCgyMDAsIHRoaXMubGJSZXNpemVTdGFydEggKyAoZXZlbnQuY2xpZW50WSAtIHRoaXMubGJSZXNpemVTdGFydFkpKTtcbiAgfVxuXG4gIHByaXZhdGUgb25MYlJlc2l6ZUVuZCgpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMubGJSZXNpemluZykgcmV0dXJuO1xuICAgIHRoaXMubGJSZXNpemluZyA9IGZhbHNlO1xuICAgIGRvY3VtZW50LmJvZHkuc3R5bGUuY3Vyc29yID0gJyc7XG4gICAgZG9jdW1lbnQuYm9keS5zdHlsZS51c2VyU2VsZWN0ID0gJyc7XG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgdGhpcy5ib3VuZExiUmVzaXplTW92ZSk7XG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsICAgdGhpcy5ib3VuZExiUmVzaXplRW5kKTtcbiAgfVxuXG4gIHRvZ2dsZVNpZGUoKTogdm9pZCB7XG4gICAgdGhpcy5zdG9yZS50b2dnbGVTaWRlYmFyU2lkZSgpO1xuICB9XG5cbiAgb3Blbk5ld0NvbnZlcnNhdGlvbigpOiB2b2lkIHtcbiAgICB0aGlzLnN0b3JlLnNldFZpZXcoJ25ldy1jb252ZXJzYXRpb24nKTtcbiAgfVxuXG4gIG9wZW5Hcm91cE1hbmFnZXIoKTogdm9pZCB7XG4gICAgdGhpcy5zdG9yZS5zZXRWaWV3KCdncm91cC1tYW5hZ2VyJyk7XG4gIH1cblxuICBnZXRTdGF0dXNUb29sdGlwKCk6IHN0cmluZyB7XG4gICAgaWYgKHRoaXMud3NTdGF0dXMgPT09ICdhdXRoZW50aWNhdGVkJykgcmV0dXJuICdDb25uZWN0ZWQnO1xuICAgIGlmICh0aGlzLndzU3RhdHVzID09PSAnY29ubmVjdGluZycpIHJldHVybiAnQ29ubmVjdGluZyc7XG4gICAgcmV0dXJuICdEaXNjb25uZWN0ZWQnO1xuICB9XG5cbiAgY2xvc2UoKTogdm9pZCB7XG4gICAgdGhpcy5zdG9yZS5jbG9zZVBhbmVsKCk7XG4gIH1cblxuICB0b2dnbGVGbG9hdCgpOiB2b2lkIHtcbiAgICB0aGlzLmlzRmxvYXRpbmcgPSAhdGhpcy5pc0Zsb2F0aW5nO1xuICAgIHRoaXMuc3RvcmUuc2V0UGFuZWxGbG9hdGluZyh0aGlzLmlzRmxvYXRpbmcpO1xuICAgIGlmICh0aGlzLmlzRmxvYXRpbmcpIHtcbiAgICAgIC8vIENlbnRyZSB0aGUgZmxvYXQgd2luZG93IG9uIHNjcmVlbiB3aGVuIGZpcnN0IHBvcHBpbmcgb3V0XG4gICAgICB0aGlzLmZsb2F0WCA9IE1hdGgubWF4KDIwLCBNYXRoLnJvdW5kKCh3aW5kb3cuaW5uZXJXaWR0aCAgLSB0aGlzLmZsb2F0V2lkdGgpICAvIDIpKTtcbiAgICAgIHRoaXMuZmxvYXRZID0gTWF0aC5tYXgoMjAsIE1hdGgucm91bmQoKHdpbmRvdy5pbm5lckhlaWdodCAtIHRoaXMuZmxvYXRIZWlnaHQpIC8gMikpO1xuICAgIH1cbiAgICB0aGlzLnNhdmVGbG9hdFN0YXRlKCk7XG4gIH1cblxuICAvLyDilIDilIAgU2lkZWJhciByZXNpemUg4pSA4pSAXG4gIG9uUmVzaXplU3RhcnQoZXZlbnQ6IE1vdXNlRXZlbnQpOiB2b2lkIHtcbiAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIHRoaXMucmVzaXppbmcgPSB0cnVlO1xuICAgIHRoaXMucmVzaXplU3RhcnRYID0gZXZlbnQuY2xpZW50WDtcbiAgICB0aGlzLnJlc2l6ZVN0YXJ0V2lkdGggPSB0aGlzLnNpZGViYXJXaWR0aDtcbiAgICBkb2N1bWVudC5ib2R5LnN0eWxlLmN1cnNvciA9ICdldy1yZXNpemUnO1xuICAgIGRvY3VtZW50LmJvZHkuc3R5bGUudXNlclNlbGVjdCA9ICdub25lJztcbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCB0aGlzLmJvdW5kUmVzaXplTW92ZSk7XG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIHRoaXMuYm91bmRSZXNpemVFbmQpO1xuICB9XG5cbiAgcHJpdmF0ZSBvblJlc2l6ZU1vdmUoZXZlbnQ6IE1vdXNlRXZlbnQpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMucmVzaXppbmcpIHJldHVybjtcbiAgICBjb25zdCBkeCA9IGV2ZW50LmNsaWVudFggLSB0aGlzLnJlc2l6ZVN0YXJ0WDtcbiAgICBpZiAodGhpcy5zaWRlID09PSAncmlnaHQnKSB7XG4gICAgICB0aGlzLnNpZGViYXJXaWR0aCA9IE1hdGgubWF4KDIwMCwgdGhpcy5yZXNpemVTdGFydFdpZHRoIC0gZHgpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnNpZGViYXJXaWR0aCA9IE1hdGgubWF4KDIwMCwgdGhpcy5yZXNpemVTdGFydFdpZHRoICsgZHgpO1xuICAgIH1cbiAgICB0aGlzLnNpZGViYXJXaWR0aCA9IE1hdGgubWluKHRoaXMuc2lkZWJhcldpZHRoLCB3aW5kb3cuaW5uZXJXaWR0aCAqIDAuOSk7XG4gIH1cblxuICBwcml2YXRlIG9uUmVzaXplRW5kKCk6IHZvaWQge1xuICAgIGlmICghdGhpcy5yZXNpemluZykgcmV0dXJuO1xuICAgIHRoaXMucmVzaXppbmcgPSBmYWxzZTtcbiAgICBkb2N1bWVudC5ib2R5LnN0eWxlLmN1cnNvciA9ICcnO1xuICAgIGRvY3VtZW50LmJvZHkuc3R5bGUudXNlclNlbGVjdCA9ICcnO1xuICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIHRoaXMuYm91bmRSZXNpemVNb3ZlKTtcbiAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgdGhpcy5ib3VuZFJlc2l6ZUVuZCk7XG4gICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ21lc3NhZ2luZ19zaWRlYmFyX3dpZHRoJywgU3RyaW5nKHRoaXMuc2lkZWJhcldpZHRoKSk7XG4gIH1cblxuICAvLyDilIDilIAgRmxvYXRpbmcgcGFuZWwgZHJhZyDilIDilIBcbiAgb25GbG9hdERyYWdTdGFydChldmVudDogTW91c2VFdmVudCk6IHZvaWQge1xuICAgIC8vIElnbm9yZSBpZiBjb21pbmcgZnJvbSBhIGJ1dHRvbiBpbnNpZGUgdGhlIGhlYWRlclxuICAgIGlmICgoZXZlbnQudGFyZ2V0IGFzIEhUTUxFbGVtZW50KS5jbG9zZXN0KCdidXR0b24nKSkgcmV0dXJuO1xuICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgdGhpcy5mbG9hdERyYWdnaW5nID0gdHJ1ZTtcbiAgICB0aGlzLmZsb2F0RHJhZ09mZlggPSBldmVudC5jbGllbnRYIC0gdGhpcy5mbG9hdFg7XG4gICAgdGhpcy5mbG9hdERyYWdPZmZZID0gZXZlbnQuY2xpZW50WSAtIHRoaXMuZmxvYXRZO1xuICAgIGRvY3VtZW50LmJvZHkuc3R5bGUudXNlclNlbGVjdCA9ICdub25lJztcbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCB0aGlzLmJvdW5kRmxvYXRNb3ZlKTtcbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgdGhpcy5ib3VuZEZsb2F0RW5kKTtcbiAgfVxuXG4gIHByaXZhdGUgb25GbG9hdERyYWdNb3ZlKGV2ZW50OiBNb3VzZUV2ZW50KTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLmZsb2F0RHJhZ2dpbmcpIHJldHVybjtcbiAgICB0aGlzLmZsb2F0WCA9IE1hdGgubWF4KDAsIE1hdGgubWluKGV2ZW50LmNsaWVudFggLSB0aGlzLmZsb2F0RHJhZ09mZlgsIHdpbmRvdy5pbm5lcldpZHRoICAtIHRoaXMuZmxvYXRXaWR0aCkpO1xuICAgIHRoaXMuZmxvYXRZID0gTWF0aC5tYXgoMCwgTWF0aC5taW4oZXZlbnQuY2xpZW50WSAtIHRoaXMuZmxvYXREcmFnT2ZmWSwgd2luZG93LmlubmVySGVpZ2h0IC0gNjApKTtcbiAgfVxuXG4gIHByaXZhdGUgb25GbG9hdERyYWdFbmQoKTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLmZsb2F0RHJhZ2dpbmcpIHJldHVybjtcbiAgICB0aGlzLmZsb2F0RHJhZ2dpbmcgPSBmYWxzZTtcbiAgICBkb2N1bWVudC5ib2R5LnN0eWxlLnVzZXJTZWxlY3QgPSAnJztcbiAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCB0aGlzLmJvdW5kRmxvYXRNb3ZlKTtcbiAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgdGhpcy5ib3VuZEZsb2F0RW5kKTtcbiAgICB0aGlzLnNhdmVGbG9hdFN0YXRlKCk7XG4gIH1cblxuICAvLyDilIDilIAgRmxvYXRpbmcgcGFuZWwgcmVzaXplIChTRSBjb3JuZXIpIOKUgOKUgFxuICBvbkZsb2F0UmVzaXplU3RhcnQoZXZlbnQ6IE1vdXNlRXZlbnQpOiB2b2lkIHtcbiAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuICAgIHRoaXMuZmxvYXRSZXNpemluZyA9IHRydWU7XG4gICAgdGhpcy5mbG9hdFJlc2l6ZVN0YXJ0WCA9IGV2ZW50LmNsaWVudFg7XG4gICAgdGhpcy5mbG9hdFJlc2l6ZVN0YXJ0WSA9IGV2ZW50LmNsaWVudFk7XG4gICAgdGhpcy5mbG9hdFJlc2l6ZVN0YXJ0VyA9IHRoaXMuZmxvYXRXaWR0aDtcbiAgICB0aGlzLmZsb2F0UmVzaXplU3RhcnRIID0gdGhpcy5mbG9hdEhlaWdodDtcbiAgICBkb2N1bWVudC5ib2R5LnN0eWxlLmN1cnNvciA9ICdzZS1yZXNpemUnO1xuICAgIGRvY3VtZW50LmJvZHkuc3R5bGUudXNlclNlbGVjdCA9ICdub25lJztcbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCB0aGlzLmJvdW5kRmxvYXRSZXNpemVNb3ZlKTtcbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgdGhpcy5ib3VuZEZsb2F0UmVzaXplRW5kKTtcbiAgfVxuXG4gIHByaXZhdGUgb25GbG9hdFJlc2l6ZU1vdmUoZXZlbnQ6IE1vdXNlRXZlbnQpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMuZmxvYXRSZXNpemluZykgcmV0dXJuO1xuICAgIHRoaXMuZmxvYXRXaWR0aCAgPSBNYXRoLm1heCgyODAsIHRoaXMuZmxvYXRSZXNpemVTdGFydFcgKyAoZXZlbnQuY2xpZW50WCAtIHRoaXMuZmxvYXRSZXNpemVTdGFydFgpKTtcbiAgICB0aGlzLmZsb2F0SGVpZ2h0ID0gTWF0aC5tYXgoMzIwLCB0aGlzLmZsb2F0UmVzaXplU3RhcnRIICsgKGV2ZW50LmNsaWVudFkgLSB0aGlzLmZsb2F0UmVzaXplU3RhcnRZKSk7XG4gIH1cblxuICBwcml2YXRlIG9uRmxvYXRSZXNpemVFbmQoKTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLmZsb2F0UmVzaXppbmcpIHJldHVybjtcbiAgICB0aGlzLmZsb2F0UmVzaXppbmcgPSBmYWxzZTtcbiAgICBkb2N1bWVudC5ib2R5LnN0eWxlLmN1cnNvciA9ICcnO1xuICAgIGRvY3VtZW50LmJvZHkuc3R5bGUudXNlclNlbGVjdCA9ICcnO1xuICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIHRoaXMuYm91bmRGbG9hdFJlc2l6ZU1vdmUpO1xuICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCB0aGlzLmJvdW5kRmxvYXRSZXNpemVFbmQpO1xuICAgIHRoaXMuc2F2ZUZsb2F0U3RhdGUoKTtcbiAgfVxuXG4gIHByaXZhdGUgc2F2ZUZsb2F0U3RhdGUoKTogdm9pZCB7XG4gICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ21lc3NhZ2luZ19mbG9hdF9zdGF0ZScsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIGlzRmxvYXRpbmc6IHRoaXMuaXNGbG9hdGluZyxcbiAgICAgIHg6IHRoaXMuZmxvYXRYLFxuICAgICAgeTogdGhpcy5mbG9hdFksXG4gICAgICB3OiB0aGlzLmZsb2F0V2lkdGgsXG4gICAgICBoOiB0aGlzLmZsb2F0SGVpZ2h0LFxuICAgIH0pKTtcbiAgfVxufVxuIl19