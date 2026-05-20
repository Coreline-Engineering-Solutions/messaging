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
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "17.3.12", type: MessageInputComponent, isStandalone: true, selector: "app-message-input", outputs: { messageSent: "messageSent", messageWithFiles: "messageWithFiles" }, viewQueries: [{ propertyName: "fileInput", first: true, predicate: ["fileInput"], descendants: true }], ngImport: i0, template: `
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
  `, isInline: true, styles: [".message-input-container{padding:8px 12px;border-top:1px solid rgba(255,255,255,.15);background:transparent;position:relative}.file-previews{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;max-height:80px;overflow-y:auto}.file-chip{display:flex;align-items:center;gap:4px;background:#ffffff26;border-radius:8px;padding:4px 4px 4px 8px;max-width:200px}.file-icon{font-size:16px;width:16px;height:16px;color:#fffc}.file-name{font-size:12px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100px}.file-size{font-size:10px;color:#ffffff80;flex-shrink:0}.file-remove{width:20px!important;height:20px!important}.file-remove mat-icon{font-size:14px;width:14px;height:14px;color:#fff9}.input-wrapper{display:flex;align-items:center;gap:4px;background:#ffffff1a;border-radius:24px;padding:2px 4px}.attach-btn,.send-btn{flex-shrink:0;width:36px;height:36px;padding:0!important;margin:0;min-width:36px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;line-height:0!important}.attach-btn mat-icon,.send-btn mat-icon{color:#ffffffb3;font-size:20px;width:20px;height:20px;line-height:20px;margin:0;display:flex;align-items:center;justify-content:center}.send-btn mat-icon{color:#ffffffe6}.message-textarea{flex:1;border:none;outline:none;background:transparent;resize:none;font-size:14px;font-family:inherit;line-height:1.5;max-height:100px;padding:6px 0;color:#fff}.message-textarea::placeholder{color:#ffffff80}.send-btn:disabled mat-icon{color:#ffffff4d}:host ::ng-deep .attach-btn .mat-mdc-button-touch-target,:host ::ng-deep .send-btn .mat-mdc-button-touch-target{height:36px!important;width:36px!important}:host ::ng-deep .attach-btn .mdc-icon-button__icon,:host ::ng-deep .send-btn .mdc-icon-button__icon{display:flex!important;align-items:center!important;justify-content:center!important;margin:0!important;padding:0!important}\n"], dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i1.NgForOf, selector: "[ngFor][ngForOf]", inputs: ["ngForOf", "ngForTrackBy", "ngForTemplate"] }, { kind: "directive", type: i1.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "ngmodule", type: FormsModule }, { kind: "directive", type: i2.DefaultValueAccessor, selector: "input:not([type=checkbox])[formControlName],textarea[formControlName],input:not([type=checkbox])[formControl],textarea[formControl],input:not([type=checkbox])[ngModel],textarea[ngModel],[ngDefaultControl]" }, { kind: "directive", type: i2.NgControlStatus, selector: "[formControlName],[ngModel],[formControl]" }, { kind: "directive", type: i2.NgModel, selector: "[ngModel]:not([formControlName]):not([formControl])", inputs: ["name", "disabled", "ngModel", "ngModelOptions"], outputs: ["ngModelChange"], exportAs: ["ngModel"] }, { kind: "ngmodule", type: MatIconModule }, { kind: "component", type: i3.MatIcon, selector: "mat-icon", inputs: ["color", "inline", "svgIcon", "fontSet", "fontIcon"], exportAs: ["matIcon"] }, { kind: "ngmodule", type: MatButtonModule }, { kind: "component", type: i4.MatIconButton, selector: "button[mat-icon-button]", exportAs: ["matButton"] }] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: MessageInputComponent, decorators: [{
            type: Component,
            args: [{ selector: 'app-message-input', standalone: true, imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule], template: `
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
  `, styles: [".message-input-container{padding:8px 12px;border-top:1px solid rgba(255,255,255,.15);background:transparent;position:relative}.file-previews{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;max-height:80px;overflow-y:auto}.file-chip{display:flex;align-items:center;gap:4px;background:#ffffff26;border-radius:8px;padding:4px 4px 4px 8px;max-width:200px}.file-icon{font-size:16px;width:16px;height:16px;color:#fffc}.file-name{font-size:12px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100px}.file-size{font-size:10px;color:#ffffff80;flex-shrink:0}.file-remove{width:20px!important;height:20px!important}.file-remove mat-icon{font-size:14px;width:14px;height:14px;color:#fff9}.input-wrapper{display:flex;align-items:center;gap:4px;background:#ffffff1a;border-radius:24px;padding:2px 4px}.attach-btn,.send-btn{flex-shrink:0;width:36px;height:36px;padding:0!important;margin:0;min-width:36px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;line-height:0!important}.attach-btn mat-icon,.send-btn mat-icon{color:#ffffffb3;font-size:20px;width:20px;height:20px;line-height:20px;margin:0;display:flex;align-items:center;justify-content:center}.send-btn mat-icon{color:#ffffffe6}.message-textarea{flex:1;border:none;outline:none;background:transparent;resize:none;font-size:14px;font-family:inherit;line-height:1.5;max-height:100px;padding:6px 0;color:#fff}.message-textarea::placeholder{color:#ffffff80}.send-btn:disabled mat-icon{color:#ffffff4d}:host ::ng-deep .attach-btn .mat-mdc-button-touch-target,:host ::ng-deep .send-btn .mat-mdc-button-touch-target{height:36px!important;width:36px!important}:host ::ng-deep .attach-btn .mdc-icon-button__icon,:host ::ng-deep .send-btn .mdc-icon-button__icon{display:flex!important;align-items:center!important;justify-content:center!important;margin:0!important;padding:0!important}\n"] }]
        }], propDecorators: { messageSent: [{
                type: Output
            }], messageWithFiles: [{
                type: Output
            }], fileInput: [{
                type: ViewChild,
                args: ['fileInput']
            }] } });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVzc2FnZS1pbnB1dC5jb21wb25lbnQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvbGliL2NvbXBvbmVudHMvbWVzc2FnZS1pbnB1dC9tZXNzYWdlLWlucHV0LmNvbXBvbmVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsU0FBUyxFQUFFLFlBQVksRUFBRSxNQUFNLEVBQUUsU0FBUyxFQUFjLE1BQU0sZUFBZSxDQUFDO0FBQ3ZGLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUMvQyxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sZ0JBQWdCLENBQUM7QUFDN0MsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLHdCQUF3QixDQUFDO0FBQ3ZELE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQzs7Ozs7O0FBc00zRCxNQUFNLE9BQU8scUJBQXFCO0lBQ3RCLFdBQVcsR0FBRyxJQUFJLFlBQVksRUFBVSxDQUFDO0lBQ3pDLGdCQUFnQixHQUFHLElBQUksWUFBWSxFQUFrQixDQUFDO0lBQ3hDLFNBQVMsQ0FBZ0M7SUFFakUsV0FBVyxHQUFHLEVBQUUsQ0FBQztJQUNqQixhQUFhLEdBQVcsRUFBRSxDQUFDO0lBRTNCLElBQUksT0FBTztRQUNULE9BQU8sSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxJQUFJLElBQUksQ0FBQyxhQUFhLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQztJQUM3RSxDQUFDO0lBRUQsSUFBSTtRQUNGLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTztZQUFFLE9BQU87UUFDMUIsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUVyQyxJQUFJLElBQUksQ0FBQyxhQUFhLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDO1lBQ2xDLElBQUksQ0FB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LENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQztJQUNwRCxDQUFDO3dHQW5FVSxxQkFBcUI7NEZBQXJCLHFCQUFxQixvUUEzTHRCOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7R0E2Q1QsazhEQTlDUyxZQUFZLCtQQUFFLFdBQVcsOG1CQUFFLGFBQWEsbUxBQUUsZUFBZTs7NEZBNEx4RCxxQkFBcUI7a0JBL0xqQyxTQUFTOytCQUNFLG1CQUFtQixjQUNqQixJQUFJLFdBQ1AsQ0FBQyxZQUFZLEVBQUUsV0FBVyxFQUFFLGFBQWEsRUFBRSxlQUFlLENBQUMsWUFDMUQ7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQTZDVDs4QkErSVMsV0FBVztzQkFBcEIsTUFBTTtnQkFDRyxnQkFBZ0I7c0JBQXpCLE1BQU07Z0JBQ2lCLFNBQVM7c0JBQWhDLFNBQVM7dUJBQUMsV0FBVyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IENvbXBvbmVudCwgRXZlbnRFbWl0dGVyLCBPdXRwdXQsIFZpZXdDaGlsZCwgRWxlbWVudFJlZiB9IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xuaW1wb3J0IHsgQ29tbW9uTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvY29tbW9uJztcbmltcG9ydCB7IEZvcm1zTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvZm9ybXMnO1xuaW1wb3J0IHsgTWF0SWNvbk1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL21hdGVyaWFsL2ljb24nO1xuaW1wb3J0IHsgTWF0QnV0dG9uTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvbWF0ZXJpYWwvYnV0dG9uJztcblxuZXhwb3J0IGludGVyZmFjZSBNZXNzYWdlUGF5bG9hZCB7XG4gIHRleHQ6IHN0cmluZztcbiAgZmlsZXM6IEZpbGVbXTtcbn1cblxuQENvbXBvbmVudCh7XG4gIHNlbGVjdG9yOiAnYXBwLW1lc3NhZ2UtaW5wdXQnLFxuICBzdGFuZGFsb25lOiB0cnVlLFxuICBpbXBvcnRzOiBbQ29tbW9uTW9kdWxlLCBGb3Jtc01vZHVsZSwgTWF0SWNvbk1vZHVsZSwgTWF0QnV0dG9uTW9kdWxlXSxcbiAgdGVtcGxhdGU6IGBcbiAgICA8ZGl2XG4gICAgICBjbGFzcz1cIm1lc3NhZ2UtaW5wdXQtY29udGFpbmVyXCJcbiAgICA+XG4gICAgICA8IS0tIEZpbGUgcHJldmlld3MgLS0+XG4gICAgICA8ZGl2ICpuZ0lmPVwic2VsZWN0ZWRGaWxlcy5sZW5ndGggPiAwXCIgY2xhc3M9XCJmaWxlLXByZXZpZXdzXCI+XG4gICAgICAgIDxkaXYgKm5nRm9yPVwibGV0IGZpbGUgb2Ygc2VsZWN0ZWRGaWxlczsgbGV0IGkgPSBpbmRleFwiIGNsYXNzPVwiZmlsZS1jaGlwXCI+XG4gICAgICAgICAgPG1hdC1pY29uIGNsYXNzPVwiZmlsZS1pY29uXCI+e3sgZ2V0RmlsZUljb24oZmlsZSkgfX08L21hdC1pY29uPlxuICAgICAgICAgIDxzcGFuIGNsYXNzPVwiZmlsZS1uYW1lXCI+e3sgZmlsZS5uYW1lIH19PC9zcGFuPlxuICAgICAgICAgIDxzcGFuIGNsYXNzPVwiZmlsZS1zaXplXCI+e3sgZm9ybWF0U2l6ZShmaWxlLnNpemUpIH19PC9zcGFuPlxuICAgICAgICAgIDxidXR0b24gbWF0LWljb24tYnV0dG9uIGNsYXNzPVwiZmlsZS1yZW1vdmVcIiAoY2xpY2spPVwicmVtb3ZlRmlsZShpKVwiPlxuICAgICAgICAgICAgPG1hdC1pY29uPmNsb3NlPC9tYXQtaWNvbj5cbiAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cblxuICAgICAgPGRpdiBjbGFzcz1cImlucHV0LXdyYXBwZXJcIj5cbiAgICAgICAgPGJ1dHRvbiBtYXQtaWNvbi1idXR0b24gY2xhc3M9XCJhdHRhY2gtYnRuXCIgKGNsaWNrKT1cImZpbGVJbnB1dC5jbGljaygpXCIgdGl0bGU9XCJBdHRhY2ggZmlsZXNcIj5cbiAgICAgICAgICA8bWF0LWljb24+YXR0YWNoX2ZpbGU8L21hdC1pY29uPlxuICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgPGlucHV0XG4gICAgICAgICAgI2ZpbGVJbnB1dFxuICAgICAgICAgIHR5cGU9XCJmaWxlXCJcbiAgICAgICAgICBtdWx0aXBsZVxuICAgICAgICAgIHN0eWxlPVwiZGlzcGxheTpub25lXCJcbiAgICAgICAgICAoY2hhbmdlKT1cIm9uRmlsZXNTZWxlY3RlZCgkZXZlbnQpXCJcbiAgICAgICAgLz5cbiAgICAgICAgPHRleHRhcmVhXG4gICAgICAgICAgWyhuZ01vZGVsKV09XCJtZXNzYWdlVGV4dFwiXG4gICAgICAgICAgKGtleWRvd24uZW50ZXIpPVwib25FbnRlcigkZXZlbnQpXCJcbiAgICAgICAgICBwbGFjZWhvbGRlcj1cIlR5cGUgYSBtZXNzYWdlLi4uXCJcbiAgICAgICAgICByb3dzPVwiMVwiXG4gICAgICAgICAgY2xhc3M9XCJtZXNzYWdlLXRleHRhcmVhXCJcbiAgICAgICAgPjwvdGV4dGFyZWE+XG4gICAgICAgIDxidXR0b25cbiAgICAgICAgICBtYXQtaWNvbi1idXR0b25cbiAgICAgICAgICBjbGFzcz1cInNlbmQtYnRuXCJcbiAgICAgICAgICBbZGlzYWJsZWRdPVwiIWNhblNlbmRcIlxuICAgICAgICAgIChjbGljayk9XCJzZW5kKClcIlxuICAgICAgICA+XG4gICAgICAgICAgPG1hdC1pY29uPnNlbmQ8L21hdC1pY29uPlxuICAgICAgICA8L2J1dHRvbj5cbiAgICAgIDwvZGl2PlxuXG4gICAgPC9kaXY+XG4gIGAsXG4gIHN0eWxlczogW2BcbiAgICAubWVzc2FnZS1pbnB1dC1jb250YWluZXIge1xuICAgICAgcGFkZGluZzogOHB4IDEycHg7XG4gICAgICBib3JkZXItdG9wOiAxcHggc29saWQgcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjE1KTtcbiAgICAgIGJhY2tncm91bmQ6IHRyYW5zcGFyZW50O1xuICAgICAgcG9zaXRpb246IHJlbGF0aXZlO1xuICAgIH1cblxuICAgIC5maWxlLXByZXZpZXdzIHtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBmbGV4LXdyYXA6IHdyYXA7XG4gICAgICBnYXA6IDZweDtcbiAgICAgIG1hcmdpbi1ib3R0b206IDhweDtcbiAgICAgIG1heC1oZWlnaHQ6IDgwcHg7XG4gICAgICBvdmVyZmxvdy15OiBhdXRvO1xuICAgIH1cblxuICAgIC5maWxlLWNoaXAge1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBnYXA6IDRweDtcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xNSk7XG4gICAgICBib3JkZXItcmFkaXVzOiA4cHg7XG4gICAgICBwYWRkaW5nOiA0cHggNHB4IDRweCA4cHg7XG4gICAgICBtYXgtd2lkdGg6IDIwMHB4O1xuICAgIH1cblxuICAgIC5maWxlLWljb24ge1xuICAgICAgZm9udC1zaXplOiAxNnB4O1xuICAgICAgd2lkdGg6IDE2cHg7XG4gICAgICBoZWlnaHQ6IDE2cHg7XG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjgpO1xuICAgIH1cblxuICAgIC5maWxlLW5hbWUge1xuICAgICAgZm9udC1zaXplOiAxMnB4O1xuICAgICAgY29sb3I6ICNmZmY7XG4gICAgICB3aGl0ZS1zcGFjZTogbm93cmFwO1xuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICAgIHRleHQtb3ZlcmZsb3c6IGVsbGlwc2lzO1xuICAgICAgbWF4LXdpZHRoOiAxMDBweDtcbiAgICB9XG5cbiAgICAuZmlsZS1zaXplIHtcbiAgICAgIGZvbnQtc2l6ZTogMTBweDtcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNSk7XG4gICAgICBmbGV4LXNocmluazogMDtcbiAgICB9XG5cbiAgICAuZmlsZS1yZW1vdmUge1xuICAgICAgd2lkdGg6IDIwcHggIWltcG9ydGFudDtcbiAgICAgIGhlaWdodDogMjBweCAhaW1wb3J0YW50O1xuICAgIH1cblxuICAgIC5maWxlLXJlbW92ZSBtYXQtaWNvbiB7XG4gICAgICBmb250LXNpemU6IDE0cHg7XG4gICAgICB3aWR0aDogMTRweDtcbiAgICAgIGhlaWdodDogMTRweDtcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNik7XG4gICAgfVxuXG4gICAgLmlucHV0LXdyYXBwZXIge1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBnYXA6IDRweDtcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xKTtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDI0cHg7XG4gICAgICBwYWRkaW5nOiAycHggNHB4O1xuICAgIH1cblxuICAgIC5hdHRhY2gtYnRuLFxuICAgIC5zZW5kLWJ0biB7XG4gICAgICBmbGV4LXNocmluazogMDtcbiAgICAgIHdpZHRoOiAzNnB4O1xuICAgICAgaGVpZ2h0OiAzNnB4O1xuICAgICAgcGFkZGluZzogMCAhaW1wb3J0YW50O1xuICAgICAgbWFyZ2luOiAwO1xuICAgICAgbWluLXdpZHRoOiAzNnB4ICFpbXBvcnRhbnQ7XG4gICAgICBkaXNwbGF5OiBpbmxpbmUtZmxleCAhaW1wb3J0YW50O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlciAhaW1wb3J0YW50O1xuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXIgIWltcG9ydGFudDtcbiAgICAgIGxpbmUtaGVpZ2h0OiAwICFpbXBvcnRhbnQ7XG4gICAgfVxuXG4gICAgLmF0dGFjaC1idG4gbWF0LWljb24sXG4gICAgLnNlbmQtYnRuIG1hdC1pY29uIHtcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNyk7XG4gICAgICBmb250LXNpemU6IDIwcHg7XG4gICAgICB3aWR0aDogMjBweDtcbiAgICAgIGhlaWdodDogMjBweDtcbiAgICAgIGxpbmUtaGVpZ2h0OiAyMHB4O1xuICAgICAgbWFyZ2luOiAwO1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICB9XG5cbiAgICAuc2VuZC1idG4gbWF0LWljb24ge1xuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC45KTtcbiAgICB9XG5cbiAgICAubWVzc2FnZS10ZXh0YXJlYSB7XG4gICAgICBmbGV4OiAxO1xuICAgICAgYm9yZGVyOiBub25lO1xuICAgICAgb3V0bGluZTogbm9uZTtcbiAgICAgIGJhY2tncm91bmQ6IHRyYW5zcGFyZW50O1xuICAgICAgcmVzaXplOiBub25lO1xuICAgICAgZm9udC1zaXplOiAxNHB4O1xuICAgICAgZm9udC1mYW1pbHk6IGluaGVyaXQ7XG4gICAgICBsaW5lLWhlaWdodDogMS41O1xuICAgICAgbWF4LWhlaWdodDogMTAwcHg7XG4gICAgICBwYWRkaW5nOiA2cHggMDtcbiAgICAgIGNvbG9yOiAjZmZmO1xuICAgIH1cblxuICAgIC5tZXNzYWdlLXRleHRhcmVhOjpwbGFjZWhvbGRlciB7XG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjUpO1xuICAgIH1cblxuICAgIC5zZW5kLWJ0bjpkaXNhYmxlZCBtYXQtaWNvbiB7XG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjMpO1xuICAgIH1cblxuICAgIC8qIE1EQyBtYXQtaWNvbi1idXR0b24gaW5uZXIgd3JhcHBlciBvZnRlbiBzaGlmdHMgZ2x5cGhzIGRvd253YXJkIHdpdGhvdXQgdGhpcyAqL1xuICAgIDpob3N0IDo6bmctZGVlcCAuYXR0YWNoLWJ0biAubWF0LW1kYy1idXR0b24tdG91Y2gtdGFyZ2V0LFxuICAgIDpob3N0IDo6bmctZGVlcCAuc2VuZC1idG4gLm1hdC1tZGMtYnV0dG9uLXRvdWNoLXRhcmdldCB7XG4gICAgICBoZWlnaHQ6IDM2cHggIWltcG9ydGFudDtcbiAgICAgIHdpZHRoOiAzNnB4ICFpbXBvcnRhbnQ7XG4gICAgfVxuXG4gICAgOmhvc3QgOjpuZy1kZWVwIC5hdHRhY2gtYnRuIC5tZGMtaWNvbi1idXR0b25fX2ljb24sXG4gICAgOmhvc3QgOjpuZy1kZWVwIC5zZW5kLWJ0biAubWRjLWljb24tYnV0dG9uX19pY29uIHtcbiAgICAgIGRpc3BsYXk6IGZsZXggIWltcG9ydGFudDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXIgIWltcG9ydGFudDtcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyICFpbXBvcnRhbnQ7XG4gICAgICBtYXJnaW46IDAgIWltcG9ydGFudDtcbiAgICAgIHBhZGRpbmc6IDAgIWltcG9ydGFudDtcbiAgICB9XG5cbiAgYF0sXG59KVxuZXhwb3J0IGNsYXNzIE1lc3NhZ2VJbnB1dENvbXBvbmVudCB7XG4gIEBPdXRwdXQoKSBtZXNzYWdlU2VudCA9IG5ldyBFdmVudEVtaXR0ZXI8c3RyaW5nPigpO1xuICBAT3V0cHV0KCkgbWVzc2FnZVdpdGhGaWxlcyA9IG5ldyBFdmVudEVtaXR0ZXI8TWVzc2FnZVBheWxvYWQ+KCk7XG4gIEBWaWV3Q2hpbGQoJ2ZpbGVJbnB1dCcpIGZpbGVJbnB1dCE6IEVsZW1lbnRSZWY8SFRNTElucHV0RWxlbWVudD47XG5cbiAgbWVzc2FnZVRleHQgPSAnJztcbiAgc2VsZWN0ZWRGaWxlczogRmlsZVtdID0gW107XG5cbiAgZ2V0IGNhblNlbmQoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMubWVzc2FnZVRleHQudHJpbSgpLmxlbmd0aCA+IDAgfHwgdGhpcy5zZWxlY3RlZEZpbGVzLmxlbmd0aCA+IDA7XG4gIH1cblxuICBzZW5kKCk6IHZvaWQge1xuICAgIGlmICghdGhpcy5jYW5TZW5kKSByZXR1cm47XG4gICAgY29uc3QgdGV4dCA9IHRoaXMubWVzc2FnZVRleHQudHJpbSgpO1xuXG4gICAgaWYgKHRoaXMuc2VsZWN0ZWRGaWxlcy5sZW5ndGggPiAwKSB7XG4gICAgICB0aGlzLm1lc3NhZ2VXaXRoRmlsZXMuZW1pdCh7IHRleHQsIGZpbGVzOiBbLi4udGhpcy5zZWxlY3RlZEZpbGVzXSB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5tZXNzYWdlU2VudC5lbWl0KHRleHQpO1xuICAgIH1cblxuICAgIHRoaXMubWVzc2FnZVRleHQgPSAnJztcbiAgICB0aGlzLnNlbGVjdGVkRmlsZXMgPSBbXTtcbiAgICBpZiAodGhpcy5maWxlSW5wdXQpIHRoaXMuZmlsZUlucHV0Lm5hdGl2ZUVsZW1lbnQudmFsdWUgPSAnJztcbiAgfVxuXG4gIG9uRW50ZXIoZXZlbnQ6IEV2ZW50KTogdm9pZCB7XG4gICAgY29uc3Qga2UgPSBldmVudCBhcyBLZXlib2FyZEV2ZW50O1xuICAgIGlmICgha2Uuc2hpZnRLZXkpIHtcbiAgICAgIGtlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICB0aGlzLnNlbmQoKTtcbiAgICB9XG4gIH1cblxuICBvbkZpbGVzU2VsZWN0ZWQoZXZlbnQ6IEV2ZW50KTogdm9pZCB7XG4gICAgY29uc3QgaW5wdXQgPSBldmVudC50YXJnZXQgYXMgSFRNTElucHV0RWxlbWVudDtcbiAgICBpZiAoaW5wdXQuZmlsZXMpIHtcbiAgICAgIHRoaXMuYWRkRmlsZXMoQXJyYXkuZnJvbShpbnB1dC5maWxlcykpO1xuICAgIH1cbiAgfVxuXG4gIGFkZEZpbGVzKGZpbGVzOiBGaWxlW10pOiB2b2lkIHtcbiAgICBpZiAoIWZpbGVzLmxlbmd0aCkgcmV0dXJuO1xuICAgIHRoaXMuc2VsZWN0ZWRGaWxlcyA9IFsuLi50aGlzLnNlbGVjdGVkRmlsZXMsIC4uLmZpbGVzXTtcbiAgfVxuXG4gIHJlbW92ZUZpbGUoaW5kZXg6IG51bWJlcik6IHZvaWQge1xuICAgIHRoaXMuc2VsZWN0ZWRGaWxlcy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgIHRoaXMuc2VsZWN0ZWRGaWxlcyA9IFsuLi50aGlzLnNlbGVjdGVkRmlsZXNdO1xuICB9XG5cbiAgZ2V0RmlsZUljb24oZmlsZTogRmlsZSk6IHN0cmluZyB7XG4gICAgY29uc3QgdHlwZSA9IGZpbGUudHlwZTtcbiAgICBpZiAodHlwZS5zdGFydHNXaXRoKCdpbWFnZS8nKSkgcmV0dXJuICdpbWFnZSc7XG4gICAgaWYgKHR5cGUuc3RhcnRzV2l0aCgndmlkZW8vJykpIHJldHVybiAndmlkZW9jYW0nO1xuICAgIGlmICh0eXBlLnN0YXJ0c1dpdGgoJ2F1ZGlvLycpKSByZXR1cm4gJ2F1ZGlvdHJhY2snO1xuICAgIGlmICh0eXBlLmluY2x1ZGVzKCdwZGYnKSkgcmV0dXJuICdwaWN0dXJlX2FzX3BkZic7XG4gICAgaWYgKHR5cGUuaW5jbHVkZXMoJ3NwcmVhZHNoZWV0JykgfHwgdHlwZS5pbmNsdWRlcygnZXhjZWwnKSkgcmV0dXJuICd0YWJsZV9jaGFydCc7XG4gICAgaWYgKHR5cGUuaW5jbHVkZXMoJ2RvY3VtZW50JykgfHwgdHlwZS5pbmNsdWRlcygnd29yZCcpKSByZXR1cm4gJ2Rlc2NyaXB0aW9uJztcbiAgICByZXR1cm4gJ2luc2VydF9kcml2ZV9maWxlJztcbiAgfVxuXG4gIGZvcm1hdFNpemUoYnl0ZXM6IG51bWJlcik6IHN0cmluZyB7XG4gICAgaWYgKGJ5dGVzIDwgMTAyNCkgcmV0dXJuIGJ5dGVzICsgJyBCJztcbiAgICBpZiAoYnl0ZXMgPCAxMDI0ICogMTAyNCkgcmV0dXJuIChieXRlcyAvIDEwMjQpLnRvRml4ZWQoMCkgKyAnIEtCJztcbiAgICByZXR1cm4gKGJ5dGVzIC8gKDEwMjQgKiAxMDI0KSkudG9GaXhlZCgxKSArICcgTUInO1xuICB9XG59XG4iXX0=