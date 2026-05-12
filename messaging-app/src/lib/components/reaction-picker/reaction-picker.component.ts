import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'app-reaction-picker',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatTooltipModule],
  template: `
    <div class="reaction-picker" *ngIf="show" [class.align-right]="align === 'right'">
      <button 
        *ngFor="let emoji of emojis" 
        mat-icon-button 
        (click)="selectEmoji(emoji)"
        [matTooltip]="emoji"
        class="emoji-btn"
      >
        {{ emoji }}
      </button>
    </div>
  `,
  styles: [`
    .reaction-picker {
      display: flex;
      gap: 2px;
      align-items: center;
      justify-content: center;
      padding: 5px 6px;
      background: linear-gradient(180deg, #1F4BD8 0%, #173396 100%);
      border: 1px solid rgba(255, 255, 255, 0.24);
      border-radius: 10px;
      box-shadow: 0 6px 14px rgba(0,0,0,0.22);
      position: absolute;
      z-index: 1000;
      bottom: 100%;
      left: 0;
      margin-bottom: 3px;
      white-space: nowrap;
      overflow: visible;
    }

    .reaction-picker.align-right {
      left: auto;
      right: 0;
    }

    .emoji-btn {
      font-size: 16px;
      width: 26px;
      height: 26px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
      border-radius: 7px;
      transition: transform 0.2s;
    }

    .emoji-btn:hover {
      transform: scale(1.12);
      background: rgba(255, 255, 255, 0.18);
    }
  `]
})
export class ReactionPickerComponent {
  @Input() show = false;
  @Input() align: 'left' | 'right' = 'left';
  @Output() emojiSelected = new EventEmitter<string>();

  emojis = ['👍', '❤️', '😂', '😮', '😢', '🎉', '🔥', '👏'];

  selectEmoji(emoji: string) {
    this.emojiSelected.emit(emoji);
  }
}
