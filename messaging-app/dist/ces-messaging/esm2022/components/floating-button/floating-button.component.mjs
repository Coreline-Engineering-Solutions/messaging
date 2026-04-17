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
  `, isInline: true, styles: [".floating-btn{position:fixed;bottom:20px;z-index:10000;cursor:pointer;-webkit-user-select:none;user-select:none}.floating-btn.side-right{right:20px}.floating-btn.side-left{left:20px}.fab-inner{width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#1f4bd8,#173396);display:flex;align-items:center;justify-content:center;box-shadow:0 3px 16px #17339666;transition:transform .2s ease,box-shadow .2s ease;position:relative}.fab-inner:hover{transform:scale(1.1);box-shadow:0 4px 20px #17339699}.fab-inner.has-unread{animation:pulse 2s infinite}.ces-logo{width:24px;height:24px}.badge{position:absolute;top:-4px;right:-4px;background:#ef4444;color:#fff;border-radius:10px;min-width:18px;height:18px;font-size:10px;font-weight:600;display:flex;align-items:center;justify-content:center;padding:0 4px;border:2px solid #fff}@keyframes pulse{0%,to{box-shadow:0 3px 16px #17339666}50%{box-shadow:0 3px 24px #173396b3}}\n"], dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i2.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }] });
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
  `, styles: [".floating-btn{position:fixed;bottom:20px;z-index:10000;cursor:pointer;-webkit-user-select:none;user-select:none}.floating-btn.side-right{right:20px}.floating-btn.side-left{left:20px}.fab-inner{width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#1f4bd8,#173396);display:flex;align-items:center;justify-content:center;box-shadow:0 3px 16px #17339666;transition:transform .2s ease,box-shadow .2s ease;position:relative}.fab-inner:hover{transform:scale(1.1);box-shadow:0 4px 20px #17339699}.fab-inner.has-unread{animation:pulse 2s infinite}.ces-logo{width:24px;height:24px}.badge{position:absolute;top:-4px;right:-4px;background:#ef4444;color:#fff;border-radius:10px;min-width:18px;height:18px;font-size:10px;font-weight:600;display:flex;align-items:center;justify-content:center;padding:0 4px;border:2px solid #fff}@keyframes pulse{0%,to{box-shadow:0 3px 16px #17339666}50%{box-shadow:0 3px 24px #173396b3}}\n"] }]
        }], ctorParameters: () => [{ type: i1.MessagingStoreService }] });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmxvYXRpbmctYnV0dG9uLmNvbXBvbmVudC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9saWIvY29tcG9uZW50cy9mbG9hdGluZy1idXR0b24vZmxvYXRpbmctYnV0dG9uLmNvbXBvbmVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsU0FBUyxFQUFxQixNQUFNLGVBQWUsQ0FBQztBQUM3RCxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDL0MsT0FBTyxFQUFnQixhQUFhLEVBQUUsTUFBTSxNQUFNLENBQUM7Ozs7QUFnR25ELE1BQU0sT0FBTyx1QkFBdUI7SUFPZDtJQU5wQixXQUFXLEdBQUcsQ0FBQyxDQUFDO0lBQ2hCLElBQUksR0FBZ0IsT0FBTyxDQUFDO0lBQzVCLE1BQU0sR0FBRyxLQUFLLENBQUM7SUFFUCxHQUFHLENBQWdCO0lBRTNCLFlBQW9CLEtBQTRCO1FBQTVCLFVBQUssR0FBTCxLQUFLLENBQXVCO0lBQUcsQ0FBQztJQUVwRCxRQUFRO1FBQ04sSUFBSSxDQUFDLEdBQUcsR0FBRyxhQUFhLENBQUM7WUFDdkIsSUFBSSxDQUFDLEtBQUssQ0FBQyxXQUFXO1lBQ3RCLElBQUksQ0FBQyxLQUFLLENBQUMsV0FBVztZQUN0QixJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVM7U0FDckIsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsS0FBSyxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsRUFBRSxFQUFFO1lBQ25DLElBQUksQ0FBQyxXQUFXLEdBQUcsS0FBSyxDQUFDO1lBQ3pCLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO1lBQ2pCLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDO1FBQ3JCLENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVELFdBQVc7UUFDVCxJQUFJLENBQUMsR0FBRyxFQUFFLFdBQVcsRUFBRSxDQUFDO0lBQzFCLENBQUM7SUFFRCxNQUFNO1FBQ0osSUFBSSxDQUFDLEtBQUssQ0FBQyxXQUFXLEVBQUUsQ0FBQztJQUMzQixDQUFDO3dHQTNCVSx1QkFBdUI7NEZBQXZCLHVCQUF1QiwrRUF4RnhCOzs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBbUJULDIrQkFwQlMsWUFBWTs7NEZBeUZYLHVCQUF1QjtrQkE1Rm5DLFNBQVM7K0JBQ0UscUJBQXFCLGNBQ25CLElBQUksV0FDUCxDQUFDLFlBQVksQ0FBQyxZQUNiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBbUJUIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQ29tcG9uZW50LCBPbkluaXQsIE9uRGVzdHJveSB9IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xuaW1wb3J0IHsgQ29tbW9uTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvY29tbW9uJztcbmltcG9ydCB7IFN1YnNjcmlwdGlvbiwgY29tYmluZUxhdGVzdCB9IGZyb20gJ3J4anMnO1xuaW1wb3J0IHsgTWVzc2FnaW5nU3RvcmVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvbWVzc2FnaW5nLXN0b3JlLnNlcnZpY2UnO1xuaW1wb3J0IHsgU2lkZWJhclNpZGUgfSBmcm9tICcuLi8uLi9tb2RlbHMvbWVzc2FnaW5nLm1vZGVscyc7XG5cbkBDb21wb25lbnQoe1xuICBzZWxlY3RvcjogJ2FwcC1mbG9hdGluZy1idXR0b24nLFxuICBzdGFuZGFsb25lOiB0cnVlLFxuICBpbXBvcnRzOiBbQ29tbW9uTW9kdWxlXSxcbiAgdGVtcGxhdGU6IGBcbiAgICA8ZGl2XG4gICAgICAqbmdJZj1cIiFpc09wZW5cIlxuICAgICAgY2xhc3M9XCJmbG9hdGluZy1idG5cIlxuICAgICAgW2NsYXNzLnNpZGUtbGVmdF09XCJzaWRlID09PSAnbGVmdCdcIlxuICAgICAgW2NsYXNzLnNpZGUtcmlnaHRdPVwic2lkZSA9PT0gJ3JpZ2h0J1wiXG4gICAgICAoY2xpY2spPVwidG9nZ2xlKClcIlxuICAgID5cbiAgICAgIDxkaXYgY2xhc3M9XCJmYWItaW5uZXJcIiBbY2xhc3MuaGFzLXVucmVhZF09XCJ1bnJlYWRDb3VudCA+IDBcIj5cbiAgICAgICAgPHN2ZyBjbGFzcz1cImNlcy1sb2dvXCIgdmlld0JveD1cIjAgMCAxMDAgMTAwXCIgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiPlxuICAgICAgICAgIDxwYXRoIGQ9XCJNIDE1IDIwIFEgMTUgMTUgMjAgMTUgTCA4MCAxNSBRIDg1IDE1IDg1IDIwIEwgODUgNjAgUSA4NSA2NSA4MCA2NSBMIDM1IDY1IEwgMjAgODAgTCAyMCA2NSBRIDE1IDY1IDE1IDYwIFpcIlxuICAgICAgICAgICAgICAgIGZpbGw9XCJub25lXCIgc3Ryb2tlPVwid2hpdGVcIiBzdHJva2Utd2lkdGg9XCIzXCIvPlxuICAgICAgICAgIDxnIHRyYW5zZm9ybT1cInRyYW5zbGF0ZSg1MCwgNDApIHNjYWxlKDAuMzUpXCI+XG4gICAgICAgICAgICA8cGF0aCBkPVwiTSAwLC0zMCBMIDI1LC0xNSBMIDI1LDE1IEwgMCwzMCBMIC0yNSwxNSBMIC0yNSwtMTUgWlwiIGZpbGw9XCJ3aGl0ZVwiLz5cbiAgICAgICAgICA8L2c+XG4gICAgICAgIDwvc3ZnPlxuICAgICAgICA8c3BhbiAqbmdJZj1cInVucmVhZENvdW50ID4gMFwiIGNsYXNzPVwiYmFkZ2VcIj57eyB1bnJlYWRDb3VudCA+IDk5ID8gJzk5KycgOiB1bnJlYWRDb3VudCB9fTwvc3Bhbj5cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuICBgLFxuICBzdHlsZXM6IFtgXG4gICAgLmZsb2F0aW5nLWJ0biB7XG4gICAgICBwb3NpdGlvbjogZml4ZWQ7XG4gICAgICBib3R0b206IDIwcHg7XG4gICAgICB6LWluZGV4OiAxMDAwMDtcbiAgICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgICAgIHVzZXItc2VsZWN0OiBub25lO1xuICAgIH1cblxuICAgIC5mbG9hdGluZy1idG4uc2lkZS1yaWdodCB7XG4gICAgICByaWdodDogMjBweDtcbiAgICB9XG5cbiAgICAuZmxvYXRpbmctYnRuLnNpZGUtbGVmdCB7XG4gICAgICBsZWZ0OiAyMHB4O1xuICAgIH1cblxuICAgIC5mYWItaW5uZXIge1xuICAgICAgd2lkdGg6IDQ0cHg7XG4gICAgICBoZWlnaHQ6IDQ0cHg7XG4gICAgICBib3JkZXItcmFkaXVzOiA1MCU7XG4gICAgICBiYWNrZ3JvdW5kOiBsaW5lYXItZ3JhZGllbnQoMTM1ZGVnLCAjMUY0QkQ4IDAlLCAjMTczMzk2IDEwMCUpO1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgIGJveC1zaGFkb3c6IDAgM3B4IDE2cHggcmdiYSgyMywgNTEsIDE1MCwgMC40KTtcbiAgICAgIHRyYW5zaXRpb246IHRyYW5zZm9ybSAwLjJzIGVhc2UsIGJveC1zaGFkb3cgMC4ycyBlYXNlO1xuICAgICAgcG9zaXRpb246IHJlbGF0aXZlO1xuICAgIH1cblxuICAgIC5mYWItaW5uZXI6aG92ZXIge1xuICAgICAgdHJhbnNmb3JtOiBzY2FsZSgxLjEpO1xuICAgICAgYm94LXNoYWRvdzogMCA0cHggMjBweCByZ2JhKDIzLCA1MSwgMTUwLCAwLjYpO1xuICAgIH1cblxuICAgIC5mYWItaW5uZXIuaGFzLXVucmVhZCB7XG4gICAgICBhbmltYXRpb246IHB1bHNlIDJzIGluZmluaXRlO1xuICAgIH1cblxuICAgIC5jZXMtbG9nbyB7XG4gICAgICB3aWR0aDogMjRweDtcbiAgICAgIGhlaWdodDogMjRweDtcbiAgICB9XG5cbiAgICAuYmFkZ2Uge1xuICAgICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgICAgdG9wOiAtNHB4O1xuICAgICAgcmlnaHQ6IC00cHg7XG4gICAgICBiYWNrZ3JvdW5kOiAjZWY0NDQ0O1xuICAgICAgY29sb3I6ICNmZmY7XG4gICAgICBib3JkZXItcmFkaXVzOiAxMHB4O1xuICAgICAgbWluLXdpZHRoOiAxOHB4O1xuICAgICAgaGVpZ2h0OiAxOHB4O1xuICAgICAgZm9udC1zaXplOiAxMHB4O1xuICAgICAgZm9udC13ZWlnaHQ6IDYwMDtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgICBwYWRkaW5nOiAwIDRweDtcbiAgICAgIGJvcmRlcjogMnB4IHNvbGlkICNmZmY7XG4gICAgfVxuXG4gICAgQGtleWZyYW1lcyBwdWxzZSB7XG4gICAgICAwJSwgMTAwJSB7IGJveC1zaGFkb3c6IDAgM3B4IDE2cHggcmdiYSgyMywgNTEsIDE1MCwgMC40KTsgfVxuICAgICAgNTAlIHsgYm94LXNoYWRvdzogMCAzcHggMjRweCByZ2JhKDIzLCA1MSwgMTUwLCAwLjcpOyB9XG4gICAgfVxuICBgXSxcbn0pXG5leHBvcnQgY2xhc3MgRmxvYXRpbmdCdXR0b25Db21wb25lbnQgaW1wbGVtZW50cyBPbkluaXQsIE9uRGVzdHJveSB7XG4gIHVucmVhZENvdW50ID0gMDtcbiAgc2lkZTogU2lkZWJhclNpZGUgPSAncmlnaHQnO1xuICBpc09wZW4gPSBmYWxzZTtcblxuICBwcml2YXRlIHN1YiE6IFN1YnNjcmlwdGlvbjtcblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHN0b3JlOiBNZXNzYWdpbmdTdG9yZVNlcnZpY2UpIHt9XG5cbiAgbmdPbkluaXQoKTogdm9pZCB7XG4gICAgdGhpcy5zdWIgPSBjb21iaW5lTGF0ZXN0KFtcbiAgICAgIHRoaXMuc3RvcmUudG90YWxVbnJlYWQsXG4gICAgICB0aGlzLnN0b3JlLnNpZGViYXJTaWRlLFxuICAgICAgdGhpcy5zdG9yZS5wYW5lbE9wZW4sXG4gICAgXSkuc3Vic2NyaWJlKChbY291bnQsIHNpZGUsIG9wZW5dKSA9PiB7XG4gICAgICB0aGlzLnVucmVhZENvdW50ID0gY291bnQ7XG4gICAgICB0aGlzLnNpZGUgPSBzaWRlO1xuICAgICAgdGhpcy5pc09wZW4gPSBvcGVuO1xuICAgIH0pO1xuICB9XG5cbiAgbmdPbkRlc3Ryb3koKTogdm9pZCB7XG4gICAgdGhpcy5zdWI/LnVuc3Vic2NyaWJlKCk7XG4gIH1cblxuICB0b2dnbGUoKTogdm9pZCB7XG4gICAgdGhpcy5zdG9yZS50b2dnbGVQYW5lbCgpO1xuICB9XG59XG4iXX0=