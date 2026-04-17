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
  `, isInline: true, styles: [".message-input-container{padding:8px 12px;border-top:1px solid rgba(255,255,255,.15);background:transparent;position:relative}.message-input-container.drag-over{background:#ffffff1a}.file-previews{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;max-height:80px;overflow-y:auto}.file-chip{display:flex;align-items:center;gap:4px;background:#ffffff26;border-radius:8px;padding:4px 4px 4px 8px;max-width:200px}.file-icon{font-size:16px;width:16px;height:16px;color:#fffc}.file-name{font-size:12px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100px}.file-size{font-size:10px;color:#ffffff80;flex-shrink:0}.file-remove{width:20px!important;height:20px!important}.file-remove mat-icon{font-size:14px;width:14px;height:14px;color:#fff9}.input-wrapper{display:flex;align-items:flex-end;gap:4px;background:#ffffff1a;border-radius:24px;padding:2px 4px}.attach-btn{width:32px;height:32px;flex-shrink:0}.attach-btn mat-icon{color:#ffffffb3;font-size:20px;width:20px;height:20px}.message-textarea{flex:1;border:none;outline:none;background:transparent;resize:none;font-size:14px;font-family:inherit;line-height:1.5;max-height:100px;padding:6px 0;color:#fff}.message-textarea::placeholder{color:#ffffff80}.send-btn{width:32px;height:32px;flex-shrink:0}.send-btn mat-icon{color:#ffffffe6;font-size:20px;width:20px;height:20px}.send-btn:disabled mat-icon{color:#ffffff4d}.drag-overlay{position:absolute;inset:0;background:#1f4bd84d;border:2px dashed rgba(255,255,255,.5);border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;color:#fff;font-size:13px;z-index:5}.drag-overlay mat-icon{font-size:28px;width:28px;height:28px}\n"], dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i1.NgForOf, selector: "[ngFor][ngForOf]", inputs: ["ngForOf", "ngForTrackBy", "ngForTemplate"] }, { kind: "directive", type: i1.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "ngmodule", type: FormsModule }, { kind: "directive", type: i2.DefaultValueAccessor, selector: "input:not([type=checkbox])[formControlName],textarea[formControlName],input:not([type=checkbox])[formControl],textarea[formControl],input:not([type=checkbox])[ngModel],textarea[ngModel],[ngDefaultControl]" }, { kind: "directive", type: i2.NgControlStatus, selector: "[formControlName],[ngModel],[formControl]" }, { kind: "directive", type: i2.NgModel, selector: "[ngModel]:not([formControlName]):not([formControl])", inputs: ["name", "disabled", "ngModel", "ngModelOptions"], outputs: ["ngModelChange"], exportAs: ["ngModel"] }, { kind: "ngmodule", type: MatIconModule }, { kind: "component", type: i3.MatIcon, selector: "mat-icon", inputs: ["color", "inline", "svgIcon", "fontSet", "fontIcon"], exportAs: ["matIcon"] }, { kind: "ngmodule", type: MatButtonModule }, { kind: "component", type: i4.MatIconButton, selector: "button[mat-icon-button]", exportAs: ["matButton"] }] });
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
  `, styles: [".message-input-container{padding:8px 12px;border-top:1px solid rgba(255,255,255,.15);background:transparent;position:relative}.message-input-container.drag-over{background:#ffffff1a}.file-previews{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;max-height:80px;overflow-y:auto}.file-chip{display:flex;align-items:center;gap:4px;background:#ffffff26;border-radius:8px;padding:4px 4px 4px 8px;max-width:200px}.file-icon{font-size:16px;width:16px;height:16px;color:#fffc}.file-name{font-size:12px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100px}.file-size{font-size:10px;color:#ffffff80;flex-shrink:0}.file-remove{width:20px!important;height:20px!important}.file-remove mat-icon{font-size:14px;width:14px;height:14px;color:#fff9}.input-wrapper{display:flex;align-items:flex-end;gap:4px;background:#ffffff1a;border-radius:24px;padding:2px 4px}.attach-btn{width:32px;height:32px;flex-shrink:0}.attach-btn mat-icon{color:#ffffffb3;font-size:20px;width:20px;height:20px}.message-textarea{flex:1;border:none;outline:none;background:transparent;resize:none;font-size:14px;font-family:inherit;line-height:1.5;max-height:100px;padding:6px 0;color:#fff}.message-textarea::placeholder{color:#ffffff80}.send-btn{width:32px;height:32px;flex-shrink:0}.send-btn mat-icon{color:#ffffffe6;font-size:20px;width:20px;height:20px}.send-btn:disabled mat-icon{color:#ffffff4d}.drag-overlay{position:absolute;inset:0;background:#1f4bd84d;border:2px dashed rgba(255,255,255,.5);border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;color:#fff;font-size:13px;z-index:5}.drag-overlay mat-icon{font-size:28px;width:28px;height:28px}\n"] }]
        }], propDecorators: { messageSent: [{
                type: Output
            }], messageWithFiles: [{
                type: Output
            }], fileInput: [{
                type: ViewChild,
                args: ['fileInput']
            }] } });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVzc2FnZS1pbnB1dC5jb21wb25lbnQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvbGliL2NvbXBvbmVudHMvbWVzc2FnZS1pbnB1dC9tZXNzYWdlLWlucHV0LmNvbXBvbmVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsU0FBUyxFQUFFLFlBQVksRUFBRSxNQUFNLEVBQUUsU0FBUyxFQUFjLE1BQU0sZUFBZSxDQUFDO0FBQ3ZGLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUMvQyxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sZ0JBQWdCLENBQUM7QUFDN0MsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLHdCQUF3QixDQUFDO0FBQ3ZELE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQzs7Ozs7O0FBbU4zRCxNQUFNLE9BQU8scUJBQXFCO0lBQ3RCLFdBQVcsR0FBRyxJQUFJLFlBQVksRUFBVSxDQUFDO0lBQ3pDLGdCQUFnQixHQUFHLElBQUksWUFBWSxFQUFrQixDQUFDO0lBQ3hDLFNBQVMsQ0FBZ0M7SUFFakUsV0FBVyxHQUFHLEVBQUUsQ0FBQztJQUNqQixhQUFhLEdBQVcsRUFBRSxDQUFDO0lBQzNCLFVBQVUsR0FBRyxLQUFLLENBQUM7SUFFbkIsSUFBSSxPQUFPO1FBQ1QsT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksRUFBRSxDQUFDLE1BQU0sR0FBRyxDQUFDLElBQUksSUFBSSxDQUFDLGFBQWEsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDO0lBQzdFLENBQUM7SUFFRCxJQUFJO1FBQ0YsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPO1lBQUUsT0FBTztRQUMxQixNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksRUFBRSxDQUFDO1FBRXJDLElBQUksSUFBSSxDQUFDLGFBQWEsQ0FBQyxNQUFNLEdBQUcsQ0FB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dUJBQUMsV0FBVyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IENvbXBvbmVudCwgRXZlbnRFbWl0dGVyLCBPdXRwdXQsIFZpZXdDaGlsZCwgRWxlbWVudFJlZiB9IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xuaW1wb3J0IHsgQ29tbW9uTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvY29tbW9uJztcbmltcG9ydCB7IEZvcm1zTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvZm9ybXMnO1xuaW1wb3J0IHsgTWF0SWNvbk1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL21hdGVyaWFsL2ljb24nO1xuaW1wb3J0IHsgTWF0QnV0dG9uTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvbWF0ZXJpYWwvYnV0dG9uJztcblxuZXhwb3J0IGludGVyZmFjZSBNZXNzYWdlUGF5bG9hZCB7XG4gIHRleHQ6IHN0cmluZztcbiAgZmlsZXM6IEZpbGVbXTtcbn1cblxuQENvbXBvbmVudCh7XG4gIHNlbGVjdG9yOiAnYXBwLW1lc3NhZ2UtaW5wdXQnLFxuICBzdGFuZGFsb25lOiB0cnVlLFxuICBpbXBvcnRzOiBbQ29tbW9uTW9kdWxlLCBGb3Jtc01vZHVsZSwgTWF0SWNvbk1vZHVsZSwgTWF0QnV0dG9uTW9kdWxlXSxcbiAgdGVtcGxhdGU6IGBcbiAgICA8ZGl2XG4gICAgICBjbGFzcz1cIm1lc3NhZ2UtaW5wdXQtY29udGFpbmVyXCJcbiAgICAgIChkcmFnb3Zlcik9XCJvbkRyYWdPdmVyKCRldmVudClcIlxuICAgICAgKGRyYWdsZWF2ZSk9XCJvbkRyYWdMZWF2ZSgkZXZlbnQpXCJcbiAgICAgIChkcm9wKT1cIm9uRHJvcCgkZXZlbnQpXCJcbiAgICAgIFtjbGFzcy5kcmFnLW92ZXJdPVwiaXNEcmFnT3ZlclwiXG4gICAgPlxuICAgICAgPCEtLSBGaWxlIHByZXZpZXdzIC0tPlxuICAgICAgPGRpdiAqbmdJZj1cInNlbGVjdGVkRmlsZXMubGVuZ3RoID4gMFwiIGNsYXNzPVwiZmlsZS1wcmV2aWV3c1wiPlxuICAgICAgICA8ZGl2ICpuZ0Zvcj1cImxldCBmaWxlIG9mIHNlbGVjdGVkRmlsZXM7IGxldCBpID0gaW5kZXhcIiBjbGFzcz1cImZpbGUtY2hpcFwiPlxuICAgICAgICAgIDxtYXQtaWNvbiBjbGFzcz1cImZpbGUtaWNvblwiPnt7IGdldEZpbGVJY29uKGZpbGUpIH19PC9tYXQtaWNvbj5cbiAgICAgICAgICA8c3BhbiBjbGFzcz1cImZpbGUtbmFtZVwiPnt7IGZpbGUubmFtZSB9fTwvc3Bhbj5cbiAgICAgICAgICA8c3BhbiBjbGFzcz1cImZpbGUtc2l6ZVwiPnt7IGZvcm1hdFNpemUoZmlsZS5zaXplKSB9fTwvc3Bhbj5cbiAgICAgICAgICA8YnV0dG9uIG1hdC1pY29uLWJ1dHRvbiBjbGFzcz1cImZpbGUtcmVtb3ZlXCIgKGNsaWNrKT1cInJlbW92ZUZpbGUoaSlcIj5cbiAgICAgICAgICAgIDxtYXQtaWNvbj5jbG9zZTwvbWF0LWljb24+XG4gICAgICAgICAgPC9idXR0b24+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG5cbiAgICAgIDxkaXYgY2xhc3M9XCJpbnB1dC13cmFwcGVyXCI+XG4gICAgICAgIDxidXR0b24gbWF0LWljb24tYnV0dG9uIGNsYXNzPVwiYXR0YWNoLWJ0blwiIChjbGljayk9XCJmaWxlSW5wdXQuY2xpY2soKVwiIHRpdGxlPVwiQXR0YWNoIGZpbGVzXCI+XG4gICAgICAgICAgPG1hdC1pY29uPmF0dGFjaF9maWxlPC9tYXQtaWNvbj5cbiAgICAgICAgPC9idXR0b24+XG4gICAgICAgIDxpbnB1dFxuICAgICAgICAgICNmaWxlSW5wdXRcbiAgICAgICAgICB0eXBlPVwiZmlsZVwiXG4gICAgICAgICAgbXVsdGlwbGVcbiAgICAgICAgICBzdHlsZT1cImRpc3BsYXk6bm9uZVwiXG4gICAgICAgICAgKGNoYW5nZSk9XCJvbkZpbGVzU2VsZWN0ZWQoJGV2ZW50KVwiXG4gICAgICAgIC8+XG4gICAgICAgIDx0ZXh0YXJlYVxuICAgICAgICAgIFsobmdNb2RlbCldPVwibWVzc2FnZVRleHRcIlxuICAgICAgICAgIChrZXlkb3duLmVudGVyKT1cIm9uRW50ZXIoJGV2ZW50KVwiXG4gICAgICAgICAgcGxhY2Vob2xkZXI9XCJUeXBlIGEgbWVzc2FnZS4uLlwiXG4gICAgICAgICAgcm93cz1cIjFcIlxuICAgICAgICAgIGNsYXNzPVwibWVzc2FnZS10ZXh0YXJlYVwiXG4gICAgICAgID48L3RleHRhcmVhPlxuICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgbWF0LWljb24tYnV0dG9uXG4gICAgICAgICAgY2xhc3M9XCJzZW5kLWJ0blwiXG4gICAgICAgICAgW2Rpc2FibGVkXT1cIiFjYW5TZW5kXCJcbiAgICAgICAgICAoY2xpY2spPVwic2VuZCgpXCJcbiAgICAgICAgPlxuICAgICAgICAgIDxtYXQtaWNvbj5zZW5kPC9tYXQtaWNvbj5cbiAgICAgICAgPC9idXR0b24+XG4gICAgICA8L2Rpdj5cblxuICAgICAgPCEtLSBEcmFnIG92ZXJsYXkgLS0+XG4gICAgICA8ZGl2ICpuZ0lmPVwiaXNEcmFnT3ZlclwiIGNsYXNzPVwiZHJhZy1vdmVybGF5XCI+XG4gICAgICAgIDxtYXQtaWNvbj5jbG91ZF91cGxvYWQ8L21hdC1pY29uPlxuICAgICAgICA8c3Bhbj5Ecm9wIGZpbGVzIGhlcmU8L3NwYW4+XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5cbiAgYCxcbiAgc3R5bGVzOiBbYFxuICAgIC5tZXNzYWdlLWlucHV0LWNvbnRhaW5lciB7XG4gICAgICBwYWRkaW5nOiA4cHggMTJweDtcbiAgICAgIGJvcmRlci10b3A6IDFweCBzb2xpZCByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMTUpO1xuICAgICAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQ7XG4gICAgICBwb3NpdGlvbjogcmVsYXRpdmU7XG4gICAgfVxuXG4gICAgLm1lc3NhZ2UtaW5wdXQtY29udGFpbmVyLmRyYWctb3ZlciB7XG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMSk7XG4gICAgfVxuXG4gICAgLmZpbGUtcHJldmlld3Mge1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGZsZXgtd3JhcDogd3JhcDtcbiAgICAgIGdhcDogNnB4O1xuICAgICAgbWFyZ2luLWJvdHRvbTogOHB4O1xuICAgICAgbWF4LWhlaWdodDogODBweDtcbiAgICAgIG92ZXJmbG93LXk6IGF1dG87XG4gICAgfVxuXG4gICAgLmZpbGUtY2hpcCB7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGdhcDogNHB4O1xuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjE1KTtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDhweDtcbiAgICAgIHBhZGRpbmc6IDRweCA0cHggNHB4IDhweDtcbiAgICAgIG1heC13aWR0aDogMjAwcHg7XG4gICAgfVxuXG4gICAgLmZpbGUtaWNvbiB7XG4gICAgICBmb250LXNpemU6IDE2cHg7XG4gICAgICB3aWR0aDogMTZweDtcbiAgICAgIGhlaWdodDogMTZweDtcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuOCk7XG4gICAgfVxuXG4gICAgLmZpbGUtbmFtZSB7XG4gICAgICBmb250LXNpemU6IDEycHg7XG4gICAgICBjb2xvcjogI2ZmZjtcbiAgICAgIHdoaXRlLXNwYWNlOiBub3dyYXA7XG4gICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgdGV4dC1vdmVyZmxvdzogZWxsaXBzaXM7XG4gICAgICBtYXgtd2lkdGg6IDEwMHB4O1xuICAgIH1cblxuICAgIC5maWxlLXNpemUge1xuICAgICAgZm9udC1zaXplOiAxMHB4O1xuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC41KTtcbiAgICAgIGZsZXgtc2hyaW5rOiAwO1xuICAgIH1cblxuICAgIC5maWxlLXJlbW92ZSB7XG4gICAgICB3aWR0aDogMjBweCAhaW1wb3J0YW50O1xuICAgICAgaGVpZ2h0OiAyMHB4ICFpbXBvcnRhbnQ7XG4gICAgfVxuXG4gICAgLmZpbGUtcmVtb3ZlIG1hdC1pY29uIHtcbiAgICAgIGZvbnQtc2l6ZTogMTRweDtcbiAgICAgIHdpZHRoOiAxNHB4O1xuICAgICAgaGVpZ2h0OiAxNHB4O1xuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC42KTtcbiAgICB9XG5cbiAgICAuaW5wdXQtd3JhcHBlciB7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGZsZXgtZW5kO1xuICAgICAgZ2FwOiA0cHg7XG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMSk7XG4gICAgICBib3JkZXItcmFkaXVzOiAyNHB4O1xuICAgICAgcGFkZGluZzogMnB4IDRweCAycHggNHB4O1xuICAgIH1cblxuICAgIC5hdHRhY2gtYnRuIHtcbiAgICAgIHdpZHRoOiAzMnB4O1xuICAgICAgaGVpZ2h0OiAzMnB4O1xuICAgICAgZmxleC1zaHJpbms6IDA7XG4gICAgfVxuXG4gICAgLmF0dGFjaC1idG4gbWF0LWljb24ge1xuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC43KTtcbiAgICAgIGZvbnQtc2l6ZTogMjBweDtcbiAgICAgIHdpZHRoOiAyMHB4O1xuICAgICAgaGVpZ2h0OiAyMHB4O1xuICAgIH1cblxuICAgIC5tZXNzYWdlLXRleHRhcmVhIHtcbiAgICAgIGZsZXg6IDE7XG4gICAgICBib3JkZXI6IG5vbmU7XG4gICAgICBvdXRsaW5lOiBub25lO1xuICAgICAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQ7XG4gICAgICByZXNpemU6IG5vbmU7XG4gICAgICBmb250LXNpemU6IDE0cHg7XG4gICAgICBmb250LWZhbWlseTogaW5oZXJpdDtcbiAgICAgIGxpbmUtaGVpZ2h0OiAxLjU7XG4gICAgICBtYXgtaGVpZ2h0OiAxMDBweDtcbiAgICAgIHBhZGRpbmc6IDZweCAwO1xuICAgICAgY29sb3I6ICNmZmY7XG4gICAgfVxuXG4gICAgLm1lc3NhZ2UtdGV4dGFyZWE6OnBsYWNlaG9sZGVyIHtcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNSk7XG4gICAgfVxuXG4gICAgLnNlbmQtYnRuIHtcbiAgICAgIHdpZHRoOiAzMnB4O1xuICAgICAgaGVpZ2h0OiAzMnB4O1xuICAgICAgZmxleC1zaHJpbms6IDA7XG4gICAgfVxuXG4gICAgLnNlbmQtYnRuIG1hdC1pY29uIHtcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuOSk7XG4gICAgICBmb250LXNpemU6IDIwcHg7XG4gICAgICB3aWR0aDogMjBweDtcbiAgICAgIGhlaWdodDogMjBweDtcbiAgICB9XG5cbiAgICAuc2VuZC1idG46ZGlzYWJsZWQgbWF0LWljb24ge1xuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4zKTtcbiAgICB9XG5cbiAgICAuZHJhZy1vdmVybGF5IHtcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgIGluc2V0OiAwO1xuICAgICAgYmFja2dyb3VuZDogcmdiYSgzMSwgNzUsIDIxNiwgMC4zKTtcbiAgICAgIGJvcmRlcjogMnB4IGRhc2hlZCByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNSk7XG4gICAgICBib3JkZXItcmFkaXVzOiAxMnB4O1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgICBnYXA6IDRweDtcbiAgICAgIGNvbG9yOiAjZmZmO1xuICAgICAgZm9udC1zaXplOiAxM3B4O1xuICAgICAgei1pbmRleDogNTtcbiAgICB9XG5cbiAgICAuZHJhZy1vdmVybGF5IG1hdC1pY29uIHtcbiAgICAgIGZvbnQtc2l6ZTogMjhweDtcbiAgICAgIHdpZHRoOiAyOHB4O1xuICAgICAgaGVpZ2h0OiAyOHB4O1xuICAgIH1cbiAgYF0sXG59KVxuZXhwb3J0IGNsYXNzIE1lc3NhZ2VJbnB1dENvbXBvbmVudCB7XG4gIEBPdXRwdXQoKSBtZXNzYWdlU2VudCA9IG5ldyBFdmVudEVtaXR0ZXI8c3RyaW5nPigpO1xuICBAT3V0cHV0KCkgbWVzc2FnZVdpdGhGaWxlcyA9IG5ldyBFdmVudEVtaXR0ZXI8TWVzc2FnZVBheWxvYWQ+KCk7XG4gIEBWaWV3Q2hpbGQoJ2ZpbGVJbnB1dCcpIGZpbGVJbnB1dCE6IEVsZW1lbnRSZWY8SFRNTElucHV0RWxlbWVudD47XG5cbiAgbWVzc2FnZVRleHQgPSAnJztcbiAgc2VsZWN0ZWRGaWxlczogRmlsZVtdID0gW107XG4gIGlzRHJhZ092ZXIgPSBmYWxzZTtcblxuICBnZXQgY2FuU2VuZCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy5tZXNzYWdlVGV4dC50cmltKCkubGVuZ3RoID4gMCB8fCB0aGlzLnNlbGVjdGVkRmlsZXMubGVuZ3RoID4gMDtcbiAgfVxuXG4gIHNlbmQoKTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLmNhblNlbmQpIHJldHVybjtcbiAgICBjb25zdCB0ZXh0ID0gdGhpcy5tZXNzYWdlVGV4dC50cmltKCk7XG5cbiAgICBpZiAodGhpcy5zZWxlY3RlZEZpbGVzLmxlbmd0aCA+IDApIHtcbiAgICAgIHRoaXMubWVzc2FnZVdpdGhGaWxlcy5lbWl0KHsgdGV4dCwgZmlsZXM6IFsuLi50aGlzLnNlbGVjdGVkRmlsZXNdIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLm1lc3NhZ2VTZW50LmVtaXQodGV4dCk7XG4gICAgfVxuXG4gICAgdGhpcy5tZXNzYWdlVGV4dCA9ICcnO1xuICAgIHRoaXMuc2VsZWN0ZWRGaWxlcyA9IFtdO1xuICAgIGlmICh0aGlzLmZpbGVJbnB1dCkgdGhpcy5maWxlSW5wdXQubmF0aXZlRWxlbWVudC52YWx1ZSA9ICcnO1xuICB9XG5cbiAgb25FbnRlcihldmVudDogRXZlbnQpOiB2b2lkIHtcbiAgICBjb25zdCBrZSA9IGV2ZW50IGFzIEtleWJvYXJkRXZlbnQ7XG4gICAgaWYgKCFrZS5zaGlmdEtleSkge1xuICAgICAga2UucHJldmVudERlZmF1bHQoKTtcbiAgICAgIHRoaXMuc2VuZCgpO1xuICAgIH1cbiAgfVxuXG4gIG9uRmlsZXNTZWxlY3RlZChldmVudDogRXZlbnQpOiB2b2lkIHtcbiAgICBjb25zdCBpbnB1dCA9IGV2ZW50LnRhcmdldCBhcyBIVE1MSW5wdXRFbGVtZW50O1xuICAgIGlmIChpbnB1dC5maWxlcykge1xuICAgICAgdGhpcy5zZWxlY3RlZEZpbGVzID0gWy4uLnRoaXMuc2VsZWN0ZWRGaWxlcywgLi4uQXJyYXkuZnJvbShpbnB1dC5maWxlcyldO1xuICAgIH1cbiAgfVxuXG4gIHJlbW92ZUZpbGUoaW5kZXg6IG51bWJlcik6IHZvaWQge1xuICAgIHRoaXMuc2VsZWN0ZWRGaWxlcy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgIHRoaXMuc2VsZWN0ZWRGaWxlcyA9IFsuLi50aGlzLnNlbGVjdGVkRmlsZXNdO1xuICB9XG5cbiAgb25EcmFnT3ZlcihldmVudDogRHJhZ0V2ZW50KTogdm9pZCB7XG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICB0aGlzLmlzRHJhZ092ZXIgPSB0cnVlO1xuICB9XG5cbiAgb25EcmFnTGVhdmUoZXZlbnQ6IERyYWdFdmVudCk6IHZvaWQge1xuICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgdGhpcy5pc0RyYWdPdmVyID0gZmFsc2U7XG4gIH1cblxuICBvbkRyb3AoZXZlbnQ6IERyYWdFdmVudCk6IHZvaWQge1xuICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgdGhpcy5pc0RyYWdPdmVyID0gZmFsc2U7XG4gICAgaWYgKGV2ZW50LmRhdGFUcmFuc2Zlcj8uZmlsZXMpIHtcbiAgICAgIHRoaXMuc2VsZWN0ZWRGaWxlcyA9IFsuLi50aGlzLnNlbGVjdGVkRmlsZXMsIC4uLkFycmF5LmZyb20oZXZlbnQuZGF0YVRyYW5zZmVyLmZpbGVzKV07XG4gICAgfVxuICB9XG5cbiAgZ2V0RmlsZUljb24oZmlsZTogRmlsZSk6IHN0cmluZyB7XG4gICAgY29uc3QgdHlwZSA9IGZpbGUudHlwZTtcbiAgICBpZiAodHlwZS5zdGFydHNXaXRoKCdpbWFnZS8nKSkgcmV0dXJuICdpbWFnZSc7XG4gICAgaWYgKHR5cGUuc3RhcnRzV2l0aCgndmlkZW8vJykpIHJldHVybiAndmlkZW9jYW0nO1xuICAgIGlmICh0eXBlLnN0YXJ0c1dpdGgoJ2F1ZGlvLycpKSByZXR1cm4gJ2F1ZGlvdHJhY2snO1xuICAgIGlmICh0eXBlLmluY2x1ZGVzKCdwZGYnKSkgcmV0dXJuICdwaWN0dXJlX2FzX3BkZic7XG4gICAgaWYgKHR5cGUuaW5jbHVkZXMoJ3NwcmVhZHNoZWV0JykgfHwgdHlwZS5pbmNsdWRlcygnZXhjZWwnKSkgcmV0dXJuICd0YWJsZV9jaGFydCc7XG4gICAgaWYgKHR5cGUuaW5jbHVkZXMoJ2RvY3VtZW50JykgfHwgdHlwZS5pbmNsdWRlcygnd29yZCcpKSByZXR1cm4gJ2Rlc2NyaXB0aW9uJztcbiAgICByZXR1cm4gJ2luc2VydF9kcml2ZV9maWxlJztcbiAgfVxuXG4gIGZvcm1hdFNpemUoYnl0ZXM6IG51bWJlcik6IHN0cmluZyB7XG4gICAgaWYgKGJ5dGVzIDwgMTAyNCkgcmV0dXJuIGJ5dGVzICsgJyBCJztcbiAgICBpZiAoYnl0ZXMgPCAxMDI0ICogMTAyNCkgcmV0dXJuIChieXRlcyAvIDEwMjQpLnRvRml4ZWQoMCkgKyAnIEtCJztcbiAgICByZXR1cm4gKGJ5dGVzIC8gKDEwMjQgKiAxMDI0KSkudG9GaXhlZCgxKSArICcgTUInO1xuICB9XG59XG4iXX0=