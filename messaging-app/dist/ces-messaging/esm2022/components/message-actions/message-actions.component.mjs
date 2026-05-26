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
        return (this.message.sender_id === this.currentUserId &&
            this.message.message_type === 'TEXT' &&
            !this.isDeleted &&
            !String(this.message.message_id || '').startsWith('temp-'));
    }
    get canDelete() {
        return ((this.message.sender_id === this.currentUserId || this.canPin) &&
            !this.isDeleted &&
            !String(this.message.message_id || '').startsWith('temp-'));
    }
    get isDeleted() {
        return Boolean(this.message.is_deleted || this.message.deleted_at || this.message.content === '[deleted]');
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVzc2FnZS1hY3Rpb25zLmNvbXBvbmVudC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9saWIvY29tcG9uZW50cy9tZXNzYWdlLWFjdGlvbnMvbWVzc2FnZS1hY3Rpb25zLmNvbXBvbmVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsU0FBUyxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsWUFBWSxFQUFFLE1BQU0sZUFBZSxDQUFDO0FBQ3ZFLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUMvQyxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sd0JBQXdCLENBQUM7QUFDdkQsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBQzNELE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSx3QkFBd0IsQ0FBQzs7Ozs7O0FBMEV2RCxNQUFNLE9BQU8sdUJBQXVCO0lBQ3pCLE9BQU8sQ0FBVztJQUNsQixhQUFhLENBQVU7SUFDdkIsTUFBTSxHQUFHLEtBQUssQ0FBQztJQUVkLEtBQUssR0FBRyxJQUFJLFlBQVksRUFBVyxDQUFDO0lBQ3BDLEtBQUssR0FBRyxJQUFJLFlBQVksRUFBVyxDQUFDO0lBQ3BDLElBQUksR0FBRyxJQUFJLFlBQVksRUFBVyxDQUFDO0lBQ25DLE1BQU0sR0FBRyxJQUFJLFlBQVksRUFBVyxDQUFDO0lBQ3JDLEdBQUcsR0FBRyxJQUFJLFlBQVksRUFBVyxDQUFDO0lBQ2xDLElBQUksR0FBRyxJQUFJLFlBQVksRUFBVyxDQUFDO0lBRTdDLElBQUksT0FBTztRQUNULE9BQU8sQ0FDTCxJQUFJLENBQUMsT0FBTyxDQUFDLFNBQVMsS0FBSyxJQUFJLENBQUMsYUFBYTtZQUM3QyxJQUFJLENBQUMsT0FBTyxDQUFDLFlBQVksS0FBSyxNQUFNO1lBQ3BDLENBQUMsSUFBSSxDQUFDLFNBQVM7WUFDZixDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFVBQVUsSUFBSSxFQUFFLENBQUMsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLENBQzNELENBQUM7SUFDSixDQUFDO0lBRUQsSUFBSSxTQUFTO1FBQ1gsT0FBTyxDQUNMLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLEtBQUssSUFBSSxDQUFDLGFBQWEsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDO1lBQzlELENBQUMsSUFBSSxDQUFDLFNBQVM7WUFDZixDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFVBQVUsSUFBSSxFQUFFLENBQUMsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLENBQzNELENBQUM7SUFDSixDQUFDO0lBRUQsSUFBWSxTQUFTO1FBQ25CLE9BQU8sT0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsVUFBVSxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsVUFBVSxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxLQUFLLFdBQVcsQ0FBQyxDQUFDO0lBQzdHLENBQUM7SUFFRCxPQUFPO1FBQ0wsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQ2hDLENBQUM7SUFFRCxPQUFPO1FBQ0wsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQ2hDLENBQUM7SUFFRCxNQUFNO1FBQ0osSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQy9CLENBQUM7SUFFRCxRQUFRO1FBQ04sSUFBSSxPQUFPLENBQUMsc0JBQXNCLENBQUMsRUFBRSxDQUFDO1lBQ3BDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUNqQyxDQUFDO0lBQ0gsQ0FBQztJQUVELEtBQUs7UUFDSCxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDOUIsQ0FBQztJQUVELE1BQU07UUFDSixJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDekIsU0FBUyxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUN0RCxDQUFDO1FBQ0QsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQy9CLENBQUM7d0dBNURVLHVCQUF1Qjs0RkFBdkIsdUJBQXVCLHdRQW5FeEI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBc0NULDBVQXZDUyxZQUFZLGtJQUFFLGFBQWEsbUxBQUUsZUFBZSwySUFBRSxhQUFhOzs0RkFvRTFELHVCQUF1QjtrQkF2RW5DLFNBQVM7K0JBQ0UscUJBQXFCLGNBQ25CLElBQUksV0FDUCxDQUFDLFlBQVksRUFBRSxhQUFhLEVBQUUsZUFBZSxFQUFFLGFBQWEsQ0FBQyxZQUM1RDs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7R0FzQ1Q7OEJBOEJRLE9BQU87c0JBQWYsS0FBSztnQkFDRyxhQUFhO3NCQUFyQixLQUFLO2dCQUNHLE1BQU07c0JBQWQsS0FBSztnQkFFSSxLQUFLO3NCQUFkLE1BQU07Z0JBQ0csS0FBSztzQkFBZCxNQUFNO2dCQUNHLElBQUk7c0JBQWIsTUFBTTtnQkFDRyxNQUFNO3NCQUFmLE1BQU07Z0JBQ0csR0FBRztzQkFBWixNQUFNO2dCQUNHLElBQUk7c0JBQWIsTUFBTSIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IENvbXBvbmVudCwgSW5wdXQsIE91dHB1dCwgRXZlbnRFbWl0dGVyIH0gZnJvbSAnQGFuZ3VsYXIvY29yZSc7XG5pbXBvcnQgeyBDb21tb25Nb2R1bGUgfSBmcm9tICdAYW5ndWxhci9jb21tb24nO1xuaW1wb3J0IHsgTWF0SWNvbk1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL21hdGVyaWFsL2ljb24nO1xuaW1wb3J0IHsgTWF0QnV0dG9uTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvbWF0ZXJpYWwvYnV0dG9uJztcbmltcG9ydCB7IE1hdE1lbnVNb2R1bGUgfSBmcm9tICdAYW5ndWxhci9tYXRlcmlhbC9tZW51JztcbmltcG9ydCB7IE1lc3NhZ2UgfSBmcm9tICcuLi8uLi9tb2RlbHMvbWVzc2FnaW5nLm1vZGVscyc7XG5cbkBDb21wb25lbnQoe1xuICBzZWxlY3RvcjogJ2FwcC1tZXNzYWdlLWFjdGlvbnMnLFxuICBzdGFuZGFsb25lOiB0cnVlLFxuICBpbXBvcnRzOiBbQ29tbW9uTW9kdWxlLCBNYXRJY29uTW9kdWxlLCBNYXRCdXR0b25Nb2R1bGUsIE1hdE1lbnVNb2R1bGVdLFxuICB0ZW1wbGF0ZTogYFxuICAgIDxkaXYgY2xhc3M9XCJtZXNzYWdlLWFjdGlvbnNcIj5cbiAgICAgIDxidXR0b24gbWF0LWljb24tYnV0dG9uIFttYXRNZW51VHJpZ2dlckZvcl09XCJtZW51XCIgY2xhc3M9XCJtb3JlLWJ0blwiPlxuICAgICAgICA8bWF0LWljb24+bW9yZV92ZXJ0PC9tYXQtaWNvbj5cbiAgICAgIDwvYnV0dG9uPlxuICAgICAgXG4gICAgICA8bWF0LW1lbnUgI21lbnU9XCJtYXRNZW51XCI+XG4gICAgICAgIDxidXR0b24gbWF0LW1lbnUtaXRlbSAoY2xpY2spPVwib25SZXBseSgpXCI+XG4gICAgICAgICAgPG1hdC1pY29uPnJlcGx5PC9tYXQtaWNvbj5cbiAgICAgICAgICA8c3Bhbj5SZXBseSBpbiB0aHJlYWQ8L3NwYW4+XG4gICAgICAgIDwvYnV0dG9uPlxuICAgICAgICBcbiAgICAgICAgPGJ1dHRvbiBtYXQtbWVudS1pdGVtIChjbGljayk9XCJvblJlYWN0KClcIj5cbiAgICAgICAgICA8bWF0LWljb24+YWRkX3JlYWN0aW9uPC9tYXQtaWNvbj5cbiAgICAgICAgICA8c3Bhbj5BZGQgcmVhY3Rpb248L3NwYW4+XG4gICAgICAgIDwvYnV0dG9uPlxuICAgICAgICBcbiAgICAgICAgPGJ1dHRvbiBtYXQtbWVudS1pdGVtICpuZ0lmPVwiY2FuRWRpdFwiIChjbGljayk9XCJvbkVkaXQoKVwiPlxuICAgICAgICAgIDxtYXQtaWNvbj5lZGl0PC9tYXQtaWNvbj5cbiAgICAgICAgICA8c3Bhbj5FZGl0IG1lc3NhZ2U8L3NwYW4+XG4gICAgICAgIDwvYnV0dG9uPlxuICAgICAgICBcbiAgICAgICAgPGJ1dHRvbiBtYXQtbWVudS1pdGVtIChjbGljayk9XCJvblBpbigpXCI+XG4gICAgICAgICAgPG1hdC1pY29uPnt7IG1lc3NhZ2UuaXNfcGlubmVkID8gJ3B1c2hfcGluJyA6ICdwdXNoX3BpbicgfX08L21hdC1pY29uPlxuICAgICAgICAgIDxzcGFuPnt7IG1lc3NhZ2UuaXNfcGlubmVkID8gJ1VucGluJyA6ICdQaW4nIH19IG1lc3NhZ2U8L3NwYW4+XG4gICAgICAgIDwvYnV0dG9uPlxuICAgICAgICBcbiAgICAgICAgPGJ1dHRvbiBtYXQtbWVudS1pdGVtIChjbGljayk9XCJvbkNvcHkoKVwiPlxuICAgICAgICAgIDxtYXQtaWNvbj5jb250ZW50X2NvcHk8L21hdC1pY29uPlxuICAgICAgICAgIDxzcGFuPkNvcHkgdGV4dDwvc3Bhbj5cbiAgICAgICAgPC9idXR0b24+XG4gICAgICAgIFxuICAgICAgICA8YnV0dG9uIG1hdC1tZW51LWl0ZW0gKm5nSWY9XCJjYW5EZWxldGVcIiAoY2xpY2spPVwib25EZWxldGUoKVwiIGNsYXNzPVwiZGVsZXRlLWFjdGlvblwiPlxuICAgICAgICAgIDxtYXQtaWNvbj5kZWxldGU8L21hdC1pY29uPlxuICAgICAgICAgIDxzcGFuPkRlbGV0ZSBtZXNzYWdlPC9zcGFuPlxuICAgICAgICA8L2J1dHRvbj5cbiAgICAgIDwvbWF0LW1lbnU+XG4gICAgPC9kaXY+XG4gIGAsXG4gIHN0eWxlczogW2BcbiAgICAubWVzc2FnZS1hY3Rpb25zIHtcbiAgICAgIG9wYWNpdHk6IDA7XG4gICAgICB0cmFuc2l0aW9uOiBvcGFjaXR5IDAuMnM7XG4gICAgfVxuXG4gICAgOmhvc3Q6aG92ZXIgLm1lc3NhZ2UtYWN0aW9ucyxcbiAgICAubWVzc2FnZS1hY3Rpb25zOmZvY3VzLXdpdGhpbiB7XG4gICAgICBvcGFjaXR5OiAxO1xuICAgIH1cblxuICAgIC5tb3JlLWJ0biB7XG4gICAgICB3aWR0aDogMjhweDtcbiAgICAgIGhlaWdodDogMjhweDtcbiAgICAgIGxpbmUtaGVpZ2h0OiAyOHB4O1xuICAgIH1cblxuICAgIC5tb3JlLWJ0biBtYXQtaWNvbiB7XG4gICAgICBmb250LXNpemU6IDE4cHg7XG4gICAgICB3aWR0aDogMThweDtcbiAgICAgIGhlaWdodDogMThweDtcbiAgICB9XG5cbiAgICAuZGVsZXRlLWFjdGlvbiB7XG4gICAgICBjb2xvcjogI2QzMmYyZjtcbiAgICB9XG4gIGBdXG59KVxuZXhwb3J0IGNsYXNzIE1lc3NhZ2VBY3Rpb25zQ29tcG9uZW50IHtcbiAgQElucHV0KCkgbWVzc2FnZSE6IE1lc3NhZ2U7XG4gIEBJbnB1dCgpIGN1cnJlbnRVc2VySWQhOiBzdHJpbmc7XG4gIEBJbnB1dCgpIGNhblBpbiA9IGZhbHNlO1xuICBcbiAgQE91dHB1dCgpIHJlcGx5ID0gbmV3IEV2ZW50RW1pdHRlcjxNZXNzYWdlPigpO1xuICBAT3V0cHV0KCkgcmVhY3QgPSBuZXcgRXZlbnRFbWl0dGVyPE1lc3NhZ2U+KCk7XG4gIEBPdXRwdXQoKSBlZGl0ID0gbmV3IEV2ZW50RW1pdHRlcjxNZXNzYWdlPigpO1xuICBAT3V0cHV0KCkgZGVsZXRlID0gbmV3IEV2ZW50RW1pdHRlcjxNZXNzYWdlPigpO1xuICBAT3V0cHV0KCkgcGluID0gbmV3IEV2ZW50RW1pdHRlcjxNZXNzYWdlPigpO1xuICBAT3V0cHV0KCkgY29weSA9IG5ldyBFdmVudEVtaXR0ZXI8TWVzc2FnZT4oKTtcblxuICBnZXQgY2FuRWRpdCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gKFxuICAgICAgdGhpcy5tZXNzYWdlLnNlbmRlcl9pZCA9PT0gdGhpcy5jdXJyZW50VXNlcklkICYmXG4gICAgICB0aGlzLm1lc3NhZ2UubWVzc2FnZV90eXBlID09PSAnVEVYVCcgJiZcbiAgICAgICF0aGlzLmlzRGVsZXRlZCAmJlxuICAgICAgIVN0cmluZyh0aGlzLm1lc3NhZ2UubWVzc2FnZV9pZCB8fCAnJykuc3RhcnRzV2l0aCgndGVtcC0nKVxuICAgICk7XG4gIH1cblxuICBnZXQgY2FuRGVsZXRlKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiAoXG4gICAgICAodGhpcy5tZXNzYWdlLnNlbmRlcl9pZCA9PT0gdGhpcy5jdXJyZW50VXNlcklkIHx8IHRoaXMuY2FuUGluKSAmJlxuICAgICAgIXRoaXMuaXNEZWxldGVkICYmXG4gICAgICAhU3RyaW5nKHRoaXMubWVzc2FnZS5tZXNzYWdlX2lkIHx8ICcnKS5zdGFydHNXaXRoKCd0ZW1wLScpXG4gICAgKTtcbiAgfVxuXG4gIHByaXZhdGUgZ2V0IGlzRGVsZXRlZCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gQm9vbGVhbih0aGlzLm1lc3NhZ2UuaXNfZGVsZXRlZCB8fCB0aGlzLm1lc3NhZ2UuZGVsZXRlZF9hdCB8fCB0aGlzLm1lc3NhZ2UuY29udGVudCA9PT0gJ1tkZWxldGVkXScpO1xuICB9XG5cbiAgb25SZXBseSgpIHtcbiAgICB0aGlzLnJlcGx5LmVtaXQodGhpcy5tZXNzYWdlKTtcbiAgfVxuXG4gIG9uUmVhY3QoKSB7XG4gICAgdGhpcy5yZWFjdC5lbWl0KHRoaXMubWVzc2FnZSk7XG4gIH1cblxuICBvbkVkaXQoKSB7XG4gICAgdGhpcy5lZGl0LmVtaXQodGhpcy5tZXNzYWdlKTtcbiAgfVxuXG4gIG9uRGVsZXRlKCkge1xuICAgIGlmIChjb25maXJtKCdEZWxldGUgdGhpcyBtZXNzYWdlPycpKSB7XG4gICAgICB0aGlzLmRlbGV0ZS5lbWl0KHRoaXMubWVzc2FnZSk7XG4gICAgfVxuICB9XG5cbiAgb25QaW4oKSB7XG4gICAgdGhpcy5waW4uZW1pdCh0aGlzLm1lc3NhZ2UpO1xuICB9XG5cbiAgb25Db3B5KCkge1xuICAgIGlmICh0aGlzLm1lc3NhZ2UuY29udGVudCkge1xuICAgICAgbmF2aWdhdG9yLmNsaXBib2FyZC53cml0ZVRleHQodGhpcy5tZXNzYWdlLmNvbnRlbnQpO1xuICAgIH1cbiAgICB0aGlzLmNvcHkuZW1pdCh0aGlzLm1lc3NhZ2UpO1xuICB9XG59XG4iXX0=