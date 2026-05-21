import {
  Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked, ChangeDetectorRef,
  Output, EventEmitter,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription, combineLatest } from 'rxjs';
import { MessagingStoreService } from '../../services/messaging-store.service';
import { MessagingFileService } from '../../services/messaging-file.service';
import { AuthService } from '../../services/auth.service';
import { Contact, Message, Attachment, getContactDisplayName, getMessageSenderName } from '../../models/messaging.models';
import { MessageInputComponent, MessagePayload } from '../message-input/message-input.component';

@Component({
  selector: 'app-chat-thread',
  standalone: true,
  imports: [
    CommonModule, MatIconModule, MatButtonModule,
    MatProgressSpinnerModule, MatTooltipModule, MessageInputComponent,
  ],
  template: `
    <div
      class="chat-thread"
      [class.drag-over]="threadDragOver"
      (dragenter)="onThreadDragEnter($event)"
      (dragover)="onThreadDragOver($event)"
      (dragleave)="onThreadDragLeave($event)"
      (drop)="onThreadDrop($event)"
    >
      <div class="chat-header">
        <button mat-icon-button class="hdr-btn" (click)="goBack()" matTooltip="Back" matTooltipPosition="below">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <div class="header-info">
          <span class="chat-name">{{ conversationName }}</span>
        </div>
        <div class="header-actions">
          <button *ngIf="isGroup && !isRemovedFromGroup" mat-icon-button class="hdr-btn" (click)="onGroupSettings()" matTooltip="Group settings" matTooltipPosition="below">
            <mat-icon>settings</mat-icon>
          </button>
        </div>
      </div>

      <div class="messages-area" #scrollContainer (scroll)="onScroll()">
        <div *ngIf="threadDragOver" class="thread-drag-overlay">
          <mat-icon>cloud_upload</mat-icon>
          <span>Drop files anywhere in this chat</span>
        </div>

        <div *ngIf="isRemovedFromGroup" class="removed-group-state">
          <mat-icon>block</mat-icon>
          <h4>You were removed from this group</h4>
          <p>Messages, attachments, and group settings are no longer available.</p>
          <button type="button" mat-raised-button class="removed-exit-btn" (click)="exitRemovedGroup()">
            Exit Group
          </button>
        </div>

        <div *ngIf="!isRemovedFromGroup && loading" class="loading-indicator">
          <mat-spinner diameter="24"></mat-spinner>
          <span>Loading messages...</span>
        </div>

        <button
          *ngIf="!isRemovedFromGroup && messages.length >= 50 && !loading"
          mat-stroked-button
          class="load-more-btn"
          (click)="loadOlder()"
        >
          Load older messages
        </button>

        <div *ngIf="!isRemovedFromGroup" class="messages-list">
          <ng-container *ngFor="let msg of messages; let i = index">
            <div
              *ngIf="shouldShowDateSeparator(i)"
              class="date-separator"
            >
              <span>{{ formatDate(msg.created_at) }}</span>
            </div>

            <div
              *ngIf="isSystemMessage(msg); else chatMessage"
              class="system-message-row"
            >
              <span class="system-message-text">{{ msg.content }}</span>
            </div>

            <ng-template #chatMessage>
              <div
                class="message-bubble-row"
              [class.own]="isOwnMessage(msg)"
              [class.other]="!isOwnMessage(msg)"
            >
              <div *ngIf="!isOwnMessage(msg)" class="sender-name">
                {{ getSenderName(msg) }}
              </div>
              <div class="message-bubble" [class.own-bubble]="isOwnMessage(msg)" (mouseenter)="hoveredMessageId = msg.message_id" (mouseleave)="hoveredMessageId = null">
                <!-- ATTACHMENTS ───────────────────────────────── -->
                <div *ngIf="hasFileAttachment(msg)" class="attachments-list">
                  <div *ngFor="let attachment of getRenderableAttachments(msg); trackBy: trackByAttachment" class="attachment-item">
                    <ng-container *ngIf="isImageAttachment(msg, attachment); else nonImageAttachment">
                      <div class="image-message">
                        <ng-container *ngIf="getMediaUrl(msg, attachment) as dataUrl; else imgFallback">
                          <div class="media-wrapper">
                            <img
                              [src]="dataUrl"
                              alt="Image"
                              class="media-img"
                              (mousedown)="$event.stopPropagation()"
                              (click)="openLightbox(dataUrl, $event)"
                            />
                            <div class="attachment-actions">
                              <button
                                type="button"
                                class="attachment-action-btn"
                                (click)="openLightbox(dataUrl, $event)"
                                title="Open image"
                              >
                                <mat-icon>open_in_full</mat-icon>
                              </button>
                              <button
                                type="button"
                                class="attachment-action-btn"
                                (click)="downloadAttachment(msg, attachment, $event)"
                                title="Download image"
                              >
                                <mat-icon>download</mat-icon>
                              </button>
                            </div>
                          </div>
                        </ng-container>
                        <ng-template #imgFallback>
                          <div *ngIf="shouldShowMediaSpinner(attachment); else imgAsFile" class="media-placeholder">
                            <mat-spinner diameter="22"></mat-spinner>
                          </div>
                          <ng-template #imgAsFile>
                            <div class="file-message">
                              <mat-icon class="file-msg-icon">image</mat-icon>
                              <span class="file-msg-name">{{ getAttachmentName(msg, attachment) }}</span>
                            </div>
                          </ng-template>
                        </ng-template>
                      </div>
                    </ng-container>

                    <ng-template #nonImageAttachment>
                      <div class="file-message attachment-thumb">
                        <button
                          type="button"
                          class="file-download-btn"
                          (click)="downloadAttachment(msg, attachment, $event)"
                          title="Download file"
                        >
                          <mat-icon class="file-download-icon">download</mat-icon>
                        </button>
                        <mat-icon class="file-msg-icon">{{ getFileIcon(msg, attachment) }}</mat-icon>
                        <span class="file-msg-name" [title]="getAttachmentName(msg, attachment)">
                          {{ getAttachmentName(msg, attachment) }}
                        </span>
                        <button
                          type="button"
                          class="file-download-link"
                          (click)="downloadAttachment(msg, attachment, $event)"
                          title="Download file"
                        >
                          Download
                        </button>
                      </div>
                    </ng-template>
                  </div>
                </div>
                <ng-container *ngIf="msg.message_type === 'TEXT' && !hasFileAttachment(msg)">
                  <div *ngIf="isTableText(msg); else plainTextMessage" class="table-message-wrap">
                    <table class="pasted-table">
                      <tbody>
                        <tr *ngFor="let row of getTableRows(msg); let rowIndex = index">
                          <ng-container *ngFor="let cell of row">
                            <th *ngIf="rowIndex === 0; else tableCell">{{ cell }}</th>
                            <ng-template #tableCell>
                              <td>{{ cell }}</td>
                            </ng-template>
                          </ng-container>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <ng-template #plainTextMessage>
                    <div
                      class="text-content"
                      [class.preformatted-text]="isPreformattedText(msg)"
                    >
                      {{ msg.content }}
                    </div>
                  </ng-template>
                </ng-container>
                <div class="message-meta">
                  <span class="msg-time">{{ formatTime(msg.created_at) }}</span>
                  <mat-icon
                    *ngIf="isOwnMessage(msg) && isMessageRead(msg)"
                    class="read-icon read"
                    [matTooltip]="getReadTooltip(msg)"
                    matTooltipPosition="above"
                  >done_all</mat-icon>
                  <mat-icon
                    *ngIf="isOwnMessage(msg) && !isMessageRead(msg)"
                    class="read-icon unread"
                    matTooltip="Sent"
                    matTooltipPosition="above"
                  >done</mat-icon>
                </div>
                <div *ngIf="hoveredMessageId === msg.message_id" class="quick-reactions">
                  <button
                    *ngFor="let emoji of quickEmojis"
                    class="quick-emoji-btn"
                    (click)="onEmojiSelected(emoji, msg.message_id)"
                    [attr.aria-label]="'React with ' + emoji"
                  >
                    {{ emoji }}
                  </button>
                </div>
                <div *ngIf="msg.reactions && msg.reactions.length > 0" class="reactions-row">
                  <button 
                    *ngFor="let r of msg.reactions" 
                    class="reaction-chip"
                    (click)="toggleReaction(r.emoji, msg.message_id)"
                    [class.own-reaction]="r.hasReacted"
                    [matTooltip]="getReactorTooltip(r)"
                    matTooltipPosition="above"
                  >
                    <span class="reaction-emoji">{{ r.emoji }}</span>
                    <span class="reaction-count">{{ r.count }}</span>
                  </button>
                </div>
              </div>
              </div>
            </ng-template>
          </ng-container>
        </div>

        <div *ngIf="!isRemovedFromGroup && messages.length === 0 && !loading" class="empty-chat">
          <mat-icon>chat_bubble_outline</mat-icon>
          <p>No messages yet. Say hello!</p>
        </div>
      </div>

      <app-message-input
        *ngIf="!isRemovedFromGroup"
        [conversationId]="conversationId"
        (messageSent)="onSendMessage($event)"
        (messageWithFiles)="onSendWithFiles($event)"
      ></app-message-input>
    </div>

  `,
  styles: [`
    :host {
      --attachment-thumb-size: 180px;
    }

    .chat-thread {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: #041322;
      position: relative;
    }

    .chat-thread.drag-over {
      outline: 2px dashed rgba(255, 255, 255, 0.45);
      outline-offset: -6px;
    }

    .thread-drag-overlay {
      position: absolute;
      inset: 8px;
      z-index: 20;
      pointer-events: none;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      color: #fff;
      background: rgba(31, 75, 216, 0.32);
      border: 2px dashed rgba(255, 255, 255, 0.55);
      border-radius: 14px;
      font-size: 14px;
      font-weight: 600;
    }

    .thread-drag-overlay mat-icon {
      font-size: 36px;
      width: 36px;
      height: 36px;
    }

    .chat-header {
      display: flex;
      align-items: center;
      padding: 8px 8px 8px 4px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.15);
      gap: 4px;
      flex-shrink: 0;
    }

    .chat-header button mat-icon {
      color: rgba(255, 255, 255, 0.8);
    }

    .chat-name {
      font-size: 16px;
      font-weight: 600;
      color: #fff;
    }

    .header-info {
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      display: block;
      padding: 0 4px;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 0;
    }

    .header-actions button {
      width: 32px;
      height: 32px;
      min-width: 32px !important;
      padding: 0 !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      --mdc-icon-button-state-layer-size: 32px;
    }

    .hdr-btn {
      border-radius: 6px !important;
      transition: background 0.15s, box-shadow 0.15s;
    }

    .hdr-btn:hover {
      background: rgba(255, 255, 255, 0.15) !important;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }

    .hdr-btn mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      line-height: 20px;
      margin: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    :host ::ng-deep .hdr-btn .mat-mdc-button-touch-target {
      width: 32px !important;
      height: 32px !important;
    }

    .messages-area {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
      background: transparent;
      scrollbar-width: none;
      -ms-overflow-style: none;
    }

    .messages-area::-webkit-scrollbar {
      display: none;
    }

    .loading-indicator {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px;
      color: rgba(255, 255, 255, 0.7);
      font-size: 13px;
    }

    .removed-group-state {
      height: 100%;
      min-height: 260px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      gap: 10px;
      padding: 32px 24px;
      color: rgba(255, 255, 255, 0.78);
      box-sizing: border-box;
    }

    .removed-group-state mat-icon {
      width: 44px;
      height: 44px;
      font-size: 44px;
      color: #f87171;
      margin-bottom: 4px;
    }

    .removed-group-state h4 {
      margin: 0;
      color: #fff;
      font-size: 17px;
      font-weight: 700;
    }

    .removed-group-state p {
      margin: 0 0 8px;
      max-width: 280px;
      font-size: 13px;
      line-height: 1.4;
      color: rgba(255, 255, 255, 0.62);
    }

    .removed-exit-btn {
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.18) !important;
      color: #fff !important;
      font-weight: 700;
      padding: 0 18px;
    }

    .load-more-btn {
      align-self: center;
      margin-bottom: 16px;
      font-size: 12px;
      color: #fff;
    }

    .messages-list {
      display: flex;
      flex-direction: column;
      gap: 1px;
      flex: 1;
    }

    .date-separator {
      text-align: center;
      margin: 16px 0 8px;
      font-size: 12px;
      color: rgba(255, 255, 255, 0.7);
      font-weight: 500;
    }

    .message-bubble-row {
      display: flex;
      flex-direction: column;
      max-width: 88%;
      margin-bottom: 2px;
    }

    .message-bubble-row.own {
      align-self: flex-end;
      align-items: flex-end;
    }

    .message-bubble-row.other {
      align-self: flex-start;
      align-items: flex-start;
    }

    .sender-name {
      font-size: 11px;
      font-weight: 700;
      color: rgba(255, 255, 255, 0.95);
      margin-bottom: 3px;
      letter-spacing: 0.2px;
      padding: 0 10px;
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
    }

    .system-message-row {
      align-self: center;
      max-width: 88%;
      margin: 8px auto;
      text-align: center;
    }

    .system-message-text {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 5px 11px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.09);
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: rgba(255, 255, 255, 0.72);
      font-size: 11px;
      line-height: 1.35;
    }

    .message-bubble {
      padding: 8px 14px 7px;
      border-radius: 14px;
      font-size: 13px;
      line-height: 1.32;
      word-break: break-word;
      color: #f5f7ff;
      position: relative;
      display: inline-block;
      min-width: fit-content;
    }

    .message-bubble-row.other .message-bubble {
      background: #0d2540;
      border-bottom-left-radius: 5px;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
    }

    .message-bubble.own-bubble {
      background: #0a3d62;
      border-bottom-right-radius: 5px;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
    }

    .text-content {
      white-space: pre-wrap;
      tab-size: 4;
    }

    .text-content.preformatted-text {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      font-size: 12px;
      line-height: 1.45;
      overflow-x: auto;
      max-width: min(72vw, 520px);
    }

    .table-message-wrap {
      max-width: min(76vw, 560px);
      overflow-x: auto;
      border-radius: 9px;
      border: 1px solid rgba(255, 255, 255, 0.16);
      background: rgba(255, 255, 255, 0.04);
    }

    .pasted-table {
      border-collapse: collapse;
      min-width: 100%;
      font-size: 12px;
      line-height: 1.35;
      color: #f5f7ff;
    }

    .pasted-table th,
    .pasted-table td {
      padding: 6px 9px;
      border-right: 1px solid rgba(255, 255, 255, 0.12);
      border-bottom: 1px solid rgba(255, 255, 255, 0.12);
      text-align: left;
      white-space: pre-wrap;
      vertical-align: top;
    }

    .pasted-table th {
      background: rgba(255, 255, 255, 0.1);
      font-weight: 700;
    }

    .pasted-table tr:last-child td,
    .pasted-table tr:last-child th {
      border-bottom: none;
    }

    .pasted-table th:last-child,
    .pasted-table td:last-child {
      border-right: none;
    }

    .image-message {
      line-height: 0;
    }

    .media-wrapper {
      position: relative;
      display: inline-block;
      line-height: 0;
      width: var(--attachment-thumb-size);
      height: var(--attachment-thumb-size);
      overflow: hidden;
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.08);
    }

    .media-img {
      width: 100%;
      height: 100%;
      border-radius: inherit;
      display: block;
      cursor: zoom-in;
      object-fit: cover;
    }

    .attachment-actions {
      position: absolute;
      right: 6px;
      top: 6px;
      display: flex;
      gap: 4px;
      opacity: 0;
      transition: opacity 0.12s ease;
      pointer-events: none;
    }

    .media-wrapper:hover .attachment-actions {
      opacity: 1;
      pointer-events: auto;
    }

    .attachment-action-btn,
    .file-download-btn {
      border: none;
      border-radius: 999px;
      background: rgba(7, 29, 48, 0.82);
      color: #fff;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      padding: 0;
    }

    .attachment-action-btn {
      width: 28px;
      height: 28px;
    }

    .attachment-action-btn mat-icon {
      font-size: 17px;
      width: 17px;
      height: 17px;
    }

    .media-video {
      max-width: 240px;
      max-height: 260px;
      border-radius: 10px;
      display: block;
      background: #000;
    }

    .video-message {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .video-download {
      color: rgba(255, 255, 255, 0.78);
      font-size: 12px;
      text-decoration: underline;
      text-underline-offset: 2px;
    }

    .media-placeholder {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      width: var(--attachment-thumb-size);
      height: var(--attachment-thumb-size);
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.08);
      color: rgba(255,255,255,0.6);
      font-size: 11px;
    }

    .media-load-label {
      font-size: 11px;
      color: rgba(255,255,255,0.6);
    }

    .attachments-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-width: 100%;
    }

    .attachment-item {
      max-width: 100%;
    }

    .file-message {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 0;
    }

    .attachment-thumb.file-message {
      position: relative;
      width: var(--attachment-thumb-size);
      height: var(--attachment-thumb-size);
      padding: 12px;
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.08);
      flex-direction: column;
      justify-content: center;
      box-sizing: border-box;
      overflow: hidden;
    }

    .file-download {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: #fff;
      text-decoration: none;
      max-width: 240px;
    }

    .file-msg-icon {
      font-size: 42px;
      width: 42px;
      height: 42px;
      color: rgba(255, 255, 255, 0.8);
      flex-shrink: 0;
    }

    .file-msg-name {
      font-size: 13px;
      color: #fff;
      line-height: 1.2;
      max-width: 100%;
      overflow: hidden;
      text-align: center;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      word-break: break-word;
    }

    .file-download-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: rgba(255, 255, 255, 0.7);
      flex-shrink: 0;
    }

    .file-download-btn {
      width: 24px;
      height: 24px;
      flex-shrink: 0;
      position: absolute;
      right: 6px;
      top: 6px;
    }

    .file-download-link {
      border: none;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.16);
      color: #fff;
      cursor: pointer;
      font-size: 11px;
      padding: 4px 10px;
      margin-top: 4px;
    }

    .message-meta {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-top: 3px;
    }

    .msg-time {
      font-size: 10px;
      color: rgba(218, 224, 250, 0.66);
    }

    .message-bubble-row.other .msg-time {
      color: rgba(216, 223, 246, 0.58);
    }

    .read-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
      opacity: 0.7;
    }

    .read-icon.read {
      color: #60a5fa;
      opacity: 1;
    }

    .read-icon.unread {
      color: rgba(218, 224, 250, 0.5);
      opacity: 1;
    }

    .quick-reactions {
      position: absolute;
      top: -18px;
      right: 0;
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 3px 5px;
      background: #071d30;
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 999px;
      box-shadow: 0 6px 14px rgba(0, 0, 0, 0.28);
      z-index: 4;
    }

    /* Received messages sit on the left, so grow the picker rightward.
       Own messages sit on the right, so grow the picker leftward. */
    .message-bubble-row.other .quick-reactions {
      left: 0;
      right: auto;
    }

    .message-bubble-row.own .quick-reactions {
      left: auto;
      right: 0;
    }

    .quick-emoji-btn {
      width: 20px;
      height: 20px;
      border: none;
      border-radius: 999px;
      background: transparent;
      color: #fff;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      line-height: 1;
      cursor: pointer;
      padding: 0;
      transition: transform 0.12s ease, background 0.12s ease;
    }

    .quick-emoji-btn:hover {
      background: rgba(255, 255, 255, 0.18);
      transform: scale(1.14);
    }

    .reactions-row {
      display: flex;
      flex-wrap: wrap;
      gap: 3px;
      margin-top: 5px;
    }

    .reaction-chip {
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 999px;
      padding: 2px 7px;
      font-size: 11px;
      color: #f2f6ff;
      cursor: pointer;
      transition: all 0.2s;
      display: inline-flex;
      align-items: center;
      gap: 3px;
      max-width: 180px;
    }

    .reaction-chip:hover {
      background: rgba(255,255,255,0.25);
      transform: scale(1.05);
    }

    .reaction-chip.own-reaction {
      background: rgba(42,91,255,0.3);
      border-color: rgba(42,91,255,0.5);
    }

    .empty-chat {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      flex: 1;
      color: #9ca3af;
    }

    .empty-chat mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      margin-bottom: 8px;
    }

    .empty-chat p {
      font-size: 14px;
      margin: 0;
    }
  `],
})
export class ChatThreadComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('scrollContainer') scrollContainer!: ElementRef;
  @ViewChild(MessageInputComponent) messageInput?: MessageInputComponent;
  @Output() lightboxOpen = new EventEmitter<string>();

  messages: Message[] = [];
  visibleContacts: Contact[] = [];
  conversationName = '';
  isGroup = false;
  isRemovedFromGroup = false;
  loading = false;
  myContactId: string | null = null;

  conversationId: string | null = null;
  private sub!: Subscription;
  private shouldScrollToBottom = true;

  uploading = false;
  hoveredMessageId: string | null = null;
  quickEmojis = ['❤️', '👍', '😂', '😮', '😢', '🔥'];
  threadDragOver = false;
  private threadDragDepth = 0;
  private boundResetThreadDrag = this.resetThreadDrag.bind(this);

  /** Tracks which file IDs are currently being fetched to avoid duplicate requests */
  private mediaLoading = new Set<string>();
  /** Tracks file IDs where retrieval failed so UI doesn't spin forever. */
  private mediaFailed = new Set<string>();
  private mediaQueue: string[] = [];
  private activeMediaRequests = 0;
  private readonly maxMediaRequests = 2;

  constructor(
    private store: MessagingStoreService,
    private auth: AuthService,
    private fileService: MessagingFileService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.myContactId = this.auth.contactId;
    document.addEventListener('drop', this.boundResetThreadDrag, true);
    document.addEventListener('dragend', this.boundResetThreadDrag, true);

    this.sub = combineLatest([
      this.store.activeConversationId,
      this.store.messagesMap,
      this.store.openChats,
      this.store.visibleContacts,
      this.store.loadingMessages,
      this.store.removedGroupIds,
    ]).subscribe(([convId, msgMap, chats, contacts, loading, removedGroupIds]) => {
      this.loading = loading;
      this.visibleContacts = contacts || [];

      if (convId && convId !== this.conversationId) {
        this.conversationId = convId;
        this.resetMediaQueue();
        this.shouldScrollToBottom = true;
        const chat = chats.find((c) => c.conversationId === convId);
        this.conversationName = chat?.name || 'Chat';
        this.isGroup = chat?.isGroup || false;
      }

      if (this.conversationId) {
        const prevLen = this.messages.length;
        this.messages = msgMap.get(this.conversationId) || [];
        if (this.messages.length > prevLen) {
          this.shouldScrollToBottom = true;
        }
        // Pre-warm media cache for any image/file messages visible
        this.prewarmMedia(this.messages);
      }
      this.isRemovedFromGroup = !!this.conversationId && removedGroupIds.has(String(this.conversationId));
    });
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    document.removeEventListener('drop', this.boundResetThreadDrag, true);
    document.removeEventListener('dragend', this.boundResetThreadDrag, true);
  }

  goBack(): void {
    this.store.setView('inbox');
  }

  onClearConversation(): void {
    if (this.conversationId) {
      this.store.clearConversation(this.conversationId);
    }
  }

  onDeleteConversation(): void {
    if (this.conversationId) {
      this.store.deleteConversation(this.conversationId);
    }
  }

  onGroupSettings(): void {
    if (this.isRemovedFromGroup) return;
    if (this.conversationId) {
      this.store.openGroupSettings(this.conversationId, this.conversationName);
    }
  }

  onSendMessage(content: string): void {
    if (this.isRemovedFromGroup) return;
    this.store.sendMessage(this.conversationId, content);
    this.shouldScrollToBottom = true;
  }

  onSendWithFiles(payload: MessagePayload): void {
    if (this.isRemovedFromGroup) return;
    if (!this.conversationId || !this.auth.contactId) return;
    this.uploading = true;

    // Step 1: Upload all files and obtain real file_ids from the server.
    // Temp IDs are NEVER sent to any API — we wait for real IDs here.
    this.fileService.uploadFiles(payload.files).subscribe({
      next: (responses) => {
        const fileIds   = responses.map((r) => r.file_id);
        const filenames = responses.map((r) => r.filename);
        const mimeTypes = responses.map((r, idx) => r.mime_type || payload.files[idx]?.type || '');

        // Guard: ensure all IDs are real (not temp)
        const hasTemp = fileIds.some(id => id?.startsWith('temp-'));
        if (hasTemp) {
          this.uploading = false;
          return;
        }

        // Step 2: Pre-warm image cache so the optimistic bubble renders immediately.
        this.fileService.prewarmCache(fileIds);

        // Step 3: Send the message with the real file_ids.
        this.fileService
          .sendMessageWithAttachments(
            this.conversationId!,
            this.auth.contactId!,
            payload.text || filenames.join(', '),
            fileIds,
            filenames,
            mimeTypes
          )
          .subscribe({
            next: (res: any) => {
              this.uploading = false;
              this.shouldScrollToBottom = true;

              // Add optimistic message so the image appears instantly —
              // the WebSocket event may arrive a moment later and dedup it.
              const firstId = fileIds[0] || '';
              const isImg =
                (mimeTypes[0] || '').startsWith('image/') ||
                /\.(png|jpe?g|gif|webp|bmp|svg|heic|heif)$/i.test(filenames[0] || '');
              const optimistic: any = {
                message_id: res?.message_id ? String(res.message_id) : 'temp-' + Date.now(),
                conversation_id: this.conversationId!,
                sender_id: this.auth.contactId!,
                sender_name: 'You',
                message_type: isImg ? 'IMAGE' : 'FILE',
                content: payload.text || filenames.join(', '),
                media_url: firstId,
                created_at: new Date().toISOString(),
                is_read: false,
                attachments: fileIds.map((id, idx) => ({
                  file_id: id,
                  filename: filenames[idx] || filenames[0] || `Attachment ${idx + 1}`,
                  mime_type: mimeTypes[idx] || undefined,
                  size_bytes: payload.files[idx]?.size,
                  url: responses[idx]?.url,
                })),
              };
              this.store.appendOptimisticMessage(optimistic);
              this.cdr.markForCheck();
            },
            error: () => {
              this.uploading = false;
            },
          });
      },
      error: () => {
        this.uploading = false;
      },
    });
  }

  loadOlder(): void {
    if (this.conversationId && this.messages.length > 0) {
      this.store.loadMessages(this.conversationId, this.messages[0].message_id);
    }
  }

  onScroll(): void {}

  onThreadDragEnter(event: DragEvent): void {
    if (this.isRemovedFromGroup) return;
    if (!this.dragHasFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    this.threadDragDepth++;
    this.threadDragOver = true;
  }

  onThreadDragOver(event: DragEvent): void {
    if (this.isRemovedFromGroup) return;
    if (!this.dragHasFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
    this.threadDragOver = true;
  }

  onThreadDragLeave(event: DragEvent): void {
    if (!this.dragHasFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    this.threadDragDepth = Math.max(0, this.threadDragDepth - 1);
    this.threadDragOver = this.threadDragDepth > 0;
  }

  onThreadDrop(event: DragEvent): void {
    if (this.isRemovedFromGroup) return;
    if (!this.dragHasFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    this.resetThreadDrag();
    const files = event.dataTransfer?.files ? Array.from(event.dataTransfer.files) : [];
    this.messageInput?.addFiles(files);
  }

  private resetThreadDrag(): void {
    this.threadDragDepth = 0;
    this.threadDragOver = false;
  }

  exitRemovedGroup(): void {
    if (this.conversationId) {
      this.store.exitRemovedGroup(this.conversationId);
    }
  }

  private dragHasFiles(event: DragEvent): boolean {
    const types = event.dataTransfer?.types;
    if (!types) return false;
    return Array.from(types).includes('Files');
  }

  shouldShowDateSeparator(index: number): boolean {
    if (index === 0) return true;
    const curr = new Date(this.messages[index].created_at).toDateString();
    const prev = new Date(this.messages[index - 1].created_at).toDateString();
    return curr !== prev;
  }

  shouldShowSender(index: number): boolean {
    if (index === 0) return true;
    return this.messages[index].sender_id !== this.messages[index - 1].sender_id;
  }

  isOwnMessage(msg: Message): boolean {
    return String(msg.sender_id) === String(this.myContactId);
  }

  isSystemMessage(msg: Message): boolean {
    const content = String(msg.content || '').trim();
    return msg.message_type === 'SYSTEM' ||
      /^.+ added .+ to the group$/.test(content) ||
      /^.+ removed .+ from the group$/.test(content);
  }

  isPreformattedText(msg: Message): boolean {
    const content = String(msg.content || '');
    return content.includes('\t') || content.includes('\n') || / {2,}/.test(content);
  }

  isTableText(msg: Message): boolean {
    const rows = this.getTableRows(msg);
    return rows.length >= 2 && rows.some((row) => row.length >= 2);
  }

  getTableRows(msg: Message): string[][] {
    const content = String(msg.content || '').trim();
    if (!content.includes('\t')) return [];

    const rows = content
      .split(/\r?\n/)
      .map((line) => line.split('\t').map((cell) => cell.trim()))
      .filter((row) => row.some((cell) => cell.length > 0));

    const maxColumns = Math.max(0, ...rows.map((row) => row.length));
    if (maxColumns < 2) return [];

    return rows.map((row) => [
      ...row,
      ...Array.from({ length: maxColumns - row.length }, () => ''),
    ]);
  }

  isMessageRead(msg: Message): boolean {
    const value = msg.is_read;
    return value === true || value === 'true' || value === 'True' || value === '1';
  }

  getReadTooltip(msg: Message): string {
    if (!this.isGroup) return 'Read';

    const names = this.getReadByNames(msg);
    if (names.length > 0) {
      return `Read by ${names.join(', ')}`;
    }

    return 'Read';
  }

  private getReadByNames(msg: Message): string[] {
    const anyMsg = msg as any;
    const rawNames = [
      ...this.toReadArray(anyMsg.read_by_names),
      ...this.toReadArray(anyMsg.readByNames),
      ...this.toReadArray(anyMsg.reader_names),
      ...this.toReadArray(anyMsg.readers),
      ...this.toReadArray(anyMsg.read_by),
      ...this.toReadArray(anyMsg.readBy),
    ];

    const names = rawNames
      .map((entry) => this.readEntryToName(entry))
      .filter((name): name is string => !!name && name !== 'You');

    return Array.from(new Set(names));
  }

  private toReadArray(value: unknown): unknown[] {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return [];
      try {
        const parsed = JSON.parse(trimmed);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return trimmed.includes(',') ? trimmed.split(',').map((v) => v.trim()) : [trimmed];
      }
    }
    return [value];
  }

  private readEntryToName(entry: unknown): string | null {
    if (entry == null) return null;
    if (typeof entry === 'string' || typeof entry === 'number') {
      const idOrName = String(entry).trim();
      const contact = this.visibleContacts.find((c) => String(c.contact_id) === idOrName);
      return contact ? getContactDisplayName(contact) : idOrName;
    }
    if (typeof entry === 'object') {
      const obj = entry as any;
      const explicit = obj.username || obj.name || obj.display_name || obj.displayName || obj.email;
      if (explicit) return String(explicit);
      if (obj.contact_id || obj.contactId) {
        return this.readEntryToName(obj.contact_id || obj.contactId);
      }
    }
    return null;
  }

  getSenderName(msg: Message): string {
    const fromMessage = getMessageSenderName(msg);
    if (fromMessage && fromMessage !== 'Unknown') {
      return fromMessage;
    }

    const fromContacts = this.visibleContacts.find(
      (c) => String(c.contact_id) === String(msg.sender_id)
    );
    if (fromContacts) {
      return getContactDisplayName(fromContacts);
    }

    if (this.isOwnMessage(msg)) {
      return 'You';
    }

    return `User ${msg.sender_id}`;
  }

  formatTime(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  private scrollToBottom(): void {
    try {
      const el = this.scrollContainer?.nativeElement;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    } catch { /* ignore */ }
  }

  // ── Media helpers ────────────────────────────────────────────────────────

  private getFilenameLike(msg: Message, attachment?: Attachment): string {
    const anyMsg = msg as any;
    return String(
      attachment?.filename ||
      this.getPrimaryAttachment(msg)?.filename ||
      anyMsg?.filename ||
      anyMsg?.file_name ||
      msg.content ||
      ''
    ).toLowerCase();
  }

  getRenderableAttachments(msg: Message): Attachment[] {
    const attachments = this.getAllAttachments(msg);
    if (attachments.length > 0) return attachments;
    const primary = this.getPrimaryAttachment(msg);
    return primary ? [primary] : [];
  }

  trackByAttachment(index: number, attachment: Attachment): string {
    return attachment.file_id || attachment.url || `${attachment.filename}-${index}`;
  }

  private getAllAttachments(msg: Message): Attachment[] {
    const anyMsg = msg as any;
    const attachments: Attachment[] = [];
    const add = (attachment: Partial<Attachment> | string | null | undefined): void => {
      const raw = attachment as any;
      const fileId = String(
        typeof attachment === 'string' ? attachment :
        raw?.file_id ??
        raw?.fileId ??
        raw?.id ??
        raw?.attachment_id ??
        raw?.storage_file_id ??
        ''
      ).trim();
      if (fileId.startsWith('{') || fileId.startsWith('[')) {
        const ids = this.toArray(fileId);
        const filenames = this.toArray(raw?.filenames ?? raw?.filename ?? raw?.file_name);
        const mimeTypes = this.toArray(raw?.mime_types ?? raw?.mimeTypes ?? raw?.mime_type);
        ids.forEach((id, idx) => {
          add({
            file_id: id,
            filename: filenames[idx] || filenames[0] || raw?.filename || raw?.file_name || `Attachment ${idx + 1}`,
            mime_type: mimeTypes[idx] || raw?.mime_type || raw?.mimeType,
          });
        });
        return;
      }
      const url = String(raw?.url ?? raw?.file_url ?? raw?.download_url ?? '').trim();
      if (!fileId && !url) return;
      if (fileId && attachments.some((a) => a.file_id === fileId)) return;
      if (!fileId && url && attachments.some((a) => a.url === url)) return;
      attachments.push({
        file_id: fileId,
        filename: String(
          raw?.filename ??
          raw?.file_name ??
          raw?.name ??
          'File'
        ),
        mime_type: raw?.mime_type ?? raw?.mimeType,
        size_bytes: raw?.size_bytes ?? raw?.sizeBytes,
        url: url || undefined,
      });
    };

    if (Array.isArray(msg.attachments)) {
      msg.attachments.forEach(add);
    }

    const mediaValue = String(msg.media_url || '').trim();
    if (mediaValue.startsWith('{') || mediaValue.startsWith('[')) {
      try {
        const parsed = JSON.parse(mediaValue);
        const mediaAttachments = Array.isArray(parsed) ? parsed : parsed?.attachments;
        if (Array.isArray(mediaAttachments)) {
          mediaAttachments.forEach(add);
        }
        if (!Array.isArray(parsed)) {
          const ids = this.toArray(parsed?.ids ?? parsed?.file_ids ?? parsed?.attachment_ids);
          const filenames = this.toArray(parsed?.filenames);
          const mimeTypes = this.toArray(parsed?.mime_types ?? parsed?.mimeTypes);
          ids.forEach((id, idx) => {
            add({
              file_id: id,
              filename: filenames[idx] || filenames[0] || `Attachment ${idx + 1}`,
              mime_type: mimeTypes[idx],
            });
          });
        }
      } catch {
        // Non-JSON media_url values are handled by getPrimaryAttachment().
      }
    }

    const ids = this.toArray(anyMsg?.attachment_ids ?? anyMsg?.file_ids);
    const filenames = this.toArray(anyMsg?.filenames);
    const mimeTypes = this.toArray(anyMsg?.mime_types ?? anyMsg?.mimeTypes);
    ids.forEach((id, idx) => {
      add({
        file_id: id,
        filename: filenames[idx] || filenames[0] || `Attachment ${idx + 1}`,
        mime_type: mimeTypes[idx] || anyMsg?.mime_type || anyMsg?.attachment_mime_type,
      });
    });

    return attachments;
  }

  private toArray(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value
        .map((x: any) => (typeof x === 'string' ? x : x?.file_id ?? x?.id ?? ''))
        .map((x) => String(x).trim())
        .filter(Boolean);
    }
    if (typeof value === 'string' && value.trim()) {
      const trimmed = value.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) return this.toArray(parsed);
          return this.toArray(parsed?.ids ?? parsed?.file_ids ?? parsed?.attachment_ids ?? parsed?.attachments);
        } catch {
          return [];
        }
      }
      return value
        .split(/[,\s]+/)
        .map((x) => x.trim())
        .filter(Boolean);
    }
    return [];
  }

  /** Returns the primary attachment for a message, if any. */
  private getPrimaryAttachment(msg: Message): Attachment | null {
    const attachments = this.getAllAttachments(msg);
    if (attachments.length > 0) return attachments[0];

    // Some API responses provide file metadata in alternate fields.
    const anyMsg = msg as any;
    const mu = String(msg.media_url || '').trim();
    const mediaIsDirectUrl =
      mu.startsWith('http://') || mu.startsWith('https://') || mu.startsWith('data:');
    const mediaIsStructured = mu.startsWith('{') || mu.startsWith('[');
    const fileId =
      anyMsg?.file_id ||
      anyMsg?.attachment_id ||
      anyMsg?.attachment_ids?.[0] ||
      (!mediaIsDirectUrl && !mediaIsStructured && mu ? mu : undefined);
    const mime = anyMsg?.mime_type || anyMsg?.attachment_mime_type;
    const explicitFilename = anyMsg?.filename || anyMsg?.file_name;
    const filename =
      explicitFilename ||
      (fileId || mime || msg.message_type !== 'TEXT' ? msg.content : '');
    if (fileId || explicitFilename || mime || msg.message_type === 'FILE' || msg.message_type === 'IMAGE') {
      return {
        file_id: String(fileId || ''),
        filename: String(filename || 'File'),
        mime_type: mime ? String(mime) : undefined,
        url: mediaIsDirectUrl ? mu : undefined,
      };
    }
    return null;
  }

  isImageAttachment(msg: Message, attachment?: Attachment): boolean {
    const mime = attachment?.mime_type || this.getPrimaryAttachment(msg)?.mime_type || '';
    if (mime.startsWith('image/')) return true;
    const name = this.getFilenameLike(msg, attachment);
    if (/\.(png|jpe?g|gif|webp|bmp|svg|heic|heif)$/i.test(name)) return true;
    return !attachment && msg.message_type === 'IMAGE';
  }

  /** Returns the cached data URL for a message's media, or null and triggers background load. */
  getMediaUrl(msg: Message, attachment?: Attachment): string | null {
    const att = attachment || this.getPrimaryAttachment(msg);
    const fileId = att?.file_id?.trim();

    const directUrl =
      att?.url ||
      (!attachment ? msg.media_url : undefined) ||
      (!attachment ? (msg as any)?.url : undefined) ||
      (!attachment ? (msg as any)?.file_url : undefined);
    if (
      directUrl &&
      (directUrl.startsWith('http://') ||
        directUrl.startsWith('https://') ||
        directUrl.startsWith('data:'))
    ) {
      return directUrl;
    }

    if (!fileId) {
      return null;
    }

    const cached = this.fileService.getCachedDataUrl(fileId);
    if (cached) return cached;
    if (this.mediaFailed.has(fileId)) return null;

    // Not yet cached — kick off a background fetch
    this.fetchMedia(fileId);
    return null;
  }

  private prewarmMedia(messages: Message[]): void {
    for (const msg of messages) {
      for (const att of this.getRenderableAttachments(msg)) {
        if (!this.isImageAttachment(msg, att)) continue;
        const fileId = att.file_id?.trim();
        if (!fileId || fileId.startsWith('temp-')) continue;
        if (this.mediaFailed.has(fileId)) continue;
        if (this.fileService.getCachedDataUrl(fileId)) continue;
        // Queue all files so download links appear once retrieval completes.
        this.fetchMedia(fileId);
      }
    }
  }

  private fetchMedia(fileId: string): void {
    if (!fileId || fileId.startsWith('temp-') || this.mediaLoading.has(fileId) || this.mediaFailed.has(fileId)) return;
    this.mediaLoading.add(fileId);
    this.mediaQueue.push(fileId);
    this.pumpMediaQueue();
  }

  private pumpMediaQueue(): void {
    while (this.activeMediaRequests < this.maxMediaRequests && this.mediaQueue.length > 0) {
      const fileId = this.mediaQueue.shift();
      if (!fileId) continue;
      this.activeMediaRequests += 1;

      this.fileService.getFileDataUrl(fileId).subscribe({
        next: () => {
          this.finishMediaRequest(fileId);
        },
        error: () => {
          this.mediaFailed.add(fileId);
          this.finishMediaRequest(fileId);
        },
      });
    }
  }

  private finishMediaRequest(fileId: string): void {
    this.activeMediaRequests = Math.max(0, this.activeMediaRequests - 1);
    this.mediaLoading.delete(fileId);
    this.cdr.markForCheck();
    this.pumpMediaQueue();
  }

  private resetMediaQueue(): void {
    this.mediaQueue = [];
    this.mediaLoading.clear();
    this.activeMediaRequests = 0;
  }

  shouldShowMediaSpinner(target: Message | Attachment): boolean {
    const fileId = this.getAttachmentFileId(target);
    if (!fileId || fileId.startsWith('temp-')) return false;
    return this.mediaLoading.has(fileId) && !this.mediaFailed.has(fileId);
  }

  isVideoAttachment(msg: Message, attachment?: Attachment): boolean {
    const mime = attachment?.mime_type || this.getPrimaryAttachment(msg)?.mime_type || '';
    if (mime.startsWith('video/')) return true;
    const name = this.getFilenameLike(msg, attachment);
    return /\.(mp4|webm|mov|m4v|avi|mkv)$/i.test(name);
  }

  getAttachmentMimeType(msg: Message, attachment?: Attachment): string {
    return attachment?.mime_type || this.getPrimaryAttachment(msg)?.mime_type || 'application/octet-stream';
  }

  getAttachmentName(msg: Message, attachment?: Attachment): string {
    return attachment?.filename || this.getPrimaryAttachment(msg)?.filename || msg.content || 'File';
  }

  hasFileAttachment(msg: Message): boolean {
    return msg.message_type === 'FILE' || this.getRenderableAttachments(msg).length > 0;
  }

  hasMediaFailed(target: Message | Attachment): boolean {
    const fileId = this.getAttachmentFileId(target);
    return !!fileId && this.mediaFailed.has(fileId);
  }

  private getAttachmentFileId(target: Message | Attachment): string | undefined {
    if ('file_id' in target) return target.file_id;
    return this.getPrimaryAttachment(target)?.file_id;
  }

  getFileIcon(msg: Message, attachment?: Attachment): string {
    const mime = this.getAttachmentMimeType(msg, attachment);
    const name = this.getAttachmentName(msg, attachment).toLowerCase();
    if (mime.startsWith('video/') || /\.(mp4|webm|mov|m4v|avi|mkv)$/i.test(name)) return 'videocam';
    if (mime.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|flac)$/i.test(name)) return 'audiotrack';
    if (mime.includes('pdf') || name.endsWith('.pdf')) return 'picture_as_pdf';
    if (mime.includes('spreadsheet') || mime.includes('excel') || /\.(xls|xlsx|csv)$/i.test(name)) return 'table_chart';
    if (mime.includes('document') || mime.includes('word') || /\.(doc|docx|txt|rtf)$/i.test(name)) return 'description';
    if (mime.includes('zip') || /\.(zip|rar|7z|tar|gz)$/i.test(name)) return 'folder_zip';
    return 'insert_drive_file';
  }

  openLightbox(dataUrl: string, event?: Event): void {
    event?.stopPropagation();
    this.lightboxOpen.emit(dataUrl);
  }

  downloadAttachment(msg: Message, attachment: Attachment, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();

    const directUrl = attachment.url;
    if (directUrl && /^(https?:|data:)/i.test(directUrl)) {
      this.triggerDownload(directUrl, this.getAttachmentName(msg, attachment));
      return;
    }

    const fileId = attachment.file_id?.trim();
    if (!fileId || fileId.startsWith('temp-') || fileId.startsWith('{') || fileId.startsWith('[')) {
      return;
    }

    const cached = this.fileService.getCachedDataUrl(fileId);
    if (cached) {
      this.triggerDownload(cached, this.getAttachmentName(msg, attachment));
      return;
    }

    this.mediaLoading.add(fileId);
    this.fileService.getFileDataUrl(fileId).subscribe({
      next: (dataUrl) => {
        this.mediaLoading.delete(fileId);
        this.triggerDownload(dataUrl, this.getAttachmentName(msg, attachment));
        this.cdr.markForCheck();
      },
      error: () => {
        this.mediaLoading.delete(fileId);
        this.mediaFailed.add(fileId);
        this.cdr.markForCheck();
      },
    });
  }

  private triggerDownload(url: string, filename: string): void {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || 'attachment';
    link.target = '_blank';
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // ── Reactions ────────────────────────────────────────────────────────────

  onEmojiSelected(emoji: string, messageId: string): void {
    this.toggleReaction(emoji, messageId);
  }

  toggleReaction(emoji: string, messageId: string): void {
    const msg = this.messages.find(m => m.message_id === messageId);
    if (!msg) return;
    
    const reaction = msg.reactions?.find(r => r.emoji === emoji);
    if (reaction?.hasReacted) {
      this.store.removeReaction(messageId, emoji);
    } else {
      this.store.addReaction(messageId, emoji);
    }
  }

  getReactorTooltip(reaction: any): string {
    if (!reaction?.reactors?.length) return '';
    return reaction.reactors.join(', ');
  }
}
