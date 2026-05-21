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
  `, isInline: true, styles: [".sidebar{position:fixed;top:0;bottom:0;width:400px;background:#041322;z-index:9999;display:flex;flex-direction:column;box-shadow:0 0 40px #0009;transition:transform .3s cubic-bezier(.4,0,.2,1)}.sidebar.side-right{right:0;transform:translate(100%)}.sidebar.side-left{left:0;transform:translate(-100%)}.sidebar.open.side-right,.sidebar.open.side-left{transform:translate(0)}.resize-handle{position:absolute;top:0;bottom:0;width:5px;cursor:ew-resize;z-index:1;transition:background .15s}.resize-handle:hover,.resize-handle:active{background:#ffffff26}.resize-handle.handle-left{left:0}.resize-handle.handle-right{right:0}.sidebar-header{display:flex;align-items:center;justify-content:space-between;padding:8px 10px 8px 14px;border-bottom:1px solid rgba(255,255,255,.15);flex-shrink:0;position:relative;z-index:2;min-height:48px}.header-left{display:flex;align-items:center;gap:8px;min-width:0}.header-title{font-size:16px;font-weight:700;color:#fff;letter-spacing:.3px;white-space:nowrap}.header-actions{display:flex;align-items:center;gap:0}.btn-spacer{width:12px}.hdr-btn{width:32px;height:32px;min-width:32px;padding:0;display:inline-flex;align-items:center;justify-content:center;border-radius:6px!important;transition:background .15s,box-shadow .15s;--mdc-icon-button-state-layer-size: 32px}.hdr-btn .mat-mdc-button-touch-target{width:32px;height:32px}.hdr-btn:hover{background:#ffffff26!important;box-shadow:0 2px 8px #0003}.hdr-btn mat-icon{font-size:20px;color:#ffffffd9}.sidebar-content{flex:1;overflow:hidden}.status-dot{width:8px;height:8px;border-radius:50%;background:#fff6;flex-shrink:0}.status-dot.connected{background:#22c55e;box-shadow:0 0 0 3px #22c55e2e}.status-dot.connecting{background:#f59e0b;animation:blink 1s infinite}.status-dot.disconnected{background:#ef4444;box-shadow:0 0 0 3px #ef444424}@keyframes blink{50%{opacity:.3}}.sidebar.floating{position:fixed!important;right:unset!important;left:80px;top:80px;transform:none!important;border-radius:12px;overflow:hidden;resize:none;min-width:280px;min-height:320px}.drag-handle{cursor:grab;-webkit-user-select:none;user-select:none}.drag-handle:active{cursor:grabbing}.float-resize-corner{position:absolute;bottom:0;right:0;width:16px;height:16px;cursor:se-resize;background:linear-gradient(135deg,transparent 50%,rgba(255,255,255,.25) 50%);border-bottom-right-radius:12px}@media (max-width: 480px){.sidebar{width:100%!important}.resize-handle{display:none}}.lb-overlay{position:fixed;inset:0;background:#000000e0;display:flex;align-items:center;justify-content:center;z-index:99999;cursor:pointer}.lb-overlay.lb-detached{inset:unset;background:#0c1f35;border:1px solid rgba(255,255,255,.18);border-radius:12px;box-shadow:0 12px 48px #000000b3;display:flex;flex-direction:column;overflow:hidden;cursor:default;min-width:240px;min-height:200px}.lb-drag-bar{display:flex;align-items:center;justify-content:space-between;padding:6px 8px 6px 12px;background:#041322;border-bottom:1px solid rgba(255,255,255,.12);cursor:grab;flex-shrink:0;-webkit-user-select:none;user-select:none}.lb-drag-bar:active{cursor:grabbing}.lb-drag-title{font-size:12px;color:#fff9;letter-spacing:.4px}.lb-drag-actions{display:flex;gap:2px}.lb-action-btn{background:transparent;border:none;border-radius:6px;width:28px;height:28px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#ffffffb3;transition:background .15s}.lb-action-btn:hover{background:#ffffff26}.lb-action-btn mat-icon{font-size:16px;width:16px;height:16px}.lb-img{max-width:92vw;max-height:92vh;border-radius:8px;box-shadow:0 8px 40px #0009;cursor:default}.lb-img.lb-img-detached{max-width:100%;max-height:100%;border-radius:0;box-shadow:none;object-fit:contain;flex:1}.lb-close{position:absolute;top:16px;right:16px;background:#ffffff26;border:none;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#fff;transition:background .15s}.lb-close:hover{background:#ffffff4d}.lb-detach-btn{position:absolute;top:16px;right:60px;background:#ffffff26;border:none;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#fff;transition:background .15s}.lb-detach-btn:hover{background:#ffffff4d}.lb-resize-corner{position:absolute;bottom:0;right:0;width:16px;height:16px;cursor:se-resize;background:linear-gradient(135deg,transparent 50%,rgba(255,255,255,.2) 50%);border-bottom-right-radius:12px}\n"], dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i2.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "ngmodule", type: MatIconModule }, { kind: "component", type: i3.MatIcon, selector: "mat-icon", inputs: ["color", "inline", "svgIcon", "fontSet", "fontIcon"], exportAs: ["matIcon"] }, { kind: "ngmodule", type: MatButtonModule }, { kind: "component", type: i4.MatIconButton, selector: "button[mat-icon-button]", exportAs: ["matButton"] }, { kind: "ngmodule", type: MatTooltipModule }, { kind: "directive", type: i5.MatTooltip, selector: "[matTooltip]", inputs: ["matTooltipPosition", "matTooltipPositionAtOrigin", "matTooltipDisabled", "matTooltipShowDelay", "matTooltipHideDelay", "matTooltipTouchGestures", "matTooltip", "matTooltipClass"], exportAs: ["matTooltip"] }, { kind: "component", type: InboxListComponent, selector: "app-inbox-list" }, { kind: "component", type: ChatThreadComponent, selector: "app-chat-thread", outputs: ["lightboxOpen"] }, { kind: "component", type: NewConversationComponent, selector: "app-new-conversation" }, { kind: "component", type: GroupManagerComponent, selector: "app-group-manager" }] });
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
  `, styles: [".sidebar{position:fixed;top:0;bottom:0;width:400px;background:#041322;z-index:9999;display:flex;flex-direction:column;box-shadow:0 0 40px #0009;transition:transform .3s cubic-bezier(.4,0,.2,1)}.sidebar.side-right{right:0;transform:translate(100%)}.sidebar.side-left{left:0;transform:translate(-100%)}.sidebar.open.side-right,.sidebar.open.side-left{transform:translate(0)}.resize-handle{position:absolute;top:0;bottom:0;width:5px;cursor:ew-resize;z-index:1;transition:background .15s}.resize-handle:hover,.resize-handle:active{background:#ffffff26}.resize-handle.handle-left{left:0}.resize-handle.handle-right{right:0}.sidebar-header{display:flex;align-items:center;justify-content:space-between;padding:8px 10px 8px 14px;border-bottom:1px solid rgba(255,255,255,.15);flex-shrink:0;position:relative;z-index:2;min-height:48px}.header-left{display:flex;align-items:center;gap:8px;min-width:0}.header-title{font-size:16px;font-weight:700;color:#fff;letter-spacing:.3px;white-space:nowrap}.header-actions{display:flex;align-items:center;gap:0}.btn-spacer{width:12px}.hdr-btn{width:32px;height:32px;min-width:32px;padding:0;display:inline-flex;align-items:center;justify-content:center;border-radius:6px!important;transition:background .15s,box-shadow .15s;--mdc-icon-button-state-layer-size: 32px}.hdr-btn .mat-mdc-button-touch-target{width:32px;height:32px}.hdr-btn:hover{background:#ffffff26!important;box-shadow:0 2px 8px #0003}.hdr-btn mat-icon{font-size:20px;color:#ffffffd9}.sidebar-content{flex:1;overflow:hidden}.status-dot{width:8px;height:8px;border-radius:50%;background:#fff6;flex-shrink:0}.status-dot.connected{background:#22c55e;box-shadow:0 0 0 3px #22c55e2e}.status-dot.connecting{background:#f59e0b;animation:blink 1s infinite}.status-dot.disconnected{background:#ef4444;box-shadow:0 0 0 3px #ef444424}@keyframes blink{50%{opacity:.3}}.sidebar.floating{position:fixed!important;right:unset!important;left:80px;top:80px;transform:none!important;border-radius:12px;overflow:hidden;resize:none;min-width:280px;min-height:320px}.drag-handle{cursor:grab;-webkit-user-select:none;user-select:none}.drag-handle:active{cursor:grabbing}.float-resize-corner{position:absolute;bottom:0;right:0;width:16px;height:16px;cursor:se-resize;background:linear-gradient(135deg,transparent 50%,rgba(255,255,255,.25) 50%);border-bottom-right-radius:12px}@media (max-width: 480px){.sidebar{width:100%!important}.resize-handle{display:none}}.lb-overlay{position:fixed;inset:0;background:#000000e0;display:flex;align-items:center;justify-content:center;z-index:99999;cursor:pointer}.lb-overlay.lb-detached{inset:unset;background:#0c1f35;border:1px solid rgba(255,255,255,.18);border-radius:12px;box-shadow:0 12px 48px #000000b3;display:flex;flex-direction:column;overflow:hidden;cursor:default;min-width:240px;min-height:200px}.lb-drag-bar{display:flex;align-items:center;justify-content:space-between;padding:6px 8px 6px 12px;background:#041322;border-bottom:1px solid rgba(255,255,255,.12);cursor:grab;flex-shrink:0;-webkit-user-select:none;user-select:none}.lb-drag-bar:active{cursor:grabbing}.lb-drag-title{font-size:12px;color:#fff9;letter-spacing:.4px}.lb-drag-actions{display:flex;gap:2px}.lb-action-btn{background:transparent;border:none;border-radius:6px;width:28px;height:28px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#ffffffb3;transition:background .15s}.lb-action-btn:hover{background:#ffffff26}.lb-action-btn mat-icon{font-size:16px;width:16px;height:16px}.lb-img{max-width:92vw;max-height:92vh;border-radius:8px;box-shadow:0 8px 40px #0009;cursor:default}.lb-img.lb-img-detached{max-width:100%;max-height:100%;border-radius:0;box-shadow:none;object-fit:contain;flex:1}.lb-close{position:absolute;top:16px;right:16px;background:#ffffff26;border:none;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#fff;transition:background .15s}.lb-close:hover{background:#ffffff4d}.lb-detach-btn{position:absolute;top:16px;right:60px;background:#ffffff26;border:none;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#fff;transition:background .15s}.lb-detach-btn:hover{background:#ffffff4d}.lb-resize-corner{position:absolute;bottom:0;right:0;width:16px;height:16px;cursor:se-resize;background:linear-gradient(135deg,transparent 50%,rgba(255,255,255,.2) 50%);border-bottom-right-radius:12px}\n"] }]
        }], ctorParameters: () => [{ type: i1.MessagingStoreService }] });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdC1wYW5lbC5jb21wb25lbnQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvbGliL2NvbXBvbmVudHMvY2hhdC1wYW5lbC9jaGF0LXBhbmVsLmNvbXBvbmVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsU0FBUyxFQUFxQixNQUFNLGVBQWUsQ0FBQztBQUM3RCxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDL0MsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLHdCQUF3QixDQUFDO0FBQ3ZELE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUMzRCxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSwyQkFBMkIsQ0FBQztBQUM3RCxPQUFPLEVBQWdCLGFBQWEsRUFBRSxNQUFNLE1BQU0sQ0FBQztBQUduRCxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUN4RSxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUMzRSxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUMxRixPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQzs7Ozs7OztBQSthakYsTUFBTSxPQUFPLGtCQUFrQjtJQTJEVDtJQTFEcEIsTUFBTSxHQUFHLEtBQUssQ0FBQztJQUNmLFVBQVUsR0FBc0YsT0FBTyxDQUFDO0lBQ3hHLFFBQVEsR0FBVyxjQUFjLENBQUM7SUFDbEMsSUFBSSxHQUFnQixPQUFPLENBQUM7SUFDNUIsWUFBWSxHQUFHLEdBQUcsQ0FBQztJQUVuQiw4QkFBOEI7SUFDOUIsVUFBVSxHQUFHLEtBQUssQ0FBQztJQUNuQixNQUFNLEdBQUcsRUFBRSxDQUFDO0lBQ1osTUFBTSxHQUFHLEVBQUUsQ0FBQztJQUNaLFVBQVUsR0FBRyxHQUFHLENBQUM7SUFDakIsV0FBVyxH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Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBZ0lUIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQ29tcG9uZW50LCBPbkluaXQsIE9uRGVzdHJveSB9IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xuaW1wb3J0IHsgQ29tbW9uTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvY29tbW9uJztcbmltcG9ydCB7IE1hdEljb25Nb2R1bGUgfSBmcm9tICdAYW5ndWxhci9tYXRlcmlhbC9pY29uJztcbmltcG9ydCB7IE1hdEJ1dHRvbk1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL21hdGVyaWFsL2J1dHRvbic7XG5pbXBvcnQgeyBNYXRUb29sdGlwTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvbWF0ZXJpYWwvdG9vbHRpcCc7XG5pbXBvcnQgeyBTdWJzY3JpcHRpb24sIGNvbWJpbmVMYXRlc3QgfSBmcm9tICdyeGpzJztcbmltcG9ydCB7IE1lc3NhZ2luZ1N0b3JlU2VydmljZSB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL21lc3NhZ2luZy1zdG9yZS5zZXJ2aWNlJztcbmltcG9ydCB7IFNpZGViYXJTaWRlIH0gZnJvbSAnLi4vLi4vbW9kZWxzL21lc3NhZ2luZy5tb2RlbHMnO1xuaW1wb3J0IHsgSW5ib3hMaXN0Q29tcG9uZW50IH0gZnJvbSAnLi4vaW5ib3gtbGlzdC9pbmJveC1saXN0LmNvbXBvbmVudCc7XG5pbXBvcnQgeyBDaGF0VGhyZWFkQ29tcG9uZW50IH0gZnJvbSAnLi4vY2hhdC10aHJlYWQvY2hhdC10aHJlYWQuY29tcG9uZW50JztcbmltcG9ydCB7IE5ld0NvbnZlcnNhdGlvbkNvbXBvbmVudCB9IGZyb20gJy4uL25ldy1jb252ZXJzYXRpb24vbmV3LWNvbnZlcnNhdGlvbi5jb21wb25lbnQnO1xuaW1wb3J0IHsgR3JvdXBNYW5hZ2VyQ29tcG9uZW50IH0gZnJvbSAnLi4vZ3JvdXAtbWFuYWdlci9ncm91cC1tYW5hZ2VyLmNvbXBvbmVudCc7XG5cbkBDb21wb25lbnQoe1xuICBzZWxlY3RvcjogJ2FwcC1jaGF0LXBhbmVsJyxcbiAgc3RhbmRhbG9uZTogdHJ1ZSxcbiAgaW1wb3J0czogW1xuICAgIENvbW1vbk1vZHVsZSwgTWF0SWNvbk1vZHVsZSwgTWF0QnV0dG9uTW9kdWxlLCBNYXRUb29sdGlwTW9kdWxlLFxuICAgIEluYm94TGlzdENvbXBvbmVudCwgQ2hhdFRocmVhZENvbXBvbmVudCxcbiAgICBOZXdDb252ZXJzYXRpb25Db21wb25lbnQsIEdyb3VwTWFuYWdlckNvbXBvbmVudCxcbiAgXSxcbiAgdGVtcGxhdGU6IGBcbiAgICA8IS0tIFNpZGViYXIgLyBGbG9hdGluZyBwYW5lbCAtLT5cbiAgICA8ZGl2XG4gICAgICBjbGFzcz1cInNpZGViYXJcIlxuICAgICAgW2NsYXNzLm9wZW5dPVwiaXNPcGVuXCJcbiAgICAgIFtjbGFzcy5zaWRlLWxlZnRdPVwiIWlzRmxvYXRpbmcgJiYgc2lkZSA9PT0gJ2xlZnQnXCJcbiAgICAgIFtjbGFzcy5zaWRlLXJpZ2h0XT1cIiFpc0Zsb2F0aW5nICYmIHNpZGUgPT09ICdyaWdodCdcIlxuICAgICAgW2NsYXNzLmZsb2F0aW5nXT1cImlzRmxvYXRpbmdcIlxuICAgICAgW3N0eWxlLndpZHRoLnB4XT1cImlzRmxvYXRpbmcgPyBmbG9hdFdpZHRoIDogc2lkZWJhcldpZHRoXCJcbiAgICAgIFtzdHlsZS5oZWlnaHQucHhdPVwiaXNGbG9hdGluZyA/IGZsb2F0SGVpZ2h0IDogbnVsbFwiXG4gICAgICBbc3R5bGUubGVmdC5weF09XCJpc0Zsb2F0aW5nID8gZmxvYXRYIDogbnVsbFwiXG4gICAgICBbc3R5bGUudG9wLnB4XT1cImlzRmxvYXRpbmcgPyBmbG9hdFkgOiBudWxsXCJcbiAgICA+XG4gICAgICA8IS0tIFJlc2l6ZSBoYW5kbGUgKHNpZGViYXIgbW9kZSBvbmx5KSAtLT5cbiAgICAgIDxkaXZcbiAgICAgICAgKm5nSWY9XCIhaXNGbG9hdGluZ1wiXG4gICAgICAgIGNsYXNzPVwicmVzaXplLWhhbmRsZVwiXG4gICAgICAgIFtjbGFzcy5oYW5kbGUtbGVmdF09XCJzaWRlID09PSAncmlnaHQnXCJcbiAgICAgICAgW2NsYXNzLmhhbmRsZS1yaWdodF09XCJzaWRlID09PSAnbGVmdCdcIlxuICAgICAgICAobW91c2Vkb3duKT1cIm9uUmVzaXplU3RhcnQoJGV2ZW50KVwiXG4gICAgICA+PC9kaXY+XG5cbiAgICAgIDwhLS0gU2lkZWJhciBoZWFkZXIgKGFjdHMgYXMgZHJhZyBoYW5kbGUgaW4gZmxvYXRpbmcgbW9kZSkgLS0+XG4gICAgICA8ZGl2XG4gICAgICAgIGNsYXNzPVwic2lkZWJhci1oZWFkZXJcIlxuICAgICAgICBbY2xhc3MuZHJhZy1oYW5kbGVdPVwiaXNGbG9hdGluZ1wiXG4gICAgICAgIChtb3VzZWRvd24pPVwiaXNGbG9hdGluZyAmJiBvbkZsb2F0RHJhZ1N0YXJ0KCRldmVudClcIlxuICAgICAgPlxuICAgICAgICA8ZGl2IGNsYXNzPVwiaGVhZGVyLWxlZnRcIj5cbiAgICAgICAgICA8c3BhblxuICAgICAgICAgICAgY2xhc3M9XCJzdGF0dXMtZG90XCJcbiAgICAgICAgICAgIFtjbGFzcy5jb25uZWN0ZWRdPVwid3NTdGF0dXMgPT09ICdhdXRoZW50aWNhdGVkJ1wiXG4gICAgICAgICAgICBbY2xhc3MuY29ubmVjdGluZ109XCJ3c1N0YXR1cyA9PT0gJ2Nvbm5lY3RpbmcnXCJcbiAgICAgICAgICAgIFtjbGFzcy5kaXNjb25uZWN0ZWRdPVwid3NTdGF0dXMgPT09ICdkaXNjb25uZWN0ZWQnXCJcbiAgICAgICAgICAgIFttYXRUb29sdGlwXT1cImdldFN0YXR1c1Rvb2x0aXAoKVwiXG4gICAgICAgICAgICBtYXRUb29sdGlwUG9zaXRpb249XCJiZWxvd1wiXG4gICAgICAgICAgPjwvc3Bhbj5cbiAgICAgICAgICA8c3BhbiBjbGFzcz1cImhlYWRlci10aXRsZVwiPk1lc3NhZ2VzPC9zcGFuPlxuICAgICAgICA8L2Rpdj5cbiAgICAgICAgPGRpdiBjbGFzcz1cImhlYWRlci1hY3Rpb25zXCI+XG4gICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgKm5nSWY9XCJhY3RpdmVWaWV3ID09PSAnaW5ib3gnXCJcbiAgICAgICAgICAgIG1hdC1pY29uLWJ1dHRvblxuICAgICAgICAgICAgY2xhc3M9XCJoZHItYnRuXCJcbiAgICAgICAgICAgIChjbGljayk9XCJvcGVuTmV3Q29udmVyc2F0aW9uKClcIlxuICAgICAgICAgICAgbWF0VG9vbHRpcD1cIk5ldyBjb252ZXJzYXRpb25cIlxuICAgICAgICAgICAgbWF0VG9vbHRpcFBvc2l0aW9uPVwiYmVsb3dcIlxuICAgICAgICAgID5cbiAgICAgICAgICAgIDxtYXQtaWNvbj5lZGl0X3NxdWFyZTwvbWF0LWljb24+XG4gICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgKm5nSWY9XCJhY3RpdmVWaWV3ID09PSAnaW5ib3gnXCJcbiAgICAgICAgICAgIG1hdC1pY29uLWJ1dHRvblxuICAgICAgICAgICAgY2xhc3M9XCJoZHItYnRuXCJcbiAgICAgICAgICAgIChjbGljayk9XCJvcGVuR3JvdXBNYW5hZ2VyKClcIlxuICAgICAgICAgICAgbWF0VG9vbHRpcD1cIkNyZWF0ZSBncm91cFwiXG4gICAgICAgICAgICBtYXRUb29sdGlwUG9zaXRpb249XCJiZWxvd1wiXG4gICAgICAgICAgPlxuICAgICAgICAgICAgPG1hdC1pY29uPmdyb3VwX2FkZDwvbWF0LWljb24+XG4gICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgPCEtLSBTaWRlLXN3YXAgKHNpZGViYXIgbW9kZSBvbmx5KSAtLT5cbiAgICAgICAgICA8YnV0dG9uICpuZ0lmPVwiIWlzRmxvYXRpbmdcIiBtYXQtaWNvbi1idXR0b24gY2xhc3M9XCJoZHItYnRuXCIgKGNsaWNrKT1cInRvZ2dsZVNpZGUoKVwiXG4gICAgICAgICAgICBbbWF0VG9vbHRpcF09XCInTW92ZSB0byAnICsgKHNpZGUgPT09ICdyaWdodCcgPyAnbGVmdCcgOiAncmlnaHQnKVwiIG1hdFRvb2x0aXBQb3NpdGlvbj1cImJlbG93XCI+XG4gICAgICAgICAgICA8bWF0LWljb24+e3sgc2lkZSA9PT0gJ3JpZ2h0JyA/ICdjaGV2cm9uX2xlZnQnIDogJ2NoZXZyb25fcmlnaHQnIH19PC9tYXQtaWNvbj5cbiAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICA8IS0tIFBvcC1vdXQgLyBkb2NrIHRvZ2dsZSAtLT5cbiAgICAgICAgICA8YnV0dG9uIG1hdC1pY29uLWJ1dHRvbiBjbGFzcz1cImhkci1idG5cIlxuICAgICAgICAgICAgKGNsaWNrKT1cInRvZ2dsZUZsb2F0KClcIlxuICAgICAgICAgICAgW21hdFRvb2x0aXBdPVwiaXNGbG9hdGluZyA/ICdEb2NrIHRvIHNpZGViYXInIDogJ1BvcCBvdXQgdG8gZmxvYXRpbmcgd2luZG93J1wiXG4gICAgICAgICAgICBtYXRUb29sdGlwUG9zaXRpb249XCJiZWxvd1wiPlxuICAgICAgICAgICAgPG1hdC1pY29uPnt7IGlzRmxvYXRpbmcgPyAncGljdHVyZV9pbl9waWN0dXJlX2FsdCcgOiAnb3Blbl9pbl9uZXcnIH19PC9tYXQtaWNvbj5cbiAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwiYnRuLXNwYWNlclwiPjwvZGl2PlxuICAgICAgICAgIDxidXR0b24gbWF0LWljb24tYnV0dG9uIGNsYXNzPVwiaGRyLWJ0blwiIChjbGljayk9XCJjbG9zZSgpXCIgbWF0VG9vbHRpcD1cIkNsb3NlIG1lc3NlbmdlclwiIG1hdFRvb2x0aXBQb3NpdGlvbj1cImJlbG93XCI+XG4gICAgICAgICAgICA8bWF0LWljb24+Y2xvc2U8L21hdC1pY29uPlxuICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuXG4gICAgICA8IS0tIFZpZXcgY29udGFpbmVyIC0tPlxuICAgICAgPGRpdiBjbGFzcz1cInNpZGViYXItY29udGVudFwiPlxuICAgICAgICA8YXBwLWluYm94LWxpc3QgKm5nSWY9XCJhY3RpdmVWaWV3ID09PSAnaW5ib3gnXCI+PC9hcHAtaW5ib3gtbGlzdD5cbiAgICAgICAgPGFwcC1jaGF0LXRocmVhZFxuICAgICAgICAgICpuZ0lmPVwiYWN0aXZlVmlldyA9PT0gJ2NoYXQnXCJcbiAgICAgICAgICAobGlnaHRib3hPcGVuKT1cIm9wZW5MaWdodGJveCgkZXZlbnQpXCJcbiAgICAgICAgPjwvYXBwLWNoYXQtdGhyZWFkPlxuICAgICAgICA8YXBwLW5ldy1jb252ZXJzYXRpb24gKm5nSWY9XCJhY3RpdmVWaWV3ID09PSAnbmV3LWNvbnZlcnNhdGlvbidcIj48L2FwcC1uZXctY29udmVyc2F0aW9uPlxuICAgICAgICA8YXBwLWdyb3VwLW1hbmFnZXIgKm5nSWY9XCJhY3RpdmVWaWV3ID09PSAnZ3JvdXAtbWFuYWdlcidcIj48L2FwcC1ncm91cC1tYW5hZ2VyPlxuICAgICAgPC9kaXY+XG5cbiAgICAgIDwhLS0gUmVzaXplIGNvcm5lciAoZmxvYXRpbmcgbW9kZSBvbmx5KSAtLT5cbiAgICAgIDxkaXYgKm5nSWY9XCJpc0Zsb2F0aW5nXCIgY2xhc3M9XCJmbG9hdC1yZXNpemUtY29ybmVyXCIgKG1vdXNlZG93bik9XCJvbkZsb2F0UmVzaXplU3RhcnQoJGV2ZW50KVwiPjwvZGl2PlxuICAgIDwvZGl2PlxuXG4gICAgPCEtLSDilIDilIAgTGlnaHRib3g6IHNpYmxpbmcgb2YgLnNpZGViYXIgc28gcG9zaXRpb246Zml4ZWQgaXMgcmVsYXRpdmUgdG8gdmlld3BvcnQg4pSA4pSAIC0tPlxuICAgIDxkaXZcbiAgICAgICpuZ0lmPVwibGlnaHRib3hVcmxcIlxuICAgICAgY2xhc3M9XCJsYi1vdmVybGF5XCJcbiAgICAgIFtjbGFzcy5sYi1kZXRhY2hlZF09XCJsaWdodGJveERldGFjaGVkXCJcbiAgICAgIFtzdHlsZS5sZWZ0LnB4XT1cImxpZ2h0Ym94RGV0YWNoZWQgPyBsaWdodGJveFggOiBudWxsXCJcbiAgICAgIFtzdHlsZS50b3AucHhdPVwibGlnaHRib3hEZXRhY2hlZCA/IGxpZ2h0Ym94WSA6IG51bGxcIlxuICAgICAgW3N0eWxlLndpZHRoLnB4XT1cImxpZ2h0Ym94RGV0YWNoZWQgPyBsaWdodGJveFcgOiBudWxsXCJcbiAgICAgIFtzdHlsZS5oZWlnaHQucHhdPVwibGlnaHRib3hEZXRhY2hlZCA/IGxpZ2h0Ym94SCA6IG51bGxcIlxuICAgICAgKGNsaWNrKT1cIm9uTGlnaHRib3hCYWNrZHJvcENsaWNrKCRldmVudClcIlxuICAgID5cbiAgICAgIDxkaXYgKm5nSWY9XCJsaWdodGJveERldGFjaGVkXCIgY2xhc3M9XCJsYi1kcmFnLWJhclwiIChtb3VzZWRvd24pPVwib25MYkRyYWdTdGFydCgkZXZlbnQpXCI+XG4gICAgICAgIDxzcGFuIGNsYXNzPVwibGItZHJhZy10aXRsZVwiPkltYWdlIHZpZXdlcjwvc3Bhbj5cbiAgICAgICAgPGRpdiBjbGFzcz1cImxiLWRyYWctYWN0aW9uc1wiPlxuICAgICAgICAgIDxidXR0b24gdHlwZT1cImJ1dHRvblwiIGNsYXNzPVwibGItYWN0aW9uLWJ0blwiXG4gICAgICAgICAgICAoY2xpY2spPVwiJGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpOyBsaWdodGJveERldGFjaGVkID0gZmFsc2VcIiB0aXRsZT1cIkZ1bGxzY3JlZW5cIj5cbiAgICAgICAgICAgIDxtYXQtaWNvbj5mdWxsc2NyZWVuPC9tYXQtaWNvbj5cbiAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICA8YnV0dG9uIHR5cGU9XCJidXR0b25cIiBjbGFzcz1cImxiLWFjdGlvbi1idG5cIlxuICAgICAgICAgICAgKGNsaWNrKT1cIiRldmVudC5zdG9wUHJvcGFnYXRpb24oKTsgbGlnaHRib3hVcmwgPSBudWxsOyBsaWdodGJveERldGFjaGVkID0gZmFsc2VcIiB0aXRsZT1cIkNsb3NlXCI+XG4gICAgICAgICAgICA8bWF0LWljb24+Y2xvc2U8L21hdC1pY29uPlxuICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgICAgPGltZyBbc3JjXT1cImxpZ2h0Ym94VXJsXCIgY2xhc3M9XCJsYi1pbWdcIiBbY2xhc3MubGItaW1nLWRldGFjaGVkXT1cImxpZ2h0Ym94RGV0YWNoZWRcIlxuICAgICAgICAgICAoY2xpY2spPVwiJGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpXCIgLz5cbiAgICAgIDxuZy1jb250YWluZXIgKm5nSWY9XCIhbGlnaHRib3hEZXRhY2hlZFwiPlxuICAgICAgICA8YnV0dG9uIGNsYXNzPVwibGItY2xvc2VcIiAoY2xpY2spPVwibGlnaHRib3hVcmwgPSBudWxsXCI+PG1hdC1pY29uPmNsb3NlPC9tYXQtaWNvbj48L2J1dHRvbj5cbiAgICAgICAgPGJ1dHRvbiBjbGFzcz1cImxiLWRldGFjaC1idG5cIiAoY2xpY2spPVwiZGV0YWNoTGlnaHRib3goKVwiIHRpdGxlPVwiRGV0YWNoIHRvIGZsb2F0aW5nIHdpbmRvd1wiPlxuICAgICAgICAgIDxtYXQtaWNvbj5waWN0dXJlX2luX3BpY3R1cmU8L21hdC1pY29uPlxuICAgICAgICA8L2J1dHRvbj5cbiAgICAgIDwvbmctY29udGFpbmVyPlxuICAgICAgPGRpdiAqbmdJZj1cImxpZ2h0Ym94RGV0YWNoZWRcIiBjbGFzcz1cImxiLXJlc2l6ZS1jb3JuZXJcIiAobW91c2Vkb3duKT1cIm9uTGJSZXNpemVTdGFydCgkZXZlbnQpXCI+PC9kaXY+XG4gICAgPC9kaXY+XG4gIGAsXG4gIHN0eWxlczogW2BcbiAgICAuc2lkZWJhciB7XG4gICAgICBwb3NpdGlvbjogZml4ZWQ7XG4gICAgICB0b3A6IDA7XG4gICAgICBib3R0b206IDA7XG4gICAgICB3aWR0aDogNDAwcHg7XG4gICAgICBiYWNrZ3JvdW5kOiAjMDQxMzIyO1xuICAgICAgei1pbmRleDogOTk5OTtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgYm94LXNoYWRvdzogMCAwIDQwcHggcmdiYSgwLCAwLCAwLCAwLjYpO1xuICAgICAgdHJhbnNpdGlvbjogdHJhbnNmb3JtIDAuM3MgY3ViaWMtYmV6aWVyKDAuNCwgMCwgMC4yLCAxKTtcbiAgICB9XG5cbiAgICAuc2lkZWJhci5zaWRlLXJpZ2h0IHtcbiAgICAgIHJpZ2h0OiAwO1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVYKDEwMCUpO1xuICAgIH1cblxuICAgIC5zaWRlYmFyLnNpZGUtbGVmdCB7XG4gICAgICBsZWZ0OiAwO1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVYKC0xMDAlKTtcbiAgICB9XG5cbiAgICAuc2lkZWJhci5vcGVuLnNpZGUtcmlnaHQge1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVYKDApO1xuICAgIH1cblxuICAgIC5zaWRlYmFyLm9wZW4uc2lkZS1sZWZ0IHtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWCgwKTtcbiAgICB9XG5cbiAgICAvKiDilIDilIAgUmVzaXplIGhhbmRsZSAoYmVsb3cgaGVhZGVyIHNvIGhlYWRlciBjb250cm9scyBzdGF5IGNsaWNrYWJsZSkg4pSA4pSAICovXG4gICAgLnJlc2l6ZS1oYW5kbGUge1xuICAgICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgICAgdG9wOiAwO1xuICAgICAgYm90dG9tOiAwO1xuICAgICAgd2lkdGg6IDVweDtcbiAgICAgIGN1cnNvcjogZXctcmVzaXplO1xuICAgICAgei1pbmRleDogMTtcbiAgICAgIHRyYW5zaXRpb246IGJhY2tncm91bmQgMC4xNXM7XG4gICAgfVxuXG4gICAgLnJlc2l6ZS1oYW5kbGU6aG92ZXIsXG4gICAgLnJlc2l6ZS1oYW5kbGU6YWN0aXZlIHtcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xNSk7XG4gICAgfVxuXG4gICAgLnJlc2l6ZS1oYW5kbGUuaGFuZGxlLWxlZnQge1xuICAgICAgbGVmdDogMDtcbiAgICB9XG5cbiAgICAucmVzaXplLWhhbmRsZS5oYW5kbGUtcmlnaHQge1xuICAgICAgcmlnaHQ6IDA7XG4gICAgfVxuXG4gICAgLyog4pSA4pSAIEhlYWRlciDilIDilIAgKi9cbiAgICAuc2lkZWJhci1oZWFkZXIge1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWJldHdlZW47XG4gICAgICBwYWRkaW5nOiA4cHggMTBweCA4cHggMTRweDtcbiAgICAgIGJvcmRlci1ib3R0b206IDFweCBzb2xpZCByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMTUpO1xuICAgICAgZmxleC1zaHJpbms6IDA7XG4gICAgICBwb3NpdGlvbjogcmVsYXRpdmU7XG4gICAgICB6LWluZGV4OiAyO1xuICAgICAgbWluLWhlaWdodDogNDhweDtcbiAgICB9XG5cbiAgICAuaGVhZGVyLWxlZnQge1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBnYXA6IDhweDtcbiAgICAgIG1pbi13aWR0aDogMDtcbiAgICB9XG5cbiAgICAuaGVhZGVyLXRpdGxlIHtcbiAgICAgIGZvbnQtc2l6ZTogMTZweDtcbiAgICAgIGZvbnQtd2VpZ2h0OiA3MDA7XG4gICAgICBjb2xvcjogI2ZmZjtcbiAgICAgIGxldHRlci1zcGFjaW5nOiAwLjNweDtcbiAgICAgIHdoaXRlLXNwYWNlOiBub3dyYXA7XG4gICAgfVxuXG4gICAgLmhlYWRlci1hY3Rpb25zIHtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgZ2FwOiAwO1xuICAgIH1cblxuICAgIC5idG4tc3BhY2VyIHtcbiAgICAgIHdpZHRoOiAxMnB4O1xuICAgIH1cblxuICAgIC5oZHItYnRuIHtcbiAgICAgIHdpZHRoOiAzMnB4O1xuICAgICAgaGVpZ2h0OiAzMnB4O1xuICAgICAgbWluLXdpZHRoOiAzMnB4O1xuICAgICAgcGFkZGluZzogMDtcbiAgICAgIGRpc3BsYXk6IGlubGluZS1mbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgICAgYm9yZGVyLXJhZGl1czogNnB4ICFpbXBvcnRhbnQ7XG4gICAgICB0cmFuc2l0aW9uOiBiYWNrZ3JvdW5kIDAuMTVzLCBib3gtc2hhZG93IDAuMTVzO1xuICAgICAgLS1tZGMtaWNvbi1idXR0b24tc3RhdGUtbGF5ZXItc2l6ZTogMzJweDtcbiAgICB9XG5cbiAgICAuaGRyLWJ0biAubWF0LW1kYy1idXR0b24tdG91Y2gtdGFyZ2V0IHtcbiAgICAgIHdpZHRoOiAzMnB4O1xuICAgICAgaGVpZ2h0OiAzMnB4O1xuICAgIH1cblxuICAgIC5oZHItYnRuOmhvdmVyIHtcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xNSkgIWltcG9ydGFudDtcbiAgICAgIGJveC1zaGFkb3c6IDAgMnB4IDhweCByZ2JhKDAsIDAsIDAsIDAuMik7XG4gICAgfVxuXG4gICAgLmhkci1idG4gbWF0LWljb24ge1xuICAgICAgZm9udC1zaXplOiAyMHB4O1xuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC44NSk7XG4gICAgfVxuXG4gICAgLyog4pSA4pSAIENvbnRlbnQg4pSA4pSAICovXG4gICAgLnNpZGViYXItY29udGVudCB7XG4gICAgICBmbGV4OiAxO1xuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICB9XG5cbiAgICAuc3RhdHVzLWRvdCB7XG4gICAgICB3aWR0aDogOHB4O1xuICAgICAgaGVpZ2h0OiA4cHg7XG4gICAgICBib3JkZXItcmFkaXVzOiA1MCU7XG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNCk7XG4gICAgICBmbGV4LXNocmluazogMDtcbiAgICB9XG5cbiAgICAuc3RhdHVzLWRvdC5jb25uZWN0ZWQge1xuICAgICAgYmFja2dyb3VuZDogIzIyYzU1ZTtcbiAgICAgIGJveC1zaGFkb3c6IDAgMCAwIDNweCByZ2JhKDM0LCAxOTcsIDk0LCAwLjE4KTtcbiAgICB9XG5cbiAgICAuc3RhdHVzLWRvdC5jb25uZWN0aW5nIHtcbiAgICAgIGJhY2tncm91bmQ6ICNmNTllMGI7XG4gICAgICBhbmltYXRpb246IGJsaW5rIDFzIGluZmluaXRlO1xuICAgIH1cblxuICAgIC5zdGF0dXMtZG90LmRpc2Nvbm5lY3RlZCB7XG4gICAgICBiYWNrZ3JvdW5kOiAjZWY0NDQ0O1xuICAgICAgYm94LXNoYWRvdzogMCAwIDAgM3B4IHJnYmEoMjM5LCA2OCwgNjgsIDAuMTQpO1xuICAgIH1cblxuICAgIEBrZXlmcmFtZXMgYmxpbmsge1xuICAgICAgNTAlIHsgb3BhY2l0eTogMC4zOyB9XG4gICAgfVxuXG4gICAgLyog4pSA4pSAIEZsb2F0aW5nIG1vZGUg4pSA4pSAICovXG4gICAgLnNpZGViYXIuZmxvYXRpbmcge1xuICAgICAgcG9zaXRpb246IGZpeGVkICFpbXBvcnRhbnQ7XG4gICAgICByaWdodDogdW5zZXQgIWltcG9ydGFudDtcbiAgICAgIGxlZnQ6IDgwcHg7XG4gICAgICB0b3A6IDgwcHg7XG4gICAgICB0cmFuc2Zvcm06IG5vbmUgIWltcG9ydGFudDtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDEycHg7XG4gICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgcmVzaXplOiBub25lO1xuICAgICAgbWluLXdpZHRoOiAyODBweDtcbiAgICAgIG1pbi1oZWlnaHQ6IDMyMHB4O1xuICAgIH1cblxuICAgIC5kcmFnLWhhbmRsZSB7XG4gICAgICBjdXJzb3I6IGdyYWI7XG4gICAgICB1c2VyLXNlbGVjdDogbm9uZTtcbiAgICB9XG5cbiAgICAuZHJhZy1oYW5kbGU6YWN0aXZlIHtcbiAgICAgIGN1cnNvcjogZ3JhYmJpbmc7XG4gICAgfVxuXG4gICAgLmZsb2F0LXJlc2l6ZS1jb3JuZXIge1xuICAgICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgICAgYm90dG9tOiAwO1xuICAgICAgcmlnaHQ6IDA7XG4gICAgICB3aWR0aDogMTZweDtcbiAgICAgIGhlaWdodDogMTZweDtcbiAgICAgIGN1cnNvcjogc2UtcmVzaXplO1xuICAgICAgYmFja2dyb3VuZDogbGluZWFyLWdyYWRpZW50KDEzNWRlZywgdHJhbnNwYXJlbnQgNTAlLCByZ2JhKDI1NSwyNTUsMjU1LDAuMjUpIDUwJSk7XG4gICAgICBib3JkZXItYm90dG9tLXJpZ2h0LXJhZGl1czogMTJweDtcbiAgICB9XG5cbiAgICBAbWVkaWEgKG1heC13aWR0aDogNDgwcHgpIHtcbiAgICAgIC5zaWRlYmFyIHtcbiAgICAgICAgd2lkdGg6IDEwMCUgIWltcG9ydGFudDtcbiAgICAgIH1cbiAgICAgIC5yZXNpemUtaGFuZGxlIHtcbiAgICAgICAgZGlzcGxheTogbm9uZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvKiDilIDilIAgTGlnaHRib3ggKG91dHNpZGUgLnNpZGViYXIgc28gcG9zaXRpb246Zml4ZWQgaXMgdmlld3BvcnQtcmVsYXRpdmUpIOKUgOKUgCAqL1xuICAgIC5sYi1vdmVybGF5IHtcbiAgICAgIHBvc2l0aW9uOiBmaXhlZDtcbiAgICAgIGluc2V0OiAwO1xuICAgICAgYmFja2dyb3VuZDogcmdiYSgwLDAsMCwwLjg4KTtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgICB6LWluZGV4OiA5OTk5OTtcbiAgICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgICB9XG5cbiAgICAubGItb3ZlcmxheS5sYi1kZXRhY2hlZCB7XG4gICAgICBpbnNldDogdW5zZXQ7XG4gICAgICBiYWNrZ3JvdW5kOiAjMGMxZjM1O1xuICAgICAgYm9yZGVyOiAxcHggc29saWQgcmdiYSgyNTUsMjU1LDI1NSwwLjE4KTtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDEycHg7XG4gICAgICBib3gtc2hhZG93OiAwIDEycHggNDhweCByZ2JhKDAsMCwwLDAuNyk7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICBjdXJzb3I6IGRlZmF1bHQ7XG4gICAgICBtaW4td2lkdGg6IDI0MHB4O1xuICAgICAgbWluLWhlaWdodDogMjAwcHg7XG4gICAgfVxuXG4gICAgLmxiLWRyYWctYmFyIHtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAganVzdGlmeS1jb250ZW50OiBzcGFjZS1iZXR3ZWVuO1xuICAgICAgcGFkZGluZzogNnB4IDhweCA2cHggMTJweDtcbiAgICAgIGJhY2tncm91bmQ6ICMwNDEzMjI7XG4gICAgICBib3JkZXItYm90dG9tOiAxcHggc29saWQgcmdiYSgyNTUsMjU1LDI1NSwwLjEyKTtcbiAgICAgIGN1cnNvcjogZ3JhYjtcbiAgICAgIGZsZXgtc2hyaW5rOiAwO1xuICAgICAgdXNlci1zZWxlY3Q6IG5vbmU7XG4gICAgfVxuICAgIC5sYi1kcmFnLWJhcjphY3RpdmUgeyBjdXJzb3I6IGdyYWJiaW5nOyB9XG5cbiAgICAubGItZHJhZy10aXRsZSB7IGZvbnQtc2l6ZTogMTJweDsgY29sb3I6IHJnYmEoMjU1LDI1NSwyNTUsMC42KTsgbGV0dGVyLXNwYWNpbmc6IDAuNHB4OyB9XG4gICAgLmxiLWRyYWctYWN0aW9ucyB7IGRpc3BsYXk6IGZsZXg7IGdhcDogMnB4OyB9XG5cbiAgICAubGItYWN0aW9uLWJ0biB7XG4gICAgICBiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudDtcbiAgICAgIGJvcmRlcjogbm9uZTtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDZweDtcbiAgICAgIHdpZHRoOiAyOHB4OyBoZWlnaHQ6IDI4cHg7XG4gICAgICBkaXNwbGF5OiBmbGV4OyBhbGlnbi1pdGVtczogY2VudGVyOyBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwyNTUsMjU1LDAuNyk7XG4gICAgICB0cmFuc2l0aW9uOiBiYWNrZ3JvdW5kIDAuMTVzO1xuICAgIH1cbiAgICAubGItYWN0aW9uLWJ0bjpob3ZlciB7IGJhY2tncm91bmQ6IHJnYmEoMjU1LDI1NSwyNTUsMC4xNSk7IH1cbiAgICAubGItYWN0aW9uLWJ0biBtYXQtaWNvbiB7IGZvbnQtc2l6ZTogMTZweDsgd2lkdGg6IDE2cHg7IGhlaWdodDogMTZweDsgfVxuXG4gICAgLmxiLWltZyB7XG4gICAgICBtYXgtd2lkdGg6IDkydnc7IG1heC1oZWlnaHQ6IDkydmg7XG4gICAgICBib3JkZXItcmFkaXVzOiA4cHg7XG4gICAgICBib3gtc2hhZG93OiAwIDhweCA0MHB4IHJnYmEoMCwwLDAsMC42KTtcbiAgICAgIGN1cnNvcjogZGVmYXVsdDtcbiAgICB9XG4gICAgLmxiLWltZy5sYi1pbWctZGV0YWNoZWQge1xuICAgICAgbWF4LXdpZHRoOiAxMDAlOyBtYXgtaGVpZ2h0OiAxMDAlO1xuICAgICAgYm9yZGVyLXJhZGl1czogMDsgYm94LXNoYWRvdzogbm9uZTtcbiAgICAgIG9iamVjdC1maXQ6IGNvbnRhaW47IGZsZXg6IDE7XG4gICAgfVxuXG4gICAgLmxiLWNsb3NlIHtcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTsgdG9wOiAxNnB4OyByaWdodDogMTZweDtcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LDI1NSwyNTUsMC4xNSk7IGJvcmRlcjogbm9uZTsgYm9yZGVyLXJhZGl1czogNTAlO1xuICAgICAgd2lkdGg6IDM2cHg7IGhlaWdodDogMzZweDtcbiAgICAgIGRpc3BsYXk6IGZsZXg7IGFsaWduLWl0ZW1zOiBjZW50ZXI7IGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgICAgY3Vyc29yOiBwb2ludGVyOyBjb2xvcjogI2ZmZjsgdHJhbnNpdGlvbjogYmFja2dyb3VuZCAwLjE1cztcbiAgICB9XG4gICAgLmxiLWNsb3NlOmhvdmVyIHsgYmFja2dyb3VuZDogcmdiYSgyNTUsMjU1LDI1NSwwLjMpOyB9XG5cbiAgICAubGItZGV0YWNoLWJ0biB7XG4gICAgICBwb3NpdGlvbjogYWJzb2x1dGU7IHRvcDogMTZweDsgcmlnaHQ6IDYwcHg7XG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwyNTUsMjU1LDAuMTUpOyBib3JkZXI6IG5vbmU7IGJvcmRlci1yYWRpdXM6IDUwJTtcbiAgICAgIHdpZHRoOiAzNnB4OyBoZWlnaHQ6IDM2cHg7XG4gICAgICBkaXNwbGF5OiBmbGV4OyBhbGlnbi1pdGVtczogY2VudGVyOyBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgIGN1cnNvcjogcG9pbnRlcjsgY29sb3I6ICNmZmY7IHRyYW5zaXRpb246IGJhY2tncm91bmQgMC4xNXM7XG4gICAgfVxuICAgIC5sYi1kZXRhY2gtYnRuOmhvdmVyIHsgYmFja2dyb3VuZDogcmdiYSgyNTUsMjU1LDI1NSwwLjMpOyB9XG5cbiAgICAubGItcmVzaXplLWNvcm5lciB7XG4gICAgICBwb3NpdGlvbjogYWJzb2x1dGU7IGJvdHRvbTogMDsgcmlnaHQ6IDA7XG4gICAgICB3aWR0aDogMTZweDsgaGVpZ2h0OiAxNnB4O1xuICAgICAgY3Vyc29yOiBzZS1yZXNpemU7XG4gICAgICBiYWNrZ3JvdW5kOiBsaW5lYXItZ3JhZGllbnQoMTM1ZGVnLCB0cmFuc3BhcmVudCA1MCUsIHJnYmEoMjU1LDI1NSwyNTUsMC4yKSA1MCUpO1xuICAgICAgYm9yZGVyLWJvdHRvbS1yaWdodC1yYWRpdXM6IDEycHg7XG4gICAgfVxuICBgXSxcbn0pXG5leHBvcnQgY2xhc3MgQ2hhdFBhbmVsQ29tcG9uZW50IGltcGxlbWVudHMgT25Jbml0LCBPbkRlc3Ryb3kge1xuICBpc09wZW4gPSBmYWxzZTtcbiAgYWN0aXZlVmlldzogJ2luYm94JyB8ICdjaGF0JyB8ICduZXctY29udmVyc2F0aW9uJyB8ICdncm91cC1tYW5hZ2VyJyB8ICdjb252ZXJzYXRpb24tc2V0dGluZ3MnID0gJ2luYm94JztcbiAgd3NTdGF0dXM6IHN0cmluZyA9ICdkaXNjb25uZWN0ZWQnO1xuICBzaWRlOiBTaWRlYmFyU2lkZSA9ICdyaWdodCc7XG4gIHNpZGViYXJXaWR0aCA9IDQwMDtcblxuICAvLyDilIDilIAgRmxvYXRpbmcgd2luZG93IHN0YXRlIOKUgOKUgFxuICBpc0Zsb2F0aW5nID0gZmFsc2U7XG4gIGZsb2F0WCA9IDgwO1xuICBmbG9hdFkgPSA4MDtcbiAgZmxvYXRXaWR0aCA9IDM4MDtcbiAgZmxvYXRIZWlnaHQgPSA1NDA7XG5cbiAgcHJpdmF0ZSBkZWZhdWx0V2lkdGggPSA0MDA7XG4gIHByaXZhdGUgcmVzaXppbmcgPSBmYWxzZTtcbiAgcHJpdmF0ZSByZXNpemVTdGFydFggPSAwO1xuICBwcml2YXRlIHJlc2l6ZVN0YXJ0V2lkdGggPSAwO1xuICBwcml2YXRlIGJvdW5kUmVzaXplTW92ZSA9IHRoaXMub25SZXNpemVNb3ZlLmJpbmQodGhpcyk7XG4gIHByaXZhdGUgYm91bmRSZXNpemVFbmQgPSB0aGlzLm9uUmVzaXplRW5kLmJpbmQodGhpcyk7XG5cbiAgLy8gZmxvYXQgZHJhZ1xuICBwcml2YXRlIGZsb2F0RHJhZ2dpbmcgPSBmYWxzZTtcbiAgcHJpdmF0ZSBmbG9hdERyYWdPZmZYID0gMDtcbiAgcHJpdmF0ZSBmbG9hdERyYWdPZmZZID0gMDtcbiAgcHJpdmF0ZSBib3VuZEZsb2F0TW92ZSA9IHRoaXMub25GbG9hdERyYWdNb3ZlLmJpbmQodGhpcyk7XG4gIHByaXZhdGUgYm91bmRGbG9hdEVuZCAgPSB0aGlzLm9uRmxvYXREcmFnRW5kLmJpbmQodGhpcyk7XG5cbiAgLy8gZmxvYXQgcmVzaXplXG4gIHByaXZhdGUgZmxvYXRSZXNpemluZyA9IGZhbHNlO1xuICBwcml2YXRlIGZsb2F0UmVzaXplU3RhcnRYID0gMDtcbiAgcHJpdmF0ZSBmbG9hdFJlc2l6ZVN0YXJ0WSA9IDA7XG4gIHByaXZhdGUgZmxvYXRSZXNpemVTdGFydFcgPSAwO1xuICBwcml2YXRlIGZsb2F0UmVzaXplU3RhcnRIID0gMDtcbiAgcHJpdmF0ZSBib3VuZEZsb2F0UmVzaXplTW92ZSA9IHRoaXMub25GbG9hdFJlc2l6ZU1vdmUuYmluZCh0aGlzKTtcbiAgcHJpdmF0ZSBib3VuZEZsb2F0UmVzaXplRW5kICA9IHRoaXMub25GbG9hdFJlc2l6ZUVuZC5iaW5kKHRoaXMpO1xuXG4gIHByaXZhdGUgc3ViITogU3Vic2NyaXB0aW9uO1xuXG4gIC8vIOKUgOKUgCBMaWdodGJveCBzdGF0ZSDilIDilIBcbiAgbGlnaHRib3hVcmw6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuICBsaWdodGJveERldGFjaGVkID0gZmFsc2U7XG4gIGxpZ2h0Ym94WCA9IDEwMDtcbiAgbGlnaHRib3hZID0gODA7XG4gIGxpZ2h0Ym94VyA9IDU2MDtcbiAgbGlnaHRib3hIID0gNDYwO1xuICBwcml2YXRlIGxiRHJhZ2dpbmcgPSBmYWxzZTtcbiAgcHJpdmF0ZSBsYkRyYWdPZmZYID0gMDtcbiAgcHJpdmF0ZSBsYkRyYWdPZmZZID0gMDtcbiAgcHJpdmF0ZSBsYlJlc2l6aW5nID0gZmFsc2U7XG4gIHByaXZhdGUgbGJSZXNpemVTdGFydFggPSAwO1xuICBwcml2YXRlIGxiUmVzaXplU3RhcnRZID0gMDtcbiAgcHJpdmF0ZSBsYlJlc2l6ZVN0YXJ0VyA9IDA7XG4gIHByaXZhdGUgbGJSZXNpemVTdGFydEggPSAwO1xuICBwcml2YXRlIGJvdW5kTGJNb3ZlICAgICAgICA9IHRoaXMub25MYkRyYWdNb3ZlLmJpbmQodGhpcyk7XG4gIHByaXZhdGUgYm91bmRMYkVuZCAgICAgICAgID0gdGhpcy5vbkxiRHJhZ0VuZC5iaW5kKHRoaXMpO1xuICBwcml2YXRlIGJvdW5kTGJSZXNpemVNb3ZlICA9IHRoaXMub25MYlJlc2l6ZU1vdmUuYmluZCh0aGlzKTtcbiAgcHJpdmF0ZSBib3VuZExiUmVzaXplRW5kICAgPSB0aGlzLm9uTGJSZXNpemVFbmQuYmluZCh0aGlzKTtcblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHN0b3JlOiBNZXNzYWdpbmdTdG9yZVNlcnZpY2UpIHt9XG5cbiAgbmdPbkluaXQoKTogdm9pZCB7XG4gICAgdGhpcy5zaWRlID0gdGhpcy5zdG9yZS5nZXRTaWRlYmFyU2lkZSgpO1xuICAgIGNvbnN0IHNhdmVkID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ21lc3NhZ2luZ19zaWRlYmFyX3dpZHRoJyk7XG4gICAgaWYgKHNhdmVkKSB0aGlzLnNpZGViYXJXaWR0aCA9IHBhcnNlSW50KHNhdmVkLCAxMCkgfHwgdGhpcy5kZWZhdWx0V2lkdGg7XG5cbiAgICBjb25zdCBzYXZlZEZsb2F0ID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ21lc3NhZ2luZ19mbG9hdF9zdGF0ZScpO1xuICAgIGlmIChzYXZlZEZsb2F0KSB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBmID0gSlNPTi5wYXJzZShzYXZlZEZsb2F0KTtcbiAgICAgICAgdGhpcy5pc0Zsb2F0aW5nID0gZi5pc0Zsb2F0aW5nID8/IGZhbHNlO1xuICAgICAgICB0aGlzLmZsb2F0WCA9IGYueCA/PyA4MDtcbiAgICAgICAgdGhpcy5mbG9hdFkgPSBmLnkgPz8gODA7XG4gICAgICAgIHRoaXMuZmxvYXRXaWR0aCA9IGYudyA/PyAzODA7XG4gICAgICAgIHRoaXMuZmxvYXRIZWlnaHQgPSBmLmggPz8gNTQwO1xuICAgICAgfSBjYXRjaCB7fVxuICAgIH1cblxuICAgIHRoaXMuc3ViID0gY29tYmluZUxhdGVzdChbXG4gICAgICB0aGlzLnN0b3JlLnBhbmVsT3BlbixcbiAgICAgIHRoaXMuc3RvcmUuYWN0aXZlVmlldyxcbiAgICAgIHRoaXMuc3RvcmUud3NTdGF0dXMsXG4gICAgICB0aGlzLnN0b3JlLnNpZGViYXJTaWRlLFxuICAgIF0pLnN1YnNjcmliZSgoW29wZW4sIHZpZXcsIHdzLCBzaWRlXSkgPT4ge1xuICAgICAgdGhpcy5pc09wZW4gPSBvcGVuO1xuICAgICAgdGhpcy5hY3RpdmVWaWV3ID0gdmlldztcbiAgICAgIHRoaXMud3NTdGF0dXMgPSB3cztcbiAgICAgIHRoaXMuc2lkZSA9IHNpZGU7XG4gICAgfSk7XG4gIH1cblxuICBuZ09uRGVzdHJveSgpOiB2b2lkIHtcbiAgICB0aGlzLnN1Yj8udW5zdWJzY3JpYmUoKTtcbiAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCB0aGlzLmJvdW5kUmVzaXplTW92ZSk7XG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIHRoaXMuYm91bmRSZXNpemVFbmQpO1xuICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIHRoaXMuYm91bmRGbG9hdE1vdmUpO1xuICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCB0aGlzLmJvdW5kRmxvYXRFbmQpO1xuICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIHRoaXMuYm91bmRGbG9hdFJlc2l6ZU1vdmUpO1xuICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCB0aGlzLmJvdW5kRmxvYXRSZXNpemVFbmQpO1xuICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIHRoaXMuYm91bmRMYk1vdmUpO1xuICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCB0aGlzLmJvdW5kTGJFbmQpO1xuICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIHRoaXMuYm91bmRMYlJlc2l6ZU1vdmUpO1xuICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCB0aGlzLmJvdW5kTGJSZXNpemVFbmQpO1xuICB9XG5cbiAgLy8g4pSA4pSAIExpZ2h0Ym94IOKUgOKUgFxuICBvcGVuTGlnaHRib3godXJsOiBzdHJpbmcpOiB2b2lkIHtcbiAgICB0aGlzLmxpZ2h0Ym94VXJsID0gdXJsO1xuICAgIHRoaXMubGlnaHRib3hEZXRhY2hlZCA9IGZhbHNlO1xuICB9XG5cbiAgb25MaWdodGJveEJhY2tkcm9wQ2xpY2soZXZlbnQ6IE1vdXNlRXZlbnQpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5saWdodGJveERldGFjaGVkKSByZXR1cm47XG4gICAgaWYgKGV2ZW50LnRhcmdldCAhPT0gZXZlbnQuY3VycmVudFRhcmdldCkgcmV0dXJuO1xuICAgIHRoaXMubGlnaHRib3hVcmwgPSBudWxsO1xuICB9XG5cbiAgZGV0YWNoTGlnaHRib3goKTogdm9pZCB7XG4gICAgdGhpcy5saWdodGJveERldGFjaGVkID0gdHJ1ZTtcbiAgICB0aGlzLmxpZ2h0Ym94WCA9IE1hdGgubWF4KDIwLCBNYXRoLnJvdW5kKCh3aW5kb3cuaW5uZXJXaWR0aCAgLSB0aGlzLmxpZ2h0Ym94VykgLyAyKSk7XG4gICAgdGhpcy5saWdodGJveFkgPSBNYXRoLm1heCgyMCwgTWF0aC5yb3VuZCgod2luZG93LmlubmVySGVpZ2h0IC0gdGhpcy5saWdodGJveEgpIC8gMikpO1xuICB9XG5cbiAgb25MYkRyYWdTdGFydChldmVudDogTW91c2VFdmVudCk6IHZvaWQge1xuICAgIGlmICgoZXZlbnQudGFyZ2V0IGFzIEhUTUxFbGVtZW50KS5jbG9zZXN0KCdidXR0b24nKSkgcmV0dXJuO1xuICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgdGhpcy5sYkRyYWdnaW5nID0gdHJ1ZTtcbiAgICB0aGlzLmxiRHJhZ09mZlggPSBldmVudC5jbGllbnRYIC0gdGhpcy5saWdodGJveFg7XG4gICAgdGhpcy5sYkRyYWdPZmZZID0gZXZlbnQuY2xpZW50WSAtIHRoaXMubGlnaHRib3hZO1xuICAgIGRvY3VtZW50LmJvZHkuc3R5bGUudXNlclNlbGVjdCA9ICdub25lJztcbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCB0aGlzLmJvdW5kTGJNb3ZlKTtcbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgICB0aGlzLmJvdW5kTGJFbmQpO1xuICB9XG5cbiAgcHJpdmF0ZSBvbkxiRHJhZ01vdmUoZXZlbnQ6IE1vdXNlRXZlbnQpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMubGJEcmFnZ2luZykgcmV0dXJuO1xuICAgIHRoaXMubGlnaHRib3hYID0gTWF0aC5tYXgoMCwgTWF0aC5taW4oZXZlbnQuY2xpZW50WCAtIHRoaXMubGJEcmFnT2ZmWCwgd2luZG93LmlubmVyV2lkdGggIC0gdGhpcy5saWdodGJveFcpKTtcbiAgICB0aGlzLmxpZ2h0Ym94WSA9IE1hdGgubWF4KDAsIE1hdGgubWluKGV2ZW50LmNsaWVudFkgLSB0aGlzLmxiRHJhZ09mZlksIHdpbmRvdy5pbm5lckhlaWdodCAtIDYwKSk7XG4gIH1cblxuICBwcml2YXRlIG9uTGJEcmFnRW5kKCk6IHZvaWQge1xuICAgIGlmICghdGhpcy5sYkRyYWdnaW5nKSByZXR1cm47XG4gICAgdGhpcy5sYkRyYWdnaW5nID0gZmFsc2U7XG4gICAgZG9jdW1lbnQuYm9keS5zdHlsZS51c2VyU2VsZWN0ID0gJyc7XG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgdGhpcy5ib3VuZExiTW92ZSk7XG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsICAgdGhpcy5ib3VuZExiRW5kKTtcbiAgfVxuXG4gIG9uTGJSZXNpemVTdGFydChldmVudDogTW91c2VFdmVudCk6IHZvaWQge1xuICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgdGhpcy5sYlJlc2l6aW5nID0gdHJ1ZTtcbiAgICB0aGlzLmxiUmVzaXplU3RhcnRYID0gZXZlbnQuY2xpZW50WDtcbiAgICB0aGlzLmxiUmVzaXplU3RhcnRZID0gZXZlbnQuY2xpZW50WTtcbiAgICB0aGlzLmxiUmVzaXplU3RhcnRXID0gdGhpcy5saWdodGJveFc7XG4gICAgdGhpcy5sYlJlc2l6ZVN0YXJ0SCA9IHRoaXMubGlnaHRib3hIO1xuICAgIGRvY3VtZW50LmJvZHkuc3R5bGUuY3Vyc29yID0gJ3NlLXJlc2l6ZSc7XG4gICAgZG9jdW1lbnQuYm9keS5zdHlsZS51c2VyU2VsZWN0ID0gJ25vbmUnO1xuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIHRoaXMuYm91bmRMYlJlc2l6ZU1vdmUpO1xuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCAgIHRoaXMuYm91bmRMYlJlc2l6ZUVuZCk7XG4gIH1cblxuICBwcml2YXRlIG9uTGJSZXNpemVNb3ZlKGV2ZW50OiBNb3VzZUV2ZW50KTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLmxiUmVzaXppbmcpIHJldHVybjtcbiAgICB0aGlzLmxpZ2h0Ym94VyA9IE1hdGgubWF4KDI0MCwgdGhpcy5sYlJlc2l6ZVN0YXJ0VyArIChldmVudC5jbGllbnRYIC0gdGhpcy5sYlJlc2l6ZVN0YXJ0WCkpO1xuICAgIHRoaXMubGlnaHRib3hIID0gTWF0aC5tYXgoMjAwLCB0aGlzLmxiUmVzaXplU3RhcnRIICsgKGV2ZW50LmNsaWVudFkgLSB0aGlzLmxiUmVzaXplU3RhcnRZKSk7XG4gIH1cblxuICBwcml2YXRlIG9uTGJSZXNpemVFbmQoKTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLmxiUmVzaXppbmcpIHJldHVybjtcbiAgICB0aGlzLmxiUmVzaXppbmcgPSBmYWxzZTtcbiAgICBkb2N1bWVudC5ib2R5LnN0eWxlLmN1cnNvciA9ICcnO1xuICAgIGRvY3VtZW50LmJvZHkuc3R5bGUudXNlclNlbGVjdCA9ICcnO1xuICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIHRoaXMuYm91bmRMYlJlc2l6ZU1vdmUpO1xuICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCAgIHRoaXMuYm91bmRMYlJlc2l6ZUVuZCk7XG4gIH1cblxuICB0b2dnbGVTaWRlKCk6IHZvaWQge1xuICAgIHRoaXMuc3RvcmUudG9nZ2xlU2lkZWJhclNpZGUoKTtcbiAgfVxuXG4gIG9wZW5OZXdDb252ZXJzYXRpb24oKTogdm9pZCB7XG4gICAgdGhpcy5zdG9yZS5zZXRWaWV3KCduZXctY29udmVyc2F0aW9uJyk7XG4gIH1cblxuICBvcGVuR3JvdXBNYW5hZ2VyKCk6IHZvaWQge1xuICAgIHRoaXMuc3RvcmUuc2V0VmlldygnZ3JvdXAtbWFuYWdlcicpO1xuICB9XG5cbiAgZ2V0U3RhdHVzVG9vbHRpcCgpOiBzdHJpbmcge1xuICAgIGlmICh0aGlzLndzU3RhdHVzID09PSAnYXV0aGVudGljYXRlZCcpIHJldHVybiAnQ29ubmVjdGVkJztcbiAgICBpZiAodGhpcy53c1N0YXR1cyA9PT0gJ2Nvbm5lY3RpbmcnKSByZXR1cm4gJ0Nvbm5lY3RpbmcnO1xuICAgIHJldHVybiAnRGlzY29ubmVjdGVkJztcbiAgfVxuXG4gIGNsb3NlKCk6IHZvaWQge1xuICAgIHRoaXMuc3RvcmUuY2xvc2VQYW5lbCgpO1xuICB9XG5cbiAgdG9nZ2xlRmxvYXQoKTogdm9pZCB7XG4gICAgdGhpcy5pc0Zsb2F0aW5nID0gIXRoaXMuaXNGbG9hdGluZztcbiAgICBpZiAodGhpcy5pc0Zsb2F0aW5nKSB7XG4gICAgICAvLyBDZW50cmUgdGhlIGZsb2F0IHdpbmRvdyBvbiBzY3JlZW4gd2hlbiBmaXJzdCBwb3BwaW5nIG91dFxuICAgICAgdGhpcy5mbG9hdFggPSBNYXRoLm1heCgyMCwgTWF0aC5yb3VuZCgod2luZG93LmlubmVyV2lkdGggIC0gdGhpcy5mbG9hdFdpZHRoKSAgLyAyKSk7XG4gICAgICB0aGlzLmZsb2F0WSA9IE1hdGgubWF4KDIwLCBNYXRoLnJvdW5kKCh3aW5kb3cuaW5uZXJIZWlnaHQgLSB0aGlzLmZsb2F0SGVpZ2h0KSAvIDIpKTtcbiAgICB9XG4gICAgdGhpcy5zYXZlRmxvYXRTdGF0ZSgpO1xuICB9XG5cbiAgLy8g4pSA4pSAIFNpZGViYXIgcmVzaXplIOKUgOKUgFxuICBvblJlc2l6ZVN0YXJ0KGV2ZW50OiBNb3VzZUV2ZW50KTogdm9pZCB7XG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICB0aGlzLnJlc2l6aW5nID0gdHJ1ZTtcbiAgICB0aGlzLnJlc2l6ZVN0YXJ0WCA9IGV2ZW50LmNsaWVudFg7XG4gICAgdGhpcy5yZXNpemVTdGFydFdpZHRoID0gdGhpcy5zaWRlYmFyV2lkdGg7XG4gICAgZG9jdW1lbnQuYm9keS5zdHlsZS5jdXJzb3IgPSAnZXctcmVzaXplJztcbiAgICBkb2N1bWVudC5ib2R5LnN0eWxlLnVzZXJTZWxlY3QgPSAnbm9uZSc7XG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgdGhpcy5ib3VuZFJlc2l6ZU1vdmUpO1xuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCB0aGlzLmJvdW5kUmVzaXplRW5kKTtcbiAgfVxuXG4gIHByaXZhdGUgb25SZXNpemVNb3ZlKGV2ZW50OiBNb3VzZUV2ZW50KTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLnJlc2l6aW5nKSByZXR1cm47XG4gICAgY29uc3QgZHggPSBldmVudC5jbGllbnRYIC0gdGhpcy5yZXNpemVTdGFydFg7XG4gICAgaWYgKHRoaXMuc2lkZSA9PT0gJ3JpZ2h0Jykge1xuICAgICAgdGhpcy5zaWRlYmFyV2lkdGggPSBNYXRoLm1heCgyMDAsIHRoaXMucmVzaXplU3RhcnRXaWR0aCAtIGR4KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5zaWRlYmFyV2lkdGggPSBNYXRoLm1heCgyMDAsIHRoaXMucmVzaXplU3RhcnRXaWR0aCArIGR4KTtcbiAgICB9XG4gICAgdGhpcy5zaWRlYmFyV2lkdGggPSBNYXRoLm1pbih0aGlzLnNpZGViYXJXaWR0aCwgd2luZG93LmlubmVyV2lkdGggKiAwLjkpO1xuICB9XG5cbiAgcHJpdmF0ZSBvblJlc2l6ZUVuZCgpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMucmVzaXppbmcpIHJldHVybjtcbiAgICB0aGlzLnJlc2l6aW5nID0gZmFsc2U7XG4gICAgZG9jdW1lbnQuYm9keS5zdHlsZS5jdXJzb3IgPSAnJztcbiAgICBkb2N1bWVudC5ib2R5LnN0eWxlLnVzZXJTZWxlY3QgPSAnJztcbiAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCB0aGlzLmJvdW5kUmVzaXplTW92ZSk7XG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIHRoaXMuYm91bmRSZXNpemVFbmQpO1xuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdtZXNzYWdpbmdfc2lkZWJhcl93aWR0aCcsIFN0cmluZyh0aGlzLnNpZGViYXJXaWR0aCkpO1xuICB9XG5cbiAgLy8g4pSA4pSAIEZsb2F0aW5nIHBhbmVsIGRyYWcg4pSA4pSAXG4gIG9uRmxvYXREcmFnU3RhcnQoZXZlbnQ6IE1vdXNlRXZlbnQpOiB2b2lkIHtcbiAgICAvLyBJZ25vcmUgaWYgY29taW5nIGZyb20gYSBidXR0b24gaW5zaWRlIHRoZSBoZWFkZXJcbiAgICBpZiAoKGV2ZW50LnRhcmdldCBhcyBIVE1MRWxlbWVudCkuY2xvc2VzdCgnYnV0dG9uJykpIHJldHVybjtcbiAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIHRoaXMuZmxvYXREcmFnZ2luZyA9IHRydWU7XG4gICAgdGhpcy5mbG9hdERyYWdPZmZYID0gZXZlbnQuY2xpZW50WCAtIHRoaXMuZmxvYXRYO1xuICAgIHRoaXMuZmxvYXREcmFnT2ZmWSA9IGV2ZW50LmNsaWVudFkgLSB0aGlzLmZsb2F0WTtcbiAgICBkb2N1bWVudC5ib2R5LnN0eWxlLnVzZXJTZWxlY3QgPSAnbm9uZSc7XG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgdGhpcy5ib3VuZEZsb2F0TW92ZSk7XG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIHRoaXMuYm91bmRGbG9hdEVuZCk7XG4gIH1cblxuICBwcml2YXRlIG9uRmxvYXREcmFnTW92ZShldmVudDogTW91c2VFdmVudCk6IHZvaWQge1xuICAgIGlmICghdGhpcy5mbG9hdERyYWdnaW5nKSByZXR1cm47XG4gICAgdGhpcy5mbG9hdFggPSBNYXRoLm1heCgwLCBNYXRoLm1pbihldmVudC5jbGllbnRYIC0gdGhpcy5mbG9hdERyYWdPZmZYLCB3aW5kb3cuaW5uZXJXaWR0aCAgLSB0aGlzLmZsb2F0V2lkdGgpKTtcbiAgICB0aGlzLmZsb2F0WSA9IE1hdGgubWF4KDAsIE1hdGgubWluKGV2ZW50LmNsaWVudFkgLSB0aGlzLmZsb2F0RHJhZ09mZlksIHdpbmRvdy5pbm5lckhlaWdodCAtIDYwKSk7XG4gIH1cblxuICBwcml2YXRlIG9uRmxvYXREcmFnRW5kKCk6IHZvaWQge1xuICAgIGlmICghdGhpcy5mbG9hdERyYWdnaW5nKSByZXR1cm47XG4gICAgdGhpcy5mbG9hdERyYWdnaW5nID0gZmFsc2U7XG4gICAgZG9jdW1lbnQuYm9keS5zdHlsZS51c2VyU2VsZWN0ID0gJyc7XG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgdGhpcy5ib3VuZEZsb2F0TW92ZSk7XG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIHRoaXMuYm91bmRGbG9hdEVuZCk7XG4gICAgdGhpcy5zYXZlRmxvYXRTdGF0ZSgpO1xuICB9XG5cbiAgLy8g4pSA4pSAIEZsb2F0aW5nIHBhbmVsIHJlc2l6ZSAoU0UgY29ybmVyKSDilIDilIBcbiAgb25GbG9hdFJlc2l6ZVN0YXJ0KGV2ZW50OiBNb3VzZUV2ZW50KTogdm9pZCB7XG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICB0aGlzLmZsb2F0UmVzaXppbmcgPSB0cnVlO1xuICAgIHRoaXMuZmxvYXRSZXNpemVTdGFydFggPSBldmVudC5jbGllbnRYO1xuICAgIHRoaXMuZmxvYXRSZXNpemVTdGFydFkgPSBldmVudC5jbGllbnRZO1xuICAgIHRoaXMuZmxvYXRSZXNpemVTdGFydFcgPSB0aGlzLmZsb2F0V2lkdGg7XG4gICAgdGhpcy5mbG9hdFJlc2l6ZVN0YXJ0SCA9IHRoaXMuZmxvYXRIZWlnaHQ7XG4gICAgZG9jdW1lbnQuYm9keS5zdHlsZS5jdXJzb3IgPSAnc2UtcmVzaXplJztcbiAgICBkb2N1bWVudC5ib2R5LnN0eWxlLnVzZXJTZWxlY3QgPSAnbm9uZSc7XG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgdGhpcy5ib3VuZEZsb2F0UmVzaXplTW92ZSk7XG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIHRoaXMuYm91bmRGbG9hdFJlc2l6ZUVuZCk7XG4gIH1cblxuICBwcml2YXRlIG9uRmxvYXRSZXNpemVNb3ZlKGV2ZW50OiBNb3VzZUV2ZW50KTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLmZsb2F0UmVzaXppbmcpIHJldHVybjtcbiAgICB0aGlzLmZsb2F0V2lkdGggID0gTWF0aC5tYXgoMjgwLCB0aGlzLmZsb2F0UmVzaXplU3RhcnRXICsgKGV2ZW50LmNsaWVudFggLSB0aGlzLmZsb2F0UmVzaXplU3RhcnRYKSk7XG4gICAgdGhpcy5mbG9hdEhlaWdodCA9IE1hdGgubWF4KDMyMCwgdGhpcy5mbG9hdFJlc2l6ZVN0YXJ0SCArIChldmVudC5jbGllbnRZIC0gdGhpcy5mbG9hdFJlc2l6ZVN0YXJ0WSkpO1xuICB9XG5cbiAgcHJpdmF0ZSBvbkZsb2F0UmVzaXplRW5kKCk6IHZvaWQge1xuICAgIGlmICghdGhpcy5mbG9hdFJlc2l6aW5nKSByZXR1cm47XG4gICAgdGhpcy5mbG9hdFJlc2l6aW5nID0gZmFsc2U7XG4gICAgZG9jdW1lbnQuYm9keS5zdHlsZS5jdXJzb3IgPSAnJztcbiAgICBkb2N1bWVudC5ib2R5LnN0eWxlLnVzZXJTZWxlY3QgPSAnJztcbiAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCB0aGlzLmJvdW5kRmxvYXRSZXNpemVNb3ZlKTtcbiAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgdGhpcy5ib3VuZEZsb2F0UmVzaXplRW5kKTtcbiAgICB0aGlzLnNhdmVGbG9hdFN0YXRlKCk7XG4gIH1cblxuICBwcml2YXRlIHNhdmVGbG9hdFN0YXRlKCk6IHZvaWQge1xuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdtZXNzYWdpbmdfZmxvYXRfc3RhdGUnLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpc0Zsb2F0aW5nOiB0aGlzLmlzRmxvYXRpbmcsXG4gICAgICB4OiB0aGlzLmZsb2F0WCxcbiAgICAgIHk6IHRoaXMuZmxvYXRZLFxuICAgICAgdzogdGhpcy5mbG9hdFdpZHRoLFxuICAgICAgaDogdGhpcy5mbG9hdEhlaWdodCxcbiAgICB9KSk7XG4gIH1cbn1cbiJdfQ==