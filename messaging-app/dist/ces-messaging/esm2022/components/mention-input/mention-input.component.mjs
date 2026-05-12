import { Component, Input, Output, EventEmitter, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as i0 from "@angular/core";
import * as i1 from "@angular/common";
import * as i2 from "@angular/forms";
export class MentionInputComponent {
    placeholder = 'Type a message...';
    contacts = [];
    textChange = new EventEmitter();
    mention = new EventEmitter();
    textInput;
    text = '';
    showSuggestions = false;
    filteredContacts = [];
    selectedIndex = 0;
    mentionStart = -1;
    mentionQuery = '';
    onTextChange() {
        this.textChange.emit(this.text);
        this.checkForMention();
    }
    checkForMention() {
        const cursorPos = this.textInput.nativeElement.selectionStart;
        const textBeforeCursor = this.text.substring(0, cursorPos);
        const lastAtIndex = textBeforeCursor.lastIndexOf('@');
        if (lastAtIndex === -1) {
            this.showSuggestions = false;
            return;
        }
        const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
        if (/\s/.test(textAfterAt)) {
            this.showSuggestions = false;
            return;
        }
        this.mentionStart = lastAtIndex;
        this.mentionQuery = textAfterAt.toLowerCase();
        this.filterContacts();
        this.showSuggestions = this.filteredContacts.length > 0;
        this.selectedIndex = 0;
    }
    filterContacts() {
        if (!this.mentionQuery) {
            this.filteredContacts = this.contacts.slice(0, 5);
            return;
        }
        this.filteredContacts = this.contacts.filter(c => {
            const name = (c.username || c.first_name || c.email).toLowerCase();
            return name.includes(this.mentionQuery);
        }).slice(0, 5);
    }
    selectContact(contact) {
        const displayName = contact.username || contact.first_name || contact.email;
        const before = this.text.substring(0, this.mentionStart);
        const after = this.text.substring(this.textInput.nativeElement.selectionStart);
        this.text = `${before}@${displayName} ${after}`;
        this.showSuggestions = false;
        this.mention.emit(contact);
        this.textChange.emit(this.text);
        setTimeout(() => {
            const newPos = this.mentionStart + displayName.length + 2;
            this.textInput.nativeElement.setSelectionRange(newPos, newPos);
            this.textInput.nativeElement.focus();
        });
    }
    onKeyDown(event) {
        if (!this.showSuggestions)
            return;
        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                this.selectedIndex = Math.min(this.selectedIndex + 1, this.filteredContacts.length - 1);
                break;
            case 'ArrowUp':
                event.preventDefault();
                this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
                break;
            case 'Enter':
                if (this.filteredContacts[this.selectedIndex]) {
                    event.preventDefault();
                    this.selectContact(this.filteredContacts[this.selectedIndex]);
                }
                break;
            case 'Escape':
                this.showSuggestions = false;
                break;
        }
    }
    getText() {
        return this.text;
    }
    setText(value) {
        this.text = value;
    }
    clear() {
        this.text = '';
        this.showSuggestions = false;
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: MentionInputComponent, deps: [], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "17.3.12", type: MentionInputComponent, isStandalone: true, selector: "app-mention-input", inputs: { placeholder: "placeholder", contacts: "contacts" }, outputs: { textChange: "textChange", mention: "mention" }, viewQueries: [{ propertyName: "textInput", first: true, predicate: ["textInput"], descendants: true }], ngImport: i0, template: `
    <div class="mention-input-container">
      <textarea
        #textInput
        [(ngModel)]="text"
        (ngModelChange)="onTextChange()"
        (keydown)="onKeyDown($event)"
        [placeholder]="placeholder"
        rows="1"
      ></textarea>

      <div class="mention-suggestions" *ngIf="showSuggestions">
        <div 
          *ngFor="let contact of filteredContacts; let i = index"
          class="suggestion-item"
          [class.selected]="i === selectedIndex"
          (click)="selectContact(contact)"
          (mouseenter)="selectedIndex = i"
        >
          <strong>{{ contact.username || contact.first_name || contact.email }}</strong>
          <span class="email">{{ contact.email }}</span>
        </div>
      </div>
    </div>
  `, isInline: true, styles: [".mention-input-container{position:relative;width:100%}textarea{width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:4px;resize:vertical;font-family:inherit;font-size:14px;outline:none}textarea:focus{border-color:#1976d2}.mention-suggestions{position:absolute;bottom:100%;left:0;right:0;background:#fff;border:1px solid #ddd;border-radius:4px;box-shadow:0 2px 8px #00000026;max-height:200px;overflow-y:auto;margin-bottom:4px;z-index:1000}.suggestion-item{padding:8px 12px;cursor:pointer;display:flex;flex-direction:column;gap:2px}.suggestion-item:hover,.suggestion-item.selected{background:#f5f5f5}.suggestion-item strong{font-size:14px}.suggestion-item .email{font-size:12px;color:#666}\n"], dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i1.NgForOf, selector: "[ngFor][ngForOf]", inputs: ["ngForOf", "ngForTrackBy", "ngForTemplate"] }, { kind: "directive", type: i1.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "ngmodule", type: FormsModule }, { kind: "directive", type: i2.DefaultValueAccessor, selector: "input:not([type=checkbox])[formControlName],textarea[formControlName],input:not([type=checkbox])[formControl],textarea[formControl],input:not([type=checkbox])[ngModel],textarea[ngModel],[ngDefaultControl]" }, { kind: "directive", type: i2.NgControlStatus, selector: "[formControlName],[ngModel],[formControl]" }, { kind: "directive", type: i2.NgModel, selector: "[ngModel]:not([formControlName]):not([formControl])", inputs: ["name", "disabled", "ngModel", "ngModelOptions"], outputs: ["ngModelChange"], exportAs: ["ngModel"] }] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: MentionInputComponent, decorators: [{
            type: Component,
            args: [{ selector: 'app-mention-input', standalone: true, imports: [CommonModule, FormsModule], template: `
    <div class="mention-input-container">
      <textarea
        #textInput
        [(ngModel)]="text"
        (ngModelChange)="onTextChange()"
        (keydown)="onKeyDown($event)"
        [placeholder]="placeholder"
        rows="1"
      ></textarea>

      <div class="mention-suggestions" *ngIf="showSuggestions">
        <div 
          *ngFor="let contact of filteredContacts; let i = index"
          class="suggestion-item"
          [class.selected]="i === selectedIndex"
          (click)="selectContact(contact)"
          (mouseenter)="selectedIndex = i"
        >
          <strong>{{ contact.username || contact.first_name || contact.email }}</strong>
          <span class="email">{{ contact.email }}</span>
        </div>
      </div>
    </div>
  `, styles: [".mention-input-container{position:relative;width:100%}textarea{width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:4px;resize:vertical;font-family:inherit;font-size:14px;outline:none}textarea:focus{border-color:#1976d2}.mention-suggestions{position:absolute;bottom:100%;left:0;right:0;background:#fff;border:1px solid #ddd;border-radius:4px;box-shadow:0 2px 8px #00000026;max-height:200px;overflow-y:auto;margin-bottom:4px;z-index:1000}.suggestion-item{padding:8px 12px;cursor:pointer;display:flex;flex-direction:column;gap:2px}.suggestion-item:hover,.suggestion-item.selected{background:#f5f5f5}.suggestion-item strong{font-size:14px}.suggestion-item .email{font-size:12px;color:#666}\n"] }]
        }], propDecorators: { placeholder: [{
                type: Input
            }], contacts: [{
                type: Input
            }], textChange: [{
                type: Output
            }], mention: [{
                type: Output
            }], textInput: [{
                type: ViewChild,
                args: ['textInput']
            }] } });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVudGlvbi1pbnB1dC5jb21wb25lbnQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvbGliL2NvbXBvbmVudHMvbWVudGlvbi1pbnB1dC9tZW50aW9uLWlucHV0LmNvbXBvbmVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsU0FBUyxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsWUFBWSxFQUFFLFNBQVMsRUFBYyxNQUFNLGVBQWUsQ0FBQztBQUM5RixPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDL0MsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLGdCQUFnQixDQUFDOzs7O0FBMkY3QyxNQUFNLE9BQU8scUJBQXFCO0lBQ3ZCLFdBQVcsR0FBRyxtQkFBbUIsQ0FBQztJQUNsQyxRQUFRLEdBQWMsRUFBRSxDQUFDO0lBQ3hCLFVBQVUsR0FBRyxJQUFJLFlBQVksRUFBVSxDQUFDO0lBQ3hDLE9BQU8sR0FBRyxJQUFJLFlBQVksRUFBVyxDQUFDO0lBQ3hCLFNBQVMsQ0FBbUM7SUFFcEUsSUFBSSxHQUFHLEVBQUUsQ0FBQztJQUNWLGVBQWUsR0FBRyxLQUFLLENBQUM7SUFDeEIsZ0JBQWdCLEdBQWMsRUFBRSxDQUFDO0lBQ2pDLGFBQWEsR0FBRyxDQUFDLENBQUM7SUFDbEIsWUFBWSxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBQ2xCLFlBQVksR0FBRyxFQUFFLENBQUM7SUFFbEIsWUFBWTtRQUNWLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNoQyxJQUFJLENBQUMsZUFBZSxFQUFFLENBQUM7SUFDekIsQ0FBQztJQUVELGVBQWU7UUFDYixNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLGFBQWEsQ0FBQyxjQUFjLENBQUM7UUFDOUQsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFD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SSxDQUFDLGVBQWUsR0FBRyxLQUFLLENBQUM7SUFDL0IsQ0FBQzt3R0EzR1UscUJBQXFCOzRGQUFyQixxQkFBcUIsOFNBcEZ0Qjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBd0JULG93QkF6QlMsWUFBWSwrUEFBRSxXQUFXOzs0RkFxRnhCLHFCQUFxQjtrQkF4RmpDLFNBQVM7K0JBQ0UsbUJBQW1CLGNBQ2pCLElBQUksV0FDUCxDQUFDLFlBQVksRUFBRSxXQUFXLENBQUMsWUFDMUI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQXdCVDs4QkE2RFEsV0FBVztzQkFBbkIsS0FBSztnQkFDRyxRQUFRO3NCQUFoQixLQUFLO2dCQUNJLFVBQVU7c0JBQW5CLE1BQU07Z0JBQ0csT0FBTztzQkFBaEIsTUFBTTtnQkFDaUIsU0FBUztzQkFBaEMsU0FBUzt1QkFBQyxXQUFXIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQ29tcG9uZW50LCBJbnB1dCwgT3V0cHV0LCBFdmVudEVtaXR0ZXIsIFZpZXdDaGlsZCwgRWxlbWVudFJlZiB9IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xuaW1wb3J0IHsgQ29tbW9uTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvY29tbW9uJztcbmltcG9ydCB7IEZvcm1zTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvZm9ybXMnO1xuaW1wb3J0IHsgQ29udGFjdCB9IGZyb20gJy4uLy4uL21vZGVscy9tZXNzYWdpbmcubW9kZWxzJztcblxuQENvbXBvbmVudCh7XG4gIHNlbGVjdG9yOiAnYXBwLW1lbnRpb24taW5wdXQnLFxuICBzdGFuZGFsb25lOiB0cnVlLFxuICBpbXBvcnRzOiBbQ29tbW9uTW9kdWxlLCBGb3Jtc01vZHVsZV0sXG4gIHRlbXBsYXRlOiBgXG4gICAgPGRpdiBjbGFzcz1cIm1lbnRpb24taW5wdXQtY29udGFpbmVyXCI+XG4gICAgICA8dGV4dGFyZWFcbiAgICAgICAgI3RleHRJbnB1dFxuICAgICAgICBbKG5nTW9kZWwpXT1cInRleHRcIlxuICAgICAgICAobmdNb2RlbENoYW5nZSk9XCJvblRleHRDaGFuZ2UoKVwiXG4gICAgICAgIChrZXlkb3duKT1cIm9uS2V5RG93bigkZXZlbnQpXCJcbiAgICAgICAgW3BsYWNlaG9sZGVyXT1cInBsYWNlaG9sZGVyXCJcbiAgICAgICAgcm93cz1cIjFcIlxuICAgICAgPjwvdGV4dGFyZWE+XG5cbiAgICAgIDxkaXYgY2xhc3M9XCJtZW50aW9uLXN1Z2dlc3Rpb25zXCIgKm5nSWY9XCJzaG93U3VnZ2VzdGlvbnNcIj5cbiAgICAgICAgPGRpdiBcbiAgICAgICAgICAqbmdGb3I9XCJsZXQgY29udGFjdCBvZiBmaWx0ZXJlZENvbnRhY3RzOyBsZXQgaSA9IGluZGV4XCJcbiAgICAgICAgICBjbGFzcz1cInN1Z2dlc3Rpb24taXRlbVwiXG4gICAgICAgICAgW2NsYXNzLnNlbGVjdGVkXT1cImkgPT09IHNlbGVjdGVkSW5kZXhcIlxuICAgICAgICAgIChjbGljayk9XCJzZWxlY3RDb250YWN0KGNvbnRhY3QpXCJcbiAgICAgICAgICAobW91c2VlbnRlcik9XCJzZWxlY3RlZEluZGV4ID0gaVwiXG4gICAgICAgID5cbiAgICAgICAgICA8c3Ryb25nPnt7IGNvbnRhY3QudXNlcm5hbWUgfHwgY29udGFjdC5maXJzdF9uYW1lIHx8IGNvbnRhY3QuZW1haWwgfX08L3N0cm9uZz5cbiAgICAgICAgICA8c3BhbiBjbGFzcz1cImVtYWlsXCI+e3sgY29udGFjdC5lbWFpbCB9fTwvc3Bhbj5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5cbiAgYCxcbiAgc3R5bGVzOiBbYFxuICAgIC5tZW50aW9uLWlucHV0LWNvbnRhaW5lciB7XG4gICAgICBwb3NpdGlvbjogcmVsYXRpdmU7XG4gICAgICB3aWR0aDogMTAwJTtcbiAgICB9XG5cbiAgICB0ZXh0YXJlYSB7XG4gICAgICB3aWR0aDogMTAwJTtcbiAgICAgIHBhZGRpbmc6IDhweCAxMnB4O1xuICAgICAgYm9yZGVyOiAxcHggc29saWQgI2RkZDtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDRweDtcbiAgICAgIHJlc2l6ZTogdmVydGljYWw7XG4gICAgICBmb250LWZhbWlseTogaW5oZXJpdDtcbiAgICAgIGZvbnQtc2l6ZTogMTRweDtcbiAgICAgIG91dGxpbmU6IG5vbmU7XG4gICAgfVxuXG4gICAgdGV4dGFyZWE6Zm9jdXMge1xuICAgICAgYm9yZGVyLWNvbG9yOiAjMTk3NmQyO1xuICAgIH1cblxuICAgIC5tZW50aW9uLXN1Z2dlc3Rpb25zIHtcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgIGJvdHRvbTogMTAwJTtcbiAgICAgIGxlZnQ6IDA7XG4gICAgICByaWdodDogMDtcbiAgICAgIGJhY2tncm91bmQ6IHdoaXRlO1xuICAgICAgYm9yZGVyOiAxcHggc29saWQgI2RkZDtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDRweDtcbiAgICAgIGJveC1zaGFkb3c6IDAgMnB4IDhweCByZ2JhKDAsMCwwLDAuMTUpO1xuICAgICAgbWF4LWhlaWdodDogMjAwcHg7XG4gICAgICBvdmVyZmxvdy15OiBhdXRvO1xuICAgICAgbWFyZ2luLWJvdHRvbTogNHB4O1xuICAgICAgei1pbmRleDogMTAwMDtcbiAgICB9XG5cbiAgICAuc3VnZ2VzdGlvbi1pdGVtIHtcbiAgICAgIHBhZGRpbmc6IDhweCAxMnB4O1xuICAgICAgY3Vyc29yOiBwb2ludGVyO1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAgICBnYXA6IDJweDtcbiAgICB9XG5cbiAgICAuc3VnZ2VzdGlvbi1pdGVtOmhvdmVyLFxuICAgIC5zdWdnZXN0aW9uLWl0ZW0uc2VsZWN0ZWQge1xuICAgICAgYmFja2dyb3VuZDogI2Y1ZjVmNTtcbiAgICB9XG5cbiAgICAuc3VnZ2VzdGlvbi1pdGVtIHN0cm9uZyB7XG4gICAgICBmb250LXNpemU6IDE0cHg7XG4gICAgfVxuXG4gICAgLnN1Z2dlc3Rpb24taXRlbSAuZW1haWwge1xuICAgICAgZm9udC1zaXplOiAxMnB4O1xuICAgICAgY29sb3I6ICM2NjY7XG4gICAgfVxuICBgXVxufSlcbmV4cG9ydCBjbGFzcyBNZW50aW9uSW5wdXRDb21wb25lbnQge1xuICBASW5wdXQoKSBwbGFjZWhvbGRlciA9ICdUeXBlIGEgbWVzc2FnZS4uLic7XG4gIEBJbnB1dCgpIGNvbnRhY3RzOiBDb250YWN0W10gPSBbXTtcbiAgQE91dHB1dCgpIHRleHRDaGFuZ2UgPSBuZXcgRXZlbnRFbWl0dGVyPHN0cmluZz4oKTtcbiAgQE91dHB1dCgpIG1lbnRpb24gPSBuZXcgRXZlbnRFbWl0dGVyPENvbnRhY3Q+KCk7XG4gIEBWaWV3Q2hpbGQoJ3RleHRJbnB1dCcpIHRleHRJbnB1dCE6IEVsZW1lbnRSZWY8SFRNTFRleHRBcmVhRWxlbWVudD47XG5cbiAgdGV4dCA9ICcnO1xuICBzaG93U3VnZ2VzdGlvbnMgPSBmYWxzZTtcbiAgZmlsdGVyZWRDb250YWN0czogQ29udGFjdFtdID0gW107XG4gIHNlbGVjdGVkSW5kZXggPSAwO1xuICBtZW50aW9uU3RhcnQgPSAtMTtcbiAgbWVudGlvblF1ZXJ5ID0gJyc7XG5cbiAgb25UZXh0Q2hhbmdlKCkge1xuICAgIHRoaXMudGV4dENoYW5nZS5lbWl0KHRoaXMudGV4dCk7XG4gICAgdGhpcy5jaGVja0Zvck1lbnRpb24oKTtcbiAgfVxuXG4gIGNoZWNrRm9yTWVudGlvbigpIHtcbiAgICBjb25zdCBjdXJzb3JQb3MgPSB0aGlzLnRleHRJbnB1dC5uYXRpdmVFbGVtZW50LnNlbGVjdGlvblN0YXJ0O1xuICAgIGNvbnN0IHRleHRCZWZvcmVDdXJzb3IgPSB0aGlzLnRleHQuc3Vic3RyaW5nKDAsIGN1cnNvclBvcyk7XG4gICAgY29uc3QgbGFzdEF0SW5kZXggPSB0ZXh0QmVmb3JlQ3Vyc29yLmxhc3RJbmRleE9mKCdAJyk7XG5cbiAgICBpZiAobGFzdEF0SW5kZXggPT09IC0xKSB7XG4gICAgICB0aGlzLnNob3dTdWdnZXN0aW9ucyA9IGZhbHNlO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHRleHRBZnRlckF0ID0gdGV4dEJlZm9yZUN1cnNvci5zdWJzdHJpbmcobGFzdEF0SW5kZXggKyAxKTtcbiAgICBcbiAgICBpZiAoL1xccy8udGVzdCh0ZXh0QWZ0ZXJBdCkpIHtcbiAgICAgIHRoaXMuc2hvd1N1Z2dlc3Rpb25zID0gZmFsc2U7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5tZW50aW9uU3RhcnQgPSBsYXN0QXRJbmRleDtcbiAgICB0aGlzLm1lbnRpb25RdWVyeSA9IHRleHRBZnRlckF0LnRvTG93ZXJDYXNlKCk7XG4gICAgdGhpcy5maWx0ZXJDb250YWN0cygpO1xuICAgIHRoaXMuc2hvd1N1Z2dlc3Rpb25zID0gdGhpcy5maWx0ZXJlZENvbnRhY3RzLmxlbmd0aCA+IDA7XG4gICAgdGhpcy5zZWxlY3RlZEluZGV4ID0gMDtcbiAgfVxuXG4gIGZpbHRlckNvbnRhY3RzKCkge1xuICAgIGlmICghdGhpcy5tZW50aW9uUXVlcnkpIHtcbiAgICAgIHRoaXMuZmlsdGVyZWRDb250YWN0cyA9IHRoaXMuY29udGFjdHMuc2xpY2UoMCwgNSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5maWx0ZXJlZENvbnRhY3RzID0gdGhpcy5jb250YWN0cy5maWx0ZXIoYyA9PiB7XG4gICAgICBjb25zdCBuYW1lID0gKGMudXNlcm5hbWUgfHwgYy5maXJzdF9uYW1lIHx8IGMuZW1haWwpLnRvTG93ZXJDYXNlKCk7XG4gICAgICByZXR1cm4gbmFtZS5pbmNsdWRlcyh0aGlzLm1lbnRpb25RdWVyeSk7XG4gICAgfSkuc2xpY2UoMCwgNSk7XG4gIH1cblxuICBzZWxlY3RDb250YWN0KGNvbnRhY3Q6IENvbnRhY3QpIHtcbiAgICBjb25zdCBkaXNwbGF5TmFtZSA9IGNvbnRhY3QudXNlcm5hbWUgfHwgY29udGFjdC5maXJzdF9uYW1lIHx8IGNvbnRhY3QuZW1haWw7XG4gICAgY29uc3QgYmVmb3JlID0gdGhpcy50ZXh0LnN1YnN0cmluZygwLCB0aGlzLm1lbnRpb25TdGFydCk7XG4gICAgY29uc3QgYWZ0ZXIgPSB0aGlzLnRleHQuc3Vic3RyaW5nKHRoaXMudGV4dElucHV0Lm5hdGl2ZUVsZW1lbnQuc2VsZWN0aW9uU3RhcnQpO1xuICAgIFxuICAgIHRoaXMudGV4dCA9IGAke2JlZm9yZX1AJHtkaXNwbGF5TmFtZX0gJHthZnRlcn1gO1xuICAgIHRoaXMuc2hvd1N1Z2dlc3Rpb25zID0gZmFsc2U7XG4gICAgdGhpcy5tZW50aW9uLmVtaXQoY29udGFjdCk7XG4gICAgdGhpcy50ZXh0Q2hhbmdlLmVtaXQodGhpcy50ZXh0KTtcblxuICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgY29uc3QgbmV3UG9zID0gdGhpcy5tZW50aW9uU3RhcnQgKyBkaXNwbGF5TmFtZS5sZW5ndGggKyAyO1xuICAgICAgdGhpcy50ZXh0SW5wdXQubmF0aXZlRWxlbWVudC5zZXRTZWxlY3Rpb25SYW5nZShuZXdQb3MsIG5ld1Bvcyk7XG4gICAgICB0aGlzLnRleHRJbnB1dC5uYXRpdmVFbGVtZW50LmZvY3VzKCk7XG4gICAgfSk7XG4gIH1cblxuICBvbktleURvd24oZXZlbnQ6IEtleWJvYXJkRXZlbnQpIHtcbiAgICBpZiAoIXRoaXMuc2hvd1N1Z2dlc3Rpb25zKSByZXR1cm47XG5cbiAgICBzd2l0Y2ggKGV2ZW50LmtleSkge1xuICAgICAgY2FzZSAnQXJyb3dEb3duJzpcbiAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgdGhpcy5zZWxlY3RlZEluZGV4ID0gTWF0aC5taW4odGhpcy5zZWxlY3RlZEluZGV4ICsgMSwgdGhpcy5maWx0ZXJlZENvbnRhY3RzLmxlbmd0aCAtIDEpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ0Fycm93VXAnOlxuICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICB0aGlzLnNlbGVjdGVkSW5kZXggPSBNYXRoLm1heCh0aGlzLnNlbGVjdGVkSW5kZXggLSAxLCAwKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdFbnRlcic6XG4gICAgICAgIGlmICh0aGlzLmZpbHRlcmVkQ29udGFjdHNbdGhpcy5zZWxlY3RlZEluZGV4XSkge1xuICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgdGhpcy5zZWxlY3RDb250YWN0KHRoaXMuZmlsdGVyZWRDb250YWN0c1t0aGlzLnNlbGVjdGVkSW5kZXhdKTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ0VzY2FwZSc6XG4gICAgICAgIHRoaXMuc2hvd1N1Z2dlc3Rpb25zID0gZmFsc2U7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIGdldFRleHQoKTogc3RyaW5nIHtcbiAgICByZXR1cm4gdGhpcy50ZXh0O1xuICB9XG5cbiAgc2V0VGV4dCh2YWx1ZTogc3RyaW5nKSB7XG4gICAgdGhpcy50ZXh0ID0gdmFsdWU7XG4gIH1cblxuICBjbGVhcigpIHtcbiAgICB0aGlzLnRleHQgPSAnJztcbiAgICB0aGlzLnNob3dTdWdnZXN0aW9ucyA9IGZhbHNlO1xuICB9XG59XG4iXX0=