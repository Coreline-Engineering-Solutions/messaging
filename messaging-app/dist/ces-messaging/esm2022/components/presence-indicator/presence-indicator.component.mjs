import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTooltipModule } from '@angular/material/tooltip';
import * as i0 from "@angular/core";
import * as i1 from "@angular/material/tooltip";
export class PresenceIndicatorComponent {
    status = 'offline';
    lastSeen;
    customStatus;
    getTooltip() {
        if (this.customStatus)
            return this.customStatus;
        switch (this.status) {
            case 'online': return 'Online';
            case 'away': return 'Away';
            case 'busy': return 'Busy';
            case 'offline':
                if (this.lastSeen) {
                    return `Last seen ${this.formatLastSeen(this.lastSeen)}`;
                }
                return 'Offline';
            default: return '';
        }
    }
    formatLastSeen(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / (1000 * 60));
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        if (minutes < 1)
            return 'just now';
        if (minutes < 60)
            return `${minutes}m ago`;
        if (hours < 24)
            return `${hours}h ago`;
        if (days < 7)
            return `${days}d ago`;
        return date.toLocaleDateString();
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: PresenceIndicatorComponent, deps: [], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "17.3.12", type: PresenceIndicatorComponent, isStandalone: true, selector: "app-presence-indicator", inputs: { status: "status", lastSeen: "lastSeen", customStatus: "customStatus" }, ngImport: i0, template: `
    <div 
      class="presence-indicator" 
      [class.online]="status === 'online'"
      [class.away]="status === 'away'"
      [class.busy]="status === 'busy'"
      [class.offline]="status === 'offline'"
      [matTooltip]="getTooltip()"
    ></div>
  `, isInline: true, styles: [".presence-indicator{width:10px;height:10px;border-radius:50%;border:2px solid white;position:absolute;bottom:0;right:0}.presence-indicator.online{background-color:#4caf50}.presence-indicator.away{background-color:#ff9800}.presence-indicator.busy{background-color:#f44336}.presence-indicator.offline{background-color:#9e9e9e}\n"], dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "ngmodule", type: MatTooltipModule }, { kind: "directive", type: i1.MatTooltip, selector: "[matTooltip]", inputs: ["matTooltipPosition", "matTooltipPositionAtOrigin", "matTooltipDisabled", "matTooltipShowDelay", "matTooltipHideDelay", "matTooltipTouchGestures", "matTooltip", "matTooltipClass"], exportAs: ["matTooltip"] }] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: PresenceIndicatorComponent, decorators: [{
            type: Component,
            args: [{ selector: 'app-presence-indicator', standalone: true, imports: [CommonModule, MatTooltipModule], template: `
    <div 
      class="presence-indicator" 
      [class.online]="status === 'online'"
      [class.away]="status === 'away'"
      [class.busy]="status === 'busy'"
      [class.offline]="status === 'offline'"
      [matTooltip]="getTooltip()"
    ></div>
  `, styles: [".presence-indicator{width:10px;height:10px;border-radius:50%;border:2px solid white;position:absolute;bottom:0;right:0}.presence-indicator.online{background-color:#4caf50}.presence-indicator.away{background-color:#ff9800}.presence-indicator.busy{background-color:#f44336}.presence-indicator.offline{background-color:#9e9e9e}\n"] }]
        }], propDecorators: { status: [{
                type: Input
            }], lastSeen: [{
                type: Input
            }], customStatus: [{
                type: Input
            }] } });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJlc2VuY2UtaW5kaWNhdG9yLmNvbXBvbmVudC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9saWIvY29tcG9uZW50cy9wcmVzZW5jZS1pbmRpY2F0b3IvcHJlc2VuY2UtaW5kaWNhdG9yLmNvbXBvbmVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsU0FBUyxFQUFFLEtBQUssRUFBRSxNQUFNLGVBQWUsQ0FBQztBQUNqRCxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDL0MsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sMkJBQTJCLENBQUM7OztBQTRDN0QsTUFBTSxPQUFPLDBCQUEwQjtJQUM1QixNQUFNLEdBQTJDLFNBQVMsQ0FBQztJQUMzRCxRQUFRLENBQVU7SUFDbEIsWUFBWSxDQUFVO0lBRS9CLFVBQVU7UUFDUixJQUFJLElBQUksQ0FBQyxZQUFZO1lBQUUsT0FBTyxJQUFJLENBQUMsWUFBWSxDQUFDO1FBRWhELFFBQVEsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQ3BCLEtBQUssUUFBUSxDQUFDLENBQUMsT0FBTyxRQUFRLENBQUM7WUFDL0IsS0FBSyxNQUFNLENBQUMsQ0FBQyxPQUFPLE1BQU0sQ0FBQztZQUMzQixLQUFLLE1BQU0sQ0FBQyxDQUFDLE9BQU8sTUFBTSxDQUFDO1lBQzNCLEtBQUssU0FBUztnQkFDWixJQUFJLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztvQkFDbEIsT0FBTyxhQUFhLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUM7Z0JBQzNELENBQUM7Z0JBQ0QsT0FBTyxTQUFTLENBQUM7WUFDbkIsT0FBTyxDQUFDLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDckIsQ0FBQztJQUNILENBQUM7SUFFRCxjQUFjLENBQUMsU0FBaUI7UUFDOUIsTUFBTSxJQUFJLEdBQUcsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDakMsTUFBTSxHQUFHLEdBQUcsSUFBSSxJQUFJLEVBQUUsQ0FBQztRQUN2QixNQUFNLElBQUksR0FBRyxHQUFHLENBQUMsT0FBTyxFQUFFLEdBQUcsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQzVDLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxHQUFHLENBQUMsSUFBSSxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDL0MsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLEdBQUcsRUFBRSxDQUFDLENBQUM7UUFDdkMsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLEdBQUcsRUFBRSxDQUFDLENBQUM7UUFFcEMsSUFBSSxPQUFPLEdBQUcsQ0FBQztZQUFFLE9BQU8sVUFBVSxDQUFDO1FBQ25DLElBQUksT0FBTyxHQUFHLEVBQUU7WUFBRSxPQUFPLEdBQUcsT0FBTyxPQUFPLENBQUM7UUFDM0MsSUFBSSxLQUFLLEdBQUcsRUFBRTtZQUFFLE9BQU8sR0FBRyxLQUFLLE9BQU8sQ0FBQztRQUN2QyxJQUFJLElBQUksR0FBRyxDQUFDO1lBQUUsT0FBTyxHQUFHLElBQUksT0FBTyxDQUFDO1FBQ3BDLE9BQU8sSUFBSSxDQUFDLGtCQUFrQixFQUFFLENBQUM7SUFDbkMsQ0FBQzt3R0FsQ1UsMEJBQTBCOzRGQUExQiwwQkFBMEIsb0tBdEMzQjs7Ozs7Ozs7O0dBU1QsK1lBVlMsWUFBWSw4QkFBRSxnQkFBZ0I7OzRGQXVDN0IsMEJBQTBCO2tCQTFDdEMsU0FBUzsrQkFDRSx3QkFBd0IsY0FDdEIsSUFBSSxXQUNQLENBQUMsWUFBWSxFQUFFLGdCQUFnQixDQUFDLFlBQy9COzs7Ozs7Ozs7R0FTVDs4QkE4QlEsTUFBTTtzQkFBZCxLQUFLO2dCQUNHLFFBQVE7c0JBQWhCLEtBQUs7Z0JBQ0csWUFBWTtzQkFBcEIsS0FBSyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IENvbXBvbmVudCwgSW5wdXQgfSBmcm9tICdAYW5ndWxhci9jb3JlJztcbmltcG9ydCB7IENvbW1vbk1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL2NvbW1vbic7XG5pbXBvcnQgeyBNYXRUb29sdGlwTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvbWF0ZXJpYWwvdG9vbHRpcCc7XG5cbkBDb21wb25lbnQoe1xuICBzZWxlY3RvcjogJ2FwcC1wcmVzZW5jZS1pbmRpY2F0b3InLFxuICBzdGFuZGFsb25lOiB0cnVlLFxuICBpbXBvcnRzOiBbQ29tbW9uTW9kdWxlLCBNYXRUb29sdGlwTW9kdWxlXSxcbiAgdGVtcGxhdGU6IGBcbiAgICA8ZGl2IFxuICAgICAgY2xhc3M9XCJwcmVzZW5jZS1pbmRpY2F0b3JcIiBcbiAgICAgIFtjbGFzcy5vbmxpbmVdPVwic3RhdHVzID09PSAnb25saW5lJ1wiXG4gICAgICBbY2xhc3MuYXdheV09XCJzdGF0dXMgPT09ICdhd2F5J1wiXG4gICAgICBbY2xhc3MuYnVzeV09XCJzdGF0dXMgPT09ICdidXN5J1wiXG4gICAgICBbY2xhc3Mub2ZmbGluZV09XCJzdGF0dXMgPT09ICdvZmZsaW5lJ1wiXG4gICAgICBbbWF0VG9vbHRpcF09XCJnZXRUb29sdGlwKClcIlxuICAgID48L2Rpdj5cbiAgYCxcbiAgc3R5bGVzOiBbYFxuICAgIC5wcmVzZW5jZS1pbmRpY2F0b3Ige1xuICAgICAgd2lkdGg6IDEwcHg7XG4gICAgICBoZWlnaHQ6IDEwcHg7XG4gICAgICBib3JkZXItcmFkaXVzOiA1MCU7XG4gICAgICBib3JkZXI6IDJweCBzb2xpZCB3aGl0ZTtcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgIGJvdHRvbTogMDtcbiAgICAgIHJpZ2h0OiAwO1xuICAgIH1cblxuICAgIC5wcmVzZW5jZS1pbmRpY2F0b3Iub25saW5lIHtcbiAgICAgIGJhY2tncm91bmQtY29sb3I6ICM0Y2FmNTA7XG4gICAgfVxuXG4gICAgLnByZXNlbmNlLWluZGljYXRvci5hd2F5IHtcbiAgICAgIGJhY2tncm91bmQtY29sb3I6ICNmZjk4MDA7XG4gICAgfVxuXG4gICAgLnByZXNlbmNlLWluZGljYXRvci5idXN5IHtcbiAgICAgIGJhY2tncm91bmQtY29sb3I6ICNmNDQzMzY7XG4gICAgfVxuXG4gICAgLnByZXNlbmNlLWluZGljYXRvci5vZmZsaW5lIHtcbiAgICAgIGJhY2tncm91bmQtY29sb3I6ICM5ZTllOWU7XG4gICAgfVxuICBgXVxufSlcbmV4cG9ydCBjbGFzcyBQcmVzZW5jZUluZGljYXRvckNvbXBvbmVudCB7XG4gIEBJbnB1dCgpIHN0YXR1czogJ29ubGluZScgfCAnb2ZmbGluZScgfCAnYXdheScgfCAnYnVzeScgPSAnb2ZmbGluZSc7XG4gIEBJbnB1dCgpIGxhc3RTZWVuPzogc3RyaW5nO1xuICBASW5wdXQoKSBjdXN0b21TdGF0dXM/OiBzdHJpbmc7XG5cbiAgZ2V0VG9vbHRpcCgpOiBzdHJpbmcge1xuICAgIGlmICh0aGlzLmN1c3RvbVN0YXR1cykgcmV0dXJuIHRoaXMuY3VzdG9tU3RhdHVzO1xuICAgIFxuICAgIHN3aXRjaCAodGhpcy5zdGF0dXMpIHtcbiAgICAgIGNhc2UgJ29ubGluZSc6IHJldHVybiAnT25saW5lJztcbiAgICAgIGNhc2UgJ2F3YXknOiByZXR1cm4gJ0F3YXknO1xuICAgICAgY2FzZSAnYnVzeSc6IHJldHVybiAnQnVzeSc7XG4gICAgICBjYXNlICdvZmZsaW5lJzogXG4gICAgICAgIGlmICh0aGlzLmxhc3RTZWVuKSB7XG4gICAgICAgICAgcmV0dXJuIGBMYXN0IHNlZW4gJHt0aGlzLmZvcm1hdExhc3RTZWVuKHRoaXMubGFzdFNlZW4pfWA7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuICdPZmZsaW5lJztcbiAgICAgIGRlZmF1bHQ6IHJldHVybiAnJztcbiAgICB9XG4gIH1cblxuICBmb3JtYXRMYXN0U2Vlbih0aW1lc3RhbXA6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgY29uc3QgZGF0ZSA9IG5ldyBEYXRlKHRpbWVzdGFtcCk7XG4gICAgY29uc3Qgbm93ID0gbmV3IERhdGUoKTtcbiAgICBjb25zdCBkaWZmID0gbm93LmdldFRpbWUoKSAtIGRhdGUuZ2V0VGltZSgpO1xuICAgIGNvbnN0IG1pbnV0ZXMgPSBNYXRoLmZsb29yKGRpZmYgLyAoMTAwMCAqIDYwKSk7XG4gICAgY29uc3QgaG91cnMgPSBNYXRoLmZsb29yKG1pbnV0ZXMgLyA2MCk7XG4gICAgY29uc3QgZGF5cyA9IE1hdGguZmxvb3IoaG91cnMgLyAyNCk7XG5cbiAgICBpZiAobWludXRlcyA8IDEpIHJldHVybiAnanVzdCBub3cnO1xuICAgIGlmIChtaW51dGVzIDwgNjApIHJldHVybiBgJHttaW51dGVzfW0gYWdvYDtcbiAgICBpZiAoaG91cnMgPCAyNCkgcmV0dXJuIGAke2hvdXJzfWggYWdvYDtcbiAgICBpZiAoZGF5cyA8IDcpIHJldHVybiBgJHtkYXlzfWQgYWdvYDtcbiAgICByZXR1cm4gZGF0ZS50b0xvY2FsZURhdGVTdHJpbmcoKTtcbiAgfVxufVxuIl19