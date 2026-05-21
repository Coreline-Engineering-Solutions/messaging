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
    messageSent = new EventEmitter();
    messageWithFiles = new EventEmitter();
    fileInput;
    messageTextarea;
    messageText = '';
    selectedFiles = [];
    textareaHeight = 36;
    draftPrefix = 'messaging_draft_';
    lastConversationId = null;
    resizing = false;
    resizeStartY = 0;
    resizeStartHeight = 0;
    minTextareaHeight = 36;
    maxTextareaHeight = 180;
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
        this.clearDraft(this.conversationId);
        if (this.fileInput)
            this.fileInput.nativeElement.value = '';
        this.queueAutoResize();
    }
    onTextChange(value) {
        this.messageText = value;
        this.persistDraft(this.conversationId, value);
        this.queueAutoResize();
    }
    onPaste(event) {
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
        const nextHeight = Math.min(Math.max(el.scrollHeight, this.minTextareaHeight), Math.max(this.textareaHeight, this.minTextareaHeight));
        this.textareaHeight = Math.min(nextHeight, this.maxTextareaHeight);
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
        this.textareaHeight = Math.max(this.minTextareaHeight, Math.min(this.maxTextareaHeight, this.resizeStartHeight + dy));
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
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "17.3.12", type: MessageInputComponent, isStandalone: true, selector: "app-message-input", inputs: { conversationId: "conversationId" }, outputs: { messageSent: "messageSent", messageWithFiles: "messageWithFiles" }, viewQueries: [{ propertyName: "fileInput", first: true, predicate: ["fileInput"], descendants: true }, { propertyName: "messageTextarea", first: true, predicate: ["messageTextarea"], descendants: true }], usesOnChanges: true, ngImport: i0, template: `
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
  `, isInline: true, styles: [".message-input-container{padding:8px 12px;border-top:1px solid rgba(255,255,255,.15);background:transparent;position:relative}.input-resize-handle{position:absolute;top:-5px;left:0;right:0;height:10px;display:flex;align-items:center;justify-content:center;cursor:ns-resize;z-index:2}.input-resize-handle span{width:42px;height:3px;border-radius:999px;background:#ffffff38;transition:background .15s,width .15s}.input-resize-handle:hover span{width:56px;background:#ffffff6b}.file-previews{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;max-height:80px;overflow-y:auto}.file-chip{display:flex;align-items:center;gap:4px;background:#ffffff26;border-radius:8px;padding:4px 4px 4px 8px;max-width:200px}.file-icon{font-size:16px;width:16px;height:16px;color:#fffc}.file-name{font-size:12px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100px}.file-size{font-size:10px;color:#ffffff80;flex-shrink:0}.file-remove{width:20px!important;height:20px!important}.file-remove mat-icon{font-size:14px;width:14px;height:14px;color:#fff9}.input-wrapper{display:flex;align-items:flex-end;gap:4px;background:#ffffff1a;border-radius:24px;padding:2px 4px}.attach-btn,.send-btn{flex-shrink:0;width:36px;height:36px;padding:0!important;margin:0;min-width:36px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;line-height:0!important}.attach-btn mat-icon,.send-btn mat-icon{color:#ffffffb3;font-size:20px;width:20px;height:20px;line-height:20px;margin:0;display:flex;align-items:center;justify-content:center}.send-btn mat-icon{color:#ffffffe6}.message-textarea{flex:1;border:none;outline:none;background:transparent;resize:none;font-size:14px;font-family:inherit;line-height:1.5;min-height:24px;max-height:180px;padding:7px 0;color:#fff;overflow-y:auto;box-sizing:border-box}.message-textarea::placeholder{color:#ffffff80}.send-btn:disabled mat-icon{color:#ffffff4d}:host ::ng-deep .attach-btn .mat-mdc-button-touch-target,:host ::ng-deep .send-btn .mat-mdc-button-touch-target{height:36px!important;width:36px!important}:host ::ng-deep .attach-btn .mdc-icon-button__icon,:host ::ng-deep .send-btn .mdc-icon-button__icon{display:flex!important;align-items:center!important;justify-content:center!important;margin:0!important;padding:0!important}\n"], dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i1.NgForOf, selector: "[ngFor][ngForOf]", inputs: ["ngForOf", "ngForTrackBy", "ngForTemplate"] }, { kind: "directive", type: i1.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "ngmodule", type: FormsModule }, { kind: "directive", type: i2.DefaultValueAccessor, selector: "input:not([type=checkbox])[formControlName],textarea[formControlName],input:not([type=checkbox])[formControl],textarea[formControl],input:not([type=checkbox])[ngModel],textarea[ngModel],[ngDefaultControl]" }, { kind: "directive", type: i2.NgControlStatus, selector: "[formControlName],[ngModel],[formControl]" }, { kind: "directive", type: i2.NgModel, selector: "[ngModel]:not([formControlName]):not([formControl])", inputs: ["name", "disabled", "ngModel", "ngModelOptions"], outputs: ["ngModelChange"], exportAs: ["ngModel"] }, { kind: "ngmodule", type: MatIconModule }, { kind: "component", type: i3.MatIcon, selector: "mat-icon", inputs: ["color", "inline", "svgIcon", "fontSet", "fontIcon"], exportAs: ["matIcon"] }, { kind: "ngmodule", type: MatButtonModule }, { kind: "component", type: i4.MatIconButton, selector: "button[mat-icon-button]", exportAs: ["matButton"] }] });
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
  `, styles: [".message-input-container{padding:8px 12px;border-top:1px solid rgba(255,255,255,.15);background:transparent;position:relative}.input-resize-handle{position:absolute;top:-5px;left:0;right:0;height:10px;display:flex;align-items:center;justify-content:center;cursor:ns-resize;z-index:2}.input-resize-handle span{width:42px;height:3px;border-radius:999px;background:#ffffff38;transition:background .15s,width .15s}.input-resize-handle:hover span{width:56px;background:#ffffff6b}.file-previews{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;max-height:80px;overflow-y:auto}.file-chip{display:flex;align-items:center;gap:4px;background:#ffffff26;border-radius:8px;padding:4px 4px 4px 8px;max-width:200px}.file-icon{font-size:16px;width:16px;height:16px;color:#fffc}.file-name{font-size:12px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100px}.file-size{font-size:10px;color:#ffffff80;flex-shrink:0}.file-remove{width:20px!important;height:20px!important}.file-remove mat-icon{font-size:14px;width:14px;height:14px;color:#fff9}.input-wrapper{display:flex;align-items:flex-end;gap:4px;background:#ffffff1a;border-radius:24px;padding:2px 4px}.attach-btn,.send-btn{flex-shrink:0;width:36px;height:36px;padding:0!important;margin:0;min-width:36px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;line-height:0!important}.attach-btn mat-icon,.send-btn mat-icon{color:#ffffffb3;font-size:20px;width:20px;height:20px;line-height:20px;margin:0;display:flex;align-items:center;justify-content:center}.send-btn mat-icon{color:#ffffffe6}.message-textarea{flex:1;border:none;outline:none;background:transparent;resize:none;font-size:14px;font-family:inherit;line-height:1.5;min-height:24px;max-height:180px;padding:7px 0;color:#fff;overflow-y:auto;box-sizing:border-box}.message-textarea::placeholder{color:#ffffff80}.send-btn:disabled mat-icon{color:#ffffff4d}:host ::ng-deep .attach-btn .mat-mdc-button-touch-target,:host ::ng-deep .send-btn .mat-mdc-button-touch-target{height:36px!important;width:36px!important}:host ::ng-deep .attach-btn .mdc-icon-button__icon,:host ::ng-deep .send-btn .mdc-icon-button__icon{display:flex!important;align-items:center!important;justify-content:center!important;margin:0!important;padding:0!important}\n"] }]
        }], propDecorators: { conversationId: [{
                type: Input
            }], messageSent: [{
                type: Output
            }], messageWithFiles: [{
                type: Output
            }], fileInput: [{
                type: ViewChild,
                args: ['fileInput']
            }], messageTextarea: [{
                type: ViewChild,
                args: ['messageTextarea']
            }] } });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVzc2FnZS1pbnB1dC5jb21wb25lbnQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvbGliL2NvbXBvbmVudHMvbWVzc2FnZS1pbnB1dC9tZXNzYWdlLWlucHV0LmNvbXBvbmVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBRUwsU0FBUyxFQUVULFlBQVksRUFDWixLQUFLLEVBR0wsTUFBTSxFQUVOLFNBQVMsR0FDVixNQUFNLGVBQWUsQ0FBQztBQUN2QixPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDL0MsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLGdCQUFnQixDQUFDO0FBQzdDLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSx3QkFBd0IsQ0FBQztBQUN2RCxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sMEJBQTBCLENBQUM7Ozs7OztBQWdQM0QsTUFBTSxPQUFPLHFCQUFxQjtJQUN2QixjQUFjLEdBQWtCLElBQUksQ0FBQztJQUNwQyxXQUFXLEdBQUcsSUFBSSxZQUFZLEVBQVUsQ0FBQztJQUN6QyxnQkFBZ0IsR0FBRyxJQUFJLFlBQVksRUFBa0IsQ0FBQztJQUN4QyxTQUFTLENBQWdDO0lBQ25DLGVBQWUsQ0FBbUM7SUFFaEYsV0FBVyxHQUFHLEVBQUUsQ0FBQztJQUNqQixhQUFhLEdBQVcsRUFBRSxDQUFDO0lBQzNCLGNBQWMsR0FBRyxFQUFFLENBQUM7SUFDSCxXQUFXLEdBQUcsa0JBQWtCLENBQUM7SUFDMUMsa0JBQWtCLEdBQWtCLElBQUksQ0FBQztJQUN6QyxRQUFRLEdBQUcsS0FBSyxDQUFDO0lBQ2pCLFlBQVksR0FBRyxDQUFDLENBQUM7SUFDakIsaUJBQWlCLEdBQUcsQ0FBQyxDQUFDO0lBQ2IsaUJBQWlCLEdBQUcsRUFBRSxDQUFDO0lBQ3ZCLGlCQUFpQixHQUFHLEdBQUcsQ0FBQztJQUNqQyxlQUFlLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxJ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QkFBbUIsY0FDakIsSUFBSSxXQUNQLENBQUMsWUFBWSxFQUFFLFdBQVcsRUFBRSxhQUFhLEVBQUUsZUFBZSxDQUFDLFlBQzFEOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBMERUOzhCQTRLUSxjQUFjO3NCQUF0QixLQUFLO2dCQUNJLFdBQVc7c0JBQXBCLE1BQU07Z0JBQ0csZ0JBQWdCO3NCQUF6QixNQUFNO2dCQUNpQixTQUFTO3NCQUFoQyxTQUFTO3VCQUFDLFdBQVc7Z0JBQ1EsZUFBZTtzQkFBNUMsU0FBUzt1QkFBQyxpQkFBaUIiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge1xuICBBZnRlclZpZXdJbml0LFxuICBDb21wb25lbnQsXG4gIEVsZW1lbnRSZWYsXG4gIEV2ZW50RW1pdHRlcixcbiAgSW5wdXQsXG4gIE9uQ2hhbmdlcyxcbiAgT25EZXN0cm95LFxuICBPdXRwdXQsXG4gIFNpbXBsZUNoYW5nZXMsXG4gIFZpZXdDaGlsZCxcbn0gZnJvbSAnQGFuZ3VsYXIvY29yZSc7XG5pbXBvcnQgeyBDb21tb25Nb2R1bGUgfSBmcm9tICdAYW5ndWxhci9jb21tb24nO1xuaW1wb3J0IHsgRm9ybXNNb2R1bGUgfSBmcm9tICdAYW5ndWxhci9mb3Jtcyc7XG5pbXBvcnQgeyBNYXRJY29uTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvbWF0ZXJpYWwvaWNvbic7XG5pbXBvcnQgeyBNYXRCdXR0b25Nb2R1bGUgfSBmcm9tICdAYW5ndWxhci9tYXRlcmlhbC9idXR0b24nO1xuXG5leHBvcnQgaW50ZXJmYWNlIE1lc3NhZ2VQYXlsb2FkIHtcbiAgdGV4dDogc3RyaW5nO1xuICBmaWxlczogRmlsZVtdO1xufVxuXG5AQ29tcG9uZW50KHtcbiAgc2VsZWN0b3I6ICdhcHAtbWVzc2FnZS1pbnB1dCcsXG4gIHN0YW5kYWxvbmU6IHRydWUsXG4gIGltcG9ydHM6IFtDb21tb25Nb2R1bGUsIEZvcm1zTW9kdWxlLCBNYXRJY29uTW9kdWxlLCBNYXRCdXR0b25Nb2R1bGVdLFxuICB0ZW1wbGF0ZTogYFxuICAgIDxkaXZcbiAgICAgIGNsYXNzPVwibWVzc2FnZS1pbnB1dC1jb250YWluZXJcIlxuICAgID5cbiAgICAgIDxkaXZcbiAgICAgICAgY2xhc3M9XCJpbnB1dC1yZXNpemUtaGFuZGxlXCJcbiAgICAgICAgdGl0bGU9XCJEcmFnIHVwIHRvIGV4cGFuZCBtZXNzYWdlIGJveFwiXG4gICAgICAgIChtb3VzZWRvd24pPVwib25SZXNpemVTdGFydCgkZXZlbnQpXCJcbiAgICAgID5cbiAgICAgICAgPHNwYW4+PC9zcGFuPlxuICAgICAgPC9kaXY+XG5cbiAgICAgIDwhLS0gRmlsZSBwcmV2aWV3cyAtLT5cbiAgICAgIDxkaXYgKm5nSWY9XCJzZWxlY3RlZEZpbGVzLmxlbmd0aCA+IDBcIiBjbGFzcz1cImZpbGUtcHJldmlld3NcIj5cbiAgICAgICAgPGRpdiAqbmdGb3I9XCJsZXQgZmlsZSBvZiBzZWxlY3RlZEZpbGVzOyBsZXQgaSA9IGluZGV4XCIgY2xhc3M9XCJmaWxlLWNoaXBcIj5cbiAgICAgICAgICA8bWF0LWljb24gY2xhc3M9XCJmaWxlLWljb25cIj57eyBnZXRGaWxlSWNvbihmaWxlKSB9fTwvbWF0LWljb24+XG4gICAgICAgICAgPHNwYW4gY2xhc3M9XCJmaWxlLW5hbWVcIj57eyBmaWxlLm5hbWUgfX08L3NwYW4+XG4gICAgICAgICAgPHNwYW4gY2xhc3M9XCJmaWxlLXNpemVcIj57eyBmb3JtYXRTaXplKGZpbGUuc2l6ZSkgfX08L3NwYW4+XG4gICAgICAgICAgPGJ1dHRvbiBtYXQtaWNvbi1idXR0b24gY2xhc3M9XCJmaWxlLXJlbW92ZVwiIChjbGljayk9XCJyZW1vdmVGaWxlKGkpXCI+XG4gICAgICAgICAgICA8bWF0LWljb24+Y2xvc2U8L21hdC1pY29uPlxuICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuXG4gICAgICA8ZGl2IGNsYXNzPVwiaW5wdXQtd3JhcHBlclwiPlxuICAgICAgICA8YnV0dG9uIG1hdC1pY29uLWJ1dHRvbiBjbGFzcz1cImF0dGFjaC1idG5cIiAoY2xpY2spPVwiZmlsZUlucHV0LmNsaWNrKClcIiB0aXRsZT1cIkF0dGFjaCBmaWxlc1wiPlxuICAgICAgICAgIDxtYXQtaWNvbj5hdHRhY2hfZmlsZTwvbWF0LWljb24+XG4gICAgICAgIDwvYnV0dG9uPlxuICAgICAgICA8aW5wdXRcbiAgICAgICAgICAjZmlsZUlucHV0XG4gICAgICAgICAgdHlwZT1cImZpbGVcIlxuICAgICAgICAgIG11bHRpcGxlXG4gICAgICAgICAgc3R5bGU9XCJkaXNwbGF5Om5vbmVcIlxuICAgICAgICAgIChjaGFuZ2UpPVwib25GaWxlc1NlbGVjdGVkKCRldmVudClcIlxuICAgICAgICAvPlxuICAgICAgICA8dGV4dGFyZWFcbiAgICAgICAgICAjbWVzc2FnZVRleHRhcmVhXG4gICAgICAgICAgW25nTW9kZWxdPVwibWVzc2FnZVRleHRcIlxuICAgICAgICAgIChuZ01vZGVsQ2hhbmdlKT1cIm9uVGV4dENoYW5nZSgkZXZlbnQpXCJcbiAgICAgICAgICAoaW5wdXQpPVwiYXV0b1Jlc2l6ZSgpXCJcbiAgICAgICAgICAocGFzdGUpPVwib25QYXN0ZSgkZXZlbnQpXCJcbiAgICAgICAgICAoa2V5ZG93bi5lbnRlcik9XCJvbkVudGVyKCRldmVudClcIlxuICAgICAgICAgIHBsYWNlaG9sZGVyPVwiVHlwZSBhIG1lc3NhZ2UuLi5cIlxuICAgICAgICAgIHJvd3M9XCIxXCJcbiAgICAgICAgICBjbGFzcz1cIm1lc3NhZ2UtdGV4dGFyZWFcIlxuICAgICAgICAgIFtzdHlsZS5oZWlnaHQucHhdPVwidGV4dGFyZWFIZWlnaHRcIlxuICAgICAgICA+PC90ZXh0YXJlYT5cbiAgICAgICAgPGJ1dHRvblxuICAgICAgICAgIG1hdC1pY29uLWJ1dHRvblxuICAgICAgICAgIGNsYXNzPVwic2VuZC1idG5cIlxuICAgICAgICAgIFtkaXNhYmxlZF09XCIhY2FuU2VuZFwiXG4gICAgICAgICAgKGNsaWNrKT1cInNlbmQoKVwiXG4gICAgICAgID5cbiAgICAgICAgICA8bWF0LWljb24+c2VuZDwvbWF0LWljb24+XG4gICAgICAgIDwvYnV0dG9uPlxuICAgICAgPC9kaXY+XG5cbiAgICA8L2Rpdj5cbiAgYCxcbiAgc3R5bGVzOiBbYFxuICAgIC5tZXNzYWdlLWlucHV0LWNvbnRhaW5lciB7XG4gICAgICBwYWRkaW5nOiA4cHggMTJweDtcbiAgICAgIGJvcmRlci10b3A6IDFweCBzb2xpZCByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMTUpO1xuICAgICAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQ7XG4gICAgICBwb3NpdGlvbjogcmVsYXRpdmU7XG4gICAgfVxuXG4gICAgLmlucHV0LXJlc2l6ZS1oYW5kbGUge1xuICAgICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgICAgdG9wOiAtNXB4O1xuICAgICAgbGVmdDogMDtcbiAgICAgIHJpZ2h0OiAwO1xuICAgICAgaGVpZ2h0OiAxMHB4O1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgIGN1cnNvcjogbnMtcmVzaXplO1xuICAgICAgei1pbmRleDogMjtcbiAgICB9XG5cbiAgICAuaW5wdXQtcmVzaXplLWhhbmRsZSBzcGFuIHtcbiAgICAgIHdpZHRoOiA0MnB4O1xuICAgICAgaGVpZ2h0OiAzcHg7XG4gICAgICBib3JkZXItcmFkaXVzOiA5OTlweDtcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4yMik7XG4gICAgICB0cmFuc2l0aW9uOiBiYWNrZ3JvdW5kIDAuMTVzLCB3aWR0aCAwLjE1cztcbiAgICB9XG5cbiAgICAuaW5wdXQtcmVzaXplLWhhbmRsZTpob3ZlciBzcGFuIHtcbiAgICAgIHdpZHRoOiA1NnB4O1xuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjQyKTtcbiAgICB9XG5cbiAgICAuZmlsZS1wcmV2aWV3cyB7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgZmxleC13cmFwOiB3cmFwO1xuICAgICAgZ2FwOiA2cHg7XG4gICAgICBtYXJnaW4tYm90dG9tOiA4cHg7XG4gICAgICBtYXgtaGVpZ2h0OiA4MHB4O1xuICAgICAgb3ZlcmZsb3cteTogYXV0bztcbiAgICB9XG5cbiAgICAuZmlsZS1jaGlwIHtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgZ2FwOiA0cHg7XG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMTUpO1xuICAgICAgYm9yZGVyLXJhZGl1czogOHB4O1xuICAgICAgcGFkZGluZzogNHB4IDRweCA0cHggOHB4O1xuICAgICAgbWF4LXdpZHRoOiAyMDBweDtcbiAgICB9XG5cbiAgICAuZmlsZS1pY29uIHtcbiAgICAgIGZvbnQtc2l6ZTogMTZweDtcbiAgICAgIHdpZHRoOiAxNnB4O1xuICAgICAgaGVpZ2h0OiAxNnB4O1xuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC44KTtcbiAgICB9XG5cbiAgICAuZmlsZS1uYW1lIHtcbiAgICAgIGZvbnQtc2l6ZTogMTJweDtcbiAgICAgIGNvbG9yOiAjZmZmO1xuICAgICAgd2hpdGUtc3BhY2U6IG5vd3JhcDtcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICB0ZXh0LW92ZXJmbG93OiBlbGxpcHNpcztcbiAgICAgIG1heC13aWR0aDogMTAwcHg7XG4gICAgfVxuXG4gICAgLmZpbGUtc2l6ZSB7XG4gICAgICBmb250LXNpemU6IDEwcHg7XG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjUpO1xuICAgICAgZmxleC1zaHJpbms6IDA7XG4gICAgfVxuXG4gICAgLmZpbGUtcmVtb3ZlIHtcbiAgICAgIHdpZHRoOiAyMHB4ICFpbXBvcnRhbnQ7XG4gICAgICBoZWlnaHQ6IDIwcHggIWltcG9ydGFudDtcbiAgICB9XG5cbiAgICAuZmlsZS1yZW1vdmUgbWF0LWljb24ge1xuICAgICAgZm9udC1zaXplOiAxNHB4O1xuICAgICAgd2lkdGg6IDE0cHg7XG4gICAgICBoZWlnaHQ6IDE0cHg7XG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjYpO1xuICAgIH1cblxuICAgIC5pbnB1dC13cmFwcGVyIHtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBhbGlnbi1pdGVtczogZmxleC1lbmQ7XG4gICAgICBnYXA6IDRweDtcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xKTtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDI0cHg7XG4gICAgICBwYWRkaW5nOiAycHggNHB4O1xuICAgIH1cblxuICAgIC5hdHRhY2gtYnRuLFxuICAgIC5zZW5kLWJ0biB7XG4gICAgICBmbGV4LXNocmluazogMDtcbiAgICAgIHdpZHRoOiAzNnB4O1xuICAgICAgaGVpZ2h0OiAzNnB4O1xuICAgICAgcGFkZGluZzogMCAhaW1wb3J0YW50O1xuICAgICAgbWFyZ2luOiAwO1xuICAgICAgbWluLXdpZHRoOiAzNnB4ICFpbXBvcnRhbnQ7XG4gICAgICBkaXNwbGF5OiBpbmxpbmUtZmxleCAhaW1wb3J0YW50O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlciAhaW1wb3J0YW50O1xuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXIgIWltcG9ydGFudDtcbiAgICAgIGxpbmUtaGVpZ2h0OiAwICFpbXBvcnRhbnQ7XG4gICAgfVxuXG4gICAgLmF0dGFjaC1idG4gbWF0LWljb24sXG4gICAgLnNlbmQtYnRuIG1hdC1pY29uIHtcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNyk7XG4gICAgICBmb250LXNpemU6IDIwcHg7XG4gICAgICB3aWR0aDogMjBweDtcbiAgICAgIGhlaWdodDogMjBweDtcbiAgICAgIGxpbmUtaGVpZ2h0OiAyMHB4O1xuICAgICAgbWFyZ2luOiAwO1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICB9XG5cbiAgICAuc2VuZC1idG4gbWF0LWljb24ge1xuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC45KTtcbiAgICB9XG5cbiAgICAubWVzc2FnZS10ZXh0YXJlYSB7XG4gICAgICBmbGV4OiAxO1xuICAgICAgYm9yZGVyOiBub25lO1xuICAgICAgb3V0bGluZTogbm9uZTtcbiAgICAgIGJhY2tncm91bmQ6IHRyYW5zcGFyZW50O1xuICAgICAgcmVzaXplOiBub25lO1xuICAgICAgZm9udC1zaXplOiAxNHB4O1xuICAgICAgZm9udC1mYW1pbHk6IGluaGVyaXQ7XG4gICAgICBsaW5lLWhlaWdodDogMS41O1xuICAgICAgbWluLWhlaWdodDogMjRweDtcbiAgICAgIG1heC1oZWlnaHQ6IDE4MHB4O1xuICAgICAgcGFkZGluZzogN3B4IDA7XG4gICAgICBjb2xvcjogI2ZmZjtcbiAgICAgIG92ZXJmbG93LXk6IGF1dG87XG4gICAgICBib3gtc2l6aW5nOiBib3JkZXItYm94O1xuICAgIH1cblxuICAgIC5tZXNzYWdlLXRleHRhcmVhOjpwbGFjZWhvbGRlciB7XG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjUpO1xuICAgIH1cblxuICAgIC5zZW5kLWJ0bjpkaXNhYmxlZCBtYXQtaWNvbiB7XG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjMpO1xuICAgIH1cblxuICAgIC8qIE1EQyBtYXQtaWNvbi1idXR0b24gaW5uZXIgd3JhcHBlciBvZnRlbiBzaGlmdHMgZ2x5cGhzIGRvd253YXJkIHdpdGhvdXQgdGhpcyAqL1xuICAgIDpob3N0IDo6bmctZGVlcCAuYXR0YWNoLWJ0biAubWF0LW1kYy1idXR0b24tdG91Y2gtdGFyZ2V0LFxuICAgIDpob3N0IDo6bmctZGVlcCAuc2VuZC1idG4gLm1hdC1tZGMtYnV0dG9uLXRvdWNoLXRhcmdldCB7XG4gICAgICBoZWlnaHQ6IDM2cHggIWltcG9ydGFudDtcbiAgICAgIHdpZHRoOiAzNnB4ICFpbXBvcnRhbnQ7XG4gICAgfVxuXG4gICAgOmhvc3QgOjpuZy1kZWVwIC5hdHRhY2gtYnRuIC5tZGMtaWNvbi1idXR0b25fX2ljb24sXG4gICAgOmhvc3QgOjpuZy1kZWVwIC5zZW5kLWJ0biAubWRjLWljb24tYnV0dG9uX19pY29uIHtcbiAgICAgIGRpc3BsYXk6IGZsZXggIWltcG9ydGFudDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXIgIWltcG9ydGFudDtcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyICFpbXBvcnRhbnQ7XG4gICAgICBtYXJnaW46IDAgIWltcG9ydGFudDtcbiAgICAgIHBhZGRpbmc6IDAgIWltcG9ydGFudDtcbiAgICB9XG5cbiAgYF0sXG59KVxuZXhwb3J0IGNsYXNzIE1lc3NhZ2VJbnB1dENvbXBvbmVudCBpbXBsZW1lbnRzIE9uQ2hhbmdlcywgQWZ0ZXJWaWV3SW5pdCwgT25EZXN0cm95IHtcbiAgQElucHV0KCkgY29udmVyc2F0aW9uSWQ6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuICBAT3V0cHV0KCkgbWVzc2FnZVNlbnQgPSBuZXcgRXZlbnRFbWl0dGVyPHN0cmluZz4oKTtcbiAgQE91dHB1dCgpIG1lc3NhZ2VXaXRoRmlsZXMgPSBuZXcgRXZlbnRFbWl0dGVyPE1lc3NhZ2VQYXlsb2FkPigpO1xuICBAVmlld0NoaWxkKCdmaWxlSW5wdXQnKSBmaWxlSW5wdXQhOiBFbGVtZW50UmVmPEhUTUxJbnB1dEVsZW1lbnQ+O1xuICBAVmlld0NoaWxkKCdtZXNzYWdlVGV4dGFyZWEnKSBtZXNzYWdlVGV4dGFyZWEhOiBFbGVtZW50UmVmPEhUTUxUZXh0QXJlYUVsZW1lbnQ+O1xuXG4gIG1lc3NhZ2VUZXh0ID0gJyc7XG4gIHNlbGVjdGVkRmlsZXM6IEZpbGVbXSA9IFtdO1xuICB0ZXh0YXJlYUhlaWdodCA9IDM2O1xuICBwcml2YXRlIHJlYWRvbmx5IGRyYWZ0UHJlZml4ID0gJ21lc3NhZ2luZ19kcmFmdF8nO1xuICBwcml2YXRlIGxhc3RDb252ZXJzYXRpb25JZDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgcmVzaXppbmcgPSBmYWxzZTtcbiAgcHJpdmF0ZSByZXNpemVTdGFydFkgPSAwO1xuICBwcml2YXRlIHJlc2l6ZVN0YXJ0SGVpZ2h0ID0gMDtcbiAgcHJpdmF0ZSByZWFkb25seSBtaW5UZXh0YXJlYUhlaWdodCA9IDM2O1xuICBwcml2YXRlIHJlYWRvbmx5IG1heFRleHRhcmVhSGVpZ2h0ID0gMTgwO1xuICBwcml2YXRlIGJvdW5kUmVzaXplTW92ZSA9IHRoaXMub25SZXNpemVNb3ZlLmJpbmQodGhpcyk7XG4gIHByaXZhdGUgYm91bmRSZXNpemVFbmQgPSB0aGlzLm9uUmVzaXplRW5kLmJpbmQodGhpcyk7XG5cbiAgbmdPbkNoYW5nZXMoY2hhbmdlczogU2ltcGxlQ2hhbmdlcyk6IHZvaWQge1xuICAgIGlmICghY2hhbmdlc1snY29udmVyc2F0aW9uSWQnXSkgcmV0dXJuO1xuICAgIGlmICh0aGlzLmxhc3RDb252ZXJzYXRpb25JZCAmJiB0aGlzLmxhc3RDb252ZXJzYXRpb25JZCAhPT0gdGhpcy5jb252ZXJzYXRpb25JZCkge1xuICAgICAgdGhpcy5wZXJzaXN0RHJhZnQodGhpcy5sYXN0Q29udmVyc2F0aW9uSWQsIHRoaXMubWVzc2FnZVRleHQpO1xuICAgIH1cbiAgICB0aGlzLmxhc3RDb252ZXJzYXRpb25JZCA9IHRoaXMuY29udmVyc2F0aW9uSWQ7XG4gICAgdGhpcy5tZXNzYWdlVGV4dCA9IHRoaXMubG9hZERyYWZ0KHRoaXMuY29udmVyc2F0aW9uSWQpO1xuICAgIHRoaXMucXVldWVBdXRvUmVzaXplKCk7XG4gIH1cblxuICBuZ0FmdGVyVmlld0luaXQoKTogdm9pZCB7XG4gICAgdGhpcy5xdWV1ZUF1dG9SZXNpemUoKTtcbiAgfVxuXG4gIG5nT25EZXN0cm95KCk6IHZvaWQge1xuICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIHRoaXMuYm91bmRSZXNpemVNb3ZlKTtcbiAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgdGhpcy5ib3VuZFJlc2l6ZUVuZCk7XG4gICAgZG9jdW1lbnQuYm9keS5zdHlsZS5jdXJzb3IgPSAnJztcbiAgICBkb2N1bWVudC5ib2R5LnN0eWxlLnVzZXJTZWxlY3QgPSAnJztcbiAgfVxuXG4gIGdldCBjYW5TZW5kKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLm1lc3NhZ2VUZXh0LnRyaW0oKS5sZW5ndGggPiAwIHx8IHRoaXMuc2VsZWN0ZWRGaWxlcy5sZW5ndGggPiAwO1xuICB9XG5cbiAgc2VuZCgpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMuY2FuU2VuZCkgcmV0dXJuO1xuICAgIGNvbnN0IHRleHQgPSB0aGlzLm1lc3NhZ2VUZXh0LnRyaW0oKTtcblxuICAgIGlmICh0aGlzLnNlbGVjdGVkRmlsZXMubGVuZ3RoID4gMCkge1xuICAgICAgdGhpcy5tZXNzYWdlV2l0aEZpbGVzLmVtaXQoeyB0ZXh0LCBmaWxlczogWy4uLnRoaXMuc2VsZWN0ZWRGaWxlc10gfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMubWVzc2FnZVNlbnQuZW1pdCh0ZXh0KTtcbiAgICB9XG5cbiAgICB0aGlzLm1lc3NhZ2VUZXh0ID0gJyc7XG4gICAgdGhpcy5zZWxlY3RlZEZpbGVzID0gW107XG4gICAgdGhpcy5jbGVhckRyYWZ0KHRoaXMuY29udmVyc2F0aW9uSWQpO1xuICAgIGlmICh0aGlzLmZpbGVJbnB1dCkgdGhpcy5maWxlSW5wdXQubmF0aXZlRWxlbWVudC52YWx1ZSA9ICcnO1xuICAgIHRoaXMucXVldWVBdXRvUmVzaXplKCk7XG4gIH1cblxuICBvblRleHRDaGFuZ2UodmFsdWU6IHN0cmluZyk6IHZvaWQge1xuICAgIHRoaXMubWVzc2FnZVRleHQgPSB2YWx1ZTtcbiAgICB0aGlzLnBlcnNpc3REcmFmdCh0aGlzLmNvbnZlcnNhdGlvbklkLCB2YWx1ZSk7XG4gICAgdGhpcy5xdWV1ZUF1dG9SZXNpemUoKTtcbiAgfVxuXG4gIG9uUGFzdGUoZXZlbnQ6IENsaXBib2FyZEV2ZW50KTogdm9pZCB7XG4gICAgY29uc3QgaHRtbCA9IGV2ZW50LmNsaXBib2FyZERhdGE/LmdldERhdGEoJ3RleHQvaHRtbCcpIHx8ICcnO1xuICAgIGlmICghaHRtbCB8fCAhLzx0YWJsZVtcXHM+XS9pLnRlc3QoaHRtbCkpIHJldHVybjtcblxuICAgIGNvbnN0IHRhYmxlVGV4dCA9IHRoaXMuaHRtbFRhYmxlVG9UZXh0KGh0bWwpO1xuICAgIGlmICghdGFibGVUZXh0KSByZXR1cm47XG5cbiAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIHRoaXMuaW5zZXJ0VGV4dEF0Q3Vyc29yKHRhYmxlVGV4dCk7XG4gIH1cblxuICBhdXRvUmVzaXplKCk6IHZvaWQge1xuICAgIGNvbnN0IGVsID0gdGhpcy5tZXNzYWdlVGV4dGFyZWE/Lm5hdGl2ZUVsZW1lbnQ7XG4gICAgaWYgKCFlbCkgcmV0dXJuO1xuICAgIGNvbnN0IG5leHRIZWlnaHQgPSBNYXRoLm1pbihcbiAgICAgIE1hdGgubWF4KGVsLnNjcm9sbEhlaWdodCwgdGhpcy5taW5UZXh0YXJlYUhlaWdodCksXG4gICAgICBNYXRoLm1heCh0aGlzLnRleHRhcmVhSGVpZ2h0LCB0aGlzLm1pblRleHRhcmVhSGVpZ2h0KVxuICAgICk7XG4gICAgdGhpcy50ZXh0YXJlYUhlaWdodCA9IE1hdGgubWluKG5leHRIZWlnaHQsIHRoaXMubWF4VGV4dGFyZWFIZWlnaHQpO1xuICB9XG5cbiAgb25SZXNpemVTdGFydChldmVudDogTW91c2VFdmVudCk6IHZvaWQge1xuICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgdGhpcy5yZXNpemluZyA9IHRydWU7XG4gICAgdGhpcy5yZXNpemVTdGFydFkgPSBldmVudC5jbGllbnRZO1xuICAgIHRoaXMucmVzaXplU3RhcnRIZWlnaHQgPSB0aGlzLnRleHRhcmVhSGVpZ2h0O1xuICAgIGRvY3VtZW50LmJvZHkuc3R5bGUuY3Vyc29yID0gJ25zLXJlc2l6ZSc7XG4gICAgZG9jdW1lbnQuYm9keS5zdHlsZS51c2VyU2VsZWN0ID0gJ25vbmUnO1xuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIHRoaXMuYm91bmRSZXNpemVNb3ZlKTtcbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgdGhpcy5ib3VuZFJlc2l6ZUVuZCk7XG4gIH1cblxuICBwcml2YXRlIG9uUmVzaXplTW92ZShldmVudDogTW91c2VFdmVudCk6IHZvaWQge1xuICAgIGlmICghdGhpcy5yZXNpemluZykgcmV0dXJuO1xuICAgIGNvbnN0IGR5ID0gdGhpcy5yZXNpemVTdGFydFkgLSBldmVudC5jbGllbnRZO1xuICAgIHRoaXMudGV4dGFyZWFIZWlnaHQgPSBNYXRoLm1heChcbiAgICAgIHRoaXMubWluVGV4dGFyZWFIZWlnaHQsXG4gICAgICBNYXRoLm1pbih0aGlzLm1heFRleHRhcmVhSGVpZ2h0LCB0aGlzLnJlc2l6ZVN0YXJ0SGVpZ2h0ICsgZHkpXG4gICAgKTtcbiAgfVxuXG4gIHByaXZhdGUgb25SZXNpemVFbmQoKTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLnJlc2l6aW5nKSByZXR1cm47XG4gICAgdGhpcy5yZXNpemluZyA9IGZhbHNlO1xuICAgIGRvY3VtZW50LmJvZHkuc3R5bGUuY3Vyc29yID0gJyc7XG4gICAgZG9jdW1lbnQuYm9keS5zdHlsZS51c2VyU2VsZWN0ID0gJyc7XG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgdGhpcy5ib3VuZFJlc2l6ZU1vdmUpO1xuICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCB0aGlzLmJvdW5kUmVzaXplRW5kKTtcbiAgfVxuXG4gIHByaXZhdGUgcXVldWVBdXRvUmVzaXplKCk6IHZvaWQge1xuICAgIHNldFRpbWVvdXQoKCkgPT4gdGhpcy5hdXRvUmVzaXplKCkpO1xuICB9XG5cbiAgcHJpdmF0ZSBkcmFmdEtleShjb252ZXJzYXRpb25JZDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICByZXR1cm4gYCR7dGhpcy5kcmFmdFByZWZpeH0ke2NvbnZlcnNhdGlvbklkfWA7XG4gIH1cblxuICBwcml2YXRlIGxvYWREcmFmdChjb252ZXJzYXRpb25JZDogc3RyaW5nIHwgbnVsbCk6IHN0cmluZyB7XG4gICAgaWYgKCFjb252ZXJzYXRpb25JZCkgcmV0dXJuICcnO1xuICAgIHJldHVybiBsb2NhbFN0b3JhZ2UuZ2V0SXRlbSh0aGlzLmRyYWZ0S2V5KGNvbnZlcnNhdGlvbklkKSkgfHwgJyc7XG4gIH1cblxuICBwcml2YXRlIHBlcnNpc3REcmFmdChjb252ZXJzYXRpb25JZDogc3RyaW5nIHwgbnVsbCwgdmFsdWU6IHN0cmluZyk6IHZvaWQge1xuICAgIGlmICghY29udmVyc2F0aW9uSWQpIHJldHVybjtcbiAgICBjb25zdCBrZXkgPSB0aGlzLmRyYWZ0S2V5KGNvbnZlcnNhdGlvbklkKTtcbiAgICBpZiAodmFsdWUudHJpbSgpKSB7XG4gICAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbShrZXksIHZhbHVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oa2V5KTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGNsZWFyRHJhZnQoY29udmVyc2F0aW9uSWQ6IHN0cmluZyB8IG51bGwpOiB2b2lkIHtcbiAgICBpZiAoIWNvbnZlcnNhdGlvbklkKSByZXR1cm47XG4gICAgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0odGhpcy5kcmFmdEtleShjb252ZXJzYXRpb25JZCkpO1xuICB9XG5cbiAgcHJpdmF0ZSBodG1sVGFibGVUb1RleHQoaHRtbDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgZG9jID0gbmV3IERPTVBhcnNlcigpLnBhcnNlRnJvbVN0cmluZyhodG1sLCAndGV4dC9odG1sJyk7XG4gICAgICBjb25zdCB0YWJsZSA9IGRvYy5xdWVyeVNlbGVjdG9yKCd0YWJsZScpO1xuICAgICAgaWYgKCF0YWJsZSkgcmV0dXJuICcnO1xuXG4gICAgICBjb25zdCByb3dzID0gQXJyYXkuZnJvbSh0YWJsZS5xdWVyeVNlbGVjdG9yQWxsKCd0cicpKTtcbiAgICAgIHJldHVybiByb3dzXG4gICAgICAgIC5tYXAoKHJvdykgPT5cbiAgICAgICAgICBBcnJheS5mcm9tKHJvdy5xdWVyeVNlbGVjdG9yQWxsKCd0aCx0ZCcpKVxuICAgICAgICAgICAgLm1hcCgoY2VsbCkgPT4gKGNlbGwudGV4dENvbnRlbnQgfHwgJycpLnJlcGxhY2UoL1xccysvZywgJyAnKS50cmltKCkpXG4gICAgICAgICAgICAuam9pbignXFx0JylcbiAgICAgICAgKVxuICAgICAgICAuZmlsdGVyKEJvb2xlYW4pXG4gICAgICAgIC5qb2luKCdcXG4nKTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIHJldHVybiAnJztcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGluc2VydFRleHRBdEN1cnNvcih0ZXh0OiBzdHJpbmcpOiB2b2lkIHtcbiAgICBjb25zdCB0ZXh0YXJlYSA9IHRoaXMubWVzc2FnZVRleHRhcmVhPy5uYXRpdmVFbGVtZW50O1xuICAgIGlmICghdGV4dGFyZWEpIHtcbiAgICAgIHRoaXMub25UZXh0Q2hhbmdlKGAke3RoaXMubWVzc2FnZVRleHR9JHt0ZXh0fWApO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHN0YXJ0ID0gdGV4dGFyZWEuc2VsZWN0aW9uU3RhcnQgPz8gdGhpcy5tZXNzYWdlVGV4dC5sZW5ndGg7XG4gICAgY29uc3QgZW5kID0gdGV4dGFyZWEuc2VsZWN0aW9uRW5kID8/IHRoaXMubWVzc2FnZVRleHQubGVuZ3RoO1xuICAgIGNvbnN0IG5leHQgPSBgJHt0aGlzLm1lc3NhZ2VUZXh0LnNsaWNlKDAsIHN0YXJ0KX0ke3RleHR9JHt0aGlzLm1lc3NhZ2VUZXh0LnNsaWNlKGVuZCl9YDtcbiAgICB0aGlzLm9uVGV4dENoYW5nZShuZXh0KTtcbiAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgIHRleHRhcmVhLnNlbGVjdGlvblN0YXJ0ID0gdGV4dGFyZWEuc2VsZWN0aW9uRW5kID0gc3RhcnQgKyB0ZXh0Lmxlbmd0aDtcbiAgICB9KTtcbiAgfVxuXG4gIG9uRW50ZXIoZXZlbnQ6IEV2ZW50KTogdm9pZCB7XG4gICAgY29uc3Qga2UgPSBldmVudCBhcyBLZXlib2FyZEV2ZW50O1xuICAgIGlmICgha2Uuc2hpZnRLZXkpIHtcbiAgICAgIGtlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICB0aGlzLnNlbmQoKTtcbiAgICB9XG4gIH1cblxuICBvbkZpbGVzU2VsZWN0ZWQoZXZlbnQ6IEV2ZW50KTogdm9pZCB7XG4gICAgY29uc3QgaW5wdXQgPSBldmVudC50YXJnZXQgYXMgSFRNTElucHV0RWxlbWVudDtcbiAgICBpZiAoaW5wdXQuZmlsZXMpIHtcbiAgICAgIHRoaXMuYWRkRmlsZXMoQXJyYXkuZnJvbShpbnB1dC5maWxlcykpO1xuICAgIH1cbiAgfVxuXG4gIGFkZEZpbGVzKGZpbGVzOiBGaWxlW10pOiB2b2lkIHtcbiAgICBpZiAoIWZpbGVzLmxlbmd0aCkgcmV0dXJuO1xuICAgIHRoaXMuc2VsZWN0ZWRGaWxlcyA9IFsuLi50aGlzLnNlbGVjdGVkRmlsZXMsIC4uLmZpbGVzXTtcbiAgfVxuXG4gIHJlbW92ZUZpbGUoaW5kZXg6IG51bWJlcik6IHZvaWQge1xuICAgIHRoaXMuc2VsZWN0ZWRGaWxlcy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgIHRoaXMuc2VsZWN0ZWRGaWxlcyA9IFsuLi50aGlzLnNlbGVjdGVkRmlsZXNdO1xuICB9XG5cbiAgZ2V0RmlsZUljb24oZmlsZTogRmlsZSk6IHN0cmluZyB7XG4gICAgY29uc3QgdHlwZSA9IGZpbGUudHlwZTtcbiAgICBpZiAodHlwZS5zdGFydHNXaXRoKCdpbWFnZS8nKSkgcmV0dXJuICdpbWFnZSc7XG4gICAgaWYgKHR5cGUuc3RhcnRzV2l0aCgndmlkZW8vJykpIHJldHVybiAndmlkZW9jYW0nO1xuICAgIGlmICh0eXBlLnN0YXJ0c1dpdGgoJ2F1ZGlvLycpKSByZXR1cm4gJ2F1ZGlvdHJhY2snO1xuICAgIGlmICh0eXBlLmluY2x1ZGVzKCdwZGYnKSkgcmV0dXJuICdwaWN0dXJlX2FzX3BkZic7XG4gICAgaWYgKHR5cGUuaW5jbHVkZXMoJ3NwcmVhZHNoZWV0JykgfHwgdHlwZS5pbmNsdWRlcygnZXhjZWwnKSkgcmV0dXJuICd0YWJsZV9jaGFydCc7XG4gICAgaWYgKHR5cGUuaW5jbHVkZXMoJ2RvY3VtZW50JykgfHwgdHlwZS5pbmNsdWRlcygnd29yZCcpKSByZXR1cm4gJ2Rlc2NyaXB0aW9uJztcbiAgICByZXR1cm4gJ2luc2VydF9kcml2ZV9maWxlJztcbiAgfVxuXG4gIGZvcm1hdFNpemUoYnl0ZXM6IG51bWJlcik6IHN0cmluZyB7XG4gICAgaWYgKGJ5dGVzIDwgMTAyNCkgcmV0dXJuIGJ5dGVzICsgJyBCJztcbiAgICBpZiAoYnl0ZXMgPCAxMDI0ICogMTAyNCkgcmV0dXJuIChieXRlcyAvIDEwMjQpLnRvRml4ZWQoMCkgKyAnIEtCJztcbiAgICByZXR1cm4gKGJ5dGVzIC8gKDEwMjQgKiAxMDI0KSkudG9GaXhlZCgxKSArICcgTUInO1xuICB9XG59XG4iXX0=