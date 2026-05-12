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
  `, isInline: true, styles: [".sidebar{position:fixed;top:0;bottom:0;width:400px;background:#041322;z-index:9999;display:flex;flex-direction:column;box-shadow:0 0 40px #0009;transition:transform .3s cubic-bezier(.4,0,.2,1)}.sidebar.side-right{right:0;transform:translate(100%)}.sidebar.side-left{left:0;transform:translate(-100%)}.sidebar.open.side-right,.sidebar.open.side-left{transform:translate(0)}.resize-handle{position:absolute;top:0;bottom:0;width:5px;cursor:ew-resize;z-index:10;transition:background .15s}.resize-handle:hover,.resize-handle:active{background:#ffffff26}.resize-handle.handle-left{left:0}.resize-handle.handle-right{right:0}.sidebar-header{display:flex;align-items:center;justify-content:space-between;padding:12px 12px 12px 16px;border-bottom:1px solid rgba(255,255,255,.15);flex-shrink:0}.header-left{display:flex;align-items:center;gap:10px}.ces-logo-sm{width:28px;height:28px}.header-title{font-size:16px;font-weight:700;color:#fff;letter-spacing:.3px}.header-actions{display:flex;align-items:center;gap:0}.btn-spacer{width:12px}.hdr-btn{width:32px;height:32px;border-radius:6px!important;transition:background .15s,box-shadow .15s}.hdr-btn:hover{background:#ffffff26!important;box-shadow:0 2px 8px #0003}.hdr-btn mat-icon{font-size:20px;color:#ffffffd9}.sidebar-content{flex:1;overflow:hidden}.ws-status{display:flex;align-items:center;gap:6px;padding:6px 16px;font-size:11px;color:#fff9;border-top:1px solid rgba(255,255,255,.1);flex-shrink:0}.status-dot{width:6px;height:6px;border-radius:50%;background:#fff6}.ws-status.connected .status-dot{background:#22c55e}.ws-status.connecting .status-dot{background:#f59e0b;animation:blink 1s infinite}@keyframes blink{50%{opacity:.3}}.sidebar.floating{position:fixed!important;right:unset!important;left:80px;top:80px;transform:none!important;border-radius:12px;overflow:hidden;resize:none;min-width:280px;min-height:320px}.drag-handle{cursor:grab;-webkit-user-select:none;user-select:none}.drag-handle:active{cursor:grabbing}.float-resize-corner{position:absolute;bottom:0;right:0;width:16px;height:16px;cursor:se-resize;background:linear-gradient(135deg,transparent 50%,rgba(255,255,255,.25) 50%);border-bottom-right-radius:12px}@media (max-width: 480px){.sidebar{width:100%!important}.resize-handle{display:none}}\n"], dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i2.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "ngmodule", type: MatIconModule }, { kind: "component", type: i3.MatIcon, selector: "mat-icon", inputs: ["color", "inline", "svgIcon", "fontSet", "fontIcon"], exportAs: ["matIcon"] }, { kind: "ngmodule", type: MatButtonModule }, { kind: "component", type: i4.MatIconButton, selector: "button[mat-icon-button]", exportAs: ["matButton"] }, { kind: "ngmodule", type: MatTooltipModule }, { kind: "directive", type: i5.MatTooltip, selector: "[matTooltip]", inputs: ["matTooltipPosition", "matTooltipPositionAtOrigin", "matTooltipDisabled", "matTooltipShowDelay", "matTooltipHideDelay", "matTooltipTouchGestures", "matTooltip", "matTooltipClass"], exportAs: ["matTooltip"] }, { kind: "component", type: InboxListComponent, selector: "app-inbox-list" }, { kind: "component", type: ChatThreadComponent, selector: "app-chat-thread" }, { kind: "component", type: NewConversationComponent, selector: "app-new-conversation" }, { kind: "component", type: GroupManagerComponent, selector: "app-group-manager" }] });
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
  `, styles: [".sidebar{position:fixed;top:0;bottom:0;width:400px;background:#041322;z-index:9999;display:flex;flex-direction:column;box-shadow:0 0 40px #0009;transition:transform .3s cubic-bezier(.4,0,.2,1)}.sidebar.side-right{right:0;transform:translate(100%)}.sidebar.side-left{left:0;transform:translate(-100%)}.sidebar.open.side-right,.sidebar.open.side-left{transform:translate(0)}.resize-handle{position:absolute;top:0;bottom:0;width:5px;cursor:ew-resize;z-index:10;transition:background .15s}.resize-handle:hover,.resize-handle:active{background:#ffffff26}.resize-handle.handle-left{left:0}.resize-handle.handle-right{right:0}.sidebar-header{display:flex;align-items:center;justify-content:space-between;padding:12px 12px 12px 16px;border-bottom:1px solid rgba(255,255,255,.15);flex-shrink:0}.header-left{display:flex;align-items:center;gap:10px}.ces-logo-sm{width:28px;height:28px}.header-title{font-size:16px;font-weight:700;color:#fff;letter-spacing:.3px}.header-actions{display:flex;align-items:center;gap:0}.btn-spacer{width:12px}.hdr-btn{width:32px;height:32px;border-radius:6px!important;transition:background .15s,box-shadow .15s}.hdr-btn:hover{background:#ffffff26!important;box-shadow:0 2px 8px #0003}.hdr-btn mat-icon{font-size:20px;color:#ffffffd9}.sidebar-content{flex:1;overflow:hidden}.ws-status{display:flex;align-items:center;gap:6px;padding:6px 16px;font-size:11px;color:#fff9;border-top:1px solid rgba(255,255,255,.1);flex-shrink:0}.status-dot{width:6px;height:6px;border-radius:50%;background:#fff6}.ws-status.connected .status-dot{background:#22c55e}.ws-status.connecting .status-dot{background:#f59e0b;animation:blink 1s infinite}@keyframes blink{50%{opacity:.3}}.sidebar.floating{position:fixed!important;right:unset!important;left:80px;top:80px;transform:none!important;border-radius:12px;overflow:hidden;resize:none;min-width:280px;min-height:320px}.drag-handle{cursor:grab;-webkit-user-select:none;user-select:none}.drag-handle:active{cursor:grabbing}.float-resize-corner{position:absolute;bottom:0;right:0;width:16px;height:16px;cursor:se-resize;background:linear-gradient(135deg,transparent 50%,rgba(255,255,255,.25) 50%);border-bottom-right-radius:12px}@media (max-width: 480px){.sidebar{width:100%!important}.resize-handle{display:none}}\n"] }]
        }], ctorParameters: () => [{ type: i1.MessagingStoreService }] });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdC1wYW5lbC5jb21wb25lbnQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvbGliL2NvbXBvbmVudHMvY2hhdC1wYW5lbC9jaGF0LXBhbmVsLmNvbXBvbmVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsU0FBUyxFQUFxQixNQUFNLGVBQWUsQ0FBQztBQUM3RCxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDL0MsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLHdCQUF3QixDQUFDO0FBQ3ZELE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUMzRCxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSwyQkFBMkIsQ0FBQztBQUM3RCxPQUFPLEVBQWdCLGFBQWEsRUFBRSxNQUFNLE1BQU0sQ0FBQztBQUduRCxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUN4RSxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUMzRSxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUMxRixPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQzs7Ozs7OztBQXlSakYsTUFBTSxPQUFPLGtCQUFrQjtJQXVDVDtJQXRDcEIsTUFBTSxHQUFHLEtBQUssQ0FBQztJQUNmLFVBQVUsR0FBc0YsT0FBTyxDQUFDO0lBQ3hHLFFBQVEsR0FBVyxjQUFjLENBQUM7SUFDbEMsSUFBSSxHQUFnQixPQUFPLENBQUM7SUFDNUIsWUFBWSxHQUFHLEdBQUcsQ0FBQztJQUVuQiw4QkFBOEI7SUFDOUIsVUFBVSxHQUFHLEtBQUssQ0FBQztJQUNuQixNQUFNLEdBQUcsRUFBRSxDQUFDO0lBQ1osTUFBTSxHQUFHLEVBQUUsQ0FBQztJQUNaLFVBQVUsR0FBRyxHQUFHLENBQUM7SUFDakIsV0FBVyxH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RSxhQUFhLG1MQUFFLGVBQWUsMklBQUUsZ0JBQWdCLDZUQUM5RCxrQkFBa0IsMkRBQUUsbUJBQW1CLDREQUN2Qyx3QkFBd0IsaUVBQUUscUJBQXFCOzs0RkFpUnRDLGtCQUFrQjtrQkF2UjlCLFNBQVM7K0JBQ0UsZ0JBQWdCLGNBQ2QsSUFBSSxXQUNQO3dCQUNQLFlBQVksRUFBRSxhQUFhLEVBQUUsZUFBZSxFQUFFLGdCQUFnQjt3QkFDOUQsa0JBQWtCLEVBQUUsbUJBQW1CO3dCQUN2Qyx3QkFBd0IsRUFBRSxxQkFBcUI7cUJBQ2hELFlBQ1M7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBNkVUIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQ29tcG9uZW50LCBPbkluaXQsIE9uRGVzdHJveSB9IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xyXG5pbXBvcnQgeyBDb21tb25Nb2R1bGUgfSBmcm9tICdAYW5ndWxhci9jb21tb24nO1xyXG5pbXBvcnQgeyBNYXRJY29uTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvbWF0ZXJpYWwvaWNvbic7XHJcbmltcG9ydCB7IE1hdEJ1dHRvbk1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL21hdGVyaWFsL2J1dHRvbic7XHJcbmltcG9ydCB7IE1hdFRvb2x0aXBNb2R1bGUgfSBmcm9tICdAYW5ndWxhci9tYXRlcmlhbC90b29sdGlwJztcclxuaW1wb3J0IHsgU3Vic2NyaXB0aW9uLCBjb21iaW5lTGF0ZXN0IH0gZnJvbSAncnhqcyc7XHJcbmltcG9ydCB7IE1lc3NhZ2luZ1N0b3JlU2VydmljZSB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL21lc3NhZ2luZy1zdG9yZS5zZXJ2aWNlJztcclxuaW1wb3J0IHsgU2lkZWJhclNpZGUgfSBmcm9tICcuLi8uLi9tb2RlbHMvbWVzc2FnaW5nLm1vZGVscyc7XHJcbmltcG9ydCB7IEluYm94TGlzdENvbXBvbmVudCB9IGZyb20gJy4uL2luYm94LWxpc3QvaW5ib3gtbGlzdC5jb21wb25lbnQnO1xyXG5pbXBvcnQgeyBDaGF0VGhyZWFkQ29tcG9uZW50IH0gZnJvbSAnLi4vY2hhdC10aHJlYWQvY2hhdC10aHJlYWQuY29tcG9uZW50JztcclxuaW1wb3J0IHsgTmV3Q29udmVyc2F0aW9uQ29tcG9uZW50IH0gZnJvbSAnLi4vbmV3LWNvbnZlcnNhdGlvbi9uZXctY29udmVyc2F0aW9uLmNvbXBvbmVudCc7XHJcbmltcG9ydCB7IEdyb3VwTWFuYWdlckNvbXBvbmVudCB9IGZyb20gJy4uL2dyb3VwLW1hbmFnZXIvZ3JvdXAtbWFuYWdlci5jb21wb25lbnQnO1xyXG5cclxuQENvbXBvbmVudCh7XHJcbiAgc2VsZWN0b3I6ICdhcHAtY2hhdC1wYW5lbCcsXHJcbiAgc3RhbmRhbG9uZTogdHJ1ZSxcclxuICBpbXBvcnRzOiBbXHJcbiAgICBDb21tb25Nb2R1bGUsIE1hdEljb25Nb2R1bGUsIE1hdEJ1dHRvbk1vZHVsZSwgTWF0VG9vbHRpcE1vZHVsZSxcclxuICAgIEluYm94TGlzdENvbXBvbmVudCwgQ2hhdFRocmVhZENvbXBvbmVudCxcclxuICAgIE5ld0NvbnZlcnNhdGlvbkNvbXBvbmVudCwgR3JvdXBNYW5hZ2VyQ29tcG9uZW50LFxyXG4gIF0sXHJcbiAgdGVtcGxhdGU6IGBcclxuICAgIDwhLS0gU2lkZWJhciAvIEZsb2F0aW5nIHBhbmVsIC0tPlxyXG4gICAgPGRpdlxyXG4gICAgICBjbGFzcz1cInNpZGViYXJcIlxyXG4gICAgICBbY2xhc3Mub3Blbl09XCJpc09wZW5cIlxyXG4gICAgICBbY2xhc3Muc2lkZS1sZWZ0XT1cIiFpc0Zsb2F0aW5nICYmIHNpZGUgPT09ICdsZWZ0J1wiXHJcbiAgICAgIFtjbGFzcy5zaWRlLXJpZ2h0XT1cIiFpc0Zsb2F0aW5nICYmIHNpZGUgPT09ICdyaWdodCdcIlxyXG4gICAgICBbY2xhc3MuZmxvYXRpbmddPVwiaXNGbG9hdGluZ1wiXHJcbiAgICAgIFtzdHlsZS53aWR0aC5weF09XCJpc0Zsb2F0aW5nID8gZmxvYXRXaWR0aCA6IHNpZGViYXJXaWR0aFwiXHJcbiAgICAgIFtzdHlsZS5oZWlnaHQucHhdPVwiaXNGbG9hdGluZyA/IGZsb2F0SGVpZ2h0IDogbnVsbFwiXHJcbiAgICAgIFtzdHlsZS5sZWZ0LnB4XT1cImlzRmxvYXRpbmcgPyBmbG9hdFggOiBudWxsXCJcclxuICAgICAgW3N0eWxlLnRvcC5weF09XCJpc0Zsb2F0aW5nID8gZmxvYXRZIDogbnVsbFwiXHJcbiAgICA+XHJcbiAgICAgIDwhLS0gUmVzaXplIGhhbmRsZSAoc2lkZWJhciBtb2RlIG9ubHkpIC0tPlxyXG4gICAgICA8ZGl2XHJcbiAgICAgICAgKm5nSWY9XCIhaXNGbG9hdGluZ1wiXHJcbiAgICAgICAgY2xhc3M9XCJyZXNpemUtaGFuZGxlXCJcclxuICAgICAgICBbY2xhc3MuaGFuZGxlLWxlZnRdPVwic2lkZSA9PT0gJ3JpZ2h0J1wiXHJcbiAgICAgICAgW2NsYXNzLmhhbmRsZS1yaWdodF09XCJzaWRlID09PSAnbGVmdCdcIlxyXG4gICAgICAgIChtb3VzZWRvd24pPVwib25SZXNpemVTdGFydCgkZXZlbnQpXCJcclxuICAgICAgPjwvZGl2PlxyXG5cclxuICAgICAgPCEtLSBTaWRlYmFyIGhlYWRlciAoYWN0cyBhcyBkcmFnIGhhbmRsZSBpbiBmbG9hdGluZyBtb2RlKSAtLT5cclxuICAgICAgPGRpdlxyXG4gICAgICAgIGNsYXNzPVwic2lkZWJhci1oZWFkZXJcIlxyXG4gICAgICAgIFtjbGFzcy5kcmFnLWhhbmRsZV09XCJpc0Zsb2F0aW5nXCJcclxuICAgICAgICAobW91c2Vkb3duKT1cImlzRmxvYXRpbmcgJiYgb25GbG9hdERyYWdTdGFydCgkZXZlbnQpXCJcclxuICAgICAgPlxyXG4gICAgICAgIDxkaXYgY2xhc3M9XCJoZWFkZXItbGVmdFwiPlxyXG4gICAgICAgICAgPHN2ZyBjbGFzcz1cImNlcy1sb2dvLXNtXCIgdmlld0JveD1cIjAgMCAxMDAgMTAwXCIgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiPlxyXG4gICAgICAgICAgICA8cGF0aCBkPVwiTSAxNSAyMCBRIDE1IDE1IDIwIDE1IEwgODAgMTUgUSA4NSAxNSA4NSAyMCBMIDg1IDYwIFEgODUgNjUgODAgNjUgTCAzNSA2NSBMIDIwIDgwIEwgMjAgNjUgUSAxNSA2NSAxNSA2MCBaXCJcclxuICAgICAgICAgICAgICAgICAgZmlsbD1cIm5vbmVcIiBzdHJva2U9XCJ3aGl0ZVwiIHN0cm9rZS13aWR0aD1cIjNcIi8+XHJcbiAgICAgICAgICAgIDxnIHRyYW5zZm9ybT1cInRyYW5zbGF0ZSg1MCwgNDApIHNjYWxlKDAuMzUpXCI+XHJcbiAgICAgICAgICAgICAgPHBhdGggZD1cIk0gMCwtMzAgTCAyNSwtMTUgTCAyNSwxNSBMIDAsMzAgTCAtMjUsMTUgTCAtMjUsLTE1IFpcIiBmaWxsPVwid2hpdGVcIi8+XHJcbiAgICAgICAgICAgIDwvZz5cclxuICAgICAgICAgIDwvc3ZnPlxyXG4gICAgICAgICAgPHNwYW4gY2xhc3M9XCJoZWFkZXItdGl0bGVcIj5DRVMgTWVzc2VuZ2VyPC9zcGFuPlxyXG4gICAgICAgIDwvZGl2PlxyXG4gICAgICAgIDxkaXYgY2xhc3M9XCJoZWFkZXItYWN0aW9uc1wiPlxyXG4gICAgICAgICAgPCEtLSBTaWRlLXN3YXAgKHNpZGViYXIgbW9kZSBvbmx5KSAtLT5cclxuICAgICAgICAgIDxidXR0b24gKm5nSWY9XCIhaXNGbG9hdGluZ1wiIG1hdC1pY29uLWJ1dHRvbiBjbGFzcz1cImhkci1idG5cIiAoY2xpY2spPVwidG9nZ2xlU2lkZSgpXCJcclxuICAgICAgICAgICAgW21hdFRvb2x0aXBdPVwiJ01vdmUgdG8gJyArIChzaWRlID09PSAncmlnaHQnID8gJ2xlZnQnIDogJ3JpZ2h0JylcIiBtYXRUb29sdGlwUG9zaXRpb249XCJiZWxvd1wiPlxyXG4gICAgICAgICAgICA8bWF0LWljb24+e3sgc2lkZSA9PT0gJ3JpZ2h0JyA/ICdjaGV2cm9uX2xlZnQnIDogJ2NoZXZyb25fcmlnaHQnIH19PC9tYXQtaWNvbj5cclxuICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgPCEtLSBQb3Atb3V0IC8gZG9jayB0b2dnbGUgLS0+XHJcbiAgICAgICAgICA8YnV0dG9uIG1hdC1pY29uLWJ1dHRvbiBjbGFzcz1cImhkci1idG5cIlxyXG4gICAgICAgICAgICAoY2xpY2spPVwidG9nZ2xlRmxvYXQoKVwiXHJcbiAgICAgICAgICAgIFttYXRUb29sdGlwXT1cImlzRmxvYXRpbmcgPyAnRG9jayB0byBzaWRlYmFyJyA6ICdQb3Agb3V0IHRvIGZsb2F0aW5nIHdpbmRvdydcIlxyXG4gICAgICAgICAgICBtYXRUb29sdGlwUG9zaXRpb249XCJiZWxvd1wiPlxyXG4gICAgICAgICAgICA8bWF0LWljb24+e3sgaXNGbG9hdGluZyA/ICdwaWN0dXJlX2luX3BpY3R1cmVfYWx0JyA6ICdvcGVuX2luX25ldycgfX08L21hdC1pY29uPlxyXG4gICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICA8ZGl2IGNsYXNzPVwiYnRuLXNwYWNlclwiPjwvZGl2PlxyXG4gICAgICAgICAgPGJ1dHRvbiBtYXQtaWNvbi1idXR0b24gY2xhc3M9XCJoZHItYnRuXCIgKGNsaWNrKT1cImNsb3NlKClcIiBtYXRUb29sdGlwPVwiQ2xvc2UgbWVzc2VuZ2VyXCIgbWF0VG9vbHRpcFBvc2l0aW9uPVwiYmVsb3dcIj5cclxuICAgICAgICAgICAgPG1hdC1pY29uPmNsb3NlPC9tYXQtaWNvbj5cclxuICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgIDwvZGl2PlxyXG4gICAgICA8L2Rpdj5cclxuXHJcbiAgICAgIDwhLS0gVmlldyBjb250YWluZXIgLS0+XHJcbiAgICAgIDxkaXYgY2xhc3M9XCJzaWRlYmFyLWNvbnRlbnRcIj5cclxuICAgICAgICA8YXBwLWluYm94LWxpc3QgKm5nSWY9XCJhY3RpdmVWaWV3ID09PSAnaW5ib3gnXCI+PC9hcHAtaW5ib3gtbGlzdD5cclxuICAgICAgICA8YXBwLWNoYXQtdGhyZWFkICpuZ0lmPVwiYWN0aXZlVmlldyA9PT0gJ2NoYXQnXCI+PC9hcHAtY2hhdC10aHJlYWQ+XHJcbiAgICAgICAgPGFwcC1uZXctY29udmVyc2F0aW9uICpuZ0lmPVwiYWN0aXZlVmlldyA9PT0gJ25ldy1jb252ZXJzYXRpb24nXCI+PC9hcHAtbmV3LWNvbnZlcnNhdGlvbj5cclxuICAgICAgICA8YXBwLWdyb3VwLW1hbmFnZXIgKm5nSWY9XCJhY3RpdmVWaWV3ID09PSAnZ3JvdXAtbWFuYWdlcidcIj48L2FwcC1ncm91cC1tYW5hZ2VyPlxyXG4gICAgICA8L2Rpdj5cclxuXHJcbiAgICAgIDwhLS0gU3RhdHVzIGJhciAtLT5cclxuICAgICAgPGRpdiBjbGFzcz1cIndzLXN0YXR1c1wiIFtjbGFzcy5jb25uZWN0ZWRdPVwid3NTdGF0dXMgPT09ICdhdXRoZW50aWNhdGVkJ1wiIFtjbGFzcy5jb25uZWN0aW5nXT1cIndzU3RhdHVzID09PSAnY29ubmVjdGluZydcIj5cclxuICAgICAgICA8ZGl2IGNsYXNzPVwic3RhdHVzLWRvdFwiPjwvZGl2PlxyXG4gICAgICAgIDxzcGFuICpuZ0lmPVwid3NTdGF0dXMgPT09ICdhdXRoZW50aWNhdGVkJ1wiPkNvbm5lY3RlZDwvc3Bhbj5cclxuICAgICAgICA8c3BhbiAqbmdJZj1cIndzU3RhdHVzID09PSAnY29ubmVjdGluZydcIj5Db25uZWN0aW5nLi4uPC9zcGFuPlxyXG4gICAgICAgIDxzcGFuICpuZ0lmPVwid3NTdGF0dXMgPT09ICdkaXNjb25uZWN0ZWQnXCI+RGlzY29ubmVjdGVkPC9zcGFuPlxyXG4gICAgICA8L2Rpdj5cclxuXHJcbiAgICAgIDwhLS0gUmVzaXplIGNvcm5lciAoZmxvYXRpbmcgbW9kZSBvbmx5KSAtLT5cclxuICAgICAgPGRpdiAqbmdJZj1cImlzRmxvYXRpbmdcIiBjbGFzcz1cImZsb2F0LXJlc2l6ZS1jb3JuZXJcIiAobW91c2Vkb3duKT1cIm9uRmxvYXRSZXNpemVTdGFydCgkZXZlbnQpXCI+PC9kaXY+XHJcbiAgICA8L2Rpdj5cclxuICBgLFxyXG4gIHN0eWxlczogW2BcclxuICAgIC5zaWRlYmFyIHtcclxuICAgICAgcG9zaXRpb246IGZpeGVkO1xyXG4gICAgICB0b3A6IDA7XHJcbiAgICAgIGJvdHRvbTogMDtcclxuICAgICAgd2lkdGg6IDQwMHB4O1xyXG4gICAgICBiYWNrZ3JvdW5kOiAjMDQxMzIyO1xyXG4gICAgICB6LWluZGV4OiA5OTk5O1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xyXG4gICAgICBib3gtc2hhZG93OiAwIDAgNDBweCByZ2JhKDAsIDAsIDAsIDAuNik7XHJcbiAgICAgIHRyYW5zaXRpb246IHRyYW5zZm9ybSAwLjNzIGN1YmljLWJlemllcigwLjQsIDAsIDAuMiwgMSk7XHJcbiAgICB9XHJcblxyXG4gICAgLnNpZGViYXIuc2lkZS1yaWdodCB7XHJcbiAgICAgIHJpZ2h0OiAwO1xyXG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVgoMTAwJSk7XHJcbiAgICB9XHJcblxyXG4gICAgLnNpZGViYXIuc2lkZS1sZWZ0IHtcclxuICAgICAgbGVmdDogMDtcclxuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVYKC0xMDAlKTtcclxuICAgIH1cclxuXHJcbiAgICAuc2lkZWJhci5vcGVuLnNpZGUtcmlnaHQge1xyXG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVgoMCk7XHJcbiAgICB9XHJcblxyXG4gICAgLnNpZGViYXIub3Blbi5zaWRlLWxlZnQge1xyXG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVgoMCk7XHJcbiAgICB9XHJcblxyXG4gICAgLyog4pSA4pSAIFJlc2l6ZSBoYW5kbGUg4pSA4pSAICovXHJcbiAgICAucmVzaXplLWhhbmRsZSB7XHJcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcclxuICAgICAgdG9wOiAwO1xyXG4gICAgICBib3R0b206IDA7XHJcbiAgICAgIHdpZHRoOiA1cHg7XHJcbiAgICAgIGN1cnNvcjogZXctcmVzaXplO1xyXG4gICAgICB6LWluZGV4OiAxMDtcclxuICAgICAgdHJhbnNpdGlvbjogYmFja2dyb3VuZCAwLjE1cztcclxuICAgIH1cclxuXHJcbiAgICAucmVzaXplLWhhbmRsZTpob3ZlcixcclxuICAgIC5yZXNpemUtaGFuZGxlOmFjdGl2ZSB7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xNSk7XHJcbiAgICB9XHJcblxyXG4gICAgLnJlc2l6ZS1oYW5kbGUuaGFuZGxlLWxlZnQge1xyXG4gICAgICBsZWZ0OiAwO1xyXG4gICAgfVxyXG5cclxuICAgIC5yZXNpemUtaGFuZGxlLmhhbmRsZS1yaWdodCB7XHJcbiAgICAgIHJpZ2h0OiAwO1xyXG4gICAgfVxyXG5cclxuICAgIC8qIOKUgOKUgCBIZWFkZXIg4pSA4pSAICovXHJcbiAgICAuc2lkZWJhci1oZWFkZXIge1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWJldHdlZW47XHJcbiAgICAgIHBhZGRpbmc6IDEycHggMTJweCAxMnB4IDE2cHg7XHJcbiAgICAgIGJvcmRlci1ib3R0b206IDFweCBzb2xpZCByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMTUpO1xyXG4gICAgICBmbGV4LXNocmluazogMDtcclxuICAgIH1cclxuXHJcbiAgICAuaGVhZGVyLWxlZnQge1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBnYXA6IDEwcHg7XHJcbiAgICB9XHJcblxyXG4gICAgLmNlcy1sb2dvLXNtIHtcclxuICAgICAgd2lkdGg6IDI4cHg7XHJcbiAgICAgIGhlaWdodDogMjhweDtcclxuICAgIH1cclxuXHJcbiAgICAuaGVhZGVyLXRpdGxlIHtcclxuICAgICAgZm9udC1zaXplOiAxNnB4O1xyXG4gICAgICBmb250LXdlaWdodDogNzAwO1xyXG4gICAgICBjb2xvcjogI2ZmZjtcclxuICAgICAgbGV0dGVyLXNwYWNpbmc6IDAuM3B4O1xyXG4gICAgfVxyXG5cclxuICAgIC5oZWFkZXItYWN0aW9ucyB7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgIGdhcDogMDtcclxuICAgIH1cclxuXHJcbiAgICAuYnRuLXNwYWNlciB7XHJcbiAgICAgIHdpZHRoOiAxMnB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5oZHItYnRuIHtcclxuICAgICAgd2lkdGg6IDMycHg7XHJcbiAgICAgIGhlaWdodDogMzJweDtcclxuICAgICAgYm9yZGVyLXJhZGl1czogNnB4ICFpbXBvcnRhbnQ7XHJcbiAgICAgIHRyYW5zaXRpb246IGJhY2tncm91bmQgMC4xNXMsIGJveC1zaGFkb3cgMC4xNXM7XHJcbiAgICB9XHJcblxyXG4gICAgLmhkci1idG46aG92ZXIge1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMTUpICFpbXBvcnRhbnQ7XHJcbiAgICAgIGJveC1zaGFkb3c6IDAgMnB4IDhweCByZ2JhKDAsIDAsIDAsIDAuMik7XHJcbiAgICB9XHJcblxyXG4gICAgLmhkci1idG4gbWF0LWljb24ge1xyXG4gICAgICBmb250LXNpemU6IDIwcHg7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuODUpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qIOKUgOKUgCBDb250ZW50IOKUgOKUgCAqL1xyXG4gICAgLnNpZGViYXItY29udGVudCB7XHJcbiAgICAgIGZsZXg6IDE7XHJcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XHJcbiAgICB9XHJcblxyXG4gICAgLyog4pSA4pSAIFN0YXR1cyBiYXIg4pSA4pSAICovXHJcbiAgICAud3Mtc3RhdHVzIHtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAgZ2FwOiA2cHg7XHJcbiAgICAgIHBhZGRpbmc6IDZweCAxNnB4O1xyXG4gICAgICBmb250LXNpemU6IDExcHg7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNik7XHJcbiAgICAgIGJvcmRlci10b3A6IDFweCBzb2xpZCByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMSk7XHJcbiAgICAgIGZsZXgtc2hyaW5rOiAwO1xyXG4gICAgfVxyXG5cclxuICAgIC5zdGF0dXMtZG90IHtcclxuICAgICAgd2lkdGg6IDZweDtcclxuICAgICAgaGVpZ2h0OiA2cHg7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDUwJTtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjQpO1xyXG4gICAgfVxyXG5cclxuICAgIC53cy1zdGF0dXMuY29ubmVjdGVkIC5zdGF0dXMtZG90IHtcclxuICAgICAgYmFja2dyb3VuZDogIzIyYzU1ZTtcclxuICAgIH1cclxuXHJcbiAgICAud3Mtc3RhdHVzLmNvbm5lY3RpbmcgLnN0YXR1cy1kb3Qge1xyXG4gICAgICBiYWNrZ3JvdW5kOiAjZjU5ZTBiO1xyXG4gICAgICBhbmltYXRpb246IGJsaW5rIDFzIGluZmluaXRlO1xyXG4gICAgfVxyXG5cclxuICAgIEBrZXlmcmFtZXMgYmxpbmsge1xyXG4gICAgICA1MCUgeyBvcGFjaXR5OiAwLjM7IH1cclxuICAgIH1cclxuXHJcbiAgICAvKiDilIDilIAgRmxvYXRpbmcgbW9kZSDilIDilIAgKi9cclxuICAgIC5zaWRlYmFyLmZsb2F0aW5nIHtcclxuICAgICAgcG9zaXRpb246IGZpeGVkICFpbXBvcnRhbnQ7XHJcbiAgICAgIHJpZ2h0OiB1bnNldCAhaW1wb3J0YW50O1xyXG4gICAgICBsZWZ0OiA4MHB4O1xyXG4gICAgICB0b3A6IDgwcHg7XHJcbiAgICAgIHRyYW5zZm9ybTogbm9uZSAhaW1wb3J0YW50O1xyXG4gICAgICBib3JkZXItcmFkaXVzOiAxMnB4O1xyXG4gICAgICBvdmVyZmxvdzogaGlkZGVuO1xyXG4gICAgICByZXNpemU6IG5vbmU7XHJcbiAgICAgIG1pbi13aWR0aDogMjgwcHg7XHJcbiAgICAgIG1pbi1oZWlnaHQ6IDMyMHB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5kcmFnLWhhbmRsZSB7XHJcbiAgICAgIGN1cnNvcjogZ3JhYjtcclxuICAgICAgdXNlci1zZWxlY3Q6IG5vbmU7XHJcbiAgICB9XHJcblxyXG4gICAgLmRyYWctaGFuZGxlOmFjdGl2ZSB7XHJcbiAgICAgIGN1cnNvcjogZ3JhYmJpbmc7XHJcbiAgICB9XHJcblxyXG4gICAgLmZsb2F0LXJlc2l6ZS1jb3JuZXIge1xyXG4gICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XHJcbiAgICAgIGJvdHRvbTogMDtcclxuICAgICAgcmlnaHQ6IDA7XHJcbiAgICAgIHdpZHRoOiAxNnB4O1xyXG4gICAgICBoZWlnaHQ6IDE2cHg7XHJcbiAgICAgIGN1cnNvcjogc2UtcmVzaXplO1xyXG4gICAgICBiYWNrZ3JvdW5kOiBsaW5lYXItZ3JhZGllbnQoMTM1ZGVnLCB0cmFuc3BhcmVudCA1MCUsIHJnYmEoMjU1LDI1NSwyNTUsMC4yNSkgNTAlKTtcclxuICAgICAgYm9yZGVyLWJvdHRvbS1yaWdodC1yYWRpdXM6IDEycHg7XHJcbiAgICB9XHJcblxyXG4gICAgQG1lZGlhIChtYXgtd2lkdGg6IDQ4MHB4KSB7XHJcbiAgICAgIC5zaWRlYmFyIHtcclxuICAgICAgICB3aWR0aDogMTAwJSAhaW1wb3J0YW50O1xyXG4gICAgICB9XHJcbiAgICAgIC5yZXNpemUtaGFuZGxlIHtcclxuICAgICAgICBkaXNwbGF5OiBub25lO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgYF0sXHJcbn0pXHJcbmV4cG9ydCBjbGFzcyBDaGF0UGFuZWxDb21wb25lbnQgaW1wbGVtZW50cyBPbkluaXQsIE9uRGVzdHJveSB7XHJcbiAgaXNPcGVuID0gZmFsc2U7XHJcbiAgYWN0aXZlVmlldzogJ2luYm94JyB8ICdjaGF0JyB8ICduZXctY29udmVyc2F0aW9uJyB8ICdncm91cC1tYW5hZ2VyJyB8ICdjb252ZXJzYXRpb24tc2V0dGluZ3MnID0gJ2luYm94JztcclxuICB3c1N0YXR1czogc3RyaW5nID0gJ2Rpc2Nvbm5lY3RlZCc7XHJcbiAgc2lkZTogU2lkZWJhclNpZGUgPSAncmlnaHQnO1xyXG4gIHNpZGViYXJXaWR0aCA9IDQwMDtcclxuXHJcbiAgLy8g4pSA4pSAIEZsb2F0aW5nIHdpbmRvdyBzdGF0ZSDilIDilIBcclxuICBpc0Zsb2F0aW5nID0gZmFsc2U7XHJcbiAgZmxvYXRYID0gODA7XHJcbiAgZmxvYXRZID0gODA7XHJcbiAgZmxvYXRXaWR0aCA9IDM4MDtcclxuICBmbG9hdEhlaWdodCA9IDU0MDtcclxuXHJcbiAgcHJpdmF0ZSBkZWZhdWx0V2lkdGggPSA0MDA7XHJcbiAgcHJpdmF0ZSByZXNpemluZyA9IGZhbHNlO1xyXG4gIHByaXZhdGUgcmVzaXplU3RhcnRYID0gMDtcclxuICBwcml2YXRlIHJlc2l6ZVN0YXJ0V2lkdGggPSAwO1xyXG4gIHByaXZhdGUgYm91bmRSZXNpemVNb3ZlID0gdGhpcy5vblJlc2l6ZU1vdmUuYmluZCh0aGlzKTtcclxuICBwcml2YXRlIGJvdW5kUmVzaXplRW5kID0gdGhpcy5vblJlc2l6ZUVuZC5iaW5kKHRoaXMpO1xyXG5cclxuICAvLyBmbG9hdCBkcmFnXHJcbiAgcHJpdmF0ZSBmbG9hdERyYWdnaW5nID0gZmFsc2U7XHJcbiAgcHJpdmF0ZSBmbG9hdERyYWdPZmZYID0gMDtcclxuICBwcml2YXRlIGZsb2F0RHJhZ09mZlkgPSAwO1xyXG4gIHByaXZhdGUgYm91bmRGbG9hdE1vdmUgPSB0aGlzLm9uRmxvYXREcmFnTW92ZS5iaW5kKHRoaXMpO1xyXG4gIHByaXZhdGUgYm91bmRGbG9hdEVuZCAgPSB0aGlzLm9uRmxvYXREcmFnRW5kLmJpbmQodGhpcyk7XHJcblxyXG4gIC8vIGZsb2F0IHJlc2l6ZVxyXG4gIHByaXZhdGUgZmxvYXRSZXNpemluZyA9IGZhbHNlO1xyXG4gIHByaXZhdGUgZmxvYXRSZXNpemVTdGFydFggPSAwO1xyXG4gIHByaXZhdGUgZmxvYXRSZXNpemVTdGFydFkgPSAwO1xyXG4gIHByaXZhdGUgZmxvYXRSZXNpemVTdGFydFcgPSAwO1xyXG4gIHByaXZhdGUgZmxvYXRSZXNpemVTdGFydEggPSAwO1xyXG4gIHByaXZhdGUgYm91bmRGbG9hdFJlc2l6ZU1vdmUgPSB0aGlzLm9uRmxvYXRSZXNpemVNb3ZlLmJpbmQodGhpcyk7XHJcbiAgcHJpdmF0ZSBib3VuZEZsb2F0UmVzaXplRW5kICA9IHRoaXMub25GbG9hdFJlc2l6ZUVuZC5iaW5kKHRoaXMpO1xyXG5cclxuICBwcml2YXRlIHN1YiE6IFN1YnNjcmlwdGlvbjtcclxuXHJcbiAgY29uc3RydWN0b3IocHJpdmF0ZSBzdG9yZTogTWVzc2FnaW5nU3RvcmVTZXJ2aWNlKSB7fVxyXG5cclxuICBuZ09uSW5pdCgpOiB2b2lkIHtcclxuICAgIHRoaXMuc2lkZSA9IHRoaXMuc3RvcmUuZ2V0U2lkZWJhclNpZGUoKTtcclxuICAgIGNvbnN0IHNhdmVkID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ21lc3NhZ2luZ19zaWRlYmFyX3dpZHRoJyk7XHJcbiAgICBpZiAoc2F2ZWQpIHRoaXMuc2lkZWJhcldpZHRoID0gcGFyc2VJbnQoc2F2ZWQsIDEwKSB8fCB0aGlzLmRlZmF1bHRXaWR0aDtcclxuXHJcbiAgICBjb25zdCBzYXZlZEZsb2F0ID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ21lc3NhZ2luZ19mbG9hdF9zdGF0ZScpO1xyXG4gICAgaWYgKHNhdmVkRmxvYXQpIHtcclxuICAgICAgdHJ5IHtcclxuICAgICAgICBjb25zdCBmID0gSlNPTi5wYXJzZShzYXZlZEZsb2F0KTtcclxuICAgICAgICB0aGlzLmlzRmxvYXRpbmcgPSBmLmlzRmxvYXRpbmcgPz8gZmFsc2U7XHJcbiAgICAgICAgdGhpcy5mbG9hdFggPSBmLnggPz8gODA7XHJcbiAgICAgICAgdGhpcy5mbG9hdFkgPSBmLnkgPz8gODA7XHJcbiAgICAgICAgdGhpcy5mbG9hdFdpZHRoID0gZi53ID8/IDM4MDtcclxuICAgICAgICB0aGlzLmZsb2F0SGVpZ2h0ID0gZi5oID8/IDU0MDtcclxuICAgICAgfSBjYXRjaCB7fVxyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuc3ViID0gY29tYmluZUxhdGVzdChbXHJcbiAgICAgIHRoaXMuc3RvcmUucGFuZWxPcGVuLFxyXG4gICAgICB0aGlzLnN0b3JlLmFjdGl2ZVZpZXcsXHJcbiAgICAgIHRoaXMuc3RvcmUud3NTdGF0dXMsXHJcbiAgICAgIHRoaXMuc3RvcmUuc2lkZWJhclNpZGUsXHJcbiAgICBdKS5zdWJzY3JpYmUoKFtvcGVuLCB2aWV3LCB3cywgc2lkZV0pID0+IHtcclxuICAgICAgdGhpcy5pc09wZW4gPSBvcGVuO1xyXG4gICAgICB0aGlzLmFjdGl2ZVZpZXcgPSB2aWV3O1xyXG4gICAgICB0aGlzLndzU3RhdHVzID0gd3M7XHJcbiAgICAgIHRoaXMuc2lkZSA9IHNpZGU7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIG5nT25EZXN0cm95KCk6IHZvaWQge1xyXG4gICAgdGhpcy5zdWI/LnVuc3Vic2NyaWJlKCk7XHJcbiAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCB0aGlzLmJvdW5kUmVzaXplTW92ZSk7XHJcbiAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgdGhpcy5ib3VuZFJlc2l6ZUVuZCk7XHJcbiAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCB0aGlzLmJvdW5kRmxvYXRNb3ZlKTtcclxuICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCB0aGlzLmJvdW5kRmxvYXRFbmQpO1xyXG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgdGhpcy5ib3VuZEZsb2F0UmVzaXplTW92ZSk7XHJcbiAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgdGhpcy5ib3VuZEZsb2F0UmVzaXplRW5kKTtcclxuICB9XHJcblxyXG4gIHRvZ2dsZVNpZGUoKTogdm9pZCB7XHJcbiAgICB0aGlzLnN0b3JlLnRvZ2dsZVNpZGViYXJTaWRlKCk7XHJcbiAgfVxyXG5cclxuICBjbG9zZSgpOiB2b2lkIHtcclxuICAgIHRoaXMuc3RvcmUuY2xvc2VQYW5lbCgpO1xyXG4gIH1cclxuXHJcbiAgdG9nZ2xlRmxvYXQoKTogdm9pZCB7XHJcbiAgICB0aGlzLmlzRmxvYXRpbmcgPSAhdGhpcy5pc0Zsb2F0aW5nO1xyXG4gICAgaWYgKHRoaXMuaXNGbG9hdGluZykge1xyXG4gICAgICAvLyBDZW50cmUgdGhlIGZsb2F0IHdpbmRvdyBvbiBzY3JlZW4gd2hlbiBmaXJzdCBwb3BwaW5nIG91dFxyXG4gICAgICB0aGlzLmZsb2F0WCA9IE1hdGgubWF4KDIwLCBNYXRoLnJvdW5kKCh3aW5kb3cuaW5uZXJXaWR0aCAgLSB0aGlzLmZsb2F0V2lkdGgpICAvIDIpKTtcclxuICAgICAgdGhpcy5mbG9hdFkgPSBNYXRoLm1heCgyMCwgTWF0aC5yb3VuZCgod2luZG93LmlubmVySGVpZ2h0IC0gdGhpcy5mbG9hdEhlaWdodCkgLyAyKSk7XHJcbiAgICB9XHJcbiAgICB0aGlzLnNhdmVGbG9hdFN0YXRlKCk7XHJcbiAgfVxyXG5cclxuICAvLyDilIDilIAgU2lkZWJhciByZXNpemUg4pSA4pSAXHJcbiAgb25SZXNpemVTdGFydChldmVudDogTW91c2VFdmVudCk6IHZvaWQge1xyXG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuICAgIHRoaXMucmVzaXppbmcgPSB0cnVlO1xyXG4gICAgdGhpcy5yZXNpemVTdGFydFggPSBldmVudC5jbGllbnRYO1xyXG4gICAgdGhpcy5yZXNpemVTdGFydFdpZHRoID0gdGhpcy5zaWRlYmFyV2lkdGg7XHJcbiAgICBkb2N1bWVudC5ib2R5LnN0eWxlLmN1cnNvciA9ICdldy1yZXNpemUnO1xyXG4gICAgZG9jdW1lbnQuYm9keS5zdHlsZS51c2VyU2VsZWN0ID0gJ25vbmUnO1xyXG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgdGhpcy5ib3VuZFJlc2l6ZU1vdmUpO1xyXG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIHRoaXMuYm91bmRSZXNpemVFbmQpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBvblJlc2l6ZU1vdmUoZXZlbnQ6IE1vdXNlRXZlbnQpOiB2b2lkIHtcclxuICAgIGlmICghdGhpcy5yZXNpemluZykgcmV0dXJuO1xyXG4gICAgY29uc3QgZHggPSBldmVudC5jbGllbnRYIC0gdGhpcy5yZXNpemVTdGFydFg7XHJcbiAgICBpZiAodGhpcy5zaWRlID09PSAncmlnaHQnKSB7XHJcbiAgICAgIHRoaXMuc2lkZWJhcldpZHRoID0gTWF0aC5tYXgoMjAwLCB0aGlzLnJlc2l6ZVN0YXJ0V2lkdGggLSBkeCk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICB0aGlzLnNpZGViYXJXaWR0aCA9IE1hdGgubWF4KDIwMCwgdGhpcy5yZXNpemVTdGFydFdpZHRoICsgZHgpO1xyXG4gICAgfVxyXG4gICAgdGhpcy5zaWRlYmFyV2lkdGggPSBNYXRoLm1pbih0aGlzLnNpZGViYXJXaWR0aCwgd2luZG93LmlubmVyV2lkdGggKiAwLjkpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBvblJlc2l6ZUVuZCgpOiB2b2lkIHtcclxuICAgIGlmICghdGhpcy5yZXNpemluZykgcmV0dXJuO1xyXG4gICAgdGhpcy5yZXNpemluZyA9IGZhbHNlO1xyXG4gICAgZG9jdW1lbnQuYm9keS5zdHlsZS5jdXJzb3IgPSAnJztcclxuICAgIGRvY3VtZW50LmJvZHkuc3R5bGUudXNlclNlbGVjdCA9ICcnO1xyXG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgdGhpcy5ib3VuZFJlc2l6ZU1vdmUpO1xyXG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIHRoaXMuYm91bmRSZXNpemVFbmQpO1xyXG4gICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ21lc3NhZ2luZ19zaWRlYmFyX3dpZHRoJywgU3RyaW5nKHRoaXMuc2lkZWJhcldpZHRoKSk7XHJcbiAgfVxyXG5cclxuICAvLyDilIDilIAgRmxvYXRpbmcgcGFuZWwgZHJhZyDilIDilIBcclxuICBvbkZsb2F0RHJhZ1N0YXJ0KGV2ZW50OiBNb3VzZUV2ZW50KTogdm9pZCB7XHJcbiAgICAvLyBJZ25vcmUgaWYgY29taW5nIGZyb20gYSBidXR0b24gaW5zaWRlIHRoZSBoZWFkZXJcclxuICAgIGlmICgoZXZlbnQudGFyZ2V0IGFzIEhUTUxFbGVtZW50KS5jbG9zZXN0KCdidXR0b24nKSkgcmV0dXJuO1xyXG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuICAgIHRoaXMuZmxvYXREcmFnZ2luZyA9IHRydWU7XHJcbiAgICB0aGlzLmZsb2F0RHJhZ09mZlggPSBldmVudC5jbGllbnRYIC0gdGhpcy5mbG9hdFg7XHJcbiAgICB0aGlzLmZsb2F0RHJhZ09mZlkgPSBldmVudC5jbGllbnRZIC0gdGhpcy5mbG9hdFk7XHJcbiAgICBkb2N1bWVudC5ib2R5LnN0eWxlLnVzZXJTZWxlY3QgPSAnbm9uZSc7XHJcbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCB0aGlzLmJvdW5kRmxvYXRNb3ZlKTtcclxuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCB0aGlzLmJvdW5kRmxvYXRFbmQpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBvbkZsb2F0RHJhZ01vdmUoZXZlbnQ6IE1vdXNlRXZlbnQpOiB2b2lkIHtcclxuICAgIGlmICghdGhpcy5mbG9hdERyYWdnaW5nKSByZXR1cm47XHJcbiAgICB0aGlzLmZsb2F0WCA9IE1hdGgubWF4KDAsIE1hdGgubWluKGV2ZW50LmNsaWVudFggLSB0aGlzLmZsb2F0RHJhZ09mZlgsIHdpbmRvdy5pbm5lcldpZHRoICAtIHRoaXMuZmxvYXRXaWR0aCkpO1xyXG4gICAgdGhpcy5mbG9hdFkgPSBNYXRoLm1heCgwLCBNYXRoLm1pbihldmVudC5jbGllbnRZIC0gdGhpcy5mbG9hdERyYWdPZmZZLCB3aW5kb3cuaW5uZXJIZWlnaHQgLSA2MCkpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBvbkZsb2F0RHJhZ0VuZCgpOiB2b2lkIHtcclxuICAgIGlmICghdGhpcy5mbG9hdERyYWdnaW5nKSByZXR1cm47XHJcbiAgICB0aGlzLmZsb2F0RHJhZ2dpbmcgPSBmYWxzZTtcclxuICAgIGRvY3VtZW50LmJvZHkuc3R5bGUudXNlclNlbGVjdCA9ICcnO1xyXG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgdGhpcy5ib3VuZEZsb2F0TW92ZSk7XHJcbiAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgdGhpcy5ib3VuZEZsb2F0RW5kKTtcclxuICAgIHRoaXMuc2F2ZUZsb2F0U3RhdGUoKTtcclxuICB9XHJcblxyXG4gIC8vIOKUgOKUgCBGbG9hdGluZyBwYW5lbCByZXNpemUgKFNFIGNvcm5lcikg4pSA4pSAXHJcbiAgb25GbG9hdFJlc2l6ZVN0YXJ0KGV2ZW50OiBNb3VzZUV2ZW50KTogdm9pZCB7XHJcbiAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XHJcbiAgICB0aGlzLmZsb2F0UmVzaXppbmcgPSB0cnVlO1xyXG4gICAgdGhpcy5mbG9hdFJlc2l6ZVN0YXJ0WCA9IGV2ZW50LmNsaWVudFg7XHJcbiAgICB0aGlzLmZsb2F0UmVzaXplU3RhcnRZID0gZXZlbnQuY2xpZW50WTtcclxuICAgIHRoaXMuZmxvYXRSZXNpemVTdGFydFcgPSB0aGlzLmZsb2F0V2lkdGg7XHJcbiAgICB0aGlzLmZsb2F0UmVzaXplU3RhcnRIID0gdGhpcy5mbG9hdEhlaWdodDtcclxuICAgIGRvY3VtZW50LmJvZHkuc3R5bGUuY3Vyc29yID0gJ3NlLXJlc2l6ZSc7XHJcbiAgICBkb2N1bWVudC5ib2R5LnN0eWxlLnVzZXJTZWxlY3QgPSAnbm9uZSc7XHJcbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCB0aGlzLmJvdW5kRmxvYXRSZXNpemVNb3ZlKTtcclxuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCB0aGlzLmJvdW5kRmxvYXRSZXNpemVFbmQpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBvbkZsb2F0UmVzaXplTW92ZShldmVudDogTW91c2VFdmVudCk6IHZvaWQge1xyXG4gICAgaWYgKCF0aGlzLmZsb2F0UmVzaXppbmcpIHJldHVybjtcclxuICAgIHRoaXMuZmxvYXRXaWR0aCAgPSBNYXRoLm1heCgyODAsIHRoaXMuZmxvYXRSZXNpemVTdGFydFcgKyAoZXZlbnQuY2xpZW50WCAtIHRoaXMuZmxvYXRSZXNpemVTdGFydFgpKTtcclxuICAgIHRoaXMuZmxvYXRIZWlnaHQgPSBNYXRoLm1heCgzMjAsIHRoaXMuZmxvYXRSZXNpemVTdGFydEggKyAoZXZlbnQuY2xpZW50WSAtIHRoaXMuZmxvYXRSZXNpemVTdGFydFkpKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgb25GbG9hdFJlc2l6ZUVuZCgpOiB2b2lkIHtcclxuICAgIGlmICghdGhpcy5mbG9hdFJlc2l6aW5nKSByZXR1cm47XHJcbiAgICB0aGlzLmZsb2F0UmVzaXppbmcgPSBmYWxzZTtcclxuICAgIGRvY3VtZW50LmJvZHkuc3R5bGUuY3Vyc29yID0gJyc7XHJcbiAgICBkb2N1bWVudC5ib2R5LnN0eWxlLnVzZXJTZWxlY3QgPSAnJztcclxuICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIHRoaXMuYm91bmRGbG9hdFJlc2l6ZU1vdmUpO1xyXG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIHRoaXMuYm91bmRGbG9hdFJlc2l6ZUVuZCk7XHJcbiAgICB0aGlzLnNhdmVGbG9hdFN0YXRlKCk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHNhdmVGbG9hdFN0YXRlKCk6IHZvaWQge1xyXG4gICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ21lc3NhZ2luZ19mbG9hdF9zdGF0ZScsIEpTT04uc3RyaW5naWZ5KHtcclxuICAgICAgaXNGbG9hdGluZzogdGhpcy5pc0Zsb2F0aW5nLFxyXG4gICAgICB4OiB0aGlzLmZsb2F0WCxcclxuICAgICAgeTogdGhpcy5mbG9hdFksXHJcbiAgICAgIHc6IHRoaXMuZmxvYXRXaWR0aCxcclxuICAgICAgaDogdGhpcy5mbG9hdEhlaWdodCxcclxuICAgIH0pKTtcclxuICB9XHJcbn1cclxuIl19