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

  `, isInline: true, styles: [".chat-thread{display:flex;flex-direction:column;height:100%;background:#041322;position:relative}.chat-thread.drag-over{outline:2px dashed rgba(255,255,255,.45);outline-offset:-6px}.thread-drag-overlay{position:absolute;inset:8px;z-index:20;pointer-events:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:#fff;background:#1f4bd852;border:2px dashed rgba(255,255,255,.55);border-radius:14px;font-size:14px;font-weight:600}.thread-drag-overlay mat-icon{font-size:36px;width:36px;height:36px}.chat-header{display:flex;align-items:center;padding:8px 8px 8px 4px;border-bottom:1px solid rgba(255,255,255,.15);gap:4px;flex-shrink:0}.chat-header button mat-icon{color:#fffc}.chat-name{font-size:16px;font-weight:600;color:#fff}.header-info{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;padding:0 4px}.header-actions{display:flex;gap:0}.header-actions button{width:32px;height:32px}.hdr-btn{border-radius:6px!important;transition:background .15s,box-shadow .15s}.hdr-btn:hover{background:#ffffff26!important;box-shadow:0 2px 8px #0003}.messages-area{flex:1;overflow-y:auto;padding:12px;background:transparent;scrollbar-width:none;-ms-overflow-style:none}.messages-area::-webkit-scrollbar{display:none}.loading-indicator{display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;color:#ffffffb3;font-size:13px}.load-more-btn{align-self:center;margin-bottom:16px;font-size:12px;color:#fff}.messages-list{display:flex;flex-direction:column;gap:1px;flex:1}.date-separator{text-align:center;margin:16px 0 8px;font-size:12px;color:#ffffffb3;font-weight:500}.message-bubble-row{display:flex;flex-direction:column;max-width:88%;margin-bottom:2px}.message-bubble-row.own{align-self:flex-end;align-items:flex-end}.message-bubble-row.other{align-self:flex-start;align-items:flex-start}.sender-name{font-size:11px;font-weight:700;color:#fffffff2;margin-bottom:3px;letter-spacing:.2px;padding:0 10px;text-shadow:0 1px 3px rgba(0,0,0,.4)}.message-bubble{padding:8px 14px 7px;border-radius:14px;font-size:13px;line-height:1.32;word-break:break-word;color:#f5f7ff;position:relative;display:inline-block;min-width:fit-content}.message-bubble-row.other .message-bubble{background:#0d2540;border-bottom-left-radius:5px;box-shadow:0 1px 4px #0006}.message-bubble.own-bubble{background:#0a3d62;border-bottom-right-radius:5px;box-shadow:0 1px 4px #0006}.image-message{line-height:0}.media-img{max-width:220px;max-height:280px;border-radius:10px;display:block;cursor:zoom-in;object-fit:cover;transition:opacity .15s}.media-img:hover{opacity:.88}.media-video{max-width:240px;max-height:260px;border-radius:10px;display:block;background:#000}.video-message{display:flex;flex-direction:column;gap:6px}.video-download{color:#ffffffc7;font-size:12px;text-decoration:underline;text-underline-offset:2px}.media-placeholder{display:flex;align-items:center;gap:8px;min-width:80px;min-height:44px;color:#fff9;font-size:11px}.media-load-label{font-size:11px;color:#fff9}.file-message{display:flex;align-items:center;gap:8px;padding:4px 0}.file-download{display:inline-flex;align-items:center;gap:8px;color:#fff;text-decoration:none;max-width:240px}.file-msg-icon{font-size:20px;width:20px;height:20px;color:#fffc}.file-msg-name{font-size:13px;color:#fff;word-break:break-all}.file-download-icon{font-size:18px;width:18px;height:18px;color:#ffffffb3;flex-shrink:0}.message-meta{display:flex;align-items:center;gap:4px;margin-top:3px}.msg-time{font-size:10px;color:#dae0faa8}.message-bubble-row.other .msg-time{color:#d8dff694}.read-icon{font-size:14px;width:14px;height:14px;opacity:.7}.read-icon.unread{opacity:.4}.quick-reactions{position:absolute;top:-18px;right:0;display:flex;align-items:center;gap:4px;padding:3px 5px;background:#071d30;border:1px solid rgba(255,255,255,.14);border-radius:999px;box-shadow:0 6px 14px #00000047;z-index:4}.message-bubble-row.other .quick-reactions{left:0;right:auto}.message-bubble-row.own .quick-reactions{left:auto;right:0}.quick-emoji-btn{width:20px;height:20px;border:none;border-radius:999px;background:transparent;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:13px;line-height:1;cursor:pointer;padding:0;transition:transform .12s ease,background .12s ease}.quick-emoji-btn:hover{background:#ffffff2e;transform:scale(1.14)}.reactions-row{display:flex;flex-wrap:wrap;gap:3px;margin-top:5px}.reaction-chip{background:#ffffff14;border:1px solid rgba(255,255,255,.2);border-radius:999px;padding:1px 7px;font-size:11px;color:#f2f6ff;cursor:pointer;transition:all .2s}.reaction-chip:hover{background:#ffffff40;transform:scale(1.05)}.reaction-chip.own-reaction{background:#2a5bff4d;border-color:#2a5bff80}.empty-chat{display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;color:#9ca3af}.empty-chat mat-icon{font-size:48px;width:48px;height:48px;margin-bottom:8px}.empty-chat p{font-size:14px;margin:0}\n"], dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i4.NgForOf, selector: "[ngFor][ngForOf]", inputs: ["ngForOf", "ngForTrackBy", "ngForTemplate"] }, { kind: "directive", type: i4.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "ngmodule", type: MatIconModule }, { kind: "component", type: i5.MatIcon, selector: "mat-icon", inputs: ["color", "inline", "svgIcon", "fontSet", "fontIcon"], exportAs: ["matIcon"] }, { kind: "ngmodule", type: MatButtonModule }, { kind: "component", type: i6.MatButton, selector: "    button[mat-button], button[mat-raised-button], button[mat-flat-button],    button[mat-stroked-button]  ", exportAs: ["matButton"] }, { kind: "component", type: i6.MatIconButton, selector: "button[mat-icon-button]", exportAs: ["matButton"] }, { kind: "ngmodule", type: MatProgressSpinnerModule }, { kind: "component", type: i7.MatProgressSpinner, selector: "mat-progress-spinner, mat-spinner", inputs: ["color", "mode", "value", "diameter", "strokeWidth"], exportAs: ["matProgressSpinner"] }, { kind: "ngmodule", type: MatTooltipModule }, { kind: "directive", type: i8.MatTooltip, selector: "[matTooltip]", inputs: ["matTooltipPosition", "matTooltipPositionAtOrigin", "matTooltipDisabled", "matTooltipShowDelay", "matTooltipHideDelay", "matTooltipTouchGestures", "matTooltip", "matTooltipClass"], exportAs: ["matTooltip"] }, { kind: "component", type: MessageInputComponent, selector: "app-message-input", outputs: ["messageSent", "messageWithFiles"] }] });
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

  `, styles: [".chat-thread{display:flex;flex-direction:column;height:100%;background:#041322;position:relative}.chat-thread.drag-over{outline:2px dashed rgba(255,255,255,.45);outline-offset:-6px}.thread-drag-overlay{position:absolute;inset:8px;z-index:20;pointer-events:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:#fff;background:#1f4bd852;border:2px dashed rgba(255,255,255,.55);border-radius:14px;font-size:14px;font-weight:600}.thread-drag-overlay mat-icon{font-size:36px;width:36px;height:36px}.chat-header{display:flex;align-items:center;padding:8px 8px 8px 4px;border-bottom:1px solid rgba(255,255,255,.15);gap:4px;flex-shrink:0}.chat-header button mat-icon{color:#fffc}.chat-name{font-size:16px;font-weight:600;color:#fff}.header-info{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;padding:0 4px}.header-actions{display:flex;gap:0}.header-actions button{width:32px;height:32px}.hdr-btn{border-radius:6px!important;transition:background .15s,box-shadow .15s}.hdr-btn:hover{background:#ffffff26!important;box-shadow:0 2px 8px #0003}.messages-area{flex:1;overflow-y:auto;padding:12px;background:transparent;scrollbar-width:none;-ms-overflow-style:none}.messages-area::-webkit-scrollbar{display:none}.loading-indicator{display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;color:#ffffffb3;font-size:13px}.load-more-btn{align-self:center;margin-bottom:16px;font-size:12px;color:#fff}.messages-list{display:flex;flex-direction:column;gap:1px;flex:1}.date-separator{text-align:center;margin:16px 0 8px;font-size:12px;color:#ffffffb3;font-weight:500}.message-bubble-row{display:flex;flex-direction:column;max-width:88%;margin-bottom:2px}.message-bubble-row.own{align-self:flex-end;align-items:flex-end}.message-bubble-row.other{align-self:flex-start;align-items:flex-start}.sender-name{font-size:11px;font-weight:700;color:#fffffff2;margin-bottom:3px;letter-spacing:.2px;padding:0 10px;text-shadow:0 1px 3px rgba(0,0,0,.4)}.message-bubble{padding:8px 14px 7px;border-radius:14px;font-size:13px;line-height:1.32;word-break:break-word;color:#f5f7ff;position:relative;display:inline-block;min-width:fit-content}.message-bubble-row.other .message-bubble{background:#0d2540;border-bottom-left-radius:5px;box-shadow:0 1px 4px #0006}.message-bubble.own-bubble{background:#0a3d62;border-bottom-right-radius:5px;box-shadow:0 1px 4px #0006}.image-message{line-height:0}.media-img{max-width:220px;max-height:280px;border-radius:10px;display:block;cursor:zoom-in;object-fit:cover;transition:opacity .15s}.media-img:hover{opacity:.88}.media-video{max-width:240px;max-height:260px;border-radius:10px;display:block;background:#000}.video-message{display:flex;flex-direction:column;gap:6px}.video-download{color:#ffffffc7;font-size:12px;text-decoration:underline;text-underline-offset:2px}.media-placeholder{display:flex;align-items:center;gap:8px;min-width:80px;min-height:44px;color:#fff9;font-size:11px}.media-load-label{font-size:11px;color:#fff9}.file-message{display:flex;align-items:center;gap:8px;padding:4px 0}.file-download{display:inline-flex;align-items:center;gap:8px;color:#fff;text-decoration:none;max-width:240px}.file-msg-icon{font-size:20px;width:20px;height:20px;color:#fffc}.file-msg-name{font-size:13px;color:#fff;word-break:break-all}.file-download-icon{font-size:18px;width:18px;height:18px;color:#ffffffb3;flex-shrink:0}.message-meta{display:flex;align-items:center;gap:4px;margin-top:3px}.msg-time{font-size:10px;color:#dae0faa8}.message-bubble-row.other .msg-time{color:#d8dff694}.read-icon{font-size:14px;width:14px;height:14px;opacity:.7}.read-icon.unread{opacity:.4}.quick-reactions{position:absolute;top:-18px;right:0;display:flex;align-items:center;gap:4px;padding:3px 5px;background:#071d30;border:1px solid rgba(255,255,255,.14);border-radius:999px;box-shadow:0 6px 14px #00000047;z-index:4}.message-bubble-row.other .quick-reactions{left:0;right:auto}.message-bubble-row.own .quick-reactions{left:auto;right:0}.quick-emoji-btn{width:20px;height:20px;border:none;border-radius:999px;background:transparent;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:13px;line-height:1;cursor:pointer;padding:0;transition:transform .12s ease,background .12s ease}.quick-emoji-btn:hover{background:#ffffff2e;transform:scale(1.14)}.reactions-row{display:flex;flex-wrap:wrap;gap:3px;margin-top:5px}.reaction-chip{background:#ffffff14;border:1px solid rgba(255,255,255,.2);border-radius:999px;padding:1px 7px;font-size:11px;color:#f2f6ff;cursor:pointer;transition:all .2s}.reaction-chip:hover{background:#ffffff40;transform:scale(1.05)}.reaction-chip.own-reaction{background:#2a5bff4d;border-color:#2a5bff80}.empty-chat{display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;color:#9ca3af}.empty-chat mat-icon{font-size:48px;width:48px;height:48px;margin-bottom:8px}.empty-chat p{font-size:14px;margin:0}\n"] }]
        }], ctorParameters: () => [{ type: i1.MessagingStoreService }, { type: i2.AuthService }, { type: i3.MessagingFileService }, { type: i0.ChangeDetectorRef }], propDecorators: { scrollContainer: [{
                type: ViewChild,
                args: ['scrollContainer']
            }], messageInput: [{
                type: ViewChild,
                args: [MessageInputComponent]
            }], lightboxOpen: [{
                type: Output
            }] } });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdC10aHJlYWQuY29tcG9uZW50LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL2xpYi9jb21wb25lbnRzL2NoYXQtdGhyZWFkL2NoYXQtdGhyZWFkLmNvbXBvbmVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQ0wsU0FBUyxFQUFxQixTQUFTLEVBQ3ZDLE1BQU0sRUFBRSxZQUFZLEdBQ3JCLE1BQU0sZUFBZSxDQUFDO0FBQ3ZCLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUMvQyxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sd0JBQXdCLENBQUM7QUFDdkQsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBQzNELE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQzlFLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBQzdELE9BQU8sRUFBZ0IsYUFBYSxFQUFFLE1BQU0sTUFBTSxDQUFDO0FBSW5ELE9BQU8sRUFBZ0MscUJBQXFCLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUMxSCxPQUFPLEVBQUUscUJBQXFCLEVBQWtCLE1BQU0sMENBQTBDLENBQUM7Ozs7Ozs7Ozs7QUE0a0JqRyxNQUFNLE9BQU8sbUJBQW1CO0lBNkJwQjtJQUNBO0lBQ0E7SUFDQTtJQS9Cb0IsZUFBZSxDQUFjO0lBQ3pCLFlBQVksQ0FBeUI7SUFDN0QsWUFBWSxHQUFHLElBQUksWUFBWSxFQUFVLENBQUM7SUFFcEQsUUFBUSxHQUFjLEVBQUUsQ0FBQztJQUN6QixlQUFlLEdBQWMsRUFBRSxDQUFDO0lBQ2hDLGdCQUFnQixHQUFHLEVBQUUsQ0FBQztJQUN0QixPQUFPLEdBQUcsS0FBSyxDQUFDO0lBQ2hCLE9BQU8sR0FBRyxLQUFLLENBQUM7SUFDaEIsV0FBVyxHQUFrQixJQUFJLENBQUM7SUFFMUIs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QUFyQixNQUFNIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtcbiAgQ29tcG9uZW50LCBPbkluaXQsIE9uRGVzdHJveSwgVmlld0NoaWxkLCBFbGVtZW50UmVmLCBBZnRlclZpZXdDaGVja2VkLCBDaGFuZ2VEZXRlY3RvclJlZixcbiAgT3V0cHV0LCBFdmVudEVtaXR0ZXIsXG59IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xuaW1wb3J0IHsgQ29tbW9uTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvY29tbW9uJztcbmltcG9ydCB7IE1hdEljb25Nb2R1bGUgfSBmcm9tICdAYW5ndWxhci9tYXRlcmlhbC9pY29uJztcbmltcG9ydCB7IE1hdEJ1dHRvbk1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL21hdGVyaWFsL2J1dHRvbic7XG5pbXBvcnQgeyBNYXRQcm9ncmVzc1NwaW5uZXJNb2R1bGUgfSBmcm9tICdAYW5ndWxhci9tYXRlcmlhbC9wcm9ncmVzcy1zcGlubmVyJztcbmltcG9ydCB7IE1hdFRvb2x0aXBNb2R1bGUgfSBmcm9tICdAYW5ndWxhci9tYXRlcmlhbC90b29sdGlwJztcbmltcG9ydCB7IFN1YnNjcmlwdGlvbiwgY29tYmluZUxhdGVzdCB9IGZyb20gJ3J4anMnO1xuaW1wb3J0IHsgTWVzc2FnaW5nU3RvcmVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvbWVzc2FnaW5nLXN0b3JlLnNlcnZpY2UnO1xuaW1wb3J0IHsgTWVzc2FnaW5nRmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9tZXNzYWdpbmctZmlsZS5zZXJ2aWNlJztcbmltcG9ydCB7IEF1dGhTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvYXV0aC5zZXJ2aWNlJztcbmltcG9ydCB7IENvbnRhY3QsIE1lc3NhZ2UsIEF0dGFjaG1lbnQsIGdldENvbnRhY3REaXNwbGF5TmFtZSwgZ2V0TWVzc2FnZVNlbmRlck5hbWUgfSBmcm9tICcuLi8uLi9tb2RlbHMvbWVzc2FnaW5nLm1vZGVscyc7XG5pbXBvcnQgeyBNZXNzYWdlSW5wdXRDb21wb25lbnQsIE1lc3NhZ2VQYXlsb2FkIH0gZnJvbSAnLi4vbWVzc2FnZS1pbnB1dC9tZXNzYWdlLWlucHV0LmNvbXBvbmVudCc7XG5cbkBDb21wb25lbnQoe1xuICBzZWxlY3RvcjogJ2FwcC1jaGF0LXRocmVhZCcsXG4gIHN0YW5kYWxvbmU6IHRydWUsXG4gIGltcG9ydHM6IFtcbiAgICBDb21tb25Nb2R1bGUsIE1hdEljb25Nb2R1bGUsIE1hdEJ1dHRvbk1vZHVsZSxcbiAgICBNYXRQcm9ncmVzc1NwaW5uZXJNb2R1bGUsIE1hdFRvb2x0aXBNb2R1bGUsIE1lc3NhZ2VJbnB1dENvbXBvbmVudCxcbiAgXSxcbiAgdGVtcGxhdGU6IGBcbiAgICA8ZGl2XG4gICAgICBjbGFzcz1cImNoYXQtdGhyZWFkXCJcbiAgICAgIFtjbGFzcy5kcmFnLW92ZXJdPVwidGhyZWFkRHJhZ092ZXJcIlxuICAgICAgKGRyYWdlbnRlcik9XCJvblRocmVhZERyYWdFbnRlcigkZXZlbnQpXCJcbiAgICAgIChkcmFnb3Zlcik9XCJvblRocmVhZERyYWdPdmVyKCRldmVudClcIlxuICAgICAgKGRyYWdsZWF2ZSk9XCJvblRocmVhZERyYWdMZWF2ZSgkZXZlbnQpXCJcbiAgICAgIChkcm9wKT1cIm9uVGhyZWFkRHJvcCgkZXZlbnQpXCJcbiAgICA+XG4gICAgICA8ZGl2IGNsYXNzPVwiY2hhdC1oZWFkZXJcIj5cbiAgICAgICAgPGJ1dHRvbiBtYXQtaWNvbi1idXR0b24gY2xhc3M9XCJoZHItYnRuXCIgKGNsaWNrKT1cImdvQmFjaygpXCIgbWF0VG9vbHRpcD1cIkJhY2tcIiBtYXRUb29sdGlwUG9zaXRpb249XCJiZWxvd1wiPlxuICAgICAgICAgIDxtYXQtaWNvbj5hcnJvd19iYWNrPC9tYXQtaWNvbj5cbiAgICAgICAgPC9idXR0b24+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJoZWFkZXItaW5mb1wiPlxuICAgICAgICAgIDxzcGFuIGNsYXNzPVwiY2hhdC1uYW1lXCI+e3sgY29udmVyc2F0aW9uTmFtZSB9fTwvc3Bhbj5cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJoZWFkZXItYWN0aW9uc1wiPlxuICAgICAgICAgIDxidXR0b24gKm5nSWY9XCJpc0dyb3VwXCIgbWF0LWljb24tYnV0dG9uIGNsYXNzPVwiaGRyLWJ0blwiIChjbGljayk9XCJvbkdyb3VwU2V0dGluZ3MoKVwiIG1hdFRvb2x0aXA9XCJHcm91cCBzZXR0aW5nc1wiIG1hdFRvb2x0aXBQb3NpdGlvbj1cImJlbG93XCI+XG4gICAgICAgICAgICA8bWF0LWljb24+c2V0dGluZ3M8L21hdC1pY29uPlxuICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuXG4gICAgICA8ZGl2IGNsYXNzPVwibWVzc2FnZXMtYXJlYVwiICNzY3JvbGxDb250YWluZXIgKHNjcm9sbCk9XCJvblNjcm9sbCgpXCI+XG4gICAgICAgIDxkaXYgKm5nSWY9XCJ0aHJlYWREcmFnT3ZlclwiIGNsYXNzPVwidGhyZWFkLWRyYWctb3ZlcmxheVwiPlxuICAgICAgICAgIDxtYXQtaWNvbj5jbG91ZF91cGxvYWQ8L21hdC1pY29uPlxuICAgICAgICAgIDxzcGFuPkRyb3AgZmlsZXMgYW55d2hlcmUgaW4gdGhpcyBjaGF0PC9zcGFuPlxuICAgICAgICA8L2Rpdj5cblxuICAgICAgICA8ZGl2ICpuZ0lmPVwibG9hZGluZ1wiIGNsYXNzPVwibG9hZGluZy1pbmRpY2F0b3JcIj5cbiAgICAgICAgICA8bWF0LXNwaW5uZXIgZGlhbWV0ZXI9XCIyNFwiPjwvbWF0LXNwaW5uZXI+XG4gICAgICAgICAgPHNwYW4+TG9hZGluZyBtZXNzYWdlcy4uLjwvc3Bhbj5cbiAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICpuZ0lmPVwibWVzc2FnZXMubGVuZ3RoID49IDUwICYmICFsb2FkaW5nXCJcbiAgICAgICAgICBtYXQtc3Ryb2tlZC1idXR0b25cbiAgICAgICAgICBjbGFzcz1cImxvYWQtbW9yZS1idG5cIlxuICAgICAgICAgIChjbGljayk9XCJsb2FkT2xkZXIoKVwiXG4gICAgICAgID5cbiAgICAgICAgICBMb2FkIG9sZGVyIG1lc3NhZ2VzXG4gICAgICAgIDwvYnV0dG9uPlxuXG4gICAgICAgIDxkaXYgY2xhc3M9XCJtZXNzYWdlcy1saXN0XCI+XG4gICAgICAgICAgPG5nLWNvbnRhaW5lciAqbmdGb3I9XCJsZXQgbXNnIG9mIG1lc3NhZ2VzOyBsZXQgaSA9IGluZGV4XCI+XG4gICAgICAgICAgICA8ZGl2XG4gICAgICAgICAgICAgICpuZ0lmPVwic2hvdWxkU2hvd0RhdGVTZXBhcmF0b3IoaSlcIlxuICAgICAgICAgICAgICBjbGFzcz1cImRhdGUtc2VwYXJhdG9yXCJcbiAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgPHNwYW4+e3sgZm9ybWF0RGF0ZShtc2cuY3JlYXRlZF9hdCkgfX08L3NwYW4+XG4gICAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgICAgPGRpdlxuICAgICAgICAgICAgICBjbGFzcz1cIm1lc3NhZ2UtYnViYmxlLXJvd1wiXG4gICAgICAgICAgICAgIFtjbGFzcy5vd25dPVwiaXNPd25NZXNzYWdlKG1zZylcIlxuICAgICAgICAgICAgICBbY2xhc3Mub3RoZXJdPVwiIWlzT3duTWVzc2FnZShtc2cpXCJcbiAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgPGRpdiAqbmdJZj1cIiFpc093bk1lc3NhZ2UobXNnKVwiIGNsYXNzPVwic2VuZGVyLW5hbWVcIj5cbiAgICAgICAgICAgICAgICB7eyBnZXRTZW5kZXJOYW1lKG1zZykgfX1cbiAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJtZXNzYWdlLWJ1YmJsZVwiIFtjbGFzcy5vd24tYnViYmxlXT1cImlzT3duTWVzc2FnZShtc2cpXCIgKG1vdXNlZW50ZXIpPVwiaG92ZXJlZE1lc3NhZ2VJZCA9IG1zZy5tZXNzYWdlX2lkXCIgKG1vdXNlbGVhdmUpPVwiaG92ZXJlZE1lc3NhZ2VJZCA9IG51bGxcIj5cbiAgICAgICAgICAgICAgICA8IS0tIElNQUdFIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgCAtLT5cbiAgICAgICAgICAgICAgICA8ZGl2ICpuZ0lmPVwiaXNJbWFnZUF0dGFjaG1lbnQobXNnKVwiIGNsYXNzPVwiaW1hZ2UtbWVzc2FnZVwiPlxuICAgICAgICAgICAgICAgICAgPG5nLWNvbnRhaW5lciAqbmdJZj1cImdldE1lZGlhVXJsKG1zZykgYXMgZGF0YVVybDsgZWxzZSBpbWdGYWxsYmFja1wiPlxuICAgICAgICAgICAgICAgICAgICA8aW1nIFtzcmNdPVwiZGF0YVVybFwiIGFsdD1cIkltYWdlXCIgY2xhc3M9XCJtZWRpYS1pbWdcIiAoY2xpY2spPVwib3BlbkxpZ2h0Ym94KGRhdGFVcmwpXCIgLz5cbiAgICAgICAgICAgICAgICAgIDwvbmctY29udGFpbmVyPlxuICAgICAgICAgICAgICAgICAgPG5nLXRlbXBsYXRlICNpbWdGYWxsYmFjaz5cbiAgICAgICAgICAgICAgICAgICAgPGRpdiAqbmdJZj1cInNob3VsZFNob3dNZWRpYVNwaW5uZXIobXNnKTsgZWxzZSBpbWdBc0ZpbGVcIiBjbGFzcz1cIm1lZGlhLXBsYWNlaG9sZGVyXCI+XG4gICAgICAgICAgICAgICAgICAgICAgPG1hdC1zcGlubmVyIGRpYW1ldGVyPVwiMjJcIj48L21hdC1zcGlubmVyPlxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgPG5nLXRlbXBsYXRlICNpbWdBc0ZpbGU+XG4gICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZpbGUtbWVzc2FnZVwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgPG1hdC1pY29uIGNsYXNzPVwiZmlsZS1tc2ctaWNvblwiPmltYWdlPC9tYXQtaWNvbj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwiZmlsZS1tc2ctbmFtZVwiPnt7IGdldEF0dGFjaG1lbnROYW1lKG1zZykgfX08L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgIDwvbmctdGVtcGxhdGU+XG4gICAgICAgICAgICAgICAgICA8L25nLXRlbXBsYXRlPlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgICAgICAgICAgPCEtLSBGSUxFIC8gVklERU8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAIC0tPlxuICAgICAgICAgICAgICAgIDxkaXYgKm5nSWY9XCJoYXNGaWxlQXR0YWNobWVudChtc2cpICYmICFpc0ltYWdlQXR0YWNobWVudChtc2cpXCIgY2xhc3M9XCJmaWxlLW1lc3NhZ2VcIj5cbiAgICAgICAgICAgICAgICAgIDxuZy1jb250YWluZXIgKm5nSWY9XCJpc1ZpZGVvQXR0YWNobWVudChtc2cpOyBlbHNlIHJlZ3VsYXJGaWxlXCI+XG4gICAgICAgICAgICAgICAgICAgIDxuZy1jb250YWluZXIgKm5nSWY9XCJnZXRNZWRpYVVybChtc2cpIGFzIHZpZGVvVXJsOyBlbHNlIHZpZGVvTG9hZGluZ1wiPlxuICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ2aWRlby1tZXNzYWdlXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICA8dmlkZW8gY29udHJvbHMgY2xhc3M9XCJtZWRpYS12aWRlb1wiIHByZWxvYWQ9XCJtZXRhZGF0YVwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICA8c291cmNlIFtzcmNdPVwidmlkZW9VcmxcIiBbdHlwZV09XCJnZXRBdHRhY2htZW50TWltZVR5cGUobXNnKVwiIC8+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIFlvdXIgYnJvd3NlciBkb2VzIG5vdCBzdXBwb3J0IHZpZGVvLlxuICAgICAgICAgICAgICAgICAgICAgICAgPC92aWRlbz5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxhXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzPVwidmlkZW8tZG93bmxvYWRcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICBbaHJlZl09XCJ2aWRlb1VybFwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgIFthdHRyLmRvd25sb2FkXT1cImdldEF0dGFjaG1lbnROYW1lKG1zZylcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICB0YXJnZXQ9XCJfYmxhbmtcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICByZWw9XCJub29wZW5lclwiXG4gICAgICAgICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIERvd25sb2FkIHt7IGdldEF0dGFjaG1lbnROYW1lKG1zZykgfX1cbiAgICAgICAgICAgICAgICAgICAgICAgIDwvYT5cbiAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgPC9uZy1jb250YWluZXI+XG4gICAgICAgICAgICAgICAgICAgIDxuZy10ZW1wbGF0ZSAjdmlkZW9Mb2FkaW5nPlxuICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJtZWRpYS1wbGFjZWhvbGRlclwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgPG1hdC1zcGlubmVyIGRpYW1ldGVyPVwiMjJcIj48L21hdC1zcGlubmVyPlxuICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJtZWRpYS1sb2FkLWxhYmVsXCI+TG9hZGluZyB2aWRlb+KApjwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgPC9uZy10ZW1wbGF0ZT5cbiAgICAgICAgICAgICAgICAgIDwvbmctY29udGFpbmVyPlxuICAgICAgICAgICAgICAgICAgPG5nLXRlbXBsYXRlICNyZWd1bGFyRmlsZT5cbiAgICAgICAgICAgICAgICAgICAgPG5nLWNvbnRhaW5lciAqbmdJZj1cImdldE1lZGlhVXJsKG1zZykgYXMgZmlsZVVybDsgZWxzZSBmaWxlTG9hZGluZ1wiPlxuICAgICAgICAgICAgICAgICAgICAgIDxhXG4gICAgICAgICAgICAgICAgICAgICAgICBjbGFzcz1cImZpbGUtZG93bmxvYWRcIlxuICAgICAgICAgICAgICAgICAgICAgICAgW2hyZWZdPVwiZmlsZVVybFwiXG4gICAgICAgICAgICAgICAgICAgICAgICBbYXR0ci5kb3dubG9hZF09XCJnZXRBdHRhY2htZW50TmFtZShtc2cpXCJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRhcmdldD1cIl9ibGFua1wiXG4gICAgICAgICAgICAgICAgICAgICAgICByZWw9XCJub29wZW5lclwiXG4gICAgICAgICAgICAgICAgICAgICAgICAoY2xpY2spPVwiJGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpXCJcbiAgICAgICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgICAgICA8bWF0LWljb24gY2xhc3M9XCJmaWxlLW1zZy1pY29uXCI+e3sgZ2V0RmlsZUljb24obXNnKSB9fTwvbWF0LWljb24+XG4gICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cImZpbGUtbXNnLW5hbWVcIj57eyBnZXRBdHRhY2htZW50TmFtZShtc2cpIH19PC9zcGFuPlxuICAgICAgICAgICAgICAgICAgICAgICAgPG1hdC1pY29uIGNsYXNzPVwiZmlsZS1kb3dubG9hZC1pY29uXCI+ZG93bmxvYWQ8L21hdC1pY29uPlxuICAgICAgICAgICAgICAgICAgICAgIDwvYT5cbiAgICAgICAgICAgICAgICAgICAgPC9uZy1jb250YWluZXI+XG4gICAgICAgICAgICAgICAgICAgIDxuZy10ZW1wbGF0ZSAjZmlsZUxvYWRpbmc+XG4gICAgICAgICAgICAgICAgICAgICAgPG1hdC1pY29uIGNsYXNzPVwiZmlsZS1tc2ctaWNvblwiPnt7IGdldEZpbGVJY29uKG1zZykgfX08L21hdC1pY29uPlxuICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwiZmlsZS1tc2ctbmFtZVwiPnt7IGdldEF0dGFjaG1lbnROYW1lKG1zZykgfX08L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgICAgPG1hdC1zcGlubmVyICpuZ0lmPVwic2hvdWxkU2hvd01lZGlhU3Bpbm5lcihtc2cpXCIgZGlhbWV0ZXI9XCIxOFwiPjwvbWF0LXNwaW5uZXI+XG4gICAgICAgICAgICAgICAgICAgICAgPHNwYW4gKm5nSWY9XCJoYXNNZWRpYUZhaWxlZChtc2cpXCIgY2xhc3M9XCJtZWRpYS1sb2FkLWxhYmVsXCI+VW5hdmFpbGFibGU8L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgIDwvbmctdGVtcGxhdGU+XG4gICAgICAgICAgICAgICAgICA8L25nLXRlbXBsYXRlPlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDxkaXZcbiAgICAgICAgICAgICAgICAgICpuZ0lmPVwibXNnLm1lc3NhZ2VfdHlwZSA9PT0gJ1RFWFQnICYmICFpc0ltYWdlQXR0YWNobWVudChtc2cpICYmICFoYXNGaWxlQXR0YWNobWVudChtc2cpXCJcbiAgICAgICAgICAgICAgICAgIGNsYXNzPVwidGV4dC1jb250ZW50XCJcbiAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICB7eyBtc2cuY29udGVudCB9fVxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJtZXNzYWdlLW1ldGFcIj5cbiAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwibXNnLXRpbWVcIj57eyBmb3JtYXRUaW1lKG1zZy5jcmVhdGVkX2F0KSB9fTwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgIDxtYXQtaWNvbiAqbmdJZj1cImlzT3duTWVzc2FnZShtc2cpICYmIG1zZy5pc19yZWFkXCIgY2xhc3M9XCJyZWFkLWljb25cIj5kb25lX2FsbDwvbWF0LWljb24+XG4gICAgICAgICAgICAgICAgICA8bWF0LWljb24gKm5nSWY9XCJpc093bk1lc3NhZ2UobXNnKSAmJiAhbXNnLmlzX3JlYWRcIiBjbGFzcz1cInJlYWQtaWNvbiB1bnJlYWRcIj5kb25lPC9tYXQtaWNvbj5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICA8ZGl2ICpuZ0lmPVwiaG92ZXJlZE1lc3NhZ2VJZCA9PT0gbXNnLm1lc3NhZ2VfaWRcIiBjbGFzcz1cInF1aWNrLXJlYWN0aW9uc1wiPlxuICAgICAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgICAgICAqbmdGb3I9XCJsZXQgZW1vamkgb2YgcXVpY2tFbW9qaXNcIlxuICAgICAgICAgICAgICAgICAgICBjbGFzcz1cInF1aWNrLWVtb2ppLWJ0blwiXG4gICAgICAgICAgICAgICAgICAgIChjbGljayk9XCJvbkVtb2ppU2VsZWN0ZWQoZW1vamksIG1zZy5tZXNzYWdlX2lkKVwiXG4gICAgICAgICAgICAgICAgICAgIFthdHRyLmFyaWEtbGFiZWxdPVwiJ1JlYWN0IHdpdGggJyArIGVtb2ppXCJcbiAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAge3sgZW1vamkgfX1cbiAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDxkaXYgKm5nSWY9XCJtc2cucmVhY3Rpb25zICYmIG1zZy5yZWFjdGlvbnMubGVuZ3RoID4gMFwiIGNsYXNzPVwicmVhY3Rpb25zLXJvd1wiPlxuICAgICAgICAgICAgICAgICAgPGJ1dHRvbiBcbiAgICAgICAgICAgICAgICAgICAgKm5nRm9yPVwibGV0IHIgb2YgbXNnLnJlYWN0aW9uc1wiIFxuICAgICAgICAgICAgICAgICAgICBjbGFzcz1cInJlYWN0aW9uLWNoaXBcIlxuICAgICAgICAgICAgICAgICAgICAoY2xpY2spPVwidG9nZ2xlUmVhY3Rpb24oci5lbW9qaSwgbXNnLm1lc3NhZ2VfaWQpXCJcbiAgICAgICAgICAgICAgICAgICAgW2NsYXNzLm93bi1yZWFjdGlvbl09XCJyLmhhc1JlYWN0ZWRcIlxuICAgICAgICAgICAgICAgICAgICBbbWF0VG9vbHRpcF09XCJnZXRSZWFjdG9yVG9vbHRpcChyKVwiXG4gICAgICAgICAgICAgICAgICAgIG1hdFRvb2x0aXBQb3NpdGlvbj1cImFib3ZlXCJcbiAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAge3sgci5lbW9qaSB9fSB7eyByLmNvdW50IH19XG4gICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8L25nLWNvbnRhaW5lcj5cbiAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgPGRpdiAqbmdJZj1cIm1lc3NhZ2VzLmxlbmd0aCA9PT0gMCAmJiAhbG9hZGluZ1wiIGNsYXNzPVwiZW1wdHktY2hhdFwiPlxuICAgICAgICAgIDxtYXQtaWNvbj5jaGF0X2J1YmJsZV9vdXRsaW5lPC9tYXQtaWNvbj5cbiAgICAgICAgICA8cD5ObyBtZXNzYWdlcyB5ZXQuIFNheSBoZWxsbyE8L3A+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG5cbiAgICAgIDxhcHAtbWVzc2FnZS1pbnB1dFxuICAgICAgICAobWVzc2FnZVNlbnQpPVwib25TZW5kTWVzc2FnZSgkZXZlbnQpXCJcbiAgICAgICAgKG1lc3NhZ2VXaXRoRmlsZXMpPVwib25TZW5kV2l0aEZpbGVzKCRldmVudClcIlxuICAgICAgPjwvYXBwLW1lc3NhZ2UtaW5wdXQ+XG4gICAgPC9kaXY+XG5cbiAgYCxcbiAgc3R5bGVzOiBbYFxuICAgIC5jaGF0LXRocmVhZCB7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICAgIGhlaWdodDogMTAwJTtcbiAgICAgIGJhY2tncm91bmQ6ICMwNDEzMjI7XG4gICAgICBwb3NpdGlvbjogcmVsYXRpdmU7XG4gICAgfVxuXG4gICAgLmNoYXQtdGhyZWFkLmRyYWctb3ZlciB7XG4gICAgICBvdXRsaW5lOiAycHggZGFzaGVkIHJnYmEoMjU1LCAyNTUsIDI1NSwgMC40NSk7XG4gICAgICBvdXRsaW5lLW9mZnNldDogLTZweDtcbiAgICB9XG5cbiAgICAudGhyZWFkLWRyYWctb3ZlcmxheSB7XG4gICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XG4gICAgICBpbnNldDogOHB4O1xuICAgICAgei1pbmRleDogMjA7XG4gICAgICBwb2ludGVyLWV2ZW50czogbm9uZTtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgICAgZ2FwOiA4cHg7XG4gICAgICBjb2xvcjogI2ZmZjtcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMzEsIDc1LCAyMTYsIDAuMzIpO1xuICAgICAgYm9yZGVyOiAycHggZGFzaGVkIHJnYmEoMjU1LCAyNTUsIDI1NSwgMC41NSk7XG4gICAgICBib3JkZXItcmFkaXVzOiAxNHB4O1xuICAgICAgZm9udC1zaXplOiAxNHB4O1xuICAgICAgZm9udC13ZWlnaHQ6IDYwMDtcbiAgICB9XG5cbiAgICAudGhyZWFkLWRyYWctb3ZlcmxheSBtYXQtaWNvbiB7XG4gICAgICBmb250LXNpemU6IDM2cHg7XG4gICAgICB3aWR0aDogMzZweDtcbiAgICAgIGhlaWdodDogMzZweDtcbiAgICB9XG5cbiAgICAuY2hhdC1oZWFkZXIge1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBwYWRkaW5nOiA4cHggOHB4IDhweCA0cHg7XG4gICAgICBib3JkZXItYm90dG9tOiAxcHggc29saWQgcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjE1KTtcbiAgICAgIGdhcDogNHB4O1xuICAgICAgZmxleC1zaHJpbms6IDA7XG4gICAgfVxuXG4gICAgLmNoYXQtaGVhZGVyIGJ1dHRvbiBtYXQtaWNvbiB7XG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjgpO1xuICAgIH1cblxuICAgIC5jaGF0LW5hbWUge1xuICAgICAgZm9udC1zaXplOiAxNnB4O1xuICAgICAgZm9udC13ZWlnaHQ6IDYwMDtcbiAgICAgIGNvbG9yOiAjZmZmO1xuICAgIH1cblxuICAgIC5oZWFkZXItaW5mbyB7XG4gICAgICBmbGV4OiAxO1xuICAgICAgd2hpdGUtc3BhY2U6IG5vd3JhcDtcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICB0ZXh0LW92ZXJmbG93OiBlbGxpcHNpcztcbiAgICAgIGRpc3BsYXk6IGJsb2NrO1xuICAgICAgcGFkZGluZzogMCA0cHg7XG4gICAgfVxuXG4gICAgLmhlYWRlci1hY3Rpb25zIHtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBnYXA6IDA7XG4gICAgfVxuXG4gICAgLmhlYWRlci1hY3Rpb25zIGJ1dHRvbiB7XG4gICAgICB3aWR0aDogMzJweDtcbiAgICAgIGhlaWdodDogMzJweDtcbiAgICB9XG5cbiAgICAuaGRyLWJ0biB7XG4gICAgICBib3JkZXItcmFkaXVzOiA2cHggIWltcG9ydGFudDtcbiAgICAgIHRyYW5zaXRpb246IGJhY2tncm91bmQgMC4xNXMsIGJveC1zaGFkb3cgMC4xNXM7XG4gICAgfVxuXG4gICAgLmhkci1idG46aG92ZXIge1xuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjE1KSAhaW1wb3J0YW50O1xuICAgICAgYm94LXNoYWRvdzogMCAycHggOHB4IHJnYmEoMCwgMCwgMCwgMC4yKTtcbiAgICB9XG5cbiAgICAubWVzc2FnZXMtYXJlYSB7XG4gICAgICBmbGV4OiAxO1xuICAgICAgb3ZlcmZsb3cteTogYXV0bztcbiAgICAgIHBhZGRpbmc6IDEycHg7XG4gICAgICBiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudDtcbiAgICAgIHNjcm9sbGJhci13aWR0aDogbm9uZTtcbiAgICAgIC1tcy1vdmVyZmxvdy1zdHlsZTogbm9uZTtcbiAgICB9XG5cbiAgICAubWVzc2FnZXMtYXJlYTo6LXdlYmtpdC1zY3JvbGxiYXIge1xuICAgICAgZGlzcGxheTogbm9uZTtcbiAgICB9XG5cbiAgICAubG9hZGluZy1pbmRpY2F0b3Ige1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgIGdhcDogOHB4O1xuICAgICAgcGFkZGluZzogMTJweDtcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNyk7XG4gICAgICBmb250LXNpemU6IDEzcHg7XG4gICAgfVxuXG4gICAgLmxvYWQtbW9yZS1idG4ge1xuICAgICAgYWxpZ24tc2VsZjogY2VudGVyO1xuICAgICAgbWFyZ2luLWJvdHRvbTogMTZweDtcbiAgICAgIGZvbnQtc2l6ZTogMTJweDtcbiAgICAgIGNvbG9yOiAjZmZmO1xuICAgIH1cblxuICAgIC5tZXNzYWdlcy1saXN0IHtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgZ2FwOiAxcHg7XG4gICAgICBmbGV4OiAxO1xuICAgIH1cblxuICAgIC5kYXRlLXNlcGFyYXRvciB7XG4gICAgICB0ZXh0LWFsaWduOiBjZW50ZXI7XG4gICAgICBtYXJnaW46IDE2cHggMCA4cHg7XG4gICAgICBmb250LXNpemU6IDEycHg7XG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjcpO1xuICAgICAgZm9udC13ZWlnaHQ6IDUwMDtcbiAgICB9XG5cbiAgICAubWVzc2FnZS1idWJibGUtcm93IHtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgbWF4LXdpZHRoOiA4OCU7XG4gICAgICBtYXJnaW4tYm90dG9tOiAycHg7XG4gICAgfVxuXG4gICAgLm1lc3NhZ2UtYnViYmxlLXJvdy5vd24ge1xuICAgICAgYWxpZ24tc2VsZjogZmxleC1lbmQ7XG4gICAgICBhbGlnbi1pdGVtczogZmxleC1lbmQ7XG4gICAgfVxuXG4gICAgLm1lc3NhZ2UtYnViYmxlLXJvdy5vdGhlciB7XG4gICAgICBhbGlnbi1zZWxmOiBmbGV4LXN0YXJ0O1xuICAgICAgYWxpZ24taXRlbXM6IGZsZXgtc3RhcnQ7XG4gICAgfVxuXG4gICAgLnNlbmRlci1uYW1lIHtcbiAgICAgIGZvbnQtc2l6ZTogMTFweDtcbiAgICAgIGZvbnQtd2VpZ2h0OiA3MDA7XG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjk1KTtcbiAgICAgIG1hcmdpbi1ib3R0b206IDNweDtcbiAgICAgIGxldHRlci1zcGFjaW5nOiAwLjJweDtcbiAgICAgIHBhZGRpbmc6IDAgMTBweDtcbiAgICAgIHRleHQtc2hhZG93OiAwIDFweCAzcHggcmdiYSgwLCAwLCAwLCAwLjQpO1xuICAgIH1cblxuICAgIC5tZXNzYWdlLWJ1YmJsZSB7XG4gICAgICBwYWRkaW5nOiA4cHggMTRweCA3cHg7XG4gICAgICBib3JkZXItcmFkaXVzOiAxNHB4O1xuICAgICAgZm9udC1zaXplOiAxM3B4O1xuICAgICAgbGluZS1oZWlnaHQ6IDEuMzI7XG4gICAgICB3b3JkLWJyZWFrOiBicmVhay13b3JkO1xuICAgICAgY29sb3I6ICNmNWY3ZmY7XG4gICAgICBwb3NpdGlvbjogcmVsYXRpdmU7XG4gICAgICBkaXNwbGF5OiBpbmxpbmUtYmxvY2s7XG4gICAgICBtaW4td2lkdGg6IGZpdC1jb250ZW50O1xuICAgIH1cblxuICAgIC5tZXNzYWdlLWJ1YmJsZS1yb3cub3RoZXIgLm1lc3NhZ2UtYnViYmxlIHtcbiAgICAgIGJhY2tncm91bmQ6ICMwZDI1NDA7XG4gICAgICBib3JkZXItYm90dG9tLWxlZnQtcmFkaXVzOiA1cHg7XG4gICAgICBib3gtc2hhZG93OiAwIDFweCA0cHggcmdiYSgwLCAwLCAwLCAwLjQpO1xuICAgIH1cblxuICAgIC5tZXNzYWdlLWJ1YmJsZS5vd24tYnViYmxlIHtcbiAgICAgIGJhY2tncm91bmQ6ICMwYTNkNjI7XG4gICAgICBib3JkZXItYm90dG9tLXJpZ2h0LXJhZGl1czogNXB4O1xuICAgICAgYm94LXNoYWRvdzogMCAxcHggNHB4IHJnYmEoMCwgMCwgMCwgMC40KTtcbiAgICB9XG5cbiAgICAuaW1hZ2UtbWVzc2FnZSB7XG4gICAgICBsaW5lLWhlaWdodDogMDtcbiAgICB9XG5cbiAgICAubWVkaWEtaW1nIHtcbiAgICAgIG1heC13aWR0aDogMjIwcHg7XG4gICAgICBtYXgtaGVpZ2h0OiAyODBweDtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDEwcHg7XG4gICAgICBkaXNwbGF5OiBibG9jaztcbiAgICAgIGN1cnNvcjogem9vbS1pbjtcbiAgICAgIG9iamVjdC1maXQ6IGNvdmVyO1xuICAgICAgdHJhbnNpdGlvbjogb3BhY2l0eSAwLjE1cztcbiAgICB9XG5cbiAgICAubWVkaWEtaW1nOmhvdmVyIHtcbiAgICAgIG9wYWNpdHk6IDAuODg7XG4gICAgfVxuXG4gICAgLm1lZGlhLXZpZGVvIHtcbiAgICAgIG1heC13aWR0aDogMjQwcHg7XG4gICAgICBtYXgtaGVpZ2h0OiAyNjBweDtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDEwcHg7XG4gICAgICBkaXNwbGF5OiBibG9jaztcbiAgICAgIGJhY2tncm91bmQ6ICMwMDA7XG4gICAgfVxuXG4gICAgLnZpZGVvLW1lc3NhZ2Uge1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAgICBnYXA6IDZweDtcbiAgICB9XG5cbiAgICAudmlkZW8tZG93bmxvYWQge1xuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC43OCk7XG4gICAgICBmb250LXNpemU6IDEycHg7XG4gICAgICB0ZXh0LWRlY29yYXRpb246IHVuZGVybGluZTtcbiAgICAgIHRleHQtdW5kZXJsaW5lLW9mZnNldDogMnB4O1xuICAgIH1cblxuICAgIC5tZWRpYS1wbGFjZWhvbGRlciB7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGdhcDogOHB4O1xuICAgICAgbWluLXdpZHRoOiA4MHB4O1xuICAgICAgbWluLWhlaWdodDogNDRweDtcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwyNTUsMjU1LDAuNik7XG4gICAgICBmb250LXNpemU6IDExcHg7XG4gICAgfVxuXG4gICAgLm1lZGlhLWxvYWQtbGFiZWwge1xuICAgICAgZm9udC1zaXplOiAxMXB4O1xuICAgICAgY29sb3I6IHJnYmEoMjU1LDI1NSwyNTUsMC42KTtcbiAgICB9XG5cbiAgICAuZmlsZS1tZXNzYWdlIHtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgZ2FwOiA4cHg7XG4gICAgICBwYWRkaW5nOiA0cHggMDtcbiAgICB9XG5cbiAgICAuZmlsZS1kb3dubG9hZCB7XG4gICAgICBkaXNwbGF5OiBpbmxpbmUtZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBnYXA6IDhweDtcbiAgICAgIGNvbG9yOiAjZmZmO1xuICAgICAgdGV4dC1kZWNvcmF0aW9uOiBub25lO1xuICAgICAgbWF4LXdpZHRoOiAyNDBweDtcbiAgICB9XG5cbiAgICAuZmlsZS1tc2ctaWNvbiB7XG4gICAgICBmb250LXNpemU6IDIwcHg7XG4gICAgICB3aWR0aDogMjBweDtcbiAgICAgIGhlaWdodDogMjBweDtcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuOCk7XG4gICAgfVxuXG4gICAgLmZpbGUtbXNnLW5hbWUge1xuICAgICAgZm9udC1zaXplOiAxM3B4O1xuICAgICAgY29sb3I6ICNmZmY7XG4gICAgICB3b3JkLWJyZWFrOiBicmVhay1hbGw7XG4gICAgfVxuXG4gICAgLmZpbGUtZG93bmxvYWQtaWNvbiB7XG4gICAgICBmb250LXNpemU6IDE4cHg7XG4gICAgICB3aWR0aDogMThweDtcbiAgICAgIGhlaWdodDogMThweDtcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNyk7XG4gICAgICBmbGV4LXNocmluazogMDtcbiAgICB9XG5cbiAgICAubWVzc2FnZS1tZXRhIHtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgZ2FwOiA0cHg7XG4gICAgICBtYXJnaW4tdG9wOiAzcHg7XG4gICAgfVxuXG4gICAgLm1zZy10aW1lIHtcbiAgICAgIGZvbnQtc2l6ZTogMTBweDtcbiAgICAgIGNvbG9yOiByZ2JhKDIxOCwgMjI0LCAyNTAsIDAuNjYpO1xuICAgIH1cblxuICAgIC5tZXNzYWdlLWJ1YmJsZS1yb3cub3RoZXIgLm1zZy10aW1lIHtcbiAgICAgIGNvbG9yOiByZ2JhKDIxNiwgMjIzLCAyNDYsIDAuNTgpO1xuICAgIH1cblxuICAgIC5yZWFkLWljb24ge1xuICAgICAgZm9udC1zaXplOiAxNHB4O1xuICAgICAgd2lkdGg6IDE0cHg7XG4gICAgICBoZWlnaHQ6IDE0cHg7XG4gICAgICBvcGFjaXR5OiAwLjc7XG4gICAgfVxuXG4gICAgLnJlYWQtaWNvbi51bnJlYWQge1xuICAgICAgb3BhY2l0eTogMC40O1xuICAgIH1cblxuICAgIC5xdWljay1yZWFjdGlvbnMge1xuICAgICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgICAgdG9wOiAtMThweDtcbiAgICAgIHJpZ2h0OiAwO1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBnYXA6IDRweDtcbiAgICAgIHBhZGRpbmc6IDNweCA1cHg7XG4gICAgICBiYWNrZ3JvdW5kOiAjMDcxZDMwO1xuICAgICAgYm9yZGVyOiAxcHggc29saWQgcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjE0KTtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDk5OXB4O1xuICAgICAgYm94LXNoYWRvdzogMCA2cHggMTRweCByZ2JhKDAsIDAsIDAsIDAuMjgpO1xuICAgICAgei1pbmRleDogNDtcbiAgICB9XG5cbiAgICAvKiBSZWNlaXZlZCBtZXNzYWdlcyBzaXQgb24gdGhlIGxlZnQsIHNvIGdyb3cgdGhlIHBpY2tlciByaWdodHdhcmQuXG4gICAgICAgT3duIG1lc3NhZ2VzIHNpdCBvbiB0aGUgcmlnaHQsIHNvIGdyb3cgdGhlIHBpY2tlciBsZWZ0d2FyZC4gKi9cbiAgICAubWVzc2FnZS1idWJibGUtcm93Lm90aGVyIC5xdWljay1yZWFjdGlvbnMge1xuICAgICAgbGVmdDogMDtcbiAgICAgIHJpZ2h0OiBhdXRvO1xuICAgIH1cblxuICAgIC5tZXNzYWdlLWJ1YmJsZS1yb3cub3duIC5xdWljay1yZWFjdGlvbnMge1xuICAgICAgbGVmdDogYXV0bztcbiAgICAgIHJpZ2h0OiAwO1xuICAgIH1cblxuICAgIC5xdWljay1lbW9qaS1idG4ge1xuICAgICAgd2lkdGg6IDIwcHg7XG4gICAgICBoZWlnaHQ6IDIwcHg7XG4gICAgICBib3JkZXI6IG5vbmU7XG4gICAgICBib3JkZXItcmFkaXVzOiA5OTlweDtcbiAgICAgIGJhY2tncm91bmQ6IHRyYW5zcGFyZW50O1xuICAgICAgY29sb3I6ICNmZmY7XG4gICAgICBkaXNwbGF5OiBpbmxpbmUtZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgIGZvbnQtc2l6ZTogMTNweDtcbiAgICAgIGxpbmUtaGVpZ2h0OiAxO1xuICAgICAgY3Vyc29yOiBwb2ludGVyO1xuICAgICAgcGFkZGluZzogMDtcbiAgICAgIHRyYW5zaXRpb246IHRyYW5zZm9ybSAwLjEycyBlYXNlLCBiYWNrZ3JvdW5kIDAuMTJzIGVhc2U7XG4gICAgfVxuXG4gICAgLnF1aWNrLWVtb2ppLWJ0bjpob3ZlciB7XG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMTgpO1xuICAgICAgdHJhbnNmb3JtOiBzY2FsZSgxLjE0KTtcbiAgICB9XG5cbiAgICAucmVhY3Rpb25zLXJvdyB7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgZmxleC13cmFwOiB3cmFwO1xuICAgICAgZ2FwOiAzcHg7XG4gICAgICBtYXJnaW4tdG9wOiA1cHg7XG4gICAgfVxuXG4gICAgLnJlYWN0aW9uLWNoaXAge1xuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsMjU1LDI1NSwwLjA4KTtcbiAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHJnYmEoMjU1LDI1NSwyNTUsMC4yKTtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDk5OXB4O1xuICAgICAgcGFkZGluZzogMXB4IDdweDtcbiAgICAgIGZvbnQtc2l6ZTogMTFweDtcbiAgICAgIGNvbG9yOiAjZjJmNmZmO1xuICAgICAgY3Vyc29yOiBwb2ludGVyO1xuICAgICAgdHJhbnNpdGlvbjogYWxsIDAuMnM7XG4gICAgfVxuXG4gICAgLnJlYWN0aW9uLWNoaXA6aG92ZXIge1xuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsMjU1LDI1NSwwLjI1KTtcbiAgICAgIHRyYW5zZm9ybTogc2NhbGUoMS4wNSk7XG4gICAgfVxuXG4gICAgLnJlYWN0aW9uLWNoaXAub3duLXJlYWN0aW9uIHtcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoNDIsOTEsMjU1LDAuMyk7XG4gICAgICBib3JkZXItY29sb3I6IHJnYmEoNDIsOTEsMjU1LDAuNSk7XG4gICAgfVxuXG4gICAgLmVtcHR5LWNoYXQge1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgICBmbGV4OiAxO1xuICAgICAgY29sb3I6ICM5Y2EzYWY7XG4gICAgfVxuXG4gICAgLmVtcHR5LWNoYXQgbWF0LWljb24ge1xuICAgICAgZm9udC1zaXplOiA0OHB4O1xuICAgICAgd2lkdGg6IDQ4cHg7XG4gICAgICBoZWlnaHQ6IDQ4cHg7XG4gICAgICBtYXJnaW4tYm90dG9tOiA4cHg7XG4gICAgfVxuXG4gICAgLmVtcHR5LWNoYXQgcCB7XG4gICAgICBmb250LXNpemU6IDE0cHg7XG4gICAgICBtYXJnaW46IDA7XG4gICAgfVxuICBgXSxcbn0pXG5leHBvcnQgY2xhc3MgQ2hhdFRocmVhZENvbXBvbmVudCBpbXBsZW1lbnRzIE9uSW5pdCwgT25EZXN0cm95LCBBZnRlclZpZXdDaGVja2VkIHtcbiAgQFZpZXdDaGlsZCgnc2Nyb2xsQ29udGFpbmVyJykgc2Nyb2xsQ29udGFpbmVyITogRWxlbWVudFJlZjtcbiAgQFZpZXdDaGlsZChNZXNzYWdlSW5wdXRDb21wb25lbnQpIG1lc3NhZ2VJbnB1dD86IE1lc3NhZ2VJbnB1dENvbXBvbmVudDtcbiAgQE91dHB1dCgpIGxpZ2h0Ym94T3BlbiA9IG5ldyBFdmVudEVtaXR0ZXI8c3RyaW5nPigpO1xuXG4gIG1lc3NhZ2VzOiBNZXNzYWdlW10gPSBbXTtcbiAgdmlzaWJsZUNvbnRhY3RzOiBDb250YWN0W10gPSBbXTtcbiAgY29udmVyc2F0aW9uTmFtZSA9ICcnO1xuICBpc0dyb3VwID0gZmFsc2U7XG4gIGxvYWRpbmcgPSBmYWxzZTtcbiAgbXlDb250YWN0SWQ6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuXG4gIHByaXZhdGUgY29udmVyc2F0aW9uSWQ6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIHN1YiE6IFN1YnNjcmlwdGlvbjtcbiAgcHJpdmF0ZSBzaG91bGRTY3JvbGxUb0JvdHRvbSA9IHRydWU7XG5cbiAgdXBsb2FkaW5nID0gZmFsc2U7XG4gIGhvdmVyZWRNZXNzYWdlSWQ6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuICBxdWlja0Vtb2ppcyA9IFsn4p2k77iPJywgJ/CfkY0nLCAn8J+YgicsICfwn5iuJywgJ/CfmKInLCAn8J+UpSddO1xuICB0aHJlYWREcmFnT3ZlciA9IGZhbHNlO1xuICBwcml2YXRlIHRocmVhZERyYWdEZXB0aCA9IDA7XG4gIHByaXZhdGUgYm91bmRSZXNldFRocmVhZERyYWcgPSB0aGlzLnJlc2V0VGhyZWFkRHJhZy5iaW5kKHRoaXMpO1xuXG4gIC8qKiBUcmFja3Mgd2hpY2ggZmlsZSBJRHMgYXJlIGN1cnJlbnRseSBiZWluZyBmZXRjaGVkIHRvIGF2b2lkIGR1cGxpY2F0ZSByZXF1ZXN0cyAqL1xuICBwcml2YXRlIG1lZGlhTG9hZGluZyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICAvKiogVHJhY2tzIGZpbGUgSURzIHdoZXJlIHJldHJpZXZhbCBmYWlsZWQgc28gVUkgZG9lc24ndCBzcGluIGZvcmV2ZXIuICovXG4gIHByaXZhdGUgbWVkaWFGYWlsZWQgPSBuZXcgU2V0PHN0cmluZz4oKTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIHN0b3JlOiBNZXNzYWdpbmdTdG9yZVNlcnZpY2UsXG4gICAgcHJpdmF0ZSBhdXRoOiBBdXRoU2VydmljZSxcbiAgICBwcml2YXRlIGZpbGVTZXJ2aWNlOiBNZXNzYWdpbmdGaWxlU2VydmljZSxcbiAgICBwcml2YXRlIGNkcjogQ2hhbmdlRGV0ZWN0b3JSZWYsXG4gICkge31cblxuICBuZ09uSW5pdCgpOiB2b2lkIHtcbiAgICB0aGlzLm15Q29udGFjdElkID0gdGhpcy5hdXRoLmNvbnRhY3RJZDtcbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdkcm9wJywgdGhpcy5ib3VuZFJlc2V0VGhyZWFkRHJhZywgdHJ1ZSk7XG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignZHJhZ2VuZCcsIHRoaXMuYm91bmRSZXNldFRocmVhZERyYWcsIHRydWUpO1xuXG4gICAgdGhpcy5zdWIgPSBjb21iaW5lTGF0ZXN0KFtcbiAgICAgIHRoaXMuc3RvcmUuYWN0aXZlQ29udmVyc2F0aW9uSWQsXG4gICAgICB0aGlzLnN0b3JlLm1lc3NhZ2VzTWFwLFxuICAgICAgdGhpcy5zdG9yZS5vcGVuQ2hhdHMsXG4gICAgICB0aGlzLnN0b3JlLnZpc2libGVDb250YWN0cyxcbiAgICAgIHRoaXMuc3RvcmUubG9hZGluZ01lc3NhZ2VzLFxuICAgIF0pLnN1YnNjcmliZSgoW2NvbnZJZCwgbXNnTWFwLCBjaGF0cywgY29udGFjdHMsIGxvYWRpbmddKSA9PiB7XG4gICAgICB0aGlzLmxvYWRpbmcgPSBsb2FkaW5nO1xuICAgICAgdGhpcy52aXNpYmxlQ29udGFjdHMgPSBjb250YWN0cyB8fCBbXTtcblxuICAgICAgaWYgKGNvbnZJZCAmJiBjb252SWQgIT09IHRoaXMuY29udmVyc2F0aW9uSWQpIHtcbiAgICAgICAgdGhpcy5jb252ZXJzYXRpb25JZCA9IGNvbnZJZDtcbiAgICAgICAgdGhpcy5zaG91bGRTY3JvbGxUb0JvdHRvbSA9IHRydWU7XG4gICAgICAgIGNvbnN0IGNoYXQgPSBjaGF0cy5maW5kKChjKSA9PiBjLmNvbnZlcnNhdGlvbklkID09PSBjb252SWQpO1xuICAgICAgICB0aGlzLmNvbnZlcnNhdGlvbk5hbWUgPSBjaGF0Py5uYW1lIHx8ICdDaGF0JztcbiAgICAgICAgdGhpcy5pc0dyb3VwID0gY2hhdD8uaXNHcm91cCB8fCBmYWxzZTtcbiAgICAgIH1cblxuICAgICAgaWYgKHRoaXMuY29udmVyc2F0aW9uSWQpIHtcbiAgICAgICAgY29uc3QgcHJldkxlbiA9IHRoaXMubWVzc2FnZXMubGVuZ3RoO1xuICAgICAgICB0aGlzLm1lc3NhZ2VzID0gbXNnTWFwLmdldCh0aGlzLmNvbnZlcnNhdGlvbklkKSB8fCBbXTtcbiAgICAgICAgaWYgKHRoaXMubWVzc2FnZXMubGVuZ3RoID4gcHJldkxlbikge1xuICAgICAgICAgIHRoaXMuc2hvdWxkU2Nyb2xsVG9Cb3R0b20gPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIC8vIFByZS13YXJtIG1lZGlhIGNhY2hlIGZvciBhbnkgaW1hZ2UvZmlsZSBtZXNzYWdlcyB2aXNpYmxlXG4gICAgICAgIHRoaXMucHJld2FybU1lZGlhKHRoaXMubWVzc2FnZXMpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgbmdBZnRlclZpZXdDaGVja2VkKCk6IHZvaWQge1xuICAgIGlmICh0aGlzLnNob3VsZFNjcm9sbFRvQm90dG9tKSB7XG4gICAgICB0aGlzLnNjcm9sbFRvQm90dG9tKCk7XG4gICAgICB0aGlzLnNob3VsZFNjcm9sbFRvQm90dG9tID0gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgbmdPbkRlc3Ryb3koKTogdm9pZCB7XG4gICAgdGhpcy5zdWI/LnVuc3Vic2NyaWJlKCk7XG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignZHJvcCcsIHRoaXMuYm91bmRSZXNldFRocmVhZERyYWcsIHRydWUpO1xuICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2RyYWdlbmQnLCB0aGlzLmJvdW5kUmVzZXRUaHJlYWREcmFnLCB0cnVlKTtcbiAgfVxuXG4gIGdvQmFjaygpOiB2b2lkIHtcbiAgICB0aGlzLnN0b3JlLnNldFZpZXcoJ2luYm94Jyk7XG4gIH1cblxuICBvbkNsZWFyQ29udmVyc2F0aW9uKCk6IHZvaWQge1xuICAgIGlmICh0aGlzLmNvbnZlcnNhdGlvbklkKSB7XG4gICAgICB0aGlzLnN0b3JlLmNsZWFyQ29udmVyc2F0aW9uKHRoaXMuY29udmVyc2F0aW9uSWQpO1xuICAgIH1cbiAgfVxuXG4gIG9uRGVsZXRlQ29udmVyc2F0aW9uKCk6IHZvaWQge1xuICAgIGlmICh0aGlzLmNvbnZlcnNhdGlvbklkKSB7XG4gICAgICB0aGlzLnN0b3JlLmRlbGV0ZUNvbnZlcnNhdGlvbih0aGlzLmNvbnZlcnNhdGlvbklkKTtcbiAgICB9XG4gIH1cblxuICBvbkdyb3VwU2V0dGluZ3MoKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuY29udmVyc2F0aW9uSWQpIHtcbiAgICAgIHRoaXMuc3RvcmUub3Blbkdyb3VwU2V0dGluZ3ModGhpcy5jb252ZXJzYXRpb25JZCwgdGhpcy5jb252ZXJzYXRpb25OYW1lKTtcbiAgICB9XG4gIH1cblxuICBvblNlbmRNZXNzYWdlKGNvbnRlbnQ6IHN0cmluZyk6IHZvaWQge1xuICAgIHRoaXMuc3RvcmUuc2VuZE1lc3NhZ2UodGhpcy5jb252ZXJzYXRpb25JZCwgY29udGVudCk7XG4gICAgdGhpcy5zaG91bGRTY3JvbGxUb0JvdHRvbSA9IHRydWU7XG4gIH1cblxuICBvblNlbmRXaXRoRmlsZXMocGF5bG9hZDogTWVzc2FnZVBheWxvYWQpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMuY29udmVyc2F0aW9uSWQgfHwgIXRoaXMuYXV0aC5jb250YWN0SWQpIHJldHVybjtcbiAgICB0aGlzLnVwbG9hZGluZyA9IHRydWU7XG5cbiAgICAvLyBTdGVwIDE6IFVwbG9hZCBhbGwgZmlsZXMgYW5kIG9idGFpbiByZWFsIGZpbGVfaWRzIGZyb20gdGhlIHNlcnZlci5cbiAgICAvLyBUZW1wIElEcyBhcmUgTkVWRVIgc2VudCB0byBhbnkgQVBJIOKAlCB3ZSB3YWl0IGZvciByZWFsIElEcyBoZXJlLlxuICAgIHRoaXMuZmlsZVNlcnZpY2UudXBsb2FkRmlsZXMocGF5bG9hZC5maWxlcykuc3Vic2NyaWJlKHtcbiAgICAgIG5leHQ6IChyZXNwb25zZXMpID0+IHtcbiAgICAgICAgY29uc3QgZmlsZUlkcyAgID0gcmVzcG9uc2VzLm1hcCgocikgPT4gci5maWxlX2lkKTtcbiAgICAgICAgY29uc3QgZmlsZW5hbWVzID0gcmVzcG9uc2VzLm1hcCgocikgPT4gci5maWxlbmFtZSk7XG4gICAgICAgIGNvbnN0IG1pbWVUeXBlcyA9IHJlc3BvbnNlcy5tYXAoKHIsIGlkeCkgPT4gci5taW1lX3R5cGUgfHwgcGF5bG9hZC5maWxlc1tpZHhdPy50eXBlIHx8ICcnKTtcblxuICAgICAgICAvLyBHdWFyZDogZW5zdXJlIGFsbCBJRHMgYXJlIHJlYWwgKG5vdCB0ZW1wKVxuICAgICAgICBjb25zdCBoYXNUZW1wID0gZmlsZUlkcy5zb21lKGlkID0+IGlkPy5zdGFydHNXaXRoKCd0ZW1wLScpKTtcbiAgICAgICAgaWYgKGhhc1RlbXApIHtcbiAgICAgICAgICB0aGlzLnVwbG9hZGluZyA9IGZhbHNlO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFN0ZXAgMjogUHJlLXdhcm0gaW1hZ2UgY2FjaGUgc28gdGhlIG9wdGltaXN0aWMgYnViYmxlIHJlbmRlcnMgaW1tZWRpYXRlbHkuXG4gICAgICAgIHRoaXMuZmlsZVNlcnZpY2UucHJld2FybUNhY2hlKGZpbGVJZHMpO1xuXG4gICAgICAgIC8vIFN0ZXAgMzogU2VuZCB0aGUgbWVzc2FnZSB3aXRoIHRoZSByZWFsIGZpbGVfaWRzLlxuICAgICAgICB0aGlzLmZpbGVTZXJ2aWNlXG4gICAgICAgICAgLnNlbmRNZXNzYWdlV2l0aEF0dGFjaG1lbnRzKFxuICAgICAgICAgICAgdGhpcy5jb252ZXJzYXRpb25JZCEsXG4gICAgICAgICAgICB0aGlzLmF1dGguY29udGFjdElkISxcbiAgICAgICAgICAgIHBheWxvYWQudGV4dCB8fCBmaWxlbmFtZXMuam9pbignLCAnKSxcbiAgICAgICAgICAgIGZpbGVJZHMsXG4gICAgICAgICAgICBmaWxlbmFtZXMsXG4gICAgICAgICAgICBtaW1lVHlwZXNcbiAgICAgICAgICApXG4gICAgICAgICAgLnN1YnNjcmliZSh7XG4gICAgICAgICAgICBuZXh0OiAocmVzOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgdGhpcy51cGxvYWRpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgICAgdGhpcy5zaG91bGRTY3JvbGxUb0JvdHRvbSA9IHRydWU7XG5cbiAgICAgICAgICAgICAgLy8gQWRkIG9wdGltaXN0aWMgbWVzc2FnZSBzbyB0aGUgaW1hZ2UgYXBwZWFycyBpbnN0YW50bHkg4oCUXG4gICAgICAgICAgICAgIC8vIHRoZSBXZWJTb2NrZXQgZXZlbnQgbWF5IGFycml2ZSBhIG1vbWVudCBsYXRlciBhbmQgZGVkdXAgaXQuXG4gICAgICAgICAgICAgIGNvbnN0IGZpcnN0SWQgPSBmaWxlSWRzWzBdIHx8ICcnO1xuICAgICAgICAgICAgICBjb25zdCBpc0ltZyA9XG4gICAgICAgICAgICAgICAgKG1pbWVUeXBlc1swXSB8fCAnJykuc3RhcnRzV2l0aCgnaW1hZ2UvJykgfHxcbiAgICAgICAgICAgICAgICAvXFwuKHBuZ3xqcGU/Z3xnaWZ8d2VicHxibXB8c3ZnfGhlaWN8aGVpZikkL2kudGVzdChmaWxlbmFtZXNbMF0gfHwgJycpO1xuICAgICAgICAgICAgICBjb25zdCBvcHRpbWlzdGljOiBhbnkgPSB7XG4gICAgICAgICAgICAgICAgbWVzc2FnZV9pZDogcmVzPy5tZXNzYWdlX2lkID8gU3RyaW5nKHJlcy5tZXNzYWdlX2lkKSA6ICd0ZW1wLScgKyBEYXRlLm5vdygpLFxuICAgICAgICAgICAgICAgIGNvbnZlcnNhdGlvbl9pZDogdGhpcy5jb252ZXJzYXRpb25JZCEsXG4gICAgICAgICAgICAgICAgc2VuZGVyX2lkOiB0aGlzLmF1dGguY29udGFjdElkISxcbiAgICAgICAgICAgICAgICBzZW5kZXJfbmFtZTogJ1lvdScsXG4gICAgICAgICAgICAgICAgbWVzc2FnZV90eXBlOiBpc0ltZyA/ICdJTUFHRScgOiAnRklMRScsXG4gICAgICAgICAgICAgICAgY29udGVudDogcGF5bG9hZC50ZXh0IHx8IGZpbGVuYW1lcy5qb2luKCcsICcpLFxuICAgICAgICAgICAgICAgIG1lZGlhX3VybDogZmlyc3RJZCxcbiAgICAgICAgICAgICAgICBjcmVhdGVkX2F0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgICAgICAgICAgaXNfcmVhZDogdHJ1ZSxcbiAgICAgICAgICAgICAgICBhdHRhY2htZW50czogZmlsZUlkcy5tYXAoKGlkLCBpZHgpID0+ICh7XG4gICAgICAgICAgICAgICAgICBmaWxlX2lkOiBpZCxcbiAgICAgICAgICAgICAgICAgIGZpbGVuYW1lOiBmaWxlbmFtZXNbaWR4XSB8fCBmaWxlbmFtZXNbMF0gfHwgYEF0dGFjaG1lbnQgJHtpZHggKyAxfWAsXG4gICAgICAgICAgICAgICAgICBtaW1lX3R5cGU6IG1pbWVUeXBlc1tpZHhdIHx8IHVuZGVmaW5lZCxcbiAgICAgICAgICAgICAgICAgIHNpemVfYnl0ZXM6IHBheWxvYWQuZmlsZXNbaWR4XT8uc2l6ZSxcbiAgICAgICAgICAgICAgICAgIHVybDogcmVzcG9uc2VzW2lkeF0/LnVybCxcbiAgICAgICAgICAgICAgICB9KSksXG4gICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgIHRoaXMuc3RvcmUuYXBwZW5kT3B0aW1pc3RpY01lc3NhZ2Uob3B0aW1pc3RpYyk7XG4gICAgICAgICAgICAgIHRoaXMuY2RyLm1hcmtGb3JDaGVjaygpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGVycm9yOiAoKSA9PiB7XG4gICAgICAgICAgICAgIHRoaXMudXBsb2FkaW5nID0gZmFsc2U7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0pO1xuICAgICAgfSxcbiAgICAgIGVycm9yOiAoKSA9PiB7XG4gICAgICAgIHRoaXMudXBsb2FkaW5nID0gZmFsc2U7XG4gICAgICB9LFxuICAgIH0pO1xuICB9XG5cbiAgbG9hZE9sZGVyKCk6IHZvaWQge1xuICAgIGlmICh0aGlzLmNvbnZlcnNhdGlvbklkICYmIHRoaXMubWVzc2FnZXMubGVuZ3RoID4gMCkge1xuICAgICAgdGhpcy5zdG9yZS5sb2FkTWVzc2FnZXModGhpcy5jb252ZXJzYXRpb25JZCwgdGhpcy5tZXNzYWdlc1swXS5tZXNzYWdlX2lkKTtcbiAgICB9XG4gIH1cblxuICBvblNjcm9sbCgpOiB2b2lkIHt9XG5cbiAgb25UaHJlYWREcmFnRW50ZXIoZXZlbnQ6IERyYWdFdmVudCk6IHZvaWQge1xuICAgIGlmICghdGhpcy5kcmFnSGFzRmlsZXMoZXZlbnQpKSByZXR1cm47XG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICB0aGlzLnRocmVhZERyYWdEZXB0aCsrO1xuICAgIHRoaXMudGhyZWFkRHJhZ092ZXIgPSB0cnVlO1xuICB9XG5cbiAgb25UaHJlYWREcmFnT3ZlcihldmVudDogRHJhZ0V2ZW50KTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLmRyYWdIYXNGaWxlcyhldmVudCkpIHJldHVybjtcbiAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuICAgIGlmIChldmVudC5kYXRhVHJhbnNmZXIpIHtcbiAgICAgIGV2ZW50LmRhdGFUcmFuc2Zlci5kcm9wRWZmZWN0ID0gJ2NvcHknO1xuICAgIH1cbiAgICB0aGlzLnRocmVhZERyYWdPdmVyID0gdHJ1ZTtcbiAgfVxuXG4gIG9uVGhyZWFkRHJhZ0xlYXZlKGV2ZW50OiBEcmFnRXZlbnQpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMuZHJhZ0hhc0ZpbGVzKGV2ZW50KSkgcmV0dXJuO1xuICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgdGhpcy50aHJlYWREcmFnRGVwdGggPSBNYXRoLm1heCgwLCB0aGlzLnRocmVhZERyYWdEZXB0aCAtIDEpO1xuICAgIHRoaXMudGhyZWFkRHJhZ092ZXIgPSB0aGlzLnRocmVhZERyYWdEZXB0aCA+IDA7XG4gIH1cblxuICBvblRocmVhZERyb3AoZXZlbnQ6IERyYWdFdmVudCk6IHZvaWQge1xuICAgIGlmICghdGhpcy5kcmFnSGFzRmlsZXMoZXZlbnQpKSByZXR1cm47XG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICB0aGlzLnJlc2V0VGhyZWFkRHJhZygpO1xuICAgIGNvbnN0IGZpbGVzID0gZXZlbnQuZGF0YVRyYW5zZmVyPy5maWxlcyA/IEFycmF5LmZyb20oZXZlbnQuZGF0YVRyYW5zZmVyLmZpbGVzKSA6IFtdO1xuICAgIHRoaXMubWVzc2FnZUlucHV0Py5hZGRGaWxlcyhmaWxlcyk7XG4gIH1cblxuICBwcml2YXRlIHJlc2V0VGhyZWFkRHJhZygpOiB2b2lkIHtcbiAgICB0aGlzLnRocmVhZERyYWdEZXB0aCA9IDA7XG4gICAgdGhpcy50aHJlYWREcmFnT3ZlciA9IGZhbHNlO1xuICB9XG5cbiAgcHJpdmF0ZSBkcmFnSGFzRmlsZXMoZXZlbnQ6IERyYWdFdmVudCk6IGJvb2xlYW4ge1xuICAgIGNvbnN0IHR5cGVzID0gZXZlbnQuZGF0YVRyYW5zZmVyPy50eXBlcztcbiAgICBpZiAoIXR5cGVzKSByZXR1cm4gZmFsc2U7XG4gICAgcmV0dXJuIEFycmF5LmZyb20odHlwZXMpLmluY2x1ZGVzKCdGaWxlcycpO1xuICB9XG5cbiAgc2hvdWxkU2hvd0RhdGVTZXBhcmF0b3IoaW5kZXg6IG51bWJlcik6IGJvb2xlYW4ge1xuICAgIGlmIChpbmRleCA9PT0gMCkgcmV0dXJuIHRydWU7XG4gICAgY29uc3QgY3VyciA9IG5ldyBEYXRlKHRoaXMubWVzc2FnZXNbaW5kZXhdLmNyZWF0ZWRfYXQpLnRvRGF0ZVN0cmluZygpO1xuICAgIGNvbnN0IHByZXYgPSBuZXcgRGF0ZSh0aGlzLm1lc3NhZ2VzW2luZGV4IC0gMV0uY3JlYXRlZF9hdCkudG9EYXRlU3RyaW5nKCk7XG4gICAgcmV0dXJuIGN1cnIgIT09IHByZXY7XG4gIH1cblxuICBzaG91bGRTaG93U2VuZGVyKGluZGV4OiBudW1iZXIpOiBib29sZWFuIHtcbiAgICBpZiAoaW5kZXggPT09IDApIHJldHVybiB0cnVlO1xuICAgIHJldHVybiB0aGlzLm1lc3NhZ2VzW2luZGV4XS5zZW5kZXJfaWQgIT09IHRoaXMubWVzc2FnZXNbaW5kZXggLSAxXS5zZW5kZXJfaWQ7XG4gIH1cblxuICBpc093bk1lc3NhZ2UobXNnOiBNZXNzYWdlKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIFN0cmluZyhtc2cuc2VuZGVyX2lkKSA9PT0gU3RyaW5nKHRoaXMubXlDb250YWN0SWQpO1xuICB9XG5cbiAgZ2V0U2VuZGVyTmFtZShtc2c6IE1lc3NhZ2UpOiBzdHJpbmcge1xuICAgIGNvbnN0IGZyb21NZXNzYWdlID0gZ2V0TWVzc2FnZVNlbmRlck5hbWUobXNnKTtcbiAgICBpZiAoZnJvbU1lc3NhZ2UgJiYgZnJvbU1lc3NhZ2UgIT09ICdVbmtub3duJykge1xuICAgICAgcmV0dXJuIGZyb21NZXNzYWdlO1xuICAgIH1cblxuICAgIGNvbnN0IGZyb21Db250YWN0cyA9IHRoaXMudmlzaWJsZUNvbnRhY3RzLmZpbmQoXG4gICAgICAoYykgPT4gU3RyaW5nKGMuY29udGFjdF9pZCkgPT09IFN0cmluZyhtc2cuc2VuZGVyX2lkKVxuICAgICk7XG4gICAgaWYgKGZyb21Db250YWN0cykge1xuICAgICAgcmV0dXJuIGdldENvbnRhY3REaXNwbGF5TmFtZShmcm9tQ29udGFjdHMpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLmlzT3duTWVzc2FnZShtc2cpKSB7XG4gICAgICByZXR1cm4gJ1lvdSc7XG4gICAgfVxuXG4gICAgcmV0dXJuIGBVc2VyICR7bXNnLnNlbmRlcl9pZH1gO1xuICB9XG5cbiAgZm9ybWF0VGltZShkYXRlU3RyOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIGlmICghZGF0ZVN0cikgcmV0dXJuICcnO1xuICAgIGNvbnN0IGQgPSBuZXcgRGF0ZShkYXRlU3RyKTtcbiAgICByZXR1cm4gZC50b0xvY2FsZVRpbWVTdHJpbmcoJ2VuLUdCJywgeyBob3VyOiAnMi1kaWdpdCcsIG1pbnV0ZTogJzItZGlnaXQnIH0pO1xuICB9XG5cbiAgZm9ybWF0RGF0ZShkYXRlU3RyOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIGNvbnN0IGQgPSBuZXcgRGF0ZShkYXRlU3RyKTtcbiAgICBjb25zdCB0b2RheSA9IG5ldyBEYXRlKCk7XG4gICAgY29uc3QgeWVzdGVyZGF5ID0gbmV3IERhdGUodG9kYXkpO1xuICAgIHllc3RlcmRheS5zZXREYXRlKHllc3RlcmRheS5nZXREYXRlKCkgLSAxKTtcblxuICAgIGlmIChkLnRvRGF0ZVN0cmluZygpID09PSB0b2RheS50b0RhdGVTdHJpbmcoKSkgcmV0dXJuICdUb2RheSc7XG4gICAgaWYgKGQudG9EYXRlU3RyaW5nKCkgPT09IHllc3RlcmRheS50b0RhdGVTdHJpbmcoKSkgcmV0dXJuICdZZXN0ZXJkYXknO1xuICAgIHJldHVybiBkLnRvTG9jYWxlRGF0ZVN0cmluZygnZW4tR0InLCB7IGRheTogJ251bWVyaWMnLCBtb250aDogJ3Nob3J0JywgeWVhcjogJ251bWVyaWMnIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBzY3JvbGxUb0JvdHRvbSgpOiB2b2lkIHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgZWwgPSB0aGlzLnNjcm9sbENvbnRhaW5lcj8ubmF0aXZlRWxlbWVudDtcbiAgICAgIGlmIChlbCkge1xuICAgICAgICBlbC5zY3JvbGxUb3AgPSBlbC5zY3JvbGxIZWlnaHQ7XG4gICAgICB9XG4gICAgfSBjYXRjaCB7IC8qIGlnbm9yZSAqLyB9XG4gIH1cblxuICAvLyDilIDilIAgTWVkaWEgaGVscGVycyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcblxuICBwcml2YXRlIGdldEZpbGVuYW1lTGlrZShtc2c6IE1lc3NhZ2UpOiBzdHJpbmcge1xuICAgIGNvbnN0IGFueU1zZyA9IG1zZyBhcyBhbnk7XG4gICAgcmV0dXJuIFN0cmluZyhcbiAgICAgIHRoaXMuZ2V0UHJpbWFyeUF0dGFjaG1lbnQobXNnKT8uZmlsZW5hbWUgfHxcbiAgICAgIGFueU1zZz8uZmlsZW5hbWUgfHxcbiAgICAgIGFueU1zZz8uZmlsZV9uYW1lIHx8XG4gICAgICBtc2cuY29udGVudCB8fFxuICAgICAgJydcbiAgICApLnRvTG93ZXJDYXNlKCk7XG4gIH1cblxuICAvKiogUmV0dXJucyB0aGUgcHJpbWFyeSBhdHRhY2htZW50IGZvciBhIG1lc3NhZ2UsIGlmIGFueS4gKi9cbiAgcHJpdmF0ZSBnZXRQcmltYXJ5QXR0YWNobWVudChtc2c6IE1lc3NhZ2UpOiBBdHRhY2htZW50IHwgbnVsbCB7XG4gICAgaWYgKG1zZy5hdHRhY2htZW50cyAmJiBtc2cuYXR0YWNobWVudHMubGVuZ3RoID4gMCkgcmV0dXJuIG1zZy5hdHRhY2htZW50c1swXTtcblxuICAgIC8vIFNvbWUgQVBJIHJlc3BvbnNlcyBwcm92aWRlIGZpbGUgbWV0YWRhdGEgaW4gYWx0ZXJuYXRlIGZpZWxkcy5cbiAgICBjb25zdCBhbnlNc2cgPSBtc2cgYXMgYW55O1xuICAgIGNvbnN0IG11ID0gU3RyaW5nKG1zZy5tZWRpYV91cmwgfHwgJycpLnRyaW0oKTtcbiAgICBjb25zdCBtZWRpYUlzRGlyZWN0VXJsID1cbiAgICAgIG11LnN0YXJ0c1dpdGgoJ2h0dHA6Ly8nKSB8fCBtdS5zdGFydHNXaXRoKCdodHRwczovLycpIHx8IG11LnN0YXJ0c1dpdGgoJ2RhdGE6Jyk7XG4gICAgY29uc3QgZmlsZUlkID1cbiAgICAgIGFueU1zZz8uZmlsZV9pZCB8fFxuICAgICAgYW55TXNnPy5hdHRhY2htZW50X2lkIHx8XG4gICAgICBhbnlNc2c/LmF0dGFjaG1lbnRfaWRzPy5bMF0gfHxcbiAgICAgICghbWVkaWFJc0RpcmVjdFVybCAmJiBtdSA/IG11IDogdW5kZWZpbmVkKTtcbiAgICBjb25zdCBtaW1lID0gYW55TXNnPy5taW1lX3R5cGUgfHwgYW55TXNnPy5hdHRhY2htZW50X21pbWVfdHlwZTtcbiAgICBjb25zdCBleHBsaWNpdEZpbGVuYW1lID0gYW55TXNnPy5maWxlbmFtZSB8fCBhbnlNc2c/LmZpbGVfbmFtZTtcbiAgICBjb25zdCBmaWxlbmFtZSA9XG4gICAgICBleHBsaWNpdEZpbGVuYW1lIHx8XG4gICAgICAoZmlsZUlkIHx8IG1pbWUgfHwgbXNnLm1lc3NhZ2VfdHlwZSAhPT0gJ1RFWFQnID8gbXNnLmNvbnRlbnQgOiAnJyk7XG4gICAgaWYgKGZpbGVJZCB8fCBleHBsaWNpdEZpbGVuYW1lIHx8IG1pbWUgfHwgbXNnLm1lc3NhZ2VfdHlwZSA9PT0gJ0ZJTEUnIHx8IG1zZy5tZXNzYWdlX3R5cGUgPT09ICdJTUFHRScpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGZpbGVfaWQ6IFN0cmluZyhmaWxlSWQgfHwgJycpLFxuICAgICAgICBmaWxlbmFtZTogU3RyaW5nKGZpbGVuYW1lIHx8ICdGaWxlJyksXG4gICAgICAgIG1pbWVfdHlwZTogbWltZSA/IFN0cmluZyhtaW1lKSA6IHVuZGVmaW5lZCxcbiAgICAgICAgdXJsOiBtZWRpYUlzRGlyZWN0VXJsID8gbXUgOiB1bmRlZmluZWQsXG4gICAgICB9O1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIGlzSW1hZ2VBdHRhY2htZW50KG1zZzogTWVzc2FnZSk6IGJvb2xlYW4ge1xuICAgIGlmIChtc2cubWVzc2FnZV90eXBlID09PSAnSU1BR0UnKSByZXR1cm4gdHJ1ZTtcbiAgICBjb25zdCBtaW1lID0gdGhpcy5nZXRQcmltYXJ5QXR0YWNobWVudChtc2cpPy5taW1lX3R5cGUgfHwgJyc7XG4gICAgaWYgKG1pbWUuc3RhcnRzV2l0aCgnaW1hZ2UvJykpIHJldHVybiB0cnVlO1xuICAgIGNvbnN0IG5hbWUgPSB0aGlzLmdldEZpbGVuYW1lTGlrZShtc2cpO1xuICAgIHJldHVybiAvXFwuKHBuZ3xqcGU/Z3xnaWZ8d2VicHxibXB8c3ZnfGhlaWN8aGVpZikkL2kudGVzdChuYW1lKTtcbiAgfVxuXG4gIC8qKiBSZXR1cm5zIHRoZSBjYWNoZWQgZGF0YSBVUkwgZm9yIGEgbWVzc2FnZSdzIG1lZGlhLCBvciBudWxsIGFuZCB0cmlnZ2VycyBiYWNrZ3JvdW5kIGxvYWQuICovXG4gIGdldE1lZGlhVXJsKG1zZzogTWVzc2FnZSk6IHN0cmluZyB8IG51bGwge1xuICAgIGNvbnN0IGF0dCA9IHRoaXMuZ2V0UHJpbWFyeUF0dGFjaG1lbnQobXNnKTtcbiAgICBjb25zdCBmaWxlSWQgPSBhdHQ/LmZpbGVfaWQ/LnRyaW0oKTtcblxuICAgIGNvbnN0IGRpcmVjdFVybCA9XG4gICAgICBhdHQ/LnVybCB8fFxuICAgICAgbXNnLm1lZGlhX3VybCB8fFxuICAgICAgKG1zZyBhcyBhbnkpPy51cmwgfHxcbiAgICAgIChtc2cgYXMgYW55KT8uZmlsZV91cmw7XG4gICAgaWYgKFxuICAgICAgZGlyZWN0VXJsICYmXG4gICAgICAoZGlyZWN0VXJsLnN0YXJ0c1dpdGgoJ2h0dHA6Ly8nKSB8fFxuICAgICAgICBkaXJlY3RVcmwuc3RhcnRzV2l0aCgnaHR0cHM6Ly8nKSB8fFxuICAgICAgICBkaXJlY3RVcmwuc3RhcnRzV2l0aCgnZGF0YTonKSlcbiAgICApIHtcbiAgICAgIHJldHVybiBkaXJlY3RVcmw7XG4gICAgfVxuXG4gICAgaWYgKCFmaWxlSWQpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IGNhY2hlZCA9IHRoaXMuZmlsZVNlcnZpY2UuZ2V0Q2FjaGVkRGF0YVVybChmaWxlSWQpO1xuICAgIGlmIChjYWNoZWQpIHJldHVybiBjYWNoZWQ7XG5cbiAgICAvLyBOb3QgeWV0IGNhY2hlZCDigJQga2ljayBvZmYgYSBiYWNrZ3JvdW5kIGZldGNoXG4gICAgdGhpcy5mZXRjaE1lZGlhKGZpbGVJZCk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBwcml2YXRlIHByZXdhcm1NZWRpYShtZXNzYWdlczogTWVzc2FnZVtdKTogdm9pZCB7XG4gICAgZm9yIChjb25zdCBtc2cgb2YgbWVzc2FnZXMpIHtcbiAgICAgIGNvbnN0IGF0dCA9IHRoaXMuZ2V0UHJpbWFyeUF0dGFjaG1lbnQobXNnKTtcbiAgICAgIGNvbnN0IGZpbGVJZCA9IGF0dD8uZmlsZV9pZD8udHJpbSgpO1xuICAgICAgaWYgKCFmaWxlSWQgfHwgZmlsZUlkLnN0YXJ0c1dpdGgoJ3RlbXAtJykpIGNvbnRpbnVlO1xuICAgICAgaWYgKHRoaXMuZmlsZVNlcnZpY2UuZ2V0Q2FjaGVkRGF0YVVybChmaWxlSWQpKSBjb250aW51ZTtcbiAgICAgIC8vIFByZWxvYWQgaW1hZ2VzIGFuZCB2aWRlb3MgZWFnZXJseTsgcXVldWUgb3RoZXIgZmlsZXMgc28gZG93bmxvYWQgbGlua3MgYXBwZWFyLlxuICAgICAgdGhpcy5mZXRjaE1lZGlhKGZpbGVJZCk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBmZXRjaE1lZGlhKGZpbGVJZDogc3RyaW5nKTogdm9pZCB7XG4gICAgaWYgKCFmaWxlSWQgfHwgZmlsZUlkLnN0YXJ0c1dpdGgoJ3RlbXAtJykgfHwgdGhpcy5tZWRpYUxvYWRpbmcuaGFzKGZpbGVJZCkpIHJldHVybjtcbiAgICB0aGlzLm1lZGlhRmFpbGVkLmRlbGV0ZShmaWxlSWQpO1xuICAgIHRoaXMubWVkaWFMb2FkaW5nLmFkZChmaWxlSWQpO1xuXG4gICAgdGhpcy5maWxlU2VydmljZS5nZXRGaWxlRGF0YVVybChmaWxlSWQpLnN1YnNjcmliZSh7XG4gICAgICBuZXh0OiAoKSA9PiB7XG4gICAgICAgIHRoaXMubWVkaWFMb2FkaW5nLmRlbGV0ZShmaWxlSWQpO1xuICAgICAgICB0aGlzLmNkci5tYXJrRm9yQ2hlY2soKTtcbiAgICAgIH0sXG4gICAgICBlcnJvcjogKCkgPT4ge1xuICAgICAgICB0aGlzLm1lZGlhTG9hZGluZy5kZWxldGUoZmlsZUlkKTtcbiAgICAgICAgdGhpcy5tZWRpYUZhaWxlZC5hZGQoZmlsZUlkKTtcbiAgICAgICAgdGhpcy5jZHIubWFya0ZvckNoZWNrKCk7XG4gICAgICB9LFxuICAgIH0pO1xuICB9XG5cbiAgc2hvdWxkU2hvd01lZGlhU3Bpbm5lcihtc2c6IE1lc3NhZ2UpOiBib29sZWFuIHtcbiAgICBjb25zdCBmaWxlSWQgPSB0aGlzLmdldFByaW1hcnlBdHRhY2htZW50KG1zZyk/LmZpbGVfaWQ7XG4gICAgaWYgKCFmaWxlSWQgfHwgZmlsZUlkLnN0YXJ0c1dpdGgoJ3RlbXAtJykpIHJldHVybiBmYWxzZTtcbiAgICByZXR1cm4gdGhpcy5tZWRpYUxvYWRpbmcuaGFzKGZpbGVJZCkgJiYgIXRoaXMubWVkaWFGYWlsZWQuaGFzKGZpbGVJZCk7XG4gIH1cblxuICBpc1ZpZGVvQXR0YWNobWVudChtc2c6IE1lc3NhZ2UpOiBib29sZWFuIHtcbiAgICBjb25zdCBtaW1lID0gdGhpcy5nZXRQcmltYXJ5QXR0YWNobWVudChtc2cpPy5taW1lX3R5cGUgfHwgJyc7XG4gICAgaWYgKG1pbWUuc3RhcnRzV2l0aCgndmlkZW8vJykpIHJldHVybiB0cnVlO1xuICAgIGNvbnN0IG5hbWUgPSB0aGlzLmdldEZpbGVuYW1lTGlrZShtc2cpO1xuICAgIHJldHVybiAvXFwuKG1wNHx3ZWJtfG1vdnxtNHZ8YXZpfG1rdikkL2kudGVzdChuYW1lKTtcbiAgfVxuXG4gIGdldEF0dGFjaG1lbnRNaW1lVHlwZShtc2c6IE1lc3NhZ2UpOiBzdHJpbmcge1xuICAgIHJldHVybiB0aGlzLmdldFByaW1hcnlBdHRhY2htZW50KG1zZyk/Lm1pbWVfdHlwZSB8fCAnYXBwbGljYXRpb24vb2N0ZXQtc3RyZWFtJztcbiAgfVxuXG4gIGdldEF0dGFjaG1lbnROYW1lKG1zZzogTWVzc2FnZSk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHRoaXMuZ2V0UHJpbWFyeUF0dGFjaG1lbnQobXNnKT8uZmlsZW5hbWUgfHwgbXNnLmNvbnRlbnQgfHwgJ0ZpbGUnO1xuICB9XG5cbiAgaGFzRmlsZUF0dGFjaG1lbnQobXNnOiBNZXNzYWdlKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIG1zZy5tZXNzYWdlX3R5cGUgPT09ICdGSUxFJyB8fCAhIXRoaXMuZ2V0UHJpbWFyeUF0dGFjaG1lbnQobXNnKTtcbiAgfVxuXG4gIGhhc01lZGlhRmFpbGVkKG1zZzogTWVzc2FnZSk6IGJvb2xlYW4ge1xuICAgIGNvbnN0IGZpbGVJZCA9IHRoaXMuZ2V0UHJpbWFyeUF0dGFjaG1lbnQobXNnKT8uZmlsZV9pZDtcbiAgICByZXR1cm4gISFmaWxlSWQgJiYgdGhpcy5tZWRpYUZhaWxlZC5oYXMoZmlsZUlkKTtcbiAgfVxuXG4gIGdldEZpbGVJY29uKG1zZzogTWVzc2FnZSk6IHN0cmluZyB7XG4gICAgY29uc3QgbWltZSA9IHRoaXMuZ2V0QXR0YWNobWVudE1pbWVUeXBlKG1zZyk7XG4gICAgY29uc3QgbmFtZSA9IHRoaXMuZ2V0QXR0YWNobWVudE5hbWUobXNnKS50b0xvd2VyQ2FzZSgpO1xuICAgIGlmIChtaW1lLnN0YXJ0c1dpdGgoJ3ZpZGVvLycpIHx8IC9cXC4obXA0fHdlYm18bW92fG00dnxhdml8bWt2KSQvaS50ZXN0KG5hbWUpKSByZXR1cm4gJ3ZpZGVvY2FtJztcbiAgICBpZiAobWltZS5zdGFydHNXaXRoKCdhdWRpby8nKSB8fCAvXFwuKG1wM3x3YXZ8b2dnfG00YXxmbGFjKSQvaS50ZXN0KG5hbWUpKSByZXR1cm4gJ2F1ZGlvdHJhY2snO1xuICAgIGlmIChtaW1lLmluY2x1ZGVzKCdwZGYnKSB8fCBuYW1lLmVuZHNXaXRoKCcucGRmJykpIHJldHVybiAncGljdHVyZV9hc19wZGYnO1xuICAgIGlmIChtaW1lLmluY2x1ZGVzKCdzcHJlYWRzaGVldCcpIHx8IG1pbWUuaW5jbHVkZXMoJ2V4Y2VsJykgfHwgL1xcLih4bHN8eGxzeHxjc3YpJC9pLnRlc3QobmFtZSkpIHJldHVybiAndGFibGVfY2hhcnQnO1xuICAgIGlmIChtaW1lLmluY2x1ZGVzKCdkb2N1bWVudCcpIHx8IG1pbWUuaW5jbHVkZXMoJ3dvcmQnKSB8fCAvXFwuKGRvY3xkb2N4fHR4dHxydGYpJC9pLnRlc3QobmFtZSkpIHJldHVybiAnZGVzY3JpcHRpb24nO1xuICAgIGlmIChtaW1lLmluY2x1ZGVzKCd6aXAnKSB8fCAvXFwuKHppcHxyYXJ8N3p8dGFyfGd6KSQvaS50ZXN0KG5hbWUpKSByZXR1cm4gJ2ZvbGRlcl96aXAnO1xuICAgIHJldHVybiAnaW5zZXJ0X2RyaXZlX2ZpbGUnO1xuICB9XG5cbiAgb3BlbkxpZ2h0Ym94KGRhdGFVcmw6IHN0cmluZyk6IHZvaWQge1xuICAgIHRoaXMubGlnaHRib3hPcGVuLmVtaXQoZGF0YVVybCk7XG4gIH1cblxuICAvLyDilIDilIAgUmVhY3Rpb25zIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuXG4gIG9uRW1vamlTZWxlY3RlZChlbW9qaTogc3RyaW5nLCBtZXNzYWdlSWQ6IHN0cmluZyk6IHZvaWQge1xuICAgIHRoaXMuc3RvcmUuYWRkUmVhY3Rpb24obWVzc2FnZUlkLCBlbW9qaSk7XG4gIH1cblxuICB0b2dnbGVSZWFjdGlvbihlbW9qaTogc3RyaW5nLCBtZXNzYWdlSWQ6IHN0cmluZyk6IHZvaWQge1xuICAgIGNvbnN0IG1zZyA9IHRoaXMubWVzc2FnZXMuZmluZChtID0+IG0ubWVzc2FnZV9pZCA9PT0gbWVzc2FnZUlkKTtcbiAgICBpZiAoIW1zZykgcmV0dXJuO1xuICAgIFxuICAgIGNvbnN0IHJlYWN0aW9uID0gbXNnLnJlYWN0aW9ucz8uZmluZChyID0+IHIuZW1vamkgPT09IGVtb2ppKTtcbiAgICBpZiAocmVhY3Rpb24/Lmhhc1JlYWN0ZWQpIHtcbiAgICAgIHRoaXMuc3RvcmUucmVtb3ZlUmVhY3Rpb24obWVzc2FnZUlkLCBlbW9qaSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuc3RvcmUuYWRkUmVhY3Rpb24obWVzc2FnZUlkLCBlbW9qaSk7XG4gICAgfVxuICB9XG5cbiAgZ2V0UmVhY3RvclRvb2x0aXAocmVhY3Rpb246IGFueSk6IHN0cmluZyB7XG4gICAgaWYgKCFyZWFjdGlvbj8ucmVhY3RvcnM/Lmxlbmd0aCkgcmV0dXJuICcnO1xuICAgIHJldHVybiByZWFjdGlvbi5yZWFjdG9ycy5qb2luKCcsICcpO1xuICB9XG59XG4iXX0=