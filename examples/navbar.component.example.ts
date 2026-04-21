import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService, MessagingStoreService } from '@coreline-engineering-solutions/messaging';

/**
 * NAVBAR COMPONENT EXAMPLE
 * 
 * Shows how to:
 * 1. Display user info from messaging auth
 * 2. Show unread message count
 * 3. Handle logout properly
 */
@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <nav class="navbar">
      <div class="navbar-content">
        <!-- Logo/Brand -->
        <div class="navbar-brand">
          <a routerLink="/dashboard">Your App</a>
        </div>

        <!-- Navigation Links -->
        <div class="navbar-links">
          <a routerLink="/dashboard" routerLinkActive="active">Dashboard</a>
          <a routerLink="/projects" routerLinkActive="active">Projects</a>
          <a routerLink="/team" routerLinkActive="active">Team</a>
        </div>

        <!-- User Section -->
        <div class="navbar-user" *ngIf="messagingAuth.isAuthenticated()">
          <!-- Unread Messages Badge -->
          <div class="unread-badge" *ngIf="(unreadCount$ | async) as unreadCount">
            <span class="material-icons">chat_bubble</span>
            <span class="badge" *ngIf="unreadCount > 0">{{ unreadCount }}</span>
          </div>

          <!-- User Info -->
          <div class="user-info">
            <span class="user-name">{{ getUserName() }}</span>
            <span class="user-email">{{ getUserEmail() }}</span>
          </div>

          <!-- Logout Button -->
          <button class="logout-button" (click)="onLogout()">
            <span class="material-icons">logout</span>
            Logout
          </button>
        </div>
      </div>
    </nav>
  `,
  styles: [`
    .navbar {
      background: white;
      border-bottom: 1px solid #e5e7eb;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      position: sticky;
      top: 0;
      z-index: 100;
    }

    .navbar-content {
      max-width: 1400px;
      margin: 0 auto;
      padding: 0 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 64px;
    }

    .navbar-brand a {
      font-size: 20px;
      font-weight: 700;
      color: #667eea;
      text-decoration: none;
    }

    .navbar-links {
      display: flex;
      gap: 30px;
      flex: 1;
      justify-content: center;
    }

    .navbar-links a {
      color: #6b7280;
      text-decoration: none;
      font-weight: 500;
      padding: 8px 16px;
      border-radius: 6px;
      transition: all 0.2s;
    }

    .navbar-links a:hover {
      color: #667eea;
      background: #f3f4f6;
    }

    .navbar-links a.active {
      color: #667eea;
      background: #eef2ff;
    }

    .navbar-user {
      display: flex;
      align-items: center;
      gap: 20px;
    }

    .unread-badge {
      position: relative;
      display: flex;
      align-items: center;
      cursor: pointer;
      padding: 8px;
      border-radius: 50%;
      transition: background 0.2s;
    }

    .unread-badge:hover {
      background: #f3f4f6;
    }

    .unread-badge .material-icons {
      color: #6b7280;
      font-size: 24px;
    }

    .unread-badge .badge {
      position: absolute;
      top: 2px;
      right: 2px;
      background: #ef4444;
      color: white;
      font-size: 11px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 10px;
      min-width: 18px;
      text-align: center;
    }

    .user-info {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
    }

    .user-name {
      font-weight: 600;
      color: #1f2937;
      font-size: 14px;
    }

    .user-email {
      font-size: 12px;
      color: #9ca3af;
    }

    .logout-button {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      background: transparent;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      color: #6b7280;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }

    .logout-button:hover {
      background: #fee2e2;
      border-color: #fecaca;
      color: #dc2626;
    }

    .logout-button .material-icons {
      font-size: 18px;
    }

    @media (max-width: 768px) {
      .navbar-links {
        display: none;
      }

      .user-info {
        display: none;
      }
    }
  `]
})
export class NavbarComponent {
  // Observable for unread message count
  unreadCount$ = this.messagingStore.totalUnreadCount$;

  constructor(
    private router: Router,
    public messagingAuth: AuthService,
    private messagingStore: MessagingStoreService
  ) {}

  getUserName(): string {
    const contact = this.messagingAuth.currentContact;
    if (!contact) return 'User';
    
    if (contact.username) return contact.username;
    if (contact.first_name) {
      return contact.last_name 
        ? `${contact.first_name} ${contact.last_name}`
        : contact.first_name;
    }
    return contact.email.split('@')[0];
  }

  getUserEmail(): string {
    return this.messagingAuth.currentContact?.email || '';
  }

  onLogout() {
    // Confirm logout
    if (!confirm('Are you sure you want to logout?')) {
      return;
    }

    // ============================================
    // STEP 1: Clear messaging session
    // ============================================
    // This will:
    // - Close WebSocket connection
    // - Clear messaging state
    // - Remove session from localStorage
    this.messagingAuth.logout();

    console.log('✅ Messaging session cleared');

    // ============================================
    // STEP 2: Clear your app's auth
    // ============================================
    // Add your own logout logic here
    // this.yourAuthService.logout();
    localStorage.removeItem('auth_token');
    sessionStorage.clear();

    // ============================================
    // STEP 3: Navigate to login
    // ============================================
    this.router.navigate(['/login']);
  }
}
