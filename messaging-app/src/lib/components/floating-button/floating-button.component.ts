import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription, combineLatest } from 'rxjs';
import { MessagingStoreService } from '../../services/messaging-store.service';
import { SidebarSide } from '../../models/messaging.models';

@Component({
  selector: 'app-floating-button',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      *ngIf="!isOpen"
      class="floating-btn"
      [class.side-left]="side === 'left'"
      [class.side-right]="side === 'right'"
      (click)="toggle()"
    >
      <div class="fab-inner" [class.has-unread]="unreadCount > 0">
        <svg class="ces-logo" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <path d="M 15 20 Q 15 15 20 15 L 80 15 Q 85 15 85 20 L 85 60 Q 85 65 80 65 L 35 65 L 20 80 L 20 65 Q 15 65 15 60 Z"
                fill="none" stroke="white" stroke-width="3"/>
          <g transform="translate(50, 40) scale(0.35)">
            <path d="M 0,-30 L 25,-15 L 25,15 L 0,30 L -25,15 L -25,-15 Z" fill="white"/>
          </g>
        </svg>
        <span *ngIf="unreadCount > 0" class="badge">{{ unreadCount > 99 ? '99+' : unreadCount }}</span>
      </div>
    </div>
  `,
  styles: [`
    .floating-btn {
      position: fixed;
      bottom: 20px;
      z-index: 10000;
      cursor: pointer;
      user-select: none;
    }

    .floating-btn.side-right {
      right: 20px;
    }

    .floating-btn.side-left {
      left: 20px;
    }

    .fab-inner {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: linear-gradient(135deg, #1F4BD8 0%, #173396 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 3px 16px rgba(23, 51, 150, 0.4);
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      position: relative;
    }

    .fab-inner:hover {
      transform: scale(1.1);
      box-shadow: 0 4px 20px rgba(23, 51, 150, 0.6);
    }

    .fab-inner.has-unread {
      animation: pulse 2s infinite;
    }

    .ces-logo {
      width: 24px;
      height: 24px;
    }

    .badge {
      position: absolute;
      top: -4px;
      right: -4px;
      background: #ef4444;
      color: #fff;
      border-radius: 10px;
      min-width: 18px;
      height: 18px;
      font-size: 10px;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 4px;
      border: 2px solid #fff;
    }

    @keyframes pulse {
      0%, 100% { box-shadow: 0 3px 16px rgba(23, 51, 150, 0.4); }
      50% { box-shadow: 0 3px 24px rgba(23, 51, 150, 0.7); }
    }
  `],
})
export class FloatingButtonComponent implements OnInit, OnDestroy {
  unreadCount = 0;
  side: SidebarSide = 'right';
  isOpen = false;

  private sub!: Subscription;

  constructor(private store: MessagingStoreService) {}

  ngOnInit(): void {
    this.sub = combineLatest([
      this.store.totalUnread,
      this.store.sidebarSide,
      this.store.panelOpen,
    ]).subscribe(([count, side, open]) => {
      this.unreadCount = count;
      this.side = side;
      this.isOpen = open;
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  toggle(): void {
    this.store.togglePanel();
  }
}
