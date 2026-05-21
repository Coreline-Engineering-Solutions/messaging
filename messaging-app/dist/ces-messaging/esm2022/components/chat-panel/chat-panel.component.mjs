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
  `, isInline: true, styles: [".sidebar{position:fixed;top:0;bottom:0;width:400px;background:#041322;z-index:9999;display:flex;flex-direction:column;box-shadow:0 0 40px #0009;transition:transform .3s cubic-bezier(.4,0,.2,1)}.sidebar.side-right{right:0;transform:translate(100%)}.sidebar.side-left{left:0;transform:translate(-100%)}.sidebar.open.side-right,.sidebar.open.side-left{transform:translate(0)}.resize-handle{position:absolute;top:0;bottom:0;width:5px;cursor:ew-resize;z-index:1;transition:background .15s}.resize-handle:hover,.resize-handle:active{background:#ffffff26}.resize-handle.handle-left{left:0}.resize-handle.handle-right{right:0}.sidebar-header{display:flex;align-items:center;justify-content:space-between;padding:8px 10px 8px 14px;border-bottom:1px solid rgba(255,255,255,.15);flex-shrink:0;position:relative;z-index:2;min-height:48px}.header-left{display:flex;align-items:center;gap:8px;min-width:0}.header-title{font-size:16px;font-weight:700;color:#fff;letter-spacing:.3px;white-space:nowrap}.header-actions{display:flex;align-items:center;gap:0}.btn-spacer{width:12px}.hdr-btn{width:32px;height:32px;min-width:32px;padding:0;display:inline-flex;align-items:center;justify-content:center;border-radius:6px!important;transition:background .15s,box-shadow .15s;--mdc-icon-button-state-layer-size: 32px}.hdr-btn .mat-mdc-button-touch-target{width:32px;height:32px}.hdr-btn:hover{background:#ffffff26!important;box-shadow:0 2px 8px #0003}.hdr-btn mat-icon{font-size:20px;color:#ffffffd9}.sidebar-content{flex:1;overflow:hidden}.status-dot{width:8px;height:8px;border-radius:50%;background:#fff6;flex-shrink:0}.status-dot.connected{background:#22c55e;box-shadow:0 0 0 3px #22c55e2e}.status-dot.connecting{background:#f59e0b;animation:blink 1s infinite}.status-dot.disconnected{background:#ef4444;box-shadow:0 0 0 3px #ef444424}@keyframes blink{50%{opacity:.3}}.sidebar.floating{position:fixed!important;right:unset!important;left:80px;top:80px;transform:none!important;border-radius:12px;overflow:hidden;resize:none;min-width:280px;min-height:320px}.sidebar.floating:not(.open){display:none}.drag-handle{cursor:grab;-webkit-user-select:none;user-select:none}.drag-handle:active{cursor:grabbing}.float-resize-corner{position:absolute;bottom:0;right:0;width:16px;height:16px;cursor:se-resize;background:linear-gradient(135deg,transparent 50%,rgba(255,255,255,.25) 50%);border-bottom-right-radius:12px}@media (max-width: 480px){.sidebar{width:100%!important}.resize-handle{display:none}}.lb-overlay{position:fixed;inset:0;background:#000000e0;display:flex;align-items:center;justify-content:center;z-index:99999;cursor:pointer}.lb-overlay.lb-detached{inset:unset;background:#0c1f35;border:1px solid rgba(255,255,255,.18);border-radius:12px;box-shadow:0 12px 48px #000000b3;display:flex;flex-direction:column;overflow:hidden;cursor:default;min-width:240px;min-height:200px}.lb-drag-bar{display:flex;align-items:center;justify-content:space-between;padding:6px 8px 6px 12px;background:#041322;border-bottom:1px solid rgba(255,255,255,.12);cursor:grab;flex-shrink:0;-webkit-user-select:none;user-select:none}.lb-drag-bar:active{cursor:grabbing}.lb-drag-title{font-size:12px;color:#fff9;letter-spacing:.4px}.lb-drag-actions{display:flex;gap:2px}.lb-action-btn{background:transparent;border:none;border-radius:6px;width:28px;height:28px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#ffffffb3;transition:background .15s}.lb-action-btn:hover{background:#ffffff26}.lb-action-btn mat-icon{font-size:16px;width:16px;height:16px}.lb-img{max-width:92vw;max-height:92vh;border-radius:8px;box-shadow:0 8px 40px #0009;cursor:default}.lb-img.lb-img-detached{max-width:100%;max-height:100%;border-radius:0;box-shadow:none;object-fit:contain;flex:1}.lb-close{position:absolute;top:16px;right:16px;background:#ffffff26;border:none;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#fff;transition:background .15s}.lb-close:hover{background:#ffffff4d}.lb-detach-btn{position:absolute;top:16px;right:60px;background:#ffffff26;border:none;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#fff;transition:background .15s}.lb-detach-btn:hover{background:#ffffff4d}.lb-resize-corner{position:absolute;bottom:0;right:0;width:16px;height:16px;cursor:se-resize;background:linear-gradient(135deg,transparent 50%,rgba(255,255,255,.2) 50%);border-bottom-right-radius:12px}\n"], dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i2.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "ngmodule", type: MatIconModule }, { kind: "component", type: i3.MatIcon, selector: "mat-icon", inputs: ["color", "inline", "svgIcon", "fontSet", "fontIcon"], exportAs: ["matIcon"] }, { kind: "ngmodule", type: MatButtonModule }, { kind: "component", type: i4.MatIconButton, selector: "button[mat-icon-button]", exportAs: ["matButton"] }, { kind: "ngmodule", type: MatTooltipModule }, { kind: "directive", type: i5.MatTooltip, selector: "[matTooltip]", inputs: ["matTooltipPosition", "matTooltipPositionAtOrigin", "matTooltipDisabled", "matTooltipShowDelay", "matTooltipHideDelay", "matTooltipTouchGestures", "matTooltip", "matTooltipClass"], exportAs: ["matTooltip"] }, { kind: "component", type: InboxListComponent, selector: "app-inbox-list" }, { kind: "component", type: ChatThreadComponent, selector: "app-chat-thread", outputs: ["lightboxOpen"] }, { kind: "component", type: NewConversationComponent, selector: "app-new-conversation" }, { kind: "component", type: GroupManagerComponent, selector: "app-group-manager" }] });
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
  `, styles: [".sidebar{position:fixed;top:0;bottom:0;width:400px;background:#041322;z-index:9999;display:flex;flex-direction:column;box-shadow:0 0 40px #0009;transition:transform .3s cubic-bezier(.4,0,.2,1)}.sidebar.side-right{right:0;transform:translate(100%)}.sidebar.side-left{left:0;transform:translate(-100%)}.sidebar.open.side-right,.sidebar.open.side-left{transform:translate(0)}.resize-handle{position:absolute;top:0;bottom:0;width:5px;cursor:ew-resize;z-index:1;transition:background .15s}.resize-handle:hover,.resize-handle:active{background:#ffffff26}.resize-handle.handle-left{left:0}.resize-handle.handle-right{right:0}.sidebar-header{display:flex;align-items:center;justify-content:space-between;padding:8px 10px 8px 14px;border-bottom:1px solid rgba(255,255,255,.15);flex-shrink:0;position:relative;z-index:2;min-height:48px}.header-left{display:flex;align-items:center;gap:8px;min-width:0}.header-title{font-size:16px;font-weight:700;color:#fff;letter-spacing:.3px;white-space:nowrap}.header-actions{display:flex;align-items:center;gap:0}.btn-spacer{width:12px}.hdr-btn{width:32px;height:32px;min-width:32px;padding:0;display:inline-flex;align-items:center;justify-content:center;border-radius:6px!important;transition:background .15s,box-shadow .15s;--mdc-icon-button-state-layer-size: 32px}.hdr-btn .mat-mdc-button-touch-target{width:32px;height:32px}.hdr-btn:hover{background:#ffffff26!important;box-shadow:0 2px 8px #0003}.hdr-btn mat-icon{font-size:20px;color:#ffffffd9}.sidebar-content{flex:1;overflow:hidden}.status-dot{width:8px;height:8px;border-radius:50%;background:#fff6;flex-shrink:0}.status-dot.connected{background:#22c55e;box-shadow:0 0 0 3px #22c55e2e}.status-dot.connecting{background:#f59e0b;animation:blink 1s infinite}.status-dot.disconnected{background:#ef4444;box-shadow:0 0 0 3px #ef444424}@keyframes blink{50%{opacity:.3}}.sidebar.floating{position:fixed!important;right:unset!important;left:80px;top:80px;transform:none!important;border-radius:12px;overflow:hidden;resize:none;min-width:280px;min-height:320px}.sidebar.floating:not(.open){display:none}.drag-handle{cursor:grab;-webkit-user-select:none;user-select:none}.drag-handle:active{cursor:grabbing}.float-resize-corner{position:absolute;bottom:0;right:0;width:16px;height:16px;cursor:se-resize;background:linear-gradient(135deg,transparent 50%,rgba(255,255,255,.25) 50%);border-bottom-right-radius:12px}@media (max-width: 480px){.sidebar{width:100%!important}.resize-handle{display:none}}.lb-overlay{position:fixed;inset:0;background:#000000e0;display:flex;align-items:center;justify-content:center;z-index:99999;cursor:pointer}.lb-overlay.lb-detached{inset:unset;background:#0c1f35;border:1px solid rgba(255,255,255,.18);border-radius:12px;box-shadow:0 12px 48px #000000b3;display:flex;flex-direction:column;overflow:hidden;cursor:default;min-width:240px;min-height:200px}.lb-drag-bar{display:flex;align-items:center;justify-content:space-between;padding:6px 8px 6px 12px;background:#041322;border-bottom:1px solid rgba(255,255,255,.12);cursor:grab;flex-shrink:0;-webkit-user-select:none;user-select:none}.lb-drag-bar:active{cursor:grabbing}.lb-drag-title{font-size:12px;color:#fff9;letter-spacing:.4px}.lb-drag-actions{display:flex;gap:2px}.lb-action-btn{background:transparent;border:none;border-radius:6px;width:28px;height:28px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#ffffffb3;transition:background .15s}.lb-action-btn:hover{background:#ffffff26}.lb-action-btn mat-icon{font-size:16px;width:16px;height:16px}.lb-img{max-width:92vw;max-height:92vh;border-radius:8px;box-shadow:0 8px 40px #0009;cursor:default}.lb-img.lb-img-detached{max-width:100%;max-height:100%;border-radius:0;box-shadow:none;object-fit:contain;flex:1}.lb-close{position:absolute;top:16px;right:16px;background:#ffffff26;border:none;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#fff;transition:background .15s}.lb-close:hover{background:#ffffff4d}.lb-detach-btn{position:absolute;top:16px;right:60px;background:#ffffff26;border:none;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#fff;transition:background .15s}.lb-detach-btn:hover{background:#ffffff4d}.lb-resize-corner{position:absolute;bottom:0;right:0;width:16px;height:16px;cursor:se-resize;background:linear-gradient(135deg,transparent 50%,rgba(255,255,255,.2) 50%);border-bottom-right-radius:12px}\n"] }]
        }], ctorParameters: () => [{ type: i1.MessagingStoreService }] });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdC1wYW5lbC5jb21wb25lbnQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvbGliL2NvbXBvbmVudHMvY2hhdC1wYW5lbC9jaGF0LXBhbmVsLmNvbXBvbmVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsU0FBUyxFQUFxQixNQUFNLGVBQWUsQ0FBQztBQUM3RCxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDL0MsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLHdCQUF3QixDQUFDO0FBQ3ZELE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUMzRCxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSwyQkFBMkIsQ0FBQztBQUM3RCxPQUFPLEVBQWdCLGFBQWEsRUFBRSxNQUFNLE1BQU0sQ0FBQztBQUduRCxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUN4RSxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUMzRSxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUMxRixPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQzs7Ozs7OztBQW1iakYsTUFBTSxPQUFPLGtCQUFrQjtJQTJEVDtJQTFEcEIsTUFBTSxHQUFHLEtBQUssQ0FBQztJQUNmLFVBQVUsR0FBc0YsT0FBTyxDQUFDO0lBQ3hHLFFBQVEsR0FBVyxjQUFjLENBQUM7SUFDbEMsSUFBSSxHQUFnQixPQUFPLENBQUM7SUFDNUIsWUFBWSxHQUFHLEdBQUcsQ0FBQztJQUVuQiw4QkFBOEI7SUFDOUIsVUFBVSxHQUFHLEtBQUssQ0FBQztJQUNuQixNQUFNLEdBQUcsRUFBRSxDQUFDO0lBQ1osTUFBTSxHQUFHLEVBQUUsQ0FBQztJQUNaLFVBQVUsR0FBRyxHQUFHLENBQUM7SUFDakIsV0FBVyxH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QixjQUNkLElBQUksV0FDUDt3QkFDUCxZQUFZLEVBQUUsYUFBYSxFQUFFLGVBQWUsRUFBRSxnQkFBZ0I7d0JBQzlELGtCQUFrQixFQUFFLG1CQUFtQjt3QkFDdkMsd0JBQXdCLEVBQUUscUJBQXFCO3FCQUNoRCxZQUNTOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQWdJVCIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IENvbXBvbmVudCwgT25Jbml0LCBPbkRlc3Ryb3kgfSBmcm9tICdAYW5ndWxhci9jb3JlJztcbmltcG9ydCB7IENvbW1vbk1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL2NvbW1vbic7XG5pbXBvcnQgeyBNYXRJY29uTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvbWF0ZXJpYWwvaWNvbic7XG5pbXBvcnQgeyBNYXRCdXR0b25Nb2R1bGUgfSBmcm9tICdAYW5ndWxhci9tYXRlcmlhbC9idXR0b24nO1xuaW1wb3J0IHsgTWF0VG9vbHRpcE1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL21hdGVyaWFsL3Rvb2x0aXAnO1xuaW1wb3J0IHsgU3Vic2NyaXB0aW9uLCBjb21iaW5lTGF0ZXN0IH0gZnJvbSAncnhqcyc7XG5pbXBvcnQgeyBNZXNzYWdpbmdTdG9yZVNlcnZpY2UgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9tZXNzYWdpbmctc3RvcmUuc2VydmljZSc7XG5pbXBvcnQgeyBTaWRlYmFyU2lkZSB9IGZyb20gJy4uLy4uL21vZGVscy9tZXNzYWdpbmcubW9kZWxzJztcbmltcG9ydCB7IEluYm94TGlzdENvbXBvbmVudCB9IGZyb20gJy4uL2luYm94LWxpc3QvaW5ib3gtbGlzdC5jb21wb25lbnQnO1xuaW1wb3J0IHsgQ2hhdFRocmVhZENvbXBvbmVudCB9IGZyb20gJy4uL2NoYXQtdGhyZWFkL2NoYXQtdGhyZWFkLmNvbXBvbmVudCc7XG5pbXBvcnQgeyBOZXdDb252ZXJzYXRpb25Db21wb25lbnQgfSBmcm9tICcuLi9uZXctY29udmVyc2F0aW9uL25ldy1jb252ZXJzYXRpb24uY29tcG9uZW50JztcbmltcG9ydCB7IEdyb3VwTWFuYWdlckNvbXBvbmVudCB9IGZyb20gJy4uL2dyb3VwLW1hbmFnZXIvZ3JvdXAtbWFuYWdlci5jb21wb25lbnQnO1xuXG5AQ29tcG9uZW50KHtcbiAgc2VsZWN0b3I6ICdhcHAtY2hhdC1wYW5lbCcsXG4gIHN0YW5kYWxvbmU6IHRydWUsXG4gIGltcG9ydHM6IFtcbiAgICBDb21tb25Nb2R1bGUsIE1hdEljb25Nb2R1bGUsIE1hdEJ1dHRvbk1vZHVsZSwgTWF0VG9vbHRpcE1vZHVsZSxcbiAgICBJbmJveExpc3RDb21wb25lbnQsIENoYXRUaHJlYWRDb21wb25lbnQsXG4gICAgTmV3Q29udmVyc2F0aW9uQ29tcG9uZW50LCBHcm91cE1hbmFnZXJDb21wb25lbnQsXG4gIF0sXG4gIHRlbXBsYXRlOiBgXG4gICAgPCEtLSBTaWRlYmFyIC8gRmxvYXRpbmcgcGFuZWwgLS0+XG4gICAgPGRpdlxuICAgICAgY2xhc3M9XCJzaWRlYmFyXCJcbiAgICAgIFtjbGFzcy5vcGVuXT1cImlzT3BlblwiXG4gICAgICBbY2xhc3Muc2lkZS1sZWZ0XT1cIiFpc0Zsb2F0aW5nICYmIHNpZGUgPT09ICdsZWZ0J1wiXG4gICAgICBbY2xhc3Muc2lkZS1yaWdodF09XCIhaXNGbG9hdGluZyAmJiBzaWRlID09PSAncmlnaHQnXCJcbiAgICAgIFtjbGFzcy5mbG9hdGluZ109XCJpc0Zsb2F0aW5nXCJcbiAgICAgIFtzdHlsZS53aWR0aC5weF09XCJpc0Zsb2F0aW5nID8gZmxvYXRXaWR0aCA6IHNpZGViYXJXaWR0aFwiXG4gICAgICBbc3R5bGUuaGVpZ2h0LnB4XT1cImlzRmxvYXRpbmcgPyBmbG9hdEhlaWdodCA6IG51bGxcIlxuICAgICAgW3N0eWxlLmxlZnQucHhdPVwiaXNGbG9hdGluZyA/IGZsb2F0WCA6IG51bGxcIlxuICAgICAgW3N0eWxlLnRvcC5weF09XCJpc0Zsb2F0aW5nID8gZmxvYXRZIDogbnVsbFwiXG4gICAgPlxuICAgICAgPCEtLSBSZXNpemUgaGFuZGxlIChzaWRlYmFyIG1vZGUgb25seSkgLS0+XG4gICAgICA8ZGl2XG4gICAgICAgICpuZ0lmPVwiIWlzRmxvYXRpbmdcIlxuICAgICAgICBjbGFzcz1cInJlc2l6ZS1oYW5kbGVcIlxuICAgICAgICBbY2xhc3MuaGFuZGxlLWxlZnRdPVwic2lkZSA9PT0gJ3JpZ2h0J1wiXG4gICAgICAgIFtjbGFzcy5oYW5kbGUtcmlnaHRdPVwic2lkZSA9PT0gJ2xlZnQnXCJcbiAgICAgICAgKG1vdXNlZG93bik9XCJvblJlc2l6ZVN0YXJ0KCRldmVudClcIlxuICAgICAgPjwvZGl2PlxuXG4gICAgICA8IS0tIFNpZGViYXIgaGVhZGVyIChhY3RzIGFzIGRyYWcgaGFuZGxlIGluIGZsb2F0aW5nIG1vZGUpIC0tPlxuICAgICAgPGRpdlxuICAgICAgICBjbGFzcz1cInNpZGViYXItaGVhZGVyXCJcbiAgICAgICAgW2NsYXNzLmRyYWctaGFuZGxlXT1cImlzRmxvYXRpbmdcIlxuICAgICAgICAobW91c2Vkb3duKT1cImlzRmxvYXRpbmcgJiYgb25GbG9hdERyYWdTdGFydCgkZXZlbnQpXCJcbiAgICAgID5cbiAgICAgICAgPGRpdiBjbGFzcz1cImhlYWRlci1sZWZ0XCI+XG4gICAgICAgICAgPHNwYW5cbiAgICAgICAgICAgIGNsYXNzPVwic3RhdHVzLWRvdFwiXG4gICAgICAgICAgICBbY2xhc3MuY29ubmVjdGVkXT1cIndzU3RhdHVzID09PSAnYXV0aGVudGljYXRlZCdcIlxuICAgICAgICAgICAgW2NsYXNzLmNvbm5lY3RpbmddPVwid3NTdGF0dXMgPT09ICdjb25uZWN0aW5nJ1wiXG4gICAgICAgICAgICBbY2xhc3MuZGlzY29ubmVjdGVkXT1cIndzU3RhdHVzID09PSAnZGlzY29ubmVjdGVkJ1wiXG4gICAgICAgICAgICBbbWF0VG9vbHRpcF09XCJnZXRTdGF0dXNUb29sdGlwKClcIlxuICAgICAgICAgICAgbWF0VG9vbHRpcFBvc2l0aW9uPVwiYmVsb3dcIlxuICAgICAgICAgID48L3NwYW4+XG4gICAgICAgICAgPHNwYW4gY2xhc3M9XCJoZWFkZXItdGl0bGVcIj5NZXNzYWdlczwvc3Bhbj5cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJoZWFkZXItYWN0aW9uc1wiPlxuICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICpuZ0lmPVwiYWN0aXZlVmlldyA9PT0gJ2luYm94J1wiXG4gICAgICAgICAgICBtYXQtaWNvbi1idXR0b25cbiAgICAgICAgICAgIGNsYXNzPVwiaGRyLWJ0blwiXG4gICAgICAgICAgICAoY2xpY2spPVwib3Blbk5ld0NvbnZlcnNhdGlvbigpXCJcbiAgICAgICAgICAgIG1hdFRvb2x0aXA9XCJOZXcgY29udmVyc2F0aW9uXCJcbiAgICAgICAgICAgIG1hdFRvb2x0aXBQb3NpdGlvbj1cImJlbG93XCJcbiAgICAgICAgICA+XG4gICAgICAgICAgICA8bWF0LWljb24+ZWRpdF9zcXVhcmU8L21hdC1pY29uPlxuICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICpuZ0lmPVwiYWN0aXZlVmlldyA9PT0gJ2luYm94J1wiXG4gICAgICAgICAgICBtYXQtaWNvbi1idXR0b25cbiAgICAgICAgICAgIGNsYXNzPVwiaGRyLWJ0blwiXG4gICAgICAgICAgICAoY2xpY2spPVwib3Blbkdyb3VwTWFuYWdlcigpXCJcbiAgICAgICAgICAgIG1hdFRvb2x0aXA9XCJDcmVhdGUgZ3JvdXBcIlxuICAgICAgICAgICAgbWF0VG9vbHRpcFBvc2l0aW9uPVwiYmVsb3dcIlxuICAgICAgICAgID5cbiAgICAgICAgICAgIDxtYXQtaWNvbj5ncm91cF9hZGQ8L21hdC1pY29uPlxuICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgIDwhLS0gU2lkZS1zd2FwIChzaWRlYmFyIG1vZGUgb25seSkgLS0+XG4gICAgICAgICAgPGJ1dHRvbiAqbmdJZj1cIiFpc0Zsb2F0aW5nXCIgbWF0LWljb24tYnV0dG9uIGNsYXNzPVwiaGRyLWJ0blwiIChjbGljayk9XCJ0b2dnbGVTaWRlKClcIlxuICAgICAgICAgICAgW21hdFRvb2x0aXBdPVwiJ01vdmUgdG8gJyArIChzaWRlID09PSAncmlnaHQnID8gJ2xlZnQnIDogJ3JpZ2h0JylcIiBtYXRUb29sdGlwUG9zaXRpb249XCJiZWxvd1wiPlxuICAgICAgICAgICAgPG1hdC1pY29uPnt7IHNpZGUgPT09ICdyaWdodCcgPyAnY2hldnJvbl9sZWZ0JyA6ICdjaGV2cm9uX3JpZ2h0JyB9fTwvbWF0LWljb24+XG4gICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgPCEtLSBQb3Atb3V0IC8gZG9jayB0b2dnbGUgLS0+XG4gICAgICAgICAgPGJ1dHRvbiBtYXQtaWNvbi1idXR0b24gY2xhc3M9XCJoZHItYnRuXCJcbiAgICAgICAgICAgIChjbGljayk9XCJ0b2dnbGVGbG9hdCgpXCJcbiAgICAgICAgICAgIFttYXRUb29sdGlwXT1cImlzRmxvYXRpbmcgPyAnRG9jayB0byBzaWRlYmFyJyA6ICdQb3Agb3V0IHRvIGZsb2F0aW5nIHdpbmRvdydcIlxuICAgICAgICAgICAgbWF0VG9vbHRpcFBvc2l0aW9uPVwiYmVsb3dcIj5cbiAgICAgICAgICAgIDxtYXQtaWNvbj57eyBpc0Zsb2F0aW5nID8gJ3BpY3R1cmVfaW5fcGljdHVyZV9hbHQnIDogJ29wZW5faW5fbmV3JyB9fTwvbWF0LWljb24+XG4gICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cImJ0bi1zcGFjZXJcIj48L2Rpdj5cbiAgICAgICAgICA8YnV0dG9uIG1hdC1pY29uLWJ1dHRvbiBjbGFzcz1cImhkci1idG5cIiAoY2xpY2spPVwiY2xvc2UoKVwiIG1hdFRvb2x0aXA9XCJDbG9zZSBtZXNzZW5nZXJcIiBtYXRUb29sdGlwUG9zaXRpb249XCJiZWxvd1wiPlxuICAgICAgICAgICAgPG1hdC1pY29uPmNsb3NlPC9tYXQtaWNvbj5cbiAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cblxuICAgICAgPCEtLSBWaWV3IGNvbnRhaW5lciAtLT5cbiAgICAgIDxkaXYgY2xhc3M9XCJzaWRlYmFyLWNvbnRlbnRcIj5cbiAgICAgICAgPGFwcC1pbmJveC1saXN0ICpuZ0lmPVwiYWN0aXZlVmlldyA9PT0gJ2luYm94J1wiPjwvYXBwLWluYm94LWxpc3Q+XG4gICAgICAgIDxhcHAtY2hhdC10aHJlYWRcbiAgICAgICAgICAqbmdJZj1cImFjdGl2ZVZpZXcgPT09ICdjaGF0J1wiXG4gICAgICAgICAgKGxpZ2h0Ym94T3Blbik9XCJvcGVuTGlnaHRib3goJGV2ZW50KVwiXG4gICAgICAgID48L2FwcC1jaGF0LXRocmVhZD5cbiAgICAgICAgPGFwcC1uZXctY29udmVyc2F0aW9uICpuZ0lmPVwiYWN0aXZlVmlldyA9PT0gJ25ldy1jb252ZXJzYXRpb24nXCI+PC9hcHAtbmV3LWNvbnZlcnNhdGlvbj5cbiAgICAgICAgPGFwcC1ncm91cC1tYW5hZ2VyICpuZ0lmPVwiYWN0aXZlVmlldyA9PT0gJ2dyb3VwLW1hbmFnZXInXCI+PC9hcHAtZ3JvdXAtbWFuYWdlcj5cbiAgICAgIDwvZGl2PlxuXG4gICAgICA8IS0tIFJlc2l6ZSBjb3JuZXIgKGZsb2F0aW5nIG1vZGUgb25seSkgLS0+XG4gICAgICA8ZGl2ICpuZ0lmPVwiaXNGbG9hdGluZ1wiIGNsYXNzPVwiZmxvYXQtcmVzaXplLWNvcm5lclwiIChtb3VzZWRvd24pPVwib25GbG9hdFJlc2l6ZVN0YXJ0KCRldmVudClcIj48L2Rpdj5cbiAgICA8L2Rpdj5cblxuICAgIDwhLS0g4pSA4pSAIExpZ2h0Ym94OiBzaWJsaW5nIG9mIC5zaWRlYmFyIHNvIHBvc2l0aW9uOmZpeGVkIGlzIHJlbGF0aXZlIHRvIHZpZXdwb3J0IOKUgOKUgCAtLT5cbiAgICA8ZGl2XG4gICAgICAqbmdJZj1cImxpZ2h0Ym94VXJsXCJcbiAgICAgIGNsYXNzPVwibGItb3ZlcmxheVwiXG4gICAgICBbY2xhc3MubGItZGV0YWNoZWRdPVwibGlnaHRib3hEZXRhY2hlZFwiXG4gICAgICBbc3R5bGUubGVmdC5weF09XCJsaWdodGJveERldGFjaGVkID8gbGlnaHRib3hYIDogbnVsbFwiXG4gICAgICBbc3R5bGUudG9wLnB4XT1cImxpZ2h0Ym94RGV0YWNoZWQgPyBsaWdodGJveFkgOiBudWxsXCJcbiAgICAgIFtzdHlsZS53aWR0aC5weF09XCJsaWdodGJveERldGFjaGVkID8gbGlnaHRib3hXIDogbnVsbFwiXG4gICAgICBbc3R5bGUuaGVpZ2h0LnB4XT1cImxpZ2h0Ym94RGV0YWNoZWQgPyBsaWdodGJveEggOiBudWxsXCJcbiAgICAgIChjbGljayk9XCJvbkxpZ2h0Ym94QmFja2Ryb3BDbGljaygkZXZlbnQpXCJcbiAgICA+XG4gICAgICA8ZGl2ICpuZ0lmPVwibGlnaHRib3hEZXRhY2hlZFwiIGNsYXNzPVwibGItZHJhZy1iYXJcIiAobW91c2Vkb3duKT1cIm9uTGJEcmFnU3RhcnQoJGV2ZW50KVwiPlxuICAgICAgICA8c3BhbiBjbGFzcz1cImxiLWRyYWctdGl0bGVcIj5JbWFnZSB2aWV3ZXI8L3NwYW4+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJsYi1kcmFnLWFjdGlvbnNcIj5cbiAgICAgICAgICA8YnV0dG9uIHR5cGU9XCJidXR0b25cIiBjbGFzcz1cImxiLWFjdGlvbi1idG5cIlxuICAgICAgICAgICAgKGNsaWNrKT1cIiRldmVudC5zdG9wUHJvcGFnYXRpb24oKTsgbGlnaHRib3hEZXRhY2hlZCA9IGZhbHNlXCIgdGl0bGU9XCJGdWxsc2NyZWVuXCI+XG4gICAgICAgICAgICA8bWF0LWljb24+ZnVsbHNjcmVlbjwvbWF0LWljb24+XG4gICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgPGJ1dHRvbiB0eXBlPVwiYnV0dG9uXCIgY2xhc3M9XCJsYi1hY3Rpb24tYnRuXCJcbiAgICAgICAgICAgIChjbGljayk9XCIkZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7IGxpZ2h0Ym94VXJsID0gbnVsbDsgbGlnaHRib3hEZXRhY2hlZCA9IGZhbHNlXCIgdGl0bGU9XCJDbG9zZVwiPlxuICAgICAgICAgICAgPG1hdC1pY29uPmNsb3NlPC9tYXQtaWNvbj5cbiAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICAgIDxpbWcgW3NyY109XCJsaWdodGJveFVybFwiIGNsYXNzPVwibGItaW1nXCIgW2NsYXNzLmxiLWltZy1kZXRhY2hlZF09XCJsaWdodGJveERldGFjaGVkXCJcbiAgICAgICAgICAgKGNsaWNrKT1cIiRldmVudC5zdG9wUHJvcGFnYXRpb24oKVwiIC8+XG4gICAgICA8bmctY29udGFpbmVyICpuZ0lmPVwiIWxpZ2h0Ym94RGV0YWNoZWRcIj5cbiAgICAgICAgPGJ1dHRvbiBjbGFzcz1cImxiLWNsb3NlXCIgKGNsaWNrKT1cImxpZ2h0Ym94VXJsID0gbnVsbFwiPjxtYXQtaWNvbj5jbG9zZTwvbWF0LWljb24+PC9idXR0b24+XG4gICAgICAgIDxidXR0b24gY2xhc3M9XCJsYi1kZXRhY2gtYnRuXCIgKGNsaWNrKT1cImRldGFjaExpZ2h0Ym94KClcIiB0aXRsZT1cIkRldGFjaCB0byBmbG9hdGluZyB3aW5kb3dcIj5cbiAgICAgICAgICA8bWF0LWljb24+cGljdHVyZV9pbl9waWN0dXJlPC9tYXQtaWNvbj5cbiAgICAgICAgPC9idXR0b24+XG4gICAgICA8L25nLWNvbnRhaW5lcj5cbiAgICAgIDxkaXYgKm5nSWY9XCJsaWdodGJveERldGFjaGVkXCIgY2xhc3M9XCJsYi1yZXNpemUtY29ybmVyXCIgKG1vdXNlZG93bik9XCJvbkxiUmVzaXplU3RhcnQoJGV2ZW50KVwiPjwvZGl2PlxuICAgIDwvZGl2PlxuICBgLFxuICBzdHlsZXM6IFtgXG4gICAgLnNpZGViYXIge1xuICAgICAgcG9zaXRpb246IGZpeGVkO1xuICAgICAgdG9wOiAwO1xuICAgICAgYm90dG9tOiAwO1xuICAgICAgd2lkdGg6IDQwMHB4O1xuICAgICAgYmFja2dyb3VuZDogIzA0MTMyMjtcbiAgICAgIHotaW5kZXg6IDk5OTk7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICAgIGJveC1zaGFkb3c6IDAgMCA0MHB4IHJnYmEoMCwgMCwgMCwgMC42KTtcbiAgICAgIHRyYW5zaXRpb246IHRyYW5zZm9ybSAwLjNzIGN1YmljLWJlemllcigwLjQsIDAsIDAuMiwgMSk7XG4gICAgfVxuXG4gICAgLnNpZGViYXIuc2lkZS1yaWdodCB7XG4gICAgICByaWdodDogMDtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWCgxMDAlKTtcbiAgICB9XG5cbiAgICAuc2lkZWJhci5zaWRlLWxlZnQge1xuICAgICAgbGVmdDogMDtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWCgtMTAwJSk7XG4gICAgfVxuXG4gICAgLnNpZGViYXIub3Blbi5zaWRlLXJpZ2h0IHtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWCgwKTtcbiAgICB9XG5cbiAgICAuc2lkZWJhci5vcGVuLnNpZGUtbGVmdCB7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVgoMCk7XG4gICAgfVxuXG4gICAgLyog4pSA4pSAIFJlc2l6ZSBoYW5kbGUgKGJlbG93IGhlYWRlciBzbyBoZWFkZXIgY29udHJvbHMgc3RheSBjbGlja2FibGUpIOKUgOKUgCAqL1xuICAgIC5yZXNpemUtaGFuZGxlIHtcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgIHRvcDogMDtcbiAgICAgIGJvdHRvbTogMDtcbiAgICAgIHdpZHRoOiA1cHg7XG4gICAgICBjdXJzb3I6IGV3LXJlc2l6ZTtcbiAgICAgIHotaW5kZXg6IDE7XG4gICAgICB0cmFuc2l0aW9uOiBiYWNrZ3JvdW5kIDAuMTVzO1xuICAgIH1cblxuICAgIC5yZXNpemUtaGFuZGxlOmhvdmVyLFxuICAgIC5yZXNpemUtaGFuZGxlOmFjdGl2ZSB7XG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMTUpO1xuICAgIH1cblxuICAgIC5yZXNpemUtaGFuZGxlLmhhbmRsZS1sZWZ0IHtcbiAgICAgIGxlZnQ6IDA7XG4gICAgfVxuXG4gICAgLnJlc2l6ZS1oYW5kbGUuaGFuZGxlLXJpZ2h0IHtcbiAgICAgIHJpZ2h0OiAwO1xuICAgIH1cblxuICAgIC8qIOKUgOKUgCBIZWFkZXIg4pSA4pSAICovXG4gICAgLnNpZGViYXItaGVhZGVyIHtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAganVzdGlmeS1jb250ZW50OiBzcGFjZS1iZXR3ZWVuO1xuICAgICAgcGFkZGluZzogOHB4IDEwcHggOHB4IDE0cHg7XG4gICAgICBib3JkZXItYm90dG9tOiAxcHggc29saWQgcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjE1KTtcbiAgICAgIGZsZXgtc2hyaW5rOiAwO1xuICAgICAgcG9zaXRpb246IHJlbGF0aXZlO1xuICAgICAgei1pbmRleDogMjtcbiAgICAgIG1pbi1oZWlnaHQ6IDQ4cHg7XG4gICAgfVxuXG4gICAgLmhlYWRlci1sZWZ0IHtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgZ2FwOiA4cHg7XG4gICAgICBtaW4td2lkdGg6IDA7XG4gICAgfVxuXG4gICAgLmhlYWRlci10aXRsZSB7XG4gICAgICBmb250LXNpemU6IDE2cHg7XG4gICAgICBmb250LXdlaWdodDogNzAwO1xuICAgICAgY29sb3I6ICNmZmY7XG4gICAgICBsZXR0ZXItc3BhY2luZzogMC4zcHg7XG4gICAgICB3aGl0ZS1zcGFjZTogbm93cmFwO1xuICAgIH1cblxuICAgIC5oZWFkZXItYWN0aW9ucyB7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGdhcDogMDtcbiAgICB9XG5cbiAgICAuYnRuLXNwYWNlciB7XG4gICAgICB3aWR0aDogMTJweDtcbiAgICB9XG5cbiAgICAuaGRyLWJ0biB7XG4gICAgICB3aWR0aDogMzJweDtcbiAgICAgIGhlaWdodDogMzJweDtcbiAgICAgIG1pbi13aWR0aDogMzJweDtcbiAgICAgIHBhZGRpbmc6IDA7XG4gICAgICBkaXNwbGF5OiBpbmxpbmUtZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDZweCAhaW1wb3J0YW50O1xuICAgICAgdHJhbnNpdGlvbjogYmFja2dyb3VuZCAwLjE1cywgYm94LXNoYWRvdyAwLjE1cztcbiAgICAgIC0tbWRjLWljb24tYnV0dG9uLXN0YXRlLWxheWVyLXNpemU6IDMycHg7XG4gICAgfVxuXG4gICAgLmhkci1idG4gLm1hdC1tZGMtYnV0dG9uLXRvdWNoLXRhcmdldCB7XG4gICAgICB3aWR0aDogMzJweDtcbiAgICAgIGhlaWdodDogMzJweDtcbiAgICB9XG5cbiAgICAuaGRyLWJ0bjpob3ZlciB7XG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMTUpICFpbXBvcnRhbnQ7XG4gICAgICBib3gtc2hhZG93OiAwIDJweCA4cHggcmdiYSgwLCAwLCAwLCAwLjIpO1xuICAgIH1cblxuICAgIC5oZHItYnRuIG1hdC1pY29uIHtcbiAgICAgIGZvbnQtc2l6ZTogMjBweDtcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuODUpO1xuICAgIH1cblxuICAgIC8qIOKUgOKUgCBDb250ZW50IOKUgOKUgCAqL1xuICAgIC5zaWRlYmFyLWNvbnRlbnQge1xuICAgICAgZmxleDogMTtcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgfVxuXG4gICAgLnN0YXR1cy1kb3Qge1xuICAgICAgd2lkdGg6IDhweDtcbiAgICAgIGhlaWdodDogOHB4O1xuICAgICAgYm9yZGVyLXJhZGl1czogNTAlO1xuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjQpO1xuICAgICAgZmxleC1zaHJpbms6IDA7XG4gICAgfVxuXG4gICAgLnN0YXR1cy1kb3QuY29ubmVjdGVkIHtcbiAgICAgIGJhY2tncm91bmQ6ICMyMmM1NWU7XG4gICAgICBib3gtc2hhZG93OiAwIDAgMCAzcHggcmdiYSgzNCwgMTk3LCA5NCwgMC4xOCk7XG4gICAgfVxuXG4gICAgLnN0YXR1cy1kb3QuY29ubmVjdGluZyB7XG4gICAgICBiYWNrZ3JvdW5kOiAjZjU5ZTBiO1xuICAgICAgYW5pbWF0aW9uOiBibGluayAxcyBpbmZpbml0ZTtcbiAgICB9XG5cbiAgICAuc3RhdHVzLWRvdC5kaXNjb25uZWN0ZWQge1xuICAgICAgYmFja2dyb3VuZDogI2VmNDQ0NDtcbiAgICAgIGJveC1zaGFkb3c6IDAgMCAwIDNweCByZ2JhKDIzOSwgNjgsIDY4LCAwLjE0KTtcbiAgICB9XG5cbiAgICBAa2V5ZnJhbWVzIGJsaW5rIHtcbiAgICAgIDUwJSB7IG9wYWNpdHk6IDAuMzsgfVxuICAgIH1cblxuICAgIC8qIOKUgOKUgCBGbG9hdGluZyBtb2RlIOKUgOKUgCAqL1xuICAgIC5zaWRlYmFyLmZsb2F0aW5nIHtcbiAgICAgIHBvc2l0aW9uOiBmaXhlZCAhaW1wb3J0YW50O1xuICAgICAgcmlnaHQ6IHVuc2V0ICFpbXBvcnRhbnQ7XG4gICAgICBsZWZ0OiA4MHB4O1xuICAgICAgdG9wOiA4MHB4O1xuICAgICAgdHJhbnNmb3JtOiBub25lICFpbXBvcnRhbnQ7XG4gICAgICBib3JkZXItcmFkaXVzOiAxMnB4O1xuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICAgIHJlc2l6ZTogbm9uZTtcbiAgICAgIG1pbi13aWR0aDogMjgwcHg7XG4gICAgICBtaW4taGVpZ2h0OiAzMjBweDtcbiAgICB9XG5cbiAgICAuc2lkZWJhci5mbG9hdGluZzpub3QoLm9wZW4pIHtcbiAgICAgIGRpc3BsYXk6IG5vbmU7XG4gICAgfVxuXG4gICAgLmRyYWctaGFuZGxlIHtcbiAgICAgIGN1cnNvcjogZ3JhYjtcbiAgICAgIHVzZXItc2VsZWN0OiBub25lO1xuICAgIH1cblxuICAgIC5kcmFnLWhhbmRsZTphY3RpdmUge1xuICAgICAgY3Vyc29yOiBncmFiYmluZztcbiAgICB9XG5cbiAgICAuZmxvYXQtcmVzaXplLWNvcm5lciB7XG4gICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XG4gICAgICBib3R0b206IDA7XG4gICAgICByaWdodDogMDtcbiAgICAgIHdpZHRoOiAxNnB4O1xuICAgICAgaGVpZ2h0OiAxNnB4O1xuICAgICAgY3Vyc29yOiBzZS1yZXNpemU7XG4gICAgICBiYWNrZ3JvdW5kOiBsaW5lYXItZ3JhZGllbnQoMTM1ZGVnLCB0cmFuc3BhcmVudCA1MCUsIHJnYmEoMjU1LDI1NSwyNTUsMC4yNSkgNTAlKTtcbiAgICAgIGJvcmRlci1ib3R0b20tcmlnaHQtcmFkaXVzOiAxMnB4O1xuICAgIH1cblxuICAgIEBtZWRpYSAobWF4LXdpZHRoOiA0ODBweCkge1xuICAgICAgLnNpZGViYXIge1xuICAgICAgICB3aWR0aDogMTAwJSAhaW1wb3J0YW50O1xuICAgICAgfVxuICAgICAgLnJlc2l6ZS1oYW5kbGUge1xuICAgICAgICBkaXNwbGF5OiBub25lO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8qIOKUgOKUgCBMaWdodGJveCAob3V0c2lkZSAuc2lkZWJhciBzbyBwb3NpdGlvbjpmaXhlZCBpcyB2aWV3cG9ydC1yZWxhdGl2ZSkg4pSA4pSAICovXG4gICAgLmxiLW92ZXJsYXkge1xuICAgICAgcG9zaXRpb246IGZpeGVkO1xuICAgICAgaW5zZXQ6IDA7XG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDAsMCwwLDAuODgpO1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgIHotaW5kZXg6IDk5OTk5O1xuICAgICAgY3Vyc29yOiBwb2ludGVyO1xuICAgIH1cblxuICAgIC5sYi1vdmVybGF5LmxiLWRldGFjaGVkIHtcbiAgICAgIGluc2V0OiB1bnNldDtcbiAgICAgIGJhY2tncm91bmQ6ICMwYzFmMzU7XG4gICAgICBib3JkZXI6IDFweCBzb2xpZCByZ2JhKDI1NSwyNTUsMjU1LDAuMTgpO1xuICAgICAgYm9yZGVyLXJhZGl1czogMTJweDtcbiAgICAgIGJveC1zaGFkb3c6IDAgMTJweCA0OHB4IHJnYmEoMCwwLDAsMC43KTtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICAgIGN1cnNvcjogZGVmYXVsdDtcbiAgICAgIG1pbi13aWR0aDogMjQwcHg7XG4gICAgICBtaW4taGVpZ2h0OiAyMDBweDtcbiAgICB9XG5cbiAgICAubGItZHJhZy1iYXIge1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWJldHdlZW47XG4gICAgICBwYWRkaW5nOiA2cHggOHB4IDZweCAxMnB4O1xuICAgICAgYmFja2dyb3VuZDogIzA0MTMyMjtcbiAgICAgIGJvcmRlci1ib3R0b206IDFweCBzb2xpZCByZ2JhKDI1NSwyNTUsMjU1LDAuMTIpO1xuICAgICAgY3Vyc29yOiBncmFiO1xuICAgICAgZmxleC1zaHJpbms6IDA7XG4gICAgICB1c2VyLXNlbGVjdDogbm9uZTtcbiAgICB9XG4gICAgLmxiLWRyYWctYmFyOmFjdGl2ZSB7IGN1cnNvcjogZ3JhYmJpbmc7IH1cblxuICAgIC5sYi1kcmFnLXRpdGxlIHsgZm9udC1zaXplOiAxMnB4OyBjb2xvcjogcmdiYSgyNTUsMjU1LDI1NSwwLjYpOyBsZXR0ZXItc3BhY2luZzogMC40cHg7IH1cbiAgICAubGItZHJhZy1hY3Rpb25zIHsgZGlzcGxheTogZmxleDsgZ2FwOiAycHg7IH1cblxuICAgIC5sYi1hY3Rpb24tYnRuIHtcbiAgICAgIGJhY2tncm91bmQ6IHRyYW5zcGFyZW50O1xuICAgICAgYm9yZGVyOiBub25lO1xuICAgICAgYm9yZGVyLXJhZGl1czogNnB4O1xuICAgICAgd2lkdGg6IDI4cHg7IGhlaWdodDogMjhweDtcbiAgICAgIGRpc3BsYXk6IGZsZXg7IGFsaWduLWl0ZW1zOiBjZW50ZXI7IGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgICAgY3Vyc29yOiBwb2ludGVyO1xuICAgICAgY29sb3I6IHJnYmEoMjU1LDI1NSwyNTUsMC43KTtcbiAgICAgIHRyYW5zaXRpb246IGJhY2tncm91bmQgMC4xNXM7XG4gICAgfVxuICAgIC5sYi1hY3Rpb24tYnRuOmhvdmVyIHsgYmFja2dyb3VuZDogcmdiYSgyNTUsMjU1LDI1NSwwLjE1KTsgfVxuICAgIC5sYi1hY3Rpb24tYnRuIG1hdC1pY29uIHsgZm9udC1zaXplOiAxNnB4OyB3aWR0aDogMTZweDsgaGVpZ2h0OiAxNnB4OyB9XG5cbiAgICAubGItaW1nIHtcbiAgICAgIG1heC13aWR0aDogOTJ2dzsgbWF4LWhlaWdodDogOTJ2aDtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDhweDtcbiAgICAgIGJveC1zaGFkb3c6IDAgOHB4IDQwcHggcmdiYSgwLDAsMCwwLjYpO1xuICAgICAgY3Vyc29yOiBkZWZhdWx0O1xuICAgIH1cbiAgICAubGItaW1nLmxiLWltZy1kZXRhY2hlZCB7XG4gICAgICBtYXgtd2lkdGg6IDEwMCU7IG1heC1oZWlnaHQ6IDEwMCU7XG4gICAgICBib3JkZXItcmFkaXVzOiAwOyBib3gtc2hhZG93OiBub25lO1xuICAgICAgb2JqZWN0LWZpdDogY29udGFpbjsgZmxleDogMTtcbiAgICB9XG5cbiAgICAubGItY2xvc2Uge1xuICAgICAgcG9zaXRpb246IGFic29sdXRlOyB0b3A6IDE2cHg7IHJpZ2h0OiAxNnB4O1xuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsMjU1LDI1NSwwLjE1KTsgYm9yZGVyOiBub25lOyBib3JkZXItcmFkaXVzOiA1MCU7XG4gICAgICB3aWR0aDogMzZweDsgaGVpZ2h0OiAzNnB4O1xuICAgICAgZGlzcGxheTogZmxleDsgYWxpZ24taXRlbXM6IGNlbnRlcjsganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgICBjdXJzb3I6IHBvaW50ZXI7IGNvbG9yOiAjZmZmOyB0cmFuc2l0aW9uOiBiYWNrZ3JvdW5kIDAuMTVzO1xuICAgIH1cbiAgICAubGItY2xvc2U6aG92ZXIgeyBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwyNTUsMjU1LDAuMyk7IH1cblxuICAgIC5sYi1kZXRhY2gtYnRuIHtcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTsgdG9wOiAxNnB4OyByaWdodDogNjBweDtcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LDI1NSwyNTUsMC4xNSk7IGJvcmRlcjogbm9uZTsgYm9yZGVyLXJhZGl1czogNTAlO1xuICAgICAgd2lkdGg6IDM2cHg7IGhlaWdodDogMzZweDtcbiAgICAgIGRpc3BsYXk6IGZsZXg7IGFsaWduLWl0ZW1zOiBjZW50ZXI7IGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgICAgY3Vyc29yOiBwb2ludGVyOyBjb2xvcjogI2ZmZjsgdHJhbnNpdGlvbjogYmFja2dyb3VuZCAwLjE1cztcbiAgICB9XG4gICAgLmxiLWRldGFjaC1idG46aG92ZXIgeyBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwyNTUsMjU1LDAuMyk7IH1cblxuICAgIC5sYi1yZXNpemUtY29ybmVyIHtcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTsgYm90dG9tOiAwOyByaWdodDogMDtcbiAgICAgIHdpZHRoOiAxNnB4OyBoZWlnaHQ6IDE2cHg7XG4gICAgICBjdXJzb3I6IHNlLXJlc2l6ZTtcbiAgICAgIGJhY2tncm91bmQ6IGxpbmVhci1ncmFkaWVudCgxMzVkZWcsIHRyYW5zcGFyZW50IDUwJSwgcmdiYSgyNTUsMjU1LDI1NSwwLjIpIDUwJSk7XG4gICAgICBib3JkZXItYm90dG9tLXJpZ2h0LXJhZGl1czogMTJweDtcbiAgICB9XG4gIGBdLFxufSlcbmV4cG9ydCBjbGFzcyBDaGF0UGFuZWxDb21wb25lbnQgaW1wbGVtZW50cyBPbkluaXQsIE9uRGVzdHJveSB7XG4gIGlzT3BlbiA9IGZhbHNlO1xuICBhY3RpdmVWaWV3OiAnaW5ib3gnIHwgJ2NoYXQnIHwgJ25ldy1jb252ZXJzYXRpb24nIHwgJ2dyb3VwLW1hbmFnZXInIHwgJ2NvbnZlcnNhdGlvbi1zZXR0aW5ncycgPSAnaW5ib3gnO1xuICB3c1N0YXR1czogc3RyaW5nID0gJ2Rpc2Nvbm5lY3RlZCc7XG4gIHNpZGU6IFNpZGViYXJTaWRlID0gJ3JpZ2h0JztcbiAgc2lkZWJhcldpZHRoID0gNDAwO1xuXG4gIC8vIOKUgOKUgCBGbG9hdGluZyB3aW5kb3cgc3RhdGUg4pSA4pSAXG4gIGlzRmxvYXRpbmcgPSBmYWxzZTtcbiAgZmxvYXRYID0gODA7XG4gIGZsb2F0WSA9IDgwO1xuICBmbG9hdFdpZHRoID0gMzgwO1xuICBmbG9hdEhlaWdodCA9IDU0MDtcblxuICBwcml2YXRlIGRlZmF1bHRXaWR0aCA9IDQwMDtcbiAgcHJpdmF0ZSByZXNpemluZyA9IGZhbHNlO1xuICBwcml2YXRlIHJlc2l6ZVN0YXJ0WCA9IDA7XG4gIHByaXZhdGUgcmVzaXplU3RhcnRXaWR0aCA9IDA7XG4gIHByaXZhdGUgYm91bmRSZXNpemVNb3ZlID0gdGhpcy5vblJlc2l6ZU1vdmUuYmluZCh0aGlzKTtcbiAgcHJpdmF0ZSBib3VuZFJlc2l6ZUVuZCA9IHRoaXMub25SZXNpemVFbmQuYmluZCh0aGlzKTtcblxuICAvLyBmbG9hdCBkcmFnXG4gIHByaXZhdGUgZmxvYXREcmFnZ2luZyA9IGZhbHNlO1xuICBwcml2YXRlIGZsb2F0RHJhZ09mZlggPSAwO1xuICBwcml2YXRlIGZsb2F0RHJhZ09mZlkgPSAwO1xuICBwcml2YXRlIGJvdW5kRmxvYXRNb3ZlID0gdGhpcy5vbkZsb2F0RHJhZ01vdmUuYmluZCh0aGlzKTtcbiAgcHJpdmF0ZSBib3VuZEZsb2F0RW5kICA9IHRoaXMub25GbG9hdERyYWdFbmQuYmluZCh0aGlzKTtcblxuICAvLyBmbG9hdCByZXNpemVcbiAgcHJpdmF0ZSBmbG9hdFJlc2l6aW5nID0gZmFsc2U7XG4gIHByaXZhdGUgZmxvYXRSZXNpemVTdGFydFggPSAwO1xuICBwcml2YXRlIGZsb2F0UmVzaXplU3RhcnRZID0gMDtcbiAgcHJpdmF0ZSBmbG9hdFJlc2l6ZVN0YXJ0VyA9IDA7XG4gIHByaXZhdGUgZmxvYXRSZXNpemVTdGFydEggPSAwO1xuICBwcml2YXRlIGJvdW5kRmxvYXRSZXNpemVNb3ZlID0gdGhpcy5vbkZsb2F0UmVzaXplTW92ZS5iaW5kKHRoaXMpO1xuICBwcml2YXRlIGJvdW5kRmxvYXRSZXNpemVFbmQgID0gdGhpcy5vbkZsb2F0UmVzaXplRW5kLmJpbmQodGhpcyk7XG5cbiAgcHJpdmF0ZSBzdWIhOiBTdWJzY3JpcHRpb247XG5cbiAgLy8g4pSA4pSAIExpZ2h0Ym94IHN0YXRlIOKUgOKUgFxuICBsaWdodGJveFVybDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG4gIGxpZ2h0Ym94RGV0YWNoZWQgPSBmYWxzZTtcbiAgbGlnaHRib3hYID0gMTAwO1xuICBsaWdodGJveFkgPSA4MDtcbiAgbGlnaHRib3hXID0gNTYwO1xuICBsaWdodGJveEggPSA0NjA7XG4gIHByaXZhdGUgbGJEcmFnZ2luZyA9IGZhbHNlO1xuICBwcml2YXRlIGxiRHJhZ09mZlggPSAwO1xuICBwcml2YXRlIGxiRHJhZ09mZlkgPSAwO1xuICBwcml2YXRlIGxiUmVzaXppbmcgPSBmYWxzZTtcbiAgcHJpdmF0ZSBsYlJlc2l6ZVN0YXJ0WCA9IDA7XG4gIHByaXZhdGUgbGJSZXNpemVTdGFydFkgPSAwO1xuICBwcml2YXRlIGxiUmVzaXplU3RhcnRXID0gMDtcbiAgcHJpdmF0ZSBsYlJlc2l6ZVN0YXJ0SCA9IDA7XG4gIHByaXZhdGUgYm91bmRMYk1vdmUgICAgICAgID0gdGhpcy5vbkxiRHJhZ01vdmUuYmluZCh0aGlzKTtcbiAgcHJpdmF0ZSBib3VuZExiRW5kICAgICAgICAgPSB0aGlzLm9uTGJEcmFnRW5kLmJpbmQodGhpcyk7XG4gIHByaXZhdGUgYm91bmRMYlJlc2l6ZU1vdmUgID0gdGhpcy5vbkxiUmVzaXplTW92ZS5iaW5kKHRoaXMpO1xuICBwcml2YXRlIGJvdW5kTGJSZXNpemVFbmQgICA9IHRoaXMub25MYlJlc2l6ZUVuZC5iaW5kKHRoaXMpO1xuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgc3RvcmU6IE1lc3NhZ2luZ1N0b3JlU2VydmljZSkge31cblxuICBuZ09uSW5pdCgpOiB2b2lkIHtcbiAgICB0aGlzLnNpZGUgPSB0aGlzLnN0b3JlLmdldFNpZGViYXJTaWRlKCk7XG4gICAgY29uc3Qgc2F2ZWQgPSBsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnbWVzc2FnaW5nX3NpZGViYXJfd2lkdGgnKTtcbiAgICBpZiAoc2F2ZWQpIHRoaXMuc2lkZWJhcldpZHRoID0gcGFyc2VJbnQoc2F2ZWQsIDEwKSB8fCB0aGlzLmRlZmF1bHRXaWR0aDtcblxuICAgIGNvbnN0IHNhdmVkRmxvYXQgPSBsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnbWVzc2FnaW5nX2Zsb2F0X3N0YXRlJyk7XG4gICAgaWYgKHNhdmVkRmxvYXQpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGYgPSBKU09OLnBhcnNlKHNhdmVkRmxvYXQpO1xuICAgICAgICB0aGlzLmlzRmxvYXRpbmcgPSBmLmlzRmxvYXRpbmcgPz8gZmFsc2U7XG4gICAgICAgIHRoaXMuc3RvcmUuc2V0UGFuZWxGbG9hdGluZyh0aGlzLmlzRmxvYXRpbmcpO1xuICAgICAgICB0aGlzLmZsb2F0WCA9IGYueCA/PyA4MDtcbiAgICAgICAgdGhpcy5mbG9hdFkgPSBmLnkgPz8gODA7XG4gICAgICAgIHRoaXMuZmxvYXRXaWR0aCA9IGYudyA/PyAzODA7XG4gICAgICAgIHRoaXMuZmxvYXRIZWlnaHQgPSBmLmggPz8gNTQwO1xuICAgICAgfSBjYXRjaCB7fVxuICAgIH1cblxuICAgIHRoaXMuc3ViID0gY29tYmluZUxhdGVzdChbXG4gICAgICB0aGlzLnN0b3JlLnBhbmVsT3BlbixcbiAgICAgIHRoaXMuc3RvcmUuYWN0aXZlVmlldyxcbiAgICAgIHRoaXMuc3RvcmUud3NTdGF0dXMsXG4gICAgICB0aGlzLnN0b3JlLnNpZGViYXJTaWRlLFxuICAgIF0pLnN1YnNjcmliZSgoW29wZW4sIHZpZXcsIHdzLCBzaWRlXSkgPT4ge1xuICAgICAgdGhpcy5pc09wZW4gPSBvcGVuO1xuICAgICAgdGhpcy5hY3RpdmVWaWV3ID0gdmlldztcbiAgICAgIHRoaXMud3NTdGF0dXMgPSB3cztcbiAgICAgIHRoaXMuc2lkZSA9IHNpZGU7XG4gICAgfSk7XG4gIH1cblxuICBuZ09uRGVzdHJveSgpOiB2b2lkIHtcbiAgICB0aGlzLnN1Yj8udW5zdWJzY3JpYmUoKTtcbiAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCB0aGlzLmJvdW5kUmVzaXplTW92ZSk7XG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIHRoaXMuYm91bmRSZXNpemVFbmQpO1xuICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIHRoaXMuYm91bmRGbG9hdE1vdmUpO1xuICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCB0aGlzLmJvdW5kRmxvYXRFbmQpO1xuICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIHRoaXMuYm91bmRGbG9hdFJlc2l6ZU1vdmUpO1xuICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCB0aGlzLmJvdW5kRmxvYXRSZXNpemVFbmQpO1xuICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIHRoaXMuYm91bmRMYk1vdmUpO1xuICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCB0aGlzLmJvdW5kTGJFbmQpO1xuICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIHRoaXMuYm91bmRMYlJlc2l6ZU1vdmUpO1xuICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCB0aGlzLmJvdW5kTGJSZXNpemVFbmQpO1xuICB9XG5cbiAgLy8g4pSA4pSAIExpZ2h0Ym94IOKUgOKUgFxuICBvcGVuTGlnaHRib3godXJsOiBzdHJpbmcpOiB2b2lkIHtcbiAgICB0aGlzLmxpZ2h0Ym94VXJsID0gdXJsO1xuICAgIHRoaXMubGlnaHRib3hEZXRhY2hlZCA9IGZhbHNlO1xuICB9XG5cbiAgb25MaWdodGJveEJhY2tkcm9wQ2xpY2soZXZlbnQ6IE1vdXNlRXZlbnQpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5saWdodGJveERldGFjaGVkKSByZXR1cm47XG4gICAgaWYgKGV2ZW50LnRhcmdldCAhPT0gZXZlbnQuY3VycmVudFRhcmdldCkgcmV0dXJuO1xuICAgIHRoaXMubGlnaHRib3hVcmwgPSBudWxsO1xuICB9XG5cbiAgZGV0YWNoTGlnaHRib3goKTogdm9pZCB7XG4gICAgdGhpcy5saWdodGJveERldGFjaGVkID0gdHJ1ZTtcbiAgICB0aGlzLmxpZ2h0Ym94WCA9IE1hdGgubWF4KDIwLCBNYXRoLnJvdW5kKCh3aW5kb3cuaW5uZXJXaWR0aCAgLSB0aGlzLmxpZ2h0Ym94VykgLyAyKSk7XG4gICAgdGhpcy5saWdodGJveFkgPSBNYXRoLm1heCgyMCwgTWF0aC5yb3VuZCgod2luZG93LmlubmVySGVpZ2h0IC0gdGhpcy5saWdodGJveEgpIC8gMikpO1xuICB9XG5cbiAgb25MYkRyYWdTdGFydChldmVudDogTW91c2VFdmVudCk6IHZvaWQge1xuICAgIGlmICgoZXZlbnQudGFyZ2V0IGFzIEhUTUxFbGVtZW50KS5jbG9zZXN0KCdidXR0b24nKSkgcmV0dXJuO1xuICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgdGhpcy5sYkRyYWdnaW5nID0gdHJ1ZTtcbiAgICB0aGlzLmxiRHJhZ09mZlggPSBldmVudC5jbGllbnRYIC0gdGhpcy5saWdodGJveFg7XG4gICAgdGhpcy5sYkRyYWdPZmZZID0gZXZlbnQuY2xpZW50WSAtIHRoaXMubGlnaHRib3hZO1xuICAgIGRvY3VtZW50LmJvZHkuc3R5bGUudXNlclNlbGVjdCA9ICdub25lJztcbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCB0aGlzLmJvdW5kTGJNb3ZlKTtcbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgICB0aGlzLmJvdW5kTGJFbmQpO1xuICB9XG5cbiAgcHJpdmF0ZSBvbkxiRHJhZ01vdmUoZXZlbnQ6IE1vdXNlRXZlbnQpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMubGJEcmFnZ2luZykgcmV0dXJuO1xuICAgIHRoaXMubGlnaHRib3hYID0gTWF0aC5tYXgoMCwgTWF0aC5taW4oZXZlbnQuY2xpZW50WCAtIHRoaXMubGJEcmFnT2ZmWCwgd2luZG93LmlubmVyV2lkdGggIC0gdGhpcy5saWdodGJveFcpKTtcbiAgICB0aGlzLmxpZ2h0Ym94WSA9IE1hdGgubWF4KDAsIE1hdGgubWluKGV2ZW50LmNsaWVudFkgLSB0aGlzLmxiRHJhZ09mZlksIHdpbmRvdy5pbm5lckhlaWdodCAtIDYwKSk7XG4gIH1cblxuICBwcml2YXRlIG9uTGJEcmFnRW5kKCk6IHZvaWQge1xuICAgIGlmICghdGhpcy5sYkRyYWdnaW5nKSByZXR1cm47XG4gICAgdGhpcy5sYkRyYWdnaW5nID0gZmFsc2U7XG4gICAgZG9jdW1lbnQuYm9keS5zdHlsZS51c2VyU2VsZWN0ID0gJyc7XG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgdGhpcy5ib3VuZExiTW92ZSk7XG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsICAgdGhpcy5ib3VuZExiRW5kKTtcbiAgfVxuXG4gIG9uTGJSZXNpemVTdGFydChldmVudDogTW91c2VFdmVudCk6IHZvaWQge1xuICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgdGhpcy5sYlJlc2l6aW5nID0gdHJ1ZTtcbiAgICB0aGlzLmxiUmVzaXplU3RhcnRYID0gZXZlbnQuY2xpZW50WDtcbiAgICB0aGlzLmxiUmVzaXplU3RhcnRZID0gZXZlbnQuY2xpZW50WTtcbiAgICB0aGlzLmxiUmVzaXplU3RhcnRXID0gdGhpcy5saWdodGJveFc7XG4gICAgdGhpcy5sYlJlc2l6ZVN0YXJ0SCA9IHRoaXMubGlnaHRib3hIO1xuICAgIGRvY3VtZW50LmJvZHkuc3R5bGUuY3Vyc29yID0gJ3NlLXJlc2l6ZSc7XG4gICAgZG9jdW1lbnQuYm9keS5zdHlsZS51c2VyU2VsZWN0ID0gJ25vbmUnO1xuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIHRoaXMuYm91bmRMYlJlc2l6ZU1vdmUpO1xuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCAgIHRoaXMuYm91bmRMYlJlc2l6ZUVuZCk7XG4gIH1cblxuICBwcml2YXRlIG9uTGJSZXNpemVNb3ZlKGV2ZW50OiBNb3VzZUV2ZW50KTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLmxiUmVzaXppbmcpIHJldHVybjtcbiAgICB0aGlzLmxpZ2h0Ym94VyA9IE1hdGgubWF4KDI0MCwgdGhpcy5sYlJlc2l6ZVN0YXJ0VyArIChldmVudC5jbGllbnRYIC0gdGhpcy5sYlJlc2l6ZVN0YXJ0WCkpO1xuICAgIHRoaXMubGlnaHRib3hIID0gTWF0aC5tYXgoMjAwLCB0aGlzLmxiUmVzaXplU3RhcnRIICsgKGV2ZW50LmNsaWVudFkgLSB0aGlzLmxiUmVzaXplU3RhcnRZKSk7XG4gIH1cblxuICBwcml2YXRlIG9uTGJSZXNpemVFbmQoKTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLmxiUmVzaXppbmcpIHJldHVybjtcbiAgICB0aGlzLmxiUmVzaXppbmcgPSBmYWxzZTtcbiAgICBkb2N1bWVudC5ib2R5LnN0eWxlLmN1cnNvciA9ICcnO1xuICAgIGRvY3VtZW50LmJvZHkuc3R5bGUudXNlclNlbGVjdCA9ICcnO1xuICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIHRoaXMuYm91bmRMYlJlc2l6ZU1vdmUpO1xuICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCAgIHRoaXMuYm91bmRMYlJlc2l6ZUVuZCk7XG4gIH1cblxuICB0b2dnbGVTaWRlKCk6IHZvaWQge1xuICAgIHRoaXMuc3RvcmUudG9nZ2xlU2lkZWJhclNpZGUoKTtcbiAgfVxuXG4gIG9wZW5OZXdDb252ZXJzYXRpb24oKTogdm9pZCB7XG4gICAgdGhpcy5zdG9yZS5zZXRWaWV3KCduZXctY29udmVyc2F0aW9uJyk7XG4gIH1cblxuICBvcGVuR3JvdXBNYW5hZ2VyKCk6IHZvaWQge1xuICAgIHRoaXMuc3RvcmUuc2V0VmlldygnZ3JvdXAtbWFuYWdlcicpO1xuICB9XG5cbiAgZ2V0U3RhdHVzVG9vbHRpcCgpOiBzdHJpbmcge1xuICAgIGlmICh0aGlzLndzU3RhdHVzID09PSAnYXV0aGVudGljYXRlZCcpIHJldHVybiAnQ29ubmVjdGVkJztcbiAgICBpZiAodGhpcy53c1N0YXR1cyA9PT0gJ2Nvbm5lY3RpbmcnKSByZXR1cm4gJ0Nvbm5lY3RpbmcnO1xuICAgIHJldHVybiAnRGlzY29ubmVjdGVkJztcbiAgfVxuXG4gIGNsb3NlKCk6IHZvaWQge1xuICAgIHRoaXMuc3RvcmUuY2xvc2VQYW5lbCgpO1xuICB9XG5cbiAgdG9nZ2xlRmxvYXQoKTogdm9pZCB7XG4gICAgdGhpcy5pc0Zsb2F0aW5nID0gIXRoaXMuaXNGbG9hdGluZztcbiAgICB0aGlzLnN0b3JlLnNldFBhbmVsRmxvYXRpbmcodGhpcy5pc0Zsb2F0aW5nKTtcbiAgICBpZiAodGhpcy5pc0Zsb2F0aW5nKSB7XG4gICAgICAvLyBDZW50cmUgdGhlIGZsb2F0IHdpbmRvdyBvbiBzY3JlZW4gd2hlbiBmaXJzdCBwb3BwaW5nIG91dFxuICAgICAgdGhpcy5mbG9hdFggPSBNYXRoLm1heCgyMCwgTWF0aC5yb3VuZCgod2luZG93LmlubmVyV2lkdGggIC0gdGhpcy5mbG9hdFdpZHRoKSAgLyAyKSk7XG4gICAgICB0aGlzLmZsb2F0WSA9IE1hdGgubWF4KDIwLCBNYXRoLnJvdW5kKCh3aW5kb3cuaW5uZXJIZWlnaHQgLSB0aGlzLmZsb2F0SGVpZ2h0KSAvIDIpKTtcbiAgICB9XG4gICAgdGhpcy5zYXZlRmxvYXRTdGF0ZSgpO1xuICB9XG5cbiAgLy8g4pSA4pSAIFNpZGViYXIgcmVzaXplIOKUgOKUgFxuICBvblJlc2l6ZVN0YXJ0KGV2ZW50OiBNb3VzZUV2ZW50KTogdm9pZCB7XG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICB0aGlzLnJlc2l6aW5nID0gdHJ1ZTtcbiAgICB0aGlzLnJlc2l6ZVN0YXJ0WCA9IGV2ZW50LmNsaWVudFg7XG4gICAgdGhpcy5yZXNpemVTdGFydFdpZHRoID0gdGhpcy5zaWRlYmFyV2lkdGg7XG4gICAgZG9jdW1lbnQuYm9keS5zdHlsZS5jdXJzb3IgPSAnZXctcmVzaXplJztcbiAgICBkb2N1bWVudC5ib2R5LnN0eWxlLnVzZXJTZWxlY3QgPSAnbm9uZSc7XG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgdGhpcy5ib3VuZFJlc2l6ZU1vdmUpO1xuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCB0aGlzLmJvdW5kUmVzaXplRW5kKTtcbiAgfVxuXG4gIHByaXZhdGUgb25SZXNpemVNb3ZlKGV2ZW50OiBNb3VzZUV2ZW50KTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLnJlc2l6aW5nKSByZXR1cm47XG4gICAgY29uc3QgZHggPSBldmVudC5jbGllbnRYIC0gdGhpcy5yZXNpemVTdGFydFg7XG4gICAgaWYgKHRoaXMuc2lkZSA9PT0gJ3JpZ2h0Jykge1xuICAgICAgdGhpcy5zaWRlYmFyV2lkdGggPSBNYXRoLm1heCgyMDAsIHRoaXMucmVzaXplU3RhcnRXaWR0aCAtIGR4KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5zaWRlYmFyV2lkdGggPSBNYXRoLm1heCgyMDAsIHRoaXMucmVzaXplU3RhcnRXaWR0aCArIGR4KTtcbiAgICB9XG4gICAgdGhpcy5zaWRlYmFyV2lkdGggPSBNYXRoLm1pbih0aGlzLnNpZGViYXJXaWR0aCwgd2luZG93LmlubmVyV2lkdGggKiAwLjkpO1xuICB9XG5cbiAgcHJpdmF0ZSBvblJlc2l6ZUVuZCgpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMucmVzaXppbmcpIHJldHVybjtcbiAgICB0aGlzLnJlc2l6aW5nID0gZmFsc2U7XG4gICAgZG9jdW1lbnQuYm9keS5zdHlsZS5jdXJzb3IgPSAnJztcbiAgICBkb2N1bWVudC5ib2R5LnN0eWxlLnVzZXJTZWxlY3QgPSAnJztcbiAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCB0aGlzLmJvdW5kUmVzaXplTW92ZSk7XG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIHRoaXMuYm91bmRSZXNpemVFbmQpO1xuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdtZXNzYWdpbmdfc2lkZWJhcl93aWR0aCcsIFN0cmluZyh0aGlzLnNpZGViYXJXaWR0aCkpO1xuICB9XG5cbiAgLy8g4pSA4pSAIEZsb2F0aW5nIHBhbmVsIGRyYWcg4pSA4pSAXG4gIG9uRmxvYXREcmFnU3RhcnQoZXZlbnQ6IE1vdXNlRXZlbnQpOiB2b2lkIHtcbiAgICAvLyBJZ25vcmUgaWYgY29taW5nIGZyb20gYSBidXR0b24gaW5zaWRlIHRoZSBoZWFkZXJcbiAgICBpZiAoKGV2ZW50LnRhcmdldCBhcyBIVE1MRWxlbWVudCkuY2xvc2VzdCgnYnV0dG9uJykpIHJldHVybjtcbiAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIHRoaXMuZmxvYXREcmFnZ2luZyA9IHRydWU7XG4gICAgdGhpcy5mbG9hdERyYWdPZmZYID0gZXZlbnQuY2xpZW50WCAtIHRoaXMuZmxvYXRYO1xuICAgIHRoaXMuZmxvYXREcmFnT2ZmWSA9IGV2ZW50LmNsaWVudFkgLSB0aGlzLmZsb2F0WTtcbiAgICBkb2N1bWVudC5ib2R5LnN0eWxlLnVzZXJTZWxlY3QgPSAnbm9uZSc7XG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgdGhpcy5ib3VuZEZsb2F0TW92ZSk7XG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIHRoaXMuYm91bmRGbG9hdEVuZCk7XG4gIH1cblxuICBwcml2YXRlIG9uRmxvYXREcmFnTW92ZShldmVudDogTW91c2VFdmVudCk6IHZvaWQge1xuICAgIGlmICghdGhpcy5mbG9hdERyYWdnaW5nKSByZXR1cm47XG4gICAgdGhpcy5mbG9hdFggPSBNYXRoLm1heCgwLCBNYXRoLm1pbihldmVudC5jbGllbnRYIC0gdGhpcy5mbG9hdERyYWdPZmZYLCB3aW5kb3cuaW5uZXJXaWR0aCAgLSB0aGlzLmZsb2F0V2lkdGgpKTtcbiAgICB0aGlzLmZsb2F0WSA9IE1hdGgubWF4KDAsIE1hdGgubWluKGV2ZW50LmNsaWVudFkgLSB0aGlzLmZsb2F0RHJhZ09mZlksIHdpbmRvdy5pbm5lckhlaWdodCAtIDYwKSk7XG4gIH1cblxuICBwcml2YXRlIG9uRmxvYXREcmFnRW5kKCk6IHZvaWQge1xuICAgIGlmICghdGhpcy5mbG9hdERyYWdnaW5nKSByZXR1cm47XG4gICAgdGhpcy5mbG9hdERyYWdnaW5nID0gZmFsc2U7XG4gICAgZG9jdW1lbnQuYm9keS5zdHlsZS51c2VyU2VsZWN0ID0gJyc7XG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgdGhpcy5ib3VuZEZsb2F0TW92ZSk7XG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIHRoaXMuYm91bmRGbG9hdEVuZCk7XG4gICAgdGhpcy5zYXZlRmxvYXRTdGF0ZSgpO1xuICB9XG5cbiAgLy8g4pSA4pSAIEZsb2F0aW5nIHBhbmVsIHJlc2l6ZSAoU0UgY29ybmVyKSDilIDilIBcbiAgb25GbG9hdFJlc2l6ZVN0YXJ0KGV2ZW50OiBNb3VzZUV2ZW50KTogdm9pZCB7XG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICB0aGlzLmZsb2F0UmVzaXppbmcgPSB0cnVlO1xuICAgIHRoaXMuZmxvYXRSZXNpemVTdGFydFggPSBldmVudC5jbGllbnRYO1xuICAgIHRoaXMuZmxvYXRSZXNpemVTdGFydFkgPSBldmVudC5jbGllbnRZO1xuICAgIHRoaXMuZmxvYXRSZXNpemVTdGFydFcgPSB0aGlzLmZsb2F0V2lkdGg7XG4gICAgdGhpcy5mbG9hdFJlc2l6ZVN0YXJ0SCA9IHRoaXMuZmxvYXRIZWlnaHQ7XG4gICAgZG9jdW1lbnQuYm9keS5zdHlsZS5jdXJzb3IgPSAnc2UtcmVzaXplJztcbiAgICBkb2N1bWVudC5ib2R5LnN0eWxlLnVzZXJTZWxlY3QgPSAnbm9uZSc7XG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgdGhpcy5ib3VuZEZsb2F0UmVzaXplTW92ZSk7XG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIHRoaXMuYm91bmRGbG9hdFJlc2l6ZUVuZCk7XG4gIH1cblxuICBwcml2YXRlIG9uRmxvYXRSZXNpemVNb3ZlKGV2ZW50OiBNb3VzZUV2ZW50KTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLmZsb2F0UmVzaXppbmcpIHJldHVybjtcbiAgICB0aGlzLmZsb2F0V2lkdGggID0gTWF0aC5tYXgoMjgwLCB0aGlzLmZsb2F0UmVzaXplU3RhcnRXICsgKGV2ZW50LmNsaWVudFggLSB0aGlzLmZsb2F0UmVzaXplU3RhcnRYKSk7XG4gICAgdGhpcy5mbG9hdEhlaWdodCA9IE1hdGgubWF4KDMyMCwgdGhpcy5mbG9hdFJlc2l6ZVN0YXJ0SCArIChldmVudC5jbGllbnRZIC0gdGhpcy5mbG9hdFJlc2l6ZVN0YXJ0WSkpO1xuICB9XG5cbiAgcHJpdmF0ZSBvbkZsb2F0UmVzaXplRW5kKCk6IHZvaWQge1xuICAgIGlmICghdGhpcy5mbG9hdFJlc2l6aW5nKSByZXR1cm47XG4gICAgdGhpcy5mbG9hdFJlc2l6aW5nID0gZmFsc2U7XG4gICAgZG9jdW1lbnQuYm9keS5zdHlsZS5jdXJzb3IgPSAnJztcbiAgICBkb2N1bWVudC5ib2R5LnN0eWxlLnVzZXJTZWxlY3QgPSAnJztcbiAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCB0aGlzLmJvdW5kRmxvYXRSZXNpemVNb3ZlKTtcbiAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgdGhpcy5ib3VuZEZsb2F0UmVzaXplRW5kKTtcbiAgICB0aGlzLnNhdmVGbG9hdFN0YXRlKCk7XG4gIH1cblxuICBwcml2YXRlIHNhdmVGbG9hdFN0YXRlKCk6IHZvaWQge1xuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdtZXNzYWdpbmdfZmxvYXRfc3RhdGUnLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpc0Zsb2F0aW5nOiB0aGlzLmlzRmxvYXRpbmcsXG4gICAgICB4OiB0aGlzLmZsb2F0WCxcbiAgICAgIHk6IHRoaXMuZmxvYXRZLFxuICAgICAgdzogdGhpcy5mbG9hdFdpZHRoLFxuICAgICAgaDogdGhpcy5mbG9hdEhlaWdodCxcbiAgICB9KSk7XG4gIH1cbn1cbiJdfQ==