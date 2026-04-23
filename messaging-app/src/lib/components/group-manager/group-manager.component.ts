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
                  <span class="member-sub">{{ m.contact_id }}</span>
                </div>
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
  `,
  styles: [`
    .group-manager {
      display: flex;
      flex-direction: column;
      height: 100%;
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
    }

    .member-name {
      font-size: 13px;
      font-weight: 500;
      color: #fff;
    }

    .member-sub {
      font-size: 11px;
      color: rgba(255,255,255,0.5);
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
  editingConversationId: string | null = null;
  creatorContactId: string | null = null;
  loadingMembers = false;
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
      this.store.visibleContacts.subscribe((c) => (this.contacts = c))
    );

    this.subs.push(
      this.store.groupSettings.subscribe((settings) => {
        if (settings) {
          this.isEditMode = true;
          this.editingConversationId = settings.conversationId;
          this.groupName = settings.name;
          this.originalGroupName = settings.name;
          this.selectedContacts = [];
          this.loadCurrentMembers(settings.conversationId);
        } else {
          this.isEditMode = false;
          this.editingConversationId = null;
          this.groupName = '';
          this.originalGroupName = '';
          this.selectedContacts = [];
          this.currentMembers = [];
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
      },
      error: () => {
        this.loadingMembers = false;
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
    if (member.first_name || member.last_name) {
      return `${member.first_name || ''} ${member.last_name || ''}`.trim();
    }
    return member.contact_id;
  }

  get canSubmit(): boolean {
    if (!this.groupName.trim()) return false;
    if (this.isEditMode) {
      return this.groupName.trim() !== this.originalGroupName || this.selectedContacts.length > 0;
    }
    return this.selectedContacts.length >= 1;
  }

  isSelected(contact: Contact): boolean {
    return this.selectedContacts.some((c) => c.contact_id === contact.contact_id);
  }

  toggleContact(contact: Contact): void {
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

  onSubmit(): void {
    if (!this.canSubmit) return;

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
    } else {
      const ids = this.selectedContacts.map((c) => c.contact_id);
      this.store.createGroupConversation(ids, this.groupName.trim());
    }
  }

  onDelete(): void {
    if (this.editingConversationId) {
      this.store.deleteGroup(this.editingConversationId);
      this.store.clearGroupSettings();
      this.goBack();
    }
  }

  goBack(): void {
    if (this.isEditMode) {
      this.store.clearGroupSettings();
      this.store.setView('chat');
    } else {
      this.store.setView('inbox');
    }
  }
}
