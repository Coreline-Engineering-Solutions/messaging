import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { AuthSession, Contact } from '../models/messaging.models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private sessionGid$ = new BehaviorSubject<string | null>(null);
  private currentContact$ = new BehaviorSubject<Contact | null>(null);

  readonly session$ = this.sessionGid$.asObservable();
  readonly contact$ = this.currentContact$.asObservable();

  constructor(private http: HttpClient) {
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

  login(email: string, password: string): Observable<AuthSession> {
    return this.http.post<AuthSession>(`${environment.apiBaseUrl}/auth`, {
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
    this.validateContact(contact);
    this.validateSessionGid(sessionGid);
    this.sessionGid$.next(sessionGid);
    this.currentContact$.next(contact);
    this.persistSession();
  }

  private validateContact(contact: Contact): void {
    if (!contact) {
      throw new Error('Contact object is required');
    }
    if (!contact.contact_id || contact.contact_id.trim() === '') {
      throw new Error('Contact.contact_id is required and cannot be empty. This should be the user\'s email or unique identifier.');
    }
    if (!contact.email || !contact.email.includes('@')) {
      throw new Error(`Contact.email must be a valid email address. Got: "${contact.email}"`);
    }
    if (!contact.user_gid || contact.user_gid.trim() === '') {
      throw new Error('Contact.user_gid (session GID) is required and cannot be empty');
    }
  }

  private validateSessionGid(sessionGid: string): void {
    if (!sessionGid || sessionGid.trim() === '') {
      throw new Error('sessionGid is required and cannot be empty');
    }
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

  private persistSession(): void {
    const data = {
      session_gid: this.sessionGid$.value,
      contact: this.currentContact$.value,
    };
    localStorage.setItem('messaging_session', JSON.stringify(data));
  }
}
