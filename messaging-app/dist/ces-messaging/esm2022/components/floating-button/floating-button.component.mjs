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
    sub;
    constructor(store) {
        this.store = store;
    }
    ngOnInit() {
        this.sub = combineLatest([
            this.store.totalUnread,
            this.store.sidebarSide,
            this.store.panelOpen,
        ]).subscribe(([count, side, open]) => {
            this.unreadCount = count;
            this.side = side;
            this.isOpen = open;
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
      *ngIf="!isOpen"
      class="floating-btn"
      [class.side-left]="side === 'left'"
      [class.side-right]="side === 'right'"
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
  `, isInline: true, styles: [".floating-btn{position:fixed;bottom:20px;z-index:10000;cursor:pointer;-webkit-user-select:none;user-select:none}.floating-btn.side-right{right:20px}.floating-btn.side-left{left:20px}.fab-inner{width:44px;height:44px;border-radius:50%;background:#041322;border:2px solid rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;box-shadow:0 3px 16px #0009;transition:transform .2s ease,box-shadow .2s ease,border-color .2s ease;position:relative}.fab-inner:hover{transform:scale(1.1);border-color:#fff6;box-shadow:0 4px 20px #000c}.fab-inner.has-unread{animation:pulse 2s infinite}.ces-logo{width:24px;height:24px}.badge{position:absolute;top:-4px;right:-4px;background:#ef4444;color:#fff;border-radius:10px;min-width:18px;height:18px;font-size:10px;font-weight:600;display:flex;align-items:center;justify-content:center;padding:0 4px;border:2px solid #fff}@keyframes pulse{0%,to{box-shadow:0 3px 16px #0009;border-color:#ffffff2e}50%{box-shadow:0 3px 24px #ffffff26;border-color:#fff6}}\n"], dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i2.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: FloatingButtonComponent, decorators: [{
            type: Component,
            args: [{ selector: 'app-floating-button', standalone: true, imports: [CommonModule], template: `
    <div
      *ngIf="!isOpen"
      class="floating-btn"
      [class.side-left]="side === 'left'"
      [class.side-right]="side === 'right'"
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
  `, styles: [".floating-btn{position:fixed;bottom:20px;z-index:10000;cursor:pointer;-webkit-user-select:none;user-select:none}.floating-btn.side-right{right:20px}.floating-btn.side-left{left:20px}.fab-inner{width:44px;height:44px;border-radius:50%;background:#041322;border:2px solid rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;box-shadow:0 3px 16px #0009;transition:transform .2s ease,box-shadow .2s ease,border-color .2s ease;position:relative}.fab-inner:hover{transform:scale(1.1);border-color:#fff6;box-shadow:0 4px 20px #000c}.fab-inner.has-unread{animation:pulse 2s infinite}.ces-logo{width:24px;height:24px}.badge{position:absolute;top:-4px;right:-4px;background:#ef4444;color:#fff;border-radius:10px;min-width:18px;height:18px;font-size:10px;font-weight:600;display:flex;align-items:center;justify-content:center;padding:0 4px;border:2px solid #fff}@keyframes pulse{0%,to{box-shadow:0 3px 16px #0009;border-color:#ffffff2e}50%{box-shadow:0 3px 24px #ffffff26;border-color:#fff6}}\n"] }]
        }], ctorParameters: () => [{ type: i1.MessagingStoreService }] });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmxvYXRpbmctYnV0dG9uLmNvbXBvbmVudC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9saWIvY29tcG9uZW50cy9mbG9hdGluZy1idXR0b24vZmxvYXRpbmctYnV0dG9uLmNvbXBvbmVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsU0FBUyxFQUFxQixNQUFNLGVBQWUsQ0FBQztBQUM3RCxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDL0MsT0FBTyxFQUFnQixhQUFhLEVBQUUsTUFBTSxNQUFNLENBQUM7Ozs7QUFrR25ELE1BQU0sT0FBTyx1QkFBdUI7SUFPZDtJQU5wQixXQUFXLEdBQUcsQ0FBQyxDQUFDO0lBQ2hCLElBQUksR0FBZ0IsT0FBTyxDQUFDO0lBQzVCLE1BQU0sR0FBRyxLQUFLLENBQUM7SUFFUCxHQUFHLENBQWdCO0lBRTNCLFlBQW9CLEtBQTRCO1FBQTVCLFVBQUssR0FBTCxLQUFLLENBQXVCO0lBQUcsQ0FBQztJQUVwRCxRQUFRO1FBQ04sSUFBSSxDQUFDLEdBQUcsR0FBRyxhQUFhLENBQUM7WUFDdkIsSUFBSSxDQUFDLEtBQUssQ0FBQyxXQUFXO1lBQ3RCLElBQUksQ0FBQyxLQUFLLENBQUMsV0FBVztZQUN0QixJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVM7U0FDckIsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsS0FBSyxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsRUFBRSxFQUFFO1lBQ25DLElBQUksQ0FBQyxXQUFXLEdBQUcsS0FBSyxDQUFDO1lBQ3pCLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO1lBQ2pCLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDO1FBQ3JCLENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVELFdBQVc7UUFDVCxJQUFJLENBQUMsR0FBRyxFQUFFLFdBQVcsRUFBRSxDQUFDO0lBQzFCLENBQUM7SUFFRCxNQUFNO1FBQ0osSUFBSSxDQUFDLEtBQUssQ0FBQyxXQUFXLEVBQUUsQ0FBQztJQUMzQixDQUFDO3dHQTNCVSx1QkFBdUI7NEZBQXZCLHVCQUF1QiwrRUExRnhCOzs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBbUJULHlqQ0FwQlMsWUFBWTs7NEZBMkZYLHVCQUF1QjtrQkE5Rm5DLFNBQVM7K0JBQ0UscUJBQXFCLGNBQ25CLElBQUksV0FDUCxDQUFDLFlBQVksQ0FBQyxZQUNiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBbUJUIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQ29tcG9uZW50LCBPbkluaXQsIE9uRGVzdHJveSB9IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xyXG5pbXBvcnQgeyBDb21tb25Nb2R1bGUgfSBmcm9tICdAYW5ndWxhci9jb21tb24nO1xyXG5pbXBvcnQgeyBTdWJzY3JpcHRpb24sIGNvbWJpbmVMYXRlc3QgfSBmcm9tICdyeGpzJztcclxuaW1wb3J0IHsgTWVzc2FnaW5nU3RvcmVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvbWVzc2FnaW5nLXN0b3JlLnNlcnZpY2UnO1xyXG5pbXBvcnQgeyBTaWRlYmFyU2lkZSB9IGZyb20gJy4uLy4uL21vZGVscy9tZXNzYWdpbmcubW9kZWxzJztcclxuXHJcbkBDb21wb25lbnQoe1xyXG4gIHNlbGVjdG9yOiAnYXBwLWZsb2F0aW5nLWJ1dHRvbicsXHJcbiAgc3RhbmRhbG9uZTogdHJ1ZSxcclxuICBpbXBvcnRzOiBbQ29tbW9uTW9kdWxlXSxcclxuICB0ZW1wbGF0ZTogYFxyXG4gICAgPGRpdlxyXG4gICAgICAqbmdJZj1cIiFpc09wZW5cIlxyXG4gICAgICBjbGFzcz1cImZsb2F0aW5nLWJ0blwiXHJcbiAgICAgIFtjbGFzcy5zaWRlLWxlZnRdPVwic2lkZSA9PT0gJ2xlZnQnXCJcclxuICAgICAgW2NsYXNzLnNpZGUtcmlnaHRdPVwic2lkZSA9PT0gJ3JpZ2h0J1wiXHJcbiAgICAgIChjbGljayk9XCJ0b2dnbGUoKVwiXHJcbiAgICA+XHJcbiAgICAgIDxkaXYgY2xhc3M9XCJmYWItaW5uZXJcIiBbY2xhc3MuaGFzLXVucmVhZF09XCJ1bnJlYWRDb3VudCA+IDBcIj5cclxuICAgICAgICA8c3ZnIGNsYXNzPVwiY2VzLWxvZ29cIiB2aWV3Qm94PVwiMCAwIDEwMCAxMDBcIiB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCI+XHJcbiAgICAgICAgICA8cGF0aCBkPVwiTSAxNSAyMCBRIDE1IDE1IDIwIDE1IEwgODAgMTUgUSA4NSAxNSA4NSAyMCBMIDg1IDYwIFEgODUgNjUgODAgNjUgTCAzNSA2NSBMIDIwIDgwIEwgMjAgNjUgUSAxNSA2NSAxNSA2MCBaXCJcclxuICAgICAgICAgICAgICAgIGZpbGw9XCJub25lXCIgc3Ryb2tlPVwid2hpdGVcIiBzdHJva2Utd2lkdGg9XCIzXCIvPlxyXG4gICAgICAgICAgPGcgdHJhbnNmb3JtPVwidHJhbnNsYXRlKDUwLCA0MCkgc2NhbGUoMC4zNSlcIj5cclxuICAgICAgICAgICAgPHBhdGggZD1cIk0gMCwtMzAgTCAyNSwtMTUgTCAyNSwxNSBMIDAsMzAgTCAtMjUsMTUgTCAtMjUsLTE1IFpcIiBmaWxsPVwid2hpdGVcIi8+XHJcbiAgICAgICAgICA8L2c+XHJcbiAgICAgICAgPC9zdmc+XHJcbiAgICAgICAgPHNwYW4gKm5nSWY9XCJ1bnJlYWRDb3VudCA+IDBcIiBjbGFzcz1cImJhZGdlXCI+e3sgdW5yZWFkQ291bnQgPiA5OSA/ICc5OSsnIDogdW5yZWFkQ291bnQgfX08L3NwYW4+XHJcbiAgICAgIDwvZGl2PlxyXG4gICAgPC9kaXY+XHJcbiAgYCxcclxuICBzdHlsZXM6IFtgXHJcbiAgICAuZmxvYXRpbmctYnRuIHtcclxuICAgICAgcG9zaXRpb246IGZpeGVkO1xyXG4gICAgICBib3R0b206IDIwcHg7XHJcbiAgICAgIHotaW5kZXg6IDEwMDAwO1xyXG4gICAgICBjdXJzb3I6IHBvaW50ZXI7XHJcbiAgICAgIHVzZXItc2VsZWN0OiBub25lO1xyXG4gICAgfVxyXG5cclxuICAgIC5mbG9hdGluZy1idG4uc2lkZS1yaWdodCB7XHJcbiAgICAgIHJpZ2h0OiAyMHB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5mbG9hdGluZy1idG4uc2lkZS1sZWZ0IHtcclxuICAgICAgbGVmdDogMjBweDtcclxuICAgIH1cclxuXHJcbiAgICAuZmFiLWlubmVyIHtcclxuICAgICAgd2lkdGg6IDQ0cHg7XHJcbiAgICAgIGhlaWdodDogNDRweDtcclxuICAgICAgYm9yZGVyLXJhZGl1czogNTAlO1xyXG4gICAgICBiYWNrZ3JvdW5kOiAjMDQxMzIyO1xyXG4gICAgICBib3JkZXI6IDJweCBzb2xpZCByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMTgpO1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcclxuICAgICAgYm94LXNoYWRvdzogMCAzcHggMTZweCByZ2JhKDAsIDAsIDAsIDAuNik7XHJcbiAgICAgIHRyYW5zaXRpb246IHRyYW5zZm9ybSAwLjJzIGVhc2UsIGJveC1zaGFkb3cgMC4ycyBlYXNlLCBib3JkZXItY29sb3IgMC4ycyBlYXNlO1xyXG4gICAgICBwb3NpdGlvbjogcmVsYXRpdmU7XHJcbiAgICB9XHJcblxyXG4gICAgLmZhYi1pbm5lcjpob3ZlciB7XHJcbiAgICAgIHRyYW5zZm9ybTogc2NhbGUoMS4xKTtcclxuICAgICAgYm9yZGVyLWNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNCk7XHJcbiAgICAgIGJveC1zaGFkb3c6IDAgNHB4IDIwcHggcmdiYSgwLCAwLCAwLCAwLjgpO1xyXG4gICAgfVxyXG5cclxuICAgIC5mYWItaW5uZXIuaGFzLXVucmVhZCB7XHJcbiAgICAgIGFuaW1hdGlvbjogcHVsc2UgMnMgaW5maW5pdGU7XHJcbiAgICB9XHJcblxyXG4gICAgLmNlcy1sb2dvIHtcclxuICAgICAgd2lkdGg6IDI0cHg7XHJcbiAgICAgIGhlaWdodDogMjRweDtcclxuICAgIH1cclxuXHJcbiAgICAuYmFkZ2Uge1xyXG4gICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XHJcbiAgICAgIHRvcDogLTRweDtcclxuICAgICAgcmlnaHQ6IC00cHg7XHJcbiAgICAgIGJhY2tncm91bmQ6ICNlZjQ0NDQ7XHJcbiAgICAgIGNvbG9yOiAjZmZmO1xyXG4gICAgICBib3JkZXItcmFkaXVzOiAxMHB4O1xyXG4gICAgICBtaW4td2lkdGg6IDE4cHg7XHJcbiAgICAgIGhlaWdodDogMThweDtcclxuICAgICAgZm9udC1zaXplOiAxMHB4O1xyXG4gICAgICBmb250LXdlaWdodDogNjAwO1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcclxuICAgICAgcGFkZGluZzogMCA0cHg7XHJcbiAgICAgIGJvcmRlcjogMnB4IHNvbGlkICNmZmY7XHJcbiAgICB9XHJcblxyXG4gICAgQGtleWZyYW1lcyBwdWxzZSB7XHJcbiAgICAgIDAlLCAxMDAlIHsgYm94LXNoYWRvdzogMCAzcHggMTZweCByZ2JhKDAsIDAsIDAsIDAuNik7IGJvcmRlci1jb2xvcjogcmdiYSgyNTUsMjU1LDI1NSwwLjE4KTsgfVxyXG4gICAgICA1MCUgeyBib3gtc2hhZG93OiAwIDNweCAyNHB4IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xNSk7IGJvcmRlci1jb2xvcjogcmdiYSgyNTUsMjU1LDI1NSwwLjQpOyB9XHJcbiAgICB9XHJcbiAgYF0sXHJcbn0pXHJcbmV4cG9ydCBjbGFzcyBGbG9hdGluZ0J1dHRvbkNvbXBvbmVudCBpbXBsZW1lbnRzIE9uSW5pdCwgT25EZXN0cm95IHtcclxuICB1bnJlYWRDb3VudCA9IDA7XHJcbiAgc2lkZTogU2lkZWJhclNpZGUgPSAncmlnaHQnO1xyXG4gIGlzT3BlbiA9IGZhbHNlO1xyXG5cclxuICBwcml2YXRlIHN1YiE6IFN1YnNjcmlwdGlvbjtcclxuXHJcbiAgY29uc3RydWN0b3IocHJpdmF0ZSBzdG9yZTogTWVzc2FnaW5nU3RvcmVTZXJ2aWNlKSB7fVxyXG5cclxuICBuZ09uSW5pdCgpOiB2b2lkIHtcclxuICAgIHRoaXMuc3ViID0gY29tYmluZUxhdGVzdChbXHJcbiAgICAgIHRoaXMuc3RvcmUudG90YWxVbnJlYWQsXHJcbiAgICAgIHRoaXMuc3RvcmUuc2lkZWJhclNpZGUsXHJcbiAgICAgIHRoaXMuc3RvcmUucGFuZWxPcGVuLFxyXG4gICAgXSkuc3Vic2NyaWJlKChbY291bnQsIHNpZGUsIG9wZW5dKSA9PiB7XHJcbiAgICAgIHRoaXMudW5yZWFkQ291bnQgPSBjb3VudDtcclxuICAgICAgdGhpcy5zaWRlID0gc2lkZTtcclxuICAgICAgdGhpcy5pc09wZW4gPSBvcGVuO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBuZ09uRGVzdHJveSgpOiB2b2lkIHtcclxuICAgIHRoaXMuc3ViPy51bnN1YnNjcmliZSgpO1xyXG4gIH1cclxuXHJcbiAgdG9nZ2xlKCk6IHZvaWQge1xyXG4gICAgdGhpcy5zdG9yZS50b2dnbGVQYW5lbCgpO1xyXG4gIH1cclxufVxyXG4iXX0=