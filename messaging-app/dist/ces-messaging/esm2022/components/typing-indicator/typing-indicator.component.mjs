import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as i0 from "@angular/core";
import * as i1 from "@angular/common";
export class TypingIndicatorComponent {
    typingUsers = [];
    get isTyping() {
        return this.typingUsers.length > 0;
    }
    get typingText() {
        if (this.typingUsers.length === 0)
            return '';
        if (this.typingUsers.length === 1)
            return `${this.typingUsers[0]} is typing`;
        if (this.typingUsers.length === 2)
            return `${this.typingUsers[0]} and ${this.typingUsers[1]} are typing`;
        return `${this.typingUsers.length} people are typing`;
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: TypingIndicatorComponent, deps: [], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "17.3.12", type: TypingIndicatorComponent, isStandalone: true, selector: "app-typing-indicator", inputs: { typingUsers: "typingUsers" }, ngImport: i0, template: `
    <div class="typing-indicator" *ngIf="isTyping">
      <span class="typing-text">{{ typingText }}</span>
      <span class="dots">
        <span class="dot"></span>
        <span class="dot"></span>
        <span class="dot"></span>
      </span>
    </div>
  `, isInline: true, styles: [".typing-indicator{display:flex;align-items:center;padding:8px 16px;font-size:13px;color:#666;gap:8px}.typing-text{font-style:italic}.dots{display:flex;gap:4px}.dot{width:4px;height:4px;background-color:#666;border-radius:50%;animation:typing 1.4s infinite}.dot:nth-child(2){animation-delay:.2s}.dot:nth-child(3){animation-delay:.4s}@keyframes typing{0%,60%,to{opacity:.3;transform:translateY(0)}30%{opacity:1;transform:translateY(-4px)}}\n"], dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i1.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: TypingIndicatorComponent, decorators: [{
            type: Component,
            args: [{ selector: 'app-typing-indicator', standalone: true, imports: [CommonModule], template: `
    <div class="typing-indicator" *ngIf="isTyping">
      <span class="typing-text">{{ typingText }}</span>
      <span class="dots">
        <span class="dot"></span>
        <span class="dot"></span>
        <span class="dot"></span>
      </span>
    </div>
  `, styles: [".typing-indicator{display:flex;align-items:center;padding:8px 16px;font-size:13px;color:#666;gap:8px}.typing-text{font-style:italic}.dots{display:flex;gap:4px}.dot{width:4px;height:4px;background-color:#666;border-radius:50%;animation:typing 1.4s infinite}.dot:nth-child(2){animation-delay:.2s}.dot:nth-child(3){animation-delay:.4s}@keyframes typing{0%,60%,to{opacity:.3;transform:translateY(0)}30%{opacity:1;transform:translateY(-4px)}}\n"] }]
        }], propDecorators: { typingUsers: [{
                type: Input
            }] } });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHlwaW5nLWluZGljYXRvci5jb21wb25lbnQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvbGliL2NvbXBvbmVudHMvdHlwaW5nLWluZGljYXRvci90eXBpbmctaW5kaWNhdG9yLmNvbXBvbmVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsU0FBUyxFQUFFLEtBQUssRUFBRSxNQUFNLGVBQWUsQ0FBQztBQUNqRCxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0saUJBQWlCLENBQUM7OztBQStEL0MsTUFBTSxPQUFPLHdCQUF3QjtJQUMxQixXQUFXLEdBQWEsRUFBRSxDQUFDO0lBRXBDLElBQUksUUFBUTtRQUNWLE9BQU8sSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDO0lBQ3JDLENBQUM7SUFFRCxJQUFJLFVBQVU7UUFDWixJQUFJLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxLQUFLLENBQUM7WUFBRSxPQUFPLEVBQUUsQ0FBQztRQUM3QyxJQUFJLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxLQUFLLENBQUM7WUFBRSxPQUFPLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDO1FBQzdFLElBQUksSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLEtBQUssQ0FBQztZQUFFLE9BQU8sR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxRQUFRLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLGFBQWEsQ0FBQztRQUN6RyxPQUFPLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLG9CQUFvQixDQUFDO0lBQ3hELENBQUM7d0dBWlUsd0JBQXdCOzRGQUF4Qix3QkFBd0Isd0hBekR6Qjs7Ozs7Ozs7O0dBU1QsZ2dCQVZTLFlBQVk7OzRGQTBEWCx3QkFBd0I7a0JBN0RwQyxTQUFTOytCQUNFLHNCQUFzQixjQUNwQixJQUFJLFdBQ1AsQ0FBQyxZQUFZLENBQUMsWUFDYjs7Ozs7Ozs7O0dBU1Q7OEJBaURRLFdBQVc7c0JBQW5CLEtBQUsiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBDb21wb25lbnQsIElucHV0IH0gZnJvbSAnQGFuZ3VsYXIvY29yZSc7XG5pbXBvcnQgeyBDb21tb25Nb2R1bGUgfSBmcm9tICdAYW5ndWxhci9jb21tb24nO1xuXG5AQ29tcG9uZW50KHtcbiAgc2VsZWN0b3I6ICdhcHAtdHlwaW5nLWluZGljYXRvcicsXG4gIHN0YW5kYWxvbmU6IHRydWUsXG4gIGltcG9ydHM6IFtDb21tb25Nb2R1bGVdLFxuICB0ZW1wbGF0ZTogYFxuICAgIDxkaXYgY2xhc3M9XCJ0eXBpbmctaW5kaWNhdG9yXCIgKm5nSWY9XCJpc1R5cGluZ1wiPlxuICAgICAgPHNwYW4gY2xhc3M9XCJ0eXBpbmctdGV4dFwiPnt7IHR5cGluZ1RleHQgfX08L3NwYW4+XG4gICAgICA8c3BhbiBjbGFzcz1cImRvdHNcIj5cbiAgICAgICAgPHNwYW4gY2xhc3M9XCJkb3RcIj48L3NwYW4+XG4gICAgICAgIDxzcGFuIGNsYXNzPVwiZG90XCI+PC9zcGFuPlxuICAgICAgICA8c3BhbiBjbGFzcz1cImRvdFwiPjwvc3Bhbj5cbiAgICAgIDwvc3Bhbj5cbiAgICA8L2Rpdj5cbiAgYCxcbiAgc3R5bGVzOiBbYFxuICAgIC50eXBpbmctaW5kaWNhdG9yIHtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgcGFkZGluZzogOHB4IDE2cHg7XG4gICAgICBmb250LXNpemU6IDEzcHg7XG4gICAgICBjb2xvcjogIzY2NjtcbiAgICAgIGdhcDogOHB4O1xuICAgIH1cblxuICAgIC50eXBpbmctdGV4dCB7XG4gICAgICBmb250LXN0eWxlOiBpdGFsaWM7XG4gICAgfVxuXG4gICAgLmRvdHMge1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGdhcDogNHB4O1xuICAgIH1cblxuICAgIC5kb3Qge1xuICAgICAgd2lkdGg6IDRweDtcbiAgICAgIGhlaWdodDogNHB4O1xuICAgICAgYmFja2dyb3VuZC1jb2xvcjogIzY2NjtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDUwJTtcbiAgICAgIGFuaW1hdGlvbjogdHlwaW5nIDEuNHMgaW5maW5pdGU7XG4gICAgfVxuXG4gICAgLmRvdDpudGgtY2hpbGQoMikge1xuICAgICAgYW5pbWF0aW9uLWRlbGF5OiAwLjJzO1xuICAgIH1cblxuICAgIC5kb3Q6bnRoLWNoaWxkKDMpIHtcbiAgICAgIGFuaW1hdGlvbi1kZWxheTogMC40cztcbiAgICB9XG5cbiAgICBAa2V5ZnJhbWVzIHR5cGluZyB7XG4gICAgICAwJSwgNjAlLCAxMDAlIHtcbiAgICAgICAgb3BhY2l0eTogMC4zO1xuICAgICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoMCk7XG4gICAgICB9XG4gICAgICAzMCUge1xuICAgICAgICBvcGFjaXR5OiAxO1xuICAgICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoLTRweCk7XG4gICAgICB9XG4gICAgfVxuICBgXVxufSlcbmV4cG9ydCBjbGFzcyBUeXBpbmdJbmRpY2F0b3JDb21wb25lbnQge1xuICBASW5wdXQoKSB0eXBpbmdVc2Vyczogc3RyaW5nW10gPSBbXTtcblxuICBnZXQgaXNUeXBpbmcoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMudHlwaW5nVXNlcnMubGVuZ3RoID4gMDtcbiAgfVxuXG4gIGdldCB0eXBpbmdUZXh0KCk6IHN0cmluZyB7XG4gICAgaWYgKHRoaXMudHlwaW5nVXNlcnMubGVuZ3RoID09PSAwKSByZXR1cm4gJyc7XG4gICAgaWYgKHRoaXMudHlwaW5nVXNlcnMubGVuZ3RoID09PSAxKSByZXR1cm4gYCR7dGhpcy50eXBpbmdVc2Vyc1swXX0gaXMgdHlwaW5nYDtcbiAgICBpZiAodGhpcy50eXBpbmdVc2Vycy5sZW5ndGggPT09IDIpIHJldHVybiBgJHt0aGlzLnR5cGluZ1VzZXJzWzBdfSBhbmQgJHt0aGlzLnR5cGluZ1VzZXJzWzFdfSBhcmUgdHlwaW5nYDtcbiAgICByZXR1cm4gYCR7dGhpcy50eXBpbmdVc2Vycy5sZW5ndGh9IHBlb3BsZSBhcmUgdHlwaW5nYDtcbiAgfVxufVxuIl19