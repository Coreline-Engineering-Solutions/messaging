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
    isRemovedFromGroup = false;
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
    mediaQueue = [];
    activeMediaRequests = 0;
    maxMediaRequests = 2;
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
        if (this.isRemovedFromGroup)
            return;
        if (this.conversationId) {
            this.store.openGroupSettings(this.conversationId, this.conversationName);
        }
    }
    onSendMessage(content) {
        if (this.isRemovedFromGroup)
            return;
        this.store.sendMessage(this.conversationId, content);
        this.shouldScrollToBottom = true;
    }
    onSendWithFiles(payload) {
        if (this.isRemovedFromGroup)
            return;
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
    loadOlder() {
        if (this.conversationId && this.messages.length > 0) {
            this.store.loadMessages(this.conversationId, this.messages[0].message_id);
        }
    }
    onScroll() { }
    onThreadDragEnter(event) {
        if (this.isRemovedFromGroup)
            return;
        if (!this.dragHasFiles(event))
            return;
        event.preventDefault();
        event.stopPropagation();
        this.threadDragDepth++;
        this.threadDragOver = true;
    }
    onThreadDragOver(event) {
        if (this.isRemovedFromGroup)
            return;
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
        if (this.isRemovedFromGroup)
            return;
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
    exitRemovedGroup() {
        if (this.conversationId) {
            this.store.exitRemovedGroup(this.conversationId);
        }
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
    isSystemMessage(msg) {
        const content = String(msg.content || '').trim();
        return msg.message_type === 'SYSTEM' ||
            /^.+ added .+ to the group$/.test(content) ||
            /^.+ removed .+ from the group$/.test(content);
    }
    isPreformattedText(msg) {
        const content = String(msg.content || '');
        return content.includes('\t') || content.includes('\n') || / {2,}/.test(content);
    }
    isTableText(msg) {
        const rows = this.getTableRows(msg);
        return rows.length >= 2 && rows.some((row) => row.length >= 2);
    }
    getTableRows(msg) {
        const content = String(msg.content || '').trim();
        if (!content.includes('\t'))
            return [];
        const rows = content
            .split(/\r?\n/)
            .map((line) => line.split('\t').map((cell) => cell.trim()))
            .filter((row) => row.some((cell) => cell.length > 0));
        const maxColumns = Math.max(0, ...rows.map((row) => row.length));
        if (maxColumns < 2)
            return [];
        return rows.map((row) => [
            ...row,
            ...Array.from({ length: maxColumns - row.length }, () => ''),
        ]);
    }
    isMessageRead(msg) {
        const value = msg.is_read;
        return value === true || value === 'true' || value === 'True' || value === '1';
    }
    getReadTooltip(msg) {
        if (!this.isGroup)
            return 'Read';
        const names = this.getReadByNames(msg);
        if (names.length > 0) {
            return `Read by ${names.join(', ')}`;
        }
        return 'Read';
    }
    getReadByNames(msg) {
        const anyMsg = msg;
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
            .filter((name) => !!name && name !== 'You');
        return Array.from(new Set(names));
    }
    toReadArray(value) {
        if (!value)
            return [];
        if (Array.isArray(value))
            return value;
        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (!trimmed)
                return [];
            try {
                const parsed = JSON.parse(trimmed);
                return Array.isArray(parsed) ? parsed : [parsed];
            }
            catch {
                return trimmed.includes(',') ? trimmed.split(',').map((v) => v.trim()) : [trimmed];
            }
        }
        return [value];
    }
    readEntryToName(entry) {
        if (entry == null)
            return null;
        if (typeof entry === 'string' || typeof entry === 'number') {
            const idOrName = String(entry).trim();
            const contact = this.visibleContacts.find((c) => String(c.contact_id) === idOrName);
            return contact ? getContactDisplayName(contact) : idOrName;
        }
        if (typeof entry === 'object') {
            const obj = entry;
            const explicit = obj.username || obj.name || obj.display_name || obj.displayName || obj.email;
            if (explicit)
                return String(explicit);
            if (obj.contact_id || obj.contactId) {
                return this.readEntryToName(obj.contact_id || obj.contactId);
            }
        }
        return null;
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
    getFilenameLike(msg, attachment) {
        const anyMsg = msg;
        return String(attachment?.filename ||
            this.getPrimaryAttachment(msg)?.filename ||
            anyMsg?.filename ||
            anyMsg?.file_name ||
            msg.content ||
            '').toLowerCase();
    }
    getRenderableAttachments(msg) {
        const attachments = this.getAllAttachments(msg);
        if (attachments.length > 0)
            return attachments;
        const primary = this.getPrimaryAttachment(msg);
        return primary ? [primary] : [];
    }
    trackByAttachment(index, attachment) {
        return attachment.file_id || attachment.url || `${attachment.filename}-${index}`;
    }
    getAllAttachments(msg) {
        const anyMsg = msg;
        const attachments = [];
        const add = (attachment) => {
            const raw = attachment;
            const fileId = String(typeof attachment === 'string' ? attachment :
                raw?.file_id ??
                    raw?.fileId ??
                    raw?.id ??
                    raw?.attachment_id ??
                    raw?.storage_file_id ??
                    '').trim();
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
            if (!fileId && !url)
                return;
            if (fileId && attachments.some((a) => a.file_id === fileId))
                return;
            if (!fileId && url && attachments.some((a) => a.url === url))
                return;
            attachments.push({
                file_id: fileId,
                filename: String(raw?.filename ??
                    raw?.file_name ??
                    raw?.name ??
                    'File'),
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
            }
            catch {
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
    toArray(value) {
        if (Array.isArray(value)) {
            return value
                .map((x) => (typeof x === 'string' ? x : x?.file_id ?? x?.id ?? ''))
                .map((x) => String(x).trim())
                .filter(Boolean);
        }
        if (typeof value === 'string' && value.trim()) {
            const trimmed = value.trim();
            if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                try {
                    const parsed = JSON.parse(trimmed);
                    if (Array.isArray(parsed))
                        return this.toArray(parsed);
                    return this.toArray(parsed?.ids ?? parsed?.file_ids ?? parsed?.attachment_ids ?? parsed?.attachments);
                }
                catch {
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
    getPrimaryAttachment(msg) {
        const attachments = this.getAllAttachments(msg);
        if (attachments.length > 0)
            return attachments[0];
        // Some API responses provide file metadata in alternate fields.
        const anyMsg = msg;
        const mu = String(msg.media_url || '').trim();
        const mediaIsDirectUrl = mu.startsWith('http://') || mu.startsWith('https://') || mu.startsWith('data:');
        const mediaIsStructured = mu.startsWith('{') || mu.startsWith('[');
        const fileId = anyMsg?.file_id ||
            anyMsg?.attachment_id ||
            anyMsg?.attachment_ids?.[0] ||
            (!mediaIsDirectUrl && !mediaIsStructured && mu ? mu : undefined);
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
    isImageAttachment(msg, attachment) {
        const mime = attachment?.mime_type || this.getPrimaryAttachment(msg)?.mime_type || '';
        if (mime.startsWith('image/'))
            return true;
        const name = this.getFilenameLike(msg, attachment);
        if (/\.(png|jpe?g|gif|webp|bmp|svg|heic|heif)$/i.test(name))
            return true;
        return !attachment && msg.message_type === 'IMAGE';
    }
    /** Returns the cached data URL for a message's media, or null and triggers background load. */
    getMediaUrl(msg, attachment) {
        const att = attachment || this.getPrimaryAttachment(msg);
        const fileId = att?.file_id?.trim();
        const directUrl = att?.url ||
            (!attachment ? msg.media_url : undefined) ||
            (!attachment ? msg?.url : undefined) ||
            (!attachment ? msg?.file_url : undefined);
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
        if (this.mediaFailed.has(fileId))
            return null;
        // Not yet cached — kick off a background fetch
        this.fetchMedia(fileId);
        return null;
    }
    prewarmMedia(messages) {
        for (const msg of messages) {
            for (const att of this.getRenderableAttachments(msg)) {
                if (!this.isImageAttachment(msg, att))
                    continue;
                const fileId = att.file_id?.trim();
                if (!fileId || fileId.startsWith('temp-'))
                    continue;
                if (this.mediaFailed.has(fileId))
                    continue;
                if (this.fileService.getCachedDataUrl(fileId))
                    continue;
                // Queue all files so download links appear once retrieval completes.
                this.fetchMedia(fileId);
            }
        }
    }
    fetchMedia(fileId) {
        if (!fileId || fileId.startsWith('temp-') || this.mediaLoading.has(fileId) || this.mediaFailed.has(fileId))
            return;
        this.mediaLoading.add(fileId);
        this.mediaQueue.push(fileId);
        this.pumpMediaQueue();
    }
    pumpMediaQueue() {
        while (this.activeMediaRequests < this.maxMediaRequests && this.mediaQueue.length > 0) {
            const fileId = this.mediaQueue.shift();
            if (!fileId)
                continue;
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
    finishMediaRequest(fileId) {
        this.activeMediaRequests = Math.max(0, this.activeMediaRequests - 1);
        this.mediaLoading.delete(fileId);
        this.cdr.markForCheck();
        this.pumpMediaQueue();
    }
    resetMediaQueue() {
        this.mediaQueue = [];
        this.mediaLoading.clear();
        this.activeMediaRequests = 0;
    }
    shouldShowMediaSpinner(target) {
        const fileId = this.getAttachmentFileId(target);
        if (!fileId || fileId.startsWith('temp-'))
            return false;
        return this.mediaLoading.has(fileId) && !this.mediaFailed.has(fileId);
    }
    isVideoAttachment(msg, attachment) {
        const mime = attachment?.mime_type || this.getPrimaryAttachment(msg)?.mime_type || '';
        if (mime.startsWith('video/'))
            return true;
        const name = this.getFilenameLike(msg, attachment);
        return /\.(mp4|webm|mov|m4v|avi|mkv)$/i.test(name);
    }
    getAttachmentMimeType(msg, attachment) {
        return attachment?.mime_type || this.getPrimaryAttachment(msg)?.mime_type || 'application/octet-stream';
    }
    getAttachmentName(msg, attachment) {
        return attachment?.filename || this.getPrimaryAttachment(msg)?.filename || msg.content || 'File';
    }
    hasFileAttachment(msg) {
        return msg.message_type === 'FILE' || this.getRenderableAttachments(msg).length > 0;
    }
    hasMediaFailed(target) {
        const fileId = this.getAttachmentFileId(target);
        return !!fileId && this.mediaFailed.has(fileId);
    }
    getAttachmentFileId(target) {
        if ('file_id' in target)
            return target.file_id;
        return this.getPrimaryAttachment(target)?.file_id;
    }
    getFileIcon(msg, attachment) {
        const mime = this.getAttachmentMimeType(msg, attachment);
        const name = this.getAttachmentName(msg, attachment).toLowerCase();
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
    openLightbox(dataUrl, event) {
        event?.stopPropagation();
        this.lightboxOpen.emit(dataUrl);
    }
    downloadAttachment(msg, attachment, event) {
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
    triggerDownload(url, filename) {
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
    onEmojiSelected(emoji, messageId) {
        this.toggleReaction(emoji, messageId);
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

  `, isInline: true, styles: [":host{--attachment-thumb-size: 180px}.chat-thread{display:flex;flex-direction:column;height:100%;background:#041322;position:relative}.chat-thread.drag-over{outline:2px dashed rgba(255,255,255,.45);outline-offset:-6px}.thread-drag-overlay{position:absolute;inset:8px;z-index:20;pointer-events:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:#fff;background:#1f4bd852;border:2px dashed rgba(255,255,255,.55);border-radius:14px;font-size:14px;font-weight:600}.thread-drag-overlay mat-icon{font-size:36px;width:36px;height:36px}.chat-header{display:flex;align-items:center;padding:8px 8px 8px 4px;border-bottom:1px solid rgba(255,255,255,.15);gap:4px;flex-shrink:0}.chat-header button mat-icon{color:#fffc}.chat-name{font-size:16px;font-weight:600;color:#fff}.header-info{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;padding:0 4px}.header-actions{display:flex;align-items:center;gap:0}.header-actions button{width:32px;height:32px;min-width:32px!important;padding:0!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;--mdc-icon-button-state-layer-size: 32px}.hdr-btn{border-radius:6px!important;transition:background .15s,box-shadow .15s}.hdr-btn:hover{background:#ffffff26!important;box-shadow:0 2px 8px #0003}.hdr-btn mat-icon{font-size:20px;width:20px;height:20px;line-height:20px;margin:0;display:flex;align-items:center;justify-content:center}:host ::ng-deep .hdr-btn .mat-mdc-button-touch-target{width:32px!important;height:32px!important}.messages-area{flex:1;overflow-y:auto;padding:12px;background:transparent;scrollbar-width:none;-ms-overflow-style:none}.messages-area::-webkit-scrollbar{display:none}.loading-indicator{display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;color:#ffffffb3;font-size:13px}.removed-group-state{height:100%;min-height:260px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:10px;padding:32px 24px;color:#ffffffc7;box-sizing:border-box}.removed-group-state mat-icon{width:44px;height:44px;font-size:44px;color:#f87171;margin-bottom:4px}.removed-group-state h4{margin:0;color:#fff;font-size:17px;font-weight:700}.removed-group-state p{margin:0 0 8px;max-width:280px;font-size:13px;line-height:1.4;color:#ffffff9e}.removed-exit-btn{border-radius:10px;background:#ffffff2e!important;color:#fff!important;font-weight:700;padding:0 18px}.load-more-btn{align-self:center;margin-bottom:16px;font-size:12px;color:#fff}.messages-list{display:flex;flex-direction:column;gap:1px;flex:1}.date-separator{text-align:center;margin:16px 0 8px;font-size:12px;color:#ffffffb3;font-weight:500}.message-bubble-row{display:flex;flex-direction:column;max-width:88%;margin-bottom:2px}.message-bubble-row.own{align-self:flex-end;align-items:flex-end}.message-bubble-row.other{align-self:flex-start;align-items:flex-start}.sender-name{font-size:11px;font-weight:700;color:#fffffff2;margin-bottom:3px;letter-spacing:.2px;padding:0 10px;text-shadow:0 1px 3px rgba(0,0,0,.4)}.system-message-row{align-self:center;max-width:88%;margin:8px auto;text-align:center}.system-message-text{display:inline-flex;align-items:center;justify-content:center;padding:5px 11px;border-radius:999px;background:#ffffff17;border:1px solid rgba(255,255,255,.12);color:#ffffffb8;font-size:11px;line-height:1.35}.message-bubble{padding:8px 14px 7px;border-radius:14px;font-size:13px;line-height:1.32;word-break:break-word;color:#f5f7ff;position:relative;display:inline-block;min-width:fit-content}.message-bubble-row.other .message-bubble{background:#0d2540;border-bottom-left-radius:5px;box-shadow:0 1px 4px #0006}.message-bubble.own-bubble{background:#0a3d62;border-bottom-right-radius:5px;box-shadow:0 1px 4px #0006}.text-content{white-space:pre-wrap;tab-size:4}.text-content.preformatted-text{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,Liberation Mono,monospace;font-size:12px;line-height:1.45;overflow-x:auto;max-width:min(72vw,520px)}.table-message-wrap{max-width:min(76vw,560px);overflow-x:auto;border-radius:9px;border:1px solid rgba(255,255,255,.16);background:#ffffff0a}.pasted-table{border-collapse:collapse;min-width:100%;font-size:12px;line-height:1.35;color:#f5f7ff}.pasted-table th,.pasted-table td{padding:6px 9px;border-right:1px solid rgba(255,255,255,.12);border-bottom:1px solid rgba(255,255,255,.12);text-align:left;white-space:pre-wrap;vertical-align:top}.pasted-table th{background:#ffffff1a;font-weight:700}.pasted-table tr:last-child td,.pasted-table tr:last-child th{border-bottom:none}.pasted-table th:last-child,.pasted-table td:last-child{border-right:none}.image-message{line-height:0}.media-wrapper{position:relative;display:inline-block;line-height:0;width:var(--attachment-thumb-size);height:var(--attachment-thumb-size);overflow:hidden;border-radius:10px;background:#ffffff14}.media-img{width:100%;height:100%;border-radius:inherit;display:block;cursor:zoom-in;object-fit:cover}.attachment-actions{position:absolute;right:6px;top:6px;display:flex;gap:4px;opacity:0;transition:opacity .12s ease;pointer-events:none}.media-wrapper:hover .attachment-actions{opacity:1;pointer-events:auto}.attachment-action-btn,.file-download-btn{border:none;border-radius:999px;background:#071d30d1;color:#fff;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0}.attachment-action-btn{width:28px;height:28px}.attachment-action-btn mat-icon{font-size:17px;width:17px;height:17px}.media-video{max-width:240px;max-height:260px;border-radius:10px;display:block;background:#000}.video-message{display:flex;flex-direction:column;gap:6px}.video-download{color:#ffffffc7;font-size:12px;text-decoration:underline;text-underline-offset:2px}.media-placeholder{display:flex;align-items:center;justify-content:center;gap:8px;width:var(--attachment-thumb-size);height:var(--attachment-thumb-size);border-radius:10px;background:#ffffff14;color:#fff9;font-size:11px}.media-load-label{font-size:11px;color:#fff9}.attachments-list{display:flex;flex-direction:column;gap:8px;max-width:100%}.attachment-item{max-width:100%}.file-message{display:flex;align-items:center;gap:8px;padding:4px 0}.attachment-thumb.file-message{position:relative;width:var(--attachment-thumb-size);height:var(--attachment-thumb-size);padding:12px;border-radius:10px;background:#ffffff14;flex-direction:column;justify-content:center;box-sizing:border-box;overflow:hidden}.file-download{display:inline-flex;align-items:center;gap:8px;color:#fff;text-decoration:none;max-width:240px}.file-msg-icon{font-size:42px;width:42px;height:42px;color:#fffc;flex-shrink:0}.file-msg-name{font-size:13px;color:#fff;line-height:1.2;max-width:100%;overflow:hidden;text-align:center;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;word-break:break-word}.file-download-icon{font-size:18px;width:18px;height:18px;color:#ffffffb3;flex-shrink:0}.file-download-btn{width:24px;height:24px;flex-shrink:0;position:absolute;right:6px;top:6px}.file-download-link{border:none;border-radius:999px;background:#ffffff29;color:#fff;cursor:pointer;font-size:11px;padding:4px 10px;margin-top:4px}.message-meta{display:flex;align-items:center;gap:4px;margin-top:3px}.msg-time{font-size:10px;color:#dae0faa8}.message-bubble-row.other .msg-time{color:#d8dff694}.read-icon{font-size:14px;width:14px;height:14px;opacity:.7}.read-icon.read{color:#60a5fa;opacity:1}.read-icon.unread{color:#dae0fa80;opacity:1}.quick-reactions{position:absolute;top:-18px;right:0;display:flex;align-items:center;gap:4px;padding:3px 5px;background:#071d30;border:1px solid rgba(255,255,255,.14);border-radius:999px;box-shadow:0 6px 14px #00000047;z-index:4}.message-bubble-row.other .quick-reactions{left:0;right:auto}.message-bubble-row.own .quick-reactions{left:auto;right:0}.quick-emoji-btn{width:20px;height:20px;border:none;border-radius:999px;background:transparent;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:13px;line-height:1;cursor:pointer;padding:0;transition:transform .12s ease,background .12s ease}.quick-emoji-btn:hover{background:#ffffff2e;transform:scale(1.14)}.reactions-row{display:flex;flex-wrap:wrap;gap:3px;margin-top:5px}.reaction-chip{background:#ffffff14;border:1px solid rgba(255,255,255,.2);border-radius:999px;padding:2px 7px;font-size:11px;color:#f2f6ff;cursor:pointer;transition:all .2s;display:inline-flex;align-items:center;gap:3px;max-width:180px}.reaction-chip:hover{background:#ffffff40;transform:scale(1.05)}.reaction-chip.own-reaction{background:#2a5bff4d;border-color:#2a5bff80}.empty-chat{display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;color:#9ca3af}.empty-chat mat-icon{font-size:48px;width:48px;height:48px;margin-bottom:8px}.empty-chat p{font-size:14px;margin:0}\n"], dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i4.NgForOf, selector: "[ngFor][ngForOf]", inputs: ["ngForOf", "ngForTrackBy", "ngForTemplate"] }, { kind: "directive", type: i4.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "ngmodule", type: MatIconModule }, { kind: "component", type: i5.MatIcon, selector: "mat-icon", inputs: ["color", "inline", "svgIcon", "fontSet", "fontIcon"], exportAs: ["matIcon"] }, { kind: "ngmodule", type: MatButtonModule }, { kind: "component", type: i6.MatButton, selector: "    button[mat-button], button[mat-raised-button], button[mat-flat-button],    button[mat-stroked-button]  ", exportAs: ["matButton"] }, { kind: "component", type: i6.MatIconButton, selector: "button[mat-icon-button]", exportAs: ["matButton"] }, { kind: "ngmodule", type: MatProgressSpinnerModule }, { kind: "component", type: i7.MatProgressSpinner, selector: "mat-progress-spinner, mat-spinner", inputs: ["color", "mode", "value", "diameter", "strokeWidth"], exportAs: ["matProgressSpinner"] }, { kind: "ngmodule", type: MatTooltipModule }, { kind: "directive", type: i8.MatTooltip, selector: "[matTooltip]", inputs: ["matTooltipPosition", "matTooltipPositionAtOrigin", "matTooltipDisabled", "matTooltipShowDelay", "matTooltipHideDelay", "matTooltipTouchGestures", "matTooltip", "matTooltipClass"], exportAs: ["matTooltip"] }, { kind: "component", type: MessageInputComponent, selector: "app-message-input", inputs: ["conversationId"], outputs: ["messageSent", "messageWithFiles"] }] });
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

  `, styles: [":host{--attachment-thumb-size: 180px}.chat-thread{display:flex;flex-direction:column;height:100%;background:#041322;position:relative}.chat-thread.drag-over{outline:2px dashed rgba(255,255,255,.45);outline-offset:-6px}.thread-drag-overlay{position:absolute;inset:8px;z-index:20;pointer-events:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:#fff;background:#1f4bd852;border:2px dashed rgba(255,255,255,.55);border-radius:14px;font-size:14px;font-weight:600}.thread-drag-overlay mat-icon{font-size:36px;width:36px;height:36px}.chat-header{display:flex;align-items:center;padding:8px 8px 8px 4px;border-bottom:1px solid rgba(255,255,255,.15);gap:4px;flex-shrink:0}.chat-header button mat-icon{color:#fffc}.chat-name{font-size:16px;font-weight:600;color:#fff}.header-info{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;padding:0 4px}.header-actions{display:flex;align-items:center;gap:0}.header-actions button{width:32px;height:32px;min-width:32px!important;padding:0!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;--mdc-icon-button-state-layer-size: 32px}.hdr-btn{border-radius:6px!important;transition:background .15s,box-shadow .15s}.hdr-btn:hover{background:#ffffff26!important;box-shadow:0 2px 8px #0003}.hdr-btn mat-icon{font-size:20px;width:20px;height:20px;line-height:20px;margin:0;display:flex;align-items:center;justify-content:center}:host ::ng-deep .hdr-btn .mat-mdc-button-touch-target{width:32px!important;height:32px!important}.messages-area{flex:1;overflow-y:auto;padding:12px;background:transparent;scrollbar-width:none;-ms-overflow-style:none}.messages-area::-webkit-scrollbar{display:none}.loading-indicator{display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;color:#ffffffb3;font-size:13px}.removed-group-state{height:100%;min-height:260px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:10px;padding:32px 24px;color:#ffffffc7;box-sizing:border-box}.removed-group-state mat-icon{width:44px;height:44px;font-size:44px;color:#f87171;margin-bottom:4px}.removed-group-state h4{margin:0;color:#fff;font-size:17px;font-weight:700}.removed-group-state p{margin:0 0 8px;max-width:280px;font-size:13px;line-height:1.4;color:#ffffff9e}.removed-exit-btn{border-radius:10px;background:#ffffff2e!important;color:#fff!important;font-weight:700;padding:0 18px}.load-more-btn{align-self:center;margin-bottom:16px;font-size:12px;color:#fff}.messages-list{display:flex;flex-direction:column;gap:1px;flex:1}.date-separator{text-align:center;margin:16px 0 8px;font-size:12px;color:#ffffffb3;font-weight:500}.message-bubble-row{display:flex;flex-direction:column;max-width:88%;margin-bottom:2px}.message-bubble-row.own{align-self:flex-end;align-items:flex-end}.message-bubble-row.other{align-self:flex-start;align-items:flex-start}.sender-name{font-size:11px;font-weight:700;color:#fffffff2;margin-bottom:3px;letter-spacing:.2px;padding:0 10px;text-shadow:0 1px 3px rgba(0,0,0,.4)}.system-message-row{align-self:center;max-width:88%;margin:8px auto;text-align:center}.system-message-text{display:inline-flex;align-items:center;justify-content:center;padding:5px 11px;border-radius:999px;background:#ffffff17;border:1px solid rgba(255,255,255,.12);color:#ffffffb8;font-size:11px;line-height:1.35}.message-bubble{padding:8px 14px 7px;border-radius:14px;font-size:13px;line-height:1.32;word-break:break-word;color:#f5f7ff;position:relative;display:inline-block;min-width:fit-content}.message-bubble-row.other .message-bubble{background:#0d2540;border-bottom-left-radius:5px;box-shadow:0 1px 4px #0006}.message-bubble.own-bubble{background:#0a3d62;border-bottom-right-radius:5px;box-shadow:0 1px 4px #0006}.text-content{white-space:pre-wrap;tab-size:4}.text-content.preformatted-text{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,Liberation Mono,monospace;font-size:12px;line-height:1.45;overflow-x:auto;max-width:min(72vw,520px)}.table-message-wrap{max-width:min(76vw,560px);overflow-x:auto;border-radius:9px;border:1px solid rgba(255,255,255,.16);background:#ffffff0a}.pasted-table{border-collapse:collapse;min-width:100%;font-size:12px;line-height:1.35;color:#f5f7ff}.pasted-table th,.pasted-table td{padding:6px 9px;border-right:1px solid rgba(255,255,255,.12);border-bottom:1px solid rgba(255,255,255,.12);text-align:left;white-space:pre-wrap;vertical-align:top}.pasted-table th{background:#ffffff1a;font-weight:700}.pasted-table tr:last-child td,.pasted-table tr:last-child th{border-bottom:none}.pasted-table th:last-child,.pasted-table td:last-child{border-right:none}.image-message{line-height:0}.media-wrapper{position:relative;display:inline-block;line-height:0;width:var(--attachment-thumb-size);height:var(--attachment-thumb-size);overflow:hidden;border-radius:10px;background:#ffffff14}.media-img{width:100%;height:100%;border-radius:inherit;display:block;cursor:zoom-in;object-fit:cover}.attachment-actions{position:absolute;right:6px;top:6px;display:flex;gap:4px;opacity:0;transition:opacity .12s ease;pointer-events:none}.media-wrapper:hover .attachment-actions{opacity:1;pointer-events:auto}.attachment-action-btn,.file-download-btn{border:none;border-radius:999px;background:#071d30d1;color:#fff;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0}.attachment-action-btn{width:28px;height:28px}.attachment-action-btn mat-icon{font-size:17px;width:17px;height:17px}.media-video{max-width:240px;max-height:260px;border-radius:10px;display:block;background:#000}.video-message{display:flex;flex-direction:column;gap:6px}.video-download{color:#ffffffc7;font-size:12px;text-decoration:underline;text-underline-offset:2px}.media-placeholder{display:flex;align-items:center;justify-content:center;gap:8px;width:var(--attachment-thumb-size);height:var(--attachment-thumb-size);border-radius:10px;background:#ffffff14;color:#fff9;font-size:11px}.media-load-label{font-size:11px;color:#fff9}.attachments-list{display:flex;flex-direction:column;gap:8px;max-width:100%}.attachment-item{max-width:100%}.file-message{display:flex;align-items:center;gap:8px;padding:4px 0}.attachment-thumb.file-message{position:relative;width:var(--attachment-thumb-size);height:var(--attachment-thumb-size);padding:12px;border-radius:10px;background:#ffffff14;flex-direction:column;justify-content:center;box-sizing:border-box;overflow:hidden}.file-download{display:inline-flex;align-items:center;gap:8px;color:#fff;text-decoration:none;max-width:240px}.file-msg-icon{font-size:42px;width:42px;height:42px;color:#fffc;flex-shrink:0}.file-msg-name{font-size:13px;color:#fff;line-height:1.2;max-width:100%;overflow:hidden;text-align:center;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;word-break:break-word}.file-download-icon{font-size:18px;width:18px;height:18px;color:#ffffffb3;flex-shrink:0}.file-download-btn{width:24px;height:24px;flex-shrink:0;position:absolute;right:6px;top:6px}.file-download-link{border:none;border-radius:999px;background:#ffffff29;color:#fff;cursor:pointer;font-size:11px;padding:4px 10px;margin-top:4px}.message-meta{display:flex;align-items:center;gap:4px;margin-top:3px}.msg-time{font-size:10px;color:#dae0faa8}.message-bubble-row.other .msg-time{color:#d8dff694}.read-icon{font-size:14px;width:14px;height:14px;opacity:.7}.read-icon.read{color:#60a5fa;opacity:1}.read-icon.unread{color:#dae0fa80;opacity:1}.quick-reactions{position:absolute;top:-18px;right:0;display:flex;align-items:center;gap:4px;padding:3px 5px;background:#071d30;border:1px solid rgba(255,255,255,.14);border-radius:999px;box-shadow:0 6px 14px #00000047;z-index:4}.message-bubble-row.other .quick-reactions{left:0;right:auto}.message-bubble-row.own .quick-reactions{left:auto;right:0}.quick-emoji-btn{width:20px;height:20px;border:none;border-radius:999px;background:transparent;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:13px;line-height:1;cursor:pointer;padding:0;transition:transform .12s ease,background .12s ease}.quick-emoji-btn:hover{background:#ffffff2e;transform:scale(1.14)}.reactions-row{display:flex;flex-wrap:wrap;gap:3px;margin-top:5px}.reaction-chip{background:#ffffff14;border:1px solid rgba(255,255,255,.2);border-radius:999px;padding:2px 7px;font-size:11px;color:#f2f6ff;cursor:pointer;transition:all .2s;display:inline-flex;align-items:center;gap:3px;max-width:180px}.reaction-chip:hover{background:#ffffff40;transform:scale(1.05)}.reaction-chip.own-reaction{background:#2a5bff4d;border-color:#2a5bff80}.empty-chat{display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;color:#9ca3af}.empty-chat mat-icon{font-size:48px;width:48px;height:48px;margin-bottom:8px}.empty-chat p{font-size:14px;margin:0}\n"] }]
        }], ctorParameters: () => [{ type: i1.MessagingStoreService }, { type: i2.AuthService }, { type: i3.MessagingFileService }, { type: i0.ChangeDetectorRef }], propDecorators: { scrollContainer: [{
                type: ViewChild,
                args: ['scrollContainer']
            }], messageInput: [{
                type: ViewChild,
                args: [MessageInputComponent]
            }], lightboxOpen: [{
                type: Output
            }] } });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdC10aHJlYWQuY29tcG9uZW50LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL2xpYi9jb21wb25lbnRzL2NoYXQtdGhyZWFkL2NoYXQtdGhyZWFkLmNvbXBvbmVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQ0wsU0FBUyxFQUFxQixTQUFTLEVBQ3ZDLE1BQU0sRUFBRSxZQUFZLEdBQ3JCLE1BQU0sZUFBZSxDQUFDO0FBQ3ZCLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUMvQyxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sd0JBQXdCLENBQUM7QUFDdkQsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBQzNELE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQzlFLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBQzdELE9BQU8sRUFBZ0IsYUFBYSxFQUFFLE1BQU0sTUFBTSxDQUFDO0FBSW5ELE9BQU8sRUFBZ0MscUJBQXFCLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUMxSCxPQUFPLEVBQUUscUJBQXFCLEVBQWtCLE1BQU0sMENBQTBDLENBQUM7Ozs7Ozs7Ozs7QUFxNEJqRyxNQUFNLE9BQU8sbUJBQW1CO0lBaUNwQjtJQUNBO0lBQ0E7SUFDQTtJQW5Db0IsZUFBZSxDQUFjO0lBQ3pCLFlBQVksQ0FBeUI7SUFDN0QsWUFBWSxHQUFHLElBQUksWUFBWSxFQUFVLENBQUM7SUFFcEQsUUFBUSxHQUFjLEVBQUUsQ0FBQztJQUN6QixlQUFlLEdBQWMsRUFBRSxDQUFDO0lBQ2hDLGdCQUFnQixHQUFHLEVBQUUsQ0FBQztJQUN0QixPQUFPLEdBQUcsS0FBSyxDQUFDO0lBQ2hCLGtCQUFrQixHQUFHLEtBQUssQ0FBQztJQUMzQixPQUFPLEdBQUcsS0FBSyxDQUFDO0lBQ2hC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Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBME9ULDB2UkE3T0MsWUFBWSwrUEFBRSxhQUFhLG1MQUFFLGVBQWUsd1VBQzVDLHdCQUF3QixrT0FBRSxnQkFBZ0IsNlRBQUUscUJBQXFCOzs0RkE4M0J4RCxtQkFBbUI7a0JBbjRCL0IsU0FBUzsrQkFDRSxpQkFBaUIsY0FDZixJQUFJLFdBQ1A7d0JBQ1AsWUFBWSxFQUFFLGFBQWEsRUFBRSxlQUFlO3dCQUM1Qyx3QkFBd0IsRUFBRSxnQkFBZ0IsRUFBRSxxQkFBcUI7cUJBQ2xFLFlBQ1M7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQTBPVDt1TEFtcEI2QixlQUFlO3NCQUE1QyxTQUFTO3VCQUFDLGlCQUFpQjtnQkFDTSxZQUFZO3NCQUE3QyxTQUFTO3VCQUFDLHFCQUFxQjtnQkFDdEIsWUFBWTtzQkFBckIsTUFBTSIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7XHJcbiAgQ29tcG9uZW50LCBPbkluaXQsIE9uRGVzdHJveSwgVmlld0NoaWxkLCBFbGVtZW50UmVmLCBBZnRlclZpZXdDaGVja2VkLCBDaGFuZ2VEZXRlY3RvclJlZixcclxuICBPdXRwdXQsIEV2ZW50RW1pdHRlcixcclxufSBmcm9tICdAYW5ndWxhci9jb3JlJztcclxuaW1wb3J0IHsgQ29tbW9uTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvY29tbW9uJztcclxuaW1wb3J0IHsgTWF0SWNvbk1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL21hdGVyaWFsL2ljb24nO1xyXG5pbXBvcnQgeyBNYXRCdXR0b25Nb2R1bGUgfSBmcm9tICdAYW5ndWxhci9tYXRlcmlhbC9idXR0b24nO1xyXG5pbXBvcnQgeyBNYXRQcm9ncmVzc1NwaW5uZXJNb2R1bGUgfSBmcm9tICdAYW5ndWxhci9tYXRlcmlhbC9wcm9ncmVzcy1zcGlubmVyJztcclxuaW1wb3J0IHsgTWF0VG9vbHRpcE1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL21hdGVyaWFsL3Rvb2x0aXAnO1xyXG5pbXBvcnQgeyBTdWJzY3JpcHRpb24sIGNvbWJpbmVMYXRlc3QgfSBmcm9tICdyeGpzJztcclxuaW1wb3J0IHsgTWVzc2FnaW5nU3RvcmVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvbWVzc2FnaW5nLXN0b3JlLnNlcnZpY2UnO1xyXG5pbXBvcnQgeyBNZXNzYWdpbmdGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL21lc3NhZ2luZy1maWxlLnNlcnZpY2UnO1xyXG5pbXBvcnQgeyBBdXRoU2VydmljZSB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL2F1dGguc2VydmljZSc7XHJcbmltcG9ydCB7IENvbnRhY3QsIE1lc3NhZ2UsIEF0dGFjaG1lbnQsIGdldENvbnRhY3REaXNwbGF5TmFtZSwgZ2V0TWVzc2FnZVNlbmRlck5hbWUgfSBmcm9tICcuLi8uLi9tb2RlbHMvbWVzc2FnaW5nLm1vZGVscyc7XHJcbmltcG9ydCB7IE1lc3NhZ2VJbnB1dENvbXBvbmVudCwgTWVzc2FnZVBheWxvYWQgfSBmcm9tICcuLi9tZXNzYWdlLWlucHV0L21lc3NhZ2UtaW5wdXQuY29tcG9uZW50JztcclxuXHJcbkBDb21wb25lbnQoe1xyXG4gIHNlbGVjdG9yOiAnYXBwLWNoYXQtdGhyZWFkJyxcclxuICBzdGFuZGFsb25lOiB0cnVlLFxyXG4gIGltcG9ydHM6IFtcclxuICAgIENvbW1vbk1vZHVsZSwgTWF0SWNvbk1vZHVsZSwgTWF0QnV0dG9uTW9kdWxlLFxyXG4gICAgTWF0UHJvZ3Jlc3NTcGlubmVyTW9kdWxlLCBNYXRUb29sdGlwTW9kdWxlLCBNZXNzYWdlSW5wdXRDb21wb25lbnQsXHJcbiAgXSxcclxuICB0ZW1wbGF0ZTogYFxyXG4gICAgPGRpdlxyXG4gICAgICBjbGFzcz1cImNoYXQtdGhyZWFkXCJcclxuICAgICAgW2NsYXNzLmRyYWctb3Zlcl09XCJ0aHJlYWREcmFnT3ZlclwiXHJcbiAgICAgIChkcmFnZW50ZXIpPVwib25UaHJlYWREcmFnRW50ZXIoJGV2ZW50KVwiXHJcbiAgICAgIChkcmFnb3Zlcik9XCJvblRocmVhZERyYWdPdmVyKCRldmVudClcIlxyXG4gICAgICAoZHJhZ2xlYXZlKT1cIm9uVGhyZWFkRHJhZ0xlYXZlKCRldmVudClcIlxyXG4gICAgICAoZHJvcCk9XCJvblRocmVhZERyb3AoJGV2ZW50KVwiXHJcbiAgICA+XHJcbiAgICAgIDxkaXYgY2xhc3M9XCJjaGF0LWhlYWRlclwiPlxyXG4gICAgICAgIDxidXR0b24gbWF0LWljb24tYnV0dG9uIGNsYXNzPVwiaGRyLWJ0blwiIChjbGljayk9XCJnb0JhY2soKVwiIG1hdFRvb2x0aXA9XCJCYWNrXCIgbWF0VG9vbHRpcFBvc2l0aW9uPVwiYmVsb3dcIj5cclxuICAgICAgICAgIDxtYXQtaWNvbj5hcnJvd19iYWNrPC9tYXQtaWNvbj5cclxuICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICA8ZGl2IGNsYXNzPVwiaGVhZGVyLWluZm9cIj5cclxuICAgICAgICAgIDxzcGFuIGNsYXNzPVwiY2hhdC1uYW1lXCI+e3sgY29udmVyc2F0aW9uTmFtZSB9fTwvc3Bhbj5cclxuICAgICAgICA8L2Rpdj5cclxuICAgICAgICA8ZGl2IGNsYXNzPVwiaGVhZGVyLWFjdGlvbnNcIj5cclxuICAgICAgICAgIDxidXR0b24gKm5nSWY9XCJpc0dyb3VwICYmICFpc1JlbW92ZWRGcm9tR3JvdXBcIiBtYXQtaWNvbi1idXR0b24gY2xhc3M9XCJoZHItYnRuXCIgKGNsaWNrKT1cIm9uR3JvdXBTZXR0aW5ncygpXCIgbWF0VG9vbHRpcD1cIkdyb3VwIHNldHRpbmdzXCIgbWF0VG9vbHRpcFBvc2l0aW9uPVwiYmVsb3dcIj5cclxuICAgICAgICAgICAgPG1hdC1pY29uPnNldHRpbmdzPC9tYXQtaWNvbj5cclxuICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgIDwvZGl2PlxyXG4gICAgICA8L2Rpdj5cclxuXHJcbiAgICAgIDxkaXYgY2xhc3M9XCJtZXNzYWdlcy1hcmVhXCIgI3Njcm9sbENvbnRhaW5lciAoc2Nyb2xsKT1cIm9uU2Nyb2xsKClcIj5cclxuICAgICAgICA8ZGl2ICpuZ0lmPVwidGhyZWFkRHJhZ092ZXJcIiBjbGFzcz1cInRocmVhZC1kcmFnLW92ZXJsYXlcIj5cclxuICAgICAgICAgIDxtYXQtaWNvbj5jbG91ZF91cGxvYWQ8L21hdC1pY29uPlxyXG4gICAgICAgICAgPHNwYW4+RHJvcCBmaWxlcyBhbnl3aGVyZSBpbiB0aGlzIGNoYXQ8L3NwYW4+XHJcbiAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgIDxkaXYgKm5nSWY9XCJpc1JlbW92ZWRGcm9tR3JvdXBcIiBjbGFzcz1cInJlbW92ZWQtZ3JvdXAtc3RhdGVcIj5cclxuICAgICAgICAgIDxtYXQtaWNvbj5ibG9jazwvbWF0LWljb24+XHJcbiAgICAgICAgICA8aDQ+WW91IHdlcmUgcmVtb3ZlZCBmcm9tIHRoaXMgZ3JvdXA8L2g0PlxyXG4gICAgICAgICAgPHA+TWVzc2FnZXMsIGF0dGFjaG1lbnRzLCBhbmQgZ3JvdXAgc2V0dGluZ3MgYXJlIG5vIGxvbmdlciBhdmFpbGFibGUuPC9wPlxyXG4gICAgICAgICAgPGJ1dHRvbiB0eXBlPVwiYnV0dG9uXCIgbWF0LXJhaXNlZC1idXR0b24gY2xhc3M9XCJyZW1vdmVkLWV4aXQtYnRuXCIgKGNsaWNrKT1cImV4aXRSZW1vdmVkR3JvdXAoKVwiPlxyXG4gICAgICAgICAgICBFeGl0IEdyb3VwXHJcbiAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgPGRpdiAqbmdJZj1cIiFpc1JlbW92ZWRGcm9tR3JvdXAgJiYgbG9hZGluZ1wiIGNsYXNzPVwibG9hZGluZy1pbmRpY2F0b3JcIj5cclxuICAgICAgICAgIDxtYXQtc3Bpbm5lciBkaWFtZXRlcj1cIjI0XCI+PC9tYXQtc3Bpbm5lcj5cclxuICAgICAgICAgIDxzcGFuPkxvYWRpbmcgbWVzc2FnZXMuLi48L3NwYW4+XHJcbiAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgIDxidXR0b25cclxuICAgICAgICAgICpuZ0lmPVwiIWlzUmVtb3ZlZEZyb21Hcm91cCAmJiBtZXNzYWdlcy5sZW5ndGggPj0gNTAgJiYgIWxvYWRpbmdcIlxyXG4gICAgICAgICAgbWF0LXN0cm9rZWQtYnV0dG9uXHJcbiAgICAgICAgICBjbGFzcz1cImxvYWQtbW9yZS1idG5cIlxyXG4gICAgICAgICAgKGNsaWNrKT1cImxvYWRPbGRlcigpXCJcclxuICAgICAgICA+XHJcbiAgICAgICAgICBMb2FkIG9sZGVyIG1lc3NhZ2VzXHJcbiAgICAgICAgPC9idXR0b24+XHJcblxyXG4gICAgICAgIDxkaXYgKm5nSWY9XCIhaXNSZW1vdmVkRnJvbUdyb3VwXCIgY2xhc3M9XCJtZXNzYWdlcy1saXN0XCI+XHJcbiAgICAgICAgICA8bmctY29udGFpbmVyICpuZ0Zvcj1cImxldCBtc2cgb2YgbWVzc2FnZXM7IGxldCBpID0gaW5kZXhcIj5cclxuICAgICAgICAgICAgPGRpdlxyXG4gICAgICAgICAgICAgICpuZ0lmPVwic2hvdWxkU2hvd0RhdGVTZXBhcmF0b3IoaSlcIlxyXG4gICAgICAgICAgICAgIGNsYXNzPVwiZGF0ZS1zZXBhcmF0b3JcIlxyXG4gICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgPHNwYW4+e3sgZm9ybWF0RGF0ZShtc2cuY3JlYXRlZF9hdCkgfX08L3NwYW4+XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgICAgPGRpdlxyXG4gICAgICAgICAgICAgICpuZ0lmPVwiaXNTeXN0ZW1NZXNzYWdlKG1zZyk7IGVsc2UgY2hhdE1lc3NhZ2VcIlxyXG4gICAgICAgICAgICAgIGNsYXNzPVwic3lzdGVtLW1lc3NhZ2Utcm93XCJcclxuICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwic3lzdGVtLW1lc3NhZ2UtdGV4dFwiPnt7IG1zZy5jb250ZW50IH19PC9zcGFuPlxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgICAgIDxuZy10ZW1wbGF0ZSAjY2hhdE1lc3NhZ2U+XHJcbiAgICAgICAgICAgICAgPGRpdlxyXG4gICAgICAgICAgICAgICAgY2xhc3M9XCJtZXNzYWdlLWJ1YmJsZS1yb3dcIlxyXG4gICAgICAgICAgICAgIFtjbGFzcy5vd25dPVwiaXNPd25NZXNzYWdlKG1zZylcIlxyXG4gICAgICAgICAgICAgIFtjbGFzcy5vdGhlcl09XCIhaXNPd25NZXNzYWdlKG1zZylcIlxyXG4gICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgPGRpdiAqbmdJZj1cIiFpc093bk1lc3NhZ2UobXNnKVwiIGNsYXNzPVwic2VuZGVyLW5hbWVcIj5cclxuICAgICAgICAgICAgICAgIHt7IGdldFNlbmRlck5hbWUobXNnKSB9fVxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJtZXNzYWdlLWJ1YmJsZVwiIFtjbGFzcy5vd24tYnViYmxlXT1cImlzT3duTWVzc2FnZShtc2cpXCIgKG1vdXNlZW50ZXIpPVwiaG92ZXJlZE1lc3NhZ2VJZCA9IG1zZy5tZXNzYWdlX2lkXCIgKG1vdXNlbGVhdmUpPVwiaG92ZXJlZE1lc3NhZ2VJZCA9IG51bGxcIj5cclxuICAgICAgICAgICAgICAgIDwhLS0gQVRUQUNITUVOVFMg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAIC0tPlxyXG4gICAgICAgICAgICAgICAgPGRpdiAqbmdJZj1cImhhc0ZpbGVBdHRhY2htZW50KG1zZylcIiBjbGFzcz1cImF0dGFjaG1lbnRzLWxpc3RcIj5cclxuICAgICAgICAgICAgICAgICAgPGRpdiAqbmdGb3I9XCJsZXQgYXR0YWNobWVudCBvZiBnZXRSZW5kZXJhYmxlQXR0YWNobWVudHMobXNnKTsgdHJhY2tCeTogdHJhY2tCeUF0dGFjaG1lbnRcIiBjbGFzcz1cImF0dGFjaG1lbnQtaXRlbVwiPlxyXG4gICAgICAgICAgICAgICAgICAgIDxuZy1jb250YWluZXIgKm5nSWY9XCJpc0ltYWdlQXR0YWNobWVudChtc2csIGF0dGFjaG1lbnQpOyBlbHNlIG5vbkltYWdlQXR0YWNobWVudFwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImltYWdlLW1lc3NhZ2VcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPG5nLWNvbnRhaW5lciAqbmdJZj1cImdldE1lZGlhVXJsKG1zZywgYXR0YWNobWVudCkgYXMgZGF0YVVybDsgZWxzZSBpbWdGYWxsYmFja1wiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJtZWRpYS13cmFwcGVyXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8aW1nXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFtzcmNdPVwiZGF0YVVybFwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFsdD1cIkltYWdlXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3M9XCJtZWRpYS1pbWdcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAobW91c2Vkb3duKT1cIiRldmVudC5zdG9wUHJvcGFnYXRpb24oKVwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIChjbGljayk9XCJvcGVuTGlnaHRib3goZGF0YVVybCwgJGV2ZW50KVwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImF0dGFjaG1lbnQtYWN0aW9uc1wiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8YnV0dG9uXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZT1cImJ1dHRvblwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3M9XCJhdHRhY2htZW50LWFjdGlvbi1idG5cIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIChjbGljayk9XCJvcGVuTGlnaHRib3goZGF0YVVybCwgJGV2ZW50KVwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGl0bGU9XCJPcGVuIGltYWdlXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxtYXQtaWNvbj5vcGVuX2luX2Z1bGw8L21hdC1pY29uPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzPVwiYXR0YWNobWVudC1hY3Rpb24tYnRuXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAoY2xpY2spPVwiZG93bmxvYWRBdHRhY2htZW50KG1zZywgYXR0YWNobWVudCwgJGV2ZW50KVwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGl0bGU9XCJEb3dubG9hZCBpbWFnZVwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8bWF0LWljb24+ZG93bmxvYWQ8L21hdC1pY29uPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8L25nLWNvbnRhaW5lcj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPG5nLXRlbXBsYXRlICNpbWdGYWxsYmFjaz5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2ICpuZ0lmPVwic2hvdWxkU2hvd01lZGlhU3Bpbm5lcihhdHRhY2htZW50KTsgZWxzZSBpbWdBc0ZpbGVcIiBjbGFzcz1cIm1lZGlhLXBsYWNlaG9sZGVyXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8bWF0LXNwaW5uZXIgZGlhbWV0ZXI9XCIyMlwiPjwvbWF0LXNwaW5uZXI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPG5nLXRlbXBsYXRlICNpbWdBc0ZpbGU+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmlsZS1tZXNzYWdlXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxtYXQtaWNvbiBjbGFzcz1cImZpbGUtbXNnLWljb25cIj5pbWFnZTwvbWF0LWljb24+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwiZmlsZS1tc2ctbmFtZVwiPnt7IGdldEF0dGFjaG1lbnROYW1lKG1zZywgYXR0YWNobWVudCkgfX08L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8L25nLXRlbXBsYXRlPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8L25nLXRlbXBsYXRlPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgPC9uZy1jb250YWluZXI+XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIDxuZy10ZW1wbGF0ZSAjbm9uSW1hZ2VBdHRhY2htZW50PlxyXG4gICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZpbGUtbWVzc2FnZSBhdHRhY2htZW50LXRodW1iXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxidXR0b25cclxuICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICBjbGFzcz1cImZpbGUtZG93bmxvYWQtYnRuXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAoY2xpY2spPVwiZG93bmxvYWRBdHRhY2htZW50KG1zZywgYXR0YWNobWVudCwgJGV2ZW50KVwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgdGl0bGU9XCJEb3dubG9hZCBmaWxlXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxtYXQtaWNvbiBjbGFzcz1cImZpbGUtZG93bmxvYWQtaWNvblwiPmRvd25sb2FkPC9tYXQtaWNvbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxtYXQtaWNvbiBjbGFzcz1cImZpbGUtbXNnLWljb25cIj57eyBnZXRGaWxlSWNvbihtc2csIGF0dGFjaG1lbnQpIH19PC9tYXQtaWNvbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJmaWxlLW1zZy1uYW1lXCIgW3RpdGxlXT1cImdldEF0dGFjaG1lbnROYW1lKG1zZywgYXR0YWNobWVudClcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICB7eyBnZXRBdHRhY2htZW50TmFtZShtc2csIGF0dGFjaG1lbnQpIH19XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzPVwiZmlsZS1kb3dubG9hZC1saW5rXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAoY2xpY2spPVwiZG93bmxvYWRBdHRhY2htZW50KG1zZywgYXR0YWNobWVudCwgJGV2ZW50KVwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgdGl0bGU9XCJEb3dubG9hZCBmaWxlXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIERvd25sb2FkXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgPC9uZy10ZW1wbGF0ZT5cclxuICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgIDxuZy1jb250YWluZXIgKm5nSWY9XCJtc2cubWVzc2FnZV90eXBlID09PSAnVEVYVCcgJiYgIWhhc0ZpbGVBdHRhY2htZW50KG1zZylcIj5cclxuICAgICAgICAgICAgICAgICAgPGRpdiAqbmdJZj1cImlzVGFibGVUZXh0KG1zZyk7IGVsc2UgcGxhaW5UZXh0TWVzc2FnZVwiIGNsYXNzPVwidGFibGUtbWVzc2FnZS13cmFwXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgPHRhYmxlIGNsYXNzPVwicGFzdGVkLXRhYmxlXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8dGJvZHk+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ciAqbmdGb3I9XCJsZXQgcm93IG9mIGdldFRhYmxlUm93cyhtc2cpOyBsZXQgcm93SW5kZXggPSBpbmRleFwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxuZy1jb250YWluZXIgKm5nRm9yPVwibGV0IGNlbGwgb2Ygcm93XCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dGggKm5nSWY9XCJyb3dJbmRleCA9PT0gMDsgZWxzZSB0YWJsZUNlbGxcIj57eyBjZWxsIH19PC90aD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxuZy10ZW1wbGF0ZSAjdGFibGVDZWxsPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dGQ+e3sgY2VsbCB9fTwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L25nLXRlbXBsYXRlPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDwvbmctY29udGFpbmVyPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8L3RyPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPC90Ym9keT5cclxuICAgICAgICAgICAgICAgICAgICA8L3RhYmxlPlxyXG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgPG5nLXRlbXBsYXRlICNwbGFpblRleHRNZXNzYWdlPlxyXG4gICAgICAgICAgICAgICAgICAgIDxkaXZcclxuICAgICAgICAgICAgICAgICAgICAgIGNsYXNzPVwidGV4dC1jb250ZW50XCJcclxuICAgICAgICAgICAgICAgICAgICAgIFtjbGFzcy5wcmVmb3JtYXR0ZWQtdGV4dF09XCJpc1ByZWZvcm1hdHRlZFRleHQobXNnKVwiXHJcbiAgICAgICAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgICAgICAge3sgbXNnLmNvbnRlbnQgfX1cclxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgPC9uZy10ZW1wbGF0ZT5cclxuICAgICAgICAgICAgICAgIDwvbmctY29udGFpbmVyPlxyXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cIm1lc3NhZ2UtbWV0YVwiPlxyXG4gICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cIm1zZy10aW1lXCI+e3sgZm9ybWF0VGltZShtc2cuY3JlYXRlZF9hdCkgfX08L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgIDxtYXQtaWNvblxyXG4gICAgICAgICAgICAgICAgICAgICpuZ0lmPVwiaXNPd25NZXNzYWdlKG1zZykgJiYgaXNNZXNzYWdlUmVhZChtc2cpXCJcclxuICAgICAgICAgICAgICAgICAgICBjbGFzcz1cInJlYWQtaWNvbiByZWFkXCJcclxuICAgICAgICAgICAgICAgICAgICBbbWF0VG9vbHRpcF09XCJnZXRSZWFkVG9vbHRpcChtc2cpXCJcclxuICAgICAgICAgICAgICAgICAgICBtYXRUb29sdGlwUG9zaXRpb249XCJhYm92ZVwiXHJcbiAgICAgICAgICAgICAgICAgID5kb25lX2FsbDwvbWF0LWljb24+XHJcbiAgICAgICAgICAgICAgICAgIDxtYXQtaWNvblxyXG4gICAgICAgICAgICAgICAgICAgICpuZ0lmPVwiaXNPd25NZXNzYWdlKG1zZykgJiYgIWlzTWVzc2FnZVJlYWQobXNnKVwiXHJcbiAgICAgICAgICAgICAgICAgICAgY2xhc3M9XCJyZWFkLWljb24gdW5yZWFkXCJcclxuICAgICAgICAgICAgICAgICAgICBtYXRUb29sdGlwPVwiU2VudFwiXHJcbiAgICAgICAgICAgICAgICAgICAgbWF0VG9vbHRpcFBvc2l0aW9uPVwiYWJvdmVcIlxyXG4gICAgICAgICAgICAgICAgICA+ZG9uZTwvbWF0LWljb24+XHJcbiAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgIDxkaXYgKm5nSWY9XCJob3ZlcmVkTWVzc2FnZUlkID09PSBtc2cubWVzc2FnZV9pZFwiIGNsYXNzPVwicXVpY2stcmVhY3Rpb25zXCI+XHJcbiAgICAgICAgICAgICAgICAgIDxidXR0b25cclxuICAgICAgICAgICAgICAgICAgICAqbmdGb3I9XCJsZXQgZW1vamkgb2YgcXVpY2tFbW9qaXNcIlxyXG4gICAgICAgICAgICAgICAgICAgIGNsYXNzPVwicXVpY2stZW1vamktYnRuXCJcclxuICAgICAgICAgICAgICAgICAgICAoY2xpY2spPVwib25FbW9qaVNlbGVjdGVkKGVtb2ppLCBtc2cubWVzc2FnZV9pZClcIlxyXG4gICAgICAgICAgICAgICAgICAgIFthdHRyLmFyaWEtbGFiZWxdPVwiJ1JlYWN0IHdpdGggJyArIGVtb2ppXCJcclxuICAgICAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgICAgIHt7IGVtb2ppIH19XHJcbiAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICA8ZGl2ICpuZ0lmPVwibXNnLnJlYWN0aW9ucyAmJiBtc2cucmVhY3Rpb25zLmxlbmd0aCA+IDBcIiBjbGFzcz1cInJlYWN0aW9ucy1yb3dcIj5cclxuICAgICAgICAgICAgICAgICAgPGJ1dHRvbiBcclxuICAgICAgICAgICAgICAgICAgICAqbmdGb3I9XCJsZXQgciBvZiBtc2cucmVhY3Rpb25zXCIgXHJcbiAgICAgICAgICAgICAgICAgICAgY2xhc3M9XCJyZWFjdGlvbi1jaGlwXCJcclxuICAgICAgICAgICAgICAgICAgICAoY2xpY2spPVwidG9nZ2xlUmVhY3Rpb24oci5lbW9qaSwgbXNnLm1lc3NhZ2VfaWQpXCJcclxuICAgICAgICAgICAgICAgICAgICBbY2xhc3Mub3duLXJlYWN0aW9uXT1cInIuaGFzUmVhY3RlZFwiXHJcbiAgICAgICAgICAgICAgICAgICAgW21hdFRvb2x0aXBdPVwiZ2V0UmVhY3RvclRvb2x0aXAocilcIlxyXG4gICAgICAgICAgICAgICAgICAgIG1hdFRvb2x0aXBQb3NpdGlvbj1cImFib3ZlXCJcclxuICAgICAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwicmVhY3Rpb24tZW1vamlcIj57eyByLmVtb2ppIH19PC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwicmVhY3Rpb24tY291bnRcIj57eyByLmNvdW50IH19PC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICA8L25nLXRlbXBsYXRlPlxyXG4gICAgICAgICAgPC9uZy1jb250YWluZXI+XHJcbiAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgIDxkaXYgKm5nSWY9XCIhaXNSZW1vdmVkRnJvbUdyb3VwICYmIG1lc3NhZ2VzLmxlbmd0aCA9PT0gMCAmJiAhbG9hZGluZ1wiIGNsYXNzPVwiZW1wdHktY2hhdFwiPlxyXG4gICAgICAgICAgPG1hdC1pY29uPmNoYXRfYnViYmxlX291dGxpbmU8L21hdC1pY29uPlxyXG4gICAgICAgICAgPHA+Tm8gbWVzc2FnZXMgeWV0LiBTYXkgaGVsbG8hPC9wPlxyXG4gICAgICAgIDwvZGl2PlxyXG4gICAgICA8L2Rpdj5cclxuXHJcbiAgICAgIDxhcHAtbWVzc2FnZS1pbnB1dFxyXG4gICAgICAgICpuZ0lmPVwiIWlzUmVtb3ZlZEZyb21Hcm91cFwiXHJcbiAgICAgICAgW2NvbnZlcnNhdGlvbklkXT1cImNvbnZlcnNhdGlvbklkXCJcclxuICAgICAgICAobWVzc2FnZVNlbnQpPVwib25TZW5kTWVzc2FnZSgkZXZlbnQpXCJcclxuICAgICAgICAobWVzc2FnZVdpdGhGaWxlcyk9XCJvblNlbmRXaXRoRmlsZXMoJGV2ZW50KVwiXHJcbiAgICAgID48L2FwcC1tZXNzYWdlLWlucHV0PlxyXG4gICAgPC9kaXY+XHJcblxyXG4gIGAsXHJcbiAgc3R5bGVzOiBbYFxyXG4gICAgOmhvc3Qge1xyXG4gICAgICAtLWF0dGFjaG1lbnQtdGh1bWItc2l6ZTogMTgwcHg7XHJcbiAgICB9XHJcblxyXG4gICAgLmNoYXQtdGhyZWFkIHtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcclxuICAgICAgaGVpZ2h0OiAxMDAlO1xyXG4gICAgICBiYWNrZ3JvdW5kOiAjMDQxMzIyO1xyXG4gICAgICBwb3NpdGlvbjogcmVsYXRpdmU7XHJcbiAgICB9XHJcblxyXG4gICAgLmNoYXQtdGhyZWFkLmRyYWctb3ZlciB7XHJcbiAgICAgIG91dGxpbmU6IDJweCBkYXNoZWQgcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjQ1KTtcclxuICAgICAgb3V0bGluZS1vZmZzZXQ6IC02cHg7XHJcbiAgICB9XHJcblxyXG4gICAgLnRocmVhZC1kcmFnLW92ZXJsYXkge1xyXG4gICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XHJcbiAgICAgIGluc2V0OiA4cHg7XHJcbiAgICAgIHotaW5kZXg6IDIwO1xyXG4gICAgICBwb2ludGVyLWV2ZW50czogbm9uZTtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XHJcbiAgICAgIGdhcDogOHB4O1xyXG4gICAgICBjb2xvcjogI2ZmZjtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgzMSwgNzUsIDIxNiwgMC4zMik7XHJcbiAgICAgIGJvcmRlcjogMnB4IGRhc2hlZCByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNTUpO1xyXG4gICAgICBib3JkZXItcmFkaXVzOiAxNHB4O1xyXG4gICAgICBmb250LXNpemU6IDE0cHg7XHJcbiAgICAgIGZvbnQtd2VpZ2h0OiA2MDA7XHJcbiAgICB9XHJcblxyXG4gICAgLnRocmVhZC1kcmFnLW92ZXJsYXkgbWF0LWljb24ge1xyXG4gICAgICBmb250LXNpemU6IDM2cHg7XHJcbiAgICAgIHdpZHRoOiAzNnB4O1xyXG4gICAgICBoZWlnaHQ6IDM2cHg7XHJcbiAgICB9XHJcblxyXG4gICAgLmNoYXQtaGVhZGVyIHtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAgcGFkZGluZzogOHB4IDhweCA4cHggNHB4O1xyXG4gICAgICBib3JkZXItYm90dG9tOiAxcHggc29saWQgcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjE1KTtcclxuICAgICAgZ2FwOiA0cHg7XHJcbiAgICAgIGZsZXgtc2hyaW5rOiAwO1xyXG4gICAgfVxyXG5cclxuICAgIC5jaGF0LWhlYWRlciBidXR0b24gbWF0LWljb24ge1xyXG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjgpO1xyXG4gICAgfVxyXG5cclxuICAgIC5jaGF0LW5hbWUge1xyXG4gICAgICBmb250LXNpemU6IDE2cHg7XHJcbiAgICAgIGZvbnQtd2VpZ2h0OiA2MDA7XHJcbiAgICAgIGNvbG9yOiAjZmZmO1xyXG4gICAgfVxyXG5cclxuICAgIC5oZWFkZXItaW5mbyB7XHJcbiAgICAgIGZsZXg6IDE7XHJcbiAgICAgIHdoaXRlLXNwYWNlOiBub3dyYXA7XHJcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XHJcbiAgICAgIHRleHQtb3ZlcmZsb3c6IGVsbGlwc2lzO1xyXG4gICAgICBkaXNwbGF5OiBibG9jaztcclxuICAgICAgcGFkZGluZzogMCA0cHg7XHJcbiAgICB9XHJcblxyXG4gICAgLmhlYWRlci1hY3Rpb25zIHtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAgZ2FwOiAwO1xyXG4gICAgfVxyXG5cclxuICAgIC5oZWFkZXItYWN0aW9ucyBidXR0b24ge1xyXG4gICAgICB3aWR0aDogMzJweDtcclxuICAgICAgaGVpZ2h0OiAzMnB4O1xyXG4gICAgICBtaW4td2lkdGg6IDMycHggIWltcG9ydGFudDtcclxuICAgICAgcGFkZGluZzogMCAhaW1wb3J0YW50O1xyXG4gICAgICBkaXNwbGF5OiBpbmxpbmUtZmxleCAhaW1wb3J0YW50O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyICFpbXBvcnRhbnQ7XHJcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyICFpbXBvcnRhbnQ7XHJcbiAgICAgIC0tbWRjLWljb24tYnV0dG9uLXN0YXRlLWxheWVyLXNpemU6IDMycHg7XHJcbiAgICB9XHJcblxyXG4gICAgLmhkci1idG4ge1xyXG4gICAgICBib3JkZXItcmFkaXVzOiA2cHggIWltcG9ydGFudDtcclxuICAgICAgdHJhbnNpdGlvbjogYmFja2dyb3VuZCAwLjE1cywgYm94LXNoYWRvdyAwLjE1cztcclxuICAgIH1cclxuXHJcbiAgICAuaGRyLWJ0bjpob3ZlciB7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xNSkgIWltcG9ydGFudDtcclxuICAgICAgYm94LXNoYWRvdzogMCAycHggOHB4IHJnYmEoMCwgMCwgMCwgMC4yKTtcclxuICAgIH1cclxuXHJcbiAgICAuaGRyLWJ0biBtYXQtaWNvbiB7XHJcbiAgICAgIGZvbnQtc2l6ZTogMjBweDtcclxuICAgICAgd2lkdGg6IDIwcHg7XHJcbiAgICAgIGhlaWdodDogMjBweDtcclxuICAgICAgbGluZS1oZWlnaHQ6IDIwcHg7XHJcbiAgICAgIG1hcmdpbjogMDtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XHJcbiAgICB9XHJcblxyXG4gICAgOmhvc3QgOjpuZy1kZWVwIC5oZHItYnRuIC5tYXQtbWRjLWJ1dHRvbi10b3VjaC10YXJnZXQge1xyXG4gICAgICB3aWR0aDogMzJweCAhaW1wb3J0YW50O1xyXG4gICAgICBoZWlnaHQ6IDMycHggIWltcG9ydGFudDtcclxuICAgIH1cclxuXHJcbiAgICAubWVzc2FnZXMtYXJlYSB7XHJcbiAgICAgIGZsZXg6IDE7XHJcbiAgICAgIG92ZXJmbG93LXk6IGF1dG87XHJcbiAgICAgIHBhZGRpbmc6IDEycHg7XHJcbiAgICAgIGJhY2tncm91bmQ6IHRyYW5zcGFyZW50O1xyXG4gICAgICBzY3JvbGxiYXItd2lkdGg6IG5vbmU7XHJcbiAgICAgIC1tcy1vdmVyZmxvdy1zdHlsZTogbm9uZTtcclxuICAgIH1cclxuXHJcbiAgICAubWVzc2FnZXMtYXJlYTo6LXdlYmtpdC1zY3JvbGxiYXIge1xyXG4gICAgICBkaXNwbGF5OiBub25lO1xyXG4gICAgfVxyXG5cclxuICAgIC5sb2FkaW5nLWluZGljYXRvciB7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xyXG4gICAgICBnYXA6IDhweDtcclxuICAgICAgcGFkZGluZzogMTJweDtcclxuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC43KTtcclxuICAgICAgZm9udC1zaXplOiAxM3B4O1xyXG4gICAgfVxyXG5cclxuICAgIC5yZW1vdmVkLWdyb3VwLXN0YXRlIHtcclxuICAgICAgaGVpZ2h0OiAxMDAlO1xyXG4gICAgICBtaW4taGVpZ2h0OiAyNjBweDtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XHJcbiAgICAgIHRleHQtYWxpZ246IGNlbnRlcjtcclxuICAgICAgZ2FwOiAxMHB4O1xyXG4gICAgICBwYWRkaW5nOiAzMnB4IDI0cHg7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNzgpO1xyXG4gICAgICBib3gtc2l6aW5nOiBib3JkZXItYm94O1xyXG4gICAgfVxyXG5cclxuICAgIC5yZW1vdmVkLWdyb3VwLXN0YXRlIG1hdC1pY29uIHtcclxuICAgICAgd2lkdGg6IDQ0cHg7XHJcbiAgICAgIGhlaWdodDogNDRweDtcclxuICAgICAgZm9udC1zaXplOiA0NHB4O1xyXG4gICAgICBjb2xvcjogI2Y4NzE3MTtcclxuICAgICAgbWFyZ2luLWJvdHRvbTogNHB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5yZW1vdmVkLWdyb3VwLXN0YXRlIGg0IHtcclxuICAgICAgbWFyZ2luOiAwO1xyXG4gICAgICBjb2xvcjogI2ZmZjtcclxuICAgICAgZm9udC1zaXplOiAxN3B4O1xyXG4gICAgICBmb250LXdlaWdodDogNzAwO1xyXG4gICAgfVxyXG5cclxuICAgIC5yZW1vdmVkLWdyb3VwLXN0YXRlIHAge1xyXG4gICAgICBtYXJnaW46IDAgMCA4cHg7XHJcbiAgICAgIG1heC13aWR0aDogMjgwcHg7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTNweDtcclxuICAgICAgbGluZS1oZWlnaHQ6IDEuNDtcclxuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC42Mik7XHJcbiAgICB9XHJcblxyXG4gICAgLnJlbW92ZWQtZXhpdC1idG4ge1xyXG4gICAgICBib3JkZXItcmFkaXVzOiAxMHB4O1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMTgpICFpbXBvcnRhbnQ7XHJcbiAgICAgIGNvbG9yOiAjZmZmICFpbXBvcnRhbnQ7XHJcbiAgICAgIGZvbnQtd2VpZ2h0OiA3MDA7XHJcbiAgICAgIHBhZGRpbmc6IDAgMThweDtcclxuICAgIH1cclxuXHJcbiAgICAubG9hZC1tb3JlLWJ0biB7XHJcbiAgICAgIGFsaWduLXNlbGY6IGNlbnRlcjtcclxuICAgICAgbWFyZ2luLWJvdHRvbTogMTZweDtcclxuICAgICAgZm9udC1zaXplOiAxMnB4O1xyXG4gICAgICBjb2xvcjogI2ZmZjtcclxuICAgIH1cclxuXHJcbiAgICAubWVzc2FnZXMtbGlzdCB7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XHJcbiAgICAgIGdhcDogMXB4O1xyXG4gICAgICBmbGV4OiAxO1xyXG4gICAgfVxyXG5cclxuICAgIC5kYXRlLXNlcGFyYXRvciB7XHJcbiAgICAgIHRleHQtYWxpZ246IGNlbnRlcjtcclxuICAgICAgbWFyZ2luOiAxNnB4IDAgOHB4O1xyXG4gICAgICBmb250LXNpemU6IDEycHg7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNyk7XHJcbiAgICAgIGZvbnQtd2VpZ2h0OiA1MDA7XHJcbiAgICB9XHJcblxyXG4gICAgLm1lc3NhZ2UtYnViYmxlLXJvdyB7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XHJcbiAgICAgIG1heC13aWR0aDogODglO1xyXG4gICAgICBtYXJnaW4tYm90dG9tOiAycHg7XHJcbiAgICB9XHJcblxyXG4gICAgLm1lc3NhZ2UtYnViYmxlLXJvdy5vd24ge1xyXG4gICAgICBhbGlnbi1zZWxmOiBmbGV4LWVuZDtcclxuICAgICAgYWxpZ24taXRlbXM6IGZsZXgtZW5kO1xyXG4gICAgfVxyXG5cclxuICAgIC5tZXNzYWdlLWJ1YmJsZS1yb3cub3RoZXIge1xyXG4gICAgICBhbGlnbi1zZWxmOiBmbGV4LXN0YXJ0O1xyXG4gICAgICBhbGlnbi1pdGVtczogZmxleC1zdGFydDtcclxuICAgIH1cclxuXHJcbiAgICAuc2VuZGVyLW5hbWUge1xyXG4gICAgICBmb250LXNpemU6IDExcHg7XHJcbiAgICAgIGZvbnQtd2VpZ2h0OiA3MDA7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuOTUpO1xyXG4gICAgICBtYXJnaW4tYm90dG9tOiAzcHg7XHJcbiAgICAgIGxldHRlci1zcGFjaW5nOiAwLjJweDtcclxuICAgICAgcGFkZGluZzogMCAxMHB4O1xyXG4gICAgICB0ZXh0LXNoYWRvdzogMCAxcHggM3B4IHJnYmEoMCwgMCwgMCwgMC40KTtcclxuICAgIH1cclxuXHJcbiAgICAuc3lzdGVtLW1lc3NhZ2Utcm93IHtcclxuICAgICAgYWxpZ24tc2VsZjogY2VudGVyO1xyXG4gICAgICBtYXgtd2lkdGg6IDg4JTtcclxuICAgICAgbWFyZ2luOiA4cHggYXV0bztcclxuICAgICAgdGV4dC1hbGlnbjogY2VudGVyO1xyXG4gICAgfVxyXG5cclxuICAgIC5zeXN0ZW0tbWVzc2FnZS10ZXh0IHtcclxuICAgICAgZGlzcGxheTogaW5saW5lLWZsZXg7XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xyXG4gICAgICBwYWRkaW5nOiA1cHggMTFweDtcclxuICAgICAgYm9yZGVyLXJhZGl1czogOTk5cHg7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4wOSk7XHJcbiAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xMik7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNzIpO1xyXG4gICAgICBmb250LXNpemU6IDExcHg7XHJcbiAgICAgIGxpbmUtaGVpZ2h0OiAxLjM1O1xyXG4gICAgfVxyXG5cclxuICAgIC5tZXNzYWdlLWJ1YmJsZSB7XHJcbiAgICAgIHBhZGRpbmc6IDhweCAxNHB4IDdweDtcclxuICAgICAgYm9yZGVyLXJhZGl1czogMTRweDtcclxuICAgICAgZm9udC1zaXplOiAxM3B4O1xyXG4gICAgICBsaW5lLWhlaWdodDogMS4zMjtcclxuICAgICAgd29yZC1icmVhazogYnJlYWstd29yZDtcclxuICAgICAgY29sb3I6ICNmNWY3ZmY7XHJcbiAgICAgIHBvc2l0aW9uOiByZWxhdGl2ZTtcclxuICAgICAgZGlzcGxheTogaW5saW5lLWJsb2NrO1xyXG4gICAgICBtaW4td2lkdGg6IGZpdC1jb250ZW50O1xyXG4gICAgfVxyXG5cclxuICAgIC5tZXNzYWdlLWJ1YmJsZS1yb3cub3RoZXIgLm1lc3NhZ2UtYnViYmxlIHtcclxuICAgICAgYmFja2dyb3VuZDogIzBkMjU0MDtcclxuICAgICAgYm9yZGVyLWJvdHRvbS1sZWZ0LXJhZGl1czogNXB4O1xyXG4gICAgICBib3gtc2hhZG93OiAwIDFweCA0cHggcmdiYSgwLCAwLCAwLCAwLjQpO1xyXG4gICAgfVxyXG5cclxuICAgIC5tZXNzYWdlLWJ1YmJsZS5vd24tYnViYmxlIHtcclxuICAgICAgYmFja2dyb3VuZDogIzBhM2Q2MjtcclxuICAgICAgYm9yZGVyLWJvdHRvbS1yaWdodC1yYWRpdXM6IDVweDtcclxuICAgICAgYm94LXNoYWRvdzogMCAxcHggNHB4IHJnYmEoMCwgMCwgMCwgMC40KTtcclxuICAgIH1cclxuXHJcbiAgICAudGV4dC1jb250ZW50IHtcclxuICAgICAgd2hpdGUtc3BhY2U6IHByZS13cmFwO1xyXG4gICAgICB0YWItc2l6ZTogNDtcclxuICAgIH1cclxuXHJcbiAgICAudGV4dC1jb250ZW50LnByZWZvcm1hdHRlZC10ZXh0IHtcclxuICAgICAgZm9udC1mYW1pbHk6IHVpLW1vbm9zcGFjZSwgU0ZNb25vLVJlZ3VsYXIsIE1lbmxvLCBNb25hY28sIENvbnNvbGFzLCBcIkxpYmVyYXRpb24gTW9ub1wiLCBtb25vc3BhY2U7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTJweDtcclxuICAgICAgbGluZS1oZWlnaHQ6IDEuNDU7XHJcbiAgICAgIG92ZXJmbG93LXg6IGF1dG87XHJcbiAgICAgIG1heC13aWR0aDogbWluKDcydncsIDUyMHB4KTtcclxuICAgIH1cclxuXHJcbiAgICAudGFibGUtbWVzc2FnZS13cmFwIHtcclxuICAgICAgbWF4LXdpZHRoOiBtaW4oNzZ2dywgNTYwcHgpO1xyXG4gICAgICBvdmVyZmxvdy14OiBhdXRvO1xyXG4gICAgICBib3JkZXItcmFkaXVzOiA5cHg7XHJcbiAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xNik7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4wNCk7XHJcbiAgICB9XHJcblxyXG4gICAgLnBhc3RlZC10YWJsZSB7XHJcbiAgICAgIGJvcmRlci1jb2xsYXBzZTogY29sbGFwc2U7XHJcbiAgICAgIG1pbi13aWR0aDogMTAwJTtcclxuICAgICAgZm9udC1zaXplOiAxMnB4O1xyXG4gICAgICBsaW5lLWhlaWdodDogMS4zNTtcclxuICAgICAgY29sb3I6ICNmNWY3ZmY7XHJcbiAgICB9XHJcblxyXG4gICAgLnBhc3RlZC10YWJsZSB0aCxcclxuICAgIC5wYXN0ZWQtdGFibGUgdGQge1xyXG4gICAgICBwYWRkaW5nOiA2cHggOXB4O1xyXG4gICAgICBib3JkZXItcmlnaHQ6IDFweCBzb2xpZCByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMTIpO1xyXG4gICAgICBib3JkZXItYm90dG9tOiAxcHggc29saWQgcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjEyKTtcclxuICAgICAgdGV4dC1hbGlnbjogbGVmdDtcclxuICAgICAgd2hpdGUtc3BhY2U6IHByZS13cmFwO1xyXG4gICAgICB2ZXJ0aWNhbC1hbGlnbjogdG9wO1xyXG4gICAgfVxyXG5cclxuICAgIC5wYXN0ZWQtdGFibGUgdGgge1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMSk7XHJcbiAgICAgIGZvbnQtd2VpZ2h0OiA3MDA7XHJcbiAgICB9XHJcblxyXG4gICAgLnBhc3RlZC10YWJsZSB0cjpsYXN0LWNoaWxkIHRkLFxyXG4gICAgLnBhc3RlZC10YWJsZSB0cjpsYXN0LWNoaWxkIHRoIHtcclxuICAgICAgYm9yZGVyLWJvdHRvbTogbm9uZTtcclxuICAgIH1cclxuXHJcbiAgICAucGFzdGVkLXRhYmxlIHRoOmxhc3QtY2hpbGQsXHJcbiAgICAucGFzdGVkLXRhYmxlIHRkOmxhc3QtY2hpbGQge1xyXG4gICAgICBib3JkZXItcmlnaHQ6IG5vbmU7XHJcbiAgICB9XHJcblxyXG4gICAgLmltYWdlLW1lc3NhZ2Uge1xyXG4gICAgICBsaW5lLWhlaWdodDogMDtcclxuICAgIH1cclxuXHJcbiAgICAubWVkaWEtd3JhcHBlciB7XHJcbiAgICAgIHBvc2l0aW9uOiByZWxhdGl2ZTtcclxuICAgICAgZGlzcGxheTogaW5saW5lLWJsb2NrO1xyXG4gICAgICBsaW5lLWhlaWdodDogMDtcclxuICAgICAgd2lkdGg6IHZhcigtLWF0dGFjaG1lbnQtdGh1bWItc2l6ZSk7XHJcbiAgICAgIGhlaWdodDogdmFyKC0tYXR0YWNobWVudC10aHVtYi1zaXplKTtcclxuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcclxuICAgICAgYm9yZGVyLXJhZGl1czogMTBweDtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjA4KTtcclxuICAgIH1cclxuXHJcbiAgICAubWVkaWEtaW1nIHtcclxuICAgICAgd2lkdGg6IDEwMCU7XHJcbiAgICAgIGhlaWdodDogMTAwJTtcclxuICAgICAgYm9yZGVyLXJhZGl1czogaW5oZXJpdDtcclxuICAgICAgZGlzcGxheTogYmxvY2s7XHJcbiAgICAgIGN1cnNvcjogem9vbS1pbjtcclxuICAgICAgb2JqZWN0LWZpdDogY292ZXI7XHJcbiAgICB9XHJcblxyXG4gICAgLmF0dGFjaG1lbnQtYWN0aW9ucyB7XHJcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcclxuICAgICAgcmlnaHQ6IDZweDtcclxuICAgICAgdG9wOiA2cHg7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGdhcDogNHB4O1xyXG4gICAgICBvcGFjaXR5OiAwO1xyXG4gICAgICB0cmFuc2l0aW9uOiBvcGFjaXR5IDAuMTJzIGVhc2U7XHJcbiAgICAgIHBvaW50ZXItZXZlbnRzOiBub25lO1xyXG4gICAgfVxyXG5cclxuICAgIC5tZWRpYS13cmFwcGVyOmhvdmVyIC5hdHRhY2htZW50LWFjdGlvbnMge1xyXG4gICAgICBvcGFjaXR5OiAxO1xyXG4gICAgICBwb2ludGVyLWV2ZW50czogYXV0bztcclxuICAgIH1cclxuXHJcbiAgICAuYXR0YWNobWVudC1hY3Rpb24tYnRuLFxyXG4gICAgLmZpbGUtZG93bmxvYWQtYnRuIHtcclxuICAgICAgYm9yZGVyOiBub25lO1xyXG4gICAgICBib3JkZXItcmFkaXVzOiA5OTlweDtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSg3LCAyOSwgNDgsIDAuODIpO1xyXG4gICAgICBjb2xvcjogI2ZmZjtcclxuICAgICAgZGlzcGxheTogaW5saW5lLWZsZXg7XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xyXG4gICAgICBjdXJzb3I6IHBvaW50ZXI7XHJcbiAgICAgIHBhZGRpbmc6IDA7XHJcbiAgICB9XHJcblxyXG4gICAgLmF0dGFjaG1lbnQtYWN0aW9uLWJ0biB7XHJcbiAgICAgIHdpZHRoOiAyOHB4O1xyXG4gICAgICBoZWlnaHQ6IDI4cHg7XHJcbiAgICB9XHJcblxyXG4gICAgLmF0dGFjaG1lbnQtYWN0aW9uLWJ0biBtYXQtaWNvbiB7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTdweDtcclxuICAgICAgd2lkdGg6IDE3cHg7XHJcbiAgICAgIGhlaWdodDogMTdweDtcclxuICAgIH1cclxuXHJcbiAgICAubWVkaWEtdmlkZW8ge1xyXG4gICAgICBtYXgtd2lkdGg6IDI0MHB4O1xyXG4gICAgICBtYXgtaGVpZ2h0OiAyNjBweDtcclxuICAgICAgYm9yZGVyLXJhZGl1czogMTBweDtcclxuICAgICAgZGlzcGxheTogYmxvY2s7XHJcbiAgICAgIGJhY2tncm91bmQ6ICMwMDA7XHJcbiAgICB9XHJcblxyXG4gICAgLnZpZGVvLW1lc3NhZ2Uge1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xyXG4gICAgICBnYXA6IDZweDtcclxuICAgIH1cclxuXHJcbiAgICAudmlkZW8tZG93bmxvYWQge1xyXG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjc4KTtcclxuICAgICAgZm9udC1zaXplOiAxMnB4O1xyXG4gICAgICB0ZXh0LWRlY29yYXRpb246IHVuZGVybGluZTtcclxuICAgICAgdGV4dC11bmRlcmxpbmUtb2Zmc2V0OiAycHg7XHJcbiAgICB9XHJcblxyXG4gICAgLm1lZGlhLXBsYWNlaG9sZGVyIHtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XHJcbiAgICAgIGdhcDogOHB4O1xyXG4gICAgICB3aWR0aDogdmFyKC0tYXR0YWNobWVudC10aHVtYi1zaXplKTtcclxuICAgICAgaGVpZ2h0OiB2YXIoLS1hdHRhY2htZW50LXRodW1iLXNpemUpO1xyXG4gICAgICBib3JkZXItcmFkaXVzOiAxMHB4O1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMDgpO1xyXG4gICAgICBjb2xvcjogcmdiYSgyNTUsMjU1LDI1NSwwLjYpO1xyXG4gICAgICBmb250LXNpemU6IDExcHg7XHJcbiAgICB9XHJcblxyXG4gICAgLm1lZGlhLWxvYWQtbGFiZWwge1xyXG4gICAgICBmb250LXNpemU6IDExcHg7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwyNTUsMjU1LDAuNik7XHJcbiAgICB9XHJcblxyXG4gICAgLmF0dGFjaG1lbnRzLWxpc3Qge1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xyXG4gICAgICBnYXA6IDhweDtcclxuICAgICAgbWF4LXdpZHRoOiAxMDAlO1xyXG4gICAgfVxyXG5cclxuICAgIC5hdHRhY2htZW50LWl0ZW0ge1xyXG4gICAgICBtYXgtd2lkdGg6IDEwMCU7XHJcbiAgICB9XHJcblxyXG4gICAgLmZpbGUtbWVzc2FnZSB7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgIGdhcDogOHB4O1xyXG4gICAgICBwYWRkaW5nOiA0cHggMDtcclxuICAgIH1cclxuXHJcbiAgICAuYXR0YWNobWVudC10aHVtYi5maWxlLW1lc3NhZ2Uge1xyXG4gICAgICBwb3NpdGlvbjogcmVsYXRpdmU7XHJcbiAgICAgIHdpZHRoOiB2YXIoLS1hdHRhY2htZW50LXRodW1iLXNpemUpO1xyXG4gICAgICBoZWlnaHQ6IHZhcigtLWF0dGFjaG1lbnQtdGh1bWItc2l6ZSk7XHJcbiAgICAgIHBhZGRpbmc6IDEycHg7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDEwcHg7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4wOCk7XHJcbiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XHJcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xyXG4gICAgICBib3gtc2l6aW5nOiBib3JkZXItYm94O1xyXG4gICAgICBvdmVyZmxvdzogaGlkZGVuO1xyXG4gICAgfVxyXG5cclxuICAgIC5maWxlLWRvd25sb2FkIHtcclxuICAgICAgZGlzcGxheTogaW5saW5lLWZsZXg7XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgIGdhcDogOHB4O1xyXG4gICAgICBjb2xvcjogI2ZmZjtcclxuICAgICAgdGV4dC1kZWNvcmF0aW9uOiBub25lO1xyXG4gICAgICBtYXgtd2lkdGg6IDI0MHB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5maWxlLW1zZy1pY29uIHtcclxuICAgICAgZm9udC1zaXplOiA0MnB4O1xyXG4gICAgICB3aWR0aDogNDJweDtcclxuICAgICAgaGVpZ2h0OiA0MnB4O1xyXG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjgpO1xyXG4gICAgICBmbGV4LXNocmluazogMDtcclxuICAgIH1cclxuXHJcbiAgICAuZmlsZS1tc2ctbmFtZSB7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTNweDtcclxuICAgICAgY29sb3I6ICNmZmY7XHJcbiAgICAgIGxpbmUtaGVpZ2h0OiAxLjI7XHJcbiAgICAgIG1heC13aWR0aDogMTAwJTtcclxuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcclxuICAgICAgdGV4dC1hbGlnbjogY2VudGVyO1xyXG4gICAgICB0ZXh0LW92ZXJmbG93OiBlbGxpcHNpcztcclxuICAgICAgZGlzcGxheTogLXdlYmtpdC1ib3g7XHJcbiAgICAgIC13ZWJraXQtbGluZS1jbGFtcDogMztcclxuICAgICAgLXdlYmtpdC1ib3gtb3JpZW50OiB2ZXJ0aWNhbDtcclxuICAgICAgd29yZC1icmVhazogYnJlYWstd29yZDtcclxuICAgIH1cclxuXHJcbiAgICAuZmlsZS1kb3dubG9hZC1pY29uIHtcclxuICAgICAgZm9udC1zaXplOiAxOHB4O1xyXG4gICAgICB3aWR0aDogMThweDtcclxuICAgICAgaGVpZ2h0OiAxOHB4O1xyXG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjcpO1xyXG4gICAgICBmbGV4LXNocmluazogMDtcclxuICAgIH1cclxuXHJcbiAgICAuZmlsZS1kb3dubG9hZC1idG4ge1xyXG4gICAgICB3aWR0aDogMjRweDtcclxuICAgICAgaGVpZ2h0OiAyNHB4O1xyXG4gICAgICBmbGV4LXNocmluazogMDtcclxuICAgICAgcG9zaXRpb246IGFic29sdXRlO1xyXG4gICAgICByaWdodDogNnB4O1xyXG4gICAgICB0b3A6IDZweDtcclxuICAgIH1cclxuXHJcbiAgICAuZmlsZS1kb3dubG9hZC1saW5rIHtcclxuICAgICAgYm9yZGVyOiBub25lO1xyXG4gICAgICBib3JkZXItcmFkaXVzOiA5OTlweDtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjE2KTtcclxuICAgICAgY29sb3I6ICNmZmY7XHJcbiAgICAgIGN1cnNvcjogcG9pbnRlcjtcclxuICAgICAgZm9udC1zaXplOiAxMXB4O1xyXG4gICAgICBwYWRkaW5nOiA0cHggMTBweDtcclxuICAgICAgbWFyZ2luLXRvcDogNHB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5tZXNzYWdlLW1ldGEge1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBnYXA6IDRweDtcclxuICAgICAgbWFyZ2luLXRvcDogM3B4O1xyXG4gICAgfVxyXG5cclxuICAgIC5tc2ctdGltZSB7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTBweDtcclxuICAgICAgY29sb3I6IHJnYmEoMjE4LCAyMjQsIDI1MCwgMC42Nik7XHJcbiAgICB9XHJcblxyXG4gICAgLm1lc3NhZ2UtYnViYmxlLXJvdy5vdGhlciAubXNnLXRpbWUge1xyXG4gICAgICBjb2xvcjogcmdiYSgyMTYsIDIyMywgMjQ2LCAwLjU4KTtcclxuICAgIH1cclxuXHJcbiAgICAucmVhZC1pY29uIHtcclxuICAgICAgZm9udC1zaXplOiAxNHB4O1xyXG4gICAgICB3aWR0aDogMTRweDtcclxuICAgICAgaGVpZ2h0OiAxNHB4O1xyXG4gICAgICBvcGFjaXR5OiAwLjc7XHJcbiAgICB9XHJcblxyXG4gICAgLnJlYWQtaWNvbi5yZWFkIHtcclxuICAgICAgY29sb3I6ICM2MGE1ZmE7XHJcbiAgICAgIG9wYWNpdHk6IDE7XHJcbiAgICB9XHJcblxyXG4gICAgLnJlYWQtaWNvbi51bnJlYWQge1xyXG4gICAgICBjb2xvcjogcmdiYSgyMTgsIDIyNCwgMjUwLCAwLjUpO1xyXG4gICAgICBvcGFjaXR5OiAxO1xyXG4gICAgfVxyXG5cclxuICAgIC5xdWljay1yZWFjdGlvbnMge1xyXG4gICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XHJcbiAgICAgIHRvcDogLTE4cHg7XHJcbiAgICAgIHJpZ2h0OiAwO1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBnYXA6IDRweDtcclxuICAgICAgcGFkZGluZzogM3B4IDVweDtcclxuICAgICAgYmFja2dyb3VuZDogIzA3MWQzMDtcclxuICAgICAgYm9yZGVyOiAxcHggc29saWQgcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjE0KTtcclxuICAgICAgYm9yZGVyLXJhZGl1czogOTk5cHg7XHJcbiAgICAgIGJveC1zaGFkb3c6IDAgNnB4IDE0cHggcmdiYSgwLCAwLCAwLCAwLjI4KTtcclxuICAgICAgei1pbmRleDogNDtcclxuICAgIH1cclxuXHJcbiAgICAvKiBSZWNlaXZlZCBtZXNzYWdlcyBzaXQgb24gdGhlIGxlZnQsIHNvIGdyb3cgdGhlIHBpY2tlciByaWdodHdhcmQuXHJcbiAgICAgICBPd24gbWVzc2FnZXMgc2l0IG9uIHRoZSByaWdodCwgc28gZ3JvdyB0aGUgcGlja2VyIGxlZnR3YXJkLiAqL1xyXG4gICAgLm1lc3NhZ2UtYnViYmxlLXJvdy5vdGhlciAucXVpY2stcmVhY3Rpb25zIHtcclxuICAgICAgbGVmdDogMDtcclxuICAgICAgcmlnaHQ6IGF1dG87XHJcbiAgICB9XHJcblxyXG4gICAgLm1lc3NhZ2UtYnViYmxlLXJvdy5vd24gLnF1aWNrLXJlYWN0aW9ucyB7XHJcbiAgICAgIGxlZnQ6IGF1dG87XHJcbiAgICAgIHJpZ2h0OiAwO1xyXG4gICAgfVxyXG5cclxuICAgIC5xdWljay1lbW9qaS1idG4ge1xyXG4gICAgICB3aWR0aDogMjBweDtcclxuICAgICAgaGVpZ2h0OiAyMHB4O1xyXG4gICAgICBib3JkZXI6IG5vbmU7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDk5OXB4O1xyXG4gICAgICBiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudDtcclxuICAgICAgY29sb3I6ICNmZmY7XHJcbiAgICAgIGRpc3BsYXk6IGlubGluZS1mbGV4O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcclxuICAgICAgZm9udC1zaXplOiAxM3B4O1xyXG4gICAgICBsaW5lLWhlaWdodDogMTtcclxuICAgICAgY3Vyc29yOiBwb2ludGVyO1xyXG4gICAgICBwYWRkaW5nOiAwO1xyXG4gICAgICB0cmFuc2l0aW9uOiB0cmFuc2Zvcm0gMC4xMnMgZWFzZSwgYmFja2dyb3VuZCAwLjEycyBlYXNlO1xyXG4gICAgfVxyXG5cclxuICAgIC5xdWljay1lbW9qaS1idG46aG92ZXIge1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMTgpO1xyXG4gICAgICB0cmFuc2Zvcm06IHNjYWxlKDEuMTQpO1xyXG4gICAgfVxyXG5cclxuICAgIC5yZWFjdGlvbnMtcm93IHtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgZmxleC13cmFwOiB3cmFwO1xyXG4gICAgICBnYXA6IDNweDtcclxuICAgICAgbWFyZ2luLXRvcDogNXB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5yZWFjdGlvbi1jaGlwIHtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsMjU1LDI1NSwwLjA4KTtcclxuICAgICAgYm9yZGVyOiAxcHggc29saWQgcmdiYSgyNTUsMjU1LDI1NSwwLjIpO1xyXG4gICAgICBib3JkZXItcmFkaXVzOiA5OTlweDtcclxuICAgICAgcGFkZGluZzogMnB4IDdweDtcclxuICAgICAgZm9udC1zaXplOiAxMXB4O1xyXG4gICAgICBjb2xvcjogI2YyZjZmZjtcclxuICAgICAgY3Vyc29yOiBwb2ludGVyO1xyXG4gICAgICB0cmFuc2l0aW9uOiBhbGwgMC4ycztcclxuICAgICAgZGlzcGxheTogaW5saW5lLWZsZXg7XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgIGdhcDogM3B4O1xyXG4gICAgICBtYXgtd2lkdGg6IDE4MHB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5yZWFjdGlvbi1jaGlwOmhvdmVyIHtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsMjU1LDI1NSwwLjI1KTtcclxuICAgICAgdHJhbnNmb3JtOiBzY2FsZSgxLjA1KTtcclxuICAgIH1cclxuXHJcbiAgICAucmVhY3Rpb24tY2hpcC5vd24tcmVhY3Rpb24ge1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDQyLDkxLDI1NSwwLjMpO1xyXG4gICAgICBib3JkZXItY29sb3I6IHJnYmEoNDIsOTEsMjU1LDAuNSk7XHJcbiAgICB9XHJcblxyXG4gICAgLmVtcHR5LWNoYXQge1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcclxuICAgICAgZmxleDogMTtcclxuICAgICAgY29sb3I6ICM5Y2EzYWY7XHJcbiAgICB9XHJcblxyXG4gICAgLmVtcHR5LWNoYXQgbWF0LWljb24ge1xyXG4gICAgICBmb250LXNpemU6IDQ4cHg7XHJcbiAgICAgIHdpZHRoOiA0OHB4O1xyXG4gICAgICBoZWlnaHQ6IDQ4cHg7XHJcbiAgICAgIG1hcmdpbi1ib3R0b206IDhweDtcclxuICAgIH1cclxuXHJcbiAgICAuZW1wdHktY2hhdCBwIHtcclxuICAgICAgZm9udC1zaXplOiAxNHB4O1xyXG4gICAgICBtYXJnaW46IDA7XHJcbiAgICB9XHJcbiAgYF0sXHJcbn0pXHJcbmV4cG9ydCBjbGFzcyBDaGF0VGhyZWFkQ29tcG9uZW50IGltcGxlbWVudHMgT25Jbml0LCBPbkRlc3Ryb3ksIEFmdGVyVmlld0NoZWNrZWQge1xyXG4gIEBWaWV3Q2hpbGQoJ3Njcm9sbENvbnRhaW5lcicpIHNjcm9sbENvbnRhaW5lciE6IEVsZW1lbnRSZWY7XHJcbiAgQFZpZXdDaGlsZChNZXNzYWdlSW5wdXRDb21wb25lbnQpIG1lc3NhZ2VJbnB1dD86IE1lc3NhZ2VJbnB1dENvbXBvbmVudDtcclxuICBAT3V0cHV0KCkgbGlnaHRib3hPcGVuID0gbmV3IEV2ZW50RW1pdHRlcjxzdHJpbmc+KCk7XHJcblxyXG4gIG1lc3NhZ2VzOiBNZXNzYWdlW10gPSBbXTtcclxuICB2aXNpYmxlQ29udGFjdHM6IENvbnRhY3RbXSA9IFtdO1xyXG4gIGNvbnZlcnNhdGlvbk5hbWUgPSAnJztcclxuICBpc0dyb3VwID0gZmFsc2U7XHJcbiAgaXNSZW1vdmVkRnJvbUdyb3VwID0gZmFsc2U7XHJcbiAgbG9hZGluZyA9IGZhbHNlO1xyXG4gIG15Q29udGFjdElkOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcclxuXHJcbiAgY29udmVyc2F0aW9uSWQ6IHN0cmluZyB8IG51bGwgPSBudWxsO1xyXG4gIHByaXZhdGUgc3ViITogU3Vic2NyaXB0aW9uO1xyXG4gIHByaXZhdGUgc2hvdWxkU2Nyb2xsVG9Cb3R0b20gPSB0cnVlO1xyXG5cclxuICB1cGxvYWRpbmcgPSBmYWxzZTtcclxuICBob3ZlcmVkTWVzc2FnZUlkOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcclxuICBxdWlja0Vtb2ppcyA9IFsn4p2k77iPJywgJ/CfkY0nLCAn8J+YgicsICfwn5iuJywgJ/CfmKInLCAn8J+UpSddO1xyXG4gIHRocmVhZERyYWdPdmVyID0gZmFsc2U7XHJcbiAgcHJpdmF0ZSB0aHJlYWREcmFnRGVwdGggPSAwO1xyXG4gIHByaXZhdGUgYm91bmRSZXNldFRocmVhZERyYWcgPSB0aGlzLnJlc2V0VGhyZWFkRHJhZy5iaW5kKHRoaXMpO1xyXG5cclxuICAvKiogVHJhY2tzIHdoaWNoIGZpbGUgSURzIGFyZSBjdXJyZW50bHkgYmVpbmcgZmV0Y2hlZCB0byBhdm9pZCBkdXBsaWNhdGUgcmVxdWVzdHMgKi9cclxuICBwcml2YXRlIG1lZGlhTG9hZGluZyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xyXG4gIC8qKiBUcmFja3MgZmlsZSBJRHMgd2hlcmUgcmV0cmlldmFsIGZhaWxlZCBzbyBVSSBkb2Vzbid0IHNwaW4gZm9yZXZlci4gKi9cclxuICBwcml2YXRlIG1lZGlhRmFpbGVkID0gbmV3IFNldDxzdHJpbmc+KCk7XHJcbiAgcHJpdmF0ZSBtZWRpYVF1ZXVlOiBzdHJpbmdbXSA9IFtdO1xyXG4gIHByaXZhdGUgYWN0aXZlTWVkaWFSZXF1ZXN0cyA9IDA7XHJcbiAgcHJpdmF0ZSByZWFkb25seSBtYXhNZWRpYVJlcXVlc3RzID0gMjtcclxuXHJcbiAgY29uc3RydWN0b3IoXHJcbiAgICBwcml2YXRlIHN0b3JlOiBNZXNzYWdpbmdTdG9yZVNlcnZpY2UsXHJcbiAgICBwcml2YXRlIGF1dGg6IEF1dGhTZXJ2aWNlLFxyXG4gICAgcHJpdmF0ZSBmaWxlU2VydmljZTogTWVzc2FnaW5nRmlsZVNlcnZpY2UsXHJcbiAgICBwcml2YXRlIGNkcjogQ2hhbmdlRGV0ZWN0b3JSZWYsXHJcbiAgKSB7fVxyXG5cclxuICBuZ09uSW5pdCgpOiB2b2lkIHtcclxuICAgIHRoaXMubXlDb250YWN0SWQgPSB0aGlzLmF1dGguY29udGFjdElkO1xyXG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignZHJvcCcsIHRoaXMuYm91bmRSZXNldFRocmVhZERyYWcsIHRydWUpO1xyXG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignZHJhZ2VuZCcsIHRoaXMuYm91bmRSZXNldFRocmVhZERyYWcsIHRydWUpO1xyXG5cclxuICAgIHRoaXMuc3ViID0gY29tYmluZUxhdGVzdChbXHJcbiAgICAgIHRoaXMuc3RvcmUuYWN0aXZlQ29udmVyc2F0aW9uSWQsXHJcbiAgICAgIHRoaXMuc3RvcmUubWVzc2FnZXNNYXAsXHJcbiAgICAgIHRoaXMuc3RvcmUub3BlbkNoYXRzLFxyXG4gICAgICB0aGlzLnN0b3JlLnZpc2libGVDb250YWN0cyxcclxuICAgICAgdGhpcy5zdG9yZS5sb2FkaW5nTWVzc2FnZXMsXHJcbiAgICAgIHRoaXMuc3RvcmUucmVtb3ZlZEdyb3VwSWRzLFxyXG4gICAgXSkuc3Vic2NyaWJlKChbY29udklkLCBtc2dNYXAsIGNoYXRzLCBjb250YWN0cywgbG9hZGluZywgcmVtb3ZlZEdyb3VwSWRzXSkgPT4ge1xyXG4gICAgICB0aGlzLmxvYWRpbmcgPSBsb2FkaW5nO1xyXG4gICAgICB0aGlzLnZpc2libGVDb250YWN0cyA9IGNvbnRhY3RzIHx8IFtdO1xyXG5cclxuICAgICAgaWYgKGNvbnZJZCAmJiBjb252SWQgIT09IHRoaXMuY29udmVyc2F0aW9uSWQpIHtcclxuICAgICAgICB0aGlzLmNvbnZlcnNhdGlvbklkID0gY29udklkO1xyXG4gICAgICAgIHRoaXMucmVzZXRNZWRpYVF1ZXVlKCk7XHJcbiAgICAgICAgdGhpcy5zaG91bGRTY3JvbGxUb0JvdHRvbSA9IHRydWU7XHJcbiAgICAgICAgY29uc3QgY2hhdCA9IGNoYXRzLmZpbmQoKGMpID0+IGMuY29udmVyc2F0aW9uSWQgPT09IGNvbnZJZCk7XHJcbiAgICAgICAgdGhpcy5jb252ZXJzYXRpb25OYW1lID0gY2hhdD8ubmFtZSB8fCAnQ2hhdCc7XHJcbiAgICAgICAgdGhpcy5pc0dyb3VwID0gY2hhdD8uaXNHcm91cCB8fCBmYWxzZTtcclxuICAgICAgfVxyXG5cclxuICAgICAgaWYgKHRoaXMuY29udmVyc2F0aW9uSWQpIHtcclxuICAgICAgICBjb25zdCBwcmV2TGVuID0gdGhpcy5tZXNzYWdlcy5sZW5ndGg7XHJcbiAgICAgICAgdGhpcy5tZXNzYWdlcyA9IG1zZ01hcC5nZXQodGhpcy5jb252ZXJzYXRpb25JZCkgfHwgW107XHJcbiAgICAgICAgaWYgKHRoaXMubWVzc2FnZXMubGVuZ3RoID4gcHJldkxlbikge1xyXG4gICAgICAgICAgdGhpcy5zaG91bGRTY3JvbGxUb0JvdHRvbSA9IHRydWU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIC8vIFByZS13YXJtIG1lZGlhIGNhY2hlIGZvciBhbnkgaW1hZ2UvZmlsZSBtZXNzYWdlcyB2aXNpYmxlXHJcbiAgICAgICAgdGhpcy5wcmV3YXJtTWVkaWEodGhpcy5tZXNzYWdlcyk7XHJcbiAgICAgIH1cclxuICAgICAgdGhpcy5pc1JlbW92ZWRGcm9tR3JvdXAgPSAhIXRoaXMuY29udmVyc2F0aW9uSWQgJiYgcmVtb3ZlZEdyb3VwSWRzLmhhcyhTdHJpbmcodGhpcy5jb252ZXJzYXRpb25JZCkpO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBuZ0FmdGVyVmlld0NoZWNrZWQoKTogdm9pZCB7XHJcbiAgICBpZiAodGhpcy5zaG91bGRTY3JvbGxUb0JvdHRvbSkge1xyXG4gICAgICB0aGlzLnNjcm9sbFRvQm90dG9tKCk7XHJcbiAgICAgIHRoaXMuc2hvdWxkU2Nyb2xsVG9Cb3R0b20gPSBmYWxzZTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIG5nT25EZXN0cm95KCk6IHZvaWQge1xyXG4gICAgdGhpcy5zdWI/LnVuc3Vic2NyaWJlKCk7XHJcbiAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdkcm9wJywgdGhpcy5ib3VuZFJlc2V0VGhyZWFkRHJhZywgdHJ1ZSk7XHJcbiAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdkcmFnZW5kJywgdGhpcy5ib3VuZFJlc2V0VGhyZWFkRHJhZywgdHJ1ZSk7XHJcbiAgfVxyXG5cclxuICBnb0JhY2soKTogdm9pZCB7XHJcbiAgICB0aGlzLnN0b3JlLnNldFZpZXcoJ2luYm94Jyk7XHJcbiAgfVxyXG5cclxuICBvbkNsZWFyQ29udmVyc2F0aW9uKCk6IHZvaWQge1xyXG4gICAgaWYgKHRoaXMuY29udmVyc2F0aW9uSWQpIHtcclxuICAgICAgdGhpcy5zdG9yZS5jbGVhckNvbnZlcnNhdGlvbih0aGlzLmNvbnZlcnNhdGlvbklkKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIG9uRGVsZXRlQ29udmVyc2F0aW9uKCk6IHZvaWQge1xyXG4gICAgaWYgKHRoaXMuY29udmVyc2F0aW9uSWQpIHtcclxuICAgICAgdGhpcy5zdG9yZS5kZWxldGVDb252ZXJzYXRpb24odGhpcy5jb252ZXJzYXRpb25JZCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBvbkdyb3VwU2V0dGluZ3MoKTogdm9pZCB7XHJcbiAgICBpZiAodGhpcy5pc1JlbW92ZWRGcm9tR3JvdXApIHJldHVybjtcclxuICAgIGlmICh0aGlzLmNvbnZlcnNhdGlvbklkKSB7XHJcbiAgICAgIHRoaXMuc3RvcmUub3Blbkdyb3VwU2V0dGluZ3ModGhpcy5jb252ZXJzYXRpb25JZCwgdGhpcy5jb252ZXJzYXRpb25OYW1lKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIG9uU2VuZE1lc3NhZ2UoY29udGVudDogc3RyaW5nKTogdm9pZCB7XHJcbiAgICBpZiAodGhpcy5pc1JlbW92ZWRGcm9tR3JvdXApIHJldHVybjtcclxuICAgIHRoaXMuc3RvcmUuc2VuZE1lc3NhZ2UodGhpcy5jb252ZXJzYXRpb25JZCwgY29udGVudCk7XHJcbiAgICB0aGlzLnNob3VsZFNjcm9sbFRvQm90dG9tID0gdHJ1ZTtcclxuICB9XHJcblxyXG4gIG9uU2VuZFdpdGhGaWxlcyhwYXlsb2FkOiBNZXNzYWdlUGF5bG9hZCk6IHZvaWQge1xyXG4gICAgaWYgKHRoaXMuaXNSZW1vdmVkRnJvbUdyb3VwKSByZXR1cm47XHJcbiAgICBpZiAoIXRoaXMuY29udmVyc2F0aW9uSWQgfHwgIXRoaXMuYXV0aC5jb250YWN0SWQpIHJldHVybjtcclxuICAgIHRoaXMudXBsb2FkaW5nID0gdHJ1ZTtcclxuXHJcbiAgICAvLyBTdGVwIDE6IFVwbG9hZCBhbGwgZmlsZXMgYW5kIG9idGFpbiByZWFsIGZpbGVfaWRzIGZyb20gdGhlIHNlcnZlci5cclxuICAgIC8vIFRlbXAgSURzIGFyZSBORVZFUiBzZW50IHRvIGFueSBBUEkg4oCUIHdlIHdhaXQgZm9yIHJlYWwgSURzIGhlcmUuXHJcbiAgICB0aGlzLmZpbGVTZXJ2aWNlLnVwbG9hZEZpbGVzKHBheWxvYWQuZmlsZXMpLnN1YnNjcmliZSh7XHJcbiAgICAgIG5leHQ6IChyZXNwb25zZXMpID0+IHtcclxuICAgICAgICBjb25zdCBmaWxlSWRzICAgPSByZXNwb25zZXMubWFwKChyKSA9PiByLmZpbGVfaWQpO1xyXG4gICAgICAgIGNvbnN0IGZpbGVuYW1lcyA9IHJlc3BvbnNlcy5tYXAoKHIpID0+IHIuZmlsZW5hbWUpO1xyXG4gICAgICAgIGNvbnN0IG1pbWVUeXBlcyA9IHJlc3BvbnNlcy5tYXAoKHIsIGlkeCkgPT4gci5taW1lX3R5cGUgfHwgcGF5bG9hZC5maWxlc1tpZHhdPy50eXBlIHx8ICcnKTtcclxuXHJcbiAgICAgICAgLy8gR3VhcmQ6IGVuc3VyZSBhbGwgSURzIGFyZSByZWFsIChub3QgdGVtcClcclxuICAgICAgICBjb25zdCBoYXNUZW1wID0gZmlsZUlkcy5zb21lKGlkID0+IGlkPy5zdGFydHNXaXRoKCd0ZW1wLScpKTtcclxuICAgICAgICBpZiAoaGFzVGVtcCkge1xyXG4gICAgICAgICAgdGhpcy51cGxvYWRpbmcgPSBmYWxzZTtcclxuICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIFN0ZXAgMjogUHJlLXdhcm0gaW1hZ2UgY2FjaGUgc28gdGhlIG9wdGltaXN0aWMgYnViYmxlIHJlbmRlcnMgaW1tZWRpYXRlbHkuXHJcbiAgICAgICAgdGhpcy5maWxlU2VydmljZS5wcmV3YXJtQ2FjaGUoZmlsZUlkcyk7XHJcblxyXG4gICAgICAgIC8vIFN0ZXAgMzogU2VuZCB0aGUgbWVzc2FnZSB3aXRoIHRoZSByZWFsIGZpbGVfaWRzLlxyXG4gICAgICAgIHRoaXMuZmlsZVNlcnZpY2VcclxuICAgICAgICAgIC5zZW5kTWVzc2FnZVdpdGhBdHRhY2htZW50cyhcclxuICAgICAgICAgICAgdGhpcy5jb252ZXJzYXRpb25JZCEsXHJcbiAgICAgICAgICAgIHRoaXMuYXV0aC5jb250YWN0SWQhLFxyXG4gICAgICAgICAgICBwYXlsb2FkLnRleHQgfHwgZmlsZW5hbWVzLmpvaW4oJywgJyksXHJcbiAgICAgICAgICAgIGZpbGVJZHMsXHJcbiAgICAgICAgICAgIGZpbGVuYW1lcyxcclxuICAgICAgICAgICAgbWltZVR5cGVzXHJcbiAgICAgICAgICApXHJcbiAgICAgICAgICAuc3Vic2NyaWJlKHtcclxuICAgICAgICAgICAgbmV4dDogKHJlczogYW55KSA9PiB7XHJcbiAgICAgICAgICAgICAgdGhpcy51cGxvYWRpbmcgPSBmYWxzZTtcclxuICAgICAgICAgICAgICB0aGlzLnNob3VsZFNjcm9sbFRvQm90dG9tID0gdHJ1ZTtcclxuXHJcbiAgICAgICAgICAgICAgLy8gQWRkIG9wdGltaXN0aWMgbWVzc2FnZSBzbyB0aGUgaW1hZ2UgYXBwZWFycyBpbnN0YW50bHkg4oCUXHJcbiAgICAgICAgICAgICAgLy8gdGhlIFdlYlNvY2tldCBldmVudCBtYXkgYXJyaXZlIGEgbW9tZW50IGxhdGVyIGFuZCBkZWR1cCBpdC5cclxuICAgICAgICAgICAgICBjb25zdCBmaXJzdElkID0gZmlsZUlkc1swXSB8fCAnJztcclxuICAgICAgICAgICAgICBjb25zdCBpc0ltZyA9XHJcbiAgICAgICAgICAgICAgICAobWltZVR5cGVzWzBdIHx8ICcnKS5zdGFydHNXaXRoKCdpbWFnZS8nKSB8fFxyXG4gICAgICAgICAgICAgICAgL1xcLihwbmd8anBlP2d8Z2lmfHdlYnB8Ym1wfHN2Z3xoZWljfGhlaWYpJC9pLnRlc3QoZmlsZW5hbWVzWzBdIHx8ICcnKTtcclxuICAgICAgICAgICAgICBjb25zdCBvcHRpbWlzdGljOiBhbnkgPSB7XHJcbiAgICAgICAgICAgICAgICBtZXNzYWdlX2lkOiByZXM/Lm1lc3NhZ2VfaWQgPyBTdHJpbmcocmVzLm1lc3NhZ2VfaWQpIDogJ3RlbXAtJyArIERhdGUubm93KCksXHJcbiAgICAgICAgICAgICAgICBjb252ZXJzYXRpb25faWQ6IHRoaXMuY29udmVyc2F0aW9uSWQhLFxyXG4gICAgICAgICAgICAgICAgc2VuZGVyX2lkOiB0aGlzLmF1dGguY29udGFjdElkISxcclxuICAgICAgICAgICAgICAgIHNlbmRlcl9uYW1lOiAnWW91JyxcclxuICAgICAgICAgICAgICAgIG1lc3NhZ2VfdHlwZTogaXNJbWcgPyAnSU1BR0UnIDogJ0ZJTEUnLFxyXG4gICAgICAgICAgICAgICAgY29udGVudDogcGF5bG9hZC50ZXh0IHx8IGZpbGVuYW1lcy5qb2luKCcsICcpLFxyXG4gICAgICAgICAgICAgICAgbWVkaWFfdXJsOiBmaXJzdElkLFxyXG4gICAgICAgICAgICAgICAgY3JlYXRlZF9hdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxyXG4gICAgICAgICAgICAgICAgaXNfcmVhZDogZmFsc2UsXHJcbiAgICAgICAgICAgICAgICBhdHRhY2htZW50czogZmlsZUlkcy5tYXAoKGlkLCBpZHgpID0+ICh7XHJcbiAgICAgICAgICAgICAgICAgIGZpbGVfaWQ6IGlkLFxyXG4gICAgICAgICAgICAgICAgICBmaWxlbmFtZTogZmlsZW5hbWVzW2lkeF0gfHwgZmlsZW5hbWVzWzBdIHx8IGBBdHRhY2htZW50ICR7aWR4ICsgMX1gLFxyXG4gICAgICAgICAgICAgICAgICBtaW1lX3R5cGU6IG1pbWVUeXBlc1tpZHhdIHx8IHVuZGVmaW5lZCxcclxuICAgICAgICAgICAgICAgICAgc2l6ZV9ieXRlczogcGF5bG9hZC5maWxlc1tpZHhdPy5zaXplLFxyXG4gICAgICAgICAgICAgICAgICB1cmw6IHJlc3BvbnNlc1tpZHhdPy51cmwsXHJcbiAgICAgICAgICAgICAgICB9KSksXHJcbiAgICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgICB0aGlzLnN0b3JlLmFwcGVuZE9wdGltaXN0aWNNZXNzYWdlKG9wdGltaXN0aWMpO1xyXG4gICAgICAgICAgICAgIHRoaXMuY2RyLm1hcmtGb3JDaGVjaygpO1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBlcnJvcjogKCkgPT4ge1xyXG4gICAgICAgICAgICAgIHRoaXMudXBsb2FkaW5nID0gZmFsc2U7XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICB9KTtcclxuICAgICAgfSxcclxuICAgICAgZXJyb3I6ICgpID0+IHtcclxuICAgICAgICB0aGlzLnVwbG9hZGluZyA9IGZhbHNlO1xyXG4gICAgICB9LFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBsb2FkT2xkZXIoKTogdm9pZCB7XHJcbiAgICBpZiAodGhpcy5jb252ZXJzYXRpb25JZCAmJiB0aGlzLm1lc3NhZ2VzLmxlbmd0aCA+IDApIHtcclxuICAgICAgdGhpcy5zdG9yZS5sb2FkTWVzc2FnZXModGhpcy5jb252ZXJzYXRpb25JZCwgdGhpcy5tZXNzYWdlc1swXS5tZXNzYWdlX2lkKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIG9uU2Nyb2xsKCk6IHZvaWQge31cclxuXHJcbiAgb25UaHJlYWREcmFnRW50ZXIoZXZlbnQ6IERyYWdFdmVudCk6IHZvaWQge1xyXG4gICAgaWYgKHRoaXMuaXNSZW1vdmVkRnJvbUdyb3VwKSByZXR1cm47XHJcbiAgICBpZiAoIXRoaXMuZHJhZ0hhc0ZpbGVzKGV2ZW50KSkgcmV0dXJuO1xyXG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuICAgIGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xyXG4gICAgdGhpcy50aHJlYWREcmFnRGVwdGgrKztcclxuICAgIHRoaXMudGhyZWFkRHJhZ092ZXIgPSB0cnVlO1xyXG4gIH1cclxuXHJcbiAgb25UaHJlYWREcmFnT3ZlcihldmVudDogRHJhZ0V2ZW50KTogdm9pZCB7XHJcbiAgICBpZiAodGhpcy5pc1JlbW92ZWRGcm9tR3JvdXApIHJldHVybjtcclxuICAgIGlmICghdGhpcy5kcmFnSGFzRmlsZXMoZXZlbnQpKSByZXR1cm47XHJcbiAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XHJcbiAgICBpZiAoZXZlbnQuZGF0YVRyYW5zZmVyKSB7XHJcbiAgICAgIGV2ZW50LmRhdGFUcmFuc2Zlci5kcm9wRWZmZWN0ID0gJ2NvcHknO1xyXG4gICAgfVxyXG4gICAgdGhpcy50aHJlYWREcmFnT3ZlciA9IHRydWU7XHJcbiAgfVxyXG5cclxuICBvblRocmVhZERyYWdMZWF2ZShldmVudDogRHJhZ0V2ZW50KTogdm9pZCB7XHJcbiAgICBpZiAoIXRoaXMuZHJhZ0hhc0ZpbGVzKGV2ZW50KSkgcmV0dXJuO1xyXG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuICAgIGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xyXG4gICAgdGhpcy50aHJlYWREcmFnRGVwdGggPSBNYXRoLm1heCgwLCB0aGlzLnRocmVhZERyYWdEZXB0aCAtIDEpO1xyXG4gICAgdGhpcy50aHJlYWREcmFnT3ZlciA9IHRoaXMudGhyZWFkRHJhZ0RlcHRoID4gMDtcclxuICB9XHJcblxyXG4gIG9uVGhyZWFkRHJvcChldmVudDogRHJhZ0V2ZW50KTogdm9pZCB7XHJcbiAgICBpZiAodGhpcy5pc1JlbW92ZWRGcm9tR3JvdXApIHJldHVybjtcclxuICAgIGlmICghdGhpcy5kcmFnSGFzRmlsZXMoZXZlbnQpKSByZXR1cm47XHJcbiAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XHJcbiAgICB0aGlzLnJlc2V0VGhyZWFkRHJhZygpO1xyXG4gICAgY29uc3QgZmlsZXMgPSBldmVudC5kYXRhVHJhbnNmZXI/LmZpbGVzID8gQXJyYXkuZnJvbShldmVudC5kYXRhVHJhbnNmZXIuZmlsZXMpIDogW107XHJcbiAgICB0aGlzLm1lc3NhZ2VJbnB1dD8uYWRkRmlsZXMoZmlsZXMpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSByZXNldFRocmVhZERyYWcoKTogdm9pZCB7XHJcbiAgICB0aGlzLnRocmVhZERyYWdEZXB0aCA9IDA7XHJcbiAgICB0aGlzLnRocmVhZERyYWdPdmVyID0gZmFsc2U7XHJcbiAgfVxyXG5cclxuICBleGl0UmVtb3ZlZEdyb3VwKCk6IHZvaWQge1xyXG4gICAgaWYgKHRoaXMuY29udmVyc2F0aW9uSWQpIHtcclxuICAgICAgdGhpcy5zdG9yZS5leGl0UmVtb3ZlZEdyb3VwKHRoaXMuY29udmVyc2F0aW9uSWQpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBkcmFnSGFzRmlsZXMoZXZlbnQ6IERyYWdFdmVudCk6IGJvb2xlYW4ge1xyXG4gICAgY29uc3QgdHlwZXMgPSBldmVudC5kYXRhVHJhbnNmZXI/LnR5cGVzO1xyXG4gICAgaWYgKCF0eXBlcykgcmV0dXJuIGZhbHNlO1xyXG4gICAgcmV0dXJuIEFycmF5LmZyb20odHlwZXMpLmluY2x1ZGVzKCdGaWxlcycpO1xyXG4gIH1cclxuXHJcbiAgc2hvdWxkU2hvd0RhdGVTZXBhcmF0b3IoaW5kZXg6IG51bWJlcik6IGJvb2xlYW4ge1xyXG4gICAgaWYgKGluZGV4ID09PSAwKSByZXR1cm4gdHJ1ZTtcclxuICAgIGNvbnN0IGN1cnIgPSBuZXcgRGF0ZSh0aGlzLm1lc3NhZ2VzW2luZGV4XS5jcmVhdGVkX2F0KS50b0RhdGVTdHJpbmcoKTtcclxuICAgIGNvbnN0IHByZXYgPSBuZXcgRGF0ZSh0aGlzLm1lc3NhZ2VzW2luZGV4IC0gMV0uY3JlYXRlZF9hdCkudG9EYXRlU3RyaW5nKCk7XHJcbiAgICByZXR1cm4gY3VyciAhPT0gcHJldjtcclxuICB9XHJcblxyXG4gIHNob3VsZFNob3dTZW5kZXIoaW5kZXg6IG51bWJlcik6IGJvb2xlYW4ge1xyXG4gICAgaWYgKGluZGV4ID09PSAwKSByZXR1cm4gdHJ1ZTtcclxuICAgIHJldHVybiB0aGlzLm1lc3NhZ2VzW2luZGV4XS5zZW5kZXJfaWQgIT09IHRoaXMubWVzc2FnZXNbaW5kZXggLSAxXS5zZW5kZXJfaWQ7XHJcbiAgfVxyXG5cclxuICBpc093bk1lc3NhZ2UobXNnOiBNZXNzYWdlKTogYm9vbGVhbiB7XHJcbiAgICByZXR1cm4gU3RyaW5nKG1zZy5zZW5kZXJfaWQpID09PSBTdHJpbmcodGhpcy5teUNvbnRhY3RJZCk7XHJcbiAgfVxyXG5cclxuICBpc1N5c3RlbU1lc3NhZ2UobXNnOiBNZXNzYWdlKTogYm9vbGVhbiB7XHJcbiAgICBjb25zdCBjb250ZW50ID0gU3RyaW5nKG1zZy5jb250ZW50IHx8ICcnKS50cmltKCk7XHJcbiAgICByZXR1cm4gbXNnLm1lc3NhZ2VfdHlwZSA9PT0gJ1NZU1RFTScgfHxcclxuICAgICAgL14uKyBhZGRlZCAuKyB0byB0aGUgZ3JvdXAkLy50ZXN0KGNvbnRlbnQpIHx8XHJcbiAgICAgIC9eLisgcmVtb3ZlZCAuKyBmcm9tIHRoZSBncm91cCQvLnRlc3QoY29udGVudCk7XHJcbiAgfVxyXG5cclxuICBpc1ByZWZvcm1hdHRlZFRleHQobXNnOiBNZXNzYWdlKTogYm9vbGVhbiB7XHJcbiAgICBjb25zdCBjb250ZW50ID0gU3RyaW5nKG1zZy5jb250ZW50IHx8ICcnKTtcclxuICAgIHJldHVybiBjb250ZW50LmluY2x1ZGVzKCdcXHQnKSB8fCBjb250ZW50LmluY2x1ZGVzKCdcXG4nKSB8fCAvIHsyLH0vLnRlc3QoY29udGVudCk7XHJcbiAgfVxyXG5cclxuICBpc1RhYmxlVGV4dChtc2c6IE1lc3NhZ2UpOiBib29sZWFuIHtcclxuICAgIGNvbnN0IHJvd3MgPSB0aGlzLmdldFRhYmxlUm93cyhtc2cpO1xyXG4gICAgcmV0dXJuIHJvd3MubGVuZ3RoID49IDIgJiYgcm93cy5zb21lKChyb3cpID0+IHJvdy5sZW5ndGggPj0gMik7XHJcbiAgfVxyXG5cclxuICBnZXRUYWJsZVJvd3MobXNnOiBNZXNzYWdlKTogc3RyaW5nW11bXSB7XHJcbiAgICBjb25zdCBjb250ZW50ID0gU3RyaW5nKG1zZy5jb250ZW50IHx8ICcnKS50cmltKCk7XHJcbiAgICBpZiAoIWNvbnRlbnQuaW5jbHVkZXMoJ1xcdCcpKSByZXR1cm4gW107XHJcblxyXG4gICAgY29uc3Qgcm93cyA9IGNvbnRlbnRcclxuICAgICAgLnNwbGl0KC9cXHI/XFxuLylcclxuICAgICAgLm1hcCgobGluZSkgPT4gbGluZS5zcGxpdCgnXFx0JykubWFwKChjZWxsKSA9PiBjZWxsLnRyaW0oKSkpXHJcbiAgICAgIC5maWx0ZXIoKHJvdykgPT4gcm93LnNvbWUoKGNlbGwpID0+IGNlbGwubGVuZ3RoID4gMCkpO1xyXG5cclxuICAgIGNvbnN0IG1heENvbHVtbnMgPSBNYXRoLm1heCgwLCAuLi5yb3dzLm1hcCgocm93KSA9PiByb3cubGVuZ3RoKSk7XHJcbiAgICBpZiAobWF4Q29sdW1ucyA8IDIpIHJldHVybiBbXTtcclxuXHJcbiAgICByZXR1cm4gcm93cy5tYXAoKHJvdykgPT4gW1xyXG4gICAgICAuLi5yb3csXHJcbiAgICAgIC4uLkFycmF5LmZyb20oeyBsZW5ndGg6IG1heENvbHVtbnMgLSByb3cubGVuZ3RoIH0sICgpID0+ICcnKSxcclxuICAgIF0pO1xyXG4gIH1cclxuXHJcbiAgaXNNZXNzYWdlUmVhZChtc2c6IE1lc3NhZ2UpOiBib29sZWFuIHtcclxuICAgIGNvbnN0IHZhbHVlID0gbXNnLmlzX3JlYWQ7XHJcbiAgICByZXR1cm4gdmFsdWUgPT09IHRydWUgfHwgdmFsdWUgPT09ICd0cnVlJyB8fCB2YWx1ZSA9PT0gJ1RydWUnIHx8IHZhbHVlID09PSAnMSc7XHJcbiAgfVxyXG5cclxuICBnZXRSZWFkVG9vbHRpcChtc2c6IE1lc3NhZ2UpOiBzdHJpbmcge1xyXG4gICAgaWYgKCF0aGlzLmlzR3JvdXApIHJldHVybiAnUmVhZCc7XHJcblxyXG4gICAgY29uc3QgbmFtZXMgPSB0aGlzLmdldFJlYWRCeU5hbWVzKG1zZyk7XHJcbiAgICBpZiAobmFtZXMubGVuZ3RoID4gMCkge1xyXG4gICAgICByZXR1cm4gYFJlYWQgYnkgJHtuYW1lcy5qb2luKCcsICcpfWA7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuICdSZWFkJztcclxuICB9XHJcblxyXG4gIHByaXZhdGUgZ2V0UmVhZEJ5TmFtZXMobXNnOiBNZXNzYWdlKTogc3RyaW5nW10ge1xyXG4gICAgY29uc3QgYW55TXNnID0gbXNnIGFzIGFueTtcclxuICAgIGNvbnN0IHJhd05hbWVzID0gW1xyXG4gICAgICAuLi50aGlzLnRvUmVhZEFycmF5KGFueU1zZy5yZWFkX2J5X25hbWVzKSxcclxuICAgICAgLi4udGhpcy50b1JlYWRBcnJheShhbnlNc2cucmVhZEJ5TmFtZXMpLFxyXG4gICAgICAuLi50aGlzLnRvUmVhZEFycmF5KGFueU1zZy5yZWFkZXJfbmFtZXMpLFxyXG4gICAgICAuLi50aGlzLnRvUmVhZEFycmF5KGFueU1zZy5yZWFkZXJzKSxcclxuICAgICAgLi4udGhpcy50b1JlYWRBcnJheShhbnlNc2cucmVhZF9ieSksXHJcbiAgICAgIC4uLnRoaXMudG9SZWFkQXJyYXkoYW55TXNnLnJlYWRCeSksXHJcbiAgICBdO1xyXG5cclxuICAgIGNvbnN0IG5hbWVzID0gcmF3TmFtZXNcclxuICAgICAgLm1hcCgoZW50cnkpID0+IHRoaXMucmVhZEVudHJ5VG9OYW1lKGVudHJ5KSlcclxuICAgICAgLmZpbHRlcigobmFtZSk6IG5hbWUgaXMgc3RyaW5nID0+ICEhbmFtZSAmJiBuYW1lICE9PSAnWW91Jyk7XHJcblxyXG4gICAgcmV0dXJuIEFycmF5LmZyb20obmV3IFNldChuYW1lcykpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSB0b1JlYWRBcnJheSh2YWx1ZTogdW5rbm93bik6IHVua25vd25bXSB7XHJcbiAgICBpZiAoIXZhbHVlKSByZXR1cm4gW107XHJcbiAgICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHJldHVybiB2YWx1ZTtcclxuICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKSB7XHJcbiAgICAgIGNvbnN0IHRyaW1tZWQgPSB2YWx1ZS50cmltKCk7XHJcbiAgICAgIGlmICghdHJpbW1lZCkgcmV0dXJuIFtdO1xyXG4gICAgICB0cnkge1xyXG4gICAgICAgIGNvbnN0IHBhcnNlZCA9IEpTT04ucGFyc2UodHJpbW1lZCk7XHJcbiAgICAgICAgcmV0dXJuIEFycmF5LmlzQXJyYXkocGFyc2VkKSA/IHBhcnNlZCA6IFtwYXJzZWRdO1xyXG4gICAgICB9IGNhdGNoIHtcclxuICAgICAgICByZXR1cm4gdHJpbW1lZC5pbmNsdWRlcygnLCcpID8gdHJpbW1lZC5zcGxpdCgnLCcpLm1hcCgodikgPT4gdi50cmltKCkpIDogW3RyaW1tZWRdO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gW3ZhbHVlXTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgcmVhZEVudHJ5VG9OYW1lKGVudHJ5OiB1bmtub3duKTogc3RyaW5nIHwgbnVsbCB7XHJcbiAgICBpZiAoZW50cnkgPT0gbnVsbCkgcmV0dXJuIG51bGw7XHJcbiAgICBpZiAodHlwZW9mIGVudHJ5ID09PSAnc3RyaW5nJyB8fCB0eXBlb2YgZW50cnkgPT09ICdudW1iZXInKSB7XHJcbiAgICAgIGNvbnN0IGlkT3JOYW1lID0gU3RyaW5nKGVudHJ5KS50cmltKCk7XHJcbiAgICAgIGNvbnN0IGNvbnRhY3QgPSB0aGlzLnZpc2libGVDb250YWN0cy5maW5kKChjKSA9PiBTdHJpbmcoYy5jb250YWN0X2lkKSA9PT0gaWRPck5hbWUpO1xyXG4gICAgICByZXR1cm4gY29udGFjdCA/IGdldENvbnRhY3REaXNwbGF5TmFtZShjb250YWN0KSA6IGlkT3JOYW1lO1xyXG4gICAgfVxyXG4gICAgaWYgKHR5cGVvZiBlbnRyeSA9PT0gJ29iamVjdCcpIHtcclxuICAgICAgY29uc3Qgb2JqID0gZW50cnkgYXMgYW55O1xyXG4gICAgICBjb25zdCBleHBsaWNpdCA9IG9iai51c2VybmFtZSB8fCBvYmoubmFtZSB8fCBvYmouZGlzcGxheV9uYW1lIHx8IG9iai5kaXNwbGF5TmFtZSB8fCBvYmouZW1haWw7XHJcbiAgICAgIGlmIChleHBsaWNpdCkgcmV0dXJuIFN0cmluZyhleHBsaWNpdCk7XHJcbiAgICAgIGlmIChvYmouY29udGFjdF9pZCB8fCBvYmouY29udGFjdElkKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMucmVhZEVudHJ5VG9OYW1lKG9iai5jb250YWN0X2lkIHx8IG9iai5jb250YWN0SWQpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gbnVsbDtcclxuICB9XHJcblxyXG4gIGdldFNlbmRlck5hbWUobXNnOiBNZXNzYWdlKTogc3RyaW5nIHtcclxuICAgIGNvbnN0IGZyb21NZXNzYWdlID0gZ2V0TWVzc2FnZVNlbmRlck5hbWUobXNnKTtcclxuICAgIGlmIChmcm9tTWVzc2FnZSAmJiBmcm9tTWVzc2FnZSAhPT0gJ1Vua25vd24nKSB7XHJcbiAgICAgIHJldHVybiBmcm9tTWVzc2FnZTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBmcm9tQ29udGFjdHMgPSB0aGlzLnZpc2libGVDb250YWN0cy5maW5kKFxyXG4gICAgICAoYykgPT4gU3RyaW5nKGMuY29udGFjdF9pZCkgPT09IFN0cmluZyhtc2cuc2VuZGVyX2lkKVxyXG4gICAgKTtcclxuICAgIGlmIChmcm9tQ29udGFjdHMpIHtcclxuICAgICAgcmV0dXJuIGdldENvbnRhY3REaXNwbGF5TmFtZShmcm9tQ29udGFjdHMpO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICh0aGlzLmlzT3duTWVzc2FnZShtc2cpKSB7XHJcbiAgICAgIHJldHVybiAnWW91JztcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gYFVzZXIgJHttc2cuc2VuZGVyX2lkfWA7XHJcbiAgfVxyXG5cclxuICBmb3JtYXRUaW1lKGRhdGVTdHI6IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgICBpZiAoIWRhdGVTdHIpIHJldHVybiAnJztcclxuICAgIGNvbnN0IGQgPSBuZXcgRGF0ZShkYXRlU3RyKTtcclxuICAgIHJldHVybiBkLnRvTG9jYWxlVGltZVN0cmluZygnZW4tR0InLCB7IGhvdXI6ICcyLWRpZ2l0JywgbWludXRlOiAnMi1kaWdpdCcgfSk7XHJcbiAgfVxyXG5cclxuICBmb3JtYXREYXRlKGRhdGVTdHI6IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgICBjb25zdCBkID0gbmV3IERhdGUoZGF0ZVN0cik7XHJcbiAgICBjb25zdCB0b2RheSA9IG5ldyBEYXRlKCk7XHJcbiAgICBjb25zdCB5ZXN0ZXJkYXkgPSBuZXcgRGF0ZSh0b2RheSk7XHJcbiAgICB5ZXN0ZXJkYXkuc2V0RGF0ZSh5ZXN0ZXJkYXkuZ2V0RGF0ZSgpIC0gMSk7XHJcblxyXG4gICAgaWYgKGQudG9EYXRlU3RyaW5nKCkgPT09IHRvZGF5LnRvRGF0ZVN0cmluZygpKSByZXR1cm4gJ1RvZGF5JztcclxuICAgIGlmIChkLnRvRGF0ZVN0cmluZygpID09PSB5ZXN0ZXJkYXkudG9EYXRlU3RyaW5nKCkpIHJldHVybiAnWWVzdGVyZGF5JztcclxuICAgIHJldHVybiBkLnRvTG9jYWxlRGF0ZVN0cmluZygnZW4tR0InLCB7IGRheTogJ251bWVyaWMnLCBtb250aDogJ3Nob3J0JywgeWVhcjogJ251bWVyaWMnIH0pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBzY3JvbGxUb0JvdHRvbSgpOiB2b2lkIHtcclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IGVsID0gdGhpcy5zY3JvbGxDb250YWluZXI/Lm5hdGl2ZUVsZW1lbnQ7XHJcbiAgICAgIGlmIChlbCkge1xyXG4gICAgICAgIGVsLnNjcm9sbFRvcCA9IGVsLnNjcm9sbEhlaWdodDtcclxuICAgICAgfVxyXG4gICAgfSBjYXRjaCB7IC8qIGlnbm9yZSAqLyB9XHJcbiAgfVxyXG5cclxuICAvLyDilIDilIAgTWVkaWEgaGVscGVycyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuXHJcbiAgcHJpdmF0ZSBnZXRGaWxlbmFtZUxpa2UobXNnOiBNZXNzYWdlLCBhdHRhY2htZW50PzogQXR0YWNobWVudCk6IHN0cmluZyB7XHJcbiAgICBjb25zdCBhbnlNc2cgPSBtc2cgYXMgYW55O1xyXG4gICAgcmV0dXJuIFN0cmluZyhcclxuICAgICAgYXR0YWNobWVudD8uZmlsZW5hbWUgfHxcclxuICAgICAgdGhpcy5nZXRQcmltYXJ5QXR0YWNobWVudChtc2cpPy5maWxlbmFtZSB8fFxyXG4gICAgICBhbnlNc2c/LmZpbGVuYW1lIHx8XHJcbiAgICAgIGFueU1zZz8uZmlsZV9uYW1lIHx8XHJcbiAgICAgIG1zZy5jb250ZW50IHx8XHJcbiAgICAgICcnXHJcbiAgICApLnRvTG93ZXJDYXNlKCk7XHJcbiAgfVxyXG5cclxuICBnZXRSZW5kZXJhYmxlQXR0YWNobWVudHMobXNnOiBNZXNzYWdlKTogQXR0YWNobWVudFtdIHtcclxuICAgIGNvbnN0IGF0dGFjaG1lbnRzID0gdGhpcy5nZXRBbGxBdHRhY2htZW50cyhtc2cpO1xyXG4gICAgaWYgKGF0dGFjaG1lbnRzLmxlbmd0aCA+IDApIHJldHVybiBhdHRhY2htZW50cztcclxuICAgIGNvbnN0IHByaW1hcnkgPSB0aGlzLmdldFByaW1hcnlBdHRhY2htZW50KG1zZyk7XHJcbiAgICByZXR1cm4gcHJpbWFyeSA/IFtwcmltYXJ5XSA6IFtdO1xyXG4gIH1cclxuXHJcbiAgdHJhY2tCeUF0dGFjaG1lbnQoaW5kZXg6IG51bWJlciwgYXR0YWNobWVudDogQXR0YWNobWVudCk6IHN0cmluZyB7XHJcbiAgICByZXR1cm4gYXR0YWNobWVudC5maWxlX2lkIHx8IGF0dGFjaG1lbnQudXJsIHx8IGAke2F0dGFjaG1lbnQuZmlsZW5hbWV9LSR7aW5kZXh9YDtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgZ2V0QWxsQXR0YWNobWVudHMobXNnOiBNZXNzYWdlKTogQXR0YWNobWVudFtdIHtcclxuICAgIGNvbnN0IGFueU1zZyA9IG1zZyBhcyBhbnk7XHJcbiAgICBjb25zdCBhdHRhY2htZW50czogQXR0YWNobWVudFtdID0gW107XHJcbiAgICBjb25zdCBhZGQgPSAoYXR0YWNobWVudDogUGFydGlhbDxBdHRhY2htZW50PiB8IHN0cmluZyB8IG51bGwgfCB1bmRlZmluZWQpOiB2b2lkID0+IHtcclxuICAgICAgY29uc3QgcmF3ID0gYXR0YWNobWVudCBhcyBhbnk7XHJcbiAgICAgIGNvbnN0IGZpbGVJZCA9IFN0cmluZyhcclxuICAgICAgICB0eXBlb2YgYXR0YWNobWVudCA9PT0gJ3N0cmluZycgPyBhdHRhY2htZW50IDpcclxuICAgICAgICByYXc/LmZpbGVfaWQgPz9cclxuICAgICAgICByYXc/LmZpbGVJZCA/P1xyXG4gICAgICAgIHJhdz8uaWQgPz9cclxuICAgICAgICByYXc/LmF0dGFjaG1lbnRfaWQgPz9cclxuICAgICAgICByYXc/LnN0b3JhZ2VfZmlsZV9pZCA/P1xyXG4gICAgICAgICcnXHJcbiAgICAgICkudHJpbSgpO1xyXG4gICAgICBpZiAoZmlsZUlkLnN0YXJ0c1dpdGgoJ3snKSB8fCBmaWxlSWQuc3RhcnRzV2l0aCgnWycpKSB7XHJcbiAgICAgICAgY29uc3QgaWRzID0gdGhpcy50b0FycmF5KGZpbGVJZCk7XHJcbiAgICAgICAgY29uc3QgZmlsZW5hbWVzID0gdGhpcy50b0FycmF5KHJhdz8uZmlsZW5hbWVzID8/IHJhdz8uZmlsZW5hbWUgPz8gcmF3Py5maWxlX25hbWUpO1xyXG4gICAgICAgIGNvbnN0IG1pbWVUeXBlcyA9IHRoaXMudG9BcnJheShyYXc/Lm1pbWVfdHlwZXMgPz8gcmF3Py5taW1lVHlwZXMgPz8gcmF3Py5taW1lX3R5cGUpO1xyXG4gICAgICAgIGlkcy5mb3JFYWNoKChpZCwgaWR4KSA9PiB7XHJcbiAgICAgICAgICBhZGQoe1xyXG4gICAgICAgICAgICBmaWxlX2lkOiBpZCxcclxuICAgICAgICAgICAgZmlsZW5hbWU6IGZpbGVuYW1lc1tpZHhdIHx8IGZpbGVuYW1lc1swXSB8fCByYXc/LmZpbGVuYW1lIHx8IHJhdz8uZmlsZV9uYW1lIHx8IGBBdHRhY2htZW50ICR7aWR4ICsgMX1gLFxyXG4gICAgICAgICAgICBtaW1lX3R5cGU6IG1pbWVUeXBlc1tpZHhdIHx8IHJhdz8ubWltZV90eXBlIHx8IHJhdz8ubWltZVR5cGUsXHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICB9KTtcclxuICAgICAgICByZXR1cm47XHJcbiAgICAgIH1cclxuICAgICAgY29uc3QgdXJsID0gU3RyaW5nKHJhdz8udXJsID8/IHJhdz8uZmlsZV91cmwgPz8gcmF3Py5kb3dubG9hZF91cmwgPz8gJycpLnRyaW0oKTtcclxuICAgICAgaWYgKCFmaWxlSWQgJiYgIXVybCkgcmV0dXJuO1xyXG4gICAgICBpZiAoZmlsZUlkICYmIGF0dGFjaG1lbnRzLnNvbWUoKGEpID0+IGEuZmlsZV9pZCA9PT0gZmlsZUlkKSkgcmV0dXJuO1xyXG4gICAgICBpZiAoIWZpbGVJZCAmJiB1cmwgJiYgYXR0YWNobWVudHMuc29tZSgoYSkgPT4gYS51cmwgPT09IHVybCkpIHJldHVybjtcclxuICAgICAgYXR0YWNobWVudHMucHVzaCh7XHJcbiAgICAgICAgZmlsZV9pZDogZmlsZUlkLFxyXG4gICAgICAgIGZpbGVuYW1lOiBTdHJpbmcoXHJcbiAgICAgICAgICByYXc/LmZpbGVuYW1lID8/XHJcbiAgICAgICAgICByYXc/LmZpbGVfbmFtZSA/P1xyXG4gICAgICAgICAgcmF3Py5uYW1lID8/XHJcbiAgICAgICAgICAnRmlsZSdcclxuICAgICAgICApLFxyXG4gICAgICAgIG1pbWVfdHlwZTogcmF3Py5taW1lX3R5cGUgPz8gcmF3Py5taW1lVHlwZSxcclxuICAgICAgICBzaXplX2J5dGVzOiByYXc/LnNpemVfYnl0ZXMgPz8gcmF3Py5zaXplQnl0ZXMsXHJcbiAgICAgICAgdXJsOiB1cmwgfHwgdW5kZWZpbmVkLFxyXG4gICAgICB9KTtcclxuICAgIH07XHJcblxyXG4gICAgaWYgKEFycmF5LmlzQXJyYXkobXNnLmF0dGFjaG1lbnRzKSkge1xyXG4gICAgICBtc2cuYXR0YWNobWVudHMuZm9yRWFjaChhZGQpO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IG1lZGlhVmFsdWUgPSBTdHJpbmcobXNnLm1lZGlhX3VybCB8fCAnJykudHJpbSgpO1xyXG4gICAgaWYgKG1lZGlhVmFsdWUuc3RhcnRzV2l0aCgneycpIHx8IG1lZGlhVmFsdWUuc3RhcnRzV2l0aCgnWycpKSB7XHJcbiAgICAgIHRyeSB7XHJcbiAgICAgICAgY29uc3QgcGFyc2VkID0gSlNPTi5wYXJzZShtZWRpYVZhbHVlKTtcclxuICAgICAgICBjb25zdCBtZWRpYUF0dGFjaG1lbnRzID0gQXJyYXkuaXNBcnJheShwYXJzZWQpID8gcGFyc2VkIDogcGFyc2VkPy5hdHRhY2htZW50cztcclxuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShtZWRpYUF0dGFjaG1lbnRzKSkge1xyXG4gICAgICAgICAgbWVkaWFBdHRhY2htZW50cy5mb3JFYWNoKGFkZCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICghQXJyYXkuaXNBcnJheShwYXJzZWQpKSB7XHJcbiAgICAgICAgICBjb25zdCBpZHMgPSB0aGlzLnRvQXJyYXkocGFyc2VkPy5pZHMgPz8gcGFyc2VkPy5maWxlX2lkcyA/PyBwYXJzZWQ/LmF0dGFjaG1lbnRfaWRzKTtcclxuICAgICAgICAgIGNvbnN0IGZpbGVuYW1lcyA9IHRoaXMudG9BcnJheShwYXJzZWQ/LmZpbGVuYW1lcyk7XHJcbiAgICAgICAgICBjb25zdCBtaW1lVHlwZXMgPSB0aGlzLnRvQXJyYXkocGFyc2VkPy5taW1lX3R5cGVzID8/IHBhcnNlZD8ubWltZVR5cGVzKTtcclxuICAgICAgICAgIGlkcy5mb3JFYWNoKChpZCwgaWR4KSA9PiB7XHJcbiAgICAgICAgICAgIGFkZCh7XHJcbiAgICAgICAgICAgICAgZmlsZV9pZDogaWQsXHJcbiAgICAgICAgICAgICAgZmlsZW5hbWU6IGZpbGVuYW1lc1tpZHhdIHx8IGZpbGVuYW1lc1swXSB8fCBgQXR0YWNobWVudCAke2lkeCArIDF9YCxcclxuICAgICAgICAgICAgICBtaW1lX3R5cGU6IG1pbWVUeXBlc1tpZHhdLFxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgICAgfSBjYXRjaCB7XHJcbiAgICAgICAgLy8gTm9uLUpTT04gbWVkaWFfdXJsIHZhbHVlcyBhcmUgaGFuZGxlZCBieSBnZXRQcmltYXJ5QXR0YWNobWVudCgpLlxyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgaWRzID0gdGhpcy50b0FycmF5KGFueU1zZz8uYXR0YWNobWVudF9pZHMgPz8gYW55TXNnPy5maWxlX2lkcyk7XHJcbiAgICBjb25zdCBmaWxlbmFtZXMgPSB0aGlzLnRvQXJyYXkoYW55TXNnPy5maWxlbmFtZXMpO1xyXG4gICAgY29uc3QgbWltZVR5cGVzID0gdGhpcy50b0FycmF5KGFueU1zZz8ubWltZV90eXBlcyA/PyBhbnlNc2c/Lm1pbWVUeXBlcyk7XHJcbiAgICBpZHMuZm9yRWFjaCgoaWQsIGlkeCkgPT4ge1xyXG4gICAgICBhZGQoe1xyXG4gICAgICAgIGZpbGVfaWQ6IGlkLFxyXG4gICAgICAgIGZpbGVuYW1lOiBmaWxlbmFtZXNbaWR4XSB8fCBmaWxlbmFtZXNbMF0gfHwgYEF0dGFjaG1lbnQgJHtpZHggKyAxfWAsXHJcbiAgICAgICAgbWltZV90eXBlOiBtaW1lVHlwZXNbaWR4XSB8fCBhbnlNc2c/Lm1pbWVfdHlwZSB8fCBhbnlNc2c/LmF0dGFjaG1lbnRfbWltZV90eXBlLFxyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG5cclxuICAgIHJldHVybiBhdHRhY2htZW50cztcclxuICB9XHJcblxyXG4gIHByaXZhdGUgdG9BcnJheSh2YWx1ZTogdW5rbm93bik6IHN0cmluZ1tdIHtcclxuICAgIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkge1xyXG4gICAgICByZXR1cm4gdmFsdWVcclxuICAgICAgICAubWFwKCh4OiBhbnkpID0+ICh0eXBlb2YgeCA9PT0gJ3N0cmluZycgPyB4IDogeD8uZmlsZV9pZCA/PyB4Py5pZCA/PyAnJykpXHJcbiAgICAgICAgLm1hcCgoeCkgPT4gU3RyaW5nKHgpLnRyaW0oKSlcclxuICAgICAgICAuZmlsdGVyKEJvb2xlYW4pO1xyXG4gICAgfVxyXG4gICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycgJiYgdmFsdWUudHJpbSgpKSB7XHJcbiAgICAgIGNvbnN0IHRyaW1tZWQgPSB2YWx1ZS50cmltKCk7XHJcbiAgICAgIGlmICh0cmltbWVkLnN0YXJ0c1dpdGgoJ3snKSB8fCB0cmltbWVkLnN0YXJ0c1dpdGgoJ1snKSkge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICBjb25zdCBwYXJzZWQgPSBKU09OLnBhcnNlKHRyaW1tZWQpO1xyXG4gICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkocGFyc2VkKSkgcmV0dXJuIHRoaXMudG9BcnJheShwYXJzZWQpO1xyXG4gICAgICAgICAgcmV0dXJuIHRoaXMudG9BcnJheShwYXJzZWQ/LmlkcyA/PyBwYXJzZWQ/LmZpbGVfaWRzID8/IHBhcnNlZD8uYXR0YWNobWVudF9pZHMgPz8gcGFyc2VkPy5hdHRhY2htZW50cyk7XHJcbiAgICAgICAgfSBjYXRjaCB7XHJcbiAgICAgICAgICByZXR1cm4gW107XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiB2YWx1ZVxyXG4gICAgICAgIC5zcGxpdCgvWyxcXHNdKy8pXHJcbiAgICAgICAgLm1hcCgoeCkgPT4geC50cmltKCkpXHJcbiAgICAgICAgLmZpbHRlcihCb29sZWFuKTtcclxuICAgIH1cclxuICAgIHJldHVybiBbXTtcclxuICB9XHJcblxyXG4gIC8qKiBSZXR1cm5zIHRoZSBwcmltYXJ5IGF0dGFjaG1lbnQgZm9yIGEgbWVzc2FnZSwgaWYgYW55LiAqL1xyXG4gIHByaXZhdGUgZ2V0UHJpbWFyeUF0dGFjaG1lbnQobXNnOiBNZXNzYWdlKTogQXR0YWNobWVudCB8IG51bGwge1xyXG4gICAgY29uc3QgYXR0YWNobWVudHMgPSB0aGlzLmdldEFsbEF0dGFjaG1lbnRzKG1zZyk7XHJcbiAgICBpZiAoYXR0YWNobWVudHMubGVuZ3RoID4gMCkgcmV0dXJuIGF0dGFjaG1lbnRzWzBdO1xyXG5cclxuICAgIC8vIFNvbWUgQVBJIHJlc3BvbnNlcyBwcm92aWRlIGZpbGUgbWV0YWRhdGEgaW4gYWx0ZXJuYXRlIGZpZWxkcy5cclxuICAgIGNvbnN0IGFueU1zZyA9IG1zZyBhcyBhbnk7XHJcbiAgICBjb25zdCBtdSA9IFN0cmluZyhtc2cubWVkaWFfdXJsIHx8ICcnKS50cmltKCk7XHJcbiAgICBjb25zdCBtZWRpYUlzRGlyZWN0VXJsID1cclxuICAgICAgbXUuc3RhcnRzV2l0aCgnaHR0cDovLycpIHx8IG11LnN0YXJ0c1dpdGgoJ2h0dHBzOi8vJykgfHwgbXUuc3RhcnRzV2l0aCgnZGF0YTonKTtcclxuICAgIGNvbnN0IG1lZGlhSXNTdHJ1Y3R1cmVkID0gbXUuc3RhcnRzV2l0aCgneycpIHx8IG11LnN0YXJ0c1dpdGgoJ1snKTtcclxuICAgIGNvbnN0IGZpbGVJZCA9XHJcbiAgICAgIGFueU1zZz8uZmlsZV9pZCB8fFxyXG4gICAgICBhbnlNc2c/LmF0dGFjaG1lbnRfaWQgfHxcclxuICAgICAgYW55TXNnPy5hdHRhY2htZW50X2lkcz8uWzBdIHx8XHJcbiAgICAgICghbWVkaWFJc0RpcmVjdFVybCAmJiAhbWVkaWFJc1N0cnVjdHVyZWQgJiYgbXUgPyBtdSA6IHVuZGVmaW5lZCk7XHJcbiAgICBjb25zdCBtaW1lID0gYW55TXNnPy5taW1lX3R5cGUgfHwgYW55TXNnPy5hdHRhY2htZW50X21pbWVfdHlwZTtcclxuICAgIGNvbnN0IGV4cGxpY2l0RmlsZW5hbWUgPSBhbnlNc2c/LmZpbGVuYW1lIHx8IGFueU1zZz8uZmlsZV9uYW1lO1xyXG4gICAgY29uc3QgZmlsZW5hbWUgPVxyXG4gICAgICBleHBsaWNpdEZpbGVuYW1lIHx8XHJcbiAgICAgIChmaWxlSWQgfHwgbWltZSB8fCBtc2cubWVzc2FnZV90eXBlICE9PSAnVEVYVCcgPyBtc2cuY29udGVudCA6ICcnKTtcclxuICAgIGlmIChmaWxlSWQgfHwgZXhwbGljaXRGaWxlbmFtZSB8fCBtaW1lIHx8IG1zZy5tZXNzYWdlX3R5cGUgPT09ICdGSUxFJyB8fCBtc2cubWVzc2FnZV90eXBlID09PSAnSU1BR0UnKSB7XHJcbiAgICAgIHJldHVybiB7XHJcbiAgICAgICAgZmlsZV9pZDogU3RyaW5nKGZpbGVJZCB8fCAnJyksXHJcbiAgICAgICAgZmlsZW5hbWU6IFN0cmluZyhmaWxlbmFtZSB8fCAnRmlsZScpLFxyXG4gICAgICAgIG1pbWVfdHlwZTogbWltZSA/IFN0cmluZyhtaW1lKSA6IHVuZGVmaW5lZCxcclxuICAgICAgICB1cmw6IG1lZGlhSXNEaXJlY3RVcmwgPyBtdSA6IHVuZGVmaW5lZCxcclxuICAgICAgfTtcclxuICAgIH1cclxuICAgIHJldHVybiBudWxsO1xyXG4gIH1cclxuXHJcbiAgaXNJbWFnZUF0dGFjaG1lbnQobXNnOiBNZXNzYWdlLCBhdHRhY2htZW50PzogQXR0YWNobWVudCk6IGJvb2xlYW4ge1xyXG4gICAgY29uc3QgbWltZSA9IGF0dGFjaG1lbnQ/Lm1pbWVfdHlwZSB8fCB0aGlzLmdldFByaW1hcnlBdHRhY2htZW50KG1zZyk/Lm1pbWVfdHlwZSB8fCAnJztcclxuICAgIGlmIChtaW1lLnN0YXJ0c1dpdGgoJ2ltYWdlLycpKSByZXR1cm4gdHJ1ZTtcclxuICAgIGNvbnN0IG5hbWUgPSB0aGlzLmdldEZpbGVuYW1lTGlrZShtc2csIGF0dGFjaG1lbnQpO1xyXG4gICAgaWYgKC9cXC4ocG5nfGpwZT9nfGdpZnx3ZWJwfGJtcHxzdmd8aGVpY3xoZWlmKSQvaS50ZXN0KG5hbWUpKSByZXR1cm4gdHJ1ZTtcclxuICAgIHJldHVybiAhYXR0YWNobWVudCAmJiBtc2cubWVzc2FnZV90eXBlID09PSAnSU1BR0UnO1xyXG4gIH1cclxuXHJcbiAgLyoqIFJldHVybnMgdGhlIGNhY2hlZCBkYXRhIFVSTCBmb3IgYSBtZXNzYWdlJ3MgbWVkaWEsIG9yIG51bGwgYW5kIHRyaWdnZXJzIGJhY2tncm91bmQgbG9hZC4gKi9cclxuICBnZXRNZWRpYVVybChtc2c6IE1lc3NhZ2UsIGF0dGFjaG1lbnQ/OiBBdHRhY2htZW50KTogc3RyaW5nIHwgbnVsbCB7XHJcbiAgICBjb25zdCBhdHQgPSBhdHRhY2htZW50IHx8IHRoaXMuZ2V0UHJpbWFyeUF0dGFjaG1lbnQobXNnKTtcclxuICAgIGNvbnN0IGZpbGVJZCA9IGF0dD8uZmlsZV9pZD8udHJpbSgpO1xyXG5cclxuICAgIGNvbnN0IGRpcmVjdFVybCA9XHJcbiAgICAgIGF0dD8udXJsIHx8XHJcbiAgICAgICghYXR0YWNobWVudCA/IG1zZy5tZWRpYV91cmwgOiB1bmRlZmluZWQpIHx8XHJcbiAgICAgICghYXR0YWNobWVudCA/IChtc2cgYXMgYW55KT8udXJsIDogdW5kZWZpbmVkKSB8fFxyXG4gICAgICAoIWF0dGFjaG1lbnQgPyAobXNnIGFzIGFueSk/LmZpbGVfdXJsIDogdW5kZWZpbmVkKTtcclxuICAgIGlmIChcclxuICAgICAgZGlyZWN0VXJsICYmXHJcbiAgICAgIChkaXJlY3RVcmwuc3RhcnRzV2l0aCgnaHR0cDovLycpIHx8XHJcbiAgICAgICAgZGlyZWN0VXJsLnN0YXJ0c1dpdGgoJ2h0dHBzOi8vJykgfHxcclxuICAgICAgICBkaXJlY3RVcmwuc3RhcnRzV2l0aCgnZGF0YTonKSlcclxuICAgICkge1xyXG4gICAgICByZXR1cm4gZGlyZWN0VXJsO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICghZmlsZUlkKSB7XHJcbiAgICAgIHJldHVybiBudWxsO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGNhY2hlZCA9IHRoaXMuZmlsZVNlcnZpY2UuZ2V0Q2FjaGVkRGF0YVVybChmaWxlSWQpO1xyXG4gICAgaWYgKGNhY2hlZCkgcmV0dXJuIGNhY2hlZDtcclxuICAgIGlmICh0aGlzLm1lZGlhRmFpbGVkLmhhcyhmaWxlSWQpKSByZXR1cm4gbnVsbDtcclxuXHJcbiAgICAvLyBOb3QgeWV0IGNhY2hlZCDigJQga2ljayBvZmYgYSBiYWNrZ3JvdW5kIGZldGNoXHJcbiAgICB0aGlzLmZldGNoTWVkaWEoZmlsZUlkKTtcclxuICAgIHJldHVybiBudWxsO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBwcmV3YXJtTWVkaWEobWVzc2FnZXM6IE1lc3NhZ2VbXSk6IHZvaWQge1xyXG4gICAgZm9yIChjb25zdCBtc2cgb2YgbWVzc2FnZXMpIHtcclxuICAgICAgZm9yIChjb25zdCBhdHQgb2YgdGhpcy5nZXRSZW5kZXJhYmxlQXR0YWNobWVudHMobXNnKSkge1xyXG4gICAgICAgIGlmICghdGhpcy5pc0ltYWdlQXR0YWNobWVudChtc2csIGF0dCkpIGNvbnRpbnVlO1xyXG4gICAgICAgIGNvbnN0IGZpbGVJZCA9IGF0dC5maWxlX2lkPy50cmltKCk7XHJcbiAgICAgICAgaWYgKCFmaWxlSWQgfHwgZmlsZUlkLnN0YXJ0c1dpdGgoJ3RlbXAtJykpIGNvbnRpbnVlO1xyXG4gICAgICAgIGlmICh0aGlzLm1lZGlhRmFpbGVkLmhhcyhmaWxlSWQpKSBjb250aW51ZTtcclxuICAgICAgICBpZiAodGhpcy5maWxlU2VydmljZS5nZXRDYWNoZWREYXRhVXJsKGZpbGVJZCkpIGNvbnRpbnVlO1xyXG4gICAgICAgIC8vIFF1ZXVlIGFsbCBmaWxlcyBzbyBkb3dubG9hZCBsaW5rcyBhcHBlYXIgb25jZSByZXRyaWV2YWwgY29tcGxldGVzLlxyXG4gICAgICAgIHRoaXMuZmV0Y2hNZWRpYShmaWxlSWQpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGZldGNoTWVkaWEoZmlsZUlkOiBzdHJpbmcpOiB2b2lkIHtcclxuICAgIGlmICghZmlsZUlkIHx8IGZpbGVJZC5zdGFydHNXaXRoKCd0ZW1wLScpIHx8IHRoaXMubWVkaWFMb2FkaW5nLmhhcyhmaWxlSWQpIHx8IHRoaXMubWVkaWFGYWlsZWQuaGFzKGZpbGVJZCkpIHJldHVybjtcclxuICAgIHRoaXMubWVkaWFMb2FkaW5nLmFkZChmaWxlSWQpO1xyXG4gICAgdGhpcy5tZWRpYVF1ZXVlLnB1c2goZmlsZUlkKTtcclxuICAgIHRoaXMucHVtcE1lZGlhUXVldWUoKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgcHVtcE1lZGlhUXVldWUoKTogdm9pZCB7XHJcbiAgICB3aGlsZSAodGhpcy5hY3RpdmVNZWRpYVJlcXVlc3RzIDwgdGhpcy5tYXhNZWRpYVJlcXVlc3RzICYmIHRoaXMubWVkaWFRdWV1ZS5sZW5ndGggPiAwKSB7XHJcbiAgICAgIGNvbnN0IGZpbGVJZCA9IHRoaXMubWVkaWFRdWV1ZS5zaGlmdCgpO1xyXG4gICAgICBpZiAoIWZpbGVJZCkgY29udGludWU7XHJcbiAgICAgIHRoaXMuYWN0aXZlTWVkaWFSZXF1ZXN0cyArPSAxO1xyXG5cclxuICAgICAgdGhpcy5maWxlU2VydmljZS5nZXRGaWxlRGF0YVVybChmaWxlSWQpLnN1YnNjcmliZSh7XHJcbiAgICAgICAgbmV4dDogKCkgPT4ge1xyXG4gICAgICAgICAgdGhpcy5maW5pc2hNZWRpYVJlcXVlc3QoZmlsZUlkKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGVycm9yOiAoKSA9PiB7XHJcbiAgICAgICAgICB0aGlzLm1lZGlhRmFpbGVkLmFkZChmaWxlSWQpO1xyXG4gICAgICAgICAgdGhpcy5maW5pc2hNZWRpYVJlcXVlc3QoZmlsZUlkKTtcclxuICAgICAgICB9LFxyXG4gICAgICB9KTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHByaXZhdGUgZmluaXNoTWVkaWFSZXF1ZXN0KGZpbGVJZDogc3RyaW5nKTogdm9pZCB7XHJcbiAgICB0aGlzLmFjdGl2ZU1lZGlhUmVxdWVzdHMgPSBNYXRoLm1heCgwLCB0aGlzLmFjdGl2ZU1lZGlhUmVxdWVzdHMgLSAxKTtcclxuICAgIHRoaXMubWVkaWFMb2FkaW5nLmRlbGV0ZShmaWxlSWQpO1xyXG4gICAgdGhpcy5jZHIubWFya0ZvckNoZWNrKCk7XHJcbiAgICB0aGlzLnB1bXBNZWRpYVF1ZXVlKCk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHJlc2V0TWVkaWFRdWV1ZSgpOiB2b2lkIHtcclxuICAgIHRoaXMubWVkaWFRdWV1ZSA9IFtdO1xyXG4gICAgdGhpcy5tZWRpYUxvYWRpbmcuY2xlYXIoKTtcclxuICAgIHRoaXMuYWN0aXZlTWVkaWFSZXF1ZXN0cyA9IDA7XHJcbiAgfVxyXG5cclxuICBzaG91bGRTaG93TWVkaWFTcGlubmVyKHRhcmdldDogTWVzc2FnZSB8IEF0dGFjaG1lbnQpOiBib29sZWFuIHtcclxuICAgIGNvbnN0IGZpbGVJZCA9IHRoaXMuZ2V0QXR0YWNobWVudEZpbGVJZCh0YXJnZXQpO1xyXG4gICAgaWYgKCFmaWxlSWQgfHwgZmlsZUlkLnN0YXJ0c1dpdGgoJ3RlbXAtJykpIHJldHVybiBmYWxzZTtcclxuICAgIHJldHVybiB0aGlzLm1lZGlhTG9hZGluZy5oYXMoZmlsZUlkKSAmJiAhdGhpcy5tZWRpYUZhaWxlZC5oYXMoZmlsZUlkKTtcclxuICB9XHJcblxyXG4gIGlzVmlkZW9BdHRhY2htZW50KG1zZzogTWVzc2FnZSwgYXR0YWNobWVudD86IEF0dGFjaG1lbnQpOiBib29sZWFuIHtcclxuICAgIGNvbnN0IG1pbWUgPSBhdHRhY2htZW50Py5taW1lX3R5cGUgfHwgdGhpcy5nZXRQcmltYXJ5QXR0YWNobWVudChtc2cpPy5taW1lX3R5cGUgfHwgJyc7XHJcbiAgICBpZiAobWltZS5zdGFydHNXaXRoKCd2aWRlby8nKSkgcmV0dXJuIHRydWU7XHJcbiAgICBjb25zdCBuYW1lID0gdGhpcy5nZXRGaWxlbmFtZUxpa2UobXNnLCBhdHRhY2htZW50KTtcclxuICAgIHJldHVybiAvXFwuKG1wNHx3ZWJtfG1vdnxtNHZ8YXZpfG1rdikkL2kudGVzdChuYW1lKTtcclxuICB9XHJcblxyXG4gIGdldEF0dGFjaG1lbnRNaW1lVHlwZShtc2c6IE1lc3NhZ2UsIGF0dGFjaG1lbnQ/OiBBdHRhY2htZW50KTogc3RyaW5nIHtcclxuICAgIHJldHVybiBhdHRhY2htZW50Py5taW1lX3R5cGUgfHwgdGhpcy5nZXRQcmltYXJ5QXR0YWNobWVudChtc2cpPy5taW1lX3R5cGUgfHwgJ2FwcGxpY2F0aW9uL29jdGV0LXN0cmVhbSc7XHJcbiAgfVxyXG5cclxuICBnZXRBdHRhY2htZW50TmFtZShtc2c6IE1lc3NhZ2UsIGF0dGFjaG1lbnQ/OiBBdHRhY2htZW50KTogc3RyaW5nIHtcclxuICAgIHJldHVybiBhdHRhY2htZW50Py5maWxlbmFtZSB8fCB0aGlzLmdldFByaW1hcnlBdHRhY2htZW50KG1zZyk/LmZpbGVuYW1lIHx8IG1zZy5jb250ZW50IHx8ICdGaWxlJztcclxuICB9XHJcblxyXG4gIGhhc0ZpbGVBdHRhY2htZW50KG1zZzogTWVzc2FnZSk6IGJvb2xlYW4ge1xyXG4gICAgcmV0dXJuIG1zZy5tZXNzYWdlX3R5cGUgPT09ICdGSUxFJyB8fCB0aGlzLmdldFJlbmRlcmFibGVBdHRhY2htZW50cyhtc2cpLmxlbmd0aCA+IDA7XHJcbiAgfVxyXG5cclxuICBoYXNNZWRpYUZhaWxlZCh0YXJnZXQ6IE1lc3NhZ2UgfCBBdHRhY2htZW50KTogYm9vbGVhbiB7XHJcbiAgICBjb25zdCBmaWxlSWQgPSB0aGlzLmdldEF0dGFjaG1lbnRGaWxlSWQodGFyZ2V0KTtcclxuICAgIHJldHVybiAhIWZpbGVJZCAmJiB0aGlzLm1lZGlhRmFpbGVkLmhhcyhmaWxlSWQpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBnZXRBdHRhY2htZW50RmlsZUlkKHRhcmdldDogTWVzc2FnZSB8IEF0dGFjaG1lbnQpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xyXG4gICAgaWYgKCdmaWxlX2lkJyBpbiB0YXJnZXQpIHJldHVybiB0YXJnZXQuZmlsZV9pZDtcclxuICAgIHJldHVybiB0aGlzLmdldFByaW1hcnlBdHRhY2htZW50KHRhcmdldCk/LmZpbGVfaWQ7XHJcbiAgfVxyXG5cclxuICBnZXRGaWxlSWNvbihtc2c6IE1lc3NhZ2UsIGF0dGFjaG1lbnQ/OiBBdHRhY2htZW50KTogc3RyaW5nIHtcclxuICAgIGNvbnN0IG1pbWUgPSB0aGlzLmdldEF0dGFjaG1lbnRNaW1lVHlwZShtc2csIGF0dGFjaG1lbnQpO1xyXG4gICAgY29uc3QgbmFtZSA9IHRoaXMuZ2V0QXR0YWNobWVudE5hbWUobXNnLCBhdHRhY2htZW50KS50b0xvd2VyQ2FzZSgpO1xyXG4gICAgaWYgKG1pbWUuc3RhcnRzV2l0aCgndmlkZW8vJykgfHwgL1xcLihtcDR8d2VibXxtb3Z8bTR2fGF2aXxta3YpJC9pLnRlc3QobmFtZSkpIHJldHVybiAndmlkZW9jYW0nO1xyXG4gICAgaWYgKG1pbWUuc3RhcnRzV2l0aCgnYXVkaW8vJykgfHwgL1xcLihtcDN8d2F2fG9nZ3xtNGF8ZmxhYykkL2kudGVzdChuYW1lKSkgcmV0dXJuICdhdWRpb3RyYWNrJztcclxuICAgIGlmIChtaW1lLmluY2x1ZGVzKCdwZGYnKSB8fCBuYW1lLmVuZHNXaXRoKCcucGRmJykpIHJldHVybiAncGljdHVyZV9hc19wZGYnO1xyXG4gICAgaWYgKG1pbWUuaW5jbHVkZXMoJ3NwcmVhZHNoZWV0JykgfHwgbWltZS5pbmNsdWRlcygnZXhjZWwnKSB8fCAvXFwuKHhsc3x4bHN4fGNzdikkL2kudGVzdChuYW1lKSkgcmV0dXJuICd0YWJsZV9jaGFydCc7XHJcbiAgICBpZiAobWltZS5pbmNsdWRlcygnZG9jdW1lbnQnKSB8fCBtaW1lLmluY2x1ZGVzKCd3b3JkJykgfHwgL1xcLihkb2N8ZG9jeHx0eHR8cnRmKSQvaS50ZXN0KG5hbWUpKSByZXR1cm4gJ2Rlc2NyaXB0aW9uJztcclxuICAgIGlmIChtaW1lLmluY2x1ZGVzKCd6aXAnKSB8fCAvXFwuKHppcHxyYXJ8N3p8dGFyfGd6KSQvaS50ZXN0KG5hbWUpKSByZXR1cm4gJ2ZvbGRlcl96aXAnO1xyXG4gICAgcmV0dXJuICdpbnNlcnRfZHJpdmVfZmlsZSc7XHJcbiAgfVxyXG5cclxuICBvcGVuTGlnaHRib3goZGF0YVVybDogc3RyaW5nLCBldmVudD86IEV2ZW50KTogdm9pZCB7XHJcbiAgICBldmVudD8uc3RvcFByb3BhZ2F0aW9uKCk7XHJcbiAgICB0aGlzLmxpZ2h0Ym94T3Blbi5lbWl0KGRhdGFVcmwpO1xyXG4gIH1cclxuXHJcbiAgZG93bmxvYWRBdHRhY2htZW50KG1zZzogTWVzc2FnZSwgYXR0YWNobWVudDogQXR0YWNobWVudCwgZXZlbnQ/OiBFdmVudCk6IHZvaWQge1xyXG4gICAgZXZlbnQ/LnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICBldmVudD8uc3RvcFByb3BhZ2F0aW9uKCk7XHJcblxyXG4gICAgY29uc3QgZGlyZWN0VXJsID0gYXR0YWNobWVudC51cmw7XHJcbiAgICBpZiAoZGlyZWN0VXJsICYmIC9eKGh0dHBzPzp8ZGF0YTopL2kudGVzdChkaXJlY3RVcmwpKSB7XHJcbiAgICAgIHRoaXMudHJpZ2dlckRvd25sb2FkKGRpcmVjdFVybCwgdGhpcy5nZXRBdHRhY2htZW50TmFtZShtc2csIGF0dGFjaG1lbnQpKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGZpbGVJZCA9IGF0dGFjaG1lbnQuZmlsZV9pZD8udHJpbSgpO1xyXG4gICAgaWYgKCFmaWxlSWQgfHwgZmlsZUlkLnN0YXJ0c1dpdGgoJ3RlbXAtJykgfHwgZmlsZUlkLnN0YXJ0c1dpdGgoJ3snKSB8fCBmaWxlSWQuc3RhcnRzV2l0aCgnWycpKSB7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBjYWNoZWQgPSB0aGlzLmZpbGVTZXJ2aWNlLmdldENhY2hlZERhdGFVcmwoZmlsZUlkKTtcclxuICAgIGlmIChjYWNoZWQpIHtcclxuICAgICAgdGhpcy50cmlnZ2VyRG93bmxvYWQoY2FjaGVkLCB0aGlzLmdldEF0dGFjaG1lbnROYW1lKG1zZywgYXR0YWNobWVudCkpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5tZWRpYUxvYWRpbmcuYWRkKGZpbGVJZCk7XHJcbiAgICB0aGlzLmZpbGVTZXJ2aWNlLmdldEZpbGVEYXRhVXJsKGZpbGVJZCkuc3Vic2NyaWJlKHtcclxuICAgICAgbmV4dDogKGRhdGFVcmwpID0+IHtcclxuICAgICAgICB0aGlzLm1lZGlhTG9hZGluZy5kZWxldGUoZmlsZUlkKTtcclxuICAgICAgICB0aGlzLnRyaWdnZXJEb3dubG9hZChkYXRhVXJsLCB0aGlzLmdldEF0dGFjaG1lbnROYW1lKG1zZywgYXR0YWNobWVudCkpO1xyXG4gICAgICAgIHRoaXMuY2RyLm1hcmtGb3JDaGVjaygpO1xyXG4gICAgICB9LFxyXG4gICAgICBlcnJvcjogKCkgPT4ge1xyXG4gICAgICAgIHRoaXMubWVkaWFMb2FkaW5nLmRlbGV0ZShmaWxlSWQpO1xyXG4gICAgICAgIHRoaXMubWVkaWFGYWlsZWQuYWRkKGZpbGVJZCk7XHJcbiAgICAgICAgdGhpcy5jZHIubWFya0ZvckNoZWNrKCk7XHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgdHJpZ2dlckRvd25sb2FkKHVybDogc3RyaW5nLCBmaWxlbmFtZTogc3RyaW5nKTogdm9pZCB7XHJcbiAgICBjb25zdCBsaW5rID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYScpO1xyXG4gICAgbGluay5ocmVmID0gdXJsO1xyXG4gICAgbGluay5kb3dubG9hZCA9IGZpbGVuYW1lIHx8ICdhdHRhY2htZW50JztcclxuICAgIGxpbmsudGFyZ2V0ID0gJ19ibGFuayc7XHJcbiAgICBsaW5rLnJlbCA9ICdub29wZW5lcic7XHJcbiAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGxpbmspO1xyXG4gICAgbGluay5jbGljaygpO1xyXG4gICAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZChsaW5rKTtcclxuICB9XHJcblxyXG4gIC8vIOKUgOKUgCBSZWFjdGlvbnMg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcblxyXG4gIG9uRW1vamlTZWxlY3RlZChlbW9qaTogc3RyaW5nLCBtZXNzYWdlSWQ6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgdGhpcy50b2dnbGVSZWFjdGlvbihlbW9qaSwgbWVzc2FnZUlkKTtcclxuICB9XHJcblxyXG4gIHRvZ2dsZVJlYWN0aW9uKGVtb2ppOiBzdHJpbmcsIG1lc3NhZ2VJZDogc3RyaW5nKTogdm9pZCB7XHJcbiAgICBjb25zdCBtc2cgPSB0aGlzLm1lc3NhZ2VzLmZpbmQobSA9PiBtLm1lc3NhZ2VfaWQgPT09IG1lc3NhZ2VJZCk7XHJcbiAgICBpZiAoIW1zZykgcmV0dXJuO1xyXG4gICAgXHJcbiAgICBjb25zdCByZWFjdGlvbiA9IG1zZy5yZWFjdGlvbnM/LmZpbmQociA9PiByLmVtb2ppID09PSBlbW9qaSk7XHJcbiAgICBpZiAocmVhY3Rpb24/Lmhhc1JlYWN0ZWQpIHtcclxuICAgICAgdGhpcy5zdG9yZS5yZW1vdmVSZWFjdGlvbihtZXNzYWdlSWQsIGVtb2ppKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHRoaXMuc3RvcmUuYWRkUmVhY3Rpb24obWVzc2FnZUlkLCBlbW9qaSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBnZXRSZWFjdG9yVG9vbHRpcChyZWFjdGlvbjogYW55KTogc3RyaW5nIHtcclxuICAgIGlmICghcmVhY3Rpb24/LnJlYWN0b3JzPy5sZW5ndGgpIHJldHVybiAnJztcclxuICAgIHJldHVybiByZWFjdGlvbi5yZWFjdG9ycy5qb2luKCcsICcpO1xyXG4gIH1cclxufVxyXG4iXX0=