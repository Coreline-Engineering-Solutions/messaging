import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { 
  MessagingStoreService, 
  MessagingApiService,
  AuthService,
  InboxItem 
} from '@coreline-engineering-solutions/messaging';

/**
 * DASHBOARD COMPONENT EXAMPLE
 * 
 * Shows how to:
 * 1. Access messaging state (inbox, unread counts)
 * 2. Use messaging services directly
 * 3. Display messaging data in your own UI
 */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dashboard">
      <h1>Dashboard</h1>

      <!-- Messaging Stats -->
      <div class="stats-grid">
        <div class="stat-card">
          <span class="material-icons">chat_bubble</span>
          <div class="stat-content">
            <div class="stat-value">{{ unreadCount$ | async }}</div>
            <div class="stat-label">Unread Messages</div>
          </div>
        </div>

        <div class="stat-card">
          <span class="material-icons">forum</span>
          <div class="stat-content">
            <div class="stat-value">{{ totalConversations$ | async }}</div>
            <div class="stat-label">Active Conversations</div>
          </div>
        </div>

        <div class="stat-card">
          <span class="material-icons">people</span>
          <div class="stat-content">
            <div class="stat-value">{{ contactCount }}</div>
            <div class="stat-label">Available Contacts</div>
          </div>
        </div>
      </div>

      <!-- Recent Conversations -->
      <div class="recent-conversations">
        <h2>Recent Conversations</h2>
        
        <div class="conversation-list" *ngIf="(inbox$ | async) as inbox">
          <div 
            *ngFor="let item of inbox.slice(0, 5)" 
            class="conversation-item"
            (click)="openConversation(item)">
            
            <div class="conversation-icon">
              <span class="material-icons">
                {{ item.is_group ? 'group' : 'person' }}
              </span>
            </div>

            <div class="conversation-info">
              <div class="conversation-name">
                {{ item.name || item.other_participant_name || 'Unknown' }}
              </div>
              <div class="conversation-preview">
                {{ item.last_message_preview }}
              </div>
              <div class="conversation-time">
                {{ formatTime(item.last_message_at) }}
              </div>
            </div>

            <div class="conversation-badge" *ngIf="item.unread_count > 0">
              {{ item.unread_count }}
            </div>
          </div>

          <div *ngIf="inbox.length === 0" class="empty-state">
            <span class="material-icons">chat_bubble_outline</span>
            <p>No conversations yet</p>
            <p class="hint">Click the chat button to start messaging!</p>
          </div>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="quick-actions">
        <h2>Quick Actions</h2>
        <div class="action-buttons">
          <button class="action-button" (click)="openMessaging()">
            <span class="material-icons">chat</span>
            Open Messaging
          </button>
          <button class="action-button" (click)="startNewConversation()">
            <span class="material-icons">add_comment</span>
            New Conversation
          </button>
          <button class="action-button" (click)="loadContacts()">
            <span class="material-icons">refresh</span>
            Refresh Contacts
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard {
      max-width: 1200px;
      margin: 0 auto;
      padding: 40px 20px;
    }

    h1 {
      font-size: 32px;
      font-weight: 700;
      color: #1f2937;
      margin: 0 0 30px 0;
    }

    h2 {
      font-size: 20px;
      font-weight: 600;
      color: #374151;
      margin: 0 0 20px 0;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-bottom: 40px;
    }

    .stat-card {
      background: white;
      border-radius: 12px;
      padding: 24px;
      display: flex;
      align-items: center;
      gap: 16px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .stat-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }

    .stat-card .material-icons {
      font-size: 40px;
      color: #667eea;
    }

    .stat-content {
      flex: 1;
    }

    .stat-value {
      font-size: 32px;
      font-weight: 700;
      color: #1f2937;
      line-height: 1;
    }

    .stat-label {
      font-size: 14px;
      color: #6b7280;
      margin-top: 4px;
    }

    .recent-conversations {
      background: white;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      margin-bottom: 40px;
    }

    .conversation-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .conversation-item {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px;
      border-radius: 8px;
      cursor: pointer;
      transition: background 0.2s;
    }

    .conversation-item:hover {
      background: #f9fafb;
    }

    .conversation-icon {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: #eef2ff;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .conversation-icon .material-icons {
      color: #667eea;
      font-size: 24px;
    }

    .conversation-info {
      flex: 1;
      min-width: 0;
    }

    .conversation-name {
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 4px;
    }

    .conversation-preview {
      font-size: 14px;
      color: #6b7280;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .conversation-time {
      font-size: 12px;
      color: #9ca3af;
      margin-top: 4px;
    }

    .conversation-badge {
      background: #ef4444;
      color: white;
      font-size: 12px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 12px;
      min-width: 24px;
      text-align: center;
    }

    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: #9ca3af;
    }

    .empty-state .material-icons {
      font-size: 64px;
      margin-bottom: 16px;
      opacity: 0.5;
    }

    .empty-state p {
      margin: 8px 0;
      font-size: 16px;
    }

    .empty-state .hint {
      font-size: 14px;
      color: #d1d5db;
    }

    .quick-actions {
      background: white;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }

    .action-buttons {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }

    .action-button {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 20px;
      background: #667eea;
      color: white;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }

    .action-button:hover {
      background: #5568d3;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }

    .action-button .material-icons {
      font-size: 20px;
    }
  `]
})
export class DashboardComponent implements OnInit {
  // Observables from messaging store
  unreadCount$ = this.messagingStore.totalUnreadCount$;
  inbox$ = this.messagingStore.inbox$;
  totalConversations$ = this.messagingStore.inbox$.pipe(
    // Transform to get count
  );

  contactCount = 0;

  constructor(
    private messagingStore: MessagingStoreService,
    private messagingApi: MessagingApiService,
    private messagingAuth: AuthService
  ) {}

  ngOnInit() {
    // Load contacts on init
    this.loadContacts();

    // Subscribe to inbox changes
    this.inbox$.subscribe(inbox => {
      console.log('Inbox updated:', inbox.length, 'conversations');
    });
  }

  loadContacts() {
    const contactId = this.messagingAuth.contactId;
    if (!contactId) return;

    this.messagingApi.getVisibleContacts(contactId).subscribe({
      next: (contacts) => {
        this.contactCount = contacts.length;
        console.log('Loaded contacts:', contacts.length);
      },
      error: (error) => {
        console.error('Failed to load contacts:', error);
      }
    });
  }

  openConversation(item: InboxItem) {
    // Open the messaging panel and navigate to this conversation
    this.messagingStore.openConversation(
      item.conversation_id,
      item.name || item.other_participant_name || 'Chat',
      item.is_group || false
    );
  }

  openMessaging() {
    // Toggle the messaging panel
    this.messagingStore.togglePanel();
  }

  startNewConversation() {
    // Open messaging panel in new conversation mode
    this.messagingStore.openPanel();
    // The user can then click "New Message" in the panel
  }

  formatTime(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  }
}
