import { Injectable, Inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MESSAGING_CONFIG } from '../messaging.config';
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXV0aC5zZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL2xpYi9zZXJ2aWNlcy9hdXRoLnNlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLEVBQUUsTUFBTSxlQUFlLENBQUM7QUFFbkQsT0FBTyxFQUFFLGVBQWUsRUFBa0IsTUFBTSxNQUFNLENBQUM7QUFDdkQsT0FBTyxFQUFFLEdBQUcsRUFBYyxNQUFNLGdCQUFnQixDQUFDO0FBQ2pELE9BQU8sRUFBRSxnQkFBZ0IsRUFBbUIsTUFBTSxxQkFBcUIsQ0FBQzs7O0FBSXhFLE1BQU0sT0FBTyxXQUFXO0lBUVo7SUFDMEI7SUFSNUIsV0FBVyxHQUFHLElBQUksZUFBZSxDQUFnQixJQUFJLENBQUMsQ0FBQztJQUN2RCxlQUFlLEdBQUcsSUFBSSxlQUFlLENBQWlCLElBQUksQ0FBQyxDQUFDO0lBRTNELFFBQVEsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLFlBQVksRUFBRSxDQUFDO0lBQzNDLFFBQVEsR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLFlBQVksRUFBRSxDQUFDO0lBRXhELFlBQ1UsSUFBZ0IsRUFDVSxNQUF1QjtRQURqRCxTQUFJLEdBQUosSUFBSSxDQUFZO1FBQ1UsV0FBTSxHQUFOLE1BQU0sQ0FBaUI7UUFFekQsTUFBTSxLQUFLLEdBQUcsWUFBWSxDQUFDLE9BQU8sQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO1FBQ3hELElBQUksS0FBSyxFQUFFLENBQUM7WUFDVixJQUFJLENBQUM7Z0JBQ0gsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQztnQkFDakMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxDQUFDO2dCQUMxQyxJQUFJLE1BQU0sQ0FBQyxPQUFPLEVBQUUsQ0FBQztvQkFDbkIsSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDO2dCQUM1QyxDQUFDO1lBQ0gsQ0FBQztZQUFDLE1BQU0sQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDO1FBQzFCLENBQUM7SUFDSCxDQUFDO0lBRUQsSUFBSSxVQUFVO1FBQ1osT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQztJQUNoQyxDQUFDO0lBRUQsSUFBSSxjQUFjO1FBQ2hCLE9BQU8sSUFBSSxDQUFDLGVBQWUsQ0FBQyxLQUFLLENBQUM7SUFDcEMsQ0FBQztJQUVELElBQUksU0FBUztRQUNYLE9BQU8sSUFBSSxDQUFDLGVBQWUsQ0FBQyxLQUFLLEVBQUUsVUFBVSxJQUFJLElBQUksQ0FBQztJQUN4RCxDQUFDO0lBRUQsS0FBSyxDQUFDLEtBQWEsRUFBRSxRQUFnQixFQUFFLGtCQUEyQjtRQUNoRSxNQUFNLElBQUksR0FBRyxDQUFDLGtCQUFrQixJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztRQUMvRSxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFjLEdBQUcsSUFBSSxPQUFPLEVBQUU7WUFDakQsUUFBUSxFQUFFLFFBQVE7WUFDbEIsS0FBSztZQUNMLFFBQVE7U0FDVCxDQUFDLENBQUMsSUFBSSxDQUNMLEdBQUcsQ0FBQyxDQUFDLEdBQUcsRUFBRSxFQUFFO1lBQ1YsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxDQUFDO1lBQ3ZDLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQztRQUN4QixDQUFDLENBQUMsQ0FDSCxDQUFDO0lBQ0osQ0FBQztJQUVELFVBQVUsQ0FBQyxVQUFrQixFQUFFLE9BQWdCO1FBQzdDLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQ2xDLElBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ25DLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQztJQUN4QixDQUFDO0lBRUQsY0FBYyxDQUFDLFVBQWtCLEVBQUUsT0FBZ0I7UUFDakQsSUFBSSxDQUFDLFVBQVUsQ0FBQyxVQUFVLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDdkMsQ0FBQztJQUVELE1BQU07UUFDSixJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUM1QixJQUFJLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNoQyxZQUFZLENBQUMsVUFBVSxDQUFDLG1CQUFtQixDQUFDLENBQUM7SUFDL0MsQ0FBQztJQUVELGVBQWU7UUFDYixPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLEtBQUssSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxLQUFLLENBQUM7SUFDbEUsQ0FBQztJQUVPLGNBQWM7UUFDcEIsTUFBTSxJQUFJLEdBQUc7WUFDWCxXQUFXLEVBQUUsSUFBSSxDQUFDLFdBQVcsQ0FBQyxLQUFLO1lBQ25DLE9BQU8sRUFBRSxJQUFJLENBQUMsZUFBZSxDQUFDLEtBQUs7U0FDcEMsQ0FBQztRQUNGLFlBQVksQ0FBQyxPQUFPLENBQUMsbUJBQW1CLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBQ2xFLENBQUM7d0dBM0VVLFdBQVcsNENBU1osZ0JBQWdCOzRHQVRmLFdBQVcsY0FERSxNQUFNOzs0RkFDbkIsV0FBVztrQkFEdkIsVUFBVTttQkFBQyxFQUFFLFVBQVUsRUFBRSxNQUFNLEVBQUU7OzBCQVU3QixNQUFNOzJCQUFDLGdCQUFnQiIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEluamVjdGFibGUsIEluamVjdCB9IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xyXG5pbXBvcnQgeyBIdHRwQ2xpZW50IH0gZnJvbSAnQGFuZ3VsYXIvY29tbW9uL2h0dHAnO1xyXG5pbXBvcnQgeyBCZWhhdmlvclN1YmplY3QsIE9ic2VydmFibGUsIG9mIH0gZnJvbSAncnhqcyc7XHJcbmltcG9ydCB7IHRhcCwgY2F0Y2hFcnJvciB9IGZyb20gJ3J4anMvb3BlcmF0b3JzJztcclxuaW1wb3J0IHsgTUVTU0FHSU5HX0NPTkZJRywgTWVzc2FnaW5nQ29uZmlnIH0gZnJvbSAnLi4vbWVzc2FnaW5nLmNvbmZpZyc7XHJcbmltcG9ydCB7IEF1dGhTZXNzaW9uLCBDb250YWN0IH0gZnJvbSAnLi4vbW9kZWxzL21lc3NhZ2luZy5tb2RlbHMnO1xyXG5cclxuQEluamVjdGFibGUoeyBwcm92aWRlZEluOiAncm9vdCcgfSlcclxuZXhwb3J0IGNsYXNzIEF1dGhTZXJ2aWNlIHtcclxuICBwcml2YXRlIHNlc3Npb25HaWQkID0gbmV3IEJlaGF2aW9yU3ViamVjdDxzdHJpbmcgfCBudWxsPihudWxsKTtcclxuICBwcml2YXRlIGN1cnJlbnRDb250YWN0JCA9IG5ldyBCZWhhdmlvclN1YmplY3Q8Q29udGFjdCB8IG51bGw+KG51bGwpO1xyXG5cclxuICByZWFkb25seSBzZXNzaW9uJCA9IHRoaXMuc2Vzc2lvbkdpZCQuYXNPYnNlcnZhYmxlKCk7XHJcbiAgcmVhZG9ubHkgY29udGFjdCQgPSB0aGlzLmN1cnJlbnRDb250YWN0JC5hc09ic2VydmFibGUoKTtcclxuXHJcbiAgY29uc3RydWN0b3IoXHJcbiAgICBwcml2YXRlIGh0dHA6IEh0dHBDbGllbnQsXHJcbiAgICBASW5qZWN0KE1FU1NBR0lOR19DT05GSUcpIHByaXZhdGUgY29uZmlnOiBNZXNzYWdpbmdDb25maWdcclxuICApIHtcclxuICAgIGNvbnN0IHNhdmVkID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ21lc3NhZ2luZ19zZXNzaW9uJyk7XHJcbiAgICBpZiAoc2F2ZWQpIHtcclxuICAgICAgdHJ5IHtcclxuICAgICAgICBjb25zdCBwYXJzZWQgPSBKU09OLnBhcnNlKHNhdmVkKTtcclxuICAgICAgICB0aGlzLnNlc3Npb25HaWQkLm5leHQocGFyc2VkLnNlc3Npb25fZ2lkKTtcclxuICAgICAgICBpZiAocGFyc2VkLmNvbnRhY3QpIHtcclxuICAgICAgICAgIHRoaXMuY3VycmVudENvbnRhY3QkLm5leHQocGFyc2VkLmNvbnRhY3QpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSBjYXRjaCB7IC8qIGlnbm9yZSAqLyB9XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBnZXQgc2Vzc2lvbkdpZCgpOiBzdHJpbmcgfCBudWxsIHtcclxuICAgIHJldHVybiB0aGlzLnNlc3Npb25HaWQkLnZhbHVlO1xyXG4gIH1cclxuXHJcbiAgZ2V0IGN1cnJlbnRDb250YWN0KCk6IENvbnRhY3QgfCBudWxsIHtcclxuICAgIHJldHVybiB0aGlzLmN1cnJlbnRDb250YWN0JC52YWx1ZTtcclxuICB9XHJcblxyXG4gIGdldCBjb250YWN0SWQoKTogc3RyaW5nIHwgbnVsbCB7XHJcbiAgICByZXR1cm4gdGhpcy5jdXJyZW50Q29udGFjdCQudmFsdWU/LmNvbnRhY3RfaWQgPz8gbnVsbDtcclxuICB9XHJcblxyXG4gIGxvZ2luKGVtYWlsOiBzdHJpbmcsIHBhc3N3b3JkOiBzdHJpbmcsIGFwaUJhc2VVcmxPdmVycmlkZT86IHN0cmluZyk6IE9ic2VydmFibGU8QXV0aFNlc3Npb24+IHtcclxuICAgIGNvbnN0IGJhc2UgPSAoYXBpQmFzZVVybE92ZXJyaWRlID8/IHRoaXMuY29uZmlnLmFwaUJhc2VVcmwpLnJlcGxhY2UoL1xcLyQvLCAnJyk7XHJcbiAgICByZXR1cm4gdGhpcy5odHRwLnBvc3Q8QXV0aFNlc3Npb24+KGAke2Jhc2V9L2F1dGhgLCB7XHJcbiAgICAgIGZ1bmN0aW9uOiAnX2xvZ2luJyxcclxuICAgICAgZW1haWwsXHJcbiAgICAgIHBhc3N3b3JkLFxyXG4gICAgfSkucGlwZShcclxuICAgICAgdGFwKChyZXMpID0+IHtcclxuICAgICAgICB0aGlzLnNlc3Npb25HaWQkLm5leHQocmVzLnNlc3Npb25fZ2lkKTtcclxuICAgICAgICB0aGlzLnBlcnNpc3RTZXNzaW9uKCk7XHJcbiAgICAgIH0pXHJcbiAgICApO1xyXG4gIH1cclxuXHJcbiAgc2V0U2Vzc2lvbihzZXNzaW9uR2lkOiBzdHJpbmcsIGNvbnRhY3Q6IENvbnRhY3QpOiB2b2lkIHtcclxuICAgIHRoaXMuc2Vzc2lvbkdpZCQubmV4dChzZXNzaW9uR2lkKTtcclxuICAgIHRoaXMuY3VycmVudENvbnRhY3QkLm5leHQoY29udGFjdCk7XHJcbiAgICB0aGlzLnBlcnNpc3RTZXNzaW9uKCk7XHJcbiAgfVxyXG5cclxuICBzZXREZW1vU2Vzc2lvbihzZXNzaW9uR2lkOiBzdHJpbmcsIGNvbnRhY3Q6IENvbnRhY3QpOiB2b2lkIHtcclxuICAgIHRoaXMuc2V0U2Vzc2lvbihzZXNzaW9uR2lkLCBjb250YWN0KTtcclxuICB9XHJcblxyXG4gIGxvZ291dCgpOiB2b2lkIHtcclxuICAgIHRoaXMuc2Vzc2lvbkdpZCQubmV4dChudWxsKTtcclxuICAgIHRoaXMuY3VycmVudENvbnRhY3QkLm5leHQobnVsbCk7XHJcbiAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSgnbWVzc2FnaW5nX3Nlc3Npb24nKTtcclxuICB9XHJcblxyXG4gIGlzQXV0aGVudGljYXRlZCgpOiBib29sZWFuIHtcclxuICAgIHJldHVybiAhIXRoaXMuc2Vzc2lvbkdpZCQudmFsdWUgJiYgISF0aGlzLmN1cnJlbnRDb250YWN0JC52YWx1ZTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgcGVyc2lzdFNlc3Npb24oKTogdm9pZCB7XHJcbiAgICBjb25zdCBkYXRhID0ge1xyXG4gICAgICBzZXNzaW9uX2dpZDogdGhpcy5zZXNzaW9uR2lkJC52YWx1ZSxcclxuICAgICAgY29udGFjdDogdGhpcy5jdXJyZW50Q29udGFjdCQudmFsdWUsXHJcbiAgICB9O1xyXG4gICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ21lc3NhZ2luZ19zZXNzaW9uJywgSlNPTi5zdHJpbmdpZnkoZGF0YSkpO1xyXG4gIH1cclxufVxyXG4iXX0=