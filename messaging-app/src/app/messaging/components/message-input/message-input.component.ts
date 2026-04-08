import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-message-input',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule],
  template: `
    <div class="message-input-container">
      <div class="input-wrapper">
        <textarea
          [(ngModel)]="messageText"
          (keydown.enter)="onEnter($event)"
          placeholder="Type a message..."
          rows="1"
          class="message-textarea"
          #textarea
        ></textarea>
        <button
          mat-icon-button
          class="send-btn"
          [disabled]="!messageText.trim()"
          (click)="send()"
        >
          <mat-icon>send</mat-icon>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .message-input-container {
      padding: 12px 16px;
      border-top: 1px solid #e5e7eb;
      background: #fff;
    }

    .input-wrapper {
      display: flex;
      align-items: flex-end;
      gap: 8px;
      background: #f3f4f6;
      border-radius: 24px;
      padding: 4px 4px 4px 16px;
    }

    .message-textarea {
      flex: 1;
      border: none;
      outline: none;
      background: transparent;
      resize: none;
      font-size: 14px;
      font-family: inherit;
      line-height: 1.5;
      max-height: 100px;
      padding: 8px 0;
      color: #1f2937;
    }

    .message-textarea::placeholder {
      color: #9ca3af;
    }

    .send-btn {
      width: 36px;
      height: 36px;
      flex-shrink: 0;
    }

    .send-btn mat-icon {
      color: #667eea;
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .send-btn:disabled mat-icon {
      color: #d1d5db;
    }
  `],
})
export class MessageInputComponent {
  @Output() messageSent = new EventEmitter<string>();

  messageText = '';

  send(): void {
    const text = this.messageText.trim();
    if (!text) return;
    this.messageSent.emit(text);
    this.messageText = '';
  }

  onEnter(event: Event): void {
    const ke = event as KeyboardEvent;
    if (!ke.shiftKey) {
      ke.preventDefault();
      this.send();
    }
  }
}
