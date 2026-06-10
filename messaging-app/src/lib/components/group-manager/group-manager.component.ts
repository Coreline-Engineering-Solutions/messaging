import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatRippleModule } from '@angular/material/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subscription } from 'rxjs';
import { MessagingStoreService } from '../../services/messaging-store.service';
import { MessagingApiService } from '../../services/messaging-api.service';
import { AuthService } from '../../services/auth.service';
import { Contact, ConversationParticipant, getContactDisplayName } from '../../models/messaging.models';

@Component({
  selector: 'app-group-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatRippleModule, MatTooltipModule, MatProgressSpinnerModule],
  template: `
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
  `,
  styles: [`
    .group-manager {
      display: flex;
      flex-direction: column;
      height: 100%;
      position: relative;
    }

    .header {
      display: flex;
      align-items: center;
      padding: 12px 8px 12px 4px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.15);
      gap: 4px;
      flex-shrink: 0;
    }

    .header h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #fff;
    }

    .hdr-btn {
      border-radius: 6px !important;
      transition: background 0.15s, box-shadow 0.15s;
    }

    .hdr-btn:hover {
      background: rgba(255, 255, 255, 0.15) !important;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }

    .hdr-btn mat-icon {
      color: rgba(255, 255, 255, 0.8);
    }

    .scrollable {
      flex: 1;
      overflow-y: auto;
    }

    .form-section {
      padding: 12px 16px 0;
    }

    .section-gap {
      padding-top: 16px;
    }

    .field-label {
      display: block;
      font-size: 12px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.7);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 6px;
    }

    .text-field {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid rgba(255, 255, 255, 0.25);
      border-radius: 8px;
      font-size: 14px;
      color: #fff;
      background: rgba(255, 255, 255, 0.1);
      outline: none;
      transition: border-color 0.2s;
      box-sizing: border-box;
    }

    .text-field:focus { border-color: rgba(255, 255, 255, 0.5); }
    .text-field::placeholder { color: rgba(255, 255, 255, 0.5); }
    .subject-field {
      min-height: 74px;
      resize: vertical;
      font-family: inherit;
      line-height: 1.4;
    }
    .text-field.readonly {
      cursor: not-allowed;
      color: rgba(255, 255, 255, 0.75);
      background: rgba(255, 255, 255, 0.06);
      border-color: rgba(255, 255, 255, 0.16);
    }

    .field-note {
      margin-top: 6px;
      font-size: 12px;
      color: rgba(255, 255, 255, 0.55);
    }

    .loading-row {
      display: flex;
      align-items: center;
      gap: 8px;
      color: rgba(255,255,255,0.6);
      font-size: 13px;
      padding: 8px 0;
    }

    .members-list {
      border-radius: 8px;
      overflow: hidden;
    }

    .member-row {
      display: flex;
      align-items: center;
      padding: 8px 12px;
      gap: 10px;
      background: rgba(255,255,255,0.07);
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }

    .member-row:last-child { border-bottom: none; }

    .member-avatar {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      background: rgba(255,255,255,0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .member-avatar mat-icon { color: #fff; font-size: 18px; }

    .member-info {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 0;
    }

    .member-name {
      font-size: 13px;
      font-weight: 500;
      color: #fff;
    }

    .admin-badge {
      display: inline-flex;
      align-items: center;
      margin-left: 6px;
      padding: 1px 6px;
      border-radius: 999px;
      color: #bfdbfe;
      background: rgba(37, 99, 235, 0.22);
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .member-sub {
      font-size: 11px;
      color: rgba(255,255,255,0.5);
    }

    .remove-member-btn {
      color: rgba(255,255,255,0.6) !important;
    }

    .admin-member-btn {
      color: rgba(147,197,253,0.95) !important;
    }

    .remove-member-btn:hover {
      color: #f87171 !important;
      background: rgba(248,113,113,0.1) !important;
    }

    .empty-members {
      font-size: 13px;
      color: rgba(255,255,255,0.5);
      padding: 8px 0;
    }

    .search-bar {
      display: flex;
      align-items: center;
      padding: 8px 12px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 10px;
    }

    .search-icon {
      color: rgba(255, 255, 255, 0.6);
      font-size: 20px;
      width: 20px;
      height: 20px;
      margin-right: 8px;
    }

    .search-input {
      flex: 1;
      border: none;
      outline: none;
      background: transparent;
      font-size: 14px;
      color: #fff;
    }

    .search-input::placeholder { color: rgba(255, 255, 255, 0.5); }

    .selected-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      padding: 8px 16px;
    }

    .chip {
      display: flex;
      align-items: center;
      background: rgba(255, 255, 255, 0.2);
      color: #fff;
      border-radius: 16px;
      padding: 4px 6px 4px 12px;
      font-size: 12px;
      font-weight: 500;
    }

    .chip-remove {
      width: 20px !important;
      height: 20px !important;
      line-height: 20px !important;
    }

    .chip-remove mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
      color: rgba(255, 255, 255, 0.8);
    }

    .contacts-list {
      padding-top: 4px;
    }

    .contact-item {
      display: flex;
      align-items: center;
      padding: 10px 16px;
      cursor: pointer;
      transition: background 0.15s;
      gap: 12px;
    }

    .contact-item:hover { background: rgba(255, 255, 255, 0.08); }
    .contact-item.selected { background: rgba(255, 255, 255, 0.15); }

    .contact-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .contact-avatar mat-icon { color: #fff; font-size: 20px; }

    .contact-info {
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    .contact-name { font-weight: 500; font-size: 14px; color: #fff; }
    .contact-company { font-size: 12px; color: rgba(255, 255, 255, 0.6); }
    .check-icon { color: #22c55e; font-size: 22px; }

    .action-bar {
      padding: 12px 16px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      display: flex;
      flex-direction: column;
      gap: 8px;
      flex-shrink: 0;
    }

    .create-btn {
      width: 100%;
      background: rgba(255, 255, 255, 0.2) !important;
      color: #fff !important;
      border-radius: 10px;
      font-weight: 600;
    }

    .create-btn:disabled { opacity: 0.5; }
    .create-btn mat-icon { margin-right: 8px; }

    .delete-btn {
      width: 100%;
      color: #f87171 !important;
      border-color: rgba(248, 113, 113, 0.4) !important;
      border-radius: 10px;
      font-weight: 600;
    }

    .delete-btn mat-icon { margin-right: 8px; }

    .confirm-overlay {
      position: absolute;
      inset: 0;
      z-index: 10;
      display: flex;
      align-items: flex-end;
      padding: 16px;
      background: rgba(4, 19, 34, 0.62);
      backdrop-filter: blur(3px);
      box-sizing: border-box;
    }

    .confirm-card {
      width: 100%;
      padding: 16px;
      border-radius: 14px;
      background: #0c1f35;
      border: 1px solid rgba(255, 255, 255, 0.14);
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45);
      color: #fff;
    }

    .confirm-icon {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: rgba(248, 113, 113, 0.14);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 10px;
    }

    .confirm-icon mat-icon {
      color: #f87171;
    }

    .confirm-copy h4 {
      margin: 0 0 6px;
      font-size: 16px;
      font-weight: 700;
    }

    .confirm-copy p {
      margin: 0;
      color: rgba(255, 255, 255, 0.7);
      font-size: 13px;
      line-height: 1.4;
    }

    .confirm-actions {
      display: flex;
      gap: 8px;
      margin-top: 16px;
    }

    .confirm-cancel,
    .confirm-delete {
      flex: 1;
      border-radius: 10px;
      font-weight: 600;
    }

    .confirm-cancel {
      color: #fff !important;
      border-color: rgba(255, 255, 255, 0.25) !important;
    }

    .confirm-delete {
      background: rgba(220, 38, 38, 0.9) !important;
      color: #fff !important;
    }

    .confirm-delete mat-icon {
      margin-right: 6px;
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
  `],
})
export class GroupManagerComponent implements OnInit, OnDestroy {
  contacts: Contact[] = [];
  selectedContacts: Contact[] = [];
  currentMembers: ConversationParticipant[] = [];
  groupName = '';
  originalGroupName = '';
  searchQuery = '';
  isEditMode = false;
  isProjectGroup = false;
  isProjectSubgroup = false;
  isProjectSubgroupCreate = false;
  projectDbGid: string | undefined;
  projectGid: string | undefined;
  parentConversationId: string | undefined;
  subgroupSubject = '';
  originalSubgroupSubject = '';
  editingConversationId: string | null = null;
  creatorContactId: string | null = null;
  loadingMembers = false;
  creatingGroup = false;
  deletingGroup = false;
  showDeleteConfirm = false;
  private subs: Subscription[] = [];

  constructor(
    private store: MessagingStoreService,
    private api: MessagingApiService,
    private auth: AuthService
  ) {}

  ngOnInit(): void {
    this.creatorContactId = this.auth.contactId;
    this.store.loadVisibleContacts();

    this.subs.push(
      this.store.visibleContacts.subscribe((c) => {
        if (!this.isProjectGroup) this.contacts = c;
      })
    );

    this.subs.push(
      this.store.groupSettings.subscribe((settings) => {
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
        } else {
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
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
  }

  private loadCurrentMembers(conversationId: string): void {
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

  private loadProjectEligibleContacts(): void {
    if (!this.isProjectGroup) return;
    this.contacts = [];
    if (!this.projectDbGid || !this.projectGid) return;

    this.api.getEligibleProjectUsers(this.projectDbGid, this.projectGid).subscribe({
      next: (response) => {
        this.contacts = response.users || [];
      },
      error: () => {
        this.contacts = [];
      },
    });
  }

  get filteredContacts(): Contact[] {
    const alreadyInGroup = new Set(this.currentMembers.map((m) => m.contact_id));
    let list = this.contacts.filter(
      (c) => c.contact_id !== this.creatorContactId && !alreadyInGroup.has(c.contact_id)
    );
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(
        (c) =>
          this.getDisplayName(c).toLowerCase().includes(q) ||
          (c.company_name || '').toLowerCase().includes(q)
      );
    }
    return list;
  }

  getDisplayName(contact: Contact): string {
    return getContactDisplayName(contact);
  }

  getMemberName(member: ConversationParticipant): string {
    return member.username || member.email || `Contact ${member.contact_id}`;
  }

  isAdminMember(member: ConversationParticipant): boolean {
    return member.is_admin === true ||
      member.is_admin === 'true' ||
      member.is_admin === 'True' ||
      String(member.role || '').toLowerCase() === 'admin';
  }

  get currentUserIsAdmin(): boolean {
    if (!this.creatorContactId) return false;
    const me = this.currentMembers.find((m) => String(m.contact_id) === String(this.creatorContactId));
    return !!me && this.isAdminMember(me);
  }

  get canManageMembers(): boolean {
    return !this.isEditMode || this.currentUserIsAdmin;
  }

  get isProjectNameLocked(): boolean {
    return this.isProjectGroup && !this.isProjectSubgroup;
  }

  get pageTitle(): string {
    if (this.isProjectSubgroupCreate) return 'Create Subgroup';
    if (this.isProjectSubgroup) return 'Subgroup Settings';
    return this.isEditMode ? 'Group Settings' : 'Create Group';
  }

  get createButtonLabel(): string {
    const count = this.selectedContacts.length + 1;
    return this.isProjectSubgroup
      ? `Create Subgroup (${count} member${count === 1 ? '' : 's'})`
      : `Create Group (${count} members)`;
  }

  get canRenameGroup(): boolean {
    return this.isEditMode && this.currentUserIsAdmin && !this.isProjectNameLocked;
  }

  canRemoveMember(member: ConversationParticipant): boolean {
    return this.canManageMembers && String(member.contact_id) !== String(this.creatorContactId);
  }

  get canSubmit(): boolean {
    if (this.creatingGroup) return false;
    if (!this.groupName.trim()) return false;
    if (this.isEditMode) {
      if (!this.canManageMembers) return false;
      const renamed = this.canRenameGroup && this.groupName.trim() !== this.originalGroupName;
      const subjectChanged = this.isProjectSubgroup && this.subgroupSubject.trim() !== this.originalSubgroupSubject;
      return renamed || subjectChanged || this.selectedContacts.length > 0;
    }
    return this.isProjectSubgroup || this.selectedContacts.length >= 1;
  }

  isSelected(contact: Contact): boolean {
    return this.selectedContacts.some((c) => c.contact_id === contact.contact_id);
  }

  toggleContact(contact: Contact): void {
    if (this.isEditMode && !this.canManageMembers) return;
    if (this.isSelected(contact)) {
      this.removeContact(contact);
    } else {
      this.selectedContacts = [...this.selectedContacts, contact];
    }
  }

  removeContact(contact: Contact): void {
    this.selectedContacts = this.selectedContacts.filter(
      (c) => c.contact_id !== contact.contact_id
    );
  }

  removeMember(member: ConversationParticipant): void {
    if (!this.editingConversationId || !this.canRemoveMember(member)) return;
    
    if (confirm(`Remove ${this.getMemberName(member)} from this group?`)) {
      this.store.manageGroup('remove', this.editingConversationId, undefined, [member.contact_id], {
        success: () => {
          this.currentMembers = this.currentMembers.filter(m => m.contact_id !== member.contact_id);
        },
      });
    }
  }

  setAdmin(member: ConversationParticipant, isAdmin: boolean): void {
    if (!this.editingConversationId || !this.canManageMembers) return;
    if (String(member.contact_id) === String(this.creatorContactId)) return;

    this.store.setGroupAdmin(this.editingConversationId, member.contact_id, isAdmin, {
      success: () => {
        this.currentMembers = this.currentMembers.map((m) =>
          String(m.contact_id) === String(member.contact_id)
            ? { ...m, role: isAdmin ? 'admin' : 'member', is_admin: isAdmin }
            : m
        );
      },
    });
  }

  onSubmit(): void {
    if (!this.canSubmit) return;

    if (this.isEditMode && this.editingConversationId) {
      const renamed = this.canRenameGroup && this.groupName.trim() !== this.originalGroupName;
      const subjectChanged = this.isProjectSubgroup && this.subgroupSubject.trim() !== this.originalSubgroupSubject;
      if (this.isProjectSubgroup && (renamed || subjectChanged)) {
        this.store.updateProjectSubgroup(
          this.editingConversationId,
          this.groupName.trim(),
          this.subgroupSubject.trim() || null,
        );
      } else if (renamed) {
        this.store.manageGroup('rename', this.editingConversationId, this.groupName.trim());
      }
      if (this.canManageMembers && this.selectedContacts.length > 0) {
        const ids = this.selectedContacts.map((c) => c.contact_id);
        this.store.manageGroup('add', this.editingConversationId, undefined, ids);
      }
      this.store.clearGroupSettings();
      this.store.setView('chat');
    } else {
      this.creatingGroup = true;
      const ids = this.selectedContacts.map((c) => c.contact_id);
      if (this.isProjectSubgroup && this.parentConversationId) {
        this.store.createProjectSubgroup(
          this.parentConversationId,
          this.groupName.trim(),
          this.subgroupSubject.trim() || null,
          ids,
          {
            error: () => {
              this.creatingGroup = false;
            },
          },
        );
        return;
      }
      this.store.createGroupConversation(ids, this.groupName.trim(), {
        error: () => {
          this.creatingGroup = false;
        },
      });
    }
  }

  requestDeleteGroup(): void {
    if (!this.editingConversationId || this.deletingGroup) return;
    this.showDeleteConfirm = true;
  }

  cancelDeleteGroup(): void {
    if (this.deletingGroup) return;
    this.showDeleteConfirm = false;
  }

  confirmDeleteGroup(): void {
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

  goBack(): void {
    if (this.isEditMode) {
      this.store.clearGroupSettings();
      this.store.setView('chat');
    } else if (this.isProjectSubgroupCreate) {
      this.store.clearGroupSettings();
      this.store.setView('inbox');
    } else {
      this.store.setView('inbox');
    }
  }
}
