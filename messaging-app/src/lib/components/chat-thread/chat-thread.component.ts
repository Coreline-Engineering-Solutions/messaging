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
          <button *ngIf="isGroup" mat-icon-button class="hdr-btn" (click)="onGroupSettings()" matTooltip="Group settings" matTooltipPosition="below">
            <mat-icon>settings</mat-icon>
          </button>
        </div>
      </div>

      <div class="messages-area" #scrollContainer (scroll)="onScroll()">
        <div *ngIf="threadDragOver" class="thread-drag-overlay">
          <mat-icon>cloud_upload</mat-icon>
          <span>Drop files anywhere in this chat</span>
        </div>

        <div *ngIf="loading" class="loading-indicator">
          <mat-spinner diameter="24"></mat-spinner>
          <span>Loading messages...</span>
        </div>

        <button
          *ngIf="messages.length >= 50 && !loading"
          mat-stroked-button
          class="load-more-btn"
          (click)="loadOlder()"
        >
          Load older messages
        </button>

        <div class="messages-list">
          <ng-container *ngFor="let msg of messages; let i = index">
            <div
              *ngIf="shouldShowDateSeparator(i)"
              class="date-separator"
            >
              <span>{{ formatDate(msg.created_at) }}</span>
            </div>

            <div
              class="message-bubble-row"
              [class.own]="isOwnMessage(msg)"
              [class.other]="!isOwnMessage(msg)"
            >
              <div *ngIf="!isOwnMessage(msg)" class="sender-name">
                {{ getSenderName(msg) }}
              </div>
              <div class="message-bubble" [class.own-bubble]="isOwnMessage(msg)" (mouseenter)="hoveredMessageId = msg.message_id" (mouseleave)="hoveredMessageId = null">
                <!-- IMAGE ─────────────────────────────────────── -->
                <div *ngIf="isImageAttachment(msg)" class="image-message">
                  <ng-container *ngIf="getMediaUrl(msg) as dataUrl; else imgFallback">
                    <img [src]="dataUrl" alt="Image" class="media-img" (click)="openLightbox(dataUrl)" />
                  </ng-container>
                  <ng-template #imgFallback>
                    <div *ngIf="shouldShowMediaSpinner(msg); else imgAsFile" class="media-placeholder">
                      <mat-spinner diameter="22"></mat-spinner>
                    </div>
                    <ng-template #imgAsFile>
                      <div class="file-message">
                        <mat-icon class="file-msg-icon">image</mat-icon>
                        <span class="file-msg-name">{{ getAttachmentName(msg) }}</span>
                      </div>
                    </ng-template>
                  </ng-template>
                </div>

                <!-- FILE / VIDEO ─────────────────────────────── -->
                <div *ngIf="hasFileAttachment(msg) && !isImageAttachment(msg)" class="file-message">
                  <ng-container *ngIf="isVideoAttachment(msg); else regularFile">
                    <ng-container *ngIf="getMediaUrl(msg) as videoUrl; else videoLoading">
                      <div class="video-message">
                        <video controls class="media-video" preload="metadata">
                          <source [src]="videoUrl" [type]="getAttachmentMimeType(msg)" />
                          Your browser does not support video.
                        </video>
                        <a
                          class="video-download"
                          [href]="videoUrl"
                          [attr.download]="getAttachmentName(msg)"
                          target="_blank"
                          rel="noopener"
                        >
                          Download {{ getAttachmentName(msg) }}
                        </a>
                      </div>
                    </ng-container>
                    <ng-template #videoLoading>
                      <div class="media-placeholder">
                        <mat-spinner diameter="22"></mat-spinner>
                        <span class="media-load-label">Loading video…</span>
                      </div>
                    </ng-template>
                  </ng-container>
                  <ng-template #regularFile>
                    <ng-container *ngIf="getMediaUrl(msg) as fileUrl; else fileLoading">
                      <a
                        class="file-download"
                        [href]="fileUrl"
                        [attr.download]="getAttachmentName(msg)"
                        target="_blank"
                        rel="noopener"
                        (click)="$event.stopPropagation()"
                      >
                        <mat-icon class="file-msg-icon">{{ getFileIcon(msg) }}</mat-icon>
                        <span class="file-msg-name">{{ getAttachmentName(msg) }}</span>
                        <mat-icon class="file-download-icon">download</mat-icon>
                      </a>
                    </ng-container>
                    <ng-template #fileLoading>
                      <mat-icon class="file-msg-icon">{{ getFileIcon(msg) }}</mat-icon>
                      <span class="file-msg-name">{{ getAttachmentName(msg) }}</span>
                      <mat-spinner *ngIf="shouldShowMediaSpinner(msg)" diameter="18"></mat-spinner>
                      <span *ngIf="hasMediaFailed(msg)" class="media-load-label">Unavailable</span>
                    </ng-template>
                  </ng-template>
                </div>
                <div
                  *ngIf="msg.message_type === 'TEXT' && !isImageAttachment(msg) && !hasFileAttachment(msg)"
                  class="text-content"
                >
                  {{ msg.content }}
                </div>
                <div class="message-meta">
                  <span class="msg-time">{{ formatTime(msg.created_at) }}</span>
                  <mat-icon *ngIf="isOwnMessage(msg) && msg.is_read" class="read-icon">done_all</mat-icon>
                  <mat-icon *ngIf="isOwnMessage(msg) && !msg.is_read" class="read-icon unread">done</mat-icon>
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
                    {{ r.emoji }} {{ r.count }}
                  </button>
                </div>
              </div>
            </div>
          </ng-container>
        </div>

        <div *ngIf="messages.length === 0 && !loading" class="empty-chat">
          <mat-icon>chat_bubble_outline</mat-icon>
          <p>No messages yet. Say hello!</p>
        </div>
      </div>

      <app-message-input
        (messageSent)="onSendMessage($event)"
        (messageWithFiles)="onSendWithFiles($event)"
      ></app-message-input>
    </div>

  `,
  styles: [`
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
      gap: 0;
    }

    .header-actions button {
      width: 32px;
      height: 32px;
    }

    .hdr-btn {
      border-radius: 6px !important;
      transition: background 0.15s, box-shadow 0.15s;
    }

    .hdr-btn:hover {
      background: rgba(255, 255, 255, 0.15) !important;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
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

    .image-message {
      line-height: 0;
    }

    .media-img {
      max-width: 220px;
      max-height: 280px;
      border-radius: 10px;
      display: block;
      cursor: zoom-in;
      object-fit: cover;
      transition: opacity 0.15s;
    }

    .media-img:hover {
      opacity: 0.88;
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
      gap: 8px;
      min-width: 80px;
      min-height: 44px;
      color: rgba(255,255,255,0.6);
      font-size: 11px;
    }

    .media-load-label {
      font-size: 11px;
      color: rgba(255,255,255,0.6);
    }

    .file-message {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 0;
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
      font-size: 20px;
      width: 20px;
      height: 20px;
      color: rgba(255, 255, 255, 0.8);
    }

    .file-msg-name {
      font-size: 13px;
      color: #fff;
      word-break: break-all;
    }

    .file-download-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: rgba(255, 255, 255, 0.7);
      flex-shrink: 0;
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

    .read-icon.unread {
      opacity: 0.4;
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

    /* Both sides: anchor to the right edge of the bubble so the popup
       grows toward center and never overflows the left viewport edge. */
    .message-bubble-row.other .quick-reactions,
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
      padding: 1px 7px;
      font-size: 11px;
      color: #f2f6ff;
      cursor: pointer;
      transition: all 0.2s;
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
  loading = false;
  myContactId: string | null = null;

  private conversationId: string | null = null;
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
    ]).subscribe(([convId, msgMap, chats, contacts, loading]) => {
      this.loading = loading;
      this.visibleContacts = contacts || [];

      if (convId && convId !== this.conversationId) {
        this.conversationId = convId;
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
    if (this.conversationId) {
      this.store.openGroupSettings(this.conversationId, this.conversationName);
    }
  }

  onSendMessage(content: string): void {
    this.store.sendMessage(this.conversationId, content);
    this.shouldScrollToBottom = true;
  }

  onSendWithFiles(payload: MessagePayload): void {
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
                is_read: true,
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
    if (!this.dragHasFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    this.threadDragDepth++;
    this.threadDragOver = true;
  }

  onThreadDragOver(event: DragEvent): void {
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

  private getFilenameLike(msg: Message): string {
    const anyMsg = msg as any;
    return String(
      this.getPrimaryAttachment(msg)?.filename ||
      anyMsg?.filename ||
      anyMsg?.file_name ||
      msg.content ||
      ''
    ).toLowerCase();
  }

  /** Returns the primary attachment for a message, if any. */
  private getPrimaryAttachment(msg: Message): Attachment | null {
    if (msg.attachments && msg.attachments.length > 0) return msg.attachments[0];

    // Some API responses provide file metadata in alternate fields.
    const anyMsg = msg as any;
    const mu = String(msg.media_url || '').trim();
    const mediaIsDirectUrl =
      mu.startsWith('http://') || mu.startsWith('https://') || mu.startsWith('data:');
    const fileId =
      anyMsg?.file_id ||
      anyMsg?.attachment_id ||
      anyMsg?.attachment_ids?.[0] ||
      (!mediaIsDirectUrl && mu ? mu : undefined);
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

  isImageAttachment(msg: Message): boolean {
    if (msg.message_type === 'IMAGE') return true;
    const mime = this.getPrimaryAttachment(msg)?.mime_type || '';
    if (mime.startsWith('image/')) return true;
    const name = this.getFilenameLike(msg);
    return /\.(png|jpe?g|gif|webp|bmp|svg|heic|heif)$/i.test(name);
  }

  /** Returns the cached data URL for a message's media, or null and triggers background load. */
  getMediaUrl(msg: Message): string | null {
    const att = this.getPrimaryAttachment(msg);
    const fileId = att?.file_id?.trim();

    const directUrl =
      att?.url ||
      msg.media_url ||
      (msg as any)?.url ||
      (msg as any)?.file_url;
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

    // Not yet cached — kick off a background fetch
    this.fetchMedia(fileId);
    return null;
  }

  private prewarmMedia(messages: Message[]): void {
    for (const msg of messages) {
      const att = this.getPrimaryAttachment(msg);
      const fileId = att?.file_id?.trim();
      if (!fileId || fileId.startsWith('temp-')) continue;
      if (this.fileService.getCachedDataUrl(fileId)) continue;
      // Preload images and videos eagerly; queue other files so download links appear.
      this.fetchMedia(fileId);
    }
  }

  private fetchMedia(fileId: string): void {
    if (!fileId || fileId.startsWith('temp-') || this.mediaLoading.has(fileId)) return;
    this.mediaFailed.delete(fileId);
    this.mediaLoading.add(fileId);

    this.fileService.getFileDataUrl(fileId).subscribe({
      next: () => {
        this.mediaLoading.delete(fileId);
        this.cdr.markForCheck();
      },
      error: () => {
        this.mediaLoading.delete(fileId);
        this.mediaFailed.add(fileId);
        this.cdr.markForCheck();
      },
    });
  }

  shouldShowMediaSpinner(msg: Message): boolean {
    const fileId = this.getPrimaryAttachment(msg)?.file_id;
    if (!fileId || fileId.startsWith('temp-')) return false;
    return this.mediaLoading.has(fileId) && !this.mediaFailed.has(fileId);
  }

  isVideoAttachment(msg: Message): boolean {
    const mime = this.getPrimaryAttachment(msg)?.mime_type || '';
    if (mime.startsWith('video/')) return true;
    const name = this.getFilenameLike(msg);
    return /\.(mp4|webm|mov|m4v|avi|mkv)$/i.test(name);
  }

  getAttachmentMimeType(msg: Message): string {
    return this.getPrimaryAttachment(msg)?.mime_type || 'application/octet-stream';
  }

  getAttachmentName(msg: Message): string {
    return this.getPrimaryAttachment(msg)?.filename || msg.content || 'File';
  }

  hasFileAttachment(msg: Message): boolean {
    return msg.message_type === 'FILE' || !!this.getPrimaryAttachment(msg);
  }

  hasMediaFailed(msg: Message): boolean {
    const fileId = this.getPrimaryAttachment(msg)?.file_id;
    return !!fileId && this.mediaFailed.has(fileId);
  }

  getFileIcon(msg: Message): string {
    const mime = this.getAttachmentMimeType(msg);
    const name = this.getAttachmentName(msg).toLowerCase();
    if (mime.startsWith('video/') || /\.(mp4|webm|mov|m4v|avi|mkv)$/i.test(name)) return 'videocam';
    if (mime.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|flac)$/i.test(name)) return 'audiotrack';
    if (mime.includes('pdf') || name.endsWith('.pdf')) return 'picture_as_pdf';
    if (mime.includes('spreadsheet') || mime.includes('excel') || /\.(xls|xlsx|csv)$/i.test(name)) return 'table_chart';
    if (mime.includes('document') || mime.includes('word') || /\.(doc|docx|txt|rtf)$/i.test(name)) return 'description';
    if (mime.includes('zip') || /\.(zip|rar|7z|tar|gz)$/i.test(name)) return 'folder_zip';
    return 'insert_drive_file';
  }

  openLightbox(dataUrl: string): void {
    this.lightboxOpen.emit(dataUrl);
  }

  // ── Reactions ────────────────────────────────────────────────────────────

  onEmojiSelected(emoji: string, messageId: string): void {
    this.store.addReaction(messageId, emoji);
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
