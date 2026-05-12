import { Component, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FloatingButtonComponent } from './components/floating-button/floating-button.component';
import { ChatPanelComponent } from './components/chat-panel/chat-panel.component';
import * as i0 from "@angular/core";
import * as i1 from "./services/messaging-store.service";
import * as i2 from "./services/auth.service";
import * as i3 from "@angular/common";
export class MessagingOverlayComponent {
    store;
    auth;
    isAuthenticated = false;
    constructor(store, auth) {
        this.store = store;
        this.auth = auth;
    }
    ngOnInit() {
        // Auto-init messaging session from localStorage
        this.initializeMessagingAuth();
        this.auth.session$.subscribe((session) => {
            this.isAuthenticated = this.auth.isAuthenticated();
            if (this.isAuthenticated) {
                this.store.initialize();
            }
        });
    }
    initializeMessagingAuth() {
        // Check if messaging already authenticated
        if (this.auth.isAuthenticated())
            return;
        // Get session from localStorage (host app session)
        const sessionData = localStorage.getItem('session');
        if (!sessionData) {
            return;
        }
        try {
            const parsed = JSON.parse(sessionData);
            const sessionId = parsed.session_id || parsed.sessionId;
            const email = parsed.email || parsed.user_email;
            const userName = parsed.user_name || parsed.name;
            if (!sessionId || !email) {
                return;
            }
            // Create contact from session data
            const tempContactId = email.split('@')[0];
            const contact = {
                contact_id: tempContactId,
                user_gid: sessionId,
                username: userName || tempContactId,
                first_name: userName?.split(' ')[0],
                last_name: userName?.split(' ').slice(1).join(' '),
                email: email,
                company_name: 'CES',
                is_active: true
            };
            // Set messaging session
            this.auth.setSession(sessionId, contact);
        }
        catch {
        }
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: MessagingOverlayComponent, deps: [{ token: i1.MessagingStoreService }, { token: i2.AuthService }], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "17.3.12", type: MessagingOverlayComponent, isStandalone: true, selector: "app-messaging-overlay", ngImport: i0, template: `
    <ng-container *ngIf="isAuthenticated">
      <app-floating-button></app-floating-button>
      <app-chat-panel></app-chat-panel>
    </ng-container>
  `, isInline: true, styles: [".cdk-overlay-container{z-index:10000!important}.mat-mdc-tooltip{z-index:10001!important}\n"], dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i3.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "component", type: FloatingButtonComponent, selector: "app-floating-button" }, { kind: "component", type: ChatPanelComponent, selector: "app-chat-panel" }], encapsulation: i0.ViewEncapsulation.None });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: MessagingOverlayComponent, decorators: [{
            type: Component,
            args: [{ selector: 'app-messaging-overlay', standalone: true, imports: [CommonModule, FloatingButtonComponent, ChatPanelComponent], template: `
    <ng-container *ngIf="isAuthenticated">
      <app-floating-button></app-floating-button>
      <app-chat-panel></app-chat-panel>
    </ng-container>
  `, encapsulation: ViewEncapsulation.None, styles: [".cdk-overlay-container{z-index:10000!important}.mat-mdc-tooltip{z-index:10001!important}\n"] }]
        }], ctorParameters: () => [{ type: i1.MessagingStoreService }, { type: i2.AuthService }] });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVzc2FnaW5nLW92ZXJsYXkuY29tcG9uZW50LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL2xpYi9tZXNzYWdpbmctb3ZlcmxheS5jb21wb25lbnQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLFNBQVMsRUFBVSxpQkFBaUIsRUFBRSxNQUFNLGVBQWUsQ0FBQztBQUNyRSxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDL0MsT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sd0RBQXdELENBQUM7QUFDakcsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sOENBQThDLENBQUM7Ozs7O0FBMEJsRixNQUFNLE9BQU8seUJBQXlCO0lBSTFCO0lBQ0E7SUFKVixlQUFlLEdBQUcsS0FBSyxDQUFDO0lBRXhCLFlBQ1UsS0FBNEIsRUFDNUIsSUFBaUI7UUFEakIsVUFBSyxHQUFMLEtBQUssQ0FBdUI7UUFDNUIsU0FBSSxHQUFKLElBQUksQ0FBYTtJQUN4QixDQUFDO0lBRUosUUFBUTtRQUNOLGdEQUFnRDtRQUNoRCxJQUFJLENBQUMsdUJBQXVCLEVBQUUsQ0FBQztRQUUvQixJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQyxPQUFPLEVBQUUsRUFBRTtZQUN2QyxJQUFJLENBQUMsZUFBZSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsZUFBZSxFQUFFLENBQUM7WUFDbkQsSUFBSSxJQUFJLENBQUMsZUFBZSxFQUFFLENBQUM7Z0JBQ3pCLElBQUksQ0FBQyxLQUFLLENBQUMsVUFBVSxFQUFFLENBQUM7WUFDMUIsQ0FBQztRQUNILENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVPLHVCQUF1QjtRQUM3QiwyQ0FBMkM7UUFDM0MsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLGVBQWUsRUFBRTtZQUFFLE9BQU87UUFFeEMsbURBQW1EO1FBQ25ELE1BQU0sV0FBVyxHQUFHLFlBQVksQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDcEQsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO1lBQ2pCLE9BQU87UUFDVCxDQUFDO1FBRUQsSUFBSSxDQUFDO1lBQ0gsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsQ0FBQztZQUN2QyxNQUFNLFNBQVMsR0FBRyxNQUFNLENBQUMsVUFBVSxJQUFJLE1BQU0sQ0FBQyxTQUFTLENBQUM7WUFDeEQsTUFBTSxLQUFLLEdBQUcsTUFBTSxDQUFDLEtBQUssSUFBSSxNQUFNLENBQUMsVUFBVSxDQUFDO1lBQ2hELE1BQU0sUUFBUSxHQUFHLE1BQU0sQ0FBQyxTQUFTLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQztZQUVqRCxJQUFJLENBQUMsU0FBUyxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7Z0JBQ3pCLE9BQU87WUFDVCxDQUFDO1lBRUQsbUNBQW1DO1lBQ25DLE1BQU0sYUFBYSxHQUFHLEtBQUssQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFFMUMsTUFBTSxPQUFPLEdBQVk7Z0JBQ3ZCLFVBQVUsRUFBRSxhQUFhO2dCQUN6QixRQUFRLEVBQUUsU0FBUztnQkFDbkIsUUFBUSxFQUFFLFFBQVEsSUFBSSxhQUFhO2dCQUNuQyxVQUFVLEVBQUUsUUFBUSxFQUFFLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ25DLFNBQVMsRUFBRSxRQUFRLEVBQUUsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDO2dCQUNsRCxLQUFLLEVBQUUsS0FBSztnQkFDWixZQUFZLEVBQUUsS0FBSztnQkFDbkIsU0FBUyxFQUFFLElBQUk7YUFDaEIsQ0FBQztZQUVGLHdCQUF3QjtZQUN4QixJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxTQUFTLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDM0MsQ0FBQztRQUFDLE1BQU0sQ0FBQztRQUNULENBQUM7SUFDSCxDQUFDO3dHQTFEVSx5QkFBeUI7NEZBQXpCLHlCQUF5QixpRkFqQjFCOzs7OztHQUtULG1LQU5TLFlBQVksbUlBQUUsdUJBQXVCLGdFQUFFLGtCQUFrQjs7NEZBa0J4RCx5QkFBeUI7a0JBckJyQyxTQUFTOytCQUNFLHVCQUF1QixjQUNyQixJQUFJLFdBQ1AsQ0FBQyxZQUFZLEVBQUUsdUJBQXVCLEVBQUUsa0JBQWtCLENBQUMsWUFDMUQ7Ozs7O0dBS1QsaUJBVWMsaUJBQWlCLENBQUMsSUFBSSIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IENvbXBvbmVudCwgT25Jbml0LCBWaWV3RW5jYXBzdWxhdGlvbiB9IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xyXG5pbXBvcnQgeyBDb21tb25Nb2R1bGUgfSBmcm9tICdAYW5ndWxhci9jb21tb24nO1xyXG5pbXBvcnQgeyBGbG9hdGluZ0J1dHRvbkNvbXBvbmVudCB9IGZyb20gJy4vY29tcG9uZW50cy9mbG9hdGluZy1idXR0b24vZmxvYXRpbmctYnV0dG9uLmNvbXBvbmVudCc7XHJcbmltcG9ydCB7IENoYXRQYW5lbENvbXBvbmVudCB9IGZyb20gJy4vY29tcG9uZW50cy9jaGF0LXBhbmVsL2NoYXQtcGFuZWwuY29tcG9uZW50JztcclxuaW1wb3J0IHsgTWVzc2FnaW5nU3RvcmVTZXJ2aWNlIH0gZnJvbSAnLi9zZXJ2aWNlcy9tZXNzYWdpbmctc3RvcmUuc2VydmljZSc7XHJcbmltcG9ydCB7IEF1dGhTZXJ2aWNlIH0gZnJvbSAnLi9zZXJ2aWNlcy9hdXRoLnNlcnZpY2UnO1xyXG5pbXBvcnQgeyBDb250YWN0IH0gZnJvbSAnLi9tb2RlbHMvbWVzc2FnaW5nLm1vZGVscyc7XHJcblxyXG5AQ29tcG9uZW50KHtcclxuICBzZWxlY3RvcjogJ2FwcC1tZXNzYWdpbmctb3ZlcmxheScsXHJcbiAgc3RhbmRhbG9uZTogdHJ1ZSxcclxuICBpbXBvcnRzOiBbQ29tbW9uTW9kdWxlLCBGbG9hdGluZ0J1dHRvbkNvbXBvbmVudCwgQ2hhdFBhbmVsQ29tcG9uZW50XSxcclxuICB0ZW1wbGF0ZTogYFxyXG4gICAgPG5nLWNvbnRhaW5lciAqbmdJZj1cImlzQXV0aGVudGljYXRlZFwiPlxyXG4gICAgICA8YXBwLWZsb2F0aW5nLWJ1dHRvbj48L2FwcC1mbG9hdGluZy1idXR0b24+XHJcbiAgICAgIDxhcHAtY2hhdC1wYW5lbD48L2FwcC1jaGF0LXBhbmVsPlxyXG4gICAgPC9uZy1jb250YWluZXI+XHJcbiAgYCxcclxuICBzdHlsZXM6IFtgXHJcbiAgICAuY2RrLW92ZXJsYXktY29udGFpbmVyIHtcclxuICAgICAgei1pbmRleDogMTAwMDAgIWltcG9ydGFudDtcclxuICAgIH1cclxuICAgIFxyXG4gICAgLm1hdC1tZGMtdG9vbHRpcCB7XHJcbiAgICAgIHotaW5kZXg6IDEwMDAxICFpbXBvcnRhbnQ7XHJcbiAgICB9XHJcbiAgYF0sXHJcbiAgZW5jYXBzdWxhdGlvbjogVmlld0VuY2Fwc3VsYXRpb24uTm9uZSxcclxufSlcclxuZXhwb3J0IGNsYXNzIE1lc3NhZ2luZ092ZXJsYXlDb21wb25lbnQgaW1wbGVtZW50cyBPbkluaXQge1xyXG4gIGlzQXV0aGVudGljYXRlZCA9IGZhbHNlO1xyXG5cclxuICBjb25zdHJ1Y3RvcihcclxuICAgIHByaXZhdGUgc3RvcmU6IE1lc3NhZ2luZ1N0b3JlU2VydmljZSxcclxuICAgIHByaXZhdGUgYXV0aDogQXV0aFNlcnZpY2VcclxuICApIHt9XHJcblxyXG4gIG5nT25Jbml0KCk6IHZvaWQge1xyXG4gICAgLy8gQXV0by1pbml0IG1lc3NhZ2luZyBzZXNzaW9uIGZyb20gbG9jYWxTdG9yYWdlXHJcbiAgICB0aGlzLmluaXRpYWxpemVNZXNzYWdpbmdBdXRoKCk7XHJcbiAgICBcclxuICAgIHRoaXMuYXV0aC5zZXNzaW9uJC5zdWJzY3JpYmUoKHNlc3Npb24pID0+IHtcclxuICAgICAgdGhpcy5pc0F1dGhlbnRpY2F0ZWQgPSB0aGlzLmF1dGguaXNBdXRoZW50aWNhdGVkKCk7XHJcbiAgICAgIGlmICh0aGlzLmlzQXV0aGVudGljYXRlZCkge1xyXG4gICAgICAgIHRoaXMuc3RvcmUuaW5pdGlhbGl6ZSgpO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgaW5pdGlhbGl6ZU1lc3NhZ2luZ0F1dGgoKTogdm9pZCB7XHJcbiAgICAvLyBDaGVjayBpZiBtZXNzYWdpbmcgYWxyZWFkeSBhdXRoZW50aWNhdGVkXHJcbiAgICBpZiAodGhpcy5hdXRoLmlzQXV0aGVudGljYXRlZCgpKSByZXR1cm47XHJcblxyXG4gICAgLy8gR2V0IHNlc3Npb24gZnJvbSBsb2NhbFN0b3JhZ2UgKGhvc3QgYXBwIHNlc3Npb24pXHJcbiAgICBjb25zdCBzZXNzaW9uRGF0YSA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdzZXNzaW9uJyk7XHJcbiAgICBpZiAoIXNlc3Npb25EYXRhKSB7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICB0cnkge1xyXG4gICAgICBjb25zdCBwYXJzZWQgPSBKU09OLnBhcnNlKHNlc3Npb25EYXRhKTtcclxuICAgICAgY29uc3Qgc2Vzc2lvbklkID0gcGFyc2VkLnNlc3Npb25faWQgfHwgcGFyc2VkLnNlc3Npb25JZDtcclxuICAgICAgY29uc3QgZW1haWwgPSBwYXJzZWQuZW1haWwgfHwgcGFyc2VkLnVzZXJfZW1haWw7XHJcbiAgICAgIGNvbnN0IHVzZXJOYW1lID0gcGFyc2VkLnVzZXJfbmFtZSB8fCBwYXJzZWQubmFtZTtcclxuXHJcbiAgICAgIGlmICghc2Vzc2lvbklkIHx8ICFlbWFpbCkge1xyXG4gICAgICAgIHJldHVybjtcclxuICAgICAgfVxyXG5cclxuICAgICAgLy8gQ3JlYXRlIGNvbnRhY3QgZnJvbSBzZXNzaW9uIGRhdGFcclxuICAgICAgY29uc3QgdGVtcENvbnRhY3RJZCA9IGVtYWlsLnNwbGl0KCdAJylbMF07XHJcbiAgICAgIFxyXG4gICAgICBjb25zdCBjb250YWN0OiBDb250YWN0ID0ge1xyXG4gICAgICAgIGNvbnRhY3RfaWQ6IHRlbXBDb250YWN0SWQsXHJcbiAgICAgICAgdXNlcl9naWQ6IHNlc3Npb25JZCxcclxuICAgICAgICB1c2VybmFtZTogdXNlck5hbWUgfHwgdGVtcENvbnRhY3RJZCxcclxuICAgICAgICBmaXJzdF9uYW1lOiB1c2VyTmFtZT8uc3BsaXQoJyAnKVswXSxcclxuICAgICAgICBsYXN0X25hbWU6IHVzZXJOYW1lPy5zcGxpdCgnICcpLnNsaWNlKDEpLmpvaW4oJyAnKSxcclxuICAgICAgICBlbWFpbDogZW1haWwsXHJcbiAgICAgICAgY29tcGFueV9uYW1lOiAnQ0VTJyxcclxuICAgICAgICBpc19hY3RpdmU6IHRydWVcclxuICAgICAgfTtcclxuXHJcbiAgICAgIC8vIFNldCBtZXNzYWdpbmcgc2Vzc2lvblxyXG4gICAgICB0aGlzLmF1dGguc2V0U2Vzc2lvbihzZXNzaW9uSWQsIGNvbnRhY3QpO1xyXG4gICAgfSBjYXRjaCB7XHJcbiAgICB9XHJcbiAgfVxyXG59XHJcbiJdfQ==