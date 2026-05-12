import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterOutlet],
  template: `
    <div style="padding: 1rem 2rem; font-family: sans-serif; border-bottom: 1px solid #e5e7eb;">
      <h2 style="margin: 0 0 10px 0;">Messaging Test Routes</h2>
      <div style="display: flex; gap: 10px;">
        <a
          routerLink="/alice"
          style="padding: 8px 12px; border-radius: 6px; background: #1d4ed8; color: white; text-decoration: none;"
        >
          Open Alice Page
        </a>
        <a
          routerLink="/daniel"
          style="padding: 8px 12px; border-radius: 6px; background: #7c3aed; color: white; text-decoration: none;"
        >
          Open Daniel Page
        </a>
      </div>
    </div>
    <router-outlet></router-outlet>
  `,
  styleUrl: './app.component.scss'
})
export class AppComponent {}
