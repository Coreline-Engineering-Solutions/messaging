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
                // Step 2: Keep upload URLs on both the cache and optimistic attachment.
                // REST refreshes can return a different attachment id, so filename-based
                // merges need the URL on the attachment object too.
                const previewUrls = responses.map((r, idx) => r.url || URL.createObjectURL(payload.files[idx]));
                responses.forEach((r, idx) => {
                    this.fileService.rememberFileUrl(r.file_id, previewUrls[idx]);
                });
                // Step 3: Pre-warm image cache so the optimistic bubble renders immediately.
                this.fileService.prewarmCache(fileIds);
                // Step 4: Send the message with the real file_ids.
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
                                url: previewUrls[idx],
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
        const attachments = this.getRenderableAttachments(msg);
        if (attachments.length > 0)
            return attachments[0];
        return null;
    }
    getRenderableAttachments(msg) {
        if (msg.attachments && msg.attachments.length > 0) {
            return msg.attachments.map((a, idx) => ({
                file_id: String(a.file_id ?? '').trim(),
                filename: String(a.filename || `Attachment ${idx + 1}`),
                mime_type: a.mime_type,
                size_bytes: a.size_bytes,
                url: a.url,
            }));
        }
        // Some API responses provide file metadata in alternate fields.
        const anyMsg = msg;
        const mu = String(msg.media_url || '').trim();
        const mediaIsDirectUrl = mu.startsWith('http://') || mu.startsWith('https://') || mu.startsWith('data:') || mu.startsWith('blob:');
        const fileId = anyMsg?.file_id ||
            anyMsg?.attachment_id ||
            anyMsg?.attachment_ids?.[0] ||
            (!mediaIsDirectUrl && mu ? mu : undefined);
        const mime = anyMsg?.mime_type || anyMsg?.attachment_mime_type;
        const explicitFilename = anyMsg?.filename || anyMsg?.file_name;
        const filename = explicitFilename ||
            (fileId || mime || msg.message_type !== 'TEXT' ? msg.content : '');
        if (fileId || explicitFilename || mime || msg.message_type === 'FILE' || msg.message_type === 'IMAGE') {
            return [{
                    file_id: String(fileId || ''),
                    filename: String(filename || 'File'),
                    mime_type: mime ? String(mime) : undefined,
                    url: mediaIsDirectUrl ? mu : undefined,
                }];
        }
        return [];
    }
    isImageAttachment(msg) {
        return this.getRenderableAttachments(msg).some((att) => this.isImageAttachmentItem(att));
    }
    isImageAttachmentItem(att) {
        const mime = att.mime_type || '';
        if (mime.startsWith('image/'))
            return true;
        const name = (att.filename || '').toLowerCase();
        return /\.(png|jpe?g|gif|webp|bmp|svg|heic|heif)$/i.test(name);
    }
    /** Returns the cached data URL for a message's media, or null and triggers background load. */
    getMediaUrl(msg) {
        const att = this.getPrimaryAttachment(msg);
        return att ? this.getAttachmentMediaUrl(att, msg) : null;
    }
    getAttachmentMediaUrl(att, msg) {
        const fileId = att.file_id?.trim();
        const directUrl = att.url ||
            msg?.media_url ||
            msg?.url ||
            msg?.file_url;
        if (directUrl &&
            (directUrl.startsWith('http://') ||
                directUrl.startsWith('https://') ||
                directUrl.startsWith('data:') ||
                directUrl.startsWith('blob:'))) {
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
    trackByMessage(_index, msg) {
        return String(msg.message_id || `${msg.sender_id}-${msg.created_at}`);
    }
    trackByAttachment(index, att) {
        return `${att.file_id || ''}|${att.filename || ''}|${index}`;
    }
    downloadAttachment(event, url, filename) {
        event.preventDefault();
        event.stopPropagation();
        if (!url)
            return;
        const link = document.createElement('a');
        link.href = url;
        link.download = filename || 'attachment';
        link.rel = 'noopener';
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    prewarmMedia(messages) {
        for (const msg of messages) {
            for (const att of this.getRenderableAttachments(msg)) {
                const fileId = att.file_id?.trim();
                if (!fileId || fileId.startsWith('temp-'))
                    continue;
                if (this.fileService.getCachedDataUrl(fileId))
                    continue;
                // Preload every attachment so each item gets its own URL/download state.
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
    shouldShowAttachmentSpinner(att) {
        const fileId = att.file_id;
        if (!fileId || fileId.startsWith('temp-'))
            return false;
        return this.mediaLoading.has(fileId) && !this.mediaFailed.has(fileId);
    }
    isVideoAttachment(msg) {
        return this.getRenderableAttachments(msg).some((att) => this.isVideoAttachmentItem(att));
    }
    isVideoAttachmentItem(att) {
        const mime = att.mime_type || '';
        if (mime.startsWith('video/'))
            return true;
        const name = (att.filename || '').toLowerCase();
        return /\.(mp4|webm|mov|m4v|avi|mkv)$/i.test(name);
    }
    getAttachmentMimeType(attOrMsg) {
        if ('file_id' in attOrMsg) {
            return attOrMsg.mime_type || 'application/octet-stream';
        }
        return this.getPrimaryAttachment(attOrMsg)?.mime_type || 'application/octet-stream';
    }
    getAttachmentName(msg) {
        return this.getPrimaryAttachment(msg)?.filename || msg.content || 'File';
    }
    getAttachmentDisplayName(att, msg) {
        return att.filename || msg?.content || 'File';
    }
    hasFileAttachment(msg) {
        return msg.message_type === 'FILE' || this.getRenderableAttachments(msg).length > 0;
    }
    hasMediaFailed(msg) {
        const fileId = this.getPrimaryAttachment(msg)?.file_id;
        return !!fileId && this.mediaFailed.has(fileId);
    }
    hasAttachmentFailed(att) {
        return !!att.file_id && this.mediaFailed.has(att.file_id);
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
    getAttachmentIcon(att, msg) {
        const mime = this.getAttachmentMimeType(att);
        const name = this.getAttachmentDisplayName(att, msg).toLowerCase();
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
          <ng-container *ngFor="let msg of messages; let i = index; trackBy: trackByMessage">
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
                <!-- Attachments ───────────────────────────────── -->
                <div *ngIf="getRenderableAttachments(msg).length > 0" class="attachments-list">
                  <div *ngFor="let att of getRenderableAttachments(msg); trackBy: trackByAttachment" class="attachment-item">
                    <ng-container *ngIf="isImageAttachmentItem(att); else nonImageAttachment">
                      <div class="image-message">
                        <ng-container *ngIf="getAttachmentMediaUrl(att, msg) as dataUrl; else imgFallback">
                          <img [src]="dataUrl" alt="Image" class="media-img" (click)="$event.stopPropagation(); openLightbox(dataUrl)" />
                        </ng-container>
                        <ng-template #imgFallback>
                          <div *ngIf="shouldShowAttachmentSpinner(att); else imgAsFile" class="media-placeholder">
                            <mat-spinner diameter="22"></mat-spinner>
                          </div>
                          <ng-template #imgAsFile>
                            <div class="file-message">
                              <mat-icon class="file-msg-icon">image</mat-icon>
                              <span class="file-msg-name">{{ getAttachmentDisplayName(att, msg) }}</span>
                              <span *ngIf="hasAttachmentFailed(att)" class="media-load-label">Unavailable</span>
                            </div>
                          </ng-template>
                        </ng-template>
                      </div>
                    </ng-container>

                    <ng-template #nonImageAttachment>
                      <ng-container *ngIf="isVideoAttachmentItem(att); else regularFile">
                        <ng-container *ngIf="getAttachmentMediaUrl(att, msg) as videoUrl; else videoLoading">
                          <div class="video-message">
                            <video controls class="media-video" preload="metadata">
                              <source [src]="videoUrl" [type]="getAttachmentMimeType(att)" />
                              Your browser does not support video.
                            </video>
                            <a
                              class="video-download"
                              [href]="videoUrl"
                              [attr.download]="getAttachmentDisplayName(att, msg)"
                              target="_blank"
                              rel="noopener"
                              (click)="downloadAttachment($event, videoUrl, getAttachmentDisplayName(att, msg))"
                            >
                              Download {{ getAttachmentDisplayName(att, msg) }}
                            </a>
                          </div>
                        </ng-container>
                        <ng-template #videoLoading>
                          <div class="media-placeholder">
                            <mat-spinner *ngIf="shouldShowAttachmentSpinner(att)" diameter="22"></mat-spinner>
                            <span class="media-load-label">
                              {{ hasAttachmentFailed(att) ? 'Unavailable' : 'Loading video...' }}
                            </span>
                          </div>
                        </ng-template>
                      </ng-container>
                    </ng-template>

                    <ng-template #regularFile>
                      <ng-container *ngIf="getAttachmentMediaUrl(att, msg) as fileUrl; else fileLoading">
                        <a
                          class="file-download"
                          [href]="fileUrl"
                          [attr.download]="getAttachmentDisplayName(att, msg)"
                          target="_blank"
                          rel="noopener"
                          (click)="downloadAttachment($event, fileUrl, getAttachmentDisplayName(att, msg))"
                        >
                          <mat-icon class="file-msg-icon">{{ getAttachmentIcon(att, msg) }}</mat-icon>
                          <span class="file-msg-name">{{ getAttachmentDisplayName(att, msg) }}</span>
                          <mat-icon class="file-download-icon">download</mat-icon>
                        </a>
                      </ng-container>
                      <ng-template #fileLoading>
                        <div class="file-message">
                          <mat-icon class="file-msg-icon">{{ getAttachmentIcon(att, msg) }}</mat-icon>
                          <span class="file-msg-name">{{ getAttachmentDisplayName(att, msg) }}</span>
                          <mat-spinner *ngIf="shouldShowAttachmentSpinner(att)" diameter="18"></mat-spinner>
                          <span *ngIf="hasAttachmentFailed(att)" class="media-load-label">Unavailable</span>
                        </div>
                      </ng-template>
                    </ng-template>
                  </div>
                </div>
                <div
                  *ngIf="msg.message_type === 'TEXT' && getRenderableAttachments(msg).length === 0"
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

  `, isInline: true, styles: [".chat-thread{display:flex;flex-direction:column;height:100%;background:#041322;position:relative}.chat-thread.drag-over{outline:2px dashed rgba(255,255,255,.45);outline-offset:-6px}.thread-drag-overlay{position:absolute;inset:8px;z-index:20;pointer-events:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:#fff;background:#1f4bd852;border:2px dashed rgba(255,255,255,.55);border-radius:14px;font-size:14px;font-weight:600}.thread-drag-overlay mat-icon{font-size:36px;width:36px;height:36px}.chat-header{display:flex;align-items:center;padding:8px 8px 8px 4px;border-bottom:1px solid rgba(255,255,255,.15);gap:4px;flex-shrink:0}.chat-header button mat-icon{color:#fffc}.chat-name{font-size:16px;font-weight:600;color:#fff}.header-info{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;padding:0 4px}.header-actions{display:flex;gap:0}.header-actions button{width:32px;height:32px}.hdr-btn{border-radius:6px!important;transition:background .15s,box-shadow .15s}.hdr-btn:hover{background:#ffffff26!important;box-shadow:0 2px 8px #0003}.messages-area{flex:1;overflow-y:auto;padding:12px;background:transparent;scrollbar-width:none;-ms-overflow-style:none}.messages-area::-webkit-scrollbar{display:none}.loading-indicator{display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;color:#ffffffb3;font-size:13px}.load-more-btn{align-self:center;margin-bottom:16px;font-size:12px;color:#fff}.messages-list{display:flex;flex-direction:column;gap:1px;flex:1}.date-separator{text-align:center;margin:16px 0 8px;font-size:12px;color:#ffffffb3;font-weight:500}.message-bubble-row{display:flex;flex-direction:column;max-width:88%;margin-bottom:2px}.message-bubble-row.own{align-self:flex-end;align-items:flex-end}.message-bubble-row.other{align-self:flex-start;align-items:flex-start}.sender-name{font-size:11px;font-weight:700;color:#fffffff2;margin-bottom:3px;letter-spacing:.2px;padding:0 10px;text-shadow:0 1px 3px rgba(0,0,0,.4)}.message-bubble{padding:8px 14px 7px;border-radius:14px;font-size:13px;line-height:1.32;word-break:break-word;color:#f5f7ff;position:relative;display:inline-block;min-width:fit-content}.message-bubble-row.other .message-bubble{background:#0d2540;border-bottom-left-radius:5px;box-shadow:0 1px 4px #0006}.message-bubble.own-bubble{background:#0a3d62;border-bottom-right-radius:5px;box-shadow:0 1px 4px #0006}.image-message{line-height:0}.attachments-list{display:flex;flex-direction:column;gap:8px}.attachment-item{max-width:260px}.media-img{max-width:220px;max-height:280px;border-radius:10px;display:block;cursor:zoom-in;object-fit:cover;transition:opacity .15s}.media-img:hover{opacity:.88}.media-video{max-width:240px;max-height:260px;border-radius:10px;display:block;background:#000}.video-message{display:flex;flex-direction:column;gap:6px}.video-download{color:#ffffffc7;font-size:12px;text-decoration:underline;text-underline-offset:2px}.media-placeholder{display:flex;align-items:center;gap:8px;min-width:80px;min-height:44px;color:#fff9;font-size:11px}.media-load-label{font-size:11px;color:#fff9}.file-message{display:flex;align-items:center;gap:8px;padding:4px 0}.file-download{display:inline-flex;align-items:center;gap:8px;color:#fff;text-decoration:none;max-width:240px;padding:4px 0}.file-msg-icon{font-size:20px;width:20px;height:20px;color:#fffc}.file-msg-name{font-size:13px;color:#fff;word-break:break-all}.file-download-icon{font-size:18px;width:18px;height:18px;color:#ffffffb3;flex-shrink:0}.message-meta{display:flex;align-items:center;gap:4px;margin-top:3px}.msg-time{font-size:10px;color:#dae0faa8}.message-bubble-row.other .msg-time{color:#d8dff694}.read-icon{font-size:14px;width:14px;height:14px;opacity:.7}.read-icon.unread{opacity:.4}.quick-reactions{position:absolute;top:-18px;right:0;display:flex;align-items:center;gap:4px;padding:3px 5px;background:#071d30;border:1px solid rgba(255,255,255,.14);border-radius:999px;box-shadow:0 6px 14px #00000047;z-index:4}.message-bubble-row.other .quick-reactions{left:0;right:auto}.message-bubble-row.own .quick-reactions{left:auto;right:0}.quick-emoji-btn{width:20px;height:20px;border:none;border-radius:999px;background:transparent;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:13px;line-height:1;cursor:pointer;padding:0;transition:transform .12s ease,background .12s ease}.quick-emoji-btn:hover{background:#ffffff2e;transform:scale(1.14)}.reactions-row{display:flex;flex-wrap:wrap;gap:3px;margin-top:5px}.reaction-chip{background:#ffffff14;border:1px solid rgba(255,255,255,.2);border-radius:999px;padding:1px 7px;font-size:11px;color:#f2f6ff;cursor:pointer;transition:all .2s}.reaction-chip:hover{background:#ffffff40;transform:scale(1.05)}.reaction-chip.own-reaction{background:#2a5bff4d;border-color:#2a5bff80}.empty-chat{display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;color:#9ca3af}.empty-chat mat-icon{font-size:48px;width:48px;height:48px;margin-bottom:8px}.empty-chat p{font-size:14px;margin:0}\n"], dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i4.NgForOf, selector: "[ngFor][ngForOf]", inputs: ["ngForOf", "ngForTrackBy", "ngForTemplate"] }, { kind: "directive", type: i4.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "ngmodule", type: MatIconModule }, { kind: "component", type: i5.MatIcon, selector: "mat-icon", inputs: ["color", "inline", "svgIcon", "fontSet", "fontIcon"], exportAs: ["matIcon"] }, { kind: "ngmodule", type: MatButtonModule }, { kind: "component", type: i6.MatButton, selector: "    button[mat-button], button[mat-raised-button], button[mat-flat-button],    button[mat-stroked-button]  ", exportAs: ["matButton"] }, { kind: "component", type: i6.MatIconButton, selector: "button[mat-icon-button]", exportAs: ["matButton"] }, { kind: "ngmodule", type: MatProgressSpinnerModule }, { kind: "component", type: i7.MatProgressSpinner, selector: "mat-progress-spinner, mat-spinner", inputs: ["color", "mode", "value", "diameter", "strokeWidth"], exportAs: ["matProgressSpinner"] }, { kind: "ngmodule", type: MatTooltipModule }, { kind: "directive", type: i8.MatTooltip, selector: "[matTooltip]", inputs: ["matTooltipPosition", "matTooltipPositionAtOrigin", "matTooltipDisabled", "matTooltipShowDelay", "matTooltipHideDelay", "matTooltipTouchGestures", "matTooltip", "matTooltipClass"], exportAs: ["matTooltip"] }, { kind: "component", type: MessageInputComponent, selector: "app-message-input", outputs: ["messageSent", "messageWithFiles"] }] });
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
          <ng-container *ngFor="let msg of messages; let i = index; trackBy: trackByMessage">
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
                <!-- Attachments ───────────────────────────────── -->
                <div *ngIf="getRenderableAttachments(msg).length > 0" class="attachments-list">
                  <div *ngFor="let att of getRenderableAttachments(msg); trackBy: trackByAttachment" class="attachment-item">
                    <ng-container *ngIf="isImageAttachmentItem(att); else nonImageAttachment">
                      <div class="image-message">
                        <ng-container *ngIf="getAttachmentMediaUrl(att, msg) as dataUrl; else imgFallback">
                          <img [src]="dataUrl" alt="Image" class="media-img" (click)="$event.stopPropagation(); openLightbox(dataUrl)" />
                        </ng-container>
                        <ng-template #imgFallback>
                          <div *ngIf="shouldShowAttachmentSpinner(att); else imgAsFile" class="media-placeholder">
                            <mat-spinner diameter="22"></mat-spinner>
                          </div>
                          <ng-template #imgAsFile>
                            <div class="file-message">
                              <mat-icon class="file-msg-icon">image</mat-icon>
                              <span class="file-msg-name">{{ getAttachmentDisplayName(att, msg) }}</span>
                              <span *ngIf="hasAttachmentFailed(att)" class="media-load-label">Unavailable</span>
                            </div>
                          </ng-template>
                        </ng-template>
                      </div>
                    </ng-container>

                    <ng-template #nonImageAttachment>
                      <ng-container *ngIf="isVideoAttachmentItem(att); else regularFile">
                        <ng-container *ngIf="getAttachmentMediaUrl(att, msg) as videoUrl; else videoLoading">
                          <div class="video-message">
                            <video controls class="media-video" preload="metadata">
                              <source [src]="videoUrl" [type]="getAttachmentMimeType(att)" />
                              Your browser does not support video.
                            </video>
                            <a
                              class="video-download"
                              [href]="videoUrl"
                              [attr.download]="getAttachmentDisplayName(att, msg)"
                              target="_blank"
                              rel="noopener"
                              (click)="downloadAttachment($event, videoUrl, getAttachmentDisplayName(att, msg))"
                            >
                              Download {{ getAttachmentDisplayName(att, msg) }}
                            </a>
                          </div>
                        </ng-container>
                        <ng-template #videoLoading>
                          <div class="media-placeholder">
                            <mat-spinner *ngIf="shouldShowAttachmentSpinner(att)" diameter="22"></mat-spinner>
                            <span class="media-load-label">
                              {{ hasAttachmentFailed(att) ? 'Unavailable' : 'Loading video...' }}
                            </span>
                          </div>
                        </ng-template>
                      </ng-container>
                    </ng-template>

                    <ng-template #regularFile>
                      <ng-container *ngIf="getAttachmentMediaUrl(att, msg) as fileUrl; else fileLoading">
                        <a
                          class="file-download"
                          [href]="fileUrl"
                          [attr.download]="getAttachmentDisplayName(att, msg)"
                          target="_blank"
                          rel="noopener"
                          (click)="downloadAttachment($event, fileUrl, getAttachmentDisplayName(att, msg))"
                        >
                          <mat-icon class="file-msg-icon">{{ getAttachmentIcon(att, msg) }}</mat-icon>
                          <span class="file-msg-name">{{ getAttachmentDisplayName(att, msg) }}</span>
                          <mat-icon class="file-download-icon">download</mat-icon>
                        </a>
                      </ng-container>
                      <ng-template #fileLoading>
                        <div class="file-message">
                          <mat-icon class="file-msg-icon">{{ getAttachmentIcon(att, msg) }}</mat-icon>
                          <span class="file-msg-name">{{ getAttachmentDisplayName(att, msg) }}</span>
                          <mat-spinner *ngIf="shouldShowAttachmentSpinner(att)" diameter="18"></mat-spinner>
                          <span *ngIf="hasAttachmentFailed(att)" class="media-load-label">Unavailable</span>
                        </div>
                      </ng-template>
                    </ng-template>
                  </div>
                </div>
                <div
                  *ngIf="msg.message_type === 'TEXT' && getRenderableAttachments(msg).length === 0"
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

  `, styles: [".chat-thread{display:flex;flex-direction:column;height:100%;background:#041322;position:relative}.chat-thread.drag-over{outline:2px dashed rgba(255,255,255,.45);outline-offset:-6px}.thread-drag-overlay{position:absolute;inset:8px;z-index:20;pointer-events:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:#fff;background:#1f4bd852;border:2px dashed rgba(255,255,255,.55);border-radius:14px;font-size:14px;font-weight:600}.thread-drag-overlay mat-icon{font-size:36px;width:36px;height:36px}.chat-header{display:flex;align-items:center;padding:8px 8px 8px 4px;border-bottom:1px solid rgba(255,255,255,.15);gap:4px;flex-shrink:0}.chat-header button mat-icon{color:#fffc}.chat-name{font-size:16px;font-weight:600;color:#fff}.header-info{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;padding:0 4px}.header-actions{display:flex;gap:0}.header-actions button{width:32px;height:32px}.hdr-btn{border-radius:6px!important;transition:background .15s,box-shadow .15s}.hdr-btn:hover{background:#ffffff26!important;box-shadow:0 2px 8px #0003}.messages-area{flex:1;overflow-y:auto;padding:12px;background:transparent;scrollbar-width:none;-ms-overflow-style:none}.messages-area::-webkit-scrollbar{display:none}.loading-indicator{display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;color:#ffffffb3;font-size:13px}.load-more-btn{align-self:center;margin-bottom:16px;font-size:12px;color:#fff}.messages-list{display:flex;flex-direction:column;gap:1px;flex:1}.date-separator{text-align:center;margin:16px 0 8px;font-size:12px;color:#ffffffb3;font-weight:500}.message-bubble-row{display:flex;flex-direction:column;max-width:88%;margin-bottom:2px}.message-bubble-row.own{align-self:flex-end;align-items:flex-end}.message-bubble-row.other{align-self:flex-start;align-items:flex-start}.sender-name{font-size:11px;font-weight:700;color:#fffffff2;margin-bottom:3px;letter-spacing:.2px;padding:0 10px;text-shadow:0 1px 3px rgba(0,0,0,.4)}.message-bubble{padding:8px 14px 7px;border-radius:14px;font-size:13px;line-height:1.32;word-break:break-word;color:#f5f7ff;position:relative;display:inline-block;min-width:fit-content}.message-bubble-row.other .message-bubble{background:#0d2540;border-bottom-left-radius:5px;box-shadow:0 1px 4px #0006}.message-bubble.own-bubble{background:#0a3d62;border-bottom-right-radius:5px;box-shadow:0 1px 4px #0006}.image-message{line-height:0}.attachments-list{display:flex;flex-direction:column;gap:8px}.attachment-item{max-width:260px}.media-img{max-width:220px;max-height:280px;border-radius:10px;display:block;cursor:zoom-in;object-fit:cover;transition:opacity .15s}.media-img:hover{opacity:.88}.media-video{max-width:240px;max-height:260px;border-radius:10px;display:block;background:#000}.video-message{display:flex;flex-direction:column;gap:6px}.video-download{color:#ffffffc7;font-size:12px;text-decoration:underline;text-underline-offset:2px}.media-placeholder{display:flex;align-items:center;gap:8px;min-width:80px;min-height:44px;color:#fff9;font-size:11px}.media-load-label{font-size:11px;color:#fff9}.file-message{display:flex;align-items:center;gap:8px;padding:4px 0}.file-download{display:inline-flex;align-items:center;gap:8px;color:#fff;text-decoration:none;max-width:240px;padding:4px 0}.file-msg-icon{font-size:20px;width:20px;height:20px;color:#fffc}.file-msg-name{font-size:13px;color:#fff;word-break:break-all}.file-download-icon{font-size:18px;width:18px;height:18px;color:#ffffffb3;flex-shrink:0}.message-meta{display:flex;align-items:center;gap:4px;margin-top:3px}.msg-time{font-size:10px;color:#dae0faa8}.message-bubble-row.other .msg-time{color:#d8dff694}.read-icon{font-size:14px;width:14px;height:14px;opacity:.7}.read-icon.unread{opacity:.4}.quick-reactions{position:absolute;top:-18px;right:0;display:flex;align-items:center;gap:4px;padding:3px 5px;background:#071d30;border:1px solid rgba(255,255,255,.14);border-radius:999px;box-shadow:0 6px 14px #00000047;z-index:4}.message-bubble-row.other .quick-reactions{left:0;right:auto}.message-bubble-row.own .quick-reactions{left:auto;right:0}.quick-emoji-btn{width:20px;height:20px;border:none;border-radius:999px;background:transparent;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:13px;line-height:1;cursor:pointer;padding:0;transition:transform .12s ease,background .12s ease}.quick-emoji-btn:hover{background:#ffffff2e;transform:scale(1.14)}.reactions-row{display:flex;flex-wrap:wrap;gap:3px;margin-top:5px}.reaction-chip{background:#ffffff14;border:1px solid rgba(255,255,255,.2);border-radius:999px;padding:1px 7px;font-size:11px;color:#f2f6ff;cursor:pointer;transition:all .2s}.reaction-chip:hover{background:#ffffff40;transform:scale(1.05)}.reaction-chip.own-reaction{background:#2a5bff4d;border-color:#2a5bff80}.empty-chat{display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;color:#9ca3af}.empty-chat mat-icon{font-size:48px;width:48px;height:48px;margin-bottom:8px}.empty-chat p{font-size:14px;margin:0}\n"] }]
        }], ctorParameters: () => [{ type: i1.MessagingStoreService }, { type: i2.AuthService }, { type: i3.MessagingFileService }, { type: i0.ChangeDetectorRef }], propDecorators: { scrollContainer: [{
                type: ViewChild,
                args: ['scrollContainer']
            }], messageInput: [{
                type: ViewChild,
                args: [MessageInputComponent]
            }], lightboxOpen: [{
                type: Output
            }] } });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdC10aHJlYWQuY29tcG9uZW50LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL2xpYi9jb21wb25lbnRzL2NoYXQtdGhyZWFkL2NoYXQtdGhyZWFkLmNvbXBvbmVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQ0wsU0FBUyxFQUFxQixTQUFTLEVBQ3ZDLE1BQU0sRUFBRSxZQUFZLEdBQ3JCLE1BQU0sZUFBZSxDQUFDO0FBQ3ZCLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUMvQyxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sd0JBQXdCLENBQUM7QUFDdkQsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBQzNELE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQzlFLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBQzdELE9BQU8sRUFBZ0IsYUFBYSxFQUFFLE1BQU0sTUFBTSxDQUFDO0FBSW5ELE9BQU8sRUFBZ0MscUJBQXFCLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUMxSCxPQUFPLEVBQUUscUJBQXFCLEVBQWtCLE1BQU0sMENBQTBDLENBQUM7Ozs7Ozs7Ozs7QUFtbUJqRyxNQUFNLE9BQU8sbUJBQW1CO0lBNkJwQjtJQUNBO0lBQ0E7SUFDQTtJQS9Cb0IsZUFBZSxDQUFjO0lBQ3pCLFlBQVksQ0FBeUI7SUFDN0QsWUFBWSxHQUFHLElBQUksWUFBWSxFQUFVLENBQUM7SUFFcEQsUUFBUSxHQUFjLEVBQUUsQ0FBQztJQUN6QixlQUFlLEdBQWMsRUFBRSxDQUFDO0lBQ2hDLGdCQUFnQixHQUFHLEVBQUUsQ0FBQztJQUN0QixPQUFPLEdBQUcsS0FBSyxDQUFDO0lBQ2hCLE9BQU8sR0FBRyxLQUFLLENBQUM7SUFDaEIsV0FBVyxHQUFrQixJQUFJLENBQUM7SUFFMUIs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ckIsTUFBTSIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7XG4gIENvbXBvbmVudCwgT25Jbml0LCBPbkRlc3Ryb3ksIFZpZXdDaGlsZCwgRWxlbWVudFJlZiwgQWZ0ZXJWaWV3Q2hlY2tlZCwgQ2hhbmdlRGV0ZWN0b3JSZWYsXG4gIE91dHB1dCwgRXZlbnRFbWl0dGVyLFxufSBmcm9tICdAYW5ndWxhci9jb3JlJztcbmltcG9ydCB7IENvbW1vbk1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL2NvbW1vbic7XG5pbXBvcnQgeyBNYXRJY29uTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvbWF0ZXJpYWwvaWNvbic7XG5pbXBvcnQgeyBNYXRCdXR0b25Nb2R1bGUgfSBmcm9tICdAYW5ndWxhci9tYXRlcmlhbC9idXR0b24nO1xuaW1wb3J0IHsgTWF0UHJvZ3Jlc3NTcGlubmVyTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvbWF0ZXJpYWwvcHJvZ3Jlc3Mtc3Bpbm5lcic7XG5pbXBvcnQgeyBNYXRUb29sdGlwTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvbWF0ZXJpYWwvdG9vbHRpcCc7XG5pbXBvcnQgeyBTdWJzY3JpcHRpb24sIGNvbWJpbmVMYXRlc3QgfSBmcm9tICdyeGpzJztcbmltcG9ydCB7IE1lc3NhZ2luZ1N0b3JlU2VydmljZSB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL21lc3NhZ2luZy1zdG9yZS5zZXJ2aWNlJztcbmltcG9ydCB7IE1lc3NhZ2luZ0ZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvbWVzc2FnaW5nLWZpbGUuc2VydmljZSc7XG5pbXBvcnQgeyBBdXRoU2VydmljZSB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL2F1dGguc2VydmljZSc7XG5pbXBvcnQgeyBDb250YWN0LCBNZXNzYWdlLCBBdHRhY2htZW50LCBnZXRDb250YWN0RGlzcGxheU5hbWUsIGdldE1lc3NhZ2VTZW5kZXJOYW1lIH0gZnJvbSAnLi4vLi4vbW9kZWxzL21lc3NhZ2luZy5tb2RlbHMnO1xuaW1wb3J0IHsgTWVzc2FnZUlucHV0Q29tcG9uZW50LCBNZXNzYWdlUGF5bG9hZCB9IGZyb20gJy4uL21lc3NhZ2UtaW5wdXQvbWVzc2FnZS1pbnB1dC5jb21wb25lbnQnO1xuXG5AQ29tcG9uZW50KHtcbiAgc2VsZWN0b3I6ICdhcHAtY2hhdC10aHJlYWQnLFxuICBzdGFuZGFsb25lOiB0cnVlLFxuICBpbXBvcnRzOiBbXG4gICAgQ29tbW9uTW9kdWxlLCBNYXRJY29uTW9kdWxlLCBNYXRCdXR0b25Nb2R1bGUsXG4gICAgTWF0UHJvZ3Jlc3NTcGlubmVyTW9kdWxlLCBNYXRUb29sdGlwTW9kdWxlLCBNZXNzYWdlSW5wdXRDb21wb25lbnQsXG4gIF0sXG4gIHRlbXBsYXRlOiBgXG4gICAgPGRpdlxuICAgICAgY2xhc3M9XCJjaGF0LXRocmVhZFwiXG4gICAgICBbY2xhc3MuZHJhZy1vdmVyXT1cInRocmVhZERyYWdPdmVyXCJcbiAgICAgIChkcmFnZW50ZXIpPVwib25UaHJlYWREcmFnRW50ZXIoJGV2ZW50KVwiXG4gICAgICAoZHJhZ292ZXIpPVwib25UaHJlYWREcmFnT3ZlcigkZXZlbnQpXCJcbiAgICAgIChkcmFnbGVhdmUpPVwib25UaHJlYWREcmFnTGVhdmUoJGV2ZW50KVwiXG4gICAgICAoZHJvcCk9XCJvblRocmVhZERyb3AoJGV2ZW50KVwiXG4gICAgPlxuICAgICAgPGRpdiBjbGFzcz1cImNoYXQtaGVhZGVyXCI+XG4gICAgICAgIDxidXR0b24gbWF0LWljb24tYnV0dG9uIGNsYXNzPVwiaGRyLWJ0blwiIChjbGljayk9XCJnb0JhY2soKVwiIG1hdFRvb2x0aXA9XCJCYWNrXCIgbWF0VG9vbHRpcFBvc2l0aW9uPVwiYmVsb3dcIj5cbiAgICAgICAgICA8bWF0LWljb24+YXJyb3dfYmFjazwvbWF0LWljb24+XG4gICAgICAgIDwvYnV0dG9uPlxuICAgICAgICA8ZGl2IGNsYXNzPVwiaGVhZGVyLWluZm9cIj5cbiAgICAgICAgICA8c3BhbiBjbGFzcz1cImNoYXQtbmFtZVwiPnt7IGNvbnZlcnNhdGlvbk5hbWUgfX08L3NwYW4+XG4gICAgICAgIDwvZGl2PlxuICAgICAgICA8ZGl2IGNsYXNzPVwiaGVhZGVyLWFjdGlvbnNcIj5cbiAgICAgICAgICA8YnV0dG9uICpuZ0lmPVwiaXNHcm91cFwiIG1hdC1pY29uLWJ1dHRvbiBjbGFzcz1cImhkci1idG5cIiAoY2xpY2spPVwib25Hcm91cFNldHRpbmdzKClcIiBtYXRUb29sdGlwPVwiR3JvdXAgc2V0dGluZ3NcIiBtYXRUb29sdGlwUG9zaXRpb249XCJiZWxvd1wiPlxuICAgICAgICAgICAgPG1hdC1pY29uPnNldHRpbmdzPC9tYXQtaWNvbj5cbiAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cblxuICAgICAgPGRpdiBjbGFzcz1cIm1lc3NhZ2VzLWFyZWFcIiAjc2Nyb2xsQ29udGFpbmVyIChzY3JvbGwpPVwib25TY3JvbGwoKVwiPlxuICAgICAgICA8ZGl2ICpuZ0lmPVwidGhyZWFkRHJhZ092ZXJcIiBjbGFzcz1cInRocmVhZC1kcmFnLW92ZXJsYXlcIj5cbiAgICAgICAgICA8bWF0LWljb24+Y2xvdWRfdXBsb2FkPC9tYXQtaWNvbj5cbiAgICAgICAgICA8c3Bhbj5Ecm9wIGZpbGVzIGFueXdoZXJlIGluIHRoaXMgY2hhdDwvc3Bhbj5cbiAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgPGRpdiAqbmdJZj1cImxvYWRpbmdcIiBjbGFzcz1cImxvYWRpbmctaW5kaWNhdG9yXCI+XG4gICAgICAgICAgPG1hdC1zcGlubmVyIGRpYW1ldGVyPVwiMjRcIj48L21hdC1zcGlubmVyPlxuICAgICAgICAgIDxzcGFuPkxvYWRpbmcgbWVzc2FnZXMuLi48L3NwYW4+XG4gICAgICAgIDwvZGl2PlxuXG4gICAgICAgIDxidXR0b25cbiAgICAgICAgICAqbmdJZj1cIm1lc3NhZ2VzLmxlbmd0aCA+PSA1MCAmJiAhbG9hZGluZ1wiXG4gICAgICAgICAgbWF0LXN0cm9rZWQtYnV0dG9uXG4gICAgICAgICAgY2xhc3M9XCJsb2FkLW1vcmUtYnRuXCJcbiAgICAgICAgICAoY2xpY2spPVwibG9hZE9sZGVyKClcIlxuICAgICAgICA+XG4gICAgICAgICAgTG9hZCBvbGRlciBtZXNzYWdlc1xuICAgICAgICA8L2J1dHRvbj5cblxuICAgICAgICA8ZGl2IGNsYXNzPVwibWVzc2FnZXMtbGlzdFwiPlxuICAgICAgICAgIDxuZy1jb250YWluZXIgKm5nRm9yPVwibGV0IG1zZyBvZiBtZXNzYWdlczsgbGV0IGkgPSBpbmRleDsgdHJhY2tCeTogdHJhY2tCeU1lc3NhZ2VcIj5cbiAgICAgICAgICAgIDxkaXZcbiAgICAgICAgICAgICAgKm5nSWY9XCJzaG91bGRTaG93RGF0ZVNlcGFyYXRvcihpKVwiXG4gICAgICAgICAgICAgIGNsYXNzPVwiZGF0ZS1zZXBhcmF0b3JcIlxuICAgICAgICAgICAgPlxuICAgICAgICAgICAgICA8c3Bhbj57eyBmb3JtYXREYXRlKG1zZy5jcmVhdGVkX2F0KSB9fTwvc3Bhbj5cbiAgICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgICAgICA8ZGl2XG4gICAgICAgICAgICAgIGNsYXNzPVwibWVzc2FnZS1idWJibGUtcm93XCJcbiAgICAgICAgICAgICAgW2NsYXNzLm93bl09XCJpc093bk1lc3NhZ2UobXNnKVwiXG4gICAgICAgICAgICAgIFtjbGFzcy5vdGhlcl09XCIhaXNPd25NZXNzYWdlKG1zZylcIlxuICAgICAgICAgICAgPlxuICAgICAgICAgICAgICA8ZGl2ICpuZ0lmPVwiIWlzT3duTWVzc2FnZShtc2cpXCIgY2xhc3M9XCJzZW5kZXItbmFtZVwiPlxuICAgICAgICAgICAgICAgIHt7IGdldFNlbmRlck5hbWUobXNnKSB9fVxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cIm1lc3NhZ2UtYnViYmxlXCIgW2NsYXNzLm93bi1idWJibGVdPVwiaXNPd25NZXNzYWdlKG1zZylcIiAobW91c2VlbnRlcik9XCJob3ZlcmVkTWVzc2FnZUlkID0gbXNnLm1lc3NhZ2VfaWRcIiAobW91c2VsZWF2ZSk9XCJob3ZlcmVkTWVzc2FnZUlkID0gbnVsbFwiPlxuICAgICAgICAgICAgICAgIDwhLS0gQXR0YWNobWVudHMg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAIC0tPlxuICAgICAgICAgICAgICAgIDxkaXYgKm5nSWY9XCJnZXRSZW5kZXJhYmxlQXR0YWNobWVudHMobXNnKS5sZW5ndGggPiAwXCIgY2xhc3M9XCJhdHRhY2htZW50cy1saXN0XCI+XG4gICAgICAgICAgICAgICAgICA8ZGl2ICpuZ0Zvcj1cImxldCBhdHQgb2YgZ2V0UmVuZGVyYWJsZUF0dGFjaG1lbnRzKG1zZyk7IHRyYWNrQnk6IHRyYWNrQnlBdHRhY2htZW50XCIgY2xhc3M9XCJhdHRhY2htZW50LWl0ZW1cIj5cbiAgICAgICAgICAgICAgICAgICAgPG5nLWNvbnRhaW5lciAqbmdJZj1cImlzSW1hZ2VBdHRhY2htZW50SXRlbShhdHQpOyBlbHNlIG5vbkltYWdlQXR0YWNobWVudFwiPlxuICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJpbWFnZS1tZXNzYWdlXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICA8bmctY29udGFpbmVyICpuZ0lmPVwiZ2V0QXR0YWNobWVudE1lZGlhVXJsKGF0dCwgbXNnKSBhcyBkYXRhVXJsOyBlbHNlIGltZ0ZhbGxiYWNrXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxpbWcgW3NyY109XCJkYXRhVXJsXCIgYWx0PVwiSW1hZ2VcIiBjbGFzcz1cIm1lZGlhLWltZ1wiIChjbGljayk9XCIkZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7IG9wZW5MaWdodGJveChkYXRhVXJsKVwiIC8+XG4gICAgICAgICAgICAgICAgICAgICAgICA8L25nLWNvbnRhaW5lcj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxuZy10ZW1wbGF0ZSAjaW1nRmFsbGJhY2s+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgKm5nSWY9XCJzaG91bGRTaG93QXR0YWNobWVudFNwaW5uZXIoYXR0KTsgZWxzZSBpbWdBc0ZpbGVcIiBjbGFzcz1cIm1lZGlhLXBsYWNlaG9sZGVyXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPG1hdC1zcGlubmVyIGRpYW1ldGVyPVwiMjJcIj48L21hdC1zcGlubmVyPlxuICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPG5nLXRlbXBsYXRlICNpbWdBc0ZpbGU+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZpbGUtbWVzc2FnZVwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPG1hdC1pY29uIGNsYXNzPVwiZmlsZS1tc2ctaWNvblwiPmltYWdlPC9tYXQtaWNvbj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwiZmlsZS1tc2ctbmFtZVwiPnt7IGdldEF0dGFjaG1lbnREaXNwbGF5TmFtZShhdHQsIG1zZykgfX08L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiAqbmdJZj1cImhhc0F0dGFjaG1lbnRGYWlsZWQoYXR0KVwiIGNsYXNzPVwibWVkaWEtbG9hZC1sYWJlbFwiPlVuYXZhaWxhYmxlPC9zcGFuPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgICAgICA8L25nLXRlbXBsYXRlPlxuICAgICAgICAgICAgICAgICAgICAgICAgPC9uZy10ZW1wbGF0ZT5cbiAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgPC9uZy1jb250YWluZXI+XG5cbiAgICAgICAgICAgICAgICAgICAgPG5nLXRlbXBsYXRlICNub25JbWFnZUF0dGFjaG1lbnQ+XG4gICAgICAgICAgICAgICAgICAgICAgPG5nLWNvbnRhaW5lciAqbmdJZj1cImlzVmlkZW9BdHRhY2htZW50SXRlbShhdHQpOyBlbHNlIHJlZ3VsYXJGaWxlXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICA8bmctY29udGFpbmVyICpuZ0lmPVwiZ2V0QXR0YWNobWVudE1lZGlhVXJsKGF0dCwgbXNnKSBhcyB2aWRlb1VybDsgZWxzZSB2aWRlb0xvYWRpbmdcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInZpZGVvLW1lc3NhZ2VcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dmlkZW8gY29udHJvbHMgY2xhc3M9XCJtZWRpYS12aWRlb1wiIHByZWxvYWQ9XCJtZXRhZGF0YVwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHNvdXJjZSBbc3JjXT1cInZpZGVvVXJsXCIgW3R5cGVdPVwiZ2V0QXR0YWNobWVudE1pbWVUeXBlKGF0dClcIiAvPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgWW91ciBicm93c2VyIGRvZXMgbm90IHN1cHBvcnQgdmlkZW8uXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPC92aWRlbz5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8YVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3M9XCJ2aWRlby1kb3dubG9hZFwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBbaHJlZl09XCJ2aWRlb1VybFwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBbYXR0ci5kb3dubG9hZF09XCJnZXRBdHRhY2htZW50RGlzcGxheU5hbWUoYXR0LCBtc2cpXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRhcmdldD1cIl9ibGFua1wiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWw9XCJub29wZW5lclwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAoY2xpY2spPVwiZG93bmxvYWRBdHRhY2htZW50KCRldmVudCwgdmlkZW9VcmwsIGdldEF0dGFjaG1lbnREaXNwbGF5TmFtZShhdHQsIG1zZykpXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBEb3dubG9hZCB7eyBnZXRBdHRhY2htZW50RGlzcGxheU5hbWUoYXR0LCBtc2cpIH19XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9hPlxuICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDwvbmctY29udGFpbmVyPlxuICAgICAgICAgICAgICAgICAgICAgICAgPG5nLXRlbXBsYXRlICN2aWRlb0xvYWRpbmc+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJtZWRpYS1wbGFjZWhvbGRlclwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxtYXQtc3Bpbm5lciAqbmdJZj1cInNob3VsZFNob3dBdHRhY2htZW50U3Bpbm5lcihhdHQpXCIgZGlhbWV0ZXI9XCIyMlwiPjwvbWF0LXNwaW5uZXI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJtZWRpYS1sb2FkLWxhYmVsXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7eyBoYXNBdHRhY2htZW50RmFpbGVkKGF0dCkgPyAnVW5hdmFpbGFibGUnIDogJ0xvYWRpbmcgdmlkZW8uLi4nIH19XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDwvbmctdGVtcGxhdGU+XG4gICAgICAgICAgICAgICAgICAgICAgPC9uZy1jb250YWluZXI+XG4gICAgICAgICAgICAgICAgICAgIDwvbmctdGVtcGxhdGU+XG5cbiAgICAgICAgICAgICAgICAgICAgPG5nLXRlbXBsYXRlICNyZWd1bGFyRmlsZT5cbiAgICAgICAgICAgICAgICAgICAgICA8bmctY29udGFpbmVyICpuZ0lmPVwiZ2V0QXR0YWNobWVudE1lZGlhVXJsKGF0dCwgbXNnKSBhcyBmaWxlVXJsOyBlbHNlIGZpbGVMb2FkaW5nXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICA8YVxuICAgICAgICAgICAgICAgICAgICAgICAgICBjbGFzcz1cImZpbGUtZG93bmxvYWRcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICBbaHJlZl09XCJmaWxlVXJsXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgW2F0dHIuZG93bmxvYWRdPVwiZ2V0QXR0YWNobWVudERpc3BsYXlOYW1lKGF0dCwgbXNnKVwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHRhcmdldD1cIl9ibGFua1wiXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHJlbD1cIm5vb3BlbmVyXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgKGNsaWNrKT1cImRvd25sb2FkQXR0YWNobWVudCgkZXZlbnQsIGZpbGVVcmwsIGdldEF0dGFjaG1lbnREaXNwbGF5TmFtZShhdHQsIG1zZykpXCJcbiAgICAgICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPG1hdC1pY29uIGNsYXNzPVwiZmlsZS1tc2ctaWNvblwiPnt7IGdldEF0dGFjaG1lbnRJY29uKGF0dCwgbXNnKSB9fTwvbWF0LWljb24+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwiZmlsZS1tc2ctbmFtZVwiPnt7IGdldEF0dGFjaG1lbnREaXNwbGF5TmFtZShhdHQsIG1zZykgfX08L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxtYXQtaWNvbiBjbGFzcz1cImZpbGUtZG93bmxvYWQtaWNvblwiPmRvd25sb2FkPC9tYXQtaWNvbj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDwvYT5cbiAgICAgICAgICAgICAgICAgICAgICA8L25nLWNvbnRhaW5lcj5cbiAgICAgICAgICAgICAgICAgICAgICA8bmctdGVtcGxhdGUgI2ZpbGVMb2FkaW5nPlxuICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZpbGUtbWVzc2FnZVwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICA8bWF0LWljb24gY2xhc3M9XCJmaWxlLW1zZy1pY29uXCI+e3sgZ2V0QXR0YWNobWVudEljb24oYXR0LCBtc2cpIH19PC9tYXQtaWNvbj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJmaWxlLW1zZy1uYW1lXCI+e3sgZ2V0QXR0YWNobWVudERpc3BsYXlOYW1lKGF0dCwgbXNnKSB9fTwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPG1hdC1zcGlubmVyICpuZ0lmPVwic2hvdWxkU2hvd0F0dGFjaG1lbnRTcGlubmVyKGF0dClcIiBkaWFtZXRlcj1cIjE4XCI+PC9tYXQtc3Bpbm5lcj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gKm5nSWY9XCJoYXNBdHRhY2htZW50RmFpbGVkKGF0dClcIiBjbGFzcz1cIm1lZGlhLWxvYWQtbGFiZWxcIj5VbmF2YWlsYWJsZTwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgIDwvbmctdGVtcGxhdGU+XG4gICAgICAgICAgICAgICAgICAgIDwvbmctdGVtcGxhdGU+XG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICA8ZGl2XG4gICAgICAgICAgICAgICAgICAqbmdJZj1cIm1zZy5tZXNzYWdlX3R5cGUgPT09ICdURVhUJyAmJiBnZXRSZW5kZXJhYmxlQXR0YWNobWVudHMobXNnKS5sZW5ndGggPT09IDBcIlxuICAgICAgICAgICAgICAgICAgY2xhc3M9XCJ0ZXh0LWNvbnRlbnRcIlxuICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgIHt7IG1zZy5jb250ZW50IH19XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cIm1lc3NhZ2UtbWV0YVwiPlxuICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJtc2ctdGltZVwiPnt7IGZvcm1hdFRpbWUobXNnLmNyZWF0ZWRfYXQpIH19PC9zcGFuPlxuICAgICAgICAgICAgICAgICAgPG1hdC1pY29uICpuZ0lmPVwiaXNPd25NZXNzYWdlKG1zZykgJiYgbXNnLmlzX3JlYWRcIiBjbGFzcz1cInJlYWQtaWNvblwiPmRvbmVfYWxsPC9tYXQtaWNvbj5cbiAgICAgICAgICAgICAgICAgIDxtYXQtaWNvbiAqbmdJZj1cImlzT3duTWVzc2FnZShtc2cpICYmICFtc2cuaXNfcmVhZFwiIGNsYXNzPVwicmVhZC1pY29uIHVucmVhZFwiPmRvbmU8L21hdC1pY29uPlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDxkaXYgKm5nSWY9XCJob3ZlcmVkTWVzc2FnZUlkID09PSBtc2cubWVzc2FnZV9pZFwiIGNsYXNzPVwicXVpY2stcmVhY3Rpb25zXCI+XG4gICAgICAgICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgICAgICAgICpuZ0Zvcj1cImxldCBlbW9qaSBvZiBxdWlja0Vtb2ppc1wiXG4gICAgICAgICAgICAgICAgICAgIGNsYXNzPVwicXVpY2stZW1vamktYnRuXCJcbiAgICAgICAgICAgICAgICAgICAgKGNsaWNrKT1cIm9uRW1vamlTZWxlY3RlZChlbW9qaSwgbXNnLm1lc3NhZ2VfaWQpXCJcbiAgICAgICAgICAgICAgICAgICAgW2F0dHIuYXJpYS1sYWJlbF09XCInUmVhY3Qgd2l0aCAnICsgZW1vamlcIlxuICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICB7eyBlbW9qaSB9fVxuICAgICAgICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgPGRpdiAqbmdJZj1cIm1zZy5yZWFjdGlvbnMgJiYgbXNnLnJlYWN0aW9ucy5sZW5ndGggPiAwXCIgY2xhc3M9XCJyZWFjdGlvbnMtcm93XCI+XG4gICAgICAgICAgICAgICAgICA8YnV0dG9uIFxuICAgICAgICAgICAgICAgICAgICAqbmdGb3I9XCJsZXQgciBvZiBtc2cucmVhY3Rpb25zXCIgXG4gICAgICAgICAgICAgICAgICAgIGNsYXNzPVwicmVhY3Rpb24tY2hpcFwiXG4gICAgICAgICAgICAgICAgICAgIChjbGljayk9XCJ0b2dnbGVSZWFjdGlvbihyLmVtb2ppLCBtc2cubWVzc2FnZV9pZClcIlxuICAgICAgICAgICAgICAgICAgICBbY2xhc3Mub3duLXJlYWN0aW9uXT1cInIuaGFzUmVhY3RlZFwiXG4gICAgICAgICAgICAgICAgICAgIFttYXRUb29sdGlwXT1cImdldFJlYWN0b3JUb29sdGlwKHIpXCJcbiAgICAgICAgICAgICAgICAgICAgbWF0VG9vbHRpcFBvc2l0aW9uPVwiYWJvdmVcIlxuICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICB7eyByLmVtb2ppIH19IHt7IHIuY291bnQgfX1cbiAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDwvbmctY29udGFpbmVyPlxuICAgICAgICA8L2Rpdj5cblxuICAgICAgICA8ZGl2ICpuZ0lmPVwibWVzc2FnZXMubGVuZ3RoID09PSAwICYmICFsb2FkaW5nXCIgY2xhc3M9XCJlbXB0eS1jaGF0XCI+XG4gICAgICAgICAgPG1hdC1pY29uPmNoYXRfYnViYmxlX291dGxpbmU8L21hdC1pY29uPlxuICAgICAgICAgIDxwPk5vIG1lc3NhZ2VzIHlldC4gU2F5IGhlbGxvITwvcD5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cblxuICAgICAgPGFwcC1tZXNzYWdlLWlucHV0XG4gICAgICAgIChtZXNzYWdlU2VudCk9XCJvblNlbmRNZXNzYWdlKCRldmVudClcIlxuICAgICAgICAobWVzc2FnZVdpdGhGaWxlcyk9XCJvblNlbmRXaXRoRmlsZXMoJGV2ZW50KVwiXG4gICAgICA+PC9hcHAtbWVzc2FnZS1pbnB1dD5cbiAgICA8L2Rpdj5cblxuICBgLFxuICBzdHlsZXM6IFtgXG4gICAgLmNoYXQtdGhyZWFkIHtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgaGVpZ2h0OiAxMDAlO1xuICAgICAgYmFja2dyb3VuZDogIzA0MTMyMjtcbiAgICAgIHBvc2l0aW9uOiByZWxhdGl2ZTtcbiAgICB9XG5cbiAgICAuY2hhdC10aHJlYWQuZHJhZy1vdmVyIHtcbiAgICAgIG91dGxpbmU6IDJweCBkYXNoZWQgcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjQ1KTtcbiAgICAgIG91dGxpbmUtb2Zmc2V0OiAtNnB4O1xuICAgIH1cblxuICAgIC50aHJlYWQtZHJhZy1vdmVybGF5IHtcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgIGluc2V0OiA4cHg7XG4gICAgICB6LWluZGV4OiAyMDtcbiAgICAgIHBvaW50ZXItZXZlbnRzOiBub25lO1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgICBnYXA6IDhweDtcbiAgICAgIGNvbG9yOiAjZmZmO1xuICAgICAgYmFja2dyb3VuZDogcmdiYSgzMSwgNzUsIDIxNiwgMC4zMik7XG4gICAgICBib3JkZXI6IDJweCBkYXNoZWQgcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjU1KTtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDE0cHg7XG4gICAgICBmb250LXNpemU6IDE0cHg7XG4gICAgICBmb250LXdlaWdodDogNjAwO1xuICAgIH1cblxuICAgIC50aHJlYWQtZHJhZy1vdmVybGF5IG1hdC1pY29uIHtcbiAgICAgIGZvbnQtc2l6ZTogMzZweDtcbiAgICAgIHdpZHRoOiAzNnB4O1xuICAgICAgaGVpZ2h0OiAzNnB4O1xuICAgIH1cblxuICAgIC5jaGF0LWhlYWRlciB7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIHBhZGRpbmc6IDhweCA4cHggOHB4IDRweDtcbiAgICAgIGJvcmRlci1ib3R0b206IDFweCBzb2xpZCByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMTUpO1xuICAgICAgZ2FwOiA0cHg7XG4gICAgICBmbGV4LXNocmluazogMDtcbiAgICB9XG5cbiAgICAuY2hhdC1oZWFkZXIgYnV0dG9uIG1hdC1pY29uIHtcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuOCk7XG4gICAgfVxuXG4gICAgLmNoYXQtbmFtZSB7XG4gICAgICBmb250LXNpemU6IDE2cHg7XG4gICAgICBmb250LXdlaWdodDogNjAwO1xuICAgICAgY29sb3I6ICNmZmY7XG4gICAgfVxuXG4gICAgLmhlYWRlci1pbmZvIHtcbiAgICAgIGZsZXg6IDE7XG4gICAgICB3aGl0ZS1zcGFjZTogbm93cmFwO1xuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICAgIHRleHQtb3ZlcmZsb3c6IGVsbGlwc2lzO1xuICAgICAgZGlzcGxheTogYmxvY2s7XG4gICAgICBwYWRkaW5nOiAwIDRweDtcbiAgICB9XG5cbiAgICAuaGVhZGVyLWFjdGlvbnMge1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGdhcDogMDtcbiAgICB9XG5cbiAgICAuaGVhZGVyLWFjdGlvbnMgYnV0dG9uIHtcbiAgICAgIHdpZHRoOiAzMnB4O1xuICAgICAgaGVpZ2h0OiAzMnB4O1xuICAgIH1cblxuICAgIC5oZHItYnRuIHtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDZweCAhaW1wb3J0YW50O1xuICAgICAgdHJhbnNpdGlvbjogYmFja2dyb3VuZCAwLjE1cywgYm94LXNoYWRvdyAwLjE1cztcbiAgICB9XG5cbiAgICAuaGRyLWJ0bjpob3ZlciB7XG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMTUpICFpbXBvcnRhbnQ7XG4gICAgICBib3gtc2hhZG93OiAwIDJweCA4cHggcmdiYSgwLCAwLCAwLCAwLjIpO1xuICAgIH1cblxuICAgIC5tZXNzYWdlcy1hcmVhIHtcbiAgICAgIGZsZXg6IDE7XG4gICAgICBvdmVyZmxvdy15OiBhdXRvO1xuICAgICAgcGFkZGluZzogMTJweDtcbiAgICAgIGJhY2tncm91bmQ6IHRyYW5zcGFyZW50O1xuICAgICAgc2Nyb2xsYmFyLXdpZHRoOiBub25lO1xuICAgICAgLW1zLW92ZXJmbG93LXN0eWxlOiBub25lO1xuICAgIH1cblxuICAgIC5tZXNzYWdlcy1hcmVhOjotd2Via2l0LXNjcm9sbGJhciB7XG4gICAgICBkaXNwbGF5OiBub25lO1xuICAgIH1cblxuICAgIC5sb2FkaW5nLWluZGljYXRvciB7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgICAgZ2FwOiA4cHg7XG4gICAgICBwYWRkaW5nOiAxMnB4O1xuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC43KTtcbiAgICAgIGZvbnQtc2l6ZTogMTNweDtcbiAgICB9XG5cbiAgICAubG9hZC1tb3JlLWJ0biB7XG4gICAgICBhbGlnbi1zZWxmOiBjZW50ZXI7XG4gICAgICBtYXJnaW4tYm90dG9tOiAxNnB4O1xuICAgICAgZm9udC1zaXplOiAxMnB4O1xuICAgICAgY29sb3I6ICNmZmY7XG4gICAgfVxuXG4gICAgLm1lc3NhZ2VzLWxpc3Qge1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAgICBnYXA6IDFweDtcbiAgICAgIGZsZXg6IDE7XG4gICAgfVxuXG4gICAgLmRhdGUtc2VwYXJhdG9yIHtcbiAgICAgIHRleHQtYWxpZ246IGNlbnRlcjtcbiAgICAgIG1hcmdpbjogMTZweCAwIDhweDtcbiAgICAgIGZvbnQtc2l6ZTogMTJweDtcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNyk7XG4gICAgICBmb250LXdlaWdodDogNTAwO1xuICAgIH1cblxuICAgIC5tZXNzYWdlLWJ1YmJsZS1yb3cge1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAgICBtYXgtd2lkdGg6IDg4JTtcbiAgICAgIG1hcmdpbi1ib3R0b206IDJweDtcbiAgICB9XG5cbiAgICAubWVzc2FnZS1idWJibGUtcm93Lm93biB7XG4gICAgICBhbGlnbi1zZWxmOiBmbGV4LWVuZDtcbiAgICAgIGFsaWduLWl0ZW1zOiBmbGV4LWVuZDtcbiAgICB9XG5cbiAgICAubWVzc2FnZS1idWJibGUtcm93Lm90aGVyIHtcbiAgICAgIGFsaWduLXNlbGY6IGZsZXgtc3RhcnQ7XG4gICAgICBhbGlnbi1pdGVtczogZmxleC1zdGFydDtcbiAgICB9XG5cbiAgICAuc2VuZGVyLW5hbWUge1xuICAgICAgZm9udC1zaXplOiAxMXB4O1xuICAgICAgZm9udC13ZWlnaHQ6IDcwMDtcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuOTUpO1xuICAgICAgbWFyZ2luLWJvdHRvbTogM3B4O1xuICAgICAgbGV0dGVyLXNwYWNpbmc6IDAuMnB4O1xuICAgICAgcGFkZGluZzogMCAxMHB4O1xuICAgICAgdGV4dC1zaGFkb3c6IDAgMXB4IDNweCByZ2JhKDAsIDAsIDAsIDAuNCk7XG4gICAgfVxuXG4gICAgLm1lc3NhZ2UtYnViYmxlIHtcbiAgICAgIHBhZGRpbmc6IDhweCAxNHB4IDdweDtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDE0cHg7XG4gICAgICBmb250LXNpemU6IDEzcHg7XG4gICAgICBsaW5lLWhlaWdodDogMS4zMjtcbiAgICAgIHdvcmQtYnJlYWs6IGJyZWFrLXdvcmQ7XG4gICAgICBjb2xvcjogI2Y1ZjdmZjtcbiAgICAgIHBvc2l0aW9uOiByZWxhdGl2ZTtcbiAgICAgIGRpc3BsYXk6IGlubGluZS1ibG9jaztcbiAgICAgIG1pbi13aWR0aDogZml0LWNvbnRlbnQ7XG4gICAgfVxuXG4gICAgLm1lc3NhZ2UtYnViYmxlLXJvdy5vdGhlciAubWVzc2FnZS1idWJibGUge1xuICAgICAgYmFja2dyb3VuZDogIzBkMjU0MDtcbiAgICAgIGJvcmRlci1ib3R0b20tbGVmdC1yYWRpdXM6IDVweDtcbiAgICAgIGJveC1zaGFkb3c6IDAgMXB4IDRweCByZ2JhKDAsIDAsIDAsIDAuNCk7XG4gICAgfVxuXG4gICAgLm1lc3NhZ2UtYnViYmxlLm93bi1idWJibGUge1xuICAgICAgYmFja2dyb3VuZDogIzBhM2Q2MjtcbiAgICAgIGJvcmRlci1ib3R0b20tcmlnaHQtcmFkaXVzOiA1cHg7XG4gICAgICBib3gtc2hhZG93OiAwIDFweCA0cHggcmdiYSgwLCAwLCAwLCAwLjQpO1xuICAgIH1cblxuICAgIC5pbWFnZS1tZXNzYWdlIHtcbiAgICAgIGxpbmUtaGVpZ2h0OiAwO1xuICAgIH1cblxuICAgIC5hdHRhY2htZW50cy1saXN0IHtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgZ2FwOiA4cHg7XG4gICAgfVxuXG4gICAgLmF0dGFjaG1lbnQtaXRlbSB7XG4gICAgICBtYXgtd2lkdGg6IDI2MHB4O1xuICAgIH1cblxuICAgIC5tZWRpYS1pbWcge1xuICAgICAgbWF4LXdpZHRoOiAyMjBweDtcbiAgICAgIG1heC1oZWlnaHQ6IDI4MHB4O1xuICAgICAgYm9yZGVyLXJhZGl1czogMTBweDtcbiAgICAgIGRpc3BsYXk6IGJsb2NrO1xuICAgICAgY3Vyc29yOiB6b29tLWluO1xuICAgICAgb2JqZWN0LWZpdDogY292ZXI7XG4gICAgICB0cmFuc2l0aW9uOiBvcGFjaXR5IDAuMTVzO1xuICAgIH1cblxuICAgIC5tZWRpYS1pbWc6aG92ZXIge1xuICAgICAgb3BhY2l0eTogMC44ODtcbiAgICB9XG5cbiAgICAubWVkaWEtdmlkZW8ge1xuICAgICAgbWF4LXdpZHRoOiAyNDBweDtcbiAgICAgIG1heC1oZWlnaHQ6IDI2MHB4O1xuICAgICAgYm9yZGVyLXJhZGl1czogMTBweDtcbiAgICAgIGRpc3BsYXk6IGJsb2NrO1xuICAgICAgYmFja2dyb3VuZDogIzAwMDtcbiAgICB9XG5cbiAgICAudmlkZW8tbWVzc2FnZSB7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICAgIGdhcDogNnB4O1xuICAgIH1cblxuICAgIC52aWRlby1kb3dubG9hZCB7XG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjc4KTtcbiAgICAgIGZvbnQtc2l6ZTogMTJweDtcbiAgICAgIHRleHQtZGVjb3JhdGlvbjogdW5kZXJsaW5lO1xuICAgICAgdGV4dC11bmRlcmxpbmUtb2Zmc2V0OiAycHg7XG4gICAgfVxuXG4gICAgLm1lZGlhLXBsYWNlaG9sZGVyIHtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgZ2FwOiA4cHg7XG4gICAgICBtaW4td2lkdGg6IDgwcHg7XG4gICAgICBtaW4taGVpZ2h0OiA0NHB4O1xuICAgICAgY29sb3I6IHJnYmEoMjU1LDI1NSwyNTUsMC42KTtcbiAgICAgIGZvbnQtc2l6ZTogMTFweDtcbiAgICB9XG5cbiAgICAubWVkaWEtbG9hZC1sYWJlbCB7XG4gICAgICBmb250LXNpemU6IDExcHg7XG4gICAgICBjb2xvcjogcmdiYSgyNTUsMjU1LDI1NSwwLjYpO1xuICAgIH1cblxuICAgIC5maWxlLW1lc3NhZ2Uge1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBnYXA6IDhweDtcbiAgICAgIHBhZGRpbmc6IDRweCAwO1xuICAgIH1cblxuICAgIC5maWxlLWRvd25sb2FkIHtcbiAgICAgIGRpc3BsYXk6IGlubGluZS1mbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGdhcDogOHB4O1xuICAgICAgY29sb3I6ICNmZmY7XG4gICAgICB0ZXh0LWRlY29yYXRpb246IG5vbmU7XG4gICAgICBtYXgtd2lkdGg6IDI0MHB4O1xuICAgICAgcGFkZGluZzogNHB4IDA7XG4gICAgfVxuXG4gICAgLmZpbGUtbXNnLWljb24ge1xuICAgICAgZm9udC1zaXplOiAyMHB4O1xuICAgICAgd2lkdGg6IDIwcHg7XG4gICAgICBoZWlnaHQ6IDIwcHg7XG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjgpO1xuICAgIH1cblxuICAgIC5maWxlLW1zZy1uYW1lIHtcbiAgICAgIGZvbnQtc2l6ZTogMTNweDtcbiAgICAgIGNvbG9yOiAjZmZmO1xuICAgICAgd29yZC1icmVhazogYnJlYWstYWxsO1xuICAgIH1cblxuICAgIC5maWxlLWRvd25sb2FkLWljb24ge1xuICAgICAgZm9udC1zaXplOiAxOHB4O1xuICAgICAgd2lkdGg6IDE4cHg7XG4gICAgICBoZWlnaHQ6IDE4cHg7XG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjcpO1xuICAgICAgZmxleC1zaHJpbms6IDA7XG4gICAgfVxuXG4gICAgLm1lc3NhZ2UtbWV0YSB7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGdhcDogNHB4O1xuICAgICAgbWFyZ2luLXRvcDogM3B4O1xuICAgIH1cblxuICAgIC5tc2ctdGltZSB7XG4gICAgICBmb250LXNpemU6IDEwcHg7XG4gICAgICBjb2xvcjogcmdiYSgyMTgsIDIyNCwgMjUwLCAwLjY2KTtcbiAgICB9XG5cbiAgICAubWVzc2FnZS1idWJibGUtcm93Lm90aGVyIC5tc2ctdGltZSB7XG4gICAgICBjb2xvcjogcmdiYSgyMTYsIDIyMywgMjQ2LCAwLjU4KTtcbiAgICB9XG5cbiAgICAucmVhZC1pY29uIHtcbiAgICAgIGZvbnQtc2l6ZTogMTRweDtcbiAgICAgIHdpZHRoOiAxNHB4O1xuICAgICAgaGVpZ2h0OiAxNHB4O1xuICAgICAgb3BhY2l0eTogMC43O1xuICAgIH1cblxuICAgIC5yZWFkLWljb24udW5yZWFkIHtcbiAgICAgIG9wYWNpdHk6IDAuNDtcbiAgICB9XG5cbiAgICAucXVpY2stcmVhY3Rpb25zIHtcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgIHRvcDogLTE4cHg7XG4gICAgICByaWdodDogMDtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgZ2FwOiA0cHg7XG4gICAgICBwYWRkaW5nOiAzcHggNXB4O1xuICAgICAgYmFja2dyb3VuZDogIzA3MWQzMDtcbiAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xNCk7XG4gICAgICBib3JkZXItcmFkaXVzOiA5OTlweDtcbiAgICAgIGJveC1zaGFkb3c6IDAgNnB4IDE0cHggcmdiYSgwLCAwLCAwLCAwLjI4KTtcbiAgICAgIHotaW5kZXg6IDQ7XG4gICAgfVxuXG4gICAgLyogUmVjZWl2ZWQgbWVzc2FnZXMgc2l0IG9uIHRoZSBsZWZ0LCBzbyBncm93IHRoZSBwaWNrZXIgcmlnaHR3YXJkLlxuICAgICAgIE93biBtZXNzYWdlcyBzaXQgb24gdGhlIHJpZ2h0LCBzbyBncm93IHRoZSBwaWNrZXIgbGVmdHdhcmQuICovXG4gICAgLm1lc3NhZ2UtYnViYmxlLXJvdy5vdGhlciAucXVpY2stcmVhY3Rpb25zIHtcbiAgICAgIGxlZnQ6IDA7XG4gICAgICByaWdodDogYXV0bztcbiAgICB9XG5cbiAgICAubWVzc2FnZS1idWJibGUtcm93Lm93biAucXVpY2stcmVhY3Rpb25zIHtcbiAgICAgIGxlZnQ6IGF1dG87XG4gICAgICByaWdodDogMDtcbiAgICB9XG5cbiAgICAucXVpY2stZW1vamktYnRuIHtcbiAgICAgIHdpZHRoOiAyMHB4O1xuICAgICAgaGVpZ2h0OiAyMHB4O1xuICAgICAgYm9yZGVyOiBub25lO1xuICAgICAgYm9yZGVyLXJhZGl1czogOTk5cHg7XG4gICAgICBiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudDtcbiAgICAgIGNvbG9yOiAjZmZmO1xuICAgICAgZGlzcGxheTogaW5saW5lLWZsZXg7XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgICBmb250LXNpemU6IDEzcHg7XG4gICAgICBsaW5lLWhlaWdodDogMTtcbiAgICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgICAgIHBhZGRpbmc6IDA7XG4gICAgICB0cmFuc2l0aW9uOiB0cmFuc2Zvcm0gMC4xMnMgZWFzZSwgYmFja2dyb3VuZCAwLjEycyBlYXNlO1xuICAgIH1cblxuICAgIC5xdWljay1lbW9qaS1idG46aG92ZXIge1xuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjE4KTtcbiAgICAgIHRyYW5zZm9ybTogc2NhbGUoMS4xNCk7XG4gICAgfVxuXG4gICAgLnJlYWN0aW9ucy1yb3cge1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGZsZXgtd3JhcDogd3JhcDtcbiAgICAgIGdhcDogM3B4O1xuICAgICAgbWFyZ2luLXRvcDogNXB4O1xuICAgIH1cblxuICAgIC5yZWFjdGlvbi1jaGlwIHtcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LDI1NSwyNTUsMC4wOCk7XG4gICAgICBib3JkZXI6IDFweCBzb2xpZCByZ2JhKDI1NSwyNTUsMjU1LDAuMik7XG4gICAgICBib3JkZXItcmFkaXVzOiA5OTlweDtcbiAgICAgIHBhZGRpbmc6IDFweCA3cHg7XG4gICAgICBmb250LXNpemU6IDExcHg7XG4gICAgICBjb2xvcjogI2YyZjZmZjtcbiAgICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgICAgIHRyYW5zaXRpb246IGFsbCAwLjJzO1xuICAgIH1cblxuICAgIC5yZWFjdGlvbi1jaGlwOmhvdmVyIHtcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LDI1NSwyNTUsMC4yNSk7XG4gICAgICB0cmFuc2Zvcm06IHNjYWxlKDEuMDUpO1xuICAgIH1cblxuICAgIC5yZWFjdGlvbi1jaGlwLm93bi1yZWFjdGlvbiB7XG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDQyLDkxLDI1NSwwLjMpO1xuICAgICAgYm9yZGVyLWNvbG9yOiByZ2JhKDQyLDkxLDI1NSwwLjUpO1xuICAgIH1cblxuICAgIC5lbXB0eS1jaGF0IHtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgICAgZmxleDogMTtcbiAgICAgIGNvbG9yOiAjOWNhM2FmO1xuICAgIH1cblxuICAgIC5lbXB0eS1jaGF0IG1hdC1pY29uIHtcbiAgICAgIGZvbnQtc2l6ZTogNDhweDtcbiAgICAgIHdpZHRoOiA0OHB4O1xuICAgICAgaGVpZ2h0OiA0OHB4O1xuICAgICAgbWFyZ2luLWJvdHRvbTogOHB4O1xuICAgIH1cblxuICAgIC5lbXB0eS1jaGF0IHAge1xuICAgICAgZm9udC1zaXplOiAxNHB4O1xuICAgICAgbWFyZ2luOiAwO1xuICAgIH1cbiAgYF0sXG59KVxuZXhwb3J0IGNsYXNzIENoYXRUaHJlYWRDb21wb25lbnQgaW1wbGVtZW50cyBPbkluaXQsIE9uRGVzdHJveSwgQWZ0ZXJWaWV3Q2hlY2tlZCB7XG4gIEBWaWV3Q2hpbGQoJ3Njcm9sbENvbnRhaW5lcicpIHNjcm9sbENvbnRhaW5lciE6IEVsZW1lbnRSZWY7XG4gIEBWaWV3Q2hpbGQoTWVzc2FnZUlucHV0Q29tcG9uZW50KSBtZXNzYWdlSW5wdXQ/OiBNZXNzYWdlSW5wdXRDb21wb25lbnQ7XG4gIEBPdXRwdXQoKSBsaWdodGJveE9wZW4gPSBuZXcgRXZlbnRFbWl0dGVyPHN0cmluZz4oKTtcblxuICBtZXNzYWdlczogTWVzc2FnZVtdID0gW107XG4gIHZpc2libGVDb250YWN0czogQ29udGFjdFtdID0gW107XG4gIGNvbnZlcnNhdGlvbk5hbWUgPSAnJztcbiAgaXNHcm91cCA9IGZhbHNlO1xuICBsb2FkaW5nID0gZmFsc2U7XG4gIG15Q29udGFjdElkOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcblxuICBwcml2YXRlIGNvbnZlcnNhdGlvbklkOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBzdWIhOiBTdWJzY3JpcHRpb247XG4gIHByaXZhdGUgc2hvdWxkU2Nyb2xsVG9Cb3R0b20gPSB0cnVlO1xuXG4gIHVwbG9hZGluZyA9IGZhbHNlO1xuICBob3ZlcmVkTWVzc2FnZUlkOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcbiAgcXVpY2tFbW9qaXMgPSBbJ+KdpO+4jycsICfwn5GNJywgJ/CfmIInLCAn8J+YricsICfwn5iiJywgJ/CflKUnXTtcbiAgdGhyZWFkRHJhZ092ZXIgPSBmYWxzZTtcbiAgcHJpdmF0ZSB0aHJlYWREcmFnRGVwdGggPSAwO1xuICBwcml2YXRlIGJvdW5kUmVzZXRUaHJlYWREcmFnID0gdGhpcy5yZXNldFRocmVhZERyYWcuYmluZCh0aGlzKTtcblxuICAvKiogVHJhY2tzIHdoaWNoIGZpbGUgSURzIGFyZSBjdXJyZW50bHkgYmVpbmcgZmV0Y2hlZCB0byBhdm9pZCBkdXBsaWNhdGUgcmVxdWVzdHMgKi9cbiAgcHJpdmF0ZSBtZWRpYUxvYWRpbmcgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgLyoqIFRyYWNrcyBmaWxlIElEcyB3aGVyZSByZXRyaWV2YWwgZmFpbGVkIHNvIFVJIGRvZXNuJ3Qgc3BpbiBmb3JldmVyLiAqL1xuICBwcml2YXRlIG1lZGlhRmFpbGVkID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSBzdG9yZTogTWVzc2FnaW5nU3RvcmVTZXJ2aWNlLFxuICAgIHByaXZhdGUgYXV0aDogQXV0aFNlcnZpY2UsXG4gICAgcHJpdmF0ZSBmaWxlU2VydmljZTogTWVzc2FnaW5nRmlsZVNlcnZpY2UsXG4gICAgcHJpdmF0ZSBjZHI6IENoYW5nZURldGVjdG9yUmVmLFxuICApIHt9XG5cbiAgbmdPbkluaXQoKTogdm9pZCB7XG4gICAgdGhpcy5teUNvbnRhY3RJZCA9IHRoaXMuYXV0aC5jb250YWN0SWQ7XG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignZHJvcCcsIHRoaXMuYm91bmRSZXNldFRocmVhZERyYWcsIHRydWUpO1xuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2RyYWdlbmQnLCB0aGlzLmJvdW5kUmVzZXRUaHJlYWREcmFnLCB0cnVlKTtcblxuICAgIHRoaXMuc3ViID0gY29tYmluZUxhdGVzdChbXG4gICAgICB0aGlzLnN0b3JlLmFjdGl2ZUNvbnZlcnNhdGlvbklkLFxuICAgICAgdGhpcy5zdG9yZS5tZXNzYWdlc01hcCxcbiAgICAgIHRoaXMuc3RvcmUub3BlbkNoYXRzLFxuICAgICAgdGhpcy5zdG9yZS52aXNpYmxlQ29udGFjdHMsXG4gICAgICB0aGlzLnN0b3JlLmxvYWRpbmdNZXNzYWdlcyxcbiAgICBdKS5zdWJzY3JpYmUoKFtjb252SWQsIG1zZ01hcCwgY2hhdHMsIGNvbnRhY3RzLCBsb2FkaW5nXSkgPT4ge1xuICAgICAgdGhpcy5sb2FkaW5nID0gbG9hZGluZztcbiAgICAgIHRoaXMudmlzaWJsZUNvbnRhY3RzID0gY29udGFjdHMgfHwgW107XG5cbiAgICAgIGlmIChjb252SWQgJiYgY29udklkICE9PSB0aGlzLmNvbnZlcnNhdGlvbklkKSB7XG4gICAgICAgIHRoaXMuY29udmVyc2F0aW9uSWQgPSBjb252SWQ7XG4gICAgICAgIHRoaXMuc2hvdWxkU2Nyb2xsVG9Cb3R0b20gPSB0cnVlO1xuICAgICAgICBjb25zdCBjaGF0ID0gY2hhdHMuZmluZCgoYykgPT4gYy5jb252ZXJzYXRpb25JZCA9PT0gY29udklkKTtcbiAgICAgICAgdGhpcy5jb252ZXJzYXRpb25OYW1lID0gY2hhdD8ubmFtZSB8fCAnQ2hhdCc7XG4gICAgICAgIHRoaXMuaXNHcm91cCA9IGNoYXQ/LmlzR3JvdXAgfHwgZmFsc2U7XG4gICAgICB9XG5cbiAgICAgIGlmICh0aGlzLmNvbnZlcnNhdGlvbklkKSB7XG4gICAgICAgIGNvbnN0IHByZXZMZW4gPSB0aGlzLm1lc3NhZ2VzLmxlbmd0aDtcbiAgICAgICAgdGhpcy5tZXNzYWdlcyA9IG1zZ01hcC5nZXQodGhpcy5jb252ZXJzYXRpb25JZCkgfHwgW107XG4gICAgICAgIGlmICh0aGlzLm1lc3NhZ2VzLmxlbmd0aCA+IHByZXZMZW4pIHtcbiAgICAgICAgICB0aGlzLnNob3VsZFNjcm9sbFRvQm90dG9tID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICAvLyBQcmUtd2FybSBtZWRpYSBjYWNoZSBmb3IgYW55IGltYWdlL2ZpbGUgbWVzc2FnZXMgdmlzaWJsZVxuICAgICAgICB0aGlzLnByZXdhcm1NZWRpYSh0aGlzLm1lc3NhZ2VzKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIG5nQWZ0ZXJWaWV3Q2hlY2tlZCgpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5zaG91bGRTY3JvbGxUb0JvdHRvbSkge1xuICAgICAgdGhpcy5zY3JvbGxUb0JvdHRvbSgpO1xuICAgICAgdGhpcy5zaG91bGRTY3JvbGxUb0JvdHRvbSA9IGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIG5nT25EZXN0cm95KCk6IHZvaWQge1xuICAgIHRoaXMuc3ViPy51bnN1YnNjcmliZSgpO1xuICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2Ryb3AnLCB0aGlzLmJvdW5kUmVzZXRUaHJlYWREcmFnLCB0cnVlKTtcbiAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdkcmFnZW5kJywgdGhpcy5ib3VuZFJlc2V0VGhyZWFkRHJhZywgdHJ1ZSk7XG4gIH1cblxuICBnb0JhY2soKTogdm9pZCB7XG4gICAgdGhpcy5zdG9yZS5zZXRWaWV3KCdpbmJveCcpO1xuICB9XG5cbiAgb25DbGVhckNvbnZlcnNhdGlvbigpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5jb252ZXJzYXRpb25JZCkge1xuICAgICAgdGhpcy5zdG9yZS5jbGVhckNvbnZlcnNhdGlvbih0aGlzLmNvbnZlcnNhdGlvbklkKTtcbiAgICB9XG4gIH1cblxuICBvbkRlbGV0ZUNvbnZlcnNhdGlvbigpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5jb252ZXJzYXRpb25JZCkge1xuICAgICAgdGhpcy5zdG9yZS5kZWxldGVDb252ZXJzYXRpb24odGhpcy5jb252ZXJzYXRpb25JZCk7XG4gICAgfVxuICB9XG5cbiAgb25Hcm91cFNldHRpbmdzKCk6IHZvaWQge1xuICAgIGlmICh0aGlzLmNvbnZlcnNhdGlvbklkKSB7XG4gICAgICB0aGlzLnN0b3JlLm9wZW5Hcm91cFNldHRpbmdzKHRoaXMuY29udmVyc2F0aW9uSWQsIHRoaXMuY29udmVyc2F0aW9uTmFtZSk7XG4gICAgfVxuICB9XG5cbiAgb25TZW5kTWVzc2FnZShjb250ZW50OiBzdHJpbmcpOiB2b2lkIHtcbiAgICB0aGlzLnN0b3JlLnNlbmRNZXNzYWdlKHRoaXMuY29udmVyc2F0aW9uSWQsIGNvbnRlbnQpO1xuICAgIHRoaXMuc2hvdWxkU2Nyb2xsVG9Cb3R0b20gPSB0cnVlO1xuICB9XG5cbiAgb25TZW5kV2l0aEZpbGVzKHBheWxvYWQ6IE1lc3NhZ2VQYXlsb2FkKTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLmNvbnZlcnNhdGlvbklkIHx8ICF0aGlzLmF1dGguY29udGFjdElkKSByZXR1cm47XG4gICAgdGhpcy51cGxvYWRpbmcgPSB0cnVlO1xuXG4gICAgLy8gU3RlcCAxOiBVcGxvYWQgYWxsIGZpbGVzIGFuZCBvYnRhaW4gcmVhbCBmaWxlX2lkcyBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgLy8gVGVtcCBJRHMgYXJlIE5FVkVSIHNlbnQgdG8gYW55IEFQSSDigJQgd2Ugd2FpdCBmb3IgcmVhbCBJRHMgaGVyZS5cbiAgICB0aGlzLmZpbGVTZXJ2aWNlLnVwbG9hZEZpbGVzKHBheWxvYWQuZmlsZXMpLnN1YnNjcmliZSh7XG4gICAgICBuZXh0OiAocmVzcG9uc2VzKSA9PiB7XG4gICAgICAgIGNvbnN0IGZpbGVJZHMgICA9IHJlc3BvbnNlcy5tYXAoKHIpID0+IHIuZmlsZV9pZCk7XG4gICAgICAgIGNvbnN0IGZpbGVuYW1lcyA9IHJlc3BvbnNlcy5tYXAoKHIpID0+IHIuZmlsZW5hbWUpO1xuICAgICAgICBjb25zdCBtaW1lVHlwZXMgPSByZXNwb25zZXMubWFwKChyLCBpZHgpID0+IHIubWltZV90eXBlIHx8IHBheWxvYWQuZmlsZXNbaWR4XT8udHlwZSB8fCAnJyk7XG5cbiAgICAgICAgLy8gR3VhcmQ6IGVuc3VyZSBhbGwgSURzIGFyZSByZWFsIChub3QgdGVtcClcbiAgICAgICAgY29uc3QgaGFzVGVtcCA9IGZpbGVJZHMuc29tZShpZCA9PiBpZD8uc3RhcnRzV2l0aCgndGVtcC0nKSk7XG4gICAgICAgIGlmIChoYXNUZW1wKSB7XG4gICAgICAgICAgdGhpcy51cGxvYWRpbmcgPSBmYWxzZTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBTdGVwIDI6IEtlZXAgdXBsb2FkIFVSTHMgb24gYm90aCB0aGUgY2FjaGUgYW5kIG9wdGltaXN0aWMgYXR0YWNobWVudC5cbiAgICAgICAgLy8gUkVTVCByZWZyZXNoZXMgY2FuIHJldHVybiBhIGRpZmZlcmVudCBhdHRhY2htZW50IGlkLCBzbyBmaWxlbmFtZS1iYXNlZFxuICAgICAgICAvLyBtZXJnZXMgbmVlZCB0aGUgVVJMIG9uIHRoZSBhdHRhY2htZW50IG9iamVjdCB0b28uXG4gICAgICAgIGNvbnN0IHByZXZpZXdVcmxzID0gcmVzcG9uc2VzLm1hcCgociwgaWR4KSA9PlxuICAgICAgICAgIHIudXJsIHx8IFVSTC5jcmVhdGVPYmplY3RVUkwocGF5bG9hZC5maWxlc1tpZHhdKVxuICAgICAgICApO1xuICAgICAgICByZXNwb25zZXMuZm9yRWFjaCgociwgaWR4KSA9PiB7XG4gICAgICAgICAgdGhpcy5maWxlU2VydmljZS5yZW1lbWJlckZpbGVVcmwoci5maWxlX2lkLCBwcmV2aWV3VXJsc1tpZHhdKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gU3RlcCAzOiBQcmUtd2FybSBpbWFnZSBjYWNoZSBzbyB0aGUgb3B0aW1pc3RpYyBidWJibGUgcmVuZGVycyBpbW1lZGlhdGVseS5cbiAgICAgICAgdGhpcy5maWxlU2VydmljZS5wcmV3YXJtQ2FjaGUoZmlsZUlkcyk7XG5cbiAgICAgICAgLy8gU3RlcCA0OiBTZW5kIHRoZSBtZXNzYWdlIHdpdGggdGhlIHJlYWwgZmlsZV9pZHMuXG4gICAgICAgIHRoaXMuZmlsZVNlcnZpY2VcbiAgICAgICAgICAuc2VuZE1lc3NhZ2VXaXRoQXR0YWNobWVudHMoXG4gICAgICAgICAgICB0aGlzLmNvbnZlcnNhdGlvbklkISxcbiAgICAgICAgICAgIHRoaXMuYXV0aC5jb250YWN0SWQhLFxuICAgICAgICAgICAgcGF5bG9hZC50ZXh0IHx8IGZpbGVuYW1lcy5qb2luKCcsICcpLFxuICAgICAgICAgICAgZmlsZUlkcyxcbiAgICAgICAgICAgIGZpbGVuYW1lcyxcbiAgICAgICAgICAgIG1pbWVUeXBlc1xuICAgICAgICAgIClcbiAgICAgICAgICAuc3Vic2NyaWJlKHtcbiAgICAgICAgICAgIG5leHQ6IChyZXM6IGFueSkgPT4ge1xuICAgICAgICAgICAgICB0aGlzLnVwbG9hZGluZyA9IGZhbHNlO1xuICAgICAgICAgICAgICB0aGlzLnNob3VsZFNjcm9sbFRvQm90dG9tID0gdHJ1ZTtcblxuICAgICAgICAgICAgICAvLyBBZGQgb3B0aW1pc3RpYyBtZXNzYWdlIHNvIHRoZSBpbWFnZSBhcHBlYXJzIGluc3RhbnRseSDigJRcbiAgICAgICAgICAgICAgLy8gdGhlIFdlYlNvY2tldCBldmVudCBtYXkgYXJyaXZlIGEgbW9tZW50IGxhdGVyIGFuZCBkZWR1cCBpdC5cbiAgICAgICAgICAgICAgY29uc3QgZmlyc3RJZCA9IGZpbGVJZHNbMF0gfHwgJyc7XG4gICAgICAgICAgICAgIGNvbnN0IGlzSW1nID1cbiAgICAgICAgICAgICAgICAobWltZVR5cGVzWzBdIHx8ICcnKS5zdGFydHNXaXRoKCdpbWFnZS8nKSB8fFxuICAgICAgICAgICAgICAgIC9cXC4ocG5nfGpwZT9nfGdpZnx3ZWJwfGJtcHxzdmd8aGVpY3xoZWlmKSQvaS50ZXN0KGZpbGVuYW1lc1swXSB8fCAnJyk7XG4gICAgICAgICAgICAgIGNvbnN0IG9wdGltaXN0aWM6IGFueSA9IHtcbiAgICAgICAgICAgICAgICBtZXNzYWdlX2lkOiByZXM/Lm1lc3NhZ2VfaWQgPyBTdHJpbmcocmVzLm1lc3NhZ2VfaWQpIDogJ3RlbXAtJyArIERhdGUubm93KCksXG4gICAgICAgICAgICAgICAgY29udmVyc2F0aW9uX2lkOiB0aGlzLmNvbnZlcnNhdGlvbklkISxcbiAgICAgICAgICAgICAgICBzZW5kZXJfaWQ6IHRoaXMuYXV0aC5jb250YWN0SWQhLFxuICAgICAgICAgICAgICAgIHNlbmRlcl9uYW1lOiAnWW91JyxcbiAgICAgICAgICAgICAgICBtZXNzYWdlX3R5cGU6IGlzSW1nID8gJ0lNQUdFJyA6ICdGSUxFJyxcbiAgICAgICAgICAgICAgICBjb250ZW50OiBwYXlsb2FkLnRleHQgfHwgZmlsZW5hbWVzLmpvaW4oJywgJyksXG4gICAgICAgICAgICAgICAgbWVkaWFfdXJsOiBmaXJzdElkLFxuICAgICAgICAgICAgICAgIGNyZWF0ZWRfYXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgICAgICAgICBpc19yZWFkOiB0cnVlLFxuICAgICAgICAgICAgICAgIGF0dGFjaG1lbnRzOiBmaWxlSWRzLm1hcCgoaWQsIGlkeCkgPT4gKHtcbiAgICAgICAgICAgICAgICAgIGZpbGVfaWQ6IGlkLFxuICAgICAgICAgICAgICAgICAgZmlsZW5hbWU6IGZpbGVuYW1lc1tpZHhdIHx8IGZpbGVuYW1lc1swXSB8fCBgQXR0YWNobWVudCAke2lkeCArIDF9YCxcbiAgICAgICAgICAgICAgICAgIG1pbWVfdHlwZTogbWltZVR5cGVzW2lkeF0gfHwgdW5kZWZpbmVkLFxuICAgICAgICAgICAgICAgICAgc2l6ZV9ieXRlczogcGF5bG9hZC5maWxlc1tpZHhdPy5zaXplLFxuICAgICAgICAgICAgICAgICAgdXJsOiBwcmV2aWV3VXJsc1tpZHhdLFxuICAgICAgICAgICAgICAgIH0pKSxcbiAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgdGhpcy5zdG9yZS5hcHBlbmRPcHRpbWlzdGljTWVzc2FnZShvcHRpbWlzdGljKTtcbiAgICAgICAgICAgICAgdGhpcy5jZHIubWFya0ZvckNoZWNrKCk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZXJyb3I6ICgpID0+IHtcbiAgICAgICAgICAgICAgdGhpcy51cGxvYWRpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSk7XG4gICAgICB9LFxuICAgICAgZXJyb3I6ICgpID0+IHtcbiAgICAgICAgdGhpcy51cGxvYWRpbmcgPSBmYWxzZTtcbiAgICAgIH0sXG4gICAgfSk7XG4gIH1cblxuICBsb2FkT2xkZXIoKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuY29udmVyc2F0aW9uSWQgJiYgdGhpcy5tZXNzYWdlcy5sZW5ndGggPiAwKSB7XG4gICAgICB0aGlzLnN0b3JlLmxvYWRNZXNzYWdlcyh0aGlzLmNvbnZlcnNhdGlvbklkLCB0aGlzLm1lc3NhZ2VzWzBdLm1lc3NhZ2VfaWQpO1xuICAgIH1cbiAgfVxuXG4gIG9uU2Nyb2xsKCk6IHZvaWQge31cblxuICBvblRocmVhZERyYWdFbnRlcihldmVudDogRHJhZ0V2ZW50KTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLmRyYWdIYXNGaWxlcyhldmVudCkpIHJldHVybjtcbiAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuICAgIHRoaXMudGhyZWFkRHJhZ0RlcHRoKys7XG4gICAgdGhpcy50aHJlYWREcmFnT3ZlciA9IHRydWU7XG4gIH1cblxuICBvblRocmVhZERyYWdPdmVyKGV2ZW50OiBEcmFnRXZlbnQpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMuZHJhZ0hhc0ZpbGVzKGV2ZW50KSkgcmV0dXJuO1xuICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgaWYgKGV2ZW50LmRhdGFUcmFuc2Zlcikge1xuICAgICAgZXZlbnQuZGF0YVRyYW5zZmVyLmRyb3BFZmZlY3QgPSAnY29weSc7XG4gICAgfVxuICAgIHRoaXMudGhyZWFkRHJhZ092ZXIgPSB0cnVlO1xuICB9XG5cbiAgb25UaHJlYWREcmFnTGVhdmUoZXZlbnQ6IERyYWdFdmVudCk6IHZvaWQge1xuICAgIGlmICghdGhpcy5kcmFnSGFzRmlsZXMoZXZlbnQpKSByZXR1cm47XG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICB0aGlzLnRocmVhZERyYWdEZXB0aCA9IE1hdGgubWF4KDAsIHRoaXMudGhyZWFkRHJhZ0RlcHRoIC0gMSk7XG4gICAgdGhpcy50aHJlYWREcmFnT3ZlciA9IHRoaXMudGhyZWFkRHJhZ0RlcHRoID4gMDtcbiAgfVxuXG4gIG9uVGhyZWFkRHJvcChldmVudDogRHJhZ0V2ZW50KTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLmRyYWdIYXNGaWxlcyhldmVudCkpIHJldHVybjtcbiAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuICAgIHRoaXMucmVzZXRUaHJlYWREcmFnKCk7XG4gICAgY29uc3QgZmlsZXMgPSBldmVudC5kYXRhVHJhbnNmZXI/LmZpbGVzID8gQXJyYXkuZnJvbShldmVudC5kYXRhVHJhbnNmZXIuZmlsZXMpIDogW107XG4gICAgdGhpcy5tZXNzYWdlSW5wdXQ/LmFkZEZpbGVzKGZpbGVzKTtcbiAgfVxuXG4gIHByaXZhdGUgcmVzZXRUaHJlYWREcmFnKCk6IHZvaWQge1xuICAgIHRoaXMudGhyZWFkRHJhZ0RlcHRoID0gMDtcbiAgICB0aGlzLnRocmVhZERyYWdPdmVyID0gZmFsc2U7XG4gIH1cblxuICBwcml2YXRlIGRyYWdIYXNGaWxlcyhldmVudDogRHJhZ0V2ZW50KTogYm9vbGVhbiB7XG4gICAgY29uc3QgdHlwZXMgPSBldmVudC5kYXRhVHJhbnNmZXI/LnR5cGVzO1xuICAgIGlmICghdHlwZXMpIHJldHVybiBmYWxzZTtcbiAgICByZXR1cm4gQXJyYXkuZnJvbSh0eXBlcykuaW5jbHVkZXMoJ0ZpbGVzJyk7XG4gIH1cblxuICBzaG91bGRTaG93RGF0ZVNlcGFyYXRvcihpbmRleDogbnVtYmVyKTogYm9vbGVhbiB7XG4gICAgaWYgKGluZGV4ID09PSAwKSByZXR1cm4gdHJ1ZTtcbiAgICBjb25zdCBjdXJyID0gbmV3IERhdGUodGhpcy5tZXNzYWdlc1tpbmRleF0uY3JlYXRlZF9hdCkudG9EYXRlU3RyaW5nKCk7XG4gICAgY29uc3QgcHJldiA9IG5ldyBEYXRlKHRoaXMubWVzc2FnZXNbaW5kZXggLSAxXS5jcmVhdGVkX2F0KS50b0RhdGVTdHJpbmcoKTtcbiAgICByZXR1cm4gY3VyciAhPT0gcHJldjtcbiAgfVxuXG4gIHNob3VsZFNob3dTZW5kZXIoaW5kZXg6IG51bWJlcik6IGJvb2xlYW4ge1xuICAgIGlmIChpbmRleCA9PT0gMCkgcmV0dXJuIHRydWU7XG4gICAgcmV0dXJuIHRoaXMubWVzc2FnZXNbaW5kZXhdLnNlbmRlcl9pZCAhPT0gdGhpcy5tZXNzYWdlc1tpbmRleCAtIDFdLnNlbmRlcl9pZDtcbiAgfVxuXG4gIGlzT3duTWVzc2FnZShtc2c6IE1lc3NhZ2UpOiBib29sZWFuIHtcbiAgICByZXR1cm4gU3RyaW5nKG1zZy5zZW5kZXJfaWQpID09PSBTdHJpbmcodGhpcy5teUNvbnRhY3RJZCk7XG4gIH1cblxuICBnZXRTZW5kZXJOYW1lKG1zZzogTWVzc2FnZSk6IHN0cmluZyB7XG4gICAgY29uc3QgZnJvbU1lc3NhZ2UgPSBnZXRNZXNzYWdlU2VuZGVyTmFtZShtc2cpO1xuICAgIGlmIChmcm9tTWVzc2FnZSAmJiBmcm9tTWVzc2FnZSAhPT0gJ1Vua25vd24nKSB7XG4gICAgICByZXR1cm4gZnJvbU1lc3NhZ2U7XG4gICAgfVxuXG4gICAgY29uc3QgZnJvbUNvbnRhY3RzID0gdGhpcy52aXNpYmxlQ29udGFjdHMuZmluZChcbiAgICAgIChjKSA9PiBTdHJpbmcoYy5jb250YWN0X2lkKSA9PT0gU3RyaW5nKG1zZy5zZW5kZXJfaWQpXG4gICAgKTtcbiAgICBpZiAoZnJvbUNvbnRhY3RzKSB7XG4gICAgICByZXR1cm4gZ2V0Q29udGFjdERpc3BsYXlOYW1lKGZyb21Db250YWN0cyk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuaXNPd25NZXNzYWdlKG1zZykpIHtcbiAgICAgIHJldHVybiAnWW91JztcbiAgICB9XG5cbiAgICByZXR1cm4gYFVzZXIgJHttc2cuc2VuZGVyX2lkfWA7XG4gIH1cblxuICBmb3JtYXRUaW1lKGRhdGVTdHI6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgaWYgKCFkYXRlU3RyKSByZXR1cm4gJyc7XG4gICAgY29uc3QgZCA9IG5ldyBEYXRlKGRhdGVTdHIpO1xuICAgIHJldHVybiBkLnRvTG9jYWxlVGltZVN0cmluZygnZW4tR0InLCB7IGhvdXI6ICcyLWRpZ2l0JywgbWludXRlOiAnMi1kaWdpdCcgfSk7XG4gIH1cblxuICBmb3JtYXREYXRlKGRhdGVTdHI6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgY29uc3QgZCA9IG5ldyBEYXRlKGRhdGVTdHIpO1xuICAgIGNvbnN0IHRvZGF5ID0gbmV3IERhdGUoKTtcbiAgICBjb25zdCB5ZXN0ZXJkYXkgPSBuZXcgRGF0ZSh0b2RheSk7XG4gICAgeWVzdGVyZGF5LnNldERhdGUoeWVzdGVyZGF5LmdldERhdGUoKSAtIDEpO1xuXG4gICAgaWYgKGQudG9EYXRlU3RyaW5nKCkgPT09IHRvZGF5LnRvRGF0ZVN0cmluZygpKSByZXR1cm4gJ1RvZGF5JztcbiAgICBpZiAoZC50b0RhdGVTdHJpbmcoKSA9PT0geWVzdGVyZGF5LnRvRGF0ZVN0cmluZygpKSByZXR1cm4gJ1llc3RlcmRheSc7XG4gICAgcmV0dXJuIGQudG9Mb2NhbGVEYXRlU3RyaW5nKCdlbi1HQicsIHsgZGF5OiAnbnVtZXJpYycsIG1vbnRoOiAnc2hvcnQnLCB5ZWFyOiAnbnVtZXJpYycgfSk7XG4gIH1cblxuICBwcml2YXRlIHNjcm9sbFRvQm90dG9tKCk6IHZvaWQge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBlbCA9IHRoaXMuc2Nyb2xsQ29udGFpbmVyPy5uYXRpdmVFbGVtZW50O1xuICAgICAgaWYgKGVsKSB7XG4gICAgICAgIGVsLnNjcm9sbFRvcCA9IGVsLnNjcm9sbEhlaWdodDtcbiAgICAgIH1cbiAgICB9IGNhdGNoIHsgLyogaWdub3JlICovIH1cbiAgfVxuXG4gIC8vIOKUgOKUgCBNZWRpYSBoZWxwZXJzIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuXG4gIHByaXZhdGUgZ2V0RmlsZW5hbWVMaWtlKG1zZzogTWVzc2FnZSk6IHN0cmluZyB7XG4gICAgY29uc3QgYW55TXNnID0gbXNnIGFzIGFueTtcbiAgICByZXR1cm4gU3RyaW5nKFxuICAgICAgdGhpcy5nZXRQcmltYXJ5QXR0YWNobWVudChtc2cpPy5maWxlbmFtZSB8fFxuICAgICAgYW55TXNnPy5maWxlbmFtZSB8fFxuICAgICAgYW55TXNnPy5maWxlX25hbWUgfHxcbiAgICAgIG1zZy5jb250ZW50IHx8XG4gICAgICAnJ1xuICAgICkudG9Mb3dlckNhc2UoKTtcbiAgfVxuXG4gIC8qKiBSZXR1cm5zIHRoZSBwcmltYXJ5IGF0dGFjaG1lbnQgZm9yIGEgbWVzc2FnZSwgaWYgYW55LiAqL1xuICBwcml2YXRlIGdldFByaW1hcnlBdHRhY2htZW50KG1zZzogTWVzc2FnZSk6IEF0dGFjaG1lbnQgfCBudWxsIHtcbiAgICBjb25zdCBhdHRhY2htZW50cyA9IHRoaXMuZ2V0UmVuZGVyYWJsZUF0dGFjaG1lbnRzKG1zZyk7XG4gICAgaWYgKGF0dGFjaG1lbnRzLmxlbmd0aCA+IDApIHJldHVybiBhdHRhY2htZW50c1swXTtcblxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgZ2V0UmVuZGVyYWJsZUF0dGFjaG1lbnRzKG1zZzogTWVzc2FnZSk6IEF0dGFjaG1lbnRbXSB7XG4gICAgaWYgKG1zZy5hdHRhY2htZW50cyAmJiBtc2cuYXR0YWNobWVudHMubGVuZ3RoID4gMCkge1xuICAgICAgcmV0dXJuIG1zZy5hdHRhY2htZW50cy5tYXAoKGEsIGlkeCkgPT4gKHtcbiAgICAgICAgZmlsZV9pZDogU3RyaW5nKGEuZmlsZV9pZCA/PyAnJykudHJpbSgpLFxuICAgICAgICBmaWxlbmFtZTogU3RyaW5nKGEuZmlsZW5hbWUgfHwgYEF0dGFjaG1lbnQgJHtpZHggKyAxfWApLFxuICAgICAgICBtaW1lX3R5cGU6IGEubWltZV90eXBlLFxuICAgICAgICBzaXplX2J5dGVzOiBhLnNpemVfYnl0ZXMsXG4gICAgICAgIHVybDogYS51cmwsXG4gICAgICB9KSk7XG4gICAgfVxuXG4gICAgLy8gU29tZSBBUEkgcmVzcG9uc2VzIHByb3ZpZGUgZmlsZSBtZXRhZGF0YSBpbiBhbHRlcm5hdGUgZmllbGRzLlxuICAgIGNvbnN0IGFueU1zZyA9IG1zZyBhcyBhbnk7XG4gICAgY29uc3QgbXUgPSBTdHJpbmcobXNnLm1lZGlhX3VybCB8fCAnJykudHJpbSgpO1xuICAgIGNvbnN0IG1lZGlhSXNEaXJlY3RVcmwgPVxuICAgICAgbXUuc3RhcnRzV2l0aCgnaHR0cDovLycpIHx8IG11LnN0YXJ0c1dpdGgoJ2h0dHBzOi8vJykgfHwgbXUuc3RhcnRzV2l0aCgnZGF0YTonKSB8fCBtdS5zdGFydHNXaXRoKCdibG9iOicpO1xuICAgIGNvbnN0IGZpbGVJZCA9XG4gICAgICBhbnlNc2c/LmZpbGVfaWQgfHxcbiAgICAgIGFueU1zZz8uYXR0YWNobWVudF9pZCB8fFxuICAgICAgYW55TXNnPy5hdHRhY2htZW50X2lkcz8uWzBdIHx8XG4gICAgICAoIW1lZGlhSXNEaXJlY3RVcmwgJiYgbXUgPyBtdSA6IHVuZGVmaW5lZCk7XG4gICAgY29uc3QgbWltZSA9IGFueU1zZz8ubWltZV90eXBlIHx8IGFueU1zZz8uYXR0YWNobWVudF9taW1lX3R5cGU7XG4gICAgY29uc3QgZXhwbGljaXRGaWxlbmFtZSA9IGFueU1zZz8uZmlsZW5hbWUgfHwgYW55TXNnPy5maWxlX25hbWU7XG4gICAgY29uc3QgZmlsZW5hbWUgPVxuICAgICAgZXhwbGljaXRGaWxlbmFtZSB8fFxuICAgICAgKGZpbGVJZCB8fCBtaW1lIHx8IG1zZy5tZXNzYWdlX3R5cGUgIT09ICdURVhUJyA/IG1zZy5jb250ZW50IDogJycpO1xuICAgIGlmIChmaWxlSWQgfHwgZXhwbGljaXRGaWxlbmFtZSB8fCBtaW1lIHx8IG1zZy5tZXNzYWdlX3R5cGUgPT09ICdGSUxFJyB8fCBtc2cubWVzc2FnZV90eXBlID09PSAnSU1BR0UnKSB7XG4gICAgICByZXR1cm4gW3tcbiAgICAgICAgZmlsZV9pZDogU3RyaW5nKGZpbGVJZCB8fCAnJyksXG4gICAgICAgIGZpbGVuYW1lOiBTdHJpbmcoZmlsZW5hbWUgfHwgJ0ZpbGUnKSxcbiAgICAgICAgbWltZV90eXBlOiBtaW1lID8gU3RyaW5nKG1pbWUpIDogdW5kZWZpbmVkLFxuICAgICAgICB1cmw6IG1lZGlhSXNEaXJlY3RVcmwgPyBtdSA6IHVuZGVmaW5lZCxcbiAgICAgIH1dO1xuICAgIH1cbiAgICByZXR1cm4gW107XG4gIH1cblxuICBpc0ltYWdlQXR0YWNobWVudChtc2c6IE1lc3NhZ2UpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy5nZXRSZW5kZXJhYmxlQXR0YWNobWVudHMobXNnKS5zb21lKChhdHQpID0+IHRoaXMuaXNJbWFnZUF0dGFjaG1lbnRJdGVtKGF0dCkpO1xuICB9XG5cbiAgaXNJbWFnZUF0dGFjaG1lbnRJdGVtKGF0dDogQXR0YWNobWVudCk6IGJvb2xlYW4ge1xuICAgIGNvbnN0IG1pbWUgPSBhdHQubWltZV90eXBlIHx8ICcnO1xuICAgIGlmIChtaW1lLnN0YXJ0c1dpdGgoJ2ltYWdlLycpKSByZXR1cm4gdHJ1ZTtcbiAgICBjb25zdCBuYW1lID0gKGF0dC5maWxlbmFtZSB8fCAnJykudG9Mb3dlckNhc2UoKTtcbiAgICByZXR1cm4gL1xcLihwbmd8anBlP2d8Z2lmfHdlYnB8Ym1wfHN2Z3xoZWljfGhlaWYpJC9pLnRlc3QobmFtZSk7XG4gIH1cblxuICAvKiogUmV0dXJucyB0aGUgY2FjaGVkIGRhdGEgVVJMIGZvciBhIG1lc3NhZ2UncyBtZWRpYSwgb3IgbnVsbCBhbmQgdHJpZ2dlcnMgYmFja2dyb3VuZCBsb2FkLiAqL1xuICBnZXRNZWRpYVVybChtc2c6IE1lc3NhZ2UpOiBzdHJpbmcgfCBudWxsIHtcbiAgICBjb25zdCBhdHQgPSB0aGlzLmdldFByaW1hcnlBdHRhY2htZW50KG1zZyk7XG4gICAgcmV0dXJuIGF0dCA/IHRoaXMuZ2V0QXR0YWNobWVudE1lZGlhVXJsKGF0dCwgbXNnKSA6IG51bGw7XG4gIH1cblxuICBnZXRBdHRhY2htZW50TWVkaWFVcmwoYXR0OiBBdHRhY2htZW50LCBtc2c/OiBNZXNzYWdlKTogc3RyaW5nIHwgbnVsbCB7XG4gICAgY29uc3QgZmlsZUlkID0gYXR0LmZpbGVfaWQ/LnRyaW0oKTtcblxuICAgIGNvbnN0IGRpcmVjdFVybCA9XG4gICAgICBhdHQudXJsIHx8XG4gICAgICBtc2c/Lm1lZGlhX3VybCB8fFxuICAgICAgKG1zZyBhcyBhbnkpPy51cmwgfHxcbiAgICAgIChtc2cgYXMgYW55KT8uZmlsZV91cmw7XG4gICAgaWYgKFxuICAgICAgZGlyZWN0VXJsICYmXG4gICAgICAoZGlyZWN0VXJsLnN0YXJ0c1dpdGgoJ2h0dHA6Ly8nKSB8fFxuICAgICAgICBkaXJlY3RVcmwuc3RhcnRzV2l0aCgnaHR0cHM6Ly8nKSB8fFxuICAgICAgICBkaXJlY3RVcmwuc3RhcnRzV2l0aCgnZGF0YTonKSB8fFxuICAgICAgICBkaXJlY3RVcmwuc3RhcnRzV2l0aCgnYmxvYjonKSlcbiAgICApIHtcbiAgICAgIHJldHVybiBkaXJlY3RVcmw7XG4gICAgfVxuXG4gICAgaWYgKCFmaWxlSWQpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IGNhY2hlZCA9IHRoaXMuZmlsZVNlcnZpY2UuZ2V0Q2FjaGVkRGF0YVVybChmaWxlSWQpO1xuICAgIGlmIChjYWNoZWQpIHJldHVybiBjYWNoZWQ7XG5cbiAgICAvLyBOb3QgeWV0IGNhY2hlZCDigJQga2ljayBvZmYgYSBiYWNrZ3JvdW5kIGZldGNoXG4gICAgdGhpcy5mZXRjaE1lZGlhKGZpbGVJZCk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICB0cmFja0J5TWVzc2FnZShfaW5kZXg6IG51bWJlciwgbXNnOiBNZXNzYWdlKTogc3RyaW5nIHtcbiAgICByZXR1cm4gU3RyaW5nKG1zZy5tZXNzYWdlX2lkIHx8IGAke21zZy5zZW5kZXJfaWR9LSR7bXNnLmNyZWF0ZWRfYXR9YCk7XG4gIH1cblxuICB0cmFja0J5QXR0YWNobWVudChpbmRleDogbnVtYmVyLCBhdHQ6IEF0dGFjaG1lbnQpOiBzdHJpbmcge1xuICAgIHJldHVybiBgJHthdHQuZmlsZV9pZCB8fCAnJ318JHthdHQuZmlsZW5hbWUgfHwgJyd9fCR7aW5kZXh9YDtcbiAgfVxuXG4gIGRvd25sb2FkQXR0YWNobWVudChldmVudDogRXZlbnQsIHVybDogc3RyaW5nIHwgbnVsbCwgZmlsZW5hbWU6IHN0cmluZyk6IHZvaWQge1xuICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgaWYgKCF1cmwpIHJldHVybjtcblxuICAgIGNvbnN0IGxpbmsgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdhJyk7XG4gICAgbGluay5ocmVmID0gdXJsO1xuICAgIGxpbmsuZG93bmxvYWQgPSBmaWxlbmFtZSB8fCAnYXR0YWNobWVudCc7XG4gICAgbGluay5yZWwgPSAnbm9vcGVuZXInO1xuICAgIGxpbmsudGFyZ2V0ID0gJ19ibGFuayc7XG4gICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChsaW5rKTtcbiAgICBsaW5rLmNsaWNrKCk7XG4gICAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZChsaW5rKTtcbiAgfVxuXG4gIHByaXZhdGUgcHJld2FybU1lZGlhKG1lc3NhZ2VzOiBNZXNzYWdlW10pOiB2b2lkIHtcbiAgICBmb3IgKGNvbnN0IG1zZyBvZiBtZXNzYWdlcykge1xuICAgICAgZm9yIChjb25zdCBhdHQgb2YgdGhpcy5nZXRSZW5kZXJhYmxlQXR0YWNobWVudHMobXNnKSkge1xuICAgICAgICBjb25zdCBmaWxlSWQgPSBhdHQuZmlsZV9pZD8udHJpbSgpO1xuICAgICAgICBpZiAoIWZpbGVJZCB8fCBmaWxlSWQuc3RhcnRzV2l0aCgndGVtcC0nKSkgY29udGludWU7XG4gICAgICAgIGlmICh0aGlzLmZpbGVTZXJ2aWNlLmdldENhY2hlZERhdGFVcmwoZmlsZUlkKSkgY29udGludWU7XG4gICAgICAgIC8vIFByZWxvYWQgZXZlcnkgYXR0YWNobWVudCBzbyBlYWNoIGl0ZW0gZ2V0cyBpdHMgb3duIFVSTC9kb3dubG9hZCBzdGF0ZS5cbiAgICAgICAgdGhpcy5mZXRjaE1lZGlhKGZpbGVJZCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBmZXRjaE1lZGlhKGZpbGVJZDogc3RyaW5nKTogdm9pZCB7XG4gICAgaWYgKCFmaWxlSWQgfHwgZmlsZUlkLnN0YXJ0c1dpdGgoJ3RlbXAtJykgfHwgdGhpcy5tZWRpYUxvYWRpbmcuaGFzKGZpbGVJZCkpIHJldHVybjtcbiAgICB0aGlzLm1lZGlhRmFpbGVkLmRlbGV0ZShmaWxlSWQpO1xuICAgIHRoaXMubWVkaWFMb2FkaW5nLmFkZChmaWxlSWQpO1xuXG4gICAgdGhpcy5maWxlU2VydmljZS5nZXRGaWxlRGF0YVVybChmaWxlSWQpLnN1YnNjcmliZSh7XG4gICAgICBuZXh0OiAoKSA9PiB7XG4gICAgICAgIHRoaXMubWVkaWFMb2FkaW5nLmRlbGV0ZShmaWxlSWQpO1xuICAgICAgICB0aGlzLmNkci5tYXJrRm9yQ2hlY2soKTtcbiAgICAgIH0sXG4gICAgICBlcnJvcjogKCkgPT4ge1xuICAgICAgICB0aGlzLm1lZGlhTG9hZGluZy5kZWxldGUoZmlsZUlkKTtcbiAgICAgICAgdGhpcy5tZWRpYUZhaWxlZC5hZGQoZmlsZUlkKTtcbiAgICAgICAgdGhpcy5jZHIubWFya0ZvckNoZWNrKCk7XG4gICAgICB9LFxuICAgIH0pO1xuICB9XG5cbiAgc2hvdWxkU2hvd01lZGlhU3Bpbm5lcihtc2c6IE1lc3NhZ2UpOiBib29sZWFuIHtcbiAgICBjb25zdCBmaWxlSWQgPSB0aGlzLmdldFByaW1hcnlBdHRhY2htZW50KG1zZyk/LmZpbGVfaWQ7XG4gICAgaWYgKCFmaWxlSWQgfHwgZmlsZUlkLnN0YXJ0c1dpdGgoJ3RlbXAtJykpIHJldHVybiBmYWxzZTtcbiAgICByZXR1cm4gdGhpcy5tZWRpYUxvYWRpbmcuaGFzKGZpbGVJZCkgJiYgIXRoaXMubWVkaWFGYWlsZWQuaGFzKGZpbGVJZCk7XG4gIH1cblxuICBzaG91bGRTaG93QXR0YWNobWVudFNwaW5uZXIoYXR0OiBBdHRhY2htZW50KTogYm9vbGVhbiB7XG4gICAgY29uc3QgZmlsZUlkID0gYXR0LmZpbGVfaWQ7XG4gICAgaWYgKCFmaWxlSWQgfHwgZmlsZUlkLnN0YXJ0c1dpdGgoJ3RlbXAtJykpIHJldHVybiBmYWxzZTtcbiAgICByZXR1cm4gdGhpcy5tZWRpYUxvYWRpbmcuaGFzKGZpbGVJZCkgJiYgIXRoaXMubWVkaWFGYWlsZWQuaGFzKGZpbGVJZCk7XG4gIH1cblxuICBpc1ZpZGVvQXR0YWNobWVudChtc2c6IE1lc3NhZ2UpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy5nZXRSZW5kZXJhYmxlQXR0YWNobWVudHMobXNnKS5zb21lKChhdHQpID0+IHRoaXMuaXNWaWRlb0F0dGFjaG1lbnRJdGVtKGF0dCkpO1xuICB9XG5cbiAgaXNWaWRlb0F0dGFjaG1lbnRJdGVtKGF0dDogQXR0YWNobWVudCk6IGJvb2xlYW4ge1xuICAgIGNvbnN0IG1pbWUgPSBhdHQubWltZV90eXBlIHx8ICcnO1xuICAgIGlmIChtaW1lLnN0YXJ0c1dpdGgoJ3ZpZGVvLycpKSByZXR1cm4gdHJ1ZTtcbiAgICBjb25zdCBuYW1lID0gKGF0dC5maWxlbmFtZSB8fCAnJykudG9Mb3dlckNhc2UoKTtcbiAgICByZXR1cm4gL1xcLihtcDR8d2VibXxtb3Z8bTR2fGF2aXxta3YpJC9pLnRlc3QobmFtZSk7XG4gIH1cblxuICBnZXRBdHRhY2htZW50TWltZVR5cGUoYXR0T3JNc2c6IEF0dGFjaG1lbnQgfCBNZXNzYWdlKTogc3RyaW5nIHtcbiAgICBpZiAoJ2ZpbGVfaWQnIGluIGF0dE9yTXNnKSB7XG4gICAgICByZXR1cm4gKGF0dE9yTXNnIGFzIEF0dGFjaG1lbnQpLm1pbWVfdHlwZSB8fCAnYXBwbGljYXRpb24vb2N0ZXQtc3RyZWFtJztcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuZ2V0UHJpbWFyeUF0dGFjaG1lbnQoYXR0T3JNc2cpPy5taW1lX3R5cGUgfHwgJ2FwcGxpY2F0aW9uL29jdGV0LXN0cmVhbSc7XG4gIH1cblxuICBnZXRBdHRhY2htZW50TmFtZShtc2c6IE1lc3NhZ2UpOiBzdHJpbmcge1xuICAgIHJldHVybiB0aGlzLmdldFByaW1hcnlBdHRhY2htZW50KG1zZyk/LmZpbGVuYW1lIHx8IG1zZy5jb250ZW50IHx8ICdGaWxlJztcbiAgfVxuXG4gIGdldEF0dGFjaG1lbnREaXNwbGF5TmFtZShhdHQ6IEF0dGFjaG1lbnQsIG1zZz86IE1lc3NhZ2UpOiBzdHJpbmcge1xuICAgIHJldHVybiBhdHQuZmlsZW5hbWUgfHwgbXNnPy5jb250ZW50IHx8ICdGaWxlJztcbiAgfVxuXG4gIGhhc0ZpbGVBdHRhY2htZW50KG1zZzogTWVzc2FnZSk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBtc2cubWVzc2FnZV90eXBlID09PSAnRklMRScgfHwgdGhpcy5nZXRSZW5kZXJhYmxlQXR0YWNobWVudHMobXNnKS5sZW5ndGggPiAwO1xuICB9XG5cbiAgaGFzTWVkaWFGYWlsZWQobXNnOiBNZXNzYWdlKTogYm9vbGVhbiB7XG4gICAgY29uc3QgZmlsZUlkID0gdGhpcy5nZXRQcmltYXJ5QXR0YWNobWVudChtc2cpPy5maWxlX2lkO1xuICAgIHJldHVybiAhIWZpbGVJZCAmJiB0aGlzLm1lZGlhRmFpbGVkLmhhcyhmaWxlSWQpO1xuICB9XG5cbiAgaGFzQXR0YWNobWVudEZhaWxlZChhdHQ6IEF0dGFjaG1lbnQpOiBib29sZWFuIHtcbiAgICByZXR1cm4gISFhdHQuZmlsZV9pZCAmJiB0aGlzLm1lZGlhRmFpbGVkLmhhcyhhdHQuZmlsZV9pZCk7XG4gIH1cblxuICBnZXRGaWxlSWNvbihtc2c6IE1lc3NhZ2UpOiBzdHJpbmcge1xuICAgIGNvbnN0IG1pbWUgPSB0aGlzLmdldEF0dGFjaG1lbnRNaW1lVHlwZShtc2cpO1xuICAgIGNvbnN0IG5hbWUgPSB0aGlzLmdldEF0dGFjaG1lbnROYW1lKG1zZykudG9Mb3dlckNhc2UoKTtcbiAgICBpZiAobWltZS5zdGFydHNXaXRoKCd2aWRlby8nKSB8fCAvXFwuKG1wNHx3ZWJtfG1vdnxtNHZ8YXZpfG1rdikkL2kudGVzdChuYW1lKSkgcmV0dXJuICd2aWRlb2NhbSc7XG4gICAgaWYgKG1pbWUuc3RhcnRzV2l0aCgnYXVkaW8vJykgfHwgL1xcLihtcDN8d2F2fG9nZ3xtNGF8ZmxhYykkL2kudGVzdChuYW1lKSkgcmV0dXJuICdhdWRpb3RyYWNrJztcbiAgICBpZiAobWltZS5pbmNsdWRlcygncGRmJykgfHwgbmFtZS5lbmRzV2l0aCgnLnBkZicpKSByZXR1cm4gJ3BpY3R1cmVfYXNfcGRmJztcbiAgICBpZiAobWltZS5pbmNsdWRlcygnc3ByZWFkc2hlZXQnKSB8fCBtaW1lLmluY2x1ZGVzKCdleGNlbCcpIHx8IC9cXC4oeGxzfHhsc3h8Y3N2KSQvaS50ZXN0KG5hbWUpKSByZXR1cm4gJ3RhYmxlX2NoYXJ0JztcbiAgICBpZiAobWltZS5pbmNsdWRlcygnZG9jdW1lbnQnKSB8fCBtaW1lLmluY2x1ZGVzKCd3b3JkJykgfHwgL1xcLihkb2N8ZG9jeHx0eHR8cnRmKSQvaS50ZXN0KG5hbWUpKSByZXR1cm4gJ2Rlc2NyaXB0aW9uJztcbiAgICBpZiAobWltZS5pbmNsdWRlcygnemlwJykgfHwgL1xcLih6aXB8cmFyfDd6fHRhcnxneikkL2kudGVzdChuYW1lKSkgcmV0dXJuICdmb2xkZXJfemlwJztcbiAgICByZXR1cm4gJ2luc2VydF9kcml2ZV9maWxlJztcbiAgfVxuXG4gIGdldEF0dGFjaG1lbnRJY29uKGF0dDogQXR0YWNobWVudCwgbXNnPzogTWVzc2FnZSk6IHN0cmluZyB7XG4gICAgY29uc3QgbWltZSA9IHRoaXMuZ2V0QXR0YWNobWVudE1pbWVUeXBlKGF0dCk7XG4gICAgY29uc3QgbmFtZSA9IHRoaXMuZ2V0QXR0YWNobWVudERpc3BsYXlOYW1lKGF0dCwgbXNnKS50b0xvd2VyQ2FzZSgpO1xuICAgIGlmIChtaW1lLnN0YXJ0c1dpdGgoJ3ZpZGVvLycpIHx8IC9cXC4obXA0fHdlYm18bW92fG00dnxhdml8bWt2KSQvaS50ZXN0KG5hbWUpKSByZXR1cm4gJ3ZpZGVvY2FtJztcbiAgICBpZiAobWltZS5zdGFydHNXaXRoKCdhdWRpby8nKSB8fCAvXFwuKG1wM3x3YXZ8b2dnfG00YXxmbGFjKSQvaS50ZXN0KG5hbWUpKSByZXR1cm4gJ2F1ZGlvdHJhY2snO1xuICAgIGlmIChtaW1lLmluY2x1ZGVzKCdwZGYnKSB8fCBuYW1lLmVuZHNXaXRoKCcucGRmJykpIHJldHVybiAncGljdHVyZV9hc19wZGYnO1xuICAgIGlmIChtaW1lLmluY2x1ZGVzKCdzcHJlYWRzaGVldCcpIHx8IG1pbWUuaW5jbHVkZXMoJ2V4Y2VsJykgfHwgL1xcLih4bHN8eGxzeHxjc3YpJC9pLnRlc3QobmFtZSkpIHJldHVybiAndGFibGVfY2hhcnQnO1xuICAgIGlmIChtaW1lLmluY2x1ZGVzKCdkb2N1bWVudCcpIHx8IG1pbWUuaW5jbHVkZXMoJ3dvcmQnKSB8fCAvXFwuKGRvY3xkb2N4fHR4dHxydGYpJC9pLnRlc3QobmFtZSkpIHJldHVybiAnZGVzY3JpcHRpb24nO1xuICAgIGlmIChtaW1lLmluY2x1ZGVzKCd6aXAnKSB8fCAvXFwuKHppcHxyYXJ8N3p8dGFyfGd6KSQvaS50ZXN0KG5hbWUpKSByZXR1cm4gJ2ZvbGRlcl96aXAnO1xuICAgIHJldHVybiAnaW5zZXJ0X2RyaXZlX2ZpbGUnO1xuICB9XG5cbiAgb3BlbkxpZ2h0Ym94KGRhdGFVcmw6IHN0cmluZyk6IHZvaWQge1xuICAgIHRoaXMubGlnaHRib3hPcGVuLmVtaXQoZGF0YVVybCk7XG4gIH1cblxuICAvLyDilIDilIAgUmVhY3Rpb25zIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuXG4gIG9uRW1vamlTZWxlY3RlZChlbW9qaTogc3RyaW5nLCBtZXNzYWdlSWQ6IHN0cmluZyk6IHZvaWQge1xuICAgIHRoaXMuc3RvcmUuYWRkUmVhY3Rpb24obWVzc2FnZUlkLCBlbW9qaSk7XG4gIH1cblxuICB0b2dnbGVSZWFjdGlvbihlbW9qaTogc3RyaW5nLCBtZXNzYWdlSWQ6IHN0cmluZyk6IHZvaWQge1xuICAgIGNvbnN0IG1zZyA9IHRoaXMubWVzc2FnZXMuZmluZChtID0+IG0ubWVzc2FnZV9pZCA9PT0gbWVzc2FnZUlkKTtcbiAgICBpZiAoIW1zZykgcmV0dXJuO1xuICAgIFxuICAgIGNvbnN0IHJlYWN0aW9uID0gbXNnLnJlYWN0aW9ucz8uZmluZChyID0+IHIuZW1vamkgPT09IGVtb2ppKTtcbiAgICBpZiAocmVhY3Rpb24/Lmhhc1JlYWN0ZWQpIHtcbiAgICAgIHRoaXMuc3RvcmUucmVtb3ZlUmVhY3Rpb24obWVzc2FnZUlkLCBlbW9qaSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuc3RvcmUuYWRkUmVhY3Rpb24obWVzc2FnZUlkLCBlbW9qaSk7XG4gICAgfVxuICB9XG5cbiAgZ2V0UmVhY3RvclRvb2x0aXAocmVhY3Rpb246IGFueSk6IHN0cmluZyB7XG4gICAgaWYgKCFyZWFjdGlvbj8ucmVhY3RvcnM/Lmxlbmd0aCkgcmV0dXJuICcnO1xuICAgIHJldHVybiByZWFjdGlvbi5yZWFjdG9ycy5qb2luKCcsICcpO1xuICB9XG59XG4iXX0=