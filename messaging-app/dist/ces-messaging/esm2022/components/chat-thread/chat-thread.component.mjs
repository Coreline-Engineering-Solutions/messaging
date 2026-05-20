import { Component, ViewChild, Output, EventEmitter, } from '@angular/core';
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
    messageInput;
    lightboxOpen = new EventEmitter();
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
    threadDragOver = false;
    threadDragDepth = 0;
    boundResetThreadDrag = this.resetThreadDrag.bind(this);
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
    ngAfterViewChecked() {
        if (this.shouldScrollToBottom) {
            this.scrollToBottom();
            this.shouldScrollToBottom = false;
        }
    }
    ngOnDestroy() {
        this.sub?.unsubscribe();
        document.removeEventListener('drop', this.boundResetThreadDrag, true);
        document.removeEventListener('dragend', this.boundResetThreadDrag, true);
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
                    .sendMessageWithAttachments(this.conversationId, this.auth.contactId, payload.text || filenames.join(', '), fileIds, filenames, mimeTypes)
                    .subscribe({
                    next: (res) => {
                        this.uploading = false;
                        this.shouldScrollToBottom = true;
                        // Add optimistic message so the image appears instantly —
                        // the WebSocket event may arrive a moment later and dedup it.
                        const firstId = fileIds[0] || '';
                        const isImg = (mimeTypes[0] || '').startsWith('image/') ||
                            /\.(png|jpe?g|gif|webp|bmp|svg|heic|heif)$/i.test(filenames[0] || '');
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
    loadOlder() {
        if (this.conversationId && this.messages.length > 0) {
            this.store.loadMessages(this.conversationId, this.messages[0].message_id);
        }
    }
    onScroll() { }
    onThreadDragEnter(event) {
        if (!this.dragHasFiles(event))
            return;
        event.preventDefault();
        event.stopPropagation();
        this.threadDragDepth++;
        this.threadDragOver = true;
    }
    onThreadDragOver(event) {
        if (!this.dragHasFiles(event))
            return;
        event.preventDefault();
        event.stopPropagation();
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = 'copy';
        }
        this.threadDragOver = true;
    }
    onThreadDragLeave(event) {
        if (!this.dragHasFiles(event))
            return;
        event.preventDefault();
        event.stopPropagation();
        this.threadDragDepth = Math.max(0, this.threadDragDepth - 1);
        this.threadDragOver = this.threadDragDepth > 0;
    }
    onThreadDrop(event) {
        if (!this.dragHasFiles(event))
            return;
        event.preventDefault();
        event.stopPropagation();
        this.resetThreadDrag();
        const files = event.dataTransfer?.files ? Array.from(event.dataTransfer.files) : [];
        this.messageInput?.addFiles(files);
    }
    resetThreadDrag() {
        this.threadDragDepth = 0;
        this.threadDragOver = false;
    }
    dragHasFiles(event) {
        const types = event.dataTransfer?.types;
        if (!types)
            return false;
        return Array.from(types).includes('Files');
    }
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
        const mime = anyMsg?.mime_type || anyMsg?.attachment_mime_type;
        const explicitFilename = anyMsg?.filename || anyMsg?.file_name;
        const filename = explicitFilename ||
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
            const att = this.getPrimaryAttachment(msg);
            const fileId = att?.file_id?.trim();
            if (!fileId || fileId.startsWith('temp-'))
                continue;
            if (this.fileService.getCachedDataUrl(fileId))
                continue;
            // Preload images and videos eagerly; queue other files so download links appear.
            this.fetchMedia(fileId);
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
    hasFileAttachment(msg) {
        return msg.message_type === 'FILE' || !!this.getPrimaryAttachment(msg);
    }
    hasMediaFailed(msg) {
        const fileId = this.getPrimaryAttachment(msg)?.file_id;
        return !!fileId && this.mediaFailed.has(fileId);
    }
    getFileIcon(msg) {
        const mime = this.getAttachmentMimeType(msg);
        const name = this.getAttachmentName(msg).toLowerCase();
        if (mime.startsWith('video/') || /\.(mp4|webm|mov|m4v|avi|mkv)$/i.test(name))
            return 'videocam';
        if (mime.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|flac)$/i.test(name))
            return 'audiotrack';
        if (mime.includes('pdf') || name.endsWith('.pdf'))
            return 'picture_as_pdf';
        if (mime.includes('spreadsheet') || mime.includes('excel') || /\.(xls|xlsx|csv)$/i.test(name))
            return 'table_chart';
        if (mime.includes('document') || mime.includes('word') || /\.(doc|docx|txt|rtf)$/i.test(name))
            return 'description';
        if (mime.includes('zip') || /\.(zip|rar|7z|tar|gz)$/i.test(name))
            return 'folder_zip';
        return 'insert_drive_file';
    }
    openLightbox(dataUrl) {
        this.lightboxOpen.emit(dataUrl);
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
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "17.3.12", type: ChatThreadComponent, isStandalone: true, selector: "app-chat-thread", outputs: { lightboxOpen: "lightboxOpen" }, viewQueries: [{ propertyName: "scrollContainer", first: true, predicate: ["scrollContainer"], descendants: true }, { propertyName: "messageInput", first: true, predicate: MessageInputComponent, descendants: true }], ngImport: i0, template: `
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

  `, isInline: true, styles: [".chat-thread{display:flex;flex-direction:column;height:100%;background:#041322;position:relative}.chat-thread.drag-over{outline:2px dashed rgba(255,255,255,.45);outline-offset:-6px}.thread-drag-overlay{position:absolute;inset:8px;z-index:20;pointer-events:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:#fff;background:#1f4bd852;border:2px dashed rgba(255,255,255,.55);border-radius:14px;font-size:14px;font-weight:600}.thread-drag-overlay mat-icon{font-size:36px;width:36px;height:36px}.chat-header{display:flex;align-items:center;padding:8px 8px 8px 4px;border-bottom:1px solid rgba(255,255,255,.15);gap:4px;flex-shrink:0}.chat-header button mat-icon{color:#fffc}.chat-name{font-size:16px;font-weight:600;color:#fff}.header-info{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;padding:0 4px}.header-actions{display:flex;gap:0}.header-actions button{width:32px;height:32px}.hdr-btn{border-radius:6px!important;transition:background .15s,box-shadow .15s}.hdr-btn:hover{background:#ffffff26!important;box-shadow:0 2px 8px #0003}.messages-area{flex:1;overflow-y:auto;padding:12px;background:transparent;scrollbar-width:none;-ms-overflow-style:none}.messages-area::-webkit-scrollbar{display:none}.loading-indicator{display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;color:#ffffffb3;font-size:13px}.load-more-btn{align-self:center;margin-bottom:16px;font-size:12px;color:#fff}.messages-list{display:flex;flex-direction:column;gap:1px;flex:1}.date-separator{text-align:center;margin:16px 0 8px;font-size:12px;color:#ffffffb3;font-weight:500}.message-bubble-row{display:flex;flex-direction:column;max-width:88%;margin-bottom:2px}.message-bubble-row.own{align-self:flex-end;align-items:flex-end}.message-bubble-row.other{align-self:flex-start;align-items:flex-start}.sender-name{font-size:11px;font-weight:700;color:#fffffff2;margin-bottom:3px;letter-spacing:.2px;padding:0 10px;text-shadow:0 1px 3px rgba(0,0,0,.4)}.message-bubble{padding:8px 14px 7px;border-radius:14px;font-size:13px;line-height:1.32;word-break:break-word;color:#f5f7ff;position:relative;display:inline-block;min-width:fit-content}.message-bubble-row.other .message-bubble{background:#0d2540;border-bottom-left-radius:5px;box-shadow:0 1px 4px #0006}.message-bubble.own-bubble{background:#0a3d62;border-bottom-right-radius:5px;box-shadow:0 1px 4px #0006}.image-message{line-height:0}.media-img{max-width:220px;max-height:280px;border-radius:10px;display:block;cursor:zoom-in;object-fit:cover;transition:opacity .15s}.media-img:hover{opacity:.88}.media-video{max-width:240px;max-height:260px;border-radius:10px;display:block;background:#000}.video-message{display:flex;flex-direction:column;gap:6px}.video-download{color:#ffffffc7;font-size:12px;text-decoration:underline;text-underline-offset:2px}.media-placeholder{display:flex;align-items:center;gap:8px;min-width:80px;min-height:44px;color:#fff9;font-size:11px}.media-load-label{font-size:11px;color:#fff9}.file-message{display:flex;align-items:center;gap:8px;padding:4px 0}.file-download{display:inline-flex;align-items:center;gap:8px;color:#fff;text-decoration:none;max-width:240px}.file-msg-icon{font-size:20px;width:20px;height:20px;color:#fffc}.file-msg-name{font-size:13px;color:#fff;word-break:break-all}.file-download-icon{font-size:18px;width:18px;height:18px;color:#ffffffb3;flex-shrink:0}.message-meta{display:flex;align-items:center;gap:4px;margin-top:3px}.msg-time{font-size:10px;color:#dae0faa8}.message-bubble-row.other .msg-time{color:#d8dff694}.read-icon{font-size:14px;width:14px;height:14px;opacity:.7}.read-icon.unread{opacity:.4}.quick-reactions{position:absolute;top:-18px;right:0;display:flex;align-items:center;gap:4px;padding:3px 5px;background:#071d30;border:1px solid rgba(255,255,255,.14);border-radius:999px;box-shadow:0 6px 14px #00000047;z-index:4}.message-bubble-row.other .quick-reactions,.message-bubble-row.own .quick-reactions{left:auto;right:0}.quick-emoji-btn{width:20px;height:20px;border:none;border-radius:999px;background:transparent;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:13px;line-height:1;cursor:pointer;padding:0;transition:transform .12s ease,background .12s ease}.quick-emoji-btn:hover{background:#ffffff2e;transform:scale(1.14)}.reactions-row{display:flex;flex-wrap:wrap;gap:3px;margin-top:5px}.reaction-chip{background:#ffffff14;border:1px solid rgba(255,255,255,.2);border-radius:999px;padding:1px 7px;font-size:11px;color:#f2f6ff;cursor:pointer;transition:all .2s}.reaction-chip:hover{background:#ffffff40;transform:scale(1.05)}.reaction-chip.own-reaction{background:#2a5bff4d;border-color:#2a5bff80}.empty-chat{display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;color:#9ca3af}.empty-chat mat-icon{font-size:48px;width:48px;height:48px;margin-bottom:8px}.empty-chat p{font-size:14px;margin:0}\n"], dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i4.NgForOf, selector: "[ngFor][ngForOf]", inputs: ["ngForOf", "ngForTrackBy", "ngForTemplate"] }, { kind: "directive", type: i4.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "ngmodule", type: MatIconModule }, { kind: "component", type: i5.MatIcon, selector: "mat-icon", inputs: ["color", "inline", "svgIcon", "fontSet", "fontIcon"], exportAs: ["matIcon"] }, { kind: "ngmodule", type: MatButtonModule }, { kind: "component", type: i6.MatButton, selector: "    button[mat-button], button[mat-raised-button], button[mat-flat-button],    button[mat-stroked-button]  ", exportAs: ["matButton"] }, { kind: "component", type: i6.MatIconButton, selector: "button[mat-icon-button]", exportAs: ["matButton"] }, { kind: "ngmodule", type: MatProgressSpinnerModule }, { kind: "component", type: i7.MatProgressSpinner, selector: "mat-progress-spinner, mat-spinner", inputs: ["color", "mode", "value", "diameter", "strokeWidth"], exportAs: ["matProgressSpinner"] }, { kind: "ngmodule", type: MatTooltipModule }, { kind: "directive", type: i8.MatTooltip, selector: "[matTooltip]", inputs: ["matTooltipPosition", "matTooltipPositionAtOrigin", "matTooltipDisabled", "matTooltipShowDelay", "matTooltipHideDelay", "matTooltipTouchGestures", "matTooltip", "matTooltipClass"], exportAs: ["matTooltip"] }, { kind: "component", type: MessageInputComponent, selector: "app-message-input", outputs: ["messageSent", "messageWithFiles"] }] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: ChatThreadComponent, decorators: [{
            type: Component,
            args: [{ selector: 'app-chat-thread', standalone: true, imports: [
                        CommonModule, MatIconModule, MatButtonModule,
                        MatProgressSpinnerModule, MatTooltipModule, MessageInputComponent,
                    ], template: `
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

  `, styles: [".chat-thread{display:flex;flex-direction:column;height:100%;background:#041322;position:relative}.chat-thread.drag-over{outline:2px dashed rgba(255,255,255,.45);outline-offset:-6px}.thread-drag-overlay{position:absolute;inset:8px;z-index:20;pointer-events:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:#fff;background:#1f4bd852;border:2px dashed rgba(255,255,255,.55);border-radius:14px;font-size:14px;font-weight:600}.thread-drag-overlay mat-icon{font-size:36px;width:36px;height:36px}.chat-header{display:flex;align-items:center;padding:8px 8px 8px 4px;border-bottom:1px solid rgba(255,255,255,.15);gap:4px;flex-shrink:0}.chat-header button mat-icon{color:#fffc}.chat-name{font-size:16px;font-weight:600;color:#fff}.header-info{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;padding:0 4px}.header-actions{display:flex;gap:0}.header-actions button{width:32px;height:32px}.hdr-btn{border-radius:6px!important;transition:background .15s,box-shadow .15s}.hdr-btn:hover{background:#ffffff26!important;box-shadow:0 2px 8px #0003}.messages-area{flex:1;overflow-y:auto;padding:12px;background:transparent;scrollbar-width:none;-ms-overflow-style:none}.messages-area::-webkit-scrollbar{display:none}.loading-indicator{display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;color:#ffffffb3;font-size:13px}.load-more-btn{align-self:center;margin-bottom:16px;font-size:12px;color:#fff}.messages-list{display:flex;flex-direction:column;gap:1px;flex:1}.date-separator{text-align:center;margin:16px 0 8px;font-size:12px;color:#ffffffb3;font-weight:500}.message-bubble-row{display:flex;flex-direction:column;max-width:88%;margin-bottom:2px}.message-bubble-row.own{align-self:flex-end;align-items:flex-end}.message-bubble-row.other{align-self:flex-start;align-items:flex-start}.sender-name{font-size:11px;font-weight:700;color:#fffffff2;margin-bottom:3px;letter-spacing:.2px;padding:0 10px;text-shadow:0 1px 3px rgba(0,0,0,.4)}.message-bubble{padding:8px 14px 7px;border-radius:14px;font-size:13px;line-height:1.32;word-break:break-word;color:#f5f7ff;position:relative;display:inline-block;min-width:fit-content}.message-bubble-row.other .message-bubble{background:#0d2540;border-bottom-left-radius:5px;box-shadow:0 1px 4px #0006}.message-bubble.own-bubble{background:#0a3d62;border-bottom-right-radius:5px;box-shadow:0 1px 4px #0006}.image-message{line-height:0}.media-img{max-width:220px;max-height:280px;border-radius:10px;display:block;cursor:zoom-in;object-fit:cover;transition:opacity .15s}.media-img:hover{opacity:.88}.media-video{max-width:240px;max-height:260px;border-radius:10px;display:block;background:#000}.video-message{display:flex;flex-direction:column;gap:6px}.video-download{color:#ffffffc7;font-size:12px;text-decoration:underline;text-underline-offset:2px}.media-placeholder{display:flex;align-items:center;gap:8px;min-width:80px;min-height:44px;color:#fff9;font-size:11px}.media-load-label{font-size:11px;color:#fff9}.file-message{display:flex;align-items:center;gap:8px;padding:4px 0}.file-download{display:inline-flex;align-items:center;gap:8px;color:#fff;text-decoration:none;max-width:240px}.file-msg-icon{font-size:20px;width:20px;height:20px;color:#fffc}.file-msg-name{font-size:13px;color:#fff;word-break:break-all}.file-download-icon{font-size:18px;width:18px;height:18px;color:#ffffffb3;flex-shrink:0}.message-meta{display:flex;align-items:center;gap:4px;margin-top:3px}.msg-time{font-size:10px;color:#dae0faa8}.message-bubble-row.other .msg-time{color:#d8dff694}.read-icon{font-size:14px;width:14px;height:14px;opacity:.7}.read-icon.unread{opacity:.4}.quick-reactions{position:absolute;top:-18px;right:0;display:flex;align-items:center;gap:4px;padding:3px 5px;background:#071d30;border:1px solid rgba(255,255,255,.14);border-radius:999px;box-shadow:0 6px 14px #00000047;z-index:4}.message-bubble-row.other .quick-reactions,.message-bubble-row.own .quick-reactions{left:auto;right:0}.quick-emoji-btn{width:20px;height:20px;border:none;border-radius:999px;background:transparent;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:13px;line-height:1;cursor:pointer;padding:0;transition:transform .12s ease,background .12s ease}.quick-emoji-btn:hover{background:#ffffff2e;transform:scale(1.14)}.reactions-row{display:flex;flex-wrap:wrap;gap:3px;margin-top:5px}.reaction-chip{background:#ffffff14;border:1px solid rgba(255,255,255,.2);border-radius:999px;padding:1px 7px;font-size:11px;color:#f2f6ff;cursor:pointer;transition:all .2s}.reaction-chip:hover{background:#ffffff40;transform:scale(1.05)}.reaction-chip.own-reaction{background:#2a5bff4d;border-color:#2a5bff80}.empty-chat{display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;color:#9ca3af}.empty-chat mat-icon{font-size:48px;width:48px;height:48px;margin-bottom:8px}.empty-chat p{font-size:14px;margin:0}\n"] }]
        }], ctorParameters: () => [{ type: i1.MessagingStoreService }, { type: i2.AuthService }, { type: i3.MessagingFileService }, { type: i0.ChangeDetectorRef }], propDecorators: { scrollContainer: [{
                type: ViewChild,
                args: ['scrollContainer']
            }], messageInput: [{
                type: ViewChild,
                args: [MessageInputComponent]
            }], lightboxOpen: [{
                type: Output
            }] } });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdC10aHJlYWQuY29tcG9uZW50LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL2xpYi9jb21wb25lbnRzL2NoYXQtdGhyZWFkL2NoYXQtdGhyZWFkLmNvbXBvbmVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQ0wsU0FBUyxFQUFxQixTQUFTLEVBQ3ZDLE1BQU0sRUFBRSxZQUFZLEdBQ3JCLE1BQU0sZUFBZSxDQUFDO0FBQ3ZCLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUMvQyxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sd0JBQXdCLENBQUM7QUFDdkQsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBQzNELE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQzlFLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBQzdELE9BQU8sRUFBZ0IsYUFBYSxFQUFFLE1BQU0sTUFBTSxDQUFDO0FBSW5ELE9BQU8sRUFBZ0MscUJBQXFCLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUMxSCxPQUFPLEVBQUUscUJBQXFCLEVBQWtCLE1BQU0sMENBQTBDLENBQUM7Ozs7Ozs7Ozs7QUF3a0JqRyxNQUFNLE9BQU8sbUJBQW1CO0lBNkJwQjtJQUNBO0lBQ0E7SUFDQTtJQS9Cb0IsZUFBZSxDQUFjO0lBQ3pCLFlBQVksQ0FBeUI7SUFDN0QsWUFBWSxHQUFHLElBQUksWUFBWSxFQUFVLENBQUM7SUFFcEQsUUFBUSxHQUFjLEVBQUUsQ0FBQztJQUN6QixlQUFlLEdBQWMsRUFBRSxDQUFDO0lBQ2hDLGdCQUFnQixHQUFHLEVBQUUsQ0FBQztJQUN0QixPQUFPLEdBQUcsS0FBSyxDQUFDO0lBQ2hCLE9BQU8sR0FBRyxLQUFLLENBQUM7SUFDaEIsV0FBVyxHQUFrQixJQUFJLENBQUM7SUFFMUIs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QUFyQixNQUFNIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtcbiAgQ29tcG9uZW50LCBPbkluaXQsIE9uRGVzdHJveSwgVmlld0NoaWxkLCBFbGVtZW50UmVmLCBBZnRlclZpZXdDaGVja2VkLCBDaGFuZ2VEZXRlY3RvclJlZixcbiAgT3V0cHV0LCBFdmVudEVtaXR0ZXIsXG59IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xuaW1wb3J0IHsgQ29tbW9uTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvY29tbW9uJztcbmltcG9ydCB7IE1hdEljb25Nb2R1bGUgfSBmcm9tICdAYW5ndWxhci9tYXRlcmlhbC9pY29uJztcbmltcG9ydCB7IE1hdEJ1dHRvbk1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL21hdGVyaWFsL2J1dHRvbic7XG5pbXBvcnQgeyBNYXRQcm9ncmVzc1NwaW5uZXJNb2R1bGUgfSBmcm9tICdAYW5ndWxhci9tYXRlcmlhbC9wcm9ncmVzcy1zcGlubmVyJztcbmltcG9ydCB7IE1hdFRvb2x0aXBNb2R1bGUgfSBmcm9tICdAYW5ndWxhci9tYXRlcmlhbC90b29sdGlwJztcbmltcG9ydCB7IFN1YnNjcmlwdGlvbiwgY29tYmluZUxhdGVzdCB9IGZyb20gJ3J4anMnO1xuaW1wb3J0IHsgTWVzc2FnaW5nU3RvcmVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvbWVzc2FnaW5nLXN0b3JlLnNlcnZpY2UnO1xuaW1wb3J0IHsgTWVzc2FnaW5nRmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9tZXNzYWdpbmctZmlsZS5zZXJ2aWNlJztcbmltcG9ydCB7IEF1dGhTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvYXV0aC5zZXJ2aWNlJztcbmltcG9ydCB7IENvbnRhY3QsIE1lc3NhZ2UsIEF0dGFjaG1lbnQsIGdldENvbnRhY3REaXNwbGF5TmFtZSwgZ2V0TWVzc2FnZVNlbmRlck5hbWUgfSBmcm9tICcuLi8uLi9tb2RlbHMvbWVzc2FnaW5nLm1vZGVscyc7XG5pbXBvcnQgeyBNZXNzYWdlSW5wdXRDb21wb25lbnQsIE1lc3NhZ2VQYXlsb2FkIH0gZnJvbSAnLi4vbWVzc2FnZS1pbnB1dC9tZXNzYWdlLWlucHV0LmNvbXBvbmVudCc7XG5cbkBDb21wb25lbnQoe1xuICBzZWxlY3RvcjogJ2FwcC1jaGF0LXRocmVhZCcsXG4gIHN0YW5kYWxvbmU6IHRydWUsXG4gIGltcG9ydHM6IFtcbiAgICBDb21tb25Nb2R1bGUsIE1hdEljb25Nb2R1bGUsIE1hdEJ1dHRvbk1vZHVsZSxcbiAgICBNYXRQcm9ncmVzc1NwaW5uZXJNb2R1bGUsIE1hdFRvb2x0aXBNb2R1bGUsIE1lc3NhZ2VJbnB1dENvbXBvbmVudCxcbiAgXSxcbiAgdGVtcGxhdGU6IGBcbiAgICA8ZGl2XG4gICAgICBjbGFzcz1cImNoYXQtdGhyZWFkXCJcbiAgICAgIFtjbGFzcy5kcmFnLW92ZXJdPVwidGhyZWFkRHJhZ092ZXJcIlxuICAgICAgKGRyYWdlbnRlcik9XCJvblRocmVhZERyYWdFbnRlcigkZXZlbnQpXCJcbiAgICAgIChkcmFnb3Zlcik9XCJvblRocmVhZERyYWdPdmVyKCRldmVudClcIlxuICAgICAgKGRyYWdsZWF2ZSk9XCJvblRocmVhZERyYWdMZWF2ZSgkZXZlbnQpXCJcbiAgICAgIChkcm9wKT1cIm9uVGhyZWFkRHJvcCgkZXZlbnQpXCJcbiAgICA+XG4gICAgICA8ZGl2IGNsYXNzPVwiY2hhdC1oZWFkZXJcIj5cbiAgICAgICAgPGJ1dHRvbiBtYXQtaWNvbi1idXR0b24gY2xhc3M9XCJoZHItYnRuXCIgKGNsaWNrKT1cImdvQmFjaygpXCIgbWF0VG9vbHRpcD1cIkJhY2tcIiBtYXRUb29sdGlwUG9zaXRpb249XCJiZWxvd1wiPlxuICAgICAgICAgIDxtYXQtaWNvbj5hcnJvd19iYWNrPC9tYXQtaWNvbj5cbiAgICAgICAgPC9idXR0b24+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJoZWFkZXItaW5mb1wiPlxuICAgICAgICAgIDxzcGFuIGNsYXNzPVwiY2hhdC1uYW1lXCI+e3sgY29udmVyc2F0aW9uTmFtZSB9fTwvc3Bhbj5cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJoZWFkZXItYWN0aW9uc1wiPlxuICAgICAgICAgIDxidXR0b24gKm5nSWY9XCJpc0dyb3VwXCIgbWF0LWljb24tYnV0dG9uIGNsYXNzPVwiaGRyLWJ0blwiIChjbGljayk9XCJvbkdyb3VwU2V0dGluZ3MoKVwiIG1hdFRvb2x0aXA9XCJHcm91cCBzZXR0aW5nc1wiIG1hdFRvb2x0aXBQb3NpdGlvbj1cImJlbG93XCI+XG4gICAgICAgICAgICA8bWF0LWljb24+c2V0dGluZ3M8L21hdC1pY29uPlxuICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuXG4gICAgICA8ZGl2IGNsYXNzPVwibWVzc2FnZXMtYXJlYVwiICNzY3JvbGxDb250YWluZXIgKHNjcm9sbCk9XCJvblNjcm9sbCgpXCI+XG4gICAgICAgIDxkaXYgKm5nSWY9XCJ0aHJlYWREcmFnT3ZlclwiIGNsYXNzPVwidGhyZWFkLWRyYWctb3ZlcmxheVwiPlxuICAgICAgICAgIDxtYXQtaWNvbj5jbG91ZF91cGxvYWQ8L21hdC1pY29uPlxuICAgICAgICAgIDxzcGFuPkRyb3AgZmlsZXMgYW55d2hlcmUgaW4gdGhpcyBjaGF0PC9zcGFuPlxuICAgICAgICA8L2Rpdj5cblxuICAgICAgICA8ZGl2ICpuZ0lmPVwibG9hZGluZ1wiIGNsYXNzPVwibG9hZGluZy1pbmRpY2F0b3JcIj5cbiAgICAgICAgICA8bWF0LXNwaW5uZXIgZGlhbWV0ZXI9XCIyNFwiPjwvbWF0LXNwaW5uZXI+XG4gICAgICAgICAgPHNwYW4+TG9hZGluZyBtZXNzYWdlcy4uLjwvc3Bhbj5cbiAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICpuZ0lmPVwibWVzc2FnZXMubGVuZ3RoID49IDUwICYmICFsb2FkaW5nXCJcbiAgICAgICAgICBtYXQtc3Ryb2tlZC1idXR0b25cbiAgICAgICAgICBjbGFzcz1cImxvYWQtbW9yZS1idG5cIlxuICAgICAgICAgIChjbGljayk9XCJsb2FkT2xkZXIoKVwiXG4gICAgICAgID5cbiAgICAgICAgICBMb2FkIG9sZGVyIG1lc3NhZ2VzXG4gICAgICAgIDwvYnV0dG9uPlxuXG4gICAgICAgIDxkaXYgY2xhc3M9XCJtZXNzYWdlcy1saXN0XCI+XG4gICAgICAgICAgPG5nLWNvbnRhaW5lciAqbmdGb3I9XCJsZXQgbXNnIG9mIG1lc3NhZ2VzOyBsZXQgaSA9IGluZGV4XCI+XG4gICAgICAgICAgICA8ZGl2XG4gICAgICAgICAgICAgICpuZ0lmPVwic2hvdWxkU2hvd0RhdGVTZXBhcmF0b3IoaSlcIlxuICAgICAgICAgICAgICBjbGFzcz1cImRhdGUtc2VwYXJhdG9yXCJcbiAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgPHNwYW4+e3sgZm9ybWF0RGF0ZShtc2cuY3JlYXRlZF9hdCkgfX08L3NwYW4+XG4gICAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgICAgPGRpdlxuICAgICAgICAgICAgICBjbGFzcz1cIm1lc3NhZ2UtYnViYmxlLXJvd1wiXG4gICAgICAgICAgICAgIFtjbGFzcy5vd25dPVwiaXNPd25NZXNzYWdlKG1zZylcIlxuICAgICAgICAgICAgICBbY2xhc3Mub3RoZXJdPVwiIWlzT3duTWVzc2FnZShtc2cpXCJcbiAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgPGRpdiAqbmdJZj1cIiFpc093bk1lc3NhZ2UobXNnKVwiIGNsYXNzPVwic2VuZGVyLW5hbWVcIj5cbiAgICAgICAgICAgICAgICB7eyBnZXRTZW5kZXJOYW1lKG1zZykgfX1cbiAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJtZXNzYWdlLWJ1YmJsZVwiIFtjbGFzcy5vd24tYnViYmxlXT1cImlzT3duTWVzc2FnZShtc2cpXCIgKG1vdXNlZW50ZXIpPVwiaG92ZXJlZE1lc3NhZ2VJZCA9IG1zZy5tZXNzYWdlX2lkXCIgKG1vdXNlbGVhdmUpPVwiaG92ZXJlZE1lc3NhZ2VJZCA9IG51bGxcIj5cbiAgICAgICAgICAgICAgICA8IS0tIElNQUdFIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgCAtLT5cbiAgICAgICAgICAgICAgICA8ZGl2ICpuZ0lmPVwiaXNJbWFnZUF0dGFjaG1lbnQobXNnKVwiIGNsYXNzPVwiaW1hZ2UtbWVzc2FnZVwiPlxuICAgICAgICAgICAgICAgICAgPG5nLWNvbnRhaW5lciAqbmdJZj1cImdldE1lZGlhVXJsKG1zZykgYXMgZGF0YVVybDsgZWxzZSBpbWdGYWxsYmFja1wiPlxuICAgICAgICAgICAgICAgICAgICA8aW1nIFtzcmNdPVwiZGF0YVVybFwiIGFsdD1cIkltYWdlXCIgY2xhc3M9XCJtZWRpYS1pbWdcIiAoY2xpY2spPVwib3BlbkxpZ2h0Ym94KGRhdGFVcmwpXCIgLz5cbiAgICAgICAgICAgICAgICAgIDwvbmctY29udGFpbmVyPlxuICAgICAgICAgICAgICAgICAgPG5nLXRlbXBsYXRlICNpbWdGYWxsYmFjaz5cbiAgICAgICAgICAgICAgICAgICAgPGRpdiAqbmdJZj1cInNob3VsZFNob3dNZWRpYVNwaW5uZXIobXNnKTsgZWxzZSBpbWdBc0ZpbGVcIiBjbGFzcz1cIm1lZGlhLXBsYWNlaG9sZGVyXCI+XG4gICAgICAgICAgICAgICAgICAgICAgPG1hdC1zcGlubmVyIGRpYW1ldGVyPVwiMjJcIj48L21hdC1zcGlubmVyPlxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgPG5nLXRlbXBsYXRlICNpbWdBc0ZpbGU+XG4gICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZpbGUtbWVzc2FnZVwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgPG1hdC1pY29uIGNsYXNzPVwiZmlsZS1tc2ctaWNvblwiPmltYWdlPC9tYXQtaWNvbj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwiZmlsZS1tc2ctbmFtZVwiPnt7IGdldEF0dGFjaG1lbnROYW1lKG1zZykgfX08L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgIDwvbmctdGVtcGxhdGU+XG4gICAgICAgICAgICAgICAgICA8L25nLXRlbXBsYXRlPlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgICAgICAgICAgPCEtLSBGSUxFIC8gVklERU8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAIC0tPlxuICAgICAgICAgICAgICAgIDxkaXYgKm5nSWY9XCJoYXNGaWxlQXR0YWNobWVudChtc2cpICYmICFpc0ltYWdlQXR0YWNobWVudChtc2cpXCIgY2xhc3M9XCJmaWxlLW1lc3NhZ2VcIj5cbiAgICAgICAgICAgICAgICAgIDxuZy1jb250YWluZXIgKm5nSWY9XCJpc1ZpZGVvQXR0YWNobWVudChtc2cpOyBlbHNlIHJlZ3VsYXJGaWxlXCI+XG4gICAgICAgICAgICAgICAgICAgIDxuZy1jb250YWluZXIgKm5nSWY9XCJnZXRNZWRpYVVybChtc2cpIGFzIHZpZGVvVXJsOyBlbHNlIHZpZGVvTG9hZGluZ1wiPlxuICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ2aWRlby1tZXNzYWdlXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICA8dmlkZW8gY29udHJvbHMgY2xhc3M9XCJtZWRpYS12aWRlb1wiIHByZWxvYWQ9XCJtZXRhZGF0YVwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICA8c291cmNlIFtzcmNdPVwidmlkZW9VcmxcIiBbdHlwZV09XCJnZXRBdHRhY2htZW50TWltZVR5cGUobXNnKVwiIC8+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIFlvdXIgYnJvd3NlciBkb2VzIG5vdCBzdXBwb3J0IHZpZGVvLlxuICAgICAgICAgICAgICAgICAgICAgICAgPC92aWRlbz5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxhXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzPVwidmlkZW8tZG93bmxvYWRcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICBbaHJlZl09XCJ2aWRlb1VybFwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgIFthdHRyLmRvd25sb2FkXT1cImdldEF0dGFjaG1lbnROYW1lKG1zZylcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICB0YXJnZXQ9XCJfYmxhbmtcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICByZWw9XCJub29wZW5lclwiXG4gICAgICAgICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIERvd25sb2FkIHt7IGdldEF0dGFjaG1lbnROYW1lKG1zZykgfX1cbiAgICAgICAgICAgICAgICAgICAgICAgIDwvYT5cbiAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgPC9uZy1jb250YWluZXI+XG4gICAgICAgICAgICAgICAgICAgIDxuZy10ZW1wbGF0ZSAjdmlkZW9Mb2FkaW5nPlxuICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJtZWRpYS1wbGFjZWhvbGRlclwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgPG1hdC1zcGlubmVyIGRpYW1ldGVyPVwiMjJcIj48L21hdC1zcGlubmVyPlxuICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJtZWRpYS1sb2FkLWxhYmVsXCI+TG9hZGluZyB2aWRlb+KApjwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgPC9uZy10ZW1wbGF0ZT5cbiAgICAgICAgICAgICAgICAgIDwvbmctY29udGFpbmVyPlxuICAgICAgICAgICAgICAgICAgPG5nLXRlbXBsYXRlICNyZWd1bGFyRmlsZT5cbiAgICAgICAgICAgICAgICAgICAgPG5nLWNvbnRhaW5lciAqbmdJZj1cImdldE1lZGlhVXJsKG1zZykgYXMgZmlsZVVybDsgZWxzZSBmaWxlTG9hZGluZ1wiPlxuICAgICAgICAgICAgICAgICAgICAgIDxhXG4gICAgICAgICAgICAgICAgICAgICAgICBjbGFzcz1cImZpbGUtZG93bmxvYWRcIlxuICAgICAgICAgICAgICAgICAgICAgICAgW2hyZWZdPVwiZmlsZVVybFwiXG4gICAgICAgICAgICAgICAgICAgICAgICBbYXR0ci5kb3dubG9hZF09XCJnZXRBdHRhY2htZW50TmFtZShtc2cpXCJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRhcmdldD1cIl9ibGFua1wiXG4gICAgICAgICAgICAgICAgICAgICAgICByZWw9XCJub29wZW5lclwiXG4gICAgICAgICAgICAgICAgICAgICAgICAoY2xpY2spPVwiJGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpXCJcbiAgICAgICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgICAgICA8bWF0LWljb24gY2xhc3M9XCJmaWxlLW1zZy1pY29uXCI+e3sgZ2V0RmlsZUljb24obXNnKSB9fTwvbWF0LWljb24+XG4gICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cImZpbGUtbXNnLW5hbWVcIj57eyBnZXRBdHRhY2htZW50TmFtZShtc2cpIH19PC9zcGFuPlxuICAgICAgICAgICAgICAgICAgICAgICAgPG1hdC1pY29uIGNsYXNzPVwiZmlsZS1kb3dubG9hZC1pY29uXCI+ZG93bmxvYWQ8L21hdC1pY29uPlxuICAgICAgICAgICAgICAgICAgICAgIDwvYT5cbiAgICAgICAgICAgICAgICAgICAgPC9uZy1jb250YWluZXI+XG4gICAgICAgICAgICAgICAgICAgIDxuZy10ZW1wbGF0ZSAjZmlsZUxvYWRpbmc+XG4gICAgICAgICAgICAgICAgICAgICAgPG1hdC1pY29uIGNsYXNzPVwiZmlsZS1tc2ctaWNvblwiPnt7IGdldEZpbGVJY29uKG1zZykgfX08L21hdC1pY29uPlxuICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwiZmlsZS1tc2ctbmFtZVwiPnt7IGdldEF0dGFjaG1lbnROYW1lKG1zZykgfX08L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgICAgPG1hdC1zcGlubmVyICpuZ0lmPVwic2hvdWxkU2hvd01lZGlhU3Bpbm5lcihtc2cpXCIgZGlhbWV0ZXI9XCIxOFwiPjwvbWF0LXNwaW5uZXI+XG4gICAgICAgICAgICAgICAgICAgICAgPHNwYW4gKm5nSWY9XCJoYXNNZWRpYUZhaWxlZChtc2cpXCIgY2xhc3M9XCJtZWRpYS1sb2FkLWxhYmVsXCI+VW5hdmFpbGFibGU8L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgIDwvbmctdGVtcGxhdGU+XG4gICAgICAgICAgICAgICAgICA8L25nLXRlbXBsYXRlPlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDxkaXZcbiAgICAgICAgICAgICAgICAgICpuZ0lmPVwibXNnLm1lc3NhZ2VfdHlwZSA9PT0gJ1RFWFQnICYmICFpc0ltYWdlQXR0YWNobWVudChtc2cpICYmICFoYXNGaWxlQXR0YWNobWVudChtc2cpXCJcbiAgICAgICAgICAgICAgICAgIGNsYXNzPVwidGV4dC1jb250ZW50XCJcbiAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICB7eyBtc2cuY29udGVudCB9fVxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJtZXNzYWdlLW1ldGFcIj5cbiAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwibXNnLXRpbWVcIj57eyBmb3JtYXRUaW1lKG1zZy5jcmVhdGVkX2F0KSB9fTwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgIDxtYXQtaWNvbiAqbmdJZj1cImlzT3duTWVzc2FnZShtc2cpICYmIG1zZy5pc19yZWFkXCIgY2xhc3M9XCJyZWFkLWljb25cIj5kb25lX2FsbDwvbWF0LWljb24+XG4gICAgICAgICAgICAgICAgICA8bWF0LWljb24gKm5nSWY9XCJpc093bk1lc3NhZ2UobXNnKSAmJiAhbXNnLmlzX3JlYWRcIiBjbGFzcz1cInJlYWQtaWNvbiB1bnJlYWRcIj5kb25lPC9tYXQtaWNvbj5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICA8ZGl2ICpuZ0lmPVwiaG92ZXJlZE1lc3NhZ2VJZCA9PT0gbXNnLm1lc3NhZ2VfaWRcIiBjbGFzcz1cInF1aWNrLXJlYWN0aW9uc1wiPlxuICAgICAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgICAgICAqbmdGb3I9XCJsZXQgZW1vamkgb2YgcXVpY2tFbW9qaXNcIlxuICAgICAgICAgICAgICAgICAgICBjbGFzcz1cInF1aWNrLWVtb2ppLWJ0blwiXG4gICAgICAgICAgICAgICAgICAgIChjbGljayk9XCJvbkVtb2ppU2VsZWN0ZWQoZW1vamksIG1zZy5tZXNzYWdlX2lkKVwiXG4gICAgICAgICAgICAgICAgICAgIFthdHRyLmFyaWEtbGFiZWxdPVwiJ1JlYWN0IHdpdGggJyArIGVtb2ppXCJcbiAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAge3sgZW1vamkgfX1cbiAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDxkaXYgKm5nSWY9XCJtc2cucmVhY3Rpb25zICYmIG1zZy5yZWFjdGlvbnMubGVuZ3RoID4gMFwiIGNsYXNzPVwicmVhY3Rpb25zLXJvd1wiPlxuICAgICAgICAgICAgICAgICAgPGJ1dHRvbiBcbiAgICAgICAgICAgICAgICAgICAgKm5nRm9yPVwibGV0IHIgb2YgbXNnLnJlYWN0aW9uc1wiIFxuICAgICAgICAgICAgICAgICAgICBjbGFzcz1cInJlYWN0aW9uLWNoaXBcIlxuICAgICAgICAgICAgICAgICAgICAoY2xpY2spPVwidG9nZ2xlUmVhY3Rpb24oci5lbW9qaSwgbXNnLm1lc3NhZ2VfaWQpXCJcbiAgICAgICAgICAgICAgICAgICAgW2NsYXNzLm93bi1yZWFjdGlvbl09XCJyLmhhc1JlYWN0ZWRcIlxuICAgICAgICAgICAgICAgICAgICBbbWF0VG9vbHRpcF09XCJnZXRSZWFjdG9yVG9vbHRpcChyKVwiXG4gICAgICAgICAgICAgICAgICAgIG1hdFRvb2x0aXBQb3NpdGlvbj1cImFib3ZlXCJcbiAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAge3sgci5lbW9qaSB9fSB7eyByLmNvdW50IH19XG4gICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8L25nLWNvbnRhaW5lcj5cbiAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgPGRpdiAqbmdJZj1cIm1lc3NhZ2VzLmxlbmd0aCA9PT0gMCAmJiAhbG9hZGluZ1wiIGNsYXNzPVwiZW1wdHktY2hhdFwiPlxuICAgICAgICAgIDxtYXQtaWNvbj5jaGF0X2J1YmJsZV9vdXRsaW5lPC9tYXQtaWNvbj5cbiAgICAgICAgICA8cD5ObyBtZXNzYWdlcyB5ZXQuIFNheSBoZWxsbyE8L3A+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG5cbiAgICAgIDxhcHAtbWVzc2FnZS1pbnB1dFxuICAgICAgICAobWVzc2FnZVNlbnQpPVwib25TZW5kTWVzc2FnZSgkZXZlbnQpXCJcbiAgICAgICAgKG1lc3NhZ2VXaXRoRmlsZXMpPVwib25TZW5kV2l0aEZpbGVzKCRldmVudClcIlxuICAgICAgPjwvYXBwLW1lc3NhZ2UtaW5wdXQ+XG4gICAgPC9kaXY+XG5cbiAgYCxcbiAgc3R5bGVzOiBbYFxuICAgIC5jaGF0LXRocmVhZCB7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICAgIGhlaWdodDogMTAwJTtcbiAgICAgIGJhY2tncm91bmQ6ICMwNDEzMjI7XG4gICAgICBwb3NpdGlvbjogcmVsYXRpdmU7XG4gICAgfVxuXG4gICAgLmNoYXQtdGhyZWFkLmRyYWctb3ZlciB7XG4gICAgICBvdXRsaW5lOiAycHggZGFzaGVkIHJnYmEoMjU1LCAyNTUsIDI1NSwgMC40NSk7XG4gICAgICBvdXRsaW5lLW9mZnNldDogLTZweDtcbiAgICB9XG5cbiAgICAudGhyZWFkLWRyYWctb3ZlcmxheSB7XG4gICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XG4gICAgICBpbnNldDogOHB4O1xuICAgICAgei1pbmRleDogMjA7XG4gICAgICBwb2ludGVyLWV2ZW50czogbm9uZTtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgICAgZ2FwOiA4cHg7XG4gICAgICBjb2xvcjogI2ZmZjtcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMzEsIDc1LCAyMTYsIDAuMzIpO1xuICAgICAgYm9yZGVyOiAycHggZGFzaGVkIHJnYmEoMjU1LCAyNTUsIDI1NSwgMC41NSk7XG4gICAgICBib3JkZXItcmFkaXVzOiAxNHB4O1xuICAgICAgZm9udC1zaXplOiAxNHB4O1xuICAgICAgZm9udC13ZWlnaHQ6IDYwMDtcbiAgICB9XG5cbiAgICAudGhyZWFkLWRyYWctb3ZlcmxheSBtYXQtaWNvbiB7XG4gICAgICBmb250LXNpemU6IDM2cHg7XG4gICAgICB3aWR0aDogMzZweDtcbiAgICAgIGhlaWdodDogMzZweDtcbiAgICB9XG5cbiAgICAuY2hhdC1oZWFkZXIge1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBwYWRkaW5nOiA4cHggOHB4IDhweCA0cHg7XG4gICAgICBib3JkZXItYm90dG9tOiAxcHggc29saWQgcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjE1KTtcbiAgICAgIGdhcDogNHB4O1xuICAgICAgZmxleC1zaHJpbms6IDA7XG4gICAgfVxuXG4gICAgLmNoYXQtaGVhZGVyIGJ1dHRvbiBtYXQtaWNvbiB7XG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjgpO1xuICAgIH1cblxuICAgIC5jaGF0LW5hbWUge1xuICAgICAgZm9udC1zaXplOiAxNnB4O1xuICAgICAgZm9udC13ZWlnaHQ6IDYwMDtcbiAgICAgIGNvbG9yOiAjZmZmO1xuICAgIH1cblxuICAgIC5oZWFkZXItaW5mbyB7XG4gICAgICBmbGV4OiAxO1xuICAgICAgd2hpdGUtc3BhY2U6IG5vd3JhcDtcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICB0ZXh0LW92ZXJmbG93OiBlbGxpcHNpcztcbiAgICAgIGRpc3BsYXk6IGJsb2NrO1xuICAgICAgcGFkZGluZzogMCA0cHg7XG4gICAgfVxuXG4gICAgLmhlYWRlci1hY3Rpb25zIHtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBnYXA6IDA7XG4gICAgfVxuXG4gICAgLmhlYWRlci1hY3Rpb25zIGJ1dHRvbiB7XG4gICAgICB3aWR0aDogMzJweDtcbiAgICAgIGhlaWdodDogMzJweDtcbiAgICB9XG5cbiAgICAuaGRyLWJ0biB7XG4gICAgICBib3JkZXItcmFkaXVzOiA2cHggIWltcG9ydGFudDtcbiAgICAgIHRyYW5zaXRpb246IGJhY2tncm91bmQgMC4xNXMsIGJveC1zaGFkb3cgMC4xNXM7XG4gICAgfVxuXG4gICAgLmhkci1idG46aG92ZXIge1xuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjE1KSAhaW1wb3J0YW50O1xuICAgICAgYm94LXNoYWRvdzogMCAycHggOHB4IHJnYmEoMCwgMCwgMCwgMC4yKTtcbiAgICB9XG5cbiAgICAubWVzc2FnZXMtYXJlYSB7XG4gICAgICBmbGV4OiAxO1xuICAgICAgb3ZlcmZsb3cteTogYXV0bztcbiAgICAgIHBhZGRpbmc6IDEycHg7XG4gICAgICBiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudDtcbiAgICAgIHNjcm9sbGJhci13aWR0aDogbm9uZTtcbiAgICAgIC1tcy1vdmVyZmxvdy1zdHlsZTogbm9uZTtcbiAgICB9XG5cbiAgICAubWVzc2FnZXMtYXJlYTo6LXdlYmtpdC1zY3JvbGxiYXIge1xuICAgICAgZGlzcGxheTogbm9uZTtcbiAgICB9XG5cbiAgICAubG9hZGluZy1pbmRpY2F0b3Ige1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgIGdhcDogOHB4O1xuICAgICAgcGFkZGluZzogMTJweDtcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNyk7XG4gICAgICBmb250LXNpemU6IDEzcHg7XG4gICAgfVxuXG4gICAgLmxvYWQtbW9yZS1idG4ge1xuICAgICAgYWxpZ24tc2VsZjogY2VudGVyO1xuICAgICAgbWFyZ2luLWJvdHRvbTogMTZweDtcbiAgICAgIGZvbnQtc2l6ZTogMTJweDtcbiAgICAgIGNvbG9yOiAjZmZmO1xuICAgIH1cblxuICAgIC5tZXNzYWdlcy1saXN0IHtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgZ2FwOiAxcHg7XG4gICAgICBmbGV4OiAxO1xuICAgIH1cblxuICAgIC5kYXRlLXNlcGFyYXRvciB7XG4gICAgICB0ZXh0LWFsaWduOiBjZW50ZXI7XG4gICAgICBtYXJnaW46IDE2cHggMCA4cHg7XG4gICAgICBmb250LXNpemU6IDEycHg7XG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjcpO1xuICAgICAgZm9udC13ZWlnaHQ6IDUwMDtcbiAgICB9XG5cbiAgICAubWVzc2FnZS1idWJibGUtcm93IHtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgbWF4LXdpZHRoOiA4OCU7XG4gICAgICBtYXJnaW4tYm90dG9tOiAycHg7XG4gICAgfVxuXG4gICAgLm1lc3NhZ2UtYnViYmxlLXJvdy5vd24ge1xuICAgICAgYWxpZ24tc2VsZjogZmxleC1lbmQ7XG4gICAgICBhbGlnbi1pdGVtczogZmxleC1lbmQ7XG4gICAgfVxuXG4gICAgLm1lc3NhZ2UtYnViYmxlLXJvdy5vdGhlciB7XG4gICAgICBhbGlnbi1zZWxmOiBmbGV4LXN0YXJ0O1xuICAgICAgYWxpZ24taXRlbXM6IGZsZXgtc3RhcnQ7XG4gICAgfVxuXG4gICAgLnNlbmRlci1uYW1lIHtcbiAgICAgIGZvbnQtc2l6ZTogMTFweDtcbiAgICAgIGZvbnQtd2VpZ2h0OiA3MDA7XG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjk1KTtcbiAgICAgIG1hcmdpbi1ib3R0b206IDNweDtcbiAgICAgIGxldHRlci1zcGFjaW5nOiAwLjJweDtcbiAgICAgIHBhZGRpbmc6IDAgMTBweDtcbiAgICAgIHRleHQtc2hhZG93OiAwIDFweCAzcHggcmdiYSgwLCAwLCAwLCAwLjQpO1xuICAgIH1cblxuICAgIC5tZXNzYWdlLWJ1YmJsZSB7XG4gICAgICBwYWRkaW5nOiA4cHggMTRweCA3cHg7XG4gICAgICBib3JkZXItcmFkaXVzOiAxNHB4O1xuICAgICAgZm9udC1zaXplOiAxM3B4O1xuICAgICAgbGluZS1oZWlnaHQ6IDEuMzI7XG4gICAgICB3b3JkLWJyZWFrOiBicmVhay13b3JkO1xuICAgICAgY29sb3I6ICNmNWY3ZmY7XG4gICAgICBwb3NpdGlvbjogcmVsYXRpdmU7XG4gICAgICBkaXNwbGF5OiBpbmxpbmUtYmxvY2s7XG4gICAgICBtaW4td2lkdGg6IGZpdC1jb250ZW50O1xuICAgIH1cblxuICAgIC5tZXNzYWdlLWJ1YmJsZS1yb3cub3RoZXIgLm1lc3NhZ2UtYnViYmxlIHtcbiAgICAgIGJhY2tncm91bmQ6ICMwZDI1NDA7XG4gICAgICBib3JkZXItYm90dG9tLWxlZnQtcmFkaXVzOiA1cHg7XG4gICAgICBib3gtc2hhZG93OiAwIDFweCA0cHggcmdiYSgwLCAwLCAwLCAwLjQpO1xuICAgIH1cblxuICAgIC5tZXNzYWdlLWJ1YmJsZS5vd24tYnViYmxlIHtcbiAgICAgIGJhY2tncm91bmQ6ICMwYTNkNjI7XG4gICAgICBib3JkZXItYm90dG9tLXJpZ2h0LXJhZGl1czogNXB4O1xuICAgICAgYm94LXNoYWRvdzogMCAxcHggNHB4IHJnYmEoMCwgMCwgMCwgMC40KTtcbiAgICB9XG5cbiAgICAuaW1hZ2UtbWVzc2FnZSB7XG4gICAgICBsaW5lLWhlaWdodDogMDtcbiAgICB9XG5cbiAgICAubWVkaWEtaW1nIHtcbiAgICAgIG1heC13aWR0aDogMjIwcHg7XG4gICAgICBtYXgtaGVpZ2h0OiAyODBweDtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDEwcHg7XG4gICAgICBkaXNwbGF5OiBibG9jaztcbiAgICAgIGN1cnNvcjogem9vbS1pbjtcbiAgICAgIG9iamVjdC1maXQ6IGNvdmVyO1xuICAgICAgdHJhbnNpdGlvbjogb3BhY2l0eSAwLjE1cztcbiAgICB9XG5cbiAgICAubWVkaWEtaW1nOmhvdmVyIHtcbiAgICAgIG9wYWNpdHk6IDAuODg7XG4gICAgfVxuXG4gICAgLm1lZGlhLXZpZGVvIHtcbiAgICAgIG1heC13aWR0aDogMjQwcHg7XG4gICAgICBtYXgtaGVpZ2h0OiAyNjBweDtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDEwcHg7XG4gICAgICBkaXNwbGF5OiBibG9jaztcbiAgICAgIGJhY2tncm91bmQ6ICMwMDA7XG4gICAgfVxuXG4gICAgLnZpZGVvLW1lc3NhZ2Uge1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAgICBnYXA6IDZweDtcbiAgICB9XG5cbiAgICAudmlkZW8tZG93bmxvYWQge1xuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC43OCk7XG4gICAgICBmb250LXNpemU6IDEycHg7XG4gICAgICB0ZXh0LWRlY29yYXRpb246IHVuZGVybGluZTtcbiAgICAgIHRleHQtdW5kZXJsaW5lLW9mZnNldDogMnB4O1xuICAgIH1cblxuICAgIC5tZWRpYS1wbGFjZWhvbGRlciB7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGdhcDogOHB4O1xuICAgICAgbWluLXdpZHRoOiA4MHB4O1xuICAgICAgbWluLWhlaWdodDogNDRweDtcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwyNTUsMjU1LDAuNik7XG4gICAgICBmb250LXNpemU6IDExcHg7XG4gICAgfVxuXG4gICAgLm1lZGlhLWxvYWQtbGFiZWwge1xuICAgICAgZm9udC1zaXplOiAxMXB4O1xuICAgICAgY29sb3I6IHJnYmEoMjU1LDI1NSwyNTUsMC42KTtcbiAgICB9XG5cbiAgICAuZmlsZS1tZXNzYWdlIHtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgZ2FwOiA4cHg7XG4gICAgICBwYWRkaW5nOiA0cHggMDtcbiAgICB9XG5cbiAgICAuZmlsZS1kb3dubG9hZCB7XG4gICAgICBkaXNwbGF5OiBpbmxpbmUtZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBnYXA6IDhweDtcbiAgICAgIGNvbG9yOiAjZmZmO1xuICAgICAgdGV4dC1kZWNvcmF0aW9uOiBub25lO1xuICAgICAgbWF4LXdpZHRoOiAyNDBweDtcbiAgICB9XG5cbiAgICAuZmlsZS1tc2ctaWNvbiB7XG4gICAgICBmb250LXNpemU6IDIwcHg7XG4gICAgICB3aWR0aDogMjBweDtcbiAgICAgIGhlaWdodDogMjBweDtcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuOCk7XG4gICAgfVxuXG4gICAgLmZpbGUtbXNnLW5hbWUge1xuICAgICAgZm9udC1zaXplOiAxM3B4O1xuICAgICAgY29sb3I6ICNmZmY7XG4gICAgICB3b3JkLWJyZWFrOiBicmVhay1hbGw7XG4gICAgfVxuXG4gICAgLmZpbGUtZG93bmxvYWQtaWNvbiB7XG4gICAgICBmb250LXNpemU6IDE4cHg7XG4gICAgICB3aWR0aDogMThweDtcbiAgICAgIGhlaWdodDogMThweDtcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNyk7XG4gICAgICBmbGV4LXNocmluazogMDtcbiAgICB9XG5cbiAgICAubWVzc2FnZS1tZXRhIHtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgZ2FwOiA0cHg7XG4gICAgICBtYXJnaW4tdG9wOiAzcHg7XG4gICAgfVxuXG4gICAgLm1zZy10aW1lIHtcbiAgICAgIGZvbnQtc2l6ZTogMTBweDtcbiAgICAgIGNvbG9yOiByZ2JhKDIxOCwgMjI0LCAyNTAsIDAuNjYpO1xuICAgIH1cblxuICAgIC5tZXNzYWdlLWJ1YmJsZS1yb3cub3RoZXIgLm1zZy10aW1lIHtcbiAgICAgIGNvbG9yOiByZ2JhKDIxNiwgMjIzLCAyNDYsIDAuNTgpO1xuICAgIH1cblxuICAgIC5yZWFkLWljb24ge1xuICAgICAgZm9udC1zaXplOiAxNHB4O1xuICAgICAgd2lkdGg6IDE0cHg7XG4gICAgICBoZWlnaHQ6IDE0cHg7XG4gICAgICBvcGFjaXR5OiAwLjc7XG4gICAgfVxuXG4gICAgLnJlYWQtaWNvbi51bnJlYWQge1xuICAgICAgb3BhY2l0eTogMC40O1xuICAgIH1cblxuICAgIC5xdWljay1yZWFjdGlvbnMge1xuICAgICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgICAgdG9wOiAtMThweDtcbiAgICAgIHJpZ2h0OiAwO1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBnYXA6IDRweDtcbiAgICAgIHBhZGRpbmc6IDNweCA1cHg7XG4gICAgICBiYWNrZ3JvdW5kOiAjMDcxZDMwO1xuICAgICAgYm9yZGVyOiAxcHggc29saWQgcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjE0KTtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDk5OXB4O1xuICAgICAgYm94LXNoYWRvdzogMCA2cHggMTRweCByZ2JhKDAsIDAsIDAsIDAuMjgpO1xuICAgICAgei1pbmRleDogNDtcbiAgICB9XG5cbiAgICAvKiBCb3RoIHNpZGVzOiBhbmNob3IgdG8gdGhlIHJpZ2h0IGVkZ2Ugb2YgdGhlIGJ1YmJsZSBzbyB0aGUgcG9wdXBcbiAgICAgICBncm93cyB0b3dhcmQgY2VudGVyIGFuZCBuZXZlciBvdmVyZmxvd3MgdGhlIGxlZnQgdmlld3BvcnQgZWRnZS4gKi9cbiAgICAubWVzc2FnZS1idWJibGUtcm93Lm90aGVyIC5xdWljay1yZWFjdGlvbnMsXG4gICAgLm1lc3NhZ2UtYnViYmxlLXJvdy5vd24gLnF1aWNrLXJlYWN0aW9ucyB7XG4gICAgICBsZWZ0OiBhdXRvO1xuICAgICAgcmlnaHQ6IDA7XG4gICAgfVxuXG4gICAgLnF1aWNrLWVtb2ppLWJ0biB7XG4gICAgICB3aWR0aDogMjBweDtcbiAgICAgIGhlaWdodDogMjBweDtcbiAgICAgIGJvcmRlcjogbm9uZTtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDk5OXB4O1xuICAgICAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQ7XG4gICAgICBjb2xvcjogI2ZmZjtcbiAgICAgIGRpc3BsYXk6IGlubGluZS1mbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgICAgZm9udC1zaXplOiAxM3B4O1xuICAgICAgbGluZS1oZWlnaHQ6IDE7XG4gICAgICBjdXJzb3I6IHBvaW50ZXI7XG4gICAgICBwYWRkaW5nOiAwO1xuICAgICAgdHJhbnNpdGlvbjogdHJhbnNmb3JtIDAuMTJzIGVhc2UsIGJhY2tncm91bmQgMC4xMnMgZWFzZTtcbiAgICB9XG5cbiAgICAucXVpY2stZW1vamktYnRuOmhvdmVyIHtcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xOCk7XG4gICAgICB0cmFuc2Zvcm06IHNjYWxlKDEuMTQpO1xuICAgIH1cblxuICAgIC5yZWFjdGlvbnMtcm93IHtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBmbGV4LXdyYXA6IHdyYXA7XG4gICAgICBnYXA6IDNweDtcbiAgICAgIG1hcmdpbi10b3A6IDVweDtcbiAgICB9XG5cbiAgICAucmVhY3Rpb24tY2hpcCB7XG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwyNTUsMjU1LDAuMDgpO1xuICAgICAgYm9yZGVyOiAxcHggc29saWQgcmdiYSgyNTUsMjU1LDI1NSwwLjIpO1xuICAgICAgYm9yZGVyLXJhZGl1czogOTk5cHg7XG4gICAgICBwYWRkaW5nOiAxcHggN3B4O1xuICAgICAgZm9udC1zaXplOiAxMXB4O1xuICAgICAgY29sb3I6ICNmMmY2ZmY7XG4gICAgICBjdXJzb3I6IHBvaW50ZXI7XG4gICAgICB0cmFuc2l0aW9uOiBhbGwgMC4ycztcbiAgICB9XG5cbiAgICAucmVhY3Rpb24tY2hpcDpob3ZlciB7XG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwyNTUsMjU1LDAuMjUpO1xuICAgICAgdHJhbnNmb3JtOiBzY2FsZSgxLjA1KTtcbiAgICB9XG5cbiAgICAucmVhY3Rpb24tY2hpcC5vd24tcmVhY3Rpb24ge1xuICAgICAgYmFja2dyb3VuZDogcmdiYSg0Miw5MSwyNTUsMC4zKTtcbiAgICAgIGJvcmRlci1jb2xvcjogcmdiYSg0Miw5MSwyNTUsMC41KTtcbiAgICB9XG5cbiAgICAuZW1wdHktY2hhdCB7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgIGZsZXg6IDE7XG4gICAgICBjb2xvcjogIzljYTNhZjtcbiAgICB9XG5cbiAgICAuZW1wdHktY2hhdCBtYXQtaWNvbiB7XG4gICAgICBmb250LXNpemU6IDQ4cHg7XG4gICAgICB3aWR0aDogNDhweDtcbiAgICAgIGhlaWdodDogNDhweDtcbiAgICAgIG1hcmdpbi1ib3R0b206IDhweDtcbiAgICB9XG5cbiAgICAuZW1wdHktY2hhdCBwIHtcbiAgICAgIGZvbnQtc2l6ZTogMTRweDtcbiAgICAgIG1hcmdpbjogMDtcbiAgICB9XG4gIGBdLFxufSlcbmV4cG9ydCBjbGFzcyBDaGF0VGhyZWFkQ29tcG9uZW50IGltcGxlbWVudHMgT25Jbml0LCBPbkRlc3Ryb3ksIEFmdGVyVmlld0NoZWNrZWQge1xuICBAVmlld0NoaWxkKCdzY3JvbGxDb250YWluZXInKSBzY3JvbGxDb250YWluZXIhOiBFbGVtZW50UmVmO1xuICBAVmlld0NoaWxkKE1lc3NhZ2VJbnB1dENvbXBvbmVudCkgbWVzc2FnZUlucHV0PzogTWVzc2FnZUlucHV0Q29tcG9uZW50O1xuICBAT3V0cHV0KCkgbGlnaHRib3hPcGVuID0gbmV3IEV2ZW50RW1pdHRlcjxzdHJpbmc+KCk7XG5cbiAgbWVzc2FnZXM6IE1lc3NhZ2VbXSA9IFtdO1xuICB2aXNpYmxlQ29udGFjdHM6IENvbnRhY3RbXSA9IFtdO1xuICBjb252ZXJzYXRpb25OYW1lID0gJyc7XG4gIGlzR3JvdXAgPSBmYWxzZTtcbiAgbG9hZGluZyA9IGZhbHNlO1xuICBteUNvbnRhY3RJZDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG5cbiAgcHJpdmF0ZSBjb252ZXJzYXRpb25JZDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgc3ViITogU3Vic2NyaXB0aW9uO1xuICBwcml2YXRlIHNob3VsZFNjcm9sbFRvQm90dG9tID0gdHJ1ZTtcblxuICB1cGxvYWRpbmcgPSBmYWxzZTtcbiAgaG92ZXJlZE1lc3NhZ2VJZDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG4gIHF1aWNrRW1vamlzID0gWyfinaTvuI8nLCAn8J+RjScsICfwn5iCJywgJ/CfmK4nLCAn8J+YoicsICfwn5SlJ107XG4gIHRocmVhZERyYWdPdmVyID0gZmFsc2U7XG4gIHByaXZhdGUgdGhyZWFkRHJhZ0RlcHRoID0gMDtcbiAgcHJpdmF0ZSBib3VuZFJlc2V0VGhyZWFkRHJhZyA9IHRoaXMucmVzZXRUaHJlYWREcmFnLmJpbmQodGhpcyk7XG5cbiAgLyoqIFRyYWNrcyB3aGljaCBmaWxlIElEcyBhcmUgY3VycmVudGx5IGJlaW5nIGZldGNoZWQgdG8gYXZvaWQgZHVwbGljYXRlIHJlcXVlc3RzICovXG4gIHByaXZhdGUgbWVkaWFMb2FkaW5nID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gIC8qKiBUcmFja3MgZmlsZSBJRHMgd2hlcmUgcmV0cmlldmFsIGZhaWxlZCBzbyBVSSBkb2Vzbid0IHNwaW4gZm9yZXZlci4gKi9cbiAgcHJpdmF0ZSBtZWRpYUZhaWxlZCA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgc3RvcmU6IE1lc3NhZ2luZ1N0b3JlU2VydmljZSxcbiAgICBwcml2YXRlIGF1dGg6IEF1dGhTZXJ2aWNlLFxuICAgIHByaXZhdGUgZmlsZVNlcnZpY2U6IE1lc3NhZ2luZ0ZpbGVTZXJ2aWNlLFxuICAgIHByaXZhdGUgY2RyOiBDaGFuZ2VEZXRlY3RvclJlZixcbiAgKSB7fVxuXG4gIG5nT25Jbml0KCk6IHZvaWQge1xuICAgIHRoaXMubXlDb250YWN0SWQgPSB0aGlzLmF1dGguY29udGFjdElkO1xuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2Ryb3AnLCB0aGlzLmJvdW5kUmVzZXRUaHJlYWREcmFnLCB0cnVlKTtcbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdkcmFnZW5kJywgdGhpcy5ib3VuZFJlc2V0VGhyZWFkRHJhZywgdHJ1ZSk7XG5cbiAgICB0aGlzLnN1YiA9IGNvbWJpbmVMYXRlc3QoW1xuICAgICAgdGhpcy5zdG9yZS5hY3RpdmVDb252ZXJzYXRpb25JZCxcbiAgICAgIHRoaXMuc3RvcmUubWVzc2FnZXNNYXAsXG4gICAgICB0aGlzLnN0b3JlLm9wZW5DaGF0cyxcbiAgICAgIHRoaXMuc3RvcmUudmlzaWJsZUNvbnRhY3RzLFxuICAgICAgdGhpcy5zdG9yZS5sb2FkaW5nTWVzc2FnZXMsXG4gICAgXSkuc3Vic2NyaWJlKChbY29udklkLCBtc2dNYXAsIGNoYXRzLCBjb250YWN0cywgbG9hZGluZ10pID0+IHtcbiAgICAgIHRoaXMubG9hZGluZyA9IGxvYWRpbmc7XG4gICAgICB0aGlzLnZpc2libGVDb250YWN0cyA9IGNvbnRhY3RzIHx8IFtdO1xuXG4gICAgICBpZiAoY29udklkICYmIGNvbnZJZCAhPT0gdGhpcy5jb252ZXJzYXRpb25JZCkge1xuICAgICAgICB0aGlzLmNvbnZlcnNhdGlvbklkID0gY29udklkO1xuICAgICAgICB0aGlzLnNob3VsZFNjcm9sbFRvQm90dG9tID0gdHJ1ZTtcbiAgICAgICAgY29uc3QgY2hhdCA9IGNoYXRzLmZpbmQoKGMpID0+IGMuY29udmVyc2F0aW9uSWQgPT09IGNvbnZJZCk7XG4gICAgICAgIHRoaXMuY29udmVyc2F0aW9uTmFtZSA9IGNoYXQ/Lm5hbWUgfHwgJ0NoYXQnO1xuICAgICAgICB0aGlzLmlzR3JvdXAgPSBjaGF0Py5pc0dyb3VwIHx8IGZhbHNlO1xuICAgICAgfVxuXG4gICAgICBpZiAodGhpcy5jb252ZXJzYXRpb25JZCkge1xuICAgICAgICBjb25zdCBwcmV2TGVuID0gdGhpcy5tZXNzYWdlcy5sZW5ndGg7XG4gICAgICAgIHRoaXMubWVzc2FnZXMgPSBtc2dNYXAuZ2V0KHRoaXMuY29udmVyc2F0aW9uSWQpIHx8IFtdO1xuICAgICAgICBpZiAodGhpcy5tZXNzYWdlcy5sZW5ndGggPiBwcmV2TGVuKSB7XG4gICAgICAgICAgdGhpcy5zaG91bGRTY3JvbGxUb0JvdHRvbSA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgLy8gUHJlLXdhcm0gbWVkaWEgY2FjaGUgZm9yIGFueSBpbWFnZS9maWxlIG1lc3NhZ2VzIHZpc2libGVcbiAgICAgICAgdGhpcy5wcmV3YXJtTWVkaWEodGhpcy5tZXNzYWdlcyk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBuZ0FmdGVyVmlld0NoZWNrZWQoKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuc2hvdWxkU2Nyb2xsVG9Cb3R0b20pIHtcbiAgICAgIHRoaXMuc2Nyb2xsVG9Cb3R0b20oKTtcbiAgICAgIHRoaXMuc2hvdWxkU2Nyb2xsVG9Cb3R0b20gPSBmYWxzZTtcbiAgICB9XG4gIH1cblxuICBuZ09uRGVzdHJveSgpOiB2b2lkIHtcbiAgICB0aGlzLnN1Yj8udW5zdWJzY3JpYmUoKTtcbiAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdkcm9wJywgdGhpcy5ib3VuZFJlc2V0VGhyZWFkRHJhZywgdHJ1ZSk7XG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignZHJhZ2VuZCcsIHRoaXMuYm91bmRSZXNldFRocmVhZERyYWcsIHRydWUpO1xuICB9XG5cbiAgZ29CYWNrKCk6IHZvaWQge1xuICAgIHRoaXMuc3RvcmUuc2V0VmlldygnaW5ib3gnKTtcbiAgfVxuXG4gIG9uQ2xlYXJDb252ZXJzYXRpb24oKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuY29udmVyc2F0aW9uSWQpIHtcbiAgICAgIHRoaXMuc3RvcmUuY2xlYXJDb252ZXJzYXRpb24odGhpcy5jb252ZXJzYXRpb25JZCk7XG4gICAgfVxuICB9XG5cbiAgb25EZWxldGVDb252ZXJzYXRpb24oKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuY29udmVyc2F0aW9uSWQpIHtcbiAgICAgIHRoaXMuc3RvcmUuZGVsZXRlQ29udmVyc2F0aW9uKHRoaXMuY29udmVyc2F0aW9uSWQpO1xuICAgIH1cbiAgfVxuXG4gIG9uR3JvdXBTZXR0aW5ncygpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5jb252ZXJzYXRpb25JZCkge1xuICAgICAgdGhpcy5zdG9yZS5vcGVuR3JvdXBTZXR0aW5ncyh0aGlzLmNvbnZlcnNhdGlvbklkLCB0aGlzLmNvbnZlcnNhdGlvbk5hbWUpO1xuICAgIH1cbiAgfVxuXG4gIG9uU2VuZE1lc3NhZ2UoY29udGVudDogc3RyaW5nKTogdm9pZCB7XG4gICAgdGhpcy5zdG9yZS5zZW5kTWVzc2FnZSh0aGlzLmNvbnZlcnNhdGlvbklkLCBjb250ZW50KTtcbiAgICB0aGlzLnNob3VsZFNjcm9sbFRvQm90dG9tID0gdHJ1ZTtcbiAgfVxuXG4gIG9uU2VuZFdpdGhGaWxlcyhwYXlsb2FkOiBNZXNzYWdlUGF5bG9hZCk6IHZvaWQge1xuICAgIGlmICghdGhpcy5jb252ZXJzYXRpb25JZCB8fCAhdGhpcy5hdXRoLmNvbnRhY3RJZCkgcmV0dXJuO1xuICAgIHRoaXMudXBsb2FkaW5nID0gdHJ1ZTtcblxuICAgIC8vIFN0ZXAgMTogVXBsb2FkIGFsbCBmaWxlcyBhbmQgb2J0YWluIHJlYWwgZmlsZV9pZHMgZnJvbSB0aGUgc2VydmVyLlxuICAgIC8vIFRlbXAgSURzIGFyZSBORVZFUiBzZW50IHRvIGFueSBBUEkg4oCUIHdlIHdhaXQgZm9yIHJlYWwgSURzIGhlcmUuXG4gICAgdGhpcy5maWxlU2VydmljZS51cGxvYWRGaWxlcyhwYXlsb2FkLmZpbGVzKS5zdWJzY3JpYmUoe1xuICAgICAgbmV4dDogKHJlc3BvbnNlcykgPT4ge1xuICAgICAgICBjb25zdCBmaWxlSWRzICAgPSByZXNwb25zZXMubWFwKChyKSA9PiByLmZpbGVfaWQpO1xuICAgICAgICBjb25zdCBmaWxlbmFtZXMgPSByZXNwb25zZXMubWFwKChyKSA9PiByLmZpbGVuYW1lKTtcbiAgICAgICAgY29uc3QgbWltZVR5cGVzID0gcmVzcG9uc2VzLm1hcCgociwgaWR4KSA9PiByLm1pbWVfdHlwZSB8fCBwYXlsb2FkLmZpbGVzW2lkeF0/LnR5cGUgfHwgJycpO1xuXG4gICAgICAgIC8vIEd1YXJkOiBlbnN1cmUgYWxsIElEcyBhcmUgcmVhbCAobm90IHRlbXApXG4gICAgICAgIGNvbnN0IGhhc1RlbXAgPSBmaWxlSWRzLnNvbWUoaWQgPT4gaWQ/LnN0YXJ0c1dpdGgoJ3RlbXAtJykpO1xuICAgICAgICBpZiAoaGFzVGVtcCkge1xuICAgICAgICAgIHRoaXMudXBsb2FkaW5nID0gZmFsc2U7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gU3RlcCAyOiBQcmUtd2FybSBpbWFnZSBjYWNoZSBzbyB0aGUgb3B0aW1pc3RpYyBidWJibGUgcmVuZGVycyBpbW1lZGlhdGVseS5cbiAgICAgICAgdGhpcy5maWxlU2VydmljZS5wcmV3YXJtQ2FjaGUoZmlsZUlkcyk7XG5cbiAgICAgICAgLy8gU3RlcCAzOiBTZW5kIHRoZSBtZXNzYWdlIHdpdGggdGhlIHJlYWwgZmlsZV9pZHMuXG4gICAgICAgIHRoaXMuZmlsZVNlcnZpY2VcbiAgICAgICAgICAuc2VuZE1lc3NhZ2VXaXRoQXR0YWNobWVudHMoXG4gICAgICAgICAgICB0aGlzLmNvbnZlcnNhdGlvbklkISxcbiAgICAgICAgICAgIHRoaXMuYXV0aC5jb250YWN0SWQhLFxuICAgICAgICAgICAgcGF5bG9hZC50ZXh0IHx8IGZpbGVuYW1lcy5qb2luKCcsICcpLFxuICAgICAgICAgICAgZmlsZUlkcyxcbiAgICAgICAgICAgIGZpbGVuYW1lcyxcbiAgICAgICAgICAgIG1pbWVUeXBlc1xuICAgICAgICAgIClcbiAgICAgICAgICAuc3Vic2NyaWJlKHtcbiAgICAgICAgICAgIG5leHQ6IChyZXM6IGFueSkgPT4ge1xuICAgICAgICAgICAgICB0aGlzLnVwbG9hZGluZyA9IGZhbHNlO1xuICAgICAgICAgICAgICB0aGlzLnNob3VsZFNjcm9sbFRvQm90dG9tID0gdHJ1ZTtcblxuICAgICAgICAgICAgICAvLyBBZGQgb3B0aW1pc3RpYyBtZXNzYWdlIHNvIHRoZSBpbWFnZSBhcHBlYXJzIGluc3RhbnRseSDigJRcbiAgICAgICAgICAgICAgLy8gdGhlIFdlYlNvY2tldCBldmVudCBtYXkgYXJyaXZlIGEgbW9tZW50IGxhdGVyIGFuZCBkZWR1cCBpdC5cbiAgICAgICAgICAgICAgY29uc3QgZmlyc3RJZCA9IGZpbGVJZHNbMF0gfHwgJyc7XG4gICAgICAgICAgICAgIGNvbnN0IGlzSW1nID1cbiAgICAgICAgICAgICAgICAobWltZVR5cGVzWzBdIHx8ICcnKS5zdGFydHNXaXRoKCdpbWFnZS8nKSB8fFxuICAgICAgICAgICAgICAgIC9cXC4ocG5nfGpwZT9nfGdpZnx3ZWJwfGJtcHxzdmd8aGVpY3xoZWlmKSQvaS50ZXN0KGZpbGVuYW1lc1swXSB8fCAnJyk7XG4gICAgICAgICAgICAgIGNvbnN0IG9wdGltaXN0aWM6IGFueSA9IHtcbiAgICAgICAgICAgICAgICBtZXNzYWdlX2lkOiByZXM/Lm1lc3NhZ2VfaWQgPyBTdHJpbmcocmVzLm1lc3NhZ2VfaWQpIDogJ3RlbXAtJyArIERhdGUubm93KCksXG4gICAgICAgICAgICAgICAgY29udmVyc2F0aW9uX2lkOiB0aGlzLmNvbnZlcnNhdGlvbklkISxcbiAgICAgICAgICAgICAgICBzZW5kZXJfaWQ6IHRoaXMuYXV0aC5jb250YWN0SWQhLFxuICAgICAgICAgICAgICAgIHNlbmRlcl9uYW1lOiAnWW91JyxcbiAgICAgICAgICAgICAgICBtZXNzYWdlX3R5cGU6IGlzSW1nID8gJ0lNQUdFJyA6ICdGSUxFJyxcbiAgICAgICAgICAgICAgICBjb250ZW50OiBwYXlsb2FkLnRleHQgfHwgZmlsZW5hbWVzLmpvaW4oJywgJyksXG4gICAgICAgICAgICAgICAgbWVkaWFfdXJsOiBmaXJzdElkLFxuICAgICAgICAgICAgICAgIGNyZWF0ZWRfYXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgICAgICAgICBpc19yZWFkOiB0cnVlLFxuICAgICAgICAgICAgICAgIGF0dGFjaG1lbnRzOiBmaWxlSWRzLm1hcCgoaWQsIGlkeCkgPT4gKHtcbiAgICAgICAgICAgICAgICAgIGZpbGVfaWQ6IGlkLFxuICAgICAgICAgICAgICAgICAgZmlsZW5hbWU6IGZpbGVuYW1lc1tpZHhdIHx8IGZpbGVuYW1lc1swXSB8fCBgQXR0YWNobWVudCAke2lkeCArIDF9YCxcbiAgICAgICAgICAgICAgICAgIG1pbWVfdHlwZTogbWltZVR5cGVzW2lkeF0gfHwgdW5kZWZpbmVkLFxuICAgICAgICAgICAgICAgICAgc2l6ZV9ieXRlczogcGF5bG9hZC5maWxlc1tpZHhdPy5zaXplLFxuICAgICAgICAgICAgICAgICAgdXJsOiByZXNwb25zZXNbaWR4XT8udXJsLFxuICAgICAgICAgICAgICAgIH0pKSxcbiAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgdGhpcy5zdG9yZS5hcHBlbmRPcHRpbWlzdGljTWVzc2FnZShvcHRpbWlzdGljKTtcbiAgICAgICAgICAgICAgdGhpcy5jZHIubWFya0ZvckNoZWNrKCk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZXJyb3I6ICgpID0+IHtcbiAgICAgICAgICAgICAgdGhpcy51cGxvYWRpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSk7XG4gICAgICB9LFxuICAgICAgZXJyb3I6ICgpID0+IHtcbiAgICAgICAgdGhpcy51cGxvYWRpbmcgPSBmYWxzZTtcbiAgICAgIH0sXG4gICAgfSk7XG4gIH1cblxuICBsb2FkT2xkZXIoKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuY29udmVyc2F0aW9uSWQgJiYgdGhpcy5tZXNzYWdlcy5sZW5ndGggPiAwKSB7XG4gICAgICB0aGlzLnN0b3JlLmxvYWRNZXNzYWdlcyh0aGlzLmNvbnZlcnNhdGlvbklkLCB0aGlzLm1lc3NhZ2VzWzBdLm1lc3NhZ2VfaWQpO1xuICAgIH1cbiAgfVxuXG4gIG9uU2Nyb2xsKCk6IHZvaWQge31cblxuICBvblRocmVhZERyYWdFbnRlcihldmVudDogRHJhZ0V2ZW50KTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLmRyYWdIYXNGaWxlcyhldmVudCkpIHJldHVybjtcbiAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuICAgIHRoaXMudGhyZWFkRHJhZ0RlcHRoKys7XG4gICAgdGhpcy50aHJlYWREcmFnT3ZlciA9IHRydWU7XG4gIH1cblxuICBvblRocmVhZERyYWdPdmVyKGV2ZW50OiBEcmFnRXZlbnQpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMuZHJhZ0hhc0ZpbGVzKGV2ZW50KSkgcmV0dXJuO1xuICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgaWYgKGV2ZW50LmRhdGFUcmFuc2Zlcikge1xuICAgICAgZXZlbnQuZGF0YVRyYW5zZmVyLmRyb3BFZmZlY3QgPSAnY29weSc7XG4gICAgfVxuICAgIHRoaXMudGhyZWFkRHJhZ092ZXIgPSB0cnVlO1xuICB9XG5cbiAgb25UaHJlYWREcmFnTGVhdmUoZXZlbnQ6IERyYWdFdmVudCk6IHZvaWQge1xuICAgIGlmICghdGhpcy5kcmFnSGFzRmlsZXMoZXZlbnQpKSByZXR1cm47XG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICB0aGlzLnRocmVhZERyYWdEZXB0aCA9IE1hdGgubWF4KDAsIHRoaXMudGhyZWFkRHJhZ0RlcHRoIC0gMSk7XG4gICAgdGhpcy50aHJlYWREcmFnT3ZlciA9IHRoaXMudGhyZWFkRHJhZ0RlcHRoID4gMDtcbiAgfVxuXG4gIG9uVGhyZWFkRHJvcChldmVudDogRHJhZ0V2ZW50KTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLmRyYWdIYXNGaWxlcyhldmVudCkpIHJldHVybjtcbiAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuICAgIHRoaXMucmVzZXRUaHJlYWREcmFnKCk7XG4gICAgY29uc3QgZmlsZXMgPSBldmVudC5kYXRhVHJhbnNmZXI/LmZpbGVzID8gQXJyYXkuZnJvbShldmVudC5kYXRhVHJhbnNmZXIuZmlsZXMpIDogW107XG4gICAgdGhpcy5tZXNzYWdlSW5wdXQ/LmFkZEZpbGVzKGZpbGVzKTtcbiAgfVxuXG4gIHByaXZhdGUgcmVzZXRUaHJlYWREcmFnKCk6IHZvaWQge1xuICAgIHRoaXMudGhyZWFkRHJhZ0RlcHRoID0gMDtcbiAgICB0aGlzLnRocmVhZERyYWdPdmVyID0gZmFsc2U7XG4gIH1cblxuICBwcml2YXRlIGRyYWdIYXNGaWxlcyhldmVudDogRHJhZ0V2ZW50KTogYm9vbGVhbiB7XG4gICAgY29uc3QgdHlwZXMgPSBldmVudC5kYXRhVHJhbnNmZXI/LnR5cGVzO1xuICAgIGlmICghdHlwZXMpIHJldHVybiBmYWxzZTtcbiAgICByZXR1cm4gQXJyYXkuZnJvbSh0eXBlcykuaW5jbHVkZXMoJ0ZpbGVzJyk7XG4gIH1cblxuICBzaG91bGRTaG93RGF0ZVNlcGFyYXRvcihpbmRleDogbnVtYmVyKTogYm9vbGVhbiB7XG4gICAgaWYgKGluZGV4ID09PSAwKSByZXR1cm4gdHJ1ZTtcbiAgICBjb25zdCBjdXJyID0gbmV3IERhdGUodGhpcy5tZXNzYWdlc1tpbmRleF0uY3JlYXRlZF9hdCkudG9EYXRlU3RyaW5nKCk7XG4gICAgY29uc3QgcHJldiA9IG5ldyBEYXRlKHRoaXMubWVzc2FnZXNbaW5kZXggLSAxXS5jcmVhdGVkX2F0KS50b0RhdGVTdHJpbmcoKTtcbiAgICByZXR1cm4gY3VyciAhPT0gcHJldjtcbiAgfVxuXG4gIHNob3VsZFNob3dTZW5kZXIoaW5kZXg6IG51bWJlcik6IGJvb2xlYW4ge1xuICAgIGlmIChpbmRleCA9PT0gMCkgcmV0dXJuIHRydWU7XG4gICAgcmV0dXJuIHRoaXMubWVzc2FnZXNbaW5kZXhdLnNlbmRlcl9pZCAhPT0gdGhpcy5tZXNzYWdlc1tpbmRleCAtIDFdLnNlbmRlcl9pZDtcbiAgfVxuXG4gIGlzT3duTWVzc2FnZShtc2c6IE1lc3NhZ2UpOiBib29sZWFuIHtcbiAgICByZXR1cm4gU3RyaW5nKG1zZy5zZW5kZXJfaWQpID09PSBTdHJpbmcodGhpcy5teUNvbnRhY3RJZCk7XG4gIH1cblxuICBnZXRTZW5kZXJOYW1lKG1zZzogTWVzc2FnZSk6IHN0cmluZyB7XG4gICAgY29uc3QgZnJvbU1lc3NhZ2UgPSBnZXRNZXNzYWdlU2VuZGVyTmFtZShtc2cpO1xuICAgIGlmIChmcm9tTWVzc2FnZSAmJiBmcm9tTWVzc2FnZSAhPT0gJ1Vua25vd24nKSB7XG4gICAgICByZXR1cm4gZnJvbU1lc3NhZ2U7XG4gICAgfVxuXG4gICAgY29uc3QgZnJvbUNvbnRhY3RzID0gdGhpcy52aXNpYmxlQ29udGFjdHMuZmluZChcbiAgICAgIChjKSA9PiBTdHJpbmcoYy5jb250YWN0X2lkKSA9PT0gU3RyaW5nKG1zZy5zZW5kZXJfaWQpXG4gICAgKTtcbiAgICBpZiAoZnJvbUNvbnRhY3RzKSB7XG4gICAgICByZXR1cm4gZ2V0Q29udGFjdERpc3BsYXlOYW1lKGZyb21Db250YWN0cyk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuaXNPd25NZXNzYWdlKG1zZykpIHtcbiAgICAgIHJldHVybiAnWW91JztcbiAgICB9XG5cbiAgICByZXR1cm4gYFVzZXIgJHttc2cuc2VuZGVyX2lkfWA7XG4gIH1cblxuICBmb3JtYXRUaW1lKGRhdGVTdHI6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgaWYgKCFkYXRlU3RyKSByZXR1cm4gJyc7XG4gICAgY29uc3QgZCA9IG5ldyBEYXRlKGRhdGVTdHIpO1xuICAgIHJldHVybiBkLnRvTG9jYWxlVGltZVN0cmluZygnZW4tR0InLCB7IGhvdXI6ICcyLWRpZ2l0JywgbWludXRlOiAnMi1kaWdpdCcgfSk7XG4gIH1cblxuICBmb3JtYXREYXRlKGRhdGVTdHI6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgY29uc3QgZCA9IG5ldyBEYXRlKGRhdGVTdHIpO1xuICAgIGNvbnN0IHRvZGF5ID0gbmV3IERhdGUoKTtcbiAgICBjb25zdCB5ZXN0ZXJkYXkgPSBuZXcgRGF0ZSh0b2RheSk7XG4gICAgeWVzdGVyZGF5LnNldERhdGUoeWVzdGVyZGF5LmdldERhdGUoKSAtIDEpO1xuXG4gICAgaWYgKGQudG9EYXRlU3RyaW5nKCkgPT09IHRvZGF5LnRvRGF0ZVN0cmluZygpKSByZXR1cm4gJ1RvZGF5JztcbiAgICBpZiAoZC50b0RhdGVTdHJpbmcoKSA9PT0geWVzdGVyZGF5LnRvRGF0ZVN0cmluZygpKSByZXR1cm4gJ1llc3RlcmRheSc7XG4gICAgcmV0dXJuIGQudG9Mb2NhbGVEYXRlU3RyaW5nKCdlbi1HQicsIHsgZGF5OiAnbnVtZXJpYycsIG1vbnRoOiAnc2hvcnQnLCB5ZWFyOiAnbnVtZXJpYycgfSk7XG4gIH1cblxuICBwcml2YXRlIHNjcm9sbFRvQm90dG9tKCk6IHZvaWQge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBlbCA9IHRoaXMuc2Nyb2xsQ29udGFpbmVyPy5uYXRpdmVFbGVtZW50O1xuICAgICAgaWYgKGVsKSB7XG4gICAgICAgIGVsLnNjcm9sbFRvcCA9IGVsLnNjcm9sbEhlaWdodDtcbiAgICAgIH1cbiAgICB9IGNhdGNoIHsgLyogaWdub3JlICovIH1cbiAgfVxuXG4gIC8vIOKUgOKUgCBNZWRpYSBoZWxwZXJzIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuXG4gIHByaXZhdGUgZ2V0RmlsZW5hbWVMaWtlKG1zZzogTWVzc2FnZSk6IHN0cmluZyB7XG4gICAgY29uc3QgYW55TXNnID0gbXNnIGFzIGFueTtcbiAgICByZXR1cm4gU3RyaW5nKFxuICAgICAgdGhpcy5nZXRQcmltYXJ5QXR0YWNobWVudChtc2cpPy5maWxlbmFtZSB8fFxuICAgICAgYW55TXNnPy5maWxlbmFtZSB8fFxuICAgICAgYW55TXNnPy5maWxlX25hbWUgfHxcbiAgICAgIG1zZy5jb250ZW50IHx8XG4gICAgICAnJ1xuICAgICkudG9Mb3dlckNhc2UoKTtcbiAgfVxuXG4gIC8qKiBSZXR1cm5zIHRoZSBwcmltYXJ5IGF0dGFjaG1lbnQgZm9yIGEgbWVzc2FnZSwgaWYgYW55LiAqL1xuICBwcml2YXRlIGdldFByaW1hcnlBdHRhY2htZW50KG1zZzogTWVzc2FnZSk6IEF0dGFjaG1lbnQgfCBudWxsIHtcbiAgICBpZiAobXNnLmF0dGFjaG1lbnRzICYmIG1zZy5hdHRhY2htZW50cy5sZW5ndGggPiAwKSByZXR1cm4gbXNnLmF0dGFjaG1lbnRzWzBdO1xuXG4gICAgLy8gU29tZSBBUEkgcmVzcG9uc2VzIHByb3ZpZGUgZmlsZSBtZXRhZGF0YSBpbiBhbHRlcm5hdGUgZmllbGRzLlxuICAgIGNvbnN0IGFueU1zZyA9IG1zZyBhcyBhbnk7XG4gICAgY29uc3QgbXUgPSBTdHJpbmcobXNnLm1lZGlhX3VybCB8fCAnJykudHJpbSgpO1xuICAgIGNvbnN0IG1lZGlhSXNEaXJlY3RVcmwgPVxuICAgICAgbXUuc3RhcnRzV2l0aCgnaHR0cDovLycpIHx8IG11LnN0YXJ0c1dpdGgoJ2h0dHBzOi8vJykgfHwgbXUuc3RhcnRzV2l0aCgnZGF0YTonKTtcbiAgICBjb25zdCBmaWxlSWQgPVxuICAgICAgYW55TXNnPy5maWxlX2lkIHx8XG4gICAgICBhbnlNc2c/LmF0dGFjaG1lbnRfaWQgfHxcbiAgICAgIGFueU1zZz8uYXR0YWNobWVudF9pZHM/LlswXSB8fFxuICAgICAgKCFtZWRpYUlzRGlyZWN0VXJsICYmIG11ID8gbXUgOiB1bmRlZmluZWQpO1xuICAgIGNvbnN0IG1pbWUgPSBhbnlNc2c/Lm1pbWVfdHlwZSB8fCBhbnlNc2c/LmF0dGFjaG1lbnRfbWltZV90eXBlO1xuICAgIGNvbnN0IGV4cGxpY2l0RmlsZW5hbWUgPSBhbnlNc2c/LmZpbGVuYW1lIHx8IGFueU1zZz8uZmlsZV9uYW1lO1xuICAgIGNvbnN0IGZpbGVuYW1lID1cbiAgICAgIGV4cGxpY2l0RmlsZW5hbWUgfHxcbiAgICAgIChmaWxlSWQgfHwgbWltZSB8fCBtc2cubWVzc2FnZV90eXBlICE9PSAnVEVYVCcgPyBtc2cuY29udGVudCA6ICcnKTtcbiAgICBpZiAoZmlsZUlkIHx8IGV4cGxpY2l0RmlsZW5hbWUgfHwgbWltZSB8fCBtc2cubWVzc2FnZV90eXBlID09PSAnRklMRScgfHwgbXNnLm1lc3NhZ2VfdHlwZSA9PT0gJ0lNQUdFJykge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgZmlsZV9pZDogU3RyaW5nKGZpbGVJZCB8fCAnJyksXG4gICAgICAgIGZpbGVuYW1lOiBTdHJpbmcoZmlsZW5hbWUgfHwgJ0ZpbGUnKSxcbiAgICAgICAgbWltZV90eXBlOiBtaW1lID8gU3RyaW5nKG1pbWUpIDogdW5kZWZpbmVkLFxuICAgICAgICB1cmw6IG1lZGlhSXNEaXJlY3RVcmwgPyBtdSA6IHVuZGVmaW5lZCxcbiAgICAgIH07XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgaXNJbWFnZUF0dGFjaG1lbnQobXNnOiBNZXNzYWdlKTogYm9vbGVhbiB7XG4gICAgaWYgKG1zZy5tZXNzYWdlX3R5cGUgPT09ICdJTUFHRScpIHJldHVybiB0cnVlO1xuICAgIGNvbnN0IG1pbWUgPSB0aGlzLmdldFByaW1hcnlBdHRhY2htZW50KG1zZyk/Lm1pbWVfdHlwZSB8fCAnJztcbiAgICBpZiAobWltZS5zdGFydHNXaXRoKCdpbWFnZS8nKSkgcmV0dXJuIHRydWU7XG4gICAgY29uc3QgbmFtZSA9IHRoaXMuZ2V0RmlsZW5hbWVMaWtlKG1zZyk7XG4gICAgcmV0dXJuIC9cXC4ocG5nfGpwZT9nfGdpZnx3ZWJwfGJtcHxzdmd8aGVpY3xoZWlmKSQvaS50ZXN0KG5hbWUpO1xuICB9XG5cbiAgLyoqIFJldHVybnMgdGhlIGNhY2hlZCBkYXRhIFVSTCBmb3IgYSBtZXNzYWdlJ3MgbWVkaWEsIG9yIG51bGwgYW5kIHRyaWdnZXJzIGJhY2tncm91bmQgbG9hZC4gKi9cbiAgZ2V0TWVkaWFVcmwobXNnOiBNZXNzYWdlKTogc3RyaW5nIHwgbnVsbCB7XG4gICAgY29uc3QgYXR0ID0gdGhpcy5nZXRQcmltYXJ5QXR0YWNobWVudChtc2cpO1xuICAgIGNvbnN0IGZpbGVJZCA9IGF0dD8uZmlsZV9pZD8udHJpbSgpO1xuXG4gICAgY29uc3QgZGlyZWN0VXJsID1cbiAgICAgIGF0dD8udXJsIHx8XG4gICAgICBtc2cubWVkaWFfdXJsIHx8XG4gICAgICAobXNnIGFzIGFueSk/LnVybCB8fFxuICAgICAgKG1zZyBhcyBhbnkpPy5maWxlX3VybDtcbiAgICBpZiAoXG4gICAgICBkaXJlY3RVcmwgJiZcbiAgICAgIChkaXJlY3RVcmwuc3RhcnRzV2l0aCgnaHR0cDovLycpIHx8XG4gICAgICAgIGRpcmVjdFVybC5zdGFydHNXaXRoKCdodHRwczovLycpIHx8XG4gICAgICAgIGRpcmVjdFVybC5zdGFydHNXaXRoKCdkYXRhOicpKVxuICAgICkge1xuICAgICAgcmV0dXJuIGRpcmVjdFVybDtcbiAgICB9XG5cbiAgICBpZiAoIWZpbGVJZCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3QgY2FjaGVkID0gdGhpcy5maWxlU2VydmljZS5nZXRDYWNoZWREYXRhVXJsKGZpbGVJZCk7XG4gICAgaWYgKGNhY2hlZCkgcmV0dXJuIGNhY2hlZDtcblxuICAgIC8vIE5vdCB5ZXQgY2FjaGVkIOKAlCBraWNrIG9mZiBhIGJhY2tncm91bmQgZmV0Y2hcbiAgICB0aGlzLmZldGNoTWVkaWEoZmlsZUlkKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHByaXZhdGUgcHJld2FybU1lZGlhKG1lc3NhZ2VzOiBNZXNzYWdlW10pOiB2b2lkIHtcbiAgICBmb3IgKGNvbnN0IG1zZyBvZiBtZXNzYWdlcykge1xuICAgICAgY29uc3QgYXR0ID0gdGhpcy5nZXRQcmltYXJ5QXR0YWNobWVudChtc2cpO1xuICAgICAgY29uc3QgZmlsZUlkID0gYXR0Py5maWxlX2lkPy50cmltKCk7XG4gICAgICBpZiAoIWZpbGVJZCB8fCBmaWxlSWQuc3RhcnRzV2l0aCgndGVtcC0nKSkgY29udGludWU7XG4gICAgICBpZiAodGhpcy5maWxlU2VydmljZS5nZXRDYWNoZWREYXRhVXJsKGZpbGVJZCkpIGNvbnRpbnVlO1xuICAgICAgLy8gUHJlbG9hZCBpbWFnZXMgYW5kIHZpZGVvcyBlYWdlcmx5OyBxdWV1ZSBvdGhlciBmaWxlcyBzbyBkb3dubG9hZCBsaW5rcyBhcHBlYXIuXG4gICAgICB0aGlzLmZldGNoTWVkaWEoZmlsZUlkKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGZldGNoTWVkaWEoZmlsZUlkOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBpZiAoIWZpbGVJZCB8fCBmaWxlSWQuc3RhcnRzV2l0aCgndGVtcC0nKSB8fCB0aGlzLm1lZGlhTG9hZGluZy5oYXMoZmlsZUlkKSkgcmV0dXJuO1xuICAgIHRoaXMubWVkaWFGYWlsZWQuZGVsZXRlKGZpbGVJZCk7XG4gICAgdGhpcy5tZWRpYUxvYWRpbmcuYWRkKGZpbGVJZCk7XG5cbiAgICB0aGlzLmZpbGVTZXJ2aWNlLmdldEZpbGVEYXRhVXJsKGZpbGVJZCkuc3Vic2NyaWJlKHtcbiAgICAgIG5leHQ6ICgpID0+IHtcbiAgICAgICAgdGhpcy5tZWRpYUxvYWRpbmcuZGVsZXRlKGZpbGVJZCk7XG4gICAgICAgIHRoaXMuY2RyLm1hcmtGb3JDaGVjaygpO1xuICAgICAgfSxcbiAgICAgIGVycm9yOiAoKSA9PiB7XG4gICAgICAgIHRoaXMubWVkaWFMb2FkaW5nLmRlbGV0ZShmaWxlSWQpO1xuICAgICAgICB0aGlzLm1lZGlhRmFpbGVkLmFkZChmaWxlSWQpO1xuICAgICAgICB0aGlzLmNkci5tYXJrRm9yQ2hlY2soKTtcbiAgICAgIH0sXG4gICAgfSk7XG4gIH1cblxuICBzaG91bGRTaG93TWVkaWFTcGlubmVyKG1zZzogTWVzc2FnZSk6IGJvb2xlYW4ge1xuICAgIGNvbnN0IGZpbGVJZCA9IHRoaXMuZ2V0UHJpbWFyeUF0dGFjaG1lbnQobXNnKT8uZmlsZV9pZDtcbiAgICBpZiAoIWZpbGVJZCB8fCBmaWxlSWQuc3RhcnRzV2l0aCgndGVtcC0nKSkgcmV0dXJuIGZhbHNlO1xuICAgIHJldHVybiB0aGlzLm1lZGlhTG9hZGluZy5oYXMoZmlsZUlkKSAmJiAhdGhpcy5tZWRpYUZhaWxlZC5oYXMoZmlsZUlkKTtcbiAgfVxuXG4gIGlzVmlkZW9BdHRhY2htZW50KG1zZzogTWVzc2FnZSk6IGJvb2xlYW4ge1xuICAgIGNvbnN0IG1pbWUgPSB0aGlzLmdldFByaW1hcnlBdHRhY2htZW50KG1zZyk/Lm1pbWVfdHlwZSB8fCAnJztcbiAgICBpZiAobWltZS5zdGFydHNXaXRoKCd2aWRlby8nKSkgcmV0dXJuIHRydWU7XG4gICAgY29uc3QgbmFtZSA9IHRoaXMuZ2V0RmlsZW5hbWVMaWtlKG1zZyk7XG4gICAgcmV0dXJuIC9cXC4obXA0fHdlYm18bW92fG00dnxhdml8bWt2KSQvaS50ZXN0KG5hbWUpO1xuICB9XG5cbiAgZ2V0QXR0YWNobWVudE1pbWVUeXBlKG1zZzogTWVzc2FnZSk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHRoaXMuZ2V0UHJpbWFyeUF0dGFjaG1lbnQobXNnKT8ubWltZV90eXBlIHx8ICdhcHBsaWNhdGlvbi9vY3RldC1zdHJlYW0nO1xuICB9XG5cbiAgZ2V0QXR0YWNobWVudE5hbWUobXNnOiBNZXNzYWdlKTogc3RyaW5nIHtcbiAgICByZXR1cm4gdGhpcy5nZXRQcmltYXJ5QXR0YWNobWVudChtc2cpPy5maWxlbmFtZSB8fCBtc2cuY29udGVudCB8fCAnRmlsZSc7XG4gIH1cblxuICBoYXNGaWxlQXR0YWNobWVudChtc2c6IE1lc3NhZ2UpOiBib29sZWFuIHtcbiAgICByZXR1cm4gbXNnLm1lc3NhZ2VfdHlwZSA9PT0gJ0ZJTEUnIHx8ICEhdGhpcy5nZXRQcmltYXJ5QXR0YWNobWVudChtc2cpO1xuICB9XG5cbiAgaGFzTWVkaWFGYWlsZWQobXNnOiBNZXNzYWdlKTogYm9vbGVhbiB7XG4gICAgY29uc3QgZmlsZUlkID0gdGhpcy5nZXRQcmltYXJ5QXR0YWNobWVudChtc2cpPy5maWxlX2lkO1xuICAgIHJldHVybiAhIWZpbGVJZCAmJiB0aGlzLm1lZGlhRmFpbGVkLmhhcyhmaWxlSWQpO1xuICB9XG5cbiAgZ2V0RmlsZUljb24obXNnOiBNZXNzYWdlKTogc3RyaW5nIHtcbiAgICBjb25zdCBtaW1lID0gdGhpcy5nZXRBdHRhY2htZW50TWltZVR5cGUobXNnKTtcbiAgICBjb25zdCBuYW1lID0gdGhpcy5nZXRBdHRhY2htZW50TmFtZShtc2cpLnRvTG93ZXJDYXNlKCk7XG4gICAgaWYgKG1pbWUuc3RhcnRzV2l0aCgndmlkZW8vJykgfHwgL1xcLihtcDR8d2VibXxtb3Z8bTR2fGF2aXxta3YpJC9pLnRlc3QobmFtZSkpIHJldHVybiAndmlkZW9jYW0nO1xuICAgIGlmIChtaW1lLnN0YXJ0c1dpdGgoJ2F1ZGlvLycpIHx8IC9cXC4obXAzfHdhdnxvZ2d8bTRhfGZsYWMpJC9pLnRlc3QobmFtZSkpIHJldHVybiAnYXVkaW90cmFjayc7XG4gICAgaWYgKG1pbWUuaW5jbHVkZXMoJ3BkZicpIHx8IG5hbWUuZW5kc1dpdGgoJy5wZGYnKSkgcmV0dXJuICdwaWN0dXJlX2FzX3BkZic7XG4gICAgaWYgKG1pbWUuaW5jbHVkZXMoJ3NwcmVhZHNoZWV0JykgfHwgbWltZS5pbmNsdWRlcygnZXhjZWwnKSB8fCAvXFwuKHhsc3x4bHN4fGNzdikkL2kudGVzdChuYW1lKSkgcmV0dXJuICd0YWJsZV9jaGFydCc7XG4gICAgaWYgKG1pbWUuaW5jbHVkZXMoJ2RvY3VtZW50JykgfHwgbWltZS5pbmNsdWRlcygnd29yZCcpIHx8IC9cXC4oZG9jfGRvY3h8dHh0fHJ0ZikkL2kudGVzdChuYW1lKSkgcmV0dXJuICdkZXNjcmlwdGlvbic7XG4gICAgaWYgKG1pbWUuaW5jbHVkZXMoJ3ppcCcpIHx8IC9cXC4oemlwfHJhcnw3enx0YXJ8Z3opJC9pLnRlc3QobmFtZSkpIHJldHVybiAnZm9sZGVyX3ppcCc7XG4gICAgcmV0dXJuICdpbnNlcnRfZHJpdmVfZmlsZSc7XG4gIH1cblxuICBvcGVuTGlnaHRib3goZGF0YVVybDogc3RyaW5nKTogdm9pZCB7XG4gICAgdGhpcy5saWdodGJveE9wZW4uZW1pdChkYXRhVXJsKTtcbiAgfVxuXG4gIC8vIOKUgOKUgCBSZWFjdGlvbnMg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5cbiAgb25FbW9qaVNlbGVjdGVkKGVtb2ppOiBzdHJpbmcsIG1lc3NhZ2VJZDogc3RyaW5nKTogdm9pZCB7XG4gICAgdGhpcy5zdG9yZS5hZGRSZWFjdGlvbihtZXNzYWdlSWQsIGVtb2ppKTtcbiAgfVxuXG4gIHRvZ2dsZVJlYWN0aW9uKGVtb2ppOiBzdHJpbmcsIG1lc3NhZ2VJZDogc3RyaW5nKTogdm9pZCB7XG4gICAgY29uc3QgbXNnID0gdGhpcy5tZXNzYWdlcy5maW5kKG0gPT4gbS5tZXNzYWdlX2lkID09PSBtZXNzYWdlSWQpO1xuICAgIGlmICghbXNnKSByZXR1cm47XG4gICAgXG4gICAgY29uc3QgcmVhY3Rpb24gPSBtc2cucmVhY3Rpb25zPy5maW5kKHIgPT4gci5lbW9qaSA9PT0gZW1vamkpO1xuICAgIGlmIChyZWFjdGlvbj8uaGFzUmVhY3RlZCkge1xuICAgICAgdGhpcy5zdG9yZS5yZW1vdmVSZWFjdGlvbihtZXNzYWdlSWQsIGVtb2ppKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5zdG9yZS5hZGRSZWFjdGlvbihtZXNzYWdlSWQsIGVtb2ppKTtcbiAgICB9XG4gIH1cblxuICBnZXRSZWFjdG9yVG9vbHRpcChyZWFjdGlvbjogYW55KTogc3RyaW5nIHtcbiAgICBpZiAoIXJlYWN0aW9uPy5yZWFjdG9ycz8ubGVuZ3RoKSByZXR1cm4gJyc7XG4gICAgcmV0dXJuIHJlYWN0aW9uLnJlYWN0b3JzLmpvaW4oJywgJyk7XG4gIH1cbn1cbiJdfQ==