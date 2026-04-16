import { Injectable, Inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { MESSAGING_CONFIG, MessagingConfig } from '../messaging.config';
import { AuthSession, Contact } from '../models/messaging.models';

@Injectable({ providedIn: 'root' })
export class MessagingAuthBridgeService {
  constructor(
    private http: HttpClient,
    @Inject(MESSAGING_CONFIG) private config: MessagingConfig
  ) {}

  /**
   * Authenticate with auth-api using email and password.
   * Returns session_gid and contact information.
   */
  authenticateForMessaging(email: string, password: string): Observable<{ session: AuthSession; contact: Contact }> {
    return this.http.post<any>(`${this.config.apiBaseUrl}/auth`, {
      function: '_login',
      email,
      password
    }).pipe(
      map(response => {
        const session: AuthSession = {
          session_gid: response.session_gid,
          session_expires: response.session_expires
        };

        const contact: Contact = {
          contact_id: response.contact_id || response.user_id,
          user_gid: response.user_gid || response.session_gid,
          first_name: response.first_name || email.split('@')[0],
          last_name: response.last_name || '',
          email: email,
          company_name: response.company_name || 'Coreline Engineering Solutions',
          is_active: true
        };

        return { session, contact };
      }),
      catchError(error => {
        console.error('Messaging authentication failed:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Check if a messaging session exists in localStorage.
   */
  hasStoredSession(): boolean {
    const stored = localStorage.getItem('messaging_session');
    if (!stored) return false;

    try {
      const parsed = JSON.parse(stored);
      return !!parsed.session_gid && !!parsed.contact;
    } catch {
      return false;
    }
  }

  /**
   * Attempt to use existing session to get messaging session.
   */
  initializeFromExistingSession(email: string): Observable<{ session: AuthSession; contact: Contact } | null> {
    if (this.hasStoredSession()) {
      return of(null); // Already authenticated
    }

    console.log('Messaging authentication required for:', email);
    return of(null);
  }
}
