import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { debounceTime, Subject } from 'rxjs';
import * as i0 from "@angular/core";
import * as i1 from "../../services/messaging-api.service";
import * as i2 from "../../services/auth.service";
import * as i3 from "@angular/common";
import * as i4 from "@angular/forms";
import * as i5 from "@angular/material/icon";
import * as i6 from "@angular/material/button";
import * as i7 from "@angular/material/input";
import * as i8 from "@angular/material/form-field";
import * as i9 from "@angular/material/progress-spinner";
import * as i10 from "@angular/material/datepicker";
export class SearchPanelComponent {
    api;
    auth;
    close = new EventEmitter();
    messageSelected = new EventEmitter();
    query = '';
    filters = {};
    showFilters = false;
    results = [];
    loading = false;
    searchSubject = new Subject();
    constructor(api, auth) {
        this.api = api;
        this.auth = auth;
        this.searchSubject.pipe(debounceTime(300)).subscribe(() => {
            this.performSearch();
        });
    }
    onQueryChange() {
        this.searchSubject.next(this.query);
    }
    performSearch() {
        if (!this.query.trim()) {
            this.results = [];
            return;
        }
        const contactId = this.auth.contactId;
        if (!contactId) {
            this.loading = false;
            return;
        }
        this.loading = true;
        const conversationId = this.filters.conversation_id?.toString();
        this.api.searchMessages(contactId, this.query, conversationId).subscribe({
            next: (messages) => {
                this.results = messages;
                this.loading = false;
            },
            error: () => {
                this.loading = false;
            }
        });
    }
    clearSearch() {
        this.query = '';
        this.results = [];
    }
    selectMessage(msg) {
        this.messageSelected.emit(msg);
    }
    onClose() {
        this.close.emit();
    }
    formatDate(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    }
    highlightQuery(text) {
        if (!this.query)
            return text;
        const regex = new RegExp(`(${this.query})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: SearchPanelComponent, deps: [{ token: i1.MessagingApiService }, { token: i2.AuthService }], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "17.3.12", type: SearchPanelComponent, isStandalone: true, selector: "app-search-panel", outputs: { close: "close", messageSelected: "messageSelected" }, ngImport: i0, template: `
    <div class="search-panel">
      <div class="search-header">
        <h3>Search Messages</h3>
        <button mat-icon-button (click)="onClose()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="search-input-container">
        <mat-form-field appearance="outline" class="search-field">
          <mat-icon matPrefix>search</mat-icon>
          <input 
            matInput 
            [(ngModel)]="query" 
            (ngModelChange)="onQueryChange()"
            placeholder="Search messages..."
          />
          <button mat-icon-button matSuffix *ngIf="query" (click)="clearSearch()">
            <mat-icon>clear</mat-icon>
          </button>
        </mat-form-field>

        <button mat-button (click)="showFilters = !showFilters">
          <mat-icon>filter_list</mat-icon>
          Filters
        </button>
      </div>

      <div class="filters" *ngIf="showFilters">
        <mat-form-field appearance="outline">
          <mat-label>From User</mat-label>
          <input matInput [(ngModel)]="filters.user_id" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Date From</mat-label>
          <input matInput [matDatepicker]="pickerFrom" [(ngModel)]="filters.date_from" />
          <mat-datepicker-toggle matSuffix [for]="pickerFrom"></mat-datepicker-toggle>
          <mat-datepicker #pickerFrom></mat-datepicker>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Date To</mat-label>
          <input matInput [matDatepicker]="pickerTo" [(ngModel)]="filters.date_to" />
          <mat-datepicker-toggle matSuffix [for]="pickerTo"></mat-datepicker-toggle>
          <mat-datepicker #pickerTo></mat-datepicker>
        </mat-form-field>
      </div>

      <div class="search-results">
        <div *ngIf="loading" class="loading">
          <mat-spinner diameter="40"></mat-spinner>
        </div>

        <div *ngIf="!loading && results.length === 0 && query" class="no-results">
          No messages found
        </div>

        <div *ngFor="let msg of results" class="result-item" (click)="selectMessage(msg)">
          <div class="result-header">
            <strong>{{ msg.sender_name || 'Unknown' }}</strong>
            <span class="timestamp">{{ formatDate(msg.created_at) }}</span>
          </div>
          <div class="result-content" [innerHTML]="highlightQuery(msg.content || '')"></div>
        </div>
      </div>
    </div>
  `, isInline: true, styles: [".search-panel{display:flex;flex-direction:column;height:100%;background:#fff}.search-header{display:flex;justify-content:space-between;align-items:center;padding:16px;border-bottom:1px solid #e0e0e0}.search-header h3{margin:0;font-size:18px;font-weight:500}.search-input-container{padding:16px;border-bottom:1px solid #e0e0e0}.search-field{width:100%;margin-bottom:8px}.filters{padding:16px;background:#f5f5f5;display:flex;flex-direction:column;gap:12px}.search-results{flex:1;overflow-y:auto;padding:16px}.loading{display:flex;justify-content:center;padding:32px}.no-results{text-align:center;color:#666;padding:32px}.result-item{padding:12px;border-bottom:1px solid #e0e0e0;cursor:pointer;transition:background .2s}.result-item:hover{background:#f5f5f5}.result-header{display:flex;justify-content:space-between;margin-bottom:4px;font-size:14px}.timestamp{color:#666;font-size:12px}.result-content{font-size:14px;color:#333;line-height:1.4}.result-content ::ng-deep mark{background-color:#ffeb3b;padding:2px 4px;border-radius:2px}\n"], dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i3.NgForOf, selector: "[ngFor][ngForOf]", inputs: ["ngForOf", "ngForTrackBy", "ngForTemplate"] }, { kind: "directive", type: i3.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "ngmodule", type: FormsModule }, { kind: "directive", type: i4.DefaultValueAccessor, selector: "input:not([type=checkbox])[formControlName],textarea[formControlName],input:not([type=checkbox])[formControl],textarea[formControl],input:not([type=checkbox])[ngModel],textarea[ngModel],[ngDefaultControl]" }, { kind: "directive", type: i4.NgControlStatus, selector: "[formControlName],[ngModel],[formControl]" }, { kind: "directive", type: i4.NgModel, selector: "[ngModel]:not([formControlName]):not([formControl])", inputs: ["name", "disabled", "ngModel", "ngModelOptions"], outputs: ["ngModelChange"], exportAs: ["ngModel"] }, { kind: "ngmodule", type: MatIconModule }, { kind: "component", type: i5.MatIcon, selector: "mat-icon", inputs: ["color", "inline", "svgIcon", "fontSet", "fontIcon"], exportAs: ["matIcon"] }, { kind: "ngmodule", type: MatButtonModule }, { kind: "component", type: i6.MatButton, selector: "    button[mat-button], button[mat-raised-button], button[mat-flat-button],    button[mat-stroked-button]  ", exportAs: ["matButton"] }, { kind: "component", type: i6.MatIconButton, selector: "button[mat-icon-button]", exportAs: ["matButton"] }, { kind: "ngmodule", type: MatInputModule }, { kind: "directive", type: i7.MatInput, selector: "input[matInput], textarea[matInput], select[matNativeControl],      input[matNativeControl], textarea[matNativeControl]", inputs: ["disabled", "id", "placeholder", "name", "required", "type", "errorStateMatcher", "aria-describedby", "value", "readonly"], exportAs: ["matInput"] }, { kind: "component", type: i8.MatFormField, selector: "mat-form-field", inputs: ["hideRequiredMarker", "color", "floatLabel", "appearance", "subscriptSizing", "hintLabel"], exportAs: ["matFormField"] }, { kind: "directive", type: i8.MatLabel, selector: "mat-label" }, { kind: "directive", type: i8.MatPrefix, selector: "[matPrefix], [matIconPrefix], [matTextPrefix]", inputs: ["matTextPrefix"] }, { kind: "directive", type: i8.MatSuffix, selector: "[matSuffix], [matIconSuffix], [matTextSuffix]", inputs: ["matTextSuffix"] }, { kind: "ngmodule", type: MatFormFieldModule }, { kind: "ngmodule", type: MatProgressSpinnerModule }, { kind: "component", type: i9.MatProgressSpinner, selector: "mat-progress-spinner, mat-spinner", inputs: ["color", "mode", "value", "diameter", "strokeWidth"], exportAs: ["matProgressSpinner"] }, { kind: "ngmodule", type: MatDatepickerModule }, { kind: "component", type: i10.MatDatepicker, selector: "mat-datepicker", exportAs: ["matDatepicker"] }, { kind: "directive", type: i10.MatDatepickerInput, selector: "input[matDatepicker]", inputs: ["matDatepicker", "min", "max", "matDatepickerFilter"], exportAs: ["matDatepickerInput"] }, { kind: "component", type: i10.MatDatepickerToggle, selector: "mat-datepicker-toggle", inputs: ["for", "tabIndex", "aria-label", "disabled", "disableRipple"], exportAs: ["matDatepickerToggle"] }, { kind: "ngmodule", type: MatNativeDateModule }] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: SearchPanelComponent, decorators: [{
            type: Component,
            args: [{ selector: 'app-search-panel', standalone: true, imports: [
                        CommonModule,
                        FormsModule,
                        MatIconModule,
                        MatButtonModule,
                        MatInputModule,
                        MatFormFieldModule,
                        MatProgressSpinnerModule,
                        MatDatepickerModule,
                        MatNativeDateModule
                    ], template: `
    <div class="search-panel">
      <div class="search-header">
        <h3>Search Messages</h3>
        <button mat-icon-button (click)="onClose()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="search-input-container">
        <mat-form-field appearance="outline" class="search-field">
          <mat-icon matPrefix>search</mat-icon>
          <input 
            matInput 
            [(ngModel)]="query" 
            (ngModelChange)="onQueryChange()"
            placeholder="Search messages..."
          />
          <button mat-icon-button matSuffix *ngIf="query" (click)="clearSearch()">
            <mat-icon>clear</mat-icon>
          </button>
        </mat-form-field>

        <button mat-button (click)="showFilters = !showFilters">
          <mat-icon>filter_list</mat-icon>
          Filters
        </button>
      </div>

      <div class="filters" *ngIf="showFilters">
        <mat-form-field appearance="outline">
          <mat-label>From User</mat-label>
          <input matInput [(ngModel)]="filters.user_id" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Date From</mat-label>
          <input matInput [matDatepicker]="pickerFrom" [(ngModel)]="filters.date_from" />
          <mat-datepicker-toggle matSuffix [for]="pickerFrom"></mat-datepicker-toggle>
          <mat-datepicker #pickerFrom></mat-datepicker>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Date To</mat-label>
          <input matInput [matDatepicker]="pickerTo" [(ngModel)]="filters.date_to" />
          <mat-datepicker-toggle matSuffix [for]="pickerTo"></mat-datepicker-toggle>
          <mat-datepicker #pickerTo></mat-datepicker>
        </mat-form-field>
      </div>

      <div class="search-results">
        <div *ngIf="loading" class="loading">
          <mat-spinner diameter="40"></mat-spinner>
        </div>

        <div *ngIf="!loading && results.length === 0 && query" class="no-results">
          No messages found
        </div>

        <div *ngFor="let msg of results" class="result-item" (click)="selectMessage(msg)">
          <div class="result-header">
            <strong>{{ msg.sender_name || 'Unknown' }}</strong>
            <span class="timestamp">{{ formatDate(msg.created_at) }}</span>
          </div>
          <div class="result-content" [innerHTML]="highlightQuery(msg.content || '')"></div>
        </div>
      </div>
    </div>
  `, styles: [".search-panel{display:flex;flex-direction:column;height:100%;background:#fff}.search-header{display:flex;justify-content:space-between;align-items:center;padding:16px;border-bottom:1px solid #e0e0e0}.search-header h3{margin:0;font-size:18px;font-weight:500}.search-input-container{padding:16px;border-bottom:1px solid #e0e0e0}.search-field{width:100%;margin-bottom:8px}.filters{padding:16px;background:#f5f5f5;display:flex;flex-direction:column;gap:12px}.search-results{flex:1;overflow-y:auto;padding:16px}.loading{display:flex;justify-content:center;padding:32px}.no-results{text-align:center;color:#666;padding:32px}.result-item{padding:12px;border-bottom:1px solid #e0e0e0;cursor:pointer;transition:background .2s}.result-item:hover{background:#f5f5f5}.result-header{display:flex;justify-content:space-between;margin-bottom:4px;font-size:14px}.timestamp{color:#666;font-size:12px}.result-content{font-size:14px;color:#333;line-height:1.4}.result-content ::ng-deep mark{background-color:#ffeb3b;padding:2px 4px;border-radius:2px}\n"] }]
        }], ctorParameters: () => [{ type: i1.MessagingApiService }, { type: i2.AuthService }], propDecorators: { close: [{
                type: Output
            }], messageSelected: [{
                type: Output
            }] } });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VhcmNoLXBhbmVsLmNvbXBvbmVudC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9saWIvY29tcG9uZW50cy9zZWFyY2gtcGFuZWwvc2VhcmNoLXBhbmVsLmNvbXBvbmVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sRUFBRSxZQUFZLEVBQUUsTUFBTSxlQUFlLENBQUM7QUFDaEUsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBQy9DLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxnQkFBZ0IsQ0FBQztBQUM3QyxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sd0JBQXdCLENBQUM7QUFDdkQsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBQzNELE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSx5QkFBeUIsQ0FBQztBQUN6RCxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSw4QkFBOEIsQ0FBQztBQUNsRSxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUM5RSxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSw4QkFBOEIsQ0FBQztBQUNuRSxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSx3QkFBd0IsQ0FBQztBQUk3RCxPQUFPLEVBQUUsWUFBWSxFQUFFLE9BQU8sRUFBRSxNQUFNLE1BQU0sQ0FBQzs7Ozs7Ozs7Ozs7O0FBbUw3QyxNQUFNLE9BQU8sb0JBQW9CO0lBYXJCO0lBQ0E7SUFiQSxLQUFLLEdBQUcsSUFBSSxZQUFZLEVBQVEsQ0FBQztJQUNqQyxlQUFlLEdBQUcsSUFBSSxZQUFZLEVBQVcsQ0FBQztJQUV4RCxLQUFLLEdBQUcsRUFBRSxDQUFDO0lBQ1gsT0FBTyxHQUEwQixFQUFFLENBQUM7SUFDcEMsV0FBVyxHQUFHLEtBQUssQ0FBQztJQUNwQixPQUFPLEdBQWMsRUFBRSxDQUFDO0lBQ3hCLE9BQU8sR0FBRyxLQUFLLENBQUM7SUFFUixhQUFhLEdBQUcsSUFBSSxPQUFPLEVBQVUsQ0FBQztJQUU5QyxZQUNVLEdBQXdCLEVBQ3hCLElBQWlCO1FBRGpCLFFBQUcsR0FBSCxHQUFHLENBQXFCO1FBQ3hCLFNBQUksR0FBSixJQUFJLENBQWE7UUFFekIsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLEdBQUcsRUFBRTtZQUN4RCxJQUFJLENBQUMsYUFBYSxFQUFFLENBQUM7UUFDdkIsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQsYUFBYTtRQUNYLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUN0QyxDQUFDO0lBRUQsYUFBYTtRQUNYLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUM7WUFDdkIsSUFBSSxDQUFDLE9BQU8sR0FBRyxFQUFFLENBQUM7WUFDbEIsT0FBTztRQUNULENBQUM7UUFFRCxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQztRQUN0QyxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDZixJQUFJLENBQUMsT0FBTyxHQUFHLEtBQUssQ0FBQztZQUNyQixPQUFPO1FBQ1QsQ0FBQztRQUVELElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDO1FBQ3BCLE1BQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsZUFBZSxFQUFFLFFBQVEsRUFBRSxDQUFDO1FBQ2hFLElBQUksQ0FBQyxHQUFHLENBQUMsY0FBYyxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsS0FBSyxFQUFFLGNBQWMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztZQUN2RSxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUUsRUFBRTtnQkFDakIsSUFBSSxDQUFDLE9BQU8sR0FBRyxRQUFRLENBQUM7Z0JBQ3hCLElBQUksQ0FBQyxPQUFPLEdBQUcsS0FBSyxDQUFDO1lBQ3ZCLENBQUM7WUFDRCxLQUFLLEVBQUUsR0FBRyxFQUFFO2dCQUNWLElBQUksQ0FBQyxPQUFPLEdBQUcsS0FBSyxDQUFDO1lBQ3ZCLENBQUM7U0FDRixDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQsV0FBVztRQUNULElBQUksQ0FBQyxLQUFLLEdBQUcsRUFBRSxDQUFDO1FBQ2hCLElBQUksQ0FBQyxPQUFPLEdBQUcsRUFBRSxDQUFDO0lBQ3BCLENBQUM7SUFFRCxhQUFhLENBQUMsR0FBWTtRQUN4QixJQUFJLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUNqQyxDQUFDO0lBRUQsT0FBTztRQUNMLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLENBQUM7SUFDcEIsQ0FBQztJQUVELFVBQVUsQ0FBQyxTQUFpQjtRQUMxQixNQUFNLElBQUksR0FBRyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUNqQyxPQUFPLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxPQUFPLEVBQUU7WUFDdEMsS0FBSyxFQUFFLE9BQU87WUFDZCxHQUFHLEVBQUUsU0FBUztZQUNkLElBQUksRUFBRSxTQUFTO1lBQ2YsTUFBTSxFQUFFLFNBQVM7U0FDbEIsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVELGNBQWMsQ0FBQyxJQUFZO1FBQ3pCLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSztZQUFFLE9BQU8sSUFBSSxDQUFDO1FBQzdCLE1BQU0sS0FBSyxHQUFHLElBQUksTUFBTSxDQUFDLElBQUksSUFBSSxDQUFDLEtBQUssR0FBRyxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ2xELE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsaUJBQWlCLENBQUMsQ0FBQztJQUNoRCxDQUFDO3dHQTdFVSxvQkFBb0I7NEZBQXBCLG9CQUFvQiw2SUFuS3JCOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQW9FVCxrbENBOUVDLFlBQVksK1BBQ1osV0FBVyw4bUJBQ1gsYUFBYSxtTEFDYixlQUFlLHdVQUNmLGNBQWMsdzNCQUNkLGtCQUFrQiw4QkFDbEIsd0JBQXdCLGtPQUN4QixtQkFBbUIsb2dCQUNuQixtQkFBbUI7OzRGQXFLVixvQkFBb0I7a0JBakxoQyxTQUFTOytCQUNFLGtCQUFrQixjQUNoQixJQUFJLFdBQ1A7d0JBQ1AsWUFBWTt3QkFDWixXQUFXO3dCQUNYLGFBQWE7d0JBQ2IsZUFBZTt3QkFDZixjQUFjO3dCQUNkLGtCQUFrQjt3QkFDbEIsd0JBQXdCO3dCQUN4QixtQkFBbUI7d0JBQ25CLG1CQUFtQjtxQkFDcEIsWUFDUzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7R0FvRVQ7a0hBZ0dTLEtBQUs7c0JBQWQsTUFBTTtnQkFDRyxlQUFlO3NCQUF4QixNQUFNIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQ29tcG9uZW50LCBPdXRwdXQsIEV2ZW50RW1pdHRlciB9IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xuaW1wb3J0IHsgQ29tbW9uTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvY29tbW9uJztcbmltcG9ydCB7IEZvcm1zTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvZm9ybXMnO1xuaW1wb3J0IHsgTWF0SWNvbk1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL21hdGVyaWFsL2ljb24nO1xuaW1wb3J0IHsgTWF0QnV0dG9uTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvbWF0ZXJpYWwvYnV0dG9uJztcbmltcG9ydCB7IE1hdElucHV0TW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvbWF0ZXJpYWwvaW5wdXQnO1xuaW1wb3J0IHsgTWF0Rm9ybUZpZWxkTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvbWF0ZXJpYWwvZm9ybS1maWVsZCc7XG5pbXBvcnQgeyBNYXRQcm9ncmVzc1NwaW5uZXJNb2R1bGUgfSBmcm9tICdAYW5ndWxhci9tYXRlcmlhbC9wcm9ncmVzcy1zcGlubmVyJztcbmltcG9ydCB7IE1hdERhdGVwaWNrZXJNb2R1bGUgfSBmcm9tICdAYW5ndWxhci9tYXRlcmlhbC9kYXRlcGlja2VyJztcbmltcG9ydCB7IE1hdE5hdGl2ZURhdGVNb2R1bGUgfSBmcm9tICdAYW5ndWxhci9tYXRlcmlhbC9jb3JlJztcbmltcG9ydCB7IE1lc3NhZ2UsIFNlYXJjaEZpbHRlciB9IGZyb20gJy4uLy4uL21vZGVscy9tZXNzYWdpbmcubW9kZWxzJztcbmltcG9ydCB7IE1lc3NhZ2luZ0FwaVNlcnZpY2UgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9tZXNzYWdpbmctYXBpLnNlcnZpY2UnO1xuaW1wb3J0IHsgQXV0aFNlcnZpY2UgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9hdXRoLnNlcnZpY2UnO1xuaW1wb3J0IHsgZGVib3VuY2VUaW1lLCBTdWJqZWN0IH0gZnJvbSAncnhqcyc7XG5cbkBDb21wb25lbnQoe1xuICBzZWxlY3RvcjogJ2FwcC1zZWFyY2gtcGFuZWwnLFxuICBzdGFuZGFsb25lOiB0cnVlLFxuICBpbXBvcnRzOiBbXG4gICAgQ29tbW9uTW9kdWxlLCBcbiAgICBGb3Jtc01vZHVsZSwgXG4gICAgTWF0SWNvbk1vZHVsZSwgXG4gICAgTWF0QnV0dG9uTW9kdWxlLCBcbiAgICBNYXRJbnB1dE1vZHVsZSxcbiAgICBNYXRGb3JtRmllbGRNb2R1bGUsXG4gICAgTWF0UHJvZ3Jlc3NTcGlubmVyTW9kdWxlLFxuICAgIE1hdERhdGVwaWNrZXJNb2R1bGUsXG4gICAgTWF0TmF0aXZlRGF0ZU1vZHVsZVxuICBdLFxuICB0ZW1wbGF0ZTogYFxuICAgIDxkaXYgY2xhc3M9XCJzZWFyY2gtcGFuZWxcIj5cbiAgICAgIDxkaXYgY2xhc3M9XCJzZWFyY2gtaGVhZGVyXCI+XG4gICAgICAgIDxoMz5TZWFyY2ggTWVzc2FnZXM8L2gzPlxuICAgICAgICA8YnV0dG9uIG1hdC1pY29uLWJ1dHRvbiAoY2xpY2spPVwib25DbG9zZSgpXCI+XG4gICAgICAgICAgPG1hdC1pY29uPmNsb3NlPC9tYXQtaWNvbj5cbiAgICAgICAgPC9idXR0b24+XG4gICAgICA8L2Rpdj5cblxuICAgICAgPGRpdiBjbGFzcz1cInNlYXJjaC1pbnB1dC1jb250YWluZXJcIj5cbiAgICAgICAgPG1hdC1mb3JtLWZpZWxkIGFwcGVhcmFuY2U9XCJvdXRsaW5lXCIgY2xhc3M9XCJzZWFyY2gtZmllbGRcIj5cbiAgICAgICAgICA8bWF0LWljb24gbWF0UHJlZml4PnNlYXJjaDwvbWF0LWljb24+XG4gICAgICAgICAgPGlucHV0IFxuICAgICAgICAgICAgbWF0SW5wdXQgXG4gICAgICAgICAgICBbKG5nTW9kZWwpXT1cInF1ZXJ5XCIgXG4gICAgICAgICAgICAobmdNb2RlbENoYW5nZSk9XCJvblF1ZXJ5Q2hhbmdlKClcIlxuICAgICAgICAgICAgcGxhY2Vob2xkZXI9XCJTZWFyY2ggbWVzc2FnZXMuLi5cIlxuICAgICAgICAgIC8+XG4gICAgICAgICAgPGJ1dHRvbiBtYXQtaWNvbi1idXR0b24gbWF0U3VmZml4ICpuZ0lmPVwicXVlcnlcIiAoY2xpY2spPVwiY2xlYXJTZWFyY2goKVwiPlxuICAgICAgICAgICAgPG1hdC1pY29uPmNsZWFyPC9tYXQtaWNvbj5cbiAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgPC9tYXQtZm9ybS1maWVsZD5cblxuICAgICAgICA8YnV0dG9uIG1hdC1idXR0b24gKGNsaWNrKT1cInNob3dGaWx0ZXJzID0gIXNob3dGaWx0ZXJzXCI+XG4gICAgICAgICAgPG1hdC1pY29uPmZpbHRlcl9saXN0PC9tYXQtaWNvbj5cbiAgICAgICAgICBGaWx0ZXJzXG4gICAgICAgIDwvYnV0dG9uPlxuICAgICAgPC9kaXY+XG5cbiAgICAgIDxkaXYgY2xhc3M9XCJmaWx0ZXJzXCIgKm5nSWY9XCJzaG93RmlsdGVyc1wiPlxuICAgICAgICA8bWF0LWZvcm0tZmllbGQgYXBwZWFyYW5jZT1cIm91dGxpbmVcIj5cbiAgICAgICAgICA8bWF0LWxhYmVsPkZyb20gVXNlcjwvbWF0LWxhYmVsPlxuICAgICAgICAgIDxpbnB1dCBtYXRJbnB1dCBbKG5nTW9kZWwpXT1cImZpbHRlcnMudXNlcl9pZFwiIC8+XG4gICAgICAgIDwvbWF0LWZvcm0tZmllbGQ+XG5cbiAgICAgICAgPG1hdC1mb3JtLWZpZWxkIGFwcGVhcmFuY2U9XCJvdXRsaW5lXCI+XG4gICAgICAgICAgPG1hdC1sYWJlbD5EYXRlIEZyb208L21hdC1sYWJlbD5cbiAgICAgICAgICA8aW5wdXQgbWF0SW5wdXQgW21hdERhdGVwaWNrZXJdPVwicGlja2VyRnJvbVwiIFsobmdNb2RlbCldPVwiZmlsdGVycy5kYXRlX2Zyb21cIiAvPlxuICAgICAgICAgIDxtYXQtZGF0ZXBpY2tlci10b2dnbGUgbWF0U3VmZml4IFtmb3JdPVwicGlja2VyRnJvbVwiPjwvbWF0LWRhdGVwaWNrZXItdG9nZ2xlPlxuICAgICAgICAgIDxtYXQtZGF0ZXBpY2tlciAjcGlja2VyRnJvbT48L21hdC1kYXRlcGlja2VyPlxuICAgICAgICA8L21hdC1mb3JtLWZpZWxkPlxuXG4gICAgICAgIDxtYXQtZm9ybS1maWVsZCBhcHBlYXJhbmNlPVwib3V0bGluZVwiPlxuICAgICAgICAgIDxtYXQtbGFiZWw+RGF0ZSBUbzwvbWF0LWxhYmVsPlxuICAgICAgICAgIDxpbnB1dCBtYXRJbnB1dCBbbWF0RGF0ZXBpY2tlcl09XCJwaWNrZXJUb1wiIFsobmdNb2RlbCldPVwiZmlsdGVycy5kYXRlX3RvXCIgLz5cbiAgICAgICAgICA8bWF0LWRhdGVwaWNrZXItdG9nZ2xlIG1hdFN1ZmZpeCBbZm9yXT1cInBpY2tlclRvXCI+PC9tYXQtZGF0ZXBpY2tlci10b2dnbGU+XG4gICAgICAgICAgPG1hdC1kYXRlcGlja2VyICNwaWNrZXJUbz48L21hdC1kYXRlcGlja2VyPlxuICAgICAgICA8L21hdC1mb3JtLWZpZWxkPlxuICAgICAgPC9kaXY+XG5cbiAgICAgIDxkaXYgY2xhc3M9XCJzZWFyY2gtcmVzdWx0c1wiPlxuICAgICAgICA8ZGl2ICpuZ0lmPVwibG9hZGluZ1wiIGNsYXNzPVwibG9hZGluZ1wiPlxuICAgICAgICAgIDxtYXQtc3Bpbm5lciBkaWFtZXRlcj1cIjQwXCI+PC9tYXQtc3Bpbm5lcj5cbiAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgPGRpdiAqbmdJZj1cIiFsb2FkaW5nICYmIHJlc3VsdHMubGVuZ3RoID09PSAwICYmIHF1ZXJ5XCIgY2xhc3M9XCJuby1yZXN1bHRzXCI+XG4gICAgICAgICAgTm8gbWVzc2FnZXMgZm91bmRcbiAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgPGRpdiAqbmdGb3I9XCJsZXQgbXNnIG9mIHJlc3VsdHNcIiBjbGFzcz1cInJlc3VsdC1pdGVtXCIgKGNsaWNrKT1cInNlbGVjdE1lc3NhZ2UobXNnKVwiPlxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJyZXN1bHQtaGVhZGVyXCI+XG4gICAgICAgICAgICA8c3Ryb25nPnt7IG1zZy5zZW5kZXJfbmFtZSB8fCAnVW5rbm93bicgfX08L3N0cm9uZz5cbiAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwidGltZXN0YW1wXCI+e3sgZm9ybWF0RGF0ZShtc2cuY3JlYXRlZF9hdCkgfX08L3NwYW4+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cInJlc3VsdC1jb250ZW50XCIgW2lubmVySFRNTF09XCJoaWdobGlnaHRRdWVyeShtc2cuY29udGVudCB8fCAnJylcIj48L2Rpdj5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5cbiAgYCxcbiAgc3R5bGVzOiBbYFxuICAgIC5zZWFyY2gtcGFuZWwge1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAgICBoZWlnaHQ6IDEwMCU7XG4gICAgICBiYWNrZ3JvdW5kOiB3aGl0ZTtcbiAgICB9XG5cbiAgICAuc2VhcmNoLWhlYWRlciB7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAganVzdGlmeS1jb250ZW50OiBzcGFjZS1iZXR3ZWVuO1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIHBhZGRpbmc6IDE2cHg7XG4gICAgICBib3JkZXItYm90dG9tOiAxcHggc29saWQgI2UwZTBlMDtcbiAgICB9XG5cbiAgICAuc2VhcmNoLWhlYWRlciBoMyB7XG4gICAgICBtYXJnaW46IDA7XG4gICAgICBmb250LXNpemU6IDE4cHg7XG4gICAgICBmb250LXdlaWdodDogNTAwO1xuICAgIH1cblxuICAgIC5zZWFyY2gtaW5wdXQtY29udGFpbmVyIHtcbiAgICAgIHBhZGRpbmc6IDE2cHg7XG4gICAgICBib3JkZXItYm90dG9tOiAxcHggc29saWQgI2UwZTBlMDtcbiAgICB9XG5cbiAgICAuc2VhcmNoLWZpZWxkIHtcbiAgICAgIHdpZHRoOiAxMDAlO1xuICAgICAgbWFyZ2luLWJvdHRvbTogOHB4O1xuICAgIH1cblxuICAgIC5maWx0ZXJzIHtcbiAgICAgIHBhZGRpbmc6IDE2cHg7XG4gICAgICBiYWNrZ3JvdW5kOiAjZjVmNWY1O1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAgICBnYXA6IDEycHg7XG4gICAgfVxuXG4gICAgLnNlYXJjaC1yZXN1bHRzIHtcbiAgICAgIGZsZXg6IDE7XG4gICAgICBvdmVyZmxvdy15OiBhdXRvO1xuICAgICAgcGFkZGluZzogMTZweDtcbiAgICB9XG5cbiAgICAubG9hZGluZyB7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgICBwYWRkaW5nOiAzMnB4O1xuICAgIH1cblxuICAgIC5uby1yZXN1bHRzIHtcbiAgICAgIHRleHQtYWxpZ246IGNlbnRlcjtcbiAgICAgIGNvbG9yOiAjNjY2O1xuICAgICAgcGFkZGluZzogMzJweDtcbiAgICB9XG5cbiAgICAucmVzdWx0LWl0ZW0ge1xuICAgICAgcGFkZGluZzogMTJweDtcbiAgICAgIGJvcmRlci1ib3R0b206IDFweCBzb2xpZCAjZTBlMGUwO1xuICAgICAgY3Vyc29yOiBwb2ludGVyO1xuICAgICAgdHJhbnNpdGlvbjogYmFja2dyb3VuZCAwLjJzO1xuICAgIH1cblxuICAgIC5yZXN1bHQtaXRlbTpob3ZlciB7XG4gICAgICBiYWNrZ3JvdW5kOiAjZjVmNWY1O1xuICAgIH1cblxuICAgIC5yZXN1bHQtaGVhZGVyIHtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWJldHdlZW47XG4gICAgICBtYXJnaW4tYm90dG9tOiA0cHg7XG4gICAgICBmb250LXNpemU6IDE0cHg7XG4gICAgfVxuXG4gICAgLnRpbWVzdGFtcCB7XG4gICAgICBjb2xvcjogIzY2NjtcbiAgICAgIGZvbnQtc2l6ZTogMTJweDtcbiAgICB9XG5cbiAgICAucmVzdWx0LWNvbnRlbnQge1xuICAgICAgZm9udC1zaXplOiAxNHB4O1xuICAgICAgY29sb3I6ICMzMzM7XG4gICAgICBsaW5lLWhlaWdodDogMS40O1xuICAgIH1cblxuICAgIC5yZXN1bHQtY29udGVudCA6Om5nLWRlZXAgbWFyayB7XG4gICAgICBiYWNrZ3JvdW5kLWNvbG9yOiAjZmZlYjNiO1xuICAgICAgcGFkZGluZzogMnB4IDRweDtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDJweDtcbiAgICB9XG4gIGBdXG59KVxuZXhwb3J0IGNsYXNzIFNlYXJjaFBhbmVsQ29tcG9uZW50IHtcbiAgQE91dHB1dCgpIGNsb3NlID0gbmV3IEV2ZW50RW1pdHRlcjx2b2lkPigpO1xuICBAT3V0cHV0KCkgbWVzc2FnZVNlbGVjdGVkID0gbmV3IEV2ZW50RW1pdHRlcjxNZXNzYWdlPigpO1xuXG4gIHF1ZXJ5ID0gJyc7XG4gIGZpbHRlcnM6IFBhcnRpYWw8U2VhcmNoRmlsdGVyPiA9IHt9O1xuICBzaG93RmlsdGVycyA9IGZhbHNlO1xuICByZXN1bHRzOiBNZXNzYWdlW10gPSBbXTtcbiAgbG9hZGluZyA9IGZhbHNlO1xuXG4gIHByaXZhdGUgc2VhcmNoU3ViamVjdCA9IG5ldyBTdWJqZWN0PHN0cmluZz4oKTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIGFwaTogTWVzc2FnaW5nQXBpU2VydmljZSxcbiAgICBwcml2YXRlIGF1dGg6IEF1dGhTZXJ2aWNlXG4gICkge1xuICAgIHRoaXMuc2VhcmNoU3ViamVjdC5waXBlKGRlYm91bmNlVGltZSgzMDApKS5zdWJzY3JpYmUoKCkgPT4ge1xuICAgICAgdGhpcy5wZXJmb3JtU2VhcmNoKCk7XG4gICAgfSk7XG4gIH1cblxuICBvblF1ZXJ5Q2hhbmdlKCkge1xuICAgIHRoaXMuc2VhcmNoU3ViamVjdC5uZXh0KHRoaXMucXVlcnkpO1xuICB9XG5cbiAgcGVyZm9ybVNlYXJjaCgpIHtcbiAgICBpZiAoIXRoaXMucXVlcnkudHJpbSgpKSB7XG4gICAgICB0aGlzLnJlc3VsdHMgPSBbXTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBjb250YWN0SWQgPSB0aGlzLmF1dGguY29udGFjdElkO1xuICAgIGlmICghY29udGFjdElkKSB7XG4gICAgICB0aGlzLmxvYWRpbmcgPSBmYWxzZTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLmxvYWRpbmcgPSB0cnVlO1xuICAgIGNvbnN0IGNvbnZlcnNhdGlvbklkID0gdGhpcy5maWx0ZXJzLmNvbnZlcnNhdGlvbl9pZD8udG9TdHJpbmcoKTtcbiAgICB0aGlzLmFwaS5zZWFyY2hNZXNzYWdlcyhjb250YWN0SWQsIHRoaXMucXVlcnksIGNvbnZlcnNhdGlvbklkKS5zdWJzY3JpYmUoe1xuICAgICAgbmV4dDogKG1lc3NhZ2VzKSA9PiB7XG4gICAgICAgIHRoaXMucmVzdWx0cyA9IG1lc3NhZ2VzO1xuICAgICAgICB0aGlzLmxvYWRpbmcgPSBmYWxzZTtcbiAgICAgIH0sXG4gICAgICBlcnJvcjogKCkgPT4ge1xuICAgICAgICB0aGlzLmxvYWRpbmcgPSBmYWxzZTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIGNsZWFyU2VhcmNoKCkge1xuICAgIHRoaXMucXVlcnkgPSAnJztcbiAgICB0aGlzLnJlc3VsdHMgPSBbXTtcbiAgfVxuXG4gIHNlbGVjdE1lc3NhZ2UobXNnOiBNZXNzYWdlKSB7XG4gICAgdGhpcy5tZXNzYWdlU2VsZWN0ZWQuZW1pdChtc2cpO1xuICB9XG5cbiAgb25DbG9zZSgpIHtcbiAgICB0aGlzLmNsb3NlLmVtaXQoKTtcbiAgfVxuXG4gIGZvcm1hdERhdGUodGltZXN0YW1wOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIGNvbnN0IGRhdGUgPSBuZXcgRGF0ZSh0aW1lc3RhbXApO1xuICAgIHJldHVybiBkYXRlLnRvTG9jYWxlRGF0ZVN0cmluZygnZW4tVVMnLCB7IFxuICAgICAgbW9udGg6ICdzaG9ydCcsIFxuICAgICAgZGF5OiAnbnVtZXJpYycsXG4gICAgICBob3VyOiAnbnVtZXJpYycsXG4gICAgICBtaW51dGU6ICcyLWRpZ2l0J1xuICAgIH0pO1xuICB9XG5cbiAgaGlnaGxpZ2h0UXVlcnkodGV4dDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBpZiAoIXRoaXMucXVlcnkpIHJldHVybiB0ZXh0O1xuICAgIGNvbnN0IHJlZ2V4ID0gbmV3IFJlZ0V4cChgKCR7dGhpcy5xdWVyeX0pYCwgJ2dpJyk7XG4gICAgcmV0dXJuIHRleHQucmVwbGFjZShyZWdleCwgJzxtYXJrPiQxPC9tYXJrPicpO1xuICB9XG59XG4iXX0=