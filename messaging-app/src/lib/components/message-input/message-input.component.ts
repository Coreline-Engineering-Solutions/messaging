import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
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
      <div
        class="input-resize-handle"
        title="Drag up to expand message box"
        (mousedown)="onResizeStart($event)"
      >
        <span></span>
      </div>

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
          #messageTextarea
          [ngModel]="messageText"
          (ngModelChange)="onTextChange($event)"
          (input)="autoResize()"
          (paste)="onPaste($event)"
          (keydown.enter)="onEnter($event)"
          placeholder="Type a message..."
          rows="1"
          class="message-textarea"
          [style.height.px]="textareaHeight"
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

    .input-resize-handle {
      position: absolute;
      top: -5px;
      left: 0;
      right: 0;
      height: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: ns-resize;
      z-index: 2;
    }

    .input-resize-handle span {
      width: 42px;
      height: 3px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.22);
      transition: background 0.15s, width 0.15s;
    }

    .input-resize-handle:hover span {
      width: 56px;
      background: rgba(255, 255, 255, 0.42);
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
      min-height: 24px;
      max-height: 180px;
      padding: 7px 0;
      color: #fff;
      overflow-y: auto;
      box-sizing: border-box;
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
export class MessageInputComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input() conversationId: string | null = null;
  @Output() messageSent = new EventEmitter<string>();
  @Output() messageWithFiles = new EventEmitter<MessagePayload>();
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('messageTextarea') messageTextarea!: ElementRef<HTMLTextAreaElement>;

  messageText = '';
  selectedFiles: File[] = [];
  textareaHeight = 36;
  private readonly draftPrefix = 'messaging_draft_';
  private lastConversationId: string | null = null;
  private resizing = false;
  private resizeStartY = 0;
  private resizeStartHeight = 0;
  private readonly minTextareaHeight = 36;
  private readonly maxTextareaHeight = 180;
  private boundResizeMove = this.onResizeMove.bind(this);
  private boundResizeEnd = this.onResizeEnd.bind(this);

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['conversationId']) return;
    if (this.lastConversationId && this.lastConversationId !== this.conversationId) {
      this.persistDraft(this.lastConversationId, this.messageText);
    }
    this.lastConversationId = this.conversationId;
    this.messageText = this.loadDraft(this.conversationId);
    this.queueAutoResize();
  }

  ngAfterViewInit(): void {
    this.queueAutoResize();
  }

  ngOnDestroy(): void {
    document.removeEventListener('mousemove', this.boundResizeMove);
    document.removeEventListener('mouseup', this.boundResizeEnd);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }

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
    this.clearDraft(this.conversationId);
    if (this.fileInput) this.fileInput.nativeElement.value = '';
    this.queueAutoResize();
  }

  onTextChange(value: string): void {
    this.messageText = value;
    this.persistDraft(this.conversationId, value);
    this.queueAutoResize();
  }

  onPaste(event: ClipboardEvent): void {
    const html = event.clipboardData?.getData('text/html') || '';
    if (!html || !/<table[\s>]/i.test(html)) return;

    const tableText = this.htmlTableToText(html);
    if (!tableText) return;

    event.preventDefault();
    this.insertTextAtCursor(tableText);
  }

  autoResize(): void {
    const el = this.messageTextarea?.nativeElement;
    if (!el) return;
    const nextHeight = Math.min(
      Math.max(el.scrollHeight, this.minTextareaHeight),
      Math.max(this.textareaHeight, this.minTextareaHeight)
    );
    this.textareaHeight = Math.min(nextHeight, this.maxTextareaHeight);
  }

  onResizeStart(event: MouseEvent): void {
    event.preventDefault();
    this.resizing = true;
    this.resizeStartY = event.clientY;
    this.resizeStartHeight = this.textareaHeight;
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', this.boundResizeMove);
    document.addEventListener('mouseup', this.boundResizeEnd);
  }

  private onResizeMove(event: MouseEvent): void {
    if (!this.resizing) return;
    const dy = this.resizeStartY - event.clientY;
    this.textareaHeight = Math.max(
      this.minTextareaHeight,
      Math.min(this.maxTextareaHeight, this.resizeStartHeight + dy)
    );
  }

  private onResizeEnd(): void {
    if (!this.resizing) return;
    this.resizing = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    document.removeEventListener('mousemove', this.boundResizeMove);
    document.removeEventListener('mouseup', this.boundResizeEnd);
  }

  private queueAutoResize(): void {
    setTimeout(() => this.autoResize());
  }

  private draftKey(conversationId: string): string {
    return `${this.draftPrefix}${conversationId}`;
  }

  private loadDraft(conversationId: string | null): string {
    if (!conversationId) return '';
    return localStorage.getItem(this.draftKey(conversationId)) || '';
  }

  private persistDraft(conversationId: string | null, value: string): void {
    if (!conversationId) return;
    const key = this.draftKey(conversationId);
    if (value.trim()) {
      localStorage.setItem(key, value);
    } else {
      localStorage.removeItem(key);
    }
  }

  private clearDraft(conversationId: string | null): void {
    if (!conversationId) return;
    localStorage.removeItem(this.draftKey(conversationId));
  }

  private htmlTableToText(html: string): string {
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const table = doc.querySelector('table');
      if (!table) return '';

      const rows = Array.from(table.querySelectorAll('tr'));
      return rows
        .map((row) =>
          Array.from(row.querySelectorAll('th,td'))
            .map((cell) => (cell.textContent || '').replace(/\s+/g, ' ').trim())
            .join('\t')
        )
        .filter(Boolean)
        .join('\n');
    } catch {
      return '';
    }
  }

  private insertTextAtCursor(text: string): void {
    const textarea = this.messageTextarea?.nativeElement;
    if (!textarea) {
      this.onTextChange(`${this.messageText}${text}`);
      return;
    }

    const start = textarea.selectionStart ?? this.messageText.length;
    const end = textarea.selectionEnd ?? this.messageText.length;
    const next = `${this.messageText.slice(0, start)}${text}${this.messageText.slice(end)}`;
    this.onTextChange(next);
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + text.length;
    });
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
