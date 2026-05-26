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
  forcePlainText?: boolean;
}

export interface MessageTextPayload {
  text: string;
  forcePlainText?: boolean;
}

export interface ReplyPreview {
  senderName: string;
  content: string;
}

export interface MentionOption {
  contactId: string;
  label: string;
  token: string;
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

      <div *ngIf="replyTo" class="reply-compose-preview">
        <mat-icon>reply</mat-icon>
        <div class="compose-preview-text">
          <span>Replying to {{ replyTo.senderName }}</span>
          <p>{{ replyTo.content }}</p>
        </div>
        <button type="button" class="compose-cancel-btn" (click)="replyCancelled.emit()" title="Cancel reply">
          <mat-icon>close</mat-icon>
        </button>
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

      <div *ngIf="mentionSuggestions.length > 0" class="mention-suggestions">
        <button
          type="button"
          *ngFor="let option of mentionSuggestions"
          class="mention-suggestion"
          (mousedown)="$event.preventDefault()"
          (click)="insertMention(option)"
        >
          <span class="mention-avatar">&#64;</span>
          <span>{{ option.label }}</span>
          <small>&#64;{{ option.token }}</small>
        </button>
      </div>

      <div *ngIf="detectedCodeLanguage && !codeDetectionDismissed" class="code-detection-chip">
        <mat-icon>code</mat-icon>
        <span>Looks like {{ detectedCodeLanguage }} code</span>
        <button
          type="button"
          class="code-detection-close"
          (click)="dismissCodeDetection()"
          title="Send as normal text"
        >
          <mat-icon>close</mat-icon>
        </button>
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
          (click)="updateMentionSuggestions()"
          (keyup)="updateMentionSuggestions()"
          (keydown)="onKeydown($event)"
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

    .reply-compose-preview {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
      padding: 8px 10px;
      border-radius: 12px;
      background: rgba(127, 180, 255, 0.12);
      border-left: 3px solid rgba(127, 180, 255, 0.8);
      color: #fff;
    }

    .reply-compose-preview > mat-icon {
      color: #bfdbfe;
      font-size: 18px;
      width: 18px;
      height: 18px;
      flex-shrink: 0;
    }

    .compose-preview-text {
      min-width: 0;
      flex: 1;
    }

    .compose-preview-text span {
      display: block;
      font-size: 11px;
      font-weight: 700;
      color: #bfdbfe;
      margin-bottom: 2px;
    }

    .compose-preview-text p {
      margin: 0;
      font-size: 12px;
      color: rgba(255, 255, 255, 0.78);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .compose-cancel-btn {
      width: 24px;
      height: 24px;
      border: none;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.08);
      color: rgba(255, 255, 255, 0.8);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      cursor: pointer;
      flex-shrink: 0;
    }

    .compose-cancel-btn mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .mention-suggestions {
      margin-bottom: 8px;
      border-radius: 12px;
      overflow: hidden;
      background: #071d30;
      border: 1px solid rgba(127, 180, 255, 0.22);
      box-shadow: 0 10px 24px rgba(0, 0, 0, 0.24);
    }

    .mention-suggestion {
      width: 100%;
      border: none;
      background: transparent;
      color: #fff;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      cursor: pointer;
      text-align: left;
    }

    .mention-suggestion:hover,
    .mention-suggestion:focus {
      background: rgba(127, 180, 255, 0.14);
      outline: none;
    }

    .mention-avatar {
      width: 22px;
      height: 22px;
      border-radius: 999px;
      background: rgba(127, 180, 255, 0.22);
      color: #bfdbfe;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 800;
      flex-shrink: 0;
    }

    .mention-suggestion small {
      margin-left: auto;
      color: rgba(255, 255, 255, 0.52);
      font-size: 11px;
    }

    .code-detection-chip {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      margin-bottom: 8px;
      padding: 6px 8px;
      border-radius: 999px;
      background: rgba(127, 180, 255, 0.14);
      border: 1px solid rgba(127, 180, 255, 0.32);
      color: #bfdbfe;
      font-size: 12px;
      font-weight: 700;
    }

    .code-detection-chip > mat-icon {
      font-size: 15px;
      width: 15px;
      height: 15px;
    }

    .code-detection-close {
      width: 20px;
      height: 20px;
      border: none;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.08);
      color: rgba(255, 255, 255, 0.82);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      cursor: pointer;
    }

    .code-detection-close mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
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
      overflow-y: hidden;
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
  @Input() replyTo: ReplyPreview | null = null;
  @Input() enableMentions = false;
  @Input() mentionOptions: MentionOption[] = [];
  @Output() messageSent = new EventEmitter<MessageTextPayload>();
  @Output() messageWithFiles = new EventEmitter<MessagePayload>();
  @Output() replyCancelled = new EventEmitter<void>();
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('messageTextarea') messageTextarea!: ElementRef<HTMLTextAreaElement>;

  messageText = '';
  selectedFiles: File[] = [];
  textareaHeight = 36;
  mentionSuggestions: MentionOption[] = [];
  detectedCodeLanguage: string | null = null;
  codeDetectionDismissed = false;
  private readonly draftPrefix = 'messaging_draft_';
  private lastConversationId: string | null = null;
  private resizing = false;
  private resizeStartY = 0;
  private resizeStartHeight = 0;
  private readonly minTextareaHeight = 36;
  private readonly maxTextareaHeight = 180;
  private manualTextareaHeight = this.minTextareaHeight;
  private activeMentionStart = -1;
  private activeMentionEnd = -1;
  private boundResizeMove = this.onResizeMove.bind(this);
  private boundResizeEnd = this.onResizeEnd.bind(this);

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['conversationId']) return;
    if (this.lastConversationId && this.lastConversationId !== this.conversationId) {
      this.persistDraft(this.lastConversationId, this.messageText);
    }
    this.lastConversationId = this.conversationId;
    this.messageText = this.loadDraft(this.conversationId);
    this.updateCodeDetection(this.messageText);
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
    const forcePlainText = !!this.detectedCodeLanguage && this.codeDetectionDismissed;

    if (this.selectedFiles.length > 0) {
      this.messageWithFiles.emit({ text, files: [...this.selectedFiles], forcePlainText });
    } else {
      this.messageSent.emit({ text, forcePlainText });
    }

    this.resetComposer(true);
  }

  private resetComposer(clearDraft: boolean): void {
    this.messageText = '';
    this.selectedFiles = [];
    this.mentionSuggestions = [];
    this.detectedCodeLanguage = null;
    this.codeDetectionDismissed = false;
    this.manualTextareaHeight = this.minTextareaHeight;
    if (clearDraft) this.clearDraft(this.conversationId);
    if (this.fileInput) this.fileInput.nativeElement.value = '';
    this.queueAutoResize();
  }

  onTextChange(value: string): void {
    this.messageText = value;
    this.persistDraft(this.conversationId, value);
    this.updateMentionSuggestions();
    this.updateCodeDetection(value);
    this.queueAutoResize();
  }

  onPaste(event: ClipboardEvent): void {
    const clipboardItems = Array.from(event.clipboardData?.items || []);
    const imageFiles = clipboardItems
      .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter((file): file is File => !!file)
      .map((file) => this.nameClipboardImage(file));

    if (imageFiles.length > 0) {
      this.addFiles(imageFiles);
      const text = event.clipboardData?.getData('text/plain') || '';
      if (!text.trim()) {
        event.preventDefault();
      }
    }

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
    el.style.height = 'auto';
    const nextHeight = Math.min(
      Math.max(el.scrollHeight, this.manualTextareaHeight, this.minTextareaHeight),
      this.maxTextareaHeight
    );
    this.textareaHeight = nextHeight;
    el.style.height = `${nextHeight}px`;
    el.style.overflowY = nextHeight >= this.maxTextareaHeight ? 'auto' : 'hidden';
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
    const nextHeight = Math.max(
      this.minTextareaHeight,
      Math.min(this.maxTextareaHeight, this.resizeStartHeight + dy)
    );
    this.manualTextareaHeight = nextHeight;
    this.textareaHeight = nextHeight;
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

  private nameClipboardImage(file: File): File {
    const extension = file.type.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
    const filename = `clipboard-image-${new Date().toISOString().replace(/[:.]/g, '-')}.${extension}`;
    return new File([file], filename, { type: file.type || 'image/png', lastModified: Date.now() });
  }

  focus(): void {
    setTimeout(() => this.messageTextarea?.nativeElement?.focus());
  }

  updateMentionSuggestions(): void {
    if (!this.enableMentions || !this.mentionOptions.length) {
      this.mentionSuggestions = [];
      return;
    }

    const textarea = this.messageTextarea?.nativeElement;
    const caret = textarea?.selectionStart ?? this.messageText.length;
    const beforeCaret = this.messageText.slice(0, caret);
    const match = beforeCaret.match(/(^|\s)@([a-zA-Z0-9._-]{0,32})$/);
    if (!match) {
      this.mentionSuggestions = [];
      this.activeMentionStart = -1;
      this.activeMentionEnd = -1;
      return;
    }

    const query = (match[2] || '').toLowerCase();
    this.activeMentionEnd = caret;
    this.activeMentionStart = caret - query.length - 1;
    this.mentionSuggestions = this.mentionOptions
      .filter((option) =>
        option.token.toLowerCase().includes(query) ||
        option.label.toLowerCase().includes(query)
      )
      .slice(0, 5);
  }

  insertMention(option: MentionOption): void {
    if (this.activeMentionStart < 0) return;
    const start = this.activeMentionStart;
    const end = this.activeMentionEnd >= start ? this.activeMentionEnd : this.messageText.length;
    const mentionText = `@${option.token} `;
    const next = `${this.messageText.slice(0, start)}${mentionText}${this.messageText.slice(end)}`;
    this.onTextChange(next);
    this.mentionSuggestions = [];
    setTimeout(() => {
      const textarea = this.messageTextarea?.nativeElement;
      if (!textarea) return;
      const caret = start + mentionText.length;
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = caret;
      this.queueAutoResize();
    });
  }

  dismissCodeDetection(): void {
    this.codeDetectionDismissed = true;
  }

  private updateCodeDetection(value: string): void {
    const language = this.detectCodeLanguage(value);
    if (!language) {
      this.detectedCodeLanguage = null;
      this.codeDetectionDismissed = false;
      return;
    }
    if (language !== this.detectedCodeLanguage) {
      this.codeDetectionDismissed = false;
    }
    this.detectedCodeLanguage = language;
  }

  private detectCodeLanguage(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed || this.looksLikeMarkdown(trimmed) || this.isTableContent(trimmed)) return null;
    const fenced = trimmed.match(/^```([a-zA-Z0-9_+-]*)\s*\n?[\s\S]*?```$/);
    if (fenced) return (fenced[1] || 'code').toLowerCase();
    if (!trimmed.includes('\n') && trimmed.length < 40) return null;
    if (/^\s*(select|with|insert|update|delete|create|alter|drop)\b/i.test(trimmed)) return 'sql';
    const jsDeclaration = /\b(function|const|let|var)\s+[A-Za-z_$][\w$]*\s*(=|=>|\(|:)/.test(trimmed);
    const jsSyntax = /(=>|console\.log|import\s+.*from|export\s+|[{};])/.test(trimmed);
    if (jsDeclaration || jsSyntax) return 'javascript';
    if (/\b(def|import|from|print|class)\b/.test(trimmed) && /:\s*$|^\s{4}/m.test(trimmed)) return 'python';
    if (/<\/?[a-z][\s\S]*>/i.test(trimmed)) return 'html';
    if (/[{};]/.test(trimmed) && /[:=]/.test(trimmed)) return 'code';
    return null;
  }

  private looksLikeMarkdown(content: string): boolean {
    return /(^#{1,6}\s)|(^[-*]\s)|(^\d+\.\s)|(^>\s)|(\*\*[^*]+\*\*)|(`[^`]+`)|(\[[^\]]+\]\([^)]+\))|(^---$)|(^-\s\[[ x]\]\s)|(^```[a-zA-Z0-9_+-]*\s*$)/m.test(content);
  }

  private isTableContent(content: string): boolean {
    if (!content.includes('\t')) return false;
    const rows = content
      .split(/\r?\n/)
      .map((row) => row.split('\t').map((cell) => cell.trim()))
      .filter((row) => row.some(Boolean));
    return rows.length >= 2 && rows.some((row) => row.length >= 2);
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.mentionSuggestions.length > 0) {
      this.mentionSuggestions = [];
      event.preventDefault();
      return;
    }

    if (event.key === 'Enter' && this.mentionSuggestions.length > 0) {
      event.preventDefault();
      this.insertMention(this.mentionSuggestions[0]);
      return;
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
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
