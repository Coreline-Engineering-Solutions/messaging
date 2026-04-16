import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatRippleModule } from '@angular/material/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription } from 'rxjs';
import { MessagingStoreService } from '../../services/messaging-store.service';
import { Contact, getContactDisplayName } from '../../models/messaging.models';

@Component({
  selector: 'app-group-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatRippleModule, MatTooltipModule],
  template: `
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

    .form-section {
      padding: 12px 16px 0;
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

    .text-field:focus {
      border-color: rgba(255, 255, 255, 0.5);
    }

    .text-field::placeholder {
      color: rgba(255, 255, 255, 0.5);
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

    .search-input::placeholder {
      color: rgba(255, 255, 255, 0.5);
    }

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
      flex: 1;
      overflow-y: auto;
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

    .contact-item:hover {
      background: rgba(255, 255, 255, 0.08);
    }

    .contact-item.selected {
      background: rgba(255, 255, 255, 0.15);
    }

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

    .contact-avatar mat-icon {
      color: #fff;
      font-size: 20px;
    }

    .contact-info {
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    .contact-name {
      font-weight: 500;
      font-size: 14px;
      color: #fff;
    }

    .contact-company {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.6);
    }

    .check-icon {
      color: #22c55e;
      font-size: 22px;
    }

    .action-bar {
      padding: 12px 16px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .create-btn {
      width: 100%;
      background: rgba(255, 255, 255, 0.2) !important;
      color: #fff !important;
      border-radius: 10px;
      font-weight: 600;
    }

    .create-btn:disabled {
      opacity: 0.5;
    }

    .create-btn mat-icon {
      margin-right: 8px;
    }

    .delete-btn {
      width: 100%;
      color: #f87171 !important;
      border-color: rgba(248, 113, 113, 0.4) !important;
      border-radius: 10px;
      font-weight: 600;
    }

    .delete-btn mat-icon {
      margin-right: 8px;
    }
  `],
})
export class GroupManagerComponent implements OnInit, OnDestroy {
  contacts: Contact[] = [];
  selectedContacts: Contact[] = [];
  groupName = '';
  searchQuery = '';
  isEditMode = false;
  editingConversationId: string | null = null;
  creatorContactId: string | null = null;
  private sub!: Subscription;

  constructor(private store: MessagingStoreService) {}

  ngOnInit(): void {
    this.store.loadVisibleContacts();
    this.sub = this.store.visibleContacts.subscribe((c) => (this.contacts = c));
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  get filteredContacts(): Contact[] {
    if (!this.searchQuery.trim()) return this.contacts;
    const q = this.searchQuery.toLowerCase();
    return this.contacts.filter(
      (c) =>
        this.getDisplayName(c).toLowerCase().includes(q) ||
        (c.company_name || '').toLowerCase().includes(q)
    );
  }

  getDisplayName(contact: Contact): string {
    return getContactDisplayName(contact);
  }

  get canCreate(): boolean {
    return this.groupName.trim().length > 0 && this.selectedContacts.length >= 1;
  }

  isSelected(contact: Contact): boolean {
    return this.selectedContacts.some((c) => c.contact_id === contact.contact_id);
  }

  isCreator(contact: Contact): boolean {
    return contact.contact_id === this.creatorContactId;
  }

  toggleContact(contact: Contact): void {
    if (this.isCreator(contact)) return;
    if (this.isSelected(contact)) {
      this.removeContact(contact);
    } else {
      this.selectedContacts = [...this.selectedContacts, contact];
    }
  }

  removeContact(contact: Contact): void {
    if (this.isCreator(contact)) return;
    this.selectedContacts = this.selectedContacts.filter(
      (c) => c.contact_id !== contact.contact_id
    );
  }

  onSubmit(): void {
    if (!this.canCreate) return;
    if (this.isEditMode && this.editingConversationId) {
      this.store.manageGroup('rename', this.editingConversationId, this.groupName.trim());
    } else {
      const ids = this.selectedContacts.map((c) => c.contact_id);
      this.store.createGroupConversation(ids, this.groupName.trim());
    }
    this.goBack();
  }

  onDelete(): void {
    if (this.editingConversationId) {
      this.store.deleteGroup(this.editingConversationId);
      this.goBack();
    }
  }

  goBack(): void {
    this.store.setView('inbox');
  }
}
