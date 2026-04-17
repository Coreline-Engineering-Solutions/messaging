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
export class GroupManagerComponent {
    store;
    contacts = [];
    selectedContacts = [];
    groupName = '';
    searchQuery = '';
    isEditMode = false;
    editingConversationId = null;
    creatorContactId = null;
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
            (c.company_name || '').toLowerCase().includes(q));
    }
    getDisplayName(contact) {
        return getContactDisplayName(contact);
    }
    get canCreate() {
        return this.groupName.trim().length > 0 && this.selectedContacts.length >= 1;
    }
    isSelected(contact) {
        return this.selectedContacts.some((c) => c.contact_id === contact.contact_id);
    }
    isCreator(contact) {
        return contact.contact_id === this.creatorContactId;
    }
    toggleContact(contact) {
        if (this.isCreator(contact))
            return;
        if (this.isSelected(contact)) {
            this.removeContact(contact);
        }
        else {
            this.selectedContacts = [...this.selectedContacts, contact];
        }
    }
    removeContact(contact) {
        if (this.isCreator(contact))
            return;
        this.selectedContacts = this.selectedContacts.filter((c) => c.contact_id !== contact.contact_id);
    }
    onSubmit() {
        if (!this.canCreate)
            return;
        if (this.isEditMode && this.editingConversationId) {
            this.store.manageGroup('rename', this.editingConversationId, this.groupName.trim());
        }
        else {
            const ids = this.selectedContacts.map((c) => c.contact_id);
            this.store.createGroupConversation(ids, this.groupName.trim());
        }
        this.goBack();
    }
    onDelete() {
        if (this.editingConversationId) {
            this.store.deleteGroup(this.editingConversationId);
            this.goBack();
        }
    }
    goBack() {
        this.store.setView('inbox');
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: GroupManagerComponent, deps: [{ token: i1.MessagingStoreService }], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "17.3.12", type: GroupManagerComponent, isStandalone: true, selector: "app-group-manager", ngImport: i0, template: `
    <div class="group-manager">
      <div class="header">
        <button mat-icon-button class="hdr-btn" (click)="goBack()" matTooltip="Back" matTooltipPosition="below">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <h3>{{ isEditMode ? 'Edit Group' : 'Create Group' }}</h3>
      </div>

      <div class="form-section">
        <label class="field-label">Group Name</label>
        <input
          type="text"
          [(ngModel)]="groupName"
          placeholder="Enter group name..."
          class="text-field"
        />
      </div>

      <div class="form-section">
        <label class="field-label">Members (min 2 including you)</label>
        <div class="search-bar">
          <mat-icon class="search-icon">search</mat-icon>
          <input
            type="text"
            [(ngModel)]="searchQuery"
            placeholder="Search contacts..."
            class="search-input"
          />
        </div>
      </div>

      <div *ngIf="selectedContacts.length > 0" class="selected-chips">
        <div *ngFor="let c of selectedContacts" class="chip">
          <span>{{ getDisplayName(c) }}</span>
          <button mat-icon-button class="chip-remove" (click)="removeContact(c)" [disabled]="isCreator(c)">
            <mat-icon>{{ isCreator(c) ? 'star' : 'close' }}</mat-icon>
          </button>
        </div>
      </div>

      <div class="contacts-list">
        <div
          *ngFor="let contact of filteredContacts"
          class="contact-item"
          matRipple
          [class.selected]="isSelected(contact)"
          (click)="toggleContact(contact)"
        >
          <div class="contact-avatar">
            <mat-icon>person</mat-icon>
          </div>
          <div class="contact-info">
            <span class="contact-name">{{ getDisplayName(contact) }}</span>
            <span class="contact-company">{{ contact.company_name }}</span>
          </div>
          <mat-icon *ngIf="isSelected(contact)" class="check-icon">check_circle</mat-icon>
        </div>
      </div>

      <div class="action-bar">
        <button
          mat-raised-button
          [disabled]="!canCreate"
          (click)="onSubmit()"
          class="create-btn"
        >
          <mat-icon>{{ isEditMode ? 'save' : 'group_add' }}</mat-icon>
          {{ isEditMode ? 'Save Changes' : 'Create Group' }} ({{ selectedContacts.length + 1 }} members)
        </button>
        <button
          *ngIf="isEditMode"
          mat-stroked-button
          class="delete-btn"
          (click)="onDelete()"
        >
          <mat-icon>delete</mat-icon>
          Delete Group
        </button>
      </div>
    </div>
  `, isInline: true, styles: [".group-manager{display:flex;flex-direction:column;height:100%}.header{display:flex;align-items:center;padding:12px 8px 12px 4px;border-bottom:1px solid rgba(255,255,255,.15);gap:4px}.header h3{margin:0;font-size:18px;font-weight:600;color:#fff}.hdr-btn{border-radius:6px!important;transition:background .15s,box-shadow .15s}.hdr-btn:hover{background:#ffffff26!important;box-shadow:0 2px 8px #0003}.hdr-btn mat-icon{color:#fffc}.form-section{padding:12px 16px 0}.field-label{display:block;font-size:12px;font-weight:600;color:#ffffffb3;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px}.text-field{width:100%;padding:10px 12px;border:1px solid rgba(255,255,255,.25);border-radius:8px;font-size:14px;color:#fff;background:#ffffff1a;outline:none;transition:border-color .2s;box-sizing:border-box}.text-field:focus{border-color:#ffffff80}.text-field::placeholder{color:#ffffff80}.search-bar{display:flex;align-items:center;padding:8px 12px;background:#ffffff1a;border-radius:10px}.search-icon{color:#fff9;font-size:20px;width:20px;height:20px;margin-right:8px}.search-input{flex:1;border:none;outline:none;background:transparent;font-size:14px;color:#fff}.search-input::placeholder{color:#ffffff80}.selected-chips{display:flex;flex-wrap:wrap;gap:6px;padding:8px 16px}.chip{display:flex;align-items:center;background:#fff3;color:#fff;border-radius:16px;padding:4px 6px 4px 12px;font-size:12px;font-weight:500}.chip-remove{width:20px!important;height:20px!important;line-height:20px!important}.chip-remove mat-icon{font-size:14px;width:14px;height:14px;color:#fffc}.contacts-list{flex:1;overflow-y:auto;padding-top:4px}.contact-item{display:flex;align-items:center;padding:10px 16px;cursor:pointer;transition:background .15s;gap:12px}.contact-item:hover{background:#ffffff14}.contact-item.selected{background:#ffffff26}.contact-avatar{width:36px;height:36px;border-radius:50%;background:#fff3;display:flex;align-items:center;justify-content:center;flex-shrink:0}.contact-avatar mat-icon{color:#fff;font-size:20px}.contact-info{flex:1;display:flex;flex-direction:column}.contact-name{font-weight:500;font-size:14px;color:#fff}.contact-company{font-size:12px;color:#fff9}.check-icon{color:#22c55e;font-size:22px}.action-bar{padding:12px 16px;border-top:1px solid rgba(255,255,255,.1);display:flex;flex-direction:column;gap:8px}.create-btn{width:100%;background:#fff3!important;color:#fff!important;border-radius:10px;font-weight:600}.create-btn:disabled{opacity:.5}.create-btn mat-icon{margin-right:8px}.delete-btn{width:100%;color:#f87171!important;border-color:#f8717166!important;border-radius:10px;font-weight:600}.delete-btn mat-icon{margin-right:8px}\n"], dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i2.NgForOf, selector: "[ngFor][ngForOf]", inputs: ["ngForOf", "ngForTrackBy", "ngForTemplate"] }, { kind: "directive", type: i2.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "ngmodule", type: FormsModule }, { kind: "directive", type: i3.DefaultValueAccessor, selector: "input:not([type=checkbox])[formControlName],textarea[formControlName],input:not([type=checkbox])[formControl],textarea[formControl],input:not([type=checkbox])[ngModel],textarea[ngModel],[ngDefaultControl]" }, { kind: "directive", type: i3.NgControlStatus, selector: "[formControlName],[ngModel],[formControl]" }, { kind: "directive", type: i3.NgModel, selector: "[ngModel]:not([formControlName]):not([formControl])", inputs: ["name", "disabled", "ngModel", "ngModelOptions"], outputs: ["ngModelChange"], exportAs: ["ngModel"] }, { kind: "ngmodule", type: MatIconModule }, { kind: "component", type: i4.MatIcon, selector: "mat-icon", inputs: ["color", "inline", "svgIcon", "fontSet", "fontIcon"], exportAs: ["matIcon"] }, { kind: "ngmodule", type: MatButtonModule }, { kind: "component", type: i5.MatButton, selector: "    button[mat-button], button[mat-raised-button], button[mat-flat-button],    button[mat-stroked-button]  ", exportAs: ["matButton"] }, { kind: "component", type: i5.MatIconButton, selector: "button[mat-icon-button]", exportAs: ["matButton"] }, { kind: "ngmodule", type: MatRippleModule }, { kind: "directive", type: i6.MatRipple, selector: "[mat-ripple], [matRipple]", inputs: ["matRippleColor", "matRippleUnbounded", "matRippleCentered", "matRippleRadius", "matRippleAnimation", "matRippleDisabled", "matRippleTrigger"], exportAs: ["matRipple"] }, { kind: "ngmodule", type: MatTooltipModule }, { kind: "directive", type: i7.MatTooltip, selector: "[matTooltip]", inputs: ["matTooltipPosition", "matTooltipPositionAtOrigin", "matTooltipDisabled", "matTooltipShowDelay", "matTooltipHideDelay", "matTooltipTouchGestures", "matTooltip", "matTooltipClass"], exportAs: ["matTooltip"] }] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: GroupManagerComponent, decorators: [{
            type: Component,
            args: [{ selector: 'app-group-manager', standalone: true, imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatRippleModule, MatTooltipModule], template: `
    <div class="group-manager">
      <div class="header">
        <button mat-icon-button class="hdr-btn" (click)="goBack()" matTooltip="Back" matTooltipPosition="below">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <h3>{{ isEditMode ? 'Edit Group' : 'Create Group' }}</h3>
      </div>

      <div class="form-section">
        <label class="field-label">Group Name</label>
        <input
          type="text"
          [(ngModel)]="groupName"
          placeholder="Enter group name..."
          class="text-field"
        />
      </div>

      <div class="form-section">
        <label class="field-label">Members (min 2 including you)</label>
        <div class="search-bar">
          <mat-icon class="search-icon">search</mat-icon>
          <input
            type="text"
            [(ngModel)]="searchQuery"
            placeholder="Search contacts..."
            class="search-input"
          />
        </div>
      </div>

      <div *ngIf="selectedContacts.length > 0" class="selected-chips">
        <div *ngFor="let c of selectedContacts" class="chip">
          <span>{{ getDisplayName(c) }}</span>
          <button mat-icon-button class="chip-remove" (click)="removeContact(c)" [disabled]="isCreator(c)">
            <mat-icon>{{ isCreator(c) ? 'star' : 'close' }}</mat-icon>
          </button>
        </div>
      </div>

      <div class="contacts-list">
        <div
          *ngFor="let contact of filteredContacts"
          class="contact-item"
          matRipple
          [class.selected]="isSelected(contact)"
          (click)="toggleContact(contact)"
        >
          <div class="contact-avatar">
            <mat-icon>person</mat-icon>
          </div>
          <div class="contact-info">
            <span class="contact-name">{{ getDisplayName(contact) }}</span>
            <span class="contact-company">{{ contact.company_name }}</span>
          </div>
          <mat-icon *ngIf="isSelected(contact)" class="check-icon">check_circle</mat-icon>
        </div>
      </div>

      <div class="action-bar">
        <button
          mat-raised-button
          [disabled]="!canCreate"
          (click)="onSubmit()"
          class="create-btn"
        >
          <mat-icon>{{ isEditMode ? 'save' : 'group_add' }}</mat-icon>
          {{ isEditMode ? 'Save Changes' : 'Create Group' }} ({{ selectedContacts.length + 1 }} members)
        </button>
        <button
          *ngIf="isEditMode"
          mat-stroked-button
          class="delete-btn"
          (click)="onDelete()"
        >
          <mat-icon>delete</mat-icon>
          Delete Group
        </button>
      </div>
    </div>
  `, styles: [".group-manager{display:flex;flex-direction:column;height:100%}.header{display:flex;align-items:center;padding:12px 8px 12px 4px;border-bottom:1px solid rgba(255,255,255,.15);gap:4px}.header h3{margin:0;font-size:18px;font-weight:600;color:#fff}.hdr-btn{border-radius:6px!important;transition:background .15s,box-shadow .15s}.hdr-btn:hover{background:#ffffff26!important;box-shadow:0 2px 8px #0003}.hdr-btn mat-icon{color:#fffc}.form-section{padding:12px 16px 0}.field-label{display:block;font-size:12px;font-weight:600;color:#ffffffb3;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px}.text-field{width:100%;padding:10px 12px;border:1px solid rgba(255,255,255,.25);border-radius:8px;font-size:14px;color:#fff;background:#ffffff1a;outline:none;transition:border-color .2s;box-sizing:border-box}.text-field:focus{border-color:#ffffff80}.text-field::placeholder{color:#ffffff80}.search-bar{display:flex;align-items:center;padding:8px 12px;background:#ffffff1a;border-radius:10px}.search-icon{color:#fff9;font-size:20px;width:20px;height:20px;margin-right:8px}.search-input{flex:1;border:none;outline:none;background:transparent;font-size:14px;color:#fff}.search-input::placeholder{color:#ffffff80}.selected-chips{display:flex;flex-wrap:wrap;gap:6px;padding:8px 16px}.chip{display:flex;align-items:center;background:#fff3;color:#fff;border-radius:16px;padding:4px 6px 4px 12px;font-size:12px;font-weight:500}.chip-remove{width:20px!important;height:20px!important;line-height:20px!important}.chip-remove mat-icon{font-size:14px;width:14px;height:14px;color:#fffc}.contacts-list{flex:1;overflow-y:auto;padding-top:4px}.contact-item{display:flex;align-items:center;padding:10px 16px;cursor:pointer;transition:background .15s;gap:12px}.contact-item:hover{background:#ffffff14}.contact-item.selected{background:#ffffff26}.contact-avatar{width:36px;height:36px;border-radius:50%;background:#fff3;display:flex;align-items:center;justify-content:center;flex-shrink:0}.contact-avatar mat-icon{color:#fff;font-size:20px}.contact-info{flex:1;display:flex;flex-direction:column}.contact-name{font-weight:500;font-size:14px;color:#fff}.contact-company{font-size:12px;color:#fff9}.check-icon{color:#22c55e;font-size:22px}.action-bar{padding:12px 16px;border-top:1px solid rgba(255,255,255,.1);display:flex;flex-direction:column;gap:8px}.create-btn{width:100%;background:#fff3!important;color:#fff!important;border-radius:10px;font-weight:600}.create-btn:disabled{opacity:.5}.create-btn mat-icon{margin-right:8px}.delete-btn{width:100%;color:#f87171!important;border-color:#f8717166!important;border-radius:10px;font-weight:600}.delete-btn mat-icon{margin-right:8px}\n"] }]
        }], ctorParameters: () => [{ type: i1.MessagingStoreService }] });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ3JvdXAtbWFuYWdlci5jb21wb25lbnQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvbGliL2NvbXBvbmVudHMvZ3JvdXAtbWFuYWdlci9ncm91cC1tYW5hZ2VyLmNvbXBvbmVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsU0FBUyxFQUFxQixNQUFNLGVBQWUsQ0FBQztBQUM3RCxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDL0MsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLGdCQUFnQixDQUFDO0FBQzdDLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSx3QkFBd0IsQ0FBQztBQUN2RCxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFDM0QsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHdCQUF3QixDQUFDO0FBQ3pELE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBRzdELE9BQU8sRUFBVyxxQkFBcUIsRUFBRSxNQUFNLCtCQUErQixDQUFDOzs7Ozs7Ozs7QUE2VC9FLE1BQU0sT0FBTyxxQkFBcUI7SUFVWjtJQVRwQixRQUFRLEdBQWMsRUFBRSxDQUFDO0lBQ3pCLGdCQUFnQixHQUFjLEVBQUUsQ0FBQztJQUNqQyxTQUFTLEdBQUcsRUFBRSxDQUFDO0lBQ2YsV0FBVyxHQUFHLEVBQUUsQ0FBQztJQUNqQixVQUFVLEdBQUcsS0FBSyxDQUFDO0lBQ25CLHFCQUFxQixHQUFrQixJQUFJLENBQUM7SUFDNUMsZ0JBQWdCLEdBQWtCLElBQUksQ0FBQztJQUMvQixHQUFHLENBQWdCO0lBRTNCLFlBQW9CLEtBQTRCO1FBQTVCLFVBQUssR0FBTCxLQUFLLENBQXVCO0lBQUcsQ0FBQztJQUVwRCxRQUFRO1FBQ04sSUFBSSxDQUFDLEtBQUssQ0FBQyxtQkFBbUIsRUFBRSxDQUFDO1FBQ2pDLElBQUksQ0FBQyxHQUFHLEdBQUcs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LEVBQUUsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUM7WUFDM0QsSUFBSSxDQUFDLEtBQUssQ0FBQyx1QkFBdUIsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBQ2pFLENBQUM7UUFDRCxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7SUFDaEIsQ0FBQztJQUVELFFBQVE7UUFDTixJQUFJLElBQUksQ0FBQyxxQkFBcUIsRUFBRSxDQUFDO1lBQy9CLElBQUksQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDO1lBQ25ELElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztRQUNoQixDQUFDO0lBQ0gsQ0FBQztJQUVELE1BQU07UUFDSixJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUM5QixDQUFDO3dHQW5GVSxxQkFBcUI7NEZBQXJCLHFCQUFxQiw2RUF2VHRCOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7R0FpRlQsaXJGQWxGUyxZQUFZLCtQQUFFLFdBQVcsOG1CQUFFLGFBQWEsbUxBQUUsZUFBZSx3VUFBRSxlQUFlLGtTQUFFLGdCQUFnQjs7NEZBd1QzRixxQkFBcUI7a0JBM1RqQyxTQUFTOytCQUNFLG1CQUFtQixjQUNqQixJQUFJLFdBQ1AsQ0FBQyxZQUFZLEVBQUUsV0FBVyxFQUFFLGFBQWEsRUFBRSxlQUFlLEVBQUUsZUFBZSxFQUFFLGdCQUFnQixDQUFDLFlBQzdGOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7R0FpRlQiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBDb21wb25lbnQsIE9uSW5pdCwgT25EZXN0cm95IH0gZnJvbSAnQGFuZ3VsYXIvY29yZSc7XG5pbXBvcnQgeyBDb21tb25Nb2R1bGUgfSBmcm9tICdAYW5ndWxhci9jb21tb24nO1xuaW1wb3J0IHsgRm9ybXNNb2R1bGUgfSBmcm9tICdAYW5ndWxhci9mb3Jtcyc7XG5pbXBvcnQgeyBNYXRJY29uTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvbWF0ZXJpYWwvaWNvbic7XG5pbXBvcnQgeyBNYXRCdXR0b25Nb2R1bGUgfSBmcm9tICdAYW5ndWxhci9tYXRlcmlhbC9idXR0b24nO1xuaW1wb3J0IHsgTWF0UmlwcGxlTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvbWF0ZXJpYWwvY29yZSc7XG5pbXBvcnQgeyBNYXRUb29sdGlwTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvbWF0ZXJpYWwvdG9vbHRpcCc7XG5pbXBvcnQgeyBTdWJzY3JpcHRpb24gfSBmcm9tICdyeGpzJztcbmltcG9ydCB7IE1lc3NhZ2luZ1N0b3JlU2VydmljZSB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL21lc3NhZ2luZy1zdG9yZS5zZXJ2aWNlJztcbmltcG9ydCB7IENvbnRhY3QsIGdldENvbnRhY3REaXNwbGF5TmFtZSB9IGZyb20gJy4uLy4uL21vZGVscy9tZXNzYWdpbmcubW9kZWxzJztcblxuQENvbXBvbmVudCh7XG4gIHNlbGVjdG9yOiAnYXBwLWdyb3VwLW1hbmFnZXInLFxuICBzdGFuZGFsb25lOiB0cnVlLFxuICBpbXBvcnRzOiBbQ29tbW9uTW9kdWxlLCBGb3Jtc01vZHVsZSwgTWF0SWNvbk1vZHVsZSwgTWF0QnV0dG9uTW9kdWxlLCBNYXRSaXBwbGVNb2R1bGUsIE1hdFRvb2x0aXBNb2R1bGVdLFxuICB0ZW1wbGF0ZTogYFxuICAgIDxkaXYgY2xhc3M9XCJncm91cC1tYW5hZ2VyXCI+XG4gICAgICA8ZGl2IGNsYXNzPVwiaGVhZGVyXCI+XG4gICAgICAgIDxidXR0b24gbWF0LWljb24tYnV0dG9uIGNsYXNzPVwiaGRyLWJ0blwiIChjbGljayk9XCJnb0JhY2soKVwiIG1hdFRvb2x0aXA9XCJCYWNrXCIgbWF0VG9vbHRpcFBvc2l0aW9uPVwiYmVsb3dcIj5cbiAgICAgICAgICA8bWF0LWljb24+YXJyb3dfYmFjazwvbWF0LWljb24+XG4gICAgICAgIDwvYnV0dG9uPlxuICAgICAgICA8aDM+e3sgaXNFZGl0TW9kZSA/ICdFZGl0IEdyb3VwJyA6ICdDcmVhdGUgR3JvdXAnIH19PC9oMz5cbiAgICAgIDwvZGl2PlxuXG4gICAgICA8ZGl2IGNsYXNzPVwiZm9ybS1zZWN0aW9uXCI+XG4gICAgICAgIDxsYWJlbCBjbGFzcz1cImZpZWxkLWxhYmVsXCI+R3JvdXAgTmFtZTwvbGFiZWw+XG4gICAgICAgIDxpbnB1dFxuICAgICAgICAgIHR5cGU9XCJ0ZXh0XCJcbiAgICAgICAgICBbKG5nTW9kZWwpXT1cImdyb3VwTmFtZVwiXG4gICAgICAgICAgcGxhY2Vob2xkZXI9XCJFbnRlciBncm91cCBuYW1lLi4uXCJcbiAgICAgICAgICBjbGFzcz1cInRleHQtZmllbGRcIlxuICAgICAgICAvPlxuICAgICAgPC9kaXY+XG5cbiAgICAgIDxkaXYgY2xhc3M9XCJmb3JtLXNlY3Rpb25cIj5cbiAgICAgICAgPGxhYmVsIGNsYXNzPVwiZmllbGQtbGFiZWxcIj5NZW1iZXJzIChtaW4gMiBpbmNsdWRpbmcgeW91KTwvbGFiZWw+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJzZWFyY2gtYmFyXCI+XG4gICAgICAgICAgPG1hdC1pY29uIGNsYXNzPVwic2VhcmNoLWljb25cIj5zZWFyY2g8L21hdC1pY29uPlxuICAgICAgICAgIDxpbnB1dFxuICAgICAgICAgICAgdHlwZT1cInRleHRcIlxuICAgICAgICAgICAgWyhuZ01vZGVsKV09XCJzZWFyY2hRdWVyeVwiXG4gICAgICAgICAgICBwbGFjZWhvbGRlcj1cIlNlYXJjaCBjb250YWN0cy4uLlwiXG4gICAgICAgICAgICBjbGFzcz1cInNlYXJjaC1pbnB1dFwiXG4gICAgICAgICAgLz5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cblxuICAgICAgPGRpdiAqbmdJZj1cInNlbGVjdGVkQ29udGFjdHMubGVuZ3RoID4gMFwiIGNsYXNzPVwic2VsZWN0ZWQtY2hpcHNcIj5cbiAgICAgICAgPGRpdiAqbmdGb3I9XCJsZXQgYyBvZiBzZWxlY3RlZENvbnRhY3RzXCIgY2xhc3M9XCJjaGlwXCI+XG4gICAgICAgICAgPHNwYW4+e3sgZ2V0RGlzcGxheU5hbWUoYykgfX08L3NwYW4+XG4gICAgICAgICAgPGJ1dHRvbiBtYXQtaWNvbi1idXR0b24gY2xhc3M9XCJjaGlwLXJlbW92ZVwiIChjbGljayk9XCJyZW1vdmVDb250YWN0KGMpXCIgW2Rpc2FibGVkXT1cImlzQ3JlYXRvcihjKVwiPlxuICAgICAgICAgICAgPG1hdC1pY29uPnt7IGlzQ3JlYXRvcihjKSA/ICdzdGFyJyA6ICdjbG9zZScgfX08L21hdC1pY29uPlxuICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuXG4gICAgICA8ZGl2IGNsYXNzPVwiY29udGFjdHMtbGlzdFwiPlxuICAgICAgICA8ZGl2XG4gICAgICAgICAgKm5nRm9yPVwibGV0IGNvbnRhY3Qgb2YgZmlsdGVyZWRDb250YWN0c1wiXG4gICAgICAgICAgY2xhc3M9XCJjb250YWN0LWl0ZW1cIlxuICAgICAgICAgIG1hdFJpcHBsZVxuICAgICAgICAgIFtjbGFzcy5zZWxlY3RlZF09XCJpc1NlbGVjdGVkKGNvbnRhY3QpXCJcbiAgICAgICAgICAoY2xpY2spPVwidG9nZ2xlQ29udGFjdChjb250YWN0KVwiXG4gICAgICAgID5cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwiY29udGFjdC1hdmF0YXJcIj5cbiAgICAgICAgICAgIDxtYXQtaWNvbj5wZXJzb248L21hdC1pY29uPlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJjb250YWN0LWluZm9cIj5cbiAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwiY29udGFjdC1uYW1lXCI+e3sgZ2V0RGlzcGxheU5hbWUoY29udGFjdCkgfX08L3NwYW4+XG4gICAgICAgICAgICA8c3BhbiBjbGFzcz1cImNvbnRhY3QtY29tcGFueVwiPnt7IGNvbnRhY3QuY29tcGFueV9uYW1lIH19PC9zcGFuPlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDxtYXQtaWNvbiAqbmdJZj1cImlzU2VsZWN0ZWQoY29udGFjdClcIiBjbGFzcz1cImNoZWNrLWljb25cIj5jaGVja19jaXJjbGU8L21hdC1pY29uPlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuXG4gICAgICA8ZGl2IGNsYXNzPVwiYWN0aW9uLWJhclwiPlxuICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgbWF0LXJhaXNlZC1idXR0b25cbiAgICAgICAgICBbZGlzYWJsZWRdPVwiIWNhbkNyZWF0ZVwiXG4gICAgICAgICAgKGNsaWNrKT1cIm9uU3VibWl0KClcIlxuICAgICAgICAgIGNsYXNzPVwiY3JlYXRlLWJ0blwiXG4gICAgICAgID5cbiAgICAgICAgICA8bWF0LWljb24+e3sgaXNFZGl0TW9kZSA/ICdzYXZlJyA6ICdncm91cF9hZGQnIH19PC9tYXQtaWNvbj5cbiAgICAgICAgICB7eyBpc0VkaXRNb2RlID8gJ1NhdmUgQ2hhbmdlcycgOiAnQ3JlYXRlIEdyb3VwJyB9fSAoe3sgc2VsZWN0ZWRDb250YWN0cy5sZW5ndGggKyAxIH19IG1lbWJlcnMpXG4gICAgICAgIDwvYnV0dG9uPlxuICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgKm5nSWY9XCJpc0VkaXRNb2RlXCJcbiAgICAgICAgICBtYXQtc3Ryb2tlZC1idXR0b25cbiAgICAgICAgICBjbGFzcz1cImRlbGV0ZS1idG5cIlxuICAgICAgICAgIChjbGljayk9XCJvbkRlbGV0ZSgpXCJcbiAgICAgICAgPlxuICAgICAgICAgIDxtYXQtaWNvbj5kZWxldGU8L21hdC1pY29uPlxuICAgICAgICAgIERlbGV0ZSBHcm91cFxuICAgICAgICA8L2J1dHRvbj5cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuICBgLFxuICBzdHlsZXM6IFtgXG4gICAgLmdyb3VwLW1hbmFnZXIge1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAgICBoZWlnaHQ6IDEwMCU7XG4gICAgfVxuXG4gICAgLmhlYWRlciB7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIHBhZGRpbmc6IDEycHggOHB4IDEycHggNHB4O1xuICAgICAgYm9yZGVyLWJvdHRvbTogMXB4IHNvbGlkIHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xNSk7XG4gICAgICBnYXA6IDRweDtcbiAgICB9XG5cbiAgICAuaGVhZGVyIGgzIHtcbiAgICAgIG1hcmdpbjogMDtcbiAgICAgIGZvbnQtc2l6ZTogMThweDtcbiAgICAgIGZvbnQtd2VpZ2h0OiA2MDA7XG4gICAgICBjb2xvcjogI2ZmZjtcbiAgICB9XG5cbiAgICAuaGRyLWJ0biB7XG4gICAgICBib3JkZXItcmFkaXVzOiA2cHggIWltcG9ydGFudDtcbiAgICAgIHRyYW5zaXRpb246IGJhY2tncm91bmQgMC4xNXMsIGJveC1zaGFkb3cgMC4xNXM7XG4gICAgfVxuXG4gICAgLmhkci1idG46aG92ZXIge1xuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjE1KSAhaW1wb3J0YW50O1xuICAgICAgYm94LXNoYWRvdzogMCAycHggOHB4IHJnYmEoMCwgMCwgMCwgMC4yKTtcbiAgICB9XG5cbiAgICAuaGRyLWJ0biBtYXQtaWNvbiB7XG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjgpO1xuICAgIH1cblxuICAgIC5mb3JtLXNlY3Rpb24ge1xuICAgICAgcGFkZGluZzogMTJweCAxNnB4IDA7XG4gICAgfVxuXG4gICAgLmZpZWxkLWxhYmVsIHtcbiAgICAgIGRpc3BsYXk6IGJsb2NrO1xuICAgICAgZm9udC1zaXplOiAxMnB4O1xuICAgICAgZm9udC13ZWlnaHQ6IDYwMDtcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNyk7XG4gICAgICB0ZXh0LXRyYW5zZm9ybTogdXBwZXJjYXNlO1xuICAgICAgbGV0dGVyLXNwYWNpbmc6IDAuMDVlbTtcbiAgICAgIG1hcmdpbi1ib3R0b206IDZweDtcbiAgICB9XG5cbiAgICAudGV4dC1maWVsZCB7XG4gICAgICB3aWR0aDogMTAwJTtcbiAgICAgIHBhZGRpbmc6IDEwcHggMTJweDtcbiAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4yNSk7XG4gICAgICBib3JkZXItcmFkaXVzOiA4cHg7XG4gICAgICBmb250LXNpemU6IDE0cHg7XG4gICAgICBjb2xvcjogI2ZmZjtcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xKTtcbiAgICAgIG91dGxpbmU6IG5vbmU7XG4gICAgICB0cmFuc2l0aW9uOiBib3JkZXItY29sb3IgMC4ycztcbiAgICAgIGJveC1zaXppbmc6IGJvcmRlci1ib3g7XG4gICAgfVxuXG4gICAgLnRleHQtZmllbGQ6Zm9jdXMge1xuICAgICAgYm9yZGVyLWNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNSk7XG4gICAgfVxuXG4gICAgLnRleHQtZmllbGQ6OnBsYWNlaG9sZGVyIHtcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNSk7XG4gICAgfVxuXG4gICAgLnNlYXJjaC1iYXIge1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBwYWRkaW5nOiA4cHggMTJweDtcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xKTtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDEwcHg7XG4gICAgfVxuXG4gICAgLnNlYXJjaC1pY29uIHtcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNik7XG4gICAgICBmb250LXNpemU6IDIwcHg7XG4gICAgICB3aWR0aDogMjBweDtcbiAgICAgIGhlaWdodDogMjBweDtcbiAgICAgIG1hcmdpbi1yaWdodDogOHB4O1xuICAgIH1cblxuICAgIC5zZWFyY2gtaW5wdXQge1xuICAgICAgZmxleDogMTtcbiAgICAgIGJvcmRlcjogbm9uZTtcbiAgICAgIG91dGxpbmU6IG5vbmU7XG4gICAgICBiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudDtcbiAgICAgIGZvbnQtc2l6ZTogMTRweDtcbiAgICAgIGNvbG9yOiAjZmZmO1xuICAgIH1cblxuICAgIC5zZWFyY2gtaW5wdXQ6OnBsYWNlaG9sZGVyIHtcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNSk7XG4gICAgfVxuXG4gICAgLnNlbGVjdGVkLWNoaXBzIHtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBmbGV4LXdyYXA6IHdyYXA7XG4gICAgICBnYXA6IDZweDtcbiAgICAgIHBhZGRpbmc6IDhweCAxNnB4O1xuICAgIH1cblxuICAgIC5jaGlwIHtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjIpO1xuICAgICAgY29sb3I6ICNmZmY7XG4gICAgICBib3JkZXItcmFkaXVzOiAxNnB4O1xuICAgICAgcGFkZGluZzogNHB4IDZweCA0cHggMTJweDtcbiAgICAgIGZvbnQtc2l6ZTogMTJweDtcbiAgICAgIGZvbnQtd2VpZ2h0OiA1MDA7XG4gICAgfVxuXG4gICAgLmNoaXAtcmVtb3ZlIHtcbiAgICAgIHdpZHRoOiAyMHB4ICFpbXBvcnRhbnQ7XG4gICAgICBoZWlnaHQ6IDIwcHggIWltcG9ydGFudDtcbiAgICAgIGxpbmUtaGVpZ2h0OiAyMHB4ICFpbXBvcnRhbnQ7XG4gICAgfVxuXG4gICAgLmNoaXAtcmVtb3ZlIG1hdC1pY29uIHtcbiAgICAgIGZvbnQtc2l6ZTogMTRweDtcbiAgICAgIHdpZHRoOiAxNHB4O1xuICAgICAgaGVpZ2h0OiAxNHB4O1xuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC44KTtcbiAgICB9XG5cbiAgICAuY29udGFjdHMtbGlzdCB7XG4gICAgICBmbGV4OiAxO1xuICAgICAgb3ZlcmZsb3cteTogYXV0bztcbiAgICAgIHBhZGRpbmctdG9wOiA0cHg7XG4gICAgfVxuXG4gICAgLmNvbnRhY3QtaXRlbSB7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIHBhZGRpbmc6IDEwcHggMTZweDtcbiAgICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgICAgIHRyYW5zaXRpb246IGJhY2tncm91bmQgMC4xNXM7XG4gICAgICBnYXA6IDEycHg7XG4gICAgfVxuXG4gICAgLmNvbnRhY3QtaXRlbTpob3ZlciB7XG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMDgpO1xuICAgIH1cblxuICAgIC5jb250YWN0LWl0ZW0uc2VsZWN0ZWQge1xuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjE1KTtcbiAgICB9XG5cbiAgICAuY29udGFjdC1hdmF0YXIge1xuICAgICAgd2lkdGg6IDM2cHg7XG4gICAgICBoZWlnaHQ6IDM2cHg7XG4gICAgICBib3JkZXItcmFkaXVzOiA1MCU7XG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMik7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgICAgZmxleC1zaHJpbms6IDA7XG4gICAgfVxuXG4gICAgLmNvbnRhY3QtYXZhdGFyIG1hdC1pY29uIHtcbiAgICAgIGNvbG9yOiAjZmZmO1xuICAgICAgZm9udC1zaXplOiAyMHB4O1xuICAgIH1cblxuICAgIC5jb250YWN0LWluZm8ge1xuICAgICAgZmxleDogMTtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgIH1cblxuICAgIC5jb250YWN0LW5hbWUge1xuICAgICAgZm9udC13ZWlnaHQ6IDUwMDtcbiAgICAgIGZvbnQtc2l6ZTogMTRweDtcbiAgICAgIGNvbG9yOiAjZmZmO1xuICAgIH1cblxuICAgIC5jb250YWN0LWNvbXBhbnkge1xuICAgICAgZm9udC1zaXplOiAxMnB4O1xuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC42KTtcbiAgICB9XG5cbiAgICAuY2hlY2staWNvbiB7XG4gICAgICBjb2xvcjogIzIyYzU1ZTtcbiAgICAgIGZvbnQtc2l6ZTogMjJweDtcbiAgICB9XG5cbiAgICAuYWN0aW9uLWJhciB7XG4gICAgICBwYWRkaW5nOiAxMnB4IDE2cHg7XG4gICAgICBib3JkZXItdG9wOiAxcHggc29saWQgcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjEpO1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAgICBnYXA6IDhweDtcbiAgICB9XG5cbiAgICAuY3JlYXRlLWJ0biB7XG4gICAgICB3aWR0aDogMTAwJTtcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4yKSAhaW1wb3J0YW50O1xuICAgICAgY29sb3I6ICNmZmYgIWltcG9ydGFudDtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDEwcHg7XG4gICAgICBmb250LXdlaWdodDogNjAwO1xuICAgIH1cblxuICAgIC5jcmVhdGUtYnRuOmRpc2FibGVkIHtcbiAgICAgIG9wYWNpdHk6IDAuNTtcbiAgICB9XG5cbiAgICAuY3JlYXRlLWJ0biBtYXQtaWNvbiB7XG4gICAgICBtYXJnaW4tcmlnaHQ6IDhweDtcbiAgICB9XG5cbiAgICAuZGVsZXRlLWJ0biB7XG4gICAgICB3aWR0aDogMTAwJTtcbiAgICAgIGNvbG9yOiAjZjg3MTcxICFpbXBvcnRhbnQ7XG4gICAgICBib3JkZXItY29sb3I6IHJnYmEoMjQ4LCAxMTMsIDExMywgMC40KSAhaW1wb3J0YW50O1xuICAgICAgYm9yZGVyLXJhZGl1czogMTBweDtcbiAgICAgIGZvbnQtd2VpZ2h0OiA2MDA7XG4gICAgfVxuXG4gICAgLmRlbGV0ZS1idG4gbWF0LWljb24ge1xuICAgICAgbWFyZ2luLXJpZ2h0OiA4cHg7XG4gICAgfVxuICBgXSxcbn0pXG5leHBvcnQgY2xhc3MgR3JvdXBNYW5hZ2VyQ29tcG9uZW50IGltcGxlbWVudHMgT25Jbml0LCBPbkRlc3Ryb3kge1xuICBjb250YWN0czogQ29udGFjdFtdID0gW107XG4gIHNlbGVjdGVkQ29udGFjdHM6IENvbnRhY3RbXSA9IFtdO1xuICBncm91cE5hbWUgPSAnJztcbiAgc2VhcmNoUXVlcnkgPSAnJztcbiAgaXNFZGl0TW9kZSA9IGZhbHNlO1xuICBlZGl0aW5nQ29udmVyc2F0aW9uSWQ6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuICBjcmVhdG9yQ29udGFjdElkOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBzdWIhOiBTdWJzY3JpcHRpb247XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSBzdG9yZTogTWVzc2FnaW5nU3RvcmVTZXJ2aWNlKSB7fVxuXG4gIG5nT25Jbml0KCk6IHZvaWQge1xuICAgIHRoaXMuc3RvcmUubG9hZFZpc2libGVDb250YWN0cygpO1xuICAgIHRoaXMuc3ViID0gdGhpcy5zdG9yZS52aXNpYmxlQ29udGFjdHMuc3Vic2NyaWJlKChjKSA9PiAodGhpcy5jb250YWN0cyA9IGMpKTtcbiAgfVxuXG4gIG5nT25EZXN0cm95KCk6IHZvaWQge1xuICAgIHRoaXMuc3ViPy51bnN1YnNjcmliZSgpO1xuICB9XG5cbiAgZ2V0IGZpbHRlcmVkQ29udGFjdHMoKTogQ29udGFjdFtdIHtcbiAgICBpZiAoIXRoaXMuc2VhcmNoUXVlcnkudHJpbSgpKSByZXR1cm4gdGhpcy5jb250YWN0cztcbiAgICBjb25zdCBxID0gdGhpcy5zZWFyY2hRdWVyeS50b0xvd2VyQ2FzZSgpO1xuICAgIHJldHVybiB0aGlzLmNvbnRhY3RzLmZpbHRlcihcbiAgICAgIChjKSA9PlxuICAgICAgICB0aGlzLmdldERpc3BsYXlOYW1lKGMpLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMocSkgfHxcbiAgICAgICAgKGMuY29tcGFueV9uYW1lIHx8ICcnKS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKHEpXG4gICAgKTtcbiAgfVxuXG4gIGdldERpc3BsYXlOYW1lKGNvbnRhY3Q6IENvbnRhY3QpOiBzdHJpbmcge1xuICAgIHJldHVybiBnZXRDb250YWN0RGlzcGxheU5hbWUoY29udGFjdCk7XG4gIH1cblxuICBnZXQgY2FuQ3JlYXRlKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLmdyb3VwTmFtZS50cmltKCkubGVuZ3RoID4gMCAmJiB0aGlzLnNlbGVjdGVkQ29udGFjdHMubGVuZ3RoID49IDE7XG4gIH1cblxuICBpc1NlbGVjdGVkKGNvbnRhY3Q6IENvbnRhY3QpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy5zZWxlY3RlZENvbnRhY3RzLnNvbWUoKGMpID0+IGMuY29udGFjdF9pZCA9PT0gY29udGFjdC5jb250YWN0X2lkKTtcbiAgfVxuXG4gIGlzQ3JlYXRvcihjb250YWN0OiBDb250YWN0KTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGNvbnRhY3QuY29udGFjdF9pZCA9PT0gdGhpcy5jcmVhdG9yQ29udGFjdElkO1xuICB9XG5cbiAgdG9nZ2xlQ29udGFjdChjb250YWN0OiBDb250YWN0KTogdm9pZCB7XG4gICAgaWYgKHRoaXMuaXNDcmVhdG9yKGNvbnRhY3QpKSByZXR1cm47XG4gICAgaWYgKHRoaXMuaXNTZWxlY3RlZChjb250YWN0KSkge1xuICAgICAgdGhpcy5yZW1vdmVDb250YWN0KGNvbnRhY3QpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnNlbGVjdGVkQ29udGFjdHMgPSBbLi4udGhpcy5zZWxlY3RlZENvbnRhY3RzLCBjb250YWN0XTtcbiAgICB9XG4gIH1cblxuICByZW1vdmVDb250YWN0KGNvbnRhY3Q6IENvbnRhY3QpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5pc0NyZWF0b3IoY29udGFjdCkpIHJldHVybjtcbiAgICB0aGlzLnNlbGVjdGVkQ29udGFjdHMgPSB0aGlzLnNlbGVjdGVkQ29udGFjdHMuZmlsdGVyKFxuICAgICAgKGMpID0+IGMuY29udGFjdF9pZCAhPT0gY29udGFjdC5jb250YWN0X2lkXG4gICAgKTtcbiAgfVxuXG4gIG9uU3VibWl0KCk6IHZvaWQge1xuICAgIGlmICghdGhpcy5jYW5DcmVhdGUpIHJldHVybjtcbiAgICBpZiAodGhpcy5pc0VkaXRNb2RlICYmIHRoaXMuZWRpdGluZ0NvbnZlcnNhdGlvbklkKSB7XG4gICAgICB0aGlzLnN0b3JlLm1hbmFnZUdyb3VwKCdyZW5hbWUnLCB0aGlzLmVkaXRpbmdDb252ZXJzYXRpb25JZCwgdGhpcy5ncm91cE5hbWUudHJpbSgpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgaWRzID0gdGhpcy5zZWxlY3RlZENvbnRhY3RzLm1hcCgoYykgPT4gYy5jb250YWN0X2lkKTtcbiAgICAgIHRoaXMuc3RvcmUuY3JlYXRlR3JvdXBDb252ZXJzYXRpb24oaWRzLCB0aGlzLmdyb3VwTmFtZS50cmltKCkpO1xuICAgIH1cbiAgICB0aGlzLmdvQmFjaygpO1xuICB9XG5cbiAgb25EZWxldGUoKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuZWRpdGluZ0NvbnZlcnNhdGlvbklkKSB7XG4gICAgICB0aGlzLnN0b3JlLmRlbGV0ZUdyb3VwKHRoaXMuZWRpdGluZ0NvbnZlcnNhdGlvbklkKTtcbiAgICAgIHRoaXMuZ29CYWNrKCk7XG4gICAgfVxuICB9XG5cbiAgZ29CYWNrKCk6IHZvaWQge1xuICAgIHRoaXMuc3RvcmUuc2V0VmlldygnaW5ib3gnKTtcbiAgfVxufVxuIl19