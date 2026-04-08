import { Component, OnInit, OnDestroy, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatBadgeModule } from '@angular/material/badge';
import { Subscription } from 'rxjs';
import { MessagingStoreService } from '../../services/messaging-store.service';

@Component({
  selector: 'app-floating-button',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatBadgeModule],
  template: `
    <div
      #fab
      class="floating-btn"
      [style.left.px]="posX"
      [style.top.px]="posY"
      (mousedown)="onMouseDown($event)"
      (click)="onClick()"
    >
      <div class="fab-inner" [class.has-unread]="unreadCount > 0">
        <mat-icon>chat</mat-icon>
        <span *ngIf="unreadCount > 0" class="badge">{{ unreadCount > 99 ? '99+' : unreadCount }}</span>
      </div>
    </div>
  `,
  styles: [`
    .floating-btn {
      position: fixed;
      z-index: 10000;
      cursor: pointer;
      user-select: none;
      touch-action: none;
    }

    .fab-inner {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      position: relative;
    }

    .fab-inner:hover {
      transform: scale(1.08);
      box-shadow: 0 6px 28px rgba(102, 126, 234, 0.5);
    }

    .fab-inner.has-unread {
      animation: pulse 2s infinite;
    }

    .fab-inner mat-icon {
      color: #fff;
      font-size: 26px;
      width: 26px;
      height: 26px;
    }

    .badge {
      position: absolute;
      top: -4px;
      right: -4px;
      background: #ef4444;
      color: #fff;
      border-radius: 10px;
      min-width: 20px;
      height: 20px;
      font-size: 11px;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 5px;
      border: 2px solid #fff;
    }

    @keyframes pulse {
      0%, 100% { box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4); }
      50% { box-shadow: 0 4px 28px rgba(102, 126, 234, 0.7); }
    }
  `],
})
export class FloatingButtonComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('fab') fabEl!: ElementRef;

  unreadCount = 0;
  posX = 0;
  posY = 0;

  private dragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private moved = false;
  private sub!: Subscription;

  private boundMouseMove = this.onMouseMove.bind(this);
  private boundMouseUp = this.onMouseUp.bind(this);

  constructor(private store: MessagingStoreService) {}

  ngOnInit(): void {
    this.sub = this.store.totalUnread.subscribe((count) => (this.unreadCount = count));
  }

  ngAfterViewInit(): void {
    // Default position: bottom-right
    this.posX = window.innerWidth - 80;
    this.posY = window.innerHeight - 80;
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    document.removeEventListener('mousemove', this.boundMouseMove);
    document.removeEventListener('mouseup', this.boundMouseUp);
  }

  onMouseDown(event: MouseEvent): void {
    this.dragging = true;
    this.moved = false;
    this.dragStartX = event.clientX - this.posX;
    this.dragStartY = event.clientY - this.posY;
    this.store.onButtonDragStart();
    document.addEventListener('mousemove', this.boundMouseMove);
    document.addEventListener('mouseup', this.boundMouseUp);
    event.preventDefault();
  }

  onMouseMove(event: MouseEvent): void {
    if (!this.dragging) return;
    this.moved = true;
    this.posX = event.clientX - this.dragStartX;
    this.posY = event.clientY - this.dragStartY;

    // Keep in bounds
    this.posX = Math.max(0, Math.min(this.posX, window.innerWidth - 60));
    this.posY = Math.max(0, Math.min(this.posY, window.innerHeight - 60));
  }

  onMouseUp(): void {
    this.dragging = false;
    document.removeEventListener('mousemove', this.boundMouseMove);
    document.removeEventListener('mouseup', this.boundMouseUp);
    if (this.moved) {
      this.store.onButtonDragEnd(this.posX, this.posY);
    }
  }

  onClick(): void {
    if (!this.moved) {
      this.store.togglePanel(this.posX, this.posY);
    }
    this.moved = false;
  }
}
