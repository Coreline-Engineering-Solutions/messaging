import { Injectable, Inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { MESSAGING_CONFIG, MessagingConfig } from '../messaging.config';
import { warnEmailLikeContactId } from '../messaging-dev-warnings';
import { AuthSession, Contact } from '../models/messaging.models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private sessionGid$ = new BehaviorSubject<string | null>(null);
  private currentContact$ = new BehaviorSubject<Contact | null>(null);

  readonly session$ = this.sessionGid$.asObservable();
  readonly contact$ = this.currentContact$.asObservable();

  constructor(
    private http: HttpClient,
    @Inject(MESSAGING_CONFIG) private config: MessagingConfig
  ) {
    const saved = localStorage.getItem('messaging_session');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        this.sessionGid$.next(parsed.session_gid);
        if (parsed.contact) {
          this.currentContact$.next(parsed.contact);
        }
      } catch { /* ignore */ }
    }
  }

  get sessionGid(): string | null {
    return this.sessionGid$.value;
  }

  get currentContact(): Contact | null {
    return this.currentContact$.value;
  }

  get contactId(): string | null {
    return this.currentContact$.value?.contact_id ?? null;
  }

  login(email: string, password: string, apiBaseUrlOverride?: string): Observable<AuthSession> {
    const base = (apiBaseUrlOverride ?? this.config.apiBaseUrl).replace(/\/$/, '');
    return this.http.post<AuthSession>(`${base}/auth`, {
      function: '_login',
      email,
      password,
    }).pipe(
      tap((res) => {
        this.sessionGid$.next(res.session_gid);
        this.persistSession();
      })
    );
  }

  setSession(sessionGid: string, contact: Contact): void {
    warnEmailLikeContactId(contact.contact_id);
    this.sessionGid$.next(sessionGid);
    this.currentContact$.next(contact);
    this.persistSession();
  }

  setDemoSession(sessionGid: string, contact: Contact): void {
    this.setSession(sessionGid, contact);
  }

  logout(): void {
    this.sessionGid$.next(null);
    this.currentContact$.next(null);
    localStorage.removeItem('messaging_session');
  }

  isAuthenticated(): boolean {
    return !!this.sessionGid$.value && !!this.currentContact$.value;
  }

  refreshMessagingSession(): Observable<Contact | null> {
    const token = this.sessionGid$.value;
    if (!token) return of(null);

    return this.http.get<any>(`${this.config.apiBaseUrl}/messaging/auth/me`, {
      headers: {
        'X-Messaging-Session': token,
      },
    }).pipe(
      map((res) => {
        const existing = this.currentContact$.value;
        const contact: Contact = {
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
      }),
      catchError(() => {
        this.logout();
        return of(null);
      })
    );
  }

  private persistSession(): void {
    const data = {
      session_gid: this.sessionGid$.value,
      contact: this.currentContact$.value,
    };
    localStorage.setItem('messaging_session', JSON.stringify(data));
  }
}
