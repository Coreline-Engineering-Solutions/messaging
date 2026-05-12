import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { Message, SearchFilter } from '../../models/messaging.models';
import { MessagingApiService } from '../../services/messaging-api.service';
import { AuthService } from '../../services/auth.service';
import { debounceTime, Subject } from 'rxjs';

@Component({
  selector: 'app-search-panel',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    MatIconModule, 
    MatButtonModule, 
    MatInputModule,
    MatFormFieldModule,
    MatProgressSpinnerModule,
    MatDatepickerModule,
    MatNativeDateModule
  ],
  template: `
    <div class="search-panel">
      <div class="search-header">
        <h3>Search Messages</h3>
        <button mat-icon-button (click)="onClose()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="search-input-container">
        <mat-form-field appearance="outline" class="search-field">
          <mat-icon matPrefix>search</mat-icon>
          <input 
            matInput 
            [(ngModel)]="query" 
            (ngModelChange)="onQueryChange()"
            placeholder="Search messages..."
          />
          <button mat-icon-button matSuffix *ngIf="query" (click)="clearSearch()">
            <mat-icon>clear</mat-icon>
          </button>
        </mat-form-field>

        <button mat-button (click)="showFilters = !showFilters">
          <mat-icon>filter_list</mat-icon>
          Filters
        </button>
      </div>

      <div class="filters" *ngIf="showFilters">
        <mat-form-field appearance="outline">
          <mat-label>From User</mat-label>
          <input matInput [(ngModel)]="filters.user_id" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Date From</mat-label>
          <input matInput [matDatepicker]="pickerFrom" [(ngModel)]="filters.date_from" />
          <mat-datepicker-toggle matSuffix [for]="pickerFrom"></mat-datepicker-toggle>
          <mat-datepicker #pickerFrom></mat-datepicker>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Date To</mat-label>
          <input matInput [matDatepicker]="pickerTo" [(ngModel)]="filters.date_to" />
          <mat-datepicker-toggle matSuffix [for]="pickerTo"></mat-datepicker-toggle>
          <mat-datepicker #pickerTo></mat-datepicker>
        </mat-form-field>
      </div>

      <div class="search-results">
        <div *ngIf="loading" class="loading">
          <mat-spinner diameter="40"></mat-spinner>
        </div>

        <div *ngIf="!loading && results.length === 0 && query" class="no-results">
          No messages found
        </div>

        <div *ngFor="let msg of results" class="result-item" (click)="selectMessage(msg)">
          <div class="result-header">
            <strong>{{ msg.sender_name || 'Unknown' }}</strong>
            <span class="timestamp">{{ formatDate(msg.created_at) }}</span>
          </div>
          <div class="result-content" [innerHTML]="highlightQuery(msg.content || '')"></div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .search-panel {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: white;
    }

    .search-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px;
      border-bottom: 1px solid #e0e0e0;
    }

    .search-header h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 500;
    }

    .search-input-container {
      padding: 16px;
      border-bottom: 1px solid #e0e0e0;
    }

    .search-field {
      width: 100%;
      margin-bottom: 8px;
    }

    .filters {
      padding: 16px;
      background: #f5f5f5;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .search-results {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
    }

    .loading {
      display: flex;
      justify-content: center;
      padding: 32px;
    }

    .no-results {
      text-align: center;
      color: #666;
      padding: 32px;
    }

    .result-item {
      padding: 12px;
      border-bottom: 1px solid #e0e0e0;
      cursor: pointer;
      transition: background 0.2s;
    }

    .result-item:hover {
      background: #f5f5f5;
    }

    .result-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
      font-size: 14px;
    }

    .timestamp {
      color: #666;
      font-size: 12px;
    }

    .result-content {
      font-size: 14px;
      color: #333;
      line-height: 1.4;
    }

    .result-content ::ng-deep mark {
      background-color: #ffeb3b;
      padding: 2px 4px;
      border-radius: 2px;
    }
  `]
})
export class SearchPanelComponent {
  @Output() close = new EventEmitter<void>();
  @Output() messageSelected = new EventEmitter<Message>();

  query = '';
  filters: Partial<SearchFilter> = {};
  showFilters = false;
  results: Message[] = [];
  loading = false;

  private searchSubject = new Subject<string>();

  constructor(
    private api: MessagingApiService,
    private auth: AuthService
  ) {
    this.searchSubject.pipe(debounceTime(300)).subscribe(() => {
      this.performSearch();
    });
  }

  onQueryChange() {
    this.searchSubject.next(this.query);
  }

  performSearch() {
    if (!this.query.trim()) {
      this.results = [];
      return;
    }

    const contactId = this.auth.contactId;
    if (!contactId) {
      this.loading = false;
      return;
    }

    this.loading = true;
    const conversationId = this.filters.conversation_id?.toString();
    this.api.searchMessages(contactId, this.query, conversationId).subscribe({
      next: (messages) => {
        this.results = messages;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  clearSearch() {
    this.query = '';
    this.results = [];
  }

  selectMessage(msg: Message) {
    this.messageSelected.emit(msg);
  }

  onClose() {
    this.close.emit();
  }

  formatDate(timestamp: string): string {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  highlightQuery(text: string): string {
    if (!this.query) return text;
    const regex = new RegExp(`(${this.query})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }
}
