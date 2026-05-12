import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatRippleModule } from '@angular/material/core';
import { Subscription } from 'rxjs';
import { MessagingStoreService } from '../../services/messaging-store.service';
import { Contact } from '../../models/messaging.models';

@Component({
  selector: 'app-new-conversation',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatRippleModule],
  template: `
    <div class="new-conv-container">
      <div class="header">
        <button mat-icon-button (click)="goBack()">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <h3>New Message</h3>
      </div>

      <div class="search-bar">
        <mat-icon class="search-icon">search</mat-icon>
        <input
          type="text"
          [(ngModel)]="searchQuery"
          placeholder="Search contacts..."
          class="search-input"
        />
      </div>

      <div class="contacts-list">
        <div
          *ngFor="let contact of filteredContacts"
          class="contact-item"
          matRipple
          (click)="selectContact(contact)"
        >
          <div class="contact-avatar">
            <mat-icon>person</mat-icon>
          </div>
          <div class="contact-info">
            <span class="contact-name">{{ contact.first_name }} {{ contact.last_name }}</span>
            <span class="contact-company">{{ contact.company_name }}</span>
          </div>
        </div>

        <div *ngIf="filteredContacts.length === 0" class="empty-state">
          <mat-icon>person_search</mat-icon>
          <p>{{ searchQuery ? 'No contacts found' : 'No visible contacts' }}</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .new-conv-container {
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

    .search-bar {
      display: flex;
      align-items: center;
      margin: 12px 16px;
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

    .contacts-list {
      flex: 1;
      overflow-y: auto;
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

    .contact-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .contact-avatar mat-icon {
      color: #667eea;
    }

    .contact-info {
      display: flex;
      flex-direction: column;
    }

    .contact-name {
      font-weight: 600;
      font-size: 14px;
      color: #1f2937;
    }

    .contact-company {
      font-size: 12px;
      color: #9ca3af;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px 24px;
      color: #9ca3af;
    }

    .empty-state mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      margin-bottom: 12px;
    }

    .empty-state p {
      font-size: 14px;
      margin: 0;
    }
  `],
})
export class NewConversationComponent implements OnInit, OnDestroy {
  contacts: Contact[] = [];
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
        (c.company_name || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q)
    );
  }

  selectContact(contact: Contact): void {
    this.store.sendDirectMessage(contact.contact_id, 'Hello!');
  }

  goBack(): void {
    this.store.setView('inbox');
  }
}
