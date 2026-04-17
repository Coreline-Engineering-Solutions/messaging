import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatRippleModule } from '@angular/material/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import * as i0 from "@angular/core";
import * as i1 from "../../services/messaging-store.service";
import * as i2 from "@angular/common";
import * as i3 from "@angular/forms";
import * as i4 from "@angular/material/icon";
import * as i5 from "@angular/material/button";
import * as i6 from "@angular/material/core";
import * as i7 from "@angular/material/tooltip";
export class InboxListComponent {
    store;
    inbox = [];
    searchQuery = '';
    contextMenu = null;
    sub;
    constructor(store) {
        this.store = store;
    }
    ngOnInit() {
        this.sub = this.store.inbox.subscribe((items) => (this.inbox = items));
    }
    ngOnDestroy() {
        this.sub?.unsubscribe();
    }
    get filteredInbox() {
        if (!this.searchQuery.trim())
            return this.inbox;
        const q = this.searchQuery.toLowerCase();
        return this.inbox.filter((item) => (item.name || '').toLowerCase().includes(q) ||
            (item.last_message_preview || '').toLowerCase().includes(q));
    }
    openConversation(item) {
        this.store.openConversation(item.conversation_id, item.name || 'Chat', item.is_group);
    }
    onNewConversation() {
        this.store.setView('new-conversation');
    }
    onCreateGroup() {
        this.store.setView('group-manager');
    }
    onContextMenu(event, item) {
        event.preventDefault();
        event.stopPropagation();
        this.contextMenu = { x: event.clientX, y: event.clientY, item };
    }
    closeContextMenu() {
        this.contextMenu = null;
    }
    clearChat() {
        if (!this.contextMenu)
            return;
        const id = this.contextMenu.item.conversation_id;
        this.store.clearConversation(id);
        this.contextMenu = null;
    }
    deleteChat() {
        if (!this.contextMenu)
            return;
        const item = this.contextMenu.item;
        if (item.is_group) {
            this.store.deleteGroup(item.conversation_id);
        }
        else {
            this.store.deleteConversation(item.conversation_id);
        }
        this.contextMenu = null;
    }
    formatTime(dateStr) {
        if (!dateStr)
            return '';
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        if (diffMins < 1)
            return 'now';
        if (diffMins < 60)
            return `${diffMins}m`;
        if (diffHours < 24)
            return `${diffHours}h`;
        if (diffDays < 7)
            return `${diffDays}d`;
        return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: InboxListComponent, deps: [{ token: i1.MessagingStoreService }], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "17.3.12", type: InboxListComponent, isStandalone: true, selector: "app-inbox-list", ngImport: i0, template: `
    <div class="inbox-container">
      <div class="inbox-header">
        <h3>Messages</h3>
        <div class="header-actions">
          <button mat-icon-button class="hdr-btn" (click)="onNewConversation()" matTooltip="New conversation" matTooltipPosition="below">
            <mat-icon>edit_square</mat-icon>
          </button>
          <button mat-icon-button class="hdr-btn" (click)="onCreateGroup()" matTooltip="Create group" matTooltipPosition="below">
            <mat-icon>group_add</mat-icon>
          </button>
        </div>
      </div>

      <div class="search-bar">
        <mat-icon class="search-icon">search</mat-icon>
        <input
          type="text"
          [(ngModel)]="searchQuery"
          placeholder="Search conversations..."
          class="search-input"
        />
      </div>

      <div class="conversation-list">
        <div
          *ngFor="let item of filteredInbox"
          class="conversation-item"
          matRipple
          [class.has-unread]="item.unread_count > 0"
          (click)="openConversation(item)"
          (contextmenu)="onContextMenu($event, item)"
        >
          <div class="avatar" [class.group-avatar]="item.is_group">
            <mat-icon>{{ item.is_group ? 'group' : 'person' }}</mat-icon>
          </div>
          <div class="conversation-info">
            <div class="info-top">
              <span class="conv-name">{{ item.name || 'Direct Message' }}</span>
              <span class="conv-time">{{ formatTime(item.last_message_at) }}</span>
            </div>
            <div class="info-bottom">
              <span class="conv-preview">{{ item.last_message_preview || 'No messages yet' }}</span>
              <span *ngIf="item.unread_count > 0" class="unread-badge">
                {{ item.unread_count > 99 ? '99+' : item.unread_count }}
              </span>
            </div>
          </div>
        </div>

        <div *ngIf="filteredInbox.length === 0" class="empty-state">
          <mat-icon>forum</mat-icon>
          <p>{{ searchQuery ? 'No matching conversations' : 'No conversations yet' }}</p>
          <button *ngIf="!searchQuery" mat-stroked-button color="primary" (click)="onNewConversation()">
            Start a conversation
          </button>
        </div>
      </div>

      <!-- Context Menu -->
      <div
        *ngIf="contextMenu"
        class="context-menu"
        [style.top.px]="contextMenu.y"
        [style.left.px]="contextMenu.x"
      >
        <div class="ctx-item" (click)="clearChat()">
          <mat-icon>cleaning_services</mat-icon>
          <span>Clear conversation</span>
        </div>
        <div class="ctx-item ctx-danger" (click)="deleteChat()">
          <mat-icon>delete</mat-icon>
          <span>{{ contextMenu.item.is_group ? 'Delete group' : 'Delete conversation' }}</span>
        </div>
      </div>
      <div *ngIf="contextMenu" class="ctx-backdrop" (click)="closeContextMenu()"></div>
    </div>
  `, isInline: true, styles: [".inbox-container{display:flex;flex-direction:column;height:100%;background:transparent}.inbox-header{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid rgba(255,255,255,.2)}.inbox-header h3{margin:0;font-size:20px;font-weight:700;color:#fff}.header-actions{display:flex;gap:4px}.hdr-btn{border-radius:6px!important;transition:background .15s,box-shadow .15s}.hdr-btn:hover{background:#ffffff26!important;box-shadow:0 2px 8px #0003}.hdr-btn mat-icon{font-size:20px;color:#ffffffe6}.search-bar{display:flex;align-items:center;margin:4px 16px 8px;padding:8px 12px;background:transparent;border-radius:10px}.search-icon{color:#ffffffb3;font-size:18px;width:20px;height:20px;margin-right:8px}.search-input{flex:1;border:none;outline:none;background:transparent;font-size:14px;color:#fff}.search-input::placeholder{color:#fff9}.conversation-list{flex:1;overflow-y:auto}.conversation-item{display:flex;align-items:center;padding:12px 16px;cursor:pointer;transition:background .15s;gap:12px}.conversation-item:hover{background:#ffffff1a}.conversation-item.has-unread{background:#ffffff26}.avatar{width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#dbeafe,#93c5fd);display:flex;align-items:center;justify-content:center;flex-shrink:0}.avatar mat-icon{color:#1f4bd8;font-size:24px}.group-avatar{background:linear-gradient(135deg,#dbeafe,#60a5fa)}.group-avatar mat-icon{color:#173396}.conversation-info{flex:1;min-width:0}.info-top{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:2px}.conv-name{font-weight:600;font-size:14px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px}.conv-time{font-size:11px;color:#ffffffb3;flex-shrink:0;margin-left:8px}.info-bottom{display:flex;justify-content:space-between;align-items:center}.conv-preview{font-size:13px;color:#ffffffb3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px}.has-unread .conv-name{color:#fff}.has-unread .conv-preview{color:#374151;font-weight:500}.unread-badge{background:#1f4bd8;color:#fff;border-radius:10px;min-width:20px;height:20px;font-size:11px;font-weight:600;display:flex;align-items:center;justify-content:center;padding:0 6px;flex-shrink:0}.empty-state{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 24px;color:#9ca3af}.empty-state mat-icon{font-size:48px;width:48px;height:48px;margin-bottom:12px}.empty-state p{margin:0 0 16px;font-size:14px}.context-menu{position:fixed;z-index:10001;background:#1e1e2e;border-radius:8px;padding:4px 0;box-shadow:0 8px 24px #0000004d;min-width:200px}.ctx-item{display:flex;align-items:center;gap:10px;padding:10px 16px;cursor:pointer;color:#ffffffe6;font-size:13px;transition:background .15s}.ctx-item:hover{background:#ffffff1a}.ctx-item mat-icon{font-size:18px;width:18px;height:18px}.ctx-danger{color:#f87171}.ctx-danger:hover{background:#f8717126}.ctx-backdrop{position:fixed;inset:0;z-index:10000}\n"], dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i2.NgForOf, selector: "[ngFor][ngForOf]", inputs: ["ngForOf", "ngForTrackBy", "ngForTemplate"] }, { kind: "directive", type: i2.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "ngmodule", type: FormsModule }, { kind: "directive", type: i3.DefaultValueAccessor, selector: "input:not([type=checkbox])[formControlName],textarea[formControlName],input:not([type=checkbox])[formControl],textarea[formControl],input:not([type=checkbox])[ngModel],textarea[ngModel],[ngDefaultControl]" }, { kind: "directive", type: i3.NgControlStatus, selector: "[formControlName],[ngModel],[formControl]" }, { kind: "directive", type: i3.NgModel, selector: "[ngModel]:not([formControlName]):not([formControl])", inputs: ["name", "disabled", "ngModel", "ngModelOptions"], outputs: ["ngModelChange"], exportAs: ["ngModel"] }, { kind: "ngmodule", type: MatIconModule }, { kind: "component", type: i4.MatIcon, selector: "mat-icon", inputs: ["color", "inline", "svgIcon", "fontSet", "fontIcon"], exportAs: ["matIcon"] }, { kind: "ngmodule", type: MatButtonModule }, { kind: "component", type: i5.MatButton, selector: "    button[mat-button], button[mat-raised-button], button[mat-flat-button],    button[mat-stroked-button]  ", exportAs: ["matButton"] }, { kind: "component", type: i5.MatIconButton, selector: "button[mat-icon-button]", exportAs: ["matButton"] }, { kind: "ngmodule", type: MatRippleModule }, { kind: "directive", type: i6.MatRipple, selector: "[mat-ripple], [matRipple]", inputs: ["matRippleColor", "matRippleUnbounded", "matRippleCentered", "matRippleRadius", "matRippleAnimation", "matRippleDisabled", "matRippleTrigger"], exportAs: ["matRipple"] }, { kind: "ngmodule", type: MatTooltipModule }, { kind: "directive", type: i7.MatTooltip, selector: "[matTooltip]", inputs: ["matTooltipPosition", "matTooltipPositionAtOrigin", "matTooltipDisabled", "matTooltipShowDelay", "matTooltipHideDelay", "matTooltipTouchGestures", "matTooltip", "matTooltipClass"], exportAs: ["matTooltip"] }] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: InboxListComponent, decorators: [{
            type: Component,
            args: [{ selector: 'app-inbox-list', standalone: true, imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatRippleModule, MatTooltipModule], template: `
    <div class="inbox-container">
      <div class="inbox-header">
        <h3>Messages</h3>
        <div class="header-actions">
          <button mat-icon-button class="hdr-btn" (click)="onNewConversation()" matTooltip="New conversation" matTooltipPosition="below">
            <mat-icon>edit_square</mat-icon>
          </button>
          <button mat-icon-button class="hdr-btn" (click)="onCreateGroup()" matTooltip="Create group" matTooltipPosition="below">
            <mat-icon>group_add</mat-icon>
          </button>
        </div>
      </div>

      <div class="search-bar">
        <mat-icon class="search-icon">search</mat-icon>
        <input
          type="text"
          [(ngModel)]="searchQuery"
          placeholder="Search conversations..."
          class="search-input"
        />
      </div>

      <div class="conversation-list">
        <div
          *ngFor="let item of filteredInbox"
          class="conversation-item"
          matRipple
          [class.has-unread]="item.unread_count > 0"
          (click)="openConversation(item)"
          (contextmenu)="onContextMenu($event, item)"
        >
          <div class="avatar" [class.group-avatar]="item.is_group">
            <mat-icon>{{ item.is_group ? 'group' : 'person' }}</mat-icon>
          </div>
          <div class="conversation-info">
            <div class="info-top">
              <span class="conv-name">{{ item.name || 'Direct Message' }}</span>
              <span class="conv-time">{{ formatTime(item.last_message_at) }}</span>
            </div>
            <div class="info-bottom">
              <span class="conv-preview">{{ item.last_message_preview || 'No messages yet' }}</span>
              <span *ngIf="item.unread_count > 0" class="unread-badge">
                {{ item.unread_count > 99 ? '99+' : item.unread_count }}
              </span>
            </div>
          </div>
        </div>

        <div *ngIf="filteredInbox.length === 0" class="empty-state">
          <mat-icon>forum</mat-icon>
          <p>{{ searchQuery ? 'No matching conversations' : 'No conversations yet' }}</p>
          <button *ngIf="!searchQuery" mat-stroked-button color="primary" (click)="onNewConversation()">
            Start a conversation
          </button>
        </div>
      </div>

      <!-- Context Menu -->
      <div
        *ngIf="contextMenu"
        class="context-menu"
        [style.top.px]="contextMenu.y"
        [style.left.px]="contextMenu.x"
      >
        <div class="ctx-item" (click)="clearChat()">
          <mat-icon>cleaning_services</mat-icon>
          <span>Clear conversation</span>
        </div>
        <div class="ctx-item ctx-danger" (click)="deleteChat()">
          <mat-icon>delete</mat-icon>
          <span>{{ contextMenu.item.is_group ? 'Delete group' : 'Delete conversation' }}</span>
        </div>
      </div>
      <div *ngIf="contextMenu" class="ctx-backdrop" (click)="closeContextMenu()"></div>
    </div>
  `, styles: [".inbox-container{display:flex;flex-direction:column;height:100%;background:transparent}.inbox-header{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid rgba(255,255,255,.2)}.inbox-header h3{margin:0;font-size:20px;font-weight:700;color:#fff}.header-actions{display:flex;gap:4px}.hdr-btn{border-radius:6px!important;transition:background .15s,box-shadow .15s}.hdr-btn:hover{background:#ffffff26!important;box-shadow:0 2px 8px #0003}.hdr-btn mat-icon{font-size:20px;color:#ffffffe6}.search-bar{display:flex;align-items:center;margin:4px 16px 8px;padding:8px 12px;background:transparent;border-radius:10px}.search-icon{color:#ffffffb3;font-size:18px;width:20px;height:20px;margin-right:8px}.search-input{flex:1;border:none;outline:none;background:transparent;font-size:14px;color:#fff}.search-input::placeholder{color:#fff9}.conversation-list{flex:1;overflow-y:auto}.conversation-item{display:flex;align-items:center;padding:12px 16px;cursor:pointer;transition:background .15s;gap:12px}.conversation-item:hover{background:#ffffff1a}.conversation-item.has-unread{background:#ffffff26}.avatar{width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#dbeafe,#93c5fd);display:flex;align-items:center;justify-content:center;flex-shrink:0}.avatar mat-icon{color:#1f4bd8;font-size:24px}.group-avatar{background:linear-gradient(135deg,#dbeafe,#60a5fa)}.group-avatar mat-icon{color:#173396}.conversation-info{flex:1;min-width:0}.info-top{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:2px}.conv-name{font-weight:600;font-size:14px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px}.conv-time{font-size:11px;color:#ffffffb3;flex-shrink:0;margin-left:8px}.info-bottom{display:flex;justify-content:space-between;align-items:center}.conv-preview{font-size:13px;color:#ffffffb3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px}.has-unread .conv-name{color:#fff}.has-unread .conv-preview{color:#374151;font-weight:500}.unread-badge{background:#1f4bd8;color:#fff;border-radius:10px;min-width:20px;height:20px;font-size:11px;font-weight:600;display:flex;align-items:center;justify-content:center;padding:0 6px;flex-shrink:0}.empty-state{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 24px;color:#9ca3af}.empty-state mat-icon{font-size:48px;width:48px;height:48px;margin-bottom:12px}.empty-state p{margin:0 0 16px;font-size:14px}.context-menu{position:fixed;z-index:10001;background:#1e1e2e;border-radius:8px;padding:4px 0;box-shadow:0 8px 24px #0000004d;min-width:200px}.ctx-item{display:flex;align-items:center;gap:10px;padding:10px 16px;cursor:pointer;color:#ffffffe6;font-size:13px;transition:background .15s}.ctx-item:hover{background:#ffffff1a}.ctx-item mat-icon{font-size:18px;width:18px;height:18px}.ctx-danger{color:#f87171}.ctx-danger:hover{background:#f8717126}.ctx-backdrop{position:fixed;inset:0;z-index:10000}\n"] }]
        }], ctorParameters: () => [{ type: i1.MessagingStoreService }] });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5ib3gtbGlzdC5jb21wb25lbnQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvbGliL2NvbXBvbmVudHMvaW5ib3gtbGlzdC9pbmJveC1saXN0LmNvbXBvbmVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsU0FBUyxFQUFxQixNQUFNLGVBQWUsQ0FBQztBQUM3RCxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDL0MsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLGdCQUFnQixDQUFDO0FBQzdDLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSx3QkFBd0IsQ0FBQztBQUN2RCxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFDM0QsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHdCQUF3QixDQUFDO0FBQ3pELE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLDJCQUEyQixDQUFDOzs7Ozs7Ozs7QUFxVjdELE1BQU0sT0FBTyxrQkFBa0I7SUFNVDtJQUxwQixLQUFLLEdBQWdCLEVBQUUsQ0FBQztJQUN4QixXQUFXLEdBQUcsRUFBRSxDQUFDO0lBQ2pCLFdBQVcsR0FBcUQsSUFBSSxDQUFDO0lBQzdELEdBQUcsQ0FBZ0I7SUFFM0IsWUFBb0IsS0FBNEI7UUFBNUIsVUFBSyxHQUFMLEtBQUssQ0FBdUI7SUFBRyxDQUFDO0lBRXBELFFBQVE7UUFDTixJQUFJLENBQUMsR0FBRyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUM7SUFDekUsQ0FBQztJQUVELFdBQVc7UUFDVCxJQUFJLENBQUMsR0FBRyxFQUFFLFdBQVcsRUFBRSxDQUFDO0lBQzFCLENBQUM7SUFFRCxJQUFJLGFBQWE7UUFDZixJQUFJ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QUssQ0FBQyxNQUFNLEdBQUcsT0FBTyxDQUFDLENBQUM7UUFDL0MsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsUUFBUSxDQUFDLENBQUM7UUFFL0MsSUFBSSxRQUFRLEdBQUcsQ0FBQztZQUFFLE9BQU8sS0FBSyxDQUFDO1FBQy9CLElBQUksUUFBUSxHQUFHLEVBQUU7WUFBRSxPQUFPLEdBQUcsUUFBUSxHQUFHLENBQUM7UUFDekMsSUFBSSxTQUFTLEdBQUcsRUFBRTtZQUFFLE9BQU8sR0FBRyxTQUFTLEdBQUcsQ0FBQztRQUMzQyxJQUFJLFFBQVEsR0FBRyxDQUFDO1lBQUUsT0FBTyxHQUFHLFFBQVEsR0FBRyxDQUFDO1FBRXhDLE9BQU8sSUFBSSxDQUFDLGtCQUFrQixDQUFDLE9BQU8sRUFBRSxFQUFFLEdBQUcsRUFBRSxTQUFTLEVBQUUsS0FBSyxFQUFFLE9BQU8sRUFBRSxDQUFDLENBQUM7SUFDOUUsQ0FBQzt3R0FqRlUsa0JBQWtCOzRGQUFsQixrQkFBa0IsMEVBNVVuQjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7R0E2RVQsMmdHQTlFUyxZQUFZLCtQQUFFLFdBQVcsOG1CQUFFLGFBQWEsbUxBQUUsZUFBZSx3VUFBRSxlQUFlLGtTQUFFLGdCQUFnQjs7NEZBNlUzRixrQkFBa0I7a0JBaFY5QixTQUFTOytCQUNFLGdCQUFnQixjQUNkLElBQUksV0FDUCxDQUFDLFlBQVksRUFBRSxXQUFXLEVBQUUsYUFBYSxFQUFFLGVBQWUsRUFBRSxlQUFlLEVBQUUsZ0JBQWdCLENBQUMsWUFDN0Y7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBNkVUIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQ29tcG9uZW50LCBPbkluaXQsIE9uRGVzdHJveSB9IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xuaW1wb3J0IHsgQ29tbW9uTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvY29tbW9uJztcbmltcG9ydCB7IEZvcm1zTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvZm9ybXMnO1xuaW1wb3J0IHsgTWF0SWNvbk1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL21hdGVyaWFsL2ljb24nO1xuaW1wb3J0IHsgTWF0QnV0dG9uTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvbWF0ZXJpYWwvYnV0dG9uJztcbmltcG9ydCB7IE1hdFJpcHBsZU1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL21hdGVyaWFsL2NvcmUnO1xuaW1wb3J0IHsgTWF0VG9vbHRpcE1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL21hdGVyaWFsL3Rvb2x0aXAnO1xuaW1wb3J0IHsgU3Vic2NyaXB0aW9uIH0gZnJvbSAncnhqcyc7XG5pbXBvcnQgeyBNZXNzYWdpbmdTdG9yZVNlcnZpY2UgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9tZXNzYWdpbmctc3RvcmUuc2VydmljZSc7XG5pbXBvcnQgeyBJbmJveEl0ZW0gfSBmcm9tICcuLi8uLi9tb2RlbHMvbWVzc2FnaW5nLm1vZGVscyc7XG5cbkBDb21wb25lbnQoe1xuICBzZWxlY3RvcjogJ2FwcC1pbmJveC1saXN0JyxcbiAgc3RhbmRhbG9uZTogdHJ1ZSxcbiAgaW1wb3J0czogW0NvbW1vbk1vZHVsZSwgRm9ybXNNb2R1bGUsIE1hdEljb25Nb2R1bGUsIE1hdEJ1dHRvbk1vZHVsZSwgTWF0UmlwcGxlTW9kdWxlLCBNYXRUb29sdGlwTW9kdWxlXSxcbiAgdGVtcGxhdGU6IGBcbiAgICA8ZGl2IGNsYXNzPVwiaW5ib3gtY29udGFpbmVyXCI+XG4gICAgICA8ZGl2IGNsYXNzPVwiaW5ib3gtaGVhZGVyXCI+XG4gICAgICAgIDxoMz5NZXNzYWdlczwvaDM+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJoZWFkZXItYWN0aW9uc1wiPlxuICAgICAgICAgIDxidXR0b24gbWF0LWljb24tYnV0dG9uIGNsYXNzPVwiaGRyLWJ0blwiIChjbGljayk9XCJvbk5ld0NvbnZlcnNhdGlvbigpXCIgbWF0VG9vbHRpcD1cIk5ldyBjb252ZXJzYXRpb25cIiBtYXRUb29sdGlwUG9zaXRpb249XCJiZWxvd1wiPlxuICAgICAgICAgICAgPG1hdC1pY29uPmVkaXRfc3F1YXJlPC9tYXQtaWNvbj5cbiAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICA8YnV0dG9uIG1hdC1pY29uLWJ1dHRvbiBjbGFzcz1cImhkci1idG5cIiAoY2xpY2spPVwib25DcmVhdGVHcm91cCgpXCIgbWF0VG9vbHRpcD1cIkNyZWF0ZSBncm91cFwiIG1hdFRvb2x0aXBQb3NpdGlvbj1cImJlbG93XCI+XG4gICAgICAgICAgICA8bWF0LWljb24+Z3JvdXBfYWRkPC9tYXQtaWNvbj5cbiAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cblxuICAgICAgPGRpdiBjbGFzcz1cInNlYXJjaC1iYXJcIj5cbiAgICAgICAgPG1hdC1pY29uIGNsYXNzPVwic2VhcmNoLWljb25cIj5zZWFyY2g8L21hdC1pY29uPlxuICAgICAgICA8aW5wdXRcbiAgICAgICAgICB0eXBlPVwidGV4dFwiXG4gICAgICAgICAgWyhuZ01vZGVsKV09XCJzZWFyY2hRdWVyeVwiXG4gICAgICAgICAgcGxhY2Vob2xkZXI9XCJTZWFyY2ggY29udmVyc2F0aW9ucy4uLlwiXG4gICAgICAgICAgY2xhc3M9XCJzZWFyY2gtaW5wdXRcIlxuICAgICAgICAvPlxuICAgICAgPC9kaXY+XG5cbiAgICAgIDxkaXYgY2xhc3M9XCJjb252ZXJzYXRpb24tbGlzdFwiPlxuICAgICAgICA8ZGl2XG4gICAgICAgICAgKm5nRm9yPVwibGV0IGl0ZW0gb2YgZmlsdGVyZWRJbmJveFwiXG4gICAgICAgICAgY2xhc3M9XCJjb252ZXJzYXRpb24taXRlbVwiXG4gICAgICAgICAgbWF0UmlwcGxlXG4gICAgICAgICAgW2NsYXNzLmhhcy11bnJlYWRdPVwiaXRlbS51bnJlYWRfY291bnQgPiAwXCJcbiAgICAgICAgICAoY2xpY2spPVwib3BlbkNvbnZlcnNhdGlvbihpdGVtKVwiXG4gICAgICAgICAgKGNvbnRleHRtZW51KT1cIm9uQ29udGV4dE1lbnUoJGV2ZW50LCBpdGVtKVwiXG4gICAgICAgID5cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwiYXZhdGFyXCIgW2NsYXNzLmdyb3VwLWF2YXRhcl09XCJpdGVtLmlzX2dyb3VwXCI+XG4gICAgICAgICAgICA8bWF0LWljb24+e3sgaXRlbS5pc19ncm91cCA/ICdncm91cCcgOiAncGVyc29uJyB9fTwvbWF0LWljb24+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cImNvbnZlcnNhdGlvbi1pbmZvXCI+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwiaW5mby10b3BcIj5cbiAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJjb252LW5hbWVcIj57eyBpdGVtLm5hbWUgfHwgJ0RpcmVjdCBNZXNzYWdlJyB9fTwvc3Bhbj5cbiAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJjb252LXRpbWVcIj57eyBmb3JtYXRUaW1lKGl0ZW0ubGFzdF9tZXNzYWdlX2F0KSB9fTwvc3Bhbj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cImluZm8tYm90dG9tXCI+XG4gICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwiY29udi1wcmV2aWV3XCI+e3sgaXRlbS5sYXN0X21lc3NhZ2VfcHJldmlldyB8fCAnTm8gbWVzc2FnZXMgeWV0JyB9fTwvc3Bhbj5cbiAgICAgICAgICAgICAgPHNwYW4gKm5nSWY9XCJpdGVtLnVucmVhZF9jb3VudCA+IDBcIiBjbGFzcz1cInVucmVhZC1iYWRnZVwiPlxuICAgICAgICAgICAgICAgIHt7IGl0ZW0udW5yZWFkX2NvdW50ID4gOTkgPyAnOTkrJyA6IGl0ZW0udW5yZWFkX2NvdW50IH19XG4gICAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8L2Rpdj5cblxuICAgICAgICA8ZGl2ICpuZ0lmPVwiZmlsdGVyZWRJbmJveC5sZW5ndGggPT09IDBcIiBjbGFzcz1cImVtcHR5LXN0YXRlXCI+XG4gICAgICAgICAgPG1hdC1pY29uPmZvcnVtPC9tYXQtaWNvbj5cbiAgICAgICAgICA8cD57eyBzZWFyY2hRdWVyeSA/ICdObyBtYXRjaGluZyBjb252ZXJzYXRpb25zJyA6ICdObyBjb252ZXJzYXRpb25zIHlldCcgfX08L3A+XG4gICAgICAgICAgPGJ1dHRvbiAqbmdJZj1cIiFzZWFyY2hRdWVyeVwiIG1hdC1zdHJva2VkLWJ1dHRvbiBjb2xvcj1cInByaW1hcnlcIiAoY2xpY2spPVwib25OZXdDb252ZXJzYXRpb24oKVwiPlxuICAgICAgICAgICAgU3RhcnQgYSBjb252ZXJzYXRpb25cbiAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cblxuICAgICAgPCEtLSBDb250ZXh0IE1lbnUgLS0+XG4gICAgICA8ZGl2XG4gICAgICAgICpuZ0lmPVwiY29udGV4dE1lbnVcIlxuICAgICAgICBjbGFzcz1cImNvbnRleHQtbWVudVwiXG4gICAgICAgIFtzdHlsZS50b3AucHhdPVwiY29udGV4dE1lbnUueVwiXG4gICAgICAgIFtzdHlsZS5sZWZ0LnB4XT1cImNvbnRleHRNZW51LnhcIlxuICAgICAgPlxuICAgICAgICA8ZGl2IGNsYXNzPVwiY3R4LWl0ZW1cIiAoY2xpY2spPVwiY2xlYXJDaGF0KClcIj5cbiAgICAgICAgICA8bWF0LWljb24+Y2xlYW5pbmdfc2VydmljZXM8L21hdC1pY29uPlxuICAgICAgICAgIDxzcGFuPkNsZWFyIGNvbnZlcnNhdGlvbjwvc3Bhbj5cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJjdHgtaXRlbSBjdHgtZGFuZ2VyXCIgKGNsaWNrKT1cImRlbGV0ZUNoYXQoKVwiPlxuICAgICAgICAgIDxtYXQtaWNvbj5kZWxldGU8L21hdC1pY29uPlxuICAgICAgICAgIDxzcGFuPnt7IGNvbnRleHRNZW51Lml0ZW0uaXNfZ3JvdXAgPyAnRGVsZXRlIGdyb3VwJyA6ICdEZWxldGUgY29udmVyc2F0aW9uJyB9fTwvc3Bhbj5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICAgIDxkaXYgKm5nSWY9XCJjb250ZXh0TWVudVwiIGNsYXNzPVwiY3R4LWJhY2tkcm9wXCIgKGNsaWNrKT1cImNsb3NlQ29udGV4dE1lbnUoKVwiPjwvZGl2PlxuICAgIDwvZGl2PlxuICBgLFxuICBzdHlsZXM6IFtgXG4gICAgLmluYm94LWNvbnRhaW5lciB7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICAgIGhlaWdodDogMTAwJTtcbiAgICAgIGJhY2tncm91bmQ6IHRyYW5zcGFyZW50O1xuICAgIH1cblxuICAgIC5pbmJveC1oZWFkZXIge1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWJldHdlZW47XG4gICAgICBwYWRkaW5nOiAxMnB4IDE2cHg7XG4gICAgICBib3JkZXItYm90dG9tOiAxcHggc29saWQgcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjIpO1xuICAgIH1cblxuICAgIC5pbmJveC1oZWFkZXIgaDMge1xuICAgICAgbWFyZ2luOiAwO1xuICAgICAgZm9udC1zaXplOiAyMHB4O1xuICAgICAgZm9udC13ZWlnaHQ6IDcwMDtcbiAgICAgIGNvbG9yOiAjZmZmO1xuICAgIH1cblxuICAgIC5oZWFkZXItYWN0aW9ucyB7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgZ2FwOiA0cHg7XG4gICAgfVxuXG4gICAgLmhkci1idG4ge1xuICAgICAgYm9yZGVyLXJhZGl1czogNnB4ICFpbXBvcnRhbnQ7XG4gICAgICB0cmFuc2l0aW9uOiBiYWNrZ3JvdW5kIDAuMTVzLCBib3gtc2hhZG93IDAuMTVzO1xuICAgIH1cblxuICAgIC5oZHItYnRuOmhvdmVyIHtcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xNSkgIWltcG9ydGFudDtcbiAgICAgIGJveC1zaGFkb3c6IDAgMnB4IDhweCByZ2JhKDAsIDAsIDAsIDAuMik7XG4gICAgfVxuXG4gICAgLmhkci1idG4gbWF0LWljb24ge1xuICAgICAgZm9udC1zaXplOiAyMHB4O1xuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC45KTtcbiAgICB9XG5cbiAgICAuc2VhcmNoLWJhciB7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIG1hcmdpbjogNHB4IDE2cHggOHB4O1xuICAgICAgcGFkZGluZzogOHB4IDEycHg7XG4gICAgICBiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudDtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDEwcHg7XG4gICAgfVxuXG4gICAgLnNlYXJjaC1pY29uIHtcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNyk7XG4gICAgICBmb250LXNpemU6IDE4cHg7XG4gICAgICB3aWR0aDogMjBweDtcbiAgICAgIGhlaWdodDogMjBweDtcbiAgICAgIG1hcmdpbi1yaWdodDogOHB4O1xuICAgIH1cblxuICAgIC5zZWFyY2gtaW5wdXQge1xuICAgICAgZmxleDogMTtcbiAgICAgIGJvcmRlcjogbm9uZTtcbiAgICAgIG91dGxpbmU6IG5vbmU7XG4gICAgICBiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudDtcbiAgICAgIGZvbnQtc2l6ZTogMTRweDtcbiAgICAgIGNvbG9yOiAjZmZmO1xuICAgIH1cblxuICAgIC5zZWFyY2gtaW5wdXQ6OnBsYWNlaG9sZGVyIHtcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNik7XG4gICAgfVxuXG4gICAgLmNvbnZlcnNhdGlvbi1saXN0IHtcbiAgICAgIGZsZXg6IDE7XG4gICAgICBvdmVyZmxvdy15OiBhdXRvO1xuICAgIH1cblxuICAgIC5jb252ZXJzYXRpb24taXRlbSB7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIHBhZGRpbmc6IDEycHggMTZweDtcbiAgICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgICAgIHRyYW5zaXRpb246IGJhY2tncm91bmQgMC4xNXM7XG4gICAgICBnYXA6IDEycHg7XG4gICAgfVxuXG4gICAgLmNvbnZlcnNhdGlvbi1pdGVtOmhvdmVyIHtcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xKTtcbiAgICB9XG5cbiAgICAuY29udmVyc2F0aW9uLWl0ZW0uaGFzLXVucmVhZCB7XG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMTUpO1xuICAgIH1cblxuICAgIC5hdmF0YXIge1xuICAgICAgd2lkdGg6IDQ4cHg7XG4gICAgICBoZWlnaHQ6IDQ4cHg7XG4gICAgICBib3JkZXItcmFkaXVzOiA1MCU7XG4gICAgICBiYWNrZ3JvdW5kOiBsaW5lYXItZ3JhZGllbnQoMTM1ZGVnLCAjZGJlYWZlIDAlLCAjOTNjNWZkIDEwMCUpO1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgIGZsZXgtc2hyaW5rOiAwO1xuICAgIH1cblxuICAgIC5hdmF0YXIgbWF0LWljb24ge1xuICAgICAgY29sb3I6ICMxRjRCRDg7XG4gICAgICBmb250LXNpemU6IDI0cHg7XG4gICAgfVxuXG4gICAgLmdyb3VwLWF2YXRhciB7XG4gICAgICBiYWNrZ3JvdW5kOiBsaW5lYXItZ3JhZGllbnQoMTM1ZGVnLCAjZGJlYWZlIDAlLCAjNjBhNWZhIDEwMCUpO1xuICAgIH1cblxuICAgIC5ncm91cC1hdmF0YXIgbWF0LWljb24ge1xuICAgICAgY29sb3I6ICMxNzMzOTY7XG4gICAgfVxuXG4gICAgLmNvbnZlcnNhdGlvbi1pbmZvIHtcbiAgICAgIGZsZXg6IDE7XG4gICAgICBtaW4td2lkdGg6IDA7XG4gICAgfVxuXG4gICAgLmluZm8tdG9wIHtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWJldHdlZW47XG4gICAgICBhbGlnbi1pdGVtczogYmFzZWxpbmU7XG4gICAgICBtYXJnaW4tYm90dG9tOiAycHg7XG4gICAgfVxuXG4gICAgLmNvbnYtbmFtZSB7XG4gICAgICBmb250LXdlaWdodDogNjAwO1xuICAgICAgZm9udC1zaXplOiAxNHB4O1xuICAgICAgY29sb3I6ICNmZmY7XG4gICAgICB3aGl0ZS1zcGFjZTogbm93cmFwO1xuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICAgIHRleHQtb3ZlcmZsb3c6IGVsbGlwc2lzO1xuICAgICAgbWF4LXdpZHRoOiAyMDBweDtcbiAgICB9XG5cbiAgICAuY29udi10aW1lIHtcbiAgICAgIGZvbnQtc2l6ZTogMTFweDtcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNyk7XG4gICAgICBmbGV4LXNocmluazogMDtcbiAgICAgIG1hcmdpbi1sZWZ0OiA4cHg7XG4gICAgfVxuXG4gICAgLmluZm8tYm90dG9tIHtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWJldHdlZW47XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgIH1cblxuICAgIC5jb252LXByZXZpZXcge1xuICAgICAgZm9udC1zaXplOiAxM3B4O1xuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC43KTtcbiAgICAgIHdoaXRlLXNwYWNlOiBub3dyYXA7XG4gICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgdGV4dC1vdmVyZmxvdzogZWxsaXBzaXM7XG4gICAgICBtYXgtd2lkdGg6IDIyMHB4O1xuICAgIH1cblxuICAgIC5oYXMtdW5yZWFkIC5jb252LW5hbWUge1xuICAgICAgY29sb3I6ICNmZmY7XG4gICAgfVxuXG4gICAgLmhhcy11bnJlYWQgLmNvbnYtcHJldmlldyB7XG4gICAgICBjb2xvcjogIzM3NDE1MTtcbiAgICAgIGZvbnQtd2VpZ2h0OiA1MDA7XG4gICAgfVxuXG4gICAgLnVucmVhZC1iYWRnZSB7XG4gICAgICBiYWNrZ3JvdW5kOiAjMUY0QkQ4O1xuICAgICAgY29sb3I6ICNmZmY7XG4gICAgICBib3JkZXItcmFkaXVzOiAxMHB4O1xuICAgICAgbWluLXdpZHRoOiAyMHB4O1xuICAgICAgaGVpZ2h0OiAyMHB4O1xuICAgICAgZm9udC1zaXplOiAxMXB4O1xuICAgICAgZm9udC13ZWlnaHQ6IDYwMDtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgICBwYWRkaW5nOiAwIDZweDtcbiAgICAgIGZsZXgtc2hyaW5rOiAwO1xuICAgIH1cblxuICAgIC5lbXB0eS1zdGF0ZSB7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgIHBhZGRpbmc6IDQ4cHggMjRweDtcbiAgICAgIGNvbG9yOiAjOWNhM2FmO1xuICAgIH1cblxuICAgIC5lbXB0eS1zdGF0ZSBtYXQtaWNvbiB7XG4gICAgICBmb250LXNpemU6IDQ4cHg7XG4gICAgICB3aWR0aDogNDhweDtcbiAgICAgIGhlaWdodDogNDhweDtcbiAgICAgIG1hcmdpbi1ib3R0b206IDEycHg7XG4gICAgfVxuXG4gICAgLmVtcHR5LXN0YXRlIHAge1xuICAgICAgbWFyZ2luOiAwIDAgMTZweDtcbiAgICAgIGZvbnQtc2l6ZTogMTRweDtcbiAgICB9XG5cbiAgICAuY29udGV4dC1tZW51IHtcbiAgICAgIHBvc2l0aW9uOiBmaXhlZDtcbiAgICAgIHotaW5kZXg6IDEwMDAxO1xuICAgICAgYmFja2dyb3VuZDogIzFlMWUyZTtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDhweDtcbiAgICAgIHBhZGRpbmc6IDRweCAwO1xuICAgICAgYm94LXNoYWRvdzogMCA4cHggMjRweCByZ2JhKDAsIDAsIDAsIDAuMyk7XG4gICAgICBtaW4td2lkdGg6IDIwMHB4O1xuICAgIH1cblxuICAgIC5jdHgtaXRlbSB7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGdhcDogMTBweDtcbiAgICAgIHBhZGRpbmc6IDEwcHggMTZweDtcbiAgICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuOSk7XG4gICAgICBmb250LXNpemU6IDEzcHg7XG4gICAgICB0cmFuc2l0aW9uOiBiYWNrZ3JvdW5kIDAuMTVzO1xuICAgIH1cblxuICAgIC5jdHgtaXRlbTpob3ZlciB7XG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMSk7XG4gICAgfVxuXG4gICAgLmN0eC1pdGVtIG1hdC1pY29uIHtcbiAgICAgIGZvbnQtc2l6ZTogMThweDtcbiAgICAgIHdpZHRoOiAxOHB4O1xuICAgICAgaGVpZ2h0OiAxOHB4O1xuICAgIH1cblxuICAgIC5jdHgtZGFuZ2VyIHtcbiAgICAgIGNvbG9yOiAjZjg3MTcxO1xuICAgIH1cblxuICAgIC5jdHgtZGFuZ2VyOmhvdmVyIHtcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjQ4LCAxMTMsIDExMywgMC4xNSk7XG4gICAgfVxuXG4gICAgLmN0eC1iYWNrZHJvcCB7XG4gICAgICBwb3NpdGlvbjogZml4ZWQ7XG4gICAgICBpbnNldDogMDtcbiAgICAgIHotaW5kZXg6IDEwMDAwO1xuICAgIH1cbiAgYF0sXG59KVxuZXhwb3J0IGNsYXNzIEluYm94TGlzdENvbXBvbmVudCBpbXBsZW1lbnRzIE9uSW5pdCwgT25EZXN0cm95IHtcbiAgaW5ib3g6IEluYm94SXRlbVtdID0gW107XG4gIHNlYXJjaFF1ZXJ5ID0gJyc7XG4gIGNvbnRleHRNZW51OiB7IHg6IG51bWJlcjsgeTogbnVtYmVyOyBpdGVtOiBJbmJveEl0ZW0gfSB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIHN1YiE6IFN1YnNjcmlwdGlvbjtcblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHN0b3JlOiBNZXNzYWdpbmdTdG9yZVNlcnZpY2UpIHt9XG5cbiAgbmdPbkluaXQoKTogdm9pZCB7XG4gICAgdGhpcy5zdWIgPSB0aGlzLnN0b3JlLmluYm94LnN1YnNjcmliZSgoaXRlbXMpID0+ICh0aGlzLmluYm94ID0gaXRlbXMpKTtcbiAgfVxuXG4gIG5nT25EZXN0cm95KCk6IHZvaWQge1xuICAgIHRoaXMuc3ViPy51bnN1YnNjcmliZSgpO1xuICB9XG5cbiAgZ2V0IGZpbHRlcmVkSW5ib3goKTogSW5ib3hJdGVtW10ge1xuICAgIGlmICghdGhpcy5zZWFyY2hRdWVyeS50cmltKCkpIHJldHVybiB0aGlzLmluYm94O1xuICAgIGNvbnN0IHEgPSB0aGlzLnNlYXJjaFF1ZXJ5LnRvTG93ZXJDYXNlKCk7XG4gICAgcmV0dXJuIHRoaXMuaW5ib3guZmlsdGVyKFxuICAgICAgKGl0ZW0pID0+XG4gICAgICAgIChpdGVtLm5hbWUgfHwgJycpLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMocSkgfHxcbiAgICAgICAgKGl0ZW0ubGFzdF9tZXNzYWdlX3ByZXZpZXcgfHwgJycpLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMocSlcbiAgICApO1xuICB9XG5cbiAgb3BlbkNvbnZlcnNhdGlvbihpdGVtOiBJbmJveEl0ZW0pOiB2b2lkIHtcbiAgICB0aGlzLnN0b3JlLm9wZW5Db252ZXJzYXRpb24oaXRlbS5jb252ZXJzYXRpb25faWQsIGl0ZW0ubmFtZSB8fCAnQ2hhdCcsIGl0ZW0uaXNfZ3JvdXApO1xuICB9XG5cbiAgb25OZXdDb252ZXJzYXRpb24oKTogdm9pZCB7XG4gICAgdGhpcy5zdG9yZS5zZXRWaWV3KCduZXctY29udmVyc2F0aW9uJyk7XG4gIH1cblxuICBvbkNyZWF0ZUdyb3VwKCk6IHZvaWQge1xuICAgIHRoaXMuc3RvcmUuc2V0VmlldygnZ3JvdXAtbWFuYWdlcicpO1xuICB9XG5cbiAgb25Db250ZXh0TWVudShldmVudDogTW91c2VFdmVudCwgaXRlbTogSW5ib3hJdGVtKTogdm9pZCB7XG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICB0aGlzLmNvbnRleHRNZW51ID0geyB4OiBldmVudC5jbGllbnRYLCB5OiBldmVudC5jbGllbnRZLCBpdGVtIH07XG4gIH1cblxuICBjbG9zZUNvbnRleHRNZW51KCk6IHZvaWQge1xuICAgIHRoaXMuY29udGV4dE1lbnUgPSBudWxsO1xuICB9XG5cbiAgY2xlYXJDaGF0KCk6IHZvaWQge1xuICAgIGlmICghdGhpcy5jb250ZXh0TWVudSkgcmV0dXJuO1xuICAgIGNvbnN0IGlkID0gdGhpcy5jb250ZXh0TWVudS5pdGVtLmNvbnZlcnNhdGlvbl9pZDtcbiAgICB0aGlzLnN0b3JlLmNsZWFyQ29udmVyc2F0aW9uKGlkKTtcbiAgICB0aGlzLmNvbnRleHRNZW51ID0gbnVsbDtcbiAgfVxuXG4gIGRlbGV0ZUNoYXQoKTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLmNvbnRleHRNZW51KSByZXR1cm47XG4gICAgY29uc3QgaXRlbSA9IHRoaXMuY29udGV4dE1lbnUuaXRlbTtcbiAgICBpZiAoaXRlbS5pc19ncm91cCkge1xuICAgICAgdGhpcy5zdG9yZS5kZWxldGVHcm91cChpdGVtLmNvbnZlcnNhdGlvbl9pZCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuc3RvcmUuZGVsZXRlQ29udmVyc2F0aW9uKGl0ZW0uY29udmVyc2F0aW9uX2lkKTtcbiAgICB9XG4gICAgdGhpcy5jb250ZXh0TWVudSA9IG51bGw7XG4gIH1cblxuICBmb3JtYXRUaW1lKGRhdGVTdHI6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgaWYgKCFkYXRlU3RyKSByZXR1cm4gJyc7XG4gICAgY29uc3QgZGF0ZSA9IG5ldyBEYXRlKGRhdGVTdHIpO1xuICAgIGNvbnN0IG5vdyA9IG5ldyBEYXRlKCk7XG4gICAgY29uc3QgZGlmZk1zID0gbm93LmdldFRpbWUoKSAtIGRhdGUuZ2V0VGltZSgpO1xuICAgIGNvbnN0IGRpZmZNaW5zID0gTWF0aC5mbG9vcihkaWZmTXMgLyA2MDAwMCk7XG4gICAgY29uc3QgZGlmZkhvdXJzID0gTWF0aC5mbG9vcihkaWZmTXMgLyAzNjAwMDAwKTtcbiAgICBjb25zdCBkaWZmRGF5cyA9IE1hdGguZmxvb3IoZGlmZk1zIC8gODY0MDAwMDApO1xuXG4gICAgaWYgKGRpZmZNaW5zIDwgMSkgcmV0dXJuICdub3cnO1xuICAgIGlmIChkaWZmTWlucyA8IDYwKSByZXR1cm4gYCR7ZGlmZk1pbnN9bWA7XG4gICAgaWYgKGRpZmZIb3VycyA8IDI0KSByZXR1cm4gYCR7ZGlmZkhvdXJzfWhgO1xuICAgIGlmIChkaWZmRGF5cyA8IDcpIHJldHVybiBgJHtkaWZmRGF5c31kYDtcblxuICAgIHJldHVybiBkYXRlLnRvTG9jYWxlRGF0ZVN0cmluZygnZW4tR0InLCB7IGRheTogJ251bWVyaWMnLCBtb250aDogJ3Nob3J0JyB9KTtcbiAgfVxufVxuIl19