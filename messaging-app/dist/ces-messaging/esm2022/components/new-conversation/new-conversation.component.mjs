import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatRippleModule } from '@angular/material/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { getContactDisplayName } from '../../models/messaging.models';
import * as i0 from "@angular/core";
import * as i1 from "../../services/messaging-store.service";
import * as i2 from "@angular/common";
import * as i3 from "@angular/forms";
import * as i4 from "@angular/material/icon";
import * as i5 from "@angular/material/button";
import * as i6 from "@angular/material/core";
import * as i7 from "@angular/material/tooltip";
export class NewConversationComponent {
    store;
    contacts = [];
    searchQuery = '';
    sub;
    constructor(store) {
        this.store = store;
    }
    ngOnInit() {
        this.store.loadVisibleContacts();
        this.sub = this.store.visibleContacts.subscribe((c) => (this.contacts = c));
    }
    ngOnDestroy() {
        this.sub?.unsubscribe();
    }
    get filteredContacts() {
        if (!this.searchQuery.trim())
            return this.contacts;
        const q = this.searchQuery.toLowerCase();
        return this.contacts.filter((c) => this.getDisplayName(c).toLowerCase().includes(q) ||
            (c.company_name || '').toLowerCase().includes(q) ||
            (c.email || '').toLowerCase().includes(q));
    }
    getDisplayName(contact) {
        return getContactDisplayName(contact);
    }
    selectContact(contact) {
        const displayName = this.getDisplayName(contact);
        this.store.openDirectConversation(contact.contact_id, displayName);
    }
    goBack() {
        this.store.setView('inbox');
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: NewConversationComponent, deps: [{ token: i1.MessagingStoreService }], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "17.3.12", type: NewConversationComponent, isStandalone: true, selector: "app-new-conversation", ngImport: i0, template: `
    <div class="new-conv-container">
      <div class="header">
        <button mat-icon-button class="hdr-btn" (click)="goBack()" matTooltip="Back" matTooltipPosition="below">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <h3>New Message</h3>
      </div>

      <div class="search-bar">
        <mat-icon class="search-icon">search</mat-icon>
        <input
          type="text"
          [(ngModel)]="searchQuery"
          placeholder="Search contacts..."
          class="search-input"
        />
      </div>

      <div class="contacts-list">
        <div
          *ngFor="let contact of filteredContacts"
          class="contact-item"
          matRipple
          (click)="selectContact(contact)"
        >
          <div class="contact-avatar">
            <mat-icon>person</mat-icon>
          </div>
          <div class="contact-info">
            <span class="contact-name">{{ getDisplayName(contact) }}</span>
            <span class="contact-company">{{ contact.company_name }}</span>
          </div>
        </div>

        <div *ngIf="filteredContacts.length === 0" class="empty-state">
          <mat-icon>person_search</mat-icon>
          <p>{{ searchQuery ? 'No contacts found' : 'No visible contacts' }}</p>
        </div>
      </div>
    </div>
  `, isInline: true, styles: [".new-conv-container{display:flex;flex-direction:column;height:100%}.header{display:flex;align-items:center;padding:12px 8px 12px 4px;border-bottom:1px solid rgba(255,255,255,.15);gap:4px}.header h3{margin:0;font-size:18px;font-weight:600;color:#fff}.hdr-btn{border-radius:6px!important;transition:background .15s,box-shadow .15s}.hdr-btn:hover{background:#ffffff26!important;box-shadow:0 2px 8px #0003}.hdr-btn mat-icon{color:#fffc}.search-bar{display:flex;align-items:center;margin:12px 16px;padding:8px 12px;background:#ffffff26;border-radius:10px}.search-icon{color:#fff9;font-size:20px;width:20px;height:20px;margin-right:8px}.search-input{flex:1;border:none;outline:none;background:transparent;font-size:14px;color:#fff}.search-input::placeholder{color:#fff9}.contacts-list{flex:1;overflow-y:auto}.contact-item{display:flex;align-items:center;padding:10px 16px;cursor:pointer;transition:background .15s;gap:12px}.contact-item:hover{background:#ffffff1a}.contact-avatar{width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#dbeafe,#93c5fd);display:flex;align-items:center;justify-content:center;flex-shrink:0}.contact-avatar mat-icon{color:#1f4bd8}.contact-info{display:flex;flex-direction:column}.contact-name{font-weight:500;font-size:14px;color:#fff}.contact-company{font-size:12px;color:#ffffffb3}.empty-state{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 24px;color:#fff9}.empty-state mat-icon{font-size:48px;width:48px;height:48px;margin-bottom:12px}.empty-state p{font-size:14px;margin:0}\n"], dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i2.NgForOf, selector: "[ngFor][ngForOf]", inputs: ["ngForOf", "ngForTrackBy", "ngForTemplate"] }, { kind: "directive", type: i2.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "ngmodule", type: FormsModule }, { kind: "directive", type: i3.DefaultValueAccessor, selector: "input:not([type=checkbox])[formControlName],textarea[formControlName],input:not([type=checkbox])[formControl],textarea[formControl],input:not([type=checkbox])[ngModel],textarea[ngModel],[ngDefaultControl]" }, { kind: "directive", type: i3.NgControlStatus, selector: "[formControlName],[ngModel],[formControl]" }, { kind: "directive", type: i3.NgModel, selector: "[ngModel]:not([formControlName]):not([formControl])", inputs: ["name", "disabled", "ngModel", "ngModelOptions"], outputs: ["ngModelChange"], exportAs: ["ngModel"] }, { kind: "ngmodule", type: MatIconModule }, { kind: "component", type: i4.MatIcon, selector: "mat-icon", inputs: ["color", "inline", "svgIcon", "fontSet", "fontIcon"], exportAs: ["matIcon"] }, { kind: "ngmodule", type: MatButtonModule }, { kind: "component", type: i5.MatIconButton, selector: "button[mat-icon-button]", exportAs: ["matButton"] }, { kind: "ngmodule", type: MatRippleModule }, { kind: "directive", type: i6.MatRipple, selector: "[mat-ripple], [matRipple]", inputs: ["matRippleColor", "matRippleUnbounded", "matRippleCentered", "matRippleRadius", "matRippleAnimation", "matRippleDisabled", "matRippleTrigger"], exportAs: ["matRipple"] }, { kind: "ngmodule", type: MatTooltipModule }, { kind: "directive", type: i7.MatTooltip, selector: "[matTooltip]", inputs: ["matTooltipPosition", "matTooltipPositionAtOrigin", "matTooltipDisabled", "matTooltipShowDelay", "matTooltipHideDelay", "matTooltipTouchGestures", "matTooltip", "matTooltipClass"], exportAs: ["matTooltip"] }] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: NewConversationComponent, decorators: [{
            type: Component,
            args: [{ selector: 'app-new-conversation', standalone: true, imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatRippleModule, MatTooltipModule], template: `
    <div class="new-conv-container">
      <div class="header">
        <button mat-icon-button class="hdr-btn" (click)="goBack()" matTooltip="Back" matTooltipPosition="below">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <h3>New Message</h3>
      </div>

      <div class="search-bar">
        <mat-icon class="search-icon">search</mat-icon>
        <input
          type="text"
          [(ngModel)]="searchQuery"
          placeholder="Search contacts..."
          class="search-input"
        />
      </div>

      <div class="contacts-list">
        <div
          *ngFor="let contact of filteredContacts"
          class="contact-item"
          matRipple
          (click)="selectContact(contact)"
        >
          <div class="contact-avatar">
            <mat-icon>person</mat-icon>
          </div>
          <div class="contact-info">
            <span class="contact-name">{{ getDisplayName(contact) }}</span>
            <span class="contact-company">{{ contact.company_name }}</span>
          </div>
        </div>

        <div *ngIf="filteredContacts.length === 0" class="empty-state">
          <mat-icon>person_search</mat-icon>
          <p>{{ searchQuery ? 'No contacts found' : 'No visible contacts' }}</p>
        </div>
      </div>
    </div>
  `, styles: [".new-conv-container{display:flex;flex-direction:column;height:100%}.header{display:flex;align-items:center;padding:12px 8px 12px 4px;border-bottom:1px solid rgba(255,255,255,.15);gap:4px}.header h3{margin:0;font-size:18px;font-weight:600;color:#fff}.hdr-btn{border-radius:6px!important;transition:background .15s,box-shadow .15s}.hdr-btn:hover{background:#ffffff26!important;box-shadow:0 2px 8px #0003}.hdr-btn mat-icon{color:#fffc}.search-bar{display:flex;align-items:center;margin:12px 16px;padding:8px 12px;background:#ffffff26;border-radius:10px}.search-icon{color:#fff9;font-size:20px;width:20px;height:20px;margin-right:8px}.search-input{flex:1;border:none;outline:none;background:transparent;font-size:14px;color:#fff}.search-input::placeholder{color:#fff9}.contacts-list{flex:1;overflow-y:auto}.contact-item{display:flex;align-items:center;padding:10px 16px;cursor:pointer;transition:background .15s;gap:12px}.contact-item:hover{background:#ffffff1a}.contact-avatar{width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#dbeafe,#93c5fd);display:flex;align-items:center;justify-content:center;flex-shrink:0}.contact-avatar mat-icon{color:#1f4bd8}.contact-info{display:flex;flex-direction:column}.contact-name{font-weight:500;font-size:14px;color:#fff}.contact-company{font-size:12px;color:#ffffffb3}.empty-state{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 24px;color:#fff9}.empty-state mat-icon{font-size:48px;width:48px;height:48px;margin-bottom:12px}.empty-state p{font-size:14px;margin:0}\n"] }]
        }], ctorParameters: () => [{ type: i1.MessagingStoreService }] });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmV3LWNvbnZlcnNhdGlvbi5jb21wb25lbnQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvbGliL2NvbXBvbmVudHMvbmV3LWNvbnZlcnNhdGlvbi9uZXctY29udmVyc2F0aW9uLmNvbXBvbmVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsU0FBUyxFQUFxQixNQUFNLGVBQWUsQ0FBQztBQUM3RCxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDL0MsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLGdCQUFnQixDQUFDO0FBQzdDLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSx3QkFBd0IsQ0FBQztBQUN2RCxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFDM0QsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHdCQUF3QixDQUFDO0FBQ3pELE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBRzdELE9BQU8sRUFBVyxxQkFBcUIsRUFBRSxNQUFNLCtCQUErQixDQUFDOzs7Ozs7Ozs7QUF5TC9FLE1BQU0sT0FBTyx3QkFBd0I7SUFLZjtJQUpwQixRQUFRLEdBQWMsRUFBRSxDQUFDO0lBQ3pCLFdBQVcsR0FBRyxFQUFFLENBQUM7SUFDVCxHQUFHLENBQWdCO0lBRTNCLFlBQW9CLEtBQTRCO1FBQTVCLFVBQUssR0FBTCxLQUFLLENBQXVCO0lBQUcsQ0FBQztJQUVwRCxRQUFRO1FBQ04sSUFBSSxDQUFDLEtBQUssQ0FBQyxtQkFBbUIsRUFBRSxDQUFDO1FBQ2pDLElBQUksQ0FBQyxHQUFHLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxlQUFlLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxRQUFRLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUM5RSxDQUFDO0lBRUQsV0FBVztRQUNULElBQUksQ0FBQyxHQUFHLEVBQUUsV0FBVyxFQUFFLENBQUM7SUFDMUIsQ0FBQztJQUVELElBQUksZ0JBQWdCO1FBQ2xCLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksRUFBRTtZQUFFLE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQztRQUNuRCxNQUFNLENBQUMsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLFdBQVcsRUFBRSxDQUFDO1FBQ3pDLE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQ3pCLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FDSixJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7WUFDaEQsQ0FBQyxDQUFDLENBQUMsWUFBWSxJQUFJLEVBQUUsQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7WUFDaEQsQ0FBQyxDQUFDLENBQUMsS0FBSyxJQUFJLEVBQUUsQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FDNUMsQ0FBQztJQUNKLENBQUM7SUFFRCxjQUFjLENBQUMsT0FBZ0I7UUFDN0IsT0FBTyxxQkFBcUIsQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUN4QyxDQUFDO0lBRUQsYUFBYSxDQUFDLE9BQWdCO1FBQzVCLE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDakQsSUFBSSxDQUFDLEtBQUssQ0FBQyxzQkFBc0IsQ0FBQyxPQUFPLENBQUMsVUFBVSxFQUFFLFdBQVcsQ0FBQyxDQUFDO0lBQ3JFLENBQUM7SUFFRCxNQUFNO1FBQ0osSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDOUIsQ0FBQzt3R0F0Q1Usd0JBQXdCOzRGQUF4Qix3QkFBd0IsZ0ZBbkx6Qjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7R0F5Q1Qsd21EQTFDUyxZQUFZLCtQQUFFLFdBQVcsOG1CQUFFLGFBQWEsbUxBQUUsZUFBZSwySUFBRSxlQUFlLGtTQUFFLGdCQUFnQjs7NEZBb0wzRix3QkFBd0I7a0JBdkxwQyxTQUFTOytCQUNFLHNCQUFzQixjQUNwQixJQUFJLFdBQ1AsQ0FBQyxZQUFZLEVBQUUsV0FBVyxFQUFFLGFBQWEsRUFBRSxlQUFlLEVBQUUsZUFBZSxFQUFFLGdCQUFnQixDQUFDLFlBQzdGOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQXlDVCIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IENvbXBvbmVudCwgT25Jbml0LCBPbkRlc3Ryb3kgfSBmcm9tICdAYW5ndWxhci9jb3JlJztcbmltcG9ydCB7IENvbW1vbk1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL2NvbW1vbic7XG5pbXBvcnQgeyBGb3Jtc01vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL2Zvcm1zJztcbmltcG9ydCB7IE1hdEljb25Nb2R1bGUgfSBmcm9tICdAYW5ndWxhci9tYXRlcmlhbC9pY29uJztcbmltcG9ydCB7IE1hdEJ1dHRvbk1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL21hdGVyaWFsL2J1dHRvbic7XG5pbXBvcnQgeyBNYXRSaXBwbGVNb2R1bGUgfSBmcm9tICdAYW5ndWxhci9tYXRlcmlhbC9jb3JlJztcbmltcG9ydCB7IE1hdFRvb2x0aXBNb2R1bGUgfSBmcm9tICdAYW5ndWxhci9tYXRlcmlhbC90b29sdGlwJztcbmltcG9ydCB7IFN1YnNjcmlwdGlvbiB9IGZyb20gJ3J4anMnO1xuaW1wb3J0IHsgTWVzc2FnaW5nU3RvcmVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvbWVzc2FnaW5nLXN0b3JlLnNlcnZpY2UnO1xuaW1wb3J0IHsgQ29udGFjdCwgZ2V0Q29udGFjdERpc3BsYXlOYW1lIH0gZnJvbSAnLi4vLi4vbW9kZWxzL21lc3NhZ2luZy5tb2RlbHMnO1xuXG5AQ29tcG9uZW50KHtcbiAgc2VsZWN0b3I6ICdhcHAtbmV3LWNvbnZlcnNhdGlvbicsXG4gIHN0YW5kYWxvbmU6IHRydWUsXG4gIGltcG9ydHM6IFtDb21tb25Nb2R1bGUsIEZvcm1zTW9kdWxlLCBNYXRJY29uTW9kdWxlLCBNYXRCdXR0b25Nb2R1bGUsIE1hdFJpcHBsZU1vZHVsZSwgTWF0VG9vbHRpcE1vZHVsZV0sXG4gIHRlbXBsYXRlOiBgXG4gICAgPGRpdiBjbGFzcz1cIm5ldy1jb252LWNvbnRhaW5lclwiPlxuICAgICAgPGRpdiBjbGFzcz1cImhlYWRlclwiPlxuICAgICAgICA8YnV0dG9uIG1hdC1pY29uLWJ1dHRvbiBjbGFzcz1cImhkci1idG5cIiAoY2xpY2spPVwiZ29CYWNrKClcIiBtYXRUb29sdGlwPVwiQmFja1wiIG1hdFRvb2x0aXBQb3NpdGlvbj1cImJlbG93XCI+XG4gICAgICAgICAgPG1hdC1pY29uPmFycm93X2JhY2s8L21hdC1pY29uPlxuICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgPGgzPk5ldyBNZXNzYWdlPC9oMz5cbiAgICAgIDwvZGl2PlxuXG4gICAgICA8ZGl2IGNsYXNzPVwic2VhcmNoLWJhclwiPlxuICAgICAgICA8bWF0LWljb24gY2xhc3M9XCJzZWFyY2gtaWNvblwiPnNlYXJjaDwvbWF0LWljb24+XG4gICAgICAgIDxpbnB1dFxuICAgICAgICAgIHR5cGU9XCJ0ZXh0XCJcbiAgICAgICAgICBbKG5nTW9kZWwpXT1cInNlYXJjaFF1ZXJ5XCJcbiAgICAgICAgICBwbGFjZWhvbGRlcj1cIlNlYXJjaCBjb250YWN0cy4uLlwiXG4gICAgICAgICAgY2xhc3M9XCJzZWFyY2gtaW5wdXRcIlxuICAgICAgICAvPlxuICAgICAgPC9kaXY+XG5cbiAgICAgIDxkaXYgY2xhc3M9XCJjb250YWN0cy1saXN0XCI+XG4gICAgICAgIDxkaXZcbiAgICAgICAgICAqbmdGb3I9XCJsZXQgY29udGFjdCBvZiBmaWx0ZXJlZENvbnRhY3RzXCJcbiAgICAgICAgICBjbGFzcz1cImNvbnRhY3QtaXRlbVwiXG4gICAgICAgICAgbWF0UmlwcGxlXG4gICAgICAgICAgKGNsaWNrKT1cInNlbGVjdENvbnRhY3QoY29udGFjdClcIlxuICAgICAgICA+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cImNvbnRhY3QtYXZhdGFyXCI+XG4gICAgICAgICAgICA8bWF0LWljb24+cGVyc29uPC9tYXQtaWNvbj5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwiY29udGFjdC1pbmZvXCI+XG4gICAgICAgICAgICA8c3BhbiBjbGFzcz1cImNvbnRhY3QtbmFtZVwiPnt7IGdldERpc3BsYXlOYW1lKGNvbnRhY3QpIH19PC9zcGFuPlxuICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJjb250YWN0LWNvbXBhbnlcIj57eyBjb250YWN0LmNvbXBhbnlfbmFtZSB9fTwvc3Bhbj5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgPGRpdiAqbmdJZj1cImZpbHRlcmVkQ29udGFjdHMubGVuZ3RoID09PSAwXCIgY2xhc3M9XCJlbXB0eS1zdGF0ZVwiPlxuICAgICAgICAgIDxtYXQtaWNvbj5wZXJzb25fc2VhcmNoPC9tYXQtaWNvbj5cbiAgICAgICAgICA8cD57eyBzZWFyY2hRdWVyeSA/ICdObyBjb250YWN0cyBmb3VuZCcgOiAnTm8gdmlzaWJsZSBjb250YWN0cycgfX08L3A+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgPC9kaXY+XG4gIGAsXG4gIHN0eWxlczogW2BcbiAgICAubmV3LWNvbnYtY29udGFpbmVyIHtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgaGVpZ2h0OiAxMDAlO1xuICAgIH1cblxuICAgIC5oZWFkZXIge1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBwYWRkaW5nOiAxMnB4IDhweCAxMnB4IDRweDtcbiAgICAgIGJvcmRlci1ib3R0b206IDFweCBzb2xpZCByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMTUpO1xuICAgICAgZ2FwOiA0cHg7XG4gICAgfVxuXG4gICAgLmhlYWRlciBoMyB7XG4gICAgICBtYXJnaW46IDA7XG4gICAgICBmb250LXNpemU6IDE4cHg7XG4gICAgICBmb250LXdlaWdodDogNjAwO1xuICAgICAgY29sb3I6ICNmZmY7XG4gICAgfVxuXG4gICAgLmhkci1idG4ge1xuICAgICAgYm9yZGVyLXJhZGl1czogNnB4ICFpbXBvcnRhbnQ7XG4gICAgICB0cmFuc2l0aW9uOiBiYWNrZ3JvdW5kIDAuMTVzLCBib3gtc2hhZG93IDAuMTVzO1xuICAgIH1cblxuICAgIC5oZHItYnRuOmhvdmVyIHtcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xNSkgIWltcG9ydGFudDtcbiAgICAgIGJveC1zaGFkb3c6IDAgMnB4IDhweCByZ2JhKDAsIDAsIDAsIDAuMik7XG4gICAgfVxuXG4gICAgLmhkci1idG4gbWF0LWljb24ge1xuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC44KTtcbiAgICB9XG5cbiAgICAuc2VhcmNoLWJhciB7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIG1hcmdpbjogMTJweCAxNnB4O1xuICAgICAgcGFkZGluZzogOHB4IDEycHg7XG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMTUpO1xuICAgICAgYm9yZGVyLXJhZGl1czogMTBweDtcbiAgICB9XG5cbiAgICAuc2VhcmNoLWljb24ge1xuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC42KTtcbiAgICAgIGZvbnQtc2l6ZTogMjBweDtcbiAgICAgIHdpZHRoOiAyMHB4O1xuICAgICAgaGVpZ2h0OiAyMHB4O1xuICAgICAgbWFyZ2luLXJpZ2h0OiA4cHg7XG4gICAgfVxuXG4gICAgLnNlYXJjaC1pbnB1dCB7XG4gICAgICBmbGV4OiAxO1xuICAgICAgYm9yZGVyOiBub25lO1xuICAgICAgb3V0bGluZTogbm9uZTtcbiAgICAgIGJhY2tncm91bmQ6IHRyYW5zcGFyZW50O1xuICAgICAgZm9udC1zaXplOiAxNHB4O1xuICAgICAgY29sb3I6ICNmZmY7XG4gICAgfVxuXG4gICAgLnNlYXJjaC1pbnB1dDo6cGxhY2Vob2xkZXIge1xuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC42KTtcbiAgICB9XG5cbiAgICAuY29udGFjdHMtbGlzdCB7XG4gICAgICBmbGV4OiAxO1xuICAgICAgb3ZlcmZsb3cteTogYXV0bztcbiAgICB9XG5cbiAgICAuY29udGFjdC1pdGVtIHtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgcGFkZGluZzogMTBweCAxNnB4O1xuICAgICAgY3Vyc29yOiBwb2ludGVyO1xuICAgICAgdHJhbnNpdGlvbjogYmFja2dyb3VuZCAwLjE1cztcbiAgICAgIGdhcDogMTJweDtcbiAgICB9XG5cbiAgICAuY29udGFjdC1pdGVtOmhvdmVyIHtcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xKTtcbiAgICB9XG5cbiAgICAuY29udGFjdC1hdmF0YXIge1xuICAgICAgd2lkdGg6IDQwcHg7XG4gICAgICBoZWlnaHQ6IDQwcHg7XG4gICAgICBib3JkZXItcmFkaXVzOiA1MCU7XG4gICAgICBiYWNrZ3JvdW5kOiBsaW5lYXItZ3JhZGllbnQoMTM1ZGVnLCAjZGJlYWZlIDAlLCAjOTNjNWZkIDEwMCUpO1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgIGZsZXgtc2hyaW5rOiAwO1xuICAgIH1cblxuICAgIC5jb250YWN0LWF2YXRhciBtYXQtaWNvbiB7XG4gICAgICBjb2xvcjogIzFGNEJEODtcbiAgICB9XG5cbiAgICAuY29udGFjdC1pbmZvIHtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgIH1cblxuICAgIC5jb250YWN0LW5hbWUge1xuICAgICAgZm9udC13ZWlnaHQ6IDUwMDtcbiAgICAgIGZvbnQtc2l6ZTogMTRweDtcbiAgICAgIGNvbG9yOiAjZmZmO1xuICAgIH1cblxuICAgIC5jb250YWN0LWNvbXBhbnkge1xuICAgICAgZm9udC1zaXplOiAxMnB4O1xuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC43KTtcbiAgICB9XG5cbiAgICAuZW1wdHktc3RhdGUge1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgICBwYWRkaW5nOiA0OHB4IDI0cHg7XG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjYpO1xuICAgIH1cblxuICAgIC5lbXB0eS1zdGF0ZSBtYXQtaWNvbiB7XG4gICAgICBmb250LXNpemU6IDQ4cHg7XG4gICAgICB3aWR0aDogNDhweDtcbiAgICAgIGhlaWdodDogNDhweDtcbiAgICAgIG1hcmdpbi1ib3R0b206IDEycHg7XG4gICAgfVxuXG4gICAgLmVtcHR5LXN0YXRlIHAge1xuICAgICAgZm9udC1zaXplOiAxNHB4O1xuICAgICAgbWFyZ2luOiAwO1xuICAgIH1cbiAgYF0sXG59KVxuZXhwb3J0IGNsYXNzIE5ld0NvbnZlcnNhdGlvbkNvbXBvbmVudCBpbXBsZW1lbnRzIE9uSW5pdCwgT25EZXN0cm95IHtcbiAgY29udGFjdHM6IENvbnRhY3RbXSA9IFtdO1xuICBzZWFyY2hRdWVyeSA9ICcnO1xuICBwcml2YXRlIHN1YiE6IFN1YnNjcmlwdGlvbjtcblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHN0b3JlOiBNZXNzYWdpbmdTdG9yZVNlcnZpY2UpIHt9XG5cbiAgbmdPbkluaXQoKTogdm9pZCB7XG4gICAgdGhpcy5zdG9yZS5sb2FkVmlzaWJsZUNvbnRhY3RzKCk7XG4gICAgdGhpcy5zdWIgPSB0aGlzLnN0b3JlLnZpc2libGVDb250YWN0cy5zdWJzY3JpYmUoKGMpID0+ICh0aGlzLmNvbnRhY3RzID0gYykpO1xuICB9XG5cbiAgbmdPbkRlc3Ryb3koKTogdm9pZCB7XG4gICAgdGhpcy5zdWI/LnVuc3Vic2NyaWJlKCk7XG4gIH1cblxuICBnZXQgZmlsdGVyZWRDb250YWN0cygpOiBDb250YWN0W10ge1xuICAgIGlmICghdGhpcy5zZWFyY2hRdWVyeS50cmltKCkpIHJldHVybiB0aGlzLmNvbnRhY3RzO1xuICAgIGNvbnN0IHEgPSB0aGlzLnNlYXJjaFF1ZXJ5LnRvTG93ZXJDYXNlKCk7XG4gICAgcmV0dXJuIHRoaXMuY29udGFjdHMuZmlsdGVyKFxuICAgICAgKGMpID0+XG4gICAgICAgIHRoaXMuZ2V0RGlzcGxheU5hbWUoYykudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhxKSB8fFxuICAgICAgICAoYy5jb21wYW55X25hbWUgfHwgJycpLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMocSkgfHxcbiAgICAgICAgKGMuZW1haWwgfHwgJycpLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMocSlcbiAgICApO1xuICB9XG5cbiAgZ2V0RGlzcGxheU5hbWUoY29udGFjdDogQ29udGFjdCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIGdldENvbnRhY3REaXNwbGF5TmFtZShjb250YWN0KTtcbiAgfVxuXG4gIHNlbGVjdENvbnRhY3QoY29udGFjdDogQ29udGFjdCk6IHZvaWQge1xuICAgIGNvbnN0IGRpc3BsYXlOYW1lID0gdGhpcy5nZXREaXNwbGF5TmFtZShjb250YWN0KTtcbiAgICB0aGlzLnN0b3JlLm9wZW5EaXJlY3RDb252ZXJzYXRpb24oY29udGFjdC5jb250YWN0X2lkLCBkaXNwbGF5TmFtZSk7XG4gIH1cblxuICBnb0JhY2soKTogdm9pZCB7XG4gICAgdGhpcy5zdG9yZS5zZXRWaWV3KCdpbmJveCcpO1xuICB9XG59XG4iXX0=