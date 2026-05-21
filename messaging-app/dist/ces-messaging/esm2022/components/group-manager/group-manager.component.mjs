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
    creatingGroup = false;
    deletingGroup = false;
    showDeleteConfirm = false;
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
                this.showDeleteConfirm = false;
                this.loadCurrentMembers(settings.conversationId);
            }
            else {
                this.isEditMode = false;
                this.editingConversationId = null;
                this.groupName = '';
                this.originalGroupName = '';
                this.selectedContacts = [];
                this.currentMembers = [];
                this.showDeleteConfirm = false;
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
        if (this.creatingGroup)
            return false;
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
            this.store.manageGroup('remove', this.editingConversationId, undefined, [member.contact_id], {
                success: () => {
                    this.currentMembers = this.currentMembers.filter(m => m.contact_id !== member.contact_id);
                },
            });
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
            this.creatingGroup = true;
            const ids = this.selectedContacts.map((c) => c.contact_id);
            this.store.createGroupConversation(ids, this.groupName.trim(), {
                error: () => {
                    this.creatingGroup = false;
                },
            });
        }
    }
    requestDeleteGroup() {
        if (!this.editingConversationId || this.deletingGroup)
            return;
        this.showDeleteConfirm = true;
    }
    cancelDeleteGroup() {
        if (this.deletingGroup)
            return;
        this.showDeleteConfirm = false;
    }
    confirmDeleteGroup() {
        if (this.editingConversationId && !this.deletingGroup) {
            this.deletingGroup = true;
            this.store.deleteGroup(this.editingConversationId, {
                error: () => {
                    this.deletingGroup = false;
                    this.showDeleteConfirm = false;
                },
            });
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
          <ng-container *ngIf="!isEditMode && !creatingGroup">Create Group ({{ selectedContacts.length + 1 }} members)</ng-container>
          <ng-container *ngIf="!isEditMode && creatingGroup">Creating group...</ng-container>
          <ng-container *ngIf="isEditMode">Save Changes</ng-container>
        </button>
        <button
          *ngIf="isEditMode"
          mat-stroked-button
          class="delete-btn"
          [disabled]="deletingGroup"
          (click)="requestDeleteGroup()"
        >
          <mat-icon>logout</mat-icon>
          {{ deletingGroup ? 'Exiting group...' : 'Exit Group' }}
        </button>
      </div>

      <div *ngIf="showDeleteConfirm" class="confirm-overlay">
        <div class="confirm-card">
          <div class="confirm-icon">
            <mat-icon>warning</mat-icon>
          </div>
          <div class="confirm-copy">
            <h4>Exit group?</h4>
            <p>Are you sure you want to exit "{{ groupName.trim() || 'this group' }}"?</p>
          </div>
          <div class="confirm-actions">
            <button mat-stroked-button class="confirm-cancel" [disabled]="deletingGroup" (click)="cancelDeleteGroup()">
              Cancel
            </button>
            <button mat-raised-button class="confirm-delete" [disabled]="deletingGroup" (click)="confirmDeleteGroup()">
              <mat-icon>logout</mat-icon>
              {{ deletingGroup ? 'Exiting...' : 'Exit Group' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `, isInline: true, styles: [".group-manager{display:flex;flex-direction:column;height:100%;position:relative}.header{display:flex;align-items:center;padding:12px 8px 12px 4px;border-bottom:1px solid rgba(255,255,255,.15);gap:4px;flex-shrink:0}.header h3{margin:0;font-size:18px;font-weight:600;color:#fff}.hdr-btn{border-radius:6px!important;transition:background .15s,box-shadow .15s}.hdr-btn:hover{background:#ffffff26!important;box-shadow:0 2px 8px #0003}.hdr-btn mat-icon{color:#fffc}.scrollable{flex:1;overflow-y:auto}.form-section{padding:12px 16px 0}.section-gap{padding-top:16px}.field-label{display:block;font-size:12px;font-weight:600;color:#ffffffb3;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px}.text-field{width:100%;padding:10px 12px;border:1px solid rgba(255,255,255,.25);border-radius:8px;font-size:14px;color:#fff;background:#ffffff1a;outline:none;transition:border-color .2s;box-sizing:border-box}.text-field:focus{border-color:#ffffff80}.text-field::placeholder{color:#ffffff80}.loading-row{display:flex;align-items:center;gap:8px;color:#fff9;font-size:13px;padding:8px 0}.members-list{border-radius:8px;overflow:hidden}.member-row{display:flex;align-items:center;padding:8px 12px;gap:10px;background:#ffffff12;border-bottom:1px solid rgba(255,255,255,.06)}.member-row:last-child{border-bottom:none}.member-avatar{width:30px;height:30px;border-radius:50%;background:#fff3;display:flex;align-items:center;justify-content:center;flex-shrink:0}.member-avatar mat-icon{color:#fff;font-size:18px}.member-info{display:flex;flex-direction:column}.member-name{font-size:13px;font-weight:500;color:#fff}.member-sub{font-size:11px;color:#ffffff80}.remove-member-btn{margin-left:auto;color:#fff9!important}.remove-member-btn:hover{color:#f87171!important;background:#f871711a!important}.empty-members{font-size:13px;color:#ffffff80;padding:8px 0}.search-bar{display:flex;align-items:center;padding:8px 12px;background:#ffffff1a;border-radius:10px}.search-icon{color:#fff9;font-size:20px;width:20px;height:20px;margin-right:8px}.search-input{flex:1;border:none;outline:none;background:transparent;font-size:14px;color:#fff}.search-input::placeholder{color:#ffffff80}.selected-chips{display:flex;flex-wrap:wrap;gap:6px;padding:8px 16px}.chip{display:flex;align-items:center;background:#fff3;color:#fff;border-radius:16px;padding:4px 6px 4px 12px;font-size:12px;font-weight:500}.chip-remove{width:20px!important;height:20px!important;line-height:20px!important}.chip-remove mat-icon{font-size:14px;width:14px;height:14px;color:#fffc}.contacts-list{padding-top:4px}.contact-item{display:flex;align-items:center;padding:10px 16px;cursor:pointer;transition:background .15s;gap:12px}.contact-item:hover{background:#ffffff14}.contact-item.selected{background:#ffffff26}.contact-avatar{width:36px;height:36px;border-radius:50%;background:#fff3;display:flex;align-items:center;justify-content:center;flex-shrink:0}.contact-avatar mat-icon{color:#fff;font-size:20px}.contact-info{flex:1;display:flex;flex-direction:column}.contact-name{font-weight:500;font-size:14px;color:#fff}.contact-company{font-size:12px;color:#fff9}.check-icon{color:#22c55e;font-size:22px}.action-bar{padding:12px 16px;border-top:1px solid rgba(255,255,255,.1);display:flex;flex-direction:column;gap:8px;flex-shrink:0}.create-btn{width:100%;background:#fff3!important;color:#fff!important;border-radius:10px;font-weight:600}.create-btn:disabled{opacity:.5}.create-btn mat-icon{margin-right:8px}.delete-btn{width:100%;color:#f87171!important;border-color:#f8717166!important;border-radius:10px;font-weight:600}.delete-btn mat-icon{margin-right:8px}.confirm-overlay{position:absolute;inset:0;z-index:10;display:flex;align-items:flex-end;padding:16px;background:#0413229e;-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);box-sizing:border-box}.confirm-card{width:100%;padding:16px;border-radius:14px;background:#0c1f35;border:1px solid rgba(255,255,255,.14);box-shadow:0 16px 40px #00000073;color:#fff}.confirm-icon{width:36px;height:36px;border-radius:50%;background:#f8717124;display:flex;align-items:center;justify-content:center;margin-bottom:10px}.confirm-icon mat-icon{color:#f87171}.confirm-copy h4{margin:0 0 6px;font-size:16px;font-weight:700}.confirm-copy p{margin:0;color:#ffffffb3;font-size:13px;line-height:1.4}.confirm-actions{display:flex;gap:8px;margin-top:16px}.confirm-cancel,.confirm-delete{flex:1;border-radius:10px;font-weight:600}.confirm-cancel{color:#fff!important;border-color:#ffffff40!important}.confirm-delete{background:#dc2626e6!important;color:#fff!important}.confirm-delete mat-icon{margin-right:6px;font-size:18px;width:18px;height:18px}\n"], dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i4.NgForOf, selector: "[ngFor][ngForOf]", inputs: ["ngForOf", "ngForTrackBy", "ngForTemplate"] }, { kind: "directive", type: i4.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "ngmodule", type: FormsModule }, { kind: "directive", type: i5.DefaultValueAccessor, selector: "input:not([type=checkbox])[formControlName],textarea[formControlName],input:not([type=checkbox])[formControl],textarea[formControl],input:not([type=checkbox])[ngModel],textarea[ngModel],[ngDefaultControl]" }, { kind: "directive", type: i5.NgControlStatus, selector: "[formControlName],[ngModel],[formControl]" }, { kind: "directive", type: i5.NgModel, selector: "[ngModel]:not([formControlName]):not([formControl])", inputs: ["name", "disabled", "ngModel", "ngModelOptions"], outputs: ["ngModelChange"], exportAs: ["ngModel"] }, { kind: "ngmodule", type: MatIconModule }, { kind: "component", type: i6.MatIcon, selector: "mat-icon", inputs: ["color", "inline", "svgIcon", "fontSet", "fontIcon"], exportAs: ["matIcon"] }, { kind: "ngmodule", type: MatButtonModule }, { kind: "component", type: i7.MatButton, selector: "    button[mat-button], button[mat-raised-button], button[mat-flat-button],    button[mat-stroked-button]  ", exportAs: ["matButton"] }, { kind: "component", type: i7.MatIconButton, selector: "button[mat-icon-button]", exportAs: ["matButton"] }, { kind: "ngmodule", type: MatRippleModule }, { kind: "directive", type: i8.MatRipple, selector: "[mat-ripple], [matRipple]", inputs: ["matRippleColor", "matRippleUnbounded", "matRippleCentered", "matRippleRadius", "matRippleAnimation", "matRippleDisabled", "matRippleTrigger"], exportAs: ["matRipple"] }, { kind: "ngmodule", type: MatTooltipModule }, { kind: "directive", type: i9.MatTooltip, selector: "[matTooltip]", inputs: ["matTooltipPosition", "matTooltipPositionAtOrigin", "matTooltipDisabled", "matTooltipShowDelay", "matTooltipHideDelay", "matTooltipTouchGestures", "matTooltip", "matTooltipClass"], exportAs: ["matTooltip"] }, { kind: "ngmodule", type: MatProgressSpinnerModule }, { kind: "component", type: i10.MatProgressSpinner, selector: "mat-progress-spinner, mat-spinner", inputs: ["color", "mode", "value", "diameter", "strokeWidth"], exportAs: ["matProgressSpinner"] }] });
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
          <ng-container *ngIf="!isEditMode && !creatingGroup">Create Group ({{ selectedContacts.length + 1 }} members)</ng-container>
          <ng-container *ngIf="!isEditMode && creatingGroup">Creating group...</ng-container>
          <ng-container *ngIf="isEditMode">Save Changes</ng-container>
        </button>
        <button
          *ngIf="isEditMode"
          mat-stroked-button
          class="delete-btn"
          [disabled]="deletingGroup"
          (click)="requestDeleteGroup()"
        >
          <mat-icon>logout</mat-icon>
          {{ deletingGroup ? 'Exiting group...' : 'Exit Group' }}
        </button>
      </div>

      <div *ngIf="showDeleteConfirm" class="confirm-overlay">
        <div class="confirm-card">
          <div class="confirm-icon">
            <mat-icon>warning</mat-icon>
          </div>
          <div class="confirm-copy">
            <h4>Exit group?</h4>
            <p>Are you sure you want to exit "{{ groupName.trim() || 'this group' }}"?</p>
          </div>
          <div class="confirm-actions">
            <button mat-stroked-button class="confirm-cancel" [disabled]="deletingGroup" (click)="cancelDeleteGroup()">
              Cancel
            </button>
            <button mat-raised-button class="confirm-delete" [disabled]="deletingGroup" (click)="confirmDeleteGroup()">
              <mat-icon>logout</mat-icon>
              {{ deletingGroup ? 'Exiting...' : 'Exit Group' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `, styles: [".group-manager{display:flex;flex-direction:column;height:100%;position:relative}.header{display:flex;align-items:center;padding:12px 8px 12px 4px;border-bottom:1px solid rgba(255,255,255,.15);gap:4px;flex-shrink:0}.header h3{margin:0;font-size:18px;font-weight:600;color:#fff}.hdr-btn{border-radius:6px!important;transition:background .15s,box-shadow .15s}.hdr-btn:hover{background:#ffffff26!important;box-shadow:0 2px 8px #0003}.hdr-btn mat-icon{color:#fffc}.scrollable{flex:1;overflow-y:auto}.form-section{padding:12px 16px 0}.section-gap{padding-top:16px}.field-label{display:block;font-size:12px;font-weight:600;color:#ffffffb3;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px}.text-field{width:100%;padding:10px 12px;border:1px solid rgba(255,255,255,.25);border-radius:8px;font-size:14px;color:#fff;background:#ffffff1a;outline:none;transition:border-color .2s;box-sizing:border-box}.text-field:focus{border-color:#ffffff80}.text-field::placeholder{color:#ffffff80}.loading-row{display:flex;align-items:center;gap:8px;color:#fff9;font-size:13px;padding:8px 0}.members-list{border-radius:8px;overflow:hidden}.member-row{display:flex;align-items:center;padding:8px 12px;gap:10px;background:#ffffff12;border-bottom:1px solid rgba(255,255,255,.06)}.member-row:last-child{border-bottom:none}.member-avatar{width:30px;height:30px;border-radius:50%;background:#fff3;display:flex;align-items:center;justify-content:center;flex-shrink:0}.member-avatar mat-icon{color:#fff;font-size:18px}.member-info{display:flex;flex-direction:column}.member-name{font-size:13px;font-weight:500;color:#fff}.member-sub{font-size:11px;color:#ffffff80}.remove-member-btn{margin-left:auto;color:#fff9!important}.remove-member-btn:hover{color:#f87171!important;background:#f871711a!important}.empty-members{font-size:13px;color:#ffffff80;padding:8px 0}.search-bar{display:flex;align-items:center;padding:8px 12px;background:#ffffff1a;border-radius:10px}.search-icon{color:#fff9;font-size:20px;width:20px;height:20px;margin-right:8px}.search-input{flex:1;border:none;outline:none;background:transparent;font-size:14px;color:#fff}.search-input::placeholder{color:#ffffff80}.selected-chips{display:flex;flex-wrap:wrap;gap:6px;padding:8px 16px}.chip{display:flex;align-items:center;background:#fff3;color:#fff;border-radius:16px;padding:4px 6px 4px 12px;font-size:12px;font-weight:500}.chip-remove{width:20px!important;height:20px!important;line-height:20px!important}.chip-remove mat-icon{font-size:14px;width:14px;height:14px;color:#fffc}.contacts-list{padding-top:4px}.contact-item{display:flex;align-items:center;padding:10px 16px;cursor:pointer;transition:background .15s;gap:12px}.contact-item:hover{background:#ffffff14}.contact-item.selected{background:#ffffff26}.contact-avatar{width:36px;height:36px;border-radius:50%;background:#fff3;display:flex;align-items:center;justify-content:center;flex-shrink:0}.contact-avatar mat-icon{color:#fff;font-size:20px}.contact-info{flex:1;display:flex;flex-direction:column}.contact-name{font-weight:500;font-size:14px;color:#fff}.contact-company{font-size:12px;color:#fff9}.check-icon{color:#22c55e;font-size:22px}.action-bar{padding:12px 16px;border-top:1px solid rgba(255,255,255,.1);display:flex;flex-direction:column;gap:8px;flex-shrink:0}.create-btn{width:100%;background:#fff3!important;color:#fff!important;border-radius:10px;font-weight:600}.create-btn:disabled{opacity:.5}.create-btn mat-icon{margin-right:8px}.delete-btn{width:100%;color:#f87171!important;border-color:#f8717166!important;border-radius:10px;font-weight:600}.delete-btn mat-icon{margin-right:8px}.confirm-overlay{position:absolute;inset:0;z-index:10;display:flex;align-items:flex-end;padding:16px;background:#0413229e;-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);box-sizing:border-box}.confirm-card{width:100%;padding:16px;border-radius:14px;background:#0c1f35;border:1px solid rgba(255,255,255,.14);box-shadow:0 16px 40px #00000073;color:#fff}.confirm-icon{width:36px;height:36px;border-radius:50%;background:#f8717124;display:flex;align-items:center;justify-content:center;margin-bottom:10px}.confirm-icon mat-icon{color:#f87171}.confirm-copy h4{margin:0 0 6px;font-size:16px;font-weight:700}.confirm-copy p{margin:0;color:#ffffffb3;font-size:13px;line-height:1.4}.confirm-actions{display:flex;gap:8px;margin-top:16px}.confirm-cancel,.confirm-delete{flex:1;border-radius:10px;font-weight:600}.confirm-cancel{color:#fff!important;border-color:#ffffff40!important}.confirm-delete{background:#dc2626e6!important;color:#fff!important}.confirm-delete mat-icon{margin-right:6px;font-size:18px;width:18px;height:18px}\n"] }]
        }], ctorParameters: () => [{ type: i1.MessagingStoreService }, { type: i2.MessagingApiService }, { type: i3.AuthService }] });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ3JvdXAtbWFuYWdlci5jb21wb25lbnQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvbGliL2NvbXBvbmVudHMvZ3JvdXAtbWFuYWdlci9ncm91cC1tYW5hZ2VyLmNvbXBvbmVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsU0FBUyxFQUFxQixNQUFNLGVBQWUsQ0FBQztBQUM3RCxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDL0MsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLGdCQUFnQixDQUFDO0FBQzdDLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSx3QkFBd0IsQ0FBQztBQUN2RCxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFDM0QsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHdCQUF3QixDQUFDO0FBQ3pELE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBQzdELE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBSzlFLE9BQU8sRUFBb0MscUJBQXFCLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQzs7Ozs7Ozs7Ozs7O0FBd2Z4RyxNQUFNLE9BQU8scUJBQXFCO0lBaUJ0QjtJQUNBO0lBQ0E7SUFsQlYsUUFBUSxHQUFjLEVBQUUsQ0FBQztJQUN6QixnQkFBZ0IsR0FBYyxFQUFFLENBQUM7SUFDakMsY0FBYyxHQUE4QixFQUFFLENBQUM7SUFDL0MsU0FBUyxHQUFHLEVBQUUsQ0FBQztJQUNmLGlCQUFpQixHQUFHLEVBQUUsQ0FBQztJQUN2QixXQUFXLEdBQUcsRUFBRSxDQUFDO0lBQ2pCLFVBQVUsR0FBRyxLQUFLLENBQUM7SUFDbkIscUJBQXFCLEdBQWtCLElBQUksQ0FBQztJQUM1QyxnQkFBZ0IsR0FBa0IsSUFBSSxDQUFDO0lBQ3ZDLGNBQWMsR0FBRyxLQUFLLENBQUM7SUFDdkIsYUFB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QUFLLENBQUM7Z0JBQ2pDLENBQUM7YUFDRixDQUFDLENBQUM7UUFDTCxDQUFDO0lBQ0gsQ0FBQztJQUVELE1BQU07UUFDSixJQUFJLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQztZQUNwQixJQUFJLENBQUMsS0FBSyxDQUFDLGtCQUFrQixFQUFFLENBQUM7WUFDaEMsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDN0IsQ0FBQzthQUFNLENBQUM7WUFDTixJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUM5QixDQUFDO0lBQ0gsQ0FBQzt3R0ExTFUscUJBQXFCOzRGQUFyQixxQkFBcUIsNkVBbGZ0Qjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQThJVCx5bUpBL0lTLFlBQVksK1BBQUUsV0FBVyw4bUJBQUUsYUFBYSxtTEFBRSxlQUFlLHdVQUFFLGVBQWUsa1NBQUUsZ0JBQWdCLDRUQUFFLHdCQUF3Qjs7NEZBbWZySCxxQkFBcUI7a0JBdGZqQyxTQUFTOytCQUNFLG1CQUFtQixjQUNqQixJQUFJLFdBQ1AsQ0FBQyxZQUFZLEVBQUUsV0FBVyxFQUFFLGFBQWEsRUFBRSxlQUFlLEVBQUUsZUFBZSxFQUFFLGdCQUFnQixFQUFFLHdCQUF3QixDQUFDLFlBQ3ZIOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBOElUIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQ29tcG9uZW50LCBPbkluaXQsIE9uRGVzdHJveSB9IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xyXG5pbXBvcnQgeyBDb21tb25Nb2R1bGUgfSBmcm9tICdAYW5ndWxhci9jb21tb24nO1xyXG5pbXBvcnQgeyBGb3Jtc01vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL2Zvcm1zJztcclxuaW1wb3J0IHsgTWF0SWNvbk1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL21hdGVyaWFsL2ljb24nO1xyXG5pbXBvcnQgeyBNYXRCdXR0b25Nb2R1bGUgfSBmcm9tICdAYW5ndWxhci9tYXRlcmlhbC9idXR0b24nO1xyXG5pbXBvcnQgeyBNYXRSaXBwbGVNb2R1bGUgfSBmcm9tICdAYW5ndWxhci9tYXRlcmlhbC9jb3JlJztcclxuaW1wb3J0IHsgTWF0VG9vbHRpcE1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL21hdGVyaWFsL3Rvb2x0aXAnO1xyXG5pbXBvcnQgeyBNYXRQcm9ncmVzc1NwaW5uZXJNb2R1bGUgfSBmcm9tICdAYW5ndWxhci9tYXRlcmlhbC9wcm9ncmVzcy1zcGlubmVyJztcclxuaW1wb3J0IHsgU3Vic2NyaXB0aW9uIH0gZnJvbSAncnhqcyc7XHJcbmltcG9ydCB7IE1lc3NhZ2luZ1N0b3JlU2VydmljZSB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL21lc3NhZ2luZy1zdG9yZS5zZXJ2aWNlJztcclxuaW1wb3J0IHsgTWVzc2FnaW5nQXBpU2VydmljZSB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL21lc3NhZ2luZy1hcGkuc2VydmljZSc7XHJcbmltcG9ydCB7IEF1dGhTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvYXV0aC5zZXJ2aWNlJztcclxuaW1wb3J0IHsgQ29udGFjdCwgQ29udmVyc2F0aW9uUGFydGljaXBhbnQsIGdldENvbnRhY3REaXNwbGF5TmFtZSB9IGZyb20gJy4uLy4uL21vZGVscy9tZXNzYWdpbmcubW9kZWxzJztcclxuXHJcbkBDb21wb25lbnQoe1xyXG4gIHNlbGVjdG9yOiAnYXBwLWdyb3VwLW1hbmFnZXInLFxyXG4gIHN0YW5kYWxvbmU6IHRydWUsXHJcbiAgaW1wb3J0czogW0NvbW1vbk1vZHVsZSwgRm9ybXNNb2R1bGUsIE1hdEljb25Nb2R1bGUsIE1hdEJ1dHRvbk1vZHVsZSwgTWF0UmlwcGxlTW9kdWxlLCBNYXRUb29sdGlwTW9kdWxlLCBNYXRQcm9ncmVzc1NwaW5uZXJNb2R1bGVdLFxyXG4gIHRlbXBsYXRlOiBgXHJcbiAgICA8ZGl2IGNsYXNzPVwiZ3JvdXAtbWFuYWdlclwiPlxyXG4gICAgICA8ZGl2IGNsYXNzPVwiaGVhZGVyXCI+XHJcbiAgICAgICAgPGJ1dHRvbiBtYXQtaWNvbi1idXR0b24gY2xhc3M9XCJoZHItYnRuXCIgKGNsaWNrKT1cImdvQmFjaygpXCIgbWF0VG9vbHRpcD1cIkJhY2tcIiBtYXRUb29sdGlwUG9zaXRpb249XCJiZWxvd1wiPlxyXG4gICAgICAgICAgPG1hdC1pY29uPmFycm93X2JhY2s8L21hdC1pY29uPlxyXG4gICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgIDxoMz57eyBpc0VkaXRNb2RlID8gJ0dyb3VwIFNldHRpbmdzJyA6ICdDcmVhdGUgR3JvdXAnIH19PC9oMz5cclxuICAgICAgPC9kaXY+XHJcblxyXG4gICAgICA8ZGl2IGNsYXNzPVwic2Nyb2xsYWJsZVwiPlxyXG4gICAgICAgIDxkaXYgY2xhc3M9XCJmb3JtLXNlY3Rpb25cIj5cclxuICAgICAgICAgIDxsYWJlbCBjbGFzcz1cImZpZWxkLWxhYmVsXCI+R3JvdXAgTmFtZTwvbGFiZWw+XHJcbiAgICAgICAgICA8aW5wdXRcclxuICAgICAgICAgICAgdHlwZT1cInRleHRcIlxyXG4gICAgICAgICAgICBbKG5nTW9kZWwpXT1cImdyb3VwTmFtZVwiXHJcbiAgICAgICAgICAgIHBsYWNlaG9sZGVyPVwiRW50ZXIgZ3JvdXAgbmFtZS4uLlwiXHJcbiAgICAgICAgICAgIGNsYXNzPVwidGV4dC1maWVsZFwiXHJcbiAgICAgICAgICAvPlxyXG4gICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICA8bmctY29udGFpbmVyICpuZ0lmPVwiaXNFZGl0TW9kZVwiPlxyXG4gICAgICAgICAgPGRpdiBjbGFzcz1cImZvcm0tc2VjdGlvbiBzZWN0aW9uLWdhcFwiPlxyXG4gICAgICAgICAgICA8bGFiZWwgY2xhc3M9XCJmaWVsZC1sYWJlbFwiPkN1cnJlbnQgTWVtYmVyczwvbGFiZWw+XHJcbiAgICAgICAgICAgIDxkaXYgKm5nSWY9XCJsb2FkaW5nTWVtYmVyc1wiIGNsYXNzPVwibG9hZGluZy1yb3dcIj5cclxuICAgICAgICAgICAgICA8bWF0LXNwaW5uZXIgZGlhbWV0ZXI9XCIxOFwiPjwvbWF0LXNwaW5uZXI+XHJcbiAgICAgICAgICAgICAgPHNwYW4+TG9hZGluZyBtZW1iZXJzLi4uPC9zcGFuPlxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgPGRpdiAqbmdJZj1cIiFsb2FkaW5nTWVtYmVyc1wiIGNsYXNzPVwibWVtYmVycy1saXN0XCI+XHJcbiAgICAgICAgICAgICAgPGRpdiAqbmdGb3I9XCJsZXQgbSBvZiBjdXJyZW50TWVtYmVyc1wiIGNsYXNzPVwibWVtYmVyLXJvd1wiPlxyXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cIm1lbWJlci1hdmF0YXJcIj48bWF0LWljb24+cGVyc29uPC9tYXQtaWNvbj48L2Rpdj5cclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJtZW1iZXItaW5mb1wiPlxyXG4gICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cIm1lbWJlci1uYW1lXCI+e3sgZ2V0TWVtYmVyTmFtZShtKSB9fXt7IG0uY29udGFjdF9pZCA9PT0gY3JlYXRvckNvbnRhY3RJZCA/ICcgKHlvdSknIDogJycgfX08L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwibWVtYmVyLXN1YlwiPnt7IG0uY29tcGFueSB8fCBtLmVtYWlsIH19PC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICA8YnV0dG9uIFxyXG4gICAgICAgICAgICAgICAgICAqbmdJZj1cIm0uY29udGFjdF9pZCAhPT0gY3JlYXRvckNvbnRhY3RJZFwiIFxyXG4gICAgICAgICAgICAgICAgICBtYXQtaWNvbi1idXR0b24gXHJcbiAgICAgICAgICAgICAgICAgIGNsYXNzPVwicmVtb3ZlLW1lbWJlci1idG5cIlxyXG4gICAgICAgICAgICAgICAgICAoY2xpY2spPVwicmVtb3ZlTWVtYmVyKG0pXCJcclxuICAgICAgICAgICAgICAgICAgbWF0VG9vbHRpcD1cIlJlbW92ZSBmcm9tIGdyb3VwXCJcclxuICAgICAgICAgICAgICAgICAgbWF0VG9vbHRpcFBvc2l0aW9uPVwibGVmdFwiXHJcbiAgICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICAgIDxtYXQtaWNvbj5wZXJzb25fcmVtb3ZlPC9tYXQtaWNvbj5cclxuICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgIDxkaXYgKm5nSWY9XCJjdXJyZW50TWVtYmVycy5sZW5ndGggPT09IDBcIiBjbGFzcz1cImVtcHR5LW1lbWJlcnNcIj5ObyBtZW1iZXJzIGZvdW5kPC9kaXY+XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgPGRpdiBjbGFzcz1cImZvcm0tc2VjdGlvbiBzZWN0aW9uLWdhcFwiPlxyXG4gICAgICAgICAgICA8bGFiZWwgY2xhc3M9XCJmaWVsZC1sYWJlbFwiPkFkZCBNZW1iZXJzPC9sYWJlbD5cclxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cInNlYXJjaC1iYXJcIj5cclxuICAgICAgICAgICAgICA8bWF0LWljb24gY2xhc3M9XCJzZWFyY2gtaWNvblwiPnNlYXJjaDwvbWF0LWljb24+XHJcbiAgICAgICAgICAgICAgPGlucHV0IHR5cGU9XCJ0ZXh0XCIgWyhuZ01vZGVsKV09XCJzZWFyY2hRdWVyeVwiIHBsYWNlaG9sZGVyPVwiU2VhcmNoIGNvbnRhY3RzLi4uXCIgY2xhc3M9XCJzZWFyY2gtaW5wdXRcIiAvPlxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgIDwvbmctY29udGFpbmVyPlxyXG5cclxuICAgICAgICA8bmctY29udGFpbmVyICpuZ0lmPVwiIWlzRWRpdE1vZGVcIj5cclxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJmb3JtLXNlY3Rpb24gc2VjdGlvbi1nYXBcIj5cclxuICAgICAgICAgICAgPGxhYmVsIGNsYXNzPVwiZmllbGQtbGFiZWxcIj5BZGQgTWVtYmVycyAobWluIDEgb3RoZXIgcGVyc29uKTwvbGFiZWw+XHJcbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJzZWFyY2gtYmFyXCI+XHJcbiAgICAgICAgICAgICAgPG1hdC1pY29uIGNsYXNzPVwic2VhcmNoLWljb25cIj5zZWFyY2g8L21hdC1pY29uPlxyXG4gICAgICAgICAgICAgIDxpbnB1dCB0eXBlPVwidGV4dFwiIFsobmdNb2RlbCldPVwic2VhcmNoUXVlcnlcIiBwbGFjZWhvbGRlcj1cIlNlYXJjaCBjb250YWN0cy4uLlwiIGNsYXNzPVwic2VhcmNoLWlucHV0XCIgLz5cclxuICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICA8L25nLWNvbnRhaW5lcj5cclxuXHJcbiAgICAgICAgPGRpdiAqbmdJZj1cInNlbGVjdGVkQ29udGFjdHMubGVuZ3RoID4gMFwiIGNsYXNzPVwic2VsZWN0ZWQtY2hpcHNcIj5cclxuICAgICAgICAgIDxkaXYgKm5nRm9yPVwibGV0IGMgb2Ygc2VsZWN0ZWRDb250YWN0c1wiIGNsYXNzPVwiY2hpcFwiPlxyXG4gICAgICAgICAgICA8c3Bhbj57eyBnZXREaXNwbGF5TmFtZShjKSB9fTwvc3Bhbj5cclxuICAgICAgICAgICAgPGJ1dHRvbiBtYXQtaWNvbi1idXR0b24gY2xhc3M9XCJjaGlwLXJlbW92ZVwiIChjbGljayk9XCJyZW1vdmVDb250YWN0KGMpXCI+XHJcbiAgICAgICAgICAgICAgPG1hdC1pY29uPmNsb3NlPC9tYXQtaWNvbj5cclxuICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgPGRpdiBjbGFzcz1cImNvbnRhY3RzLWxpc3RcIj5cclxuICAgICAgICAgIDxkaXZcclxuICAgICAgICAgICAgKm5nRm9yPVwibGV0IGNvbnRhY3Qgb2YgZmlsdGVyZWRDb250YWN0c1wiXHJcbiAgICAgICAgICAgIGNsYXNzPVwiY29udGFjdC1pdGVtXCJcclxuICAgICAgICAgICAgbWF0UmlwcGxlXHJcbiAgICAgICAgICAgIFtjbGFzcy5zZWxlY3RlZF09XCJpc1NlbGVjdGVkKGNvbnRhY3QpXCJcclxuICAgICAgICAgICAgKGNsaWNrKT1cInRvZ2dsZUNvbnRhY3QoY29udGFjdClcIlxyXG4gICAgICAgICAgPlxyXG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwiY29udGFjdC1hdmF0YXJcIj5cclxuICAgICAgICAgICAgICA8bWF0LWljb24+cGVyc29uPC9tYXQtaWNvbj5cclxuICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJjb250YWN0LWluZm9cIj5cclxuICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cImNvbnRhY3QtbmFtZVwiPnt7IGdldERpc3BsYXlOYW1lKGNvbnRhY3QpIH19PC9zcGFuPlxyXG4gICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwiY29udGFjdC1jb21wYW55XCI+e3sgY29udGFjdC5jb21wYW55X25hbWUgfX08L3NwYW4+XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICA8bWF0LWljb24gKm5nSWY9XCJpc1NlbGVjdGVkKGNvbnRhY3QpXCIgY2xhc3M9XCJjaGVjay1pY29uXCI+Y2hlY2tfY2lyY2xlPC9tYXQtaWNvbj5cclxuICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgIDwvZGl2PlxyXG4gICAgICA8L2Rpdj5cclxuXHJcbiAgICAgIDxkaXYgY2xhc3M9XCJhY3Rpb24tYmFyXCI+XHJcbiAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgbWF0LXJhaXNlZC1idXR0b25cclxuICAgICAgICAgIFtkaXNhYmxlZF09XCIhY2FuU3VibWl0XCJcclxuICAgICAgICAgIChjbGljayk9XCJvblN1Ym1pdCgpXCJcclxuICAgICAgICAgIGNsYXNzPVwiY3JlYXRlLWJ0blwiXHJcbiAgICAgICAgPlxyXG4gICAgICAgICAgPG1hdC1pY29uPnt7IGlzRWRpdE1vZGUgPyAnc2F2ZScgOiAnZ3JvdXBfYWRkJyB9fTwvbWF0LWljb24+XHJcbiAgICAgICAgICA8bmctY29udGFpbmVyICpuZ0lmPVwiIWlzRWRpdE1vZGUgJiYgIWNyZWF0aW5nR3JvdXBcIj5DcmVhdGUgR3JvdXAgKHt7IHNlbGVjdGVkQ29udGFjdHMubGVuZ3RoICsgMSB9fSBtZW1iZXJzKTwvbmctY29udGFpbmVyPlxyXG4gICAgICAgICAgPG5nLWNvbnRhaW5lciAqbmdJZj1cIiFpc0VkaXRNb2RlICYmIGNyZWF0aW5nR3JvdXBcIj5DcmVhdGluZyBncm91cC4uLjwvbmctY29udGFpbmVyPlxyXG4gICAgICAgICAgPG5nLWNvbnRhaW5lciAqbmdJZj1cImlzRWRpdE1vZGVcIj5TYXZlIENoYW5nZXM8L25nLWNvbnRhaW5lcj5cclxuICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICA8YnV0dG9uXHJcbiAgICAgICAgICAqbmdJZj1cImlzRWRpdE1vZGVcIlxyXG4gICAgICAgICAgbWF0LXN0cm9rZWQtYnV0dG9uXHJcbiAgICAgICAgICBjbGFzcz1cImRlbGV0ZS1idG5cIlxyXG4gICAgICAgICAgW2Rpc2FibGVkXT1cImRlbGV0aW5nR3JvdXBcIlxyXG4gICAgICAgICAgKGNsaWNrKT1cInJlcXVlc3REZWxldGVHcm91cCgpXCJcclxuICAgICAgICA+XHJcbiAgICAgICAgICA8bWF0LWljb24+bG9nb3V0PC9tYXQtaWNvbj5cclxuICAgICAgICAgIHt7IGRlbGV0aW5nR3JvdXAgPyAnRXhpdGluZyBncm91cC4uLicgOiAnRXhpdCBHcm91cCcgfX1cclxuICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgPC9kaXY+XHJcblxyXG4gICAgICA8ZGl2ICpuZ0lmPVwic2hvd0RlbGV0ZUNvbmZpcm1cIiBjbGFzcz1cImNvbmZpcm0tb3ZlcmxheVwiPlxyXG4gICAgICAgIDxkaXYgY2xhc3M9XCJjb25maXJtLWNhcmRcIj5cclxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJjb25maXJtLWljb25cIj5cclxuICAgICAgICAgICAgPG1hdC1pY29uPndhcm5pbmc8L21hdC1pY29uPlxyXG4gICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICA8ZGl2IGNsYXNzPVwiY29uZmlybS1jb3B5XCI+XHJcbiAgICAgICAgICAgIDxoND5FeGl0IGdyb3VwPzwvaDQ+XHJcbiAgICAgICAgICAgIDxwPkFyZSB5b3Ugc3VyZSB5b3Ugd2FudCB0byBleGl0IFwie3sgZ3JvdXBOYW1lLnRyaW0oKSB8fCAndGhpcyBncm91cCcgfX1cIj88L3A+XHJcbiAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJjb25maXJtLWFjdGlvbnNcIj5cclxuICAgICAgICAgICAgPGJ1dHRvbiBtYXQtc3Ryb2tlZC1idXR0b24gY2xhc3M9XCJjb25maXJtLWNhbmNlbFwiIFtkaXNhYmxlZF09XCJkZWxldGluZ0dyb3VwXCIgKGNsaWNrKT1cImNhbmNlbERlbGV0ZUdyb3VwKClcIj5cclxuICAgICAgICAgICAgICBDYW5jZWxcclxuICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICAgIDxidXR0b24gbWF0LXJhaXNlZC1idXR0b24gY2xhc3M9XCJjb25maXJtLWRlbGV0ZVwiIFtkaXNhYmxlZF09XCJkZWxldGluZ0dyb3VwXCIgKGNsaWNrKT1cImNvbmZpcm1EZWxldGVHcm91cCgpXCI+XHJcbiAgICAgICAgICAgICAgPG1hdC1pY29uPmxvZ291dDwvbWF0LWljb24+XHJcbiAgICAgICAgICAgICAge3sgZGVsZXRpbmdHcm91cCA/ICdFeGl0aW5nLi4uJyA6ICdFeGl0IEdyb3VwJyB9fVxyXG4gICAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgIDwvZGl2PlxyXG4gICAgICA8L2Rpdj5cclxuICAgIDwvZGl2PlxyXG4gIGAsXHJcbiAgc3R5bGVzOiBbYFxyXG4gICAgLmdyb3VwLW1hbmFnZXIge1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xyXG4gICAgICBoZWlnaHQ6IDEwMCU7XHJcbiAgICAgIHBvc2l0aW9uOiByZWxhdGl2ZTtcclxuICAgIH1cclxuXHJcbiAgICAuaGVhZGVyIHtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAgcGFkZGluZzogMTJweCA4cHggMTJweCA0cHg7XHJcbiAgICAgIGJvcmRlci1ib3R0b206IDFweCBzb2xpZCByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMTUpO1xyXG4gICAgICBnYXA6IDRweDtcclxuICAgICAgZmxleC1zaHJpbms6IDA7XHJcbiAgICB9XHJcblxyXG4gICAgLmhlYWRlciBoMyB7XHJcbiAgICAgIG1hcmdpbjogMDtcclxuICAgICAgZm9udC1zaXplOiAxOHB4O1xyXG4gICAgICBmb250LXdlaWdodDogNjAwO1xyXG4gICAgICBjb2xvcjogI2ZmZjtcclxuICAgIH1cclxuXHJcbiAgICAuaGRyLWJ0biB7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDZweCAhaW1wb3J0YW50O1xyXG4gICAgICB0cmFuc2l0aW9uOiBiYWNrZ3JvdW5kIDAuMTVzLCBib3gtc2hhZG93IDAuMTVzO1xyXG4gICAgfVxyXG5cclxuICAgIC5oZHItYnRuOmhvdmVyIHtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjE1KSAhaW1wb3J0YW50O1xyXG4gICAgICBib3gtc2hhZG93OiAwIDJweCA4cHggcmdiYSgwLCAwLCAwLCAwLjIpO1xyXG4gICAgfVxyXG5cclxuICAgIC5oZHItYnRuIG1hdC1pY29uIHtcclxuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC44KTtcclxuICAgIH1cclxuXHJcbiAgICAuc2Nyb2xsYWJsZSB7XHJcbiAgICAgIGZsZXg6IDE7XHJcbiAgICAgIG92ZXJmbG93LXk6IGF1dG87XHJcbiAgICB9XHJcblxyXG4gICAgLmZvcm0tc2VjdGlvbiB7XHJcbiAgICAgIHBhZGRpbmc6IDEycHggMTZweCAwO1xyXG4gICAgfVxyXG5cclxuICAgIC5zZWN0aW9uLWdhcCB7XHJcbiAgICAgIHBhZGRpbmctdG9wOiAxNnB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5maWVsZC1sYWJlbCB7XHJcbiAgICAgIGRpc3BsYXk6IGJsb2NrO1xyXG4gICAgICBmb250LXNpemU6IDEycHg7XHJcbiAgICAgIGZvbnQtd2VpZ2h0OiA2MDA7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNyk7XHJcbiAgICAgIHRleHQtdHJhbnNmb3JtOiB1cHBlcmNhc2U7XHJcbiAgICAgIGxldHRlci1zcGFjaW5nOiAwLjA1ZW07XHJcbiAgICAgIG1hcmdpbi1ib3R0b206IDZweDtcclxuICAgIH1cclxuXHJcbiAgICAudGV4dC1maWVsZCB7XHJcbiAgICAgIHdpZHRoOiAxMDAlO1xyXG4gICAgICBwYWRkaW5nOiAxMHB4IDEycHg7XHJcbiAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4yNSk7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDhweDtcclxuICAgICAgZm9udC1zaXplOiAxNHB4O1xyXG4gICAgICBjb2xvcjogI2ZmZjtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjEpO1xyXG4gICAgICBvdXRsaW5lOiBub25lO1xyXG4gICAgICB0cmFuc2l0aW9uOiBib3JkZXItY29sb3IgMC4ycztcclxuICAgICAgYm94LXNpemluZzogYm9yZGVyLWJveDtcclxuICAgIH1cclxuXHJcbiAgICAudGV4dC1maWVsZDpmb2N1cyB7IGJvcmRlci1jb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjUpOyB9XHJcbiAgICAudGV4dC1maWVsZDo6cGxhY2Vob2xkZXIgeyBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjUpOyB9XHJcblxyXG4gICAgLmxvYWRpbmctcm93IHtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAgZ2FwOiA4cHg7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwyNTUsMjU1LDAuNik7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTNweDtcclxuICAgICAgcGFkZGluZzogOHB4IDA7XHJcbiAgICB9XHJcblxyXG4gICAgLm1lbWJlcnMtbGlzdCB7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDhweDtcclxuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcclxuICAgIH1cclxuXHJcbiAgICAubWVtYmVyLXJvdyB7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgIHBhZGRpbmc6IDhweCAxMnB4O1xyXG4gICAgICBnYXA6IDEwcHg7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LDI1NSwyNTUsMC4wNyk7XHJcbiAgICAgIGJvcmRlci1ib3R0b206IDFweCBzb2xpZCByZ2JhKDI1NSwyNTUsMjU1LDAuMDYpO1xyXG4gICAgfVxyXG5cclxuICAgIC5tZW1iZXItcm93Omxhc3QtY2hpbGQgeyBib3JkZXItYm90dG9tOiBub25lOyB9XHJcblxyXG4gICAgLm1lbWJlci1hdmF0YXIge1xyXG4gICAgICB3aWR0aDogMzBweDtcclxuICAgICAgaGVpZ2h0OiAzMHB4O1xyXG4gICAgICBib3JkZXItcmFkaXVzOiA1MCU7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LDI1NSwyNTUsMC4yKTtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XHJcbiAgICAgIGZsZXgtc2hyaW5rOiAwO1xyXG4gICAgfVxyXG5cclxuICAgIC5tZW1iZXItYXZhdGFyIG1hdC1pY29uIHsgY29sb3I6ICNmZmY7IGZvbnQtc2l6ZTogMThweDsgfVxyXG5cclxuICAgIC5tZW1iZXItaW5mbyB7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XHJcbiAgICB9XHJcblxyXG4gICAgLm1lbWJlci1uYW1lIHtcclxuICAgICAgZm9udC1zaXplOiAxM3B4O1xyXG4gICAgICBmb250LXdlaWdodDogNTAwO1xyXG4gICAgICBjb2xvcjogI2ZmZjtcclxuICAgIH1cclxuXHJcbiAgICAubWVtYmVyLXN1YiB7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTFweDtcclxuICAgICAgY29sb3I6IHJnYmEoMjU1LDI1NSwyNTUsMC41KTtcclxuICAgIH1cclxuXHJcbiAgICAucmVtb3ZlLW1lbWJlci1idG4ge1xyXG4gICAgICBtYXJnaW4tbGVmdDogYXV0bztcclxuICAgICAgY29sb3I6IHJnYmEoMjU1LDI1NSwyNTUsMC42KSAhaW1wb3J0YW50O1xyXG4gICAgfVxyXG5cclxuICAgIC5yZW1vdmUtbWVtYmVyLWJ0bjpob3ZlciB7XHJcbiAgICAgIGNvbG9yOiAjZjg3MTcxICFpbXBvcnRhbnQ7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjQ4LDExMywxMTMsMC4xKSAhaW1wb3J0YW50O1xyXG4gICAgfVxyXG5cclxuICAgIC5lbXB0eS1tZW1iZXJzIHtcclxuICAgICAgZm9udC1zaXplOiAxM3B4O1xyXG4gICAgICBjb2xvcjogcmdiYSgyNTUsMjU1LDI1NSwwLjUpO1xyXG4gICAgICBwYWRkaW5nOiA4cHggMDtcclxuICAgIH1cclxuXHJcbiAgICAuc2VhcmNoLWJhciB7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgIHBhZGRpbmc6IDhweCAxMnB4O1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMSk7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDEwcHg7XHJcbiAgICB9XHJcblxyXG4gICAgLnNlYXJjaC1pY29uIHtcclxuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC42KTtcclxuICAgICAgZm9udC1zaXplOiAyMHB4O1xyXG4gICAgICB3aWR0aDogMjBweDtcclxuICAgICAgaGVpZ2h0OiAyMHB4O1xyXG4gICAgICBtYXJnaW4tcmlnaHQ6IDhweDtcclxuICAgIH1cclxuXHJcbiAgICAuc2VhcmNoLWlucHV0IHtcclxuICAgICAgZmxleDogMTtcclxuICAgICAgYm9yZGVyOiBub25lO1xyXG4gICAgICBvdXRsaW5lOiBub25lO1xyXG4gICAgICBiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudDtcclxuICAgICAgZm9udC1zaXplOiAxNHB4O1xyXG4gICAgICBjb2xvcjogI2ZmZjtcclxuICAgIH1cclxuXHJcbiAgICAuc2VhcmNoLWlucHV0OjpwbGFjZWhvbGRlciB7IGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNSk7IH1cclxuXHJcbiAgICAuc2VsZWN0ZWQtY2hpcHMge1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBmbGV4LXdyYXA6IHdyYXA7XHJcbiAgICAgIGdhcDogNnB4O1xyXG4gICAgICBwYWRkaW5nOiA4cHggMTZweDtcclxuICAgIH1cclxuXHJcbiAgICAuY2hpcCB7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4yKTtcclxuICAgICAgY29sb3I6ICNmZmY7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDE2cHg7XHJcbiAgICAgIHBhZGRpbmc6IDRweCA2cHggNHB4IDEycHg7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTJweDtcclxuICAgICAgZm9udC13ZWlnaHQ6IDUwMDtcclxuICAgIH1cclxuXHJcbiAgICAuY2hpcC1yZW1vdmUge1xyXG4gICAgICB3aWR0aDogMjBweCAhaW1wb3J0YW50O1xyXG4gICAgICBoZWlnaHQ6IDIwcHggIWltcG9ydGFudDtcclxuICAgICAgbGluZS1oZWlnaHQ6IDIwcHggIWltcG9ydGFudDtcclxuICAgIH1cclxuXHJcbiAgICAuY2hpcC1yZW1vdmUgbWF0LWljb24ge1xyXG4gICAgICBmb250LXNpemU6IDE0cHg7XHJcbiAgICAgIHdpZHRoOiAxNHB4O1xyXG4gICAgICBoZWlnaHQ6IDE0cHg7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuOCk7XHJcbiAgICB9XHJcblxyXG4gICAgLmNvbnRhY3RzLWxpc3Qge1xyXG4gICAgICBwYWRkaW5nLXRvcDogNHB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5jb250YWN0LWl0ZW0ge1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBwYWRkaW5nOiAxMHB4IDE2cHg7XHJcbiAgICAgIGN1cnNvcjogcG9pbnRlcjtcclxuICAgICAgdHJhbnNpdGlvbjogYmFja2dyb3VuZCAwLjE1cztcclxuICAgICAgZ2FwOiAxMnB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5jb250YWN0LWl0ZW06aG92ZXIgeyBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMDgpOyB9XHJcbiAgICAuY29udGFjdC1pdGVtLnNlbGVjdGVkIHsgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjE1KTsgfVxyXG5cclxuICAgIC5jb250YWN0LWF2YXRhciB7XHJcbiAgICAgIHdpZHRoOiAzNnB4O1xyXG4gICAgICBoZWlnaHQ6IDM2cHg7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDUwJTtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjIpO1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcclxuICAgICAgZmxleC1zaHJpbms6IDA7XHJcbiAgICB9XHJcblxyXG4gICAgLmNvbnRhY3QtYXZhdGFyIG1hdC1pY29uIHsgY29sb3I6ICNmZmY7IGZvbnQtc2l6ZTogMjBweDsgfVxyXG5cclxuICAgIC5jb250YWN0LWluZm8ge1xyXG4gICAgICBmbGV4OiAxO1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xyXG4gICAgfVxyXG5cclxuICAgIC5jb250YWN0LW5hbWUgeyBmb250LXdlaWdodDogNTAwOyBmb250LXNpemU6IDE0cHg7IGNvbG9yOiAjZmZmOyB9XHJcbiAgICAuY29udGFjdC1jb21wYW55IHsgZm9udC1zaXplOiAxMnB4OyBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjYpOyB9XHJcbiAgICAuY2hlY2staWNvbiB7IGNvbG9yOiAjMjJjNTVlOyBmb250LXNpemU6IDIycHg7IH1cclxuXHJcbiAgICAuYWN0aW9uLWJhciB7XHJcbiAgICAgIHBhZGRpbmc6IDEycHggMTZweDtcclxuICAgICAgYm9yZGVyLXRvcDogMXB4IHNvbGlkIHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xKTtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcclxuICAgICAgZ2FwOiA4cHg7XHJcbiAgICAgIGZsZXgtc2hyaW5rOiAwO1xyXG4gICAgfVxyXG5cclxuICAgIC5jcmVhdGUtYnRuIHtcclxuICAgICAgd2lkdGg6IDEwMCU7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4yKSAhaW1wb3J0YW50O1xyXG4gICAgICBjb2xvcjogI2ZmZiAhaW1wb3J0YW50O1xyXG4gICAgICBib3JkZXItcmFkaXVzOiAxMHB4O1xyXG4gICAgICBmb250LXdlaWdodDogNjAwO1xyXG4gICAgfVxyXG5cclxuICAgIC5jcmVhdGUtYnRuOmRpc2FibGVkIHsgb3BhY2l0eTogMC41OyB9XHJcbiAgICAuY3JlYXRlLWJ0biBtYXQtaWNvbiB7IG1hcmdpbi1yaWdodDogOHB4OyB9XHJcblxyXG4gICAgLmRlbGV0ZS1idG4ge1xyXG4gICAgICB3aWR0aDogMTAwJTtcclxuICAgICAgY29sb3I6ICNmODcxNzEgIWltcG9ydGFudDtcclxuICAgICAgYm9yZGVyLWNvbG9yOiByZ2JhKDI0OCwgMTEzLCAxMTMsIDAuNCkgIWltcG9ydGFudDtcclxuICAgICAgYm9yZGVyLXJhZGl1czogMTBweDtcclxuICAgICAgZm9udC13ZWlnaHQ6IDYwMDtcclxuICAgIH1cclxuXHJcbiAgICAuZGVsZXRlLWJ0biBtYXQtaWNvbiB7IG1hcmdpbi1yaWdodDogOHB4OyB9XHJcblxyXG4gICAgLmNvbmZpcm0tb3ZlcmxheSB7XHJcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcclxuICAgICAgaW5zZXQ6IDA7XHJcbiAgICAgIHotaW5kZXg6IDEwO1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBhbGlnbi1pdGVtczogZmxleC1lbmQ7XHJcbiAgICAgIHBhZGRpbmc6IDE2cHg7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoNCwgMTksIDM0LCAwLjYyKTtcclxuICAgICAgYmFja2Ryb3AtZmlsdGVyOiBibHVyKDNweCk7XHJcbiAgICAgIGJveC1zaXppbmc6IGJvcmRlci1ib3g7XHJcbiAgICB9XHJcblxyXG4gICAgLmNvbmZpcm0tY2FyZCB7XHJcbiAgICAgIHdpZHRoOiAxMDAlO1xyXG4gICAgICBwYWRkaW5nOiAxNnB4O1xyXG4gICAgICBib3JkZXItcmFkaXVzOiAxNHB4O1xyXG4gICAgICBiYWNrZ3JvdW5kOiAjMGMxZjM1O1xyXG4gICAgICBib3JkZXI6IDFweCBzb2xpZCByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMTQpO1xyXG4gICAgICBib3gtc2hhZG93OiAwIDE2cHggNDBweCByZ2JhKDAsIDAsIDAsIDAuNDUpO1xyXG4gICAgICBjb2xvcjogI2ZmZjtcclxuICAgIH1cclxuXHJcbiAgICAuY29uZmlybS1pY29uIHtcclxuICAgICAgd2lkdGg6IDM2cHg7XHJcbiAgICAgIGhlaWdodDogMzZweDtcclxuICAgICAgYm9yZGVyLXJhZGl1czogNTAlO1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI0OCwgMTEzLCAxMTMsIDAuMTQpO1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcclxuICAgICAgbWFyZ2luLWJvdHRvbTogMTBweDtcclxuICAgIH1cclxuXHJcbiAgICAuY29uZmlybS1pY29uIG1hdC1pY29uIHtcclxuICAgICAgY29sb3I6ICNmODcxNzE7XHJcbiAgICB9XHJcblxyXG4gICAgLmNvbmZpcm0tY29weSBoNCB7XHJcbiAgICAgIG1hcmdpbjogMCAwIDZweDtcclxuICAgICAgZm9udC1zaXplOiAxNnB4O1xyXG4gICAgICBmb250LXdlaWdodDogNzAwO1xyXG4gICAgfVxyXG5cclxuICAgIC5jb25maXJtLWNvcHkgcCB7XHJcbiAgICAgIG1hcmdpbjogMDtcclxuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC43KTtcclxuICAgICAgZm9udC1zaXplOiAxM3B4O1xyXG4gICAgICBsaW5lLWhlaWdodDogMS40O1xyXG4gICAgfVxyXG5cclxuICAgIC5jb25maXJtLWFjdGlvbnMge1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBnYXA6IDhweDtcclxuICAgICAgbWFyZ2luLXRvcDogMTZweDtcclxuICAgIH1cclxuXHJcbiAgICAuY29uZmlybS1jYW5jZWwsXHJcbiAgICAuY29uZmlybS1kZWxldGUge1xyXG4gICAgICBmbGV4OiAxO1xyXG4gICAgICBib3JkZXItcmFkaXVzOiAxMHB4O1xyXG4gICAgICBmb250LXdlaWdodDogNjAwO1xyXG4gICAgfVxyXG5cclxuICAgIC5jb25maXJtLWNhbmNlbCB7XHJcbiAgICAgIGNvbG9yOiAjZmZmICFpbXBvcnRhbnQ7XHJcbiAgICAgIGJvcmRlci1jb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjI1KSAhaW1wb3J0YW50O1xyXG4gICAgfVxyXG5cclxuICAgIC5jb25maXJtLWRlbGV0ZSB7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjIwLCAzOCwgMzgsIDAuOSkgIWltcG9ydGFudDtcclxuICAgICAgY29sb3I6ICNmZmYgIWltcG9ydGFudDtcclxuICAgIH1cclxuXHJcbiAgICAuY29uZmlybS1kZWxldGUgbWF0LWljb24ge1xyXG4gICAgICBtYXJnaW4tcmlnaHQ6IDZweDtcclxuICAgICAgZm9udC1zaXplOiAxOHB4O1xyXG4gICAgICB3aWR0aDogMThweDtcclxuICAgICAgaGVpZ2h0OiAxOHB4O1xyXG4gICAgfVxyXG4gIGBdLFxyXG59KVxyXG5leHBvcnQgY2xhc3MgR3JvdXBNYW5hZ2VyQ29tcG9uZW50IGltcGxlbWVudHMgT25Jbml0LCBPbkRlc3Ryb3kge1xyXG4gIGNvbnRhY3RzOiBDb250YWN0W10gPSBbXTtcclxuICBzZWxlY3RlZENvbnRhY3RzOiBDb250YWN0W10gPSBbXTtcclxuICBjdXJyZW50TWVtYmVyczogQ29udmVyc2F0aW9uUGFydGljaXBhbnRbXSA9IFtdO1xyXG4gIGdyb3VwTmFtZSA9ICcnO1xyXG4gIG9yaWdpbmFsR3JvdXBOYW1lID0gJyc7XHJcbiAgc2VhcmNoUXVlcnkgPSAnJztcclxuICBpc0VkaXRNb2RlID0gZmFsc2U7XHJcbiAgZWRpdGluZ0NvbnZlcnNhdGlvbklkOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcclxuICBjcmVhdG9yQ29udGFjdElkOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcclxuICBsb2FkaW5nTWVtYmVycyA9IGZhbHNlO1xyXG4gIGNyZWF0aW5nR3JvdXAgPSBmYWxzZTtcclxuICBkZWxldGluZ0dyb3VwID0gZmFsc2U7XHJcbiAgc2hvd0RlbGV0ZUNvbmZpcm0gPSBmYWxzZTtcclxuICBwcml2YXRlIHN1YnM6IFN1YnNjcmlwdGlvbltdID0gW107XHJcblxyXG4gIGNvbnN0cnVjdG9yKFxyXG4gICAgcHJpdmF0ZSBzdG9yZTogTWVzc2FnaW5nU3RvcmVTZXJ2aWNlLFxyXG4gICAgcHJpdmF0ZSBhcGk6IE1lc3NhZ2luZ0FwaVNlcnZpY2UsXHJcbiAgICBwcml2YXRlIGF1dGg6IEF1dGhTZXJ2aWNlXHJcbiAgKSB7fVxyXG5cclxuICBuZ09uSW5pdCgpOiB2b2lkIHtcclxuICAgIHRoaXMuY3JlYXRvckNvbnRhY3RJZCA9IHRoaXMuYXV0aC5jb250YWN0SWQ7XHJcbiAgICB0aGlzLnN0b3JlLmxvYWRWaXNpYmxlQ29udGFjdHMoKTtcclxuXHJcbiAgICB0aGlzLnN1YnMucHVzaChcclxuICAgICAgdGhpcy5zdG9yZS52aXNpYmxlQ29udGFjdHMuc3Vic2NyaWJlKChjKSA9PiAodGhpcy5jb250YWN0cyA9IGMpKVxyXG4gICAgKTtcclxuXHJcbiAgICB0aGlzLnN1YnMucHVzaChcclxuICAgICAgdGhpcy5zdG9yZS5ncm91cFNldHRpbmdzLnN1YnNjcmliZSgoc2V0dGluZ3MpID0+IHtcclxuICAgICAgICBpZiAoc2V0dGluZ3MpIHtcclxuICAgICAgICAgIHRoaXMuaXNFZGl0TW9kZSA9IHRydWU7XHJcbiAgICAgICAgICB0aGlzLmVkaXRpbmdDb252ZXJzYXRpb25JZCA9IHNldHRpbmdzLmNvbnZlcnNhdGlvbklkO1xyXG4gICAgICAgICAgdGhpcy5ncm91cE5hbWUgPSBzZXR0aW5ncy5uYW1lO1xyXG4gICAgICAgICAgdGhpcy5vcmlnaW5hbEdyb3VwTmFtZSA9IHNldHRpbmdzLm5hbWU7XHJcbiAgICAgICAgICB0aGlzLnNlbGVjdGVkQ29udGFjdHMgPSBbXTtcclxuICAgICAgICAgIHRoaXMuc2hvd0RlbGV0ZUNvbmZpcm0gPSBmYWxzZTtcclxuICAgICAgICAgIHRoaXMubG9hZEN1cnJlbnRNZW1iZXJzKHNldHRpbmdzLmNvbnZlcnNhdGlvbklkKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgdGhpcy5pc0VkaXRNb2RlID0gZmFsc2U7XHJcbiAgICAgICAgICB0aGlzLmVkaXRpbmdDb252ZXJzYXRpb25JZCA9IG51bGw7XHJcbiAgICAgICAgICB0aGlzLmdyb3VwTmFtZSA9ICcnO1xyXG4gICAgICAgICAgdGhpcy5vcmlnaW5hbEdyb3VwTmFtZSA9ICcnO1xyXG4gICAgICAgICAgdGhpcy5zZWxlY3RlZENvbnRhY3RzID0gW107XHJcbiAgICAgICAgICB0aGlzLmN1cnJlbnRNZW1iZXJzID0gW107XHJcbiAgICAgICAgICB0aGlzLnNob3dEZWxldGVDb25maXJtID0gZmFsc2U7XHJcbiAgICAgICAgfVxyXG4gICAgICB9KVxyXG4gICAgKTtcclxuICB9XHJcblxyXG4gIG5nT25EZXN0cm95KCk6IHZvaWQge1xyXG4gICAgdGhpcy5zdWJzLmZvckVhY2goKHMpID0+IHMudW5zdWJzY3JpYmUoKSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGxvYWRDdXJyZW50TWVtYmVycyhjb252ZXJzYXRpb25JZDogc3RyaW5nKTogdm9pZCB7XHJcbiAgICB0aGlzLmxvYWRpbmdNZW1iZXJzID0gdHJ1ZTtcclxuICAgIHRoaXMuYXBpLmdldENvbnZlcnNhdGlvblBhcnRpY2lwYW50cyhjb252ZXJzYXRpb25JZCkuc3Vic2NyaWJlKHtcclxuICAgICAgbmV4dDogKG1lbWJlcnMpID0+IHtcclxuICAgICAgICB0aGlzLmN1cnJlbnRNZW1iZXJzID0gbWVtYmVycztcclxuICAgICAgICB0aGlzLmxvYWRpbmdNZW1iZXJzID0gZmFsc2U7XHJcbiAgICAgIH0sXHJcbiAgICAgIGVycm9yOiAoKSA9PiB7XHJcbiAgICAgICAgdGhpcy5sb2FkaW5nTWVtYmVycyA9IGZhbHNlO1xyXG4gICAgICB9LFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBnZXQgZmlsdGVyZWRDb250YWN0cygpOiBDb250YWN0W10ge1xyXG4gICAgY29uc3QgYWxyZWFkeUluR3JvdXAgPSBuZXcgU2V0KHRoaXMuY3VycmVudE1lbWJlcnMubWFwKChtKSA9PiBtLmNvbnRhY3RfaWQpKTtcclxuICAgIGxldCBsaXN0ID0gdGhpcy5jb250YWN0cy5maWx0ZXIoXHJcbiAgICAgIChjKSA9PiBjLmNvbnRhY3RfaWQgIT09IHRoaXMuY3JlYXRvckNvbnRhY3RJZCAmJiAhYWxyZWFkeUluR3JvdXAuaGFzKGMuY29udGFjdF9pZClcclxuICAgICk7XHJcbiAgICBpZiAodGhpcy5zZWFyY2hRdWVyeS50cmltKCkpIHtcclxuICAgICAgY29uc3QgcSA9IHRoaXMuc2VhcmNoUXVlcnkudG9Mb3dlckNhc2UoKTtcclxuICAgICAgbGlzdCA9IGxpc3QuZmlsdGVyKFxyXG4gICAgICAgIChjKSA9PlxyXG4gICAgICAgICAgdGhpcy5nZXREaXNwbGF5TmFtZShjKS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKHEpIHx8XHJcbiAgICAgICAgICAoYy5jb21wYW55X25hbWUgfHwgJycpLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMocSlcclxuICAgICAgKTtcclxuICAgIH1cclxuICAgIHJldHVybiBsaXN0O1xyXG4gIH1cclxuXHJcbiAgZ2V0RGlzcGxheU5hbWUoY29udGFjdDogQ29udGFjdCk6IHN0cmluZyB7XHJcbiAgICByZXR1cm4gZ2V0Q29udGFjdERpc3BsYXlOYW1lKGNvbnRhY3QpO1xyXG4gIH1cclxuXHJcbiAgZ2V0TWVtYmVyTmFtZShtZW1iZXI6IENvbnZlcnNhdGlvblBhcnRpY2lwYW50KTogc3RyaW5nIHtcclxuICAgIHJldHVybiBtZW1iZXIudXNlcm5hbWUgfHwgbWVtYmVyLmVtYWlsIHx8IGBDb250YWN0ICR7bWVtYmVyLmNvbnRhY3RfaWR9YDtcclxuICB9XHJcblxyXG4gIGdldCBjYW5TdWJtaXQoKTogYm9vbGVhbiB7XHJcbiAgICBpZiAodGhpcy5jcmVhdGluZ0dyb3VwKSByZXR1cm4gZmFsc2U7XHJcbiAgICBpZiAoIXRoaXMuZ3JvdXBOYW1lLnRyaW0oKSkgcmV0dXJuIGZhbHNlO1xyXG4gICAgaWYgKHRoaXMuaXNFZGl0TW9kZSkge1xyXG4gICAgICByZXR1cm4gdGhpcy5ncm91cE5hbWUudHJpbSgpICE9PSB0aGlzLm9yaWdpbmFsR3JvdXBOYW1lIHx8IHRoaXMuc2VsZWN0ZWRDb250YWN0cy5sZW5ndGggPiAwO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHRoaXMuc2VsZWN0ZWRDb250YWN0cy5sZW5ndGggPj0gMTtcclxuICB9XHJcblxyXG4gIGlzU2VsZWN0ZWQoY29udGFjdDogQ29udGFjdCk6IGJvb2xlYW4ge1xyXG4gICAgcmV0dXJuIHRoaXMuc2VsZWN0ZWRDb250YWN0cy5zb21lKChjKSA9PiBjLmNvbnRhY3RfaWQgPT09IGNvbnRhY3QuY29udGFjdF9pZCk7XHJcbiAgfVxyXG5cclxuICB0b2dnbGVDb250YWN0KGNvbnRhY3Q6IENvbnRhY3QpOiB2b2lkIHtcclxuICAgIGlmICh0aGlzLmlzU2VsZWN0ZWQoY29udGFjdCkpIHtcclxuICAgICAgdGhpcy5yZW1vdmVDb250YWN0KGNvbnRhY3QpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgdGhpcy5zZWxlY3RlZENvbnRhY3RzID0gWy4uLnRoaXMuc2VsZWN0ZWRDb250YWN0cywgY29udGFjdF07XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICByZW1vdmVDb250YWN0KGNvbnRhY3Q6IENvbnRhY3QpOiB2b2lkIHtcclxuICAgIHRoaXMuc2VsZWN0ZWRDb250YWN0cyA9IHRoaXMuc2VsZWN0ZWRDb250YWN0cy5maWx0ZXIoXHJcbiAgICAgIChjKSA9PiBjLmNvbnRhY3RfaWQgIT09IGNvbnRhY3QuY29udGFjdF9pZFxyXG4gICAgKTtcclxuICB9XHJcblxyXG4gIHJlbW92ZU1lbWJlcihtZW1iZXI6IENvbnZlcnNhdGlvblBhcnRpY2lwYW50KTogdm9pZCB7XHJcbiAgICBpZiAoIXRoaXMuZWRpdGluZ0NvbnZlcnNhdGlvbklkKSByZXR1cm47XHJcbiAgICBcclxuICAgIGlmIChjb25maXJtKGBSZW1vdmUgJHt0aGlzLmdldE1lbWJlck5hbWUobWVtYmVyKX0gZnJvbSB0aGlzIGdyb3VwP2ApKSB7XHJcbiAgICAgIHRoaXMuc3RvcmUubWFuYWdlR3JvdXAoJ3JlbW92ZScsIHRoaXMuZWRpdGluZ0NvbnZlcnNhdGlvbklkLCB1bmRlZmluZWQsIFttZW1iZXIuY29udGFjdF9pZF0sIHtcclxuICAgICAgICBzdWNjZXNzOiAoKSA9PiB7XHJcbiAgICAgICAgICB0aGlzLmN1cnJlbnRNZW1iZXJzID0gdGhpcy5jdXJyZW50TWVtYmVycy5maWx0ZXIobSA9PiBtLmNvbnRhY3RfaWQgIT09IG1lbWJlci5jb250YWN0X2lkKTtcclxuICAgICAgICB9LFxyXG4gICAgICB9KTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIG9uU3VibWl0KCk6IHZvaWQge1xyXG4gICAgaWYgKCF0aGlzLmNhblN1Ym1pdCkgcmV0dXJuO1xyXG5cclxuICAgIGlmICh0aGlzLmlzRWRpdE1vZGUgJiYgdGhpcy5lZGl0aW5nQ29udmVyc2F0aW9uSWQpIHtcclxuICAgICAgaWYgKHRoaXMuZ3JvdXBOYW1lLnRyaW0oKSAhPT0gdGhpcy5vcmlnaW5hbEdyb3VwTmFtZSkge1xyXG4gICAgICAgIHRoaXMuc3RvcmUubWFuYWdlR3JvdXAoJ3JlbmFtZScsIHRoaXMuZWRpdGluZ0NvbnZlcnNhdGlvbklkLCB0aGlzLmdyb3VwTmFtZS50cmltKCkpO1xyXG4gICAgICB9XHJcbiAgICAgIGlmICh0aGlzLnNlbGVjdGVkQ29udGFjdHMubGVuZ3RoID4gMCkge1xyXG4gICAgICAgIGNvbnN0IGlkcyA9IHRoaXMuc2VsZWN0ZWRDb250YWN0cy5tYXAoKGMpID0+IGMuY29udGFjdF9pZCk7XHJcbiAgICAgICAgdGhpcy5zdG9yZS5tYW5hZ2VHcm91cCgnYWRkJywgdGhpcy5lZGl0aW5nQ29udmVyc2F0aW9uSWQsIHVuZGVmaW5lZCwgaWRzKTtcclxuICAgICAgfVxyXG4gICAgICB0aGlzLnN0b3JlLmNsZWFyR3JvdXBTZXR0aW5ncygpO1xyXG4gICAgICB0aGlzLnN0b3JlLnNldFZpZXcoJ2NoYXQnKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHRoaXMuY3JlYXRpbmdHcm91cCA9IHRydWU7XHJcbiAgICAgIGNvbnN0IGlkcyA9IHRoaXMuc2VsZWN0ZWRDb250YWN0cy5tYXAoKGMpID0+IGMuY29udGFjdF9pZCk7XHJcbiAgICAgIHRoaXMuc3RvcmUuY3JlYXRlR3JvdXBDb252ZXJzYXRpb24oaWRzLCB0aGlzLmdyb3VwTmFtZS50cmltKCksIHtcclxuICAgICAgICBlcnJvcjogKCkgPT4ge1xyXG4gICAgICAgICAgdGhpcy5jcmVhdGluZ0dyb3VwID0gZmFsc2U7XHJcbiAgICAgICAgfSxcclxuICAgICAgfSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICByZXF1ZXN0RGVsZXRlR3JvdXAoKTogdm9pZCB7XHJcbiAgICBpZiAoIXRoaXMuZWRpdGluZ0NvbnZlcnNhdGlvbklkIHx8IHRoaXMuZGVsZXRpbmdHcm91cCkgcmV0dXJuO1xyXG4gICAgdGhpcy5zaG93RGVsZXRlQ29uZmlybSA9IHRydWU7XHJcbiAgfVxyXG5cclxuICBjYW5jZWxEZWxldGVHcm91cCgpOiB2b2lkIHtcclxuICAgIGlmICh0aGlzLmRlbGV0aW5nR3JvdXApIHJldHVybjtcclxuICAgIHRoaXMuc2hvd0RlbGV0ZUNvbmZpcm0gPSBmYWxzZTtcclxuICB9XHJcblxyXG4gIGNvbmZpcm1EZWxldGVHcm91cCgpOiB2b2lkIHtcclxuICAgIGlmICh0aGlzLmVkaXRpbmdDb252ZXJzYXRpb25JZCAmJiAhdGhpcy5kZWxldGluZ0dyb3VwKSB7XHJcbiAgICAgIHRoaXMuZGVsZXRpbmdHcm91cCA9IHRydWU7XHJcbiAgICAgIHRoaXMuc3RvcmUuZGVsZXRlR3JvdXAodGhpcy5lZGl0aW5nQ29udmVyc2F0aW9uSWQsIHtcclxuICAgICAgICBlcnJvcjogKCkgPT4ge1xyXG4gICAgICAgICAgdGhpcy5kZWxldGluZ0dyb3VwID0gZmFsc2U7XHJcbiAgICAgICAgICB0aGlzLnNob3dEZWxldGVDb25maXJtID0gZmFsc2U7XHJcbiAgICAgICAgfSxcclxuICAgICAgfSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBnb0JhY2soKTogdm9pZCB7XHJcbiAgICBpZiAodGhpcy5pc0VkaXRNb2RlKSB7XHJcbiAgICAgIHRoaXMuc3RvcmUuY2xlYXJHcm91cFNldHRpbmdzKCk7XHJcbiAgICAgIHRoaXMuc3RvcmUuc2V0VmlldygnY2hhdCcpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgdGhpcy5zdG9yZS5zZXRWaWV3KCdpbmJveCcpO1xyXG4gICAgfVxyXG4gIH1cclxufVxyXG4iXX0=