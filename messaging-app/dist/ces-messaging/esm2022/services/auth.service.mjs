import { Injectable, Inject } from '@angular/core';
import { BehaviorSubject, of } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { MESSAGING_CONFIG } from '../messaging.config';
import { warnEmailLikeContactId } from '../messaging-dev-warnings';
import * as i0 from "@angular/core";
import * as i1 from "@angular/common/http";
export class AuthService {
    http;
    config;
    sessionGid$ = new BehaviorSubject(null);
    currentContact$ = new BehaviorSubject(null);
    session$ = this.sessionGid$.asObservable();
    contact$ = this.currentContact$.asObservable();
    constructor(http, config) {
        this.http = http;
        this.config = config;
        const saved = localStorage.getItem('messaging_session');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                this.sessionGid$.next(parsed.session_gid);
                if (parsed.contact) {
                    this.currentContact$.next(parsed.contact);
                }
            }
            catch { /* ignore */ }
        }
    }
    get sessionGid() {
        return this.sessionGid$.value;
    }
    get currentContact() {
        return this.currentContact$.value;
    }
    get contactId() {
        return this.currentContact$.value?.contact_id ?? null;
    }
    login(email, password, apiBaseUrlOverride) {
        const base = (apiBaseUrlOverride ?? this.config.apiBaseUrl).replace(/\/$/, '');
        return this.http.post(`${base}/auth`, {
            function: '_login',
            email,
            password,
        }).pipe(tap((res) => {
            this.sessionGid$.next(res.session_gid);
            this.persistSession();
        }));
    }
    setSession(sessionGid, contact) {
        warnEmailLikeContactId(contact.contact_id);
        this.sessionGid$.next(sessionGid);
        this.currentContact$.next(contact);
        this.persistSession();
    }
    setDemoSession(sessionGid, contact) {
        this.setSession(sessionGid, contact);
    }
    logout() {
        this.sessionGid$.next(null);
        this.currentContact$.next(null);
        localStorage.removeItem('messaging_session');
    }
    isAuthenticated() {
        return !!this.sessionGid$.value && !!this.currentContact$.value;
    }
    refreshMessagingSession() {
        const token = this.sessionGid$.value;
        if (!token)
            return of(null);
        return this.http.get(`${this.config.apiBaseUrl}/messaging/auth/me`, {
            headers: {
                'X-Messaging-Session': token,
            },
        }).pipe(map((res) => {
            const existing = this.currentContact$.value;
            const contact = {
                contact_id: String(res.contact_id),
                user_gid: String(res.user_gid || existing?.user_gid || ''),
                email: String(res.email || existing?.email || ''),
                username: existing?.username,
                first_name: existing?.first_name,
                last_name: existing?.last_name,
                company_name: existing?.company_name || '',
                profile_image_url: existing?.profile_image_url,
                phone: existing?.phone,
                is_active: true,
            };
            this.currentContact$.next(contact);
            this.persistSession();
            return contact;
        }), catchError(() => {
            this.logout();
            return of(null);
        }));
    }
    persistSession() {
        const data = {
            session_gid: this.sessionGid$.value,
            contact: this.currentContact$.value,
        };
        localStorage.setItem('messaging_session', JSON.stringify(data));
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: AuthService, deps: [{ token: i1.HttpClient }, { token: MESSAGING_CONFIG }], target: i0.ɵɵFactoryTarget.Injectable });
    static ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: AuthService, providedIn: 'root' });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: AuthService, decorators: [{
            type: Injectable,
            args: [{ providedIn: 'root' }]
        }], ctorParameters: () => [{ type: i1.HttpClient }, { type: undefined, decorators: [{
                    type: Inject,
                    args: [MESSAGING_CONFIG]
                }] }] });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXV0aC5zZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL2xpYi9zZXJ2aWNlcy9hdXRoLnNlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLEVBQUUsTUFBTSxlQUFlLENBQUM7QUFFbkQsT0FBTyxFQUFFLGVBQWUsRUFBYyxFQUFFLEVBQUUsTUFBTSxNQUFNLENBQUM7QUFDdkQsT0FBTyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsVUFBVSxFQUFFLE1BQU0sZ0JBQWdCLENBQUM7QUFDdEQsT0FBTyxFQUFFLGdCQUFnQixFQUFtQixNQUFNLHFCQUFxQixDQUFDO0FBQ3hFLE9BQU8sRUFBRSxzQkFBc0IsRUFBRSxNQUFNLDJCQUEyQixDQUFDOzs7QUFJbkUsTUFBTSxPQUFPLFdBQVc7SUFRWjtJQUMwQjtJQVI1QixXQUFXLEdBQUcsSUFBSSxlQUFlLENBQWdCLElBQUksQ0FBQyxDQUFDO0lBQ3ZELGVBQWUsR0FBRyxJQUFJLGVBQWUsQ0FBaUIsSUFBSSxDQUFDLENBQUM7SUFFM0QsUUFBUSxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsWUFBWSxFQUFFLENBQUM7SUFDM0MsUUFBUSxHQUFHLElBQUksQ0FBQyxlQUFlLENBQUMsWUFBWSxFQUFFLENBQUM7SUFFeEQsWUFDVSxJQUFnQixFQUNVLE1BQXVCO1FBRGpELFNBQUksR0FBSixJQUFJLENBQVk7UUFDVSxXQUFNLEdBQU4sTUFBTSxDQUFpQjtRQUV6RCxNQUFNLEtBQUssR0FBRyxZQUFZLENBQUMsT0FBTyxDQUFDLG1CQUFtQixDQUFDLENBQUM7UUFDeEQsSUFBSSxLQUFLLEVBQUUsQ0FBQztZQUNWLElBQUksQ0FBQztnQkFDSCxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDO2dCQUNqQyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxNQUFNLENB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RSxDQUFDO3dHQTlHVSxXQUFXLDRDQVNaLGdCQUFnQjs0R0FUZixXQUFXLGNBREUsTUFBTTs7NEZBQ25CLFdBQVc7a0JBRHZCLFVBQVU7bUJBQUMsRUFBRSxVQUFVLEVBQUUsTUFBTSxFQUFFOzswQkFVN0IsTUFBTTsyQkFBQyxnQkFBZ0IiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBJbmplY3RhYmxlLCBJbmplY3QgfSBmcm9tICdAYW5ndWxhci9jb3JlJztcclxuaW1wb3J0IHsgSHR0cENsaWVudCB9IGZyb20gJ0Bhbmd1bGFyL2NvbW1vbi9odHRwJztcclxuaW1wb3J0IHsgQmVoYXZpb3JTdWJqZWN0LCBPYnNlcnZhYmxlLCBvZiB9IGZyb20gJ3J4anMnO1xyXG5pbXBvcnQgeyBtYXAsIHRhcCwgY2F0Y2hFcnJvciB9IGZyb20gJ3J4anMvb3BlcmF0b3JzJztcclxuaW1wb3J0IHsgTUVTU0FHSU5HX0NPTkZJRywgTWVzc2FnaW5nQ29uZmlnIH0gZnJvbSAnLi4vbWVzc2FnaW5nLmNvbmZpZyc7XHJcbmltcG9ydCB7IHdhcm5FbWFpbExpa2VDb250YWN0SWQgfSBmcm9tICcuLi9tZXNzYWdpbmctZGV2LXdhcm5pbmdzJztcclxuaW1wb3J0IHsgQXV0aFNlc3Npb24sIENvbnRhY3QgfSBmcm9tICcuLi9tb2RlbHMvbWVzc2FnaW5nLm1vZGVscyc7XHJcblxyXG5ASW5qZWN0YWJsZSh7IHByb3ZpZGVkSW46ICdyb290JyB9KVxyXG5leHBvcnQgY2xhc3MgQXV0aFNlcnZpY2Uge1xyXG4gIHByaXZhdGUgc2Vzc2lvbkdpZCQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PHN0cmluZyB8IG51bGw+KG51bGwpO1xyXG4gIHByaXZhdGUgY3VycmVudENvbnRhY3QkID0gbmV3IEJlaGF2aW9yU3ViamVjdDxDb250YWN0IHwgbnVsbD4obnVsbCk7XHJcblxyXG4gIHJlYWRvbmx5IHNlc3Npb24kID0gdGhpcy5zZXNzaW9uR2lkJC5hc09ic2VydmFibGUoKTtcclxuICByZWFkb25seSBjb250YWN0JCA9IHRoaXMuY3VycmVudENvbnRhY3QkLmFzT2JzZXJ2YWJsZSgpO1xyXG5cclxuICBjb25zdHJ1Y3RvcihcclxuICAgIHByaXZhdGUgaHR0cDogSHR0cENsaWVudCxcclxuICAgIEBJbmplY3QoTUVTU0FHSU5HX0NPTkZJRykgcHJpdmF0ZSBjb25maWc6IE1lc3NhZ2luZ0NvbmZpZ1xyXG4gICkge1xyXG4gICAgY29uc3Qgc2F2ZWQgPSBsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnbWVzc2FnaW5nX3Nlc3Npb24nKTtcclxuICAgIGlmIChzYXZlZCkge1xyXG4gICAgICB0cnkge1xyXG4gICAgICAgIGNvbnN0IHBhcnNlZCA9IEpTT04ucGFyc2Uoc2F2ZWQpO1xyXG4gICAgICAgIHRoaXMuc2Vzc2lvbkdpZCQubmV4dChwYXJzZWQuc2Vzc2lvbl9naWQpO1xyXG4gICAgICAgIGlmIChwYXJzZWQuY29udGFjdCkge1xyXG4gICAgICAgICAgdGhpcy5jdXJyZW50Q29udGFjdCQubmV4dChwYXJzZWQuY29udGFjdCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9IGNhdGNoIHsgLyogaWdub3JlICovIH1cclxuICAgIH1cclxuICB9XHJcblxyXG4gIGdldCBzZXNzaW9uR2lkKCk6IHN0cmluZyB8IG51bGwge1xyXG4gICAgcmV0dXJuIHRoaXMuc2Vzc2lvbkdpZCQudmFsdWU7XHJcbiAgfVxyXG5cclxuICBnZXQgY3VycmVudENvbnRhY3QoKTogQ29udGFjdCB8IG51bGwge1xyXG4gICAgcmV0dXJuIHRoaXMuY3VycmVudENvbnRhY3QkLnZhbHVlO1xyXG4gIH1cclxuXHJcbiAgZ2V0IGNvbnRhY3RJZCgpOiBzdHJpbmcgfCBudWxsIHtcclxuICAgIHJldHVybiB0aGlzLmN1cnJlbnRDb250YWN0JC52YWx1ZT8uY29udGFjdF9pZCA/PyBudWxsO1xyXG4gIH1cclxuXHJcbiAgbG9naW4oZW1haWw6IHN0cmluZywgcGFzc3dvcmQ6IHN0cmluZywgYXBpQmFzZVVybE92ZXJyaWRlPzogc3RyaW5nKTogT2JzZXJ2YWJsZTxBdXRoU2Vzc2lvbj4ge1xyXG4gICAgY29uc3QgYmFzZSA9IChhcGlCYXNlVXJsT3ZlcnJpZGUgPz8gdGhpcy5jb25maWcuYXBpQmFzZVVybCkucmVwbGFjZSgvXFwvJC8sICcnKTtcclxuICAgIHJldHVybiB0aGlzLmh0dHAucG9zdDxBdXRoU2Vzc2lvbj4oYCR7YmFzZX0vYXV0aGAsIHtcclxuICAgICAgZnVuY3Rpb246ICdfbG9naW4nLFxyXG4gICAgICBlbWFpbCxcclxuICAgICAgcGFzc3dvcmQsXHJcbiAgICB9KS5waXBlKFxyXG4gICAgICB0YXAoKHJlcykgPT4ge1xyXG4gICAgICAgIHRoaXMuc2Vzc2lvbkdpZCQubmV4dChyZXMuc2Vzc2lvbl9naWQpO1xyXG4gICAgICAgIHRoaXMucGVyc2lzdFNlc3Npb24oKTtcclxuICAgICAgfSlcclxuICAgICk7XHJcbiAgfVxyXG5cclxuICBzZXRTZXNzaW9uKHNlc3Npb25HaWQ6IHN0cmluZywgY29udGFjdDogQ29udGFjdCk6IHZvaWQge1xyXG4gICAgd2FybkVtYWlsTGlrZUNvbnRhY3RJZChjb250YWN0LmNvbnRhY3RfaWQpO1xyXG4gICAgdGhpcy5zZXNzaW9uR2lkJC5uZXh0KHNlc3Npb25HaWQpO1xyXG4gICAgdGhpcy5jdXJyZW50Q29udGFjdCQubmV4dChjb250YWN0KTtcclxuICAgIHRoaXMucGVyc2lzdFNlc3Npb24oKTtcclxuICB9XHJcblxyXG4gIHNldERlbW9TZXNzaW9uKHNlc3Npb25HaWQ6IHN0cmluZywgY29udGFjdDogQ29udGFjdCk6IHZvaWQge1xyXG4gICAgdGhpcy5zZXRTZXNzaW9uKHNlc3Npb25HaWQsIGNvbnRhY3QpO1xyXG4gIH1cclxuXHJcbiAgbG9nb3V0KCk6IHZvaWQge1xyXG4gICAgdGhpcy5zZXNzaW9uR2lkJC5uZXh0KG51bGwpO1xyXG4gICAgdGhpcy5jdXJyZW50Q29udGFjdCQubmV4dChudWxsKTtcclxuICAgIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKCdtZXNzYWdpbmdfc2Vzc2lvbicpO1xyXG4gIH1cclxuXHJcbiAgaXNBdXRoZW50aWNhdGVkKCk6IGJvb2xlYW4ge1xyXG4gICAgcmV0dXJuICEhdGhpcy5zZXNzaW9uR2lkJC52YWx1ZSAmJiAhIXRoaXMuY3VycmVudENvbnRhY3QkLnZhbHVlO1xyXG4gIH1cclxuXHJcbiAgcmVmcmVzaE1lc3NhZ2luZ1Nlc3Npb24oKTogT2JzZXJ2YWJsZTxDb250YWN0IHwgbnVsbD4ge1xyXG4gICAgY29uc3QgdG9rZW4gPSB0aGlzLnNlc3Npb25HaWQkLnZhbHVlO1xyXG4gICAgaWYgKCF0b2tlbikgcmV0dXJuIG9mKG51bGwpO1xyXG5cclxuICAgIHJldHVybiB0aGlzLmh0dHAuZ2V0PGFueT4oYCR7dGhpcy5jb25maWcuYXBpQmFzZVVybH0vbWVzc2FnaW5nL2F1dGgvbWVgLCB7XHJcbiAgICAgIGhlYWRlcnM6IHtcclxuICAgICAgICAnWC1NZXNzYWdpbmctU2Vzc2lvbic6IHRva2VuLFxyXG4gICAgICB9LFxyXG4gICAgfSkucGlwZShcclxuICAgICAgbWFwKChyZXMpID0+IHtcclxuICAgICAgICBjb25zdCBleGlzdGluZyA9IHRoaXMuY3VycmVudENvbnRhY3QkLnZhbHVlO1xyXG4gICAgICAgIGNvbnN0IGNvbnRhY3Q6IENvbnRhY3QgPSB7XHJcbiAgICAgICAgICBjb250YWN0X2lkOiBTdHJpbmcocmVzLmNvbnRhY3RfaWQpLFxyXG4gICAgICAgICAgdXNlcl9naWQ6IFN0cmluZyhyZXMudXNlcl9naWQgfHwgZXhpc3Rpbmc/LnVzZXJfZ2lkIHx8ICcnKSxcclxuICAgICAgICAgIGVtYWlsOiBTdHJpbmcocmVzLmVtYWlsIHx8IGV4aXN0aW5nPy5lbWFpbCB8fCAnJyksXHJcbiAgICAgICAgICB1c2VybmFtZTogZXhpc3Rpbmc/LnVzZXJuYW1lLFxyXG4gICAgICAgICAgZmlyc3RfbmFtZTogZXhpc3Rpbmc/LmZpcnN0X25hbWUsXHJcbiAgICAgICAgICBsYXN0X25hbWU6IGV4aXN0aW5nPy5sYXN0X25hbWUsXHJcbiAgICAgICAgICBjb21wYW55X25hbWU6IGV4aXN0aW5nPy5jb21wYW55X25hbWUgfHwgJycsXHJcbiAgICAgICAgICBwcm9maWxlX2ltYWdlX3VybDogZXhpc3Rpbmc/LnByb2ZpbGVfaW1hZ2VfdXJsLFxyXG4gICAgICAgICAgcGhvbmU6IGV4aXN0aW5nPy5waG9uZSxcclxuICAgICAgICAgIGlzX2FjdGl2ZTogdHJ1ZSxcclxuICAgICAgICB9O1xyXG4gICAgICAgIHRoaXMuY3VycmVudENvbnRhY3QkLm5leHQoY29udGFjdCk7XHJcbiAgICAgICAgdGhpcy5wZXJzaXN0U2Vzc2lvbigpO1xyXG4gICAgICAgIHJldHVybiBjb250YWN0O1xyXG4gICAgICB9KSxcclxuICAgICAgY2F0Y2hFcnJvcigoKSA9PiB7XHJcbiAgICAgICAgdGhpcy5sb2dvdXQoKTtcclxuICAgICAgICByZXR1cm4gb2YobnVsbCk7XHJcbiAgICAgIH0pXHJcbiAgICApO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBwZXJzaXN0U2Vzc2lvbigpOiB2b2lkIHtcclxuICAgIGNvbnN0IGRhdGEgPSB7XHJcbiAgICAgIHNlc3Npb25fZ2lkOiB0aGlzLnNlc3Npb25HaWQkLnZhbHVlLFxyXG4gICAgICBjb250YWN0OiB0aGlzLmN1cnJlbnRDb250YWN0JC52YWx1ZSxcclxuICAgIH07XHJcbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnbWVzc2FnaW5nX3Nlc3Npb24nLCBKU09OLnN0cmluZ2lmeShkYXRhKSk7XHJcbiAgfVxyXG59XHJcbiJdfQ==