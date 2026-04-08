import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '../../messaging/services/auth.service';
import { Contact } from '../../messaging/models/messaging.models';
import { environment } from '../../../environments/environment';

interface DemoUser {
  label: string;
  sessionGid: string;
  contact: Contact;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule],
  template: `
    <div class="login-page">
      <div class="login-card">
        <div class="login-header">
          <mat-icon class="logo">hub</mat-icon>
          <h1>CES Platform</h1>
          <p>Centralised Execution System</p>
        </div>

        <div class="login-section">
          <h2>Demo Login</h2>
          <p class="section-desc">Select a demo user to test the messaging system, or enter real credentials below.</p>

          <div class="demo-users">
            <button
              *ngFor="let user of demoUsers"
              class="demo-user-btn"
              (click)="loginAsDemo(user)"
            >
              <div class="demo-avatar">
                <mat-icon>person</mat-icon>
              </div>
              <div class="demo-info">
                <span class="demo-name">{{ user.label }}</span>
                <span class="demo-company">{{ user.contact.company_name }}</span>
              </div>
            </button>
          </div>
        </div>

        <div class="divider">
          <span>or use real credentials</span>
        </div>

        <div class="login-form">
          <div class="field-group">
            <label>API Host</label>
            <input type="text" [(ngModel)]="apiHost" placeholder="https://your-api-host" />
          </div>
          <div class="field-group">
            <label>Email</label>
            <input type="email" [(ngModel)]="email" placeholder="user@example.com" />
          </div>
          <div class="field-group">
            <label>Password</label>
            <input type="password" [(ngModel)]="password" placeholder="Password" />
          </div>
          <button mat-raised-button color="primary" class="login-btn" (click)="loginReal()" [disabled]="loggingIn">
            {{ loggingIn ? 'Signing in...' : 'Sign In' }}
          </button>
          <p *ngIf="errorMsg" class="error-msg">{{ errorMsg }}</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .login-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 24px;
    }

    .login-card {
      background: #fff;
      border-radius: 20px;
      padding: 40px;
      width: 100%;
      max-width: 440px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
    }

    .login-header {
      text-align: center;
      margin-bottom: 32px;
    }

    .logo {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: #667eea;
    }

    .login-header h1 {
      margin: 12px 0 4px;
      font-size: 24px;
      font-weight: 700;
      color: #1f2937;
    }

    .login-header p {
      margin: 0;
      color: #6b7280;
      font-size: 14px;
    }

    .login-section h2 {
      font-size: 16px;
      font-weight: 600;
      color: #1f2937;
      margin: 0 0 4px;
    }

    .section-desc {
      font-size: 13px;
      color: #6b7280;
      margin: 0 0 16px;
    }

    .demo-users {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .demo-user-btn {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.15s;
      width: 100%;
      text-align: left;
    }

    .demo-user-btn:hover {
      background: #f0f4ff;
      border-color: #667eea;
    }

    .demo-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .demo-avatar mat-icon {
      color: #667eea;
    }

    .demo-info {
      display: flex;
      flex-direction: column;
    }

    .demo-name {
      font-weight: 600;
      font-size: 14px;
      color: #1f2937;
    }

    .demo-company {
      font-size: 12px;
      color: #9ca3af;
    }

    .divider {
      display: flex;
      align-items: center;
      margin: 24px 0;
      gap: 12px;
    }

    .divider::before,
    .divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: #e5e7eb;
    }

    .divider span {
      font-size: 12px;
      color: #9ca3af;
      white-space: nowrap;
    }

    .login-form {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .field-group {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .field-group label {
      font-size: 12px;
      font-weight: 600;
      color: #6b7280;
    }

    .field-group input {
      padding: 10px 12px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      font-size: 14px;
      color: #1f2937;
      outline: none;
      transition: border-color 0.2s;
    }

    .field-group input:focus {
      border-color: #667eea;
    }

    .login-btn {
      margin-top: 4px;
      padding: 12px;
      border-radius: 10px;
      font-weight: 600;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }

    .error-msg {
      color: #ef4444;
      font-size: 13px;
      text-align: center;
      margin: 0;
    }
  `],
})
export class LoginComponent {
  email = '';
  password = '';
  apiHost = '';
  loggingIn = false;
  errorMsg = '';

  demoUsers: DemoUser[] = [
    {
      label: 'Alice Johnson',
      sessionGid: 'demo-session-001',
      contact: {
        contact_id: '1',
        user_gid: 'user-001',
        first_name: 'Alice',
        last_name: 'Johnson',
        email: 'alice@coreline.com',
        company_name: 'Coreline Fibre',
        is_active: true,
      },
    },
    {
      label: 'Bob Smith',
      sessionGid: 'demo-session-002',
      contact: {
        contact_id: '2',
        user_gid: 'user-002',
        first_name: 'Bob',
        last_name: 'Smith',
        email: 'bob@coreline.com',
        company_name: 'Coreline Fibre',
        is_active: true,
      },
    },
    {
      label: 'Carol Williams',
      sessionGid: 'demo-session-003',
      contact: {
        contact_id: '3',
        user_gid: 'user-003',
        first_name: 'Carol',
        last_name: 'Williams',
        email: 'carol@partner.com',
        company_name: 'Partner Corp',
        is_active: true,
      },
    },
  ];

  constructor(private auth: AuthService, private router: Router) {}

  loginAsDemo(user: DemoUser): void {
    this.auth.setDemoSession(user.sessionGid, user.contact);
    this.router.navigate(['/dashboard']);
  }

  loginReal(): void {
    if (!this.email || !this.password) {
      this.errorMsg = 'Please enter email and password.';
      return;
    }

    this.loggingIn = true;
    this.errorMsg = '';

    if (this.apiHost) {
      (environment as any).apiBaseUrl = this.apiHost;
      (environment as any).wsBaseUrl = this.apiHost.replace('https://', 'wss://').replace('http://', 'ws://');
    }

    this.auth.login(this.email, this.password).subscribe({
      next: () => {
        this.loggingIn = false;
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loggingIn = false;
        this.errorMsg = err?.error?.message || 'Login failed. Check your credentials.';
      },
    });
  }
}
