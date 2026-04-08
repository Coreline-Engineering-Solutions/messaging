import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule, MatButtonModule],
  template: `
    <div class="dashboard">
      <h1>Dashboard</h1>
      <p class="subtitle">Welcome to the CES Platform. Select a tool to get started.</p>

      <div class="tools-grid">
        <a routerLink="/fibre-planner" class="tool-card">
          <div class="tool-icon fibre">
            <mat-icon>cable</mat-icon>
          </div>
          <h3>Fibre Planner</h3>
          <p>Plan and manage fibre optic network deployments</p>
        </a>

        <a routerLink="/task-manager" class="tool-card">
          <div class="tool-icon tasks">
            <mat-icon>task_alt</mat-icon>
          </div>
          <h3>Task Manager</h3>
          <p>Track and assign tasks across teams</p>
        </a>

        <a routerLink="/analytics" class="tool-card">
          <div class="tool-icon analytics">
            <mat-icon>analytics</mat-icon>
          </div>
          <h3>Analytics</h3>
          <p>View performance metrics and reports</p>
        </a>
      </div>

      <div class="info-banner">
        <mat-icon>info</mat-icon>
        <span>The messaging system floats above all tools. Try navigating between pages — messaging stays active!</span>
      </div>
    </div>
  `,
  styles: [`
    .dashboard {
      max-width: 900px;
      margin: 0 auto;
      padding: 40px 24px;
    }

    h1 {
      font-size: 28px;
      font-weight: 700;
      color: #1f2937;
      margin: 0 0 8px;
    }

    .subtitle {
      color: #6b7280;
      font-size: 16px;
      margin: 0 0 32px;
    }

    .tools-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-bottom: 32px;
    }

    .tool-card {
      display: flex;
      flex-direction: column;
      padding: 24px;
      background: #fff;
      border-radius: 16px;
      border: 1px solid #e5e7eb;
      text-decoration: none;
      transition: all 0.2s;
      cursor: pointer;
    }

    .tool-card:hover {
      border-color: #667eea;
      box-shadow: 0 4px 16px rgba(102, 126, 234, 0.12);
      transform: translateY(-2px);
    }

    .tool-icon {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 16px;
    }

    .tool-icon.fibre {
      background: #e0e7ff;
    }
    .tool-icon.fibre mat-icon { color: #667eea; }

    .tool-icon.tasks {
      background: #d1fae5;
    }
    .tool-icon.tasks mat-icon { color: #10b981; }

    .tool-icon.analytics {
      background: #fef3c7;
    }
    .tool-icon.analytics mat-icon { color: #f59e0b; }

    .tool-icon mat-icon {
      font-size: 24px;
      width: 24px;
      height: 24px;
    }

    .tool-card h3 {
      font-size: 16px;
      font-weight: 600;
      color: #1f2937;
      margin: 0 0 6px;
    }

    .tool-card p {
      font-size: 14px;
      color: #6b7280;
      margin: 0;
      line-height: 1.4;
    }

    .info-banner {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 20px;
      background: #f0f4ff;
      border-radius: 12px;
      color: #4338ca;
      font-size: 14px;
    }

    .info-banner mat-icon {
      flex-shrink: 0;
    }
  `],
})
export class DashboardComponent {}
