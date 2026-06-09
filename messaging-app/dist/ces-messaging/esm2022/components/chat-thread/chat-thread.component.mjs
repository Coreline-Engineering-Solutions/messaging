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
            this.store.openGroupSettings(this.conversationId, this.conversationName, this.isProject);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdC10aHJlYWQuY29tcG9uZW50LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL2xpYi9jb21wb25lbnRzL2NoYXQtdGhyZWFkL2NoYXQtdGhyZWFkLmNvbXBvbmVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQ0wsU0FBUyxFQUFxQixTQUFTLEVBQUUsWUFBWSxFQUNyRCxNQUFNLEVBQUUsWUFBWSxHQUNyQixNQUFNLGVBQWUsQ0FBQztBQUV2QixPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDL0MsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLHdCQUF3QixDQUFDO0FBQ3ZELE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUMzRCxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUM5RSxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSwyQkFBMkIsQ0FBQztBQUM3RCxPQUFPLEVBQWdCLGFBQWEsRUFBRSxNQUFNLE1BQU0sQ0FBQztBQUtuRCxPQUFPLEVBQXlELHFCQUFxQixFQUFFLG9CQUFvQixFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDbkosT0FBTyxFQUFpQixxQkFBcUIsRUFBb0QsTUFBTSwwQ0FBMEMsQ0FBQzs7Ozs7Ozs7Ozs7O0FBNjhDbEosTUFBTSxPQUFPLG1CQUFtQjtJQTZDcEI7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBakRvQixlQUFlLENBQWM7SUFDbEMsVUFBVSxDQUEyQjtJQUMxQixtQkFBbUIsQ0FBOEM7SUFDbkUsWUFBWSxDQUF5QjtJQUM3RCxZQUFZLEdBQUcsSUFBSSxZQUFZLEVBQVUsQ0FBQztJQUVwRCxRQUFRLEdBQWMsRUFBRSxDQUFDO0lBQ3pCLGVBQWUsR0FBYyxFQUFFLENBQUM7SUFDaEMsZ0JBQWdCLEdBQUcsRUFBRSxDQUFDO0lBQ3RCLE9BQU8sR0FBRyxLQUFLLENBQUM7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QkFDRSxpQkFBaUIsY0FDZixJQUFJLFdBQ1A7d0JBQ1AsWUFBWSxFQUFFLGFBQWEsRUFBRSxlQUFlO3dCQUM1Qyx3QkFBd0IsRUFBRSxnQkFBZ0IsRUFBRSxxQkFBcUI7cUJBQ2xFLFlBQ1M7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBNFhUO29QQXlrQzZCLGVBQWU7c0JBQTVDLFNBQVM7dUJBQUMsaUJBQWlCO2dCQUNILFVBQVU7c0JBQWxDLFNBQVM7dUJBQUMsWUFBWTtnQkFDYSxtQkFBbUI7c0JBQXRELFlBQVk7dUJBQUMsb0JBQW9CO2dCQUNBLFlBQVk7c0JBQTdDLFNBQVM7dUJBQUMscUJBQXFCO2dCQUN0QixZQUFZO3NCQUFyQixNQUFNIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtcclxuICBDb21wb25lbnQsIE9uSW5pdCwgT25EZXN0cm95LCBWaWV3Q2hpbGQsIFZpZXdDaGlsZHJlbiwgUXVlcnlMaXN0LCBFbGVtZW50UmVmLCBBZnRlclZpZXdDaGVja2VkLCBDaGFuZ2VEZXRlY3RvclJlZixcclxuICBPdXRwdXQsIEV2ZW50RW1pdHRlcixcclxufSBmcm9tICdAYW5ndWxhci9jb3JlJztcclxuaW1wb3J0IHsgRG9tU2FuaXRpemVyLCBTYWZlSHRtbCB9IGZyb20gJ0Bhbmd1bGFyL3BsYXRmb3JtLWJyb3dzZXInO1xyXG5pbXBvcnQgeyBDb21tb25Nb2R1bGUgfSBmcm9tICdAYW5ndWxhci9jb21tb24nO1xyXG5pbXBvcnQgeyBNYXRJY29uTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvbWF0ZXJpYWwvaWNvbic7XHJcbmltcG9ydCB7IE1hdEJ1dHRvbk1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL21hdGVyaWFsL2J1dHRvbic7XHJcbmltcG9ydCB7IE1hdFByb2dyZXNzU3Bpbm5lck1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL21hdGVyaWFsL3Byb2dyZXNzLXNwaW5uZXInO1xyXG5pbXBvcnQgeyBNYXRUb29sdGlwTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvbWF0ZXJpYWwvdG9vbHRpcCc7XHJcbmltcG9ydCB7IFN1YnNjcmlwdGlvbiwgY29tYmluZUxhdGVzdCB9IGZyb20gJ3J4anMnO1xyXG5pbXBvcnQgeyBNZXNzYWdpbmdTdG9yZVNlcnZpY2UgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9tZXNzYWdpbmctc3RvcmUuc2VydmljZSc7XHJcbmltcG9ydCB7IE1lc3NhZ2luZ0FwaVNlcnZpY2UgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9tZXNzYWdpbmctYXBpLnNlcnZpY2UnO1xyXG5pbXBvcnQgeyBNZXNzYWdpbmdGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL21lc3NhZ2luZy1maWxlLnNlcnZpY2UnO1xyXG5pbXBvcnQgeyBBdXRoU2VydmljZSB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL2F1dGguc2VydmljZSc7XHJcbmltcG9ydCB7IENvbnRhY3QsIENvbnZlcnNhdGlvblBhcnRpY2lwYW50LCBNZXNzYWdlLCBBdHRhY2htZW50LCBnZXRDb250YWN0RGlzcGxheU5hbWUsIGdldE1lc3NhZ2VTZW5kZXJOYW1lIH0gZnJvbSAnLi4vLi4vbW9kZWxzL21lc3NhZ2luZy5tb2RlbHMnO1xyXG5pbXBvcnQgeyBNZW50aW9uT3B0aW9uLCBNZXNzYWdlSW5wdXRDb21wb25lbnQsIE1lc3NhZ2VQYXlsb2FkLCBNZXNzYWdlVGV4dFBheWxvYWQsIFJlcGx5UHJldmlldyB9IGZyb20gJy4uL21lc3NhZ2UtaW5wdXQvbWVzc2FnZS1pbnB1dC5jb21wb25lbnQnO1xyXG5cclxuQENvbXBvbmVudCh7XHJcbiAgc2VsZWN0b3I6ICdhcHAtY2hhdC10aHJlYWQnLFxyXG4gIHN0YW5kYWxvbmU6IHRydWUsXHJcbiAgaW1wb3J0czogW1xyXG4gICAgQ29tbW9uTW9kdWxlLCBNYXRJY29uTW9kdWxlLCBNYXRCdXR0b25Nb2R1bGUsXHJcbiAgICBNYXRQcm9ncmVzc1NwaW5uZXJNb2R1bGUsIE1hdFRvb2x0aXBNb2R1bGUsIE1lc3NhZ2VJbnB1dENvbXBvbmVudCxcclxuICBdLFxyXG4gIHRlbXBsYXRlOiBgXHJcbiAgICA8ZGl2XHJcbiAgICAgICN0aHJlYWRSb290XHJcbiAgICAgIGNsYXNzPVwiY2hhdC10aHJlYWRcIlxyXG4gICAgICBbY2xhc3MuZHJhZy1vdmVyXT1cInRocmVhZERyYWdPdmVyXCJcclxuICAgICAgW3N0eWxlLi0tbWVzc2FnZS10ZXh0LXNjYWxlXT1cIm1lc3NhZ2VUZXh0U2NhbGVcIlxyXG4gICAgICBbc3R5bGUuLS1jb2RlLXRleHQtc2NhbGVdPVwiY29kZVRleHRTY2FsZVwiXHJcbiAgICAgIChjbGljayk9XCJjbG9zZU1lc3NhZ2VDb250ZXh0TWVudSgpXCJcclxuICAgICAgKGRyYWdlbnRlcik9XCJvblRocmVhZERyYWdFbnRlcigkZXZlbnQpXCJcclxuICAgICAgKGRyYWdvdmVyKT1cIm9uVGhyZWFkRHJhZ092ZXIoJGV2ZW50KVwiXHJcbiAgICAgIChkcmFnbGVhdmUpPVwib25UaHJlYWREcmFnTGVhdmUoJGV2ZW50KVwiXHJcbiAgICAgIChkcm9wKT1cIm9uVGhyZWFkRHJvcCgkZXZlbnQpXCJcclxuICAgID5cclxuICAgICAgPGRpdiBjbGFzcz1cImNoYXQtaGVhZGVyXCI+XHJcbiAgICAgICAgPGJ1dHRvbiBtYXQtaWNvbi1idXR0b24gY2xhc3M9XCJoZHItYnRuXCIgKGNsaWNrKT1cImdvQmFjaygpXCIgbWF0VG9vbHRpcD1cIkJhY2tcIiBtYXRUb29sdGlwUG9zaXRpb249XCJiZWxvd1wiPlxyXG4gICAgICAgICAgPG1hdC1pY29uPmFycm93X2JhY2s8L21hdC1pY29uPlxyXG4gICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgIDxkaXYgY2xhc3M9XCJoZWFkZXItaW5mb1wiPlxyXG4gICAgICAgICAgPHNwYW4gY2xhc3M9XCJjaGF0LW5hbWVcIj57eyBjb252ZXJzYXRpb25OYW1lIH19PC9zcGFuPlxyXG4gICAgICAgIDwvZGl2PlxyXG4gICAgICAgIDxkaXYgY2xhc3M9XCJoZWFkZXItYWN0aW9uc1wiPlxyXG4gICAgICAgICAgPGJ1dHRvbiAqbmdJZj1cImlzR3JvdXAgJiYgIWlzUmVtb3ZlZEZyb21Hcm91cFwiIG1hdC1pY29uLWJ1dHRvbiBjbGFzcz1cImhkci1idG5cIiAoY2xpY2spPVwib25Hcm91cFNldHRpbmdzKClcIiBtYXRUb29sdGlwPVwiR3JvdXAgc2V0dGluZ3NcIiBtYXRUb29sdGlwUG9zaXRpb249XCJiZWxvd1wiPlxyXG4gICAgICAgICAgICA8bWF0LWljb24+c2V0dGluZ3M8L21hdC1pY29uPlxyXG4gICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgPC9kaXY+XHJcbiAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgPGRpdiBjbGFzcz1cIm1lc3NhZ2VzLWFyZWFcIiAjc2Nyb2xsQ29udGFpbmVyIChzY3JvbGwpPVwib25TY3JvbGwoKVwiPlxyXG4gICAgICAgIDxkaXYgKm5nSWY9XCJ0aHJlYWREcmFnT3ZlclwiIGNsYXNzPVwidGhyZWFkLWRyYWctb3ZlcmxheVwiPlxyXG4gICAgICAgICAgPG1hdC1pY29uPmNsb3VkX3VwbG9hZDwvbWF0LWljb24+XHJcbiAgICAgICAgICA8c3Bhbj5Ecm9wIGZpbGVzIGFueXdoZXJlIGluIHRoaXMgY2hhdDwvc3Bhbj5cclxuICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgPGRpdiAqbmdJZj1cImlzUmVtb3ZlZEZyb21Hcm91cFwiIGNsYXNzPVwicmVtb3ZlZC1ncm91cC1zdGF0ZVwiPlxyXG4gICAgICAgICAgPG1hdC1pY29uPmJsb2NrPC9tYXQtaWNvbj5cclxuICAgICAgICAgIDxoND5Zb3Ugd2VyZSByZW1vdmVkIGZyb20gdGhpcyBncm91cDwvaDQ+XHJcbiAgICAgICAgICA8cD5NZXNzYWdlcywgYXR0YWNobWVudHMsIGFuZCBncm91cCBzZXR0aW5ncyBhcmUgbm8gbG9uZ2VyIGF2YWlsYWJsZS48L3A+XHJcbiAgICAgICAgICA8YnV0dG9uIHR5cGU9XCJidXR0b25cIiBtYXQtcmFpc2VkLWJ1dHRvbiBjbGFzcz1cInJlbW92ZWQtZXhpdC1idG5cIiAoY2xpY2spPVwiZXhpdFJlbW92ZWRHcm91cCgpXCI+XHJcbiAgICAgICAgICAgIEV4aXQgR3JvdXBcclxuICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICA8ZGl2ICpuZ0lmPVwiIWlzUmVtb3ZlZEZyb21Hcm91cCAmJiBsb2FkaW5nXCIgY2xhc3M9XCJsb2FkaW5nLWluZGljYXRvclwiPlxyXG4gICAgICAgICAgPG1hdC1zcGlubmVyIGRpYW1ldGVyPVwiMjRcIj48L21hdC1zcGlubmVyPlxyXG4gICAgICAgICAgPHNwYW4+TG9hZGluZyBtZXNzYWdlcy4uLjwvc3Bhbj5cclxuICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgKm5nSWY9XCIhaXNSZW1vdmVkRnJvbUdyb3VwICYmIG1lc3NhZ2VzLmxlbmd0aCA+PSA1MCAmJiAhbG9hZGluZ1wiXHJcbiAgICAgICAgICBtYXQtc3Ryb2tlZC1idXR0b25cclxuICAgICAgICAgIGNsYXNzPVwibG9hZC1tb3JlLWJ0blwiXHJcbiAgICAgICAgICAoY2xpY2spPVwibG9hZE9sZGVyKClcIlxyXG4gICAgICAgID5cclxuICAgICAgICAgIExvYWQgb2xkZXIgbWVzc2FnZXNcclxuICAgICAgICA8L2J1dHRvbj5cclxuXHJcbiAgICAgICAgPGRpdiAqbmdJZj1cIiFpc1JlbW92ZWRGcm9tR3JvdXBcIiBjbGFzcz1cIm1lc3NhZ2VzLWxpc3RcIj5cclxuICAgICAgICAgIDxuZy1jb250YWluZXIgKm5nRm9yPVwibGV0IG1zZyBvZiBtZXNzYWdlczsgbGV0IGkgPSBpbmRleFwiPlxyXG4gICAgICAgICAgICA8ZGl2XHJcbiAgICAgICAgICAgICAgKm5nSWY9XCJzaG91bGRTaG93RGF0ZVNlcGFyYXRvcihpKVwiXHJcbiAgICAgICAgICAgICAgY2xhc3M9XCJkYXRlLXNlcGFyYXRvclwiXHJcbiAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICA8c3Bhbj57eyBmb3JtYXREYXRlKG1zZy5jcmVhdGVkX2F0KSB9fTwvc3Bhbj5cclxuICAgICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgICA8ZGl2XHJcbiAgICAgICAgICAgICAgKm5nSWY9XCJpc1N5c3RlbU1lc3NhZ2UobXNnKTsgZWxzZSBjaGF0TWVzc2FnZVwiXHJcbiAgICAgICAgICAgICAgY2xhc3M9XCJzeXN0ZW0tbWVzc2FnZS1yb3dcIlxyXG4gICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJzeXN0ZW0tbWVzc2FnZS10ZXh0XCI+e3sgbXNnLmNvbnRlbnQgfX08L3NwYW4+XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgICAgPG5nLXRlbXBsYXRlICNjaGF0TWVzc2FnZT5cclxuICAgICAgICAgICAgICA8ZGl2XHJcbiAgICAgICAgICAgICAgICBjbGFzcz1cIm1lc3NhZ2UtYnViYmxlLXJvd1wiXHJcbiAgICAgICAgICAgICAgICBbY2xhc3Mub3duXT1cImlzT3duTWVzc2FnZShtc2cpXCJcclxuICAgICAgICAgICAgICAgIFtjbGFzcy5vdGhlcl09XCIhaXNPd25NZXNzYWdlKG1zZylcIlxyXG4gICAgICAgICAgICAgICAgKGNvbnRleHRtZW51KT1cIm9wZW5NZXNzYWdlQ29udGV4dE1lbnUobXNnLCAkZXZlbnQpXCJcclxuICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgPGRpdiAqbmdJZj1cIiFpc093bk1lc3NhZ2UobXNnKVwiIGNsYXNzPVwic2VuZGVyLW5hbWVcIj5cclxuICAgICAgICAgICAgICAgIHt7IGdldFNlbmRlck5hbWUobXNnKSB9fVxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgIDxkaXZcclxuICAgICAgICAgICAgICAgIGNsYXNzPVwibWVzc2FnZS1idWJibGVcIlxyXG4gICAgICAgICAgICAgICAgW2NsYXNzLm93bi1idWJibGVdPVwiaXNPd25NZXNzYWdlKG1zZylcIlxyXG4gICAgICAgICAgICAgICAgKG1vdXNlZW50ZXIpPVwiaG92ZXJlZE1lc3NhZ2VJZCA9IG1zZy5tZXNzYWdlX2lkXCJcclxuICAgICAgICAgICAgICAgIChtb3VzZWxlYXZlKT1cImhvdmVyZWRNZXNzYWdlSWQgPSBudWxsXCJcclxuICAgICAgICAgICAgICAgIChjb250ZXh0bWVudSk9XCJvcGVuTWVzc2FnZUNvbnRleHRNZW51KG1zZywgJGV2ZW50KVwiXHJcbiAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgPGRpdiAqbmdJZj1cImdldFJlcGx5UHJldmlldyhtc2cpIGFzIHJlcGx5XCIgY2xhc3M9XCJyZXBseS1jb250ZXh0XCI+XHJcbiAgICAgICAgICAgICAgICAgIDxtYXQtaWNvbj5yZXBseTwvbWF0LWljb24+XHJcbiAgICAgICAgICAgICAgICAgIDxkaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgPHNwYW4+e3sgcmVwbHkuc2VuZGVyTmFtZSB9fTwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICA8cD57eyByZXBseS5jb250ZW50IH19PC9wPlxyXG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgPCEtLSBBVFRBQ0hNRU5UUyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIAgLS0+XHJcbiAgICAgICAgICAgICAgICA8ZGl2ICpuZ0lmPVwiaGFzRmlsZUF0dGFjaG1lbnQobXNnKVwiIGNsYXNzPVwiYXR0YWNobWVudHMtbGlzdFwiPlxyXG4gICAgICAgICAgICAgICAgICA8ZGl2ICpuZ0Zvcj1cImxldCBhdHRhY2htZW50IG9mIGdldFJlbmRlcmFibGVBdHRhY2htZW50cyhtc2cpOyB0cmFja0J5OiB0cmFja0J5QXR0YWNobWVudFwiIGNsYXNzPVwiYXR0YWNobWVudC1pdGVtXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgPG5nLWNvbnRhaW5lciAqbmdJZj1cImlzSW1hZ2VBdHRhY2htZW50KG1zZywgYXR0YWNobWVudCk7IGVsc2Ugbm9uSW1hZ2VBdHRhY2htZW50XCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiaW1hZ2UtbWVzc2FnZVwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8bmctY29udGFpbmVyICpuZ0lmPVwiZ2V0TWVkaWFVcmwobXNnLCBhdHRhY2htZW50KSBhcyBkYXRhVXJsOyBlbHNlIGltZ0ZhbGxiYWNrXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cIm1lZGlhLXdyYXBwZXJcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxpbWdcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgW3NyY109XCJkYXRhVXJsXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYWx0PVwiSW1hZ2VcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbGFzcz1cIm1lZGlhLWltZ1wiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIChtb3VzZWRvd24pPVwiJGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKGNsaWNrKT1cIm9wZW5MaWdodGJveChkYXRhVXJsLCAkZXZlbnQpXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiYXR0YWNobWVudC1hY3Rpb25zXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxidXR0b25cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbGFzcz1cImF0dGFjaG1lbnQtYWN0aW9uLWJ0blwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKGNsaWNrKT1cIm9wZW5MaWdodGJveChkYXRhVXJsLCAkZXZlbnQpXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aXRsZT1cIk9wZW4gaW1hZ2VcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPG1hdC1pY29uPm9wZW5faW5fZnVsbDwvbWF0LWljb24+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8YnV0dG9uXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZT1cImJ1dHRvblwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3M9XCJhdHRhY2htZW50LWFjdGlvbi1idG5cIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIChjbGljayk9XCJkb3dubG9hZEF0dGFjaG1lbnQobXNnLCBhdHRhY2htZW50LCAkZXZlbnQpXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aXRsZT1cIkRvd25sb2FkIGltYWdlXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxtYXQtaWNvbj5kb3dubG9hZDwvbWF0LWljb24+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDwvbmctY29udGFpbmVyPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8bmctdGVtcGxhdGUgI2ltZ0ZhbGxiYWNrPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgKm5nSWY9XCJzaG91bGRTaG93TWVkaWFTcGlubmVyKGF0dGFjaG1lbnQpOyBlbHNlIGltZ0FzRmlsZVwiIGNsYXNzPVwibWVkaWEtcGxhY2Vob2xkZXJcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxtYXQtc3Bpbm5lciBkaWFtZXRlcj1cIjIyXCI+PC9tYXQtc3Bpbm5lcj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8bmctdGVtcGxhdGUgI2ltZ0FzRmlsZT5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmaWxlLW1lc3NhZ2VcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPG1hdC1pY29uIGNsYXNzPVwiZmlsZS1tc2ctaWNvblwiPmltYWdlPC9tYXQtaWNvbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJmaWxlLW1zZy1uYW1lXCI+e3sgZ2V0QXR0YWNobWVudE5hbWUobXNnLCBhdHRhY2htZW50KSB9fTwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDwvbmctdGVtcGxhdGU+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDwvbmctdGVtcGxhdGU+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICA8L25nLWNvbnRhaW5lcj5cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgPG5nLXRlbXBsYXRlICNub25JbWFnZUF0dGFjaG1lbnQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmlsZS1tZXNzYWdlIGF0dGFjaG1lbnQtdGh1bWJcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzPVwiZmlsZS1kb3dubG9hZC1idG5cIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIChjbGljayk9XCJkb3dubG9hZEF0dGFjaG1lbnQobXNnLCBhdHRhY2htZW50LCAkZXZlbnQpXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICB0aXRsZT1cIkRvd25sb2FkIGZpbGVcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPG1hdC1pY29uIGNsYXNzPVwiZmlsZS1kb3dubG9hZC1pY29uXCI+ZG93bmxvYWQ8L21hdC1pY29uPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPG1hdC1pY29uIGNsYXNzPVwiZmlsZS1tc2ctaWNvblwiPnt7IGdldEZpbGVJY29uKG1zZywgYXR0YWNobWVudCkgfX08L21hdC1pY29uPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cImZpbGUtbXNnLW5hbWVcIiBbdGl0bGVdPVwiZ2V0QXR0YWNobWVudE5hbWUobXNnLCBhdHRhY2htZW50KVwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHt7IGdldEF0dGFjaG1lbnROYW1lKG1zZywgYXR0YWNobWVudCkgfX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgPC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8YnV0dG9uXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZT1cImJ1dHRvblwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3M9XCJmaWxlLWRvd25sb2FkLWxpbmtcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIChjbGljayk9XCJkb3dubG9hZEF0dGFjaG1lbnQobXNnLCBhdHRhY2htZW50LCAkZXZlbnQpXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICB0aXRsZT1cIkRvd25sb2FkIGZpbGVcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgRG93bmxvYWRcclxuICAgICAgICAgICAgICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICA8L25nLXRlbXBsYXRlPlxyXG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgPGRpdlxyXG4gICAgICAgICAgICAgICAgICAqbmdJZj1cImhhc0ZpbGVBdHRhY2htZW50KG1zZykgJiYgZ2V0TWVzc2FnZUNhcHRpb24obXNnKVwiXHJcbiAgICAgICAgICAgICAgICAgIGNsYXNzPVwiYXR0YWNobWVudC1jYXB0aW9uXCJcclxuICAgICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgICAgPGRpdiAqbmdJZj1cImlzQ29kZUNvbnRlbnQoZ2V0TWVzc2FnZUNhcHRpb24obXNnKSwgbXNnKTsgZWxzZSBub25Db2RlQ2FwdGlvblwiIGNsYXNzPVwiY29kZS1tZXNzYWdlLXdyYXAgYXR0YWNobWVudC1yZW5kZXItYmxvY2tcIj5cclxuICAgICAgICAgICAgICAgICAgICA8YnV0dG9uIHR5cGU9XCJidXR0b25cIiBjbGFzcz1cInJlbmRlci1jb3B5LWJ0blwiIChjbGljayk9XCJjb3B5VGV4dFZhbHVlKGdldE1lc3NhZ2VDYXB0aW9uKG1zZyksICRldmVudClcIiB0aXRsZT1cIkNvcHkgY29kZVwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPG1hdC1pY29uPmNvbnRlbnRfY29weTwvbWF0LWljb24+XHJcbiAgICAgICAgICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICAgICAgICAgICAgPHByZSBjbGFzcz1cImNvZGUtbWVzc2FnZVwiPjxjb2RlIFtpbm5lckhUTUxdPVwiZ2V0SGlnaGxpZ2h0ZWRDb2RlQ29udGVudChnZXRNZXNzYWdlQ2FwdGlvbihtc2cpKVwiPjwvY29kZT48L3ByZT5cclxuICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cImNvZGUtbGFuZ3VhZ2VcIj57eyBnZXRDb2RlTGFuZ3VhZ2VDb250ZW50KGdldE1lc3NhZ2VDYXB0aW9uKG1zZykpIH19PC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgPG5nLXRlbXBsYXRlICNub25Db2RlQ2FwdGlvbj5cclxuICAgICAgICAgICAgICAgICAgICA8ZGl2ICpuZ0lmPVwiaXNNYXJrZG93bkNvbnRlbnQoZ2V0TWVzc2FnZUNhcHRpb24obXNnKSk7IGVsc2UgcGxhaW5DYXB0aW9uXCIgY2xhc3M9XCJtZC1tZXNzYWdlLXdyYXAgYXR0YWNobWVudC1yZW5kZXItYmxvY2tcIj5cclxuICAgICAgICAgICAgICAgICAgICAgIDxidXR0b24gdHlwZT1cImJ1dHRvblwiIGNsYXNzPVwicmVuZGVyLWNvcHktYnRuXCIgKGNsaWNrKT1cImNvcHlUZXh0VmFsdWUoZ2V0TWVzc2FnZUNhcHRpb24obXNnKSwgJGV2ZW50KVwiIHRpdGxlPVwiQ29weSBtYXJrZG93blwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8bWF0LWljb24+Y29udGVudF9jb3B5PC9tYXQtaWNvbj5cclxuICAgICAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cIm1kLW1lc3NhZ2VcIiBbaW5uZXJIVE1MXT1cImdldE1hcmtkb3duSHRtbENvbnRlbnQoZ2V0TWVzc2FnZUNhcHRpb24obXNnKSlcIj48L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwibWQtbGFuZ3VhZ2VcIj5tZDwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICA8bmctdGVtcGxhdGUgI3BsYWluQ2FwdGlvbj5cclxuICAgICAgICAgICAgICAgICAgICAgIDxkaXZcclxuICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3M9XCJ0ZXh0LWNvbnRlbnRcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBbY2xhc3MucHJlZm9ybWF0dGVkLXRleHRdPVwiaXNQcmVmb3JtYXR0ZWRDb250ZW50KGdldE1lc3NhZ2VDYXB0aW9uKG1zZykpXCJcclxuICAgICAgICAgICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgICAgICAgICAge3sgZ2V0TWVzc2FnZUNhcHRpb24obXNnKSB9fVxyXG4gICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgPC9uZy10ZW1wbGF0ZT5cclxuICAgICAgICAgICAgICAgICAgPC9uZy10ZW1wbGF0ZT5cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgPG5nLWNvbnRhaW5lciAqbmdJZj1cIm1zZy5tZXNzYWdlX3R5cGUgPT09ICdURVhUJyAmJiAhaGFzRmlsZUF0dGFjaG1lbnQobXNnKVwiPlxyXG4gICAgICAgICAgICAgICAgICA8bmctY29udGFpbmVyICpuZ0lmPVwiaXNFZGl0aW5nTWVzc2FnZShtc2cpOyBlbHNlIHRleHRNZXNzYWdlUmVuZGVyXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImlubGluZS1lZGl0LXdyYXBcIiAoY2xpY2spPVwiJGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpXCIgKGNvbnRleHRtZW51KT1cIiRldmVudC5zdG9wUHJvcGFnYXRpb24oKVwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPHRleHRhcmVhXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICNpbmxpbmVFZGl0VGV4dGFyZWFcclxuICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3M9XCJpbmxpbmUtZWRpdC10ZXh0YXJlYVwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIFt2YWx1ZV09XCJlZGl0aW5nRHJhZnRcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAoaW5wdXQpPVwib25JbmxpbmVFZGl0SW5wdXQoJGV2ZW50KVwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIChrZXlkb3duKT1cIm9uSW5saW5lRWRpdEtleWRvd24oJGV2ZW50KVwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJvd3M9XCIyXCJcclxuICAgICAgICAgICAgICAgICAgICAgID48L3RleHRhcmVhPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImlubGluZS1lZGl0LWFjdGlvbnNcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPGJ1dHRvbiB0eXBlPVwiYnV0dG9uXCIgY2xhc3M9XCJpbmxpbmUtZWRpdC1jYW5jZWxcIiAoY2xpY2spPVwiY2FuY2VsSW5saW5lRWRpdCgkZXZlbnQpXCI+Q2FuY2VsPC9idXR0b24+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxidXR0b25cclxuICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICBjbGFzcz1cImlubGluZS1lZGl0LXNhdmVcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIFtkaXNhYmxlZF09XCIhY2FuU2F2ZUlubGluZUVkaXQoKVwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgKGNsaWNrKT1cInNhdmVJbmxpbmVFZGl0KCRldmVudClcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgU2F2ZVxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICA8L25nLWNvbnRhaW5lcj5cclxuICAgICAgICAgICAgICAgICAgPG5nLXRlbXBsYXRlICN0ZXh0TWVzc2FnZVJlbmRlcj5cclxuICAgICAgICAgICAgICAgICAgICA8ZGl2ICpuZ0lmPVwiaXNDb2RlVGV4dChtc2cpOyBlbHNlIG5vbkNvZGVUZXh0TWVzc2FnZVwiIGNsYXNzPVwiY29kZS1tZXNzYWdlLXdyYXBcIj5cclxuICAgICAgICAgICAgICAgICAgICAgIDxidXR0b24gdHlwZT1cImJ1dHRvblwiIGNsYXNzPVwicmVuZGVyLWNvcHktYnRuXCIgKGNsaWNrKT1cImNvcHlDb2RlKG1zZywgJGV2ZW50KVwiIHRpdGxlPVwiQ29weSBjb2RlXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxtYXQtaWNvbj5jb250ZW50X2NvcHk8L21hdC1pY29uPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8cHJlIGNsYXNzPVwiY29kZS1tZXNzYWdlXCI+PGNvZGUgW2lubmVySFRNTF09XCJnZXRIaWdobGlnaHRlZENvZGUobXNnKVwiPjwvY29kZT48L3ByZT5cclxuICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwiY29kZS1sYW5ndWFnZVwiPnt7IGdldENvZGVMYW5ndWFnZShtc2cpIH19PC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgIDxuZy10ZW1wbGF0ZSAjbm9uQ29kZVRleHRNZXNzYWdlPlxyXG4gICAgICAgICAgICAgICAgICAgIDxkaXYgKm5nSWY9XCJpc1RhYmxlVGV4dChtc2cpOyBlbHNlIHBsYWluVGV4dE1lc3NhZ2VcIiBjbGFzcz1cInRhYmxlLW1lc3NhZ2Utd3JhcFwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPGJ1dHRvbiB0eXBlPVwiYnV0dG9uXCIgY2xhc3M9XCJyZW5kZXItY29weS1idG5cIiAoY2xpY2spPVwiY29weU1lc3NhZ2VUZXh0KG1zZywgJGV2ZW50KVwiIHRpdGxlPVwiQ29weSB0YWJsZVwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8bWF0LWljb24+Y29udGVudF9jb3B5PC9tYXQtaWNvbj5cclxuICAgICAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPHRhYmxlIGNsYXNzPVwicGFzdGVkLXRhYmxlXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0Ym9keT5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8dHIgKm5nRm9yPVwibGV0IHJvdyBvZiBnZXRUYWJsZVJvd3MobXNnKTsgbGV0IHJvd0luZGV4ID0gaW5kZXhcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxuZy1jb250YWluZXIgKm5nRm9yPVwibGV0IGNlbGwgb2Ygcm93XCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0aCAqbmdJZj1cInJvd0luZGV4ID09PSAwOyBlbHNlIHRhYmxlQ2VsbFwiPnt7IGNlbGwgfX08L3RoPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8bmctdGVtcGxhdGUgI3RhYmxlQ2VsbD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dGQ+e3sgY2VsbCB9fTwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvbmctdGVtcGxhdGU+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L25nLWNvbnRhaW5lcj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8L3RyPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8L3Rib2R5PlxyXG4gICAgICAgICAgICAgICAgICAgICAgPC90YWJsZT5cclxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICA8bmctdGVtcGxhdGUgI3BsYWluVGV4dE1lc3NhZ2U+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2ICpuZ0lmPVwiaXNNYXJrZG93blRleHQobXNnKTsgZWxzZSByYXdUZXh0TWVzc2FnZVwiIGNsYXNzPVwibWQtbWVzc2FnZS13cmFwXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxidXR0b24gdHlwZT1cImJ1dHRvblwiIGNsYXNzPVwicmVuZGVyLWNvcHktYnRuXCIgKGNsaWNrKT1cImNvcHlNZXNzYWdlVGV4dChtc2csICRldmVudClcIiB0aXRsZT1cIkNvcHkgbWFya2Rvd25cIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8bWF0LWljb24+Y29udGVudF9jb3B5PC9tYXQtaWNvbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJtZC1tZXNzYWdlXCIgW2lubmVySFRNTF09XCJnZXRNYXJrZG93bkh0bWwobXNnKVwiPjwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cIm1kLWxhbmd1YWdlXCI+bWQ8L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgIDxuZy10ZW1wbGF0ZSAjcmF3VGV4dE1lc3NhZ2U+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXZcclxuICAgICAgICAgICAgICAgICAgICAgICAgICBjbGFzcz1cInRleHQtY29udGVudFwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgW2NsYXNzLnByZWZvcm1hdHRlZC10ZXh0XT1cImlzUHJlZm9ybWF0dGVkVGV4dChtc2cpXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHt7IGdldE1lc3NhZ2VCb2R5KG1zZykgfX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8L25nLXRlbXBsYXRlPlxyXG4gICAgICAgICAgICAgICAgICAgIDwvbmctdGVtcGxhdGU+XHJcbiAgICAgICAgICAgICAgICAgICAgPC9uZy10ZW1wbGF0ZT5cclxuICAgICAgICAgICAgICAgICAgPC9uZy10ZW1wbGF0ZT5cclxuICAgICAgICAgICAgICAgIDwvbmctY29udGFpbmVyPlxyXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cIm1lc3NhZ2UtbWV0YVwiPlxyXG4gICAgICAgICAgICAgICAgICA8c3BhbiAqbmdJZj1cIm1zZy5lZGl0ZWRfYXQgJiYgIWlzRGVsZXRlZE1lc3NhZ2UobXNnKVwiIGNsYXNzPVwiZWRpdGVkLWxhYmVsXCI+ZWRpdGVkPC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cIm1zZy10aW1lXCI+e3sgZm9ybWF0VGltZShtc2cuY3JlYXRlZF9hdCkgfX08L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgIDxtYXQtaWNvblxyXG4gICAgICAgICAgICAgICAgICAgICpuZ0lmPVwiaXNPd25NZXNzYWdlKG1zZykgJiYgaXNNZXNzYWdlUmVhZChtc2cpXCJcclxuICAgICAgICAgICAgICAgICAgICBjbGFzcz1cInJlYWQtaWNvbiByZWFkXCJcclxuICAgICAgICAgICAgICAgICAgICBbbWF0VG9vbHRpcF09XCJnZXRSZWFkVG9vbHRpcChtc2cpXCJcclxuICAgICAgICAgICAgICAgICAgICBtYXRUb29sdGlwUG9zaXRpb249XCJhYm92ZVwiXHJcbiAgICAgICAgICAgICAgICAgID5kb25lX2FsbDwvbWF0LWljb24+XHJcbiAgICAgICAgICAgICAgICAgIDxtYXQtaWNvblxyXG4gICAgICAgICAgICAgICAgICAgICpuZ0lmPVwiaXNPd25NZXNzYWdlKG1zZykgJiYgIWlzTWVzc2FnZVJlYWQobXNnKVwiXHJcbiAgICAgICAgICAgICAgICAgICAgY2xhc3M9XCJyZWFkLWljb24gdW5yZWFkXCJcclxuICAgICAgICAgICAgICAgICAgICBtYXRUb29sdGlwPVwiU2VudFwiXHJcbiAgICAgICAgICAgICAgICAgICAgbWF0VG9vbHRpcFBvc2l0aW9uPVwiYWJvdmVcIlxyXG4gICAgICAgICAgICAgICAgICA+ZG9uZTwvbWF0LWljb24+XHJcbiAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgIDxkaXYgKm5nSWY9XCJob3ZlcmVkTWVzc2FnZUlkID09PSBtc2cubWVzc2FnZV9pZCAmJiAhaXNEZWxldGVkTWVzc2FnZShtc2cpXCIgY2xhc3M9XCJxdWljay1yZWFjdGlvbnNcIj5cclxuICAgICAgICAgICAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgICAgICAgICAgICpuZ0Zvcj1cImxldCBlbW9qaSBvZiBxdWlja0Vtb2ppc1wiXHJcbiAgICAgICAgICAgICAgICAgICAgY2xhc3M9XCJxdWljay1lbW9qaS1idG5cIlxyXG4gICAgICAgICAgICAgICAgICAgIChjbGljayk9XCJvbkVtb2ppU2VsZWN0ZWQoZW1vamksIG1zZy5tZXNzYWdlX2lkKVwiXHJcbiAgICAgICAgICAgICAgICAgICAgW2F0dHIuYXJpYS1sYWJlbF09XCInUmVhY3Qgd2l0aCAnICsgZW1vamlcIlxyXG4gICAgICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICAgICAge3sgZW1vamkgfX1cclxuICAgICAgICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgIDxkaXYgKm5nSWY9XCIhaXNEZWxldGVkTWVzc2FnZShtc2cpICYmIG1zZy5yZWFjdGlvbnMgJiYgbXNnLnJlYWN0aW9ucy5sZW5ndGggPiAwXCIgY2xhc3M9XCJyZWFjdGlvbnMtcm93XCI+XHJcbiAgICAgICAgICAgICAgICAgIDxidXR0b24gXHJcbiAgICAgICAgICAgICAgICAgICAgKm5nRm9yPVwibGV0IHIgb2YgbXNnLnJlYWN0aW9uc1wiIFxyXG4gICAgICAgICAgICAgICAgICAgIGNsYXNzPVwicmVhY3Rpb24tY2hpcFwiXHJcbiAgICAgICAgICAgICAgICAgICAgKGNsaWNrKT1cInRvZ2dsZVJlYWN0aW9uKHIuZW1vamksIG1zZy5tZXNzYWdlX2lkKVwiXHJcbiAgICAgICAgICAgICAgICAgICAgW2NsYXNzLm93bi1yZWFjdGlvbl09XCJyLmhhc1JlYWN0ZWRcIlxyXG4gICAgICAgICAgICAgICAgICAgIFttYXRUb29sdGlwXT1cImdldFJlYWN0b3JUb29sdGlwKHIpXCJcclxuICAgICAgICAgICAgICAgICAgICBtYXRUb29sdGlwUG9zaXRpb249XCJhYm92ZVwiXHJcbiAgICAgICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cInJlYWN0aW9uLWVtb2ppXCI+e3sgci5lbW9qaSB9fTwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cInJlYWN0aW9uLWNvdW50XCI+e3sgci5jb3VudCB9fTwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgPC9uZy10ZW1wbGF0ZT5cclxuICAgICAgICAgIDwvbmctY29udGFpbmVyPlxyXG4gICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICA8ZGl2ICpuZ0lmPVwiIWlzUmVtb3ZlZEZyb21Hcm91cCAmJiBtZXNzYWdlcy5sZW5ndGggPT09IDAgJiYgIWxvYWRpbmdcIiBjbGFzcz1cImVtcHR5LWNoYXRcIj5cclxuICAgICAgICAgIDxtYXQtaWNvbj5jaGF0X2J1YmJsZV9vdXRsaW5lPC9tYXQtaWNvbj5cclxuICAgICAgICAgIDxwPk5vIG1lc3NhZ2VzIHlldC4gU2F5IGhlbGxvITwvcD5cclxuICAgICAgICA8L2Rpdj5cclxuICAgICAgPC9kaXY+XHJcblxyXG4gICAgICA8ZGl2XHJcbiAgICAgICAgKm5nSWY9XCJtZXNzYWdlQ29udGV4dE1lbnUgYXMgbWVudVwiXHJcbiAgICAgICAgY2xhc3M9XCJtZXNzYWdlLWNvbnRleHQtbWVudVwiXHJcbiAgICAgICAgW3N0eWxlLmxlZnQucHhdPVwibWVudS54XCJcclxuICAgICAgICBbc3R5bGUudG9wLnB4XT1cIm1lbnUueVwiXHJcbiAgICAgICAgKGNsaWNrKT1cIiRldmVudC5zdG9wUHJvcGFnYXRpb24oKVwiXHJcbiAgICAgICAgKGNvbnRleHRtZW51KT1cIiRldmVudC5wcmV2ZW50RGVmYXVsdCgpXCJcclxuICAgICAgPlxyXG4gICAgICAgIDxuZy1jb250YWluZXIgKm5nSWY9XCIhbWVudS5jb25maXJtRGVsZXRlOyBlbHNlIGRlbGV0ZUNvbmZpcm1NZW51XCI+XHJcbiAgICAgICAgICA8YnV0dG9uXHJcbiAgICAgICAgICAgICpuZ0lmPVwiY2FuUmVwbHlNZXNzYWdlKG1lbnUubWVzc2FnZSlcIlxyXG4gICAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcclxuICAgICAgICAgICAgY2xhc3M9XCJjb250ZXh0LW1lbnUtaXRlbVwiXHJcbiAgICAgICAgICAgIChjbGljayk9XCJyZXBseUZyb21Db250ZXh0TWVudSgpXCJcclxuICAgICAgICAgID5cclxuICAgICAgICAgICAgPG1hdC1pY29uPnJlcGx5PC9tYXQtaWNvbj5cclxuICAgICAgICAgICAgPHNwYW4+UmVwbHk8L3NwYW4+XHJcbiAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgIDxidXR0b25cclxuICAgICAgICAgICAgKm5nSWY9XCJjYW5FZGl0TWVzc2FnZShtZW51Lm1lc3NhZ2UpXCJcclxuICAgICAgICAgICAgdHlwZT1cImJ1dHRvblwiXHJcbiAgICAgICAgICAgIGNsYXNzPVwiY29udGV4dC1tZW51LWl0ZW1cIlxyXG4gICAgICAgICAgICAoY2xpY2spPVwiZWRpdEZyb21Db250ZXh0TWVudSgpXCJcclxuICAgICAgICAgID5cclxuICAgICAgICAgICAgPG1hdC1pY29uPmVkaXQ8L21hdC1pY29uPlxyXG4gICAgICAgICAgICA8c3Bhbj5FZGl0PC9zcGFuPlxyXG4gICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICA8YnV0dG9uXHJcbiAgICAgICAgICAgICpuZ0lmPVwiY2FuRGVsZXRlTWVzc2FnZShtZW51Lm1lc3NhZ2UpXCJcclxuICAgICAgICAgICAgdHlwZT1cImJ1dHRvblwiXHJcbiAgICAgICAgICAgIGNsYXNzPVwiY29udGV4dC1tZW51LWl0ZW0gZGFuZ2VyXCJcclxuICAgICAgICAgICAgKGNsaWNrKT1cInJlcXVlc3REZWxldGVGcm9tQ29udGV4dE1lbnUoKVwiXHJcbiAgICAgICAgICA+XHJcbiAgICAgICAgICAgIDxtYXQtaWNvbj5kZWxldGU8L21hdC1pY29uPlxyXG4gICAgICAgICAgICA8c3Bhbj5EZWxldGU8L3NwYW4+XHJcbiAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICA8L25nLWNvbnRhaW5lcj5cclxuICAgICAgICA8bmctdGVtcGxhdGUgI2RlbGV0ZUNvbmZpcm1NZW51PlxyXG4gICAgICAgICAgPGRpdiBjbGFzcz1cImNvbnRleHQtbWVudS1jb25maXJtXCI+XHJcbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJjb25maXJtLXRpdGxlXCI+RGVsZXRlIHRoaXMgbWVzc2FnZT88L2Rpdj5cclxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cImNvbmZpcm0tYWN0aW9uc1wiPlxyXG4gICAgICAgICAgICAgIDxidXR0b24gdHlwZT1cImJ1dHRvblwiIGNsYXNzPVwiY29uZmlybS1jYW5jZWxcIiAoY2xpY2spPVwiY2xvc2VNZXNzYWdlQ29udGV4dE1lbnUoKVwiPkNhbmNlbDwvYnV0dG9uPlxyXG4gICAgICAgICAgICAgIDxidXR0b24gdHlwZT1cImJ1dHRvblwiIGNsYXNzPVwiY29uZmlybS1kZWxldGVcIiAoY2xpY2spPVwiY29uZmlybURlbGV0ZUZyb21Db250ZXh0TWVudSgpXCI+RGVsZXRlPC9idXR0b24+XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgPC9uZy10ZW1wbGF0ZT5cclxuICAgICAgPC9kaXY+XHJcblxyXG4gICAgICA8YXBwLW1lc3NhZ2UtaW5wdXRcclxuICAgICAgICAqbmdJZj1cIiFpc1JlbW92ZWRGcm9tR3JvdXBcIlxyXG4gICAgICAgIFtjb252ZXJzYXRpb25JZF09XCJjb252ZXJzYXRpb25JZFwiXHJcbiAgICAgICAgW3JlcGx5VG9dPVwicmVwbHlUb01lc3NhZ2UgPyBnZXRDb21wb3NlUmVwbHlQcmV2aWV3KHJlcGx5VG9NZXNzYWdlKSA6IG51bGxcIlxyXG4gICAgICAgIFtlbmFibGVNZW50aW9uc109XCJpc0dyb3VwXCJcclxuICAgICAgICBbbWVudGlvbk9wdGlvbnNdPVwibWVudGlvbk9wdGlvbnNcIlxyXG4gICAgICAgIChtZXNzYWdlU2VudCk9XCJvblNlbmRNZXNzYWdlKCRldmVudClcIlxyXG4gICAgICAgIChtZXNzYWdlV2l0aEZpbGVzKT1cIm9uU2VuZFdpdGhGaWxlcygkZXZlbnQpXCJcclxuICAgICAgICAocmVwbHlDYW5jZWxsZWQpPVwiY2xlYXJSZXBseSgpXCJcclxuICAgICAgPjwvYXBwLW1lc3NhZ2UtaW5wdXQ+XHJcbiAgICA8L2Rpdj5cclxuXHJcbiAgYCxcclxuICBzdHlsZXM6IFtgXHJcbiAgICA6aG9zdCB7XHJcbiAgICAgIC0tYXR0YWNobWVudC10aHVtYi1zaXplOiAxODBweDtcclxuICAgIH1cclxuXHJcbiAgICAuY2hhdC10aHJlYWQge1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xyXG4gICAgICBoZWlnaHQ6IDEwMCU7XHJcbiAgICAgIGJhY2tncm91bmQ6ICMwNDEzMjI7XHJcbiAgICAgIHBvc2l0aW9uOiByZWxhdGl2ZTtcclxuICAgICAgY29udGFpbmVyLXR5cGU6IGlubGluZS1zaXplO1xyXG4gICAgICAtLWF0dGFjaG1lbnQtdGh1bWItc2l6ZTogY2xhbXAoMTIwcHgsIDQ4Y3F3LCAxODBweCk7XHJcbiAgICB9XHJcblxyXG4gICAgLmNoYXQtdGhyZWFkLmRyYWctb3ZlciB7XHJcbiAgICAgIG91dGxpbmU6IDJweCBkYXNoZWQgcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjQ1KTtcclxuICAgICAgb3V0bGluZS1vZmZzZXQ6IC02cHg7XHJcbiAgICB9XHJcblxyXG4gICAgLnRocmVhZC1kcmFnLW92ZXJsYXkge1xyXG4gICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XHJcbiAgICAgIGluc2V0OiA4cHg7XHJcbiAgICAgIHotaW5kZXg6IDIwO1xyXG4gICAgICBwb2ludGVyLWV2ZW50czogbm9uZTtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XHJcbiAgICAgIGdhcDogOHB4O1xyXG4gICAgICBjb2xvcjogI2ZmZjtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgzMSwgNzUsIDIxNiwgMC4zMik7XHJcbiAgICAgIGJvcmRlcjogMnB4IGRhc2hlZCByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNTUpO1xyXG4gICAgICBib3JkZXItcmFkaXVzOiAxNHB4O1xyXG4gICAgICBmb250LXNpemU6IDE0cHg7XHJcbiAgICAgIGZvbnQtd2VpZ2h0OiA2MDA7XHJcbiAgICB9XHJcblxyXG4gICAgLnRocmVhZC1kcmFnLW92ZXJsYXkgbWF0LWljb24ge1xyXG4gICAgICBmb250LXNpemU6IDM2cHg7XHJcbiAgICAgIHdpZHRoOiAzNnB4O1xyXG4gICAgICBoZWlnaHQ6IDM2cHg7XHJcbiAgICB9XHJcblxyXG4gICAgLmNoYXQtaGVhZGVyIHtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAgcGFkZGluZzogOHB4IDhweCA4cHggNHB4O1xyXG4gICAgICBib3JkZXItYm90dG9tOiAxcHggc29saWQgcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjE1KTtcclxuICAgICAgZ2FwOiA0cHg7XHJcbiAgICAgIGZsZXgtc2hyaW5rOiAwO1xyXG4gICAgfVxyXG5cclxuICAgIC5jaGF0LWhlYWRlciBidXR0b24gbWF0LWljb24ge1xyXG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjgpO1xyXG4gICAgfVxyXG5cclxuICAgIC5jaGF0LW5hbWUge1xyXG4gICAgICBmb250LXNpemU6IDE2cHg7XHJcbiAgICAgIGZvbnQtd2VpZ2h0OiA2MDA7XHJcbiAgICAgIGNvbG9yOiAjZmZmO1xyXG4gICAgfVxyXG5cclxuICAgIC5oZWFkZXItaW5mbyB7XHJcbiAgICAgIGZsZXg6IDE7XHJcbiAgICAgIHdoaXRlLXNwYWNlOiBub3dyYXA7XHJcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XHJcbiAgICAgIHRleHQtb3ZlcmZsb3c6IGVsbGlwc2lzO1xyXG4gICAgICBkaXNwbGF5OiBibG9jaztcclxuICAgICAgcGFkZGluZzogMCA0cHg7XHJcbiAgICB9XHJcblxyXG4gICAgLmhlYWRlci1hY3Rpb25zIHtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAgZ2FwOiAwO1xyXG4gICAgfVxyXG5cclxuICAgIC5oZWFkZXItYWN0aW9ucyBidXR0b24ge1xyXG4gICAgICB3aWR0aDogMzJweDtcclxuICAgICAgaGVpZ2h0OiAzMnB4O1xyXG4gICAgICBtaW4td2lkdGg6IDMycHggIWltcG9ydGFudDtcclxuICAgICAgcGFkZGluZzogMCAhaW1wb3J0YW50O1xyXG4gICAgICBkaXNwbGF5OiBpbmxpbmUtZmxleCAhaW1wb3J0YW50O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyICFpbXBvcnRhbnQ7XHJcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyICFpbXBvcnRhbnQ7XHJcbiAgICAgIC0tbWRjLWljb24tYnV0dG9uLXN0YXRlLWxheWVyLXNpemU6IDMycHg7XHJcbiAgICB9XHJcblxyXG4gICAgLmhkci1idG4ge1xyXG4gICAgICBib3JkZXItcmFkaXVzOiA2cHggIWltcG9ydGFudDtcclxuICAgICAgdHJhbnNpdGlvbjogYmFja2dyb3VuZCAwLjE1cywgYm94LXNoYWRvdyAwLjE1cztcclxuICAgIH1cclxuXHJcbiAgICAuaGRyLWJ0bjpob3ZlciB7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xNSkgIWltcG9ydGFudDtcclxuICAgICAgYm94LXNoYWRvdzogMCAycHggOHB4IHJnYmEoMCwgMCwgMCwgMC4yKTtcclxuICAgIH1cclxuXHJcbiAgICAuaGRyLWJ0biBtYXQtaWNvbiB7XHJcbiAgICAgIGZvbnQtc2l6ZTogMjBweDtcclxuICAgICAgd2lkdGg6IDIwcHg7XHJcbiAgICAgIGhlaWdodDogMjBweDtcclxuICAgICAgbGluZS1oZWlnaHQ6IDIwcHg7XHJcbiAgICAgIG1hcmdpbjogMDtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XHJcbiAgICB9XHJcblxyXG4gICAgOmhvc3QgOjpuZy1kZWVwIC5oZHItYnRuIC5tYXQtbWRjLWJ1dHRvbi10b3VjaC10YXJnZXQge1xyXG4gICAgICB3aWR0aDogMzJweCAhaW1wb3J0YW50O1xyXG4gICAgICBoZWlnaHQ6IDMycHggIWltcG9ydGFudDtcclxuICAgIH1cclxuXHJcbiAgICAubWVzc2FnZXMtYXJlYSB7XHJcbiAgICAgIGZsZXg6IDE7XHJcbiAgICAgIG92ZXJmbG93LXk6IGF1dG87XHJcbiAgICAgIHBhZGRpbmc6IDEycHg7XHJcbiAgICAgIGJhY2tncm91bmQ6IHRyYW5zcGFyZW50O1xyXG4gICAgICBzY3JvbGxiYXItd2lkdGg6IG5vbmU7XHJcbiAgICAgIC1tcy1vdmVyZmxvdy1zdHlsZTogbm9uZTtcclxuICAgIH1cclxuXHJcbiAgICAubWVzc2FnZXMtYXJlYTo6LXdlYmtpdC1zY3JvbGxiYXIge1xyXG4gICAgICBkaXNwbGF5OiBub25lO1xyXG4gICAgfVxyXG5cclxuICAgIC5sb2FkaW5nLWluZGljYXRvciB7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xyXG4gICAgICBnYXA6IDhweDtcclxuICAgICAgcGFkZGluZzogMTJweDtcclxuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC43KTtcclxuICAgICAgZm9udC1zaXplOiAxM3B4O1xyXG4gICAgfVxyXG5cclxuICAgIC5yZW1vdmVkLWdyb3VwLXN0YXRlIHtcclxuICAgICAgaGVpZ2h0OiAxMDAlO1xyXG4gICAgICBtaW4taGVpZ2h0OiAyNjBweDtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XHJcbiAgICAgIHRleHQtYWxpZ246IGNlbnRlcjtcclxuICAgICAgZ2FwOiAxMHB4O1xyXG4gICAgICBwYWRkaW5nOiAzMnB4IDI0cHg7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNzgpO1xyXG4gICAgICBib3gtc2l6aW5nOiBib3JkZXItYm94O1xyXG4gICAgfVxyXG5cclxuICAgIC5yZW1vdmVkLWdyb3VwLXN0YXRlIG1hdC1pY29uIHtcclxuICAgICAgd2lkdGg6IDQ0cHg7XHJcbiAgICAgIGhlaWdodDogNDRweDtcclxuICAgICAgZm9udC1zaXplOiA0NHB4O1xyXG4gICAgICBjb2xvcjogI2Y4NzE3MTtcclxuICAgICAgbWFyZ2luLWJvdHRvbTogNHB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5yZW1vdmVkLWdyb3VwLXN0YXRlIGg0IHtcclxuICAgICAgbWFyZ2luOiAwO1xyXG4gICAgICBjb2xvcjogI2ZmZjtcclxuICAgICAgZm9udC1zaXplOiAxN3B4O1xyXG4gICAgICBmb250LXdlaWdodDogNzAwO1xyXG4gICAgfVxyXG5cclxuICAgIC5yZW1vdmVkLWdyb3VwLXN0YXRlIHAge1xyXG4gICAgICBtYXJnaW46IDAgMCA4cHg7XHJcbiAgICAgIG1heC13aWR0aDogMjgwcHg7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTNweDtcclxuICAgICAgbGluZS1oZWlnaHQ6IDEuNDtcclxuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC42Mik7XHJcbiAgICB9XHJcblxyXG4gICAgLnJlbW92ZWQtZXhpdC1idG4ge1xyXG4gICAgICBib3JkZXItcmFkaXVzOiAxMHB4O1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMTgpICFpbXBvcnRhbnQ7XHJcbiAgICAgIGNvbG9yOiAjZmZmICFpbXBvcnRhbnQ7XHJcbiAgICAgIGZvbnQtd2VpZ2h0OiA3MDA7XHJcbiAgICAgIHBhZGRpbmc6IDAgMThweDtcclxuICAgIH1cclxuXHJcbiAgICAubG9hZC1tb3JlLWJ0biB7XHJcbiAgICAgIGFsaWduLXNlbGY6IGNlbnRlcjtcclxuICAgICAgbWFyZ2luLWJvdHRvbTogMTZweDtcclxuICAgICAgZm9udC1zaXplOiAxMnB4O1xyXG4gICAgICBjb2xvcjogI2ZmZjtcclxuICAgIH1cclxuXHJcbiAgICAubWVzc2FnZXMtbGlzdCB7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XHJcbiAgICAgIGdhcDogMXB4O1xyXG4gICAgICBmbGV4OiAxO1xyXG4gICAgfVxyXG5cclxuICAgIC5kYXRlLXNlcGFyYXRvciB7XHJcbiAgICAgIHRleHQtYWxpZ246IGNlbnRlcjtcclxuICAgICAgbWFyZ2luOiAxNnB4IDAgOHB4O1xyXG4gICAgICBmb250LXNpemU6IDEycHg7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNyk7XHJcbiAgICAgIGZvbnQtd2VpZ2h0OiA1MDA7XHJcbiAgICB9XHJcblxyXG4gICAgLm1lc3NhZ2UtYnViYmxlLXJvdyB7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XHJcbiAgICAgIG1heC13aWR0aDogODglO1xyXG4gICAgICBtYXJnaW4tYm90dG9tOiAycHg7XHJcbiAgICB9XHJcblxyXG4gICAgLm1lc3NhZ2UtYnViYmxlLXJvdy5vd24ge1xyXG4gICAgICBhbGlnbi1zZWxmOiBmbGV4LWVuZDtcclxuICAgICAgYWxpZ24taXRlbXM6IGZsZXgtZW5kO1xyXG4gICAgfVxyXG5cclxuICAgIC5tZXNzYWdlLWJ1YmJsZS1yb3cub3RoZXIge1xyXG4gICAgICBhbGlnbi1zZWxmOiBmbGV4LXN0YXJ0O1xyXG4gICAgICBhbGlnbi1pdGVtczogZmxleC1zdGFydDtcclxuICAgIH1cclxuXHJcbiAgICAuc2VuZGVyLW5hbWUge1xyXG4gICAgICBmb250LXNpemU6IDExcHg7XHJcbiAgICAgIGZvbnQtd2VpZ2h0OiA3MDA7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuOTUpO1xyXG4gICAgICBtYXJnaW4tYm90dG9tOiAzcHg7XHJcbiAgICAgIGxldHRlci1zcGFjaW5nOiAwLjJweDtcclxuICAgICAgcGFkZGluZzogMCAxMHB4O1xyXG4gICAgICB0ZXh0LXNoYWRvdzogMCAxcHggM3B4IHJnYmEoMCwgMCwgMCwgMC40KTtcclxuICAgIH1cclxuXHJcbiAgICAuc3lzdGVtLW1lc3NhZ2Utcm93IHtcclxuICAgICAgYWxpZ24tc2VsZjogY2VudGVyO1xyXG4gICAgICBtYXgtd2lkdGg6IDg4JTtcclxuICAgICAgbWFyZ2luOiA4cHggYXV0bztcclxuICAgICAgdGV4dC1hbGlnbjogY2VudGVyO1xyXG4gICAgfVxyXG5cclxuICAgIC5zeXN0ZW0tbWVzc2FnZS10ZXh0IHtcclxuICAgICAgZGlzcGxheTogaW5saW5lLWZsZXg7XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xyXG4gICAgICBwYWRkaW5nOiA1cHggMTFweDtcclxuICAgICAgYm9yZGVyLXJhZGl1czogOTk5cHg7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4wOSk7XHJcbiAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xMik7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNzIpO1xyXG4gICAgICBmb250LXNpemU6IDExcHg7XHJcbiAgICAgIGxpbmUtaGVpZ2h0OiAxLjM1O1xyXG4gICAgfVxyXG5cclxuICAgIC5tZXNzYWdlLWJ1YmJsZSB7XHJcbiAgICAgIHBhZGRpbmc6IDhweCAxNHB4IDdweDtcclxuICAgICAgYm9yZGVyLXJhZGl1czogMTRweDtcclxuICAgICAgZm9udC1zaXplOiBjYWxjKGNsYW1wKDExcHgsIDMuNGNxdywgMTNweCkgKiB2YXIoLS1tZXNzYWdlLXRleHQtc2NhbGUsIDEpKTtcclxuICAgICAgbGluZS1oZWlnaHQ6IDEuMzI7XHJcbiAgICAgIHdvcmQtYnJlYWs6IGJyZWFrLXdvcmQ7XHJcbiAgICAgIGNvbG9yOiAjZjVmN2ZmO1xyXG4gICAgICBwb3NpdGlvbjogcmVsYXRpdmU7XHJcbiAgICAgIGRpc3BsYXk6IGlubGluZS1ibG9jaztcclxuICAgICAgbWluLXdpZHRoOiBmaXQtY29udGVudDtcclxuICAgIH1cclxuXHJcbiAgICAubWVzc2FnZS1idWJibGUtcm93Lm90aGVyIC5tZXNzYWdlLWJ1YmJsZSB7XHJcbiAgICAgIGJhY2tncm91bmQ6ICMwZDI1NDA7XHJcbiAgICAgIGJvcmRlci1ib3R0b20tbGVmdC1yYWRpdXM6IDVweDtcclxuICAgICAgYm94LXNoYWRvdzogMCAxcHggNHB4IHJnYmEoMCwgMCwgMCwgMC40KTtcclxuICAgIH1cclxuXHJcbiAgICAubWVzc2FnZS1idWJibGUub3duLWJ1YmJsZSB7XHJcbiAgICAgIGJhY2tncm91bmQ6ICMwYTNkNjI7XHJcbiAgICAgIGJvcmRlci1ib3R0b20tcmlnaHQtcmFkaXVzOiA1cHg7XHJcbiAgICAgIGJveC1zaGFkb3c6IDAgMXB4IDRweCByZ2JhKDAsIDAsIDAsIDAuNCk7XHJcbiAgICB9XHJcblxyXG4gICAgLnJlcGx5LWNvbnRleHQge1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBnYXA6IDdweDtcclxuICAgICAgbWFyZ2luLWJvdHRvbTogN3B4O1xyXG4gICAgICBwYWRkaW5nOiA3cHggOXB4O1xyXG4gICAgICBib3JkZXItcmFkaXVzOiAxMHB4O1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMDgpO1xyXG4gICAgICBib3JkZXItbGVmdDogM3B4IHNvbGlkIHJnYmEoMTI3LCAxODAsIDI1NSwgMC43OCk7XHJcbiAgICAgIG1heC13aWR0aDogbWluKDY4Y3F3LCA0MjBweCk7XHJcbiAgICB9XHJcblxyXG4gICAgLnJlcGx5LWNvbnRleHQgbWF0LWljb24ge1xyXG4gICAgICBjb2xvcjogI2JmZGJmZTtcclxuICAgICAgZm9udC1zaXplOiAxNnB4O1xyXG4gICAgICB3aWR0aDogMTZweDtcclxuICAgICAgaGVpZ2h0OiAxNnB4O1xyXG4gICAgICBmbGV4LXNocmluazogMDtcclxuICAgIH1cclxuXHJcbiAgICAucmVwbHktY29udGV4dCBkaXYge1xyXG4gICAgICBtaW4td2lkdGg6IDA7XHJcbiAgICB9XHJcblxyXG4gICAgLnJlcGx5LWNvbnRleHQgc3BhbiB7XHJcbiAgICAgIGRpc3BsYXk6IGJsb2NrO1xyXG4gICAgICBjb2xvcjogI2JmZGJmZTtcclxuICAgICAgZm9udC1zaXplOiAxMXB4O1xyXG4gICAgICBmb250LXdlaWdodDogNzAwO1xyXG4gICAgICBtYXJnaW4tYm90dG9tOiAycHg7XHJcbiAgICB9XHJcblxyXG4gICAgLnJlcGx5LWNvbnRleHQgcCB7XHJcbiAgICAgIG1hcmdpbjogMDtcclxuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC43OCk7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTJweDtcclxuICAgICAgd2hpdGUtc3BhY2U6IG5vd3JhcDtcclxuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcclxuICAgICAgdGV4dC1vdmVyZmxvdzogZWxsaXBzaXM7XHJcbiAgICB9XHJcblxyXG4gICAgLnRleHQtY29udGVudCB7XHJcbiAgICAgIHdoaXRlLXNwYWNlOiBwcmUtd3JhcDtcclxuICAgICAgdGFiLXNpemU6IDQ7XHJcbiAgICB9XHJcblxyXG4gICAgLnRleHQtY29udGVudC5wcmVmb3JtYXR0ZWQtdGV4dCB7XHJcbiAgICAgIGZvbnQtZmFtaWx5OiB1aS1tb25vc3BhY2UsIFNGTW9uby1SZWd1bGFyLCBNZW5sbywgTW9uYWNvLCBDb25zb2xhcywgXCJMaWJlcmF0aW9uIE1vbm9cIiwgbW9ub3NwYWNlO1xyXG4gICAgICBmb250LXNpemU6IGNhbGMoY2xhbXAoMTBweCwgMy4xY3F3LCAxMnB4KSAqIHZhcigtLWNvZGUtdGV4dC1zY2FsZSwgMSkpO1xyXG4gICAgICBsaW5lLWhlaWdodDogMS40NTtcclxuICAgICAgb3ZlcmZsb3cteDogYXV0bztcclxuICAgICAgbWF4LXdpZHRoOiBtaW4oNzJjcXcsIDUyMHB4KTtcclxuICAgICAgc2Nyb2xsYmFyLXdpZHRoOiBub25lO1xyXG4gICAgICAtbXMtb3ZlcmZsb3ctc3R5bGU6IG5vbmU7XHJcbiAgICB9XHJcblxyXG4gICAgLnRleHQtY29udGVudC5wcmVmb3JtYXR0ZWQtdGV4dDo6LXdlYmtpdC1zY3JvbGxiYXIge1xyXG4gICAgICBkaXNwbGF5OiBub25lO1xyXG4gICAgfVxyXG5cclxuICAgIC5pbmxpbmUtZWRpdC13cmFwIHtcclxuICAgICAgd2lkdGg6IG1pbig3NmNxdywgNTIwcHgpO1xyXG4gICAgICBtaW4td2lkdGg6IG1pbig1NmNxdywgMjYwcHgpO1xyXG4gICAgfVxyXG5cclxuICAgIC5pbmxpbmUtZWRpdC10ZXh0YXJlYSB7XHJcbiAgICAgIHdpZHRoOiAxMDAlO1xyXG4gICAgICBtaW4taGVpZ2h0OiA3MnB4O1xyXG4gICAgICBtYXgtaGVpZ2h0OiAyMjBweDtcclxuICAgICAgYm94LXNpemluZzogYm9yZGVyLWJveDtcclxuICAgICAgYm9yZGVyOiAxcHggc29saWQgcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjI4KTtcclxuICAgICAgYm9yZGVyLXJhZGl1czogMTBweDtcclxuICAgICAgb3V0bGluZTogbm9uZTtcclxuICAgICAgcmVzaXplOiB2ZXJ0aWNhbDtcclxuICAgICAgcGFkZGluZzogOXB4IDEwcHg7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xKTtcclxuICAgICAgY29sb3I6ICNmZmY7XHJcbiAgICAgIGZvbnQ6IGluaGVyaXQ7XHJcbiAgICAgIGxpbmUtaGVpZ2h0OiAxLjM1O1xyXG4gICAgICB3aGl0ZS1zcGFjZTogcHJlLXdyYXA7XHJcbiAgICB9XHJcblxyXG4gICAgLmlubGluZS1lZGl0LXRleHRhcmVhOmZvY3VzIHtcclxuICAgICAgYm9yZGVyLWNvbG9yOiByZ2JhKDE5MSwgMjE5LCAyNTQsIDAuOSk7XHJcbiAgICAgIGJveC1zaGFkb3c6IDAgMCAwIDJweCByZ2JhKDEyNywgMTgwLCAyNTUsIDAuMTgpO1xyXG4gICAgfVxyXG5cclxuICAgIC5pbmxpbmUtZWRpdC1hY3Rpb25zIHtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAganVzdGlmeS1jb250ZW50OiBmbGV4LWVuZDtcclxuICAgICAgZ2FwOiA4cHg7XHJcbiAgICAgIG1hcmdpbi10b3A6IDhweDtcclxuICAgIH1cclxuXHJcbiAgICAuaW5saW5lLWVkaXQtY2FuY2VsLFxyXG4gICAgLmlubGluZS1lZGl0LXNhdmUge1xyXG4gICAgICBib3JkZXI6IDA7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDhweDtcclxuICAgICAgcGFkZGluZzogNnB4IDEwcHg7XHJcbiAgICAgIGNvbG9yOiAjZjhmYWZjO1xyXG4gICAgICBjdXJzb3I6IHBvaW50ZXI7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTJweDtcclxuICAgICAgZm9udC13ZWlnaHQ6IDcwMDtcclxuICAgIH1cclxuXHJcbiAgICAuaW5saW5lLWVkaXQtY2FuY2VsIHtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjEyKTtcclxuICAgIH1cclxuXHJcbiAgICAuaW5saW5lLWVkaXQtc2F2ZSB7XHJcbiAgICAgIGJhY2tncm91bmQ6ICMyNTYzZWI7XHJcbiAgICB9XHJcblxyXG4gICAgLmlubGluZS1lZGl0LXNhdmU6ZGlzYWJsZWQge1xyXG4gICAgICBjdXJzb3I6IG5vdC1hbGxvd2VkO1xyXG4gICAgICBvcGFjaXR5OiAwLjQ1O1xyXG4gICAgfVxyXG5cclxuICAgIC5hdHRhY2htZW50LWNhcHRpb24ge1xyXG4gICAgICBtYXJnaW4tdG9wOiA4cHg7XHJcbiAgICAgIHdpZHRoOiB2YXIoLS1hdHRhY2htZW50LXRodW1iLXNpemUpO1xyXG4gICAgICBtYXgtd2lkdGg6IHZhcigtLWF0dGFjaG1lbnQtdGh1bWItc2l6ZSk7XHJcbiAgICAgIGJveC1zaXppbmc6IGJvcmRlci1ib3g7XHJcbiAgICB9XHJcblxyXG4gICAgLmF0dGFjaG1lbnQtY2FwdGlvbiAudGV4dC1jb250ZW50IHtcclxuICAgICAgd2hpdGUtc3BhY2U6IHByZS13cmFwO1xyXG4gICAgICBvdmVyZmxvdy13cmFwOiBhbnl3aGVyZTtcclxuICAgICAgbWF4LXdpZHRoOiAxMDAlO1xyXG4gICAgfVxyXG5cclxuICAgIC5hdHRhY2htZW50LXJlbmRlci1ibG9jayB7XHJcbiAgICAgIHdpZHRoOiAxMDAlO1xyXG4gICAgICBtYXgtd2lkdGg6IDEwMCU7XHJcbiAgICB9XHJcblxyXG4gICAgLmNvZGUtbWVzc2FnZS13cmFwIHtcclxuICAgICAgcG9zaXRpb246IHJlbGF0aXZlO1xyXG4gICAgICBtYXgtd2lkdGg6IG1pbig3NmNxdywgNTYwcHgpO1xyXG4gICAgICBib3JkZXItcmFkaXVzOiAxMHB4O1xyXG4gICAgICBvdmVyZmxvdzogaGlkZGVuO1xyXG4gICAgICBib3JkZXI6IDFweCBzb2xpZCByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMTQpO1xyXG4gICAgICBiYWNrZ3JvdW5kOiAjMDYxODI3O1xyXG4gICAgfVxyXG5cclxuICAgIC5yZW5kZXItY29weS1idG4ge1xyXG4gICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XHJcbiAgICAgIHRvcDogNnB4O1xyXG4gICAgICByaWdodDogNnB4O1xyXG4gICAgICB6LWluZGV4OiAyO1xyXG4gICAgICB3aWR0aDogMjZweDtcclxuICAgICAgaGVpZ2h0OiAyNnB4O1xyXG4gICAgICBib3JkZXI6IG5vbmU7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDdweDtcclxuICAgICAgZGlzcGxheTogaW5saW5lLWZsZXg7XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xyXG4gICAgICBwYWRkaW5nOiAwO1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDcsIDI5LCA0OCwgMC44Mik7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNzgpO1xyXG4gICAgICBjdXJzb3I6IHBvaW50ZXI7XHJcbiAgICAgIG9wYWNpdHk6IDA7XHJcbiAgICAgIHRyYW5zaXRpb246IG9wYWNpdHkgMC4xMnMsIGJhY2tncm91bmQgMC4xMnMsIGNvbG9yIDAuMTJzO1xyXG4gICAgfVxyXG5cclxuICAgIC5jb2RlLW1lc3NhZ2Utd3JhcDpob3ZlciAucmVuZGVyLWNvcHktYnRuLFxyXG4gICAgLnRhYmxlLW1lc3NhZ2Utd3JhcDpob3ZlciAucmVuZGVyLWNvcHktYnRuLFxyXG4gICAgLm1kLW1lc3NhZ2Utd3JhcDpob3ZlciAucmVuZGVyLWNvcHktYnRuLFxyXG4gICAgLnJlbmRlci1jb3B5LWJ0bjpmb2N1cyB7XHJcbiAgICAgIG9wYWNpdHk6IDE7XHJcbiAgICB9XHJcblxyXG4gICAgLnJlbmRlci1jb3B5LWJ0bjpob3ZlciB7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMTI3LCAxODAsIDI1NSwgMC4yMik7XHJcbiAgICAgIGNvbG9yOiAjZmZmO1xyXG4gICAgfVxyXG5cclxuICAgIC5yZW5kZXItY29weS1idG4gbWF0LWljb24ge1xyXG4gICAgICBmb250LXNpemU6IDE2cHg7XHJcbiAgICAgIHdpZHRoOiAxNnB4O1xyXG4gICAgICBoZWlnaHQ6IDE2cHg7XHJcbiAgICAgIGxpbmUtaGVpZ2h0OiAxNnB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5jb2RlLW1lc3NhZ2Uge1xyXG4gICAgICBtYXJnaW46IDA7XHJcbiAgICAgIHBhZGRpbmc6IDEycHggNDJweCAyOHB4IDEycHg7XHJcbiAgICAgIG92ZXJmbG93LXg6IGF1dG87XHJcbiAgICAgIGNvbG9yOiAjZGJlYWZlO1xyXG4gICAgICBmb250LWZhbWlseTogdWktbW9ub3NwYWNlLCBTRk1vbm8tUmVndWxhciwgTWVubG8sIE1vbmFjbywgQ29uc29sYXMsIFwiTGliZXJhdGlvbiBNb25vXCIsIG1vbm9zcGFjZTtcclxuICAgICAgZm9udC1zaXplOiBjYWxjKGNsYW1wKDEwcHgsIDMuMWNxdywgMTJweCkgKiB2YXIoLS1jb2RlLXRleHQtc2NhbGUsIDEpKTtcclxuICAgICAgbGluZS1oZWlnaHQ6IDEuNDU7XHJcbiAgICAgIHdoaXRlLXNwYWNlOiBwcmU7XHJcbiAgICAgIHRhYi1zaXplOiAyO1xyXG4gICAgICBzY3JvbGxiYXItd2lkdGg6IG5vbmU7XHJcbiAgICAgIC1tcy1vdmVyZmxvdy1zdHlsZTogbm9uZTtcclxuICAgIH1cclxuXHJcbiAgICAuY29kZS1tZXNzYWdlOjotd2Via2l0LXNjcm9sbGJhciB7XHJcbiAgICAgIGRpc3BsYXk6IG5vbmU7XHJcbiAgICB9XHJcblxyXG4gICAgLmNvZGUtbGFuZ3VhZ2Uge1xyXG4gICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XHJcbiAgICAgIHJpZ2h0OiA4cHg7XHJcbiAgICAgIGJvdHRvbTogNnB4O1xyXG4gICAgICBwYWRkaW5nOiAycHggN3B4O1xyXG4gICAgICBib3JkZXItcmFkaXVzOiA5OTlweDtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgxMjcsIDE4MCwgMjU1LCAwLjE2KTtcclxuICAgICAgY29sb3I6ICNiZmRiZmU7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTBweDtcclxuICAgICAgZm9udC13ZWlnaHQ6IDcwMDtcclxuICAgICAgbGV0dGVyLXNwYWNpbmc6IDAuMDVlbTtcclxuICAgICAgdGV4dC10cmFuc2Zvcm06IHVwcGVyY2FzZTtcclxuICAgICAgcG9pbnRlci1ldmVudHM6IG5vbmU7XHJcbiAgICB9XHJcblxyXG4gICAgLm1kLWxhbmd1YWdlIHtcclxuICAgICAgcG9zaXRpb246IGFic29sdXRlO1xyXG4gICAgICByaWdodDogOHB4O1xyXG4gICAgICBib3R0b206IDZweDtcclxuICAgICAgcGFkZGluZzogMnB4IDdweDtcclxuICAgICAgYm9yZGVyLXJhZGl1czogOTk5cHg7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMTM0LCAyMzksIDE3MiwgMC4xNCk7XHJcbiAgICAgIGNvbG9yOiAjYmJmN2QwO1xyXG4gICAgICBmb250LXNpemU6IDEwcHg7XHJcbiAgICAgIGZvbnQtd2VpZ2h0OiA3MDA7XHJcbiAgICAgIGxldHRlci1zcGFjaW5nOiAwLjA1ZW07XHJcbiAgICAgIHRleHQtdHJhbnNmb3JtOiB1cHBlcmNhc2U7XHJcbiAgICAgIHBvaW50ZXItZXZlbnRzOiBub25lO1xyXG4gICAgfVxyXG5cclxuICAgIDpob3N0IDo6bmctZGVlcCAuY29kZS10b2tlbi1rZXl3b3JkIHsgY29sb3I6ICM5M2M1ZmQ7IGZvbnQtd2VpZ2h0OiA3MDA7IH1cclxuICAgIDpob3N0IDo6bmctZGVlcCAuY29kZS10b2tlbi1zdHJpbmcgeyBjb2xvcjogIzg2ZWZhYzsgfVxyXG4gICAgOmhvc3QgOjpuZy1kZWVwIC5jb2RlLXRva2VuLW51bWJlciB7IGNvbG9yOiAjZmJiZjI0OyB9XHJcbiAgICA6aG9zdCA6Om5nLWRlZXAgLmNvZGUtdG9rZW4tY29tbWVudCB7IGNvbG9yOiAjOTRhM2I4OyBmb250LXN0eWxlOiBpdGFsaWM7IH1cclxuICAgIDpob3N0IDo6bmctZGVlcCAuY29kZS10b2tlbi1mdW5jdGlvbiB7IGNvbG9yOiAjYzRiNWZkOyB9XHJcblxyXG4gICAgLnRhYmxlLW1lc3NhZ2Utd3JhcCB7XHJcbiAgICAgIHBvc2l0aW9uOiByZWxhdGl2ZTtcclxuICAgICAgbWF4LXdpZHRoOiBtaW4oNzZjcXcsIDU2MHB4KTtcclxuICAgICAgb3ZlcmZsb3cteDogYXV0bztcclxuICAgICAgYm9yZGVyLXJhZGl1czogOXB4O1xyXG4gICAgICBib3JkZXI6IDFweCBzb2xpZCByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMTYpO1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMDQpO1xyXG4gICAgICBzY3JvbGxiYXItd2lkdGg6IG5vbmU7XHJcbiAgICAgIC1tcy1vdmVyZmxvdy1zdHlsZTogbm9uZTtcclxuICAgIH1cclxuXHJcbiAgICAudGFibGUtbWVzc2FnZS13cmFwOjotd2Via2l0LXNjcm9sbGJhciB7XHJcbiAgICAgIGRpc3BsYXk6IG5vbmU7XHJcbiAgICB9XHJcblxyXG4gICAgLnBhc3RlZC10YWJsZSB7XHJcbiAgICAgIGJvcmRlci1jb2xsYXBzZTogY29sbGFwc2U7XHJcbiAgICAgIG1pbi13aWR0aDogMTAwJTtcclxuICAgICAgZm9udC1zaXplOiBjYWxjKGNsYW1wKDEwcHgsIDMuMWNxdywgMTJweCkgKiB2YXIoLS1jb2RlLXRleHQtc2NhbGUsIDEpKTtcclxuICAgICAgbGluZS1oZWlnaHQ6IDEuMzU7XHJcbiAgICAgIGNvbG9yOiAjZjVmN2ZmO1xyXG4gICAgfVxyXG5cclxuICAgIC5wYXN0ZWQtdGFibGUgdGgsXHJcbiAgICAucGFzdGVkLXRhYmxlIHRkIHtcclxuICAgICAgcGFkZGluZzogNnB4IDlweDtcclxuICAgICAgYm9yZGVyLXJpZ2h0OiAxcHggc29saWQgcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjEyKTtcclxuICAgICAgYm9yZGVyLWJvdHRvbTogMXB4IHNvbGlkIHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xMik7XHJcbiAgICAgIHRleHQtYWxpZ246IGxlZnQ7XHJcbiAgICAgIHdoaXRlLXNwYWNlOiBwcmUtd3JhcDtcclxuICAgICAgdmVydGljYWwtYWxpZ246IHRvcDtcclxuICAgIH1cclxuXHJcbiAgICAucGFzdGVkLXRhYmxlIHRoIHtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjEpO1xyXG4gICAgICBmb250LXdlaWdodDogNzAwO1xyXG4gICAgfVxyXG5cclxuICAgIC5wYXN0ZWQtdGFibGUgdHI6bGFzdC1jaGlsZCB0ZCxcclxuICAgIC5wYXN0ZWQtdGFibGUgdHI6bGFzdC1jaGlsZCB0aCB7XHJcbiAgICAgIGJvcmRlci1ib3R0b206IG5vbmU7XHJcbiAgICB9XHJcblxyXG4gICAgLnBhc3RlZC10YWJsZSB0aDpsYXN0LWNoaWxkLFxyXG4gICAgLnBhc3RlZC10YWJsZSB0ZDpsYXN0LWNoaWxkIHtcclxuICAgICAgYm9yZGVyLXJpZ2h0OiBub25lO1xyXG4gICAgfVxyXG5cclxuICAgIC5tZC1tZXNzYWdlLXdyYXAge1xyXG4gICAgICBwb3NpdGlvbjogcmVsYXRpdmU7XHJcbiAgICAgIG1heC13aWR0aDogbWluKDc2Y3F3LCA1NjBweCk7XHJcbiAgICAgIG92ZXJmbG93LXg6IGF1dG87XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDEwcHg7XHJcbiAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xMik7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4wNSk7XHJcbiAgICAgIHNjcm9sbGJhci13aWR0aDogbm9uZTtcclxuICAgICAgLW1zLW92ZXJmbG93LXN0eWxlOiBub25lO1xyXG4gICAgfVxyXG5cclxuICAgIC5tZC1tZXNzYWdlLXdyYXA6Oi13ZWJraXQtc2Nyb2xsYmFyIHtcclxuICAgICAgZGlzcGxheTogbm9uZTtcclxuICAgIH1cclxuXHJcbiAgICAubWQtbWVzc2FnZSB7XHJcbiAgICAgIHBhZGRpbmc6IDEwcHggNDJweCAyOHB4IDEycHg7XHJcbiAgICAgIGNvbG9yOiAjZjVmN2ZmO1xyXG4gICAgICBmb250LXNpemU6IGNhbGMoY2xhbXAoMTFweCwgMy40Y3F3LCAxM3B4KSAqIHZhcigtLW1lc3NhZ2UtdGV4dC1zY2FsZSwgMSkpO1xyXG4gICAgICBsaW5lLWhlaWdodDogMS40NTtcclxuICAgICAgb3ZlcmZsb3ctd3JhcDogYW55d2hlcmU7XHJcbiAgICB9XHJcblxyXG4gICAgOmhvc3QgOjpuZy1kZWVwIC5tZC1tZXNzYWdlIGgxLFxyXG4gICAgOmhvc3QgOjpuZy1kZWVwIC5tZC1tZXNzYWdlIGgyLFxyXG4gICAgOmhvc3QgOjpuZy1kZWVwIC5tZC1tZXNzYWdlIGgzIHtcclxuICAgICAgbWFyZ2luOiA4cHggMCA2cHg7XHJcbiAgICAgIGNvbG9yOiAjZmZmO1xyXG4gICAgICBsaW5lLWhlaWdodDogMS4yNTtcclxuICAgIH1cclxuXHJcbiAgICA6aG9zdCA6Om5nLWRlZXAgLm1kLW1lc3NhZ2UgaDEgeyBmb250LXNpemU6IDE4cHg7IH1cclxuICAgIDpob3N0IDo6bmctZGVlcCAubWQtbWVzc2FnZSBoMiB7IGZvbnQtc2l6ZTogMTZweDsgfVxyXG4gICAgOmhvc3QgOjpuZy1kZWVwIC5tZC1tZXNzYWdlIGgzIHsgZm9udC1zaXplOiAxNHB4OyB9XHJcblxyXG4gICAgOmhvc3QgOjpuZy1kZWVwIC5tZC1tZXNzYWdlIHAge1xyXG4gICAgICBtYXJnaW46IDZweCAwO1xyXG4gICAgfVxyXG5cclxuICAgIDpob3N0IDo6bmctZGVlcCAubWQtbWVzc2FnZSB1bCxcclxuICAgIDpob3N0IDo6bmctZGVlcCAubWQtbWVzc2FnZSBvbCB7XHJcbiAgICAgIG1hcmdpbjogNnB4IDA7XHJcbiAgICAgIHBhZGRpbmctbGVmdDogMjBweDtcclxuICAgIH1cclxuXHJcbiAgICA6aG9zdCA6Om5nLWRlZXAgLm1kLW1lc3NhZ2UgYmxvY2txdW90ZSB7XHJcbiAgICAgIG1hcmdpbjogOHB4IDA7XHJcbiAgICAgIHBhZGRpbmctbGVmdDogMTBweDtcclxuICAgICAgYm9yZGVyLWxlZnQ6IDNweCBzb2xpZCByZ2JhKDEyNywgMTgwLCAyNTUsIDAuNTUpO1xyXG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjc4KTtcclxuICAgIH1cclxuXHJcbiAgICA6aG9zdCA6Om5nLWRlZXAgLm1kLW1lc3NhZ2UgY29kZSB7XHJcbiAgICAgIHBhZGRpbmc6IDFweCA1cHg7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDVweDtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgwLCAwLCAwLCAwLjI1KTtcclxuICAgICAgY29sb3I6ICNiZmRiZmU7XHJcbiAgICAgIGZvbnQtZmFtaWx5OiB1aS1tb25vc3BhY2UsIFNGTW9uby1SZWd1bGFyLCBNZW5sbywgTW9uYWNvLCBDb25zb2xhcywgXCJMaWJlcmF0aW9uIE1vbm9cIiwgbW9ub3NwYWNlO1xyXG4gICAgICBmb250LXNpemU6IDEycHg7XHJcbiAgICB9XHJcblxyXG4gICAgOmhvc3QgOjpuZy1kZWVwIC5tZC1tZXNzYWdlIHByZSB7XHJcbiAgICAgIG1hcmdpbjogOHB4IDA7XHJcbiAgICAgIHBhZGRpbmc6IDlweDtcclxuICAgICAgYm9yZGVyLXJhZGl1czogOHB4O1xyXG4gICAgICBvdmVyZmxvdy14OiBhdXRvO1xyXG4gICAgICBiYWNrZ3JvdW5kOiAjMDYxODI3O1xyXG4gICAgICBzY3JvbGxiYXItd2lkdGg6IG5vbmU7XHJcbiAgICAgIC1tcy1vdmVyZmxvdy1zdHlsZTogbm9uZTtcclxuICAgIH1cclxuXHJcbiAgICA6aG9zdCA6Om5nLWRlZXAgLm1kLW1lc3NhZ2UgcHJlOjotd2Via2l0LXNjcm9sbGJhciB7XHJcbiAgICAgIGRpc3BsYXk6IG5vbmU7XHJcbiAgICB9XHJcblxyXG4gICAgOmhvc3QgOjpuZy1kZWVwIC5tZC1tZXNzYWdlIHByZSBjb2RlIHtcclxuICAgICAgcGFkZGluZzogMDtcclxuICAgICAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQ7XHJcbiAgICAgIGNvbG9yOiAjZGJlYWZlO1xyXG4gICAgICB3aGl0ZS1zcGFjZTogcHJlO1xyXG4gICAgfVxyXG5cclxuICAgIC5pbWFnZS1tZXNzYWdlIHtcclxuICAgICAgbGluZS1oZWlnaHQ6IDA7XHJcbiAgICB9XHJcblxyXG4gICAgLm1lZGlhLXdyYXBwZXIge1xyXG4gICAgICBwb3NpdGlvbjogcmVsYXRpdmU7XHJcbiAgICAgIGRpc3BsYXk6IGlubGluZS1ibG9jaztcclxuICAgICAgbGluZS1oZWlnaHQ6IDA7XHJcbiAgICAgIHdpZHRoOiB2YXIoLS1hdHRhY2htZW50LXRodW1iLXNpemUpO1xyXG4gICAgICBoZWlnaHQ6IHZhcigtLWF0dGFjaG1lbnQtdGh1bWItc2l6ZSk7XHJcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDEwcHg7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4wOCk7XHJcbiAgICB9XHJcblxyXG4gICAgLm1lZGlhLWltZyB7XHJcbiAgICAgIHdpZHRoOiAxMDAlO1xyXG4gICAgICBoZWlnaHQ6IDEwMCU7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IGluaGVyaXQ7XHJcbiAgICAgIGRpc3BsYXk6IGJsb2NrO1xyXG4gICAgICBjdXJzb3I6IHpvb20taW47XHJcbiAgICAgIG9iamVjdC1maXQ6IGNvdmVyO1xyXG4gICAgfVxyXG5cclxuICAgIC5hdHRhY2htZW50LWFjdGlvbnMge1xyXG4gICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XHJcbiAgICAgIHJpZ2h0OiA2cHg7XHJcbiAgICAgIHRvcDogNnB4O1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBnYXA6IDRweDtcclxuICAgICAgb3BhY2l0eTogMDtcclxuICAgICAgdHJhbnNpdGlvbjogb3BhY2l0eSAwLjEycyBlYXNlO1xyXG4gICAgICBwb2ludGVyLWV2ZW50czogbm9uZTtcclxuICAgIH1cclxuXHJcbiAgICAubWVkaWEtd3JhcHBlcjpob3ZlciAuYXR0YWNobWVudC1hY3Rpb25zIHtcclxuICAgICAgb3BhY2l0eTogMTtcclxuICAgICAgcG9pbnRlci1ldmVudHM6IGF1dG87XHJcbiAgICB9XHJcblxyXG4gICAgLmF0dGFjaG1lbnQtYWN0aW9uLWJ0bixcclxuICAgIC5maWxlLWRvd25sb2FkLWJ0biB7XHJcbiAgICAgIGJvcmRlcjogbm9uZTtcclxuICAgICAgYm9yZGVyLXJhZGl1czogOTk5cHg7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoNywgMjksIDQ4LCAwLjgyKTtcclxuICAgICAgY29sb3I6ICNmZmY7XHJcbiAgICAgIGRpc3BsYXk6IGlubGluZS1mbGV4O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcclxuICAgICAgY3Vyc29yOiBwb2ludGVyO1xyXG4gICAgICBwYWRkaW5nOiAwO1xyXG4gICAgfVxyXG5cclxuICAgIC5hdHRhY2htZW50LWFjdGlvbi1idG4ge1xyXG4gICAgICB3aWR0aDogMjhweDtcclxuICAgICAgaGVpZ2h0OiAyOHB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5hdHRhY2htZW50LWFjdGlvbi1idG4gbWF0LWljb24ge1xyXG4gICAgICBmb250LXNpemU6IDE3cHg7XHJcbiAgICAgIHdpZHRoOiAxN3B4O1xyXG4gICAgICBoZWlnaHQ6IDE3cHg7XHJcbiAgICB9XHJcblxyXG4gICAgLm1lZGlhLXZpZGVvIHtcclxuICAgICAgbWF4LXdpZHRoOiAyNDBweDtcclxuICAgICAgbWF4LWhlaWdodDogMjYwcHg7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDEwcHg7XHJcbiAgICAgIGRpc3BsYXk6IGJsb2NrO1xyXG4gICAgICBiYWNrZ3JvdW5kOiAjMDAwO1xyXG4gICAgfVxyXG5cclxuICAgIC52aWRlby1tZXNzYWdlIHtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcclxuICAgICAgZ2FwOiA2cHg7XHJcbiAgICB9XHJcblxyXG4gICAgLnZpZGVvLWRvd25sb2FkIHtcclxuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC43OCk7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTJweDtcclxuICAgICAgdGV4dC1kZWNvcmF0aW9uOiB1bmRlcmxpbmU7XHJcbiAgICAgIHRleHQtdW5kZXJsaW5lLW9mZnNldDogMnB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5tZWRpYS1wbGFjZWhvbGRlciB7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xyXG4gICAgICBnYXA6IDhweDtcclxuICAgICAgd2lkdGg6IHZhcigtLWF0dGFjaG1lbnQtdGh1bWItc2l6ZSk7XHJcbiAgICAgIGhlaWdodDogdmFyKC0tYXR0YWNobWVudC10aHVtYi1zaXplKTtcclxuICAgICAgYm9yZGVyLXJhZGl1czogMTBweDtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjA4KTtcclxuICAgICAgY29sb3I6IHJnYmEoMjU1LDI1NSwyNTUsMC42KTtcclxuICAgICAgZm9udC1zaXplOiAxMXB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5tZWRpYS1sb2FkLWxhYmVsIHtcclxuICAgICAgZm9udC1zaXplOiAxMXB4O1xyXG4gICAgICBjb2xvcjogcmdiYSgyNTUsMjU1LDI1NSwwLjYpO1xyXG4gICAgfVxyXG5cclxuICAgIC5hdHRhY2htZW50cy1saXN0IHtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcclxuICAgICAgZ2FwOiA4cHg7XHJcbiAgICAgIG1heC13aWR0aDogMTAwJTtcclxuICAgIH1cclxuXHJcbiAgICAuYXR0YWNobWVudC1pdGVtIHtcclxuICAgICAgbWF4LXdpZHRoOiAxMDAlO1xyXG4gICAgfVxyXG5cclxuICAgIC5maWxlLW1lc3NhZ2Uge1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBnYXA6IDhweDtcclxuICAgICAgcGFkZGluZzogNHB4IDA7XHJcbiAgICB9XHJcblxyXG4gICAgLmF0dGFjaG1lbnQtdGh1bWIuZmlsZS1tZXNzYWdlIHtcclxuICAgICAgcG9zaXRpb246IHJlbGF0aXZlO1xyXG4gICAgICB3aWR0aDogdmFyKC0tYXR0YWNobWVudC10aHVtYi1zaXplKTtcclxuICAgICAgaGVpZ2h0OiB2YXIoLS1hdHRhY2htZW50LXRodW1iLXNpemUpO1xyXG4gICAgICBwYWRkaW5nOiAxMnB4O1xyXG4gICAgICBib3JkZXItcmFkaXVzOiAxMHB4O1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMDgpO1xyXG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xyXG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcclxuICAgICAgYm94LXNpemluZzogYm9yZGVyLWJveDtcclxuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcclxuICAgIH1cclxuXHJcbiAgICAuZmlsZS1kb3dubG9hZCB7XHJcbiAgICAgIGRpc3BsYXk6IGlubGluZS1mbGV4O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBnYXA6IDhweDtcclxuICAgICAgY29sb3I6ICNmZmY7XHJcbiAgICAgIHRleHQtZGVjb3JhdGlvbjogbm9uZTtcclxuICAgICAgbWF4LXdpZHRoOiAyNDBweDtcclxuICAgIH1cclxuXHJcbiAgICAuZmlsZS1tc2ctaWNvbiB7XHJcbiAgICAgIGZvbnQtc2l6ZTogNDJweDtcclxuICAgICAgd2lkdGg6IDQycHg7XHJcbiAgICAgIGhlaWdodDogNDJweDtcclxuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC44KTtcclxuICAgICAgZmxleC1zaHJpbms6IDA7XHJcbiAgICB9XHJcblxyXG4gICAgLmZpbGUtbXNnLW5hbWUge1xyXG4gICAgICBmb250LXNpemU6IDEzcHg7XHJcbiAgICAgIGNvbG9yOiAjZmZmO1xyXG4gICAgICBsaW5lLWhlaWdodDogMS4yO1xyXG4gICAgICBtYXgtd2lkdGg6IDEwMCU7XHJcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XHJcbiAgICAgIHRleHQtYWxpZ246IGNlbnRlcjtcclxuICAgICAgdGV4dC1vdmVyZmxvdzogZWxsaXBzaXM7XHJcbiAgICAgIGRpc3BsYXk6IC13ZWJraXQtYm94O1xyXG4gICAgICAtd2Via2l0LWxpbmUtY2xhbXA6IDM7XHJcbiAgICAgIC13ZWJraXQtYm94LW9yaWVudDogdmVydGljYWw7XHJcbiAgICAgIHdvcmQtYnJlYWs6IGJyZWFrLXdvcmQ7XHJcbiAgICB9XHJcblxyXG4gICAgLmZpbGUtZG93bmxvYWQtaWNvbiB7XHJcbiAgICAgIGZvbnQtc2l6ZTogMThweDtcclxuICAgICAgd2lkdGg6IDE4cHg7XHJcbiAgICAgIGhlaWdodDogMThweDtcclxuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC43KTtcclxuICAgICAgZmxleC1zaHJpbms6IDA7XHJcbiAgICB9XHJcblxyXG4gICAgLmZpbGUtZG93bmxvYWQtYnRuIHtcclxuICAgICAgd2lkdGg6IDI0cHg7XHJcbiAgICAgIGhlaWdodDogMjRweDtcclxuICAgICAgZmxleC1zaHJpbms6IDA7XHJcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcclxuICAgICAgcmlnaHQ6IDZweDtcclxuICAgICAgdG9wOiA2cHg7XHJcbiAgICB9XHJcblxyXG4gICAgLmZpbGUtZG93bmxvYWQtbGluayB7XHJcbiAgICAgIGJvcmRlcjogbm9uZTtcclxuICAgICAgYm9yZGVyLXJhZGl1czogOTk5cHg7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xNik7XHJcbiAgICAgIGNvbG9yOiAjZmZmO1xyXG4gICAgICBjdXJzb3I6IHBvaW50ZXI7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTFweDtcclxuICAgICAgcGFkZGluZzogNHB4IDEwcHg7XHJcbiAgICAgIG1hcmdpbi10b3A6IDRweDtcclxuICAgIH1cclxuXHJcbiAgICAubWVzc2FnZS1tZXRhIHtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAgZ2FwOiA0cHg7XHJcbiAgICAgIG1hcmdpbi10b3A6IDNweDtcclxuICAgIH1cclxuXHJcbiAgICAubXNnLXRpbWUge1xyXG4gICAgICBmb250LXNpemU6IDEwcHg7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDIxOCwgMjI0LCAyNTAsIDAuNjYpO1xyXG4gICAgfVxyXG5cclxuICAgIC5tZXNzYWdlLWJ1YmJsZS1yb3cub3RoZXIgLm1zZy10aW1lIHtcclxuICAgICAgY29sb3I6IHJnYmEoMjE2LCAyMjMsIDI0NiwgMC41OCk7XHJcbiAgICB9XHJcblxyXG4gICAgLmVkaXRlZC1sYWJlbCB7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTBweDtcclxuICAgICAgZm9udC1zdHlsZTogaXRhbGljO1xyXG4gICAgICBjb2xvcjogcmdiYSgyMTgsIDIyNCwgMjUwLCAwLjYyKTtcclxuICAgIH1cclxuXHJcbiAgICAucmVhZC1pY29uIHtcclxuICAgICAgZm9udC1zaXplOiAxNHB4O1xyXG4gICAgICB3aWR0aDogMTRweDtcclxuICAgICAgaGVpZ2h0OiAxNHB4O1xyXG4gICAgICBvcGFjaXR5OiAwLjc7XHJcbiAgICB9XHJcblxyXG4gICAgLnJlYWQtaWNvbi5yZWFkIHtcclxuICAgICAgY29sb3I6ICM2MGE1ZmE7XHJcbiAgICAgIG9wYWNpdHk6IDE7XHJcbiAgICB9XHJcblxyXG4gICAgLnJlYWQtaWNvbi51bnJlYWQge1xyXG4gICAgICBjb2xvcjogcmdiYSgyMTgsIDIyNCwgMjUwLCAwLjUpO1xyXG4gICAgICBvcGFjaXR5OiAxO1xyXG4gICAgfVxyXG5cclxuICAgIC5yZXBseS1tZXNzYWdlLWJ0biB7XHJcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcclxuICAgICAgcmlnaHQ6IC0xMHB4O1xyXG4gICAgICBib3R0b206IC0xMHB4O1xyXG4gICAgICB3aWR0aDogMjRweDtcclxuICAgICAgaGVpZ2h0OiAyNHB4O1xyXG4gICAgICBib3JkZXI6IDFweCBzb2xpZCByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMTYpO1xyXG4gICAgICBib3JkZXItcmFkaXVzOiA5OTlweDtcclxuICAgICAgYmFja2dyb3VuZDogIzA3MWQzMDtcclxuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC43OCk7XHJcbiAgICAgIGRpc3BsYXk6IGlubGluZS1mbGV4O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcclxuICAgICAgcGFkZGluZzogMDtcclxuICAgICAgY3Vyc29yOiBwb2ludGVyO1xyXG4gICAgICBvcGFjaXR5OiAwO1xyXG4gICAgICB0cmFuc2Zvcm06IHNjYWxlKDAuOTIpO1xyXG4gICAgICB0cmFuc2l0aW9uOiBvcGFjaXR5IDAuMTJzLCB0cmFuc2Zvcm0gMC4xMnMsIGJhY2tncm91bmQgMC4xMnMsIGNvbG9yIDAuMTJzO1xyXG4gICAgICB6LWluZGV4OiAzO1xyXG4gICAgfVxyXG5cclxuICAgIC5tZXNzYWdlLWJ1YmJsZTpob3ZlciAucmVwbHktbWVzc2FnZS1idG4sXHJcbiAgICAucmVwbHktbWVzc2FnZS1idG46Zm9jdXMge1xyXG4gICAgICBvcGFjaXR5OiAxO1xyXG4gICAgICB0cmFuc2Zvcm06IHNjYWxlKDEpO1xyXG4gICAgfVxyXG5cclxuICAgIC5yZXBseS1tZXNzYWdlLWJ0bjpob3ZlciB7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMTI3LCAxODAsIDI1NSwgMC4yMik7XHJcbiAgICAgIGNvbG9yOiAjZmZmO1xyXG4gICAgfVxyXG5cclxuICAgIC5yZXBseS1tZXNzYWdlLWJ0biBtYXQtaWNvbiB7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTVweDtcclxuICAgICAgd2lkdGg6IDE1cHg7XHJcbiAgICAgIGhlaWdodDogMTVweDtcclxuICAgICAgbGluZS1oZWlnaHQ6IDE1cHg7XHJcbiAgICB9XHJcblxyXG4gICAgLnF1aWNrLXJlYWN0aW9ucyB7XHJcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcclxuICAgICAgdG9wOiAtMThweDtcclxuICAgICAgcmlnaHQ6IDA7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgIGdhcDogNHB4O1xyXG4gICAgICBwYWRkaW5nOiAzcHggNXB4O1xyXG4gICAgICBiYWNrZ3JvdW5kOiAjMDcxZDMwO1xyXG4gICAgICBib3JkZXI6IDFweCBzb2xpZCByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMTQpO1xyXG4gICAgICBib3JkZXItcmFkaXVzOiA5OTlweDtcclxuICAgICAgYm94LXNoYWRvdzogMCA2cHggMTRweCByZ2JhKDAsIDAsIDAsIDAuMjgpO1xyXG4gICAgICB6LWluZGV4OiA0O1xyXG4gICAgfVxyXG5cclxuICAgIC8qIFJlY2VpdmVkIG1lc3NhZ2VzIHNpdCBvbiB0aGUgbGVmdCwgc28gZ3JvdyB0aGUgcGlja2VyIHJpZ2h0d2FyZC5cclxuICAgICAgIE93biBtZXNzYWdlcyBzaXQgb24gdGhlIHJpZ2h0LCBzbyBncm93IHRoZSBwaWNrZXIgbGVmdHdhcmQuICovXHJcbiAgICAubWVzc2FnZS1idWJibGUtcm93Lm90aGVyIC5xdWljay1yZWFjdGlvbnMge1xyXG4gICAgICBsZWZ0OiAwO1xyXG4gICAgICByaWdodDogYXV0bztcclxuICAgIH1cclxuXHJcbiAgICAubWVzc2FnZS1idWJibGUtcm93Lm93biAucXVpY2stcmVhY3Rpb25zIHtcclxuICAgICAgbGVmdDogYXV0bztcclxuICAgICAgcmlnaHQ6IDA7XHJcbiAgICB9XHJcblxyXG4gICAgLnF1aWNrLWVtb2ppLWJ0biB7XHJcbiAgICAgIHdpZHRoOiAyMHB4O1xyXG4gICAgICBoZWlnaHQ6IDIwcHg7XHJcbiAgICAgIGJvcmRlcjogbm9uZTtcclxuICAgICAgYm9yZGVyLXJhZGl1czogOTk5cHg7XHJcbiAgICAgIGJhY2tncm91bmQ6IHRyYW5zcGFyZW50O1xyXG4gICAgICBjb2xvcjogI2ZmZjtcclxuICAgICAgZGlzcGxheTogaW5saW5lLWZsZXg7XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xyXG4gICAgICBmb250LXNpemU6IDEzcHg7XHJcbiAgICAgIGxpbmUtaGVpZ2h0OiAxO1xyXG4gICAgICBjdXJzb3I6IHBvaW50ZXI7XHJcbiAgICAgIHBhZGRpbmc6IDA7XHJcbiAgICAgIHRyYW5zaXRpb246IHRyYW5zZm9ybSAwLjEycyBlYXNlLCBiYWNrZ3JvdW5kIDAuMTJzIGVhc2U7XHJcbiAgICB9XHJcblxyXG4gICAgLnF1aWNrLWVtb2ppLWJ0bjpob3ZlciB7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xOCk7XHJcbiAgICAgIHRyYW5zZm9ybTogc2NhbGUoMS4xNCk7XHJcbiAgICB9XHJcblxyXG4gICAgLnJlYWN0aW9ucy1yb3cge1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBmbGV4LXdyYXA6IHdyYXA7XHJcbiAgICAgIGdhcDogM3B4O1xyXG4gICAgICBtYXJnaW4tdG9wOiA1cHg7XHJcbiAgICB9XHJcblxyXG4gICAgLnJlYWN0aW9uLWNoaXAge1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwyNTUsMjU1LDAuMDgpO1xyXG4gICAgICBib3JkZXI6IDFweCBzb2xpZCByZ2JhKDI1NSwyNTUsMjU1LDAuMik7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDk5OXB4O1xyXG4gICAgICBwYWRkaW5nOiAycHggN3B4O1xyXG4gICAgICBmb250LXNpemU6IDExcHg7XHJcbiAgICAgIGNvbG9yOiAjZjJmNmZmO1xyXG4gICAgICBjdXJzb3I6IHBvaW50ZXI7XHJcbiAgICAgIHRyYW5zaXRpb246IGFsbCAwLjJzO1xyXG4gICAgICBkaXNwbGF5OiBpbmxpbmUtZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAgZ2FwOiAzcHg7XHJcbiAgICAgIG1heC13aWR0aDogMTgwcHg7XHJcbiAgICB9XHJcblxyXG4gICAgLnJlYWN0aW9uLWNoaXA6aG92ZXIge1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwyNTUsMjU1LDAuMjUpO1xyXG4gICAgICB0cmFuc2Zvcm06IHNjYWxlKDEuMDUpO1xyXG4gICAgfVxyXG5cclxuICAgIC5yZWFjdGlvbi1jaGlwLm93bi1yZWFjdGlvbiB7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoNDIsOTEsMjU1LDAuMyk7XHJcbiAgICAgIGJvcmRlci1jb2xvcjogcmdiYSg0Miw5MSwyNTUsMC41KTtcclxuICAgIH1cclxuXHJcbiAgICAuZW1wdHktY2hhdCB7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xyXG4gICAgICBmbGV4OiAxO1xyXG4gICAgICBjb2xvcjogIzljYTNhZjtcclxuICAgIH1cclxuXHJcbiAgICAuZW1wdHktY2hhdCBtYXQtaWNvbiB7XHJcbiAgICAgIGZvbnQtc2l6ZTogNDhweDtcclxuICAgICAgd2lkdGg6IDQ4cHg7XHJcbiAgICAgIGhlaWdodDogNDhweDtcclxuICAgICAgbWFyZ2luLWJvdHRvbTogOHB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5lbXB0eS1jaGF0IHAge1xyXG4gICAgICBmb250LXNpemU6IDE0cHg7XHJcbiAgICAgIG1hcmdpbjogMDtcclxuICAgIH1cclxuXHJcbiAgICAubWVzc2FnZS1jb250ZXh0LW1lbnUge1xyXG4gICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XHJcbiAgICAgIHotaW5kZXg6IDEwMDAwO1xyXG4gICAgICBtaW4td2lkdGg6IDE1MHB4O1xyXG4gICAgICBwYWRkaW5nOiA2cHg7XHJcbiAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xNCk7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDEycHg7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoNywgMTcsIDMwLCAwLjk4KTtcclxuICAgICAgYm94LXNoYWRvdzogMCAxOHB4IDQ1cHggcmdiYSgwLCAwLCAwLCAwLjM4KTtcclxuICAgICAgY29sb3I6ICNmOGZhZmM7XHJcbiAgICB9XHJcblxyXG4gICAgLmNvbnRleHQtbWVudS1pdGVtIHtcclxuICAgICAgd2lkdGg6IDEwMCU7XHJcbiAgICAgIGJvcmRlcjogMDtcclxuICAgICAgYm9yZGVyLXJhZGl1czogOXB4O1xyXG4gICAgICBwYWRkaW5nOiA5cHggMTBweDtcclxuICAgICAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQ7XHJcbiAgICAgIGNvbG9yOiBpbmhlcml0O1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBnYXA6IDlweDtcclxuICAgICAgY3Vyc29yOiBwb2ludGVyO1xyXG4gICAgICBmb250LXNpemU6IDEzcHg7XHJcbiAgICAgIHRleHQtYWxpZ246IGxlZnQ7XHJcbiAgICB9XHJcblxyXG4gICAgLmNvbnRleHQtbWVudS1pdGVtOmhvdmVyIHtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjA5KTtcclxuICAgIH1cclxuXHJcbiAgICAuY29udGV4dC1tZW51LWl0ZW0gbWF0LWljb24ge1xyXG4gICAgICBmb250LXNpemU6IDE3cHg7XHJcbiAgICAgIHdpZHRoOiAxN3B4O1xyXG4gICAgICBoZWlnaHQ6IDE3cHg7XHJcbiAgICB9XHJcblxyXG4gICAgLmNvbnRleHQtbWVudS1pdGVtLmRhbmdlciB7XHJcbiAgICAgIGNvbG9yOiAjZmVjYWNhO1xyXG4gICAgfVxyXG5cclxuICAgIC5jb250ZXh0LW1lbnUtY29uZmlybSB7XHJcbiAgICAgIHBhZGRpbmc6IDhweDtcclxuICAgICAgd2lkdGg6IDE5MHB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5jb25maXJtLXRpdGxlIHtcclxuICAgICAgY29sb3I6ICNmOGZhZmM7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTNweDtcclxuICAgICAgZm9udC13ZWlnaHQ6IDYwMDtcclxuICAgICAgbWFyZ2luLWJvdHRvbTogMTBweDtcclxuICAgIH1cclxuXHJcbiAgICAuY29uZmlybS1hY3Rpb25zIHtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAganVzdGlmeS1jb250ZW50OiBmbGV4LWVuZDtcclxuICAgICAgZ2FwOiA4cHg7XHJcbiAgICB9XHJcblxyXG4gICAgLmNvbmZpcm0tY2FuY2VsLFxyXG4gICAgLmNvbmZpcm0tZGVsZXRlIHtcclxuICAgICAgYm9yZGVyOiAwO1xyXG4gICAgICBib3JkZXItcmFkaXVzOiA4cHg7XHJcbiAgICAgIHBhZGRpbmc6IDdweCAxMHB4O1xyXG4gICAgICBjb2xvcjogI2Y4ZmFmYztcclxuICAgICAgY3Vyc29yOiBwb2ludGVyO1xyXG4gICAgICBmb250LXNpemU6IDEycHg7XHJcbiAgICB9XHJcblxyXG4gICAgLmNvbmZpcm0tY2FuY2VsIHtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjEyKTtcclxuICAgIH1cclxuXHJcbiAgICAuY29uZmlybS1kZWxldGUge1xyXG4gICAgICBiYWNrZ3JvdW5kOiAjZGMyNjI2O1xyXG4gICAgfVxyXG4gIGBdLFxyXG59KVxyXG5leHBvcnQgY2xhc3MgQ2hhdFRocmVhZENvbXBvbmVudCBpbXBsZW1lbnRzIE9uSW5pdCwgT25EZXN0cm95LCBBZnRlclZpZXdDaGVja2VkIHtcclxuICBAVmlld0NoaWxkKCdzY3JvbGxDb250YWluZXInKSBzY3JvbGxDb250YWluZXIhOiBFbGVtZW50UmVmO1xyXG4gIEBWaWV3Q2hpbGQoJ3RocmVhZFJvb3QnKSB0aHJlYWRSb290ITogRWxlbWVudFJlZjxIVE1MRWxlbWVudD47XHJcbiAgQFZpZXdDaGlsZHJlbignaW5saW5lRWRpdFRleHRhcmVhJykgaW5saW5lRWRpdFRleHRhcmVhcyE6IFF1ZXJ5TGlzdDxFbGVtZW50UmVmPEhUTUxUZXh0QXJlYUVsZW1lbnQ+PjtcclxuICBAVmlld0NoaWxkKE1lc3NhZ2VJbnB1dENvbXBvbmVudCkgbWVzc2FnZUlucHV0PzogTWVzc2FnZUlucHV0Q29tcG9uZW50O1xyXG4gIEBPdXRwdXQoKSBsaWdodGJveE9wZW4gPSBuZXcgRXZlbnRFbWl0dGVyPHN0cmluZz4oKTtcclxuXHJcbiAgbWVzc2FnZXM6IE1lc3NhZ2VbXSA9IFtdO1xyXG4gIHZpc2libGVDb250YWN0czogQ29udGFjdFtdID0gW107XHJcbiAgY29udmVyc2F0aW9uTmFtZSA9ICcnO1xyXG4gIGlzR3JvdXAgPSBmYWxzZTtcclxuICBpc1Byb2plY3QgPSBmYWxzZTtcclxuICBpc1JlbW92ZWRGcm9tR3JvdXAgPSBmYWxzZTtcclxuICBtZXNzYWdlVGV4dFNjYWxlID0gMTtcclxuICBjb2RlVGV4dFNjYWxlID0gMTtcclxuICBsb2FkaW5nID0gZmFsc2U7XHJcbiAgbXlDb250YWN0SWQ6IHN0cmluZyB8IG51bGwgPSBudWxsO1xyXG4gIHJlcGx5VG9NZXNzYWdlOiBNZXNzYWdlIHwgbnVsbCA9IG51bGw7XHJcbiAgZWRpdGluZ01lc3NhZ2U6IE1lc3NhZ2UgfCBudWxsID0gbnVsbDtcclxuICBlZGl0aW5nRHJhZnQgPSAnJztcclxuICBtZW50aW9uT3B0aW9uczogTWVudGlvbk9wdGlvbltdID0gW107XHJcblxyXG4gIGNvbnZlcnNhdGlvbklkOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcclxuICBwcml2YXRlIHN1YiE6IFN1YnNjcmlwdGlvbjtcclxuICBwcml2YXRlIHNob3VsZFNjcm9sbFRvQm90dG9tID0gdHJ1ZTtcclxuXHJcbiAgdXBsb2FkaW5nID0gZmFsc2U7XHJcbiAgaG92ZXJlZE1lc3NhZ2VJZDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XHJcbiAgbWVzc2FnZUNvbnRleHRNZW51OiB7IG1lc3NhZ2U6IE1lc3NhZ2U7IHg6IG51bWJlcjsgeTogbnVtYmVyOyBjb25maXJtRGVsZXRlOiBib29sZWFuIH0gfCBudWxsID0gbnVsbDtcclxuICBxdWlja0Vtb2ppcyA9IFsn4p2k77iPJywgJ/CfkY0nLCAn8J+YgicsICfwn5iuJywgJ/CfmKInLCAn8J+UpSddO1xyXG4gIHRocmVhZERyYWdPdmVyID0gZmFsc2U7XHJcbiAgcHJpdmF0ZSB0aHJlYWREcmFnRGVwdGggPSAwO1xyXG4gIHByaXZhdGUgYm91bmRSZXNldFRocmVhZERyYWcgPSB0aGlzLnJlc2V0VGhyZWFkRHJhZy5iaW5kKHRoaXMpO1xyXG5cclxuICAvKiogVHJhY2tzIHdoaWNoIGZpbGUgSURzIGFyZSBjdXJyZW50bHkgYmVpbmcgZmV0Y2hlZCB0byBhdm9pZCBkdXBsaWNhdGUgcmVxdWVzdHMgKi9cclxuICBwcml2YXRlIG1lZGlhTG9hZGluZyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xyXG4gIC8qKiBUcmFja3MgZmlsZSBJRHMgd2hlcmUgcmV0cmlldmFsIGZhaWxlZCBzbyBVSSBkb2Vzbid0IHNwaW4gZm9yZXZlci4gKi9cclxuICBwcml2YXRlIG1lZGlhRmFpbGVkID0gbmV3IFNldDxzdHJpbmc+KCk7XHJcbiAgcHJpdmF0ZSBtZWRpYVF1ZXVlOiBzdHJpbmdbXSA9IFtdO1xyXG4gIHByaXZhdGUgYWN0aXZlTWVkaWFSZXF1ZXN0cyA9IDA7XHJcbiAgcHJpdmF0ZSByZWFkb25seSBtYXhNZWRpYVJlcXVlc3RzID0gMjtcclxuICBwcml2YXRlIGxhc3RNZW50aW9uQ29udmVyc2F0aW9uSWQ6IHN0cmluZyB8IG51bGwgPSBudWxsO1xyXG4gIHByaXZhdGUgbGFzdEdyb3VwTWVtYmVyc2hpcFZlcnNpb24gPSAtMTtcclxuXHJcbiAgY29uc3RydWN0b3IoXHJcbiAgICBwcml2YXRlIHN0b3JlOiBNZXNzYWdpbmdTdG9yZVNlcnZpY2UsXHJcbiAgICBwcml2YXRlIGFwaTogTWVzc2FnaW5nQXBpU2VydmljZSxcclxuICAgIHByaXZhdGUgYXV0aDogQXV0aFNlcnZpY2UsXHJcbiAgICBwcml2YXRlIGZpbGVTZXJ2aWNlOiBNZXNzYWdpbmdGaWxlU2VydmljZSxcclxuICAgIHByaXZhdGUgY2RyOiBDaGFuZ2VEZXRlY3RvclJlZixcclxuICAgIHByaXZhdGUgc2FuaXRpemVyOiBEb21TYW5pdGl6ZXIsXHJcbiAgKSB7fVxyXG5cclxuICBuZ09uSW5pdCgpOiB2b2lkIHtcclxuICAgIHRoaXMubXlDb250YWN0SWQgPSB0aGlzLmF1dGguY29udGFjdElkO1xyXG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignZHJvcCcsIHRoaXMuYm91bmRSZXNldFRocmVhZERyYWcsIHRydWUpO1xyXG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignZHJhZ2VuZCcsIHRoaXMuYm91bmRSZXNldFRocmVhZERyYWcsIHRydWUpO1xyXG5cclxuICAgIHRoaXMuc3ViID0gY29tYmluZUxhdGVzdChbXHJcbiAgICAgIHRoaXMuc3RvcmUuYWN0aXZlQ29udmVyc2F0aW9uSWQsXHJcbiAgICAgIHRoaXMuc3RvcmUubWVzc2FnZXNNYXAsXHJcbiAgICAgIHRoaXMuc3RvcmUub3BlbkNoYXRzLFxyXG4gICAgICB0aGlzLnN0b3JlLnZpc2libGVDb250YWN0cyxcclxuICAgICAgdGhpcy5zdG9yZS5sb2FkaW5nTWVzc2FnZXMsXHJcbiAgICAgIHRoaXMuc3RvcmUucmVtb3ZlZEdyb3VwSWRzLFxyXG4gICAgICB0aGlzLnN0b3JlLm1lc3NhZ2VUZXh0U2NhbGUsXHJcbiAgICAgIHRoaXMuc3RvcmUuY29kZVRleHRTY2FsZSxcclxuICAgICAgdGhpcy5zdG9yZS5ncm91cE1lbWJlcnNoaXBWZXJzaW9uLFxyXG4gICAgXSkuc3Vic2NyaWJlKChbY29udklkLCBtc2dNYXAsIGNoYXRzLCBjb250YWN0cywgbG9hZGluZywgcmVtb3ZlZEdyb3VwSWRzLCBtZXNzYWdlVGV4dFNjYWxlLCBjb2RlVGV4dFNjYWxlLCBncm91cE1lbWJlcnNoaXBWZXJzaW9uXSkgPT4ge1xyXG4gICAgICB0aGlzLmxvYWRpbmcgPSBsb2FkaW5nO1xyXG4gICAgICB0aGlzLnZpc2libGVDb250YWN0cyA9IGNvbnRhY3RzIHx8IFtdO1xyXG4gICAgICB0aGlzLm1lc3NhZ2VUZXh0U2NhbGUgPSBtZXNzYWdlVGV4dFNjYWxlO1xyXG4gICAgICB0aGlzLmNvZGVUZXh0U2NhbGUgPSBjb2RlVGV4dFNjYWxlO1xyXG4gICAgICBpZiAodGhpcy5pc0dyb3VwICYmIHRoaXMuY29udmVyc2F0aW9uSWQgJiYgdGhpcy5tZW50aW9uT3B0aW9ucy5sZW5ndGggPT09IDApIHtcclxuICAgICAgICB0aGlzLnJlZnJlc2hNZW50aW9uT3B0aW9ucygpO1xyXG4gICAgICB9XHJcbiAgICAgIGlmIChcclxuICAgICAgICB0aGlzLmlzR3JvdXAgJiZcclxuICAgICAgICB0aGlzLmNvbnZlcnNhdGlvbklkICYmXHJcbiAgICAgICAgZ3JvdXBNZW1iZXJzaGlwVmVyc2lvbiAhPT0gdGhpcy5sYXN0R3JvdXBNZW1iZXJzaGlwVmVyc2lvblxyXG4gICAgICApIHtcclxuICAgICAgICB0aGlzLmxhc3RHcm91cE1lbWJlcnNoaXBWZXJzaW9uID0gZ3JvdXBNZW1iZXJzaGlwVmVyc2lvbjtcclxuICAgICAgICB0aGlzLnJlZnJlc2hNZW50aW9uT3B0aW9ucyh0cnVlKTtcclxuICAgICAgfVxyXG5cclxuICAgICAgaWYgKGNvbnZJZCAmJiBjb252SWQgIT09IHRoaXMuY29udmVyc2F0aW9uSWQpIHtcclxuICAgICAgICB0aGlzLmNvbnZlcnNhdGlvbklkID0gY29udklkO1xyXG4gICAgICAgIHRoaXMucmVzZXRNZWRpYVF1ZXVlKCk7XHJcbiAgICAgICAgdGhpcy5jbGVhclJlcGx5KCk7XHJcbiAgICAgICAgdGhpcy5jbGVhckVkaXQoKTtcclxuICAgICAgICB0aGlzLnNob3VsZFNjcm9sbFRvQm90dG9tID0gdHJ1ZTtcclxuICAgICAgICBjb25zdCBjaGF0ID0gY2hhdHMuZmluZCgoYykgPT4gYy5jb252ZXJzYXRpb25JZCA9PT0gY29udklkKTtcclxuICAgICAgICB0aGlzLmNvbnZlcnNhdGlvbk5hbWUgPSBjaGF0Py5uYW1lIHx8ICdDaGF0JztcclxuICAgICAgICB0aGlzLmlzR3JvdXAgPSBjaGF0Py5pc0dyb3VwIHx8IGZhbHNlO1xyXG4gICAgICAgIHRoaXMuaXNQcm9qZWN0ID0gY2hhdD8uaXNQcm9qZWN0IHx8IGZhbHNlO1xyXG4gICAgICAgIHRoaXMucmVmcmVzaE1lbnRpb25PcHRpb25zKHRydWUpO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBpZiAodGhpcy5jb252ZXJzYXRpb25JZCkge1xyXG4gICAgICAgIGNvbnN0IHByZXZMZW4gPSB0aGlzLm1lc3NhZ2VzLmxlbmd0aDtcclxuICAgICAgICB0aGlzLm1lc3NhZ2VzID0gbXNnTWFwLmdldCh0aGlzLmNvbnZlcnNhdGlvbklkKSB8fCBbXTtcclxuICAgICAgICBpZiAodGhpcy5tZXNzYWdlcy5sZW5ndGggPiBwcmV2TGVuKSB7XHJcbiAgICAgICAgICB0aGlzLnNob3VsZFNjcm9sbFRvQm90dG9tID0gdHJ1ZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgLy8gUHJlLXdhcm0gbWVkaWEgY2FjaGUgZm9yIGFueSBpbWFnZS9maWxlIG1lc3NhZ2VzIHZpc2libGVcclxuICAgICAgICB0aGlzLnByZXdhcm1NZWRpYSh0aGlzLm1lc3NhZ2VzKTtcclxuICAgICAgfVxyXG4gICAgICB0aGlzLmlzUmVtb3ZlZEZyb21Hcm91cCA9ICEhdGhpcy5jb252ZXJzYXRpb25JZCAmJiByZW1vdmVkR3JvdXBJZHMuaGFzKFN0cmluZyh0aGlzLmNvbnZlcnNhdGlvbklkKSk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIG5nQWZ0ZXJWaWV3Q2hlY2tlZCgpOiB2b2lkIHtcclxuICAgIGlmICh0aGlzLnNob3VsZFNjcm9sbFRvQm90dG9tKSB7XHJcbiAgICAgIHRoaXMuc2Nyb2xsVG9Cb3R0b20oKTtcclxuICAgICAgdGhpcy5zaG91bGRTY3JvbGxUb0JvdHRvbSA9IGZhbHNlO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgbmdPbkRlc3Ryb3koKTogdm9pZCB7XHJcbiAgICB0aGlzLnN1Yj8udW5zdWJzY3JpYmUoKTtcclxuICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2Ryb3AnLCB0aGlzLmJvdW5kUmVzZXRUaHJlYWREcmFnLCB0cnVlKTtcclxuICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2RyYWdlbmQnLCB0aGlzLmJvdW5kUmVzZXRUaHJlYWREcmFnLCB0cnVlKTtcclxuICB9XHJcblxyXG4gIGdvQmFjaygpOiB2b2lkIHtcclxuICAgIHRoaXMuc3RvcmUuc2V0VmlldygnaW5ib3gnKTtcclxuICB9XHJcblxyXG4gIG9uQ2xlYXJDb252ZXJzYXRpb24oKTogdm9pZCB7XHJcbiAgICBpZiAodGhpcy5jb252ZXJzYXRpb25JZCkge1xyXG4gICAgICB0aGlzLnN0b3JlLmNsZWFyQ29udmVyc2F0aW9uKHRoaXMuY29udmVyc2F0aW9uSWQpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgb25EZWxldGVDb252ZXJzYXRpb24oKTogdm9pZCB7XHJcbiAgICBpZiAodGhpcy5jb252ZXJzYXRpb25JZCkge1xyXG4gICAgICB0aGlzLnN0b3JlLmRlbGV0ZUNvbnZlcnNhdGlvbih0aGlzLmNvbnZlcnNhdGlvbklkKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIG9uR3JvdXBTZXR0aW5ncygpOiB2b2lkIHtcclxuICAgIGlmICh0aGlzLmlzUmVtb3ZlZEZyb21Hcm91cCkgcmV0dXJuO1xyXG4gICAgaWYgKHRoaXMuY29udmVyc2F0aW9uSWQpIHtcclxuICAgICAgdGhpcy5zdG9yZS5vcGVuR3JvdXBTZXR0aW5ncyh0aGlzLmNvbnZlcnNhdGlvbklkLCB0aGlzLmNvbnZlcnNhdGlvbk5hbWUsIHRoaXMuaXNQcm9qZWN0KTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHN0YXJ0UmVwbHkobWVzc2FnZTogTWVzc2FnZSwgZXZlbnQ/OiBFdmVudCk6IHZvaWQge1xyXG4gICAgZXZlbnQ/LnN0b3BQcm9wYWdhdGlvbigpO1xyXG4gICAgaWYgKHRoaXMuaXNEZWxldGVkTWVzc2FnZShtZXNzYWdlKSB8fCB0aGlzLmlzU3lzdGVtTWVzc2FnZShtZXNzYWdlKSkgcmV0dXJuO1xyXG4gICAgdGhpcy5jbGVhckVkaXQoKTtcclxuICAgIHRoaXMucmVwbHlUb01lc3NhZ2UgPSBtZXNzYWdlO1xyXG4gICAgdGhpcy5tZXNzYWdlSW5wdXQ/LmZvY3VzKCk7XHJcbiAgfVxyXG5cclxuICBvcGVuTWVzc2FnZUNvbnRleHRNZW51KG1lc3NhZ2U6IE1lc3NhZ2UsIGV2ZW50OiBNb3VzZUV2ZW50KTogdm9pZCB7XHJcbiAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XHJcbiAgICBpZiAodGhpcy5pc0RlbGV0ZWRNZXNzYWdlKG1lc3NhZ2UpIHx8IHRoaXMuaXNTeXN0ZW1NZXNzYWdlKG1lc3NhZ2UpKSByZXR1cm47XHJcblxyXG4gICAgY29uc3QgaGFzQWN0aW9ucyA9XHJcbiAgICAgIHRoaXMuY2FuUmVwbHlNZXNzYWdlKG1lc3NhZ2UpIHx8XHJcbiAgICAgIHRoaXMuY2FuRWRpdE1lc3NhZ2UobWVzc2FnZSkgfHxcclxuICAgICAgdGhpcy5jYW5EZWxldGVNZXNzYWdlKG1lc3NhZ2UpO1xyXG4gICAgaWYgKCFoYXNBY3Rpb25zKSByZXR1cm47XHJcblxyXG4gICAgdGhpcy5tZXNzYWdlQ29udGV4dE1lbnUgPSB7XHJcbiAgICAgIG1lc3NhZ2UsXHJcbiAgICAgIC4uLnRoaXMuZ2V0Q29udGV4dE1lbnVQb3NpdGlvbihldmVudCksXHJcbiAgICAgIGNvbmZpcm1EZWxldGU6IGZhbHNlLFxyXG4gICAgfTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgZ2V0Q29udGV4dE1lbnVQb3NpdGlvbihldmVudDogTW91c2VFdmVudCk6IHsgeDogbnVtYmVyOyB5OiBudW1iZXIgfSB7XHJcbiAgICBjb25zdCByZWN0ID0gdGhpcy50aHJlYWRSb290Py5uYXRpdmVFbGVtZW50Py5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcclxuICAgIGlmICghcmVjdCkge1xyXG4gICAgICByZXR1cm4ge1xyXG4gICAgICAgIHg6IE1hdGgubWluKGV2ZW50LmNsaWVudFgsIHdpbmRvdy5pbm5lcldpZHRoIC0gMjIwKSxcclxuICAgICAgICB5OiBNYXRoLm1pbihldmVudC5jbGllbnRZLCB3aW5kb3cuaW5uZXJIZWlnaHQgLSAxNjApLFxyXG4gICAgICB9O1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IG1lbnVXaWR0aCA9IDIxMDtcclxuICAgIGNvbnN0IG1lbnVIZWlnaHQgPSAxNzA7XHJcbiAgICBjb25zdCBwYWRkaW5nID0gODtcclxuICAgIGNvbnN0IHJhd1ggPSBldmVudC5jbGllbnRYIC0gcmVjdC5sZWZ0O1xyXG4gICAgY29uc3QgcmF3WSA9IGV2ZW50LmNsaWVudFkgLSByZWN0LnRvcDtcclxuICAgIHJldHVybiB7XHJcbiAgICAgIHg6IE1hdGgubWF4KHBhZGRpbmcsIE1hdGgubWluKHJhd1gsIHJlY3Qud2lkdGggLSBtZW51V2lkdGggLSBwYWRkaW5nKSksXHJcbiAgICAgIHk6IE1hdGgubWF4KHBhZGRpbmcsIE1hdGgubWluKHJhd1ksIHJlY3QuaGVpZ2h0IC0gbWVudUhlaWdodCAtIHBhZGRpbmcpKSxcclxuICAgIH07XHJcbiAgfVxyXG5cclxuICBjbG9zZU1lc3NhZ2VDb250ZXh0TWVudSgpOiB2b2lkIHtcclxuICAgIHRoaXMubWVzc2FnZUNvbnRleHRNZW51ID0gbnVsbDtcclxuICB9XHJcblxyXG4gIHJlcGx5RnJvbUNvbnRleHRNZW51KCk6IHZvaWQge1xyXG4gICAgY29uc3QgbWVzc2FnZSA9IHRoaXMubWVzc2FnZUNvbnRleHRNZW51Py5tZXNzYWdlO1xyXG4gICAgaWYgKCFtZXNzYWdlIHx8ICF0aGlzLmNhblJlcGx5TWVzc2FnZShtZXNzYWdlKSkgcmV0dXJuO1xyXG4gICAgdGhpcy5zdGFydFJlcGx5KG1lc3NhZ2UpO1xyXG4gICAgdGhpcy5jbG9zZU1lc3NhZ2VDb250ZXh0TWVudSgpO1xyXG4gIH1cclxuXHJcbiAgZWRpdEZyb21Db250ZXh0TWVudSgpOiB2b2lkIHtcclxuICAgIGNvbnN0IG1lc3NhZ2UgPSB0aGlzLm1lc3NhZ2VDb250ZXh0TWVudT8ubWVzc2FnZTtcclxuICAgIGlmICghbWVzc2FnZSB8fCAhdGhpcy5jYW5FZGl0TWVzc2FnZShtZXNzYWdlKSkgcmV0dXJuO1xyXG4gICAgdGhpcy5jbG9zZU1lc3NhZ2VDb250ZXh0TWVudSgpO1xyXG4gICAgdGhpcy5zdGFydEVkaXRNZXNzYWdlKG1lc3NhZ2UpO1xyXG4gIH1cclxuXHJcbiAgcmVxdWVzdERlbGV0ZUZyb21Db250ZXh0TWVudSgpOiB2b2lkIHtcclxuICAgIGlmICghdGhpcy5tZXNzYWdlQ29udGV4dE1lbnUgfHwgIXRoaXMuY2FuRGVsZXRlTWVzc2FnZSh0aGlzLm1lc3NhZ2VDb250ZXh0TWVudS5tZXNzYWdlKSkgcmV0dXJuO1xyXG4gICAgdGhpcy5tZXNzYWdlQ29udGV4dE1lbnUgPSB7IC4uLnRoaXMubWVzc2FnZUNvbnRleHRNZW51LCBjb25maXJtRGVsZXRlOiB0cnVlIH07XHJcbiAgfVxyXG5cclxuICBjb25maXJtRGVsZXRlRnJvbUNvbnRleHRNZW51KCk6IHZvaWQge1xyXG4gICAgY29uc3QgbWVzc2FnZSA9IHRoaXMubWVzc2FnZUNvbnRleHRNZW51Py5tZXNzYWdlO1xyXG4gICAgaWYgKCFtZXNzYWdlIHx8ICF0aGlzLmNhbkRlbGV0ZU1lc3NhZ2UobWVzc2FnZSkpIHJldHVybjtcclxuICAgIHRoaXMuY2xvc2VNZXNzYWdlQ29udGV4dE1lbnUoKTtcclxuICAgIHRoaXMuc3RvcmUuZGVsZXRlTWVzc2FnZShtZXNzYWdlLm1lc3NhZ2VfaWQpO1xyXG4gIH1cclxuXHJcbiAgY2xlYXJSZXBseSgpOiB2b2lkIHtcclxuICAgIHRoaXMucmVwbHlUb01lc3NhZ2UgPSBudWxsO1xyXG4gIH1cclxuXHJcbiAgY2xlYXJFZGl0KCk6IHZvaWQge1xyXG4gICAgdGhpcy5lZGl0aW5nTWVzc2FnZSA9IG51bGw7XHJcbiAgICB0aGlzLmVkaXRpbmdEcmFmdCA9ICcnO1xyXG4gIH1cclxuXHJcbiAgZ2V0UmVwbHlQcmV2aWV3KG1lc3NhZ2U6IE1lc3NhZ2UpOiBSZXBseVByZXZpZXcgfCBudWxsIHtcclxuICAgIGNvbnN0IHJlcGx5ID0gbWVzc2FnZS5yZXBseV90bztcclxuICAgIGlmICghcmVwbHkpIHJldHVybiBudWxsO1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgc2VuZGVyTmFtZTogcmVwbHkuc2VuZGVyX25hbWUgfHwgJ01lc3NhZ2UnLFxyXG4gICAgICBjb250ZW50OiB0aGlzLnRydW5jYXRlUmVwbHlUZXh0KHJlcGx5LmNvbnRlbnQgfHwgJ0F0dGFjaG1lbnQnKSxcclxuICAgIH07XHJcbiAgfVxyXG5cclxuICBnZXRDb21wb3NlUmVwbHlQcmV2aWV3KG1lc3NhZ2U6IE1lc3NhZ2UpOiBSZXBseVByZXZpZXcge1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgc2VuZGVyTmFtZTogdGhpcy5nZXRTZW5kZXJOYW1lKG1lc3NhZ2UpLFxyXG4gICAgICBjb250ZW50OiB0aGlzLnRydW5jYXRlUmVwbHlUZXh0KHRoaXMuZ2V0TWVzc2FnZUJvZHkobWVzc2FnZSkgfHwgdGhpcy5nZXRBdHRhY2htZW50TmFtZShtZXNzYWdlKSksXHJcbiAgICB9O1xyXG4gIH1cclxuXHJcbiAgZ2V0TWVzc2FnZUJvZHkobWVzc2FnZTogTWVzc2FnZSk6IHN0cmluZyB7XHJcbiAgICBpZiAodGhpcy5pc0RlbGV0ZWRNZXNzYWdlKG1lc3NhZ2UpKSByZXR1cm4gJ1tUaGlzIG1lc3NhZ2Ugd2FzIGRlbGV0ZWRdJztcclxuICAgIHJldHVybiBTdHJpbmcobWVzc2FnZS5jb250ZW50IHx8ICcnKTtcclxuICB9XHJcblxyXG4gIGlzRGVsZXRlZE1lc3NhZ2UobWVzc2FnZTogTWVzc2FnZSk6IGJvb2xlYW4ge1xyXG4gICAgcmV0dXJuIEJvb2xlYW4obWVzc2FnZS5pc19kZWxldGVkIHx8IG1lc3NhZ2UuZGVsZXRlZF9hdCB8fCBtZXNzYWdlLmNvbnRlbnQgPT09ICdbZGVsZXRlZF0nKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgdHJ1bmNhdGVSZXBseVRleHQodmFsdWU6IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgICBjb25zdCB0ZXh0ID0gU3RyaW5nKHZhbHVlIHx8ICcnKS5yZXBsYWNlKC9cXHMrL2csICcgJykudHJpbSgpO1xyXG4gICAgcmV0dXJuIHRleHQubGVuZ3RoID4gMTIwID8gYCR7dGV4dC5zbGljZSgwLCAxMTcpfS4uLmAgOiB0ZXh0IHx8ICdBdHRhY2htZW50JztcclxuICB9XHJcblxyXG4gIHByaXZhdGUgcmVmcmVzaE1lbnRpb25PcHRpb25zKGZvcmNlID0gZmFsc2UpOiB2b2lkIHtcclxuICAgIGlmICghdGhpcy5pc0dyb3VwIHx8ICF0aGlzLmNvbnZlcnNhdGlvbklkKSB7XHJcbiAgICAgIHRoaXMubWVudGlvbk9wdGlvbnMgPSBbXTtcclxuICAgICAgdGhpcy5sYXN0TWVudGlvbkNvbnZlcnNhdGlvbklkID0gbnVsbDtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGNvbnZJZCA9IHRoaXMuY29udmVyc2F0aW9uSWQ7XHJcbiAgICBpZiAoIWZvcmNlICYmIHRoaXMubGFzdE1lbnRpb25Db252ZXJzYXRpb25JZCA9PT0gY29udklkICYmIHRoaXMubWVudGlvbk9wdGlvbnMubGVuZ3RoID4gMCkgcmV0dXJuO1xyXG4gICAgdGhpcy5sYXN0TWVudGlvbkNvbnZlcnNhdGlvbklkID0gY29udklkO1xyXG5cclxuICAgIHRoaXMuYXBpLmdldENvbnZlcnNhdGlvblBhcnRpY2lwYW50cyhjb252SWQpLnN1YnNjcmliZSh7XHJcbiAgICAgIG5leHQ6IChtZW1iZXJzKSA9PiB7XHJcbiAgICAgICAgY29uc3Qgb3B0aW9ucyA9IG1lbWJlcnNcclxuICAgICAgICAgIC5maWx0ZXIoKG1lbWJlcikgPT4gU3RyaW5nKG1lbWJlci5jb250YWN0X2lkKSAhPT0gU3RyaW5nKHRoaXMuYXV0aC5jb250YWN0SWQgfHwgJycpKVxyXG4gICAgICAgICAgLm1hcCgobWVtYmVyKSA9PiB0aGlzLnBhcnRpY2lwYW50VG9NZW50aW9uT3B0aW9uKG1lbWJlcikpXHJcbiAgICAgICAgICAuZmlsdGVyKChvcHRpb24pOiBvcHRpb24gaXMgTWVudGlvbk9wdGlvbiA9PiAhIW9wdGlvbik7XHJcbiAgICAgICAgdGhpcy5tZW50aW9uT3B0aW9ucyA9IG9wdGlvbnMubGVuZ3RoID8gb3B0aW9ucyA6IHRoaXMuY29udGFjdHNUb01lbnRpb25PcHRpb25zKCk7XHJcbiAgICAgICAgdGhpcy5jZHIubWFya0ZvckNoZWNrKCk7XHJcbiAgICAgIH0sXHJcbiAgICAgIGVycm9yOiAoKSA9PiB7XHJcbiAgICAgICAgdGhpcy5tZW50aW9uT3B0aW9ucyA9IHRoaXMuY29udGFjdHNUb01lbnRpb25PcHRpb25zKCk7XHJcbiAgICAgICAgdGhpcy5jZHIubWFya0ZvckNoZWNrKCk7XHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgcGFydGljaXBhbnRUb01lbnRpb25PcHRpb24obWVtYmVyOiBDb252ZXJzYXRpb25QYXJ0aWNpcGFudCk6IE1lbnRpb25PcHRpb24gfCBudWxsIHtcclxuICAgIGNvbnN0IHRva2VuID0gdGhpcy50b01lbnRpb25Ub2tlbihtZW1iZXIudXNlcm5hbWUgfHwgbWVtYmVyLmVtYWlsIHx8IFN0cmluZyhtZW1iZXIuY29udGFjdF9pZCkpO1xyXG4gICAgaWYgKCF0b2tlbikgcmV0dXJuIG51bGw7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICBjb250YWN0SWQ6IFN0cmluZyhtZW1iZXIuY29udGFjdF9pZCksXHJcbiAgICAgIGxhYmVsOiBtZW1iZXIudXNlcm5hbWUgfHwgbWVtYmVyLmVtYWlsIHx8IGBDb250YWN0ICR7bWVtYmVyLmNvbnRhY3RfaWR9YCxcclxuICAgICAgdG9rZW4sXHJcbiAgICB9O1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBjb250YWN0c1RvTWVudGlvbk9wdGlvbnMoKTogTWVudGlvbk9wdGlvbltdIHtcclxuICAgIHJldHVybiB0aGlzLnZpc2libGVDb250YWN0c1xyXG4gICAgICAuZmlsdGVyKChjb250YWN0KSA9PiBTdHJpbmcoY29udGFjdC5jb250YWN0X2lkKSAhPT0gU3RyaW5nKHRoaXMuYXV0aC5jb250YWN0SWQgfHwgJycpKVxyXG4gICAgICAubWFwKChjb250YWN0KSA9PiB7XHJcbiAgICAgICAgY29uc3QgbGFiZWwgPSBnZXRDb250YWN0RGlzcGxheU5hbWUoY29udGFjdCk7XHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgIGNvbnRhY3RJZDogU3RyaW5nKGNvbnRhY3QuY29udGFjdF9pZCksXHJcbiAgICAgICAgICBsYWJlbCxcclxuICAgICAgICAgIHRva2VuOiB0aGlzLnRvTWVudGlvblRva2VuKGNvbnRhY3QudXNlcm5hbWUgfHwgY29udGFjdC5lbWFpbD8uc3BsaXQoJ0AnKVswXSB8fCBsYWJlbCksXHJcbiAgICAgICAgfTtcclxuICAgICAgfSlcclxuICAgICAgLmZpbHRlcigob3B0aW9uKSA9PiAhIW9wdGlvbi50b2tlbik7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHRvTWVudGlvblRva2VuKHZhbHVlOiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gICAgcmV0dXJuIFN0cmluZyh2YWx1ZSB8fCAnJylcclxuICAgICAgLnRyaW0oKVxyXG4gICAgICAucmVwbGFjZSgvXkAvLCAnJylcclxuICAgICAgLnJlcGxhY2UoL0AuKiQvLCAnJylcclxuICAgICAgLnJlcGxhY2UoL1teYS16QS1aMC05Ll8tXS9nLCAnJylcclxuICAgICAgLnNsaWNlKDAsIDMyKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgZ2V0TWVudGlvbklkc0Zyb21Db250ZW50KGNvbnRlbnQ6IHN0cmluZyk6IHN0cmluZ1tdIHtcclxuICAgIGlmICghdGhpcy5pc0dyb3VwIHx8ICFjb250ZW50IHx8ICF0aGlzLm1lbnRpb25PcHRpb25zLmxlbmd0aCkgcmV0dXJuIFtdO1xyXG4gICAgY29uc3QgbWVudGlvbmVkVG9rZW5zID0gbmV3IFNldChcclxuICAgICAgQXJyYXkuZnJvbShjb250ZW50Lm1hdGNoQWxsKC8oXnxbXmEtekEtWjAtOS5fLV0pQChbYS16QS1aMC05Ll8tXSspL2cpKVxyXG4gICAgICAgIC5tYXAoKG1hdGNoKSA9PiBtYXRjaFsyXS50b0xvd2VyQ2FzZSgpKVxyXG4gICAgKTtcclxuICAgIHJldHVybiB0aGlzLm1lbnRpb25PcHRpb25zXHJcbiAgICAgIC5maWx0ZXIoKG9wdGlvbikgPT4gbWVudGlvbmVkVG9rZW5zLmhhcyhvcHRpb24udG9rZW4udG9Mb3dlckNhc2UoKSkpXHJcbiAgICAgIC5tYXAoKG9wdGlvbikgPT4gb3B0aW9uLmNvbnRhY3RJZCk7XHJcbiAgfVxyXG5cclxuICBvblNlbmRNZXNzYWdlKHBheWxvYWQ6IE1lc3NhZ2VUZXh0UGF5bG9hZCk6IHZvaWQge1xyXG4gICAgaWYgKHRoaXMuaXNSZW1vdmVkRnJvbUdyb3VwKSByZXR1cm47XHJcbiAgICBjb25zdCBjb250ZW50ID0gcGF5bG9hZC50ZXh0O1xyXG4gICAgY29uc3QgbWVudGlvbnMgPSB0aGlzLmdldE1lbnRpb25JZHNGcm9tQ29udGVudChjb250ZW50KTtcclxuICAgIHRoaXMuc3RvcmUuc2VuZE1lc3NhZ2UodGhpcy5jb252ZXJzYXRpb25JZCwgY29udGVudCwgJ1RFWFQnLCB7XHJcbiAgICAgIHJlcGx5VG86IHRoaXMucmVwbHlUb01lc3NhZ2UsXHJcbiAgICAgIG1lbnRpb25zLFxyXG4gICAgICBmb3JjZVBsYWluVGV4dDogcGF5bG9hZC5mb3JjZVBsYWluVGV4dCxcclxuICAgIH0pO1xyXG4gICAgdGhpcy5jbGVhclJlcGx5KCk7XHJcbiAgICB0aGlzLnNob3VsZFNjcm9sbFRvQm90dG9tID0gdHJ1ZTtcclxuICB9XHJcblxyXG4gIG9uU2VuZFdpdGhGaWxlcyhwYXlsb2FkOiBNZXNzYWdlUGF5bG9hZCk6IHZvaWQge1xyXG4gICAgaWYgKHRoaXMuaXNSZW1vdmVkRnJvbUdyb3VwKSByZXR1cm47XHJcbiAgICBpZiAoIXRoaXMuY29udmVyc2F0aW9uSWQgfHwgIXRoaXMuYXV0aC5jb250YWN0SWQpIHJldHVybjtcclxuICAgIHRoaXMudXBsb2FkaW5nID0gdHJ1ZTtcclxuXHJcbiAgICAvLyBTdGVwIDE6IFVwbG9hZCBhbGwgZmlsZXMgYW5kIG9idGFpbiByZWFsIGZpbGVfaWRzIGZyb20gdGhlIHNlcnZlci5cclxuICAgIC8vIFRlbXAgSURzIGFyZSBORVZFUiBzZW50IHRvIGFueSBBUEkg4oCUIHdlIHdhaXQgZm9yIHJlYWwgSURzIGhlcmUuXHJcbiAgICB0aGlzLmZpbGVTZXJ2aWNlLnVwbG9hZEZpbGVzKHBheWxvYWQuZmlsZXMpLnN1YnNjcmliZSh7XHJcbiAgICAgIG5leHQ6IChyZXNwb25zZXMpID0+IHtcclxuICAgICAgICBjb25zdCBmaWxlSWRzICAgPSByZXNwb25zZXMubWFwKChyKSA9PiByLmZpbGVfaWQpO1xyXG4gICAgICAgIGNvbnN0IGZpbGVuYW1lcyA9IHJlc3BvbnNlcy5tYXAoKHIpID0+IHIuZmlsZW5hbWUpO1xyXG4gICAgICAgIGNvbnN0IG1pbWVUeXBlcyA9IHJlc3BvbnNlcy5tYXAoKHIsIGlkeCkgPT4gci5taW1lX3R5cGUgfHwgcGF5bG9hZC5maWxlc1tpZHhdPy50eXBlIHx8ICcnKTtcclxuXHJcbiAgICAgICAgLy8gR3VhcmQ6IGVuc3VyZSBhbGwgSURzIGFyZSByZWFsIChub3QgdGVtcClcclxuICAgICAgICBjb25zdCBoYXNUZW1wID0gZmlsZUlkcy5zb21lKGlkID0+IGlkPy5zdGFydHNXaXRoKCd0ZW1wLScpKTtcclxuICAgICAgICBpZiAoaGFzVGVtcCkge1xyXG4gICAgICAgICAgdGhpcy51cGxvYWRpbmcgPSBmYWxzZTtcclxuICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIFN0ZXAgMjogUHJlLXdhcm0gaW1hZ2UgY2FjaGUgc28gdGhlIG9wdGltaXN0aWMgYnViYmxlIHJlbmRlcnMgaW1tZWRpYXRlbHkuXHJcbiAgICAgICAgdGhpcy5maWxlU2VydmljZS5wcmV3YXJtQ2FjaGUoZmlsZUlkcyk7XHJcblxyXG4gICAgICAgIC8vIFN0ZXAgMzogU2VuZCB0aGUgbWVzc2FnZSB3aXRoIHRoZSByZWFsIGZpbGVfaWRzLlxyXG4gICAgICAgIGNvbnN0IG1lc3NhZ2VUZXh0ID0gcGF5bG9hZC50ZXh0IHx8IGZpbGVuYW1lcy5qb2luKCcsICcpO1xyXG4gICAgICAgIGNvbnN0IG91dGdvaW5nVGV4dCA9IHRoaXMuc3RvcmUucHJlcGFyZU91dGdvaW5nTWVzc2FnZUNvbnRlbnQobWVzc2FnZVRleHQsIHRoaXMucmVwbHlUb01lc3NhZ2UsIHBheWxvYWQuZm9yY2VQbGFpblRleHQpO1xyXG4gICAgICAgIGNvbnN0IHJlcGx5VG8gPSB0aGlzLnJlcGx5VG9NZXNzYWdlID8ge1xyXG4gICAgICAgICAgbWVzc2FnZV9pZDogU3RyaW5nKHRoaXMucmVwbHlUb01lc3NhZ2UubWVzc2FnZV9pZCB8fCAnJyksXHJcbiAgICAgICAgICBzZW5kZXJfbmFtZTogdGhpcy5nZXRTZW5kZXJOYW1lKHRoaXMucmVwbHlUb01lc3NhZ2UpLFxyXG4gICAgICAgICAgY29udGVudDogdGhpcy50cnVuY2F0ZVJlcGx5VGV4dCh0aGlzLmdldE1lc3NhZ2VCb2R5KHRoaXMucmVwbHlUb01lc3NhZ2UpIHx8IHRoaXMuZ2V0QXR0YWNobWVudE5hbWUodGhpcy5yZXBseVRvTWVzc2FnZSkpLFxyXG4gICAgICAgIH0gOiB1bmRlZmluZWQ7XHJcbiAgICAgICAgY29uc3QgbWVudGlvbnMgPSB0aGlzLmdldE1lbnRpb25JZHNGcm9tQ29udGVudChtZXNzYWdlVGV4dCk7XHJcbiAgICAgICAgdGhpcy5maWxlU2VydmljZVxyXG4gICAgICAgICAgLnNlbmRNZXNzYWdlV2l0aEF0dGFjaG1lbnRzKFxyXG4gICAgICAgICAgICB0aGlzLmNvbnZlcnNhdGlvbklkISxcclxuICAgICAgICAgICAgdGhpcy5hdXRoLmNvbnRhY3RJZCEsXHJcbiAgICAgICAgICAgIG91dGdvaW5nVGV4dCxcclxuICAgICAgICAgICAgZmlsZUlkcyxcclxuICAgICAgICAgICAgZmlsZW5hbWVzLFxyXG4gICAgICAgICAgICBtaW1lVHlwZXNcclxuICAgICAgICAgIClcclxuICAgICAgICAgIC5zdWJzY3JpYmUoe1xyXG4gICAgICAgICAgICBuZXh0OiAocmVzOiBhbnkpID0+IHtcclxuICAgICAgICAgICAgICB0aGlzLnVwbG9hZGluZyA9IGZhbHNlO1xyXG4gICAgICAgICAgICAgIHRoaXMuc2hvdWxkU2Nyb2xsVG9Cb3R0b20gPSB0cnVlO1xyXG5cclxuICAgICAgICAgICAgICAvLyBBZGQgb3B0aW1pc3RpYyBtZXNzYWdlIHNvIHRoZSBpbWFnZSBhcHBlYXJzIGluc3RhbnRseSDigJRcclxuICAgICAgICAgICAgICAvLyB0aGUgV2ViU29ja2V0IGV2ZW50IG1heSBhcnJpdmUgYSBtb21lbnQgbGF0ZXIgYW5kIGRlZHVwIGl0LlxyXG4gICAgICAgICAgICAgIGNvbnN0IGZpcnN0SWQgPSBmaWxlSWRzWzBdIHx8ICcnO1xyXG4gICAgICAgICAgICAgIGNvbnN0IGlzSW1nID1cclxuICAgICAgICAgICAgICAgIChtaW1lVHlwZXNbMF0gfHwgJycpLnN0YXJ0c1dpdGgoJ2ltYWdlLycpIHx8XHJcbiAgICAgICAgICAgICAgICAvXFwuKHBuZ3xqcGU/Z3xnaWZ8d2VicHxibXB8c3ZnfGhlaWN8aGVpZikkL2kudGVzdChmaWxlbmFtZXNbMF0gfHwgJycpO1xyXG4gICAgICAgICAgICAgIGNvbnN0IG9wdGltaXN0aWM6IGFueSA9IHtcclxuICAgICAgICAgICAgICAgIG1lc3NhZ2VfaWQ6IHJlcz8ubWVzc2FnZV9pZCA/IFN0cmluZyhyZXMubWVzc2FnZV9pZCkgOiAndGVtcC0nICsgRGF0ZS5ub3coKSxcclxuICAgICAgICAgICAgICAgIGNvbnZlcnNhdGlvbl9pZDogdGhpcy5jb252ZXJzYXRpb25JZCEsXHJcbiAgICAgICAgICAgICAgICBzZW5kZXJfaWQ6IHRoaXMuYXV0aC5jb250YWN0SWQhLFxyXG4gICAgICAgICAgICAgICAgc2VuZGVyX25hbWU6ICdZb3UnLFxyXG4gICAgICAgICAgICAgICAgbWVzc2FnZV90eXBlOiBpc0ltZyA/ICdJTUFHRScgOiAnRklMRScsXHJcbiAgICAgICAgICAgICAgICBjb250ZW50OiBtZXNzYWdlVGV4dCxcclxuICAgICAgICAgICAgICAgIHJlcGx5X3RvOiByZXBseVRvLFxyXG4gICAgICAgICAgICAgICAgbWVudGlvbnMsXHJcbiAgICAgICAgICAgICAgICByZW5kZXJfYXNfcGxhaW5fdGV4dDogcGF5bG9hZC5mb3JjZVBsYWluVGV4dCxcclxuICAgICAgICAgICAgICAgIG1lZGlhX3VybDogZmlyc3RJZCxcclxuICAgICAgICAgICAgICAgIGNyZWF0ZWRfYXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcclxuICAgICAgICAgICAgICAgIGlzX3JlYWQ6IGZhbHNlLFxyXG4gICAgICAgICAgICAgICAgYXR0YWNobWVudHM6IGZpbGVJZHMubWFwKChpZCwgaWR4KSA9PiAoe1xyXG4gICAgICAgICAgICAgICAgICBmaWxlX2lkOiBpZCxcclxuICAgICAgICAgICAgICAgICAgZmlsZW5hbWU6IGZpbGVuYW1lc1tpZHhdIHx8IGZpbGVuYW1lc1swXSB8fCBgQXR0YWNobWVudCAke2lkeCArIDF9YCxcclxuICAgICAgICAgICAgICAgICAgbWltZV90eXBlOiBtaW1lVHlwZXNbaWR4XSB8fCB1bmRlZmluZWQsXHJcbiAgICAgICAgICAgICAgICAgIHNpemVfYnl0ZXM6IHBheWxvYWQuZmlsZXNbaWR4XT8uc2l6ZSxcclxuICAgICAgICAgICAgICAgICAgdXJsOiByZXNwb25zZXNbaWR4XT8udXJsLFxyXG4gICAgICAgICAgICAgICAgfSkpLFxyXG4gICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgICAgdGhpcy5zdG9yZS5hcHBlbmRPcHRpbWlzdGljTWVzc2FnZShvcHRpbWlzdGljKTtcclxuICAgICAgICAgICAgICB0aGlzLmNsZWFyUmVwbHkoKTtcclxuICAgICAgICAgICAgICB0aGlzLmNkci5tYXJrRm9yQ2hlY2soKTtcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgZXJyb3I6ICgpID0+IHtcclxuICAgICAgICAgICAgICB0aGlzLnVwbG9hZGluZyA9IGZhbHNlO1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgfSk7XHJcbiAgICAgIH0sXHJcbiAgICAgIGVycm9yOiAoKSA9PiB7XHJcbiAgICAgICAgdGhpcy51cGxvYWRpbmcgPSBmYWxzZTtcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgbG9hZE9sZGVyKCk6IHZvaWQge1xyXG4gICAgaWYgKHRoaXMuY29udmVyc2F0aW9uSWQgJiYgdGhpcy5tZXNzYWdlcy5sZW5ndGggPiAwKSB7XHJcbiAgICAgIHRoaXMuc3RvcmUubG9hZE1lc3NhZ2VzKHRoaXMuY29udmVyc2F0aW9uSWQsIHRoaXMubWVzc2FnZXNbMF0ubWVzc2FnZV9pZCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBvblNjcm9sbCgpOiB2b2lkIHt9XHJcblxyXG4gIG9uVGhyZWFkRHJhZ0VudGVyKGV2ZW50OiBEcmFnRXZlbnQpOiB2b2lkIHtcclxuICAgIGlmICh0aGlzLmlzUmVtb3ZlZEZyb21Hcm91cCkgcmV0dXJuO1xyXG4gICAgaWYgKCF0aGlzLmRyYWdIYXNGaWxlcyhldmVudCkpIHJldHVybjtcclxuICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcclxuICAgIHRoaXMudGhyZWFkRHJhZ0RlcHRoKys7XHJcbiAgICB0aGlzLnRocmVhZERyYWdPdmVyID0gdHJ1ZTtcclxuICB9XHJcblxyXG4gIG9uVGhyZWFkRHJhZ092ZXIoZXZlbnQ6IERyYWdFdmVudCk6IHZvaWQge1xyXG4gICAgaWYgKHRoaXMuaXNSZW1vdmVkRnJvbUdyb3VwKSByZXR1cm47XHJcbiAgICBpZiAoIXRoaXMuZHJhZ0hhc0ZpbGVzKGV2ZW50KSkgcmV0dXJuO1xyXG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuICAgIGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xyXG4gICAgaWYgKGV2ZW50LmRhdGFUcmFuc2Zlcikge1xyXG4gICAgICBldmVudC5kYXRhVHJhbnNmZXIuZHJvcEVmZmVjdCA9ICdjb3B5JztcclxuICAgIH1cclxuICAgIHRoaXMudGhyZWFkRHJhZ092ZXIgPSB0cnVlO1xyXG4gIH1cclxuXHJcbiAgb25UaHJlYWREcmFnTGVhdmUoZXZlbnQ6IERyYWdFdmVudCk6IHZvaWQge1xyXG4gICAgaWYgKCF0aGlzLmRyYWdIYXNGaWxlcyhldmVudCkpIHJldHVybjtcclxuICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcclxuICAgIHRoaXMudGhyZWFkRHJhZ0RlcHRoID0gTWF0aC5tYXgoMCwgdGhpcy50aHJlYWREcmFnRGVwdGggLSAxKTtcclxuICAgIHRoaXMudGhyZWFkRHJhZ092ZXIgPSB0aGlzLnRocmVhZERyYWdEZXB0aCA+IDA7XHJcbiAgfVxyXG5cclxuICBvblRocmVhZERyb3AoZXZlbnQ6IERyYWdFdmVudCk6IHZvaWQge1xyXG4gICAgaWYgKHRoaXMuaXNSZW1vdmVkRnJvbUdyb3VwKSByZXR1cm47XHJcbiAgICBpZiAoIXRoaXMuZHJhZ0hhc0ZpbGVzKGV2ZW50KSkgcmV0dXJuO1xyXG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuICAgIGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xyXG4gICAgdGhpcy5yZXNldFRocmVhZERyYWcoKTtcclxuICAgIGNvbnN0IGZpbGVzID0gZXZlbnQuZGF0YVRyYW5zZmVyPy5maWxlcyA/IEFycmF5LmZyb20oZXZlbnQuZGF0YVRyYW5zZmVyLmZpbGVzKSA6IFtdO1xyXG4gICAgdGhpcy5tZXNzYWdlSW5wdXQ/LmFkZEZpbGVzKGZpbGVzKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgcmVzZXRUaHJlYWREcmFnKCk6IHZvaWQge1xyXG4gICAgdGhpcy50aHJlYWREcmFnRGVwdGggPSAwO1xyXG4gICAgdGhpcy50aHJlYWREcmFnT3ZlciA9IGZhbHNlO1xyXG4gIH1cclxuXHJcbiAgZXhpdFJlbW92ZWRHcm91cCgpOiB2b2lkIHtcclxuICAgIGlmICh0aGlzLmNvbnZlcnNhdGlvbklkKSB7XHJcbiAgICAgIHRoaXMuc3RvcmUuZXhpdFJlbW92ZWRHcm91cCh0aGlzLmNvbnZlcnNhdGlvbklkKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHByaXZhdGUgZHJhZ0hhc0ZpbGVzKGV2ZW50OiBEcmFnRXZlbnQpOiBib29sZWFuIHtcclxuICAgIGNvbnN0IHR5cGVzID0gZXZlbnQuZGF0YVRyYW5zZmVyPy50eXBlcztcclxuICAgIGlmICghdHlwZXMpIHJldHVybiBmYWxzZTtcclxuICAgIHJldHVybiBBcnJheS5mcm9tKHR5cGVzKS5pbmNsdWRlcygnRmlsZXMnKTtcclxuICB9XHJcblxyXG4gIHNob3VsZFNob3dEYXRlU2VwYXJhdG9yKGluZGV4OiBudW1iZXIpOiBib29sZWFuIHtcclxuICAgIGlmIChpbmRleCA9PT0gMCkgcmV0dXJuIHRydWU7XHJcbiAgICBjb25zdCBjdXJyID0gbmV3IERhdGUodGhpcy5tZXNzYWdlc1tpbmRleF0uY3JlYXRlZF9hdCkudG9EYXRlU3RyaW5nKCk7XHJcbiAgICBjb25zdCBwcmV2ID0gbmV3IERhdGUodGhpcy5tZXNzYWdlc1tpbmRleCAtIDFdLmNyZWF0ZWRfYXQpLnRvRGF0ZVN0cmluZygpO1xyXG4gICAgcmV0dXJuIGN1cnIgIT09IHByZXY7XHJcbiAgfVxyXG5cclxuICBzaG91bGRTaG93U2VuZGVyKGluZGV4OiBudW1iZXIpOiBib29sZWFuIHtcclxuICAgIGlmIChpbmRleCA9PT0gMCkgcmV0dXJuIHRydWU7XHJcbiAgICByZXR1cm4gdGhpcy5tZXNzYWdlc1tpbmRleF0uc2VuZGVyX2lkICE9PSB0aGlzLm1lc3NhZ2VzW2luZGV4IC0gMV0uc2VuZGVyX2lkO1xyXG4gIH1cclxuXHJcbiAgaXNPd25NZXNzYWdlKG1zZzogTWVzc2FnZSk6IGJvb2xlYW4ge1xyXG4gICAgY29uc3QgY3VycmVudENvbnRhY3RJZCA9IHRoaXMuYXV0aC5jb250YWN0SWQgfHwgdGhpcy5teUNvbnRhY3RJZDtcclxuICAgIGlmIChjdXJyZW50Q29udGFjdElkICYmIFN0cmluZyhtc2cuc2VuZGVyX2lkKSA9PT0gU3RyaW5nKGN1cnJlbnRDb250YWN0SWQpKSByZXR1cm4gdHJ1ZTtcclxuICAgIGlmIChTdHJpbmcobXNnLnNlbmRlcl9uYW1lIHx8ICcnKS50cmltKCkudG9Mb3dlckNhc2UoKSA9PT0gJ3lvdScpIHJldHVybiB0cnVlO1xyXG5cclxuICAgIGNvbnN0IGN1cnJlbnQgPSB0aGlzLmF1dGguY3VycmVudENvbnRhY3Q7XHJcbiAgICBjb25zdCBzZW5kZXJVc2VybmFtZSA9IFN0cmluZyhtc2cuc2VuZGVyX3VzZXJuYW1lIHx8ICcnKS50cmltKCkudG9Mb3dlckNhc2UoKTtcclxuICAgIGNvbnN0IGN1cnJlbnRVc2VybmFtZSA9IFN0cmluZyhjdXJyZW50Py51c2VybmFtZSB8fCAnJykudHJpbSgpLnRvTG93ZXJDYXNlKCk7XHJcbiAgICBpZiAoc2VuZGVyVXNlcm5hbWUgJiYgY3VycmVudFVzZXJuYW1lICYmIHNlbmRlclVzZXJuYW1lID09PSBjdXJyZW50VXNlcm5hbWUpIHJldHVybiB0cnVlO1xyXG5cclxuICAgIGNvbnN0IHNlbmRlck5hbWUgPSBnZXRNZXNzYWdlU2VuZGVyTmFtZShtc2cpLnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xyXG4gICAgY29uc3QgY3VycmVudE5hbWUgPSBjdXJyZW50ID8gZ2V0Q29udGFjdERpc3BsYXlOYW1lKGN1cnJlbnQpLnRyaW0oKS50b0xvd2VyQ2FzZSgpIDogJyc7XHJcbiAgICByZXR1cm4gISFzZW5kZXJOYW1lICYmICEhY3VycmVudE5hbWUgJiYgc2VuZGVyTmFtZSA9PT0gY3VycmVudE5hbWU7XHJcbiAgfVxyXG5cclxuICBjYW5FZGl0TWVzc2FnZShtc2c6IE1lc3NhZ2UpOiBib29sZWFuIHtcclxuICAgIHJldHVybiAoXHJcbiAgICAgIHRoaXMuaXNPd25NZXNzYWdlKG1zZykgJiZcclxuICAgICAgIXRoaXMuaXNEZWxldGVkTWVzc2FnZShtc2cpICYmXHJcbiAgICAgIFN0cmluZyhtc2cubWVzc2FnZV90eXBlIHx8ICcnKS50b1VwcGVyQ2FzZSgpID09PSAnVEVYVCcgJiZcclxuICAgICAgIVN0cmluZyhtc2cubWVzc2FnZV9pZCB8fCAnJykuc3RhcnRzV2l0aCgndGVtcC0nKVxyXG4gICAgKTtcclxuICB9XHJcblxyXG4gIGNhbkRlbGV0ZU1lc3NhZ2UobXNnOiBNZXNzYWdlKTogYm9vbGVhbiB7XHJcbiAgICByZXR1cm4gKFxyXG4gICAgICB0aGlzLmlzT3duTWVzc2FnZShtc2cpICYmXHJcbiAgICAgICF0aGlzLmlzRGVsZXRlZE1lc3NhZ2UobXNnKVxyXG4gICAgKTtcclxuICB9XHJcblxyXG4gIGNhbk1hbmFnZU1lc3NhZ2UobXNnOiBNZXNzYWdlKTogYm9vbGVhbiB7XHJcbiAgICByZXR1cm4gdGhpcy5jYW5FZGl0TWVzc2FnZShtc2cpIHx8IHRoaXMuY2FuRGVsZXRlTWVzc2FnZShtc2cpO1xyXG4gIH1cclxuXHJcbiAgY2FuUmVwbHlNZXNzYWdlKG1zZzogTWVzc2FnZSk6IGJvb2xlYW4ge1xyXG4gICAgcmV0dXJuICF0aGlzLmlzRGVsZXRlZE1lc3NhZ2UobXNnKSAmJiAhdGhpcy5pc1N5c3RlbU1lc3NhZ2UobXNnKTtcclxuICB9XHJcblxyXG4gIGlzRWRpdGluZ01lc3NhZ2UobXNnOiBNZXNzYWdlKTogYm9vbGVhbiB7XHJcbiAgICByZXR1cm4gISF0aGlzLmVkaXRpbmdNZXNzYWdlICYmIFN0cmluZyh0aGlzLmVkaXRpbmdNZXNzYWdlLm1lc3NhZ2VfaWQpID09PSBTdHJpbmcobXNnLm1lc3NhZ2VfaWQpO1xyXG4gIH1cclxuXHJcbiAgb25JbmxpbmVFZGl0SW5wdXQoZXZlbnQ6IEV2ZW50KTogdm9pZCB7XHJcbiAgICB0aGlzLmVkaXRpbmdEcmFmdCA9IChldmVudC50YXJnZXQgYXMgSFRNTFRleHRBcmVhRWxlbWVudCkudmFsdWU7XHJcbiAgfVxyXG5cclxuICBvbklubGluZUVkaXRLZXlkb3duKGV2ZW50OiBLZXlib2FyZEV2ZW50KTogdm9pZCB7XHJcbiAgICBpZiAoZXZlbnQua2V5ID09PSAnRXNjYXBlJykge1xyXG4gICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICB0aGlzLmNsZWFyRWRpdCgpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKChldmVudC5jdHJsS2V5IHx8IGV2ZW50Lm1ldGFLZXkpICYmIGV2ZW50LmtleSA9PT0gJ0VudGVyJykge1xyXG4gICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICB0aGlzLnNhdmVJbmxpbmVFZGl0KGV2ZW50KTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIGNhblNhdmVJbmxpbmVFZGl0KCk6IGJvb2xlYW4ge1xyXG4gICAgY29uc3QgbWVzc2FnZSA9IHRoaXMuZWRpdGluZ01lc3NhZ2U7XHJcbiAgICBpZiAoIW1lc3NhZ2UgfHwgIXRoaXMuY2FuRWRpdE1lc3NhZ2UobWVzc2FnZSkpIHJldHVybiBmYWxzZTtcclxuICAgIGNvbnN0IG5leHQgPSB0aGlzLmVkaXRpbmdEcmFmdC50cmltKCk7XHJcbiAgICByZXR1cm4gISFuZXh0ICYmIG5leHQgIT09IHRoaXMuZ2V0TWVzc2FnZUJvZHkobWVzc2FnZSkudHJpbSgpO1xyXG4gIH1cclxuXHJcbiAgc2F2ZUlubGluZUVkaXQoZXZlbnQ/OiBFdmVudCk6IHZvaWQge1xyXG4gICAgZXZlbnQ/LnN0b3BQcm9wYWdhdGlvbigpO1xyXG4gICAgY29uc3QgbWVzc2FnZSA9IHRoaXMuZWRpdGluZ01lc3NhZ2U7XHJcbiAgICBpZiAoIW1lc3NhZ2UgfHwgIXRoaXMuY2FuU2F2ZUlubGluZUVkaXQoKSkgcmV0dXJuO1xyXG4gICAgdGhpcy5zdG9yZS5lZGl0TWVzc2FnZShtZXNzYWdlLm1lc3NhZ2VfaWQsIHRoaXMuZWRpdGluZ0RyYWZ0LnRyaW0oKSk7XHJcbiAgICB0aGlzLmNsZWFyRWRpdCgpO1xyXG4gIH1cclxuXHJcbiAgY2FuY2VsSW5saW5lRWRpdChldmVudD86IEV2ZW50KTogdm9pZCB7XHJcbiAgICBldmVudD8uc3RvcFByb3BhZ2F0aW9uKCk7XHJcbiAgICB0aGlzLmNsZWFyRWRpdCgpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBzdGFydEVkaXRNZXNzYWdlKG1zZzogTWVzc2FnZSk6IHZvaWQge1xyXG4gICAgaWYgKCF0aGlzLmNhbkVkaXRNZXNzYWdlKG1zZykpIHJldHVybjtcclxuICAgIHRoaXMuY2xlYXJSZXBseSgpO1xyXG4gICAgdGhpcy5lZGl0aW5nTWVzc2FnZSA9IG1zZztcclxuICAgIHRoaXMuZWRpdGluZ0RyYWZ0ID0gdGhpcy5nZXRNZXNzYWdlQm9keShtc2cpO1xyXG4gICAgc2V0VGltZW91dCgoKSA9PiB7XHJcbiAgICAgIGNvbnN0IHRleHRhcmVhID0gdGhpcy5pbmxpbmVFZGl0VGV4dGFyZWFzPy5maXJzdD8ubmF0aXZlRWxlbWVudDtcclxuICAgICAgdGV4dGFyZWE/LmZvY3VzKCk7XHJcbiAgICAgIHRleHRhcmVhPy5zZWxlY3QoKTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgaXNTeXN0ZW1NZXNzYWdlKG1zZzogTWVzc2FnZSk6IGJvb2xlYW4ge1xyXG4gICAgY29uc3QgY29udGVudCA9IFN0cmluZyhtc2cuY29udGVudCB8fCAnJykudHJpbSgpO1xyXG4gICAgcmV0dXJuIG1zZy5tZXNzYWdlX3R5cGUgPT09ICdTWVNURU0nIHx8XHJcbiAgICAgIC9eLisgYWRkZWQgLisgdG8gdGhlIGdyb3VwJC8udGVzdChjb250ZW50KSB8fFxyXG4gICAgICAvXi4rIHJlbW92ZWQgLisgZnJvbSB0aGUgZ3JvdXAkLy50ZXN0KGNvbnRlbnQpO1xyXG4gIH1cclxuXHJcbiAgaXNQcmVmb3JtYXR0ZWRUZXh0KG1zZzogTWVzc2FnZSk6IGJvb2xlYW4ge1xyXG4gICAgcmV0dXJuIHRoaXMuaXNQcmVmb3JtYXR0ZWRDb250ZW50KHRoaXMuZ2V0TWVzc2FnZUJvZHkobXNnKSk7XHJcbiAgfVxyXG5cclxuICBpc1ByZWZvcm1hdHRlZENvbnRlbnQoY29udGVudDogc3RyaW5nKTogYm9vbGVhbiB7XHJcbiAgICByZXR1cm4gY29udGVudC5pbmNsdWRlcygnXFx0JykgfHwgY29udGVudC5pbmNsdWRlcygnXFxuJykgfHwgLyB7Mix9Ly50ZXN0KGNvbnRlbnQpO1xyXG4gIH1cclxuXHJcbiAgZ2V0TWVzc2FnZUNhcHRpb24obXNnOiBNZXNzYWdlKTogc3RyaW5nIHtcclxuICAgIGNvbnN0IGNvbnRlbnQgPSB0aGlzLmdldE1lc3NhZ2VCb2R5KG1zZykudHJpbSgpO1xyXG4gICAgaWYgKCFjb250ZW50KSByZXR1cm4gJyc7XHJcblxyXG4gICAgY29uc3QgYXR0YWNobWVudE5hbWVzID0gdGhpcy5nZXRSZW5kZXJhYmxlQXR0YWNobWVudHMobXNnKVxyXG4gICAgICAubWFwKChhdHRhY2htZW50KSA9PiBTdHJpbmcoYXR0YWNobWVudC5maWxlbmFtZSB8fCAnJykudHJpbSgpKVxyXG4gICAgICAuZmlsdGVyKEJvb2xlYW4pO1xyXG4gICAgaWYgKCFhdHRhY2htZW50TmFtZXMubGVuZ3RoKSByZXR1cm4gY29udGVudDtcclxuXHJcbiAgICBjb25zdCBuYW1lc1RleHQgPSBhdHRhY2htZW50TmFtZXMuam9pbignLCAnKTtcclxuICAgIGlmIChjb250ZW50ID09PSBuYW1lc1RleHQgfHwgYXR0YWNobWVudE5hbWVzLmluY2x1ZGVzKGNvbnRlbnQpKSByZXR1cm4gJyc7XHJcbiAgICByZXR1cm4gY29udGVudDtcclxuICB9XHJcblxyXG4gIGlzQ29kZVRleHQobXNnOiBNZXNzYWdlKTogYm9vbGVhbiB7XHJcbiAgICByZXR1cm4gdGhpcy5pc0NvZGVDb250ZW50KHRoaXMuZ2V0TWVzc2FnZUJvZHkobXNnKSwgbXNnKTtcclxuICB9XHJcblxyXG4gIGlzQ29kZUNvbnRlbnQodmFsdWU6IHN0cmluZywgbXNnPzogTWVzc2FnZSk6IGJvb2xlYW4ge1xyXG4gICAgY29uc3QgY29udGVudCA9IHZhbHVlLnRyaW0oKTtcclxuICAgIGlmIChtc2c/LnJlbmRlcl9hc19wbGFpbl90ZXh0KSByZXR1cm4gZmFsc2U7XHJcbiAgICBpZiAoIWNvbnRlbnQgfHwgKG1zZyA/IHRoaXMuaXNUYWJsZVRleHQobXNnKSA6IHRoaXMuaXNUYWJsZUNvbnRlbnQoY29udGVudCkpKSByZXR1cm4gZmFsc2U7XHJcbiAgICBpZiAodGhpcy5sb29rc0xpa2VNYXJrZG93bihjb250ZW50KSAmJiAhdGhpcy5pc1NpbmdsZUZlbmNlZENvZGVCbG9jayhjb250ZW50KSkgcmV0dXJuIGZhbHNlO1xyXG4gICAgaWYgKC9eYGBgW1xcc1xcU10qYGBgJC8udGVzdChjb250ZW50KSkgcmV0dXJuIHRydWU7XHJcbiAgICByZXR1cm4gdGhpcy5kZXRlY3RDb2RlTGFuZ3VhZ2UoY29udGVudCkgIT09IG51bGw7XHJcbiAgfVxyXG5cclxuICBpc01hcmtkb3duVGV4dChtc2c6IE1lc3NhZ2UpOiBib29sZWFuIHtcclxuICAgIHJldHVybiB0aGlzLmlzTWFya2Rvd25Db250ZW50KHRoaXMuZ2V0TWVzc2FnZUJvZHkobXNnKSwgbXNnKTtcclxuICB9XHJcblxyXG4gIGlzTWFya2Rvd25Db250ZW50KHZhbHVlOiBzdHJpbmcsIG1zZz86IE1lc3NhZ2UpOiBib29sZWFuIHtcclxuICAgIGNvbnN0IGNvbnRlbnQgPSB2YWx1ZS50cmltKCk7XHJcbiAgICBpZiAoIWNvbnRlbnQgfHwgKG1zZyA/IHRoaXMuaXNUYWJsZVRleHQobXNnKSA6IHRoaXMuaXNUYWJsZUNvbnRlbnQoY29udGVudCkpIHx8IHRoaXMuaXNTaW5nbGVGZW5jZWRDb2RlQmxvY2soY29udGVudCkpIHJldHVybiBmYWxzZTtcclxuICAgIHJldHVybiB0aGlzLmxvb2tzTGlrZU1hcmtkb3duKGNvbnRlbnQpO1xyXG4gIH1cclxuXHJcbiAgZ2V0Q29kZUxhbmd1YWdlKG1zZzogTWVzc2FnZSk6IHN0cmluZyB7XHJcbiAgICByZXR1cm4gdGhpcy5nZXRDb2RlTGFuZ3VhZ2VDb250ZW50KHRoaXMuZ2V0TWVzc2FnZUJvZHkobXNnKSk7XHJcbiAgfVxyXG5cclxuICBnZXRDb2RlTGFuZ3VhZ2VDb250ZW50KGNvbnRlbnQ6IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgICBjb25zdCBwYXJzZWQgPSB0aGlzLnBhcnNlQ29kZUJsb2NrKGNvbnRlbnQpO1xyXG4gICAgcmV0dXJuIHBhcnNlZC5sYW5ndWFnZSB8fCB0aGlzLmRldGVjdENvZGVMYW5ndWFnZShwYXJzZWQuY29kZSkgfHwgJ2NvZGUnO1xyXG4gIH1cclxuXHJcbiAgZ2V0SGlnaGxpZ2h0ZWRDb2RlKG1zZzogTWVzc2FnZSk6IFNhZmVIdG1sIHtcclxuICAgIHJldHVybiB0aGlzLmdldEhpZ2hsaWdodGVkQ29kZUNvbnRlbnQodGhpcy5nZXRNZXNzYWdlQm9keShtc2cpKTtcclxuICB9XHJcblxyXG4gIGdldEhpZ2hsaWdodGVkQ29kZUNvbnRlbnQoY29udGVudDogc3RyaW5nKTogU2FmZUh0bWwge1xyXG4gICAgY29uc3QgcGFyc2VkID0gdGhpcy5wYXJzZUNvZGVCbG9jayhjb250ZW50KTtcclxuICAgIGNvbnN0IGxhbmd1YWdlID0gcGFyc2VkLmxhbmd1YWdlIHx8IHRoaXMuZGV0ZWN0Q29kZUxhbmd1YWdlKHBhcnNlZC5jb2RlKSB8fCAnY29kZSc7XHJcbiAgICBjb25zdCBlc2NhcGVkID0gdGhpcy5lc2NhcGVIdG1sKHBhcnNlZC5jb2RlKTtcclxuICAgIGNvbnN0IGhpZ2hsaWdodGVkID0gdGhpcy5oaWdobGlnaHRDb2RlKGVzY2FwZWQsIGxhbmd1YWdlKTtcclxuICAgIHJldHVybiB0aGlzLnNhbml0aXplci5ieXBhc3NTZWN1cml0eVRydXN0SHRtbChoaWdobGlnaHRlZCk7XHJcbiAgfVxyXG5cclxuICBnZXRNYXJrZG93bkh0bWwobXNnOiBNZXNzYWdlKTogU2FmZUh0bWwge1xyXG4gICAgcmV0dXJuIHRoaXMuZ2V0TWFya2Rvd25IdG1sQ29udGVudCh0aGlzLmdldE1lc3NhZ2VCb2R5KG1zZykpO1xyXG4gIH1cclxuXHJcbiAgZ2V0TWFya2Rvd25IdG1sQ29udGVudChjb250ZW50OiBzdHJpbmcpOiBTYWZlSHRtbCB7XHJcbiAgICByZXR1cm4gdGhpcy5zYW5pdGl6ZXIuYnlwYXNzU2VjdXJpdHlUcnVzdEh0bWwodGhpcy5yZW5kZXJNYXJrZG93bihjb250ZW50KSk7XHJcbiAgfVxyXG5cclxuICBjb3B5Q29kZShtc2c6IE1lc3NhZ2UsIGV2ZW50OiBNb3VzZUV2ZW50KTogdm9pZCB7XHJcbiAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcclxuICAgIGNvbnN0IGNvbnRlbnQgPSB0aGlzLmdldE1lc3NhZ2VCb2R5KG1zZyk7XHJcbiAgICBjb25zdCBwYXJzZWQgPSB0aGlzLnBhcnNlQ29kZUJsb2NrKGNvbnRlbnQpO1xyXG4gICAgdGhpcy5jb3B5VGV4dChwYXJzZWQuY29kZSB8fCBjb250ZW50KTtcclxuICB9XHJcblxyXG4gIGNvcHlNZXNzYWdlVGV4dChtc2c6IE1lc3NhZ2UsIGV2ZW50OiBNb3VzZUV2ZW50KTogdm9pZCB7XHJcbiAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcclxuICAgIHRoaXMuY29weVRleHQodGhpcy5nZXRNZXNzYWdlQm9keShtc2cpKTtcclxuICB9XHJcblxyXG4gIGNvcHlUZXh0VmFsdWUodGV4dDogc3RyaW5nLCBldmVudDogTW91c2VFdmVudCk6IHZvaWQge1xyXG4gICAgZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XHJcbiAgICB0aGlzLmNvcHlUZXh0KHRleHQpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBwYXJzZUNvZGVCbG9jayhjb250ZW50OiBzdHJpbmcpOiB7IGxhbmd1YWdlOiBzdHJpbmc7IGNvZGU6IHN0cmluZyB9IHtcclxuICAgIGNvbnN0IHRyaW1tZWQgPSBjb250ZW50LnRyaW0oKTtcclxuICAgIGNvbnN0IG1hdGNoID0gdHJpbW1lZC5tYXRjaCgvXmBgYChbYS16QS1aMC05XystXSopXFxzKlxcbj8oW1xcc1xcU10qPylgYGAkLyk7XHJcbiAgICBpZiAoIW1hdGNoKSByZXR1cm4geyBsYW5ndWFnZTogJycsIGNvZGU6IGNvbnRlbnQgfTtcclxuICAgIHJldHVybiB7IGxhbmd1YWdlOiAobWF0Y2hbMV0gfHwgJycpLnRvTG93ZXJDYXNlKCksIGNvZGU6IG1hdGNoWzJdIHx8ICcnIH07XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGlzU2luZ2xlRmVuY2VkQ29kZUJsb2NrKGNvbnRlbnQ6IHN0cmluZyk6IGJvb2xlYW4ge1xyXG4gICAgcmV0dXJuIC9eYGBgW2EtekEtWjAtOV8rLV0qXFxzKlxcbj9bXFxzXFxTXSo/YGBgJC8udGVzdChjb250ZW50LnRyaW0oKSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGxvb2tzTGlrZU1hcmtkb3duKGNvbnRlbnQ6IHN0cmluZyk6IGJvb2xlYW4ge1xyXG4gICAgcmV0dXJuIC8oXiN7MSw2fVxccyl8KF5bLSpdXFxzKXwoXlxcZCtcXC5cXHMpfChePlxccyl8KFxcKlxcKlteKl0rXFwqXFwqKXwoYFteYF0rYCl8KFxcW1teXFxdXStcXF1cXChbXildK1xcKSl8KF4tLS0kKXwoXi1cXHNcXFtbIHhdXFxdXFxzKXwoXmBgYFthLXpBLVowLTlfKy1dKlxccyokKS9tLnRlc3QoY29udGVudCk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGRldGVjdENvZGVMYW5ndWFnZShjb2RlOiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHtcclxuICAgIGNvbnN0IHRyaW1tZWQgPSBjb2RlLnRyaW0oKTtcclxuICAgIGlmICghdHJpbW1lZC5pbmNsdWRlcygnXFxuJykgJiYgdHJpbW1lZC5sZW5ndGggPCA0MCkgcmV0dXJuIG51bGw7XHJcbiAgICBpZiAoL15cXHMqKHNlbGVjdHx3aXRofGluc2VydHx1cGRhdGV8ZGVsZXRlfGNyZWF0ZXxhbHRlcnxkcm9wKVxcYi9pLnRlc3QodHJpbW1lZCkpIHJldHVybiAnc3FsJztcclxuICAgIGNvbnN0IGpzRGVjbGFyYXRpb24gPSAvXFxiKGZ1bmN0aW9ufGNvbnN0fGxldHx2YXIpXFxzK1tBLVphLXpfJF1bXFx3JF0qXFxzKig9fD0+fFxcKHw6KS8udGVzdCh0cmltbWVkKTtcclxuICAgIGNvbnN0IGpzU3ludGF4ID0gLyg9Pnxjb25zb2xlXFwubG9nfGltcG9ydFxccysuKmZyb218ZXhwb3J0XFxzK3xbe307XSkvLnRlc3QodHJpbW1lZCk7XHJcbiAgICBpZiAoanNEZWNsYXJhdGlvbiB8fCBqc1N5bnRheCkgcmV0dXJuICdqYXZhc2NyaXB0JztcclxuICAgIGlmICgvXFxiKGRlZnxpbXBvcnR8ZnJvbXxwcmludHxjbGFzcylcXGIvLnRlc3QodHJpbW1lZCkgJiYgLzpcXHMqJHxeXFxzezR9L20udGVzdCh0cmltbWVkKSkgcmV0dXJuICdweXRob24nO1xyXG4gICAgaWYgKC88XFwvP1thLXpdW1xcc1xcU10qPi9pLnRlc3QodHJpbW1lZCkpIHJldHVybiAnaHRtbCc7XHJcbiAgICBpZiAoL1t7fTtdLy50ZXN0KHRyaW1tZWQpICYmIC9bOj1dLy50ZXN0KHRyaW1tZWQpKSByZXR1cm4gJ2NvZGUnO1xyXG4gICAgcmV0dXJuIG51bGw7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGhpZ2hsaWdodENvZGUoZXNjYXBlZENvZGU6IHN0cmluZywgbGFuZ3VhZ2U6IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgICBjb25zdCBwcm90ZWN0ZWRUb2tlbnM6IHN0cmluZ1tdID0gW107XHJcbiAgICBjb25zdCBwcm90ZWN0ID0gKHZhbHVlOiBzdHJpbmcsIHJlZ2V4OiBSZWdFeHAsIGNsYXNzTmFtZTogc3RyaW5nKTogc3RyaW5nID0+XHJcbiAgICAgIHZhbHVlLnJlcGxhY2UocmVnZXgsIChtYXRjaCkgPT4ge1xyXG4gICAgICAgIGNvbnN0IHRva2VuID0gYF9fQ09ERV9UT0tFTl8ke3Byb3RlY3RlZFRva2Vucy5sZW5ndGh9X19gO1xyXG4gICAgICAgIHByb3RlY3RlZFRva2Vucy5wdXNoKGA8c3BhbiBjbGFzcz1cIiR7Y2xhc3NOYW1lfVwiPiR7bWF0Y2h9PC9zcGFuPmApO1xyXG4gICAgICAgIHJldHVybiB0b2tlbjtcclxuICAgICAgfSk7XHJcblxyXG4gICAgbGV0IGhpZ2hsaWdodGVkID0gZXNjYXBlZENvZGU7XHJcblxyXG4gICAgaWYgKGxhbmd1YWdlID09PSAnc3FsJykge1xyXG4gICAgICBoaWdobGlnaHRlZCA9IHByb3RlY3QoaGlnaGxpZ2h0ZWQsIC8oLS0uKikkL2dtLCAnY29kZS10b2tlbi1jb21tZW50Jyk7XHJcbiAgICAgIGhpZ2hsaWdodGVkID0gcHJvdGVjdChoaWdobGlnaHRlZCwgLygmcXVvdDsuKj8mcXVvdDt8JiMzOTsuKj8mIzM5O3xgLio/YCkvZywgJ2NvZGUtdG9rZW4tc3RyaW5nJyk7XHJcbiAgICAgIGhpZ2hsaWdodGVkID0gaGlnaGxpZ2h0ZWQucmVwbGFjZSgvXFxiKFNFTEVDVHxGUk9NfFdIRVJFfEpPSU58TEVGVHxSSUdIVHxJTk5FUnxPVVRFUnxPTnxHUk9VUCBCWXxPUkRFUiBCWXxJTlNFUlR8SU5UT3xWQUxVRVN8VVBEQVRFfFNFVHxERUxFVEV8Q1JFQVRFfFRBQkxFfEFMVEVSfERST1B8QU5EfE9SfE5VTEx8SVN8Tk9UfEFTfExJTUlUKVxcYi9naSwgJzxzcGFuIGNsYXNzPVwiY29kZS10b2tlbi1rZXl3b3JkXCI+JDE8L3NwYW4+Jyk7XHJcbiAgICAgIGhpZ2hsaWdodGVkID0gaGlnaGxpZ2h0ZWQucmVwbGFjZSgvXFxiKFxcZCsoPzpcXC5cXGQrKT8pXFxiL2csICc8c3BhbiBjbGFzcz1cImNvZGUtdG9rZW4tbnVtYmVyXCI+JDE8L3NwYW4+Jyk7XHJcbiAgICAgIHJldHVybiB0aGlzLnJlc3RvcmVDb2RlVG9rZW5zKGhpZ2hsaWdodGVkLCBwcm90ZWN0ZWRUb2tlbnMpO1xyXG4gICAgfVxyXG5cclxuICAgIGhpZ2hsaWdodGVkID0gcHJvdGVjdChoaWdobGlnaHRlZCwgLyhcXC9cXC8uKnwjLiopJC9nbSwgJ2NvZGUtdG9rZW4tY29tbWVudCcpO1xyXG4gICAgaGlnaGxpZ2h0ZWQgPSBwcm90ZWN0KGhpZ2hsaWdodGVkLCAvKCZxdW90Oy4qPyZxdW90O3wmIzM5Oy4qPyYjMzk7fGAuKj9gKS9nLCAnY29kZS10b2tlbi1zdHJpbmcnKTtcclxuICAgIGhpZ2hsaWdodGVkID0gaGlnaGxpZ2h0ZWQucmVwbGFjZSgvXFxiKGZ1bmN0aW9ufGNvbnN0fGxldHx2YXJ8cmV0dXJufGlmfGVsc2V8Zm9yfHdoaWxlfGNsYXNzfGltcG9ydHxmcm9tfGV4cG9ydHxhc3luY3xhd2FpdHxkZWZ8cHJpbnR8dHJ5fGNhdGNofG5ld3x0cnVlfGZhbHNlfG51bGx8Tm9uZSlcXGIvZywgJzxzcGFuIGNsYXNzPVwiY29kZS10b2tlbi1rZXl3b3JkXCI+JDE8L3NwYW4+Jyk7XHJcbiAgICBoaWdobGlnaHRlZCA9IGhpZ2hsaWdodGVkLnJlcGxhY2UoL1xcYihcXGQrKD86XFwuXFxkKyk/KVxcYi9nLCAnPHNwYW4gY2xhc3M9XCJjb2RlLXRva2VuLW51bWJlclwiPiQxPC9zcGFuPicpO1xyXG4gICAgaGlnaGxpZ2h0ZWQgPSBoaWdobGlnaHRlZC5yZXBsYWNlKC9cXGIoW2EtekEtWl8kXVtcXHckXSopKD89XFwoKS9nLCAnPHNwYW4gY2xhc3M9XCJjb2RlLXRva2VuLWZ1bmN0aW9uXCI+JDE8L3NwYW4+Jyk7XHJcbiAgICByZXR1cm4gdGhpcy5yZXN0b3JlQ29kZVRva2VucyhoaWdobGlnaHRlZCwgcHJvdGVjdGVkVG9rZW5zKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgcmVzdG9yZUNvZGVUb2tlbnModmFsdWU6IHN0cmluZywgcHJvdGVjdGVkVG9rZW5zOiBzdHJpbmdbXSk6IHN0cmluZyB7XHJcbiAgICByZXR1cm4gcHJvdGVjdGVkVG9rZW5zLnJlZHVjZShcclxuICAgICAgKGh0bWwsIHRva2VuLCBpbmRleCkgPT4gaHRtbC5yZXBsYWNlKG5ldyBSZWdFeHAoYF9fQ09ERV9UT0tFTl8ke2luZGV4fV9fYCwgJ2cnKSwgdG9rZW4pLFxyXG4gICAgICB2YWx1ZVxyXG4gICAgKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgcmVuZGVyTWFya2Rvd24ocmF3OiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gICAgY29uc3QgY29kZUJsb2Nrczogc3RyaW5nW10gPSBbXTtcclxuICAgIGNvbnN0IHdpdGhvdXRDb2RlID0gcmF3LnJlcGxhY2UoL2BgYChbYS16QS1aMC05XystXSopXFxzKlxcbj8oW1xcc1xcU10qPylgYGAvZywgKF9tYXRjaCwgbGFuZywgY29kZSkgPT4ge1xyXG4gICAgICBjb25zdCBsYW5ndWFnZSA9IFN0cmluZyhsYW5nIHx8ICdjb2RlJykudG9Mb3dlckNhc2UoKTtcclxuICAgICAgY29uc3QgdG9rZW4gPSBgX19NRF9DT0RFXyR7Y29kZUJsb2Nrcy5sZW5ndGh9X19gO1xyXG4gICAgICBjb2RlQmxvY2tzLnB1c2goXHJcbiAgICAgICAgYDxwcmU+PGNvZGUgZGF0YS1sYW5ndWFnZT1cIiR7dGhpcy5lc2NhcGVIdG1sKGxhbmd1YWdlKX1cIj4ke3RoaXMuZXNjYXBlSHRtbChTdHJpbmcoY29kZSB8fCAnJykpfTwvY29kZT48L3ByZT5gXHJcbiAgICAgICk7XHJcbiAgICAgIHJldHVybiB0b2tlbjtcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IGxpbmVzID0gd2l0aG91dENvZGUuc3BsaXQoL1xccj9cXG4vKTtcclxuICAgIGNvbnN0IGh0bWw6IHN0cmluZ1tdID0gW107XHJcbiAgICBsZXQgbGlzdFR5cGU6ICd1bCcgfCAnb2wnIHwgbnVsbCA9IG51bGw7XHJcblxyXG4gICAgY29uc3QgY2xvc2VMaXN0ID0gKCkgPT4ge1xyXG4gICAgICBpZiAobGlzdFR5cGUpIHtcclxuICAgICAgICBodG1sLnB1c2goYDwvJHtsaXN0VHlwZX0+YCk7XHJcbiAgICAgICAgbGlzdFR5cGUgPSBudWxsO1xyXG4gICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIGZvciAoY29uc3QgbGluZSBvZiBsaW5lcykge1xyXG4gICAgICBjb25zdCB0cmltbWVkID0gbGluZS50cmltKCk7XHJcblxyXG4gICAgICBpZiAoIXRyaW1tZWQpIHtcclxuICAgICAgICBjbG9zZUxpc3QoKTtcclxuICAgICAgICBjb250aW51ZTtcclxuICAgICAgfVxyXG5cclxuICAgICAgY29uc3QgdG9rZW5NYXRjaCA9IHRyaW1tZWQubWF0Y2goL15fX01EX0NPREVfKFxcZCspX18kLyk7XHJcbiAgICAgIGlmICh0b2tlbk1hdGNoKSB7XHJcbiAgICAgICAgY2xvc2VMaXN0KCk7XHJcbiAgICAgICAgaHRtbC5wdXNoKGNvZGVCbG9ja3NbTnVtYmVyKHRva2VuTWF0Y2hbMV0pXSB8fCAnJyk7XHJcbiAgICAgICAgY29udGludWU7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGNvbnN0IGhlYWRpbmcgPSB0cmltbWVkLm1hdGNoKC9eKCN7MSwzfSlcXHMrKC4rKSQvKTtcclxuICAgICAgaWYgKGhlYWRpbmcpIHtcclxuICAgICAgICBjbG9zZUxpc3QoKTtcclxuICAgICAgICBodG1sLnB1c2goYDxoJHtoZWFkaW5nWzFdLmxlbmd0aH0+JHt0aGlzLnJlbmRlck1hcmtkb3duSW5saW5lKGhlYWRpbmdbMl0pfTwvaCR7aGVhZGluZ1sxXS5sZW5ndGh9PmApO1xyXG4gICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBpZiAoL14tLS0rJC8udGVzdCh0cmltbWVkKSkge1xyXG4gICAgICAgIGNsb3NlTGlzdCgpO1xyXG4gICAgICAgIGh0bWwucHVzaCgnPGhyPicpO1xyXG4gICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBjb25zdCB1bm9yZGVyZWQgPSB0cmltbWVkLm1hdGNoKC9eWy0qXVxccysoPzpcXFtbIHhdXFxdXFxzKyk/KC4rKSQvaSk7XHJcbiAgICAgIGlmICh1bm9yZGVyZWQpIHtcclxuICAgICAgICBpZiAobGlzdFR5cGUgIT09ICd1bCcpIHtcclxuICAgICAgICAgIGNsb3NlTGlzdCgpO1xyXG4gICAgICAgICAgaHRtbC5wdXNoKCc8dWw+Jyk7XHJcbiAgICAgICAgICBsaXN0VHlwZSA9ICd1bCc7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGh0bWwucHVzaChgPGxpPiR7dGhpcy5yZW5kZXJNYXJrZG93bklubGluZSh1bm9yZGVyZWRbMV0pfTwvbGk+YCk7XHJcbiAgICAgICAgY29udGludWU7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGNvbnN0IG9yZGVyZWQgPSB0cmltbWVkLm1hdGNoKC9eXFxkK1xcLlxccysoLispJC8pO1xyXG4gICAgICBpZiAob3JkZXJlZCkge1xyXG4gICAgICAgIGlmIChsaXN0VHlwZSAhPT0gJ29sJykge1xyXG4gICAgICAgICAgY2xvc2VMaXN0KCk7XHJcbiAgICAgICAgICBodG1sLnB1c2goJzxvbD4nKTtcclxuICAgICAgICAgIGxpc3RUeXBlID0gJ29sJztcclxuICAgICAgICB9XHJcbiAgICAgICAgaHRtbC5wdXNoKGA8bGk+JHt0aGlzLnJlbmRlck1hcmtkb3duSW5saW5lKG9yZGVyZWRbMV0pfTwvbGk+YCk7XHJcbiAgICAgICAgY29udGludWU7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGNvbnN0IHF1b3RlID0gdHJpbW1lZC5tYXRjaCgvXj5cXHMrKC4rKSQvKTtcclxuICAgICAgaWYgKHF1b3RlKSB7XHJcbiAgICAgICAgY2xvc2VMaXN0KCk7XHJcbiAgICAgICAgaHRtbC5wdXNoKGA8YmxvY2txdW90ZT4ke3RoaXMucmVuZGVyTWFya2Rvd25JbmxpbmUocXVvdGVbMV0pfTwvYmxvY2txdW90ZT5gKTtcclxuICAgICAgICBjb250aW51ZTtcclxuICAgICAgfVxyXG5cclxuICAgICAgY2xvc2VMaXN0KCk7XHJcbiAgICAgIGh0bWwucHVzaChgPHA+JHt0aGlzLnJlbmRlck1hcmtkb3duSW5saW5lKHRyaW1tZWQpfTwvcD5gKTtcclxuICAgIH1cclxuXHJcbiAgICBjbG9zZUxpc3QoKTtcclxuICAgIHJldHVybiBodG1sLmpvaW4oJycpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSByZW5kZXJNYXJrZG93bklubGluZSh2YWx1ZTogc3RyaW5nKTogc3RyaW5nIHtcclxuICAgIGxldCBodG1sID0gdGhpcy5lc2NhcGVIdG1sKHZhbHVlKTtcclxuICAgIGh0bWwgPSBodG1sLnJlcGxhY2UoL2AoW15gXSspYC9nLCAnPGNvZGU+JDE8L2NvZGU+Jyk7XHJcbiAgICBodG1sID0gaHRtbC5yZXBsYWNlKC9cXCpcXCooW14qXSspXFwqXFwqL2csICc8c3Ryb25nPiQxPC9zdHJvbmc+Jyk7XHJcbiAgICBodG1sID0gaHRtbC5yZXBsYWNlKC9cXCooW14qXSspXFwqL2csICc8ZW0+JDE8L2VtPicpO1xyXG4gICAgaHRtbCA9IGh0bWwucmVwbGFjZSgvXFxbKFteXFxdXSspXFxdXFwoKGh0dHBzPzpcXC9cXC9bXilcXHNdKylcXCkvZywgJzxhIGhyZWY9XCIkMlwiIHRhcmdldD1cIl9ibGFua1wiIHJlbD1cIm5vb3BlbmVyIG5vcmVmZXJyZXJcIj4kMTwvYT4nKTtcclxuICAgIHJldHVybiBodG1sO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBjb3B5VGV4dCh0ZXh0OiBzdHJpbmcpOiB2b2lkIHtcclxuICAgIGlmICghdGV4dCkgcmV0dXJuO1xyXG4gICAgaWYgKG5hdmlnYXRvci5jbGlwYm9hcmQ/LndyaXRlVGV4dCkge1xyXG4gICAgICBuYXZpZ2F0b3IuY2xpcGJvYXJkLndyaXRlVGV4dCh0ZXh0KS50aGVuKFxyXG4gICAgICAgICgpID0+IHRoaXMuc3RvcmUuc2hvd1RvYXN0KCdDb3BpZWQgdG8gY2xpcGJvYXJkJywgJ3N1Y2Nlc3MnLCAxNjAwKSxcclxuICAgICAgICAoKSA9PiB0aGlzLmZhbGxiYWNrQ29weVRleHQodGV4dClcclxuICAgICAgKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgdGhpcy5mYWxsYmFja0NvcHlUZXh0KHRleHQpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBmYWxsYmFja0NvcHlUZXh0KHRleHQ6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgdHJ5IHtcclxuICAgICAgY29uc3QgdGV4dGFyZWEgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCd0ZXh0YXJlYScpO1xyXG4gICAgICB0ZXh0YXJlYS52YWx1ZSA9IHRleHQ7XHJcbiAgICAgIHRleHRhcmVhLnN0eWxlLnBvc2l0aW9uID0gJ2ZpeGVkJztcclxuICAgICAgdGV4dGFyZWEuc3R5bGUubGVmdCA9ICctOTk5OXB4JztcclxuICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCh0ZXh0YXJlYSk7XHJcbiAgICAgIHRleHRhcmVhLnNlbGVjdCgpO1xyXG4gICAgICBkb2N1bWVudC5leGVjQ29tbWFuZCgnY29weScpO1xyXG4gICAgICBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKHRleHRhcmVhKTtcclxuICAgICAgdGhpcy5zdG9yZS5zaG93VG9hc3QoJ0NvcGllZCB0byBjbGlwYm9hcmQnLCAnc3VjY2VzcycsIDE2MDApO1xyXG4gICAgfSBjYXRjaCB7XHJcbiAgICAgIHRoaXMuc3RvcmUuc2hvd1RvYXN0KCdDb3VsZCBub3QgY29weScsICdlcnJvcicsIDIyMDApO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBlc2NhcGVIdG1sKHZhbHVlOiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gICAgcmV0dXJuIHZhbHVlXHJcbiAgICAgIC5yZXBsYWNlKC8mL2csICcmYW1wOycpXHJcbiAgICAgIC5yZXBsYWNlKC88L2csICcmbHQ7JylcclxuICAgICAgLnJlcGxhY2UoLz4vZywgJyZndDsnKVxyXG4gICAgICAucmVwbGFjZSgvXCIvZywgJyZxdW90OycpXHJcbiAgICAgIC5yZXBsYWNlKC8nL2csICcmIzM5OycpO1xyXG4gIH1cclxuXHJcbiAgaXNUYWJsZVRleHQobXNnOiBNZXNzYWdlKTogYm9vbGVhbiB7XHJcbiAgICBjb25zdCByb3dzID0gdGhpcy5nZXRUYWJsZVJvd3MobXNnKTtcclxuICAgIHJldHVybiByb3dzLmxlbmd0aCA+PSAyICYmIHJvd3Muc29tZSgocm93KSA9PiByb3cubGVuZ3RoID49IDIpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBpc1RhYmxlQ29udGVudChjb250ZW50OiBzdHJpbmcpOiBib29sZWFuIHtcclxuICAgIGNvbnN0IHJvd3MgPSB0aGlzLmdldFRhYmxlUm93c0Zyb21Db250ZW50KGNvbnRlbnQpO1xyXG4gICAgcmV0dXJuIHJvd3MubGVuZ3RoID49IDIgJiYgcm93cy5zb21lKChyb3cpID0+IHJvdy5sZW5ndGggPj0gMik7XHJcbiAgfVxyXG5cclxuICBnZXRUYWJsZVJvd3MobXNnOiBNZXNzYWdlKTogc3RyaW5nW11bXSB7XHJcbiAgICByZXR1cm4gdGhpcy5nZXRUYWJsZVJvd3NGcm9tQ29udGVudCh0aGlzLmdldE1lc3NhZ2VCb2R5KG1zZykpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBnZXRUYWJsZVJvd3NGcm9tQ29udGVudCh2YWx1ZTogc3RyaW5nKTogc3RyaW5nW11bXSB7XHJcbiAgICBjb25zdCBjb250ZW50ID0gdmFsdWUudHJpbSgpO1xyXG4gICAgaWYgKCFjb250ZW50LmluY2x1ZGVzKCdcXHQnKSkgcmV0dXJuIFtdO1xyXG5cclxuICAgIGNvbnN0IHJvd3MgPSBjb250ZW50XHJcbiAgICAgIC5zcGxpdCgvXFxyP1xcbi8pXHJcbiAgICAgIC5tYXAoKGxpbmUpID0+IGxpbmUuc3BsaXQoJ1xcdCcpLm1hcCgoY2VsbCkgPT4gY2VsbC50cmltKCkpKVxyXG4gICAgICAuZmlsdGVyKChyb3cpID0+IHJvdy5zb21lKChjZWxsKSA9PiBjZWxsLmxlbmd0aCA+IDApKTtcclxuXHJcbiAgICBjb25zdCBtYXhDb2x1bW5zID0gTWF0aC5tYXgoMCwgLi4ucm93cy5tYXAoKHJvdykgPT4gcm93Lmxlbmd0aCkpO1xyXG4gICAgaWYgKG1heENvbHVtbnMgPCAyKSByZXR1cm4gW107XHJcblxyXG4gICAgcmV0dXJuIHJvd3MubWFwKChyb3cpID0+IFtcclxuICAgICAgLi4ucm93LFxyXG4gICAgICAuLi5BcnJheS5mcm9tKHsgbGVuZ3RoOiBtYXhDb2x1bW5zIC0gcm93Lmxlbmd0aCB9LCAoKSA9PiAnJyksXHJcbiAgICBdKTtcclxuICB9XHJcblxyXG4gIGlzTWVzc2FnZVJlYWQobXNnOiBNZXNzYWdlKTogYm9vbGVhbiB7XHJcbiAgICBjb25zdCB2YWx1ZSA9IG1zZy5pc19yZWFkO1xyXG4gICAgcmV0dXJuIHZhbHVlID09PSB0cnVlIHx8IHZhbHVlID09PSAndHJ1ZScgfHwgdmFsdWUgPT09ICdUcnVlJyB8fCB2YWx1ZSA9PT0gJzEnO1xyXG4gIH1cclxuXHJcbiAgZ2V0UmVhZFRvb2x0aXAobXNnOiBNZXNzYWdlKTogc3RyaW5nIHtcclxuICAgIGlmICghdGhpcy5pc0dyb3VwKSByZXR1cm4gJ1JlYWQnO1xyXG5cclxuICAgIGNvbnN0IG5hbWVzID0gdGhpcy5nZXRSZWFkQnlOYW1lcyhtc2cpO1xyXG4gICAgaWYgKG5hbWVzLmxlbmd0aCA+IDApIHtcclxuICAgICAgcmV0dXJuIGBSZWFkIGJ5ICR7bmFtZXMuam9pbignLCAnKX1gO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiAnUmVhZCc7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGdldFJlYWRCeU5hbWVzKG1zZzogTWVzc2FnZSk6IHN0cmluZ1tdIHtcclxuICAgIGNvbnN0IGFueU1zZyA9IG1zZyBhcyBhbnk7XHJcbiAgICBjb25zdCByYXdOYW1lcyA9IFtcclxuICAgICAgLi4udGhpcy50b1JlYWRBcnJheShhbnlNc2cucmVhZF9ieV9uYW1lcyksXHJcbiAgICAgIC4uLnRoaXMudG9SZWFkQXJyYXkoYW55TXNnLnJlYWRCeU5hbWVzKSxcclxuICAgICAgLi4udGhpcy50b1JlYWRBcnJheShhbnlNc2cucmVhZGVyX25hbWVzKSxcclxuICAgICAgLi4udGhpcy50b1JlYWRBcnJheShhbnlNc2cucmVhZGVycyksXHJcbiAgICAgIC4uLnRoaXMudG9SZWFkQXJyYXkoYW55TXNnLnJlYWRfYnkpLFxyXG4gICAgICAuLi50aGlzLnRvUmVhZEFycmF5KGFueU1zZy5yZWFkQnkpLFxyXG4gICAgXTtcclxuXHJcbiAgICBjb25zdCBuYW1lcyA9IHJhd05hbWVzXHJcbiAgICAgIC5tYXAoKGVudHJ5KSA9PiB0aGlzLnJlYWRFbnRyeVRvTmFtZShlbnRyeSkpXHJcbiAgICAgIC5maWx0ZXIoKG5hbWUpOiBuYW1lIGlzIHN0cmluZyA9PiAhIW5hbWUgJiYgbmFtZSAhPT0gJ1lvdScpO1xyXG5cclxuICAgIHJldHVybiBBcnJheS5mcm9tKG5ldyBTZXQobmFtZXMpKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgdG9SZWFkQXJyYXkodmFsdWU6IHVua25vd24pOiB1bmtub3duW10ge1xyXG4gICAgaWYgKCF2YWx1ZSkgcmV0dXJuIFtdO1xyXG4gICAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSByZXR1cm4gdmFsdWU7XHJcbiAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykge1xyXG4gICAgICBjb25zdCB0cmltbWVkID0gdmFsdWUudHJpbSgpO1xyXG4gICAgICBpZiAoIXRyaW1tZWQpIHJldHVybiBbXTtcclxuICAgICAgdHJ5IHtcclxuICAgICAgICBjb25zdCBwYXJzZWQgPSBKU09OLnBhcnNlKHRyaW1tZWQpO1xyXG4gICAgICAgIHJldHVybiBBcnJheS5pc0FycmF5KHBhcnNlZCkgPyBwYXJzZWQgOiBbcGFyc2VkXTtcclxuICAgICAgfSBjYXRjaCB7XHJcbiAgICAgICAgcmV0dXJuIHRyaW1tZWQuaW5jbHVkZXMoJywnKSA/IHRyaW1tZWQuc3BsaXQoJywnKS5tYXAoKHYpID0+IHYudHJpbSgpKSA6IFt0cmltbWVkXTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIFt2YWx1ZV07XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHJlYWRFbnRyeVRvTmFtZShlbnRyeTogdW5rbm93bik6IHN0cmluZyB8IG51bGwge1xyXG4gICAgaWYgKGVudHJ5ID09IG51bGwpIHJldHVybiBudWxsO1xyXG4gICAgaWYgKHR5cGVvZiBlbnRyeSA9PT0gJ3N0cmluZycgfHwgdHlwZW9mIGVudHJ5ID09PSAnbnVtYmVyJykge1xyXG4gICAgICBjb25zdCBpZE9yTmFtZSA9IFN0cmluZyhlbnRyeSkudHJpbSgpO1xyXG4gICAgICBjb25zdCBjb250YWN0ID0gdGhpcy52aXNpYmxlQ29udGFjdHMuZmluZCgoYykgPT4gU3RyaW5nKGMuY29udGFjdF9pZCkgPT09IGlkT3JOYW1lKTtcclxuICAgICAgcmV0dXJuIGNvbnRhY3QgPyBnZXRDb250YWN0RGlzcGxheU5hbWUoY29udGFjdCkgOiBpZE9yTmFtZTtcclxuICAgIH1cclxuICAgIGlmICh0eXBlb2YgZW50cnkgPT09ICdvYmplY3QnKSB7XHJcbiAgICAgIGNvbnN0IG9iaiA9IGVudHJ5IGFzIGFueTtcclxuICAgICAgY29uc3QgZXhwbGljaXQgPSBvYmoudXNlcm5hbWUgfHwgb2JqLm5hbWUgfHwgb2JqLmRpc3BsYXlfbmFtZSB8fCBvYmouZGlzcGxheU5hbWUgfHwgb2JqLmVtYWlsO1xyXG4gICAgICBpZiAoZXhwbGljaXQpIHJldHVybiBTdHJpbmcoZXhwbGljaXQpO1xyXG4gICAgICBpZiAob2JqLmNvbnRhY3RfaWQgfHwgb2JqLmNvbnRhY3RJZCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLnJlYWRFbnRyeVRvTmFtZShvYmouY29udGFjdF9pZCB8fCBvYmouY29udGFjdElkKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIG51bGw7XHJcbiAgfVxyXG5cclxuICBnZXRTZW5kZXJOYW1lKG1zZzogTWVzc2FnZSk6IHN0cmluZyB7XHJcbiAgICBjb25zdCBmcm9tTWVzc2FnZSA9IGdldE1lc3NhZ2VTZW5kZXJOYW1lKG1zZyk7XHJcbiAgICBpZiAoZnJvbU1lc3NhZ2UgJiYgZnJvbU1lc3NhZ2UgIT09ICdVbmtub3duJykge1xyXG4gICAgICByZXR1cm4gZnJvbU1lc3NhZ2U7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgZnJvbUNvbnRhY3RzID0gdGhpcy52aXNpYmxlQ29udGFjdHMuZmluZChcclxuICAgICAgKGMpID0+IFN0cmluZyhjLmNvbnRhY3RfaWQpID09PSBTdHJpbmcobXNnLnNlbmRlcl9pZClcclxuICAgICk7XHJcbiAgICBpZiAoZnJvbUNvbnRhY3RzKSB7XHJcbiAgICAgIHJldHVybiBnZXRDb250YWN0RGlzcGxheU5hbWUoZnJvbUNvbnRhY3RzKTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAodGhpcy5pc093bk1lc3NhZ2UobXNnKSkge1xyXG4gICAgICByZXR1cm4gJ1lvdSc7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIGBVc2VyICR7bXNnLnNlbmRlcl9pZH1gO1xyXG4gIH1cclxuXHJcbiAgZm9ybWF0VGltZShkYXRlU3RyOiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gICAgaWYgKCFkYXRlU3RyKSByZXR1cm4gJyc7XHJcbiAgICBjb25zdCBkID0gbmV3IERhdGUoZGF0ZVN0cik7XHJcbiAgICByZXR1cm4gZC50b0xvY2FsZVRpbWVTdHJpbmcoJ2VuLUdCJywgeyBob3VyOiAnMi1kaWdpdCcsIG1pbnV0ZTogJzItZGlnaXQnIH0pO1xyXG4gIH1cclxuXHJcbiAgZm9ybWF0RGF0ZShkYXRlU3RyOiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gICAgY29uc3QgZCA9IG5ldyBEYXRlKGRhdGVTdHIpO1xyXG4gICAgY29uc3QgdG9kYXkgPSBuZXcgRGF0ZSgpO1xyXG4gICAgY29uc3QgeWVzdGVyZGF5ID0gbmV3IERhdGUodG9kYXkpO1xyXG4gICAgeWVzdGVyZGF5LnNldERhdGUoeWVzdGVyZGF5LmdldERhdGUoKSAtIDEpO1xyXG5cclxuICAgIGlmIChkLnRvRGF0ZVN0cmluZygpID09PSB0b2RheS50b0RhdGVTdHJpbmcoKSkgcmV0dXJuICdUb2RheSc7XHJcbiAgICBpZiAoZC50b0RhdGVTdHJpbmcoKSA9PT0geWVzdGVyZGF5LnRvRGF0ZVN0cmluZygpKSByZXR1cm4gJ1llc3RlcmRheSc7XHJcbiAgICByZXR1cm4gZC50b0xvY2FsZURhdGVTdHJpbmcoJ2VuLUdCJywgeyBkYXk6ICdudW1lcmljJywgbW9udGg6ICdzaG9ydCcsIHllYXI6ICdudW1lcmljJyB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgc2Nyb2xsVG9Cb3R0b20oKTogdm9pZCB7XHJcbiAgICB0cnkge1xyXG4gICAgICBjb25zdCBlbCA9IHRoaXMuc2Nyb2xsQ29udGFpbmVyPy5uYXRpdmVFbGVtZW50O1xyXG4gICAgICBpZiAoZWwpIHtcclxuICAgICAgICBlbC5zY3JvbGxUb3AgPSBlbC5zY3JvbGxIZWlnaHQ7XHJcbiAgICAgIH1cclxuICAgIH0gY2F0Y2ggeyAvKiBpZ25vcmUgKi8gfVxyXG4gIH1cclxuXHJcbiAgLy8g4pSA4pSAIE1lZGlhIGhlbHBlcnMg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcblxyXG4gIHByaXZhdGUgZ2V0RmlsZW5hbWVMaWtlKG1zZzogTWVzc2FnZSwgYXR0YWNobWVudD86IEF0dGFjaG1lbnQpOiBzdHJpbmcge1xyXG4gICAgY29uc3QgYW55TXNnID0gbXNnIGFzIGFueTtcclxuICAgIHJldHVybiBTdHJpbmcoXHJcbiAgICAgIGF0dGFjaG1lbnQ/LmZpbGVuYW1lIHx8XHJcbiAgICAgIHRoaXMuZ2V0UHJpbWFyeUF0dGFjaG1lbnQobXNnKT8uZmlsZW5hbWUgfHxcclxuICAgICAgYW55TXNnPy5maWxlbmFtZSB8fFxyXG4gICAgICBhbnlNc2c/LmZpbGVfbmFtZSB8fFxyXG4gICAgICBtc2cuY29udGVudCB8fFxyXG4gICAgICAnJ1xyXG4gICAgKS50b0xvd2VyQ2FzZSgpO1xyXG4gIH1cclxuXHJcbiAgZ2V0UmVuZGVyYWJsZUF0dGFjaG1lbnRzKG1zZzogTWVzc2FnZSk6IEF0dGFjaG1lbnRbXSB7XHJcbiAgICBjb25zdCBhdHRhY2htZW50cyA9IHRoaXMuZ2V0QWxsQXR0YWNobWVudHMobXNnKTtcclxuICAgIGlmIChhdHRhY2htZW50cy5sZW5ndGggPiAwKSByZXR1cm4gYXR0YWNobWVudHM7XHJcbiAgICBjb25zdCBwcmltYXJ5ID0gdGhpcy5nZXRQcmltYXJ5QXR0YWNobWVudChtc2cpO1xyXG4gICAgcmV0dXJuIHByaW1hcnkgPyBbcHJpbWFyeV0gOiBbXTtcclxuICB9XHJcblxyXG4gIHRyYWNrQnlBdHRhY2htZW50KGluZGV4OiBudW1iZXIsIGF0dGFjaG1lbnQ6IEF0dGFjaG1lbnQpOiBzdHJpbmcge1xyXG4gICAgcmV0dXJuIGF0dGFjaG1lbnQuZmlsZV9pZCB8fCBhdHRhY2htZW50LnVybCB8fCBgJHthdHRhY2htZW50LmZpbGVuYW1lfS0ke2luZGV4fWA7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGdldEFsbEF0dGFjaG1lbnRzKG1zZzogTWVzc2FnZSk6IEF0dGFjaG1lbnRbXSB7XHJcbiAgICBjb25zdCBhbnlNc2cgPSBtc2cgYXMgYW55O1xyXG4gICAgY29uc3QgYXR0YWNobWVudHM6IEF0dGFjaG1lbnRbXSA9IFtdO1xyXG4gICAgY29uc3QgYWRkID0gKGF0dGFjaG1lbnQ6IFBhcnRpYWw8QXR0YWNobWVudD4gfCBzdHJpbmcgfCBudWxsIHwgdW5kZWZpbmVkKTogdm9pZCA9PiB7XHJcbiAgICAgIGNvbnN0IHJhdyA9IGF0dGFjaG1lbnQgYXMgYW55O1xyXG4gICAgICBjb25zdCBmaWxlSWQgPSBTdHJpbmcoXHJcbiAgICAgICAgdHlwZW9mIGF0dGFjaG1lbnQgPT09ICdzdHJpbmcnID8gYXR0YWNobWVudCA6XHJcbiAgICAgICAgcmF3Py5maWxlX2lkID8/XHJcbiAgICAgICAgcmF3Py5maWxlSWQgPz9cclxuICAgICAgICByYXc/LmlkID8/XHJcbiAgICAgICAgcmF3Py5hdHRhY2htZW50X2lkID8/XHJcbiAgICAgICAgcmF3Py5zdG9yYWdlX2ZpbGVfaWQgPz9cclxuICAgICAgICAnJ1xyXG4gICAgICApLnRyaW0oKTtcclxuICAgICAgaWYgKGZpbGVJZC5zdGFydHNXaXRoKCd7JykgfHwgZmlsZUlkLnN0YXJ0c1dpdGgoJ1snKSkge1xyXG4gICAgICAgIGNvbnN0IGlkcyA9IHRoaXMudG9BcnJheShmaWxlSWQpO1xyXG4gICAgICAgIGNvbnN0IGZpbGVuYW1lcyA9IHRoaXMudG9BcnJheShyYXc/LmZpbGVuYW1lcyA/PyByYXc/LmZpbGVuYW1lID8/IHJhdz8uZmlsZV9uYW1lKTtcclxuICAgICAgICBjb25zdCBtaW1lVHlwZXMgPSB0aGlzLnRvQXJyYXkocmF3Py5taW1lX3R5cGVzID8/IHJhdz8ubWltZVR5cGVzID8/IHJhdz8ubWltZV90eXBlKTtcclxuICAgICAgICBpZHMuZm9yRWFjaCgoaWQsIGlkeCkgPT4ge1xyXG4gICAgICAgICAgYWRkKHtcclxuICAgICAgICAgICAgZmlsZV9pZDogaWQsXHJcbiAgICAgICAgICAgIGZpbGVuYW1lOiBmaWxlbmFtZXNbaWR4XSB8fCBmaWxlbmFtZXNbMF0gfHwgcmF3Py5maWxlbmFtZSB8fCByYXc/LmZpbGVfbmFtZSB8fCBgQXR0YWNobWVudCAke2lkeCArIDF9YCxcclxuICAgICAgICAgICAgbWltZV90eXBlOiBtaW1lVHlwZXNbaWR4XSB8fCByYXc/Lm1pbWVfdHlwZSB8fCByYXc/Lm1pbWVUeXBlLFxyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICB9XHJcbiAgICAgIGNvbnN0IHVybCA9IFN0cmluZyhyYXc/LnVybCA/PyByYXc/LmZpbGVfdXJsID8/IHJhdz8uZG93bmxvYWRfdXJsID8/ICcnKS50cmltKCk7XHJcbiAgICAgIGlmICghZmlsZUlkICYmICF1cmwpIHJldHVybjtcclxuICAgICAgaWYgKGZpbGVJZCAmJiBhdHRhY2htZW50cy5zb21lKChhKSA9PiBhLmZpbGVfaWQgPT09IGZpbGVJZCkpIHJldHVybjtcclxuICAgICAgaWYgKCFmaWxlSWQgJiYgdXJsICYmIGF0dGFjaG1lbnRzLnNvbWUoKGEpID0+IGEudXJsID09PSB1cmwpKSByZXR1cm47XHJcbiAgICAgIGF0dGFjaG1lbnRzLnB1c2goe1xyXG4gICAgICAgIGZpbGVfaWQ6IGZpbGVJZCxcclxuICAgICAgICBmaWxlbmFtZTogU3RyaW5nKFxyXG4gICAgICAgICAgcmF3Py5maWxlbmFtZSA/P1xyXG4gICAgICAgICAgcmF3Py5maWxlX25hbWUgPz9cclxuICAgICAgICAgIHJhdz8ubmFtZSA/P1xyXG4gICAgICAgICAgKG1zZy5tZXNzYWdlX3R5cGUgPT09ICdJTUFHRScgPyAnSW1hZ2UnIDogJ0ZpbGUnKVxyXG4gICAgICAgICksXHJcbiAgICAgICAgbWltZV90eXBlOiByYXc/Lm1pbWVfdHlwZSA/PyByYXc/Lm1pbWVUeXBlID8/IChtc2cubWVzc2FnZV90eXBlID09PSAnSU1BR0UnID8gJ2ltYWdlLyonIDogdW5kZWZpbmVkKSxcclxuICAgICAgICBzaXplX2J5dGVzOiByYXc/LnNpemVfYnl0ZXMgPz8gcmF3Py5zaXplQnl0ZXMsXHJcbiAgICAgICAgdXJsOiB1cmwgfHwgdW5kZWZpbmVkLFxyXG4gICAgICB9KTtcclxuICAgIH07XHJcblxyXG4gICAgaWYgKEFycmF5LmlzQXJyYXkobXNnLmF0dGFjaG1lbnRzKSkge1xyXG4gICAgICBtc2cuYXR0YWNobWVudHMuZm9yRWFjaChhZGQpO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IG1lZGlhVmFsdWUgPSBTdHJpbmcobXNnLm1lZGlhX3VybCB8fCAnJykudHJpbSgpO1xyXG4gICAgaWYgKG1lZGlhVmFsdWUuc3RhcnRzV2l0aCgneycpIHx8IG1lZGlhVmFsdWUuc3RhcnRzV2l0aCgnWycpKSB7XHJcbiAgICAgIHRyeSB7XHJcbiAgICAgICAgY29uc3QgcGFyc2VkID0gSlNPTi5wYXJzZShtZWRpYVZhbHVlKTtcclxuICAgICAgICBjb25zdCBtZWRpYUF0dGFjaG1lbnRzID0gQXJyYXkuaXNBcnJheShwYXJzZWQpID8gcGFyc2VkIDogcGFyc2VkPy5hdHRhY2htZW50cztcclxuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShtZWRpYUF0dGFjaG1lbnRzKSkge1xyXG4gICAgICAgICAgbWVkaWFBdHRhY2htZW50cy5mb3JFYWNoKGFkZCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICghQXJyYXkuaXNBcnJheShwYXJzZWQpKSB7XHJcbiAgICAgICAgICBjb25zdCBpZHMgPSB0aGlzLnRvQXJyYXkocGFyc2VkPy5pZHMgPz8gcGFyc2VkPy5maWxlX2lkcyA/PyBwYXJzZWQ/LmF0dGFjaG1lbnRfaWRzKTtcclxuICAgICAgICAgIGNvbnN0IGZpbGVuYW1lcyA9IHRoaXMudG9BcnJheShwYXJzZWQ/LmZpbGVuYW1lcyk7XHJcbiAgICAgICAgICBjb25zdCBtaW1lVHlwZXMgPSB0aGlzLnRvQXJyYXkocGFyc2VkPy5taW1lX3R5cGVzID8/IHBhcnNlZD8ubWltZVR5cGVzKTtcclxuICAgICAgICAgIGlkcy5mb3JFYWNoKChpZCwgaWR4KSA9PiB7XHJcbiAgICAgICAgICAgIGFkZCh7XHJcbiAgICAgICAgICAgICAgZmlsZV9pZDogaWQsXHJcbiAgICAgICAgICAgICAgZmlsZW5hbWU6IGZpbGVuYW1lc1tpZHhdIHx8IGZpbGVuYW1lc1swXSB8fCAobXNnLm1lc3NhZ2VfdHlwZSA9PT0gJ0lNQUdFJyA/IGBJbWFnZSAke2lkeCArIDF9YCA6IGBBdHRhY2htZW50ICR7aWR4ICsgMX1gKSxcclxuICAgICAgICAgICAgICBtaW1lX3R5cGU6IG1pbWVUeXBlc1tpZHhdIHx8IChtc2cubWVzc2FnZV90eXBlID09PSAnSU1BR0UnID8gJ2ltYWdlLyonIDogdW5kZWZpbmVkKSxcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICAgIH0gY2F0Y2gge1xyXG4gICAgICAgIC8vIE5vbi1KU09OIG1lZGlhX3VybCB2YWx1ZXMgYXJlIGhhbmRsZWQgYnkgZ2V0UHJpbWFyeUF0dGFjaG1lbnQoKS5cclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGlkcyA9IHRoaXMudG9BcnJheShhbnlNc2c/LmF0dGFjaG1lbnRfaWRzID8/IGFueU1zZz8uZmlsZV9pZHMpO1xyXG4gICAgY29uc3QgZmlsZW5hbWVzID0gdGhpcy50b0FycmF5KGFueU1zZz8uZmlsZW5hbWVzKTtcclxuICAgIGNvbnN0IG1pbWVUeXBlcyA9IHRoaXMudG9BcnJheShhbnlNc2c/Lm1pbWVfdHlwZXMgPz8gYW55TXNnPy5taW1lVHlwZXMpO1xyXG4gICAgaWRzLmZvckVhY2goKGlkLCBpZHgpID0+IHtcclxuICAgICAgYWRkKHtcclxuICAgICAgICBmaWxlX2lkOiBpZCxcclxuICAgICAgICBmaWxlbmFtZTogZmlsZW5hbWVzW2lkeF0gfHwgZmlsZW5hbWVzWzBdIHx8IChtc2cubWVzc2FnZV90eXBlID09PSAnSU1BR0UnID8gYEltYWdlICR7aWR4ICsgMX1gIDogYEF0dGFjaG1lbnQgJHtpZHggKyAxfWApLFxyXG4gICAgICAgIG1pbWVfdHlwZTogbWltZVR5cGVzW2lkeF0gfHwgYW55TXNnPy5taW1lX3R5cGUgfHwgYW55TXNnPy5hdHRhY2htZW50X21pbWVfdHlwZSB8fCAobXNnLm1lc3NhZ2VfdHlwZSA9PT0gJ0lNQUdFJyA/ICdpbWFnZS8qJyA6IHVuZGVmaW5lZCksXHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcblxyXG4gICAgcmV0dXJuIGF0dGFjaG1lbnRzO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSB0b0FycmF5KHZhbHVlOiB1bmtub3duKTogc3RyaW5nW10ge1xyXG4gICAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSB7XHJcbiAgICAgIHJldHVybiB2YWx1ZVxyXG4gICAgICAgIC5tYXAoKHg6IGFueSkgPT4gKHR5cGVvZiB4ID09PSAnc3RyaW5nJyA/IHggOiB4Py5maWxlX2lkID8/IHg/LmlkID8/ICcnKSlcclxuICAgICAgICAubWFwKCh4KSA9PiBTdHJpbmcoeCkudHJpbSgpKVxyXG4gICAgICAgIC5maWx0ZXIoQm9vbGVhbik7XHJcbiAgICB9XHJcbiAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJyAmJiB2YWx1ZS50cmltKCkpIHtcclxuICAgICAgY29uc3QgdHJpbW1lZCA9IHZhbHVlLnRyaW0oKTtcclxuICAgICAgaWYgKHRyaW1tZWQuc3RhcnRzV2l0aCgneycpIHx8IHRyaW1tZWQuc3RhcnRzV2l0aCgnWycpKSB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgIGNvbnN0IHBhcnNlZCA9IEpTT04ucGFyc2UodHJpbW1lZCk7XHJcbiAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShwYXJzZWQpKSByZXR1cm4gdGhpcy50b0FycmF5KHBhcnNlZCk7XHJcbiAgICAgICAgICByZXR1cm4gdGhpcy50b0FycmF5KHBhcnNlZD8uaWRzID8/IHBhcnNlZD8uZmlsZV9pZHMgPz8gcGFyc2VkPy5hdHRhY2htZW50X2lkcyA/PyBwYXJzZWQ/LmF0dGFjaG1lbnRzKTtcclxuICAgICAgICB9IGNhdGNoIHtcclxuICAgICAgICAgIHJldHVybiBbXTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIHZhbHVlXHJcbiAgICAgICAgLnNwbGl0KC9bLFxcc10rLylcclxuICAgICAgICAubWFwKCh4KSA9PiB4LnRyaW0oKSlcclxuICAgICAgICAuZmlsdGVyKEJvb2xlYW4pO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIFtdO1xyXG4gIH1cclxuXHJcbiAgLyoqIFJldHVybnMgdGhlIHByaW1hcnkgYXR0YWNobWVudCBmb3IgYSBtZXNzYWdlLCBpZiBhbnkuICovXHJcbiAgcHJpdmF0ZSBnZXRQcmltYXJ5QXR0YWNobWVudChtc2c6IE1lc3NhZ2UpOiBBdHRhY2htZW50IHwgbnVsbCB7XHJcbiAgICBjb25zdCBhdHRhY2htZW50cyA9IHRoaXMuZ2V0QWxsQXR0YWNobWVudHMobXNnKTtcclxuICAgIGlmIChhdHRhY2htZW50cy5sZW5ndGggPiAwKSByZXR1cm4gYXR0YWNobWVudHNbMF07XHJcblxyXG4gICAgLy8gU29tZSBBUEkgcmVzcG9uc2VzIHByb3ZpZGUgZmlsZSBtZXRhZGF0YSBpbiBhbHRlcm5hdGUgZmllbGRzLlxyXG4gICAgY29uc3QgYW55TXNnID0gbXNnIGFzIGFueTtcclxuICAgIGNvbnN0IG11ID0gU3RyaW5nKG1zZy5tZWRpYV91cmwgfHwgJycpLnRyaW0oKTtcclxuICAgIGNvbnN0IG1lZGlhSXNEaXJlY3RVcmwgPVxyXG4gICAgICBtdS5zdGFydHNXaXRoKCdodHRwOi8vJykgfHwgbXUuc3RhcnRzV2l0aCgnaHR0cHM6Ly8nKSB8fCBtdS5zdGFydHNXaXRoKCdkYXRhOicpO1xyXG4gICAgY29uc3QgbWVkaWFJc1N0cnVjdHVyZWQgPSBtdS5zdGFydHNXaXRoKCd7JykgfHwgbXUuc3RhcnRzV2l0aCgnWycpO1xyXG4gICAgY29uc3QgZmlsZUlkID1cclxuICAgICAgYW55TXNnPy5maWxlX2lkIHx8XHJcbiAgICAgIGFueU1zZz8uYXR0YWNobWVudF9pZCB8fFxyXG4gICAgICBhbnlNc2c/LmF0dGFjaG1lbnRfaWRzPy5bMF0gfHxcclxuICAgICAgKCFtZWRpYUlzRGlyZWN0VXJsICYmICFtZWRpYUlzU3RydWN0dXJlZCAmJiBtdSA/IG11IDogdW5kZWZpbmVkKTtcclxuICAgIGNvbnN0IG1pbWUgPSBhbnlNc2c/Lm1pbWVfdHlwZSB8fCBhbnlNc2c/LmF0dGFjaG1lbnRfbWltZV90eXBlIHx8IChtc2cubWVzc2FnZV90eXBlID09PSAnSU1BR0UnID8gJ2ltYWdlLyonIDogdW5kZWZpbmVkKTtcclxuICAgIGNvbnN0IGV4cGxpY2l0RmlsZW5hbWUgPSBhbnlNc2c/LmZpbGVuYW1lIHx8IGFueU1zZz8uZmlsZV9uYW1lO1xyXG4gICAgY29uc3QgZmlsZW5hbWUgPVxyXG4gICAgICBleHBsaWNpdEZpbGVuYW1lIHx8XHJcbiAgICAgIChtc2cubWVzc2FnZV90eXBlID09PSAnSU1BR0UnID8gJ0ltYWdlJyA6IG1zZy5tZXNzYWdlX3R5cGUgPT09ICdGSUxFJyA/ICdGaWxlJyA6ICcnKTtcclxuICAgIGlmIChmaWxlSWQgfHwgZXhwbGljaXRGaWxlbmFtZSB8fCBtaW1lIHx8IG1zZy5tZXNzYWdlX3R5cGUgPT09ICdGSUxFJyB8fCBtc2cubWVzc2FnZV90eXBlID09PSAnSU1BR0UnKSB7XHJcbiAgICAgIHJldHVybiB7XHJcbiAgICAgICAgZmlsZV9pZDogU3RyaW5nKGZpbGVJZCB8fCAnJyksXHJcbiAgICAgICAgZmlsZW5hbWU6IFN0cmluZyhmaWxlbmFtZSB8fCAnRmlsZScpLFxyXG4gICAgICAgIG1pbWVfdHlwZTogbWltZSA/IFN0cmluZyhtaW1lKSA6IHVuZGVmaW5lZCxcclxuICAgICAgICB1cmw6IG1lZGlhSXNEaXJlY3RVcmwgPyBtdSA6IHVuZGVmaW5lZCxcclxuICAgICAgfTtcclxuICAgIH1cclxuICAgIHJldHVybiBudWxsO1xyXG4gIH1cclxuXHJcbiAgaXNJbWFnZUF0dGFjaG1lbnQobXNnOiBNZXNzYWdlLCBhdHRhY2htZW50PzogQXR0YWNobWVudCk6IGJvb2xlYW4ge1xyXG4gICAgY29uc3QgbWltZSA9IGF0dGFjaG1lbnQ/Lm1pbWVfdHlwZSB8fCB0aGlzLmdldFByaW1hcnlBdHRhY2htZW50KG1zZyk/Lm1pbWVfdHlwZSB8fCAnJztcclxuICAgIGlmIChtaW1lLnN0YXJ0c1dpdGgoJ2ltYWdlLycpKSByZXR1cm4gdHJ1ZTtcclxuICAgIGNvbnN0IG5hbWUgPSB0aGlzLmdldEZpbGVuYW1lTGlrZShtc2csIGF0dGFjaG1lbnQpO1xyXG4gICAgaWYgKC9cXC4ocG5nfGpwZT9nfGdpZnx3ZWJwfGJtcHxzdmd8aGVpY3xoZWlmKSQvaS50ZXN0KG5hbWUpKSByZXR1cm4gdHJ1ZTtcclxuICAgIHJldHVybiBtc2cubWVzc2FnZV90eXBlID09PSAnSU1BR0UnO1xyXG4gIH1cclxuXHJcbiAgLyoqIFJldHVybnMgdGhlIGNhY2hlZCBkYXRhIFVSTCBmb3IgYSBtZXNzYWdlJ3MgbWVkaWEsIG9yIG51bGwgYW5kIHRyaWdnZXJzIGJhY2tncm91bmQgbG9hZC4gKi9cclxuICBnZXRNZWRpYVVybChtc2c6IE1lc3NhZ2UsIGF0dGFjaG1lbnQ/OiBBdHRhY2htZW50KTogc3RyaW5nIHwgbnVsbCB7XHJcbiAgICBjb25zdCBhdHQgPSBhdHRhY2htZW50IHx8IHRoaXMuZ2V0UHJpbWFyeUF0dGFjaG1lbnQobXNnKTtcclxuICAgIGNvbnN0IGZpbGVJZCA9IGF0dD8uZmlsZV9pZD8udHJpbSgpO1xyXG5cclxuICAgIGNvbnN0IGRpcmVjdFVybCA9XHJcbiAgICAgIGF0dD8udXJsIHx8XHJcbiAgICAgICghYXR0YWNobWVudCA/IG1zZy5tZWRpYV91cmwgOiB1bmRlZmluZWQpIHx8XHJcbiAgICAgICghYXR0YWNobWVudCA/IChtc2cgYXMgYW55KT8udXJsIDogdW5kZWZpbmVkKSB8fFxyXG4gICAgICAoIWF0dGFjaG1lbnQgPyAobXNnIGFzIGFueSk/LmZpbGVfdXJsIDogdW5kZWZpbmVkKTtcclxuICAgIGlmIChcclxuICAgICAgZGlyZWN0VXJsICYmXHJcbiAgICAgIChkaXJlY3RVcmwuc3RhcnRzV2l0aCgnaHR0cDovLycpIHx8XHJcbiAgICAgICAgZGlyZWN0VXJsLnN0YXJ0c1dpdGgoJ2h0dHBzOi8vJykgfHxcclxuICAgICAgICBkaXJlY3RVcmwuc3RhcnRzV2l0aCgnZGF0YTonKSlcclxuICAgICkge1xyXG4gICAgICByZXR1cm4gZGlyZWN0VXJsO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICghZmlsZUlkKSB7XHJcbiAgICAgIHJldHVybiBudWxsO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGNhY2hlZCA9IHRoaXMuZmlsZVNlcnZpY2UuZ2V0Q2FjaGVkRGF0YVVybChmaWxlSWQpO1xyXG4gICAgaWYgKGNhY2hlZCkgcmV0dXJuIGNhY2hlZDtcclxuICAgIGlmICh0aGlzLm1lZGlhRmFpbGVkLmhhcyhmaWxlSWQpKSByZXR1cm4gbnVsbDtcclxuXHJcbiAgICAvLyBOb3QgeWV0IGNhY2hlZCDigJQga2ljayBvZmYgYSBiYWNrZ3JvdW5kIGZldGNoXHJcbiAgICB0aGlzLmZldGNoTWVkaWEoZmlsZUlkKTtcclxuICAgIHJldHVybiBudWxsO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBwcmV3YXJtTWVkaWEobWVzc2FnZXM6IE1lc3NhZ2VbXSk6IHZvaWQge1xyXG4gICAgZm9yIChjb25zdCBtc2cgb2YgbWVzc2FnZXMpIHtcclxuICAgICAgZm9yIChjb25zdCBhdHQgb2YgdGhpcy5nZXRSZW5kZXJhYmxlQXR0YWNobWVudHMobXNnKSkge1xyXG4gICAgICAgIGlmICghdGhpcy5pc0ltYWdlQXR0YWNobWVudChtc2csIGF0dCkpIGNvbnRpbnVlO1xyXG4gICAgICAgIGNvbnN0IGZpbGVJZCA9IGF0dC5maWxlX2lkPy50cmltKCk7XHJcbiAgICAgICAgaWYgKCFmaWxlSWQgfHwgZmlsZUlkLnN0YXJ0c1dpdGgoJ3RlbXAtJykpIGNvbnRpbnVlO1xyXG4gICAgICAgIGlmICh0aGlzLm1lZGlhRmFpbGVkLmhhcyhmaWxlSWQpKSBjb250aW51ZTtcclxuICAgICAgICBpZiAodGhpcy5maWxlU2VydmljZS5nZXRDYWNoZWREYXRhVXJsKGZpbGVJZCkpIGNvbnRpbnVlO1xyXG4gICAgICAgIC8vIFF1ZXVlIGFsbCBmaWxlcyBzbyBkb3dubG9hZCBsaW5rcyBhcHBlYXIgb25jZSByZXRyaWV2YWwgY29tcGxldGVzLlxyXG4gICAgICAgIHRoaXMuZmV0Y2hNZWRpYShmaWxlSWQpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGZldGNoTWVkaWEoZmlsZUlkOiBzdHJpbmcpOiB2b2lkIHtcclxuICAgIGlmICghZmlsZUlkIHx8IGZpbGVJZC5zdGFydHNXaXRoKCd0ZW1wLScpIHx8IHRoaXMubWVkaWFMb2FkaW5nLmhhcyhmaWxlSWQpIHx8IHRoaXMubWVkaWFGYWlsZWQuaGFzKGZpbGVJZCkpIHJldHVybjtcclxuICAgIHRoaXMubWVkaWFMb2FkaW5nLmFkZChmaWxlSWQpO1xyXG4gICAgdGhpcy5tZWRpYVF1ZXVlLnB1c2goZmlsZUlkKTtcclxuICAgIHRoaXMucHVtcE1lZGlhUXVldWUoKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgcHVtcE1lZGlhUXVldWUoKTogdm9pZCB7XHJcbiAgICB3aGlsZSAodGhpcy5hY3RpdmVNZWRpYVJlcXVlc3RzIDwgdGhpcy5tYXhNZWRpYVJlcXVlc3RzICYmIHRoaXMubWVkaWFRdWV1ZS5sZW5ndGggPiAwKSB7XHJcbiAgICAgIGNvbnN0IGZpbGVJZCA9IHRoaXMubWVkaWFRdWV1ZS5zaGlmdCgpO1xyXG4gICAgICBpZiAoIWZpbGVJZCkgY29udGludWU7XHJcbiAgICAgIHRoaXMuYWN0aXZlTWVkaWFSZXF1ZXN0cyArPSAxO1xyXG5cclxuICAgICAgdGhpcy5maWxlU2VydmljZS5nZXRGaWxlRGF0YVVybChmaWxlSWQpLnN1YnNjcmliZSh7XHJcbiAgICAgICAgbmV4dDogKCkgPT4ge1xyXG4gICAgICAgICAgdGhpcy5maW5pc2hNZWRpYVJlcXVlc3QoZmlsZUlkKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGVycm9yOiAoKSA9PiB7XHJcbiAgICAgICAgICB0aGlzLm1lZGlhRmFpbGVkLmFkZChmaWxlSWQpO1xyXG4gICAgICAgICAgdGhpcy5maW5pc2hNZWRpYVJlcXVlc3QoZmlsZUlkKTtcclxuICAgICAgICB9LFxyXG4gICAgICB9KTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHByaXZhdGUgZmluaXNoTWVkaWFSZXF1ZXN0KGZpbGVJZDogc3RyaW5nKTogdm9pZCB7XHJcbiAgICB0aGlzLmFjdGl2ZU1lZGlhUmVxdWVzdHMgPSBNYXRoLm1heCgwLCB0aGlzLmFjdGl2ZU1lZGlhUmVxdWVzdHMgLSAxKTtcclxuICAgIHRoaXMubWVkaWFMb2FkaW5nLmRlbGV0ZShmaWxlSWQpO1xyXG4gICAgdGhpcy5jZHIubWFya0ZvckNoZWNrKCk7XHJcbiAgICB0aGlzLnB1bXBNZWRpYVF1ZXVlKCk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHJlc2V0TWVkaWFRdWV1ZSgpOiB2b2lkIHtcclxuICAgIHRoaXMubWVkaWFRdWV1ZSA9IFtdO1xyXG4gICAgdGhpcy5tZWRpYUxvYWRpbmcuY2xlYXIoKTtcclxuICAgIHRoaXMuYWN0aXZlTWVkaWFSZXF1ZXN0cyA9IDA7XHJcbiAgfVxyXG5cclxuICBzaG91bGRTaG93TWVkaWFTcGlubmVyKHRhcmdldDogTWVzc2FnZSB8IEF0dGFjaG1lbnQpOiBib29sZWFuIHtcclxuICAgIGNvbnN0IGZpbGVJZCA9IHRoaXMuZ2V0QXR0YWNobWVudEZpbGVJZCh0YXJnZXQpO1xyXG4gICAgaWYgKCFmaWxlSWQgfHwgZmlsZUlkLnN0YXJ0c1dpdGgoJ3RlbXAtJykpIHJldHVybiBmYWxzZTtcclxuICAgIHJldHVybiB0aGlzLm1lZGlhTG9hZGluZy5oYXMoZmlsZUlkKSAmJiAhdGhpcy5tZWRpYUZhaWxlZC5oYXMoZmlsZUlkKTtcclxuICB9XHJcblxyXG4gIGlzVmlkZW9BdHRhY2htZW50KG1zZzogTWVzc2FnZSwgYXR0YWNobWVudD86IEF0dGFjaG1lbnQpOiBib29sZWFuIHtcclxuICAgIGNvbnN0IG1pbWUgPSBhdHRhY2htZW50Py5taW1lX3R5cGUgfHwgdGhpcy5nZXRQcmltYXJ5QXR0YWNobWVudChtc2cpPy5taW1lX3R5cGUgfHwgJyc7XHJcbiAgICBpZiAobWltZS5zdGFydHNXaXRoKCd2aWRlby8nKSkgcmV0dXJuIHRydWU7XHJcbiAgICBjb25zdCBuYW1lID0gdGhpcy5nZXRGaWxlbmFtZUxpa2UobXNnLCBhdHRhY2htZW50KTtcclxuICAgIHJldHVybiAvXFwuKG1wNHx3ZWJtfG1vdnxtNHZ8YXZpfG1rdikkL2kudGVzdChuYW1lKTtcclxuICB9XHJcblxyXG4gIGdldEF0dGFjaG1lbnRNaW1lVHlwZShtc2c6IE1lc3NhZ2UsIGF0dGFjaG1lbnQ/OiBBdHRhY2htZW50KTogc3RyaW5nIHtcclxuICAgIHJldHVybiBhdHRhY2htZW50Py5taW1lX3R5cGUgfHwgdGhpcy5nZXRQcmltYXJ5QXR0YWNobWVudChtc2cpPy5taW1lX3R5cGUgfHwgJ2FwcGxpY2F0aW9uL29jdGV0LXN0cmVhbSc7XHJcbiAgfVxyXG5cclxuICBnZXRBdHRhY2htZW50TmFtZShtc2c6IE1lc3NhZ2UsIGF0dGFjaG1lbnQ/OiBBdHRhY2htZW50KTogc3RyaW5nIHtcclxuICAgIHJldHVybiBhdHRhY2htZW50Py5maWxlbmFtZSB8fCB0aGlzLmdldFByaW1hcnlBdHRhY2htZW50KG1zZyk/LmZpbGVuYW1lIHx8IG1zZy5jb250ZW50IHx8ICdGaWxlJztcclxuICB9XHJcblxyXG4gIGhhc0ZpbGVBdHRhY2htZW50KG1zZzogTWVzc2FnZSk6IGJvb2xlYW4ge1xyXG4gICAgcmV0dXJuIG1zZy5tZXNzYWdlX3R5cGUgPT09ICdGSUxFJyB8fCB0aGlzLmdldFJlbmRlcmFibGVBdHRhY2htZW50cyhtc2cpLmxlbmd0aCA+IDA7XHJcbiAgfVxyXG5cclxuICBoYXNNZWRpYUZhaWxlZCh0YXJnZXQ6IE1lc3NhZ2UgfCBBdHRhY2htZW50KTogYm9vbGVhbiB7XHJcbiAgICBjb25zdCBmaWxlSWQgPSB0aGlzLmdldEF0dGFjaG1lbnRGaWxlSWQodGFyZ2V0KTtcclxuICAgIHJldHVybiAhIWZpbGVJZCAmJiB0aGlzLm1lZGlhRmFpbGVkLmhhcyhmaWxlSWQpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBnZXRBdHRhY2htZW50RmlsZUlkKHRhcmdldDogTWVzc2FnZSB8IEF0dGFjaG1lbnQpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xyXG4gICAgaWYgKCdmaWxlX2lkJyBpbiB0YXJnZXQpIHJldHVybiB0YXJnZXQuZmlsZV9pZDtcclxuICAgIHJldHVybiB0aGlzLmdldFByaW1hcnlBdHRhY2htZW50KHRhcmdldCk/LmZpbGVfaWQ7XHJcbiAgfVxyXG5cclxuICBnZXRGaWxlSWNvbihtc2c6IE1lc3NhZ2UsIGF0dGFjaG1lbnQ/OiBBdHRhY2htZW50KTogc3RyaW5nIHtcclxuICAgIGNvbnN0IG1pbWUgPSB0aGlzLmdldEF0dGFjaG1lbnRNaW1lVHlwZShtc2csIGF0dGFjaG1lbnQpO1xyXG4gICAgY29uc3QgbmFtZSA9IHRoaXMuZ2V0QXR0YWNobWVudE5hbWUobXNnLCBhdHRhY2htZW50KS50b0xvd2VyQ2FzZSgpO1xyXG4gICAgaWYgKG1pbWUuc3RhcnRzV2l0aCgndmlkZW8vJykgfHwgL1xcLihtcDR8d2VibXxtb3Z8bTR2fGF2aXxta3YpJC9pLnRlc3QobmFtZSkpIHJldHVybiAndmlkZW9jYW0nO1xyXG4gICAgaWYgKG1pbWUuc3RhcnRzV2l0aCgnYXVkaW8vJykgfHwgL1xcLihtcDN8d2F2fG9nZ3xtNGF8ZmxhYykkL2kudGVzdChuYW1lKSkgcmV0dXJuICdhdWRpb3RyYWNrJztcclxuICAgIGlmIChtaW1lLmluY2x1ZGVzKCdwZGYnKSB8fCBuYW1lLmVuZHNXaXRoKCcucGRmJykpIHJldHVybiAncGljdHVyZV9hc19wZGYnO1xyXG4gICAgaWYgKG1pbWUuaW5jbHVkZXMoJ3NwcmVhZHNoZWV0JykgfHwgbWltZS5pbmNsdWRlcygnZXhjZWwnKSB8fCAvXFwuKHhsc3x4bHN4fGNzdikkL2kudGVzdChuYW1lKSkgcmV0dXJuICd0YWJsZV9jaGFydCc7XHJcbiAgICBpZiAobWltZS5pbmNsdWRlcygnZG9jdW1lbnQnKSB8fCBtaW1lLmluY2x1ZGVzKCd3b3JkJykgfHwgL1xcLihkb2N8ZG9jeHx0eHR8cnRmKSQvaS50ZXN0KG5hbWUpKSByZXR1cm4gJ2Rlc2NyaXB0aW9uJztcclxuICAgIGlmIChtaW1lLmluY2x1ZGVzKCd6aXAnKSB8fCAvXFwuKHppcHxyYXJ8N3p8dGFyfGd6KSQvaS50ZXN0KG5hbWUpKSByZXR1cm4gJ2ZvbGRlcl96aXAnO1xyXG4gICAgcmV0dXJuICdpbnNlcnRfZHJpdmVfZmlsZSc7XHJcbiAgfVxyXG5cclxuICBvcGVuTGlnaHRib3goZGF0YVVybDogc3RyaW5nLCBldmVudD86IEV2ZW50KTogdm9pZCB7XHJcbiAgICBldmVudD8uc3RvcFByb3BhZ2F0aW9uKCk7XHJcbiAgICB0aGlzLmxpZ2h0Ym94T3Blbi5lbWl0KGRhdGFVcmwpO1xyXG4gIH1cclxuXHJcbiAgZG93bmxvYWRBdHRhY2htZW50KG1zZzogTWVzc2FnZSwgYXR0YWNobWVudDogQXR0YWNobWVudCwgZXZlbnQ/OiBFdmVudCk6IHZvaWQge1xyXG4gICAgZXZlbnQ/LnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICBldmVudD8uc3RvcFByb3BhZ2F0aW9uKCk7XHJcblxyXG4gICAgY29uc3QgZGlyZWN0VXJsID0gYXR0YWNobWVudC51cmw7XHJcbiAgICBpZiAoZGlyZWN0VXJsICYmIC9eKGh0dHBzPzp8ZGF0YTopL2kudGVzdChkaXJlY3RVcmwpKSB7XHJcbiAgICAgIHRoaXMudHJpZ2dlckRvd25sb2FkKGRpcmVjdFVybCwgdGhpcy5nZXRBdHRhY2htZW50TmFtZShtc2csIGF0dGFjaG1lbnQpKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGZpbGVJZCA9IGF0dGFjaG1lbnQuZmlsZV9pZD8udHJpbSgpO1xyXG4gICAgaWYgKCFmaWxlSWQgfHwgZmlsZUlkLnN0YXJ0c1dpdGgoJ3RlbXAtJykgfHwgZmlsZUlkLnN0YXJ0c1dpdGgoJ3snKSB8fCBmaWxlSWQuc3RhcnRzV2l0aCgnWycpKSB7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBjYWNoZWQgPSB0aGlzLmZpbGVTZXJ2aWNlLmdldENhY2hlZERhdGFVcmwoZmlsZUlkKTtcclxuICAgIGlmIChjYWNoZWQpIHtcclxuICAgICAgdGhpcy50cmlnZ2VyRG93bmxvYWQoY2FjaGVkLCB0aGlzLmdldEF0dGFjaG1lbnROYW1lKG1zZywgYXR0YWNobWVudCkpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5tZWRpYUxvYWRpbmcuYWRkKGZpbGVJZCk7XHJcbiAgICB0aGlzLmZpbGVTZXJ2aWNlLmdldEZpbGVEYXRhVXJsKGZpbGVJZCkuc3Vic2NyaWJlKHtcclxuICAgICAgbmV4dDogKGRhdGFVcmwpID0+IHtcclxuICAgICAgICB0aGlzLm1lZGlhTG9hZGluZy5kZWxldGUoZmlsZUlkKTtcclxuICAgICAgICB0aGlzLnRyaWdnZXJEb3dubG9hZChkYXRhVXJsLCB0aGlzLmdldEF0dGFjaG1lbnROYW1lKG1zZywgYXR0YWNobWVudCkpO1xyXG4gICAgICAgIHRoaXMuY2RyLm1hcmtGb3JDaGVjaygpO1xyXG4gICAgICB9LFxyXG4gICAgICBlcnJvcjogKCkgPT4ge1xyXG4gICAgICAgIHRoaXMubWVkaWFMb2FkaW5nLmRlbGV0ZShmaWxlSWQpO1xyXG4gICAgICAgIHRoaXMubWVkaWFGYWlsZWQuYWRkKGZpbGVJZCk7XHJcbiAgICAgICAgdGhpcy5jZHIubWFya0ZvckNoZWNrKCk7XHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgdHJpZ2dlckRvd25sb2FkKHVybDogc3RyaW5nLCBmaWxlbmFtZTogc3RyaW5nKTogdm9pZCB7XHJcbiAgICBjb25zdCBsaW5rID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYScpO1xyXG4gICAgbGluay5ocmVmID0gdXJsO1xyXG4gICAgbGluay5kb3dubG9hZCA9IGZpbGVuYW1lIHx8ICdhdHRhY2htZW50JztcclxuICAgIGxpbmsudGFyZ2V0ID0gJ19ibGFuayc7XHJcbiAgICBsaW5rLnJlbCA9ICdub29wZW5lcic7XHJcbiAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGxpbmspO1xyXG4gICAgbGluay5jbGljaygpO1xyXG4gICAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZChsaW5rKTtcclxuICB9XHJcblxyXG4gIC8vIOKUgOKUgCBSZWFjdGlvbnMg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcblxyXG4gIG9uRW1vamlTZWxlY3RlZChlbW9qaTogc3RyaW5nLCBtZXNzYWdlSWQ6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgdGhpcy50b2dnbGVSZWFjdGlvbihlbW9qaSwgbWVzc2FnZUlkKTtcclxuICB9XHJcblxyXG4gIHRvZ2dsZVJlYWN0aW9uKGVtb2ppOiBzdHJpbmcsIG1lc3NhZ2VJZDogc3RyaW5nKTogdm9pZCB7XHJcbiAgICBjb25zdCBtc2cgPSB0aGlzLm1lc3NhZ2VzLmZpbmQobSA9PiBtLm1lc3NhZ2VfaWQgPT09IG1lc3NhZ2VJZCk7XHJcbiAgICBpZiAoIW1zZykgcmV0dXJuO1xyXG4gICAgXHJcbiAgICBjb25zdCByZWFjdGlvbiA9IG1zZy5yZWFjdGlvbnM/LmZpbmQociA9PiByLmVtb2ppID09PSBlbW9qaSk7XHJcbiAgICBpZiAocmVhY3Rpb24/Lmhhc1JlYWN0ZWQpIHtcclxuICAgICAgdGhpcy5zdG9yZS5yZW1vdmVSZWFjdGlvbihtZXNzYWdlSWQsIGVtb2ppKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHRoaXMuc3RvcmUuYWRkUmVhY3Rpb24obWVzc2FnZUlkLCBlbW9qaSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBnZXRSZWFjdG9yVG9vbHRpcChyZWFjdGlvbjogYW55KTogc3RyaW5nIHtcclxuICAgIGlmICghcmVhY3Rpb24/LnJlYWN0b3JzPy5sZW5ndGgpIHJldHVybiAnJztcclxuICAgIHJldHVybiByZWFjdGlvbi5yZWFjdG9ycy5qb2luKCcsICcpO1xyXG4gIH1cclxufVxyXG4iXX0=