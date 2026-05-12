import { Injectable, Inject } from '@angular/core';
import { of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { MESSAGING_CONFIG } from '../messaging.config';
import * as i0 from "@angular/core";
import * as i1 from "@angular/common/http";
export class MessagingAuthBridgeService {
    http;
    config;
    constructor(http, config) {
        this.http = http;
        this.config = config;
    }
    /**
     * Authenticate with auth-api using email and password.
     * Returns session_gid and contact information.
     */
    authenticateForMessaging(email, password) {
        return this.http.post(`${this.config.apiBaseUrl}/auth`, {
            function: '_login',
            email,
            password
        }).pipe(map(response => {
            const session = {
                session_gid: response.session_gid,
                session_expires: response.session_expires
            };
            const contact = {
                contact_id: response.contact_id || response.user_id,
                user_gid: response.user_gid || response.session_gid,
                first_name: response.first_name || email.split('@')[0],
                last_name: response.last_name || '',
                email: email,
                company_name: response.company_name || 'Coreline Engineering Solutions',
                is_active: true
            };
            return { session, contact };
        }), catchError(error => {
            return throwError(() => error);
        }));
    }
    /**
     * Check if a messaging session exists in localStorage.
     */
    hasStoredSession() {
        const stored = localStorage.getItem('messaging_session');
        if (!stored)
            return false;
        try {
            const parsed = JSON.parse(stored);
            return !!parsed.session_gid && !!parsed.contact;
        }
        catch {
            return false;
        }
    }
    /**
     * Attempt to use existing session to get messaging session.
     */
    initializeFromExistingSession(email) {
        if (this.hasStoredSession()) {
            return of(null); // Already authenticated
        }
        return of(null);
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: MessagingAuthBridgeService, deps: [{ token: i1.HttpClient }, { token: MESSAGING_CONFIG }], target: i0.ɵɵFactoryTarget.Injectable });
    static ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: MessagingAuthBridgeService, providedIn: 'root' });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: MessagingAuthBridgeService, decorators: [{
            type: Injectable,
            args: [{ providedIn: 'root' }]
        }], ctorParameters: () => [{ type: i1.HttpClient }, { type: undefined, decorators: [{
                    type: Inject,
                    args: [MESSAGING_CONFIG]
                }] }] });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVzc2FnaW5nLWF1dGgtYnJpZGdlLnNlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvbGliL3NlcnZpY2VzL21lc3NhZ2luZy1hdXRoLWJyaWRnZS5zZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxFQUFFLE1BQU0sZUFBZSxDQUFDO0FBRW5ELE9BQU8sRUFBYyxFQUFFLEVBQUUsVUFBVSxFQUFFLE1BQU0sTUFBTSxDQUFDO0FBQ2xELE9BQU8sRUFBRSxVQUFVLEVBQUUsR0FBRyxFQUFFLE1BQU0sZ0JBQWdCLENBQUM7QUFDakQsT0FBTyxFQUFFLGdCQUFnQixFQUFtQixNQUFNLHFCQUFxQixDQUFDOzs7QUFJeEUsTUFBTSxPQUFPLDBCQUEwQjtJQUUzQjtJQUMwQjtJQUZwQyxZQUNVLElBQWdCLEVBQ1UsTUFBdUI7UUFEakQsU0FBSSxHQUFKLElBQUksQ0FBWTtRQUNVLFdBQU0sR0FBTixNQUFNLENBQWlCO0lBQ3hELENBQUM7SUFFSjs7O09BR0c7SUFDSCx3QkFBd0IsQ0FBQyxLQUFhLEVBQUUsUUFBZ0I7UUFDdEQsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBTSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsVUFBVSxPQUFPLEVBQUU7WUFDM0QsUUFBUSxFQUFFLFFBQVE7WUFDbEIsS0FBSztZQUNMLFFBQVE7U0FDVCxDQUFDLENBQUMsSUFBSSxDQUNMLEdBQUcsQ0FBQyxRQUFRLENBQUMsRUFBRTtZQUNiLE1BQU0sT0FBTyxHQUFnQjtnQkFDM0IsV0FBVyxFQUFFLFFBQVEsQ0FBQyxXQUFXO2dCQUNqQyxlQUFlLEVBQUUsUUFBUSxDQUFDLGVBQWU7YUFDMUMsQ0FBQztZQUVGLE1BQU0sT0FBTyxHQUFZO2dCQUN2QixVQUFVLEVBQUUsUUFBUSxDQUFDLFVBQVUsSUFBSSxRQUFRLENBQUMsT0FBTztnQkFDbkQsUUFBUSxFQUFFLFFBQVEsQ0FBQyxRQUFRLElBQUksUUFBUSxDQUFDLFdBQVc7Z0JBQ25ELFVBQVUsRUFBRSxRQUFRLENBQUMsVUFBVSxJQUFJLEtBQUssQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUN0RCxTQUFTLEVBQUUsUUFBUSxDQUFDLFNBQVMsSUFBSSxFQUFFO2dCQUNuQyxLQUFLLEVBQUUsS0FBSztnQkFDWixZQUFZLEVBQUUsUUFBUSxDQUFDLFlBQVksSUFBSSxnQ0FBZ0M7Z0JBQ3ZFLFNBQVMsRUFBRSxJQUFJO2FBQ2hCLENBQUM7WUFFRixPQUFPLEVBQUUsT0FBTyxFQUFFLE9BQU8sRUFBRSxDQUFDO1FBQzlCLENBQUMsQ0FBQyxFQUNGLFVBQVUsQ0FBQyxLQUFLLENBQUMsRUFBRTtZQUNqQixPQUFPLFVBQVUsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUNqQyxDQUFDLENBQUMsQ0FDSCxDQUFDO0lBQ0osQ0FBQztJQUVEOztPQUVHO0lBQ0gsZ0JBQWdCO1FBQ2QsTUFBTSxNQUFNLEdBQUcsWUFBWSxDQUFDLE9BQU8sQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO1FBQ3pELElBQUksQ0FBQyxNQUFNO1lBQUUsT0FBTyxLQUFLLENBQUM7UUFFMUIsSUFBSSxDQUFDO1lBQ0gsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUNsQyxPQUFPLENBQUMsQ0FBQyxNQUFNLENBQUMsV0FBVyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDO1FBQ2xELENBQUM7UUFBQyxNQUFNLENBQUM7WUFDUCxPQUFPLEtBQUssQ0FBQztRQUNmLENBQUM7SUFDSCxDQUFDO0lBRUQ7O09BRUc7SUFDSCw2QkFBNkIsQ0FBQyxLQUFhO1FBQ3pDLElBQUksSUFBSSxDQUFDLGdCQUFnQixFQUFFLEVBQUUsQ0FBQztZQUM1QixPQUFPLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLHdCQUF3QjtRQUMzQyxDQUFDO1FBRUQsT0FBTyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDbEIsQ0FBQzt3R0FoRVUsMEJBQTBCLDRDQUczQixnQkFBZ0I7NEdBSGYsMEJBQTBCLGNBRGIsTUFBTTs7NEZBQ25CLDBCQUEwQjtrQkFEdEMsVUFBVTttQkFBQyxFQUFFLFVBQVUsRUFBRSxNQUFNLEVBQUU7OzBCQUk3QixNQUFNOzJCQUFDLGdCQUFnQiIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEluamVjdGFibGUsIEluamVjdCB9IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xyXG5pbXBvcnQgeyBIdHRwQ2xpZW50IH0gZnJvbSAnQGFuZ3VsYXIvY29tbW9uL2h0dHAnO1xyXG5pbXBvcnQgeyBPYnNlcnZhYmxlLCBvZiwgdGhyb3dFcnJvciB9IGZyb20gJ3J4anMnO1xyXG5pbXBvcnQgeyBjYXRjaEVycm9yLCBtYXAgfSBmcm9tICdyeGpzL29wZXJhdG9ycyc7XHJcbmltcG9ydCB7IE1FU1NBR0lOR19DT05GSUcsIE1lc3NhZ2luZ0NvbmZpZyB9IGZyb20gJy4uL21lc3NhZ2luZy5jb25maWcnO1xyXG5pbXBvcnQgeyBBdXRoU2Vzc2lvbiwgQ29udGFjdCB9IGZyb20gJy4uL21vZGVscy9tZXNzYWdpbmcubW9kZWxzJztcclxuXHJcbkBJbmplY3RhYmxlKHsgcHJvdmlkZWRJbjogJ3Jvb3QnIH0pXHJcbmV4cG9ydCBjbGFzcyBNZXNzYWdpbmdBdXRoQnJpZGdlU2VydmljZSB7XHJcbiAgY29uc3RydWN0b3IoXHJcbiAgICBwcml2YXRlIGh0dHA6IEh0dHBDbGllbnQsXHJcbiAgICBASW5qZWN0KE1FU1NBR0lOR19DT05GSUcpIHByaXZhdGUgY29uZmlnOiBNZXNzYWdpbmdDb25maWdcclxuICApIHt9XHJcblxyXG4gIC8qKlxyXG4gICAqIEF1dGhlbnRpY2F0ZSB3aXRoIGF1dGgtYXBpIHVzaW5nIGVtYWlsIGFuZCBwYXNzd29yZC5cclxuICAgKiBSZXR1cm5zIHNlc3Npb25fZ2lkIGFuZCBjb250YWN0IGluZm9ybWF0aW9uLlxyXG4gICAqL1xyXG4gIGF1dGhlbnRpY2F0ZUZvck1lc3NhZ2luZyhlbWFpbDogc3RyaW5nLCBwYXNzd29yZDogc3RyaW5nKTogT2JzZXJ2YWJsZTx7IHNlc3Npb246IEF1dGhTZXNzaW9uOyBjb250YWN0OiBDb250YWN0IH0+IHtcclxuICAgIHJldHVybiB0aGlzLmh0dHAucG9zdDxhbnk+KGAke3RoaXMuY29uZmlnLmFwaUJhc2VVcmx9L2F1dGhgLCB7XHJcbiAgICAgIGZ1bmN0aW9uOiAnX2xvZ2luJyxcclxuICAgICAgZW1haWwsXHJcbiAgICAgIHBhc3N3b3JkXHJcbiAgICB9KS5waXBlKFxyXG4gICAgICBtYXAocmVzcG9uc2UgPT4ge1xyXG4gICAgICAgIGNvbnN0IHNlc3Npb246IEF1dGhTZXNzaW9uID0ge1xyXG4gICAgICAgICAgc2Vzc2lvbl9naWQ6IHJlc3BvbnNlLnNlc3Npb25fZ2lkLFxyXG4gICAgICAgICAgc2Vzc2lvbl9leHBpcmVzOiByZXNwb25zZS5zZXNzaW9uX2V4cGlyZXNcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICBjb25zdCBjb250YWN0OiBDb250YWN0ID0ge1xyXG4gICAgICAgICAgY29udGFjdF9pZDogcmVzcG9uc2UuY29udGFjdF9pZCB8fCByZXNwb25zZS51c2VyX2lkLFxyXG4gICAgICAgICAgdXNlcl9naWQ6IHJlc3BvbnNlLnVzZXJfZ2lkIHx8IHJlc3BvbnNlLnNlc3Npb25fZ2lkLFxyXG4gICAgICAgICAgZmlyc3RfbmFtZTogcmVzcG9uc2UuZmlyc3RfbmFtZSB8fCBlbWFpbC5zcGxpdCgnQCcpWzBdLFxyXG4gICAgICAgICAgbGFzdF9uYW1lOiByZXNwb25zZS5sYXN0X25hbWUgfHwgJycsXHJcbiAgICAgICAgICBlbWFpbDogZW1haWwsXHJcbiAgICAgICAgICBjb21wYW55X25hbWU6IHJlc3BvbnNlLmNvbXBhbnlfbmFtZSB8fCAnQ29yZWxpbmUgRW5naW5lZXJpbmcgU29sdXRpb25zJyxcclxuICAgICAgICAgIGlzX2FjdGl2ZTogdHJ1ZVxyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIHJldHVybiB7IHNlc3Npb24sIGNvbnRhY3QgfTtcclxuICAgICAgfSksXHJcbiAgICAgIGNhdGNoRXJyb3IoZXJyb3IgPT4ge1xyXG4gICAgICAgIHJldHVybiB0aHJvd0Vycm9yKCgpID0+IGVycm9yKTtcclxuICAgICAgfSlcclxuICAgICk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDaGVjayBpZiBhIG1lc3NhZ2luZyBzZXNzaW9uIGV4aXN0cyBpbiBsb2NhbFN0b3JhZ2UuXHJcbiAgICovXHJcbiAgaGFzU3RvcmVkU2Vzc2lvbigpOiBib29sZWFuIHtcclxuICAgIGNvbnN0IHN0b3JlZCA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdtZXNzYWdpbmdfc2Vzc2lvbicpO1xyXG4gICAgaWYgKCFzdG9yZWQpIHJldHVybiBmYWxzZTtcclxuXHJcbiAgICB0cnkge1xyXG4gICAgICBjb25zdCBwYXJzZWQgPSBKU09OLnBhcnNlKHN0b3JlZCk7XHJcbiAgICAgIHJldHVybiAhIXBhcnNlZC5zZXNzaW9uX2dpZCAmJiAhIXBhcnNlZC5jb250YWN0O1xyXG4gICAgfSBjYXRjaCB7XHJcbiAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEF0dGVtcHQgdG8gdXNlIGV4aXN0aW5nIHNlc3Npb24gdG8gZ2V0IG1lc3NhZ2luZyBzZXNzaW9uLlxyXG4gICAqL1xyXG4gIGluaXRpYWxpemVGcm9tRXhpc3RpbmdTZXNzaW9uKGVtYWlsOiBzdHJpbmcpOiBPYnNlcnZhYmxlPHsgc2Vzc2lvbjogQXV0aFNlc3Npb247IGNvbnRhY3Q6IENvbnRhY3QgfSB8IG51bGw+IHtcclxuICAgIGlmICh0aGlzLmhhc1N0b3JlZFNlc3Npb24oKSkge1xyXG4gICAgICByZXR1cm4gb2YobnVsbCk7IC8vIEFscmVhZHkgYXV0aGVudGljYXRlZFxyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBvZihudWxsKTtcclxuICB9XHJcbn1cclxuIl19