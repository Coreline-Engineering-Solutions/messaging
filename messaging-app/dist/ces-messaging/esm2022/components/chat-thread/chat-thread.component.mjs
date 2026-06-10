import { Component, ViewChild, ViewChildren, Output, EventEmitter, } from '@angular/core';
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
import * as i2 from "../../services/messaging-api.service";
import * as i3 from "../../services/auth.service";
import * as i4 from "../../services/messaging-file.service";
import * as i5 from "@angular/platform-browser";
import * as i6 from "@angular/common";
import * as i7 from "@angular/material/icon";
import * as i8 from "@angular/material/button";
import * as i9 from "@angular/material/progress-spinner";
import * as i10 from "@angular/material/tooltip";
export class ChatThreadComponent {
    store;
    api;
    auth;
    fileService;
    cdr;
    sanitizer;
    scrollContainer;
    threadRoot;
    inlineEditTextareas;
    messageInput;
    lightboxOpen = new EventEmitter();
    messages = [];
    visibleContacts = [];
    conversationName = '';
    isGroup = false;
    isProject = false;
    projectDbGid;
    projectGid;
    isRemovedFromGroup = false;
    messageTextScale = 1;
    codeTextScale = 1;
    loading = false;
    myContactId = null;
    replyToMessage = null;
    editingMessage = null;
    editingDraft = '';
    mentionOptions = [];
    conversationId = null;
    sub;
    shouldScrollToBottom = true;
    uploading = false;
    hoveredMessageId = null;
    messageContextMenu = null;
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
    lastMentionConversationId = null;
    lastGroupMembershipVersion = -1;
    constructor(store, api, auth, fileService, cdr, sanitizer) {
        this.store = store;
        this.api = api;
        this.auth = auth;
        this.fileService = fileService;
        this.cdr = cdr;
        this.sanitizer = sanitizer;
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
            if (this.isGroup &&
                this.conversationId &&
                groupMembershipVersion !== this.lastGroupMembershipVersion) {
                this.lastGroupMembershipVersion = groupMembershipVersion;
                this.refreshMentionOptions(true);
            }
            if (convId && convId !== this.conversationId) {
                this.conversationId = convId;
                this.resetMediaQueue();
                this.clearReply();
                this.clearEdit();
                this.shouldScrollToBottom = true;
                const chat = chats.find((c) => c.conversationId === convId);
                this.conversationName = chat?.name || 'Chat';
                this.isGroup = chat?.isGroup || false;
                this.isProject = chat?.isProject || false;
                this.projectDbGid = chat?.dbGid;
                this.projectGid = chat?.projectGid;
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
            this.store.openGroupSettings(this.conversationId, this.conversationName, this.isProject, this.projectDbGid, this.projectGid);
        }
    }
    startReply(message, event) {
        event?.stopPropagation();
        if (this.isDeletedMessage(message) || this.isSystemMessage(message))
            return;
        this.clearEdit();
        this.replyToMessage = message;
        this.messageInput?.focus();
    }
    openMessageContextMenu(message, event) {
        event.preventDefault();
        event.stopPropagation();
        if (this.isDeletedMessage(message) || this.isSystemMessage(message))
            return;
        const hasActions = this.canReplyMessage(message) ||
            this.canEditMessage(message) ||
            this.canDeleteMessage(message);
        if (!hasActions)
            return;
        this.messageContextMenu = {
            message,
            ...this.getContextMenuPosition(event),
            confirmDelete: false,
        };
    }
    getContextMenuPosition(event) {
        const rect = this.threadRoot?.nativeElement?.getBoundingClientRect();
        if (!rect) {
            return {
                x: Math.min(event.clientX, window.innerWidth - 220),
                y: Math.min(event.clientY, window.innerHeight - 160),
            };
        }
        const menuWidth = 210;
        const menuHeight = 170;
        const padding = 8;
        const rawX = event.clientX - rect.left;
        const rawY = event.clientY - rect.top;
        return {
            x: Math.max(padding, Math.min(rawX, rect.width - menuWidth - padding)),
            y: Math.max(padding, Math.min(rawY, rect.height - menuHeight - padding)),
        };
    }
    closeMessageContextMenu() {
        this.messageContextMenu = null;
    }
    replyFromContextMenu() {
        const message = this.messageContextMenu?.message;
        if (!message || !this.canReplyMessage(message))
            return;
        this.startReply(message);
        this.closeMessageContextMenu();
    }
    editFromContextMenu() {
        const message = this.messageContextMenu?.message;
        if (!message || !this.canEditMessage(message))
            return;
        this.closeMessageContextMenu();
        this.startEditMessage(message);
    }
    requestDeleteFromContextMenu() {
        if (!this.messageContextMenu || !this.canDeleteMessage(this.messageContextMenu.message))
            return;
        this.messageContextMenu = { ...this.messageContextMenu, confirmDelete: true };
    }
    confirmDeleteFromContextMenu() {
        const message = this.messageContextMenu?.message;
        if (!message || !this.canDeleteMessage(message))
            return;
        this.closeMessageContextMenu();
        this.store.deleteMessage(message.message_id);
    }
    clearReply() {
        this.replyToMessage = null;
    }
    clearEdit() {
        this.editingMessage = null;
        this.editingDraft = '';
    }
    getReplyPreview(message) {
        const reply = message.reply_to;
        if (!reply)
            return null;
        return {
            senderName: reply.sender_name || 'Message',
            content: this.truncateReplyText(reply.content || 'Attachment'),
        };
    }
    getComposeReplyPreview(message) {
        return {
            senderName: this.getSenderName(message),
            content: this.truncateReplyText(this.getMessageBody(message) || this.getAttachmentName(message)),
        };
    }
    getMessageBody(message) {
        if (this.isDeletedMessage(message))
            return '[This message was deleted]';
        return String(message.content || '');
    }
    isDeletedMessage(message) {
        return Boolean(message.is_deleted || message.deleted_at || message.content === '[deleted]');
    }
    truncateReplyText(value) {
        const text = String(value || '').replace(/\s+/g, ' ').trim();
        return text.length > 120 ? `${text.slice(0, 117)}...` : text || 'Attachment';
    }
    refreshMentionOptions(force = false) {
        if (!this.isGroup || !this.conversationId) {
            this.mentionOptions = [];
            this.lastMentionConversationId = null;
            return;
        }
        const convId = this.conversationId;
        if (!force && this.lastMentionConversationId === convId && this.mentionOptions.length > 0)
            return;
        this.lastMentionConversationId = convId;
        this.api.getConversationParticipants(convId).subscribe({
            next: (members) => {
                const options = members
                    .filter((member) => String(member.contact_id) !== String(this.auth.contactId || ''))
                    .map((member) => this.participantToMentionOption(member))
                    .filter((option) => !!option);
                this.mentionOptions = options.length ? options : this.contactsToMentionOptions();
                this.cdr.markForCheck();
            },
            error: () => {
                this.mentionOptions = this.contactsToMentionOptions();
                this.cdr.markForCheck();
            },
        });
    }
    participantToMentionOption(member) {
        const token = this.toMentionToken(member.username || member.email || String(member.contact_id));
        if (!token)
            return null;
        return {
            contactId: String(member.contact_id),
            label: member.username || member.email || `Contact ${member.contact_id}`,
            token,
        };
    }
    contactsToMentionOptions() {
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
    toMentionToken(value) {
        return String(value || '')
            .trim()
            .replace(/^@/, '')
            .replace(/@.*$/, '')
            .replace(/[^a-zA-Z0-9._-]/g, '')
            .slice(0, 32);
    }
    getMentionIdsFromContent(content) {
        if (!this.isGroup || !content || !this.mentionOptions.length)
            return [];
        const mentionedTokens = new Set(Array.from(content.matchAll(/(^|[^a-zA-Z0-9._-])@([a-zA-Z0-9._-]+)/g))
            .map((match) => match[2].toLowerCase()));
        return this.mentionOptions
            .filter((option) => mentionedTokens.has(option.token.toLowerCase()))
            .map((option) => option.contactId);
    }
    onSendMessage(payload) {
        if (this.isRemovedFromGroup)
            return;
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
                const messageText = payload.text || filenames.join(', ');
                const outgoingText = this.store.prepareOutgoingMessageContent(messageText, this.replyToMessage, payload.forcePlainText);
                const replyTo = this.replyToMessage ? {
                    message_id: String(this.replyToMessage.message_id || ''),
                    sender_name: this.getSenderName(this.replyToMessage),
                    content: this.truncateReplyText(this.getMessageBody(this.replyToMessage) || this.getAttachmentName(this.replyToMessage)),
                } : undefined;
                const mentions = this.getMentionIdsFromContent(messageText);
                this.fileService
                    .sendMessageWithAttachments(this.conversationId, this.auth.contactId, outgoingText, fileIds, filenames, mimeTypes)
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
        const currentContactId = this.auth.contactId || this.myContactId;
        if (currentContactId && String(msg.sender_id) === String(currentContactId))
            return true;
        if (String(msg.sender_name || '').trim().toLowerCase() === 'you')
            return true;
        const current = this.auth.currentContact;
        const senderUsername = String(msg.sender_username || '').trim().toLowerCase();
        const currentUsername = String(current?.username || '').trim().toLowerCase();
        if (senderUsername && currentUsername && senderUsername === currentUsername)
            return true;
        const senderName = getMessageSenderName(msg).trim().toLowerCase();
        const currentName = current ? getContactDisplayName(current).trim().toLowerCase() : '';
        return !!senderName && !!currentName && senderName === currentName;
    }
    canEditMessage(msg) {
        return (this.isOwnMessage(msg) &&
            !this.isDeletedMessage(msg) &&
            String(msg.message_type || '').toUpperCase() === 'TEXT' &&
            !String(msg.message_id || '').startsWith('temp-'));
    }
    canDeleteMessage(msg) {
        return (this.isOwnMessage(msg) &&
            !this.isDeletedMessage(msg));
    }
    canManageMessage(msg) {
        return this.canEditMessage(msg) || this.canDeleteMessage(msg);
    }
    canReplyMessage(msg) {
        return !this.isDeletedMessage(msg) && !this.isSystemMessage(msg);
    }
    isEditingMessage(msg) {
        return !!this.editingMessage && String(this.editingMessage.message_id) === String(msg.message_id);
    }
    onInlineEditInput(event) {
        this.editingDraft = event.target.value;
    }
    onInlineEditKeydown(event) {
        if (event.key === 'Escape') {
            event.preventDefault();
            this.clearEdit();
            return;
        }
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            event.preventDefault();
            this.saveInlineEdit(event);
        }
    }
    canSaveInlineEdit() {
        const message = this.editingMessage;
        if (!message || !this.canEditMessage(message))
            return false;
        const next = this.editingDraft.trim();
        return !!next && next !== this.getMessageBody(message).trim();
    }
    saveInlineEdit(event) {
        event?.stopPropagation();
        const message = this.editingMessage;
        if (!message || !this.canSaveInlineEdit())
            return;
        this.store.editMessage(message.message_id, this.editingDraft.trim());
        this.clearEdit();
    }
    cancelInlineEdit(event) {
        event?.stopPropagation();
        this.clearEdit();
    }
    startEditMessage(msg) {
        if (!this.canEditMessage(msg))
            return;
        this.clearReply();
        this.editingMessage = msg;
        this.editingDraft = this.getMessageBody(msg);
        setTimeout(() => {
            const textarea = this.inlineEditTextareas?.first?.nativeElement;
            textarea?.focus();
            textarea?.select();
        });
    }
    isSystemMessage(msg) {
        const content = String(msg.content || '').trim();
        return msg.message_type === 'SYSTEM' ||
            /^.+ added .+ to the group$/.test(content) ||
            /^.+ removed .+ from the group$/.test(content);
    }
    isPreformattedText(msg) {
        return this.isPreformattedContent(this.getMessageBody(msg));
    }
    isPreformattedContent(content) {
        return content.includes('\t') || content.includes('\n') || / {2,}/.test(content);
    }
    getMessageCaption(msg) {
        const content = this.getMessageBody(msg).trim();
        if (!content)
            return '';
        const attachmentNames = this.getRenderableAttachments(msg)
            .map((attachment) => String(attachment.filename || '').trim())
            .filter(Boolean);
        if (!attachmentNames.length)
            return content;
        const namesText = attachmentNames.join(', ');
        if (content === namesText || attachmentNames.includes(content))
            return '';
        return content;
    }
    isCodeText(msg) {
        return this.isCodeContent(this.getMessageBody(msg), msg);
    }
    isCodeContent(value, msg) {
        const content = value.trim();
        if (msg?.render_as_plain_text)
            return false;
        if (!content || (msg ? this.isTableText(msg) : this.isTableContent(content)))
            return false;
        if (this.looksLikeMarkdown(content) && !this.isSingleFencedCodeBlock(content))
            return false;
        if (/^```[\s\S]*```$/.test(content))
            return true;
        return this.detectCodeLanguage(content) !== null;
    }
    isMarkdownText(msg) {
        return this.isMarkdownContent(this.getMessageBody(msg), msg);
    }
    isMarkdownContent(value, msg) {
        const content = value.trim();
        if (!content || (msg ? this.isTableText(msg) : this.isTableContent(content)) || this.isSingleFencedCodeBlock(content))
            return false;
        return this.looksLikeMarkdown(content);
    }
    getCodeLanguage(msg) {
        return this.getCodeLanguageContent(this.getMessageBody(msg));
    }
    getCodeLanguageContent(content) {
        const parsed = this.parseCodeBlock(content);
        return parsed.language || this.detectCodeLanguage(parsed.code) || 'code';
    }
    getHighlightedCode(msg) {
        return this.getHighlightedCodeContent(this.getMessageBody(msg));
    }
    getHighlightedCodeContent(content) {
        const parsed = this.parseCodeBlock(content);
        const language = parsed.language || this.detectCodeLanguage(parsed.code) || 'code';
        const escaped = this.escapeHtml(parsed.code);
        const highlighted = this.highlightCode(escaped, language);
        return this.sanitizer.bypassSecurityTrustHtml(highlighted);
    }
    getMarkdownHtml(msg) {
        return this.getMarkdownHtmlContent(this.getMessageBody(msg));
    }
    getMarkdownHtmlContent(content) {
        return this.sanitizer.bypassSecurityTrustHtml(this.renderMarkdown(content));
    }
    copyCode(msg, event) {
        event.stopPropagation();
        const content = this.getMessageBody(msg);
        const parsed = this.parseCodeBlock(content);
        this.copyText(parsed.code || content);
    }
    copyMessageText(msg, event) {
        event.stopPropagation();
        this.copyText(this.getMessageBody(msg));
    }
    copyTextValue(text, event) {
        event.stopPropagation();
        this.copyText(text);
    }
    parseCodeBlock(content) {
        const trimmed = content.trim();
        const match = trimmed.match(/^```([a-zA-Z0-9_+-]*)\s*\n?([\s\S]*?)```$/);
        if (!match)
            return { language: '', code: content };
        return { language: (match[1] || '').toLowerCase(), code: match[2] || '' };
    }
    isSingleFencedCodeBlock(content) {
        return /^```[a-zA-Z0-9_+-]*\s*\n?[\s\S]*?```$/.test(content.trim());
    }
    looksLikeMarkdown(content) {
        return /(^#{1,6}\s)|(^[-*]\s)|(^\d+\.\s)|(^>\s)|(\*\*[^*]+\*\*)|(`[^`]+`)|(\[[^\]]+\]\([^)]+\))|(^---$)|(^-\s\[[ x]\]\s)|(^```[a-zA-Z0-9_+-]*\s*$)/m.test(content);
    }
    detectCodeLanguage(code) {
        const trimmed = code.trim();
        if (!trimmed.includes('\n') && trimmed.length < 40)
            return null;
        if (/^\s*(select|with|insert|update|delete|create|alter|drop)\b/i.test(trimmed))
            return 'sql';
        const jsDeclaration = /\b(function|const|let|var)\s+[A-Za-z_$][\w$]*\s*(=|=>|\(|:)/.test(trimmed);
        const jsSyntax = /(=>|console\.log|import\s+.*from|export\s+|[{};])/.test(trimmed);
        if (jsDeclaration || jsSyntax)
            return 'javascript';
        if (/\b(def|import|from|print|class)\b/.test(trimmed) && /:\s*$|^\s{4}/m.test(trimmed))
            return 'python';
        if (/<\/?[a-z][\s\S]*>/i.test(trimmed))
            return 'html';
        if (/[{};]/.test(trimmed) && /[:=]/.test(trimmed))
            return 'code';
        return null;
    }
    highlightCode(escapedCode, language) {
        const protectedTokens = [];
        const protect = (value, regex, className) => value.replace(regex, (match) => {
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
    restoreCodeTokens(value, protectedTokens) {
        return protectedTokens.reduce((html, token, index) => html.replace(new RegExp(`__CODE_TOKEN_${index}__`, 'g'), token), value);
    }
    renderMarkdown(raw) {
        const codeBlocks = [];
        const withoutCode = raw.replace(/```([a-zA-Z0-9_+-]*)\s*\n?([\s\S]*?)```/g, (_match, lang, code) => {
            const language = String(lang || 'code').toLowerCase();
            const token = `__MD_CODE_${codeBlocks.length}__`;
            codeBlocks.push(`<pre><code data-language="${this.escapeHtml(language)}">${this.escapeHtml(String(code || ''))}</code></pre>`);
            return token;
        });
        const lines = withoutCode.split(/\r?\n/);
        const html = [];
        let listType = null;
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
    renderMarkdownInline(value) {
        let html = this.escapeHtml(value);
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
        html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
        return html;
    }
    copyText(text) {
        if (!text)
            return;
        if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(text).then(() => this.store.showToast('Copied to clipboard', 'success', 1600), () => this.fallbackCopyText(text));
            return;
        }
        this.fallbackCopyText(text);
    }
    fallbackCopyText(text) {
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
        }
        catch {
            this.store.showToast('Could not copy', 'error', 2200);
        }
    }
    escapeHtml(value) {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
    isTableText(msg) {
        const rows = this.getTableRows(msg);
        return rows.length >= 2 && rows.some((row) => row.length >= 2);
    }
    isTableContent(content) {
        const rows = this.getTableRowsFromContent(content);
        return rows.length >= 2 && rows.some((row) => row.length >= 2);
    }
    getTableRows(msg) {
        return this.getTableRowsFromContent(this.getMessageBody(msg));
    }
    getTableRowsFromContent(value) {
        const content = value.trim();
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
                    (msg.message_type === 'IMAGE' ? 'Image' : 'File')),
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
                filename: filenames[idx] || filenames[0] || (msg.message_type === 'IMAGE' ? `Image ${idx + 1}` : `Attachment ${idx + 1}`),
                mime_type: mimeTypes[idx] || anyMsg?.mime_type || anyMsg?.attachment_mime_type || (msg.message_type === 'IMAGE' ? 'image/*' : undefined),
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
        const mime = anyMsg?.mime_type || anyMsg?.attachment_mime_type || (msg.message_type === 'IMAGE' ? 'image/*' : undefined);
        const explicitFilename = anyMsg?.filename || anyMsg?.file_name;
        const filename = explicitFilename ||
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
    isImageAttachment(msg, attachment) {
        const mime = attachment?.mime_type || this.getPrimaryAttachment(msg)?.mime_type || '';
        if (mime.startsWith('image/'))
            return true;
        const name = this.getFilenameLike(msg, attachment);
        if (/\.(png|jpe?g|gif|webp|bmp|svg|heic|heif)$/i.test(name))
            return true;
        return msg.message_type === 'IMAGE';
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
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: ChatThreadComponent, deps: [{ token: i1.MessagingStoreService }, { token: i2.MessagingApiService }, { token: i3.AuthService }, { token: i4.MessagingFileService }, { token: i0.ChangeDetectorRef }, { token: i5.DomSanitizer }], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "17.3.12", type: ChatThreadComponent, isStandalone: true, selector: "app-chat-thread", outputs: { lightboxOpen: "lightboxOpen" }, viewQueries: [{ propertyName: "scrollContainer", first: true, predicate: ["scrollContainer"], descendants: true }, { propertyName: "threadRoot", first: true, predicate: ["threadRoot"], descendants: true }, { propertyName: "messageInput", first: true, predicate: MessageInputComponent, descendants: true }, { propertyName: "inlineEditTextareas", predicate: ["inlineEditTextarea"], descendants: true }], ngImport: i0, template: `
    <div
      #threadRoot
      class="chat-thread"
      [class.drag-over]="threadDragOver"
      [style.--message-text-scale]="messageTextScale"
      [style.--code-text-scale]="codeTextScale"
      (click)="closeMessageContextMenu()"
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
                (contextmenu)="openMessageContextMenu(msg, $event)"
              >
              <div *ngIf="!isOwnMessage(msg)" class="sender-name">
                {{ getSenderName(msg) }}
              </div>
              <div
                class="message-bubble"
                [class.own-bubble]="isOwnMessage(msg)"
                (mouseenter)="hoveredMessageId = msg.message_id"
                (mouseleave)="hoveredMessageId = null"
                (contextmenu)="openMessageContextMenu(msg, $event)"
              >
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
                  <ng-container *ngIf="isEditingMessage(msg); else textMessageRender">
                    <div class="inline-edit-wrap" (click)="$event.stopPropagation()" (contextmenu)="$event.stopPropagation()">
                      <textarea
                        #inlineEditTextarea
                        class="inline-edit-textarea"
                        [value]="editingDraft"
                        (input)="onInlineEditInput($event)"
                        (keydown)="onInlineEditKeydown($event)"
                        rows="2"
                      ></textarea>
                      <div class="inline-edit-actions">
                        <button type="button" class="inline-edit-cancel" (click)="cancelInlineEdit($event)">Cancel</button>
                        <button
                          type="button"
                          class="inline-edit-save"
                          [disabled]="!canSaveInlineEdit()"
                          (click)="saveInlineEdit($event)"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  </ng-container>
                  <ng-template #textMessageRender>
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
                  </ng-template>
                </ng-container>
                <div class="message-meta">
                  <span *ngIf="msg.edited_at && !isDeletedMessage(msg)" class="edited-label">edited</span>
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
                <div *ngIf="hoveredMessageId === msg.message_id && !isDeletedMessage(msg)" class="quick-reactions">
                  <button
                    *ngFor="let emoji of quickEmojis"
                    class="quick-emoji-btn"
                    (click)="onEmojiSelected(emoji, msg.message_id)"
                    [attr.aria-label]="'React with ' + emoji"
                  >
                    {{ emoji }}
                  </button>
                </div>
                <div *ngIf="!isDeletedMessage(msg) && msg.reactions && msg.reactions.length > 0" class="reactions-row">
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

      <div
        *ngIf="messageContextMenu as menu"
        class="message-context-menu"
        [style.left.px]="menu.x"
        [style.top.px]="menu.y"
        (click)="$event.stopPropagation()"
        (contextmenu)="$event.preventDefault()"
      >
        <ng-container *ngIf="!menu.confirmDelete; else deleteConfirmMenu">
          <button
            *ngIf="canReplyMessage(menu.message)"
            type="button"
            class="context-menu-item"
            (click)="replyFromContextMenu()"
          >
            <mat-icon>reply</mat-icon>
            <span>Reply</span>
          </button>
          <button
            *ngIf="canEditMessage(menu.message)"
            type="button"
            class="context-menu-item"
            (click)="editFromContextMenu()"
          >
            <mat-icon>edit</mat-icon>
            <span>Edit</span>
          </button>
          <button
            *ngIf="canDeleteMessage(menu.message)"
            type="button"
            class="context-menu-item danger"
            (click)="requestDeleteFromContextMenu()"
          >
            <mat-icon>delete</mat-icon>
            <span>Delete</span>
          </button>
        </ng-container>
        <ng-template #deleteConfirmMenu>
          <div class="context-menu-confirm">
            <div class="confirm-title">Delete this message?</div>
            <div class="confirm-actions">
              <button type="button" class="confirm-cancel" (click)="closeMessageContextMenu()">Cancel</button>
              <button type="button" class="confirm-delete" (click)="confirmDeleteFromContextMenu()">Delete</button>
            </div>
          </div>
        </ng-template>
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

  `, isInline: true, styles: [":host{--attachment-thumb-size: 180px}.chat-thread{display:flex;flex-direction:column;height:100%;background:#041322;position:relative;container-type:inline-size;--attachment-thumb-size: clamp(120px, 48cqw, 180px)}.chat-thread.drag-over{outline:2px dashed rgba(255,255,255,.45);outline-offset:-6px}.thread-drag-overlay{position:absolute;inset:8px;z-index:20;pointer-events:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:#fff;background:#1f4bd852;border:2px dashed rgba(255,255,255,.55);border-radius:14px;font-size:14px;font-weight:600}.thread-drag-overlay mat-icon{font-size:36px;width:36px;height:36px}.chat-header{display:flex;align-items:center;padding:8px 8px 8px 4px;border-bottom:1px solid rgba(255,255,255,.15);gap:4px;flex-shrink:0}.chat-header button mat-icon{color:#fffc}.chat-name{font-size:16px;font-weight:600;color:#fff}.header-info{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;padding:0 4px}.header-actions{display:flex;align-items:center;gap:0}.header-actions button{width:32px;height:32px;min-width:32px!important;padding:0!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;--mdc-icon-button-state-layer-size: 32px}.hdr-btn{border-radius:6px!important;transition:background .15s,box-shadow .15s}.hdr-btn:hover{background:#ffffff26!important;box-shadow:0 2px 8px #0003}.hdr-btn mat-icon{font-size:20px;width:20px;height:20px;line-height:20px;margin:0;display:flex;align-items:center;justify-content:center}:host ::ng-deep .hdr-btn .mat-mdc-button-touch-target{width:32px!important;height:32px!important}.messages-area{flex:1;overflow-y:auto;padding:12px;background:transparent;scrollbar-width:none;-ms-overflow-style:none}.messages-area::-webkit-scrollbar{display:none}.loading-indicator{display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;color:#ffffffb3;font-size:13px}.removed-group-state{height:100%;min-height:260px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:10px;padding:32px 24px;color:#ffffffc7;box-sizing:border-box}.removed-group-state mat-icon{width:44px;height:44px;font-size:44px;color:#f87171;margin-bottom:4px}.removed-group-state h4{margin:0;color:#fff;font-size:17px;font-weight:700}.removed-group-state p{margin:0 0 8px;max-width:280px;font-size:13px;line-height:1.4;color:#ffffff9e}.removed-exit-btn{border-radius:10px;background:#ffffff2e!important;color:#fff!important;font-weight:700;padding:0 18px}.load-more-btn{align-self:center;margin-bottom:16px;font-size:12px;color:#fff}.messages-list{display:flex;flex-direction:column;gap:1px;flex:1}.date-separator{text-align:center;margin:16px 0 8px;font-size:12px;color:#ffffffb3;font-weight:500}.message-bubble-row{display:flex;flex-direction:column;max-width:88%;margin-bottom:2px}.message-bubble-row.own{align-self:flex-end;align-items:flex-end}.message-bubble-row.other{align-self:flex-start;align-items:flex-start}.sender-name{font-size:11px;font-weight:700;color:#fffffff2;margin-bottom:3px;letter-spacing:.2px;padding:0 10px;text-shadow:0 1px 3px rgba(0,0,0,.4)}.system-message-row{align-self:center;max-width:88%;margin:8px auto;text-align:center}.system-message-text{display:inline-flex;align-items:center;justify-content:center;padding:5px 11px;border-radius:999px;background:#ffffff17;border:1px solid rgba(255,255,255,.12);color:#ffffffb8;font-size:11px;line-height:1.35}.message-bubble{padding:8px 14px 7px;border-radius:14px;font-size:calc(clamp(11px,3.4cqw,13px) * var(--message-text-scale, 1));line-height:1.32;word-break:break-word;color:#f5f7ff;position:relative;display:inline-block;min-width:fit-content}.message-bubble-row.other .message-bubble{background:#0d2540;border-bottom-left-radius:5px;box-shadow:0 1px 4px #0006}.message-bubble.own-bubble{background:#0a3d62;border-bottom-right-radius:5px;box-shadow:0 1px 4px #0006}.reply-context{display:flex;align-items:center;gap:7px;margin-bottom:7px;padding:7px 9px;border-radius:10px;background:#ffffff14;border-left:3px solid rgba(127,180,255,.78);max-width:min(68cqw,420px)}.reply-context mat-icon{color:#bfdbfe;font-size:16px;width:16px;height:16px;flex-shrink:0}.reply-context div{min-width:0}.reply-context span{display:block;color:#bfdbfe;font-size:11px;font-weight:700;margin-bottom:2px}.reply-context p{margin:0;color:#ffffffc7;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.text-content{white-space:pre-wrap;tab-size:4}.text-content.preformatted-text{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,Liberation Mono,monospace;font-size:calc(clamp(10px,3.1cqw,12px) * var(--code-text-scale, 1));line-height:1.45;overflow-x:auto;max-width:min(72cqw,520px);scrollbar-width:none;-ms-overflow-style:none}.text-content.preformatted-text::-webkit-scrollbar{display:none}.inline-edit-wrap{width:min(76cqw,520px);min-width:min(56cqw,260px)}.inline-edit-textarea{width:100%;min-height:72px;max-height:220px;box-sizing:border-box;border:1px solid rgba(255,255,255,.28);border-radius:10px;outline:none;resize:vertical;padding:9px 10px;background:#ffffff1a;color:#fff;font:inherit;line-height:1.35;white-space:pre-wrap}.inline-edit-textarea:focus{border-color:#bfdbfee6;box-shadow:0 0 0 2px #7fb4ff2e}.inline-edit-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:8px}.inline-edit-cancel,.inline-edit-save{border:0;border-radius:8px;padding:6px 10px;color:#f8fafc;cursor:pointer;font-size:12px;font-weight:700}.inline-edit-cancel{background:#ffffff1f}.inline-edit-save{background:#2563eb}.inline-edit-save:disabled{cursor:not-allowed;opacity:.45}.attachment-caption{margin-top:8px;width:var(--attachment-thumb-size);max-width:var(--attachment-thumb-size);box-sizing:border-box}.attachment-caption .text-content{white-space:pre-wrap;overflow-wrap:anywhere;max-width:100%}.attachment-render-block{width:100%;max-width:100%}.code-message-wrap{position:relative;max-width:min(76cqw,560px);border-radius:10px;overflow:hidden;border:1px solid rgba(255,255,255,.14);background:#061827}.render-copy-btn{position:absolute;top:6px;right:6px;z-index:2;width:26px;height:26px;border:none;border-radius:7px;display:inline-flex;align-items:center;justify-content:center;padding:0;background:#071d30d1;color:#ffffffc7;cursor:pointer;opacity:0;transition:opacity .12s,background .12s,color .12s}.code-message-wrap:hover .render-copy-btn,.table-message-wrap:hover .render-copy-btn,.md-message-wrap:hover .render-copy-btn,.render-copy-btn:focus{opacity:1}.render-copy-btn:hover{background:#7fb4ff38;color:#fff}.render-copy-btn mat-icon{font-size:16px;width:16px;height:16px;line-height:16px}.code-message{margin:0;padding:12px 42px 28px 12px;overflow-x:auto;color:#dbeafe;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,Liberation Mono,monospace;font-size:calc(clamp(10px,3.1cqw,12px) * var(--code-text-scale, 1));line-height:1.45;white-space:pre;tab-size:2;scrollbar-width:none;-ms-overflow-style:none}.code-message::-webkit-scrollbar{display:none}.code-language{position:absolute;right:8px;bottom:6px;padding:2px 7px;border-radius:999px;background:#7fb4ff29;color:#bfdbfe;font-size:10px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;pointer-events:none}.md-language{position:absolute;right:8px;bottom:6px;padding:2px 7px;border-radius:999px;background:#86efac24;color:#bbf7d0;font-size:10px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;pointer-events:none}:host ::ng-deep .code-token-keyword{color:#93c5fd;font-weight:700}:host ::ng-deep .code-token-string{color:#86efac}:host ::ng-deep .code-token-number{color:#fbbf24}:host ::ng-deep .code-token-comment{color:#94a3b8;font-style:italic}:host ::ng-deep .code-token-function{color:#c4b5fd}.table-message-wrap{position:relative;max-width:min(76cqw,560px);overflow-x:auto;border-radius:9px;border:1px solid rgba(255,255,255,.16);background:#ffffff0a;scrollbar-width:none;-ms-overflow-style:none}.table-message-wrap::-webkit-scrollbar{display:none}.pasted-table{border-collapse:collapse;min-width:100%;font-size:calc(clamp(10px,3.1cqw,12px) * var(--code-text-scale, 1));line-height:1.35;color:#f5f7ff}.pasted-table th,.pasted-table td{padding:6px 9px;border-right:1px solid rgba(255,255,255,.12);border-bottom:1px solid rgba(255,255,255,.12);text-align:left;white-space:pre-wrap;vertical-align:top}.pasted-table th{background:#ffffff1a;font-weight:700}.pasted-table tr:last-child td,.pasted-table tr:last-child th{border-bottom:none}.pasted-table th:last-child,.pasted-table td:last-child{border-right:none}.md-message-wrap{position:relative;max-width:min(76cqw,560px);overflow-x:auto;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:#ffffff0d;scrollbar-width:none;-ms-overflow-style:none}.md-message-wrap::-webkit-scrollbar{display:none}.md-message{padding:10px 42px 28px 12px;color:#f5f7ff;font-size:calc(clamp(11px,3.4cqw,13px) * var(--message-text-scale, 1));line-height:1.45;overflow-wrap:anywhere}:host ::ng-deep .md-message h1,:host ::ng-deep .md-message h2,:host ::ng-deep .md-message h3{margin:8px 0 6px;color:#fff;line-height:1.25}:host ::ng-deep .md-message h1{font-size:18px}:host ::ng-deep .md-message h2{font-size:16px}:host ::ng-deep .md-message h3{font-size:14px}:host ::ng-deep .md-message p{margin:6px 0}:host ::ng-deep .md-message ul,:host ::ng-deep .md-message ol{margin:6px 0;padding-left:20px}:host ::ng-deep .md-message blockquote{margin:8px 0;padding-left:10px;border-left:3px solid rgba(127,180,255,.55);color:#ffffffc7}:host ::ng-deep .md-message code{padding:1px 5px;border-radius:5px;background:#00000040;color:#bfdbfe;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,Liberation Mono,monospace;font-size:12px}:host ::ng-deep .md-message pre{margin:8px 0;padding:9px;border-radius:8px;overflow-x:auto;background:#061827;scrollbar-width:none;-ms-overflow-style:none}:host ::ng-deep .md-message pre::-webkit-scrollbar{display:none}:host ::ng-deep .md-message pre code{padding:0;background:transparent;color:#dbeafe;white-space:pre}.image-message{line-height:0}.media-wrapper{position:relative;display:inline-block;line-height:0;width:var(--attachment-thumb-size);height:var(--attachment-thumb-size);overflow:hidden;border-radius:10px;background:#ffffff14}.media-img{width:100%;height:100%;border-radius:inherit;display:block;cursor:zoom-in;object-fit:cover}.attachment-actions{position:absolute;right:6px;top:6px;display:flex;gap:4px;opacity:0;transition:opacity .12s ease;pointer-events:none}.media-wrapper:hover .attachment-actions{opacity:1;pointer-events:auto}.attachment-action-btn,.file-download-btn{border:none;border-radius:999px;background:#071d30d1;color:#fff;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0}.attachment-action-btn{width:28px;height:28px}.attachment-action-btn mat-icon{font-size:17px;width:17px;height:17px}.media-video{max-width:240px;max-height:260px;border-radius:10px;display:block;background:#000}.video-message{display:flex;flex-direction:column;gap:6px}.video-download{color:#ffffffc7;font-size:12px;text-decoration:underline;text-underline-offset:2px}.media-placeholder{display:flex;align-items:center;justify-content:center;gap:8px;width:var(--attachment-thumb-size);height:var(--attachment-thumb-size);border-radius:10px;background:#ffffff14;color:#fff9;font-size:11px}.media-load-label{font-size:11px;color:#fff9}.attachments-list{display:flex;flex-direction:column;gap:8px;max-width:100%}.attachment-item{max-width:100%}.file-message{display:flex;align-items:center;gap:8px;padding:4px 0}.attachment-thumb.file-message{position:relative;width:var(--attachment-thumb-size);height:var(--attachment-thumb-size);padding:12px;border-radius:10px;background:#ffffff14;flex-direction:column;justify-content:center;box-sizing:border-box;overflow:hidden}.file-download{display:inline-flex;align-items:center;gap:8px;color:#fff;text-decoration:none;max-width:240px}.file-msg-icon{font-size:42px;width:42px;height:42px;color:#fffc;flex-shrink:0}.file-msg-name{font-size:13px;color:#fff;line-height:1.2;max-width:100%;overflow:hidden;text-align:center;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;word-break:break-word}.file-download-icon{font-size:18px;width:18px;height:18px;color:#ffffffb3;flex-shrink:0}.file-download-btn{width:24px;height:24px;flex-shrink:0;position:absolute;right:6px;top:6px}.file-download-link{border:none;border-radius:999px;background:#ffffff29;color:#fff;cursor:pointer;font-size:11px;padding:4px 10px;margin-top:4px}.message-meta{display:flex;align-items:center;gap:4px;margin-top:3px}.msg-time{font-size:10px;color:#dae0faa8}.message-bubble-row.other .msg-time{color:#d8dff694}.edited-label{font-size:10px;font-style:italic;color:#dae0fa9e}.read-icon{font-size:14px;width:14px;height:14px;opacity:.7}.read-icon.read{color:#60a5fa;opacity:1}.read-icon.unread{color:#dae0fa80;opacity:1}.reply-message-btn{position:absolute;right:-10px;bottom:-10px;width:24px;height:24px;border:1px solid rgba(255,255,255,.16);border-radius:999px;background:#071d30;color:#ffffffc7;display:inline-flex;align-items:center;justify-content:center;padding:0;cursor:pointer;opacity:0;transform:scale(.92);transition:opacity .12s,transform .12s,background .12s,color .12s;z-index:3}.message-bubble:hover .reply-message-btn,.reply-message-btn:focus{opacity:1;transform:scale(1)}.reply-message-btn:hover{background:#7fb4ff38;color:#fff}.reply-message-btn mat-icon{font-size:15px;width:15px;height:15px;line-height:15px}.quick-reactions{position:absolute;top:-18px;right:0;display:flex;align-items:center;gap:4px;padding:3px 5px;background:#071d30;border:1px solid rgba(255,255,255,.14);border-radius:999px;box-shadow:0 6px 14px #00000047;z-index:4}.message-bubble-row.other .quick-reactions{left:0;right:auto}.message-bubble-row.own .quick-reactions{left:auto;right:0}.quick-emoji-btn{width:20px;height:20px;border:none;border-radius:999px;background:transparent;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:13px;line-height:1;cursor:pointer;padding:0;transition:transform .12s ease,background .12s ease}.quick-emoji-btn:hover{background:#ffffff2e;transform:scale(1.14)}.reactions-row{display:flex;flex-wrap:wrap;gap:3px;margin-top:5px}.reaction-chip{background:#ffffff14;border:1px solid rgba(255,255,255,.2);border-radius:999px;padding:2px 7px;font-size:11px;color:#f2f6ff;cursor:pointer;transition:all .2s;display:inline-flex;align-items:center;gap:3px;max-width:180px}.reaction-chip:hover{background:#ffffff40;transform:scale(1.05)}.reaction-chip.own-reaction{background:#2a5bff4d;border-color:#2a5bff80}.empty-chat{display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;color:#9ca3af}.empty-chat mat-icon{font-size:48px;width:48px;height:48px;margin-bottom:8px}.empty-chat p{font-size:14px;margin:0}.message-context-menu{position:absolute;z-index:10000;min-width:150px;padding:6px;border:1px solid rgba(255,255,255,.14);border-radius:12px;background:#07111efa;box-shadow:0 18px 45px #00000061;color:#f8fafc}.context-menu-item{width:100%;border:0;border-radius:9px;padding:9px 10px;background:transparent;color:inherit;display:flex;align-items:center;gap:9px;cursor:pointer;font-size:13px;text-align:left}.context-menu-item:hover{background:#ffffff17}.context-menu-item mat-icon{font-size:17px;width:17px;height:17px}.context-menu-item.danger{color:#fecaca}.context-menu-confirm{padding:8px;width:190px}.confirm-title{color:#f8fafc;font-size:13px;font-weight:600;margin-bottom:10px}.confirm-actions{display:flex;justify-content:flex-end;gap:8px}.confirm-cancel,.confirm-delete{border:0;border-radius:8px;padding:7px 10px;color:#f8fafc;cursor:pointer;font-size:12px}.confirm-cancel{background:#ffffff1f}.confirm-delete{background:#dc2626}\n"], dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i6.NgForOf, selector: "[ngFor][ngForOf]", inputs: ["ngForOf", "ngForTrackBy", "ngForTemplate"] }, { kind: "directive", type: i6.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "ngmodule", type: MatIconModule }, { kind: "component", type: i7.MatIcon, selector: "mat-icon", inputs: ["color", "inline", "svgIcon", "fontSet", "fontIcon"], exportAs: ["matIcon"] }, { kind: "ngmodule", type: MatButtonModule }, { kind: "component", type: i8.MatButton, selector: "    button[mat-button], button[mat-raised-button], button[mat-flat-button],    button[mat-stroked-button]  ", exportAs: ["matButton"] }, { kind: "component", type: i8.MatIconButton, selector: "button[mat-icon-button]", exportAs: ["matButton"] }, { kind: "ngmodule", type: MatProgressSpinnerModule }, { kind: "component", type: i9.MatProgressSpinner, selector: "mat-progress-spinner, mat-spinner", inputs: ["color", "mode", "value", "diameter", "strokeWidth"], exportAs: ["matProgressSpinner"] }, { kind: "ngmodule", type: MatTooltipModule }, { kind: "directive", type: i10.MatTooltip, selector: "[matTooltip]", inputs: ["matTooltipPosition", "matTooltipPositionAtOrigin", "matTooltipDisabled", "matTooltipShowDelay", "matTooltipHideDelay", "matTooltipTouchGestures", "matTooltip", "matTooltipClass"], exportAs: ["matTooltip"] }, { kind: "component", type: MessageInputComponent, selector: "app-message-input", inputs: ["conversationId", "replyTo", "enableMentions", "mentionOptions"], outputs: ["messageSent", "messageWithFiles", "replyCancelled"] }] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: ChatThreadComponent, decorators: [{
            type: Component,
            args: [{ selector: 'app-chat-thread', standalone: true, imports: [
                        CommonModule, MatIconModule, MatButtonModule,
                        MatProgressSpinnerModule, MatTooltipModule, MessageInputComponent,
                    ], template: `
    <div
      #threadRoot
      class="chat-thread"
      [class.drag-over]="threadDragOver"
      [style.--message-text-scale]="messageTextScale"
      [style.--code-text-scale]="codeTextScale"
      (click)="closeMessageContextMenu()"
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
                (contextmenu)="openMessageContextMenu(msg, $event)"
              >
              <div *ngIf="!isOwnMessage(msg)" class="sender-name">
                {{ getSenderName(msg) }}
              </div>
              <div
                class="message-bubble"
                [class.own-bubble]="isOwnMessage(msg)"
                (mouseenter)="hoveredMessageId = msg.message_id"
                (mouseleave)="hoveredMessageId = null"
                (contextmenu)="openMessageContextMenu(msg, $event)"
              >
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
                  <ng-container *ngIf="isEditingMessage(msg); else textMessageRender">
                    <div class="inline-edit-wrap" (click)="$event.stopPropagation()" (contextmenu)="$event.stopPropagation()">
                      <textarea
                        #inlineEditTextarea
                        class="inline-edit-textarea"
                        [value]="editingDraft"
                        (input)="onInlineEditInput($event)"
                        (keydown)="onInlineEditKeydown($event)"
                        rows="2"
                      ></textarea>
                      <div class="inline-edit-actions">
                        <button type="button" class="inline-edit-cancel" (click)="cancelInlineEdit($event)">Cancel</button>
                        <button
                          type="button"
                          class="inline-edit-save"
                          [disabled]="!canSaveInlineEdit()"
                          (click)="saveInlineEdit($event)"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  </ng-container>
                  <ng-template #textMessageRender>
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
                  </ng-template>
                </ng-container>
                <div class="message-meta">
                  <span *ngIf="msg.edited_at && !isDeletedMessage(msg)" class="edited-label">edited</span>
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
                <div *ngIf="hoveredMessageId === msg.message_id && !isDeletedMessage(msg)" class="quick-reactions">
                  <button
                    *ngFor="let emoji of quickEmojis"
                    class="quick-emoji-btn"
                    (click)="onEmojiSelected(emoji, msg.message_id)"
                    [attr.aria-label]="'React with ' + emoji"
                  >
                    {{ emoji }}
                  </button>
                </div>
                <div *ngIf="!isDeletedMessage(msg) && msg.reactions && msg.reactions.length > 0" class="reactions-row">
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

      <div
        *ngIf="messageContextMenu as menu"
        class="message-context-menu"
        [style.left.px]="menu.x"
        [style.top.px]="menu.y"
        (click)="$event.stopPropagation()"
        (contextmenu)="$event.preventDefault()"
      >
        <ng-container *ngIf="!menu.confirmDelete; else deleteConfirmMenu">
          <button
            *ngIf="canReplyMessage(menu.message)"
            type="button"
            class="context-menu-item"
            (click)="replyFromContextMenu()"
          >
            <mat-icon>reply</mat-icon>
            <span>Reply</span>
          </button>
          <button
            *ngIf="canEditMessage(menu.message)"
            type="button"
            class="context-menu-item"
            (click)="editFromContextMenu()"
          >
            <mat-icon>edit</mat-icon>
            <span>Edit</span>
          </button>
          <button
            *ngIf="canDeleteMessage(menu.message)"
            type="button"
            class="context-menu-item danger"
            (click)="requestDeleteFromContextMenu()"
          >
            <mat-icon>delete</mat-icon>
            <span>Delete</span>
          </button>
        </ng-container>
        <ng-template #deleteConfirmMenu>
          <div class="context-menu-confirm">
            <div class="confirm-title">Delete this message?</div>
            <div class="confirm-actions">
              <button type="button" class="confirm-cancel" (click)="closeMessageContextMenu()">Cancel</button>
              <button type="button" class="confirm-delete" (click)="confirmDeleteFromContextMenu()">Delete</button>
            </div>
          </div>
        </ng-template>
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

  `, styles: [":host{--attachment-thumb-size: 180px}.chat-thread{display:flex;flex-direction:column;height:100%;background:#041322;position:relative;container-type:inline-size;--attachment-thumb-size: clamp(120px, 48cqw, 180px)}.chat-thread.drag-over{outline:2px dashed rgba(255,255,255,.45);outline-offset:-6px}.thread-drag-overlay{position:absolute;inset:8px;z-index:20;pointer-events:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:#fff;background:#1f4bd852;border:2px dashed rgba(255,255,255,.55);border-radius:14px;font-size:14px;font-weight:600}.thread-drag-overlay mat-icon{font-size:36px;width:36px;height:36px}.chat-header{display:flex;align-items:center;padding:8px 8px 8px 4px;border-bottom:1px solid rgba(255,255,255,.15);gap:4px;flex-shrink:0}.chat-header button mat-icon{color:#fffc}.chat-name{font-size:16px;font-weight:600;color:#fff}.header-info{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;padding:0 4px}.header-actions{display:flex;align-items:center;gap:0}.header-actions button{width:32px;height:32px;min-width:32px!important;padding:0!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;--mdc-icon-button-state-layer-size: 32px}.hdr-btn{border-radius:6px!important;transition:background .15s,box-shadow .15s}.hdr-btn:hover{background:#ffffff26!important;box-shadow:0 2px 8px #0003}.hdr-btn mat-icon{font-size:20px;width:20px;height:20px;line-height:20px;margin:0;display:flex;align-items:center;justify-content:center}:host ::ng-deep .hdr-btn .mat-mdc-button-touch-target{width:32px!important;height:32px!important}.messages-area{flex:1;overflow-y:auto;padding:12px;background:transparent;scrollbar-width:none;-ms-overflow-style:none}.messages-area::-webkit-scrollbar{display:none}.loading-indicator{display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;color:#ffffffb3;font-size:13px}.removed-group-state{height:100%;min-height:260px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:10px;padding:32px 24px;color:#ffffffc7;box-sizing:border-box}.removed-group-state mat-icon{width:44px;height:44px;font-size:44px;color:#f87171;margin-bottom:4px}.removed-group-state h4{margin:0;color:#fff;font-size:17px;font-weight:700}.removed-group-state p{margin:0 0 8px;max-width:280px;font-size:13px;line-height:1.4;color:#ffffff9e}.removed-exit-btn{border-radius:10px;background:#ffffff2e!important;color:#fff!important;font-weight:700;padding:0 18px}.load-more-btn{align-self:center;margin-bottom:16px;font-size:12px;color:#fff}.messages-list{display:flex;flex-direction:column;gap:1px;flex:1}.date-separator{text-align:center;margin:16px 0 8px;font-size:12px;color:#ffffffb3;font-weight:500}.message-bubble-row{display:flex;flex-direction:column;max-width:88%;margin-bottom:2px}.message-bubble-row.own{align-self:flex-end;align-items:flex-end}.message-bubble-row.other{align-self:flex-start;align-items:flex-start}.sender-name{font-size:11px;font-weight:700;color:#fffffff2;margin-bottom:3px;letter-spacing:.2px;padding:0 10px;text-shadow:0 1px 3px rgba(0,0,0,.4)}.system-message-row{align-self:center;max-width:88%;margin:8px auto;text-align:center}.system-message-text{display:inline-flex;align-items:center;justify-content:center;padding:5px 11px;border-radius:999px;background:#ffffff17;border:1px solid rgba(255,255,255,.12);color:#ffffffb8;font-size:11px;line-height:1.35}.message-bubble{padding:8px 14px 7px;border-radius:14px;font-size:calc(clamp(11px,3.4cqw,13px) * var(--message-text-scale, 1));line-height:1.32;word-break:break-word;color:#f5f7ff;position:relative;display:inline-block;min-width:fit-content}.message-bubble-row.other .message-bubble{background:#0d2540;border-bottom-left-radius:5px;box-shadow:0 1px 4px #0006}.message-bubble.own-bubble{background:#0a3d62;border-bottom-right-radius:5px;box-shadow:0 1px 4px #0006}.reply-context{display:flex;align-items:center;gap:7px;margin-bottom:7px;padding:7px 9px;border-radius:10px;background:#ffffff14;border-left:3px solid rgba(127,180,255,.78);max-width:min(68cqw,420px)}.reply-context mat-icon{color:#bfdbfe;font-size:16px;width:16px;height:16px;flex-shrink:0}.reply-context div{min-width:0}.reply-context span{display:block;color:#bfdbfe;font-size:11px;font-weight:700;margin-bottom:2px}.reply-context p{margin:0;color:#ffffffc7;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.text-content{white-space:pre-wrap;tab-size:4}.text-content.preformatted-text{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,Liberation Mono,monospace;font-size:calc(clamp(10px,3.1cqw,12px) * var(--code-text-scale, 1));line-height:1.45;overflow-x:auto;max-width:min(72cqw,520px);scrollbar-width:none;-ms-overflow-style:none}.text-content.preformatted-text::-webkit-scrollbar{display:none}.inline-edit-wrap{width:min(76cqw,520px);min-width:min(56cqw,260px)}.inline-edit-textarea{width:100%;min-height:72px;max-height:220px;box-sizing:border-box;border:1px solid rgba(255,255,255,.28);border-radius:10px;outline:none;resize:vertical;padding:9px 10px;background:#ffffff1a;color:#fff;font:inherit;line-height:1.35;white-space:pre-wrap}.inline-edit-textarea:focus{border-color:#bfdbfee6;box-shadow:0 0 0 2px #7fb4ff2e}.inline-edit-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:8px}.inline-edit-cancel,.inline-edit-save{border:0;border-radius:8px;padding:6px 10px;color:#f8fafc;cursor:pointer;font-size:12px;font-weight:700}.inline-edit-cancel{background:#ffffff1f}.inline-edit-save{background:#2563eb}.inline-edit-save:disabled{cursor:not-allowed;opacity:.45}.attachment-caption{margin-top:8px;width:var(--attachment-thumb-size);max-width:var(--attachment-thumb-size);box-sizing:border-box}.attachment-caption .text-content{white-space:pre-wrap;overflow-wrap:anywhere;max-width:100%}.attachment-render-block{width:100%;max-width:100%}.code-message-wrap{position:relative;max-width:min(76cqw,560px);border-radius:10px;overflow:hidden;border:1px solid rgba(255,255,255,.14);background:#061827}.render-copy-btn{position:absolute;top:6px;right:6px;z-index:2;width:26px;height:26px;border:none;border-radius:7px;display:inline-flex;align-items:center;justify-content:center;padding:0;background:#071d30d1;color:#ffffffc7;cursor:pointer;opacity:0;transition:opacity .12s,background .12s,color .12s}.code-message-wrap:hover .render-copy-btn,.table-message-wrap:hover .render-copy-btn,.md-message-wrap:hover .render-copy-btn,.render-copy-btn:focus{opacity:1}.render-copy-btn:hover{background:#7fb4ff38;color:#fff}.render-copy-btn mat-icon{font-size:16px;width:16px;height:16px;line-height:16px}.code-message{margin:0;padding:12px 42px 28px 12px;overflow-x:auto;color:#dbeafe;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,Liberation Mono,monospace;font-size:calc(clamp(10px,3.1cqw,12px) * var(--code-text-scale, 1));line-height:1.45;white-space:pre;tab-size:2;scrollbar-width:none;-ms-overflow-style:none}.code-message::-webkit-scrollbar{display:none}.code-language{position:absolute;right:8px;bottom:6px;padding:2px 7px;border-radius:999px;background:#7fb4ff29;color:#bfdbfe;font-size:10px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;pointer-events:none}.md-language{position:absolute;right:8px;bottom:6px;padding:2px 7px;border-radius:999px;background:#86efac24;color:#bbf7d0;font-size:10px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;pointer-events:none}:host ::ng-deep .code-token-keyword{color:#93c5fd;font-weight:700}:host ::ng-deep .code-token-string{color:#86efac}:host ::ng-deep .code-token-number{color:#fbbf24}:host ::ng-deep .code-token-comment{color:#94a3b8;font-style:italic}:host ::ng-deep .code-token-function{color:#c4b5fd}.table-message-wrap{position:relative;max-width:min(76cqw,560px);overflow-x:auto;border-radius:9px;border:1px solid rgba(255,255,255,.16);background:#ffffff0a;scrollbar-width:none;-ms-overflow-style:none}.table-message-wrap::-webkit-scrollbar{display:none}.pasted-table{border-collapse:collapse;min-width:100%;font-size:calc(clamp(10px,3.1cqw,12px) * var(--code-text-scale, 1));line-height:1.35;color:#f5f7ff}.pasted-table th,.pasted-table td{padding:6px 9px;border-right:1px solid rgba(255,255,255,.12);border-bottom:1px solid rgba(255,255,255,.12);text-align:left;white-space:pre-wrap;vertical-align:top}.pasted-table th{background:#ffffff1a;font-weight:700}.pasted-table tr:last-child td,.pasted-table tr:last-child th{border-bottom:none}.pasted-table th:last-child,.pasted-table td:last-child{border-right:none}.md-message-wrap{position:relative;max-width:min(76cqw,560px);overflow-x:auto;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:#ffffff0d;scrollbar-width:none;-ms-overflow-style:none}.md-message-wrap::-webkit-scrollbar{display:none}.md-message{padding:10px 42px 28px 12px;color:#f5f7ff;font-size:calc(clamp(11px,3.4cqw,13px) * var(--message-text-scale, 1));line-height:1.45;overflow-wrap:anywhere}:host ::ng-deep .md-message h1,:host ::ng-deep .md-message h2,:host ::ng-deep .md-message h3{margin:8px 0 6px;color:#fff;line-height:1.25}:host ::ng-deep .md-message h1{font-size:18px}:host ::ng-deep .md-message h2{font-size:16px}:host ::ng-deep .md-message h3{font-size:14px}:host ::ng-deep .md-message p{margin:6px 0}:host ::ng-deep .md-message ul,:host ::ng-deep .md-message ol{margin:6px 0;padding-left:20px}:host ::ng-deep .md-message blockquote{margin:8px 0;padding-left:10px;border-left:3px solid rgba(127,180,255,.55);color:#ffffffc7}:host ::ng-deep .md-message code{padding:1px 5px;border-radius:5px;background:#00000040;color:#bfdbfe;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,Liberation Mono,monospace;font-size:12px}:host ::ng-deep .md-message pre{margin:8px 0;padding:9px;border-radius:8px;overflow-x:auto;background:#061827;scrollbar-width:none;-ms-overflow-style:none}:host ::ng-deep .md-message pre::-webkit-scrollbar{display:none}:host ::ng-deep .md-message pre code{padding:0;background:transparent;color:#dbeafe;white-space:pre}.image-message{line-height:0}.media-wrapper{position:relative;display:inline-block;line-height:0;width:var(--attachment-thumb-size);height:var(--attachment-thumb-size);overflow:hidden;border-radius:10px;background:#ffffff14}.media-img{width:100%;height:100%;border-radius:inherit;display:block;cursor:zoom-in;object-fit:cover}.attachment-actions{position:absolute;right:6px;top:6px;display:flex;gap:4px;opacity:0;transition:opacity .12s ease;pointer-events:none}.media-wrapper:hover .attachment-actions{opacity:1;pointer-events:auto}.attachment-action-btn,.file-download-btn{border:none;border-radius:999px;background:#071d30d1;color:#fff;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0}.attachment-action-btn{width:28px;height:28px}.attachment-action-btn mat-icon{font-size:17px;width:17px;height:17px}.media-video{max-width:240px;max-height:260px;border-radius:10px;display:block;background:#000}.video-message{display:flex;flex-direction:column;gap:6px}.video-download{color:#ffffffc7;font-size:12px;text-decoration:underline;text-underline-offset:2px}.media-placeholder{display:flex;align-items:center;justify-content:center;gap:8px;width:var(--attachment-thumb-size);height:var(--attachment-thumb-size);border-radius:10px;background:#ffffff14;color:#fff9;font-size:11px}.media-load-label{font-size:11px;color:#fff9}.attachments-list{display:flex;flex-direction:column;gap:8px;max-width:100%}.attachment-item{max-width:100%}.file-message{display:flex;align-items:center;gap:8px;padding:4px 0}.attachment-thumb.file-message{position:relative;width:var(--attachment-thumb-size);height:var(--attachment-thumb-size);padding:12px;border-radius:10px;background:#ffffff14;flex-direction:column;justify-content:center;box-sizing:border-box;overflow:hidden}.file-download{display:inline-flex;align-items:center;gap:8px;color:#fff;text-decoration:none;max-width:240px}.file-msg-icon{font-size:42px;width:42px;height:42px;color:#fffc;flex-shrink:0}.file-msg-name{font-size:13px;color:#fff;line-height:1.2;max-width:100%;overflow:hidden;text-align:center;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;word-break:break-word}.file-download-icon{font-size:18px;width:18px;height:18px;color:#ffffffb3;flex-shrink:0}.file-download-btn{width:24px;height:24px;flex-shrink:0;position:absolute;right:6px;top:6px}.file-download-link{border:none;border-radius:999px;background:#ffffff29;color:#fff;cursor:pointer;font-size:11px;padding:4px 10px;margin-top:4px}.message-meta{display:flex;align-items:center;gap:4px;margin-top:3px}.msg-time{font-size:10px;color:#dae0faa8}.message-bubble-row.other .msg-time{color:#d8dff694}.edited-label{font-size:10px;font-style:italic;color:#dae0fa9e}.read-icon{font-size:14px;width:14px;height:14px;opacity:.7}.read-icon.read{color:#60a5fa;opacity:1}.read-icon.unread{color:#dae0fa80;opacity:1}.reply-message-btn{position:absolute;right:-10px;bottom:-10px;width:24px;height:24px;border:1px solid rgba(255,255,255,.16);border-radius:999px;background:#071d30;color:#ffffffc7;display:inline-flex;align-items:center;justify-content:center;padding:0;cursor:pointer;opacity:0;transform:scale(.92);transition:opacity .12s,transform .12s,background .12s,color .12s;z-index:3}.message-bubble:hover .reply-message-btn,.reply-message-btn:focus{opacity:1;transform:scale(1)}.reply-message-btn:hover{background:#7fb4ff38;color:#fff}.reply-message-btn mat-icon{font-size:15px;width:15px;height:15px;line-height:15px}.quick-reactions{position:absolute;top:-18px;right:0;display:flex;align-items:center;gap:4px;padding:3px 5px;background:#071d30;border:1px solid rgba(255,255,255,.14);border-radius:999px;box-shadow:0 6px 14px #00000047;z-index:4}.message-bubble-row.other .quick-reactions{left:0;right:auto}.message-bubble-row.own .quick-reactions{left:auto;right:0}.quick-emoji-btn{width:20px;height:20px;border:none;border-radius:999px;background:transparent;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:13px;line-height:1;cursor:pointer;padding:0;transition:transform .12s ease,background .12s ease}.quick-emoji-btn:hover{background:#ffffff2e;transform:scale(1.14)}.reactions-row{display:flex;flex-wrap:wrap;gap:3px;margin-top:5px}.reaction-chip{background:#ffffff14;border:1px solid rgba(255,255,255,.2);border-radius:999px;padding:2px 7px;font-size:11px;color:#f2f6ff;cursor:pointer;transition:all .2s;display:inline-flex;align-items:center;gap:3px;max-width:180px}.reaction-chip:hover{background:#ffffff40;transform:scale(1.05)}.reaction-chip.own-reaction{background:#2a5bff4d;border-color:#2a5bff80}.empty-chat{display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;color:#9ca3af}.empty-chat mat-icon{font-size:48px;width:48px;height:48px;margin-bottom:8px}.empty-chat p{font-size:14px;margin:0}.message-context-menu{position:absolute;z-index:10000;min-width:150px;padding:6px;border:1px solid rgba(255,255,255,.14);border-radius:12px;background:#07111efa;box-shadow:0 18px 45px #00000061;color:#f8fafc}.context-menu-item{width:100%;border:0;border-radius:9px;padding:9px 10px;background:transparent;color:inherit;display:flex;align-items:center;gap:9px;cursor:pointer;font-size:13px;text-align:left}.context-menu-item:hover{background:#ffffff17}.context-menu-item mat-icon{font-size:17px;width:17px;height:17px}.context-menu-item.danger{color:#fecaca}.context-menu-confirm{padding:8px;width:190px}.confirm-title{color:#f8fafc;font-size:13px;font-weight:600;margin-bottom:10px}.confirm-actions{display:flex;justify-content:flex-end;gap:8px}.confirm-cancel,.confirm-delete{border:0;border-radius:8px;padding:7px 10px;color:#f8fafc;cursor:pointer;font-size:12px}.confirm-cancel{background:#ffffff1f}.confirm-delete{background:#dc2626}\n"] }]
        }], ctorParameters: () => [{ type: i1.MessagingStoreService }, { type: i2.MessagingApiService }, { type: i3.AuthService }, { type: i4.MessagingFileService }, { type: i0.ChangeDetectorRef }, { type: i5.DomSanitizer }], propDecorators: { scrollContainer: [{
                type: ViewChild,
                args: ['scrollContainer']
            }], threadRoot: [{
                type: ViewChild,
                args: ['threadRoot']
            }], inlineEditTextareas: [{
                type: ViewChildren,
                args: ['inlineEditTextarea']
            }], messageInput: [{
                type: ViewChild,
                args: [MessageInputComponent]
            }], lightboxOpen: [{
                type: Output
            }] } });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdC10aHJlYWQuY29tcG9uZW50LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL2xpYi9jb21wb25lbnRzL2NoYXQtdGhyZWFkL2NoYXQtdGhyZWFkLmNvbXBvbmVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQ0wsU0FBUyxFQUFxQixTQUFTLEVBQUUsWUFBWSxFQUNyRCxNQUFNLEVBQUUsWUFBWSxHQUNyQixNQUFNLGVBQWUsQ0FBQztBQUV2QixPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDL0MsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLHdCQUF3QixDQUFDO0FBQ3ZELE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUMzRCxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUM5RSxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSwyQkFBMkIsQ0FBQztBQUM3RCxPQUFPLEVBQWdCLGFBQWEsRUFBRSxNQUFNLE1BQU0sQ0FBQztBQUtuRCxPQUFPLEVBQXlELHFCQUFxQixFQUFFLG9CQUFvQixFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDbkosT0FBTyxFQUFpQixxQkFBcUIsRUFBb0QsTUFBTSwwQ0FBMEMsQ0FBQzs7Ozs7Ozs7Ozs7O0FBNjhDbEosTUFBTSxPQUFPLG1CQUFtQjtJQStDcEI7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBbkRvQixlQUFlLENBQWM7SUFDbEMsVUFBVSxDQUEyQjtJQUMxQixtQkFBbUIsQ0FBOEM7SUFDbkUsWUFBWSxDQUF5QjtJQUM3RCxZQUFZLEdBQUcsSUFBSSxZQUFZLEVBQVUsQ0FBQztJQUVwRCxRQUFRLEdBQWMsRUFBRSxDQUFDO0lBQ3pCLGVBQWUsR0FBYyxFQUFFLENBQUM7SUFDaEMsZ0JBQWdCLEdBQUcsRUFBRSxDQUFDO0lBQ3RCLE9BQU8sR0FBRyxLQUFLLENBQUM7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Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQTRYVCxpbGZBL1hDLFlBQVksK1BBQUUsYUFBYSxtTEFBRSxlQUFlLHdVQUM1Qyx3QkFBd0Isa09BQUUsZ0JBQWdCLDhUQUFFLHFCQUFxQjs7NEZBczhDeEQsbUJBQW1CO2tCQTM4Qy9CLFNBQVM7K0JBQ0UsaUJBQWlCLGNBQ2YsSUFBSSxXQUNQO3dCQUNQLFlBQVksRUFBRSxhQUFhLEVBQUUsZUFBZTt3QkFDNUMsd0JBQXdCLEVBQUUsZ0JBQWdCLEVBQUUscUJBQXFCO3FCQUNsRSxZQUNTOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQTRYVDtvUEF5a0M2QixlQUFlO3NCQUE1QyxTQUFTO3VCQUFDLGlCQUFpQjtnQkFDSCxVQUFVO3NCQUFsQyxTQUFTO3VCQUFDLFlBQVk7Z0JBQ2EsbUJBQW1CO3NCQUF0RCxZQUFZO3VCQUFDLG9CQUFvQjtnQkFDQSxZQUFZO3NCQUE3QyxTQUFTO3VCQUFDLHFCQUFxQjtnQkFDdEIsWUFBWTtzQkFBckIsTUFBTSIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7XHJcbiAgQ29tcG9uZW50LCBPbkluaXQsIE9uRGVzdHJveSwgVmlld0NoaWxkLCBWaWV3Q2hpbGRyZW4sIFF1ZXJ5TGlzdCwgRWxlbWVudFJlZiwgQWZ0ZXJWaWV3Q2hlY2tlZCwgQ2hhbmdlRGV0ZWN0b3JSZWYsXHJcbiAgT3V0cHV0LCBFdmVudEVtaXR0ZXIsXHJcbn0gZnJvbSAnQGFuZ3VsYXIvY29yZSc7XHJcbmltcG9ydCB7IERvbVNhbml0aXplciwgU2FmZUh0bWwgfSBmcm9tICdAYW5ndWxhci9wbGF0Zm9ybS1icm93c2VyJztcclxuaW1wb3J0IHsgQ29tbW9uTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvY29tbW9uJztcclxuaW1wb3J0IHsgTWF0SWNvbk1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL21hdGVyaWFsL2ljb24nO1xyXG5pbXBvcnQgeyBNYXRCdXR0b25Nb2R1bGUgfSBmcm9tICdAYW5ndWxhci9tYXRlcmlhbC9idXR0b24nO1xyXG5pbXBvcnQgeyBNYXRQcm9ncmVzc1NwaW5uZXJNb2R1bGUgfSBmcm9tICdAYW5ndWxhci9tYXRlcmlhbC9wcm9ncmVzcy1zcGlubmVyJztcclxuaW1wb3J0IHsgTWF0VG9vbHRpcE1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL21hdGVyaWFsL3Rvb2x0aXAnO1xyXG5pbXBvcnQgeyBTdWJzY3JpcHRpb24sIGNvbWJpbmVMYXRlc3QgfSBmcm9tICdyeGpzJztcclxuaW1wb3J0IHsgTWVzc2FnaW5nU3RvcmVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvbWVzc2FnaW5nLXN0b3JlLnNlcnZpY2UnO1xyXG5pbXBvcnQgeyBNZXNzYWdpbmdBcGlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvbWVzc2FnaW5nLWFwaS5zZXJ2aWNlJztcclxuaW1wb3J0IHsgTWVzc2FnaW5nRmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9tZXNzYWdpbmctZmlsZS5zZXJ2aWNlJztcclxuaW1wb3J0IHsgQXV0aFNlcnZpY2UgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9hdXRoLnNlcnZpY2UnO1xyXG5pbXBvcnQgeyBDb250YWN0LCBDb252ZXJzYXRpb25QYXJ0aWNpcGFudCwgTWVzc2FnZSwgQXR0YWNobWVudCwgZ2V0Q29udGFjdERpc3BsYXlOYW1lLCBnZXRNZXNzYWdlU2VuZGVyTmFtZSB9IGZyb20gJy4uLy4uL21vZGVscy9tZXNzYWdpbmcubW9kZWxzJztcclxuaW1wb3J0IHsgTWVudGlvbk9wdGlvbiwgTWVzc2FnZUlucHV0Q29tcG9uZW50LCBNZXNzYWdlUGF5bG9hZCwgTWVzc2FnZVRleHRQYXlsb2FkLCBSZXBseVByZXZpZXcgfSBmcm9tICcuLi9tZXNzYWdlLWlucHV0L21lc3NhZ2UtaW5wdXQuY29tcG9uZW50JztcclxuXHJcbkBDb21wb25lbnQoe1xyXG4gIHNlbGVjdG9yOiAnYXBwLWNoYXQtdGhyZWFkJyxcclxuICBzdGFuZGFsb25lOiB0cnVlLFxyXG4gIGltcG9ydHM6IFtcclxuICAgIENvbW1vbk1vZHVsZSwgTWF0SWNvbk1vZHVsZSwgTWF0QnV0dG9uTW9kdWxlLFxyXG4gICAgTWF0UHJvZ3Jlc3NTcGlubmVyTW9kdWxlLCBNYXRUb29sdGlwTW9kdWxlLCBNZXNzYWdlSW5wdXRDb21wb25lbnQsXHJcbiAgXSxcclxuICB0ZW1wbGF0ZTogYFxyXG4gICAgPGRpdlxyXG4gICAgICAjdGhyZWFkUm9vdFxyXG4gICAgICBjbGFzcz1cImNoYXQtdGhyZWFkXCJcclxuICAgICAgW2NsYXNzLmRyYWctb3Zlcl09XCJ0aHJlYWREcmFnT3ZlclwiXHJcbiAgICAgIFtzdHlsZS4tLW1lc3NhZ2UtdGV4dC1zY2FsZV09XCJtZXNzYWdlVGV4dFNjYWxlXCJcclxuICAgICAgW3N0eWxlLi0tY29kZS10ZXh0LXNjYWxlXT1cImNvZGVUZXh0U2NhbGVcIlxyXG4gICAgICAoY2xpY2spPVwiY2xvc2VNZXNzYWdlQ29udGV4dE1lbnUoKVwiXHJcbiAgICAgIChkcmFnZW50ZXIpPVwib25UaHJlYWREcmFnRW50ZXIoJGV2ZW50KVwiXHJcbiAgICAgIChkcmFnb3Zlcik9XCJvblRocmVhZERyYWdPdmVyKCRldmVudClcIlxyXG4gICAgICAoZHJhZ2xlYXZlKT1cIm9uVGhyZWFkRHJhZ0xlYXZlKCRldmVudClcIlxyXG4gICAgICAoZHJvcCk9XCJvblRocmVhZERyb3AoJGV2ZW50KVwiXHJcbiAgICA+XHJcbiAgICAgIDxkaXYgY2xhc3M9XCJjaGF0LWhlYWRlclwiPlxyXG4gICAgICAgIDxidXR0b24gbWF0LWljb24tYnV0dG9uIGNsYXNzPVwiaGRyLWJ0blwiIChjbGljayk9XCJnb0JhY2soKVwiIG1hdFRvb2x0aXA9XCJCYWNrXCIgbWF0VG9vbHRpcFBvc2l0aW9uPVwiYmVsb3dcIj5cclxuICAgICAgICAgIDxtYXQtaWNvbj5hcnJvd19iYWNrPC9tYXQtaWNvbj5cclxuICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICA8ZGl2IGNsYXNzPVwiaGVhZGVyLWluZm9cIj5cclxuICAgICAgICAgIDxzcGFuIGNsYXNzPVwiY2hhdC1uYW1lXCI+e3sgY29udmVyc2F0aW9uTmFtZSB9fTwvc3Bhbj5cclxuICAgICAgICA8L2Rpdj5cclxuICAgICAgICA8ZGl2IGNsYXNzPVwiaGVhZGVyLWFjdGlvbnNcIj5cclxuICAgICAgICAgIDxidXR0b24gKm5nSWY9XCJpc0dyb3VwICYmICFpc1JlbW92ZWRGcm9tR3JvdXBcIiBtYXQtaWNvbi1idXR0b24gY2xhc3M9XCJoZHItYnRuXCIgKGNsaWNrKT1cIm9uR3JvdXBTZXR0aW5ncygpXCIgbWF0VG9vbHRpcD1cIkdyb3VwIHNldHRpbmdzXCIgbWF0VG9vbHRpcFBvc2l0aW9uPVwiYmVsb3dcIj5cclxuICAgICAgICAgICAgPG1hdC1pY29uPnNldHRpbmdzPC9tYXQtaWNvbj5cclxuICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgIDwvZGl2PlxyXG4gICAgICA8L2Rpdj5cclxuXHJcbiAgICAgIDxkaXYgY2xhc3M9XCJtZXNzYWdlcy1hcmVhXCIgI3Njcm9sbENvbnRhaW5lciAoc2Nyb2xsKT1cIm9uU2Nyb2xsKClcIj5cclxuICAgICAgICA8ZGl2ICpuZ0lmPVwidGhyZWFkRHJhZ092ZXJcIiBjbGFzcz1cInRocmVhZC1kcmFnLW92ZXJsYXlcIj5cclxuICAgICAgICAgIDxtYXQtaWNvbj5jbG91ZF91cGxvYWQ8L21hdC1pY29uPlxyXG4gICAgICAgICAgPHNwYW4+RHJvcCBmaWxlcyBhbnl3aGVyZSBpbiB0aGlzIGNoYXQ8L3NwYW4+XHJcbiAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgIDxkaXYgKm5nSWY9XCJpc1JlbW92ZWRGcm9tR3JvdXBcIiBjbGFzcz1cInJlbW92ZWQtZ3JvdXAtc3RhdGVcIj5cclxuICAgICAgICAgIDxtYXQtaWNvbj5ibG9jazwvbWF0LWljb24+XHJcbiAgICAgICAgICA8aDQ+WW91IHdlcmUgcmVtb3ZlZCBmcm9tIHRoaXMgZ3JvdXA8L2g0PlxyXG4gICAgICAgICAgPHA+TWVzc2FnZXMsIGF0dGFjaG1lbnRzLCBhbmQgZ3JvdXAgc2V0dGluZ3MgYXJlIG5vIGxvbmdlciBhdmFpbGFibGUuPC9wPlxyXG4gICAgICAgICAgPGJ1dHRvbiB0eXBlPVwiYnV0dG9uXCIgbWF0LXJhaXNlZC1idXR0b24gY2xhc3M9XCJyZW1vdmVkLWV4aXQtYnRuXCIgKGNsaWNrKT1cImV4aXRSZW1vdmVkR3JvdXAoKVwiPlxyXG4gICAgICAgICAgICBFeGl0IEdyb3VwXHJcbiAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgPGRpdiAqbmdJZj1cIiFpc1JlbW92ZWRGcm9tR3JvdXAgJiYgbG9hZGluZ1wiIGNsYXNzPVwibG9hZGluZy1pbmRpY2F0b3JcIj5cclxuICAgICAgICAgIDxtYXQtc3Bpbm5lciBkaWFtZXRlcj1cIjI0XCI+PC9tYXQtc3Bpbm5lcj5cclxuICAgICAgICAgIDxzcGFuPkxvYWRpbmcgbWVzc2FnZXMuLi48L3NwYW4+XHJcbiAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgIDxidXR0b25cclxuICAgICAgICAgICpuZ0lmPVwiIWlzUmVtb3ZlZEZyb21Hcm91cCAmJiBtZXNzYWdlcy5sZW5ndGggPj0gNTAgJiYgIWxvYWRpbmdcIlxyXG4gICAgICAgICAgbWF0LXN0cm9rZWQtYnV0dG9uXHJcbiAgICAgICAgICBjbGFzcz1cImxvYWQtbW9yZS1idG5cIlxyXG4gICAgICAgICAgKGNsaWNrKT1cImxvYWRPbGRlcigpXCJcclxuICAgICAgICA+XHJcbiAgICAgICAgICBMb2FkIG9sZGVyIG1lc3NhZ2VzXHJcbiAgICAgICAgPC9idXR0b24+XHJcblxyXG4gICAgICAgIDxkaXYgKm5nSWY9XCIhaXNSZW1vdmVkRnJvbUdyb3VwXCIgY2xhc3M9XCJtZXNzYWdlcy1saXN0XCI+XHJcbiAgICAgICAgICA8bmctY29udGFpbmVyICpuZ0Zvcj1cImxldCBtc2cgb2YgbWVzc2FnZXM7IGxldCBpID0gaW5kZXhcIj5cclxuICAgICAgICAgICAgPGRpdlxyXG4gICAgICAgICAgICAgICpuZ0lmPVwic2hvdWxkU2hvd0RhdGVTZXBhcmF0b3IoaSlcIlxyXG4gICAgICAgICAgICAgIGNsYXNzPVwiZGF0ZS1zZXBhcmF0b3JcIlxyXG4gICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgPHNwYW4+e3sgZm9ybWF0RGF0ZShtc2cuY3JlYXRlZF9hdCkgfX08L3NwYW4+XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgICAgPGRpdlxyXG4gICAgICAgICAgICAgICpuZ0lmPVwiaXNTeXN0ZW1NZXNzYWdlKG1zZyk7IGVsc2UgY2hhdE1lc3NhZ2VcIlxyXG4gICAgICAgICAgICAgIGNsYXNzPVwic3lzdGVtLW1lc3NhZ2Utcm93XCJcclxuICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwic3lzdGVtLW1lc3NhZ2UtdGV4dFwiPnt7IG1zZy5jb250ZW50IH19PC9zcGFuPlxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgICAgIDxuZy10ZW1wbGF0ZSAjY2hhdE1lc3NhZ2U+XHJcbiAgICAgICAgICAgICAgPGRpdlxyXG4gICAgICAgICAgICAgICAgY2xhc3M9XCJtZXNzYWdlLWJ1YmJsZS1yb3dcIlxyXG4gICAgICAgICAgICAgICAgW2NsYXNzLm93bl09XCJpc093bk1lc3NhZ2UobXNnKVwiXHJcbiAgICAgICAgICAgICAgICBbY2xhc3Mub3RoZXJdPVwiIWlzT3duTWVzc2FnZShtc2cpXCJcclxuICAgICAgICAgICAgICAgIChjb250ZXh0bWVudSk9XCJvcGVuTWVzc2FnZUNvbnRleHRNZW51KG1zZywgJGV2ZW50KVwiXHJcbiAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgIDxkaXYgKm5nSWY9XCIhaXNPd25NZXNzYWdlKG1zZylcIiBjbGFzcz1cInNlbmRlci1uYW1lXCI+XHJcbiAgICAgICAgICAgICAgICB7eyBnZXRTZW5kZXJOYW1lKG1zZykgfX1cclxuICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICA8ZGl2XHJcbiAgICAgICAgICAgICAgICBjbGFzcz1cIm1lc3NhZ2UtYnViYmxlXCJcclxuICAgICAgICAgICAgICAgIFtjbGFzcy5vd24tYnViYmxlXT1cImlzT3duTWVzc2FnZShtc2cpXCJcclxuICAgICAgICAgICAgICAgIChtb3VzZWVudGVyKT1cImhvdmVyZWRNZXNzYWdlSWQgPSBtc2cubWVzc2FnZV9pZFwiXHJcbiAgICAgICAgICAgICAgICAobW91c2VsZWF2ZSk9XCJob3ZlcmVkTWVzc2FnZUlkID0gbnVsbFwiXHJcbiAgICAgICAgICAgICAgICAoY29udGV4dG1lbnUpPVwib3Blbk1lc3NhZ2VDb250ZXh0TWVudShtc2csICRldmVudClcIlxyXG4gICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgIDxkaXYgKm5nSWY9XCJnZXRSZXBseVByZXZpZXcobXNnKSBhcyByZXBseVwiIGNsYXNzPVwicmVwbHktY29udGV4dFwiPlxyXG4gICAgICAgICAgICAgICAgICA8bWF0LWljb24+cmVwbHk8L21hdC1pY29uPlxyXG4gICAgICAgICAgICAgICAgICA8ZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgIDxzcGFuPnt7IHJlcGx5LnNlbmRlck5hbWUgfX08L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgPHA+e3sgcmVwbHkuY29udGVudCB9fTwvcD5cclxuICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgIDwhLS0gQVRUQUNITUVOVFMg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAIC0tPlxyXG4gICAgICAgICAgICAgICAgPGRpdiAqbmdJZj1cImhhc0ZpbGVBdHRhY2htZW50KG1zZylcIiBjbGFzcz1cImF0dGFjaG1lbnRzLWxpc3RcIj5cclxuICAgICAgICAgICAgICAgICAgPGRpdiAqbmdGb3I9XCJsZXQgYXR0YWNobWVudCBvZiBnZXRSZW5kZXJhYmxlQXR0YWNobWVudHMobXNnKTsgdHJhY2tCeTogdHJhY2tCeUF0dGFjaG1lbnRcIiBjbGFzcz1cImF0dGFjaG1lbnQtaXRlbVwiPlxyXG4gICAgICAgICAgICAgICAgICAgIDxuZy1jb250YWluZXIgKm5nSWY9XCJpc0ltYWdlQXR0YWNobWVudChtc2csIGF0dGFjaG1lbnQpOyBlbHNlIG5vbkltYWdlQXR0YWNobWVudFwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImltYWdlLW1lc3NhZ2VcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPG5nLWNvbnRhaW5lciAqbmdJZj1cImdldE1lZGlhVXJsKG1zZywgYXR0YWNobWVudCkgYXMgZGF0YVVybDsgZWxzZSBpbWdGYWxsYmFja1wiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJtZWRpYS13cmFwcGVyXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8aW1nXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFtzcmNdPVwiZGF0YVVybFwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFsdD1cIkltYWdlXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3M9XCJtZWRpYS1pbWdcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAobW91c2Vkb3duKT1cIiRldmVudC5zdG9wUHJvcGFnYXRpb24oKVwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIChjbGljayk9XCJvcGVuTGlnaHRib3goZGF0YVVybCwgJGV2ZW50KVwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImF0dGFjaG1lbnQtYWN0aW9uc1wiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8YnV0dG9uXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZT1cImJ1dHRvblwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3M9XCJhdHRhY2htZW50LWFjdGlvbi1idG5cIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIChjbGljayk9XCJvcGVuTGlnaHRib3goZGF0YVVybCwgJGV2ZW50KVwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGl0bGU9XCJPcGVuIGltYWdlXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxtYXQtaWNvbj5vcGVuX2luX2Z1bGw8L21hdC1pY29uPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzPVwiYXR0YWNobWVudC1hY3Rpb24tYnRuXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAoY2xpY2spPVwiZG93bmxvYWRBdHRhY2htZW50KG1zZywgYXR0YWNobWVudCwgJGV2ZW50KVwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGl0bGU9XCJEb3dubG9hZCBpbWFnZVwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8bWF0LWljb24+ZG93bmxvYWQ8L21hdC1pY29uPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8L25nLWNvbnRhaW5lcj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPG5nLXRlbXBsYXRlICNpbWdGYWxsYmFjaz5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2ICpuZ0lmPVwic2hvdWxkU2hvd01lZGlhU3Bpbm5lcihhdHRhY2htZW50KTsgZWxzZSBpbWdBc0ZpbGVcIiBjbGFzcz1cIm1lZGlhLXBsYWNlaG9sZGVyXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8bWF0LXNwaW5uZXIgZGlhbWV0ZXI9XCIyMlwiPjwvbWF0LXNwaW5uZXI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPG5nLXRlbXBsYXRlICNpbWdBc0ZpbGU+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmlsZS1tZXNzYWdlXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxtYXQtaWNvbiBjbGFzcz1cImZpbGUtbXNnLWljb25cIj5pbWFnZTwvbWF0LWljb24+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwiZmlsZS1tc2ctbmFtZVwiPnt7IGdldEF0dGFjaG1lbnROYW1lKG1zZywgYXR0YWNobWVudCkgfX08L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8L25nLXRlbXBsYXRlPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8L25nLXRlbXBsYXRlPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgPC9uZy1jb250YWluZXI+XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIDxuZy10ZW1wbGF0ZSAjbm9uSW1hZ2VBdHRhY2htZW50PlxyXG4gICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZpbGUtbWVzc2FnZSBhdHRhY2htZW50LXRodW1iXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxidXR0b25cclxuICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICBjbGFzcz1cImZpbGUtZG93bmxvYWQtYnRuXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAoY2xpY2spPVwiZG93bmxvYWRBdHRhY2htZW50KG1zZywgYXR0YWNobWVudCwgJGV2ZW50KVwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgdGl0bGU9XCJEb3dubG9hZCBmaWxlXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxtYXQtaWNvbiBjbGFzcz1cImZpbGUtZG93bmxvYWQtaWNvblwiPmRvd25sb2FkPC9tYXQtaWNvbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxtYXQtaWNvbiBjbGFzcz1cImZpbGUtbXNnLWljb25cIj57eyBnZXRGaWxlSWNvbihtc2csIGF0dGFjaG1lbnQpIH19PC9tYXQtaWNvbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJmaWxlLW1zZy1uYW1lXCIgW3RpdGxlXT1cImdldEF0dGFjaG1lbnROYW1lKG1zZywgYXR0YWNobWVudClcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICB7eyBnZXRBdHRhY2htZW50TmFtZShtc2csIGF0dGFjaG1lbnQpIH19XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzPVwiZmlsZS1kb3dubG9hZC1saW5rXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAoY2xpY2spPVwiZG93bmxvYWRBdHRhY2htZW50KG1zZywgYXR0YWNobWVudCwgJGV2ZW50KVwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgdGl0bGU9XCJEb3dubG9hZCBmaWxlXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIERvd25sb2FkXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgPC9uZy10ZW1wbGF0ZT5cclxuICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgIDxkaXZcclxuICAgICAgICAgICAgICAgICAgKm5nSWY9XCJoYXNGaWxlQXR0YWNobWVudChtc2cpICYmIGdldE1lc3NhZ2VDYXB0aW9uKG1zZylcIlxyXG4gICAgICAgICAgICAgICAgICBjbGFzcz1cImF0dGFjaG1lbnQtY2FwdGlvblwiXHJcbiAgICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICAgIDxkaXYgKm5nSWY9XCJpc0NvZGVDb250ZW50KGdldE1lc3NhZ2VDYXB0aW9uKG1zZyksIG1zZyk7IGVsc2Ugbm9uQ29kZUNhcHRpb25cIiBjbGFzcz1cImNvZGUtbWVzc2FnZS13cmFwIGF0dGFjaG1lbnQtcmVuZGVyLWJsb2NrXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgPGJ1dHRvbiB0eXBlPVwiYnV0dG9uXCIgY2xhc3M9XCJyZW5kZXItY29weS1idG5cIiAoY2xpY2spPVwiY29weVRleHRWYWx1ZShnZXRNZXNzYWdlQ2FwdGlvbihtc2cpLCAkZXZlbnQpXCIgdGl0bGU9XCJDb3B5IGNvZGVcIj5cclxuICAgICAgICAgICAgICAgICAgICAgIDxtYXQtaWNvbj5jb250ZW50X2NvcHk8L21hdC1pY29uPlxyXG4gICAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgICAgICAgICAgIDxwcmUgY2xhc3M9XCJjb2RlLW1lc3NhZ2VcIj48Y29kZSBbaW5uZXJIVE1MXT1cImdldEhpZ2hsaWdodGVkQ29kZUNvbnRlbnQoZ2V0TWVzc2FnZUNhcHRpb24obXNnKSlcIj48L2NvZGU+PC9wcmU+XHJcbiAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJjb2RlLWxhbmd1YWdlXCI+e3sgZ2V0Q29kZUxhbmd1YWdlQ29udGVudChnZXRNZXNzYWdlQ2FwdGlvbihtc2cpKSB9fTwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgIDxuZy10ZW1wbGF0ZSAjbm9uQ29kZUNhcHRpb24+XHJcbiAgICAgICAgICAgICAgICAgICAgPGRpdiAqbmdJZj1cImlzTWFya2Rvd25Db250ZW50KGdldE1lc3NhZ2VDYXB0aW9uKG1zZykpOyBlbHNlIHBsYWluQ2FwdGlvblwiIGNsYXNzPVwibWQtbWVzc2FnZS13cmFwIGF0dGFjaG1lbnQtcmVuZGVyLWJsb2NrXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8YnV0dG9uIHR5cGU9XCJidXR0b25cIiBjbGFzcz1cInJlbmRlci1jb3B5LWJ0blwiIChjbGljayk9XCJjb3B5VGV4dFZhbHVlKGdldE1lc3NhZ2VDYXB0aW9uKG1zZyksICRldmVudClcIiB0aXRsZT1cIkNvcHkgbWFya2Rvd25cIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPG1hdC1pY29uPmNvbnRlbnRfY29weTwvbWF0LWljb24+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJtZC1tZXNzYWdlXCIgW2lubmVySFRNTF09XCJnZXRNYXJrZG93bkh0bWxDb250ZW50KGdldE1lc3NhZ2VDYXB0aW9uKG1zZykpXCI+PC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cIm1kLWxhbmd1YWdlXCI+bWQ8L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgPG5nLXRlbXBsYXRlICNwbGFpbkNhcHRpb24+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzPVwidGV4dC1jb250ZW50XCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgW2NsYXNzLnByZWZvcm1hdHRlZC10ZXh0XT1cImlzUHJlZm9ybWF0dGVkQ29udGVudChnZXRNZXNzYWdlQ2FwdGlvbihtc2cpKVwiXHJcbiAgICAgICAgICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHt7IGdldE1lc3NhZ2VDYXB0aW9uKG1zZykgfX1cclxuICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgIDwvbmctdGVtcGxhdGU+XHJcbiAgICAgICAgICAgICAgICAgIDwvbmctdGVtcGxhdGU+XHJcbiAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgIDxuZy1jb250YWluZXIgKm5nSWY9XCJtc2cubWVzc2FnZV90eXBlID09PSAnVEVYVCcgJiYgIWhhc0ZpbGVBdHRhY2htZW50KG1zZylcIj5cclxuICAgICAgICAgICAgICAgICAgPG5nLWNvbnRhaW5lciAqbmdJZj1cImlzRWRpdGluZ01lc3NhZ2UobXNnKTsgZWxzZSB0ZXh0TWVzc2FnZVJlbmRlclwiPlxyXG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJpbmxpbmUtZWRpdC13cmFwXCIgKGNsaWNrKT1cIiRldmVudC5zdG9wUHJvcGFnYXRpb24oKVwiIChjb250ZXh0bWVudSk9XCIkZXZlbnQuc3RvcFByb3BhZ2F0aW9uKClcIj5cclxuICAgICAgICAgICAgICAgICAgICAgIDx0ZXh0YXJlYVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAjaW5saW5lRWRpdFRleHRhcmVhXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzPVwiaW5saW5lLWVkaXQtdGV4dGFyZWFcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBbdmFsdWVdPVwiZWRpdGluZ0RyYWZ0XCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgKGlucHV0KT1cIm9uSW5saW5lRWRpdElucHV0KCRldmVudClcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAoa2V5ZG93bik9XCJvbklubGluZUVkaXRLZXlkb3duKCRldmVudClcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICByb3dzPVwiMlwiXHJcbiAgICAgICAgICAgICAgICAgICAgICA+PC90ZXh0YXJlYT5cclxuICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJpbmxpbmUtZWRpdC1hY3Rpb25zXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxidXR0b24gdHlwZT1cImJ1dHRvblwiIGNsYXNzPVwiaW5saW5lLWVkaXQtY2FuY2VsXCIgKGNsaWNrKT1cImNhbmNlbElubGluZUVkaXQoJGV2ZW50KVwiPkNhbmNlbDwvYnV0dG9uPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8YnV0dG9uXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZT1cImJ1dHRvblwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3M9XCJpbmxpbmUtZWRpdC1zYXZlXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICBbZGlzYWJsZWRdPVwiIWNhblNhdmVJbmxpbmVFZGl0KClcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIChjbGljayk9XCJzYXZlSW5saW5lRWRpdCgkZXZlbnQpXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIFNhdmVcclxuICAgICAgICAgICAgICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgPC9uZy1jb250YWluZXI+XHJcbiAgICAgICAgICAgICAgICAgIDxuZy10ZW1wbGF0ZSAjdGV4dE1lc3NhZ2VSZW5kZXI+XHJcbiAgICAgICAgICAgICAgICAgICAgPGRpdiAqbmdJZj1cImlzQ29kZVRleHQobXNnKTsgZWxzZSBub25Db2RlVGV4dE1lc3NhZ2VcIiBjbGFzcz1cImNvZGUtbWVzc2FnZS13cmFwXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8YnV0dG9uIHR5cGU9XCJidXR0b25cIiBjbGFzcz1cInJlbmRlci1jb3B5LWJ0blwiIChjbGljayk9XCJjb3B5Q29kZShtc2csICRldmVudClcIiB0aXRsZT1cIkNvcHkgY29kZVwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8bWF0LWljb24+Y29udGVudF9jb3B5PC9tYXQtaWNvbj5cclxuICAgICAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPHByZSBjbGFzcz1cImNvZGUtbWVzc2FnZVwiPjxjb2RlIFtpbm5lckhUTUxdPVwiZ2V0SGlnaGxpZ2h0ZWRDb2RlKG1zZylcIj48L2NvZGU+PC9wcmU+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cImNvZGUtbGFuZ3VhZ2VcIj57eyBnZXRDb2RlTGFuZ3VhZ2UobXNnKSB9fTwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICA8bmctdGVtcGxhdGUgI25vbkNvZGVUZXh0TWVzc2FnZT5cclxuICAgICAgICAgICAgICAgICAgICA8ZGl2ICpuZ0lmPVwiaXNUYWJsZVRleHQobXNnKTsgZWxzZSBwbGFpblRleHRNZXNzYWdlXCIgY2xhc3M9XCJ0YWJsZS1tZXNzYWdlLXdyYXBcIj5cclxuICAgICAgICAgICAgICAgICAgICAgIDxidXR0b24gdHlwZT1cImJ1dHRvblwiIGNsYXNzPVwicmVuZGVyLWNvcHktYnRuXCIgKGNsaWNrKT1cImNvcHlNZXNzYWdlVGV4dChtc2csICRldmVudClcIiB0aXRsZT1cIkNvcHkgdGFibGVcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPG1hdC1pY29uPmNvbnRlbnRfY29weTwvbWF0LWljb24+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgICAgICAgICAgICAgIDx0YWJsZSBjbGFzcz1cInBhc3RlZC10YWJsZVwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGJvZHk+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPHRyICpuZ0Zvcj1cImxldCByb3cgb2YgZ2V0VGFibGVSb3dzKG1zZyk7IGxldCByb3dJbmRleCA9IGluZGV4XCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8bmctY29udGFpbmVyICpuZ0Zvcj1cImxldCBjZWxsIG9mIHJvd1wiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dGggKm5nSWY9XCJyb3dJbmRleCA9PT0gMDsgZWxzZSB0YWJsZUNlbGxcIj57eyBjZWxsIH19PC90aD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPG5nLXRlbXBsYXRlICN0YWJsZUNlbGw+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRkPnt7IGNlbGwgfX08L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L25nLXRlbXBsYXRlPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9uZy1jb250YWluZXI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPC90cj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPC90Ym9keT5cclxuICAgICAgICAgICAgICAgICAgICAgIDwvdGFibGU+XHJcbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgPG5nLXRlbXBsYXRlICNwbGFpblRleHRNZXNzYWdlPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPGRpdiAqbmdJZj1cImlzTWFya2Rvd25UZXh0KG1zZyk7IGVsc2UgcmF3VGV4dE1lc3NhZ2VcIiBjbGFzcz1cIm1kLW1lc3NhZ2Utd3JhcFwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8YnV0dG9uIHR5cGU9XCJidXR0b25cIiBjbGFzcz1cInJlbmRlci1jb3B5LWJ0blwiIChjbGljayk9XCJjb3B5TWVzc2FnZVRleHQobXNnLCAkZXZlbnQpXCIgdGl0bGU9XCJDb3B5IG1hcmtkb3duXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPG1hdC1pY29uPmNvbnRlbnRfY29weTwvbWF0LWljb24+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwibWQtbWVzc2FnZVwiIFtpbm5lckhUTUxdPVwiZ2V0TWFya2Rvd25IdG1sKG1zZylcIj48L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJtZC1sYW5ndWFnZVwiPm1kPC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8bmctdGVtcGxhdGUgI3Jhd1RleHRNZXNzYWdlPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3M9XCJ0ZXh0LWNvbnRlbnRcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIFtjbGFzcy5wcmVmb3JtYXR0ZWQtdGV4dF09XCJpc1ByZWZvcm1hdHRlZFRleHQobXNnKVwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICB7eyBnZXRNZXNzYWdlQm9keShtc2cpIH19XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgPC9uZy10ZW1wbGF0ZT5cclxuICAgICAgICAgICAgICAgICAgICA8L25nLXRlbXBsYXRlPlxyXG4gICAgICAgICAgICAgICAgICAgIDwvbmctdGVtcGxhdGU+XHJcbiAgICAgICAgICAgICAgICAgIDwvbmctdGVtcGxhdGU+XHJcbiAgICAgICAgICAgICAgICA8L25nLWNvbnRhaW5lcj5cclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJtZXNzYWdlLW1ldGFcIj5cclxuICAgICAgICAgICAgICAgICAgPHNwYW4gKm5nSWY9XCJtc2cuZWRpdGVkX2F0ICYmICFpc0RlbGV0ZWRNZXNzYWdlKG1zZylcIiBjbGFzcz1cImVkaXRlZC1sYWJlbFwiPmVkaXRlZDwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJtc2ctdGltZVwiPnt7IGZvcm1hdFRpbWUobXNnLmNyZWF0ZWRfYXQpIH19PC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICA8bWF0LWljb25cclxuICAgICAgICAgICAgICAgICAgICAqbmdJZj1cImlzT3duTWVzc2FnZShtc2cpICYmIGlzTWVzc2FnZVJlYWQobXNnKVwiXHJcbiAgICAgICAgICAgICAgICAgICAgY2xhc3M9XCJyZWFkLWljb24gcmVhZFwiXHJcbiAgICAgICAgICAgICAgICAgICAgW21hdFRvb2x0aXBdPVwiZ2V0UmVhZFRvb2x0aXAobXNnKVwiXHJcbiAgICAgICAgICAgICAgICAgICAgbWF0VG9vbHRpcFBvc2l0aW9uPVwiYWJvdmVcIlxyXG4gICAgICAgICAgICAgICAgICA+ZG9uZV9hbGw8L21hdC1pY29uPlxyXG4gICAgICAgICAgICAgICAgICA8bWF0LWljb25cclxuICAgICAgICAgICAgICAgICAgICAqbmdJZj1cImlzT3duTWVzc2FnZShtc2cpICYmICFpc01lc3NhZ2VSZWFkKG1zZylcIlxyXG4gICAgICAgICAgICAgICAgICAgIGNsYXNzPVwicmVhZC1pY29uIHVucmVhZFwiXHJcbiAgICAgICAgICAgICAgICAgICAgbWF0VG9vbHRpcD1cIlNlbnRcIlxyXG4gICAgICAgICAgICAgICAgICAgIG1hdFRvb2x0aXBQb3NpdGlvbj1cImFib3ZlXCJcclxuICAgICAgICAgICAgICAgICAgPmRvbmU8L21hdC1pY29uPlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICA8ZGl2ICpuZ0lmPVwiaG92ZXJlZE1lc3NhZ2VJZCA9PT0gbXNnLm1lc3NhZ2VfaWQgJiYgIWlzRGVsZXRlZE1lc3NhZ2UobXNnKVwiIGNsYXNzPVwicXVpY2stcmVhY3Rpb25zXCI+XHJcbiAgICAgICAgICAgICAgICAgIDxidXR0b25cclxuICAgICAgICAgICAgICAgICAgICAqbmdGb3I9XCJsZXQgZW1vamkgb2YgcXVpY2tFbW9qaXNcIlxyXG4gICAgICAgICAgICAgICAgICAgIGNsYXNzPVwicXVpY2stZW1vamktYnRuXCJcclxuICAgICAgICAgICAgICAgICAgICAoY2xpY2spPVwib25FbW9qaVNlbGVjdGVkKGVtb2ppLCBtc2cubWVzc2FnZV9pZClcIlxyXG4gICAgICAgICAgICAgICAgICAgIFthdHRyLmFyaWEtbGFiZWxdPVwiJ1JlYWN0IHdpdGggJyArIGVtb2ppXCJcclxuICAgICAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgICAgIHt7IGVtb2ppIH19XHJcbiAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICA8ZGl2ICpuZ0lmPVwiIWlzRGVsZXRlZE1lc3NhZ2UobXNnKSAmJiBtc2cucmVhY3Rpb25zICYmIG1zZy5yZWFjdGlvbnMubGVuZ3RoID4gMFwiIGNsYXNzPVwicmVhY3Rpb25zLXJvd1wiPlxyXG4gICAgICAgICAgICAgICAgICA8YnV0dG9uIFxyXG4gICAgICAgICAgICAgICAgICAgICpuZ0Zvcj1cImxldCByIG9mIG1zZy5yZWFjdGlvbnNcIiBcclxuICAgICAgICAgICAgICAgICAgICBjbGFzcz1cInJlYWN0aW9uLWNoaXBcIlxyXG4gICAgICAgICAgICAgICAgICAgIChjbGljayk9XCJ0b2dnbGVSZWFjdGlvbihyLmVtb2ppLCBtc2cubWVzc2FnZV9pZClcIlxyXG4gICAgICAgICAgICAgICAgICAgIFtjbGFzcy5vd24tcmVhY3Rpb25dPVwici5oYXNSZWFjdGVkXCJcclxuICAgICAgICAgICAgICAgICAgICBbbWF0VG9vbHRpcF09XCJnZXRSZWFjdG9yVG9vbHRpcChyKVwiXHJcbiAgICAgICAgICAgICAgICAgICAgbWF0VG9vbHRpcFBvc2l0aW9uPVwiYWJvdmVcIlxyXG4gICAgICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJyZWFjdGlvbi1lbW9qaVwiPnt7IHIuZW1vamkgfX08L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJyZWFjdGlvbi1jb3VudFwiPnt7IHIuY291bnQgfX08L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgIDwvbmctdGVtcGxhdGU+XHJcbiAgICAgICAgICA8L25nLWNvbnRhaW5lcj5cclxuICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgPGRpdiAqbmdJZj1cIiFpc1JlbW92ZWRGcm9tR3JvdXAgJiYgbWVzc2FnZXMubGVuZ3RoID09PSAwICYmICFsb2FkaW5nXCIgY2xhc3M9XCJlbXB0eS1jaGF0XCI+XHJcbiAgICAgICAgICA8bWF0LWljb24+Y2hhdF9idWJibGVfb3V0bGluZTwvbWF0LWljb24+XHJcbiAgICAgICAgICA8cD5ObyBtZXNzYWdlcyB5ZXQuIFNheSBoZWxsbyE8L3A+XHJcbiAgICAgICAgPC9kaXY+XHJcbiAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgPGRpdlxyXG4gICAgICAgICpuZ0lmPVwibWVzc2FnZUNvbnRleHRNZW51IGFzIG1lbnVcIlxyXG4gICAgICAgIGNsYXNzPVwibWVzc2FnZS1jb250ZXh0LW1lbnVcIlxyXG4gICAgICAgIFtzdHlsZS5sZWZ0LnB4XT1cIm1lbnUueFwiXHJcbiAgICAgICAgW3N0eWxlLnRvcC5weF09XCJtZW51LnlcIlxyXG4gICAgICAgIChjbGljayk9XCIkZXZlbnQuc3RvcFByb3BhZ2F0aW9uKClcIlxyXG4gICAgICAgIChjb250ZXh0bWVudSk9XCIkZXZlbnQucHJldmVudERlZmF1bHQoKVwiXHJcbiAgICAgID5cclxuICAgICAgICA8bmctY29udGFpbmVyICpuZ0lmPVwiIW1lbnUuY29uZmlybURlbGV0ZTsgZWxzZSBkZWxldGVDb25maXJtTWVudVwiPlxyXG4gICAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgICAqbmdJZj1cImNhblJlcGx5TWVzc2FnZShtZW51Lm1lc3NhZ2UpXCJcclxuICAgICAgICAgICAgdHlwZT1cImJ1dHRvblwiXHJcbiAgICAgICAgICAgIGNsYXNzPVwiY29udGV4dC1tZW51LWl0ZW1cIlxyXG4gICAgICAgICAgICAoY2xpY2spPVwicmVwbHlGcm9tQ29udGV4dE1lbnUoKVwiXHJcbiAgICAgICAgICA+XHJcbiAgICAgICAgICAgIDxtYXQtaWNvbj5yZXBseTwvbWF0LWljb24+XHJcbiAgICAgICAgICAgIDxzcGFuPlJlcGx5PC9zcGFuPlxyXG4gICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICA8YnV0dG9uXHJcbiAgICAgICAgICAgICpuZ0lmPVwiY2FuRWRpdE1lc3NhZ2UobWVudS5tZXNzYWdlKVwiXHJcbiAgICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxyXG4gICAgICAgICAgICBjbGFzcz1cImNvbnRleHQtbWVudS1pdGVtXCJcclxuICAgICAgICAgICAgKGNsaWNrKT1cImVkaXRGcm9tQ29udGV4dE1lbnUoKVwiXHJcbiAgICAgICAgICA+XHJcbiAgICAgICAgICAgIDxtYXQtaWNvbj5lZGl0PC9tYXQtaWNvbj5cclxuICAgICAgICAgICAgPHNwYW4+RWRpdDwvc3Bhbj5cclxuICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgICAqbmdJZj1cImNhbkRlbGV0ZU1lc3NhZ2UobWVudS5tZXNzYWdlKVwiXHJcbiAgICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxyXG4gICAgICAgICAgICBjbGFzcz1cImNvbnRleHQtbWVudS1pdGVtIGRhbmdlclwiXHJcbiAgICAgICAgICAgIChjbGljayk9XCJyZXF1ZXN0RGVsZXRlRnJvbUNvbnRleHRNZW51KClcIlxyXG4gICAgICAgICAgPlxyXG4gICAgICAgICAgICA8bWF0LWljb24+ZGVsZXRlPC9tYXQtaWNvbj5cclxuICAgICAgICAgICAgPHNwYW4+RGVsZXRlPC9zcGFuPlxyXG4gICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgPC9uZy1jb250YWluZXI+XHJcbiAgICAgICAgPG5nLXRlbXBsYXRlICNkZWxldGVDb25maXJtTWVudT5cclxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJjb250ZXh0LW1lbnUtY29uZmlybVwiPlxyXG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwiY29uZmlybS10aXRsZVwiPkRlbGV0ZSB0aGlzIG1lc3NhZ2U/PC9kaXY+XHJcbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJjb25maXJtLWFjdGlvbnNcIj5cclxuICAgICAgICAgICAgICA8YnV0dG9uIHR5cGU9XCJidXR0b25cIiBjbGFzcz1cImNvbmZpcm0tY2FuY2VsXCIgKGNsaWNrKT1cImNsb3NlTWVzc2FnZUNvbnRleHRNZW51KClcIj5DYW5jZWw8L2J1dHRvbj5cclxuICAgICAgICAgICAgICA8YnV0dG9uIHR5cGU9XCJidXR0b25cIiBjbGFzcz1cImNvbmZpcm0tZGVsZXRlXCIgKGNsaWNrKT1cImNvbmZpcm1EZWxldGVGcm9tQ29udGV4dE1lbnUoKVwiPkRlbGV0ZTwvYnV0dG9uPlxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgIDwvbmctdGVtcGxhdGU+XHJcbiAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgPGFwcC1tZXNzYWdlLWlucHV0XHJcbiAgICAgICAgKm5nSWY9XCIhaXNSZW1vdmVkRnJvbUdyb3VwXCJcclxuICAgICAgICBbY29udmVyc2F0aW9uSWRdPVwiY29udmVyc2F0aW9uSWRcIlxyXG4gICAgICAgIFtyZXBseVRvXT1cInJlcGx5VG9NZXNzYWdlID8gZ2V0Q29tcG9zZVJlcGx5UHJldmlldyhyZXBseVRvTWVzc2FnZSkgOiBudWxsXCJcclxuICAgICAgICBbZW5hYmxlTWVudGlvbnNdPVwiaXNHcm91cFwiXHJcbiAgICAgICAgW21lbnRpb25PcHRpb25zXT1cIm1lbnRpb25PcHRpb25zXCJcclxuICAgICAgICAobWVzc2FnZVNlbnQpPVwib25TZW5kTWVzc2FnZSgkZXZlbnQpXCJcclxuICAgICAgICAobWVzc2FnZVdpdGhGaWxlcyk9XCJvblNlbmRXaXRoRmlsZXMoJGV2ZW50KVwiXHJcbiAgICAgICAgKHJlcGx5Q2FuY2VsbGVkKT1cImNsZWFyUmVwbHkoKVwiXHJcbiAgICAgID48L2FwcC1tZXNzYWdlLWlucHV0PlxyXG4gICAgPC9kaXY+XHJcblxyXG4gIGAsXHJcbiAgc3R5bGVzOiBbYFxyXG4gICAgOmhvc3Qge1xyXG4gICAgICAtLWF0dGFjaG1lbnQtdGh1bWItc2l6ZTogMTgwcHg7XHJcbiAgICB9XHJcblxyXG4gICAgLmNoYXQtdGhyZWFkIHtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcclxuICAgICAgaGVpZ2h0OiAxMDAlO1xyXG4gICAgICBiYWNrZ3JvdW5kOiAjMDQxMzIyO1xyXG4gICAgICBwb3NpdGlvbjogcmVsYXRpdmU7XHJcbiAgICAgIGNvbnRhaW5lci10eXBlOiBpbmxpbmUtc2l6ZTtcclxuICAgICAgLS1hdHRhY2htZW50LXRodW1iLXNpemU6IGNsYW1wKDEyMHB4LCA0OGNxdywgMTgwcHgpO1xyXG4gICAgfVxyXG5cclxuICAgIC5jaGF0LXRocmVhZC5kcmFnLW92ZXIge1xyXG4gICAgICBvdXRsaW5lOiAycHggZGFzaGVkIHJnYmEoMjU1LCAyNTUsIDI1NSwgMC40NSk7XHJcbiAgICAgIG91dGxpbmUtb2Zmc2V0OiAtNnB4O1xyXG4gICAgfVxyXG5cclxuICAgIC50aHJlYWQtZHJhZy1vdmVybGF5IHtcclxuICAgICAgcG9zaXRpb246IGFic29sdXRlO1xyXG4gICAgICBpbnNldDogOHB4O1xyXG4gICAgICB6LWluZGV4OiAyMDtcclxuICAgICAgcG9pbnRlci1ldmVudHM6IG5vbmU7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xyXG4gICAgICBnYXA6IDhweDtcclxuICAgICAgY29sb3I6ICNmZmY7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMzEsIDc1LCAyMTYsIDAuMzIpO1xyXG4gICAgICBib3JkZXI6IDJweCBkYXNoZWQgcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjU1KTtcclxuICAgICAgYm9yZGVyLXJhZGl1czogMTRweDtcclxuICAgICAgZm9udC1zaXplOiAxNHB4O1xyXG4gICAgICBmb250LXdlaWdodDogNjAwO1xyXG4gICAgfVxyXG5cclxuICAgIC50aHJlYWQtZHJhZy1vdmVybGF5IG1hdC1pY29uIHtcclxuICAgICAgZm9udC1zaXplOiAzNnB4O1xyXG4gICAgICB3aWR0aDogMzZweDtcclxuICAgICAgaGVpZ2h0OiAzNnB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5jaGF0LWhlYWRlciB7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgIHBhZGRpbmc6IDhweCA4cHggOHB4IDRweDtcclxuICAgICAgYm9yZGVyLWJvdHRvbTogMXB4IHNvbGlkIHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xNSk7XHJcbiAgICAgIGdhcDogNHB4O1xyXG4gICAgICBmbGV4LXNocmluazogMDtcclxuICAgIH1cclxuXHJcbiAgICAuY2hhdC1oZWFkZXIgYnV0dG9uIG1hdC1pY29uIHtcclxuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC44KTtcclxuICAgIH1cclxuXHJcbiAgICAuY2hhdC1uYW1lIHtcclxuICAgICAgZm9udC1zaXplOiAxNnB4O1xyXG4gICAgICBmb250LXdlaWdodDogNjAwO1xyXG4gICAgICBjb2xvcjogI2ZmZjtcclxuICAgIH1cclxuXHJcbiAgICAuaGVhZGVyLWluZm8ge1xyXG4gICAgICBmbGV4OiAxO1xyXG4gICAgICB3aGl0ZS1zcGFjZTogbm93cmFwO1xyXG4gICAgICBvdmVyZmxvdzogaGlkZGVuO1xyXG4gICAgICB0ZXh0LW92ZXJmbG93OiBlbGxpcHNpcztcclxuICAgICAgZGlzcGxheTogYmxvY2s7XHJcbiAgICAgIHBhZGRpbmc6IDAgNHB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5oZWFkZXItYWN0aW9ucyB7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgIGdhcDogMDtcclxuICAgIH1cclxuXHJcbiAgICAuaGVhZGVyLWFjdGlvbnMgYnV0dG9uIHtcclxuICAgICAgd2lkdGg6IDMycHg7XHJcbiAgICAgIGhlaWdodDogMzJweDtcclxuICAgICAgbWluLXdpZHRoOiAzMnB4ICFpbXBvcnRhbnQ7XHJcbiAgICAgIHBhZGRpbmc6IDAgIWltcG9ydGFudDtcclxuICAgICAgZGlzcGxheTogaW5saW5lLWZsZXggIWltcG9ydGFudDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlciAhaW1wb3J0YW50O1xyXG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlciAhaW1wb3J0YW50O1xyXG4gICAgICAtLW1kYy1pY29uLWJ1dHRvbi1zdGF0ZS1sYXllci1zaXplOiAzMnB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5oZHItYnRuIHtcclxuICAgICAgYm9yZGVyLXJhZGl1czogNnB4ICFpbXBvcnRhbnQ7XHJcbiAgICAgIHRyYW5zaXRpb246IGJhY2tncm91bmQgMC4xNXMsIGJveC1zaGFkb3cgMC4xNXM7XHJcbiAgICB9XHJcblxyXG4gICAgLmhkci1idG46aG92ZXIge1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMTUpICFpbXBvcnRhbnQ7XHJcbiAgICAgIGJveC1zaGFkb3c6IDAgMnB4IDhweCByZ2JhKDAsIDAsIDAsIDAuMik7XHJcbiAgICB9XHJcblxyXG4gICAgLmhkci1idG4gbWF0LWljb24ge1xyXG4gICAgICBmb250LXNpemU6IDIwcHg7XHJcbiAgICAgIHdpZHRoOiAyMHB4O1xyXG4gICAgICBoZWlnaHQ6IDIwcHg7XHJcbiAgICAgIGxpbmUtaGVpZ2h0OiAyMHB4O1xyXG4gICAgICBtYXJnaW46IDA7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xyXG4gICAgfVxyXG5cclxuICAgIDpob3N0IDo6bmctZGVlcCAuaGRyLWJ0biAubWF0LW1kYy1idXR0b24tdG91Y2gtdGFyZ2V0IHtcclxuICAgICAgd2lkdGg6IDMycHggIWltcG9ydGFudDtcclxuICAgICAgaGVpZ2h0OiAzMnB4ICFpbXBvcnRhbnQ7XHJcbiAgICB9XHJcblxyXG4gICAgLm1lc3NhZ2VzLWFyZWEge1xyXG4gICAgICBmbGV4OiAxO1xyXG4gICAgICBvdmVyZmxvdy15OiBhdXRvO1xyXG4gICAgICBwYWRkaW5nOiAxMnB4O1xyXG4gICAgICBiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudDtcclxuICAgICAgc2Nyb2xsYmFyLXdpZHRoOiBub25lO1xyXG4gICAgICAtbXMtb3ZlcmZsb3ctc3R5bGU6IG5vbmU7XHJcbiAgICB9XHJcblxyXG4gICAgLm1lc3NhZ2VzLWFyZWE6Oi13ZWJraXQtc2Nyb2xsYmFyIHtcclxuICAgICAgZGlzcGxheTogbm9uZTtcclxuICAgIH1cclxuXHJcbiAgICAubG9hZGluZy1pbmRpY2F0b3Ige1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcclxuICAgICAgZ2FwOiA4cHg7XHJcbiAgICAgIHBhZGRpbmc6IDEycHg7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNyk7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTNweDtcclxuICAgIH1cclxuXHJcbiAgICAucmVtb3ZlZC1ncm91cC1zdGF0ZSB7XHJcbiAgICAgIGhlaWdodDogMTAwJTtcclxuICAgICAgbWluLWhlaWdodDogMjYwcHg7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xyXG4gICAgICB0ZXh0LWFsaWduOiBjZW50ZXI7XHJcbiAgICAgIGdhcDogMTBweDtcclxuICAgICAgcGFkZGluZzogMzJweCAyNHB4O1xyXG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjc4KTtcclxuICAgICAgYm94LXNpemluZzogYm9yZGVyLWJveDtcclxuICAgIH1cclxuXHJcbiAgICAucmVtb3ZlZC1ncm91cC1zdGF0ZSBtYXQtaWNvbiB7XHJcbiAgICAgIHdpZHRoOiA0NHB4O1xyXG4gICAgICBoZWlnaHQ6IDQ0cHg7XHJcbiAgICAgIGZvbnQtc2l6ZTogNDRweDtcclxuICAgICAgY29sb3I6ICNmODcxNzE7XHJcbiAgICAgIG1hcmdpbi1ib3R0b206IDRweDtcclxuICAgIH1cclxuXHJcbiAgICAucmVtb3ZlZC1ncm91cC1zdGF0ZSBoNCB7XHJcbiAgICAgIG1hcmdpbjogMDtcclxuICAgICAgY29sb3I6ICNmZmY7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTdweDtcclxuICAgICAgZm9udC13ZWlnaHQ6IDcwMDtcclxuICAgIH1cclxuXHJcbiAgICAucmVtb3ZlZC1ncm91cC1zdGF0ZSBwIHtcclxuICAgICAgbWFyZ2luOiAwIDAgOHB4O1xyXG4gICAgICBtYXgtd2lkdGg6IDI4MHB4O1xyXG4gICAgICBmb250LXNpemU6IDEzcHg7XHJcbiAgICAgIGxpbmUtaGVpZ2h0OiAxLjQ7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNjIpO1xyXG4gICAgfVxyXG5cclxuICAgIC5yZW1vdmVkLWV4aXQtYnRuIHtcclxuICAgICAgYm9yZGVyLXJhZGl1czogMTBweDtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjE4KSAhaW1wb3J0YW50O1xyXG4gICAgICBjb2xvcjogI2ZmZiAhaW1wb3J0YW50O1xyXG4gICAgICBmb250LXdlaWdodDogNzAwO1xyXG4gICAgICBwYWRkaW5nOiAwIDE4cHg7XHJcbiAgICB9XHJcblxyXG4gICAgLmxvYWQtbW9yZS1idG4ge1xyXG4gICAgICBhbGlnbi1zZWxmOiBjZW50ZXI7XHJcbiAgICAgIG1hcmdpbi1ib3R0b206IDE2cHg7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTJweDtcclxuICAgICAgY29sb3I6ICNmZmY7XHJcbiAgICB9XHJcblxyXG4gICAgLm1lc3NhZ2VzLWxpc3Qge1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xyXG4gICAgICBnYXA6IDFweDtcclxuICAgICAgZmxleDogMTtcclxuICAgIH1cclxuXHJcbiAgICAuZGF0ZS1zZXBhcmF0b3Ige1xyXG4gICAgICB0ZXh0LWFsaWduOiBjZW50ZXI7XHJcbiAgICAgIG1hcmdpbjogMTZweCAwIDhweDtcclxuICAgICAgZm9udC1zaXplOiAxMnB4O1xyXG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjcpO1xyXG4gICAgICBmb250LXdlaWdodDogNTAwO1xyXG4gICAgfVxyXG5cclxuICAgIC5tZXNzYWdlLWJ1YmJsZS1yb3cge1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xyXG4gICAgICBtYXgtd2lkdGg6IDg4JTtcclxuICAgICAgbWFyZ2luLWJvdHRvbTogMnB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5tZXNzYWdlLWJ1YmJsZS1yb3cub3duIHtcclxuICAgICAgYWxpZ24tc2VsZjogZmxleC1lbmQ7XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBmbGV4LWVuZDtcclxuICAgIH1cclxuXHJcbiAgICAubWVzc2FnZS1idWJibGUtcm93Lm90aGVyIHtcclxuICAgICAgYWxpZ24tc2VsZjogZmxleC1zdGFydDtcclxuICAgICAgYWxpZ24taXRlbXM6IGZsZXgtc3RhcnQ7XHJcbiAgICB9XHJcblxyXG4gICAgLnNlbmRlci1uYW1lIHtcclxuICAgICAgZm9udC1zaXplOiAxMXB4O1xyXG4gICAgICBmb250LXdlaWdodDogNzAwO1xyXG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjk1KTtcclxuICAgICAgbWFyZ2luLWJvdHRvbTogM3B4O1xyXG4gICAgICBsZXR0ZXItc3BhY2luZzogMC4ycHg7XHJcbiAgICAgIHBhZGRpbmc6IDAgMTBweDtcclxuICAgICAgdGV4dC1zaGFkb3c6IDAgMXB4IDNweCByZ2JhKDAsIDAsIDAsIDAuNCk7XHJcbiAgICB9XHJcblxyXG4gICAgLnN5c3RlbS1tZXNzYWdlLXJvdyB7XHJcbiAgICAgIGFsaWduLXNlbGY6IGNlbnRlcjtcclxuICAgICAgbWF4LXdpZHRoOiA4OCU7XHJcbiAgICAgIG1hcmdpbjogOHB4IGF1dG87XHJcbiAgICAgIHRleHQtYWxpZ246IGNlbnRlcjtcclxuICAgIH1cclxuXHJcbiAgICAuc3lzdGVtLW1lc3NhZ2UtdGV4dCB7XHJcbiAgICAgIGRpc3BsYXk6IGlubGluZS1mbGV4O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcclxuICAgICAgcGFkZGluZzogNXB4IDExcHg7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDk5OXB4O1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMDkpO1xyXG4gICAgICBib3JkZXI6IDFweCBzb2xpZCByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMTIpO1xyXG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjcyKTtcclxuICAgICAgZm9udC1zaXplOiAxMXB4O1xyXG4gICAgICBsaW5lLWhlaWdodDogMS4zNTtcclxuICAgIH1cclxuXHJcbiAgICAubWVzc2FnZS1idWJibGUge1xyXG4gICAgICBwYWRkaW5nOiA4cHggMTRweCA3cHg7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDE0cHg7XHJcbiAgICAgIGZvbnQtc2l6ZTogY2FsYyhjbGFtcCgxMXB4LCAzLjRjcXcsIDEzcHgpICogdmFyKC0tbWVzc2FnZS10ZXh0LXNjYWxlLCAxKSk7XHJcbiAgICAgIGxpbmUtaGVpZ2h0OiAxLjMyO1xyXG4gICAgICB3b3JkLWJyZWFrOiBicmVhay13b3JkO1xyXG4gICAgICBjb2xvcjogI2Y1ZjdmZjtcclxuICAgICAgcG9zaXRpb246IHJlbGF0aXZlO1xyXG4gICAgICBkaXNwbGF5OiBpbmxpbmUtYmxvY2s7XHJcbiAgICAgIG1pbi13aWR0aDogZml0LWNvbnRlbnQ7XHJcbiAgICB9XHJcblxyXG4gICAgLm1lc3NhZ2UtYnViYmxlLXJvdy5vdGhlciAubWVzc2FnZS1idWJibGUge1xyXG4gICAgICBiYWNrZ3JvdW5kOiAjMGQyNTQwO1xyXG4gICAgICBib3JkZXItYm90dG9tLWxlZnQtcmFkaXVzOiA1cHg7XHJcbiAgICAgIGJveC1zaGFkb3c6IDAgMXB4IDRweCByZ2JhKDAsIDAsIDAsIDAuNCk7XHJcbiAgICB9XHJcblxyXG4gICAgLm1lc3NhZ2UtYnViYmxlLm93bi1idWJibGUge1xyXG4gICAgICBiYWNrZ3JvdW5kOiAjMGEzZDYyO1xyXG4gICAgICBib3JkZXItYm90dG9tLXJpZ2h0LXJhZGl1czogNXB4O1xyXG4gICAgICBib3gtc2hhZG93OiAwIDFweCA0cHggcmdiYSgwLCAwLCAwLCAwLjQpO1xyXG4gICAgfVxyXG5cclxuICAgIC5yZXBseS1jb250ZXh0IHtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAgZ2FwOiA3cHg7XHJcbiAgICAgIG1hcmdpbi1ib3R0b206IDdweDtcclxuICAgICAgcGFkZGluZzogN3B4IDlweDtcclxuICAgICAgYm9yZGVyLXJhZGl1czogMTBweDtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjA4KTtcclxuICAgICAgYm9yZGVyLWxlZnQ6IDNweCBzb2xpZCByZ2JhKDEyNywgMTgwLCAyNTUsIDAuNzgpO1xyXG4gICAgICBtYXgtd2lkdGg6IG1pbig2OGNxdywgNDIwcHgpO1xyXG4gICAgfVxyXG5cclxuICAgIC5yZXBseS1jb250ZXh0IG1hdC1pY29uIHtcclxuICAgICAgY29sb3I6ICNiZmRiZmU7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTZweDtcclxuICAgICAgd2lkdGg6IDE2cHg7XHJcbiAgICAgIGhlaWdodDogMTZweDtcclxuICAgICAgZmxleC1zaHJpbms6IDA7XHJcbiAgICB9XHJcblxyXG4gICAgLnJlcGx5LWNvbnRleHQgZGl2IHtcclxuICAgICAgbWluLXdpZHRoOiAwO1xyXG4gICAgfVxyXG5cclxuICAgIC5yZXBseS1jb250ZXh0IHNwYW4ge1xyXG4gICAgICBkaXNwbGF5OiBibG9jaztcclxuICAgICAgY29sb3I6ICNiZmRiZmU7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTFweDtcclxuICAgICAgZm9udC13ZWlnaHQ6IDcwMDtcclxuICAgICAgbWFyZ2luLWJvdHRvbTogMnB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5yZXBseS1jb250ZXh0IHAge1xyXG4gICAgICBtYXJnaW46IDA7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNzgpO1xyXG4gICAgICBmb250LXNpemU6IDEycHg7XHJcbiAgICAgIHdoaXRlLXNwYWNlOiBub3dyYXA7XHJcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XHJcbiAgICAgIHRleHQtb3ZlcmZsb3c6IGVsbGlwc2lzO1xyXG4gICAgfVxyXG5cclxuICAgIC50ZXh0LWNvbnRlbnQge1xyXG4gICAgICB3aGl0ZS1zcGFjZTogcHJlLXdyYXA7XHJcbiAgICAgIHRhYi1zaXplOiA0O1xyXG4gICAgfVxyXG5cclxuICAgIC50ZXh0LWNvbnRlbnQucHJlZm9ybWF0dGVkLXRleHQge1xyXG4gICAgICBmb250LWZhbWlseTogdWktbW9ub3NwYWNlLCBTRk1vbm8tUmVndWxhciwgTWVubG8sIE1vbmFjbywgQ29uc29sYXMsIFwiTGliZXJhdGlvbiBNb25vXCIsIG1vbm9zcGFjZTtcclxuICAgICAgZm9udC1zaXplOiBjYWxjKGNsYW1wKDEwcHgsIDMuMWNxdywgMTJweCkgKiB2YXIoLS1jb2RlLXRleHQtc2NhbGUsIDEpKTtcclxuICAgICAgbGluZS1oZWlnaHQ6IDEuNDU7XHJcbiAgICAgIG92ZXJmbG93LXg6IGF1dG87XHJcbiAgICAgIG1heC13aWR0aDogbWluKDcyY3F3LCA1MjBweCk7XHJcbiAgICAgIHNjcm9sbGJhci13aWR0aDogbm9uZTtcclxuICAgICAgLW1zLW92ZXJmbG93LXN0eWxlOiBub25lO1xyXG4gICAgfVxyXG5cclxuICAgIC50ZXh0LWNvbnRlbnQucHJlZm9ybWF0dGVkLXRleHQ6Oi13ZWJraXQtc2Nyb2xsYmFyIHtcclxuICAgICAgZGlzcGxheTogbm9uZTtcclxuICAgIH1cclxuXHJcbiAgICAuaW5saW5lLWVkaXQtd3JhcCB7XHJcbiAgICAgIHdpZHRoOiBtaW4oNzZjcXcsIDUyMHB4KTtcclxuICAgICAgbWluLXdpZHRoOiBtaW4oNTZjcXcsIDI2MHB4KTtcclxuICAgIH1cclxuXHJcbiAgICAuaW5saW5lLWVkaXQtdGV4dGFyZWEge1xyXG4gICAgICB3aWR0aDogMTAwJTtcclxuICAgICAgbWluLWhlaWdodDogNzJweDtcclxuICAgICAgbWF4LWhlaWdodDogMjIwcHg7XHJcbiAgICAgIGJveC1zaXppbmc6IGJvcmRlci1ib3g7XHJcbiAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4yOCk7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDEwcHg7XHJcbiAgICAgIG91dGxpbmU6IG5vbmU7XHJcbiAgICAgIHJlc2l6ZTogdmVydGljYWw7XHJcbiAgICAgIHBhZGRpbmc6IDlweCAxMHB4O1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMSk7XHJcbiAgICAgIGNvbG9yOiAjZmZmO1xyXG4gICAgICBmb250OiBpbmhlcml0O1xyXG4gICAgICBsaW5lLWhlaWdodDogMS4zNTtcclxuICAgICAgd2hpdGUtc3BhY2U6IHByZS13cmFwO1xyXG4gICAgfVxyXG5cclxuICAgIC5pbmxpbmUtZWRpdC10ZXh0YXJlYTpmb2N1cyB7XHJcbiAgICAgIGJvcmRlci1jb2xvcjogcmdiYSgxOTEsIDIxOSwgMjU0LCAwLjkpO1xyXG4gICAgICBib3gtc2hhZG93OiAwIDAgMCAycHggcmdiYSgxMjcsIDE4MCwgMjU1LCAwLjE4KTtcclxuICAgIH1cclxuXHJcbiAgICAuaW5saW5lLWVkaXQtYWN0aW9ucyB7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGp1c3RpZnktY29udGVudDogZmxleC1lbmQ7XHJcbiAgICAgIGdhcDogOHB4O1xyXG4gICAgICBtYXJnaW4tdG9wOiA4cHg7XHJcbiAgICB9XHJcblxyXG4gICAgLmlubGluZS1lZGl0LWNhbmNlbCxcclxuICAgIC5pbmxpbmUtZWRpdC1zYXZlIHtcclxuICAgICAgYm9yZGVyOiAwO1xyXG4gICAgICBib3JkZXItcmFkaXVzOiA4cHg7XHJcbiAgICAgIHBhZGRpbmc6IDZweCAxMHB4O1xyXG4gICAgICBjb2xvcjogI2Y4ZmFmYztcclxuICAgICAgY3Vyc29yOiBwb2ludGVyO1xyXG4gICAgICBmb250LXNpemU6IDEycHg7XHJcbiAgICAgIGZvbnQtd2VpZ2h0OiA3MDA7XHJcbiAgICB9XHJcblxyXG4gICAgLmlubGluZS1lZGl0LWNhbmNlbCB7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xMik7XHJcbiAgICB9XHJcblxyXG4gICAgLmlubGluZS1lZGl0LXNhdmUge1xyXG4gICAgICBiYWNrZ3JvdW5kOiAjMjU2M2ViO1xyXG4gICAgfVxyXG5cclxuICAgIC5pbmxpbmUtZWRpdC1zYXZlOmRpc2FibGVkIHtcclxuICAgICAgY3Vyc29yOiBub3QtYWxsb3dlZDtcclxuICAgICAgb3BhY2l0eTogMC40NTtcclxuICAgIH1cclxuXHJcbiAgICAuYXR0YWNobWVudC1jYXB0aW9uIHtcclxuICAgICAgbWFyZ2luLXRvcDogOHB4O1xyXG4gICAgICB3aWR0aDogdmFyKC0tYXR0YWNobWVudC10aHVtYi1zaXplKTtcclxuICAgICAgbWF4LXdpZHRoOiB2YXIoLS1hdHRhY2htZW50LXRodW1iLXNpemUpO1xyXG4gICAgICBib3gtc2l6aW5nOiBib3JkZXItYm94O1xyXG4gICAgfVxyXG5cclxuICAgIC5hdHRhY2htZW50LWNhcHRpb24gLnRleHQtY29udGVudCB7XHJcbiAgICAgIHdoaXRlLXNwYWNlOiBwcmUtd3JhcDtcclxuICAgICAgb3ZlcmZsb3ctd3JhcDogYW55d2hlcmU7XHJcbiAgICAgIG1heC13aWR0aDogMTAwJTtcclxuICAgIH1cclxuXHJcbiAgICAuYXR0YWNobWVudC1yZW5kZXItYmxvY2sge1xyXG4gICAgICB3aWR0aDogMTAwJTtcclxuICAgICAgbWF4LXdpZHRoOiAxMDAlO1xyXG4gICAgfVxyXG5cclxuICAgIC5jb2RlLW1lc3NhZ2Utd3JhcCB7XHJcbiAgICAgIHBvc2l0aW9uOiByZWxhdGl2ZTtcclxuICAgICAgbWF4LXdpZHRoOiBtaW4oNzZjcXcsIDU2MHB4KTtcclxuICAgICAgYm9yZGVyLXJhZGl1czogMTBweDtcclxuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcclxuICAgICAgYm9yZGVyOiAxcHggc29saWQgcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjE0KTtcclxuICAgICAgYmFja2dyb3VuZDogIzA2MTgyNztcclxuICAgIH1cclxuXHJcbiAgICAucmVuZGVyLWNvcHktYnRuIHtcclxuICAgICAgcG9zaXRpb246IGFic29sdXRlO1xyXG4gICAgICB0b3A6IDZweDtcclxuICAgICAgcmlnaHQ6IDZweDtcclxuICAgICAgei1pbmRleDogMjtcclxuICAgICAgd2lkdGg6IDI2cHg7XHJcbiAgICAgIGhlaWdodDogMjZweDtcclxuICAgICAgYm9yZGVyOiBub25lO1xyXG4gICAgICBib3JkZXItcmFkaXVzOiA3cHg7XHJcbiAgICAgIGRpc3BsYXk6IGlubGluZS1mbGV4O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcclxuICAgICAgcGFkZGluZzogMDtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSg3LCAyOSwgNDgsIDAuODIpO1xyXG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjc4KTtcclxuICAgICAgY3Vyc29yOiBwb2ludGVyO1xyXG4gICAgICBvcGFjaXR5OiAwO1xyXG4gICAgICB0cmFuc2l0aW9uOiBvcGFjaXR5IDAuMTJzLCBiYWNrZ3JvdW5kIDAuMTJzLCBjb2xvciAwLjEycztcclxuICAgIH1cclxuXHJcbiAgICAuY29kZS1tZXNzYWdlLXdyYXA6aG92ZXIgLnJlbmRlci1jb3B5LWJ0bixcclxuICAgIC50YWJsZS1tZXNzYWdlLXdyYXA6aG92ZXIgLnJlbmRlci1jb3B5LWJ0bixcclxuICAgIC5tZC1tZXNzYWdlLXdyYXA6aG92ZXIgLnJlbmRlci1jb3B5LWJ0bixcclxuICAgIC5yZW5kZXItY29weS1idG46Zm9jdXMge1xyXG4gICAgICBvcGFjaXR5OiAxO1xyXG4gICAgfVxyXG5cclxuICAgIC5yZW5kZXItY29weS1idG46aG92ZXIge1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDEyNywgMTgwLCAyNTUsIDAuMjIpO1xyXG4gICAgICBjb2xvcjogI2ZmZjtcclxuICAgIH1cclxuXHJcbiAgICAucmVuZGVyLWNvcHktYnRuIG1hdC1pY29uIHtcclxuICAgICAgZm9udC1zaXplOiAxNnB4O1xyXG4gICAgICB3aWR0aDogMTZweDtcclxuICAgICAgaGVpZ2h0OiAxNnB4O1xyXG4gICAgICBsaW5lLWhlaWdodDogMTZweDtcclxuICAgIH1cclxuXHJcbiAgICAuY29kZS1tZXNzYWdlIHtcclxuICAgICAgbWFyZ2luOiAwO1xyXG4gICAgICBwYWRkaW5nOiAxMnB4IDQycHggMjhweCAxMnB4O1xyXG4gICAgICBvdmVyZmxvdy14OiBhdXRvO1xyXG4gICAgICBjb2xvcjogI2RiZWFmZTtcclxuICAgICAgZm9udC1mYW1pbHk6IHVpLW1vbm9zcGFjZSwgU0ZNb25vLVJlZ3VsYXIsIE1lbmxvLCBNb25hY28sIENvbnNvbGFzLCBcIkxpYmVyYXRpb24gTW9ub1wiLCBtb25vc3BhY2U7XHJcbiAgICAgIGZvbnQtc2l6ZTogY2FsYyhjbGFtcCgxMHB4LCAzLjFjcXcsIDEycHgpICogdmFyKC0tY29kZS10ZXh0LXNjYWxlLCAxKSk7XHJcbiAgICAgIGxpbmUtaGVpZ2h0OiAxLjQ1O1xyXG4gICAgICB3aGl0ZS1zcGFjZTogcHJlO1xyXG4gICAgICB0YWItc2l6ZTogMjtcclxuICAgICAgc2Nyb2xsYmFyLXdpZHRoOiBub25lO1xyXG4gICAgICAtbXMtb3ZlcmZsb3ctc3R5bGU6IG5vbmU7XHJcbiAgICB9XHJcblxyXG4gICAgLmNvZGUtbWVzc2FnZTo6LXdlYmtpdC1zY3JvbGxiYXIge1xyXG4gICAgICBkaXNwbGF5OiBub25lO1xyXG4gICAgfVxyXG5cclxuICAgIC5jb2RlLWxhbmd1YWdlIHtcclxuICAgICAgcG9zaXRpb246IGFic29sdXRlO1xyXG4gICAgICByaWdodDogOHB4O1xyXG4gICAgICBib3R0b206IDZweDtcclxuICAgICAgcGFkZGluZzogMnB4IDdweDtcclxuICAgICAgYm9yZGVyLXJhZGl1czogOTk5cHg7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMTI3LCAxODAsIDI1NSwgMC4xNik7XHJcbiAgICAgIGNvbG9yOiAjYmZkYmZlO1xyXG4gICAgICBmb250LXNpemU6IDEwcHg7XHJcbiAgICAgIGZvbnQtd2VpZ2h0OiA3MDA7XHJcbiAgICAgIGxldHRlci1zcGFjaW5nOiAwLjA1ZW07XHJcbiAgICAgIHRleHQtdHJhbnNmb3JtOiB1cHBlcmNhc2U7XHJcbiAgICAgIHBvaW50ZXItZXZlbnRzOiBub25lO1xyXG4gICAgfVxyXG5cclxuICAgIC5tZC1sYW5ndWFnZSB7XHJcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcclxuICAgICAgcmlnaHQ6IDhweDtcclxuICAgICAgYm90dG9tOiA2cHg7XHJcbiAgICAgIHBhZGRpbmc6IDJweCA3cHg7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDk5OXB4O1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDEzNCwgMjM5LCAxNzIsIDAuMTQpO1xyXG4gICAgICBjb2xvcjogI2JiZjdkMDtcclxuICAgICAgZm9udC1zaXplOiAxMHB4O1xyXG4gICAgICBmb250LXdlaWdodDogNzAwO1xyXG4gICAgICBsZXR0ZXItc3BhY2luZzogMC4wNWVtO1xyXG4gICAgICB0ZXh0LXRyYW5zZm9ybTogdXBwZXJjYXNlO1xyXG4gICAgICBwb2ludGVyLWV2ZW50czogbm9uZTtcclxuICAgIH1cclxuXHJcbiAgICA6aG9zdCA6Om5nLWRlZXAgLmNvZGUtdG9rZW4ta2V5d29yZCB7IGNvbG9yOiAjOTNjNWZkOyBmb250LXdlaWdodDogNzAwOyB9XHJcbiAgICA6aG9zdCA6Om5nLWRlZXAgLmNvZGUtdG9rZW4tc3RyaW5nIHsgY29sb3I6ICM4NmVmYWM7IH1cclxuICAgIDpob3N0IDo6bmctZGVlcCAuY29kZS10b2tlbi1udW1iZXIgeyBjb2xvcjogI2ZiYmYyNDsgfVxyXG4gICAgOmhvc3QgOjpuZy1kZWVwIC5jb2RlLXRva2VuLWNvbW1lbnQgeyBjb2xvcjogIzk0YTNiODsgZm9udC1zdHlsZTogaXRhbGljOyB9XHJcbiAgICA6aG9zdCA6Om5nLWRlZXAgLmNvZGUtdG9rZW4tZnVuY3Rpb24geyBjb2xvcjogI2M0YjVmZDsgfVxyXG5cclxuICAgIC50YWJsZS1tZXNzYWdlLXdyYXAge1xyXG4gICAgICBwb3NpdGlvbjogcmVsYXRpdmU7XHJcbiAgICAgIG1heC13aWR0aDogbWluKDc2Y3F3LCA1NjBweCk7XHJcbiAgICAgIG92ZXJmbG93LXg6IGF1dG87XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDlweDtcclxuICAgICAgYm9yZGVyOiAxcHggc29saWQgcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjE2KTtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjA0KTtcclxuICAgICAgc2Nyb2xsYmFyLXdpZHRoOiBub25lO1xyXG4gICAgICAtbXMtb3ZlcmZsb3ctc3R5bGU6IG5vbmU7XHJcbiAgICB9XHJcblxyXG4gICAgLnRhYmxlLW1lc3NhZ2Utd3JhcDo6LXdlYmtpdC1zY3JvbGxiYXIge1xyXG4gICAgICBkaXNwbGF5OiBub25lO1xyXG4gICAgfVxyXG5cclxuICAgIC5wYXN0ZWQtdGFibGUge1xyXG4gICAgICBib3JkZXItY29sbGFwc2U6IGNvbGxhcHNlO1xyXG4gICAgICBtaW4td2lkdGg6IDEwMCU7XHJcbiAgICAgIGZvbnQtc2l6ZTogY2FsYyhjbGFtcCgxMHB4LCAzLjFjcXcsIDEycHgpICogdmFyKC0tY29kZS10ZXh0LXNjYWxlLCAxKSk7XHJcbiAgICAgIGxpbmUtaGVpZ2h0OiAxLjM1O1xyXG4gICAgICBjb2xvcjogI2Y1ZjdmZjtcclxuICAgIH1cclxuXHJcbiAgICAucGFzdGVkLXRhYmxlIHRoLFxyXG4gICAgLnBhc3RlZC10YWJsZSB0ZCB7XHJcbiAgICAgIHBhZGRpbmc6IDZweCA5cHg7XHJcbiAgICAgIGJvcmRlci1yaWdodDogMXB4IHNvbGlkIHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xMik7XHJcbiAgICAgIGJvcmRlci1ib3R0b206IDFweCBzb2xpZCByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMTIpO1xyXG4gICAgICB0ZXh0LWFsaWduOiBsZWZ0O1xyXG4gICAgICB3aGl0ZS1zcGFjZTogcHJlLXdyYXA7XHJcbiAgICAgIHZlcnRpY2FsLWFsaWduOiB0b3A7XHJcbiAgICB9XHJcblxyXG4gICAgLnBhc3RlZC10YWJsZSB0aCB7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xKTtcclxuICAgICAgZm9udC13ZWlnaHQ6IDcwMDtcclxuICAgIH1cclxuXHJcbiAgICAucGFzdGVkLXRhYmxlIHRyOmxhc3QtY2hpbGQgdGQsXHJcbiAgICAucGFzdGVkLXRhYmxlIHRyOmxhc3QtY2hpbGQgdGgge1xyXG4gICAgICBib3JkZXItYm90dG9tOiBub25lO1xyXG4gICAgfVxyXG5cclxuICAgIC5wYXN0ZWQtdGFibGUgdGg6bGFzdC1jaGlsZCxcclxuICAgIC5wYXN0ZWQtdGFibGUgdGQ6bGFzdC1jaGlsZCB7XHJcbiAgICAgIGJvcmRlci1yaWdodDogbm9uZTtcclxuICAgIH1cclxuXHJcbiAgICAubWQtbWVzc2FnZS13cmFwIHtcclxuICAgICAgcG9zaXRpb246IHJlbGF0aXZlO1xyXG4gICAgICBtYXgtd2lkdGg6IG1pbig3NmNxdywgNTYwcHgpO1xyXG4gICAgICBvdmVyZmxvdy14OiBhdXRvO1xyXG4gICAgICBib3JkZXItcmFkaXVzOiAxMHB4O1xyXG4gICAgICBib3JkZXI6IDFweCBzb2xpZCByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMTIpO1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMDUpO1xyXG4gICAgICBzY3JvbGxiYXItd2lkdGg6IG5vbmU7XHJcbiAgICAgIC1tcy1vdmVyZmxvdy1zdHlsZTogbm9uZTtcclxuICAgIH1cclxuXHJcbiAgICAubWQtbWVzc2FnZS13cmFwOjotd2Via2l0LXNjcm9sbGJhciB7XHJcbiAgICAgIGRpc3BsYXk6IG5vbmU7XHJcbiAgICB9XHJcblxyXG4gICAgLm1kLW1lc3NhZ2Uge1xyXG4gICAgICBwYWRkaW5nOiAxMHB4IDQycHggMjhweCAxMnB4O1xyXG4gICAgICBjb2xvcjogI2Y1ZjdmZjtcclxuICAgICAgZm9udC1zaXplOiBjYWxjKGNsYW1wKDExcHgsIDMuNGNxdywgMTNweCkgKiB2YXIoLS1tZXNzYWdlLXRleHQtc2NhbGUsIDEpKTtcclxuICAgICAgbGluZS1oZWlnaHQ6IDEuNDU7XHJcbiAgICAgIG92ZXJmbG93LXdyYXA6IGFueXdoZXJlO1xyXG4gICAgfVxyXG5cclxuICAgIDpob3N0IDo6bmctZGVlcCAubWQtbWVzc2FnZSBoMSxcclxuICAgIDpob3N0IDo6bmctZGVlcCAubWQtbWVzc2FnZSBoMixcclxuICAgIDpob3N0IDo6bmctZGVlcCAubWQtbWVzc2FnZSBoMyB7XHJcbiAgICAgIG1hcmdpbjogOHB4IDAgNnB4O1xyXG4gICAgICBjb2xvcjogI2ZmZjtcclxuICAgICAgbGluZS1oZWlnaHQ6IDEuMjU7XHJcbiAgICB9XHJcblxyXG4gICAgOmhvc3QgOjpuZy1kZWVwIC5tZC1tZXNzYWdlIGgxIHsgZm9udC1zaXplOiAxOHB4OyB9XHJcbiAgICA6aG9zdCA6Om5nLWRlZXAgLm1kLW1lc3NhZ2UgaDIgeyBmb250LXNpemU6IDE2cHg7IH1cclxuICAgIDpob3N0IDo6bmctZGVlcCAubWQtbWVzc2FnZSBoMyB7IGZvbnQtc2l6ZTogMTRweDsgfVxyXG5cclxuICAgIDpob3N0IDo6bmctZGVlcCAubWQtbWVzc2FnZSBwIHtcclxuICAgICAgbWFyZ2luOiA2cHggMDtcclxuICAgIH1cclxuXHJcbiAgICA6aG9zdCA6Om5nLWRlZXAgLm1kLW1lc3NhZ2UgdWwsXHJcbiAgICA6aG9zdCA6Om5nLWRlZXAgLm1kLW1lc3NhZ2Ugb2wge1xyXG4gICAgICBtYXJnaW46IDZweCAwO1xyXG4gICAgICBwYWRkaW5nLWxlZnQ6IDIwcHg7XHJcbiAgICB9XHJcblxyXG4gICAgOmhvc3QgOjpuZy1kZWVwIC5tZC1tZXNzYWdlIGJsb2NrcXVvdGUge1xyXG4gICAgICBtYXJnaW46IDhweCAwO1xyXG4gICAgICBwYWRkaW5nLWxlZnQ6IDEwcHg7XHJcbiAgICAgIGJvcmRlci1sZWZ0OiAzcHggc29saWQgcmdiYSgxMjcsIDE4MCwgMjU1LCAwLjU1KTtcclxuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC43OCk7XHJcbiAgICB9XHJcblxyXG4gICAgOmhvc3QgOjpuZy1kZWVwIC5tZC1tZXNzYWdlIGNvZGUge1xyXG4gICAgICBwYWRkaW5nOiAxcHggNXB4O1xyXG4gICAgICBib3JkZXItcmFkaXVzOiA1cHg7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMCwgMCwgMCwgMC4yNSk7XHJcbiAgICAgIGNvbG9yOiAjYmZkYmZlO1xyXG4gICAgICBmb250LWZhbWlseTogdWktbW9ub3NwYWNlLCBTRk1vbm8tUmVndWxhciwgTWVubG8sIE1vbmFjbywgQ29uc29sYXMsIFwiTGliZXJhdGlvbiBNb25vXCIsIG1vbm9zcGFjZTtcclxuICAgICAgZm9udC1zaXplOiAxMnB4O1xyXG4gICAgfVxyXG5cclxuICAgIDpob3N0IDo6bmctZGVlcCAubWQtbWVzc2FnZSBwcmUge1xyXG4gICAgICBtYXJnaW46IDhweCAwO1xyXG4gICAgICBwYWRkaW5nOiA5cHg7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDhweDtcclxuICAgICAgb3ZlcmZsb3cteDogYXV0bztcclxuICAgICAgYmFja2dyb3VuZDogIzA2MTgyNztcclxuICAgICAgc2Nyb2xsYmFyLXdpZHRoOiBub25lO1xyXG4gICAgICAtbXMtb3ZlcmZsb3ctc3R5bGU6IG5vbmU7XHJcbiAgICB9XHJcblxyXG4gICAgOmhvc3QgOjpuZy1kZWVwIC5tZC1tZXNzYWdlIHByZTo6LXdlYmtpdC1zY3JvbGxiYXIge1xyXG4gICAgICBkaXNwbGF5OiBub25lO1xyXG4gICAgfVxyXG5cclxuICAgIDpob3N0IDo6bmctZGVlcCAubWQtbWVzc2FnZSBwcmUgY29kZSB7XHJcbiAgICAgIHBhZGRpbmc6IDA7XHJcbiAgICAgIGJhY2tncm91bmQ6IHRyYW5zcGFyZW50O1xyXG4gICAgICBjb2xvcjogI2RiZWFmZTtcclxuICAgICAgd2hpdGUtc3BhY2U6IHByZTtcclxuICAgIH1cclxuXHJcbiAgICAuaW1hZ2UtbWVzc2FnZSB7XHJcbiAgICAgIGxpbmUtaGVpZ2h0OiAwO1xyXG4gICAgfVxyXG5cclxuICAgIC5tZWRpYS13cmFwcGVyIHtcclxuICAgICAgcG9zaXRpb246IHJlbGF0aXZlO1xyXG4gICAgICBkaXNwbGF5OiBpbmxpbmUtYmxvY2s7XHJcbiAgICAgIGxpbmUtaGVpZ2h0OiAwO1xyXG4gICAgICB3aWR0aDogdmFyKC0tYXR0YWNobWVudC10aHVtYi1zaXplKTtcclxuICAgICAgaGVpZ2h0OiB2YXIoLS1hdHRhY2htZW50LXRodW1iLXNpemUpO1xyXG4gICAgICBvdmVyZmxvdzogaGlkZGVuO1xyXG4gICAgICBib3JkZXItcmFkaXVzOiAxMHB4O1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMDgpO1xyXG4gICAgfVxyXG5cclxuICAgIC5tZWRpYS1pbWcge1xyXG4gICAgICB3aWR0aDogMTAwJTtcclxuICAgICAgaGVpZ2h0OiAxMDAlO1xyXG4gICAgICBib3JkZXItcmFkaXVzOiBpbmhlcml0O1xyXG4gICAgICBkaXNwbGF5OiBibG9jaztcclxuICAgICAgY3Vyc29yOiB6b29tLWluO1xyXG4gICAgICBvYmplY3QtZml0OiBjb3ZlcjtcclxuICAgIH1cclxuXHJcbiAgICAuYXR0YWNobWVudC1hY3Rpb25zIHtcclxuICAgICAgcG9zaXRpb246IGFic29sdXRlO1xyXG4gICAgICByaWdodDogNnB4O1xyXG4gICAgICB0b3A6IDZweDtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgZ2FwOiA0cHg7XHJcbiAgICAgIG9wYWNpdHk6IDA7XHJcbiAgICAgIHRyYW5zaXRpb246IG9wYWNpdHkgMC4xMnMgZWFzZTtcclxuICAgICAgcG9pbnRlci1ldmVudHM6IG5vbmU7XHJcbiAgICB9XHJcblxyXG4gICAgLm1lZGlhLXdyYXBwZXI6aG92ZXIgLmF0dGFjaG1lbnQtYWN0aW9ucyB7XHJcbiAgICAgIG9wYWNpdHk6IDE7XHJcbiAgICAgIHBvaW50ZXItZXZlbnRzOiBhdXRvO1xyXG4gICAgfVxyXG5cclxuICAgIC5hdHRhY2htZW50LWFjdGlvbi1idG4sXHJcbiAgICAuZmlsZS1kb3dubG9hZC1idG4ge1xyXG4gICAgICBib3JkZXI6IG5vbmU7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDk5OXB4O1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDcsIDI5LCA0OCwgMC44Mik7XHJcbiAgICAgIGNvbG9yOiAjZmZmO1xyXG4gICAgICBkaXNwbGF5OiBpbmxpbmUtZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XHJcbiAgICAgIGN1cnNvcjogcG9pbnRlcjtcclxuICAgICAgcGFkZGluZzogMDtcclxuICAgIH1cclxuXHJcbiAgICAuYXR0YWNobWVudC1hY3Rpb24tYnRuIHtcclxuICAgICAgd2lkdGg6IDI4cHg7XHJcbiAgICAgIGhlaWdodDogMjhweDtcclxuICAgIH1cclxuXHJcbiAgICAuYXR0YWNobWVudC1hY3Rpb24tYnRuIG1hdC1pY29uIHtcclxuICAgICAgZm9udC1zaXplOiAxN3B4O1xyXG4gICAgICB3aWR0aDogMTdweDtcclxuICAgICAgaGVpZ2h0OiAxN3B4O1xyXG4gICAgfVxyXG5cclxuICAgIC5tZWRpYS12aWRlbyB7XHJcbiAgICAgIG1heC13aWR0aDogMjQwcHg7XHJcbiAgICAgIG1heC1oZWlnaHQ6IDI2MHB4O1xyXG4gICAgICBib3JkZXItcmFkaXVzOiAxMHB4O1xyXG4gICAgICBkaXNwbGF5OiBibG9jaztcclxuICAgICAgYmFja2dyb3VuZDogIzAwMDtcclxuICAgIH1cclxuXHJcbiAgICAudmlkZW8tbWVzc2FnZSB7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XHJcbiAgICAgIGdhcDogNnB4O1xyXG4gICAgfVxyXG5cclxuICAgIC52aWRlby1kb3dubG9hZCB7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNzgpO1xyXG4gICAgICBmb250LXNpemU6IDEycHg7XHJcbiAgICAgIHRleHQtZGVjb3JhdGlvbjogdW5kZXJsaW5lO1xyXG4gICAgICB0ZXh0LXVuZGVybGluZS1vZmZzZXQ6IDJweDtcclxuICAgIH1cclxuXHJcbiAgICAubWVkaWEtcGxhY2Vob2xkZXIge1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcclxuICAgICAgZ2FwOiA4cHg7XHJcbiAgICAgIHdpZHRoOiB2YXIoLS1hdHRhY2htZW50LXRodW1iLXNpemUpO1xyXG4gICAgICBoZWlnaHQ6IHZhcigtLWF0dGFjaG1lbnQtdGh1bWItc2l6ZSk7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDEwcHg7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4wOCk7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwyNTUsMjU1LDAuNik7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTFweDtcclxuICAgIH1cclxuXHJcbiAgICAubWVkaWEtbG9hZC1sYWJlbCB7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTFweDtcclxuICAgICAgY29sb3I6IHJnYmEoMjU1LDI1NSwyNTUsMC42KTtcclxuICAgIH1cclxuXHJcbiAgICAuYXR0YWNobWVudHMtbGlzdCB7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XHJcbiAgICAgIGdhcDogOHB4O1xyXG4gICAgICBtYXgtd2lkdGg6IDEwMCU7XHJcbiAgICB9XHJcblxyXG4gICAgLmF0dGFjaG1lbnQtaXRlbSB7XHJcbiAgICAgIG1heC13aWR0aDogMTAwJTtcclxuICAgIH1cclxuXHJcbiAgICAuZmlsZS1tZXNzYWdlIHtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAgZ2FwOiA4cHg7XHJcbiAgICAgIHBhZGRpbmc6IDRweCAwO1xyXG4gICAgfVxyXG5cclxuICAgIC5hdHRhY2htZW50LXRodW1iLmZpbGUtbWVzc2FnZSB7XHJcbiAgICAgIHBvc2l0aW9uOiByZWxhdGl2ZTtcclxuICAgICAgd2lkdGg6IHZhcigtLWF0dGFjaG1lbnQtdGh1bWItc2l6ZSk7XHJcbiAgICAgIGhlaWdodDogdmFyKC0tYXR0YWNobWVudC10aHVtYi1zaXplKTtcclxuICAgICAgcGFkZGluZzogMTJweDtcclxuICAgICAgYm9yZGVyLXJhZGl1czogMTBweDtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjA4KTtcclxuICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcclxuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XHJcbiAgICAgIGJveC1zaXppbmc6IGJvcmRlci1ib3g7XHJcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XHJcbiAgICB9XHJcblxyXG4gICAgLmZpbGUtZG93bmxvYWQge1xyXG4gICAgICBkaXNwbGF5OiBpbmxpbmUtZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAgZ2FwOiA4cHg7XHJcbiAgICAgIGNvbG9yOiAjZmZmO1xyXG4gICAgICB0ZXh0LWRlY29yYXRpb246IG5vbmU7XHJcbiAgICAgIG1heC13aWR0aDogMjQwcHg7XHJcbiAgICB9XHJcblxyXG4gICAgLmZpbGUtbXNnLWljb24ge1xyXG4gICAgICBmb250LXNpemU6IDQycHg7XHJcbiAgICAgIHdpZHRoOiA0MnB4O1xyXG4gICAgICBoZWlnaHQ6IDQycHg7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuOCk7XHJcbiAgICAgIGZsZXgtc2hyaW5rOiAwO1xyXG4gICAgfVxyXG5cclxuICAgIC5maWxlLW1zZy1uYW1lIHtcclxuICAgICAgZm9udC1zaXplOiAxM3B4O1xyXG4gICAgICBjb2xvcjogI2ZmZjtcclxuICAgICAgbGluZS1oZWlnaHQ6IDEuMjtcclxuICAgICAgbWF4LXdpZHRoOiAxMDAlO1xyXG4gICAgICBvdmVyZmxvdzogaGlkZGVuO1xyXG4gICAgICB0ZXh0LWFsaWduOiBjZW50ZXI7XHJcbiAgICAgIHRleHQtb3ZlcmZsb3c6IGVsbGlwc2lzO1xyXG4gICAgICBkaXNwbGF5OiAtd2Via2l0LWJveDtcclxuICAgICAgLXdlYmtpdC1saW5lLWNsYW1wOiAzO1xyXG4gICAgICAtd2Via2l0LWJveC1vcmllbnQ6IHZlcnRpY2FsO1xyXG4gICAgICB3b3JkLWJyZWFrOiBicmVhay13b3JkO1xyXG4gICAgfVxyXG5cclxuICAgIC5maWxlLWRvd25sb2FkLWljb24ge1xyXG4gICAgICBmb250LXNpemU6IDE4cHg7XHJcbiAgICAgIHdpZHRoOiAxOHB4O1xyXG4gICAgICBoZWlnaHQ6IDE4cHg7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNyk7XHJcbiAgICAgIGZsZXgtc2hyaW5rOiAwO1xyXG4gICAgfVxyXG5cclxuICAgIC5maWxlLWRvd25sb2FkLWJ0biB7XHJcbiAgICAgIHdpZHRoOiAyNHB4O1xyXG4gICAgICBoZWlnaHQ6IDI0cHg7XHJcbiAgICAgIGZsZXgtc2hyaW5rOiAwO1xyXG4gICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XHJcbiAgICAgIHJpZ2h0OiA2cHg7XHJcbiAgICAgIHRvcDogNnB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5maWxlLWRvd25sb2FkLWxpbmsge1xyXG4gICAgICBib3JkZXI6IG5vbmU7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDk5OXB4O1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMTYpO1xyXG4gICAgICBjb2xvcjogI2ZmZjtcclxuICAgICAgY3Vyc29yOiBwb2ludGVyO1xyXG4gICAgICBmb250LXNpemU6IDExcHg7XHJcbiAgICAgIHBhZGRpbmc6IDRweCAxMHB4O1xyXG4gICAgICBtYXJnaW4tdG9wOiA0cHg7XHJcbiAgICB9XHJcblxyXG4gICAgLm1lc3NhZ2UtbWV0YSB7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgIGdhcDogNHB4O1xyXG4gICAgICBtYXJnaW4tdG9wOiAzcHg7XHJcbiAgICB9XHJcblxyXG4gICAgLm1zZy10aW1lIHtcclxuICAgICAgZm9udC1zaXplOiAxMHB4O1xyXG4gICAgICBjb2xvcjogcmdiYSgyMTgsIDIyNCwgMjUwLCAwLjY2KTtcclxuICAgIH1cclxuXHJcbiAgICAubWVzc2FnZS1idWJibGUtcm93Lm90aGVyIC5tc2ctdGltZSB7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDIxNiwgMjIzLCAyNDYsIDAuNTgpO1xyXG4gICAgfVxyXG5cclxuICAgIC5lZGl0ZWQtbGFiZWwge1xyXG4gICAgICBmb250LXNpemU6IDEwcHg7XHJcbiAgICAgIGZvbnQtc3R5bGU6IGl0YWxpYztcclxuICAgICAgY29sb3I6IHJnYmEoMjE4LCAyMjQsIDI1MCwgMC42Mik7XHJcbiAgICB9XHJcblxyXG4gICAgLnJlYWQtaWNvbiB7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTRweDtcclxuICAgICAgd2lkdGg6IDE0cHg7XHJcbiAgICAgIGhlaWdodDogMTRweDtcclxuICAgICAgb3BhY2l0eTogMC43O1xyXG4gICAgfVxyXG5cclxuICAgIC5yZWFkLWljb24ucmVhZCB7XHJcbiAgICAgIGNvbG9yOiAjNjBhNWZhO1xyXG4gICAgICBvcGFjaXR5OiAxO1xyXG4gICAgfVxyXG5cclxuICAgIC5yZWFkLWljb24udW5yZWFkIHtcclxuICAgICAgY29sb3I6IHJnYmEoMjE4LCAyMjQsIDI1MCwgMC41KTtcclxuICAgICAgb3BhY2l0eTogMTtcclxuICAgIH1cclxuXHJcbiAgICAucmVwbHktbWVzc2FnZS1idG4ge1xyXG4gICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XHJcbiAgICAgIHJpZ2h0OiAtMTBweDtcclxuICAgICAgYm90dG9tOiAtMTBweDtcclxuICAgICAgd2lkdGg6IDI0cHg7XHJcbiAgICAgIGhlaWdodDogMjRweDtcclxuICAgICAgYm9yZGVyOiAxcHggc29saWQgcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjE2KTtcclxuICAgICAgYm9yZGVyLXJhZGl1czogOTk5cHg7XHJcbiAgICAgIGJhY2tncm91bmQ6ICMwNzFkMzA7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNzgpO1xyXG4gICAgICBkaXNwbGF5OiBpbmxpbmUtZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XHJcbiAgICAgIHBhZGRpbmc6IDA7XHJcbiAgICAgIGN1cnNvcjogcG9pbnRlcjtcclxuICAgICAgb3BhY2l0eTogMDtcclxuICAgICAgdHJhbnNmb3JtOiBzY2FsZSgwLjkyKTtcclxuICAgICAgdHJhbnNpdGlvbjogb3BhY2l0eSAwLjEycywgdHJhbnNmb3JtIDAuMTJzLCBiYWNrZ3JvdW5kIDAuMTJzLCBjb2xvciAwLjEycztcclxuICAgICAgei1pbmRleDogMztcclxuICAgIH1cclxuXHJcbiAgICAubWVzc2FnZS1idWJibGU6aG92ZXIgLnJlcGx5LW1lc3NhZ2UtYnRuLFxyXG4gICAgLnJlcGx5LW1lc3NhZ2UtYnRuOmZvY3VzIHtcclxuICAgICAgb3BhY2l0eTogMTtcclxuICAgICAgdHJhbnNmb3JtOiBzY2FsZSgxKTtcclxuICAgIH1cclxuXHJcbiAgICAucmVwbHktbWVzc2FnZS1idG46aG92ZXIge1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDEyNywgMTgwLCAyNTUsIDAuMjIpO1xyXG4gICAgICBjb2xvcjogI2ZmZjtcclxuICAgIH1cclxuXHJcbiAgICAucmVwbHktbWVzc2FnZS1idG4gbWF0LWljb24ge1xyXG4gICAgICBmb250LXNpemU6IDE1cHg7XHJcbiAgICAgIHdpZHRoOiAxNXB4O1xyXG4gICAgICBoZWlnaHQ6IDE1cHg7XHJcbiAgICAgIGxpbmUtaGVpZ2h0OiAxNXB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5xdWljay1yZWFjdGlvbnMge1xyXG4gICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XHJcbiAgICAgIHRvcDogLTE4cHg7XHJcbiAgICAgIHJpZ2h0OiAwO1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBnYXA6IDRweDtcclxuICAgICAgcGFkZGluZzogM3B4IDVweDtcclxuICAgICAgYmFja2dyb3VuZDogIzA3MWQzMDtcclxuICAgICAgYm9yZGVyOiAxcHggc29saWQgcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjE0KTtcclxuICAgICAgYm9yZGVyLXJhZGl1czogOTk5cHg7XHJcbiAgICAgIGJveC1zaGFkb3c6IDAgNnB4IDE0cHggcmdiYSgwLCAwLCAwLCAwLjI4KTtcclxuICAgICAgei1pbmRleDogNDtcclxuICAgIH1cclxuXHJcbiAgICAvKiBSZWNlaXZlZCBtZXNzYWdlcyBzaXQgb24gdGhlIGxlZnQsIHNvIGdyb3cgdGhlIHBpY2tlciByaWdodHdhcmQuXHJcbiAgICAgICBPd24gbWVzc2FnZXMgc2l0IG9uIHRoZSByaWdodCwgc28gZ3JvdyB0aGUgcGlja2VyIGxlZnR3YXJkLiAqL1xyXG4gICAgLm1lc3NhZ2UtYnViYmxlLXJvdy5vdGhlciAucXVpY2stcmVhY3Rpb25zIHtcclxuICAgICAgbGVmdDogMDtcclxuICAgICAgcmlnaHQ6IGF1dG87XHJcbiAgICB9XHJcblxyXG4gICAgLm1lc3NhZ2UtYnViYmxlLXJvdy5vd24gLnF1aWNrLXJlYWN0aW9ucyB7XHJcbiAgICAgIGxlZnQ6IGF1dG87XHJcbiAgICAgIHJpZ2h0OiAwO1xyXG4gICAgfVxyXG5cclxuICAgIC5xdWljay1lbW9qaS1idG4ge1xyXG4gICAgICB3aWR0aDogMjBweDtcclxuICAgICAgaGVpZ2h0OiAyMHB4O1xyXG4gICAgICBib3JkZXI6IG5vbmU7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDk5OXB4O1xyXG4gICAgICBiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudDtcclxuICAgICAgY29sb3I6ICNmZmY7XHJcbiAgICAgIGRpc3BsYXk6IGlubGluZS1mbGV4O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcclxuICAgICAgZm9udC1zaXplOiAxM3B4O1xyXG4gICAgICBsaW5lLWhlaWdodDogMTtcclxuICAgICAgY3Vyc29yOiBwb2ludGVyO1xyXG4gICAgICBwYWRkaW5nOiAwO1xyXG4gICAgICB0cmFuc2l0aW9uOiB0cmFuc2Zvcm0gMC4xMnMgZWFzZSwgYmFja2dyb3VuZCAwLjEycyBlYXNlO1xyXG4gICAgfVxyXG5cclxuICAgIC5xdWljay1lbW9qaS1idG46aG92ZXIge1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMTgpO1xyXG4gICAgICB0cmFuc2Zvcm06IHNjYWxlKDEuMTQpO1xyXG4gICAgfVxyXG5cclxuICAgIC5yZWFjdGlvbnMtcm93IHtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgZmxleC13cmFwOiB3cmFwO1xyXG4gICAgICBnYXA6IDNweDtcclxuICAgICAgbWFyZ2luLXRvcDogNXB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5yZWFjdGlvbi1jaGlwIHtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsMjU1LDI1NSwwLjA4KTtcclxuICAgICAgYm9yZGVyOiAxcHggc29saWQgcmdiYSgyNTUsMjU1LDI1NSwwLjIpO1xyXG4gICAgICBib3JkZXItcmFkaXVzOiA5OTlweDtcclxuICAgICAgcGFkZGluZzogMnB4IDdweDtcclxuICAgICAgZm9udC1zaXplOiAxMXB4O1xyXG4gICAgICBjb2xvcjogI2YyZjZmZjtcclxuICAgICAgY3Vyc29yOiBwb2ludGVyO1xyXG4gICAgICB0cmFuc2l0aW9uOiBhbGwgMC4ycztcclxuICAgICAgZGlzcGxheTogaW5saW5lLWZsZXg7XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgIGdhcDogM3B4O1xyXG4gICAgICBtYXgtd2lkdGg6IDE4MHB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5yZWFjdGlvbi1jaGlwOmhvdmVyIHtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsMjU1LDI1NSwwLjI1KTtcclxuICAgICAgdHJhbnNmb3JtOiBzY2FsZSgxLjA1KTtcclxuICAgIH1cclxuXHJcbiAgICAucmVhY3Rpb24tY2hpcC5vd24tcmVhY3Rpb24ge1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDQyLDkxLDI1NSwwLjMpO1xyXG4gICAgICBib3JkZXItY29sb3I6IHJnYmEoNDIsOTEsMjU1LDAuNSk7XHJcbiAgICB9XHJcblxyXG4gICAgLmVtcHR5LWNoYXQge1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcclxuICAgICAgZmxleDogMTtcclxuICAgICAgY29sb3I6ICM5Y2EzYWY7XHJcbiAgICB9XHJcblxyXG4gICAgLmVtcHR5LWNoYXQgbWF0LWljb24ge1xyXG4gICAgICBmb250LXNpemU6IDQ4cHg7XHJcbiAgICAgIHdpZHRoOiA0OHB4O1xyXG4gICAgICBoZWlnaHQ6IDQ4cHg7XHJcbiAgICAgIG1hcmdpbi1ib3R0b206IDhweDtcclxuICAgIH1cclxuXHJcbiAgICAuZW1wdHktY2hhdCBwIHtcclxuICAgICAgZm9udC1zaXplOiAxNHB4O1xyXG4gICAgICBtYXJnaW46IDA7XHJcbiAgICB9XHJcblxyXG4gICAgLm1lc3NhZ2UtY29udGV4dC1tZW51IHtcclxuICAgICAgcG9zaXRpb246IGFic29sdXRlO1xyXG4gICAgICB6LWluZGV4OiAxMDAwMDtcclxuICAgICAgbWluLXdpZHRoOiAxNTBweDtcclxuICAgICAgcGFkZGluZzogNnB4O1xyXG4gICAgICBib3JkZXI6IDFweCBzb2xpZCByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMTQpO1xyXG4gICAgICBib3JkZXItcmFkaXVzOiAxMnB4O1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDcsIDE3LCAzMCwgMC45OCk7XHJcbiAgICAgIGJveC1zaGFkb3c6IDAgMThweCA0NXB4IHJnYmEoMCwgMCwgMCwgMC4zOCk7XHJcbiAgICAgIGNvbG9yOiAjZjhmYWZjO1xyXG4gICAgfVxyXG5cclxuICAgIC5jb250ZXh0LW1lbnUtaXRlbSB7XHJcbiAgICAgIHdpZHRoOiAxMDAlO1xyXG4gICAgICBib3JkZXI6IDA7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDlweDtcclxuICAgICAgcGFkZGluZzogOXB4IDEwcHg7XHJcbiAgICAgIGJhY2tncm91bmQ6IHRyYW5zcGFyZW50O1xyXG4gICAgICBjb2xvcjogaW5oZXJpdDtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAgZ2FwOiA5cHg7XHJcbiAgICAgIGN1cnNvcjogcG9pbnRlcjtcclxuICAgICAgZm9udC1zaXplOiAxM3B4O1xyXG4gICAgICB0ZXh0LWFsaWduOiBsZWZ0O1xyXG4gICAgfVxyXG5cclxuICAgIC5jb250ZXh0LW1lbnUtaXRlbTpob3ZlciB7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4wOSk7XHJcbiAgICB9XHJcblxyXG4gICAgLmNvbnRleHQtbWVudS1pdGVtIG1hdC1pY29uIHtcclxuICAgICAgZm9udC1zaXplOiAxN3B4O1xyXG4gICAgICB3aWR0aDogMTdweDtcclxuICAgICAgaGVpZ2h0OiAxN3B4O1xyXG4gICAgfVxyXG5cclxuICAgIC5jb250ZXh0LW1lbnUtaXRlbS5kYW5nZXIge1xyXG4gICAgICBjb2xvcjogI2ZlY2FjYTtcclxuICAgIH1cclxuXHJcbiAgICAuY29udGV4dC1tZW51LWNvbmZpcm0ge1xyXG4gICAgICBwYWRkaW5nOiA4cHg7XHJcbiAgICAgIHdpZHRoOiAxOTBweDtcclxuICAgIH1cclxuXHJcbiAgICAuY29uZmlybS10aXRsZSB7XHJcbiAgICAgIGNvbG9yOiAjZjhmYWZjO1xyXG4gICAgICBmb250LXNpemU6IDEzcHg7XHJcbiAgICAgIGZvbnQtd2VpZ2h0OiA2MDA7XHJcbiAgICAgIG1hcmdpbi1ib3R0b206IDEwcHg7XHJcbiAgICB9XHJcblxyXG4gICAgLmNvbmZpcm0tYWN0aW9ucyB7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGp1c3RpZnktY29udGVudDogZmxleC1lbmQ7XHJcbiAgICAgIGdhcDogOHB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5jb25maXJtLWNhbmNlbCxcclxuICAgIC5jb25maXJtLWRlbGV0ZSB7XHJcbiAgICAgIGJvcmRlcjogMDtcclxuICAgICAgYm9yZGVyLXJhZGl1czogOHB4O1xyXG4gICAgICBwYWRkaW5nOiA3cHggMTBweDtcclxuICAgICAgY29sb3I6ICNmOGZhZmM7XHJcbiAgICAgIGN1cnNvcjogcG9pbnRlcjtcclxuICAgICAgZm9udC1zaXplOiAxMnB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5jb25maXJtLWNhbmNlbCB7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xMik7XHJcbiAgICB9XHJcblxyXG4gICAgLmNvbmZpcm0tZGVsZXRlIHtcclxuICAgICAgYmFja2dyb3VuZDogI2RjMjYyNjtcclxuICAgIH1cclxuICBgXSxcclxufSlcclxuZXhwb3J0IGNsYXNzIENoYXRUaHJlYWRDb21wb25lbnQgaW1wbGVtZW50cyBPbkluaXQsIE9uRGVzdHJveSwgQWZ0ZXJWaWV3Q2hlY2tlZCB7XHJcbiAgQFZpZXdDaGlsZCgnc2Nyb2xsQ29udGFpbmVyJykgc2Nyb2xsQ29udGFpbmVyITogRWxlbWVudFJlZjtcclxuICBAVmlld0NoaWxkKCd0aHJlYWRSb290JykgdGhyZWFkUm9vdCE6IEVsZW1lbnRSZWY8SFRNTEVsZW1lbnQ+O1xyXG4gIEBWaWV3Q2hpbGRyZW4oJ2lubGluZUVkaXRUZXh0YXJlYScpIGlubGluZUVkaXRUZXh0YXJlYXMhOiBRdWVyeUxpc3Q8RWxlbWVudFJlZjxIVE1MVGV4dEFyZWFFbGVtZW50Pj47XHJcbiAgQFZpZXdDaGlsZChNZXNzYWdlSW5wdXRDb21wb25lbnQpIG1lc3NhZ2VJbnB1dD86IE1lc3NhZ2VJbnB1dENvbXBvbmVudDtcclxuICBAT3V0cHV0KCkgbGlnaHRib3hPcGVuID0gbmV3IEV2ZW50RW1pdHRlcjxzdHJpbmc+KCk7XHJcblxyXG4gIG1lc3NhZ2VzOiBNZXNzYWdlW10gPSBbXTtcclxuICB2aXNpYmxlQ29udGFjdHM6IENvbnRhY3RbXSA9IFtdO1xyXG4gIGNvbnZlcnNhdGlvbk5hbWUgPSAnJztcclxuICBpc0dyb3VwID0gZmFsc2U7XHJcbiAgaXNQcm9qZWN0ID0gZmFsc2U7XHJcbiAgcHJvamVjdERiR2lkOiBzdHJpbmcgfCB1bmRlZmluZWQ7XHJcbiAgcHJvamVjdEdpZDogc3RyaW5nIHwgdW5kZWZpbmVkO1xyXG4gIGlzUmVtb3ZlZEZyb21Hcm91cCA9IGZhbHNlO1xyXG4gIG1lc3NhZ2VUZXh0U2NhbGUgPSAxO1xyXG4gIGNvZGVUZXh0U2NhbGUgPSAxO1xyXG4gIGxvYWRpbmcgPSBmYWxzZTtcclxuICBteUNvbnRhY3RJZDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XHJcbiAgcmVwbHlUb01lc3NhZ2U6IE1lc3NhZ2UgfCBudWxsID0gbnVsbDtcclxuICBlZGl0aW5nTWVzc2FnZTogTWVzc2FnZSB8IG51bGwgPSBudWxsO1xyXG4gIGVkaXRpbmdEcmFmdCA9ICcnO1xyXG4gIG1lbnRpb25PcHRpb25zOiBNZW50aW9uT3B0aW9uW10gPSBbXTtcclxuXHJcbiAgY29udmVyc2F0aW9uSWQ6IHN0cmluZyB8IG51bGwgPSBudWxsO1xyXG4gIHByaXZhdGUgc3ViITogU3Vic2NyaXB0aW9uO1xyXG4gIHByaXZhdGUgc2hvdWxkU2Nyb2xsVG9Cb3R0b20gPSB0cnVlO1xyXG5cclxuICB1cGxvYWRpbmcgPSBmYWxzZTtcclxuICBob3ZlcmVkTWVzc2FnZUlkOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcclxuICBtZXNzYWdlQ29udGV4dE1lbnU6IHsgbWVzc2FnZTogTWVzc2FnZTsgeDogbnVtYmVyOyB5OiBudW1iZXI7IGNvbmZpcm1EZWxldGU6IGJvb2xlYW4gfSB8IG51bGwgPSBudWxsO1xyXG4gIHF1aWNrRW1vamlzID0gWyfinaTvuI8nLCAn8J+RjScsICfwn5iCJywgJ/CfmK4nLCAn8J+YoicsICfwn5SlJ107XHJcbiAgdGhyZWFkRHJhZ092ZXIgPSBmYWxzZTtcclxuICBwcml2YXRlIHRocmVhZERyYWdEZXB0aCA9IDA7XHJcbiAgcHJpdmF0ZSBib3VuZFJlc2V0VGhyZWFkRHJhZyA9IHRoaXMucmVzZXRUaHJlYWREcmFnLmJpbmQodGhpcyk7XHJcblxyXG4gIC8qKiBUcmFja3Mgd2hpY2ggZmlsZSBJRHMgYXJlIGN1cnJlbnRseSBiZWluZyBmZXRjaGVkIHRvIGF2b2lkIGR1cGxpY2F0ZSByZXF1ZXN0cyAqL1xyXG4gIHByaXZhdGUgbWVkaWFMb2FkaW5nID0gbmV3IFNldDxzdHJpbmc+KCk7XHJcbiAgLyoqIFRyYWNrcyBmaWxlIElEcyB3aGVyZSByZXRyaWV2YWwgZmFpbGVkIHNvIFVJIGRvZXNuJ3Qgc3BpbiBmb3JldmVyLiAqL1xyXG4gIHByaXZhdGUgbWVkaWFGYWlsZWQgPSBuZXcgU2V0PHN0cmluZz4oKTtcclxuICBwcml2YXRlIG1lZGlhUXVldWU6IHN0cmluZ1tdID0gW107XHJcbiAgcHJpdmF0ZSBhY3RpdmVNZWRpYVJlcXVlc3RzID0gMDtcclxuICBwcml2YXRlIHJlYWRvbmx5IG1heE1lZGlhUmVxdWVzdHMgPSAyO1xyXG4gIHByaXZhdGUgbGFzdE1lbnRpb25Db252ZXJzYXRpb25JZDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XHJcbiAgcHJpdmF0ZSBsYXN0R3JvdXBNZW1iZXJzaGlwVmVyc2lvbiA9IC0xO1xyXG5cclxuICBjb25zdHJ1Y3RvcihcclxuICAgIHByaXZhdGUgc3RvcmU6IE1lc3NhZ2luZ1N0b3JlU2VydmljZSxcclxuICAgIHByaXZhdGUgYXBpOiBNZXNzYWdpbmdBcGlTZXJ2aWNlLFxyXG4gICAgcHJpdmF0ZSBhdXRoOiBBdXRoU2VydmljZSxcclxuICAgIHByaXZhdGUgZmlsZVNlcnZpY2U6IE1lc3NhZ2luZ0ZpbGVTZXJ2aWNlLFxyXG4gICAgcHJpdmF0ZSBjZHI6IENoYW5nZURldGVjdG9yUmVmLFxyXG4gICAgcHJpdmF0ZSBzYW5pdGl6ZXI6IERvbVNhbml0aXplcixcclxuICApIHt9XHJcblxyXG4gIG5nT25Jbml0KCk6IHZvaWQge1xyXG4gICAgdGhpcy5teUNvbnRhY3RJZCA9IHRoaXMuYXV0aC5jb250YWN0SWQ7XHJcbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdkcm9wJywgdGhpcy5ib3VuZFJlc2V0VGhyZWFkRHJhZywgdHJ1ZSk7XHJcbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdkcmFnZW5kJywgdGhpcy5ib3VuZFJlc2V0VGhyZWFkRHJhZywgdHJ1ZSk7XHJcblxyXG4gICAgdGhpcy5zdWIgPSBjb21iaW5lTGF0ZXN0KFtcclxuICAgICAgdGhpcy5zdG9yZS5hY3RpdmVDb252ZXJzYXRpb25JZCxcclxuICAgICAgdGhpcy5zdG9yZS5tZXNzYWdlc01hcCxcclxuICAgICAgdGhpcy5zdG9yZS5vcGVuQ2hhdHMsXHJcbiAgICAgIHRoaXMuc3RvcmUudmlzaWJsZUNvbnRhY3RzLFxyXG4gICAgICB0aGlzLnN0b3JlLmxvYWRpbmdNZXNzYWdlcyxcclxuICAgICAgdGhpcy5zdG9yZS5yZW1vdmVkR3JvdXBJZHMsXHJcbiAgICAgIHRoaXMuc3RvcmUubWVzc2FnZVRleHRTY2FsZSxcclxuICAgICAgdGhpcy5zdG9yZS5jb2RlVGV4dFNjYWxlLFxyXG4gICAgICB0aGlzLnN0b3JlLmdyb3VwTWVtYmVyc2hpcFZlcnNpb24sXHJcbiAgICBdKS5zdWJzY3JpYmUoKFtjb252SWQsIG1zZ01hcCwgY2hhdHMsIGNvbnRhY3RzLCBsb2FkaW5nLCByZW1vdmVkR3JvdXBJZHMsIG1lc3NhZ2VUZXh0U2NhbGUsIGNvZGVUZXh0U2NhbGUsIGdyb3VwTWVtYmVyc2hpcFZlcnNpb25dKSA9PiB7XHJcbiAgICAgIHRoaXMubG9hZGluZyA9IGxvYWRpbmc7XHJcbiAgICAgIHRoaXMudmlzaWJsZUNvbnRhY3RzID0gY29udGFjdHMgfHwgW107XHJcbiAgICAgIHRoaXMubWVzc2FnZVRleHRTY2FsZSA9IG1lc3NhZ2VUZXh0U2NhbGU7XHJcbiAgICAgIHRoaXMuY29kZVRleHRTY2FsZSA9IGNvZGVUZXh0U2NhbGU7XHJcbiAgICAgIGlmICh0aGlzLmlzR3JvdXAgJiYgdGhpcy5jb252ZXJzYXRpb25JZCAmJiB0aGlzLm1lbnRpb25PcHRpb25zLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAgIHRoaXMucmVmcmVzaE1lbnRpb25PcHRpb25zKCk7XHJcbiAgICAgIH1cclxuICAgICAgaWYgKFxyXG4gICAgICAgIHRoaXMuaXNHcm91cCAmJlxyXG4gICAgICAgIHRoaXMuY29udmVyc2F0aW9uSWQgJiZcclxuICAgICAgICBncm91cE1lbWJlcnNoaXBWZXJzaW9uICE9PSB0aGlzLmxhc3RHcm91cE1lbWJlcnNoaXBWZXJzaW9uXHJcbiAgICAgICkge1xyXG4gICAgICAgIHRoaXMubGFzdEdyb3VwTWVtYmVyc2hpcFZlcnNpb24gPSBncm91cE1lbWJlcnNoaXBWZXJzaW9uO1xyXG4gICAgICAgIHRoaXMucmVmcmVzaE1lbnRpb25PcHRpb25zKHRydWUpO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBpZiAoY29udklkICYmIGNvbnZJZCAhPT0gdGhpcy5jb252ZXJzYXRpb25JZCkge1xyXG4gICAgICAgIHRoaXMuY29udmVyc2F0aW9uSWQgPSBjb252SWQ7XHJcbiAgICAgICAgdGhpcy5yZXNldE1lZGlhUXVldWUoKTtcclxuICAgICAgICB0aGlzLmNsZWFyUmVwbHkoKTtcclxuICAgICAgICB0aGlzLmNsZWFyRWRpdCgpO1xyXG4gICAgICAgIHRoaXMuc2hvdWxkU2Nyb2xsVG9Cb3R0b20gPSB0cnVlO1xyXG4gICAgICAgIGNvbnN0IGNoYXQgPSBjaGF0cy5maW5kKChjKSA9PiBjLmNvbnZlcnNhdGlvbklkID09PSBjb252SWQpO1xyXG4gICAgICAgIHRoaXMuY29udmVyc2F0aW9uTmFtZSA9IGNoYXQ/Lm5hbWUgfHwgJ0NoYXQnO1xyXG4gICAgICAgIHRoaXMuaXNHcm91cCA9IGNoYXQ/LmlzR3JvdXAgfHwgZmFsc2U7XHJcbiAgICAgICAgdGhpcy5pc1Byb2plY3QgPSBjaGF0Py5pc1Byb2plY3QgfHwgZmFsc2U7XHJcbiAgICAgICAgdGhpcy5wcm9qZWN0RGJHaWQgPSBjaGF0Py5kYkdpZDtcclxuICAgICAgICB0aGlzLnByb2plY3RHaWQgPSBjaGF0Py5wcm9qZWN0R2lkO1xyXG4gICAgICAgIHRoaXMucmVmcmVzaE1lbnRpb25PcHRpb25zKHRydWUpO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBpZiAodGhpcy5jb252ZXJzYXRpb25JZCkge1xyXG4gICAgICAgIGNvbnN0IHByZXZMZW4gPSB0aGlzLm1lc3NhZ2VzLmxlbmd0aDtcclxuICAgICAgICB0aGlzLm1lc3NhZ2VzID0gbXNnTWFwLmdldCh0aGlzLmNvbnZlcnNhdGlvbklkKSB8fCBbXTtcclxuICAgICAgICBpZiAodGhpcy5tZXNzYWdlcy5sZW5ndGggPiBwcmV2TGVuKSB7XHJcbiAgICAgICAgICB0aGlzLnNob3VsZFNjcm9sbFRvQm90dG9tID0gdHJ1ZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgLy8gUHJlLXdhcm0gbWVkaWEgY2FjaGUgZm9yIGFueSBpbWFnZS9maWxlIG1lc3NhZ2VzIHZpc2libGVcclxuICAgICAgICB0aGlzLnByZXdhcm1NZWRpYSh0aGlzLm1lc3NhZ2VzKTtcclxuICAgICAgfVxyXG4gICAgICB0aGlzLmlzUmVtb3ZlZEZyb21Hcm91cCA9ICEhdGhpcy5jb252ZXJzYXRpb25JZCAmJiByZW1vdmVkR3JvdXBJZHMuaGFzKFN0cmluZyh0aGlzLmNvbnZlcnNhdGlvbklkKSk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIG5nQWZ0ZXJWaWV3Q2hlY2tlZCgpOiB2b2lkIHtcclxuICAgIGlmICh0aGlzLnNob3VsZFNjcm9sbFRvQm90dG9tKSB7XHJcbiAgICAgIHRoaXMuc2Nyb2xsVG9Cb3R0b20oKTtcclxuICAgICAgdGhpcy5zaG91bGRTY3JvbGxUb0JvdHRvbSA9IGZhbHNlO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgbmdPbkRlc3Ryb3koKTogdm9pZCB7XHJcbiAgICB0aGlzLnN1Yj8udW5zdWJzY3JpYmUoKTtcclxuICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2Ryb3AnLCB0aGlzLmJvdW5kUmVzZXRUaHJlYWREcmFnLCB0cnVlKTtcclxuICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2RyYWdlbmQnLCB0aGlzLmJvdW5kUmVzZXRUaHJlYWREcmFnLCB0cnVlKTtcclxuICB9XHJcblxyXG4gIGdvQmFjaygpOiB2b2lkIHtcclxuICAgIHRoaXMuc3RvcmUuc2V0VmlldygnaW5ib3gnKTtcclxuICB9XHJcblxyXG4gIG9uQ2xlYXJDb252ZXJzYXRpb24oKTogdm9pZCB7XHJcbiAgICBpZiAodGhpcy5jb252ZXJzYXRpb25JZCkge1xyXG4gICAgICB0aGlzLnN0b3JlLmNsZWFyQ29udmVyc2F0aW9uKHRoaXMuY29udmVyc2F0aW9uSWQpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgb25EZWxldGVDb252ZXJzYXRpb24oKTogdm9pZCB7XHJcbiAgICBpZiAodGhpcy5jb252ZXJzYXRpb25JZCkge1xyXG4gICAgICB0aGlzLnN0b3JlLmRlbGV0ZUNvbnZlcnNhdGlvbih0aGlzLmNvbnZlcnNhdGlvbklkKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIG9uR3JvdXBTZXR0aW5ncygpOiB2b2lkIHtcclxuICAgIGlmICh0aGlzLmlzUmVtb3ZlZEZyb21Hcm91cCkgcmV0dXJuO1xyXG4gICAgaWYgKHRoaXMuY29udmVyc2F0aW9uSWQpIHtcclxuICAgICAgdGhpcy5zdG9yZS5vcGVuR3JvdXBTZXR0aW5ncyhcclxuICAgICAgICB0aGlzLmNvbnZlcnNhdGlvbklkLFxyXG4gICAgICAgIHRoaXMuY29udmVyc2F0aW9uTmFtZSxcclxuICAgICAgICB0aGlzLmlzUHJvamVjdCxcclxuICAgICAgICB0aGlzLnByb2plY3REYkdpZCxcclxuICAgICAgICB0aGlzLnByb2plY3RHaWQsXHJcbiAgICAgICk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBzdGFydFJlcGx5KG1lc3NhZ2U6IE1lc3NhZ2UsIGV2ZW50PzogRXZlbnQpOiB2b2lkIHtcclxuICAgIGV2ZW50Py5zdG9wUHJvcGFnYXRpb24oKTtcclxuICAgIGlmICh0aGlzLmlzRGVsZXRlZE1lc3NhZ2UobWVzc2FnZSkgfHwgdGhpcy5pc1N5c3RlbU1lc3NhZ2UobWVzc2FnZSkpIHJldHVybjtcclxuICAgIHRoaXMuY2xlYXJFZGl0KCk7XHJcbiAgICB0aGlzLnJlcGx5VG9NZXNzYWdlID0gbWVzc2FnZTtcclxuICAgIHRoaXMubWVzc2FnZUlucHV0Py5mb2N1cygpO1xyXG4gIH1cclxuXHJcbiAgb3Blbk1lc3NhZ2VDb250ZXh0TWVudShtZXNzYWdlOiBNZXNzYWdlLCBldmVudDogTW91c2VFdmVudCk6IHZvaWQge1xyXG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuICAgIGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xyXG4gICAgaWYgKHRoaXMuaXNEZWxldGVkTWVzc2FnZShtZXNzYWdlKSB8fCB0aGlzLmlzU3lzdGVtTWVzc2FnZShtZXNzYWdlKSkgcmV0dXJuO1xyXG5cclxuICAgIGNvbnN0IGhhc0FjdGlvbnMgPVxyXG4gICAgICB0aGlzLmNhblJlcGx5TWVzc2FnZShtZXNzYWdlKSB8fFxyXG4gICAgICB0aGlzLmNhbkVkaXRNZXNzYWdlKG1lc3NhZ2UpIHx8XHJcbiAgICAgIHRoaXMuY2FuRGVsZXRlTWVzc2FnZShtZXNzYWdlKTtcclxuICAgIGlmICghaGFzQWN0aW9ucykgcmV0dXJuO1xyXG5cclxuICAgIHRoaXMubWVzc2FnZUNvbnRleHRNZW51ID0ge1xyXG4gICAgICBtZXNzYWdlLFxyXG4gICAgICAuLi50aGlzLmdldENvbnRleHRNZW51UG9zaXRpb24oZXZlbnQpLFxyXG4gICAgICBjb25maXJtRGVsZXRlOiBmYWxzZSxcclxuICAgIH07XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGdldENvbnRleHRNZW51UG9zaXRpb24oZXZlbnQ6IE1vdXNlRXZlbnQpOiB7IHg6IG51bWJlcjsgeTogbnVtYmVyIH0ge1xyXG4gICAgY29uc3QgcmVjdCA9IHRoaXMudGhyZWFkUm9vdD8ubmF0aXZlRWxlbWVudD8uZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XHJcbiAgICBpZiAoIXJlY3QpIHtcclxuICAgICAgcmV0dXJuIHtcclxuICAgICAgICB4OiBNYXRoLm1pbihldmVudC5jbGllbnRYLCB3aW5kb3cuaW5uZXJXaWR0aCAtIDIyMCksXHJcbiAgICAgICAgeTogTWF0aC5taW4oZXZlbnQuY2xpZW50WSwgd2luZG93LmlubmVySGVpZ2h0IC0gMTYwKSxcclxuICAgICAgfTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBtZW51V2lkdGggPSAyMTA7XHJcbiAgICBjb25zdCBtZW51SGVpZ2h0ID0gMTcwO1xyXG4gICAgY29uc3QgcGFkZGluZyA9IDg7XHJcbiAgICBjb25zdCByYXdYID0gZXZlbnQuY2xpZW50WCAtIHJlY3QubGVmdDtcclxuICAgIGNvbnN0IHJhd1kgPSBldmVudC5jbGllbnRZIC0gcmVjdC50b3A7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICB4OiBNYXRoLm1heChwYWRkaW5nLCBNYXRoLm1pbihyYXdYLCByZWN0LndpZHRoIC0gbWVudVdpZHRoIC0gcGFkZGluZykpLFxyXG4gICAgICB5OiBNYXRoLm1heChwYWRkaW5nLCBNYXRoLm1pbihyYXdZLCByZWN0LmhlaWdodCAtIG1lbnVIZWlnaHQgLSBwYWRkaW5nKSksXHJcbiAgICB9O1xyXG4gIH1cclxuXHJcbiAgY2xvc2VNZXNzYWdlQ29udGV4dE1lbnUoKTogdm9pZCB7XHJcbiAgICB0aGlzLm1lc3NhZ2VDb250ZXh0TWVudSA9IG51bGw7XHJcbiAgfVxyXG5cclxuICByZXBseUZyb21Db250ZXh0TWVudSgpOiB2b2lkIHtcclxuICAgIGNvbnN0IG1lc3NhZ2UgPSB0aGlzLm1lc3NhZ2VDb250ZXh0TWVudT8ubWVzc2FnZTtcclxuICAgIGlmICghbWVzc2FnZSB8fCAhdGhpcy5jYW5SZXBseU1lc3NhZ2UobWVzc2FnZSkpIHJldHVybjtcclxuICAgIHRoaXMuc3RhcnRSZXBseShtZXNzYWdlKTtcclxuICAgIHRoaXMuY2xvc2VNZXNzYWdlQ29udGV4dE1lbnUoKTtcclxuICB9XHJcblxyXG4gIGVkaXRGcm9tQ29udGV4dE1lbnUoKTogdm9pZCB7XHJcbiAgICBjb25zdCBtZXNzYWdlID0gdGhpcy5tZXNzYWdlQ29udGV4dE1lbnU/Lm1lc3NhZ2U7XHJcbiAgICBpZiAoIW1lc3NhZ2UgfHwgIXRoaXMuY2FuRWRpdE1lc3NhZ2UobWVzc2FnZSkpIHJldHVybjtcclxuICAgIHRoaXMuY2xvc2VNZXNzYWdlQ29udGV4dE1lbnUoKTtcclxuICAgIHRoaXMuc3RhcnRFZGl0TWVzc2FnZShtZXNzYWdlKTtcclxuICB9XHJcblxyXG4gIHJlcXVlc3REZWxldGVGcm9tQ29udGV4dE1lbnUoKTogdm9pZCB7XHJcbiAgICBpZiAoIXRoaXMubWVzc2FnZUNvbnRleHRNZW51IHx8ICF0aGlzLmNhbkRlbGV0ZU1lc3NhZ2UodGhpcy5tZXNzYWdlQ29udGV4dE1lbnUubWVzc2FnZSkpIHJldHVybjtcclxuICAgIHRoaXMubWVzc2FnZUNvbnRleHRNZW51ID0geyAuLi50aGlzLm1lc3NhZ2VDb250ZXh0TWVudSwgY29uZmlybURlbGV0ZTogdHJ1ZSB9O1xyXG4gIH1cclxuXHJcbiAgY29uZmlybURlbGV0ZUZyb21Db250ZXh0TWVudSgpOiB2b2lkIHtcclxuICAgIGNvbnN0IG1lc3NhZ2UgPSB0aGlzLm1lc3NhZ2VDb250ZXh0TWVudT8ubWVzc2FnZTtcclxuICAgIGlmICghbWVzc2FnZSB8fCAhdGhpcy5jYW5EZWxldGVNZXNzYWdlKG1lc3NhZ2UpKSByZXR1cm47XHJcbiAgICB0aGlzLmNsb3NlTWVzc2FnZUNvbnRleHRNZW51KCk7XHJcbiAgICB0aGlzLnN0b3JlLmRlbGV0ZU1lc3NhZ2UobWVzc2FnZS5tZXNzYWdlX2lkKTtcclxuICB9XHJcblxyXG4gIGNsZWFyUmVwbHkoKTogdm9pZCB7XHJcbiAgICB0aGlzLnJlcGx5VG9NZXNzYWdlID0gbnVsbDtcclxuICB9XHJcblxyXG4gIGNsZWFyRWRpdCgpOiB2b2lkIHtcclxuICAgIHRoaXMuZWRpdGluZ01lc3NhZ2UgPSBudWxsO1xyXG4gICAgdGhpcy5lZGl0aW5nRHJhZnQgPSAnJztcclxuICB9XHJcblxyXG4gIGdldFJlcGx5UHJldmlldyhtZXNzYWdlOiBNZXNzYWdlKTogUmVwbHlQcmV2aWV3IHwgbnVsbCB7XHJcbiAgICBjb25zdCByZXBseSA9IG1lc3NhZ2UucmVwbHlfdG87XHJcbiAgICBpZiAoIXJlcGx5KSByZXR1cm4gbnVsbDtcclxuICAgIHJldHVybiB7XHJcbiAgICAgIHNlbmRlck5hbWU6IHJlcGx5LnNlbmRlcl9uYW1lIHx8ICdNZXNzYWdlJyxcclxuICAgICAgY29udGVudDogdGhpcy50cnVuY2F0ZVJlcGx5VGV4dChyZXBseS5jb250ZW50IHx8ICdBdHRhY2htZW50JyksXHJcbiAgICB9O1xyXG4gIH1cclxuXHJcbiAgZ2V0Q29tcG9zZVJlcGx5UHJldmlldyhtZXNzYWdlOiBNZXNzYWdlKTogUmVwbHlQcmV2aWV3IHtcclxuICAgIHJldHVybiB7XHJcbiAgICAgIHNlbmRlck5hbWU6IHRoaXMuZ2V0U2VuZGVyTmFtZShtZXNzYWdlKSxcclxuICAgICAgY29udGVudDogdGhpcy50cnVuY2F0ZVJlcGx5VGV4dCh0aGlzLmdldE1lc3NhZ2VCb2R5KG1lc3NhZ2UpIHx8IHRoaXMuZ2V0QXR0YWNobWVudE5hbWUobWVzc2FnZSkpLFxyXG4gICAgfTtcclxuICB9XHJcblxyXG4gIGdldE1lc3NhZ2VCb2R5KG1lc3NhZ2U6IE1lc3NhZ2UpOiBzdHJpbmcge1xyXG4gICAgaWYgKHRoaXMuaXNEZWxldGVkTWVzc2FnZShtZXNzYWdlKSkgcmV0dXJuICdbVGhpcyBtZXNzYWdlIHdhcyBkZWxldGVkXSc7XHJcbiAgICByZXR1cm4gU3RyaW5nKG1lc3NhZ2UuY29udGVudCB8fCAnJyk7XHJcbiAgfVxyXG5cclxuICBpc0RlbGV0ZWRNZXNzYWdlKG1lc3NhZ2U6IE1lc3NhZ2UpOiBib29sZWFuIHtcclxuICAgIHJldHVybiBCb29sZWFuKG1lc3NhZ2UuaXNfZGVsZXRlZCB8fCBtZXNzYWdlLmRlbGV0ZWRfYXQgfHwgbWVzc2FnZS5jb250ZW50ID09PSAnW2RlbGV0ZWRdJyk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHRydW5jYXRlUmVwbHlUZXh0KHZhbHVlOiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gICAgY29uc3QgdGV4dCA9IFN0cmluZyh2YWx1ZSB8fCAnJykucmVwbGFjZSgvXFxzKy9nLCAnICcpLnRyaW0oKTtcclxuICAgIHJldHVybiB0ZXh0Lmxlbmd0aCA+IDEyMCA/IGAke3RleHQuc2xpY2UoMCwgMTE3KX0uLi5gIDogdGV4dCB8fCAnQXR0YWNobWVudCc7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHJlZnJlc2hNZW50aW9uT3B0aW9ucyhmb3JjZSA9IGZhbHNlKTogdm9pZCB7XHJcbiAgICBpZiAoIXRoaXMuaXNHcm91cCB8fCAhdGhpcy5jb252ZXJzYXRpb25JZCkge1xyXG4gICAgICB0aGlzLm1lbnRpb25PcHRpb25zID0gW107XHJcbiAgICAgIHRoaXMubGFzdE1lbnRpb25Db252ZXJzYXRpb25JZCA9IG51bGw7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBjb252SWQgPSB0aGlzLmNvbnZlcnNhdGlvbklkO1xyXG4gICAgaWYgKCFmb3JjZSAmJiB0aGlzLmxhc3RNZW50aW9uQ29udmVyc2F0aW9uSWQgPT09IGNvbnZJZCAmJiB0aGlzLm1lbnRpb25PcHRpb25zLmxlbmd0aCA+IDApIHJldHVybjtcclxuICAgIHRoaXMubGFzdE1lbnRpb25Db252ZXJzYXRpb25JZCA9IGNvbnZJZDtcclxuXHJcbiAgICB0aGlzLmFwaS5nZXRDb252ZXJzYXRpb25QYXJ0aWNpcGFudHMoY29udklkKS5zdWJzY3JpYmUoe1xyXG4gICAgICBuZXh0OiAobWVtYmVycykgPT4ge1xyXG4gICAgICAgIGNvbnN0IG9wdGlvbnMgPSBtZW1iZXJzXHJcbiAgICAgICAgICAuZmlsdGVyKChtZW1iZXIpID0+IFN0cmluZyhtZW1iZXIuY29udGFjdF9pZCkgIT09IFN0cmluZyh0aGlzLmF1dGguY29udGFjdElkIHx8ICcnKSlcclxuICAgICAgICAgIC5tYXAoKG1lbWJlcikgPT4gdGhpcy5wYXJ0aWNpcGFudFRvTWVudGlvbk9wdGlvbihtZW1iZXIpKVxyXG4gICAgICAgICAgLmZpbHRlcigob3B0aW9uKTogb3B0aW9uIGlzIE1lbnRpb25PcHRpb24gPT4gISFvcHRpb24pO1xyXG4gICAgICAgIHRoaXMubWVudGlvbk9wdGlvbnMgPSBvcHRpb25zLmxlbmd0aCA/IG9wdGlvbnMgOiB0aGlzLmNvbnRhY3RzVG9NZW50aW9uT3B0aW9ucygpO1xyXG4gICAgICAgIHRoaXMuY2RyLm1hcmtGb3JDaGVjaygpO1xyXG4gICAgICB9LFxyXG4gICAgICBlcnJvcjogKCkgPT4ge1xyXG4gICAgICAgIHRoaXMubWVudGlvbk9wdGlvbnMgPSB0aGlzLmNvbnRhY3RzVG9NZW50aW9uT3B0aW9ucygpO1xyXG4gICAgICAgIHRoaXMuY2RyLm1hcmtGb3JDaGVjaygpO1xyXG4gICAgICB9LFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHBhcnRpY2lwYW50VG9NZW50aW9uT3B0aW9uKG1lbWJlcjogQ29udmVyc2F0aW9uUGFydGljaXBhbnQpOiBNZW50aW9uT3B0aW9uIHwgbnVsbCB7XHJcbiAgICBjb25zdCB0b2tlbiA9IHRoaXMudG9NZW50aW9uVG9rZW4obWVtYmVyLnVzZXJuYW1lIHx8IG1lbWJlci5lbWFpbCB8fCBTdHJpbmcobWVtYmVyLmNvbnRhY3RfaWQpKTtcclxuICAgIGlmICghdG9rZW4pIHJldHVybiBudWxsO1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgY29udGFjdElkOiBTdHJpbmcobWVtYmVyLmNvbnRhY3RfaWQpLFxyXG4gICAgICBsYWJlbDogbWVtYmVyLnVzZXJuYW1lIHx8IG1lbWJlci5lbWFpbCB8fCBgQ29udGFjdCAke21lbWJlci5jb250YWN0X2lkfWAsXHJcbiAgICAgIHRva2VuLFxyXG4gICAgfTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgY29udGFjdHNUb01lbnRpb25PcHRpb25zKCk6IE1lbnRpb25PcHRpb25bXSB7XHJcbiAgICByZXR1cm4gdGhpcy52aXNpYmxlQ29udGFjdHNcclxuICAgICAgLmZpbHRlcigoY29udGFjdCkgPT4gU3RyaW5nKGNvbnRhY3QuY29udGFjdF9pZCkgIT09IFN0cmluZyh0aGlzLmF1dGguY29udGFjdElkIHx8ICcnKSlcclxuICAgICAgLm1hcCgoY29udGFjdCkgPT4ge1xyXG4gICAgICAgIGNvbnN0IGxhYmVsID0gZ2V0Q29udGFjdERpc3BsYXlOYW1lKGNvbnRhY3QpO1xyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICBjb250YWN0SWQ6IFN0cmluZyhjb250YWN0LmNvbnRhY3RfaWQpLFxyXG4gICAgICAgICAgbGFiZWwsXHJcbiAgICAgICAgICB0b2tlbjogdGhpcy50b01lbnRpb25Ub2tlbihjb250YWN0LnVzZXJuYW1lIHx8IGNvbnRhY3QuZW1haWw/LnNwbGl0KCdAJylbMF0gfHwgbGFiZWwpLFxyXG4gICAgICAgIH07XHJcbiAgICAgIH0pXHJcbiAgICAgIC5maWx0ZXIoKG9wdGlvbikgPT4gISFvcHRpb24udG9rZW4pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSB0b01lbnRpb25Ub2tlbih2YWx1ZTogc3RyaW5nKTogc3RyaW5nIHtcclxuICAgIHJldHVybiBTdHJpbmcodmFsdWUgfHwgJycpXHJcbiAgICAgIC50cmltKClcclxuICAgICAgLnJlcGxhY2UoL15ALywgJycpXHJcbiAgICAgIC5yZXBsYWNlKC9ALiokLywgJycpXHJcbiAgICAgIC5yZXBsYWNlKC9bXmEtekEtWjAtOS5fLV0vZywgJycpXHJcbiAgICAgIC5zbGljZSgwLCAzMik7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGdldE1lbnRpb25JZHNGcm9tQ29udGVudChjb250ZW50OiBzdHJpbmcpOiBzdHJpbmdbXSB7XHJcbiAgICBpZiAoIXRoaXMuaXNHcm91cCB8fCAhY29udGVudCB8fCAhdGhpcy5tZW50aW9uT3B0aW9ucy5sZW5ndGgpIHJldHVybiBbXTtcclxuICAgIGNvbnN0IG1lbnRpb25lZFRva2VucyA9IG5ldyBTZXQoXHJcbiAgICAgIEFycmF5LmZyb20oY29udGVudC5tYXRjaEFsbCgvKF58W15hLXpBLVowLTkuXy1dKUAoW2EtekEtWjAtOS5fLV0rKS9nKSlcclxuICAgICAgICAubWFwKChtYXRjaCkgPT4gbWF0Y2hbMl0udG9Mb3dlckNhc2UoKSlcclxuICAgICk7XHJcbiAgICByZXR1cm4gdGhpcy5tZW50aW9uT3B0aW9uc1xyXG4gICAgICAuZmlsdGVyKChvcHRpb24pID0+IG1lbnRpb25lZFRva2Vucy5oYXMob3B0aW9uLnRva2VuLnRvTG93ZXJDYXNlKCkpKVxyXG4gICAgICAubWFwKChvcHRpb24pID0+IG9wdGlvbi5jb250YWN0SWQpO1xyXG4gIH1cclxuXHJcbiAgb25TZW5kTWVzc2FnZShwYXlsb2FkOiBNZXNzYWdlVGV4dFBheWxvYWQpOiB2b2lkIHtcclxuICAgIGlmICh0aGlzLmlzUmVtb3ZlZEZyb21Hcm91cCkgcmV0dXJuO1xyXG4gICAgY29uc3QgY29udGVudCA9IHBheWxvYWQudGV4dDtcclxuICAgIGNvbnN0IG1lbnRpb25zID0gdGhpcy5nZXRNZW50aW9uSWRzRnJvbUNvbnRlbnQoY29udGVudCk7XHJcbiAgICB0aGlzLnN0b3JlLnNlbmRNZXNzYWdlKHRoaXMuY29udmVyc2F0aW9uSWQsIGNvbnRlbnQsICdURVhUJywge1xyXG4gICAgICByZXBseVRvOiB0aGlzLnJlcGx5VG9NZXNzYWdlLFxyXG4gICAgICBtZW50aW9ucyxcclxuICAgICAgZm9yY2VQbGFpblRleHQ6IHBheWxvYWQuZm9yY2VQbGFpblRleHQsXHJcbiAgICB9KTtcclxuICAgIHRoaXMuY2xlYXJSZXBseSgpO1xyXG4gICAgdGhpcy5zaG91bGRTY3JvbGxUb0JvdHRvbSA9IHRydWU7XHJcbiAgfVxyXG5cclxuICBvblNlbmRXaXRoRmlsZXMocGF5bG9hZDogTWVzc2FnZVBheWxvYWQpOiB2b2lkIHtcclxuICAgIGlmICh0aGlzLmlzUmVtb3ZlZEZyb21Hcm91cCkgcmV0dXJuO1xyXG4gICAgaWYgKCF0aGlzLmNvbnZlcnNhdGlvbklkIHx8ICF0aGlzLmF1dGguY29udGFjdElkKSByZXR1cm47XHJcbiAgICB0aGlzLnVwbG9hZGluZyA9IHRydWU7XHJcblxyXG4gICAgLy8gU3RlcCAxOiBVcGxvYWQgYWxsIGZpbGVzIGFuZCBvYnRhaW4gcmVhbCBmaWxlX2lkcyBmcm9tIHRoZSBzZXJ2ZXIuXHJcbiAgICAvLyBUZW1wIElEcyBhcmUgTkVWRVIgc2VudCB0byBhbnkgQVBJIOKAlCB3ZSB3YWl0IGZvciByZWFsIElEcyBoZXJlLlxyXG4gICAgdGhpcy5maWxlU2VydmljZS51cGxvYWRGaWxlcyhwYXlsb2FkLmZpbGVzKS5zdWJzY3JpYmUoe1xyXG4gICAgICBuZXh0OiAocmVzcG9uc2VzKSA9PiB7XHJcbiAgICAgICAgY29uc3QgZmlsZUlkcyAgID0gcmVzcG9uc2VzLm1hcCgocikgPT4gci5maWxlX2lkKTtcclxuICAgICAgICBjb25zdCBmaWxlbmFtZXMgPSByZXNwb25zZXMubWFwKChyKSA9PiByLmZpbGVuYW1lKTtcclxuICAgICAgICBjb25zdCBtaW1lVHlwZXMgPSByZXNwb25zZXMubWFwKChyLCBpZHgpID0+IHIubWltZV90eXBlIHx8IHBheWxvYWQuZmlsZXNbaWR4XT8udHlwZSB8fCAnJyk7XHJcblxyXG4gICAgICAgIC8vIEd1YXJkOiBlbnN1cmUgYWxsIElEcyBhcmUgcmVhbCAobm90IHRlbXApXHJcbiAgICAgICAgY29uc3QgaGFzVGVtcCA9IGZpbGVJZHMuc29tZShpZCA9PiBpZD8uc3RhcnRzV2l0aCgndGVtcC0nKSk7XHJcbiAgICAgICAgaWYgKGhhc1RlbXApIHtcclxuICAgICAgICAgIHRoaXMudXBsb2FkaW5nID0gZmFsc2U7XHJcbiAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBTdGVwIDI6IFByZS13YXJtIGltYWdlIGNhY2hlIHNvIHRoZSBvcHRpbWlzdGljIGJ1YmJsZSByZW5kZXJzIGltbWVkaWF0ZWx5LlxyXG4gICAgICAgIHRoaXMuZmlsZVNlcnZpY2UucHJld2FybUNhY2hlKGZpbGVJZHMpO1xyXG5cclxuICAgICAgICAvLyBTdGVwIDM6IFNlbmQgdGhlIG1lc3NhZ2Ugd2l0aCB0aGUgcmVhbCBmaWxlX2lkcy5cclxuICAgICAgICBjb25zdCBtZXNzYWdlVGV4dCA9IHBheWxvYWQudGV4dCB8fCBmaWxlbmFtZXMuam9pbignLCAnKTtcclxuICAgICAgICBjb25zdCBvdXRnb2luZ1RleHQgPSB0aGlzLnN0b3JlLnByZXBhcmVPdXRnb2luZ01lc3NhZ2VDb250ZW50KG1lc3NhZ2VUZXh0LCB0aGlzLnJlcGx5VG9NZXNzYWdlLCBwYXlsb2FkLmZvcmNlUGxhaW5UZXh0KTtcclxuICAgICAgICBjb25zdCByZXBseVRvID0gdGhpcy5yZXBseVRvTWVzc2FnZSA/IHtcclxuICAgICAgICAgIG1lc3NhZ2VfaWQ6IFN0cmluZyh0aGlzLnJlcGx5VG9NZXNzYWdlLm1lc3NhZ2VfaWQgfHwgJycpLFxyXG4gICAgICAgICAgc2VuZGVyX25hbWU6IHRoaXMuZ2V0U2VuZGVyTmFtZSh0aGlzLnJlcGx5VG9NZXNzYWdlKSxcclxuICAgICAgICAgIGNvbnRlbnQ6IHRoaXMudHJ1bmNhdGVSZXBseVRleHQodGhpcy5nZXRNZXNzYWdlQm9keSh0aGlzLnJlcGx5VG9NZXNzYWdlKSB8fCB0aGlzLmdldEF0dGFjaG1lbnROYW1lKHRoaXMucmVwbHlUb01lc3NhZ2UpKSxcclxuICAgICAgICB9IDogdW5kZWZpbmVkO1xyXG4gICAgICAgIGNvbnN0IG1lbnRpb25zID0gdGhpcy5nZXRNZW50aW9uSWRzRnJvbUNvbnRlbnQobWVzc2FnZVRleHQpO1xyXG4gICAgICAgIHRoaXMuZmlsZVNlcnZpY2VcclxuICAgICAgICAgIC5zZW5kTWVzc2FnZVdpdGhBdHRhY2htZW50cyhcclxuICAgICAgICAgICAgdGhpcy5jb252ZXJzYXRpb25JZCEsXHJcbiAgICAgICAgICAgIHRoaXMuYXV0aC5jb250YWN0SWQhLFxyXG4gICAgICAgICAgICBvdXRnb2luZ1RleHQsXHJcbiAgICAgICAgICAgIGZpbGVJZHMsXHJcbiAgICAgICAgICAgIGZpbGVuYW1lcyxcclxuICAgICAgICAgICAgbWltZVR5cGVzXHJcbiAgICAgICAgICApXHJcbiAgICAgICAgICAuc3Vic2NyaWJlKHtcclxuICAgICAgICAgICAgbmV4dDogKHJlczogYW55KSA9PiB7XHJcbiAgICAgICAgICAgICAgdGhpcy51cGxvYWRpbmcgPSBmYWxzZTtcclxuICAgICAgICAgICAgICB0aGlzLnNob3VsZFNjcm9sbFRvQm90dG9tID0gdHJ1ZTtcclxuXHJcbiAgICAgICAgICAgICAgLy8gQWRkIG9wdGltaXN0aWMgbWVzc2FnZSBzbyB0aGUgaW1hZ2UgYXBwZWFycyBpbnN0YW50bHkg4oCUXHJcbiAgICAgICAgICAgICAgLy8gdGhlIFdlYlNvY2tldCBldmVudCBtYXkgYXJyaXZlIGEgbW9tZW50IGxhdGVyIGFuZCBkZWR1cCBpdC5cclxuICAgICAgICAgICAgICBjb25zdCBmaXJzdElkID0gZmlsZUlkc1swXSB8fCAnJztcclxuICAgICAgICAgICAgICBjb25zdCBpc0ltZyA9XHJcbiAgICAgICAgICAgICAgICAobWltZVR5cGVzWzBdIHx8ICcnKS5zdGFydHNXaXRoKCdpbWFnZS8nKSB8fFxyXG4gICAgICAgICAgICAgICAgL1xcLihwbmd8anBlP2d8Z2lmfHdlYnB8Ym1wfHN2Z3xoZWljfGhlaWYpJC9pLnRlc3QoZmlsZW5hbWVzWzBdIHx8ICcnKTtcclxuICAgICAgICAgICAgICBjb25zdCBvcHRpbWlzdGljOiBhbnkgPSB7XHJcbiAgICAgICAgICAgICAgICBtZXNzYWdlX2lkOiByZXM/Lm1lc3NhZ2VfaWQgPyBTdHJpbmcocmVzLm1lc3NhZ2VfaWQpIDogJ3RlbXAtJyArIERhdGUubm93KCksXHJcbiAgICAgICAgICAgICAgICBjb252ZXJzYXRpb25faWQ6IHRoaXMuY29udmVyc2F0aW9uSWQhLFxyXG4gICAgICAgICAgICAgICAgc2VuZGVyX2lkOiB0aGlzLmF1dGguY29udGFjdElkISxcclxuICAgICAgICAgICAgICAgIHNlbmRlcl9uYW1lOiAnWW91JyxcclxuICAgICAgICAgICAgICAgIG1lc3NhZ2VfdHlwZTogaXNJbWcgPyAnSU1BR0UnIDogJ0ZJTEUnLFxyXG4gICAgICAgICAgICAgICAgY29udGVudDogbWVzc2FnZVRleHQsXHJcbiAgICAgICAgICAgICAgICByZXBseV90bzogcmVwbHlUbyxcclxuICAgICAgICAgICAgICAgIG1lbnRpb25zLFxyXG4gICAgICAgICAgICAgICAgcmVuZGVyX2FzX3BsYWluX3RleHQ6IHBheWxvYWQuZm9yY2VQbGFpblRleHQsXHJcbiAgICAgICAgICAgICAgICBtZWRpYV91cmw6IGZpcnN0SWQsXHJcbiAgICAgICAgICAgICAgICBjcmVhdGVkX2F0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXHJcbiAgICAgICAgICAgICAgICBpc19yZWFkOiBmYWxzZSxcclxuICAgICAgICAgICAgICAgIGF0dGFjaG1lbnRzOiBmaWxlSWRzLm1hcCgoaWQsIGlkeCkgPT4gKHtcclxuICAgICAgICAgICAgICAgICAgZmlsZV9pZDogaWQsXHJcbiAgICAgICAgICAgICAgICAgIGZpbGVuYW1lOiBmaWxlbmFtZXNbaWR4XSB8fCBmaWxlbmFtZXNbMF0gfHwgYEF0dGFjaG1lbnQgJHtpZHggKyAxfWAsXHJcbiAgICAgICAgICAgICAgICAgIG1pbWVfdHlwZTogbWltZVR5cGVzW2lkeF0gfHwgdW5kZWZpbmVkLFxyXG4gICAgICAgICAgICAgICAgICBzaXplX2J5dGVzOiBwYXlsb2FkLmZpbGVzW2lkeF0/LnNpemUsXHJcbiAgICAgICAgICAgICAgICAgIHVybDogcmVzcG9uc2VzW2lkeF0/LnVybCxcclxuICAgICAgICAgICAgICAgIH0pKSxcclxuICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICAgIHRoaXMuc3RvcmUuYXBwZW5kT3B0aW1pc3RpY01lc3NhZ2Uob3B0aW1pc3RpYyk7XHJcbiAgICAgICAgICAgICAgdGhpcy5jbGVhclJlcGx5KCk7XHJcbiAgICAgICAgICAgICAgdGhpcy5jZHIubWFya0ZvckNoZWNrKCk7XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIGVycm9yOiAoKSA9PiB7XHJcbiAgICAgICAgICAgICAgdGhpcy51cGxvYWRpbmcgPSBmYWxzZTtcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgIH0pO1xyXG4gICAgICB9LFxyXG4gICAgICBlcnJvcjogKCkgPT4ge1xyXG4gICAgICAgIHRoaXMudXBsb2FkaW5nID0gZmFsc2U7XHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIGxvYWRPbGRlcigpOiB2b2lkIHtcclxuICAgIGlmICh0aGlzLmNvbnZlcnNhdGlvbklkICYmIHRoaXMubWVzc2FnZXMubGVuZ3RoID4gMCkge1xyXG4gICAgICB0aGlzLnN0b3JlLmxvYWRNZXNzYWdlcyh0aGlzLmNvbnZlcnNhdGlvbklkLCB0aGlzLm1lc3NhZ2VzWzBdLm1lc3NhZ2VfaWQpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgb25TY3JvbGwoKTogdm9pZCB7fVxyXG5cclxuICBvblRocmVhZERyYWdFbnRlcihldmVudDogRHJhZ0V2ZW50KTogdm9pZCB7XHJcbiAgICBpZiAodGhpcy5pc1JlbW92ZWRGcm9tR3JvdXApIHJldHVybjtcclxuICAgIGlmICghdGhpcy5kcmFnSGFzRmlsZXMoZXZlbnQpKSByZXR1cm47XHJcbiAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XHJcbiAgICB0aGlzLnRocmVhZERyYWdEZXB0aCsrO1xyXG4gICAgdGhpcy50aHJlYWREcmFnT3ZlciA9IHRydWU7XHJcbiAgfVxyXG5cclxuICBvblRocmVhZERyYWdPdmVyKGV2ZW50OiBEcmFnRXZlbnQpOiB2b2lkIHtcclxuICAgIGlmICh0aGlzLmlzUmVtb3ZlZEZyb21Hcm91cCkgcmV0dXJuO1xyXG4gICAgaWYgKCF0aGlzLmRyYWdIYXNGaWxlcyhldmVudCkpIHJldHVybjtcclxuICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcclxuICAgIGlmIChldmVudC5kYXRhVHJhbnNmZXIpIHtcclxuICAgICAgZXZlbnQuZGF0YVRyYW5zZmVyLmRyb3BFZmZlY3QgPSAnY29weSc7XHJcbiAgICB9XHJcbiAgICB0aGlzLnRocmVhZERyYWdPdmVyID0gdHJ1ZTtcclxuICB9XHJcblxyXG4gIG9uVGhyZWFkRHJhZ0xlYXZlKGV2ZW50OiBEcmFnRXZlbnQpOiB2b2lkIHtcclxuICAgIGlmICghdGhpcy5kcmFnSGFzRmlsZXMoZXZlbnQpKSByZXR1cm47XHJcbiAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XHJcbiAgICB0aGlzLnRocmVhZERyYWdEZXB0aCA9IE1hdGgubWF4KDAsIHRoaXMudGhyZWFkRHJhZ0RlcHRoIC0gMSk7XHJcbiAgICB0aGlzLnRocmVhZERyYWdPdmVyID0gdGhpcy50aHJlYWREcmFnRGVwdGggPiAwO1xyXG4gIH1cclxuXHJcbiAgb25UaHJlYWREcm9wKGV2ZW50OiBEcmFnRXZlbnQpOiB2b2lkIHtcclxuICAgIGlmICh0aGlzLmlzUmVtb3ZlZEZyb21Hcm91cCkgcmV0dXJuO1xyXG4gICAgaWYgKCF0aGlzLmRyYWdIYXNGaWxlcyhldmVudCkpIHJldHVybjtcclxuICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcclxuICAgIHRoaXMucmVzZXRUaHJlYWREcmFnKCk7XHJcbiAgICBjb25zdCBmaWxlcyA9IGV2ZW50LmRhdGFUcmFuc2Zlcj8uZmlsZXMgPyBBcnJheS5mcm9tKGV2ZW50LmRhdGFUcmFuc2Zlci5maWxlcykgOiBbXTtcclxuICAgIHRoaXMubWVzc2FnZUlucHV0Py5hZGRGaWxlcyhmaWxlcyk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHJlc2V0VGhyZWFkRHJhZygpOiB2b2lkIHtcclxuICAgIHRoaXMudGhyZWFkRHJhZ0RlcHRoID0gMDtcclxuICAgIHRoaXMudGhyZWFkRHJhZ092ZXIgPSBmYWxzZTtcclxuICB9XHJcblxyXG4gIGV4aXRSZW1vdmVkR3JvdXAoKTogdm9pZCB7XHJcbiAgICBpZiAodGhpcy5jb252ZXJzYXRpb25JZCkge1xyXG4gICAgICB0aGlzLnN0b3JlLmV4aXRSZW1vdmVkR3JvdXAodGhpcy5jb252ZXJzYXRpb25JZCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGRyYWdIYXNGaWxlcyhldmVudDogRHJhZ0V2ZW50KTogYm9vbGVhbiB7XHJcbiAgICBjb25zdCB0eXBlcyA9IGV2ZW50LmRhdGFUcmFuc2Zlcj8udHlwZXM7XHJcbiAgICBpZiAoIXR5cGVzKSByZXR1cm4gZmFsc2U7XHJcbiAgICByZXR1cm4gQXJyYXkuZnJvbSh0eXBlcykuaW5jbHVkZXMoJ0ZpbGVzJyk7XHJcbiAgfVxyXG5cclxuICBzaG91bGRTaG93RGF0ZVNlcGFyYXRvcihpbmRleDogbnVtYmVyKTogYm9vbGVhbiB7XHJcbiAgICBpZiAoaW5kZXggPT09IDApIHJldHVybiB0cnVlO1xyXG4gICAgY29uc3QgY3VyciA9IG5ldyBEYXRlKHRoaXMubWVzc2FnZXNbaW5kZXhdLmNyZWF0ZWRfYXQpLnRvRGF0ZVN0cmluZygpO1xyXG4gICAgY29uc3QgcHJldiA9IG5ldyBEYXRlKHRoaXMubWVzc2FnZXNbaW5kZXggLSAxXS5jcmVhdGVkX2F0KS50b0RhdGVTdHJpbmcoKTtcclxuICAgIHJldHVybiBjdXJyICE9PSBwcmV2O1xyXG4gIH1cclxuXHJcbiAgc2hvdWxkU2hvd1NlbmRlcihpbmRleDogbnVtYmVyKTogYm9vbGVhbiB7XHJcbiAgICBpZiAoaW5kZXggPT09IDApIHJldHVybiB0cnVlO1xyXG4gICAgcmV0dXJuIHRoaXMubWVzc2FnZXNbaW5kZXhdLnNlbmRlcl9pZCAhPT0gdGhpcy5tZXNzYWdlc1tpbmRleCAtIDFdLnNlbmRlcl9pZDtcclxuICB9XHJcblxyXG4gIGlzT3duTWVzc2FnZShtc2c6IE1lc3NhZ2UpOiBib29sZWFuIHtcclxuICAgIGNvbnN0IGN1cnJlbnRDb250YWN0SWQgPSB0aGlzLmF1dGguY29udGFjdElkIHx8IHRoaXMubXlDb250YWN0SWQ7XHJcbiAgICBpZiAoY3VycmVudENvbnRhY3RJZCAmJiBTdHJpbmcobXNnLnNlbmRlcl9pZCkgPT09IFN0cmluZyhjdXJyZW50Q29udGFjdElkKSkgcmV0dXJuIHRydWU7XHJcbiAgICBpZiAoU3RyaW5nKG1zZy5zZW5kZXJfbmFtZSB8fCAnJykudHJpbSgpLnRvTG93ZXJDYXNlKCkgPT09ICd5b3UnKSByZXR1cm4gdHJ1ZTtcclxuXHJcbiAgICBjb25zdCBjdXJyZW50ID0gdGhpcy5hdXRoLmN1cnJlbnRDb250YWN0O1xyXG4gICAgY29uc3Qgc2VuZGVyVXNlcm5hbWUgPSBTdHJpbmcobXNnLnNlbmRlcl91c2VybmFtZSB8fCAnJykudHJpbSgpLnRvTG93ZXJDYXNlKCk7XHJcbiAgICBjb25zdCBjdXJyZW50VXNlcm5hbWUgPSBTdHJpbmcoY3VycmVudD8udXNlcm5hbWUgfHwgJycpLnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xyXG4gICAgaWYgKHNlbmRlclVzZXJuYW1lICYmIGN1cnJlbnRVc2VybmFtZSAmJiBzZW5kZXJVc2VybmFtZSA9PT0gY3VycmVudFVzZXJuYW1lKSByZXR1cm4gdHJ1ZTtcclxuXHJcbiAgICBjb25zdCBzZW5kZXJOYW1lID0gZ2V0TWVzc2FnZVNlbmRlck5hbWUobXNnKS50cmltKCkudG9Mb3dlckNhc2UoKTtcclxuICAgIGNvbnN0IGN1cnJlbnROYW1lID0gY3VycmVudCA/IGdldENvbnRhY3REaXNwbGF5TmFtZShjdXJyZW50KS50cmltKCkudG9Mb3dlckNhc2UoKSA6ICcnO1xyXG4gICAgcmV0dXJuICEhc2VuZGVyTmFtZSAmJiAhIWN1cnJlbnROYW1lICYmIHNlbmRlck5hbWUgPT09IGN1cnJlbnROYW1lO1xyXG4gIH1cclxuXHJcbiAgY2FuRWRpdE1lc3NhZ2UobXNnOiBNZXNzYWdlKTogYm9vbGVhbiB7XHJcbiAgICByZXR1cm4gKFxyXG4gICAgICB0aGlzLmlzT3duTWVzc2FnZShtc2cpICYmXHJcbiAgICAgICF0aGlzLmlzRGVsZXRlZE1lc3NhZ2UobXNnKSAmJlxyXG4gICAgICBTdHJpbmcobXNnLm1lc3NhZ2VfdHlwZSB8fCAnJykudG9VcHBlckNhc2UoKSA9PT0gJ1RFWFQnICYmXHJcbiAgICAgICFTdHJpbmcobXNnLm1lc3NhZ2VfaWQgfHwgJycpLnN0YXJ0c1dpdGgoJ3RlbXAtJylcclxuICAgICk7XHJcbiAgfVxyXG5cclxuICBjYW5EZWxldGVNZXNzYWdlKG1zZzogTWVzc2FnZSk6IGJvb2xlYW4ge1xyXG4gICAgcmV0dXJuIChcclxuICAgICAgdGhpcy5pc093bk1lc3NhZ2UobXNnKSAmJlxyXG4gICAgICAhdGhpcy5pc0RlbGV0ZWRNZXNzYWdlKG1zZylcclxuICAgICk7XHJcbiAgfVxyXG5cclxuICBjYW5NYW5hZ2VNZXNzYWdlKG1zZzogTWVzc2FnZSk6IGJvb2xlYW4ge1xyXG4gICAgcmV0dXJuIHRoaXMuY2FuRWRpdE1lc3NhZ2UobXNnKSB8fCB0aGlzLmNhbkRlbGV0ZU1lc3NhZ2UobXNnKTtcclxuICB9XHJcblxyXG4gIGNhblJlcGx5TWVzc2FnZShtc2c6IE1lc3NhZ2UpOiBib29sZWFuIHtcclxuICAgIHJldHVybiAhdGhpcy5pc0RlbGV0ZWRNZXNzYWdlKG1zZykgJiYgIXRoaXMuaXNTeXN0ZW1NZXNzYWdlKG1zZyk7XHJcbiAgfVxyXG5cclxuICBpc0VkaXRpbmdNZXNzYWdlKG1zZzogTWVzc2FnZSk6IGJvb2xlYW4ge1xyXG4gICAgcmV0dXJuICEhdGhpcy5lZGl0aW5nTWVzc2FnZSAmJiBTdHJpbmcodGhpcy5lZGl0aW5nTWVzc2FnZS5tZXNzYWdlX2lkKSA9PT0gU3RyaW5nKG1zZy5tZXNzYWdlX2lkKTtcclxuICB9XHJcblxyXG4gIG9uSW5saW5lRWRpdElucHV0KGV2ZW50OiBFdmVudCk6IHZvaWQge1xyXG4gICAgdGhpcy5lZGl0aW5nRHJhZnQgPSAoZXZlbnQudGFyZ2V0IGFzIEhUTUxUZXh0QXJlYUVsZW1lbnQpLnZhbHVlO1xyXG4gIH1cclxuXHJcbiAgb25JbmxpbmVFZGl0S2V5ZG93bihldmVudDogS2V5Ym9hcmRFdmVudCk6IHZvaWQge1xyXG4gICAgaWYgKGV2ZW50LmtleSA9PT0gJ0VzY2FwZScpIHtcclxuICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgdGhpcy5jbGVhckVkaXQoKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICgoZXZlbnQuY3RybEtleSB8fCBldmVudC5tZXRhS2V5KSAmJiBldmVudC5rZXkgPT09ICdFbnRlcicpIHtcclxuICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgdGhpcy5zYXZlSW5saW5lRWRpdChldmVudCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBjYW5TYXZlSW5saW5lRWRpdCgpOiBib29sZWFuIHtcclxuICAgIGNvbnN0IG1lc3NhZ2UgPSB0aGlzLmVkaXRpbmdNZXNzYWdlO1xyXG4gICAgaWYgKCFtZXNzYWdlIHx8ICF0aGlzLmNhbkVkaXRNZXNzYWdlKG1lc3NhZ2UpKSByZXR1cm4gZmFsc2U7XHJcbiAgICBjb25zdCBuZXh0ID0gdGhpcy5lZGl0aW5nRHJhZnQudHJpbSgpO1xyXG4gICAgcmV0dXJuICEhbmV4dCAmJiBuZXh0ICE9PSB0aGlzLmdldE1lc3NhZ2VCb2R5KG1lc3NhZ2UpLnRyaW0oKTtcclxuICB9XHJcblxyXG4gIHNhdmVJbmxpbmVFZGl0KGV2ZW50PzogRXZlbnQpOiB2b2lkIHtcclxuICAgIGV2ZW50Py5zdG9wUHJvcGFnYXRpb24oKTtcclxuICAgIGNvbnN0IG1lc3NhZ2UgPSB0aGlzLmVkaXRpbmdNZXNzYWdlO1xyXG4gICAgaWYgKCFtZXNzYWdlIHx8ICF0aGlzLmNhblNhdmVJbmxpbmVFZGl0KCkpIHJldHVybjtcclxuICAgIHRoaXMuc3RvcmUuZWRpdE1lc3NhZ2UobWVzc2FnZS5tZXNzYWdlX2lkLCB0aGlzLmVkaXRpbmdEcmFmdC50cmltKCkpO1xyXG4gICAgdGhpcy5jbGVhckVkaXQoKTtcclxuICB9XHJcblxyXG4gIGNhbmNlbElubGluZUVkaXQoZXZlbnQ/OiBFdmVudCk6IHZvaWQge1xyXG4gICAgZXZlbnQ/LnN0b3BQcm9wYWdhdGlvbigpO1xyXG4gICAgdGhpcy5jbGVhckVkaXQoKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgc3RhcnRFZGl0TWVzc2FnZShtc2c6IE1lc3NhZ2UpOiB2b2lkIHtcclxuICAgIGlmICghdGhpcy5jYW5FZGl0TWVzc2FnZShtc2cpKSByZXR1cm47XHJcbiAgICB0aGlzLmNsZWFyUmVwbHkoKTtcclxuICAgIHRoaXMuZWRpdGluZ01lc3NhZ2UgPSBtc2c7XHJcbiAgICB0aGlzLmVkaXRpbmdEcmFmdCA9IHRoaXMuZ2V0TWVzc2FnZUJvZHkobXNnKTtcclxuICAgIHNldFRpbWVvdXQoKCkgPT4ge1xyXG4gICAgICBjb25zdCB0ZXh0YXJlYSA9IHRoaXMuaW5saW5lRWRpdFRleHRhcmVhcz8uZmlyc3Q/Lm5hdGl2ZUVsZW1lbnQ7XHJcbiAgICAgIHRleHRhcmVhPy5mb2N1cygpO1xyXG4gICAgICB0ZXh0YXJlYT8uc2VsZWN0KCk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIGlzU3lzdGVtTWVzc2FnZShtc2c6IE1lc3NhZ2UpOiBib29sZWFuIHtcclxuICAgIGNvbnN0IGNvbnRlbnQgPSBTdHJpbmcobXNnLmNvbnRlbnQgfHwgJycpLnRyaW0oKTtcclxuICAgIHJldHVybiBtc2cubWVzc2FnZV90eXBlID09PSAnU1lTVEVNJyB8fFxyXG4gICAgICAvXi4rIGFkZGVkIC4rIHRvIHRoZSBncm91cCQvLnRlc3QoY29udGVudCkgfHxcclxuICAgICAgL14uKyByZW1vdmVkIC4rIGZyb20gdGhlIGdyb3VwJC8udGVzdChjb250ZW50KTtcclxuICB9XHJcblxyXG4gIGlzUHJlZm9ybWF0dGVkVGV4dChtc2c6IE1lc3NhZ2UpOiBib29sZWFuIHtcclxuICAgIHJldHVybiB0aGlzLmlzUHJlZm9ybWF0dGVkQ29udGVudCh0aGlzLmdldE1lc3NhZ2VCb2R5KG1zZykpO1xyXG4gIH1cclxuXHJcbiAgaXNQcmVmb3JtYXR0ZWRDb250ZW50KGNvbnRlbnQ6IHN0cmluZyk6IGJvb2xlYW4ge1xyXG4gICAgcmV0dXJuIGNvbnRlbnQuaW5jbHVkZXMoJ1xcdCcpIHx8IGNvbnRlbnQuaW5jbHVkZXMoJ1xcbicpIHx8IC8gezIsfS8udGVzdChjb250ZW50KTtcclxuICB9XHJcblxyXG4gIGdldE1lc3NhZ2VDYXB0aW9uKG1zZzogTWVzc2FnZSk6IHN0cmluZyB7XHJcbiAgICBjb25zdCBjb250ZW50ID0gdGhpcy5nZXRNZXNzYWdlQm9keShtc2cpLnRyaW0oKTtcclxuICAgIGlmICghY29udGVudCkgcmV0dXJuICcnO1xyXG5cclxuICAgIGNvbnN0IGF0dGFjaG1lbnROYW1lcyA9IHRoaXMuZ2V0UmVuZGVyYWJsZUF0dGFjaG1lbnRzKG1zZylcclxuICAgICAgLm1hcCgoYXR0YWNobWVudCkgPT4gU3RyaW5nKGF0dGFjaG1lbnQuZmlsZW5hbWUgfHwgJycpLnRyaW0oKSlcclxuICAgICAgLmZpbHRlcihCb29sZWFuKTtcclxuICAgIGlmICghYXR0YWNobWVudE5hbWVzLmxlbmd0aCkgcmV0dXJuIGNvbnRlbnQ7XHJcblxyXG4gICAgY29uc3QgbmFtZXNUZXh0ID0gYXR0YWNobWVudE5hbWVzLmpvaW4oJywgJyk7XHJcbiAgICBpZiAoY29udGVudCA9PT0gbmFtZXNUZXh0IHx8IGF0dGFjaG1lbnROYW1lcy5pbmNsdWRlcyhjb250ZW50KSkgcmV0dXJuICcnO1xyXG4gICAgcmV0dXJuIGNvbnRlbnQ7XHJcbiAgfVxyXG5cclxuICBpc0NvZGVUZXh0KG1zZzogTWVzc2FnZSk6IGJvb2xlYW4ge1xyXG4gICAgcmV0dXJuIHRoaXMuaXNDb2RlQ29udGVudCh0aGlzLmdldE1lc3NhZ2VCb2R5KG1zZyksIG1zZyk7XHJcbiAgfVxyXG5cclxuICBpc0NvZGVDb250ZW50KHZhbHVlOiBzdHJpbmcsIG1zZz86IE1lc3NhZ2UpOiBib29sZWFuIHtcclxuICAgIGNvbnN0IGNvbnRlbnQgPSB2YWx1ZS50cmltKCk7XHJcbiAgICBpZiAobXNnPy5yZW5kZXJfYXNfcGxhaW5fdGV4dCkgcmV0dXJuIGZhbHNlO1xyXG4gICAgaWYgKCFjb250ZW50IHx8IChtc2cgPyB0aGlzLmlzVGFibGVUZXh0KG1zZykgOiB0aGlzLmlzVGFibGVDb250ZW50KGNvbnRlbnQpKSkgcmV0dXJuIGZhbHNlO1xyXG4gICAgaWYgKHRoaXMubG9va3NMaWtlTWFya2Rvd24oY29udGVudCkgJiYgIXRoaXMuaXNTaW5nbGVGZW5jZWRDb2RlQmxvY2soY29udGVudCkpIHJldHVybiBmYWxzZTtcclxuICAgIGlmICgvXmBgYFtcXHNcXFNdKmBgYCQvLnRlc3QoY29udGVudCkpIHJldHVybiB0cnVlO1xyXG4gICAgcmV0dXJuIHRoaXMuZGV0ZWN0Q29kZUxhbmd1YWdlKGNvbnRlbnQpICE9PSBudWxsO1xyXG4gIH1cclxuXHJcbiAgaXNNYXJrZG93blRleHQobXNnOiBNZXNzYWdlKTogYm9vbGVhbiB7XHJcbiAgICByZXR1cm4gdGhpcy5pc01hcmtkb3duQ29udGVudCh0aGlzLmdldE1lc3NhZ2VCb2R5KG1zZyksIG1zZyk7XHJcbiAgfVxyXG5cclxuICBpc01hcmtkb3duQ29udGVudCh2YWx1ZTogc3RyaW5nLCBtc2c/OiBNZXNzYWdlKTogYm9vbGVhbiB7XHJcbiAgICBjb25zdCBjb250ZW50ID0gdmFsdWUudHJpbSgpO1xyXG4gICAgaWYgKCFjb250ZW50IHx8IChtc2cgPyB0aGlzLmlzVGFibGVUZXh0KG1zZykgOiB0aGlzLmlzVGFibGVDb250ZW50KGNvbnRlbnQpKSB8fCB0aGlzLmlzU2luZ2xlRmVuY2VkQ29kZUJsb2NrKGNvbnRlbnQpKSByZXR1cm4gZmFsc2U7XHJcbiAgICByZXR1cm4gdGhpcy5sb29rc0xpa2VNYXJrZG93bihjb250ZW50KTtcclxuICB9XHJcblxyXG4gIGdldENvZGVMYW5ndWFnZShtc2c6IE1lc3NhZ2UpOiBzdHJpbmcge1xyXG4gICAgcmV0dXJuIHRoaXMuZ2V0Q29kZUxhbmd1YWdlQ29udGVudCh0aGlzLmdldE1lc3NhZ2VCb2R5KG1zZykpO1xyXG4gIH1cclxuXHJcbiAgZ2V0Q29kZUxhbmd1YWdlQ29udGVudChjb250ZW50OiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gICAgY29uc3QgcGFyc2VkID0gdGhpcy5wYXJzZUNvZGVCbG9jayhjb250ZW50KTtcclxuICAgIHJldHVybiBwYXJzZWQubGFuZ3VhZ2UgfHwgdGhpcy5kZXRlY3RDb2RlTGFuZ3VhZ2UocGFyc2VkLmNvZGUpIHx8ICdjb2RlJztcclxuICB9XHJcblxyXG4gIGdldEhpZ2hsaWdodGVkQ29kZShtc2c6IE1lc3NhZ2UpOiBTYWZlSHRtbCB7XHJcbiAgICByZXR1cm4gdGhpcy5nZXRIaWdobGlnaHRlZENvZGVDb250ZW50KHRoaXMuZ2V0TWVzc2FnZUJvZHkobXNnKSk7XHJcbiAgfVxyXG5cclxuICBnZXRIaWdobGlnaHRlZENvZGVDb250ZW50KGNvbnRlbnQ6IHN0cmluZyk6IFNhZmVIdG1sIHtcclxuICAgIGNvbnN0IHBhcnNlZCA9IHRoaXMucGFyc2VDb2RlQmxvY2soY29udGVudCk7XHJcbiAgICBjb25zdCBsYW5ndWFnZSA9IHBhcnNlZC5sYW5ndWFnZSB8fCB0aGlzLmRldGVjdENvZGVMYW5ndWFnZShwYXJzZWQuY29kZSkgfHwgJ2NvZGUnO1xyXG4gICAgY29uc3QgZXNjYXBlZCA9IHRoaXMuZXNjYXBlSHRtbChwYXJzZWQuY29kZSk7XHJcbiAgICBjb25zdCBoaWdobGlnaHRlZCA9IHRoaXMuaGlnaGxpZ2h0Q29kZShlc2NhcGVkLCBsYW5ndWFnZSk7XHJcbiAgICByZXR1cm4gdGhpcy5zYW5pdGl6ZXIuYnlwYXNzU2VjdXJpdHlUcnVzdEh0bWwoaGlnaGxpZ2h0ZWQpO1xyXG4gIH1cclxuXHJcbiAgZ2V0TWFya2Rvd25IdG1sKG1zZzogTWVzc2FnZSk6IFNhZmVIdG1sIHtcclxuICAgIHJldHVybiB0aGlzLmdldE1hcmtkb3duSHRtbENvbnRlbnQodGhpcy5nZXRNZXNzYWdlQm9keShtc2cpKTtcclxuICB9XHJcblxyXG4gIGdldE1hcmtkb3duSHRtbENvbnRlbnQoY29udGVudDogc3RyaW5nKTogU2FmZUh0bWwge1xyXG4gICAgcmV0dXJuIHRoaXMuc2FuaXRpemVyLmJ5cGFzc1NlY3VyaXR5VHJ1c3RIdG1sKHRoaXMucmVuZGVyTWFya2Rvd24oY29udGVudCkpO1xyXG4gIH1cclxuXHJcbiAgY29weUNvZGUobXNnOiBNZXNzYWdlLCBldmVudDogTW91c2VFdmVudCk6IHZvaWQge1xyXG4gICAgZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XHJcbiAgICBjb25zdCBjb250ZW50ID0gdGhpcy5nZXRNZXNzYWdlQm9keShtc2cpO1xyXG4gICAgY29uc3QgcGFyc2VkID0gdGhpcy5wYXJzZUNvZGVCbG9jayhjb250ZW50KTtcclxuICAgIHRoaXMuY29weVRleHQocGFyc2VkLmNvZGUgfHwgY29udGVudCk7XHJcbiAgfVxyXG5cclxuICBjb3B5TWVzc2FnZVRleHQobXNnOiBNZXNzYWdlLCBldmVudDogTW91c2VFdmVudCk6IHZvaWQge1xyXG4gICAgZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XHJcbiAgICB0aGlzLmNvcHlUZXh0KHRoaXMuZ2V0TWVzc2FnZUJvZHkobXNnKSk7XHJcbiAgfVxyXG5cclxuICBjb3B5VGV4dFZhbHVlKHRleHQ6IHN0cmluZywgZXZlbnQ6IE1vdXNlRXZlbnQpOiB2b2lkIHtcclxuICAgIGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xyXG4gICAgdGhpcy5jb3B5VGV4dCh0ZXh0KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgcGFyc2VDb2RlQmxvY2soY29udGVudDogc3RyaW5nKTogeyBsYW5ndWFnZTogc3RyaW5nOyBjb2RlOiBzdHJpbmcgfSB7XHJcbiAgICBjb25zdCB0cmltbWVkID0gY29udGVudC50cmltKCk7XHJcbiAgICBjb25zdCBtYXRjaCA9IHRyaW1tZWQubWF0Y2goL15gYGAoW2EtekEtWjAtOV8rLV0qKVxccypcXG4/KFtcXHNcXFNdKj8pYGBgJC8pO1xyXG4gICAgaWYgKCFtYXRjaCkgcmV0dXJuIHsgbGFuZ3VhZ2U6ICcnLCBjb2RlOiBjb250ZW50IH07XHJcbiAgICByZXR1cm4geyBsYW5ndWFnZTogKG1hdGNoWzFdIHx8ICcnKS50b0xvd2VyQ2FzZSgpLCBjb2RlOiBtYXRjaFsyXSB8fCAnJyB9O1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBpc1NpbmdsZUZlbmNlZENvZGVCbG9jayhjb250ZW50OiBzdHJpbmcpOiBib29sZWFuIHtcclxuICAgIHJldHVybiAvXmBgYFthLXpBLVowLTlfKy1dKlxccypcXG4/W1xcc1xcU10qP2BgYCQvLnRlc3QoY29udGVudC50cmltKCkpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBsb29rc0xpa2VNYXJrZG93bihjb250ZW50OiBzdHJpbmcpOiBib29sZWFuIHtcclxuICAgIHJldHVybiAvKF4jezEsNn1cXHMpfCheWy0qXVxccyl8KF5cXGQrXFwuXFxzKXwoXj5cXHMpfChcXCpcXCpbXipdK1xcKlxcKil8KGBbXmBdK2ApfChcXFtbXlxcXV0rXFxdXFwoW14pXStcXCkpfCheLS0tJCl8KF4tXFxzXFxbWyB4XVxcXVxccyl8KF5gYGBbYS16QS1aMC05XystXSpcXHMqJCkvbS50ZXN0KGNvbnRlbnQpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBkZXRlY3RDb2RlTGFuZ3VhZ2UoY29kZTogc3RyaW5nKTogc3RyaW5nIHwgbnVsbCB7XHJcbiAgICBjb25zdCB0cmltbWVkID0gY29kZS50cmltKCk7XHJcbiAgICBpZiAoIXRyaW1tZWQuaW5jbHVkZXMoJ1xcbicpICYmIHRyaW1tZWQubGVuZ3RoIDwgNDApIHJldHVybiBudWxsO1xyXG4gICAgaWYgKC9eXFxzKihzZWxlY3R8d2l0aHxpbnNlcnR8dXBkYXRlfGRlbGV0ZXxjcmVhdGV8YWx0ZXJ8ZHJvcClcXGIvaS50ZXN0KHRyaW1tZWQpKSByZXR1cm4gJ3NxbCc7XHJcbiAgICBjb25zdCBqc0RlY2xhcmF0aW9uID0gL1xcYihmdW5jdGlvbnxjb25zdHxsZXR8dmFyKVxccytbQS1aYS16XyRdW1xcdyRdKlxccyooPXw9PnxcXCh8OikvLnRlc3QodHJpbW1lZCk7XHJcbiAgICBjb25zdCBqc1N5bnRheCA9IC8oPT58Y29uc29sZVxcLmxvZ3xpbXBvcnRcXHMrLipmcm9tfGV4cG9ydFxccyt8W3t9O10pLy50ZXN0KHRyaW1tZWQpO1xyXG4gICAgaWYgKGpzRGVjbGFyYXRpb24gfHwganNTeW50YXgpIHJldHVybiAnamF2YXNjcmlwdCc7XHJcbiAgICBpZiAoL1xcYihkZWZ8aW1wb3J0fGZyb218cHJpbnR8Y2xhc3MpXFxiLy50ZXN0KHRyaW1tZWQpICYmIC86XFxzKiR8Xlxcc3s0fS9tLnRlc3QodHJpbW1lZCkpIHJldHVybiAncHl0aG9uJztcclxuICAgIGlmICgvPFxcLz9bYS16XVtcXHNcXFNdKj4vaS50ZXN0KHRyaW1tZWQpKSByZXR1cm4gJ2h0bWwnO1xyXG4gICAgaWYgKC9be307XS8udGVzdCh0cmltbWVkKSAmJiAvWzo9XS8udGVzdCh0cmltbWVkKSkgcmV0dXJuICdjb2RlJztcclxuICAgIHJldHVybiBudWxsO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBoaWdobGlnaHRDb2RlKGVzY2FwZWRDb2RlOiBzdHJpbmcsIGxhbmd1YWdlOiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gICAgY29uc3QgcHJvdGVjdGVkVG9rZW5zOiBzdHJpbmdbXSA9IFtdO1xyXG4gICAgY29uc3QgcHJvdGVjdCA9ICh2YWx1ZTogc3RyaW5nLCByZWdleDogUmVnRXhwLCBjbGFzc05hbWU6IHN0cmluZyk6IHN0cmluZyA9PlxyXG4gICAgICB2YWx1ZS5yZXBsYWNlKHJlZ2V4LCAobWF0Y2gpID0+IHtcclxuICAgICAgICBjb25zdCB0b2tlbiA9IGBfX0NPREVfVE9LRU5fJHtwcm90ZWN0ZWRUb2tlbnMubGVuZ3RofV9fYDtcclxuICAgICAgICBwcm90ZWN0ZWRUb2tlbnMucHVzaChgPHNwYW4gY2xhc3M9XCIke2NsYXNzTmFtZX1cIj4ke21hdGNofTwvc3Bhbj5gKTtcclxuICAgICAgICByZXR1cm4gdG9rZW47XHJcbiAgICAgIH0pO1xyXG5cclxuICAgIGxldCBoaWdobGlnaHRlZCA9IGVzY2FwZWRDb2RlO1xyXG5cclxuICAgIGlmIChsYW5ndWFnZSA9PT0gJ3NxbCcpIHtcclxuICAgICAgaGlnaGxpZ2h0ZWQgPSBwcm90ZWN0KGhpZ2hsaWdodGVkLCAvKC0tLiopJC9nbSwgJ2NvZGUtdG9rZW4tY29tbWVudCcpO1xyXG4gICAgICBoaWdobGlnaHRlZCA9IHByb3RlY3QoaGlnaGxpZ2h0ZWQsIC8oJnF1b3Q7Lio/JnF1b3Q7fCYjMzk7Lio/JiMzOTt8YC4qP2ApL2csICdjb2RlLXRva2VuLXN0cmluZycpO1xyXG4gICAgICBoaWdobGlnaHRlZCA9IGhpZ2hsaWdodGVkLnJlcGxhY2UoL1xcYihTRUxFQ1R8RlJPTXxXSEVSRXxKT0lOfExFRlR8UklHSFR8SU5ORVJ8T1VURVJ8T058R1JPVVAgQll8T1JERVIgQll8SU5TRVJUfElOVE98VkFMVUVTfFVQREFURXxTRVR8REVMRVRFfENSRUFURXxUQUJMRXxBTFRFUnxEUk9QfEFORHxPUnxOVUxMfElTfE5PVHxBU3xMSU1JVClcXGIvZ2ksICc8c3BhbiBjbGFzcz1cImNvZGUtdG9rZW4ta2V5d29yZFwiPiQxPC9zcGFuPicpO1xyXG4gICAgICBoaWdobGlnaHRlZCA9IGhpZ2hsaWdodGVkLnJlcGxhY2UoL1xcYihcXGQrKD86XFwuXFxkKyk/KVxcYi9nLCAnPHNwYW4gY2xhc3M9XCJjb2RlLXRva2VuLW51bWJlclwiPiQxPC9zcGFuPicpO1xyXG4gICAgICByZXR1cm4gdGhpcy5yZXN0b3JlQ29kZVRva2VucyhoaWdobGlnaHRlZCwgcHJvdGVjdGVkVG9rZW5zKTtcclxuICAgIH1cclxuXHJcbiAgICBoaWdobGlnaHRlZCA9IHByb3RlY3QoaGlnaGxpZ2h0ZWQsIC8oXFwvXFwvLip8Iy4qKSQvZ20sICdjb2RlLXRva2VuLWNvbW1lbnQnKTtcclxuICAgIGhpZ2hsaWdodGVkID0gcHJvdGVjdChoaWdobGlnaHRlZCwgLygmcXVvdDsuKj8mcXVvdDt8JiMzOTsuKj8mIzM5O3xgLio/YCkvZywgJ2NvZGUtdG9rZW4tc3RyaW5nJyk7XHJcbiAgICBoaWdobGlnaHRlZCA9IGhpZ2hsaWdodGVkLnJlcGxhY2UoL1xcYihmdW5jdGlvbnxjb25zdHxsZXR8dmFyfHJldHVybnxpZnxlbHNlfGZvcnx3aGlsZXxjbGFzc3xpbXBvcnR8ZnJvbXxleHBvcnR8YXN5bmN8YXdhaXR8ZGVmfHByaW50fHRyeXxjYXRjaHxuZXd8dHJ1ZXxmYWxzZXxudWxsfE5vbmUpXFxiL2csICc8c3BhbiBjbGFzcz1cImNvZGUtdG9rZW4ta2V5d29yZFwiPiQxPC9zcGFuPicpO1xyXG4gICAgaGlnaGxpZ2h0ZWQgPSBoaWdobGlnaHRlZC5yZXBsYWNlKC9cXGIoXFxkKyg/OlxcLlxcZCspPylcXGIvZywgJzxzcGFuIGNsYXNzPVwiY29kZS10b2tlbi1udW1iZXJcIj4kMTwvc3Bhbj4nKTtcclxuICAgIGhpZ2hsaWdodGVkID0gaGlnaGxpZ2h0ZWQucmVwbGFjZSgvXFxiKFthLXpBLVpfJF1bXFx3JF0qKSg/PVxcKCkvZywgJzxzcGFuIGNsYXNzPVwiY29kZS10b2tlbi1mdW5jdGlvblwiPiQxPC9zcGFuPicpO1xyXG4gICAgcmV0dXJuIHRoaXMucmVzdG9yZUNvZGVUb2tlbnMoaGlnaGxpZ2h0ZWQsIHByb3RlY3RlZFRva2Vucyk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHJlc3RvcmVDb2RlVG9rZW5zKHZhbHVlOiBzdHJpbmcsIHByb3RlY3RlZFRva2Vuczogc3RyaW5nW10pOiBzdHJpbmcge1xyXG4gICAgcmV0dXJuIHByb3RlY3RlZFRva2Vucy5yZWR1Y2UoXHJcbiAgICAgIChodG1sLCB0b2tlbiwgaW5kZXgpID0+IGh0bWwucmVwbGFjZShuZXcgUmVnRXhwKGBfX0NPREVfVE9LRU5fJHtpbmRleH1fX2AsICdnJyksIHRva2VuKSxcclxuICAgICAgdmFsdWVcclxuICAgICk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHJlbmRlck1hcmtkb3duKHJhdzogc3RyaW5nKTogc3RyaW5nIHtcclxuICAgIGNvbnN0IGNvZGVCbG9ja3M6IHN0cmluZ1tdID0gW107XHJcbiAgICBjb25zdCB3aXRob3V0Q29kZSA9IHJhdy5yZXBsYWNlKC9gYGAoW2EtekEtWjAtOV8rLV0qKVxccypcXG4/KFtcXHNcXFNdKj8pYGBgL2csIChfbWF0Y2gsIGxhbmcsIGNvZGUpID0+IHtcclxuICAgICAgY29uc3QgbGFuZ3VhZ2UgPSBTdHJpbmcobGFuZyB8fCAnY29kZScpLnRvTG93ZXJDYXNlKCk7XHJcbiAgICAgIGNvbnN0IHRva2VuID0gYF9fTURfQ09ERV8ke2NvZGVCbG9ja3MubGVuZ3RofV9fYDtcclxuICAgICAgY29kZUJsb2Nrcy5wdXNoKFxyXG4gICAgICAgIGA8cHJlPjxjb2RlIGRhdGEtbGFuZ3VhZ2U9XCIke3RoaXMuZXNjYXBlSHRtbChsYW5ndWFnZSl9XCI+JHt0aGlzLmVzY2FwZUh0bWwoU3RyaW5nKGNvZGUgfHwgJycpKX08L2NvZGU+PC9wcmU+YFxyXG4gICAgICApO1xyXG4gICAgICByZXR1cm4gdG9rZW47XHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zdCBsaW5lcyA9IHdpdGhvdXRDb2RlLnNwbGl0KC9cXHI/XFxuLyk7XHJcbiAgICBjb25zdCBodG1sOiBzdHJpbmdbXSA9IFtdO1xyXG4gICAgbGV0IGxpc3RUeXBlOiAndWwnIHwgJ29sJyB8IG51bGwgPSBudWxsO1xyXG5cclxuICAgIGNvbnN0IGNsb3NlTGlzdCA9ICgpID0+IHtcclxuICAgICAgaWYgKGxpc3RUeXBlKSB7XHJcbiAgICAgICAgaHRtbC5wdXNoKGA8LyR7bGlzdFR5cGV9PmApO1xyXG4gICAgICAgIGxpc3RUeXBlID0gbnVsbDtcclxuICAgICAgfVxyXG4gICAgfTtcclxuXHJcbiAgICBmb3IgKGNvbnN0IGxpbmUgb2YgbGluZXMpIHtcclxuICAgICAgY29uc3QgdHJpbW1lZCA9IGxpbmUudHJpbSgpO1xyXG5cclxuICAgICAgaWYgKCF0cmltbWVkKSB7XHJcbiAgICAgICAgY2xvc2VMaXN0KCk7XHJcbiAgICAgICAgY29udGludWU7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGNvbnN0IHRva2VuTWF0Y2ggPSB0cmltbWVkLm1hdGNoKC9eX19NRF9DT0RFXyhcXGQrKV9fJC8pO1xyXG4gICAgICBpZiAodG9rZW5NYXRjaCkge1xyXG4gICAgICAgIGNsb3NlTGlzdCgpO1xyXG4gICAgICAgIGh0bWwucHVzaChjb2RlQmxvY2tzW051bWJlcih0b2tlbk1hdGNoWzFdKV0gfHwgJycpO1xyXG4gICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBjb25zdCBoZWFkaW5nID0gdHJpbW1lZC5tYXRjaCgvXigjezEsM30pXFxzKyguKykkLyk7XHJcbiAgICAgIGlmIChoZWFkaW5nKSB7XHJcbiAgICAgICAgY2xvc2VMaXN0KCk7XHJcbiAgICAgICAgaHRtbC5wdXNoKGA8aCR7aGVhZGluZ1sxXS5sZW5ndGh9PiR7dGhpcy5yZW5kZXJNYXJrZG93bklubGluZShoZWFkaW5nWzJdKX08L2gke2hlYWRpbmdbMV0ubGVuZ3RofT5gKTtcclxuICAgICAgICBjb250aW51ZTtcclxuICAgICAgfVxyXG5cclxuICAgICAgaWYgKC9eLS0tKyQvLnRlc3QodHJpbW1lZCkpIHtcclxuICAgICAgICBjbG9zZUxpc3QoKTtcclxuICAgICAgICBodG1sLnB1c2goJzxocj4nKTtcclxuICAgICAgICBjb250aW51ZTtcclxuICAgICAgfVxyXG5cclxuICAgICAgY29uc3QgdW5vcmRlcmVkID0gdHJpbW1lZC5tYXRjaCgvXlstKl1cXHMrKD86XFxbWyB4XVxcXVxccyspPyguKykkL2kpO1xyXG4gICAgICBpZiAodW5vcmRlcmVkKSB7XHJcbiAgICAgICAgaWYgKGxpc3RUeXBlICE9PSAndWwnKSB7XHJcbiAgICAgICAgICBjbG9zZUxpc3QoKTtcclxuICAgICAgICAgIGh0bWwucHVzaCgnPHVsPicpO1xyXG4gICAgICAgICAgbGlzdFR5cGUgPSAndWwnO1xyXG4gICAgICAgIH1cclxuICAgICAgICBodG1sLnB1c2goYDxsaT4ke3RoaXMucmVuZGVyTWFya2Rvd25JbmxpbmUodW5vcmRlcmVkWzFdKX08L2xpPmApO1xyXG4gICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBjb25zdCBvcmRlcmVkID0gdHJpbW1lZC5tYXRjaCgvXlxcZCtcXC5cXHMrKC4rKSQvKTtcclxuICAgICAgaWYgKG9yZGVyZWQpIHtcclxuICAgICAgICBpZiAobGlzdFR5cGUgIT09ICdvbCcpIHtcclxuICAgICAgICAgIGNsb3NlTGlzdCgpO1xyXG4gICAgICAgICAgaHRtbC5wdXNoKCc8b2w+Jyk7XHJcbiAgICAgICAgICBsaXN0VHlwZSA9ICdvbCc7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGh0bWwucHVzaChgPGxpPiR7dGhpcy5yZW5kZXJNYXJrZG93bklubGluZShvcmRlcmVkWzFdKX08L2xpPmApO1xyXG4gICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBjb25zdCBxdW90ZSA9IHRyaW1tZWQubWF0Y2goL14+XFxzKyguKykkLyk7XHJcbiAgICAgIGlmIChxdW90ZSkge1xyXG4gICAgICAgIGNsb3NlTGlzdCgpO1xyXG4gICAgICAgIGh0bWwucHVzaChgPGJsb2NrcXVvdGU+JHt0aGlzLnJlbmRlck1hcmtkb3duSW5saW5lKHF1b3RlWzFdKX08L2Jsb2NrcXVvdGU+YCk7XHJcbiAgICAgICAgY29udGludWU7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGNsb3NlTGlzdCgpO1xyXG4gICAgICBodG1sLnB1c2goYDxwPiR7dGhpcy5yZW5kZXJNYXJrZG93bklubGluZSh0cmltbWVkKX08L3A+YCk7XHJcbiAgICB9XHJcblxyXG4gICAgY2xvc2VMaXN0KCk7XHJcbiAgICByZXR1cm4gaHRtbC5qb2luKCcnKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgcmVuZGVyTWFya2Rvd25JbmxpbmUodmFsdWU6IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgICBsZXQgaHRtbCA9IHRoaXMuZXNjYXBlSHRtbCh2YWx1ZSk7XHJcbiAgICBodG1sID0gaHRtbC5yZXBsYWNlKC9gKFteYF0rKWAvZywgJzxjb2RlPiQxPC9jb2RlPicpO1xyXG4gICAgaHRtbCA9IGh0bWwucmVwbGFjZSgvXFwqXFwqKFteKl0rKVxcKlxcKi9nLCAnPHN0cm9uZz4kMTwvc3Ryb25nPicpO1xyXG4gICAgaHRtbCA9IGh0bWwucmVwbGFjZSgvXFwqKFteKl0rKVxcKi9nLCAnPGVtPiQxPC9lbT4nKTtcclxuICAgIGh0bWwgPSBodG1sLnJlcGxhY2UoL1xcWyhbXlxcXV0rKVxcXVxcKChodHRwcz86XFwvXFwvW14pXFxzXSspXFwpL2csICc8YSBocmVmPVwiJDJcIiB0YXJnZXQ9XCJfYmxhbmtcIiByZWw9XCJub29wZW5lciBub3JlZmVycmVyXCI+JDE8L2E+Jyk7XHJcbiAgICByZXR1cm4gaHRtbDtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgY29weVRleHQodGV4dDogc3RyaW5nKTogdm9pZCB7XHJcbiAgICBpZiAoIXRleHQpIHJldHVybjtcclxuICAgIGlmIChuYXZpZ2F0b3IuY2xpcGJvYXJkPy53cml0ZVRleHQpIHtcclxuICAgICAgbmF2aWdhdG9yLmNsaXBib2FyZC53cml0ZVRleHQodGV4dCkudGhlbihcclxuICAgICAgICAoKSA9PiB0aGlzLnN0b3JlLnNob3dUb2FzdCgnQ29waWVkIHRvIGNsaXBib2FyZCcsICdzdWNjZXNzJywgMTYwMCksXHJcbiAgICAgICAgKCkgPT4gdGhpcy5mYWxsYmFja0NvcHlUZXh0KHRleHQpXHJcbiAgICAgICk7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIHRoaXMuZmFsbGJhY2tDb3B5VGV4dCh0ZXh0KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgZmFsbGJhY2tDb3B5VGV4dCh0ZXh0OiBzdHJpbmcpOiB2b2lkIHtcclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IHRleHRhcmVhID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgndGV4dGFyZWEnKTtcclxuICAgICAgdGV4dGFyZWEudmFsdWUgPSB0ZXh0O1xyXG4gICAgICB0ZXh0YXJlYS5zdHlsZS5wb3NpdGlvbiA9ICdmaXhlZCc7XHJcbiAgICAgIHRleHRhcmVhLnN0eWxlLmxlZnQgPSAnLTk5OTlweCc7XHJcbiAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQodGV4dGFyZWEpO1xyXG4gICAgICB0ZXh0YXJlYS5zZWxlY3QoKTtcclxuICAgICAgZG9jdW1lbnQuZXhlY0NvbW1hbmQoJ2NvcHknKTtcclxuICAgICAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZCh0ZXh0YXJlYSk7XHJcbiAgICAgIHRoaXMuc3RvcmUuc2hvd1RvYXN0KCdDb3BpZWQgdG8gY2xpcGJvYXJkJywgJ3N1Y2Nlc3MnLCAxNjAwKTtcclxuICAgIH0gY2F0Y2gge1xyXG4gICAgICB0aGlzLnN0b3JlLnNob3dUb2FzdCgnQ291bGQgbm90IGNvcHknLCAnZXJyb3InLCAyMjAwKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHByaXZhdGUgZXNjYXBlSHRtbCh2YWx1ZTogc3RyaW5nKTogc3RyaW5nIHtcclxuICAgIHJldHVybiB2YWx1ZVxyXG4gICAgICAucmVwbGFjZSgvJi9nLCAnJmFtcDsnKVxyXG4gICAgICAucmVwbGFjZSgvPC9nLCAnJmx0OycpXHJcbiAgICAgIC5yZXBsYWNlKC8+L2csICcmZ3Q7JylcclxuICAgICAgLnJlcGxhY2UoL1wiL2csICcmcXVvdDsnKVxyXG4gICAgICAucmVwbGFjZSgvJy9nLCAnJiMzOTsnKTtcclxuICB9XHJcblxyXG4gIGlzVGFibGVUZXh0KG1zZzogTWVzc2FnZSk6IGJvb2xlYW4ge1xyXG4gICAgY29uc3Qgcm93cyA9IHRoaXMuZ2V0VGFibGVSb3dzKG1zZyk7XHJcbiAgICByZXR1cm4gcm93cy5sZW5ndGggPj0gMiAmJiByb3dzLnNvbWUoKHJvdykgPT4gcm93Lmxlbmd0aCA+PSAyKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgaXNUYWJsZUNvbnRlbnQoY29udGVudDogc3RyaW5nKTogYm9vbGVhbiB7XHJcbiAgICBjb25zdCByb3dzID0gdGhpcy5nZXRUYWJsZVJvd3NGcm9tQ29udGVudChjb250ZW50KTtcclxuICAgIHJldHVybiByb3dzLmxlbmd0aCA+PSAyICYmIHJvd3Muc29tZSgocm93KSA9PiByb3cubGVuZ3RoID49IDIpO1xyXG4gIH1cclxuXHJcbiAgZ2V0VGFibGVSb3dzKG1zZzogTWVzc2FnZSk6IHN0cmluZ1tdW10ge1xyXG4gICAgcmV0dXJuIHRoaXMuZ2V0VGFibGVSb3dzRnJvbUNvbnRlbnQodGhpcy5nZXRNZXNzYWdlQm9keShtc2cpKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgZ2V0VGFibGVSb3dzRnJvbUNvbnRlbnQodmFsdWU6IHN0cmluZyk6IHN0cmluZ1tdW10ge1xyXG4gICAgY29uc3QgY29udGVudCA9IHZhbHVlLnRyaW0oKTtcclxuICAgIGlmICghY29udGVudC5pbmNsdWRlcygnXFx0JykpIHJldHVybiBbXTtcclxuXHJcbiAgICBjb25zdCByb3dzID0gY29udGVudFxyXG4gICAgICAuc3BsaXQoL1xccj9cXG4vKVxyXG4gICAgICAubWFwKChsaW5lKSA9PiBsaW5lLnNwbGl0KCdcXHQnKS5tYXAoKGNlbGwpID0+IGNlbGwudHJpbSgpKSlcclxuICAgICAgLmZpbHRlcigocm93KSA9PiByb3cuc29tZSgoY2VsbCkgPT4gY2VsbC5sZW5ndGggPiAwKSk7XHJcblxyXG4gICAgY29uc3QgbWF4Q29sdW1ucyA9IE1hdGgubWF4KDAsIC4uLnJvd3MubWFwKChyb3cpID0+IHJvdy5sZW5ndGgpKTtcclxuICAgIGlmIChtYXhDb2x1bW5zIDwgMikgcmV0dXJuIFtdO1xyXG5cclxuICAgIHJldHVybiByb3dzLm1hcCgocm93KSA9PiBbXHJcbiAgICAgIC4uLnJvdyxcclxuICAgICAgLi4uQXJyYXkuZnJvbSh7IGxlbmd0aDogbWF4Q29sdW1ucyAtIHJvdy5sZW5ndGggfSwgKCkgPT4gJycpLFxyXG4gICAgXSk7XHJcbiAgfVxyXG5cclxuICBpc01lc3NhZ2VSZWFkKG1zZzogTWVzc2FnZSk6IGJvb2xlYW4ge1xyXG4gICAgY29uc3QgdmFsdWUgPSBtc2cuaXNfcmVhZDtcclxuICAgIHJldHVybiB2YWx1ZSA9PT0gdHJ1ZSB8fCB2YWx1ZSA9PT0gJ3RydWUnIHx8IHZhbHVlID09PSAnVHJ1ZScgfHwgdmFsdWUgPT09ICcxJztcclxuICB9XHJcblxyXG4gIGdldFJlYWRUb29sdGlwKG1zZzogTWVzc2FnZSk6IHN0cmluZyB7XHJcbiAgICBpZiAoIXRoaXMuaXNHcm91cCkgcmV0dXJuICdSZWFkJztcclxuXHJcbiAgICBjb25zdCBuYW1lcyA9IHRoaXMuZ2V0UmVhZEJ5TmFtZXMobXNnKTtcclxuICAgIGlmIChuYW1lcy5sZW5ndGggPiAwKSB7XHJcbiAgICAgIHJldHVybiBgUmVhZCBieSAke25hbWVzLmpvaW4oJywgJyl9YDtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gJ1JlYWQnO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBnZXRSZWFkQnlOYW1lcyhtc2c6IE1lc3NhZ2UpOiBzdHJpbmdbXSB7XHJcbiAgICBjb25zdCBhbnlNc2cgPSBtc2cgYXMgYW55O1xyXG4gICAgY29uc3QgcmF3TmFtZXMgPSBbXHJcbiAgICAgIC4uLnRoaXMudG9SZWFkQXJyYXkoYW55TXNnLnJlYWRfYnlfbmFtZXMpLFxyXG4gICAgICAuLi50aGlzLnRvUmVhZEFycmF5KGFueU1zZy5yZWFkQnlOYW1lcyksXHJcbiAgICAgIC4uLnRoaXMudG9SZWFkQXJyYXkoYW55TXNnLnJlYWRlcl9uYW1lcyksXHJcbiAgICAgIC4uLnRoaXMudG9SZWFkQXJyYXkoYW55TXNnLnJlYWRlcnMpLFxyXG4gICAgICAuLi50aGlzLnRvUmVhZEFycmF5KGFueU1zZy5yZWFkX2J5KSxcclxuICAgICAgLi4udGhpcy50b1JlYWRBcnJheShhbnlNc2cucmVhZEJ5KSxcclxuICAgIF07XHJcblxyXG4gICAgY29uc3QgbmFtZXMgPSByYXdOYW1lc1xyXG4gICAgICAubWFwKChlbnRyeSkgPT4gdGhpcy5yZWFkRW50cnlUb05hbWUoZW50cnkpKVxyXG4gICAgICAuZmlsdGVyKChuYW1lKTogbmFtZSBpcyBzdHJpbmcgPT4gISFuYW1lICYmIG5hbWUgIT09ICdZb3UnKTtcclxuXHJcbiAgICByZXR1cm4gQXJyYXkuZnJvbShuZXcgU2V0KG5hbWVzKSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHRvUmVhZEFycmF5KHZhbHVlOiB1bmtub3duKTogdW5rbm93bltdIHtcclxuICAgIGlmICghdmFsdWUpIHJldHVybiBbXTtcclxuICAgIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkgcmV0dXJuIHZhbHVlO1xyXG4gICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcclxuICAgICAgY29uc3QgdHJpbW1lZCA9IHZhbHVlLnRyaW0oKTtcclxuICAgICAgaWYgKCF0cmltbWVkKSByZXR1cm4gW107XHJcbiAgICAgIHRyeSB7XHJcbiAgICAgICAgY29uc3QgcGFyc2VkID0gSlNPTi5wYXJzZSh0cmltbWVkKTtcclxuICAgICAgICByZXR1cm4gQXJyYXkuaXNBcnJheShwYXJzZWQpID8gcGFyc2VkIDogW3BhcnNlZF07XHJcbiAgICAgIH0gY2F0Y2gge1xyXG4gICAgICAgIHJldHVybiB0cmltbWVkLmluY2x1ZGVzKCcsJykgPyB0cmltbWVkLnNwbGl0KCcsJykubWFwKCh2KSA9PiB2LnRyaW0oKSkgOiBbdHJpbW1lZF07XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIHJldHVybiBbdmFsdWVdO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSByZWFkRW50cnlUb05hbWUoZW50cnk6IHVua25vd24pOiBzdHJpbmcgfCBudWxsIHtcclxuICAgIGlmIChlbnRyeSA9PSBudWxsKSByZXR1cm4gbnVsbDtcclxuICAgIGlmICh0eXBlb2YgZW50cnkgPT09ICdzdHJpbmcnIHx8IHR5cGVvZiBlbnRyeSA9PT0gJ251bWJlcicpIHtcclxuICAgICAgY29uc3QgaWRPck5hbWUgPSBTdHJpbmcoZW50cnkpLnRyaW0oKTtcclxuICAgICAgY29uc3QgY29udGFjdCA9IHRoaXMudmlzaWJsZUNvbnRhY3RzLmZpbmQoKGMpID0+IFN0cmluZyhjLmNvbnRhY3RfaWQpID09PSBpZE9yTmFtZSk7XHJcbiAgICAgIHJldHVybiBjb250YWN0ID8gZ2V0Q29udGFjdERpc3BsYXlOYW1lKGNvbnRhY3QpIDogaWRPck5hbWU7XHJcbiAgICB9XHJcbiAgICBpZiAodHlwZW9mIGVudHJ5ID09PSAnb2JqZWN0Jykge1xyXG4gICAgICBjb25zdCBvYmogPSBlbnRyeSBhcyBhbnk7XHJcbiAgICAgIGNvbnN0IGV4cGxpY2l0ID0gb2JqLnVzZXJuYW1lIHx8IG9iai5uYW1lIHx8IG9iai5kaXNwbGF5X25hbWUgfHwgb2JqLmRpc3BsYXlOYW1lIHx8IG9iai5lbWFpbDtcclxuICAgICAgaWYgKGV4cGxpY2l0KSByZXR1cm4gU3RyaW5nKGV4cGxpY2l0KTtcclxuICAgICAgaWYgKG9iai5jb250YWN0X2lkIHx8IG9iai5jb250YWN0SWQpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5yZWFkRW50cnlUb05hbWUob2JqLmNvbnRhY3RfaWQgfHwgb2JqLmNvbnRhY3RJZCk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIHJldHVybiBudWxsO1xyXG4gIH1cclxuXHJcbiAgZ2V0U2VuZGVyTmFtZShtc2c6IE1lc3NhZ2UpOiBzdHJpbmcge1xyXG4gICAgY29uc3QgZnJvbU1lc3NhZ2UgPSBnZXRNZXNzYWdlU2VuZGVyTmFtZShtc2cpO1xyXG4gICAgaWYgKGZyb21NZXNzYWdlICYmIGZyb21NZXNzYWdlICE9PSAnVW5rbm93bicpIHtcclxuICAgICAgcmV0dXJuIGZyb21NZXNzYWdlO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGZyb21Db250YWN0cyA9IHRoaXMudmlzaWJsZUNvbnRhY3RzLmZpbmQoXHJcbiAgICAgIChjKSA9PiBTdHJpbmcoYy5jb250YWN0X2lkKSA9PT0gU3RyaW5nKG1zZy5zZW5kZXJfaWQpXHJcbiAgICApO1xyXG4gICAgaWYgKGZyb21Db250YWN0cykge1xyXG4gICAgICByZXR1cm4gZ2V0Q29udGFjdERpc3BsYXlOYW1lKGZyb21Db250YWN0cyk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKHRoaXMuaXNPd25NZXNzYWdlKG1zZykpIHtcclxuICAgICAgcmV0dXJuICdZb3UnO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBgVXNlciAke21zZy5zZW5kZXJfaWR9YDtcclxuICB9XHJcblxyXG4gIGZvcm1hdFRpbWUoZGF0ZVN0cjogc3RyaW5nKTogc3RyaW5nIHtcclxuICAgIGlmICghZGF0ZVN0cikgcmV0dXJuICcnO1xyXG4gICAgY29uc3QgZCA9IG5ldyBEYXRlKGRhdGVTdHIpO1xyXG4gICAgcmV0dXJuIGQudG9Mb2NhbGVUaW1lU3RyaW5nKCdlbi1HQicsIHsgaG91cjogJzItZGlnaXQnLCBtaW51dGU6ICcyLWRpZ2l0JyB9KTtcclxuICB9XHJcblxyXG4gIGZvcm1hdERhdGUoZGF0ZVN0cjogc3RyaW5nKTogc3RyaW5nIHtcclxuICAgIGNvbnN0IGQgPSBuZXcgRGF0ZShkYXRlU3RyKTtcclxuICAgIGNvbnN0IHRvZGF5ID0gbmV3IERhdGUoKTtcclxuICAgIGNvbnN0IHllc3RlcmRheSA9IG5ldyBEYXRlKHRvZGF5KTtcclxuICAgIHllc3RlcmRheS5zZXREYXRlKHllc3RlcmRheS5nZXREYXRlKCkgLSAxKTtcclxuXHJcbiAgICBpZiAoZC50b0RhdGVTdHJpbmcoKSA9PT0gdG9kYXkudG9EYXRlU3RyaW5nKCkpIHJldHVybiAnVG9kYXknO1xyXG4gICAgaWYgKGQudG9EYXRlU3RyaW5nKCkgPT09IHllc3RlcmRheS50b0RhdGVTdHJpbmcoKSkgcmV0dXJuICdZZXN0ZXJkYXknO1xyXG4gICAgcmV0dXJuIGQudG9Mb2NhbGVEYXRlU3RyaW5nKCdlbi1HQicsIHsgZGF5OiAnbnVtZXJpYycsIG1vbnRoOiAnc2hvcnQnLCB5ZWFyOiAnbnVtZXJpYycgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHNjcm9sbFRvQm90dG9tKCk6IHZvaWQge1xyXG4gICAgdHJ5IHtcclxuICAgICAgY29uc3QgZWwgPSB0aGlzLnNjcm9sbENvbnRhaW5lcj8ubmF0aXZlRWxlbWVudDtcclxuICAgICAgaWYgKGVsKSB7XHJcbiAgICAgICAgZWwuc2Nyb2xsVG9wID0gZWwuc2Nyb2xsSGVpZ2h0O1xyXG4gICAgICB9XHJcbiAgICB9IGNhdGNoIHsgLyogaWdub3JlICovIH1cclxuICB9XHJcblxyXG4gIC8vIOKUgOKUgCBNZWRpYSBoZWxwZXJzIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG5cclxuICBwcml2YXRlIGdldEZpbGVuYW1lTGlrZShtc2c6IE1lc3NhZ2UsIGF0dGFjaG1lbnQ/OiBBdHRhY2htZW50KTogc3RyaW5nIHtcclxuICAgIGNvbnN0IGFueU1zZyA9IG1zZyBhcyBhbnk7XHJcbiAgICByZXR1cm4gU3RyaW5nKFxyXG4gICAgICBhdHRhY2htZW50Py5maWxlbmFtZSB8fFxyXG4gICAgICB0aGlzLmdldFByaW1hcnlBdHRhY2htZW50KG1zZyk/LmZpbGVuYW1lIHx8XHJcbiAgICAgIGFueU1zZz8uZmlsZW5hbWUgfHxcclxuICAgICAgYW55TXNnPy5maWxlX25hbWUgfHxcclxuICAgICAgbXNnLmNvbnRlbnQgfHxcclxuICAgICAgJydcclxuICAgICkudG9Mb3dlckNhc2UoKTtcclxuICB9XHJcblxyXG4gIGdldFJlbmRlcmFibGVBdHRhY2htZW50cyhtc2c6IE1lc3NhZ2UpOiBBdHRhY2htZW50W10ge1xyXG4gICAgY29uc3QgYXR0YWNobWVudHMgPSB0aGlzLmdldEFsbEF0dGFjaG1lbnRzKG1zZyk7XHJcbiAgICBpZiAoYXR0YWNobWVudHMubGVuZ3RoID4gMCkgcmV0dXJuIGF0dGFjaG1lbnRzO1xyXG4gICAgY29uc3QgcHJpbWFyeSA9IHRoaXMuZ2V0UHJpbWFyeUF0dGFjaG1lbnQobXNnKTtcclxuICAgIHJldHVybiBwcmltYXJ5ID8gW3ByaW1hcnldIDogW107XHJcbiAgfVxyXG5cclxuICB0cmFja0J5QXR0YWNobWVudChpbmRleDogbnVtYmVyLCBhdHRhY2htZW50OiBBdHRhY2htZW50KTogc3RyaW5nIHtcclxuICAgIHJldHVybiBhdHRhY2htZW50LmZpbGVfaWQgfHwgYXR0YWNobWVudC51cmwgfHwgYCR7YXR0YWNobWVudC5maWxlbmFtZX0tJHtpbmRleH1gO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBnZXRBbGxBdHRhY2htZW50cyhtc2c6IE1lc3NhZ2UpOiBBdHRhY2htZW50W10ge1xyXG4gICAgY29uc3QgYW55TXNnID0gbXNnIGFzIGFueTtcclxuICAgIGNvbnN0IGF0dGFjaG1lbnRzOiBBdHRhY2htZW50W10gPSBbXTtcclxuICAgIGNvbnN0IGFkZCA9IChhdHRhY2htZW50OiBQYXJ0aWFsPEF0dGFjaG1lbnQ+IHwgc3RyaW5nIHwgbnVsbCB8IHVuZGVmaW5lZCk6IHZvaWQgPT4ge1xyXG4gICAgICBjb25zdCByYXcgPSBhdHRhY2htZW50IGFzIGFueTtcclxuICAgICAgY29uc3QgZmlsZUlkID0gU3RyaW5nKFxyXG4gICAgICAgIHR5cGVvZiBhdHRhY2htZW50ID09PSAnc3RyaW5nJyA/IGF0dGFjaG1lbnQgOlxyXG4gICAgICAgIHJhdz8uZmlsZV9pZCA/P1xyXG4gICAgICAgIHJhdz8uZmlsZUlkID8/XHJcbiAgICAgICAgcmF3Py5pZCA/P1xyXG4gICAgICAgIHJhdz8uYXR0YWNobWVudF9pZCA/P1xyXG4gICAgICAgIHJhdz8uc3RvcmFnZV9maWxlX2lkID8/XHJcbiAgICAgICAgJydcclxuICAgICAgKS50cmltKCk7XHJcbiAgICAgIGlmIChmaWxlSWQuc3RhcnRzV2l0aCgneycpIHx8IGZpbGVJZC5zdGFydHNXaXRoKCdbJykpIHtcclxuICAgICAgICBjb25zdCBpZHMgPSB0aGlzLnRvQXJyYXkoZmlsZUlkKTtcclxuICAgICAgICBjb25zdCBmaWxlbmFtZXMgPSB0aGlzLnRvQXJyYXkocmF3Py5maWxlbmFtZXMgPz8gcmF3Py5maWxlbmFtZSA/PyByYXc/LmZpbGVfbmFtZSk7XHJcbiAgICAgICAgY29uc3QgbWltZVR5cGVzID0gdGhpcy50b0FycmF5KHJhdz8ubWltZV90eXBlcyA/PyByYXc/Lm1pbWVUeXBlcyA/PyByYXc/Lm1pbWVfdHlwZSk7XHJcbiAgICAgICAgaWRzLmZvckVhY2goKGlkLCBpZHgpID0+IHtcclxuICAgICAgICAgIGFkZCh7XHJcbiAgICAgICAgICAgIGZpbGVfaWQ6IGlkLFxyXG4gICAgICAgICAgICBmaWxlbmFtZTogZmlsZW5hbWVzW2lkeF0gfHwgZmlsZW5hbWVzWzBdIHx8IHJhdz8uZmlsZW5hbWUgfHwgcmF3Py5maWxlX25hbWUgfHwgYEF0dGFjaG1lbnQgJHtpZHggKyAxfWAsXHJcbiAgICAgICAgICAgIG1pbWVfdHlwZTogbWltZVR5cGVzW2lkeF0gfHwgcmF3Py5taW1lX3R5cGUgfHwgcmF3Py5taW1lVHlwZSxcclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIHJldHVybjtcclxuICAgICAgfVxyXG4gICAgICBjb25zdCB1cmwgPSBTdHJpbmcocmF3Py51cmwgPz8gcmF3Py5maWxlX3VybCA/PyByYXc/LmRvd25sb2FkX3VybCA/PyAnJykudHJpbSgpO1xyXG4gICAgICBpZiAoIWZpbGVJZCAmJiAhdXJsKSByZXR1cm47XHJcbiAgICAgIGlmIChmaWxlSWQgJiYgYXR0YWNobWVudHMuc29tZSgoYSkgPT4gYS5maWxlX2lkID09PSBmaWxlSWQpKSByZXR1cm47XHJcbiAgICAgIGlmICghZmlsZUlkICYmIHVybCAmJiBhdHRhY2htZW50cy5zb21lKChhKSA9PiBhLnVybCA9PT0gdXJsKSkgcmV0dXJuO1xyXG4gICAgICBhdHRhY2htZW50cy5wdXNoKHtcclxuICAgICAgICBmaWxlX2lkOiBmaWxlSWQsXHJcbiAgICAgICAgZmlsZW5hbWU6IFN0cmluZyhcclxuICAgICAgICAgIHJhdz8uZmlsZW5hbWUgPz9cclxuICAgICAgICAgIHJhdz8uZmlsZV9uYW1lID8/XHJcbiAgICAgICAgICByYXc/Lm5hbWUgPz9cclxuICAgICAgICAgIChtc2cubWVzc2FnZV90eXBlID09PSAnSU1BR0UnID8gJ0ltYWdlJyA6ICdGaWxlJylcclxuICAgICAgICApLFxyXG4gICAgICAgIG1pbWVfdHlwZTogcmF3Py5taW1lX3R5cGUgPz8gcmF3Py5taW1lVHlwZSA/PyAobXNnLm1lc3NhZ2VfdHlwZSA9PT0gJ0lNQUdFJyA/ICdpbWFnZS8qJyA6IHVuZGVmaW5lZCksXHJcbiAgICAgICAgc2l6ZV9ieXRlczogcmF3Py5zaXplX2J5dGVzID8/IHJhdz8uc2l6ZUJ5dGVzLFxyXG4gICAgICAgIHVybDogdXJsIHx8IHVuZGVmaW5lZCxcclxuICAgICAgfSk7XHJcbiAgICB9O1xyXG5cclxuICAgIGlmIChBcnJheS5pc0FycmF5KG1zZy5hdHRhY2htZW50cykpIHtcclxuICAgICAgbXNnLmF0dGFjaG1lbnRzLmZvckVhY2goYWRkKTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBtZWRpYVZhbHVlID0gU3RyaW5nKG1zZy5tZWRpYV91cmwgfHwgJycpLnRyaW0oKTtcclxuICAgIGlmIChtZWRpYVZhbHVlLnN0YXJ0c1dpdGgoJ3snKSB8fCBtZWRpYVZhbHVlLnN0YXJ0c1dpdGgoJ1snKSkge1xyXG4gICAgICB0cnkge1xyXG4gICAgICAgIGNvbnN0IHBhcnNlZCA9IEpTT04ucGFyc2UobWVkaWFWYWx1ZSk7XHJcbiAgICAgICAgY29uc3QgbWVkaWFBdHRhY2htZW50cyA9IEFycmF5LmlzQXJyYXkocGFyc2VkKSA/IHBhcnNlZCA6IHBhcnNlZD8uYXR0YWNobWVudHM7XHJcbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkobWVkaWFBdHRhY2htZW50cykpIHtcclxuICAgICAgICAgIG1lZGlhQXR0YWNobWVudHMuZm9yRWFjaChhZGQpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkocGFyc2VkKSkge1xyXG4gICAgICAgICAgY29uc3QgaWRzID0gdGhpcy50b0FycmF5KHBhcnNlZD8uaWRzID8/IHBhcnNlZD8uZmlsZV9pZHMgPz8gcGFyc2VkPy5hdHRhY2htZW50X2lkcyk7XHJcbiAgICAgICAgICBjb25zdCBmaWxlbmFtZXMgPSB0aGlzLnRvQXJyYXkocGFyc2VkPy5maWxlbmFtZXMpO1xyXG4gICAgICAgICAgY29uc3QgbWltZVR5cGVzID0gdGhpcy50b0FycmF5KHBhcnNlZD8ubWltZV90eXBlcyA/PyBwYXJzZWQ/Lm1pbWVUeXBlcyk7XHJcbiAgICAgICAgICBpZHMuZm9yRWFjaCgoaWQsIGlkeCkgPT4ge1xyXG4gICAgICAgICAgICBhZGQoe1xyXG4gICAgICAgICAgICAgIGZpbGVfaWQ6IGlkLFxyXG4gICAgICAgICAgICAgIGZpbGVuYW1lOiBmaWxlbmFtZXNbaWR4XSB8fCBmaWxlbmFtZXNbMF0gfHwgKG1zZy5tZXNzYWdlX3R5cGUgPT09ICdJTUFHRScgPyBgSW1hZ2UgJHtpZHggKyAxfWAgOiBgQXR0YWNobWVudCAke2lkeCArIDF9YCksXHJcbiAgICAgICAgICAgICAgbWltZV90eXBlOiBtaW1lVHlwZXNbaWR4XSB8fCAobXNnLm1lc3NhZ2VfdHlwZSA9PT0gJ0lNQUdFJyA/ICdpbWFnZS8qJyA6IHVuZGVmaW5lZCksXHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9IGNhdGNoIHtcclxuICAgICAgICAvLyBOb24tSlNPTiBtZWRpYV91cmwgdmFsdWVzIGFyZSBoYW5kbGVkIGJ5IGdldFByaW1hcnlBdHRhY2htZW50KCkuXHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBpZHMgPSB0aGlzLnRvQXJyYXkoYW55TXNnPy5hdHRhY2htZW50X2lkcyA/PyBhbnlNc2c/LmZpbGVfaWRzKTtcclxuICAgIGNvbnN0IGZpbGVuYW1lcyA9IHRoaXMudG9BcnJheShhbnlNc2c/LmZpbGVuYW1lcyk7XHJcbiAgICBjb25zdCBtaW1lVHlwZXMgPSB0aGlzLnRvQXJyYXkoYW55TXNnPy5taW1lX3R5cGVzID8/IGFueU1zZz8ubWltZVR5cGVzKTtcclxuICAgIGlkcy5mb3JFYWNoKChpZCwgaWR4KSA9PiB7XHJcbiAgICAgIGFkZCh7XHJcbiAgICAgICAgZmlsZV9pZDogaWQsXHJcbiAgICAgICAgZmlsZW5hbWU6IGZpbGVuYW1lc1tpZHhdIHx8IGZpbGVuYW1lc1swXSB8fCAobXNnLm1lc3NhZ2VfdHlwZSA9PT0gJ0lNQUdFJyA/IGBJbWFnZSAke2lkeCArIDF9YCA6IGBBdHRhY2htZW50ICR7aWR4ICsgMX1gKSxcclxuICAgICAgICBtaW1lX3R5cGU6IG1pbWVUeXBlc1tpZHhdIHx8IGFueU1zZz8ubWltZV90eXBlIHx8IGFueU1zZz8uYXR0YWNobWVudF9taW1lX3R5cGUgfHwgKG1zZy5tZXNzYWdlX3R5cGUgPT09ICdJTUFHRScgPyAnaW1hZ2UvKicgOiB1bmRlZmluZWQpLFxyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG5cclxuICAgIHJldHVybiBhdHRhY2htZW50cztcclxuICB9XHJcblxyXG4gIHByaXZhdGUgdG9BcnJheSh2YWx1ZTogdW5rbm93bik6IHN0cmluZ1tdIHtcclxuICAgIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkge1xyXG4gICAgICByZXR1cm4gdmFsdWVcclxuICAgICAgICAubWFwKCh4OiBhbnkpID0+ICh0eXBlb2YgeCA9PT0gJ3N0cmluZycgPyB4IDogeD8uZmlsZV9pZCA/PyB4Py5pZCA/PyAnJykpXHJcbiAgICAgICAgLm1hcCgoeCkgPT4gU3RyaW5nKHgpLnRyaW0oKSlcclxuICAgICAgICAuZmlsdGVyKEJvb2xlYW4pO1xyXG4gICAgfVxyXG4gICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycgJiYgdmFsdWUudHJpbSgpKSB7XHJcbiAgICAgIGNvbnN0IHRyaW1tZWQgPSB2YWx1ZS50cmltKCk7XHJcbiAgICAgIGlmICh0cmltbWVkLnN0YXJ0c1dpdGgoJ3snKSB8fCB0cmltbWVkLnN0YXJ0c1dpdGgoJ1snKSkge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICBjb25zdCBwYXJzZWQgPSBKU09OLnBhcnNlKHRyaW1tZWQpO1xyXG4gICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkocGFyc2VkKSkgcmV0dXJuIHRoaXMudG9BcnJheShwYXJzZWQpO1xyXG4gICAgICAgICAgcmV0dXJuIHRoaXMudG9BcnJheShwYXJzZWQ/LmlkcyA/PyBwYXJzZWQ/LmZpbGVfaWRzID8/IHBhcnNlZD8uYXR0YWNobWVudF9pZHMgPz8gcGFyc2VkPy5hdHRhY2htZW50cyk7XHJcbiAgICAgICAgfSBjYXRjaCB7XHJcbiAgICAgICAgICByZXR1cm4gW107XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiB2YWx1ZVxyXG4gICAgICAgIC5zcGxpdCgvWyxcXHNdKy8pXHJcbiAgICAgICAgLm1hcCgoeCkgPT4geC50cmltKCkpXHJcbiAgICAgICAgLmZpbHRlcihCb29sZWFuKTtcclxuICAgIH1cclxuICAgIHJldHVybiBbXTtcclxuICB9XHJcblxyXG4gIC8qKiBSZXR1cm5zIHRoZSBwcmltYXJ5IGF0dGFjaG1lbnQgZm9yIGEgbWVzc2FnZSwgaWYgYW55LiAqL1xyXG4gIHByaXZhdGUgZ2V0UHJpbWFyeUF0dGFjaG1lbnQobXNnOiBNZXNzYWdlKTogQXR0YWNobWVudCB8IG51bGwge1xyXG4gICAgY29uc3QgYXR0YWNobWVudHMgPSB0aGlzLmdldEFsbEF0dGFjaG1lbnRzKG1zZyk7XHJcbiAgICBpZiAoYXR0YWNobWVudHMubGVuZ3RoID4gMCkgcmV0dXJuIGF0dGFjaG1lbnRzWzBdO1xyXG5cclxuICAgIC8vIFNvbWUgQVBJIHJlc3BvbnNlcyBwcm92aWRlIGZpbGUgbWV0YWRhdGEgaW4gYWx0ZXJuYXRlIGZpZWxkcy5cclxuICAgIGNvbnN0IGFueU1zZyA9IG1zZyBhcyBhbnk7XHJcbiAgICBjb25zdCBtdSA9IFN0cmluZyhtc2cubWVkaWFfdXJsIHx8ICcnKS50cmltKCk7XHJcbiAgICBjb25zdCBtZWRpYUlzRGlyZWN0VXJsID1cclxuICAgICAgbXUuc3RhcnRzV2l0aCgnaHR0cDovLycpIHx8IG11LnN0YXJ0c1dpdGgoJ2h0dHBzOi8vJykgfHwgbXUuc3RhcnRzV2l0aCgnZGF0YTonKTtcclxuICAgIGNvbnN0IG1lZGlhSXNTdHJ1Y3R1cmVkID0gbXUuc3RhcnRzV2l0aCgneycpIHx8IG11LnN0YXJ0c1dpdGgoJ1snKTtcclxuICAgIGNvbnN0IGZpbGVJZCA9XHJcbiAgICAgIGFueU1zZz8uZmlsZV9pZCB8fFxyXG4gICAgICBhbnlNc2c/LmF0dGFjaG1lbnRfaWQgfHxcclxuICAgICAgYW55TXNnPy5hdHRhY2htZW50X2lkcz8uWzBdIHx8XHJcbiAgICAgICghbWVkaWFJc0RpcmVjdFVybCAmJiAhbWVkaWFJc1N0cnVjdHVyZWQgJiYgbXUgPyBtdSA6IHVuZGVmaW5lZCk7XHJcbiAgICBjb25zdCBtaW1lID0gYW55TXNnPy5taW1lX3R5cGUgfHwgYW55TXNnPy5hdHRhY2htZW50X21pbWVfdHlwZSB8fCAobXNnLm1lc3NhZ2VfdHlwZSA9PT0gJ0lNQUdFJyA/ICdpbWFnZS8qJyA6IHVuZGVmaW5lZCk7XHJcbiAgICBjb25zdCBleHBsaWNpdEZpbGVuYW1lID0gYW55TXNnPy5maWxlbmFtZSB8fCBhbnlNc2c/LmZpbGVfbmFtZTtcclxuICAgIGNvbnN0IGZpbGVuYW1lID1cclxuICAgICAgZXhwbGljaXRGaWxlbmFtZSB8fFxyXG4gICAgICAobXNnLm1lc3NhZ2VfdHlwZSA9PT0gJ0lNQUdFJyA/ICdJbWFnZScgOiBtc2cubWVzc2FnZV90eXBlID09PSAnRklMRScgPyAnRmlsZScgOiAnJyk7XHJcbiAgICBpZiAoZmlsZUlkIHx8IGV4cGxpY2l0RmlsZW5hbWUgfHwgbWltZSB8fCBtc2cubWVzc2FnZV90eXBlID09PSAnRklMRScgfHwgbXNnLm1lc3NhZ2VfdHlwZSA9PT0gJ0lNQUdFJykge1xyXG4gICAgICByZXR1cm4ge1xyXG4gICAgICAgIGZpbGVfaWQ6IFN0cmluZyhmaWxlSWQgfHwgJycpLFxyXG4gICAgICAgIGZpbGVuYW1lOiBTdHJpbmcoZmlsZW5hbWUgfHwgJ0ZpbGUnKSxcclxuICAgICAgICBtaW1lX3R5cGU6IG1pbWUgPyBTdHJpbmcobWltZSkgOiB1bmRlZmluZWQsXHJcbiAgICAgICAgdXJsOiBtZWRpYUlzRGlyZWN0VXJsID8gbXUgOiB1bmRlZmluZWQsXHJcbiAgICAgIH07XHJcbiAgICB9XHJcbiAgICByZXR1cm4gbnVsbDtcclxuICB9XHJcblxyXG4gIGlzSW1hZ2VBdHRhY2htZW50KG1zZzogTWVzc2FnZSwgYXR0YWNobWVudD86IEF0dGFjaG1lbnQpOiBib29sZWFuIHtcclxuICAgIGNvbnN0IG1pbWUgPSBhdHRhY2htZW50Py5taW1lX3R5cGUgfHwgdGhpcy5nZXRQcmltYXJ5QXR0YWNobWVudChtc2cpPy5taW1lX3R5cGUgfHwgJyc7XHJcbiAgICBpZiAobWltZS5zdGFydHNXaXRoKCdpbWFnZS8nKSkgcmV0dXJuIHRydWU7XHJcbiAgICBjb25zdCBuYW1lID0gdGhpcy5nZXRGaWxlbmFtZUxpa2UobXNnLCBhdHRhY2htZW50KTtcclxuICAgIGlmICgvXFwuKHBuZ3xqcGU/Z3xnaWZ8d2VicHxibXB8c3ZnfGhlaWN8aGVpZikkL2kudGVzdChuYW1lKSkgcmV0dXJuIHRydWU7XHJcbiAgICByZXR1cm4gbXNnLm1lc3NhZ2VfdHlwZSA9PT0gJ0lNQUdFJztcclxuICB9XHJcblxyXG4gIC8qKiBSZXR1cm5zIHRoZSBjYWNoZWQgZGF0YSBVUkwgZm9yIGEgbWVzc2FnZSdzIG1lZGlhLCBvciBudWxsIGFuZCB0cmlnZ2VycyBiYWNrZ3JvdW5kIGxvYWQuICovXHJcbiAgZ2V0TWVkaWFVcmwobXNnOiBNZXNzYWdlLCBhdHRhY2htZW50PzogQXR0YWNobWVudCk6IHN0cmluZyB8IG51bGwge1xyXG4gICAgY29uc3QgYXR0ID0gYXR0YWNobWVudCB8fCB0aGlzLmdldFByaW1hcnlBdHRhY2htZW50KG1zZyk7XHJcbiAgICBjb25zdCBmaWxlSWQgPSBhdHQ/LmZpbGVfaWQ/LnRyaW0oKTtcclxuXHJcbiAgICBjb25zdCBkaXJlY3RVcmwgPVxyXG4gICAgICBhdHQ/LnVybCB8fFxyXG4gICAgICAoIWF0dGFjaG1lbnQgPyBtc2cubWVkaWFfdXJsIDogdW5kZWZpbmVkKSB8fFxyXG4gICAgICAoIWF0dGFjaG1lbnQgPyAobXNnIGFzIGFueSk/LnVybCA6IHVuZGVmaW5lZCkgfHxcclxuICAgICAgKCFhdHRhY2htZW50ID8gKG1zZyBhcyBhbnkpPy5maWxlX3VybCA6IHVuZGVmaW5lZCk7XHJcbiAgICBpZiAoXHJcbiAgICAgIGRpcmVjdFVybCAmJlxyXG4gICAgICAoZGlyZWN0VXJsLnN0YXJ0c1dpdGgoJ2h0dHA6Ly8nKSB8fFxyXG4gICAgICAgIGRpcmVjdFVybC5zdGFydHNXaXRoKCdodHRwczovLycpIHx8XHJcbiAgICAgICAgZGlyZWN0VXJsLnN0YXJ0c1dpdGgoJ2RhdGE6JykpXHJcbiAgICApIHtcclxuICAgICAgcmV0dXJuIGRpcmVjdFVybDtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoIWZpbGVJZCkge1xyXG4gICAgICByZXR1cm4gbnVsbDtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBjYWNoZWQgPSB0aGlzLmZpbGVTZXJ2aWNlLmdldENhY2hlZERhdGFVcmwoZmlsZUlkKTtcclxuICAgIGlmIChjYWNoZWQpIHJldHVybiBjYWNoZWQ7XHJcbiAgICBpZiAodGhpcy5tZWRpYUZhaWxlZC5oYXMoZmlsZUlkKSkgcmV0dXJuIG51bGw7XHJcblxyXG4gICAgLy8gTm90IHlldCBjYWNoZWQg4oCUIGtpY2sgb2ZmIGEgYmFja2dyb3VuZCBmZXRjaFxyXG4gICAgdGhpcy5mZXRjaE1lZGlhKGZpbGVJZCk7XHJcbiAgICByZXR1cm4gbnVsbDtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgcHJld2FybU1lZGlhKG1lc3NhZ2VzOiBNZXNzYWdlW10pOiB2b2lkIHtcclxuICAgIGZvciAoY29uc3QgbXNnIG9mIG1lc3NhZ2VzKSB7XHJcbiAgICAgIGZvciAoY29uc3QgYXR0IG9mIHRoaXMuZ2V0UmVuZGVyYWJsZUF0dGFjaG1lbnRzKG1zZykpIHtcclxuICAgICAgICBpZiAoIXRoaXMuaXNJbWFnZUF0dGFjaG1lbnQobXNnLCBhdHQpKSBjb250aW51ZTtcclxuICAgICAgICBjb25zdCBmaWxlSWQgPSBhdHQuZmlsZV9pZD8udHJpbSgpO1xyXG4gICAgICAgIGlmICghZmlsZUlkIHx8IGZpbGVJZC5zdGFydHNXaXRoKCd0ZW1wLScpKSBjb250aW51ZTtcclxuICAgICAgICBpZiAodGhpcy5tZWRpYUZhaWxlZC5oYXMoZmlsZUlkKSkgY29udGludWU7XHJcbiAgICAgICAgaWYgKHRoaXMuZmlsZVNlcnZpY2UuZ2V0Q2FjaGVkRGF0YVVybChmaWxlSWQpKSBjb250aW51ZTtcclxuICAgICAgICAvLyBRdWV1ZSBhbGwgZmlsZXMgc28gZG93bmxvYWQgbGlua3MgYXBwZWFyIG9uY2UgcmV0cmlldmFsIGNvbXBsZXRlcy5cclxuICAgICAgICB0aGlzLmZldGNoTWVkaWEoZmlsZUlkKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBmZXRjaE1lZGlhKGZpbGVJZDogc3RyaW5nKTogdm9pZCB7XHJcbiAgICBpZiAoIWZpbGVJZCB8fCBmaWxlSWQuc3RhcnRzV2l0aCgndGVtcC0nKSB8fCB0aGlzLm1lZGlhTG9hZGluZy5oYXMoZmlsZUlkKSB8fCB0aGlzLm1lZGlhRmFpbGVkLmhhcyhmaWxlSWQpKSByZXR1cm47XHJcbiAgICB0aGlzLm1lZGlhTG9hZGluZy5hZGQoZmlsZUlkKTtcclxuICAgIHRoaXMubWVkaWFRdWV1ZS5wdXNoKGZpbGVJZCk7XHJcbiAgICB0aGlzLnB1bXBNZWRpYVF1ZXVlKCk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHB1bXBNZWRpYVF1ZXVlKCk6IHZvaWQge1xyXG4gICAgd2hpbGUgKHRoaXMuYWN0aXZlTWVkaWFSZXF1ZXN0cyA8IHRoaXMubWF4TWVkaWFSZXF1ZXN0cyAmJiB0aGlzLm1lZGlhUXVldWUubGVuZ3RoID4gMCkge1xyXG4gICAgICBjb25zdCBmaWxlSWQgPSB0aGlzLm1lZGlhUXVldWUuc2hpZnQoKTtcclxuICAgICAgaWYgKCFmaWxlSWQpIGNvbnRpbnVlO1xyXG4gICAgICB0aGlzLmFjdGl2ZU1lZGlhUmVxdWVzdHMgKz0gMTtcclxuXHJcbiAgICAgIHRoaXMuZmlsZVNlcnZpY2UuZ2V0RmlsZURhdGFVcmwoZmlsZUlkKS5zdWJzY3JpYmUoe1xyXG4gICAgICAgIG5leHQ6ICgpID0+IHtcclxuICAgICAgICAgIHRoaXMuZmluaXNoTWVkaWFSZXF1ZXN0KGZpbGVJZCk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBlcnJvcjogKCkgPT4ge1xyXG4gICAgICAgICAgdGhpcy5tZWRpYUZhaWxlZC5hZGQoZmlsZUlkKTtcclxuICAgICAgICAgIHRoaXMuZmluaXNoTWVkaWFSZXF1ZXN0KGZpbGVJZCk7XHJcbiAgICAgICAgfSxcclxuICAgICAgfSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGZpbmlzaE1lZGlhUmVxdWVzdChmaWxlSWQ6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgdGhpcy5hY3RpdmVNZWRpYVJlcXVlc3RzID0gTWF0aC5tYXgoMCwgdGhpcy5hY3RpdmVNZWRpYVJlcXVlc3RzIC0gMSk7XHJcbiAgICB0aGlzLm1lZGlhTG9hZGluZy5kZWxldGUoZmlsZUlkKTtcclxuICAgIHRoaXMuY2RyLm1hcmtGb3JDaGVjaygpO1xyXG4gICAgdGhpcy5wdW1wTWVkaWFRdWV1ZSgpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSByZXNldE1lZGlhUXVldWUoKTogdm9pZCB7XHJcbiAgICB0aGlzLm1lZGlhUXVldWUgPSBbXTtcclxuICAgIHRoaXMubWVkaWFMb2FkaW5nLmNsZWFyKCk7XHJcbiAgICB0aGlzLmFjdGl2ZU1lZGlhUmVxdWVzdHMgPSAwO1xyXG4gIH1cclxuXHJcbiAgc2hvdWxkU2hvd01lZGlhU3Bpbm5lcih0YXJnZXQ6IE1lc3NhZ2UgfCBBdHRhY2htZW50KTogYm9vbGVhbiB7XHJcbiAgICBjb25zdCBmaWxlSWQgPSB0aGlzLmdldEF0dGFjaG1lbnRGaWxlSWQodGFyZ2V0KTtcclxuICAgIGlmICghZmlsZUlkIHx8IGZpbGVJZC5zdGFydHNXaXRoKCd0ZW1wLScpKSByZXR1cm4gZmFsc2U7XHJcbiAgICByZXR1cm4gdGhpcy5tZWRpYUxvYWRpbmcuaGFzKGZpbGVJZCkgJiYgIXRoaXMubWVkaWFGYWlsZWQuaGFzKGZpbGVJZCk7XHJcbiAgfVxyXG5cclxuICBpc1ZpZGVvQXR0YWNobWVudChtc2c6IE1lc3NhZ2UsIGF0dGFjaG1lbnQ/OiBBdHRhY2htZW50KTogYm9vbGVhbiB7XHJcbiAgICBjb25zdCBtaW1lID0gYXR0YWNobWVudD8ubWltZV90eXBlIHx8IHRoaXMuZ2V0UHJpbWFyeUF0dGFjaG1lbnQobXNnKT8ubWltZV90eXBlIHx8ICcnO1xyXG4gICAgaWYgKG1pbWUuc3RhcnRzV2l0aCgndmlkZW8vJykpIHJldHVybiB0cnVlO1xyXG4gICAgY29uc3QgbmFtZSA9IHRoaXMuZ2V0RmlsZW5hbWVMaWtlKG1zZywgYXR0YWNobWVudCk7XHJcbiAgICByZXR1cm4gL1xcLihtcDR8d2VibXxtb3Z8bTR2fGF2aXxta3YpJC9pLnRlc3QobmFtZSk7XHJcbiAgfVxyXG5cclxuICBnZXRBdHRhY2htZW50TWltZVR5cGUobXNnOiBNZXNzYWdlLCBhdHRhY2htZW50PzogQXR0YWNobWVudCk6IHN0cmluZyB7XHJcbiAgICByZXR1cm4gYXR0YWNobWVudD8ubWltZV90eXBlIHx8IHRoaXMuZ2V0UHJpbWFyeUF0dGFjaG1lbnQobXNnKT8ubWltZV90eXBlIHx8ICdhcHBsaWNhdGlvbi9vY3RldC1zdHJlYW0nO1xyXG4gIH1cclxuXHJcbiAgZ2V0QXR0YWNobWVudE5hbWUobXNnOiBNZXNzYWdlLCBhdHRhY2htZW50PzogQXR0YWNobWVudCk6IHN0cmluZyB7XHJcbiAgICByZXR1cm4gYXR0YWNobWVudD8uZmlsZW5hbWUgfHwgdGhpcy5nZXRQcmltYXJ5QXR0YWNobWVudChtc2cpPy5maWxlbmFtZSB8fCBtc2cuY29udGVudCB8fCAnRmlsZSc7XHJcbiAgfVxyXG5cclxuICBoYXNGaWxlQXR0YWNobWVudChtc2c6IE1lc3NhZ2UpOiBib29sZWFuIHtcclxuICAgIHJldHVybiBtc2cubWVzc2FnZV90eXBlID09PSAnRklMRScgfHwgdGhpcy5nZXRSZW5kZXJhYmxlQXR0YWNobWVudHMobXNnKS5sZW5ndGggPiAwO1xyXG4gIH1cclxuXHJcbiAgaGFzTWVkaWFGYWlsZWQodGFyZ2V0OiBNZXNzYWdlIHwgQXR0YWNobWVudCk6IGJvb2xlYW4ge1xyXG4gICAgY29uc3QgZmlsZUlkID0gdGhpcy5nZXRBdHRhY2htZW50RmlsZUlkKHRhcmdldCk7XHJcbiAgICByZXR1cm4gISFmaWxlSWQgJiYgdGhpcy5tZWRpYUZhaWxlZC5oYXMoZmlsZUlkKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgZ2V0QXR0YWNobWVudEZpbGVJZCh0YXJnZXQ6IE1lc3NhZ2UgfCBBdHRhY2htZW50KTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcclxuICAgIGlmICgnZmlsZV9pZCcgaW4gdGFyZ2V0KSByZXR1cm4gdGFyZ2V0LmZpbGVfaWQ7XHJcbiAgICByZXR1cm4gdGhpcy5nZXRQcmltYXJ5QXR0YWNobWVudCh0YXJnZXQpPy5maWxlX2lkO1xyXG4gIH1cclxuXHJcbiAgZ2V0RmlsZUljb24obXNnOiBNZXNzYWdlLCBhdHRhY2htZW50PzogQXR0YWNobWVudCk6IHN0cmluZyB7XHJcbiAgICBjb25zdCBtaW1lID0gdGhpcy5nZXRBdHRhY2htZW50TWltZVR5cGUobXNnLCBhdHRhY2htZW50KTtcclxuICAgIGNvbnN0IG5hbWUgPSB0aGlzLmdldEF0dGFjaG1lbnROYW1lKG1zZywgYXR0YWNobWVudCkudG9Mb3dlckNhc2UoKTtcclxuICAgIGlmIChtaW1lLnN0YXJ0c1dpdGgoJ3ZpZGVvLycpIHx8IC9cXC4obXA0fHdlYm18bW92fG00dnxhdml8bWt2KSQvaS50ZXN0KG5hbWUpKSByZXR1cm4gJ3ZpZGVvY2FtJztcclxuICAgIGlmIChtaW1lLnN0YXJ0c1dpdGgoJ2F1ZGlvLycpIHx8IC9cXC4obXAzfHdhdnxvZ2d8bTRhfGZsYWMpJC9pLnRlc3QobmFtZSkpIHJldHVybiAnYXVkaW90cmFjayc7XHJcbiAgICBpZiAobWltZS5pbmNsdWRlcygncGRmJykgfHwgbmFtZS5lbmRzV2l0aCgnLnBkZicpKSByZXR1cm4gJ3BpY3R1cmVfYXNfcGRmJztcclxuICAgIGlmIChtaW1lLmluY2x1ZGVzKCdzcHJlYWRzaGVldCcpIHx8IG1pbWUuaW5jbHVkZXMoJ2V4Y2VsJykgfHwgL1xcLih4bHN8eGxzeHxjc3YpJC9pLnRlc3QobmFtZSkpIHJldHVybiAndGFibGVfY2hhcnQnO1xyXG4gICAgaWYgKG1pbWUuaW5jbHVkZXMoJ2RvY3VtZW50JykgfHwgbWltZS5pbmNsdWRlcygnd29yZCcpIHx8IC9cXC4oZG9jfGRvY3h8dHh0fHJ0ZikkL2kudGVzdChuYW1lKSkgcmV0dXJuICdkZXNjcmlwdGlvbic7XHJcbiAgICBpZiAobWltZS5pbmNsdWRlcygnemlwJykgfHwgL1xcLih6aXB8cmFyfDd6fHRhcnxneikkL2kudGVzdChuYW1lKSkgcmV0dXJuICdmb2xkZXJfemlwJztcclxuICAgIHJldHVybiAnaW5zZXJ0X2RyaXZlX2ZpbGUnO1xyXG4gIH1cclxuXHJcbiAgb3BlbkxpZ2h0Ym94KGRhdGFVcmw6IHN0cmluZywgZXZlbnQ/OiBFdmVudCk6IHZvaWQge1xyXG4gICAgZXZlbnQ/LnN0b3BQcm9wYWdhdGlvbigpO1xyXG4gICAgdGhpcy5saWdodGJveE9wZW4uZW1pdChkYXRhVXJsKTtcclxuICB9XHJcblxyXG4gIGRvd25sb2FkQXR0YWNobWVudChtc2c6IE1lc3NhZ2UsIGF0dGFjaG1lbnQ6IEF0dGFjaG1lbnQsIGV2ZW50PzogRXZlbnQpOiB2b2lkIHtcclxuICAgIGV2ZW50Py5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgZXZlbnQ/LnN0b3BQcm9wYWdhdGlvbigpO1xyXG5cclxuICAgIGNvbnN0IGRpcmVjdFVybCA9IGF0dGFjaG1lbnQudXJsO1xyXG4gICAgaWYgKGRpcmVjdFVybCAmJiAvXihodHRwcz86fGRhdGE6KS9pLnRlc3QoZGlyZWN0VXJsKSkge1xyXG4gICAgICB0aGlzLnRyaWdnZXJEb3dubG9hZChkaXJlY3RVcmwsIHRoaXMuZ2V0QXR0YWNobWVudE5hbWUobXNnLCBhdHRhY2htZW50KSk7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBmaWxlSWQgPSBhdHRhY2htZW50LmZpbGVfaWQ/LnRyaW0oKTtcclxuICAgIGlmICghZmlsZUlkIHx8IGZpbGVJZC5zdGFydHNXaXRoKCd0ZW1wLScpIHx8IGZpbGVJZC5zdGFydHNXaXRoKCd7JykgfHwgZmlsZUlkLnN0YXJ0c1dpdGgoJ1snKSkge1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgY2FjaGVkID0gdGhpcy5maWxlU2VydmljZS5nZXRDYWNoZWREYXRhVXJsKGZpbGVJZCk7XHJcbiAgICBpZiAoY2FjaGVkKSB7XHJcbiAgICAgIHRoaXMudHJpZ2dlckRvd25sb2FkKGNhY2hlZCwgdGhpcy5nZXRBdHRhY2htZW50TmFtZShtc2csIGF0dGFjaG1lbnQpKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMubWVkaWFMb2FkaW5nLmFkZChmaWxlSWQpO1xyXG4gICAgdGhpcy5maWxlU2VydmljZS5nZXRGaWxlRGF0YVVybChmaWxlSWQpLnN1YnNjcmliZSh7XHJcbiAgICAgIG5leHQ6IChkYXRhVXJsKSA9PiB7XHJcbiAgICAgICAgdGhpcy5tZWRpYUxvYWRpbmcuZGVsZXRlKGZpbGVJZCk7XHJcbiAgICAgICAgdGhpcy50cmlnZ2VyRG93bmxvYWQoZGF0YVVybCwgdGhpcy5nZXRBdHRhY2htZW50TmFtZShtc2csIGF0dGFjaG1lbnQpKTtcclxuICAgICAgICB0aGlzLmNkci5tYXJrRm9yQ2hlY2soKTtcclxuICAgICAgfSxcclxuICAgICAgZXJyb3I6ICgpID0+IHtcclxuICAgICAgICB0aGlzLm1lZGlhTG9hZGluZy5kZWxldGUoZmlsZUlkKTtcclxuICAgICAgICB0aGlzLm1lZGlhRmFpbGVkLmFkZChmaWxlSWQpO1xyXG4gICAgICAgIHRoaXMuY2RyLm1hcmtGb3JDaGVjaygpO1xyXG4gICAgICB9LFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHRyaWdnZXJEb3dubG9hZCh1cmw6IHN0cmluZywgZmlsZW5hbWU6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgY29uc3QgbGluayA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2EnKTtcclxuICAgIGxpbmsuaHJlZiA9IHVybDtcclxuICAgIGxpbmsuZG93bmxvYWQgPSBmaWxlbmFtZSB8fCAnYXR0YWNobWVudCc7XHJcbiAgICBsaW5rLnRhcmdldCA9ICdfYmxhbmsnO1xyXG4gICAgbGluay5yZWwgPSAnbm9vcGVuZXInO1xyXG4gICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChsaW5rKTtcclxuICAgIGxpbmsuY2xpY2soKTtcclxuICAgIGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQobGluayk7XHJcbiAgfVxyXG5cclxuICAvLyDilIDilIAgUmVhY3Rpb25zIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG5cclxuICBvbkVtb2ppU2VsZWN0ZWQoZW1vamk6IHN0cmluZywgbWVzc2FnZUlkOiBzdHJpbmcpOiB2b2lkIHtcclxuICAgIHRoaXMudG9nZ2xlUmVhY3Rpb24oZW1vamksIG1lc3NhZ2VJZCk7XHJcbiAgfVxyXG5cclxuICB0b2dnbGVSZWFjdGlvbihlbW9qaTogc3RyaW5nLCBtZXNzYWdlSWQ6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgY29uc3QgbXNnID0gdGhpcy5tZXNzYWdlcy5maW5kKG0gPT4gbS5tZXNzYWdlX2lkID09PSBtZXNzYWdlSWQpO1xyXG4gICAgaWYgKCFtc2cpIHJldHVybjtcclxuICAgIFxyXG4gICAgY29uc3QgcmVhY3Rpb24gPSBtc2cucmVhY3Rpb25zPy5maW5kKHIgPT4gci5lbW9qaSA9PT0gZW1vamkpO1xyXG4gICAgaWYgKHJlYWN0aW9uPy5oYXNSZWFjdGVkKSB7XHJcbiAgICAgIHRoaXMuc3RvcmUucmVtb3ZlUmVhY3Rpb24obWVzc2FnZUlkLCBlbW9qaSk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICB0aGlzLnN0b3JlLmFkZFJlYWN0aW9uKG1lc3NhZ2VJZCwgZW1vamkpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgZ2V0UmVhY3RvclRvb2x0aXAocmVhY3Rpb246IGFueSk6IHN0cmluZyB7XHJcbiAgICBpZiAoIXJlYWN0aW9uPy5yZWFjdG9ycz8ubGVuZ3RoKSByZXR1cm4gJyc7XHJcbiAgICByZXR1cm4gcmVhY3Rpb24ucmVhY3RvcnMuam9pbignLCAnKTtcclxuICB9XHJcbn1cclxuIl19