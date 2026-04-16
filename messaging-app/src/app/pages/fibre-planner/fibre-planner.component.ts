import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-fibre-planner',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="tool-page">
      <div class="tool-header">
        <div class="tool-icon fibre">
          <mat-icon>cable</mat-icon>
        </div>
        <div>
          <h1>Fibre Planner</h1>
          <p>Plan and manage fibre optic network deployments</p>
        </div>
      </div>

      <div class="content-grid">
        <div class="card">
          <h3>Active Projects</h3>
          <div class="stat">12</div>
          <p>Ongoing fibre deployments</p>
        </div>
        <div class="card">
          <h3>Pending Surveys</h3>
          <div class="stat">5</div>
          <p>Site surveys to complete</p>
        </div>
        <div class="card">
          <h3>Completed</h3>
          <div class="stat">47</div>
          <p>This quarter</p>
        </div>
      </div>

      <div class="placeholder-content">
        <mat-icon>map</mat-icon>
        <p>Network map and planning tools would appear here.</p>
        <p class="hint">Try using the messaging button in the bottom-right corner while on this page!</p>
      </div>
    </div>
  `,
  styles: [`
    .tool-page { max-width: 900px; margin: 0 auto; padding: 32px 24px; }
    .tool-header { display: flex; align-items: center; gap: 16px; margin-bottom: 32px; }
    .tool-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
    .tool-icon.fibre { background: #e0e7ff; }
    .tool-icon mat-icon { color: #667eea; font-size: 24px; width: 24px; height: 24px; }
    h1 { font-size: 24px; font-weight: 700; color: #1f2937; margin: 0; }
    .tool-header p { color: #6b7280; margin: 4px 0 0; font-size: 14px; }
    .content-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 32px; }
    .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; }
    .card h3 { font-size: 13px; font-weight: 600; color: #6b7280; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.05em; }
    .stat { font-size: 36px; font-weight: 700; color: #1f2937; }
    .card p { font-size: 13px; color: #9ca3af; margin: 4px 0 0; }
    .placeholder-content { display: flex; flex-direction: column; align-items: center; padding: 64px 24px; background: #f9fafb; border-radius: 16px; border: 2px dashed #e5e7eb; color: #9ca3af; text-align: center; }
    .placeholder-content mat-icon { font-size: 64px; width: 64px; height: 64px; margin-bottom: 16px; }
    .placeholder-content p { margin: 0 0 8px; font-size: 15px; }
    .hint { color: #667eea; font-weight: 500; }

    @media (max-width: 640px) {
      .content-grid { grid-template-columns: 1fr; }
    }
  `],
})
export class FibrePlannerComponent {}
