import { Component } from '@angular/core';
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
            console.warn('Messaging: No session in localStorage');
            return;
        }
        try {
            const parsed = JSON.parse(sessionData);
            const sessionId = parsed.session_id || parsed.sessionId;
            const email = parsed.email || parsed.user_email;
            const userName = parsed.user_name || parsed.name;
            if (!sessionId || !email) {
                console.warn('Messaging: Invalid session data');
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
        catch (err) {
            console.error('Messaging: Failed to parse session:', err);
        }
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: MessagingOverlayComponent, deps: [{ token: i1.MessagingStoreService }, { token: i2.AuthService }], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "17.3.12", type: MessagingOverlayComponent, isStandalone: true, selector: "app-messaging-overlay", ngImport: i0, template: `
    <ng-container *ngIf="isAuthenticated">
      <app-floating-button></app-floating-button>
      <app-chat-panel></app-chat-panel>
    </ng-container>
  `, isInline: true, dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i3.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "component", type: FloatingButtonComponent, selector: "app-floating-button" }, { kind: "component", type: ChatPanelComponent, selector: "app-chat-panel" }] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: MessagingOverlayComponent, decorators: [{
            type: Component,
            args: [{
                    selector: 'app-messaging-overlay',
                    standalone: true,
                    imports: [CommonModule, FloatingButtonComponent, ChatPanelComponent],
                    template: `
    <ng-container *ngIf="isAuthenticated">
      <app-floating-button></app-floating-button>
      <app-chat-panel></app-chat-panel>
    </ng-container>
  `,
                }]
        }], ctorParameters: () => [{ type: i1.MessagingStoreService }, { type: i2.AuthService }] });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVzc2FnaW5nLW92ZXJsYXkuY29tcG9uZW50LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL2xpYi9tZXNzYWdpbmctb3ZlcmxheS5jb21wb25lbnQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLFNBQVMsRUFBVSxNQUFNLGVBQWUsQ0FBQztBQUNsRCxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDL0MsT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sd0RBQXdELENBQUM7QUFDakcsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sOENBQThDLENBQUM7Ozs7O0FBZ0JsRixNQUFNLE9BQU8seUJBQXlCO0lBSTFCO0lBQ0E7SUFKVixlQUFlLEdBQUcsS0FBSyxDQUFDO0lBRXhCLFlBQ1UsS0FBNEIsRUFDNUIsSUFBaUI7UUFEakIsVUFBSyxHQUFMLEtBQUssQ0FBdUI7UUFDNUIsU0FBSSxHQUFKLElBQUksQ0FBYTtJQUN4QixDQUFDO0lBRUosUUFBUTtRQUNOLGdEQUFnRDtRQUNoRCxJQUFJLENBQUMsdUJBQXVCLEVBQUUsQ0FBQztRQUUvQixJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQyxPQUFPLEVBQUUsRUFBRTtZQUN2QyxJQUFJLENBQUMsZUFBZSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsZUFBZSxFQUFFLENBQUM7WUFDbkQsSUFBSSxJQUFJLENBQUMsZUFBZSxFQUFFLENBQUM7Z0JBQ3pCLElBQUksQ0FBQyxLQUFLLENBQUMsVUFBVSxFQUFFLENBQUM7WUFDMUIsQ0FBQztRQUNILENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVPLHVCQUF1QjtRQUM3QiwyQ0FBMkM7UUFDM0MsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLGVBQWUsRUFBRTtZQUFFLE9BQU87UUFFeEMsbURBQW1EO1FBQ25ELE1BQU0sV0FBVyxHQUFHLFlBQVksQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDcEQsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO1lBQ2pCLE9BQU8sQ0FBQyxJQUFJLENBQUMsdUNBQXVDLENBQUMsQ0FBQztZQUN0RCxPQUFPO1FBQ1QsQ0FBQztRQUVELElBQUksQ0FBQztZQUNILE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLENBQUM7WUFDdkMsTUFBTSxTQUFTLEdBQUcsTUFBTSxDQUFDLFVBQVUsSUFBSSxNQUFNLENBQUMsU0FBUyxDQUFDO1lBQ3hELE1BQU0sS0FBSyxHQUFHLE1BQU0sQ0FBQyxLQUFLLElBQUksTUFBTSxDQUFDLFVBQVUsQ0FBQztZQUNoRCxNQUFNLFFBQVEsR0FBRyxNQUFNLENBQUMsU0FBUyxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUM7WUFFakQsSUFBSSxDQUFDLFNBQVMsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO2dCQUN6QixPQUFPLENBQUMsSUFBSSxDQUFDLGlDQUFpQyxDQUFDLENBQUM7Z0JBQ2hELE9BQU87WUFDVCxDQUFDO1lBRUQsbUNBQW1DO1lBQ25DLE1BQU0sYUFBYSxHQUFHLEtBQUssQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFFMUMsTUFBTSxPQUFPLEdBQVk7Z0JBQ3ZCLFVBQVUsRUFBRSxhQUFhO2dCQUN6QixRQUFRLEVBQUUsU0FBUztnQkFDbkIsUUFBUSxFQUFFLFFBQVEsSUFBSSxhQUFhO2dCQUNuQyxVQUFVLEVBQUUsUUFBUSxFQUFFLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ25DLFNBQVMsRUFBRSxRQUFRLEVBQUUsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDO2dCQUNsRCxLQUFLLEVBQUUsS0FBSztnQkFDWixZQUFZLEVBQUUsS0FBSztnQkFDbkIsU0FBUyxFQUFFLElBQUk7YUFDaEIsQ0FBQztZQUVGLHdCQUF3QjtZQUN4QixJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxTQUFTLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDM0MsQ0FBQztRQUFDLE9BQU8sR0FBRyxFQUFFLENBQUM7WUFDYixPQUFPLENBQUMsS0FBSyxDQUFDLHFDQUFxQyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQzVELENBQUM7SUFDSCxDQUFDO3dHQTdEVSx5QkFBeUI7NEZBQXpCLHlCQUF5QixpRkFQMUI7Ozs7O0dBS1QsMkRBTlMsWUFBWSxtSUFBRSx1QkFBdUIsZ0VBQUUsa0JBQWtCOzs0RkFReEQseUJBQXlCO2tCQVhyQyxTQUFTO21CQUFDO29CQUNULFFBQVEsRUFBRSx1QkFBdUI7b0JBQ2pDLFVBQVUsRUFBRSxJQUFJO29CQUNoQixPQUFPLEVBQUUsQ0FBQyxZQUFZLEVBQUUsdUJBQXVCLEVBQUUsa0JBQWtCLENBQUM7b0JBQ3BFLFFBQVEsRUFBRTs7Ozs7R0FLVDtpQkFDRiIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IENvbXBvbmVudCwgT25Jbml0IH0gZnJvbSAnQGFuZ3VsYXIvY29yZSc7XG5pbXBvcnQgeyBDb21tb25Nb2R1bGUgfSBmcm9tICdAYW5ndWxhci9jb21tb24nO1xuaW1wb3J0IHsgRmxvYXRpbmdCdXR0b25Db21wb25lbnQgfSBmcm9tICcuL2NvbXBvbmVudHMvZmxvYXRpbmctYnV0dG9uL2Zsb2F0aW5nLWJ1dHRvbi5jb21wb25lbnQnO1xuaW1wb3J0IHsgQ2hhdFBhbmVsQ29tcG9uZW50IH0gZnJvbSAnLi9jb21wb25lbnRzL2NoYXQtcGFuZWwvY2hhdC1wYW5lbC5jb21wb25lbnQnO1xuaW1wb3J0IHsgTWVzc2FnaW5nU3RvcmVTZXJ2aWNlIH0gZnJvbSAnLi9zZXJ2aWNlcy9tZXNzYWdpbmctc3RvcmUuc2VydmljZSc7XG5pbXBvcnQgeyBBdXRoU2VydmljZSB9IGZyb20gJy4vc2VydmljZXMvYXV0aC5zZXJ2aWNlJztcbmltcG9ydCB7IENvbnRhY3QgfSBmcm9tICcuL21vZGVscy9tZXNzYWdpbmcubW9kZWxzJztcblxuQENvbXBvbmVudCh7XG4gIHNlbGVjdG9yOiAnYXBwLW1lc3NhZ2luZy1vdmVybGF5JyxcbiAgc3RhbmRhbG9uZTogdHJ1ZSxcbiAgaW1wb3J0czogW0NvbW1vbk1vZHVsZSwgRmxvYXRpbmdCdXR0b25Db21wb25lbnQsIENoYXRQYW5lbENvbXBvbmVudF0sXG4gIHRlbXBsYXRlOiBgXG4gICAgPG5nLWNvbnRhaW5lciAqbmdJZj1cImlzQXV0aGVudGljYXRlZFwiPlxuICAgICAgPGFwcC1mbG9hdGluZy1idXR0b24+PC9hcHAtZmxvYXRpbmctYnV0dG9uPlxuICAgICAgPGFwcC1jaGF0LXBhbmVsPjwvYXBwLWNoYXQtcGFuZWw+XG4gICAgPC9uZy1jb250YWluZXI+XG4gIGAsXG59KVxuZXhwb3J0IGNsYXNzIE1lc3NhZ2luZ092ZXJsYXlDb21wb25lbnQgaW1wbGVtZW50cyBPbkluaXQge1xuICBpc0F1dGhlbnRpY2F0ZWQgPSBmYWxzZTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIHN0b3JlOiBNZXNzYWdpbmdTdG9yZVNlcnZpY2UsXG4gICAgcHJpdmF0ZSBhdXRoOiBBdXRoU2VydmljZVxuICApIHt9XG5cbiAgbmdPbkluaXQoKTogdm9pZCB7XG4gICAgLy8gQXV0by1pbml0IG1lc3NhZ2luZyBzZXNzaW9uIGZyb20gbG9jYWxTdG9yYWdlXG4gICAgdGhpcy5pbml0aWFsaXplTWVzc2FnaW5nQXV0aCgpO1xuICAgIFxuICAgIHRoaXMuYXV0aC5zZXNzaW9uJC5zdWJzY3JpYmUoKHNlc3Npb24pID0+IHtcbiAgICAgIHRoaXMuaXNBdXRoZW50aWNhdGVkID0gdGhpcy5hdXRoLmlzQXV0aGVudGljYXRlZCgpO1xuICAgICAgaWYgKHRoaXMuaXNBdXRoZW50aWNhdGVkKSB7XG4gICAgICAgIHRoaXMuc3RvcmUuaW5pdGlhbGl6ZSgpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBpbml0aWFsaXplTWVzc2FnaW5nQXV0aCgpOiB2b2lkIHtcbiAgICAvLyBDaGVjayBpZiBtZXNzYWdpbmcgYWxyZWFkeSBhdXRoZW50aWNhdGVkXG4gICAgaWYgKHRoaXMuYXV0aC5pc0F1dGhlbnRpY2F0ZWQoKSkgcmV0dXJuO1xuXG4gICAgLy8gR2V0IHNlc3Npb24gZnJvbSBsb2NhbFN0b3JhZ2UgKGhvc3QgYXBwIHNlc3Npb24pXG4gICAgY29uc3Qgc2Vzc2lvbkRhdGEgPSBsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnc2Vzc2lvbicpO1xuICAgIGlmICghc2Vzc2lvbkRhdGEpIHtcbiAgICAgIGNvbnNvbGUud2FybignTWVzc2FnaW5nOiBObyBzZXNzaW9uIGluIGxvY2FsU3RvcmFnZScpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICBjb25zdCBwYXJzZWQgPSBKU09OLnBhcnNlKHNlc3Npb25EYXRhKTtcbiAgICAgIGNvbnN0IHNlc3Npb25JZCA9IHBhcnNlZC5zZXNzaW9uX2lkIHx8IHBhcnNlZC5zZXNzaW9uSWQ7XG4gICAgICBjb25zdCBlbWFpbCA9IHBhcnNlZC5lbWFpbCB8fCBwYXJzZWQudXNlcl9lbWFpbDtcbiAgICAgIGNvbnN0IHVzZXJOYW1lID0gcGFyc2VkLnVzZXJfbmFtZSB8fCBwYXJzZWQubmFtZTtcblxuICAgICAgaWYgKCFzZXNzaW9uSWQgfHwgIWVtYWlsKSB7XG4gICAgICAgIGNvbnNvbGUud2FybignTWVzc2FnaW5nOiBJbnZhbGlkIHNlc3Npb24gZGF0YScpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIC8vIENyZWF0ZSBjb250YWN0IGZyb20gc2Vzc2lvbiBkYXRhXG4gICAgICBjb25zdCB0ZW1wQ29udGFjdElkID0gZW1haWwuc3BsaXQoJ0AnKVswXTtcbiAgICAgIFxuICAgICAgY29uc3QgY29udGFjdDogQ29udGFjdCA9IHtcbiAgICAgICAgY29udGFjdF9pZDogdGVtcENvbnRhY3RJZCxcbiAgICAgICAgdXNlcl9naWQ6IHNlc3Npb25JZCxcbiAgICAgICAgdXNlcm5hbWU6IHVzZXJOYW1lIHx8IHRlbXBDb250YWN0SWQsXG4gICAgICAgIGZpcnN0X25hbWU6IHVzZXJOYW1lPy5zcGxpdCgnICcpWzBdLFxuICAgICAgICBsYXN0X25hbWU6IHVzZXJOYW1lPy5zcGxpdCgnICcpLnNsaWNlKDEpLmpvaW4oJyAnKSxcbiAgICAgICAgZW1haWw6IGVtYWlsLFxuICAgICAgICBjb21wYW55X25hbWU6ICdDRVMnLFxuICAgICAgICBpc19hY3RpdmU6IHRydWVcbiAgICAgIH07XG5cbiAgICAgIC8vIFNldCBtZXNzYWdpbmcgc2Vzc2lvblxuICAgICAgdGhpcy5hdXRoLnNldFNlc3Npb24oc2Vzc2lvbklkLCBjb250YWN0KTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ01lc3NhZ2luZzogRmFpbGVkIHRvIHBhcnNlIHNlc3Npb246JywgZXJyKTtcbiAgICB9XG4gIH1cbn1cbiJdfQ==