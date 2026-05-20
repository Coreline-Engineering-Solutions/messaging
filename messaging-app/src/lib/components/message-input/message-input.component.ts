import { Component, EventEmitter, Output, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

export interface MessagePayload {
  text: string;
  files: File[];
}

@Component({
  selector: 'app-message-input',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule],
  template: `
    <div
      class="message-input-container"
    >
      <!-- File previews -->
      <div *ngIf="selectedFiles.length > 0" class="file-previews">
        <div *ngFor="let file of selectedFiles; let i = index" class="file-chip">
          <mat-icon class="file-icon">{{ getFileIcon(file) }}</mat-icon>
          <span class="file-name">{{ file.name }}</span>
          <span class="file-size">{{ formatSize(file.size) }}</span>
          <button mat-icon-button class="file-remove" (click)="removeFile(i)">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>

      <div class="input-wrapper">
        <button mat-icon-button class="attach-btn" (click)="fileInput.click()" title="Attach files">
          <mat-icon>attach_file</mat-icon>
        </button>
        <input
          #fileInput
          type="file"
          multiple
          style="display:none"
          (change)="onFilesSelected($event)"
        />
        <textarea
          [(ngModel)]="messageText"
          (keydown.enter)="onEnter($event)"
          placeholder="Type a message..."
          rows="1"
          class="message-textarea"
        ></textarea>
        <button
          mat-icon-button
          class="send-btn"
          [disabled]="!canSend"
          (click)="send()"
        >
          <mat-icon>send</mat-icon>
        </button>
      </div>

    </div>
  `,
  styles: [`
    .message-input-container {
      padding: 8px 12px;
      border-top: 1px solid rgba(255, 255, 255, 0.15);
      background: transparent;
      position: relative;
    }

    .file-previews {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 8px;
      max-height: 80px;
      overflow-y: auto;
    }

    .file-chip {
      display: flex;
      align-items: center;
      gap: 4px;
      background: rgba(255, 255, 255, 0.15);
      border-radius: 8px;
      padding: 4px 4px 4px 8px;
      max-width: 200px;
    }

    .file-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: rgba(255, 255, 255, 0.8);
    }

    .file-name {
      font-size: 12px;
      color: #fff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100px;
    }

    .file-size {
      font-size: 10px;
      color: rgba(255, 255, 255, 0.5);
      flex-shrink: 0;
    }

    .file-remove {
      width: 20px !important;
      height: 20px !important;
    }

    .file-remove mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
      color: rgba(255, 255, 255, 0.6);
    }

    .input-wrapper {
      display: flex;
      align-items: center;
      gap: 4px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 24px;
      padding: 2px 4px;
    }

    .attach-btn,
    .send-btn {
      flex-shrink: 0;
      width: 36px;
      height: 36px;
      padding: 0 !important;
      margin: 0;
      min-width: 36px !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      line-height: 0 !important;
    }

    .attach-btn mat-icon,
    .send-btn mat-icon {
      color: rgba(255, 255, 255, 0.7);
      font-size: 20px;
      width: 20px;
      height: 20px;
      line-height: 20px;
      margin: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .send-btn mat-icon {
      color: rgba(255, 255, 255, 0.9);
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
      padding: 6px 0;
      color: #fff;
    }

    .message-textarea::placeholder {
      color: rgba(255, 255, 255, 0.5);
    }

    .send-btn:disabled mat-icon {
      color: rgba(255, 255, 255, 0.3);
    }

    /* MDC mat-icon-button inner wrapper often shifts glyphs downward without this */
    :host ::ng-deep .attach-btn .mat-mdc-button-touch-target,
    :host ::ng-deep .send-btn .mat-mdc-button-touch-target {
      height: 36px !important;
      width: 36px !important;
    }

    :host ::ng-deep .attach-btn .mdc-icon-button__icon,
    :host ::ng-deep .send-btn .mdc-icon-button__icon {
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      margin: 0 !important;
      padding: 0 !important;
    }

  `],
})
export class MessageInputComponent {
  @Output() messageSent = new EventEmitter<string>();
  @Output() messageWithFiles = new EventEmitter<MessagePayload>();
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  messageText = '';
  selectedFiles: File[] = [];

  get canSend(): boolean {
    return this.messageText.trim().length > 0 || this.selectedFiles.length > 0;
  }

  send(): void {
    if (!this.canSend) return;
    const text = this.messageText.trim();

    if (this.selectedFiles.length > 0) {
      this.messageWithFiles.emit({ text, files: [...this.selectedFiles] });
    } else {
      this.messageSent.emit(text);
    }

    this.messageText = '';
    this.selectedFiles = [];
    if (this.fileInput) this.fileInput.nativeElement.value = '';
  }

  onEnter(event: Event): void {
    const ke = event as KeyboardEvent;
    if (!ke.shiftKey) {
      ke.preventDefault();
      this.send();
    }
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.addFiles(Array.from(input.files));
    }
  }

  addFiles(files: File[]): void {
    if (!files.length) return;
    this.selectedFiles = [...this.selectedFiles, ...files];
  }

  removeFile(index: number): void {
    this.selectedFiles.splice(index, 1);
    this.selectedFiles = [...this.selectedFiles];
  }

  getFileIcon(file: File): string {
    const type = file.type;
    if (type.startsWith('image/')) return 'image';
    if (type.startsWith('video/')) return 'videocam';
    if (type.startsWith('audio/')) return 'audiotrack';
    if (type.includes('pdf')) return 'picture_as_pdf';
    if (type.includes('spreadsheet') || type.includes('excel')) return 'table_chart';
    if (type.includes('document') || type.includes('word')) return 'description';
    return 'insert_drive_file';
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
}
