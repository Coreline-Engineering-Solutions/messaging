import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { combineLatest, of } from 'rxjs';
import * as i0 from "@angular/core";
import * as i1 from "../../services/messaging-store.service";
import * as i2 from "../../services/ticket-notification.service";
import * as i3 from "@angular/common";
export class FloatingButtonComponent {
    store;
    ticketNotifications;
    unreadCount = 0;
    side = 'right';
    isOpen = false;
    isFloating = false;
    sub;
    constructor(store, ticketNotifications) {
        this.store = store;
        this.ticketNotifications = ticketNotifications;
    }
    ngOnInit() {
        this.sub = combineLatest([
            this.store.totalUnread,
            this.ticketNotifications.enabled ? this.ticketNotifications.unseenCount : of(0),
            this.store.sidebarSide,
            this.store.panelOpen,
            this.store.panelFloating,
        ]).subscribe(([messageCount, ticketCount, side, open, floating]) => {
            this.unreadCount = messageCount + ticketCount;
            this.side = side;
            this.isOpen = open;
            this.isFloating = floating;
        });
    }
    ngOnDestroy() {
        this.sub?.unsubscribe();
    }
    toggle() {
        this.store.togglePanel();
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: FloatingButtonComponent, deps: [{ token: i1.MessagingStoreService }, { token: i2.TicketNotificationService }], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "17.3.12", type: FloatingButtonComponent, isStandalone: true, selector: "app-floating-button", ngImport: i0, template: `
    <div
      *ngIf="!isOpen || isFloating"
      class="floating-btn"
      [class.side-left]="side === 'left'"
      [class.side-right]="side === 'right'"
      [class.panel-open]="isOpen"
      (click)="toggle()"
    >
      <div class="fab-inner" [class.has-unread]="unreadCount > 0">
        <svg class="ces-logo" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <path d="M 15 20 Q 15 15 20 15 L 80 15 Q 85 15 85 20 L 85 60 Q 85 65 80 65 L 35 65 L 20 80 L 20 65 Q 15 65 15 60 Z"
                fill="none" stroke="white" stroke-width="3"/>
          <g transform="translate(50, 40) scale(0.35)">
            <path d="M 0,-30 L 25,-15 L 25,15 L 0,30 L -25,15 L -25,-15 Z" fill="white"/>
          </g>
        </svg>
        <span *ngIf="unreadCount > 0" class="badge">{{ unreadCount > 99 ? '99+' : unreadCount }}</span>
      </div>
    </div>
  `, isInline: true, styles: [".floating-btn{position:fixed;bottom:20px;z-index:10000;cursor:pointer;-webkit-user-select:none;user-select:none}.floating-btn.side-right{right:20px}.floating-btn.side-left{left:20px}.fab-inner{width:44px;height:44px;border-radius:50%;background:#041322;border:2px solid rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;box-shadow:0 3px 16px #0009;transition:transform .2s ease,box-shadow .2s ease,border-color .2s ease;position:relative}.fab-inner:hover{transform:scale(1.1);border-color:#fff6;box-shadow:0 4px 20px #000c}.fab-inner.has-unread{animation:pulse 2s infinite}.floating-btn.panel-open .fab-inner{background:#0a3d62;border-color:#ffffff59}.ces-logo{width:24px;height:24px}.badge{position:absolute;top:-4px;right:-4px;background:#ef4444;color:#fff;border-radius:10px;min-width:18px;height:18px;font-size:10px;font-weight:600;display:flex;align-items:center;justify-content:center;padding:0 4px;border:2px solid #fff}@keyframes pulse{0%,to{box-shadow:0 3px 16px #0009;border-color:#ffffff2e}50%{box-shadow:0 3px 24px #ffffff26;border-color:#fff6}}\n"], dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i3.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: FloatingButtonComponent, decorators: [{
            type: Component,
            args: [{ selector: 'app-floating-button', standalone: true, imports: [CommonModule], template: `
    <div
      *ngIf="!isOpen || isFloating"
      class="floating-btn"
      [class.side-left]="side === 'left'"
      [class.side-right]="side === 'right'"
      [class.panel-open]="isOpen"
      (click)="toggle()"
    >
      <div class="fab-inner" [class.has-unread]="unreadCount > 0">
        <svg class="ces-logo" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <path d="M 15 20 Q 15 15 20 15 L 80 15 Q 85 15 85 20 L 85 60 Q 85 65 80 65 L 35 65 L 20 80 L 20 65 Q 15 65 15 60 Z"
                fill="none" stroke="white" stroke-width="3"/>
          <g transform="translate(50, 40) scale(0.35)">
            <path d="M 0,-30 L 25,-15 L 25,15 L 0,30 L -25,15 L -25,-15 Z" fill="white"/>
          </g>
        </svg>
        <span *ngIf="unreadCount > 0" class="badge">{{ unreadCount > 99 ? '99+' : unreadCount }}</span>
      </div>
    </div>
  `, styles: [".floating-btn{position:fixed;bottom:20px;z-index:10000;cursor:pointer;-webkit-user-select:none;user-select:none}.floating-btn.side-right{right:20px}.floating-btn.side-left{left:20px}.fab-inner{width:44px;height:44px;border-radius:50%;background:#041322;border:2px solid rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;box-shadow:0 3px 16px #0009;transition:transform .2s ease,box-shadow .2s ease,border-color .2s ease;position:relative}.fab-inner:hover{transform:scale(1.1);border-color:#fff6;box-shadow:0 4px 20px #000c}.fab-inner.has-unread{animation:pulse 2s infinite}.floating-btn.panel-open .fab-inner{background:#0a3d62;border-color:#ffffff59}.ces-logo{width:24px;height:24px}.badge{position:absolute;top:-4px;right:-4px;background:#ef4444;color:#fff;border-radius:10px;min-width:18px;height:18px;font-size:10px;font-weight:600;display:flex;align-items:center;justify-content:center;padding:0 4px;border:2px solid #fff}@keyframes pulse{0%,to{box-shadow:0 3px 16px #0009;border-color:#ffffff2e}50%{box-shadow:0 3px 24px #ffffff26;border-color:#fff6}}\n"] }]
        }], ctorParameters: () => [{ type: i1.MessagingStoreService }, { type: i2.TicketNotificationService }] });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmxvYXRpbmctYnV0dG9uLmNvbXBvbmVudC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9saWIvY29tcG9uZW50cy9mbG9hdGluZy1idXR0b24vZmxvYXRpbmctYnV0dG9uLmNvbXBvbmVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsU0FBUyxFQUFxQixNQUFNLGVBQWUsQ0FBQztBQUM3RCxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDL0MsT0FBTyxFQUFnQixhQUFhLEVBQUUsRUFBRSxFQUFFLE1BQU0sTUFBTSxDQUFDOzs7OztBQXlHdkQsTUFBTSxPQUFPLHVCQUF1QjtJQVN4QjtJQUNBO0lBVFYsV0FBVyxHQUFHLENBQUMsQ0FBQztJQUNoQixJQUFJLEdBQWdCLE9BQU8sQ0FBQztJQUM1QixNQUFNLEdBQUcsS0FBSyxDQUFDO0lBQ2YsVUFBVSxHQUFHLEtBQUssQ0FBQztJQUVYLEdBQUcsQ0FBZ0I7SUFFM0IsWUFDVSxLQUE0QixFQUM1QixtQkFBOEM7UUFEOUMsVUFBSyxHQUFMLEtBQUssQ0FBdUI7UUFDNUIsd0JBQW1CLEdBQW5CLG1CQUFtQixDQUEyQjtJQUNyRCxDQUFDO0lBRUosUUFBUTtRQUNOLElBQUksQ0FBQyxHQUFHLEdBQUcsYUFBYSxDQUFDO1lBQ3ZCLElBQUksQ0FBQyxLQUFLLENBQUMsV0FBVztZQUN0QixJQUFJLENBQUMsbUJBQW1CLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsbUJBQW1CLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQy9FLElBQUksQ0FBQyxLQUFLLENBQUMsV0FBVztZQUN0QixJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVM7WUFDcEIsSUFBSSxDQUFDLEtBQUssQ0FBQyxhQUFhO1NBQ3pCLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLFlBQVksRUFBRSxXQUFXLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxRQUFRLENBQUMsRUFBRSxFQUFFO1lBQ2pFLElBQUksQ0FBQyxXQUFXLEdBQUcsWUFBWSxHQUFHLFdBQVcsQ0FBQztZQUM5QyxJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQztZQUNqQixJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQztZQUNuQixJQUFJLENBQUMsVUFBVSxHQUFHLFFBQVEsQ0FBQztRQUM3QixDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRCxXQUFXO1FBQ1QsSUFBSSxDQUFDLEdBQUcsRUFBRSxXQUFXLEVBQUUsQ0FBQztJQUMxQixDQUFDO0lBRUQsTUFBTTtRQUNKLElBQUksQ0FBQyxLQUFLLENBQUMsV0FBVyxFQUFFLENBQUM7SUFDM0IsQ0FBQzt3R0FsQ1UsdUJBQXVCOzRGQUF2Qix1QkFBdUIsK0VBaEd4Qjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7R0FvQlQsdW9DQXJCUyxZQUFZOzs0RkFpR1gsdUJBQXVCO2tCQXBHbkMsU0FBUzsrQkFDRSxxQkFBcUIsY0FDbkIsSUFBSSxXQUNQLENBQUMsWUFBWSxDQUFDLFlBQ2I7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBb0JUIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQ29tcG9uZW50LCBPbkluaXQsIE9uRGVzdHJveSB9IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xyXG5pbXBvcnQgeyBDb21tb25Nb2R1bGUgfSBmcm9tICdAYW5ndWxhci9jb21tb24nO1xyXG5pbXBvcnQgeyBTdWJzY3JpcHRpb24sIGNvbWJpbmVMYXRlc3QsIG9mIH0gZnJvbSAncnhqcyc7XHJcbmltcG9ydCB7IE1lc3NhZ2luZ1N0b3JlU2VydmljZSB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL21lc3NhZ2luZy1zdG9yZS5zZXJ2aWNlJztcclxuaW1wb3J0IHsgVGlja2V0Tm90aWZpY2F0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL3RpY2tldC1ub3RpZmljYXRpb24uc2VydmljZSc7XHJcbmltcG9ydCB7IFNpZGViYXJTaWRlIH0gZnJvbSAnLi4vLi4vbW9kZWxzL21lc3NhZ2luZy5tb2RlbHMnO1xyXG5cclxuQENvbXBvbmVudCh7XHJcbiAgc2VsZWN0b3I6ICdhcHAtZmxvYXRpbmctYnV0dG9uJyxcclxuICBzdGFuZGFsb25lOiB0cnVlLFxyXG4gIGltcG9ydHM6IFtDb21tb25Nb2R1bGVdLFxyXG4gIHRlbXBsYXRlOiBgXHJcbiAgICA8ZGl2XHJcbiAgICAgICpuZ0lmPVwiIWlzT3BlbiB8fCBpc0Zsb2F0aW5nXCJcclxuICAgICAgY2xhc3M9XCJmbG9hdGluZy1idG5cIlxyXG4gICAgICBbY2xhc3Muc2lkZS1sZWZ0XT1cInNpZGUgPT09ICdsZWZ0J1wiXHJcbiAgICAgIFtjbGFzcy5zaWRlLXJpZ2h0XT1cInNpZGUgPT09ICdyaWdodCdcIlxyXG4gICAgICBbY2xhc3MucGFuZWwtb3Blbl09XCJpc09wZW5cIlxyXG4gICAgICAoY2xpY2spPVwidG9nZ2xlKClcIlxyXG4gICAgPlxyXG4gICAgICA8ZGl2IGNsYXNzPVwiZmFiLWlubmVyXCIgW2NsYXNzLmhhcy11bnJlYWRdPVwidW5yZWFkQ291bnQgPiAwXCI+XHJcbiAgICAgICAgPHN2ZyBjbGFzcz1cImNlcy1sb2dvXCIgdmlld0JveD1cIjAgMCAxMDAgMTAwXCIgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiPlxyXG4gICAgICAgICAgPHBhdGggZD1cIk0gMTUgMjAgUSAxNSAxNSAyMCAxNSBMIDgwIDE1IFEgODUgMTUgODUgMjAgTCA4NSA2MCBRIDg1IDY1IDgwIDY1IEwgMzUgNjUgTCAyMCA4MCBMIDIwIDY1IFEgMTUgNjUgMTUgNjAgWlwiXHJcbiAgICAgICAgICAgICAgICBmaWxsPVwibm9uZVwiIHN0cm9rZT1cIndoaXRlXCIgc3Ryb2tlLXdpZHRoPVwiM1wiLz5cclxuICAgICAgICAgIDxnIHRyYW5zZm9ybT1cInRyYW5zbGF0ZSg1MCwgNDApIHNjYWxlKDAuMzUpXCI+XHJcbiAgICAgICAgICAgIDxwYXRoIGQ9XCJNIDAsLTMwIEwgMjUsLTE1IEwgMjUsMTUgTCAwLDMwIEwgLTI1LDE1IEwgLTI1LC0xNSBaXCIgZmlsbD1cIndoaXRlXCIvPlxyXG4gICAgICAgICAgPC9nPlxyXG4gICAgICAgIDwvc3ZnPlxyXG4gICAgICAgIDxzcGFuICpuZ0lmPVwidW5yZWFkQ291bnQgPiAwXCIgY2xhc3M9XCJiYWRnZVwiPnt7IHVucmVhZENvdW50ID4gOTkgPyAnOTkrJyA6IHVucmVhZENvdW50IH19PC9zcGFuPlxyXG4gICAgICA8L2Rpdj5cclxuICAgIDwvZGl2PlxyXG4gIGAsXHJcbiAgc3R5bGVzOiBbYFxyXG4gICAgLmZsb2F0aW5nLWJ0biB7XHJcbiAgICAgIHBvc2l0aW9uOiBmaXhlZDtcclxuICAgICAgYm90dG9tOiAyMHB4O1xyXG4gICAgICB6LWluZGV4OiAxMDAwMDtcclxuICAgICAgY3Vyc29yOiBwb2ludGVyO1xyXG4gICAgICB1c2VyLXNlbGVjdDogbm9uZTtcclxuICAgIH1cclxuXHJcbiAgICAuZmxvYXRpbmctYnRuLnNpZGUtcmlnaHQge1xyXG4gICAgICByaWdodDogMjBweDtcclxuICAgIH1cclxuXHJcbiAgICAuZmxvYXRpbmctYnRuLnNpZGUtbGVmdCB7XHJcbiAgICAgIGxlZnQ6IDIwcHg7XHJcbiAgICB9XHJcblxyXG4gICAgLmZhYi1pbm5lciB7XHJcbiAgICAgIHdpZHRoOiA0NHB4O1xyXG4gICAgICBoZWlnaHQ6IDQ0cHg7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDUwJTtcclxuICAgICAgYmFja2dyb3VuZDogIzA0MTMyMjtcclxuICAgICAgYm9yZGVyOiAycHggc29saWQgcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjE4KTtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XHJcbiAgICAgIGJveC1zaGFkb3c6IDAgM3B4IDE2cHggcmdiYSgwLCAwLCAwLCAwLjYpO1xyXG4gICAgICB0cmFuc2l0aW9uOiB0cmFuc2Zvcm0gMC4ycyBlYXNlLCBib3gtc2hhZG93IDAuMnMgZWFzZSwgYm9yZGVyLWNvbG9yIDAuMnMgZWFzZTtcclxuICAgICAgcG9zaXRpb246IHJlbGF0aXZlO1xyXG4gICAgfVxyXG5cclxuICAgIC5mYWItaW5uZXI6aG92ZXIge1xyXG4gICAgICB0cmFuc2Zvcm06IHNjYWxlKDEuMSk7XHJcbiAgICAgIGJvcmRlci1jb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjQpO1xyXG4gICAgICBib3gtc2hhZG93OiAwIDRweCAyMHB4IHJnYmEoMCwgMCwgMCwgMC44KTtcclxuICAgIH1cclxuXHJcbiAgICAuZmFiLWlubmVyLmhhcy11bnJlYWQge1xyXG4gICAgICBhbmltYXRpb246IHB1bHNlIDJzIGluZmluaXRlO1xyXG4gICAgfVxyXG5cclxuICAgIC5mbG9hdGluZy1idG4ucGFuZWwtb3BlbiAuZmFiLWlubmVyIHtcclxuICAgICAgYmFja2dyb3VuZDogIzBhM2Q2MjtcclxuICAgICAgYm9yZGVyLWNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMzUpO1xyXG4gICAgfVxyXG5cclxuICAgIC5jZXMtbG9nbyB7XHJcbiAgICAgIHdpZHRoOiAyNHB4O1xyXG4gICAgICBoZWlnaHQ6IDI0cHg7XHJcbiAgICB9XHJcblxyXG4gICAgLmJhZGdlIHtcclxuICAgICAgcG9zaXRpb246IGFic29sdXRlO1xyXG4gICAgICB0b3A6IC00cHg7XHJcbiAgICAgIHJpZ2h0OiAtNHB4O1xyXG4gICAgICBiYWNrZ3JvdW5kOiAjZWY0NDQ0O1xyXG4gICAgICBjb2xvcjogI2ZmZjtcclxuICAgICAgYm9yZGVyLXJhZGl1czogMTBweDtcclxuICAgICAgbWluLXdpZHRoOiAxOHB4O1xyXG4gICAgICBoZWlnaHQ6IDE4cHg7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTBweDtcclxuICAgICAgZm9udC13ZWlnaHQ6IDYwMDtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XHJcbiAgICAgIHBhZGRpbmc6IDAgNHB4O1xyXG4gICAgICBib3JkZXI6IDJweCBzb2xpZCAjZmZmO1xyXG4gICAgfVxyXG5cclxuICAgIEBrZXlmcmFtZXMgcHVsc2Uge1xyXG4gICAgICAwJSwgMTAwJSB7IGJveC1zaGFkb3c6IDAgM3B4IDE2cHggcmdiYSgwLCAwLCAwLCAwLjYpOyBib3JkZXItY29sb3I6IHJnYmEoMjU1LDI1NSwyNTUsMC4xOCk7IH1cclxuICAgICAgNTAlIHsgYm94LXNoYWRvdzogMCAzcHggMjRweCByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMTUpOyBib3JkZXItY29sb3I6IHJnYmEoMjU1LDI1NSwyNTUsMC40KTsgfVxyXG4gICAgfVxyXG4gIGBdLFxyXG59KVxyXG5leHBvcnQgY2xhc3MgRmxvYXRpbmdCdXR0b25Db21wb25lbnQgaW1wbGVtZW50cyBPbkluaXQsIE9uRGVzdHJveSB7XHJcbiAgdW5yZWFkQ291bnQgPSAwO1xyXG4gIHNpZGU6IFNpZGViYXJTaWRlID0gJ3JpZ2h0JztcclxuICBpc09wZW4gPSBmYWxzZTtcclxuICBpc0Zsb2F0aW5nID0gZmFsc2U7XHJcblxyXG4gIHByaXZhdGUgc3ViITogU3Vic2NyaXB0aW9uO1xyXG5cclxuICBjb25zdHJ1Y3RvcihcclxuICAgIHByaXZhdGUgc3RvcmU6IE1lc3NhZ2luZ1N0b3JlU2VydmljZSxcclxuICAgIHByaXZhdGUgdGlja2V0Tm90aWZpY2F0aW9uczogVGlja2V0Tm90aWZpY2F0aW9uU2VydmljZVxyXG4gICkge31cclxuXHJcbiAgbmdPbkluaXQoKTogdm9pZCB7XHJcbiAgICB0aGlzLnN1YiA9IGNvbWJpbmVMYXRlc3QoW1xyXG4gICAgICB0aGlzLnN0b3JlLnRvdGFsVW5yZWFkLFxyXG4gICAgICB0aGlzLnRpY2tldE5vdGlmaWNhdGlvbnMuZW5hYmxlZCA/IHRoaXMudGlja2V0Tm90aWZpY2F0aW9ucy51bnNlZW5Db3VudCA6IG9mKDApLFxyXG4gICAgICB0aGlzLnN0b3JlLnNpZGViYXJTaWRlLFxyXG4gICAgICB0aGlzLnN0b3JlLnBhbmVsT3BlbixcclxuICAgICAgdGhpcy5zdG9yZS5wYW5lbEZsb2F0aW5nLFxyXG4gICAgXSkuc3Vic2NyaWJlKChbbWVzc2FnZUNvdW50LCB0aWNrZXRDb3VudCwgc2lkZSwgb3BlbiwgZmxvYXRpbmddKSA9PiB7XHJcbiAgICAgIHRoaXMudW5yZWFkQ291bnQgPSBtZXNzYWdlQ291bnQgKyB0aWNrZXRDb3VudDtcclxuICAgICAgdGhpcy5zaWRlID0gc2lkZTtcclxuICAgICAgdGhpcy5pc09wZW4gPSBvcGVuO1xyXG4gICAgICB0aGlzLmlzRmxvYXRpbmcgPSBmbG9hdGluZztcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgbmdPbkRlc3Ryb3koKTogdm9pZCB7XHJcbiAgICB0aGlzLnN1Yj8udW5zdWJzY3JpYmUoKTtcclxuICB9XHJcblxyXG4gIHRvZ2dsZSgpOiB2b2lkIHtcclxuICAgIHRoaXMuc3RvcmUudG9nZ2xlUGFuZWwoKTtcclxuICB9XHJcbn1cclxuIl19