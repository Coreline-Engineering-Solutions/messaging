import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FloatingButtonComponent } from './components/floating-button/floating-button.component';
import { ChatPanelComponent } from './components/chat-panel/chat-panel.component';
import { MessagingStoreService } from './services/messaging-store.service';
import { AuthService } from './services/auth.service';
import { Contact } from './models/messaging.models';

@Component({
  selector: 'app-messaging-overlay',
  standalone: true,
  imports: [CommonModule, FloatingButtonComponent, ChatPanelComponent],
  template: `
    <ng-container *ngIf="isAuthenticated">
      <app-floating-button></app-floating-button>
      <app-chat-panel></app-chat-panel>
    </ng-container>
  `,
})
export class MessagingOverlayComponent implements OnInit {
  isAuthenticated = false;

  constructor(
    private store: MessagingStoreService,
    private auth: AuthService
  ) {}

  ngOnInit(): void {
    // Auto-init messaging session from localStorage
    this.initializeMessagingAuth();
    
    this.auth.session$.subscribe((session) => {
      this.isAuthenticated = this.auth.isAuthenticated();
      if (this.isAuthenticated) {
        this.store.initialize();
      }
    });
  }

  private initializeMessagingAuth(): void {
    // Check if messaging already authenticated
    if (this.auth.isAuthenticated()) return;

    // Get session from localStorage (host app session)
    const sessionData = localStorage.getItem('session');
    if (!sessionData) {
      console.warn('Messaging: No session in localStorage');
      return;
    }

    try {
      const parsed = JSON.parse(sessionData);
      const sessionId = parsed.session_id || parsed.sessionId;
      const email = parsed.email || parsed.user_email;
      const userName = parsed.user_name || parsed.name;

      if (!sessionId || !email) {
        console.warn('Messaging: Invalid session data');
        return;
      }

      // Create contact from session data
      const tempContactId = email.split('@')[0];
      
      const contact: Contact = {
        contact_id: tempContactId,
        user_gid: sessionId,
        username: userName || tempContactId,
        first_name: userName?.split(' ')[0],
        last_name: userName?.split(' ').slice(1).join(' '),
        email: email,
        company_name: 'CES',
        is_active: true
      };

      // Set messaging session
      this.auth.setSession(sessionId, contact);
    } catch (err) {
      console.error('Messaging: Failed to parse session:', err);
    }
  }
}
