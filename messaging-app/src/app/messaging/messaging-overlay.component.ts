import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FloatingButtonComponent } from './components/floating-button/floating-button.component';
import { ChatPanelComponent } from './components/chat-panel/chat-panel.component';
import { MessagingStoreService } from './services/messaging-store.service';
import { AuthService } from './services/auth.service';

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
    this.auth.session$.subscribe((session) => {
      this.isAuthenticated = this.auth.isAuthenticated();
      if (this.isAuthenticated) {
        this.store.initialize();
      }
    });
  }
}
