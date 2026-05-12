import { Component, Input, Output, EventEmitter, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Contact } from '../../models/messaging.models';

@Component({
  selector: 'app-mention-input',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="mention-input-container">
      <textarea
        #textInput
        [(ngModel)]="text"
        (ngModelChange)="onTextChange()"
        (keydown)="onKeyDown($event)"
        [placeholder]="placeholder"
        rows="1"
      ></textarea>

      <div class="mention-suggestions" *ngIf="showSuggestions">
        <div 
          *ngFor="let contact of filteredContacts; let i = index"
          class="suggestion-item"
          [class.selected]="i === selectedIndex"
          (click)="selectContact(contact)"
          (mouseenter)="selectedIndex = i"
        >
          <strong>{{ contact.username || contact.first_name || contact.email }}</strong>
          <span class="email">{{ contact.email }}</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .mention-input-container {
      position: relative;
      width: 100%;
    }

    textarea {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      resize: vertical;
      font-family: inherit;
      font-size: 14px;
      outline: none;
    }

    textarea:focus {
      border-color: #1976d2;
    }

    .mention-suggestions {
      position: absolute;
      bottom: 100%;
      left: 0;
      right: 0;
      background: white;
      border: 1px solid #ddd;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      max-height: 200px;
      overflow-y: auto;
      margin-bottom: 4px;
      z-index: 1000;
    }

    .suggestion-item {
      padding: 8px 12px;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .suggestion-item:hover,
    .suggestion-item.selected {
      background: #f5f5f5;
    }

    .suggestion-item strong {
      font-size: 14px;
    }

    .suggestion-item .email {
      font-size: 12px;
      color: #666;
    }
  `]
})
export class MentionInputComponent {
  @Input() placeholder = 'Type a message...';
  @Input() contacts: Contact[] = [];
  @Output() textChange = new EventEmitter<string>();
  @Output() mention = new EventEmitter<Contact>();
  @ViewChild('textInput') textInput!: ElementRef<HTMLTextAreaElement>;

  text = '';
  showSuggestions = false;
  filteredContacts: Contact[] = [];
  selectedIndex = 0;
  mentionStart = -1;
  mentionQuery = '';

  onTextChange() {
    this.textChange.emit(this.text);
    this.checkForMention();
  }

  checkForMention() {
    const cursorPos = this.textInput.nativeElement.selectionStart;
    const textBeforeCursor = this.text.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex === -1) {
      this.showSuggestions = false;
      return;
    }

    const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
    
    if (/\s/.test(textAfterAt)) {
      this.showSuggestions = false;
      return;
    }

    this.mentionStart = lastAtIndex;
    this.mentionQuery = textAfterAt.toLowerCase();
    this.filterContacts();
    this.showSuggestions = this.filteredContacts.length > 0;
    this.selectedIndex = 0;
  }

  filterContacts() {
    if (!this.mentionQuery) {
      this.filteredContacts = this.contacts.slice(0, 5);
      return;
    }

    this.filteredContacts = this.contacts.filter(c => {
      const name = (c.username || c.first_name || c.email).toLowerCase();
      return name.includes(this.mentionQuery);
    }).slice(0, 5);
  }

  selectContact(contact: Contact) {
    const displayName = contact.username || contact.first_name || contact.email;
    const before = this.text.substring(0, this.mentionStart);
    const after = this.text.substring(this.textInput.nativeElement.selectionStart);
    
    this.text = `${before}@${displayName} ${after}`;
    this.showSuggestions = false;
    this.mention.emit(contact);
    this.textChange.emit(this.text);

    setTimeout(() => {
      const newPos = this.mentionStart + displayName.length + 2;
      this.textInput.nativeElement.setSelectionRange(newPos, newPos);
      this.textInput.nativeElement.focus();
    });
  }

  onKeyDown(event: KeyboardEvent) {
    if (!this.showSuggestions) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.selectedIndex = Math.min(this.selectedIndex + 1, this.filteredContacts.length - 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
        break;
      case 'Enter':
        if (this.filteredContacts[this.selectedIndex]) {
          event.preventDefault();
          this.selectContact(this.filteredContacts[this.selectedIndex]);
        }
        break;
      case 'Escape':
        this.showSuggestions = false;
        break;
    }
  }

  getText(): string {
    return this.text;
  }

  setText(value: string) {
    this.text = value;
  }

  clear() {
    this.text = '';
    this.showSuggestions = false;
  }
}
