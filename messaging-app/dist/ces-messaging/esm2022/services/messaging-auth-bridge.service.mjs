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
            console.error('Messaging authentication failed:', error);
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
        console.log('Messaging authentication required for:', email);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVzc2FnaW5nLWF1dGgtYnJpZGdlLnNlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvbGliL3NlcnZpY2VzL21lc3NhZ2luZy1hdXRoLWJyaWRnZS5zZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxFQUFFLE1BQU0sZUFBZSxDQUFDO0FBRW5ELE9BQU8sRUFBYyxFQUFFLEVBQUUsVUFBVSxFQUFFLE1BQU0sTUFBTSxDQUFDO0FBQ2xELE9BQU8sRUFBRSxVQUFVLEVBQUUsR0FBRyxFQUFFLE1BQU0sZ0JBQWdCLENBQUM7QUFDakQsT0FBTyxFQUFFLGdCQUFnQixFQUFtQixNQUFNLHFCQUFxQixDQUFDOzs7QUFJeEUsTUFBTSxPQUFPLDBCQUEwQjtJQUUzQjtJQUMwQjtJQUZwQyxZQUNVLElBQWdCLEVBQ1UsTUFBdUI7UUFEakQsU0FBSSxHQUFKLElBQUksQ0FBWTtRQUNVLFdBQU0sR0FBTixNQUFNLENBQWlCO0lBQ3hELENBQUM7SUFFSjs7O09BR0c7SUFDSCx3QkFBd0IsQ0FBQyxLQUFhLEVBQUUsUUFBZ0I7UUFDdEQsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBTSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsVUFBVSxPQUFPLEVBQUU7WUFDM0QsUUFBUSxFQUFFLFFBQVE7WUFDbEIsS0FBSztZQUNMLFFBQVE7U0FDVCxDQUFDLENBQUMsSUFBSSxDQUNMLEdBQUcsQ0FBQyxRQUFRLENBQUMsRUFBRTtZQUNiLE1BQU0sT0FBTyxHQUFnQjtnQkFDM0IsV0FBVyxFQUFFLFFBQVEsQ0FBQyxXQUFXO2dCQUNqQyxlQUFlLEVBQUUsUUFBUSxDQUFDLGVBQWU7YUFDMUMsQ0FBQztZQUVGLE1BQU0sT0FBTyxHQUFZO2dCQUN2QixVQUFVLEVBQUUsUUFBUSxDQUFDLFVBQVUsSUFBSSxRQUFRLENBQUMsT0FBTztnQkFDbkQsUUFBUSxFQUFFLFFBQVEsQ0FBQyxRQUFRLElBQUksUUFBUSxDQUFDLFdBQVc7Z0JBQ25ELFVBQVUsRUFBRSxRQUFRLENBQUMsVUFBVSxJQUFJLEtBQUssQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUN0RCxTQUFTLEVBQUUsUUFBUSxDQUFDLFNBQVMsSUFBSSxFQUFFO2dCQUNuQyxLQUFLLEVBQUUsS0FBSztnQkFDWixZQUFZLEVBQUUsUUFBUSxDQUFDLFlBQVksSUFBSSxnQ0FBZ0M7Z0JBQ3ZFLFNBQVMsRUFBRSxJQUFJO2FBQ2hCLENBQUM7WUFFRixPQUFPLEVBQUUsT0FBTyxFQUFFLE9BQU8sRUFBRSxDQUFDO1FBQzlCLENBQUMsQ0FBQyxFQUNGLFVBQVUsQ0FBQyxLQUFLLENBQUMsRUFBRTtZQUNqQixPQUFPLENBQUMsS0FBSyxDQUFDLGtDQUFrQyxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBQ3pELE9BQU8sVUFBVSxDQUFDLEdBQUcsRUFBRSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ2pDLENBQUMsQ0FBQyxDQUNILENBQUM7SUFDSixDQUFDO0lBRUQ7O09BRUc7SUFDSCxnQkFBZ0I7UUFDZCxNQUFNLE1BQU0sR0FBRyxZQUFZLENBQUMsT0FBTyxDQUFDLG1CQUFtQixDQUFDLENBQUM7UUFDekQsSUFBSSxDQUFDLE1BQU07WUFBRSxPQUFPLEtBQUssQ0FBQztRQUUxQixJQUFJLENBQUM7WUFDSCxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBQ2xDLE9BQU8sQ0FBQyxDQUFDLE1BQU0sQ0FBQyxXQUFXLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUM7UUFDbEQsQ0FBQztRQUFDLE1BQU0sQ0FBQztZQUNQLE9BQU8sS0FBSyxDQUFDO1FBQ2YsQ0FBQztJQUNILENBQUM7SUFFRDs7T0FFRztJQUNILDZCQUE2QixDQUFDLEtBQWE7UUFDekMsSUFBSSxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsRUFBRSxDQUFDO1lBQzVCLE9BQU8sRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsd0JBQXdCO1FBQzNDLENBQUM7UUFFRCxPQUFPLENBQUMsR0FBRyxDQUFDLHdDQUF3QyxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQzdELE9BQU8sRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ2xCLENBQUM7d0dBbEVVLDBCQUEwQiw0Q0FHM0IsZ0JBQWdCOzRHQUhmLDBCQUEwQixjQURiLE1BQU07OzRGQUNuQiwwQkFBMEI7a0JBRHRDLFVBQVU7bUJBQUMsRUFBRSxVQUFVLEVBQUUsTUFBTSxFQUFFOzswQkFJN0IsTUFBTTsyQkFBQyxnQkFBZ0IiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBJbmplY3RhYmxlLCBJbmplY3QgfSBmcm9tICdAYW5ndWxhci9jb3JlJztcbmltcG9ydCB7IEh0dHBDbGllbnQgfSBmcm9tICdAYW5ndWxhci9jb21tb24vaHR0cCc7XG5pbXBvcnQgeyBPYnNlcnZhYmxlLCBvZiwgdGhyb3dFcnJvciB9IGZyb20gJ3J4anMnO1xuaW1wb3J0IHsgY2F0Y2hFcnJvciwgbWFwIH0gZnJvbSAncnhqcy9vcGVyYXRvcnMnO1xuaW1wb3J0IHsgTUVTU0FHSU5HX0NPTkZJRywgTWVzc2FnaW5nQ29uZmlnIH0gZnJvbSAnLi4vbWVzc2FnaW5nLmNvbmZpZyc7XG5pbXBvcnQgeyBBdXRoU2Vzc2lvbiwgQ29udGFjdCB9IGZyb20gJy4uL21vZGVscy9tZXNzYWdpbmcubW9kZWxzJztcblxuQEluamVjdGFibGUoeyBwcm92aWRlZEluOiAncm9vdCcgfSlcbmV4cG9ydCBjbGFzcyBNZXNzYWdpbmdBdXRoQnJpZGdlU2VydmljZSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgaHR0cDogSHR0cENsaWVudCxcbiAgICBASW5qZWN0KE1FU1NBR0lOR19DT05GSUcpIHByaXZhdGUgY29uZmlnOiBNZXNzYWdpbmdDb25maWdcbiAgKSB7fVxuXG4gIC8qKlxuICAgKiBBdXRoZW50aWNhdGUgd2l0aCBhdXRoLWFwaSB1c2luZyBlbWFpbCBhbmQgcGFzc3dvcmQuXG4gICAqIFJldHVybnMgc2Vzc2lvbl9naWQgYW5kIGNvbnRhY3QgaW5mb3JtYXRpb24uXG4gICAqL1xuICBhdXRoZW50aWNhdGVGb3JNZXNzYWdpbmcoZW1haWw6IHN0cmluZywgcGFzc3dvcmQ6IHN0cmluZyk6IE9ic2VydmFibGU8eyBzZXNzaW9uOiBBdXRoU2Vzc2lvbjsgY29udGFjdDogQ29udGFjdCB9PiB7XG4gICAgcmV0dXJuIHRoaXMuaHR0cC5wb3N0PGFueT4oYCR7dGhpcy5jb25maWcuYXBpQmFzZVVybH0vYXV0aGAsIHtcbiAgICAgIGZ1bmN0aW9uOiAnX2xvZ2luJyxcbiAgICAgIGVtYWlsLFxuICAgICAgcGFzc3dvcmRcbiAgICB9KS5waXBlKFxuICAgICAgbWFwKHJlc3BvbnNlID0+IHtcbiAgICAgICAgY29uc3Qgc2Vzc2lvbjogQXV0aFNlc3Npb24gPSB7XG4gICAgICAgICAgc2Vzc2lvbl9naWQ6IHJlc3BvbnNlLnNlc3Npb25fZ2lkLFxuICAgICAgICAgIHNlc3Npb25fZXhwaXJlczogcmVzcG9uc2Uuc2Vzc2lvbl9leHBpcmVzXG4gICAgICAgIH07XG5cbiAgICAgICAgY29uc3QgY29udGFjdDogQ29udGFjdCA9IHtcbiAgICAgICAgICBjb250YWN0X2lkOiByZXNwb25zZS5jb250YWN0X2lkIHx8IHJlc3BvbnNlLnVzZXJfaWQsXG4gICAgICAgICAgdXNlcl9naWQ6IHJlc3BvbnNlLnVzZXJfZ2lkIHx8IHJlc3BvbnNlLnNlc3Npb25fZ2lkLFxuICAgICAgICAgIGZpcnN0X25hbWU6IHJlc3BvbnNlLmZpcnN0X25hbWUgfHwgZW1haWwuc3BsaXQoJ0AnKVswXSxcbiAgICAgICAgICBsYXN0X25hbWU6IHJlc3BvbnNlLmxhc3RfbmFtZSB8fCAnJyxcbiAgICAgICAgICBlbWFpbDogZW1haWwsXG4gICAgICAgICAgY29tcGFueV9uYW1lOiByZXNwb25zZS5jb21wYW55X25hbWUgfHwgJ0NvcmVsaW5lIEVuZ2luZWVyaW5nIFNvbHV0aW9ucycsXG4gICAgICAgICAgaXNfYWN0aXZlOiB0cnVlXG4gICAgICAgIH07XG5cbiAgICAgICAgcmV0dXJuIHsgc2Vzc2lvbiwgY29udGFjdCB9O1xuICAgICAgfSksXG4gICAgICBjYXRjaEVycm9yKGVycm9yID0+IHtcbiAgICAgICAgY29uc29sZS5lcnJvcignTWVzc2FnaW5nIGF1dGhlbnRpY2F0aW9uIGZhaWxlZDonLCBlcnJvcik7XG4gICAgICAgIHJldHVybiB0aHJvd0Vycm9yKCgpID0+IGVycm9yKTtcbiAgICAgIH0pXG4gICAgKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDaGVjayBpZiBhIG1lc3NhZ2luZyBzZXNzaW9uIGV4aXN0cyBpbiBsb2NhbFN0b3JhZ2UuXG4gICAqL1xuICBoYXNTdG9yZWRTZXNzaW9uKCk6IGJvb2xlYW4ge1xuICAgIGNvbnN0IHN0b3JlZCA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdtZXNzYWdpbmdfc2Vzc2lvbicpO1xuICAgIGlmICghc3RvcmVkKSByZXR1cm4gZmFsc2U7XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgcGFyc2VkID0gSlNPTi5wYXJzZShzdG9yZWQpO1xuICAgICAgcmV0dXJuICEhcGFyc2VkLnNlc3Npb25fZ2lkICYmICEhcGFyc2VkLmNvbnRhY3Q7XG4gICAgfSBjYXRjaCB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEF0dGVtcHQgdG8gdXNlIGV4aXN0aW5nIHNlc3Npb24gdG8gZ2V0IG1lc3NhZ2luZyBzZXNzaW9uLlxuICAgKi9cbiAgaW5pdGlhbGl6ZUZyb21FeGlzdGluZ1Nlc3Npb24oZW1haWw6IHN0cmluZyk6IE9ic2VydmFibGU8eyBzZXNzaW9uOiBBdXRoU2Vzc2lvbjsgY29udGFjdDogQ29udGFjdCB9IHwgbnVsbD4ge1xuICAgIGlmICh0aGlzLmhhc1N0b3JlZFNlc3Npb24oKSkge1xuICAgICAgcmV0dXJuIG9mKG51bGwpOyAvLyBBbHJlYWR5IGF1dGhlbnRpY2F0ZWRcbiAgICB9XG5cbiAgICBjb25zb2xlLmxvZygnTWVzc2FnaW5nIGF1dGhlbnRpY2F0aW9uIHJlcXVpcmVkIGZvcjonLCBlbWFpbCk7XG4gICAgcmV0dXJuIG9mKG51bGwpO1xuICB9XG59XG4iXX0=