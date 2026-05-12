import * as i0 from "@angular/core";
export declare class PresenceIndicatorComponent {
    status: 'online' | 'offline' | 'away' | 'busy';
    lastSeen?: string;
    customStatus?: string;
    getTooltip(): string;
    formatLastSeen(timestamp: string): string;
    static ɵfac: i0.ɵɵFactoryDeclaration<PresenceIndicatorComponent, never>;
    static ɵcmp: i0.ɵɵComponentDeclaration<PresenceIndicatorComponent, "app-presence-indicator", never, { "status": { "alias": "status"; "required": false; }; "lastSeen": { "alias": "lastSeen"; "required": false; }; "customStatus": { "alias": "customStatus"; "required": false; }; }, {}, never, never, true, never>;
}
