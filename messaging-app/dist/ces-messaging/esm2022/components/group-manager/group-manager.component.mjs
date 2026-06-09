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
    isProjectGroup = false;
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
                this.isProjectGroup = !!settings.isProject;
                this.selectedContacts = [];
                this.showDeleteConfirm = false;
                this.loadCurrentMembers(settings.conversationId);
            }
            else {
                this.isEditMode = false;
                this.isProjectGroup = false;
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
                if (this.isEditMode && !this.currentUserIsAdmin) {
                    this.selectedContacts = [];
                }
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
    isAdminMember(member) {
        return member.is_admin === true ||
            member.is_admin === 'true' ||
            member.is_admin === 'True' ||
            String(member.role || '').toLowerCase() === 'admin';
    }
    get currentUserIsAdmin() {
        if (!this.creatorContactId)
            return false;
        const me = this.currentMembers.find((m) => String(m.contact_id) === String(this.creatorContactId));
        return !!me && this.isAdminMember(me);
    }
    get canManageMembers() {
        return !this.isEditMode || this.currentUserIsAdmin;
    }
    get canRenameGroup() {
        return this.isEditMode && this.currentUserIsAdmin && !this.isProjectGroup;
    }
    canRemoveMember(member) {
        return this.canManageMembers && String(member.contact_id) !== String(this.creatorContactId);
    }
    get canSubmit() {
        if (this.creatingGroup)
            return false;
        if (!this.groupName.trim())
            return false;
        if (this.isEditMode) {
            if (!this.canManageMembers)
                return false;
            const renamed = this.canRenameGroup && this.groupName.trim() !== this.originalGroupName;
            return renamed || this.selectedContacts.length > 0;
        }
        return this.selectedContacts.length >= 1;
    }
    isSelected(contact) {
        return this.selectedContacts.some((c) => c.contact_id === contact.contact_id);
    }
    toggleContact(contact) {
        if (this.isEditMode && !this.canManageMembers)
            return;
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
        if (!this.editingConversationId || !this.canRemoveMember(member))
            return;
        if (confirm(`Remove ${this.getMemberName(member)} from this group?`)) {
            this.store.manageGroup('remove', this.editingConversationId, undefined, [member.contact_id], {
                success: () => {
                    this.currentMembers = this.currentMembers.filter(m => m.contact_id !== member.contact_id);
                },
            });
        }
    }
    setAdmin(member, isAdmin) {
        if (!this.editingConversationId || !this.canManageMembers)
            return;
        if (String(member.contact_id) === String(this.creatorContactId))
            return;
        this.store.setGroupAdmin(this.editingConversationId, member.contact_id, isAdmin, {
            success: () => {
                this.currentMembers = this.currentMembers.map((m) => String(m.contact_id) === String(member.contact_id)
                    ? { ...m, role: isAdmin ? 'admin' : 'member', is_admin: isAdmin }
                    : m);
            },
        });
    }
    onSubmit() {
        if (!this.canSubmit)
            return;
        if (this.isEditMode && this.editingConversationId) {
            if (this.canRenameGroup && this.groupName.trim() !== this.originalGroupName) {
                this.store.manageGroup('rename', this.editingConversationId, this.groupName.trim());
            }
            if (this.canManageMembers && this.selectedContacts.length > 0) {
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
            [readonly]="isProjectGroup || (isEditMode && !canManageMembers)"
            [class.readonly]="isProjectGroup || (isEditMode && !canManageMembers)"
          />
          <div *ngIf="isProjectGroup" class="field-note">Project group names are locked to the GIS project name.</div>
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
                  <span class="member-name">
                    {{ getMemberName(m) }}{{ m.contact_id === creatorContactId ? ' (you)' : '' }}
                    <span *ngIf="isAdminMember(m)" class="admin-badge">Admin</span>
                  </span>
                  <span class="member-sub">{{ m.company || m.email }}</span>
                </div>
                <button 
                  *ngIf="canManageMembers && m.contact_id !== creatorContactId"
                  mat-icon-button
                  class="admin-member-btn"
                  (click)="setAdmin(m, !isAdminMember(m))"
                  [matTooltip]="isAdminMember(m) ? 'Remove admin' : 'Make admin'"
                  matTooltipPosition="left"
                >
                  <mat-icon>{{ isAdminMember(m) ? 'shield' : 'admin_panel_settings' }}</mat-icon>
                </button>
                <button 
                  *ngIf="canRemoveMember(m)" 
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

          <div *ngIf="canManageMembers" class="form-section section-gap">
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

        <div *ngIf="selectedContacts.length > 0 && (!isEditMode || canManageMembers)" class="selected-chips">
          <div *ngFor="let c of selectedContacts" class="chip">
            <span>{{ getDisplayName(c) }}</span>
            <button mat-icon-button class="chip-remove" (click)="removeContact(c)">
              <mat-icon>close</mat-icon>
            </button>
          </div>
        </div>

        <div *ngIf="!isEditMode || canManageMembers" class="contacts-list">
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
          *ngIf="!isEditMode || canManageMembers"
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
  `, isInline: true, styles: [".group-manager{display:flex;flex-direction:column;height:100%;position:relative}.header{display:flex;align-items:center;padding:12px 8px 12px 4px;border-bottom:1px solid rgba(255,255,255,.15);gap:4px;flex-shrink:0}.header h3{margin:0;font-size:18px;font-weight:600;color:#fff}.hdr-btn{border-radius:6px!important;transition:background .15s,box-shadow .15s}.hdr-btn:hover{background:#ffffff26!important;box-shadow:0 2px 8px #0003}.hdr-btn mat-icon{color:#fffc}.scrollable{flex:1;overflow-y:auto}.form-section{padding:12px 16px 0}.section-gap{padding-top:16px}.field-label{display:block;font-size:12px;font-weight:600;color:#ffffffb3;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px}.text-field{width:100%;padding:10px 12px;border:1px solid rgba(255,255,255,.25);border-radius:8px;font-size:14px;color:#fff;background:#ffffff1a;outline:none;transition:border-color .2s;box-sizing:border-box}.text-field:focus{border-color:#ffffff80}.text-field::placeholder{color:#ffffff80}.text-field.readonly{cursor:not-allowed;color:#ffffffbf;background:#ffffff0f;border-color:#ffffff29}.field-note{margin-top:6px;font-size:12px;color:#ffffff8c}.loading-row{display:flex;align-items:center;gap:8px;color:#fff9;font-size:13px;padding:8px 0}.members-list{border-radius:8px;overflow:hidden}.member-row{display:flex;align-items:center;padding:8px 12px;gap:10px;background:#ffffff12;border-bottom:1px solid rgba(255,255,255,.06)}.member-row:last-child{border-bottom:none}.member-avatar{width:30px;height:30px;border-radius:50%;background:#fff3;display:flex;align-items:center;justify-content:center;flex-shrink:0}.member-avatar mat-icon{color:#fff;font-size:18px}.member-info{display:flex;flex-direction:column;flex:1;min-width:0}.member-name{font-size:13px;font-weight:500;color:#fff}.admin-badge{display:inline-flex;align-items:center;margin-left:6px;padding:1px 6px;border-radius:999px;color:#bfdbfe;background:#2563eb38;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em}.member-sub{font-size:11px;color:#ffffff80}.remove-member-btn{color:#fff9!important}.admin-member-btn{color:#93c5fdf2!important}.remove-member-btn:hover{color:#f87171!important;background:#f871711a!important}.empty-members{font-size:13px;color:#ffffff80;padding:8px 0}.search-bar{display:flex;align-items:center;padding:8px 12px;background:#ffffff1a;border-radius:10px}.search-icon{color:#fff9;font-size:20px;width:20px;height:20px;margin-right:8px}.search-input{flex:1;border:none;outline:none;background:transparent;font-size:14px;color:#fff}.search-input::placeholder{color:#ffffff80}.selected-chips{display:flex;flex-wrap:wrap;gap:6px;padding:8px 16px}.chip{display:flex;align-items:center;background:#fff3;color:#fff;border-radius:16px;padding:4px 6px 4px 12px;font-size:12px;font-weight:500}.chip-remove{width:20px!important;height:20px!important;line-height:20px!important}.chip-remove mat-icon{font-size:14px;width:14px;height:14px;color:#fffc}.contacts-list{padding-top:4px}.contact-item{display:flex;align-items:center;padding:10px 16px;cursor:pointer;transition:background .15s;gap:12px}.contact-item:hover{background:#ffffff14}.contact-item.selected{background:#ffffff26}.contact-avatar{width:36px;height:36px;border-radius:50%;background:#fff3;display:flex;align-items:center;justify-content:center;flex-shrink:0}.contact-avatar mat-icon{color:#fff;font-size:20px}.contact-info{flex:1;display:flex;flex-direction:column}.contact-name{font-weight:500;font-size:14px;color:#fff}.contact-company{font-size:12px;color:#fff9}.check-icon{color:#22c55e;font-size:22px}.action-bar{padding:12px 16px;border-top:1px solid rgba(255,255,255,.1);display:flex;flex-direction:column;gap:8px;flex-shrink:0}.create-btn{width:100%;background:#fff3!important;color:#fff!important;border-radius:10px;font-weight:600}.create-btn:disabled{opacity:.5}.create-btn mat-icon{margin-right:8px}.delete-btn{width:100%;color:#f87171!important;border-color:#f8717166!important;border-radius:10px;font-weight:600}.delete-btn mat-icon{margin-right:8px}.confirm-overlay{position:absolute;inset:0;z-index:10;display:flex;align-items:flex-end;padding:16px;background:#0413229e;-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);box-sizing:border-box}.confirm-card{width:100%;padding:16px;border-radius:14px;background:#0c1f35;border:1px solid rgba(255,255,255,.14);box-shadow:0 16px 40px #00000073;color:#fff}.confirm-icon{width:36px;height:36px;border-radius:50%;background:#f8717124;display:flex;align-items:center;justify-content:center;margin-bottom:10px}.confirm-icon mat-icon{color:#f87171}.confirm-copy h4{margin:0 0 6px;font-size:16px;font-weight:700}.confirm-copy p{margin:0;color:#ffffffb3;font-size:13px;line-height:1.4}.confirm-actions{display:flex;gap:8px;margin-top:16px}.confirm-cancel,.confirm-delete{flex:1;border-radius:10px;font-weight:600}.confirm-cancel{color:#fff!important;border-color:#ffffff40!important}.confirm-delete{background:#dc2626e6!important;color:#fff!important}.confirm-delete mat-icon{margin-right:6px;font-size:18px;width:18px;height:18px}\n"], dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i4.NgForOf, selector: "[ngFor][ngForOf]", inputs: ["ngForOf", "ngForTrackBy", "ngForTemplate"] }, { kind: "directive", type: i4.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "ngmodule", type: FormsModule }, { kind: "directive", type: i5.DefaultValueAccessor, selector: "input:not([type=checkbox])[formControlName],textarea[formControlName],input:not([type=checkbox])[formControl],textarea[formControl],input:not([type=checkbox])[ngModel],textarea[ngModel],[ngDefaultControl]" }, { kind: "directive", type: i5.NgControlStatus, selector: "[formControlName],[ngModel],[formControl]" }, { kind: "directive", type: i5.NgModel, selector: "[ngModel]:not([formControlName]):not([formControl])", inputs: ["name", "disabled", "ngModel", "ngModelOptions"], outputs: ["ngModelChange"], exportAs: ["ngModel"] }, { kind: "ngmodule", type: MatIconModule }, { kind: "component", type: i6.MatIcon, selector: "mat-icon", inputs: ["color", "inline", "svgIcon", "fontSet", "fontIcon"], exportAs: ["matIcon"] }, { kind: "ngmodule", type: MatButtonModule }, { kind: "component", type: i7.MatButton, selector: "    button[mat-button], button[mat-raised-button], button[mat-flat-button],    button[mat-stroked-button]  ", exportAs: ["matButton"] }, { kind: "component", type: i7.MatIconButton, selector: "button[mat-icon-button]", exportAs: ["matButton"] }, { kind: "ngmodule", type: MatRippleModule }, { kind: "directive", type: i8.MatRipple, selector: "[mat-ripple], [matRipple]", inputs: ["matRippleColor", "matRippleUnbounded", "matRippleCentered", "matRippleRadius", "matRippleAnimation", "matRippleDisabled", "matRippleTrigger"], exportAs: ["matRipple"] }, { kind: "ngmodule", type: MatTooltipModule }, { kind: "directive", type: i9.MatTooltip, selector: "[matTooltip]", inputs: ["matTooltipPosition", "matTooltipPositionAtOrigin", "matTooltipDisabled", "matTooltipShowDelay", "matTooltipHideDelay", "matTooltipTouchGestures", "matTooltip", "matTooltipClass"], exportAs: ["matTooltip"] }, { kind: "ngmodule", type: MatProgressSpinnerModule }, { kind: "component", type: i10.MatProgressSpinner, selector: "mat-progress-spinner, mat-spinner", inputs: ["color", "mode", "value", "diameter", "strokeWidth"], exportAs: ["matProgressSpinner"] }] });
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
            [readonly]="isProjectGroup || (isEditMode && !canManageMembers)"
            [class.readonly]="isProjectGroup || (isEditMode && !canManageMembers)"
          />
          <div *ngIf="isProjectGroup" class="field-note">Project group names are locked to the GIS project name.</div>
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
                  <span class="member-name">
                    {{ getMemberName(m) }}{{ m.contact_id === creatorContactId ? ' (you)' : '' }}
                    <span *ngIf="isAdminMember(m)" class="admin-badge">Admin</span>
                  </span>
                  <span class="member-sub">{{ m.company || m.email }}</span>
                </div>
                <button 
                  *ngIf="canManageMembers && m.contact_id !== creatorContactId"
                  mat-icon-button
                  class="admin-member-btn"
                  (click)="setAdmin(m, !isAdminMember(m))"
                  [matTooltip]="isAdminMember(m) ? 'Remove admin' : 'Make admin'"
                  matTooltipPosition="left"
                >
                  <mat-icon>{{ isAdminMember(m) ? 'shield' : 'admin_panel_settings' }}</mat-icon>
                </button>
                <button 
                  *ngIf="canRemoveMember(m)" 
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

          <div *ngIf="canManageMembers" class="form-section section-gap">
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

        <div *ngIf="selectedContacts.length > 0 && (!isEditMode || canManageMembers)" class="selected-chips">
          <div *ngFor="let c of selectedContacts" class="chip">
            <span>{{ getDisplayName(c) }}</span>
            <button mat-icon-button class="chip-remove" (click)="removeContact(c)">
              <mat-icon>close</mat-icon>
            </button>
          </div>
        </div>

        <div *ngIf="!isEditMode || canManageMembers" class="contacts-list">
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
          *ngIf="!isEditMode || canManageMembers"
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
  `, styles: [".group-manager{display:flex;flex-direction:column;height:100%;position:relative}.header{display:flex;align-items:center;padding:12px 8px 12px 4px;border-bottom:1px solid rgba(255,255,255,.15);gap:4px;flex-shrink:0}.header h3{margin:0;font-size:18px;font-weight:600;color:#fff}.hdr-btn{border-radius:6px!important;transition:background .15s,box-shadow .15s}.hdr-btn:hover{background:#ffffff26!important;box-shadow:0 2px 8px #0003}.hdr-btn mat-icon{color:#fffc}.scrollable{flex:1;overflow-y:auto}.form-section{padding:12px 16px 0}.section-gap{padding-top:16px}.field-label{display:block;font-size:12px;font-weight:600;color:#ffffffb3;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px}.text-field{width:100%;padding:10px 12px;border:1px solid rgba(255,255,255,.25);border-radius:8px;font-size:14px;color:#fff;background:#ffffff1a;outline:none;transition:border-color .2s;box-sizing:border-box}.text-field:focus{border-color:#ffffff80}.text-field::placeholder{color:#ffffff80}.text-field.readonly{cursor:not-allowed;color:#ffffffbf;background:#ffffff0f;border-color:#ffffff29}.field-note{margin-top:6px;font-size:12px;color:#ffffff8c}.loading-row{display:flex;align-items:center;gap:8px;color:#fff9;font-size:13px;padding:8px 0}.members-list{border-radius:8px;overflow:hidden}.member-row{display:flex;align-items:center;padding:8px 12px;gap:10px;background:#ffffff12;border-bottom:1px solid rgba(255,255,255,.06)}.member-row:last-child{border-bottom:none}.member-avatar{width:30px;height:30px;border-radius:50%;background:#fff3;display:flex;align-items:center;justify-content:center;flex-shrink:0}.member-avatar mat-icon{color:#fff;font-size:18px}.member-info{display:flex;flex-direction:column;flex:1;min-width:0}.member-name{font-size:13px;font-weight:500;color:#fff}.admin-badge{display:inline-flex;align-items:center;margin-left:6px;padding:1px 6px;border-radius:999px;color:#bfdbfe;background:#2563eb38;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em}.member-sub{font-size:11px;color:#ffffff80}.remove-member-btn{color:#fff9!important}.admin-member-btn{color:#93c5fdf2!important}.remove-member-btn:hover{color:#f87171!important;background:#f871711a!important}.empty-members{font-size:13px;color:#ffffff80;padding:8px 0}.search-bar{display:flex;align-items:center;padding:8px 12px;background:#ffffff1a;border-radius:10px}.search-icon{color:#fff9;font-size:20px;width:20px;height:20px;margin-right:8px}.search-input{flex:1;border:none;outline:none;background:transparent;font-size:14px;color:#fff}.search-input::placeholder{color:#ffffff80}.selected-chips{display:flex;flex-wrap:wrap;gap:6px;padding:8px 16px}.chip{display:flex;align-items:center;background:#fff3;color:#fff;border-radius:16px;padding:4px 6px 4px 12px;font-size:12px;font-weight:500}.chip-remove{width:20px!important;height:20px!important;line-height:20px!important}.chip-remove mat-icon{font-size:14px;width:14px;height:14px;color:#fffc}.contacts-list{padding-top:4px}.contact-item{display:flex;align-items:center;padding:10px 16px;cursor:pointer;transition:background .15s;gap:12px}.contact-item:hover{background:#ffffff14}.contact-item.selected{background:#ffffff26}.contact-avatar{width:36px;height:36px;border-radius:50%;background:#fff3;display:flex;align-items:center;justify-content:center;flex-shrink:0}.contact-avatar mat-icon{color:#fff;font-size:20px}.contact-info{flex:1;display:flex;flex-direction:column}.contact-name{font-weight:500;font-size:14px;color:#fff}.contact-company{font-size:12px;color:#fff9}.check-icon{color:#22c55e;font-size:22px}.action-bar{padding:12px 16px;border-top:1px solid rgba(255,255,255,.1);display:flex;flex-direction:column;gap:8px;flex-shrink:0}.create-btn{width:100%;background:#fff3!important;color:#fff!important;border-radius:10px;font-weight:600}.create-btn:disabled{opacity:.5}.create-btn mat-icon{margin-right:8px}.delete-btn{width:100%;color:#f87171!important;border-color:#f8717166!important;border-radius:10px;font-weight:600}.delete-btn mat-icon{margin-right:8px}.confirm-overlay{position:absolute;inset:0;z-index:10;display:flex;align-items:flex-end;padding:16px;background:#0413229e;-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);box-sizing:border-box}.confirm-card{width:100%;padding:16px;border-radius:14px;background:#0c1f35;border:1px solid rgba(255,255,255,.14);box-shadow:0 16px 40px #00000073;color:#fff}.confirm-icon{width:36px;height:36px;border-radius:50%;background:#f8717124;display:flex;align-items:center;justify-content:center;margin-bottom:10px}.confirm-icon mat-icon{color:#f87171}.confirm-copy h4{margin:0 0 6px;font-size:16px;font-weight:700}.confirm-copy p{margin:0;color:#ffffffb3;font-size:13px;line-height:1.4}.confirm-actions{display:flex;gap:8px;margin-top:16px}.confirm-cancel,.confirm-delete{flex:1;border-radius:10px;font-weight:600}.confirm-cancel{color:#fff!important;border-color:#ffffff40!important}.confirm-delete{background:#dc2626e6!important;color:#fff!important}.confirm-delete mat-icon{margin-right:6px;font-size:18px;width:18px;height:18px}\n"] }]
        }], ctorParameters: () => [{ type: i1.MessagingStoreService }, { type: i2.MessagingApiService }, { type: i3.AuthService }] });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ3JvdXAtbWFuYWdlci5jb21wb25lbnQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvbGliL2NvbXBvbmVudHMvZ3JvdXAtbWFuYWdlci9ncm91cC1tYW5hZ2VyLmNvbXBvbmVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsU0FBUyxFQUFxQixNQUFNLGVBQWUsQ0FBQztBQUM3RCxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDL0MsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLGdCQUFnQixDQUFDO0FBQzdDLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSx3QkFBd0IsQ0FBQztBQUN2RCxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFDM0QsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHdCQUF3QixDQUFDO0FBQ3pELE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBQzdELE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBSzlFLE9BQU8sRUFBb0MscUJBQXFCLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQzs7Ozs7Ozs7Ozs7O0FBd2lCeEcsTUFBTSxPQUFPLHFCQUFxQjtJQWtCdEI7SUFDQTtJQUNBO0lBbkJWLFFBQVEsR0FBYyxFQUFFLENBQUM7SUFDekIsZ0JBQWdCLEdBQWMsRUFBRSxDQUFDO0lBQ2pDLGNBQWMsR0FBOEIsRUFBRSxDQUFDO0lBQy9DLFNBQVMsR0FBRyxFQUFFLENBQUM7SUFDZixpQkFBaUIsR0FBRyxFQUFFLENBQUM7SUFDdkIsV0FBVyxHQUFHLEVBQUUsQ0FBQztJQUNqQixVQUFVLEdBQUcsS0FBSyxDQUFDO0lBQ25CLGNBQWMsR0FBRyxLQUFLLENBQUM7SUFDdkIscUJBQXFCLEdBQWtCLElBQUksQ0FBQztJQUM1QyxnQkFBZ0IsR0FBa0IsSUFBSSxDQUFDO0lBQ3ZDLGNB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Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQStKVCIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IENvbXBvbmVudCwgT25Jbml0LCBPbkRlc3Ryb3kgfSBmcm9tICdAYW5ndWxhci9jb3JlJztcclxuaW1wb3J0IHsgQ29tbW9uTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvY29tbW9uJztcclxuaW1wb3J0IHsgRm9ybXNNb2R1bGUgfSBmcm9tICdAYW5ndWxhci9mb3Jtcyc7XHJcbmltcG9ydCB7IE1hdEljb25Nb2R1bGUgfSBmcm9tICdAYW5ndWxhci9tYXRlcmlhbC9pY29uJztcclxuaW1wb3J0IHsgTWF0QnV0dG9uTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvbWF0ZXJpYWwvYnV0dG9uJztcclxuaW1wb3J0IHsgTWF0UmlwcGxlTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvbWF0ZXJpYWwvY29yZSc7XHJcbmltcG9ydCB7IE1hdFRvb2x0aXBNb2R1bGUgfSBmcm9tICdAYW5ndWxhci9tYXRlcmlhbC90b29sdGlwJztcclxuaW1wb3J0IHsgTWF0UHJvZ3Jlc3NTcGlubmVyTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvbWF0ZXJpYWwvcHJvZ3Jlc3Mtc3Bpbm5lcic7XHJcbmltcG9ydCB7IFN1YnNjcmlwdGlvbiB9IGZyb20gJ3J4anMnO1xyXG5pbXBvcnQgeyBNZXNzYWdpbmdTdG9yZVNlcnZpY2UgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9tZXNzYWdpbmctc3RvcmUuc2VydmljZSc7XHJcbmltcG9ydCB7IE1lc3NhZ2luZ0FwaVNlcnZpY2UgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9tZXNzYWdpbmctYXBpLnNlcnZpY2UnO1xyXG5pbXBvcnQgeyBBdXRoU2VydmljZSB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL2F1dGguc2VydmljZSc7XHJcbmltcG9ydCB7IENvbnRhY3QsIENvbnZlcnNhdGlvblBhcnRpY2lwYW50LCBnZXRDb250YWN0RGlzcGxheU5hbWUgfSBmcm9tICcuLi8uLi9tb2RlbHMvbWVzc2FnaW5nLm1vZGVscyc7XHJcblxyXG5AQ29tcG9uZW50KHtcclxuICBzZWxlY3RvcjogJ2FwcC1ncm91cC1tYW5hZ2VyJyxcclxuICBzdGFuZGFsb25lOiB0cnVlLFxyXG4gIGltcG9ydHM6IFtDb21tb25Nb2R1bGUsIEZvcm1zTW9kdWxlLCBNYXRJY29uTW9kdWxlLCBNYXRCdXR0b25Nb2R1bGUsIE1hdFJpcHBsZU1vZHVsZSwgTWF0VG9vbHRpcE1vZHVsZSwgTWF0UHJvZ3Jlc3NTcGlubmVyTW9kdWxlXSxcclxuICB0ZW1wbGF0ZTogYFxyXG4gICAgPGRpdiBjbGFzcz1cImdyb3VwLW1hbmFnZXJcIj5cclxuICAgICAgPGRpdiBjbGFzcz1cImhlYWRlclwiPlxyXG4gICAgICAgIDxidXR0b24gbWF0LWljb24tYnV0dG9uIGNsYXNzPVwiaGRyLWJ0blwiIChjbGljayk9XCJnb0JhY2soKVwiIG1hdFRvb2x0aXA9XCJCYWNrXCIgbWF0VG9vbHRpcFBvc2l0aW9uPVwiYmVsb3dcIj5cclxuICAgICAgICAgIDxtYXQtaWNvbj5hcnJvd19iYWNrPC9tYXQtaWNvbj5cclxuICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICA8aDM+e3sgaXNFZGl0TW9kZSA/ICdHcm91cCBTZXR0aW5ncycgOiAnQ3JlYXRlIEdyb3VwJyB9fTwvaDM+XHJcbiAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgPGRpdiBjbGFzcz1cInNjcm9sbGFibGVcIj5cclxuICAgICAgICA8ZGl2IGNsYXNzPVwiZm9ybS1zZWN0aW9uXCI+XHJcbiAgICAgICAgICA8bGFiZWwgY2xhc3M9XCJmaWVsZC1sYWJlbFwiPkdyb3VwIE5hbWU8L2xhYmVsPlxyXG4gICAgICAgICAgPGlucHV0XHJcbiAgICAgICAgICAgIHR5cGU9XCJ0ZXh0XCJcclxuICAgICAgICAgICAgWyhuZ01vZGVsKV09XCJncm91cE5hbWVcIlxyXG4gICAgICAgICAgICBwbGFjZWhvbGRlcj1cIkVudGVyIGdyb3VwIG5hbWUuLi5cIlxyXG4gICAgICAgICAgICBjbGFzcz1cInRleHQtZmllbGRcIlxyXG4gICAgICAgICAgICBbcmVhZG9ubHldPVwiaXNQcm9qZWN0R3JvdXAgfHwgKGlzRWRpdE1vZGUgJiYgIWNhbk1hbmFnZU1lbWJlcnMpXCJcclxuICAgICAgICAgICAgW2NsYXNzLnJlYWRvbmx5XT1cImlzUHJvamVjdEdyb3VwIHx8IChpc0VkaXRNb2RlICYmICFjYW5NYW5hZ2VNZW1iZXJzKVwiXHJcbiAgICAgICAgICAvPlxyXG4gICAgICAgICAgPGRpdiAqbmdJZj1cImlzUHJvamVjdEdyb3VwXCIgY2xhc3M9XCJmaWVsZC1ub3RlXCI+UHJvamVjdCBncm91cCBuYW1lcyBhcmUgbG9ja2VkIHRvIHRoZSBHSVMgcHJvamVjdCBuYW1lLjwvZGl2PlxyXG4gICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICA8bmctY29udGFpbmVyICpuZ0lmPVwiaXNFZGl0TW9kZVwiPlxyXG4gICAgICAgICAgPGRpdiBjbGFzcz1cImZvcm0tc2VjdGlvbiBzZWN0aW9uLWdhcFwiPlxyXG4gICAgICAgICAgICA8bGFiZWwgY2xhc3M9XCJmaWVsZC1sYWJlbFwiPkN1cnJlbnQgTWVtYmVyczwvbGFiZWw+XHJcbiAgICAgICAgICAgIDxkaXYgKm5nSWY9XCJsb2FkaW5nTWVtYmVyc1wiIGNsYXNzPVwibG9hZGluZy1yb3dcIj5cclxuICAgICAgICAgICAgICA8bWF0LXNwaW5uZXIgZGlhbWV0ZXI9XCIxOFwiPjwvbWF0LXNwaW5uZXI+XHJcbiAgICAgICAgICAgICAgPHNwYW4+TG9hZGluZyBtZW1iZXJzLi4uPC9zcGFuPlxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgPGRpdiAqbmdJZj1cIiFsb2FkaW5nTWVtYmVyc1wiIGNsYXNzPVwibWVtYmVycy1saXN0XCI+XHJcbiAgICAgICAgICAgICAgPGRpdiAqbmdGb3I9XCJsZXQgbSBvZiBjdXJyZW50TWVtYmVyc1wiIGNsYXNzPVwibWVtYmVyLXJvd1wiPlxyXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cIm1lbWJlci1hdmF0YXJcIj48bWF0LWljb24+cGVyc29uPC9tYXQtaWNvbj48L2Rpdj5cclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJtZW1iZXItaW5mb1wiPlxyXG4gICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cIm1lbWJlci1uYW1lXCI+XHJcbiAgICAgICAgICAgICAgICAgICAge3sgZ2V0TWVtYmVyTmFtZShtKSB9fXt7IG0uY29udGFjdF9pZCA9PT0gY3JlYXRvckNvbnRhY3RJZCA/ICcgKHlvdSknIDogJycgfX1cclxuICAgICAgICAgICAgICAgICAgICA8c3BhbiAqbmdJZj1cImlzQWRtaW5NZW1iZXIobSlcIiBjbGFzcz1cImFkbWluLWJhZGdlXCI+QWRtaW48L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgIDwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJtZW1iZXItc3ViXCI+e3sgbS5jb21wYW55IHx8IG0uZW1haWwgfX08L3NwYW4+XHJcbiAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgIDxidXR0b24gXHJcbiAgICAgICAgICAgICAgICAgICpuZ0lmPVwiY2FuTWFuYWdlTWVtYmVycyAmJiBtLmNvbnRhY3RfaWQgIT09IGNyZWF0b3JDb250YWN0SWRcIlxyXG4gICAgICAgICAgICAgICAgICBtYXQtaWNvbi1idXR0b25cclxuICAgICAgICAgICAgICAgICAgY2xhc3M9XCJhZG1pbi1tZW1iZXItYnRuXCJcclxuICAgICAgICAgICAgICAgICAgKGNsaWNrKT1cInNldEFkbWluKG0sICFpc0FkbWluTWVtYmVyKG0pKVwiXHJcbiAgICAgICAgICAgICAgICAgIFttYXRUb29sdGlwXT1cImlzQWRtaW5NZW1iZXIobSkgPyAnUmVtb3ZlIGFkbWluJyA6ICdNYWtlIGFkbWluJ1wiXHJcbiAgICAgICAgICAgICAgICAgIG1hdFRvb2x0aXBQb3NpdGlvbj1cImxlZnRcIlxyXG4gICAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgICA8bWF0LWljb24+e3sgaXNBZG1pbk1lbWJlcihtKSA/ICdzaGllbGQnIDogJ2FkbWluX3BhbmVsX3NldHRpbmdzJyB9fTwvbWF0LWljb24+XHJcbiAgICAgICAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgICAgICAgIDxidXR0b24gXHJcbiAgICAgICAgICAgICAgICAgICpuZ0lmPVwiY2FuUmVtb3ZlTWVtYmVyKG0pXCIgXHJcbiAgICAgICAgICAgICAgICAgIG1hdC1pY29uLWJ1dHRvbiBcclxuICAgICAgICAgICAgICAgICAgY2xhc3M9XCJyZW1vdmUtbWVtYmVyLWJ0blwiXHJcbiAgICAgICAgICAgICAgICAgIChjbGljayk9XCJyZW1vdmVNZW1iZXIobSlcIlxyXG4gICAgICAgICAgICAgICAgICBtYXRUb29sdGlwPVwiUmVtb3ZlIGZyb20gZ3JvdXBcIlxyXG4gICAgICAgICAgICAgICAgICBtYXRUb29sdGlwUG9zaXRpb249XCJsZWZ0XCJcclxuICAgICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgICAgPG1hdC1pY29uPnBlcnNvbl9yZW1vdmU8L21hdC1pY29uPlxyXG4gICAgICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgPGRpdiAqbmdJZj1cImN1cnJlbnRNZW1iZXJzLmxlbmd0aCA9PT0gMFwiIGNsYXNzPVwiZW1wdHktbWVtYmVyc1wiPk5vIG1lbWJlcnMgZm91bmQ8L2Rpdj5cclxuICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgICA8ZGl2ICpuZ0lmPVwiY2FuTWFuYWdlTWVtYmVyc1wiIGNsYXNzPVwiZm9ybS1zZWN0aW9uIHNlY3Rpb24tZ2FwXCI+XHJcbiAgICAgICAgICAgIDxsYWJlbCBjbGFzcz1cImZpZWxkLWxhYmVsXCI+QWRkIE1lbWJlcnM8L2xhYmVsPlxyXG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwic2VhcmNoLWJhclwiPlxyXG4gICAgICAgICAgICAgIDxtYXQtaWNvbiBjbGFzcz1cInNlYXJjaC1pY29uXCI+c2VhcmNoPC9tYXQtaWNvbj5cclxuICAgICAgICAgICAgICA8aW5wdXQgdHlwZT1cInRleHRcIiBbKG5nTW9kZWwpXT1cInNlYXJjaFF1ZXJ5XCIgcGxhY2Vob2xkZXI9XCJTZWFyY2ggY29udGFjdHMuLi5cIiBjbGFzcz1cInNlYXJjaC1pbnB1dFwiIC8+XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgPC9uZy1jb250YWluZXI+XHJcblxyXG4gICAgICAgIDxuZy1jb250YWluZXIgKm5nSWY9XCIhaXNFZGl0TW9kZVwiPlxyXG4gICAgICAgICAgPGRpdiBjbGFzcz1cImZvcm0tc2VjdGlvbiBzZWN0aW9uLWdhcFwiPlxyXG4gICAgICAgICAgICA8bGFiZWwgY2xhc3M9XCJmaWVsZC1sYWJlbFwiPkFkZCBNZW1iZXJzIChtaW4gMSBvdGhlciBwZXJzb24pPC9sYWJlbD5cclxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cInNlYXJjaC1iYXJcIj5cclxuICAgICAgICAgICAgICA8bWF0LWljb24gY2xhc3M9XCJzZWFyY2gtaWNvblwiPnNlYXJjaDwvbWF0LWljb24+XHJcbiAgICAgICAgICAgICAgPGlucHV0IHR5cGU9XCJ0ZXh0XCIgWyhuZ01vZGVsKV09XCJzZWFyY2hRdWVyeVwiIHBsYWNlaG9sZGVyPVwiU2VhcmNoIGNvbnRhY3RzLi4uXCIgY2xhc3M9XCJzZWFyY2gtaW5wdXRcIiAvPlxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgIDwvbmctY29udGFpbmVyPlxyXG5cclxuICAgICAgICA8ZGl2ICpuZ0lmPVwic2VsZWN0ZWRDb250YWN0cy5sZW5ndGggPiAwICYmICghaXNFZGl0TW9kZSB8fCBjYW5NYW5hZ2VNZW1iZXJzKVwiIGNsYXNzPVwic2VsZWN0ZWQtY2hpcHNcIj5cclxuICAgICAgICAgIDxkaXYgKm5nRm9yPVwibGV0IGMgb2Ygc2VsZWN0ZWRDb250YWN0c1wiIGNsYXNzPVwiY2hpcFwiPlxyXG4gICAgICAgICAgICA8c3Bhbj57eyBnZXREaXNwbGF5TmFtZShjKSB9fTwvc3Bhbj5cclxuICAgICAgICAgICAgPGJ1dHRvbiBtYXQtaWNvbi1idXR0b24gY2xhc3M9XCJjaGlwLXJlbW92ZVwiIChjbGljayk9XCJyZW1vdmVDb250YWN0KGMpXCI+XHJcbiAgICAgICAgICAgICAgPG1hdC1pY29uPmNsb3NlPC9tYXQtaWNvbj5cclxuICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgPGRpdiAqbmdJZj1cIiFpc0VkaXRNb2RlIHx8IGNhbk1hbmFnZU1lbWJlcnNcIiBjbGFzcz1cImNvbnRhY3RzLWxpc3RcIj5cclxuICAgICAgICAgIDxkaXZcclxuICAgICAgICAgICAgKm5nRm9yPVwibGV0IGNvbnRhY3Qgb2YgZmlsdGVyZWRDb250YWN0c1wiXHJcbiAgICAgICAgICAgIGNsYXNzPVwiY29udGFjdC1pdGVtXCJcclxuICAgICAgICAgICAgbWF0UmlwcGxlXHJcbiAgICAgICAgICAgIFtjbGFzcy5zZWxlY3RlZF09XCJpc1NlbGVjdGVkKGNvbnRhY3QpXCJcclxuICAgICAgICAgICAgKGNsaWNrKT1cInRvZ2dsZUNvbnRhY3QoY29udGFjdClcIlxyXG4gICAgICAgICAgPlxyXG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwiY29udGFjdC1hdmF0YXJcIj5cclxuICAgICAgICAgICAgICA8bWF0LWljb24+cGVyc29uPC9tYXQtaWNvbj5cclxuICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJjb250YWN0LWluZm9cIj5cclxuICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cImNvbnRhY3QtbmFtZVwiPnt7IGdldERpc3BsYXlOYW1lKGNvbnRhY3QpIH19PC9zcGFuPlxyXG4gICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwiY29udGFjdC1jb21wYW55XCI+e3sgY29udGFjdC5jb21wYW55X25hbWUgfX08L3NwYW4+XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICA8bWF0LWljb24gKm5nSWY9XCJpc1NlbGVjdGVkKGNvbnRhY3QpXCIgY2xhc3M9XCJjaGVjay1pY29uXCI+Y2hlY2tfY2lyY2xlPC9tYXQtaWNvbj5cclxuICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgIDwvZGl2PlxyXG4gICAgICA8L2Rpdj5cclxuXHJcbiAgICAgIDxkaXYgY2xhc3M9XCJhY3Rpb24tYmFyXCI+XHJcbiAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgKm5nSWY9XCIhaXNFZGl0TW9kZSB8fCBjYW5NYW5hZ2VNZW1iZXJzXCJcclxuICAgICAgICAgIG1hdC1yYWlzZWQtYnV0dG9uXHJcbiAgICAgICAgICBbZGlzYWJsZWRdPVwiIWNhblN1Ym1pdFwiXHJcbiAgICAgICAgICAoY2xpY2spPVwib25TdWJtaXQoKVwiXHJcbiAgICAgICAgICBjbGFzcz1cImNyZWF0ZS1idG5cIlxyXG4gICAgICAgID5cclxuICAgICAgICAgIDxtYXQtaWNvbj57eyBpc0VkaXRNb2RlID8gJ3NhdmUnIDogJ2dyb3VwX2FkZCcgfX08L21hdC1pY29uPlxyXG4gICAgICAgICAgPG5nLWNvbnRhaW5lciAqbmdJZj1cIiFpc0VkaXRNb2RlICYmICFjcmVhdGluZ0dyb3VwXCI+Q3JlYXRlIEdyb3VwICh7eyBzZWxlY3RlZENvbnRhY3RzLmxlbmd0aCArIDEgfX0gbWVtYmVycyk8L25nLWNvbnRhaW5lcj5cclxuICAgICAgICAgIDxuZy1jb250YWluZXIgKm5nSWY9XCIhaXNFZGl0TW9kZSAmJiBjcmVhdGluZ0dyb3VwXCI+Q3JlYXRpbmcgZ3JvdXAuLi48L25nLWNvbnRhaW5lcj5cclxuICAgICAgICAgIDxuZy1jb250YWluZXIgKm5nSWY9XCJpc0VkaXRNb2RlXCI+U2F2ZSBDaGFuZ2VzPC9uZy1jb250YWluZXI+XHJcbiAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgKm5nSWY9XCJpc0VkaXRNb2RlXCJcclxuICAgICAgICAgIG1hdC1zdHJva2VkLWJ1dHRvblxyXG4gICAgICAgICAgY2xhc3M9XCJkZWxldGUtYnRuXCJcclxuICAgICAgICAgIFtkaXNhYmxlZF09XCJkZWxldGluZ0dyb3VwXCJcclxuICAgICAgICAgIChjbGljayk9XCJyZXF1ZXN0RGVsZXRlR3JvdXAoKVwiXHJcbiAgICAgICAgPlxyXG4gICAgICAgICAgPG1hdC1pY29uPmxvZ291dDwvbWF0LWljb24+XHJcbiAgICAgICAgICB7eyBkZWxldGluZ0dyb3VwID8gJ0V4aXRpbmcgZ3JvdXAuLi4nIDogJ0V4aXQgR3JvdXAnIH19XHJcbiAgICAgICAgPC9idXR0b24+XHJcbiAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgPGRpdiAqbmdJZj1cInNob3dEZWxldGVDb25maXJtXCIgY2xhc3M9XCJjb25maXJtLW92ZXJsYXlcIj5cclxuICAgICAgICA8ZGl2IGNsYXNzPVwiY29uZmlybS1jYXJkXCI+XHJcbiAgICAgICAgICA8ZGl2IGNsYXNzPVwiY29uZmlybS1pY29uXCI+XHJcbiAgICAgICAgICAgIDxtYXQtaWNvbj53YXJuaW5nPC9tYXQtaWNvbj5cclxuICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgPGRpdiBjbGFzcz1cImNvbmZpcm0tY29weVwiPlxyXG4gICAgICAgICAgICA8aDQ+RXhpdCBncm91cD88L2g0PlxyXG4gICAgICAgICAgICA8cD5BcmUgeW91IHN1cmUgeW91IHdhbnQgdG8gZXhpdCBcInt7IGdyb3VwTmFtZS50cmltKCkgfHwgJ3RoaXMgZ3JvdXAnIH19XCI/PC9wPlxyXG4gICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICA8ZGl2IGNsYXNzPVwiY29uZmlybS1hY3Rpb25zXCI+XHJcbiAgICAgICAgICAgIDxidXR0b24gbWF0LXN0cm9rZWQtYnV0dG9uIGNsYXNzPVwiY29uZmlybS1jYW5jZWxcIiBbZGlzYWJsZWRdPVwiZGVsZXRpbmdHcm91cFwiIChjbGljayk9XCJjYW5jZWxEZWxldGVHcm91cCgpXCI+XHJcbiAgICAgICAgICAgICAgQ2FuY2VsXHJcbiAgICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgICA8YnV0dG9uIG1hdC1yYWlzZWQtYnV0dG9uIGNsYXNzPVwiY29uZmlybS1kZWxldGVcIiBbZGlzYWJsZWRdPVwiZGVsZXRpbmdHcm91cFwiIChjbGljayk9XCJjb25maXJtRGVsZXRlR3JvdXAoKVwiPlxyXG4gICAgICAgICAgICAgIDxtYXQtaWNvbj5sb2dvdXQ8L21hdC1pY29uPlxyXG4gICAgICAgICAgICAgIHt7IGRlbGV0aW5nR3JvdXAgPyAnRXhpdGluZy4uLicgOiAnRXhpdCBHcm91cCcgfX1cclxuICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICA8L2Rpdj5cclxuICAgICAgPC9kaXY+XHJcbiAgICA8L2Rpdj5cclxuICBgLFxyXG4gIHN0eWxlczogW2BcclxuICAgIC5ncm91cC1tYW5hZ2VyIHtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcclxuICAgICAgaGVpZ2h0OiAxMDAlO1xyXG4gICAgICBwb3NpdGlvbjogcmVsYXRpdmU7XHJcbiAgICB9XHJcblxyXG4gICAgLmhlYWRlciB7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgIHBhZGRpbmc6IDEycHggOHB4IDEycHggNHB4O1xyXG4gICAgICBib3JkZXItYm90dG9tOiAxcHggc29saWQgcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjE1KTtcclxuICAgICAgZ2FwOiA0cHg7XHJcbiAgICAgIGZsZXgtc2hyaW5rOiAwO1xyXG4gICAgfVxyXG5cclxuICAgIC5oZWFkZXIgaDMge1xyXG4gICAgICBtYXJnaW46IDA7XHJcbiAgICAgIGZvbnQtc2l6ZTogMThweDtcclxuICAgICAgZm9udC13ZWlnaHQ6IDYwMDtcclxuICAgICAgY29sb3I6ICNmZmY7XHJcbiAgICB9XHJcblxyXG4gICAgLmhkci1idG4ge1xyXG4gICAgICBib3JkZXItcmFkaXVzOiA2cHggIWltcG9ydGFudDtcclxuICAgICAgdHJhbnNpdGlvbjogYmFja2dyb3VuZCAwLjE1cywgYm94LXNoYWRvdyAwLjE1cztcclxuICAgIH1cclxuXHJcbiAgICAuaGRyLWJ0bjpob3ZlciB7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xNSkgIWltcG9ydGFudDtcclxuICAgICAgYm94LXNoYWRvdzogMCAycHggOHB4IHJnYmEoMCwgMCwgMCwgMC4yKTtcclxuICAgIH1cclxuXHJcbiAgICAuaGRyLWJ0biBtYXQtaWNvbiB7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuOCk7XHJcbiAgICB9XHJcblxyXG4gICAgLnNjcm9sbGFibGUge1xyXG4gICAgICBmbGV4OiAxO1xyXG4gICAgICBvdmVyZmxvdy15OiBhdXRvO1xyXG4gICAgfVxyXG5cclxuICAgIC5mb3JtLXNlY3Rpb24ge1xyXG4gICAgICBwYWRkaW5nOiAxMnB4IDE2cHggMDtcclxuICAgIH1cclxuXHJcbiAgICAuc2VjdGlvbi1nYXAge1xyXG4gICAgICBwYWRkaW5nLXRvcDogMTZweDtcclxuICAgIH1cclxuXHJcbiAgICAuZmllbGQtbGFiZWwge1xyXG4gICAgICBkaXNwbGF5OiBibG9jaztcclxuICAgICAgZm9udC1zaXplOiAxMnB4O1xyXG4gICAgICBmb250LXdlaWdodDogNjAwO1xyXG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjcpO1xyXG4gICAgICB0ZXh0LXRyYW5zZm9ybTogdXBwZXJjYXNlO1xyXG4gICAgICBsZXR0ZXItc3BhY2luZzogMC4wNWVtO1xyXG4gICAgICBtYXJnaW4tYm90dG9tOiA2cHg7XHJcbiAgICB9XHJcblxyXG4gICAgLnRleHQtZmllbGQge1xyXG4gICAgICB3aWR0aDogMTAwJTtcclxuICAgICAgcGFkZGluZzogMTBweCAxMnB4O1xyXG4gICAgICBib3JkZXI6IDFweCBzb2xpZCByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMjUpO1xyXG4gICAgICBib3JkZXItcmFkaXVzOiA4cHg7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTRweDtcclxuICAgICAgY29sb3I6ICNmZmY7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xKTtcclxuICAgICAgb3V0bGluZTogbm9uZTtcclxuICAgICAgdHJhbnNpdGlvbjogYm9yZGVyLWNvbG9yIDAuMnM7XHJcbiAgICAgIGJveC1zaXppbmc6IGJvcmRlci1ib3g7XHJcbiAgICB9XHJcblxyXG4gICAgLnRleHQtZmllbGQ6Zm9jdXMgeyBib3JkZXItY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC41KTsgfVxyXG4gICAgLnRleHQtZmllbGQ6OnBsYWNlaG9sZGVyIHsgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC41KTsgfVxyXG4gICAgLnRleHQtZmllbGQucmVhZG9ubHkge1xyXG4gICAgICBjdXJzb3I6IG5vdC1hbGxvd2VkO1xyXG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjc1KTtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjA2KTtcclxuICAgICAgYm9yZGVyLWNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMTYpO1xyXG4gICAgfVxyXG5cclxuICAgIC5maWVsZC1ub3RlIHtcclxuICAgICAgbWFyZ2luLXRvcDogNnB4O1xyXG4gICAgICBmb250LXNpemU6IDEycHg7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNTUpO1xyXG4gICAgfVxyXG5cclxuICAgIC5sb2FkaW5nLXJvdyB7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgIGdhcDogOHB4O1xyXG4gICAgICBjb2xvcjogcmdiYSgyNTUsMjU1LDI1NSwwLjYpO1xyXG4gICAgICBmb250LXNpemU6IDEzcHg7XHJcbiAgICAgIHBhZGRpbmc6IDhweCAwO1xyXG4gICAgfVxyXG5cclxuICAgIC5tZW1iZXJzLWxpc3Qge1xyXG4gICAgICBib3JkZXItcmFkaXVzOiA4cHg7XHJcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XHJcbiAgICB9XHJcblxyXG4gICAgLm1lbWJlci1yb3cge1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBwYWRkaW5nOiA4cHggMTJweDtcclxuICAgICAgZ2FwOiAxMHB4O1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwyNTUsMjU1LDAuMDcpO1xyXG4gICAgICBib3JkZXItYm90dG9tOiAxcHggc29saWQgcmdiYSgyNTUsMjU1LDI1NSwwLjA2KTtcclxuICAgIH1cclxuXHJcbiAgICAubWVtYmVyLXJvdzpsYXN0LWNoaWxkIHsgYm9yZGVyLWJvdHRvbTogbm9uZTsgfVxyXG5cclxuICAgIC5tZW1iZXItYXZhdGFyIHtcclxuICAgICAgd2lkdGg6IDMwcHg7XHJcbiAgICAgIGhlaWdodDogMzBweDtcclxuICAgICAgYm9yZGVyLXJhZGl1czogNTAlO1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwyNTUsMjU1LDAuMik7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xyXG4gICAgICBmbGV4LXNocmluazogMDtcclxuICAgIH1cclxuXHJcbiAgICAubWVtYmVyLWF2YXRhciBtYXQtaWNvbiB7IGNvbG9yOiAjZmZmOyBmb250LXNpemU6IDE4cHg7IH1cclxuXHJcbiAgICAubWVtYmVyLWluZm8ge1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xyXG4gICAgICBmbGV4OiAxO1xyXG4gICAgICBtaW4td2lkdGg6IDA7XHJcbiAgICB9XHJcblxyXG4gICAgLm1lbWJlci1uYW1lIHtcclxuICAgICAgZm9udC1zaXplOiAxM3B4O1xyXG4gICAgICBmb250LXdlaWdodDogNTAwO1xyXG4gICAgICBjb2xvcjogI2ZmZjtcclxuICAgIH1cclxuXHJcbiAgICAuYWRtaW4tYmFkZ2Uge1xyXG4gICAgICBkaXNwbGF5OiBpbmxpbmUtZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAgbWFyZ2luLWxlZnQ6IDZweDtcclxuICAgICAgcGFkZGluZzogMXB4IDZweDtcclxuICAgICAgYm9yZGVyLXJhZGl1czogOTk5cHg7XHJcbiAgICAgIGNvbG9yOiAjYmZkYmZlO1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDM3LCA5OSwgMjM1LCAwLjIyKTtcclxuICAgICAgZm9udC1zaXplOiAxMHB4O1xyXG4gICAgICBmb250LXdlaWdodDogNzAwO1xyXG4gICAgICB0ZXh0LXRyYW5zZm9ybTogdXBwZXJjYXNlO1xyXG4gICAgICBsZXR0ZXItc3BhY2luZzogMC4wNGVtO1xyXG4gICAgfVxyXG5cclxuICAgIC5tZW1iZXItc3ViIHtcclxuICAgICAgZm9udC1zaXplOiAxMXB4O1xyXG4gICAgICBjb2xvcjogcmdiYSgyNTUsMjU1LDI1NSwwLjUpO1xyXG4gICAgfVxyXG5cclxuICAgIC5yZW1vdmUtbWVtYmVyLWJ0biB7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwyNTUsMjU1LDAuNikgIWltcG9ydGFudDtcclxuICAgIH1cclxuXHJcbiAgICAuYWRtaW4tbWVtYmVyLWJ0biB7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDE0NywxOTcsMjUzLDAuOTUpICFpbXBvcnRhbnQ7XHJcbiAgICB9XHJcblxyXG4gICAgLnJlbW92ZS1tZW1iZXItYnRuOmhvdmVyIHtcclxuICAgICAgY29sb3I6ICNmODcxNzEgIWltcG9ydGFudDtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNDgsMTEzLDExMywwLjEpICFpbXBvcnRhbnQ7XHJcbiAgICB9XHJcblxyXG4gICAgLmVtcHR5LW1lbWJlcnMge1xyXG4gICAgICBmb250LXNpemU6IDEzcHg7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwyNTUsMjU1LDAuNSk7XHJcbiAgICAgIHBhZGRpbmc6IDhweCAwO1xyXG4gICAgfVxyXG5cclxuICAgIC5zZWFyY2gtYmFyIHtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAgcGFkZGluZzogOHB4IDEycHg7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xKTtcclxuICAgICAgYm9yZGVyLXJhZGl1czogMTBweDtcclxuICAgIH1cclxuXHJcbiAgICAuc2VhcmNoLWljb24ge1xyXG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjYpO1xyXG4gICAgICBmb250LXNpemU6IDIwcHg7XHJcbiAgICAgIHdpZHRoOiAyMHB4O1xyXG4gICAgICBoZWlnaHQ6IDIwcHg7XHJcbiAgICAgIG1hcmdpbi1yaWdodDogOHB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5zZWFyY2gtaW5wdXQge1xyXG4gICAgICBmbGV4OiAxO1xyXG4gICAgICBib3JkZXI6IG5vbmU7XHJcbiAgICAgIG91dGxpbmU6IG5vbmU7XHJcbiAgICAgIGJhY2tncm91bmQ6IHRyYW5zcGFyZW50O1xyXG4gICAgICBmb250LXNpemU6IDE0cHg7XHJcbiAgICAgIGNvbG9yOiAjZmZmO1xyXG4gICAgfVxyXG5cclxuICAgIC5zZWFyY2gtaW5wdXQ6OnBsYWNlaG9sZGVyIHsgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC41KTsgfVxyXG5cclxuICAgIC5zZWxlY3RlZC1jaGlwcyB7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGZsZXgtd3JhcDogd3JhcDtcclxuICAgICAgZ2FwOiA2cHg7XHJcbiAgICAgIHBhZGRpbmc6IDhweCAxNnB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5jaGlwIHtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjIpO1xyXG4gICAgICBjb2xvcjogI2ZmZjtcclxuICAgICAgYm9yZGVyLXJhZGl1czogMTZweDtcclxuICAgICAgcGFkZGluZzogNHB4IDZweCA0cHggMTJweDtcclxuICAgICAgZm9udC1zaXplOiAxMnB4O1xyXG4gICAgICBmb250LXdlaWdodDogNTAwO1xyXG4gICAgfVxyXG5cclxuICAgIC5jaGlwLXJlbW92ZSB7XHJcbiAgICAgIHdpZHRoOiAyMHB4ICFpbXBvcnRhbnQ7XHJcbiAgICAgIGhlaWdodDogMjBweCAhaW1wb3J0YW50O1xyXG4gICAgICBsaW5lLWhlaWdodDogMjBweCAhaW1wb3J0YW50O1xyXG4gICAgfVxyXG5cclxuICAgIC5jaGlwLXJlbW92ZSBtYXQtaWNvbiB7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTRweDtcclxuICAgICAgd2lkdGg6IDE0cHg7XHJcbiAgICAgIGhlaWdodDogMTRweDtcclxuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC44KTtcclxuICAgIH1cclxuXHJcbiAgICAuY29udGFjdHMtbGlzdCB7XHJcbiAgICAgIHBhZGRpbmctdG9wOiA0cHg7XHJcbiAgICB9XHJcblxyXG4gICAgLmNvbnRhY3QtaXRlbSB7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgIHBhZGRpbmc6IDEwcHggMTZweDtcclxuICAgICAgY3Vyc29yOiBwb2ludGVyO1xyXG4gICAgICB0cmFuc2l0aW9uOiBiYWNrZ3JvdW5kIDAuMTVzO1xyXG4gICAgICBnYXA6IDEycHg7XHJcbiAgICB9XHJcblxyXG4gICAgLmNvbnRhY3QtaXRlbTpob3ZlciB7IGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4wOCk7IH1cclxuICAgIC5jb250YWN0LWl0ZW0uc2VsZWN0ZWQgeyBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMTUpOyB9XHJcblxyXG4gICAgLmNvbnRhY3QtYXZhdGFyIHtcclxuICAgICAgd2lkdGg6IDM2cHg7XHJcbiAgICAgIGhlaWdodDogMzZweDtcclxuICAgICAgYm9yZGVyLXJhZGl1czogNTAlO1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMik7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xyXG4gICAgICBmbGV4LXNocmluazogMDtcclxuICAgIH1cclxuXHJcbiAgICAuY29udGFjdC1hdmF0YXIgbWF0LWljb24geyBjb2xvcjogI2ZmZjsgZm9udC1zaXplOiAyMHB4OyB9XHJcblxyXG4gICAgLmNvbnRhY3QtaW5mbyB7XHJcbiAgICAgIGZsZXg6IDE7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XHJcbiAgICB9XHJcblxyXG4gICAgLmNvbnRhY3QtbmFtZSB7IGZvbnQtd2VpZ2h0OiA1MDA7IGZvbnQtc2l6ZTogMTRweDsgY29sb3I6ICNmZmY7IH1cclxuICAgIC5jb250YWN0LWNvbXBhbnkgeyBmb250LXNpemU6IDEycHg7IGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNik7IH1cclxuICAgIC5jaGVjay1pY29uIHsgY29sb3I6ICMyMmM1NWU7IGZvbnQtc2l6ZTogMjJweDsgfVxyXG5cclxuICAgIC5hY3Rpb24tYmFyIHtcclxuICAgICAgcGFkZGluZzogMTJweCAxNnB4O1xyXG4gICAgICBib3JkZXItdG9wOiAxcHggc29saWQgcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjEpO1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xyXG4gICAgICBnYXA6IDhweDtcclxuICAgICAgZmxleC1zaHJpbms6IDA7XHJcbiAgICB9XHJcblxyXG4gICAgLmNyZWF0ZS1idG4ge1xyXG4gICAgICB3aWR0aDogMTAwJTtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjIpICFpbXBvcnRhbnQ7XHJcbiAgICAgIGNvbG9yOiAjZmZmICFpbXBvcnRhbnQ7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDEwcHg7XHJcbiAgICAgIGZvbnQtd2VpZ2h0OiA2MDA7XHJcbiAgICB9XHJcblxyXG4gICAgLmNyZWF0ZS1idG46ZGlzYWJsZWQgeyBvcGFjaXR5OiAwLjU7IH1cclxuICAgIC5jcmVhdGUtYnRuIG1hdC1pY29uIHsgbWFyZ2luLXJpZ2h0OiA4cHg7IH1cclxuXHJcbiAgICAuZGVsZXRlLWJ0biB7XHJcbiAgICAgIHdpZHRoOiAxMDAlO1xyXG4gICAgICBjb2xvcjogI2Y4NzE3MSAhaW1wb3J0YW50O1xyXG4gICAgICBib3JkZXItY29sb3I6IHJnYmEoMjQ4LCAxMTMsIDExMywgMC40KSAhaW1wb3J0YW50O1xyXG4gICAgICBib3JkZXItcmFkaXVzOiAxMHB4O1xyXG4gICAgICBmb250LXdlaWdodDogNjAwO1xyXG4gICAgfVxyXG5cclxuICAgIC5kZWxldGUtYnRuIG1hdC1pY29uIHsgbWFyZ2luLXJpZ2h0OiA4cHg7IH1cclxuXHJcbiAgICAuY29uZmlybS1vdmVybGF5IHtcclxuICAgICAgcG9zaXRpb246IGFic29sdXRlO1xyXG4gICAgICBpbnNldDogMDtcclxuICAgICAgei1pbmRleDogMTA7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBmbGV4LWVuZDtcclxuICAgICAgcGFkZGluZzogMTZweDtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSg0LCAxOSwgMzQsIDAuNjIpO1xyXG4gICAgICBiYWNrZHJvcC1maWx0ZXI6IGJsdXIoM3B4KTtcclxuICAgICAgYm94LXNpemluZzogYm9yZGVyLWJveDtcclxuICAgIH1cclxuXHJcbiAgICAuY29uZmlybS1jYXJkIHtcclxuICAgICAgd2lkdGg6IDEwMCU7XHJcbiAgICAgIHBhZGRpbmc6IDE2cHg7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDE0cHg7XHJcbiAgICAgIGJhY2tncm91bmQ6ICMwYzFmMzU7XHJcbiAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xNCk7XHJcbiAgICAgIGJveC1zaGFkb3c6IDAgMTZweCA0MHB4IHJnYmEoMCwgMCwgMCwgMC40NSk7XHJcbiAgICAgIGNvbG9yOiAjZmZmO1xyXG4gICAgfVxyXG5cclxuICAgIC5jb25maXJtLWljb24ge1xyXG4gICAgICB3aWR0aDogMzZweDtcclxuICAgICAgaGVpZ2h0OiAzNnB4O1xyXG4gICAgICBib3JkZXItcmFkaXVzOiA1MCU7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjQ4LCAxMTMsIDExMywgMC4xNCk7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xyXG4gICAgICBtYXJnaW4tYm90dG9tOiAxMHB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5jb25maXJtLWljb24gbWF0LWljb24ge1xyXG4gICAgICBjb2xvcjogI2Y4NzE3MTtcclxuICAgIH1cclxuXHJcbiAgICAuY29uZmlybS1jb3B5IGg0IHtcclxuICAgICAgbWFyZ2luOiAwIDAgNnB4O1xyXG4gICAgICBmb250LXNpemU6IDE2cHg7XHJcbiAgICAgIGZvbnQtd2VpZ2h0OiA3MDA7XHJcbiAgICB9XHJcblxyXG4gICAgLmNvbmZpcm0tY29weSBwIHtcclxuICAgICAgbWFyZ2luOiAwO1xyXG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjcpO1xyXG4gICAgICBmb250LXNpemU6IDEzcHg7XHJcbiAgICAgIGxpbmUtaGVpZ2h0OiAxLjQ7XHJcbiAgICB9XHJcblxyXG4gICAgLmNvbmZpcm0tYWN0aW9ucyB7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGdhcDogOHB4O1xyXG4gICAgICBtYXJnaW4tdG9wOiAxNnB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5jb25maXJtLWNhbmNlbCxcclxuICAgIC5jb25maXJtLWRlbGV0ZSB7XHJcbiAgICAgIGZsZXg6IDE7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDEwcHg7XHJcbiAgICAgIGZvbnQtd2VpZ2h0OiA2MDA7XHJcbiAgICB9XHJcblxyXG4gICAgLmNvbmZpcm0tY2FuY2VsIHtcclxuICAgICAgY29sb3I6ICNmZmYgIWltcG9ydGFudDtcclxuICAgICAgYm9yZGVyLWNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMjUpICFpbXBvcnRhbnQ7XHJcbiAgICB9XHJcblxyXG4gICAgLmNvbmZpcm0tZGVsZXRlIHtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyMjAsIDM4LCAzOCwgMC45KSAhaW1wb3J0YW50O1xyXG4gICAgICBjb2xvcjogI2ZmZiAhaW1wb3J0YW50O1xyXG4gICAgfVxyXG5cclxuICAgIC5jb25maXJtLWRlbGV0ZSBtYXQtaWNvbiB7XHJcbiAgICAgIG1hcmdpbi1yaWdodDogNnB4O1xyXG4gICAgICBmb250LXNpemU6IDE4cHg7XHJcbiAgICAgIHdpZHRoOiAxOHB4O1xyXG4gICAgICBoZWlnaHQ6IDE4cHg7XHJcbiAgICB9XHJcbiAgYF0sXHJcbn0pXHJcbmV4cG9ydCBjbGFzcyBHcm91cE1hbmFnZXJDb21wb25lbnQgaW1wbGVtZW50cyBPbkluaXQsIE9uRGVzdHJveSB7XHJcbiAgY29udGFjdHM6IENvbnRhY3RbXSA9IFtdO1xyXG4gIHNlbGVjdGVkQ29udGFjdHM6IENvbnRhY3RbXSA9IFtdO1xyXG4gIGN1cnJlbnRNZW1iZXJzOiBDb252ZXJzYXRpb25QYXJ0aWNpcGFudFtdID0gW107XHJcbiAgZ3JvdXBOYW1lID0gJyc7XHJcbiAgb3JpZ2luYWxHcm91cE5hbWUgPSAnJztcclxuICBzZWFyY2hRdWVyeSA9ICcnO1xyXG4gIGlzRWRpdE1vZGUgPSBmYWxzZTtcclxuICBpc1Byb2plY3RHcm91cCA9IGZhbHNlO1xyXG4gIGVkaXRpbmdDb252ZXJzYXRpb25JZDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XHJcbiAgY3JlYXRvckNvbnRhY3RJZDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XHJcbiAgbG9hZGluZ01lbWJlcnMgPSBmYWxzZTtcclxuICBjcmVhdGluZ0dyb3VwID0gZmFsc2U7XHJcbiAgZGVsZXRpbmdHcm91cCA9IGZhbHNlO1xyXG4gIHNob3dEZWxldGVDb25maXJtID0gZmFsc2U7XHJcbiAgcHJpdmF0ZSBzdWJzOiBTdWJzY3JpcHRpb25bXSA9IFtdO1xyXG5cclxuICBjb25zdHJ1Y3RvcihcclxuICAgIHByaXZhdGUgc3RvcmU6IE1lc3NhZ2luZ1N0b3JlU2VydmljZSxcclxuICAgIHByaXZhdGUgYXBpOiBNZXNzYWdpbmdBcGlTZXJ2aWNlLFxyXG4gICAgcHJpdmF0ZSBhdXRoOiBBdXRoU2VydmljZVxyXG4gICkge31cclxuXHJcbiAgbmdPbkluaXQoKTogdm9pZCB7XHJcbiAgICB0aGlzLmNyZWF0b3JDb250YWN0SWQgPSB0aGlzLmF1dGguY29udGFjdElkO1xyXG4gICAgdGhpcy5zdG9yZS5sb2FkVmlzaWJsZUNvbnRhY3RzKCk7XHJcblxyXG4gICAgdGhpcy5zdWJzLnB1c2goXHJcbiAgICAgIHRoaXMuc3RvcmUudmlzaWJsZUNvbnRhY3RzLnN1YnNjcmliZSgoYykgPT4gKHRoaXMuY29udGFjdHMgPSBjKSlcclxuICAgICk7XHJcblxyXG4gICAgdGhpcy5zdWJzLnB1c2goXHJcbiAgICAgIHRoaXMuc3RvcmUuZ3JvdXBTZXR0aW5ncy5zdWJzY3JpYmUoKHNldHRpbmdzKSA9PiB7XHJcbiAgICAgICAgaWYgKHNldHRpbmdzKSB7XHJcbiAgICAgICAgICB0aGlzLmlzRWRpdE1vZGUgPSB0cnVlO1xyXG4gICAgICAgICAgdGhpcy5lZGl0aW5nQ29udmVyc2F0aW9uSWQgPSBzZXR0aW5ncy5jb252ZXJzYXRpb25JZDtcclxuICAgICAgICAgIHRoaXMuZ3JvdXBOYW1lID0gc2V0dGluZ3MubmFtZTtcclxuICAgICAgICAgIHRoaXMub3JpZ2luYWxHcm91cE5hbWUgPSBzZXR0aW5ncy5uYW1lO1xyXG4gICAgICAgICAgdGhpcy5pc1Byb2plY3RHcm91cCA9ICEhc2V0dGluZ3MuaXNQcm9qZWN0O1xyXG4gICAgICAgICAgdGhpcy5zZWxlY3RlZENvbnRhY3RzID0gW107XHJcbiAgICAgICAgICB0aGlzLnNob3dEZWxldGVDb25maXJtID0gZmFsc2U7XHJcbiAgICAgICAgICB0aGlzLmxvYWRDdXJyZW50TWVtYmVycyhzZXR0aW5ncy5jb252ZXJzYXRpb25JZCk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIHRoaXMuaXNFZGl0TW9kZSA9IGZhbHNlO1xyXG4gICAgICAgICAgdGhpcy5pc1Byb2plY3RHcm91cCA9IGZhbHNlO1xyXG4gICAgICAgICAgdGhpcy5lZGl0aW5nQ29udmVyc2F0aW9uSWQgPSBudWxsO1xyXG4gICAgICAgICAgdGhpcy5ncm91cE5hbWUgPSAnJztcclxuICAgICAgICAgIHRoaXMub3JpZ2luYWxHcm91cE5hbWUgPSAnJztcclxuICAgICAgICAgIHRoaXMuc2VsZWN0ZWRDb250YWN0cyA9IFtdO1xyXG4gICAgICAgICAgdGhpcy5jdXJyZW50TWVtYmVycyA9IFtdO1xyXG4gICAgICAgICAgdGhpcy5zaG93RGVsZXRlQ29uZmlybSA9IGZhbHNlO1xyXG4gICAgICAgIH1cclxuICAgICAgfSlcclxuICAgICk7XHJcbiAgfVxyXG5cclxuICBuZ09uRGVzdHJveSgpOiB2b2lkIHtcclxuICAgIHRoaXMuc3Vicy5mb3JFYWNoKChzKSA9PiBzLnVuc3Vic2NyaWJlKCkpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBsb2FkQ3VycmVudE1lbWJlcnMoY29udmVyc2F0aW9uSWQ6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgdGhpcy5sb2FkaW5nTWVtYmVycyA9IHRydWU7XHJcbiAgICB0aGlzLmFwaS5nZXRDb252ZXJzYXRpb25QYXJ0aWNpcGFudHMoY29udmVyc2F0aW9uSWQpLnN1YnNjcmliZSh7XHJcbiAgICAgIG5leHQ6IChtZW1iZXJzKSA9PiB7XHJcbiAgICAgICAgdGhpcy5jdXJyZW50TWVtYmVycyA9IG1lbWJlcnM7XHJcbiAgICAgICAgdGhpcy5sb2FkaW5nTWVtYmVycyA9IGZhbHNlO1xyXG4gICAgICAgIGlmICh0aGlzLmlzRWRpdE1vZGUgJiYgIXRoaXMuY3VycmVudFVzZXJJc0FkbWluKSB7XHJcbiAgICAgICAgICB0aGlzLnNlbGVjdGVkQ29udGFjdHMgPSBbXTtcclxuICAgICAgICB9XHJcbiAgICAgIH0sXHJcbiAgICAgIGVycm9yOiAoKSA9PiB7XHJcbiAgICAgICAgdGhpcy5sb2FkaW5nTWVtYmVycyA9IGZhbHNlO1xyXG4gICAgICB9LFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBnZXQgZmlsdGVyZWRDb250YWN0cygpOiBDb250YWN0W10ge1xyXG4gICAgY29uc3QgYWxyZWFkeUluR3JvdXAgPSBuZXcgU2V0KHRoaXMuY3VycmVudE1lbWJlcnMubWFwKChtKSA9PiBtLmNvbnRhY3RfaWQpKTtcclxuICAgIGxldCBsaXN0ID0gdGhpcy5jb250YWN0cy5maWx0ZXIoXHJcbiAgICAgIChjKSA9PiBjLmNvbnRhY3RfaWQgIT09IHRoaXMuY3JlYXRvckNvbnRhY3RJZCAmJiAhYWxyZWFkeUluR3JvdXAuaGFzKGMuY29udGFjdF9pZClcclxuICAgICk7XHJcbiAgICBpZiAodGhpcy5zZWFyY2hRdWVyeS50cmltKCkpIHtcclxuICAgICAgY29uc3QgcSA9IHRoaXMuc2VhcmNoUXVlcnkudG9Mb3dlckNhc2UoKTtcclxuICAgICAgbGlzdCA9IGxpc3QuZmlsdGVyKFxyXG4gICAgICAgIChjKSA9PlxyXG4gICAgICAgICAgdGhpcy5nZXREaXNwbGF5TmFtZShjKS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKHEpIHx8XHJcbiAgICAgICAgICAoYy5jb21wYW55X25hbWUgfHwgJycpLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMocSlcclxuICAgICAgKTtcclxuICAgIH1cclxuICAgIHJldHVybiBsaXN0O1xyXG4gIH1cclxuXHJcbiAgZ2V0RGlzcGxheU5hbWUoY29udGFjdDogQ29udGFjdCk6IHN0cmluZyB7XHJcbiAgICByZXR1cm4gZ2V0Q29udGFjdERpc3BsYXlOYW1lKGNvbnRhY3QpO1xyXG4gIH1cclxuXHJcbiAgZ2V0TWVtYmVyTmFtZShtZW1iZXI6IENvbnZlcnNhdGlvblBhcnRpY2lwYW50KTogc3RyaW5nIHtcclxuICAgIHJldHVybiBtZW1iZXIudXNlcm5hbWUgfHwgbWVtYmVyLmVtYWlsIHx8IGBDb250YWN0ICR7bWVtYmVyLmNvbnRhY3RfaWR9YDtcclxuICB9XHJcblxyXG4gIGlzQWRtaW5NZW1iZXIobWVtYmVyOiBDb252ZXJzYXRpb25QYXJ0aWNpcGFudCk6IGJvb2xlYW4ge1xyXG4gICAgcmV0dXJuIG1lbWJlci5pc19hZG1pbiA9PT0gdHJ1ZSB8fFxyXG4gICAgICBtZW1iZXIuaXNfYWRtaW4gPT09ICd0cnVlJyB8fFxyXG4gICAgICBtZW1iZXIuaXNfYWRtaW4gPT09ICdUcnVlJyB8fFxyXG4gICAgICBTdHJpbmcobWVtYmVyLnJvbGUgfHwgJycpLnRvTG93ZXJDYXNlKCkgPT09ICdhZG1pbic7XHJcbiAgfVxyXG5cclxuICBnZXQgY3VycmVudFVzZXJJc0FkbWluKCk6IGJvb2xlYW4ge1xyXG4gICAgaWYgKCF0aGlzLmNyZWF0b3JDb250YWN0SWQpIHJldHVybiBmYWxzZTtcclxuICAgIGNvbnN0IG1lID0gdGhpcy5jdXJyZW50TWVtYmVycy5maW5kKChtKSA9PiBTdHJpbmcobS5jb250YWN0X2lkKSA9PT0gU3RyaW5nKHRoaXMuY3JlYXRvckNvbnRhY3RJZCkpO1xyXG4gICAgcmV0dXJuICEhbWUgJiYgdGhpcy5pc0FkbWluTWVtYmVyKG1lKTtcclxuICB9XHJcblxyXG4gIGdldCBjYW5NYW5hZ2VNZW1iZXJzKCk6IGJvb2xlYW4ge1xyXG4gICAgcmV0dXJuICF0aGlzLmlzRWRpdE1vZGUgfHwgdGhpcy5jdXJyZW50VXNlcklzQWRtaW47XHJcbiAgfVxyXG5cclxuICBnZXQgY2FuUmVuYW1lR3JvdXAoKTogYm9vbGVhbiB7XHJcbiAgICByZXR1cm4gdGhpcy5pc0VkaXRNb2RlICYmIHRoaXMuY3VycmVudFVzZXJJc0FkbWluICYmICF0aGlzLmlzUHJvamVjdEdyb3VwO1xyXG4gIH1cclxuXHJcbiAgY2FuUmVtb3ZlTWVtYmVyKG1lbWJlcjogQ29udmVyc2F0aW9uUGFydGljaXBhbnQpOiBib29sZWFuIHtcclxuICAgIHJldHVybiB0aGlzLmNhbk1hbmFnZU1lbWJlcnMgJiYgU3RyaW5nKG1lbWJlci5jb250YWN0X2lkKSAhPT0gU3RyaW5nKHRoaXMuY3JlYXRvckNvbnRhY3RJZCk7XHJcbiAgfVxyXG5cclxuICBnZXQgY2FuU3VibWl0KCk6IGJvb2xlYW4ge1xyXG4gICAgaWYgKHRoaXMuY3JlYXRpbmdHcm91cCkgcmV0dXJuIGZhbHNlO1xyXG4gICAgaWYgKCF0aGlzLmdyb3VwTmFtZS50cmltKCkpIHJldHVybiBmYWxzZTtcclxuICAgIGlmICh0aGlzLmlzRWRpdE1vZGUpIHtcclxuICAgICAgaWYgKCF0aGlzLmNhbk1hbmFnZU1lbWJlcnMpIHJldHVybiBmYWxzZTtcclxuICAgICAgY29uc3QgcmVuYW1lZCA9IHRoaXMuY2FuUmVuYW1lR3JvdXAgJiYgdGhpcy5ncm91cE5hbWUudHJpbSgpICE9PSB0aGlzLm9yaWdpbmFsR3JvdXBOYW1lO1xyXG4gICAgICByZXR1cm4gcmVuYW1lZCB8fCB0aGlzLnNlbGVjdGVkQ29udGFjdHMubGVuZ3RoID4gMDtcclxuICAgIH1cclxuICAgIHJldHVybiB0aGlzLnNlbGVjdGVkQ29udGFjdHMubGVuZ3RoID49IDE7XHJcbiAgfVxyXG5cclxuICBpc1NlbGVjdGVkKGNvbnRhY3Q6IENvbnRhY3QpOiBib29sZWFuIHtcclxuICAgIHJldHVybiB0aGlzLnNlbGVjdGVkQ29udGFjdHMuc29tZSgoYykgPT4gYy5jb250YWN0X2lkID09PSBjb250YWN0LmNvbnRhY3RfaWQpO1xyXG4gIH1cclxuXHJcbiAgdG9nZ2xlQ29udGFjdChjb250YWN0OiBDb250YWN0KTogdm9pZCB7XHJcbiAgICBpZiAodGhpcy5pc0VkaXRNb2RlICYmICF0aGlzLmNhbk1hbmFnZU1lbWJlcnMpIHJldHVybjtcclxuICAgIGlmICh0aGlzLmlzU2VsZWN0ZWQoY29udGFjdCkpIHtcclxuICAgICAgdGhpcy5yZW1vdmVDb250YWN0KGNvbnRhY3QpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgdGhpcy5zZWxlY3RlZENvbnRhY3RzID0gWy4uLnRoaXMuc2VsZWN0ZWRDb250YWN0cywgY29udGFjdF07XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICByZW1vdmVDb250YWN0KGNvbnRhY3Q6IENvbnRhY3QpOiB2b2lkIHtcclxuICAgIHRoaXMuc2VsZWN0ZWRDb250YWN0cyA9IHRoaXMuc2VsZWN0ZWRDb250YWN0cy5maWx0ZXIoXHJcbiAgICAgIChjKSA9PiBjLmNvbnRhY3RfaWQgIT09IGNvbnRhY3QuY29udGFjdF9pZFxyXG4gICAgKTtcclxuICB9XHJcblxyXG4gIHJlbW92ZU1lbWJlcihtZW1iZXI6IENvbnZlcnNhdGlvblBhcnRpY2lwYW50KTogdm9pZCB7XHJcbiAgICBpZiAoIXRoaXMuZWRpdGluZ0NvbnZlcnNhdGlvbklkIHx8ICF0aGlzLmNhblJlbW92ZU1lbWJlcihtZW1iZXIpKSByZXR1cm47XHJcbiAgICBcclxuICAgIGlmIChjb25maXJtKGBSZW1vdmUgJHt0aGlzLmdldE1lbWJlck5hbWUobWVtYmVyKX0gZnJvbSB0aGlzIGdyb3VwP2ApKSB7XHJcbiAgICAgIHRoaXMuc3RvcmUubWFuYWdlR3JvdXAoJ3JlbW92ZScsIHRoaXMuZWRpdGluZ0NvbnZlcnNhdGlvbklkLCB1bmRlZmluZWQsIFttZW1iZXIuY29udGFjdF9pZF0sIHtcclxuICAgICAgICBzdWNjZXNzOiAoKSA9PiB7XHJcbiAgICAgICAgICB0aGlzLmN1cnJlbnRNZW1iZXJzID0gdGhpcy5jdXJyZW50TWVtYmVycy5maWx0ZXIobSA9PiBtLmNvbnRhY3RfaWQgIT09IG1lbWJlci5jb250YWN0X2lkKTtcclxuICAgICAgICB9LFxyXG4gICAgICB9KTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHNldEFkbWluKG1lbWJlcjogQ29udmVyc2F0aW9uUGFydGljaXBhbnQsIGlzQWRtaW46IGJvb2xlYW4pOiB2b2lkIHtcclxuICAgIGlmICghdGhpcy5lZGl0aW5nQ29udmVyc2F0aW9uSWQgfHwgIXRoaXMuY2FuTWFuYWdlTWVtYmVycykgcmV0dXJuO1xyXG4gICAgaWYgKFN0cmluZyhtZW1iZXIuY29udGFjdF9pZCkgPT09IFN0cmluZyh0aGlzLmNyZWF0b3JDb250YWN0SWQpKSByZXR1cm47XHJcblxyXG4gICAgdGhpcy5zdG9yZS5zZXRHcm91cEFkbWluKHRoaXMuZWRpdGluZ0NvbnZlcnNhdGlvbklkLCBtZW1iZXIuY29udGFjdF9pZCwgaXNBZG1pbiwge1xyXG4gICAgICBzdWNjZXNzOiAoKSA9PiB7XHJcbiAgICAgICAgdGhpcy5jdXJyZW50TWVtYmVycyA9IHRoaXMuY3VycmVudE1lbWJlcnMubWFwKChtKSA9PlxyXG4gICAgICAgICAgU3RyaW5nKG0uY29udGFjdF9pZCkgPT09IFN0cmluZyhtZW1iZXIuY29udGFjdF9pZClcclxuICAgICAgICAgICAgPyB7IC4uLm0sIHJvbGU6IGlzQWRtaW4gPyAnYWRtaW4nIDogJ21lbWJlcicsIGlzX2FkbWluOiBpc0FkbWluIH1cclxuICAgICAgICAgICAgOiBtXHJcbiAgICAgICAgKTtcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgb25TdWJtaXQoKTogdm9pZCB7XHJcbiAgICBpZiAoIXRoaXMuY2FuU3VibWl0KSByZXR1cm47XHJcblxyXG4gICAgaWYgKHRoaXMuaXNFZGl0TW9kZSAmJiB0aGlzLmVkaXRpbmdDb252ZXJzYXRpb25JZCkge1xyXG4gICAgICBpZiAodGhpcy5jYW5SZW5hbWVHcm91cCAmJiB0aGlzLmdyb3VwTmFtZS50cmltKCkgIT09IHRoaXMub3JpZ2luYWxHcm91cE5hbWUpIHtcclxuICAgICAgICB0aGlzLnN0b3JlLm1hbmFnZUdyb3VwKCdyZW5hbWUnLCB0aGlzLmVkaXRpbmdDb252ZXJzYXRpb25JZCwgdGhpcy5ncm91cE5hbWUudHJpbSgpKTtcclxuICAgICAgfVxyXG4gICAgICBpZiAodGhpcy5jYW5NYW5hZ2VNZW1iZXJzICYmIHRoaXMuc2VsZWN0ZWRDb250YWN0cy5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgY29uc3QgaWRzID0gdGhpcy5zZWxlY3RlZENvbnRhY3RzLm1hcCgoYykgPT4gYy5jb250YWN0X2lkKTtcclxuICAgICAgICB0aGlzLnN0b3JlLm1hbmFnZUdyb3VwKCdhZGQnLCB0aGlzLmVkaXRpbmdDb252ZXJzYXRpb25JZCwgdW5kZWZpbmVkLCBpZHMpO1xyXG4gICAgICB9XHJcbiAgICAgIHRoaXMuc3RvcmUuY2xlYXJHcm91cFNldHRpbmdzKCk7XHJcbiAgICAgIHRoaXMuc3RvcmUuc2V0VmlldygnY2hhdCcpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgdGhpcy5jcmVhdGluZ0dyb3VwID0gdHJ1ZTtcclxuICAgICAgY29uc3QgaWRzID0gdGhpcy5zZWxlY3RlZENvbnRhY3RzLm1hcCgoYykgPT4gYy5jb250YWN0X2lkKTtcclxuICAgICAgdGhpcy5zdG9yZS5jcmVhdGVHcm91cENvbnZlcnNhdGlvbihpZHMsIHRoaXMuZ3JvdXBOYW1lLnRyaW0oKSwge1xyXG4gICAgICAgIGVycm9yOiAoKSA9PiB7XHJcbiAgICAgICAgICB0aGlzLmNyZWF0aW5nR3JvdXAgPSBmYWxzZTtcclxuICAgICAgICB9LFxyXG4gICAgICB9KTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHJlcXVlc3REZWxldGVHcm91cCgpOiB2b2lkIHtcclxuICAgIGlmICghdGhpcy5lZGl0aW5nQ29udmVyc2F0aW9uSWQgfHwgdGhpcy5kZWxldGluZ0dyb3VwKSByZXR1cm47XHJcbiAgICB0aGlzLnNob3dEZWxldGVDb25maXJtID0gdHJ1ZTtcclxuICB9XHJcblxyXG4gIGNhbmNlbERlbGV0ZUdyb3VwKCk6IHZvaWQge1xyXG4gICAgaWYgKHRoaXMuZGVsZXRpbmdHcm91cCkgcmV0dXJuO1xyXG4gICAgdGhpcy5zaG93RGVsZXRlQ29uZmlybSA9IGZhbHNlO1xyXG4gIH1cclxuXHJcbiAgY29uZmlybURlbGV0ZUdyb3VwKCk6IHZvaWQge1xyXG4gICAgaWYgKHRoaXMuZWRpdGluZ0NvbnZlcnNhdGlvbklkICYmICF0aGlzLmRlbGV0aW5nR3JvdXApIHtcclxuICAgICAgdGhpcy5kZWxldGluZ0dyb3VwID0gdHJ1ZTtcclxuICAgICAgdGhpcy5zdG9yZS5kZWxldGVHcm91cCh0aGlzLmVkaXRpbmdDb252ZXJzYXRpb25JZCwge1xyXG4gICAgICAgIGVycm9yOiAoKSA9PiB7XHJcbiAgICAgICAgICB0aGlzLmRlbGV0aW5nR3JvdXAgPSBmYWxzZTtcclxuICAgICAgICAgIHRoaXMuc2hvd0RlbGV0ZUNvbmZpcm0gPSBmYWxzZTtcclxuICAgICAgICB9LFxyXG4gICAgICB9KTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIGdvQmFjaygpOiB2b2lkIHtcclxuICAgIGlmICh0aGlzLmlzRWRpdE1vZGUpIHtcclxuICAgICAgdGhpcy5zdG9yZS5jbGVhckdyb3VwU2V0dGluZ3MoKTtcclxuICAgICAgdGhpcy5zdG9yZS5zZXRWaWV3KCdjaGF0Jyk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICB0aGlzLnN0b3JlLnNldFZpZXcoJ2luYm94Jyk7XHJcbiAgICB9XHJcbiAgfVxyXG59XHJcbiJdfQ==