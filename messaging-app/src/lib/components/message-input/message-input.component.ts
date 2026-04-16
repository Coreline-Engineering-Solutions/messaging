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
      (dragover)="onDragOver($event)"
      (dragleave)="onDragLeave($event)"
      (drop)="onDrop($event)"
      [class.drag-over]="isDragOver"
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

      <!-- Drag overlay -->
      <div *ngIf="isDragOver" class="drag-overlay">
        <mat-icon>cloud_upload</mat-icon>
        <span>Drop files here</span>
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

    .message-input-container.drag-over {
      background: rgba(255, 255, 255, 0.1);
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
      align-items: flex-end;
      gap: 4px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 24px;
      padding: 2px 4px 2px 4px;
    }

    .attach-btn {
      width: 32px;
      height: 32px;
      flex-shrink: 0;
    }

    .attach-btn mat-icon {
      color: rgba(255, 255, 255, 0.7);
      font-size: 20px;
      width: 20px;
      height: 20px;
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

    .send-btn {
      width: 32px;
      height: 32px;
      flex-shrink: 0;
    }

    .send-btn mat-icon {
      color: rgba(255, 255, 255, 0.9);
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .send-btn:disabled mat-icon {
      color: rgba(255, 255, 255, 0.3);
    }

    .drag-overlay {
      position: absolute;
      inset: 0;
      background: rgba(31, 75, 216, 0.3);
      border: 2px dashed rgba(255, 255, 255, 0.5);
      border-radius: 12px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      color: #fff;
      font-size: 13px;
      z-index: 5;
    }

    .drag-overlay mat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
    }
  `],
})
export class MessageInputComponent {
  @Output() messageSent = new EventEmitter<string>();
  @Output() messageWithFiles = new EventEmitter<MessagePayload>();
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  messageText = '';
  selectedFiles: File[] = [];
  isDragOver = false;

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
      this.selectedFiles = [...this.selectedFiles, ...Array.from(input.files)];
    }
  }

  removeFile(index: number): void {
    this.selectedFiles.splice(index, 1);
    this.selectedFiles = [...this.selectedFiles];
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
    if (event.dataTransfer?.files) {
      this.selectedFiles = [...this.selectedFiles, ...Array.from(event.dataTransfer.files)];
    }
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
