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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdC1wYW5lbC5jb21wb25lbnQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvbGliL2NvbXBvbmVudHMvY2hhdC1wYW5lbC9jaGF0LXBhbmVsLmNvbXBvbmVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsU0FBUyxFQUFxQixNQUFNLGVBQWUsQ0FBQztBQUM3RCxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDL0MsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLHdCQUF3QixDQUFDO0FBQ3ZELE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUMzRCxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSwyQkFBMkIsQ0FBQztBQUM3RCxPQUFPLEVBQWdCLGFBQWEsRUFBRSxNQUFNLE1BQU0sQ0FBQztBQUduRCxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUN4RSxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUMzRSxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUMxRixPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQzs7Ozs7OztBQXlSakYsTUFBTSxPQUFPLGtCQUFrQjtJQXVDVDtJQXRDcEIsTUFBTSxHQUFHLEtBQUssQ0FBQztJQUNmLFVBQVUsR0FBc0YsT0FBTyxDQUFDO0lBQ3hHLFFBQVEsR0FBVyxjQUFjLENBQUM7SUFDbEMsSUFBSSxHQUFnQixPQUFPLENBQUM7SUFDNUIsWUFBWSxHQUFHLEdBQUcsQ0FBQztJQUVuQiw4QkFBOEI7SUFDOUIsVUFBVSxHQUFHLEtBQUssQ0FBQztJQUNuQixNQUFNLEdBQUcsRUFBRSxDQUFDO0lBQ1osTUFBTSxHQUFHLEVBQUUsQ0FBQztJQUNaLFVBQVUsR0FBRyxHQUFHLENBQUM7SUFDakIsV0FBVyxH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RSxhQUFhLG1MQUFFLGVBQWUsMklBQUUsZ0JBQWdCLDZUQUM5RCxrQkFBa0IsMkRBQUUsbUJBQW1CLDREQUN2Qyx3QkFBd0IsaUVBQUUscUJBQXFCOzs0RkFpUnRDLGtCQUFrQjtrQkF2UjlCLFNBQVM7K0JBQ0UsZ0JBQWdCLGNBQ2QsSUFBSSxXQUNQO3dCQUNQLFlBQVksRUFBRSxhQUFhLEVBQUUsZUFBZSxFQUFFLGdCQUFnQjt3QkFDOUQsa0JBQWtCLEVBQUUsbUJBQW1CO3dCQUN2Qyx3QkFBd0IsRUFBRSxxQkFBcUI7cUJBQ2hELFlBQ1M7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBNkVUIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQ29tcG9uZW50LCBPbkluaXQsIE9uRGVzdHJveSB9IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xuaW1wb3J0IHsgQ29tbW9uTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvY29tbW9uJztcbmltcG9ydCB7IE1hdEljb25Nb2R1bGUgfSBmcm9tICdAYW5ndWxhci9tYXRlcmlhbC9pY29uJztcbmltcG9ydCB7IE1hdEJ1dHRvbk1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL21hdGVyaWFsL2J1dHRvbic7XG5pbXBvcnQgeyBNYXRUb29sdGlwTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvbWF0ZXJpYWwvdG9vbHRpcCc7XG5pbXBvcnQgeyBTdWJzY3JpcHRpb24sIGNvbWJpbmVMYXRlc3QgfSBmcm9tICdyeGpzJztcbmltcG9ydCB7IE1lc3NhZ2luZ1N0b3JlU2VydmljZSB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL21lc3NhZ2luZy1zdG9yZS5zZXJ2aWNlJztcbmltcG9ydCB7IFNpZGViYXJTaWRlIH0gZnJvbSAnLi4vLi4vbW9kZWxzL21lc3NhZ2luZy5tb2RlbHMnO1xuaW1wb3J0IHsgSW5ib3hMaXN0Q29tcG9uZW50IH0gZnJvbSAnLi4vaW5ib3gtbGlzdC9pbmJveC1saXN0LmNvbXBvbmVudCc7XG5pbXBvcnQgeyBDaGF0VGhyZWFkQ29tcG9uZW50IH0gZnJvbSAnLi4vY2hhdC10aHJlYWQvY2hhdC10aHJlYWQuY29tcG9uZW50JztcbmltcG9ydCB7IE5ld0NvbnZlcnNhdGlvbkNvbXBvbmVudCB9IGZyb20gJy4uL25ldy1jb252ZXJzYXRpb24vbmV3LWNvbnZlcnNhdGlvbi5jb21wb25lbnQnO1xuaW1wb3J0IHsgR3JvdXBNYW5hZ2VyQ29tcG9uZW50IH0gZnJvbSAnLi4vZ3JvdXAtbWFuYWdlci9ncm91cC1tYW5hZ2VyLmNvbXBvbmVudCc7XG5cbkBDb21wb25lbnQoe1xuICBzZWxlY3RvcjogJ2FwcC1jaGF0LXBhbmVsJyxcbiAgc3RhbmRhbG9uZTogdHJ1ZSxcbiAgaW1wb3J0czogW1xuICAgIENvbW1vbk1vZHVsZSwgTWF0SWNvbk1vZHVsZSwgTWF0QnV0dG9uTW9kdWxlLCBNYXRUb29sdGlwTW9kdWxlLFxuICAgIEluYm94TGlzdENvbXBvbmVudCwgQ2hhdFRocmVhZENvbXBvbmVudCxcbiAgICBOZXdDb252ZXJzYXRpb25Db21wb25lbnQsIEdyb3VwTWFuYWdlckNvbXBvbmVudCxcbiAgXSxcbiAgdGVtcGxhdGU6IGBcbiAgICA8IS0tIFNpZGViYXIgLyBGbG9hdGluZyBwYW5lbCAtLT5cbiAgICA8ZGl2XG4gICAgICBjbGFzcz1cInNpZGViYXJcIlxuICAgICAgW2NsYXNzLm9wZW5dPVwiaXNPcGVuXCJcbiAgICAgIFtjbGFzcy5zaWRlLWxlZnRdPVwiIWlzRmxvYXRpbmcgJiYgc2lkZSA9PT0gJ2xlZnQnXCJcbiAgICAgIFtjbGFzcy5zaWRlLXJpZ2h0XT1cIiFpc0Zsb2F0aW5nICYmIHNpZGUgPT09ICdyaWdodCdcIlxuICAgICAgW2NsYXNzLmZsb2F0aW5nXT1cImlzRmxvYXRpbmdcIlxuICAgICAgW3N0eWxlLndpZHRoLnB4XT1cImlzRmxvYXRpbmcgPyBmbG9hdFdpZHRoIDogc2lkZWJhcldpZHRoXCJcbiAgICAgIFtzdHlsZS5oZWlnaHQucHhdPVwiaXNGbG9hdGluZyA/IGZsb2F0SGVpZ2h0IDogbnVsbFwiXG4gICAgICBbc3R5bGUubGVmdC5weF09XCJpc0Zsb2F0aW5nID8gZmxvYXRYIDogbnVsbFwiXG4gICAgICBbc3R5bGUudG9wLnB4XT1cImlzRmxvYXRpbmcgPyBmbG9hdFkgOiBudWxsXCJcbiAgICA+XG4gICAgICA8IS0tIFJlc2l6ZSBoYW5kbGUgKHNpZGViYXIgbW9kZSBvbmx5KSAtLT5cbiAgICAgIDxkaXZcbiAgICAgICAgKm5nSWY9XCIhaXNGbG9hdGluZ1wiXG4gICAgICAgIGNsYXNzPVwicmVzaXplLWhhbmRsZVwiXG4gICAgICAgIFtjbGFzcy5oYW5kbGUtbGVmdF09XCJzaWRlID09PSAncmlnaHQnXCJcbiAgICAgICAgW2NsYXNzLmhhbmRsZS1yaWdodF09XCJzaWRlID09PSAnbGVmdCdcIlxuICAgICAgICAobW91c2Vkb3duKT1cIm9uUmVzaXplU3RhcnQoJGV2ZW50KVwiXG4gICAgICA+PC9kaXY+XG5cbiAgICAgIDwhLS0gU2lkZWJhciBoZWFkZXIgKGFjdHMgYXMgZHJhZyBoYW5kbGUgaW4gZmxvYXRpbmcgbW9kZSkgLS0+XG4gICAgICA8ZGl2XG4gICAgICAgIGNsYXNzPVwic2lkZWJhci1oZWFkZXJcIlxuICAgICAgICBbY2xhc3MuZHJhZy1oYW5kbGVdPVwiaXNGbG9hdGluZ1wiXG4gICAgICAgIChtb3VzZWRvd24pPVwiaXNGbG9hdGluZyAmJiBvbkZsb2F0RHJhZ1N0YXJ0KCRldmVudClcIlxuICAgICAgPlxuICAgICAgICA8ZGl2IGNsYXNzPVwiaGVhZGVyLWxlZnRcIj5cbiAgICAgICAgICA8c3ZnIGNsYXNzPVwiY2VzLWxvZ28tc21cIiB2aWV3Qm94PVwiMCAwIDEwMCAxMDBcIiB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCI+XG4gICAgICAgICAgICA8cGF0aCBkPVwiTSAxNSAyMCBRIDE1IDE1IDIwIDE1IEwgODAgMTUgUSA4NSAxNSA4NSAyMCBMIDg1IDYwIFEgODUgNjUgODAgNjUgTCAzNSA2NSBMIDIwIDgwIEwgMjAgNjUgUSAxNSA2NSAxNSA2MCBaXCJcbiAgICAgICAgICAgICAgICAgIGZpbGw9XCJub25lXCIgc3Ryb2tlPVwid2hpdGVcIiBzdHJva2Utd2lkdGg9XCIzXCIvPlxuICAgICAgICAgICAgPGcgdHJhbnNmb3JtPVwidHJhbnNsYXRlKDUwLCA0MCkgc2NhbGUoMC4zNSlcIj5cbiAgICAgICAgICAgICAgPHBhdGggZD1cIk0gMCwtMzAgTCAyNSwtMTUgTCAyNSwxNSBMIDAsMzAgTCAtMjUsMTUgTCAtMjUsLTE1IFpcIiBmaWxsPVwid2hpdGVcIi8+XG4gICAgICAgICAgICA8L2c+XG4gICAgICAgICAgPC9zdmc+XG4gICAgICAgICAgPHNwYW4gY2xhc3M9XCJoZWFkZXItdGl0bGVcIj5DRVMgTWVzc2VuZ2VyPC9zcGFuPlxuICAgICAgICA8L2Rpdj5cbiAgICAgICAgPGRpdiBjbGFzcz1cImhlYWRlci1hY3Rpb25zXCI+XG4gICAgICAgICAgPCEtLSBTaWRlLXN3YXAgKHNpZGViYXIgbW9kZSBvbmx5KSAtLT5cbiAgICAgICAgICA8YnV0dG9uICpuZ0lmPVwiIWlzRmxvYXRpbmdcIiBtYXQtaWNvbi1idXR0b24gY2xhc3M9XCJoZHItYnRuXCIgKGNsaWNrKT1cInRvZ2dsZVNpZGUoKVwiXG4gICAgICAgICAgICBbbWF0VG9vbHRpcF09XCInTW92ZSB0byAnICsgKHNpZGUgPT09ICdyaWdodCcgPyAnbGVmdCcgOiAncmlnaHQnKVwiIG1hdFRvb2x0aXBQb3NpdGlvbj1cImJlbG93XCI+XG4gICAgICAgICAgICA8bWF0LWljb24+e3sgc2lkZSA9PT0gJ3JpZ2h0JyA/ICdjaGV2cm9uX2xlZnQnIDogJ2NoZXZyb25fcmlnaHQnIH19PC9tYXQtaWNvbj5cbiAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICA8IS0tIFBvcC1vdXQgLyBkb2NrIHRvZ2dsZSAtLT5cbiAgICAgICAgICA8YnV0dG9uIG1hdC1pY29uLWJ1dHRvbiBjbGFzcz1cImhkci1idG5cIlxuICAgICAgICAgICAgKGNsaWNrKT1cInRvZ2dsZUZsb2F0KClcIlxuICAgICAgICAgICAgW21hdFRvb2x0aXBdPVwiaXNGbG9hdGluZyA/ICdEb2NrIHRvIHNpZGViYXInIDogJ1BvcCBvdXQgdG8gZmxvYXRpbmcgd2luZG93J1wiXG4gICAgICAgICAgICBtYXRUb29sdGlwUG9zaXRpb249XCJiZWxvd1wiPlxuICAgICAgICAgICAgPG1hdC1pY29uPnt7IGlzRmxvYXRpbmcgPyAncGljdHVyZV9pbl9waWN0dXJlX2FsdCcgOiAnb3Blbl9pbl9uZXcnIH19PC9tYXQtaWNvbj5cbiAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwiYnRuLXNwYWNlclwiPjwvZGl2PlxuICAgICAgICAgIDxidXR0b24gbWF0LWljb24tYnV0dG9uIGNsYXNzPVwiaGRyLWJ0blwiIChjbGljayk9XCJjbG9zZSgpXCIgbWF0VG9vbHRpcD1cIkNsb3NlIG1lc3NlbmdlclwiIG1hdFRvb2x0aXBQb3NpdGlvbj1cImJlbG93XCI+XG4gICAgICAgICAgICA8bWF0LWljb24+Y2xvc2U8L21hdC1pY29uPlxuICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuXG4gICAgICA8IS0tIFZpZXcgY29udGFpbmVyIC0tPlxuICAgICAgPGRpdiBjbGFzcz1cInNpZGViYXItY29udGVudFwiPlxuICAgICAgICA8YXBwLWluYm94LWxpc3QgKm5nSWY9XCJhY3RpdmVWaWV3ID09PSAnaW5ib3gnXCI+PC9hcHAtaW5ib3gtbGlzdD5cbiAgICAgICAgPGFwcC1jaGF0LXRocmVhZCAqbmdJZj1cImFjdGl2ZVZpZXcgPT09ICdjaGF0J1wiPjwvYXBwLWNoYXQtdGhyZWFkPlxuICAgICAgICA8YXBwLW5ldy1jb252ZXJzYXRpb24gKm5nSWY9XCJhY3RpdmVWaWV3ID09PSAnbmV3LWNvbnZlcnNhdGlvbidcIj48L2FwcC1uZXctY29udmVyc2F0aW9uPlxuICAgICAgICA8YXBwLWdyb3VwLW1hbmFnZXIgKm5nSWY9XCJhY3RpdmVWaWV3ID09PSAnZ3JvdXAtbWFuYWdlcidcIj48L2FwcC1ncm91cC1tYW5hZ2VyPlxuICAgICAgPC9kaXY+XG5cbiAgICAgIDwhLS0gU3RhdHVzIGJhciAtLT5cbiAgICAgIDxkaXYgY2xhc3M9XCJ3cy1zdGF0dXNcIiBbY2xhc3MuY29ubmVjdGVkXT1cIndzU3RhdHVzID09PSAnYXV0aGVudGljYXRlZCdcIiBbY2xhc3MuY29ubmVjdGluZ109XCJ3c1N0YXR1cyA9PT0gJ2Nvbm5lY3RpbmcnXCI+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJzdGF0dXMtZG90XCI+PC9kaXY+XG4gICAgICAgIDxzcGFuICpuZ0lmPVwid3NTdGF0dXMgPT09ICdhdXRoZW50aWNhdGVkJ1wiPkNvbm5lY3RlZDwvc3Bhbj5cbiAgICAgICAgPHNwYW4gKm5nSWY9XCJ3c1N0YXR1cyA9PT0gJ2Nvbm5lY3RpbmcnXCI+Q29ubmVjdGluZy4uLjwvc3Bhbj5cbiAgICAgICAgPHNwYW4gKm5nSWY9XCJ3c1N0YXR1cyA9PT0gJ2Rpc2Nvbm5lY3RlZCdcIj5EaXNjb25uZWN0ZWQ8L3NwYW4+XG4gICAgICA8L2Rpdj5cblxuICAgICAgPCEtLSBSZXNpemUgY29ybmVyIChmbG9hdGluZyBtb2RlIG9ubHkpIC0tPlxuICAgICAgPGRpdiAqbmdJZj1cImlzRmxvYXRpbmdcIiBjbGFzcz1cImZsb2F0LXJlc2l6ZS1jb3JuZXJcIiAobW91c2Vkb3duKT1cIm9uRmxvYXRSZXNpemVTdGFydCgkZXZlbnQpXCI+PC9kaXY+XG4gICAgPC9kaXY+XG4gIGAsXG4gIHN0eWxlczogW2BcbiAgICAuc2lkZWJhciB7XG4gICAgICBwb3NpdGlvbjogZml4ZWQ7XG4gICAgICB0b3A6IDA7XG4gICAgICBib3R0b206IDA7XG4gICAgICB3aWR0aDogNDAwcHg7XG4gICAgICBiYWNrZ3JvdW5kOiAjMDQxMzIyO1xuICAgICAgei1pbmRleDogOTk5OTtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgYm94LXNoYWRvdzogMCAwIDQwcHggcmdiYSgwLCAwLCAwLCAwLjYpO1xuICAgICAgdHJhbnNpdGlvbjogdHJhbnNmb3JtIDAuM3MgY3ViaWMtYmV6aWVyKDAuNCwgMCwgMC4yLCAxKTtcbiAgICB9XG5cbiAgICAuc2lkZWJhci5zaWRlLXJpZ2h0IHtcbiAgICAgIHJpZ2h0OiAwO1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVYKDEwMCUpO1xuICAgIH1cblxuICAgIC5zaWRlYmFyLnNpZGUtbGVmdCB7XG4gICAgICBsZWZ0OiAwO1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVYKC0xMDAlKTtcbiAgICB9XG5cbiAgICAuc2lkZWJhci5vcGVuLnNpZGUtcmlnaHQge1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVYKDApO1xuICAgIH1cblxuICAgIC5zaWRlYmFyLm9wZW4uc2lkZS1sZWZ0IHtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWCgwKTtcbiAgICB9XG5cbiAgICAvKiDilIDilIAgUmVzaXplIGhhbmRsZSDilIDilIAgKi9cbiAgICAucmVzaXplLWhhbmRsZSB7XG4gICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XG4gICAgICB0b3A6IDA7XG4gICAgICBib3R0b206IDA7XG4gICAgICB3aWR0aDogNXB4O1xuICAgICAgY3Vyc29yOiBldy1yZXNpemU7XG4gICAgICB6LWluZGV4OiAxMDtcbiAgICAgIHRyYW5zaXRpb246IGJhY2tncm91bmQgMC4xNXM7XG4gICAgfVxuXG4gICAgLnJlc2l6ZS1oYW5kbGU6aG92ZXIsXG4gICAgLnJlc2l6ZS1oYW5kbGU6YWN0aXZlIHtcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xNSk7XG4gICAgfVxuXG4gICAgLnJlc2l6ZS1oYW5kbGUuaGFuZGxlLWxlZnQge1xuICAgICAgbGVmdDogMDtcbiAgICB9XG5cbiAgICAucmVzaXplLWhhbmRsZS5oYW5kbGUtcmlnaHQge1xuICAgICAgcmlnaHQ6IDA7XG4gICAgfVxuXG4gICAgLyog4pSA4pSAIEhlYWRlciDilIDilIAgKi9cbiAgICAuc2lkZWJhci1oZWFkZXIge1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWJldHdlZW47XG4gICAgICBwYWRkaW5nOiAxMnB4IDEycHggMTJweCAxNnB4O1xuICAgICAgYm9yZGVyLWJvdHRvbTogMXB4IHNvbGlkIHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xNSk7XG4gICAgICBmbGV4LXNocmluazogMDtcbiAgICB9XG5cbiAgICAuaGVhZGVyLWxlZnQge1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBnYXA6IDEwcHg7XG4gICAgfVxuXG4gICAgLmNlcy1sb2dvLXNtIHtcbiAgICAgIHdpZHRoOiAyOHB4O1xuICAgICAgaGVpZ2h0OiAyOHB4O1xuICAgIH1cblxuICAgIC5oZWFkZXItdGl0bGUge1xuICAgICAgZm9udC1zaXplOiAxNnB4O1xuICAgICAgZm9udC13ZWlnaHQ6IDcwMDtcbiAgICAgIGNvbG9yOiAjZmZmO1xuICAgICAgbGV0dGVyLXNwYWNpbmc6IDAuM3B4O1xuICAgIH1cblxuICAgIC5oZWFkZXItYWN0aW9ucyB7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGdhcDogMDtcbiAgICB9XG5cbiAgICAuYnRuLXNwYWNlciB7XG4gICAgICB3aWR0aDogMTJweDtcbiAgICB9XG5cbiAgICAuaGRyLWJ0biB7XG4gICAgICB3aWR0aDogMzJweDtcbiAgICAgIGhlaWdodDogMzJweDtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDZweCAhaW1wb3J0YW50O1xuICAgICAgdHJhbnNpdGlvbjogYmFja2dyb3VuZCAwLjE1cywgYm94LXNoYWRvdyAwLjE1cztcbiAgICB9XG5cbiAgICAuaGRyLWJ0bjpob3ZlciB7XG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMTUpICFpbXBvcnRhbnQ7XG4gICAgICBib3gtc2hhZG93OiAwIDJweCA4cHggcmdiYSgwLCAwLCAwLCAwLjIpO1xuICAgIH1cblxuICAgIC5oZHItYnRuIG1hdC1pY29uIHtcbiAgICAgIGZvbnQtc2l6ZTogMjBweDtcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuODUpO1xuICAgIH1cblxuICAgIC8qIOKUgOKUgCBDb250ZW50IOKUgOKUgCAqL1xuICAgIC5zaWRlYmFyLWNvbnRlbnQge1xuICAgICAgZmxleDogMTtcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgfVxuXG4gICAgLyog4pSA4pSAIFN0YXR1cyBiYXIg4pSA4pSAICovXG4gICAgLndzLXN0YXR1cyB7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGdhcDogNnB4O1xuICAgICAgcGFkZGluZzogNnB4IDE2cHg7XG4gICAgICBmb250LXNpemU6IDExcHg7XG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjYpO1xuICAgICAgYm9yZGVyLXRvcDogMXB4IHNvbGlkIHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xKTtcbiAgICAgIGZsZXgtc2hyaW5rOiAwO1xuICAgIH1cblxuICAgIC5zdGF0dXMtZG90IHtcbiAgICAgIHdpZHRoOiA2cHg7XG4gICAgICBoZWlnaHQ6IDZweDtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDUwJTtcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC40KTtcbiAgICB9XG5cbiAgICAud3Mtc3RhdHVzLmNvbm5lY3RlZCAuc3RhdHVzLWRvdCB7XG4gICAgICBiYWNrZ3JvdW5kOiAjMjJjNTVlO1xuICAgIH1cblxuICAgIC53cy1zdGF0dXMuY29ubmVjdGluZyAuc3RhdHVzLWRvdCB7XG4gICAgICBiYWNrZ3JvdW5kOiAjZjU5ZTBiO1xuICAgICAgYW5pbWF0aW9uOiBibGluayAxcyBpbmZpbml0ZTtcbiAgICB9XG5cbiAgICBAa2V5ZnJhbWVzIGJsaW5rIHtcbiAgICAgIDUwJSB7IG9wYWNpdHk6IDAuMzsgfVxuICAgIH1cblxuICAgIC8qIOKUgOKUgCBGbG9hdGluZyBtb2RlIOKUgOKUgCAqL1xuICAgIC5zaWRlYmFyLmZsb2F0aW5nIHtcbiAgICAgIHBvc2l0aW9uOiBmaXhlZCAhaW1wb3J0YW50O1xuICAgICAgcmlnaHQ6IHVuc2V0ICFpbXBvcnRhbnQ7XG4gICAgICBsZWZ0OiA4MHB4O1xuICAgICAgdG9wOiA4MHB4O1xuICAgICAgdHJhbnNmb3JtOiBub25lICFpbXBvcnRhbnQ7XG4gICAgICBib3JkZXItcmFkaXVzOiAxMnB4O1xuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICAgIHJlc2l6ZTogbm9uZTtcbiAgICAgIG1pbi13aWR0aDogMjgwcHg7XG4gICAgICBtaW4taGVpZ2h0OiAzMjBweDtcbiAgICB9XG5cbiAgICAuZHJhZy1oYW5kbGUge1xuICAgICAgY3Vyc29yOiBncmFiO1xuICAgICAgdXNlci1zZWxlY3Q6IG5vbmU7XG4gICAgfVxuXG4gICAgLmRyYWctaGFuZGxlOmFjdGl2ZSB7XG4gICAgICBjdXJzb3I6IGdyYWJiaW5nO1xuICAgIH1cblxuICAgIC5mbG9hdC1yZXNpemUtY29ybmVyIHtcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgIGJvdHRvbTogMDtcbiAgICAgIHJpZ2h0OiAwO1xuICAgICAgd2lkdGg6IDE2cHg7XG4gICAgICBoZWlnaHQ6IDE2cHg7XG4gICAgICBjdXJzb3I6IHNlLXJlc2l6ZTtcbiAgICAgIGJhY2tncm91bmQ6IGxpbmVhci1ncmFkaWVudCgxMzVkZWcsIHRyYW5zcGFyZW50IDUwJSwgcmdiYSgyNTUsMjU1LDI1NSwwLjI1KSA1MCUpO1xuICAgICAgYm9yZGVyLWJvdHRvbS1yaWdodC1yYWRpdXM6IDEycHg7XG4gICAgfVxuXG4gICAgQG1lZGlhIChtYXgtd2lkdGg6IDQ4MHB4KSB7XG4gICAgICAuc2lkZWJhciB7XG4gICAgICAgIHdpZHRoOiAxMDAlICFpbXBvcnRhbnQ7XG4gICAgICB9XG4gICAgICAucmVzaXplLWhhbmRsZSB7XG4gICAgICAgIGRpc3BsYXk6IG5vbmU7XG4gICAgICB9XG4gICAgfVxuICBgXSxcbn0pXG5leHBvcnQgY2xhc3MgQ2hhdFBhbmVsQ29tcG9uZW50IGltcGxlbWVudHMgT25Jbml0LCBPbkRlc3Ryb3kge1xuICBpc09wZW4gPSBmYWxzZTtcbiAgYWN0aXZlVmlldzogJ2luYm94JyB8ICdjaGF0JyB8ICduZXctY29udmVyc2F0aW9uJyB8ICdncm91cC1tYW5hZ2VyJyB8ICdjb252ZXJzYXRpb24tc2V0dGluZ3MnID0gJ2luYm94JztcbiAgd3NTdGF0dXM6IHN0cmluZyA9ICdkaXNjb25uZWN0ZWQnO1xuICBzaWRlOiBTaWRlYmFyU2lkZSA9ICdyaWdodCc7XG4gIHNpZGViYXJXaWR0aCA9IDQwMDtcblxuICAvLyDilIDilIAgRmxvYXRpbmcgd2luZG93IHN0YXRlIOKUgOKUgFxuICBpc0Zsb2F0aW5nID0gZmFsc2U7XG4gIGZsb2F0WCA9IDgwO1xuICBmbG9hdFkgPSA4MDtcbiAgZmxvYXRXaWR0aCA9IDM4MDtcbiAgZmxvYXRIZWlnaHQgPSA1NDA7XG5cbiAgcHJpdmF0ZSBkZWZhdWx0V2lkdGggPSA0MDA7XG4gIHByaXZhdGUgcmVzaXppbmcgPSBmYWxzZTtcbiAgcHJpdmF0ZSByZXNpemVTdGFydFggPSAwO1xuICBwcml2YXRlIHJlc2l6ZVN0YXJ0V2lkdGggPSAwO1xuICBwcml2YXRlIGJvdW5kUmVzaXplTW92ZSA9IHRoaXMub25SZXNpemVNb3ZlLmJpbmQodGhpcyk7XG4gIHByaXZhdGUgYm91bmRSZXNpemVFbmQgPSB0aGlzLm9uUmVzaXplRW5kLmJpbmQodGhpcyk7XG5cbiAgLy8gZmxvYXQgZHJhZ1xuICBwcml2YXRlIGZsb2F0RHJhZ2dpbmcgPSBmYWxzZTtcbiAgcHJpdmF0ZSBmbG9hdERyYWdPZmZYID0gMDtcbiAgcHJpdmF0ZSBmbG9hdERyYWdPZmZZID0gMDtcbiAgcHJpdmF0ZSBib3VuZEZsb2F0TW92ZSA9IHRoaXMub25GbG9hdERyYWdNb3ZlLmJpbmQodGhpcyk7XG4gIHByaXZhdGUgYm91bmRGbG9hdEVuZCAgPSB0aGlzLm9uRmxvYXREcmFnRW5kLmJpbmQodGhpcyk7XG5cbiAgLy8gZmxvYXQgcmVzaXplXG4gIHByaXZhdGUgZmxvYXRSZXNpemluZyA9IGZhbHNlO1xuICBwcml2YXRlIGZsb2F0UmVzaXplU3RhcnRYID0gMDtcbiAgcHJpdmF0ZSBmbG9hdFJlc2l6ZVN0YXJ0WSA9IDA7XG4gIHByaXZhdGUgZmxvYXRSZXNpemVTdGFydFcgPSAwO1xuICBwcml2YXRlIGZsb2F0UmVzaXplU3RhcnRIID0gMDtcbiAgcHJpdmF0ZSBib3VuZEZsb2F0UmVzaXplTW92ZSA9IHRoaXMub25GbG9hdFJlc2l6ZU1vdmUuYmluZCh0aGlzKTtcbiAgcHJpdmF0ZSBib3VuZEZsb2F0UmVzaXplRW5kICA9IHRoaXMub25GbG9hdFJlc2l6ZUVuZC5iaW5kKHRoaXMpO1xuXG4gIHByaXZhdGUgc3ViITogU3Vic2NyaXB0aW9uO1xuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgc3RvcmU6IE1lc3NhZ2luZ1N0b3JlU2VydmljZSkge31cblxuICBuZ09uSW5pdCgpOiB2b2lkIHtcbiAgICB0aGlzLnNpZGUgPSB0aGlzLnN0b3JlLmdldFNpZGViYXJTaWRlKCk7XG4gICAgY29uc3Qgc2F2ZWQgPSBsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnbWVzc2FnaW5nX3NpZGViYXJfd2lkdGgnKTtcbiAgICBpZiAoc2F2ZWQpIHRoaXMuc2lkZWJhcldpZHRoID0gcGFyc2VJbnQoc2F2ZWQsIDEwKSB8fCB0aGlzLmRlZmF1bHRXaWR0aDtcblxuICAgIGNvbnN0IHNhdmVkRmxvYXQgPSBsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnbWVzc2FnaW5nX2Zsb2F0X3N0YXRlJyk7XG4gICAgaWYgKHNhdmVkRmxvYXQpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGYgPSBKU09OLnBhcnNlKHNhdmVkRmxvYXQpO1xuICAgICAgICB0aGlzLmlzRmxvYXRpbmcgPSBmLmlzRmxvYXRpbmcgPz8gZmFsc2U7XG4gICAgICAgIHRoaXMuZmxvYXRYID0gZi54ID8/IDgwO1xuICAgICAgICB0aGlzLmZsb2F0WSA9IGYueSA/PyA4MDtcbiAgICAgICAgdGhpcy5mbG9hdFdpZHRoID0gZi53ID8/IDM4MDtcbiAgICAgICAgdGhpcy5mbG9hdEhlaWdodCA9IGYuaCA/PyA1NDA7XG4gICAgICB9IGNhdGNoIHt9XG4gICAgfVxuXG4gICAgdGhpcy5zdWIgPSBjb21iaW5lTGF0ZXN0KFtcbiAgICAgIHRoaXMuc3RvcmUucGFuZWxPcGVuLFxuICAgICAgdGhpcy5zdG9yZS5hY3RpdmVWaWV3LFxuICAgICAgdGhpcy5zdG9yZS53c1N0YXR1cyxcbiAgICAgIHRoaXMuc3RvcmUuc2lkZWJhclNpZGUsXG4gICAgXSkuc3Vic2NyaWJlKChbb3Blbiwgdmlldywgd3MsIHNpZGVdKSA9PiB7XG4gICAgICB0aGlzLmlzT3BlbiA9IG9wZW47XG4gICAgICB0aGlzLmFjdGl2ZVZpZXcgPSB2aWV3O1xuICAgICAgdGhpcy53c1N0YXR1cyA9IHdzO1xuICAgICAgdGhpcy5zaWRlID0gc2lkZTtcbiAgICB9KTtcbiAgfVxuXG4gIG5nT25EZXN0cm95KCk6IHZvaWQge1xuICAgIHRoaXMuc3ViPy51bnN1YnNjcmliZSgpO1xuICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIHRoaXMuYm91bmRSZXNpemVNb3ZlKTtcbiAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgdGhpcy5ib3VuZFJlc2l6ZUVuZCk7XG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgdGhpcy5ib3VuZEZsb2F0TW92ZSk7XG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIHRoaXMuYm91bmRGbG9hdEVuZCk7XG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgdGhpcy5ib3VuZEZsb2F0UmVzaXplTW92ZSk7XG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIHRoaXMuYm91bmRGbG9hdFJlc2l6ZUVuZCk7XG4gIH1cblxuICB0b2dnbGVTaWRlKCk6IHZvaWQge1xuICAgIHRoaXMuc3RvcmUudG9nZ2xlU2lkZWJhclNpZGUoKTtcbiAgfVxuXG4gIGNsb3NlKCk6IHZvaWQge1xuICAgIHRoaXMuc3RvcmUuY2xvc2VQYW5lbCgpO1xuICB9XG5cbiAgdG9nZ2xlRmxvYXQoKTogdm9pZCB7XG4gICAgdGhpcy5pc0Zsb2F0aW5nID0gIXRoaXMuaXNGbG9hdGluZztcbiAgICBpZiAodGhpcy5pc0Zsb2F0aW5nKSB7XG4gICAgICAvLyBDZW50cmUgdGhlIGZsb2F0IHdpbmRvdyBvbiBzY3JlZW4gd2hlbiBmaXJzdCBwb3BwaW5nIG91dFxuICAgICAgdGhpcy5mbG9hdFggPSBNYXRoLm1heCgyMCwgTWF0aC5yb3VuZCgod2luZG93LmlubmVyV2lkdGggIC0gdGhpcy5mbG9hdFdpZHRoKSAgLyAyKSk7XG4gICAgICB0aGlzLmZsb2F0WSA9IE1hdGgubWF4KDIwLCBNYXRoLnJvdW5kKCh3aW5kb3cuaW5uZXJIZWlnaHQgLSB0aGlzLmZsb2F0SGVpZ2h0KSAvIDIpKTtcbiAgICB9XG4gICAgdGhpcy5zYXZlRmxvYXRTdGF0ZSgpO1xuICB9XG5cbiAgLy8g4pSA4pSAIFNpZGViYXIgcmVzaXplIOKUgOKUgFxuICBvblJlc2l6ZVN0YXJ0KGV2ZW50OiBNb3VzZUV2ZW50KTogdm9pZCB7XG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICB0aGlzLnJlc2l6aW5nID0gdHJ1ZTtcbiAgICB0aGlzLnJlc2l6ZVN0YXJ0WCA9IGV2ZW50LmNsaWVudFg7XG4gICAgdGhpcy5yZXNpemVTdGFydFdpZHRoID0gdGhpcy5zaWRlYmFyV2lkdGg7XG4gICAgZG9jdW1lbnQuYm9keS5zdHlsZS5jdXJzb3IgPSAnZXctcmVzaXplJztcbiAgICBkb2N1bWVudC5ib2R5LnN0eWxlLnVzZXJTZWxlY3QgPSAnbm9uZSc7XG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgdGhpcy5ib3VuZFJlc2l6ZU1vdmUpO1xuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCB0aGlzLmJvdW5kUmVzaXplRW5kKTtcbiAgfVxuXG4gIHByaXZhdGUgb25SZXNpemVNb3ZlKGV2ZW50OiBNb3VzZUV2ZW50KTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLnJlc2l6aW5nKSByZXR1cm47XG4gICAgY29uc3QgZHggPSBldmVudC5jbGllbnRYIC0gdGhpcy5yZXNpemVTdGFydFg7XG4gICAgaWYgKHRoaXMuc2lkZSA9PT0gJ3JpZ2h0Jykge1xuICAgICAgdGhpcy5zaWRlYmFyV2lkdGggPSBNYXRoLm1heCgyMDAsIHRoaXMucmVzaXplU3RhcnRXaWR0aCAtIGR4KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5zaWRlYmFyV2lkdGggPSBNYXRoLm1heCgyMDAsIHRoaXMucmVzaXplU3RhcnRXaWR0aCArIGR4KTtcbiAgICB9XG4gICAgdGhpcy5zaWRlYmFyV2lkdGggPSBNYXRoLm1pbih0aGlzLnNpZGViYXJXaWR0aCwgd2luZG93LmlubmVyV2lkdGggKiAwLjkpO1xuICB9XG5cbiAgcHJpdmF0ZSBvblJlc2l6ZUVuZCgpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMucmVzaXppbmcpIHJldHVybjtcbiAgICB0aGlzLnJlc2l6aW5nID0gZmFsc2U7XG4gICAgZG9jdW1lbnQuYm9keS5zdHlsZS5jdXJzb3IgPSAnJztcbiAgICBkb2N1bWVudC5ib2R5LnN0eWxlLnVzZXJTZWxlY3QgPSAnJztcbiAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCB0aGlzLmJvdW5kUmVzaXplTW92ZSk7XG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIHRoaXMuYm91bmRSZXNpemVFbmQpO1xuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdtZXNzYWdpbmdfc2lkZWJhcl93aWR0aCcsIFN0cmluZyh0aGlzLnNpZGViYXJXaWR0aCkpO1xuICB9XG5cbiAgLy8g4pSA4pSAIEZsb2F0aW5nIHBhbmVsIGRyYWcg4pSA4pSAXG4gIG9uRmxvYXREcmFnU3RhcnQoZXZlbnQ6IE1vdXNlRXZlbnQpOiB2b2lkIHtcbiAgICAvLyBJZ25vcmUgaWYgY29taW5nIGZyb20gYSBidXR0b24gaW5zaWRlIHRoZSBoZWFkZXJcbiAgICBpZiAoKGV2ZW50LnRhcmdldCBhcyBIVE1MRWxlbWVudCkuY2xvc2VzdCgnYnV0dG9uJykpIHJldHVybjtcbiAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIHRoaXMuZmxvYXREcmFnZ2luZyA9IHRydWU7XG4gICAgdGhpcy5mbG9hdERyYWdPZmZYID0gZXZlbnQuY2xpZW50WCAtIHRoaXMuZmxvYXRYO1xuICAgIHRoaXMuZmxvYXREcmFnT2ZmWSA9IGV2ZW50LmNsaWVudFkgLSB0aGlzLmZsb2F0WTtcbiAgICBkb2N1bWVudC5ib2R5LnN0eWxlLnVzZXJTZWxlY3QgPSAnbm9uZSc7XG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgdGhpcy5ib3VuZEZsb2F0TW92ZSk7XG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIHRoaXMuYm91bmRGbG9hdEVuZCk7XG4gIH1cblxuICBwcml2YXRlIG9uRmxvYXREcmFnTW92ZShldmVudDogTW91c2VFdmVudCk6IHZvaWQge1xuICAgIGlmICghdGhpcy5mbG9hdERyYWdnaW5nKSByZXR1cm47XG4gICAgdGhpcy5mbG9hdFggPSBNYXRoLm1heCgwLCBNYXRoLm1pbihldmVudC5jbGllbnRYIC0gdGhpcy5mbG9hdERyYWdPZmZYLCB3aW5kb3cuaW5uZXJXaWR0aCAgLSB0aGlzLmZsb2F0V2lkdGgpKTtcbiAgICB0aGlzLmZsb2F0WSA9IE1hdGgubWF4KDAsIE1hdGgubWluKGV2ZW50LmNsaWVudFkgLSB0aGlzLmZsb2F0RHJhZ09mZlksIHdpbmRvdy5pbm5lckhlaWdodCAtIDYwKSk7XG4gIH1cblxuICBwcml2YXRlIG9uRmxvYXREcmFnRW5kKCk6IHZvaWQge1xuICAgIGlmICghdGhpcy5mbG9hdERyYWdnaW5nKSByZXR1cm47XG4gICAgdGhpcy5mbG9hdERyYWdnaW5nID0gZmFsc2U7XG4gICAgZG9jdW1lbnQuYm9keS5zdHlsZS51c2VyU2VsZWN0ID0gJyc7XG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgdGhpcy5ib3VuZEZsb2F0TW92ZSk7XG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIHRoaXMuYm91bmRGbG9hdEVuZCk7XG4gICAgdGhpcy5zYXZlRmxvYXRTdGF0ZSgpO1xuICB9XG5cbiAgLy8g4pSA4pSAIEZsb2F0aW5nIHBhbmVsIHJlc2l6ZSAoU0UgY29ybmVyKSDilIDilIBcbiAgb25GbG9hdFJlc2l6ZVN0YXJ0KGV2ZW50OiBNb3VzZUV2ZW50KTogdm9pZCB7XG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICB0aGlzLmZsb2F0UmVzaXppbmcgPSB0cnVlO1xuICAgIHRoaXMuZmxvYXRSZXNpemVTdGFydFggPSBldmVudC5jbGllbnRYO1xuICAgIHRoaXMuZmxvYXRSZXNpemVTdGFydFkgPSBldmVudC5jbGllbnRZO1xuICAgIHRoaXMuZmxvYXRSZXNpemVTdGFydFcgPSB0aGlzLmZsb2F0V2lkdGg7XG4gICAgdGhpcy5mbG9hdFJlc2l6ZVN0YXJ0SCA9IHRoaXMuZmxvYXRIZWlnaHQ7XG4gICAgZG9jdW1lbnQuYm9keS5zdHlsZS5jdXJzb3IgPSAnc2UtcmVzaXplJztcbiAgICBkb2N1bWVudC5ib2R5LnN0eWxlLnVzZXJTZWxlY3QgPSAnbm9uZSc7XG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgdGhpcy5ib3VuZEZsb2F0UmVzaXplTW92ZSk7XG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIHRoaXMuYm91bmRGbG9hdFJlc2l6ZUVuZCk7XG4gIH1cblxuICBwcml2YXRlIG9uRmxvYXRSZXNpemVNb3ZlKGV2ZW50OiBNb3VzZUV2ZW50KTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLmZsb2F0UmVzaXppbmcpIHJldHVybjtcbiAgICB0aGlzLmZsb2F0V2lkdGggID0gTWF0aC5tYXgoMjgwLCB0aGlzLmZsb2F0UmVzaXplU3RhcnRXICsgKGV2ZW50LmNsaWVudFggLSB0aGlzLmZsb2F0UmVzaXplU3RhcnRYKSk7XG4gICAgdGhpcy5mbG9hdEhlaWdodCA9IE1hdGgubWF4KDMyMCwgdGhpcy5mbG9hdFJlc2l6ZVN0YXJ0SCArIChldmVudC5jbGllbnRZIC0gdGhpcy5mbG9hdFJlc2l6ZVN0YXJ0WSkpO1xuICB9XG5cbiAgcHJpdmF0ZSBvbkZsb2F0UmVzaXplRW5kKCk6IHZvaWQge1xuICAgIGlmICghdGhpcy5mbG9hdFJlc2l6aW5nKSByZXR1cm47XG4gICAgdGhpcy5mbG9hdFJlc2l6aW5nID0gZmFsc2U7XG4gICAgZG9jdW1lbnQuYm9keS5zdHlsZS5jdXJzb3IgPSAnJztcbiAgICBkb2N1bWVudC5ib2R5LnN0eWxlLnVzZXJTZWxlY3QgPSAnJztcbiAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCB0aGlzLmJvdW5kRmxvYXRSZXNpemVNb3ZlKTtcbiAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgdGhpcy5ib3VuZEZsb2F0UmVzaXplRW5kKTtcbiAgICB0aGlzLnNhdmVGbG9hdFN0YXRlKCk7XG4gIH1cblxuICBwcml2YXRlIHNhdmVGbG9hdFN0YXRlKCk6IHZvaWQge1xuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdtZXNzYWdpbmdfZmxvYXRfc3RhdGUnLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpc0Zsb2F0aW5nOiB0aGlzLmlzRmxvYXRpbmcsXG4gICAgICB4OiB0aGlzLmZsb2F0WCxcbiAgICAgIHk6IHRoaXMuZmxvYXRZLFxuICAgICAgdzogdGhpcy5mbG9hdFdpZHRoLFxuICAgICAgaDogdGhpcy5mbG9hdEhlaWdodCxcbiAgICB9KSk7XG4gIH1cbn1cbiJdfQ==