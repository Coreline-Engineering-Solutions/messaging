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
    isProjectSubgroup = false;
    isProjectSubgroupCreate = false;
    projectDbGid;
    projectGid;
    parentConversationId;
    subgroupSubject = '';
    originalSubgroupSubject = '';
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
                this.isProjectSubgroupCreate = !!settings.isProjectSubgroupCreate;
                this.isEditMode = !this.isProjectSubgroupCreate;
                this.editingConversationId = this.isProjectSubgroupCreate ? null : settings.conversationId;
                this.groupName = settings.name;
                this.originalGroupName = settings.name;
                this.isProjectGroup = !!settings.isProject;
                this.isProjectSubgroup = !!settings.isProjectSubgroup;
                this.projectDbGid = settings.dbGid;
                this.projectGid = settings.projectGid;
                this.parentConversationId = settings.parentConversationId || settings.conversationId;
                this.subgroupSubject = settings.subject || '';
                this.originalSubgroupSubject = settings.subject || '';
                this.selectedContacts = [];
                this.currentMembers = [];
                this.showDeleteConfirm = false;
                if (this.isEditMode) {
                    this.loadCurrentMembers(settings.conversationId);
                }
                this.loadProjectEligibleContacts();
            }
            else {
                this.isEditMode = false;
                this.isProjectGroup = false;
                this.isProjectSubgroup = false;
                this.isProjectSubgroupCreate = false;
                this.projectDbGid = undefined;
                this.projectGid = undefined;
                this.parentConversationId = undefined;
                this.editingConversationId = null;
                this.groupName = '';
                this.originalGroupName = '';
                this.subgroupSubject = '';
                this.originalSubgroupSubject = '';
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
    get isProjectNameLocked() {
        return this.isProjectGroup && !this.isProjectSubgroup;
    }
    get pageTitle() {
        if (this.isProjectSubgroupCreate)
            return 'Create Subgroup';
        if (this.isProjectSubgroup)
            return 'Subgroup Settings';
        return this.isEditMode ? 'Group Settings' : 'Create Group';
    }
    get createButtonLabel() {
        const count = this.selectedContacts.length + 1;
        return this.isProjectSubgroup
            ? `Create Subgroup (${count} member${count === 1 ? '' : 's'})`
            : `Create Group (${count} members)`;
    }
    get canRenameGroup() {
        return this.isEditMode && this.currentUserIsAdmin && !this.isProjectNameLocked;
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
            const subjectChanged = this.isProjectSubgroup && this.subgroupSubject.trim() !== this.originalSubgroupSubject;
            return renamed || subjectChanged || this.selectedContacts.length > 0;
        }
        return this.isProjectSubgroup || this.selectedContacts.length >= 1;
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
            const renamed = this.canRenameGroup && this.groupName.trim() !== this.originalGroupName;
            const subjectChanged = this.isProjectSubgroup && this.subgroupSubject.trim() !== this.originalSubgroupSubject;
            if (this.isProjectSubgroup && (renamed || subjectChanged)) {
                this.store.updateProjectSubgroup(this.editingConversationId, this.groupName.trim(), this.subgroupSubject.trim() || null);
            }
            else if (renamed) {
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
            if (this.isProjectSubgroup && this.parentConversationId) {
                this.store.createProjectSubgroup(this.parentConversationId, this.groupName.trim(), this.subgroupSubject.trim() || null, ids, {
                    error: () => {
                        this.creatingGroup = false;
                    },
                });
                return;
            }
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
        else if (this.isProjectSubgroupCreate) {
            this.store.clearGroupSettings();
            this.store.setView('inbox');
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
        <h3>{{ pageTitle }}</h3>
      </div>

      <div class="scrollable">
        <div class="form-section">
          <label class="field-label">{{ isProjectSubgroup ? 'Subgroup Name' : 'Group Name' }}</label>
          <input
            type="text"
            [(ngModel)]="groupName"
            [placeholder]="isProjectSubgroup ? 'Enter subgroup name...' : 'Enter group name...'"
            class="text-field"
            [readonly]="isProjectNameLocked || (isEditMode && !canManageMembers)"
            [class.readonly]="isProjectNameLocked || (isEditMode && !canManageMembers)"
          />
          <div *ngIf="isProjectNameLocked" class="field-note">Project group names are locked to the GIS project name.</div>
        </div>

        <div *ngIf="isProjectSubgroup" class="form-section">
          <label class="field-label">Subject</label>
          <textarea
            [(ngModel)]="subgroupSubject"
            placeholder="Optional subgroup subject..."
            class="text-field subject-field"
            [readonly]="isEditMode && !canManageMembers"
            [class.readonly]="isEditMode && !canManageMembers"
            rows="3"
          ></textarea>
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
            <label class="field-label">{{ isProjectSubgroup ? 'Add Members (optional)' : 'Add Members (min 1 other person)' }}</label>
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
          <ng-container *ngIf="!isEditMode && !creatingGroup">{{ createButtonLabel }}</ng-container>
          <ng-container *ngIf="!isEditMode && creatingGroup">{{ isProjectSubgroup ? 'Creating subgroup...' : 'Creating group...' }}</ng-container>
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
  `, isInline: true, styles: [".group-manager{display:flex;flex-direction:column;height:100%;position:relative}.header{display:flex;align-items:center;padding:12px 8px 12px 4px;border-bottom:1px solid rgba(255,255,255,.15);gap:4px;flex-shrink:0}.header h3{margin:0;font-size:18px;font-weight:600;color:#fff}.hdr-btn{border-radius:6px!important;transition:background .15s,box-shadow .15s}.hdr-btn:hover{background:#ffffff26!important;box-shadow:0 2px 8px #0003}.hdr-btn mat-icon{color:#fffc}.scrollable{flex:1;overflow-y:auto}.form-section{padding:12px 16px 0}.section-gap{padding-top:16px}.field-label{display:block;font-size:12px;font-weight:600;color:#ffffffb3;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px}.text-field{width:100%;padding:10px 12px;border:1px solid rgba(255,255,255,.25);border-radius:8px;font-size:14px;color:#fff;background:#ffffff1a;outline:none;transition:border-color .2s;box-sizing:border-box}.text-field:focus{border-color:#ffffff80}.text-field::placeholder{color:#ffffff80}.subject-field{min-height:74px;resize:vertical;font-family:inherit;line-height:1.4}.text-field.readonly{cursor:not-allowed;color:#ffffffbf;background:#ffffff0f;border-color:#ffffff29}.field-note{margin-top:6px;font-size:12px;color:#ffffff8c}.loading-row{display:flex;align-items:center;gap:8px;color:#fff9;font-size:13px;padding:8px 0}.members-list{border-radius:8px;overflow:hidden}.member-row{display:flex;align-items:center;padding:8px 12px;gap:10px;background:#ffffff12;border-bottom:1px solid rgba(255,255,255,.06)}.member-row:last-child{border-bottom:none}.member-avatar{width:30px;height:30px;border-radius:50%;background:#fff3;display:flex;align-items:center;justify-content:center;flex-shrink:0}.member-avatar mat-icon{color:#fff;font-size:18px}.member-info{display:flex;flex-direction:column;flex:1;min-width:0}.member-name{font-size:13px;font-weight:500;color:#fff}.admin-badge{display:inline-flex;align-items:center;margin-left:6px;padding:1px 6px;border-radius:999px;color:#bfdbfe;background:#2563eb38;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em}.member-sub{font-size:11px;color:#ffffff80}.remove-member-btn{color:#fff9!important}.admin-member-btn{color:#93c5fdf2!important}.remove-member-btn:hover{color:#f87171!important;background:#f871711a!important}.empty-members{font-size:13px;color:#ffffff80;padding:8px 0}.search-bar{display:flex;align-items:center;padding:8px 12px;background:#ffffff1a;border-radius:10px}.search-icon{color:#fff9;font-size:20px;width:20px;height:20px;margin-right:8px}.search-input{flex:1;border:none;outline:none;background:transparent;font-size:14px;color:#fff}.search-input::placeholder{color:#ffffff80}.selected-chips{display:flex;flex-wrap:wrap;gap:6px;padding:8px 16px}.chip{display:flex;align-items:center;background:#fff3;color:#fff;border-radius:16px;padding:4px 6px 4px 12px;font-size:12px;font-weight:500}.chip-remove{width:20px!important;height:20px!important;line-height:20px!important}.chip-remove mat-icon{font-size:14px;width:14px;height:14px;color:#fffc}.contacts-list{padding-top:4px}.contact-item{display:flex;align-items:center;padding:10px 16px;cursor:pointer;transition:background .15s;gap:12px}.contact-item:hover{background:#ffffff14}.contact-item.selected{background:#ffffff26}.contact-avatar{width:36px;height:36px;border-radius:50%;background:#fff3;display:flex;align-items:center;justify-content:center;flex-shrink:0}.contact-avatar mat-icon{color:#fff;font-size:20px}.contact-info{flex:1;display:flex;flex-direction:column}.contact-name{font-weight:500;font-size:14px;color:#fff}.contact-company{font-size:12px;color:#fff9}.check-icon{color:#22c55e;font-size:22px}.action-bar{padding:12px 16px;border-top:1px solid rgba(255,255,255,.1);display:flex;flex-direction:column;gap:8px;flex-shrink:0}.create-btn{width:100%;background:#fff3!important;color:#fff!important;border-radius:10px;font-weight:600}.create-btn:disabled{opacity:.5}.create-btn mat-icon{margin-right:8px}.delete-btn{width:100%;color:#f87171!important;border-color:#f8717166!important;border-radius:10px;font-weight:600}.delete-btn mat-icon{margin-right:8px}.confirm-overlay{position:absolute;inset:0;z-index:10;display:flex;align-items:flex-end;padding:16px;background:#0413229e;-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);box-sizing:border-box}.confirm-card{width:100%;padding:16px;border-radius:14px;background:#0c1f35;border:1px solid rgba(255,255,255,.14);box-shadow:0 16px 40px #00000073;color:#fff}.confirm-icon{width:36px;height:36px;border-radius:50%;background:#f8717124;display:flex;align-items:center;justify-content:center;margin-bottom:10px}.confirm-icon mat-icon{color:#f87171}.confirm-copy h4{margin:0 0 6px;font-size:16px;font-weight:700}.confirm-copy p{margin:0;color:#ffffffb3;font-size:13px;line-height:1.4}.confirm-actions{display:flex;gap:8px;margin-top:16px}.confirm-cancel,.confirm-delete{flex:1;border-radius:10px;font-weight:600}.confirm-cancel{color:#fff!important;border-color:#ffffff40!important}.confirm-delete{background:#dc2626e6!important;color:#fff!important}.confirm-delete mat-icon{margin-right:6px;font-size:18px;width:18px;height:18px}\n"], dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i4.NgForOf, selector: "[ngFor][ngForOf]", inputs: ["ngForOf", "ngForTrackBy", "ngForTemplate"] }, { kind: "directive", type: i4.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "ngmodule", type: FormsModule }, { kind: "directive", type: i5.DefaultValueAccessor, selector: "input:not([type=checkbox])[formControlName],textarea[formControlName],input:not([type=checkbox])[formControl],textarea[formControl],input:not([type=checkbox])[ngModel],textarea[ngModel],[ngDefaultControl]" }, { kind: "directive", type: i5.NgControlStatus, selector: "[formControlName],[ngModel],[formControl]" }, { kind: "directive", type: i5.NgModel, selector: "[ngModel]:not([formControlName]):not([formControl])", inputs: ["name", "disabled", "ngModel", "ngModelOptions"], outputs: ["ngModelChange"], exportAs: ["ngModel"] }, { kind: "ngmodule", type: MatIconModule }, { kind: "component", type: i6.MatIcon, selector: "mat-icon", inputs: ["color", "inline", "svgIcon", "fontSet", "fontIcon"], exportAs: ["matIcon"] }, { kind: "ngmodule", type: MatButtonModule }, { kind: "component", type: i7.MatButton, selector: "    button[mat-button], button[mat-raised-button], button[mat-flat-button],    button[mat-stroked-button]  ", exportAs: ["matButton"] }, { kind: "component", type: i7.MatIconButton, selector: "button[mat-icon-button]", exportAs: ["matButton"] }, { kind: "ngmodule", type: MatRippleModule }, { kind: "directive", type: i8.MatRipple, selector: "[mat-ripple], [matRipple]", inputs: ["matRippleColor", "matRippleUnbounded", "matRippleCentered", "matRippleRadius", "matRippleAnimation", "matRippleDisabled", "matRippleTrigger"], exportAs: ["matRipple"] }, { kind: "ngmodule", type: MatTooltipModule }, { kind: "directive", type: i9.MatTooltip, selector: "[matTooltip]", inputs: ["matTooltipPosition", "matTooltipPositionAtOrigin", "matTooltipDisabled", "matTooltipShowDelay", "matTooltipHideDelay", "matTooltipTouchGestures", "matTooltip", "matTooltipClass"], exportAs: ["matTooltip"] }, { kind: "ngmodule", type: MatProgressSpinnerModule }, { kind: "component", type: i10.MatProgressSpinner, selector: "mat-progress-spinner, mat-spinner", inputs: ["color", "mode", "value", "diameter", "strokeWidth"], exportAs: ["matProgressSpinner"] }] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: GroupManagerComponent, decorators: [{
            type: Component,
            args: [{ selector: 'app-group-manager', standalone: true, imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatRippleModule, MatTooltipModule, MatProgressSpinnerModule], template: `
    <div class="group-manager">
      <div class="header">
        <button mat-icon-button class="hdr-btn" (click)="goBack()" matTooltip="Back" matTooltipPosition="below">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <h3>{{ pageTitle }}</h3>
      </div>

      <div class="scrollable">
        <div class="form-section">
          <label class="field-label">{{ isProjectSubgroup ? 'Subgroup Name' : 'Group Name' }}</label>
          <input
            type="text"
            [(ngModel)]="groupName"
            [placeholder]="isProjectSubgroup ? 'Enter subgroup name...' : 'Enter group name...'"
            class="text-field"
            [readonly]="isProjectNameLocked || (isEditMode && !canManageMembers)"
            [class.readonly]="isProjectNameLocked || (isEditMode && !canManageMembers)"
          />
          <div *ngIf="isProjectNameLocked" class="field-note">Project group names are locked to the GIS project name.</div>
        </div>

        <div *ngIf="isProjectSubgroup" class="form-section">
          <label class="field-label">Subject</label>
          <textarea
            [(ngModel)]="subgroupSubject"
            placeholder="Optional subgroup subject..."
            class="text-field subject-field"
            [readonly]="isEditMode && !canManageMembers"
            [class.readonly]="isEditMode && !canManageMembers"
            rows="3"
          ></textarea>
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
            <label class="field-label">{{ isProjectSubgroup ? 'Add Members (optional)' : 'Add Members (min 1 other person)' }}</label>
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
          <ng-container *ngIf="!isEditMode && !creatingGroup">{{ createButtonLabel }}</ng-container>
          <ng-container *ngIf="!isEditMode && creatingGroup">{{ isProjectSubgroup ? 'Creating subgroup...' : 'Creating group...' }}</ng-container>
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
  `, styles: [".group-manager{display:flex;flex-direction:column;height:100%;position:relative}.header{display:flex;align-items:center;padding:12px 8px 12px 4px;border-bottom:1px solid rgba(255,255,255,.15);gap:4px;flex-shrink:0}.header h3{margin:0;font-size:18px;font-weight:600;color:#fff}.hdr-btn{border-radius:6px!important;transition:background .15s,box-shadow .15s}.hdr-btn:hover{background:#ffffff26!important;box-shadow:0 2px 8px #0003}.hdr-btn mat-icon{color:#fffc}.scrollable{flex:1;overflow-y:auto}.form-section{padding:12px 16px 0}.section-gap{padding-top:16px}.field-label{display:block;font-size:12px;font-weight:600;color:#ffffffb3;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px}.text-field{width:100%;padding:10px 12px;border:1px solid rgba(255,255,255,.25);border-radius:8px;font-size:14px;color:#fff;background:#ffffff1a;outline:none;transition:border-color .2s;box-sizing:border-box}.text-field:focus{border-color:#ffffff80}.text-field::placeholder{color:#ffffff80}.subject-field{min-height:74px;resize:vertical;font-family:inherit;line-height:1.4}.text-field.readonly{cursor:not-allowed;color:#ffffffbf;background:#ffffff0f;border-color:#ffffff29}.field-note{margin-top:6px;font-size:12px;color:#ffffff8c}.loading-row{display:flex;align-items:center;gap:8px;color:#fff9;font-size:13px;padding:8px 0}.members-list{border-radius:8px;overflow:hidden}.member-row{display:flex;align-items:center;padding:8px 12px;gap:10px;background:#ffffff12;border-bottom:1px solid rgba(255,255,255,.06)}.member-row:last-child{border-bottom:none}.member-avatar{width:30px;height:30px;border-radius:50%;background:#fff3;display:flex;align-items:center;justify-content:center;flex-shrink:0}.member-avatar mat-icon{color:#fff;font-size:18px}.member-info{display:flex;flex-direction:column;flex:1;min-width:0}.member-name{font-size:13px;font-weight:500;color:#fff}.admin-badge{display:inline-flex;align-items:center;margin-left:6px;padding:1px 6px;border-radius:999px;color:#bfdbfe;background:#2563eb38;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em}.member-sub{font-size:11px;color:#ffffff80}.remove-member-btn{color:#fff9!important}.admin-member-btn{color:#93c5fdf2!important}.remove-member-btn:hover{color:#f87171!important;background:#f871711a!important}.empty-members{font-size:13px;color:#ffffff80;padding:8px 0}.search-bar{display:flex;align-items:center;padding:8px 12px;background:#ffffff1a;border-radius:10px}.search-icon{color:#fff9;font-size:20px;width:20px;height:20px;margin-right:8px}.search-input{flex:1;border:none;outline:none;background:transparent;font-size:14px;color:#fff}.search-input::placeholder{color:#ffffff80}.selected-chips{display:flex;flex-wrap:wrap;gap:6px;padding:8px 16px}.chip{display:flex;align-items:center;background:#fff3;color:#fff;border-radius:16px;padding:4px 6px 4px 12px;font-size:12px;font-weight:500}.chip-remove{width:20px!important;height:20px!important;line-height:20px!important}.chip-remove mat-icon{font-size:14px;width:14px;height:14px;color:#fffc}.contacts-list{padding-top:4px}.contact-item{display:flex;align-items:center;padding:10px 16px;cursor:pointer;transition:background .15s;gap:12px}.contact-item:hover{background:#ffffff14}.contact-item.selected{background:#ffffff26}.contact-avatar{width:36px;height:36px;border-radius:50%;background:#fff3;display:flex;align-items:center;justify-content:center;flex-shrink:0}.contact-avatar mat-icon{color:#fff;font-size:20px}.contact-info{flex:1;display:flex;flex-direction:column}.contact-name{font-weight:500;font-size:14px;color:#fff}.contact-company{font-size:12px;color:#fff9}.check-icon{color:#22c55e;font-size:22px}.action-bar{padding:12px 16px;border-top:1px solid rgba(255,255,255,.1);display:flex;flex-direction:column;gap:8px;flex-shrink:0}.create-btn{width:100%;background:#fff3!important;color:#fff!important;border-radius:10px;font-weight:600}.create-btn:disabled{opacity:.5}.create-btn mat-icon{margin-right:8px}.delete-btn{width:100%;color:#f87171!important;border-color:#f8717166!important;border-radius:10px;font-weight:600}.delete-btn mat-icon{margin-right:8px}.confirm-overlay{position:absolute;inset:0;z-index:10;display:flex;align-items:flex-end;padding:16px;background:#0413229e;-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);box-sizing:border-box}.confirm-card{width:100%;padding:16px;border-radius:14px;background:#0c1f35;border:1px solid rgba(255,255,255,.14);box-shadow:0 16px 40px #00000073;color:#fff}.confirm-icon{width:36px;height:36px;border-radius:50%;background:#f8717124;display:flex;align-items:center;justify-content:center;margin-bottom:10px}.confirm-icon mat-icon{color:#f87171}.confirm-copy h4{margin:0 0 6px;font-size:16px;font-weight:700}.confirm-copy p{margin:0;color:#ffffffb3;font-size:13px;line-height:1.4}.confirm-actions{display:flex;gap:8px;margin-top:16px}.confirm-cancel,.confirm-delete{flex:1;border-radius:10px;font-weight:600}.confirm-cancel{color:#fff!important;border-color:#ffffff40!important}.confirm-delete{background:#dc2626e6!important;color:#fff!important}.confirm-delete mat-icon{margin-right:6px;font-size:18px;width:18px;height:18px}\n"] }]
        }], ctorParameters: () => [{ type: i1.MessagingStoreService }, { type: i2.MessagingApiService }, { type: i3.AuthService }] });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ3JvdXAtbWFuYWdlci5jb21wb25lbnQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvbGliL2NvbXBvbmVudHMvZ3JvdXAtbWFuYWdlci9ncm91cC1tYW5hZ2VyLmNvbXBvbmVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsU0FBUyxFQUFxQixNQUFNLGVBQWUsQ0FBQztBQUM3RCxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDL0MsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLGdCQUFnQixDQUFDO0FBQzdDLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSx3QkFBd0IsQ0FBQztBQUN2RCxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFDM0QsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHdCQUF3QixDQUFDO0FBQ3pELE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBQzdELE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBSzlFLE9BQU8sRUFBb0MscUJBQXFCLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQzs7Ozs7Ozs7Ozs7O0FBMGpCeEcsTUFBTSxPQUFPLHFCQUFxQjtJQXlCdEI7SUFDQTtJQUNBO0lBMUJWLFFBQVEsR0FBYyxFQUFFLENBQUM7SUFDekIsZ0JBQWdCLEdBQWMsRUFBRSxDQUFDO0lBQ2pDLGNBQWMsR0FBOEIsRUFBRSxDQUFDO0lBQy9DLFNBQVMsR0FBRyxFQUFFLENBQUM7SUFDZixpQkFBaUIsR0FBRyxFQUFFLENBQUM7SUFDdkIsV0FBVyxHQUFHLEVBQUUsQ0FBQztJQUNqQixVQUFVLEdBQUcsS0FBSyxDQUFDO0lBQ25CLGNBQWMsR0FBRyxLQUFLLENBQUM7SUFDdkIsaUJBQWlCLEdBQUcsS0FBSyxDQUFDO0lBQzFCLHVCQUF1QixHQUFHLEtBQUssQ0FBQztJQUNoQyxZQUFZ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Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7R0EyS1QsZ21LQTVLUyxZQUFZLCtQQUFFLFdBQVcsOG1CQUFFLGFBQWEsbUxBQUUsZUFBZSx3VUFBRSxlQUFlLGtTQUFFLGdCQUFnQiw0VEFBRSx3QkFBd0I7OzRGQXFqQnJILHFCQUFxQjtrQkF4akJqQyxTQUFTOytCQUNFLG1CQUFtQixjQUNqQixJQUFJLFdBQ1AsQ0FBQyxZQUFZLEVBQUUsV0FBVyxFQUFFLGFBQWEsRUFBRSxlQUFlLEVBQUUsZUFBZSxFQUFFLGdCQUFnQixFQUFFLHdCQUF3QixDQUFDLFlBQ3ZIOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7R0EyS1QiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBDb21wb25lbnQsIE9uSW5pdCwgT25EZXN0cm95IH0gZnJvbSAnQGFuZ3VsYXIvY29yZSc7XHJcbmltcG9ydCB7IENvbW1vbk1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL2NvbW1vbic7XHJcbmltcG9ydCB7IEZvcm1zTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvZm9ybXMnO1xyXG5pbXBvcnQgeyBNYXRJY29uTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvbWF0ZXJpYWwvaWNvbic7XHJcbmltcG9ydCB7IE1hdEJ1dHRvbk1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL21hdGVyaWFsL2J1dHRvbic7XHJcbmltcG9ydCB7IE1hdFJpcHBsZU1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL21hdGVyaWFsL2NvcmUnO1xyXG5pbXBvcnQgeyBNYXRUb29sdGlwTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvbWF0ZXJpYWwvdG9vbHRpcCc7XHJcbmltcG9ydCB7IE1hdFByb2dyZXNzU3Bpbm5lck1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL21hdGVyaWFsL3Byb2dyZXNzLXNwaW5uZXInO1xyXG5pbXBvcnQgeyBTdWJzY3JpcHRpb24gfSBmcm9tICdyeGpzJztcclxuaW1wb3J0IHsgTWVzc2FnaW5nU3RvcmVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvbWVzc2FnaW5nLXN0b3JlLnNlcnZpY2UnO1xyXG5pbXBvcnQgeyBNZXNzYWdpbmdBcGlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvbWVzc2FnaW5nLWFwaS5zZXJ2aWNlJztcclxuaW1wb3J0IHsgQXV0aFNlcnZpY2UgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9hdXRoLnNlcnZpY2UnO1xyXG5pbXBvcnQgeyBDb250YWN0LCBDb252ZXJzYXRpb25QYXJ0aWNpcGFudCwgZ2V0Q29udGFjdERpc3BsYXlOYW1lIH0gZnJvbSAnLi4vLi4vbW9kZWxzL21lc3NhZ2luZy5tb2RlbHMnO1xyXG5cclxuQENvbXBvbmVudCh7XHJcbiAgc2VsZWN0b3I6ICdhcHAtZ3JvdXAtbWFuYWdlcicsXHJcbiAgc3RhbmRhbG9uZTogdHJ1ZSxcclxuICBpbXBvcnRzOiBbQ29tbW9uTW9kdWxlLCBGb3Jtc01vZHVsZSwgTWF0SWNvbk1vZHVsZSwgTWF0QnV0dG9uTW9kdWxlLCBNYXRSaXBwbGVNb2R1bGUsIE1hdFRvb2x0aXBNb2R1bGUsIE1hdFByb2dyZXNzU3Bpbm5lck1vZHVsZV0sXHJcbiAgdGVtcGxhdGU6IGBcclxuICAgIDxkaXYgY2xhc3M9XCJncm91cC1tYW5hZ2VyXCI+XHJcbiAgICAgIDxkaXYgY2xhc3M9XCJoZWFkZXJcIj5cclxuICAgICAgICA8YnV0dG9uIG1hdC1pY29uLWJ1dHRvbiBjbGFzcz1cImhkci1idG5cIiAoY2xpY2spPVwiZ29CYWNrKClcIiBtYXRUb29sdGlwPVwiQmFja1wiIG1hdFRvb2x0aXBQb3NpdGlvbj1cImJlbG93XCI+XHJcbiAgICAgICAgICA8bWF0LWljb24+YXJyb3dfYmFjazwvbWF0LWljb24+XHJcbiAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgPGgzPnt7IHBhZ2VUaXRsZSB9fTwvaDM+XHJcbiAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgPGRpdiBjbGFzcz1cInNjcm9sbGFibGVcIj5cclxuICAgICAgICA8ZGl2IGNsYXNzPVwiZm9ybS1zZWN0aW9uXCI+XHJcbiAgICAgICAgICA8bGFiZWwgY2xhc3M9XCJmaWVsZC1sYWJlbFwiPnt7IGlzUHJvamVjdFN1Ymdyb3VwID8gJ1N1Ymdyb3VwIE5hbWUnIDogJ0dyb3VwIE5hbWUnIH19PC9sYWJlbD5cclxuICAgICAgICAgIDxpbnB1dFxyXG4gICAgICAgICAgICB0eXBlPVwidGV4dFwiXHJcbiAgICAgICAgICAgIFsobmdNb2RlbCldPVwiZ3JvdXBOYW1lXCJcclxuICAgICAgICAgICAgW3BsYWNlaG9sZGVyXT1cImlzUHJvamVjdFN1Ymdyb3VwID8gJ0VudGVyIHN1Ymdyb3VwIG5hbWUuLi4nIDogJ0VudGVyIGdyb3VwIG5hbWUuLi4nXCJcclxuICAgICAgICAgICAgY2xhc3M9XCJ0ZXh0LWZpZWxkXCJcclxuICAgICAgICAgICAgW3JlYWRvbmx5XT1cImlzUHJvamVjdE5hbWVMb2NrZWQgfHwgKGlzRWRpdE1vZGUgJiYgIWNhbk1hbmFnZU1lbWJlcnMpXCJcclxuICAgICAgICAgICAgW2NsYXNzLnJlYWRvbmx5XT1cImlzUHJvamVjdE5hbWVMb2NrZWQgfHwgKGlzRWRpdE1vZGUgJiYgIWNhbk1hbmFnZU1lbWJlcnMpXCJcclxuICAgICAgICAgIC8+XHJcbiAgICAgICAgICA8ZGl2ICpuZ0lmPVwiaXNQcm9qZWN0TmFtZUxvY2tlZFwiIGNsYXNzPVwiZmllbGQtbm90ZVwiPlByb2plY3QgZ3JvdXAgbmFtZXMgYXJlIGxvY2tlZCB0byB0aGUgR0lTIHByb2plY3QgbmFtZS48L2Rpdj5cclxuICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgPGRpdiAqbmdJZj1cImlzUHJvamVjdFN1Ymdyb3VwXCIgY2xhc3M9XCJmb3JtLXNlY3Rpb25cIj5cclxuICAgICAgICAgIDxsYWJlbCBjbGFzcz1cImZpZWxkLWxhYmVsXCI+U3ViamVjdDwvbGFiZWw+XHJcbiAgICAgICAgICA8dGV4dGFyZWFcclxuICAgICAgICAgICAgWyhuZ01vZGVsKV09XCJzdWJncm91cFN1YmplY3RcIlxyXG4gICAgICAgICAgICBwbGFjZWhvbGRlcj1cIk9wdGlvbmFsIHN1Ymdyb3VwIHN1YmplY3QuLi5cIlxyXG4gICAgICAgICAgICBjbGFzcz1cInRleHQtZmllbGQgc3ViamVjdC1maWVsZFwiXHJcbiAgICAgICAgICAgIFtyZWFkb25seV09XCJpc0VkaXRNb2RlICYmICFjYW5NYW5hZ2VNZW1iZXJzXCJcclxuICAgICAgICAgICAgW2NsYXNzLnJlYWRvbmx5XT1cImlzRWRpdE1vZGUgJiYgIWNhbk1hbmFnZU1lbWJlcnNcIlxyXG4gICAgICAgICAgICByb3dzPVwiM1wiXHJcbiAgICAgICAgICA+PC90ZXh0YXJlYT5cclxuICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgPG5nLWNvbnRhaW5lciAqbmdJZj1cImlzRWRpdE1vZGVcIj5cclxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJmb3JtLXNlY3Rpb24gc2VjdGlvbi1nYXBcIj5cclxuICAgICAgICAgICAgPGxhYmVsIGNsYXNzPVwiZmllbGQtbGFiZWxcIj5DdXJyZW50IE1lbWJlcnM8L2xhYmVsPlxyXG4gICAgICAgICAgICA8ZGl2ICpuZ0lmPVwibG9hZGluZ01lbWJlcnNcIiBjbGFzcz1cImxvYWRpbmctcm93XCI+XHJcbiAgICAgICAgICAgICAgPG1hdC1zcGlubmVyIGRpYW1ldGVyPVwiMThcIj48L21hdC1zcGlubmVyPlxyXG4gICAgICAgICAgICAgIDxzcGFuPkxvYWRpbmcgbWVtYmVycy4uLjwvc3Bhbj5cclxuICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgIDxkaXYgKm5nSWY9XCIhbG9hZGluZ01lbWJlcnNcIiBjbGFzcz1cIm1lbWJlcnMtbGlzdFwiPlxyXG4gICAgICAgICAgICAgIDxkaXYgKm5nRm9yPVwibGV0IG0gb2YgY3VycmVudE1lbWJlcnNcIiBjbGFzcz1cIm1lbWJlci1yb3dcIj5cclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJtZW1iZXItYXZhdGFyXCI+PG1hdC1pY29uPnBlcnNvbjwvbWF0LWljb24+PC9kaXY+XHJcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwibWVtYmVyLWluZm9cIj5cclxuICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJtZW1iZXItbmFtZVwiPlxyXG4gICAgICAgICAgICAgICAgICAgIHt7IGdldE1lbWJlck5hbWUobSkgfX17eyBtLmNvbnRhY3RfaWQgPT09IGNyZWF0b3JDb250YWN0SWQgPyAnICh5b3UpJyA6ICcnIH19XHJcbiAgICAgICAgICAgICAgICAgICAgPHNwYW4gKm5nSWY9XCJpc0FkbWluTWVtYmVyKG0pXCIgY2xhc3M9XCJhZG1pbi1iYWRnZVwiPkFkbWluPC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICA8L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwibWVtYmVyLXN1YlwiPnt7IG0uY29tcGFueSB8fCBtLmVtYWlsIH19PC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICA8YnV0dG9uIFxyXG4gICAgICAgICAgICAgICAgICAqbmdJZj1cImNhbk1hbmFnZU1lbWJlcnMgJiYgbS5jb250YWN0X2lkICE9PSBjcmVhdG9yQ29udGFjdElkXCJcclxuICAgICAgICAgICAgICAgICAgbWF0LWljb24tYnV0dG9uXHJcbiAgICAgICAgICAgICAgICAgIGNsYXNzPVwiYWRtaW4tbWVtYmVyLWJ0blwiXHJcbiAgICAgICAgICAgICAgICAgIChjbGljayk9XCJzZXRBZG1pbihtLCAhaXNBZG1pbk1lbWJlcihtKSlcIlxyXG4gICAgICAgICAgICAgICAgICBbbWF0VG9vbHRpcF09XCJpc0FkbWluTWVtYmVyKG0pID8gJ1JlbW92ZSBhZG1pbicgOiAnTWFrZSBhZG1pbidcIlxyXG4gICAgICAgICAgICAgICAgICBtYXRUb29sdGlwUG9zaXRpb249XCJsZWZ0XCJcclxuICAgICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgICAgPG1hdC1pY29uPnt7IGlzQWRtaW5NZW1iZXIobSkgPyAnc2hpZWxkJyA6ICdhZG1pbl9wYW5lbF9zZXR0aW5ncycgfX08L21hdC1pY29uPlxyXG4gICAgICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICAgICAgICA8YnV0dG9uIFxyXG4gICAgICAgICAgICAgICAgICAqbmdJZj1cImNhblJlbW92ZU1lbWJlcihtKVwiIFxyXG4gICAgICAgICAgICAgICAgICBtYXQtaWNvbi1idXR0b24gXHJcbiAgICAgICAgICAgICAgICAgIGNsYXNzPVwicmVtb3ZlLW1lbWJlci1idG5cIlxyXG4gICAgICAgICAgICAgICAgICAoY2xpY2spPVwicmVtb3ZlTWVtYmVyKG0pXCJcclxuICAgICAgICAgICAgICAgICAgbWF0VG9vbHRpcD1cIlJlbW92ZSBmcm9tIGdyb3VwXCJcclxuICAgICAgICAgICAgICAgICAgbWF0VG9vbHRpcFBvc2l0aW9uPVwibGVmdFwiXHJcbiAgICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICAgIDxtYXQtaWNvbj5wZXJzb25fcmVtb3ZlPC9tYXQtaWNvbj5cclxuICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgIDxkaXYgKm5nSWY9XCJjdXJyZW50TWVtYmVycy5sZW5ndGggPT09IDBcIiBjbGFzcz1cImVtcHR5LW1lbWJlcnNcIj5ObyBtZW1iZXJzIGZvdW5kPC9kaXY+XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgPGRpdiAqbmdJZj1cImNhbk1hbmFnZU1lbWJlcnNcIiBjbGFzcz1cImZvcm0tc2VjdGlvbiBzZWN0aW9uLWdhcFwiPlxyXG4gICAgICAgICAgICA8bGFiZWwgY2xhc3M9XCJmaWVsZC1sYWJlbFwiPkFkZCBNZW1iZXJzPC9sYWJlbD5cclxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cInNlYXJjaC1iYXJcIj5cclxuICAgICAgICAgICAgICA8bWF0LWljb24gY2xhc3M9XCJzZWFyY2gtaWNvblwiPnNlYXJjaDwvbWF0LWljb24+XHJcbiAgICAgICAgICAgICAgPGlucHV0IHR5cGU9XCJ0ZXh0XCIgWyhuZ01vZGVsKV09XCJzZWFyY2hRdWVyeVwiIHBsYWNlaG9sZGVyPVwiU2VhcmNoIGNvbnRhY3RzLi4uXCIgY2xhc3M9XCJzZWFyY2gtaW5wdXRcIiAvPlxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgIDwvbmctY29udGFpbmVyPlxyXG5cclxuICAgICAgICA8bmctY29udGFpbmVyICpuZ0lmPVwiIWlzRWRpdE1vZGVcIj5cclxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJmb3JtLXNlY3Rpb24gc2VjdGlvbi1nYXBcIj5cclxuICAgICAgICAgICAgPGxhYmVsIGNsYXNzPVwiZmllbGQtbGFiZWxcIj57eyBpc1Byb2plY3RTdWJncm91cCA/ICdBZGQgTWVtYmVycyAob3B0aW9uYWwpJyA6ICdBZGQgTWVtYmVycyAobWluIDEgb3RoZXIgcGVyc29uKScgfX08L2xhYmVsPlxyXG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwic2VhcmNoLWJhclwiPlxyXG4gICAgICAgICAgICAgIDxtYXQtaWNvbiBjbGFzcz1cInNlYXJjaC1pY29uXCI+c2VhcmNoPC9tYXQtaWNvbj5cclxuICAgICAgICAgICAgICA8aW5wdXQgdHlwZT1cInRleHRcIiBbKG5nTW9kZWwpXT1cInNlYXJjaFF1ZXJ5XCIgcGxhY2Vob2xkZXI9XCJTZWFyY2ggY29udGFjdHMuLi5cIiBjbGFzcz1cInNlYXJjaC1pbnB1dFwiIC8+XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgPC9uZy1jb250YWluZXI+XHJcblxyXG4gICAgICAgIDxkaXYgKm5nSWY9XCJzZWxlY3RlZENvbnRhY3RzLmxlbmd0aCA+IDAgJiYgKCFpc0VkaXRNb2RlIHx8IGNhbk1hbmFnZU1lbWJlcnMpXCIgY2xhc3M9XCJzZWxlY3RlZC1jaGlwc1wiPlxyXG4gICAgICAgICAgPGRpdiAqbmdGb3I9XCJsZXQgYyBvZiBzZWxlY3RlZENvbnRhY3RzXCIgY2xhc3M9XCJjaGlwXCI+XHJcbiAgICAgICAgICAgIDxzcGFuPnt7IGdldERpc3BsYXlOYW1lKGMpIH19PC9zcGFuPlxyXG4gICAgICAgICAgICA8YnV0dG9uIG1hdC1pY29uLWJ1dHRvbiBjbGFzcz1cImNoaXAtcmVtb3ZlXCIgKGNsaWNrKT1cInJlbW92ZUNvbnRhY3QoYylcIj5cclxuICAgICAgICAgICAgICA8bWF0LWljb24+Y2xvc2U8L21hdC1pY29uPlxyXG4gICAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICA8ZGl2ICpuZ0lmPVwiIWlzRWRpdE1vZGUgfHwgY2FuTWFuYWdlTWVtYmVyc1wiIGNsYXNzPVwiY29udGFjdHMtbGlzdFwiPlxyXG4gICAgICAgICAgPGRpdlxyXG4gICAgICAgICAgICAqbmdGb3I9XCJsZXQgY29udGFjdCBvZiBmaWx0ZXJlZENvbnRhY3RzXCJcclxuICAgICAgICAgICAgY2xhc3M9XCJjb250YWN0LWl0ZW1cIlxyXG4gICAgICAgICAgICBtYXRSaXBwbGVcclxuICAgICAgICAgICAgW2NsYXNzLnNlbGVjdGVkXT1cImlzU2VsZWN0ZWQoY29udGFjdClcIlxyXG4gICAgICAgICAgICAoY2xpY2spPVwidG9nZ2xlQ29udGFjdChjb250YWN0KVwiXHJcbiAgICAgICAgICA+XHJcbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJjb250YWN0LWF2YXRhclwiPlxyXG4gICAgICAgICAgICAgIDxtYXQtaWNvbj5wZXJzb248L21hdC1pY29uPlxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cImNvbnRhY3QtaW5mb1wiPlxyXG4gICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwiY29udGFjdC1uYW1lXCI+e3sgZ2V0RGlzcGxheU5hbWUoY29udGFjdCkgfX08L3NwYW4+XHJcbiAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJjb250YWN0LWNvbXBhbnlcIj57eyBjb250YWN0LmNvbXBhbnlfbmFtZSB9fTwvc3Bhbj5cclxuICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgIDxtYXQtaWNvbiAqbmdJZj1cImlzU2VsZWN0ZWQoY29udGFjdClcIiBjbGFzcz1cImNoZWNrLWljb25cIj5jaGVja19jaXJjbGU8L21hdC1pY29uPlxyXG4gICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgPC9kaXY+XHJcbiAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgPGRpdiBjbGFzcz1cImFjdGlvbi1iYXJcIj5cclxuICAgICAgICA8YnV0dG9uXHJcbiAgICAgICAgICAqbmdJZj1cIiFpc0VkaXRNb2RlIHx8IGNhbk1hbmFnZU1lbWJlcnNcIlxyXG4gICAgICAgICAgbWF0LXJhaXNlZC1idXR0b25cclxuICAgICAgICAgIFtkaXNhYmxlZF09XCIhY2FuU3VibWl0XCJcclxuICAgICAgICAgIChjbGljayk9XCJvblN1Ym1pdCgpXCJcclxuICAgICAgICAgIGNsYXNzPVwiY3JlYXRlLWJ0blwiXHJcbiAgICAgICAgPlxyXG4gICAgICAgICAgPG1hdC1pY29uPnt7IGlzRWRpdE1vZGUgPyAnc2F2ZScgOiAnZ3JvdXBfYWRkJyB9fTwvbWF0LWljb24+XHJcbiAgICAgICAgICA8bmctY29udGFpbmVyICpuZ0lmPVwiIWlzRWRpdE1vZGUgJiYgIWNyZWF0aW5nR3JvdXBcIj57eyBjcmVhdGVCdXR0b25MYWJlbCB9fTwvbmctY29udGFpbmVyPlxyXG4gICAgICAgICAgPG5nLWNvbnRhaW5lciAqbmdJZj1cIiFpc0VkaXRNb2RlICYmIGNyZWF0aW5nR3JvdXBcIj57eyBpc1Byb2plY3RTdWJncm91cCA/ICdDcmVhdGluZyBzdWJncm91cC4uLicgOiAnQ3JlYXRpbmcgZ3JvdXAuLi4nIH19PC9uZy1jb250YWluZXI+XHJcbiAgICAgICAgICA8bmctY29udGFpbmVyICpuZ0lmPVwiaXNFZGl0TW9kZVwiPlNhdmUgQ2hhbmdlczwvbmctY29udGFpbmVyPlxyXG4gICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgIDxidXR0b25cclxuICAgICAgICAgICpuZ0lmPVwiaXNFZGl0TW9kZVwiXHJcbiAgICAgICAgICBtYXQtc3Ryb2tlZC1idXR0b25cclxuICAgICAgICAgIGNsYXNzPVwiZGVsZXRlLWJ0blwiXHJcbiAgICAgICAgICBbZGlzYWJsZWRdPVwiZGVsZXRpbmdHcm91cFwiXHJcbiAgICAgICAgICAoY2xpY2spPVwicmVxdWVzdERlbGV0ZUdyb3VwKClcIlxyXG4gICAgICAgID5cclxuICAgICAgICAgIDxtYXQtaWNvbj5sb2dvdXQ8L21hdC1pY29uPlxyXG4gICAgICAgICAge3sgZGVsZXRpbmdHcm91cCA/ICdFeGl0aW5nIGdyb3VwLi4uJyA6ICdFeGl0IEdyb3VwJyB9fVxyXG4gICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICA8L2Rpdj5cclxuXHJcbiAgICAgIDxkaXYgKm5nSWY9XCJzaG93RGVsZXRlQ29uZmlybVwiIGNsYXNzPVwiY29uZmlybS1vdmVybGF5XCI+XHJcbiAgICAgICAgPGRpdiBjbGFzcz1cImNvbmZpcm0tY2FyZFwiPlxyXG4gICAgICAgICAgPGRpdiBjbGFzcz1cImNvbmZpcm0taWNvblwiPlxyXG4gICAgICAgICAgICA8bWF0LWljb24+d2FybmluZzwvbWF0LWljb24+XHJcbiAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJjb25maXJtLWNvcHlcIj5cclxuICAgICAgICAgICAgPGg0PkV4aXQgZ3JvdXA/PC9oND5cclxuICAgICAgICAgICAgPHA+QXJlIHlvdSBzdXJlIHlvdSB3YW50IHRvIGV4aXQgXCJ7eyBncm91cE5hbWUudHJpbSgpIHx8ICd0aGlzIGdyb3VwJyB9fVwiPzwvcD5cclxuICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgPGRpdiBjbGFzcz1cImNvbmZpcm0tYWN0aW9uc1wiPlxyXG4gICAgICAgICAgICA8YnV0dG9uIG1hdC1zdHJva2VkLWJ1dHRvbiBjbGFzcz1cImNvbmZpcm0tY2FuY2VsXCIgW2Rpc2FibGVkXT1cImRlbGV0aW5nR3JvdXBcIiAoY2xpY2spPVwiY2FuY2VsRGVsZXRlR3JvdXAoKVwiPlxyXG4gICAgICAgICAgICAgIENhbmNlbFxyXG4gICAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgICAgPGJ1dHRvbiBtYXQtcmFpc2VkLWJ1dHRvbiBjbGFzcz1cImNvbmZpcm0tZGVsZXRlXCIgW2Rpc2FibGVkXT1cImRlbGV0aW5nR3JvdXBcIiAoY2xpY2spPVwiY29uZmlybURlbGV0ZUdyb3VwKClcIj5cclxuICAgICAgICAgICAgICA8bWF0LWljb24+bG9nb3V0PC9tYXQtaWNvbj5cclxuICAgICAgICAgICAgICB7eyBkZWxldGluZ0dyb3VwID8gJ0V4aXRpbmcuLi4nIDogJ0V4aXQgR3JvdXAnIH19XHJcbiAgICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgPC9kaXY+XHJcbiAgICAgIDwvZGl2PlxyXG4gICAgPC9kaXY+XHJcbiAgYCxcclxuICBzdHlsZXM6IFtgXHJcbiAgICAuZ3JvdXAtbWFuYWdlciB7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XHJcbiAgICAgIGhlaWdodDogMTAwJTtcclxuICAgICAgcG9zaXRpb246IHJlbGF0aXZlO1xyXG4gICAgfVxyXG5cclxuICAgIC5oZWFkZXIge1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBwYWRkaW5nOiAxMnB4IDhweCAxMnB4IDRweDtcclxuICAgICAgYm9yZGVyLWJvdHRvbTogMXB4IHNvbGlkIHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xNSk7XHJcbiAgICAgIGdhcDogNHB4O1xyXG4gICAgICBmbGV4LXNocmluazogMDtcclxuICAgIH1cclxuXHJcbiAgICAuaGVhZGVyIGgzIHtcclxuICAgICAgbWFyZ2luOiAwO1xyXG4gICAgICBmb250LXNpemU6IDE4cHg7XHJcbiAgICAgIGZvbnQtd2VpZ2h0OiA2MDA7XHJcbiAgICAgIGNvbG9yOiAjZmZmO1xyXG4gICAgfVxyXG5cclxuICAgIC5oZHItYnRuIHtcclxuICAgICAgYm9yZGVyLXJhZGl1czogNnB4ICFpbXBvcnRhbnQ7XHJcbiAgICAgIHRyYW5zaXRpb246IGJhY2tncm91bmQgMC4xNXMsIGJveC1zaGFkb3cgMC4xNXM7XHJcbiAgICB9XHJcblxyXG4gICAgLmhkci1idG46aG92ZXIge1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMTUpICFpbXBvcnRhbnQ7XHJcbiAgICAgIGJveC1zaGFkb3c6IDAgMnB4IDhweCByZ2JhKDAsIDAsIDAsIDAuMik7XHJcbiAgICB9XHJcblxyXG4gICAgLmhkci1idG4gbWF0LWljb24ge1xyXG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjgpO1xyXG4gICAgfVxyXG5cclxuICAgIC5zY3JvbGxhYmxlIHtcclxuICAgICAgZmxleDogMTtcclxuICAgICAgb3ZlcmZsb3cteTogYXV0bztcclxuICAgIH1cclxuXHJcbiAgICAuZm9ybS1zZWN0aW9uIHtcclxuICAgICAgcGFkZGluZzogMTJweCAxNnB4IDA7XHJcbiAgICB9XHJcblxyXG4gICAgLnNlY3Rpb24tZ2FwIHtcclxuICAgICAgcGFkZGluZy10b3A6IDE2cHg7XHJcbiAgICB9XHJcblxyXG4gICAgLmZpZWxkLWxhYmVsIHtcclxuICAgICAgZGlzcGxheTogYmxvY2s7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTJweDtcclxuICAgICAgZm9udC13ZWlnaHQ6IDYwMDtcclxuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC43KTtcclxuICAgICAgdGV4dC10cmFuc2Zvcm06IHVwcGVyY2FzZTtcclxuICAgICAgbGV0dGVyLXNwYWNpbmc6IDAuMDVlbTtcclxuICAgICAgbWFyZ2luLWJvdHRvbTogNnB4O1xyXG4gICAgfVxyXG5cclxuICAgIC50ZXh0LWZpZWxkIHtcclxuICAgICAgd2lkdGg6IDEwMCU7XHJcbiAgICAgIHBhZGRpbmc6IDEwcHggMTJweDtcclxuICAgICAgYm9yZGVyOiAxcHggc29saWQgcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjI1KTtcclxuICAgICAgYm9yZGVyLXJhZGl1czogOHB4O1xyXG4gICAgICBmb250LXNpemU6IDE0cHg7XHJcbiAgICAgIGNvbG9yOiAjZmZmO1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMSk7XHJcbiAgICAgIG91dGxpbmU6IG5vbmU7XHJcbiAgICAgIHRyYW5zaXRpb246IGJvcmRlci1jb2xvciAwLjJzO1xyXG4gICAgICBib3gtc2l6aW5nOiBib3JkZXItYm94O1xyXG4gICAgfVxyXG5cclxuICAgIC50ZXh0LWZpZWxkOmZvY3VzIHsgYm9yZGVyLWNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNSk7IH1cclxuICAgIC50ZXh0LWZpZWxkOjpwbGFjZWhvbGRlciB7IGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNSk7IH1cclxuICAgIC5zdWJqZWN0LWZpZWxkIHtcclxuICAgICAgbWluLWhlaWdodDogNzRweDtcclxuICAgICAgcmVzaXplOiB2ZXJ0aWNhbDtcclxuICAgICAgZm9udC1mYW1pbHk6IGluaGVyaXQ7XHJcbiAgICAgIGxpbmUtaGVpZ2h0OiAxLjQ7XHJcbiAgICB9XHJcbiAgICAudGV4dC1maWVsZC5yZWFkb25seSB7XHJcbiAgICAgIGN1cnNvcjogbm90LWFsbG93ZWQ7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNzUpO1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMDYpO1xyXG4gICAgICBib3JkZXItY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xNik7XHJcbiAgICB9XHJcblxyXG4gICAgLmZpZWxkLW5vdGUge1xyXG4gICAgICBtYXJnaW4tdG9wOiA2cHg7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTJweDtcclxuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC41NSk7XHJcbiAgICB9XHJcblxyXG4gICAgLmxvYWRpbmctcm93IHtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAgZ2FwOiA4cHg7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwyNTUsMjU1LDAuNik7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTNweDtcclxuICAgICAgcGFkZGluZzogOHB4IDA7XHJcbiAgICB9XHJcblxyXG4gICAgLm1lbWJlcnMtbGlzdCB7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDhweDtcclxuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcclxuICAgIH1cclxuXHJcbiAgICAubWVtYmVyLXJvdyB7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgIHBhZGRpbmc6IDhweCAxMnB4O1xyXG4gICAgICBnYXA6IDEwcHg7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LDI1NSwyNTUsMC4wNyk7XHJcbiAgICAgIGJvcmRlci1ib3R0b206IDFweCBzb2xpZCByZ2JhKDI1NSwyNTUsMjU1LDAuMDYpO1xyXG4gICAgfVxyXG5cclxuICAgIC5tZW1iZXItcm93Omxhc3QtY2hpbGQgeyBib3JkZXItYm90dG9tOiBub25lOyB9XHJcblxyXG4gICAgLm1lbWJlci1hdmF0YXIge1xyXG4gICAgICB3aWR0aDogMzBweDtcclxuICAgICAgaGVpZ2h0OiAzMHB4O1xyXG4gICAgICBib3JkZXItcmFkaXVzOiA1MCU7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LDI1NSwyNTUsMC4yKTtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XHJcbiAgICAgIGZsZXgtc2hyaW5rOiAwO1xyXG4gICAgfVxyXG5cclxuICAgIC5tZW1iZXItYXZhdGFyIG1hdC1pY29uIHsgY29sb3I6ICNmZmY7IGZvbnQtc2l6ZTogMThweDsgfVxyXG5cclxuICAgIC5tZW1iZXItaW5mbyB7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XHJcbiAgICAgIGZsZXg6IDE7XHJcbiAgICAgIG1pbi13aWR0aDogMDtcclxuICAgIH1cclxuXHJcbiAgICAubWVtYmVyLW5hbWUge1xyXG4gICAgICBmb250LXNpemU6IDEzcHg7XHJcbiAgICAgIGZvbnQtd2VpZ2h0OiA1MDA7XHJcbiAgICAgIGNvbG9yOiAjZmZmO1xyXG4gICAgfVxyXG5cclxuICAgIC5hZG1pbi1iYWRnZSB7XHJcbiAgICAgIGRpc3BsYXk6IGlubGluZS1mbGV4O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBtYXJnaW4tbGVmdDogNnB4O1xyXG4gICAgICBwYWRkaW5nOiAxcHggNnB4O1xyXG4gICAgICBib3JkZXItcmFkaXVzOiA5OTlweDtcclxuICAgICAgY29sb3I6ICNiZmRiZmU7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMzcsIDk5LCAyMzUsIDAuMjIpO1xyXG4gICAgICBmb250LXNpemU6IDEwcHg7XHJcbiAgICAgIGZvbnQtd2VpZ2h0OiA3MDA7XHJcbiAgICAgIHRleHQtdHJhbnNmb3JtOiB1cHBlcmNhc2U7XHJcbiAgICAgIGxldHRlci1zcGFjaW5nOiAwLjA0ZW07XHJcbiAgICB9XHJcblxyXG4gICAgLm1lbWJlci1zdWIge1xyXG4gICAgICBmb250LXNpemU6IDExcHg7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwyNTUsMjU1LDAuNSk7XHJcbiAgICB9XHJcblxyXG4gICAgLnJlbW92ZS1tZW1iZXItYnRuIHtcclxuICAgICAgY29sb3I6IHJnYmEoMjU1LDI1NSwyNTUsMC42KSAhaW1wb3J0YW50O1xyXG4gICAgfVxyXG5cclxuICAgIC5hZG1pbi1tZW1iZXItYnRuIHtcclxuICAgICAgY29sb3I6IHJnYmEoMTQ3LDE5NywyNTMsMC45NSkgIWltcG9ydGFudDtcclxuICAgIH1cclxuXHJcbiAgICAucmVtb3ZlLW1lbWJlci1idG46aG92ZXIge1xyXG4gICAgICBjb2xvcjogI2Y4NzE3MSAhaW1wb3J0YW50O1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI0OCwxMTMsMTEzLDAuMSkgIWltcG9ydGFudDtcclxuICAgIH1cclxuXHJcbiAgICAuZW1wdHktbWVtYmVycyB7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTNweDtcclxuICAgICAgY29sb3I6IHJnYmEoMjU1LDI1NSwyNTUsMC41KTtcclxuICAgICAgcGFkZGluZzogOHB4IDA7XHJcbiAgICB9XHJcblxyXG4gICAgLnNlYXJjaC1iYXIge1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBwYWRkaW5nOiA4cHggMTJweDtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjEpO1xyXG4gICAgICBib3JkZXItcmFkaXVzOiAxMHB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5zZWFyY2gtaWNvbiB7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNik7XHJcbiAgICAgIGZvbnQtc2l6ZTogMjBweDtcclxuICAgICAgd2lkdGg6IDIwcHg7XHJcbiAgICAgIGhlaWdodDogMjBweDtcclxuICAgICAgbWFyZ2luLXJpZ2h0OiA4cHg7XHJcbiAgICB9XHJcblxyXG4gICAgLnNlYXJjaC1pbnB1dCB7XHJcbiAgICAgIGZsZXg6IDE7XHJcbiAgICAgIGJvcmRlcjogbm9uZTtcclxuICAgICAgb3V0bGluZTogbm9uZTtcclxuICAgICAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQ7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTRweDtcclxuICAgICAgY29sb3I6ICNmZmY7XHJcbiAgICB9XHJcblxyXG4gICAgLnNlYXJjaC1pbnB1dDo6cGxhY2Vob2xkZXIgeyBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjUpOyB9XHJcblxyXG4gICAgLnNlbGVjdGVkLWNoaXBzIHtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgZmxleC13cmFwOiB3cmFwO1xyXG4gICAgICBnYXA6IDZweDtcclxuICAgICAgcGFkZGluZzogOHB4IDE2cHg7XHJcbiAgICB9XHJcblxyXG4gICAgLmNoaXAge1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMik7XHJcbiAgICAgIGNvbG9yOiAjZmZmO1xyXG4gICAgICBib3JkZXItcmFkaXVzOiAxNnB4O1xyXG4gICAgICBwYWRkaW5nOiA0cHggNnB4IDRweCAxMnB4O1xyXG4gICAgICBmb250LXNpemU6IDEycHg7XHJcbiAgICAgIGZvbnQtd2VpZ2h0OiA1MDA7XHJcbiAgICB9XHJcblxyXG4gICAgLmNoaXAtcmVtb3ZlIHtcclxuICAgICAgd2lkdGg6IDIwcHggIWltcG9ydGFudDtcclxuICAgICAgaGVpZ2h0OiAyMHB4ICFpbXBvcnRhbnQ7XHJcbiAgICAgIGxpbmUtaGVpZ2h0OiAyMHB4ICFpbXBvcnRhbnQ7XHJcbiAgICB9XHJcblxyXG4gICAgLmNoaXAtcmVtb3ZlIG1hdC1pY29uIHtcclxuICAgICAgZm9udC1zaXplOiAxNHB4O1xyXG4gICAgICB3aWR0aDogMTRweDtcclxuICAgICAgaGVpZ2h0OiAxNHB4O1xyXG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjgpO1xyXG4gICAgfVxyXG5cclxuICAgIC5jb250YWN0cy1saXN0IHtcclxuICAgICAgcGFkZGluZy10b3A6IDRweDtcclxuICAgIH1cclxuXHJcbiAgICAuY29udGFjdC1pdGVtIHtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAgcGFkZGluZzogMTBweCAxNnB4O1xyXG4gICAgICBjdXJzb3I6IHBvaW50ZXI7XHJcbiAgICAgIHRyYW5zaXRpb246IGJhY2tncm91bmQgMC4xNXM7XHJcbiAgICAgIGdhcDogMTJweDtcclxuICAgIH1cclxuXHJcbiAgICAuY29udGFjdC1pdGVtOmhvdmVyIHsgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjA4KTsgfVxyXG4gICAgLmNvbnRhY3QtaXRlbS5zZWxlY3RlZCB7IGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xNSk7IH1cclxuXHJcbiAgICAuY29udGFjdC1hdmF0YXIge1xyXG4gICAgICB3aWR0aDogMzZweDtcclxuICAgICAgaGVpZ2h0OiAzNnB4O1xyXG4gICAgICBib3JkZXItcmFkaXVzOiA1MCU7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4yKTtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XHJcbiAgICAgIGZsZXgtc2hyaW5rOiAwO1xyXG4gICAgfVxyXG5cclxuICAgIC5jb250YWN0LWF2YXRhciBtYXQtaWNvbiB7IGNvbG9yOiAjZmZmOyBmb250LXNpemU6IDIwcHg7IH1cclxuXHJcbiAgICAuY29udGFjdC1pbmZvIHtcclxuICAgICAgZmxleDogMTtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcclxuICAgIH1cclxuXHJcbiAgICAuY29udGFjdC1uYW1lIHsgZm9udC13ZWlnaHQ6IDUwMDsgZm9udC1zaXplOiAxNHB4OyBjb2xvcjogI2ZmZjsgfVxyXG4gICAgLmNvbnRhY3QtY29tcGFueSB7IGZvbnQtc2l6ZTogMTJweDsgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC42KTsgfVxyXG4gICAgLmNoZWNrLWljb24geyBjb2xvcjogIzIyYzU1ZTsgZm9udC1zaXplOiAyMnB4OyB9XHJcblxyXG4gICAgLmFjdGlvbi1iYXIge1xyXG4gICAgICBwYWRkaW5nOiAxMnB4IDE2cHg7XHJcbiAgICAgIGJvcmRlci10b3A6IDFweCBzb2xpZCByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMSk7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XHJcbiAgICAgIGdhcDogOHB4O1xyXG4gICAgICBmbGV4LXNocmluazogMDtcclxuICAgIH1cclxuXHJcbiAgICAuY3JlYXRlLWJ0biB7XHJcbiAgICAgIHdpZHRoOiAxMDAlO1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMikgIWltcG9ydGFudDtcclxuICAgICAgY29sb3I6ICNmZmYgIWltcG9ydGFudDtcclxuICAgICAgYm9yZGVyLXJhZGl1czogMTBweDtcclxuICAgICAgZm9udC13ZWlnaHQ6IDYwMDtcclxuICAgIH1cclxuXHJcbiAgICAuY3JlYXRlLWJ0bjpkaXNhYmxlZCB7IG9wYWNpdHk6IDAuNTsgfVxyXG4gICAgLmNyZWF0ZS1idG4gbWF0LWljb24geyBtYXJnaW4tcmlnaHQ6IDhweDsgfVxyXG5cclxuICAgIC5kZWxldGUtYnRuIHtcclxuICAgICAgd2lkdGg6IDEwMCU7XHJcbiAgICAgIGNvbG9yOiAjZjg3MTcxICFpbXBvcnRhbnQ7XHJcbiAgICAgIGJvcmRlci1jb2xvcjogcmdiYSgyNDgsIDExMywgMTEzLCAwLjQpICFpbXBvcnRhbnQ7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDEwcHg7XHJcbiAgICAgIGZvbnQtd2VpZ2h0OiA2MDA7XHJcbiAgICB9XHJcblxyXG4gICAgLmRlbGV0ZS1idG4gbWF0LWljb24geyBtYXJnaW4tcmlnaHQ6IDhweDsgfVxyXG5cclxuICAgIC5jb25maXJtLW92ZXJsYXkge1xyXG4gICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XHJcbiAgICAgIGluc2V0OiAwO1xyXG4gICAgICB6LWluZGV4OiAxMDtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGZsZXgtZW5kO1xyXG4gICAgICBwYWRkaW5nOiAxNnB4O1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDQsIDE5LCAzNCwgMC42Mik7XHJcbiAgICAgIGJhY2tkcm9wLWZpbHRlcjogYmx1cigzcHgpO1xyXG4gICAgICBib3gtc2l6aW5nOiBib3JkZXItYm94O1xyXG4gICAgfVxyXG5cclxuICAgIC5jb25maXJtLWNhcmQge1xyXG4gICAgICB3aWR0aDogMTAwJTtcclxuICAgICAgcGFkZGluZzogMTZweDtcclxuICAgICAgYm9yZGVyLXJhZGl1czogMTRweDtcclxuICAgICAgYmFja2dyb3VuZDogIzBjMWYzNTtcclxuICAgICAgYm9yZGVyOiAxcHggc29saWQgcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjE0KTtcclxuICAgICAgYm94LXNoYWRvdzogMCAxNnB4IDQwcHggcmdiYSgwLCAwLCAwLCAwLjQ1KTtcclxuICAgICAgY29sb3I6ICNmZmY7XHJcbiAgICB9XHJcblxyXG4gICAgLmNvbmZpcm0taWNvbiB7XHJcbiAgICAgIHdpZHRoOiAzNnB4O1xyXG4gICAgICBoZWlnaHQ6IDM2cHg7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDUwJTtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNDgsIDExMywgMTEzLCAwLjE0KTtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XHJcbiAgICAgIG1hcmdpbi1ib3R0b206IDEwcHg7XHJcbiAgICB9XHJcblxyXG4gICAgLmNvbmZpcm0taWNvbiBtYXQtaWNvbiB7XHJcbiAgICAgIGNvbG9yOiAjZjg3MTcxO1xyXG4gICAgfVxyXG5cclxuICAgIC5jb25maXJtLWNvcHkgaDQge1xyXG4gICAgICBtYXJnaW46IDAgMCA2cHg7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTZweDtcclxuICAgICAgZm9udC13ZWlnaHQ6IDcwMDtcclxuICAgIH1cclxuXHJcbiAgICAuY29uZmlybS1jb3B5IHAge1xyXG4gICAgICBtYXJnaW46IDA7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNyk7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTNweDtcclxuICAgICAgbGluZS1oZWlnaHQ6IDEuNDtcclxuICAgIH1cclxuXHJcbiAgICAuY29uZmlybS1hY3Rpb25zIHtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgZ2FwOiA4cHg7XHJcbiAgICAgIG1hcmdpbi10b3A6IDE2cHg7XHJcbiAgICB9XHJcblxyXG4gICAgLmNvbmZpcm0tY2FuY2VsLFxyXG4gICAgLmNvbmZpcm0tZGVsZXRlIHtcclxuICAgICAgZmxleDogMTtcclxuICAgICAgYm9yZGVyLXJhZGl1czogMTBweDtcclxuICAgICAgZm9udC13ZWlnaHQ6IDYwMDtcclxuICAgIH1cclxuXHJcbiAgICAuY29uZmlybS1jYW5jZWwge1xyXG4gICAgICBjb2xvcjogI2ZmZiAhaW1wb3J0YW50O1xyXG4gICAgICBib3JkZXItY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4yNSkgIWltcG9ydGFudDtcclxuICAgIH1cclxuXHJcbiAgICAuY29uZmlybS1kZWxldGUge1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDIyMCwgMzgsIDM4LCAwLjkpICFpbXBvcnRhbnQ7XHJcbiAgICAgIGNvbG9yOiAjZmZmICFpbXBvcnRhbnQ7XHJcbiAgICB9XHJcblxyXG4gICAgLmNvbmZpcm0tZGVsZXRlIG1hdC1pY29uIHtcclxuICAgICAgbWFyZ2luLXJpZ2h0OiA2cHg7XHJcbiAgICAgIGZvbnQtc2l6ZTogMThweDtcclxuICAgICAgd2lkdGg6IDE4cHg7XHJcbiAgICAgIGhlaWdodDogMThweDtcclxuICAgIH1cclxuICBgXSxcclxufSlcclxuZXhwb3J0IGNsYXNzIEdyb3VwTWFuYWdlckNvbXBvbmVudCBpbXBsZW1lbnRzIE9uSW5pdCwgT25EZXN0cm95IHtcclxuICBjb250YWN0czogQ29udGFjdFtdID0gW107XHJcbiAgc2VsZWN0ZWRDb250YWN0czogQ29udGFjdFtdID0gW107XHJcbiAgY3VycmVudE1lbWJlcnM6IENvbnZlcnNhdGlvblBhcnRpY2lwYW50W10gPSBbXTtcclxuICBncm91cE5hbWUgPSAnJztcclxuICBvcmlnaW5hbEdyb3VwTmFtZSA9ICcnO1xyXG4gIHNlYXJjaFF1ZXJ5ID0gJyc7XHJcbiAgaXNFZGl0TW9kZSA9IGZhbHNlO1xyXG4gIGlzUHJvamVjdEdyb3VwID0gZmFsc2U7XHJcbiAgaXNQcm9qZWN0U3ViZ3JvdXAgPSBmYWxzZTtcclxuICBpc1Byb2plY3RTdWJncm91cENyZWF0ZSA9IGZhbHNlO1xyXG4gIHByb2plY3REYkdpZDogc3RyaW5nIHwgdW5kZWZpbmVkO1xyXG4gIHByb2plY3RHaWQ6IHN0cmluZyB8IHVuZGVmaW5lZDtcclxuICBwYXJlbnRDb252ZXJzYXRpb25JZDogc3RyaW5nIHwgdW5kZWZpbmVkO1xyXG4gIHN1Ymdyb3VwU3ViamVjdCA9ICcnO1xyXG4gIG9yaWdpbmFsU3ViZ3JvdXBTdWJqZWN0ID0gJyc7XHJcbiAgZWRpdGluZ0NvbnZlcnNhdGlvbklkOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcclxuICBjcmVhdG9yQ29udGFjdElkOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcclxuICBsb2FkaW5nTWVtYmVycyA9IGZhbHNlO1xyXG4gIGNyZWF0aW5nR3JvdXAgPSBmYWxzZTtcclxuICBkZWxldGluZ0dyb3VwID0gZmFsc2U7XHJcbiAgc2hvd0RlbGV0ZUNvbmZpcm0gPSBmYWxzZTtcclxuICBwcml2YXRlIHN1YnM6IFN1YnNjcmlwdGlvbltdID0gW107XHJcblxyXG4gIGNvbnN0cnVjdG9yKFxyXG4gICAgcHJpdmF0ZSBzdG9yZTogTWVzc2FnaW5nU3RvcmVTZXJ2aWNlLFxyXG4gICAgcHJpdmF0ZSBhcGk6IE1lc3NhZ2luZ0FwaVNlcnZpY2UsXHJcbiAgICBwcml2YXRlIGF1dGg6IEF1dGhTZXJ2aWNlXHJcbiAgKSB7fVxyXG5cclxuICBuZ09uSW5pdCgpOiB2b2lkIHtcclxuICAgIHRoaXMuY3JlYXRvckNvbnRhY3RJZCA9IHRoaXMuYXV0aC5jb250YWN0SWQ7XHJcbiAgICB0aGlzLnN0b3JlLmxvYWRWaXNpYmxlQ29udGFjdHMoKTtcclxuXHJcbiAgICB0aGlzLnN1YnMucHVzaChcclxuICAgICAgdGhpcy5zdG9yZS52aXNpYmxlQ29udGFjdHMuc3Vic2NyaWJlKChjKSA9PiB7XHJcbiAgICAgICAgaWYgKCF0aGlzLmlzUHJvamVjdEdyb3VwKSB0aGlzLmNvbnRhY3RzID0gYztcclxuICAgICAgfSlcclxuICAgICk7XHJcblxyXG4gICAgdGhpcy5zdWJzLnB1c2goXHJcbiAgICAgIHRoaXMuc3RvcmUuZ3JvdXBTZXR0aW5ncy5zdWJzY3JpYmUoKHNldHRpbmdzKSA9PiB7XHJcbiAgICAgICAgaWYgKHNldHRpbmdzKSB7XHJcbiAgICAgICAgICB0aGlzLmlzUHJvamVjdFN1Ymdyb3VwQ3JlYXRlID0gISFzZXR0aW5ncy5pc1Byb2plY3RTdWJncm91cENyZWF0ZTtcclxuICAgICAgICAgIHRoaXMuaXNFZGl0TW9kZSA9ICF0aGlzLmlzUHJvamVjdFN1Ymdyb3VwQ3JlYXRlO1xyXG4gICAgICAgICAgdGhpcy5lZGl0aW5nQ29udmVyc2F0aW9uSWQgPSB0aGlzLmlzUHJvamVjdFN1Ymdyb3VwQ3JlYXRlID8gbnVsbCA6IHNldHRpbmdzLmNvbnZlcnNhdGlvbklkO1xyXG4gICAgICAgICAgdGhpcy5ncm91cE5hbWUgPSBzZXR0aW5ncy5uYW1lO1xyXG4gICAgICAgICAgdGhpcy5vcmlnaW5hbEdyb3VwTmFtZSA9IHNldHRpbmdzLm5hbWU7XHJcbiAgICAgICAgICB0aGlzLmlzUHJvamVjdEdyb3VwID0gISFzZXR0aW5ncy5pc1Byb2plY3Q7XHJcbiAgICAgICAgICB0aGlzLmlzUHJvamVjdFN1Ymdyb3VwID0gISFzZXR0aW5ncy5pc1Byb2plY3RTdWJncm91cDtcclxuICAgICAgICAgIHRoaXMucHJvamVjdERiR2lkID0gc2V0dGluZ3MuZGJHaWQ7XHJcbiAgICAgICAgICB0aGlzLnByb2plY3RHaWQgPSBzZXR0aW5ncy5wcm9qZWN0R2lkO1xyXG4gICAgICAgICAgdGhpcy5wYXJlbnRDb252ZXJzYXRpb25JZCA9IHNldHRpbmdzLnBhcmVudENvbnZlcnNhdGlvbklkIHx8IHNldHRpbmdzLmNvbnZlcnNhdGlvbklkO1xyXG4gICAgICAgICAgdGhpcy5zdWJncm91cFN1YmplY3QgPSBzZXR0aW5ncy5zdWJqZWN0IHx8ICcnO1xyXG4gICAgICAgICAgdGhpcy5vcmlnaW5hbFN1Ymdyb3VwU3ViamVjdCA9IHNldHRpbmdzLnN1YmplY3QgfHwgJyc7XHJcbiAgICAgICAgICB0aGlzLnNlbGVjdGVkQ29udGFjdHMgPSBbXTtcclxuICAgICAgICAgIHRoaXMuY3VycmVudE1lbWJlcnMgPSBbXTtcclxuICAgICAgICAgIHRoaXMuc2hvd0RlbGV0ZUNvbmZpcm0gPSBmYWxzZTtcclxuICAgICAgICAgIGlmICh0aGlzLmlzRWRpdE1vZGUpIHtcclxuICAgICAgICAgICAgdGhpcy5sb2FkQ3VycmVudE1lbWJlcnMoc2V0dGluZ3MuY29udmVyc2F0aW9uSWQpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgdGhpcy5sb2FkUHJvamVjdEVsaWdpYmxlQ29udGFjdHMoKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgdGhpcy5pc0VkaXRNb2RlID0gZmFsc2U7XHJcbiAgICAgICAgICB0aGlzLmlzUHJvamVjdEdyb3VwID0gZmFsc2U7XHJcbiAgICAgICAgICB0aGlzLmlzUHJvamVjdFN1Ymdyb3VwID0gZmFsc2U7XHJcbiAgICAgICAgICB0aGlzLmlzUHJvamVjdFN1Ymdyb3VwQ3JlYXRlID0gZmFsc2U7XHJcbiAgICAgICAgICB0aGlzLnByb2plY3REYkdpZCA9IHVuZGVmaW5lZDtcclxuICAgICAgICAgIHRoaXMucHJvamVjdEdpZCA9IHVuZGVmaW5lZDtcclxuICAgICAgICAgIHRoaXMucGFyZW50Q29udmVyc2F0aW9uSWQgPSB1bmRlZmluZWQ7XHJcbiAgICAgICAgICB0aGlzLmVkaXRpbmdDb252ZXJzYXRpb25JZCA9IG51bGw7XHJcbiAgICAgICAgICB0aGlzLmdyb3VwTmFtZSA9ICcnO1xyXG4gICAgICAgICAgdGhpcy5vcmlnaW5hbEdyb3VwTmFtZSA9ICcnO1xyXG4gICAgICAgICAgdGhpcy5zdWJncm91cFN1YmplY3QgPSAnJztcclxuICAgICAgICAgIHRoaXMub3JpZ2luYWxTdWJncm91cFN1YmplY3QgPSAnJztcclxuICAgICAgICAgIHRoaXMuc2VsZWN0ZWRDb250YWN0cyA9IFtdO1xyXG4gICAgICAgICAgdGhpcy5jdXJyZW50TWVtYmVycyA9IFtdO1xyXG4gICAgICAgICAgdGhpcy5zaG93RGVsZXRlQ29uZmlybSA9IGZhbHNlO1xyXG4gICAgICAgIH1cclxuICAgICAgfSlcclxuICAgICk7XHJcbiAgfVxyXG5cclxuICBuZ09uRGVzdHJveSgpOiB2b2lkIHtcclxuICAgIHRoaXMuc3Vicy5mb3JFYWNoKChzKSA9PiBzLnVuc3Vic2NyaWJlKCkpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBsb2FkQ3VycmVudE1lbWJlcnMoY29udmVyc2F0aW9uSWQ6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgdGhpcy5sb2FkaW5nTWVtYmVycyA9IHRydWU7XHJcbiAgICB0aGlzLmFwaS5nZXRDb252ZXJzYXRpb25QYXJ0aWNpcGFudHMoY29udmVyc2F0aW9uSWQpLnN1YnNjcmliZSh7XHJcbiAgICAgIG5leHQ6IChtZW1iZXJzKSA9PiB7XHJcbiAgICAgICAgdGhpcy5jdXJyZW50TWVtYmVycyA9IG1lbWJlcnM7XHJcbiAgICAgICAgdGhpcy5sb2FkaW5nTWVtYmVycyA9IGZhbHNlO1xyXG4gICAgICAgIGlmICh0aGlzLmlzRWRpdE1vZGUgJiYgIXRoaXMuY3VycmVudFVzZXJJc0FkbWluKSB7XHJcbiAgICAgICAgICB0aGlzLnNlbGVjdGVkQ29udGFjdHMgPSBbXTtcclxuICAgICAgICB9XHJcbiAgICAgIH0sXHJcbiAgICAgIGVycm9yOiAoKSA9PiB7XHJcbiAgICAgICAgdGhpcy5sb2FkaW5nTWVtYmVycyA9IGZhbHNlO1xyXG4gICAgICB9LFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGxvYWRQcm9qZWN0RWxpZ2libGVDb250YWN0cygpOiB2b2lkIHtcclxuICAgIGlmICghdGhpcy5pc1Byb2plY3RHcm91cCkgcmV0dXJuO1xyXG4gICAgdGhpcy5jb250YWN0cyA9IFtdO1xyXG4gICAgaWYgKCF0aGlzLnByb2plY3REYkdpZCB8fCAhdGhpcy5wcm9qZWN0R2lkKSByZXR1cm47XHJcblxyXG4gICAgdGhpcy5hcGkuZ2V0RWxpZ2libGVQcm9qZWN0VXNlcnModGhpcy5wcm9qZWN0RGJHaWQsIHRoaXMucHJvamVjdEdpZCkuc3Vic2NyaWJlKHtcclxuICAgICAgbmV4dDogKHJlc3BvbnNlKSA9PiB7XHJcbiAgICAgICAgdGhpcy5jb250YWN0cyA9IHJlc3BvbnNlLnVzZXJzIHx8IFtdO1xyXG4gICAgICB9LFxyXG4gICAgICBlcnJvcjogKCkgPT4ge1xyXG4gICAgICAgIHRoaXMuY29udGFjdHMgPSBbXTtcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgZ2V0IGZpbHRlcmVkQ29udGFjdHMoKTogQ29udGFjdFtdIHtcclxuICAgIGNvbnN0IGFscmVhZHlJbkdyb3VwID0gbmV3IFNldCh0aGlzLmN1cnJlbnRNZW1iZXJzLm1hcCgobSkgPT4gbS5jb250YWN0X2lkKSk7XHJcbiAgICBsZXQgbGlzdCA9IHRoaXMuY29udGFjdHMuZmlsdGVyKFxyXG4gICAgICAoYykgPT4gYy5jb250YWN0X2lkICE9PSB0aGlzLmNyZWF0b3JDb250YWN0SWQgJiYgIWFscmVhZHlJbkdyb3VwLmhhcyhjLmNvbnRhY3RfaWQpXHJcbiAgICApO1xyXG4gICAgaWYgKHRoaXMuc2VhcmNoUXVlcnkudHJpbSgpKSB7XHJcbiAgICAgIGNvbnN0IHEgPSB0aGlzLnNlYXJjaFF1ZXJ5LnRvTG93ZXJDYXNlKCk7XHJcbiAgICAgIGxpc3QgPSBsaXN0LmZpbHRlcihcclxuICAgICAgICAoYykgPT5cclxuICAgICAgICAgIHRoaXMuZ2V0RGlzcGxheU5hbWUoYykudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhxKSB8fFxyXG4gICAgICAgICAgKGMuY29tcGFueV9uYW1lIHx8ICcnKS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKHEpXHJcbiAgICAgICk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gbGlzdDtcclxuICB9XHJcblxyXG4gIGdldERpc3BsYXlOYW1lKGNvbnRhY3Q6IENvbnRhY3QpOiBzdHJpbmcge1xyXG4gICAgcmV0dXJuIGdldENvbnRhY3REaXNwbGF5TmFtZShjb250YWN0KTtcclxuICB9XHJcblxyXG4gIGdldE1lbWJlck5hbWUobWVtYmVyOiBDb252ZXJzYXRpb25QYXJ0aWNpcGFudCk6IHN0cmluZyB7XHJcbiAgICByZXR1cm4gbWVtYmVyLnVzZXJuYW1lIHx8IG1lbWJlci5lbWFpbCB8fCBgQ29udGFjdCAke21lbWJlci5jb250YWN0X2lkfWA7XHJcbiAgfVxyXG5cclxuICBpc0FkbWluTWVtYmVyKG1lbWJlcjogQ29udmVyc2F0aW9uUGFydGljaXBhbnQpOiBib29sZWFuIHtcclxuICAgIHJldHVybiBtZW1iZXIuaXNfYWRtaW4gPT09IHRydWUgfHxcclxuICAgICAgbWVtYmVyLmlzX2FkbWluID09PSAndHJ1ZScgfHxcclxuICAgICAgbWVtYmVyLmlzX2FkbWluID09PSAnVHJ1ZScgfHxcclxuICAgICAgU3RyaW5nKG1lbWJlci5yb2xlIHx8ICcnKS50b0xvd2VyQ2FzZSgpID09PSAnYWRtaW4nO1xyXG4gIH1cclxuXHJcbiAgZ2V0IGN1cnJlbnRVc2VySXNBZG1pbigpOiBib29sZWFuIHtcclxuICAgIGlmICghdGhpcy5jcmVhdG9yQ29udGFjdElkKSByZXR1cm4gZmFsc2U7XHJcbiAgICBjb25zdCBtZSA9IHRoaXMuY3VycmVudE1lbWJlcnMuZmluZCgobSkgPT4gU3RyaW5nKG0uY29udGFjdF9pZCkgPT09IFN0cmluZyh0aGlzLmNyZWF0b3JDb250YWN0SWQpKTtcclxuICAgIHJldHVybiAhIW1lICYmIHRoaXMuaXNBZG1pbk1lbWJlcihtZSk7XHJcbiAgfVxyXG5cclxuICBnZXQgY2FuTWFuYWdlTWVtYmVycygpOiBib29sZWFuIHtcclxuICAgIHJldHVybiAhdGhpcy5pc0VkaXRNb2RlIHx8IHRoaXMuY3VycmVudFVzZXJJc0FkbWluO1xyXG4gIH1cclxuXHJcbiAgZ2V0IGlzUHJvamVjdE5hbWVMb2NrZWQoKTogYm9vbGVhbiB7XHJcbiAgICByZXR1cm4gdGhpcy5pc1Byb2plY3RHcm91cCAmJiAhdGhpcy5pc1Byb2plY3RTdWJncm91cDtcclxuICB9XHJcblxyXG4gIGdldCBwYWdlVGl0bGUoKTogc3RyaW5nIHtcclxuICAgIGlmICh0aGlzLmlzUHJvamVjdFN1Ymdyb3VwQ3JlYXRlKSByZXR1cm4gJ0NyZWF0ZSBTdWJncm91cCc7XHJcbiAgICBpZiAodGhpcy5pc1Byb2plY3RTdWJncm91cCkgcmV0dXJuICdTdWJncm91cCBTZXR0aW5ncyc7XHJcbiAgICByZXR1cm4gdGhpcy5pc0VkaXRNb2RlID8gJ0dyb3VwIFNldHRpbmdzJyA6ICdDcmVhdGUgR3JvdXAnO1xyXG4gIH1cclxuXHJcbiAgZ2V0IGNyZWF0ZUJ1dHRvbkxhYmVsKCk6IHN0cmluZyB7XHJcbiAgICBjb25zdCBjb3VudCA9IHRoaXMuc2VsZWN0ZWRDb250YWN0cy5sZW5ndGggKyAxO1xyXG4gICAgcmV0dXJuIHRoaXMuaXNQcm9qZWN0U3ViZ3JvdXBcclxuICAgICAgPyBgQ3JlYXRlIFN1Ymdyb3VwICgke2NvdW50fSBtZW1iZXIke2NvdW50ID09PSAxID8gJycgOiAncyd9KWBcclxuICAgICAgOiBgQ3JlYXRlIEdyb3VwICgke2NvdW50fSBtZW1iZXJzKWA7XHJcbiAgfVxyXG5cclxuICBnZXQgY2FuUmVuYW1lR3JvdXAoKTogYm9vbGVhbiB7XHJcbiAgICByZXR1cm4gdGhpcy5pc0VkaXRNb2RlICYmIHRoaXMuY3VycmVudFVzZXJJc0FkbWluICYmICF0aGlzLmlzUHJvamVjdE5hbWVMb2NrZWQ7XHJcbiAgfVxyXG5cclxuICBjYW5SZW1vdmVNZW1iZXIobWVtYmVyOiBDb252ZXJzYXRpb25QYXJ0aWNpcGFudCk6IGJvb2xlYW4ge1xyXG4gICAgcmV0dXJuIHRoaXMuY2FuTWFuYWdlTWVtYmVycyAmJiBTdHJpbmcobWVtYmVyLmNvbnRhY3RfaWQpICE9PSBTdHJpbmcodGhpcy5jcmVhdG9yQ29udGFjdElkKTtcclxuICB9XHJcblxyXG4gIGdldCBjYW5TdWJtaXQoKTogYm9vbGVhbiB7XHJcbiAgICBpZiAodGhpcy5jcmVhdGluZ0dyb3VwKSByZXR1cm4gZmFsc2U7XHJcbiAgICBpZiAoIXRoaXMuZ3JvdXBOYW1lLnRyaW0oKSkgcmV0dXJuIGZhbHNlO1xyXG4gICAgaWYgKHRoaXMuaXNFZGl0TW9kZSkge1xyXG4gICAgICBpZiAoIXRoaXMuY2FuTWFuYWdlTWVtYmVycykgcmV0dXJuIGZhbHNlO1xyXG4gICAgICBjb25zdCByZW5hbWVkID0gdGhpcy5jYW5SZW5hbWVHcm91cCAmJiB0aGlzLmdyb3VwTmFtZS50cmltKCkgIT09IHRoaXMub3JpZ2luYWxHcm91cE5hbWU7XHJcbiAgICAgIGNvbnN0IHN1YmplY3RDaGFuZ2VkID0gdGhpcy5pc1Byb2plY3RTdWJncm91cCAmJiB0aGlzLnN1Ymdyb3VwU3ViamVjdC50cmltKCkgIT09IHRoaXMub3JpZ2luYWxTdWJncm91cFN1YmplY3Q7XHJcbiAgICAgIHJldHVybiByZW5hbWVkIHx8IHN1YmplY3RDaGFuZ2VkIHx8IHRoaXMuc2VsZWN0ZWRDb250YWN0cy5sZW5ndGggPiAwO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHRoaXMuaXNQcm9qZWN0U3ViZ3JvdXAgfHwgdGhpcy5zZWxlY3RlZENvbnRhY3RzLmxlbmd0aCA+PSAxO1xyXG4gIH1cclxuXHJcbiAgaXNTZWxlY3RlZChjb250YWN0OiBDb250YWN0KTogYm9vbGVhbiB7XHJcbiAgICByZXR1cm4gdGhpcy5zZWxlY3RlZENvbnRhY3RzLnNvbWUoKGMpID0+IGMuY29udGFjdF9pZCA9PT0gY29udGFjdC5jb250YWN0X2lkKTtcclxuICB9XHJcblxyXG4gIHRvZ2dsZUNvbnRhY3QoY29udGFjdDogQ29udGFjdCk6IHZvaWQge1xyXG4gICAgaWYgKHRoaXMuaXNFZGl0TW9kZSAmJiAhdGhpcy5jYW5NYW5hZ2VNZW1iZXJzKSByZXR1cm47XHJcbiAgICBpZiAodGhpcy5pc1NlbGVjdGVkKGNvbnRhY3QpKSB7XHJcbiAgICAgIHRoaXMucmVtb3ZlQ29udGFjdChjb250YWN0KTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHRoaXMuc2VsZWN0ZWRDb250YWN0cyA9IFsuLi50aGlzLnNlbGVjdGVkQ29udGFjdHMsIGNvbnRhY3RdO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcmVtb3ZlQ29udGFjdChjb250YWN0OiBDb250YWN0KTogdm9pZCB7XHJcbiAgICB0aGlzLnNlbGVjdGVkQ29udGFjdHMgPSB0aGlzLnNlbGVjdGVkQ29udGFjdHMuZmlsdGVyKFxyXG4gICAgICAoYykgPT4gYy5jb250YWN0X2lkICE9PSBjb250YWN0LmNvbnRhY3RfaWRcclxuICAgICk7XHJcbiAgfVxyXG5cclxuICByZW1vdmVNZW1iZXIobWVtYmVyOiBDb252ZXJzYXRpb25QYXJ0aWNpcGFudCk6IHZvaWQge1xyXG4gICAgaWYgKCF0aGlzLmVkaXRpbmdDb252ZXJzYXRpb25JZCB8fCAhdGhpcy5jYW5SZW1vdmVNZW1iZXIobWVtYmVyKSkgcmV0dXJuO1xyXG4gICAgXHJcbiAgICBpZiAoY29uZmlybShgUmVtb3ZlICR7dGhpcy5nZXRNZW1iZXJOYW1lKG1lbWJlcil9IGZyb20gdGhpcyBncm91cD9gKSkge1xyXG4gICAgICB0aGlzLnN0b3JlLm1hbmFnZUdyb3VwKCdyZW1vdmUnLCB0aGlzLmVkaXRpbmdDb252ZXJzYXRpb25JZCwgdW5kZWZpbmVkLCBbbWVtYmVyLmNvbnRhY3RfaWRdLCB7XHJcbiAgICAgICAgc3VjY2VzczogKCkgPT4ge1xyXG4gICAgICAgICAgdGhpcy5jdXJyZW50TWVtYmVycyA9IHRoaXMuY3VycmVudE1lbWJlcnMuZmlsdGVyKG0gPT4gbS5jb250YWN0X2lkICE9PSBtZW1iZXIuY29udGFjdF9pZCk7XHJcbiAgICAgICAgfSxcclxuICAgICAgfSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBzZXRBZG1pbihtZW1iZXI6IENvbnZlcnNhdGlvblBhcnRpY2lwYW50LCBpc0FkbWluOiBib29sZWFuKTogdm9pZCB7XHJcbiAgICBpZiAoIXRoaXMuZWRpdGluZ0NvbnZlcnNhdGlvbklkIHx8ICF0aGlzLmNhbk1hbmFnZU1lbWJlcnMpIHJldHVybjtcclxuICAgIGlmIChTdHJpbmcobWVtYmVyLmNvbnRhY3RfaWQpID09PSBTdHJpbmcodGhpcy5jcmVhdG9yQ29udGFjdElkKSkgcmV0dXJuO1xyXG5cclxuICAgIHRoaXMuc3RvcmUuc2V0R3JvdXBBZG1pbih0aGlzLmVkaXRpbmdDb252ZXJzYXRpb25JZCwgbWVtYmVyLmNvbnRhY3RfaWQsIGlzQWRtaW4sIHtcclxuICAgICAgc3VjY2VzczogKCkgPT4ge1xyXG4gICAgICAgIHRoaXMuY3VycmVudE1lbWJlcnMgPSB0aGlzLmN1cnJlbnRNZW1iZXJzLm1hcCgobSkgPT5cclxuICAgICAgICAgIFN0cmluZyhtLmNvbnRhY3RfaWQpID09PSBTdHJpbmcobWVtYmVyLmNvbnRhY3RfaWQpXHJcbiAgICAgICAgICAgID8geyAuLi5tLCByb2xlOiBpc0FkbWluID8gJ2FkbWluJyA6ICdtZW1iZXInLCBpc19hZG1pbjogaXNBZG1pbiB9XHJcbiAgICAgICAgICAgIDogbVxyXG4gICAgICAgICk7XHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIG9uU3VibWl0KCk6IHZvaWQge1xyXG4gICAgaWYgKCF0aGlzLmNhblN1Ym1pdCkgcmV0dXJuO1xyXG5cclxuICAgIGlmICh0aGlzLmlzRWRpdE1vZGUgJiYgdGhpcy5lZGl0aW5nQ29udmVyc2F0aW9uSWQpIHtcclxuICAgICAgY29uc3QgcmVuYW1lZCA9IHRoaXMuY2FuUmVuYW1lR3JvdXAgJiYgdGhpcy5ncm91cE5hbWUudHJpbSgpICE9PSB0aGlzLm9yaWdpbmFsR3JvdXBOYW1lO1xyXG4gICAgICBjb25zdCBzdWJqZWN0Q2hhbmdlZCA9IHRoaXMuaXNQcm9qZWN0U3ViZ3JvdXAgJiYgdGhpcy5zdWJncm91cFN1YmplY3QudHJpbSgpICE9PSB0aGlzLm9yaWdpbmFsU3ViZ3JvdXBTdWJqZWN0O1xyXG4gICAgICBpZiAodGhpcy5pc1Byb2plY3RTdWJncm91cCAmJiAocmVuYW1lZCB8fCBzdWJqZWN0Q2hhbmdlZCkpIHtcclxuICAgICAgICB0aGlzLnN0b3JlLnVwZGF0ZVByb2plY3RTdWJncm91cChcclxuICAgICAgICAgIHRoaXMuZWRpdGluZ0NvbnZlcnNhdGlvbklkLFxyXG4gICAgICAgICAgdGhpcy5ncm91cE5hbWUudHJpbSgpLFxyXG4gICAgICAgICAgdGhpcy5zdWJncm91cFN1YmplY3QudHJpbSgpIHx8IG51bGwsXHJcbiAgICAgICAgKTtcclxuICAgICAgfSBlbHNlIGlmIChyZW5hbWVkKSB7XHJcbiAgICAgICAgdGhpcy5zdG9yZS5tYW5hZ2VHcm91cCgncmVuYW1lJywgdGhpcy5lZGl0aW5nQ29udmVyc2F0aW9uSWQsIHRoaXMuZ3JvdXBOYW1lLnRyaW0oKSk7XHJcbiAgICAgIH1cclxuICAgICAgaWYgKHRoaXMuY2FuTWFuYWdlTWVtYmVycyAmJiB0aGlzLnNlbGVjdGVkQ29udGFjdHMubGVuZ3RoID4gMCkge1xyXG4gICAgICAgIGNvbnN0IGlkcyA9IHRoaXMuc2VsZWN0ZWRDb250YWN0cy5tYXAoKGMpID0+IGMuY29udGFjdF9pZCk7XHJcbiAgICAgICAgdGhpcy5zdG9yZS5tYW5hZ2VHcm91cCgnYWRkJywgdGhpcy5lZGl0aW5nQ29udmVyc2F0aW9uSWQsIHVuZGVmaW5lZCwgaWRzKTtcclxuICAgICAgfVxyXG4gICAgICB0aGlzLnN0b3JlLmNsZWFyR3JvdXBTZXR0aW5ncygpO1xyXG4gICAgICB0aGlzLnN0b3JlLnNldFZpZXcoJ2NoYXQnKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHRoaXMuY3JlYXRpbmdHcm91cCA9IHRydWU7XHJcbiAgICAgIGNvbnN0IGlkcyA9IHRoaXMuc2VsZWN0ZWRDb250YWN0cy5tYXAoKGMpID0+IGMuY29udGFjdF9pZCk7XHJcbiAgICAgIGlmICh0aGlzLmlzUHJvamVjdFN1Ymdyb3VwICYmIHRoaXMucGFyZW50Q29udmVyc2F0aW9uSWQpIHtcclxuICAgICAgICB0aGlzLnN0b3JlLmNyZWF0ZVByb2plY3RTdWJncm91cChcclxuICAgICAgICAgIHRoaXMucGFyZW50Q29udmVyc2F0aW9uSWQsXHJcbiAgICAgICAgICB0aGlzLmdyb3VwTmFtZS50cmltKCksXHJcbiAgICAgICAgICB0aGlzLnN1Ymdyb3VwU3ViamVjdC50cmltKCkgfHwgbnVsbCxcclxuICAgICAgICAgIGlkcyxcclxuICAgICAgICAgIHtcclxuICAgICAgICAgICAgZXJyb3I6ICgpID0+IHtcclxuICAgICAgICAgICAgICB0aGlzLmNyZWF0aW5nR3JvdXAgPSBmYWxzZTtcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgKTtcclxuICAgICAgICByZXR1cm47XHJcbiAgICAgIH1cclxuICAgICAgdGhpcy5zdG9yZS5jcmVhdGVHcm91cENvbnZlcnNhdGlvbihpZHMsIHRoaXMuZ3JvdXBOYW1lLnRyaW0oKSwge1xyXG4gICAgICAgIGVycm9yOiAoKSA9PiB7XHJcbiAgICAgICAgICB0aGlzLmNyZWF0aW5nR3JvdXAgPSBmYWxzZTtcclxuICAgICAgICB9LFxyXG4gICAgICB9KTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHJlcXVlc3REZWxldGVHcm91cCgpOiB2b2lkIHtcclxuICAgIGlmICghdGhpcy5lZGl0aW5nQ29udmVyc2F0aW9uSWQgfHwgdGhpcy5kZWxldGluZ0dyb3VwKSByZXR1cm47XHJcbiAgICB0aGlzLnNob3dEZWxldGVDb25maXJtID0gdHJ1ZTtcclxuICB9XHJcblxyXG4gIGNhbmNlbERlbGV0ZUdyb3VwKCk6IHZvaWQge1xyXG4gICAgaWYgKHRoaXMuZGVsZXRpbmdHcm91cCkgcmV0dXJuO1xyXG4gICAgdGhpcy5zaG93RGVsZXRlQ29uZmlybSA9IGZhbHNlO1xyXG4gIH1cclxuXHJcbiAgY29uZmlybURlbGV0ZUdyb3VwKCk6IHZvaWQge1xyXG4gICAgaWYgKHRoaXMuZWRpdGluZ0NvbnZlcnNhdGlvbklkICYmICF0aGlzLmRlbGV0aW5nR3JvdXApIHtcclxuICAgICAgdGhpcy5kZWxldGluZ0dyb3VwID0gdHJ1ZTtcclxuICAgICAgdGhpcy5zdG9yZS5kZWxldGVHcm91cCh0aGlzLmVkaXRpbmdDb252ZXJzYXRpb25JZCwge1xyXG4gICAgICAgIGVycm9yOiAoKSA9PiB7XHJcbiAgICAgICAgICB0aGlzLmRlbGV0aW5nR3JvdXAgPSBmYWxzZTtcclxuICAgICAgICAgIHRoaXMuc2hvd0RlbGV0ZUNvbmZpcm0gPSBmYWxzZTtcclxuICAgICAgICB9LFxyXG4gICAgICB9KTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIGdvQmFjaygpOiB2b2lkIHtcclxuICAgIGlmICh0aGlzLmlzRWRpdE1vZGUpIHtcclxuICAgICAgdGhpcy5zdG9yZS5jbGVhckdyb3VwU2V0dGluZ3MoKTtcclxuICAgICAgdGhpcy5zdG9yZS5zZXRWaWV3KCdjaGF0Jyk7XHJcbiAgICB9IGVsc2UgaWYgKHRoaXMuaXNQcm9qZWN0U3ViZ3JvdXBDcmVhdGUpIHtcclxuICAgICAgdGhpcy5zdG9yZS5jbGVhckdyb3VwU2V0dGluZ3MoKTtcclxuICAgICAgdGhpcy5zdG9yZS5zZXRWaWV3KCdpbmJveCcpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgdGhpcy5zdG9yZS5zZXRWaWV3KCdpbmJveCcpO1xyXG4gICAgfVxyXG4gIH1cclxufVxyXG4iXX0=