import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  MessagingOverlayComponent,
  AuthService,
  Contact
} from '@coreline-engineering-solutions/messaging';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, FormsModule, MessagingOverlayComponent],
  template: `
    <div style="padding: 2rem; font-family: sans-serif;">
      <h1>Messaging Library Demo</h1>

      <div *ngIf="!isLoggedIn" style="max-width: 400px;">
        <h3>Simulate Login</h3>
        <div style="margin-bottom: 1rem;">
          <label>Session GID:</label><br>
          <input [(ngModel)]="sessionGid" style="width: 100%; padding: 8px; margin-top: 4px;" placeholder="Enter session GID">
        </div>
        <div style="margin-bottom: 1rem;">
          <label>Contact ID:</label><br>
          <input [(ngModel)]="contactId" style="width: 100%; padding: 8px; margin-top: 4px;" placeholder="Enter contact ID">
        </div>
        <div style="margin-bottom: 1rem;">
          <label>Email:</label><br>
          <input [(ngModel)]="email" style="width: 100%; padding: 8px; margin-top: 4px;" placeholder="Enter email">
        </div>
        <button (click)="login()" style="padding: 10px 20px; background: #1976d2; color: white; border: none; cursor: pointer; border-radius: 4px;">
          Start Messaging Session
        </button>
      </div>

      <div *ngIf="isLoggedIn">
        <p>Session active for: <strong>{{ email }}</strong></p>
        <button (click)="logout()" style="padding: 8px 16px; background: #f44336; color: white; border: none; cursor: pointer; border-radius: 4px;">
          Logout
        </button>
      </div>
    </div>

    <router-outlet></router-outlet>
    <app-messaging-overlay></app-messaging-overlay>
  `,
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'demo-app';
  sessionGid = 'test-session-123';
  contactId = 'test-contact-456';
  email = 'demo@example.com';

  get isLoggedIn(): boolean {
    return this.authService.isAuthenticated();
  }

  constructor(private authService: AuthService) {}

  login(): void {
    const contact: Contact = {
      contact_id: this.contactId,
      user_gid: this.sessionGid,
      email: this.email,
      company_name: 'Demo Company',
      is_active: true
    };
    this.authService.setSession(this.sessionGid, contact);
  }

  logout(): void {
    this.authService.logout();
  }
}
