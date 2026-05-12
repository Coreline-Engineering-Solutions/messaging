import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatRippleModule } from '@angular/material/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { getContactDisplayName } from '../../models/messaging.models';
import * as i0 from "@angular/core";
import * as i1 from "../../services/messaging-store.service";
import * as i2 from "../../services/messaging-api.service";
import * as i3 from "../../services/auth.service";
import * as i4 from "@angular/common";
import * as i5 from "@angular/forms";
import * as i6 from "@angular/material/icon";
import * as i7 from "@angular/material/button";
import * as i8 from "@angular/material/core";
import * as i9 from "@angular/material/tooltip";
import * as i10 from "@angular/material/progress-spinner";
export class GroupManagerComponent {
    store;
    api;
    auth;
    contacts = [];
    selectedContacts = [];
    currentMembers = [];
    groupName = '';
    originalGroupName = '';
    searchQuery = '';
    isEditMode = false;
    editingConversationId = null;
    creatorContactId = null;
    loadingMembers = false;
    subs = [];
    constructor(store, api, auth) {
        this.store = store;
        this.api = api;
        this.auth = auth;
    }
    ngOnInit() {
        this.creatorContactId = this.auth.contactId;
        this.store.loadVisibleContacts();
        this.subs.push(this.store.visibleContacts.subscribe((c) => (this.contacts = c)));
        this.subs.push(this.store.groupSettings.subscribe((settings) => {
            if (settings) {
                this.isEditMode = true;
                this.editingConversationId = settings.conversationId;
                this.groupName = settings.name;
                this.originalGroupName = settings.name;
                this.selectedContacts = [];
                this.loadCurrentMembers(settings.conversationId);
            }
            else {
                this.isEditMode = false;
                this.editingConversationId = null;
                this.groupName = '';
                this.originalGroupName = '';
                this.selectedContacts = [];
                this.currentMembers = [];
            }
        }));
    }
    ngOnDestroy() {
        this.subs.forEach((s) => s.unsubscribe());
    }
    loadCurrentMembers(conversationId) {
        this.loadingMembers = true;
        this.api.getConversationParticipants(conversationId).subscribe({
            next: (members) => {
                this.currentMembers = members;
                this.loadingMembers = false;
            },
            error: () => {
                this.loadingMembers = false;
            },
        });
    }
    get filteredContacts() {
        const alreadyInGroup = new Set(this.currentMembers.map((m) => m.contact_id));
        let list = this.contacts.filter((c) => c.contact_id !== this.creatorContactId && !alreadyInGroup.has(c.contact_id));
        if (this.searchQuery.trim()) {
            const q = this.searchQuery.toLowerCase();
            list = list.filter((c) => this.getDisplayName(c).toLowerCase().includes(q) ||
                (c.company_name || '').toLowerCase().includes(q));
        }
        return list;
    }
    getDisplayName(contact) {
        return getContactDisplayName(contact);
    }
    getMemberName(member) {
        return member.username || member.email || `Contact ${member.contact_id}`;
    }
    get canSubmit() {
        if (!this.groupName.trim())
            return false;
        if (this.isEditMode) {
            return this.groupName.trim() !== this.originalGroupName || this.selectedContacts.length > 0;
        }
        return this.selectedContacts.length >= 1;
    }
    isSelected(contact) {
        return this.selectedContacts.some((c) => c.contact_id === contact.contact_id);
    }
    toggleContact(contact) {
        if (this.isSelected(contact)) {
            this.removeContact(contact);
        }
        else {
            this.selectedContacts = [...this.selectedContacts, contact];
        }
    }
    removeContact(contact) {
        this.selectedContacts = this.selectedContacts.filter((c) => c.contact_id !== contact.contact_id);
    }
    removeMember(member) {
        if (!this.editingConversationId)
            return;
        if (confirm(`Remove ${this.getMemberName(member)} from this group?`)) {
            this.store.manageGroup('remove', this.editingConversationId, undefined, [member.contact_id]);
            this.currentMembers = this.currentMembers.filter(m => m.contact_id !== member.contact_id);
        }
    }
    onSubmit() {
        if (!this.canSubmit)
            return;
        if (this.isEditMode && this.editingConversationId) {
            if (this.groupName.trim() !== this.originalGroupName) {
                this.store.manageGroup('rename', this.editingConversationId, this.groupName.trim());
            }
            if (this.selectedContacts.length > 0) {
                const ids = this.selectedContacts.map((c) => c.contact_id);
                this.store.manageGroup('add', this.editingConversationId, undefined, ids);
            }
            this.store.clearGroupSettings();
            this.store.setView('chat');
        }
        else {
            const ids = this.selectedContacts.map((c) => c.contact_id);
            this.store.createGroupConversation(ids, this.groupName.trim());
            this.store.setView('chat');
        }
    }
    onDelete() {
        if (this.editingConversationId) {
            this.store.deleteGroup(this.editingConversationId);
            this.store.clearGroupSettings();
            this.goBack();
        }
    }
    goBack() {
        if (this.isEditMode) {
            this.store.clearGroupSettings();
            this.store.setView('chat');
        }
        else {
            this.store.setView('inbox');
        }
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: GroupManagerComponent, deps: [{ token: i1.MessagingStoreService }, { token: i2.MessagingApiService }, { token: i3.AuthService }], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "17.3.12", type: GroupManagerComponent, isStandalone: true, selector: "app-group-manager", ngImport: i0, template: `
    <div class="group-manager">
      <div class="header">
        <button mat-icon-button class="hdr-btn" (click)="goBack()" matTooltip="Back" matTooltipPosition="below">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <h3>{{ isEditMode ? 'Group Settings' : 'Create Group' }}</h3>
      </div>

      <div class="scrollable">
        <div class="form-section">
          <label class="field-label">Group Name</label>
          <input
            type="text"
            [(ngModel)]="groupName"
            placeholder="Enter group name..."
            class="text-field"
          />
        </div>

        <ng-container *ngIf="isEditMode">
          <div class="form-section section-gap">
            <label class="field-label">Current Members</label>
            <div *ngIf="loadingMembers" class="loading-row">
              <mat-spinner diameter="18"></mat-spinner>
              <span>Loading members...</span>
            </div>
            <div *ngIf="!loadingMembers" class="members-list">
              <div *ngFor="let m of currentMembers" class="member-row">
                <div class="member-avatar"><mat-icon>person</mat-icon></div>
                <div class="member-info">
                  <span class="member-name">{{ getMemberName(m) }}{{ m.contact_id === creatorContactId ? ' (you)' : '' }}</span>
                  <span class="member-sub">{{ m.company || m.email }}</span>
                </div>
                <button 
                  *ngIf="m.contact_id !== creatorContactId" 
                  mat-icon-button 
                  class="remove-member-btn"
                  (click)="removeMember(m)"
                  matTooltip="Remove from group"
                  matTooltipPosition="left"
                >
                  <mat-icon>person_remove</mat-icon>
                </button>
              </div>
              <div *ngIf="currentMembers.length === 0" class="empty-members">No members found</div>
            </div>
          </div>

          <div class="form-section section-gap">
            <label class="field-label">Add Members</label>
            <div class="search-bar">
              <mat-icon class="search-icon">search</mat-icon>
              <input type="text" [(ngModel)]="searchQuery" placeholder="Search contacts..." class="search-input" />
            </div>
          </div>
        </ng-container>

        <ng-container *ngIf="!isEditMode">
          <div class="form-section section-gap">
            <label class="field-label">Add Members (min 1 other person)</label>
            <div class="search-bar">
              <mat-icon class="search-icon">search</mat-icon>
              <input type="text" [(ngModel)]="searchQuery" placeholder="Search contacts..." class="search-input" />
            </div>
          </div>
        </ng-container>

        <div *ngIf="selectedContacts.length > 0" class="selected-chips">
          <div *ngFor="let c of selectedContacts" class="chip">
            <span>{{ getDisplayName(c) }}</span>
            <button mat-icon-button class="chip-remove" (click)="removeContact(c)">
              <mat-icon>close</mat-icon>
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
      </div>

      <div class="action-bar">
        <button
          mat-raised-button
          [disabled]="!canSubmit"
          (click)="onSubmit()"
          class="create-btn"
        >
          <mat-icon>{{ isEditMode ? 'save' : 'group_add' }}</mat-icon>
          <ng-container *ngIf="!isEditMode">Create Group ({{ selectedContacts.length + 1 }} members)</ng-container>
          <ng-container *ngIf="isEditMode">Save Changes</ng-container>
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
  `, isInline: true, styles: [".group-manager{display:flex;flex-direction:column;height:100%}.header{display:flex;align-items:center;padding:12px 8px 12px 4px;border-bottom:1px solid rgba(255,255,255,.15);gap:4px;flex-shrink:0}.header h3{margin:0;font-size:18px;font-weight:600;color:#fff}.hdr-btn{border-radius:6px!important;transition:background .15s,box-shadow .15s}.hdr-btn:hover{background:#ffffff26!important;box-shadow:0 2px 8px #0003}.hdr-btn mat-icon{color:#fffc}.scrollable{flex:1;overflow-y:auto}.form-section{padding:12px 16px 0}.section-gap{padding-top:16px}.field-label{display:block;font-size:12px;font-weight:600;color:#ffffffb3;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px}.text-field{width:100%;padding:10px 12px;border:1px solid rgba(255,255,255,.25);border-radius:8px;font-size:14px;color:#fff;background:#ffffff1a;outline:none;transition:border-color .2s;box-sizing:border-box}.text-field:focus{border-color:#ffffff80}.text-field::placeholder{color:#ffffff80}.loading-row{display:flex;align-items:center;gap:8px;color:#fff9;font-size:13px;padding:8px 0}.members-list{border-radius:8px;overflow:hidden}.member-row{display:flex;align-items:center;padding:8px 12px;gap:10px;background:#ffffff12;border-bottom:1px solid rgba(255,255,255,.06)}.member-row:last-child{border-bottom:none}.member-avatar{width:30px;height:30px;border-radius:50%;background:#fff3;display:flex;align-items:center;justify-content:center;flex-shrink:0}.member-avatar mat-icon{color:#fff;font-size:18px}.member-info{display:flex;flex-direction:column}.member-name{font-size:13px;font-weight:500;color:#fff}.member-sub{font-size:11px;color:#ffffff80}.remove-member-btn{margin-left:auto;color:#fff9!important}.remove-member-btn:hover{color:#f87171!important;background:#f871711a!important}.empty-members{font-size:13px;color:#ffffff80;padding:8px 0}.search-bar{display:flex;align-items:center;padding:8px 12px;background:#ffffff1a;border-radius:10px}.search-icon{color:#fff9;font-size:20px;width:20px;height:20px;margin-right:8px}.search-input{flex:1;border:none;outline:none;background:transparent;font-size:14px;color:#fff}.search-input::placeholder{color:#ffffff80}.selected-chips{display:flex;flex-wrap:wrap;gap:6px;padding:8px 16px}.chip{display:flex;align-items:center;background:#fff3;color:#fff;border-radius:16px;padding:4px 6px 4px 12px;font-size:12px;font-weight:500}.chip-remove{width:20px!important;height:20px!important;line-height:20px!important}.chip-remove mat-icon{font-size:14px;width:14px;height:14px;color:#fffc}.contacts-list{padding-top:4px}.contact-item{display:flex;align-items:center;padding:10px 16px;cursor:pointer;transition:background .15s;gap:12px}.contact-item:hover{background:#ffffff14}.contact-item.selected{background:#ffffff26}.contact-avatar{width:36px;height:36px;border-radius:50%;background:#fff3;display:flex;align-items:center;justify-content:center;flex-shrink:0}.contact-avatar mat-icon{color:#fff;font-size:20px}.contact-info{flex:1;display:flex;flex-direction:column}.contact-name{font-weight:500;font-size:14px;color:#fff}.contact-company{font-size:12px;color:#fff9}.check-icon{color:#22c55e;font-size:22px}.action-bar{padding:12px 16px;border-top:1px solid rgba(255,255,255,.1);display:flex;flex-direction:column;gap:8px;flex-shrink:0}.create-btn{width:100%;background:#fff3!important;color:#fff!important;border-radius:10px;font-weight:600}.create-btn:disabled{opacity:.5}.create-btn mat-icon{margin-right:8px}.delete-btn{width:100%;color:#f87171!important;border-color:#f8717166!important;border-radius:10px;font-weight:600}.delete-btn mat-icon{margin-right:8px}\n"], dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i4.NgForOf, selector: "[ngFor][ngForOf]", inputs: ["ngForOf", "ngForTrackBy", "ngForTemplate"] }, { kind: "directive", type: i4.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "ngmodule", type: FormsModule }, { kind: "directive", type: i5.DefaultValueAccessor, selector: "input:not([type=checkbox])[formControlName],textarea[formControlName],input:not([type=checkbox])[formControl],textarea[formControl],input:not([type=checkbox])[ngModel],textarea[ngModel],[ngDefaultControl]" }, { kind: "directive", type: i5.NgControlStatus, selector: "[formControlName],[ngModel],[formControl]" }, { kind: "directive", type: i5.NgModel, selector: "[ngModel]:not([formControlName]):not([formControl])", inputs: ["name", "disabled", "ngModel", "ngModelOptions"], outputs: ["ngModelChange"], exportAs: ["ngModel"] }, { kind: "ngmodule", type: MatIconModule }, { kind: "component", type: i6.MatIcon, selector: "mat-icon", inputs: ["color", "inline", "svgIcon", "fontSet", "fontIcon"], exportAs: ["matIcon"] }, { kind: "ngmodule", type: MatButtonModule }, { kind: "component", type: i7.MatButton, selector: "    button[mat-button], button[mat-raised-button], button[mat-flat-button],    button[mat-stroked-button]  ", exportAs: ["matButton"] }, { kind: "component", type: i7.MatIconButton, selector: "button[mat-icon-button]", exportAs: ["matButton"] }, { kind: "ngmodule", type: MatRippleModule }, { kind: "directive", type: i8.MatRipple, selector: "[mat-ripple], [matRipple]", inputs: ["matRippleColor", "matRippleUnbounded", "matRippleCentered", "matRippleRadius", "matRippleAnimation", "matRippleDisabled", "matRippleTrigger"], exportAs: ["matRipple"] }, { kind: "ngmodule", type: MatTooltipModule }, { kind: "directive", type: i9.MatTooltip, selector: "[matTooltip]", inputs: ["matTooltipPosition", "matTooltipPositionAtOrigin", "matTooltipDisabled", "matTooltipShowDelay", "matTooltipHideDelay", "matTooltipTouchGestures", "matTooltip", "matTooltipClass"], exportAs: ["matTooltip"] }, { kind: "ngmodule", type: MatProgressSpinnerModule }, { kind: "component", type: i10.MatProgressSpinner, selector: "mat-progress-spinner, mat-spinner", inputs: ["color", "mode", "value", "diameter", "strokeWidth"], exportAs: ["matProgressSpinner"] }] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: GroupManagerComponent, decorators: [{
            type: Component,
            args: [{ selector: 'app-group-manager', standalone: true, imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatRippleModule, MatTooltipModule, MatProgressSpinnerModule], template: `
    <div class="group-manager">
      <div class="header">
        <button mat-icon-button class="hdr-btn" (click)="goBack()" matTooltip="Back" matTooltipPosition="below">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <h3>{{ isEditMode ? 'Group Settings' : 'Create Group' }}</h3>
      </div>

      <div class="scrollable">
        <div class="form-section">
          <label class="field-label">Group Name</label>
          <input
            type="text"
            [(ngModel)]="groupName"
            placeholder="Enter group name..."
            class="text-field"
          />
        </div>

        <ng-container *ngIf="isEditMode">
          <div class="form-section section-gap">
            <label class="field-label">Current Members</label>
            <div *ngIf="loadingMembers" class="loading-row">
              <mat-spinner diameter="18"></mat-spinner>
              <span>Loading members...</span>
            </div>
            <div *ngIf="!loadingMembers" class="members-list">
              <div *ngFor="let m of currentMembers" class="member-row">
                <div class="member-avatar"><mat-icon>person</mat-icon></div>
                <div class="member-info">
                  <span class="member-name">{{ getMemberName(m) }}{{ m.contact_id === creatorContactId ? ' (you)' : '' }}</span>
                  <span class="member-sub">{{ m.company || m.email }}</span>
                </div>
                <button 
                  *ngIf="m.contact_id !== creatorContactId" 
                  mat-icon-button 
                  class="remove-member-btn"
                  (click)="removeMember(m)"
                  matTooltip="Remove from group"
                  matTooltipPosition="left"
                >
                  <mat-icon>person_remove</mat-icon>
                </button>
              </div>
              <div *ngIf="currentMembers.length === 0" class="empty-members">No members found</div>
            </div>
          </div>

          <div class="form-section section-gap">
            <label class="field-label">Add Members</label>
            <div class="search-bar">
              <mat-icon class="search-icon">search</mat-icon>
              <input type="text" [(ngModel)]="searchQuery" placeholder="Search contacts..." class="search-input" />
            </div>
          </div>
        </ng-container>

        <ng-container *ngIf="!isEditMode">
          <div class="form-section section-gap">
            <label class="field-label">Add Members (min 1 other person)</label>
            <div class="search-bar">
              <mat-icon class="search-icon">search</mat-icon>
              <input type="text" [(ngModel)]="searchQuery" placeholder="Search contacts..." class="search-input" />
            </div>
          </div>
        </ng-container>

        <div *ngIf="selectedContacts.length > 0" class="selected-chips">
          <div *ngFor="let c of selectedContacts" class="chip">
            <span>{{ getDisplayName(c) }}</span>
            <button mat-icon-button class="chip-remove" (click)="removeContact(c)">
              <mat-icon>close</mat-icon>
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
      </div>

      <div class="action-bar">
        <button
          mat-raised-button
          [disabled]="!canSubmit"
          (click)="onSubmit()"
          class="create-btn"
        >
          <mat-icon>{{ isEditMode ? 'save' : 'group_add' }}</mat-icon>
          <ng-container *ngIf="!isEditMode">Create Group ({{ selectedContacts.length + 1 }} members)</ng-container>
          <ng-container *ngIf="isEditMode">Save Changes</ng-container>
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
  `, styles: [".group-manager{display:flex;flex-direction:column;height:100%}.header{display:flex;align-items:center;padding:12px 8px 12px 4px;border-bottom:1px solid rgba(255,255,255,.15);gap:4px;flex-shrink:0}.header h3{margin:0;font-size:18px;font-weight:600;color:#fff}.hdr-btn{border-radius:6px!important;transition:background .15s,box-shadow .15s}.hdr-btn:hover{background:#ffffff26!important;box-shadow:0 2px 8px #0003}.hdr-btn mat-icon{color:#fffc}.scrollable{flex:1;overflow-y:auto}.form-section{padding:12px 16px 0}.section-gap{padding-top:16px}.field-label{display:block;font-size:12px;font-weight:600;color:#ffffffb3;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px}.text-field{width:100%;padding:10px 12px;border:1px solid rgba(255,255,255,.25);border-radius:8px;font-size:14px;color:#fff;background:#ffffff1a;outline:none;transition:border-color .2s;box-sizing:border-box}.text-field:focus{border-color:#ffffff80}.text-field::placeholder{color:#ffffff80}.loading-row{display:flex;align-items:center;gap:8px;color:#fff9;font-size:13px;padding:8px 0}.members-list{border-radius:8px;overflow:hidden}.member-row{display:flex;align-items:center;padding:8px 12px;gap:10px;background:#ffffff12;border-bottom:1px solid rgba(255,255,255,.06)}.member-row:last-child{border-bottom:none}.member-avatar{width:30px;height:30px;border-radius:50%;background:#fff3;display:flex;align-items:center;justify-content:center;flex-shrink:0}.member-avatar mat-icon{color:#fff;font-size:18px}.member-info{display:flex;flex-direction:column}.member-name{font-size:13px;font-weight:500;color:#fff}.member-sub{font-size:11px;color:#ffffff80}.remove-member-btn{margin-left:auto;color:#fff9!important}.remove-member-btn:hover{color:#f87171!important;background:#f871711a!important}.empty-members{font-size:13px;color:#ffffff80;padding:8px 0}.search-bar{display:flex;align-items:center;padding:8px 12px;background:#ffffff1a;border-radius:10px}.search-icon{color:#fff9;font-size:20px;width:20px;height:20px;margin-right:8px}.search-input{flex:1;border:none;outline:none;background:transparent;font-size:14px;color:#fff}.search-input::placeholder{color:#ffffff80}.selected-chips{display:flex;flex-wrap:wrap;gap:6px;padding:8px 16px}.chip{display:flex;align-items:center;background:#fff3;color:#fff;border-radius:16px;padding:4px 6px 4px 12px;font-size:12px;font-weight:500}.chip-remove{width:20px!important;height:20px!important;line-height:20px!important}.chip-remove mat-icon{font-size:14px;width:14px;height:14px;color:#fffc}.contacts-list{padding-top:4px}.contact-item{display:flex;align-items:center;padding:10px 16px;cursor:pointer;transition:background .15s;gap:12px}.contact-item:hover{background:#ffffff14}.contact-item.selected{background:#ffffff26}.contact-avatar{width:36px;height:36px;border-radius:50%;background:#fff3;display:flex;align-items:center;justify-content:center;flex-shrink:0}.contact-avatar mat-icon{color:#fff;font-size:20px}.contact-info{flex:1;display:flex;flex-direction:column}.contact-name{font-weight:500;font-size:14px;color:#fff}.contact-company{font-size:12px;color:#fff9}.check-icon{color:#22c55e;font-size:22px}.action-bar{padding:12px 16px;border-top:1px solid rgba(255,255,255,.1);display:flex;flex-direction:column;gap:8px;flex-shrink:0}.create-btn{width:100%;background:#fff3!important;color:#fff!important;border-radius:10px;font-weight:600}.create-btn:disabled{opacity:.5}.create-btn mat-icon{margin-right:8px}.delete-btn{width:100%;color:#f87171!important;border-color:#f8717166!important;border-radius:10px;font-weight:600}.delete-btn mat-icon{margin-right:8px}\n"] }]
        }], ctorParameters: () => [{ type: i1.MessagingStoreService }, { type: i2.MessagingApiService }, { type: i3.AuthService }] });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ3JvdXAtbWFuYWdlci5jb21wb25lbnQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvbGliL2NvbXBvbmVudHMvZ3JvdXAtbWFuYWdlci9ncm91cC1tYW5hZ2VyLmNvbXBvbmVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsU0FBUyxFQUFxQixNQUFNLGVBQWUsQ0FBQztBQUM3RCxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDL0MsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLGdCQUFnQixDQUFDO0FBQzdDLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSx3QkFBd0IsQ0FBQztBQUN2RCxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFDM0QsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHdCQUF3QixDQUFDO0FBQ3pELE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBQzdELE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBSzlFLE9BQU8sRUFBb0MscUJBQXFCLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQzs7Ozs7Ozs7Ozs7O0FBZ1p4RyxNQUFNLE9BQU8scUJBQXFCO0lBY3RCO0lBQ0E7SUFDQTtJQWZWLFFBQVEsR0FBYyxFQUFFLENBQUM7SUFDekIsZ0JBQWdCLEdBQWMsRUFBRSxDQUFDO0lBQ2pDLGNBQWMsR0FBOEIsRUFBRSxDQUFDO0lBQy9DLFNBQVMsR0FBRyxFQUFFLENBQUM7SUFDZixpQkFBaUIsR0FBRyxFQUFFLENBQUM7SUFDdkIsV0FBVyxHQUFHLEVBQUUsQ0FBQztJQUNqQixVQUFVLEdBQUcsS0FBSyxDQUFDO0lBQ25CLHFCQUFxQixHQUFrQixJQUFJLENBQUM7SUFDNUMsZ0JBQWdCLEdBQWtCLElBQUksQ0FBQztJQUN2QyxjQUFjLEdBQUcsS0FBSyxDQUFDO0lBQ2YsSUFBSSxH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QkFBd0IsQ0FBQyxZQUN2SDs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7R0F1SFQiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBDb21wb25lbnQsIE9uSW5pdCwgT25EZXN0cm95IH0gZnJvbSAnQGFuZ3VsYXIvY29yZSc7XHJcbmltcG9ydCB7IENvbW1vbk1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL2NvbW1vbic7XHJcbmltcG9ydCB7IEZvcm1zTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvZm9ybXMnO1xyXG5pbXBvcnQgeyBNYXRJY29uTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvbWF0ZXJpYWwvaWNvbic7XHJcbmltcG9ydCB7IE1hdEJ1dHRvbk1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL21hdGVyaWFsL2J1dHRvbic7XHJcbmltcG9ydCB7IE1hdFJpcHBsZU1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL21hdGVyaWFsL2NvcmUnO1xyXG5pbXBvcnQgeyBNYXRUb29sdGlwTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvbWF0ZXJpYWwvdG9vbHRpcCc7XHJcbmltcG9ydCB7IE1hdFByb2dyZXNzU3Bpbm5lck1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL21hdGVyaWFsL3Byb2dyZXNzLXNwaW5uZXInO1xyXG5pbXBvcnQgeyBTdWJzY3JpcHRpb24gfSBmcm9tICdyeGpzJztcclxuaW1wb3J0IHsgTWVzc2FnaW5nU3RvcmVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvbWVzc2FnaW5nLXN0b3JlLnNlcnZpY2UnO1xyXG5pbXBvcnQgeyBNZXNzYWdpbmdBcGlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvbWVzc2FnaW5nLWFwaS5zZXJ2aWNlJztcclxuaW1wb3J0IHsgQXV0aFNlcnZpY2UgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9hdXRoLnNlcnZpY2UnO1xyXG5pbXBvcnQgeyBDb250YWN0LCBDb252ZXJzYXRpb25QYXJ0aWNpcGFudCwgZ2V0Q29udGFjdERpc3BsYXlOYW1lIH0gZnJvbSAnLi4vLi4vbW9kZWxzL21lc3NhZ2luZy5tb2RlbHMnO1xyXG5cclxuQENvbXBvbmVudCh7XHJcbiAgc2VsZWN0b3I6ICdhcHAtZ3JvdXAtbWFuYWdlcicsXHJcbiAgc3RhbmRhbG9uZTogdHJ1ZSxcclxuICBpbXBvcnRzOiBbQ29tbW9uTW9kdWxlLCBGb3Jtc01vZHVsZSwgTWF0SWNvbk1vZHVsZSwgTWF0QnV0dG9uTW9kdWxlLCBNYXRSaXBwbGVNb2R1bGUsIE1hdFRvb2x0aXBNb2R1bGUsIE1hdFByb2dyZXNzU3Bpbm5lck1vZHVsZV0sXHJcbiAgdGVtcGxhdGU6IGBcclxuICAgIDxkaXYgY2xhc3M9XCJncm91cC1tYW5hZ2VyXCI+XHJcbiAgICAgIDxkaXYgY2xhc3M9XCJoZWFkZXJcIj5cclxuICAgICAgICA8YnV0dG9uIG1hdC1pY29uLWJ1dHRvbiBjbGFzcz1cImhkci1idG5cIiAoY2xpY2spPVwiZ29CYWNrKClcIiBtYXRUb29sdGlwPVwiQmFja1wiIG1hdFRvb2x0aXBQb3NpdGlvbj1cImJlbG93XCI+XHJcbiAgICAgICAgICA8bWF0LWljb24+YXJyb3dfYmFjazwvbWF0LWljb24+XHJcbiAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgPGgzPnt7IGlzRWRpdE1vZGUgPyAnR3JvdXAgU2V0dGluZ3MnIDogJ0NyZWF0ZSBHcm91cCcgfX08L2gzPlxyXG4gICAgICA8L2Rpdj5cclxuXHJcbiAgICAgIDxkaXYgY2xhc3M9XCJzY3JvbGxhYmxlXCI+XHJcbiAgICAgICAgPGRpdiBjbGFzcz1cImZvcm0tc2VjdGlvblwiPlxyXG4gICAgICAgICAgPGxhYmVsIGNsYXNzPVwiZmllbGQtbGFiZWxcIj5Hcm91cCBOYW1lPC9sYWJlbD5cclxuICAgICAgICAgIDxpbnB1dFxyXG4gICAgICAgICAgICB0eXBlPVwidGV4dFwiXHJcbiAgICAgICAgICAgIFsobmdNb2RlbCldPVwiZ3JvdXBOYW1lXCJcclxuICAgICAgICAgICAgcGxhY2Vob2xkZXI9XCJFbnRlciBncm91cCBuYW1lLi4uXCJcclxuICAgICAgICAgICAgY2xhc3M9XCJ0ZXh0LWZpZWxkXCJcclxuICAgICAgICAgIC8+XHJcbiAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgIDxuZy1jb250YWluZXIgKm5nSWY9XCJpc0VkaXRNb2RlXCI+XHJcbiAgICAgICAgICA8ZGl2IGNsYXNzPVwiZm9ybS1zZWN0aW9uIHNlY3Rpb24tZ2FwXCI+XHJcbiAgICAgICAgICAgIDxsYWJlbCBjbGFzcz1cImZpZWxkLWxhYmVsXCI+Q3VycmVudCBNZW1iZXJzPC9sYWJlbD5cclxuICAgICAgICAgICAgPGRpdiAqbmdJZj1cImxvYWRpbmdNZW1iZXJzXCIgY2xhc3M9XCJsb2FkaW5nLXJvd1wiPlxyXG4gICAgICAgICAgICAgIDxtYXQtc3Bpbm5lciBkaWFtZXRlcj1cIjE4XCI+PC9tYXQtc3Bpbm5lcj5cclxuICAgICAgICAgICAgICA8c3Bhbj5Mb2FkaW5nIG1lbWJlcnMuLi48L3NwYW4+XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICA8ZGl2ICpuZ0lmPVwiIWxvYWRpbmdNZW1iZXJzXCIgY2xhc3M9XCJtZW1iZXJzLWxpc3RcIj5cclxuICAgICAgICAgICAgICA8ZGl2ICpuZ0Zvcj1cImxldCBtIG9mIGN1cnJlbnRNZW1iZXJzXCIgY2xhc3M9XCJtZW1iZXItcm93XCI+XHJcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwibWVtYmVyLWF2YXRhclwiPjxtYXQtaWNvbj5wZXJzb248L21hdC1pY29uPjwvZGl2PlxyXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cIm1lbWJlci1pbmZvXCI+XHJcbiAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwibWVtYmVyLW5hbWVcIj57eyBnZXRNZW1iZXJOYW1lKG0pIH19e3sgbS5jb250YWN0X2lkID09PSBjcmVhdG9yQ29udGFjdElkID8gJyAoeW91KScgOiAnJyB9fTwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJtZW1iZXItc3ViXCI+e3sgbS5jb21wYW55IHx8IG0uZW1haWwgfX08L3NwYW4+XHJcbiAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgIDxidXR0b24gXHJcbiAgICAgICAgICAgICAgICAgICpuZ0lmPVwibS5jb250YWN0X2lkICE9PSBjcmVhdG9yQ29udGFjdElkXCIgXHJcbiAgICAgICAgICAgICAgICAgIG1hdC1pY29uLWJ1dHRvbiBcclxuICAgICAgICAgICAgICAgICAgY2xhc3M9XCJyZW1vdmUtbWVtYmVyLWJ0blwiXHJcbiAgICAgICAgICAgICAgICAgIChjbGljayk9XCJyZW1vdmVNZW1iZXIobSlcIlxyXG4gICAgICAgICAgICAgICAgICBtYXRUb29sdGlwPVwiUmVtb3ZlIGZyb20gZ3JvdXBcIlxyXG4gICAgICAgICAgICAgICAgICBtYXRUb29sdGlwUG9zaXRpb249XCJsZWZ0XCJcclxuICAgICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgICAgPG1hdC1pY29uPnBlcnNvbl9yZW1vdmU8L21hdC1pY29uPlxyXG4gICAgICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgPGRpdiAqbmdJZj1cImN1cnJlbnRNZW1iZXJzLmxlbmd0aCA9PT0gMFwiIGNsYXNzPVwiZW1wdHktbWVtYmVyc1wiPk5vIG1lbWJlcnMgZm91bmQ8L2Rpdj5cclxuICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgICA8ZGl2IGNsYXNzPVwiZm9ybS1zZWN0aW9uIHNlY3Rpb24tZ2FwXCI+XHJcbiAgICAgICAgICAgIDxsYWJlbCBjbGFzcz1cImZpZWxkLWxhYmVsXCI+QWRkIE1lbWJlcnM8L2xhYmVsPlxyXG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwic2VhcmNoLWJhclwiPlxyXG4gICAgICAgICAgICAgIDxtYXQtaWNvbiBjbGFzcz1cInNlYXJjaC1pY29uXCI+c2VhcmNoPC9tYXQtaWNvbj5cclxuICAgICAgICAgICAgICA8aW5wdXQgdHlwZT1cInRleHRcIiBbKG5nTW9kZWwpXT1cInNlYXJjaFF1ZXJ5XCIgcGxhY2Vob2xkZXI9XCJTZWFyY2ggY29udGFjdHMuLi5cIiBjbGFzcz1cInNlYXJjaC1pbnB1dFwiIC8+XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgPC9uZy1jb250YWluZXI+XHJcblxyXG4gICAgICAgIDxuZy1jb250YWluZXIgKm5nSWY9XCIhaXNFZGl0TW9kZVwiPlxyXG4gICAgICAgICAgPGRpdiBjbGFzcz1cImZvcm0tc2VjdGlvbiBzZWN0aW9uLWdhcFwiPlxyXG4gICAgICAgICAgICA8bGFiZWwgY2xhc3M9XCJmaWVsZC1sYWJlbFwiPkFkZCBNZW1iZXJzIChtaW4gMSBvdGhlciBwZXJzb24pPC9sYWJlbD5cclxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cInNlYXJjaC1iYXJcIj5cclxuICAgICAgICAgICAgICA8bWF0LWljb24gY2xhc3M9XCJzZWFyY2gtaWNvblwiPnNlYXJjaDwvbWF0LWljb24+XHJcbiAgICAgICAgICAgICAgPGlucHV0IHR5cGU9XCJ0ZXh0XCIgWyhuZ01vZGVsKV09XCJzZWFyY2hRdWVyeVwiIHBsYWNlaG9sZGVyPVwiU2VhcmNoIGNvbnRhY3RzLi4uXCIgY2xhc3M9XCJzZWFyY2gtaW5wdXRcIiAvPlxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgIDwvbmctY29udGFpbmVyPlxyXG5cclxuICAgICAgICA8ZGl2ICpuZ0lmPVwic2VsZWN0ZWRDb250YWN0cy5sZW5ndGggPiAwXCIgY2xhc3M9XCJzZWxlY3RlZC1jaGlwc1wiPlxyXG4gICAgICAgICAgPGRpdiAqbmdGb3I9XCJsZXQgYyBvZiBzZWxlY3RlZENvbnRhY3RzXCIgY2xhc3M9XCJjaGlwXCI+XHJcbiAgICAgICAgICAgIDxzcGFuPnt7IGdldERpc3BsYXlOYW1lKGMpIH19PC9zcGFuPlxyXG4gICAgICAgICAgICA8YnV0dG9uIG1hdC1pY29uLWJ1dHRvbiBjbGFzcz1cImNoaXAtcmVtb3ZlXCIgKGNsaWNrKT1cInJlbW92ZUNvbnRhY3QoYylcIj5cclxuICAgICAgICAgICAgICA8bWF0LWljb24+Y2xvc2U8L21hdC1pY29uPlxyXG4gICAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICA8ZGl2IGNsYXNzPVwiY29udGFjdHMtbGlzdFwiPlxyXG4gICAgICAgICAgPGRpdlxyXG4gICAgICAgICAgICAqbmdGb3I9XCJsZXQgY29udGFjdCBvZiBmaWx0ZXJlZENvbnRhY3RzXCJcclxuICAgICAgICAgICAgY2xhc3M9XCJjb250YWN0LWl0ZW1cIlxyXG4gICAgICAgICAgICBtYXRSaXBwbGVcclxuICAgICAgICAgICAgW2NsYXNzLnNlbGVjdGVkXT1cImlzU2VsZWN0ZWQoY29udGFjdClcIlxyXG4gICAgICAgICAgICAoY2xpY2spPVwidG9nZ2xlQ29udGFjdChjb250YWN0KVwiXHJcbiAgICAgICAgICA+XHJcbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJjb250YWN0LWF2YXRhclwiPlxyXG4gICAgICAgICAgICAgIDxtYXQtaWNvbj5wZXJzb248L21hdC1pY29uPlxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cImNvbnRhY3QtaW5mb1wiPlxyXG4gICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwiY29udGFjdC1uYW1lXCI+e3sgZ2V0RGlzcGxheU5hbWUoY29udGFjdCkgfX08L3NwYW4+XHJcbiAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJjb250YWN0LWNvbXBhbnlcIj57eyBjb250YWN0LmNvbXBhbnlfbmFtZSB9fTwvc3Bhbj5cclxuICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgIDxtYXQtaWNvbiAqbmdJZj1cImlzU2VsZWN0ZWQoY29udGFjdClcIiBjbGFzcz1cImNoZWNrLWljb25cIj5jaGVja19jaXJjbGU8L21hdC1pY29uPlxyXG4gICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgPC9kaXY+XHJcbiAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgPGRpdiBjbGFzcz1cImFjdGlvbi1iYXJcIj5cclxuICAgICAgICA8YnV0dG9uXHJcbiAgICAgICAgICBtYXQtcmFpc2VkLWJ1dHRvblxyXG4gICAgICAgICAgW2Rpc2FibGVkXT1cIiFjYW5TdWJtaXRcIlxyXG4gICAgICAgICAgKGNsaWNrKT1cIm9uU3VibWl0KClcIlxyXG4gICAgICAgICAgY2xhc3M9XCJjcmVhdGUtYnRuXCJcclxuICAgICAgICA+XHJcbiAgICAgICAgICA8bWF0LWljb24+e3sgaXNFZGl0TW9kZSA/ICdzYXZlJyA6ICdncm91cF9hZGQnIH19PC9tYXQtaWNvbj5cclxuICAgICAgICAgIDxuZy1jb250YWluZXIgKm5nSWY9XCIhaXNFZGl0TW9kZVwiPkNyZWF0ZSBHcm91cCAoe3sgc2VsZWN0ZWRDb250YWN0cy5sZW5ndGggKyAxIH19IG1lbWJlcnMpPC9uZy1jb250YWluZXI+XHJcbiAgICAgICAgICA8bmctY29udGFpbmVyICpuZ0lmPVwiaXNFZGl0TW9kZVwiPlNhdmUgQ2hhbmdlczwvbmctY29udGFpbmVyPlxyXG4gICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgIDxidXR0b25cclxuICAgICAgICAgICpuZ0lmPVwiaXNFZGl0TW9kZVwiXHJcbiAgICAgICAgICBtYXQtc3Ryb2tlZC1idXR0b25cclxuICAgICAgICAgIGNsYXNzPVwiZGVsZXRlLWJ0blwiXHJcbiAgICAgICAgICAoY2xpY2spPVwib25EZWxldGUoKVwiXHJcbiAgICAgICAgPlxyXG4gICAgICAgICAgPG1hdC1pY29uPmRlbGV0ZTwvbWF0LWljb24+XHJcbiAgICAgICAgICBEZWxldGUgR3JvdXBcclxuICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgPC9kaXY+XHJcbiAgICA8L2Rpdj5cclxuICBgLFxyXG4gIHN0eWxlczogW2BcclxuICAgIC5ncm91cC1tYW5hZ2VyIHtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcclxuICAgICAgaGVpZ2h0OiAxMDAlO1xyXG4gICAgfVxyXG5cclxuICAgIC5oZWFkZXIge1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBwYWRkaW5nOiAxMnB4IDhweCAxMnB4IDRweDtcclxuICAgICAgYm9yZGVyLWJvdHRvbTogMXB4IHNvbGlkIHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xNSk7XHJcbiAgICAgIGdhcDogNHB4O1xyXG4gICAgICBmbGV4LXNocmluazogMDtcclxuICAgIH1cclxuXHJcbiAgICAuaGVhZGVyIGgzIHtcclxuICAgICAgbWFyZ2luOiAwO1xyXG4gICAgICBmb250LXNpemU6IDE4cHg7XHJcbiAgICAgIGZvbnQtd2VpZ2h0OiA2MDA7XHJcbiAgICAgIGNvbG9yOiAjZmZmO1xyXG4gICAgfVxyXG5cclxuICAgIC5oZHItYnRuIHtcclxuICAgICAgYm9yZGVyLXJhZGl1czogNnB4ICFpbXBvcnRhbnQ7XHJcbiAgICAgIHRyYW5zaXRpb246IGJhY2tncm91bmQgMC4xNXMsIGJveC1zaGFkb3cgMC4xNXM7XHJcbiAgICB9XHJcblxyXG4gICAgLmhkci1idG46aG92ZXIge1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMTUpICFpbXBvcnRhbnQ7XHJcbiAgICAgIGJveC1zaGFkb3c6IDAgMnB4IDhweCByZ2JhKDAsIDAsIDAsIDAuMik7XHJcbiAgICB9XHJcblxyXG4gICAgLmhkci1idG4gbWF0LWljb24ge1xyXG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjgpO1xyXG4gICAgfVxyXG5cclxuICAgIC5zY3JvbGxhYmxlIHtcclxuICAgICAgZmxleDogMTtcclxuICAgICAgb3ZlcmZsb3cteTogYXV0bztcclxuICAgIH1cclxuXHJcbiAgICAuZm9ybS1zZWN0aW9uIHtcclxuICAgICAgcGFkZGluZzogMTJweCAxNnB4IDA7XHJcbiAgICB9XHJcblxyXG4gICAgLnNlY3Rpb24tZ2FwIHtcclxuICAgICAgcGFkZGluZy10b3A6IDE2cHg7XHJcbiAgICB9XHJcblxyXG4gICAgLmZpZWxkLWxhYmVsIHtcclxuICAgICAgZGlzcGxheTogYmxvY2s7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTJweDtcclxuICAgICAgZm9udC13ZWlnaHQ6IDYwMDtcclxuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC43KTtcclxuICAgICAgdGV4dC10cmFuc2Zvcm06IHVwcGVyY2FzZTtcclxuICAgICAgbGV0dGVyLXNwYWNpbmc6IDAuMDVlbTtcclxuICAgICAgbWFyZ2luLWJvdHRvbTogNnB4O1xyXG4gICAgfVxyXG5cclxuICAgIC50ZXh0LWZpZWxkIHtcclxuICAgICAgd2lkdGg6IDEwMCU7XHJcbiAgICAgIHBhZGRpbmc6IDEwcHggMTJweDtcclxuICAgICAgYm9yZGVyOiAxcHggc29saWQgcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjI1KTtcclxuICAgICAgYm9yZGVyLXJhZGl1czogOHB4O1xyXG4gICAgICBmb250LXNpemU6IDE0cHg7XHJcbiAgICAgIGNvbG9yOiAjZmZmO1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMSk7XHJcbiAgICAgIG91dGxpbmU6IG5vbmU7XHJcbiAgICAgIHRyYW5zaXRpb246IGJvcmRlci1jb2xvciAwLjJzO1xyXG4gICAgICBib3gtc2l6aW5nOiBib3JkZXItYm94O1xyXG4gICAgfVxyXG5cclxuICAgIC50ZXh0LWZpZWxkOmZvY3VzIHsgYm9yZGVyLWNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNSk7IH1cclxuICAgIC50ZXh0LWZpZWxkOjpwbGFjZWhvbGRlciB7IGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNSk7IH1cclxuXHJcbiAgICAubG9hZGluZy1yb3cge1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBnYXA6IDhweDtcclxuICAgICAgY29sb3I6IHJnYmEoMjU1LDI1NSwyNTUsMC42KTtcclxuICAgICAgZm9udC1zaXplOiAxM3B4O1xyXG4gICAgICBwYWRkaW5nOiA4cHggMDtcclxuICAgIH1cclxuXHJcbiAgICAubWVtYmVycy1saXN0IHtcclxuICAgICAgYm9yZGVyLXJhZGl1czogOHB4O1xyXG4gICAgICBvdmVyZmxvdzogaGlkZGVuO1xyXG4gICAgfVxyXG5cclxuICAgIC5tZW1iZXItcm93IHtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAgcGFkZGluZzogOHB4IDEycHg7XHJcbiAgICAgIGdhcDogMTBweDtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsMjU1LDI1NSwwLjA3KTtcclxuICAgICAgYm9yZGVyLWJvdHRvbTogMXB4IHNvbGlkIHJnYmEoMjU1LDI1NSwyNTUsMC4wNik7XHJcbiAgICB9XHJcblxyXG4gICAgLm1lbWJlci1yb3c6bGFzdC1jaGlsZCB7IGJvcmRlci1ib3R0b206IG5vbmU7IH1cclxuXHJcbiAgICAubWVtYmVyLWF2YXRhciB7XHJcbiAgICAgIHdpZHRoOiAzMHB4O1xyXG4gICAgICBoZWlnaHQ6IDMwcHg7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDUwJTtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsMjU1LDI1NSwwLjIpO1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcclxuICAgICAgZmxleC1zaHJpbms6IDA7XHJcbiAgICB9XHJcblxyXG4gICAgLm1lbWJlci1hdmF0YXIgbWF0LWljb24geyBjb2xvcjogI2ZmZjsgZm9udC1zaXplOiAxOHB4OyB9XHJcblxyXG4gICAgLm1lbWJlci1pbmZvIHtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcclxuICAgIH1cclxuXHJcbiAgICAubWVtYmVyLW5hbWUge1xyXG4gICAgICBmb250LXNpemU6IDEzcHg7XHJcbiAgICAgIGZvbnQtd2VpZ2h0OiA1MDA7XHJcbiAgICAgIGNvbG9yOiAjZmZmO1xyXG4gICAgfVxyXG5cclxuICAgIC5tZW1iZXItc3ViIHtcclxuICAgICAgZm9udC1zaXplOiAxMXB4O1xyXG4gICAgICBjb2xvcjogcmdiYSgyNTUsMjU1LDI1NSwwLjUpO1xyXG4gICAgfVxyXG5cclxuICAgIC5yZW1vdmUtbWVtYmVyLWJ0biB7XHJcbiAgICAgIG1hcmdpbi1sZWZ0OiBhdXRvO1xyXG4gICAgICBjb2xvcjogcmdiYSgyNTUsMjU1LDI1NSwwLjYpICFpbXBvcnRhbnQ7XHJcbiAgICB9XHJcblxyXG4gICAgLnJlbW92ZS1tZW1iZXItYnRuOmhvdmVyIHtcclxuICAgICAgY29sb3I6ICNmODcxNzEgIWltcG9ydGFudDtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNDgsMTEzLDExMywwLjEpICFpbXBvcnRhbnQ7XHJcbiAgICB9XHJcblxyXG4gICAgLmVtcHR5LW1lbWJlcnMge1xyXG4gICAgICBmb250LXNpemU6IDEzcHg7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwyNTUsMjU1LDAuNSk7XHJcbiAgICAgIHBhZGRpbmc6IDhweCAwO1xyXG4gICAgfVxyXG5cclxuICAgIC5zZWFyY2gtYmFyIHtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAgcGFkZGluZzogOHB4IDEycHg7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xKTtcclxuICAgICAgYm9yZGVyLXJhZGl1czogMTBweDtcclxuICAgIH1cclxuXHJcbiAgICAuc2VhcmNoLWljb24ge1xyXG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjYpO1xyXG4gICAgICBmb250LXNpemU6IDIwcHg7XHJcbiAgICAgIHdpZHRoOiAyMHB4O1xyXG4gICAgICBoZWlnaHQ6IDIwcHg7XHJcbiAgICAgIG1hcmdpbi1yaWdodDogOHB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5zZWFyY2gtaW5wdXQge1xyXG4gICAgICBmbGV4OiAxO1xyXG4gICAgICBib3JkZXI6IG5vbmU7XHJcbiAgICAgIG91dGxpbmU6IG5vbmU7XHJcbiAgICAgIGJhY2tncm91bmQ6IHRyYW5zcGFyZW50O1xyXG4gICAgICBmb250LXNpemU6IDE0cHg7XHJcbiAgICAgIGNvbG9yOiAjZmZmO1xyXG4gICAgfVxyXG5cclxuICAgIC5zZWFyY2gtaW5wdXQ6OnBsYWNlaG9sZGVyIHsgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC41KTsgfVxyXG5cclxuICAgIC5zZWxlY3RlZC1jaGlwcyB7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGZsZXgtd3JhcDogd3JhcDtcclxuICAgICAgZ2FwOiA2cHg7XHJcbiAgICAgIHBhZGRpbmc6IDhweCAxNnB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5jaGlwIHtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjIpO1xyXG4gICAgICBjb2xvcjogI2ZmZjtcclxuICAgICAgYm9yZGVyLXJhZGl1czogMTZweDtcclxuICAgICAgcGFkZGluZzogNHB4IDZweCA0cHggMTJweDtcclxuICAgICAgZm9udC1zaXplOiAxMnB4O1xyXG4gICAgICBmb250LXdlaWdodDogNTAwO1xyXG4gICAgfVxyXG5cclxuICAgIC5jaGlwLXJlbW92ZSB7XHJcbiAgICAgIHdpZHRoOiAyMHB4ICFpbXBvcnRhbnQ7XHJcbiAgICAgIGhlaWdodDogMjBweCAhaW1wb3J0YW50O1xyXG4gICAgICBsaW5lLWhlaWdodDogMjBweCAhaW1wb3J0YW50O1xyXG4gICAgfVxyXG5cclxuICAgIC5jaGlwLXJlbW92ZSBtYXQtaWNvbiB7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTRweDtcclxuICAgICAgd2lkdGg6IDE0cHg7XHJcbiAgICAgIGhlaWdodDogMTRweDtcclxuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC44KTtcclxuICAgIH1cclxuXHJcbiAgICAuY29udGFjdHMtbGlzdCB7XHJcbiAgICAgIHBhZGRpbmctdG9wOiA0cHg7XHJcbiAgICB9XHJcblxyXG4gICAgLmNvbnRhY3QtaXRlbSB7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgIHBhZGRpbmc6IDEwcHggMTZweDtcclxuICAgICAgY3Vyc29yOiBwb2ludGVyO1xyXG4gICAgICB0cmFuc2l0aW9uOiBiYWNrZ3JvdW5kIDAuMTVzO1xyXG4gICAgICBnYXA6IDEycHg7XHJcbiAgICB9XHJcblxyXG4gICAgLmNvbnRhY3QtaXRlbTpob3ZlciB7IGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4wOCk7IH1cclxuICAgIC5jb250YWN0LWl0ZW0uc2VsZWN0ZWQgeyBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMTUpOyB9XHJcblxyXG4gICAgLmNvbnRhY3QtYXZhdGFyIHtcclxuICAgICAgd2lkdGg6IDM2cHg7XHJcbiAgICAgIGhlaWdodDogMzZweDtcclxuICAgICAgYm9yZGVyLXJhZGl1czogNTAlO1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMik7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xyXG4gICAgICBmbGV4LXNocmluazogMDtcclxuICAgIH1cclxuXHJcbiAgICAuY29udGFjdC1hdmF0YXIgbWF0LWljb24geyBjb2xvcjogI2ZmZjsgZm9udC1zaXplOiAyMHB4OyB9XHJcblxyXG4gICAgLmNvbnRhY3QtaW5mbyB7XHJcbiAgICAgIGZsZXg6IDE7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XHJcbiAgICB9XHJcblxyXG4gICAgLmNvbnRhY3QtbmFtZSB7IGZvbnQtd2VpZ2h0OiA1MDA7IGZvbnQtc2l6ZTogMTRweDsgY29sb3I6ICNmZmY7IH1cclxuICAgIC5jb250YWN0LWNvbXBhbnkgeyBmb250LXNpemU6IDEycHg7IGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNik7IH1cclxuICAgIC5jaGVjay1pY29uIHsgY29sb3I6ICMyMmM1NWU7IGZvbnQtc2l6ZTogMjJweDsgfVxyXG5cclxuICAgIC5hY3Rpb24tYmFyIHtcclxuICAgICAgcGFkZGluZzogMTJweCAxNnB4O1xyXG4gICAgICBib3JkZXItdG9wOiAxcHggc29saWQgcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjEpO1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xyXG4gICAgICBnYXA6IDhweDtcclxuICAgICAgZmxleC1zaHJpbms6IDA7XHJcbiAgICB9XHJcblxyXG4gICAgLmNyZWF0ZS1idG4ge1xyXG4gICAgICB3aWR0aDogMTAwJTtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjIpICFpbXBvcnRhbnQ7XHJcbiAgICAgIGNvbG9yOiAjZmZmICFpbXBvcnRhbnQ7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDEwcHg7XHJcbiAgICAgIGZvbnQtd2VpZ2h0OiA2MDA7XHJcbiAgICB9XHJcblxyXG4gICAgLmNyZWF0ZS1idG46ZGlzYWJsZWQgeyBvcGFjaXR5OiAwLjU7IH1cclxuICAgIC5jcmVhdGUtYnRuIG1hdC1pY29uIHsgbWFyZ2luLXJpZ2h0OiA4cHg7IH1cclxuXHJcbiAgICAuZGVsZXRlLWJ0biB7XHJcbiAgICAgIHdpZHRoOiAxMDAlO1xyXG4gICAgICBjb2xvcjogI2Y4NzE3MSAhaW1wb3J0YW50O1xyXG4gICAgICBib3JkZXItY29sb3I6IHJnYmEoMjQ4LCAxMTMsIDExMywgMC40KSAhaW1wb3J0YW50O1xyXG4gICAgICBib3JkZXItcmFkaXVzOiAxMHB4O1xyXG4gICAgICBmb250LXdlaWdodDogNjAwO1xyXG4gICAgfVxyXG5cclxuICAgIC5kZWxldGUtYnRuIG1hdC1pY29uIHsgbWFyZ2luLXJpZ2h0OiA4cHg7IH1cclxuICBgXSxcclxufSlcclxuZXhwb3J0IGNsYXNzIEdyb3VwTWFuYWdlckNvbXBvbmVudCBpbXBsZW1lbnRzIE9uSW5pdCwgT25EZXN0cm95IHtcclxuICBjb250YWN0czogQ29udGFjdFtdID0gW107XHJcbiAgc2VsZWN0ZWRDb250YWN0czogQ29udGFjdFtdID0gW107XHJcbiAgY3VycmVudE1lbWJlcnM6IENvbnZlcnNhdGlvblBhcnRpY2lwYW50W10gPSBbXTtcclxuICBncm91cE5hbWUgPSAnJztcclxuICBvcmlnaW5hbEdyb3VwTmFtZSA9ICcnO1xyXG4gIHNlYXJjaFF1ZXJ5ID0gJyc7XHJcbiAgaXNFZGl0TW9kZSA9IGZhbHNlO1xyXG4gIGVkaXRpbmdDb252ZXJzYXRpb25JZDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XHJcbiAgY3JlYXRvckNvbnRhY3RJZDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XHJcbiAgbG9hZGluZ01lbWJlcnMgPSBmYWxzZTtcclxuICBwcml2YXRlIHN1YnM6IFN1YnNjcmlwdGlvbltdID0gW107XHJcblxyXG4gIGNvbnN0cnVjdG9yKFxyXG4gICAgcHJpdmF0ZSBzdG9yZTogTWVzc2FnaW5nU3RvcmVTZXJ2aWNlLFxyXG4gICAgcHJpdmF0ZSBhcGk6IE1lc3NhZ2luZ0FwaVNlcnZpY2UsXHJcbiAgICBwcml2YXRlIGF1dGg6IEF1dGhTZXJ2aWNlXHJcbiAgKSB7fVxyXG5cclxuICBuZ09uSW5pdCgpOiB2b2lkIHtcclxuICAgIHRoaXMuY3JlYXRvckNvbnRhY3RJZCA9IHRoaXMuYXV0aC5jb250YWN0SWQ7XHJcbiAgICB0aGlzLnN0b3JlLmxvYWRWaXNpYmxlQ29udGFjdHMoKTtcclxuXHJcbiAgICB0aGlzLnN1YnMucHVzaChcclxuICAgICAgdGhpcy5zdG9yZS52aXNpYmxlQ29udGFjdHMuc3Vic2NyaWJlKChjKSA9PiAodGhpcy5jb250YWN0cyA9IGMpKVxyXG4gICAgKTtcclxuXHJcbiAgICB0aGlzLnN1YnMucHVzaChcclxuICAgICAgdGhpcy5zdG9yZS5ncm91cFNldHRpbmdzLnN1YnNjcmliZSgoc2V0dGluZ3MpID0+IHtcclxuICAgICAgICBpZiAoc2V0dGluZ3MpIHtcclxuICAgICAgICAgIHRoaXMuaXNFZGl0TW9kZSA9IHRydWU7XHJcbiAgICAgICAgICB0aGlzLmVkaXRpbmdDb252ZXJzYXRpb25JZCA9IHNldHRpbmdzLmNvbnZlcnNhdGlvbklkO1xyXG4gICAgICAgICAgdGhpcy5ncm91cE5hbWUgPSBzZXR0aW5ncy5uYW1lO1xyXG4gICAgICAgICAgdGhpcy5vcmlnaW5hbEdyb3VwTmFtZSA9IHNldHRpbmdzLm5hbWU7XHJcbiAgICAgICAgICB0aGlzLnNlbGVjdGVkQ29udGFjdHMgPSBbXTtcclxuICAgICAgICAgIHRoaXMubG9hZEN1cnJlbnRNZW1iZXJzKHNldHRpbmdzLmNvbnZlcnNhdGlvbklkKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgdGhpcy5pc0VkaXRNb2RlID0gZmFsc2U7XHJcbiAgICAgICAgICB0aGlzLmVkaXRpbmdDb252ZXJzYXRpb25JZCA9IG51bGw7XHJcbiAgICAgICAgICB0aGlzLmdyb3VwTmFtZSA9ICcnO1xyXG4gICAgICAgICAgdGhpcy5vcmlnaW5hbEdyb3VwTmFtZSA9ICcnO1xyXG4gICAgICAgICAgdGhpcy5zZWxlY3RlZENvbnRhY3RzID0gW107XHJcbiAgICAgICAgICB0aGlzLmN1cnJlbnRNZW1iZXJzID0gW107XHJcbiAgICAgICAgfVxyXG4gICAgICB9KVxyXG4gICAgKTtcclxuICB9XHJcblxyXG4gIG5nT25EZXN0cm95KCk6IHZvaWQge1xyXG4gICAgdGhpcy5zdWJzLmZvckVhY2goKHMpID0+IHMudW5zdWJzY3JpYmUoKSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGxvYWRDdXJyZW50TWVtYmVycyhjb252ZXJzYXRpb25JZDogc3RyaW5nKTogdm9pZCB7XHJcbiAgICB0aGlzLmxvYWRpbmdNZW1iZXJzID0gdHJ1ZTtcclxuICAgIHRoaXMuYXBpLmdldENvbnZlcnNhdGlvblBhcnRpY2lwYW50cyhjb252ZXJzYXRpb25JZCkuc3Vic2NyaWJlKHtcclxuICAgICAgbmV4dDogKG1lbWJlcnMpID0+IHtcclxuICAgICAgICB0aGlzLmN1cnJlbnRNZW1iZXJzID0gbWVtYmVycztcclxuICAgICAgICB0aGlzLmxvYWRpbmdNZW1iZXJzID0gZmFsc2U7XHJcbiAgICAgIH0sXHJcbiAgICAgIGVycm9yOiAoKSA9PiB7XHJcbiAgICAgICAgdGhpcy5sb2FkaW5nTWVtYmVycyA9IGZhbHNlO1xyXG4gICAgICB9LFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBnZXQgZmlsdGVyZWRDb250YWN0cygpOiBDb250YWN0W10ge1xyXG4gICAgY29uc3QgYWxyZWFkeUluR3JvdXAgPSBuZXcgU2V0KHRoaXMuY3VycmVudE1lbWJlcnMubWFwKChtKSA9PiBtLmNvbnRhY3RfaWQpKTtcclxuICAgIGxldCBsaXN0ID0gdGhpcy5jb250YWN0cy5maWx0ZXIoXHJcbiAgICAgIChjKSA9PiBjLmNvbnRhY3RfaWQgIT09IHRoaXMuY3JlYXRvckNvbnRhY3RJZCAmJiAhYWxyZWFkeUluR3JvdXAuaGFzKGMuY29udGFjdF9pZClcclxuICAgICk7XHJcbiAgICBpZiAodGhpcy5zZWFyY2hRdWVyeS50cmltKCkpIHtcclxuICAgICAgY29uc3QgcSA9IHRoaXMuc2VhcmNoUXVlcnkudG9Mb3dlckNhc2UoKTtcclxuICAgICAgbGlzdCA9IGxpc3QuZmlsdGVyKFxyXG4gICAgICAgIChjKSA9PlxyXG4gICAgICAgICAgdGhpcy5nZXREaXNwbGF5TmFtZShjKS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKHEpIHx8XHJcbiAgICAgICAgICAoYy5jb21wYW55X25hbWUgfHwgJycpLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMocSlcclxuICAgICAgKTtcclxuICAgIH1cclxuICAgIHJldHVybiBsaXN0O1xyXG4gIH1cclxuXHJcbiAgZ2V0RGlzcGxheU5hbWUoY29udGFjdDogQ29udGFjdCk6IHN0cmluZyB7XHJcbiAgICByZXR1cm4gZ2V0Q29udGFjdERpc3BsYXlOYW1lKGNvbnRhY3QpO1xyXG4gIH1cclxuXHJcbiAgZ2V0TWVtYmVyTmFtZShtZW1iZXI6IENvbnZlcnNhdGlvblBhcnRpY2lwYW50KTogc3RyaW5nIHtcclxuICAgIHJldHVybiBtZW1iZXIudXNlcm5hbWUgfHwgbWVtYmVyLmVtYWlsIHx8IGBDb250YWN0ICR7bWVtYmVyLmNvbnRhY3RfaWR9YDtcclxuICB9XHJcblxyXG4gIGdldCBjYW5TdWJtaXQoKTogYm9vbGVhbiB7XHJcbiAgICBpZiAoIXRoaXMuZ3JvdXBOYW1lLnRyaW0oKSkgcmV0dXJuIGZhbHNlO1xyXG4gICAgaWYgKHRoaXMuaXNFZGl0TW9kZSkge1xyXG4gICAgICByZXR1cm4gdGhpcy5ncm91cE5hbWUudHJpbSgpICE9PSB0aGlzLm9yaWdpbmFsR3JvdXBOYW1lIHx8IHRoaXMuc2VsZWN0ZWRDb250YWN0cy5sZW5ndGggPiAwO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHRoaXMuc2VsZWN0ZWRDb250YWN0cy5sZW5ndGggPj0gMTtcclxuICB9XHJcblxyXG4gIGlzU2VsZWN0ZWQoY29udGFjdDogQ29udGFjdCk6IGJvb2xlYW4ge1xyXG4gICAgcmV0dXJuIHRoaXMuc2VsZWN0ZWRDb250YWN0cy5zb21lKChjKSA9PiBjLmNvbnRhY3RfaWQgPT09IGNvbnRhY3QuY29udGFjdF9pZCk7XHJcbiAgfVxyXG5cclxuICB0b2dnbGVDb250YWN0KGNvbnRhY3Q6IENvbnRhY3QpOiB2b2lkIHtcclxuICAgIGlmICh0aGlzLmlzU2VsZWN0ZWQoY29udGFjdCkpIHtcclxuICAgICAgdGhpcy5yZW1vdmVDb250YWN0KGNvbnRhY3QpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgdGhpcy5zZWxlY3RlZENvbnRhY3RzID0gWy4uLnRoaXMuc2VsZWN0ZWRDb250YWN0cywgY29udGFjdF07XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICByZW1vdmVDb250YWN0KGNvbnRhY3Q6IENvbnRhY3QpOiB2b2lkIHtcclxuICAgIHRoaXMuc2VsZWN0ZWRDb250YWN0cyA9IHRoaXMuc2VsZWN0ZWRDb250YWN0cy5maWx0ZXIoXHJcbiAgICAgIChjKSA9PiBjLmNvbnRhY3RfaWQgIT09IGNvbnRhY3QuY29udGFjdF9pZFxyXG4gICAgKTtcclxuICB9XHJcblxyXG4gIHJlbW92ZU1lbWJlcihtZW1iZXI6IENvbnZlcnNhdGlvblBhcnRpY2lwYW50KTogdm9pZCB7XHJcbiAgICBpZiAoIXRoaXMuZWRpdGluZ0NvbnZlcnNhdGlvbklkKSByZXR1cm47XHJcbiAgICBcclxuICAgIGlmIChjb25maXJtKGBSZW1vdmUgJHt0aGlzLmdldE1lbWJlck5hbWUobWVtYmVyKX0gZnJvbSB0aGlzIGdyb3VwP2ApKSB7XHJcbiAgICAgIHRoaXMuc3RvcmUubWFuYWdlR3JvdXAoJ3JlbW92ZScsIHRoaXMuZWRpdGluZ0NvbnZlcnNhdGlvbklkLCB1bmRlZmluZWQsIFttZW1iZXIuY29udGFjdF9pZF0pO1xyXG4gICAgICB0aGlzLmN1cnJlbnRNZW1iZXJzID0gdGhpcy5jdXJyZW50TWVtYmVycy5maWx0ZXIobSA9PiBtLmNvbnRhY3RfaWQgIT09IG1lbWJlci5jb250YWN0X2lkKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIG9uU3VibWl0KCk6IHZvaWQge1xyXG4gICAgaWYgKCF0aGlzLmNhblN1Ym1pdCkgcmV0dXJuO1xyXG5cclxuICAgIGlmICh0aGlzLmlzRWRpdE1vZGUgJiYgdGhpcy5lZGl0aW5nQ29udmVyc2F0aW9uSWQpIHtcclxuICAgICAgaWYgKHRoaXMuZ3JvdXBOYW1lLnRyaW0oKSAhPT0gdGhpcy5vcmlnaW5hbEdyb3VwTmFtZSkge1xyXG4gICAgICAgIHRoaXMuc3RvcmUubWFuYWdlR3JvdXAoJ3JlbmFtZScsIHRoaXMuZWRpdGluZ0NvbnZlcnNhdGlvbklkLCB0aGlzLmdyb3VwTmFtZS50cmltKCkpO1xyXG4gICAgICB9XHJcbiAgICAgIGlmICh0aGlzLnNlbGVjdGVkQ29udGFjdHMubGVuZ3RoID4gMCkge1xyXG4gICAgICAgIGNvbnN0IGlkcyA9IHRoaXMuc2VsZWN0ZWRDb250YWN0cy5tYXAoKGMpID0+IGMuY29udGFjdF9pZCk7XHJcbiAgICAgICAgdGhpcy5zdG9yZS5tYW5hZ2VHcm91cCgnYWRkJywgdGhpcy5lZGl0aW5nQ29udmVyc2F0aW9uSWQsIHVuZGVmaW5lZCwgaWRzKTtcclxuICAgICAgfVxyXG4gICAgICB0aGlzLnN0b3JlLmNsZWFyR3JvdXBTZXR0aW5ncygpO1xyXG4gICAgICB0aGlzLnN0b3JlLnNldFZpZXcoJ2NoYXQnKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIGNvbnN0IGlkcyA9IHRoaXMuc2VsZWN0ZWRDb250YWN0cy5tYXAoKGMpID0+IGMuY29udGFjdF9pZCk7XHJcbiAgICAgIHRoaXMuc3RvcmUuY3JlYXRlR3JvdXBDb252ZXJzYXRpb24oaWRzLCB0aGlzLmdyb3VwTmFtZS50cmltKCkpO1xyXG4gICAgICB0aGlzLnN0b3JlLnNldFZpZXcoJ2NoYXQnKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIG9uRGVsZXRlKCk6IHZvaWQge1xyXG4gICAgaWYgKHRoaXMuZWRpdGluZ0NvbnZlcnNhdGlvbklkKSB7XHJcbiAgICAgIHRoaXMuc3RvcmUuZGVsZXRlR3JvdXAodGhpcy5lZGl0aW5nQ29udmVyc2F0aW9uSWQpO1xyXG4gICAgICB0aGlzLnN0b3JlLmNsZWFyR3JvdXBTZXR0aW5ncygpO1xyXG4gICAgICB0aGlzLmdvQmFjaygpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgZ29CYWNrKCk6IHZvaWQge1xyXG4gICAgaWYgKHRoaXMuaXNFZGl0TW9kZSkge1xyXG4gICAgICB0aGlzLnN0b3JlLmNsZWFyR3JvdXBTZXR0aW5ncygpO1xyXG4gICAgICB0aGlzLnN0b3JlLnNldFZpZXcoJ2NoYXQnKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHRoaXMuc3RvcmUuc2V0VmlldygnaW5ib3gnKTtcclxuICAgIH1cclxuICB9XHJcbn1cclxuIl19