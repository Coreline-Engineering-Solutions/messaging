import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  AuthService,
  Contact,
  MessagingOverlayComponent,
  MessagingStoreService,
  SidebarSide,
} from '@ces/messaging';

@Component({
  selector: 'app-messaging-test-page',
  standalone: true,
  imports: [CommonModule, MessagingOverlayComponent],
  template: `
    <div style="padding: 2rem; font-family: sans-serif; max-width: 760px;">
      <h1 style="margin-bottom: 8px;">Messaging API Test Page</h1>
      <p style="margin: 0 0 8px 0; color: #4b5563;">
        Active email: <strong>{{ email }}</strong>
      </p>
      <p style="margin: 0 0 16px 0; color: #4b5563;">
        Bubble side: <strong>{{ side }}</strong>
      </p>
      <p *ngIf="error" style="color: #dc2626;">{{ error }}</p>
    </div>

    <app-messaging-overlay></app-messaging-overlay>
  `,
})
export class MessagingTestPageComponent implements OnInit {
  email = '';
  side: SidebarSide = 'right';
  error = '';
  expectedContactId = '';

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private auth: AuthService,
    private store: MessagingStoreService
  ) {}

  ngOnInit(): void {
    this.email = (this.route.snapshot.data['email'] as string) || '';
    this.side = ((this.route.snapshot.data['side'] as SidebarSide) || 'right');
    this.expectedContactId = (this.route.snapshot.data['expectedContactId'] as string) || '';

    if (this.store.getSidebarSide() !== this.side) {
      this.store.toggleSidebarSide();
    }

    this.loginAndInitialize();
  }

  private loginAndInitialize(): void {
    if (!this.email) {
      this.error = 'No email configured for this route.';
      return;
    }

    this.http
      .get<any>(
        `https://ces-ticketing-system-db.onrender.com/api/messaging/contacts/by-email/${encodeURIComponent(this.email)}`
      )
      .subscribe({
        next: (data) => {
          if (!data?.contact_id) {
            this.error = `Contact not found for ${this.email}`;
            return;
          }
          if (this.expectedContactId && String(data.contact_id) !== this.expectedContactId) {
            this.error = `Wrong contact from API for ${this.email}. Expected ${this.expectedContactId}, got ${data.contact_id}.`;
            return;
          }

          const contact: Contact = {
            contact_id: String(data.contact_id),
            user_gid: String(data.contact_id),
            email: data.email,
            username: data.username,
            company_name: data.company,
            is_active: true,
          };

          this.auth.setSession(`session-${data.contact_id}-${Date.now()}`, contact);
          this.store.initialize();
          this.store.openPanel();
          this.store.setView('inbox');
        },
        error: (err) => {
          this.error = `Failed to fetch contact for ${this.email}`;
        },
      });
  }
}
