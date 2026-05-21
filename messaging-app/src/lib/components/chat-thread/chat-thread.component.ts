import {
  Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked, ChangeDetectorRef,
  Output, EventEmitter,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription, combineLatest } from 'rxjs';
import { MessagingStoreService } from '../../services/messaging-store.service';
import { MessagingApiService } from '../../services/messaging-api.service';
import { MessagingFileService } from '../../services/messaging-file.service';
import { AuthService } from '../../services/auth.service';
import { Contact, ConversationParticipant, Message, Attachment, getContactDisplayName, getMessageSenderName } from '../../models/messaging.models';
import { MentionOption, MessageInputComponent, MessagePayload, MessageTextPayload, ReplyPreview } from '../message-input/message-input.component';

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
      [style.--message-text-scale]="messageTextScale"
      [style.--code-text-scale]="codeTextScale"
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
                <div *ngIf="getReplyPreview(msg) as reply" class="reply-context">
                  <mat-icon>reply</mat-icon>
                  <div>
                    <span>{{ reply.senderName }}</span>
                    <p>{{ reply.content }}</p>
                  </div>
                </div>
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
                <div
                  *ngIf="hasFileAttachment(msg) && getMessageCaption(msg)"
                  class="attachment-caption"
                >
                  <div *ngIf="isCodeContent(getMessageCaption(msg), msg); else nonCodeCaption" class="code-message-wrap attachment-render-block">
                    <button type="button" class="render-copy-btn" (click)="copyTextValue(getMessageCaption(msg), $event)" title="Copy code">
                      <mat-icon>content_copy</mat-icon>
                    </button>
                    <pre class="code-message"><code [innerHTML]="getHighlightedCodeContent(getMessageCaption(msg))"></code></pre>
                    <span class="code-language">{{ getCodeLanguageContent(getMessageCaption(msg)) }}</span>
                  </div>
                  <ng-template #nonCodeCaption>
                    <div *ngIf="isMarkdownContent(getMessageCaption(msg)); else plainCaption" class="md-message-wrap attachment-render-block">
                      <button type="button" class="render-copy-btn" (click)="copyTextValue(getMessageCaption(msg), $event)" title="Copy markdown">
                        <mat-icon>content_copy</mat-icon>
                      </button>
                      <div class="md-message" [innerHTML]="getMarkdownHtmlContent(getMessageCaption(msg))"></div>
                      <span class="md-language">md</span>
                    </div>
                    <ng-template #plainCaption>
                      <div
                        class="text-content"
                        [class.preformatted-text]="isPreformattedContent(getMessageCaption(msg))"
                      >
                        {{ getMessageCaption(msg) }}
                      </div>
                    </ng-template>
                  </ng-template>
                </div>
                <ng-container *ngIf="msg.message_type === 'TEXT' && !hasFileAttachment(msg)">
                  <div *ngIf="isCodeText(msg); else nonCodeTextMessage" class="code-message-wrap">
                    <button type="button" class="render-copy-btn" (click)="copyCode(msg, $event)" title="Copy code">
                      <mat-icon>content_copy</mat-icon>
                    </button>
                    <pre class="code-message"><code [innerHTML]="getHighlightedCode(msg)"></code></pre>
                    <span class="code-language">{{ getCodeLanguage(msg) }}</span>
                  </div>
                  <ng-template #nonCodeTextMessage>
                  <div *ngIf="isTableText(msg); else plainTextMessage" class="table-message-wrap">
                    <button type="button" class="render-copy-btn" (click)="copyMessageText(msg, $event)" title="Copy table">
                      <mat-icon>content_copy</mat-icon>
                    </button>
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
                    <div *ngIf="isMarkdownText(msg); else rawTextMessage" class="md-message-wrap">
                      <button type="button" class="render-copy-btn" (click)="copyMessageText(msg, $event)" title="Copy markdown">
                        <mat-icon>content_copy</mat-icon>
                      </button>
                      <div class="md-message" [innerHTML]="getMarkdownHtml(msg)"></div>
                      <span class="md-language">md</span>
                    </div>
                    <ng-template #rawTextMessage>
                      <div
                        class="text-content"
                        [class.preformatted-text]="isPreformattedText(msg)"
                      >
                        {{ getMessageBody(msg) }}
                      </div>
                    </ng-template>
                  </ng-template>
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
                <button
                  *ngIf="isGroup"
                  type="button"
                  class="reply-message-btn"
                  (click)="startReply(msg, $event)"
                  matTooltip="Reply"
                  matTooltipPosition="above"
                >
                  <mat-icon>reply</mat-icon>
                </button>
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
        [replyTo]="replyToMessage ? getComposeReplyPreview(replyToMessage) : null"
        [enableMentions]="isGroup"
        [mentionOptions]="mentionOptions"
        (messageSent)="onSendMessage($event)"
        (messageWithFiles)="onSendWithFiles($event)"
        (replyCancelled)="clearReply()"
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
      container-type: inline-size;
      --attachment-thumb-size: clamp(120px, 48cqw, 180px);
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
      font-size: calc(clamp(11px, 3.4cqw, 13px) * var(--message-text-scale, 1));
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

    .reply-context {
      display: flex;
      align-items: center;
      gap: 7px;
      margin-bottom: 7px;
      padding: 7px 9px;
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.08);
      border-left: 3px solid rgba(127, 180, 255, 0.78);
      max-width: min(68cqw, 420px);
    }

    .reply-context mat-icon {
      color: #bfdbfe;
      font-size: 16px;
      width: 16px;
      height: 16px;
      flex-shrink: 0;
    }

    .reply-context div {
      min-width: 0;
    }

    .reply-context span {
      display: block;
      color: #bfdbfe;
      font-size: 11px;
      font-weight: 700;
      margin-bottom: 2px;
    }

    .reply-context p {
      margin: 0;
      color: rgba(255, 255, 255, 0.78);
      font-size: 12px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .text-content {
      white-space: pre-wrap;
      tab-size: 4;
    }

    .text-content.preformatted-text {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      font-size: calc(clamp(10px, 3.1cqw, 12px) * var(--code-text-scale, 1));
      line-height: 1.45;
      overflow-x: auto;
      max-width: min(72cqw, 520px);
      scrollbar-width: none;
      -ms-overflow-style: none;
    }

    .text-content.preformatted-text::-webkit-scrollbar {
      display: none;
    }

    .attachment-caption {
      margin-top: 8px;
      width: var(--attachment-thumb-size);
      max-width: var(--attachment-thumb-size);
      box-sizing: border-box;
    }

    .attachment-caption .text-content {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      max-width: 100%;
    }

    .attachment-render-block {
      width: 100%;
      max-width: 100%;
    }

    .code-message-wrap {
      position: relative;
      max-width: min(76cqw, 560px);
      border-radius: 10px;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.14);
      background: #061827;
    }

    .render-copy-btn {
      position: absolute;
      top: 6px;
      right: 6px;
      z-index: 2;
      width: 26px;
      height: 26px;
      border: none;
      border-radius: 7px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      background: rgba(7, 29, 48, 0.82);
      color: rgba(255, 255, 255, 0.78);
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.12s, background 0.12s, color 0.12s;
    }

    .code-message-wrap:hover .render-copy-btn,
    .table-message-wrap:hover .render-copy-btn,
    .md-message-wrap:hover .render-copy-btn,
    .render-copy-btn:focus {
      opacity: 1;
    }

    .render-copy-btn:hover {
      background: rgba(127, 180, 255, 0.22);
      color: #fff;
    }

    .render-copy-btn mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      line-height: 16px;
    }

    .code-message {
      margin: 0;
      padding: 12px 42px 28px 12px;
      overflow-x: auto;
      color: #dbeafe;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      font-size: calc(clamp(10px, 3.1cqw, 12px) * var(--code-text-scale, 1));
      line-height: 1.45;
      white-space: pre;
      tab-size: 2;
      scrollbar-width: none;
      -ms-overflow-style: none;
    }

    .code-message::-webkit-scrollbar {
      display: none;
    }

    .code-language {
      position: absolute;
      right: 8px;
      bottom: 6px;
      padding: 2px 7px;
      border-radius: 999px;
      background: rgba(127, 180, 255, 0.16);
      color: #bfdbfe;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      pointer-events: none;
    }

    .md-language {
      position: absolute;
      right: 8px;
      bottom: 6px;
      padding: 2px 7px;
      border-radius: 999px;
      background: rgba(134, 239, 172, 0.14);
      color: #bbf7d0;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      pointer-events: none;
    }

    :host ::ng-deep .code-token-keyword { color: #93c5fd; font-weight: 700; }
    :host ::ng-deep .code-token-string { color: #86efac; }
    :host ::ng-deep .code-token-number { color: #fbbf24; }
    :host ::ng-deep .code-token-comment { color: #94a3b8; font-style: italic; }
    :host ::ng-deep .code-token-function { color: #c4b5fd; }

    .table-message-wrap {
      position: relative;
      max-width: min(76cqw, 560px);
      overflow-x: auto;
      border-radius: 9px;
      border: 1px solid rgba(255, 255, 255, 0.16);
      background: rgba(255, 255, 255, 0.04);
      scrollbar-width: none;
      -ms-overflow-style: none;
    }

    .table-message-wrap::-webkit-scrollbar {
      display: none;
    }

    .pasted-table {
      border-collapse: collapse;
      min-width: 100%;
      font-size: calc(clamp(10px, 3.1cqw, 12px) * var(--code-text-scale, 1));
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

    .md-message-wrap {
      position: relative;
      max-width: min(76cqw, 560px);
      overflow-x: auto;
      border-radius: 10px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      background: rgba(255, 255, 255, 0.05);
      scrollbar-width: none;
      -ms-overflow-style: none;
    }

    .md-message-wrap::-webkit-scrollbar {
      display: none;
    }

    .md-message {
      padding: 10px 42px 28px 12px;
      color: #f5f7ff;
      font-size: calc(clamp(11px, 3.4cqw, 13px) * var(--message-text-scale, 1));
      line-height: 1.45;
      overflow-wrap: anywhere;
    }

    :host ::ng-deep .md-message h1,
    :host ::ng-deep .md-message h2,
    :host ::ng-deep .md-message h3 {
      margin: 8px 0 6px;
      color: #fff;
      line-height: 1.25;
    }

    :host ::ng-deep .md-message h1 { font-size: 18px; }
    :host ::ng-deep .md-message h2 { font-size: 16px; }
    :host ::ng-deep .md-message h3 { font-size: 14px; }

    :host ::ng-deep .md-message p {
      margin: 6px 0;
    }

    :host ::ng-deep .md-message ul,
    :host ::ng-deep .md-message ol {
      margin: 6px 0;
      padding-left: 20px;
    }

    :host ::ng-deep .md-message blockquote {
      margin: 8px 0;
      padding-left: 10px;
      border-left: 3px solid rgba(127, 180, 255, 0.55);
      color: rgba(255, 255, 255, 0.78);
    }

    :host ::ng-deep .md-message code {
      padding: 1px 5px;
      border-radius: 5px;
      background: rgba(0, 0, 0, 0.25);
      color: #bfdbfe;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      font-size: 12px;
    }

    :host ::ng-deep .md-message pre {
      margin: 8px 0;
      padding: 9px;
      border-radius: 8px;
      overflow-x: auto;
      background: #061827;
      scrollbar-width: none;
      -ms-overflow-style: none;
    }

    :host ::ng-deep .md-message pre::-webkit-scrollbar {
      display: none;
    }

    :host ::ng-deep .md-message pre code {
      padding: 0;
      background: transparent;
      color: #dbeafe;
      white-space: pre;
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

    .reply-message-btn {
      position: absolute;
      right: -10px;
      bottom: -10px;
      width: 24px;
      height: 24px;
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 999px;
      background: #071d30;
      color: rgba(255, 255, 255, 0.78);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      cursor: pointer;
      opacity: 0;
      transform: scale(0.92);
      transition: opacity 0.12s, transform 0.12s, background 0.12s, color 0.12s;
      z-index: 3;
    }

    .message-bubble:hover .reply-message-btn,
    .reply-message-btn:focus {
      opacity: 1;
      transform: scale(1);
    }

    .reply-message-btn:hover {
      background: rgba(127, 180, 255, 0.22);
      color: #fff;
    }

    .reply-message-btn mat-icon {
      font-size: 15px;
      width: 15px;
      height: 15px;
      line-height: 15px;
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
  messageTextScale = 1;
  codeTextScale = 1;
  loading = false;
  myContactId: string | null = null;
  replyToMessage: Message | null = null;
  mentionOptions: MentionOption[] = [];

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
  private lastMentionConversationId: string | null = null;
  private lastGroupMembershipVersion = -1;

  constructor(
    private store: MessagingStoreService,
    private api: MessagingApiService,
    private auth: AuthService,
    private fileService: MessagingFileService,
    private cdr: ChangeDetectorRef,
    private sanitizer: DomSanitizer,
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
      this.store.messageTextScale,
      this.store.codeTextScale,
      this.store.groupMembershipVersion,
    ]).subscribe(([convId, msgMap, chats, contacts, loading, removedGroupIds, messageTextScale, codeTextScale, groupMembershipVersion]) => {
      this.loading = loading;
      this.visibleContacts = contacts || [];
      this.messageTextScale = messageTextScale;
      this.codeTextScale = codeTextScale;
      if (this.isGroup && this.conversationId && this.mentionOptions.length === 0) {
        this.refreshMentionOptions();
      }
      if (
        this.isGroup &&
        this.conversationId &&
        groupMembershipVersion !== this.lastGroupMembershipVersion
      ) {
        this.lastGroupMembershipVersion = groupMembershipVersion;
        this.refreshMentionOptions(true);
      }

      if (convId && convId !== this.conversationId) {
        this.conversationId = convId;
        this.resetMediaQueue();
        this.clearReply();
        this.shouldScrollToBottom = true;
        const chat = chats.find((c) => c.conversationId === convId);
        this.conversationName = chat?.name || 'Chat';
        this.isGroup = chat?.isGroup || false;
        this.refreshMentionOptions(true);
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

  startReply(message: Message, event?: Event): void {
    event?.stopPropagation();
    if (!this.isGroup || this.isSystemMessage(message)) return;
    this.replyToMessage = message;
    this.messageInput?.focus();
  }

  clearReply(): void {
    this.replyToMessage = null;
  }

  getReplyPreview(message: Message): ReplyPreview | null {
    const reply = message.reply_to;
    if (!reply) return null;
    return {
      senderName: reply.sender_name || 'Message',
      content: this.truncateReplyText(reply.content || 'Attachment'),
    };
  }

  getComposeReplyPreview(message: Message): ReplyPreview {
    return {
      senderName: this.getSenderName(message),
      content: this.truncateReplyText(this.getMessageBody(message) || this.getAttachmentName(message)),
    };
  }

  getMessageBody(message: Message): string {
    return String(message.content || '');
  }

  private truncateReplyText(value: string): string {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    return text.length > 120 ? `${text.slice(0, 117)}...` : text || 'Attachment';
  }

  private refreshMentionOptions(force = false): void {
    if (!this.isGroup || !this.conversationId) {
      this.mentionOptions = [];
      this.lastMentionConversationId = null;
      return;
    }

    const convId = this.conversationId;
    if (!force && this.lastMentionConversationId === convId && this.mentionOptions.length > 0) return;
    this.lastMentionConversationId = convId;

    this.api.getConversationParticipants(convId).subscribe({
      next: (members) => {
        const options = members
          .filter((member) => String(member.contact_id) !== String(this.auth.contactId || ''))
          .map((member) => this.participantToMentionOption(member))
          .filter((option): option is MentionOption => !!option);
        this.mentionOptions = options.length ? options : this.contactsToMentionOptions();
        this.cdr.markForCheck();
      },
      error: () => {
        this.mentionOptions = this.contactsToMentionOptions();
        this.cdr.markForCheck();
      },
    });
  }

  private participantToMentionOption(member: ConversationParticipant): MentionOption | null {
    const token = this.toMentionToken(member.username || member.email || String(member.contact_id));
    if (!token) return null;
    return {
      contactId: String(member.contact_id),
      label: member.username || member.email || `Contact ${member.contact_id}`,
      token,
    };
  }

  private contactsToMentionOptions(): MentionOption[] {
    return this.visibleContacts
      .filter((contact) => String(contact.contact_id) !== String(this.auth.contactId || ''))
      .map((contact) => {
        const label = getContactDisplayName(contact);
        return {
          contactId: String(contact.contact_id),
          label,
          token: this.toMentionToken(contact.username || contact.email?.split('@')[0] || label),
        };
      })
      .filter((option) => !!option.token);
  }

  private toMentionToken(value: string): string {
    return String(value || '')
      .trim()
      .replace(/^@/, '')
      .replace(/@.*$/, '')
      .replace(/[^a-zA-Z0-9._-]/g, '')
      .slice(0, 32);
  }

  private getMentionIdsFromContent(content: string): string[] {
    if (!this.isGroup || !content || !this.mentionOptions.length) return [];
    const mentionedTokens = new Set(
      Array.from(content.matchAll(/(^|[^a-zA-Z0-9._-])@([a-zA-Z0-9._-]+)/g))
        .map((match) => match[2].toLowerCase())
    );
    return this.mentionOptions
      .filter((option) => mentionedTokens.has(option.token.toLowerCase()))
      .map((option) => option.contactId);
  }

  onSendMessage(payload: MessageTextPayload): void {
    if (this.isRemovedFromGroup) return;
    const content = payload.text;
    const mentions = this.getMentionIdsFromContent(content);
    this.store.sendMessage(this.conversationId, content, 'TEXT', {
      replyTo: this.replyToMessage,
      mentions,
      forcePlainText: payload.forcePlainText,
    });
    this.clearReply();
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
        const messageText = payload.text || filenames.join(', ');
        const outgoingText = this.store.prepareOutgoingMessageContent(messageText, this.replyToMessage, payload.forcePlainText);
        const replyTo = this.replyToMessage ? {
          message_id: String(this.replyToMessage.message_id || ''),
          sender_name: this.getSenderName(this.replyToMessage),
          content: this.truncateReplyText(this.getMessageBody(this.replyToMessage) || this.getAttachmentName(this.replyToMessage)),
        } : undefined;
        const mentions = this.getMentionIdsFromContent(messageText);
        this.fileService
          .sendMessageWithAttachments(
            this.conversationId!,
            this.auth.contactId!,
            outgoingText,
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
                content: messageText,
                reply_to: replyTo,
                mentions,
                render_as_plain_text: payload.forcePlainText,
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
              this.clearReply();
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
    return this.isPreformattedContent(this.getMessageBody(msg));
  }

  isPreformattedContent(content: string): boolean {
    return content.includes('\t') || content.includes('\n') || / {2,}/.test(content);
  }

  getMessageCaption(msg: Message): string {
    const content = this.getMessageBody(msg).trim();
    if (!content) return '';

    const attachmentNames = this.getRenderableAttachments(msg)
      .map((attachment) => String(attachment.filename || '').trim())
      .filter(Boolean);
    if (!attachmentNames.length) return content;

    const namesText = attachmentNames.join(', ');
    if (content === namesText || attachmentNames.includes(content)) return '';
    return content;
  }

  isCodeText(msg: Message): boolean {
    return this.isCodeContent(this.getMessageBody(msg), msg);
  }

  isCodeContent(value: string, msg?: Message): boolean {
    const content = value.trim();
    if (msg?.render_as_plain_text) return false;
    if (!content || (msg ? this.isTableText(msg) : this.isTableContent(content))) return false;
    if (this.looksLikeMarkdown(content) && !this.isSingleFencedCodeBlock(content)) return false;
    if (/^```[\s\S]*```$/.test(content)) return true;
    return this.detectCodeLanguage(content) !== null;
  }

  isMarkdownText(msg: Message): boolean {
    return this.isMarkdownContent(this.getMessageBody(msg), msg);
  }

  isMarkdownContent(value: string, msg?: Message): boolean {
    const content = value.trim();
    if (!content || (msg ? this.isTableText(msg) : this.isTableContent(content)) || this.isSingleFencedCodeBlock(content)) return false;
    return this.looksLikeMarkdown(content);
  }

  getCodeLanguage(msg: Message): string {
    return this.getCodeLanguageContent(this.getMessageBody(msg));
  }

  getCodeLanguageContent(content: string): string {
    const parsed = this.parseCodeBlock(content);
    return parsed.language || this.detectCodeLanguage(parsed.code) || 'code';
  }

  getHighlightedCode(msg: Message): SafeHtml {
    return this.getHighlightedCodeContent(this.getMessageBody(msg));
  }

  getHighlightedCodeContent(content: string): SafeHtml {
    const parsed = this.parseCodeBlock(content);
    const language = parsed.language || this.detectCodeLanguage(parsed.code) || 'code';
    const escaped = this.escapeHtml(parsed.code);
    const highlighted = this.highlightCode(escaped, language);
    return this.sanitizer.bypassSecurityTrustHtml(highlighted);
  }

  getMarkdownHtml(msg: Message): SafeHtml {
    return this.getMarkdownHtmlContent(this.getMessageBody(msg));
  }

  getMarkdownHtmlContent(content: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(this.renderMarkdown(content));
  }

  copyCode(msg: Message, event: MouseEvent): void {
    event.stopPropagation();
    const content = this.getMessageBody(msg);
    const parsed = this.parseCodeBlock(content);
    this.copyText(parsed.code || content);
  }

  copyMessageText(msg: Message, event: MouseEvent): void {
    event.stopPropagation();
    this.copyText(this.getMessageBody(msg));
  }

  copyTextValue(text: string, event: MouseEvent): void {
    event.stopPropagation();
    this.copyText(text);
  }

  private parseCodeBlock(content: string): { language: string; code: string } {
    const trimmed = content.trim();
    const match = trimmed.match(/^```([a-zA-Z0-9_+-]*)\s*\n?([\s\S]*?)```$/);
    if (!match) return { language: '', code: content };
    return { language: (match[1] || '').toLowerCase(), code: match[2] || '' };
  }

  private isSingleFencedCodeBlock(content: string): boolean {
    return /^```[a-zA-Z0-9_+-]*\s*\n?[\s\S]*?```$/.test(content.trim());
  }

  private looksLikeMarkdown(content: string): boolean {
    return /(^#{1,6}\s)|(^[-*]\s)|(^\d+\.\s)|(^>\s)|(\*\*[^*]+\*\*)|(`[^`]+`)|(\[[^\]]+\]\([^)]+\))|(^---$)|(^-\s\[[ x]\]\s)|(^```[a-zA-Z0-9_+-]*\s*$)/m.test(content);
  }

  private detectCodeLanguage(code: string): string | null {
    const trimmed = code.trim();
    if (!trimmed.includes('\n') && trimmed.length < 40) return null;
    if (/^\s*(select|with|insert|update|delete|create|alter|drop)\b/i.test(trimmed)) return 'sql';
    const jsDeclaration = /\b(function|const|let|var)\s+[A-Za-z_$][\w$]*\s*(=|=>|\(|:)/.test(trimmed);
    const jsSyntax = /(=>|console\.log|import\s+.*from|export\s+|[{};])/.test(trimmed);
    if (jsDeclaration || jsSyntax) return 'javascript';
    if (/\b(def|import|from|print|class)\b/.test(trimmed) && /:\s*$|^\s{4}/m.test(trimmed)) return 'python';
    if (/<\/?[a-z][\s\S]*>/i.test(trimmed)) return 'html';
    if (/[{};]/.test(trimmed) && /[:=]/.test(trimmed)) return 'code';
    return null;
  }

  private highlightCode(escapedCode: string, language: string): string {
    const protectedTokens: string[] = [];
    const protect = (value: string, regex: RegExp, className: string): string =>
      value.replace(regex, (match) => {
        const token = `__CODE_TOKEN_${protectedTokens.length}__`;
        protectedTokens.push(`<span class="${className}">${match}</span>`);
        return token;
      });

    let highlighted = escapedCode;

    if (language === 'sql') {
      highlighted = protect(highlighted, /(--.*)$/gm, 'code-token-comment');
      highlighted = protect(highlighted, /(&quot;.*?&quot;|&#39;.*?&#39;|`.*?`)/g, 'code-token-string');
      highlighted = highlighted.replace(/\b(SELECT|FROM|WHERE|JOIN|LEFT|RIGHT|INNER|OUTER|ON|GROUP BY|ORDER BY|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|ALTER|DROP|AND|OR|NULL|IS|NOT|AS|LIMIT)\b/gi, '<span class="code-token-keyword">$1</span>');
      highlighted = highlighted.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="code-token-number">$1</span>');
      return this.restoreCodeTokens(highlighted, protectedTokens);
    }

    highlighted = protect(highlighted, /(\/\/.*|#.*)$/gm, 'code-token-comment');
    highlighted = protect(highlighted, /(&quot;.*?&quot;|&#39;.*?&#39;|`.*?`)/g, 'code-token-string');
    highlighted = highlighted.replace(/\b(function|const|let|var|return|if|else|for|while|class|import|from|export|async|await|def|print|try|catch|new|true|false|null|None)\b/g, '<span class="code-token-keyword">$1</span>');
    highlighted = highlighted.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="code-token-number">$1</span>');
    highlighted = highlighted.replace(/\b([a-zA-Z_$][\w$]*)(?=\()/g, '<span class="code-token-function">$1</span>');
    return this.restoreCodeTokens(highlighted, protectedTokens);
  }

  private restoreCodeTokens(value: string, protectedTokens: string[]): string {
    return protectedTokens.reduce(
      (html, token, index) => html.replace(new RegExp(`__CODE_TOKEN_${index}__`, 'g'), token),
      value
    );
  }

  private renderMarkdown(raw: string): string {
    const codeBlocks: string[] = [];
    const withoutCode = raw.replace(/```([a-zA-Z0-9_+-]*)\s*\n?([\s\S]*?)```/g, (_match, lang, code) => {
      const language = String(lang || 'code').toLowerCase();
      const token = `__MD_CODE_${codeBlocks.length}__`;
      codeBlocks.push(
        `<pre><code data-language="${this.escapeHtml(language)}">${this.escapeHtml(String(code || ''))}</code></pre>`
      );
      return token;
    });

    const lines = withoutCode.split(/\r?\n/);
    const html: string[] = [];
    let listType: 'ul' | 'ol' | null = null;

    const closeList = () => {
      if (listType) {
        html.push(`</${listType}>`);
        listType = null;
      }
    };

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed) {
        closeList();
        continue;
      }

      const tokenMatch = trimmed.match(/^__MD_CODE_(\d+)__$/);
      if (tokenMatch) {
        closeList();
        html.push(codeBlocks[Number(tokenMatch[1])] || '');
        continue;
      }

      const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
      if (heading) {
        closeList();
        html.push(`<h${heading[1].length}>${this.renderMarkdownInline(heading[2])}</h${heading[1].length}>`);
        continue;
      }

      if (/^---+$/.test(trimmed)) {
        closeList();
        html.push('<hr>');
        continue;
      }

      const unordered = trimmed.match(/^[-*]\s+(?:\[[ x]\]\s+)?(.+)$/i);
      if (unordered) {
        if (listType !== 'ul') {
          closeList();
          html.push('<ul>');
          listType = 'ul';
        }
        html.push(`<li>${this.renderMarkdownInline(unordered[1])}</li>`);
        continue;
      }

      const ordered = trimmed.match(/^\d+\.\s+(.+)$/);
      if (ordered) {
        if (listType !== 'ol') {
          closeList();
          html.push('<ol>');
          listType = 'ol';
        }
        html.push(`<li>${this.renderMarkdownInline(ordered[1])}</li>`);
        continue;
      }

      const quote = trimmed.match(/^>\s+(.+)$/);
      if (quote) {
        closeList();
        html.push(`<blockquote>${this.renderMarkdownInline(quote[1])}</blockquote>`);
        continue;
      }

      closeList();
      html.push(`<p>${this.renderMarkdownInline(trimmed)}</p>`);
    }

    closeList();
    return html.join('');
  }

  private renderMarkdownInline(value: string): string {
    let html = this.escapeHtml(value);
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    return html;
  }

  private copyText(text: string): void {
    if (!text) return;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(
        () => this.store.showToast('Copied to clipboard', 'success', 1600),
        () => this.fallbackCopyText(text)
      );
      return;
    }
    this.fallbackCopyText(text);
  }

  private fallbackCopyText(text: string): void {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      this.store.showToast('Copied to clipboard', 'success', 1600);
    } catch {
      this.store.showToast('Could not copy', 'error', 2200);
    }
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  isTableText(msg: Message): boolean {
    const rows = this.getTableRows(msg);
    return rows.length >= 2 && rows.some((row) => row.length >= 2);
  }

  private isTableContent(content: string): boolean {
    const rows = this.getTableRowsFromContent(content);
    return rows.length >= 2 && rows.some((row) => row.length >= 2);
  }

  getTableRows(msg: Message): string[][] {
    return this.getTableRowsFromContent(this.getMessageBody(msg));
  }

  private getTableRowsFromContent(value: string): string[][] {
    const content = value.trim();
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
          (msg.message_type === 'IMAGE' ? 'Image' : 'File')
        ),
        mime_type: raw?.mime_type ?? raw?.mimeType ?? (msg.message_type === 'IMAGE' ? 'image/*' : undefined),
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
              filename: filenames[idx] || filenames[0] || (msg.message_type === 'IMAGE' ? `Image ${idx + 1}` : `Attachment ${idx + 1}`),
              mime_type: mimeTypes[idx] || (msg.message_type === 'IMAGE' ? 'image/*' : undefined),
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
        filename: filenames[idx] || filenames[0] || (msg.message_type === 'IMAGE' ? `Image ${idx + 1}` : `Attachment ${idx + 1}`),
        mime_type: mimeTypes[idx] || anyMsg?.mime_type || anyMsg?.attachment_mime_type || (msg.message_type === 'IMAGE' ? 'image/*' : undefined),
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
    const mime = anyMsg?.mime_type || anyMsg?.attachment_mime_type || (msg.message_type === 'IMAGE' ? 'image/*' : undefined);
    const explicitFilename = anyMsg?.filename || anyMsg?.file_name;
    const filename =
      explicitFilename ||
      (msg.message_type === 'IMAGE' ? 'Image' : msg.message_type === 'FILE' ? 'File' : '');
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
    return msg.message_type === 'IMAGE';
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
