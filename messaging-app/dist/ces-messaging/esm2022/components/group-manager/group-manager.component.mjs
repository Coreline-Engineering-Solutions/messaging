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
    projectDbGid;
    projectGid;
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
        this.subs.push(this.store.visibleContacts.subscribe((c) => {
            if (!this.isProjectGroup)
                this.contacts = c;
        }));
        this.subs.push(this.store.groupSettings.subscribe((settings) => {
            if (settings) {
                this.isEditMode = true;
                this.editingConversationId = settings.conversationId;
                this.groupName = settings.name;
                this.originalGroupName = settings.name;
                this.isProjectGroup = !!settings.isProject;
                this.projectDbGid = settings.dbGid;
                this.projectGid = settings.projectGid;
                this.selectedContacts = [];
                this.showDeleteConfirm = false;
                this.loadCurrentMembers(settings.conversationId);
                this.loadProjectEligibleContacts();
            }
            else {
                this.isEditMode = false;
                this.isProjectGroup = false;
                this.projectDbGid = undefined;
                this.projectGid = undefined;
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
    loadProjectEligibleContacts() {
        if (!this.isProjectGroup)
            return;
        this.contacts = [];
        if (!this.projectDbGid || !this.projectGid)
            return;
        this.api.getEligibleProjectUsers(this.projectDbGid, this.projectGid).subscribe({
            next: (response) => {
                this.contacts = response.users || [];
            },
            error: () => {
                this.contacts = [];
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ3JvdXAtbWFuYWdlci5jb21wb25lbnQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvbGliL2NvbXBvbmVudHMvZ3JvdXAtbWFuYWdlci9ncm91cC1tYW5hZ2VyLmNvbXBvbmVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsU0FBUyxFQUFxQixNQUFNLGVBQWUsQ0FBQztBQUM3RCxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDL0MsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLGdCQUFnQixDQUFDO0FBQzdDLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSx3QkFBd0IsQ0FBQztBQUN2RCxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFDM0QsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHdCQUF3QixDQUFDO0FBQ3pELE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBQzdELE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBSzlFLE9BQU8sRUFBb0MscUJBQXFCLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQzs7Ozs7Ozs7Ozs7O0FBd2lCeEcsTUFBTSxPQUFPLHFCQUFxQjtJQW9CdEI7SUFDQTtJQUNBO0lBckJWLFFBQVEsR0FBYyxFQUFFLENBQUM7SUFDekIsZ0JBQWdCLEdBQWMsRUFBRSxDQUFDO0lBQ2pDLGNBQWMsR0FBOEIsRUFBRSxDQUFDO0lBQy9DLFNBQVMsR0FBRyxFQUFFLENBQUM7SUFDZixpQkFBaUIsR0FBRyxFQUFFLENBQUM7SUFDdkIsV0FBVyxHQUFHLEVBQUUsQ0FBQztJQUNqQixVQUFVLEdBQUcsS0FBSyxDQUFDO0lBQ25CLGNBQWMsR0FBRyxLQUFLLENBQUM7SUFDdkIsWUFBWSxDQUFxQjtJQUNqQyxVQUFVLENBQXFCO0lBQy9CLHFCQUFxQixHQUFrQixJQUFJLENBQUM7SUFD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aXQsIE9uRGVzdHJveSB9IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xyXG5pbXBvcnQgeyBDb21tb25Nb2R1bGUgfSBmcm9tICdAYW5ndWxhci9jb21tb24nO1xyXG5pbXBvcnQgeyBGb3Jtc01vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL2Zvcm1zJztcclxuaW1wb3J0IHsgTWF0SWNvbk1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL21hdGVyaWFsL2ljb24nO1xyXG5pbXBvcnQgeyBNYXRCdXR0b25Nb2R1bGUgfSBmcm9tICdAYW5ndWxhci9tYXRlcmlhbC9idXR0b24nO1xyXG5pbXBvcnQgeyBNYXRSaXBwbGVNb2R1bGUgfSBmcm9tICdAYW5ndWxhci9tYXRlcmlhbC9jb3JlJztcclxuaW1wb3J0IHsgTWF0VG9vbHRpcE1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL21hdGVyaWFsL3Rvb2x0aXAnO1xyXG5pbXBvcnQgeyBNYXRQcm9ncmVzc1NwaW5uZXJNb2R1bGUgfSBmcm9tICdAYW5ndWxhci9tYXRlcmlhbC9wcm9ncmVzcy1zcGlubmVyJztcclxuaW1wb3J0IHsgU3Vic2NyaXB0aW9uIH0gZnJvbSAncnhqcyc7XHJcbmltcG9ydCB7IE1lc3NhZ2luZ1N0b3JlU2VydmljZSB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL21lc3NhZ2luZy1zdG9yZS5zZXJ2aWNlJztcclxuaW1wb3J0IHsgTWVzc2FnaW5nQXBpU2VydmljZSB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL21lc3NhZ2luZy1hcGkuc2VydmljZSc7XHJcbmltcG9ydCB7IEF1dGhTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvYXV0aC5zZXJ2aWNlJztcclxuaW1wb3J0IHsgQ29udGFjdCwgQ29udmVyc2F0aW9uUGFydGljaXBhbnQsIGdldENvbnRhY3REaXNwbGF5TmFtZSB9IGZyb20gJy4uLy4uL21vZGVscy9tZXNzYWdpbmcubW9kZWxzJztcclxuXHJcbkBDb21wb25lbnQoe1xyXG4gIHNlbGVjdG9yOiAnYXBwLWdyb3VwLW1hbmFnZXInLFxyXG4gIHN0YW5kYWxvbmU6IHRydWUsXHJcbiAgaW1wb3J0czogW0NvbW1vbk1vZHVsZSwgRm9ybXNNb2R1bGUsIE1hdEljb25Nb2R1bGUsIE1hdEJ1dHRvbk1vZHVsZSwgTWF0UmlwcGxlTW9kdWxlLCBNYXRUb29sdGlwTW9kdWxlLCBNYXRQcm9ncmVzc1NwaW5uZXJNb2R1bGVdLFxyXG4gIHRlbXBsYXRlOiBgXHJcbiAgICA8ZGl2IGNsYXNzPVwiZ3JvdXAtbWFuYWdlclwiPlxyXG4gICAgICA8ZGl2IGNsYXNzPVwiaGVhZGVyXCI+XHJcbiAgICAgICAgPGJ1dHRvbiBtYXQtaWNvbi1idXR0b24gY2xhc3M9XCJoZHItYnRuXCIgKGNsaWNrKT1cImdvQmFjaygpXCIgbWF0VG9vbHRpcD1cIkJhY2tcIiBtYXRUb29sdGlwUG9zaXRpb249XCJiZWxvd1wiPlxyXG4gICAgICAgICAgPG1hdC1pY29uPmFycm93X2JhY2s8L21hdC1pY29uPlxyXG4gICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgIDxoMz57eyBpc0VkaXRNb2RlID8gJ0dyb3VwIFNldHRpbmdzJyA6ICdDcmVhdGUgR3JvdXAnIH19PC9oMz5cclxuICAgICAgPC9kaXY+XHJcblxyXG4gICAgICA8ZGl2IGNsYXNzPVwic2Nyb2xsYWJsZVwiPlxyXG4gICAgICAgIDxkaXYgY2xhc3M9XCJmb3JtLXNlY3Rpb25cIj5cclxuICAgICAgICAgIDxsYWJlbCBjbGFzcz1cImZpZWxkLWxhYmVsXCI+R3JvdXAgTmFtZTwvbGFiZWw+XHJcbiAgICAgICAgICA8aW5wdXRcclxuICAgICAgICAgICAgdHlwZT1cInRleHRcIlxyXG4gICAgICAgICAgICBbKG5nTW9kZWwpXT1cImdyb3VwTmFtZVwiXHJcbiAgICAgICAgICAgIHBsYWNlaG9sZGVyPVwiRW50ZXIgZ3JvdXAgbmFtZS4uLlwiXHJcbiAgICAgICAgICAgIGNsYXNzPVwidGV4dC1maWVsZFwiXHJcbiAgICAgICAgICAgIFtyZWFkb25seV09XCJpc1Byb2plY3RHcm91cCB8fCAoaXNFZGl0TW9kZSAmJiAhY2FuTWFuYWdlTWVtYmVycylcIlxyXG4gICAgICAgICAgICBbY2xhc3MucmVhZG9ubHldPVwiaXNQcm9qZWN0R3JvdXAgfHwgKGlzRWRpdE1vZGUgJiYgIWNhbk1hbmFnZU1lbWJlcnMpXCJcclxuICAgICAgICAgIC8+XHJcbiAgICAgICAgICA8ZGl2ICpuZ0lmPVwiaXNQcm9qZWN0R3JvdXBcIiBjbGFzcz1cImZpZWxkLW5vdGVcIj5Qcm9qZWN0IGdyb3VwIG5hbWVzIGFyZSBsb2NrZWQgdG8gdGhlIEdJUyBwcm9qZWN0IG5hbWUuPC9kaXY+XHJcbiAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgIDxuZy1jb250YWluZXIgKm5nSWY9XCJpc0VkaXRNb2RlXCI+XHJcbiAgICAgICAgICA8ZGl2IGNsYXNzPVwiZm9ybS1zZWN0aW9uIHNlY3Rpb24tZ2FwXCI+XHJcbiAgICAgICAgICAgIDxsYWJlbCBjbGFzcz1cImZpZWxkLWxhYmVsXCI+Q3VycmVudCBNZW1iZXJzPC9sYWJlbD5cclxuICAgICAgICAgICAgPGRpdiAqbmdJZj1cImxvYWRpbmdNZW1iZXJzXCIgY2xhc3M9XCJsb2FkaW5nLXJvd1wiPlxyXG4gICAgICAgICAgICAgIDxtYXQtc3Bpbm5lciBkaWFtZXRlcj1cIjE4XCI+PC9tYXQtc3Bpbm5lcj5cclxuICAgICAgICAgICAgICA8c3Bhbj5Mb2FkaW5nIG1lbWJlcnMuLi48L3NwYW4+XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICA8ZGl2ICpuZ0lmPVwiIWxvYWRpbmdNZW1iZXJzXCIgY2xhc3M9XCJtZW1iZXJzLWxpc3RcIj5cclxuICAgICAgICAgICAgICA8ZGl2ICpuZ0Zvcj1cImxldCBtIG9mIGN1cnJlbnRNZW1iZXJzXCIgY2xhc3M9XCJtZW1iZXItcm93XCI+XHJcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwibWVtYmVyLWF2YXRhclwiPjxtYXQtaWNvbj5wZXJzb248L21hdC1pY29uPjwvZGl2PlxyXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cIm1lbWJlci1pbmZvXCI+XHJcbiAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwibWVtYmVyLW5hbWVcIj5cclxuICAgICAgICAgICAgICAgICAgICB7eyBnZXRNZW1iZXJOYW1lKG0pIH19e3sgbS5jb250YWN0X2lkID09PSBjcmVhdG9yQ29udGFjdElkID8gJyAoeW91KScgOiAnJyB9fVxyXG4gICAgICAgICAgICAgICAgICAgIDxzcGFuICpuZ0lmPVwiaXNBZG1pbk1lbWJlcihtKVwiIGNsYXNzPVwiYWRtaW4tYmFkZ2VcIj5BZG1pbjwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgPC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cIm1lbWJlci1zdWJcIj57eyBtLmNvbXBhbnkgfHwgbS5lbWFpbCB9fTwvc3Bhbj5cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgPGJ1dHRvbiBcclxuICAgICAgICAgICAgICAgICAgKm5nSWY9XCJjYW5NYW5hZ2VNZW1iZXJzICYmIG0uY29udGFjdF9pZCAhPT0gY3JlYXRvckNvbnRhY3RJZFwiXHJcbiAgICAgICAgICAgICAgICAgIG1hdC1pY29uLWJ1dHRvblxyXG4gICAgICAgICAgICAgICAgICBjbGFzcz1cImFkbWluLW1lbWJlci1idG5cIlxyXG4gICAgICAgICAgICAgICAgICAoY2xpY2spPVwic2V0QWRtaW4obSwgIWlzQWRtaW5NZW1iZXIobSkpXCJcclxuICAgICAgICAgICAgICAgICAgW21hdFRvb2x0aXBdPVwiaXNBZG1pbk1lbWJlcihtKSA/ICdSZW1vdmUgYWRtaW4nIDogJ01ha2UgYWRtaW4nXCJcclxuICAgICAgICAgICAgICAgICAgbWF0VG9vbHRpcFBvc2l0aW9uPVwibGVmdFwiXHJcbiAgICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICAgIDxtYXQtaWNvbj57eyBpc0FkbWluTWVtYmVyKG0pID8gJ3NoaWVsZCcgOiAnYWRtaW5fcGFuZWxfc2V0dGluZ3MnIH19PC9tYXQtaWNvbj5cclxuICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgICAgICAgPGJ1dHRvbiBcclxuICAgICAgICAgICAgICAgICAgKm5nSWY9XCJjYW5SZW1vdmVNZW1iZXIobSlcIiBcclxuICAgICAgICAgICAgICAgICAgbWF0LWljb24tYnV0dG9uIFxyXG4gICAgICAgICAgICAgICAgICBjbGFzcz1cInJlbW92ZS1tZW1iZXItYnRuXCJcclxuICAgICAgICAgICAgICAgICAgKGNsaWNrKT1cInJlbW92ZU1lbWJlcihtKVwiXHJcbiAgICAgICAgICAgICAgICAgIG1hdFRvb2x0aXA9XCJSZW1vdmUgZnJvbSBncm91cFwiXHJcbiAgICAgICAgICAgICAgICAgIG1hdFRvb2x0aXBQb3NpdGlvbj1cImxlZnRcIlxyXG4gICAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgICA8bWF0LWljb24+cGVyc29uX3JlbW92ZTwvbWF0LWljb24+XHJcbiAgICAgICAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICA8ZGl2ICpuZ0lmPVwiY3VycmVudE1lbWJlcnMubGVuZ3RoID09PSAwXCIgY2xhc3M9XCJlbXB0eS1tZW1iZXJzXCI+Tm8gbWVtYmVycyBmb3VuZDwvZGl2PlxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgIDxkaXYgKm5nSWY9XCJjYW5NYW5hZ2VNZW1iZXJzXCIgY2xhc3M9XCJmb3JtLXNlY3Rpb24gc2VjdGlvbi1nYXBcIj5cclxuICAgICAgICAgICAgPGxhYmVsIGNsYXNzPVwiZmllbGQtbGFiZWxcIj5BZGQgTWVtYmVyczwvbGFiZWw+XHJcbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJzZWFyY2gtYmFyXCI+XHJcbiAgICAgICAgICAgICAgPG1hdC1pY29uIGNsYXNzPVwic2VhcmNoLWljb25cIj5zZWFyY2g8L21hdC1pY29uPlxyXG4gICAgICAgICAgICAgIDxpbnB1dCB0eXBlPVwidGV4dFwiIFsobmdNb2RlbCldPVwic2VhcmNoUXVlcnlcIiBwbGFjZWhvbGRlcj1cIlNlYXJjaCBjb250YWN0cy4uLlwiIGNsYXNzPVwic2VhcmNoLWlucHV0XCIgLz5cclxuICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICA8L25nLWNvbnRhaW5lcj5cclxuXHJcbiAgICAgICAgPG5nLWNvbnRhaW5lciAqbmdJZj1cIiFpc0VkaXRNb2RlXCI+XHJcbiAgICAgICAgICA8ZGl2IGNsYXNzPVwiZm9ybS1zZWN0aW9uIHNlY3Rpb24tZ2FwXCI+XHJcbiAgICAgICAgICAgIDxsYWJlbCBjbGFzcz1cImZpZWxkLWxhYmVsXCI+QWRkIE1lbWJlcnMgKG1pbiAxIG90aGVyIHBlcnNvbik8L2xhYmVsPlxyXG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwic2VhcmNoLWJhclwiPlxyXG4gICAgICAgICAgICAgIDxtYXQtaWNvbiBjbGFzcz1cInNlYXJjaC1pY29uXCI+c2VhcmNoPC9tYXQtaWNvbj5cclxuICAgICAgICAgICAgICA8aW5wdXQgdHlwZT1cInRleHRcIiBbKG5nTW9kZWwpXT1cInNlYXJjaFF1ZXJ5XCIgcGxhY2Vob2xkZXI9XCJTZWFyY2ggY29udGFjdHMuLi5cIiBjbGFzcz1cInNlYXJjaC1pbnB1dFwiIC8+XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgPC9uZy1jb250YWluZXI+XHJcblxyXG4gICAgICAgIDxkaXYgKm5nSWY9XCJzZWxlY3RlZENvbnRhY3RzLmxlbmd0aCA+IDAgJiYgKCFpc0VkaXRNb2RlIHx8IGNhbk1hbmFnZU1lbWJlcnMpXCIgY2xhc3M9XCJzZWxlY3RlZC1jaGlwc1wiPlxyXG4gICAgICAgICAgPGRpdiAqbmdGb3I9XCJsZXQgYyBvZiBzZWxlY3RlZENvbnRhY3RzXCIgY2xhc3M9XCJjaGlwXCI+XHJcbiAgICAgICAgICAgIDxzcGFuPnt7IGdldERpc3BsYXlOYW1lKGMpIH19PC9zcGFuPlxyXG4gICAgICAgICAgICA8YnV0dG9uIG1hdC1pY29uLWJ1dHRvbiBjbGFzcz1cImNoaXAtcmVtb3ZlXCIgKGNsaWNrKT1cInJlbW92ZUNvbnRhY3QoYylcIj5cclxuICAgICAgICAgICAgICA8bWF0LWljb24+Y2xvc2U8L21hdC1pY29uPlxyXG4gICAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICA8ZGl2ICpuZ0lmPVwiIWlzRWRpdE1vZGUgfHwgY2FuTWFuYWdlTWVtYmVyc1wiIGNsYXNzPVwiY29udGFjdHMtbGlzdFwiPlxyXG4gICAgICAgICAgPGRpdlxyXG4gICAgICAgICAgICAqbmdGb3I9XCJsZXQgY29udGFjdCBvZiBmaWx0ZXJlZENvbnRhY3RzXCJcclxuICAgICAgICAgICAgY2xhc3M9XCJjb250YWN0LWl0ZW1cIlxyXG4gICAgICAgICAgICBtYXRSaXBwbGVcclxuICAgICAgICAgICAgW2NsYXNzLnNlbGVjdGVkXT1cImlzU2VsZWN0ZWQoY29udGFjdClcIlxyXG4gICAgICAgICAgICAoY2xpY2spPVwidG9nZ2xlQ29udGFjdChjb250YWN0KVwiXHJcbiAgICAgICAgICA+XHJcbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJjb250YWN0LWF2YXRhclwiPlxyXG4gICAgICAgICAgICAgIDxtYXQtaWNvbj5wZXJzb248L21hdC1pY29uPlxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cImNvbnRhY3QtaW5mb1wiPlxyXG4gICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwiY29udGFjdC1uYW1lXCI+e3sgZ2V0RGlzcGxheU5hbWUoY29udGFjdCkgfX08L3NwYW4+XHJcbiAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJjb250YWN0LWNvbXBhbnlcIj57eyBjb250YWN0LmNvbXBhbnlfbmFtZSB9fTwvc3Bhbj5cclxuICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgIDxtYXQtaWNvbiAqbmdJZj1cImlzU2VsZWN0ZWQoY29udGFjdClcIiBjbGFzcz1cImNoZWNrLWljb25cIj5jaGVja19jaXJjbGU8L21hdC1pY29uPlxyXG4gICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgPC9kaXY+XHJcbiAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgPGRpdiBjbGFzcz1cImFjdGlvbi1iYXJcIj5cclxuICAgICAgICA8YnV0dG9uXHJcbiAgICAgICAgICAqbmdJZj1cIiFpc0VkaXRNb2RlIHx8IGNhbk1hbmFnZU1lbWJlcnNcIlxyXG4gICAgICAgICAgbWF0LXJhaXNlZC1idXR0b25cclxuICAgICAgICAgIFtkaXNhYmxlZF09XCIhY2FuU3VibWl0XCJcclxuICAgICAgICAgIChjbGljayk9XCJvblN1Ym1pdCgpXCJcclxuICAgICAgICAgIGNsYXNzPVwiY3JlYXRlLWJ0blwiXHJcbiAgICAgICAgPlxyXG4gICAgICAgICAgPG1hdC1pY29uPnt7IGlzRWRpdE1vZGUgPyAnc2F2ZScgOiAnZ3JvdXBfYWRkJyB9fTwvbWF0LWljb24+XHJcbiAgICAgICAgICA8bmctY29udGFpbmVyICpuZ0lmPVwiIWlzRWRpdE1vZGUgJiYgIWNyZWF0aW5nR3JvdXBcIj5DcmVhdGUgR3JvdXAgKHt7IHNlbGVjdGVkQ29udGFjdHMubGVuZ3RoICsgMSB9fSBtZW1iZXJzKTwvbmctY29udGFpbmVyPlxyXG4gICAgICAgICAgPG5nLWNvbnRhaW5lciAqbmdJZj1cIiFpc0VkaXRNb2RlICYmIGNyZWF0aW5nR3JvdXBcIj5DcmVhdGluZyBncm91cC4uLjwvbmctY29udGFpbmVyPlxyXG4gICAgICAgICAgPG5nLWNvbnRhaW5lciAqbmdJZj1cImlzRWRpdE1vZGVcIj5TYXZlIENoYW5nZXM8L25nLWNvbnRhaW5lcj5cclxuICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICA8YnV0dG9uXHJcbiAgICAgICAgICAqbmdJZj1cImlzRWRpdE1vZGVcIlxyXG4gICAgICAgICAgbWF0LXN0cm9rZWQtYnV0dG9uXHJcbiAgICAgICAgICBjbGFzcz1cImRlbGV0ZS1idG5cIlxyXG4gICAgICAgICAgW2Rpc2FibGVkXT1cImRlbGV0aW5nR3JvdXBcIlxyXG4gICAgICAgICAgKGNsaWNrKT1cInJlcXVlc3REZWxldGVHcm91cCgpXCJcclxuICAgICAgICA+XHJcbiAgICAgICAgICA8bWF0LWljb24+bG9nb3V0PC9tYXQtaWNvbj5cclxuICAgICAgICAgIHt7IGRlbGV0aW5nR3JvdXAgPyAnRXhpdGluZyBncm91cC4uLicgOiAnRXhpdCBHcm91cCcgfX1cclxuICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgPC9kaXY+XHJcblxyXG4gICAgICA8ZGl2ICpuZ0lmPVwic2hvd0RlbGV0ZUNvbmZpcm1cIiBjbGFzcz1cImNvbmZpcm0tb3ZlcmxheVwiPlxyXG4gICAgICAgIDxkaXYgY2xhc3M9XCJjb25maXJtLWNhcmRcIj5cclxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJjb25maXJtLWljb25cIj5cclxuICAgICAgICAgICAgPG1hdC1pY29uPndhcm5pbmc8L21hdC1pY29uPlxyXG4gICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICA8ZGl2IGNsYXNzPVwiY29uZmlybS1jb3B5XCI+XHJcbiAgICAgICAgICAgIDxoND5FeGl0IGdyb3VwPzwvaDQ+XHJcbiAgICAgICAgICAgIDxwPkFyZSB5b3Ugc3VyZSB5b3Ugd2FudCB0byBleGl0IFwie3sgZ3JvdXBOYW1lLnRyaW0oKSB8fCAndGhpcyBncm91cCcgfX1cIj88L3A+XHJcbiAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJjb25maXJtLWFjdGlvbnNcIj5cclxuICAgICAgICAgICAgPGJ1dHRvbiBtYXQtc3Ryb2tlZC1idXR0b24gY2xhc3M9XCJjb25maXJtLWNhbmNlbFwiIFtkaXNhYmxlZF09XCJkZWxldGluZ0dyb3VwXCIgKGNsaWNrKT1cImNhbmNlbERlbGV0ZUdyb3VwKClcIj5cclxuICAgICAgICAgICAgICBDYW5jZWxcclxuICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICAgIDxidXR0b24gbWF0LXJhaXNlZC1idXR0b24gY2xhc3M9XCJjb25maXJtLWRlbGV0ZVwiIFtkaXNhYmxlZF09XCJkZWxldGluZ0dyb3VwXCIgKGNsaWNrKT1cImNvbmZpcm1EZWxldGVHcm91cCgpXCI+XHJcbiAgICAgICAgICAgICAgPG1hdC1pY29uPmxvZ291dDwvbWF0LWljb24+XHJcbiAgICAgICAgICAgICAge3sgZGVsZXRpbmdHcm91cCA/ICdFeGl0aW5nLi4uJyA6ICdFeGl0IEdyb3VwJyB9fVxyXG4gICAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgIDwvZGl2PlxyXG4gICAgICA8L2Rpdj5cclxuICAgIDwvZGl2PlxyXG4gIGAsXHJcbiAgc3R5bGVzOiBbYFxyXG4gICAgLmdyb3VwLW1hbmFnZXIge1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xyXG4gICAgICBoZWlnaHQ6IDEwMCU7XHJcbiAgICAgIHBvc2l0aW9uOiByZWxhdGl2ZTtcclxuICAgIH1cclxuXHJcbiAgICAuaGVhZGVyIHtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAgcGFkZGluZzogMTJweCA4cHggMTJweCA0cHg7XHJcbiAgICAgIGJvcmRlci1ib3R0b206IDFweCBzb2xpZCByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMTUpO1xyXG4gICAgICBnYXA6IDRweDtcclxuICAgICAgZmxleC1zaHJpbms6IDA7XHJcbiAgICB9XHJcblxyXG4gICAgLmhlYWRlciBoMyB7XHJcbiAgICAgIG1hcmdpbjogMDtcclxuICAgICAgZm9udC1zaXplOiAxOHB4O1xyXG4gICAgICBmb250LXdlaWdodDogNjAwO1xyXG4gICAgICBjb2xvcjogI2ZmZjtcclxuICAgIH1cclxuXHJcbiAgICAuaGRyLWJ0biB7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDZweCAhaW1wb3J0YW50O1xyXG4gICAgICB0cmFuc2l0aW9uOiBiYWNrZ3JvdW5kIDAuMTVzLCBib3gtc2hhZG93IDAuMTVzO1xyXG4gICAgfVxyXG5cclxuICAgIC5oZHItYnRuOmhvdmVyIHtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjE1KSAhaW1wb3J0YW50O1xyXG4gICAgICBib3gtc2hhZG93OiAwIDJweCA4cHggcmdiYSgwLCAwLCAwLCAwLjIpO1xyXG4gICAgfVxyXG5cclxuICAgIC5oZHItYnRuIG1hdC1pY29uIHtcclxuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC44KTtcclxuICAgIH1cclxuXHJcbiAgICAuc2Nyb2xsYWJsZSB7XHJcbiAgICAgIGZsZXg6IDE7XHJcbiAgICAgIG92ZXJmbG93LXk6IGF1dG87XHJcbiAgICB9XHJcblxyXG4gICAgLmZvcm0tc2VjdGlvbiB7XHJcbiAgICAgIHBhZGRpbmc6IDEycHggMTZweCAwO1xyXG4gICAgfVxyXG5cclxuICAgIC5zZWN0aW9uLWdhcCB7XHJcbiAgICAgIHBhZGRpbmctdG9wOiAxNnB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5maWVsZC1sYWJlbCB7XHJcbiAgICAgIGRpc3BsYXk6IGJsb2NrO1xyXG4gICAgICBmb250LXNpemU6IDEycHg7XHJcbiAgICAgIGZvbnQtd2VpZ2h0OiA2MDA7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNyk7XHJcbiAgICAgIHRleHQtdHJhbnNmb3JtOiB1cHBlcmNhc2U7XHJcbiAgICAgIGxldHRlci1zcGFjaW5nOiAwLjA1ZW07XHJcbiAgICAgIG1hcmdpbi1ib3R0b206IDZweDtcclxuICAgIH1cclxuXHJcbiAgICAudGV4dC1maWVsZCB7XHJcbiAgICAgIHdpZHRoOiAxMDAlO1xyXG4gICAgICBwYWRkaW5nOiAxMHB4IDEycHg7XHJcbiAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4yNSk7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDhweDtcclxuICAgICAgZm9udC1zaXplOiAxNHB4O1xyXG4gICAgICBjb2xvcjogI2ZmZjtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjEpO1xyXG4gICAgICBvdXRsaW5lOiBub25lO1xyXG4gICAgICB0cmFuc2l0aW9uOiBib3JkZXItY29sb3IgMC4ycztcclxuICAgICAgYm94LXNpemluZzogYm9yZGVyLWJveDtcclxuICAgIH1cclxuXHJcbiAgICAudGV4dC1maWVsZDpmb2N1cyB7IGJvcmRlci1jb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjUpOyB9XHJcbiAgICAudGV4dC1maWVsZDo6cGxhY2Vob2xkZXIgeyBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjUpOyB9XHJcbiAgICAudGV4dC1maWVsZC5yZWFkb25seSB7XHJcbiAgICAgIGN1cnNvcjogbm90LWFsbG93ZWQ7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNzUpO1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMDYpO1xyXG4gICAgICBib3JkZXItY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xNik7XHJcbiAgICB9XHJcblxyXG4gICAgLmZpZWxkLW5vdGUge1xyXG4gICAgICBtYXJnaW4tdG9wOiA2cHg7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTJweDtcclxuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC41NSk7XHJcbiAgICB9XHJcblxyXG4gICAgLmxvYWRpbmctcm93IHtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAgZ2FwOiA4cHg7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwyNTUsMjU1LDAuNik7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTNweDtcclxuICAgICAgcGFkZGluZzogOHB4IDA7XHJcbiAgICB9XHJcblxyXG4gICAgLm1lbWJlcnMtbGlzdCB7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDhweDtcclxuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcclxuICAgIH1cclxuXHJcbiAgICAubWVtYmVyLXJvdyB7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgIHBhZGRpbmc6IDhweCAxMnB4O1xyXG4gICAgICBnYXA6IDEwcHg7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LDI1NSwyNTUsMC4wNyk7XHJcbiAgICAgIGJvcmRlci1ib3R0b206IDFweCBzb2xpZCByZ2JhKDI1NSwyNTUsMjU1LDAuMDYpO1xyXG4gICAgfVxyXG5cclxuICAgIC5tZW1iZXItcm93Omxhc3QtY2hpbGQgeyBib3JkZXItYm90dG9tOiBub25lOyB9XHJcblxyXG4gICAgLm1lbWJlci1hdmF0YXIge1xyXG4gICAgICB3aWR0aDogMzBweDtcclxuICAgICAgaGVpZ2h0OiAzMHB4O1xyXG4gICAgICBib3JkZXItcmFkaXVzOiA1MCU7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LDI1NSwyNTUsMC4yKTtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XHJcbiAgICAgIGZsZXgtc2hyaW5rOiAwO1xyXG4gICAgfVxyXG5cclxuICAgIC5tZW1iZXItYXZhdGFyIG1hdC1pY29uIHsgY29sb3I6ICNmZmY7IGZvbnQtc2l6ZTogMThweDsgfVxyXG5cclxuICAgIC5tZW1iZXItaW5mbyB7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XHJcbiAgICAgIGZsZXg6IDE7XHJcbiAgICAgIG1pbi13aWR0aDogMDtcclxuICAgIH1cclxuXHJcbiAgICAubWVtYmVyLW5hbWUge1xyXG4gICAgICBmb250LXNpemU6IDEzcHg7XHJcbiAgICAgIGZvbnQtd2VpZ2h0OiA1MDA7XHJcbiAgICAgIGNvbG9yOiAjZmZmO1xyXG4gICAgfVxyXG5cclxuICAgIC5hZG1pbi1iYWRnZSB7XHJcbiAgICAgIGRpc3BsYXk6IGlubGluZS1mbGV4O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBtYXJnaW4tbGVmdDogNnB4O1xyXG4gICAgICBwYWRkaW5nOiAxcHggNnB4O1xyXG4gICAgICBib3JkZXItcmFkaXVzOiA5OTlweDtcclxuICAgICAgY29sb3I6ICNiZmRiZmU7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMzcsIDk5LCAyMzUsIDAuMjIpO1xyXG4gICAgICBmb250LXNpemU6IDEwcHg7XHJcbiAgICAgIGZvbnQtd2VpZ2h0OiA3MDA7XHJcbiAgICAgIHRleHQtdHJhbnNmb3JtOiB1cHBlcmNhc2U7XHJcbiAgICAgIGxldHRlci1zcGFjaW5nOiAwLjA0ZW07XHJcbiAgICB9XHJcblxyXG4gICAgLm1lbWJlci1zdWIge1xyXG4gICAgICBmb250LXNpemU6IDExcHg7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwyNTUsMjU1LDAuNSk7XHJcbiAgICB9XHJcblxyXG4gICAgLnJlbW92ZS1tZW1iZXItYnRuIHtcclxuICAgICAgY29sb3I6IHJnYmEoMjU1LDI1NSwyNTUsMC42KSAhaW1wb3J0YW50O1xyXG4gICAgfVxyXG5cclxuICAgIC5hZG1pbi1tZW1iZXItYnRuIHtcclxuICAgICAgY29sb3I6IHJnYmEoMTQ3LDE5NywyNTMsMC45NSkgIWltcG9ydGFudDtcclxuICAgIH1cclxuXHJcbiAgICAucmVtb3ZlLW1lbWJlci1idG46aG92ZXIge1xyXG4gICAgICBjb2xvcjogI2Y4NzE3MSAhaW1wb3J0YW50O1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI0OCwxMTMsMTEzLDAuMSkgIWltcG9ydGFudDtcclxuICAgIH1cclxuXHJcbiAgICAuZW1wdHktbWVtYmVycyB7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTNweDtcclxuICAgICAgY29sb3I6IHJnYmEoMjU1LDI1NSwyNTUsMC41KTtcclxuICAgICAgcGFkZGluZzogOHB4IDA7XHJcbiAgICB9XHJcblxyXG4gICAgLnNlYXJjaC1iYXIge1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBwYWRkaW5nOiA4cHggMTJweDtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjEpO1xyXG4gICAgICBib3JkZXItcmFkaXVzOiAxMHB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5zZWFyY2gtaWNvbiB7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNik7XHJcbiAgICAgIGZvbnQtc2l6ZTogMjBweDtcclxuICAgICAgd2lkdGg6IDIwcHg7XHJcbiAgICAgIGhlaWdodDogMjBweDtcclxuICAgICAgbWFyZ2luLXJpZ2h0OiA4cHg7XHJcbiAgICB9XHJcblxyXG4gICAgLnNlYXJjaC1pbnB1dCB7XHJcbiAgICAgIGZsZXg6IDE7XHJcbiAgICAgIGJvcmRlcjogbm9uZTtcclxuICAgICAgb3V0bGluZTogbm9uZTtcclxuICAgICAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQ7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTRweDtcclxuICAgICAgY29sb3I6ICNmZmY7XHJcbiAgICB9XHJcblxyXG4gICAgLnNlYXJjaC1pbnB1dDo6cGxhY2Vob2xkZXIgeyBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjUpOyB9XHJcblxyXG4gICAgLnNlbGVjdGVkLWNoaXBzIHtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgZmxleC13cmFwOiB3cmFwO1xyXG4gICAgICBnYXA6IDZweDtcclxuICAgICAgcGFkZGluZzogOHB4IDE2cHg7XHJcbiAgICB9XHJcblxyXG4gICAgLmNoaXAge1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMik7XHJcbiAgICAgIGNvbG9yOiAjZmZmO1xyXG4gICAgICBib3JkZXItcmFkaXVzOiAxNnB4O1xyXG4gICAgICBwYWRkaW5nOiA0cHggNnB4IDRweCAxMnB4O1xyXG4gICAgICBmb250LXNpemU6IDEycHg7XHJcbiAgICAgIGZvbnQtd2VpZ2h0OiA1MDA7XHJcbiAgICB9XHJcblxyXG4gICAgLmNoaXAtcmVtb3ZlIHtcclxuICAgICAgd2lkdGg6IDIwcHggIWltcG9ydGFudDtcclxuICAgICAgaGVpZ2h0OiAyMHB4ICFpbXBvcnRhbnQ7XHJcbiAgICAgIGxpbmUtaGVpZ2h0OiAyMHB4ICFpbXBvcnRhbnQ7XHJcbiAgICB9XHJcblxyXG4gICAgLmNoaXAtcmVtb3ZlIG1hdC1pY29uIHtcclxuICAgICAgZm9udC1zaXplOiAxNHB4O1xyXG4gICAgICB3aWR0aDogMTRweDtcclxuICAgICAgaGVpZ2h0OiAxNHB4O1xyXG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjgpO1xyXG4gICAgfVxyXG5cclxuICAgIC5jb250YWN0cy1saXN0IHtcclxuICAgICAgcGFkZGluZy10b3A6IDRweDtcclxuICAgIH1cclxuXHJcbiAgICAuY29udGFjdC1pdGVtIHtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAgcGFkZGluZzogMTBweCAxNnB4O1xyXG4gICAgICBjdXJzb3I6IHBvaW50ZXI7XHJcbiAgICAgIHRyYW5zaXRpb246IGJhY2tncm91bmQgMC4xNXM7XHJcbiAgICAgIGdhcDogMTJweDtcclxuICAgIH1cclxuXHJcbiAgICAuY29udGFjdC1pdGVtOmhvdmVyIHsgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjA4KTsgfVxyXG4gICAgLmNvbnRhY3QtaXRlbS5zZWxlY3RlZCB7IGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xNSk7IH1cclxuXHJcbiAgICAuY29udGFjdC1hdmF0YXIge1xyXG4gICAgICB3aWR0aDogMzZweDtcclxuICAgICAgaGVpZ2h0OiAzNnB4O1xyXG4gICAgICBib3JkZXItcmFkaXVzOiA1MCU7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4yKTtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XHJcbiAgICAgIGZsZXgtc2hyaW5rOiAwO1xyXG4gICAgfVxyXG5cclxuICAgIC5jb250YWN0LWF2YXRhciBtYXQtaWNvbiB7IGNvbG9yOiAjZmZmOyBmb250LXNpemU6IDIwcHg7IH1cclxuXHJcbiAgICAuY29udGFjdC1pbmZvIHtcclxuICAgICAgZmxleDogMTtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcclxuICAgIH1cclxuXHJcbiAgICAuY29udGFjdC1uYW1lIHsgZm9udC13ZWlnaHQ6IDUwMDsgZm9udC1zaXplOiAxNHB4OyBjb2xvcjogI2ZmZjsgfVxyXG4gICAgLmNvbnRhY3QtY29tcGFueSB7IGZvbnQtc2l6ZTogMTJweDsgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC42KTsgfVxyXG4gICAgLmNoZWNrLWljb24geyBjb2xvcjogIzIyYzU1ZTsgZm9udC1zaXplOiAyMnB4OyB9XHJcblxyXG4gICAgLmFjdGlvbi1iYXIge1xyXG4gICAgICBwYWRkaW5nOiAxMnB4IDE2cHg7XHJcbiAgICAgIGJvcmRlci10b3A6IDFweCBzb2xpZCByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMSk7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XHJcbiAgICAgIGdhcDogOHB4O1xyXG4gICAgICBmbGV4LXNocmluazogMDtcclxuICAgIH1cclxuXHJcbiAgICAuY3JlYXRlLWJ0biB7XHJcbiAgICAgIHdpZHRoOiAxMDAlO1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMikgIWltcG9ydGFudDtcclxuICAgICAgY29sb3I6ICNmZmYgIWltcG9ydGFudDtcclxuICAgICAgYm9yZGVyLXJhZGl1czogMTBweDtcclxuICAgICAgZm9udC13ZWlnaHQ6IDYwMDtcclxuICAgIH1cclxuXHJcbiAgICAuY3JlYXRlLWJ0bjpkaXNhYmxlZCB7IG9wYWNpdHk6IDAuNTsgfVxyXG4gICAgLmNyZWF0ZS1idG4gbWF0LWljb24geyBtYXJnaW4tcmlnaHQ6IDhweDsgfVxyXG5cclxuICAgIC5kZWxldGUtYnRuIHtcclxuICAgICAgd2lkdGg6IDEwMCU7XHJcbiAgICAgIGNvbG9yOiAjZjg3MTcxICFpbXBvcnRhbnQ7XHJcbiAgICAgIGJvcmRlci1jb2xvcjogcmdiYSgyNDgsIDExMywgMTEzLCAwLjQpICFpbXBvcnRhbnQ7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDEwcHg7XHJcbiAgICAgIGZvbnQtd2VpZ2h0OiA2MDA7XHJcbiAgICB9XHJcblxyXG4gICAgLmRlbGV0ZS1idG4gbWF0LWljb24geyBtYXJnaW4tcmlnaHQ6IDhweDsgfVxyXG5cclxuICAgIC5jb25maXJtLW92ZXJsYXkge1xyXG4gICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XHJcbiAgICAgIGluc2V0OiAwO1xyXG4gICAgICB6LWluZGV4OiAxMDtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGZsZXgtZW5kO1xyXG4gICAgICBwYWRkaW5nOiAxNnB4O1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDQsIDE5LCAzNCwgMC42Mik7XHJcbiAgICAgIGJhY2tkcm9wLWZpbHRlcjogYmx1cigzcHgpO1xyXG4gICAgICBib3gtc2l6aW5nOiBib3JkZXItYm94O1xyXG4gICAgfVxyXG5cclxuICAgIC5jb25maXJtLWNhcmQge1xyXG4gICAgICB3aWR0aDogMTAwJTtcclxuICAgICAgcGFkZGluZzogMTZweDtcclxuICAgICAgYm9yZGVyLXJhZGl1czogMTRweDtcclxuICAgICAgYmFja2dyb3VuZDogIzBjMWYzNTtcclxuICAgICAgYm9yZGVyOiAxcHggc29saWQgcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjE0KTtcclxuICAgICAgYm94LXNoYWRvdzogMCAxNnB4IDQwcHggcmdiYSgwLCAwLCAwLCAwLjQ1KTtcclxuICAgICAgY29sb3I6ICNmZmY7XHJcbiAgICB9XHJcblxyXG4gICAgLmNvbmZpcm0taWNvbiB7XHJcbiAgICAgIHdpZHRoOiAzNnB4O1xyXG4gICAgICBoZWlnaHQ6IDM2cHg7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDUwJTtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNDgsIDExMywgMTEzLCAwLjE0KTtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XHJcbiAgICAgIG1hcmdpbi1ib3R0b206IDEwcHg7XHJcbiAgICB9XHJcblxyXG4gICAgLmNvbmZpcm0taWNvbiBtYXQtaWNvbiB7XHJcbiAgICAgIGNvbG9yOiAjZjg3MTcxO1xyXG4gICAgfVxyXG5cclxuICAgIC5jb25maXJtLWNvcHkgaDQge1xyXG4gICAgICBtYXJnaW46IDAgMCA2cHg7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTZweDtcclxuICAgICAgZm9udC13ZWlnaHQ6IDcwMDtcclxuICAgIH1cclxuXHJcbiAgICAuY29uZmlybS1jb3B5IHAge1xyXG4gICAgICBtYXJnaW46IDA7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNyk7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTNweDtcclxuICAgICAgbGluZS1oZWlnaHQ6IDEuNDtcclxuICAgIH1cclxuXHJcbiAgICAuY29uZmlybS1hY3Rpb25zIHtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgZ2FwOiA4cHg7XHJcbiAgICAgIG1hcmdpbi10b3A6IDE2cHg7XHJcbiAgICB9XHJcblxyXG4gICAgLmNvbmZpcm0tY2FuY2VsLFxyXG4gICAgLmNvbmZpcm0tZGVsZXRlIHtcclxuICAgICAgZmxleDogMTtcclxuICAgICAgYm9yZGVyLXJhZGl1czogMTBweDtcclxuICAgICAgZm9udC13ZWlnaHQ6IDYwMDtcclxuICAgIH1cclxuXHJcbiAgICAuY29uZmlybS1jYW5jZWwge1xyXG4gICAgICBjb2xvcjogI2ZmZiAhaW1wb3J0YW50O1xyXG4gICAgICBib3JkZXItY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4yNSkgIWltcG9ydGFudDtcclxuICAgIH1cclxuXHJcbiAgICAuY29uZmlybS1kZWxldGUge1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDIyMCwgMzgsIDM4LCAwLjkpICFpbXBvcnRhbnQ7XHJcbiAgICAgIGNvbG9yOiAjZmZmICFpbXBvcnRhbnQ7XHJcbiAgICB9XHJcblxyXG4gICAgLmNvbmZpcm0tZGVsZXRlIG1hdC1pY29uIHtcclxuICAgICAgbWFyZ2luLXJpZ2h0OiA2cHg7XHJcbiAgICAgIGZvbnQtc2l6ZTogMThweDtcclxuICAgICAgd2lkdGg6IDE4cHg7XHJcbiAgICAgIGhlaWdodDogMThweDtcclxuICAgIH1cclxuICBgXSxcclxufSlcclxuZXhwb3J0IGNsYXNzIEdyb3VwTWFuYWdlckNvbXBvbmVudCBpbXBsZW1lbnRzIE9uSW5pdCwgT25EZXN0cm95IHtcclxuICBjb250YWN0czogQ29udGFjdFtdID0gW107XHJcbiAgc2VsZWN0ZWRDb250YWN0czogQ29udGFjdFtdID0gW107XHJcbiAgY3VycmVudE1lbWJlcnM6IENvbnZlcnNhdGlvblBhcnRpY2lwYW50W10gPSBbXTtcclxuICBncm91cE5hbWUgPSAnJztcclxuICBvcmlnaW5hbEdyb3VwTmFtZSA9ICcnO1xyXG4gIHNlYXJjaFF1ZXJ5ID0gJyc7XHJcbiAgaXNFZGl0TW9kZSA9IGZhbHNlO1xyXG4gIGlzUHJvamVjdEdyb3VwID0gZmFsc2U7XHJcbiAgcHJvamVjdERiR2lkOiBzdHJpbmcgfCB1bmRlZmluZWQ7XHJcbiAgcHJvamVjdEdpZDogc3RyaW5nIHwgdW5kZWZpbmVkO1xyXG4gIGVkaXRpbmdDb252ZXJzYXRpb25JZDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XHJcbiAgY3JlYXRvckNvbnRhY3RJZDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XHJcbiAgbG9hZGluZ01lbWJlcnMgPSBmYWxzZTtcclxuICBjcmVhdGluZ0dyb3VwID0gZmFsc2U7XHJcbiAgZGVsZXRpbmdHcm91cCA9IGZhbHNlO1xyXG4gIHNob3dEZWxldGVDb25maXJtID0gZmFsc2U7XHJcbiAgcHJpdmF0ZSBzdWJzOiBTdWJzY3JpcHRpb25bXSA9IFtdO1xyXG5cclxuICBjb25zdHJ1Y3RvcihcclxuICAgIHByaXZhdGUgc3RvcmU6IE1lc3NhZ2luZ1N0b3JlU2VydmljZSxcclxuICAgIHByaXZhdGUgYXBpOiBNZXNzYWdpbmdBcGlTZXJ2aWNlLFxyXG4gICAgcHJpdmF0ZSBhdXRoOiBBdXRoU2VydmljZVxyXG4gICkge31cclxuXHJcbiAgbmdPbkluaXQoKTogdm9pZCB7XHJcbiAgICB0aGlzLmNyZWF0b3JDb250YWN0SWQgPSB0aGlzLmF1dGguY29udGFjdElkO1xyXG4gICAgdGhpcy5zdG9yZS5sb2FkVmlzaWJsZUNvbnRhY3RzKCk7XHJcblxyXG4gICAgdGhpcy5zdWJzLnB1c2goXHJcbiAgICAgIHRoaXMuc3RvcmUudmlzaWJsZUNvbnRhY3RzLnN1YnNjcmliZSgoYykgPT4ge1xyXG4gICAgICAgIGlmICghdGhpcy5pc1Byb2plY3RHcm91cCkgdGhpcy5jb250YWN0cyA9IGM7XHJcbiAgICAgIH0pXHJcbiAgICApO1xyXG5cclxuICAgIHRoaXMuc3Vicy5wdXNoKFxyXG4gICAgICB0aGlzLnN0b3JlLmdyb3VwU2V0dGluZ3Muc3Vic2NyaWJlKChzZXR0aW5ncykgPT4ge1xyXG4gICAgICAgIGlmIChzZXR0aW5ncykge1xyXG4gICAgICAgICAgdGhpcy5pc0VkaXRNb2RlID0gdHJ1ZTtcclxuICAgICAgICAgIHRoaXMuZWRpdGluZ0NvbnZlcnNhdGlvbklkID0gc2V0dGluZ3MuY29udmVyc2F0aW9uSWQ7XHJcbiAgICAgICAgICB0aGlzLmdyb3VwTmFtZSA9IHNldHRpbmdzLm5hbWU7XHJcbiAgICAgICAgICB0aGlzLm9yaWdpbmFsR3JvdXBOYW1lID0gc2V0dGluZ3MubmFtZTtcclxuICAgICAgICAgIHRoaXMuaXNQcm9qZWN0R3JvdXAgPSAhIXNldHRpbmdzLmlzUHJvamVjdDtcclxuICAgICAgICAgIHRoaXMucHJvamVjdERiR2lkID0gc2V0dGluZ3MuZGJHaWQ7XHJcbiAgICAgICAgICB0aGlzLnByb2plY3RHaWQgPSBzZXR0aW5ncy5wcm9qZWN0R2lkO1xyXG4gICAgICAgICAgdGhpcy5zZWxlY3RlZENvbnRhY3RzID0gW107XHJcbiAgICAgICAgICB0aGlzLnNob3dEZWxldGVDb25maXJtID0gZmFsc2U7XHJcbiAgICAgICAgICB0aGlzLmxvYWRDdXJyZW50TWVtYmVycyhzZXR0aW5ncy5jb252ZXJzYXRpb25JZCk7XHJcbiAgICAgICAgICB0aGlzLmxvYWRQcm9qZWN0RWxpZ2libGVDb250YWN0cygpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICB0aGlzLmlzRWRpdE1vZGUgPSBmYWxzZTtcclxuICAgICAgICAgIHRoaXMuaXNQcm9qZWN0R3JvdXAgPSBmYWxzZTtcclxuICAgICAgICAgIHRoaXMucHJvamVjdERiR2lkID0gdW5kZWZpbmVkO1xyXG4gICAgICAgICAgdGhpcy5wcm9qZWN0R2lkID0gdW5kZWZpbmVkO1xyXG4gICAgICAgICAgdGhpcy5lZGl0aW5nQ29udmVyc2F0aW9uSWQgPSBudWxsO1xyXG4gICAgICAgICAgdGhpcy5ncm91cE5hbWUgPSAnJztcclxuICAgICAgICAgIHRoaXMub3JpZ2luYWxHcm91cE5hbWUgPSAnJztcclxuICAgICAgICAgIHRoaXMuc2VsZWN0ZWRDb250YWN0cyA9IFtdO1xyXG4gICAgICAgICAgdGhpcy5jdXJyZW50TWVtYmVycyA9IFtdO1xyXG4gICAgICAgICAgdGhpcy5zaG93RGVsZXRlQ29uZmlybSA9IGZhbHNlO1xyXG4gICAgICAgIH1cclxuICAgICAgfSlcclxuICAgICk7XHJcbiAgfVxyXG5cclxuICBuZ09uRGVzdHJveSgpOiB2b2lkIHtcclxuICAgIHRoaXMuc3Vicy5mb3JFYWNoKChzKSA9PiBzLnVuc3Vic2NyaWJlKCkpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBsb2FkQ3VycmVudE1lbWJlcnMoY29udmVyc2F0aW9uSWQ6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgdGhpcy5sb2FkaW5nTWVtYmVycyA9IHRydWU7XHJcbiAgICB0aGlzLmFwaS5nZXRDb252ZXJzYXRpb25QYXJ0aWNpcGFudHMoY29udmVyc2F0aW9uSWQpLnN1YnNjcmliZSh7XHJcbiAgICAgIG5leHQ6IChtZW1iZXJzKSA9PiB7XHJcbiAgICAgICAgdGhpcy5jdXJyZW50TWVtYmVycyA9IG1lbWJlcnM7XHJcbiAgICAgICAgdGhpcy5sb2FkaW5nTWVtYmVycyA9IGZhbHNlO1xyXG4gICAgICAgIGlmICh0aGlzLmlzRWRpdE1vZGUgJiYgIXRoaXMuY3VycmVudFVzZXJJc0FkbWluKSB7XHJcbiAgICAgICAgICB0aGlzLnNlbGVjdGVkQ29udGFjdHMgPSBbXTtcclxuICAgICAgICB9XHJcbiAgICAgIH0sXHJcbiAgICAgIGVycm9yOiAoKSA9PiB7XHJcbiAgICAgICAgdGhpcy5sb2FkaW5nTWVtYmVycyA9IGZhbHNlO1xyXG4gICAgICB9LFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGxvYWRQcm9qZWN0RWxpZ2libGVDb250YWN0cygpOiB2b2lkIHtcclxuICAgIGlmICghdGhpcy5pc1Byb2plY3RHcm91cCkgcmV0dXJuO1xyXG4gICAgdGhpcy5jb250YWN0cyA9IFtdO1xyXG4gICAgaWYgKCF0aGlzLnByb2plY3REYkdpZCB8fCAhdGhpcy5wcm9qZWN0R2lkKSByZXR1cm47XHJcblxyXG4gICAgdGhpcy5hcGkuZ2V0RWxpZ2libGVQcm9qZWN0VXNlcnModGhpcy5wcm9qZWN0RGJHaWQsIHRoaXMucHJvamVjdEdpZCkuc3Vic2NyaWJlKHtcclxuICAgICAgbmV4dDogKHJlc3BvbnNlKSA9PiB7XHJcbiAgICAgICAgdGhpcy5jb250YWN0cyA9IHJlc3BvbnNlLnVzZXJzIHx8IFtdO1xyXG4gICAgICB9LFxyXG4gICAgICBlcnJvcjogKCkgPT4ge1xyXG4gICAgICAgIHRoaXMuY29udGFjdHMgPSBbXTtcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgZ2V0IGZpbHRlcmVkQ29udGFjdHMoKTogQ29udGFjdFtdIHtcclxuICAgIGNvbnN0IGFscmVhZHlJbkdyb3VwID0gbmV3IFNldCh0aGlzLmN1cnJlbnRNZW1iZXJzLm1hcCgobSkgPT4gbS5jb250YWN0X2lkKSk7XHJcbiAgICBsZXQgbGlzdCA9IHRoaXMuY29udGFjdHMuZmlsdGVyKFxyXG4gICAgICAoYykgPT4gYy5jb250YWN0X2lkICE9PSB0aGlzLmNyZWF0b3JDb250YWN0SWQgJiYgIWFscmVhZHlJbkdyb3VwLmhhcyhjLmNvbnRhY3RfaWQpXHJcbiAgICApO1xyXG4gICAgaWYgKHRoaXMuc2VhcmNoUXVlcnkudHJpbSgpKSB7XHJcbiAgICAgIGNvbnN0IHEgPSB0aGlzLnNlYXJjaFF1ZXJ5LnRvTG93ZXJDYXNlKCk7XHJcbiAgICAgIGxpc3QgPSBsaXN0LmZpbHRlcihcclxuICAgICAgICAoYykgPT5cclxuICAgICAgICAgIHRoaXMuZ2V0RGlzcGxheU5hbWUoYykudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhxKSB8fFxyXG4gICAgICAgICAgKGMuY29tcGFueV9uYW1lIHx8ICcnKS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKHEpXHJcbiAgICAgICk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gbGlzdDtcclxuICB9XHJcblxyXG4gIGdldERpc3BsYXlOYW1lKGNvbnRhY3Q6IENvbnRhY3QpOiBzdHJpbmcge1xyXG4gICAgcmV0dXJuIGdldENvbnRhY3REaXNwbGF5TmFtZShjb250YWN0KTtcclxuICB9XHJcblxyXG4gIGdldE1lbWJlck5hbWUobWVtYmVyOiBDb252ZXJzYXRpb25QYXJ0aWNpcGFudCk6IHN0cmluZyB7XHJcbiAgICByZXR1cm4gbWVtYmVyLnVzZXJuYW1lIHx8IG1lbWJlci5lbWFpbCB8fCBgQ29udGFjdCAke21lbWJlci5jb250YWN0X2lkfWA7XHJcbiAgfVxyXG5cclxuICBpc0FkbWluTWVtYmVyKG1lbWJlcjogQ29udmVyc2F0aW9uUGFydGljaXBhbnQpOiBib29sZWFuIHtcclxuICAgIHJldHVybiBtZW1iZXIuaXNfYWRtaW4gPT09IHRydWUgfHxcclxuICAgICAgbWVtYmVyLmlzX2FkbWluID09PSAndHJ1ZScgfHxcclxuICAgICAgbWVtYmVyLmlzX2FkbWluID09PSAnVHJ1ZScgfHxcclxuICAgICAgU3RyaW5nKG1lbWJlci5yb2xlIHx8ICcnKS50b0xvd2VyQ2FzZSgpID09PSAnYWRtaW4nO1xyXG4gIH1cclxuXHJcbiAgZ2V0IGN1cnJlbnRVc2VySXNBZG1pbigpOiBib29sZWFuIHtcclxuICAgIGlmICghdGhpcy5jcmVhdG9yQ29udGFjdElkKSByZXR1cm4gZmFsc2U7XHJcbiAgICBjb25zdCBtZSA9IHRoaXMuY3VycmVudE1lbWJlcnMuZmluZCgobSkgPT4gU3RyaW5nKG0uY29udGFjdF9pZCkgPT09IFN0cmluZyh0aGlzLmNyZWF0b3JDb250YWN0SWQpKTtcclxuICAgIHJldHVybiAhIW1lICYmIHRoaXMuaXNBZG1pbk1lbWJlcihtZSk7XHJcbiAgfVxyXG5cclxuICBnZXQgY2FuTWFuYWdlTWVtYmVycygpOiBib29sZWFuIHtcclxuICAgIHJldHVybiAhdGhpcy5pc0VkaXRNb2RlIHx8IHRoaXMuY3VycmVudFVzZXJJc0FkbWluO1xyXG4gIH1cclxuXHJcbiAgZ2V0IGNhblJlbmFtZUdyb3VwKCk6IGJvb2xlYW4ge1xyXG4gICAgcmV0dXJuIHRoaXMuaXNFZGl0TW9kZSAmJiB0aGlzLmN1cnJlbnRVc2VySXNBZG1pbiAmJiAhdGhpcy5pc1Byb2plY3RHcm91cDtcclxuICB9XHJcblxyXG4gIGNhblJlbW92ZU1lbWJlcihtZW1iZXI6IENvbnZlcnNhdGlvblBhcnRpY2lwYW50KTogYm9vbGVhbiB7XHJcbiAgICByZXR1cm4gdGhpcy5jYW5NYW5hZ2VNZW1iZXJzICYmIFN0cmluZyhtZW1iZXIuY29udGFjdF9pZCkgIT09IFN0cmluZyh0aGlzLmNyZWF0b3JDb250YWN0SWQpO1xyXG4gIH1cclxuXHJcbiAgZ2V0IGNhblN1Ym1pdCgpOiBib29sZWFuIHtcclxuICAgIGlmICh0aGlzLmNyZWF0aW5nR3JvdXApIHJldHVybiBmYWxzZTtcclxuICAgIGlmICghdGhpcy5ncm91cE5hbWUudHJpbSgpKSByZXR1cm4gZmFsc2U7XHJcbiAgICBpZiAodGhpcy5pc0VkaXRNb2RlKSB7XHJcbiAgICAgIGlmICghdGhpcy5jYW5NYW5hZ2VNZW1iZXJzKSByZXR1cm4gZmFsc2U7XHJcbiAgICAgIGNvbnN0IHJlbmFtZWQgPSB0aGlzLmNhblJlbmFtZUdyb3VwICYmIHRoaXMuZ3JvdXBOYW1lLnRyaW0oKSAhPT0gdGhpcy5vcmlnaW5hbEdyb3VwTmFtZTtcclxuICAgICAgcmV0dXJuIHJlbmFtZWQgfHwgdGhpcy5zZWxlY3RlZENvbnRhY3RzLmxlbmd0aCA+IDA7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdGhpcy5zZWxlY3RlZENvbnRhY3RzLmxlbmd0aCA+PSAxO1xyXG4gIH1cclxuXHJcbiAgaXNTZWxlY3RlZChjb250YWN0OiBDb250YWN0KTogYm9vbGVhbiB7XHJcbiAgICByZXR1cm4gdGhpcy5zZWxlY3RlZENvbnRhY3RzLnNvbWUoKGMpID0+IGMuY29udGFjdF9pZCA9PT0gY29udGFjdC5jb250YWN0X2lkKTtcclxuICB9XHJcblxyXG4gIHRvZ2dsZUNvbnRhY3QoY29udGFjdDogQ29udGFjdCk6IHZvaWQge1xyXG4gICAgaWYgKHRoaXMuaXNFZGl0TW9kZSAmJiAhdGhpcy5jYW5NYW5hZ2VNZW1iZXJzKSByZXR1cm47XHJcbiAgICBpZiAodGhpcy5pc1NlbGVjdGVkKGNvbnRhY3QpKSB7XHJcbiAgICAgIHRoaXMucmVtb3ZlQ29udGFjdChjb250YWN0KTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHRoaXMuc2VsZWN0ZWRDb250YWN0cyA9IFsuLi50aGlzLnNlbGVjdGVkQ29udGFjdHMsIGNvbnRhY3RdO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcmVtb3ZlQ29udGFjdChjb250YWN0OiBDb250YWN0KTogdm9pZCB7XHJcbiAgICB0aGlzLnNlbGVjdGVkQ29udGFjdHMgPSB0aGlzLnNlbGVjdGVkQ29udGFjdHMuZmlsdGVyKFxyXG4gICAgICAoYykgPT4gYy5jb250YWN0X2lkICE9PSBjb250YWN0LmNvbnRhY3RfaWRcclxuICAgICk7XHJcbiAgfVxyXG5cclxuICByZW1vdmVNZW1iZXIobWVtYmVyOiBDb252ZXJzYXRpb25QYXJ0aWNpcGFudCk6IHZvaWQge1xyXG4gICAgaWYgKCF0aGlzLmVkaXRpbmdDb252ZXJzYXRpb25JZCB8fCAhdGhpcy5jYW5SZW1vdmVNZW1iZXIobWVtYmVyKSkgcmV0dXJuO1xyXG4gICAgXHJcbiAgICBpZiAoY29uZmlybShgUmVtb3ZlICR7dGhpcy5nZXRNZW1iZXJOYW1lKG1lbWJlcil9IGZyb20gdGhpcyBncm91cD9gKSkge1xyXG4gICAgICB0aGlzLnN0b3JlLm1hbmFnZUdyb3VwKCdyZW1vdmUnLCB0aGlzLmVkaXRpbmdDb252ZXJzYXRpb25JZCwgdW5kZWZpbmVkLCBbbWVtYmVyLmNvbnRhY3RfaWRdLCB7XHJcbiAgICAgICAgc3VjY2VzczogKCkgPT4ge1xyXG4gICAgICAgICAgdGhpcy5jdXJyZW50TWVtYmVycyA9IHRoaXMuY3VycmVudE1lbWJlcnMuZmlsdGVyKG0gPT4gbS5jb250YWN0X2lkICE9PSBtZW1iZXIuY29udGFjdF9pZCk7XHJcbiAgICAgICAgfSxcclxuICAgICAgfSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBzZXRBZG1pbihtZW1iZXI6IENvbnZlcnNhdGlvblBhcnRpY2lwYW50LCBpc0FkbWluOiBib29sZWFuKTogdm9pZCB7XHJcbiAgICBpZiAoIXRoaXMuZWRpdGluZ0NvbnZlcnNhdGlvbklkIHx8ICF0aGlzLmNhbk1hbmFnZU1lbWJlcnMpIHJldHVybjtcclxuICAgIGlmIChTdHJpbmcobWVtYmVyLmNvbnRhY3RfaWQpID09PSBTdHJpbmcodGhpcy5jcmVhdG9yQ29udGFjdElkKSkgcmV0dXJuO1xyXG5cclxuICAgIHRoaXMuc3RvcmUuc2V0R3JvdXBBZG1pbih0aGlzLmVkaXRpbmdDb252ZXJzYXRpb25JZCwgbWVtYmVyLmNvbnRhY3RfaWQsIGlzQWRtaW4sIHtcclxuICAgICAgc3VjY2VzczogKCkgPT4ge1xyXG4gICAgICAgIHRoaXMuY3VycmVudE1lbWJlcnMgPSB0aGlzLmN1cnJlbnRNZW1iZXJzLm1hcCgobSkgPT5cclxuICAgICAgICAgIFN0cmluZyhtLmNvbnRhY3RfaWQpID09PSBTdHJpbmcobWVtYmVyLmNvbnRhY3RfaWQpXHJcbiAgICAgICAgICAgID8geyAuLi5tLCByb2xlOiBpc0FkbWluID8gJ2FkbWluJyA6ICdtZW1iZXInLCBpc19hZG1pbjogaXNBZG1pbiB9XHJcbiAgICAgICAgICAgIDogbVxyXG4gICAgICAgICk7XHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIG9uU3VibWl0KCk6IHZvaWQge1xyXG4gICAgaWYgKCF0aGlzLmNhblN1Ym1pdCkgcmV0dXJuO1xyXG5cclxuICAgIGlmICh0aGlzLmlzRWRpdE1vZGUgJiYgdGhpcy5lZGl0aW5nQ29udmVyc2F0aW9uSWQpIHtcclxuICAgICAgaWYgKHRoaXMuY2FuUmVuYW1lR3JvdXAgJiYgdGhpcy5ncm91cE5hbWUudHJpbSgpICE9PSB0aGlzLm9yaWdpbmFsR3JvdXBOYW1lKSB7XHJcbiAgICAgICAgdGhpcy5zdG9yZS5tYW5hZ2VHcm91cCgncmVuYW1lJywgdGhpcy5lZGl0aW5nQ29udmVyc2F0aW9uSWQsIHRoaXMuZ3JvdXBOYW1lLnRyaW0oKSk7XHJcbiAgICAgIH1cclxuICAgICAgaWYgKHRoaXMuY2FuTWFuYWdlTWVtYmVycyAmJiB0aGlzLnNlbGVjdGVkQ29udGFjdHMubGVuZ3RoID4gMCkge1xyXG4gICAgICAgIGNvbnN0IGlkcyA9IHRoaXMuc2VsZWN0ZWRDb250YWN0cy5tYXAoKGMpID0+IGMuY29udGFjdF9pZCk7XHJcbiAgICAgICAgdGhpcy5zdG9yZS5tYW5hZ2VHcm91cCgnYWRkJywgdGhpcy5lZGl0aW5nQ29udmVyc2F0aW9uSWQsIHVuZGVmaW5lZCwgaWRzKTtcclxuICAgICAgfVxyXG4gICAgICB0aGlzLnN0b3JlLmNsZWFyR3JvdXBTZXR0aW5ncygpO1xyXG4gICAgICB0aGlzLnN0b3JlLnNldFZpZXcoJ2NoYXQnKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHRoaXMuY3JlYXRpbmdHcm91cCA9IHRydWU7XHJcbiAgICAgIGNvbnN0IGlkcyA9IHRoaXMuc2VsZWN0ZWRDb250YWN0cy5tYXAoKGMpID0+IGMuY29udGFjdF9pZCk7XHJcbiAgICAgIHRoaXMuc3RvcmUuY3JlYXRlR3JvdXBDb252ZXJzYXRpb24oaWRzLCB0aGlzLmdyb3VwTmFtZS50cmltKCksIHtcclxuICAgICAgICBlcnJvcjogKCkgPT4ge1xyXG4gICAgICAgICAgdGhpcy5jcmVhdGluZ0dyb3VwID0gZmFsc2U7XHJcbiAgICAgICAgfSxcclxuICAgICAgfSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICByZXF1ZXN0RGVsZXRlR3JvdXAoKTogdm9pZCB7XHJcbiAgICBpZiAoIXRoaXMuZWRpdGluZ0NvbnZlcnNhdGlvbklkIHx8IHRoaXMuZGVsZXRpbmdHcm91cCkgcmV0dXJuO1xyXG4gICAgdGhpcy5zaG93RGVsZXRlQ29uZmlybSA9IHRydWU7XHJcbiAgfVxyXG5cclxuICBjYW5jZWxEZWxldGVHcm91cCgpOiB2b2lkIHtcclxuICAgIGlmICh0aGlzLmRlbGV0aW5nR3JvdXApIHJldHVybjtcclxuICAgIHRoaXMuc2hvd0RlbGV0ZUNvbmZpcm0gPSBmYWxzZTtcclxuICB9XHJcblxyXG4gIGNvbmZpcm1EZWxldGVHcm91cCgpOiB2b2lkIHtcclxuICAgIGlmICh0aGlzLmVkaXRpbmdDb252ZXJzYXRpb25JZCAmJiAhdGhpcy5kZWxldGluZ0dyb3VwKSB7XHJcbiAgICAgIHRoaXMuZGVsZXRpbmdHcm91cCA9IHRydWU7XHJcbiAgICAgIHRoaXMuc3RvcmUuZGVsZXRlR3JvdXAodGhpcy5lZGl0aW5nQ29udmVyc2F0aW9uSWQsIHtcclxuICAgICAgICBlcnJvcjogKCkgPT4ge1xyXG4gICAgICAgICAgdGhpcy5kZWxldGluZ0dyb3VwID0gZmFsc2U7XHJcbiAgICAgICAgICB0aGlzLnNob3dEZWxldGVDb25maXJtID0gZmFsc2U7XHJcbiAgICAgICAgfSxcclxuICAgICAgfSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBnb0JhY2soKTogdm9pZCB7XHJcbiAgICBpZiAodGhpcy5pc0VkaXRNb2RlKSB7XHJcbiAgICAgIHRoaXMuc3RvcmUuY2xlYXJHcm91cFNldHRpbmdzKCk7XHJcbiAgICAgIHRoaXMuc3RvcmUuc2V0VmlldygnY2hhdCcpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgdGhpcy5zdG9yZS5zZXRWaWV3KCdpbmJveCcpO1xyXG4gICAgfVxyXG4gIH1cclxufVxyXG4iXX0=