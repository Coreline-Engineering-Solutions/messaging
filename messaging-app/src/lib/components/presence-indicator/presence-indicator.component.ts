import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'app-presence-indicator',
  standalone: true,
  imports: [CommonModule, MatTooltipModule],
  template: `
    <div 
      class="presence-indicator" 
      [class.online]="status === 'online'"
      [class.away]="status === 'away'"
      [class.busy]="status === 'busy'"
      [class.offline]="status === 'offline'"
      [matTooltip]="getTooltip()"
    ></div>
  `,
  styles: [`
    .presence-indicator {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      border: 2px solid white;
      position: absolute;
      bottom: 0;
      right: 0;
    }

    .presence-indicator.online {
      background-color: #4caf50;
    }

    .presence-indicator.away {
      background-color: #ff9800;
    }

    .presence-indicator.busy {
      background-color: #f44336;
    }

    .presence-indicator.offline {
      background-color: #9e9e9e;
    }
  `]
})
export class PresenceIndicatorComponent {
  @Input() status: 'online' | 'offline' | 'away' | 'busy' = 'offline';
  @Input() lastSeen?: string;
  @Input() customStatus?: string;

  getTooltip(): string {
    if (this.customStatus) return this.customStatus;
    
    switch (this.status) {
      case 'online': return 'Online';
      case 'away': return 'Away';
      case 'busy': return 'Busy';
      case 'offline': 
        if (this.lastSeen) {
          return `Last seen ${this.formatLastSeen(this.lastSeen)}`;
        }
        return 'Offline';
      default: return '';
    }
  }

  formatLastSeen(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  }
}
