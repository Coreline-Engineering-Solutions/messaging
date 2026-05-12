import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import * as i0 from "@angular/core";
import * as i1 from "../../services/messaging-api.service";
import * as i2 from "../../services/auth.service";
import * as i3 from "@angular/common";
import * as i4 from "@angular/forms";
import * as i5 from "@angular/material/icon";
import * as i6 from "@angular/material/button";
import * as i7 from "@angular/material/progress-spinner";
export class ThreadViewerComponent {
    api;
    auth;
    parentMessage;
    conversationId;
    close = new EventEmitter();
    replies = [];
    replyText = '';
    loading = false;
    isFollowing = true;
    constructor(api, auth) {
        this.api = api;
        this.auth = auth;
    }
    ngOnInit() {
        this.loadThread();
    }
    loadThread() {
        if (!this.parentMessage)
            return;
        this.loading = true;
        this.api.getThreadMessages(this.parentMessage.message_id, this.auth.contactId).subscribe({
            next: (messages) => {
                this.replies = messages;
                this.loading = false;
            },
            error: () => {
                this.loading = false;
            }
        });
    }
    sendReply() {
        if (!this.replyText.trim())
            return;
        this.api.sendThreadReply(this.parentMessage.message_id, this.auth.contactId, this.replyText).subscribe({
            next: () => {
                this.replyText = '';
                this.loadThread();
            },
            error: () => { }
        });
    }
    toggleFollow() {
        this.isFollowing = !this.isFollowing;
    }
    onClose() {
        this.close.emit();
    }
    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        if (hours < 24) {
            return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        }
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: ThreadViewerComponent, deps: [{ token: i1.MessagingApiService }, { token: i2.AuthService }], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "17.3.12", type: ThreadViewerComponent, isStandalone: true, selector: "app-thread-viewer", inputs: { parentMessage: "parentMessage", conversationId: "conversationId" }, outputs: { close: "close" }, ngImport: i0, template: `
    <div class="thread-viewer">
      <div class="thread-header">
        <button mat-icon-button (click)="onClose()">
          <mat-icon>close</mat-icon>
        </button>
        <h3>Thread</h3>
        <button mat-icon-button (click)="toggleFollow()">
          <mat-icon>{{ isFollowing ? 'notifications_active' : 'notifications_off' }}</mat-icon>
        </button>
      </div>

      <div class="parent-message" *ngIf="parentMessage">
        <div class="message-header">
          <strong>{{ parentMessage.sender_name || 'Unknown' }}</strong>
          <span class="timestamp">{{ formatTime(parentMessage.created_at) }}</span>
        </div>
        <div class="message-content">{{ parentMessage.content }}</div>
        <div class="reply-count">{{ replies.length }} {{ replies.length === 1 ? 'reply' : 'replies' }}</div>
      </div>

      <div class="thread-messages" *ngIf="!loading">
        <div *ngFor="let msg of replies" class="thread-message">
          <div class="message-header">
            <strong>{{ msg.sender_name || 'Unknown' }}</strong>
            <span class="timestamp">{{ formatTime(msg.created_at) }}</span>
          </div>
          <div class="message-content">{{ msg.content }}</div>
        </div>
      </div>

      <div class="loading" *ngIf="loading">
        <mat-spinner diameter="30"></mat-spinner>
      </div>

      <div class="thread-input">
        <input 
          type="text" 
          [(ngModel)]="replyText" 
          (keyup.enter)="sendReply()"
          placeholder="Reply in thread..."
        />
        <button mat-icon-button (click)="sendReply()" [disabled]="!replyText.trim()">
          <mat-icon>send</mat-icon>
        </button>
      </div>
    </div>
  `, isInline: true, styles: [".thread-viewer{display:flex;flex-direction:column;height:100%;background:#fff}.thread-header{display:flex;align-items:center;padding:12px;border-bottom:1px solid #e0e0e0;gap:8px}.thread-header h3{flex:1;margin:0;font-size:16px;font-weight:500}.parent-message{padding:16px;background:#f5f5f5;border-bottom:2px solid #1976d2}.message-header{display:flex;justify-content:space-between;margin-bottom:4px;font-size:14px}.timestamp{color:#666;font-size:12px}.message-content{margin:8px 0;line-height:1.4}.reply-count{font-size:12px;color:#1976d2;margin-top:8px}.thread-messages{flex:1;overflow-y:auto;padding:16px}.thread-message{margin-bottom:16px;padding:12px;background:#fafafa;border-radius:8px}.loading{display:flex;justify-content:center;align-items:center;flex:1}.thread-input{display:flex;padding:12px;border-top:1px solid #e0e0e0;gap:8px}.thread-input input{flex:1;padding:8px 12px;border:1px solid #ddd;border-radius:20px;outline:none}.thread-input input:focus{border-color:#1976d2}\n"], dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i3.NgForOf, selector: "[ngFor][ngForOf]", inputs: ["ngForOf", "ngForTrackBy", "ngForTemplate"] }, { kind: "directive", type: i3.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "ngmodule", type: FormsModule }, { kind: "directive", type: i4.DefaultValueAccessor, selector: "input:not([type=checkbox])[formControlName],textarea[formControlName],input:not([type=checkbox])[formControl],textarea[formControl],input:not([type=checkbox])[ngModel],textarea[ngModel],[ngDefaultControl]" }, { kind: "directive", type: i4.NgControlStatus, selector: "[formControlName],[ngModel],[formControl]" }, { kind: "directive", type: i4.NgModel, selector: "[ngModel]:not([formControlName]):not([formControl])", inputs: ["name", "disabled", "ngModel", "ngModelOptions"], outputs: ["ngModelChange"], exportAs: ["ngModel"] }, { kind: "ngmodule", type: MatIconModule }, { kind: "component", type: i5.MatIcon, selector: "mat-icon", inputs: ["color", "inline", "svgIcon", "fontSet", "fontIcon"], exportAs: ["matIcon"] }, { kind: "ngmodule", type: MatButtonModule }, { kind: "component", type: i6.MatIconButton, selector: "button[mat-icon-button]", exportAs: ["matButton"] }, { kind: "ngmodule", type: MatProgressSpinnerModule }, { kind: "component", type: i7.MatProgressSpinner, selector: "mat-progress-spinner, mat-spinner", inputs: ["color", "mode", "value", "diameter", "strokeWidth"], exportAs: ["matProgressSpinner"] }] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: ThreadViewerComponent, decorators: [{
            type: Component,
            args: [{ selector: 'app-thread-viewer', standalone: true, imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatProgressSpinnerModule], template: `
    <div class="thread-viewer">
      <div class="thread-header">
        <button mat-icon-button (click)="onClose()">
          <mat-icon>close</mat-icon>
        </button>
        <h3>Thread</h3>
        <button mat-icon-button (click)="toggleFollow()">
          <mat-icon>{{ isFollowing ? 'notifications_active' : 'notifications_off' }}</mat-icon>
        </button>
      </div>

      <div class="parent-message" *ngIf="parentMessage">
        <div class="message-header">
          <strong>{{ parentMessage.sender_name || 'Unknown' }}</strong>
          <span class="timestamp">{{ formatTime(parentMessage.created_at) }}</span>
        </div>
        <div class="message-content">{{ parentMessage.content }}</div>
        <div class="reply-count">{{ replies.length }} {{ replies.length === 1 ? 'reply' : 'replies' }}</div>
      </div>

      <div class="thread-messages" *ngIf="!loading">
        <div *ngFor="let msg of replies" class="thread-message">
          <div class="message-header">
            <strong>{{ msg.sender_name || 'Unknown' }}</strong>
            <span class="timestamp">{{ formatTime(msg.created_at) }}</span>
          </div>
          <div class="message-content">{{ msg.content }}</div>
        </div>
      </div>

      <div class="loading" *ngIf="loading">
        <mat-spinner diameter="30"></mat-spinner>
      </div>

      <div class="thread-input">
        <input 
          type="text" 
          [(ngModel)]="replyText" 
          (keyup.enter)="sendReply()"
          placeholder="Reply in thread..."
        />
        <button mat-icon-button (click)="sendReply()" [disabled]="!replyText.trim()">
          <mat-icon>send</mat-icon>
        </button>
      </div>
    </div>
  `, styles: [".thread-viewer{display:flex;flex-direction:column;height:100%;background:#fff}.thread-header{display:flex;align-items:center;padding:12px;border-bottom:1px solid #e0e0e0;gap:8px}.thread-header h3{flex:1;margin:0;font-size:16px;font-weight:500}.parent-message{padding:16px;background:#f5f5f5;border-bottom:2px solid #1976d2}.message-header{display:flex;justify-content:space-between;margin-bottom:4px;font-size:14px}.timestamp{color:#666;font-size:12px}.message-content{margin:8px 0;line-height:1.4}.reply-count{font-size:12px;color:#1976d2;margin-top:8px}.thread-messages{flex:1;overflow-y:auto;padding:16px}.thread-message{margin-bottom:16px;padding:12px;background:#fafafa;border-radius:8px}.loading{display:flex;justify-content:center;align-items:center;flex:1}.thread-input{display:flex;padding:12px;border-top:1px solid #e0e0e0;gap:8px}.thread-input input{flex:1;padding:8px 12px;border:1px solid #ddd;border-radius:20px;outline:none}.thread-input input:focus{border-color:#1976d2}\n"] }]
        }], ctorParameters: () => [{ type: i1.MessagingApiService }, { type: i2.AuthService }], propDecorators: { parentMessage: [{
                type: Input
            }], conversationId: [{
                type: Input
            }], close: [{
                type: Output
            }] } });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGhyZWFkLXZpZXdlci5jb21wb25lbnQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvbGliL2NvbXBvbmVudHMvdGhyZWFkLXZpZXdlci90aHJlYWQtdmlld2VyLmNvbXBvbmVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsU0FBUyxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsWUFBWSxFQUFVLE1BQU0sZUFBZSxDQUFDO0FBQy9FLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUMvQyxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sZ0JBQWdCLENBQUM7QUFDN0MsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLHdCQUF3QixDQUFDO0FBQ3ZELE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUMzRCxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQzs7Ozs7Ozs7O0FBcUo5RSxNQUFNLE9BQU8scUJBQXFCO0lBV3RCO0lBQ0E7SUFYRCxhQUFhLENBQVc7SUFDeEIsY0FBYyxDQUFVO0lBQ3ZCLEtBQUssR0FBRyxJQUFJLFlBQVksRUFBUSxDQUFDO0lBRTNDLE9BQU8sR0FBYyxFQUFFLENBQUM7SUFDeEIsU0FBUyxHQUFHLEVBQUUsQ0FBQztJQUNmLE9BQU8sR0FBRyxLQUFLLENBQUM7SUFDaEIsV0FBVyxHQUFHLElBQUksQ0FBQztJQUVuQixZQUNVLEdBQXdCLEVBQ3hCLElBQWlCO1FBRGpCLFFBQUcsR0FBSCxHQUFHLENBQXFCO1FBQ3hCLFNBQUksR0FBSixJQUFJLENBQWE7SUFDeEIsQ0FBQztJQUVKLFFBQVE7UUFDTixJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7SUFDcEIsQ0FBQztJQUVELFVBQVU7UUFDUixJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWE7WUFBRSxPQUFPO1FBRWhDLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFB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dCwgT3V0cHV0LCBFdmVudEVtaXR0ZXIsIE9uSW5pdCB9IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xuaW1wb3J0IHsgQ29tbW9uTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvY29tbW9uJztcbmltcG9ydCB7IEZvcm1zTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvZm9ybXMnO1xuaW1wb3J0IHsgTWF0SWNvbk1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL21hdGVyaWFsL2ljb24nO1xuaW1wb3J0IHsgTWF0QnV0dG9uTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvbWF0ZXJpYWwvYnV0dG9uJztcbmltcG9ydCB7IE1hdFByb2dyZXNzU3Bpbm5lck1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL21hdGVyaWFsL3Byb2dyZXNzLXNwaW5uZXInO1xuaW1wb3J0IHsgTWVzc2FnZSB9IGZyb20gJy4uLy4uL21vZGVscy9tZXNzYWdpbmcubW9kZWxzJztcbmltcG9ydCB7IE1lc3NhZ2luZ0FwaVNlcnZpY2UgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9tZXNzYWdpbmctYXBpLnNlcnZpY2UnO1xuaW1wb3J0IHsgQXV0aFNlcnZpY2UgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9hdXRoLnNlcnZpY2UnO1xuXG5AQ29tcG9uZW50KHtcbiAgc2VsZWN0b3I6ICdhcHAtdGhyZWFkLXZpZXdlcicsXG4gIHN0YW5kYWxvbmU6IHRydWUsXG4gIGltcG9ydHM6IFtDb21tb25Nb2R1bGUsIEZvcm1zTW9kdWxlLCBNYXRJY29uTW9kdWxlLCBNYXRCdXR0b25Nb2R1bGUsIE1hdFByb2dyZXNzU3Bpbm5lck1vZHVsZV0sXG4gIHRlbXBsYXRlOiBgXG4gICAgPGRpdiBjbGFzcz1cInRocmVhZC12aWV3ZXJcIj5cbiAgICAgIDxkaXYgY2xhc3M9XCJ0aHJlYWQtaGVhZGVyXCI+XG4gICAgICAgIDxidXR0b24gbWF0LWljb24tYnV0dG9uIChjbGljayk9XCJvbkNsb3NlKClcIj5cbiAgICAgICAgICA8bWF0LWljb24+Y2xvc2U8L21hdC1pY29uPlxuICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgPGgzPlRocmVhZDwvaDM+XG4gICAgICAgIDxidXR0b24gbWF0LWljb24tYnV0dG9uIChjbGljayk9XCJ0b2dnbGVGb2xsb3coKVwiPlxuICAgICAgICAgIDxtYXQtaWNvbj57eyBpc0ZvbGxvd2luZyA/ICdub3RpZmljYXRpb25zX2FjdGl2ZScgOiAnbm90aWZpY2F0aW9uc19vZmYnIH19PC9tYXQtaWNvbj5cbiAgICAgICAgPC9idXR0b24+XG4gICAgICA8L2Rpdj5cblxuICAgICAgPGRpdiBjbGFzcz1cInBhcmVudC1tZXNzYWdlXCIgKm5nSWY9XCJwYXJlbnRNZXNzYWdlXCI+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJtZXNzYWdlLWhlYWRlclwiPlxuICAgICAgICAgIDxzdHJvbmc+e3sgcGFyZW50TWVzc2FnZS5zZW5kZXJfbmFtZSB8fCAnVW5rbm93bicgfX08L3N0cm9uZz5cbiAgICAgICAgICA8c3BhbiBjbGFzcz1cInRpbWVzdGFtcFwiPnt7IGZvcm1hdFRpbWUocGFyZW50TWVzc2FnZS5jcmVhdGVkX2F0KSB9fTwvc3Bhbj5cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJtZXNzYWdlLWNvbnRlbnRcIj57eyBwYXJlbnRNZXNzYWdlLmNvbnRlbnQgfX08L2Rpdj5cbiAgICAgICAgPGRpdiBjbGFzcz1cInJlcGx5LWNvdW50XCI+e3sgcmVwbGllcy5sZW5ndGggfX0ge3sgcmVwbGllcy5sZW5ndGggPT09IDEgPyAncmVwbHknIDogJ3JlcGxpZXMnIH19PC9kaXY+XG4gICAgICA8L2Rpdj5cblxuICAgICAgPGRpdiBjbGFzcz1cInRocmVhZC1tZXNzYWdlc1wiICpuZ0lmPVwiIWxvYWRpbmdcIj5cbiAgICAgICAgPGRpdiAqbmdGb3I9XCJsZXQgbXNnIG9mIHJlcGxpZXNcIiBjbGFzcz1cInRocmVhZC1tZXNzYWdlXCI+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cIm1lc3NhZ2UtaGVhZGVyXCI+XG4gICAgICAgICAgICA8c3Ryb25nPnt7IG1zZy5zZW5kZXJfbmFtZSB8fCAnVW5rbm93bicgfX08L3N0cm9uZz5cbiAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwidGltZXN0YW1wXCI+e3sgZm9ybWF0VGltZShtc2cuY3JlYXRlZF9hdCkgfX08L3NwYW4+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cIm1lc3NhZ2UtY29udGVudFwiPnt7IG1zZy5jb250ZW50IH19PC9kaXY+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG5cbiAgICAgIDxkaXYgY2xhc3M9XCJsb2FkaW5nXCIgKm5nSWY9XCJsb2FkaW5nXCI+XG4gICAgICAgIDxtYXQtc3Bpbm5lciBkaWFtZXRlcj1cIjMwXCI+PC9tYXQtc3Bpbm5lcj5cbiAgICAgIDwvZGl2PlxuXG4gICAgICA8ZGl2IGNsYXNzPVwidGhyZWFkLWlucHV0XCI+XG4gICAgICAgIDxpbnB1dCBcbiAgICAgICAgICB0eXBlPVwidGV4dFwiIFxuICAgICAgICAgIFsobmdNb2RlbCldPVwicmVwbHlUZXh0XCIgXG4gICAgICAgICAgKGtleXVwLmVudGVyKT1cInNlbmRSZXBseSgpXCJcbiAgICAgICAgICBwbGFjZWhvbGRlcj1cIlJlcGx5IGluIHRocmVhZC4uLlwiXG4gICAgICAgIC8+XG4gICAgICAgIDxidXR0b24gbWF0LWljb24tYnV0dG9uIChjbGljayk9XCJzZW5kUmVwbHkoKVwiIFtkaXNhYmxlZF09XCIhcmVwbHlUZXh0LnRyaW0oKVwiPlxuICAgICAgICAgIDxtYXQtaWNvbj5zZW5kPC9tYXQtaWNvbj5cbiAgICAgICAgPC9idXR0b24+XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5cbiAgYCxcbiAgc3R5bGVzOiBbYFxuICAgIC50aHJlYWQtdmlld2VyIHtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgaGVpZ2h0OiAxMDAlO1xuICAgICAgYmFja2dyb3VuZDogd2hpdGU7XG4gICAgfVxuXG4gICAgLnRocmVhZC1oZWFkZXIge1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBwYWRkaW5nOiAxMnB4O1xuICAgICAgYm9yZGVyLWJvdHRvbTogMXB4IHNvbGlkICNlMGUwZTA7XG4gICAgICBnYXA6IDhweDtcbiAgICB9XG5cbiAgICAudGhyZWFkLWhlYWRlciBoMyB7XG4gICAgICBmbGV4OiAxO1xuICAgICAgbWFyZ2luOiAwO1xuICAgICAgZm9udC1zaXplOiAxNnB4O1xuICAgICAgZm9udC13ZWlnaHQ6IDUwMDtcbiAgICB9XG5cbiAgICAucGFyZW50LW1lc3NhZ2Uge1xuICAgICAgcGFkZGluZzogMTZweDtcbiAgICAgIGJhY2tncm91bmQ6ICNmNWY1ZjU7XG4gICAgICBib3JkZXItYm90dG9tOiAycHggc29saWQgIzE5NzZkMjtcbiAgICB9XG5cbiAgICAubWVzc2FnZS1oZWFkZXIge1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGp1c3RpZnktY29udGVudDogc3BhY2UtYmV0d2VlbjtcbiAgICAgIG1hcmdpbi1ib3R0b206IDRweDtcbiAgICAgIGZvbnQtc2l6ZTogMTRweDtcbiAgICB9XG5cbiAgICAudGltZXN0YW1wIHtcbiAgICAgIGNvbG9yOiAjNjY2O1xuICAgICAgZm9udC1zaXplOiAxMnB4O1xuICAgIH1cblxuICAgIC5tZXNzYWdlLWNvbnRlbnQge1xuICAgICAgbWFyZ2luOiA4cHggMDtcbiAgICAgIGxpbmUtaGVpZ2h0OiAxLjQ7XG4gICAgfVxuXG4gICAgLnJlcGx5LWNvdW50IHtcbiAgICAgIGZvbnQtc2l6ZTogMTJweDtcbiAgICAgIGNvbG9yOiAjMTk3NmQyO1xuICAgICAgbWFyZ2luLXRvcDogOHB4O1xuICAgIH1cblxuICAgIC50aHJlYWQtbWVzc2FnZXMge1xuICAgICAgZmxleDogMTtcbiAgICAgIG92ZXJmbG93LXk6IGF1dG87XG4gICAgICBwYWRkaW5nOiAxNnB4O1xuICAgIH1cblxuICAgIC50aHJlYWQtbWVzc2FnZSB7XG4gICAgICBtYXJnaW4tYm90dG9tOiAxNnB4O1xuICAgICAgcGFkZGluZzogMTJweDtcbiAgICAgIGJhY2tncm91bmQ6ICNmYWZhZmE7XG4gICAgICBib3JkZXItcmFkaXVzOiA4cHg7XG4gICAgfVxuXG4gICAgLmxvYWRpbmcge1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGZsZXg6IDE7XG4gICAgfVxuXG4gICAgLnRocmVhZC1pbnB1dCB7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgcGFkZGluZzogMTJweDtcbiAgICAgIGJvcmRlci10b3A6IDFweCBzb2xpZCAjZTBlMGUwO1xuICAgICAgZ2FwOiA4cHg7XG4gICAgfVxuXG4gICAgLnRocmVhZC1pbnB1dCBpbnB1dCB7XG4gICAgICBmbGV4OiAxO1xuICAgICAgcGFkZGluZzogOHB4IDEycHg7XG4gICAgICBib3JkZXI6IDFweCBzb2xpZCAjZGRkO1xuICAgICAgYm9yZGVyLXJhZGl1czogMjBweDtcbiAgICAgIG91dGxpbmU6IG5vbmU7XG4gICAgfVxuXG4gICAgLnRocmVhZC1pbnB1dCBpbnB1dDpmb2N1cyB7XG4gICAgICBib3JkZXItY29sb3I6ICMxOTc2ZDI7XG4gICAgfVxuICBgXVxufSlcbmV4cG9ydCBjbGFzcyBUaHJlYWRWaWV3ZXJDb21wb25lbnQgaW1wbGVtZW50cyBPbkluaXQge1xuICBASW5wdXQoKSBwYXJlbnRNZXNzYWdlITogTWVzc2FnZTtcbiAgQElucHV0KCkgY29udmVyc2F0aW9uSWQhOiBzdHJpbmc7XG4gIEBPdXRwdXQoKSBjbG9zZSA9IG5ldyBFdmVudEVtaXR0ZXI8dm9pZD4oKTtcblxuICByZXBsaWVzOiBNZXNzYWdlW10gPSBbXTtcbiAgcmVwbHlUZXh0ID0gJyc7XG4gIGxvYWRpbmcgPSBmYWxzZTtcbiAgaXNGb2xsb3dpbmcgPSB0cnVlO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgYXBpOiBNZXNzYWdpbmdBcGlTZXJ2aWNlLFxuICAgIHByaXZhdGUgYXV0aDogQXV0aFNlcnZpY2VcbiAgKSB7fVxuXG4gIG5nT25Jbml0KCkge1xuICAgIHRoaXMubG9hZFRocmVhZCgpO1xuICB9XG5cbiAgbG9hZFRocmVhZCgpIHtcbiAgICBpZiAoIXRoaXMucGFyZW50TWVzc2FnZSkgcmV0dXJuO1xuICAgIFxuICAgIHRoaXMubG9hZGluZyA9IHRydWU7XG4gICAgdGhpcy5hcGkuZ2V0VGhyZWFkTWVzc2FnZXModGhpcy5wYXJlbnRNZXNzYWdlLm1lc3NhZ2VfaWQsIHRoaXMuYXV0aC5jb250YWN0SWQhKS5zdWJzY3JpYmUoe1xuICAgICAgbmV4dDogKG1lc3NhZ2VzKSA9PiB7XG4gICAgICAgIHRoaXMucmVwbGllcyA9IG1lc3NhZ2VzO1xuICAgICAgICB0aGlzLmxvYWRpbmcgPSBmYWxzZTtcbiAgICAgIH0sXG4gICAgICBlcnJvcjogKCkgPT4ge1xuICAgICAgICB0aGlzLmxvYWRpbmcgPSBmYWxzZTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIHNlbmRSZXBseSgpIHtcbiAgICBpZiAoIXRoaXMucmVwbHlUZXh0LnRyaW0oKSkgcmV0dXJuO1xuXG4gICAgdGhpcy5hcGkuc2VuZFRocmVhZFJlcGx5KFxuICAgICAgdGhpcy5wYXJlbnRNZXNzYWdlLm1lc3NhZ2VfaWQsXG4gICAgICB0aGlzLmF1dGguY29udGFjdElkISxcbiAgICAgIHRoaXMucmVwbHlUZXh0XG4gICAgKS5zdWJzY3JpYmUoe1xuICAgICAgbmV4dDogKCkgPT4ge1xuICAgICAgICB0aGlzLnJlcGx5VGV4dCA9ICcnO1xuICAgICAgICB0aGlzLmxvYWRUaHJlYWQoKTtcbiAgICAgIH0sXG4gICAgICBlcnJvcjogKCkgPT4ge31cbiAgICB9KTtcbiAgfVxuXG4gIHRvZ2dsZUZvbGxvdygpIHtcbiAgICB0aGlzLmlzRm9sbG93aW5nID0gIXRoaXMuaXNGb2xsb3dpbmc7XG4gIH1cblxuICBvbkNsb3NlKCkge1xuICAgIHRoaXMuY2xvc2UuZW1pdCgpO1xuICB9XG5cbiAgZm9ybWF0VGltZSh0aW1lc3RhbXA6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgY29uc3QgZGF0ZSA9IG5ldyBEYXRlKHRpbWVzdGFtcCk7XG4gICAgY29uc3Qgbm93ID0gbmV3IERhdGUoKTtcbiAgICBjb25zdCBkaWZmID0gbm93LmdldFRpbWUoKSAtIGRhdGUuZ2V0VGltZSgpO1xuICAgIGNvbnN0IGhvdXJzID0gTWF0aC5mbG9vcihkaWZmIC8gKDEwMDAgKiA2MCAqIDYwKSk7XG5cbiAgICBpZiAoaG91cnMgPCAyNCkge1xuICAgICAgcmV0dXJuIGRhdGUudG9Mb2NhbGVUaW1lU3RyaW5nKCdlbi1VUycsIHsgaG91cjogJ251bWVyaWMnLCBtaW51dGU6ICcyLWRpZ2l0JyB9KTtcbiAgICB9XG4gICAgcmV0dXJuIGRhdGUudG9Mb2NhbGVEYXRlU3RyaW5nKCdlbi1VUycsIHsgbW9udGg6ICdzaG9ydCcsIGRheTogJ251bWVyaWMnIH0pO1xuICB9XG59XG4iXX0=