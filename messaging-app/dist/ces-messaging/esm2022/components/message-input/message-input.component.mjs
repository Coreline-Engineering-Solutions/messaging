import { Component, EventEmitter, Input, Output, ViewChild, } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import * as i0 from "@angular/core";
import * as i1 from "@angular/common";
import * as i2 from "@angular/forms";
import * as i3 from "@angular/material/icon";
import * as i4 from "@angular/material/button";
export class MessageInputComponent {
    conversationId = null;
    replyTo = null;
    enableMentions = false;
    mentionOptions = [];
    messageSent = new EventEmitter();
    messageWithFiles = new EventEmitter();
    replyCancelled = new EventEmitter();
    fileInput;
    messageTextarea;
    messageText = '';
    selectedFiles = [];
    textareaHeight = 36;
    mentionSuggestions = [];
    detectedCodeLanguage = null;
    codeDetectionDismissed = false;
    draftPrefix = 'messaging_draft_';
    lastConversationId = null;
    resizing = false;
    resizeStartY = 0;
    resizeStartHeight = 0;
    minTextareaHeight = 36;
    maxTextareaHeight = 180;
    manualTextareaHeight = this.minTextareaHeight;
    activeMentionStart = -1;
    activeMentionEnd = -1;
    boundResizeMove = this.onResizeMove.bind(this);
    boundResizeEnd = this.onResizeEnd.bind(this);
    ngOnChanges(changes) {
        if (!changes['conversationId'])
            return;
        if (this.lastConversationId && this.lastConversationId !== this.conversationId) {
            this.persistDraft(this.lastConversationId, this.messageText);
        }
        this.lastConversationId = this.conversationId;
        this.messageText = this.loadDraft(this.conversationId);
        this.updateCodeDetection(this.messageText);
        this.queueAutoResize();
    }
    ngAfterViewInit() {
        this.queueAutoResize();
    }
    ngOnDestroy() {
        document.removeEventListener('mousemove', this.boundResizeMove);
        document.removeEventListener('mouseup', this.boundResizeEnd);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    }
    get canSend() {
        return this.messageText.trim().length > 0 || this.selectedFiles.length > 0;
    }
    send() {
        if (!this.canSend)
            return;
        const text = this.messageText.trim();
        const forcePlainText = !!this.detectedCodeLanguage && this.codeDetectionDismissed;
        if (this.selectedFiles.length > 0) {
            this.messageWithFiles.emit({ text, files: [...this.selectedFiles], forcePlainText });
        }
        else {
            this.messageSent.emit({ text, forcePlainText });
        }
        this.messageText = '';
        this.selectedFiles = [];
        this.mentionSuggestions = [];
        this.detectedCodeLanguage = null;
        this.codeDetectionDismissed = false;
        this.manualTextareaHeight = this.minTextareaHeight;
        this.clearDraft(this.conversationId);
        if (this.fileInput)
            this.fileInput.nativeElement.value = '';
        this.queueAutoResize();
    }
    onTextChange(value) {
        this.messageText = value;
        this.persistDraft(this.conversationId, value);
        this.updateMentionSuggestions();
        this.updateCodeDetection(value);
        this.queueAutoResize();
    }
    onPaste(event) {
        const clipboardItems = Array.from(event.clipboardData?.items || []);
        const imageFiles = clipboardItems
            .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
            .map((item) => item.getAsFile())
            .filter((file) => !!file)
            .map((file) => this.nameClipboardImage(file));
        if (imageFiles.length > 0) {
            this.addFiles(imageFiles);
            const text = event.clipboardData?.getData('text/plain') || '';
            if (!text.trim()) {
                event.preventDefault();
            }
        }
        const html = event.clipboardData?.getData('text/html') || '';
        if (!html || !/<table[\s>]/i.test(html))
            return;
        const tableText = this.htmlTableToText(html);
        if (!tableText)
            return;
        event.preventDefault();
        this.insertTextAtCursor(tableText);
    }
    autoResize() {
        const el = this.messageTextarea?.nativeElement;
        if (!el)
            return;
        el.style.height = 'auto';
        const nextHeight = Math.min(Math.max(el.scrollHeight, this.manualTextareaHeight, this.minTextareaHeight), this.maxTextareaHeight);
        this.textareaHeight = nextHeight;
        el.style.height = `${nextHeight}px`;
        el.style.overflowY = nextHeight >= this.maxTextareaHeight ? 'auto' : 'hidden';
    }
    onResizeStart(event) {
        event.preventDefault();
        this.resizing = true;
        this.resizeStartY = event.clientY;
        this.resizeStartHeight = this.textareaHeight;
        document.body.style.cursor = 'ns-resize';
        document.body.style.userSelect = 'none';
        document.addEventListener('mousemove', this.boundResizeMove);
        document.addEventListener('mouseup', this.boundResizeEnd);
    }
    onResizeMove(event) {
        if (!this.resizing)
            return;
        const dy = this.resizeStartY - event.clientY;
        const nextHeight = Math.max(this.minTextareaHeight, Math.min(this.maxTextareaHeight, this.resizeStartHeight + dy));
        this.manualTextareaHeight = nextHeight;
        this.textareaHeight = nextHeight;
    }
    onResizeEnd() {
        if (!this.resizing)
            return;
        this.resizing = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', this.boundResizeMove);
        document.removeEventListener('mouseup', this.boundResizeEnd);
    }
    queueAutoResize() {
        setTimeout(() => this.autoResize());
    }
    draftKey(conversationId) {
        return `${this.draftPrefix}${conversationId}`;
    }
    loadDraft(conversationId) {
        if (!conversationId)
            return '';
        return localStorage.getItem(this.draftKey(conversationId)) || '';
    }
    persistDraft(conversationId, value) {
        if (!conversationId)
            return;
        const key = this.draftKey(conversationId);
        if (value.trim()) {
            localStorage.setItem(key, value);
        }
        else {
            localStorage.removeItem(key);
        }
    }
    clearDraft(conversationId) {
        if (!conversationId)
            return;
        localStorage.removeItem(this.draftKey(conversationId));
    }
    htmlTableToText(html) {
        try {
            const doc = new DOMParser().parseFromString(html, 'text/html');
            const table = doc.querySelector('table');
            if (!table)
                return '';
            const rows = Array.from(table.querySelectorAll('tr'));
            return rows
                .map((row) => Array.from(row.querySelectorAll('th,td'))
                .map((cell) => (cell.textContent || '').replace(/\s+/g, ' ').trim())
                .join('\t'))
                .filter(Boolean)
                .join('\n');
        }
        catch {
            return '';
        }
    }
    insertTextAtCursor(text) {
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
    nameClipboardImage(file) {
        const extension = file.type.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
        const filename = `clipboard-image-${new Date().toISOString().replace(/[:.]/g, '-')}.${extension}`;
        return new File([file], filename, { type: file.type || 'image/png', lastModified: Date.now() });
    }
    focus() {
        setTimeout(() => this.messageTextarea?.nativeElement?.focus());
    }
    updateMentionSuggestions() {
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
            .filter((option) => option.token.toLowerCase().includes(query) ||
            option.label.toLowerCase().includes(query))
            .slice(0, 5);
    }
    insertMention(option) {
        if (this.activeMentionStart < 0)
            return;
        const start = this.activeMentionStart;
        const end = this.activeMentionEnd >= start ? this.activeMentionEnd : this.messageText.length;
        const mentionText = `@${option.token} `;
        const next = `${this.messageText.slice(0, start)}${mentionText}${this.messageText.slice(end)}`;
        this.onTextChange(next);
        this.mentionSuggestions = [];
        setTimeout(() => {
            const textarea = this.messageTextarea?.nativeElement;
            if (!textarea)
                return;
            const caret = start + mentionText.length;
            textarea.focus();
            textarea.selectionStart = textarea.selectionEnd = caret;
            this.queueAutoResize();
        });
    }
    dismissCodeDetection() {
        this.codeDetectionDismissed = true;
    }
    updateCodeDetection(value) {
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
    detectCodeLanguage(value) {
        const trimmed = value.trim();
        if (!trimmed || this.looksLikeMarkdown(trimmed) || this.isTableContent(trimmed))
            return null;
        const fenced = trimmed.match(/^```([a-zA-Z0-9_+-]*)\s*\n?[\s\S]*?```$/);
        if (fenced)
            return (fenced[1] || 'code').toLowerCase();
        if (!trimmed.includes('\n') && trimmed.length < 40)
            return null;
        if (/^\s*(select|with|insert|update|delete|create|alter|drop)\b/i.test(trimmed))
            return 'sql';
        const jsDeclaration = /\b(function|const|let|var)\s+[A-Za-z_$][\w$]*\s*(=|=>|\(|:)/.test(trimmed);
        const jsSyntax = /(=>|console\.log|import\s+.*from|export\s+|[{};])/.test(trimmed);
        if (jsDeclaration || jsSyntax)
            return 'javascript';
        if (/\b(def|import|from|print|class)\b/.test(trimmed) && /:\s*$|^\s{4}/m.test(trimmed))
            return 'python';
        if (/<\/?[a-z][\s\S]*>/i.test(trimmed))
            return 'html';
        if (/[{};]/.test(trimmed) && /[:=]/.test(trimmed))
            return 'code';
        return null;
    }
    looksLikeMarkdown(content) {
        return /(^#{1,6}\s)|(^[-*]\s)|(^\d+\.\s)|(^>\s)|(\*\*[^*]+\*\*)|(`[^`]+`)|(\[[^\]]+\]\([^)]+\))|(^---$)|(^-\s\[[ x]\]\s)|(^```[a-zA-Z0-9_+-]*\s*$)/m.test(content);
    }
    isTableContent(content) {
        if (!content.includes('\t'))
            return false;
        const rows = content
            .split(/\r?\n/)
            .map((row) => row.split('\t').map((cell) => cell.trim()))
            .filter((row) => row.some(Boolean));
        return rows.length >= 2 && rows.some((row) => row.length >= 2);
    }
    onKeydown(event) {
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
    onEnter(event) {
        const ke = event;
        if (!ke.shiftKey) {
            ke.preventDefault();
            this.send();
        }
    }
    onFilesSelected(event) {
        const input = event.target;
        if (input.files) {
            this.addFiles(Array.from(input.files));
        }
    }
    addFiles(files) {
        if (!files.length)
            return;
        this.selectedFiles = [...this.selectedFiles, ...files];
    }
    removeFile(index) {
        this.selectedFiles.splice(index, 1);
        this.selectedFiles = [...this.selectedFiles];
    }
    getFileIcon(file) {
        const type = file.type;
        if (type.startsWith('image/'))
            return 'image';
        if (type.startsWith('video/'))
            return 'videocam';
        if (type.startsWith('audio/'))
            return 'audiotrack';
        if (type.includes('pdf'))
            return 'picture_as_pdf';
        if (type.includes('spreadsheet') || type.includes('excel'))
            return 'table_chart';
        if (type.includes('document') || type.includes('word'))
            return 'description';
        return 'insert_drive_file';
    }
    formatSize(bytes) {
        if (bytes < 1024)
            return bytes + ' B';
        if (bytes < 1024 * 1024)
            return (bytes / 1024).toFixed(0) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: MessageInputComponent, deps: [], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "17.3.12", type: MessageInputComponent, isStandalone: true, selector: "app-message-input", inputs: { conversationId: "conversationId", replyTo: "replyTo", enableMentions: "enableMentions", mentionOptions: "mentionOptions" }, outputs: { messageSent: "messageSent", messageWithFiles: "messageWithFiles", replyCancelled: "replyCancelled" }, viewQueries: [{ propertyName: "fileInput", first: true, predicate: ["fileInput"], descendants: true }, { propertyName: "messageTextarea", first: true, predicate: ["messageTextarea"], descendants: true }], usesOnChanges: true, ngImport: i0, template: `
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
        <div class="reply-compose-text">
          <span>Replying to {{ replyTo.senderName }}</span>
          <p>{{ replyTo.content }}</p>
        </div>
        <button type="button" class="reply-cancel-btn" (click)="replyCancelled.emit()" title="Cancel reply">
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
  `, isInline: true, styles: [".message-input-container{padding:8px 12px;border-top:1px solid rgba(255,255,255,.15);background:transparent;position:relative}.input-resize-handle{position:absolute;top:-5px;left:0;right:0;height:10px;display:flex;align-items:center;justify-content:center;cursor:ns-resize;z-index:2}.input-resize-handle span{width:42px;height:3px;border-radius:999px;background:#ffffff38;transition:background .15s,width .15s}.input-resize-handle:hover span{width:56px;background:#ffffff6b}.file-previews{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;max-height:80px;overflow-y:auto}.reply-compose-preview{display:flex;align-items:center;gap:8px;margin-bottom:8px;padding:8px 10px;border-radius:12px;background:#7fb4ff1f;border-left:3px solid rgba(127,180,255,.8);color:#fff}.reply-compose-preview>mat-icon{color:#bfdbfe;font-size:18px;width:18px;height:18px;flex-shrink:0}.reply-compose-text{min-width:0;flex:1}.reply-compose-text span{display:block;font-size:11px;font-weight:700;color:#bfdbfe;margin-bottom:2px}.reply-compose-text p{margin:0;font-size:12px;color:#ffffffc7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.reply-cancel-btn{width:24px;height:24px;border:none;border-radius:999px;background:#ffffff14;color:#fffc;display:inline-flex;align-items:center;justify-content:center;padding:0;cursor:pointer;flex-shrink:0}.reply-cancel-btn mat-icon{font-size:16px;width:16px;height:16px}.mention-suggestions{margin-bottom:8px;border-radius:12px;overflow:hidden;background:#071d30;border:1px solid rgba(127,180,255,.22);box-shadow:0 10px 24px #0000003d}.mention-suggestion{width:100%;border:none;background:transparent;color:#fff;display:flex;align-items:center;gap:8px;padding:8px 10px;cursor:pointer;text-align:left}.mention-suggestion:hover,.mention-suggestion:focus{background:#7fb4ff24;outline:none}.mention-avatar{width:22px;height:22px;border-radius:999px;background:#7fb4ff38;color:#bfdbfe;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex-shrink:0}.mention-suggestion small{margin-left:auto;color:#ffffff85;font-size:11px}.code-detection-chip{display:inline-flex;align-items:center;gap:7px;margin-bottom:8px;padding:6px 8px;border-radius:999px;background:#7fb4ff24;border:1px solid rgba(127,180,255,.32);color:#bfdbfe;font-size:12px;font-weight:700}.code-detection-chip>mat-icon{font-size:15px;width:15px;height:15px}.code-detection-close{width:20px;height:20px;border:none;border-radius:999px;background:#ffffff14;color:#ffffffd1;display:inline-flex;align-items:center;justify-content:center;padding:0;cursor:pointer}.code-detection-close mat-icon{font-size:14px;width:14px;height:14px}.file-chip{display:flex;align-items:center;gap:4px;background:#ffffff26;border-radius:8px;padding:4px 4px 4px 8px;max-width:200px}.file-icon{font-size:16px;width:16px;height:16px;color:#fffc}.file-name{font-size:12px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100px}.file-size{font-size:10px;color:#ffffff80;flex-shrink:0}.file-remove{width:20px!important;height:20px!important}.file-remove mat-icon{font-size:14px;width:14px;height:14px;color:#fff9}.input-wrapper{display:flex;align-items:flex-end;gap:4px;background:#ffffff1a;border-radius:24px;padding:2px 4px}.attach-btn,.send-btn{flex-shrink:0;width:36px;height:36px;padding:0!important;margin:0;min-width:36px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;line-height:0!important}.attach-btn mat-icon,.send-btn mat-icon{color:#ffffffb3;font-size:20px;width:20px;height:20px;line-height:20px;margin:0;display:flex;align-items:center;justify-content:center}.send-btn mat-icon{color:#ffffffe6}.message-textarea{flex:1;border:none;outline:none;background:transparent;resize:none;font-size:14px;font-family:inherit;line-height:1.5;min-height:24px;max-height:180px;padding:7px 0;color:#fff;overflow-y:hidden;box-sizing:border-box}.message-textarea::placeholder{color:#ffffff80}.send-btn:disabled mat-icon{color:#ffffff4d}:host ::ng-deep .attach-btn .mat-mdc-button-touch-target,:host ::ng-deep .send-btn .mat-mdc-button-touch-target{height:36px!important;width:36px!important}:host ::ng-deep .attach-btn .mdc-icon-button__icon,:host ::ng-deep .send-btn .mdc-icon-button__icon{display:flex!important;align-items:center!important;justify-content:center!important;margin:0!important;padding:0!important}\n"], dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i1.NgForOf, selector: "[ngFor][ngForOf]", inputs: ["ngForOf", "ngForTrackBy", "ngForTemplate"] }, { kind: "directive", type: i1.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "ngmodule", type: FormsModule }, { kind: "directive", type: i2.DefaultValueAccessor, selector: "input:not([type=checkbox])[formControlName],textarea[formControlName],input:not([type=checkbox])[formControl],textarea[formControl],input:not([type=checkbox])[ngModel],textarea[ngModel],[ngDefaultControl]" }, { kind: "directive", type: i2.NgControlStatus, selector: "[formControlName],[ngModel],[formControl]" }, { kind: "directive", type: i2.NgModel, selector: "[ngModel]:not([formControlName]):not([formControl])", inputs: ["name", "disabled", "ngModel", "ngModelOptions"], outputs: ["ngModelChange"], exportAs: ["ngModel"] }, { kind: "ngmodule", type: MatIconModule }, { kind: "component", type: i3.MatIcon, selector: "mat-icon", inputs: ["color", "inline", "svgIcon", "fontSet", "fontIcon"], exportAs: ["matIcon"] }, { kind: "ngmodule", type: MatButtonModule }, { kind: "component", type: i4.MatIconButton, selector: "button[mat-icon-button]", exportAs: ["matButton"] }] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: MessageInputComponent, decorators: [{
            type: Component,
            args: [{ selector: 'app-message-input', standalone: true, imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule], template: `
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
        <div class="reply-compose-text">
          <span>Replying to {{ replyTo.senderName }}</span>
          <p>{{ replyTo.content }}</p>
        </div>
        <button type="button" class="reply-cancel-btn" (click)="replyCancelled.emit()" title="Cancel reply">
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
  `, styles: [".message-input-container{padding:8px 12px;border-top:1px solid rgba(255,255,255,.15);background:transparent;position:relative}.input-resize-handle{position:absolute;top:-5px;left:0;right:0;height:10px;display:flex;align-items:center;justify-content:center;cursor:ns-resize;z-index:2}.input-resize-handle span{width:42px;height:3px;border-radius:999px;background:#ffffff38;transition:background .15s,width .15s}.input-resize-handle:hover span{width:56px;background:#ffffff6b}.file-previews{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;max-height:80px;overflow-y:auto}.reply-compose-preview{display:flex;align-items:center;gap:8px;margin-bottom:8px;padding:8px 10px;border-radius:12px;background:#7fb4ff1f;border-left:3px solid rgba(127,180,255,.8);color:#fff}.reply-compose-preview>mat-icon{color:#bfdbfe;font-size:18px;width:18px;height:18px;flex-shrink:0}.reply-compose-text{min-width:0;flex:1}.reply-compose-text span{display:block;font-size:11px;font-weight:700;color:#bfdbfe;margin-bottom:2px}.reply-compose-text p{margin:0;font-size:12px;color:#ffffffc7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.reply-cancel-btn{width:24px;height:24px;border:none;border-radius:999px;background:#ffffff14;color:#fffc;display:inline-flex;align-items:center;justify-content:center;padding:0;cursor:pointer;flex-shrink:0}.reply-cancel-btn mat-icon{font-size:16px;width:16px;height:16px}.mention-suggestions{margin-bottom:8px;border-radius:12px;overflow:hidden;background:#071d30;border:1px solid rgba(127,180,255,.22);box-shadow:0 10px 24px #0000003d}.mention-suggestion{width:100%;border:none;background:transparent;color:#fff;display:flex;align-items:center;gap:8px;padding:8px 10px;cursor:pointer;text-align:left}.mention-suggestion:hover,.mention-suggestion:focus{background:#7fb4ff24;outline:none}.mention-avatar{width:22px;height:22px;border-radius:999px;background:#7fb4ff38;color:#bfdbfe;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex-shrink:0}.mention-suggestion small{margin-left:auto;color:#ffffff85;font-size:11px}.code-detection-chip{display:inline-flex;align-items:center;gap:7px;margin-bottom:8px;padding:6px 8px;border-radius:999px;background:#7fb4ff24;border:1px solid rgba(127,180,255,.32);color:#bfdbfe;font-size:12px;font-weight:700}.code-detection-chip>mat-icon{font-size:15px;width:15px;height:15px}.code-detection-close{width:20px;height:20px;border:none;border-radius:999px;background:#ffffff14;color:#ffffffd1;display:inline-flex;align-items:center;justify-content:center;padding:0;cursor:pointer}.code-detection-close mat-icon{font-size:14px;width:14px;height:14px}.file-chip{display:flex;align-items:center;gap:4px;background:#ffffff26;border-radius:8px;padding:4px 4px 4px 8px;max-width:200px}.file-icon{font-size:16px;width:16px;height:16px;color:#fffc}.file-name{font-size:12px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100px}.file-size{font-size:10px;color:#ffffff80;flex-shrink:0}.file-remove{width:20px!important;height:20px!important}.file-remove mat-icon{font-size:14px;width:14px;height:14px;color:#fff9}.input-wrapper{display:flex;align-items:flex-end;gap:4px;background:#ffffff1a;border-radius:24px;padding:2px 4px}.attach-btn,.send-btn{flex-shrink:0;width:36px;height:36px;padding:0!important;margin:0;min-width:36px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;line-height:0!important}.attach-btn mat-icon,.send-btn mat-icon{color:#ffffffb3;font-size:20px;width:20px;height:20px;line-height:20px;margin:0;display:flex;align-items:center;justify-content:center}.send-btn mat-icon{color:#ffffffe6}.message-textarea{flex:1;border:none;outline:none;background:transparent;resize:none;font-size:14px;font-family:inherit;line-height:1.5;min-height:24px;max-height:180px;padding:7px 0;color:#fff;overflow-y:hidden;box-sizing:border-box}.message-textarea::placeholder{color:#ffffff80}.send-btn:disabled mat-icon{color:#ffffff4d}:host ::ng-deep .attach-btn .mat-mdc-button-touch-target,:host ::ng-deep .send-btn .mat-mdc-button-touch-target{height:36px!important;width:36px!important}:host ::ng-deep .attach-btn .mdc-icon-button__icon,:host ::ng-deep .send-btn .mdc-icon-button__icon{display:flex!important;align-items:center!important;justify-content:center!important;margin:0!important;padding:0!important}\n"] }]
        }], propDecorators: { conversationId: [{
                type: Input
            }], replyTo: [{
                type: Input
            }], enableMentions: [{
                type: Input
            }], mentionOptions: [{
                type: Input
            }], messageSent: [{
                type: Output
            }], messageWithFiles: [{
                type: Output
            }], replyCancelled: [{
                type: Output
            }], fileInput: [{
                type: ViewChild,
                args: ['fileInput']
            }], messageTextarea: [{
                type: ViewChild,
                args: ['messageTextarea']
            }] } });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVzc2FnZS1pbnB1dC5jb21wb25lbnQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvbGliL2NvbXBvbmVudHMvbWVzc2FnZS1pbnB1dC9tZXNzYWdlLWlucHV0LmNvbXBvbmVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBRUwsU0FBUyxFQUVULFlBQVksRUFDWixLQUFLLEVBR0wsTUFBTSxFQUVOLFNBQVMsR0FDVixNQUFNLGVBQWUsQ0FBQztBQUN2QixPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDL0MsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLGdCQUFnQixDQUFDO0FBQzdDLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSx3QkFBd0IsQ0FBQztBQUN2RCxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sMEJBQTBCLENBQUM7Ozs7OztBQWdjM0QsTUFBTSxPQUFPLHFCQUFxQjtJQUN2QixjQUFjLEdBQWtCLElBQUksQ0FBQztJQUNyQyxPQUFPLEdBQXdCLElBQUksQ0FBQztJQUNwQyxjQUFjLEdBQUcsS0FBSyxDQUFDO0lBQ3ZCLGNBQWMsR0FBb0IsRUFBRSxDQUFDO0lBQ3BDLFdBQVcsR0FBRyxJQUFJLFlBQVksRUFBc0IsQ0FBQztJQUNyRCxnQkFBZ0IsR0FBRyxJQUFJLFlBQVksRUFBa0IsQ0FBQztJQUN0RCxjQUFjLEdBQUcsSUFBSSxZQUFZLEVBQVEsQ0FBQztJQUM1QixTQUFTLENBQWdDO0lBQ25DLGVBQWUsQ0FBbUM7SUFFaEYsV0FBVyxHQUFHLEVBQUUsQ0FBQztJQUNqQixhQUFhLEdBQVcsRUFBRSxDQUFDO0lBQzNCLGNBQWMsR0FBRyxFQUFFLENBQUM7SUFDcEIsa0JBQWtCLEdBQW9CLEVBQUUsQ0FBQztJQUN6QyxvQkFBb0IsR0FBa0IsSUFBSSxDQUFDO0lBQzNDLHNCQUFzQixHQUFHLEtBQUssQ0FBQztJQUNkLFdBQVcsR0FBRyxrQkFBa0IsQ0FB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dEI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBa0dULHUzSUFuR1MsWUFBWSwrUEFBRSxXQUFXLDhtQkFBRSxhQUFhLG1MQUFFLGVBQWU7OzRGQXFheEQscUJBQXFCO2tCQXhhakMsU0FBUzsrQkFDRSxtQkFBbUIsY0FDakIsSUFBSSxXQUNQLENBQUMsWUFBWSxFQUFFLFdBQVcsRUFBRSxhQUFhLEVBQUUsZUFBZSxDQUFDLFlBQzFEOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQWtHVDs4QkFtVVEsY0FBYztzQkFBdEIsS0FBSztnQkFDRyxPQUFPO3NCQUFmLEtBQUs7Z0JBQ0csY0FBYztzQkFBdEIsS0FBSztnQkFDRyxjQUFjO3NCQUF0QixLQUFLO2dCQUNJLFdBQVc7c0JBQXBCLE1BQU07Z0JBQ0csZ0JBQWdCO3NCQUF6QixNQUFNO2dCQUNHLGNBQWM7c0JBQXZCLE1BQU07Z0JBQ2lCLFNBQVM7c0JBQWhDLFNBQVM7dUJBQUMsV0FBVztnQkFDUSxlQUFlO3NCQUE1QyxTQUFTO3VCQUFDLGlCQUFpQiIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7XG4gIEFmdGVyVmlld0luaXQsXG4gIENvbXBvbmVudCxcbiAgRWxlbWVudFJlZixcbiAgRXZlbnRFbWl0dGVyLFxuICBJbnB1dCxcbiAgT25DaGFuZ2VzLFxuICBPbkRlc3Ryb3ksXG4gIE91dHB1dCxcbiAgU2ltcGxlQ2hhbmdlcyxcbiAgVmlld0NoaWxkLFxufSBmcm9tICdAYW5ndWxhci9jb3JlJztcbmltcG9ydCB7IENvbW1vbk1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL2NvbW1vbic7XG5pbXBvcnQgeyBGb3Jtc01vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL2Zvcm1zJztcbmltcG9ydCB7IE1hdEljb25Nb2R1bGUgfSBmcm9tICdAYW5ndWxhci9tYXRlcmlhbC9pY29uJztcbmltcG9ydCB7IE1hdEJ1dHRvbk1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL21hdGVyaWFsL2J1dHRvbic7XG5cbmV4cG9ydCBpbnRlcmZhY2UgTWVzc2FnZVBheWxvYWQge1xuICB0ZXh0OiBzdHJpbmc7XG4gIGZpbGVzOiBGaWxlW107XG4gIGZvcmNlUGxhaW5UZXh0PzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBNZXNzYWdlVGV4dFBheWxvYWQge1xuICB0ZXh0OiBzdHJpbmc7XG4gIGZvcmNlUGxhaW5UZXh0PzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBSZXBseVByZXZpZXcge1xuICBzZW5kZXJOYW1lOiBzdHJpbmc7XG4gIGNvbnRlbnQ6IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBNZW50aW9uT3B0aW9uIHtcbiAgY29udGFjdElkOiBzdHJpbmc7XG4gIGxhYmVsOiBzdHJpbmc7XG4gIHRva2VuOiBzdHJpbmc7XG59XG5cbkBDb21wb25lbnQoe1xuICBzZWxlY3RvcjogJ2FwcC1tZXNzYWdlLWlucHV0JyxcbiAgc3RhbmRhbG9uZTogdHJ1ZSxcbiAgaW1wb3J0czogW0NvbW1vbk1vZHVsZSwgRm9ybXNNb2R1bGUsIE1hdEljb25Nb2R1bGUsIE1hdEJ1dHRvbk1vZHVsZV0sXG4gIHRlbXBsYXRlOiBgXG4gICAgPGRpdlxuICAgICAgY2xhc3M9XCJtZXNzYWdlLWlucHV0LWNvbnRhaW5lclwiXG4gICAgPlxuICAgICAgPGRpdlxuICAgICAgICBjbGFzcz1cImlucHV0LXJlc2l6ZS1oYW5kbGVcIlxuICAgICAgICB0aXRsZT1cIkRyYWcgdXAgdG8gZXhwYW5kIG1lc3NhZ2UgYm94XCJcbiAgICAgICAgKG1vdXNlZG93bik9XCJvblJlc2l6ZVN0YXJ0KCRldmVudClcIlxuICAgICAgPlxuICAgICAgICA8c3Bhbj48L3NwYW4+XG4gICAgICA8L2Rpdj5cblxuICAgICAgPGRpdiAqbmdJZj1cInJlcGx5VG9cIiBjbGFzcz1cInJlcGx5LWNvbXBvc2UtcHJldmlld1wiPlxuICAgICAgICA8bWF0LWljb24+cmVwbHk8L21hdC1pY29uPlxuICAgICAgICA8ZGl2IGNsYXNzPVwicmVwbHktY29tcG9zZS10ZXh0XCI+XG4gICAgICAgICAgPHNwYW4+UmVwbHlpbmcgdG8ge3sgcmVwbHlUby5zZW5kZXJOYW1lIH19PC9zcGFuPlxuICAgICAgICAgIDxwPnt7IHJlcGx5VG8uY29udGVudCB9fTwvcD5cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIDxidXR0b24gdHlwZT1cImJ1dHRvblwiIGNsYXNzPVwicmVwbHktY2FuY2VsLWJ0blwiIChjbGljayk9XCJyZXBseUNhbmNlbGxlZC5lbWl0KClcIiB0aXRsZT1cIkNhbmNlbCByZXBseVwiPlxuICAgICAgICAgIDxtYXQtaWNvbj5jbG9zZTwvbWF0LWljb24+XG4gICAgICAgIDwvYnV0dG9uPlxuICAgICAgPC9kaXY+XG5cbiAgICAgIDwhLS0gRmlsZSBwcmV2aWV3cyAtLT5cbiAgICAgIDxkaXYgKm5nSWY9XCJzZWxlY3RlZEZpbGVzLmxlbmd0aCA+IDBcIiBjbGFzcz1cImZpbGUtcHJldmlld3NcIj5cbiAgICAgICAgPGRpdiAqbmdGb3I9XCJsZXQgZmlsZSBvZiBzZWxlY3RlZEZpbGVzOyBsZXQgaSA9IGluZGV4XCIgY2xhc3M9XCJmaWxlLWNoaXBcIj5cbiAgICAgICAgICA8bWF0LWljb24gY2xhc3M9XCJmaWxlLWljb25cIj57eyBnZXRGaWxlSWNvbihmaWxlKSB9fTwvbWF0LWljb24+XG4gICAgICAgICAgPHNwYW4gY2xhc3M9XCJmaWxlLW5hbWVcIj57eyBmaWxlLm5hbWUgfX08L3NwYW4+XG4gICAgICAgICAgPHNwYW4gY2xhc3M9XCJmaWxlLXNpemVcIj57eyBmb3JtYXRTaXplKGZpbGUuc2l6ZSkgfX08L3NwYW4+XG4gICAgICAgICAgPGJ1dHRvbiBtYXQtaWNvbi1idXR0b24gY2xhc3M9XCJmaWxlLXJlbW92ZVwiIChjbGljayk9XCJyZW1vdmVGaWxlKGkpXCI+XG4gICAgICAgICAgICA8bWF0LWljb24+Y2xvc2U8L21hdC1pY29uPlxuICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuXG4gICAgICA8ZGl2ICpuZ0lmPVwibWVudGlvblN1Z2dlc3Rpb25zLmxlbmd0aCA+IDBcIiBjbGFzcz1cIm1lbnRpb24tc3VnZ2VzdGlvbnNcIj5cbiAgICAgICAgPGJ1dHRvblxuICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxuICAgICAgICAgICpuZ0Zvcj1cImxldCBvcHRpb24gb2YgbWVudGlvblN1Z2dlc3Rpb25zXCJcbiAgICAgICAgICBjbGFzcz1cIm1lbnRpb24tc3VnZ2VzdGlvblwiXG4gICAgICAgICAgKG1vdXNlZG93bik9XCIkZXZlbnQucHJldmVudERlZmF1bHQoKVwiXG4gICAgICAgICAgKGNsaWNrKT1cImluc2VydE1lbnRpb24ob3B0aW9uKVwiXG4gICAgICAgID5cbiAgICAgICAgICA8c3BhbiBjbGFzcz1cIm1lbnRpb24tYXZhdGFyXCI+JiM2NDs8L3NwYW4+XG4gICAgICAgICAgPHNwYW4+e3sgb3B0aW9uLmxhYmVsIH19PC9zcGFuPlxuICAgICAgICAgIDxzbWFsbD4mIzY0O3t7IG9wdGlvbi50b2tlbiB9fTwvc21hbGw+XG4gICAgICAgIDwvYnV0dG9uPlxuICAgICAgPC9kaXY+XG5cbiAgICAgIDxkaXYgKm5nSWY9XCJkZXRlY3RlZENvZGVMYW5ndWFnZSAmJiAhY29kZURldGVjdGlvbkRpc21pc3NlZFwiIGNsYXNzPVwiY29kZS1kZXRlY3Rpb24tY2hpcFwiPlxuICAgICAgICA8bWF0LWljb24+Y29kZTwvbWF0LWljb24+XG4gICAgICAgIDxzcGFuPkxvb2tzIGxpa2Uge3sgZGV0ZWN0ZWRDb2RlTGFuZ3VhZ2UgfX0gY29kZTwvc3Bhbj5cbiAgICAgICAgPGJ1dHRvblxuICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxuICAgICAgICAgIGNsYXNzPVwiY29kZS1kZXRlY3Rpb24tY2xvc2VcIlxuICAgICAgICAgIChjbGljayk9XCJkaXNtaXNzQ29kZURldGVjdGlvbigpXCJcbiAgICAgICAgICB0aXRsZT1cIlNlbmQgYXMgbm9ybWFsIHRleHRcIlxuICAgICAgICA+XG4gICAgICAgICAgPG1hdC1pY29uPmNsb3NlPC9tYXQtaWNvbj5cbiAgICAgICAgPC9idXR0b24+XG4gICAgICA8L2Rpdj5cblxuICAgICAgPGRpdiBjbGFzcz1cImlucHV0LXdyYXBwZXJcIj5cbiAgICAgICAgPGJ1dHRvbiBtYXQtaWNvbi1idXR0b24gY2xhc3M9XCJhdHRhY2gtYnRuXCIgKGNsaWNrKT1cImZpbGVJbnB1dC5jbGljaygpXCIgdGl0bGU9XCJBdHRhY2ggZmlsZXNcIj5cbiAgICAgICAgICA8bWF0LWljb24+YXR0YWNoX2ZpbGU8L21hdC1pY29uPlxuICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgPGlucHV0XG4gICAgICAgICAgI2ZpbGVJbnB1dFxuICAgICAgICAgIHR5cGU9XCJmaWxlXCJcbiAgICAgICAgICBtdWx0aXBsZVxuICAgICAgICAgIHN0eWxlPVwiZGlzcGxheTpub25lXCJcbiAgICAgICAgICAoY2hhbmdlKT1cIm9uRmlsZXNTZWxlY3RlZCgkZXZlbnQpXCJcbiAgICAgICAgLz5cbiAgICAgICAgPHRleHRhcmVhXG4gICAgICAgICAgI21lc3NhZ2VUZXh0YXJlYVxuICAgICAgICAgIFtuZ01vZGVsXT1cIm1lc3NhZ2VUZXh0XCJcbiAgICAgICAgICAobmdNb2RlbENoYW5nZSk9XCJvblRleHRDaGFuZ2UoJGV2ZW50KVwiXG4gICAgICAgICAgKGlucHV0KT1cImF1dG9SZXNpemUoKVwiXG4gICAgICAgICAgKHBhc3RlKT1cIm9uUGFzdGUoJGV2ZW50KVwiXG4gICAgICAgICAgKGNsaWNrKT1cInVwZGF0ZU1lbnRpb25TdWdnZXN0aW9ucygpXCJcbiAgICAgICAgICAoa2V5dXApPVwidXBkYXRlTWVudGlvblN1Z2dlc3Rpb25zKClcIlxuICAgICAgICAgIChrZXlkb3duKT1cIm9uS2V5ZG93bigkZXZlbnQpXCJcbiAgICAgICAgICBwbGFjZWhvbGRlcj1cIlR5cGUgYSBtZXNzYWdlLi4uXCJcbiAgICAgICAgICByb3dzPVwiMVwiXG4gICAgICAgICAgY2xhc3M9XCJtZXNzYWdlLXRleHRhcmVhXCJcbiAgICAgICAgICBbc3R5bGUuaGVpZ2h0LnB4XT1cInRleHRhcmVhSGVpZ2h0XCJcbiAgICAgICAgPjwvdGV4dGFyZWE+XG4gICAgICAgIDxidXR0b25cbiAgICAgICAgICBtYXQtaWNvbi1idXR0b25cbiAgICAgICAgICBjbGFzcz1cInNlbmQtYnRuXCJcbiAgICAgICAgICBbZGlzYWJsZWRdPVwiIWNhblNlbmRcIlxuICAgICAgICAgIChjbGljayk9XCJzZW5kKClcIlxuICAgICAgICA+XG4gICAgICAgICAgPG1hdC1pY29uPnNlbmQ8L21hdC1pY29uPlxuICAgICAgICA8L2J1dHRvbj5cbiAgICAgIDwvZGl2PlxuXG4gICAgPC9kaXY+XG4gIGAsXG4gIHN0eWxlczogW2BcbiAgICAubWVzc2FnZS1pbnB1dC1jb250YWluZXIge1xuICAgICAgcGFkZGluZzogOHB4IDEycHg7XG4gICAgICBib3JkZXItdG9wOiAxcHggc29saWQgcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjE1KTtcbiAgICAgIGJhY2tncm91bmQ6IHRyYW5zcGFyZW50O1xuICAgICAgcG9zaXRpb246IHJlbGF0aXZlO1xuICAgIH1cblxuICAgIC5pbnB1dC1yZXNpemUtaGFuZGxlIHtcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgIHRvcDogLTVweDtcbiAgICAgIGxlZnQ6IDA7XG4gICAgICByaWdodDogMDtcbiAgICAgIGhlaWdodDogMTBweDtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgICBjdXJzb3I6IG5zLXJlc2l6ZTtcbiAgICAgIHotaW5kZXg6IDI7XG4gICAgfVxuXG4gICAgLmlucHV0LXJlc2l6ZS1oYW5kbGUgc3BhbiB7XG4gICAgICB3aWR0aDogNDJweDtcbiAgICAgIGhlaWdodDogM3B4O1xuICAgICAgYm9yZGVyLXJhZGl1czogOTk5cHg7XG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMjIpO1xuICAgICAgdHJhbnNpdGlvbjogYmFja2dyb3VuZCAwLjE1cywgd2lkdGggMC4xNXM7XG4gICAgfVxuXG4gICAgLmlucHV0LXJlc2l6ZS1oYW5kbGU6aG92ZXIgc3BhbiB7XG4gICAgICB3aWR0aDogNTZweDtcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC40Mik7XG4gICAgfVxuXG4gICAgLmZpbGUtcHJldmlld3Mge1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGZsZXgtd3JhcDogd3JhcDtcbiAgICAgIGdhcDogNnB4O1xuICAgICAgbWFyZ2luLWJvdHRvbTogOHB4O1xuICAgICAgbWF4LWhlaWdodDogODBweDtcbiAgICAgIG92ZXJmbG93LXk6IGF1dG87XG4gICAgfVxuXG4gICAgLnJlcGx5LWNvbXBvc2UtcHJldmlldyB7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGdhcDogOHB4O1xuICAgICAgbWFyZ2luLWJvdHRvbTogOHB4O1xuICAgICAgcGFkZGluZzogOHB4IDEwcHg7XG4gICAgICBib3JkZXItcmFkaXVzOiAxMnB4O1xuICAgICAgYmFja2dyb3VuZDogcmdiYSgxMjcsIDE4MCwgMjU1LCAwLjEyKTtcbiAgICAgIGJvcmRlci1sZWZ0OiAzcHggc29saWQgcmdiYSgxMjcsIDE4MCwgMjU1LCAwLjgpO1xuICAgICAgY29sb3I6ICNmZmY7XG4gICAgfVxuXG4gICAgLnJlcGx5LWNvbXBvc2UtcHJldmlldyA+IG1hdC1pY29uIHtcbiAgICAgIGNvbG9yOiAjYmZkYmZlO1xuICAgICAgZm9udC1zaXplOiAxOHB4O1xuICAgICAgd2lkdGg6IDE4cHg7XG4gICAgICBoZWlnaHQ6IDE4cHg7XG4gICAgICBmbGV4LXNocmluazogMDtcbiAgICB9XG5cbiAgICAucmVwbHktY29tcG9zZS10ZXh0IHtcbiAgICAgIG1pbi13aWR0aDogMDtcbiAgICAgIGZsZXg6IDE7XG4gICAgfVxuXG4gICAgLnJlcGx5LWNvbXBvc2UtdGV4dCBzcGFuIHtcbiAgICAgIGRpc3BsYXk6IGJsb2NrO1xuICAgICAgZm9udC1zaXplOiAxMXB4O1xuICAgICAgZm9udC13ZWlnaHQ6IDcwMDtcbiAgICAgIGNvbG9yOiAjYmZkYmZlO1xuICAgICAgbWFyZ2luLWJvdHRvbTogMnB4O1xuICAgIH1cblxuICAgIC5yZXBseS1jb21wb3NlLXRleHQgcCB7XG4gICAgICBtYXJnaW46IDA7XG4gICAgICBmb250LXNpemU6IDEycHg7XG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjc4KTtcbiAgICAgIHdoaXRlLXNwYWNlOiBub3dyYXA7XG4gICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgdGV4dC1vdmVyZmxvdzogZWxsaXBzaXM7XG4gICAgfVxuXG4gICAgLnJlcGx5LWNhbmNlbC1idG4ge1xuICAgICAgd2lkdGg6IDI0cHg7XG4gICAgICBoZWlnaHQ6IDI0cHg7XG4gICAgICBib3JkZXI6IG5vbmU7XG4gICAgICBib3JkZXItcmFkaXVzOiA5OTlweDtcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4wOCk7XG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjgpO1xuICAgICAgZGlzcGxheTogaW5saW5lLWZsZXg7XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgICBwYWRkaW5nOiAwO1xuICAgICAgY3Vyc29yOiBwb2ludGVyO1xuICAgICAgZmxleC1zaHJpbms6IDA7XG4gICAgfVxuXG4gICAgLnJlcGx5LWNhbmNlbC1idG4gbWF0LWljb24ge1xuICAgICAgZm9udC1zaXplOiAxNnB4O1xuICAgICAgd2lkdGg6IDE2cHg7XG4gICAgICBoZWlnaHQ6IDE2cHg7XG4gICAgfVxuXG4gICAgLm1lbnRpb24tc3VnZ2VzdGlvbnMge1xuICAgICAgbWFyZ2luLWJvdHRvbTogOHB4O1xuICAgICAgYm9yZGVyLXJhZGl1czogMTJweDtcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICBiYWNrZ3JvdW5kOiAjMDcxZDMwO1xuICAgICAgYm9yZGVyOiAxcHggc29saWQgcmdiYSgxMjcsIDE4MCwgMjU1LCAwLjIyKTtcbiAgICAgIGJveC1zaGFkb3c6IDAgMTBweCAyNHB4IHJnYmEoMCwgMCwgMCwgMC4yNCk7XG4gICAgfVxuXG4gICAgLm1lbnRpb24tc3VnZ2VzdGlvbiB7XG4gICAgICB3aWR0aDogMTAwJTtcbiAgICAgIGJvcmRlcjogbm9uZTtcbiAgICAgIGJhY2tncm91bmQ6IHRyYW5zcGFyZW50O1xuICAgICAgY29sb3I6ICNmZmY7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGdhcDogOHB4O1xuICAgICAgcGFkZGluZzogOHB4IDEwcHg7XG4gICAgICBjdXJzb3I6IHBvaW50ZXI7XG4gICAgICB0ZXh0LWFsaWduOiBsZWZ0O1xuICAgIH1cblxuICAgIC5tZW50aW9uLXN1Z2dlc3Rpb246aG92ZXIsXG4gICAgLm1lbnRpb24tc3VnZ2VzdGlvbjpmb2N1cyB7XG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDEyNywgMTgwLCAyNTUsIDAuMTQpO1xuICAgICAgb3V0bGluZTogbm9uZTtcbiAgICB9XG5cbiAgICAubWVudGlvbi1hdmF0YXIge1xuICAgICAgd2lkdGg6IDIycHg7XG4gICAgICBoZWlnaHQ6IDIycHg7XG4gICAgICBib3JkZXItcmFkaXVzOiA5OTlweDtcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMTI3LCAxODAsIDI1NSwgMC4yMik7XG4gICAgICBjb2xvcjogI2JmZGJmZTtcbiAgICAgIGRpc3BsYXk6IGlubGluZS1mbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgICAgZm9udC1zaXplOiAxMnB4O1xuICAgICAgZm9udC13ZWlnaHQ6IDgwMDtcbiAgICAgIGZsZXgtc2hyaW5rOiAwO1xuICAgIH1cblxuICAgIC5tZW50aW9uLXN1Z2dlc3Rpb24gc21hbGwge1xuICAgICAgbWFyZ2luLWxlZnQ6IGF1dG87XG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjUyKTtcbiAgICAgIGZvbnQtc2l6ZTogMTFweDtcbiAgICB9XG5cbiAgICAuY29kZS1kZXRlY3Rpb24tY2hpcCB7XG4gICAgICBkaXNwbGF5OiBpbmxpbmUtZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBnYXA6IDdweDtcbiAgICAgIG1hcmdpbi1ib3R0b206IDhweDtcbiAgICAgIHBhZGRpbmc6IDZweCA4cHg7XG4gICAgICBib3JkZXItcmFkaXVzOiA5OTlweDtcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMTI3LCAxODAsIDI1NSwgMC4xNCk7XG4gICAgICBib3JkZXI6IDFweCBzb2xpZCByZ2JhKDEyNywgMTgwLCAyNTUsIDAuMzIpO1xuICAgICAgY29sb3I6ICNiZmRiZmU7XG4gICAgICBmb250LXNpemU6IDEycHg7XG4gICAgICBmb250LXdlaWdodDogNzAwO1xuICAgIH1cblxuICAgIC5jb2RlLWRldGVjdGlvbi1jaGlwID4gbWF0LWljb24ge1xuICAgICAgZm9udC1zaXplOiAxNXB4O1xuICAgICAgd2lkdGg6IDE1cHg7XG4gICAgICBoZWlnaHQ6IDE1cHg7XG4gICAgfVxuXG4gICAgLmNvZGUtZGV0ZWN0aW9uLWNsb3NlIHtcbiAgICAgIHdpZHRoOiAyMHB4O1xuICAgICAgaGVpZ2h0OiAyMHB4O1xuICAgICAgYm9yZGVyOiBub25lO1xuICAgICAgYm9yZGVyLXJhZGl1czogOTk5cHg7XG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMDgpO1xuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC44Mik7XG4gICAgICBkaXNwbGF5OiBpbmxpbmUtZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgIHBhZGRpbmc6IDA7XG4gICAgICBjdXJzb3I6IHBvaW50ZXI7XG4gICAgfVxuXG4gICAgLmNvZGUtZGV0ZWN0aW9uLWNsb3NlIG1hdC1pY29uIHtcbiAgICAgIGZvbnQtc2l6ZTogMTRweDtcbiAgICAgIHdpZHRoOiAxNHB4O1xuICAgICAgaGVpZ2h0OiAxNHB4O1xuICAgIH1cblxuICAgIC5maWxlLWNoaXAge1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBnYXA6IDRweDtcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xNSk7XG4gICAgICBib3JkZXItcmFkaXVzOiA4cHg7XG4gICAgICBwYWRkaW5nOiA0cHggNHB4IDRweCA4cHg7XG4gICAgICBtYXgtd2lkdGg6IDIwMHB4O1xuICAgIH1cblxuICAgIC5maWxlLWljb24ge1xuICAgICAgZm9udC1zaXplOiAxNnB4O1xuICAgICAgd2lkdGg6IDE2cHg7XG4gICAgICBoZWlnaHQ6IDE2cHg7XG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjgpO1xuICAgIH1cblxuICAgIC5maWxlLW5hbWUge1xuICAgICAgZm9udC1zaXplOiAxMnB4O1xuICAgICAgY29sb3I6ICNmZmY7XG4gICAgICB3aGl0ZS1zcGFjZTogbm93cmFwO1xuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICAgIHRleHQtb3ZlcmZsb3c6IGVsbGlwc2lzO1xuICAgICAgbWF4LXdpZHRoOiAxMDBweDtcbiAgICB9XG5cbiAgICAuZmlsZS1zaXplIHtcbiAgICAgIGZvbnQtc2l6ZTogMTBweDtcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNSk7XG4gICAgICBmbGV4LXNocmluazogMDtcbiAgICB9XG5cbiAgICAuZmlsZS1yZW1vdmUge1xuICAgICAgd2lkdGg6IDIwcHggIWltcG9ydGFudDtcbiAgICAgIGhlaWdodDogMjBweCAhaW1wb3J0YW50O1xuICAgIH1cblxuICAgIC5maWxlLXJlbW92ZSBtYXQtaWNvbiB7XG4gICAgICBmb250LXNpemU6IDE0cHg7XG4gICAgICB3aWR0aDogMTRweDtcbiAgICAgIGhlaWdodDogMTRweDtcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNik7XG4gICAgfVxuXG4gICAgLmlucHV0LXdyYXBwZXIge1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBmbGV4LWVuZDtcbiAgICAgIGdhcDogNHB4O1xuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjEpO1xuICAgICAgYm9yZGVyLXJhZGl1czogMjRweDtcbiAgICAgIHBhZGRpbmc6IDJweCA0cHg7XG4gICAgfVxuXG4gICAgLmF0dGFjaC1idG4sXG4gICAgLnNlbmQtYnRuIHtcbiAgICAgIGZsZXgtc2hyaW5rOiAwO1xuICAgICAgd2lkdGg6IDM2cHg7XG4gICAgICBoZWlnaHQ6IDM2cHg7XG4gICAgICBwYWRkaW5nOiAwICFpbXBvcnRhbnQ7XG4gICAgICBtYXJnaW46IDA7XG4gICAgICBtaW4td2lkdGg6IDM2cHggIWltcG9ydGFudDtcbiAgICAgIGRpc3BsYXk6IGlubGluZS1mbGV4ICFpbXBvcnRhbnQ7XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyICFpbXBvcnRhbnQ7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlciAhaW1wb3J0YW50O1xuICAgICAgbGluZS1oZWlnaHQ6IDAgIWltcG9ydGFudDtcbiAgICB9XG5cbiAgICAuYXR0YWNoLWJ0biBtYXQtaWNvbixcbiAgICAuc2VuZC1idG4gbWF0LWljb24ge1xuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC43KTtcbiAgICAgIGZvbnQtc2l6ZTogMjBweDtcbiAgICAgIHdpZHRoOiAyMHB4O1xuICAgICAgaGVpZ2h0OiAyMHB4O1xuICAgICAgbGluZS1oZWlnaHQ6IDIwcHg7XG4gICAgICBtYXJnaW46IDA7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgIH1cblxuICAgIC5zZW5kLWJ0biBtYXQtaWNvbiB7XG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjkpO1xuICAgIH1cblxuICAgIC5tZXNzYWdlLXRleHRhcmVhIHtcbiAgICAgIGZsZXg6IDE7XG4gICAgICBib3JkZXI6IG5vbmU7XG4gICAgICBvdXRsaW5lOiBub25lO1xuICAgICAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQ7XG4gICAgICByZXNpemU6IG5vbmU7XG4gICAgICBmb250LXNpemU6IDE0cHg7XG4gICAgICBmb250LWZhbWlseTogaW5oZXJpdDtcbiAgICAgIGxpbmUtaGVpZ2h0OiAxLjU7XG4gICAgICBtaW4taGVpZ2h0OiAyNHB4O1xuICAgICAgbWF4LWhlaWdodDogMTgwcHg7XG4gICAgICBwYWRkaW5nOiA3cHggMDtcbiAgICAgIGNvbG9yOiAjZmZmO1xuICAgICAgb3ZlcmZsb3cteTogaGlkZGVuO1xuICAgICAgYm94LXNpemluZzogYm9yZGVyLWJveDtcbiAgICB9XG5cbiAgICAubWVzc2FnZS10ZXh0YXJlYTo6cGxhY2Vob2xkZXIge1xuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC41KTtcbiAgICB9XG5cbiAgICAuc2VuZC1idG46ZGlzYWJsZWQgbWF0LWljb24ge1xuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4zKTtcbiAgICB9XG5cbiAgICAvKiBNREMgbWF0LWljb24tYnV0dG9uIGlubmVyIHdyYXBwZXIgb2Z0ZW4gc2hpZnRzIGdseXBocyBkb3dud2FyZCB3aXRob3V0IHRoaXMgKi9cbiAgICA6aG9zdCA6Om5nLWRlZXAgLmF0dGFjaC1idG4gLm1hdC1tZGMtYnV0dG9uLXRvdWNoLXRhcmdldCxcbiAgICA6aG9zdCA6Om5nLWRlZXAgLnNlbmQtYnRuIC5tYXQtbWRjLWJ1dHRvbi10b3VjaC10YXJnZXQge1xuICAgICAgaGVpZ2h0OiAzNnB4ICFpbXBvcnRhbnQ7XG4gICAgICB3aWR0aDogMzZweCAhaW1wb3J0YW50O1xuICAgIH1cblxuICAgIDpob3N0IDo6bmctZGVlcCAuYXR0YWNoLWJ0biAubWRjLWljb24tYnV0dG9uX19pY29uLFxuICAgIDpob3N0IDo6bmctZGVlcCAuc2VuZC1idG4gLm1kYy1pY29uLWJ1dHRvbl9faWNvbiB7XG4gICAgICBkaXNwbGF5OiBmbGV4ICFpbXBvcnRhbnQ7XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyICFpbXBvcnRhbnQ7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlciAhaW1wb3J0YW50O1xuICAgICAgbWFyZ2luOiAwICFpbXBvcnRhbnQ7XG4gICAgICBwYWRkaW5nOiAwICFpbXBvcnRhbnQ7XG4gICAgfVxuXG4gIGBdLFxufSlcbmV4cG9ydCBjbGFzcyBNZXNzYWdlSW5wdXRDb21wb25lbnQgaW1wbGVtZW50cyBPbkNoYW5nZXMsIEFmdGVyVmlld0luaXQsIE9uRGVzdHJveSB7XG4gIEBJbnB1dCgpIGNvbnZlcnNhdGlvbklkOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcbiAgQElucHV0KCkgcmVwbHlUbzogUmVwbHlQcmV2aWV3IHwgbnVsbCA9IG51bGw7XG4gIEBJbnB1dCgpIGVuYWJsZU1lbnRpb25zID0gZmFsc2U7XG4gIEBJbnB1dCgpIG1lbnRpb25PcHRpb25zOiBNZW50aW9uT3B0aW9uW10gPSBbXTtcbiAgQE91dHB1dCgpIG1lc3NhZ2VTZW50ID0gbmV3IEV2ZW50RW1pdHRlcjxNZXNzYWdlVGV4dFBheWxvYWQ+KCk7XG4gIEBPdXRwdXQoKSBtZXNzYWdlV2l0aEZpbGVzID0gbmV3IEV2ZW50RW1pdHRlcjxNZXNzYWdlUGF5bG9hZD4oKTtcbiAgQE91dHB1dCgpIHJlcGx5Q2FuY2VsbGVkID0gbmV3IEV2ZW50RW1pdHRlcjx2b2lkPigpO1xuICBAVmlld0NoaWxkKCdmaWxlSW5wdXQnKSBmaWxlSW5wdXQhOiBFbGVtZW50UmVmPEhUTUxJbnB1dEVsZW1lbnQ+O1xuICBAVmlld0NoaWxkKCdtZXNzYWdlVGV4dGFyZWEnKSBtZXNzYWdlVGV4dGFyZWEhOiBFbGVtZW50UmVmPEhUTUxUZXh0QXJlYUVsZW1lbnQ+O1xuXG4gIG1lc3NhZ2VUZXh0ID0gJyc7XG4gIHNlbGVjdGVkRmlsZXM6IEZpbGVbXSA9IFtdO1xuICB0ZXh0YXJlYUhlaWdodCA9IDM2O1xuICBtZW50aW9uU3VnZ2VzdGlvbnM6IE1lbnRpb25PcHRpb25bXSA9IFtdO1xuICBkZXRlY3RlZENvZGVMYW5ndWFnZTogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG4gIGNvZGVEZXRlY3Rpb25EaXNtaXNzZWQgPSBmYWxzZTtcbiAgcHJpdmF0ZSByZWFkb25seSBkcmFmdFByZWZpeCA9ICdtZXNzYWdpbmdfZHJhZnRfJztcbiAgcHJpdmF0ZSBsYXN0Q29udmVyc2F0aW9uSWQ6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIHJlc2l6aW5nID0gZmFsc2U7XG4gIHByaXZhdGUgcmVzaXplU3RhcnRZID0gMDtcbiAgcHJpdmF0ZSByZXNpemVTdGFydEhlaWdodCA9IDA7XG4gIHByaXZhdGUgcmVhZG9ubHkgbWluVGV4dGFyZWFIZWlnaHQgPSAzNjtcbiAgcHJpdmF0ZSByZWFkb25seSBtYXhUZXh0YXJlYUhlaWdodCA9IDE4MDtcbiAgcHJpdmF0ZSBtYW51YWxUZXh0YXJlYUhlaWdodCA9IHRoaXMubWluVGV4dGFyZWFIZWlnaHQ7XG4gIHByaXZhdGUgYWN0aXZlTWVudGlvblN0YXJ0ID0gLTE7XG4gIHByaXZhdGUgYWN0aXZlTWVudGlvbkVuZCA9IC0xO1xuICBwcml2YXRlIGJvdW5kUmVzaXplTW92ZSA9IHRoaXMub25SZXNpemVNb3ZlLmJpbmQodGhpcyk7XG4gIHByaXZhdGUgYm91bmRSZXNpemVFbmQgPSB0aGlzLm9uUmVzaXplRW5kLmJpbmQodGhpcyk7XG5cbiAgbmdPbkNoYW5nZXMoY2hhbmdlczogU2ltcGxlQ2hhbmdlcyk6IHZvaWQge1xuICAgIGlmICghY2hhbmdlc1snY29udmVyc2F0aW9uSWQnXSkgcmV0dXJuO1xuICAgIGlmICh0aGlzLmxhc3RDb252ZXJzYXRpb25JZCAmJiB0aGlzLmxhc3RDb252ZXJzYXRpb25JZCAhPT0gdGhpcy5jb252ZXJzYXRpb25JZCkge1xuICAgICAgdGhpcy5wZXJzaXN0RHJhZnQodGhpcy5sYXN0Q29udmVyc2F0aW9uSWQsIHRoaXMubWVzc2FnZVRleHQpO1xuICAgIH1cbiAgICB0aGlzLmxhc3RDb252ZXJzYXRpb25JZCA9IHRoaXMuY29udmVyc2F0aW9uSWQ7XG4gICAgdGhpcy5tZXNzYWdlVGV4dCA9IHRoaXMubG9hZERyYWZ0KHRoaXMuY29udmVyc2F0aW9uSWQpO1xuICAgIHRoaXMudXBkYXRlQ29kZURldGVjdGlvbih0aGlzLm1lc3NhZ2VUZXh0KTtcbiAgICB0aGlzLnF1ZXVlQXV0b1Jlc2l6ZSgpO1xuICB9XG5cbiAgbmdBZnRlclZpZXdJbml0KCk6IHZvaWQge1xuICAgIHRoaXMucXVldWVBdXRvUmVzaXplKCk7XG4gIH1cblxuICBuZ09uRGVzdHJveSgpOiB2b2lkIHtcbiAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCB0aGlzLmJvdW5kUmVzaXplTW92ZSk7XG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIHRoaXMuYm91bmRSZXNpemVFbmQpO1xuICAgIGRvY3VtZW50LmJvZHkuc3R5bGUuY3Vyc29yID0gJyc7XG4gICAgZG9jdW1lbnQuYm9keS5zdHlsZS51c2VyU2VsZWN0ID0gJyc7XG4gIH1cblxuICBnZXQgY2FuU2VuZCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy5tZXNzYWdlVGV4dC50cmltKCkubGVuZ3RoID4gMCB8fCB0aGlzLnNlbGVjdGVkRmlsZXMubGVuZ3RoID4gMDtcbiAgfVxuXG4gIHNlbmQoKTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLmNhblNlbmQpIHJldHVybjtcbiAgICBjb25zdCB0ZXh0ID0gdGhpcy5tZXNzYWdlVGV4dC50cmltKCk7XG4gICAgY29uc3QgZm9yY2VQbGFpblRleHQgPSAhIXRoaXMuZGV0ZWN0ZWRDb2RlTGFuZ3VhZ2UgJiYgdGhpcy5jb2RlRGV0ZWN0aW9uRGlzbWlzc2VkO1xuXG4gICAgaWYgKHRoaXMuc2VsZWN0ZWRGaWxlcy5sZW5ndGggPiAwKSB7XG4gICAgICB0aGlzLm1lc3NhZ2VXaXRoRmlsZXMuZW1pdCh7IHRleHQsIGZpbGVzOiBbLi4udGhpcy5zZWxlY3RlZEZpbGVzXSwgZm9yY2VQbGFpblRleHQgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMubWVzc2FnZVNlbnQuZW1pdCh7IHRleHQsIGZvcmNlUGxhaW5UZXh0IH0pO1xuICAgIH1cblxuICAgIHRoaXMubWVzc2FnZVRleHQgPSAnJztcbiAgICB0aGlzLnNlbGVjdGVkRmlsZXMgPSBbXTtcbiAgICB0aGlzLm1lbnRpb25TdWdnZXN0aW9ucyA9IFtdO1xuICAgIHRoaXMuZGV0ZWN0ZWRDb2RlTGFuZ3VhZ2UgPSBudWxsO1xuICAgIHRoaXMuY29kZURldGVjdGlvbkRpc21pc3NlZCA9IGZhbHNlO1xuICAgIHRoaXMubWFudWFsVGV4dGFyZWFIZWlnaHQgPSB0aGlzLm1pblRleHRhcmVhSGVpZ2h0O1xuICAgIHRoaXMuY2xlYXJEcmFmdCh0aGlzLmNvbnZlcnNhdGlvbklkKTtcbiAgICBpZiAodGhpcy5maWxlSW5wdXQpIHRoaXMuZmlsZUlucHV0Lm5hdGl2ZUVsZW1lbnQudmFsdWUgPSAnJztcbiAgICB0aGlzLnF1ZXVlQXV0b1Jlc2l6ZSgpO1xuICB9XG5cbiAgb25UZXh0Q2hhbmdlKHZhbHVlOiBzdHJpbmcpOiB2b2lkIHtcbiAgICB0aGlzLm1lc3NhZ2VUZXh0ID0gdmFsdWU7XG4gICAgdGhpcy5wZXJzaXN0RHJhZnQodGhpcy5jb252ZXJzYXRpb25JZCwgdmFsdWUpO1xuICAgIHRoaXMudXBkYXRlTWVudGlvblN1Z2dlc3Rpb25zKCk7XG4gICAgdGhpcy51cGRhdGVDb2RlRGV0ZWN0aW9uKHZhbHVlKTtcbiAgICB0aGlzLnF1ZXVlQXV0b1Jlc2l6ZSgpO1xuICB9XG5cbiAgb25QYXN0ZShldmVudDogQ2xpcGJvYXJkRXZlbnQpOiB2b2lkIHtcbiAgICBjb25zdCBjbGlwYm9hcmRJdGVtcyA9IEFycmF5LmZyb20oZXZlbnQuY2xpcGJvYXJkRGF0YT8uaXRlbXMgfHwgW10pO1xuICAgIGNvbnN0IGltYWdlRmlsZXMgPSBjbGlwYm9hcmRJdGVtc1xuICAgICAgLmZpbHRlcigoaXRlbSkgPT4gaXRlbS5raW5kID09PSAnZmlsZScgJiYgaXRlbS50eXBlLnN0YXJ0c1dpdGgoJ2ltYWdlLycpKVxuICAgICAgLm1hcCgoaXRlbSkgPT4gaXRlbS5nZXRBc0ZpbGUoKSlcbiAgICAgIC5maWx0ZXIoKGZpbGUpOiBmaWxlIGlzIEZpbGUgPT4gISFmaWxlKVxuICAgICAgLm1hcCgoZmlsZSkgPT4gdGhpcy5uYW1lQ2xpcGJvYXJkSW1hZ2UoZmlsZSkpO1xuXG4gICAgaWYgKGltYWdlRmlsZXMubGVuZ3RoID4gMCkge1xuICAgICAgdGhpcy5hZGRGaWxlcyhpbWFnZUZpbGVzKTtcbiAgICAgIGNvbnN0IHRleHQgPSBldmVudC5jbGlwYm9hcmREYXRhPy5nZXREYXRhKCd0ZXh0L3BsYWluJykgfHwgJyc7XG4gICAgICBpZiAoIXRleHQudHJpbSgpKSB7XG4gICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgaHRtbCA9IGV2ZW50LmNsaXBib2FyZERhdGE/LmdldERhdGEoJ3RleHQvaHRtbCcpIHx8ICcnO1xuICAgIGlmICghaHRtbCB8fCAhLzx0YWJsZVtcXHM+XS9pLnRlc3QoaHRtbCkpIHJldHVybjtcblxuICAgIGNvbnN0IHRhYmxlVGV4dCA9IHRoaXMuaHRtbFRhYmxlVG9UZXh0KGh0bWwpO1xuICAgIGlmICghdGFibGVUZXh0KSByZXR1cm47XG5cbiAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIHRoaXMuaW5zZXJ0VGV4dEF0Q3Vyc29yKHRhYmxlVGV4dCk7XG4gIH1cblxuICBhdXRvUmVzaXplKCk6IHZvaWQge1xuICAgIGNvbnN0IGVsID0gdGhpcy5tZXNzYWdlVGV4dGFyZWE/Lm5hdGl2ZUVsZW1lbnQ7XG4gICAgaWYgKCFlbCkgcmV0dXJuO1xuICAgIGVsLnN0eWxlLmhlaWdodCA9ICdhdXRvJztcbiAgICBjb25zdCBuZXh0SGVpZ2h0ID0gTWF0aC5taW4oXG4gICAgICBNYXRoLm1heChlbC5zY3JvbGxIZWlnaHQsIHRoaXMubWFudWFsVGV4dGFyZWFIZWlnaHQsIHRoaXMubWluVGV4dGFyZWFIZWlnaHQpLFxuICAgICAgdGhpcy5tYXhUZXh0YXJlYUhlaWdodFxuICAgICk7XG4gICAgdGhpcy50ZXh0YXJlYUhlaWdodCA9IG5leHRIZWlnaHQ7XG4gICAgZWwuc3R5bGUuaGVpZ2h0ID0gYCR7bmV4dEhlaWdodH1weGA7XG4gICAgZWwuc3R5bGUub3ZlcmZsb3dZID0gbmV4dEhlaWdodCA+PSB0aGlzLm1heFRleHRhcmVhSGVpZ2h0ID8gJ2F1dG8nIDogJ2hpZGRlbic7XG4gIH1cblxuICBvblJlc2l6ZVN0YXJ0KGV2ZW50OiBNb3VzZUV2ZW50KTogdm9pZCB7XG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICB0aGlzLnJlc2l6aW5nID0gdHJ1ZTtcbiAgICB0aGlzLnJlc2l6ZVN0YXJ0WSA9IGV2ZW50LmNsaWVudFk7XG4gICAgdGhpcy5yZXNpemVTdGFydEhlaWdodCA9IHRoaXMudGV4dGFyZWFIZWlnaHQ7XG4gICAgZG9jdW1lbnQuYm9keS5zdHlsZS5jdXJzb3IgPSAnbnMtcmVzaXplJztcbiAgICBkb2N1bWVudC5ib2R5LnN0eWxlLnVzZXJTZWxlY3QgPSAnbm9uZSc7XG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgdGhpcy5ib3VuZFJlc2l6ZU1vdmUpO1xuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCB0aGlzLmJvdW5kUmVzaXplRW5kKTtcbiAgfVxuXG4gIHByaXZhdGUgb25SZXNpemVNb3ZlKGV2ZW50OiBNb3VzZUV2ZW50KTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLnJlc2l6aW5nKSByZXR1cm47XG4gICAgY29uc3QgZHkgPSB0aGlzLnJlc2l6ZVN0YXJ0WSAtIGV2ZW50LmNsaWVudFk7XG4gICAgY29uc3QgbmV4dEhlaWdodCA9IE1hdGgubWF4KFxuICAgICAgdGhpcy5taW5UZXh0YXJlYUhlaWdodCxcbiAgICAgIE1hdGgubWluKHRoaXMubWF4VGV4dGFyZWFIZWlnaHQsIHRoaXMucmVzaXplU3RhcnRIZWlnaHQgKyBkeSlcbiAgICApO1xuICAgIHRoaXMubWFudWFsVGV4dGFyZWFIZWlnaHQgPSBuZXh0SGVpZ2h0O1xuICAgIHRoaXMudGV4dGFyZWFIZWlnaHQgPSBuZXh0SGVpZ2h0O1xuICB9XG5cbiAgcHJpdmF0ZSBvblJlc2l6ZUVuZCgpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMucmVzaXppbmcpIHJldHVybjtcbiAgICB0aGlzLnJlc2l6aW5nID0gZmFsc2U7XG4gICAgZG9jdW1lbnQuYm9keS5zdHlsZS5jdXJzb3IgPSAnJztcbiAgICBkb2N1bWVudC5ib2R5LnN0eWxlLnVzZXJTZWxlY3QgPSAnJztcbiAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCB0aGlzLmJvdW5kUmVzaXplTW92ZSk7XG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIHRoaXMuYm91bmRSZXNpemVFbmQpO1xuICB9XG5cbiAgcHJpdmF0ZSBxdWV1ZUF1dG9SZXNpemUoKTogdm9pZCB7XG4gICAgc2V0VGltZW91dCgoKSA9PiB0aGlzLmF1dG9SZXNpemUoKSk7XG4gIH1cblxuICBwcml2YXRlIGRyYWZ0S2V5KGNvbnZlcnNhdGlvbklkOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIHJldHVybiBgJHt0aGlzLmRyYWZ0UHJlZml4fSR7Y29udmVyc2F0aW9uSWR9YDtcbiAgfVxuXG4gIHByaXZhdGUgbG9hZERyYWZ0KGNvbnZlcnNhdGlvbklkOiBzdHJpbmcgfCBudWxsKTogc3RyaW5nIHtcbiAgICBpZiAoIWNvbnZlcnNhdGlvbklkKSByZXR1cm4gJyc7XG4gICAgcmV0dXJuIGxvY2FsU3RvcmFnZS5nZXRJdGVtKHRoaXMuZHJhZnRLZXkoY29udmVyc2F0aW9uSWQpKSB8fCAnJztcbiAgfVxuXG4gIHByaXZhdGUgcGVyc2lzdERyYWZ0KGNvbnZlcnNhdGlvbklkOiBzdHJpbmcgfCBudWxsLCB2YWx1ZTogc3RyaW5nKTogdm9pZCB7XG4gICAgaWYgKCFjb252ZXJzYXRpb25JZCkgcmV0dXJuO1xuICAgIGNvbnN0IGtleSA9IHRoaXMuZHJhZnRLZXkoY29udmVyc2F0aW9uSWQpO1xuICAgIGlmICh2YWx1ZS50cmltKCkpIHtcbiAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKGtleSwgdmFsdWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbShrZXkpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgY2xlYXJEcmFmdChjb252ZXJzYXRpb25JZDogc3RyaW5nIHwgbnVsbCk6IHZvaWQge1xuICAgIGlmICghY29udmVyc2F0aW9uSWQpIHJldHVybjtcbiAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSh0aGlzLmRyYWZ0S2V5KGNvbnZlcnNhdGlvbklkKSk7XG4gIH1cblxuICBwcml2YXRlIGh0bWxUYWJsZVRvVGV4dChodG1sOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBkb2MgPSBuZXcgRE9NUGFyc2VyKCkucGFyc2VGcm9tU3RyaW5nKGh0bWwsICd0ZXh0L2h0bWwnKTtcbiAgICAgIGNvbnN0IHRhYmxlID0gZG9jLnF1ZXJ5U2VsZWN0b3IoJ3RhYmxlJyk7XG4gICAgICBpZiAoIXRhYmxlKSByZXR1cm4gJyc7XG5cbiAgICAgIGNvbnN0IHJvd3MgPSBBcnJheS5mcm9tKHRhYmxlLnF1ZXJ5U2VsZWN0b3JBbGwoJ3RyJykpO1xuICAgICAgcmV0dXJuIHJvd3NcbiAgICAgICAgLm1hcCgocm93KSA9PlxuICAgICAgICAgIEFycmF5LmZyb20ocm93LnF1ZXJ5U2VsZWN0b3JBbGwoJ3RoLHRkJykpXG4gICAgICAgICAgICAubWFwKChjZWxsKSA9PiAoY2VsbC50ZXh0Q29udGVudCB8fCAnJykucmVwbGFjZSgvXFxzKy9nLCAnICcpLnRyaW0oKSlcbiAgICAgICAgICAgIC5qb2luKCdcXHQnKVxuICAgICAgICApXG4gICAgICAgIC5maWx0ZXIoQm9vbGVhbilcbiAgICAgICAgLmpvaW4oJ1xcbicpO1xuICAgIH0gY2F0Y2gge1xuICAgICAgcmV0dXJuICcnO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgaW5zZXJ0VGV4dEF0Q3Vyc29yKHRleHQ6IHN0cmluZyk6IHZvaWQge1xuICAgIGNvbnN0IHRleHRhcmVhID0gdGhpcy5tZXNzYWdlVGV4dGFyZWE/Lm5hdGl2ZUVsZW1lbnQ7XG4gICAgaWYgKCF0ZXh0YXJlYSkge1xuICAgICAgdGhpcy5vblRleHRDaGFuZ2UoYCR7dGhpcy5tZXNzYWdlVGV4dH0ke3RleHR9YCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3Qgc3RhcnQgPSB0ZXh0YXJlYS5zZWxlY3Rpb25TdGFydCA/PyB0aGlzLm1lc3NhZ2VUZXh0Lmxlbmd0aDtcbiAgICBjb25zdCBlbmQgPSB0ZXh0YXJlYS5zZWxlY3Rpb25FbmQgPz8gdGhpcy5tZXNzYWdlVGV4dC5sZW5ndGg7XG4gICAgY29uc3QgbmV4dCA9IGAke3RoaXMubWVzc2FnZVRleHQuc2xpY2UoMCwgc3RhcnQpfSR7dGV4dH0ke3RoaXMubWVzc2FnZVRleHQuc2xpY2UoZW5kKX1gO1xuICAgIHRoaXMub25UZXh0Q2hhbmdlKG5leHQpO1xuICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgdGV4dGFyZWEuc2VsZWN0aW9uU3RhcnQgPSB0ZXh0YXJlYS5zZWxlY3Rpb25FbmQgPSBzdGFydCArIHRleHQubGVuZ3RoO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBuYW1lQ2xpcGJvYXJkSW1hZ2UoZmlsZTogRmlsZSk6IEZpbGUge1xuICAgIGNvbnN0IGV4dGVuc2lvbiA9IGZpbGUudHlwZS5zcGxpdCgnLycpWzFdPy5yZXBsYWNlKCdqcGVnJywgJ2pwZycpIHx8ICdwbmcnO1xuICAgIGNvbnN0IGZpbGVuYW1lID0gYGNsaXBib2FyZC1pbWFnZS0ke25ldyBEYXRlKCkudG9JU09TdHJpbmcoKS5yZXBsYWNlKC9bOi5dL2csICctJyl9LiR7ZXh0ZW5zaW9ufWA7XG4gICAgcmV0dXJuIG5ldyBGaWxlKFtmaWxlXSwgZmlsZW5hbWUsIHsgdHlwZTogZmlsZS50eXBlIHx8ICdpbWFnZS9wbmcnLCBsYXN0TW9kaWZpZWQ6IERhdGUubm93KCkgfSk7XG4gIH1cblxuICBmb2N1cygpOiB2b2lkIHtcbiAgICBzZXRUaW1lb3V0KCgpID0+IHRoaXMubWVzc2FnZVRleHRhcmVhPy5uYXRpdmVFbGVtZW50Py5mb2N1cygpKTtcbiAgfVxuXG4gIHVwZGF0ZU1lbnRpb25TdWdnZXN0aW9ucygpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMuZW5hYmxlTWVudGlvbnMgfHwgIXRoaXMubWVudGlvbk9wdGlvbnMubGVuZ3RoKSB7XG4gICAgICB0aGlzLm1lbnRpb25TdWdnZXN0aW9ucyA9IFtdO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHRleHRhcmVhID0gdGhpcy5tZXNzYWdlVGV4dGFyZWE/Lm5hdGl2ZUVsZW1lbnQ7XG4gICAgY29uc3QgY2FyZXQgPSB0ZXh0YXJlYT8uc2VsZWN0aW9uU3RhcnQgPz8gdGhpcy5tZXNzYWdlVGV4dC5sZW5ndGg7XG4gICAgY29uc3QgYmVmb3JlQ2FyZXQgPSB0aGlzLm1lc3NhZ2VUZXh0LnNsaWNlKDAsIGNhcmV0KTtcbiAgICBjb25zdCBtYXRjaCA9IGJlZm9yZUNhcmV0Lm1hdGNoKC8oXnxcXHMpQChbYS16QS1aMC05Ll8tXXswLDMyfSkkLyk7XG4gICAgaWYgKCFtYXRjaCkge1xuICAgICAgdGhpcy5tZW50aW9uU3VnZ2VzdGlvbnMgPSBbXTtcbiAgICAgIHRoaXMuYWN0aXZlTWVudGlvblN0YXJ0ID0gLTE7XG4gICAgICB0aGlzLmFjdGl2ZU1lbnRpb25FbmQgPSAtMTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBxdWVyeSA9IChtYXRjaFsyXSB8fCAnJykudG9Mb3dlckNhc2UoKTtcbiAgICB0aGlzLmFjdGl2ZU1lbnRpb25FbmQgPSBjYXJldDtcbiAgICB0aGlzLmFjdGl2ZU1lbnRpb25TdGFydCA9IGNhcmV0IC0gcXVlcnkubGVuZ3RoIC0gMTtcbiAgICB0aGlzLm1lbnRpb25TdWdnZXN0aW9ucyA9IHRoaXMubWVudGlvbk9wdGlvbnNcbiAgICAgIC5maWx0ZXIoKG9wdGlvbikgPT5cbiAgICAgICAgb3B0aW9uLnRva2VuLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMocXVlcnkpIHx8XG4gICAgICAgIG9wdGlvbi5sYWJlbC50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKHF1ZXJ5KVxuICAgICAgKVxuICAgICAgLnNsaWNlKDAsIDUpO1xuICB9XG5cbiAgaW5zZXJ0TWVudGlvbihvcHRpb246IE1lbnRpb25PcHRpb24pOiB2b2lkIHtcbiAgICBpZiAodGhpcy5hY3RpdmVNZW50aW9uU3RhcnQgPCAwKSByZXR1cm47XG4gICAgY29uc3Qgc3RhcnQgPSB0aGlzLmFjdGl2ZU1lbnRpb25TdGFydDtcbiAgICBjb25zdCBlbmQgPSB0aGlzLmFjdGl2ZU1lbnRpb25FbmQgPj0gc3RhcnQgPyB0aGlzLmFjdGl2ZU1lbnRpb25FbmQgOiB0aGlzLm1lc3NhZ2VUZXh0Lmxlbmd0aDtcbiAgICBjb25zdCBtZW50aW9uVGV4dCA9IGBAJHtvcHRpb24udG9rZW59IGA7XG4gICAgY29uc3QgbmV4dCA9IGAke3RoaXMubWVzc2FnZVRleHQuc2xpY2UoMCwgc3RhcnQpfSR7bWVudGlvblRleHR9JHt0aGlzLm1lc3NhZ2VUZXh0LnNsaWNlKGVuZCl9YDtcbiAgICB0aGlzLm9uVGV4dENoYW5nZShuZXh0KTtcbiAgICB0aGlzLm1lbnRpb25TdWdnZXN0aW9ucyA9IFtdO1xuICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgY29uc3QgdGV4dGFyZWEgPSB0aGlzLm1lc3NhZ2VUZXh0YXJlYT8ubmF0aXZlRWxlbWVudDtcbiAgICAgIGlmICghdGV4dGFyZWEpIHJldHVybjtcbiAgICAgIGNvbnN0IGNhcmV0ID0gc3RhcnQgKyBtZW50aW9uVGV4dC5sZW5ndGg7XG4gICAgICB0ZXh0YXJlYS5mb2N1cygpO1xuICAgICAgdGV4dGFyZWEuc2VsZWN0aW9uU3RhcnQgPSB0ZXh0YXJlYS5zZWxlY3Rpb25FbmQgPSBjYXJldDtcbiAgICAgIHRoaXMucXVldWVBdXRvUmVzaXplKCk7XG4gICAgfSk7XG4gIH1cblxuICBkaXNtaXNzQ29kZURldGVjdGlvbigpOiB2b2lkIHtcbiAgICB0aGlzLmNvZGVEZXRlY3Rpb25EaXNtaXNzZWQgPSB0cnVlO1xuICB9XG5cbiAgcHJpdmF0ZSB1cGRhdGVDb2RlRGV0ZWN0aW9uKHZhbHVlOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBjb25zdCBsYW5ndWFnZSA9IHRoaXMuZGV0ZWN0Q29kZUxhbmd1YWdlKHZhbHVlKTtcbiAgICBpZiAoIWxhbmd1YWdlKSB7XG4gICAgICB0aGlzLmRldGVjdGVkQ29kZUxhbmd1YWdlID0gbnVsbDtcbiAgICAgIHRoaXMuY29kZURldGVjdGlvbkRpc21pc3NlZCA9IGZhbHNlO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAobGFuZ3VhZ2UgIT09IHRoaXMuZGV0ZWN0ZWRDb2RlTGFuZ3VhZ2UpIHtcbiAgICAgIHRoaXMuY29kZURldGVjdGlvbkRpc21pc3NlZCA9IGZhbHNlO1xuICAgIH1cbiAgICB0aGlzLmRldGVjdGVkQ29kZUxhbmd1YWdlID0gbGFuZ3VhZ2U7XG4gIH1cblxuICBwcml2YXRlIGRldGVjdENvZGVMYW5ndWFnZSh2YWx1ZTogc3RyaW5nKTogc3RyaW5nIHwgbnVsbCB7XG4gICAgY29uc3QgdHJpbW1lZCA9IHZhbHVlLnRyaW0oKTtcbiAgICBpZiAoIXRyaW1tZWQgfHwgdGhpcy5sb29rc0xpa2VNYXJrZG93bih0cmltbWVkKSB8fCB0aGlzLmlzVGFibGVDb250ZW50KHRyaW1tZWQpKSByZXR1cm4gbnVsbDtcbiAgICBjb25zdCBmZW5jZWQgPSB0cmltbWVkLm1hdGNoKC9eYGBgKFthLXpBLVowLTlfKy1dKilcXHMqXFxuP1tcXHNcXFNdKj9gYGAkLyk7XG4gICAgaWYgKGZlbmNlZCkgcmV0dXJuIChmZW5jZWRbMV0gfHwgJ2NvZGUnKS50b0xvd2VyQ2FzZSgpO1xuICAgIGlmICghdHJpbW1lZC5pbmNsdWRlcygnXFxuJykgJiYgdHJpbW1lZC5sZW5ndGggPCA0MCkgcmV0dXJuIG51bGw7XG4gICAgaWYgKC9eXFxzKihzZWxlY3R8d2l0aHxpbnNlcnR8dXBkYXRlfGRlbGV0ZXxjcmVhdGV8YWx0ZXJ8ZHJvcClcXGIvaS50ZXN0KHRyaW1tZWQpKSByZXR1cm4gJ3NxbCc7XG4gICAgY29uc3QganNEZWNsYXJhdGlvbiA9IC9cXGIoZnVuY3Rpb258Y29uc3R8bGV0fHZhcilcXHMrW0EtWmEtel8kXVtcXHckXSpcXHMqKD18PT58XFwofDopLy50ZXN0KHRyaW1tZWQpO1xuICAgIGNvbnN0IGpzU3ludGF4ID0gLyg9Pnxjb25zb2xlXFwubG9nfGltcG9ydFxccysuKmZyb218ZXhwb3J0XFxzK3xbe307XSkvLnRlc3QodHJpbW1lZCk7XG4gICAgaWYgKGpzRGVjbGFyYXRpb24gfHwganNTeW50YXgpIHJldHVybiAnamF2YXNjcmlwdCc7XG4gICAgaWYgKC9cXGIoZGVmfGltcG9ydHxmcm9tfHByaW50fGNsYXNzKVxcYi8udGVzdCh0cmltbWVkKSAmJiAvOlxccyokfF5cXHN7NH0vbS50ZXN0KHRyaW1tZWQpKSByZXR1cm4gJ3B5dGhvbic7XG4gICAgaWYgKC88XFwvP1thLXpdW1xcc1xcU10qPi9pLnRlc3QodHJpbW1lZCkpIHJldHVybiAnaHRtbCc7XG4gICAgaWYgKC9be307XS8udGVzdCh0cmltbWVkKSAmJiAvWzo9XS8udGVzdCh0cmltbWVkKSkgcmV0dXJuICdjb2RlJztcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHByaXZhdGUgbG9va3NMaWtlTWFya2Rvd24oY29udGVudDogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIC8oXiN7MSw2fVxccyl8KF5bLSpdXFxzKXwoXlxcZCtcXC5cXHMpfChePlxccyl8KFxcKlxcKlteKl0rXFwqXFwqKXwoYFteYF0rYCl8KFxcW1teXFxdXStcXF1cXChbXildK1xcKSl8KF4tLS0kKXwoXi1cXHNcXFtbIHhdXFxdXFxzKXwoXmBgYFthLXpBLVowLTlfKy1dKlxccyokKS9tLnRlc3QoY29udGVudCk7XG4gIH1cblxuICBwcml2YXRlIGlzVGFibGVDb250ZW50KGNvbnRlbnQ6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIGlmICghY29udGVudC5pbmNsdWRlcygnXFx0JykpIHJldHVybiBmYWxzZTtcbiAgICBjb25zdCByb3dzID0gY29udGVudFxuICAgICAgLnNwbGl0KC9cXHI/XFxuLylcbiAgICAgIC5tYXAoKHJvdykgPT4gcm93LnNwbGl0KCdcXHQnKS5tYXAoKGNlbGwpID0+IGNlbGwudHJpbSgpKSlcbiAgICAgIC5maWx0ZXIoKHJvdykgPT4gcm93LnNvbWUoQm9vbGVhbikpO1xuICAgIHJldHVybiByb3dzLmxlbmd0aCA+PSAyICYmIHJvd3Muc29tZSgocm93KSA9PiByb3cubGVuZ3RoID49IDIpO1xuICB9XG5cbiAgb25LZXlkb3duKGV2ZW50OiBLZXlib2FyZEV2ZW50KTogdm9pZCB7XG4gICAgaWYgKGV2ZW50LmtleSA9PT0gJ0VzY2FwZScgJiYgdGhpcy5tZW50aW9uU3VnZ2VzdGlvbnMubGVuZ3RoID4gMCkge1xuICAgICAgdGhpcy5tZW50aW9uU3VnZ2VzdGlvbnMgPSBbXTtcbiAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKGV2ZW50LmtleSA9PT0gJ0VudGVyJyAmJiB0aGlzLm1lbnRpb25TdWdnZXN0aW9ucy5sZW5ndGggPiAwKSB7XG4gICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgdGhpcy5pbnNlcnRNZW50aW9uKHRoaXMubWVudGlvblN1Z2dlc3Rpb25zWzBdKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoZXZlbnQua2V5ID09PSAnRW50ZXInICYmICFldmVudC5zaGlmdEtleSkge1xuICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICAgIHRoaXMuc2VuZCgpO1xuICAgIH1cbiAgfVxuXG4gIG9uRW50ZXIoZXZlbnQ6IEV2ZW50KTogdm9pZCB7XG4gICAgY29uc3Qga2UgPSBldmVudCBhcyBLZXlib2FyZEV2ZW50O1xuICAgIGlmICgha2Uuc2hpZnRLZXkpIHtcbiAgICAgIGtlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICB0aGlzLnNlbmQoKTtcbiAgICB9XG4gIH1cblxuICBvbkZpbGVzU2VsZWN0ZWQoZXZlbnQ6IEV2ZW50KTogdm9pZCB7XG4gICAgY29uc3QgaW5wdXQgPSBldmVudC50YXJnZXQgYXMgSFRNTElucHV0RWxlbWVudDtcbiAgICBpZiAoaW5wdXQuZmlsZXMpIHtcbiAgICAgIHRoaXMuYWRkRmlsZXMoQXJyYXkuZnJvbShpbnB1dC5maWxlcykpO1xuICAgIH1cbiAgfVxuXG4gIGFkZEZpbGVzKGZpbGVzOiBGaWxlW10pOiB2b2lkIHtcbiAgICBpZiAoIWZpbGVzLmxlbmd0aCkgcmV0dXJuO1xuICAgIHRoaXMuc2VsZWN0ZWRGaWxlcyA9IFsuLi50aGlzLnNlbGVjdGVkRmlsZXMsIC4uLmZpbGVzXTtcbiAgfVxuXG4gIHJlbW92ZUZpbGUoaW5kZXg6IG51bWJlcik6IHZvaWQge1xuICAgIHRoaXMuc2VsZWN0ZWRGaWxlcy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgIHRoaXMuc2VsZWN0ZWRGaWxlcyA9IFsuLi50aGlzLnNlbGVjdGVkRmlsZXNdO1xuICB9XG5cbiAgZ2V0RmlsZUljb24oZmlsZTogRmlsZSk6IHN0cmluZyB7XG4gICAgY29uc3QgdHlwZSA9IGZpbGUudHlwZTtcbiAgICBpZiAodHlwZS5zdGFydHNXaXRoKCdpbWFnZS8nKSkgcmV0dXJuICdpbWFnZSc7XG4gICAgaWYgKHR5cGUuc3RhcnRzV2l0aCgndmlkZW8vJykpIHJldHVybiAndmlkZW9jYW0nO1xuICAgIGlmICh0eXBlLnN0YXJ0c1dpdGgoJ2F1ZGlvLycpKSByZXR1cm4gJ2F1ZGlvdHJhY2snO1xuICAgIGlmICh0eXBlLmluY2x1ZGVzKCdwZGYnKSkgcmV0dXJuICdwaWN0dXJlX2FzX3BkZic7XG4gICAgaWYgKHR5cGUuaW5jbHVkZXMoJ3NwcmVhZHNoZWV0JykgfHwgdHlwZS5pbmNsdWRlcygnZXhjZWwnKSkgcmV0dXJuICd0YWJsZV9jaGFydCc7XG4gICAgaWYgKHR5cGUuaW5jbHVkZXMoJ2RvY3VtZW50JykgfHwgdHlwZS5pbmNsdWRlcygnd29yZCcpKSByZXR1cm4gJ2Rlc2NyaXB0aW9uJztcbiAgICByZXR1cm4gJ2luc2VydF9kcml2ZV9maWxlJztcbiAgfVxuXG4gIGZvcm1hdFNpemUoYnl0ZXM6IG51bWJlcik6IHN0cmluZyB7XG4gICAgaWYgKGJ5dGVzIDwgMTAyNCkgcmV0dXJuIGJ5dGVzICsgJyBCJztcbiAgICBpZiAoYnl0ZXMgPCAxMDI0ICogMTAyNCkgcmV0dXJuIChieXRlcyAvIDEwMjQpLnRvRml4ZWQoMCkgKyAnIEtCJztcbiAgICByZXR1cm4gKGJ5dGVzIC8gKDEwMjQgKiAxMDI0KSkudG9GaXhlZCgxKSArICcgTUInO1xuICB9XG59XG4iXX0=