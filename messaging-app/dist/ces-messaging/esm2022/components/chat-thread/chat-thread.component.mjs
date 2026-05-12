import { Component, ViewChild, } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { combineLatest } from 'rxjs';
import { getContactDisplayName, getMessageSenderName } from '../../models/messaging.models';
import { MessageInputComponent } from '../message-input/message-input.component';
import * as i0 from "@angular/core";
import * as i1 from "../../services/messaging-store.service";
import * as i2 from "../../services/auth.service";
import * as i3 from "../../services/messaging-file.service";
import * as i4 from "@angular/common";
import * as i5 from "@angular/material/icon";
import * as i6 from "@angular/material/button";
import * as i7 from "@angular/material/progress-spinner";
import * as i8 from "@angular/material/tooltip";
export class ChatThreadComponent {
    store;
    auth;
    fileService;
    cdr;
    scrollContainer;
    messages = [];
    visibleContacts = [];
    conversationName = '';
    isGroup = false;
    loading = false;
    myContactId = null;
    conversationId = null;
    sub;
    shouldScrollToBottom = true;
    uploading = false;
    hoveredMessageId = null;
    quickEmojis = ['❤️', '👍', '😂', '😮', '😢', '🔥'];
    /** Lightbox: currently displayed full-size data URL */
    lightboxUrl = null;
    /** When true the lightbox is a draggable floating window instead of full-screen */
    lightboxDetached = false;
    lightboxX = 100;
    lightboxY = 80;
    lightboxW = 480;
    lightboxH = 400;
    // lightbox drag state
    lbDragging = false;
    lbDragOffX = 0;
    lbDragOffY = 0;
    boundLbMove = this.onLightboxDragMove.bind(this);
    boundLbEnd = this.onLightboxDragEnd.bind(this);
    // lightbox resize state
    lbResizing = false;
    lbResizeStartX = 0;
    lbResizeStartY = 0;
    lbResizeStartW = 0;
    lbResizeStartH = 0;
    boundLbResizeMove = this.onLightboxResizeMove.bind(this);
    boundLbResizeEnd = this.onLightboxResizeEnd.bind(this);
    /** Tracks which file IDs are currently being fetched to avoid duplicate requests */
    mediaLoading = new Set();
    /** Tracks file IDs where retrieval failed so UI doesn't spin forever. */
    mediaFailed = new Set();
    constructor(store, auth, fileService, cdr) {
        this.store = store;
        this.auth = auth;
        this.fileService = fileService;
        this.cdr = cdr;
    }
    ngOnInit() {
        this.myContactId = this.auth.contactId;
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
    ngAfterViewChecked() {
        if (this.shouldScrollToBottom) {
            this.scrollToBottom();
            this.shouldScrollToBottom = false;
        }
    }
    ngOnDestroy() {
        this.sub?.unsubscribe();
        document.removeEventListener('mousemove', this.boundLbMove);
        document.removeEventListener('mouseup', this.boundLbEnd);
        document.removeEventListener('mousemove', this.boundLbResizeMove);
        document.removeEventListener('mouseup', this.boundLbResizeEnd);
    }
    goBack() {
        this.store.setView('inbox');
    }
    onClearConversation() {
        if (this.conversationId) {
            this.store.clearConversation(this.conversationId);
        }
    }
    onDeleteConversation() {
        if (this.conversationId) {
            this.store.deleteConversation(this.conversationId);
        }
    }
    onGroupSettings() {
        if (this.conversationId) {
            this.store.openGroupSettings(this.conversationId, this.conversationName);
        }
    }
    onSendMessage(content) {
        this.store.sendMessage(this.conversationId, content);
        this.shouldScrollToBottom = true;
    }
    onSendWithFiles(payload) {
        if (!this.conversationId || !this.auth.contactId)
            return;
        this.uploading = true;
        // Step 1: Upload all files and obtain real file_ids from the server.
        // Temp IDs are NEVER sent to any API — we wait for real IDs here.
        this.fileService.uploadFiles(payload.files).subscribe({
            next: (responses) => {
                const fileIds = responses.map((r) => r.file_id);
                const filenames = responses.map((r) => r.filename);
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
                    .sendMessageWithAttachments(this.conversationId, this.auth.contactId, payload.text || filenames.join(', '), fileIds, filenames)
                    .subscribe({
                    next: (res) => {
                        this.uploading = false;
                        this.shouldScrollToBottom = true;
                        // Add optimistic message so the image appears instantly —
                        // the WebSocket event may arrive a moment later and dedup it.
                        const firstId = fileIds[0] || '';
                        const isImg = /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(filenames[0] || '');
                        const optimistic = {
                            message_id: res?.message_id ? String(res.message_id) : 'temp-' + Date.now(),
                            conversation_id: this.conversationId,
                            sender_id: this.auth.contactId,
                            sender_name: 'You',
                            message_type: isImg ? 'IMAGE' : 'FILE',
                            content: payload.text || filenames.join(', '),
                            media_url: firstId,
                            created_at: new Date().toISOString(),
                            is_read: true,
                            attachments: fileIds.map((id, idx) => ({
                                file_id: id,
                                filename: filenames[idx] || filenames[0] || `Attachment ${idx + 1}`,
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
    loadOlder() {
        if (this.conversationId && this.messages.length > 0) {
            this.store.loadMessages(this.conversationId, this.messages[0].message_id);
        }
    }
    onScroll() { }
    shouldShowDateSeparator(index) {
        if (index === 0)
            return true;
        const curr = new Date(this.messages[index].created_at).toDateString();
        const prev = new Date(this.messages[index - 1].created_at).toDateString();
        return curr !== prev;
    }
    shouldShowSender(index) {
        if (index === 0)
            return true;
        return this.messages[index].sender_id !== this.messages[index - 1].sender_id;
    }
    isOwnMessage(msg) {
        return String(msg.sender_id) === String(this.myContactId);
    }
    getSenderName(msg) {
        const fromMessage = getMessageSenderName(msg);
        if (fromMessage && fromMessage !== 'Unknown') {
            return fromMessage;
        }
        const fromContacts = this.visibleContacts.find((c) => String(c.contact_id) === String(msg.sender_id));
        if (fromContacts) {
            return getContactDisplayName(fromContacts);
        }
        if (this.isOwnMessage(msg)) {
            return 'You';
        }
        return `User ${msg.sender_id}`;
    }
    formatTime(dateStr) {
        if (!dateStr)
            return '';
        const d = new Date(dateStr);
        return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    }
    formatDate(dateStr) {
        const d = new Date(dateStr);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        if (d.toDateString() === today.toDateString())
            return 'Today';
        if (d.toDateString() === yesterday.toDateString())
            return 'Yesterday';
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    scrollToBottom() {
        try {
            const el = this.scrollContainer?.nativeElement;
            if (el) {
                el.scrollTop = el.scrollHeight;
            }
        }
        catch { /* ignore */ }
    }
    // ── Media helpers ────────────────────────────────────────────────────────
    getFilenameLike(msg) {
        const anyMsg = msg;
        return String(this.getPrimaryAttachment(msg)?.filename ||
            anyMsg?.filename ||
            anyMsg?.file_name ||
            msg.content ||
            '').toLowerCase();
    }
    /** Returns the primary attachment for a message, if any. */
    getPrimaryAttachment(msg) {
        if (msg.attachments && msg.attachments.length > 0)
            return msg.attachments[0];
        // Some API responses provide file metadata in alternate fields.
        const anyMsg = msg;
        const mu = String(msg.media_url || '').trim();
        const mediaIsDirectUrl = mu.startsWith('http://') || mu.startsWith('https://') || mu.startsWith('data:');
        const fileId = anyMsg?.file_id ||
            anyMsg?.attachment_id ||
            anyMsg?.attachment_ids?.[0] ||
            (!mediaIsDirectUrl && mu ? mu : undefined);
        const filename = anyMsg?.filename || anyMsg?.file_name || msg.content;
        const mime = anyMsg?.mime_type || anyMsg?.attachment_mime_type;
        if (fileId || filename || mime) {
            return {
                file_id: String(fileId || ''),
                filename: String(filename || 'File'),
                mime_type: mime ? String(mime) : undefined,
                url: mediaIsDirectUrl ? mu : undefined,
            };
        }
        return null;
    }
    isImageAttachment(msg) {
        if (msg.message_type === 'IMAGE')
            return true;
        const mime = this.getPrimaryAttachment(msg)?.mime_type || '';
        if (mime.startsWith('image/'))
            return true;
        const name = this.getFilenameLike(msg);
        return /\.(png|jpe?g|gif|webp|bmp|svg|heic|heif)$/i.test(name);
    }
    /** Returns the cached data URL for a message's media, or null and triggers background load. */
    getMediaUrl(msg) {
        const att = this.getPrimaryAttachment(msg);
        const fileId = att?.file_id?.trim();
        const directUrl = att?.url ||
            msg.media_url ||
            msg?.url ||
            msg?.file_url;
        if (directUrl &&
            (directUrl.startsWith('http://') ||
                directUrl.startsWith('https://') ||
                directUrl.startsWith('data:'))) {
            return directUrl;
        }
        if (!fileId) {
            return null;
        }
        const cached = this.fileService.getCachedDataUrl(fileId);
        if (cached)
            return cached;
        // Not yet cached — kick off a background fetch
        this.fetchMedia(fileId);
        return null;
    }
    prewarmMedia(messages) {
        for (const msg of messages) {
            if (!this.isImageAttachment(msg) && !this.isVideoAttachment(msg))
                continue;
            const fileId = this.getPrimaryAttachment(msg)?.file_id?.trim();
            if (fileId && !fileId.startsWith('temp-') && !this.fileService.getCachedDataUrl(fileId)) {
                this.fetchMedia(fileId);
            }
        }
    }
    fetchMedia(fileId) {
        if (!fileId || fileId.startsWith('temp-') || this.mediaLoading.has(fileId))
            return;
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
    shouldShowMediaSpinner(msg) {
        const fileId = this.getPrimaryAttachment(msg)?.file_id;
        if (!fileId || fileId.startsWith('temp-'))
            return false;
        return this.mediaLoading.has(fileId) && !this.mediaFailed.has(fileId);
    }
    isVideoAttachment(msg) {
        const mime = this.getPrimaryAttachment(msg)?.mime_type || '';
        if (mime.startsWith('video/'))
            return true;
        const name = this.getFilenameLike(msg);
        return /\.(mp4|webm|mov|m4v|avi|mkv)$/i.test(name);
    }
    getAttachmentMimeType(msg) {
        return this.getPrimaryAttachment(msg)?.mime_type || 'application/octet-stream';
    }
    getAttachmentName(msg) {
        return this.getPrimaryAttachment(msg)?.filename || msg.content || 'File';
    }
    openLightbox(dataUrl) {
        this.lightboxUrl = dataUrl;
        this.lightboxDetached = false;
    }
    /** Fullscreen mode: only close when the dimmed backdrop is clicked, not after toolbar actions. */
    onLightboxBackdropClick(event) {
        if (this.lightboxDetached)
            return;
        if (event.target !== event.currentTarget)
            return;
        this.lightboxUrl = null;
    }
    expandLightbox() {
        this.lightboxDetached = false;
        this.cdr.markForCheck();
    }
    closeLightbox() {
        this.lightboxUrl = null;
        this.lightboxDetached = false;
    }
    detachLightbox() {
        this.lightboxDetached = true;
        this.lightboxX = Math.max(20, Math.round((window.innerWidth - this.lightboxW) / 2));
        this.lightboxY = Math.max(20, Math.round((window.innerHeight - this.lightboxH) / 2));
    }
    onLightboxDragStart(event) {
        if (event.target.closest('button'))
            return;
        event.preventDefault();
        this.lbDragging = true;
        this.lbDragOffX = event.clientX - this.lightboxX;
        this.lbDragOffY = event.clientY - this.lightboxY;
        document.body.style.userSelect = 'none';
        document.addEventListener('mousemove', this.boundLbMove);
        document.addEventListener('mouseup', this.boundLbEnd);
    }
    onLightboxDragMove(event) {
        if (!this.lbDragging)
            return;
        this.lightboxX = Math.max(0, Math.min(event.clientX - this.lbDragOffX, window.innerWidth - this.lightboxW));
        this.lightboxY = Math.max(0, Math.min(event.clientY - this.lbDragOffY, window.innerHeight - 60));
        this.cdr.markForCheck();
    }
    onLightboxDragEnd() {
        if (!this.lbDragging)
            return;
        this.lbDragging = false;
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', this.boundLbMove);
        document.removeEventListener('mouseup', this.boundLbEnd);
    }
    onLightboxResizeStart(event) {
        event.preventDefault();
        event.stopPropagation();
        this.lbResizing = true;
        this.lbResizeStartX = event.clientX;
        this.lbResizeStartY = event.clientY;
        this.lbResizeStartW = this.lightboxW;
        this.lbResizeStartH = this.lightboxH;
        document.body.style.cursor = 'se-resize';
        document.body.style.userSelect = 'none';
        document.addEventListener('mousemove', this.boundLbResizeMove);
        document.addEventListener('mouseup', this.boundLbResizeEnd);
    }
    onLightboxResizeMove(event) {
        if (!this.lbResizing)
            return;
        this.lightboxW = Math.max(200, this.lbResizeStartW + (event.clientX - this.lbResizeStartX));
        this.lightboxH = Math.max(180, this.lbResizeStartH + (event.clientY - this.lbResizeStartY));
        this.cdr.markForCheck();
    }
    onLightboxResizeEnd() {
        if (!this.lbResizing)
            return;
        this.lbResizing = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', this.boundLbResizeMove);
        document.removeEventListener('mouseup', this.boundLbResizeEnd);
    }
    // ── Reactions ────────────────────────────────────────────────────────────
    onEmojiSelected(emoji, messageId) {
        this.store.addReaction(messageId, emoji);
    }
    toggleReaction(emoji, messageId) {
        const msg = this.messages.find(m => m.message_id === messageId);
        if (!msg)
            return;
        const reaction = msg.reactions?.find(r => r.emoji === emoji);
        if (reaction?.hasReacted) {
            this.store.removeReaction(messageId, emoji);
        }
        else {
            this.store.addReaction(messageId, emoji);
        }
    }
    getReactorTooltip(reaction) {
        if (!reaction?.reactors?.length)
            return '';
        return reaction.reactors.join(', ');
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: ChatThreadComponent, deps: [{ token: i1.MessagingStoreService }, { token: i2.AuthService }, { token: i3.MessagingFileService }, { token: i0.ChangeDetectorRef }], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "17.3.12", type: ChatThreadComponent, isStandalone: true, selector: "app-chat-thread", viewQueries: [{ propertyName: "scrollContainer", first: true, predicate: ["scrollContainer"], descendants: true }], ngImport: i0, template: `
    <div class="chat-thread">
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
                <div *ngIf="msg.message_type === 'FILE' && !isImageAttachment(msg)" class="file-message">
                  <ng-container *ngIf="isVideoAttachment(msg); else regularFile">
                    <ng-container *ngIf="getMediaUrl(msg) as videoUrl; else videoLoading">
                      <video controls class="media-video" preload="metadata">
                        <source [src]="videoUrl" [type]="getAttachmentMimeType(msg)" />
                        Your browser does not support video.
                      </video>
                    </ng-container>
                    <ng-template #videoLoading>
                      <div class="media-placeholder">
                        <mat-spinner diameter="22"></mat-spinner>
                        <span class="media-load-label">Loading video…</span>
                      </div>
                    </ng-template>
                  </ng-container>
                  <ng-template #regularFile>
                    <mat-icon class="file-msg-icon">insert_drive_file</mat-icon>
                    <span class="file-msg-name">{{ getAttachmentName(msg) }}</span>
                  </ng-template>
                </div>
                <div
                  *ngIf="msg.message_type === 'TEXT' && !isImageAttachment(msg)"
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

    <!-- Image viewer: fullscreen overlay OR detached floating window -->
    <div
      *ngIf="lightboxUrl"
      class="lightbox-overlay"
      [class.lightbox-detached]="lightboxDetached"
      [style.left.px]="lightboxDetached ? lightboxX : null"
      [style.top.px]="lightboxDetached ? lightboxY : null"
      [style.width.px]="lightboxDetached ? lightboxW : null"
      [style.height.px]="lightboxDetached ? lightboxH : null"
      (click)="onLightboxBackdropClick($event)"
    >
      <!-- Drag handle bar (visible in detached mode) -->
      <div
        *ngIf="lightboxDetached"
        class="lightbox-drag-bar"
        (mousedown)="onLightboxDragStart($event)"
      >
        <span class="lightbox-drag-title">Image viewer</span>
        <div class="lightbox-drag-actions">
          <button
            type="button"
            class="lightbox-action-btn"
            (click)="$event.stopPropagation(); expandLightbox()"
            title="Expand to fullscreen"
          >
            <mat-icon>fullscreen</mat-icon>
          </button>
          <button
            type="button"
            class="lightbox-action-btn"
            (click)="$event.stopPropagation(); closeLightbox()"
            title="Close"
          >
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>

      <img
        [src]="lightboxUrl"
        class="lightbox-img"
        [class.lightbox-img-detached]="lightboxDetached"
        (click)="$event.stopPropagation()"
      />

      <!-- Controls shown in fullscreen mode -->
      <ng-container *ngIf="!lightboxDetached">
        <button class="lightbox-close" (click)="lightboxUrl = null">
          <mat-icon>close</mat-icon>
        </button>
        <button class="lightbox-detach-btn" (click)="detachLightbox()" title="Detach to floating window">
          <mat-icon>picture_in_picture</mat-icon>
        </button>
      </ng-container>

      <!-- Resize corner (detached mode) -->
      <div *ngIf="lightboxDetached" class="lightbox-resize-corner" (mousedown)="onLightboxResizeStart($event)"></div>
    </div>
  `, isInline: true, styles: [".chat-thread{display:flex;flex-direction:column;height:100%;background:#041322}.chat-header{display:flex;align-items:center;padding:8px 8px 8px 4px;border-bottom:1px solid rgba(255,255,255,.15);gap:4px;flex-shrink:0}.chat-header button mat-icon{color:#fffc}.chat-name{font-size:16px;font-weight:600;color:#fff}.header-info{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;padding:0 4px}.header-actions{display:flex;gap:0}.header-actions button{width:32px;height:32px}.hdr-btn{border-radius:6px!important;transition:background .15s,box-shadow .15s}.hdr-btn:hover{background:#ffffff26!important;box-shadow:0 2px 8px #0003}.messages-area{flex:1;overflow-y:auto;padding:12px;background:transparent;scrollbar-width:none;-ms-overflow-style:none}.messages-area::-webkit-scrollbar{display:none}.loading-indicator{display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;color:#ffffffb3;font-size:13px}.load-more-btn{align-self:center;margin-bottom:16px;font-size:12px;color:#fff}.messages-list{display:flex;flex-direction:column;gap:1px;flex:1}.date-separator{text-align:center;margin:16px 0 8px;font-size:12px;color:#ffffffb3;font-weight:500}.message-bubble-row{display:flex;flex-direction:column;max-width:88%;margin-bottom:2px}.message-bubble-row.own{align-self:flex-end;align-items:flex-end}.message-bubble-row.other{align-self:flex-start;align-items:flex-start}.sender-name{font-size:11px;font-weight:700;color:#fffffff2;margin-bottom:3px;letter-spacing:.2px;padding:0 10px;text-shadow:0 1px 3px rgba(0,0,0,.4)}.message-bubble{padding:8px 14px 7px;border-radius:14px;font-size:13px;line-height:1.32;word-break:break-word;color:#f5f7ff;position:relative;display:inline-block;min-width:fit-content}.message-bubble-row.other .message-bubble{background:#0d2540;border-bottom-left-radius:5px;box-shadow:0 1px 4px #0006}.message-bubble.own-bubble{background:#0a3d62;border-bottom-right-radius:5px;box-shadow:0 1px 4px #0006}.image-message{line-height:0}.media-img{max-width:220px;max-height:280px;border-radius:10px;display:block;cursor:zoom-in;object-fit:cover;transition:opacity .15s}.media-img:hover{opacity:.88}.media-video{max-width:240px;border-radius:10px;display:block;background:#000}.media-placeholder{display:flex;align-items:center;gap:8px;min-width:80px;min-height:44px;color:#fff9;font-size:11px}.media-load-label{font-size:11px;color:#fff9}.file-message{display:flex;align-items:center;gap:8px;padding:4px 0}.file-msg-icon{font-size:20px;width:20px;height:20px;color:#fffc}.file-msg-name{font-size:13px;color:#fff;word-break:break-all}.lightbox-overlay{position:fixed;inset:0;background:#000000e0;display:flex;align-items:center;justify-content:center;z-index:99999;cursor:pointer}.lightbox-overlay.lightbox-detached{inset:unset;background:#0c1f35;border:1px solid rgba(255,255,255,.18);border-radius:12px;box-shadow:0 12px 48px #000000b3;display:flex;flex-direction:column;overflow:hidden;cursor:default;min-width:200px;min-height:180px}.lightbox-drag-bar{display:flex;align-items:center;justify-content:space-between;padding:6px 8px 6px 12px;background:#041322;border-bottom:1px solid rgba(255,255,255,.12);cursor:grab;flex-shrink:0;-webkit-user-select:none;user-select:none}.lightbox-drag-bar:active{cursor:grabbing}.lightbox-drag-title{font-size:12px;color:#fff9;letter-spacing:.4px}.lightbox-drag-actions{display:flex;gap:2px}.lightbox-action-btn{background:transparent;border:none;border-radius:6px;width:28px;height:28px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#ffffffb3;transition:background .15s}.lightbox-action-btn:hover{background:#ffffff26}.lightbox-action-btn mat-icon{font-size:16px;width:16px;height:16px}.lightbox-img{max-width:92vw;max-height:92vh;border-radius:8px;box-shadow:0 8px 40px #0009;cursor:default}.lightbox-img.lightbox-img-detached{max-width:100%;max-height:100%;border-radius:0;box-shadow:none;object-fit:contain;flex:1}.lightbox-close{position:absolute;top:16px;right:16px;background:#ffffff26;border:none;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#fff;transition:background .15s}.lightbox-close:hover{background:#ffffff4d}.lightbox-detach-btn{position:absolute;top:16px;right:60px;background:#ffffff26;border:none;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#fff;transition:background .15s}.lightbox-detach-btn:hover{background:#ffffff4d}.lightbox-resize-corner{position:absolute;bottom:0;right:0;width:16px;height:16px;cursor:se-resize;background:linear-gradient(135deg,transparent 50%,rgba(255,255,255,.2) 50%);border-bottom-right-radius:12px}.message-meta{display:flex;align-items:center;gap:4px;margin-top:3px}.msg-time{font-size:10px;color:#dae0faa8}.message-bubble-row.other .msg-time{color:#d8dff694}.read-icon{font-size:14px;width:14px;height:14px;opacity:.7}.read-icon.unread{opacity:.4}.quick-reactions{position:absolute;top:-18px;right:0;display:flex;align-items:center;gap:4px;padding:3px 5px;background:#071d30;border:1px solid rgba(255,255,255,.14);border-radius:999px;box-shadow:0 6px 14px #00000047;z-index:4}.quick-emoji-btn{width:20px;height:20px;border:none;border-radius:999px;background:transparent;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:13px;line-height:1;cursor:pointer;padding:0;transition:transform .12s ease,background .12s ease}.quick-emoji-btn:hover{background:#ffffff2e;transform:scale(1.14)}.reactions-row{display:flex;flex-wrap:wrap;gap:3px;margin-top:5px}.reaction-chip{background:#ffffff14;border:1px solid rgba(255,255,255,.2);border-radius:999px;padding:1px 7px;font-size:11px;color:#f2f6ff;cursor:pointer;transition:all .2s}.reaction-chip:hover{background:#ffffff40;transform:scale(1.05)}.reaction-chip.own-reaction{background:#2a5bff4d;border-color:#2a5bff80}.empty-chat{display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;color:#9ca3af}.empty-chat mat-icon{font-size:48px;width:48px;height:48px;margin-bottom:8px}.empty-chat p{font-size:14px;margin:0}\n"], dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i4.NgForOf, selector: "[ngFor][ngForOf]", inputs: ["ngForOf", "ngForTrackBy", "ngForTemplate"] }, { kind: "directive", type: i4.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "ngmodule", type: MatIconModule }, { kind: "component", type: i5.MatIcon, selector: "mat-icon", inputs: ["color", "inline", "svgIcon", "fontSet", "fontIcon"], exportAs: ["matIcon"] }, { kind: "ngmodule", type: MatButtonModule }, { kind: "component", type: i6.MatButton, selector: "    button[mat-button], button[mat-raised-button], button[mat-flat-button],    button[mat-stroked-button]  ", exportAs: ["matButton"] }, { kind: "component", type: i6.MatIconButton, selector: "button[mat-icon-button]", exportAs: ["matButton"] }, { kind: "ngmodule", type: MatProgressSpinnerModule }, { kind: "component", type: i7.MatProgressSpinner, selector: "mat-progress-spinner, mat-spinner", inputs: ["color", "mode", "value", "diameter", "strokeWidth"], exportAs: ["matProgressSpinner"] }, { kind: "ngmodule", type: MatTooltipModule }, { kind: "directive", type: i8.MatTooltip, selector: "[matTooltip]", inputs: ["matTooltipPosition", "matTooltipPositionAtOrigin", "matTooltipDisabled", "matTooltipShowDelay", "matTooltipHideDelay", "matTooltipTouchGestures", "matTooltip", "matTooltipClass"], exportAs: ["matTooltip"] }, { kind: "component", type: MessageInputComponent, selector: "app-message-input", outputs: ["messageSent", "messageWithFiles"] }] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: ChatThreadComponent, decorators: [{
            type: Component,
            args: [{ selector: 'app-chat-thread', standalone: true, imports: [
                        CommonModule, MatIconModule, MatButtonModule,
                        MatProgressSpinnerModule, MatTooltipModule, MessageInputComponent,
                    ], template: `
    <div class="chat-thread">
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
                <div *ngIf="msg.message_type === 'FILE' && !isImageAttachment(msg)" class="file-message">
                  <ng-container *ngIf="isVideoAttachment(msg); else regularFile">
                    <ng-container *ngIf="getMediaUrl(msg) as videoUrl; else videoLoading">
                      <video controls class="media-video" preload="metadata">
                        <source [src]="videoUrl" [type]="getAttachmentMimeType(msg)" />
                        Your browser does not support video.
                      </video>
                    </ng-container>
                    <ng-template #videoLoading>
                      <div class="media-placeholder">
                        <mat-spinner diameter="22"></mat-spinner>
                        <span class="media-load-label">Loading video…</span>
                      </div>
                    </ng-template>
                  </ng-container>
                  <ng-template #regularFile>
                    <mat-icon class="file-msg-icon">insert_drive_file</mat-icon>
                    <span class="file-msg-name">{{ getAttachmentName(msg) }}</span>
                  </ng-template>
                </div>
                <div
                  *ngIf="msg.message_type === 'TEXT' && !isImageAttachment(msg)"
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

    <!-- Image viewer: fullscreen overlay OR detached floating window -->
    <div
      *ngIf="lightboxUrl"
      class="lightbox-overlay"
      [class.lightbox-detached]="lightboxDetached"
      [style.left.px]="lightboxDetached ? lightboxX : null"
      [style.top.px]="lightboxDetached ? lightboxY : null"
      [style.width.px]="lightboxDetached ? lightboxW : null"
      [style.height.px]="lightboxDetached ? lightboxH : null"
      (click)="onLightboxBackdropClick($event)"
    >
      <!-- Drag handle bar (visible in detached mode) -->
      <div
        *ngIf="lightboxDetached"
        class="lightbox-drag-bar"
        (mousedown)="onLightboxDragStart($event)"
      >
        <span class="lightbox-drag-title">Image viewer</span>
        <div class="lightbox-drag-actions">
          <button
            type="button"
            class="lightbox-action-btn"
            (click)="$event.stopPropagation(); expandLightbox()"
            title="Expand to fullscreen"
          >
            <mat-icon>fullscreen</mat-icon>
          </button>
          <button
            type="button"
            class="lightbox-action-btn"
            (click)="$event.stopPropagation(); closeLightbox()"
            title="Close"
          >
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>

      <img
        [src]="lightboxUrl"
        class="lightbox-img"
        [class.lightbox-img-detached]="lightboxDetached"
        (click)="$event.stopPropagation()"
      />

      <!-- Controls shown in fullscreen mode -->
      <ng-container *ngIf="!lightboxDetached">
        <button class="lightbox-close" (click)="lightboxUrl = null">
          <mat-icon>close</mat-icon>
        </button>
        <button class="lightbox-detach-btn" (click)="detachLightbox()" title="Detach to floating window">
          <mat-icon>picture_in_picture</mat-icon>
        </button>
      </ng-container>

      <!-- Resize corner (detached mode) -->
      <div *ngIf="lightboxDetached" class="lightbox-resize-corner" (mousedown)="onLightboxResizeStart($event)"></div>
    </div>
  `, styles: [".chat-thread{display:flex;flex-direction:column;height:100%;background:#041322}.chat-header{display:flex;align-items:center;padding:8px 8px 8px 4px;border-bottom:1px solid rgba(255,255,255,.15);gap:4px;flex-shrink:0}.chat-header button mat-icon{color:#fffc}.chat-name{font-size:16px;font-weight:600;color:#fff}.header-info{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;padding:0 4px}.header-actions{display:flex;gap:0}.header-actions button{width:32px;height:32px}.hdr-btn{border-radius:6px!important;transition:background .15s,box-shadow .15s}.hdr-btn:hover{background:#ffffff26!important;box-shadow:0 2px 8px #0003}.messages-area{flex:1;overflow-y:auto;padding:12px;background:transparent;scrollbar-width:none;-ms-overflow-style:none}.messages-area::-webkit-scrollbar{display:none}.loading-indicator{display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;color:#ffffffb3;font-size:13px}.load-more-btn{align-self:center;margin-bottom:16px;font-size:12px;color:#fff}.messages-list{display:flex;flex-direction:column;gap:1px;flex:1}.date-separator{text-align:center;margin:16px 0 8px;font-size:12px;color:#ffffffb3;font-weight:500}.message-bubble-row{display:flex;flex-direction:column;max-width:88%;margin-bottom:2px}.message-bubble-row.own{align-self:flex-end;align-items:flex-end}.message-bubble-row.other{align-self:flex-start;align-items:flex-start}.sender-name{font-size:11px;font-weight:700;color:#fffffff2;margin-bottom:3px;letter-spacing:.2px;padding:0 10px;text-shadow:0 1px 3px rgba(0,0,0,.4)}.message-bubble{padding:8px 14px 7px;border-radius:14px;font-size:13px;line-height:1.32;word-break:break-word;color:#f5f7ff;position:relative;display:inline-block;min-width:fit-content}.message-bubble-row.other .message-bubble{background:#0d2540;border-bottom-left-radius:5px;box-shadow:0 1px 4px #0006}.message-bubble.own-bubble{background:#0a3d62;border-bottom-right-radius:5px;box-shadow:0 1px 4px #0006}.image-message{line-height:0}.media-img{max-width:220px;max-height:280px;border-radius:10px;display:block;cursor:zoom-in;object-fit:cover;transition:opacity .15s}.media-img:hover{opacity:.88}.media-video{max-width:240px;border-radius:10px;display:block;background:#000}.media-placeholder{display:flex;align-items:center;gap:8px;min-width:80px;min-height:44px;color:#fff9;font-size:11px}.media-load-label{font-size:11px;color:#fff9}.file-message{display:flex;align-items:center;gap:8px;padding:4px 0}.file-msg-icon{font-size:20px;width:20px;height:20px;color:#fffc}.file-msg-name{font-size:13px;color:#fff;word-break:break-all}.lightbox-overlay{position:fixed;inset:0;background:#000000e0;display:flex;align-items:center;justify-content:center;z-index:99999;cursor:pointer}.lightbox-overlay.lightbox-detached{inset:unset;background:#0c1f35;border:1px solid rgba(255,255,255,.18);border-radius:12px;box-shadow:0 12px 48px #000000b3;display:flex;flex-direction:column;overflow:hidden;cursor:default;min-width:200px;min-height:180px}.lightbox-drag-bar{display:flex;align-items:center;justify-content:space-between;padding:6px 8px 6px 12px;background:#041322;border-bottom:1px solid rgba(255,255,255,.12);cursor:grab;flex-shrink:0;-webkit-user-select:none;user-select:none}.lightbox-drag-bar:active{cursor:grabbing}.lightbox-drag-title{font-size:12px;color:#fff9;letter-spacing:.4px}.lightbox-drag-actions{display:flex;gap:2px}.lightbox-action-btn{background:transparent;border:none;border-radius:6px;width:28px;height:28px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#ffffffb3;transition:background .15s}.lightbox-action-btn:hover{background:#ffffff26}.lightbox-action-btn mat-icon{font-size:16px;width:16px;height:16px}.lightbox-img{max-width:92vw;max-height:92vh;border-radius:8px;box-shadow:0 8px 40px #0009;cursor:default}.lightbox-img.lightbox-img-detached{max-width:100%;max-height:100%;border-radius:0;box-shadow:none;object-fit:contain;flex:1}.lightbox-close{position:absolute;top:16px;right:16px;background:#ffffff26;border:none;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#fff;transition:background .15s}.lightbox-close:hover{background:#ffffff4d}.lightbox-detach-btn{position:absolute;top:16px;right:60px;background:#ffffff26;border:none;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#fff;transition:background .15s}.lightbox-detach-btn:hover{background:#ffffff4d}.lightbox-resize-corner{position:absolute;bottom:0;right:0;width:16px;height:16px;cursor:se-resize;background:linear-gradient(135deg,transparent 50%,rgba(255,255,255,.2) 50%);border-bottom-right-radius:12px}.message-meta{display:flex;align-items:center;gap:4px;margin-top:3px}.msg-time{font-size:10px;color:#dae0faa8}.message-bubble-row.other .msg-time{color:#d8dff694}.read-icon{font-size:14px;width:14px;height:14px;opacity:.7}.read-icon.unread{opacity:.4}.quick-reactions{position:absolute;top:-18px;right:0;display:flex;align-items:center;gap:4px;padding:3px 5px;background:#071d30;border:1px solid rgba(255,255,255,.14);border-radius:999px;box-shadow:0 6px 14px #00000047;z-index:4}.quick-emoji-btn{width:20px;height:20px;border:none;border-radius:999px;background:transparent;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:13px;line-height:1;cursor:pointer;padding:0;transition:transform .12s ease,background .12s ease}.quick-emoji-btn:hover{background:#ffffff2e;transform:scale(1.14)}.reactions-row{display:flex;flex-wrap:wrap;gap:3px;margin-top:5px}.reaction-chip{background:#ffffff14;border:1px solid rgba(255,255,255,.2);border-radius:999px;padding:1px 7px;font-size:11px;color:#f2f6ff;cursor:pointer;transition:all .2s}.reaction-chip:hover{background:#ffffff40;transform:scale(1.05)}.reaction-chip.own-reaction{background:#2a5bff4d;border-color:#2a5bff80}.empty-chat{display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;color:#9ca3af}.empty-chat mat-icon{font-size:48px;width:48px;height:48px;margin-bottom:8px}.empty-chat p{font-size:14px;margin:0}\n"] }]
        }], ctorParameters: () => [{ type: i1.MessagingStoreService }, { type: i2.AuthService }, { type: i3.MessagingFileService }, { type: i0.ChangeDetectorRef }], propDecorators: { scrollContainer: [{
                type: ViewChild,
                args: ['scrollContainer']
            }] } });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdC10aHJlYWQuY29tcG9uZW50LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL2xpYi9jb21wb25lbnRzL2NoYXQtdGhyZWFkL2NoYXQtdGhyZWFkLmNvbXBvbmVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQ0wsU0FBUyxFQUFxQixTQUFTLEdBQ3hDLE1BQU0sZUFBZSxDQUFDO0FBQ3ZCLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUMvQyxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sd0JBQXdCLENBQUM7QUFDdkQsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBQzNELE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQzlFLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBQzdELE9BQU8sRUFBZ0IsYUFBYSxFQUFFLE1BQU0sTUFBTSxDQUFDO0FBSW5ELE9BQU8sRUFBZ0MscUJBQXFCLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUMxSCxPQUFPLEVBQUUscUJBQXFCLEVBQWtCLE1BQU0sMENBQTBDLENBQUM7Ozs7Ozs7Ozs7QUFpcUJqRyxNQUFNLE9BQU8sbUJBQW1CO0lBZ0RwQjtJQUNBO0lBQ0E7SUFDQTtJQWxEb0IsZUFBZSxDQUFjO0lBRTNELFFBQVEsR0FBYyxFQUFFLENBQUM7SUFDekIsZUFBZSxHQUFjLEVBQUUsQ0FBQztJQUNoQyxnQkFBZ0IsR0FBRyxFQUFFLENBQUM7SUFDdEIsT0FBTyxHQUFHLEtBQUssQ0FBQztJQUNoQixPQUFPLEdBQUcsS0FBSyxDQUFDO0lBQ2hCLFdBQVcsR0FBa0IsSUFBSSxDQUFDO0lBRTFCLGNBQWMsR0FBa0IsSUFBSSxDQUFDO0lBQ3JDLEdBQUcsQ0FBZ0I7SUFDbkIsb0JBQW9CLEdBQUcsSUFBSSxDQUFDO0lBRXBDLFNB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Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7R0FvTVQscWtNQXZNQyxZQUFZLCtQQUFFLGFBQWEsbUxBQUUsZUFBZSx3VUFDNUMsd0JBQXdCLGtPQUFFLGdCQUFnQiw2VEFBRSxxQkFBcUI7OzRGQTBwQnhELG1CQUFtQjtrQkEvcEIvQixTQUFTOytCQUNFLGlCQUFpQixjQUNmLElBQUksV0FDUDt3QkFDUCxZQUFZLEVBQUUsYUFBYSxFQUFFLGVBQWU7d0JBQzVDLHdCQUF3QixFQUFFLGdCQUFnQixFQUFFLHFCQUFxQjtxQkFDbEUsWUFDUzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQW9NVDt1TEFxZDZCLGVBQWU7c0JBQTVDLFNBQVM7dUJBQUMsaUJBQWlCIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtcbiAgQ29tcG9uZW50LCBPbkluaXQsIE9uRGVzdHJveSwgVmlld0NoaWxkLCBFbGVtZW50UmVmLCBBZnRlclZpZXdDaGVja2VkLCBDaGFuZ2VEZXRlY3RvclJlZixcbn0gZnJvbSAnQGFuZ3VsYXIvY29yZSc7XG5pbXBvcnQgeyBDb21tb25Nb2R1bGUgfSBmcm9tICdAYW5ndWxhci9jb21tb24nO1xuaW1wb3J0IHsgTWF0SWNvbk1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL21hdGVyaWFsL2ljb24nO1xuaW1wb3J0IHsgTWF0QnV0dG9uTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvbWF0ZXJpYWwvYnV0dG9uJztcbmltcG9ydCB7IE1hdFByb2dyZXNzU3Bpbm5lck1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL21hdGVyaWFsL3Byb2dyZXNzLXNwaW5uZXInO1xuaW1wb3J0IHsgTWF0VG9vbHRpcE1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL21hdGVyaWFsL3Rvb2x0aXAnO1xuaW1wb3J0IHsgU3Vic2NyaXB0aW9uLCBjb21iaW5lTGF0ZXN0IH0gZnJvbSAncnhqcyc7XG5pbXBvcnQgeyBNZXNzYWdpbmdTdG9yZVNlcnZpY2UgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9tZXNzYWdpbmctc3RvcmUuc2VydmljZSc7XG5pbXBvcnQgeyBNZXNzYWdpbmdGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL21lc3NhZ2luZy1maWxlLnNlcnZpY2UnO1xuaW1wb3J0IHsgQXV0aFNlcnZpY2UgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9hdXRoLnNlcnZpY2UnO1xuaW1wb3J0IHsgQ29udGFjdCwgTWVzc2FnZSwgQXR0YWNobWVudCwgZ2V0Q29udGFjdERpc3BsYXlOYW1lLCBnZXRNZXNzYWdlU2VuZGVyTmFtZSB9IGZyb20gJy4uLy4uL21vZGVscy9tZXNzYWdpbmcubW9kZWxzJztcbmltcG9ydCB7IE1lc3NhZ2VJbnB1dENvbXBvbmVudCwgTWVzc2FnZVBheWxvYWQgfSBmcm9tICcuLi9tZXNzYWdlLWlucHV0L21lc3NhZ2UtaW5wdXQuY29tcG9uZW50JztcblxuQENvbXBvbmVudCh7XG4gIHNlbGVjdG9yOiAnYXBwLWNoYXQtdGhyZWFkJyxcbiAgc3RhbmRhbG9uZTogdHJ1ZSxcbiAgaW1wb3J0czogW1xuICAgIENvbW1vbk1vZHVsZSwgTWF0SWNvbk1vZHVsZSwgTWF0QnV0dG9uTW9kdWxlLFxuICAgIE1hdFByb2dyZXNzU3Bpbm5lck1vZHVsZSwgTWF0VG9vbHRpcE1vZHVsZSwgTWVzc2FnZUlucHV0Q29tcG9uZW50LFxuICBdLFxuICB0ZW1wbGF0ZTogYFxuICAgIDxkaXYgY2xhc3M9XCJjaGF0LXRocmVhZFwiPlxuICAgICAgPGRpdiBjbGFzcz1cImNoYXQtaGVhZGVyXCI+XG4gICAgICAgIDxidXR0b24gbWF0LWljb24tYnV0dG9uIGNsYXNzPVwiaGRyLWJ0blwiIChjbGljayk9XCJnb0JhY2soKVwiIG1hdFRvb2x0aXA9XCJCYWNrXCIgbWF0VG9vbHRpcFBvc2l0aW9uPVwiYmVsb3dcIj5cbiAgICAgICAgICA8bWF0LWljb24+YXJyb3dfYmFjazwvbWF0LWljb24+XG4gICAgICAgIDwvYnV0dG9uPlxuICAgICAgICA8ZGl2IGNsYXNzPVwiaGVhZGVyLWluZm9cIj5cbiAgICAgICAgICA8c3BhbiBjbGFzcz1cImNoYXQtbmFtZVwiPnt7IGNvbnZlcnNhdGlvbk5hbWUgfX08L3NwYW4+XG4gICAgICAgIDwvZGl2PlxuICAgICAgICA8ZGl2IGNsYXNzPVwiaGVhZGVyLWFjdGlvbnNcIj5cbiAgICAgICAgICA8YnV0dG9uICpuZ0lmPVwiaXNHcm91cFwiIG1hdC1pY29uLWJ1dHRvbiBjbGFzcz1cImhkci1idG5cIiAoY2xpY2spPVwib25Hcm91cFNldHRpbmdzKClcIiBtYXRUb29sdGlwPVwiR3JvdXAgc2V0dGluZ3NcIiBtYXRUb29sdGlwUG9zaXRpb249XCJiZWxvd1wiPlxuICAgICAgICAgICAgPG1hdC1pY29uPnNldHRpbmdzPC9tYXQtaWNvbj5cbiAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cblxuICAgICAgPGRpdiBjbGFzcz1cIm1lc3NhZ2VzLWFyZWFcIiAjc2Nyb2xsQ29udGFpbmVyIChzY3JvbGwpPVwib25TY3JvbGwoKVwiPlxuICAgICAgICA8ZGl2ICpuZ0lmPVwibG9hZGluZ1wiIGNsYXNzPVwibG9hZGluZy1pbmRpY2F0b3JcIj5cbiAgICAgICAgICA8bWF0LXNwaW5uZXIgZGlhbWV0ZXI9XCIyNFwiPjwvbWF0LXNwaW5uZXI+XG4gICAgICAgICAgPHNwYW4+TG9hZGluZyBtZXNzYWdlcy4uLjwvc3Bhbj5cbiAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICpuZ0lmPVwibWVzc2FnZXMubGVuZ3RoID49IDUwICYmICFsb2FkaW5nXCJcbiAgICAgICAgICBtYXQtc3Ryb2tlZC1idXR0b25cbiAgICAgICAgICBjbGFzcz1cImxvYWQtbW9yZS1idG5cIlxuICAgICAgICAgIChjbGljayk9XCJsb2FkT2xkZXIoKVwiXG4gICAgICAgID5cbiAgICAgICAgICBMb2FkIG9sZGVyIG1lc3NhZ2VzXG4gICAgICAgIDwvYnV0dG9uPlxuXG4gICAgICAgIDxkaXYgY2xhc3M9XCJtZXNzYWdlcy1saXN0XCI+XG4gICAgICAgICAgPG5nLWNvbnRhaW5lciAqbmdGb3I9XCJsZXQgbXNnIG9mIG1lc3NhZ2VzOyBsZXQgaSA9IGluZGV4XCI+XG4gICAgICAgICAgICA8ZGl2XG4gICAgICAgICAgICAgICpuZ0lmPVwic2hvdWxkU2hvd0RhdGVTZXBhcmF0b3IoaSlcIlxuICAgICAgICAgICAgICBjbGFzcz1cImRhdGUtc2VwYXJhdG9yXCJcbiAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgPHNwYW4+e3sgZm9ybWF0RGF0ZShtc2cuY3JlYXRlZF9hdCkgfX08L3NwYW4+XG4gICAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgICAgPGRpdlxuICAgICAgICAgICAgICBjbGFzcz1cIm1lc3NhZ2UtYnViYmxlLXJvd1wiXG4gICAgICAgICAgICAgIFtjbGFzcy5vd25dPVwiaXNPd25NZXNzYWdlKG1zZylcIlxuICAgICAgICAgICAgICBbY2xhc3Mub3RoZXJdPVwiIWlzT3duTWVzc2FnZShtc2cpXCJcbiAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgPGRpdiAqbmdJZj1cIiFpc093bk1lc3NhZ2UobXNnKVwiIGNsYXNzPVwic2VuZGVyLW5hbWVcIj5cbiAgICAgICAgICAgICAgICB7eyBnZXRTZW5kZXJOYW1lKG1zZykgfX1cbiAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJtZXNzYWdlLWJ1YmJsZVwiIFtjbGFzcy5vd24tYnViYmxlXT1cImlzT3duTWVzc2FnZShtc2cpXCIgKG1vdXNlZW50ZXIpPVwiaG92ZXJlZE1lc3NhZ2VJZCA9IG1zZy5tZXNzYWdlX2lkXCIgKG1vdXNlbGVhdmUpPVwiaG92ZXJlZE1lc3NhZ2VJZCA9IG51bGxcIj5cbiAgICAgICAgICAgICAgICA8IS0tIElNQUdFIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgCAtLT5cbiAgICAgICAgICAgICAgICA8ZGl2ICpuZ0lmPVwiaXNJbWFnZUF0dGFjaG1lbnQobXNnKVwiIGNsYXNzPVwiaW1hZ2UtbWVzc2FnZVwiPlxuICAgICAgICAgICAgICAgICAgPG5nLWNvbnRhaW5lciAqbmdJZj1cImdldE1lZGlhVXJsKG1zZykgYXMgZGF0YVVybDsgZWxzZSBpbWdGYWxsYmFja1wiPlxuICAgICAgICAgICAgICAgICAgICA8aW1nIFtzcmNdPVwiZGF0YVVybFwiIGFsdD1cIkltYWdlXCIgY2xhc3M9XCJtZWRpYS1pbWdcIiAoY2xpY2spPVwib3BlbkxpZ2h0Ym94KGRhdGFVcmwpXCIgLz5cbiAgICAgICAgICAgICAgICAgIDwvbmctY29udGFpbmVyPlxuICAgICAgICAgICAgICAgICAgPG5nLXRlbXBsYXRlICNpbWdGYWxsYmFjaz5cbiAgICAgICAgICAgICAgICAgICAgPGRpdiAqbmdJZj1cInNob3VsZFNob3dNZWRpYVNwaW5uZXIobXNnKTsgZWxzZSBpbWdBc0ZpbGVcIiBjbGFzcz1cIm1lZGlhLXBsYWNlaG9sZGVyXCI+XG4gICAgICAgICAgICAgICAgICAgICAgPG1hdC1zcGlubmVyIGRpYW1ldGVyPVwiMjJcIj48L21hdC1zcGlubmVyPlxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgPG5nLXRlbXBsYXRlICNpbWdBc0ZpbGU+XG4gICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZpbGUtbWVzc2FnZVwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgPG1hdC1pY29uIGNsYXNzPVwiZmlsZS1tc2ctaWNvblwiPmltYWdlPC9tYXQtaWNvbj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwiZmlsZS1tc2ctbmFtZVwiPnt7IGdldEF0dGFjaG1lbnROYW1lKG1zZykgfX08L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgIDwvbmctdGVtcGxhdGU+XG4gICAgICAgICAgICAgICAgICA8L25nLXRlbXBsYXRlPlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgICAgICAgICAgPCEtLSBGSUxFIC8gVklERU8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAIC0tPlxuICAgICAgICAgICAgICAgIDxkaXYgKm5nSWY9XCJtc2cubWVzc2FnZV90eXBlID09PSAnRklMRScgJiYgIWlzSW1hZ2VBdHRhY2htZW50KG1zZylcIiBjbGFzcz1cImZpbGUtbWVzc2FnZVwiPlxuICAgICAgICAgICAgICAgICAgPG5nLWNvbnRhaW5lciAqbmdJZj1cImlzVmlkZW9BdHRhY2htZW50KG1zZyk7IGVsc2UgcmVndWxhckZpbGVcIj5cbiAgICAgICAgICAgICAgICAgICAgPG5nLWNvbnRhaW5lciAqbmdJZj1cImdldE1lZGlhVXJsKG1zZykgYXMgdmlkZW9Vcmw7IGVsc2UgdmlkZW9Mb2FkaW5nXCI+XG4gICAgICAgICAgICAgICAgICAgICAgPHZpZGVvIGNvbnRyb2xzIGNsYXNzPVwibWVkaWEtdmlkZW9cIiBwcmVsb2FkPVwibWV0YWRhdGFcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxzb3VyY2UgW3NyY109XCJ2aWRlb1VybFwiIFt0eXBlXT1cImdldEF0dGFjaG1lbnRNaW1lVHlwZShtc2cpXCIgLz5cbiAgICAgICAgICAgICAgICAgICAgICAgIFlvdXIgYnJvd3NlciBkb2VzIG5vdCBzdXBwb3J0IHZpZGVvLlxuICAgICAgICAgICAgICAgICAgICAgIDwvdmlkZW8+XG4gICAgICAgICAgICAgICAgICAgIDwvbmctY29udGFpbmVyPlxuICAgICAgICAgICAgICAgICAgICA8bmctdGVtcGxhdGUgI3ZpZGVvTG9hZGluZz5cbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwibWVkaWEtcGxhY2Vob2xkZXJcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxtYXQtc3Bpbm5lciBkaWFtZXRlcj1cIjIyXCI+PC9tYXQtc3Bpbm5lcj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwibWVkaWEtbG9hZC1sYWJlbFwiPkxvYWRpbmcgdmlkZW/igKY8L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgIDwvbmctdGVtcGxhdGU+XG4gICAgICAgICAgICAgICAgICA8L25nLWNvbnRhaW5lcj5cbiAgICAgICAgICAgICAgICAgIDxuZy10ZW1wbGF0ZSAjcmVndWxhckZpbGU+XG4gICAgICAgICAgICAgICAgICAgIDxtYXQtaWNvbiBjbGFzcz1cImZpbGUtbXNnLWljb25cIj5pbnNlcnRfZHJpdmVfZmlsZTwvbWF0LWljb24+XG4gICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwiZmlsZS1tc2ctbmFtZVwiPnt7IGdldEF0dGFjaG1lbnROYW1lKG1zZykgfX08L3NwYW4+XG4gICAgICAgICAgICAgICAgICA8L25nLXRlbXBsYXRlPlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDxkaXZcbiAgICAgICAgICAgICAgICAgICpuZ0lmPVwibXNnLm1lc3NhZ2VfdHlwZSA9PT0gJ1RFWFQnICYmICFpc0ltYWdlQXR0YWNobWVudChtc2cpXCJcbiAgICAgICAgICAgICAgICAgIGNsYXNzPVwidGV4dC1jb250ZW50XCJcbiAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICB7eyBtc2cuY29udGVudCB9fVxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJtZXNzYWdlLW1ldGFcIj5cbiAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwibXNnLXRpbWVcIj57eyBmb3JtYXRUaW1lKG1zZy5jcmVhdGVkX2F0KSB9fTwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgIDxtYXQtaWNvbiAqbmdJZj1cImlzT3duTWVzc2FnZShtc2cpICYmIG1zZy5pc19yZWFkXCIgY2xhc3M9XCJyZWFkLWljb25cIj5kb25lX2FsbDwvbWF0LWljb24+XG4gICAgICAgICAgICAgICAgICA8bWF0LWljb24gKm5nSWY9XCJpc093bk1lc3NhZ2UobXNnKSAmJiAhbXNnLmlzX3JlYWRcIiBjbGFzcz1cInJlYWQtaWNvbiB1bnJlYWRcIj5kb25lPC9tYXQtaWNvbj5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICA8ZGl2ICpuZ0lmPVwiaG92ZXJlZE1lc3NhZ2VJZCA9PT0gbXNnLm1lc3NhZ2VfaWRcIiBjbGFzcz1cInF1aWNrLXJlYWN0aW9uc1wiPlxuICAgICAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgICAgICAqbmdGb3I9XCJsZXQgZW1vamkgb2YgcXVpY2tFbW9qaXNcIlxuICAgICAgICAgICAgICAgICAgICBjbGFzcz1cInF1aWNrLWVtb2ppLWJ0blwiXG4gICAgICAgICAgICAgICAgICAgIChjbGljayk9XCJvbkVtb2ppU2VsZWN0ZWQoZW1vamksIG1zZy5tZXNzYWdlX2lkKVwiXG4gICAgICAgICAgICAgICAgICAgIFthdHRyLmFyaWEtbGFiZWxdPVwiJ1JlYWN0IHdpdGggJyArIGVtb2ppXCJcbiAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAge3sgZW1vamkgfX1cbiAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDxkaXYgKm5nSWY9XCJtc2cucmVhY3Rpb25zICYmIG1zZy5yZWFjdGlvbnMubGVuZ3RoID4gMFwiIGNsYXNzPVwicmVhY3Rpb25zLXJvd1wiPlxuICAgICAgICAgICAgICAgICAgPGJ1dHRvbiBcbiAgICAgICAgICAgICAgICAgICAgKm5nRm9yPVwibGV0IHIgb2YgbXNnLnJlYWN0aW9uc1wiIFxuICAgICAgICAgICAgICAgICAgICBjbGFzcz1cInJlYWN0aW9uLWNoaXBcIlxuICAgICAgICAgICAgICAgICAgICAoY2xpY2spPVwidG9nZ2xlUmVhY3Rpb24oci5lbW9qaSwgbXNnLm1lc3NhZ2VfaWQpXCJcbiAgICAgICAgICAgICAgICAgICAgW2NsYXNzLm93bi1yZWFjdGlvbl09XCJyLmhhc1JlYWN0ZWRcIlxuICAgICAgICAgICAgICAgICAgICBbbWF0VG9vbHRpcF09XCJnZXRSZWFjdG9yVG9vbHRpcChyKVwiXG4gICAgICAgICAgICAgICAgICAgIG1hdFRvb2x0aXBQb3NpdGlvbj1cImFib3ZlXCJcbiAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAge3sgci5lbW9qaSB9fSB7eyByLmNvdW50IH19XG4gICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8L25nLWNvbnRhaW5lcj5cbiAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgPGRpdiAqbmdJZj1cIm1lc3NhZ2VzLmxlbmd0aCA9PT0gMCAmJiAhbG9hZGluZ1wiIGNsYXNzPVwiZW1wdHktY2hhdFwiPlxuICAgICAgICAgIDxtYXQtaWNvbj5jaGF0X2J1YmJsZV9vdXRsaW5lPC9tYXQtaWNvbj5cbiAgICAgICAgICA8cD5ObyBtZXNzYWdlcyB5ZXQuIFNheSBoZWxsbyE8L3A+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG5cbiAgICAgIDxhcHAtbWVzc2FnZS1pbnB1dFxuICAgICAgICAobWVzc2FnZVNlbnQpPVwib25TZW5kTWVzc2FnZSgkZXZlbnQpXCJcbiAgICAgICAgKG1lc3NhZ2VXaXRoRmlsZXMpPVwib25TZW5kV2l0aEZpbGVzKCRldmVudClcIlxuICAgICAgPjwvYXBwLW1lc3NhZ2UtaW5wdXQ+XG4gICAgPC9kaXY+XG5cbiAgICA8IS0tIEltYWdlIHZpZXdlcjogZnVsbHNjcmVlbiBvdmVybGF5IE9SIGRldGFjaGVkIGZsb2F0aW5nIHdpbmRvdyAtLT5cbiAgICA8ZGl2XG4gICAgICAqbmdJZj1cImxpZ2h0Ym94VXJsXCJcbiAgICAgIGNsYXNzPVwibGlnaHRib3gtb3ZlcmxheVwiXG4gICAgICBbY2xhc3MubGlnaHRib3gtZGV0YWNoZWRdPVwibGlnaHRib3hEZXRhY2hlZFwiXG4gICAgICBbc3R5bGUubGVmdC5weF09XCJsaWdodGJveERldGFjaGVkID8gbGlnaHRib3hYIDogbnVsbFwiXG4gICAgICBbc3R5bGUudG9wLnB4XT1cImxpZ2h0Ym94RGV0YWNoZWQgPyBsaWdodGJveFkgOiBudWxsXCJcbiAgICAgIFtzdHlsZS53aWR0aC5weF09XCJsaWdodGJveERldGFjaGVkID8gbGlnaHRib3hXIDogbnVsbFwiXG4gICAgICBbc3R5bGUuaGVpZ2h0LnB4XT1cImxpZ2h0Ym94RGV0YWNoZWQgPyBsaWdodGJveEggOiBudWxsXCJcbiAgICAgIChjbGljayk9XCJvbkxpZ2h0Ym94QmFja2Ryb3BDbGljaygkZXZlbnQpXCJcbiAgICA+XG4gICAgICA8IS0tIERyYWcgaGFuZGxlIGJhciAodmlzaWJsZSBpbiBkZXRhY2hlZCBtb2RlKSAtLT5cbiAgICAgIDxkaXZcbiAgICAgICAgKm5nSWY9XCJsaWdodGJveERldGFjaGVkXCJcbiAgICAgICAgY2xhc3M9XCJsaWdodGJveC1kcmFnLWJhclwiXG4gICAgICAgIChtb3VzZWRvd24pPVwib25MaWdodGJveERyYWdTdGFydCgkZXZlbnQpXCJcbiAgICAgID5cbiAgICAgICAgPHNwYW4gY2xhc3M9XCJsaWdodGJveC1kcmFnLXRpdGxlXCI+SW1hZ2Ugdmlld2VyPC9zcGFuPlxuICAgICAgICA8ZGl2IGNsYXNzPVwibGlnaHRib3gtZHJhZy1hY3Rpb25zXCI+XG4gICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgdHlwZT1cImJ1dHRvblwiXG4gICAgICAgICAgICBjbGFzcz1cImxpZ2h0Ym94LWFjdGlvbi1idG5cIlxuICAgICAgICAgICAgKGNsaWNrKT1cIiRldmVudC5zdG9wUHJvcGFnYXRpb24oKTsgZXhwYW5kTGlnaHRib3goKVwiXG4gICAgICAgICAgICB0aXRsZT1cIkV4cGFuZCB0byBmdWxsc2NyZWVuXCJcbiAgICAgICAgICA+XG4gICAgICAgICAgICA8bWF0LWljb24+ZnVsbHNjcmVlbjwvbWF0LWljb24+XG4gICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgdHlwZT1cImJ1dHRvblwiXG4gICAgICAgICAgICBjbGFzcz1cImxpZ2h0Ym94LWFjdGlvbi1idG5cIlxuICAgICAgICAgICAgKGNsaWNrKT1cIiRldmVudC5zdG9wUHJvcGFnYXRpb24oKTsgY2xvc2VMaWdodGJveCgpXCJcbiAgICAgICAgICAgIHRpdGxlPVwiQ2xvc2VcIlxuICAgICAgICAgID5cbiAgICAgICAgICAgIDxtYXQtaWNvbj5jbG9zZTwvbWF0LWljb24+XG4gICAgICAgICAgPC9idXR0b24+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG5cbiAgICAgIDxpbWdcbiAgICAgICAgW3NyY109XCJsaWdodGJveFVybFwiXG4gICAgICAgIGNsYXNzPVwibGlnaHRib3gtaW1nXCJcbiAgICAgICAgW2NsYXNzLmxpZ2h0Ym94LWltZy1kZXRhY2hlZF09XCJsaWdodGJveERldGFjaGVkXCJcbiAgICAgICAgKGNsaWNrKT1cIiRldmVudC5zdG9wUHJvcGFnYXRpb24oKVwiXG4gICAgICAvPlxuXG4gICAgICA8IS0tIENvbnRyb2xzIHNob3duIGluIGZ1bGxzY3JlZW4gbW9kZSAtLT5cbiAgICAgIDxuZy1jb250YWluZXIgKm5nSWY9XCIhbGlnaHRib3hEZXRhY2hlZFwiPlxuICAgICAgICA8YnV0dG9uIGNsYXNzPVwibGlnaHRib3gtY2xvc2VcIiAoY2xpY2spPVwibGlnaHRib3hVcmwgPSBudWxsXCI+XG4gICAgICAgICAgPG1hdC1pY29uPmNsb3NlPC9tYXQtaWNvbj5cbiAgICAgICAgPC9idXR0b24+XG4gICAgICAgIDxidXR0b24gY2xhc3M9XCJsaWdodGJveC1kZXRhY2gtYnRuXCIgKGNsaWNrKT1cImRldGFjaExpZ2h0Ym94KClcIiB0aXRsZT1cIkRldGFjaCB0byBmbG9hdGluZyB3aW5kb3dcIj5cbiAgICAgICAgICA8bWF0LWljb24+cGljdHVyZV9pbl9waWN0dXJlPC9tYXQtaWNvbj5cbiAgICAgICAgPC9idXR0b24+XG4gICAgICA8L25nLWNvbnRhaW5lcj5cblxuICAgICAgPCEtLSBSZXNpemUgY29ybmVyIChkZXRhY2hlZCBtb2RlKSAtLT5cbiAgICAgIDxkaXYgKm5nSWY9XCJsaWdodGJveERldGFjaGVkXCIgY2xhc3M9XCJsaWdodGJveC1yZXNpemUtY29ybmVyXCIgKG1vdXNlZG93bik9XCJvbkxpZ2h0Ym94UmVzaXplU3RhcnQoJGV2ZW50KVwiPjwvZGl2PlxuICAgIDwvZGl2PlxuICBgLFxuICBzdHlsZXM6IFtgXG4gICAgLmNoYXQtdGhyZWFkIHtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgaGVpZ2h0OiAxMDAlO1xuICAgICAgYmFja2dyb3VuZDogIzA0MTMyMjtcbiAgICB9XG5cbiAgICAuY2hhdC1oZWFkZXIge1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBwYWRkaW5nOiA4cHggOHB4IDhweCA0cHg7XG4gICAgICBib3JkZXItYm90dG9tOiAxcHggc29saWQgcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjE1KTtcbiAgICAgIGdhcDogNHB4O1xuICAgICAgZmxleC1zaHJpbms6IDA7XG4gICAgfVxuXG4gICAgLmNoYXQtaGVhZGVyIGJ1dHRvbiBtYXQtaWNvbiB7XG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjgpO1xuICAgIH1cblxuICAgIC5jaGF0LW5hbWUge1xuICAgICAgZm9udC1zaXplOiAxNnB4O1xuICAgICAgZm9udC13ZWlnaHQ6IDYwMDtcbiAgICAgIGNvbG9yOiAjZmZmO1xuICAgIH1cblxuICAgIC5oZWFkZXItaW5mbyB7XG4gICAgICBmbGV4OiAxO1xuICAgICAgd2hpdGUtc3BhY2U6IG5vd3JhcDtcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICB0ZXh0LW92ZXJmbG93OiBlbGxpcHNpcztcbiAgICAgIGRpc3BsYXk6IGJsb2NrO1xuICAgICAgcGFkZGluZzogMCA0cHg7XG4gICAgfVxuXG4gICAgLmhlYWRlci1hY3Rpb25zIHtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBnYXA6IDA7XG4gICAgfVxuXG4gICAgLmhlYWRlci1hY3Rpb25zIGJ1dHRvbiB7XG4gICAgICB3aWR0aDogMzJweDtcbiAgICAgIGhlaWdodDogMzJweDtcbiAgICB9XG5cbiAgICAuaGRyLWJ0biB7XG4gICAgICBib3JkZXItcmFkaXVzOiA2cHggIWltcG9ydGFudDtcbiAgICAgIHRyYW5zaXRpb246IGJhY2tncm91bmQgMC4xNXMsIGJveC1zaGFkb3cgMC4xNXM7XG4gICAgfVxuXG4gICAgLmhkci1idG46aG92ZXIge1xuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjE1KSAhaW1wb3J0YW50O1xuICAgICAgYm94LXNoYWRvdzogMCAycHggOHB4IHJnYmEoMCwgMCwgMCwgMC4yKTtcbiAgICB9XG5cbiAgICAubWVzc2FnZXMtYXJlYSB7XG4gICAgICBmbGV4OiAxO1xuICAgICAgb3ZlcmZsb3cteTogYXV0bztcbiAgICAgIHBhZGRpbmc6IDEycHg7XG4gICAgICBiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudDtcbiAgICAgIHNjcm9sbGJhci13aWR0aDogbm9uZTtcbiAgICAgIC1tcy1vdmVyZmxvdy1zdHlsZTogbm9uZTtcbiAgICB9XG5cbiAgICAubWVzc2FnZXMtYXJlYTo6LXdlYmtpdC1zY3JvbGxiYXIge1xuICAgICAgZGlzcGxheTogbm9uZTtcbiAgICB9XG5cbiAgICAubG9hZGluZy1pbmRpY2F0b3Ige1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgIGdhcDogOHB4O1xuICAgICAgcGFkZGluZzogMTJweDtcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNyk7XG4gICAgICBmb250LXNpemU6IDEzcHg7XG4gICAgfVxuXG4gICAgLmxvYWQtbW9yZS1idG4ge1xuICAgICAgYWxpZ24tc2VsZjogY2VudGVyO1xuICAgICAgbWFyZ2luLWJvdHRvbTogMTZweDtcbiAgICAgIGZvbnQtc2l6ZTogMTJweDtcbiAgICAgIGNvbG9yOiAjZmZmO1xuICAgIH1cblxuICAgIC5tZXNzYWdlcy1saXN0IHtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgZ2FwOiAxcHg7XG4gICAgICBmbGV4OiAxO1xuICAgIH1cblxuICAgIC5kYXRlLXNlcGFyYXRvciB7XG4gICAgICB0ZXh0LWFsaWduOiBjZW50ZXI7XG4gICAgICBtYXJnaW46IDE2cHggMCA4cHg7XG4gICAgICBmb250LXNpemU6IDEycHg7XG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjcpO1xuICAgICAgZm9udC13ZWlnaHQ6IDUwMDtcbiAgICB9XG5cbiAgICAubWVzc2FnZS1idWJibGUtcm93IHtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgbWF4LXdpZHRoOiA4OCU7XG4gICAgICBtYXJnaW4tYm90dG9tOiAycHg7XG4gICAgfVxuXG4gICAgLm1lc3NhZ2UtYnViYmxlLXJvdy5vd24ge1xuICAgICAgYWxpZ24tc2VsZjogZmxleC1lbmQ7XG4gICAgICBhbGlnbi1pdGVtczogZmxleC1lbmQ7XG4gICAgfVxuXG4gICAgLm1lc3NhZ2UtYnViYmxlLXJvdy5vdGhlciB7XG4gICAgICBhbGlnbi1zZWxmOiBmbGV4LXN0YXJ0O1xuICAgICAgYWxpZ24taXRlbXM6IGZsZXgtc3RhcnQ7XG4gICAgfVxuXG4gICAgLnNlbmRlci1uYW1lIHtcbiAgICAgIGZvbnQtc2l6ZTogMTFweDtcbiAgICAgIGZvbnQtd2VpZ2h0OiA3MDA7XG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjk1KTtcbiAgICAgIG1hcmdpbi1ib3R0b206IDNweDtcbiAgICAgIGxldHRlci1zcGFjaW5nOiAwLjJweDtcbiAgICAgIHBhZGRpbmc6IDAgMTBweDtcbiAgICAgIHRleHQtc2hhZG93OiAwIDFweCAzcHggcmdiYSgwLCAwLCAwLCAwLjQpO1xuICAgIH1cblxuICAgIC5tZXNzYWdlLWJ1YmJsZSB7XG4gICAgICBwYWRkaW5nOiA4cHggMTRweCA3cHg7XG4gICAgICBib3JkZXItcmFkaXVzOiAxNHB4O1xuICAgICAgZm9udC1zaXplOiAxM3B4O1xuICAgICAgbGluZS1oZWlnaHQ6IDEuMzI7XG4gICAgICB3b3JkLWJyZWFrOiBicmVhay13b3JkO1xuICAgICAgY29sb3I6ICNmNWY3ZmY7XG4gICAgICBwb3NpdGlvbjogcmVsYXRpdmU7XG4gICAgICBkaXNwbGF5OiBpbmxpbmUtYmxvY2s7XG4gICAgICBtaW4td2lkdGg6IGZpdC1jb250ZW50O1xuICAgIH1cblxuICAgIC5tZXNzYWdlLWJ1YmJsZS1yb3cub3RoZXIgLm1lc3NhZ2UtYnViYmxlIHtcbiAgICAgIGJhY2tncm91bmQ6ICMwZDI1NDA7XG4gICAgICBib3JkZXItYm90dG9tLWxlZnQtcmFkaXVzOiA1cHg7XG4gICAgICBib3gtc2hhZG93OiAwIDFweCA0cHggcmdiYSgwLCAwLCAwLCAwLjQpO1xuICAgIH1cblxuICAgIC5tZXNzYWdlLWJ1YmJsZS5vd24tYnViYmxlIHtcbiAgICAgIGJhY2tncm91bmQ6ICMwYTNkNjI7XG4gICAgICBib3JkZXItYm90dG9tLXJpZ2h0LXJhZGl1czogNXB4O1xuICAgICAgYm94LXNoYWRvdzogMCAxcHggNHB4IHJnYmEoMCwgMCwgMCwgMC40KTtcbiAgICB9XG5cbiAgICAuaW1hZ2UtbWVzc2FnZSB7XG4gICAgICBsaW5lLWhlaWdodDogMDtcbiAgICB9XG5cbiAgICAubWVkaWEtaW1nIHtcbiAgICAgIG1heC13aWR0aDogMjIwcHg7XG4gICAgICBtYXgtaGVpZ2h0OiAyODBweDtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDEwcHg7XG4gICAgICBkaXNwbGF5OiBibG9jaztcbiAgICAgIGN1cnNvcjogem9vbS1pbjtcbiAgICAgIG9iamVjdC1maXQ6IGNvdmVyO1xuICAgICAgdHJhbnNpdGlvbjogb3BhY2l0eSAwLjE1cztcbiAgICB9XG5cbiAgICAubWVkaWEtaW1nOmhvdmVyIHtcbiAgICAgIG9wYWNpdHk6IDAuODg7XG4gICAgfVxuXG4gICAgLm1lZGlhLXZpZGVvIHtcbiAgICAgIG1heC13aWR0aDogMjQwcHg7XG4gICAgICBib3JkZXItcmFkaXVzOiAxMHB4O1xuICAgICAgZGlzcGxheTogYmxvY2s7XG4gICAgICBiYWNrZ3JvdW5kOiAjMDAwO1xuICAgIH1cblxuICAgIC5tZWRpYS1wbGFjZWhvbGRlciB7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGdhcDogOHB4O1xuICAgICAgbWluLXdpZHRoOiA4MHB4O1xuICAgICAgbWluLWhlaWdodDogNDRweDtcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwyNTUsMjU1LDAuNik7XG4gICAgICBmb250LXNpemU6IDExcHg7XG4gICAgfVxuXG4gICAgLm1lZGlhLWxvYWQtbGFiZWwge1xuICAgICAgZm9udC1zaXplOiAxMXB4O1xuICAgICAgY29sb3I6IHJnYmEoMjU1LDI1NSwyNTUsMC42KTtcbiAgICB9XG5cbiAgICAuZmlsZS1tZXNzYWdlIHtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgZ2FwOiA4cHg7XG4gICAgICBwYWRkaW5nOiA0cHggMDtcbiAgICB9XG5cbiAgICAuZmlsZS1tc2ctaWNvbiB7XG4gICAgICBmb250LXNpemU6IDIwcHg7XG4gICAgICB3aWR0aDogMjBweDtcbiAgICAgIGhlaWdodDogMjBweDtcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuOCk7XG4gICAgfVxuXG4gICAgLmZpbGUtbXNnLW5hbWUge1xuICAgICAgZm9udC1zaXplOiAxM3B4O1xuICAgICAgY29sb3I6ICNmZmY7XG4gICAgICB3b3JkLWJyZWFrOiBicmVhay1hbGw7XG4gICAgfVxuXG4gICAgLyog4pSA4pSAIExpZ2h0Ym94IOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgCAqL1xuICAgIC8qIOKUgOKUgCBMaWdodGJveCDilIDilIAgKi9cbiAgICAubGlnaHRib3gtb3ZlcmxheSB7XG4gICAgICBwb3NpdGlvbjogZml4ZWQ7XG4gICAgICBpbnNldDogMDtcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMCwwLDAsMC44OCk7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgICAgei1pbmRleDogOTk5OTk7XG4gICAgICBjdXJzb3I6IHBvaW50ZXI7XG4gICAgfVxuXG4gICAgLyogRGV0YWNoZWQgZmxvYXRpbmcgd2luZG93ICovXG4gICAgLmxpZ2h0Ym94LW92ZXJsYXkubGlnaHRib3gtZGV0YWNoZWQge1xuICAgICAgaW5zZXQ6IHVuc2V0O1xuICAgICAgYmFja2dyb3VuZDogIzBjMWYzNTtcbiAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHJnYmEoMjU1LDI1NSwyNTUsMC4xOCk7XG4gICAgICBib3JkZXItcmFkaXVzOiAxMnB4O1xuICAgICAgYm94LXNoYWRvdzogMCAxMnB4IDQ4cHggcmdiYSgwLDAsMCwwLjcpO1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgY3Vyc29yOiBkZWZhdWx0O1xuICAgICAgbWluLXdpZHRoOiAyMDBweDtcbiAgICAgIG1pbi1oZWlnaHQ6IDE4MHB4O1xuICAgIH1cblxuICAgIC5saWdodGJveC1kcmFnLWJhciB7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGp1c3RpZnktY29udGVudDogc3BhY2UtYmV0d2VlbjtcbiAgICAgIHBhZGRpbmc6IDZweCA4cHggNnB4IDEycHg7XG4gICAgICBiYWNrZ3JvdW5kOiAjMDQxMzIyO1xuICAgICAgYm9yZGVyLWJvdHRvbTogMXB4IHNvbGlkIHJnYmEoMjU1LDI1NSwyNTUsMC4xMik7XG4gICAgICBjdXJzb3I6IGdyYWI7XG4gICAgICBmbGV4LXNocmluazogMDtcbiAgICAgIHVzZXItc2VsZWN0OiBub25lO1xuICAgIH1cblxuICAgIC5saWdodGJveC1kcmFnLWJhcjphY3RpdmUgeyBjdXJzb3I6IGdyYWJiaW5nOyB9XG5cbiAgICAubGlnaHRib3gtZHJhZy10aXRsZSB7XG4gICAgICBmb250LXNpemU6IDEycHg7XG4gICAgICBjb2xvcjogcmdiYSgyNTUsMjU1LDI1NSwwLjYpO1xuICAgICAgbGV0dGVyLXNwYWNpbmc6IDAuNHB4O1xuICAgIH1cblxuICAgIC5saWdodGJveC1kcmFnLWFjdGlvbnMge1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGdhcDogMnB4O1xuICAgIH1cblxuICAgIC5saWdodGJveC1hY3Rpb24tYnRuIHtcbiAgICAgIGJhY2tncm91bmQ6IHRyYW5zcGFyZW50O1xuICAgICAgYm9yZGVyOiBub25lO1xuICAgICAgYm9yZGVyLXJhZGl1czogNnB4O1xuICAgICAgd2lkdGg6IDI4cHg7XG4gICAgICBoZWlnaHQ6IDI4cHg7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgICAgY3Vyc29yOiBwb2ludGVyO1xuICAgICAgY29sb3I6IHJnYmEoMjU1LDI1NSwyNTUsMC43KTtcbiAgICAgIHRyYW5zaXRpb246IGJhY2tncm91bmQgMC4xNXM7XG4gICAgfVxuXG4gICAgLmxpZ2h0Ym94LWFjdGlvbi1idG46aG92ZXIgeyBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwyNTUsMjU1LDAuMTUpOyB9XG5cbiAgICAubGlnaHRib3gtYWN0aW9uLWJ0biBtYXQtaWNvbiB7XG4gICAgICBmb250LXNpemU6IDE2cHg7XG4gICAgICB3aWR0aDogMTZweDtcbiAgICAgIGhlaWdodDogMTZweDtcbiAgICB9XG5cbiAgICAubGlnaHRib3gtaW1nIHtcbiAgICAgIG1heC13aWR0aDogOTJ2dztcbiAgICAgIG1heC1oZWlnaHQ6IDkydmg7XG4gICAgICBib3JkZXItcmFkaXVzOiA4cHg7XG4gICAgICBib3gtc2hhZG93OiAwIDhweCA0MHB4IHJnYmEoMCwwLDAsMC42KTtcbiAgICAgIGN1cnNvcjogZGVmYXVsdDtcbiAgICB9XG5cbiAgICAubGlnaHRib3gtaW1nLmxpZ2h0Ym94LWltZy1kZXRhY2hlZCB7XG4gICAgICBtYXgtd2lkdGg6IDEwMCU7XG4gICAgICBtYXgtaGVpZ2h0OiAxMDAlO1xuICAgICAgYm9yZGVyLXJhZGl1czogMDtcbiAgICAgIGJveC1zaGFkb3c6IG5vbmU7XG4gICAgICBvYmplY3QtZml0OiBjb250YWluO1xuICAgICAgZmxleDogMTtcbiAgICB9XG5cbiAgICAubGlnaHRib3gtY2xvc2Uge1xuICAgICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgICAgdG9wOiAxNnB4O1xuICAgICAgcmlnaHQ6IDE2cHg7XG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwyNTUsMjU1LDAuMTUpO1xuICAgICAgYm9yZGVyOiBub25lO1xuICAgICAgYm9yZGVyLXJhZGl1czogNTAlO1xuICAgICAgd2lkdGg6IDM2cHg7XG4gICAgICBoZWlnaHQ6IDM2cHg7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgICAgY3Vyc29yOiBwb2ludGVyO1xuICAgICAgY29sb3I6ICNmZmY7XG4gICAgICB0cmFuc2l0aW9uOiBiYWNrZ3JvdW5kIDAuMTVzO1xuICAgIH1cblxuICAgIC5saWdodGJveC1jbG9zZTpob3ZlciB7IGJhY2tncm91bmQ6IHJnYmEoMjU1LDI1NSwyNTUsMC4zKTsgfVxuXG4gICAgLmxpZ2h0Ym94LWRldGFjaC1idG4ge1xuICAgICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgICAgdG9wOiAxNnB4O1xuICAgICAgcmlnaHQ6IDYwcHg7XG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwyNTUsMjU1LDAuMTUpO1xuICAgICAgYm9yZGVyOiBub25lO1xuICAgICAgYm9yZGVyLXJhZGl1czogNTAlO1xuICAgICAgd2lkdGg6IDM2cHg7XG4gICAgICBoZWlnaHQ6IDM2cHg7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgICAgY3Vyc29yOiBwb2ludGVyO1xuICAgICAgY29sb3I6ICNmZmY7XG4gICAgICB0cmFuc2l0aW9uOiBiYWNrZ3JvdW5kIDAuMTVzO1xuICAgIH1cblxuICAgIC5saWdodGJveC1kZXRhY2gtYnRuOmhvdmVyIHsgYmFja2dyb3VuZDogcmdiYSgyNTUsMjU1LDI1NSwwLjMpOyB9XG5cbiAgICAubGlnaHRib3gtcmVzaXplLWNvcm5lciB7XG4gICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XG4gICAgICBib3R0b206IDA7XG4gICAgICByaWdodDogMDtcbiAgICAgIHdpZHRoOiAxNnB4O1xuICAgICAgaGVpZ2h0OiAxNnB4O1xuICAgICAgY3Vyc29yOiBzZS1yZXNpemU7XG4gICAgICBiYWNrZ3JvdW5kOiBsaW5lYXItZ3JhZGllbnQoMTM1ZGVnLCB0cmFuc3BhcmVudCA1MCUsIHJnYmEoMjU1LDI1NSwyNTUsMC4yKSA1MCUpO1xuICAgICAgYm9yZGVyLWJvdHRvbS1yaWdodC1yYWRpdXM6IDEycHg7XG4gICAgfVxuXG4gICAgLm1lc3NhZ2UtbWV0YSB7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGdhcDogNHB4O1xuICAgICAgbWFyZ2luLXRvcDogM3B4O1xuICAgIH1cblxuICAgIC5tc2ctdGltZSB7XG4gICAgICBmb250LXNpemU6IDEwcHg7XG4gICAgICBjb2xvcjogcmdiYSgyMTgsIDIyNCwgMjUwLCAwLjY2KTtcbiAgICB9XG5cbiAgICAubWVzc2FnZS1idWJibGUtcm93Lm90aGVyIC5tc2ctdGltZSB7XG4gICAgICBjb2xvcjogcmdiYSgyMTYsIDIyMywgMjQ2LCAwLjU4KTtcbiAgICB9XG5cbiAgICAucmVhZC1pY29uIHtcbiAgICAgIGZvbnQtc2l6ZTogMTRweDtcbiAgICAgIHdpZHRoOiAxNHB4O1xuICAgICAgaGVpZ2h0OiAxNHB4O1xuICAgICAgb3BhY2l0eTogMC43O1xuICAgIH1cblxuICAgIC5yZWFkLWljb24udW5yZWFkIHtcbiAgICAgIG9wYWNpdHk6IDAuNDtcbiAgICB9XG5cbiAgICAucXVpY2stcmVhY3Rpb25zIHtcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgIHRvcDogLTE4cHg7XG4gICAgICByaWdodDogMDtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgZ2FwOiA0cHg7XG4gICAgICBwYWRkaW5nOiAzcHggNXB4O1xuICAgICAgYmFja2dyb3VuZDogIzA3MWQzMDtcbiAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xNCk7XG4gICAgICBib3JkZXItcmFkaXVzOiA5OTlweDtcbiAgICAgIGJveC1zaGFkb3c6IDAgNnB4IDE0cHggcmdiYSgwLCAwLCAwLCAwLjI4KTtcbiAgICAgIHotaW5kZXg6IDQ7XG4gICAgfVxuXG4gICAgLnF1aWNrLWVtb2ppLWJ0biB7XG4gICAgICB3aWR0aDogMjBweDtcbiAgICAgIGhlaWdodDogMjBweDtcbiAgICAgIGJvcmRlcjogbm9uZTtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDk5OXB4O1xuICAgICAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQ7XG4gICAgICBjb2xvcjogI2ZmZjtcbiAgICAgIGRpc3BsYXk6IGlubGluZS1mbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgICAgZm9udC1zaXplOiAxM3B4O1xuICAgICAgbGluZS1oZWlnaHQ6IDE7XG4gICAgICBjdXJzb3I6IHBvaW50ZXI7XG4gICAgICBwYWRkaW5nOiAwO1xuICAgICAgdHJhbnNpdGlvbjogdHJhbnNmb3JtIDAuMTJzIGVhc2UsIGJhY2tncm91bmQgMC4xMnMgZWFzZTtcbiAgICB9XG5cbiAgICAucXVpY2stZW1vamktYnRuOmhvdmVyIHtcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xOCk7XG4gICAgICB0cmFuc2Zvcm06IHNjYWxlKDEuMTQpO1xuICAgIH1cblxuICAgIC5yZWFjdGlvbnMtcm93IHtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBmbGV4LXdyYXA6IHdyYXA7XG4gICAgICBnYXA6IDNweDtcbiAgICAgIG1hcmdpbi10b3A6IDVweDtcbiAgICB9XG5cbiAgICAucmVhY3Rpb24tY2hpcCB7XG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwyNTUsMjU1LDAuMDgpO1xuICAgICAgYm9yZGVyOiAxcHggc29saWQgcmdiYSgyNTUsMjU1LDI1NSwwLjIpO1xuICAgICAgYm9yZGVyLXJhZGl1czogOTk5cHg7XG4gICAgICBwYWRkaW5nOiAxcHggN3B4O1xuICAgICAgZm9udC1zaXplOiAxMXB4O1xuICAgICAgY29sb3I6ICNmMmY2ZmY7XG4gICAgICBjdXJzb3I6IHBvaW50ZXI7XG4gICAgICB0cmFuc2l0aW9uOiBhbGwgMC4ycztcbiAgICB9XG5cbiAgICAucmVhY3Rpb24tY2hpcDpob3ZlciB7XG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwyNTUsMjU1LDAuMjUpO1xuICAgICAgdHJhbnNmb3JtOiBzY2FsZSgxLjA1KTtcbiAgICB9XG5cbiAgICAucmVhY3Rpb24tY2hpcC5vd24tcmVhY3Rpb24ge1xuICAgICAgYmFja2dyb3VuZDogcmdiYSg0Miw5MSwyNTUsMC4zKTtcbiAgICAgIGJvcmRlci1jb2xvcjogcmdiYSg0Miw5MSwyNTUsMC41KTtcbiAgICB9XG5cbiAgICAuZW1wdHktY2hhdCB7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgIGZsZXg6IDE7XG4gICAgICBjb2xvcjogIzljYTNhZjtcbiAgICB9XG5cbiAgICAuZW1wdHktY2hhdCBtYXQtaWNvbiB7XG4gICAgICBmb250LXNpemU6IDQ4cHg7XG4gICAgICB3aWR0aDogNDhweDtcbiAgICAgIGhlaWdodDogNDhweDtcbiAgICAgIG1hcmdpbi1ib3R0b206IDhweDtcbiAgICB9XG5cbiAgICAuZW1wdHktY2hhdCBwIHtcbiAgICAgIGZvbnQtc2l6ZTogMTRweDtcbiAgICAgIG1hcmdpbjogMDtcbiAgICB9XG4gIGBdLFxufSlcbmV4cG9ydCBjbGFzcyBDaGF0VGhyZWFkQ29tcG9uZW50IGltcGxlbWVudHMgT25Jbml0LCBPbkRlc3Ryb3ksIEFmdGVyVmlld0NoZWNrZWQge1xuICBAVmlld0NoaWxkKCdzY3JvbGxDb250YWluZXInKSBzY3JvbGxDb250YWluZXIhOiBFbGVtZW50UmVmO1xuXG4gIG1lc3NhZ2VzOiBNZXNzYWdlW10gPSBbXTtcbiAgdmlzaWJsZUNvbnRhY3RzOiBDb250YWN0W10gPSBbXTtcbiAgY29udmVyc2F0aW9uTmFtZSA9ICcnO1xuICBpc0dyb3VwID0gZmFsc2U7XG4gIGxvYWRpbmcgPSBmYWxzZTtcbiAgbXlDb250YWN0SWQ6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuXG4gIHByaXZhdGUgY29udmVyc2F0aW9uSWQ6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIHN1YiE6IFN1YnNjcmlwdGlvbjtcbiAgcHJpdmF0ZSBzaG91bGRTY3JvbGxUb0JvdHRvbSA9IHRydWU7XG5cbiAgdXBsb2FkaW5nID0gZmFsc2U7XG4gIGhvdmVyZWRNZXNzYWdlSWQ6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuICBxdWlja0Vtb2ppcyA9IFsn4p2k77iPJywgJ/CfkY0nLCAn8J+YgicsICfwn5iuJywgJ/CfmKInLCAn8J+UpSddO1xuXG4gIC8qKiBMaWdodGJveDogY3VycmVudGx5IGRpc3BsYXllZCBmdWxsLXNpemUgZGF0YSBVUkwgKi9cbiAgbGlnaHRib3hVcmw6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuICAvKiogV2hlbiB0cnVlIHRoZSBsaWdodGJveCBpcyBhIGRyYWdnYWJsZSBmbG9hdGluZyB3aW5kb3cgaW5zdGVhZCBvZiBmdWxsLXNjcmVlbiAqL1xuICBsaWdodGJveERldGFjaGVkID0gZmFsc2U7XG4gIGxpZ2h0Ym94WCA9IDEwMDtcbiAgbGlnaHRib3hZID0gODA7XG4gIGxpZ2h0Ym94VyA9IDQ4MDtcbiAgbGlnaHRib3hIID0gNDAwO1xuXG4gIC8vIGxpZ2h0Ym94IGRyYWcgc3RhdGVcbiAgcHJpdmF0ZSBsYkRyYWdnaW5nID0gZmFsc2U7XG4gIHByaXZhdGUgbGJEcmFnT2ZmWCA9IDA7XG4gIHByaXZhdGUgbGJEcmFnT2ZmWSA9IDA7XG4gIHByaXZhdGUgYm91bmRMYk1vdmUgICA9IHRoaXMub25MaWdodGJveERyYWdNb3ZlLmJpbmQodGhpcyk7XG4gIHByaXZhdGUgYm91bmRMYkVuZCAgICA9IHRoaXMub25MaWdodGJveERyYWdFbmQuYmluZCh0aGlzKTtcbiAgLy8gbGlnaHRib3ggcmVzaXplIHN0YXRlXG4gIHByaXZhdGUgbGJSZXNpemluZyA9IGZhbHNlO1xuICBwcml2YXRlIGxiUmVzaXplU3RhcnRYID0gMDtcbiAgcHJpdmF0ZSBsYlJlc2l6ZVN0YXJ0WSA9IDA7XG4gIHByaXZhdGUgbGJSZXNpemVTdGFydFcgPSAwO1xuICBwcml2YXRlIGxiUmVzaXplU3RhcnRIID0gMDtcbiAgcHJpdmF0ZSBib3VuZExiUmVzaXplTW92ZSA9IHRoaXMub25MaWdodGJveFJlc2l6ZU1vdmUuYmluZCh0aGlzKTtcbiAgcHJpdmF0ZSBib3VuZExiUmVzaXplRW5kICA9IHRoaXMub25MaWdodGJveFJlc2l6ZUVuZC5iaW5kKHRoaXMpO1xuXG4gIC8qKiBUcmFja3Mgd2hpY2ggZmlsZSBJRHMgYXJlIGN1cnJlbnRseSBiZWluZyBmZXRjaGVkIHRvIGF2b2lkIGR1cGxpY2F0ZSByZXF1ZXN0cyAqL1xuICBwcml2YXRlIG1lZGlhTG9hZGluZyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICAvKiogVHJhY2tzIGZpbGUgSURzIHdoZXJlIHJldHJpZXZhbCBmYWlsZWQgc28gVUkgZG9lc24ndCBzcGluIGZvcmV2ZXIuICovXG4gIHByaXZhdGUgbWVkaWFGYWlsZWQgPSBuZXcgU2V0PHN0cmluZz4oKTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIHN0b3JlOiBNZXNzYWdpbmdTdG9yZVNlcnZpY2UsXG4gICAgcHJpdmF0ZSBhdXRoOiBBdXRoU2VydmljZSxcbiAgICBwcml2YXRlIGZpbGVTZXJ2aWNlOiBNZXNzYWdpbmdGaWxlU2VydmljZSxcbiAgICBwcml2YXRlIGNkcjogQ2hhbmdlRGV0ZWN0b3JSZWYsXG4gICkge31cblxuICBuZ09uSW5pdCgpOiB2b2lkIHtcbiAgICB0aGlzLm15Q29udGFjdElkID0gdGhpcy5hdXRoLmNvbnRhY3RJZDtcblxuICAgIHRoaXMuc3ViID0gY29tYmluZUxhdGVzdChbXG4gICAgICB0aGlzLnN0b3JlLmFjdGl2ZUNvbnZlcnNhdGlvbklkLFxuICAgICAgdGhpcy5zdG9yZS5tZXNzYWdlc01hcCxcbiAgICAgIHRoaXMuc3RvcmUub3BlbkNoYXRzLFxuICAgICAgdGhpcy5zdG9yZS52aXNpYmxlQ29udGFjdHMsXG4gICAgICB0aGlzLnN0b3JlLmxvYWRpbmdNZXNzYWdlcyxcbiAgICBdKS5zdWJzY3JpYmUoKFtjb252SWQsIG1zZ01hcCwgY2hhdHMsIGNvbnRhY3RzLCBsb2FkaW5nXSkgPT4ge1xuICAgICAgdGhpcy5sb2FkaW5nID0gbG9hZGluZztcbiAgICAgIHRoaXMudmlzaWJsZUNvbnRhY3RzID0gY29udGFjdHMgfHwgW107XG5cbiAgICAgIGlmIChjb252SWQgJiYgY29udklkICE9PSB0aGlzLmNvbnZlcnNhdGlvbklkKSB7XG4gICAgICAgIHRoaXMuY29udmVyc2F0aW9uSWQgPSBjb252SWQ7XG4gICAgICAgIHRoaXMuc2hvdWxkU2Nyb2xsVG9Cb3R0b20gPSB0cnVlO1xuICAgICAgICBjb25zdCBjaGF0ID0gY2hhdHMuZmluZCgoYykgPT4gYy5jb252ZXJzYXRpb25JZCA9PT0gY29udklkKTtcbiAgICAgICAgdGhpcy5jb252ZXJzYXRpb25OYW1lID0gY2hhdD8ubmFtZSB8fCAnQ2hhdCc7XG4gICAgICAgIHRoaXMuaXNHcm91cCA9IGNoYXQ/LmlzR3JvdXAgfHwgZmFsc2U7XG4gICAgICB9XG5cbiAgICAgIGlmICh0aGlzLmNvbnZlcnNhdGlvbklkKSB7XG4gICAgICAgIGNvbnN0IHByZXZMZW4gPSB0aGlzLm1lc3NhZ2VzLmxlbmd0aDtcbiAgICAgICAgdGhpcy5tZXNzYWdlcyA9IG1zZ01hcC5nZXQodGhpcy5jb252ZXJzYXRpb25JZCkgfHwgW107XG4gICAgICAgIGlmICh0aGlzLm1lc3NhZ2VzLmxlbmd0aCA+IHByZXZMZW4pIHtcbiAgICAgICAgICB0aGlzLnNob3VsZFNjcm9sbFRvQm90dG9tID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICAvLyBQcmUtd2FybSBtZWRpYSBjYWNoZSBmb3IgYW55IGltYWdlL2ZpbGUgbWVzc2FnZXMgdmlzaWJsZVxuICAgICAgICB0aGlzLnByZXdhcm1NZWRpYSh0aGlzLm1lc3NhZ2VzKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIG5nQWZ0ZXJWaWV3Q2hlY2tlZCgpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5zaG91bGRTY3JvbGxUb0JvdHRvbSkge1xuICAgICAgdGhpcy5zY3JvbGxUb0JvdHRvbSgpO1xuICAgICAgdGhpcy5zaG91bGRTY3JvbGxUb0JvdHRvbSA9IGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIG5nT25EZXN0cm95KCk6IHZvaWQge1xuICAgIHRoaXMuc3ViPy51bnN1YnNjcmliZSgpO1xuICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIHRoaXMuYm91bmRMYk1vdmUpO1xuICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCB0aGlzLmJvdW5kTGJFbmQpO1xuICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIHRoaXMuYm91bmRMYlJlc2l6ZU1vdmUpO1xuICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCB0aGlzLmJvdW5kTGJSZXNpemVFbmQpO1xuICB9XG5cbiAgZ29CYWNrKCk6IHZvaWQge1xuICAgIHRoaXMuc3RvcmUuc2V0VmlldygnaW5ib3gnKTtcbiAgfVxuXG4gIG9uQ2xlYXJDb252ZXJzYXRpb24oKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuY29udmVyc2F0aW9uSWQpIHtcbiAgICAgIHRoaXMuc3RvcmUuY2xlYXJDb252ZXJzYXRpb24odGhpcy5jb252ZXJzYXRpb25JZCk7XG4gICAgfVxuICB9XG5cbiAgb25EZWxldGVDb252ZXJzYXRpb24oKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuY29udmVyc2F0aW9uSWQpIHtcbiAgICAgIHRoaXMuc3RvcmUuZGVsZXRlQ29udmVyc2F0aW9uKHRoaXMuY29udmVyc2F0aW9uSWQpO1xuICAgIH1cbiAgfVxuXG4gIG9uR3JvdXBTZXR0aW5ncygpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5jb252ZXJzYXRpb25JZCkge1xuICAgICAgdGhpcy5zdG9yZS5vcGVuR3JvdXBTZXR0aW5ncyh0aGlzLmNvbnZlcnNhdGlvbklkLCB0aGlzLmNvbnZlcnNhdGlvbk5hbWUpO1xuICAgIH1cbiAgfVxuXG4gIG9uU2VuZE1lc3NhZ2UoY29udGVudDogc3RyaW5nKTogdm9pZCB7XG4gICAgdGhpcy5zdG9yZS5zZW5kTWVzc2FnZSh0aGlzLmNvbnZlcnNhdGlvbklkLCBjb250ZW50KTtcbiAgICB0aGlzLnNob3VsZFNjcm9sbFRvQm90dG9tID0gdHJ1ZTtcbiAgfVxuXG4gIG9uU2VuZFdpdGhGaWxlcyhwYXlsb2FkOiBNZXNzYWdlUGF5bG9hZCk6IHZvaWQge1xuICAgIGlmICghdGhpcy5jb252ZXJzYXRpb25JZCB8fCAhdGhpcy5hdXRoLmNvbnRhY3RJZCkgcmV0dXJuO1xuICAgIHRoaXMudXBsb2FkaW5nID0gdHJ1ZTtcblxuICAgIC8vIFN0ZXAgMTogVXBsb2FkIGFsbCBmaWxlcyBhbmQgb2J0YWluIHJlYWwgZmlsZV9pZHMgZnJvbSB0aGUgc2VydmVyLlxuICAgIC8vIFRlbXAgSURzIGFyZSBORVZFUiBzZW50IHRvIGFueSBBUEkg4oCUIHdlIHdhaXQgZm9yIHJlYWwgSURzIGhlcmUuXG4gICAgdGhpcy5maWxlU2VydmljZS51cGxvYWRGaWxlcyhwYXlsb2FkLmZpbGVzKS5zdWJzY3JpYmUoe1xuICAgICAgbmV4dDogKHJlc3BvbnNlcykgPT4ge1xuICAgICAgICBjb25zdCBmaWxlSWRzICAgPSByZXNwb25zZXMubWFwKChyKSA9PiByLmZpbGVfaWQpO1xuICAgICAgICBjb25zdCBmaWxlbmFtZXMgPSByZXNwb25zZXMubWFwKChyKSA9PiByLmZpbGVuYW1lKTtcblxuICAgICAgICAvLyBHdWFyZDogZW5zdXJlIGFsbCBJRHMgYXJlIHJlYWwgKG5vdCB0ZW1wKVxuICAgICAgICBjb25zdCBoYXNUZW1wID0gZmlsZUlkcy5zb21lKGlkID0+IGlkPy5zdGFydHNXaXRoKCd0ZW1wLScpKTtcbiAgICAgICAgaWYgKGhhc1RlbXApIHtcbiAgICAgICAgICB0aGlzLnVwbG9hZGluZyA9IGZhbHNlO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFN0ZXAgMjogUHJlLXdhcm0gaW1hZ2UgY2FjaGUgc28gdGhlIG9wdGltaXN0aWMgYnViYmxlIHJlbmRlcnMgaW1tZWRpYXRlbHkuXG4gICAgICAgIHRoaXMuZmlsZVNlcnZpY2UucHJld2FybUNhY2hlKGZpbGVJZHMpO1xuXG4gICAgICAgIC8vIFN0ZXAgMzogU2VuZCB0aGUgbWVzc2FnZSB3aXRoIHRoZSByZWFsIGZpbGVfaWRzLlxuICAgICAgICB0aGlzLmZpbGVTZXJ2aWNlXG4gICAgICAgICAgLnNlbmRNZXNzYWdlV2l0aEF0dGFjaG1lbnRzKFxuICAgICAgICAgICAgdGhpcy5jb252ZXJzYXRpb25JZCEsXG4gICAgICAgICAgICB0aGlzLmF1dGguY29udGFjdElkISxcbiAgICAgICAgICAgIHBheWxvYWQudGV4dCB8fCBmaWxlbmFtZXMuam9pbignLCAnKSxcbiAgICAgICAgICAgIGZpbGVJZHMsXG4gICAgICAgICAgICBmaWxlbmFtZXNcbiAgICAgICAgICApXG4gICAgICAgICAgLnN1YnNjcmliZSh7XG4gICAgICAgICAgICBuZXh0OiAocmVzOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgdGhpcy51cGxvYWRpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgICAgdGhpcy5zaG91bGRTY3JvbGxUb0JvdHRvbSA9IHRydWU7XG5cbiAgICAgICAgICAgICAgLy8gQWRkIG9wdGltaXN0aWMgbWVzc2FnZSBzbyB0aGUgaW1hZ2UgYXBwZWFycyBpbnN0YW50bHkg4oCUXG4gICAgICAgICAgICAgIC8vIHRoZSBXZWJTb2NrZXQgZXZlbnQgbWF5IGFycml2ZSBhIG1vbWVudCBsYXRlciBhbmQgZGVkdXAgaXQuXG4gICAgICAgICAgICAgIGNvbnN0IGZpcnN0SWQgPSBmaWxlSWRzWzBdIHx8ICcnO1xuICAgICAgICAgICAgICBjb25zdCBpc0ltZyA9IC9cXC4ocG5nfGpwZT9nfGdpZnx3ZWJwfGJtcHxzdmcpJC9pLnRlc3QoZmlsZW5hbWVzWzBdIHx8ICcnKTtcbiAgICAgICAgICAgICAgY29uc3Qgb3B0aW1pc3RpYzogYW55ID0ge1xuICAgICAgICAgICAgICAgIG1lc3NhZ2VfaWQ6IHJlcz8ubWVzc2FnZV9pZCA/IFN0cmluZyhyZXMubWVzc2FnZV9pZCkgOiAndGVtcC0nICsgRGF0ZS5ub3coKSxcbiAgICAgICAgICAgICAgICBjb252ZXJzYXRpb25faWQ6IHRoaXMuY29udmVyc2F0aW9uSWQhLFxuICAgICAgICAgICAgICAgIHNlbmRlcl9pZDogdGhpcy5hdXRoLmNvbnRhY3RJZCEsXG4gICAgICAgICAgICAgICAgc2VuZGVyX25hbWU6ICdZb3UnLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2VfdHlwZTogaXNJbWcgPyAnSU1BR0UnIDogJ0ZJTEUnLFxuICAgICAgICAgICAgICAgIGNvbnRlbnQ6IHBheWxvYWQudGV4dCB8fCBmaWxlbmFtZXMuam9pbignLCAnKSxcbiAgICAgICAgICAgICAgICBtZWRpYV91cmw6IGZpcnN0SWQsXG4gICAgICAgICAgICAgICAgY3JlYXRlZF9hdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICAgICAgICAgIGlzX3JlYWQ6IHRydWUsXG4gICAgICAgICAgICAgICAgYXR0YWNobWVudHM6IGZpbGVJZHMubWFwKChpZCwgaWR4KSA9PiAoe1xuICAgICAgICAgICAgICAgICAgZmlsZV9pZDogaWQsXG4gICAgICAgICAgICAgICAgICBmaWxlbmFtZTogZmlsZW5hbWVzW2lkeF0gfHwgZmlsZW5hbWVzWzBdIHx8IGBBdHRhY2htZW50ICR7aWR4ICsgMX1gLFxuICAgICAgICAgICAgICAgIH0pKSxcbiAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgdGhpcy5zdG9yZS5hcHBlbmRPcHRpbWlzdGljTWVzc2FnZShvcHRpbWlzdGljKTtcbiAgICAgICAgICAgICAgdGhpcy5jZHIubWFya0ZvckNoZWNrKCk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZXJyb3I6ICgpID0+IHtcbiAgICAgICAgICAgICAgdGhpcy51cGxvYWRpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSk7XG4gICAgICB9LFxuICAgICAgZXJyb3I6ICgpID0+IHtcbiAgICAgICAgdGhpcy51cGxvYWRpbmcgPSBmYWxzZTtcbiAgICAgIH0sXG4gICAgfSk7XG4gIH1cblxuICBsb2FkT2xkZXIoKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuY29udmVyc2F0aW9uSWQgJiYgdGhpcy5tZXNzYWdlcy5sZW5ndGggPiAwKSB7XG4gICAgICB0aGlzLnN0b3JlLmxvYWRNZXNzYWdlcyh0aGlzLmNvbnZlcnNhdGlvbklkLCB0aGlzLm1lc3NhZ2VzWzBdLm1lc3NhZ2VfaWQpO1xuICAgIH1cbiAgfVxuXG4gIG9uU2Nyb2xsKCk6IHZvaWQge31cblxuICBzaG91bGRTaG93RGF0ZVNlcGFyYXRvcihpbmRleDogbnVtYmVyKTogYm9vbGVhbiB7XG4gICAgaWYgKGluZGV4ID09PSAwKSByZXR1cm4gdHJ1ZTtcbiAgICBjb25zdCBjdXJyID0gbmV3IERhdGUodGhpcy5tZXNzYWdlc1tpbmRleF0uY3JlYXRlZF9hdCkudG9EYXRlU3RyaW5nKCk7XG4gICAgY29uc3QgcHJldiA9IG5ldyBEYXRlKHRoaXMubWVzc2FnZXNbaW5kZXggLSAxXS5jcmVhdGVkX2F0KS50b0RhdGVTdHJpbmcoKTtcbiAgICByZXR1cm4gY3VyciAhPT0gcHJldjtcbiAgfVxuXG4gIHNob3VsZFNob3dTZW5kZXIoaW5kZXg6IG51bWJlcik6IGJvb2xlYW4ge1xuICAgIGlmIChpbmRleCA9PT0gMCkgcmV0dXJuIHRydWU7XG4gICAgcmV0dXJuIHRoaXMubWVzc2FnZXNbaW5kZXhdLnNlbmRlcl9pZCAhPT0gdGhpcy5tZXNzYWdlc1tpbmRleCAtIDFdLnNlbmRlcl9pZDtcbiAgfVxuXG4gIGlzT3duTWVzc2FnZShtc2c6IE1lc3NhZ2UpOiBib29sZWFuIHtcbiAgICByZXR1cm4gU3RyaW5nKG1zZy5zZW5kZXJfaWQpID09PSBTdHJpbmcodGhpcy5teUNvbnRhY3RJZCk7XG4gIH1cblxuICBnZXRTZW5kZXJOYW1lKG1zZzogTWVzc2FnZSk6IHN0cmluZyB7XG4gICAgY29uc3QgZnJvbU1lc3NhZ2UgPSBnZXRNZXNzYWdlU2VuZGVyTmFtZShtc2cpO1xuICAgIGlmIChmcm9tTWVzc2FnZSAmJiBmcm9tTWVzc2FnZSAhPT0gJ1Vua25vd24nKSB7XG4gICAgICByZXR1cm4gZnJvbU1lc3NhZ2U7XG4gICAgfVxuXG4gICAgY29uc3QgZnJvbUNvbnRhY3RzID0gdGhpcy52aXNpYmxlQ29udGFjdHMuZmluZChcbiAgICAgIChjKSA9PiBTdHJpbmcoYy5jb250YWN0X2lkKSA9PT0gU3RyaW5nKG1zZy5zZW5kZXJfaWQpXG4gICAgKTtcbiAgICBpZiAoZnJvbUNvbnRhY3RzKSB7XG4gICAgICByZXR1cm4gZ2V0Q29udGFjdERpc3BsYXlOYW1lKGZyb21Db250YWN0cyk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuaXNPd25NZXNzYWdlKG1zZykpIHtcbiAgICAgIHJldHVybiAnWW91JztcbiAgICB9XG5cbiAgICByZXR1cm4gYFVzZXIgJHttc2cuc2VuZGVyX2lkfWA7XG4gIH1cblxuICBmb3JtYXRUaW1lKGRhdGVTdHI6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgaWYgKCFkYXRlU3RyKSByZXR1cm4gJyc7XG4gICAgY29uc3QgZCA9IG5ldyBEYXRlKGRhdGVTdHIpO1xuICAgIHJldHVybiBkLnRvTG9jYWxlVGltZVN0cmluZygnZW4tR0InLCB7IGhvdXI6ICcyLWRpZ2l0JywgbWludXRlOiAnMi1kaWdpdCcgfSk7XG4gIH1cblxuICBmb3JtYXREYXRlKGRhdGVTdHI6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgY29uc3QgZCA9IG5ldyBEYXRlKGRhdGVTdHIpO1xuICAgIGNvbnN0IHRvZGF5ID0gbmV3IERhdGUoKTtcbiAgICBjb25zdCB5ZXN0ZXJkYXkgPSBuZXcgRGF0ZSh0b2RheSk7XG4gICAgeWVzdGVyZGF5LnNldERhdGUoeWVzdGVyZGF5LmdldERhdGUoKSAtIDEpO1xuXG4gICAgaWYgKGQudG9EYXRlU3RyaW5nKCkgPT09IHRvZGF5LnRvRGF0ZVN0cmluZygpKSByZXR1cm4gJ1RvZGF5JztcbiAgICBpZiAoZC50b0RhdGVTdHJpbmcoKSA9PT0geWVzdGVyZGF5LnRvRGF0ZVN0cmluZygpKSByZXR1cm4gJ1llc3RlcmRheSc7XG4gICAgcmV0dXJuIGQudG9Mb2NhbGVEYXRlU3RyaW5nKCdlbi1HQicsIHsgZGF5OiAnbnVtZXJpYycsIG1vbnRoOiAnc2hvcnQnLCB5ZWFyOiAnbnVtZXJpYycgfSk7XG4gIH1cblxuICBwcml2YXRlIHNjcm9sbFRvQm90dG9tKCk6IHZvaWQge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBlbCA9IHRoaXMuc2Nyb2xsQ29udGFpbmVyPy5uYXRpdmVFbGVtZW50O1xuICAgICAgaWYgKGVsKSB7XG4gICAgICAgIGVsLnNjcm9sbFRvcCA9IGVsLnNjcm9sbEhlaWdodDtcbiAgICAgIH1cbiAgICB9IGNhdGNoIHsgLyogaWdub3JlICovIH1cbiAgfVxuXG4gIC8vIOKUgOKUgCBNZWRpYSBoZWxwZXJzIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuXG4gIHByaXZhdGUgZ2V0RmlsZW5hbWVMaWtlKG1zZzogTWVzc2FnZSk6IHN0cmluZyB7XG4gICAgY29uc3QgYW55TXNnID0gbXNnIGFzIGFueTtcbiAgICByZXR1cm4gU3RyaW5nKFxuICAgICAgdGhpcy5nZXRQcmltYXJ5QXR0YWNobWVudChtc2cpPy5maWxlbmFtZSB8fFxuICAgICAgYW55TXNnPy5maWxlbmFtZSB8fFxuICAgICAgYW55TXNnPy5maWxlX25hbWUgfHxcbiAgICAgIG1zZy5jb250ZW50IHx8XG4gICAgICAnJ1xuICAgICkudG9Mb3dlckNhc2UoKTtcbiAgfVxuXG4gIC8qKiBSZXR1cm5zIHRoZSBwcmltYXJ5IGF0dGFjaG1lbnQgZm9yIGEgbWVzc2FnZSwgaWYgYW55LiAqL1xuICBwcml2YXRlIGdldFByaW1hcnlBdHRhY2htZW50KG1zZzogTWVzc2FnZSk6IEF0dGFjaG1lbnQgfCBudWxsIHtcbiAgICBpZiAobXNnLmF0dGFjaG1lbnRzICYmIG1zZy5hdHRhY2htZW50cy5sZW5ndGggPiAwKSByZXR1cm4gbXNnLmF0dGFjaG1lbnRzWzBdO1xuXG4gICAgLy8gU29tZSBBUEkgcmVzcG9uc2VzIHByb3ZpZGUgZmlsZSBtZXRhZGF0YSBpbiBhbHRlcm5hdGUgZmllbGRzLlxuICAgIGNvbnN0IGFueU1zZyA9IG1zZyBhcyBhbnk7XG4gICAgY29uc3QgbXUgPSBTdHJpbmcobXNnLm1lZGlhX3VybCB8fCAnJykudHJpbSgpO1xuICAgIGNvbnN0IG1lZGlhSXNEaXJlY3RVcmwgPVxuICAgICAgbXUuc3RhcnRzV2l0aCgnaHR0cDovLycpIHx8IG11LnN0YXJ0c1dpdGgoJ2h0dHBzOi8vJykgfHwgbXUuc3RhcnRzV2l0aCgnZGF0YTonKTtcbiAgICBjb25zdCBmaWxlSWQgPVxuICAgICAgYW55TXNnPy5maWxlX2lkIHx8XG4gICAgICBhbnlNc2c/LmF0dGFjaG1lbnRfaWQgfHxcbiAgICAgIGFueU1zZz8uYXR0YWNobWVudF9pZHM/LlswXSB8fFxuICAgICAgKCFtZWRpYUlzRGlyZWN0VXJsICYmIG11ID8gbXUgOiB1bmRlZmluZWQpO1xuICAgIGNvbnN0IGZpbGVuYW1lID0gYW55TXNnPy5maWxlbmFtZSB8fCBhbnlNc2c/LmZpbGVfbmFtZSB8fCBtc2cuY29udGVudDtcbiAgICBjb25zdCBtaW1lID0gYW55TXNnPy5taW1lX3R5cGUgfHwgYW55TXNnPy5hdHRhY2htZW50X21pbWVfdHlwZTtcbiAgICBpZiAoZmlsZUlkIHx8IGZpbGVuYW1lIHx8IG1pbWUpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGZpbGVfaWQ6IFN0cmluZyhmaWxlSWQgfHwgJycpLFxuICAgICAgICBmaWxlbmFtZTogU3RyaW5nKGZpbGVuYW1lIHx8ICdGaWxlJyksXG4gICAgICAgIG1pbWVfdHlwZTogbWltZSA/IFN0cmluZyhtaW1lKSA6IHVuZGVmaW5lZCxcbiAgICAgICAgdXJsOiBtZWRpYUlzRGlyZWN0VXJsID8gbXUgOiB1bmRlZmluZWQsXG4gICAgICB9O1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIGlzSW1hZ2VBdHRhY2htZW50KG1zZzogTWVzc2FnZSk6IGJvb2xlYW4ge1xuICAgIGlmIChtc2cubWVzc2FnZV90eXBlID09PSAnSU1BR0UnKSByZXR1cm4gdHJ1ZTtcbiAgICBjb25zdCBtaW1lID0gdGhpcy5nZXRQcmltYXJ5QXR0YWNobWVudChtc2cpPy5taW1lX3R5cGUgfHwgJyc7XG4gICAgaWYgKG1pbWUuc3RhcnRzV2l0aCgnaW1hZ2UvJykpIHJldHVybiB0cnVlO1xuICAgIGNvbnN0IG5hbWUgPSB0aGlzLmdldEZpbGVuYW1lTGlrZShtc2cpO1xuICAgIHJldHVybiAvXFwuKHBuZ3xqcGU/Z3xnaWZ8d2VicHxibXB8c3ZnfGhlaWN8aGVpZikkL2kudGVzdChuYW1lKTtcbiAgfVxuXG4gIC8qKiBSZXR1cm5zIHRoZSBjYWNoZWQgZGF0YSBVUkwgZm9yIGEgbWVzc2FnZSdzIG1lZGlhLCBvciBudWxsIGFuZCB0cmlnZ2VycyBiYWNrZ3JvdW5kIGxvYWQuICovXG4gIGdldE1lZGlhVXJsKG1zZzogTWVzc2FnZSk6IHN0cmluZyB8IG51bGwge1xuICAgIGNvbnN0IGF0dCA9IHRoaXMuZ2V0UHJpbWFyeUF0dGFjaG1lbnQobXNnKTtcbiAgICBjb25zdCBmaWxlSWQgPSBhdHQ/LmZpbGVfaWQ/LnRyaW0oKTtcblxuICAgIGNvbnN0IGRpcmVjdFVybCA9XG4gICAgICBhdHQ/LnVybCB8fFxuICAgICAgbXNnLm1lZGlhX3VybCB8fFxuICAgICAgKG1zZyBhcyBhbnkpPy51cmwgfHxcbiAgICAgIChtc2cgYXMgYW55KT8uZmlsZV91cmw7XG4gICAgaWYgKFxuICAgICAgZGlyZWN0VXJsICYmXG4gICAgICAoZGlyZWN0VXJsLnN0YXJ0c1dpdGgoJ2h0dHA6Ly8nKSB8fFxuICAgICAgICBkaXJlY3RVcmwuc3RhcnRzV2l0aCgnaHR0cHM6Ly8nKSB8fFxuICAgICAgICBkaXJlY3RVcmwuc3RhcnRzV2l0aCgnZGF0YTonKSlcbiAgICApIHtcbiAgICAgIHJldHVybiBkaXJlY3RVcmw7XG4gICAgfVxuXG4gICAgaWYgKCFmaWxlSWQpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IGNhY2hlZCA9IHRoaXMuZmlsZVNlcnZpY2UuZ2V0Q2FjaGVkRGF0YVVybChmaWxlSWQpO1xuICAgIGlmIChjYWNoZWQpIHJldHVybiBjYWNoZWQ7XG5cbiAgICAvLyBOb3QgeWV0IGNhY2hlZCDigJQga2ljayBvZmYgYSBiYWNrZ3JvdW5kIGZldGNoXG4gICAgdGhpcy5mZXRjaE1lZGlhKGZpbGVJZCk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBwcml2YXRlIHByZXdhcm1NZWRpYShtZXNzYWdlczogTWVzc2FnZVtdKTogdm9pZCB7XG4gICAgZm9yIChjb25zdCBtc2cgb2YgbWVzc2FnZXMpIHtcbiAgICAgIGlmICghdGhpcy5pc0ltYWdlQXR0YWNobWVudChtc2cpICYmICF0aGlzLmlzVmlkZW9BdHRhY2htZW50KG1zZykpIGNvbnRpbnVlO1xuICAgICAgY29uc3QgZmlsZUlkID0gdGhpcy5nZXRQcmltYXJ5QXR0YWNobWVudChtc2cpPy5maWxlX2lkPy50cmltKCk7XG4gICAgICBpZiAoZmlsZUlkICYmICFmaWxlSWQuc3RhcnRzV2l0aCgndGVtcC0nKSAmJiAhdGhpcy5maWxlU2VydmljZS5nZXRDYWNoZWREYXRhVXJsKGZpbGVJZCkpIHtcbiAgICAgICAgdGhpcy5mZXRjaE1lZGlhKGZpbGVJZCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBmZXRjaE1lZGlhKGZpbGVJZDogc3RyaW5nKTogdm9pZCB7XG4gICAgaWYgKCFmaWxlSWQgfHwgZmlsZUlkLnN0YXJ0c1dpdGgoJ3RlbXAtJykgfHwgdGhpcy5tZWRpYUxvYWRpbmcuaGFzKGZpbGVJZCkpIHJldHVybjtcbiAgICB0aGlzLm1lZGlhRmFpbGVkLmRlbGV0ZShmaWxlSWQpO1xuICAgIHRoaXMubWVkaWFMb2FkaW5nLmFkZChmaWxlSWQpO1xuXG4gICAgdGhpcy5maWxlU2VydmljZS5nZXRGaWxlRGF0YVVybChmaWxlSWQpLnN1YnNjcmliZSh7XG4gICAgICBuZXh0OiAoKSA9PiB7XG4gICAgICAgIHRoaXMubWVkaWFMb2FkaW5nLmRlbGV0ZShmaWxlSWQpO1xuICAgICAgICB0aGlzLmNkci5tYXJrRm9yQ2hlY2soKTtcbiAgICAgIH0sXG4gICAgICBlcnJvcjogKCkgPT4ge1xuICAgICAgICB0aGlzLm1lZGlhTG9hZGluZy5kZWxldGUoZmlsZUlkKTtcbiAgICAgICAgdGhpcy5tZWRpYUZhaWxlZC5hZGQoZmlsZUlkKTtcbiAgICAgICAgdGhpcy5jZHIubWFya0ZvckNoZWNrKCk7XG4gICAgICB9LFxuICAgIH0pO1xuICB9XG5cbiAgc2hvdWxkU2hvd01lZGlhU3Bpbm5lcihtc2c6IE1lc3NhZ2UpOiBib29sZWFuIHtcbiAgICBjb25zdCBmaWxlSWQgPSB0aGlzLmdldFByaW1hcnlBdHRhY2htZW50KG1zZyk/LmZpbGVfaWQ7XG4gICAgaWYgKCFmaWxlSWQgfHwgZmlsZUlkLnN0YXJ0c1dpdGgoJ3RlbXAtJykpIHJldHVybiBmYWxzZTtcbiAgICByZXR1cm4gdGhpcy5tZWRpYUxvYWRpbmcuaGFzKGZpbGVJZCkgJiYgIXRoaXMubWVkaWFGYWlsZWQuaGFzKGZpbGVJZCk7XG4gIH1cblxuICBpc1ZpZGVvQXR0YWNobWVudChtc2c6IE1lc3NhZ2UpOiBib29sZWFuIHtcbiAgICBjb25zdCBtaW1lID0gdGhpcy5nZXRQcmltYXJ5QXR0YWNobWVudChtc2cpPy5taW1lX3R5cGUgfHwgJyc7XG4gICAgaWYgKG1pbWUuc3RhcnRzV2l0aCgndmlkZW8vJykpIHJldHVybiB0cnVlO1xuICAgIGNvbnN0IG5hbWUgPSB0aGlzLmdldEZpbGVuYW1lTGlrZShtc2cpO1xuICAgIHJldHVybiAvXFwuKG1wNHx3ZWJtfG1vdnxtNHZ8YXZpfG1rdikkL2kudGVzdChuYW1lKTtcbiAgfVxuXG4gIGdldEF0dGFjaG1lbnRNaW1lVHlwZShtc2c6IE1lc3NhZ2UpOiBzdHJpbmcge1xuICAgIHJldHVybiB0aGlzLmdldFByaW1hcnlBdHRhY2htZW50KG1zZyk/Lm1pbWVfdHlwZSB8fCAnYXBwbGljYXRpb24vb2N0ZXQtc3RyZWFtJztcbiAgfVxuXG4gIGdldEF0dGFjaG1lbnROYW1lKG1zZzogTWVzc2FnZSk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHRoaXMuZ2V0UHJpbWFyeUF0dGFjaG1lbnQobXNnKT8uZmlsZW5hbWUgfHwgbXNnLmNvbnRlbnQgfHwgJ0ZpbGUnO1xuICB9XG5cbiAgb3BlbkxpZ2h0Ym94KGRhdGFVcmw6IHN0cmluZyk6IHZvaWQge1xuICAgIHRoaXMubGlnaHRib3hVcmwgPSBkYXRhVXJsO1xuICAgIHRoaXMubGlnaHRib3hEZXRhY2hlZCA9IGZhbHNlO1xuICB9XG5cbiAgLyoqIEZ1bGxzY3JlZW4gbW9kZTogb25seSBjbG9zZSB3aGVuIHRoZSBkaW1tZWQgYmFja2Ryb3AgaXMgY2xpY2tlZCwgbm90IGFmdGVyIHRvb2xiYXIgYWN0aW9ucy4gKi9cbiAgb25MaWdodGJveEJhY2tkcm9wQ2xpY2soZXZlbnQ6IE1vdXNlRXZlbnQpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5saWdodGJveERldGFjaGVkKSByZXR1cm47XG4gICAgaWYgKGV2ZW50LnRhcmdldCAhPT0gZXZlbnQuY3VycmVudFRhcmdldCkgcmV0dXJuO1xuICAgIHRoaXMubGlnaHRib3hVcmwgPSBudWxsO1xuICB9XG5cbiAgZXhwYW5kTGlnaHRib3goKTogdm9pZCB7XG4gICAgdGhpcy5saWdodGJveERldGFjaGVkID0gZmFsc2U7XG4gICAgdGhpcy5jZHIubWFya0ZvckNoZWNrKCk7XG4gIH1cblxuICBjbG9zZUxpZ2h0Ym94KCk6IHZvaWQge1xuICAgIHRoaXMubGlnaHRib3hVcmwgPSBudWxsO1xuICAgIHRoaXMubGlnaHRib3hEZXRhY2hlZCA9IGZhbHNlO1xuICB9XG5cbiAgZGV0YWNoTGlnaHRib3goKTogdm9pZCB7XG4gICAgdGhpcy5saWdodGJveERldGFjaGVkID0gdHJ1ZTtcbiAgICB0aGlzLmxpZ2h0Ym94WCA9IE1hdGgubWF4KDIwLCBNYXRoLnJvdW5kKCh3aW5kb3cuaW5uZXJXaWR0aCAgLSB0aGlzLmxpZ2h0Ym94VykgLyAyKSk7XG4gICAgdGhpcy5saWdodGJveFkgPSBNYXRoLm1heCgyMCwgTWF0aC5yb3VuZCgod2luZG93LmlubmVySGVpZ2h0IC0gdGhpcy5saWdodGJveEgpIC8gMikpO1xuICB9XG5cbiAgb25MaWdodGJveERyYWdTdGFydChldmVudDogTW91c2VFdmVudCk6IHZvaWQge1xuICAgIGlmICgoZXZlbnQudGFyZ2V0IGFzIEhUTUxFbGVtZW50KS5jbG9zZXN0KCdidXR0b24nKSkgcmV0dXJuO1xuICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgdGhpcy5sYkRyYWdnaW5nID0gdHJ1ZTtcbiAgICB0aGlzLmxiRHJhZ09mZlggPSBldmVudC5jbGllbnRYIC0gdGhpcy5saWdodGJveFg7XG4gICAgdGhpcy5sYkRyYWdPZmZZID0gZXZlbnQuY2xpZW50WSAtIHRoaXMubGlnaHRib3hZO1xuICAgIGRvY3VtZW50LmJvZHkuc3R5bGUudXNlclNlbGVjdCA9ICdub25lJztcbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCB0aGlzLmJvdW5kTGJNb3ZlKTtcbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgICB0aGlzLmJvdW5kTGJFbmQpO1xuICB9XG5cbiAgcHJpdmF0ZSBvbkxpZ2h0Ym94RHJhZ01vdmUoZXZlbnQ6IE1vdXNlRXZlbnQpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMubGJEcmFnZ2luZykgcmV0dXJuO1xuICAgIHRoaXMubGlnaHRib3hYID0gTWF0aC5tYXgoMCwgTWF0aC5taW4oZXZlbnQuY2xpZW50WCAtIHRoaXMubGJEcmFnT2ZmWCwgd2luZG93LmlubmVyV2lkdGggIC0gdGhpcy5saWdodGJveFcpKTtcbiAgICB0aGlzLmxpZ2h0Ym94WSA9IE1hdGgubWF4KDAsIE1hdGgubWluKGV2ZW50LmNsaWVudFkgLSB0aGlzLmxiRHJhZ09mZlksIHdpbmRvdy5pbm5lckhlaWdodCAtIDYwKSk7XG4gICAgdGhpcy5jZHIubWFya0ZvckNoZWNrKCk7XG4gIH1cblxuICBwcml2YXRlIG9uTGlnaHRib3hEcmFnRW5kKCk6IHZvaWQge1xuICAgIGlmICghdGhpcy5sYkRyYWdnaW5nKSByZXR1cm47XG4gICAgdGhpcy5sYkRyYWdnaW5nID0gZmFsc2U7XG4gICAgZG9jdW1lbnQuYm9keS5zdHlsZS51c2VyU2VsZWN0ID0gJyc7XG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgdGhpcy5ib3VuZExiTW92ZSk7XG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsICAgdGhpcy5ib3VuZExiRW5kKTtcbiAgfVxuXG4gIG9uTGlnaHRib3hSZXNpemVTdGFydChldmVudDogTW91c2VFdmVudCk6IHZvaWQge1xuICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgdGhpcy5sYlJlc2l6aW5nID0gdHJ1ZTtcbiAgICB0aGlzLmxiUmVzaXplU3RhcnRYID0gZXZlbnQuY2xpZW50WDtcbiAgICB0aGlzLmxiUmVzaXplU3RhcnRZID0gZXZlbnQuY2xpZW50WTtcbiAgICB0aGlzLmxiUmVzaXplU3RhcnRXID0gdGhpcy5saWdodGJveFc7XG4gICAgdGhpcy5sYlJlc2l6ZVN0YXJ0SCA9IHRoaXMubGlnaHRib3hIO1xuICAgIGRvY3VtZW50LmJvZHkuc3R5bGUuY3Vyc29yID0gJ3NlLXJlc2l6ZSc7XG4gICAgZG9jdW1lbnQuYm9keS5zdHlsZS51c2VyU2VsZWN0ID0gJ25vbmUnO1xuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIHRoaXMuYm91bmRMYlJlc2l6ZU1vdmUpO1xuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCAgIHRoaXMuYm91bmRMYlJlc2l6ZUVuZCk7XG4gIH1cblxuICBwcml2YXRlIG9uTGlnaHRib3hSZXNpemVNb3ZlKGV2ZW50OiBNb3VzZUV2ZW50KTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLmxiUmVzaXppbmcpIHJldHVybjtcbiAgICB0aGlzLmxpZ2h0Ym94VyA9IE1hdGgubWF4KDIwMCwgdGhpcy5sYlJlc2l6ZVN0YXJ0VyArIChldmVudC5jbGllbnRYIC0gdGhpcy5sYlJlc2l6ZVN0YXJ0WCkpO1xuICAgIHRoaXMubGlnaHRib3hIID0gTWF0aC5tYXgoMTgwLCB0aGlzLmxiUmVzaXplU3RhcnRIICsgKGV2ZW50LmNsaWVudFkgLSB0aGlzLmxiUmVzaXplU3RhcnRZKSk7XG4gICAgdGhpcy5jZHIubWFya0ZvckNoZWNrKCk7XG4gIH1cblxuICBwcml2YXRlIG9uTGlnaHRib3hSZXNpemVFbmQoKTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLmxiUmVzaXppbmcpIHJldHVybjtcbiAgICB0aGlzLmxiUmVzaXppbmcgPSBmYWxzZTtcbiAgICBkb2N1bWVudC5ib2R5LnN0eWxlLmN1cnNvciA9ICcnO1xuICAgIGRvY3VtZW50LmJvZHkuc3R5bGUudXNlclNlbGVjdCA9ICcnO1xuICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIHRoaXMuYm91bmRMYlJlc2l6ZU1vdmUpO1xuICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCAgIHRoaXMuYm91bmRMYlJlc2l6ZUVuZCk7XG4gIH1cblxuICAvLyDilIDilIAgUmVhY3Rpb25zIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuXG4gIG9uRW1vamlTZWxlY3RlZChlbW9qaTogc3RyaW5nLCBtZXNzYWdlSWQ6IHN0cmluZyk6IHZvaWQge1xuICAgIHRoaXMuc3RvcmUuYWRkUmVhY3Rpb24obWVzc2FnZUlkLCBlbW9qaSk7XG4gIH1cblxuICB0b2dnbGVSZWFjdGlvbihlbW9qaTogc3RyaW5nLCBtZXNzYWdlSWQ6IHN0cmluZyk6IHZvaWQge1xuICAgIGNvbnN0IG1zZyA9IHRoaXMubWVzc2FnZXMuZmluZChtID0+IG0ubWVzc2FnZV9pZCA9PT0gbWVzc2FnZUlkKTtcbiAgICBpZiAoIW1zZykgcmV0dXJuO1xuICAgIFxuICAgIGNvbnN0IHJlYWN0aW9uID0gbXNnLnJlYWN0aW9ucz8uZmluZChyID0+IHIuZW1vamkgPT09IGVtb2ppKTtcbiAgICBpZiAocmVhY3Rpb24/Lmhhc1JlYWN0ZWQpIHtcbiAgICAgIHRoaXMuc3RvcmUucmVtb3ZlUmVhY3Rpb24obWVzc2FnZUlkLCBlbW9qaSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuc3RvcmUuYWRkUmVhY3Rpb24obWVzc2FnZUlkLCBlbW9qaSk7XG4gICAgfVxuICB9XG5cbiAgZ2V0UmVhY3RvclRvb2x0aXAocmVhY3Rpb246IGFueSk6IHN0cmluZyB7XG4gICAgaWYgKCFyZWFjdGlvbj8ucmVhY3RvcnM/Lmxlbmd0aCkgcmV0dXJuICcnO1xuICAgIHJldHVybiByZWFjdGlvbi5yZWFjdG9ycy5qb2luKCcsICcpO1xuICB9XG59XG4iXX0=