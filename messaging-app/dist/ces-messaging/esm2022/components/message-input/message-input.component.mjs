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
        this.resetComposer(true);
    }
    resetComposer(clearDraft) {
        this.messageText = '';
        this.selectedFiles = [];
        this.mentionSuggestions = [];
        this.detectedCodeLanguage = null;
        this.codeDetectionDismissed = false;
        this.manualTextareaHeight = this.minTextareaHeight;
        if (clearDraft)
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
  `, isInline: true, styles: [".message-input-container{padding:8px 12px;border-top:1px solid rgba(255,255,255,.15);background:transparent;position:relative}.input-resize-handle{position:absolute;top:-5px;left:0;right:0;height:10px;display:flex;align-items:center;justify-content:center;cursor:ns-resize;z-index:2}.input-resize-handle span{width:42px;height:3px;border-radius:999px;background:#ffffff38;transition:background .15s,width .15s}.input-resize-handle:hover span{width:56px;background:#ffffff6b}.file-previews{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;max-height:80px;overflow-y:auto}.reply-compose-preview{display:flex;align-items:center;gap:8px;margin-bottom:8px;padding:8px 10px;border-radius:12px;background:#7fb4ff1f;border-left:3px solid rgba(127,180,255,.8);color:#fff}.reply-compose-preview>mat-icon{color:#bfdbfe;font-size:18px;width:18px;height:18px;flex-shrink:0}.compose-preview-text{min-width:0;flex:1}.compose-preview-text span{display:block;font-size:11px;font-weight:700;color:#bfdbfe;margin-bottom:2px}.compose-preview-text p{margin:0;font-size:12px;color:#ffffffc7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.compose-cancel-btn{width:24px;height:24px;border:none;border-radius:999px;background:#ffffff14;color:#fffc;display:inline-flex;align-items:center;justify-content:center;padding:0;cursor:pointer;flex-shrink:0}.compose-cancel-btn mat-icon{font-size:16px;width:16px;height:16px}.mention-suggestions{margin-bottom:8px;border-radius:12px;overflow:hidden;background:#071d30;border:1px solid rgba(127,180,255,.22);box-shadow:0 10px 24px #0000003d}.mention-suggestion{width:100%;border:none;background:transparent;color:#fff;display:flex;align-items:center;gap:8px;padding:8px 10px;cursor:pointer;text-align:left}.mention-suggestion:hover,.mention-suggestion:focus{background:#7fb4ff24;outline:none}.mention-avatar{width:22px;height:22px;border-radius:999px;background:#7fb4ff38;color:#bfdbfe;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex-shrink:0}.mention-suggestion small{margin-left:auto;color:#ffffff85;font-size:11px}.code-detection-chip{display:inline-flex;align-items:center;gap:7px;margin-bottom:8px;padding:6px 8px;border-radius:999px;background:#7fb4ff24;border:1px solid rgba(127,180,255,.32);color:#bfdbfe;font-size:12px;font-weight:700}.code-detection-chip>mat-icon{font-size:15px;width:15px;height:15px}.code-detection-close{width:20px;height:20px;border:none;border-radius:999px;background:#ffffff14;color:#ffffffd1;display:inline-flex;align-items:center;justify-content:center;padding:0;cursor:pointer}.code-detection-close mat-icon{font-size:14px;width:14px;height:14px}.file-chip{display:flex;align-items:center;gap:4px;background:#ffffff26;border-radius:8px;padding:4px 4px 4px 8px;max-width:200px}.file-icon{font-size:16px;width:16px;height:16px;color:#fffc}.file-name{font-size:12px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100px}.file-size{font-size:10px;color:#ffffff80;flex-shrink:0}.file-remove{width:20px!important;height:20px!important}.file-remove mat-icon{font-size:14px;width:14px;height:14px;color:#fff9}.input-wrapper{display:flex;align-items:flex-end;gap:4px;background:#ffffff1a;border-radius:24px;padding:2px 4px}.attach-btn,.send-btn{flex-shrink:0;width:36px;height:36px;padding:0!important;margin:0;min-width:36px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;line-height:0!important}.attach-btn mat-icon,.send-btn mat-icon{color:#ffffffb3;font-size:20px;width:20px;height:20px;line-height:20px;margin:0;display:flex;align-items:center;justify-content:center}.send-btn mat-icon{color:#ffffffe6}.message-textarea{flex:1;border:none;outline:none;background:transparent;resize:none;font-size:14px;font-family:inherit;line-height:1.5;min-height:24px;max-height:180px;padding:7px 0;color:#fff;overflow-y:hidden;box-sizing:border-box}.message-textarea::placeholder{color:#ffffff80}.send-btn:disabled mat-icon{color:#ffffff4d}:host ::ng-deep .attach-btn .mat-mdc-button-touch-target,:host ::ng-deep .send-btn .mat-mdc-button-touch-target{height:36px!important;width:36px!important}:host ::ng-deep .attach-btn .mdc-icon-button__icon,:host ::ng-deep .send-btn .mdc-icon-button__icon{display:flex!important;align-items:center!important;justify-content:center!important;margin:0!important;padding:0!important}\n"], dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i1.NgForOf, selector: "[ngFor][ngForOf]", inputs: ["ngForOf", "ngForTrackBy", "ngForTemplate"] }, { kind: "directive", type: i1.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "ngmodule", type: FormsModule }, { kind: "directive", type: i2.DefaultValueAccessor, selector: "input:not([type=checkbox])[formControlName],textarea[formControlName],input:not([type=checkbox])[formControl],textarea[formControl],input:not([type=checkbox])[ngModel],textarea[ngModel],[ngDefaultControl]" }, { kind: "directive", type: i2.NgControlStatus, selector: "[formControlName],[ngModel],[formControl]" }, { kind: "directive", type: i2.NgModel, selector: "[ngModel]:not([formControlName]):not([formControl])", inputs: ["name", "disabled", "ngModel", "ngModelOptions"], outputs: ["ngModelChange"], exportAs: ["ngModel"] }, { kind: "ngmodule", type: MatIconModule }, { kind: "component", type: i3.MatIcon, selector: "mat-icon", inputs: ["color", "inline", "svgIcon", "fontSet", "fontIcon"], exportAs: ["matIcon"] }, { kind: "ngmodule", type: MatButtonModule }, { kind: "component", type: i4.MatIconButton, selector: "button[mat-icon-button]", exportAs: ["matButton"] }] });
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
  `, styles: [".message-input-container{padding:8px 12px;border-top:1px solid rgba(255,255,255,.15);background:transparent;position:relative}.input-resize-handle{position:absolute;top:-5px;left:0;right:0;height:10px;display:flex;align-items:center;justify-content:center;cursor:ns-resize;z-index:2}.input-resize-handle span{width:42px;height:3px;border-radius:999px;background:#ffffff38;transition:background .15s,width .15s}.input-resize-handle:hover span{width:56px;background:#ffffff6b}.file-previews{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;max-height:80px;overflow-y:auto}.reply-compose-preview{display:flex;align-items:center;gap:8px;margin-bottom:8px;padding:8px 10px;border-radius:12px;background:#7fb4ff1f;border-left:3px solid rgba(127,180,255,.8);color:#fff}.reply-compose-preview>mat-icon{color:#bfdbfe;font-size:18px;width:18px;height:18px;flex-shrink:0}.compose-preview-text{min-width:0;flex:1}.compose-preview-text span{display:block;font-size:11px;font-weight:700;color:#bfdbfe;margin-bottom:2px}.compose-preview-text p{margin:0;font-size:12px;color:#ffffffc7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.compose-cancel-btn{width:24px;height:24px;border:none;border-radius:999px;background:#ffffff14;color:#fffc;display:inline-flex;align-items:center;justify-content:center;padding:0;cursor:pointer;flex-shrink:0}.compose-cancel-btn mat-icon{font-size:16px;width:16px;height:16px}.mention-suggestions{margin-bottom:8px;border-radius:12px;overflow:hidden;background:#071d30;border:1px solid rgba(127,180,255,.22);box-shadow:0 10px 24px #0000003d}.mention-suggestion{width:100%;border:none;background:transparent;color:#fff;display:flex;align-items:center;gap:8px;padding:8px 10px;cursor:pointer;text-align:left}.mention-suggestion:hover,.mention-suggestion:focus{background:#7fb4ff24;outline:none}.mention-avatar{width:22px;height:22px;border-radius:999px;background:#7fb4ff38;color:#bfdbfe;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex-shrink:0}.mention-suggestion small{margin-left:auto;color:#ffffff85;font-size:11px}.code-detection-chip{display:inline-flex;align-items:center;gap:7px;margin-bottom:8px;padding:6px 8px;border-radius:999px;background:#7fb4ff24;border:1px solid rgba(127,180,255,.32);color:#bfdbfe;font-size:12px;font-weight:700}.code-detection-chip>mat-icon{font-size:15px;width:15px;height:15px}.code-detection-close{width:20px;height:20px;border:none;border-radius:999px;background:#ffffff14;color:#ffffffd1;display:inline-flex;align-items:center;justify-content:center;padding:0;cursor:pointer}.code-detection-close mat-icon{font-size:14px;width:14px;height:14px}.file-chip{display:flex;align-items:center;gap:4px;background:#ffffff26;border-radius:8px;padding:4px 4px 4px 8px;max-width:200px}.file-icon{font-size:16px;width:16px;height:16px;color:#fffc}.file-name{font-size:12px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100px}.file-size{font-size:10px;color:#ffffff80;flex-shrink:0}.file-remove{width:20px!important;height:20px!important}.file-remove mat-icon{font-size:14px;width:14px;height:14px;color:#fff9}.input-wrapper{display:flex;align-items:flex-end;gap:4px;background:#ffffff1a;border-radius:24px;padding:2px 4px}.attach-btn,.send-btn{flex-shrink:0;width:36px;height:36px;padding:0!important;margin:0;min-width:36px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;line-height:0!important}.attach-btn mat-icon,.send-btn mat-icon{color:#ffffffb3;font-size:20px;width:20px;height:20px;line-height:20px;margin:0;display:flex;align-items:center;justify-content:center}.send-btn mat-icon{color:#ffffffe6}.message-textarea{flex:1;border:none;outline:none;background:transparent;resize:none;font-size:14px;font-family:inherit;line-height:1.5;min-height:24px;max-height:180px;padding:7px 0;color:#fff;overflow-y:hidden;box-sizing:border-box}.message-textarea::placeholder{color:#ffffff80}.send-btn:disabled mat-icon{color:#ffffff4d}:host ::ng-deep .attach-btn .mat-mdc-button-touch-target,:host ::ng-deep .send-btn .mat-mdc-button-touch-target{height:36px!important;width:36px!important}:host ::ng-deep .attach-btn .mdc-icon-button__icon,:host ::ng-deep .send-btn .mdc-icon-button__icon{display:flex!important;align-items:center!important;justify-content:center!important;margin:0!important;padding:0!important}\n"] }]
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVzc2FnZS1pbnB1dC5jb21wb25lbnQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvbGliL2NvbXBvbmVudHMvbWVzc2FnZS1pbnB1dC9tZXNzYWdlLWlucHV0LmNvbXBvbmVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBRUwsU0FBUyxFQUVULFlBQVksRUFDWixLQUFLLEVBR0wsTUFBTSxFQUVOLFNBQVMsR0FDVixNQUFNLGVBQWUsQ0FBQztBQUN2QixPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDL0MsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLGdCQUFnQixDQUFDO0FBQzdDLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSx3QkFBd0IsQ0FBQztBQUN2RCxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sMEJBQTBCLENBQUM7Ozs7OztBQWdjM0QsTUFBTSxPQUFPLHFCQUFxQjtJQUN2QixjQUFjLEdBQWtCLElBQUksQ0FBQztJQUNyQyxPQUFPLEdBQXdCLElBQUksQ0FBQztJQUNwQyxjQUFjLEdBQUcsS0FBSyxDQUFDO0lBQ3ZCLGNBQWMsR0FBb0IsRUFBRSxDQUFDO0lBQ3BDLFdBQVcsR0FBRyxJQUFJLFlBQVksRUFBc0IsQ0FBQztJQUNyRCxnQkFBZ0IsR0FBRyxJQUFJLFlBQVksRUFBa0IsQ0FBQztJQUN0RCxjQUFjLEdBQUcsSUFBSSxZQUFZLEVBQVEsQ0FBQztJQUM1QixTQUFTLENBQWdDO0lBQ25DLGVBQWUsQ0FBbUM7SUFFaEYsV0FBVyxHQUFHLEVBQUUsQ0FBQztJQUNqQixhQUFhLEdBQVcsRUFBRSxDQUFDO0lBQzNCLGNBQWMsR0FBRyxFQUFFLENBQUM7SUFDcEIsa0JBQWtCLEdBQW9CLEVBQUUsQ0FBQztJQUN6QyxvQkFBb0IsR0FBa0IsSUFBSSxDQUFDO0lBQzNDLHNCQUFzQixHQUFHLEtBQUssQ0FBQztJQUNkLFdBQVcsR0FBRyxrQkFBa0IsQ0FB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QUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEdBQUcsS0FBSyxDQUFDO0lBQ3BELENBQUM7d0dBallVLHFCQUFxQjs0RkFBckIscUJBQXFCLHNpQkFwYXRCOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQWtHVCxpNElBbkdTLFlBQVksK1BBQUUsV0FBVyw4bUJBQUUsYUFBYSxtTEFBRSxlQUFlOzs0RkFxYXhELHFCQUFxQjtrQkF4YWpDLFNBQVM7K0JBQ0UsbUJBQW1CLGNBQ2pCLElBQUksV0FDUCxDQUFDLFlBQVksRUFBRSxXQUFXLEVBQUUsYUFBYSxFQUFFLGVBQWUsQ0FBQyxZQUMxRDs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7R0FrR1Q7OEJBbVVRLGNBQWM7c0JBQXRCLEtBQUs7Z0JBQ0csT0FBTztzQkFBZixLQUFLO2dCQUNHLGNBQWM7c0JBQXRCLEtBQUs7Z0JBQ0csY0FBYztzQkFBdEIsS0FBSztnQkFDSSxXQUFXO3NCQUFwQixNQUFNO2dCQUNHLGdCQUFnQjtzQkFBekIsTUFBTTtnQkFDRyxjQUFjO3NCQUF2QixNQUFNO2dCQUNpQixTQUFTO3NCQUFoQyxTQUFTO3VCQUFDLFdBQVc7Z0JBQ1EsZUFBZTtzQkFBNUMsU0FBUzt1QkFBQyxpQkFBaUIiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge1xuICBBZnRlclZpZXdJbml0LFxuICBDb21wb25lbnQsXG4gIEVsZW1lbnRSZWYsXG4gIEV2ZW50RW1pdHRlcixcbiAgSW5wdXQsXG4gIE9uQ2hhbmdlcyxcbiAgT25EZXN0cm95LFxuICBPdXRwdXQsXG4gIFNpbXBsZUNoYW5nZXMsXG4gIFZpZXdDaGlsZCxcbn0gZnJvbSAnQGFuZ3VsYXIvY29yZSc7XG5pbXBvcnQgeyBDb21tb25Nb2R1bGUgfSBmcm9tICdAYW5ndWxhci9jb21tb24nO1xuaW1wb3J0IHsgRm9ybXNNb2R1bGUgfSBmcm9tICdAYW5ndWxhci9mb3Jtcyc7XG5pbXBvcnQgeyBNYXRJY29uTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvbWF0ZXJpYWwvaWNvbic7XG5pbXBvcnQgeyBNYXRCdXR0b25Nb2R1bGUgfSBmcm9tICdAYW5ndWxhci9tYXRlcmlhbC9idXR0b24nO1xuXG5leHBvcnQgaW50ZXJmYWNlIE1lc3NhZ2VQYXlsb2FkIHtcbiAgdGV4dDogc3RyaW5nO1xuICBmaWxlczogRmlsZVtdO1xuICBmb3JjZVBsYWluVGV4dD86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgTWVzc2FnZVRleHRQYXlsb2FkIHtcbiAgdGV4dDogc3RyaW5nO1xuICBmb3JjZVBsYWluVGV4dD86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUmVwbHlQcmV2aWV3IHtcbiAgc2VuZGVyTmFtZTogc3RyaW5nO1xuICBjb250ZW50OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgTWVudGlvbk9wdGlvbiB7XG4gIGNvbnRhY3RJZDogc3RyaW5nO1xuICBsYWJlbDogc3RyaW5nO1xuICB0b2tlbjogc3RyaW5nO1xufVxuXG5AQ29tcG9uZW50KHtcbiAgc2VsZWN0b3I6ICdhcHAtbWVzc2FnZS1pbnB1dCcsXG4gIHN0YW5kYWxvbmU6IHRydWUsXG4gIGltcG9ydHM6IFtDb21tb25Nb2R1bGUsIEZvcm1zTW9kdWxlLCBNYXRJY29uTW9kdWxlLCBNYXRCdXR0b25Nb2R1bGVdLFxuICB0ZW1wbGF0ZTogYFxuICAgIDxkaXZcbiAgICAgIGNsYXNzPVwibWVzc2FnZS1pbnB1dC1jb250YWluZXJcIlxuICAgID5cbiAgICAgIDxkaXZcbiAgICAgICAgY2xhc3M9XCJpbnB1dC1yZXNpemUtaGFuZGxlXCJcbiAgICAgICAgdGl0bGU9XCJEcmFnIHVwIHRvIGV4cGFuZCBtZXNzYWdlIGJveFwiXG4gICAgICAgIChtb3VzZWRvd24pPVwib25SZXNpemVTdGFydCgkZXZlbnQpXCJcbiAgICAgID5cbiAgICAgICAgPHNwYW4+PC9zcGFuPlxuICAgICAgPC9kaXY+XG5cbiAgICAgIDxkaXYgKm5nSWY9XCJyZXBseVRvXCIgY2xhc3M9XCJyZXBseS1jb21wb3NlLXByZXZpZXdcIj5cbiAgICAgICAgPG1hdC1pY29uPnJlcGx5PC9tYXQtaWNvbj5cbiAgICAgICAgPGRpdiBjbGFzcz1cImNvbXBvc2UtcHJldmlldy10ZXh0XCI+XG4gICAgICAgICAgPHNwYW4+UmVwbHlpbmcgdG8ge3sgcmVwbHlUby5zZW5kZXJOYW1lIH19PC9zcGFuPlxuICAgICAgICAgIDxwPnt7IHJlcGx5VG8uY29udGVudCB9fTwvcD5cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIDxidXR0b24gdHlwZT1cImJ1dHRvblwiIGNsYXNzPVwiY29tcG9zZS1jYW5jZWwtYnRuXCIgKGNsaWNrKT1cInJlcGx5Q2FuY2VsbGVkLmVtaXQoKVwiIHRpdGxlPVwiQ2FuY2VsIHJlcGx5XCI+XG4gICAgICAgICAgPG1hdC1pY29uPmNsb3NlPC9tYXQtaWNvbj5cbiAgICAgICAgPC9idXR0b24+XG4gICAgICA8L2Rpdj5cblxuICAgICAgPCEtLSBGaWxlIHByZXZpZXdzIC0tPlxuICAgICAgPGRpdiAqbmdJZj1cInNlbGVjdGVkRmlsZXMubGVuZ3RoID4gMFwiIGNsYXNzPVwiZmlsZS1wcmV2aWV3c1wiPlxuICAgICAgICA8ZGl2ICpuZ0Zvcj1cImxldCBmaWxlIG9mIHNlbGVjdGVkRmlsZXM7IGxldCBpID0gaW5kZXhcIiBjbGFzcz1cImZpbGUtY2hpcFwiPlxuICAgICAgICAgIDxtYXQtaWNvbiBjbGFzcz1cImZpbGUtaWNvblwiPnt7IGdldEZpbGVJY29uKGZpbGUpIH19PC9tYXQtaWNvbj5cbiAgICAgICAgICA8c3BhbiBjbGFzcz1cImZpbGUtbmFtZVwiPnt7IGZpbGUubmFtZSB9fTwvc3Bhbj5cbiAgICAgICAgICA8c3BhbiBjbGFzcz1cImZpbGUtc2l6ZVwiPnt7IGZvcm1hdFNpemUoZmlsZS5zaXplKSB9fTwvc3Bhbj5cbiAgICAgICAgICA8YnV0dG9uIG1hdC1pY29uLWJ1dHRvbiBjbGFzcz1cImZpbGUtcmVtb3ZlXCIgKGNsaWNrKT1cInJlbW92ZUZpbGUoaSlcIj5cbiAgICAgICAgICAgIDxtYXQtaWNvbj5jbG9zZTwvbWF0LWljb24+XG4gICAgICAgICAgPC9idXR0b24+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG5cbiAgICAgIDxkaXYgKm5nSWY9XCJtZW50aW9uU3VnZ2VzdGlvbnMubGVuZ3RoID4gMFwiIGNsYXNzPVwibWVudGlvbi1zdWdnZXN0aW9uc1wiPlxuICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgdHlwZT1cImJ1dHRvblwiXG4gICAgICAgICAgKm5nRm9yPVwibGV0IG9wdGlvbiBvZiBtZW50aW9uU3VnZ2VzdGlvbnNcIlxuICAgICAgICAgIGNsYXNzPVwibWVudGlvbi1zdWdnZXN0aW9uXCJcbiAgICAgICAgICAobW91c2Vkb3duKT1cIiRldmVudC5wcmV2ZW50RGVmYXVsdCgpXCJcbiAgICAgICAgICAoY2xpY2spPVwiaW5zZXJ0TWVudGlvbihvcHRpb24pXCJcbiAgICAgICAgPlxuICAgICAgICAgIDxzcGFuIGNsYXNzPVwibWVudGlvbi1hdmF0YXJcIj4mIzY0Ozwvc3Bhbj5cbiAgICAgICAgICA8c3Bhbj57eyBvcHRpb24ubGFiZWwgfX08L3NwYW4+XG4gICAgICAgICAgPHNtYWxsPiYjNjQ7e3sgb3B0aW9uLnRva2VuIH19PC9zbWFsbD5cbiAgICAgICAgPC9idXR0b24+XG4gICAgICA8L2Rpdj5cblxuICAgICAgPGRpdiAqbmdJZj1cImRldGVjdGVkQ29kZUxhbmd1YWdlICYmICFjb2RlRGV0ZWN0aW9uRGlzbWlzc2VkXCIgY2xhc3M9XCJjb2RlLWRldGVjdGlvbi1jaGlwXCI+XG4gICAgICAgIDxtYXQtaWNvbj5jb2RlPC9tYXQtaWNvbj5cbiAgICAgICAgPHNwYW4+TG9va3MgbGlrZSB7eyBkZXRlY3RlZENvZGVMYW5ndWFnZSB9fSBjb2RlPC9zcGFuPlxuICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgdHlwZT1cImJ1dHRvblwiXG4gICAgICAgICAgY2xhc3M9XCJjb2RlLWRldGVjdGlvbi1jbG9zZVwiXG4gICAgICAgICAgKGNsaWNrKT1cImRpc21pc3NDb2RlRGV0ZWN0aW9uKClcIlxuICAgICAgICAgIHRpdGxlPVwiU2VuZCBhcyBub3JtYWwgdGV4dFwiXG4gICAgICAgID5cbiAgICAgICAgICA8bWF0LWljb24+Y2xvc2U8L21hdC1pY29uPlxuICAgICAgICA8L2J1dHRvbj5cbiAgICAgIDwvZGl2PlxuXG4gICAgICA8ZGl2IGNsYXNzPVwiaW5wdXQtd3JhcHBlclwiPlxuICAgICAgICA8YnV0dG9uIG1hdC1pY29uLWJ1dHRvbiBjbGFzcz1cImF0dGFjaC1idG5cIiAoY2xpY2spPVwiZmlsZUlucHV0LmNsaWNrKClcIiB0aXRsZT1cIkF0dGFjaCBmaWxlc1wiPlxuICAgICAgICAgIDxtYXQtaWNvbj5hdHRhY2hfZmlsZTwvbWF0LWljb24+XG4gICAgICAgIDwvYnV0dG9uPlxuICAgICAgICA8aW5wdXRcbiAgICAgICAgICAjZmlsZUlucHV0XG4gICAgICAgICAgdHlwZT1cImZpbGVcIlxuICAgICAgICAgIG11bHRpcGxlXG4gICAgICAgICAgc3R5bGU9XCJkaXNwbGF5Om5vbmVcIlxuICAgICAgICAgIChjaGFuZ2UpPVwib25GaWxlc1NlbGVjdGVkKCRldmVudClcIlxuICAgICAgICAvPlxuICAgICAgICA8dGV4dGFyZWFcbiAgICAgICAgICAjbWVzc2FnZVRleHRhcmVhXG4gICAgICAgICAgW25nTW9kZWxdPVwibWVzc2FnZVRleHRcIlxuICAgICAgICAgIChuZ01vZGVsQ2hhbmdlKT1cIm9uVGV4dENoYW5nZSgkZXZlbnQpXCJcbiAgICAgICAgICAoaW5wdXQpPVwiYXV0b1Jlc2l6ZSgpXCJcbiAgICAgICAgICAocGFzdGUpPVwib25QYXN0ZSgkZXZlbnQpXCJcbiAgICAgICAgICAoY2xpY2spPVwidXBkYXRlTWVudGlvblN1Z2dlc3Rpb25zKClcIlxuICAgICAgICAgIChrZXl1cCk9XCJ1cGRhdGVNZW50aW9uU3VnZ2VzdGlvbnMoKVwiXG4gICAgICAgICAgKGtleWRvd24pPVwib25LZXlkb3duKCRldmVudClcIlxuICAgICAgICAgIHBsYWNlaG9sZGVyPVwiVHlwZSBhIG1lc3NhZ2UuLi5cIlxuICAgICAgICAgIHJvd3M9XCIxXCJcbiAgICAgICAgICBjbGFzcz1cIm1lc3NhZ2UtdGV4dGFyZWFcIlxuICAgICAgICAgIFtzdHlsZS5oZWlnaHQucHhdPVwidGV4dGFyZWFIZWlnaHRcIlxuICAgICAgICA+PC90ZXh0YXJlYT5cbiAgICAgICAgPGJ1dHRvblxuICAgICAgICAgIG1hdC1pY29uLWJ1dHRvblxuICAgICAgICAgIGNsYXNzPVwic2VuZC1idG5cIlxuICAgICAgICAgIFtkaXNhYmxlZF09XCIhY2FuU2VuZFwiXG4gICAgICAgICAgKGNsaWNrKT1cInNlbmQoKVwiXG4gICAgICAgID5cbiAgICAgICAgICA8bWF0LWljb24+c2VuZDwvbWF0LWljb24+XG4gICAgICAgIDwvYnV0dG9uPlxuICAgICAgPC9kaXY+XG5cbiAgICA8L2Rpdj5cbiAgYCxcbiAgc3R5bGVzOiBbYFxuICAgIC5tZXNzYWdlLWlucHV0LWNvbnRhaW5lciB7XG4gICAgICBwYWRkaW5nOiA4cHggMTJweDtcbiAgICAgIGJvcmRlci10b3A6IDFweCBzb2xpZCByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMTUpO1xuICAgICAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQ7XG4gICAgICBwb3NpdGlvbjogcmVsYXRpdmU7XG4gICAgfVxuXG4gICAgLmlucHV0LXJlc2l6ZS1oYW5kbGUge1xuICAgICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgICAgdG9wOiAtNXB4O1xuICAgICAgbGVmdDogMDtcbiAgICAgIHJpZ2h0OiAwO1xuICAgICAgaGVpZ2h0OiAxMHB4O1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgIGN1cnNvcjogbnMtcmVzaXplO1xuICAgICAgei1pbmRleDogMjtcbiAgICB9XG5cbiAgICAuaW5wdXQtcmVzaXplLWhhbmRsZSBzcGFuIHtcbiAgICAgIHdpZHRoOiA0MnB4O1xuICAgICAgaGVpZ2h0OiAzcHg7XG4gICAgICBib3JkZXItcmFkaXVzOiA5OTlweDtcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4yMik7XG4gICAgICB0cmFuc2l0aW9uOiBiYWNrZ3JvdW5kIDAuMTVzLCB3aWR0aCAwLjE1cztcbiAgICB9XG5cbiAgICAuaW5wdXQtcmVzaXplLWhhbmRsZTpob3ZlciBzcGFuIHtcbiAgICAgIHdpZHRoOiA1NnB4O1xuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjQyKTtcbiAgICB9XG5cbiAgICAuZmlsZS1wcmV2aWV3cyB7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgZmxleC13cmFwOiB3cmFwO1xuICAgICAgZ2FwOiA2cHg7XG4gICAgICBtYXJnaW4tYm90dG9tOiA4cHg7XG4gICAgICBtYXgtaGVpZ2h0OiA4MHB4O1xuICAgICAgb3ZlcmZsb3cteTogYXV0bztcbiAgICB9XG5cbiAgICAucmVwbHktY29tcG9zZS1wcmV2aWV3IHtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgZ2FwOiA4cHg7XG4gICAgICBtYXJnaW4tYm90dG9tOiA4cHg7XG4gICAgICBwYWRkaW5nOiA4cHggMTBweDtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDEycHg7XG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDEyNywgMTgwLCAyNTUsIDAuMTIpO1xuICAgICAgYm9yZGVyLWxlZnQ6IDNweCBzb2xpZCByZ2JhKDEyNywgMTgwLCAyNTUsIDAuOCk7XG4gICAgICBjb2xvcjogI2ZmZjtcbiAgICB9XG5cbiAgICAucmVwbHktY29tcG9zZS1wcmV2aWV3ID4gbWF0LWljb24ge1xuICAgICAgY29sb3I6ICNiZmRiZmU7XG4gICAgICBmb250LXNpemU6IDE4cHg7XG4gICAgICB3aWR0aDogMThweDtcbiAgICAgIGhlaWdodDogMThweDtcbiAgICAgIGZsZXgtc2hyaW5rOiAwO1xuICAgIH1cblxuICAgIC5jb21wb3NlLXByZXZpZXctdGV4dCB7XG4gICAgICBtaW4td2lkdGg6IDA7XG4gICAgICBmbGV4OiAxO1xuICAgIH1cblxuICAgIC5jb21wb3NlLXByZXZpZXctdGV4dCBzcGFuIHtcbiAgICAgIGRpc3BsYXk6IGJsb2NrO1xuICAgICAgZm9udC1zaXplOiAxMXB4O1xuICAgICAgZm9udC13ZWlnaHQ6IDcwMDtcbiAgICAgIGNvbG9yOiAjYmZkYmZlO1xuICAgICAgbWFyZ2luLWJvdHRvbTogMnB4O1xuICAgIH1cblxuICAgIC5jb21wb3NlLXByZXZpZXctdGV4dCBwIHtcbiAgICAgIG1hcmdpbjogMDtcbiAgICAgIGZvbnQtc2l6ZTogMTJweDtcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNzgpO1xuICAgICAgd2hpdGUtc3BhY2U6IG5vd3JhcDtcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICB0ZXh0LW92ZXJmbG93OiBlbGxpcHNpcztcbiAgICB9XG5cbiAgICAuY29tcG9zZS1jYW5jZWwtYnRuIHtcbiAgICAgIHdpZHRoOiAyNHB4O1xuICAgICAgaGVpZ2h0OiAyNHB4O1xuICAgICAgYm9yZGVyOiBub25lO1xuICAgICAgYm9yZGVyLXJhZGl1czogOTk5cHg7XG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMDgpO1xuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC44KTtcbiAgICAgIGRpc3BsYXk6IGlubGluZS1mbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgICAgcGFkZGluZzogMDtcbiAgICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgICAgIGZsZXgtc2hyaW5rOiAwO1xuICAgIH1cblxuICAgIC5jb21wb3NlLWNhbmNlbC1idG4gbWF0LWljb24ge1xuICAgICAgZm9udC1zaXplOiAxNnB4O1xuICAgICAgd2lkdGg6IDE2cHg7XG4gICAgICBoZWlnaHQ6IDE2cHg7XG4gICAgfVxuXG4gICAgLm1lbnRpb24tc3VnZ2VzdGlvbnMge1xuICAgICAgbWFyZ2luLWJvdHRvbTogOHB4O1xuICAgICAgYm9yZGVyLXJhZGl1czogMTJweDtcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICBiYWNrZ3JvdW5kOiAjMDcxZDMwO1xuICAgICAgYm9yZGVyOiAxcHggc29saWQgcmdiYSgxMjcsIDE4MCwgMjU1LCAwLjIyKTtcbiAgICAgIGJveC1zaGFkb3c6IDAgMTBweCAyNHB4IHJnYmEoMCwgMCwgMCwgMC4yNCk7XG4gICAgfVxuXG4gICAgLm1lbnRpb24tc3VnZ2VzdGlvbiB7XG4gICAgICB3aWR0aDogMTAwJTtcbiAgICAgIGJvcmRlcjogbm9uZTtcbiAgICAgIGJhY2tncm91bmQ6IHRyYW5zcGFyZW50O1xuICAgICAgY29sb3I6ICNmZmY7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGdhcDogOHB4O1xuICAgICAgcGFkZGluZzogOHB4IDEwcHg7XG4gICAgICBjdXJzb3I6IHBvaW50ZXI7XG4gICAgICB0ZXh0LWFsaWduOiBsZWZ0O1xuICAgIH1cblxuICAgIC5tZW50aW9uLXN1Z2dlc3Rpb246aG92ZXIsXG4gICAgLm1lbnRpb24tc3VnZ2VzdGlvbjpmb2N1cyB7XG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDEyNywgMTgwLCAyNTUsIDAuMTQpO1xuICAgICAgb3V0bGluZTogbm9uZTtcbiAgICB9XG5cbiAgICAubWVudGlvbi1hdmF0YXIge1xuICAgICAgd2lkdGg6IDIycHg7XG4gICAgICBoZWlnaHQ6IDIycHg7XG4gICAgICBib3JkZXItcmFkaXVzOiA5OTlweDtcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMTI3LCAxODAsIDI1NSwgMC4yMik7XG4gICAgICBjb2xvcjogI2JmZGJmZTtcbiAgICAgIGRpc3BsYXk6IGlubGluZS1mbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgICAgZm9udC1zaXplOiAxMnB4O1xuICAgICAgZm9udC13ZWlnaHQ6IDgwMDtcbiAgICAgIGZsZXgtc2hyaW5rOiAwO1xuICAgIH1cblxuICAgIC5tZW50aW9uLXN1Z2dlc3Rpb24gc21hbGwge1xuICAgICAgbWFyZ2luLWxlZnQ6IGF1dG87XG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjUyKTtcbiAgICAgIGZvbnQtc2l6ZTogMTFweDtcbiAgICB9XG5cbiAgICAuY29kZS1kZXRlY3Rpb24tY2hpcCB7XG4gICAgICBkaXNwbGF5OiBpbmxpbmUtZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBnYXA6IDdweDtcbiAgICAgIG1hcmdpbi1ib3R0b206IDhweDtcbiAgICAgIHBhZGRpbmc6IDZweCA4cHg7XG4gICAgICBib3JkZXItcmFkaXVzOiA5OTlweDtcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMTI3LCAxODAsIDI1NSwgMC4xNCk7XG4gICAgICBib3JkZXI6IDFweCBzb2xpZCByZ2JhKDEyNywgMTgwLCAyNTUsIDAuMzIpO1xuICAgICAgY29sb3I6ICNiZmRiZmU7XG4gICAgICBmb250LXNpemU6IDEycHg7XG4gICAgICBmb250LXdlaWdodDogNzAwO1xuICAgIH1cblxuICAgIC5jb2RlLWRldGVjdGlvbi1jaGlwID4gbWF0LWljb24ge1xuICAgICAgZm9udC1zaXplOiAxNXB4O1xuICAgICAgd2lkdGg6IDE1cHg7XG4gICAgICBoZWlnaHQ6IDE1cHg7XG4gICAgfVxuXG4gICAgLmNvZGUtZGV0ZWN0aW9uLWNsb3NlIHtcbiAgICAgIHdpZHRoOiAyMHB4O1xuICAgICAgaGVpZ2h0OiAyMHB4O1xuICAgICAgYm9yZGVyOiBub25lO1xuICAgICAgYm9yZGVyLXJhZGl1czogOTk5cHg7XG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMDgpO1xuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC44Mik7XG4gICAgICBkaXNwbGF5OiBpbmxpbmUtZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgIHBhZGRpbmc6IDA7XG4gICAgICBjdXJzb3I6IHBvaW50ZXI7XG4gICAgfVxuXG4gICAgLmNvZGUtZGV0ZWN0aW9uLWNsb3NlIG1hdC1pY29uIHtcbiAgICAgIGZvbnQtc2l6ZTogMTRweDtcbiAgICAgIHdpZHRoOiAxNHB4O1xuICAgICAgaGVpZ2h0OiAxNHB4O1xuICAgIH1cblxuICAgIC5maWxlLWNoaXAge1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBnYXA6IDRweDtcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xNSk7XG4gICAgICBib3JkZXItcmFkaXVzOiA4cHg7XG4gICAgICBwYWRkaW5nOiA0cHggNHB4IDRweCA4cHg7XG4gICAgICBtYXgtd2lkdGg6IDIwMHB4O1xuICAgIH1cblxuICAgIC5maWxlLWljb24ge1xuICAgICAgZm9udC1zaXplOiAxNnB4O1xuICAgICAgd2lkdGg6IDE2cHg7XG4gICAgICBoZWlnaHQ6IDE2cHg7XG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjgpO1xuICAgIH1cblxuICAgIC5maWxlLW5hbWUge1xuICAgICAgZm9udC1zaXplOiAxMnB4O1xuICAgICAgY29sb3I6ICNmZmY7XG4gICAgICB3aGl0ZS1zcGFjZTogbm93cmFwO1xuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICAgIHRleHQtb3ZlcmZsb3c6IGVsbGlwc2lzO1xuICAgICAgbWF4LXdpZHRoOiAxMDBweDtcbiAgICB9XG5cbiAgICAuZmlsZS1zaXplIHtcbiAgICAgIGZvbnQtc2l6ZTogMTBweDtcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNSk7XG4gICAgICBmbGV4LXNocmluazogMDtcbiAgICB9XG5cbiAgICAuZmlsZS1yZW1vdmUge1xuICAgICAgd2lkdGg6IDIwcHggIWltcG9ydGFudDtcbiAgICAgIGhlaWdodDogMjBweCAhaW1wb3J0YW50O1xuICAgIH1cblxuICAgIC5maWxlLXJlbW92ZSBtYXQtaWNvbiB7XG4gICAgICBmb250LXNpemU6IDE0cHg7XG4gICAgICB3aWR0aDogMTRweDtcbiAgICAgIGhlaWdodDogMTRweDtcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNik7XG4gICAgfVxuXG4gICAgLmlucHV0LXdyYXBwZXIge1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBmbGV4LWVuZDtcbiAgICAgIGdhcDogNHB4O1xuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjEpO1xuICAgICAgYm9yZGVyLXJhZGl1czogMjRweDtcbiAgICAgIHBhZGRpbmc6IDJweCA0cHg7XG4gICAgfVxuXG4gICAgLmF0dGFjaC1idG4sXG4gICAgLnNlbmQtYnRuIHtcbiAgICAgIGZsZXgtc2hyaW5rOiAwO1xuICAgICAgd2lkdGg6IDM2cHg7XG4gICAgICBoZWlnaHQ6IDM2cHg7XG4gICAgICBwYWRkaW5nOiAwICFpbXBvcnRhbnQ7XG4gICAgICBtYXJnaW46IDA7XG4gICAgICBtaW4td2lkdGg6IDM2cHggIWltcG9ydGFudDtcbiAgICAgIGRpc3BsYXk6IGlubGluZS1mbGV4ICFpbXBvcnRhbnQ7XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyICFpbXBvcnRhbnQ7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlciAhaW1wb3J0YW50O1xuICAgICAgbGluZS1oZWlnaHQ6IDAgIWltcG9ydGFudDtcbiAgICB9XG5cbiAgICAuYXR0YWNoLWJ0biBtYXQtaWNvbixcbiAgICAuc2VuZC1idG4gbWF0LWljb24ge1xuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC43KTtcbiAgICAgIGZvbnQtc2l6ZTogMjBweDtcbiAgICAgIHdpZHRoOiAyMHB4O1xuICAgICAgaGVpZ2h0OiAyMHB4O1xuICAgICAgbGluZS1oZWlnaHQ6IDIwcHg7XG4gICAgICBtYXJnaW46IDA7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgIH1cblxuICAgIC5zZW5kLWJ0biBtYXQtaWNvbiB7XG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjkpO1xuICAgIH1cblxuICAgIC5tZXNzYWdlLXRleHRhcmVhIHtcbiAgICAgIGZsZXg6IDE7XG4gICAgICBib3JkZXI6IG5vbmU7XG4gICAgICBvdXRsaW5lOiBub25lO1xuICAgICAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQ7XG4gICAgICByZXNpemU6IG5vbmU7XG4gICAgICBmb250LXNpemU6IDE0cHg7XG4gICAgICBmb250LWZhbWlseTogaW5oZXJpdDtcbiAgICAgIGxpbmUtaGVpZ2h0OiAxLjU7XG4gICAgICBtaW4taGVpZ2h0OiAyNHB4O1xuICAgICAgbWF4LWhlaWdodDogMTgwcHg7XG4gICAgICBwYWRkaW5nOiA3cHggMDtcbiAgICAgIGNvbG9yOiAjZmZmO1xuICAgICAgb3ZlcmZsb3cteTogaGlkZGVuO1xuICAgICAgYm94LXNpemluZzogYm9yZGVyLWJveDtcbiAgICB9XG5cbiAgICAubWVzc2FnZS10ZXh0YXJlYTo6cGxhY2Vob2xkZXIge1xuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC41KTtcbiAgICB9XG5cbiAgICAuc2VuZC1idG46ZGlzYWJsZWQgbWF0LWljb24ge1xuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4zKTtcbiAgICB9XG5cbiAgICAvKiBNREMgbWF0LWljb24tYnV0dG9uIGlubmVyIHdyYXBwZXIgb2Z0ZW4gc2hpZnRzIGdseXBocyBkb3dud2FyZCB3aXRob3V0IHRoaXMgKi9cbiAgICA6aG9zdCA6Om5nLWRlZXAgLmF0dGFjaC1idG4gLm1hdC1tZGMtYnV0dG9uLXRvdWNoLXRhcmdldCxcbiAgICA6aG9zdCA6Om5nLWRlZXAgLnNlbmQtYnRuIC5tYXQtbWRjLWJ1dHRvbi10b3VjaC10YXJnZXQge1xuICAgICAgaGVpZ2h0OiAzNnB4ICFpbXBvcnRhbnQ7XG4gICAgICB3aWR0aDogMzZweCAhaW1wb3J0YW50O1xuICAgIH1cblxuICAgIDpob3N0IDo6bmctZGVlcCAuYXR0YWNoLWJ0biAubWRjLWljb24tYnV0dG9uX19pY29uLFxuICAgIDpob3N0IDo6bmctZGVlcCAuc2VuZC1idG4gLm1kYy1pY29uLWJ1dHRvbl9faWNvbiB7XG4gICAgICBkaXNwbGF5OiBmbGV4ICFpbXBvcnRhbnQ7XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyICFpbXBvcnRhbnQ7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlciAhaW1wb3J0YW50O1xuICAgICAgbWFyZ2luOiAwICFpbXBvcnRhbnQ7XG4gICAgICBwYWRkaW5nOiAwICFpbXBvcnRhbnQ7XG4gICAgfVxuXG4gIGBdLFxufSlcbmV4cG9ydCBjbGFzcyBNZXNzYWdlSW5wdXRDb21wb25lbnQgaW1wbGVtZW50cyBPbkNoYW5nZXMsIEFmdGVyVmlld0luaXQsIE9uRGVzdHJveSB7XG4gIEBJbnB1dCgpIGNvbnZlcnNhdGlvbklkOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcbiAgQElucHV0KCkgcmVwbHlUbzogUmVwbHlQcmV2aWV3IHwgbnVsbCA9IG51bGw7XG4gIEBJbnB1dCgpIGVuYWJsZU1lbnRpb25zID0gZmFsc2U7XG4gIEBJbnB1dCgpIG1lbnRpb25PcHRpb25zOiBNZW50aW9uT3B0aW9uW10gPSBbXTtcbiAgQE91dHB1dCgpIG1lc3NhZ2VTZW50ID0gbmV3IEV2ZW50RW1pdHRlcjxNZXNzYWdlVGV4dFBheWxvYWQ+KCk7XG4gIEBPdXRwdXQoKSBtZXNzYWdlV2l0aEZpbGVzID0gbmV3IEV2ZW50RW1pdHRlcjxNZXNzYWdlUGF5bG9hZD4oKTtcbiAgQE91dHB1dCgpIHJlcGx5Q2FuY2VsbGVkID0gbmV3IEV2ZW50RW1pdHRlcjx2b2lkPigpO1xuICBAVmlld0NoaWxkKCdmaWxlSW5wdXQnKSBmaWxlSW5wdXQhOiBFbGVtZW50UmVmPEhUTUxJbnB1dEVsZW1lbnQ+O1xuICBAVmlld0NoaWxkKCdtZXNzYWdlVGV4dGFyZWEnKSBtZXNzYWdlVGV4dGFyZWEhOiBFbGVtZW50UmVmPEhUTUxUZXh0QXJlYUVsZW1lbnQ+O1xuXG4gIG1lc3NhZ2VUZXh0ID0gJyc7XG4gIHNlbGVjdGVkRmlsZXM6IEZpbGVbXSA9IFtdO1xuICB0ZXh0YXJlYUhlaWdodCA9IDM2O1xuICBtZW50aW9uU3VnZ2VzdGlvbnM6IE1lbnRpb25PcHRpb25bXSA9IFtdO1xuICBkZXRlY3RlZENvZGVMYW5ndWFnZTogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG4gIGNvZGVEZXRlY3Rpb25EaXNtaXNzZWQgPSBmYWxzZTtcbiAgcHJpdmF0ZSByZWFkb25seSBkcmFmdFByZWZpeCA9ICdtZXNzYWdpbmdfZHJhZnRfJztcbiAgcHJpdmF0ZSBsYXN0Q29udmVyc2F0aW9uSWQ6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIHJlc2l6aW5nID0gZmFsc2U7XG4gIHByaXZhdGUgcmVzaXplU3RhcnRZID0gMDtcbiAgcHJpdmF0ZSByZXNpemVTdGFydEhlaWdodCA9IDA7XG4gIHByaXZhdGUgcmVhZG9ubHkgbWluVGV4dGFyZWFIZWlnaHQgPSAzNjtcbiAgcHJpdmF0ZSByZWFkb25seSBtYXhUZXh0YXJlYUhlaWdodCA9IDE4MDtcbiAgcHJpdmF0ZSBtYW51YWxUZXh0YXJlYUhlaWdodCA9IHRoaXMubWluVGV4dGFyZWFIZWlnaHQ7XG4gIHByaXZhdGUgYWN0aXZlTWVudGlvblN0YXJ0ID0gLTE7XG4gIHByaXZhdGUgYWN0aXZlTWVudGlvbkVuZCA9IC0xO1xuICBwcml2YXRlIGJvdW5kUmVzaXplTW92ZSA9IHRoaXMub25SZXNpemVNb3ZlLmJpbmQodGhpcyk7XG4gIHByaXZhdGUgYm91bmRSZXNpemVFbmQgPSB0aGlzLm9uUmVzaXplRW5kLmJpbmQodGhpcyk7XG5cbiAgbmdPbkNoYW5nZXMoY2hhbmdlczogU2ltcGxlQ2hhbmdlcyk6IHZvaWQge1xuICAgIGlmICghY2hhbmdlc1snY29udmVyc2F0aW9uSWQnXSkgcmV0dXJuO1xuICAgIGlmICh0aGlzLmxhc3RDb252ZXJzYXRpb25JZCAmJiB0aGlzLmxhc3RDb252ZXJzYXRpb25JZCAhPT0gdGhpcy5jb252ZXJzYXRpb25JZCkge1xuICAgICAgdGhpcy5wZXJzaXN0RHJhZnQodGhpcy5sYXN0Q29udmVyc2F0aW9uSWQsIHRoaXMubWVzc2FnZVRleHQpO1xuICAgIH1cbiAgICB0aGlzLmxhc3RDb252ZXJzYXRpb25JZCA9IHRoaXMuY29udmVyc2F0aW9uSWQ7XG4gICAgdGhpcy5tZXNzYWdlVGV4dCA9IHRoaXMubG9hZERyYWZ0KHRoaXMuY29udmVyc2F0aW9uSWQpO1xuICAgIHRoaXMudXBkYXRlQ29kZURldGVjdGlvbih0aGlzLm1lc3NhZ2VUZXh0KTtcbiAgICB0aGlzLnF1ZXVlQXV0b1Jlc2l6ZSgpO1xuICB9XG5cbiAgbmdBZnRlclZpZXdJbml0KCk6IHZvaWQge1xuICAgIHRoaXMucXVldWVBdXRvUmVzaXplKCk7XG4gIH1cblxuICBuZ09uRGVzdHJveSgpOiB2b2lkIHtcbiAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCB0aGlzLmJvdW5kUmVzaXplTW92ZSk7XG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIHRoaXMuYm91bmRSZXNpemVFbmQpO1xuICAgIGRvY3VtZW50LmJvZHkuc3R5bGUuY3Vyc29yID0gJyc7XG4gICAgZG9jdW1lbnQuYm9keS5zdHlsZS51c2VyU2VsZWN0ID0gJyc7XG4gIH1cblxuICBnZXQgY2FuU2VuZCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy5tZXNzYWdlVGV4dC50cmltKCkubGVuZ3RoID4gMCB8fCB0aGlzLnNlbGVjdGVkRmlsZXMubGVuZ3RoID4gMDtcbiAgfVxuXG4gIHNlbmQoKTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLmNhblNlbmQpIHJldHVybjtcbiAgICBjb25zdCB0ZXh0ID0gdGhpcy5tZXNzYWdlVGV4dC50cmltKCk7XG4gICAgY29uc3QgZm9yY2VQbGFpblRleHQgPSAhIXRoaXMuZGV0ZWN0ZWRDb2RlTGFuZ3VhZ2UgJiYgdGhpcy5jb2RlRGV0ZWN0aW9uRGlzbWlzc2VkO1xuXG4gICAgaWYgKHRoaXMuc2VsZWN0ZWRGaWxlcy5sZW5ndGggPiAwKSB7XG4gICAgICB0aGlzLm1lc3NhZ2VXaXRoRmlsZXMuZW1pdCh7IHRleHQsIGZpbGVzOiBbLi4udGhpcy5zZWxlY3RlZEZpbGVzXSwgZm9yY2VQbGFpblRleHQgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMubWVzc2FnZVNlbnQuZW1pdCh7IHRleHQsIGZvcmNlUGxhaW5UZXh0IH0pO1xuICAgIH1cblxuICAgIHRoaXMucmVzZXRDb21wb3Nlcih0cnVlKTtcbiAgfVxuXG4gIHByaXZhdGUgcmVzZXRDb21wb3NlcihjbGVhckRyYWZ0OiBib29sZWFuKTogdm9pZCB7XG4gICAgdGhpcy5tZXNzYWdlVGV4dCA9ICcnO1xuICAgIHRoaXMuc2VsZWN0ZWRGaWxlcyA9IFtdO1xuICAgIHRoaXMubWVudGlvblN1Z2dlc3Rpb25zID0gW107XG4gICAgdGhpcy5kZXRlY3RlZENvZGVMYW5ndWFnZSA9IG51bGw7XG4gICAgdGhpcy5jb2RlRGV0ZWN0aW9uRGlzbWlzc2VkID0gZmFsc2U7XG4gICAgdGhpcy5tYW51YWxUZXh0YXJlYUhlaWdodCA9IHRoaXMubWluVGV4dGFyZWFIZWlnaHQ7XG4gICAgaWYgKGNsZWFyRHJhZnQpIHRoaXMuY2xlYXJEcmFmdCh0aGlzLmNvbnZlcnNhdGlvbklkKTtcbiAgICBpZiAodGhpcy5maWxlSW5wdXQpIHRoaXMuZmlsZUlucHV0Lm5hdGl2ZUVsZW1lbnQudmFsdWUgPSAnJztcbiAgICB0aGlzLnF1ZXVlQXV0b1Jlc2l6ZSgpO1xuICB9XG5cbiAgb25UZXh0Q2hhbmdlKHZhbHVlOiBzdHJpbmcpOiB2b2lkIHtcbiAgICB0aGlzLm1lc3NhZ2VUZXh0ID0gdmFsdWU7XG4gICAgdGhpcy5wZXJzaXN0RHJhZnQodGhpcy5jb252ZXJzYXRpb25JZCwgdmFsdWUpO1xuICAgIHRoaXMudXBkYXRlTWVudGlvblN1Z2dlc3Rpb25zKCk7XG4gICAgdGhpcy51cGRhdGVDb2RlRGV0ZWN0aW9uKHZhbHVlKTtcbiAgICB0aGlzLnF1ZXVlQXV0b1Jlc2l6ZSgpO1xuICB9XG5cbiAgb25QYXN0ZShldmVudDogQ2xpcGJvYXJkRXZlbnQpOiB2b2lkIHtcbiAgICBjb25zdCBjbGlwYm9hcmRJdGVtcyA9IEFycmF5LmZyb20oZXZlbnQuY2xpcGJvYXJkRGF0YT8uaXRlbXMgfHwgW10pO1xuICAgIGNvbnN0IGltYWdlRmlsZXMgPSBjbGlwYm9hcmRJdGVtc1xuICAgICAgLmZpbHRlcigoaXRlbSkgPT4gaXRlbS5raW5kID09PSAnZmlsZScgJiYgaXRlbS50eXBlLnN0YXJ0c1dpdGgoJ2ltYWdlLycpKVxuICAgICAgLm1hcCgoaXRlbSkgPT4gaXRlbS5nZXRBc0ZpbGUoKSlcbiAgICAgIC5maWx0ZXIoKGZpbGUpOiBmaWxlIGlzIEZpbGUgPT4gISFmaWxlKVxuICAgICAgLm1hcCgoZmlsZSkgPT4gdGhpcy5uYW1lQ2xpcGJvYXJkSW1hZ2UoZmlsZSkpO1xuXG4gICAgaWYgKGltYWdlRmlsZXMubGVuZ3RoID4gMCkge1xuICAgICAgdGhpcy5hZGRGaWxlcyhpbWFnZUZpbGVzKTtcbiAgICAgIGNvbnN0IHRleHQgPSBldmVudC5jbGlwYm9hcmREYXRhPy5nZXREYXRhKCd0ZXh0L3BsYWluJykgfHwgJyc7XG4gICAgICBpZiAoIXRleHQudHJpbSgpKSB7XG4gICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgaHRtbCA9IGV2ZW50LmNsaXBib2FyZERhdGE/LmdldERhdGEoJ3RleHQvaHRtbCcpIHx8ICcnO1xuICAgIGlmICghaHRtbCB8fCAhLzx0YWJsZVtcXHM+XS9pLnRlc3QoaHRtbCkpIHJldHVybjtcblxuICAgIGNvbnN0IHRhYmxlVGV4dCA9IHRoaXMuaHRtbFRhYmxlVG9UZXh0KGh0bWwpO1xuICAgIGlmICghdGFibGVUZXh0KSByZXR1cm47XG5cbiAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIHRoaXMuaW5zZXJ0VGV4dEF0Q3Vyc29yKHRhYmxlVGV4dCk7XG4gIH1cblxuICBhdXRvUmVzaXplKCk6IHZvaWQge1xuICAgIGNvbnN0IGVsID0gdGhpcy5tZXNzYWdlVGV4dGFyZWE/Lm5hdGl2ZUVsZW1lbnQ7XG4gICAgaWYgKCFlbCkgcmV0dXJuO1xuICAgIGVsLnN0eWxlLmhlaWdodCA9ICdhdXRvJztcbiAgICBjb25zdCBuZXh0SGVpZ2h0ID0gTWF0aC5taW4oXG4gICAgICBNYXRoLm1heChlbC5zY3JvbGxIZWlnaHQsIHRoaXMubWFudWFsVGV4dGFyZWFIZWlnaHQsIHRoaXMubWluVGV4dGFyZWFIZWlnaHQpLFxuICAgICAgdGhpcy5tYXhUZXh0YXJlYUhlaWdodFxuICAgICk7XG4gICAgdGhpcy50ZXh0YXJlYUhlaWdodCA9IG5leHRIZWlnaHQ7XG4gICAgZWwuc3R5bGUuaGVpZ2h0ID0gYCR7bmV4dEhlaWdodH1weGA7XG4gICAgZWwuc3R5bGUub3ZlcmZsb3dZID0gbmV4dEhlaWdodCA+PSB0aGlzLm1heFRleHRhcmVhSGVpZ2h0ID8gJ2F1dG8nIDogJ2hpZGRlbic7XG4gIH1cblxuICBvblJlc2l6ZVN0YXJ0KGV2ZW50OiBNb3VzZUV2ZW50KTogdm9pZCB7XG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICB0aGlzLnJlc2l6aW5nID0gdHJ1ZTtcbiAgICB0aGlzLnJlc2l6ZVN0YXJ0WSA9IGV2ZW50LmNsaWVudFk7XG4gICAgdGhpcy5yZXNpemVTdGFydEhlaWdodCA9IHRoaXMudGV4dGFyZWFIZWlnaHQ7XG4gICAgZG9jdW1lbnQuYm9keS5zdHlsZS5jdXJzb3IgPSAnbnMtcmVzaXplJztcbiAgICBkb2N1bWVudC5ib2R5LnN0eWxlLnVzZXJTZWxlY3QgPSAnbm9uZSc7XG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgdGhpcy5ib3VuZFJlc2l6ZU1vdmUpO1xuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCB0aGlzLmJvdW5kUmVzaXplRW5kKTtcbiAgfVxuXG4gIHByaXZhdGUgb25SZXNpemVNb3ZlKGV2ZW50OiBNb3VzZUV2ZW50KTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLnJlc2l6aW5nKSByZXR1cm47XG4gICAgY29uc3QgZHkgPSB0aGlzLnJlc2l6ZVN0YXJ0WSAtIGV2ZW50LmNsaWVudFk7XG4gICAgY29uc3QgbmV4dEhlaWdodCA9IE1hdGgubWF4KFxuICAgICAgdGhpcy5taW5UZXh0YXJlYUhlaWdodCxcbiAgICAgIE1hdGgubWluKHRoaXMubWF4VGV4dGFyZWFIZWlnaHQsIHRoaXMucmVzaXplU3RhcnRIZWlnaHQgKyBkeSlcbiAgICApO1xuICAgIHRoaXMubWFudWFsVGV4dGFyZWFIZWlnaHQgPSBuZXh0SGVpZ2h0O1xuICAgIHRoaXMudGV4dGFyZWFIZWlnaHQgPSBuZXh0SGVpZ2h0O1xuICB9XG5cbiAgcHJpdmF0ZSBvblJlc2l6ZUVuZCgpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMucmVzaXppbmcpIHJldHVybjtcbiAgICB0aGlzLnJlc2l6aW5nID0gZmFsc2U7XG4gICAgZG9jdW1lbnQuYm9keS5zdHlsZS5jdXJzb3IgPSAnJztcbiAgICBkb2N1bWVudC5ib2R5LnN0eWxlLnVzZXJTZWxlY3QgPSAnJztcbiAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCB0aGlzLmJvdW5kUmVzaXplTW92ZSk7XG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIHRoaXMuYm91bmRSZXNpemVFbmQpO1xuICB9XG5cbiAgcHJpdmF0ZSBxdWV1ZUF1dG9SZXNpemUoKTogdm9pZCB7XG4gICAgc2V0VGltZW91dCgoKSA9PiB0aGlzLmF1dG9SZXNpemUoKSk7XG4gIH1cblxuICBwcml2YXRlIGRyYWZ0S2V5KGNvbnZlcnNhdGlvbklkOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIHJldHVybiBgJHt0aGlzLmRyYWZ0UHJlZml4fSR7Y29udmVyc2F0aW9uSWR9YDtcbiAgfVxuXG4gIHByaXZhdGUgbG9hZERyYWZ0KGNvbnZlcnNhdGlvbklkOiBzdHJpbmcgfCBudWxsKTogc3RyaW5nIHtcbiAgICBpZiAoIWNvbnZlcnNhdGlvbklkKSByZXR1cm4gJyc7XG4gICAgcmV0dXJuIGxvY2FsU3RvcmFnZS5nZXRJdGVtKHRoaXMuZHJhZnRLZXkoY29udmVyc2F0aW9uSWQpKSB8fCAnJztcbiAgfVxuXG4gIHByaXZhdGUgcGVyc2lzdERyYWZ0KGNvbnZlcnNhdGlvbklkOiBzdHJpbmcgfCBudWxsLCB2YWx1ZTogc3RyaW5nKTogdm9pZCB7XG4gICAgaWYgKCFjb252ZXJzYXRpb25JZCkgcmV0dXJuO1xuICAgIGNvbnN0IGtleSA9IHRoaXMuZHJhZnRLZXkoY29udmVyc2F0aW9uSWQpO1xuICAgIGlmICh2YWx1ZS50cmltKCkpIHtcbiAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKGtleSwgdmFsdWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbShrZXkpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgY2xlYXJEcmFmdChjb252ZXJzYXRpb25JZDogc3RyaW5nIHwgbnVsbCk6IHZvaWQge1xuICAgIGlmICghY29udmVyc2F0aW9uSWQpIHJldHVybjtcbiAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSh0aGlzLmRyYWZ0S2V5KGNvbnZlcnNhdGlvbklkKSk7XG4gIH1cblxuICBwcml2YXRlIGh0bWxUYWJsZVRvVGV4dChodG1sOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBkb2MgPSBuZXcgRE9NUGFyc2VyKCkucGFyc2VGcm9tU3RyaW5nKGh0bWwsICd0ZXh0L2h0bWwnKTtcbiAgICAgIGNvbnN0IHRhYmxlID0gZG9jLnF1ZXJ5U2VsZWN0b3IoJ3RhYmxlJyk7XG4gICAgICBpZiAoIXRhYmxlKSByZXR1cm4gJyc7XG5cbiAgICAgIGNvbnN0IHJvd3MgPSBBcnJheS5mcm9tKHRhYmxlLnF1ZXJ5U2VsZWN0b3JBbGwoJ3RyJykpO1xuICAgICAgcmV0dXJuIHJvd3NcbiAgICAgICAgLm1hcCgocm93KSA9PlxuICAgICAgICAgIEFycmF5LmZyb20ocm93LnF1ZXJ5U2VsZWN0b3JBbGwoJ3RoLHRkJykpXG4gICAgICAgICAgICAubWFwKChjZWxsKSA9PiAoY2VsbC50ZXh0Q29udGVudCB8fCAnJykucmVwbGFjZSgvXFxzKy9nLCAnICcpLnRyaW0oKSlcbiAgICAgICAgICAgIC5qb2luKCdcXHQnKVxuICAgICAgICApXG4gICAgICAgIC5maWx0ZXIoQm9vbGVhbilcbiAgICAgICAgLmpvaW4oJ1xcbicpO1xuICAgIH0gY2F0Y2gge1xuICAgICAgcmV0dXJuICcnO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgaW5zZXJ0VGV4dEF0Q3Vyc29yKHRleHQ6IHN0cmluZyk6IHZvaWQge1xuICAgIGNvbnN0IHRleHRhcmVhID0gdGhpcy5tZXNzYWdlVGV4dGFyZWE/Lm5hdGl2ZUVsZW1lbnQ7XG4gICAgaWYgKCF0ZXh0YXJlYSkge1xuICAgICAgdGhpcy5vblRleHRDaGFuZ2UoYCR7dGhpcy5tZXNzYWdlVGV4dH0ke3RleHR9YCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3Qgc3RhcnQgPSB0ZXh0YXJlYS5zZWxlY3Rpb25TdGFydCA/PyB0aGlzLm1lc3NhZ2VUZXh0Lmxlbmd0aDtcbiAgICBjb25zdCBlbmQgPSB0ZXh0YXJlYS5zZWxlY3Rpb25FbmQgPz8gdGhpcy5tZXNzYWdlVGV4dC5sZW5ndGg7XG4gICAgY29uc3QgbmV4dCA9IGAke3RoaXMubWVzc2FnZVRleHQuc2xpY2UoMCwgc3RhcnQpfSR7dGV4dH0ke3RoaXMubWVzc2FnZVRleHQuc2xpY2UoZW5kKX1gO1xuICAgIHRoaXMub25UZXh0Q2hhbmdlKG5leHQpO1xuICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgdGV4dGFyZWEuc2VsZWN0aW9uU3RhcnQgPSB0ZXh0YXJlYS5zZWxlY3Rpb25FbmQgPSBzdGFydCArIHRleHQubGVuZ3RoO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBuYW1lQ2xpcGJvYXJkSW1hZ2UoZmlsZTogRmlsZSk6IEZpbGUge1xuICAgIGNvbnN0IGV4dGVuc2lvbiA9IGZpbGUudHlwZS5zcGxpdCgnLycpWzFdPy5yZXBsYWNlKCdqcGVnJywgJ2pwZycpIHx8ICdwbmcnO1xuICAgIGNvbnN0IGZpbGVuYW1lID0gYGNsaXBib2FyZC1pbWFnZS0ke25ldyBEYXRlKCkudG9JU09TdHJpbmcoKS5yZXBsYWNlKC9bOi5dL2csICctJyl9LiR7ZXh0ZW5zaW9ufWA7XG4gICAgcmV0dXJuIG5ldyBGaWxlKFtmaWxlXSwgZmlsZW5hbWUsIHsgdHlwZTogZmlsZS50eXBlIHx8ICdpbWFnZS9wbmcnLCBsYXN0TW9kaWZpZWQ6IERhdGUubm93KCkgfSk7XG4gIH1cblxuICBmb2N1cygpOiB2b2lkIHtcbiAgICBzZXRUaW1lb3V0KCgpID0+IHRoaXMubWVzc2FnZVRleHRhcmVhPy5uYXRpdmVFbGVtZW50Py5mb2N1cygpKTtcbiAgfVxuXG4gIHVwZGF0ZU1lbnRpb25TdWdnZXN0aW9ucygpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMuZW5hYmxlTWVudGlvbnMgfHwgIXRoaXMubWVudGlvbk9wdGlvbnMubGVuZ3RoKSB7XG4gICAgICB0aGlzLm1lbnRpb25TdWdnZXN0aW9ucyA9IFtdO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHRleHRhcmVhID0gdGhpcy5tZXNzYWdlVGV4dGFyZWE/Lm5hdGl2ZUVsZW1lbnQ7XG4gICAgY29uc3QgY2FyZXQgPSB0ZXh0YXJlYT8uc2VsZWN0aW9uU3RhcnQgPz8gdGhpcy5tZXNzYWdlVGV4dC5sZW5ndGg7XG4gICAgY29uc3QgYmVmb3JlQ2FyZXQgPSB0aGlzLm1lc3NhZ2VUZXh0LnNsaWNlKDAsIGNhcmV0KTtcbiAgICBjb25zdCBtYXRjaCA9IGJlZm9yZUNhcmV0Lm1hdGNoKC8oXnxcXHMpQChbYS16QS1aMC05Ll8tXXswLDMyfSkkLyk7XG4gICAgaWYgKCFtYXRjaCkge1xuICAgICAgdGhpcy5tZW50aW9uU3VnZ2VzdGlvbnMgPSBbXTtcbiAgICAgIHRoaXMuYWN0aXZlTWVudGlvblN0YXJ0ID0gLTE7XG4gICAgICB0aGlzLmFjdGl2ZU1lbnRpb25FbmQgPSAtMTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBxdWVyeSA9IChtYXRjaFsyXSB8fCAnJykudG9Mb3dlckNhc2UoKTtcbiAgICB0aGlzLmFjdGl2ZU1lbnRpb25FbmQgPSBjYXJldDtcbiAgICB0aGlzLmFjdGl2ZU1lbnRpb25TdGFydCA9IGNhcmV0IC0gcXVlcnkubGVuZ3RoIC0gMTtcbiAgICB0aGlzLm1lbnRpb25TdWdnZXN0aW9ucyA9IHRoaXMubWVudGlvbk9wdGlvbnNcbiAgICAgIC5maWx0ZXIoKG9wdGlvbikgPT5cbiAgICAgICAgb3B0aW9uLnRva2VuLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMocXVlcnkpIHx8XG4gICAgICAgIG9wdGlvbi5sYWJlbC50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKHF1ZXJ5KVxuICAgICAgKVxuICAgICAgLnNsaWNlKDAsIDUpO1xuICB9XG5cbiAgaW5zZXJ0TWVudGlvbihvcHRpb246IE1lbnRpb25PcHRpb24pOiB2b2lkIHtcbiAgICBpZiAodGhpcy5hY3RpdmVNZW50aW9uU3RhcnQgPCAwKSByZXR1cm47XG4gICAgY29uc3Qgc3RhcnQgPSB0aGlzLmFjdGl2ZU1lbnRpb25TdGFydDtcbiAgICBjb25zdCBlbmQgPSB0aGlzLmFjdGl2ZU1lbnRpb25FbmQgPj0gc3RhcnQgPyB0aGlzLmFjdGl2ZU1lbnRpb25FbmQgOiB0aGlzLm1lc3NhZ2VUZXh0Lmxlbmd0aDtcbiAgICBjb25zdCBtZW50aW9uVGV4dCA9IGBAJHtvcHRpb24udG9rZW59IGA7XG4gICAgY29uc3QgbmV4dCA9IGAke3RoaXMubWVzc2FnZVRleHQuc2xpY2UoMCwgc3RhcnQpfSR7bWVudGlvblRleHR9JHt0aGlzLm1lc3NhZ2VUZXh0LnNsaWNlKGVuZCl9YDtcbiAgICB0aGlzLm9uVGV4dENoYW5nZShuZXh0KTtcbiAgICB0aGlzLm1lbnRpb25TdWdnZXN0aW9ucyA9IFtdO1xuICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgY29uc3QgdGV4dGFyZWEgPSB0aGlzLm1lc3NhZ2VUZXh0YXJlYT8ubmF0aXZlRWxlbWVudDtcbiAgICAgIGlmICghdGV4dGFyZWEpIHJldHVybjtcbiAgICAgIGNvbnN0IGNhcmV0ID0gc3RhcnQgKyBtZW50aW9uVGV4dC5sZW5ndGg7XG4gICAgICB0ZXh0YXJlYS5mb2N1cygpO1xuICAgICAgdGV4dGFyZWEuc2VsZWN0aW9uU3RhcnQgPSB0ZXh0YXJlYS5zZWxlY3Rpb25FbmQgPSBjYXJldDtcbiAgICAgIHRoaXMucXVldWVBdXRvUmVzaXplKCk7XG4gICAgfSk7XG4gIH1cblxuICBkaXNtaXNzQ29kZURldGVjdGlvbigpOiB2b2lkIHtcbiAgICB0aGlzLmNvZGVEZXRlY3Rpb25EaXNtaXNzZWQgPSB0cnVlO1xuICB9XG5cbiAgcHJpdmF0ZSB1cGRhdGVDb2RlRGV0ZWN0aW9uKHZhbHVlOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBjb25zdCBsYW5ndWFnZSA9IHRoaXMuZGV0ZWN0Q29kZUxhbmd1YWdlKHZhbHVlKTtcbiAgICBpZiAoIWxhbmd1YWdlKSB7XG4gICAgICB0aGlzLmRldGVjdGVkQ29kZUxhbmd1YWdlID0gbnVsbDtcbiAgICAgIHRoaXMuY29kZURldGVjdGlvbkRpc21pc3NlZCA9IGZhbHNlO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAobGFuZ3VhZ2UgIT09IHRoaXMuZGV0ZWN0ZWRDb2RlTGFuZ3VhZ2UpIHtcbiAgICAgIHRoaXMuY29kZURldGVjdGlvbkRpc21pc3NlZCA9IGZhbHNlO1xuICAgIH1cbiAgICB0aGlzLmRldGVjdGVkQ29kZUxhbmd1YWdlID0gbGFuZ3VhZ2U7XG4gIH1cblxuICBwcml2YXRlIGRldGVjdENvZGVMYW5ndWFnZSh2YWx1ZTogc3RyaW5nKTogc3RyaW5nIHwgbnVsbCB7XG4gICAgY29uc3QgdHJpbW1lZCA9IHZhbHVlLnRyaW0oKTtcbiAgICBpZiAoIXRyaW1tZWQgfHwgdGhpcy5sb29rc0xpa2VNYXJrZG93bih0cmltbWVkKSB8fCB0aGlzLmlzVGFibGVDb250ZW50KHRyaW1tZWQpKSByZXR1cm4gbnVsbDtcbiAgICBjb25zdCBmZW5jZWQgPSB0cmltbWVkLm1hdGNoKC9eYGBgKFthLXpBLVowLTlfKy1dKilcXHMqXFxuP1tcXHNcXFNdKj9gYGAkLyk7XG4gICAgaWYgKGZlbmNlZCkgcmV0dXJuIChmZW5jZWRbMV0gfHwgJ2NvZGUnKS50b0xvd2VyQ2FzZSgpO1xuICAgIGlmICghdHJpbW1lZC5pbmNsdWRlcygnXFxuJykgJiYgdHJpbW1lZC5sZW5ndGggPCA0MCkgcmV0dXJuIG51bGw7XG4gICAgaWYgKC9eXFxzKihzZWxlY3R8d2l0aHxpbnNlcnR8dXBkYXRlfGRlbGV0ZXxjcmVhdGV8YWx0ZXJ8ZHJvcClcXGIvaS50ZXN0KHRyaW1tZWQpKSByZXR1cm4gJ3NxbCc7XG4gICAgY29uc3QganNEZWNsYXJhdGlvbiA9IC9cXGIoZnVuY3Rpb258Y29uc3R8bGV0fHZhcilcXHMrW0EtWmEtel8kXVtcXHckXSpcXHMqKD18PT58XFwofDopLy50ZXN0KHRyaW1tZWQpO1xuICAgIGNvbnN0IGpzU3ludGF4ID0gLyg9Pnxjb25zb2xlXFwubG9nfGltcG9ydFxccysuKmZyb218ZXhwb3J0XFxzK3xbe307XSkvLnRlc3QodHJpbW1lZCk7XG4gICAgaWYgKGpzRGVjbGFyYXRpb24gfHwganNTeW50YXgpIHJldHVybiAnamF2YXNjcmlwdCc7XG4gICAgaWYgKC9cXGIoZGVmfGltcG9ydHxmcm9tfHByaW50fGNsYXNzKVxcYi8udGVzdCh0cmltbWVkKSAmJiAvOlxccyokfF5cXHN7NH0vbS50ZXN0KHRyaW1tZWQpKSByZXR1cm4gJ3B5dGhvbic7XG4gICAgaWYgKC88XFwvP1thLXpdW1xcc1xcU10qPi9pLnRlc3QodHJpbW1lZCkpIHJldHVybiAnaHRtbCc7XG4gICAgaWYgKC9be307XS8udGVzdCh0cmltbWVkKSAmJiAvWzo9XS8udGVzdCh0cmltbWVkKSkgcmV0dXJuICdjb2RlJztcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHByaXZhdGUgbG9va3NMaWtlTWFya2Rvd24oY29udGVudDogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIC8oXiN7MSw2fVxccyl8KF5bLSpdXFxzKXwoXlxcZCtcXC5cXHMpfChePlxccyl8KFxcKlxcKlteKl0rXFwqXFwqKXwoYFteYF0rYCl8KFxcW1teXFxdXStcXF1cXChbXildK1xcKSl8KF4tLS0kKXwoXi1cXHNcXFtbIHhdXFxdXFxzKXwoXmBgYFthLXpBLVowLTlfKy1dKlxccyokKS9tLnRlc3QoY29udGVudCk7XG4gIH1cblxuICBwcml2YXRlIGlzVGFibGVDb250ZW50KGNvbnRlbnQ6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIGlmICghY29udGVudC5pbmNsdWRlcygnXFx0JykpIHJldHVybiBmYWxzZTtcbiAgICBjb25zdCByb3dzID0gY29udGVudFxuICAgICAgLnNwbGl0KC9cXHI/XFxuLylcbiAgICAgIC5tYXAoKHJvdykgPT4gcm93LnNwbGl0KCdcXHQnKS5tYXAoKGNlbGwpID0+IGNlbGwudHJpbSgpKSlcbiAgICAgIC5maWx0ZXIoKHJvdykgPT4gcm93LnNvbWUoQm9vbGVhbikpO1xuICAgIHJldHVybiByb3dzLmxlbmd0aCA+PSAyICYmIHJvd3Muc29tZSgocm93KSA9PiByb3cubGVuZ3RoID49IDIpO1xuICB9XG5cbiAgb25LZXlkb3duKGV2ZW50OiBLZXlib2FyZEV2ZW50KTogdm9pZCB7XG4gICAgaWYgKGV2ZW50LmtleSA9PT0gJ0VzY2FwZScgJiYgdGhpcy5tZW50aW9uU3VnZ2VzdGlvbnMubGVuZ3RoID4gMCkge1xuICAgICAgdGhpcy5tZW50aW9uU3VnZ2VzdGlvbnMgPSBbXTtcbiAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKGV2ZW50LmtleSA9PT0gJ0VudGVyJyAmJiB0aGlzLm1lbnRpb25TdWdnZXN0aW9ucy5sZW5ndGggPiAwKSB7XG4gICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgdGhpcy5pbnNlcnRNZW50aW9uKHRoaXMubWVudGlvblN1Z2dlc3Rpb25zWzBdKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoZXZlbnQua2V5ID09PSAnRW50ZXInICYmICFldmVudC5zaGlmdEtleSkge1xuICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICAgIHRoaXMuc2VuZCgpO1xuICAgIH1cbiAgfVxuXG4gIG9uRW50ZXIoZXZlbnQ6IEV2ZW50KTogdm9pZCB7XG4gICAgY29uc3Qga2UgPSBldmVudCBhcyBLZXlib2FyZEV2ZW50O1xuICAgIGlmICgha2Uuc2hpZnRLZXkpIHtcbiAgICAgIGtlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICB0aGlzLnNlbmQoKTtcbiAgICB9XG4gIH1cblxuICBvbkZpbGVzU2VsZWN0ZWQoZXZlbnQ6IEV2ZW50KTogdm9pZCB7XG4gICAgY29uc3QgaW5wdXQgPSBldmVudC50YXJnZXQgYXMgSFRNTElucHV0RWxlbWVudDtcbiAgICBpZiAoaW5wdXQuZmlsZXMpIHtcbiAgICAgIHRoaXMuYWRkRmlsZXMoQXJyYXkuZnJvbShpbnB1dC5maWxlcykpO1xuICAgIH1cbiAgfVxuXG4gIGFkZEZpbGVzKGZpbGVzOiBGaWxlW10pOiB2b2lkIHtcbiAgICBpZiAoIWZpbGVzLmxlbmd0aCkgcmV0dXJuO1xuICAgIHRoaXMuc2VsZWN0ZWRGaWxlcyA9IFsuLi50aGlzLnNlbGVjdGVkRmlsZXMsIC4uLmZpbGVzXTtcbiAgfVxuXG4gIHJlbW92ZUZpbGUoaW5kZXg6IG51bWJlcik6IHZvaWQge1xuICAgIHRoaXMuc2VsZWN0ZWRGaWxlcy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgIHRoaXMuc2VsZWN0ZWRGaWxlcyA9IFsuLi50aGlzLnNlbGVjdGVkRmlsZXNdO1xuICB9XG5cbiAgZ2V0RmlsZUljb24oZmlsZTogRmlsZSk6IHN0cmluZyB7XG4gICAgY29uc3QgdHlwZSA9IGZpbGUudHlwZTtcbiAgICBpZiAodHlwZS5zdGFydHNXaXRoKCdpbWFnZS8nKSkgcmV0dXJuICdpbWFnZSc7XG4gICAgaWYgKHR5cGUuc3RhcnRzV2l0aCgndmlkZW8vJykpIHJldHVybiAndmlkZW9jYW0nO1xuICAgIGlmICh0eXBlLnN0YXJ0c1dpdGgoJ2F1ZGlvLycpKSByZXR1cm4gJ2F1ZGlvdHJhY2snO1xuICAgIGlmICh0eXBlLmluY2x1ZGVzKCdwZGYnKSkgcmV0dXJuICdwaWN0dXJlX2FzX3BkZic7XG4gICAgaWYgKHR5cGUuaW5jbHVkZXMoJ3NwcmVhZHNoZWV0JykgfHwgdHlwZS5pbmNsdWRlcygnZXhjZWwnKSkgcmV0dXJuICd0YWJsZV9jaGFydCc7XG4gICAgaWYgKHR5cGUuaW5jbHVkZXMoJ2RvY3VtZW50JykgfHwgdHlwZS5pbmNsdWRlcygnd29yZCcpKSByZXR1cm4gJ2Rlc2NyaXB0aW9uJztcbiAgICByZXR1cm4gJ2luc2VydF9kcml2ZV9maWxlJztcbiAgfVxuXG4gIGZvcm1hdFNpemUoYnl0ZXM6IG51bWJlcik6IHN0cmluZyB7XG4gICAgaWYgKGJ5dGVzIDwgMTAyNCkgcmV0dXJuIGJ5dGVzICsgJyBCJztcbiAgICBpZiAoYnl0ZXMgPCAxMDI0ICogMTAyNCkgcmV0dXJuIChieXRlcyAvIDEwMjQpLnRvRml4ZWQoMCkgKyAnIEtCJztcbiAgICByZXR1cm4gKGJ5dGVzIC8gKDEwMjQgKiAxMDI0KSkudG9GaXhlZCgxKSArICcgTUInO1xuICB9XG59XG4iXX0=