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
    login(email, password) {
        return this.http.post(`${this.config.apiBaseUrl}/auth`, {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXV0aC5zZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL2xpYi9zZXJ2aWNlcy9hdXRoLnNlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLEVBQUUsTUFBTSxlQUFlLENBQUM7QUFFbkQsT0FBTyxFQUFFLGVBQWUsRUFBa0IsTUFBTSxNQUFNLENBQUM7QUFDdkQsT0FBTyxFQUFFLEdBQUcsRUFBYyxNQUFNLGdCQUFnQixDQUFDO0FBQ2pELE9BQU8sRUFBRSxnQkFBZ0IsRUFBbUIsTUFBTSxxQkFBcUIsQ0FBQzs7O0FBSXhFLE1BQU0sT0FBTyxXQUFXO0lBUVo7SUFDMEI7SUFSNUIsV0FBVyxHQUFHLElBQUksZUFBZSxDQUFnQixJQUFJLENBQUMsQ0FBQztJQUN2RCxlQUFlLEdBQUcsSUFBSSxlQUFlLENBQWlCLElBQUksQ0FBQyxDQUFDO0lBRTNELFFBQVEsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLFlBQVksRUFBRSxDQUFDO0lBQzNDLFFBQVEsR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLFlBQVksRUFBRSxDQUFDO0lBRXhELFlBQ1UsSUFBZ0IsRUFDVSxNQUF1QjtRQURqRCxTQUFJLEdBQUosSUFBSSxDQUFZO1FBQ1UsV0FBTSxHQUFOLE1BQU0sQ0FBaUI7UUFFekQsTUFBTSxLQUFLLEdBQUcsWUFBWSxDQUFDLE9BQU8sQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO1FBQ3hELElBQUksS0FBSyxFQUFFLENBQUM7WUFDVixJQUFJLENBQUM7Z0JBQ0gsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQztnQkFDakMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxDQUFDO2dCQUMxQyxJQUFJLE1BQU0sQ0FBQyxPQUFPLEVBQUUsQ0FBQztvQkFDbkIsSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDO2dCQUM1QyxDQUFDO1lBQ0gsQ0FBQztZQUFDLE1BQU0sQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDO1FBQzFCLENBQUM7SUFDSCxDQUFDO0lBRUQsSUFBSSxVQUFVO1FBQ1osT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQztJQUNoQyxDQUFDO0lBRUQsSUFBSSxjQUFjO1FBQ2hCLE9BQU8sSUFBSSxDQUFDLGVBQWUsQ0FBQyxLQUFLLENBQUM7SUFDcEMsQ0FBQztJQUVELElBQUksU0FBUztRQUNYLE9BQU8sSUFBSSxDQUFDLGVBQWUsQ0FBQyxLQUFLLEVBQUUsVUFBVSxJQUFJLElBQUksQ0FBQztJQUN4RCxDQUFDO0lBRUQsS0FBSyxDQUFDLEtBQWEsRUFBRSxRQUFnQjtRQUNuQyxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFjLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxVQUFVLE9BQU8sRUFBRTtZQUNuRSxRQUFRLEVBQUUsUUFBUTtZQUNsQixLQUFLO1lBQ0wsUUFBUTtTQUNULENBQUMsQ0FBQyxJQUFJLENBQ0wsR0FBRyxDQUFDLENBQUMsR0FBRyxFQUFFLEVBQUU7WUFDVixJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLENBQUM7WUFDdkMsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDO1FBQ3hCLENBQUMsQ0FBQyxDQUNILENBQUM7SUFDSixDQUFDO0lBRUQsVUFBVSxDQUFDLFVBQWtCLEVBQUUsT0FBZ0I7UUFDN0MsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDbEMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDbkMsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDO0lBQ3hCLENBQUM7SUFFRCxjQUFjLENBQUMsVUFBa0IsRUFBRSxPQUFnQjtRQUNqRCxJQUFJLENBQUMsVUFBVSxDQUFDLFVBQVUsRUFBRSxPQUFPLENBQUMsQ0FBQztJQUN2QyxDQUFDO0lBRUQsTUFBTTtRQUNKLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQzVCLElBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ2hDLFlBQVksQ0FBQyxVQUFVLENBQUMsbUJBQW1CLENBQUMsQ0FBQztJQUMvQyxDQUFDO0lBRUQsZUFBZTtRQUNiLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsS0FBSyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLEtBQUssQ0FBQztJQUNsRSxDQUFDO0lBRU8sY0FBYztRQUNwQixNQUFNLElBQUksR0FBRztZQUNYLFdBQVcsRUFBRSxJQUFJLENBQUMsV0FBVyxDQUFDLEtBQUs7WUFDbkMsT0FBTyxFQUFFLElBQUksQ0FBQyxlQUFlLENBQUMsS0FBSztTQUNwQyxDQUFDO1FBQ0YsWUFBWSxDQUFDLE9BQU8sQ0FBQyxtQkFBbUIsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDbEUsQ0FBQzt3R0ExRVUsV0FBVyw0Q0FTWixnQkFBZ0I7NEdBVGYsV0FBVyxjQURFLE1BQU07OzRGQUNuQixXQUFXO2tCQUR2QixVQUFVO21CQUFDLEVBQUUsVUFBVSxFQUFFLE1BQU0sRUFBRTs7MEJBVTdCLE1BQU07MkJBQUMsZ0JBQWdCIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgSW5qZWN0YWJsZSwgSW5qZWN0IH0gZnJvbSAnQGFuZ3VsYXIvY29yZSc7XG5pbXBvcnQgeyBIdHRwQ2xpZW50IH0gZnJvbSAnQGFuZ3VsYXIvY29tbW9uL2h0dHAnO1xuaW1wb3J0IHsgQmVoYXZpb3JTdWJqZWN0LCBPYnNlcnZhYmxlLCBvZiB9IGZyb20gJ3J4anMnO1xuaW1wb3J0IHsgdGFwLCBjYXRjaEVycm9yIH0gZnJvbSAncnhqcy9vcGVyYXRvcnMnO1xuaW1wb3J0IHsgTUVTU0FHSU5HX0NPTkZJRywgTWVzc2FnaW5nQ29uZmlnIH0gZnJvbSAnLi4vbWVzc2FnaW5nLmNvbmZpZyc7XG5pbXBvcnQgeyBBdXRoU2Vzc2lvbiwgQ29udGFjdCB9IGZyb20gJy4uL21vZGVscy9tZXNzYWdpbmcubW9kZWxzJztcblxuQEluamVjdGFibGUoeyBwcm92aWRlZEluOiAncm9vdCcgfSlcbmV4cG9ydCBjbGFzcyBBdXRoU2VydmljZSB7XG4gIHByaXZhdGUgc2Vzc2lvbkdpZCQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PHN0cmluZyB8IG51bGw+KG51bGwpO1xuICBwcml2YXRlIGN1cnJlbnRDb250YWN0JCA9IG5ldyBCZWhhdmlvclN1YmplY3Q8Q29udGFjdCB8IG51bGw+KG51bGwpO1xuXG4gIHJlYWRvbmx5IHNlc3Npb24kID0gdGhpcy5zZXNzaW9uR2lkJC5hc09ic2VydmFibGUoKTtcbiAgcmVhZG9ubHkgY29udGFjdCQgPSB0aGlzLmN1cnJlbnRDb250YWN0JC5hc09ic2VydmFibGUoKTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIGh0dHA6IEh0dHBDbGllbnQsXG4gICAgQEluamVjdChNRVNTQUdJTkdfQ09ORklHKSBwcml2YXRlIGNvbmZpZzogTWVzc2FnaW5nQ29uZmlnXG4gICkge1xuICAgIGNvbnN0IHNhdmVkID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ21lc3NhZ2luZ19zZXNzaW9uJyk7XG4gICAgaWYgKHNhdmVkKSB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBwYXJzZWQgPSBKU09OLnBhcnNlKHNhdmVkKTtcbiAgICAgICAgdGhpcy5zZXNzaW9uR2lkJC5uZXh0KHBhcnNlZC5zZXNzaW9uX2dpZCk7XG4gICAgICAgIGlmIChwYXJzZWQuY29udGFjdCkge1xuICAgICAgICAgIHRoaXMuY3VycmVudENvbnRhY3QkLm5leHQocGFyc2VkLmNvbnRhY3QpO1xuICAgICAgICB9XG4gICAgICB9IGNhdGNoIHsgLyogaWdub3JlICovIH1cbiAgICB9XG4gIH1cblxuICBnZXQgc2Vzc2lvbkdpZCgpOiBzdHJpbmcgfCBudWxsIHtcbiAgICByZXR1cm4gdGhpcy5zZXNzaW9uR2lkJC52YWx1ZTtcbiAgfVxuXG4gIGdldCBjdXJyZW50Q29udGFjdCgpOiBDb250YWN0IHwgbnVsbCB7XG4gICAgcmV0dXJuIHRoaXMuY3VycmVudENvbnRhY3QkLnZhbHVlO1xuICB9XG5cbiAgZ2V0IGNvbnRhY3RJZCgpOiBzdHJpbmcgfCBudWxsIHtcbiAgICByZXR1cm4gdGhpcy5jdXJyZW50Q29udGFjdCQudmFsdWU/LmNvbnRhY3RfaWQgPz8gbnVsbDtcbiAgfVxuXG4gIGxvZ2luKGVtYWlsOiBzdHJpbmcsIHBhc3N3b3JkOiBzdHJpbmcpOiBPYnNlcnZhYmxlPEF1dGhTZXNzaW9uPiB7XG4gICAgcmV0dXJuIHRoaXMuaHR0cC5wb3N0PEF1dGhTZXNzaW9uPihgJHt0aGlzLmNvbmZpZy5hcGlCYXNlVXJsfS9hdXRoYCwge1xuICAgICAgZnVuY3Rpb246ICdfbG9naW4nLFxuICAgICAgZW1haWwsXG4gICAgICBwYXNzd29yZCxcbiAgICB9KS5waXBlKFxuICAgICAgdGFwKChyZXMpID0+IHtcbiAgICAgICAgdGhpcy5zZXNzaW9uR2lkJC5uZXh0KHJlcy5zZXNzaW9uX2dpZCk7XG4gICAgICAgIHRoaXMucGVyc2lzdFNlc3Npb24oKTtcbiAgICAgIH0pXG4gICAgKTtcbiAgfVxuXG4gIHNldFNlc3Npb24oc2Vzc2lvbkdpZDogc3RyaW5nLCBjb250YWN0OiBDb250YWN0KTogdm9pZCB7XG4gICAgdGhpcy5zZXNzaW9uR2lkJC5uZXh0KHNlc3Npb25HaWQpO1xuICAgIHRoaXMuY3VycmVudENvbnRhY3QkLm5leHQoY29udGFjdCk7XG4gICAgdGhpcy5wZXJzaXN0U2Vzc2lvbigpO1xuICB9XG5cbiAgc2V0RGVtb1Nlc3Npb24oc2Vzc2lvbkdpZDogc3RyaW5nLCBjb250YWN0OiBDb250YWN0KTogdm9pZCB7XG4gICAgdGhpcy5zZXRTZXNzaW9uKHNlc3Npb25HaWQsIGNvbnRhY3QpO1xuICB9XG5cbiAgbG9nb3V0KCk6IHZvaWQge1xuICAgIHRoaXMuc2Vzc2lvbkdpZCQubmV4dChudWxsKTtcbiAgICB0aGlzLmN1cnJlbnRDb250YWN0JC5uZXh0KG51bGwpO1xuICAgIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKCdtZXNzYWdpbmdfc2Vzc2lvbicpO1xuICB9XG5cbiAgaXNBdXRoZW50aWNhdGVkKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiAhIXRoaXMuc2Vzc2lvbkdpZCQudmFsdWUgJiYgISF0aGlzLmN1cnJlbnRDb250YWN0JC52YWx1ZTtcbiAgfVxuXG4gIHByaXZhdGUgcGVyc2lzdFNlc3Npb24oKTogdm9pZCB7XG4gICAgY29uc3QgZGF0YSA9IHtcbiAgICAgIHNlc3Npb25fZ2lkOiB0aGlzLnNlc3Npb25HaWQkLnZhbHVlLFxuICAgICAgY29udGFjdDogdGhpcy5jdXJyZW50Q29udGFjdCQudmFsdWUsXG4gICAgfTtcbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnbWVzc2FnaW5nX3Nlc3Npb24nLCBKU09OLnN0cmluZ2lmeShkYXRhKSk7XG4gIH1cbn1cbiJdfQ==