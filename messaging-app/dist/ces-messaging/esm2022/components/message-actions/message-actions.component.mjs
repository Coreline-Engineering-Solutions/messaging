import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import * as i0 from "@angular/core";
import * as i1 from "@angular/common";
import * as i2 from "@angular/material/icon";
import * as i3 from "@angular/material/button";
import * as i4 from "@angular/material/menu";
export class MessageActionsComponent {
    message;
    currentUserId;
    canPin = false;
    reply = new EventEmitter();
    react = new EventEmitter();
    edit = new EventEmitter();
    delete = new EventEmitter();
    pin = new EventEmitter();
    copy = new EventEmitter();
    get canEdit() {
        return this.message.sender_id === this.currentUserId;
    }
    get canDelete() {
        return this.message.sender_id === this.currentUserId || this.canPin;
    }
    onReply() {
        this.reply.emit(this.message);
    }
    onReact() {
        this.react.emit(this.message);
    }
    onEdit() {
        this.edit.emit(this.message);
    }
    onDelete() {
        if (confirm('Delete this message?')) {
            this.delete.emit(this.message);
        }
    }
    onPin() {
        this.pin.emit(this.message);
    }
    onCopy() {
        if (this.message.content) {
            navigator.clipboard.writeText(this.message.content);
        }
        this.copy.emit(this.message);
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: MessageActionsComponent, deps: [], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "17.3.12", type: MessageActionsComponent, isStandalone: true, selector: "app-message-actions", inputs: { message: "message", currentUserId: "currentUserId", canPin: "canPin" }, outputs: { reply: "reply", react: "react", edit: "edit", delete: "delete", pin: "pin", copy: "copy" }, ngImport: i0, template: `
    <div class="message-actions">
      <button mat-icon-button [matMenuTriggerFor]="menu" class="more-btn">
        <mat-icon>more_vert</mat-icon>
      </button>
      
      <mat-menu #menu="matMenu">
        <button mat-menu-item (click)="onReply()">
          <mat-icon>reply</mat-icon>
          <span>Reply in thread</span>
        </button>
        
        <button mat-menu-item (click)="onReact()">
          <mat-icon>add_reaction</mat-icon>
          <span>Add reaction</span>
        </button>
        
        <button mat-menu-item *ngIf="canEdit" (click)="onEdit()">
          <mat-icon>edit</mat-icon>
          <span>Edit message</span>
        </button>
        
        <button mat-menu-item (click)="onPin()">
          <mat-icon>{{ message.is_pinned ? 'push_pin' : 'push_pin' }}</mat-icon>
          <span>{{ message.is_pinned ? 'Unpin' : 'Pin' }} message</span>
        </button>
        
        <button mat-menu-item (click)="onCopy()">
          <mat-icon>content_copy</mat-icon>
          <span>Copy text</span>
        </button>
        
        <button mat-menu-item *ngIf="canDelete" (click)="onDelete()" class="delete-action">
          <mat-icon>delete</mat-icon>
          <span>Delete message</span>
        </button>
      </mat-menu>
    </div>
  `, isInline: true, styles: [".message-actions{opacity:0;transition:opacity .2s}:host:hover .message-actions,.message-actions:focus-within{opacity:1}.more-btn{width:28px;height:28px;line-height:28px}.more-btn mat-icon{font-size:18px;width:18px;height:18px}.delete-action{color:#d32f2f}\n"], dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i1.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "ngmodule", type: MatIconModule }, { kind: "component", type: i2.MatIcon, selector: "mat-icon", inputs: ["color", "inline", "svgIcon", "fontSet", "fontIcon"], exportAs: ["matIcon"] }, { kind: "ngmodule", type: MatButtonModule }, { kind: "component", type: i3.MatIconButton, selector: "button[mat-icon-button]", exportAs: ["matButton"] }, { kind: "ngmodule", type: MatMenuModule }, { kind: "component", type: i4.MatMenu, selector: "mat-menu", inputs: ["backdropClass", "aria-label", "aria-labelledby", "aria-describedby", "xPosition", "yPosition", "overlapTrigger", "hasBackdrop", "class", "classList"], outputs: ["closed", "close"], exportAs: ["matMenu"] }, { kind: "component", type: i4.MatMenuItem, selector: "[mat-menu-item]", inputs: ["role", "disabled", "disableRipple"], exportAs: ["matMenuItem"] }, { kind: "directive", type: i4.MatMenuTrigger, selector: "[mat-menu-trigger-for], [matMenuTriggerFor]", inputs: ["mat-menu-trigger-for", "matMenuTriggerFor", "matMenuTriggerData", "matMenuTriggerRestoreFocus"], outputs: ["menuOpened", "onMenuOpen", "menuClosed", "onMenuClose"], exportAs: ["matMenuTrigger"] }] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: MessageActionsComponent, decorators: [{
            type: Component,
            args: [{ selector: 'app-message-actions', standalone: true, imports: [CommonModule, MatIconModule, MatButtonModule, MatMenuModule], template: `
    <div class="message-actions">
      <button mat-icon-button [matMenuTriggerFor]="menu" class="more-btn">
        <mat-icon>more_vert</mat-icon>
      </button>
      
      <mat-menu #menu="matMenu">
        <button mat-menu-item (click)="onReply()">
          <mat-icon>reply</mat-icon>
          <span>Reply in thread</span>
        </button>
        
        <button mat-menu-item (click)="onReact()">
          <mat-icon>add_reaction</mat-icon>
          <span>Add reaction</span>
        </button>
        
        <button mat-menu-item *ngIf="canEdit" (click)="onEdit()">
          <mat-icon>edit</mat-icon>
          <span>Edit message</span>
        </button>
        
        <button mat-menu-item (click)="onPin()">
          <mat-icon>{{ message.is_pinned ? 'push_pin' : 'push_pin' }}</mat-icon>
          <span>{{ message.is_pinned ? 'Unpin' : 'Pin' }} message</span>
        </button>
        
        <button mat-menu-item (click)="onCopy()">
          <mat-icon>content_copy</mat-icon>
          <span>Copy text</span>
        </button>
        
        <button mat-menu-item *ngIf="canDelete" (click)="onDelete()" class="delete-action">
          <mat-icon>delete</mat-icon>
          <span>Delete message</span>
        </button>
      </mat-menu>
    </div>
  `, styles: [".message-actions{opacity:0;transition:opacity .2s}:host:hover .message-actions,.message-actions:focus-within{opacity:1}.more-btn{width:28px;height:28px;line-height:28px}.more-btn mat-icon{font-size:18px;width:18px;height:18px}.delete-action{color:#d32f2f}\n"] }]
        }], propDecorators: { message: [{
                type: Input
            }], currentUserId: [{
                type: Input
            }], canPin: [{
                type: Input
            }], reply: [{
                type: Output
            }], react: [{
                type: Output
            }], edit: [{
                type: Output
            }], delete: [{
                type: Output
            }], pin: [{
                type: Output
            }], copy: [{
                type: Output
            }] } });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVzc2FnZS1hY3Rpb25zLmNvbXBvbmVudC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9saWIvY29tcG9uZW50cy9tZXNzYWdlLWFjdGlvbnMvbWVzc2FnZS1hY3Rpb25zLmNvbXBvbmVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsU0FBUyxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsWUFBWSxFQUFFLE1BQU0sZUFBZSxDQUFDO0FBQ3ZFLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUMvQyxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sd0JBQXdCLENBQUM7QUFDdkQsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBQzNELE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSx3QkFBd0IsQ0FBQzs7Ozs7O0FBMEV2RCxNQUFNLE9BQU8sdUJBQXVCO0lBQ3pCLE9BQU8sQ0FBVztJQUNsQixhQUFhLENBQVU7SUFDdkIsTUFBTSxHQUFHLEtBQUssQ0FBQztJQUVkLEtBQUssR0FBRyxJQUFJLFlBQVksRUFBVyxDQUFDO0lBQ3BDLEtBQUssR0FBRyxJQUFJLFlBQVksRUFBVyxDQUFDO0lBQ3BDLElBQUksR0FBRyxJQUFJLFlBQVksRUFBVyxDQUFDO0lBQ25DLE1BQU0sR0FBRyxJQUFJLFlBQVksRUFBVyxDQUFDO0lBQ3JDLEdBQUcsR0FBRyxJQUFJLFlBQVksRUFBVyxDQUFDO0lBQ2xDLElBQUksR0FBRyxJQUFJLFlBQVksRUFBVyxDQUFDO0lBRTdDLElBQUksT0FBTztRQUNULE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLEtBQUssSUFBSSxDQUFDLGFBQWEsQ0FBQztJQUN2RCxDQUFDO0lBRUQsSUFBSSxTQUFTO1FBQ1gsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLFNBQVMsS0FBSyxJQUFJLENBQUMsYUFBYSxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUM7SUFDdEUsQ0FBQztJQUVELE9BQU87UUFDTCxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDaEMsQ0FBQztJQUVELE9BQU87UUFDTCxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDaEMsQ0FBQztJQUVELE1BQU07UUFDSixJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDL0IsQ0FBQztJQUVELFFBQVE7UUFDTixJQUFJLE9BQU8sQ0FBQyxzQkFBc0IsQ0FBQyxFQUFFLENBQUM7WUFDcEMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ2pDLENBQUM7SUFDSCxDQUFDO0lBRUQsS0FBSztRQUNILElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUM5QixDQUFDO0lBRUQsTUFBTTtRQUNKLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUN6QixTQUFTLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ3RELENBQUM7UUFDRCxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDL0IsQ0FBQzt3R0EvQ1UsdUJBQXVCOzRGQUF2Qix1QkFBdUIsd1FBbkV4Qjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7R0FzQ1QsMFVBdkNTLFlBQVksa0lBQUUsYUFBYSxtTEFBRSxlQUFlLDJJQUFFLGFBQWE7OzRGQW9FMUQsdUJBQXVCO2tCQXZFbkMsU0FBUzsrQkFDRSxxQkFBcUIsY0FDbkIsSUFBSSxXQUNQLENBQUMsWUFBWSxFQUFFLGFBQWEsRUFBRSxlQUFlLEVBQUUsYUFBYSxDQUFDLFlBQzVEOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQXNDVDs4QkE4QlEsT0FBTztzQkFBZixLQUFLO2dCQUNHLGFBQWE7c0JBQXJCLEtBQUs7Z0JBQ0csTUFBTTtzQkFBZCxLQUFLO2dCQUVJLEtBQUs7c0JBQWQsTUFBTTtnQkFDRyxLQUFLO3NCQUFkLE1BQU07Z0JBQ0csSUFBSTtzQkFBYixNQUFNO2dCQUNHLE1BQU07c0JBQWYsTUFBTTtnQkFDRyxHQUFHO3NCQUFaLE1BQU07Z0JBQ0csSUFBSTtzQkFBYixNQUFNIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQ29tcG9uZW50LCBJbnB1dCwgT3V0cHV0LCBFdmVudEVtaXR0ZXIgfSBmcm9tICdAYW5ndWxhci9jb3JlJztcbmltcG9ydCB7IENvbW1vbk1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL2NvbW1vbic7XG5pbXBvcnQgeyBNYXRJY29uTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvbWF0ZXJpYWwvaWNvbic7XG5pbXBvcnQgeyBNYXRCdXR0b25Nb2R1bGUgfSBmcm9tICdAYW5ndWxhci9tYXRlcmlhbC9idXR0b24nO1xuaW1wb3J0IHsgTWF0TWVudU1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL21hdGVyaWFsL21lbnUnO1xuaW1wb3J0IHsgTWVzc2FnZSB9IGZyb20gJy4uLy4uL21vZGVscy9tZXNzYWdpbmcubW9kZWxzJztcblxuQENvbXBvbmVudCh7XG4gIHNlbGVjdG9yOiAnYXBwLW1lc3NhZ2UtYWN0aW9ucycsXG4gIHN0YW5kYWxvbmU6IHRydWUsXG4gIGltcG9ydHM6IFtDb21tb25Nb2R1bGUsIE1hdEljb25Nb2R1bGUsIE1hdEJ1dHRvbk1vZHVsZSwgTWF0TWVudU1vZHVsZV0sXG4gIHRlbXBsYXRlOiBgXG4gICAgPGRpdiBjbGFzcz1cIm1lc3NhZ2UtYWN0aW9uc1wiPlxuICAgICAgPGJ1dHRvbiBtYXQtaWNvbi1idXR0b24gW21hdE1lbnVUcmlnZ2VyRm9yXT1cIm1lbnVcIiBjbGFzcz1cIm1vcmUtYnRuXCI+XG4gICAgICAgIDxtYXQtaWNvbj5tb3JlX3ZlcnQ8L21hdC1pY29uPlxuICAgICAgPC9idXR0b24+XG4gICAgICBcbiAgICAgIDxtYXQtbWVudSAjbWVudT1cIm1hdE1lbnVcIj5cbiAgICAgICAgPGJ1dHRvbiBtYXQtbWVudS1pdGVtIChjbGljayk9XCJvblJlcGx5KClcIj5cbiAgICAgICAgICA8bWF0LWljb24+cmVwbHk8L21hdC1pY29uPlxuICAgICAgICAgIDxzcGFuPlJlcGx5IGluIHRocmVhZDwvc3Bhbj5cbiAgICAgICAgPC9idXR0b24+XG4gICAgICAgIFxuICAgICAgICA8YnV0dG9uIG1hdC1tZW51LWl0ZW0gKGNsaWNrKT1cIm9uUmVhY3QoKVwiPlxuICAgICAgICAgIDxtYXQtaWNvbj5hZGRfcmVhY3Rpb248L21hdC1pY29uPlxuICAgICAgICAgIDxzcGFuPkFkZCByZWFjdGlvbjwvc3Bhbj5cbiAgICAgICAgPC9idXR0b24+XG4gICAgICAgIFxuICAgICAgICA8YnV0dG9uIG1hdC1tZW51LWl0ZW0gKm5nSWY9XCJjYW5FZGl0XCIgKGNsaWNrKT1cIm9uRWRpdCgpXCI+XG4gICAgICAgICAgPG1hdC1pY29uPmVkaXQ8L21hdC1pY29uPlxuICAgICAgICAgIDxzcGFuPkVkaXQgbWVzc2FnZTwvc3Bhbj5cbiAgICAgICAgPC9idXR0b24+XG4gICAgICAgIFxuICAgICAgICA8YnV0dG9uIG1hdC1tZW51LWl0ZW0gKGNsaWNrKT1cIm9uUGluKClcIj5cbiAgICAgICAgICA8bWF0LWljb24+e3sgbWVzc2FnZS5pc19waW5uZWQgPyAncHVzaF9waW4nIDogJ3B1c2hfcGluJyB9fTwvbWF0LWljb24+XG4gICAgICAgICAgPHNwYW4+e3sgbWVzc2FnZS5pc19waW5uZWQgPyAnVW5waW4nIDogJ1BpbicgfX0gbWVzc2FnZTwvc3Bhbj5cbiAgICAgICAgPC9idXR0b24+XG4gICAgICAgIFxuICAgICAgICA8YnV0dG9uIG1hdC1tZW51LWl0ZW0gKGNsaWNrKT1cIm9uQ29weSgpXCI+XG4gICAgICAgICAgPG1hdC1pY29uPmNvbnRlbnRfY29weTwvbWF0LWljb24+XG4gICAgICAgICAgPHNwYW4+Q29weSB0ZXh0PC9zcGFuPlxuICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgXG4gICAgICAgIDxidXR0b24gbWF0LW1lbnUtaXRlbSAqbmdJZj1cImNhbkRlbGV0ZVwiIChjbGljayk9XCJvbkRlbGV0ZSgpXCIgY2xhc3M9XCJkZWxldGUtYWN0aW9uXCI+XG4gICAgICAgICAgPG1hdC1pY29uPmRlbGV0ZTwvbWF0LWljb24+XG4gICAgICAgICAgPHNwYW4+RGVsZXRlIG1lc3NhZ2U8L3NwYW4+XG4gICAgICAgIDwvYnV0dG9uPlxuICAgICAgPC9tYXQtbWVudT5cbiAgICA8L2Rpdj5cbiAgYCxcbiAgc3R5bGVzOiBbYFxuICAgIC5tZXNzYWdlLWFjdGlvbnMge1xuICAgICAgb3BhY2l0eTogMDtcbiAgICAgIHRyYW5zaXRpb246IG9wYWNpdHkgMC4ycztcbiAgICB9XG5cbiAgICA6aG9zdDpob3ZlciAubWVzc2FnZS1hY3Rpb25zLFxuICAgIC5tZXNzYWdlLWFjdGlvbnM6Zm9jdXMtd2l0aGluIHtcbiAgICAgIG9wYWNpdHk6IDE7XG4gICAgfVxuXG4gICAgLm1vcmUtYnRuIHtcbiAgICAgIHdpZHRoOiAyOHB4O1xuICAgICAgaGVpZ2h0OiAyOHB4O1xuICAgICAgbGluZS1oZWlnaHQ6IDI4cHg7XG4gICAgfVxuXG4gICAgLm1vcmUtYnRuIG1hdC1pY29uIHtcbiAgICAgIGZvbnQtc2l6ZTogMThweDtcbiAgICAgIHdpZHRoOiAxOHB4O1xuICAgICAgaGVpZ2h0OiAxOHB4O1xuICAgIH1cblxuICAgIC5kZWxldGUtYWN0aW9uIHtcbiAgICAgIGNvbG9yOiAjZDMyZjJmO1xuICAgIH1cbiAgYF1cbn0pXG5leHBvcnQgY2xhc3MgTWVzc2FnZUFjdGlvbnNDb21wb25lbnQge1xuICBASW5wdXQoKSBtZXNzYWdlITogTWVzc2FnZTtcbiAgQElucHV0KCkgY3VycmVudFVzZXJJZCE6IHN0cmluZztcbiAgQElucHV0KCkgY2FuUGluID0gZmFsc2U7XG4gIFxuICBAT3V0cHV0KCkgcmVwbHkgPSBuZXcgRXZlbnRFbWl0dGVyPE1lc3NhZ2U+KCk7XG4gIEBPdXRwdXQoKSByZWFjdCA9IG5ldyBFdmVudEVtaXR0ZXI8TWVzc2FnZT4oKTtcbiAgQE91dHB1dCgpIGVkaXQgPSBuZXcgRXZlbnRFbWl0dGVyPE1lc3NhZ2U+KCk7XG4gIEBPdXRwdXQoKSBkZWxldGUgPSBuZXcgRXZlbnRFbWl0dGVyPE1lc3NhZ2U+KCk7XG4gIEBPdXRwdXQoKSBwaW4gPSBuZXcgRXZlbnRFbWl0dGVyPE1lc3NhZ2U+KCk7XG4gIEBPdXRwdXQoKSBjb3B5ID0gbmV3IEV2ZW50RW1pdHRlcjxNZXNzYWdlPigpO1xuXG4gIGdldCBjYW5FZGl0KCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLm1lc3NhZ2Uuc2VuZGVyX2lkID09PSB0aGlzLmN1cnJlbnRVc2VySWQ7XG4gIH1cblxuICBnZXQgY2FuRGVsZXRlKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLm1lc3NhZ2Uuc2VuZGVyX2lkID09PSB0aGlzLmN1cnJlbnRVc2VySWQgfHwgdGhpcy5jYW5QaW47XG4gIH1cblxuICBvblJlcGx5KCkge1xuICAgIHRoaXMucmVwbHkuZW1pdCh0aGlzLm1lc3NhZ2UpO1xuICB9XG5cbiAgb25SZWFjdCgpIHtcbiAgICB0aGlzLnJlYWN0LmVtaXQodGhpcy5tZXNzYWdlKTtcbiAgfVxuXG4gIG9uRWRpdCgpIHtcbiAgICB0aGlzLmVkaXQuZW1pdCh0aGlzLm1lc3NhZ2UpO1xuICB9XG5cbiAgb25EZWxldGUoKSB7XG4gICAgaWYgKGNvbmZpcm0oJ0RlbGV0ZSB0aGlzIG1lc3NhZ2U/JykpIHtcbiAgICAgIHRoaXMuZGVsZXRlLmVtaXQodGhpcy5tZXNzYWdlKTtcbiAgICB9XG4gIH1cblxuICBvblBpbigpIHtcbiAgICB0aGlzLnBpbi5lbWl0KHRoaXMubWVzc2FnZSk7XG4gIH1cblxuICBvbkNvcHkoKSB7XG4gICAgaWYgKHRoaXMubWVzc2FnZS5jb250ZW50KSB7XG4gICAgICBuYXZpZ2F0b3IuY2xpcGJvYXJkLndyaXRlVGV4dCh0aGlzLm1lc3NhZ2UuY29udGVudCk7XG4gICAgfVxuICAgIHRoaXMuY29weS5lbWl0KHRoaXMubWVzc2FnZSk7XG4gIH1cbn1cbiJdfQ==