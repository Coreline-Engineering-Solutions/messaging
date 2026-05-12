import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { Message } from '../../models/messaging.models';

@Component({
  selector: 'app-message-actions',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatMenuModule],
  template: `
    <div class="message-actions">
      <button mat-icon-button [matMenuTriggerFor]="menu" class="more-btn">
        <mat-icon>more_vert</mat-icon>
      </button>
      
      <mat-menu #menu="matMenu">
        <button mat-menu-item (click)="onReply()">
          <mat-icon>reply</mat-icon>
          <span>Reply in thread</span>
        </button>
        
        <button mat-menu-item (click)="onReact()">
          <mat-icon>add_reaction</mat-icon>
          <span>Add reaction</span>
        </button>
        
        <button mat-menu-item *ngIf="canEdit" (click)="onEdit()">
          <mat-icon>edit</mat-icon>
          <span>Edit message</span>
        </button>
        
        <button mat-menu-item (click)="onPin()">
          <mat-icon>{{ message.is_pinned ? 'push_pin' : 'push_pin' }}</mat-icon>
          <span>{{ message.is_pinned ? 'Unpin' : 'Pin' }} message</span>
        </button>
        
        <button mat-menu-item (click)="onCopy()">
          <mat-icon>content_copy</mat-icon>
          <span>Copy text</span>
        </button>
        
        <button mat-menu-item *ngIf="canDelete" (click)="onDelete()" class="delete-action">
          <mat-icon>delete</mat-icon>
          <span>Delete message</span>
        </button>
      </mat-menu>
    </div>
  `,
  styles: [`
    .message-actions {
      opacity: 0;
      transition: opacity 0.2s;
    }

    :host:hover .message-actions,
    .message-actions:focus-within {
      opacity: 1;
    }

    .more-btn {
      width: 28px;
      height: 28px;
      line-height: 28px;
    }

    .more-btn mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .delete-action {
      color: #d32f2f;
    }
  `]
})
export class MessageActionsComponent {
  @Input() message!: Message;
  @Input() currentUserId!: string;
  @Input() canPin = false;
  
  @Output() reply = new EventEmitter<Message>();
  @Output() react = new EventEmitter<Message>();
  @Output() edit = new EventEmitter<Message>();
  @Output() delete = new EventEmitter<Message>();
  @Output() pin = new EventEmitter<Message>();
  @Output() copy = new EventEmitter<Message>();

  get canEdit(): boolean {
    return this.message.sender_id === this.currentUserId;
  }

  get canDelete(): boolean {
    return this.message.sender_id === this.currentUserId || this.canPin;
  }

  onReply() {
    this.reply.emit(this.message);
  }

  onReact() {
    this.react.emit(this.message);
  }

  onEdit() {
    this.edit.emit(this.message);
  }

  onDelete() {
    if (confirm('Delete this message?')) {
      this.delete.emit(this.message);
    }
  }

  onPin() {
    this.pin.emit(this.message);
  }

  onCopy() {
    if (this.message.content) {
      navigator.clipboard.writeText(this.message.content);
    }
    this.copy.emit(this.message);
  }
}
