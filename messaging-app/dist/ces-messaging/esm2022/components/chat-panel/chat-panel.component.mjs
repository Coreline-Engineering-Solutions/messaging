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
    defaultWidth = 400;
    resizing = false;
    resizeStartX = 0;
    resizeStartWidth = 0;
    boundResizeMove = this.onResizeMove.bind(this);
    boundResizeEnd = this.onResizeEnd.bind(this);
    sub;
    constructor(store) {
        this.store = store;
    }
    ngOnInit() {
        this.side = this.store.getSidebarSide();
        const saved = localStorage.getItem('messaging_sidebar_width');
        if (saved)
            this.sidebarWidth = parseInt(saved, 10) || this.defaultWidth;
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
    }
    toggleSide() {
        this.store.toggleSidebarSide();
    }
    close() {
        this.store.closePanel();
    }
    // ── Resize ──
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
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: ChatPanelComponent, deps: [{ token: i1.MessagingStoreService }], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "17.3.12", type: ChatPanelComponent, isStandalone: true, selector: "app-chat-panel", ngImport: i0, template: `
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
  `, isInline: true, styles: [".sidebar{position:fixed;top:0;bottom:0;width:400px;background:linear-gradient(180deg,#1f4bd8,#173396);z-index:9999;display:flex;flex-direction:column;box-shadow:0 0 40px #1733964d;transition:transform .3s cubic-bezier(.4,0,.2,1)}.sidebar.side-right{right:0;transform:translate(100%)}.sidebar.side-left{left:0;transform:translate(-100%)}.sidebar.open.side-right,.sidebar.open.side-left{transform:translate(0)}.resize-handle{position:absolute;top:0;bottom:0;width:5px;cursor:ew-resize;z-index:10;transition:background .15s}.resize-handle:hover,.resize-handle:active{background:#ffffff26}.resize-handle.handle-left{left:0}.resize-handle.handle-right{right:0}.sidebar-header{display:flex;align-items:center;justify-content:space-between;padding:12px 12px 12px 16px;border-bottom:1px solid rgba(255,255,255,.15);flex-shrink:0}.header-left{display:flex;align-items:center;gap:10px}.ces-logo-sm{width:28px;height:28px}.header-title{font-size:16px;font-weight:700;color:#fff;letter-spacing:.3px}.header-actions{display:flex;align-items:center;gap:0}.btn-spacer{width:12px}.hdr-btn{width:32px;height:32px;border-radius:6px!important;transition:background .15s,box-shadow .15s}.hdr-btn:hover{background:#ffffff26!important;box-shadow:0 2px 8px #0003}.hdr-btn mat-icon{font-size:20px;color:#ffffffd9}.sidebar-content{flex:1;overflow:hidden}.ws-status{display:flex;align-items:center;gap:6px;padding:6px 16px;font-size:11px;color:#fff9;border-top:1px solid rgba(255,255,255,.1);flex-shrink:0}.status-dot{width:6px;height:6px;border-radius:50%;background:#fff6}.ws-status.connected .status-dot{background:#22c55e}.ws-status.connecting .status-dot{background:#f59e0b;animation:blink 1s infinite}@keyframes blink{50%{opacity:.3}}@media (max-width: 480px){.sidebar{width:100%!important}.resize-handle{display:none}}\n"], dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i2.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "ngmodule", type: MatIconModule }, { kind: "component", type: i3.MatIcon, selector: "mat-icon", inputs: ["color", "inline", "svgIcon", "fontSet", "fontIcon"], exportAs: ["matIcon"] }, { kind: "ngmodule", type: MatButtonModule }, { kind: "component", type: i4.MatIconButton, selector: "button[mat-icon-button]", exportAs: ["matButton"] }, { kind: "ngmodule", type: MatTooltipModule }, { kind: "directive", type: i5.MatTooltip, selector: "[matTooltip]", inputs: ["matTooltipPosition", "matTooltipPositionAtOrigin", "matTooltipDisabled", "matTooltipShowDelay", "matTooltipHideDelay", "matTooltipTouchGestures", "matTooltip", "matTooltipClass"], exportAs: ["matTooltip"] }, { kind: "component", type: InboxListComponent, selector: "app-inbox-list" }, { kind: "component", type: ChatThreadComponent, selector: "app-chat-thread" }, { kind: "component", type: NewConversationComponent, selector: "app-new-conversation" }, { kind: "component", type: GroupManagerComponent, selector: "app-group-manager" }] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: ChatPanelComponent, decorators: [{
            type: Component,
            args: [{ selector: 'app-chat-panel', standalone: true, imports: [
                        CommonModule, MatIconModule, MatButtonModule, MatTooltipModule,
                        InboxListComponent, ChatThreadComponent,
                        NewConversationComponent, GroupManagerComponent,
                    ], template: `
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
  `, styles: [".sidebar{position:fixed;top:0;bottom:0;width:400px;background:linear-gradient(180deg,#1f4bd8,#173396);z-index:9999;display:flex;flex-direction:column;box-shadow:0 0 40px #1733964d;transition:transform .3s cubic-bezier(.4,0,.2,1)}.sidebar.side-right{right:0;transform:translate(100%)}.sidebar.side-left{left:0;transform:translate(-100%)}.sidebar.open.side-right,.sidebar.open.side-left{transform:translate(0)}.resize-handle{position:absolute;top:0;bottom:0;width:5px;cursor:ew-resize;z-index:10;transition:background .15s}.resize-handle:hover,.resize-handle:active{background:#ffffff26}.resize-handle.handle-left{left:0}.resize-handle.handle-right{right:0}.sidebar-header{display:flex;align-items:center;justify-content:space-between;padding:12px 12px 12px 16px;border-bottom:1px solid rgba(255,255,255,.15);flex-shrink:0}.header-left{display:flex;align-items:center;gap:10px}.ces-logo-sm{width:28px;height:28px}.header-title{font-size:16px;font-weight:700;color:#fff;letter-spacing:.3px}.header-actions{display:flex;align-items:center;gap:0}.btn-spacer{width:12px}.hdr-btn{width:32px;height:32px;border-radius:6px!important;transition:background .15s,box-shadow .15s}.hdr-btn:hover{background:#ffffff26!important;box-shadow:0 2px 8px #0003}.hdr-btn mat-icon{font-size:20px;color:#ffffffd9}.sidebar-content{flex:1;overflow:hidden}.ws-status{display:flex;align-items:center;gap:6px;padding:6px 16px;font-size:11px;color:#fff9;border-top:1px solid rgba(255,255,255,.1);flex-shrink:0}.status-dot{width:6px;height:6px;border-radius:50%;background:#fff6}.ws-status.connected .status-dot{background:#22c55e}.ws-status.connecting .status-dot{background:#f59e0b;animation:blink 1s infinite}@keyframes blink{50%{opacity:.3}}@media (max-width: 480px){.sidebar{width:100%!important}.resize-handle{display:none}}\n"] }]
        }], ctorParameters: () => [{ type: i1.MessagingStoreService }] });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdC1wYW5lbC5jb21wb25lbnQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvbGliL2NvbXBvbmVudHMvY2hhdC1wYW5lbC9jaGF0LXBhbmVsLmNvbXBvbmVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsU0FBUyxFQUFxQixNQUFNLGVBQWUsQ0FBQztBQUM3RCxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDL0MsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLHdCQUF3QixDQUFDO0FBQ3ZELE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUMzRCxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSwyQkFBMkIsQ0FBQztBQUM3RCxPQUFPLEVBQWdCLGFBQWEsRUFBRSxNQUFNLE1BQU0sQ0FBQztBQUduRCxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUN4RSxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUMzRSxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUMxRixPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQzs7Ozs7OztBQWtPakYsTUFBTSxPQUFPLGtCQUFrQjtJQWdCVDtJQWZwQixNQUFNLEdBQUcsS0FBSyxDQUFDO0lBQ2YsVUFBVSxHQUFzRixPQUFPLENBQUM7SUFDeEcsUUFBUSxHQUFXLGNBQWMsQ0FBQztJQUNsQyxJQUFJLEdBQWdCLE9BQU8sQ0FBQztJQUM1QixZQUFZLEdBQUcsR0FBRyxDQUFDO0lBRVgsWUFBWSxHQUFHLEdBQUcsQ0FBQztJQUNuQixRQUFRLEdBQUcsS0FBSyxDQUFDO0lBQ2pCLFlBQVksR0FBRyxDQUFDLENBQUM7SUFDakIsZ0JBQWdCLEdBQUcsQ0FBQyxDQUFDO0lBQ3JCLGVBQWUsR0FBRyxJQUFJLENB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OUIsU0FBUzsrQkFDRSxnQkFBZ0IsY0FDZCxJQUFJLFdBQ1A7d0JBQ1AsWUFBWSxFQUFFLGFBQWEsRUFBRSxlQUFlLEVBQUUsZ0JBQWdCO3dCQUM5RCxrQkFBa0IsRUFBRSxtQkFBbUI7d0JBQ3ZDLHdCQUF3QixFQUFFLHFCQUFxQjtxQkFDaEQsWUFDUzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7R0F3RFQiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBDb21wb25lbnQsIE9uSW5pdCwgT25EZXN0cm95IH0gZnJvbSAnQGFuZ3VsYXIvY29yZSc7XG5pbXBvcnQgeyBDb21tb25Nb2R1bGUgfSBmcm9tICdAYW5ndWxhci9jb21tb24nO1xuaW1wb3J0IHsgTWF0SWNvbk1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL21hdGVyaWFsL2ljb24nO1xuaW1wb3J0IHsgTWF0QnV0dG9uTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvbWF0ZXJpYWwvYnV0dG9uJztcbmltcG9ydCB7IE1hdFRvb2x0aXBNb2R1bGUgfSBmcm9tICdAYW5ndWxhci9tYXRlcmlhbC90b29sdGlwJztcbmltcG9ydCB7IFN1YnNjcmlwdGlvbiwgY29tYmluZUxhdGVzdCB9IGZyb20gJ3J4anMnO1xuaW1wb3J0IHsgTWVzc2FnaW5nU3RvcmVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvbWVzc2FnaW5nLXN0b3JlLnNlcnZpY2UnO1xuaW1wb3J0IHsgU2lkZWJhclNpZGUgfSBmcm9tICcuLi8uLi9tb2RlbHMvbWVzc2FnaW5nLm1vZGVscyc7XG5pbXBvcnQgeyBJbmJveExpc3RDb21wb25lbnQgfSBmcm9tICcuLi9pbmJveC1saXN0L2luYm94LWxpc3QuY29tcG9uZW50JztcbmltcG9ydCB7IENoYXRUaHJlYWRDb21wb25lbnQgfSBmcm9tICcuLi9jaGF0LXRocmVhZC9jaGF0LXRocmVhZC5jb21wb25lbnQnO1xuaW1wb3J0IHsgTmV3Q29udmVyc2F0aW9uQ29tcG9uZW50IH0gZnJvbSAnLi4vbmV3LWNvbnZlcnNhdGlvbi9uZXctY29udmVyc2F0aW9uLmNvbXBvbmVudCc7XG5pbXBvcnQgeyBHcm91cE1hbmFnZXJDb21wb25lbnQgfSBmcm9tICcuLi9ncm91cC1tYW5hZ2VyL2dyb3VwLW1hbmFnZXIuY29tcG9uZW50JztcblxuQENvbXBvbmVudCh7XG4gIHNlbGVjdG9yOiAnYXBwLWNoYXQtcGFuZWwnLFxuICBzdGFuZGFsb25lOiB0cnVlLFxuICBpbXBvcnRzOiBbXG4gICAgQ29tbW9uTW9kdWxlLCBNYXRJY29uTW9kdWxlLCBNYXRCdXR0b25Nb2R1bGUsIE1hdFRvb2x0aXBNb2R1bGUsXG4gICAgSW5ib3hMaXN0Q29tcG9uZW50LCBDaGF0VGhyZWFkQ29tcG9uZW50LFxuICAgIE5ld0NvbnZlcnNhdGlvbkNvbXBvbmVudCwgR3JvdXBNYW5hZ2VyQ29tcG9uZW50LFxuICBdLFxuICB0ZW1wbGF0ZTogYFxuICAgIDwhLS0gU2lkZWJhciAtLT5cbiAgICA8ZGl2XG4gICAgICBjbGFzcz1cInNpZGViYXJcIlxuICAgICAgW2NsYXNzLm9wZW5dPVwiaXNPcGVuXCJcbiAgICAgIFtjbGFzcy5zaWRlLWxlZnRdPVwic2lkZSA9PT0gJ2xlZnQnXCJcbiAgICAgIFtjbGFzcy5zaWRlLXJpZ2h0XT1cInNpZGUgPT09ICdyaWdodCdcIlxuICAgICAgW3N0eWxlLndpZHRoLnB4XT1cInNpZGViYXJXaWR0aFwiXG4gICAgPlxuICAgICAgPCEtLSBSZXNpemUgaGFuZGxlIG9uIGlubmVyIGVkZ2UgLS0+XG4gICAgICA8ZGl2XG4gICAgICAgIGNsYXNzPVwicmVzaXplLWhhbmRsZVwiXG4gICAgICAgIFtjbGFzcy5oYW5kbGUtbGVmdF09XCJzaWRlID09PSAncmlnaHQnXCJcbiAgICAgICAgW2NsYXNzLmhhbmRsZS1yaWdodF09XCJzaWRlID09PSAnbGVmdCdcIlxuICAgICAgICAobW91c2Vkb3duKT1cIm9uUmVzaXplU3RhcnQoJGV2ZW50KVwiXG4gICAgICA+PC9kaXY+XG5cbiAgICAgIDwhLS0gU2lkZWJhciBoZWFkZXIgLS0+XG4gICAgICA8ZGl2IGNsYXNzPVwic2lkZWJhci1oZWFkZXJcIj5cbiAgICAgICAgPGRpdiBjbGFzcz1cImhlYWRlci1sZWZ0XCI+XG4gICAgICAgICAgPHN2ZyBjbGFzcz1cImNlcy1sb2dvLXNtXCIgdmlld0JveD1cIjAgMCAxMDAgMTAwXCIgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiPlxuICAgICAgICAgICAgPHBhdGggZD1cIk0gMTUgMjAgUSAxNSAxNSAyMCAxNSBMIDgwIDE1IFEgODUgMTUgODUgMjAgTCA4NSA2MCBRIDg1IDY1IDgwIDY1IEwgMzUgNjUgTCAyMCA4MCBMIDIwIDY1IFEgMTUgNjUgMTUgNjAgWlwiXG4gICAgICAgICAgICAgICAgICBmaWxsPVwibm9uZVwiIHN0cm9rZT1cIndoaXRlXCIgc3Ryb2tlLXdpZHRoPVwiM1wiLz5cbiAgICAgICAgICAgIDxnIHRyYW5zZm9ybT1cInRyYW5zbGF0ZSg1MCwgNDApIHNjYWxlKDAuMzUpXCI+XG4gICAgICAgICAgICAgIDxwYXRoIGQ9XCJNIDAsLTMwIEwgMjUsLTE1IEwgMjUsMTUgTCAwLDMwIEwgLTI1LDE1IEwgLTI1LC0xNSBaXCIgZmlsbD1cIndoaXRlXCIvPlxuICAgICAgICAgICAgPC9nPlxuICAgICAgICAgIDwvc3ZnPlxuICAgICAgICAgIDxzcGFuIGNsYXNzPVwiaGVhZGVyLXRpdGxlXCI+Q0VTIE1lc3Nlbmdlcjwvc3Bhbj5cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJoZWFkZXItYWN0aW9uc1wiPlxuICAgICAgICAgIDxidXR0b24gbWF0LWljb24tYnV0dG9uIGNsYXNzPVwiaGRyLWJ0blwiIChjbGljayk9XCJ0b2dnbGVTaWRlKClcIiBbbWF0VG9vbHRpcF09XCInTW92ZSB0byAnICsgKHNpZGUgPT09ICdyaWdodCcgPyAnbGVmdCcgOiAncmlnaHQnKVwiIG1hdFRvb2x0aXBQb3NpdGlvbj1cImJlbG93XCI+XG4gICAgICAgICAgICA8bWF0LWljb24+e3sgc2lkZSA9PT0gJ3JpZ2h0JyA/ICdjaGV2cm9uX2xlZnQnIDogJ2NoZXZyb25fcmlnaHQnIH19PC9tYXQtaWNvbj5cbiAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwiYnRuLXNwYWNlclwiPjwvZGl2PlxuICAgICAgICAgIDxidXR0b24gbWF0LWljb24tYnV0dG9uIGNsYXNzPVwiaGRyLWJ0blwiIChjbGljayk9XCJjbG9zZSgpXCIgbWF0VG9vbHRpcD1cIkNsb3NlIG1lc3NlbmdlclwiIG1hdFRvb2x0aXBQb3NpdGlvbj1cImJlbG93XCI+XG4gICAgICAgICAgICA8bWF0LWljb24+Y2xvc2U8L21hdC1pY29uPlxuICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuXG4gICAgICA8IS0tIFZpZXcgY29udGFpbmVyIC0tPlxuICAgICAgPGRpdiBjbGFzcz1cInNpZGViYXItY29udGVudFwiPlxuICAgICAgICA8YXBwLWluYm94LWxpc3QgKm5nSWY9XCJhY3RpdmVWaWV3ID09PSAnaW5ib3gnXCI+PC9hcHAtaW5ib3gtbGlzdD5cbiAgICAgICAgPGFwcC1jaGF0LXRocmVhZCAqbmdJZj1cImFjdGl2ZVZpZXcgPT09ICdjaGF0J1wiPjwvYXBwLWNoYXQtdGhyZWFkPlxuICAgICAgICA8YXBwLW5ldy1jb252ZXJzYXRpb24gKm5nSWY9XCJhY3RpdmVWaWV3ID09PSAnbmV3LWNvbnZlcnNhdGlvbidcIj48L2FwcC1uZXctY29udmVyc2F0aW9uPlxuICAgICAgICA8YXBwLWdyb3VwLW1hbmFnZXIgKm5nSWY9XCJhY3RpdmVWaWV3ID09PSAnZ3JvdXAtbWFuYWdlcidcIj48L2FwcC1ncm91cC1tYW5hZ2VyPlxuICAgICAgPC9kaXY+XG5cbiAgICAgIDwhLS0gU3RhdHVzIGJhciAtLT5cbiAgICAgIDxkaXYgY2xhc3M9XCJ3cy1zdGF0dXNcIiBbY2xhc3MuY29ubmVjdGVkXT1cIndzU3RhdHVzID09PSAnYXV0aGVudGljYXRlZCdcIiBbY2xhc3MuY29ubmVjdGluZ109XCJ3c1N0YXR1cyA9PT0gJ2Nvbm5lY3RpbmcnXCI+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJzdGF0dXMtZG90XCI+PC9kaXY+XG4gICAgICAgIDxzcGFuICpuZ0lmPVwid3NTdGF0dXMgPT09ICdhdXRoZW50aWNhdGVkJ1wiPkNvbm5lY3RlZDwvc3Bhbj5cbiAgICAgICAgPHNwYW4gKm5nSWY9XCJ3c1N0YXR1cyA9PT0gJ2Nvbm5lY3RpbmcnXCI+Q29ubmVjdGluZy4uLjwvc3Bhbj5cbiAgICAgICAgPHNwYW4gKm5nSWY9XCJ3c1N0YXR1cyA9PT0gJ2Rpc2Nvbm5lY3RlZCdcIj5EaXNjb25uZWN0ZWQ8L3NwYW4+XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5cbiAgYCxcbiAgc3R5bGVzOiBbYFxuICAgIC5zaWRlYmFyIHtcbiAgICAgIHBvc2l0aW9uOiBmaXhlZDtcbiAgICAgIHRvcDogMDtcbiAgICAgIGJvdHRvbTogMDtcbiAgICAgIHdpZHRoOiA0MDBweDtcbiAgICAgIGJhY2tncm91bmQ6IGxpbmVhci1ncmFkaWVudCgxODBkZWcsICMxRjRCRDggMCUsICMxNzMzOTYgMTAwJSk7XG4gICAgICB6LWluZGV4OiA5OTk5O1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAgICBib3gtc2hhZG93OiAwIDAgNDBweCByZ2JhKDIzLCA1MSwgMTUwLCAwLjMpO1xuICAgICAgdHJhbnNpdGlvbjogdHJhbnNmb3JtIDAuM3MgY3ViaWMtYmV6aWVyKDAuNCwgMCwgMC4yLCAxKTtcbiAgICB9XG5cbiAgICAuc2lkZWJhci5zaWRlLXJpZ2h0IHtcbiAgICAgIHJpZ2h0OiAwO1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVYKDEwMCUpO1xuICAgIH1cblxuICAgIC5zaWRlYmFyLnNpZGUtbGVmdCB7XG4gICAgICBsZWZ0OiAwO1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVYKC0xMDAlKTtcbiAgICB9XG5cbiAgICAuc2lkZWJhci5vcGVuLnNpZGUtcmlnaHQge1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVYKDApO1xuICAgIH1cblxuICAgIC5zaWRlYmFyLm9wZW4uc2lkZS1sZWZ0IHtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWCgwKTtcbiAgICB9XG5cbiAgICAvKiDilIDilIAgUmVzaXplIGhhbmRsZSDilIDilIAgKi9cbiAgICAucmVzaXplLWhhbmRsZSB7XG4gICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XG4gICAgICB0b3A6IDA7XG4gICAgICBib3R0b206IDA7XG4gICAgICB3aWR0aDogNXB4O1xuICAgICAgY3Vyc29yOiBldy1yZXNpemU7XG4gICAgICB6LWluZGV4OiAxMDtcbiAgICAgIHRyYW5zaXRpb246IGJhY2tncm91bmQgMC4xNXM7XG4gICAgfVxuXG4gICAgLnJlc2l6ZS1oYW5kbGU6aG92ZXIsXG4gICAgLnJlc2l6ZS1oYW5kbGU6YWN0aXZlIHtcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xNSk7XG4gICAgfVxuXG4gICAgLnJlc2l6ZS1oYW5kbGUuaGFuZGxlLWxlZnQge1xuICAgICAgbGVmdDogMDtcbiAgICB9XG5cbiAgICAucmVzaXplLWhhbmRsZS5oYW5kbGUtcmlnaHQge1xuICAgICAgcmlnaHQ6IDA7XG4gICAgfVxuXG4gICAgLyog4pSA4pSAIEhlYWRlciDilIDilIAgKi9cbiAgICAuc2lkZWJhci1oZWFkZXIge1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWJldHdlZW47XG4gICAgICBwYWRkaW5nOiAxMnB4IDEycHggMTJweCAxNnB4O1xuICAgICAgYm9yZGVyLWJvdHRvbTogMXB4IHNvbGlkIHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xNSk7XG4gICAgICBmbGV4LXNocmluazogMDtcbiAgICB9XG5cbiAgICAuaGVhZGVyLWxlZnQge1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBnYXA6IDEwcHg7XG4gICAgfVxuXG4gICAgLmNlcy1sb2dvLXNtIHtcbiAgICAgIHdpZHRoOiAyOHB4O1xuICAgICAgaGVpZ2h0OiAyOHB4O1xuICAgIH1cblxuICAgIC5oZWFkZXItdGl0bGUge1xuICAgICAgZm9udC1zaXplOiAxNnB4O1xuICAgICAgZm9udC13ZWlnaHQ6IDcwMDtcbiAgICAgIGNvbG9yOiAjZmZmO1xuICAgICAgbGV0dGVyLXNwYWNpbmc6IDAuM3B4O1xuICAgIH1cblxuICAgIC5oZWFkZXItYWN0aW9ucyB7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGdhcDogMDtcbiAgICB9XG5cbiAgICAuYnRuLXNwYWNlciB7XG4gICAgICB3aWR0aDogMTJweDtcbiAgICB9XG5cbiAgICAuaGRyLWJ0biB7XG4gICAgICB3aWR0aDogMzJweDtcbiAgICAgIGhlaWdodDogMzJweDtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDZweCAhaW1wb3J0YW50O1xuICAgICAgdHJhbnNpdGlvbjogYmFja2dyb3VuZCAwLjE1cywgYm94LXNoYWRvdyAwLjE1cztcbiAgICB9XG5cbiAgICAuaGRyLWJ0bjpob3ZlciB7XG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMTUpICFpbXBvcnRhbnQ7XG4gICAgICBib3gtc2hhZG93OiAwIDJweCA4cHggcmdiYSgwLCAwLCAwLCAwLjIpO1xuICAgIH1cblxuICAgIC5oZHItYnRuIG1hdC1pY29uIHtcbiAgICAgIGZvbnQtc2l6ZTogMjBweDtcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuODUpO1xuICAgIH1cblxuICAgIC8qIOKUgOKUgCBDb250ZW50IOKUgOKUgCAqL1xuICAgIC5zaWRlYmFyLWNvbnRlbnQge1xuICAgICAgZmxleDogMTtcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgfVxuXG4gICAgLyog4pSA4pSAIFN0YXR1cyBiYXIg4pSA4pSAICovXG4gICAgLndzLXN0YXR1cyB7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGdhcDogNnB4O1xuICAgICAgcGFkZGluZzogNnB4IDE2cHg7XG4gICAgICBmb250LXNpemU6IDExcHg7XG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjYpO1xuICAgICAgYm9yZGVyLXRvcDogMXB4IHNvbGlkIHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xKTtcbiAgICAgIGZsZXgtc2hyaW5rOiAwO1xuICAgIH1cblxuICAgIC5zdGF0dXMtZG90IHtcbiAgICAgIHdpZHRoOiA2cHg7XG4gICAgICBoZWlnaHQ6IDZweDtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDUwJTtcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC40KTtcbiAgICB9XG5cbiAgICAud3Mtc3RhdHVzLmNvbm5lY3RlZCAuc3RhdHVzLWRvdCB7XG4gICAgICBiYWNrZ3JvdW5kOiAjMjJjNTVlO1xuICAgIH1cblxuICAgIC53cy1zdGF0dXMuY29ubmVjdGluZyAuc3RhdHVzLWRvdCB7XG4gICAgICBiYWNrZ3JvdW5kOiAjZjU5ZTBiO1xuICAgICAgYW5pbWF0aW9uOiBibGluayAxcyBpbmZpbml0ZTtcbiAgICB9XG5cbiAgICBAa2V5ZnJhbWVzIGJsaW5rIHtcbiAgICAgIDUwJSB7IG9wYWNpdHk6IDAuMzsgfVxuICAgIH1cblxuICAgIEBtZWRpYSAobWF4LXdpZHRoOiA0ODBweCkge1xuICAgICAgLnNpZGViYXIge1xuICAgICAgICB3aWR0aDogMTAwJSAhaW1wb3J0YW50O1xuICAgICAgfVxuICAgICAgLnJlc2l6ZS1oYW5kbGUge1xuICAgICAgICBkaXNwbGF5OiBub25lO1xuICAgICAgfVxuICAgIH1cbiAgYF0sXG59KVxuZXhwb3J0IGNsYXNzIENoYXRQYW5lbENvbXBvbmVudCBpbXBsZW1lbnRzIE9uSW5pdCwgT25EZXN0cm95IHtcbiAgaXNPcGVuID0gZmFsc2U7XG4gIGFjdGl2ZVZpZXc6ICdpbmJveCcgfCAnY2hhdCcgfCAnbmV3LWNvbnZlcnNhdGlvbicgfCAnZ3JvdXAtbWFuYWdlcicgfCAnY29udmVyc2F0aW9uLXNldHRpbmdzJyA9ICdpbmJveCc7XG4gIHdzU3RhdHVzOiBzdHJpbmcgPSAnZGlzY29ubmVjdGVkJztcbiAgc2lkZTogU2lkZWJhclNpZGUgPSAncmlnaHQnO1xuICBzaWRlYmFyV2lkdGggPSA0MDA7XG5cbiAgcHJpdmF0ZSBkZWZhdWx0V2lkdGggPSA0MDA7XG4gIHByaXZhdGUgcmVzaXppbmcgPSBmYWxzZTtcbiAgcHJpdmF0ZSByZXNpemVTdGFydFggPSAwO1xuICBwcml2YXRlIHJlc2l6ZVN0YXJ0V2lkdGggPSAwO1xuICBwcml2YXRlIGJvdW5kUmVzaXplTW92ZSA9IHRoaXMub25SZXNpemVNb3ZlLmJpbmQodGhpcyk7XG4gIHByaXZhdGUgYm91bmRSZXNpemVFbmQgPSB0aGlzLm9uUmVzaXplRW5kLmJpbmQodGhpcyk7XG5cbiAgcHJpdmF0ZSBzdWIhOiBTdWJzY3JpcHRpb247XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSBzdG9yZTogTWVzc2FnaW5nU3RvcmVTZXJ2aWNlKSB7fVxuXG4gIG5nT25Jbml0KCk6IHZvaWQge1xuICAgIHRoaXMuc2lkZSA9IHRoaXMuc3RvcmUuZ2V0U2lkZWJhclNpZGUoKTtcbiAgICBjb25zdCBzYXZlZCA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdtZXNzYWdpbmdfc2lkZWJhcl93aWR0aCcpO1xuICAgIGlmIChzYXZlZCkgdGhpcy5zaWRlYmFyV2lkdGggPSBwYXJzZUludChzYXZlZCwgMTApIHx8IHRoaXMuZGVmYXVsdFdpZHRoO1xuXG4gICAgdGhpcy5zdWIgPSBjb21iaW5lTGF0ZXN0KFtcbiAgICAgIHRoaXMuc3RvcmUucGFuZWxPcGVuLFxuICAgICAgdGhpcy5zdG9yZS5hY3RpdmVWaWV3LFxuICAgICAgdGhpcy5zdG9yZS53c1N0YXR1cyxcbiAgICAgIHRoaXMuc3RvcmUuc2lkZWJhclNpZGUsXG4gICAgXSkuc3Vic2NyaWJlKChbb3Blbiwgdmlldywgd3MsIHNpZGVdKSA9PiB7XG4gICAgICB0aGlzLmlzT3BlbiA9IG9wZW47XG4gICAgICB0aGlzLmFjdGl2ZVZpZXcgPSB2aWV3O1xuICAgICAgdGhpcy53c1N0YXR1cyA9IHdzO1xuICAgICAgdGhpcy5zaWRlID0gc2lkZTtcbiAgICB9KTtcbiAgfVxuXG4gIG5nT25EZXN0cm95KCk6IHZvaWQge1xuICAgIHRoaXMuc3ViPy51bnN1YnNjcmliZSgpO1xuICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIHRoaXMuYm91bmRSZXNpemVNb3ZlKTtcbiAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgdGhpcy5ib3VuZFJlc2l6ZUVuZCk7XG4gIH1cblxuICB0b2dnbGVTaWRlKCk6IHZvaWQge1xuICAgIHRoaXMuc3RvcmUudG9nZ2xlU2lkZWJhclNpZGUoKTtcbiAgfVxuXG4gIGNsb3NlKCk6IHZvaWQge1xuICAgIHRoaXMuc3RvcmUuY2xvc2VQYW5lbCgpO1xuICB9XG5cbiAgLy8g4pSA4pSAIFJlc2l6ZSDilIDilIBcbiAgb25SZXNpemVTdGFydChldmVudDogTW91c2VFdmVudCk6IHZvaWQge1xuICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgdGhpcy5yZXNpemluZyA9IHRydWU7XG4gICAgdGhpcy5yZXNpemVTdGFydFggPSBldmVudC5jbGllbnRYO1xuICAgIHRoaXMucmVzaXplU3RhcnRXaWR0aCA9IHRoaXMuc2lkZWJhcldpZHRoO1xuICAgIGRvY3VtZW50LmJvZHkuc3R5bGUuY3Vyc29yID0gJ2V3LXJlc2l6ZSc7XG4gICAgZG9jdW1lbnQuYm9keS5zdHlsZS51c2VyU2VsZWN0ID0gJ25vbmUnO1xuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIHRoaXMuYm91bmRSZXNpemVNb3ZlKTtcbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgdGhpcy5ib3VuZFJlc2l6ZUVuZCk7XG4gIH1cblxuICBwcml2YXRlIG9uUmVzaXplTW92ZShldmVudDogTW91c2VFdmVudCk6IHZvaWQge1xuICAgIGlmICghdGhpcy5yZXNpemluZykgcmV0dXJuO1xuICAgIGNvbnN0IGR4ID0gZXZlbnQuY2xpZW50WCAtIHRoaXMucmVzaXplU3RhcnRYO1xuXG4gICAgaWYgKHRoaXMuc2lkZSA9PT0gJ3JpZ2h0Jykge1xuICAgICAgdGhpcy5zaWRlYmFyV2lkdGggPSBNYXRoLm1heCgyMDAsIHRoaXMucmVzaXplU3RhcnRXaWR0aCAtIGR4KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5zaWRlYmFyV2lkdGggPSBNYXRoLm1heCgyMDAsIHRoaXMucmVzaXplU3RhcnRXaWR0aCArIGR4KTtcbiAgICB9XG5cbiAgICB0aGlzLnNpZGViYXJXaWR0aCA9IE1hdGgubWluKHRoaXMuc2lkZWJhcldpZHRoLCB3aW5kb3cuaW5uZXJXaWR0aCAqIDAuOSk7XG4gIH1cblxuICBwcml2YXRlIG9uUmVzaXplRW5kKCk6IHZvaWQge1xuICAgIGlmICghdGhpcy5yZXNpemluZykgcmV0dXJuO1xuICAgIHRoaXMucmVzaXppbmcgPSBmYWxzZTtcbiAgICBkb2N1bWVudC5ib2R5LnN0eWxlLmN1cnNvciA9ICcnO1xuICAgIGRvY3VtZW50LmJvZHkuc3R5bGUudXNlclNlbGVjdCA9ICcnO1xuICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIHRoaXMuYm91bmRSZXNpemVNb3ZlKTtcbiAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgdGhpcy5ib3VuZFJlc2l6ZUVuZCk7XG4gICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ21lc3NhZ2luZ19zaWRlYmFyX3dpZHRoJywgU3RyaW5nKHRoaXMuc2lkZWJhcldpZHRoKSk7XG4gIH1cbn1cbiJdfQ==