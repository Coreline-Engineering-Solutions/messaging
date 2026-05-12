import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import * as i0 from "@angular/core";
import * as i1 from "@angular/common";
import * as i2 from "@angular/material/button";
import * as i3 from "@angular/material/tooltip";
export class ReactionPickerComponent {
    show = false;
    align = 'left';
    emojiSelected = new EventEmitter();
    emojis = ['👍', '❤️', '😂', '😮', '😢', '🎉', '🔥', '👏'];
    selectEmoji(emoji) {
        this.emojiSelected.emit(emoji);
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: ReactionPickerComponent, deps: [], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "17.3.12", type: ReactionPickerComponent, isStandalone: true, selector: "app-reaction-picker", inputs: { show: "show", align: "align" }, outputs: { emojiSelected: "emojiSelected" }, ngImport: i0, template: `
    <div class="reaction-picker" *ngIf="show" [class.align-right]="align === 'right'">
      <button 
        *ngFor="let emoji of emojis" 
        mat-icon-button 
        (click)="selectEmoji(emoji)"
        [matTooltip]="emoji"
        class="emoji-btn"
      >
        {{ emoji }}
      </button>
    </div>
  `, isInline: true, styles: [".reaction-picker{display:flex;gap:2px;align-items:center;justify-content:center;padding:5px 6px;background:linear-gradient(180deg,#1f4bd8,#173396);border:1px solid rgba(255,255,255,.24);border-radius:10px;box-shadow:0 6px 14px #00000038;position:absolute;z-index:1000;bottom:100%;left:0;margin-bottom:3px;white-space:nowrap;overflow:visible}.reaction-picker.align-right{left:auto;right:0}.emoji-btn{font-size:16px;width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;line-height:1;border-radius:7px;transition:transform .2s}.emoji-btn:hover{transform:scale(1.12);background:#ffffff2e}\n"], dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i1.NgForOf, selector: "[ngFor][ngForOf]", inputs: ["ngForOf", "ngForTrackBy", "ngForTemplate"] }, { kind: "directive", type: i1.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "ngmodule", type: MatIconModule }, { kind: "ngmodule", type: MatButtonModule }, { kind: "component", type: i2.MatIconButton, selector: "button[mat-icon-button]", exportAs: ["matButton"] }, { kind: "ngmodule", type: MatTooltipModule }, { kind: "directive", type: i3.MatTooltip, selector: "[matTooltip]", inputs: ["matTooltipPosition", "matTooltipPositionAtOrigin", "matTooltipDisabled", "matTooltipShowDelay", "matTooltipHideDelay", "matTooltipTouchGestures", "matTooltip", "matTooltipClass"], exportAs: ["matTooltip"] }] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: ReactionPickerComponent, decorators: [{
            type: Component,
            args: [{ selector: 'app-reaction-picker', standalone: true, imports: [CommonModule, MatIconModule, MatButtonModule, MatTooltipModule], template: `
    <div class="reaction-picker" *ngIf="show" [class.align-right]="align === 'right'">
      <button 
        *ngFor="let emoji of emojis" 
        mat-icon-button 
        (click)="selectEmoji(emoji)"
        [matTooltip]="emoji"
        class="emoji-btn"
      >
        {{ emoji }}
      </button>
    </div>
  `, styles: [".reaction-picker{display:flex;gap:2px;align-items:center;justify-content:center;padding:5px 6px;background:linear-gradient(180deg,#1f4bd8,#173396);border:1px solid rgba(255,255,255,.24);border-radius:10px;box-shadow:0 6px 14px #00000038;position:absolute;z-index:1000;bottom:100%;left:0;margin-bottom:3px;white-space:nowrap;overflow:visible}.reaction-picker.align-right{left:auto;right:0}.emoji-btn{font-size:16px;width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;line-height:1;border-radius:7px;transition:transform .2s}.emoji-btn:hover{transform:scale(1.12);background:#ffffff2e}\n"] }]
        }], propDecorators: { show: [{
                type: Input
            }], align: [{
                type: Input
            }], emojiSelected: [{
                type: Output
            }] } });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVhY3Rpb24tcGlja2VyLmNvbXBvbmVudC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9saWIvY29tcG9uZW50cy9yZWFjdGlvbi1waWNrZXIvcmVhY3Rpb24tcGlja2VyLmNvbXBvbmVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsU0FBUyxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsWUFBWSxFQUFFLE1BQU0sZUFBZSxDQUFDO0FBQ3ZFLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUMvQyxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sd0JBQXdCLENBQUM7QUFDdkQsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBQzNELE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLDJCQUEyQixDQUFDOzs7OztBQThEN0QsTUFBTSxPQUFPLHVCQUF1QjtJQUN6QixJQUFJLEdBQUcsS0FBSyxDQUFDO0lBQ2IsS0FBSyxHQUFxQixNQUFNLENBQUM7SUFDaEMsYUFBYSxHQUFHLElBQUksWUFBWSxFQUFVLENBQUM7SUFFckQsTUFBTSxHQUFHLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO0lBRTFELFdBQVcsQ0FBQyxLQUFhO1FBQ3ZCLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQ2pDLENBQUM7d0dBVFUsdUJBQXVCOzRGQUF2Qix1QkFBdUIsc0tBeER4Qjs7Ozs7Ozs7Ozs7O0dBWVQsbXJCQWJTLFlBQVksK1BBQUUsYUFBYSw4QkFBRSxlQUFlLDJJQUFFLGdCQUFnQjs7NEZBeUQ3RCx1QkFBdUI7a0JBNURuQyxTQUFTOytCQUNFLHFCQUFxQixjQUNuQixJQUFJLFdBQ1AsQ0FBQyxZQUFZLEVBQUUsYUFBYSxFQUFFLGVBQWUsRUFBRSxnQkFBZ0IsQ0FBQyxZQUMvRDs7Ozs7Ozs7Ozs7O0dBWVQ7OEJBNkNRLElBQUk7c0JBQVosS0FBSztnQkFDRyxLQUFLO3NCQUFiLEtBQUs7Z0JBQ0ksYUFBYTtzQkFBdEIsTUFBTSIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IENvbXBvbmVudCwgSW5wdXQsIE91dHB1dCwgRXZlbnRFbWl0dGVyIH0gZnJvbSAnQGFuZ3VsYXIvY29yZSc7XG5pbXBvcnQgeyBDb21tb25Nb2R1bGUgfSBmcm9tICdAYW5ndWxhci9jb21tb24nO1xuaW1wb3J0IHsgTWF0SWNvbk1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL21hdGVyaWFsL2ljb24nO1xuaW1wb3J0IHsgTWF0QnV0dG9uTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvbWF0ZXJpYWwvYnV0dG9uJztcbmltcG9ydCB7IE1hdFRvb2x0aXBNb2R1bGUgfSBmcm9tICdAYW5ndWxhci9tYXRlcmlhbC90b29sdGlwJztcblxuQENvbXBvbmVudCh7XG4gIHNlbGVjdG9yOiAnYXBwLXJlYWN0aW9uLXBpY2tlcicsXG4gIHN0YW5kYWxvbmU6IHRydWUsXG4gIGltcG9ydHM6IFtDb21tb25Nb2R1bGUsIE1hdEljb25Nb2R1bGUsIE1hdEJ1dHRvbk1vZHVsZSwgTWF0VG9vbHRpcE1vZHVsZV0sXG4gIHRlbXBsYXRlOiBgXG4gICAgPGRpdiBjbGFzcz1cInJlYWN0aW9uLXBpY2tlclwiICpuZ0lmPVwic2hvd1wiIFtjbGFzcy5hbGlnbi1yaWdodF09XCJhbGlnbiA9PT0gJ3JpZ2h0J1wiPlxuICAgICAgPGJ1dHRvbiBcbiAgICAgICAgKm5nRm9yPVwibGV0IGVtb2ppIG9mIGVtb2ppc1wiIFxuICAgICAgICBtYXQtaWNvbi1idXR0b24gXG4gICAgICAgIChjbGljayk9XCJzZWxlY3RFbW9qaShlbW9qaSlcIlxuICAgICAgICBbbWF0VG9vbHRpcF09XCJlbW9qaVwiXG4gICAgICAgIGNsYXNzPVwiZW1vamktYnRuXCJcbiAgICAgID5cbiAgICAgICAge3sgZW1vamkgfX1cbiAgICAgIDwvYnV0dG9uPlxuICAgIDwvZGl2PlxuICBgLFxuICBzdHlsZXM6IFtgXG4gICAgLnJlYWN0aW9uLXBpY2tlciB7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgZ2FwOiAycHg7XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgICBwYWRkaW5nOiA1cHggNnB4O1xuICAgICAgYmFja2dyb3VuZDogbGluZWFyLWdyYWRpZW50KDE4MGRlZywgIzFGNEJEOCAwJSwgIzE3MzM5NiAxMDAlKTtcbiAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4yNCk7XG4gICAgICBib3JkZXItcmFkaXVzOiAxMHB4O1xuICAgICAgYm94LXNoYWRvdzogMCA2cHggMTRweCByZ2JhKDAsMCwwLDAuMjIpO1xuICAgICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgICAgei1pbmRleDogMTAwMDtcbiAgICAgIGJvdHRvbTogMTAwJTtcbiAgICAgIGxlZnQ6IDA7XG4gICAgICBtYXJnaW4tYm90dG9tOiAzcHg7XG4gICAgICB3aGl0ZS1zcGFjZTogbm93cmFwO1xuICAgICAgb3ZlcmZsb3c6IHZpc2libGU7XG4gICAgfVxuXG4gICAgLnJlYWN0aW9uLXBpY2tlci5hbGlnbi1yaWdodCB7XG4gICAgICBsZWZ0OiBhdXRvO1xuICAgICAgcmlnaHQ6IDA7XG4gICAgfVxuXG4gICAgLmVtb2ppLWJ0biB7XG4gICAgICBmb250LXNpemU6IDE2cHg7XG4gICAgICB3aWR0aDogMjZweDtcbiAgICAgIGhlaWdodDogMjZweDtcbiAgICAgIGRpc3BsYXk6IGlubGluZS1mbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgICAgbGluZS1oZWlnaHQ6IDE7XG4gICAgICBib3JkZXItcmFkaXVzOiA3cHg7XG4gICAgICB0cmFuc2l0aW9uOiB0cmFuc2Zvcm0gMC4ycztcbiAgICB9XG5cbiAgICAuZW1vamktYnRuOmhvdmVyIHtcbiAgICAgIHRyYW5zZm9ybTogc2NhbGUoMS4xMik7XG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMTgpO1xuICAgIH1cbiAgYF1cbn0pXG5leHBvcnQgY2xhc3MgUmVhY3Rpb25QaWNrZXJDb21wb25lbnQge1xuICBASW5wdXQoKSBzaG93ID0gZmFsc2U7XG4gIEBJbnB1dCgpIGFsaWduOiAnbGVmdCcgfCAncmlnaHQnID0gJ2xlZnQnO1xuICBAT3V0cHV0KCkgZW1vamlTZWxlY3RlZCA9IG5ldyBFdmVudEVtaXR0ZXI8c3RyaW5nPigpO1xuXG4gIGVtb2ppcyA9IFsn8J+RjScsICfinaTvuI8nLCAn8J+YgicsICfwn5iuJywgJ/CfmKInLCAn8J+OiScsICfwn5SlJywgJ/CfkY8nXTtcblxuICBzZWxlY3RFbW9qaShlbW9qaTogc3RyaW5nKSB7XG4gICAgdGhpcy5lbW9qaVNlbGVjdGVkLmVtaXQoZW1vamkpO1xuICB9XG59XG4iXX0=