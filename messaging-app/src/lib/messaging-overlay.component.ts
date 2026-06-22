import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FloatingButtonComponent } from './components/floating-button/floating-button.component';
import { ChatPanelComponent } from './components/chat-panel/chat-panel.component';
import { MessagingStoreService } from './services/messaging-store.service';
import { AuthService } from './services/auth.service';
import { TicketNotificationService } from './services/ticket-notification.service';
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
  styles: [`
    :host {
      position: relative;
      z-index: 1000;
    }

    .cdk-overlay-container {
      z-index: 10000 !important;
    }
    
    .mat-mdc-tooltip {
      z-index: 10001 !important;
    }
  `],
  encapsulation: ViewEncapsulation.None,
})
export class MessagingOverlayComponent implements OnInit {
  isAuthenticated = false;

  constructor(
    private store: MessagingStoreService,
    private auth: AuthService,
    private ticketNotifications: TicketNotificationService
  ) {}

  ngOnInit(): void {
    this.initializeMessagingAuth();

    if (this.auth.isAuthenticated()) {
      this.isAuthenticated = true;
      this.store.initialize();
      this.ticketNotifications.startListening();
    }

    this.auth.session$.subscribe(() => {
      this.isAuthenticated = this.auth.isAuthenticated();
      if (this.isAuthenticated) {
        this.store.initialize();
        this.ticketNotifications.startListening();
      } else {
        this.ticketNotifications.stopListening();
      }
    });
  }

  private initializeMessagingAuth(): void {
    // Check if messaging already authenticated
    if (this.auth.isAuthenticated()) return;

    // Get session from localStorage (host app session)
    const sessionData = localStorage.getItem('session');
    if (!sessionData) {
      return;
    }

    try {
      const parsed = JSON.parse(sessionData);
      const sessionId = parsed.session_id || parsed.sessionId;
      const email = parsed.email || parsed.user_email;
      const userName = parsed.user_name || parsed.name;

      if (!sessionId || !email) {
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
    } catch {
    }
  }
}
