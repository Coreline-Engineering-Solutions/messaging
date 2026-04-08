import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-nav-bar',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule, MatButtonModule],
  template: `
    <nav class="navbar">
      <div class="nav-brand">
        <mat-icon class="brand-icon">hub</mat-icon>
        <span class="brand-text">CES Platform</span>
      </div>
      <div class="nav-links">
        <a routerLink="/dashboard" routerLinkActive="active" class="nav-link">
          <mat-icon>dashboard</mat-icon>
          <span>Dashboard</span>
        </a>
        <a routerLink="/fibre-planner" routerLinkActive="active" class="nav-link">
          <mat-icon>cable</mat-icon>
          <span>Fibre Planner</span>
        </a>
        <a routerLink="/task-manager" routerLinkActive="active" class="nav-link">
          <mat-icon>task_alt</mat-icon>
          <span>Task Manager</span>
        </a>
        <a routerLink="/analytics" routerLinkActive="active" class="nav-link">
          <mat-icon>analytics</mat-icon>
          <span>Analytics</span>
        </a>
      </div>
      <div class="nav-user">
        <div class="user-avatar">
          <mat-icon>person</mat-icon>
        </div>
      </div>
    </nav>
  `,
  styles: [`
    .navbar {
      display: flex;
      align-items: center;
      height: 56px;
      padding: 0 20px;
      background: #fff;
      border-bottom: 1px solid #e5e7eb;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
      position: sticky;
      top: 0;
      z-index: 100;
    }

    .nav-brand {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-right: 32px;
    }

    .brand-icon {
      color: #667eea;
      font-size: 28px;
      width: 28px;
      height: 28px;
    }

    .brand-text {
      font-weight: 700;
      font-size: 18px;
      color: #1f2937;
      letter-spacing: -0.02em;
    }

    .nav-links {
      display: flex;
      gap: 4px;
      flex: 1;
    }

    .nav-link {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      border-radius: 8px;
      text-decoration: none;
      color: #6b7280;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.15s;
    }

    .nav-link:hover {
      background: #f3f4f6;
      color: #374151;
    }

    .nav-link.active {
      background: #f0f4ff;
      color: #667eea;
    }

    .nav-link mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .nav-user {
      margin-left: auto;
    }

    .user-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: #f3f4f6;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .user-avatar mat-icon {
      color: #9ca3af;
      font-size: 20px;
    }

    @media (max-width: 768px) {
      .nav-link span {
        display: none;
      }
    }
  `],
})
export class NavBarComponent {}
