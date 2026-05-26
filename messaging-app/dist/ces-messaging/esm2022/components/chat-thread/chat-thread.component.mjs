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
            this.store.openGroupSettings(this.conversationId, this.conversationName);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdC10aHJlYWQuY29tcG9uZW50LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL2xpYi9jb21wb25lbnRzL2NoYXQtdGhyZWFkL2NoYXQtdGhyZWFkLmNvbXBvbmVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQ0wsU0FBUyxFQUFxQixTQUFTLEVBQUUsWUFBWSxFQUNyRCxNQUFNLEVBQUUsWUFBWSxHQUNyQixNQUFNLGVBQWUsQ0FBQztBQUV2QixPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDL0MsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLHdCQUF3QixDQUFDO0FBQ3ZELE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUMzRCxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUM5RSxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSwyQkFBMkIsQ0FBQztBQUM3RCxPQUFPLEVBQWdCLGFBQWEsRUFBRSxNQUFNLE1BQU0sQ0FBQztBQUtuRCxPQUFPLEVBQXlELHFCQUFxQixFQUFFLG9CQUFvQixFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDbkosT0FBTyxFQUFpQixxQkFBcUIsRUFBb0QsTUFBTSwwQ0FBMEMsQ0FBQzs7Ozs7Ozs7Ozs7O0FBNjhDbEosTUFBTSxPQUFPLG1CQUFtQjtJQTRDcEI7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBaERvQixlQUFlLENBQWM7SUFDbEMsVUFBVSxDQUEyQjtJQUMxQixtQkFBbUIsQ0FBOEM7SUFDbkUsWUFBWSxDQUF5QjtJQUM3RCxZQUFZLEdBQUcsSUFBSSxZQUFZLEVBQVUsQ0FBQztJQUVwRCxRQUFRLEdBQWMsRUFBRSxDQUFDO0lBQ3pCLGVBQWUsR0FBYyxFQUFFLENBQUM7SUFDaEMsZ0JBQWdCLEdBQUcsRUFBRSxDQUFDO0lBQ3RCLE9BQU8sR0FBRyxLQUFLLENBQUM7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WUFDUzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7R0E0WFQ7b1BBeWtDNkIsZUFBZTtzQkFBNUMsU0FBUzt1QkFBQyxpQkFBaUI7Z0JBQ0gsVUFBVTtzQkFBbEMsU0FBUzt1QkFBQyxZQUFZO2dCQUNhLG1CQUFtQjtzQkFBdEQsWUFBWTt1QkFBQyxvQkFBb0I7Z0JBQ0EsWUFBWTtzQkFBN0MsU0FBUzt1QkFBQyxxQkFBcUI7Z0JBQ3RCLFlBQVk7c0JBQXJCLE1BQU0iLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge1xyXG4gIENvbXBvbmVudCwgT25Jbml0LCBPbkRlc3Ryb3ksIFZpZXdDaGlsZCwgVmlld0NoaWxkcmVuLCBRdWVyeUxpc3QsIEVsZW1lbnRSZWYsIEFmdGVyVmlld0NoZWNrZWQsIENoYW5nZURldGVjdG9yUmVmLFxyXG4gIE91dHB1dCwgRXZlbnRFbWl0dGVyLFxyXG59IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xyXG5pbXBvcnQgeyBEb21TYW5pdGl6ZXIsIFNhZmVIdG1sIH0gZnJvbSAnQGFuZ3VsYXIvcGxhdGZvcm0tYnJvd3Nlcic7XHJcbmltcG9ydCB7IENvbW1vbk1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL2NvbW1vbic7XHJcbmltcG9ydCB7IE1hdEljb25Nb2R1bGUgfSBmcm9tICdAYW5ndWxhci9tYXRlcmlhbC9pY29uJztcclxuaW1wb3J0IHsgTWF0QnV0dG9uTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvbWF0ZXJpYWwvYnV0dG9uJztcclxuaW1wb3J0IHsgTWF0UHJvZ3Jlc3NTcGlubmVyTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvbWF0ZXJpYWwvcHJvZ3Jlc3Mtc3Bpbm5lcic7XHJcbmltcG9ydCB7IE1hdFRvb2x0aXBNb2R1bGUgfSBmcm9tICdAYW5ndWxhci9tYXRlcmlhbC90b29sdGlwJztcclxuaW1wb3J0IHsgU3Vic2NyaXB0aW9uLCBjb21iaW5lTGF0ZXN0IH0gZnJvbSAncnhqcyc7XHJcbmltcG9ydCB7IE1lc3NhZ2luZ1N0b3JlU2VydmljZSB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL21lc3NhZ2luZy1zdG9yZS5zZXJ2aWNlJztcclxuaW1wb3J0IHsgTWVzc2FnaW5nQXBpU2VydmljZSB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL21lc3NhZ2luZy1hcGkuc2VydmljZSc7XHJcbmltcG9ydCB7IE1lc3NhZ2luZ0ZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvbWVzc2FnaW5nLWZpbGUuc2VydmljZSc7XHJcbmltcG9ydCB7IEF1dGhTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvYXV0aC5zZXJ2aWNlJztcclxuaW1wb3J0IHsgQ29udGFjdCwgQ29udmVyc2F0aW9uUGFydGljaXBhbnQsIE1lc3NhZ2UsIEF0dGFjaG1lbnQsIGdldENvbnRhY3REaXNwbGF5TmFtZSwgZ2V0TWVzc2FnZVNlbmRlck5hbWUgfSBmcm9tICcuLi8uLi9tb2RlbHMvbWVzc2FnaW5nLm1vZGVscyc7XHJcbmltcG9ydCB7IE1lbnRpb25PcHRpb24sIE1lc3NhZ2VJbnB1dENvbXBvbmVudCwgTWVzc2FnZVBheWxvYWQsIE1lc3NhZ2VUZXh0UGF5bG9hZCwgUmVwbHlQcmV2aWV3IH0gZnJvbSAnLi4vbWVzc2FnZS1pbnB1dC9tZXNzYWdlLWlucHV0LmNvbXBvbmVudCc7XHJcblxyXG5AQ29tcG9uZW50KHtcclxuICBzZWxlY3RvcjogJ2FwcC1jaGF0LXRocmVhZCcsXHJcbiAgc3RhbmRhbG9uZTogdHJ1ZSxcclxuICBpbXBvcnRzOiBbXHJcbiAgICBDb21tb25Nb2R1bGUsIE1hdEljb25Nb2R1bGUsIE1hdEJ1dHRvbk1vZHVsZSxcclxuICAgIE1hdFByb2dyZXNzU3Bpbm5lck1vZHVsZSwgTWF0VG9vbHRpcE1vZHVsZSwgTWVzc2FnZUlucHV0Q29tcG9uZW50LFxyXG4gIF0sXHJcbiAgdGVtcGxhdGU6IGBcclxuICAgIDxkaXZcclxuICAgICAgI3RocmVhZFJvb3RcclxuICAgICAgY2xhc3M9XCJjaGF0LXRocmVhZFwiXHJcbiAgICAgIFtjbGFzcy5kcmFnLW92ZXJdPVwidGhyZWFkRHJhZ092ZXJcIlxyXG4gICAgICBbc3R5bGUuLS1tZXNzYWdlLXRleHQtc2NhbGVdPVwibWVzc2FnZVRleHRTY2FsZVwiXHJcbiAgICAgIFtzdHlsZS4tLWNvZGUtdGV4dC1zY2FsZV09XCJjb2RlVGV4dFNjYWxlXCJcclxuICAgICAgKGNsaWNrKT1cImNsb3NlTWVzc2FnZUNvbnRleHRNZW51KClcIlxyXG4gICAgICAoZHJhZ2VudGVyKT1cIm9uVGhyZWFkRHJhZ0VudGVyKCRldmVudClcIlxyXG4gICAgICAoZHJhZ292ZXIpPVwib25UaHJlYWREcmFnT3ZlcigkZXZlbnQpXCJcclxuICAgICAgKGRyYWdsZWF2ZSk9XCJvblRocmVhZERyYWdMZWF2ZSgkZXZlbnQpXCJcclxuICAgICAgKGRyb3ApPVwib25UaHJlYWREcm9wKCRldmVudClcIlxyXG4gICAgPlxyXG4gICAgICA8ZGl2IGNsYXNzPVwiY2hhdC1oZWFkZXJcIj5cclxuICAgICAgICA8YnV0dG9uIG1hdC1pY29uLWJ1dHRvbiBjbGFzcz1cImhkci1idG5cIiAoY2xpY2spPVwiZ29CYWNrKClcIiBtYXRUb29sdGlwPVwiQmFja1wiIG1hdFRvb2x0aXBQb3NpdGlvbj1cImJlbG93XCI+XHJcbiAgICAgICAgICA8bWF0LWljb24+YXJyb3dfYmFjazwvbWF0LWljb24+XHJcbiAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgPGRpdiBjbGFzcz1cImhlYWRlci1pbmZvXCI+XHJcbiAgICAgICAgICA8c3BhbiBjbGFzcz1cImNoYXQtbmFtZVwiPnt7IGNvbnZlcnNhdGlvbk5hbWUgfX08L3NwYW4+XHJcbiAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgPGRpdiBjbGFzcz1cImhlYWRlci1hY3Rpb25zXCI+XHJcbiAgICAgICAgICA8YnV0dG9uICpuZ0lmPVwiaXNHcm91cCAmJiAhaXNSZW1vdmVkRnJvbUdyb3VwXCIgbWF0LWljb24tYnV0dG9uIGNsYXNzPVwiaGRyLWJ0blwiIChjbGljayk9XCJvbkdyb3VwU2V0dGluZ3MoKVwiIG1hdFRvb2x0aXA9XCJHcm91cCBzZXR0aW5nc1wiIG1hdFRvb2x0aXBQb3NpdGlvbj1cImJlbG93XCI+XHJcbiAgICAgICAgICAgIDxtYXQtaWNvbj5zZXR0aW5nczwvbWF0LWljb24+XHJcbiAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICA8L2Rpdj5cclxuICAgICAgPC9kaXY+XHJcblxyXG4gICAgICA8ZGl2IGNsYXNzPVwibWVzc2FnZXMtYXJlYVwiICNzY3JvbGxDb250YWluZXIgKHNjcm9sbCk9XCJvblNjcm9sbCgpXCI+XHJcbiAgICAgICAgPGRpdiAqbmdJZj1cInRocmVhZERyYWdPdmVyXCIgY2xhc3M9XCJ0aHJlYWQtZHJhZy1vdmVybGF5XCI+XHJcbiAgICAgICAgICA8bWF0LWljb24+Y2xvdWRfdXBsb2FkPC9tYXQtaWNvbj5cclxuICAgICAgICAgIDxzcGFuPkRyb3AgZmlsZXMgYW55d2hlcmUgaW4gdGhpcyBjaGF0PC9zcGFuPlxyXG4gICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICA8ZGl2ICpuZ0lmPVwiaXNSZW1vdmVkRnJvbUdyb3VwXCIgY2xhc3M9XCJyZW1vdmVkLWdyb3VwLXN0YXRlXCI+XHJcbiAgICAgICAgICA8bWF0LWljb24+YmxvY2s8L21hdC1pY29uPlxyXG4gICAgICAgICAgPGg0PllvdSB3ZXJlIHJlbW92ZWQgZnJvbSB0aGlzIGdyb3VwPC9oND5cclxuICAgICAgICAgIDxwPk1lc3NhZ2VzLCBhdHRhY2htZW50cywgYW5kIGdyb3VwIHNldHRpbmdzIGFyZSBubyBsb25nZXIgYXZhaWxhYmxlLjwvcD5cclxuICAgICAgICAgIDxidXR0b24gdHlwZT1cImJ1dHRvblwiIG1hdC1yYWlzZWQtYnV0dG9uIGNsYXNzPVwicmVtb3ZlZC1leGl0LWJ0blwiIChjbGljayk9XCJleGl0UmVtb3ZlZEdyb3VwKClcIj5cclxuICAgICAgICAgICAgRXhpdCBHcm91cFxyXG4gICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgIDxkaXYgKm5nSWY9XCIhaXNSZW1vdmVkRnJvbUdyb3VwICYmIGxvYWRpbmdcIiBjbGFzcz1cImxvYWRpbmctaW5kaWNhdG9yXCI+XHJcbiAgICAgICAgICA8bWF0LXNwaW5uZXIgZGlhbWV0ZXI9XCIyNFwiPjwvbWF0LXNwaW5uZXI+XHJcbiAgICAgICAgICA8c3Bhbj5Mb2FkaW5nIG1lc3NhZ2VzLi4uPC9zcGFuPlxyXG4gICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICA8YnV0dG9uXHJcbiAgICAgICAgICAqbmdJZj1cIiFpc1JlbW92ZWRGcm9tR3JvdXAgJiYgbWVzc2FnZXMubGVuZ3RoID49IDUwICYmICFsb2FkaW5nXCJcclxuICAgICAgICAgIG1hdC1zdHJva2VkLWJ1dHRvblxyXG4gICAgICAgICAgY2xhc3M9XCJsb2FkLW1vcmUtYnRuXCJcclxuICAgICAgICAgIChjbGljayk9XCJsb2FkT2xkZXIoKVwiXHJcbiAgICAgICAgPlxyXG4gICAgICAgICAgTG9hZCBvbGRlciBtZXNzYWdlc1xyXG4gICAgICAgIDwvYnV0dG9uPlxyXG5cclxuICAgICAgICA8ZGl2ICpuZ0lmPVwiIWlzUmVtb3ZlZEZyb21Hcm91cFwiIGNsYXNzPVwibWVzc2FnZXMtbGlzdFwiPlxyXG4gICAgICAgICAgPG5nLWNvbnRhaW5lciAqbmdGb3I9XCJsZXQgbXNnIG9mIG1lc3NhZ2VzOyBsZXQgaSA9IGluZGV4XCI+XHJcbiAgICAgICAgICAgIDxkaXZcclxuICAgICAgICAgICAgICAqbmdJZj1cInNob3VsZFNob3dEYXRlU2VwYXJhdG9yKGkpXCJcclxuICAgICAgICAgICAgICBjbGFzcz1cImRhdGUtc2VwYXJhdG9yXCJcclxuICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgIDxzcGFuPnt7IGZvcm1hdERhdGUobXNnLmNyZWF0ZWRfYXQpIH19PC9zcGFuPlxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgICAgIDxkaXZcclxuICAgICAgICAgICAgICAqbmdJZj1cImlzU3lzdGVtTWVzc2FnZShtc2cpOyBlbHNlIGNoYXRNZXNzYWdlXCJcclxuICAgICAgICAgICAgICBjbGFzcz1cInN5c3RlbS1tZXNzYWdlLXJvd1wiXHJcbiAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cInN5c3RlbS1tZXNzYWdlLXRleHRcIj57eyBtc2cuY29udGVudCB9fTwvc3Bhbj5cclxuICAgICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgICA8bmctdGVtcGxhdGUgI2NoYXRNZXNzYWdlPlxyXG4gICAgICAgICAgICAgIDxkaXZcclxuICAgICAgICAgICAgICAgIGNsYXNzPVwibWVzc2FnZS1idWJibGUtcm93XCJcclxuICAgICAgICAgICAgICAgIFtjbGFzcy5vd25dPVwiaXNPd25NZXNzYWdlKG1zZylcIlxyXG4gICAgICAgICAgICAgICAgW2NsYXNzLm90aGVyXT1cIiFpc093bk1lc3NhZ2UobXNnKVwiXHJcbiAgICAgICAgICAgICAgICAoY29udGV4dG1lbnUpPVwib3Blbk1lc3NhZ2VDb250ZXh0TWVudShtc2csICRldmVudClcIlxyXG4gICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICA8ZGl2ICpuZ0lmPVwiIWlzT3duTWVzc2FnZShtc2cpXCIgY2xhc3M9XCJzZW5kZXItbmFtZVwiPlxyXG4gICAgICAgICAgICAgICAge3sgZ2V0U2VuZGVyTmFtZShtc2cpIH19XHJcbiAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgPGRpdlxyXG4gICAgICAgICAgICAgICAgY2xhc3M9XCJtZXNzYWdlLWJ1YmJsZVwiXHJcbiAgICAgICAgICAgICAgICBbY2xhc3Mub3duLWJ1YmJsZV09XCJpc093bk1lc3NhZ2UobXNnKVwiXHJcbiAgICAgICAgICAgICAgICAobW91c2VlbnRlcik9XCJob3ZlcmVkTWVzc2FnZUlkID0gbXNnLm1lc3NhZ2VfaWRcIlxyXG4gICAgICAgICAgICAgICAgKG1vdXNlbGVhdmUpPVwiaG92ZXJlZE1lc3NhZ2VJZCA9IG51bGxcIlxyXG4gICAgICAgICAgICAgICAgKGNvbnRleHRtZW51KT1cIm9wZW5NZXNzYWdlQ29udGV4dE1lbnUobXNnLCAkZXZlbnQpXCJcclxuICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICA8ZGl2ICpuZ0lmPVwiZ2V0UmVwbHlQcmV2aWV3KG1zZykgYXMgcmVwbHlcIiBjbGFzcz1cInJlcGx5LWNvbnRleHRcIj5cclxuICAgICAgICAgICAgICAgICAgPG1hdC1pY29uPnJlcGx5PC9tYXQtaWNvbj5cclxuICAgICAgICAgICAgICAgICAgPGRpdj5cclxuICAgICAgICAgICAgICAgICAgICA8c3Bhbj57eyByZXBseS5zZW5kZXJOYW1lIH19PC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgIDxwPnt7IHJlcGx5LmNvbnRlbnQgfX08L3A+XHJcbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICA8IS0tIEFUVEFDSE1FTlRTIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgCAtLT5cclxuICAgICAgICAgICAgICAgIDxkaXYgKm5nSWY9XCJoYXNGaWxlQXR0YWNobWVudChtc2cpXCIgY2xhc3M9XCJhdHRhY2htZW50cy1saXN0XCI+XHJcbiAgICAgICAgICAgICAgICAgIDxkaXYgKm5nRm9yPVwibGV0IGF0dGFjaG1lbnQgb2YgZ2V0UmVuZGVyYWJsZUF0dGFjaG1lbnRzKG1zZyk7IHRyYWNrQnk6IHRyYWNrQnlBdHRhY2htZW50XCIgY2xhc3M9XCJhdHRhY2htZW50LWl0ZW1cIj5cclxuICAgICAgICAgICAgICAgICAgICA8bmctY29udGFpbmVyICpuZ0lmPVwiaXNJbWFnZUF0dGFjaG1lbnQobXNnLCBhdHRhY2htZW50KTsgZWxzZSBub25JbWFnZUF0dGFjaG1lbnRcIj5cclxuICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJpbWFnZS1tZXNzYWdlXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxuZy1jb250YWluZXIgKm5nSWY9XCJnZXRNZWRpYVVybChtc2csIGF0dGFjaG1lbnQpIGFzIGRhdGFVcmw7IGVsc2UgaW1nRmFsbGJhY2tcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwibWVkaWEtd3JhcHBlclwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPGltZ1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBbc3JjXT1cImRhdGFVcmxcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhbHQ9XCJJbWFnZVwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzPVwibWVkaWEtaW1nXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKG1vdXNlZG93bik9XCIkZXZlbnQuc3RvcFByb3BhZ2F0aW9uKClcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAoY2xpY2spPVwib3BlbkxpZ2h0Ym94KGRhdGFVcmwsICRldmVudClcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLz5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJhdHRhY2htZW50LWFjdGlvbnNcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzPVwiYXR0YWNobWVudC1hY3Rpb24tYnRuXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAoY2xpY2spPVwib3BlbkxpZ2h0Ym94KGRhdGFVcmwsICRldmVudClcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRpdGxlPVwiT3BlbiBpbWFnZVwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8bWF0LWljb24+b3Blbl9pbl9mdWxsPC9tYXQtaWNvbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxidXR0b25cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbGFzcz1cImF0dGFjaG1lbnQtYWN0aW9uLWJ0blwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKGNsaWNrKT1cImRvd25sb2FkQXR0YWNobWVudChtc2csIGF0dGFjaG1lbnQsICRldmVudClcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRpdGxlPVwiRG93bmxvYWQgaW1hZ2VcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPG1hdC1pY29uPmRvd25sb2FkPC9tYXQtaWNvbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPC9uZy1jb250YWluZXI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxuZy10ZW1wbGF0ZSAjaW1nRmFsbGJhY2s+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiAqbmdJZj1cInNob3VsZFNob3dNZWRpYVNwaW5uZXIoYXR0YWNobWVudCk7IGVsc2UgaW1nQXNGaWxlXCIgY2xhc3M9XCJtZWRpYS1wbGFjZWhvbGRlclwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPG1hdC1zcGlubmVyIGRpYW1ldGVyPVwiMjJcIj48L21hdC1zcGlubmVyPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxuZy10ZW1wbGF0ZSAjaW1nQXNGaWxlPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZpbGUtbWVzc2FnZVwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8bWF0LWljb24gY2xhc3M9XCJmaWxlLW1zZy1pY29uXCI+aW1hZ2U8L21hdC1pY29uPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cImZpbGUtbXNnLW5hbWVcIj57eyBnZXRBdHRhY2htZW50TmFtZShtc2csIGF0dGFjaG1lbnQpIH19PC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPC9uZy10ZW1wbGF0ZT5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPC9uZy10ZW1wbGF0ZT5cclxuICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgIDwvbmctY29udGFpbmVyPlxyXG5cclxuICAgICAgICAgICAgICAgICAgICA8bmctdGVtcGxhdGUgI25vbkltYWdlQXR0YWNobWVudD5cclxuICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmaWxlLW1lc3NhZ2UgYXR0YWNobWVudC10aHVtYlwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8YnV0dG9uXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZT1cImJ1dHRvblwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3M9XCJmaWxlLWRvd25sb2FkLWJ0blwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgKGNsaWNrKT1cImRvd25sb2FkQXR0YWNobWVudChtc2csIGF0dGFjaG1lbnQsICRldmVudClcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHRpdGxlPVwiRG93bmxvYWQgZmlsZVwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8bWF0LWljb24gY2xhc3M9XCJmaWxlLWRvd25sb2FkLWljb25cIj5kb3dubG9hZDwvbWF0LWljb24+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8bWF0LWljb24gY2xhc3M9XCJmaWxlLW1zZy1pY29uXCI+e3sgZ2V0RmlsZUljb24obXNnLCBhdHRhY2htZW50KSB9fTwvbWF0LWljb24+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwiZmlsZS1tc2ctbmFtZVwiIFt0aXRsZV09XCJnZXRBdHRhY2htZW50TmFtZShtc2csIGF0dGFjaG1lbnQpXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAge3sgZ2V0QXR0YWNobWVudE5hbWUobXNnLCBhdHRhY2htZW50KSB9fVxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxidXR0b25cclxuICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICBjbGFzcz1cImZpbGUtZG93bmxvYWQtbGlua1wiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgKGNsaWNrKT1cImRvd25sb2FkQXR0YWNobWVudChtc2csIGF0dGFjaG1lbnQsICRldmVudClcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHRpdGxlPVwiRG93bmxvYWQgZmlsZVwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICBEb3dubG9hZFxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgIDwvbmctdGVtcGxhdGU+XHJcbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICA8ZGl2XHJcbiAgICAgICAgICAgICAgICAgICpuZ0lmPVwiaGFzRmlsZUF0dGFjaG1lbnQobXNnKSAmJiBnZXRNZXNzYWdlQ2FwdGlvbihtc2cpXCJcclxuICAgICAgICAgICAgICAgICAgY2xhc3M9XCJhdHRhY2htZW50LWNhcHRpb25cIlxyXG4gICAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgICA8ZGl2ICpuZ0lmPVwiaXNDb2RlQ29udGVudChnZXRNZXNzYWdlQ2FwdGlvbihtc2cpLCBtc2cpOyBlbHNlIG5vbkNvZGVDYXB0aW9uXCIgY2xhc3M9XCJjb2RlLW1lc3NhZ2Utd3JhcCBhdHRhY2htZW50LXJlbmRlci1ibG9ja1wiPlxyXG4gICAgICAgICAgICAgICAgICAgIDxidXR0b24gdHlwZT1cImJ1dHRvblwiIGNsYXNzPVwicmVuZGVyLWNvcHktYnRuXCIgKGNsaWNrKT1cImNvcHlUZXh0VmFsdWUoZ2V0TWVzc2FnZUNhcHRpb24obXNnKSwgJGV2ZW50KVwiIHRpdGxlPVwiQ29weSBjb2RlXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8bWF0LWljb24+Y29udGVudF9jb3B5PC9tYXQtaWNvbj5cclxuICAgICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgICAgICAgICAgICA8cHJlIGNsYXNzPVwiY29kZS1tZXNzYWdlXCI+PGNvZGUgW2lubmVySFRNTF09XCJnZXRIaWdobGlnaHRlZENvZGVDb250ZW50KGdldE1lc3NhZ2VDYXB0aW9uKG1zZykpXCI+PC9jb2RlPjwvcHJlPlxyXG4gICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwiY29kZS1sYW5ndWFnZVwiPnt7IGdldENvZGVMYW5ndWFnZUNvbnRlbnQoZ2V0TWVzc2FnZUNhcHRpb24obXNnKSkgfX08L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICA8bmctdGVtcGxhdGUgI25vbkNvZGVDYXB0aW9uPlxyXG4gICAgICAgICAgICAgICAgICAgIDxkaXYgKm5nSWY9XCJpc01hcmtkb3duQ29udGVudChnZXRNZXNzYWdlQ2FwdGlvbihtc2cpKTsgZWxzZSBwbGFpbkNhcHRpb25cIiBjbGFzcz1cIm1kLW1lc3NhZ2Utd3JhcCBhdHRhY2htZW50LXJlbmRlci1ibG9ja1wiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPGJ1dHRvbiB0eXBlPVwiYnV0dG9uXCIgY2xhc3M9XCJyZW5kZXItY29weS1idG5cIiAoY2xpY2spPVwiY29weVRleHRWYWx1ZShnZXRNZXNzYWdlQ2FwdGlvbihtc2cpLCAkZXZlbnQpXCIgdGl0bGU9XCJDb3B5IG1hcmtkb3duXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxtYXQtaWNvbj5jb250ZW50X2NvcHk8L21hdC1pY29uPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwibWQtbWVzc2FnZVwiIFtpbm5lckhUTUxdPVwiZ2V0TWFya2Rvd25IdG1sQ29udGVudChnZXRNZXNzYWdlQ2FwdGlvbihtc2cpKVwiPjwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJtZC1sYW5ndWFnZVwiPm1kPC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgIDxuZy10ZW1wbGF0ZSAjcGxhaW5DYXB0aW9uPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPGRpdlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjbGFzcz1cInRleHQtY29udGVudFwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIFtjbGFzcy5wcmVmb3JtYXR0ZWQtdGV4dF09XCJpc1ByZWZvcm1hdHRlZENvbnRlbnQoZ2V0TWVzc2FnZUNhcHRpb24obXNnKSlcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICB7eyBnZXRNZXNzYWdlQ2FwdGlvbihtc2cpIH19XHJcbiAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICA8L25nLXRlbXBsYXRlPlxyXG4gICAgICAgICAgICAgICAgICA8L25nLXRlbXBsYXRlPlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICA8bmctY29udGFpbmVyICpuZ0lmPVwibXNnLm1lc3NhZ2VfdHlwZSA9PT0gJ1RFWFQnICYmICFoYXNGaWxlQXR0YWNobWVudChtc2cpXCI+XHJcbiAgICAgICAgICAgICAgICAgIDxuZy1jb250YWluZXIgKm5nSWY9XCJpc0VkaXRpbmdNZXNzYWdlKG1zZyk7IGVsc2UgdGV4dE1lc3NhZ2VSZW5kZXJcIj5cclxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiaW5saW5lLWVkaXQtd3JhcFwiIChjbGljayk9XCIkZXZlbnQuc3RvcFByb3BhZ2F0aW9uKClcIiAoY29udGV4dG1lbnUpPVwiJGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8dGV4dGFyZWFcclxuICAgICAgICAgICAgICAgICAgICAgICAgI2lubGluZUVkaXRUZXh0YXJlYVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjbGFzcz1cImlubGluZS1lZGl0LXRleHRhcmVhXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgW3ZhbHVlXT1cImVkaXRpbmdEcmFmdFwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIChpbnB1dCk9XCJvbklubGluZUVkaXRJbnB1dCgkZXZlbnQpXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgKGtleWRvd24pPVwib25JbmxpbmVFZGl0S2V5ZG93bigkZXZlbnQpXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgcm93cz1cIjJcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgPjwvdGV4dGFyZWE+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiaW5saW5lLWVkaXQtYWN0aW9uc1wiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8YnV0dG9uIHR5cGU9XCJidXR0b25cIiBjbGFzcz1cImlubGluZS1lZGl0LWNhbmNlbFwiIChjbGljayk9XCJjYW5jZWxJbmxpbmVFZGl0KCRldmVudClcIj5DYW5jZWw8L2J1dHRvbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzPVwiaW5saW5lLWVkaXQtc2F2ZVwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgW2Rpc2FibGVkXT1cIiFjYW5TYXZlSW5saW5lRWRpdCgpXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAoY2xpY2spPVwic2F2ZUlubGluZUVkaXQoJGV2ZW50KVwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICBTYXZlXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgIDwvbmctY29udGFpbmVyPlxyXG4gICAgICAgICAgICAgICAgICA8bmctdGVtcGxhdGUgI3RleHRNZXNzYWdlUmVuZGVyPlxyXG4gICAgICAgICAgICAgICAgICAgIDxkaXYgKm5nSWY9XCJpc0NvZGVUZXh0KG1zZyk7IGVsc2Ugbm9uQ29kZVRleHRNZXNzYWdlXCIgY2xhc3M9XCJjb2RlLW1lc3NhZ2Utd3JhcFwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPGJ1dHRvbiB0eXBlPVwiYnV0dG9uXCIgY2xhc3M9XCJyZW5kZXItY29weS1idG5cIiAoY2xpY2spPVwiY29weUNvZGUobXNnLCAkZXZlbnQpXCIgdGl0bGU9XCJDb3B5IGNvZGVcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPG1hdC1pY29uPmNvbnRlbnRfY29weTwvbWF0LWljb24+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgICAgICAgICAgICAgIDxwcmUgY2xhc3M9XCJjb2RlLW1lc3NhZ2VcIj48Y29kZSBbaW5uZXJIVE1MXT1cImdldEhpZ2hsaWdodGVkQ29kZShtc2cpXCI+PC9jb2RlPjwvcHJlPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJjb2RlLWxhbmd1YWdlXCI+e3sgZ2V0Q29kZUxhbmd1YWdlKG1zZykgfX08L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgPG5nLXRlbXBsYXRlICNub25Db2RlVGV4dE1lc3NhZ2U+XHJcbiAgICAgICAgICAgICAgICAgICAgPGRpdiAqbmdJZj1cImlzVGFibGVUZXh0KG1zZyk7IGVsc2UgcGxhaW5UZXh0TWVzc2FnZVwiIGNsYXNzPVwidGFibGUtbWVzc2FnZS13cmFwXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8YnV0dG9uIHR5cGU9XCJidXR0b25cIiBjbGFzcz1cInJlbmRlci1jb3B5LWJ0blwiIChjbGljayk9XCJjb3B5TWVzc2FnZVRleHQobXNnLCAkZXZlbnQpXCIgdGl0bGU9XCJDb3B5IHRhYmxlXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxtYXQtaWNvbj5jb250ZW50X2NvcHk8L21hdC1pY29uPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8dGFibGUgY2xhc3M9XCJwYXN0ZWQtdGFibGVcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRib2R5PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDx0ciAqbmdGb3I9XCJsZXQgcm93IG9mIGdldFRhYmxlUm93cyhtc2cpOyBsZXQgcm93SW5kZXggPSBpbmRleFwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPG5nLWNvbnRhaW5lciAqbmdGb3I9XCJsZXQgY2VsbCBvZiByb3dcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRoICpuZ0lmPVwicm93SW5kZXggPT09IDA7IGVsc2UgdGFibGVDZWxsXCI+e3sgY2VsbCB9fTwvdGg+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxuZy10ZW1wbGF0ZSAjdGFibGVDZWxsPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD57eyBjZWxsIH19PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9uZy10ZW1wbGF0ZT5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvbmctY29udGFpbmVyPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDwvdHI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDwvdGJvZHk+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8L3RhYmxlPlxyXG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgIDxuZy10ZW1wbGF0ZSAjcGxhaW5UZXh0TWVzc2FnZT5cclxuICAgICAgICAgICAgICAgICAgICAgIDxkaXYgKm5nSWY9XCJpc01hcmtkb3duVGV4dChtc2cpOyBlbHNlIHJhd1RleHRNZXNzYWdlXCIgY2xhc3M9XCJtZC1tZXNzYWdlLXdyYXBcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPGJ1dHRvbiB0eXBlPVwiYnV0dG9uXCIgY2xhc3M9XCJyZW5kZXItY29weS1idG5cIiAoY2xpY2spPVwiY29weU1lc3NhZ2VUZXh0KG1zZywgJGV2ZW50KVwiIHRpdGxlPVwiQ29weSBtYXJrZG93blwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxtYXQtaWNvbj5jb250ZW50X2NvcHk8L21hdC1pY29uPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cIm1kLW1lc3NhZ2VcIiBbaW5uZXJIVE1MXT1cImdldE1hcmtkb3duSHRtbChtc2cpXCI+PC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwibWQtbGFuZ3VhZ2VcIj5tZDwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgPG5nLXRlbXBsYXRlICNyYXdUZXh0TWVzc2FnZT5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPGRpdlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzPVwidGV4dC1jb250ZW50XCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICBbY2xhc3MucHJlZm9ybWF0dGVkLXRleHRdPVwiaXNQcmVmb3JtYXR0ZWRUZXh0KG1zZylcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAge3sgZ2V0TWVzc2FnZUJvZHkobXNnKSB9fVxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgIDwvbmctdGVtcGxhdGU+XHJcbiAgICAgICAgICAgICAgICAgICAgPC9uZy10ZW1wbGF0ZT5cclxuICAgICAgICAgICAgICAgICAgICA8L25nLXRlbXBsYXRlPlxyXG4gICAgICAgICAgICAgICAgICA8L25nLXRlbXBsYXRlPlxyXG4gICAgICAgICAgICAgICAgPC9uZy1jb250YWluZXI+XHJcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwibWVzc2FnZS1tZXRhXCI+XHJcbiAgICAgICAgICAgICAgICAgIDxzcGFuICpuZ0lmPVwibXNnLmVkaXRlZF9hdCAmJiAhaXNEZWxldGVkTWVzc2FnZShtc2cpXCIgY2xhc3M9XCJlZGl0ZWQtbGFiZWxcIj5lZGl0ZWQ8L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwibXNnLXRpbWVcIj57eyBmb3JtYXRUaW1lKG1zZy5jcmVhdGVkX2F0KSB9fTwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgPG1hdC1pY29uXHJcbiAgICAgICAgICAgICAgICAgICAgKm5nSWY9XCJpc093bk1lc3NhZ2UobXNnKSAmJiBpc01lc3NhZ2VSZWFkKG1zZylcIlxyXG4gICAgICAgICAgICAgICAgICAgIGNsYXNzPVwicmVhZC1pY29uIHJlYWRcIlxyXG4gICAgICAgICAgICAgICAgICAgIFttYXRUb29sdGlwXT1cImdldFJlYWRUb29sdGlwKG1zZylcIlxyXG4gICAgICAgICAgICAgICAgICAgIG1hdFRvb2x0aXBQb3NpdGlvbj1cImFib3ZlXCJcclxuICAgICAgICAgICAgICAgICAgPmRvbmVfYWxsPC9tYXQtaWNvbj5cclxuICAgICAgICAgICAgICAgICAgPG1hdC1pY29uXHJcbiAgICAgICAgICAgICAgICAgICAgKm5nSWY9XCJpc093bk1lc3NhZ2UobXNnKSAmJiAhaXNNZXNzYWdlUmVhZChtc2cpXCJcclxuICAgICAgICAgICAgICAgICAgICBjbGFzcz1cInJlYWQtaWNvbiB1bnJlYWRcIlxyXG4gICAgICAgICAgICAgICAgICAgIG1hdFRvb2x0aXA9XCJTZW50XCJcclxuICAgICAgICAgICAgICAgICAgICBtYXRUb29sdGlwUG9zaXRpb249XCJhYm92ZVwiXHJcbiAgICAgICAgICAgICAgICAgID5kb25lPC9tYXQtaWNvbj5cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgPGRpdiAqbmdJZj1cImhvdmVyZWRNZXNzYWdlSWQgPT09IG1zZy5tZXNzYWdlX2lkICYmICFpc0RlbGV0ZWRNZXNzYWdlKG1zZylcIiBjbGFzcz1cInF1aWNrLXJlYWN0aW9uc1wiPlxyXG4gICAgICAgICAgICAgICAgICA8YnV0dG9uXHJcbiAgICAgICAgICAgICAgICAgICAgKm5nRm9yPVwibGV0IGVtb2ppIG9mIHF1aWNrRW1vamlzXCJcclxuICAgICAgICAgICAgICAgICAgICBjbGFzcz1cInF1aWNrLWVtb2ppLWJ0blwiXHJcbiAgICAgICAgICAgICAgICAgICAgKGNsaWNrKT1cIm9uRW1vamlTZWxlY3RlZChlbW9qaSwgbXNnLm1lc3NhZ2VfaWQpXCJcclxuICAgICAgICAgICAgICAgICAgICBbYXR0ci5hcmlhLWxhYmVsXT1cIidSZWFjdCB3aXRoICcgKyBlbW9qaVwiXHJcbiAgICAgICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgICAgICB7eyBlbW9qaSB9fVxyXG4gICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgPGRpdiAqbmdJZj1cIiFpc0RlbGV0ZWRNZXNzYWdlKG1zZykgJiYgbXNnLnJlYWN0aW9ucyAmJiBtc2cucmVhY3Rpb25zLmxlbmd0aCA+IDBcIiBjbGFzcz1cInJlYWN0aW9ucy1yb3dcIj5cclxuICAgICAgICAgICAgICAgICAgPGJ1dHRvbiBcclxuICAgICAgICAgICAgICAgICAgICAqbmdGb3I9XCJsZXQgciBvZiBtc2cucmVhY3Rpb25zXCIgXHJcbiAgICAgICAgICAgICAgICAgICAgY2xhc3M9XCJyZWFjdGlvbi1jaGlwXCJcclxuICAgICAgICAgICAgICAgICAgICAoY2xpY2spPVwidG9nZ2xlUmVhY3Rpb24oci5lbW9qaSwgbXNnLm1lc3NhZ2VfaWQpXCJcclxuICAgICAgICAgICAgICAgICAgICBbY2xhc3Mub3duLXJlYWN0aW9uXT1cInIuaGFzUmVhY3RlZFwiXHJcbiAgICAgICAgICAgICAgICAgICAgW21hdFRvb2x0aXBdPVwiZ2V0UmVhY3RvclRvb2x0aXAocilcIlxyXG4gICAgICAgICAgICAgICAgICAgIG1hdFRvb2x0aXBQb3NpdGlvbj1cImFib3ZlXCJcclxuICAgICAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwicmVhY3Rpb24tZW1vamlcIj57eyByLmVtb2ppIH19PC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwicmVhY3Rpb24tY291bnRcIj57eyByLmNvdW50IH19PC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICA8L25nLXRlbXBsYXRlPlxyXG4gICAgICAgICAgPC9uZy1jb250YWluZXI+XHJcbiAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgIDxkaXYgKm5nSWY9XCIhaXNSZW1vdmVkRnJvbUdyb3VwICYmIG1lc3NhZ2VzLmxlbmd0aCA9PT0gMCAmJiAhbG9hZGluZ1wiIGNsYXNzPVwiZW1wdHktY2hhdFwiPlxyXG4gICAgICAgICAgPG1hdC1pY29uPmNoYXRfYnViYmxlX291dGxpbmU8L21hdC1pY29uPlxyXG4gICAgICAgICAgPHA+Tm8gbWVzc2FnZXMgeWV0LiBTYXkgaGVsbG8hPC9wPlxyXG4gICAgICAgIDwvZGl2PlxyXG4gICAgICA8L2Rpdj5cclxuXHJcbiAgICAgIDxkaXZcclxuICAgICAgICAqbmdJZj1cIm1lc3NhZ2VDb250ZXh0TWVudSBhcyBtZW51XCJcclxuICAgICAgICBjbGFzcz1cIm1lc3NhZ2UtY29udGV4dC1tZW51XCJcclxuICAgICAgICBbc3R5bGUubGVmdC5weF09XCJtZW51LnhcIlxyXG4gICAgICAgIFtzdHlsZS50b3AucHhdPVwibWVudS55XCJcclxuICAgICAgICAoY2xpY2spPVwiJGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpXCJcclxuICAgICAgICAoY29udGV4dG1lbnUpPVwiJGV2ZW50LnByZXZlbnREZWZhdWx0KClcIlxyXG4gICAgICA+XHJcbiAgICAgICAgPG5nLWNvbnRhaW5lciAqbmdJZj1cIiFtZW51LmNvbmZpcm1EZWxldGU7IGVsc2UgZGVsZXRlQ29uZmlybU1lbnVcIj5cclxuICAgICAgICAgIDxidXR0b25cclxuICAgICAgICAgICAgKm5nSWY9XCJjYW5SZXBseU1lc3NhZ2UobWVudS5tZXNzYWdlKVwiXHJcbiAgICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxyXG4gICAgICAgICAgICBjbGFzcz1cImNvbnRleHQtbWVudS1pdGVtXCJcclxuICAgICAgICAgICAgKGNsaWNrKT1cInJlcGx5RnJvbUNvbnRleHRNZW51KClcIlxyXG4gICAgICAgICAgPlxyXG4gICAgICAgICAgICA8bWF0LWljb24+cmVwbHk8L21hdC1pY29uPlxyXG4gICAgICAgICAgICA8c3Bhbj5SZXBseTwvc3Bhbj5cclxuICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgICAqbmdJZj1cImNhbkVkaXRNZXNzYWdlKG1lbnUubWVzc2FnZSlcIlxyXG4gICAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcclxuICAgICAgICAgICAgY2xhc3M9XCJjb250ZXh0LW1lbnUtaXRlbVwiXHJcbiAgICAgICAgICAgIChjbGljayk9XCJlZGl0RnJvbUNvbnRleHRNZW51KClcIlxyXG4gICAgICAgICAgPlxyXG4gICAgICAgICAgICA8bWF0LWljb24+ZWRpdDwvbWF0LWljb24+XHJcbiAgICAgICAgICAgIDxzcGFuPkVkaXQ8L3NwYW4+XHJcbiAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgIDxidXR0b25cclxuICAgICAgICAgICAgKm5nSWY9XCJjYW5EZWxldGVNZXNzYWdlKG1lbnUubWVzc2FnZSlcIlxyXG4gICAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcclxuICAgICAgICAgICAgY2xhc3M9XCJjb250ZXh0LW1lbnUtaXRlbSBkYW5nZXJcIlxyXG4gICAgICAgICAgICAoY2xpY2spPVwicmVxdWVzdERlbGV0ZUZyb21Db250ZXh0TWVudSgpXCJcclxuICAgICAgICAgID5cclxuICAgICAgICAgICAgPG1hdC1pY29uPmRlbGV0ZTwvbWF0LWljb24+XHJcbiAgICAgICAgICAgIDxzcGFuPkRlbGV0ZTwvc3Bhbj5cclxuICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgIDwvbmctY29udGFpbmVyPlxyXG4gICAgICAgIDxuZy10ZW1wbGF0ZSAjZGVsZXRlQ29uZmlybU1lbnU+XHJcbiAgICAgICAgICA8ZGl2IGNsYXNzPVwiY29udGV4dC1tZW51LWNvbmZpcm1cIj5cclxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cImNvbmZpcm0tdGl0bGVcIj5EZWxldGUgdGhpcyBtZXNzYWdlPzwvZGl2PlxyXG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwiY29uZmlybS1hY3Rpb25zXCI+XHJcbiAgICAgICAgICAgICAgPGJ1dHRvbiB0eXBlPVwiYnV0dG9uXCIgY2xhc3M9XCJjb25maXJtLWNhbmNlbFwiIChjbGljayk9XCJjbG9zZU1lc3NhZ2VDb250ZXh0TWVudSgpXCI+Q2FuY2VsPC9idXR0b24+XHJcbiAgICAgICAgICAgICAgPGJ1dHRvbiB0eXBlPVwiYnV0dG9uXCIgY2xhc3M9XCJjb25maXJtLWRlbGV0ZVwiIChjbGljayk9XCJjb25maXJtRGVsZXRlRnJvbUNvbnRleHRNZW51KClcIj5EZWxldGU8L2J1dHRvbj5cclxuICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICA8L25nLXRlbXBsYXRlPlxyXG4gICAgICA8L2Rpdj5cclxuXHJcbiAgICAgIDxhcHAtbWVzc2FnZS1pbnB1dFxyXG4gICAgICAgICpuZ0lmPVwiIWlzUmVtb3ZlZEZyb21Hcm91cFwiXHJcbiAgICAgICAgW2NvbnZlcnNhdGlvbklkXT1cImNvbnZlcnNhdGlvbklkXCJcclxuICAgICAgICBbcmVwbHlUb109XCJyZXBseVRvTWVzc2FnZSA/IGdldENvbXBvc2VSZXBseVByZXZpZXcocmVwbHlUb01lc3NhZ2UpIDogbnVsbFwiXHJcbiAgICAgICAgW2VuYWJsZU1lbnRpb25zXT1cImlzR3JvdXBcIlxyXG4gICAgICAgIFttZW50aW9uT3B0aW9uc109XCJtZW50aW9uT3B0aW9uc1wiXHJcbiAgICAgICAgKG1lc3NhZ2VTZW50KT1cIm9uU2VuZE1lc3NhZ2UoJGV2ZW50KVwiXHJcbiAgICAgICAgKG1lc3NhZ2VXaXRoRmlsZXMpPVwib25TZW5kV2l0aEZpbGVzKCRldmVudClcIlxyXG4gICAgICAgIChyZXBseUNhbmNlbGxlZCk9XCJjbGVhclJlcGx5KClcIlxyXG4gICAgICA+PC9hcHAtbWVzc2FnZS1pbnB1dD5cclxuICAgIDwvZGl2PlxyXG5cclxuICBgLFxyXG4gIHN0eWxlczogW2BcclxuICAgIDpob3N0IHtcclxuICAgICAgLS1hdHRhY2htZW50LXRodW1iLXNpemU6IDE4MHB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5jaGF0LXRocmVhZCB7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XHJcbiAgICAgIGhlaWdodDogMTAwJTtcclxuICAgICAgYmFja2dyb3VuZDogIzA0MTMyMjtcclxuICAgICAgcG9zaXRpb246IHJlbGF0aXZlO1xyXG4gICAgICBjb250YWluZXItdHlwZTogaW5saW5lLXNpemU7XHJcbiAgICAgIC0tYXR0YWNobWVudC10aHVtYi1zaXplOiBjbGFtcCgxMjBweCwgNDhjcXcsIDE4MHB4KTtcclxuICAgIH1cclxuXHJcbiAgICAuY2hhdC10aHJlYWQuZHJhZy1vdmVyIHtcclxuICAgICAgb3V0bGluZTogMnB4IGRhc2hlZCByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNDUpO1xyXG4gICAgICBvdXRsaW5lLW9mZnNldDogLTZweDtcclxuICAgIH1cclxuXHJcbiAgICAudGhyZWFkLWRyYWctb3ZlcmxheSB7XHJcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcclxuICAgICAgaW5zZXQ6IDhweDtcclxuICAgICAgei1pbmRleDogMjA7XHJcbiAgICAgIHBvaW50ZXItZXZlbnRzOiBub25lO1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcclxuICAgICAgZ2FwOiA4cHg7XHJcbiAgICAgIGNvbG9yOiAjZmZmO1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDMxLCA3NSwgMjE2LCAwLjMyKTtcclxuICAgICAgYm9yZGVyOiAycHggZGFzaGVkIHJnYmEoMjU1LCAyNTUsIDI1NSwgMC41NSk7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDE0cHg7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTRweDtcclxuICAgICAgZm9udC13ZWlnaHQ6IDYwMDtcclxuICAgIH1cclxuXHJcbiAgICAudGhyZWFkLWRyYWctb3ZlcmxheSBtYXQtaWNvbiB7XHJcbiAgICAgIGZvbnQtc2l6ZTogMzZweDtcclxuICAgICAgd2lkdGg6IDM2cHg7XHJcbiAgICAgIGhlaWdodDogMzZweDtcclxuICAgIH1cclxuXHJcbiAgICAuY2hhdC1oZWFkZXIge1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBwYWRkaW5nOiA4cHggOHB4IDhweCA0cHg7XHJcbiAgICAgIGJvcmRlci1ib3R0b206IDFweCBzb2xpZCByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMTUpO1xyXG4gICAgICBnYXA6IDRweDtcclxuICAgICAgZmxleC1zaHJpbms6IDA7XHJcbiAgICB9XHJcblxyXG4gICAgLmNoYXQtaGVhZGVyIGJ1dHRvbiBtYXQtaWNvbiB7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuOCk7XHJcbiAgICB9XHJcblxyXG4gICAgLmNoYXQtbmFtZSB7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTZweDtcclxuICAgICAgZm9udC13ZWlnaHQ6IDYwMDtcclxuICAgICAgY29sb3I6ICNmZmY7XHJcbiAgICB9XHJcblxyXG4gICAgLmhlYWRlci1pbmZvIHtcclxuICAgICAgZmxleDogMTtcclxuICAgICAgd2hpdGUtc3BhY2U6IG5vd3JhcDtcclxuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcclxuICAgICAgdGV4dC1vdmVyZmxvdzogZWxsaXBzaXM7XHJcbiAgICAgIGRpc3BsYXk6IGJsb2NrO1xyXG4gICAgICBwYWRkaW5nOiAwIDRweDtcclxuICAgIH1cclxuXHJcbiAgICAuaGVhZGVyLWFjdGlvbnMge1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBnYXA6IDA7XHJcbiAgICB9XHJcblxyXG4gICAgLmhlYWRlci1hY3Rpb25zIGJ1dHRvbiB7XHJcbiAgICAgIHdpZHRoOiAzMnB4O1xyXG4gICAgICBoZWlnaHQ6IDMycHg7XHJcbiAgICAgIG1pbi13aWR0aDogMzJweCAhaW1wb3J0YW50O1xyXG4gICAgICBwYWRkaW5nOiAwICFpbXBvcnRhbnQ7XHJcbiAgICAgIGRpc3BsYXk6IGlubGluZS1mbGV4ICFpbXBvcnRhbnQ7XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXIgIWltcG9ydGFudDtcclxuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXIgIWltcG9ydGFudDtcclxuICAgICAgLS1tZGMtaWNvbi1idXR0b24tc3RhdGUtbGF5ZXItc2l6ZTogMzJweDtcclxuICAgIH1cclxuXHJcbiAgICAuaGRyLWJ0biB7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDZweCAhaW1wb3J0YW50O1xyXG4gICAgICB0cmFuc2l0aW9uOiBiYWNrZ3JvdW5kIDAuMTVzLCBib3gtc2hhZG93IDAuMTVzO1xyXG4gICAgfVxyXG5cclxuICAgIC5oZHItYnRuOmhvdmVyIHtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjE1KSAhaW1wb3J0YW50O1xyXG4gICAgICBib3gtc2hhZG93OiAwIDJweCA4cHggcmdiYSgwLCAwLCAwLCAwLjIpO1xyXG4gICAgfVxyXG5cclxuICAgIC5oZHItYnRuIG1hdC1pY29uIHtcclxuICAgICAgZm9udC1zaXplOiAyMHB4O1xyXG4gICAgICB3aWR0aDogMjBweDtcclxuICAgICAgaGVpZ2h0OiAyMHB4O1xyXG4gICAgICBsaW5lLWhlaWdodDogMjBweDtcclxuICAgICAgbWFyZ2luOiAwO1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcclxuICAgIH1cclxuXHJcbiAgICA6aG9zdCA6Om5nLWRlZXAgLmhkci1idG4gLm1hdC1tZGMtYnV0dG9uLXRvdWNoLXRhcmdldCB7XHJcbiAgICAgIHdpZHRoOiAzMnB4ICFpbXBvcnRhbnQ7XHJcbiAgICAgIGhlaWdodDogMzJweCAhaW1wb3J0YW50O1xyXG4gICAgfVxyXG5cclxuICAgIC5tZXNzYWdlcy1hcmVhIHtcclxuICAgICAgZmxleDogMTtcclxuICAgICAgb3ZlcmZsb3cteTogYXV0bztcclxuICAgICAgcGFkZGluZzogMTJweDtcclxuICAgICAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQ7XHJcbiAgICAgIHNjcm9sbGJhci13aWR0aDogbm9uZTtcclxuICAgICAgLW1zLW92ZXJmbG93LXN0eWxlOiBub25lO1xyXG4gICAgfVxyXG5cclxuICAgIC5tZXNzYWdlcy1hcmVhOjotd2Via2l0LXNjcm9sbGJhciB7XHJcbiAgICAgIGRpc3BsYXk6IG5vbmU7XHJcbiAgICB9XHJcblxyXG4gICAgLmxvYWRpbmctaW5kaWNhdG9yIHtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XHJcbiAgICAgIGdhcDogOHB4O1xyXG4gICAgICBwYWRkaW5nOiAxMnB4O1xyXG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjcpO1xyXG4gICAgICBmb250LXNpemU6IDEzcHg7XHJcbiAgICB9XHJcblxyXG4gICAgLnJlbW92ZWQtZ3JvdXAtc3RhdGUge1xyXG4gICAgICBoZWlnaHQ6IDEwMCU7XHJcbiAgICAgIG1pbi1oZWlnaHQ6IDI2MHB4O1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcclxuICAgICAgdGV4dC1hbGlnbjogY2VudGVyO1xyXG4gICAgICBnYXA6IDEwcHg7XHJcbiAgICAgIHBhZGRpbmc6IDMycHggMjRweDtcclxuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC43OCk7XHJcbiAgICAgIGJveC1zaXppbmc6IGJvcmRlci1ib3g7XHJcbiAgICB9XHJcblxyXG4gICAgLnJlbW92ZWQtZ3JvdXAtc3RhdGUgbWF0LWljb24ge1xyXG4gICAgICB3aWR0aDogNDRweDtcclxuICAgICAgaGVpZ2h0OiA0NHB4O1xyXG4gICAgICBmb250LXNpemU6IDQ0cHg7XHJcbiAgICAgIGNvbG9yOiAjZjg3MTcxO1xyXG4gICAgICBtYXJnaW4tYm90dG9tOiA0cHg7XHJcbiAgICB9XHJcblxyXG4gICAgLnJlbW92ZWQtZ3JvdXAtc3RhdGUgaDQge1xyXG4gICAgICBtYXJnaW46IDA7XHJcbiAgICAgIGNvbG9yOiAjZmZmO1xyXG4gICAgICBmb250LXNpemU6IDE3cHg7XHJcbiAgICAgIGZvbnQtd2VpZ2h0OiA3MDA7XHJcbiAgICB9XHJcblxyXG4gICAgLnJlbW92ZWQtZ3JvdXAtc3RhdGUgcCB7XHJcbiAgICAgIG1hcmdpbjogMCAwIDhweDtcclxuICAgICAgbWF4LXdpZHRoOiAyODBweDtcclxuICAgICAgZm9udC1zaXplOiAxM3B4O1xyXG4gICAgICBsaW5lLWhlaWdodDogMS40O1xyXG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjYyKTtcclxuICAgIH1cclxuXHJcbiAgICAucmVtb3ZlZC1leGl0LWJ0biB7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDEwcHg7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xOCkgIWltcG9ydGFudDtcclxuICAgICAgY29sb3I6ICNmZmYgIWltcG9ydGFudDtcclxuICAgICAgZm9udC13ZWlnaHQ6IDcwMDtcclxuICAgICAgcGFkZGluZzogMCAxOHB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5sb2FkLW1vcmUtYnRuIHtcclxuICAgICAgYWxpZ24tc2VsZjogY2VudGVyO1xyXG4gICAgICBtYXJnaW4tYm90dG9tOiAxNnB4O1xyXG4gICAgICBmb250LXNpemU6IDEycHg7XHJcbiAgICAgIGNvbG9yOiAjZmZmO1xyXG4gICAgfVxyXG5cclxuICAgIC5tZXNzYWdlcy1saXN0IHtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcclxuICAgICAgZ2FwOiAxcHg7XHJcbiAgICAgIGZsZXg6IDE7XHJcbiAgICB9XHJcblxyXG4gICAgLmRhdGUtc2VwYXJhdG9yIHtcclxuICAgICAgdGV4dC1hbGlnbjogY2VudGVyO1xyXG4gICAgICBtYXJnaW46IDE2cHggMCA4cHg7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTJweDtcclxuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC43KTtcclxuICAgICAgZm9udC13ZWlnaHQ6IDUwMDtcclxuICAgIH1cclxuXHJcbiAgICAubWVzc2FnZS1idWJibGUtcm93IHtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcclxuICAgICAgbWF4LXdpZHRoOiA4OCU7XHJcbiAgICAgIG1hcmdpbi1ib3R0b206IDJweDtcclxuICAgIH1cclxuXHJcbiAgICAubWVzc2FnZS1idWJibGUtcm93Lm93biB7XHJcbiAgICAgIGFsaWduLXNlbGY6IGZsZXgtZW5kO1xyXG4gICAgICBhbGlnbi1pdGVtczogZmxleC1lbmQ7XHJcbiAgICB9XHJcblxyXG4gICAgLm1lc3NhZ2UtYnViYmxlLXJvdy5vdGhlciB7XHJcbiAgICAgIGFsaWduLXNlbGY6IGZsZXgtc3RhcnQ7XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBmbGV4LXN0YXJ0O1xyXG4gICAgfVxyXG5cclxuICAgIC5zZW5kZXItbmFtZSB7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTFweDtcclxuICAgICAgZm9udC13ZWlnaHQ6IDcwMDtcclxuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC45NSk7XHJcbiAgICAgIG1hcmdpbi1ib3R0b206IDNweDtcclxuICAgICAgbGV0dGVyLXNwYWNpbmc6IDAuMnB4O1xyXG4gICAgICBwYWRkaW5nOiAwIDEwcHg7XHJcbiAgICAgIHRleHQtc2hhZG93OiAwIDFweCAzcHggcmdiYSgwLCAwLCAwLCAwLjQpO1xyXG4gICAgfVxyXG5cclxuICAgIC5zeXN0ZW0tbWVzc2FnZS1yb3cge1xyXG4gICAgICBhbGlnbi1zZWxmOiBjZW50ZXI7XHJcbiAgICAgIG1heC13aWR0aDogODglO1xyXG4gICAgICBtYXJnaW46IDhweCBhdXRvO1xyXG4gICAgICB0ZXh0LWFsaWduOiBjZW50ZXI7XHJcbiAgICB9XHJcblxyXG4gICAgLnN5c3RlbS1tZXNzYWdlLXRleHQge1xyXG4gICAgICBkaXNwbGF5OiBpbmxpbmUtZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XHJcbiAgICAgIHBhZGRpbmc6IDVweCAxMXB4O1xyXG4gICAgICBib3JkZXItcmFkaXVzOiA5OTlweDtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjA5KTtcclxuICAgICAgYm9yZGVyOiAxcHggc29saWQgcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjEyKTtcclxuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC43Mik7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTFweDtcclxuICAgICAgbGluZS1oZWlnaHQ6IDEuMzU7XHJcbiAgICB9XHJcblxyXG4gICAgLm1lc3NhZ2UtYnViYmxlIHtcclxuICAgICAgcGFkZGluZzogOHB4IDE0cHggN3B4O1xyXG4gICAgICBib3JkZXItcmFkaXVzOiAxNHB4O1xyXG4gICAgICBmb250LXNpemU6IGNhbGMoY2xhbXAoMTFweCwgMy40Y3F3LCAxM3B4KSAqIHZhcigtLW1lc3NhZ2UtdGV4dC1zY2FsZSwgMSkpO1xyXG4gICAgICBsaW5lLWhlaWdodDogMS4zMjtcclxuICAgICAgd29yZC1icmVhazogYnJlYWstd29yZDtcclxuICAgICAgY29sb3I6ICNmNWY3ZmY7XHJcbiAgICAgIHBvc2l0aW9uOiByZWxhdGl2ZTtcclxuICAgICAgZGlzcGxheTogaW5saW5lLWJsb2NrO1xyXG4gICAgICBtaW4td2lkdGg6IGZpdC1jb250ZW50O1xyXG4gICAgfVxyXG5cclxuICAgIC5tZXNzYWdlLWJ1YmJsZS1yb3cub3RoZXIgLm1lc3NhZ2UtYnViYmxlIHtcclxuICAgICAgYmFja2dyb3VuZDogIzBkMjU0MDtcclxuICAgICAgYm9yZGVyLWJvdHRvbS1sZWZ0LXJhZGl1czogNXB4O1xyXG4gICAgICBib3gtc2hhZG93OiAwIDFweCA0cHggcmdiYSgwLCAwLCAwLCAwLjQpO1xyXG4gICAgfVxyXG5cclxuICAgIC5tZXNzYWdlLWJ1YmJsZS5vd24tYnViYmxlIHtcclxuICAgICAgYmFja2dyb3VuZDogIzBhM2Q2MjtcclxuICAgICAgYm9yZGVyLWJvdHRvbS1yaWdodC1yYWRpdXM6IDVweDtcclxuICAgICAgYm94LXNoYWRvdzogMCAxcHggNHB4IHJnYmEoMCwgMCwgMCwgMC40KTtcclxuICAgIH1cclxuXHJcbiAgICAucmVwbHktY29udGV4dCB7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgIGdhcDogN3B4O1xyXG4gICAgICBtYXJnaW4tYm90dG9tOiA3cHg7XHJcbiAgICAgIHBhZGRpbmc6IDdweCA5cHg7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDEwcHg7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4wOCk7XHJcbiAgICAgIGJvcmRlci1sZWZ0OiAzcHggc29saWQgcmdiYSgxMjcsIDE4MCwgMjU1LCAwLjc4KTtcclxuICAgICAgbWF4LXdpZHRoOiBtaW4oNjhjcXcsIDQyMHB4KTtcclxuICAgIH1cclxuXHJcbiAgICAucmVwbHktY29udGV4dCBtYXQtaWNvbiB7XHJcbiAgICAgIGNvbG9yOiAjYmZkYmZlO1xyXG4gICAgICBmb250LXNpemU6IDE2cHg7XHJcbiAgICAgIHdpZHRoOiAxNnB4O1xyXG4gICAgICBoZWlnaHQ6IDE2cHg7XHJcbiAgICAgIGZsZXgtc2hyaW5rOiAwO1xyXG4gICAgfVxyXG5cclxuICAgIC5yZXBseS1jb250ZXh0IGRpdiB7XHJcbiAgICAgIG1pbi13aWR0aDogMDtcclxuICAgIH1cclxuXHJcbiAgICAucmVwbHktY29udGV4dCBzcGFuIHtcclxuICAgICAgZGlzcGxheTogYmxvY2s7XHJcbiAgICAgIGNvbG9yOiAjYmZkYmZlO1xyXG4gICAgICBmb250LXNpemU6IDExcHg7XHJcbiAgICAgIGZvbnQtd2VpZ2h0OiA3MDA7XHJcbiAgICAgIG1hcmdpbi1ib3R0b206IDJweDtcclxuICAgIH1cclxuXHJcbiAgICAucmVwbHktY29udGV4dCBwIHtcclxuICAgICAgbWFyZ2luOiAwO1xyXG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjc4KTtcclxuICAgICAgZm9udC1zaXplOiAxMnB4O1xyXG4gICAgICB3aGl0ZS1zcGFjZTogbm93cmFwO1xyXG4gICAgICBvdmVyZmxvdzogaGlkZGVuO1xyXG4gICAgICB0ZXh0LW92ZXJmbG93OiBlbGxpcHNpcztcclxuICAgIH1cclxuXHJcbiAgICAudGV4dC1jb250ZW50IHtcclxuICAgICAgd2hpdGUtc3BhY2U6IHByZS13cmFwO1xyXG4gICAgICB0YWItc2l6ZTogNDtcclxuICAgIH1cclxuXHJcbiAgICAudGV4dC1jb250ZW50LnByZWZvcm1hdHRlZC10ZXh0IHtcclxuICAgICAgZm9udC1mYW1pbHk6IHVpLW1vbm9zcGFjZSwgU0ZNb25vLVJlZ3VsYXIsIE1lbmxvLCBNb25hY28sIENvbnNvbGFzLCBcIkxpYmVyYXRpb24gTW9ub1wiLCBtb25vc3BhY2U7XHJcbiAgICAgIGZvbnQtc2l6ZTogY2FsYyhjbGFtcCgxMHB4LCAzLjFjcXcsIDEycHgpICogdmFyKC0tY29kZS10ZXh0LXNjYWxlLCAxKSk7XHJcbiAgICAgIGxpbmUtaGVpZ2h0OiAxLjQ1O1xyXG4gICAgICBvdmVyZmxvdy14OiBhdXRvO1xyXG4gICAgICBtYXgtd2lkdGg6IG1pbig3MmNxdywgNTIwcHgpO1xyXG4gICAgICBzY3JvbGxiYXItd2lkdGg6IG5vbmU7XHJcbiAgICAgIC1tcy1vdmVyZmxvdy1zdHlsZTogbm9uZTtcclxuICAgIH1cclxuXHJcbiAgICAudGV4dC1jb250ZW50LnByZWZvcm1hdHRlZC10ZXh0Ojotd2Via2l0LXNjcm9sbGJhciB7XHJcbiAgICAgIGRpc3BsYXk6IG5vbmU7XHJcbiAgICB9XHJcblxyXG4gICAgLmlubGluZS1lZGl0LXdyYXAge1xyXG4gICAgICB3aWR0aDogbWluKDc2Y3F3LCA1MjBweCk7XHJcbiAgICAgIG1pbi13aWR0aDogbWluKDU2Y3F3LCAyNjBweCk7XHJcbiAgICB9XHJcblxyXG4gICAgLmlubGluZS1lZGl0LXRleHRhcmVhIHtcclxuICAgICAgd2lkdGg6IDEwMCU7XHJcbiAgICAgIG1pbi1oZWlnaHQ6IDcycHg7XHJcbiAgICAgIG1heC1oZWlnaHQ6IDIyMHB4O1xyXG4gICAgICBib3gtc2l6aW5nOiBib3JkZXItYm94O1xyXG4gICAgICBib3JkZXI6IDFweCBzb2xpZCByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMjgpO1xyXG4gICAgICBib3JkZXItcmFkaXVzOiAxMHB4O1xyXG4gICAgICBvdXRsaW5lOiBub25lO1xyXG4gICAgICByZXNpemU6IHZlcnRpY2FsO1xyXG4gICAgICBwYWRkaW5nOiA5cHggMTBweDtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjEpO1xyXG4gICAgICBjb2xvcjogI2ZmZjtcclxuICAgICAgZm9udDogaW5oZXJpdDtcclxuICAgICAgbGluZS1oZWlnaHQ6IDEuMzU7XHJcbiAgICAgIHdoaXRlLXNwYWNlOiBwcmUtd3JhcDtcclxuICAgIH1cclxuXHJcbiAgICAuaW5saW5lLWVkaXQtdGV4dGFyZWE6Zm9jdXMge1xyXG4gICAgICBib3JkZXItY29sb3I6IHJnYmEoMTkxLCAyMTksIDI1NCwgMC45KTtcclxuICAgICAgYm94LXNoYWRvdzogMCAwIDAgMnB4IHJnYmEoMTI3LCAxODAsIDI1NSwgMC4xOCk7XHJcbiAgICB9XHJcblxyXG4gICAgLmlubGluZS1lZGl0LWFjdGlvbnMge1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGZsZXgtZW5kO1xyXG4gICAgICBnYXA6IDhweDtcclxuICAgICAgbWFyZ2luLXRvcDogOHB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5pbmxpbmUtZWRpdC1jYW5jZWwsXHJcbiAgICAuaW5saW5lLWVkaXQtc2F2ZSB7XHJcbiAgICAgIGJvcmRlcjogMDtcclxuICAgICAgYm9yZGVyLXJhZGl1czogOHB4O1xyXG4gICAgICBwYWRkaW5nOiA2cHggMTBweDtcclxuICAgICAgY29sb3I6ICNmOGZhZmM7XHJcbiAgICAgIGN1cnNvcjogcG9pbnRlcjtcclxuICAgICAgZm9udC1zaXplOiAxMnB4O1xyXG4gICAgICBmb250LXdlaWdodDogNzAwO1xyXG4gICAgfVxyXG5cclxuICAgIC5pbmxpbmUtZWRpdC1jYW5jZWwge1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMTIpO1xyXG4gICAgfVxyXG5cclxuICAgIC5pbmxpbmUtZWRpdC1zYXZlIHtcclxuICAgICAgYmFja2dyb3VuZDogIzI1NjNlYjtcclxuICAgIH1cclxuXHJcbiAgICAuaW5saW5lLWVkaXQtc2F2ZTpkaXNhYmxlZCB7XHJcbiAgICAgIGN1cnNvcjogbm90LWFsbG93ZWQ7XHJcbiAgICAgIG9wYWNpdHk6IDAuNDU7XHJcbiAgICB9XHJcblxyXG4gICAgLmF0dGFjaG1lbnQtY2FwdGlvbiB7XHJcbiAgICAgIG1hcmdpbi10b3A6IDhweDtcclxuICAgICAgd2lkdGg6IHZhcigtLWF0dGFjaG1lbnQtdGh1bWItc2l6ZSk7XHJcbiAgICAgIG1heC13aWR0aDogdmFyKC0tYXR0YWNobWVudC10aHVtYi1zaXplKTtcclxuICAgICAgYm94LXNpemluZzogYm9yZGVyLWJveDtcclxuICAgIH1cclxuXHJcbiAgICAuYXR0YWNobWVudC1jYXB0aW9uIC50ZXh0LWNvbnRlbnQge1xyXG4gICAgICB3aGl0ZS1zcGFjZTogcHJlLXdyYXA7XHJcbiAgICAgIG92ZXJmbG93LXdyYXA6IGFueXdoZXJlO1xyXG4gICAgICBtYXgtd2lkdGg6IDEwMCU7XHJcbiAgICB9XHJcblxyXG4gICAgLmF0dGFjaG1lbnQtcmVuZGVyLWJsb2NrIHtcclxuICAgICAgd2lkdGg6IDEwMCU7XHJcbiAgICAgIG1heC13aWR0aDogMTAwJTtcclxuICAgIH1cclxuXHJcbiAgICAuY29kZS1tZXNzYWdlLXdyYXAge1xyXG4gICAgICBwb3NpdGlvbjogcmVsYXRpdmU7XHJcbiAgICAgIG1heC13aWR0aDogbWluKDc2Y3F3LCA1NjBweCk7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDEwcHg7XHJcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XHJcbiAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xNCk7XHJcbiAgICAgIGJhY2tncm91bmQ6ICMwNjE4Mjc7XHJcbiAgICB9XHJcblxyXG4gICAgLnJlbmRlci1jb3B5LWJ0biB7XHJcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcclxuICAgICAgdG9wOiA2cHg7XHJcbiAgICAgIHJpZ2h0OiA2cHg7XHJcbiAgICAgIHotaW5kZXg6IDI7XHJcbiAgICAgIHdpZHRoOiAyNnB4O1xyXG4gICAgICBoZWlnaHQ6IDI2cHg7XHJcbiAgICAgIGJvcmRlcjogbm9uZTtcclxuICAgICAgYm9yZGVyLXJhZGl1czogN3B4O1xyXG4gICAgICBkaXNwbGF5OiBpbmxpbmUtZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XHJcbiAgICAgIHBhZGRpbmc6IDA7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoNywgMjksIDQ4LCAwLjgyKTtcclxuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC43OCk7XHJcbiAgICAgIGN1cnNvcjogcG9pbnRlcjtcclxuICAgICAgb3BhY2l0eTogMDtcclxuICAgICAgdHJhbnNpdGlvbjogb3BhY2l0eSAwLjEycywgYmFja2dyb3VuZCAwLjEycywgY29sb3IgMC4xMnM7XHJcbiAgICB9XHJcblxyXG4gICAgLmNvZGUtbWVzc2FnZS13cmFwOmhvdmVyIC5yZW5kZXItY29weS1idG4sXHJcbiAgICAudGFibGUtbWVzc2FnZS13cmFwOmhvdmVyIC5yZW5kZXItY29weS1idG4sXHJcbiAgICAubWQtbWVzc2FnZS13cmFwOmhvdmVyIC5yZW5kZXItY29weS1idG4sXHJcbiAgICAucmVuZGVyLWNvcHktYnRuOmZvY3VzIHtcclxuICAgICAgb3BhY2l0eTogMTtcclxuICAgIH1cclxuXHJcbiAgICAucmVuZGVyLWNvcHktYnRuOmhvdmVyIHtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgxMjcsIDE4MCwgMjU1LCAwLjIyKTtcclxuICAgICAgY29sb3I6ICNmZmY7XHJcbiAgICB9XHJcblxyXG4gICAgLnJlbmRlci1jb3B5LWJ0biBtYXQtaWNvbiB7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTZweDtcclxuICAgICAgd2lkdGg6IDE2cHg7XHJcbiAgICAgIGhlaWdodDogMTZweDtcclxuICAgICAgbGluZS1oZWlnaHQ6IDE2cHg7XHJcbiAgICB9XHJcblxyXG4gICAgLmNvZGUtbWVzc2FnZSB7XHJcbiAgICAgIG1hcmdpbjogMDtcclxuICAgICAgcGFkZGluZzogMTJweCA0MnB4IDI4cHggMTJweDtcclxuICAgICAgb3ZlcmZsb3cteDogYXV0bztcclxuICAgICAgY29sb3I6ICNkYmVhZmU7XHJcbiAgICAgIGZvbnQtZmFtaWx5OiB1aS1tb25vc3BhY2UsIFNGTW9uby1SZWd1bGFyLCBNZW5sbywgTW9uYWNvLCBDb25zb2xhcywgXCJMaWJlcmF0aW9uIE1vbm9cIiwgbW9ub3NwYWNlO1xyXG4gICAgICBmb250LXNpemU6IGNhbGMoY2xhbXAoMTBweCwgMy4xY3F3LCAxMnB4KSAqIHZhcigtLWNvZGUtdGV4dC1zY2FsZSwgMSkpO1xyXG4gICAgICBsaW5lLWhlaWdodDogMS40NTtcclxuICAgICAgd2hpdGUtc3BhY2U6IHByZTtcclxuICAgICAgdGFiLXNpemU6IDI7XHJcbiAgICAgIHNjcm9sbGJhci13aWR0aDogbm9uZTtcclxuICAgICAgLW1zLW92ZXJmbG93LXN0eWxlOiBub25lO1xyXG4gICAgfVxyXG5cclxuICAgIC5jb2RlLW1lc3NhZ2U6Oi13ZWJraXQtc2Nyb2xsYmFyIHtcclxuICAgICAgZGlzcGxheTogbm9uZTtcclxuICAgIH1cclxuXHJcbiAgICAuY29kZS1sYW5ndWFnZSB7XHJcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcclxuICAgICAgcmlnaHQ6IDhweDtcclxuICAgICAgYm90dG9tOiA2cHg7XHJcbiAgICAgIHBhZGRpbmc6IDJweCA3cHg7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDk5OXB4O1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDEyNywgMTgwLCAyNTUsIDAuMTYpO1xyXG4gICAgICBjb2xvcjogI2JmZGJmZTtcclxuICAgICAgZm9udC1zaXplOiAxMHB4O1xyXG4gICAgICBmb250LXdlaWdodDogNzAwO1xyXG4gICAgICBsZXR0ZXItc3BhY2luZzogMC4wNWVtO1xyXG4gICAgICB0ZXh0LXRyYW5zZm9ybTogdXBwZXJjYXNlO1xyXG4gICAgICBwb2ludGVyLWV2ZW50czogbm9uZTtcclxuICAgIH1cclxuXHJcbiAgICAubWQtbGFuZ3VhZ2Uge1xyXG4gICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XHJcbiAgICAgIHJpZ2h0OiA4cHg7XHJcbiAgICAgIGJvdHRvbTogNnB4O1xyXG4gICAgICBwYWRkaW5nOiAycHggN3B4O1xyXG4gICAgICBib3JkZXItcmFkaXVzOiA5OTlweDtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgxMzQsIDIzOSwgMTcyLCAwLjE0KTtcclxuICAgICAgY29sb3I6ICNiYmY3ZDA7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTBweDtcclxuICAgICAgZm9udC13ZWlnaHQ6IDcwMDtcclxuICAgICAgbGV0dGVyLXNwYWNpbmc6IDAuMDVlbTtcclxuICAgICAgdGV4dC10cmFuc2Zvcm06IHVwcGVyY2FzZTtcclxuICAgICAgcG9pbnRlci1ldmVudHM6IG5vbmU7XHJcbiAgICB9XHJcblxyXG4gICAgOmhvc3QgOjpuZy1kZWVwIC5jb2RlLXRva2VuLWtleXdvcmQgeyBjb2xvcjogIzkzYzVmZDsgZm9udC13ZWlnaHQ6IDcwMDsgfVxyXG4gICAgOmhvc3QgOjpuZy1kZWVwIC5jb2RlLXRva2VuLXN0cmluZyB7IGNvbG9yOiAjODZlZmFjOyB9XHJcbiAgICA6aG9zdCA6Om5nLWRlZXAgLmNvZGUtdG9rZW4tbnVtYmVyIHsgY29sb3I6ICNmYmJmMjQ7IH1cclxuICAgIDpob3N0IDo6bmctZGVlcCAuY29kZS10b2tlbi1jb21tZW50IHsgY29sb3I6ICM5NGEzYjg7IGZvbnQtc3R5bGU6IGl0YWxpYzsgfVxyXG4gICAgOmhvc3QgOjpuZy1kZWVwIC5jb2RlLXRva2VuLWZ1bmN0aW9uIHsgY29sb3I6ICNjNGI1ZmQ7IH1cclxuXHJcbiAgICAudGFibGUtbWVzc2FnZS13cmFwIHtcclxuICAgICAgcG9zaXRpb246IHJlbGF0aXZlO1xyXG4gICAgICBtYXgtd2lkdGg6IG1pbig3NmNxdywgNTYwcHgpO1xyXG4gICAgICBvdmVyZmxvdy14OiBhdXRvO1xyXG4gICAgICBib3JkZXItcmFkaXVzOiA5cHg7XHJcbiAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xNik7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4wNCk7XHJcbiAgICAgIHNjcm9sbGJhci13aWR0aDogbm9uZTtcclxuICAgICAgLW1zLW92ZXJmbG93LXN0eWxlOiBub25lO1xyXG4gICAgfVxyXG5cclxuICAgIC50YWJsZS1tZXNzYWdlLXdyYXA6Oi13ZWJraXQtc2Nyb2xsYmFyIHtcclxuICAgICAgZGlzcGxheTogbm9uZTtcclxuICAgIH1cclxuXHJcbiAgICAucGFzdGVkLXRhYmxlIHtcclxuICAgICAgYm9yZGVyLWNvbGxhcHNlOiBjb2xsYXBzZTtcclxuICAgICAgbWluLXdpZHRoOiAxMDAlO1xyXG4gICAgICBmb250LXNpemU6IGNhbGMoY2xhbXAoMTBweCwgMy4xY3F3LCAxMnB4KSAqIHZhcigtLWNvZGUtdGV4dC1zY2FsZSwgMSkpO1xyXG4gICAgICBsaW5lLWhlaWdodDogMS4zNTtcclxuICAgICAgY29sb3I6ICNmNWY3ZmY7XHJcbiAgICB9XHJcblxyXG4gICAgLnBhc3RlZC10YWJsZSB0aCxcclxuICAgIC5wYXN0ZWQtdGFibGUgdGQge1xyXG4gICAgICBwYWRkaW5nOiA2cHggOXB4O1xyXG4gICAgICBib3JkZXItcmlnaHQ6IDFweCBzb2xpZCByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMTIpO1xyXG4gICAgICBib3JkZXItYm90dG9tOiAxcHggc29saWQgcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjEyKTtcclxuICAgICAgdGV4dC1hbGlnbjogbGVmdDtcclxuICAgICAgd2hpdGUtc3BhY2U6IHByZS13cmFwO1xyXG4gICAgICB2ZXJ0aWNhbC1hbGlnbjogdG9wO1xyXG4gICAgfVxyXG5cclxuICAgIC5wYXN0ZWQtdGFibGUgdGgge1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMSk7XHJcbiAgICAgIGZvbnQtd2VpZ2h0OiA3MDA7XHJcbiAgICB9XHJcblxyXG4gICAgLnBhc3RlZC10YWJsZSB0cjpsYXN0LWNoaWxkIHRkLFxyXG4gICAgLnBhc3RlZC10YWJsZSB0cjpsYXN0LWNoaWxkIHRoIHtcclxuICAgICAgYm9yZGVyLWJvdHRvbTogbm9uZTtcclxuICAgIH1cclxuXHJcbiAgICAucGFzdGVkLXRhYmxlIHRoOmxhc3QtY2hpbGQsXHJcbiAgICAucGFzdGVkLXRhYmxlIHRkOmxhc3QtY2hpbGQge1xyXG4gICAgICBib3JkZXItcmlnaHQ6IG5vbmU7XHJcbiAgICB9XHJcblxyXG4gICAgLm1kLW1lc3NhZ2Utd3JhcCB7XHJcbiAgICAgIHBvc2l0aW9uOiByZWxhdGl2ZTtcclxuICAgICAgbWF4LXdpZHRoOiBtaW4oNzZjcXcsIDU2MHB4KTtcclxuICAgICAgb3ZlcmZsb3cteDogYXV0bztcclxuICAgICAgYm9yZGVyLXJhZGl1czogMTBweDtcclxuICAgICAgYm9yZGVyOiAxcHggc29saWQgcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjEyKTtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjA1KTtcclxuICAgICAgc2Nyb2xsYmFyLXdpZHRoOiBub25lO1xyXG4gICAgICAtbXMtb3ZlcmZsb3ctc3R5bGU6IG5vbmU7XHJcbiAgICB9XHJcblxyXG4gICAgLm1kLW1lc3NhZ2Utd3JhcDo6LXdlYmtpdC1zY3JvbGxiYXIge1xyXG4gICAgICBkaXNwbGF5OiBub25lO1xyXG4gICAgfVxyXG5cclxuICAgIC5tZC1tZXNzYWdlIHtcclxuICAgICAgcGFkZGluZzogMTBweCA0MnB4IDI4cHggMTJweDtcclxuICAgICAgY29sb3I6ICNmNWY3ZmY7XHJcbiAgICAgIGZvbnQtc2l6ZTogY2FsYyhjbGFtcCgxMXB4LCAzLjRjcXcsIDEzcHgpICogdmFyKC0tbWVzc2FnZS10ZXh0LXNjYWxlLCAxKSk7XHJcbiAgICAgIGxpbmUtaGVpZ2h0OiAxLjQ1O1xyXG4gICAgICBvdmVyZmxvdy13cmFwOiBhbnl3aGVyZTtcclxuICAgIH1cclxuXHJcbiAgICA6aG9zdCA6Om5nLWRlZXAgLm1kLW1lc3NhZ2UgaDEsXHJcbiAgICA6aG9zdCA6Om5nLWRlZXAgLm1kLW1lc3NhZ2UgaDIsXHJcbiAgICA6aG9zdCA6Om5nLWRlZXAgLm1kLW1lc3NhZ2UgaDMge1xyXG4gICAgICBtYXJnaW46IDhweCAwIDZweDtcclxuICAgICAgY29sb3I6ICNmZmY7XHJcbiAgICAgIGxpbmUtaGVpZ2h0OiAxLjI1O1xyXG4gICAgfVxyXG5cclxuICAgIDpob3N0IDo6bmctZGVlcCAubWQtbWVzc2FnZSBoMSB7IGZvbnQtc2l6ZTogMThweDsgfVxyXG4gICAgOmhvc3QgOjpuZy1kZWVwIC5tZC1tZXNzYWdlIGgyIHsgZm9udC1zaXplOiAxNnB4OyB9XHJcbiAgICA6aG9zdCA6Om5nLWRlZXAgLm1kLW1lc3NhZ2UgaDMgeyBmb250LXNpemU6IDE0cHg7IH1cclxuXHJcbiAgICA6aG9zdCA6Om5nLWRlZXAgLm1kLW1lc3NhZ2UgcCB7XHJcbiAgICAgIG1hcmdpbjogNnB4IDA7XHJcbiAgICB9XHJcblxyXG4gICAgOmhvc3QgOjpuZy1kZWVwIC5tZC1tZXNzYWdlIHVsLFxyXG4gICAgOmhvc3QgOjpuZy1kZWVwIC5tZC1tZXNzYWdlIG9sIHtcclxuICAgICAgbWFyZ2luOiA2cHggMDtcclxuICAgICAgcGFkZGluZy1sZWZ0OiAyMHB4O1xyXG4gICAgfVxyXG5cclxuICAgIDpob3N0IDo6bmctZGVlcCAubWQtbWVzc2FnZSBibG9ja3F1b3RlIHtcclxuICAgICAgbWFyZ2luOiA4cHggMDtcclxuICAgICAgcGFkZGluZy1sZWZ0OiAxMHB4O1xyXG4gICAgICBib3JkZXItbGVmdDogM3B4IHNvbGlkIHJnYmEoMTI3LCAxODAsIDI1NSwgMC41NSk7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNzgpO1xyXG4gICAgfVxyXG5cclxuICAgIDpob3N0IDo6bmctZGVlcCAubWQtbWVzc2FnZSBjb2RlIHtcclxuICAgICAgcGFkZGluZzogMXB4IDVweDtcclxuICAgICAgYm9yZGVyLXJhZGl1czogNXB4O1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDAsIDAsIDAsIDAuMjUpO1xyXG4gICAgICBjb2xvcjogI2JmZGJmZTtcclxuICAgICAgZm9udC1mYW1pbHk6IHVpLW1vbm9zcGFjZSwgU0ZNb25vLVJlZ3VsYXIsIE1lbmxvLCBNb25hY28sIENvbnNvbGFzLCBcIkxpYmVyYXRpb24gTW9ub1wiLCBtb25vc3BhY2U7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTJweDtcclxuICAgIH1cclxuXHJcbiAgICA6aG9zdCA6Om5nLWRlZXAgLm1kLW1lc3NhZ2UgcHJlIHtcclxuICAgICAgbWFyZ2luOiA4cHggMDtcclxuICAgICAgcGFkZGluZzogOXB4O1xyXG4gICAgICBib3JkZXItcmFkaXVzOiA4cHg7XHJcbiAgICAgIG92ZXJmbG93LXg6IGF1dG87XHJcbiAgICAgIGJhY2tncm91bmQ6ICMwNjE4Mjc7XHJcbiAgICAgIHNjcm9sbGJhci13aWR0aDogbm9uZTtcclxuICAgICAgLW1zLW92ZXJmbG93LXN0eWxlOiBub25lO1xyXG4gICAgfVxyXG5cclxuICAgIDpob3N0IDo6bmctZGVlcCAubWQtbWVzc2FnZSBwcmU6Oi13ZWJraXQtc2Nyb2xsYmFyIHtcclxuICAgICAgZGlzcGxheTogbm9uZTtcclxuICAgIH1cclxuXHJcbiAgICA6aG9zdCA6Om5nLWRlZXAgLm1kLW1lc3NhZ2UgcHJlIGNvZGUge1xyXG4gICAgICBwYWRkaW5nOiAwO1xyXG4gICAgICBiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudDtcclxuICAgICAgY29sb3I6ICNkYmVhZmU7XHJcbiAgICAgIHdoaXRlLXNwYWNlOiBwcmU7XHJcbiAgICB9XHJcblxyXG4gICAgLmltYWdlLW1lc3NhZ2Uge1xyXG4gICAgICBsaW5lLWhlaWdodDogMDtcclxuICAgIH1cclxuXHJcbiAgICAubWVkaWEtd3JhcHBlciB7XHJcbiAgICAgIHBvc2l0aW9uOiByZWxhdGl2ZTtcclxuICAgICAgZGlzcGxheTogaW5saW5lLWJsb2NrO1xyXG4gICAgICBsaW5lLWhlaWdodDogMDtcclxuICAgICAgd2lkdGg6IHZhcigtLWF0dGFjaG1lbnQtdGh1bWItc2l6ZSk7XHJcbiAgICAgIGhlaWdodDogdmFyKC0tYXR0YWNobWVudC10aHVtYi1zaXplKTtcclxuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcclxuICAgICAgYm9yZGVyLXJhZGl1czogMTBweDtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjA4KTtcclxuICAgIH1cclxuXHJcbiAgICAubWVkaWEtaW1nIHtcclxuICAgICAgd2lkdGg6IDEwMCU7XHJcbiAgICAgIGhlaWdodDogMTAwJTtcclxuICAgICAgYm9yZGVyLXJhZGl1czogaW5oZXJpdDtcclxuICAgICAgZGlzcGxheTogYmxvY2s7XHJcbiAgICAgIGN1cnNvcjogem9vbS1pbjtcclxuICAgICAgb2JqZWN0LWZpdDogY292ZXI7XHJcbiAgICB9XHJcblxyXG4gICAgLmF0dGFjaG1lbnQtYWN0aW9ucyB7XHJcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcclxuICAgICAgcmlnaHQ6IDZweDtcclxuICAgICAgdG9wOiA2cHg7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGdhcDogNHB4O1xyXG4gICAgICBvcGFjaXR5OiAwO1xyXG4gICAgICB0cmFuc2l0aW9uOiBvcGFjaXR5IDAuMTJzIGVhc2U7XHJcbiAgICAgIHBvaW50ZXItZXZlbnRzOiBub25lO1xyXG4gICAgfVxyXG5cclxuICAgIC5tZWRpYS13cmFwcGVyOmhvdmVyIC5hdHRhY2htZW50LWFjdGlvbnMge1xyXG4gICAgICBvcGFjaXR5OiAxO1xyXG4gICAgICBwb2ludGVyLWV2ZW50czogYXV0bztcclxuICAgIH1cclxuXHJcbiAgICAuYXR0YWNobWVudC1hY3Rpb24tYnRuLFxyXG4gICAgLmZpbGUtZG93bmxvYWQtYnRuIHtcclxuICAgICAgYm9yZGVyOiBub25lO1xyXG4gICAgICBib3JkZXItcmFkaXVzOiA5OTlweDtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSg3LCAyOSwgNDgsIDAuODIpO1xyXG4gICAgICBjb2xvcjogI2ZmZjtcclxuICAgICAgZGlzcGxheTogaW5saW5lLWZsZXg7XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xyXG4gICAgICBjdXJzb3I6IHBvaW50ZXI7XHJcbiAgICAgIHBhZGRpbmc6IDA7XHJcbiAgICB9XHJcblxyXG4gICAgLmF0dGFjaG1lbnQtYWN0aW9uLWJ0biB7XHJcbiAgICAgIHdpZHRoOiAyOHB4O1xyXG4gICAgICBoZWlnaHQ6IDI4cHg7XHJcbiAgICB9XHJcblxyXG4gICAgLmF0dGFjaG1lbnQtYWN0aW9uLWJ0biBtYXQtaWNvbiB7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTdweDtcclxuICAgICAgd2lkdGg6IDE3cHg7XHJcbiAgICAgIGhlaWdodDogMTdweDtcclxuICAgIH1cclxuXHJcbiAgICAubWVkaWEtdmlkZW8ge1xyXG4gICAgICBtYXgtd2lkdGg6IDI0MHB4O1xyXG4gICAgICBtYXgtaGVpZ2h0OiAyNjBweDtcclxuICAgICAgYm9yZGVyLXJhZGl1czogMTBweDtcclxuICAgICAgZGlzcGxheTogYmxvY2s7XHJcbiAgICAgIGJhY2tncm91bmQ6ICMwMDA7XHJcbiAgICB9XHJcblxyXG4gICAgLnZpZGVvLW1lc3NhZ2Uge1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xyXG4gICAgICBnYXA6IDZweDtcclxuICAgIH1cclxuXHJcbiAgICAudmlkZW8tZG93bmxvYWQge1xyXG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjc4KTtcclxuICAgICAgZm9udC1zaXplOiAxMnB4O1xyXG4gICAgICB0ZXh0LWRlY29yYXRpb246IHVuZGVybGluZTtcclxuICAgICAgdGV4dC11bmRlcmxpbmUtb2Zmc2V0OiAycHg7XHJcbiAgICB9XHJcblxyXG4gICAgLm1lZGlhLXBsYWNlaG9sZGVyIHtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XHJcbiAgICAgIGdhcDogOHB4O1xyXG4gICAgICB3aWR0aDogdmFyKC0tYXR0YWNobWVudC10aHVtYi1zaXplKTtcclxuICAgICAgaGVpZ2h0OiB2YXIoLS1hdHRhY2htZW50LXRodW1iLXNpemUpO1xyXG4gICAgICBib3JkZXItcmFkaXVzOiAxMHB4O1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMDgpO1xyXG4gICAgICBjb2xvcjogcmdiYSgyNTUsMjU1LDI1NSwwLjYpO1xyXG4gICAgICBmb250LXNpemU6IDExcHg7XHJcbiAgICB9XHJcblxyXG4gICAgLm1lZGlhLWxvYWQtbGFiZWwge1xyXG4gICAgICBmb250LXNpemU6IDExcHg7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwyNTUsMjU1LDAuNik7XHJcbiAgICB9XHJcblxyXG4gICAgLmF0dGFjaG1lbnRzLWxpc3Qge1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xyXG4gICAgICBnYXA6IDhweDtcclxuICAgICAgbWF4LXdpZHRoOiAxMDAlO1xyXG4gICAgfVxyXG5cclxuICAgIC5hdHRhY2htZW50LWl0ZW0ge1xyXG4gICAgICBtYXgtd2lkdGg6IDEwMCU7XHJcbiAgICB9XHJcblxyXG4gICAgLmZpbGUtbWVzc2FnZSB7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgIGdhcDogOHB4O1xyXG4gICAgICBwYWRkaW5nOiA0cHggMDtcclxuICAgIH1cclxuXHJcbiAgICAuYXR0YWNobWVudC10aHVtYi5maWxlLW1lc3NhZ2Uge1xyXG4gICAgICBwb3NpdGlvbjogcmVsYXRpdmU7XHJcbiAgICAgIHdpZHRoOiB2YXIoLS1hdHRhY2htZW50LXRodW1iLXNpemUpO1xyXG4gICAgICBoZWlnaHQ6IHZhcigtLWF0dGFjaG1lbnQtdGh1bWItc2l6ZSk7XHJcbiAgICAgIHBhZGRpbmc6IDEycHg7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDEwcHg7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4wOCk7XHJcbiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XHJcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xyXG4gICAgICBib3gtc2l6aW5nOiBib3JkZXItYm94O1xyXG4gICAgICBvdmVyZmxvdzogaGlkZGVuO1xyXG4gICAgfVxyXG5cclxuICAgIC5maWxlLWRvd25sb2FkIHtcclxuICAgICAgZGlzcGxheTogaW5saW5lLWZsZXg7XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgIGdhcDogOHB4O1xyXG4gICAgICBjb2xvcjogI2ZmZjtcclxuICAgICAgdGV4dC1kZWNvcmF0aW9uOiBub25lO1xyXG4gICAgICBtYXgtd2lkdGg6IDI0MHB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5maWxlLW1zZy1pY29uIHtcclxuICAgICAgZm9udC1zaXplOiA0MnB4O1xyXG4gICAgICB3aWR0aDogNDJweDtcclxuICAgICAgaGVpZ2h0OiA0MnB4O1xyXG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjgpO1xyXG4gICAgICBmbGV4LXNocmluazogMDtcclxuICAgIH1cclxuXHJcbiAgICAuZmlsZS1tc2ctbmFtZSB7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTNweDtcclxuICAgICAgY29sb3I6ICNmZmY7XHJcbiAgICAgIGxpbmUtaGVpZ2h0OiAxLjI7XHJcbiAgICAgIG1heC13aWR0aDogMTAwJTtcclxuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcclxuICAgICAgdGV4dC1hbGlnbjogY2VudGVyO1xyXG4gICAgICB0ZXh0LW92ZXJmbG93OiBlbGxpcHNpcztcclxuICAgICAgZGlzcGxheTogLXdlYmtpdC1ib3g7XHJcbiAgICAgIC13ZWJraXQtbGluZS1jbGFtcDogMztcclxuICAgICAgLXdlYmtpdC1ib3gtb3JpZW50OiB2ZXJ0aWNhbDtcclxuICAgICAgd29yZC1icmVhazogYnJlYWstd29yZDtcclxuICAgIH1cclxuXHJcbiAgICAuZmlsZS1kb3dubG9hZC1pY29uIHtcclxuICAgICAgZm9udC1zaXplOiAxOHB4O1xyXG4gICAgICB3aWR0aDogMThweDtcclxuICAgICAgaGVpZ2h0OiAxOHB4O1xyXG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjcpO1xyXG4gICAgICBmbGV4LXNocmluazogMDtcclxuICAgIH1cclxuXHJcbiAgICAuZmlsZS1kb3dubG9hZC1idG4ge1xyXG4gICAgICB3aWR0aDogMjRweDtcclxuICAgICAgaGVpZ2h0OiAyNHB4O1xyXG4gICAgICBmbGV4LXNocmluazogMDtcclxuICAgICAgcG9zaXRpb246IGFic29sdXRlO1xyXG4gICAgICByaWdodDogNnB4O1xyXG4gICAgICB0b3A6IDZweDtcclxuICAgIH1cclxuXHJcbiAgICAuZmlsZS1kb3dubG9hZC1saW5rIHtcclxuICAgICAgYm9yZGVyOiBub25lO1xyXG4gICAgICBib3JkZXItcmFkaXVzOiA5OTlweDtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjE2KTtcclxuICAgICAgY29sb3I6ICNmZmY7XHJcbiAgICAgIGN1cnNvcjogcG9pbnRlcjtcclxuICAgICAgZm9udC1zaXplOiAxMXB4O1xyXG4gICAgICBwYWRkaW5nOiA0cHggMTBweDtcclxuICAgICAgbWFyZ2luLXRvcDogNHB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5tZXNzYWdlLW1ldGEge1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBnYXA6IDRweDtcclxuICAgICAgbWFyZ2luLXRvcDogM3B4O1xyXG4gICAgfVxyXG5cclxuICAgIC5tc2ctdGltZSB7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTBweDtcclxuICAgICAgY29sb3I6IHJnYmEoMjE4LCAyMjQsIDI1MCwgMC42Nik7XHJcbiAgICB9XHJcblxyXG4gICAgLm1lc3NhZ2UtYnViYmxlLXJvdy5vdGhlciAubXNnLXRpbWUge1xyXG4gICAgICBjb2xvcjogcmdiYSgyMTYsIDIyMywgMjQ2LCAwLjU4KTtcclxuICAgIH1cclxuXHJcbiAgICAuZWRpdGVkLWxhYmVsIHtcclxuICAgICAgZm9udC1zaXplOiAxMHB4O1xyXG4gICAgICBmb250LXN0eWxlOiBpdGFsaWM7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDIxOCwgMjI0LCAyNTAsIDAuNjIpO1xyXG4gICAgfVxyXG5cclxuICAgIC5yZWFkLWljb24ge1xyXG4gICAgICBmb250LXNpemU6IDE0cHg7XHJcbiAgICAgIHdpZHRoOiAxNHB4O1xyXG4gICAgICBoZWlnaHQ6IDE0cHg7XHJcbiAgICAgIG9wYWNpdHk6IDAuNztcclxuICAgIH1cclxuXHJcbiAgICAucmVhZC1pY29uLnJlYWQge1xyXG4gICAgICBjb2xvcjogIzYwYTVmYTtcclxuICAgICAgb3BhY2l0eTogMTtcclxuICAgIH1cclxuXHJcbiAgICAucmVhZC1pY29uLnVucmVhZCB7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDIxOCwgMjI0LCAyNTAsIDAuNSk7XHJcbiAgICAgIG9wYWNpdHk6IDE7XHJcbiAgICB9XHJcblxyXG4gICAgLnJlcGx5LW1lc3NhZ2UtYnRuIHtcclxuICAgICAgcG9zaXRpb246IGFic29sdXRlO1xyXG4gICAgICByaWdodDogLTEwcHg7XHJcbiAgICAgIGJvdHRvbTogLTEwcHg7XHJcbiAgICAgIHdpZHRoOiAyNHB4O1xyXG4gICAgICBoZWlnaHQ6IDI0cHg7XHJcbiAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xNik7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDk5OXB4O1xyXG4gICAgICBiYWNrZ3JvdW5kOiAjMDcxZDMwO1xyXG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjc4KTtcclxuICAgICAgZGlzcGxheTogaW5saW5lLWZsZXg7XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xyXG4gICAgICBwYWRkaW5nOiAwO1xyXG4gICAgICBjdXJzb3I6IHBvaW50ZXI7XHJcbiAgICAgIG9wYWNpdHk6IDA7XHJcbiAgICAgIHRyYW5zZm9ybTogc2NhbGUoMC45Mik7XHJcbiAgICAgIHRyYW5zaXRpb246IG9wYWNpdHkgMC4xMnMsIHRyYW5zZm9ybSAwLjEycywgYmFja2dyb3VuZCAwLjEycywgY29sb3IgMC4xMnM7XHJcbiAgICAgIHotaW5kZXg6IDM7XHJcbiAgICB9XHJcblxyXG4gICAgLm1lc3NhZ2UtYnViYmxlOmhvdmVyIC5yZXBseS1tZXNzYWdlLWJ0bixcclxuICAgIC5yZXBseS1tZXNzYWdlLWJ0bjpmb2N1cyB7XHJcbiAgICAgIG9wYWNpdHk6IDE7XHJcbiAgICAgIHRyYW5zZm9ybTogc2NhbGUoMSk7XHJcbiAgICB9XHJcblxyXG4gICAgLnJlcGx5LW1lc3NhZ2UtYnRuOmhvdmVyIHtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgxMjcsIDE4MCwgMjU1LCAwLjIyKTtcclxuICAgICAgY29sb3I6ICNmZmY7XHJcbiAgICB9XHJcblxyXG4gICAgLnJlcGx5LW1lc3NhZ2UtYnRuIG1hdC1pY29uIHtcclxuICAgICAgZm9udC1zaXplOiAxNXB4O1xyXG4gICAgICB3aWR0aDogMTVweDtcclxuICAgICAgaGVpZ2h0OiAxNXB4O1xyXG4gICAgICBsaW5lLWhlaWdodDogMTVweDtcclxuICAgIH1cclxuXHJcbiAgICAucXVpY2stcmVhY3Rpb25zIHtcclxuICAgICAgcG9zaXRpb246IGFic29sdXRlO1xyXG4gICAgICB0b3A6IC0xOHB4O1xyXG4gICAgICByaWdodDogMDtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAgZ2FwOiA0cHg7XHJcbiAgICAgIHBhZGRpbmc6IDNweCA1cHg7XHJcbiAgICAgIGJhY2tncm91bmQ6ICMwNzFkMzA7XHJcbiAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xNCk7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDk5OXB4O1xyXG4gICAgICBib3gtc2hhZG93OiAwIDZweCAxNHB4IHJnYmEoMCwgMCwgMCwgMC4yOCk7XHJcbiAgICAgIHotaW5kZXg6IDQ7XHJcbiAgICB9XHJcblxyXG4gICAgLyogUmVjZWl2ZWQgbWVzc2FnZXMgc2l0IG9uIHRoZSBsZWZ0LCBzbyBncm93IHRoZSBwaWNrZXIgcmlnaHR3YXJkLlxyXG4gICAgICAgT3duIG1lc3NhZ2VzIHNpdCBvbiB0aGUgcmlnaHQsIHNvIGdyb3cgdGhlIHBpY2tlciBsZWZ0d2FyZC4gKi9cclxuICAgIC5tZXNzYWdlLWJ1YmJsZS1yb3cub3RoZXIgLnF1aWNrLXJlYWN0aW9ucyB7XHJcbiAgICAgIGxlZnQ6IDA7XHJcbiAgICAgIHJpZ2h0OiBhdXRvO1xyXG4gICAgfVxyXG5cclxuICAgIC5tZXNzYWdlLWJ1YmJsZS1yb3cub3duIC5xdWljay1yZWFjdGlvbnMge1xyXG4gICAgICBsZWZ0OiBhdXRvO1xyXG4gICAgICByaWdodDogMDtcclxuICAgIH1cclxuXHJcbiAgICAucXVpY2stZW1vamktYnRuIHtcclxuICAgICAgd2lkdGg6IDIwcHg7XHJcbiAgICAgIGhlaWdodDogMjBweDtcclxuICAgICAgYm9yZGVyOiBub25lO1xyXG4gICAgICBib3JkZXItcmFkaXVzOiA5OTlweDtcclxuICAgICAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQ7XHJcbiAgICAgIGNvbG9yOiAjZmZmO1xyXG4gICAgICBkaXNwbGF5OiBpbmxpbmUtZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTNweDtcclxuICAgICAgbGluZS1oZWlnaHQ6IDE7XHJcbiAgICAgIGN1cnNvcjogcG9pbnRlcjtcclxuICAgICAgcGFkZGluZzogMDtcclxuICAgICAgdHJhbnNpdGlvbjogdHJhbnNmb3JtIDAuMTJzIGVhc2UsIGJhY2tncm91bmQgMC4xMnMgZWFzZTtcclxuICAgIH1cclxuXHJcbiAgICAucXVpY2stZW1vamktYnRuOmhvdmVyIHtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjE4KTtcclxuICAgICAgdHJhbnNmb3JtOiBzY2FsZSgxLjE0KTtcclxuICAgIH1cclxuXHJcbiAgICAucmVhY3Rpb25zLXJvdyB7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGZsZXgtd3JhcDogd3JhcDtcclxuICAgICAgZ2FwOiAzcHg7XHJcbiAgICAgIG1hcmdpbi10b3A6IDVweDtcclxuICAgIH1cclxuXHJcbiAgICAucmVhY3Rpb24tY2hpcCB7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LDI1NSwyNTUsMC4wOCk7XHJcbiAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHJnYmEoMjU1LDI1NSwyNTUsMC4yKTtcclxuICAgICAgYm9yZGVyLXJhZGl1czogOTk5cHg7XHJcbiAgICAgIHBhZGRpbmc6IDJweCA3cHg7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTFweDtcclxuICAgICAgY29sb3I6ICNmMmY2ZmY7XHJcbiAgICAgIGN1cnNvcjogcG9pbnRlcjtcclxuICAgICAgdHJhbnNpdGlvbjogYWxsIDAuMnM7XHJcbiAgICAgIGRpc3BsYXk6IGlubGluZS1mbGV4O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBnYXA6IDNweDtcclxuICAgICAgbWF4LXdpZHRoOiAxODBweDtcclxuICAgIH1cclxuXHJcbiAgICAucmVhY3Rpb24tY2hpcDpob3ZlciB7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LDI1NSwyNTUsMC4yNSk7XHJcbiAgICAgIHRyYW5zZm9ybTogc2NhbGUoMS4wNSk7XHJcbiAgICB9XHJcblxyXG4gICAgLnJlYWN0aW9uLWNoaXAub3duLXJlYWN0aW9uIHtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSg0Miw5MSwyNTUsMC4zKTtcclxuICAgICAgYm9yZGVyLWNvbG9yOiByZ2JhKDQyLDkxLDI1NSwwLjUpO1xyXG4gICAgfVxyXG5cclxuICAgIC5lbXB0eS1jaGF0IHtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XHJcbiAgICAgIGZsZXg6IDE7XHJcbiAgICAgIGNvbG9yOiAjOWNhM2FmO1xyXG4gICAgfVxyXG5cclxuICAgIC5lbXB0eS1jaGF0IG1hdC1pY29uIHtcclxuICAgICAgZm9udC1zaXplOiA0OHB4O1xyXG4gICAgICB3aWR0aDogNDhweDtcclxuICAgICAgaGVpZ2h0OiA0OHB4O1xyXG4gICAgICBtYXJnaW4tYm90dG9tOiA4cHg7XHJcbiAgICB9XHJcblxyXG4gICAgLmVtcHR5LWNoYXQgcCB7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTRweDtcclxuICAgICAgbWFyZ2luOiAwO1xyXG4gICAgfVxyXG5cclxuICAgIC5tZXNzYWdlLWNvbnRleHQtbWVudSB7XHJcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcclxuICAgICAgei1pbmRleDogMTAwMDA7XHJcbiAgICAgIG1pbi13aWR0aDogMTUwcHg7XHJcbiAgICAgIHBhZGRpbmc6IDZweDtcclxuICAgICAgYm9yZGVyOiAxcHggc29saWQgcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjE0KTtcclxuICAgICAgYm9yZGVyLXJhZGl1czogMTJweDtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSg3LCAxNywgMzAsIDAuOTgpO1xyXG4gICAgICBib3gtc2hhZG93OiAwIDE4cHggNDVweCByZ2JhKDAsIDAsIDAsIDAuMzgpO1xyXG4gICAgICBjb2xvcjogI2Y4ZmFmYztcclxuICAgIH1cclxuXHJcbiAgICAuY29udGV4dC1tZW51LWl0ZW0ge1xyXG4gICAgICB3aWR0aDogMTAwJTtcclxuICAgICAgYm9yZGVyOiAwO1xyXG4gICAgICBib3JkZXItcmFkaXVzOiA5cHg7XHJcbiAgICAgIHBhZGRpbmc6IDlweCAxMHB4O1xyXG4gICAgICBiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudDtcclxuICAgICAgY29sb3I6IGluaGVyaXQ7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgIGdhcDogOXB4O1xyXG4gICAgICBjdXJzb3I6IHBvaW50ZXI7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTNweDtcclxuICAgICAgdGV4dC1hbGlnbjogbGVmdDtcclxuICAgIH1cclxuXHJcbiAgICAuY29udGV4dC1tZW51LWl0ZW06aG92ZXIge1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMDkpO1xyXG4gICAgfVxyXG5cclxuICAgIC5jb250ZXh0LW1lbnUtaXRlbSBtYXQtaWNvbiB7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTdweDtcclxuICAgICAgd2lkdGg6IDE3cHg7XHJcbiAgICAgIGhlaWdodDogMTdweDtcclxuICAgIH1cclxuXHJcbiAgICAuY29udGV4dC1tZW51LWl0ZW0uZGFuZ2VyIHtcclxuICAgICAgY29sb3I6ICNmZWNhY2E7XHJcbiAgICB9XHJcblxyXG4gICAgLmNvbnRleHQtbWVudS1jb25maXJtIHtcclxuICAgICAgcGFkZGluZzogOHB4O1xyXG4gICAgICB3aWR0aDogMTkwcHg7XHJcbiAgICB9XHJcblxyXG4gICAgLmNvbmZpcm0tdGl0bGUge1xyXG4gICAgICBjb2xvcjogI2Y4ZmFmYztcclxuICAgICAgZm9udC1zaXplOiAxM3B4O1xyXG4gICAgICBmb250LXdlaWdodDogNjAwO1xyXG4gICAgICBtYXJnaW4tYm90dG9tOiAxMHB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5jb25maXJtLWFjdGlvbnMge1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGZsZXgtZW5kO1xyXG4gICAgICBnYXA6IDhweDtcclxuICAgIH1cclxuXHJcbiAgICAuY29uZmlybS1jYW5jZWwsXHJcbiAgICAuY29uZmlybS1kZWxldGUge1xyXG4gICAgICBib3JkZXI6IDA7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDhweDtcclxuICAgICAgcGFkZGluZzogN3B4IDEwcHg7XHJcbiAgICAgIGNvbG9yOiAjZjhmYWZjO1xyXG4gICAgICBjdXJzb3I6IHBvaW50ZXI7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTJweDtcclxuICAgIH1cclxuXHJcbiAgICAuY29uZmlybS1jYW5jZWwge1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMTIpO1xyXG4gICAgfVxyXG5cclxuICAgIC5jb25maXJtLWRlbGV0ZSB7XHJcbiAgICAgIGJhY2tncm91bmQ6ICNkYzI2MjY7XHJcbiAgICB9XHJcbiAgYF0sXHJcbn0pXHJcbmV4cG9ydCBjbGFzcyBDaGF0VGhyZWFkQ29tcG9uZW50IGltcGxlbWVudHMgT25Jbml0LCBPbkRlc3Ryb3ksIEFmdGVyVmlld0NoZWNrZWQge1xyXG4gIEBWaWV3Q2hpbGQoJ3Njcm9sbENvbnRhaW5lcicpIHNjcm9sbENvbnRhaW5lciE6IEVsZW1lbnRSZWY7XHJcbiAgQFZpZXdDaGlsZCgndGhyZWFkUm9vdCcpIHRocmVhZFJvb3QhOiBFbGVtZW50UmVmPEhUTUxFbGVtZW50PjtcclxuICBAVmlld0NoaWxkcmVuKCdpbmxpbmVFZGl0VGV4dGFyZWEnKSBpbmxpbmVFZGl0VGV4dGFyZWFzITogUXVlcnlMaXN0PEVsZW1lbnRSZWY8SFRNTFRleHRBcmVhRWxlbWVudD4+O1xyXG4gIEBWaWV3Q2hpbGQoTWVzc2FnZUlucHV0Q29tcG9uZW50KSBtZXNzYWdlSW5wdXQ/OiBNZXNzYWdlSW5wdXRDb21wb25lbnQ7XHJcbiAgQE91dHB1dCgpIGxpZ2h0Ym94T3BlbiA9IG5ldyBFdmVudEVtaXR0ZXI8c3RyaW5nPigpO1xyXG5cclxuICBtZXNzYWdlczogTWVzc2FnZVtdID0gW107XHJcbiAgdmlzaWJsZUNvbnRhY3RzOiBDb250YWN0W10gPSBbXTtcclxuICBjb252ZXJzYXRpb25OYW1lID0gJyc7XHJcbiAgaXNHcm91cCA9IGZhbHNlO1xyXG4gIGlzUmVtb3ZlZEZyb21Hcm91cCA9IGZhbHNlO1xyXG4gIG1lc3NhZ2VUZXh0U2NhbGUgPSAxO1xyXG4gIGNvZGVUZXh0U2NhbGUgPSAxO1xyXG4gIGxvYWRpbmcgPSBmYWxzZTtcclxuICBteUNvbnRhY3RJZDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XHJcbiAgcmVwbHlUb01lc3NhZ2U6IE1lc3NhZ2UgfCBudWxsID0gbnVsbDtcclxuICBlZGl0aW5nTWVzc2FnZTogTWVzc2FnZSB8IG51bGwgPSBudWxsO1xyXG4gIGVkaXRpbmdEcmFmdCA9ICcnO1xyXG4gIG1lbnRpb25PcHRpb25zOiBNZW50aW9uT3B0aW9uW10gPSBbXTtcclxuXHJcbiAgY29udmVyc2F0aW9uSWQ6IHN0cmluZyB8IG51bGwgPSBudWxsO1xyXG4gIHByaXZhdGUgc3ViITogU3Vic2NyaXB0aW9uO1xyXG4gIHByaXZhdGUgc2hvdWxkU2Nyb2xsVG9Cb3R0b20gPSB0cnVlO1xyXG5cclxuICB1cGxvYWRpbmcgPSBmYWxzZTtcclxuICBob3ZlcmVkTWVzc2FnZUlkOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcclxuICBtZXNzYWdlQ29udGV4dE1lbnU6IHsgbWVzc2FnZTogTWVzc2FnZTsgeDogbnVtYmVyOyB5OiBudW1iZXI7IGNvbmZpcm1EZWxldGU6IGJvb2xlYW4gfSB8IG51bGwgPSBudWxsO1xyXG4gIHF1aWNrRW1vamlzID0gWyfinaTvuI8nLCAn8J+RjScsICfwn5iCJywgJ/CfmK4nLCAn8J+YoicsICfwn5SlJ107XHJcbiAgdGhyZWFkRHJhZ092ZXIgPSBmYWxzZTtcclxuICBwcml2YXRlIHRocmVhZERyYWdEZXB0aCA9IDA7XHJcbiAgcHJpdmF0ZSBib3VuZFJlc2V0VGhyZWFkRHJhZyA9IHRoaXMucmVzZXRUaHJlYWREcmFnLmJpbmQodGhpcyk7XHJcblxyXG4gIC8qKiBUcmFja3Mgd2hpY2ggZmlsZSBJRHMgYXJlIGN1cnJlbnRseSBiZWluZyBmZXRjaGVkIHRvIGF2b2lkIGR1cGxpY2F0ZSByZXF1ZXN0cyAqL1xyXG4gIHByaXZhdGUgbWVkaWFMb2FkaW5nID0gbmV3IFNldDxzdHJpbmc+KCk7XHJcbiAgLyoqIFRyYWNrcyBmaWxlIElEcyB3aGVyZSByZXRyaWV2YWwgZmFpbGVkIHNvIFVJIGRvZXNuJ3Qgc3BpbiBmb3JldmVyLiAqL1xyXG4gIHByaXZhdGUgbWVkaWFGYWlsZWQgPSBuZXcgU2V0PHN0cmluZz4oKTtcclxuICBwcml2YXRlIG1lZGlhUXVldWU6IHN0cmluZ1tdID0gW107XHJcbiAgcHJpdmF0ZSBhY3RpdmVNZWRpYVJlcXVlc3RzID0gMDtcclxuICBwcml2YXRlIHJlYWRvbmx5IG1heE1lZGlhUmVxdWVzdHMgPSAyO1xyXG4gIHByaXZhdGUgbGFzdE1lbnRpb25Db252ZXJzYXRpb25JZDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XHJcbiAgcHJpdmF0ZSBsYXN0R3JvdXBNZW1iZXJzaGlwVmVyc2lvbiA9IC0xO1xyXG5cclxuICBjb25zdHJ1Y3RvcihcclxuICAgIHByaXZhdGUgc3RvcmU6IE1lc3NhZ2luZ1N0b3JlU2VydmljZSxcclxuICAgIHByaXZhdGUgYXBpOiBNZXNzYWdpbmdBcGlTZXJ2aWNlLFxyXG4gICAgcHJpdmF0ZSBhdXRoOiBBdXRoU2VydmljZSxcclxuICAgIHByaXZhdGUgZmlsZVNlcnZpY2U6IE1lc3NhZ2luZ0ZpbGVTZXJ2aWNlLFxyXG4gICAgcHJpdmF0ZSBjZHI6IENoYW5nZURldGVjdG9yUmVmLFxyXG4gICAgcHJpdmF0ZSBzYW5pdGl6ZXI6IERvbVNhbml0aXplcixcclxuICApIHt9XHJcblxyXG4gIG5nT25Jbml0KCk6IHZvaWQge1xyXG4gICAgdGhpcy5teUNvbnRhY3RJZCA9IHRoaXMuYXV0aC5jb250YWN0SWQ7XHJcbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdkcm9wJywgdGhpcy5ib3VuZFJlc2V0VGhyZWFkRHJhZywgdHJ1ZSk7XHJcbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdkcmFnZW5kJywgdGhpcy5ib3VuZFJlc2V0VGhyZWFkRHJhZywgdHJ1ZSk7XHJcblxyXG4gICAgdGhpcy5zdWIgPSBjb21iaW5lTGF0ZXN0KFtcclxuICAgICAgdGhpcy5zdG9yZS5hY3RpdmVDb252ZXJzYXRpb25JZCxcclxuICAgICAgdGhpcy5zdG9yZS5tZXNzYWdlc01hcCxcclxuICAgICAgdGhpcy5zdG9yZS5vcGVuQ2hhdHMsXHJcbiAgICAgIHRoaXMuc3RvcmUudmlzaWJsZUNvbnRhY3RzLFxyXG4gICAgICB0aGlzLnN0b3JlLmxvYWRpbmdNZXNzYWdlcyxcclxuICAgICAgdGhpcy5zdG9yZS5yZW1vdmVkR3JvdXBJZHMsXHJcbiAgICAgIHRoaXMuc3RvcmUubWVzc2FnZVRleHRTY2FsZSxcclxuICAgICAgdGhpcy5zdG9yZS5jb2RlVGV4dFNjYWxlLFxyXG4gICAgICB0aGlzLnN0b3JlLmdyb3VwTWVtYmVyc2hpcFZlcnNpb24sXHJcbiAgICBdKS5zdWJzY3JpYmUoKFtjb252SWQsIG1zZ01hcCwgY2hhdHMsIGNvbnRhY3RzLCBsb2FkaW5nLCByZW1vdmVkR3JvdXBJZHMsIG1lc3NhZ2VUZXh0U2NhbGUsIGNvZGVUZXh0U2NhbGUsIGdyb3VwTWVtYmVyc2hpcFZlcnNpb25dKSA9PiB7XHJcbiAgICAgIHRoaXMubG9hZGluZyA9IGxvYWRpbmc7XHJcbiAgICAgIHRoaXMudmlzaWJsZUNvbnRhY3RzID0gY29udGFjdHMgfHwgW107XHJcbiAgICAgIHRoaXMubWVzc2FnZVRleHRTY2FsZSA9IG1lc3NhZ2VUZXh0U2NhbGU7XHJcbiAgICAgIHRoaXMuY29kZVRleHRTY2FsZSA9IGNvZGVUZXh0U2NhbGU7XHJcbiAgICAgIGlmICh0aGlzLmlzR3JvdXAgJiYgdGhpcy5jb252ZXJzYXRpb25JZCAmJiB0aGlzLm1lbnRpb25PcHRpb25zLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAgIHRoaXMucmVmcmVzaE1lbnRpb25PcHRpb25zKCk7XHJcbiAgICAgIH1cclxuICAgICAgaWYgKFxyXG4gICAgICAgIHRoaXMuaXNHcm91cCAmJlxyXG4gICAgICAgIHRoaXMuY29udmVyc2F0aW9uSWQgJiZcclxuICAgICAgICBncm91cE1lbWJlcnNoaXBWZXJzaW9uICE9PSB0aGlzLmxhc3RHcm91cE1lbWJlcnNoaXBWZXJzaW9uXHJcbiAgICAgICkge1xyXG4gICAgICAgIHRoaXMubGFzdEdyb3VwTWVtYmVyc2hpcFZlcnNpb24gPSBncm91cE1lbWJlcnNoaXBWZXJzaW9uO1xyXG4gICAgICAgIHRoaXMucmVmcmVzaE1lbnRpb25PcHRpb25zKHRydWUpO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBpZiAoY29udklkICYmIGNvbnZJZCAhPT0gdGhpcy5jb252ZXJzYXRpb25JZCkge1xyXG4gICAgICAgIHRoaXMuY29udmVyc2F0aW9uSWQgPSBjb252SWQ7XHJcbiAgICAgICAgdGhpcy5yZXNldE1lZGlhUXVldWUoKTtcclxuICAgICAgICB0aGlzLmNsZWFyUmVwbHkoKTtcclxuICAgICAgICB0aGlzLmNsZWFyRWRpdCgpO1xyXG4gICAgICAgIHRoaXMuc2hvdWxkU2Nyb2xsVG9Cb3R0b20gPSB0cnVlO1xyXG4gICAgICAgIGNvbnN0IGNoYXQgPSBjaGF0cy5maW5kKChjKSA9PiBjLmNvbnZlcnNhdGlvbklkID09PSBjb252SWQpO1xyXG4gICAgICAgIHRoaXMuY29udmVyc2F0aW9uTmFtZSA9IGNoYXQ/Lm5hbWUgfHwgJ0NoYXQnO1xyXG4gICAgICAgIHRoaXMuaXNHcm91cCA9IGNoYXQ/LmlzR3JvdXAgfHwgZmFsc2U7XHJcbiAgICAgICAgdGhpcy5yZWZyZXNoTWVudGlvbk9wdGlvbnModHJ1ZSk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGlmICh0aGlzLmNvbnZlcnNhdGlvbklkKSB7XHJcbiAgICAgICAgY29uc3QgcHJldkxlbiA9IHRoaXMubWVzc2FnZXMubGVuZ3RoO1xyXG4gICAgICAgIHRoaXMubWVzc2FnZXMgPSBtc2dNYXAuZ2V0KHRoaXMuY29udmVyc2F0aW9uSWQpIHx8IFtdO1xyXG4gICAgICAgIGlmICh0aGlzLm1lc3NhZ2VzLmxlbmd0aCA+IHByZXZMZW4pIHtcclxuICAgICAgICAgIHRoaXMuc2hvdWxkU2Nyb2xsVG9Cb3R0b20gPSB0cnVlO1xyXG4gICAgICAgIH1cclxuICAgICAgICAvLyBQcmUtd2FybSBtZWRpYSBjYWNoZSBmb3IgYW55IGltYWdlL2ZpbGUgbWVzc2FnZXMgdmlzaWJsZVxyXG4gICAgICAgIHRoaXMucHJld2FybU1lZGlhKHRoaXMubWVzc2FnZXMpO1xyXG4gICAgICB9XHJcbiAgICAgIHRoaXMuaXNSZW1vdmVkRnJvbUdyb3VwID0gISF0aGlzLmNvbnZlcnNhdGlvbklkICYmIHJlbW92ZWRHcm91cElkcy5oYXMoU3RyaW5nKHRoaXMuY29udmVyc2F0aW9uSWQpKTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgbmdBZnRlclZpZXdDaGVja2VkKCk6IHZvaWQge1xyXG4gICAgaWYgKHRoaXMuc2hvdWxkU2Nyb2xsVG9Cb3R0b20pIHtcclxuICAgICAgdGhpcy5zY3JvbGxUb0JvdHRvbSgpO1xyXG4gICAgICB0aGlzLnNob3VsZFNjcm9sbFRvQm90dG9tID0gZmFsc2U7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBuZ09uRGVzdHJveSgpOiB2b2lkIHtcclxuICAgIHRoaXMuc3ViPy51bnN1YnNjcmliZSgpO1xyXG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignZHJvcCcsIHRoaXMuYm91bmRSZXNldFRocmVhZERyYWcsIHRydWUpO1xyXG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignZHJhZ2VuZCcsIHRoaXMuYm91bmRSZXNldFRocmVhZERyYWcsIHRydWUpO1xyXG4gIH1cclxuXHJcbiAgZ29CYWNrKCk6IHZvaWQge1xyXG4gICAgdGhpcy5zdG9yZS5zZXRWaWV3KCdpbmJveCcpO1xyXG4gIH1cclxuXHJcbiAgb25DbGVhckNvbnZlcnNhdGlvbigpOiB2b2lkIHtcclxuICAgIGlmICh0aGlzLmNvbnZlcnNhdGlvbklkKSB7XHJcbiAgICAgIHRoaXMuc3RvcmUuY2xlYXJDb252ZXJzYXRpb24odGhpcy5jb252ZXJzYXRpb25JZCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBvbkRlbGV0ZUNvbnZlcnNhdGlvbigpOiB2b2lkIHtcclxuICAgIGlmICh0aGlzLmNvbnZlcnNhdGlvbklkKSB7XHJcbiAgICAgIHRoaXMuc3RvcmUuZGVsZXRlQ29udmVyc2F0aW9uKHRoaXMuY29udmVyc2F0aW9uSWQpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgb25Hcm91cFNldHRpbmdzKCk6IHZvaWQge1xyXG4gICAgaWYgKHRoaXMuaXNSZW1vdmVkRnJvbUdyb3VwKSByZXR1cm47XHJcbiAgICBpZiAodGhpcy5jb252ZXJzYXRpb25JZCkge1xyXG4gICAgICB0aGlzLnN0b3JlLm9wZW5Hcm91cFNldHRpbmdzKHRoaXMuY29udmVyc2F0aW9uSWQsIHRoaXMuY29udmVyc2F0aW9uTmFtZSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBzdGFydFJlcGx5KG1lc3NhZ2U6IE1lc3NhZ2UsIGV2ZW50PzogRXZlbnQpOiB2b2lkIHtcclxuICAgIGV2ZW50Py5zdG9wUHJvcGFnYXRpb24oKTtcclxuICAgIGlmICh0aGlzLmlzRGVsZXRlZE1lc3NhZ2UobWVzc2FnZSkgfHwgdGhpcy5pc1N5c3RlbU1lc3NhZ2UobWVzc2FnZSkpIHJldHVybjtcclxuICAgIHRoaXMuY2xlYXJFZGl0KCk7XHJcbiAgICB0aGlzLnJlcGx5VG9NZXNzYWdlID0gbWVzc2FnZTtcclxuICAgIHRoaXMubWVzc2FnZUlucHV0Py5mb2N1cygpO1xyXG4gIH1cclxuXHJcbiAgb3Blbk1lc3NhZ2VDb250ZXh0TWVudShtZXNzYWdlOiBNZXNzYWdlLCBldmVudDogTW91c2VFdmVudCk6IHZvaWQge1xyXG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuICAgIGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xyXG4gICAgaWYgKHRoaXMuaXNEZWxldGVkTWVzc2FnZShtZXNzYWdlKSB8fCB0aGlzLmlzU3lzdGVtTWVzc2FnZShtZXNzYWdlKSkgcmV0dXJuO1xyXG5cclxuICAgIGNvbnN0IGhhc0FjdGlvbnMgPVxyXG4gICAgICB0aGlzLmNhblJlcGx5TWVzc2FnZShtZXNzYWdlKSB8fFxyXG4gICAgICB0aGlzLmNhbkVkaXRNZXNzYWdlKG1lc3NhZ2UpIHx8XHJcbiAgICAgIHRoaXMuY2FuRGVsZXRlTWVzc2FnZShtZXNzYWdlKTtcclxuICAgIGlmICghaGFzQWN0aW9ucykgcmV0dXJuO1xyXG5cclxuICAgIHRoaXMubWVzc2FnZUNvbnRleHRNZW51ID0ge1xyXG4gICAgICBtZXNzYWdlLFxyXG4gICAgICAuLi50aGlzLmdldENvbnRleHRNZW51UG9zaXRpb24oZXZlbnQpLFxyXG4gICAgICBjb25maXJtRGVsZXRlOiBmYWxzZSxcclxuICAgIH07XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGdldENvbnRleHRNZW51UG9zaXRpb24oZXZlbnQ6IE1vdXNlRXZlbnQpOiB7IHg6IG51bWJlcjsgeTogbnVtYmVyIH0ge1xyXG4gICAgY29uc3QgcmVjdCA9IHRoaXMudGhyZWFkUm9vdD8ubmF0aXZlRWxlbWVudD8uZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XHJcbiAgICBpZiAoIXJlY3QpIHtcclxuICAgICAgcmV0dXJuIHtcclxuICAgICAgICB4OiBNYXRoLm1pbihldmVudC5jbGllbnRYLCB3aW5kb3cuaW5uZXJXaWR0aCAtIDIyMCksXHJcbiAgICAgICAgeTogTWF0aC5taW4oZXZlbnQuY2xpZW50WSwgd2luZG93LmlubmVySGVpZ2h0IC0gMTYwKSxcclxuICAgICAgfTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBtZW51V2lkdGggPSAyMTA7XHJcbiAgICBjb25zdCBtZW51SGVpZ2h0ID0gMTcwO1xyXG4gICAgY29uc3QgcGFkZGluZyA9IDg7XHJcbiAgICBjb25zdCByYXdYID0gZXZlbnQuY2xpZW50WCAtIHJlY3QubGVmdDtcclxuICAgIGNvbnN0IHJhd1kgPSBldmVudC5jbGllbnRZIC0gcmVjdC50b3A7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICB4OiBNYXRoLm1heChwYWRkaW5nLCBNYXRoLm1pbihyYXdYLCByZWN0LndpZHRoIC0gbWVudVdpZHRoIC0gcGFkZGluZykpLFxyXG4gICAgICB5OiBNYXRoLm1heChwYWRkaW5nLCBNYXRoLm1pbihyYXdZLCByZWN0LmhlaWdodCAtIG1lbnVIZWlnaHQgLSBwYWRkaW5nKSksXHJcbiAgICB9O1xyXG4gIH1cclxuXHJcbiAgY2xvc2VNZXNzYWdlQ29udGV4dE1lbnUoKTogdm9pZCB7XHJcbiAgICB0aGlzLm1lc3NhZ2VDb250ZXh0TWVudSA9IG51bGw7XHJcbiAgfVxyXG5cclxuICByZXBseUZyb21Db250ZXh0TWVudSgpOiB2b2lkIHtcclxuICAgIGNvbnN0IG1lc3NhZ2UgPSB0aGlzLm1lc3NhZ2VDb250ZXh0TWVudT8ubWVzc2FnZTtcclxuICAgIGlmICghbWVzc2FnZSB8fCAhdGhpcy5jYW5SZXBseU1lc3NhZ2UobWVzc2FnZSkpIHJldHVybjtcclxuICAgIHRoaXMuc3RhcnRSZXBseShtZXNzYWdlKTtcclxuICAgIHRoaXMuY2xvc2VNZXNzYWdlQ29udGV4dE1lbnUoKTtcclxuICB9XHJcblxyXG4gIGVkaXRGcm9tQ29udGV4dE1lbnUoKTogdm9pZCB7XHJcbiAgICBjb25zdCBtZXNzYWdlID0gdGhpcy5tZXNzYWdlQ29udGV4dE1lbnU/Lm1lc3NhZ2U7XHJcbiAgICBpZiAoIW1lc3NhZ2UgfHwgIXRoaXMuY2FuRWRpdE1lc3NhZ2UobWVzc2FnZSkpIHJldHVybjtcclxuICAgIHRoaXMuY2xvc2VNZXNzYWdlQ29udGV4dE1lbnUoKTtcclxuICAgIHRoaXMuc3RhcnRFZGl0TWVzc2FnZShtZXNzYWdlKTtcclxuICB9XHJcblxyXG4gIHJlcXVlc3REZWxldGVGcm9tQ29udGV4dE1lbnUoKTogdm9pZCB7XHJcbiAgICBpZiAoIXRoaXMubWVzc2FnZUNvbnRleHRNZW51IHx8ICF0aGlzLmNhbkRlbGV0ZU1lc3NhZ2UodGhpcy5tZXNzYWdlQ29udGV4dE1lbnUubWVzc2FnZSkpIHJldHVybjtcclxuICAgIHRoaXMubWVzc2FnZUNvbnRleHRNZW51ID0geyAuLi50aGlzLm1lc3NhZ2VDb250ZXh0TWVudSwgY29uZmlybURlbGV0ZTogdHJ1ZSB9O1xyXG4gIH1cclxuXHJcbiAgY29uZmlybURlbGV0ZUZyb21Db250ZXh0TWVudSgpOiB2b2lkIHtcclxuICAgIGNvbnN0IG1lc3NhZ2UgPSB0aGlzLm1lc3NhZ2VDb250ZXh0TWVudT8ubWVzc2FnZTtcclxuICAgIGlmICghbWVzc2FnZSB8fCAhdGhpcy5jYW5EZWxldGVNZXNzYWdlKG1lc3NhZ2UpKSByZXR1cm47XHJcbiAgICB0aGlzLmNsb3NlTWVzc2FnZUNvbnRleHRNZW51KCk7XHJcbiAgICB0aGlzLnN0b3JlLmRlbGV0ZU1lc3NhZ2UobWVzc2FnZS5tZXNzYWdlX2lkKTtcclxuICB9XHJcblxyXG4gIGNsZWFyUmVwbHkoKTogdm9pZCB7XHJcbiAgICB0aGlzLnJlcGx5VG9NZXNzYWdlID0gbnVsbDtcclxuICB9XHJcblxyXG4gIGNsZWFyRWRpdCgpOiB2b2lkIHtcclxuICAgIHRoaXMuZWRpdGluZ01lc3NhZ2UgPSBudWxsO1xyXG4gICAgdGhpcy5lZGl0aW5nRHJhZnQgPSAnJztcclxuICB9XHJcblxyXG4gIGdldFJlcGx5UHJldmlldyhtZXNzYWdlOiBNZXNzYWdlKTogUmVwbHlQcmV2aWV3IHwgbnVsbCB7XHJcbiAgICBjb25zdCByZXBseSA9IG1lc3NhZ2UucmVwbHlfdG87XHJcbiAgICBpZiAoIXJlcGx5KSByZXR1cm4gbnVsbDtcclxuICAgIHJldHVybiB7XHJcbiAgICAgIHNlbmRlck5hbWU6IHJlcGx5LnNlbmRlcl9uYW1lIHx8ICdNZXNzYWdlJyxcclxuICAgICAgY29udGVudDogdGhpcy50cnVuY2F0ZVJlcGx5VGV4dChyZXBseS5jb250ZW50IHx8ICdBdHRhY2htZW50JyksXHJcbiAgICB9O1xyXG4gIH1cclxuXHJcbiAgZ2V0Q29tcG9zZVJlcGx5UHJldmlldyhtZXNzYWdlOiBNZXNzYWdlKTogUmVwbHlQcmV2aWV3IHtcclxuICAgIHJldHVybiB7XHJcbiAgICAgIHNlbmRlck5hbWU6IHRoaXMuZ2V0U2VuZGVyTmFtZShtZXNzYWdlKSxcclxuICAgICAgY29udGVudDogdGhpcy50cnVuY2F0ZVJlcGx5VGV4dCh0aGlzLmdldE1lc3NhZ2VCb2R5KG1lc3NhZ2UpIHx8IHRoaXMuZ2V0QXR0YWNobWVudE5hbWUobWVzc2FnZSkpLFxyXG4gICAgfTtcclxuICB9XHJcblxyXG4gIGdldE1lc3NhZ2VCb2R5KG1lc3NhZ2U6IE1lc3NhZ2UpOiBzdHJpbmcge1xyXG4gICAgaWYgKHRoaXMuaXNEZWxldGVkTWVzc2FnZShtZXNzYWdlKSkgcmV0dXJuICdbVGhpcyBtZXNzYWdlIHdhcyBkZWxldGVkXSc7XHJcbiAgICByZXR1cm4gU3RyaW5nKG1lc3NhZ2UuY29udGVudCB8fCAnJyk7XHJcbiAgfVxyXG5cclxuICBpc0RlbGV0ZWRNZXNzYWdlKG1lc3NhZ2U6IE1lc3NhZ2UpOiBib29sZWFuIHtcclxuICAgIHJldHVybiBCb29sZWFuKG1lc3NhZ2UuaXNfZGVsZXRlZCB8fCBtZXNzYWdlLmRlbGV0ZWRfYXQgfHwgbWVzc2FnZS5jb250ZW50ID09PSAnW2RlbGV0ZWRdJyk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHRydW5jYXRlUmVwbHlUZXh0KHZhbHVlOiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gICAgY29uc3QgdGV4dCA9IFN0cmluZyh2YWx1ZSB8fCAnJykucmVwbGFjZSgvXFxzKy9nLCAnICcpLnRyaW0oKTtcclxuICAgIHJldHVybiB0ZXh0Lmxlbmd0aCA+IDEyMCA/IGAke3RleHQuc2xpY2UoMCwgMTE3KX0uLi5gIDogdGV4dCB8fCAnQXR0YWNobWVudCc7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHJlZnJlc2hNZW50aW9uT3B0aW9ucyhmb3JjZSA9IGZhbHNlKTogdm9pZCB7XHJcbiAgICBpZiAoIXRoaXMuaXNHcm91cCB8fCAhdGhpcy5jb252ZXJzYXRpb25JZCkge1xyXG4gICAgICB0aGlzLm1lbnRpb25PcHRpb25zID0gW107XHJcbiAgICAgIHRoaXMubGFzdE1lbnRpb25Db252ZXJzYXRpb25JZCA9IG51bGw7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBjb252SWQgPSB0aGlzLmNvbnZlcnNhdGlvbklkO1xyXG4gICAgaWYgKCFmb3JjZSAmJiB0aGlzLmxhc3RNZW50aW9uQ29udmVyc2F0aW9uSWQgPT09IGNvbnZJZCAmJiB0aGlzLm1lbnRpb25PcHRpb25zLmxlbmd0aCA+IDApIHJldHVybjtcclxuICAgIHRoaXMubGFzdE1lbnRpb25Db252ZXJzYXRpb25JZCA9IGNvbnZJZDtcclxuXHJcbiAgICB0aGlzLmFwaS5nZXRDb252ZXJzYXRpb25QYXJ0aWNpcGFudHMoY29udklkKS5zdWJzY3JpYmUoe1xyXG4gICAgICBuZXh0OiAobWVtYmVycykgPT4ge1xyXG4gICAgICAgIGNvbnN0IG9wdGlvbnMgPSBtZW1iZXJzXHJcbiAgICAgICAgICAuZmlsdGVyKChtZW1iZXIpID0+IFN0cmluZyhtZW1iZXIuY29udGFjdF9pZCkgIT09IFN0cmluZyh0aGlzLmF1dGguY29udGFjdElkIHx8ICcnKSlcclxuICAgICAgICAgIC5tYXAoKG1lbWJlcikgPT4gdGhpcy5wYXJ0aWNpcGFudFRvTWVudGlvbk9wdGlvbihtZW1iZXIpKVxyXG4gICAgICAgICAgLmZpbHRlcigob3B0aW9uKTogb3B0aW9uIGlzIE1lbnRpb25PcHRpb24gPT4gISFvcHRpb24pO1xyXG4gICAgICAgIHRoaXMubWVudGlvbk9wdGlvbnMgPSBvcHRpb25zLmxlbmd0aCA/IG9wdGlvbnMgOiB0aGlzLmNvbnRhY3RzVG9NZW50aW9uT3B0aW9ucygpO1xyXG4gICAgICAgIHRoaXMuY2RyLm1hcmtGb3JDaGVjaygpO1xyXG4gICAgICB9LFxyXG4gICAgICBlcnJvcjogKCkgPT4ge1xyXG4gICAgICAgIHRoaXMubWVudGlvbk9wdGlvbnMgPSB0aGlzLmNvbnRhY3RzVG9NZW50aW9uT3B0aW9ucygpO1xyXG4gICAgICAgIHRoaXMuY2RyLm1hcmtGb3JDaGVjaygpO1xyXG4gICAgICB9LFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHBhcnRpY2lwYW50VG9NZW50aW9uT3B0aW9uKG1lbWJlcjogQ29udmVyc2F0aW9uUGFydGljaXBhbnQpOiBNZW50aW9uT3B0aW9uIHwgbnVsbCB7XHJcbiAgICBjb25zdCB0b2tlbiA9IHRoaXMudG9NZW50aW9uVG9rZW4obWVtYmVyLnVzZXJuYW1lIHx8IG1lbWJlci5lbWFpbCB8fCBTdHJpbmcobWVtYmVyLmNvbnRhY3RfaWQpKTtcclxuICAgIGlmICghdG9rZW4pIHJldHVybiBudWxsO1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgY29udGFjdElkOiBTdHJpbmcobWVtYmVyLmNvbnRhY3RfaWQpLFxyXG4gICAgICBsYWJlbDogbWVtYmVyLnVzZXJuYW1lIHx8IG1lbWJlci5lbWFpbCB8fCBgQ29udGFjdCAke21lbWJlci5jb250YWN0X2lkfWAsXHJcbiAgICAgIHRva2VuLFxyXG4gICAgfTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgY29udGFjdHNUb01lbnRpb25PcHRpb25zKCk6IE1lbnRpb25PcHRpb25bXSB7XHJcbiAgICByZXR1cm4gdGhpcy52aXNpYmxlQ29udGFjdHNcclxuICAgICAgLmZpbHRlcigoY29udGFjdCkgPT4gU3RyaW5nKGNvbnRhY3QuY29udGFjdF9pZCkgIT09IFN0cmluZyh0aGlzLmF1dGguY29udGFjdElkIHx8ICcnKSlcclxuICAgICAgLm1hcCgoY29udGFjdCkgPT4ge1xyXG4gICAgICAgIGNvbnN0IGxhYmVsID0gZ2V0Q29udGFjdERpc3BsYXlOYW1lKGNvbnRhY3QpO1xyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICBjb250YWN0SWQ6IFN0cmluZyhjb250YWN0LmNvbnRhY3RfaWQpLFxyXG4gICAgICAgICAgbGFiZWwsXHJcbiAgICAgICAgICB0b2tlbjogdGhpcy50b01lbnRpb25Ub2tlbihjb250YWN0LnVzZXJuYW1lIHx8IGNvbnRhY3QuZW1haWw/LnNwbGl0KCdAJylbMF0gfHwgbGFiZWwpLFxyXG4gICAgICAgIH07XHJcbiAgICAgIH0pXHJcbiAgICAgIC5maWx0ZXIoKG9wdGlvbikgPT4gISFvcHRpb24udG9rZW4pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSB0b01lbnRpb25Ub2tlbih2YWx1ZTogc3RyaW5nKTogc3RyaW5nIHtcclxuICAgIHJldHVybiBTdHJpbmcodmFsdWUgfHwgJycpXHJcbiAgICAgIC50cmltKClcclxuICAgICAgLnJlcGxhY2UoL15ALywgJycpXHJcbiAgICAgIC5yZXBsYWNlKC9ALiokLywgJycpXHJcbiAgICAgIC5yZXBsYWNlKC9bXmEtekEtWjAtOS5fLV0vZywgJycpXHJcbiAgICAgIC5zbGljZSgwLCAzMik7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGdldE1lbnRpb25JZHNGcm9tQ29udGVudChjb250ZW50OiBzdHJpbmcpOiBzdHJpbmdbXSB7XHJcbiAgICBpZiAoIXRoaXMuaXNHcm91cCB8fCAhY29udGVudCB8fCAhdGhpcy5tZW50aW9uT3B0aW9ucy5sZW5ndGgpIHJldHVybiBbXTtcclxuICAgIGNvbnN0IG1lbnRpb25lZFRva2VucyA9IG5ldyBTZXQoXHJcbiAgICAgIEFycmF5LmZyb20oY29udGVudC5tYXRjaEFsbCgvKF58W15hLXpBLVowLTkuXy1dKUAoW2EtekEtWjAtOS5fLV0rKS9nKSlcclxuICAgICAgICAubWFwKChtYXRjaCkgPT4gbWF0Y2hbMl0udG9Mb3dlckNhc2UoKSlcclxuICAgICk7XHJcbiAgICByZXR1cm4gdGhpcy5tZW50aW9uT3B0aW9uc1xyXG4gICAgICAuZmlsdGVyKChvcHRpb24pID0+IG1lbnRpb25lZFRva2Vucy5oYXMob3B0aW9uLnRva2VuLnRvTG93ZXJDYXNlKCkpKVxyXG4gICAgICAubWFwKChvcHRpb24pID0+IG9wdGlvbi5jb250YWN0SWQpO1xyXG4gIH1cclxuXHJcbiAgb25TZW5kTWVzc2FnZShwYXlsb2FkOiBNZXNzYWdlVGV4dFBheWxvYWQpOiB2b2lkIHtcclxuICAgIGlmICh0aGlzLmlzUmVtb3ZlZEZyb21Hcm91cCkgcmV0dXJuO1xyXG4gICAgY29uc3QgY29udGVudCA9IHBheWxvYWQudGV4dDtcclxuICAgIGNvbnN0IG1lbnRpb25zID0gdGhpcy5nZXRNZW50aW9uSWRzRnJvbUNvbnRlbnQoY29udGVudCk7XHJcbiAgICB0aGlzLnN0b3JlLnNlbmRNZXNzYWdlKHRoaXMuY29udmVyc2F0aW9uSWQsIGNvbnRlbnQsICdURVhUJywge1xyXG4gICAgICByZXBseVRvOiB0aGlzLnJlcGx5VG9NZXNzYWdlLFxyXG4gICAgICBtZW50aW9ucyxcclxuICAgICAgZm9yY2VQbGFpblRleHQ6IHBheWxvYWQuZm9yY2VQbGFpblRleHQsXHJcbiAgICB9KTtcclxuICAgIHRoaXMuY2xlYXJSZXBseSgpO1xyXG4gICAgdGhpcy5zaG91bGRTY3JvbGxUb0JvdHRvbSA9IHRydWU7XHJcbiAgfVxyXG5cclxuICBvblNlbmRXaXRoRmlsZXMocGF5bG9hZDogTWVzc2FnZVBheWxvYWQpOiB2b2lkIHtcclxuICAgIGlmICh0aGlzLmlzUmVtb3ZlZEZyb21Hcm91cCkgcmV0dXJuO1xyXG4gICAgaWYgKCF0aGlzLmNvbnZlcnNhdGlvbklkIHx8ICF0aGlzLmF1dGguY29udGFjdElkKSByZXR1cm47XHJcbiAgICB0aGlzLnVwbG9hZGluZyA9IHRydWU7XHJcblxyXG4gICAgLy8gU3RlcCAxOiBVcGxvYWQgYWxsIGZpbGVzIGFuZCBvYnRhaW4gcmVhbCBmaWxlX2lkcyBmcm9tIHRoZSBzZXJ2ZXIuXHJcbiAgICAvLyBUZW1wIElEcyBhcmUgTkVWRVIgc2VudCB0byBhbnkgQVBJIOKAlCB3ZSB3YWl0IGZvciByZWFsIElEcyBoZXJlLlxyXG4gICAgdGhpcy5maWxlU2VydmljZS51cGxvYWRGaWxlcyhwYXlsb2FkLmZpbGVzKS5zdWJzY3JpYmUoe1xyXG4gICAgICBuZXh0OiAocmVzcG9uc2VzKSA9PiB7XHJcbiAgICAgICAgY29uc3QgZmlsZUlkcyAgID0gcmVzcG9uc2VzLm1hcCgocikgPT4gci5maWxlX2lkKTtcclxuICAgICAgICBjb25zdCBmaWxlbmFtZXMgPSByZXNwb25zZXMubWFwKChyKSA9PiByLmZpbGVuYW1lKTtcclxuICAgICAgICBjb25zdCBtaW1lVHlwZXMgPSByZXNwb25zZXMubWFwKChyLCBpZHgpID0+IHIubWltZV90eXBlIHx8IHBheWxvYWQuZmlsZXNbaWR4XT8udHlwZSB8fCAnJyk7XHJcblxyXG4gICAgICAgIC8vIEd1YXJkOiBlbnN1cmUgYWxsIElEcyBhcmUgcmVhbCAobm90IHRlbXApXHJcbiAgICAgICAgY29uc3QgaGFzVGVtcCA9IGZpbGVJZHMuc29tZShpZCA9PiBpZD8uc3RhcnRzV2l0aCgndGVtcC0nKSk7XHJcbiAgICAgICAgaWYgKGhhc1RlbXApIHtcclxuICAgICAgICAgIHRoaXMudXBsb2FkaW5nID0gZmFsc2U7XHJcbiAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBTdGVwIDI6IFByZS13YXJtIGltYWdlIGNhY2hlIHNvIHRoZSBvcHRpbWlzdGljIGJ1YmJsZSByZW5kZXJzIGltbWVkaWF0ZWx5LlxyXG4gICAgICAgIHRoaXMuZmlsZVNlcnZpY2UucHJld2FybUNhY2hlKGZpbGVJZHMpO1xyXG5cclxuICAgICAgICAvLyBTdGVwIDM6IFNlbmQgdGhlIG1lc3NhZ2Ugd2l0aCB0aGUgcmVhbCBmaWxlX2lkcy5cclxuICAgICAgICBjb25zdCBtZXNzYWdlVGV4dCA9IHBheWxvYWQudGV4dCB8fCBmaWxlbmFtZXMuam9pbignLCAnKTtcclxuICAgICAgICBjb25zdCBvdXRnb2luZ1RleHQgPSB0aGlzLnN0b3JlLnByZXBhcmVPdXRnb2luZ01lc3NhZ2VDb250ZW50KG1lc3NhZ2VUZXh0LCB0aGlzLnJlcGx5VG9NZXNzYWdlLCBwYXlsb2FkLmZvcmNlUGxhaW5UZXh0KTtcclxuICAgICAgICBjb25zdCByZXBseVRvID0gdGhpcy5yZXBseVRvTWVzc2FnZSA/IHtcclxuICAgICAgICAgIG1lc3NhZ2VfaWQ6IFN0cmluZyh0aGlzLnJlcGx5VG9NZXNzYWdlLm1lc3NhZ2VfaWQgfHwgJycpLFxyXG4gICAgICAgICAgc2VuZGVyX25hbWU6IHRoaXMuZ2V0U2VuZGVyTmFtZSh0aGlzLnJlcGx5VG9NZXNzYWdlKSxcclxuICAgICAgICAgIGNvbnRlbnQ6IHRoaXMudHJ1bmNhdGVSZXBseVRleHQodGhpcy5nZXRNZXNzYWdlQm9keSh0aGlzLnJlcGx5VG9NZXNzYWdlKSB8fCB0aGlzLmdldEF0dGFjaG1lbnROYW1lKHRoaXMucmVwbHlUb01lc3NhZ2UpKSxcclxuICAgICAgICB9IDogdW5kZWZpbmVkO1xyXG4gICAgICAgIGNvbnN0IG1lbnRpb25zID0gdGhpcy5nZXRNZW50aW9uSWRzRnJvbUNvbnRlbnQobWVzc2FnZVRleHQpO1xyXG4gICAgICAgIHRoaXMuZmlsZVNlcnZpY2VcclxuICAgICAgICAgIC5zZW5kTWVzc2FnZVdpdGhBdHRhY2htZW50cyhcclxuICAgICAgICAgICAgdGhpcy5jb252ZXJzYXRpb25JZCEsXHJcbiAgICAgICAgICAgIHRoaXMuYXV0aC5jb250YWN0SWQhLFxyXG4gICAgICAgICAgICBvdXRnb2luZ1RleHQsXHJcbiAgICAgICAgICAgIGZpbGVJZHMsXHJcbiAgICAgICAgICAgIGZpbGVuYW1lcyxcclxuICAgICAgICAgICAgbWltZVR5cGVzXHJcbiAgICAgICAgICApXHJcbiAgICAgICAgICAuc3Vic2NyaWJlKHtcclxuICAgICAgICAgICAgbmV4dDogKHJlczogYW55KSA9PiB7XHJcbiAgICAgICAgICAgICAgdGhpcy51cGxvYWRpbmcgPSBmYWxzZTtcclxuICAgICAgICAgICAgICB0aGlzLnNob3VsZFNjcm9sbFRvQm90dG9tID0gdHJ1ZTtcclxuXHJcbiAgICAgICAgICAgICAgLy8gQWRkIG9wdGltaXN0aWMgbWVzc2FnZSBzbyB0aGUgaW1hZ2UgYXBwZWFycyBpbnN0YW50bHkg4oCUXHJcbiAgICAgICAgICAgICAgLy8gdGhlIFdlYlNvY2tldCBldmVudCBtYXkgYXJyaXZlIGEgbW9tZW50IGxhdGVyIGFuZCBkZWR1cCBpdC5cclxuICAgICAgICAgICAgICBjb25zdCBmaXJzdElkID0gZmlsZUlkc1swXSB8fCAnJztcclxuICAgICAgICAgICAgICBjb25zdCBpc0ltZyA9XHJcbiAgICAgICAgICAgICAgICAobWltZVR5cGVzWzBdIHx8ICcnKS5zdGFydHNXaXRoKCdpbWFnZS8nKSB8fFxyXG4gICAgICAgICAgICAgICAgL1xcLihwbmd8anBlP2d8Z2lmfHdlYnB8Ym1wfHN2Z3xoZWljfGhlaWYpJC9pLnRlc3QoZmlsZW5hbWVzWzBdIHx8ICcnKTtcclxuICAgICAgICAgICAgICBjb25zdCBvcHRpbWlzdGljOiBhbnkgPSB7XHJcbiAgICAgICAgICAgICAgICBtZXNzYWdlX2lkOiByZXM/Lm1lc3NhZ2VfaWQgPyBTdHJpbmcocmVzLm1lc3NhZ2VfaWQpIDogJ3RlbXAtJyArIERhdGUubm93KCksXHJcbiAgICAgICAgICAgICAgICBjb252ZXJzYXRpb25faWQ6IHRoaXMuY29udmVyc2F0aW9uSWQhLFxyXG4gICAgICAgICAgICAgICAgc2VuZGVyX2lkOiB0aGlzLmF1dGguY29udGFjdElkISxcclxuICAgICAgICAgICAgICAgIHNlbmRlcl9uYW1lOiAnWW91JyxcclxuICAgICAgICAgICAgICAgIG1lc3NhZ2VfdHlwZTogaXNJbWcgPyAnSU1BR0UnIDogJ0ZJTEUnLFxyXG4gICAgICAgICAgICAgICAgY29udGVudDogbWVzc2FnZVRleHQsXHJcbiAgICAgICAgICAgICAgICByZXBseV90bzogcmVwbHlUbyxcclxuICAgICAgICAgICAgICAgIG1lbnRpb25zLFxyXG4gICAgICAgICAgICAgICAgcmVuZGVyX2FzX3BsYWluX3RleHQ6IHBheWxvYWQuZm9yY2VQbGFpblRleHQsXHJcbiAgICAgICAgICAgICAgICBtZWRpYV91cmw6IGZpcnN0SWQsXHJcbiAgICAgICAgICAgICAgICBjcmVhdGVkX2F0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXHJcbiAgICAgICAgICAgICAgICBpc19yZWFkOiBmYWxzZSxcclxuICAgICAgICAgICAgICAgIGF0dGFjaG1lbnRzOiBmaWxlSWRzLm1hcCgoaWQsIGlkeCkgPT4gKHtcclxuICAgICAgICAgICAgICAgICAgZmlsZV9pZDogaWQsXHJcbiAgICAgICAgICAgICAgICAgIGZpbGVuYW1lOiBmaWxlbmFtZXNbaWR4XSB8fCBmaWxlbmFtZXNbMF0gfHwgYEF0dGFjaG1lbnQgJHtpZHggKyAxfWAsXHJcbiAgICAgICAgICAgICAgICAgIG1pbWVfdHlwZTogbWltZVR5cGVzW2lkeF0gfHwgdW5kZWZpbmVkLFxyXG4gICAgICAgICAgICAgICAgICBzaXplX2J5dGVzOiBwYXlsb2FkLmZpbGVzW2lkeF0/LnNpemUsXHJcbiAgICAgICAgICAgICAgICAgIHVybDogcmVzcG9uc2VzW2lkeF0/LnVybCxcclxuICAgICAgICAgICAgICAgIH0pKSxcclxuICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICAgIHRoaXMuc3RvcmUuYXBwZW5kT3B0aW1pc3RpY01lc3NhZ2Uob3B0aW1pc3RpYyk7XHJcbiAgICAgICAgICAgICAgdGhpcy5jbGVhclJlcGx5KCk7XHJcbiAgICAgICAgICAgICAgdGhpcy5jZHIubWFya0ZvckNoZWNrKCk7XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIGVycm9yOiAoKSA9PiB7XHJcbiAgICAgICAgICAgICAgdGhpcy51cGxvYWRpbmcgPSBmYWxzZTtcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgIH0pO1xyXG4gICAgICB9LFxyXG4gICAgICBlcnJvcjogKCkgPT4ge1xyXG4gICAgICAgIHRoaXMudXBsb2FkaW5nID0gZmFsc2U7XHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIGxvYWRPbGRlcigpOiB2b2lkIHtcclxuICAgIGlmICh0aGlzLmNvbnZlcnNhdGlvbklkICYmIHRoaXMubWVzc2FnZXMubGVuZ3RoID4gMCkge1xyXG4gICAgICB0aGlzLnN0b3JlLmxvYWRNZXNzYWdlcyh0aGlzLmNvbnZlcnNhdGlvbklkLCB0aGlzLm1lc3NhZ2VzWzBdLm1lc3NhZ2VfaWQpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgb25TY3JvbGwoKTogdm9pZCB7fVxyXG5cclxuICBvblRocmVhZERyYWdFbnRlcihldmVudDogRHJhZ0V2ZW50KTogdm9pZCB7XHJcbiAgICBpZiAodGhpcy5pc1JlbW92ZWRGcm9tR3JvdXApIHJldHVybjtcclxuICAgIGlmICghdGhpcy5kcmFnSGFzRmlsZXMoZXZlbnQpKSByZXR1cm47XHJcbiAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XHJcbiAgICB0aGlzLnRocmVhZERyYWdEZXB0aCsrO1xyXG4gICAgdGhpcy50aHJlYWREcmFnT3ZlciA9IHRydWU7XHJcbiAgfVxyXG5cclxuICBvblRocmVhZERyYWdPdmVyKGV2ZW50OiBEcmFnRXZlbnQpOiB2b2lkIHtcclxuICAgIGlmICh0aGlzLmlzUmVtb3ZlZEZyb21Hcm91cCkgcmV0dXJuO1xyXG4gICAgaWYgKCF0aGlzLmRyYWdIYXNGaWxlcyhldmVudCkpIHJldHVybjtcclxuICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcclxuICAgIGlmIChldmVudC5kYXRhVHJhbnNmZXIpIHtcclxuICAgICAgZXZlbnQuZGF0YVRyYW5zZmVyLmRyb3BFZmZlY3QgPSAnY29weSc7XHJcbiAgICB9XHJcbiAgICB0aGlzLnRocmVhZERyYWdPdmVyID0gdHJ1ZTtcclxuICB9XHJcblxyXG4gIG9uVGhyZWFkRHJhZ0xlYXZlKGV2ZW50OiBEcmFnRXZlbnQpOiB2b2lkIHtcclxuICAgIGlmICghdGhpcy5kcmFnSGFzRmlsZXMoZXZlbnQpKSByZXR1cm47XHJcbiAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XHJcbiAgICB0aGlzLnRocmVhZERyYWdEZXB0aCA9IE1hdGgubWF4KDAsIHRoaXMudGhyZWFkRHJhZ0RlcHRoIC0gMSk7XHJcbiAgICB0aGlzLnRocmVhZERyYWdPdmVyID0gdGhpcy50aHJlYWREcmFnRGVwdGggPiAwO1xyXG4gIH1cclxuXHJcbiAgb25UaHJlYWREcm9wKGV2ZW50OiBEcmFnRXZlbnQpOiB2b2lkIHtcclxuICAgIGlmICh0aGlzLmlzUmVtb3ZlZEZyb21Hcm91cCkgcmV0dXJuO1xyXG4gICAgaWYgKCF0aGlzLmRyYWdIYXNGaWxlcyhldmVudCkpIHJldHVybjtcclxuICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcclxuICAgIHRoaXMucmVzZXRUaHJlYWREcmFnKCk7XHJcbiAgICBjb25zdCBmaWxlcyA9IGV2ZW50LmRhdGFUcmFuc2Zlcj8uZmlsZXMgPyBBcnJheS5mcm9tKGV2ZW50LmRhdGFUcmFuc2Zlci5maWxlcykgOiBbXTtcclxuICAgIHRoaXMubWVzc2FnZUlucHV0Py5hZGRGaWxlcyhmaWxlcyk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHJlc2V0VGhyZWFkRHJhZygpOiB2b2lkIHtcclxuICAgIHRoaXMudGhyZWFkRHJhZ0RlcHRoID0gMDtcclxuICAgIHRoaXMudGhyZWFkRHJhZ092ZXIgPSBmYWxzZTtcclxuICB9XHJcblxyXG4gIGV4aXRSZW1vdmVkR3JvdXAoKTogdm9pZCB7XHJcbiAgICBpZiAodGhpcy5jb252ZXJzYXRpb25JZCkge1xyXG4gICAgICB0aGlzLnN0b3JlLmV4aXRSZW1vdmVkR3JvdXAodGhpcy5jb252ZXJzYXRpb25JZCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGRyYWdIYXNGaWxlcyhldmVudDogRHJhZ0V2ZW50KTogYm9vbGVhbiB7XHJcbiAgICBjb25zdCB0eXBlcyA9IGV2ZW50LmRhdGFUcmFuc2Zlcj8udHlwZXM7XHJcbiAgICBpZiAoIXR5cGVzKSByZXR1cm4gZmFsc2U7XHJcbiAgICByZXR1cm4gQXJyYXkuZnJvbSh0eXBlcykuaW5jbHVkZXMoJ0ZpbGVzJyk7XHJcbiAgfVxyXG5cclxuICBzaG91bGRTaG93RGF0ZVNlcGFyYXRvcihpbmRleDogbnVtYmVyKTogYm9vbGVhbiB7XHJcbiAgICBpZiAoaW5kZXggPT09IDApIHJldHVybiB0cnVlO1xyXG4gICAgY29uc3QgY3VyciA9IG5ldyBEYXRlKHRoaXMubWVzc2FnZXNbaW5kZXhdLmNyZWF0ZWRfYXQpLnRvRGF0ZVN0cmluZygpO1xyXG4gICAgY29uc3QgcHJldiA9IG5ldyBEYXRlKHRoaXMubWVzc2FnZXNbaW5kZXggLSAxXS5jcmVhdGVkX2F0KS50b0RhdGVTdHJpbmcoKTtcclxuICAgIHJldHVybiBjdXJyICE9PSBwcmV2O1xyXG4gIH1cclxuXHJcbiAgc2hvdWxkU2hvd1NlbmRlcihpbmRleDogbnVtYmVyKTogYm9vbGVhbiB7XHJcbiAgICBpZiAoaW5kZXggPT09IDApIHJldHVybiB0cnVlO1xyXG4gICAgcmV0dXJuIHRoaXMubWVzc2FnZXNbaW5kZXhdLnNlbmRlcl9pZCAhPT0gdGhpcy5tZXNzYWdlc1tpbmRleCAtIDFdLnNlbmRlcl9pZDtcclxuICB9XHJcblxyXG4gIGlzT3duTWVzc2FnZShtc2c6IE1lc3NhZ2UpOiBib29sZWFuIHtcclxuICAgIGNvbnN0IGN1cnJlbnRDb250YWN0SWQgPSB0aGlzLmF1dGguY29udGFjdElkIHx8IHRoaXMubXlDb250YWN0SWQ7XHJcbiAgICBpZiAoY3VycmVudENvbnRhY3RJZCAmJiBTdHJpbmcobXNnLnNlbmRlcl9pZCkgPT09IFN0cmluZyhjdXJyZW50Q29udGFjdElkKSkgcmV0dXJuIHRydWU7XHJcbiAgICBpZiAoU3RyaW5nKG1zZy5zZW5kZXJfbmFtZSB8fCAnJykudHJpbSgpLnRvTG93ZXJDYXNlKCkgPT09ICd5b3UnKSByZXR1cm4gdHJ1ZTtcclxuXHJcbiAgICBjb25zdCBjdXJyZW50ID0gdGhpcy5hdXRoLmN1cnJlbnRDb250YWN0O1xyXG4gICAgY29uc3Qgc2VuZGVyVXNlcm5hbWUgPSBTdHJpbmcobXNnLnNlbmRlcl91c2VybmFtZSB8fCAnJykudHJpbSgpLnRvTG93ZXJDYXNlKCk7XHJcbiAgICBjb25zdCBjdXJyZW50VXNlcm5hbWUgPSBTdHJpbmcoY3VycmVudD8udXNlcm5hbWUgfHwgJycpLnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xyXG4gICAgaWYgKHNlbmRlclVzZXJuYW1lICYmIGN1cnJlbnRVc2VybmFtZSAmJiBzZW5kZXJVc2VybmFtZSA9PT0gY3VycmVudFVzZXJuYW1lKSByZXR1cm4gdHJ1ZTtcclxuXHJcbiAgICBjb25zdCBzZW5kZXJOYW1lID0gZ2V0TWVzc2FnZVNlbmRlck5hbWUobXNnKS50cmltKCkudG9Mb3dlckNhc2UoKTtcclxuICAgIGNvbnN0IGN1cnJlbnROYW1lID0gY3VycmVudCA/IGdldENvbnRhY3REaXNwbGF5TmFtZShjdXJyZW50KS50cmltKCkudG9Mb3dlckNhc2UoKSA6ICcnO1xyXG4gICAgcmV0dXJuICEhc2VuZGVyTmFtZSAmJiAhIWN1cnJlbnROYW1lICYmIHNlbmRlck5hbWUgPT09IGN1cnJlbnROYW1lO1xyXG4gIH1cclxuXHJcbiAgY2FuRWRpdE1lc3NhZ2UobXNnOiBNZXNzYWdlKTogYm9vbGVhbiB7XHJcbiAgICByZXR1cm4gKFxyXG4gICAgICB0aGlzLmlzT3duTWVzc2FnZShtc2cpICYmXHJcbiAgICAgICF0aGlzLmlzRGVsZXRlZE1lc3NhZ2UobXNnKSAmJlxyXG4gICAgICBTdHJpbmcobXNnLm1lc3NhZ2VfdHlwZSB8fCAnJykudG9VcHBlckNhc2UoKSA9PT0gJ1RFWFQnICYmXHJcbiAgICAgICFTdHJpbmcobXNnLm1lc3NhZ2VfaWQgfHwgJycpLnN0YXJ0c1dpdGgoJ3RlbXAtJylcclxuICAgICk7XHJcbiAgfVxyXG5cclxuICBjYW5EZWxldGVNZXNzYWdlKG1zZzogTWVzc2FnZSk6IGJvb2xlYW4ge1xyXG4gICAgcmV0dXJuIChcclxuICAgICAgdGhpcy5pc093bk1lc3NhZ2UobXNnKSAmJlxyXG4gICAgICAhdGhpcy5pc0RlbGV0ZWRNZXNzYWdlKG1zZylcclxuICAgICk7XHJcbiAgfVxyXG5cclxuICBjYW5NYW5hZ2VNZXNzYWdlKG1zZzogTWVzc2FnZSk6IGJvb2xlYW4ge1xyXG4gICAgcmV0dXJuIHRoaXMuY2FuRWRpdE1lc3NhZ2UobXNnKSB8fCB0aGlzLmNhbkRlbGV0ZU1lc3NhZ2UobXNnKTtcclxuICB9XHJcblxyXG4gIGNhblJlcGx5TWVzc2FnZShtc2c6IE1lc3NhZ2UpOiBib29sZWFuIHtcclxuICAgIHJldHVybiAhdGhpcy5pc0RlbGV0ZWRNZXNzYWdlKG1zZykgJiYgIXRoaXMuaXNTeXN0ZW1NZXNzYWdlKG1zZyk7XHJcbiAgfVxyXG5cclxuICBpc0VkaXRpbmdNZXNzYWdlKG1zZzogTWVzc2FnZSk6IGJvb2xlYW4ge1xyXG4gICAgcmV0dXJuICEhdGhpcy5lZGl0aW5nTWVzc2FnZSAmJiBTdHJpbmcodGhpcy5lZGl0aW5nTWVzc2FnZS5tZXNzYWdlX2lkKSA9PT0gU3RyaW5nKG1zZy5tZXNzYWdlX2lkKTtcclxuICB9XHJcblxyXG4gIG9uSW5saW5lRWRpdElucHV0KGV2ZW50OiBFdmVudCk6IHZvaWQge1xyXG4gICAgdGhpcy5lZGl0aW5nRHJhZnQgPSAoZXZlbnQudGFyZ2V0IGFzIEhUTUxUZXh0QXJlYUVsZW1lbnQpLnZhbHVlO1xyXG4gIH1cclxuXHJcbiAgb25JbmxpbmVFZGl0S2V5ZG93bihldmVudDogS2V5Ym9hcmRFdmVudCk6IHZvaWQge1xyXG4gICAgaWYgKGV2ZW50LmtleSA9PT0gJ0VzY2FwZScpIHtcclxuICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgdGhpcy5jbGVhckVkaXQoKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICgoZXZlbnQuY3RybEtleSB8fCBldmVudC5tZXRhS2V5KSAmJiBldmVudC5rZXkgPT09ICdFbnRlcicpIHtcclxuICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgdGhpcy5zYXZlSW5saW5lRWRpdChldmVudCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBjYW5TYXZlSW5saW5lRWRpdCgpOiBib29sZWFuIHtcclxuICAgIGNvbnN0IG1lc3NhZ2UgPSB0aGlzLmVkaXRpbmdNZXNzYWdlO1xyXG4gICAgaWYgKCFtZXNzYWdlIHx8ICF0aGlzLmNhbkVkaXRNZXNzYWdlKG1lc3NhZ2UpKSByZXR1cm4gZmFsc2U7XHJcbiAgICBjb25zdCBuZXh0ID0gdGhpcy5lZGl0aW5nRHJhZnQudHJpbSgpO1xyXG4gICAgcmV0dXJuICEhbmV4dCAmJiBuZXh0ICE9PSB0aGlzLmdldE1lc3NhZ2VCb2R5KG1lc3NhZ2UpLnRyaW0oKTtcclxuICB9XHJcblxyXG4gIHNhdmVJbmxpbmVFZGl0KGV2ZW50PzogRXZlbnQpOiB2b2lkIHtcclxuICAgIGV2ZW50Py5zdG9wUHJvcGFnYXRpb24oKTtcclxuICAgIGNvbnN0IG1lc3NhZ2UgPSB0aGlzLmVkaXRpbmdNZXNzYWdlO1xyXG4gICAgaWYgKCFtZXNzYWdlIHx8ICF0aGlzLmNhblNhdmVJbmxpbmVFZGl0KCkpIHJldHVybjtcclxuICAgIHRoaXMuc3RvcmUuZWRpdE1lc3NhZ2UobWVzc2FnZS5tZXNzYWdlX2lkLCB0aGlzLmVkaXRpbmdEcmFmdC50cmltKCkpO1xyXG4gICAgdGhpcy5jbGVhckVkaXQoKTtcclxuICB9XHJcblxyXG4gIGNhbmNlbElubGluZUVkaXQoZXZlbnQ/OiBFdmVudCk6IHZvaWQge1xyXG4gICAgZXZlbnQ/LnN0b3BQcm9wYWdhdGlvbigpO1xyXG4gICAgdGhpcy5jbGVhckVkaXQoKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgc3RhcnRFZGl0TWVzc2FnZShtc2c6IE1lc3NhZ2UpOiB2b2lkIHtcclxuICAgIGlmICghdGhpcy5jYW5FZGl0TWVzc2FnZShtc2cpKSByZXR1cm47XHJcbiAgICB0aGlzLmNsZWFyUmVwbHkoKTtcclxuICAgIHRoaXMuZWRpdGluZ01lc3NhZ2UgPSBtc2c7XHJcbiAgICB0aGlzLmVkaXRpbmdEcmFmdCA9IHRoaXMuZ2V0TWVzc2FnZUJvZHkobXNnKTtcclxuICAgIHNldFRpbWVvdXQoKCkgPT4ge1xyXG4gICAgICBjb25zdCB0ZXh0YXJlYSA9IHRoaXMuaW5saW5lRWRpdFRleHRhcmVhcz8uZmlyc3Q/Lm5hdGl2ZUVsZW1lbnQ7XHJcbiAgICAgIHRleHRhcmVhPy5mb2N1cygpO1xyXG4gICAgICB0ZXh0YXJlYT8uc2VsZWN0KCk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIGlzU3lzdGVtTWVzc2FnZShtc2c6IE1lc3NhZ2UpOiBib29sZWFuIHtcclxuICAgIGNvbnN0IGNvbnRlbnQgPSBTdHJpbmcobXNnLmNvbnRlbnQgfHwgJycpLnRyaW0oKTtcclxuICAgIHJldHVybiBtc2cubWVzc2FnZV90eXBlID09PSAnU1lTVEVNJyB8fFxyXG4gICAgICAvXi4rIGFkZGVkIC4rIHRvIHRoZSBncm91cCQvLnRlc3QoY29udGVudCkgfHxcclxuICAgICAgL14uKyByZW1vdmVkIC4rIGZyb20gdGhlIGdyb3VwJC8udGVzdChjb250ZW50KTtcclxuICB9XHJcblxyXG4gIGlzUHJlZm9ybWF0dGVkVGV4dChtc2c6IE1lc3NhZ2UpOiBib29sZWFuIHtcclxuICAgIHJldHVybiB0aGlzLmlzUHJlZm9ybWF0dGVkQ29udGVudCh0aGlzLmdldE1lc3NhZ2VCb2R5KG1zZykpO1xyXG4gIH1cclxuXHJcbiAgaXNQcmVmb3JtYXR0ZWRDb250ZW50KGNvbnRlbnQ6IHN0cmluZyk6IGJvb2xlYW4ge1xyXG4gICAgcmV0dXJuIGNvbnRlbnQuaW5jbHVkZXMoJ1xcdCcpIHx8IGNvbnRlbnQuaW5jbHVkZXMoJ1xcbicpIHx8IC8gezIsfS8udGVzdChjb250ZW50KTtcclxuICB9XHJcblxyXG4gIGdldE1lc3NhZ2VDYXB0aW9uKG1zZzogTWVzc2FnZSk6IHN0cmluZyB7XHJcbiAgICBjb25zdCBjb250ZW50ID0gdGhpcy5nZXRNZXNzYWdlQm9keShtc2cpLnRyaW0oKTtcclxuICAgIGlmICghY29udGVudCkgcmV0dXJuICcnO1xyXG5cclxuICAgIGNvbnN0IGF0dGFjaG1lbnROYW1lcyA9IHRoaXMuZ2V0UmVuZGVyYWJsZUF0dGFjaG1lbnRzKG1zZylcclxuICAgICAgLm1hcCgoYXR0YWNobWVudCkgPT4gU3RyaW5nKGF0dGFjaG1lbnQuZmlsZW5hbWUgfHwgJycpLnRyaW0oKSlcclxuICAgICAgLmZpbHRlcihCb29sZWFuKTtcclxuICAgIGlmICghYXR0YWNobWVudE5hbWVzLmxlbmd0aCkgcmV0dXJuIGNvbnRlbnQ7XHJcblxyXG4gICAgY29uc3QgbmFtZXNUZXh0ID0gYXR0YWNobWVudE5hbWVzLmpvaW4oJywgJyk7XHJcbiAgICBpZiAoY29udGVudCA9PT0gbmFtZXNUZXh0IHx8IGF0dGFjaG1lbnROYW1lcy5pbmNsdWRlcyhjb250ZW50KSkgcmV0dXJuICcnO1xyXG4gICAgcmV0dXJuIGNvbnRlbnQ7XHJcbiAgfVxyXG5cclxuICBpc0NvZGVUZXh0KG1zZzogTWVzc2FnZSk6IGJvb2xlYW4ge1xyXG4gICAgcmV0dXJuIHRoaXMuaXNDb2RlQ29udGVudCh0aGlzLmdldE1lc3NhZ2VCb2R5KG1zZyksIG1zZyk7XHJcbiAgfVxyXG5cclxuICBpc0NvZGVDb250ZW50KHZhbHVlOiBzdHJpbmcsIG1zZz86IE1lc3NhZ2UpOiBib29sZWFuIHtcclxuICAgIGNvbnN0IGNvbnRlbnQgPSB2YWx1ZS50cmltKCk7XHJcbiAgICBpZiAobXNnPy5yZW5kZXJfYXNfcGxhaW5fdGV4dCkgcmV0dXJuIGZhbHNlO1xyXG4gICAgaWYgKCFjb250ZW50IHx8IChtc2cgPyB0aGlzLmlzVGFibGVUZXh0KG1zZykgOiB0aGlzLmlzVGFibGVDb250ZW50KGNvbnRlbnQpKSkgcmV0dXJuIGZhbHNlO1xyXG4gICAgaWYgKHRoaXMubG9va3NMaWtlTWFya2Rvd24oY29udGVudCkgJiYgIXRoaXMuaXNTaW5nbGVGZW5jZWRDb2RlQmxvY2soY29udGVudCkpIHJldHVybiBmYWxzZTtcclxuICAgIGlmICgvXmBgYFtcXHNcXFNdKmBgYCQvLnRlc3QoY29udGVudCkpIHJldHVybiB0cnVlO1xyXG4gICAgcmV0dXJuIHRoaXMuZGV0ZWN0Q29kZUxhbmd1YWdlKGNvbnRlbnQpICE9PSBudWxsO1xyXG4gIH1cclxuXHJcbiAgaXNNYXJrZG93blRleHQobXNnOiBNZXNzYWdlKTogYm9vbGVhbiB7XHJcbiAgICByZXR1cm4gdGhpcy5pc01hcmtkb3duQ29udGVudCh0aGlzLmdldE1lc3NhZ2VCb2R5KG1zZyksIG1zZyk7XHJcbiAgfVxyXG5cclxuICBpc01hcmtkb3duQ29udGVudCh2YWx1ZTogc3RyaW5nLCBtc2c/OiBNZXNzYWdlKTogYm9vbGVhbiB7XHJcbiAgICBjb25zdCBjb250ZW50ID0gdmFsdWUudHJpbSgpO1xyXG4gICAgaWYgKCFjb250ZW50IHx8IChtc2cgPyB0aGlzLmlzVGFibGVUZXh0KG1zZykgOiB0aGlzLmlzVGFibGVDb250ZW50KGNvbnRlbnQpKSB8fCB0aGlzLmlzU2luZ2xlRmVuY2VkQ29kZUJsb2NrKGNvbnRlbnQpKSByZXR1cm4gZmFsc2U7XHJcbiAgICByZXR1cm4gdGhpcy5sb29rc0xpa2VNYXJrZG93bihjb250ZW50KTtcclxuICB9XHJcblxyXG4gIGdldENvZGVMYW5ndWFnZShtc2c6IE1lc3NhZ2UpOiBzdHJpbmcge1xyXG4gICAgcmV0dXJuIHRoaXMuZ2V0Q29kZUxhbmd1YWdlQ29udGVudCh0aGlzLmdldE1lc3NhZ2VCb2R5KG1zZykpO1xyXG4gIH1cclxuXHJcbiAgZ2V0Q29kZUxhbmd1YWdlQ29udGVudChjb250ZW50OiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gICAgY29uc3QgcGFyc2VkID0gdGhpcy5wYXJzZUNvZGVCbG9jayhjb250ZW50KTtcclxuICAgIHJldHVybiBwYXJzZWQubGFuZ3VhZ2UgfHwgdGhpcy5kZXRlY3RDb2RlTGFuZ3VhZ2UocGFyc2VkLmNvZGUpIHx8ICdjb2RlJztcclxuICB9XHJcblxyXG4gIGdldEhpZ2hsaWdodGVkQ29kZShtc2c6IE1lc3NhZ2UpOiBTYWZlSHRtbCB7XHJcbiAgICByZXR1cm4gdGhpcy5nZXRIaWdobGlnaHRlZENvZGVDb250ZW50KHRoaXMuZ2V0TWVzc2FnZUJvZHkobXNnKSk7XHJcbiAgfVxyXG5cclxuICBnZXRIaWdobGlnaHRlZENvZGVDb250ZW50KGNvbnRlbnQ6IHN0cmluZyk6IFNhZmVIdG1sIHtcclxuICAgIGNvbnN0IHBhcnNlZCA9IHRoaXMucGFyc2VDb2RlQmxvY2soY29udGVudCk7XHJcbiAgICBjb25zdCBsYW5ndWFnZSA9IHBhcnNlZC5sYW5ndWFnZSB8fCB0aGlzLmRldGVjdENvZGVMYW5ndWFnZShwYXJzZWQuY29kZSkgfHwgJ2NvZGUnO1xyXG4gICAgY29uc3QgZXNjYXBlZCA9IHRoaXMuZXNjYXBlSHRtbChwYXJzZWQuY29kZSk7XHJcbiAgICBjb25zdCBoaWdobGlnaHRlZCA9IHRoaXMuaGlnaGxpZ2h0Q29kZShlc2NhcGVkLCBsYW5ndWFnZSk7XHJcbiAgICByZXR1cm4gdGhpcy5zYW5pdGl6ZXIuYnlwYXNzU2VjdXJpdHlUcnVzdEh0bWwoaGlnaGxpZ2h0ZWQpO1xyXG4gIH1cclxuXHJcbiAgZ2V0TWFya2Rvd25IdG1sKG1zZzogTWVzc2FnZSk6IFNhZmVIdG1sIHtcclxuICAgIHJldHVybiB0aGlzLmdldE1hcmtkb3duSHRtbENvbnRlbnQodGhpcy5nZXRNZXNzYWdlQm9keShtc2cpKTtcclxuICB9XHJcblxyXG4gIGdldE1hcmtkb3duSHRtbENvbnRlbnQoY29udGVudDogc3RyaW5nKTogU2FmZUh0bWwge1xyXG4gICAgcmV0dXJuIHRoaXMuc2FuaXRpemVyLmJ5cGFzc1NlY3VyaXR5VHJ1c3RIdG1sKHRoaXMucmVuZGVyTWFya2Rvd24oY29udGVudCkpO1xyXG4gIH1cclxuXHJcbiAgY29weUNvZGUobXNnOiBNZXNzYWdlLCBldmVudDogTW91c2VFdmVudCk6IHZvaWQge1xyXG4gICAgZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XHJcbiAgICBjb25zdCBjb250ZW50ID0gdGhpcy5nZXRNZXNzYWdlQm9keShtc2cpO1xyXG4gICAgY29uc3QgcGFyc2VkID0gdGhpcy5wYXJzZUNvZGVCbG9jayhjb250ZW50KTtcclxuICAgIHRoaXMuY29weVRleHQocGFyc2VkLmNvZGUgfHwgY29udGVudCk7XHJcbiAgfVxyXG5cclxuICBjb3B5TWVzc2FnZVRleHQobXNnOiBNZXNzYWdlLCBldmVudDogTW91c2VFdmVudCk6IHZvaWQge1xyXG4gICAgZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XHJcbiAgICB0aGlzLmNvcHlUZXh0KHRoaXMuZ2V0TWVzc2FnZUJvZHkobXNnKSk7XHJcbiAgfVxyXG5cclxuICBjb3B5VGV4dFZhbHVlKHRleHQ6IHN0cmluZywgZXZlbnQ6IE1vdXNlRXZlbnQpOiB2b2lkIHtcclxuICAgIGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xyXG4gICAgdGhpcy5jb3B5VGV4dCh0ZXh0KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgcGFyc2VDb2RlQmxvY2soY29udGVudDogc3RyaW5nKTogeyBsYW5ndWFnZTogc3RyaW5nOyBjb2RlOiBzdHJpbmcgfSB7XHJcbiAgICBjb25zdCB0cmltbWVkID0gY29udGVudC50cmltKCk7XHJcbiAgICBjb25zdCBtYXRjaCA9IHRyaW1tZWQubWF0Y2goL15gYGAoW2EtekEtWjAtOV8rLV0qKVxccypcXG4/KFtcXHNcXFNdKj8pYGBgJC8pO1xyXG4gICAgaWYgKCFtYXRjaCkgcmV0dXJuIHsgbGFuZ3VhZ2U6ICcnLCBjb2RlOiBjb250ZW50IH07XHJcbiAgICByZXR1cm4geyBsYW5ndWFnZTogKG1hdGNoWzFdIHx8ICcnKS50b0xvd2VyQ2FzZSgpLCBjb2RlOiBtYXRjaFsyXSB8fCAnJyB9O1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBpc1NpbmdsZUZlbmNlZENvZGVCbG9jayhjb250ZW50OiBzdHJpbmcpOiBib29sZWFuIHtcclxuICAgIHJldHVybiAvXmBgYFthLXpBLVowLTlfKy1dKlxccypcXG4/W1xcc1xcU10qP2BgYCQvLnRlc3QoY29udGVudC50cmltKCkpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBsb29rc0xpa2VNYXJrZG93bihjb250ZW50OiBzdHJpbmcpOiBib29sZWFuIHtcclxuICAgIHJldHVybiAvKF4jezEsNn1cXHMpfCheWy0qXVxccyl8KF5cXGQrXFwuXFxzKXwoXj5cXHMpfChcXCpcXCpbXipdK1xcKlxcKil8KGBbXmBdK2ApfChcXFtbXlxcXV0rXFxdXFwoW14pXStcXCkpfCheLS0tJCl8KF4tXFxzXFxbWyB4XVxcXVxccyl8KF5gYGBbYS16QS1aMC05XystXSpcXHMqJCkvbS50ZXN0KGNvbnRlbnQpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBkZXRlY3RDb2RlTGFuZ3VhZ2UoY29kZTogc3RyaW5nKTogc3RyaW5nIHwgbnVsbCB7XHJcbiAgICBjb25zdCB0cmltbWVkID0gY29kZS50cmltKCk7XHJcbiAgICBpZiAoIXRyaW1tZWQuaW5jbHVkZXMoJ1xcbicpICYmIHRyaW1tZWQubGVuZ3RoIDwgNDApIHJldHVybiBudWxsO1xyXG4gICAgaWYgKC9eXFxzKihzZWxlY3R8d2l0aHxpbnNlcnR8dXBkYXRlfGRlbGV0ZXxjcmVhdGV8YWx0ZXJ8ZHJvcClcXGIvaS50ZXN0KHRyaW1tZWQpKSByZXR1cm4gJ3NxbCc7XHJcbiAgICBjb25zdCBqc0RlY2xhcmF0aW9uID0gL1xcYihmdW5jdGlvbnxjb25zdHxsZXR8dmFyKVxccytbQS1aYS16XyRdW1xcdyRdKlxccyooPXw9PnxcXCh8OikvLnRlc3QodHJpbW1lZCk7XHJcbiAgICBjb25zdCBqc1N5bnRheCA9IC8oPT58Y29uc29sZVxcLmxvZ3xpbXBvcnRcXHMrLipmcm9tfGV4cG9ydFxccyt8W3t9O10pLy50ZXN0KHRyaW1tZWQpO1xyXG4gICAgaWYgKGpzRGVjbGFyYXRpb24gfHwganNTeW50YXgpIHJldHVybiAnamF2YXNjcmlwdCc7XHJcbiAgICBpZiAoL1xcYihkZWZ8aW1wb3J0fGZyb218cHJpbnR8Y2xhc3MpXFxiLy50ZXN0KHRyaW1tZWQpICYmIC86XFxzKiR8Xlxcc3s0fS9tLnRlc3QodHJpbW1lZCkpIHJldHVybiAncHl0aG9uJztcclxuICAgIGlmICgvPFxcLz9bYS16XVtcXHNcXFNdKj4vaS50ZXN0KHRyaW1tZWQpKSByZXR1cm4gJ2h0bWwnO1xyXG4gICAgaWYgKC9be307XS8udGVzdCh0cmltbWVkKSAmJiAvWzo9XS8udGVzdCh0cmltbWVkKSkgcmV0dXJuICdjb2RlJztcclxuICAgIHJldHVybiBudWxsO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBoaWdobGlnaHRDb2RlKGVzY2FwZWRDb2RlOiBzdHJpbmcsIGxhbmd1YWdlOiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gICAgY29uc3QgcHJvdGVjdGVkVG9rZW5zOiBzdHJpbmdbXSA9IFtdO1xyXG4gICAgY29uc3QgcHJvdGVjdCA9ICh2YWx1ZTogc3RyaW5nLCByZWdleDogUmVnRXhwLCBjbGFzc05hbWU6IHN0cmluZyk6IHN0cmluZyA9PlxyXG4gICAgICB2YWx1ZS5yZXBsYWNlKHJlZ2V4LCAobWF0Y2gpID0+IHtcclxuICAgICAgICBjb25zdCB0b2tlbiA9IGBfX0NPREVfVE9LRU5fJHtwcm90ZWN0ZWRUb2tlbnMubGVuZ3RofV9fYDtcclxuICAgICAgICBwcm90ZWN0ZWRUb2tlbnMucHVzaChgPHNwYW4gY2xhc3M9XCIke2NsYXNzTmFtZX1cIj4ke21hdGNofTwvc3Bhbj5gKTtcclxuICAgICAgICByZXR1cm4gdG9rZW47XHJcbiAgICAgIH0pO1xyXG5cclxuICAgIGxldCBoaWdobGlnaHRlZCA9IGVzY2FwZWRDb2RlO1xyXG5cclxuICAgIGlmIChsYW5ndWFnZSA9PT0gJ3NxbCcpIHtcclxuICAgICAgaGlnaGxpZ2h0ZWQgPSBwcm90ZWN0KGhpZ2hsaWdodGVkLCAvKC0tLiopJC9nbSwgJ2NvZGUtdG9rZW4tY29tbWVudCcpO1xyXG4gICAgICBoaWdobGlnaHRlZCA9IHByb3RlY3QoaGlnaGxpZ2h0ZWQsIC8oJnF1b3Q7Lio/JnF1b3Q7fCYjMzk7Lio/JiMzOTt8YC4qP2ApL2csICdjb2RlLXRva2VuLXN0cmluZycpO1xyXG4gICAgICBoaWdobGlnaHRlZCA9IGhpZ2hsaWdodGVkLnJlcGxhY2UoL1xcYihTRUxFQ1R8RlJPTXxXSEVSRXxKT0lOfExFRlR8UklHSFR8SU5ORVJ8T1VURVJ8T058R1JPVVAgQll8T1JERVIgQll8SU5TRVJUfElOVE98VkFMVUVTfFVQREFURXxTRVR8REVMRVRFfENSRUFURXxUQUJMRXxBTFRFUnxEUk9QfEFORHxPUnxOVUxMfElTfE5PVHxBU3xMSU1JVClcXGIvZ2ksICc8c3BhbiBjbGFzcz1cImNvZGUtdG9rZW4ta2V5d29yZFwiPiQxPC9zcGFuPicpO1xyXG4gICAgICBoaWdobGlnaHRlZCA9IGhpZ2hsaWdodGVkLnJlcGxhY2UoL1xcYihcXGQrKD86XFwuXFxkKyk/KVxcYi9nLCAnPHNwYW4gY2xhc3M9XCJjb2RlLXRva2VuLW51bWJlclwiPiQxPC9zcGFuPicpO1xyXG4gICAgICByZXR1cm4gdGhpcy5yZXN0b3JlQ29kZVRva2VucyhoaWdobGlnaHRlZCwgcHJvdGVjdGVkVG9rZW5zKTtcclxuICAgIH1cclxuXHJcbiAgICBoaWdobGlnaHRlZCA9IHByb3RlY3QoaGlnaGxpZ2h0ZWQsIC8oXFwvXFwvLip8Iy4qKSQvZ20sICdjb2RlLXRva2VuLWNvbW1lbnQnKTtcclxuICAgIGhpZ2hsaWdodGVkID0gcHJvdGVjdChoaWdobGlnaHRlZCwgLygmcXVvdDsuKj8mcXVvdDt8JiMzOTsuKj8mIzM5O3xgLio/YCkvZywgJ2NvZGUtdG9rZW4tc3RyaW5nJyk7XHJcbiAgICBoaWdobGlnaHRlZCA9IGhpZ2hsaWdodGVkLnJlcGxhY2UoL1xcYihmdW5jdGlvbnxjb25zdHxsZXR8dmFyfHJldHVybnxpZnxlbHNlfGZvcnx3aGlsZXxjbGFzc3xpbXBvcnR8ZnJvbXxleHBvcnR8YXN5bmN8YXdhaXR8ZGVmfHByaW50fHRyeXxjYXRjaHxuZXd8dHJ1ZXxmYWxzZXxudWxsfE5vbmUpXFxiL2csICc8c3BhbiBjbGFzcz1cImNvZGUtdG9rZW4ta2V5d29yZFwiPiQxPC9zcGFuPicpO1xyXG4gICAgaGlnaGxpZ2h0ZWQgPSBoaWdobGlnaHRlZC5yZXBsYWNlKC9cXGIoXFxkKyg/OlxcLlxcZCspPylcXGIvZywgJzxzcGFuIGNsYXNzPVwiY29kZS10b2tlbi1udW1iZXJcIj4kMTwvc3Bhbj4nKTtcclxuICAgIGhpZ2hsaWdodGVkID0gaGlnaGxpZ2h0ZWQucmVwbGFjZSgvXFxiKFthLXpBLVpfJF1bXFx3JF0qKSg/PVxcKCkvZywgJzxzcGFuIGNsYXNzPVwiY29kZS10b2tlbi1mdW5jdGlvblwiPiQxPC9zcGFuPicpO1xyXG4gICAgcmV0dXJuIHRoaXMucmVzdG9yZUNvZGVUb2tlbnMoaGlnaGxpZ2h0ZWQsIHByb3RlY3RlZFRva2Vucyk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHJlc3RvcmVDb2RlVG9rZW5zKHZhbHVlOiBzdHJpbmcsIHByb3RlY3RlZFRva2Vuczogc3RyaW5nW10pOiBzdHJpbmcge1xyXG4gICAgcmV0dXJuIHByb3RlY3RlZFRva2Vucy5yZWR1Y2UoXHJcbiAgICAgIChodG1sLCB0b2tlbiwgaW5kZXgpID0+IGh0bWwucmVwbGFjZShuZXcgUmVnRXhwKGBfX0NPREVfVE9LRU5fJHtpbmRleH1fX2AsICdnJyksIHRva2VuKSxcclxuICAgICAgdmFsdWVcclxuICAgICk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHJlbmRlck1hcmtkb3duKHJhdzogc3RyaW5nKTogc3RyaW5nIHtcclxuICAgIGNvbnN0IGNvZGVCbG9ja3M6IHN0cmluZ1tdID0gW107XHJcbiAgICBjb25zdCB3aXRob3V0Q29kZSA9IHJhdy5yZXBsYWNlKC9gYGAoW2EtekEtWjAtOV8rLV0qKVxccypcXG4/KFtcXHNcXFNdKj8pYGBgL2csIChfbWF0Y2gsIGxhbmcsIGNvZGUpID0+IHtcclxuICAgICAgY29uc3QgbGFuZ3VhZ2UgPSBTdHJpbmcobGFuZyB8fCAnY29kZScpLnRvTG93ZXJDYXNlKCk7XHJcbiAgICAgIGNvbnN0IHRva2VuID0gYF9fTURfQ09ERV8ke2NvZGVCbG9ja3MubGVuZ3RofV9fYDtcclxuICAgICAgY29kZUJsb2Nrcy5wdXNoKFxyXG4gICAgICAgIGA8cHJlPjxjb2RlIGRhdGEtbGFuZ3VhZ2U9XCIke3RoaXMuZXNjYXBlSHRtbChsYW5ndWFnZSl9XCI+JHt0aGlzLmVzY2FwZUh0bWwoU3RyaW5nKGNvZGUgfHwgJycpKX08L2NvZGU+PC9wcmU+YFxyXG4gICAgICApO1xyXG4gICAgICByZXR1cm4gdG9rZW47XHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zdCBsaW5lcyA9IHdpdGhvdXRDb2RlLnNwbGl0KC9cXHI/XFxuLyk7XHJcbiAgICBjb25zdCBodG1sOiBzdHJpbmdbXSA9IFtdO1xyXG4gICAgbGV0IGxpc3RUeXBlOiAndWwnIHwgJ29sJyB8IG51bGwgPSBudWxsO1xyXG5cclxuICAgIGNvbnN0IGNsb3NlTGlzdCA9ICgpID0+IHtcclxuICAgICAgaWYgKGxpc3RUeXBlKSB7XHJcbiAgICAgICAgaHRtbC5wdXNoKGA8LyR7bGlzdFR5cGV9PmApO1xyXG4gICAgICAgIGxpc3RUeXBlID0gbnVsbDtcclxuICAgICAgfVxyXG4gICAgfTtcclxuXHJcbiAgICBmb3IgKGNvbnN0IGxpbmUgb2YgbGluZXMpIHtcclxuICAgICAgY29uc3QgdHJpbW1lZCA9IGxpbmUudHJpbSgpO1xyXG5cclxuICAgICAgaWYgKCF0cmltbWVkKSB7XHJcbiAgICAgICAgY2xvc2VMaXN0KCk7XHJcbiAgICAgICAgY29udGludWU7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGNvbnN0IHRva2VuTWF0Y2ggPSB0cmltbWVkLm1hdGNoKC9eX19NRF9DT0RFXyhcXGQrKV9fJC8pO1xyXG4gICAgICBpZiAodG9rZW5NYXRjaCkge1xyXG4gICAgICAgIGNsb3NlTGlzdCgpO1xyXG4gICAgICAgIGh0bWwucHVzaChjb2RlQmxvY2tzW051bWJlcih0b2tlbk1hdGNoWzFdKV0gfHwgJycpO1xyXG4gICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBjb25zdCBoZWFkaW5nID0gdHJpbW1lZC5tYXRjaCgvXigjezEsM30pXFxzKyguKykkLyk7XHJcbiAgICAgIGlmIChoZWFkaW5nKSB7XHJcbiAgICAgICAgY2xvc2VMaXN0KCk7XHJcbiAgICAgICAgaHRtbC5wdXNoKGA8aCR7aGVhZGluZ1sxXS5sZW5ndGh9PiR7dGhpcy5yZW5kZXJNYXJrZG93bklubGluZShoZWFkaW5nWzJdKX08L2gke2hlYWRpbmdbMV0ubGVuZ3RofT5gKTtcclxuICAgICAgICBjb250aW51ZTtcclxuICAgICAgfVxyXG5cclxuICAgICAgaWYgKC9eLS0tKyQvLnRlc3QodHJpbW1lZCkpIHtcclxuICAgICAgICBjbG9zZUxpc3QoKTtcclxuICAgICAgICBodG1sLnB1c2goJzxocj4nKTtcclxuICAgICAgICBjb250aW51ZTtcclxuICAgICAgfVxyXG5cclxuICAgICAgY29uc3QgdW5vcmRlcmVkID0gdHJpbW1lZC5tYXRjaCgvXlstKl1cXHMrKD86XFxbWyB4XVxcXVxccyspPyguKykkL2kpO1xyXG4gICAgICBpZiAodW5vcmRlcmVkKSB7XHJcbiAgICAgICAgaWYgKGxpc3RUeXBlICE9PSAndWwnKSB7XHJcbiAgICAgICAgICBjbG9zZUxpc3QoKTtcclxuICAgICAgICAgIGh0bWwucHVzaCgnPHVsPicpO1xyXG4gICAgICAgICAgbGlzdFR5cGUgPSAndWwnO1xyXG4gICAgICAgIH1cclxuICAgICAgICBodG1sLnB1c2goYDxsaT4ke3RoaXMucmVuZGVyTWFya2Rvd25JbmxpbmUodW5vcmRlcmVkWzFdKX08L2xpPmApO1xyXG4gICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBjb25zdCBvcmRlcmVkID0gdHJpbW1lZC5tYXRjaCgvXlxcZCtcXC5cXHMrKC4rKSQvKTtcclxuICAgICAgaWYgKG9yZGVyZWQpIHtcclxuICAgICAgICBpZiAobGlzdFR5cGUgIT09ICdvbCcpIHtcclxuICAgICAgICAgIGNsb3NlTGlzdCgpO1xyXG4gICAgICAgICAgaHRtbC5wdXNoKCc8b2w+Jyk7XHJcbiAgICAgICAgICBsaXN0VHlwZSA9ICdvbCc7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGh0bWwucHVzaChgPGxpPiR7dGhpcy5yZW5kZXJNYXJrZG93bklubGluZShvcmRlcmVkWzFdKX08L2xpPmApO1xyXG4gICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBjb25zdCBxdW90ZSA9IHRyaW1tZWQubWF0Y2goL14+XFxzKyguKykkLyk7XHJcbiAgICAgIGlmIChxdW90ZSkge1xyXG4gICAgICAgIGNsb3NlTGlzdCgpO1xyXG4gICAgICAgIGh0bWwucHVzaChgPGJsb2NrcXVvdGU+JHt0aGlzLnJlbmRlck1hcmtkb3duSW5saW5lKHF1b3RlWzFdKX08L2Jsb2NrcXVvdGU+YCk7XHJcbiAgICAgICAgY29udGludWU7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGNsb3NlTGlzdCgpO1xyXG4gICAgICBodG1sLnB1c2goYDxwPiR7dGhpcy5yZW5kZXJNYXJrZG93bklubGluZSh0cmltbWVkKX08L3A+YCk7XHJcbiAgICB9XHJcblxyXG4gICAgY2xvc2VMaXN0KCk7XHJcbiAgICByZXR1cm4gaHRtbC5qb2luKCcnKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgcmVuZGVyTWFya2Rvd25JbmxpbmUodmFsdWU6IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgICBsZXQgaHRtbCA9IHRoaXMuZXNjYXBlSHRtbCh2YWx1ZSk7XHJcbiAgICBodG1sID0gaHRtbC5yZXBsYWNlKC9gKFteYF0rKWAvZywgJzxjb2RlPiQxPC9jb2RlPicpO1xyXG4gICAgaHRtbCA9IGh0bWwucmVwbGFjZSgvXFwqXFwqKFteKl0rKVxcKlxcKi9nLCAnPHN0cm9uZz4kMTwvc3Ryb25nPicpO1xyXG4gICAgaHRtbCA9IGh0bWwucmVwbGFjZSgvXFwqKFteKl0rKVxcKi9nLCAnPGVtPiQxPC9lbT4nKTtcclxuICAgIGh0bWwgPSBodG1sLnJlcGxhY2UoL1xcWyhbXlxcXV0rKVxcXVxcKChodHRwcz86XFwvXFwvW14pXFxzXSspXFwpL2csICc8YSBocmVmPVwiJDJcIiB0YXJnZXQ9XCJfYmxhbmtcIiByZWw9XCJub29wZW5lciBub3JlZmVycmVyXCI+JDE8L2E+Jyk7XHJcbiAgICByZXR1cm4gaHRtbDtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgY29weVRleHQodGV4dDogc3RyaW5nKTogdm9pZCB7XHJcbiAgICBpZiAoIXRleHQpIHJldHVybjtcclxuICAgIGlmIChuYXZpZ2F0b3IuY2xpcGJvYXJkPy53cml0ZVRleHQpIHtcclxuICAgICAgbmF2aWdhdG9yLmNsaXBib2FyZC53cml0ZVRleHQodGV4dCkudGhlbihcclxuICAgICAgICAoKSA9PiB0aGlzLnN0b3JlLnNob3dUb2FzdCgnQ29waWVkIHRvIGNsaXBib2FyZCcsICdzdWNjZXNzJywgMTYwMCksXHJcbiAgICAgICAgKCkgPT4gdGhpcy5mYWxsYmFja0NvcHlUZXh0KHRleHQpXHJcbiAgICAgICk7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIHRoaXMuZmFsbGJhY2tDb3B5VGV4dCh0ZXh0KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgZmFsbGJhY2tDb3B5VGV4dCh0ZXh0OiBzdHJpbmcpOiB2b2lkIHtcclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IHRleHRhcmVhID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgndGV4dGFyZWEnKTtcclxuICAgICAgdGV4dGFyZWEudmFsdWUgPSB0ZXh0O1xyXG4gICAgICB0ZXh0YXJlYS5zdHlsZS5wb3NpdGlvbiA9ICdmaXhlZCc7XHJcbiAgICAgIHRleHRhcmVhLnN0eWxlLmxlZnQgPSAnLTk5OTlweCc7XHJcbiAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQodGV4dGFyZWEpO1xyXG4gICAgICB0ZXh0YXJlYS5zZWxlY3QoKTtcclxuICAgICAgZG9jdW1lbnQuZXhlY0NvbW1hbmQoJ2NvcHknKTtcclxuICAgICAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZCh0ZXh0YXJlYSk7XHJcbiAgICAgIHRoaXMuc3RvcmUuc2hvd1RvYXN0KCdDb3BpZWQgdG8gY2xpcGJvYXJkJywgJ3N1Y2Nlc3MnLCAxNjAwKTtcclxuICAgIH0gY2F0Y2gge1xyXG4gICAgICB0aGlzLnN0b3JlLnNob3dUb2FzdCgnQ291bGQgbm90IGNvcHknLCAnZXJyb3InLCAyMjAwKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHByaXZhdGUgZXNjYXBlSHRtbCh2YWx1ZTogc3RyaW5nKTogc3RyaW5nIHtcclxuICAgIHJldHVybiB2YWx1ZVxyXG4gICAgICAucmVwbGFjZSgvJi9nLCAnJmFtcDsnKVxyXG4gICAgICAucmVwbGFjZSgvPC9nLCAnJmx0OycpXHJcbiAgICAgIC5yZXBsYWNlKC8+L2csICcmZ3Q7JylcclxuICAgICAgLnJlcGxhY2UoL1wiL2csICcmcXVvdDsnKVxyXG4gICAgICAucmVwbGFjZSgvJy9nLCAnJiMzOTsnKTtcclxuICB9XHJcblxyXG4gIGlzVGFibGVUZXh0KG1zZzogTWVzc2FnZSk6IGJvb2xlYW4ge1xyXG4gICAgY29uc3Qgcm93cyA9IHRoaXMuZ2V0VGFibGVSb3dzKG1zZyk7XHJcbiAgICByZXR1cm4gcm93cy5sZW5ndGggPj0gMiAmJiByb3dzLnNvbWUoKHJvdykgPT4gcm93Lmxlbmd0aCA+PSAyKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgaXNUYWJsZUNvbnRlbnQoY29udGVudDogc3RyaW5nKTogYm9vbGVhbiB7XHJcbiAgICBjb25zdCByb3dzID0gdGhpcy5nZXRUYWJsZVJvd3NGcm9tQ29udGVudChjb250ZW50KTtcclxuICAgIHJldHVybiByb3dzLmxlbmd0aCA+PSAyICYmIHJvd3Muc29tZSgocm93KSA9PiByb3cubGVuZ3RoID49IDIpO1xyXG4gIH1cclxuXHJcbiAgZ2V0VGFibGVSb3dzKG1zZzogTWVzc2FnZSk6IHN0cmluZ1tdW10ge1xyXG4gICAgcmV0dXJuIHRoaXMuZ2V0VGFibGVSb3dzRnJvbUNvbnRlbnQodGhpcy5nZXRNZXNzYWdlQm9keShtc2cpKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgZ2V0VGFibGVSb3dzRnJvbUNvbnRlbnQodmFsdWU6IHN0cmluZyk6IHN0cmluZ1tdW10ge1xyXG4gICAgY29uc3QgY29udGVudCA9IHZhbHVlLnRyaW0oKTtcclxuICAgIGlmICghY29udGVudC5pbmNsdWRlcygnXFx0JykpIHJldHVybiBbXTtcclxuXHJcbiAgICBjb25zdCByb3dzID0gY29udGVudFxyXG4gICAgICAuc3BsaXQoL1xccj9cXG4vKVxyXG4gICAgICAubWFwKChsaW5lKSA9PiBsaW5lLnNwbGl0KCdcXHQnKS5tYXAoKGNlbGwpID0+IGNlbGwudHJpbSgpKSlcclxuICAgICAgLmZpbHRlcigocm93KSA9PiByb3cuc29tZSgoY2VsbCkgPT4gY2VsbC5sZW5ndGggPiAwKSk7XHJcblxyXG4gICAgY29uc3QgbWF4Q29sdW1ucyA9IE1hdGgubWF4KDAsIC4uLnJvd3MubWFwKChyb3cpID0+IHJvdy5sZW5ndGgpKTtcclxuICAgIGlmIChtYXhDb2x1bW5zIDwgMikgcmV0dXJuIFtdO1xyXG5cclxuICAgIHJldHVybiByb3dzLm1hcCgocm93KSA9PiBbXHJcbiAgICAgIC4uLnJvdyxcclxuICAgICAgLi4uQXJyYXkuZnJvbSh7IGxlbmd0aDogbWF4Q29sdW1ucyAtIHJvdy5sZW5ndGggfSwgKCkgPT4gJycpLFxyXG4gICAgXSk7XHJcbiAgfVxyXG5cclxuICBpc01lc3NhZ2VSZWFkKG1zZzogTWVzc2FnZSk6IGJvb2xlYW4ge1xyXG4gICAgY29uc3QgdmFsdWUgPSBtc2cuaXNfcmVhZDtcclxuICAgIHJldHVybiB2YWx1ZSA9PT0gdHJ1ZSB8fCB2YWx1ZSA9PT0gJ3RydWUnIHx8IHZhbHVlID09PSAnVHJ1ZScgfHwgdmFsdWUgPT09ICcxJztcclxuICB9XHJcblxyXG4gIGdldFJlYWRUb29sdGlwKG1zZzogTWVzc2FnZSk6IHN0cmluZyB7XHJcbiAgICBpZiAoIXRoaXMuaXNHcm91cCkgcmV0dXJuICdSZWFkJztcclxuXHJcbiAgICBjb25zdCBuYW1lcyA9IHRoaXMuZ2V0UmVhZEJ5TmFtZXMobXNnKTtcclxuICAgIGlmIChuYW1lcy5sZW5ndGggPiAwKSB7XHJcbiAgICAgIHJldHVybiBgUmVhZCBieSAke25hbWVzLmpvaW4oJywgJyl9YDtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gJ1JlYWQnO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBnZXRSZWFkQnlOYW1lcyhtc2c6IE1lc3NhZ2UpOiBzdHJpbmdbXSB7XHJcbiAgICBjb25zdCBhbnlNc2cgPSBtc2cgYXMgYW55O1xyXG4gICAgY29uc3QgcmF3TmFtZXMgPSBbXHJcbiAgICAgIC4uLnRoaXMudG9SZWFkQXJyYXkoYW55TXNnLnJlYWRfYnlfbmFtZXMpLFxyXG4gICAgICAuLi50aGlzLnRvUmVhZEFycmF5KGFueU1zZy5yZWFkQnlOYW1lcyksXHJcbiAgICAgIC4uLnRoaXMudG9SZWFkQXJyYXkoYW55TXNnLnJlYWRlcl9uYW1lcyksXHJcbiAgICAgIC4uLnRoaXMudG9SZWFkQXJyYXkoYW55TXNnLnJlYWRlcnMpLFxyXG4gICAgICAuLi50aGlzLnRvUmVhZEFycmF5KGFueU1zZy5yZWFkX2J5KSxcclxuICAgICAgLi4udGhpcy50b1JlYWRBcnJheShhbnlNc2cucmVhZEJ5KSxcclxuICAgIF07XHJcblxyXG4gICAgY29uc3QgbmFtZXMgPSByYXdOYW1lc1xyXG4gICAgICAubWFwKChlbnRyeSkgPT4gdGhpcy5yZWFkRW50cnlUb05hbWUoZW50cnkpKVxyXG4gICAgICAuZmlsdGVyKChuYW1lKTogbmFtZSBpcyBzdHJpbmcgPT4gISFuYW1lICYmIG5hbWUgIT09ICdZb3UnKTtcclxuXHJcbiAgICByZXR1cm4gQXJyYXkuZnJvbShuZXcgU2V0KG5hbWVzKSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHRvUmVhZEFycmF5KHZhbHVlOiB1bmtub3duKTogdW5rbm93bltdIHtcclxuICAgIGlmICghdmFsdWUpIHJldHVybiBbXTtcclxuICAgIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkgcmV0dXJuIHZhbHVlO1xyXG4gICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcclxuICAgICAgY29uc3QgdHJpbW1lZCA9IHZhbHVlLnRyaW0oKTtcclxuICAgICAgaWYgKCF0cmltbWVkKSByZXR1cm4gW107XHJcbiAgICAgIHRyeSB7XHJcbiAgICAgICAgY29uc3QgcGFyc2VkID0gSlNPTi5wYXJzZSh0cmltbWVkKTtcclxuICAgICAgICByZXR1cm4gQXJyYXkuaXNBcnJheShwYXJzZWQpID8gcGFyc2VkIDogW3BhcnNlZF07XHJcbiAgICAgIH0gY2F0Y2gge1xyXG4gICAgICAgIHJldHVybiB0cmltbWVkLmluY2x1ZGVzKCcsJykgPyB0cmltbWVkLnNwbGl0KCcsJykubWFwKCh2KSA9PiB2LnRyaW0oKSkgOiBbdHJpbW1lZF07XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIHJldHVybiBbdmFsdWVdO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSByZWFkRW50cnlUb05hbWUoZW50cnk6IHVua25vd24pOiBzdHJpbmcgfCBudWxsIHtcclxuICAgIGlmIChlbnRyeSA9PSBudWxsKSByZXR1cm4gbnVsbDtcclxuICAgIGlmICh0eXBlb2YgZW50cnkgPT09ICdzdHJpbmcnIHx8IHR5cGVvZiBlbnRyeSA9PT0gJ251bWJlcicpIHtcclxuICAgICAgY29uc3QgaWRPck5hbWUgPSBTdHJpbmcoZW50cnkpLnRyaW0oKTtcclxuICAgICAgY29uc3QgY29udGFjdCA9IHRoaXMudmlzaWJsZUNvbnRhY3RzLmZpbmQoKGMpID0+IFN0cmluZyhjLmNvbnRhY3RfaWQpID09PSBpZE9yTmFtZSk7XHJcbiAgICAgIHJldHVybiBjb250YWN0ID8gZ2V0Q29udGFjdERpc3BsYXlOYW1lKGNvbnRhY3QpIDogaWRPck5hbWU7XHJcbiAgICB9XHJcbiAgICBpZiAodHlwZW9mIGVudHJ5ID09PSAnb2JqZWN0Jykge1xyXG4gICAgICBjb25zdCBvYmogPSBlbnRyeSBhcyBhbnk7XHJcbiAgICAgIGNvbnN0IGV4cGxpY2l0ID0gb2JqLnVzZXJuYW1lIHx8IG9iai5uYW1lIHx8IG9iai5kaXNwbGF5X25hbWUgfHwgb2JqLmRpc3BsYXlOYW1lIHx8IG9iai5lbWFpbDtcclxuICAgICAgaWYgKGV4cGxpY2l0KSByZXR1cm4gU3RyaW5nKGV4cGxpY2l0KTtcclxuICAgICAgaWYgKG9iai5jb250YWN0X2lkIHx8IG9iai5jb250YWN0SWQpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5yZWFkRW50cnlUb05hbWUob2JqLmNvbnRhY3RfaWQgfHwgb2JqLmNvbnRhY3RJZCk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIHJldHVybiBudWxsO1xyXG4gIH1cclxuXHJcbiAgZ2V0U2VuZGVyTmFtZShtc2c6IE1lc3NhZ2UpOiBzdHJpbmcge1xyXG4gICAgY29uc3QgZnJvbU1lc3NhZ2UgPSBnZXRNZXNzYWdlU2VuZGVyTmFtZShtc2cpO1xyXG4gICAgaWYgKGZyb21NZXNzYWdlICYmIGZyb21NZXNzYWdlICE9PSAnVW5rbm93bicpIHtcclxuICAgICAgcmV0dXJuIGZyb21NZXNzYWdlO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGZyb21Db250YWN0cyA9IHRoaXMudmlzaWJsZUNvbnRhY3RzLmZpbmQoXHJcbiAgICAgIChjKSA9PiBTdHJpbmcoYy5jb250YWN0X2lkKSA9PT0gU3RyaW5nKG1zZy5zZW5kZXJfaWQpXHJcbiAgICApO1xyXG4gICAgaWYgKGZyb21Db250YWN0cykge1xyXG4gICAgICByZXR1cm4gZ2V0Q29udGFjdERpc3BsYXlOYW1lKGZyb21Db250YWN0cyk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKHRoaXMuaXNPd25NZXNzYWdlKG1zZykpIHtcclxuICAgICAgcmV0dXJuICdZb3UnO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBgVXNlciAke21zZy5zZW5kZXJfaWR9YDtcclxuICB9XHJcblxyXG4gIGZvcm1hdFRpbWUoZGF0ZVN0cjogc3RyaW5nKTogc3RyaW5nIHtcclxuICAgIGlmICghZGF0ZVN0cikgcmV0dXJuICcnO1xyXG4gICAgY29uc3QgZCA9IG5ldyBEYXRlKGRhdGVTdHIpO1xyXG4gICAgcmV0dXJuIGQudG9Mb2NhbGVUaW1lU3RyaW5nKCdlbi1HQicsIHsgaG91cjogJzItZGlnaXQnLCBtaW51dGU6ICcyLWRpZ2l0JyB9KTtcclxuICB9XHJcblxyXG4gIGZvcm1hdERhdGUoZGF0ZVN0cjogc3RyaW5nKTogc3RyaW5nIHtcclxuICAgIGNvbnN0IGQgPSBuZXcgRGF0ZShkYXRlU3RyKTtcclxuICAgIGNvbnN0IHRvZGF5ID0gbmV3IERhdGUoKTtcclxuICAgIGNvbnN0IHllc3RlcmRheSA9IG5ldyBEYXRlKHRvZGF5KTtcclxuICAgIHllc3RlcmRheS5zZXREYXRlKHllc3RlcmRheS5nZXREYXRlKCkgLSAxKTtcclxuXHJcbiAgICBpZiAoZC50b0RhdGVTdHJpbmcoKSA9PT0gdG9kYXkudG9EYXRlU3RyaW5nKCkpIHJldHVybiAnVG9kYXknO1xyXG4gICAgaWYgKGQudG9EYXRlU3RyaW5nKCkgPT09IHllc3RlcmRheS50b0RhdGVTdHJpbmcoKSkgcmV0dXJuICdZZXN0ZXJkYXknO1xyXG4gICAgcmV0dXJuIGQudG9Mb2NhbGVEYXRlU3RyaW5nKCdlbi1HQicsIHsgZGF5OiAnbnVtZXJpYycsIG1vbnRoOiAnc2hvcnQnLCB5ZWFyOiAnbnVtZXJpYycgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHNjcm9sbFRvQm90dG9tKCk6IHZvaWQge1xyXG4gICAgdHJ5IHtcclxuICAgICAgY29uc3QgZWwgPSB0aGlzLnNjcm9sbENvbnRhaW5lcj8ubmF0aXZlRWxlbWVudDtcclxuICAgICAgaWYgKGVsKSB7XHJcbiAgICAgICAgZWwuc2Nyb2xsVG9wID0gZWwuc2Nyb2xsSGVpZ2h0O1xyXG4gICAgICB9XHJcbiAgICB9IGNhdGNoIHsgLyogaWdub3JlICovIH1cclxuICB9XHJcblxyXG4gIC8vIOKUgOKUgCBNZWRpYSBoZWxwZXJzIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG5cclxuICBwcml2YXRlIGdldEZpbGVuYW1lTGlrZShtc2c6IE1lc3NhZ2UsIGF0dGFjaG1lbnQ/OiBBdHRhY2htZW50KTogc3RyaW5nIHtcclxuICAgIGNvbnN0IGFueU1zZyA9IG1zZyBhcyBhbnk7XHJcbiAgICByZXR1cm4gU3RyaW5nKFxyXG4gICAgICBhdHRhY2htZW50Py5maWxlbmFtZSB8fFxyXG4gICAgICB0aGlzLmdldFByaW1hcnlBdHRhY2htZW50KG1zZyk/LmZpbGVuYW1lIHx8XHJcbiAgICAgIGFueU1zZz8uZmlsZW5hbWUgfHxcclxuICAgICAgYW55TXNnPy5maWxlX25hbWUgfHxcclxuICAgICAgbXNnLmNvbnRlbnQgfHxcclxuICAgICAgJydcclxuICAgICkudG9Mb3dlckNhc2UoKTtcclxuICB9XHJcblxyXG4gIGdldFJlbmRlcmFibGVBdHRhY2htZW50cyhtc2c6IE1lc3NhZ2UpOiBBdHRhY2htZW50W10ge1xyXG4gICAgY29uc3QgYXR0YWNobWVudHMgPSB0aGlzLmdldEFsbEF0dGFjaG1lbnRzKG1zZyk7XHJcbiAgICBpZiAoYXR0YWNobWVudHMubGVuZ3RoID4gMCkgcmV0dXJuIGF0dGFjaG1lbnRzO1xyXG4gICAgY29uc3QgcHJpbWFyeSA9IHRoaXMuZ2V0UHJpbWFyeUF0dGFjaG1lbnQobXNnKTtcclxuICAgIHJldHVybiBwcmltYXJ5ID8gW3ByaW1hcnldIDogW107XHJcbiAgfVxyXG5cclxuICB0cmFja0J5QXR0YWNobWVudChpbmRleDogbnVtYmVyLCBhdHRhY2htZW50OiBBdHRhY2htZW50KTogc3RyaW5nIHtcclxuICAgIHJldHVybiBhdHRhY2htZW50LmZpbGVfaWQgfHwgYXR0YWNobWVudC51cmwgfHwgYCR7YXR0YWNobWVudC5maWxlbmFtZX0tJHtpbmRleH1gO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBnZXRBbGxBdHRhY2htZW50cyhtc2c6IE1lc3NhZ2UpOiBBdHRhY2htZW50W10ge1xyXG4gICAgY29uc3QgYW55TXNnID0gbXNnIGFzIGFueTtcclxuICAgIGNvbnN0IGF0dGFjaG1lbnRzOiBBdHRhY2htZW50W10gPSBbXTtcclxuICAgIGNvbnN0IGFkZCA9IChhdHRhY2htZW50OiBQYXJ0aWFsPEF0dGFjaG1lbnQ+IHwgc3RyaW5nIHwgbnVsbCB8IHVuZGVmaW5lZCk6IHZvaWQgPT4ge1xyXG4gICAgICBjb25zdCByYXcgPSBhdHRhY2htZW50IGFzIGFueTtcclxuICAgICAgY29uc3QgZmlsZUlkID0gU3RyaW5nKFxyXG4gICAgICAgIHR5cGVvZiBhdHRhY2htZW50ID09PSAnc3RyaW5nJyA/IGF0dGFjaG1lbnQgOlxyXG4gICAgICAgIHJhdz8uZmlsZV9pZCA/P1xyXG4gICAgICAgIHJhdz8uZmlsZUlkID8/XHJcbiAgICAgICAgcmF3Py5pZCA/P1xyXG4gICAgICAgIHJhdz8uYXR0YWNobWVudF9pZCA/P1xyXG4gICAgICAgIHJhdz8uc3RvcmFnZV9maWxlX2lkID8/XHJcbiAgICAgICAgJydcclxuICAgICAgKS50cmltKCk7XHJcbiAgICAgIGlmIChmaWxlSWQuc3RhcnRzV2l0aCgneycpIHx8IGZpbGVJZC5zdGFydHNXaXRoKCdbJykpIHtcclxuICAgICAgICBjb25zdCBpZHMgPSB0aGlzLnRvQXJyYXkoZmlsZUlkKTtcclxuICAgICAgICBjb25zdCBmaWxlbmFtZXMgPSB0aGlzLnRvQXJyYXkocmF3Py5maWxlbmFtZXMgPz8gcmF3Py5maWxlbmFtZSA/PyByYXc/LmZpbGVfbmFtZSk7XHJcbiAgICAgICAgY29uc3QgbWltZVR5cGVzID0gdGhpcy50b0FycmF5KHJhdz8ubWltZV90eXBlcyA/PyByYXc/Lm1pbWVUeXBlcyA/PyByYXc/Lm1pbWVfdHlwZSk7XHJcbiAgICAgICAgaWRzLmZvckVhY2goKGlkLCBpZHgpID0+IHtcclxuICAgICAgICAgIGFkZCh7XHJcbiAgICAgICAgICAgIGZpbGVfaWQ6IGlkLFxyXG4gICAgICAgICAgICBmaWxlbmFtZTogZmlsZW5hbWVzW2lkeF0gfHwgZmlsZW5hbWVzWzBdIHx8IHJhdz8uZmlsZW5hbWUgfHwgcmF3Py5maWxlX25hbWUgfHwgYEF0dGFjaG1lbnQgJHtpZHggKyAxfWAsXHJcbiAgICAgICAgICAgIG1pbWVfdHlwZTogbWltZVR5cGVzW2lkeF0gfHwgcmF3Py5taW1lX3R5cGUgfHwgcmF3Py5taW1lVHlwZSxcclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIHJldHVybjtcclxuICAgICAgfVxyXG4gICAgICBjb25zdCB1cmwgPSBTdHJpbmcocmF3Py51cmwgPz8gcmF3Py5maWxlX3VybCA/PyByYXc/LmRvd25sb2FkX3VybCA/PyAnJykudHJpbSgpO1xyXG4gICAgICBpZiAoIWZpbGVJZCAmJiAhdXJsKSByZXR1cm47XHJcbiAgICAgIGlmIChmaWxlSWQgJiYgYXR0YWNobWVudHMuc29tZSgoYSkgPT4gYS5maWxlX2lkID09PSBmaWxlSWQpKSByZXR1cm47XHJcbiAgICAgIGlmICghZmlsZUlkICYmIHVybCAmJiBhdHRhY2htZW50cy5zb21lKChhKSA9PiBhLnVybCA9PT0gdXJsKSkgcmV0dXJuO1xyXG4gICAgICBhdHRhY2htZW50cy5wdXNoKHtcclxuICAgICAgICBmaWxlX2lkOiBmaWxlSWQsXHJcbiAgICAgICAgZmlsZW5hbWU6IFN0cmluZyhcclxuICAgICAgICAgIHJhdz8uZmlsZW5hbWUgPz9cclxuICAgICAgICAgIHJhdz8uZmlsZV9uYW1lID8/XHJcbiAgICAgICAgICByYXc/Lm5hbWUgPz9cclxuICAgICAgICAgIChtc2cubWVzc2FnZV90eXBlID09PSAnSU1BR0UnID8gJ0ltYWdlJyA6ICdGaWxlJylcclxuICAgICAgICApLFxyXG4gICAgICAgIG1pbWVfdHlwZTogcmF3Py5taW1lX3R5cGUgPz8gcmF3Py5taW1lVHlwZSA/PyAobXNnLm1lc3NhZ2VfdHlwZSA9PT0gJ0lNQUdFJyA/ICdpbWFnZS8qJyA6IHVuZGVmaW5lZCksXHJcbiAgICAgICAgc2l6ZV9ieXRlczogcmF3Py5zaXplX2J5dGVzID8/IHJhdz8uc2l6ZUJ5dGVzLFxyXG4gICAgICAgIHVybDogdXJsIHx8IHVuZGVmaW5lZCxcclxuICAgICAgfSk7XHJcbiAgICB9O1xyXG5cclxuICAgIGlmIChBcnJheS5pc0FycmF5KG1zZy5hdHRhY2htZW50cykpIHtcclxuICAgICAgbXNnLmF0dGFjaG1lbnRzLmZvckVhY2goYWRkKTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBtZWRpYVZhbHVlID0gU3RyaW5nKG1zZy5tZWRpYV91cmwgfHwgJycpLnRyaW0oKTtcclxuICAgIGlmIChtZWRpYVZhbHVlLnN0YXJ0c1dpdGgoJ3snKSB8fCBtZWRpYVZhbHVlLnN0YXJ0c1dpdGgoJ1snKSkge1xyXG4gICAgICB0cnkge1xyXG4gICAgICAgIGNvbnN0IHBhcnNlZCA9IEpTT04ucGFyc2UobWVkaWFWYWx1ZSk7XHJcbiAgICAgICAgY29uc3QgbWVkaWFBdHRhY2htZW50cyA9IEFycmF5LmlzQXJyYXkocGFyc2VkKSA/IHBhcnNlZCA6IHBhcnNlZD8uYXR0YWNobWVudHM7XHJcbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkobWVkaWFBdHRhY2htZW50cykpIHtcclxuICAgICAgICAgIG1lZGlhQXR0YWNobWVudHMuZm9yRWFjaChhZGQpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkocGFyc2VkKSkge1xyXG4gICAgICAgICAgY29uc3QgaWRzID0gdGhpcy50b0FycmF5KHBhcnNlZD8uaWRzID8/IHBhcnNlZD8uZmlsZV9pZHMgPz8gcGFyc2VkPy5hdHRhY2htZW50X2lkcyk7XHJcbiAgICAgICAgICBjb25zdCBmaWxlbmFtZXMgPSB0aGlzLnRvQXJyYXkocGFyc2VkPy5maWxlbmFtZXMpO1xyXG4gICAgICAgICAgY29uc3QgbWltZVR5cGVzID0gdGhpcy50b0FycmF5KHBhcnNlZD8ubWltZV90eXBlcyA/PyBwYXJzZWQ/Lm1pbWVUeXBlcyk7XHJcbiAgICAgICAgICBpZHMuZm9yRWFjaCgoaWQsIGlkeCkgPT4ge1xyXG4gICAgICAgICAgICBhZGQoe1xyXG4gICAgICAgICAgICAgIGZpbGVfaWQ6IGlkLFxyXG4gICAgICAgICAgICAgIGZpbGVuYW1lOiBmaWxlbmFtZXNbaWR4XSB8fCBmaWxlbmFtZXNbMF0gfHwgKG1zZy5tZXNzYWdlX3R5cGUgPT09ICdJTUFHRScgPyBgSW1hZ2UgJHtpZHggKyAxfWAgOiBgQXR0YWNobWVudCAke2lkeCArIDF9YCksXHJcbiAgICAgICAgICAgICAgbWltZV90eXBlOiBtaW1lVHlwZXNbaWR4XSB8fCAobXNnLm1lc3NhZ2VfdHlwZSA9PT0gJ0lNQUdFJyA/ICdpbWFnZS8qJyA6IHVuZGVmaW5lZCksXHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9IGNhdGNoIHtcclxuICAgICAgICAvLyBOb24tSlNPTiBtZWRpYV91cmwgdmFsdWVzIGFyZSBoYW5kbGVkIGJ5IGdldFByaW1hcnlBdHRhY2htZW50KCkuXHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBpZHMgPSB0aGlzLnRvQXJyYXkoYW55TXNnPy5hdHRhY2htZW50X2lkcyA/PyBhbnlNc2c/LmZpbGVfaWRzKTtcclxuICAgIGNvbnN0IGZpbGVuYW1lcyA9IHRoaXMudG9BcnJheShhbnlNc2c/LmZpbGVuYW1lcyk7XHJcbiAgICBjb25zdCBtaW1lVHlwZXMgPSB0aGlzLnRvQXJyYXkoYW55TXNnPy5taW1lX3R5cGVzID8/IGFueU1zZz8ubWltZVR5cGVzKTtcclxuICAgIGlkcy5mb3JFYWNoKChpZCwgaWR4KSA9PiB7XHJcbiAgICAgIGFkZCh7XHJcbiAgICAgICAgZmlsZV9pZDogaWQsXHJcbiAgICAgICAgZmlsZW5hbWU6IGZpbGVuYW1lc1tpZHhdIHx8IGZpbGVuYW1lc1swXSB8fCAobXNnLm1lc3NhZ2VfdHlwZSA9PT0gJ0lNQUdFJyA/IGBJbWFnZSAke2lkeCArIDF9YCA6IGBBdHRhY2htZW50ICR7aWR4ICsgMX1gKSxcclxuICAgICAgICBtaW1lX3R5cGU6IG1pbWVUeXBlc1tpZHhdIHx8IGFueU1zZz8ubWltZV90eXBlIHx8IGFueU1zZz8uYXR0YWNobWVudF9taW1lX3R5cGUgfHwgKG1zZy5tZXNzYWdlX3R5cGUgPT09ICdJTUFHRScgPyAnaW1hZ2UvKicgOiB1bmRlZmluZWQpLFxyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG5cclxuICAgIHJldHVybiBhdHRhY2htZW50cztcclxuICB9XHJcblxyXG4gIHByaXZhdGUgdG9BcnJheSh2YWx1ZTogdW5rbm93bik6IHN0cmluZ1tdIHtcclxuICAgIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkge1xyXG4gICAgICByZXR1cm4gdmFsdWVcclxuICAgICAgICAubWFwKCh4OiBhbnkpID0+ICh0eXBlb2YgeCA9PT0gJ3N0cmluZycgPyB4IDogeD8uZmlsZV9pZCA/PyB4Py5pZCA/PyAnJykpXHJcbiAgICAgICAgLm1hcCgoeCkgPT4gU3RyaW5nKHgpLnRyaW0oKSlcclxuICAgICAgICAuZmlsdGVyKEJvb2xlYW4pO1xyXG4gICAgfVxyXG4gICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycgJiYgdmFsdWUudHJpbSgpKSB7XHJcbiAgICAgIGNvbnN0IHRyaW1tZWQgPSB2YWx1ZS50cmltKCk7XHJcbiAgICAgIGlmICh0cmltbWVkLnN0YXJ0c1dpdGgoJ3snKSB8fCB0cmltbWVkLnN0YXJ0c1dpdGgoJ1snKSkge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICBjb25zdCBwYXJzZWQgPSBKU09OLnBhcnNlKHRyaW1tZWQpO1xyXG4gICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkocGFyc2VkKSkgcmV0dXJuIHRoaXMudG9BcnJheShwYXJzZWQpO1xyXG4gICAgICAgICAgcmV0dXJuIHRoaXMudG9BcnJheShwYXJzZWQ/LmlkcyA/PyBwYXJzZWQ/LmZpbGVfaWRzID8/IHBhcnNlZD8uYXR0YWNobWVudF9pZHMgPz8gcGFyc2VkPy5hdHRhY2htZW50cyk7XHJcbiAgICAgICAgfSBjYXRjaCB7XHJcbiAgICAgICAgICByZXR1cm4gW107XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiB2YWx1ZVxyXG4gICAgICAgIC5zcGxpdCgvWyxcXHNdKy8pXHJcbiAgICAgICAgLm1hcCgoeCkgPT4geC50cmltKCkpXHJcbiAgICAgICAgLmZpbHRlcihCb29sZWFuKTtcclxuICAgIH1cclxuICAgIHJldHVybiBbXTtcclxuICB9XHJcblxyXG4gIC8qKiBSZXR1cm5zIHRoZSBwcmltYXJ5IGF0dGFjaG1lbnQgZm9yIGEgbWVzc2FnZSwgaWYgYW55LiAqL1xyXG4gIHByaXZhdGUgZ2V0UHJpbWFyeUF0dGFjaG1lbnQobXNnOiBNZXNzYWdlKTogQXR0YWNobWVudCB8IG51bGwge1xyXG4gICAgY29uc3QgYXR0YWNobWVudHMgPSB0aGlzLmdldEFsbEF0dGFjaG1lbnRzKG1zZyk7XHJcbiAgICBpZiAoYXR0YWNobWVudHMubGVuZ3RoID4gMCkgcmV0dXJuIGF0dGFjaG1lbnRzWzBdO1xyXG5cclxuICAgIC8vIFNvbWUgQVBJIHJlc3BvbnNlcyBwcm92aWRlIGZpbGUgbWV0YWRhdGEgaW4gYWx0ZXJuYXRlIGZpZWxkcy5cclxuICAgIGNvbnN0IGFueU1zZyA9IG1zZyBhcyBhbnk7XHJcbiAgICBjb25zdCBtdSA9IFN0cmluZyhtc2cubWVkaWFfdXJsIHx8ICcnKS50cmltKCk7XHJcbiAgICBjb25zdCBtZWRpYUlzRGlyZWN0VXJsID1cclxuICAgICAgbXUuc3RhcnRzV2l0aCgnaHR0cDovLycpIHx8IG11LnN0YXJ0c1dpdGgoJ2h0dHBzOi8vJykgfHwgbXUuc3RhcnRzV2l0aCgnZGF0YTonKTtcclxuICAgIGNvbnN0IG1lZGlhSXNTdHJ1Y3R1cmVkID0gbXUuc3RhcnRzV2l0aCgneycpIHx8IG11LnN0YXJ0c1dpdGgoJ1snKTtcclxuICAgIGNvbnN0IGZpbGVJZCA9XHJcbiAgICAgIGFueU1zZz8uZmlsZV9pZCB8fFxyXG4gICAgICBhbnlNc2c/LmF0dGFjaG1lbnRfaWQgfHxcclxuICAgICAgYW55TXNnPy5hdHRhY2htZW50X2lkcz8uWzBdIHx8XHJcbiAgICAgICghbWVkaWFJc0RpcmVjdFVybCAmJiAhbWVkaWFJc1N0cnVjdHVyZWQgJiYgbXUgPyBtdSA6IHVuZGVmaW5lZCk7XHJcbiAgICBjb25zdCBtaW1lID0gYW55TXNnPy5taW1lX3R5cGUgfHwgYW55TXNnPy5hdHRhY2htZW50X21pbWVfdHlwZSB8fCAobXNnLm1lc3NhZ2VfdHlwZSA9PT0gJ0lNQUdFJyA/ICdpbWFnZS8qJyA6IHVuZGVmaW5lZCk7XHJcbiAgICBjb25zdCBleHBsaWNpdEZpbGVuYW1lID0gYW55TXNnPy5maWxlbmFtZSB8fCBhbnlNc2c/LmZpbGVfbmFtZTtcclxuICAgIGNvbnN0IGZpbGVuYW1lID1cclxuICAgICAgZXhwbGljaXRGaWxlbmFtZSB8fFxyXG4gICAgICAobXNnLm1lc3NhZ2VfdHlwZSA9PT0gJ0lNQUdFJyA/ICdJbWFnZScgOiBtc2cubWVzc2FnZV90eXBlID09PSAnRklMRScgPyAnRmlsZScgOiAnJyk7XHJcbiAgICBpZiAoZmlsZUlkIHx8IGV4cGxpY2l0RmlsZW5hbWUgfHwgbWltZSB8fCBtc2cubWVzc2FnZV90eXBlID09PSAnRklMRScgfHwgbXNnLm1lc3NhZ2VfdHlwZSA9PT0gJ0lNQUdFJykge1xyXG4gICAgICByZXR1cm4ge1xyXG4gICAgICAgIGZpbGVfaWQ6IFN0cmluZyhmaWxlSWQgfHwgJycpLFxyXG4gICAgICAgIGZpbGVuYW1lOiBTdHJpbmcoZmlsZW5hbWUgfHwgJ0ZpbGUnKSxcclxuICAgICAgICBtaW1lX3R5cGU6IG1pbWUgPyBTdHJpbmcobWltZSkgOiB1bmRlZmluZWQsXHJcbiAgICAgICAgdXJsOiBtZWRpYUlzRGlyZWN0VXJsID8gbXUgOiB1bmRlZmluZWQsXHJcbiAgICAgIH07XHJcbiAgICB9XHJcbiAgICByZXR1cm4gbnVsbDtcclxuICB9XHJcblxyXG4gIGlzSW1hZ2VBdHRhY2htZW50KG1zZzogTWVzc2FnZSwgYXR0YWNobWVudD86IEF0dGFjaG1lbnQpOiBib29sZWFuIHtcclxuICAgIGNvbnN0IG1pbWUgPSBhdHRhY2htZW50Py5taW1lX3R5cGUgfHwgdGhpcy5nZXRQcmltYXJ5QXR0YWNobWVudChtc2cpPy5taW1lX3R5cGUgfHwgJyc7XHJcbiAgICBpZiAobWltZS5zdGFydHNXaXRoKCdpbWFnZS8nKSkgcmV0dXJuIHRydWU7XHJcbiAgICBjb25zdCBuYW1lID0gdGhpcy5nZXRGaWxlbmFtZUxpa2UobXNnLCBhdHRhY2htZW50KTtcclxuICAgIGlmICgvXFwuKHBuZ3xqcGU/Z3xnaWZ8d2VicHxibXB8c3ZnfGhlaWN8aGVpZikkL2kudGVzdChuYW1lKSkgcmV0dXJuIHRydWU7XHJcbiAgICByZXR1cm4gbXNnLm1lc3NhZ2VfdHlwZSA9PT0gJ0lNQUdFJztcclxuICB9XHJcblxyXG4gIC8qKiBSZXR1cm5zIHRoZSBjYWNoZWQgZGF0YSBVUkwgZm9yIGEgbWVzc2FnZSdzIG1lZGlhLCBvciBudWxsIGFuZCB0cmlnZ2VycyBiYWNrZ3JvdW5kIGxvYWQuICovXHJcbiAgZ2V0TWVkaWFVcmwobXNnOiBNZXNzYWdlLCBhdHRhY2htZW50PzogQXR0YWNobWVudCk6IHN0cmluZyB8IG51bGwge1xyXG4gICAgY29uc3QgYXR0ID0gYXR0YWNobWVudCB8fCB0aGlzLmdldFByaW1hcnlBdHRhY2htZW50KG1zZyk7XHJcbiAgICBjb25zdCBmaWxlSWQgPSBhdHQ/LmZpbGVfaWQ/LnRyaW0oKTtcclxuXHJcbiAgICBjb25zdCBkaXJlY3RVcmwgPVxyXG4gICAgICBhdHQ/LnVybCB8fFxyXG4gICAgICAoIWF0dGFjaG1lbnQgPyBtc2cubWVkaWFfdXJsIDogdW5kZWZpbmVkKSB8fFxyXG4gICAgICAoIWF0dGFjaG1lbnQgPyAobXNnIGFzIGFueSk/LnVybCA6IHVuZGVmaW5lZCkgfHxcclxuICAgICAgKCFhdHRhY2htZW50ID8gKG1zZyBhcyBhbnkpPy5maWxlX3VybCA6IHVuZGVmaW5lZCk7XHJcbiAgICBpZiAoXHJcbiAgICAgIGRpcmVjdFVybCAmJlxyXG4gICAgICAoZGlyZWN0VXJsLnN0YXJ0c1dpdGgoJ2h0dHA6Ly8nKSB8fFxyXG4gICAgICAgIGRpcmVjdFVybC5zdGFydHNXaXRoKCdodHRwczovLycpIHx8XHJcbiAgICAgICAgZGlyZWN0VXJsLnN0YXJ0c1dpdGgoJ2RhdGE6JykpXHJcbiAgICApIHtcclxuICAgICAgcmV0dXJuIGRpcmVjdFVybDtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoIWZpbGVJZCkge1xyXG4gICAgICByZXR1cm4gbnVsbDtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBjYWNoZWQgPSB0aGlzLmZpbGVTZXJ2aWNlLmdldENhY2hlZERhdGFVcmwoZmlsZUlkKTtcclxuICAgIGlmIChjYWNoZWQpIHJldHVybiBjYWNoZWQ7XHJcbiAgICBpZiAodGhpcy5tZWRpYUZhaWxlZC5oYXMoZmlsZUlkKSkgcmV0dXJuIG51bGw7XHJcblxyXG4gICAgLy8gTm90IHlldCBjYWNoZWQg4oCUIGtpY2sgb2ZmIGEgYmFja2dyb3VuZCBmZXRjaFxyXG4gICAgdGhpcy5mZXRjaE1lZGlhKGZpbGVJZCk7XHJcbiAgICByZXR1cm4gbnVsbDtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgcHJld2FybU1lZGlhKG1lc3NhZ2VzOiBNZXNzYWdlW10pOiB2b2lkIHtcclxuICAgIGZvciAoY29uc3QgbXNnIG9mIG1lc3NhZ2VzKSB7XHJcbiAgICAgIGZvciAoY29uc3QgYXR0IG9mIHRoaXMuZ2V0UmVuZGVyYWJsZUF0dGFjaG1lbnRzKG1zZykpIHtcclxuICAgICAgICBpZiAoIXRoaXMuaXNJbWFnZUF0dGFjaG1lbnQobXNnLCBhdHQpKSBjb250aW51ZTtcclxuICAgICAgICBjb25zdCBmaWxlSWQgPSBhdHQuZmlsZV9pZD8udHJpbSgpO1xyXG4gICAgICAgIGlmICghZmlsZUlkIHx8IGZpbGVJZC5zdGFydHNXaXRoKCd0ZW1wLScpKSBjb250aW51ZTtcclxuICAgICAgICBpZiAodGhpcy5tZWRpYUZhaWxlZC5oYXMoZmlsZUlkKSkgY29udGludWU7XHJcbiAgICAgICAgaWYgKHRoaXMuZmlsZVNlcnZpY2UuZ2V0Q2FjaGVkRGF0YVVybChmaWxlSWQpKSBjb250aW51ZTtcclxuICAgICAgICAvLyBRdWV1ZSBhbGwgZmlsZXMgc28gZG93bmxvYWQgbGlua3MgYXBwZWFyIG9uY2UgcmV0cmlldmFsIGNvbXBsZXRlcy5cclxuICAgICAgICB0aGlzLmZldGNoTWVkaWEoZmlsZUlkKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBmZXRjaE1lZGlhKGZpbGVJZDogc3RyaW5nKTogdm9pZCB7XHJcbiAgICBpZiAoIWZpbGVJZCB8fCBmaWxlSWQuc3RhcnRzV2l0aCgndGVtcC0nKSB8fCB0aGlzLm1lZGlhTG9hZGluZy5oYXMoZmlsZUlkKSB8fCB0aGlzLm1lZGlhRmFpbGVkLmhhcyhmaWxlSWQpKSByZXR1cm47XHJcbiAgICB0aGlzLm1lZGlhTG9hZGluZy5hZGQoZmlsZUlkKTtcclxuICAgIHRoaXMubWVkaWFRdWV1ZS5wdXNoKGZpbGVJZCk7XHJcbiAgICB0aGlzLnB1bXBNZWRpYVF1ZXVlKCk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHB1bXBNZWRpYVF1ZXVlKCk6IHZvaWQge1xyXG4gICAgd2hpbGUgKHRoaXMuYWN0aXZlTWVkaWFSZXF1ZXN0cyA8IHRoaXMubWF4TWVkaWFSZXF1ZXN0cyAmJiB0aGlzLm1lZGlhUXVldWUubGVuZ3RoID4gMCkge1xyXG4gICAgICBjb25zdCBmaWxlSWQgPSB0aGlzLm1lZGlhUXVldWUuc2hpZnQoKTtcclxuICAgICAgaWYgKCFmaWxlSWQpIGNvbnRpbnVlO1xyXG4gICAgICB0aGlzLmFjdGl2ZU1lZGlhUmVxdWVzdHMgKz0gMTtcclxuXHJcbiAgICAgIHRoaXMuZmlsZVNlcnZpY2UuZ2V0RmlsZURhdGFVcmwoZmlsZUlkKS5zdWJzY3JpYmUoe1xyXG4gICAgICAgIG5leHQ6ICgpID0+IHtcclxuICAgICAgICAgIHRoaXMuZmluaXNoTWVkaWFSZXF1ZXN0KGZpbGVJZCk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBlcnJvcjogKCkgPT4ge1xyXG4gICAgICAgICAgdGhpcy5tZWRpYUZhaWxlZC5hZGQoZmlsZUlkKTtcclxuICAgICAgICAgIHRoaXMuZmluaXNoTWVkaWFSZXF1ZXN0KGZpbGVJZCk7XHJcbiAgICAgICAgfSxcclxuICAgICAgfSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGZpbmlzaE1lZGlhUmVxdWVzdChmaWxlSWQ6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgdGhpcy5hY3RpdmVNZWRpYVJlcXVlc3RzID0gTWF0aC5tYXgoMCwgdGhpcy5hY3RpdmVNZWRpYVJlcXVlc3RzIC0gMSk7XHJcbiAgICB0aGlzLm1lZGlhTG9hZGluZy5kZWxldGUoZmlsZUlkKTtcclxuICAgIHRoaXMuY2RyLm1hcmtGb3JDaGVjaygpO1xyXG4gICAgdGhpcy5wdW1wTWVkaWFRdWV1ZSgpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSByZXNldE1lZGlhUXVldWUoKTogdm9pZCB7XHJcbiAgICB0aGlzLm1lZGlhUXVldWUgPSBbXTtcclxuICAgIHRoaXMubWVkaWFMb2FkaW5nLmNsZWFyKCk7XHJcbiAgICB0aGlzLmFjdGl2ZU1lZGlhUmVxdWVzdHMgPSAwO1xyXG4gIH1cclxuXHJcbiAgc2hvdWxkU2hvd01lZGlhU3Bpbm5lcih0YXJnZXQ6IE1lc3NhZ2UgfCBBdHRhY2htZW50KTogYm9vbGVhbiB7XHJcbiAgICBjb25zdCBmaWxlSWQgPSB0aGlzLmdldEF0dGFjaG1lbnRGaWxlSWQodGFyZ2V0KTtcclxuICAgIGlmICghZmlsZUlkIHx8IGZpbGVJZC5zdGFydHNXaXRoKCd0ZW1wLScpKSByZXR1cm4gZmFsc2U7XHJcbiAgICByZXR1cm4gdGhpcy5tZWRpYUxvYWRpbmcuaGFzKGZpbGVJZCkgJiYgIXRoaXMubWVkaWFGYWlsZWQuaGFzKGZpbGVJZCk7XHJcbiAgfVxyXG5cclxuICBpc1ZpZGVvQXR0YWNobWVudChtc2c6IE1lc3NhZ2UsIGF0dGFjaG1lbnQ/OiBBdHRhY2htZW50KTogYm9vbGVhbiB7XHJcbiAgICBjb25zdCBtaW1lID0gYXR0YWNobWVudD8ubWltZV90eXBlIHx8IHRoaXMuZ2V0UHJpbWFyeUF0dGFjaG1lbnQobXNnKT8ubWltZV90eXBlIHx8ICcnO1xyXG4gICAgaWYgKG1pbWUuc3RhcnRzV2l0aCgndmlkZW8vJykpIHJldHVybiB0cnVlO1xyXG4gICAgY29uc3QgbmFtZSA9IHRoaXMuZ2V0RmlsZW5hbWVMaWtlKG1zZywgYXR0YWNobWVudCk7XHJcbiAgICByZXR1cm4gL1xcLihtcDR8d2VibXxtb3Z8bTR2fGF2aXxta3YpJC9pLnRlc3QobmFtZSk7XHJcbiAgfVxyXG5cclxuICBnZXRBdHRhY2htZW50TWltZVR5cGUobXNnOiBNZXNzYWdlLCBhdHRhY2htZW50PzogQXR0YWNobWVudCk6IHN0cmluZyB7XHJcbiAgICByZXR1cm4gYXR0YWNobWVudD8ubWltZV90eXBlIHx8IHRoaXMuZ2V0UHJpbWFyeUF0dGFjaG1lbnQobXNnKT8ubWltZV90eXBlIHx8ICdhcHBsaWNhdGlvbi9vY3RldC1zdHJlYW0nO1xyXG4gIH1cclxuXHJcbiAgZ2V0QXR0YWNobWVudE5hbWUobXNnOiBNZXNzYWdlLCBhdHRhY2htZW50PzogQXR0YWNobWVudCk6IHN0cmluZyB7XHJcbiAgICByZXR1cm4gYXR0YWNobWVudD8uZmlsZW5hbWUgfHwgdGhpcy5nZXRQcmltYXJ5QXR0YWNobWVudChtc2cpPy5maWxlbmFtZSB8fCBtc2cuY29udGVudCB8fCAnRmlsZSc7XHJcbiAgfVxyXG5cclxuICBoYXNGaWxlQXR0YWNobWVudChtc2c6IE1lc3NhZ2UpOiBib29sZWFuIHtcclxuICAgIHJldHVybiBtc2cubWVzc2FnZV90eXBlID09PSAnRklMRScgfHwgdGhpcy5nZXRSZW5kZXJhYmxlQXR0YWNobWVudHMobXNnKS5sZW5ndGggPiAwO1xyXG4gIH1cclxuXHJcbiAgaGFzTWVkaWFGYWlsZWQodGFyZ2V0OiBNZXNzYWdlIHwgQXR0YWNobWVudCk6IGJvb2xlYW4ge1xyXG4gICAgY29uc3QgZmlsZUlkID0gdGhpcy5nZXRBdHRhY2htZW50RmlsZUlkKHRhcmdldCk7XHJcbiAgICByZXR1cm4gISFmaWxlSWQgJiYgdGhpcy5tZWRpYUZhaWxlZC5oYXMoZmlsZUlkKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgZ2V0QXR0YWNobWVudEZpbGVJZCh0YXJnZXQ6IE1lc3NhZ2UgfCBBdHRhY2htZW50KTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcclxuICAgIGlmICgnZmlsZV9pZCcgaW4gdGFyZ2V0KSByZXR1cm4gdGFyZ2V0LmZpbGVfaWQ7XHJcbiAgICByZXR1cm4gdGhpcy5nZXRQcmltYXJ5QXR0YWNobWVudCh0YXJnZXQpPy5maWxlX2lkO1xyXG4gIH1cclxuXHJcbiAgZ2V0RmlsZUljb24obXNnOiBNZXNzYWdlLCBhdHRhY2htZW50PzogQXR0YWNobWVudCk6IHN0cmluZyB7XHJcbiAgICBjb25zdCBtaW1lID0gdGhpcy5nZXRBdHRhY2htZW50TWltZVR5cGUobXNnLCBhdHRhY2htZW50KTtcclxuICAgIGNvbnN0IG5hbWUgPSB0aGlzLmdldEF0dGFjaG1lbnROYW1lKG1zZywgYXR0YWNobWVudCkudG9Mb3dlckNhc2UoKTtcclxuICAgIGlmIChtaW1lLnN0YXJ0c1dpdGgoJ3ZpZGVvLycpIHx8IC9cXC4obXA0fHdlYm18bW92fG00dnxhdml8bWt2KSQvaS50ZXN0KG5hbWUpKSByZXR1cm4gJ3ZpZGVvY2FtJztcclxuICAgIGlmIChtaW1lLnN0YXJ0c1dpdGgoJ2F1ZGlvLycpIHx8IC9cXC4obXAzfHdhdnxvZ2d8bTRhfGZsYWMpJC9pLnRlc3QobmFtZSkpIHJldHVybiAnYXVkaW90cmFjayc7XHJcbiAgICBpZiAobWltZS5pbmNsdWRlcygncGRmJykgfHwgbmFtZS5lbmRzV2l0aCgnLnBkZicpKSByZXR1cm4gJ3BpY3R1cmVfYXNfcGRmJztcclxuICAgIGlmIChtaW1lLmluY2x1ZGVzKCdzcHJlYWRzaGVldCcpIHx8IG1pbWUuaW5jbHVkZXMoJ2V4Y2VsJykgfHwgL1xcLih4bHN8eGxzeHxjc3YpJC9pLnRlc3QobmFtZSkpIHJldHVybiAndGFibGVfY2hhcnQnO1xyXG4gICAgaWYgKG1pbWUuaW5jbHVkZXMoJ2RvY3VtZW50JykgfHwgbWltZS5pbmNsdWRlcygnd29yZCcpIHx8IC9cXC4oZG9jfGRvY3h8dHh0fHJ0ZikkL2kudGVzdChuYW1lKSkgcmV0dXJuICdkZXNjcmlwdGlvbic7XHJcbiAgICBpZiAobWltZS5pbmNsdWRlcygnemlwJykgfHwgL1xcLih6aXB8cmFyfDd6fHRhcnxneikkL2kudGVzdChuYW1lKSkgcmV0dXJuICdmb2xkZXJfemlwJztcclxuICAgIHJldHVybiAnaW5zZXJ0X2RyaXZlX2ZpbGUnO1xyXG4gIH1cclxuXHJcbiAgb3BlbkxpZ2h0Ym94KGRhdGFVcmw6IHN0cmluZywgZXZlbnQ/OiBFdmVudCk6IHZvaWQge1xyXG4gICAgZXZlbnQ/LnN0b3BQcm9wYWdhdGlvbigpO1xyXG4gICAgdGhpcy5saWdodGJveE9wZW4uZW1pdChkYXRhVXJsKTtcclxuICB9XHJcblxyXG4gIGRvd25sb2FkQXR0YWNobWVudChtc2c6IE1lc3NhZ2UsIGF0dGFjaG1lbnQ6IEF0dGFjaG1lbnQsIGV2ZW50PzogRXZlbnQpOiB2b2lkIHtcclxuICAgIGV2ZW50Py5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgZXZlbnQ/LnN0b3BQcm9wYWdhdGlvbigpO1xyXG5cclxuICAgIGNvbnN0IGRpcmVjdFVybCA9IGF0dGFjaG1lbnQudXJsO1xyXG4gICAgaWYgKGRpcmVjdFVybCAmJiAvXihodHRwcz86fGRhdGE6KS9pLnRlc3QoZGlyZWN0VXJsKSkge1xyXG4gICAgICB0aGlzLnRyaWdnZXJEb3dubG9hZChkaXJlY3RVcmwsIHRoaXMuZ2V0QXR0YWNobWVudE5hbWUobXNnLCBhdHRhY2htZW50KSk7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBmaWxlSWQgPSBhdHRhY2htZW50LmZpbGVfaWQ/LnRyaW0oKTtcclxuICAgIGlmICghZmlsZUlkIHx8IGZpbGVJZC5zdGFydHNXaXRoKCd0ZW1wLScpIHx8IGZpbGVJZC5zdGFydHNXaXRoKCd7JykgfHwgZmlsZUlkLnN0YXJ0c1dpdGgoJ1snKSkge1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgY2FjaGVkID0gdGhpcy5maWxlU2VydmljZS5nZXRDYWNoZWREYXRhVXJsKGZpbGVJZCk7XHJcbiAgICBpZiAoY2FjaGVkKSB7XHJcbiAgICAgIHRoaXMudHJpZ2dlckRvd25sb2FkKGNhY2hlZCwgdGhpcy5nZXRBdHRhY2htZW50TmFtZShtc2csIGF0dGFjaG1lbnQpKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMubWVkaWFMb2FkaW5nLmFkZChmaWxlSWQpO1xyXG4gICAgdGhpcy5maWxlU2VydmljZS5nZXRGaWxlRGF0YVVybChmaWxlSWQpLnN1YnNjcmliZSh7XHJcbiAgICAgIG5leHQ6IChkYXRhVXJsKSA9PiB7XHJcbiAgICAgICAgdGhpcy5tZWRpYUxvYWRpbmcuZGVsZXRlKGZpbGVJZCk7XHJcbiAgICAgICAgdGhpcy50cmlnZ2VyRG93bmxvYWQoZGF0YVVybCwgdGhpcy5nZXRBdHRhY2htZW50TmFtZShtc2csIGF0dGFjaG1lbnQpKTtcclxuICAgICAgICB0aGlzLmNkci5tYXJrRm9yQ2hlY2soKTtcclxuICAgICAgfSxcclxuICAgICAgZXJyb3I6ICgpID0+IHtcclxuICAgICAgICB0aGlzLm1lZGlhTG9hZGluZy5kZWxldGUoZmlsZUlkKTtcclxuICAgICAgICB0aGlzLm1lZGlhRmFpbGVkLmFkZChmaWxlSWQpO1xyXG4gICAgICAgIHRoaXMuY2RyLm1hcmtGb3JDaGVjaygpO1xyXG4gICAgICB9LFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHRyaWdnZXJEb3dubG9hZCh1cmw6IHN0cmluZywgZmlsZW5hbWU6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgY29uc3QgbGluayA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2EnKTtcclxuICAgIGxpbmsuaHJlZiA9IHVybDtcclxuICAgIGxpbmsuZG93bmxvYWQgPSBmaWxlbmFtZSB8fCAnYXR0YWNobWVudCc7XHJcbiAgICBsaW5rLnRhcmdldCA9ICdfYmxhbmsnO1xyXG4gICAgbGluay5yZWwgPSAnbm9vcGVuZXInO1xyXG4gICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChsaW5rKTtcclxuICAgIGxpbmsuY2xpY2soKTtcclxuICAgIGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQobGluayk7XHJcbiAgfVxyXG5cclxuICAvLyDilIDilIAgUmVhY3Rpb25zIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG5cclxuICBvbkVtb2ppU2VsZWN0ZWQoZW1vamk6IHN0cmluZywgbWVzc2FnZUlkOiBzdHJpbmcpOiB2b2lkIHtcclxuICAgIHRoaXMudG9nZ2xlUmVhY3Rpb24oZW1vamksIG1lc3NhZ2VJZCk7XHJcbiAgfVxyXG5cclxuICB0b2dnbGVSZWFjdGlvbihlbW9qaTogc3RyaW5nLCBtZXNzYWdlSWQ6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgY29uc3QgbXNnID0gdGhpcy5tZXNzYWdlcy5maW5kKG0gPT4gbS5tZXNzYWdlX2lkID09PSBtZXNzYWdlSWQpO1xyXG4gICAgaWYgKCFtc2cpIHJldHVybjtcclxuICAgIFxyXG4gICAgY29uc3QgcmVhY3Rpb24gPSBtc2cucmVhY3Rpb25zPy5maW5kKHIgPT4gci5lbW9qaSA9PT0gZW1vamkpO1xyXG4gICAgaWYgKHJlYWN0aW9uPy5oYXNSZWFjdGVkKSB7XHJcbiAgICAgIHRoaXMuc3RvcmUucmVtb3ZlUmVhY3Rpb24obWVzc2FnZUlkLCBlbW9qaSk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICB0aGlzLnN0b3JlLmFkZFJlYWN0aW9uKG1lc3NhZ2VJZCwgZW1vamkpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgZ2V0UmVhY3RvclRvb2x0aXAocmVhY3Rpb246IGFueSk6IHN0cmluZyB7XHJcbiAgICBpZiAoIXJlYWN0aW9uPy5yZWFjdG9ycz8ubGVuZ3RoKSByZXR1cm4gJyc7XHJcbiAgICByZXR1cm4gcmVhY3Rpb24ucmVhY3RvcnMuam9pbignLCAnKTtcclxuICB9XHJcbn1cclxuIl19