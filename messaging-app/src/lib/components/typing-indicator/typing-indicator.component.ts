import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-typing-indicator',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="typing-indicator" *ngIf="isTyping">
      <span class="typing-text">{{ typingText }}</span>
      <span class="dots">
        <span class="dot"></span>
        <span class="dot"></span>
        <span class="dot"></span>
      </span>
    </div>
  `,
  styles: [`
    .typing-indicator {
      display: flex;
      align-items: center;
      padding: 8px 16px;
      font-size: 13px;
      color: #666;
      gap: 8px;
    }

    .typing-text {
      font-style: italic;
    }

    .dots {
      display: flex;
      gap: 4px;
    }

    .dot {
      width: 4px;
      height: 4px;
      background-color: #666;
      border-radius: 50%;
      animation: typing 1.4s infinite;
    }

    .dot:nth-child(2) {
      animation-delay: 0.2s;
    }

    .dot:nth-child(3) {
      animation-delay: 0.4s;
    }

    @keyframes typing {
      0%, 60%, 100% {
        opacity: 0.3;
        transform: translateY(0);
      }
      30% {
        opacity: 1;
        transform: translateY(-4px);
      }
    }
  `]
})
export class TypingIndicatorComponent {
  @Input() typingUsers: string[] = [];

  get isTyping(): boolean {
    return this.typingUsers.length > 0;
  }

  get typingText(): string {
    if (this.typingUsers.length === 0) return '';
    if (this.typingUsers.length === 1) return `${this.typingUsers[0]} is typing`;
    if (this.typingUsers.length === 2) return `${this.typingUsers[0]} and ${this.typingUsers[1]} are typing`;
    return `${this.typingUsers.length} people are typing`;
  }
}
