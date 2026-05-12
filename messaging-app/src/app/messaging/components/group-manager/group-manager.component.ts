import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatRippleModule } from '@angular/material/core';
import { MatChipsModule } from '@angular/material/chips';
import { Subscription } from 'rxjs';
import { MessagingStoreService } from '../../services/messaging-store.service';
import { Contact } from '../../models/messaging.models';

@Component({
  selector: 'app-group-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatRippleModule, MatChipsModule],
  template: `
    <div class="group-manager">
      <div class="header">
        <button mat-icon-button (click)="goBack()">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <h3>Create Group</h3>
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
        <label class="field-label">Add Members</label>
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
          <span>{{ c.first_name }} {{ c.last_name }}</span>
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
            <span class="contact-name">{{ contact.first_name }} {{ contact.last_name }}</span>
            <span class="contact-company">{{ contact.company_name }}</span>
          </div>
          <mat-icon *ngIf="isSelected(contact)" class="check-icon">check_circle</mat-icon>
        </div>
      </div>

      <div class="action-bar">
        <button
          mat-raised-button
          color="primary"
          [disabled]="!canCreate"
          (click)="createGroup()"
          class="create-btn"
        >
          <mat-icon>group_add</mat-icon>
          Create Group ({{ selectedContacts.length }} members)
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
      border-bottom: 1px solid #e5e7eb;
      gap: 4px;
    }

    .header h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #1f2937;
    }

    .header button mat-icon {
      color: #6b7280;
    }

    .form-section {
      padding: 12px 16px 0;
    }

    .field-label {
      display: block;
      font-size: 12px;
      font-weight: 600;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 6px;
    }

    .text-field {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      font-size: 14px;
      color: #1f2937;
      outline: none;
      transition: border-color 0.2s;
      box-sizing: border-box;
    }

    .text-field:focus {
      border-color: #667eea;
    }

    .text-field::placeholder {
      color: #9ca3af;
    }

    .search-bar {
      display: flex;
      align-items: center;
      padding: 8px 12px;
      background: #f3f4f6;
      border-radius: 10px;
    }

    .search-icon {
      color: #9ca3af;
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
      color: #1f2937;
    }

    .search-input::placeholder {
      color: #9ca3af;
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
      background: #e0e7ff;
      color: #4338ca;
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
      color: #4338ca;
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
      background: #f9fafb;
    }

    .contact-item.selected {
      background: #f0f4ff;
    }

    .contact-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .contact-avatar mat-icon {
      color: #667eea;
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
      color: #1f2937;
    }

    .contact-company {
      font-size: 12px;
      color: #9ca3af;
    }

    .check-icon {
      color: #667eea;
      font-size: 22px;
    }

    .action-bar {
      padding: 12px 16px;
      border-top: 1px solid #e5e7eb;
    }

    .create-btn {
      width: 100%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 10px;
      font-weight: 600;
    }

    .create-btn mat-icon {
      margin-right: 8px;
    }
  `],
})
export class GroupManagerComponent implements OnInit, OnDestroy {
  contacts: Contact[] = [];
  selectedContacts: Contact[] = [];
  groupName = '';
  searchQuery = '';
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
        `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
        (c.company_name || '').toLowerCase().includes(q)
    );
  }

  get canCreate(): boolean {
    return this.groupName.trim().length > 0 && this.selectedContacts.length >= 1;
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

  createGroup(): void {
    if (!this.canCreate) return;
    const ids = this.selectedContacts.map((c) => c.contact_id);
    this.store.createGroupConversation(ids, this.groupName.trim());
    this.goBack();
  }

  goBack(): void {
    this.store.setView('inbox');
  }
}
