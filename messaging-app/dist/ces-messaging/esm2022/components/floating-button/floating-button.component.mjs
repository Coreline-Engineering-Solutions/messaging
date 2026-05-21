import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { combineLatest } from 'rxjs';
import * as i0 from "@angular/core";
import * as i1 from "../../services/messaging-store.service";
import * as i2 from "@angular/common";
export class FloatingButtonComponent {
    store;
    unreadCount = 0;
    side = 'right';
    isOpen = false;
    isFloating = false;
    sub;
    constructor(store) {
        this.store = store;
    }
    ngOnInit() {
        this.sub = combineLatest([
            this.store.totalUnread,
            this.store.sidebarSide,
            this.store.panelOpen,
            this.store.panelFloating,
        ]).subscribe(([count, side, open, floating]) => {
            this.unreadCount = count;
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
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: FloatingButtonComponent, deps: [{ token: i1.MessagingStoreService }], target: i0.ɵɵFactoryTarget.Component });
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
  `, isInline: true, styles: [".floating-btn{position:fixed;bottom:20px;z-index:10000;cursor:pointer;-webkit-user-select:none;user-select:none}.floating-btn.side-right{right:20px}.floating-btn.side-left{left:20px}.fab-inner{width:44px;height:44px;border-radius:50%;background:#041322;border:2px solid rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;box-shadow:0 3px 16px #0009;transition:transform .2s ease,box-shadow .2s ease,border-color .2s ease;position:relative}.fab-inner:hover{transform:scale(1.1);border-color:#fff6;box-shadow:0 4px 20px #000c}.fab-inner.has-unread{animation:pulse 2s infinite}.floating-btn.panel-open .fab-inner{background:#0a3d62;border-color:#ffffff59}.ces-logo{width:24px;height:24px}.badge{position:absolute;top:-4px;right:-4px;background:#ef4444;color:#fff;border-radius:10px;min-width:18px;height:18px;font-size:10px;font-weight:600;display:flex;align-items:center;justify-content:center;padding:0 4px;border:2px solid #fff}@keyframes pulse{0%,to{box-shadow:0 3px 16px #0009;border-color:#ffffff2e}50%{box-shadow:0 3px 24px #ffffff26;border-color:#fff6}}\n"], dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i2.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }] });
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
        }], ctorParameters: () => [{ type: i1.MessagingStoreService }] });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmxvYXRpbmctYnV0dG9uLmNvbXBvbmVudC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9saWIvY29tcG9uZW50cy9mbG9hdGluZy1idXR0b24vZmxvYXRpbmctYnV0dG9uLmNvbXBvbmVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsU0FBUyxFQUFxQixNQUFNLGVBQWUsQ0FBQztBQUM3RCxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDL0MsT0FBTyxFQUFnQixhQUFhLEVBQUUsTUFBTSxNQUFNLENBQUM7Ozs7QUF3R25ELE1BQU0sT0FBTyx1QkFBdUI7SUFRZDtJQVBwQixXQUFXLEdBQUcsQ0FBQyxDQUFDO0lBQ2hCLElBQUksR0FBZ0IsT0FBTyxDQUFDO0lBQzVCLE1BQU0sR0FBRyxLQUFLLENBQUM7SUFDZixVQUFVLEdBQUcsS0FBSyxDQUFDO0lBRVgsR0FBRyxDQUFnQjtJQUUzQixZQUFvQixLQUE0QjtRQUE1QixVQUFLLEdBQUwsS0FBSyxDQUF1QjtJQUFHLENBQUM7SUFFcEQsUUFBUTtRQUNOLElBQUksQ0FBQyxHQUFHLEdBQUcsYUFBYSxDQUFDO1lBQ3ZCLElBQUksQ0FBQyxLQUFLLENBQUMsV0FBVztZQUN0QixJQUFJLENBQUMsS0FBSyxDQUFDLFdBQVc7WUFDdEIsSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTO1lBQ3BCLElBQUksQ0FBQyxLQUFLLENBQUMsYUFBYTtTQUN6QixDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxLQUFLLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxRQUFRLENBQUMsRUFBRSxFQUFFO1lBQzdDLElBQUksQ0FBQyxXQUFXLEdBQUcsS0FBSyxDQUFDO1lBQ3pCLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO1lBQ2pCLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDO1lBQ25CLElBQUksQ0FBQyxVQUFVLEdBQUcsUUFBUSxDQUFDO1FBQzdCLENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVELFdBQVc7UUFDVCxJQUFJLENBQUMsR0FBRyxFQUFFLFdBQVcsRUFBRSxDQUFDO0lBQzFCLENBQUM7SUFFRCxNQUFNO1FBQ0osSUFBSSxDQUFDLEtBQUssQ0FBQyxXQUFXLEVBQUUsQ0FBQztJQUMzQixDQUFDO3dHQTlCVSx1QkFBdUI7NEZBQXZCLHVCQUF1QiwrRUFoR3hCOzs7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQW9CVCx1b0NBckJTLFlBQVk7OzRGQWlHWCx1QkFBdUI7a0JBcEduQyxTQUFTOytCQUNFLHFCQUFxQixjQUNuQixJQUFJLFdBQ1AsQ0FBQyxZQUFZLENBQUMsWUFDYjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7R0FvQlQiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBDb21wb25lbnQsIE9uSW5pdCwgT25EZXN0cm95IH0gZnJvbSAnQGFuZ3VsYXIvY29yZSc7XHJcbmltcG9ydCB7IENvbW1vbk1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL2NvbW1vbic7XHJcbmltcG9ydCB7IFN1YnNjcmlwdGlvbiwgY29tYmluZUxhdGVzdCB9IGZyb20gJ3J4anMnO1xyXG5pbXBvcnQgeyBNZXNzYWdpbmdTdG9yZVNlcnZpY2UgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9tZXNzYWdpbmctc3RvcmUuc2VydmljZSc7XHJcbmltcG9ydCB7IFNpZGViYXJTaWRlIH0gZnJvbSAnLi4vLi4vbW9kZWxzL21lc3NhZ2luZy5tb2RlbHMnO1xyXG5cclxuQENvbXBvbmVudCh7XHJcbiAgc2VsZWN0b3I6ICdhcHAtZmxvYXRpbmctYnV0dG9uJyxcclxuICBzdGFuZGFsb25lOiB0cnVlLFxyXG4gIGltcG9ydHM6IFtDb21tb25Nb2R1bGVdLFxyXG4gIHRlbXBsYXRlOiBgXHJcbiAgICA8ZGl2XHJcbiAgICAgICpuZ0lmPVwiIWlzT3BlbiB8fCBpc0Zsb2F0aW5nXCJcclxuICAgICAgY2xhc3M9XCJmbG9hdGluZy1idG5cIlxyXG4gICAgICBbY2xhc3Muc2lkZS1sZWZ0XT1cInNpZGUgPT09ICdsZWZ0J1wiXHJcbiAgICAgIFtjbGFzcy5zaWRlLXJpZ2h0XT1cInNpZGUgPT09ICdyaWdodCdcIlxyXG4gICAgICBbY2xhc3MucGFuZWwtb3Blbl09XCJpc09wZW5cIlxyXG4gICAgICAoY2xpY2spPVwidG9nZ2xlKClcIlxyXG4gICAgPlxyXG4gICAgICA8ZGl2IGNsYXNzPVwiZmFiLWlubmVyXCIgW2NsYXNzLmhhcy11bnJlYWRdPVwidW5yZWFkQ291bnQgPiAwXCI+XHJcbiAgICAgICAgPHN2ZyBjbGFzcz1cImNlcy1sb2dvXCIgdmlld0JveD1cIjAgMCAxMDAgMTAwXCIgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiPlxyXG4gICAgICAgICAgPHBhdGggZD1cIk0gMTUgMjAgUSAxNSAxNSAyMCAxNSBMIDgwIDE1IFEgODUgMTUgODUgMjAgTCA4NSA2MCBRIDg1IDY1IDgwIDY1IEwgMzUgNjUgTCAyMCA4MCBMIDIwIDY1IFEgMTUgNjUgMTUgNjAgWlwiXHJcbiAgICAgICAgICAgICAgICBmaWxsPVwibm9uZVwiIHN0cm9rZT1cIndoaXRlXCIgc3Ryb2tlLXdpZHRoPVwiM1wiLz5cclxuICAgICAgICAgIDxnIHRyYW5zZm9ybT1cInRyYW5zbGF0ZSg1MCwgNDApIHNjYWxlKDAuMzUpXCI+XHJcbiAgICAgICAgICAgIDxwYXRoIGQ9XCJNIDAsLTMwIEwgMjUsLTE1IEwgMjUsMTUgTCAwLDMwIEwgLTI1LDE1IEwgLTI1LC0xNSBaXCIgZmlsbD1cIndoaXRlXCIvPlxyXG4gICAgICAgICAgPC9nPlxyXG4gICAgICAgIDwvc3ZnPlxyXG4gICAgICAgIDxzcGFuICpuZ0lmPVwidW5yZWFkQ291bnQgPiAwXCIgY2xhc3M9XCJiYWRnZVwiPnt7IHVucmVhZENvdW50ID4gOTkgPyAnOTkrJyA6IHVucmVhZENvdW50IH19PC9zcGFuPlxyXG4gICAgICA8L2Rpdj5cclxuICAgIDwvZGl2PlxyXG4gIGAsXHJcbiAgc3R5bGVzOiBbYFxyXG4gICAgLmZsb2F0aW5nLWJ0biB7XHJcbiAgICAgIHBvc2l0aW9uOiBmaXhlZDtcclxuICAgICAgYm90dG9tOiAyMHB4O1xyXG4gICAgICB6LWluZGV4OiAxMDAwMDtcclxuICAgICAgY3Vyc29yOiBwb2ludGVyO1xyXG4gICAgICB1c2VyLXNlbGVjdDogbm9uZTtcclxuICAgIH1cclxuXHJcbiAgICAuZmxvYXRpbmctYnRuLnNpZGUtcmlnaHQge1xyXG4gICAgICByaWdodDogMjBweDtcclxuICAgIH1cclxuXHJcbiAgICAuZmxvYXRpbmctYnRuLnNpZGUtbGVmdCB7XHJcbiAgICAgIGxlZnQ6IDIwcHg7XHJcbiAgICB9XHJcblxyXG4gICAgLmZhYi1pbm5lciB7XHJcbiAgICAgIHdpZHRoOiA0NHB4O1xyXG4gICAgICBoZWlnaHQ6IDQ0cHg7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDUwJTtcclxuICAgICAgYmFja2dyb3VuZDogIzA0MTMyMjtcclxuICAgICAgYm9yZGVyOiAycHggc29saWQgcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjE4KTtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XHJcbiAgICAgIGJveC1zaGFkb3c6IDAgM3B4IDE2cHggcmdiYSgwLCAwLCAwLCAwLjYpO1xyXG4gICAgICB0cmFuc2l0aW9uOiB0cmFuc2Zvcm0gMC4ycyBlYXNlLCBib3gtc2hhZG93IDAuMnMgZWFzZSwgYm9yZGVyLWNvbG9yIDAuMnMgZWFzZTtcclxuICAgICAgcG9zaXRpb246IHJlbGF0aXZlO1xyXG4gICAgfVxyXG5cclxuICAgIC5mYWItaW5uZXI6aG92ZXIge1xyXG4gICAgICB0cmFuc2Zvcm06IHNjYWxlKDEuMSk7XHJcbiAgICAgIGJvcmRlci1jb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjQpO1xyXG4gICAgICBib3gtc2hhZG93OiAwIDRweCAyMHB4IHJnYmEoMCwgMCwgMCwgMC44KTtcclxuICAgIH1cclxuXHJcbiAgICAuZmFiLWlubmVyLmhhcy11bnJlYWQge1xyXG4gICAgICBhbmltYXRpb246IHB1bHNlIDJzIGluZmluaXRlO1xyXG4gICAgfVxyXG5cclxuICAgIC5mbG9hdGluZy1idG4ucGFuZWwtb3BlbiAuZmFiLWlubmVyIHtcclxuICAgICAgYmFja2dyb3VuZDogIzBhM2Q2MjtcclxuICAgICAgYm9yZGVyLWNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMzUpO1xyXG4gICAgfVxyXG5cclxuICAgIC5jZXMtbG9nbyB7XHJcbiAgICAgIHdpZHRoOiAyNHB4O1xyXG4gICAgICBoZWlnaHQ6IDI0cHg7XHJcbiAgICB9XHJcblxyXG4gICAgLmJhZGdlIHtcclxuICAgICAgcG9zaXRpb246IGFic29sdXRlO1xyXG4gICAgICB0b3A6IC00cHg7XHJcbiAgICAgIHJpZ2h0OiAtNHB4O1xyXG4gICAgICBiYWNrZ3JvdW5kOiAjZWY0NDQ0O1xyXG4gICAgICBjb2xvcjogI2ZmZjtcclxuICAgICAgYm9yZGVyLXJhZGl1czogMTBweDtcclxuICAgICAgbWluLXdpZHRoOiAxOHB4O1xyXG4gICAgICBoZWlnaHQ6IDE4cHg7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTBweDtcclxuICAgICAgZm9udC13ZWlnaHQ6IDYwMDtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XHJcbiAgICAgIHBhZGRpbmc6IDAgNHB4O1xyXG4gICAgICBib3JkZXI6IDJweCBzb2xpZCAjZmZmO1xyXG4gICAgfVxyXG5cclxuICAgIEBrZXlmcmFtZXMgcHVsc2Uge1xyXG4gICAgICAwJSwgMTAwJSB7IGJveC1zaGFkb3c6IDAgM3B4IDE2cHggcmdiYSgwLCAwLCAwLCAwLjYpOyBib3JkZXItY29sb3I6IHJnYmEoMjU1LDI1NSwyNTUsMC4xOCk7IH1cclxuICAgICAgNTAlIHsgYm94LXNoYWRvdzogMCAzcHggMjRweCByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMTUpOyBib3JkZXItY29sb3I6IHJnYmEoMjU1LDI1NSwyNTUsMC40KTsgfVxyXG4gICAgfVxyXG4gIGBdLFxyXG59KVxyXG5leHBvcnQgY2xhc3MgRmxvYXRpbmdCdXR0b25Db21wb25lbnQgaW1wbGVtZW50cyBPbkluaXQsIE9uRGVzdHJveSB7XHJcbiAgdW5yZWFkQ291bnQgPSAwO1xyXG4gIHNpZGU6IFNpZGViYXJTaWRlID0gJ3JpZ2h0JztcclxuICBpc09wZW4gPSBmYWxzZTtcclxuICBpc0Zsb2F0aW5nID0gZmFsc2U7XHJcblxyXG4gIHByaXZhdGUgc3ViITogU3Vic2NyaXB0aW9uO1xyXG5cclxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHN0b3JlOiBNZXNzYWdpbmdTdG9yZVNlcnZpY2UpIHt9XHJcblxyXG4gIG5nT25Jbml0KCk6IHZvaWQge1xyXG4gICAgdGhpcy5zdWIgPSBjb21iaW5lTGF0ZXN0KFtcclxuICAgICAgdGhpcy5zdG9yZS50b3RhbFVucmVhZCxcclxuICAgICAgdGhpcy5zdG9yZS5zaWRlYmFyU2lkZSxcclxuICAgICAgdGhpcy5zdG9yZS5wYW5lbE9wZW4sXHJcbiAgICAgIHRoaXMuc3RvcmUucGFuZWxGbG9hdGluZyxcclxuICAgIF0pLnN1YnNjcmliZSgoW2NvdW50LCBzaWRlLCBvcGVuLCBmbG9hdGluZ10pID0+IHtcclxuICAgICAgdGhpcy51bnJlYWRDb3VudCA9IGNvdW50O1xyXG4gICAgICB0aGlzLnNpZGUgPSBzaWRlO1xyXG4gICAgICB0aGlzLmlzT3BlbiA9IG9wZW47XHJcbiAgICAgIHRoaXMuaXNGbG9hdGluZyA9IGZsb2F0aW5nO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBuZ09uRGVzdHJveSgpOiB2b2lkIHtcclxuICAgIHRoaXMuc3ViPy51bnN1YnNjcmliZSgpO1xyXG4gIH1cclxuXHJcbiAgdG9nZ2xlKCk6IHZvaWQge1xyXG4gICAgdGhpcy5zdG9yZS50b2dnbGVQYW5lbCgpO1xyXG4gIH1cclxufVxyXG4iXX0=