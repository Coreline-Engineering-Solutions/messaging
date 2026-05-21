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
        if (this.selectedFiles.length > 0) {
            this.messageWithFiles.emit({ text, files: [...this.selectedFiles] });
        }
        else {
            this.messageSent.emit(text);
        }
        this.messageText = '';
        this.selectedFiles = [];
        this.mentionSuggestions = [];
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
  `, isInline: true, styles: [".message-input-container{padding:8px 12px;border-top:1px solid rgba(255,255,255,.15);background:transparent;position:relative}.input-resize-handle{position:absolute;top:-5px;left:0;right:0;height:10px;display:flex;align-items:center;justify-content:center;cursor:ns-resize;z-index:2}.input-resize-handle span{width:42px;height:3px;border-radius:999px;background:#ffffff38;transition:background .15s,width .15s}.input-resize-handle:hover span{width:56px;background:#ffffff6b}.file-previews{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;max-height:80px;overflow-y:auto}.reply-compose-preview{display:flex;align-items:center;gap:8px;margin-bottom:8px;padding:8px 10px;border-radius:12px;background:#7fb4ff1f;border-left:3px solid rgba(127,180,255,.8);color:#fff}.reply-compose-preview>mat-icon{color:#bfdbfe;font-size:18px;width:18px;height:18px;flex-shrink:0}.reply-compose-text{min-width:0;flex:1}.reply-compose-text span{display:block;font-size:11px;font-weight:700;color:#bfdbfe;margin-bottom:2px}.reply-compose-text p{margin:0;font-size:12px;color:#ffffffc7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.reply-cancel-btn{width:24px;height:24px;border:none;border-radius:999px;background:#ffffff14;color:#fffc;display:inline-flex;align-items:center;justify-content:center;padding:0;cursor:pointer;flex-shrink:0}.reply-cancel-btn mat-icon{font-size:16px;width:16px;height:16px}.mention-suggestions{margin-bottom:8px;border-radius:12px;overflow:hidden;background:#071d30;border:1px solid rgba(127,180,255,.22);box-shadow:0 10px 24px #0000003d}.mention-suggestion{width:100%;border:none;background:transparent;color:#fff;display:flex;align-items:center;gap:8px;padding:8px 10px;cursor:pointer;text-align:left}.mention-suggestion:hover,.mention-suggestion:focus{background:#7fb4ff24;outline:none}.mention-avatar{width:22px;height:22px;border-radius:999px;background:#7fb4ff38;color:#bfdbfe;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex-shrink:0}.mention-suggestion small{margin-left:auto;color:#ffffff85;font-size:11px}.file-chip{display:flex;align-items:center;gap:4px;background:#ffffff26;border-radius:8px;padding:4px 4px 4px 8px;max-width:200px}.file-icon{font-size:16px;width:16px;height:16px;color:#fffc}.file-name{font-size:12px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100px}.file-size{font-size:10px;color:#ffffff80;flex-shrink:0}.file-remove{width:20px!important;height:20px!important}.file-remove mat-icon{font-size:14px;width:14px;height:14px;color:#fff9}.input-wrapper{display:flex;align-items:flex-end;gap:4px;background:#ffffff1a;border-radius:24px;padding:2px 4px}.attach-btn,.send-btn{flex-shrink:0;width:36px;height:36px;padding:0!important;margin:0;min-width:36px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;line-height:0!important}.attach-btn mat-icon,.send-btn mat-icon{color:#ffffffb3;font-size:20px;width:20px;height:20px;line-height:20px;margin:0;display:flex;align-items:center;justify-content:center}.send-btn mat-icon{color:#ffffffe6}.message-textarea{flex:1;border:none;outline:none;background:transparent;resize:none;font-size:14px;font-family:inherit;line-height:1.5;min-height:24px;max-height:180px;padding:7px 0;color:#fff;overflow-y:hidden;box-sizing:border-box}.message-textarea::placeholder{color:#ffffff80}.send-btn:disabled mat-icon{color:#ffffff4d}:host ::ng-deep .attach-btn .mat-mdc-button-touch-target,:host ::ng-deep .send-btn .mat-mdc-button-touch-target{height:36px!important;width:36px!important}:host ::ng-deep .attach-btn .mdc-icon-button__icon,:host ::ng-deep .send-btn .mdc-icon-button__icon{display:flex!important;align-items:center!important;justify-content:center!important;margin:0!important;padding:0!important}\n"], dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i1.NgForOf, selector: "[ngFor][ngForOf]", inputs: ["ngForOf", "ngForTrackBy", "ngForTemplate"] }, { kind: "directive", type: i1.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "ngmodule", type: FormsModule }, { kind: "directive", type: i2.DefaultValueAccessor, selector: "input:not([type=checkbox])[formControlName],textarea[formControlName],input:not([type=checkbox])[formControl],textarea[formControl],input:not([type=checkbox])[ngModel],textarea[ngModel],[ngDefaultControl]" }, { kind: "directive", type: i2.NgControlStatus, selector: "[formControlName],[ngModel],[formControl]" }, { kind: "directive", type: i2.NgModel, selector: "[ngModel]:not([formControlName]):not([formControl])", inputs: ["name", "disabled", "ngModel", "ngModelOptions"], outputs: ["ngModelChange"], exportAs: ["ngModel"] }, { kind: "ngmodule", type: MatIconModule }, { kind: "component", type: i3.MatIcon, selector: "mat-icon", inputs: ["color", "inline", "svgIcon", "fontSet", "fontIcon"], exportAs: ["matIcon"] }, { kind: "ngmodule", type: MatButtonModule }, { kind: "component", type: i4.MatIconButton, selector: "button[mat-icon-button]", exportAs: ["matButton"] }] });
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
  `, styles: [".message-input-container{padding:8px 12px;border-top:1px solid rgba(255,255,255,.15);background:transparent;position:relative}.input-resize-handle{position:absolute;top:-5px;left:0;right:0;height:10px;display:flex;align-items:center;justify-content:center;cursor:ns-resize;z-index:2}.input-resize-handle span{width:42px;height:3px;border-radius:999px;background:#ffffff38;transition:background .15s,width .15s}.input-resize-handle:hover span{width:56px;background:#ffffff6b}.file-previews{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;max-height:80px;overflow-y:auto}.reply-compose-preview{display:flex;align-items:center;gap:8px;margin-bottom:8px;padding:8px 10px;border-radius:12px;background:#7fb4ff1f;border-left:3px solid rgba(127,180,255,.8);color:#fff}.reply-compose-preview>mat-icon{color:#bfdbfe;font-size:18px;width:18px;height:18px;flex-shrink:0}.reply-compose-text{min-width:0;flex:1}.reply-compose-text span{display:block;font-size:11px;font-weight:700;color:#bfdbfe;margin-bottom:2px}.reply-compose-text p{margin:0;font-size:12px;color:#ffffffc7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.reply-cancel-btn{width:24px;height:24px;border:none;border-radius:999px;background:#ffffff14;color:#fffc;display:inline-flex;align-items:center;justify-content:center;padding:0;cursor:pointer;flex-shrink:0}.reply-cancel-btn mat-icon{font-size:16px;width:16px;height:16px}.mention-suggestions{margin-bottom:8px;border-radius:12px;overflow:hidden;background:#071d30;border:1px solid rgba(127,180,255,.22);box-shadow:0 10px 24px #0000003d}.mention-suggestion{width:100%;border:none;background:transparent;color:#fff;display:flex;align-items:center;gap:8px;padding:8px 10px;cursor:pointer;text-align:left}.mention-suggestion:hover,.mention-suggestion:focus{background:#7fb4ff24;outline:none}.mention-avatar{width:22px;height:22px;border-radius:999px;background:#7fb4ff38;color:#bfdbfe;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex-shrink:0}.mention-suggestion small{margin-left:auto;color:#ffffff85;font-size:11px}.file-chip{display:flex;align-items:center;gap:4px;background:#ffffff26;border-radius:8px;padding:4px 4px 4px 8px;max-width:200px}.file-icon{font-size:16px;width:16px;height:16px;color:#fffc}.file-name{font-size:12px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100px}.file-size{font-size:10px;color:#ffffff80;flex-shrink:0}.file-remove{width:20px!important;height:20px!important}.file-remove mat-icon{font-size:14px;width:14px;height:14px;color:#fff9}.input-wrapper{display:flex;align-items:flex-end;gap:4px;background:#ffffff1a;border-radius:24px;padding:2px 4px}.attach-btn,.send-btn{flex-shrink:0;width:36px;height:36px;padding:0!important;margin:0;min-width:36px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;line-height:0!important}.attach-btn mat-icon,.send-btn mat-icon{color:#ffffffb3;font-size:20px;width:20px;height:20px;line-height:20px;margin:0;display:flex;align-items:center;justify-content:center}.send-btn mat-icon{color:#ffffffe6}.message-textarea{flex:1;border:none;outline:none;background:transparent;resize:none;font-size:14px;font-family:inherit;line-height:1.5;min-height:24px;max-height:180px;padding:7px 0;color:#fff;overflow-y:hidden;box-sizing:border-box}.message-textarea::placeholder{color:#ffffff80}.send-btn:disabled mat-icon{color:#ffffff4d}:host ::ng-deep .attach-btn .mat-mdc-button-touch-target,:host ::ng-deep .send-btn .mat-mdc-button-touch-target{height:36px!important;width:36px!important}:host ::ng-deep .attach-btn .mdc-icon-button__icon,:host ::ng-deep .send-btn .mdc-icon-button__icon{display:flex!important;align-items:center!important;justify-content:center!important;margin:0!important;padding:0!important}\n"] }]
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVzc2FnZS1pbnB1dC5jb21wb25lbnQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvbGliL2NvbXBvbmVudHMvbWVzc2FnZS1pbnB1dC9tZXNzYWdlLWlucHV0LmNvbXBvbmVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBRUwsU0FBUyxFQUVULFlBQVksRUFDWixLQUFLLEVBR0wsTUFBTSxFQUVOLFNBQVMsR0FDVixNQUFNLGVBQWUsQ0FBQztBQUN2QixPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDL0MsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLGdCQUFnQixDQUFDO0FBQzdDLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSx3QkFBd0IsQ0FBQztBQUN2RCxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sMEJBQTBCLENBQUM7Ozs7OztBQXFZM0QsTUFBTSxPQUFPLHFCQUFxQjtJQUN2QixjQUFjLEdBQWtCLElBQUksQ0FBQztJQUNyQyxPQUFPLEdBQXdCLElBQUksQ0FBQztJQUNwQyxjQUFjLEdBQUcsS0FBSyxDQUFDO0lBQ3ZCLGNBQWMsR0FBb0IsRUFBRSxDQUFDO0lBQ3BDLFdBQVcsR0FBRyxJQUFJLFlBQVksRUFBVSxDQUFDO0lBQ3pDLGdCQUFnQixHQUFHLElBQUksWUFBWSxFQUFrQixDQUFDO0lBQ3RELGNBQWMsR0FBRyxJQUFJLFlBQVksRUFBUSxDQUFDO0lBQzVCLFNBQVMsQ0FBZ0M7SUFDbkMsZUFBZSxDQUFtQztJQUVoRixXQUFXLEdBQUcsRUFBRSxDQUFDO0lBQ2pCLGFBQWEsR0FBVyxFQUFFLENBQUM7SUFDM0IsY0FBYyxHQUFHLEVBQUUsQ0FBQztJQUNwQixrQkFBa0IsR0FBb0IsRUFBRSxDQUFDO0lBQ3hCLFdBQVcsR0FBRyxrQkFBa0IsQ0FBQztJQUMxQyxrQkFBa0IsR0FBa0IsSUFBSSxDQUFDO0lBQ3pDLFFBQVEsR0FBRyxLQUFLLENBQUM7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TTtnQkFDRyxnQkFBZ0I7c0JBQXpCLE1BQU07Z0JBQ0csY0FBYztzQkFBdkIsTUFBTTtnQkFDaUIsU0FBUztzQkFBaEMsU0FBUzt1QkFBQyxXQUFXO2dCQUNRLGVBQWU7c0JBQTVDLFNBQVM7dUJBQUMsaUJBQWlCIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtcbiAgQWZ0ZXJWaWV3SW5pdCxcbiAgQ29tcG9uZW50LFxuICBFbGVtZW50UmVmLFxuICBFdmVudEVtaXR0ZXIsXG4gIElucHV0LFxuICBPbkNoYW5nZXMsXG4gIE9uRGVzdHJveSxcbiAgT3V0cHV0LFxuICBTaW1wbGVDaGFuZ2VzLFxuICBWaWV3Q2hpbGQsXG59IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xuaW1wb3J0IHsgQ29tbW9uTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvY29tbW9uJztcbmltcG9ydCB7IEZvcm1zTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvZm9ybXMnO1xuaW1wb3J0IHsgTWF0SWNvbk1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL21hdGVyaWFsL2ljb24nO1xuaW1wb3J0IHsgTWF0QnV0dG9uTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvbWF0ZXJpYWwvYnV0dG9uJztcblxuZXhwb3J0IGludGVyZmFjZSBNZXNzYWdlUGF5bG9hZCB7XG4gIHRleHQ6IHN0cmluZztcbiAgZmlsZXM6IEZpbGVbXTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBSZXBseVByZXZpZXcge1xuICBzZW5kZXJOYW1lOiBzdHJpbmc7XG4gIGNvbnRlbnQ6IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBNZW50aW9uT3B0aW9uIHtcbiAgY29udGFjdElkOiBzdHJpbmc7XG4gIGxhYmVsOiBzdHJpbmc7XG4gIHRva2VuOiBzdHJpbmc7XG59XG5cbkBDb21wb25lbnQoe1xuICBzZWxlY3RvcjogJ2FwcC1tZXNzYWdlLWlucHV0JyxcbiAgc3RhbmRhbG9uZTogdHJ1ZSxcbiAgaW1wb3J0czogW0NvbW1vbk1vZHVsZSwgRm9ybXNNb2R1bGUsIE1hdEljb25Nb2R1bGUsIE1hdEJ1dHRvbk1vZHVsZV0sXG4gIHRlbXBsYXRlOiBgXG4gICAgPGRpdlxuICAgICAgY2xhc3M9XCJtZXNzYWdlLWlucHV0LWNvbnRhaW5lclwiXG4gICAgPlxuICAgICAgPGRpdlxuICAgICAgICBjbGFzcz1cImlucHV0LXJlc2l6ZS1oYW5kbGVcIlxuICAgICAgICB0aXRsZT1cIkRyYWcgdXAgdG8gZXhwYW5kIG1lc3NhZ2UgYm94XCJcbiAgICAgICAgKG1vdXNlZG93bik9XCJvblJlc2l6ZVN0YXJ0KCRldmVudClcIlxuICAgICAgPlxuICAgICAgICA8c3Bhbj48L3NwYW4+XG4gICAgICA8L2Rpdj5cblxuICAgICAgPGRpdiAqbmdJZj1cInJlcGx5VG9cIiBjbGFzcz1cInJlcGx5LWNvbXBvc2UtcHJldmlld1wiPlxuICAgICAgICA8bWF0LWljb24+cmVwbHk8L21hdC1pY29uPlxuICAgICAgICA8ZGl2IGNsYXNzPVwicmVwbHktY29tcG9zZS10ZXh0XCI+XG4gICAgICAgICAgPHNwYW4+UmVwbHlpbmcgdG8ge3sgcmVwbHlUby5zZW5kZXJOYW1lIH19PC9zcGFuPlxuICAgICAgICAgIDxwPnt7IHJlcGx5VG8uY29udGVudCB9fTwvcD5cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIDxidXR0b24gdHlwZT1cImJ1dHRvblwiIGNsYXNzPVwicmVwbHktY2FuY2VsLWJ0blwiIChjbGljayk9XCJyZXBseUNhbmNlbGxlZC5lbWl0KClcIiB0aXRsZT1cIkNhbmNlbCByZXBseVwiPlxuICAgICAgICAgIDxtYXQtaWNvbj5jbG9zZTwvbWF0LWljb24+XG4gICAgICAgIDwvYnV0dG9uPlxuICAgICAgPC9kaXY+XG5cbiAgICAgIDwhLS0gRmlsZSBwcmV2aWV3cyAtLT5cbiAgICAgIDxkaXYgKm5nSWY9XCJzZWxlY3RlZEZpbGVzLmxlbmd0aCA+IDBcIiBjbGFzcz1cImZpbGUtcHJldmlld3NcIj5cbiAgICAgICAgPGRpdiAqbmdGb3I9XCJsZXQgZmlsZSBvZiBzZWxlY3RlZEZpbGVzOyBsZXQgaSA9IGluZGV4XCIgY2xhc3M9XCJmaWxlLWNoaXBcIj5cbiAgICAgICAgICA8bWF0LWljb24gY2xhc3M9XCJmaWxlLWljb25cIj57eyBnZXRGaWxlSWNvbihmaWxlKSB9fTwvbWF0LWljb24+XG4gICAgICAgICAgPHNwYW4gY2xhc3M9XCJmaWxlLW5hbWVcIj57eyBmaWxlLm5hbWUgfX08L3NwYW4+XG4gICAgICAgICAgPHNwYW4gY2xhc3M9XCJmaWxlLXNpemVcIj57eyBmb3JtYXRTaXplKGZpbGUuc2l6ZSkgfX08L3NwYW4+XG4gICAgICAgICAgPGJ1dHRvbiBtYXQtaWNvbi1idXR0b24gY2xhc3M9XCJmaWxlLXJlbW92ZVwiIChjbGljayk9XCJyZW1vdmVGaWxlKGkpXCI+XG4gICAgICAgICAgICA8bWF0LWljb24+Y2xvc2U8L21hdC1pY29uPlxuICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuXG4gICAgICA8ZGl2ICpuZ0lmPVwibWVudGlvblN1Z2dlc3Rpb25zLmxlbmd0aCA+IDBcIiBjbGFzcz1cIm1lbnRpb24tc3VnZ2VzdGlvbnNcIj5cbiAgICAgICAgPGJ1dHRvblxuICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxuICAgICAgICAgICpuZ0Zvcj1cImxldCBvcHRpb24gb2YgbWVudGlvblN1Z2dlc3Rpb25zXCJcbiAgICAgICAgICBjbGFzcz1cIm1lbnRpb24tc3VnZ2VzdGlvblwiXG4gICAgICAgICAgKG1vdXNlZG93bik9XCIkZXZlbnQucHJldmVudERlZmF1bHQoKVwiXG4gICAgICAgICAgKGNsaWNrKT1cImluc2VydE1lbnRpb24ob3B0aW9uKVwiXG4gICAgICAgID5cbiAgICAgICAgICA8c3BhbiBjbGFzcz1cIm1lbnRpb24tYXZhdGFyXCI+JiM2NDs8L3NwYW4+XG4gICAgICAgICAgPHNwYW4+e3sgb3B0aW9uLmxhYmVsIH19PC9zcGFuPlxuICAgICAgICAgIDxzbWFsbD4mIzY0O3t7IG9wdGlvbi50b2tlbiB9fTwvc21hbGw+XG4gICAgICAgIDwvYnV0dG9uPlxuICAgICAgPC9kaXY+XG5cbiAgICAgIDxkaXYgY2xhc3M9XCJpbnB1dC13cmFwcGVyXCI+XG4gICAgICAgIDxidXR0b24gbWF0LWljb24tYnV0dG9uIGNsYXNzPVwiYXR0YWNoLWJ0blwiIChjbGljayk9XCJmaWxlSW5wdXQuY2xpY2soKVwiIHRpdGxlPVwiQXR0YWNoIGZpbGVzXCI+XG4gICAgICAgICAgPG1hdC1pY29uPmF0dGFjaF9maWxlPC9tYXQtaWNvbj5cbiAgICAgICAgPC9idXR0b24+XG4gICAgICAgIDxpbnB1dFxuICAgICAgICAgICNmaWxlSW5wdXRcbiAgICAgICAgICB0eXBlPVwiZmlsZVwiXG4gICAgICAgICAgbXVsdGlwbGVcbiAgICAgICAgICBzdHlsZT1cImRpc3BsYXk6bm9uZVwiXG4gICAgICAgICAgKGNoYW5nZSk9XCJvbkZpbGVzU2VsZWN0ZWQoJGV2ZW50KVwiXG4gICAgICAgIC8+XG4gICAgICAgIDx0ZXh0YXJlYVxuICAgICAgICAgICNtZXNzYWdlVGV4dGFyZWFcbiAgICAgICAgICBbbmdNb2RlbF09XCJtZXNzYWdlVGV4dFwiXG4gICAgICAgICAgKG5nTW9kZWxDaGFuZ2UpPVwib25UZXh0Q2hhbmdlKCRldmVudClcIlxuICAgICAgICAgIChpbnB1dCk9XCJhdXRvUmVzaXplKClcIlxuICAgICAgICAgIChwYXN0ZSk9XCJvblBhc3RlKCRldmVudClcIlxuICAgICAgICAgIChjbGljayk9XCJ1cGRhdGVNZW50aW9uU3VnZ2VzdGlvbnMoKVwiXG4gICAgICAgICAgKGtleXVwKT1cInVwZGF0ZU1lbnRpb25TdWdnZXN0aW9ucygpXCJcbiAgICAgICAgICAoa2V5ZG93bik9XCJvbktleWRvd24oJGV2ZW50KVwiXG4gICAgICAgICAgcGxhY2Vob2xkZXI9XCJUeXBlIGEgbWVzc2FnZS4uLlwiXG4gICAgICAgICAgcm93cz1cIjFcIlxuICAgICAgICAgIGNsYXNzPVwibWVzc2FnZS10ZXh0YXJlYVwiXG4gICAgICAgICAgW3N0eWxlLmhlaWdodC5weF09XCJ0ZXh0YXJlYUhlaWdodFwiXG4gICAgICAgID48L3RleHRhcmVhPlxuICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgbWF0LWljb24tYnV0dG9uXG4gICAgICAgICAgY2xhc3M9XCJzZW5kLWJ0blwiXG4gICAgICAgICAgW2Rpc2FibGVkXT1cIiFjYW5TZW5kXCJcbiAgICAgICAgICAoY2xpY2spPVwic2VuZCgpXCJcbiAgICAgICAgPlxuICAgICAgICAgIDxtYXQtaWNvbj5zZW5kPC9tYXQtaWNvbj5cbiAgICAgICAgPC9idXR0b24+XG4gICAgICA8L2Rpdj5cblxuICAgIDwvZGl2PlxuICBgLFxuICBzdHlsZXM6IFtgXG4gICAgLm1lc3NhZ2UtaW5wdXQtY29udGFpbmVyIHtcbiAgICAgIHBhZGRpbmc6IDhweCAxMnB4O1xuICAgICAgYm9yZGVyLXRvcDogMXB4IHNvbGlkIHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xNSk7XG4gICAgICBiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudDtcbiAgICAgIHBvc2l0aW9uOiByZWxhdGl2ZTtcbiAgICB9XG5cbiAgICAuaW5wdXQtcmVzaXplLWhhbmRsZSB7XG4gICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XG4gICAgICB0b3A6IC01cHg7XG4gICAgICBsZWZ0OiAwO1xuICAgICAgcmlnaHQ6IDA7XG4gICAgICBoZWlnaHQ6IDEwcHg7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgICAgY3Vyc29yOiBucy1yZXNpemU7XG4gICAgICB6LWluZGV4OiAyO1xuICAgIH1cblxuICAgIC5pbnB1dC1yZXNpemUtaGFuZGxlIHNwYW4ge1xuICAgICAgd2lkdGg6IDQycHg7XG4gICAgICBoZWlnaHQ6IDNweDtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDk5OXB4O1xuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjIyKTtcbiAgICAgIHRyYW5zaXRpb246IGJhY2tncm91bmQgMC4xNXMsIHdpZHRoIDAuMTVzO1xuICAgIH1cblxuICAgIC5pbnB1dC1yZXNpemUtaGFuZGxlOmhvdmVyIHNwYW4ge1xuICAgICAgd2lkdGg6IDU2cHg7XG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNDIpO1xuICAgIH1cblxuICAgIC5maWxlLXByZXZpZXdzIHtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBmbGV4LXdyYXA6IHdyYXA7XG4gICAgICBnYXA6IDZweDtcbiAgICAgIG1hcmdpbi1ib3R0b206IDhweDtcbiAgICAgIG1heC1oZWlnaHQ6IDgwcHg7XG4gICAgICBvdmVyZmxvdy15OiBhdXRvO1xuICAgIH1cblxuICAgIC5yZXBseS1jb21wb3NlLXByZXZpZXcge1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBnYXA6IDhweDtcbiAgICAgIG1hcmdpbi1ib3R0b206IDhweDtcbiAgICAgIHBhZGRpbmc6IDhweCAxMHB4O1xuICAgICAgYm9yZGVyLXJhZGl1czogMTJweDtcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMTI3LCAxODAsIDI1NSwgMC4xMik7XG4gICAgICBib3JkZXItbGVmdDogM3B4IHNvbGlkIHJnYmEoMTI3LCAxODAsIDI1NSwgMC44KTtcbiAgICAgIGNvbG9yOiAjZmZmO1xuICAgIH1cblxuICAgIC5yZXBseS1jb21wb3NlLXByZXZpZXcgPiBtYXQtaWNvbiB7XG4gICAgICBjb2xvcjogI2JmZGJmZTtcbiAgICAgIGZvbnQtc2l6ZTogMThweDtcbiAgICAgIHdpZHRoOiAxOHB4O1xuICAgICAgaGVpZ2h0OiAxOHB4O1xuICAgICAgZmxleC1zaHJpbms6IDA7XG4gICAgfVxuXG4gICAgLnJlcGx5LWNvbXBvc2UtdGV4dCB7XG4gICAgICBtaW4td2lkdGg6IDA7XG4gICAgICBmbGV4OiAxO1xuICAgIH1cblxuICAgIC5yZXBseS1jb21wb3NlLXRleHQgc3BhbiB7XG4gICAgICBkaXNwbGF5OiBibG9jaztcbiAgICAgIGZvbnQtc2l6ZTogMTFweDtcbiAgICAgIGZvbnQtd2VpZ2h0OiA3MDA7XG4gICAgICBjb2xvcjogI2JmZGJmZTtcbiAgICAgIG1hcmdpbi1ib3R0b206IDJweDtcbiAgICB9XG5cbiAgICAucmVwbHktY29tcG9zZS10ZXh0IHAge1xuICAgICAgbWFyZ2luOiAwO1xuICAgICAgZm9udC1zaXplOiAxMnB4O1xuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC43OCk7XG4gICAgICB3aGl0ZS1zcGFjZTogbm93cmFwO1xuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICAgIHRleHQtb3ZlcmZsb3c6IGVsbGlwc2lzO1xuICAgIH1cblxuICAgIC5yZXBseS1jYW5jZWwtYnRuIHtcbiAgICAgIHdpZHRoOiAyNHB4O1xuICAgICAgaGVpZ2h0OiAyNHB4O1xuICAgICAgYm9yZGVyOiBub25lO1xuICAgICAgYm9yZGVyLXJhZGl1czogOTk5cHg7XG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMDgpO1xuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC44KTtcbiAgICAgIGRpc3BsYXk6IGlubGluZS1mbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgICAgcGFkZGluZzogMDtcbiAgICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgICAgIGZsZXgtc2hyaW5rOiAwO1xuICAgIH1cblxuICAgIC5yZXBseS1jYW5jZWwtYnRuIG1hdC1pY29uIHtcbiAgICAgIGZvbnQtc2l6ZTogMTZweDtcbiAgICAgIHdpZHRoOiAxNnB4O1xuICAgICAgaGVpZ2h0OiAxNnB4O1xuICAgIH1cblxuICAgIC5tZW50aW9uLXN1Z2dlc3Rpb25zIHtcbiAgICAgIG1hcmdpbi1ib3R0b206IDhweDtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDEycHg7XG4gICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgYmFja2dyb3VuZDogIzA3MWQzMDtcbiAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHJnYmEoMTI3LCAxODAsIDI1NSwgMC4yMik7XG4gICAgICBib3gtc2hhZG93OiAwIDEwcHggMjRweCByZ2JhKDAsIDAsIDAsIDAuMjQpO1xuICAgIH1cblxuICAgIC5tZW50aW9uLXN1Z2dlc3Rpb24ge1xuICAgICAgd2lkdGg6IDEwMCU7XG4gICAgICBib3JkZXI6IG5vbmU7XG4gICAgICBiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudDtcbiAgICAgIGNvbG9yOiAjZmZmO1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBnYXA6IDhweDtcbiAgICAgIHBhZGRpbmc6IDhweCAxMHB4O1xuICAgICAgY3Vyc29yOiBwb2ludGVyO1xuICAgICAgdGV4dC1hbGlnbjogbGVmdDtcbiAgICB9XG5cbiAgICAubWVudGlvbi1zdWdnZXN0aW9uOmhvdmVyLFxuICAgIC5tZW50aW9uLXN1Z2dlc3Rpb246Zm9jdXMge1xuICAgICAgYmFja2dyb3VuZDogcmdiYSgxMjcsIDE4MCwgMjU1LCAwLjE0KTtcbiAgICAgIG91dGxpbmU6IG5vbmU7XG4gICAgfVxuXG4gICAgLm1lbnRpb24tYXZhdGFyIHtcbiAgICAgIHdpZHRoOiAyMnB4O1xuICAgICAgaGVpZ2h0OiAyMnB4O1xuICAgICAgYm9yZGVyLXJhZGl1czogOTk5cHg7XG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDEyNywgMTgwLCAyNTUsIDAuMjIpO1xuICAgICAgY29sb3I6ICNiZmRiZmU7XG4gICAgICBkaXNwbGF5OiBpbmxpbmUtZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgIGZvbnQtc2l6ZTogMTJweDtcbiAgICAgIGZvbnQtd2VpZ2h0OiA4MDA7XG4gICAgICBmbGV4LXNocmluazogMDtcbiAgICB9XG5cbiAgICAubWVudGlvbi1zdWdnZXN0aW9uIHNtYWxsIHtcbiAgICAgIG1hcmdpbi1sZWZ0OiBhdXRvO1xuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC41Mik7XG4gICAgICBmb250LXNpemU6IDExcHg7XG4gICAgfVxuXG4gICAgLmZpbGUtY2hpcCB7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGdhcDogNHB4O1xuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjE1KTtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDhweDtcbiAgICAgIHBhZGRpbmc6IDRweCA0cHggNHB4IDhweDtcbiAgICAgIG1heC13aWR0aDogMjAwcHg7XG4gICAgfVxuXG4gICAgLmZpbGUtaWNvbiB7XG4gICAgICBmb250LXNpemU6IDE2cHg7XG4gICAgICB3aWR0aDogMTZweDtcbiAgICAgIGhlaWdodDogMTZweDtcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuOCk7XG4gICAgfVxuXG4gICAgLmZpbGUtbmFtZSB7XG4gICAgICBmb250LXNpemU6IDEycHg7XG4gICAgICBjb2xvcjogI2ZmZjtcbiAgICAgIHdoaXRlLXNwYWNlOiBub3dyYXA7XG4gICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgdGV4dC1vdmVyZmxvdzogZWxsaXBzaXM7XG4gICAgICBtYXgtd2lkdGg6IDEwMHB4O1xuICAgIH1cblxuICAgIC5maWxlLXNpemUge1xuICAgICAgZm9udC1zaXplOiAxMHB4O1xuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC41KTtcbiAgICAgIGZsZXgtc2hyaW5rOiAwO1xuICAgIH1cblxuICAgIC5maWxlLXJlbW92ZSB7XG4gICAgICB3aWR0aDogMjBweCAhaW1wb3J0YW50O1xuICAgICAgaGVpZ2h0OiAyMHB4ICFpbXBvcnRhbnQ7XG4gICAgfVxuXG4gICAgLmZpbGUtcmVtb3ZlIG1hdC1pY29uIHtcbiAgICAgIGZvbnQtc2l6ZTogMTRweDtcbiAgICAgIHdpZHRoOiAxNHB4O1xuICAgICAgaGVpZ2h0OiAxNHB4O1xuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC42KTtcbiAgICB9XG5cbiAgICAuaW5wdXQtd3JhcHBlciB7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGZsZXgtZW5kO1xuICAgICAgZ2FwOiA0cHg7XG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMSk7XG4gICAgICBib3JkZXItcmFkaXVzOiAyNHB4O1xuICAgICAgcGFkZGluZzogMnB4IDRweDtcbiAgICB9XG5cbiAgICAuYXR0YWNoLWJ0bixcbiAgICAuc2VuZC1idG4ge1xuICAgICAgZmxleC1zaHJpbms6IDA7XG4gICAgICB3aWR0aDogMzZweDtcbiAgICAgIGhlaWdodDogMzZweDtcbiAgICAgIHBhZGRpbmc6IDAgIWltcG9ydGFudDtcbiAgICAgIG1hcmdpbjogMDtcbiAgICAgIG1pbi13aWR0aDogMzZweCAhaW1wb3J0YW50O1xuICAgICAgZGlzcGxheTogaW5saW5lLWZsZXggIWltcG9ydGFudDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXIgIWltcG9ydGFudDtcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyICFpbXBvcnRhbnQ7XG4gICAgICBsaW5lLWhlaWdodDogMCAhaW1wb3J0YW50O1xuICAgIH1cblxuICAgIC5hdHRhY2gtYnRuIG1hdC1pY29uLFxuICAgIC5zZW5kLWJ0biBtYXQtaWNvbiB7XG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjcpO1xuICAgICAgZm9udC1zaXplOiAyMHB4O1xuICAgICAgd2lkdGg6IDIwcHg7XG4gICAgICBoZWlnaHQ6IDIwcHg7XG4gICAgICBsaW5lLWhlaWdodDogMjBweDtcbiAgICAgIG1hcmdpbjogMDtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgfVxuXG4gICAgLnNlbmQtYnRuIG1hdC1pY29uIHtcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuOSk7XG4gICAgfVxuXG4gICAgLm1lc3NhZ2UtdGV4dGFyZWEge1xuICAgICAgZmxleDogMTtcbiAgICAgIGJvcmRlcjogbm9uZTtcbiAgICAgIG91dGxpbmU6IG5vbmU7XG4gICAgICBiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudDtcbiAgICAgIHJlc2l6ZTogbm9uZTtcbiAgICAgIGZvbnQtc2l6ZTogMTRweDtcbiAgICAgIGZvbnQtZmFtaWx5OiBpbmhlcml0O1xuICAgICAgbGluZS1oZWlnaHQ6IDEuNTtcbiAgICAgIG1pbi1oZWlnaHQ6IDI0cHg7XG4gICAgICBtYXgtaGVpZ2h0OiAxODBweDtcbiAgICAgIHBhZGRpbmc6IDdweCAwO1xuICAgICAgY29sb3I6ICNmZmY7XG4gICAgICBvdmVyZmxvdy15OiBoaWRkZW47XG4gICAgICBib3gtc2l6aW5nOiBib3JkZXItYm94O1xuICAgIH1cblxuICAgIC5tZXNzYWdlLXRleHRhcmVhOjpwbGFjZWhvbGRlciB7XG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjUpO1xuICAgIH1cblxuICAgIC5zZW5kLWJ0bjpkaXNhYmxlZCBtYXQtaWNvbiB7XG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjMpO1xuICAgIH1cblxuICAgIC8qIE1EQyBtYXQtaWNvbi1idXR0b24gaW5uZXIgd3JhcHBlciBvZnRlbiBzaGlmdHMgZ2x5cGhzIGRvd253YXJkIHdpdGhvdXQgdGhpcyAqL1xuICAgIDpob3N0IDo6bmctZGVlcCAuYXR0YWNoLWJ0biAubWF0LW1kYy1idXR0b24tdG91Y2gtdGFyZ2V0LFxuICAgIDpob3N0IDo6bmctZGVlcCAuc2VuZC1idG4gLm1hdC1tZGMtYnV0dG9uLXRvdWNoLXRhcmdldCB7XG4gICAgICBoZWlnaHQ6IDM2cHggIWltcG9ydGFudDtcbiAgICAgIHdpZHRoOiAzNnB4ICFpbXBvcnRhbnQ7XG4gICAgfVxuXG4gICAgOmhvc3QgOjpuZy1kZWVwIC5hdHRhY2gtYnRuIC5tZGMtaWNvbi1idXR0b25fX2ljb24sXG4gICAgOmhvc3QgOjpuZy1kZWVwIC5zZW5kLWJ0biAubWRjLWljb24tYnV0dG9uX19pY29uIHtcbiAgICAgIGRpc3BsYXk6IGZsZXggIWltcG9ydGFudDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXIgIWltcG9ydGFudDtcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyICFpbXBvcnRhbnQ7XG4gICAgICBtYXJnaW46IDAgIWltcG9ydGFudDtcbiAgICAgIHBhZGRpbmc6IDAgIWltcG9ydGFudDtcbiAgICB9XG5cbiAgYF0sXG59KVxuZXhwb3J0IGNsYXNzIE1lc3NhZ2VJbnB1dENvbXBvbmVudCBpbXBsZW1lbnRzIE9uQ2hhbmdlcywgQWZ0ZXJWaWV3SW5pdCwgT25EZXN0cm95IHtcbiAgQElucHV0KCkgY29udmVyc2F0aW9uSWQ6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuICBASW5wdXQoKSByZXBseVRvOiBSZXBseVByZXZpZXcgfCBudWxsID0gbnVsbDtcbiAgQElucHV0KCkgZW5hYmxlTWVudGlvbnMgPSBmYWxzZTtcbiAgQElucHV0KCkgbWVudGlvbk9wdGlvbnM6IE1lbnRpb25PcHRpb25bXSA9IFtdO1xuICBAT3V0cHV0KCkgbWVzc2FnZVNlbnQgPSBuZXcgRXZlbnRFbWl0dGVyPHN0cmluZz4oKTtcbiAgQE91dHB1dCgpIG1lc3NhZ2VXaXRoRmlsZXMgPSBuZXcgRXZlbnRFbWl0dGVyPE1lc3NhZ2VQYXlsb2FkPigpO1xuICBAT3V0cHV0KCkgcmVwbHlDYW5jZWxsZWQgPSBuZXcgRXZlbnRFbWl0dGVyPHZvaWQ+KCk7XG4gIEBWaWV3Q2hpbGQoJ2ZpbGVJbnB1dCcpIGZpbGVJbnB1dCE6IEVsZW1lbnRSZWY8SFRNTElucHV0RWxlbWVudD47XG4gIEBWaWV3Q2hpbGQoJ21lc3NhZ2VUZXh0YXJlYScpIG1lc3NhZ2VUZXh0YXJlYSE6IEVsZW1lbnRSZWY8SFRNTFRleHRBcmVhRWxlbWVudD47XG5cbiAgbWVzc2FnZVRleHQgPSAnJztcbiAgc2VsZWN0ZWRGaWxlczogRmlsZVtdID0gW107XG4gIHRleHRhcmVhSGVpZ2h0ID0gMzY7XG4gIG1lbnRpb25TdWdnZXN0aW9uczogTWVudGlvbk9wdGlvbltdID0gW107XG4gIHByaXZhdGUgcmVhZG9ubHkgZHJhZnRQcmVmaXggPSAnbWVzc2FnaW5nX2RyYWZ0Xyc7XG4gIHByaXZhdGUgbGFzdENvbnZlcnNhdGlvbklkOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSByZXNpemluZyA9IGZhbHNlO1xuICBwcml2YXRlIHJlc2l6ZVN0YXJ0WSA9IDA7XG4gIHByaXZhdGUgcmVzaXplU3RhcnRIZWlnaHQgPSAwO1xuICBwcml2YXRlIHJlYWRvbmx5IG1pblRleHRhcmVhSGVpZ2h0ID0gMzY7XG4gIHByaXZhdGUgcmVhZG9ubHkgbWF4VGV4dGFyZWFIZWlnaHQgPSAxODA7XG4gIHByaXZhdGUgbWFudWFsVGV4dGFyZWFIZWlnaHQgPSB0aGlzLm1pblRleHRhcmVhSGVpZ2h0O1xuICBwcml2YXRlIGFjdGl2ZU1lbnRpb25TdGFydCA9IC0xO1xuICBwcml2YXRlIGFjdGl2ZU1lbnRpb25FbmQgPSAtMTtcbiAgcHJpdmF0ZSBib3VuZFJlc2l6ZU1vdmUgPSB0aGlzLm9uUmVzaXplTW92ZS5iaW5kKHRoaXMpO1xuICBwcml2YXRlIGJvdW5kUmVzaXplRW5kID0gdGhpcy5vblJlc2l6ZUVuZC5iaW5kKHRoaXMpO1xuXG4gIG5nT25DaGFuZ2VzKGNoYW5nZXM6IFNpbXBsZUNoYW5nZXMpOiB2b2lkIHtcbiAgICBpZiAoIWNoYW5nZXNbJ2NvbnZlcnNhdGlvbklkJ10pIHJldHVybjtcbiAgICBpZiAodGhpcy5sYXN0Q29udmVyc2F0aW9uSWQgJiYgdGhpcy5sYXN0Q29udmVyc2F0aW9uSWQgIT09IHRoaXMuY29udmVyc2F0aW9uSWQpIHtcbiAgICAgIHRoaXMucGVyc2lzdERyYWZ0KHRoaXMubGFzdENvbnZlcnNhdGlvbklkLCB0aGlzLm1lc3NhZ2VUZXh0KTtcbiAgICB9XG4gICAgdGhpcy5sYXN0Q29udmVyc2F0aW9uSWQgPSB0aGlzLmNvbnZlcnNhdGlvbklkO1xuICAgIHRoaXMubWVzc2FnZVRleHQgPSB0aGlzLmxvYWREcmFmdCh0aGlzLmNvbnZlcnNhdGlvbklkKTtcbiAgICB0aGlzLnF1ZXVlQXV0b1Jlc2l6ZSgpO1xuICB9XG5cbiAgbmdBZnRlclZpZXdJbml0KCk6IHZvaWQge1xuICAgIHRoaXMucXVldWVBdXRvUmVzaXplKCk7XG4gIH1cblxuICBuZ09uRGVzdHJveSgpOiB2b2lkIHtcbiAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCB0aGlzLmJvdW5kUmVzaXplTW92ZSk7XG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIHRoaXMuYm91bmRSZXNpemVFbmQpO1xuICAgIGRvY3VtZW50LmJvZHkuc3R5bGUuY3Vyc29yID0gJyc7XG4gICAgZG9jdW1lbnQuYm9keS5zdHlsZS51c2VyU2VsZWN0ID0gJyc7XG4gIH1cblxuICBnZXQgY2FuU2VuZCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy5tZXNzYWdlVGV4dC50cmltKCkubGVuZ3RoID4gMCB8fCB0aGlzLnNlbGVjdGVkRmlsZXMubGVuZ3RoID4gMDtcbiAgfVxuXG4gIHNlbmQoKTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLmNhblNlbmQpIHJldHVybjtcbiAgICBjb25zdCB0ZXh0ID0gdGhpcy5tZXNzYWdlVGV4dC50cmltKCk7XG5cbiAgICBpZiAodGhpcy5zZWxlY3RlZEZpbGVzLmxlbmd0aCA+IDApIHtcbiAgICAgIHRoaXMubWVzc2FnZVdpdGhGaWxlcy5lbWl0KHsgdGV4dCwgZmlsZXM6IFsuLi50aGlzLnNlbGVjdGVkRmlsZXNdIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLm1lc3NhZ2VTZW50LmVtaXQodGV4dCk7XG4gICAgfVxuXG4gICAgdGhpcy5tZXNzYWdlVGV4dCA9ICcnO1xuICAgIHRoaXMuc2VsZWN0ZWRGaWxlcyA9IFtdO1xuICAgIHRoaXMubWVudGlvblN1Z2dlc3Rpb25zID0gW107XG4gICAgdGhpcy5tYW51YWxUZXh0YXJlYUhlaWdodCA9IHRoaXMubWluVGV4dGFyZWFIZWlnaHQ7XG4gICAgdGhpcy5jbGVhckRyYWZ0KHRoaXMuY29udmVyc2F0aW9uSWQpO1xuICAgIGlmICh0aGlzLmZpbGVJbnB1dCkgdGhpcy5maWxlSW5wdXQubmF0aXZlRWxlbWVudC52YWx1ZSA9ICcnO1xuICAgIHRoaXMucXVldWVBdXRvUmVzaXplKCk7XG4gIH1cblxuICBvblRleHRDaGFuZ2UodmFsdWU6IHN0cmluZyk6IHZvaWQge1xuICAgIHRoaXMubWVzc2FnZVRleHQgPSB2YWx1ZTtcbiAgICB0aGlzLnBlcnNpc3REcmFmdCh0aGlzLmNvbnZlcnNhdGlvbklkLCB2YWx1ZSk7XG4gICAgdGhpcy51cGRhdGVNZW50aW9uU3VnZ2VzdGlvbnMoKTtcbiAgICB0aGlzLnF1ZXVlQXV0b1Jlc2l6ZSgpO1xuICB9XG5cbiAgb25QYXN0ZShldmVudDogQ2xpcGJvYXJkRXZlbnQpOiB2b2lkIHtcbiAgICBjb25zdCBjbGlwYm9hcmRJdGVtcyA9IEFycmF5LmZyb20oZXZlbnQuY2xpcGJvYXJkRGF0YT8uaXRlbXMgfHwgW10pO1xuICAgIGNvbnN0IGltYWdlRmlsZXMgPSBjbGlwYm9hcmRJdGVtc1xuICAgICAgLmZpbHRlcigoaXRlbSkgPT4gaXRlbS5raW5kID09PSAnZmlsZScgJiYgaXRlbS50eXBlLnN0YXJ0c1dpdGgoJ2ltYWdlLycpKVxuICAgICAgLm1hcCgoaXRlbSkgPT4gaXRlbS5nZXRBc0ZpbGUoKSlcbiAgICAgIC5maWx0ZXIoKGZpbGUpOiBmaWxlIGlzIEZpbGUgPT4gISFmaWxlKVxuICAgICAgLm1hcCgoZmlsZSkgPT4gdGhpcy5uYW1lQ2xpcGJvYXJkSW1hZ2UoZmlsZSkpO1xuXG4gICAgaWYgKGltYWdlRmlsZXMubGVuZ3RoID4gMCkge1xuICAgICAgdGhpcy5hZGRGaWxlcyhpbWFnZUZpbGVzKTtcbiAgICAgIGNvbnN0IHRleHQgPSBldmVudC5jbGlwYm9hcmREYXRhPy5nZXREYXRhKCd0ZXh0L3BsYWluJykgfHwgJyc7XG4gICAgICBpZiAoIXRleHQudHJpbSgpKSB7XG4gICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgaHRtbCA9IGV2ZW50LmNsaXBib2FyZERhdGE/LmdldERhdGEoJ3RleHQvaHRtbCcpIHx8ICcnO1xuICAgIGlmICghaHRtbCB8fCAhLzx0YWJsZVtcXHM+XS9pLnRlc3QoaHRtbCkpIHJldHVybjtcblxuICAgIGNvbnN0IHRhYmxlVGV4dCA9IHRoaXMuaHRtbFRhYmxlVG9UZXh0KGh0bWwpO1xuICAgIGlmICghdGFibGVUZXh0KSByZXR1cm47XG5cbiAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIHRoaXMuaW5zZXJ0VGV4dEF0Q3Vyc29yKHRhYmxlVGV4dCk7XG4gIH1cblxuICBhdXRvUmVzaXplKCk6IHZvaWQge1xuICAgIGNvbnN0IGVsID0gdGhpcy5tZXNzYWdlVGV4dGFyZWE/Lm5hdGl2ZUVsZW1lbnQ7XG4gICAgaWYgKCFlbCkgcmV0dXJuO1xuICAgIGVsLnN0eWxlLmhlaWdodCA9ICdhdXRvJztcbiAgICBjb25zdCBuZXh0SGVpZ2h0ID0gTWF0aC5taW4oXG4gICAgICBNYXRoLm1heChlbC5zY3JvbGxIZWlnaHQsIHRoaXMubWFudWFsVGV4dGFyZWFIZWlnaHQsIHRoaXMubWluVGV4dGFyZWFIZWlnaHQpLFxuICAgICAgdGhpcy5tYXhUZXh0YXJlYUhlaWdodFxuICAgICk7XG4gICAgdGhpcy50ZXh0YXJlYUhlaWdodCA9IG5leHRIZWlnaHQ7XG4gICAgZWwuc3R5bGUuaGVpZ2h0ID0gYCR7bmV4dEhlaWdodH1weGA7XG4gICAgZWwuc3R5bGUub3ZlcmZsb3dZID0gbmV4dEhlaWdodCA+PSB0aGlzLm1heFRleHRhcmVhSGVpZ2h0ID8gJ2F1dG8nIDogJ2hpZGRlbic7XG4gIH1cblxuICBvblJlc2l6ZVN0YXJ0KGV2ZW50OiBNb3VzZUV2ZW50KTogdm9pZCB7XG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICB0aGlzLnJlc2l6aW5nID0gdHJ1ZTtcbiAgICB0aGlzLnJlc2l6ZVN0YXJ0WSA9IGV2ZW50LmNsaWVudFk7XG4gICAgdGhpcy5yZXNpemVTdGFydEhlaWdodCA9IHRoaXMudGV4dGFyZWFIZWlnaHQ7XG4gICAgZG9jdW1lbnQuYm9keS5zdHlsZS5jdXJzb3IgPSAnbnMtcmVzaXplJztcbiAgICBkb2N1bWVudC5ib2R5LnN0eWxlLnVzZXJTZWxlY3QgPSAnbm9uZSc7XG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgdGhpcy5ib3VuZFJlc2l6ZU1vdmUpO1xuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCB0aGlzLmJvdW5kUmVzaXplRW5kKTtcbiAgfVxuXG4gIHByaXZhdGUgb25SZXNpemVNb3ZlKGV2ZW50OiBNb3VzZUV2ZW50KTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLnJlc2l6aW5nKSByZXR1cm47XG4gICAgY29uc3QgZHkgPSB0aGlzLnJlc2l6ZVN0YXJ0WSAtIGV2ZW50LmNsaWVudFk7XG4gICAgY29uc3QgbmV4dEhlaWdodCA9IE1hdGgubWF4KFxuICAgICAgdGhpcy5taW5UZXh0YXJlYUhlaWdodCxcbiAgICAgIE1hdGgubWluKHRoaXMubWF4VGV4dGFyZWFIZWlnaHQsIHRoaXMucmVzaXplU3RhcnRIZWlnaHQgKyBkeSlcbiAgICApO1xuICAgIHRoaXMubWFudWFsVGV4dGFyZWFIZWlnaHQgPSBuZXh0SGVpZ2h0O1xuICAgIHRoaXMudGV4dGFyZWFIZWlnaHQgPSBuZXh0SGVpZ2h0O1xuICB9XG5cbiAgcHJpdmF0ZSBvblJlc2l6ZUVuZCgpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMucmVzaXppbmcpIHJldHVybjtcbiAgICB0aGlzLnJlc2l6aW5nID0gZmFsc2U7XG4gICAgZG9jdW1lbnQuYm9keS5zdHlsZS5jdXJzb3IgPSAnJztcbiAgICBkb2N1bWVudC5ib2R5LnN0eWxlLnVzZXJTZWxlY3QgPSAnJztcbiAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCB0aGlzLmJvdW5kUmVzaXplTW92ZSk7XG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIHRoaXMuYm91bmRSZXNpemVFbmQpO1xuICB9XG5cbiAgcHJpdmF0ZSBxdWV1ZUF1dG9SZXNpemUoKTogdm9pZCB7XG4gICAgc2V0VGltZW91dCgoKSA9PiB0aGlzLmF1dG9SZXNpemUoKSk7XG4gIH1cblxuICBwcml2YXRlIGRyYWZ0S2V5KGNvbnZlcnNhdGlvbklkOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIHJldHVybiBgJHt0aGlzLmRyYWZ0UHJlZml4fSR7Y29udmVyc2F0aW9uSWR9YDtcbiAgfVxuXG4gIHByaXZhdGUgbG9hZERyYWZ0KGNvbnZlcnNhdGlvbklkOiBzdHJpbmcgfCBudWxsKTogc3RyaW5nIHtcbiAgICBpZiAoIWNvbnZlcnNhdGlvbklkKSByZXR1cm4gJyc7XG4gICAgcmV0dXJuIGxvY2FsU3RvcmFnZS5nZXRJdGVtKHRoaXMuZHJhZnRLZXkoY29udmVyc2F0aW9uSWQpKSB8fCAnJztcbiAgfVxuXG4gIHByaXZhdGUgcGVyc2lzdERyYWZ0KGNvbnZlcnNhdGlvbklkOiBzdHJpbmcgfCBudWxsLCB2YWx1ZTogc3RyaW5nKTogdm9pZCB7XG4gICAgaWYgKCFjb252ZXJzYXRpb25JZCkgcmV0dXJuO1xuICAgIGNvbnN0IGtleSA9IHRoaXMuZHJhZnRLZXkoY29udmVyc2F0aW9uSWQpO1xuICAgIGlmICh2YWx1ZS50cmltKCkpIHtcbiAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKGtleSwgdmFsdWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbShrZXkpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgY2xlYXJEcmFmdChjb252ZXJzYXRpb25JZDogc3RyaW5nIHwgbnVsbCk6IHZvaWQge1xuICAgIGlmICghY29udmVyc2F0aW9uSWQpIHJldHVybjtcbiAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSh0aGlzLmRyYWZ0S2V5KGNvbnZlcnNhdGlvbklkKSk7XG4gIH1cblxuICBwcml2YXRlIGh0bWxUYWJsZVRvVGV4dChodG1sOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBkb2MgPSBuZXcgRE9NUGFyc2VyKCkucGFyc2VGcm9tU3RyaW5nKGh0bWwsICd0ZXh0L2h0bWwnKTtcbiAgICAgIGNvbnN0IHRhYmxlID0gZG9jLnF1ZXJ5U2VsZWN0b3IoJ3RhYmxlJyk7XG4gICAgICBpZiAoIXRhYmxlKSByZXR1cm4gJyc7XG5cbiAgICAgIGNvbnN0IHJvd3MgPSBBcnJheS5mcm9tKHRhYmxlLnF1ZXJ5U2VsZWN0b3JBbGwoJ3RyJykpO1xuICAgICAgcmV0dXJuIHJvd3NcbiAgICAgICAgLm1hcCgocm93KSA9PlxuICAgICAgICAgIEFycmF5LmZyb20ocm93LnF1ZXJ5U2VsZWN0b3JBbGwoJ3RoLHRkJykpXG4gICAgICAgICAgICAubWFwKChjZWxsKSA9PiAoY2VsbC50ZXh0Q29udGVudCB8fCAnJykucmVwbGFjZSgvXFxzKy9nLCAnICcpLnRyaW0oKSlcbiAgICAgICAgICAgIC5qb2luKCdcXHQnKVxuICAgICAgICApXG4gICAgICAgIC5maWx0ZXIoQm9vbGVhbilcbiAgICAgICAgLmpvaW4oJ1xcbicpO1xuICAgIH0gY2F0Y2gge1xuICAgICAgcmV0dXJuICcnO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgaW5zZXJ0VGV4dEF0Q3Vyc29yKHRleHQ6IHN0cmluZyk6IHZvaWQge1xuICAgIGNvbnN0IHRleHRhcmVhID0gdGhpcy5tZXNzYWdlVGV4dGFyZWE/Lm5hdGl2ZUVsZW1lbnQ7XG4gICAgaWYgKCF0ZXh0YXJlYSkge1xuICAgICAgdGhpcy5vblRleHRDaGFuZ2UoYCR7dGhpcy5tZXNzYWdlVGV4dH0ke3RleHR9YCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3Qgc3RhcnQgPSB0ZXh0YXJlYS5zZWxlY3Rpb25TdGFydCA/PyB0aGlzLm1lc3NhZ2VUZXh0Lmxlbmd0aDtcbiAgICBjb25zdCBlbmQgPSB0ZXh0YXJlYS5zZWxlY3Rpb25FbmQgPz8gdGhpcy5tZXNzYWdlVGV4dC5sZW5ndGg7XG4gICAgY29uc3QgbmV4dCA9IGAke3RoaXMubWVzc2FnZVRleHQuc2xpY2UoMCwgc3RhcnQpfSR7dGV4dH0ke3RoaXMubWVzc2FnZVRleHQuc2xpY2UoZW5kKX1gO1xuICAgIHRoaXMub25UZXh0Q2hhbmdlKG5leHQpO1xuICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgdGV4dGFyZWEuc2VsZWN0aW9uU3RhcnQgPSB0ZXh0YXJlYS5zZWxlY3Rpb25FbmQgPSBzdGFydCArIHRleHQubGVuZ3RoO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBuYW1lQ2xpcGJvYXJkSW1hZ2UoZmlsZTogRmlsZSk6IEZpbGUge1xuICAgIGNvbnN0IGV4dGVuc2lvbiA9IGZpbGUudHlwZS5zcGxpdCgnLycpWzFdPy5yZXBsYWNlKCdqcGVnJywgJ2pwZycpIHx8ICdwbmcnO1xuICAgIGNvbnN0IGZpbGVuYW1lID0gYGNsaXBib2FyZC1pbWFnZS0ke25ldyBEYXRlKCkudG9JU09TdHJpbmcoKS5yZXBsYWNlKC9bOi5dL2csICctJyl9LiR7ZXh0ZW5zaW9ufWA7XG4gICAgcmV0dXJuIG5ldyBGaWxlKFtmaWxlXSwgZmlsZW5hbWUsIHsgdHlwZTogZmlsZS50eXBlIHx8ICdpbWFnZS9wbmcnLCBsYXN0TW9kaWZpZWQ6IERhdGUubm93KCkgfSk7XG4gIH1cblxuICBmb2N1cygpOiB2b2lkIHtcbiAgICBzZXRUaW1lb3V0KCgpID0+IHRoaXMubWVzc2FnZVRleHRhcmVhPy5uYXRpdmVFbGVtZW50Py5mb2N1cygpKTtcbiAgfVxuXG4gIHVwZGF0ZU1lbnRpb25TdWdnZXN0aW9ucygpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMuZW5hYmxlTWVudGlvbnMgfHwgIXRoaXMubWVudGlvbk9wdGlvbnMubGVuZ3RoKSB7XG4gICAgICB0aGlzLm1lbnRpb25TdWdnZXN0aW9ucyA9IFtdO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHRleHRhcmVhID0gdGhpcy5tZXNzYWdlVGV4dGFyZWE/Lm5hdGl2ZUVsZW1lbnQ7XG4gICAgY29uc3QgY2FyZXQgPSB0ZXh0YXJlYT8uc2VsZWN0aW9uU3RhcnQgPz8gdGhpcy5tZXNzYWdlVGV4dC5sZW5ndGg7XG4gICAgY29uc3QgYmVmb3JlQ2FyZXQgPSB0aGlzLm1lc3NhZ2VUZXh0LnNsaWNlKDAsIGNhcmV0KTtcbiAgICBjb25zdCBtYXRjaCA9IGJlZm9yZUNhcmV0Lm1hdGNoKC8oXnxcXHMpQChbYS16QS1aMC05Ll8tXXswLDMyfSkkLyk7XG4gICAgaWYgKCFtYXRjaCkge1xuICAgICAgdGhpcy5tZW50aW9uU3VnZ2VzdGlvbnMgPSBbXTtcbiAgICAgIHRoaXMuYWN0aXZlTWVudGlvblN0YXJ0ID0gLTE7XG4gICAgICB0aGlzLmFjdGl2ZU1lbnRpb25FbmQgPSAtMTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBxdWVyeSA9IChtYXRjaFsyXSB8fCAnJykudG9Mb3dlckNhc2UoKTtcbiAgICB0aGlzLmFjdGl2ZU1lbnRpb25FbmQgPSBjYXJldDtcbiAgICB0aGlzLmFjdGl2ZU1lbnRpb25TdGFydCA9IGNhcmV0IC0gcXVlcnkubGVuZ3RoIC0gMTtcbiAgICB0aGlzLm1lbnRpb25TdWdnZXN0aW9ucyA9IHRoaXMubWVudGlvbk9wdGlvbnNcbiAgICAgIC5maWx0ZXIoKG9wdGlvbikgPT5cbiAgICAgICAgb3B0aW9uLnRva2VuLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMocXVlcnkpIHx8XG4gICAgICAgIG9wdGlvbi5sYWJlbC50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKHF1ZXJ5KVxuICAgICAgKVxuICAgICAgLnNsaWNlKDAsIDUpO1xuICB9XG5cbiAgaW5zZXJ0TWVudGlvbihvcHRpb246IE1lbnRpb25PcHRpb24pOiB2b2lkIHtcbiAgICBpZiAodGhpcy5hY3RpdmVNZW50aW9uU3RhcnQgPCAwKSByZXR1cm47XG4gICAgY29uc3Qgc3RhcnQgPSB0aGlzLmFjdGl2ZU1lbnRpb25TdGFydDtcbiAgICBjb25zdCBlbmQgPSB0aGlzLmFjdGl2ZU1lbnRpb25FbmQgPj0gc3RhcnQgPyB0aGlzLmFjdGl2ZU1lbnRpb25FbmQgOiB0aGlzLm1lc3NhZ2VUZXh0Lmxlbmd0aDtcbiAgICBjb25zdCBtZW50aW9uVGV4dCA9IGBAJHtvcHRpb24udG9rZW59IGA7XG4gICAgY29uc3QgbmV4dCA9IGAke3RoaXMubWVzc2FnZVRleHQuc2xpY2UoMCwgc3RhcnQpfSR7bWVudGlvblRleHR9JHt0aGlzLm1lc3NhZ2VUZXh0LnNsaWNlKGVuZCl9YDtcbiAgICB0aGlzLm9uVGV4dENoYW5nZShuZXh0KTtcbiAgICB0aGlzLm1lbnRpb25TdWdnZXN0aW9ucyA9IFtdO1xuICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgY29uc3QgdGV4dGFyZWEgPSB0aGlzLm1lc3NhZ2VUZXh0YXJlYT8ubmF0aXZlRWxlbWVudDtcbiAgICAgIGlmICghdGV4dGFyZWEpIHJldHVybjtcbiAgICAgIGNvbnN0IGNhcmV0ID0gc3RhcnQgKyBtZW50aW9uVGV4dC5sZW5ndGg7XG4gICAgICB0ZXh0YXJlYS5mb2N1cygpO1xuICAgICAgdGV4dGFyZWEuc2VsZWN0aW9uU3RhcnQgPSB0ZXh0YXJlYS5zZWxlY3Rpb25FbmQgPSBjYXJldDtcbiAgICAgIHRoaXMucXVldWVBdXRvUmVzaXplKCk7XG4gICAgfSk7XG4gIH1cblxuICBvbktleWRvd24oZXZlbnQ6IEtleWJvYXJkRXZlbnQpOiB2b2lkIHtcbiAgICBpZiAoZXZlbnQua2V5ID09PSAnRXNjYXBlJyAmJiB0aGlzLm1lbnRpb25TdWdnZXN0aW9ucy5sZW5ndGggPiAwKSB7XG4gICAgICB0aGlzLm1lbnRpb25TdWdnZXN0aW9ucyA9IFtdO1xuICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoZXZlbnQua2V5ID09PSAnRW50ZXInICYmIHRoaXMubWVudGlvblN1Z2dlc3Rpb25zLmxlbmd0aCA+IDApIHtcbiAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICB0aGlzLmluc2VydE1lbnRpb24odGhpcy5tZW50aW9uU3VnZ2VzdGlvbnNbMF0pO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChldmVudC5rZXkgPT09ICdFbnRlcicgJiYgIWV2ZW50LnNoaWZ0S2V5KSB7XG4gICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgdGhpcy5zZW5kKCk7XG4gICAgfVxuICB9XG5cbiAgb25FbnRlcihldmVudDogRXZlbnQpOiB2b2lkIHtcbiAgICBjb25zdCBrZSA9IGV2ZW50IGFzIEtleWJvYXJkRXZlbnQ7XG4gICAgaWYgKCFrZS5zaGlmdEtleSkge1xuICAgICAga2UucHJldmVudERlZmF1bHQoKTtcbiAgICAgIHRoaXMuc2VuZCgpO1xuICAgIH1cbiAgfVxuXG4gIG9uRmlsZXNTZWxlY3RlZChldmVudDogRXZlbnQpOiB2b2lkIHtcbiAgICBjb25zdCBpbnB1dCA9IGV2ZW50LnRhcmdldCBhcyBIVE1MSW5wdXRFbGVtZW50O1xuICAgIGlmIChpbnB1dC5maWxlcykge1xuICAgICAgdGhpcy5hZGRGaWxlcyhBcnJheS5mcm9tKGlucHV0LmZpbGVzKSk7XG4gICAgfVxuICB9XG5cbiAgYWRkRmlsZXMoZmlsZXM6IEZpbGVbXSk6IHZvaWQge1xuICAgIGlmICghZmlsZXMubGVuZ3RoKSByZXR1cm47XG4gICAgdGhpcy5zZWxlY3RlZEZpbGVzID0gWy4uLnRoaXMuc2VsZWN0ZWRGaWxlcywgLi4uZmlsZXNdO1xuICB9XG5cbiAgcmVtb3ZlRmlsZShpbmRleDogbnVtYmVyKTogdm9pZCB7XG4gICAgdGhpcy5zZWxlY3RlZEZpbGVzLnNwbGljZShpbmRleCwgMSk7XG4gICAgdGhpcy5zZWxlY3RlZEZpbGVzID0gWy4uLnRoaXMuc2VsZWN0ZWRGaWxlc107XG4gIH1cblxuICBnZXRGaWxlSWNvbihmaWxlOiBGaWxlKTogc3RyaW5nIHtcbiAgICBjb25zdCB0eXBlID0gZmlsZS50eXBlO1xuICAgIGlmICh0eXBlLnN0YXJ0c1dpdGgoJ2ltYWdlLycpKSByZXR1cm4gJ2ltYWdlJztcbiAgICBpZiAodHlwZS5zdGFydHNXaXRoKCd2aWRlby8nKSkgcmV0dXJuICd2aWRlb2NhbSc7XG4gICAgaWYgKHR5cGUuc3RhcnRzV2l0aCgnYXVkaW8vJykpIHJldHVybiAnYXVkaW90cmFjayc7XG4gICAgaWYgKHR5cGUuaW5jbHVkZXMoJ3BkZicpKSByZXR1cm4gJ3BpY3R1cmVfYXNfcGRmJztcbiAgICBpZiAodHlwZS5pbmNsdWRlcygnc3ByZWFkc2hlZXQnKSB8fCB0eXBlLmluY2x1ZGVzKCdleGNlbCcpKSByZXR1cm4gJ3RhYmxlX2NoYXJ0JztcbiAgICBpZiAodHlwZS5pbmNsdWRlcygnZG9jdW1lbnQnKSB8fCB0eXBlLmluY2x1ZGVzKCd3b3JkJykpIHJldHVybiAnZGVzY3JpcHRpb24nO1xuICAgIHJldHVybiAnaW5zZXJ0X2RyaXZlX2ZpbGUnO1xuICB9XG5cbiAgZm9ybWF0U2l6ZShieXRlczogbnVtYmVyKTogc3RyaW5nIHtcbiAgICBpZiAoYnl0ZXMgPCAxMDI0KSByZXR1cm4gYnl0ZXMgKyAnIEInO1xuICAgIGlmIChieXRlcyA8IDEwMjQgKiAxMDI0KSByZXR1cm4gKGJ5dGVzIC8gMTAyNCkudG9GaXhlZCgwKSArICcgS0InO1xuICAgIHJldHVybiAoYnl0ZXMgLyAoMTAyNCAqIDEwMjQpKS50b0ZpeGVkKDEpICsgJyBNQic7XG4gIH1cbn1cbiJdfQ==