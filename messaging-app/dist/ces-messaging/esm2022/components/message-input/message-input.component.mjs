import { Component, EventEmitter, Output, ViewChild } from '@angular/core';
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
    messageSent = new EventEmitter();
    messageWithFiles = new EventEmitter();
    fileInput;
    messageText = '';
    selectedFiles = [];
    isDragOver = false;
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
        if (this.fileInput)
            this.fileInput.nativeElement.value = '';
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
            this.selectedFiles = [...this.selectedFiles, ...Array.from(input.files)];
        }
    }
    removeFile(index) {
        this.selectedFiles.splice(index, 1);
        this.selectedFiles = [...this.selectedFiles];
    }
    onDragOver(event) {
        event.preventDefault();
        event.stopPropagation();
        this.isDragOver = true;
    }
    onDragLeave(event) {
        event.preventDefault();
        event.stopPropagation();
        this.isDragOver = false;
    }
    onDrop(event) {
        event.preventDefault();
        event.stopPropagation();
        this.isDragOver = false;
        if (event.dataTransfer?.files) {
            this.selectedFiles = [...this.selectedFiles, ...Array.from(event.dataTransfer.files)];
        }
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
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "17.3.12", type: MessageInputComponent, isStandalone: true, selector: "app-message-input", outputs: { messageSent: "messageSent", messageWithFiles: "messageWithFiles" }, viewQueries: [{ propertyName: "fileInput", first: true, predicate: ["fileInput"], descendants: true }], ngImport: i0, template: `
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
  `, isInline: true, styles: [".message-input-container{padding:8px 12px;border-top:1px solid rgba(255,255,255,.15);background:transparent;position:relative}.message-input-container.drag-over{background:#ffffff1a}.file-previews{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;max-height:80px;overflow-y:auto}.file-chip{display:flex;align-items:center;gap:4px;background:#ffffff26;border-radius:8px;padding:4px 4px 4px 8px;max-width:200px}.file-icon{font-size:16px;width:16px;height:16px;color:#fffc}.file-name{font-size:12px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100px}.file-size{font-size:10px;color:#ffffff80;flex-shrink:0}.file-remove{width:20px!important;height:20px!important}.file-remove mat-icon{font-size:14px;width:14px;height:14px;color:#fff9}.input-wrapper{display:flex;align-items:center;gap:4px;background:#ffffff1a;border-radius:24px;padding:2px 4px}.attach-btn,.send-btn{flex-shrink:0;width:36px;height:36px;padding:0!important;margin:0;min-width:36px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;line-height:0!important}.attach-btn mat-icon,.send-btn mat-icon{color:#ffffffb3;font-size:20px;width:20px;height:20px;line-height:20px;margin:0;display:flex;align-items:center;justify-content:center}.send-btn mat-icon{color:#ffffffe6}.message-textarea{flex:1;border:none;outline:none;background:transparent;resize:none;font-size:14px;font-family:inherit;line-height:1.5;max-height:100px;padding:6px 0;color:#fff}.message-textarea::placeholder{color:#ffffff80}.send-btn:disabled mat-icon{color:#ffffff4d}:host ::ng-deep .attach-btn .mat-mdc-button-touch-target,:host ::ng-deep .send-btn .mat-mdc-button-touch-target{height:36px!important;width:36px!important}:host ::ng-deep .attach-btn .mdc-icon-button__icon,:host ::ng-deep .send-btn .mdc-icon-button__icon{display:flex!important;align-items:center!important;justify-content:center!important;margin:0!important;padding:0!important}.drag-overlay{position:absolute;inset:0;background:#1f4bd84d;border:2px dashed rgba(255,255,255,.5);border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;color:#fff;font-size:13px;z-index:5}.drag-overlay mat-icon{font-size:28px;width:28px;height:28px}\n"], dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i1.NgForOf, selector: "[ngFor][ngForOf]", inputs: ["ngForOf", "ngForTrackBy", "ngForTemplate"] }, { kind: "directive", type: i1.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "ngmodule", type: FormsModule }, { kind: "directive", type: i2.DefaultValueAccessor, selector: "input:not([type=checkbox])[formControlName],textarea[formControlName],input:not([type=checkbox])[formControl],textarea[formControl],input:not([type=checkbox])[ngModel],textarea[ngModel],[ngDefaultControl]" }, { kind: "directive", type: i2.NgControlStatus, selector: "[formControlName],[ngModel],[formControl]" }, { kind: "directive", type: i2.NgModel, selector: "[ngModel]:not([formControlName]):not([formControl])", inputs: ["name", "disabled", "ngModel", "ngModelOptions"], outputs: ["ngModelChange"], exportAs: ["ngModel"] }, { kind: "ngmodule", type: MatIconModule }, { kind: "component", type: i3.MatIcon, selector: "mat-icon", inputs: ["color", "inline", "svgIcon", "fontSet", "fontIcon"], exportAs: ["matIcon"] }, { kind: "ngmodule", type: MatButtonModule }, { kind: "component", type: i4.MatIconButton, selector: "button[mat-icon-button]", exportAs: ["matButton"] }] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: MessageInputComponent, decorators: [{
            type: Component,
            args: [{ selector: 'app-message-input', standalone: true, imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule], template: `
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
  `, styles: [".message-input-container{padding:8px 12px;border-top:1px solid rgba(255,255,255,.15);background:transparent;position:relative}.message-input-container.drag-over{background:#ffffff1a}.file-previews{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;max-height:80px;overflow-y:auto}.file-chip{display:flex;align-items:center;gap:4px;background:#ffffff26;border-radius:8px;padding:4px 4px 4px 8px;max-width:200px}.file-icon{font-size:16px;width:16px;height:16px;color:#fffc}.file-name{font-size:12px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100px}.file-size{font-size:10px;color:#ffffff80;flex-shrink:0}.file-remove{width:20px!important;height:20px!important}.file-remove mat-icon{font-size:14px;width:14px;height:14px;color:#fff9}.input-wrapper{display:flex;align-items:center;gap:4px;background:#ffffff1a;border-radius:24px;padding:2px 4px}.attach-btn,.send-btn{flex-shrink:0;width:36px;height:36px;padding:0!important;margin:0;min-width:36px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;line-height:0!important}.attach-btn mat-icon,.send-btn mat-icon{color:#ffffffb3;font-size:20px;width:20px;height:20px;line-height:20px;margin:0;display:flex;align-items:center;justify-content:center}.send-btn mat-icon{color:#ffffffe6}.message-textarea{flex:1;border:none;outline:none;background:transparent;resize:none;font-size:14px;font-family:inherit;line-height:1.5;max-height:100px;padding:6px 0;color:#fff}.message-textarea::placeholder{color:#ffffff80}.send-btn:disabled mat-icon{color:#ffffff4d}:host ::ng-deep .attach-btn .mat-mdc-button-touch-target,:host ::ng-deep .send-btn .mat-mdc-button-touch-target{height:36px!important;width:36px!important}:host ::ng-deep .attach-btn .mdc-icon-button__icon,:host ::ng-deep .send-btn .mdc-icon-button__icon{display:flex!important;align-items:center!important;justify-content:center!important;margin:0!important;padding:0!important}.drag-overlay{position:absolute;inset:0;background:#1f4bd84d;border:2px dashed rgba(255,255,255,.5);border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;color:#fff;font-size:13px;z-index:5}.drag-overlay mat-icon{font-size:28px;width:28px;height:28px}\n"] }]
        }], propDecorators: { messageSent: [{
                type: Output
            }], messageWithFiles: [{
                type: Output
            }], fileInput: [{
                type: ViewChild,
                args: ['fileInput']
            }] } });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVzc2FnZS1pbnB1dC5jb21wb25lbnQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvbGliL2NvbXBvbmVudHMvbWVzc2FnZS1pbnB1dC9tZXNzYWdlLWlucHV0LmNvbXBvbmVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsU0FBUyxFQUFFLFlBQVksRUFBRSxNQUFNLEVBQUUsU0FBUyxFQUFjLE1BQU0sZUFBZSxDQUFDO0FBQ3ZGLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUMvQyxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sZ0JBQWdCLENBQUM7QUFDN0MsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLHdCQUF3QixDQUFDO0FBQ3ZELE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQzs7Ozs7O0FBd08zRCxNQUFNLE9BQU8scUJBQXFCO0lBQ3RCLFdBQVcsR0FBRyxJQUFJLFlBQVksRUFBVSxDQUFDO0lBQ3pDLGdCQUFnQixHQUFHLElBQUksWUFBWSxFQUFrQixDQUFDO0lBQ3hDLFNBQVMsQ0FBZ0M7SUFFakUsV0FBVyxHQUFHLEVBQUUsQ0FBQztJQUNqQixhQUFhLEdBQVcsRUFBRSxDQUFDO0lBQzNCLFVBQVUsR0FBRyxLQUFLLENBQUM7SUFFbkIsSUFBSSxPQUFPO1FBQ1QsT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksRUFBRSxDQUFDLE1BQU0sR0FBRyxDQUFDLElBQUksSUFBSSxDQUFDLGFBQWEsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDO0lBQzdFLENBQUM7SUFFRCxJQUFJO1FBQ0YsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPO1lBQUUsT0FBTztRQUMxQixNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksRUFBRSxDQUFDO1FBRXJDLElBQUksSUFBSSxDQUFDLGFBQWEsQ0FBQyxNQUFNLEdBQUcsQ0FB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dUJBQUMsV0FBVyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IENvbXBvbmVudCwgRXZlbnRFbWl0dGVyLCBPdXRwdXQsIFZpZXdDaGlsZCwgRWxlbWVudFJlZiB9IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xuaW1wb3J0IHsgQ29tbW9uTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvY29tbW9uJztcbmltcG9ydCB7IEZvcm1zTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvZm9ybXMnO1xuaW1wb3J0IHsgTWF0SWNvbk1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL21hdGVyaWFsL2ljb24nO1xuaW1wb3J0IHsgTWF0QnV0dG9uTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvbWF0ZXJpYWwvYnV0dG9uJztcblxuZXhwb3J0IGludGVyZmFjZSBNZXNzYWdlUGF5bG9hZCB7XG4gIHRleHQ6IHN0cmluZztcbiAgZmlsZXM6IEZpbGVbXTtcbn1cblxuQENvbXBvbmVudCh7XG4gIHNlbGVjdG9yOiAnYXBwLW1lc3NhZ2UtaW5wdXQnLFxuICBzdGFuZGFsb25lOiB0cnVlLFxuICBpbXBvcnRzOiBbQ29tbW9uTW9kdWxlLCBGb3Jtc01vZHVsZSwgTWF0SWNvbk1vZHVsZSwgTWF0QnV0dG9uTW9kdWxlXSxcbiAgdGVtcGxhdGU6IGBcbiAgICA8ZGl2XG4gICAgICBjbGFzcz1cIm1lc3NhZ2UtaW5wdXQtY29udGFpbmVyXCJcbiAgICAgIChkcmFnb3Zlcik9XCJvbkRyYWdPdmVyKCRldmVudClcIlxuICAgICAgKGRyYWdsZWF2ZSk9XCJvbkRyYWdMZWF2ZSgkZXZlbnQpXCJcbiAgICAgIChkcm9wKT1cIm9uRHJvcCgkZXZlbnQpXCJcbiAgICAgIFtjbGFzcy5kcmFnLW92ZXJdPVwiaXNEcmFnT3ZlclwiXG4gICAgPlxuICAgICAgPCEtLSBGaWxlIHByZXZpZXdzIC0tPlxuICAgICAgPGRpdiAqbmdJZj1cInNlbGVjdGVkRmlsZXMubGVuZ3RoID4gMFwiIGNsYXNzPVwiZmlsZS1wcmV2aWV3c1wiPlxuICAgICAgICA8ZGl2ICpuZ0Zvcj1cImxldCBmaWxlIG9mIHNlbGVjdGVkRmlsZXM7IGxldCBpID0gaW5kZXhcIiBjbGFzcz1cImZpbGUtY2hpcFwiPlxuICAgICAgICAgIDxtYXQtaWNvbiBjbGFzcz1cImZpbGUtaWNvblwiPnt7IGdldEZpbGVJY29uKGZpbGUpIH19PC9tYXQtaWNvbj5cbiAgICAgICAgICA8c3BhbiBjbGFzcz1cImZpbGUtbmFtZVwiPnt7IGZpbGUubmFtZSB9fTwvc3Bhbj5cbiAgICAgICAgICA8c3BhbiBjbGFzcz1cImZpbGUtc2l6ZVwiPnt7IGZvcm1hdFNpemUoZmlsZS5zaXplKSB9fTwvc3Bhbj5cbiAgICAgICAgICA8YnV0dG9uIG1hdC1pY29uLWJ1dHRvbiBjbGFzcz1cImZpbGUtcmVtb3ZlXCIgKGNsaWNrKT1cInJlbW92ZUZpbGUoaSlcIj5cbiAgICAgICAgICAgIDxtYXQtaWNvbj5jbG9zZTwvbWF0LWljb24+XG4gICAgICAgICAgPC9idXR0b24+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG5cbiAgICAgIDxkaXYgY2xhc3M9XCJpbnB1dC13cmFwcGVyXCI+XG4gICAgICAgIDxidXR0b24gbWF0LWljb24tYnV0dG9uIGNsYXNzPVwiYXR0YWNoLWJ0blwiIChjbGljayk9XCJmaWxlSW5wdXQuY2xpY2soKVwiIHRpdGxlPVwiQXR0YWNoIGZpbGVzXCI+XG4gICAgICAgICAgPG1hdC1pY29uPmF0dGFjaF9maWxlPC9tYXQtaWNvbj5cbiAgICAgICAgPC9idXR0b24+XG4gICAgICAgIDxpbnB1dFxuICAgICAgICAgICNmaWxlSW5wdXRcbiAgICAgICAgICB0eXBlPVwiZmlsZVwiXG4gICAgICAgICAgbXVsdGlwbGVcbiAgICAgICAgICBzdHlsZT1cImRpc3BsYXk6bm9uZVwiXG4gICAgICAgICAgKGNoYW5nZSk9XCJvbkZpbGVzU2VsZWN0ZWQoJGV2ZW50KVwiXG4gICAgICAgIC8+XG4gICAgICAgIDx0ZXh0YXJlYVxuICAgICAgICAgIFsobmdNb2RlbCldPVwibWVzc2FnZVRleHRcIlxuICAgICAgICAgIChrZXlkb3duLmVudGVyKT1cIm9uRW50ZXIoJGV2ZW50KVwiXG4gICAgICAgICAgcGxhY2Vob2xkZXI9XCJUeXBlIGEgbWVzc2FnZS4uLlwiXG4gICAgICAgICAgcm93cz1cIjFcIlxuICAgICAgICAgIGNsYXNzPVwibWVzc2FnZS10ZXh0YXJlYVwiXG4gICAgICAgID48L3RleHRhcmVhPlxuICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgbWF0LWljb24tYnV0dG9uXG4gICAgICAgICAgY2xhc3M9XCJzZW5kLWJ0blwiXG4gICAgICAgICAgW2Rpc2FibGVkXT1cIiFjYW5TZW5kXCJcbiAgICAgICAgICAoY2xpY2spPVwic2VuZCgpXCJcbiAgICAgICAgPlxuICAgICAgICAgIDxtYXQtaWNvbj5zZW5kPC9tYXQtaWNvbj5cbiAgICAgICAgPC9idXR0b24+XG4gICAgICA8L2Rpdj5cblxuICAgICAgPCEtLSBEcmFnIG92ZXJsYXkgLS0+XG4gICAgICA8ZGl2ICpuZ0lmPVwiaXNEcmFnT3ZlclwiIGNsYXNzPVwiZHJhZy1vdmVybGF5XCI+XG4gICAgICAgIDxtYXQtaWNvbj5jbG91ZF91cGxvYWQ8L21hdC1pY29uPlxuICAgICAgICA8c3Bhbj5Ecm9wIGZpbGVzIGhlcmU8L3NwYW4+XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5cbiAgYCxcbiAgc3R5bGVzOiBbYFxuICAgIC5tZXNzYWdlLWlucHV0LWNvbnRhaW5lciB7XG4gICAgICBwYWRkaW5nOiA4cHggMTJweDtcbiAgICAgIGJvcmRlci10b3A6IDFweCBzb2xpZCByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMTUpO1xuICAgICAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQ7XG4gICAgICBwb3NpdGlvbjogcmVsYXRpdmU7XG4gICAgfVxuXG4gICAgLm1lc3NhZ2UtaW5wdXQtY29udGFpbmVyLmRyYWctb3ZlciB7XG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMSk7XG4gICAgfVxuXG4gICAgLmZpbGUtcHJldmlld3Mge1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGZsZXgtd3JhcDogd3JhcDtcbiAgICAgIGdhcDogNnB4O1xuICAgICAgbWFyZ2luLWJvdHRvbTogOHB4O1xuICAgICAgbWF4LWhlaWdodDogODBweDtcbiAgICAgIG92ZXJmbG93LXk6IGF1dG87XG4gICAgfVxuXG4gICAgLmZpbGUtY2hpcCB7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGdhcDogNHB4O1xuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjE1KTtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDhweDtcbiAgICAgIHBhZGRpbmc6IDRweCA0cHggNHB4IDhweDtcbiAgICAgIG1heC13aWR0aDogMjAwcHg7XG4gICAgfVxuXG4gICAgLmZpbGUtaWNvbiB7XG4gICAgICBmb250LXNpemU6IDE2cHg7XG4gICAgICB3aWR0aDogMTZweDtcbiAgICAgIGhlaWdodDogMTZweDtcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuOCk7XG4gICAgfVxuXG4gICAgLmZpbGUtbmFtZSB7XG4gICAgICBmb250LXNpemU6IDEycHg7XG4gICAgICBjb2xvcjogI2ZmZjtcbiAgICAgIHdoaXRlLXNwYWNlOiBub3dyYXA7XG4gICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgdGV4dC1vdmVyZmxvdzogZWxsaXBzaXM7XG4gICAgICBtYXgtd2lkdGg6IDEwMHB4O1xuICAgIH1cblxuICAgIC5maWxlLXNpemUge1xuICAgICAgZm9udC1zaXplOiAxMHB4O1xuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC41KTtcbiAgICAgIGZsZXgtc2hyaW5rOiAwO1xuICAgIH1cblxuICAgIC5maWxlLXJlbW92ZSB7XG4gICAgICB3aWR0aDogMjBweCAhaW1wb3J0YW50O1xuICAgICAgaGVpZ2h0OiAyMHB4ICFpbXBvcnRhbnQ7XG4gICAgfVxuXG4gICAgLmZpbGUtcmVtb3ZlIG1hdC1pY29uIHtcbiAgICAgIGZvbnQtc2l6ZTogMTRweDtcbiAgICAgIHdpZHRoOiAxNHB4O1xuICAgICAgaGVpZ2h0OiAxNHB4O1xuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC42KTtcbiAgICB9XG5cbiAgICAuaW5wdXQtd3JhcHBlciB7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGdhcDogNHB4O1xuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjEpO1xuICAgICAgYm9yZGVyLXJhZGl1czogMjRweDtcbiAgICAgIHBhZGRpbmc6IDJweCA0cHg7XG4gICAgfVxuXG4gICAgLmF0dGFjaC1idG4sXG4gICAgLnNlbmQtYnRuIHtcbiAgICAgIGZsZXgtc2hyaW5rOiAwO1xuICAgICAgd2lkdGg6IDM2cHg7XG4gICAgICBoZWlnaHQ6IDM2cHg7XG4gICAgICBwYWRkaW5nOiAwICFpbXBvcnRhbnQ7XG4gICAgICBtYXJnaW46IDA7XG4gICAgICBtaW4td2lkdGg6IDM2cHggIWltcG9ydGFudDtcbiAgICAgIGRpc3BsYXk6IGlubGluZS1mbGV4ICFpbXBvcnRhbnQ7XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyICFpbXBvcnRhbnQ7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlciAhaW1wb3J0YW50O1xuICAgICAgbGluZS1oZWlnaHQ6IDAgIWltcG9ydGFudDtcbiAgICB9XG5cbiAgICAuYXR0YWNoLWJ0biBtYXQtaWNvbixcbiAgICAuc2VuZC1idG4gbWF0LWljb24ge1xuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC43KTtcbiAgICAgIGZvbnQtc2l6ZTogMjBweDtcbiAgICAgIHdpZHRoOiAyMHB4O1xuICAgICAgaGVpZ2h0OiAyMHB4O1xuICAgICAgbGluZS1oZWlnaHQ6IDIwcHg7XG4gICAgICBtYXJnaW46IDA7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgIH1cblxuICAgIC5zZW5kLWJ0biBtYXQtaWNvbiB7XG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjkpO1xuICAgIH1cblxuICAgIC5tZXNzYWdlLXRleHRhcmVhIHtcbiAgICAgIGZsZXg6IDE7XG4gICAgICBib3JkZXI6IG5vbmU7XG4gICAgICBvdXRsaW5lOiBub25lO1xuICAgICAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQ7XG4gICAgICByZXNpemU6IG5vbmU7XG4gICAgICBmb250LXNpemU6IDE0cHg7XG4gICAgICBmb250LWZhbWlseTogaW5oZXJpdDtcbiAgICAgIGxpbmUtaGVpZ2h0OiAxLjU7XG4gICAgICBtYXgtaGVpZ2h0OiAxMDBweDtcbiAgICAgIHBhZGRpbmc6IDZweCAwO1xuICAgICAgY29sb3I6ICNmZmY7XG4gICAgfVxuXG4gICAgLm1lc3NhZ2UtdGV4dGFyZWE6OnBsYWNlaG9sZGVyIHtcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNSk7XG4gICAgfVxuXG4gICAgLnNlbmQtYnRuOmRpc2FibGVkIG1hdC1pY29uIHtcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMyk7XG4gICAgfVxuXG4gICAgLyogTURDIG1hdC1pY29uLWJ1dHRvbiBpbm5lciB3cmFwcGVyIG9mdGVuIHNoaWZ0cyBnbHlwaHMgZG93bndhcmQgd2l0aG91dCB0aGlzICovXG4gICAgOmhvc3QgOjpuZy1kZWVwIC5hdHRhY2gtYnRuIC5tYXQtbWRjLWJ1dHRvbi10b3VjaC10YXJnZXQsXG4gICAgOmhvc3QgOjpuZy1kZWVwIC5zZW5kLWJ0biAubWF0LW1kYy1idXR0b24tdG91Y2gtdGFyZ2V0IHtcbiAgICAgIGhlaWdodDogMzZweCAhaW1wb3J0YW50O1xuICAgICAgd2lkdGg6IDM2cHggIWltcG9ydGFudDtcbiAgICB9XG5cbiAgICA6aG9zdCA6Om5nLWRlZXAgLmF0dGFjaC1idG4gLm1kYy1pY29uLWJ1dHRvbl9faWNvbixcbiAgICA6aG9zdCA6Om5nLWRlZXAgLnNlbmQtYnRuIC5tZGMtaWNvbi1idXR0b25fX2ljb24ge1xuICAgICAgZGlzcGxheTogZmxleCAhaW1wb3J0YW50O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlciAhaW1wb3J0YW50O1xuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXIgIWltcG9ydGFudDtcbiAgICAgIG1hcmdpbjogMCAhaW1wb3J0YW50O1xuICAgICAgcGFkZGluZzogMCAhaW1wb3J0YW50O1xuICAgIH1cblxuICAgIC5kcmFnLW92ZXJsYXkge1xuICAgICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgICAgaW5zZXQ6IDA7XG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDMxLCA3NSwgMjE2LCAwLjMpO1xuICAgICAgYm9yZGVyOiAycHggZGFzaGVkIHJnYmEoMjU1LCAyNTUsIDI1NSwgMC41KTtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDEycHg7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgIGdhcDogNHB4O1xuICAgICAgY29sb3I6ICNmZmY7XG4gICAgICBmb250LXNpemU6IDEzcHg7XG4gICAgICB6LWluZGV4OiA1O1xuICAgIH1cblxuICAgIC5kcmFnLW92ZXJsYXkgbWF0LWljb24ge1xuICAgICAgZm9udC1zaXplOiAyOHB4O1xuICAgICAgd2lkdGg6IDI4cHg7XG4gICAgICBoZWlnaHQ6IDI4cHg7XG4gICAgfVxuICBgXSxcbn0pXG5leHBvcnQgY2xhc3MgTWVzc2FnZUlucHV0Q29tcG9uZW50IHtcbiAgQE91dHB1dCgpIG1lc3NhZ2VTZW50ID0gbmV3IEV2ZW50RW1pdHRlcjxzdHJpbmc+KCk7XG4gIEBPdXRwdXQoKSBtZXNzYWdlV2l0aEZpbGVzID0gbmV3IEV2ZW50RW1pdHRlcjxNZXNzYWdlUGF5bG9hZD4oKTtcbiAgQFZpZXdDaGlsZCgnZmlsZUlucHV0JykgZmlsZUlucHV0ITogRWxlbWVudFJlZjxIVE1MSW5wdXRFbGVtZW50PjtcblxuICBtZXNzYWdlVGV4dCA9ICcnO1xuICBzZWxlY3RlZEZpbGVzOiBGaWxlW10gPSBbXTtcbiAgaXNEcmFnT3ZlciA9IGZhbHNlO1xuXG4gIGdldCBjYW5TZW5kKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLm1lc3NhZ2VUZXh0LnRyaW0oKS5sZW5ndGggPiAwIHx8IHRoaXMuc2VsZWN0ZWRGaWxlcy5sZW5ndGggPiAwO1xuICB9XG5cbiAgc2VuZCgpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMuY2FuU2VuZCkgcmV0dXJuO1xuICAgIGNvbnN0IHRleHQgPSB0aGlzLm1lc3NhZ2VUZXh0LnRyaW0oKTtcblxuICAgIGlmICh0aGlzLnNlbGVjdGVkRmlsZXMubGVuZ3RoID4gMCkge1xuICAgICAgdGhpcy5tZXNzYWdlV2l0aEZpbGVzLmVtaXQoeyB0ZXh0LCBmaWxlczogWy4uLnRoaXMuc2VsZWN0ZWRGaWxlc10gfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMubWVzc2FnZVNlbnQuZW1pdCh0ZXh0KTtcbiAgICB9XG5cbiAgICB0aGlzLm1lc3NhZ2VUZXh0ID0gJyc7XG4gICAgdGhpcy5zZWxlY3RlZEZpbGVzID0gW107XG4gICAgaWYgKHRoaXMuZmlsZUlucHV0KSB0aGlzLmZpbGVJbnB1dC5uYXRpdmVFbGVtZW50LnZhbHVlID0gJyc7XG4gIH1cblxuICBvbkVudGVyKGV2ZW50OiBFdmVudCk6IHZvaWQge1xuICAgIGNvbnN0IGtlID0gZXZlbnQgYXMgS2V5Ym9hcmRFdmVudDtcbiAgICBpZiAoIWtlLnNoaWZ0S2V5KSB7XG4gICAgICBrZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgdGhpcy5zZW5kKCk7XG4gICAgfVxuICB9XG5cbiAgb25GaWxlc1NlbGVjdGVkKGV2ZW50OiBFdmVudCk6IHZvaWQge1xuICAgIGNvbnN0IGlucHV0ID0gZXZlbnQudGFyZ2V0IGFzIEhUTUxJbnB1dEVsZW1lbnQ7XG4gICAgaWYgKGlucHV0LmZpbGVzKSB7XG4gICAgICB0aGlzLnNlbGVjdGVkRmlsZXMgPSBbLi4udGhpcy5zZWxlY3RlZEZpbGVzLCAuLi5BcnJheS5mcm9tKGlucHV0LmZpbGVzKV07XG4gICAgfVxuICB9XG5cbiAgcmVtb3ZlRmlsZShpbmRleDogbnVtYmVyKTogdm9pZCB7XG4gICAgdGhpcy5zZWxlY3RlZEZpbGVzLnNwbGljZShpbmRleCwgMSk7XG4gICAgdGhpcy5zZWxlY3RlZEZpbGVzID0gWy4uLnRoaXMuc2VsZWN0ZWRGaWxlc107XG4gIH1cblxuICBvbkRyYWdPdmVyKGV2ZW50OiBEcmFnRXZlbnQpOiB2b2lkIHtcbiAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuICAgIHRoaXMuaXNEcmFnT3ZlciA9IHRydWU7XG4gIH1cblxuICBvbkRyYWdMZWF2ZShldmVudDogRHJhZ0V2ZW50KTogdm9pZCB7XG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICB0aGlzLmlzRHJhZ092ZXIgPSBmYWxzZTtcbiAgfVxuXG4gIG9uRHJvcChldmVudDogRHJhZ0V2ZW50KTogdm9pZCB7XG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICB0aGlzLmlzRHJhZ092ZXIgPSBmYWxzZTtcbiAgICBpZiAoZXZlbnQuZGF0YVRyYW5zZmVyPy5maWxlcykge1xuICAgICAgdGhpcy5zZWxlY3RlZEZpbGVzID0gWy4uLnRoaXMuc2VsZWN0ZWRGaWxlcywgLi4uQXJyYXkuZnJvbShldmVudC5kYXRhVHJhbnNmZXIuZmlsZXMpXTtcbiAgICB9XG4gIH1cblxuICBnZXRGaWxlSWNvbihmaWxlOiBGaWxlKTogc3RyaW5nIHtcbiAgICBjb25zdCB0eXBlID0gZmlsZS50eXBlO1xuICAgIGlmICh0eXBlLnN0YXJ0c1dpdGgoJ2ltYWdlLycpKSByZXR1cm4gJ2ltYWdlJztcbiAgICBpZiAodHlwZS5zdGFydHNXaXRoKCd2aWRlby8nKSkgcmV0dXJuICd2aWRlb2NhbSc7XG4gICAgaWYgKHR5cGUuc3RhcnRzV2l0aCgnYXVkaW8vJykpIHJldHVybiAnYXVkaW90cmFjayc7XG4gICAgaWYgKHR5cGUuaW5jbHVkZXMoJ3BkZicpKSByZXR1cm4gJ3BpY3R1cmVfYXNfcGRmJztcbiAgICBpZiAodHlwZS5pbmNsdWRlcygnc3ByZWFkc2hlZXQnKSB8fCB0eXBlLmluY2x1ZGVzKCdleGNlbCcpKSByZXR1cm4gJ3RhYmxlX2NoYXJ0JztcbiAgICBpZiAodHlwZS5pbmNsdWRlcygnZG9jdW1lbnQnKSB8fCB0eXBlLmluY2x1ZGVzKCd3b3JkJykpIHJldHVybiAnZGVzY3JpcHRpb24nO1xuICAgIHJldHVybiAnaW5zZXJ0X2RyaXZlX2ZpbGUnO1xuICB9XG5cbiAgZm9ybWF0U2l6ZShieXRlczogbnVtYmVyKTogc3RyaW5nIHtcbiAgICBpZiAoYnl0ZXMgPCAxMDI0KSByZXR1cm4gYnl0ZXMgKyAnIEInO1xuICAgIGlmIChieXRlcyA8IDEwMjQgKiAxMDI0KSByZXR1cm4gKGJ5dGVzIC8gMTAyNCkudG9GaXhlZCgwKSArICcgS0InO1xuICAgIHJldHVybiAoYnl0ZXMgLyAoMTAyNCAqIDEwMjQpKS50b0ZpeGVkKDEpICsgJyBNQic7XG4gIH1cbn1cbiJdfQ==