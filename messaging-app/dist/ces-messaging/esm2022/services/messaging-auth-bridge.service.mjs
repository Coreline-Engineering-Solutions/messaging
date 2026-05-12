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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVzc2FnaW5nLWF1dGgtYnJpZGdlLnNlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvbGliL3NlcnZpY2VzL21lc3NhZ2luZy1hdXRoLWJyaWRnZS5zZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxFQUFFLE1BQU0sZUFBZSxDQUFDO0FBRW5ELE9BQU8sRUFBYyxFQUFFLEVBQUUsVUFBVSxFQUFFLE1BQU0sTUFBTSxDQUFDO0FBQ2xELE9BQU8sRUFBRSxVQUFVLEVBQUUsR0FBRyxFQUFFLE1BQU0sZ0JBQWdCLENBQUM7QUFDakQsT0FBTyxFQUFFLGdCQUFnQixFQUFtQixNQUFNLHFCQUFxQixDQUFDOzs7QUFJeEUsTUFBTSxPQUFPLDBCQUEwQjtJQUUzQjtJQUMwQjtJQUZwQyxZQUNVLElBQWdCLEVBQ1UsTUFBdUI7UUFEakQsU0FBSSxHQUFKLElBQUksQ0FBWTtRQUNVLFdBQU0sR0FBTixNQUFNLENBQWlCO0lBQ3hELENBQUM7SUFFSjs7O09BR0c7SUFDSCx3QkFBd0IsQ0FBQyxLQUFhLEVBQUUsUUFBZ0I7UUFDdEQsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBTSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsVUFBVSxPQUFPLEVBQUU7WUFDM0QsUUFBUSxFQUFFLFFBQVE7WUFDbEIsS0FBSztZQUNMLFFBQVE7U0FDVCxDQUFDLENBQUMsSUFBSSxDQUNMLEdBQUcsQ0FBQyxRQUFRLENBQUMsRUFBRTtZQUNiLE1BQU0sT0FBTyxHQUFnQjtnQkFDM0IsV0FBVyxFQUFFLFFBQVEsQ0FBQyxXQUFXO2dCQUNqQyxlQUFlLEVBQUUsUUFBUSxDQUFDLGVBQWU7YUFDMUMsQ0FBQztZQUVGLE1BQU0sT0FBTyxHQUFZO2dCQUN2QixVQUFVLEVBQUUsUUFBUSxDQUFDLFVBQVUsSUFBSSxRQUFRLENBQUMsT0FBTztnQkFDbkQsUUFBUSxFQUFFLFFBQVEsQ0FBQyxRQUFRLElBQUksUUFBUSxDQUFDLFdBQVc7Z0JBQ25ELFVBQVUsRUFBRSxRQUFRLENBQUMsVUFBVSxJQUFJLEtBQUssQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUN0RCxTQUFTLEVBQUUsUUFBUSxDQUFDLFNBQVMsSUFBSSxFQUFFO2dCQUNuQyxLQUFLLEVBQUUsS0FBSztnQkFDWixZQUFZLEVBQUUsUUFBUSxDQUFDLFlBQVksSUFBSSxnQ0FBZ0M7Z0JBQ3ZFLFNBQVMsRUFBRSxJQUFJO2FBQ2hCLENBQUM7WUFFRixPQUFPLEVBQUUsT0FBTyxFQUFFLE9BQU8sRUFBRSxDQUFDO1FBQzlCLENBQUMsQ0FBQyxFQUNGLFVBQVUsQ0FBQyxLQUFLLENBQUMsRUFBRTtZQUNqQixPQUFPLENBQUMsS0FBSyxDQUFDLGtDQUFrQyxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBQ3pELE9BQU8sVUFBVSxDQUFDLEdBQUcsRUFBRSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ2pDLENBQUMsQ0FBQyxDQUNILENBQUM7SUFDSixDQUFDO0lBRUQ7O09BRUc7SUFDSCxnQkFBZ0I7UUFDZCxNQUFNLE1BQU0sR0FBRyxZQUFZLENBQUMsT0FBTyxDQUFDLG1CQUFtQixDQUFDLENBQUM7UUFDekQsSUFBSSxDQUFDLE1BQU07WUFBRSxPQUFPLEtBQUssQ0FBQztRQUUxQixJQUFJLENBQUM7WUFDSCxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBQ2xDLE9BQU8sQ0FBQyxDQUFDLE1BQU0sQ0FBQyxXQUFXLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUM7UUFDbEQsQ0FBQztRQUFDLE1BQU0sQ0FBQztZQUNQLE9BQU8sS0FBSyxDQUFDO1FBQ2YsQ0FBQztJQUNILENBQUM7SUFFRDs7T0FFRztJQUNILDZCQUE2QixDQUFDLEtBQWE7UUFDekMsSUFBSSxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsRUFBRSxDQUFDO1lBQzVCLE9BQU8sRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsd0JBQXdCO1FBQzNDLENBQUM7UUFFRCxPQUFPLENBQUMsR0FBRyxDQUFDLHdDQUF3QyxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQzdELE9BQU8sRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ2xCLENBQUM7d0dBbEVVLDBCQUEwQiw0Q0FHM0IsZ0JBQWdCOzRHQUhmLDBCQUEwQixjQURiLE1BQU07OzRGQUNuQiwwQkFBMEI7a0JBRHRDLFVBQVU7bUJBQUMsRUFBRSxVQUFVLEVBQUUsTUFBTSxFQUFFOzswQkFJN0IsTUFBTTsyQkFBQyxnQkFBZ0IiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBJbmplY3RhYmxlLCBJbmplY3QgfSBmcm9tICdAYW5ndWxhci9jb3JlJztcclxuaW1wb3J0IHsgSHR0cENsaWVudCB9IGZyb20gJ0Bhbmd1bGFyL2NvbW1vbi9odHRwJztcclxuaW1wb3J0IHsgT2JzZXJ2YWJsZSwgb2YsIHRocm93RXJyb3IgfSBmcm9tICdyeGpzJztcclxuaW1wb3J0IHsgY2F0Y2hFcnJvciwgbWFwIH0gZnJvbSAncnhqcy9vcGVyYXRvcnMnO1xyXG5pbXBvcnQgeyBNRVNTQUdJTkdfQ09ORklHLCBNZXNzYWdpbmdDb25maWcgfSBmcm9tICcuLi9tZXNzYWdpbmcuY29uZmlnJztcclxuaW1wb3J0IHsgQXV0aFNlc3Npb24sIENvbnRhY3QgfSBmcm9tICcuLi9tb2RlbHMvbWVzc2FnaW5nLm1vZGVscyc7XHJcblxyXG5ASW5qZWN0YWJsZSh7IHByb3ZpZGVkSW46ICdyb290JyB9KVxyXG5leHBvcnQgY2xhc3MgTWVzc2FnaW5nQXV0aEJyaWRnZVNlcnZpY2Uge1xyXG4gIGNvbnN0cnVjdG9yKFxyXG4gICAgcHJpdmF0ZSBodHRwOiBIdHRwQ2xpZW50LFxyXG4gICAgQEluamVjdChNRVNTQUdJTkdfQ09ORklHKSBwcml2YXRlIGNvbmZpZzogTWVzc2FnaW5nQ29uZmlnXHJcbiAgKSB7fVxyXG5cclxuICAvKipcclxuICAgKiBBdXRoZW50aWNhdGUgd2l0aCBhdXRoLWFwaSB1c2luZyBlbWFpbCBhbmQgcGFzc3dvcmQuXHJcbiAgICogUmV0dXJucyBzZXNzaW9uX2dpZCBhbmQgY29udGFjdCBpbmZvcm1hdGlvbi5cclxuICAgKi9cclxuICBhdXRoZW50aWNhdGVGb3JNZXNzYWdpbmcoZW1haWw6IHN0cmluZywgcGFzc3dvcmQ6IHN0cmluZyk6IE9ic2VydmFibGU8eyBzZXNzaW9uOiBBdXRoU2Vzc2lvbjsgY29udGFjdDogQ29udGFjdCB9PiB7XHJcbiAgICByZXR1cm4gdGhpcy5odHRwLnBvc3Q8YW55PihgJHt0aGlzLmNvbmZpZy5hcGlCYXNlVXJsfS9hdXRoYCwge1xyXG4gICAgICBmdW5jdGlvbjogJ19sb2dpbicsXHJcbiAgICAgIGVtYWlsLFxyXG4gICAgICBwYXNzd29yZFxyXG4gICAgfSkucGlwZShcclxuICAgICAgbWFwKHJlc3BvbnNlID0+IHtcclxuICAgICAgICBjb25zdCBzZXNzaW9uOiBBdXRoU2Vzc2lvbiA9IHtcclxuICAgICAgICAgIHNlc3Npb25fZ2lkOiByZXNwb25zZS5zZXNzaW9uX2dpZCxcclxuICAgICAgICAgIHNlc3Npb25fZXhwaXJlczogcmVzcG9uc2Uuc2Vzc2lvbl9leHBpcmVzXHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgY29uc3QgY29udGFjdDogQ29udGFjdCA9IHtcclxuICAgICAgICAgIGNvbnRhY3RfaWQ6IHJlc3BvbnNlLmNvbnRhY3RfaWQgfHwgcmVzcG9uc2UudXNlcl9pZCxcclxuICAgICAgICAgIHVzZXJfZ2lkOiByZXNwb25zZS51c2VyX2dpZCB8fCByZXNwb25zZS5zZXNzaW9uX2dpZCxcclxuICAgICAgICAgIGZpcnN0X25hbWU6IHJlc3BvbnNlLmZpcnN0X25hbWUgfHwgZW1haWwuc3BsaXQoJ0AnKVswXSxcclxuICAgICAgICAgIGxhc3RfbmFtZTogcmVzcG9uc2UubGFzdF9uYW1lIHx8ICcnLFxyXG4gICAgICAgICAgZW1haWw6IGVtYWlsLFxyXG4gICAgICAgICAgY29tcGFueV9uYW1lOiByZXNwb25zZS5jb21wYW55X25hbWUgfHwgJ0NvcmVsaW5lIEVuZ2luZWVyaW5nIFNvbHV0aW9ucycsXHJcbiAgICAgICAgICBpc19hY3RpdmU6IHRydWVcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICByZXR1cm4geyBzZXNzaW9uLCBjb250YWN0IH07XHJcbiAgICAgIH0pLFxyXG4gICAgICBjYXRjaEVycm9yKGVycm9yID0+IHtcclxuICAgICAgICBjb25zb2xlLmVycm9yKCdNZXNzYWdpbmcgYXV0aGVudGljYXRpb24gZmFpbGVkOicsIGVycm9yKTtcclxuICAgICAgICByZXR1cm4gdGhyb3dFcnJvcigoKSA9PiBlcnJvcik7XHJcbiAgICAgIH0pXHJcbiAgICApO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ2hlY2sgaWYgYSBtZXNzYWdpbmcgc2Vzc2lvbiBleGlzdHMgaW4gbG9jYWxTdG9yYWdlLlxyXG4gICAqL1xyXG4gIGhhc1N0b3JlZFNlc3Npb24oKTogYm9vbGVhbiB7XHJcbiAgICBjb25zdCBzdG9yZWQgPSBsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnbWVzc2FnaW5nX3Nlc3Npb24nKTtcclxuICAgIGlmICghc3RvcmVkKSByZXR1cm4gZmFsc2U7XHJcblxyXG4gICAgdHJ5IHtcclxuICAgICAgY29uc3QgcGFyc2VkID0gSlNPTi5wYXJzZShzdG9yZWQpO1xyXG4gICAgICByZXR1cm4gISFwYXJzZWQuc2Vzc2lvbl9naWQgJiYgISFwYXJzZWQuY29udGFjdDtcclxuICAgIH0gY2F0Y2gge1xyXG4gICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBBdHRlbXB0IHRvIHVzZSBleGlzdGluZyBzZXNzaW9uIHRvIGdldCBtZXNzYWdpbmcgc2Vzc2lvbi5cclxuICAgKi9cclxuICBpbml0aWFsaXplRnJvbUV4aXN0aW5nU2Vzc2lvbihlbWFpbDogc3RyaW5nKTogT2JzZXJ2YWJsZTx7IHNlc3Npb246IEF1dGhTZXNzaW9uOyBjb250YWN0OiBDb250YWN0IH0gfCBudWxsPiB7XHJcbiAgICBpZiAodGhpcy5oYXNTdG9yZWRTZXNzaW9uKCkpIHtcclxuICAgICAgcmV0dXJuIG9mKG51bGwpOyAvLyBBbHJlYWR5IGF1dGhlbnRpY2F0ZWRcclxuICAgIH1cclxuXHJcbiAgICBjb25zb2xlLmxvZygnTWVzc2FnaW5nIGF1dGhlbnRpY2F0aW9uIHJlcXVpcmVkIGZvcjonLCBlbWFpbCk7XHJcbiAgICByZXR1cm4gb2YobnVsbCk7XHJcbiAgfVxyXG59XHJcbiJdfQ==