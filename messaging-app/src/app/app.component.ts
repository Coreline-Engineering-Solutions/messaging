import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { NavBarComponent } from './layout/nav-bar/nav-bar.component';
import { MessagingOverlayComponent } from './messaging/messaging-overlay.component';
import { AuthService } from './messaging/services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, NavBarComponent, MessagingOverlayComponent],
  template: `
    <app-nav-bar *ngIf="showNav"></app-nav-bar>
    <main>
      <router-outlet></router-outlet>
    </main>
    <app-messaging-overlay></app-messaging-overlay>
  `,
  styles: [`
    main {
      min-height: calc(100vh - 56px);
      background: #f9fafb;
    }
  `],
})
export class AppComponent implements OnInit {
  showNav = false;

  constructor(private router: Router, private auth: AuthService) {}

  ngOnInit(): void {
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe((e) => {
        const url = (e as NavigationEnd).urlAfterRedirects;
        this.showNav = !url.includes('/login');
      });
  }
}
