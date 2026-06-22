import { Inject, Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, Subscription, of } from 'rxjs';
import { catchError, filter, tap } from 'rxjs/operators';
import { MESSAGING_CONFIG, MessagingConfig } from '../messaging.config';
import { AuthService } from './auth.service';
import { MessagingWebSocketService } from './messaging-websocket.service';
import { TicketNotificationItem } from '../models/ticket-notification.model';

@Injectable({ providedIn: 'root' })
export class TicketNotificationService implements OnDestroy {
  private readonly tickets$ = new BehaviorSubject<TicketNotificationItem[]>([]);
  private readonly unseenCount$ = new BehaviorSubject<number>(0);
  private wsSub: Subscription | null = null;
  private wsStatusSub: Subscription | null = null;
  private listening = false;

  readonly tickets = this.tickets$.asObservable();
  readonly unseenCount = this.unseenCount$.asObservable();

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private ws: MessagingWebSocketService,
    @Inject(MESSAGING_CONFIG) private config: MessagingConfig
  ) {}

  get enabled(): boolean {
    return !!this.config.enableTicketNotifications && !!this.config.ticketApiUrl;
  }

  get hasTickets(): boolean {
    return this.tickets$.value.length > 0;
  }

  ngOnDestroy(): void {
    this.stopListening();
  }

  /** @deprecated Use startListening */
  startPolling(): void {
    this.startListening();
  }

  /** @deprecated Use stopListening */
  stopPolling(): void {
    this.stopListening();
  }

  startListening(): void {
    if (!this.enabled || this.listening) return;
    this.listening = true;
    this.refresh();

    this.wsSub = this.ws.onMessage$
      .pipe(filter((msg) => msg.type === 'ticket_assigned' || msg.type === 'ticket_closed'))
      .subscribe((msg) => this.handleTicketEvent(msg.type, msg.data));

    this.wsStatusSub = this.ws.status$
      .pipe(filter((status) => status === 'authenticated'))
      .subscribe(() => this.refresh());
  }

  stopListening(): void {
    this.wsSub?.unsubscribe();
    this.wsSub = null;
    this.wsStatusSub?.unsubscribe();
    this.wsStatusSub = null;
    this.listening = false;
  }

  refresh(): void {
    const email = this.getUserEmail();
    if (!email) return;

    this.fetchUnseenCount(email).subscribe();
    if (this.tickets$.value.length > 0 || this.unseenCount$.value > 0) {
      this.fetchTickets(email).subscribe();
    }
  }

  loadTickets(): void {
    const email = this.getUserEmail();
    if (!email) return;
    this.fetchTickets(email).subscribe();
  }

  markSeen(ticket: TicketNotificationItem): void {
    const email = this.getUserEmail();
    if (!email || ticket.is_seen) return;

    const base = this.apiBase();
    this.http
      .post(`${base}/notifications/mark-seen/${encodeURIComponent(ticket.ticket_ref)}`, null, {
        params: { user_email: email },
      })
      .pipe(catchError(() => of(null)))
      .subscribe(() => {
        const next = this.tickets$.value.map((t) =>
          t.ticket_ref === ticket.ticket_ref ? { ...t, is_seen: true } : t
        );
        this.tickets$.next(next);
        this.fetchUnseenCount(email).subscribe();
      });
  }

  navigateToDashboard(): void {
    const url = this.config.ticketDashboardUrl;
    if (!url) return;

    try {
      const target = new URL(url, window.location.origin);
      if (target.origin === window.location.origin) {
        window.location.assign(target.href);
      } else {
        window.open(target.href, '_blank', 'noopener');
      }
    } catch {
      window.open(url, '_blank', 'noopener');
    }
  }

  private handleTicketEvent(type: string, data: Record<string, unknown> | undefined): void {
    const email = this.getUserEmail()?.toLowerCase();
    const assignee = String(data?.['assignee_email'] || '').toLowerCase();
    if (!email || !assignee || assignee !== email) return;

    if (type === 'ticket_assigned' || type === 'ticket_closed') {
      this.loadTickets();
      this.fetchUnseenCount(email).subscribe();
    }
  }

  private apiBase(): string {
    return (this.config.ticketApiUrl || '').replace(/\/$/, '');
  }

  private fetchTickets(email: string): Observable<TicketNotificationItem[]> {
    return this.http
      .get<TicketNotificationItem[]>(`${this.apiBase()}/notifications/my-tickets/${encodeURIComponent(email)}`)
      .pipe(
        tap((tickets) => this.tickets$.next(tickets || [])),
        catchError(() => {
          this.tickets$.next([]);
          return of([]);
        })
      );
  }

  private fetchUnseenCount(email: string): Observable<{ count: number }> {
    return this.http
      .get<{ count: number }>(`${this.apiBase()}/notifications/unseen-count/${encodeURIComponent(email)}`)
      .pipe(
        tap((res) => {
          this.unseenCount$.next(res?.count ?? 0);
          if ((res?.count ?? 0) > 0 && this.tickets$.value.length === 0) {
            this.fetchTickets(email).subscribe();
          }
        }),
        catchError(() => {
          this.unseenCount$.next(0);
          return of({ count: 0 });
        })
      );
  }

  private getUserEmail(): string | null {
    const contactEmail = this.auth.currentContact?.email?.trim();
    if (contactEmail) return contactEmail;

    const sessionRaw = localStorage.getItem('session');
    if (sessionRaw) {
      try {
        const parsed = JSON.parse(sessionRaw);
        const email = (parsed.email || parsed.user_email || '').trim();
        if (email) return email;
      } catch {
        /* ignore */
      }
    }

    const cookieEmail = this.getCookie('user_email')?.trim();
    return cookieEmail || null;
  }

  private getCookie(name: string): string | null {
    const match = document.cookie.match(new RegExp(`(?:^|; )${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
  }
}
