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
    isProjectSubgroup = false;
    projectDbGid;
    projectGid;
    parentConversationId;
    subgroupSubject;
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
                this.isProjectSubgroup = chat?.isProjectSubgroup || false;
                this.projectDbGid = chat?.dbGid;
                this.projectGid = chat?.projectGid;
                this.parentConversationId = chat?.parentConversationId;
                this.subgroupSubject = chat?.subgroupSubject;
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
            this.store.openGroupSettings(this.conversationId, this.conversationName, this.isProject, this.isProjectSubgroup, this.projectDbGid, this.projectGid, this.parentConversationId, this.subgroupSubject);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdC10aHJlYWQuY29tcG9uZW50LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL2xpYi9jb21wb25lbnRzL2NoYXQtdGhyZWFkL2NoYXQtdGhyZWFkLmNvbXBvbmVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQ0wsU0FBUyxFQUFxQixTQUFTLEVBQUUsWUFBWSxFQUNyRCxNQUFNLEVBQUUsWUFBWSxHQUNyQixNQUFNLGVBQWUsQ0FBQztBQUV2QixPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDL0MsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLHdCQUF3QixDQUFDO0FBQ3ZELE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUMzRCxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUM5RSxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSwyQkFBMkIsQ0FBQztBQUM3RCxPQUFPLEVBQWdCLGFBQWEsRUFBRSxNQUFNLE1BQU0sQ0FBQztBQUtuRCxPQUFPLEVBQXlELHFCQUFxQixFQUFFLG9CQUFvQixFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDbkosT0FBTyxFQUFpQixxQkFBcUIsRUFBb0QsTUFBTSwwQ0FBMEMsQ0FBQzs7Ozs7Ozs7Ozs7O0FBNjhDbEosTUFBTSxPQUFPLG1CQUFtQjtJQWtEcEI7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBdERvQixlQUFlLENBQWM7SUFDbEMsVUFBVSxDQUEyQjtJQUMxQixtQkFBbUIsQ0FBOEM7SUFDbkUsWUFBWSxDQUF5QjtJQUM3RCxZQUFZLEdBQUcsSUFBSSxZQUFZLEVBQVUsQ0FBQztJQUVwRCxRQUFRLEdBQWMsRUFBRSxDQUFDO0lBQ3pCLGVBQWUsR0FBYyxFQUFFLENBQUM7SUFDaEMsZ0JBQWdCLEdBQUcsRUFBRSxDQUFDO0lBQ3RCLE9BQU8sR0FBRyxLQUFLLENBQUM7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Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7R0E0WFQ7b1BBeWtDNkIsZUFBZTtzQkFBNUMsU0FBUzt1QkFBQyxpQkFBaUI7Z0JBQ0gsVUFBVTtzQkFBbEMsU0FBUzt1QkFBQyxZQUFZO2dCQUNhLG1CQUFtQjtzQkFBdEQsWUFBWTt1QkFBQyxvQkFBb0I7Z0JBQ0EsWUFBWTtzQkFBN0MsU0FBUzt1QkFBQyxxQkFBcUI7Z0JBQ3RCLFlBQVk7c0JBQXJCLE1BQU0iLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge1xyXG4gIENvbXBvbmVudCwgT25Jbml0LCBPbkRlc3Ryb3ksIFZpZXdDaGlsZCwgVmlld0NoaWxkcmVuLCBRdWVyeUxpc3QsIEVsZW1lbnRSZWYsIEFmdGVyVmlld0NoZWNrZWQsIENoYW5nZURldGVjdG9yUmVmLFxyXG4gIE91dHB1dCwgRXZlbnRFbWl0dGVyLFxyXG59IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xyXG5pbXBvcnQgeyBEb21TYW5pdGl6ZXIsIFNhZmVIdG1sIH0gZnJvbSAnQGFuZ3VsYXIvcGxhdGZvcm0tYnJvd3Nlcic7XHJcbmltcG9ydCB7IENvbW1vbk1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL2NvbW1vbic7XHJcbmltcG9ydCB7IE1hdEljb25Nb2R1bGUgfSBmcm9tICdAYW5ndWxhci9tYXRlcmlhbC9pY29uJztcclxuaW1wb3J0IHsgTWF0QnV0dG9uTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvbWF0ZXJpYWwvYnV0dG9uJztcclxuaW1wb3J0IHsgTWF0UHJvZ3Jlc3NTcGlubmVyTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvbWF0ZXJpYWwvcHJvZ3Jlc3Mtc3Bpbm5lcic7XHJcbmltcG9ydCB7IE1hdFRvb2x0aXBNb2R1bGUgfSBmcm9tICdAYW5ndWxhci9tYXRlcmlhbC90b29sdGlwJztcclxuaW1wb3J0IHsgU3Vic2NyaXB0aW9uLCBjb21iaW5lTGF0ZXN0IH0gZnJvbSAncnhqcyc7XHJcbmltcG9ydCB7IE1lc3NhZ2luZ1N0b3JlU2VydmljZSB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL21lc3NhZ2luZy1zdG9yZS5zZXJ2aWNlJztcclxuaW1wb3J0IHsgTWVzc2FnaW5nQXBpU2VydmljZSB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL21lc3NhZ2luZy1hcGkuc2VydmljZSc7XHJcbmltcG9ydCB7IE1lc3NhZ2luZ0ZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvbWVzc2FnaW5nLWZpbGUuc2VydmljZSc7XHJcbmltcG9ydCB7IEF1dGhTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvYXV0aC5zZXJ2aWNlJztcclxuaW1wb3J0IHsgQ29udGFjdCwgQ29udmVyc2F0aW9uUGFydGljaXBhbnQsIE1lc3NhZ2UsIEF0dGFjaG1lbnQsIGdldENvbnRhY3REaXNwbGF5TmFtZSwgZ2V0TWVzc2FnZVNlbmRlck5hbWUgfSBmcm9tICcuLi8uLi9tb2RlbHMvbWVzc2FnaW5nLm1vZGVscyc7XHJcbmltcG9ydCB7IE1lbnRpb25PcHRpb24sIE1lc3NhZ2VJbnB1dENvbXBvbmVudCwgTWVzc2FnZVBheWxvYWQsIE1lc3NhZ2VUZXh0UGF5bG9hZCwgUmVwbHlQcmV2aWV3IH0gZnJvbSAnLi4vbWVzc2FnZS1pbnB1dC9tZXNzYWdlLWlucHV0LmNvbXBvbmVudCc7XHJcblxyXG5AQ29tcG9uZW50KHtcclxuICBzZWxlY3RvcjogJ2FwcC1jaGF0LXRocmVhZCcsXHJcbiAgc3RhbmRhbG9uZTogdHJ1ZSxcclxuICBpbXBvcnRzOiBbXHJcbiAgICBDb21tb25Nb2R1bGUsIE1hdEljb25Nb2R1bGUsIE1hdEJ1dHRvbk1vZHVsZSxcclxuICAgIE1hdFByb2dyZXNzU3Bpbm5lck1vZHVsZSwgTWF0VG9vbHRpcE1vZHVsZSwgTWVzc2FnZUlucHV0Q29tcG9uZW50LFxyXG4gIF0sXHJcbiAgdGVtcGxhdGU6IGBcclxuICAgIDxkaXZcclxuICAgICAgI3RocmVhZFJvb3RcclxuICAgICAgY2xhc3M9XCJjaGF0LXRocmVhZFwiXHJcbiAgICAgIFtjbGFzcy5kcmFnLW92ZXJdPVwidGhyZWFkRHJhZ092ZXJcIlxyXG4gICAgICBbc3R5bGUuLS1tZXNzYWdlLXRleHQtc2NhbGVdPVwibWVzc2FnZVRleHRTY2FsZVwiXHJcbiAgICAgIFtzdHlsZS4tLWNvZGUtdGV4dC1zY2FsZV09XCJjb2RlVGV4dFNjYWxlXCJcclxuICAgICAgKGNsaWNrKT1cImNsb3NlTWVzc2FnZUNvbnRleHRNZW51KClcIlxyXG4gICAgICAoZHJhZ2VudGVyKT1cIm9uVGhyZWFkRHJhZ0VudGVyKCRldmVudClcIlxyXG4gICAgICAoZHJhZ292ZXIpPVwib25UaHJlYWREcmFnT3ZlcigkZXZlbnQpXCJcclxuICAgICAgKGRyYWdsZWF2ZSk9XCJvblRocmVhZERyYWdMZWF2ZSgkZXZlbnQpXCJcclxuICAgICAgKGRyb3ApPVwib25UaHJlYWREcm9wKCRldmVudClcIlxyXG4gICAgPlxyXG4gICAgICA8ZGl2IGNsYXNzPVwiY2hhdC1oZWFkZXJcIj5cclxuICAgICAgICA8YnV0dG9uIG1hdC1pY29uLWJ1dHRvbiBjbGFzcz1cImhkci1idG5cIiAoY2xpY2spPVwiZ29CYWNrKClcIiBtYXRUb29sdGlwPVwiQmFja1wiIG1hdFRvb2x0aXBQb3NpdGlvbj1cImJlbG93XCI+XHJcbiAgICAgICAgICA8bWF0LWljb24+YXJyb3dfYmFjazwvbWF0LWljb24+XHJcbiAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgPGRpdiBjbGFzcz1cImhlYWRlci1pbmZvXCI+XHJcbiAgICAgICAgICA8c3BhbiBjbGFzcz1cImNoYXQtbmFtZVwiPnt7IGNvbnZlcnNhdGlvbk5hbWUgfX08L3NwYW4+XHJcbiAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgPGRpdiBjbGFzcz1cImhlYWRlci1hY3Rpb25zXCI+XHJcbiAgICAgICAgICA8YnV0dG9uICpuZ0lmPVwiaXNHcm91cCAmJiAhaXNSZW1vdmVkRnJvbUdyb3VwXCIgbWF0LWljb24tYnV0dG9uIGNsYXNzPVwiaGRyLWJ0blwiIChjbGljayk9XCJvbkdyb3VwU2V0dGluZ3MoKVwiIG1hdFRvb2x0aXA9XCJHcm91cCBzZXR0aW5nc1wiIG1hdFRvb2x0aXBQb3NpdGlvbj1cImJlbG93XCI+XHJcbiAgICAgICAgICAgIDxtYXQtaWNvbj5zZXR0aW5nczwvbWF0LWljb24+XHJcbiAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICA8L2Rpdj5cclxuICAgICAgPC9kaXY+XHJcblxyXG4gICAgICA8ZGl2IGNsYXNzPVwibWVzc2FnZXMtYXJlYVwiICNzY3JvbGxDb250YWluZXIgKHNjcm9sbCk9XCJvblNjcm9sbCgpXCI+XHJcbiAgICAgICAgPGRpdiAqbmdJZj1cInRocmVhZERyYWdPdmVyXCIgY2xhc3M9XCJ0aHJlYWQtZHJhZy1vdmVybGF5XCI+XHJcbiAgICAgICAgICA8bWF0LWljb24+Y2xvdWRfdXBsb2FkPC9tYXQtaWNvbj5cclxuICAgICAgICAgIDxzcGFuPkRyb3AgZmlsZXMgYW55d2hlcmUgaW4gdGhpcyBjaGF0PC9zcGFuPlxyXG4gICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICA8ZGl2ICpuZ0lmPVwiaXNSZW1vdmVkRnJvbUdyb3VwXCIgY2xhc3M9XCJyZW1vdmVkLWdyb3VwLXN0YXRlXCI+XHJcbiAgICAgICAgICA8bWF0LWljb24+YmxvY2s8L21hdC1pY29uPlxyXG4gICAgICAgICAgPGg0PllvdSB3ZXJlIHJlbW92ZWQgZnJvbSB0aGlzIGdyb3VwPC9oND5cclxuICAgICAgICAgIDxwPk1lc3NhZ2VzLCBhdHRhY2htZW50cywgYW5kIGdyb3VwIHNldHRpbmdzIGFyZSBubyBsb25nZXIgYXZhaWxhYmxlLjwvcD5cclxuICAgICAgICAgIDxidXR0b24gdHlwZT1cImJ1dHRvblwiIG1hdC1yYWlzZWQtYnV0dG9uIGNsYXNzPVwicmVtb3ZlZC1leGl0LWJ0blwiIChjbGljayk9XCJleGl0UmVtb3ZlZEdyb3VwKClcIj5cclxuICAgICAgICAgICAgRXhpdCBHcm91cFxyXG4gICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgIDxkaXYgKm5nSWY9XCIhaXNSZW1vdmVkRnJvbUdyb3VwICYmIGxvYWRpbmdcIiBjbGFzcz1cImxvYWRpbmctaW5kaWNhdG9yXCI+XHJcbiAgICAgICAgICA8bWF0LXNwaW5uZXIgZGlhbWV0ZXI9XCIyNFwiPjwvbWF0LXNwaW5uZXI+XHJcbiAgICAgICAgICA8c3Bhbj5Mb2FkaW5nIG1lc3NhZ2VzLi4uPC9zcGFuPlxyXG4gICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICA8YnV0dG9uXHJcbiAgICAgICAgICAqbmdJZj1cIiFpc1JlbW92ZWRGcm9tR3JvdXAgJiYgbWVzc2FnZXMubGVuZ3RoID49IDUwICYmICFsb2FkaW5nXCJcclxuICAgICAgICAgIG1hdC1zdHJva2VkLWJ1dHRvblxyXG4gICAgICAgICAgY2xhc3M9XCJsb2FkLW1vcmUtYnRuXCJcclxuICAgICAgICAgIChjbGljayk9XCJsb2FkT2xkZXIoKVwiXHJcbiAgICAgICAgPlxyXG4gICAgICAgICAgTG9hZCBvbGRlciBtZXNzYWdlc1xyXG4gICAgICAgIDwvYnV0dG9uPlxyXG5cclxuICAgICAgICA8ZGl2ICpuZ0lmPVwiIWlzUmVtb3ZlZEZyb21Hcm91cFwiIGNsYXNzPVwibWVzc2FnZXMtbGlzdFwiPlxyXG4gICAgICAgICAgPG5nLWNvbnRhaW5lciAqbmdGb3I9XCJsZXQgbXNnIG9mIG1lc3NhZ2VzOyBsZXQgaSA9IGluZGV4XCI+XHJcbiAgICAgICAgICAgIDxkaXZcclxuICAgICAgICAgICAgICAqbmdJZj1cInNob3VsZFNob3dEYXRlU2VwYXJhdG9yKGkpXCJcclxuICAgICAgICAgICAgICBjbGFzcz1cImRhdGUtc2VwYXJhdG9yXCJcclxuICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgIDxzcGFuPnt7IGZvcm1hdERhdGUobXNnLmNyZWF0ZWRfYXQpIH19PC9zcGFuPlxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgICAgIDxkaXZcclxuICAgICAgICAgICAgICAqbmdJZj1cImlzU3lzdGVtTWVzc2FnZShtc2cpOyBlbHNlIGNoYXRNZXNzYWdlXCJcclxuICAgICAgICAgICAgICBjbGFzcz1cInN5c3RlbS1tZXNzYWdlLXJvd1wiXHJcbiAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cInN5c3RlbS1tZXNzYWdlLXRleHRcIj57eyBtc2cuY29udGVudCB9fTwvc3Bhbj5cclxuICAgICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgICA8bmctdGVtcGxhdGUgI2NoYXRNZXNzYWdlPlxyXG4gICAgICAgICAgICAgIDxkaXZcclxuICAgICAgICAgICAgICAgIGNsYXNzPVwibWVzc2FnZS1idWJibGUtcm93XCJcclxuICAgICAgICAgICAgICAgIFtjbGFzcy5vd25dPVwiaXNPd25NZXNzYWdlKG1zZylcIlxyXG4gICAgICAgICAgICAgICAgW2NsYXNzLm90aGVyXT1cIiFpc093bk1lc3NhZ2UobXNnKVwiXHJcbiAgICAgICAgICAgICAgICAoY29udGV4dG1lbnUpPVwib3Blbk1lc3NhZ2VDb250ZXh0TWVudShtc2csICRldmVudClcIlxyXG4gICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICA8ZGl2ICpuZ0lmPVwiIWlzT3duTWVzc2FnZShtc2cpXCIgY2xhc3M9XCJzZW5kZXItbmFtZVwiPlxyXG4gICAgICAgICAgICAgICAge3sgZ2V0U2VuZGVyTmFtZShtc2cpIH19XHJcbiAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgPGRpdlxyXG4gICAgICAgICAgICAgICAgY2xhc3M9XCJtZXNzYWdlLWJ1YmJsZVwiXHJcbiAgICAgICAgICAgICAgICBbY2xhc3Mub3duLWJ1YmJsZV09XCJpc093bk1lc3NhZ2UobXNnKVwiXHJcbiAgICAgICAgICAgICAgICAobW91c2VlbnRlcik9XCJob3ZlcmVkTWVzc2FnZUlkID0gbXNnLm1lc3NhZ2VfaWRcIlxyXG4gICAgICAgICAgICAgICAgKG1vdXNlbGVhdmUpPVwiaG92ZXJlZE1lc3NhZ2VJZCA9IG51bGxcIlxyXG4gICAgICAgICAgICAgICAgKGNvbnRleHRtZW51KT1cIm9wZW5NZXNzYWdlQ29udGV4dE1lbnUobXNnLCAkZXZlbnQpXCJcclxuICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICA8ZGl2ICpuZ0lmPVwiZ2V0UmVwbHlQcmV2aWV3KG1zZykgYXMgcmVwbHlcIiBjbGFzcz1cInJlcGx5LWNvbnRleHRcIj5cclxuICAgICAgICAgICAgICAgICAgPG1hdC1pY29uPnJlcGx5PC9tYXQtaWNvbj5cclxuICAgICAgICAgICAgICAgICAgPGRpdj5cclxuICAgICAgICAgICAgICAgICAgICA8c3Bhbj57eyByZXBseS5zZW5kZXJOYW1lIH19PC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgIDxwPnt7IHJlcGx5LmNvbnRlbnQgfX08L3A+XHJcbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICA8IS0tIEFUVEFDSE1FTlRTIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgCAtLT5cclxuICAgICAgICAgICAgICAgIDxkaXYgKm5nSWY9XCJoYXNGaWxlQXR0YWNobWVudChtc2cpXCIgY2xhc3M9XCJhdHRhY2htZW50cy1saXN0XCI+XHJcbiAgICAgICAgICAgICAgICAgIDxkaXYgKm5nRm9yPVwibGV0IGF0dGFjaG1lbnQgb2YgZ2V0UmVuZGVyYWJsZUF0dGFjaG1lbnRzKG1zZyk7IHRyYWNrQnk6IHRyYWNrQnlBdHRhY2htZW50XCIgY2xhc3M9XCJhdHRhY2htZW50LWl0ZW1cIj5cclxuICAgICAgICAgICAgICAgICAgICA8bmctY29udGFpbmVyICpuZ0lmPVwiaXNJbWFnZUF0dGFjaG1lbnQobXNnLCBhdHRhY2htZW50KTsgZWxzZSBub25JbWFnZUF0dGFjaG1lbnRcIj5cclxuICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJpbWFnZS1tZXNzYWdlXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxuZy1jb250YWluZXIgKm5nSWY9XCJnZXRNZWRpYVVybChtc2csIGF0dGFjaG1lbnQpIGFzIGRhdGFVcmw7IGVsc2UgaW1nRmFsbGJhY2tcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwibWVkaWEtd3JhcHBlclwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPGltZ1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBbc3JjXT1cImRhdGFVcmxcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhbHQ9XCJJbWFnZVwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzPVwibWVkaWEtaW1nXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKG1vdXNlZG93bik9XCIkZXZlbnQuc3RvcFByb3BhZ2F0aW9uKClcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAoY2xpY2spPVwib3BlbkxpZ2h0Ym94KGRhdGFVcmwsICRldmVudClcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLz5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJhdHRhY2htZW50LWFjdGlvbnNcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzPVwiYXR0YWNobWVudC1hY3Rpb24tYnRuXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAoY2xpY2spPVwib3BlbkxpZ2h0Ym94KGRhdGFVcmwsICRldmVudClcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRpdGxlPVwiT3BlbiBpbWFnZVwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8bWF0LWljb24+b3Blbl9pbl9mdWxsPC9tYXQtaWNvbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxidXR0b25cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbGFzcz1cImF0dGFjaG1lbnQtYWN0aW9uLWJ0blwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKGNsaWNrKT1cImRvd25sb2FkQXR0YWNobWVudChtc2csIGF0dGFjaG1lbnQsICRldmVudClcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRpdGxlPVwiRG93bmxvYWQgaW1hZ2VcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPG1hdC1pY29uPmRvd25sb2FkPC9tYXQtaWNvbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPC9uZy1jb250YWluZXI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxuZy10ZW1wbGF0ZSAjaW1nRmFsbGJhY2s+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiAqbmdJZj1cInNob3VsZFNob3dNZWRpYVNwaW5uZXIoYXR0YWNobWVudCk7IGVsc2UgaW1nQXNGaWxlXCIgY2xhc3M9XCJtZWRpYS1wbGFjZWhvbGRlclwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPG1hdC1zcGlubmVyIGRpYW1ldGVyPVwiMjJcIj48L21hdC1zcGlubmVyPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxuZy10ZW1wbGF0ZSAjaW1nQXNGaWxlPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZpbGUtbWVzc2FnZVwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8bWF0LWljb24gY2xhc3M9XCJmaWxlLW1zZy1pY29uXCI+aW1hZ2U8L21hdC1pY29uPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cImZpbGUtbXNnLW5hbWVcIj57eyBnZXRBdHRhY2htZW50TmFtZShtc2csIGF0dGFjaG1lbnQpIH19PC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPC9uZy10ZW1wbGF0ZT5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPC9uZy10ZW1wbGF0ZT5cclxuICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgIDwvbmctY29udGFpbmVyPlxyXG5cclxuICAgICAgICAgICAgICAgICAgICA8bmctdGVtcGxhdGUgI25vbkltYWdlQXR0YWNobWVudD5cclxuICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmaWxlLW1lc3NhZ2UgYXR0YWNobWVudC10aHVtYlwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8YnV0dG9uXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZT1cImJ1dHRvblwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3M9XCJmaWxlLWRvd25sb2FkLWJ0blwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgKGNsaWNrKT1cImRvd25sb2FkQXR0YWNobWVudChtc2csIGF0dGFjaG1lbnQsICRldmVudClcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHRpdGxlPVwiRG93bmxvYWQgZmlsZVwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8bWF0LWljb24gY2xhc3M9XCJmaWxlLWRvd25sb2FkLWljb25cIj5kb3dubG9hZDwvbWF0LWljb24+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8bWF0LWljb24gY2xhc3M9XCJmaWxlLW1zZy1pY29uXCI+e3sgZ2V0RmlsZUljb24obXNnLCBhdHRhY2htZW50KSB9fTwvbWF0LWljb24+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwiZmlsZS1tc2ctbmFtZVwiIFt0aXRsZV09XCJnZXRBdHRhY2htZW50TmFtZShtc2csIGF0dGFjaG1lbnQpXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAge3sgZ2V0QXR0YWNobWVudE5hbWUobXNnLCBhdHRhY2htZW50KSB9fVxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxidXR0b25cclxuICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICBjbGFzcz1cImZpbGUtZG93bmxvYWQtbGlua1wiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgKGNsaWNrKT1cImRvd25sb2FkQXR0YWNobWVudChtc2csIGF0dGFjaG1lbnQsICRldmVudClcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHRpdGxlPVwiRG93bmxvYWQgZmlsZVwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICBEb3dubG9hZFxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgIDwvbmctdGVtcGxhdGU+XHJcbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICA8ZGl2XHJcbiAgICAgICAgICAgICAgICAgICpuZ0lmPVwiaGFzRmlsZUF0dGFjaG1lbnQobXNnKSAmJiBnZXRNZXNzYWdlQ2FwdGlvbihtc2cpXCJcclxuICAgICAgICAgICAgICAgICAgY2xhc3M9XCJhdHRhY2htZW50LWNhcHRpb25cIlxyXG4gICAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgICA8ZGl2ICpuZ0lmPVwiaXNDb2RlQ29udGVudChnZXRNZXNzYWdlQ2FwdGlvbihtc2cpLCBtc2cpOyBlbHNlIG5vbkNvZGVDYXB0aW9uXCIgY2xhc3M9XCJjb2RlLW1lc3NhZ2Utd3JhcCBhdHRhY2htZW50LXJlbmRlci1ibG9ja1wiPlxyXG4gICAgICAgICAgICAgICAgICAgIDxidXR0b24gdHlwZT1cImJ1dHRvblwiIGNsYXNzPVwicmVuZGVyLWNvcHktYnRuXCIgKGNsaWNrKT1cImNvcHlUZXh0VmFsdWUoZ2V0TWVzc2FnZUNhcHRpb24obXNnKSwgJGV2ZW50KVwiIHRpdGxlPVwiQ29weSBjb2RlXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8bWF0LWljb24+Y29udGVudF9jb3B5PC9tYXQtaWNvbj5cclxuICAgICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgICAgICAgICAgICA8cHJlIGNsYXNzPVwiY29kZS1tZXNzYWdlXCI+PGNvZGUgW2lubmVySFRNTF09XCJnZXRIaWdobGlnaHRlZENvZGVDb250ZW50KGdldE1lc3NhZ2VDYXB0aW9uKG1zZykpXCI+PC9jb2RlPjwvcHJlPlxyXG4gICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwiY29kZS1sYW5ndWFnZVwiPnt7IGdldENvZGVMYW5ndWFnZUNvbnRlbnQoZ2V0TWVzc2FnZUNhcHRpb24obXNnKSkgfX08L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICA8bmctdGVtcGxhdGUgI25vbkNvZGVDYXB0aW9uPlxyXG4gICAgICAgICAgICAgICAgICAgIDxkaXYgKm5nSWY9XCJpc01hcmtkb3duQ29udGVudChnZXRNZXNzYWdlQ2FwdGlvbihtc2cpKTsgZWxzZSBwbGFpbkNhcHRpb25cIiBjbGFzcz1cIm1kLW1lc3NhZ2Utd3JhcCBhdHRhY2htZW50LXJlbmRlci1ibG9ja1wiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPGJ1dHRvbiB0eXBlPVwiYnV0dG9uXCIgY2xhc3M9XCJyZW5kZXItY29weS1idG5cIiAoY2xpY2spPVwiY29weVRleHRWYWx1ZShnZXRNZXNzYWdlQ2FwdGlvbihtc2cpLCAkZXZlbnQpXCIgdGl0bGU9XCJDb3B5IG1hcmtkb3duXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxtYXQtaWNvbj5jb250ZW50X2NvcHk8L21hdC1pY29uPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwibWQtbWVzc2FnZVwiIFtpbm5lckhUTUxdPVwiZ2V0TWFya2Rvd25IdG1sQ29udGVudChnZXRNZXNzYWdlQ2FwdGlvbihtc2cpKVwiPjwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJtZC1sYW5ndWFnZVwiPm1kPC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgIDxuZy10ZW1wbGF0ZSAjcGxhaW5DYXB0aW9uPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPGRpdlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjbGFzcz1cInRleHQtY29udGVudFwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIFtjbGFzcy5wcmVmb3JtYXR0ZWQtdGV4dF09XCJpc1ByZWZvcm1hdHRlZENvbnRlbnQoZ2V0TWVzc2FnZUNhcHRpb24obXNnKSlcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICB7eyBnZXRNZXNzYWdlQ2FwdGlvbihtc2cpIH19XHJcbiAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICA8L25nLXRlbXBsYXRlPlxyXG4gICAgICAgICAgICAgICAgICA8L25nLXRlbXBsYXRlPlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICA8bmctY29udGFpbmVyICpuZ0lmPVwibXNnLm1lc3NhZ2VfdHlwZSA9PT0gJ1RFWFQnICYmICFoYXNGaWxlQXR0YWNobWVudChtc2cpXCI+XHJcbiAgICAgICAgICAgICAgICAgIDxuZy1jb250YWluZXIgKm5nSWY9XCJpc0VkaXRpbmdNZXNzYWdlKG1zZyk7IGVsc2UgdGV4dE1lc3NhZ2VSZW5kZXJcIj5cclxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiaW5saW5lLWVkaXQtd3JhcFwiIChjbGljayk9XCIkZXZlbnQuc3RvcFByb3BhZ2F0aW9uKClcIiAoY29udGV4dG1lbnUpPVwiJGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8dGV4dGFyZWFcclxuICAgICAgICAgICAgICAgICAgICAgICAgI2lubGluZUVkaXRUZXh0YXJlYVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjbGFzcz1cImlubGluZS1lZGl0LXRleHRhcmVhXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgW3ZhbHVlXT1cImVkaXRpbmdEcmFmdFwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIChpbnB1dCk9XCJvbklubGluZUVkaXRJbnB1dCgkZXZlbnQpXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgKGtleWRvd24pPVwib25JbmxpbmVFZGl0S2V5ZG93bigkZXZlbnQpXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgcm93cz1cIjJcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgPjwvdGV4dGFyZWE+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiaW5saW5lLWVkaXQtYWN0aW9uc1wiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8YnV0dG9uIHR5cGU9XCJidXR0b25cIiBjbGFzcz1cImlubGluZS1lZGl0LWNhbmNlbFwiIChjbGljayk9XCJjYW5jZWxJbmxpbmVFZGl0KCRldmVudClcIj5DYW5jZWw8L2J1dHRvbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzPVwiaW5saW5lLWVkaXQtc2F2ZVwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgW2Rpc2FibGVkXT1cIiFjYW5TYXZlSW5saW5lRWRpdCgpXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAoY2xpY2spPVwic2F2ZUlubGluZUVkaXQoJGV2ZW50KVwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICBTYXZlXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgIDwvbmctY29udGFpbmVyPlxyXG4gICAgICAgICAgICAgICAgICA8bmctdGVtcGxhdGUgI3RleHRNZXNzYWdlUmVuZGVyPlxyXG4gICAgICAgICAgICAgICAgICAgIDxkaXYgKm5nSWY9XCJpc0NvZGVUZXh0KG1zZyk7IGVsc2Ugbm9uQ29kZVRleHRNZXNzYWdlXCIgY2xhc3M9XCJjb2RlLW1lc3NhZ2Utd3JhcFwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPGJ1dHRvbiB0eXBlPVwiYnV0dG9uXCIgY2xhc3M9XCJyZW5kZXItY29weS1idG5cIiAoY2xpY2spPVwiY29weUNvZGUobXNnLCAkZXZlbnQpXCIgdGl0bGU9XCJDb3B5IGNvZGVcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPG1hdC1pY29uPmNvbnRlbnRfY29weTwvbWF0LWljb24+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgICAgICAgICAgICAgIDxwcmUgY2xhc3M9XCJjb2RlLW1lc3NhZ2VcIj48Y29kZSBbaW5uZXJIVE1MXT1cImdldEhpZ2hsaWdodGVkQ29kZShtc2cpXCI+PC9jb2RlPjwvcHJlPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJjb2RlLWxhbmd1YWdlXCI+e3sgZ2V0Q29kZUxhbmd1YWdlKG1zZykgfX08L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgPG5nLXRlbXBsYXRlICNub25Db2RlVGV4dE1lc3NhZ2U+XHJcbiAgICAgICAgICAgICAgICAgICAgPGRpdiAqbmdJZj1cImlzVGFibGVUZXh0KG1zZyk7IGVsc2UgcGxhaW5UZXh0TWVzc2FnZVwiIGNsYXNzPVwidGFibGUtbWVzc2FnZS13cmFwXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8YnV0dG9uIHR5cGU9XCJidXR0b25cIiBjbGFzcz1cInJlbmRlci1jb3B5LWJ0blwiIChjbGljayk9XCJjb3B5TWVzc2FnZVRleHQobXNnLCAkZXZlbnQpXCIgdGl0bGU9XCJDb3B5IHRhYmxlXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxtYXQtaWNvbj5jb250ZW50X2NvcHk8L21hdC1pY29uPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8dGFibGUgY2xhc3M9XCJwYXN0ZWQtdGFibGVcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRib2R5PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDx0ciAqbmdGb3I9XCJsZXQgcm93IG9mIGdldFRhYmxlUm93cyhtc2cpOyBsZXQgcm93SW5kZXggPSBpbmRleFwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPG5nLWNvbnRhaW5lciAqbmdGb3I9XCJsZXQgY2VsbCBvZiByb3dcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRoICpuZ0lmPVwicm93SW5kZXggPT09IDA7IGVsc2UgdGFibGVDZWxsXCI+e3sgY2VsbCB9fTwvdGg+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxuZy10ZW1wbGF0ZSAjdGFibGVDZWxsPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD57eyBjZWxsIH19PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9uZy10ZW1wbGF0ZT5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvbmctY29udGFpbmVyPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDwvdHI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDwvdGJvZHk+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8L3RhYmxlPlxyXG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgIDxuZy10ZW1wbGF0ZSAjcGxhaW5UZXh0TWVzc2FnZT5cclxuICAgICAgICAgICAgICAgICAgICAgIDxkaXYgKm5nSWY9XCJpc01hcmtkb3duVGV4dChtc2cpOyBlbHNlIHJhd1RleHRNZXNzYWdlXCIgY2xhc3M9XCJtZC1tZXNzYWdlLXdyYXBcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPGJ1dHRvbiB0eXBlPVwiYnV0dG9uXCIgY2xhc3M9XCJyZW5kZXItY29weS1idG5cIiAoY2xpY2spPVwiY29weU1lc3NhZ2VUZXh0KG1zZywgJGV2ZW50KVwiIHRpdGxlPVwiQ29weSBtYXJrZG93blwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxtYXQtaWNvbj5jb250ZW50X2NvcHk8L21hdC1pY29uPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cIm1kLW1lc3NhZ2VcIiBbaW5uZXJIVE1MXT1cImdldE1hcmtkb3duSHRtbChtc2cpXCI+PC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwibWQtbGFuZ3VhZ2VcIj5tZDwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgPG5nLXRlbXBsYXRlICNyYXdUZXh0TWVzc2FnZT5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPGRpdlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzPVwidGV4dC1jb250ZW50XCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICBbY2xhc3MucHJlZm9ybWF0dGVkLXRleHRdPVwiaXNQcmVmb3JtYXR0ZWRUZXh0KG1zZylcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAge3sgZ2V0TWVzc2FnZUJvZHkobXNnKSB9fVxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgIDwvbmctdGVtcGxhdGU+XHJcbiAgICAgICAgICAgICAgICAgICAgPC9uZy10ZW1wbGF0ZT5cclxuICAgICAgICAgICAgICAgICAgICA8L25nLXRlbXBsYXRlPlxyXG4gICAgICAgICAgICAgICAgICA8L25nLXRlbXBsYXRlPlxyXG4gICAgICAgICAgICAgICAgPC9uZy1jb250YWluZXI+XHJcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwibWVzc2FnZS1tZXRhXCI+XHJcbiAgICAgICAgICAgICAgICAgIDxzcGFuICpuZ0lmPVwibXNnLmVkaXRlZF9hdCAmJiAhaXNEZWxldGVkTWVzc2FnZShtc2cpXCIgY2xhc3M9XCJlZGl0ZWQtbGFiZWxcIj5lZGl0ZWQ8L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwibXNnLXRpbWVcIj57eyBmb3JtYXRUaW1lKG1zZy5jcmVhdGVkX2F0KSB9fTwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgPG1hdC1pY29uXHJcbiAgICAgICAgICAgICAgICAgICAgKm5nSWY9XCJpc093bk1lc3NhZ2UobXNnKSAmJiBpc01lc3NhZ2VSZWFkKG1zZylcIlxyXG4gICAgICAgICAgICAgICAgICAgIGNsYXNzPVwicmVhZC1pY29uIHJlYWRcIlxyXG4gICAgICAgICAgICAgICAgICAgIFttYXRUb29sdGlwXT1cImdldFJlYWRUb29sdGlwKG1zZylcIlxyXG4gICAgICAgICAgICAgICAgICAgIG1hdFRvb2x0aXBQb3NpdGlvbj1cImFib3ZlXCJcclxuICAgICAgICAgICAgICAgICAgPmRvbmVfYWxsPC9tYXQtaWNvbj5cclxuICAgICAgICAgICAgICAgICAgPG1hdC1pY29uXHJcbiAgICAgICAgICAgICAgICAgICAgKm5nSWY9XCJpc093bk1lc3NhZ2UobXNnKSAmJiAhaXNNZXNzYWdlUmVhZChtc2cpXCJcclxuICAgICAgICAgICAgICAgICAgICBjbGFzcz1cInJlYWQtaWNvbiB1bnJlYWRcIlxyXG4gICAgICAgICAgICAgICAgICAgIG1hdFRvb2x0aXA9XCJTZW50XCJcclxuICAgICAgICAgICAgICAgICAgICBtYXRUb29sdGlwUG9zaXRpb249XCJhYm92ZVwiXHJcbiAgICAgICAgICAgICAgICAgID5kb25lPC9tYXQtaWNvbj5cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgPGRpdiAqbmdJZj1cImhvdmVyZWRNZXNzYWdlSWQgPT09IG1zZy5tZXNzYWdlX2lkICYmICFpc0RlbGV0ZWRNZXNzYWdlKG1zZylcIiBjbGFzcz1cInF1aWNrLXJlYWN0aW9uc1wiPlxyXG4gICAgICAgICAgICAgICAgICA8YnV0dG9uXHJcbiAgICAgICAgICAgICAgICAgICAgKm5nRm9yPVwibGV0IGVtb2ppIG9mIHF1aWNrRW1vamlzXCJcclxuICAgICAgICAgICAgICAgICAgICBjbGFzcz1cInF1aWNrLWVtb2ppLWJ0blwiXHJcbiAgICAgICAgICAgICAgICAgICAgKGNsaWNrKT1cIm9uRW1vamlTZWxlY3RlZChlbW9qaSwgbXNnLm1lc3NhZ2VfaWQpXCJcclxuICAgICAgICAgICAgICAgICAgICBbYXR0ci5hcmlhLWxhYmVsXT1cIidSZWFjdCB3aXRoICcgKyBlbW9qaVwiXHJcbiAgICAgICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgICAgICB7eyBlbW9qaSB9fVxyXG4gICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgPGRpdiAqbmdJZj1cIiFpc0RlbGV0ZWRNZXNzYWdlKG1zZykgJiYgbXNnLnJlYWN0aW9ucyAmJiBtc2cucmVhY3Rpb25zLmxlbmd0aCA+IDBcIiBjbGFzcz1cInJlYWN0aW9ucy1yb3dcIj5cclxuICAgICAgICAgICAgICAgICAgPGJ1dHRvbiBcclxuICAgICAgICAgICAgICAgICAgICAqbmdGb3I9XCJsZXQgciBvZiBtc2cucmVhY3Rpb25zXCIgXHJcbiAgICAgICAgICAgICAgICAgICAgY2xhc3M9XCJyZWFjdGlvbi1jaGlwXCJcclxuICAgICAgICAgICAgICAgICAgICAoY2xpY2spPVwidG9nZ2xlUmVhY3Rpb24oci5lbW9qaSwgbXNnLm1lc3NhZ2VfaWQpXCJcclxuICAgICAgICAgICAgICAgICAgICBbY2xhc3Mub3duLXJlYWN0aW9uXT1cInIuaGFzUmVhY3RlZFwiXHJcbiAgICAgICAgICAgICAgICAgICAgW21hdFRvb2x0aXBdPVwiZ2V0UmVhY3RvclRvb2x0aXAocilcIlxyXG4gICAgICAgICAgICAgICAgICAgIG1hdFRvb2x0aXBQb3NpdGlvbj1cImFib3ZlXCJcclxuICAgICAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwicmVhY3Rpb24tZW1vamlcIj57eyByLmVtb2ppIH19PC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwicmVhY3Rpb24tY291bnRcIj57eyByLmNvdW50IH19PC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICA8L25nLXRlbXBsYXRlPlxyXG4gICAgICAgICAgPC9uZy1jb250YWluZXI+XHJcbiAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgIDxkaXYgKm5nSWY9XCIhaXNSZW1vdmVkRnJvbUdyb3VwICYmIG1lc3NhZ2VzLmxlbmd0aCA9PT0gMCAmJiAhbG9hZGluZ1wiIGNsYXNzPVwiZW1wdHktY2hhdFwiPlxyXG4gICAgICAgICAgPG1hdC1pY29uPmNoYXRfYnViYmxlX291dGxpbmU8L21hdC1pY29uPlxyXG4gICAgICAgICAgPHA+Tm8gbWVzc2FnZXMgeWV0LiBTYXkgaGVsbG8hPC9wPlxyXG4gICAgICAgIDwvZGl2PlxyXG4gICAgICA8L2Rpdj5cclxuXHJcbiAgICAgIDxkaXZcclxuICAgICAgICAqbmdJZj1cIm1lc3NhZ2VDb250ZXh0TWVudSBhcyBtZW51XCJcclxuICAgICAgICBjbGFzcz1cIm1lc3NhZ2UtY29udGV4dC1tZW51XCJcclxuICAgICAgICBbc3R5bGUubGVmdC5weF09XCJtZW51LnhcIlxyXG4gICAgICAgIFtzdHlsZS50b3AucHhdPVwibWVudS55XCJcclxuICAgICAgICAoY2xpY2spPVwiJGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpXCJcclxuICAgICAgICAoY29udGV4dG1lbnUpPVwiJGV2ZW50LnByZXZlbnREZWZhdWx0KClcIlxyXG4gICAgICA+XHJcbiAgICAgICAgPG5nLWNvbnRhaW5lciAqbmdJZj1cIiFtZW51LmNvbmZpcm1EZWxldGU7IGVsc2UgZGVsZXRlQ29uZmlybU1lbnVcIj5cclxuICAgICAgICAgIDxidXR0b25cclxuICAgICAgICAgICAgKm5nSWY9XCJjYW5SZXBseU1lc3NhZ2UobWVudS5tZXNzYWdlKVwiXHJcbiAgICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxyXG4gICAgICAgICAgICBjbGFzcz1cImNvbnRleHQtbWVudS1pdGVtXCJcclxuICAgICAgICAgICAgKGNsaWNrKT1cInJlcGx5RnJvbUNvbnRleHRNZW51KClcIlxyXG4gICAgICAgICAgPlxyXG4gICAgICAgICAgICA8bWF0LWljb24+cmVwbHk8L21hdC1pY29uPlxyXG4gICAgICAgICAgICA8c3Bhbj5SZXBseTwvc3Bhbj5cclxuICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgICAqbmdJZj1cImNhbkVkaXRNZXNzYWdlKG1lbnUubWVzc2FnZSlcIlxyXG4gICAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcclxuICAgICAgICAgICAgY2xhc3M9XCJjb250ZXh0LW1lbnUtaXRlbVwiXHJcbiAgICAgICAgICAgIChjbGljayk9XCJlZGl0RnJvbUNvbnRleHRNZW51KClcIlxyXG4gICAgICAgICAgPlxyXG4gICAgICAgICAgICA8bWF0LWljb24+ZWRpdDwvbWF0LWljb24+XHJcbiAgICAgICAgICAgIDxzcGFuPkVkaXQ8L3NwYW4+XHJcbiAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgIDxidXR0b25cclxuICAgICAgICAgICAgKm5nSWY9XCJjYW5EZWxldGVNZXNzYWdlKG1lbnUubWVzc2FnZSlcIlxyXG4gICAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcclxuICAgICAgICAgICAgY2xhc3M9XCJjb250ZXh0LW1lbnUtaXRlbSBkYW5nZXJcIlxyXG4gICAgICAgICAgICAoY2xpY2spPVwicmVxdWVzdERlbGV0ZUZyb21Db250ZXh0TWVudSgpXCJcclxuICAgICAgICAgID5cclxuICAgICAgICAgICAgPG1hdC1pY29uPmRlbGV0ZTwvbWF0LWljb24+XHJcbiAgICAgICAgICAgIDxzcGFuPkRlbGV0ZTwvc3Bhbj5cclxuICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgIDwvbmctY29udGFpbmVyPlxyXG4gICAgICAgIDxuZy10ZW1wbGF0ZSAjZGVsZXRlQ29uZmlybU1lbnU+XHJcbiAgICAgICAgICA8ZGl2IGNsYXNzPVwiY29udGV4dC1tZW51LWNvbmZpcm1cIj5cclxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cImNvbmZpcm0tdGl0bGVcIj5EZWxldGUgdGhpcyBtZXNzYWdlPzwvZGl2PlxyXG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwiY29uZmlybS1hY3Rpb25zXCI+XHJcbiAgICAgICAgICAgICAgPGJ1dHRvbiB0eXBlPVwiYnV0dG9uXCIgY2xhc3M9XCJjb25maXJtLWNhbmNlbFwiIChjbGljayk9XCJjbG9zZU1lc3NhZ2VDb250ZXh0TWVudSgpXCI+Q2FuY2VsPC9idXR0b24+XHJcbiAgICAgICAgICAgICAgPGJ1dHRvbiB0eXBlPVwiYnV0dG9uXCIgY2xhc3M9XCJjb25maXJtLWRlbGV0ZVwiIChjbGljayk9XCJjb25maXJtRGVsZXRlRnJvbUNvbnRleHRNZW51KClcIj5EZWxldGU8L2J1dHRvbj5cclxuICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICA8L25nLXRlbXBsYXRlPlxyXG4gICAgICA8L2Rpdj5cclxuXHJcbiAgICAgIDxhcHAtbWVzc2FnZS1pbnB1dFxyXG4gICAgICAgICpuZ0lmPVwiIWlzUmVtb3ZlZEZyb21Hcm91cFwiXHJcbiAgICAgICAgW2NvbnZlcnNhdGlvbklkXT1cImNvbnZlcnNhdGlvbklkXCJcclxuICAgICAgICBbcmVwbHlUb109XCJyZXBseVRvTWVzc2FnZSA/IGdldENvbXBvc2VSZXBseVByZXZpZXcocmVwbHlUb01lc3NhZ2UpIDogbnVsbFwiXHJcbiAgICAgICAgW2VuYWJsZU1lbnRpb25zXT1cImlzR3JvdXBcIlxyXG4gICAgICAgIFttZW50aW9uT3B0aW9uc109XCJtZW50aW9uT3B0aW9uc1wiXHJcbiAgICAgICAgKG1lc3NhZ2VTZW50KT1cIm9uU2VuZE1lc3NhZ2UoJGV2ZW50KVwiXHJcbiAgICAgICAgKG1lc3NhZ2VXaXRoRmlsZXMpPVwib25TZW5kV2l0aEZpbGVzKCRldmVudClcIlxyXG4gICAgICAgIChyZXBseUNhbmNlbGxlZCk9XCJjbGVhclJlcGx5KClcIlxyXG4gICAgICA+PC9hcHAtbWVzc2FnZS1pbnB1dD5cclxuICAgIDwvZGl2PlxyXG5cclxuICBgLFxyXG4gIHN0eWxlczogW2BcclxuICAgIDpob3N0IHtcclxuICAgICAgLS1hdHRhY2htZW50LXRodW1iLXNpemU6IDE4MHB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5jaGF0LXRocmVhZCB7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XHJcbiAgICAgIGhlaWdodDogMTAwJTtcclxuICAgICAgYmFja2dyb3VuZDogIzA0MTMyMjtcclxuICAgICAgcG9zaXRpb246IHJlbGF0aXZlO1xyXG4gICAgICBjb250YWluZXItdHlwZTogaW5saW5lLXNpemU7XHJcbiAgICAgIC0tYXR0YWNobWVudC10aHVtYi1zaXplOiBjbGFtcCgxMjBweCwgNDhjcXcsIDE4MHB4KTtcclxuICAgIH1cclxuXHJcbiAgICAuY2hhdC10aHJlYWQuZHJhZy1vdmVyIHtcclxuICAgICAgb3V0bGluZTogMnB4IGRhc2hlZCByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNDUpO1xyXG4gICAgICBvdXRsaW5lLW9mZnNldDogLTZweDtcclxuICAgIH1cclxuXHJcbiAgICAudGhyZWFkLWRyYWctb3ZlcmxheSB7XHJcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcclxuICAgICAgaW5zZXQ6IDhweDtcclxuICAgICAgei1pbmRleDogMjA7XHJcbiAgICAgIHBvaW50ZXItZXZlbnRzOiBub25lO1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcclxuICAgICAgZ2FwOiA4cHg7XHJcbiAgICAgIGNvbG9yOiAjZmZmO1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDMxLCA3NSwgMjE2LCAwLjMyKTtcclxuICAgICAgYm9yZGVyOiAycHggZGFzaGVkIHJnYmEoMjU1LCAyNTUsIDI1NSwgMC41NSk7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDE0cHg7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTRweDtcclxuICAgICAgZm9udC13ZWlnaHQ6IDYwMDtcclxuICAgIH1cclxuXHJcbiAgICAudGhyZWFkLWRyYWctb3ZlcmxheSBtYXQtaWNvbiB7XHJcbiAgICAgIGZvbnQtc2l6ZTogMzZweDtcclxuICAgICAgd2lkdGg6IDM2cHg7XHJcbiAgICAgIGhlaWdodDogMzZweDtcclxuICAgIH1cclxuXHJcbiAgICAuY2hhdC1oZWFkZXIge1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBwYWRkaW5nOiA4cHggOHB4IDhweCA0cHg7XHJcbiAgICAgIGJvcmRlci1ib3R0b206IDFweCBzb2xpZCByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMTUpO1xyXG4gICAgICBnYXA6IDRweDtcclxuICAgICAgZmxleC1zaHJpbms6IDA7XHJcbiAgICB9XHJcblxyXG4gICAgLmNoYXQtaGVhZGVyIGJ1dHRvbiBtYXQtaWNvbiB7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuOCk7XHJcbiAgICB9XHJcblxyXG4gICAgLmNoYXQtbmFtZSB7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTZweDtcclxuICAgICAgZm9udC13ZWlnaHQ6IDYwMDtcclxuICAgICAgY29sb3I6ICNmZmY7XHJcbiAgICB9XHJcblxyXG4gICAgLmhlYWRlci1pbmZvIHtcclxuICAgICAgZmxleDogMTtcclxuICAgICAgd2hpdGUtc3BhY2U6IG5vd3JhcDtcclxuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcclxuICAgICAgdGV4dC1vdmVyZmxvdzogZWxsaXBzaXM7XHJcbiAgICAgIGRpc3BsYXk6IGJsb2NrO1xyXG4gICAgICBwYWRkaW5nOiAwIDRweDtcclxuICAgIH1cclxuXHJcbiAgICAuaGVhZGVyLWFjdGlvbnMge1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBnYXA6IDA7XHJcbiAgICB9XHJcblxyXG4gICAgLmhlYWRlci1hY3Rpb25zIGJ1dHRvbiB7XHJcbiAgICAgIHdpZHRoOiAzMnB4O1xyXG4gICAgICBoZWlnaHQ6IDMycHg7XHJcbiAgICAgIG1pbi13aWR0aDogMzJweCAhaW1wb3J0YW50O1xyXG4gICAgICBwYWRkaW5nOiAwICFpbXBvcnRhbnQ7XHJcbiAgICAgIGRpc3BsYXk6IGlubGluZS1mbGV4ICFpbXBvcnRhbnQ7XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXIgIWltcG9ydGFudDtcclxuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXIgIWltcG9ydGFudDtcclxuICAgICAgLS1tZGMtaWNvbi1idXR0b24tc3RhdGUtbGF5ZXItc2l6ZTogMzJweDtcclxuICAgIH1cclxuXHJcbiAgICAuaGRyLWJ0biB7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDZweCAhaW1wb3J0YW50O1xyXG4gICAgICB0cmFuc2l0aW9uOiBiYWNrZ3JvdW5kIDAuMTVzLCBib3gtc2hhZG93IDAuMTVzO1xyXG4gICAgfVxyXG5cclxuICAgIC5oZHItYnRuOmhvdmVyIHtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjE1KSAhaW1wb3J0YW50O1xyXG4gICAgICBib3gtc2hhZG93OiAwIDJweCA4cHggcmdiYSgwLCAwLCAwLCAwLjIpO1xyXG4gICAgfVxyXG5cclxuICAgIC5oZHItYnRuIG1hdC1pY29uIHtcclxuICAgICAgZm9udC1zaXplOiAyMHB4O1xyXG4gICAgICB3aWR0aDogMjBweDtcclxuICAgICAgaGVpZ2h0OiAyMHB4O1xyXG4gICAgICBsaW5lLWhlaWdodDogMjBweDtcclxuICAgICAgbWFyZ2luOiAwO1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcclxuICAgIH1cclxuXHJcbiAgICA6aG9zdCA6Om5nLWRlZXAgLmhkci1idG4gLm1hdC1tZGMtYnV0dG9uLXRvdWNoLXRhcmdldCB7XHJcbiAgICAgIHdpZHRoOiAzMnB4ICFpbXBvcnRhbnQ7XHJcbiAgICAgIGhlaWdodDogMzJweCAhaW1wb3J0YW50O1xyXG4gICAgfVxyXG5cclxuICAgIC5tZXNzYWdlcy1hcmVhIHtcclxuICAgICAgZmxleDogMTtcclxuICAgICAgb3ZlcmZsb3cteTogYXV0bztcclxuICAgICAgcGFkZGluZzogMTJweDtcclxuICAgICAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQ7XHJcbiAgICAgIHNjcm9sbGJhci13aWR0aDogbm9uZTtcclxuICAgICAgLW1zLW92ZXJmbG93LXN0eWxlOiBub25lO1xyXG4gICAgfVxyXG5cclxuICAgIC5tZXNzYWdlcy1hcmVhOjotd2Via2l0LXNjcm9sbGJhciB7XHJcbiAgICAgIGRpc3BsYXk6IG5vbmU7XHJcbiAgICB9XHJcblxyXG4gICAgLmxvYWRpbmctaW5kaWNhdG9yIHtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XHJcbiAgICAgIGdhcDogOHB4O1xyXG4gICAgICBwYWRkaW5nOiAxMnB4O1xyXG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjcpO1xyXG4gICAgICBmb250LXNpemU6IDEzcHg7XHJcbiAgICB9XHJcblxyXG4gICAgLnJlbW92ZWQtZ3JvdXAtc3RhdGUge1xyXG4gICAgICBoZWlnaHQ6IDEwMCU7XHJcbiAgICAgIG1pbi1oZWlnaHQ6IDI2MHB4O1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcclxuICAgICAgdGV4dC1hbGlnbjogY2VudGVyO1xyXG4gICAgICBnYXA6IDEwcHg7XHJcbiAgICAgIHBhZGRpbmc6IDMycHggMjRweDtcclxuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC43OCk7XHJcbiAgICAgIGJveC1zaXppbmc6IGJvcmRlci1ib3g7XHJcbiAgICB9XHJcblxyXG4gICAgLnJlbW92ZWQtZ3JvdXAtc3RhdGUgbWF0LWljb24ge1xyXG4gICAgICB3aWR0aDogNDRweDtcclxuICAgICAgaGVpZ2h0OiA0NHB4O1xyXG4gICAgICBmb250LXNpemU6IDQ0cHg7XHJcbiAgICAgIGNvbG9yOiAjZjg3MTcxO1xyXG4gICAgICBtYXJnaW4tYm90dG9tOiA0cHg7XHJcbiAgICB9XHJcblxyXG4gICAgLnJlbW92ZWQtZ3JvdXAtc3RhdGUgaDQge1xyXG4gICAgICBtYXJnaW46IDA7XHJcbiAgICAgIGNvbG9yOiAjZmZmO1xyXG4gICAgICBmb250LXNpemU6IDE3cHg7XHJcbiAgICAgIGZvbnQtd2VpZ2h0OiA3MDA7XHJcbiAgICB9XHJcblxyXG4gICAgLnJlbW92ZWQtZ3JvdXAtc3RhdGUgcCB7XHJcbiAgICAgIG1hcmdpbjogMCAwIDhweDtcclxuICAgICAgbWF4LXdpZHRoOiAyODBweDtcclxuICAgICAgZm9udC1zaXplOiAxM3B4O1xyXG4gICAgICBsaW5lLWhlaWdodDogMS40O1xyXG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjYyKTtcclxuICAgIH1cclxuXHJcbiAgICAucmVtb3ZlZC1leGl0LWJ0biB7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDEwcHg7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xOCkgIWltcG9ydGFudDtcclxuICAgICAgY29sb3I6ICNmZmYgIWltcG9ydGFudDtcclxuICAgICAgZm9udC13ZWlnaHQ6IDcwMDtcclxuICAgICAgcGFkZGluZzogMCAxOHB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5sb2FkLW1vcmUtYnRuIHtcclxuICAgICAgYWxpZ24tc2VsZjogY2VudGVyO1xyXG4gICAgICBtYXJnaW4tYm90dG9tOiAxNnB4O1xyXG4gICAgICBmb250LXNpemU6IDEycHg7XHJcbiAgICAgIGNvbG9yOiAjZmZmO1xyXG4gICAgfVxyXG5cclxuICAgIC5tZXNzYWdlcy1saXN0IHtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcclxuICAgICAgZ2FwOiAxcHg7XHJcbiAgICAgIGZsZXg6IDE7XHJcbiAgICB9XHJcblxyXG4gICAgLmRhdGUtc2VwYXJhdG9yIHtcclxuICAgICAgdGV4dC1hbGlnbjogY2VudGVyO1xyXG4gICAgICBtYXJnaW46IDE2cHggMCA4cHg7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTJweDtcclxuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC43KTtcclxuICAgICAgZm9udC13ZWlnaHQ6IDUwMDtcclxuICAgIH1cclxuXHJcbiAgICAubWVzc2FnZS1idWJibGUtcm93IHtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcclxuICAgICAgbWF4LXdpZHRoOiA4OCU7XHJcbiAgICAgIG1hcmdpbi1ib3R0b206IDJweDtcclxuICAgIH1cclxuXHJcbiAgICAubWVzc2FnZS1idWJibGUtcm93Lm93biB7XHJcbiAgICAgIGFsaWduLXNlbGY6IGZsZXgtZW5kO1xyXG4gICAgICBhbGlnbi1pdGVtczogZmxleC1lbmQ7XHJcbiAgICB9XHJcblxyXG4gICAgLm1lc3NhZ2UtYnViYmxlLXJvdy5vdGhlciB7XHJcbiAgICAgIGFsaWduLXNlbGY6IGZsZXgtc3RhcnQ7XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBmbGV4LXN0YXJ0O1xyXG4gICAgfVxyXG5cclxuICAgIC5zZW5kZXItbmFtZSB7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTFweDtcclxuICAgICAgZm9udC13ZWlnaHQ6IDcwMDtcclxuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC45NSk7XHJcbiAgICAgIG1hcmdpbi1ib3R0b206IDNweDtcclxuICAgICAgbGV0dGVyLXNwYWNpbmc6IDAuMnB4O1xyXG4gICAgICBwYWRkaW5nOiAwIDEwcHg7XHJcbiAgICAgIHRleHQtc2hhZG93OiAwIDFweCAzcHggcmdiYSgwLCAwLCAwLCAwLjQpO1xyXG4gICAgfVxyXG5cclxuICAgIC5zeXN0ZW0tbWVzc2FnZS1yb3cge1xyXG4gICAgICBhbGlnbi1zZWxmOiBjZW50ZXI7XHJcbiAgICAgIG1heC13aWR0aDogODglO1xyXG4gICAgICBtYXJnaW46IDhweCBhdXRvO1xyXG4gICAgICB0ZXh0LWFsaWduOiBjZW50ZXI7XHJcbiAgICB9XHJcblxyXG4gICAgLnN5c3RlbS1tZXNzYWdlLXRleHQge1xyXG4gICAgICBkaXNwbGF5OiBpbmxpbmUtZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XHJcbiAgICAgIHBhZGRpbmc6IDVweCAxMXB4O1xyXG4gICAgICBib3JkZXItcmFkaXVzOiA5OTlweDtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjA5KTtcclxuICAgICAgYm9yZGVyOiAxcHggc29saWQgcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjEyKTtcclxuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC43Mik7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTFweDtcclxuICAgICAgbGluZS1oZWlnaHQ6IDEuMzU7XHJcbiAgICB9XHJcblxyXG4gICAgLm1lc3NhZ2UtYnViYmxlIHtcclxuICAgICAgcGFkZGluZzogOHB4IDE0cHggN3B4O1xyXG4gICAgICBib3JkZXItcmFkaXVzOiAxNHB4O1xyXG4gICAgICBmb250LXNpemU6IGNhbGMoY2xhbXAoMTFweCwgMy40Y3F3LCAxM3B4KSAqIHZhcigtLW1lc3NhZ2UtdGV4dC1zY2FsZSwgMSkpO1xyXG4gICAgICBsaW5lLWhlaWdodDogMS4zMjtcclxuICAgICAgd29yZC1icmVhazogYnJlYWstd29yZDtcclxuICAgICAgY29sb3I6ICNmNWY3ZmY7XHJcbiAgICAgIHBvc2l0aW9uOiByZWxhdGl2ZTtcclxuICAgICAgZGlzcGxheTogaW5saW5lLWJsb2NrO1xyXG4gICAgICBtaW4td2lkdGg6IGZpdC1jb250ZW50O1xyXG4gICAgfVxyXG5cclxuICAgIC5tZXNzYWdlLWJ1YmJsZS1yb3cub3RoZXIgLm1lc3NhZ2UtYnViYmxlIHtcclxuICAgICAgYmFja2dyb3VuZDogIzBkMjU0MDtcclxuICAgICAgYm9yZGVyLWJvdHRvbS1sZWZ0LXJhZGl1czogNXB4O1xyXG4gICAgICBib3gtc2hhZG93OiAwIDFweCA0cHggcmdiYSgwLCAwLCAwLCAwLjQpO1xyXG4gICAgfVxyXG5cclxuICAgIC5tZXNzYWdlLWJ1YmJsZS5vd24tYnViYmxlIHtcclxuICAgICAgYmFja2dyb3VuZDogIzBhM2Q2MjtcclxuICAgICAgYm9yZGVyLWJvdHRvbS1yaWdodC1yYWRpdXM6IDVweDtcclxuICAgICAgYm94LXNoYWRvdzogMCAxcHggNHB4IHJnYmEoMCwgMCwgMCwgMC40KTtcclxuICAgIH1cclxuXHJcbiAgICAucmVwbHktY29udGV4dCB7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgIGdhcDogN3B4O1xyXG4gICAgICBtYXJnaW4tYm90dG9tOiA3cHg7XHJcbiAgICAgIHBhZGRpbmc6IDdweCA5cHg7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDEwcHg7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4wOCk7XHJcbiAgICAgIGJvcmRlci1sZWZ0OiAzcHggc29saWQgcmdiYSgxMjcsIDE4MCwgMjU1LCAwLjc4KTtcclxuICAgICAgbWF4LXdpZHRoOiBtaW4oNjhjcXcsIDQyMHB4KTtcclxuICAgIH1cclxuXHJcbiAgICAucmVwbHktY29udGV4dCBtYXQtaWNvbiB7XHJcbiAgICAgIGNvbG9yOiAjYmZkYmZlO1xyXG4gICAgICBmb250LXNpemU6IDE2cHg7XHJcbiAgICAgIHdpZHRoOiAxNnB4O1xyXG4gICAgICBoZWlnaHQ6IDE2cHg7XHJcbiAgICAgIGZsZXgtc2hyaW5rOiAwO1xyXG4gICAgfVxyXG5cclxuICAgIC5yZXBseS1jb250ZXh0IGRpdiB7XHJcbiAgICAgIG1pbi13aWR0aDogMDtcclxuICAgIH1cclxuXHJcbiAgICAucmVwbHktY29udGV4dCBzcGFuIHtcclxuICAgICAgZGlzcGxheTogYmxvY2s7XHJcbiAgICAgIGNvbG9yOiAjYmZkYmZlO1xyXG4gICAgICBmb250LXNpemU6IDExcHg7XHJcbiAgICAgIGZvbnQtd2VpZ2h0OiA3MDA7XHJcbiAgICAgIG1hcmdpbi1ib3R0b206IDJweDtcclxuICAgIH1cclxuXHJcbiAgICAucmVwbHktY29udGV4dCBwIHtcclxuICAgICAgbWFyZ2luOiAwO1xyXG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjc4KTtcclxuICAgICAgZm9udC1zaXplOiAxMnB4O1xyXG4gICAgICB3aGl0ZS1zcGFjZTogbm93cmFwO1xyXG4gICAgICBvdmVyZmxvdzogaGlkZGVuO1xyXG4gICAgICB0ZXh0LW92ZXJmbG93OiBlbGxpcHNpcztcclxuICAgIH1cclxuXHJcbiAgICAudGV4dC1jb250ZW50IHtcclxuICAgICAgd2hpdGUtc3BhY2U6IHByZS13cmFwO1xyXG4gICAgICB0YWItc2l6ZTogNDtcclxuICAgIH1cclxuXHJcbiAgICAudGV4dC1jb250ZW50LnByZWZvcm1hdHRlZC10ZXh0IHtcclxuICAgICAgZm9udC1mYW1pbHk6IHVpLW1vbm9zcGFjZSwgU0ZNb25vLVJlZ3VsYXIsIE1lbmxvLCBNb25hY28sIENvbnNvbGFzLCBcIkxpYmVyYXRpb24gTW9ub1wiLCBtb25vc3BhY2U7XHJcbiAgICAgIGZvbnQtc2l6ZTogY2FsYyhjbGFtcCgxMHB4LCAzLjFjcXcsIDEycHgpICogdmFyKC0tY29kZS10ZXh0LXNjYWxlLCAxKSk7XHJcbiAgICAgIGxpbmUtaGVpZ2h0OiAxLjQ1O1xyXG4gICAgICBvdmVyZmxvdy14OiBhdXRvO1xyXG4gICAgICBtYXgtd2lkdGg6IG1pbig3MmNxdywgNTIwcHgpO1xyXG4gICAgICBzY3JvbGxiYXItd2lkdGg6IG5vbmU7XHJcbiAgICAgIC1tcy1vdmVyZmxvdy1zdHlsZTogbm9uZTtcclxuICAgIH1cclxuXHJcbiAgICAudGV4dC1jb250ZW50LnByZWZvcm1hdHRlZC10ZXh0Ojotd2Via2l0LXNjcm9sbGJhciB7XHJcbiAgICAgIGRpc3BsYXk6IG5vbmU7XHJcbiAgICB9XHJcblxyXG4gICAgLmlubGluZS1lZGl0LXdyYXAge1xyXG4gICAgICB3aWR0aDogbWluKDc2Y3F3LCA1MjBweCk7XHJcbiAgICAgIG1pbi13aWR0aDogbWluKDU2Y3F3LCAyNjBweCk7XHJcbiAgICB9XHJcblxyXG4gICAgLmlubGluZS1lZGl0LXRleHRhcmVhIHtcclxuICAgICAgd2lkdGg6IDEwMCU7XHJcbiAgICAgIG1pbi1oZWlnaHQ6IDcycHg7XHJcbiAgICAgIG1heC1oZWlnaHQ6IDIyMHB4O1xyXG4gICAgICBib3gtc2l6aW5nOiBib3JkZXItYm94O1xyXG4gICAgICBib3JkZXI6IDFweCBzb2xpZCByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMjgpO1xyXG4gICAgICBib3JkZXItcmFkaXVzOiAxMHB4O1xyXG4gICAgICBvdXRsaW5lOiBub25lO1xyXG4gICAgICByZXNpemU6IHZlcnRpY2FsO1xyXG4gICAgICBwYWRkaW5nOiA5cHggMTBweDtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjEpO1xyXG4gICAgICBjb2xvcjogI2ZmZjtcclxuICAgICAgZm9udDogaW5oZXJpdDtcclxuICAgICAgbGluZS1oZWlnaHQ6IDEuMzU7XHJcbiAgICAgIHdoaXRlLXNwYWNlOiBwcmUtd3JhcDtcclxuICAgIH1cclxuXHJcbiAgICAuaW5saW5lLWVkaXQtdGV4dGFyZWE6Zm9jdXMge1xyXG4gICAgICBib3JkZXItY29sb3I6IHJnYmEoMTkxLCAyMTksIDI1NCwgMC45KTtcclxuICAgICAgYm94LXNoYWRvdzogMCAwIDAgMnB4IHJnYmEoMTI3LCAxODAsIDI1NSwgMC4xOCk7XHJcbiAgICB9XHJcblxyXG4gICAgLmlubGluZS1lZGl0LWFjdGlvbnMge1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGZsZXgtZW5kO1xyXG4gICAgICBnYXA6IDhweDtcclxuICAgICAgbWFyZ2luLXRvcDogOHB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5pbmxpbmUtZWRpdC1jYW5jZWwsXHJcbiAgICAuaW5saW5lLWVkaXQtc2F2ZSB7XHJcbiAgICAgIGJvcmRlcjogMDtcclxuICAgICAgYm9yZGVyLXJhZGl1czogOHB4O1xyXG4gICAgICBwYWRkaW5nOiA2cHggMTBweDtcclxuICAgICAgY29sb3I6ICNmOGZhZmM7XHJcbiAgICAgIGN1cnNvcjogcG9pbnRlcjtcclxuICAgICAgZm9udC1zaXplOiAxMnB4O1xyXG4gICAgICBmb250LXdlaWdodDogNzAwO1xyXG4gICAgfVxyXG5cclxuICAgIC5pbmxpbmUtZWRpdC1jYW5jZWwge1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMTIpO1xyXG4gICAgfVxyXG5cclxuICAgIC5pbmxpbmUtZWRpdC1zYXZlIHtcclxuICAgICAgYmFja2dyb3VuZDogIzI1NjNlYjtcclxuICAgIH1cclxuXHJcbiAgICAuaW5saW5lLWVkaXQtc2F2ZTpkaXNhYmxlZCB7XHJcbiAgICAgIGN1cnNvcjogbm90LWFsbG93ZWQ7XHJcbiAgICAgIG9wYWNpdHk6IDAuNDU7XHJcbiAgICB9XHJcblxyXG4gICAgLmF0dGFjaG1lbnQtY2FwdGlvbiB7XHJcbiAgICAgIG1hcmdpbi10b3A6IDhweDtcclxuICAgICAgd2lkdGg6IHZhcigtLWF0dGFjaG1lbnQtdGh1bWItc2l6ZSk7XHJcbiAgICAgIG1heC13aWR0aDogdmFyKC0tYXR0YWNobWVudC10aHVtYi1zaXplKTtcclxuICAgICAgYm94LXNpemluZzogYm9yZGVyLWJveDtcclxuICAgIH1cclxuXHJcbiAgICAuYXR0YWNobWVudC1jYXB0aW9uIC50ZXh0LWNvbnRlbnQge1xyXG4gICAgICB3aGl0ZS1zcGFjZTogcHJlLXdyYXA7XHJcbiAgICAgIG92ZXJmbG93LXdyYXA6IGFueXdoZXJlO1xyXG4gICAgICBtYXgtd2lkdGg6IDEwMCU7XHJcbiAgICB9XHJcblxyXG4gICAgLmF0dGFjaG1lbnQtcmVuZGVyLWJsb2NrIHtcclxuICAgICAgd2lkdGg6IDEwMCU7XHJcbiAgICAgIG1heC13aWR0aDogMTAwJTtcclxuICAgIH1cclxuXHJcbiAgICAuY29kZS1tZXNzYWdlLXdyYXAge1xyXG4gICAgICBwb3NpdGlvbjogcmVsYXRpdmU7XHJcbiAgICAgIG1heC13aWR0aDogbWluKDc2Y3F3LCA1NjBweCk7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDEwcHg7XHJcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XHJcbiAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xNCk7XHJcbiAgICAgIGJhY2tncm91bmQ6ICMwNjE4Mjc7XHJcbiAgICB9XHJcblxyXG4gICAgLnJlbmRlci1jb3B5LWJ0biB7XHJcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcclxuICAgICAgdG9wOiA2cHg7XHJcbiAgICAgIHJpZ2h0OiA2cHg7XHJcbiAgICAgIHotaW5kZXg6IDI7XHJcbiAgICAgIHdpZHRoOiAyNnB4O1xyXG4gICAgICBoZWlnaHQ6IDI2cHg7XHJcbiAgICAgIGJvcmRlcjogbm9uZTtcclxuICAgICAgYm9yZGVyLXJhZGl1czogN3B4O1xyXG4gICAgICBkaXNwbGF5OiBpbmxpbmUtZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XHJcbiAgICAgIHBhZGRpbmc6IDA7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoNywgMjksIDQ4LCAwLjgyKTtcclxuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC43OCk7XHJcbiAgICAgIGN1cnNvcjogcG9pbnRlcjtcclxuICAgICAgb3BhY2l0eTogMDtcclxuICAgICAgdHJhbnNpdGlvbjogb3BhY2l0eSAwLjEycywgYmFja2dyb3VuZCAwLjEycywgY29sb3IgMC4xMnM7XHJcbiAgICB9XHJcblxyXG4gICAgLmNvZGUtbWVzc2FnZS13cmFwOmhvdmVyIC5yZW5kZXItY29weS1idG4sXHJcbiAgICAudGFibGUtbWVzc2FnZS13cmFwOmhvdmVyIC5yZW5kZXItY29weS1idG4sXHJcbiAgICAubWQtbWVzc2FnZS13cmFwOmhvdmVyIC5yZW5kZXItY29weS1idG4sXHJcbiAgICAucmVuZGVyLWNvcHktYnRuOmZvY3VzIHtcclxuICAgICAgb3BhY2l0eTogMTtcclxuICAgIH1cclxuXHJcbiAgICAucmVuZGVyLWNvcHktYnRuOmhvdmVyIHtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgxMjcsIDE4MCwgMjU1LCAwLjIyKTtcclxuICAgICAgY29sb3I6ICNmZmY7XHJcbiAgICB9XHJcblxyXG4gICAgLnJlbmRlci1jb3B5LWJ0biBtYXQtaWNvbiB7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTZweDtcclxuICAgICAgd2lkdGg6IDE2cHg7XHJcbiAgICAgIGhlaWdodDogMTZweDtcclxuICAgICAgbGluZS1oZWlnaHQ6IDE2cHg7XHJcbiAgICB9XHJcblxyXG4gICAgLmNvZGUtbWVzc2FnZSB7XHJcbiAgICAgIG1hcmdpbjogMDtcclxuICAgICAgcGFkZGluZzogMTJweCA0MnB4IDI4cHggMTJweDtcclxuICAgICAgb3ZlcmZsb3cteDogYXV0bztcclxuICAgICAgY29sb3I6ICNkYmVhZmU7XHJcbiAgICAgIGZvbnQtZmFtaWx5OiB1aS1tb25vc3BhY2UsIFNGTW9uby1SZWd1bGFyLCBNZW5sbywgTW9uYWNvLCBDb25zb2xhcywgXCJMaWJlcmF0aW9uIE1vbm9cIiwgbW9ub3NwYWNlO1xyXG4gICAgICBmb250LXNpemU6IGNhbGMoY2xhbXAoMTBweCwgMy4xY3F3LCAxMnB4KSAqIHZhcigtLWNvZGUtdGV4dC1zY2FsZSwgMSkpO1xyXG4gICAgICBsaW5lLWhlaWdodDogMS40NTtcclxuICAgICAgd2hpdGUtc3BhY2U6IHByZTtcclxuICAgICAgdGFiLXNpemU6IDI7XHJcbiAgICAgIHNjcm9sbGJhci13aWR0aDogbm9uZTtcclxuICAgICAgLW1zLW92ZXJmbG93LXN0eWxlOiBub25lO1xyXG4gICAgfVxyXG5cclxuICAgIC5jb2RlLW1lc3NhZ2U6Oi13ZWJraXQtc2Nyb2xsYmFyIHtcclxuICAgICAgZGlzcGxheTogbm9uZTtcclxuICAgIH1cclxuXHJcbiAgICAuY29kZS1sYW5ndWFnZSB7XHJcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcclxuICAgICAgcmlnaHQ6IDhweDtcclxuICAgICAgYm90dG9tOiA2cHg7XHJcbiAgICAgIHBhZGRpbmc6IDJweCA3cHg7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDk5OXB4O1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDEyNywgMTgwLCAyNTUsIDAuMTYpO1xyXG4gICAgICBjb2xvcjogI2JmZGJmZTtcclxuICAgICAgZm9udC1zaXplOiAxMHB4O1xyXG4gICAgICBmb250LXdlaWdodDogNzAwO1xyXG4gICAgICBsZXR0ZXItc3BhY2luZzogMC4wNWVtO1xyXG4gICAgICB0ZXh0LXRyYW5zZm9ybTogdXBwZXJjYXNlO1xyXG4gICAgICBwb2ludGVyLWV2ZW50czogbm9uZTtcclxuICAgIH1cclxuXHJcbiAgICAubWQtbGFuZ3VhZ2Uge1xyXG4gICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XHJcbiAgICAgIHJpZ2h0OiA4cHg7XHJcbiAgICAgIGJvdHRvbTogNnB4O1xyXG4gICAgICBwYWRkaW5nOiAycHggN3B4O1xyXG4gICAgICBib3JkZXItcmFkaXVzOiA5OTlweDtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgxMzQsIDIzOSwgMTcyLCAwLjE0KTtcclxuICAgICAgY29sb3I6ICNiYmY3ZDA7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTBweDtcclxuICAgICAgZm9udC13ZWlnaHQ6IDcwMDtcclxuICAgICAgbGV0dGVyLXNwYWNpbmc6IDAuMDVlbTtcclxuICAgICAgdGV4dC10cmFuc2Zvcm06IHVwcGVyY2FzZTtcclxuICAgICAgcG9pbnRlci1ldmVudHM6IG5vbmU7XHJcbiAgICB9XHJcblxyXG4gICAgOmhvc3QgOjpuZy1kZWVwIC5jb2RlLXRva2VuLWtleXdvcmQgeyBjb2xvcjogIzkzYzVmZDsgZm9udC13ZWlnaHQ6IDcwMDsgfVxyXG4gICAgOmhvc3QgOjpuZy1kZWVwIC5jb2RlLXRva2VuLXN0cmluZyB7IGNvbG9yOiAjODZlZmFjOyB9XHJcbiAgICA6aG9zdCA6Om5nLWRlZXAgLmNvZGUtdG9rZW4tbnVtYmVyIHsgY29sb3I6ICNmYmJmMjQ7IH1cclxuICAgIDpob3N0IDo6bmctZGVlcCAuY29kZS10b2tlbi1jb21tZW50IHsgY29sb3I6ICM5NGEzYjg7IGZvbnQtc3R5bGU6IGl0YWxpYzsgfVxyXG4gICAgOmhvc3QgOjpuZy1kZWVwIC5jb2RlLXRva2VuLWZ1bmN0aW9uIHsgY29sb3I6ICNjNGI1ZmQ7IH1cclxuXHJcbiAgICAudGFibGUtbWVzc2FnZS13cmFwIHtcclxuICAgICAgcG9zaXRpb246IHJlbGF0aXZlO1xyXG4gICAgICBtYXgtd2lkdGg6IG1pbig3NmNxdywgNTYwcHgpO1xyXG4gICAgICBvdmVyZmxvdy14OiBhdXRvO1xyXG4gICAgICBib3JkZXItcmFkaXVzOiA5cHg7XHJcbiAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xNik7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4wNCk7XHJcbiAgICAgIHNjcm9sbGJhci13aWR0aDogbm9uZTtcclxuICAgICAgLW1zLW92ZXJmbG93LXN0eWxlOiBub25lO1xyXG4gICAgfVxyXG5cclxuICAgIC50YWJsZS1tZXNzYWdlLXdyYXA6Oi13ZWJraXQtc2Nyb2xsYmFyIHtcclxuICAgICAgZGlzcGxheTogbm9uZTtcclxuICAgIH1cclxuXHJcbiAgICAucGFzdGVkLXRhYmxlIHtcclxuICAgICAgYm9yZGVyLWNvbGxhcHNlOiBjb2xsYXBzZTtcclxuICAgICAgbWluLXdpZHRoOiAxMDAlO1xyXG4gICAgICBmb250LXNpemU6IGNhbGMoY2xhbXAoMTBweCwgMy4xY3F3LCAxMnB4KSAqIHZhcigtLWNvZGUtdGV4dC1zY2FsZSwgMSkpO1xyXG4gICAgICBsaW5lLWhlaWdodDogMS4zNTtcclxuICAgICAgY29sb3I6ICNmNWY3ZmY7XHJcbiAgICB9XHJcblxyXG4gICAgLnBhc3RlZC10YWJsZSB0aCxcclxuICAgIC5wYXN0ZWQtdGFibGUgdGQge1xyXG4gICAgICBwYWRkaW5nOiA2cHggOXB4O1xyXG4gICAgICBib3JkZXItcmlnaHQ6IDFweCBzb2xpZCByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMTIpO1xyXG4gICAgICBib3JkZXItYm90dG9tOiAxcHggc29saWQgcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjEyKTtcclxuICAgICAgdGV4dC1hbGlnbjogbGVmdDtcclxuICAgICAgd2hpdGUtc3BhY2U6IHByZS13cmFwO1xyXG4gICAgICB2ZXJ0aWNhbC1hbGlnbjogdG9wO1xyXG4gICAgfVxyXG5cclxuICAgIC5wYXN0ZWQtdGFibGUgdGgge1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMSk7XHJcbiAgICAgIGZvbnQtd2VpZ2h0OiA3MDA7XHJcbiAgICB9XHJcblxyXG4gICAgLnBhc3RlZC10YWJsZSB0cjpsYXN0LWNoaWxkIHRkLFxyXG4gICAgLnBhc3RlZC10YWJsZSB0cjpsYXN0LWNoaWxkIHRoIHtcclxuICAgICAgYm9yZGVyLWJvdHRvbTogbm9uZTtcclxuICAgIH1cclxuXHJcbiAgICAucGFzdGVkLXRhYmxlIHRoOmxhc3QtY2hpbGQsXHJcbiAgICAucGFzdGVkLXRhYmxlIHRkOmxhc3QtY2hpbGQge1xyXG4gICAgICBib3JkZXItcmlnaHQ6IG5vbmU7XHJcbiAgICB9XHJcblxyXG4gICAgLm1kLW1lc3NhZ2Utd3JhcCB7XHJcbiAgICAgIHBvc2l0aW9uOiByZWxhdGl2ZTtcclxuICAgICAgbWF4LXdpZHRoOiBtaW4oNzZjcXcsIDU2MHB4KTtcclxuICAgICAgb3ZlcmZsb3cteDogYXV0bztcclxuICAgICAgYm9yZGVyLXJhZGl1czogMTBweDtcclxuICAgICAgYm9yZGVyOiAxcHggc29saWQgcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjEyKTtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjA1KTtcclxuICAgICAgc2Nyb2xsYmFyLXdpZHRoOiBub25lO1xyXG4gICAgICAtbXMtb3ZlcmZsb3ctc3R5bGU6IG5vbmU7XHJcbiAgICB9XHJcblxyXG4gICAgLm1kLW1lc3NhZ2Utd3JhcDo6LXdlYmtpdC1zY3JvbGxiYXIge1xyXG4gICAgICBkaXNwbGF5OiBub25lO1xyXG4gICAgfVxyXG5cclxuICAgIC5tZC1tZXNzYWdlIHtcclxuICAgICAgcGFkZGluZzogMTBweCA0MnB4IDI4cHggMTJweDtcclxuICAgICAgY29sb3I6ICNmNWY3ZmY7XHJcbiAgICAgIGZvbnQtc2l6ZTogY2FsYyhjbGFtcCgxMXB4LCAzLjRjcXcsIDEzcHgpICogdmFyKC0tbWVzc2FnZS10ZXh0LXNjYWxlLCAxKSk7XHJcbiAgICAgIGxpbmUtaGVpZ2h0OiAxLjQ1O1xyXG4gICAgICBvdmVyZmxvdy13cmFwOiBhbnl3aGVyZTtcclxuICAgIH1cclxuXHJcbiAgICA6aG9zdCA6Om5nLWRlZXAgLm1kLW1lc3NhZ2UgaDEsXHJcbiAgICA6aG9zdCA6Om5nLWRlZXAgLm1kLW1lc3NhZ2UgaDIsXHJcbiAgICA6aG9zdCA6Om5nLWRlZXAgLm1kLW1lc3NhZ2UgaDMge1xyXG4gICAgICBtYXJnaW46IDhweCAwIDZweDtcclxuICAgICAgY29sb3I6ICNmZmY7XHJcbiAgICAgIGxpbmUtaGVpZ2h0OiAxLjI1O1xyXG4gICAgfVxyXG5cclxuICAgIDpob3N0IDo6bmctZGVlcCAubWQtbWVzc2FnZSBoMSB7IGZvbnQtc2l6ZTogMThweDsgfVxyXG4gICAgOmhvc3QgOjpuZy1kZWVwIC5tZC1tZXNzYWdlIGgyIHsgZm9udC1zaXplOiAxNnB4OyB9XHJcbiAgICA6aG9zdCA6Om5nLWRlZXAgLm1kLW1lc3NhZ2UgaDMgeyBmb250LXNpemU6IDE0cHg7IH1cclxuXHJcbiAgICA6aG9zdCA6Om5nLWRlZXAgLm1kLW1lc3NhZ2UgcCB7XHJcbiAgICAgIG1hcmdpbjogNnB4IDA7XHJcbiAgICB9XHJcblxyXG4gICAgOmhvc3QgOjpuZy1kZWVwIC5tZC1tZXNzYWdlIHVsLFxyXG4gICAgOmhvc3QgOjpuZy1kZWVwIC5tZC1tZXNzYWdlIG9sIHtcclxuICAgICAgbWFyZ2luOiA2cHggMDtcclxuICAgICAgcGFkZGluZy1sZWZ0OiAyMHB4O1xyXG4gICAgfVxyXG5cclxuICAgIDpob3N0IDo6bmctZGVlcCAubWQtbWVzc2FnZSBibG9ja3F1b3RlIHtcclxuICAgICAgbWFyZ2luOiA4cHggMDtcclxuICAgICAgcGFkZGluZy1sZWZ0OiAxMHB4O1xyXG4gICAgICBib3JkZXItbGVmdDogM3B4IHNvbGlkIHJnYmEoMTI3LCAxODAsIDI1NSwgMC41NSk7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNzgpO1xyXG4gICAgfVxyXG5cclxuICAgIDpob3N0IDo6bmctZGVlcCAubWQtbWVzc2FnZSBjb2RlIHtcclxuICAgICAgcGFkZGluZzogMXB4IDVweDtcclxuICAgICAgYm9yZGVyLXJhZGl1czogNXB4O1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDAsIDAsIDAsIDAuMjUpO1xyXG4gICAgICBjb2xvcjogI2JmZGJmZTtcclxuICAgICAgZm9udC1mYW1pbHk6IHVpLW1vbm9zcGFjZSwgU0ZNb25vLVJlZ3VsYXIsIE1lbmxvLCBNb25hY28sIENvbnNvbGFzLCBcIkxpYmVyYXRpb24gTW9ub1wiLCBtb25vc3BhY2U7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTJweDtcclxuICAgIH1cclxuXHJcbiAgICA6aG9zdCA6Om5nLWRlZXAgLm1kLW1lc3NhZ2UgcHJlIHtcclxuICAgICAgbWFyZ2luOiA4cHggMDtcclxuICAgICAgcGFkZGluZzogOXB4O1xyXG4gICAgICBib3JkZXItcmFkaXVzOiA4cHg7XHJcbiAgICAgIG92ZXJmbG93LXg6IGF1dG87XHJcbiAgICAgIGJhY2tncm91bmQ6ICMwNjE4Mjc7XHJcbiAgICAgIHNjcm9sbGJhci13aWR0aDogbm9uZTtcclxuICAgICAgLW1zLW92ZXJmbG93LXN0eWxlOiBub25lO1xyXG4gICAgfVxyXG5cclxuICAgIDpob3N0IDo6bmctZGVlcCAubWQtbWVzc2FnZSBwcmU6Oi13ZWJraXQtc2Nyb2xsYmFyIHtcclxuICAgICAgZGlzcGxheTogbm9uZTtcclxuICAgIH1cclxuXHJcbiAgICA6aG9zdCA6Om5nLWRlZXAgLm1kLW1lc3NhZ2UgcHJlIGNvZGUge1xyXG4gICAgICBwYWRkaW5nOiAwO1xyXG4gICAgICBiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudDtcclxuICAgICAgY29sb3I6ICNkYmVhZmU7XHJcbiAgICAgIHdoaXRlLXNwYWNlOiBwcmU7XHJcbiAgICB9XHJcblxyXG4gICAgLmltYWdlLW1lc3NhZ2Uge1xyXG4gICAgICBsaW5lLWhlaWdodDogMDtcclxuICAgIH1cclxuXHJcbiAgICAubWVkaWEtd3JhcHBlciB7XHJcbiAgICAgIHBvc2l0aW9uOiByZWxhdGl2ZTtcclxuICAgICAgZGlzcGxheTogaW5saW5lLWJsb2NrO1xyXG4gICAgICBsaW5lLWhlaWdodDogMDtcclxuICAgICAgd2lkdGg6IHZhcigtLWF0dGFjaG1lbnQtdGh1bWItc2l6ZSk7XHJcbiAgICAgIGhlaWdodDogdmFyKC0tYXR0YWNobWVudC10aHVtYi1zaXplKTtcclxuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcclxuICAgICAgYm9yZGVyLXJhZGl1czogMTBweDtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjA4KTtcclxuICAgIH1cclxuXHJcbiAgICAubWVkaWEtaW1nIHtcclxuICAgICAgd2lkdGg6IDEwMCU7XHJcbiAgICAgIGhlaWdodDogMTAwJTtcclxuICAgICAgYm9yZGVyLXJhZGl1czogaW5oZXJpdDtcclxuICAgICAgZGlzcGxheTogYmxvY2s7XHJcbiAgICAgIGN1cnNvcjogem9vbS1pbjtcclxuICAgICAgb2JqZWN0LWZpdDogY292ZXI7XHJcbiAgICB9XHJcblxyXG4gICAgLmF0dGFjaG1lbnQtYWN0aW9ucyB7XHJcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcclxuICAgICAgcmlnaHQ6IDZweDtcclxuICAgICAgdG9wOiA2cHg7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGdhcDogNHB4O1xyXG4gICAgICBvcGFjaXR5OiAwO1xyXG4gICAgICB0cmFuc2l0aW9uOiBvcGFjaXR5IDAuMTJzIGVhc2U7XHJcbiAgICAgIHBvaW50ZXItZXZlbnRzOiBub25lO1xyXG4gICAgfVxyXG5cclxuICAgIC5tZWRpYS13cmFwcGVyOmhvdmVyIC5hdHRhY2htZW50LWFjdGlvbnMge1xyXG4gICAgICBvcGFjaXR5OiAxO1xyXG4gICAgICBwb2ludGVyLWV2ZW50czogYXV0bztcclxuICAgIH1cclxuXHJcbiAgICAuYXR0YWNobWVudC1hY3Rpb24tYnRuLFxyXG4gICAgLmZpbGUtZG93bmxvYWQtYnRuIHtcclxuICAgICAgYm9yZGVyOiBub25lO1xyXG4gICAgICBib3JkZXItcmFkaXVzOiA5OTlweDtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSg3LCAyOSwgNDgsIDAuODIpO1xyXG4gICAgICBjb2xvcjogI2ZmZjtcclxuICAgICAgZGlzcGxheTogaW5saW5lLWZsZXg7XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xyXG4gICAgICBjdXJzb3I6IHBvaW50ZXI7XHJcbiAgICAgIHBhZGRpbmc6IDA7XHJcbiAgICB9XHJcblxyXG4gICAgLmF0dGFjaG1lbnQtYWN0aW9uLWJ0biB7XHJcbiAgICAgIHdpZHRoOiAyOHB4O1xyXG4gICAgICBoZWlnaHQ6IDI4cHg7XHJcbiAgICB9XHJcblxyXG4gICAgLmF0dGFjaG1lbnQtYWN0aW9uLWJ0biBtYXQtaWNvbiB7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTdweDtcclxuICAgICAgd2lkdGg6IDE3cHg7XHJcbiAgICAgIGhlaWdodDogMTdweDtcclxuICAgIH1cclxuXHJcbiAgICAubWVkaWEtdmlkZW8ge1xyXG4gICAgICBtYXgtd2lkdGg6IDI0MHB4O1xyXG4gICAgICBtYXgtaGVpZ2h0OiAyNjBweDtcclxuICAgICAgYm9yZGVyLXJhZGl1czogMTBweDtcclxuICAgICAgZGlzcGxheTogYmxvY2s7XHJcbiAgICAgIGJhY2tncm91bmQ6ICMwMDA7XHJcbiAgICB9XHJcblxyXG4gICAgLnZpZGVvLW1lc3NhZ2Uge1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xyXG4gICAgICBnYXA6IDZweDtcclxuICAgIH1cclxuXHJcbiAgICAudmlkZW8tZG93bmxvYWQge1xyXG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjc4KTtcclxuICAgICAgZm9udC1zaXplOiAxMnB4O1xyXG4gICAgICB0ZXh0LWRlY29yYXRpb246IHVuZGVybGluZTtcclxuICAgICAgdGV4dC11bmRlcmxpbmUtb2Zmc2V0OiAycHg7XHJcbiAgICB9XHJcblxyXG4gICAgLm1lZGlhLXBsYWNlaG9sZGVyIHtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XHJcbiAgICAgIGdhcDogOHB4O1xyXG4gICAgICB3aWR0aDogdmFyKC0tYXR0YWNobWVudC10aHVtYi1zaXplKTtcclxuICAgICAgaGVpZ2h0OiB2YXIoLS1hdHRhY2htZW50LXRodW1iLXNpemUpO1xyXG4gICAgICBib3JkZXItcmFkaXVzOiAxMHB4O1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMDgpO1xyXG4gICAgICBjb2xvcjogcmdiYSgyNTUsMjU1LDI1NSwwLjYpO1xyXG4gICAgICBmb250LXNpemU6IDExcHg7XHJcbiAgICB9XHJcblxyXG4gICAgLm1lZGlhLWxvYWQtbGFiZWwge1xyXG4gICAgICBmb250LXNpemU6IDExcHg7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwyNTUsMjU1LDAuNik7XHJcbiAgICB9XHJcblxyXG4gICAgLmF0dGFjaG1lbnRzLWxpc3Qge1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xyXG4gICAgICBnYXA6IDhweDtcclxuICAgICAgbWF4LXdpZHRoOiAxMDAlO1xyXG4gICAgfVxyXG5cclxuICAgIC5hdHRhY2htZW50LWl0ZW0ge1xyXG4gICAgICBtYXgtd2lkdGg6IDEwMCU7XHJcbiAgICB9XHJcblxyXG4gICAgLmZpbGUtbWVzc2FnZSB7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgIGdhcDogOHB4O1xyXG4gICAgICBwYWRkaW5nOiA0cHggMDtcclxuICAgIH1cclxuXHJcbiAgICAuYXR0YWNobWVudC10aHVtYi5maWxlLW1lc3NhZ2Uge1xyXG4gICAgICBwb3NpdGlvbjogcmVsYXRpdmU7XHJcbiAgICAgIHdpZHRoOiB2YXIoLS1hdHRhY2htZW50LXRodW1iLXNpemUpO1xyXG4gICAgICBoZWlnaHQ6IHZhcigtLWF0dGFjaG1lbnQtdGh1bWItc2l6ZSk7XHJcbiAgICAgIHBhZGRpbmc6IDEycHg7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDEwcHg7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4wOCk7XHJcbiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XHJcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xyXG4gICAgICBib3gtc2l6aW5nOiBib3JkZXItYm94O1xyXG4gICAgICBvdmVyZmxvdzogaGlkZGVuO1xyXG4gICAgfVxyXG5cclxuICAgIC5maWxlLWRvd25sb2FkIHtcclxuICAgICAgZGlzcGxheTogaW5saW5lLWZsZXg7XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgIGdhcDogOHB4O1xyXG4gICAgICBjb2xvcjogI2ZmZjtcclxuICAgICAgdGV4dC1kZWNvcmF0aW9uOiBub25lO1xyXG4gICAgICBtYXgtd2lkdGg6IDI0MHB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5maWxlLW1zZy1pY29uIHtcclxuICAgICAgZm9udC1zaXplOiA0MnB4O1xyXG4gICAgICB3aWR0aDogNDJweDtcclxuICAgICAgaGVpZ2h0OiA0MnB4O1xyXG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjgpO1xyXG4gICAgICBmbGV4LXNocmluazogMDtcclxuICAgIH1cclxuXHJcbiAgICAuZmlsZS1tc2ctbmFtZSB7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTNweDtcclxuICAgICAgY29sb3I6ICNmZmY7XHJcbiAgICAgIGxpbmUtaGVpZ2h0OiAxLjI7XHJcbiAgICAgIG1heC13aWR0aDogMTAwJTtcclxuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcclxuICAgICAgdGV4dC1hbGlnbjogY2VudGVyO1xyXG4gICAgICB0ZXh0LW92ZXJmbG93OiBlbGxpcHNpcztcclxuICAgICAgZGlzcGxheTogLXdlYmtpdC1ib3g7XHJcbiAgICAgIC13ZWJraXQtbGluZS1jbGFtcDogMztcclxuICAgICAgLXdlYmtpdC1ib3gtb3JpZW50OiB2ZXJ0aWNhbDtcclxuICAgICAgd29yZC1icmVhazogYnJlYWstd29yZDtcclxuICAgIH1cclxuXHJcbiAgICAuZmlsZS1kb3dubG9hZC1pY29uIHtcclxuICAgICAgZm9udC1zaXplOiAxOHB4O1xyXG4gICAgICB3aWR0aDogMThweDtcclxuICAgICAgaGVpZ2h0OiAxOHB4O1xyXG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjcpO1xyXG4gICAgICBmbGV4LXNocmluazogMDtcclxuICAgIH1cclxuXHJcbiAgICAuZmlsZS1kb3dubG9hZC1idG4ge1xyXG4gICAgICB3aWR0aDogMjRweDtcclxuICAgICAgaGVpZ2h0OiAyNHB4O1xyXG4gICAgICBmbGV4LXNocmluazogMDtcclxuICAgICAgcG9zaXRpb246IGFic29sdXRlO1xyXG4gICAgICByaWdodDogNnB4O1xyXG4gICAgICB0b3A6IDZweDtcclxuICAgIH1cclxuXHJcbiAgICAuZmlsZS1kb3dubG9hZC1saW5rIHtcclxuICAgICAgYm9yZGVyOiBub25lO1xyXG4gICAgICBib3JkZXItcmFkaXVzOiA5OTlweDtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjE2KTtcclxuICAgICAgY29sb3I6ICNmZmY7XHJcbiAgICAgIGN1cnNvcjogcG9pbnRlcjtcclxuICAgICAgZm9udC1zaXplOiAxMXB4O1xyXG4gICAgICBwYWRkaW5nOiA0cHggMTBweDtcclxuICAgICAgbWFyZ2luLXRvcDogNHB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5tZXNzYWdlLW1ldGEge1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBnYXA6IDRweDtcclxuICAgICAgbWFyZ2luLXRvcDogM3B4O1xyXG4gICAgfVxyXG5cclxuICAgIC5tc2ctdGltZSB7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTBweDtcclxuICAgICAgY29sb3I6IHJnYmEoMjE4LCAyMjQsIDI1MCwgMC42Nik7XHJcbiAgICB9XHJcblxyXG4gICAgLm1lc3NhZ2UtYnViYmxlLXJvdy5vdGhlciAubXNnLXRpbWUge1xyXG4gICAgICBjb2xvcjogcmdiYSgyMTYsIDIyMywgMjQ2LCAwLjU4KTtcclxuICAgIH1cclxuXHJcbiAgICAuZWRpdGVkLWxhYmVsIHtcclxuICAgICAgZm9udC1zaXplOiAxMHB4O1xyXG4gICAgICBmb250LXN0eWxlOiBpdGFsaWM7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDIxOCwgMjI0LCAyNTAsIDAuNjIpO1xyXG4gICAgfVxyXG5cclxuICAgIC5yZWFkLWljb24ge1xyXG4gICAgICBmb250LXNpemU6IDE0cHg7XHJcbiAgICAgIHdpZHRoOiAxNHB4O1xyXG4gICAgICBoZWlnaHQ6IDE0cHg7XHJcbiAgICAgIG9wYWNpdHk6IDAuNztcclxuICAgIH1cclxuXHJcbiAgICAucmVhZC1pY29uLnJlYWQge1xyXG4gICAgICBjb2xvcjogIzYwYTVmYTtcclxuICAgICAgb3BhY2l0eTogMTtcclxuICAgIH1cclxuXHJcbiAgICAucmVhZC1pY29uLnVucmVhZCB7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDIxOCwgMjI0LCAyNTAsIDAuNSk7XHJcbiAgICAgIG9wYWNpdHk6IDE7XHJcbiAgICB9XHJcblxyXG4gICAgLnJlcGx5LW1lc3NhZ2UtYnRuIHtcclxuICAgICAgcG9zaXRpb246IGFic29sdXRlO1xyXG4gICAgICByaWdodDogLTEwcHg7XHJcbiAgICAgIGJvdHRvbTogLTEwcHg7XHJcbiAgICAgIHdpZHRoOiAyNHB4O1xyXG4gICAgICBoZWlnaHQ6IDI0cHg7XHJcbiAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xNik7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDk5OXB4O1xyXG4gICAgICBiYWNrZ3JvdW5kOiAjMDcxZDMwO1xyXG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjc4KTtcclxuICAgICAgZGlzcGxheTogaW5saW5lLWZsZXg7XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xyXG4gICAgICBwYWRkaW5nOiAwO1xyXG4gICAgICBjdXJzb3I6IHBvaW50ZXI7XHJcbiAgICAgIG9wYWNpdHk6IDA7XHJcbiAgICAgIHRyYW5zZm9ybTogc2NhbGUoMC45Mik7XHJcbiAgICAgIHRyYW5zaXRpb246IG9wYWNpdHkgMC4xMnMsIHRyYW5zZm9ybSAwLjEycywgYmFja2dyb3VuZCAwLjEycywgY29sb3IgMC4xMnM7XHJcbiAgICAgIHotaW5kZXg6IDM7XHJcbiAgICB9XHJcblxyXG4gICAgLm1lc3NhZ2UtYnViYmxlOmhvdmVyIC5yZXBseS1tZXNzYWdlLWJ0bixcclxuICAgIC5yZXBseS1tZXNzYWdlLWJ0bjpmb2N1cyB7XHJcbiAgICAgIG9wYWNpdHk6IDE7XHJcbiAgICAgIHRyYW5zZm9ybTogc2NhbGUoMSk7XHJcbiAgICB9XHJcblxyXG4gICAgLnJlcGx5LW1lc3NhZ2UtYnRuOmhvdmVyIHtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgxMjcsIDE4MCwgMjU1LCAwLjIyKTtcclxuICAgICAgY29sb3I6ICNmZmY7XHJcbiAgICB9XHJcblxyXG4gICAgLnJlcGx5LW1lc3NhZ2UtYnRuIG1hdC1pY29uIHtcclxuICAgICAgZm9udC1zaXplOiAxNXB4O1xyXG4gICAgICB3aWR0aDogMTVweDtcclxuICAgICAgaGVpZ2h0OiAxNXB4O1xyXG4gICAgICBsaW5lLWhlaWdodDogMTVweDtcclxuICAgIH1cclxuXHJcbiAgICAucXVpY2stcmVhY3Rpb25zIHtcclxuICAgICAgcG9zaXRpb246IGFic29sdXRlO1xyXG4gICAgICB0b3A6IC0xOHB4O1xyXG4gICAgICByaWdodDogMDtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAgZ2FwOiA0cHg7XHJcbiAgICAgIHBhZGRpbmc6IDNweCA1cHg7XHJcbiAgICAgIGJhY2tncm91bmQ6ICMwNzFkMzA7XHJcbiAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xNCk7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDk5OXB4O1xyXG4gICAgICBib3gtc2hhZG93OiAwIDZweCAxNHB4IHJnYmEoMCwgMCwgMCwgMC4yOCk7XHJcbiAgICAgIHotaW5kZXg6IDQ7XHJcbiAgICB9XHJcblxyXG4gICAgLyogUmVjZWl2ZWQgbWVzc2FnZXMgc2l0IG9uIHRoZSBsZWZ0LCBzbyBncm93IHRoZSBwaWNrZXIgcmlnaHR3YXJkLlxyXG4gICAgICAgT3duIG1lc3NhZ2VzIHNpdCBvbiB0aGUgcmlnaHQsIHNvIGdyb3cgdGhlIHBpY2tlciBsZWZ0d2FyZC4gKi9cclxuICAgIC5tZXNzYWdlLWJ1YmJsZS1yb3cub3RoZXIgLnF1aWNrLXJlYWN0aW9ucyB7XHJcbiAgICAgIGxlZnQ6IDA7XHJcbiAgICAgIHJpZ2h0OiBhdXRvO1xyXG4gICAgfVxyXG5cclxuICAgIC5tZXNzYWdlLWJ1YmJsZS1yb3cub3duIC5xdWljay1yZWFjdGlvbnMge1xyXG4gICAgICBsZWZ0OiBhdXRvO1xyXG4gICAgICByaWdodDogMDtcclxuICAgIH1cclxuXHJcbiAgICAucXVpY2stZW1vamktYnRuIHtcclxuICAgICAgd2lkdGg6IDIwcHg7XHJcbiAgICAgIGhlaWdodDogMjBweDtcclxuICAgICAgYm9yZGVyOiBub25lO1xyXG4gICAgICBib3JkZXItcmFkaXVzOiA5OTlweDtcclxuICAgICAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQ7XHJcbiAgICAgIGNvbG9yOiAjZmZmO1xyXG4gICAgICBkaXNwbGF5OiBpbmxpbmUtZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTNweDtcclxuICAgICAgbGluZS1oZWlnaHQ6IDE7XHJcbiAgICAgIGN1cnNvcjogcG9pbnRlcjtcclxuICAgICAgcGFkZGluZzogMDtcclxuICAgICAgdHJhbnNpdGlvbjogdHJhbnNmb3JtIDAuMTJzIGVhc2UsIGJhY2tncm91bmQgMC4xMnMgZWFzZTtcclxuICAgIH1cclxuXHJcbiAgICAucXVpY2stZW1vamktYnRuOmhvdmVyIHtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjE4KTtcclxuICAgICAgdHJhbnNmb3JtOiBzY2FsZSgxLjE0KTtcclxuICAgIH1cclxuXHJcbiAgICAucmVhY3Rpb25zLXJvdyB7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGZsZXgtd3JhcDogd3JhcDtcclxuICAgICAgZ2FwOiAzcHg7XHJcbiAgICAgIG1hcmdpbi10b3A6IDVweDtcclxuICAgIH1cclxuXHJcbiAgICAucmVhY3Rpb24tY2hpcCB7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LDI1NSwyNTUsMC4wOCk7XHJcbiAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHJnYmEoMjU1LDI1NSwyNTUsMC4yKTtcclxuICAgICAgYm9yZGVyLXJhZGl1czogOTk5cHg7XHJcbiAgICAgIHBhZGRpbmc6IDJweCA3cHg7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTFweDtcclxuICAgICAgY29sb3I6ICNmMmY2ZmY7XHJcbiAgICAgIGN1cnNvcjogcG9pbnRlcjtcclxuICAgICAgdHJhbnNpdGlvbjogYWxsIDAuMnM7XHJcbiAgICAgIGRpc3BsYXk6IGlubGluZS1mbGV4O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBnYXA6IDNweDtcclxuICAgICAgbWF4LXdpZHRoOiAxODBweDtcclxuICAgIH1cclxuXHJcbiAgICAucmVhY3Rpb24tY2hpcDpob3ZlciB7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LDI1NSwyNTUsMC4yNSk7XHJcbiAgICAgIHRyYW5zZm9ybTogc2NhbGUoMS4wNSk7XHJcbiAgICB9XHJcblxyXG4gICAgLnJlYWN0aW9uLWNoaXAub3duLXJlYWN0aW9uIHtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSg0Miw5MSwyNTUsMC4zKTtcclxuICAgICAgYm9yZGVyLWNvbG9yOiByZ2JhKDQyLDkxLDI1NSwwLjUpO1xyXG4gICAgfVxyXG5cclxuICAgIC5lbXB0eS1jaGF0IHtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XHJcbiAgICAgIGZsZXg6IDE7XHJcbiAgICAgIGNvbG9yOiAjOWNhM2FmO1xyXG4gICAgfVxyXG5cclxuICAgIC5lbXB0eS1jaGF0IG1hdC1pY29uIHtcclxuICAgICAgZm9udC1zaXplOiA0OHB4O1xyXG4gICAgICB3aWR0aDogNDhweDtcclxuICAgICAgaGVpZ2h0OiA0OHB4O1xyXG4gICAgICBtYXJnaW4tYm90dG9tOiA4cHg7XHJcbiAgICB9XHJcblxyXG4gICAgLmVtcHR5LWNoYXQgcCB7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTRweDtcclxuICAgICAgbWFyZ2luOiAwO1xyXG4gICAgfVxyXG5cclxuICAgIC5tZXNzYWdlLWNvbnRleHQtbWVudSB7XHJcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcclxuICAgICAgei1pbmRleDogMTAwMDA7XHJcbiAgICAgIG1pbi13aWR0aDogMTUwcHg7XHJcbiAgICAgIHBhZGRpbmc6IDZweDtcclxuICAgICAgYm9yZGVyOiAxcHggc29saWQgcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjE0KTtcclxuICAgICAgYm9yZGVyLXJhZGl1czogMTJweDtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSg3LCAxNywgMzAsIDAuOTgpO1xyXG4gICAgICBib3gtc2hhZG93OiAwIDE4cHggNDVweCByZ2JhKDAsIDAsIDAsIDAuMzgpO1xyXG4gICAgICBjb2xvcjogI2Y4ZmFmYztcclxuICAgIH1cclxuXHJcbiAgICAuY29udGV4dC1tZW51LWl0ZW0ge1xyXG4gICAgICB3aWR0aDogMTAwJTtcclxuICAgICAgYm9yZGVyOiAwO1xyXG4gICAgICBib3JkZXItcmFkaXVzOiA5cHg7XHJcbiAgICAgIHBhZGRpbmc6IDlweCAxMHB4O1xyXG4gICAgICBiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudDtcclxuICAgICAgY29sb3I6IGluaGVyaXQ7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgIGdhcDogOXB4O1xyXG4gICAgICBjdXJzb3I6IHBvaW50ZXI7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTNweDtcclxuICAgICAgdGV4dC1hbGlnbjogbGVmdDtcclxuICAgIH1cclxuXHJcbiAgICAuY29udGV4dC1tZW51LWl0ZW06aG92ZXIge1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMDkpO1xyXG4gICAgfVxyXG5cclxuICAgIC5jb250ZXh0LW1lbnUtaXRlbSBtYXQtaWNvbiB7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTdweDtcclxuICAgICAgd2lkdGg6IDE3cHg7XHJcbiAgICAgIGhlaWdodDogMTdweDtcclxuICAgIH1cclxuXHJcbiAgICAuY29udGV4dC1tZW51LWl0ZW0uZGFuZ2VyIHtcclxuICAgICAgY29sb3I6ICNmZWNhY2E7XHJcbiAgICB9XHJcblxyXG4gICAgLmNvbnRleHQtbWVudS1jb25maXJtIHtcclxuICAgICAgcGFkZGluZzogOHB4O1xyXG4gICAgICB3aWR0aDogMTkwcHg7XHJcbiAgICB9XHJcblxyXG4gICAgLmNvbmZpcm0tdGl0bGUge1xyXG4gICAgICBjb2xvcjogI2Y4ZmFmYztcclxuICAgICAgZm9udC1zaXplOiAxM3B4O1xyXG4gICAgICBmb250LXdlaWdodDogNjAwO1xyXG4gICAgICBtYXJnaW4tYm90dG9tOiAxMHB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5jb25maXJtLWFjdGlvbnMge1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGZsZXgtZW5kO1xyXG4gICAgICBnYXA6IDhweDtcclxuICAgIH1cclxuXHJcbiAgICAuY29uZmlybS1jYW5jZWwsXHJcbiAgICAuY29uZmlybS1kZWxldGUge1xyXG4gICAgICBib3JkZXI6IDA7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDhweDtcclxuICAgICAgcGFkZGluZzogN3B4IDEwcHg7XHJcbiAgICAgIGNvbG9yOiAjZjhmYWZjO1xyXG4gICAgICBjdXJzb3I6IHBvaW50ZXI7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTJweDtcclxuICAgIH1cclxuXHJcbiAgICAuY29uZmlybS1jYW5jZWwge1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMTIpO1xyXG4gICAgfVxyXG5cclxuICAgIC5jb25maXJtLWRlbGV0ZSB7XHJcbiAgICAgIGJhY2tncm91bmQ6ICNkYzI2MjY7XHJcbiAgICB9XHJcbiAgYF0sXHJcbn0pXHJcbmV4cG9ydCBjbGFzcyBDaGF0VGhyZWFkQ29tcG9uZW50IGltcGxlbWVudHMgT25Jbml0LCBPbkRlc3Ryb3ksIEFmdGVyVmlld0NoZWNrZWQge1xyXG4gIEBWaWV3Q2hpbGQoJ3Njcm9sbENvbnRhaW5lcicpIHNjcm9sbENvbnRhaW5lciE6IEVsZW1lbnRSZWY7XHJcbiAgQFZpZXdDaGlsZCgndGhyZWFkUm9vdCcpIHRocmVhZFJvb3QhOiBFbGVtZW50UmVmPEhUTUxFbGVtZW50PjtcclxuICBAVmlld0NoaWxkcmVuKCdpbmxpbmVFZGl0VGV4dGFyZWEnKSBpbmxpbmVFZGl0VGV4dGFyZWFzITogUXVlcnlMaXN0PEVsZW1lbnRSZWY8SFRNTFRleHRBcmVhRWxlbWVudD4+O1xyXG4gIEBWaWV3Q2hpbGQoTWVzc2FnZUlucHV0Q29tcG9uZW50KSBtZXNzYWdlSW5wdXQ/OiBNZXNzYWdlSW5wdXRDb21wb25lbnQ7XHJcbiAgQE91dHB1dCgpIGxpZ2h0Ym94T3BlbiA9IG5ldyBFdmVudEVtaXR0ZXI8c3RyaW5nPigpO1xyXG5cclxuICBtZXNzYWdlczogTWVzc2FnZVtdID0gW107XHJcbiAgdmlzaWJsZUNvbnRhY3RzOiBDb250YWN0W10gPSBbXTtcclxuICBjb252ZXJzYXRpb25OYW1lID0gJyc7XHJcbiAgaXNHcm91cCA9IGZhbHNlO1xyXG4gIGlzUHJvamVjdCA9IGZhbHNlO1xyXG4gIGlzUHJvamVjdFN1Ymdyb3VwID0gZmFsc2U7XHJcbiAgcHJvamVjdERiR2lkOiBzdHJpbmcgfCB1bmRlZmluZWQ7XHJcbiAgcHJvamVjdEdpZDogc3RyaW5nIHwgdW5kZWZpbmVkO1xyXG4gIHBhcmVudENvbnZlcnNhdGlvbklkOiBzdHJpbmcgfCB1bmRlZmluZWQ7XHJcbiAgc3ViZ3JvdXBTdWJqZWN0OiBzdHJpbmcgfCB1bmRlZmluZWQ7XHJcbiAgaXNSZW1vdmVkRnJvbUdyb3VwID0gZmFsc2U7XHJcbiAgbWVzc2FnZVRleHRTY2FsZSA9IDE7XHJcbiAgY29kZVRleHRTY2FsZSA9IDE7XHJcbiAgbG9hZGluZyA9IGZhbHNlO1xyXG4gIG15Q29udGFjdElkOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcclxuICByZXBseVRvTWVzc2FnZTogTWVzc2FnZSB8IG51bGwgPSBudWxsO1xyXG4gIGVkaXRpbmdNZXNzYWdlOiBNZXNzYWdlIHwgbnVsbCA9IG51bGw7XHJcbiAgZWRpdGluZ0RyYWZ0ID0gJyc7XHJcbiAgbWVudGlvbk9wdGlvbnM6IE1lbnRpb25PcHRpb25bXSA9IFtdO1xyXG5cclxuICBjb252ZXJzYXRpb25JZDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XHJcbiAgcHJpdmF0ZSBzdWIhOiBTdWJzY3JpcHRpb247XHJcbiAgcHJpdmF0ZSBzaG91bGRTY3JvbGxUb0JvdHRvbSA9IHRydWU7XHJcblxyXG4gIHVwbG9hZGluZyA9IGZhbHNlO1xyXG4gIGhvdmVyZWRNZXNzYWdlSWQ6IHN0cmluZyB8IG51bGwgPSBudWxsO1xyXG4gIG1lc3NhZ2VDb250ZXh0TWVudTogeyBtZXNzYWdlOiBNZXNzYWdlOyB4OiBudW1iZXI7IHk6IG51bWJlcjsgY29uZmlybURlbGV0ZTogYm9vbGVhbiB9IHwgbnVsbCA9IG51bGw7XHJcbiAgcXVpY2tFbW9qaXMgPSBbJ+KdpO+4jycsICfwn5GNJywgJ/CfmIInLCAn8J+YricsICfwn5iiJywgJ/CflKUnXTtcclxuICB0aHJlYWREcmFnT3ZlciA9IGZhbHNlO1xyXG4gIHByaXZhdGUgdGhyZWFkRHJhZ0RlcHRoID0gMDtcclxuICBwcml2YXRlIGJvdW5kUmVzZXRUaHJlYWREcmFnID0gdGhpcy5yZXNldFRocmVhZERyYWcuYmluZCh0aGlzKTtcclxuXHJcbiAgLyoqIFRyYWNrcyB3aGljaCBmaWxlIElEcyBhcmUgY3VycmVudGx5IGJlaW5nIGZldGNoZWQgdG8gYXZvaWQgZHVwbGljYXRlIHJlcXVlc3RzICovXHJcbiAgcHJpdmF0ZSBtZWRpYUxvYWRpbmcgPSBuZXcgU2V0PHN0cmluZz4oKTtcclxuICAvKiogVHJhY2tzIGZpbGUgSURzIHdoZXJlIHJldHJpZXZhbCBmYWlsZWQgc28gVUkgZG9lc24ndCBzcGluIGZvcmV2ZXIuICovXHJcbiAgcHJpdmF0ZSBtZWRpYUZhaWxlZCA9IG5ldyBTZXQ8c3RyaW5nPigpO1xyXG4gIHByaXZhdGUgbWVkaWFRdWV1ZTogc3RyaW5nW10gPSBbXTtcclxuICBwcml2YXRlIGFjdGl2ZU1lZGlhUmVxdWVzdHMgPSAwO1xyXG4gIHByaXZhdGUgcmVhZG9ubHkgbWF4TWVkaWFSZXF1ZXN0cyA9IDI7XHJcbiAgcHJpdmF0ZSBsYXN0TWVudGlvbkNvbnZlcnNhdGlvbklkOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcclxuICBwcml2YXRlIGxhc3RHcm91cE1lbWJlcnNoaXBWZXJzaW9uID0gLTE7XHJcblxyXG4gIGNvbnN0cnVjdG9yKFxyXG4gICAgcHJpdmF0ZSBzdG9yZTogTWVzc2FnaW5nU3RvcmVTZXJ2aWNlLFxyXG4gICAgcHJpdmF0ZSBhcGk6IE1lc3NhZ2luZ0FwaVNlcnZpY2UsXHJcbiAgICBwcml2YXRlIGF1dGg6IEF1dGhTZXJ2aWNlLFxyXG4gICAgcHJpdmF0ZSBmaWxlU2VydmljZTogTWVzc2FnaW5nRmlsZVNlcnZpY2UsXHJcbiAgICBwcml2YXRlIGNkcjogQ2hhbmdlRGV0ZWN0b3JSZWYsXHJcbiAgICBwcml2YXRlIHNhbml0aXplcjogRG9tU2FuaXRpemVyLFxyXG4gICkge31cclxuXHJcbiAgbmdPbkluaXQoKTogdm9pZCB7XHJcbiAgICB0aGlzLm15Q29udGFjdElkID0gdGhpcy5hdXRoLmNvbnRhY3RJZDtcclxuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2Ryb3AnLCB0aGlzLmJvdW5kUmVzZXRUaHJlYWREcmFnLCB0cnVlKTtcclxuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2RyYWdlbmQnLCB0aGlzLmJvdW5kUmVzZXRUaHJlYWREcmFnLCB0cnVlKTtcclxuXHJcbiAgICB0aGlzLnN1YiA9IGNvbWJpbmVMYXRlc3QoW1xyXG4gICAgICB0aGlzLnN0b3JlLmFjdGl2ZUNvbnZlcnNhdGlvbklkLFxyXG4gICAgICB0aGlzLnN0b3JlLm1lc3NhZ2VzTWFwLFxyXG4gICAgICB0aGlzLnN0b3JlLm9wZW5DaGF0cyxcclxuICAgICAgdGhpcy5zdG9yZS52aXNpYmxlQ29udGFjdHMsXHJcbiAgICAgIHRoaXMuc3RvcmUubG9hZGluZ01lc3NhZ2VzLFxyXG4gICAgICB0aGlzLnN0b3JlLnJlbW92ZWRHcm91cElkcyxcclxuICAgICAgdGhpcy5zdG9yZS5tZXNzYWdlVGV4dFNjYWxlLFxyXG4gICAgICB0aGlzLnN0b3JlLmNvZGVUZXh0U2NhbGUsXHJcbiAgICAgIHRoaXMuc3RvcmUuZ3JvdXBNZW1iZXJzaGlwVmVyc2lvbixcclxuICAgIF0pLnN1YnNjcmliZSgoW2NvbnZJZCwgbXNnTWFwLCBjaGF0cywgY29udGFjdHMsIGxvYWRpbmcsIHJlbW92ZWRHcm91cElkcywgbWVzc2FnZVRleHRTY2FsZSwgY29kZVRleHRTY2FsZSwgZ3JvdXBNZW1iZXJzaGlwVmVyc2lvbl0pID0+IHtcclxuICAgICAgdGhpcy5sb2FkaW5nID0gbG9hZGluZztcclxuICAgICAgdGhpcy52aXNpYmxlQ29udGFjdHMgPSBjb250YWN0cyB8fCBbXTtcclxuICAgICAgdGhpcy5tZXNzYWdlVGV4dFNjYWxlID0gbWVzc2FnZVRleHRTY2FsZTtcclxuICAgICAgdGhpcy5jb2RlVGV4dFNjYWxlID0gY29kZVRleHRTY2FsZTtcclxuICAgICAgaWYgKHRoaXMuaXNHcm91cCAmJiB0aGlzLmNvbnZlcnNhdGlvbklkICYmIHRoaXMubWVudGlvbk9wdGlvbnMubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgICAgdGhpcy5yZWZyZXNoTWVudGlvbk9wdGlvbnMoKTtcclxuICAgICAgfVxyXG4gICAgICBpZiAoXHJcbiAgICAgICAgdGhpcy5pc0dyb3VwICYmXHJcbiAgICAgICAgdGhpcy5jb252ZXJzYXRpb25JZCAmJlxyXG4gICAgICAgIGdyb3VwTWVtYmVyc2hpcFZlcnNpb24gIT09IHRoaXMubGFzdEdyb3VwTWVtYmVyc2hpcFZlcnNpb25cclxuICAgICAgKSB7XHJcbiAgICAgICAgdGhpcy5sYXN0R3JvdXBNZW1iZXJzaGlwVmVyc2lvbiA9IGdyb3VwTWVtYmVyc2hpcFZlcnNpb247XHJcbiAgICAgICAgdGhpcy5yZWZyZXNoTWVudGlvbk9wdGlvbnModHJ1ZSk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGlmIChjb252SWQgJiYgY29udklkICE9PSB0aGlzLmNvbnZlcnNhdGlvbklkKSB7XHJcbiAgICAgICAgdGhpcy5jb252ZXJzYXRpb25JZCA9IGNvbnZJZDtcclxuICAgICAgICB0aGlzLnJlc2V0TWVkaWFRdWV1ZSgpO1xyXG4gICAgICAgIHRoaXMuY2xlYXJSZXBseSgpO1xyXG4gICAgICAgIHRoaXMuY2xlYXJFZGl0KCk7XHJcbiAgICAgICAgdGhpcy5zaG91bGRTY3JvbGxUb0JvdHRvbSA9IHRydWU7XHJcbiAgICAgICAgY29uc3QgY2hhdCA9IGNoYXRzLmZpbmQoKGMpID0+IGMuY29udmVyc2F0aW9uSWQgPT09IGNvbnZJZCk7XHJcbiAgICAgICAgdGhpcy5jb252ZXJzYXRpb25OYW1lID0gY2hhdD8ubmFtZSB8fCAnQ2hhdCc7XHJcbiAgICAgICAgdGhpcy5pc0dyb3VwID0gY2hhdD8uaXNHcm91cCB8fCBmYWxzZTtcclxuICAgICAgICB0aGlzLmlzUHJvamVjdCA9IGNoYXQ/LmlzUHJvamVjdCB8fCBmYWxzZTtcclxuICAgICAgICB0aGlzLmlzUHJvamVjdFN1Ymdyb3VwID0gY2hhdD8uaXNQcm9qZWN0U3ViZ3JvdXAgfHwgZmFsc2U7XHJcbiAgICAgICAgdGhpcy5wcm9qZWN0RGJHaWQgPSBjaGF0Py5kYkdpZDtcclxuICAgICAgICB0aGlzLnByb2plY3RHaWQgPSBjaGF0Py5wcm9qZWN0R2lkO1xyXG4gICAgICAgIHRoaXMucGFyZW50Q29udmVyc2F0aW9uSWQgPSBjaGF0Py5wYXJlbnRDb252ZXJzYXRpb25JZDtcclxuICAgICAgICB0aGlzLnN1Ymdyb3VwU3ViamVjdCA9IGNoYXQ/LnN1Ymdyb3VwU3ViamVjdDtcclxuICAgICAgICB0aGlzLnJlZnJlc2hNZW50aW9uT3B0aW9ucyh0cnVlKTtcclxuICAgICAgfVxyXG5cclxuICAgICAgaWYgKHRoaXMuY29udmVyc2F0aW9uSWQpIHtcclxuICAgICAgICBjb25zdCBwcmV2TGVuID0gdGhpcy5tZXNzYWdlcy5sZW5ndGg7XHJcbiAgICAgICAgdGhpcy5tZXNzYWdlcyA9IG1zZ01hcC5nZXQodGhpcy5jb252ZXJzYXRpb25JZCkgfHwgW107XHJcbiAgICAgICAgaWYgKHRoaXMubWVzc2FnZXMubGVuZ3RoID4gcHJldkxlbikge1xyXG4gICAgICAgICAgdGhpcy5zaG91bGRTY3JvbGxUb0JvdHRvbSA9IHRydWU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIC8vIFByZS13YXJtIG1lZGlhIGNhY2hlIGZvciBhbnkgaW1hZ2UvZmlsZSBtZXNzYWdlcyB2aXNpYmxlXHJcbiAgICAgICAgdGhpcy5wcmV3YXJtTWVkaWEodGhpcy5tZXNzYWdlcyk7XHJcbiAgICAgIH1cclxuICAgICAgdGhpcy5pc1JlbW92ZWRGcm9tR3JvdXAgPSAhIXRoaXMuY29udmVyc2F0aW9uSWQgJiYgcmVtb3ZlZEdyb3VwSWRzLmhhcyhTdHJpbmcodGhpcy5jb252ZXJzYXRpb25JZCkpO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBuZ0FmdGVyVmlld0NoZWNrZWQoKTogdm9pZCB7XHJcbiAgICBpZiAodGhpcy5zaG91bGRTY3JvbGxUb0JvdHRvbSkge1xyXG4gICAgICB0aGlzLnNjcm9sbFRvQm90dG9tKCk7XHJcbiAgICAgIHRoaXMuc2hvdWxkU2Nyb2xsVG9Cb3R0b20gPSBmYWxzZTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIG5nT25EZXN0cm95KCk6IHZvaWQge1xyXG4gICAgdGhpcy5zdWI/LnVuc3Vic2NyaWJlKCk7XHJcbiAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdkcm9wJywgdGhpcy5ib3VuZFJlc2V0VGhyZWFkRHJhZywgdHJ1ZSk7XHJcbiAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdkcmFnZW5kJywgdGhpcy5ib3VuZFJlc2V0VGhyZWFkRHJhZywgdHJ1ZSk7XHJcbiAgfVxyXG5cclxuICBnb0JhY2soKTogdm9pZCB7XHJcbiAgICB0aGlzLnN0b3JlLnNldFZpZXcoJ2luYm94Jyk7XHJcbiAgfVxyXG5cclxuICBvbkNsZWFyQ29udmVyc2F0aW9uKCk6IHZvaWQge1xyXG4gICAgaWYgKHRoaXMuY29udmVyc2F0aW9uSWQpIHtcclxuICAgICAgdGhpcy5zdG9yZS5jbGVhckNvbnZlcnNhdGlvbih0aGlzLmNvbnZlcnNhdGlvbklkKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIG9uRGVsZXRlQ29udmVyc2F0aW9uKCk6IHZvaWQge1xyXG4gICAgaWYgKHRoaXMuY29udmVyc2F0aW9uSWQpIHtcclxuICAgICAgdGhpcy5zdG9yZS5kZWxldGVDb252ZXJzYXRpb24odGhpcy5jb252ZXJzYXRpb25JZCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBvbkdyb3VwU2V0dGluZ3MoKTogdm9pZCB7XHJcbiAgICBpZiAodGhpcy5pc1JlbW92ZWRGcm9tR3JvdXApIHJldHVybjtcclxuICAgIGlmICh0aGlzLmNvbnZlcnNhdGlvbklkKSB7XHJcbiAgICAgIHRoaXMuc3RvcmUub3Blbkdyb3VwU2V0dGluZ3MoXHJcbiAgICAgICAgdGhpcy5jb252ZXJzYXRpb25JZCxcclxuICAgICAgICB0aGlzLmNvbnZlcnNhdGlvbk5hbWUsXHJcbiAgICAgICAgdGhpcy5pc1Byb2plY3QsXHJcbiAgICAgICAgdGhpcy5pc1Byb2plY3RTdWJncm91cCxcclxuICAgICAgICB0aGlzLnByb2plY3REYkdpZCxcclxuICAgICAgICB0aGlzLnByb2plY3RHaWQsXHJcbiAgICAgICAgdGhpcy5wYXJlbnRDb252ZXJzYXRpb25JZCxcclxuICAgICAgICB0aGlzLnN1Ymdyb3VwU3ViamVjdCxcclxuICAgICAgKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHN0YXJ0UmVwbHkobWVzc2FnZTogTWVzc2FnZSwgZXZlbnQ/OiBFdmVudCk6IHZvaWQge1xyXG4gICAgZXZlbnQ/LnN0b3BQcm9wYWdhdGlvbigpO1xyXG4gICAgaWYgKHRoaXMuaXNEZWxldGVkTWVzc2FnZShtZXNzYWdlKSB8fCB0aGlzLmlzU3lzdGVtTWVzc2FnZShtZXNzYWdlKSkgcmV0dXJuO1xyXG4gICAgdGhpcy5jbGVhckVkaXQoKTtcclxuICAgIHRoaXMucmVwbHlUb01lc3NhZ2UgPSBtZXNzYWdlO1xyXG4gICAgdGhpcy5tZXNzYWdlSW5wdXQ/LmZvY3VzKCk7XHJcbiAgfVxyXG5cclxuICBvcGVuTWVzc2FnZUNvbnRleHRNZW51KG1lc3NhZ2U6IE1lc3NhZ2UsIGV2ZW50OiBNb3VzZUV2ZW50KTogdm9pZCB7XHJcbiAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XHJcbiAgICBpZiAodGhpcy5pc0RlbGV0ZWRNZXNzYWdlKG1lc3NhZ2UpIHx8IHRoaXMuaXNTeXN0ZW1NZXNzYWdlKG1lc3NhZ2UpKSByZXR1cm47XHJcblxyXG4gICAgY29uc3QgaGFzQWN0aW9ucyA9XHJcbiAgICAgIHRoaXMuY2FuUmVwbHlNZXNzYWdlKG1lc3NhZ2UpIHx8XHJcbiAgICAgIHRoaXMuY2FuRWRpdE1lc3NhZ2UobWVzc2FnZSkgfHxcclxuICAgICAgdGhpcy5jYW5EZWxldGVNZXNzYWdlKG1lc3NhZ2UpO1xyXG4gICAgaWYgKCFoYXNBY3Rpb25zKSByZXR1cm47XHJcblxyXG4gICAgdGhpcy5tZXNzYWdlQ29udGV4dE1lbnUgPSB7XHJcbiAgICAgIG1lc3NhZ2UsXHJcbiAgICAgIC4uLnRoaXMuZ2V0Q29udGV4dE1lbnVQb3NpdGlvbihldmVudCksXHJcbiAgICAgIGNvbmZpcm1EZWxldGU6IGZhbHNlLFxyXG4gICAgfTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgZ2V0Q29udGV4dE1lbnVQb3NpdGlvbihldmVudDogTW91c2VFdmVudCk6IHsgeDogbnVtYmVyOyB5OiBudW1iZXIgfSB7XHJcbiAgICBjb25zdCByZWN0ID0gdGhpcy50aHJlYWRSb290Py5uYXRpdmVFbGVtZW50Py5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcclxuICAgIGlmICghcmVjdCkge1xyXG4gICAgICByZXR1cm4ge1xyXG4gICAgICAgIHg6IE1hdGgubWluKGV2ZW50LmNsaWVudFgsIHdpbmRvdy5pbm5lcldpZHRoIC0gMjIwKSxcclxuICAgICAgICB5OiBNYXRoLm1pbihldmVudC5jbGllbnRZLCB3aW5kb3cuaW5uZXJIZWlnaHQgLSAxNjApLFxyXG4gICAgICB9O1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IG1lbnVXaWR0aCA9IDIxMDtcclxuICAgIGNvbnN0IG1lbnVIZWlnaHQgPSAxNzA7XHJcbiAgICBjb25zdCBwYWRkaW5nID0gODtcclxuICAgIGNvbnN0IHJhd1ggPSBldmVudC5jbGllbnRYIC0gcmVjdC5sZWZ0O1xyXG4gICAgY29uc3QgcmF3WSA9IGV2ZW50LmNsaWVudFkgLSByZWN0LnRvcDtcclxuICAgIHJldHVybiB7XHJcbiAgICAgIHg6IE1hdGgubWF4KHBhZGRpbmcsIE1hdGgubWluKHJhd1gsIHJlY3Qud2lkdGggLSBtZW51V2lkdGggLSBwYWRkaW5nKSksXHJcbiAgICAgIHk6IE1hdGgubWF4KHBhZGRpbmcsIE1hdGgubWluKHJhd1ksIHJlY3QuaGVpZ2h0IC0gbWVudUhlaWdodCAtIHBhZGRpbmcpKSxcclxuICAgIH07XHJcbiAgfVxyXG5cclxuICBjbG9zZU1lc3NhZ2VDb250ZXh0TWVudSgpOiB2b2lkIHtcclxuICAgIHRoaXMubWVzc2FnZUNvbnRleHRNZW51ID0gbnVsbDtcclxuICB9XHJcblxyXG4gIHJlcGx5RnJvbUNvbnRleHRNZW51KCk6IHZvaWQge1xyXG4gICAgY29uc3QgbWVzc2FnZSA9IHRoaXMubWVzc2FnZUNvbnRleHRNZW51Py5tZXNzYWdlO1xyXG4gICAgaWYgKCFtZXNzYWdlIHx8ICF0aGlzLmNhblJlcGx5TWVzc2FnZShtZXNzYWdlKSkgcmV0dXJuO1xyXG4gICAgdGhpcy5zdGFydFJlcGx5KG1lc3NhZ2UpO1xyXG4gICAgdGhpcy5jbG9zZU1lc3NhZ2VDb250ZXh0TWVudSgpO1xyXG4gIH1cclxuXHJcbiAgZWRpdEZyb21Db250ZXh0TWVudSgpOiB2b2lkIHtcclxuICAgIGNvbnN0IG1lc3NhZ2UgPSB0aGlzLm1lc3NhZ2VDb250ZXh0TWVudT8ubWVzc2FnZTtcclxuICAgIGlmICghbWVzc2FnZSB8fCAhdGhpcy5jYW5FZGl0TWVzc2FnZShtZXNzYWdlKSkgcmV0dXJuO1xyXG4gICAgdGhpcy5jbG9zZU1lc3NhZ2VDb250ZXh0TWVudSgpO1xyXG4gICAgdGhpcy5zdGFydEVkaXRNZXNzYWdlKG1lc3NhZ2UpO1xyXG4gIH1cclxuXHJcbiAgcmVxdWVzdERlbGV0ZUZyb21Db250ZXh0TWVudSgpOiB2b2lkIHtcclxuICAgIGlmICghdGhpcy5tZXNzYWdlQ29udGV4dE1lbnUgfHwgIXRoaXMuY2FuRGVsZXRlTWVzc2FnZSh0aGlzLm1lc3NhZ2VDb250ZXh0TWVudS5tZXNzYWdlKSkgcmV0dXJuO1xyXG4gICAgdGhpcy5tZXNzYWdlQ29udGV4dE1lbnUgPSB7IC4uLnRoaXMubWVzc2FnZUNvbnRleHRNZW51LCBjb25maXJtRGVsZXRlOiB0cnVlIH07XHJcbiAgfVxyXG5cclxuICBjb25maXJtRGVsZXRlRnJvbUNvbnRleHRNZW51KCk6IHZvaWQge1xyXG4gICAgY29uc3QgbWVzc2FnZSA9IHRoaXMubWVzc2FnZUNvbnRleHRNZW51Py5tZXNzYWdlO1xyXG4gICAgaWYgKCFtZXNzYWdlIHx8ICF0aGlzLmNhbkRlbGV0ZU1lc3NhZ2UobWVzc2FnZSkpIHJldHVybjtcclxuICAgIHRoaXMuY2xvc2VNZXNzYWdlQ29udGV4dE1lbnUoKTtcclxuICAgIHRoaXMuc3RvcmUuZGVsZXRlTWVzc2FnZShtZXNzYWdlLm1lc3NhZ2VfaWQpO1xyXG4gIH1cclxuXHJcbiAgY2xlYXJSZXBseSgpOiB2b2lkIHtcclxuICAgIHRoaXMucmVwbHlUb01lc3NhZ2UgPSBudWxsO1xyXG4gIH1cclxuXHJcbiAgY2xlYXJFZGl0KCk6IHZvaWQge1xyXG4gICAgdGhpcy5lZGl0aW5nTWVzc2FnZSA9IG51bGw7XHJcbiAgICB0aGlzLmVkaXRpbmdEcmFmdCA9ICcnO1xyXG4gIH1cclxuXHJcbiAgZ2V0UmVwbHlQcmV2aWV3KG1lc3NhZ2U6IE1lc3NhZ2UpOiBSZXBseVByZXZpZXcgfCBudWxsIHtcclxuICAgIGNvbnN0IHJlcGx5ID0gbWVzc2FnZS5yZXBseV90bztcclxuICAgIGlmICghcmVwbHkpIHJldHVybiBudWxsO1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgc2VuZGVyTmFtZTogcmVwbHkuc2VuZGVyX25hbWUgfHwgJ01lc3NhZ2UnLFxyXG4gICAgICBjb250ZW50OiB0aGlzLnRydW5jYXRlUmVwbHlUZXh0KHJlcGx5LmNvbnRlbnQgfHwgJ0F0dGFjaG1lbnQnKSxcclxuICAgIH07XHJcbiAgfVxyXG5cclxuICBnZXRDb21wb3NlUmVwbHlQcmV2aWV3KG1lc3NhZ2U6IE1lc3NhZ2UpOiBSZXBseVByZXZpZXcge1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgc2VuZGVyTmFtZTogdGhpcy5nZXRTZW5kZXJOYW1lKG1lc3NhZ2UpLFxyXG4gICAgICBjb250ZW50OiB0aGlzLnRydW5jYXRlUmVwbHlUZXh0KHRoaXMuZ2V0TWVzc2FnZUJvZHkobWVzc2FnZSkgfHwgdGhpcy5nZXRBdHRhY2htZW50TmFtZShtZXNzYWdlKSksXHJcbiAgICB9O1xyXG4gIH1cclxuXHJcbiAgZ2V0TWVzc2FnZUJvZHkobWVzc2FnZTogTWVzc2FnZSk6IHN0cmluZyB7XHJcbiAgICBpZiAodGhpcy5pc0RlbGV0ZWRNZXNzYWdlKG1lc3NhZ2UpKSByZXR1cm4gJ1tUaGlzIG1lc3NhZ2Ugd2FzIGRlbGV0ZWRdJztcclxuICAgIHJldHVybiBTdHJpbmcobWVzc2FnZS5jb250ZW50IHx8ICcnKTtcclxuICB9XHJcblxyXG4gIGlzRGVsZXRlZE1lc3NhZ2UobWVzc2FnZTogTWVzc2FnZSk6IGJvb2xlYW4ge1xyXG4gICAgcmV0dXJuIEJvb2xlYW4obWVzc2FnZS5pc19kZWxldGVkIHx8IG1lc3NhZ2UuZGVsZXRlZF9hdCB8fCBtZXNzYWdlLmNvbnRlbnQgPT09ICdbZGVsZXRlZF0nKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgdHJ1bmNhdGVSZXBseVRleHQodmFsdWU6IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgICBjb25zdCB0ZXh0ID0gU3RyaW5nKHZhbHVlIHx8ICcnKS5yZXBsYWNlKC9cXHMrL2csICcgJykudHJpbSgpO1xyXG4gICAgcmV0dXJuIHRleHQubGVuZ3RoID4gMTIwID8gYCR7dGV4dC5zbGljZSgwLCAxMTcpfS4uLmAgOiB0ZXh0IHx8ICdBdHRhY2htZW50JztcclxuICB9XHJcblxyXG4gIHByaXZhdGUgcmVmcmVzaE1lbnRpb25PcHRpb25zKGZvcmNlID0gZmFsc2UpOiB2b2lkIHtcclxuICAgIGlmICghdGhpcy5pc0dyb3VwIHx8ICF0aGlzLmNvbnZlcnNhdGlvbklkKSB7XHJcbiAgICAgIHRoaXMubWVudGlvbk9wdGlvbnMgPSBbXTtcclxuICAgICAgdGhpcy5sYXN0TWVudGlvbkNvbnZlcnNhdGlvbklkID0gbnVsbDtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGNvbnZJZCA9IHRoaXMuY29udmVyc2F0aW9uSWQ7XHJcbiAgICBpZiAoIWZvcmNlICYmIHRoaXMubGFzdE1lbnRpb25Db252ZXJzYXRpb25JZCA9PT0gY29udklkICYmIHRoaXMubWVudGlvbk9wdGlvbnMubGVuZ3RoID4gMCkgcmV0dXJuO1xyXG4gICAgdGhpcy5sYXN0TWVudGlvbkNvbnZlcnNhdGlvbklkID0gY29udklkO1xyXG5cclxuICAgIHRoaXMuYXBpLmdldENvbnZlcnNhdGlvblBhcnRpY2lwYW50cyhjb252SWQpLnN1YnNjcmliZSh7XHJcbiAgICAgIG5leHQ6IChtZW1iZXJzKSA9PiB7XHJcbiAgICAgICAgY29uc3Qgb3B0aW9ucyA9IG1lbWJlcnNcclxuICAgICAgICAgIC5maWx0ZXIoKG1lbWJlcikgPT4gU3RyaW5nKG1lbWJlci5jb250YWN0X2lkKSAhPT0gU3RyaW5nKHRoaXMuYXV0aC5jb250YWN0SWQgfHwgJycpKVxyXG4gICAgICAgICAgLm1hcCgobWVtYmVyKSA9PiB0aGlzLnBhcnRpY2lwYW50VG9NZW50aW9uT3B0aW9uKG1lbWJlcikpXHJcbiAgICAgICAgICAuZmlsdGVyKChvcHRpb24pOiBvcHRpb24gaXMgTWVudGlvbk9wdGlvbiA9PiAhIW9wdGlvbik7XHJcbiAgICAgICAgdGhpcy5tZW50aW9uT3B0aW9ucyA9IG9wdGlvbnMubGVuZ3RoID8gb3B0aW9ucyA6IHRoaXMuY29udGFjdHNUb01lbnRpb25PcHRpb25zKCk7XHJcbiAgICAgICAgdGhpcy5jZHIubWFya0ZvckNoZWNrKCk7XHJcbiAgICAgIH0sXHJcbiAgICAgIGVycm9yOiAoKSA9PiB7XHJcbiAgICAgICAgdGhpcy5tZW50aW9uT3B0aW9ucyA9IHRoaXMuY29udGFjdHNUb01lbnRpb25PcHRpb25zKCk7XHJcbiAgICAgICAgdGhpcy5jZHIubWFya0ZvckNoZWNrKCk7XHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgcGFydGljaXBhbnRUb01lbnRpb25PcHRpb24obWVtYmVyOiBDb252ZXJzYXRpb25QYXJ0aWNpcGFudCk6IE1lbnRpb25PcHRpb24gfCBudWxsIHtcclxuICAgIGNvbnN0IHRva2VuID0gdGhpcy50b01lbnRpb25Ub2tlbihtZW1iZXIudXNlcm5hbWUgfHwgbWVtYmVyLmVtYWlsIHx8IFN0cmluZyhtZW1iZXIuY29udGFjdF9pZCkpO1xyXG4gICAgaWYgKCF0b2tlbikgcmV0dXJuIG51bGw7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICBjb250YWN0SWQ6IFN0cmluZyhtZW1iZXIuY29udGFjdF9pZCksXHJcbiAgICAgIGxhYmVsOiBtZW1iZXIudXNlcm5hbWUgfHwgbWVtYmVyLmVtYWlsIHx8IGBDb250YWN0ICR7bWVtYmVyLmNvbnRhY3RfaWR9YCxcclxuICAgICAgdG9rZW4sXHJcbiAgICB9O1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBjb250YWN0c1RvTWVudGlvbk9wdGlvbnMoKTogTWVudGlvbk9wdGlvbltdIHtcclxuICAgIHJldHVybiB0aGlzLnZpc2libGVDb250YWN0c1xyXG4gICAgICAuZmlsdGVyKChjb250YWN0KSA9PiBTdHJpbmcoY29udGFjdC5jb250YWN0X2lkKSAhPT0gU3RyaW5nKHRoaXMuYXV0aC5jb250YWN0SWQgfHwgJycpKVxyXG4gICAgICAubWFwKChjb250YWN0KSA9PiB7XHJcbiAgICAgICAgY29uc3QgbGFiZWwgPSBnZXRDb250YWN0RGlzcGxheU5hbWUoY29udGFjdCk7XHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgIGNvbnRhY3RJZDogU3RyaW5nKGNvbnRhY3QuY29udGFjdF9pZCksXHJcbiAgICAgICAgICBsYWJlbCxcclxuICAgICAgICAgIHRva2VuOiB0aGlzLnRvTWVudGlvblRva2VuKGNvbnRhY3QudXNlcm5hbWUgfHwgY29udGFjdC5lbWFpbD8uc3BsaXQoJ0AnKVswXSB8fCBsYWJlbCksXHJcbiAgICAgICAgfTtcclxuICAgICAgfSlcclxuICAgICAgLmZpbHRlcigob3B0aW9uKSA9PiAhIW9wdGlvbi50b2tlbik7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHRvTWVudGlvblRva2VuKHZhbHVlOiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gICAgcmV0dXJuIFN0cmluZyh2YWx1ZSB8fCAnJylcclxuICAgICAgLnRyaW0oKVxyXG4gICAgICAucmVwbGFjZSgvXkAvLCAnJylcclxuICAgICAgLnJlcGxhY2UoL0AuKiQvLCAnJylcclxuICAgICAgLnJlcGxhY2UoL1teYS16QS1aMC05Ll8tXS9nLCAnJylcclxuICAgICAgLnNsaWNlKDAsIDMyKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgZ2V0TWVudGlvbklkc0Zyb21Db250ZW50KGNvbnRlbnQ6IHN0cmluZyk6IHN0cmluZ1tdIHtcclxuICAgIGlmICghdGhpcy5pc0dyb3VwIHx8ICFjb250ZW50IHx8ICF0aGlzLm1lbnRpb25PcHRpb25zLmxlbmd0aCkgcmV0dXJuIFtdO1xyXG4gICAgY29uc3QgbWVudGlvbmVkVG9rZW5zID0gbmV3IFNldChcclxuICAgICAgQXJyYXkuZnJvbShjb250ZW50Lm1hdGNoQWxsKC8oXnxbXmEtekEtWjAtOS5fLV0pQChbYS16QS1aMC05Ll8tXSspL2cpKVxyXG4gICAgICAgIC5tYXAoKG1hdGNoKSA9PiBtYXRjaFsyXS50b0xvd2VyQ2FzZSgpKVxyXG4gICAgKTtcclxuICAgIHJldHVybiB0aGlzLm1lbnRpb25PcHRpb25zXHJcbiAgICAgIC5maWx0ZXIoKG9wdGlvbikgPT4gbWVudGlvbmVkVG9rZW5zLmhhcyhvcHRpb24udG9rZW4udG9Mb3dlckNhc2UoKSkpXHJcbiAgICAgIC5tYXAoKG9wdGlvbikgPT4gb3B0aW9uLmNvbnRhY3RJZCk7XHJcbiAgfVxyXG5cclxuICBvblNlbmRNZXNzYWdlKHBheWxvYWQ6IE1lc3NhZ2VUZXh0UGF5bG9hZCk6IHZvaWQge1xyXG4gICAgaWYgKHRoaXMuaXNSZW1vdmVkRnJvbUdyb3VwKSByZXR1cm47XHJcbiAgICBjb25zdCBjb250ZW50ID0gcGF5bG9hZC50ZXh0O1xyXG4gICAgY29uc3QgbWVudGlvbnMgPSB0aGlzLmdldE1lbnRpb25JZHNGcm9tQ29udGVudChjb250ZW50KTtcclxuICAgIHRoaXMuc3RvcmUuc2VuZE1lc3NhZ2UodGhpcy5jb252ZXJzYXRpb25JZCwgY29udGVudCwgJ1RFWFQnLCB7XHJcbiAgICAgIHJlcGx5VG86IHRoaXMucmVwbHlUb01lc3NhZ2UsXHJcbiAgICAgIG1lbnRpb25zLFxyXG4gICAgICBmb3JjZVBsYWluVGV4dDogcGF5bG9hZC5mb3JjZVBsYWluVGV4dCxcclxuICAgIH0pO1xyXG4gICAgdGhpcy5jbGVhclJlcGx5KCk7XHJcbiAgICB0aGlzLnNob3VsZFNjcm9sbFRvQm90dG9tID0gdHJ1ZTtcclxuICB9XHJcblxyXG4gIG9uU2VuZFdpdGhGaWxlcyhwYXlsb2FkOiBNZXNzYWdlUGF5bG9hZCk6IHZvaWQge1xyXG4gICAgaWYgKHRoaXMuaXNSZW1vdmVkRnJvbUdyb3VwKSByZXR1cm47XHJcbiAgICBpZiAoIXRoaXMuY29udmVyc2F0aW9uSWQgfHwgIXRoaXMuYXV0aC5jb250YWN0SWQpIHJldHVybjtcclxuICAgIHRoaXMudXBsb2FkaW5nID0gdHJ1ZTtcclxuXHJcbiAgICAvLyBTdGVwIDE6IFVwbG9hZCBhbGwgZmlsZXMgYW5kIG9idGFpbiByZWFsIGZpbGVfaWRzIGZyb20gdGhlIHNlcnZlci5cclxuICAgIC8vIFRlbXAgSURzIGFyZSBORVZFUiBzZW50IHRvIGFueSBBUEkg4oCUIHdlIHdhaXQgZm9yIHJlYWwgSURzIGhlcmUuXHJcbiAgICB0aGlzLmZpbGVTZXJ2aWNlLnVwbG9hZEZpbGVzKHBheWxvYWQuZmlsZXMpLnN1YnNjcmliZSh7XHJcbiAgICAgIG5leHQ6IChyZXNwb25zZXMpID0+IHtcclxuICAgICAgICBjb25zdCBmaWxlSWRzICAgPSByZXNwb25zZXMubWFwKChyKSA9PiByLmZpbGVfaWQpO1xyXG4gICAgICAgIGNvbnN0IGZpbGVuYW1lcyA9IHJlc3BvbnNlcy5tYXAoKHIpID0+IHIuZmlsZW5hbWUpO1xyXG4gICAgICAgIGNvbnN0IG1pbWVUeXBlcyA9IHJlc3BvbnNlcy5tYXAoKHIsIGlkeCkgPT4gci5taW1lX3R5cGUgfHwgcGF5bG9hZC5maWxlc1tpZHhdPy50eXBlIHx8ICcnKTtcclxuXHJcbiAgICAgICAgLy8gR3VhcmQ6IGVuc3VyZSBhbGwgSURzIGFyZSByZWFsIChub3QgdGVtcClcclxuICAgICAgICBjb25zdCBoYXNUZW1wID0gZmlsZUlkcy5zb21lKGlkID0+IGlkPy5zdGFydHNXaXRoKCd0ZW1wLScpKTtcclxuICAgICAgICBpZiAoaGFzVGVtcCkge1xyXG4gICAgICAgICAgdGhpcy51cGxvYWRpbmcgPSBmYWxzZTtcclxuICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIFN0ZXAgMjogUHJlLXdhcm0gaW1hZ2UgY2FjaGUgc28gdGhlIG9wdGltaXN0aWMgYnViYmxlIHJlbmRlcnMgaW1tZWRpYXRlbHkuXHJcbiAgICAgICAgdGhpcy5maWxlU2VydmljZS5wcmV3YXJtQ2FjaGUoZmlsZUlkcyk7XHJcblxyXG4gICAgICAgIC8vIFN0ZXAgMzogU2VuZCB0aGUgbWVzc2FnZSB3aXRoIHRoZSByZWFsIGZpbGVfaWRzLlxyXG4gICAgICAgIGNvbnN0IG1lc3NhZ2VUZXh0ID0gcGF5bG9hZC50ZXh0IHx8IGZpbGVuYW1lcy5qb2luKCcsICcpO1xyXG4gICAgICAgIGNvbnN0IG91dGdvaW5nVGV4dCA9IHRoaXMuc3RvcmUucHJlcGFyZU91dGdvaW5nTWVzc2FnZUNvbnRlbnQobWVzc2FnZVRleHQsIHRoaXMucmVwbHlUb01lc3NhZ2UsIHBheWxvYWQuZm9yY2VQbGFpblRleHQpO1xyXG4gICAgICAgIGNvbnN0IHJlcGx5VG8gPSB0aGlzLnJlcGx5VG9NZXNzYWdlID8ge1xyXG4gICAgICAgICAgbWVzc2FnZV9pZDogU3RyaW5nKHRoaXMucmVwbHlUb01lc3NhZ2UubWVzc2FnZV9pZCB8fCAnJyksXHJcbiAgICAgICAgICBzZW5kZXJfbmFtZTogdGhpcy5nZXRTZW5kZXJOYW1lKHRoaXMucmVwbHlUb01lc3NhZ2UpLFxyXG4gICAgICAgICAgY29udGVudDogdGhpcy50cnVuY2F0ZVJlcGx5VGV4dCh0aGlzLmdldE1lc3NhZ2VCb2R5KHRoaXMucmVwbHlUb01lc3NhZ2UpIHx8IHRoaXMuZ2V0QXR0YWNobWVudE5hbWUodGhpcy5yZXBseVRvTWVzc2FnZSkpLFxyXG4gICAgICAgIH0gOiB1bmRlZmluZWQ7XHJcbiAgICAgICAgY29uc3QgbWVudGlvbnMgPSB0aGlzLmdldE1lbnRpb25JZHNGcm9tQ29udGVudChtZXNzYWdlVGV4dCk7XHJcbiAgICAgICAgdGhpcy5maWxlU2VydmljZVxyXG4gICAgICAgICAgLnNlbmRNZXNzYWdlV2l0aEF0dGFjaG1lbnRzKFxyXG4gICAgICAgICAgICB0aGlzLmNvbnZlcnNhdGlvbklkISxcclxuICAgICAgICAgICAgdGhpcy5hdXRoLmNvbnRhY3RJZCEsXHJcbiAgICAgICAgICAgIG91dGdvaW5nVGV4dCxcclxuICAgICAgICAgICAgZmlsZUlkcyxcclxuICAgICAgICAgICAgZmlsZW5hbWVzLFxyXG4gICAgICAgICAgICBtaW1lVHlwZXNcclxuICAgICAgICAgIClcclxuICAgICAgICAgIC5zdWJzY3JpYmUoe1xyXG4gICAgICAgICAgICBuZXh0OiAocmVzOiBhbnkpID0+IHtcclxuICAgICAgICAgICAgICB0aGlzLnVwbG9hZGluZyA9IGZhbHNlO1xyXG4gICAgICAgICAgICAgIHRoaXMuc2hvdWxkU2Nyb2xsVG9Cb3R0b20gPSB0cnVlO1xyXG5cclxuICAgICAgICAgICAgICAvLyBBZGQgb3B0aW1pc3RpYyBtZXNzYWdlIHNvIHRoZSBpbWFnZSBhcHBlYXJzIGluc3RhbnRseSDigJRcclxuICAgICAgICAgICAgICAvLyB0aGUgV2ViU29ja2V0IGV2ZW50IG1heSBhcnJpdmUgYSBtb21lbnQgbGF0ZXIgYW5kIGRlZHVwIGl0LlxyXG4gICAgICAgICAgICAgIGNvbnN0IGZpcnN0SWQgPSBmaWxlSWRzWzBdIHx8ICcnO1xyXG4gICAgICAgICAgICAgIGNvbnN0IGlzSW1nID1cclxuICAgICAgICAgICAgICAgIChtaW1lVHlwZXNbMF0gfHwgJycpLnN0YXJ0c1dpdGgoJ2ltYWdlLycpIHx8XHJcbiAgICAgICAgICAgICAgICAvXFwuKHBuZ3xqcGU/Z3xnaWZ8d2VicHxibXB8c3ZnfGhlaWN8aGVpZikkL2kudGVzdChmaWxlbmFtZXNbMF0gfHwgJycpO1xyXG4gICAgICAgICAgICAgIGNvbnN0IG9wdGltaXN0aWM6IGFueSA9IHtcclxuICAgICAgICAgICAgICAgIG1lc3NhZ2VfaWQ6IHJlcz8ubWVzc2FnZV9pZCA/IFN0cmluZyhyZXMubWVzc2FnZV9pZCkgOiAndGVtcC0nICsgRGF0ZS5ub3coKSxcclxuICAgICAgICAgICAgICAgIGNvbnZlcnNhdGlvbl9pZDogdGhpcy5jb252ZXJzYXRpb25JZCEsXHJcbiAgICAgICAgICAgICAgICBzZW5kZXJfaWQ6IHRoaXMuYXV0aC5jb250YWN0SWQhLFxyXG4gICAgICAgICAgICAgICAgc2VuZGVyX25hbWU6ICdZb3UnLFxyXG4gICAgICAgICAgICAgICAgbWVzc2FnZV90eXBlOiBpc0ltZyA/ICdJTUFHRScgOiAnRklMRScsXHJcbiAgICAgICAgICAgICAgICBjb250ZW50OiBtZXNzYWdlVGV4dCxcclxuICAgICAgICAgICAgICAgIHJlcGx5X3RvOiByZXBseVRvLFxyXG4gICAgICAgICAgICAgICAgbWVudGlvbnMsXHJcbiAgICAgICAgICAgICAgICByZW5kZXJfYXNfcGxhaW5fdGV4dDogcGF5bG9hZC5mb3JjZVBsYWluVGV4dCxcclxuICAgICAgICAgICAgICAgIG1lZGlhX3VybDogZmlyc3RJZCxcclxuICAgICAgICAgICAgICAgIGNyZWF0ZWRfYXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcclxuICAgICAgICAgICAgICAgIGlzX3JlYWQ6IGZhbHNlLFxyXG4gICAgICAgICAgICAgICAgYXR0YWNobWVudHM6IGZpbGVJZHMubWFwKChpZCwgaWR4KSA9PiAoe1xyXG4gICAgICAgICAgICAgICAgICBmaWxlX2lkOiBpZCxcclxuICAgICAgICAgICAgICAgICAgZmlsZW5hbWU6IGZpbGVuYW1lc1tpZHhdIHx8IGZpbGVuYW1lc1swXSB8fCBgQXR0YWNobWVudCAke2lkeCArIDF9YCxcclxuICAgICAgICAgICAgICAgICAgbWltZV90eXBlOiBtaW1lVHlwZXNbaWR4XSB8fCB1bmRlZmluZWQsXHJcbiAgICAgICAgICAgICAgICAgIHNpemVfYnl0ZXM6IHBheWxvYWQuZmlsZXNbaWR4XT8uc2l6ZSxcclxuICAgICAgICAgICAgICAgICAgdXJsOiByZXNwb25zZXNbaWR4XT8udXJsLFxyXG4gICAgICAgICAgICAgICAgfSkpLFxyXG4gICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgICAgdGhpcy5zdG9yZS5hcHBlbmRPcHRpbWlzdGljTWVzc2FnZShvcHRpbWlzdGljKTtcclxuICAgICAgICAgICAgICB0aGlzLmNsZWFyUmVwbHkoKTtcclxuICAgICAgICAgICAgICB0aGlzLmNkci5tYXJrRm9yQ2hlY2soKTtcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgZXJyb3I6ICgpID0+IHtcclxuICAgICAgICAgICAgICB0aGlzLnVwbG9hZGluZyA9IGZhbHNlO1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgfSk7XHJcbiAgICAgIH0sXHJcbiAgICAgIGVycm9yOiAoKSA9PiB7XHJcbiAgICAgICAgdGhpcy51cGxvYWRpbmcgPSBmYWxzZTtcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgbG9hZE9sZGVyKCk6IHZvaWQge1xyXG4gICAgaWYgKHRoaXMuY29udmVyc2F0aW9uSWQgJiYgdGhpcy5tZXNzYWdlcy5sZW5ndGggPiAwKSB7XHJcbiAgICAgIHRoaXMuc3RvcmUubG9hZE1lc3NhZ2VzKHRoaXMuY29udmVyc2F0aW9uSWQsIHRoaXMubWVzc2FnZXNbMF0ubWVzc2FnZV9pZCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBvblNjcm9sbCgpOiB2b2lkIHt9XHJcblxyXG4gIG9uVGhyZWFkRHJhZ0VudGVyKGV2ZW50OiBEcmFnRXZlbnQpOiB2b2lkIHtcclxuICAgIGlmICh0aGlzLmlzUmVtb3ZlZEZyb21Hcm91cCkgcmV0dXJuO1xyXG4gICAgaWYgKCF0aGlzLmRyYWdIYXNGaWxlcyhldmVudCkpIHJldHVybjtcclxuICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcclxuICAgIHRoaXMudGhyZWFkRHJhZ0RlcHRoKys7XHJcbiAgICB0aGlzLnRocmVhZERyYWdPdmVyID0gdHJ1ZTtcclxuICB9XHJcblxyXG4gIG9uVGhyZWFkRHJhZ092ZXIoZXZlbnQ6IERyYWdFdmVudCk6IHZvaWQge1xyXG4gICAgaWYgKHRoaXMuaXNSZW1vdmVkRnJvbUdyb3VwKSByZXR1cm47XHJcbiAgICBpZiAoIXRoaXMuZHJhZ0hhc0ZpbGVzKGV2ZW50KSkgcmV0dXJuO1xyXG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuICAgIGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xyXG4gICAgaWYgKGV2ZW50LmRhdGFUcmFuc2Zlcikge1xyXG4gICAgICBldmVudC5kYXRhVHJhbnNmZXIuZHJvcEVmZmVjdCA9ICdjb3B5JztcclxuICAgIH1cclxuICAgIHRoaXMudGhyZWFkRHJhZ092ZXIgPSB0cnVlO1xyXG4gIH1cclxuXHJcbiAgb25UaHJlYWREcmFnTGVhdmUoZXZlbnQ6IERyYWdFdmVudCk6IHZvaWQge1xyXG4gICAgaWYgKCF0aGlzLmRyYWdIYXNGaWxlcyhldmVudCkpIHJldHVybjtcclxuICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcclxuICAgIHRoaXMudGhyZWFkRHJhZ0RlcHRoID0gTWF0aC5tYXgoMCwgdGhpcy50aHJlYWREcmFnRGVwdGggLSAxKTtcclxuICAgIHRoaXMudGhyZWFkRHJhZ092ZXIgPSB0aGlzLnRocmVhZERyYWdEZXB0aCA+IDA7XHJcbiAgfVxyXG5cclxuICBvblRocmVhZERyb3AoZXZlbnQ6IERyYWdFdmVudCk6IHZvaWQge1xyXG4gICAgaWYgKHRoaXMuaXNSZW1vdmVkRnJvbUdyb3VwKSByZXR1cm47XHJcbiAgICBpZiAoIXRoaXMuZHJhZ0hhc0ZpbGVzKGV2ZW50KSkgcmV0dXJuO1xyXG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuICAgIGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xyXG4gICAgdGhpcy5yZXNldFRocmVhZERyYWcoKTtcclxuICAgIGNvbnN0IGZpbGVzID0gZXZlbnQuZGF0YVRyYW5zZmVyPy5maWxlcyA/IEFycmF5LmZyb20oZXZlbnQuZGF0YVRyYW5zZmVyLmZpbGVzKSA6IFtdO1xyXG4gICAgdGhpcy5tZXNzYWdlSW5wdXQ/LmFkZEZpbGVzKGZpbGVzKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgcmVzZXRUaHJlYWREcmFnKCk6IHZvaWQge1xyXG4gICAgdGhpcy50aHJlYWREcmFnRGVwdGggPSAwO1xyXG4gICAgdGhpcy50aHJlYWREcmFnT3ZlciA9IGZhbHNlO1xyXG4gIH1cclxuXHJcbiAgZXhpdFJlbW92ZWRHcm91cCgpOiB2b2lkIHtcclxuICAgIGlmICh0aGlzLmNvbnZlcnNhdGlvbklkKSB7XHJcbiAgICAgIHRoaXMuc3RvcmUuZXhpdFJlbW92ZWRHcm91cCh0aGlzLmNvbnZlcnNhdGlvbklkKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHByaXZhdGUgZHJhZ0hhc0ZpbGVzKGV2ZW50OiBEcmFnRXZlbnQpOiBib29sZWFuIHtcclxuICAgIGNvbnN0IHR5cGVzID0gZXZlbnQuZGF0YVRyYW5zZmVyPy50eXBlcztcclxuICAgIGlmICghdHlwZXMpIHJldHVybiBmYWxzZTtcclxuICAgIHJldHVybiBBcnJheS5mcm9tKHR5cGVzKS5pbmNsdWRlcygnRmlsZXMnKTtcclxuICB9XHJcblxyXG4gIHNob3VsZFNob3dEYXRlU2VwYXJhdG9yKGluZGV4OiBudW1iZXIpOiBib29sZWFuIHtcclxuICAgIGlmIChpbmRleCA9PT0gMCkgcmV0dXJuIHRydWU7XHJcbiAgICBjb25zdCBjdXJyID0gbmV3IERhdGUodGhpcy5tZXNzYWdlc1tpbmRleF0uY3JlYXRlZF9hdCkudG9EYXRlU3RyaW5nKCk7XHJcbiAgICBjb25zdCBwcmV2ID0gbmV3IERhdGUodGhpcy5tZXNzYWdlc1tpbmRleCAtIDFdLmNyZWF0ZWRfYXQpLnRvRGF0ZVN0cmluZygpO1xyXG4gICAgcmV0dXJuIGN1cnIgIT09IHByZXY7XHJcbiAgfVxyXG5cclxuICBzaG91bGRTaG93U2VuZGVyKGluZGV4OiBudW1iZXIpOiBib29sZWFuIHtcclxuICAgIGlmIChpbmRleCA9PT0gMCkgcmV0dXJuIHRydWU7XHJcbiAgICByZXR1cm4gdGhpcy5tZXNzYWdlc1tpbmRleF0uc2VuZGVyX2lkICE9PSB0aGlzLm1lc3NhZ2VzW2luZGV4IC0gMV0uc2VuZGVyX2lkO1xyXG4gIH1cclxuXHJcbiAgaXNPd25NZXNzYWdlKG1zZzogTWVzc2FnZSk6IGJvb2xlYW4ge1xyXG4gICAgY29uc3QgY3VycmVudENvbnRhY3RJZCA9IHRoaXMuYXV0aC5jb250YWN0SWQgfHwgdGhpcy5teUNvbnRhY3RJZDtcclxuICAgIGlmIChjdXJyZW50Q29udGFjdElkICYmIFN0cmluZyhtc2cuc2VuZGVyX2lkKSA9PT0gU3RyaW5nKGN1cnJlbnRDb250YWN0SWQpKSByZXR1cm4gdHJ1ZTtcclxuICAgIGlmIChTdHJpbmcobXNnLnNlbmRlcl9uYW1lIHx8ICcnKS50cmltKCkudG9Mb3dlckNhc2UoKSA9PT0gJ3lvdScpIHJldHVybiB0cnVlO1xyXG5cclxuICAgIGNvbnN0IGN1cnJlbnQgPSB0aGlzLmF1dGguY3VycmVudENvbnRhY3Q7XHJcbiAgICBjb25zdCBzZW5kZXJVc2VybmFtZSA9IFN0cmluZyhtc2cuc2VuZGVyX3VzZXJuYW1lIHx8ICcnKS50cmltKCkudG9Mb3dlckNhc2UoKTtcclxuICAgIGNvbnN0IGN1cnJlbnRVc2VybmFtZSA9IFN0cmluZyhjdXJyZW50Py51c2VybmFtZSB8fCAnJykudHJpbSgpLnRvTG93ZXJDYXNlKCk7XHJcbiAgICBpZiAoc2VuZGVyVXNlcm5hbWUgJiYgY3VycmVudFVzZXJuYW1lICYmIHNlbmRlclVzZXJuYW1lID09PSBjdXJyZW50VXNlcm5hbWUpIHJldHVybiB0cnVlO1xyXG5cclxuICAgIGNvbnN0IHNlbmRlck5hbWUgPSBnZXRNZXNzYWdlU2VuZGVyTmFtZShtc2cpLnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xyXG4gICAgY29uc3QgY3VycmVudE5hbWUgPSBjdXJyZW50ID8gZ2V0Q29udGFjdERpc3BsYXlOYW1lKGN1cnJlbnQpLnRyaW0oKS50b0xvd2VyQ2FzZSgpIDogJyc7XHJcbiAgICByZXR1cm4gISFzZW5kZXJOYW1lICYmICEhY3VycmVudE5hbWUgJiYgc2VuZGVyTmFtZSA9PT0gY3VycmVudE5hbWU7XHJcbiAgfVxyXG5cclxuICBjYW5FZGl0TWVzc2FnZShtc2c6IE1lc3NhZ2UpOiBib29sZWFuIHtcclxuICAgIHJldHVybiAoXHJcbiAgICAgIHRoaXMuaXNPd25NZXNzYWdlKG1zZykgJiZcclxuICAgICAgIXRoaXMuaXNEZWxldGVkTWVzc2FnZShtc2cpICYmXHJcbiAgICAgIFN0cmluZyhtc2cubWVzc2FnZV90eXBlIHx8ICcnKS50b1VwcGVyQ2FzZSgpID09PSAnVEVYVCcgJiZcclxuICAgICAgIVN0cmluZyhtc2cubWVzc2FnZV9pZCB8fCAnJykuc3RhcnRzV2l0aCgndGVtcC0nKVxyXG4gICAgKTtcclxuICB9XHJcblxyXG4gIGNhbkRlbGV0ZU1lc3NhZ2UobXNnOiBNZXNzYWdlKTogYm9vbGVhbiB7XHJcbiAgICByZXR1cm4gKFxyXG4gICAgICB0aGlzLmlzT3duTWVzc2FnZShtc2cpICYmXHJcbiAgICAgICF0aGlzLmlzRGVsZXRlZE1lc3NhZ2UobXNnKVxyXG4gICAgKTtcclxuICB9XHJcblxyXG4gIGNhbk1hbmFnZU1lc3NhZ2UobXNnOiBNZXNzYWdlKTogYm9vbGVhbiB7XHJcbiAgICByZXR1cm4gdGhpcy5jYW5FZGl0TWVzc2FnZShtc2cpIHx8IHRoaXMuY2FuRGVsZXRlTWVzc2FnZShtc2cpO1xyXG4gIH1cclxuXHJcbiAgY2FuUmVwbHlNZXNzYWdlKG1zZzogTWVzc2FnZSk6IGJvb2xlYW4ge1xyXG4gICAgcmV0dXJuICF0aGlzLmlzRGVsZXRlZE1lc3NhZ2UobXNnKSAmJiAhdGhpcy5pc1N5c3RlbU1lc3NhZ2UobXNnKTtcclxuICB9XHJcblxyXG4gIGlzRWRpdGluZ01lc3NhZ2UobXNnOiBNZXNzYWdlKTogYm9vbGVhbiB7XHJcbiAgICByZXR1cm4gISF0aGlzLmVkaXRpbmdNZXNzYWdlICYmIFN0cmluZyh0aGlzLmVkaXRpbmdNZXNzYWdlLm1lc3NhZ2VfaWQpID09PSBTdHJpbmcobXNnLm1lc3NhZ2VfaWQpO1xyXG4gIH1cclxuXHJcbiAgb25JbmxpbmVFZGl0SW5wdXQoZXZlbnQ6IEV2ZW50KTogdm9pZCB7XHJcbiAgICB0aGlzLmVkaXRpbmdEcmFmdCA9IChldmVudC50YXJnZXQgYXMgSFRNTFRleHRBcmVhRWxlbWVudCkudmFsdWU7XHJcbiAgfVxyXG5cclxuICBvbklubGluZUVkaXRLZXlkb3duKGV2ZW50OiBLZXlib2FyZEV2ZW50KTogdm9pZCB7XHJcbiAgICBpZiAoZXZlbnQua2V5ID09PSAnRXNjYXBlJykge1xyXG4gICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICB0aGlzLmNsZWFyRWRpdCgpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKChldmVudC5jdHJsS2V5IHx8IGV2ZW50Lm1ldGFLZXkpICYmIGV2ZW50LmtleSA9PT0gJ0VudGVyJykge1xyXG4gICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICB0aGlzLnNhdmVJbmxpbmVFZGl0KGV2ZW50KTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIGNhblNhdmVJbmxpbmVFZGl0KCk6IGJvb2xlYW4ge1xyXG4gICAgY29uc3QgbWVzc2FnZSA9IHRoaXMuZWRpdGluZ01lc3NhZ2U7XHJcbiAgICBpZiAoIW1lc3NhZ2UgfHwgIXRoaXMuY2FuRWRpdE1lc3NhZ2UobWVzc2FnZSkpIHJldHVybiBmYWxzZTtcclxuICAgIGNvbnN0IG5leHQgPSB0aGlzLmVkaXRpbmdEcmFmdC50cmltKCk7XHJcbiAgICByZXR1cm4gISFuZXh0ICYmIG5leHQgIT09IHRoaXMuZ2V0TWVzc2FnZUJvZHkobWVzc2FnZSkudHJpbSgpO1xyXG4gIH1cclxuXHJcbiAgc2F2ZUlubGluZUVkaXQoZXZlbnQ/OiBFdmVudCk6IHZvaWQge1xyXG4gICAgZXZlbnQ/LnN0b3BQcm9wYWdhdGlvbigpO1xyXG4gICAgY29uc3QgbWVzc2FnZSA9IHRoaXMuZWRpdGluZ01lc3NhZ2U7XHJcbiAgICBpZiAoIW1lc3NhZ2UgfHwgIXRoaXMuY2FuU2F2ZUlubGluZUVkaXQoKSkgcmV0dXJuO1xyXG4gICAgdGhpcy5zdG9yZS5lZGl0TWVzc2FnZShtZXNzYWdlLm1lc3NhZ2VfaWQsIHRoaXMuZWRpdGluZ0RyYWZ0LnRyaW0oKSk7XHJcbiAgICB0aGlzLmNsZWFyRWRpdCgpO1xyXG4gIH1cclxuXHJcbiAgY2FuY2VsSW5saW5lRWRpdChldmVudD86IEV2ZW50KTogdm9pZCB7XHJcbiAgICBldmVudD8uc3RvcFByb3BhZ2F0aW9uKCk7XHJcbiAgICB0aGlzLmNsZWFyRWRpdCgpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBzdGFydEVkaXRNZXNzYWdlKG1zZzogTWVzc2FnZSk6IHZvaWQge1xyXG4gICAgaWYgKCF0aGlzLmNhbkVkaXRNZXNzYWdlKG1zZykpIHJldHVybjtcclxuICAgIHRoaXMuY2xlYXJSZXBseSgpO1xyXG4gICAgdGhpcy5lZGl0aW5nTWVzc2FnZSA9IG1zZztcclxuICAgIHRoaXMuZWRpdGluZ0RyYWZ0ID0gdGhpcy5nZXRNZXNzYWdlQm9keShtc2cpO1xyXG4gICAgc2V0VGltZW91dCgoKSA9PiB7XHJcbiAgICAgIGNvbnN0IHRleHRhcmVhID0gdGhpcy5pbmxpbmVFZGl0VGV4dGFyZWFzPy5maXJzdD8ubmF0aXZlRWxlbWVudDtcclxuICAgICAgdGV4dGFyZWE/LmZvY3VzKCk7XHJcbiAgICAgIHRleHRhcmVhPy5zZWxlY3QoKTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgaXNTeXN0ZW1NZXNzYWdlKG1zZzogTWVzc2FnZSk6IGJvb2xlYW4ge1xyXG4gICAgY29uc3QgY29udGVudCA9IFN0cmluZyhtc2cuY29udGVudCB8fCAnJykudHJpbSgpO1xyXG4gICAgcmV0dXJuIG1zZy5tZXNzYWdlX3R5cGUgPT09ICdTWVNURU0nIHx8XHJcbiAgICAgIC9eLisgYWRkZWQgLisgdG8gdGhlIGdyb3VwJC8udGVzdChjb250ZW50KSB8fFxyXG4gICAgICAvXi4rIHJlbW92ZWQgLisgZnJvbSB0aGUgZ3JvdXAkLy50ZXN0KGNvbnRlbnQpO1xyXG4gIH1cclxuXHJcbiAgaXNQcmVmb3JtYXR0ZWRUZXh0KG1zZzogTWVzc2FnZSk6IGJvb2xlYW4ge1xyXG4gICAgcmV0dXJuIHRoaXMuaXNQcmVmb3JtYXR0ZWRDb250ZW50KHRoaXMuZ2V0TWVzc2FnZUJvZHkobXNnKSk7XHJcbiAgfVxyXG5cclxuICBpc1ByZWZvcm1hdHRlZENvbnRlbnQoY29udGVudDogc3RyaW5nKTogYm9vbGVhbiB7XHJcbiAgICByZXR1cm4gY29udGVudC5pbmNsdWRlcygnXFx0JykgfHwgY29udGVudC5pbmNsdWRlcygnXFxuJykgfHwgLyB7Mix9Ly50ZXN0KGNvbnRlbnQpO1xyXG4gIH1cclxuXHJcbiAgZ2V0TWVzc2FnZUNhcHRpb24obXNnOiBNZXNzYWdlKTogc3RyaW5nIHtcclxuICAgIGNvbnN0IGNvbnRlbnQgPSB0aGlzLmdldE1lc3NhZ2VCb2R5KG1zZykudHJpbSgpO1xyXG4gICAgaWYgKCFjb250ZW50KSByZXR1cm4gJyc7XHJcblxyXG4gICAgY29uc3QgYXR0YWNobWVudE5hbWVzID0gdGhpcy5nZXRSZW5kZXJhYmxlQXR0YWNobWVudHMobXNnKVxyXG4gICAgICAubWFwKChhdHRhY2htZW50KSA9PiBTdHJpbmcoYXR0YWNobWVudC5maWxlbmFtZSB8fCAnJykudHJpbSgpKVxyXG4gICAgICAuZmlsdGVyKEJvb2xlYW4pO1xyXG4gICAgaWYgKCFhdHRhY2htZW50TmFtZXMubGVuZ3RoKSByZXR1cm4gY29udGVudDtcclxuXHJcbiAgICBjb25zdCBuYW1lc1RleHQgPSBhdHRhY2htZW50TmFtZXMuam9pbignLCAnKTtcclxuICAgIGlmIChjb250ZW50ID09PSBuYW1lc1RleHQgfHwgYXR0YWNobWVudE5hbWVzLmluY2x1ZGVzKGNvbnRlbnQpKSByZXR1cm4gJyc7XHJcbiAgICByZXR1cm4gY29udGVudDtcclxuICB9XHJcblxyXG4gIGlzQ29kZVRleHQobXNnOiBNZXNzYWdlKTogYm9vbGVhbiB7XHJcbiAgICByZXR1cm4gdGhpcy5pc0NvZGVDb250ZW50KHRoaXMuZ2V0TWVzc2FnZUJvZHkobXNnKSwgbXNnKTtcclxuICB9XHJcblxyXG4gIGlzQ29kZUNvbnRlbnQodmFsdWU6IHN0cmluZywgbXNnPzogTWVzc2FnZSk6IGJvb2xlYW4ge1xyXG4gICAgY29uc3QgY29udGVudCA9IHZhbHVlLnRyaW0oKTtcclxuICAgIGlmIChtc2c/LnJlbmRlcl9hc19wbGFpbl90ZXh0KSByZXR1cm4gZmFsc2U7XHJcbiAgICBpZiAoIWNvbnRlbnQgfHwgKG1zZyA/IHRoaXMuaXNUYWJsZVRleHQobXNnKSA6IHRoaXMuaXNUYWJsZUNvbnRlbnQoY29udGVudCkpKSByZXR1cm4gZmFsc2U7XHJcbiAgICBpZiAodGhpcy5sb29rc0xpa2VNYXJrZG93bihjb250ZW50KSAmJiAhdGhpcy5pc1NpbmdsZUZlbmNlZENvZGVCbG9jayhjb250ZW50KSkgcmV0dXJuIGZhbHNlO1xyXG4gICAgaWYgKC9eYGBgW1xcc1xcU10qYGBgJC8udGVzdChjb250ZW50KSkgcmV0dXJuIHRydWU7XHJcbiAgICByZXR1cm4gdGhpcy5kZXRlY3RDb2RlTGFuZ3VhZ2UoY29udGVudCkgIT09IG51bGw7XHJcbiAgfVxyXG5cclxuICBpc01hcmtkb3duVGV4dChtc2c6IE1lc3NhZ2UpOiBib29sZWFuIHtcclxuICAgIHJldHVybiB0aGlzLmlzTWFya2Rvd25Db250ZW50KHRoaXMuZ2V0TWVzc2FnZUJvZHkobXNnKSwgbXNnKTtcclxuICB9XHJcblxyXG4gIGlzTWFya2Rvd25Db250ZW50KHZhbHVlOiBzdHJpbmcsIG1zZz86IE1lc3NhZ2UpOiBib29sZWFuIHtcclxuICAgIGNvbnN0IGNvbnRlbnQgPSB2YWx1ZS50cmltKCk7XHJcbiAgICBpZiAoIWNvbnRlbnQgfHwgKG1zZyA/IHRoaXMuaXNUYWJsZVRleHQobXNnKSA6IHRoaXMuaXNUYWJsZUNvbnRlbnQoY29udGVudCkpIHx8IHRoaXMuaXNTaW5nbGVGZW5jZWRDb2RlQmxvY2soY29udGVudCkpIHJldHVybiBmYWxzZTtcclxuICAgIHJldHVybiB0aGlzLmxvb2tzTGlrZU1hcmtkb3duKGNvbnRlbnQpO1xyXG4gIH1cclxuXHJcbiAgZ2V0Q29kZUxhbmd1YWdlKG1zZzogTWVzc2FnZSk6IHN0cmluZyB7XHJcbiAgICByZXR1cm4gdGhpcy5nZXRDb2RlTGFuZ3VhZ2VDb250ZW50KHRoaXMuZ2V0TWVzc2FnZUJvZHkobXNnKSk7XHJcbiAgfVxyXG5cclxuICBnZXRDb2RlTGFuZ3VhZ2VDb250ZW50KGNvbnRlbnQ6IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgICBjb25zdCBwYXJzZWQgPSB0aGlzLnBhcnNlQ29kZUJsb2NrKGNvbnRlbnQpO1xyXG4gICAgcmV0dXJuIHBhcnNlZC5sYW5ndWFnZSB8fCB0aGlzLmRldGVjdENvZGVMYW5ndWFnZShwYXJzZWQuY29kZSkgfHwgJ2NvZGUnO1xyXG4gIH1cclxuXHJcbiAgZ2V0SGlnaGxpZ2h0ZWRDb2RlKG1zZzogTWVzc2FnZSk6IFNhZmVIdG1sIHtcclxuICAgIHJldHVybiB0aGlzLmdldEhpZ2hsaWdodGVkQ29kZUNvbnRlbnQodGhpcy5nZXRNZXNzYWdlQm9keShtc2cpKTtcclxuICB9XHJcblxyXG4gIGdldEhpZ2hsaWdodGVkQ29kZUNvbnRlbnQoY29udGVudDogc3RyaW5nKTogU2FmZUh0bWwge1xyXG4gICAgY29uc3QgcGFyc2VkID0gdGhpcy5wYXJzZUNvZGVCbG9jayhjb250ZW50KTtcclxuICAgIGNvbnN0IGxhbmd1YWdlID0gcGFyc2VkLmxhbmd1YWdlIHx8IHRoaXMuZGV0ZWN0Q29kZUxhbmd1YWdlKHBhcnNlZC5jb2RlKSB8fCAnY29kZSc7XHJcbiAgICBjb25zdCBlc2NhcGVkID0gdGhpcy5lc2NhcGVIdG1sKHBhcnNlZC5jb2RlKTtcclxuICAgIGNvbnN0IGhpZ2hsaWdodGVkID0gdGhpcy5oaWdobGlnaHRDb2RlKGVzY2FwZWQsIGxhbmd1YWdlKTtcclxuICAgIHJldHVybiB0aGlzLnNhbml0aXplci5ieXBhc3NTZWN1cml0eVRydXN0SHRtbChoaWdobGlnaHRlZCk7XHJcbiAgfVxyXG5cclxuICBnZXRNYXJrZG93bkh0bWwobXNnOiBNZXNzYWdlKTogU2FmZUh0bWwge1xyXG4gICAgcmV0dXJuIHRoaXMuZ2V0TWFya2Rvd25IdG1sQ29udGVudCh0aGlzLmdldE1lc3NhZ2VCb2R5KG1zZykpO1xyXG4gIH1cclxuXHJcbiAgZ2V0TWFya2Rvd25IdG1sQ29udGVudChjb250ZW50OiBzdHJpbmcpOiBTYWZlSHRtbCB7XHJcbiAgICByZXR1cm4gdGhpcy5zYW5pdGl6ZXIuYnlwYXNzU2VjdXJpdHlUcnVzdEh0bWwodGhpcy5yZW5kZXJNYXJrZG93bihjb250ZW50KSk7XHJcbiAgfVxyXG5cclxuICBjb3B5Q29kZShtc2c6IE1lc3NhZ2UsIGV2ZW50OiBNb3VzZUV2ZW50KTogdm9pZCB7XHJcbiAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcclxuICAgIGNvbnN0IGNvbnRlbnQgPSB0aGlzLmdldE1lc3NhZ2VCb2R5KG1zZyk7XHJcbiAgICBjb25zdCBwYXJzZWQgPSB0aGlzLnBhcnNlQ29kZUJsb2NrKGNvbnRlbnQpO1xyXG4gICAgdGhpcy5jb3B5VGV4dChwYXJzZWQuY29kZSB8fCBjb250ZW50KTtcclxuICB9XHJcblxyXG4gIGNvcHlNZXNzYWdlVGV4dChtc2c6IE1lc3NhZ2UsIGV2ZW50OiBNb3VzZUV2ZW50KTogdm9pZCB7XHJcbiAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcclxuICAgIHRoaXMuY29weVRleHQodGhpcy5nZXRNZXNzYWdlQm9keShtc2cpKTtcclxuICB9XHJcblxyXG4gIGNvcHlUZXh0VmFsdWUodGV4dDogc3RyaW5nLCBldmVudDogTW91c2VFdmVudCk6IHZvaWQge1xyXG4gICAgZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XHJcbiAgICB0aGlzLmNvcHlUZXh0KHRleHQpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBwYXJzZUNvZGVCbG9jayhjb250ZW50OiBzdHJpbmcpOiB7IGxhbmd1YWdlOiBzdHJpbmc7IGNvZGU6IHN0cmluZyB9IHtcclxuICAgIGNvbnN0IHRyaW1tZWQgPSBjb250ZW50LnRyaW0oKTtcclxuICAgIGNvbnN0IG1hdGNoID0gdHJpbW1lZC5tYXRjaCgvXmBgYChbYS16QS1aMC05XystXSopXFxzKlxcbj8oW1xcc1xcU10qPylgYGAkLyk7XHJcbiAgICBpZiAoIW1hdGNoKSByZXR1cm4geyBsYW5ndWFnZTogJycsIGNvZGU6IGNvbnRlbnQgfTtcclxuICAgIHJldHVybiB7IGxhbmd1YWdlOiAobWF0Y2hbMV0gfHwgJycpLnRvTG93ZXJDYXNlKCksIGNvZGU6IG1hdGNoWzJdIHx8ICcnIH07XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGlzU2luZ2xlRmVuY2VkQ29kZUJsb2NrKGNvbnRlbnQ6IHN0cmluZyk6IGJvb2xlYW4ge1xyXG4gICAgcmV0dXJuIC9eYGBgW2EtekEtWjAtOV8rLV0qXFxzKlxcbj9bXFxzXFxTXSo/YGBgJC8udGVzdChjb250ZW50LnRyaW0oKSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGxvb2tzTGlrZU1hcmtkb3duKGNvbnRlbnQ6IHN0cmluZyk6IGJvb2xlYW4ge1xyXG4gICAgcmV0dXJuIC8oXiN7MSw2fVxccyl8KF5bLSpdXFxzKXwoXlxcZCtcXC5cXHMpfChePlxccyl8KFxcKlxcKlteKl0rXFwqXFwqKXwoYFteYF0rYCl8KFxcW1teXFxdXStcXF1cXChbXildK1xcKSl8KF4tLS0kKXwoXi1cXHNcXFtbIHhdXFxdXFxzKXwoXmBgYFthLXpBLVowLTlfKy1dKlxccyokKS9tLnRlc3QoY29udGVudCk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGRldGVjdENvZGVMYW5ndWFnZShjb2RlOiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHtcclxuICAgIGNvbnN0IHRyaW1tZWQgPSBjb2RlLnRyaW0oKTtcclxuICAgIGlmICghdHJpbW1lZC5pbmNsdWRlcygnXFxuJykgJiYgdHJpbW1lZC5sZW5ndGggPCA0MCkgcmV0dXJuIG51bGw7XHJcbiAgICBpZiAoL15cXHMqKHNlbGVjdHx3aXRofGluc2VydHx1cGRhdGV8ZGVsZXRlfGNyZWF0ZXxhbHRlcnxkcm9wKVxcYi9pLnRlc3QodHJpbW1lZCkpIHJldHVybiAnc3FsJztcclxuICAgIGNvbnN0IGpzRGVjbGFyYXRpb24gPSAvXFxiKGZ1bmN0aW9ufGNvbnN0fGxldHx2YXIpXFxzK1tBLVphLXpfJF1bXFx3JF0qXFxzKig9fD0+fFxcKHw6KS8udGVzdCh0cmltbWVkKTtcclxuICAgIGNvbnN0IGpzU3ludGF4ID0gLyg9Pnxjb25zb2xlXFwubG9nfGltcG9ydFxccysuKmZyb218ZXhwb3J0XFxzK3xbe307XSkvLnRlc3QodHJpbW1lZCk7XHJcbiAgICBpZiAoanNEZWNsYXJhdGlvbiB8fCBqc1N5bnRheCkgcmV0dXJuICdqYXZhc2NyaXB0JztcclxuICAgIGlmICgvXFxiKGRlZnxpbXBvcnR8ZnJvbXxwcmludHxjbGFzcylcXGIvLnRlc3QodHJpbW1lZCkgJiYgLzpcXHMqJHxeXFxzezR9L20udGVzdCh0cmltbWVkKSkgcmV0dXJuICdweXRob24nO1xyXG4gICAgaWYgKC88XFwvP1thLXpdW1xcc1xcU10qPi9pLnRlc3QodHJpbW1lZCkpIHJldHVybiAnaHRtbCc7XHJcbiAgICBpZiAoL1t7fTtdLy50ZXN0KHRyaW1tZWQpICYmIC9bOj1dLy50ZXN0KHRyaW1tZWQpKSByZXR1cm4gJ2NvZGUnO1xyXG4gICAgcmV0dXJuIG51bGw7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGhpZ2hsaWdodENvZGUoZXNjYXBlZENvZGU6IHN0cmluZywgbGFuZ3VhZ2U6IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgICBjb25zdCBwcm90ZWN0ZWRUb2tlbnM6IHN0cmluZ1tdID0gW107XHJcbiAgICBjb25zdCBwcm90ZWN0ID0gKHZhbHVlOiBzdHJpbmcsIHJlZ2V4OiBSZWdFeHAsIGNsYXNzTmFtZTogc3RyaW5nKTogc3RyaW5nID0+XHJcbiAgICAgIHZhbHVlLnJlcGxhY2UocmVnZXgsIChtYXRjaCkgPT4ge1xyXG4gICAgICAgIGNvbnN0IHRva2VuID0gYF9fQ09ERV9UT0tFTl8ke3Byb3RlY3RlZFRva2Vucy5sZW5ndGh9X19gO1xyXG4gICAgICAgIHByb3RlY3RlZFRva2Vucy5wdXNoKGA8c3BhbiBjbGFzcz1cIiR7Y2xhc3NOYW1lfVwiPiR7bWF0Y2h9PC9zcGFuPmApO1xyXG4gICAgICAgIHJldHVybiB0b2tlbjtcclxuICAgICAgfSk7XHJcblxyXG4gICAgbGV0IGhpZ2hsaWdodGVkID0gZXNjYXBlZENvZGU7XHJcblxyXG4gICAgaWYgKGxhbmd1YWdlID09PSAnc3FsJykge1xyXG4gICAgICBoaWdobGlnaHRlZCA9IHByb3RlY3QoaGlnaGxpZ2h0ZWQsIC8oLS0uKikkL2dtLCAnY29kZS10b2tlbi1jb21tZW50Jyk7XHJcbiAgICAgIGhpZ2hsaWdodGVkID0gcHJvdGVjdChoaWdobGlnaHRlZCwgLygmcXVvdDsuKj8mcXVvdDt8JiMzOTsuKj8mIzM5O3xgLio/YCkvZywgJ2NvZGUtdG9rZW4tc3RyaW5nJyk7XHJcbiAgICAgIGhpZ2hsaWdodGVkID0gaGlnaGxpZ2h0ZWQucmVwbGFjZSgvXFxiKFNFTEVDVHxGUk9NfFdIRVJFfEpPSU58TEVGVHxSSUdIVHxJTk5FUnxPVVRFUnxPTnxHUk9VUCBCWXxPUkRFUiBCWXxJTlNFUlR8SU5UT3xWQUxVRVN8VVBEQVRFfFNFVHxERUxFVEV8Q1JFQVRFfFRBQkxFfEFMVEVSfERST1B8QU5EfE9SfE5VTEx8SVN8Tk9UfEFTfExJTUlUKVxcYi9naSwgJzxzcGFuIGNsYXNzPVwiY29kZS10b2tlbi1rZXl3b3JkXCI+JDE8L3NwYW4+Jyk7XHJcbiAgICAgIGhpZ2hsaWdodGVkID0gaGlnaGxpZ2h0ZWQucmVwbGFjZSgvXFxiKFxcZCsoPzpcXC5cXGQrKT8pXFxiL2csICc8c3BhbiBjbGFzcz1cImNvZGUtdG9rZW4tbnVtYmVyXCI+JDE8L3NwYW4+Jyk7XHJcbiAgICAgIHJldHVybiB0aGlzLnJlc3RvcmVDb2RlVG9rZW5zKGhpZ2hsaWdodGVkLCBwcm90ZWN0ZWRUb2tlbnMpO1xyXG4gICAgfVxyXG5cclxuICAgIGhpZ2hsaWdodGVkID0gcHJvdGVjdChoaWdobGlnaHRlZCwgLyhcXC9cXC8uKnwjLiopJC9nbSwgJ2NvZGUtdG9rZW4tY29tbWVudCcpO1xyXG4gICAgaGlnaGxpZ2h0ZWQgPSBwcm90ZWN0KGhpZ2hsaWdodGVkLCAvKCZxdW90Oy4qPyZxdW90O3wmIzM5Oy4qPyYjMzk7fGAuKj9gKS9nLCAnY29kZS10b2tlbi1zdHJpbmcnKTtcclxuICAgIGhpZ2hsaWdodGVkID0gaGlnaGxpZ2h0ZWQucmVwbGFjZSgvXFxiKGZ1bmN0aW9ufGNvbnN0fGxldHx2YXJ8cmV0dXJufGlmfGVsc2V8Zm9yfHdoaWxlfGNsYXNzfGltcG9ydHxmcm9tfGV4cG9ydHxhc3luY3xhd2FpdHxkZWZ8cHJpbnR8dHJ5fGNhdGNofG5ld3x0cnVlfGZhbHNlfG51bGx8Tm9uZSlcXGIvZywgJzxzcGFuIGNsYXNzPVwiY29kZS10b2tlbi1rZXl3b3JkXCI+JDE8L3NwYW4+Jyk7XHJcbiAgICBoaWdobGlnaHRlZCA9IGhpZ2hsaWdodGVkLnJlcGxhY2UoL1xcYihcXGQrKD86XFwuXFxkKyk/KVxcYi9nLCAnPHNwYW4gY2xhc3M9XCJjb2RlLXRva2VuLW51bWJlclwiPiQxPC9zcGFuPicpO1xyXG4gICAgaGlnaGxpZ2h0ZWQgPSBoaWdobGlnaHRlZC5yZXBsYWNlKC9cXGIoW2EtekEtWl8kXVtcXHckXSopKD89XFwoKS9nLCAnPHNwYW4gY2xhc3M9XCJjb2RlLXRva2VuLWZ1bmN0aW9uXCI+JDE8L3NwYW4+Jyk7XHJcbiAgICByZXR1cm4gdGhpcy5yZXN0b3JlQ29kZVRva2VucyhoaWdobGlnaHRlZCwgcHJvdGVjdGVkVG9rZW5zKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgcmVzdG9yZUNvZGVUb2tlbnModmFsdWU6IHN0cmluZywgcHJvdGVjdGVkVG9rZW5zOiBzdHJpbmdbXSk6IHN0cmluZyB7XHJcbiAgICByZXR1cm4gcHJvdGVjdGVkVG9rZW5zLnJlZHVjZShcclxuICAgICAgKGh0bWwsIHRva2VuLCBpbmRleCkgPT4gaHRtbC5yZXBsYWNlKG5ldyBSZWdFeHAoYF9fQ09ERV9UT0tFTl8ke2luZGV4fV9fYCwgJ2cnKSwgdG9rZW4pLFxyXG4gICAgICB2YWx1ZVxyXG4gICAgKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgcmVuZGVyTWFya2Rvd24ocmF3OiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gICAgY29uc3QgY29kZUJsb2Nrczogc3RyaW5nW10gPSBbXTtcclxuICAgIGNvbnN0IHdpdGhvdXRDb2RlID0gcmF3LnJlcGxhY2UoL2BgYChbYS16QS1aMC05XystXSopXFxzKlxcbj8oW1xcc1xcU10qPylgYGAvZywgKF9tYXRjaCwgbGFuZywgY29kZSkgPT4ge1xyXG4gICAgICBjb25zdCBsYW5ndWFnZSA9IFN0cmluZyhsYW5nIHx8ICdjb2RlJykudG9Mb3dlckNhc2UoKTtcclxuICAgICAgY29uc3QgdG9rZW4gPSBgX19NRF9DT0RFXyR7Y29kZUJsb2Nrcy5sZW5ndGh9X19gO1xyXG4gICAgICBjb2RlQmxvY2tzLnB1c2goXHJcbiAgICAgICAgYDxwcmU+PGNvZGUgZGF0YS1sYW5ndWFnZT1cIiR7dGhpcy5lc2NhcGVIdG1sKGxhbmd1YWdlKX1cIj4ke3RoaXMuZXNjYXBlSHRtbChTdHJpbmcoY29kZSB8fCAnJykpfTwvY29kZT48L3ByZT5gXHJcbiAgICAgICk7XHJcbiAgICAgIHJldHVybiB0b2tlbjtcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IGxpbmVzID0gd2l0aG91dENvZGUuc3BsaXQoL1xccj9cXG4vKTtcclxuICAgIGNvbnN0IGh0bWw6IHN0cmluZ1tdID0gW107XHJcbiAgICBsZXQgbGlzdFR5cGU6ICd1bCcgfCAnb2wnIHwgbnVsbCA9IG51bGw7XHJcblxyXG4gICAgY29uc3QgY2xvc2VMaXN0ID0gKCkgPT4ge1xyXG4gICAgICBpZiAobGlzdFR5cGUpIHtcclxuICAgICAgICBodG1sLnB1c2goYDwvJHtsaXN0VHlwZX0+YCk7XHJcbiAgICAgICAgbGlzdFR5cGUgPSBudWxsO1xyXG4gICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIGZvciAoY29uc3QgbGluZSBvZiBsaW5lcykge1xyXG4gICAgICBjb25zdCB0cmltbWVkID0gbGluZS50cmltKCk7XHJcblxyXG4gICAgICBpZiAoIXRyaW1tZWQpIHtcclxuICAgICAgICBjbG9zZUxpc3QoKTtcclxuICAgICAgICBjb250aW51ZTtcclxuICAgICAgfVxyXG5cclxuICAgICAgY29uc3QgdG9rZW5NYXRjaCA9IHRyaW1tZWQubWF0Y2goL15fX01EX0NPREVfKFxcZCspX18kLyk7XHJcbiAgICAgIGlmICh0b2tlbk1hdGNoKSB7XHJcbiAgICAgICAgY2xvc2VMaXN0KCk7XHJcbiAgICAgICAgaHRtbC5wdXNoKGNvZGVCbG9ja3NbTnVtYmVyKHRva2VuTWF0Y2hbMV0pXSB8fCAnJyk7XHJcbiAgICAgICAgY29udGludWU7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGNvbnN0IGhlYWRpbmcgPSB0cmltbWVkLm1hdGNoKC9eKCN7MSwzfSlcXHMrKC4rKSQvKTtcclxuICAgICAgaWYgKGhlYWRpbmcpIHtcclxuICAgICAgICBjbG9zZUxpc3QoKTtcclxuICAgICAgICBodG1sLnB1c2goYDxoJHtoZWFkaW5nWzFdLmxlbmd0aH0+JHt0aGlzLnJlbmRlck1hcmtkb3duSW5saW5lKGhlYWRpbmdbMl0pfTwvaCR7aGVhZGluZ1sxXS5sZW5ndGh9PmApO1xyXG4gICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBpZiAoL14tLS0rJC8udGVzdCh0cmltbWVkKSkge1xyXG4gICAgICAgIGNsb3NlTGlzdCgpO1xyXG4gICAgICAgIGh0bWwucHVzaCgnPGhyPicpO1xyXG4gICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBjb25zdCB1bm9yZGVyZWQgPSB0cmltbWVkLm1hdGNoKC9eWy0qXVxccysoPzpcXFtbIHhdXFxdXFxzKyk/KC4rKSQvaSk7XHJcbiAgICAgIGlmICh1bm9yZGVyZWQpIHtcclxuICAgICAgICBpZiAobGlzdFR5cGUgIT09ICd1bCcpIHtcclxuICAgICAgICAgIGNsb3NlTGlzdCgpO1xyXG4gICAgICAgICAgaHRtbC5wdXNoKCc8dWw+Jyk7XHJcbiAgICAgICAgICBsaXN0VHlwZSA9ICd1bCc7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGh0bWwucHVzaChgPGxpPiR7dGhpcy5yZW5kZXJNYXJrZG93bklubGluZSh1bm9yZGVyZWRbMV0pfTwvbGk+YCk7XHJcbiAgICAgICAgY29udGludWU7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGNvbnN0IG9yZGVyZWQgPSB0cmltbWVkLm1hdGNoKC9eXFxkK1xcLlxccysoLispJC8pO1xyXG4gICAgICBpZiAob3JkZXJlZCkge1xyXG4gICAgICAgIGlmIChsaXN0VHlwZSAhPT0gJ29sJykge1xyXG4gICAgICAgICAgY2xvc2VMaXN0KCk7XHJcbiAgICAgICAgICBodG1sLnB1c2goJzxvbD4nKTtcclxuICAgICAgICAgIGxpc3RUeXBlID0gJ29sJztcclxuICAgICAgICB9XHJcbiAgICAgICAgaHRtbC5wdXNoKGA8bGk+JHt0aGlzLnJlbmRlck1hcmtkb3duSW5saW5lKG9yZGVyZWRbMV0pfTwvbGk+YCk7XHJcbiAgICAgICAgY29udGludWU7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGNvbnN0IHF1b3RlID0gdHJpbW1lZC5tYXRjaCgvXj5cXHMrKC4rKSQvKTtcclxuICAgICAgaWYgKHF1b3RlKSB7XHJcbiAgICAgICAgY2xvc2VMaXN0KCk7XHJcbiAgICAgICAgaHRtbC5wdXNoKGA8YmxvY2txdW90ZT4ke3RoaXMucmVuZGVyTWFya2Rvd25JbmxpbmUocXVvdGVbMV0pfTwvYmxvY2txdW90ZT5gKTtcclxuICAgICAgICBjb250aW51ZTtcclxuICAgICAgfVxyXG5cclxuICAgICAgY2xvc2VMaXN0KCk7XHJcbiAgICAgIGh0bWwucHVzaChgPHA+JHt0aGlzLnJlbmRlck1hcmtkb3duSW5saW5lKHRyaW1tZWQpfTwvcD5gKTtcclxuICAgIH1cclxuXHJcbiAgICBjbG9zZUxpc3QoKTtcclxuICAgIHJldHVybiBodG1sLmpvaW4oJycpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSByZW5kZXJNYXJrZG93bklubGluZSh2YWx1ZTogc3RyaW5nKTogc3RyaW5nIHtcclxuICAgIGxldCBodG1sID0gdGhpcy5lc2NhcGVIdG1sKHZhbHVlKTtcclxuICAgIGh0bWwgPSBodG1sLnJlcGxhY2UoL2AoW15gXSspYC9nLCAnPGNvZGU+JDE8L2NvZGU+Jyk7XHJcbiAgICBodG1sID0gaHRtbC5yZXBsYWNlKC9cXCpcXCooW14qXSspXFwqXFwqL2csICc8c3Ryb25nPiQxPC9zdHJvbmc+Jyk7XHJcbiAgICBodG1sID0gaHRtbC5yZXBsYWNlKC9cXCooW14qXSspXFwqL2csICc8ZW0+JDE8L2VtPicpO1xyXG4gICAgaHRtbCA9IGh0bWwucmVwbGFjZSgvXFxbKFteXFxdXSspXFxdXFwoKGh0dHBzPzpcXC9cXC9bXilcXHNdKylcXCkvZywgJzxhIGhyZWY9XCIkMlwiIHRhcmdldD1cIl9ibGFua1wiIHJlbD1cIm5vb3BlbmVyIG5vcmVmZXJyZXJcIj4kMTwvYT4nKTtcclxuICAgIHJldHVybiBodG1sO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBjb3B5VGV4dCh0ZXh0OiBzdHJpbmcpOiB2b2lkIHtcclxuICAgIGlmICghdGV4dCkgcmV0dXJuO1xyXG4gICAgaWYgKG5hdmlnYXRvci5jbGlwYm9hcmQ/LndyaXRlVGV4dCkge1xyXG4gICAgICBuYXZpZ2F0b3IuY2xpcGJvYXJkLndyaXRlVGV4dCh0ZXh0KS50aGVuKFxyXG4gICAgICAgICgpID0+IHRoaXMuc3RvcmUuc2hvd1RvYXN0KCdDb3BpZWQgdG8gY2xpcGJvYXJkJywgJ3N1Y2Nlc3MnLCAxNjAwKSxcclxuICAgICAgICAoKSA9PiB0aGlzLmZhbGxiYWNrQ29weVRleHQodGV4dClcclxuICAgICAgKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgdGhpcy5mYWxsYmFja0NvcHlUZXh0KHRleHQpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBmYWxsYmFja0NvcHlUZXh0KHRleHQ6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgdHJ5IHtcclxuICAgICAgY29uc3QgdGV4dGFyZWEgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCd0ZXh0YXJlYScpO1xyXG4gICAgICB0ZXh0YXJlYS52YWx1ZSA9IHRleHQ7XHJcbiAgICAgIHRleHRhcmVhLnN0eWxlLnBvc2l0aW9uID0gJ2ZpeGVkJztcclxuICAgICAgdGV4dGFyZWEuc3R5bGUubGVmdCA9ICctOTk5OXB4JztcclxuICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCh0ZXh0YXJlYSk7XHJcbiAgICAgIHRleHRhcmVhLnNlbGVjdCgpO1xyXG4gICAgICBkb2N1bWVudC5leGVjQ29tbWFuZCgnY29weScpO1xyXG4gICAgICBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKHRleHRhcmVhKTtcclxuICAgICAgdGhpcy5zdG9yZS5zaG93VG9hc3QoJ0NvcGllZCB0byBjbGlwYm9hcmQnLCAnc3VjY2VzcycsIDE2MDApO1xyXG4gICAgfSBjYXRjaCB7XHJcbiAgICAgIHRoaXMuc3RvcmUuc2hvd1RvYXN0KCdDb3VsZCBub3QgY29weScsICdlcnJvcicsIDIyMDApO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBlc2NhcGVIdG1sKHZhbHVlOiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gICAgcmV0dXJuIHZhbHVlXHJcbiAgICAgIC5yZXBsYWNlKC8mL2csICcmYW1wOycpXHJcbiAgICAgIC5yZXBsYWNlKC88L2csICcmbHQ7JylcclxuICAgICAgLnJlcGxhY2UoLz4vZywgJyZndDsnKVxyXG4gICAgICAucmVwbGFjZSgvXCIvZywgJyZxdW90OycpXHJcbiAgICAgIC5yZXBsYWNlKC8nL2csICcmIzM5OycpO1xyXG4gIH1cclxuXHJcbiAgaXNUYWJsZVRleHQobXNnOiBNZXNzYWdlKTogYm9vbGVhbiB7XHJcbiAgICBjb25zdCByb3dzID0gdGhpcy5nZXRUYWJsZVJvd3MobXNnKTtcclxuICAgIHJldHVybiByb3dzLmxlbmd0aCA+PSAyICYmIHJvd3Muc29tZSgocm93KSA9PiByb3cubGVuZ3RoID49IDIpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBpc1RhYmxlQ29udGVudChjb250ZW50OiBzdHJpbmcpOiBib29sZWFuIHtcclxuICAgIGNvbnN0IHJvd3MgPSB0aGlzLmdldFRhYmxlUm93c0Zyb21Db250ZW50KGNvbnRlbnQpO1xyXG4gICAgcmV0dXJuIHJvd3MubGVuZ3RoID49IDIgJiYgcm93cy5zb21lKChyb3cpID0+IHJvdy5sZW5ndGggPj0gMik7XHJcbiAgfVxyXG5cclxuICBnZXRUYWJsZVJvd3MobXNnOiBNZXNzYWdlKTogc3RyaW5nW11bXSB7XHJcbiAgICByZXR1cm4gdGhpcy5nZXRUYWJsZVJvd3NGcm9tQ29udGVudCh0aGlzLmdldE1lc3NhZ2VCb2R5KG1zZykpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBnZXRUYWJsZVJvd3NGcm9tQ29udGVudCh2YWx1ZTogc3RyaW5nKTogc3RyaW5nW11bXSB7XHJcbiAgICBjb25zdCBjb250ZW50ID0gdmFsdWUudHJpbSgpO1xyXG4gICAgaWYgKCFjb250ZW50LmluY2x1ZGVzKCdcXHQnKSkgcmV0dXJuIFtdO1xyXG5cclxuICAgIGNvbnN0IHJvd3MgPSBjb250ZW50XHJcbiAgICAgIC5zcGxpdCgvXFxyP1xcbi8pXHJcbiAgICAgIC5tYXAoKGxpbmUpID0+IGxpbmUuc3BsaXQoJ1xcdCcpLm1hcCgoY2VsbCkgPT4gY2VsbC50cmltKCkpKVxyXG4gICAgICAuZmlsdGVyKChyb3cpID0+IHJvdy5zb21lKChjZWxsKSA9PiBjZWxsLmxlbmd0aCA+IDApKTtcclxuXHJcbiAgICBjb25zdCBtYXhDb2x1bW5zID0gTWF0aC5tYXgoMCwgLi4ucm93cy5tYXAoKHJvdykgPT4gcm93Lmxlbmd0aCkpO1xyXG4gICAgaWYgKG1heENvbHVtbnMgPCAyKSByZXR1cm4gW107XHJcblxyXG4gICAgcmV0dXJuIHJvd3MubWFwKChyb3cpID0+IFtcclxuICAgICAgLi4ucm93LFxyXG4gICAgICAuLi5BcnJheS5mcm9tKHsgbGVuZ3RoOiBtYXhDb2x1bW5zIC0gcm93Lmxlbmd0aCB9LCAoKSA9PiAnJyksXHJcbiAgICBdKTtcclxuICB9XHJcblxyXG4gIGlzTWVzc2FnZVJlYWQobXNnOiBNZXNzYWdlKTogYm9vbGVhbiB7XHJcbiAgICBjb25zdCB2YWx1ZSA9IG1zZy5pc19yZWFkO1xyXG4gICAgcmV0dXJuIHZhbHVlID09PSB0cnVlIHx8IHZhbHVlID09PSAndHJ1ZScgfHwgdmFsdWUgPT09ICdUcnVlJyB8fCB2YWx1ZSA9PT0gJzEnO1xyXG4gIH1cclxuXHJcbiAgZ2V0UmVhZFRvb2x0aXAobXNnOiBNZXNzYWdlKTogc3RyaW5nIHtcclxuICAgIGlmICghdGhpcy5pc0dyb3VwKSByZXR1cm4gJ1JlYWQnO1xyXG5cclxuICAgIGNvbnN0IG5hbWVzID0gdGhpcy5nZXRSZWFkQnlOYW1lcyhtc2cpO1xyXG4gICAgaWYgKG5hbWVzLmxlbmd0aCA+IDApIHtcclxuICAgICAgcmV0dXJuIGBSZWFkIGJ5ICR7bmFtZXMuam9pbignLCAnKX1gO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiAnUmVhZCc7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGdldFJlYWRCeU5hbWVzKG1zZzogTWVzc2FnZSk6IHN0cmluZ1tdIHtcclxuICAgIGNvbnN0IGFueU1zZyA9IG1zZyBhcyBhbnk7XHJcbiAgICBjb25zdCByYXdOYW1lcyA9IFtcclxuICAgICAgLi4udGhpcy50b1JlYWRBcnJheShhbnlNc2cucmVhZF9ieV9uYW1lcyksXHJcbiAgICAgIC4uLnRoaXMudG9SZWFkQXJyYXkoYW55TXNnLnJlYWRCeU5hbWVzKSxcclxuICAgICAgLi4udGhpcy50b1JlYWRBcnJheShhbnlNc2cucmVhZGVyX25hbWVzKSxcclxuICAgICAgLi4udGhpcy50b1JlYWRBcnJheShhbnlNc2cucmVhZGVycyksXHJcbiAgICAgIC4uLnRoaXMudG9SZWFkQXJyYXkoYW55TXNnLnJlYWRfYnkpLFxyXG4gICAgICAuLi50aGlzLnRvUmVhZEFycmF5KGFueU1zZy5yZWFkQnkpLFxyXG4gICAgXTtcclxuXHJcbiAgICBjb25zdCBuYW1lcyA9IHJhd05hbWVzXHJcbiAgICAgIC5tYXAoKGVudHJ5KSA9PiB0aGlzLnJlYWRFbnRyeVRvTmFtZShlbnRyeSkpXHJcbiAgICAgIC5maWx0ZXIoKG5hbWUpOiBuYW1lIGlzIHN0cmluZyA9PiAhIW5hbWUgJiYgbmFtZSAhPT0gJ1lvdScpO1xyXG5cclxuICAgIHJldHVybiBBcnJheS5mcm9tKG5ldyBTZXQobmFtZXMpKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgdG9SZWFkQXJyYXkodmFsdWU6IHVua25vd24pOiB1bmtub3duW10ge1xyXG4gICAgaWYgKCF2YWx1ZSkgcmV0dXJuIFtdO1xyXG4gICAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSByZXR1cm4gdmFsdWU7XHJcbiAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykge1xyXG4gICAgICBjb25zdCB0cmltbWVkID0gdmFsdWUudHJpbSgpO1xyXG4gICAgICBpZiAoIXRyaW1tZWQpIHJldHVybiBbXTtcclxuICAgICAgdHJ5IHtcclxuICAgICAgICBjb25zdCBwYXJzZWQgPSBKU09OLnBhcnNlKHRyaW1tZWQpO1xyXG4gICAgICAgIHJldHVybiBBcnJheS5pc0FycmF5KHBhcnNlZCkgPyBwYXJzZWQgOiBbcGFyc2VkXTtcclxuICAgICAgfSBjYXRjaCB7XHJcbiAgICAgICAgcmV0dXJuIHRyaW1tZWQuaW5jbHVkZXMoJywnKSA/IHRyaW1tZWQuc3BsaXQoJywnKS5tYXAoKHYpID0+IHYudHJpbSgpKSA6IFt0cmltbWVkXTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIFt2YWx1ZV07XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHJlYWRFbnRyeVRvTmFtZShlbnRyeTogdW5rbm93bik6IHN0cmluZyB8IG51bGwge1xyXG4gICAgaWYgKGVudHJ5ID09IG51bGwpIHJldHVybiBudWxsO1xyXG4gICAgaWYgKHR5cGVvZiBlbnRyeSA9PT0gJ3N0cmluZycgfHwgdHlwZW9mIGVudHJ5ID09PSAnbnVtYmVyJykge1xyXG4gICAgICBjb25zdCBpZE9yTmFtZSA9IFN0cmluZyhlbnRyeSkudHJpbSgpO1xyXG4gICAgICBjb25zdCBjb250YWN0ID0gdGhpcy52aXNpYmxlQ29udGFjdHMuZmluZCgoYykgPT4gU3RyaW5nKGMuY29udGFjdF9pZCkgPT09IGlkT3JOYW1lKTtcclxuICAgICAgcmV0dXJuIGNvbnRhY3QgPyBnZXRDb250YWN0RGlzcGxheU5hbWUoY29udGFjdCkgOiBpZE9yTmFtZTtcclxuICAgIH1cclxuICAgIGlmICh0eXBlb2YgZW50cnkgPT09ICdvYmplY3QnKSB7XHJcbiAgICAgIGNvbnN0IG9iaiA9IGVudHJ5IGFzIGFueTtcclxuICAgICAgY29uc3QgZXhwbGljaXQgPSBvYmoudXNlcm5hbWUgfHwgb2JqLm5hbWUgfHwgb2JqLmRpc3BsYXlfbmFtZSB8fCBvYmouZGlzcGxheU5hbWUgfHwgb2JqLmVtYWlsO1xyXG4gICAgICBpZiAoZXhwbGljaXQpIHJldHVybiBTdHJpbmcoZXhwbGljaXQpO1xyXG4gICAgICBpZiAob2JqLmNvbnRhY3RfaWQgfHwgb2JqLmNvbnRhY3RJZCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLnJlYWRFbnRyeVRvTmFtZShvYmouY29udGFjdF9pZCB8fCBvYmouY29udGFjdElkKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIG51bGw7XHJcbiAgfVxyXG5cclxuICBnZXRTZW5kZXJOYW1lKG1zZzogTWVzc2FnZSk6IHN0cmluZyB7XHJcbiAgICBjb25zdCBmcm9tTWVzc2FnZSA9IGdldE1lc3NhZ2VTZW5kZXJOYW1lKG1zZyk7XHJcbiAgICBpZiAoZnJvbU1lc3NhZ2UgJiYgZnJvbU1lc3NhZ2UgIT09ICdVbmtub3duJykge1xyXG4gICAgICByZXR1cm4gZnJvbU1lc3NhZ2U7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgZnJvbUNvbnRhY3RzID0gdGhpcy52aXNpYmxlQ29udGFjdHMuZmluZChcclxuICAgICAgKGMpID0+IFN0cmluZyhjLmNvbnRhY3RfaWQpID09PSBTdHJpbmcobXNnLnNlbmRlcl9pZClcclxuICAgICk7XHJcbiAgICBpZiAoZnJvbUNvbnRhY3RzKSB7XHJcbiAgICAgIHJldHVybiBnZXRDb250YWN0RGlzcGxheU5hbWUoZnJvbUNvbnRhY3RzKTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAodGhpcy5pc093bk1lc3NhZ2UobXNnKSkge1xyXG4gICAgICByZXR1cm4gJ1lvdSc7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIGBVc2VyICR7bXNnLnNlbmRlcl9pZH1gO1xyXG4gIH1cclxuXHJcbiAgZm9ybWF0VGltZShkYXRlU3RyOiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gICAgaWYgKCFkYXRlU3RyKSByZXR1cm4gJyc7XHJcbiAgICBjb25zdCBkID0gbmV3IERhdGUoZGF0ZVN0cik7XHJcbiAgICByZXR1cm4gZC50b0xvY2FsZVRpbWVTdHJpbmcoJ2VuLUdCJywgeyBob3VyOiAnMi1kaWdpdCcsIG1pbnV0ZTogJzItZGlnaXQnIH0pO1xyXG4gIH1cclxuXHJcbiAgZm9ybWF0RGF0ZShkYXRlU3RyOiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gICAgY29uc3QgZCA9IG5ldyBEYXRlKGRhdGVTdHIpO1xyXG4gICAgY29uc3QgdG9kYXkgPSBuZXcgRGF0ZSgpO1xyXG4gICAgY29uc3QgeWVzdGVyZGF5ID0gbmV3IERhdGUodG9kYXkpO1xyXG4gICAgeWVzdGVyZGF5LnNldERhdGUoeWVzdGVyZGF5LmdldERhdGUoKSAtIDEpO1xyXG5cclxuICAgIGlmIChkLnRvRGF0ZVN0cmluZygpID09PSB0b2RheS50b0RhdGVTdHJpbmcoKSkgcmV0dXJuICdUb2RheSc7XHJcbiAgICBpZiAoZC50b0RhdGVTdHJpbmcoKSA9PT0geWVzdGVyZGF5LnRvRGF0ZVN0cmluZygpKSByZXR1cm4gJ1llc3RlcmRheSc7XHJcbiAgICByZXR1cm4gZC50b0xvY2FsZURhdGVTdHJpbmcoJ2VuLUdCJywgeyBkYXk6ICdudW1lcmljJywgbW9udGg6ICdzaG9ydCcsIHllYXI6ICdudW1lcmljJyB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgc2Nyb2xsVG9Cb3R0b20oKTogdm9pZCB7XHJcbiAgICB0cnkge1xyXG4gICAgICBjb25zdCBlbCA9IHRoaXMuc2Nyb2xsQ29udGFpbmVyPy5uYXRpdmVFbGVtZW50O1xyXG4gICAgICBpZiAoZWwpIHtcclxuICAgICAgICBlbC5zY3JvbGxUb3AgPSBlbC5zY3JvbGxIZWlnaHQ7XHJcbiAgICAgIH1cclxuICAgIH0gY2F0Y2ggeyAvKiBpZ25vcmUgKi8gfVxyXG4gIH1cclxuXHJcbiAgLy8g4pSA4pSAIE1lZGlhIGhlbHBlcnMg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcblxyXG4gIHByaXZhdGUgZ2V0RmlsZW5hbWVMaWtlKG1zZzogTWVzc2FnZSwgYXR0YWNobWVudD86IEF0dGFjaG1lbnQpOiBzdHJpbmcge1xyXG4gICAgY29uc3QgYW55TXNnID0gbXNnIGFzIGFueTtcclxuICAgIHJldHVybiBTdHJpbmcoXHJcbiAgICAgIGF0dGFjaG1lbnQ/LmZpbGVuYW1lIHx8XHJcbiAgICAgIHRoaXMuZ2V0UHJpbWFyeUF0dGFjaG1lbnQobXNnKT8uZmlsZW5hbWUgfHxcclxuICAgICAgYW55TXNnPy5maWxlbmFtZSB8fFxyXG4gICAgICBhbnlNc2c/LmZpbGVfbmFtZSB8fFxyXG4gICAgICBtc2cuY29udGVudCB8fFxyXG4gICAgICAnJ1xyXG4gICAgKS50b0xvd2VyQ2FzZSgpO1xyXG4gIH1cclxuXHJcbiAgZ2V0UmVuZGVyYWJsZUF0dGFjaG1lbnRzKG1zZzogTWVzc2FnZSk6IEF0dGFjaG1lbnRbXSB7XHJcbiAgICBjb25zdCBhdHRhY2htZW50cyA9IHRoaXMuZ2V0QWxsQXR0YWNobWVudHMobXNnKTtcclxuICAgIGlmIChhdHRhY2htZW50cy5sZW5ndGggPiAwKSByZXR1cm4gYXR0YWNobWVudHM7XHJcbiAgICBjb25zdCBwcmltYXJ5ID0gdGhpcy5nZXRQcmltYXJ5QXR0YWNobWVudChtc2cpO1xyXG4gICAgcmV0dXJuIHByaW1hcnkgPyBbcHJpbWFyeV0gOiBbXTtcclxuICB9XHJcblxyXG4gIHRyYWNrQnlBdHRhY2htZW50KGluZGV4OiBudW1iZXIsIGF0dGFjaG1lbnQ6IEF0dGFjaG1lbnQpOiBzdHJpbmcge1xyXG4gICAgcmV0dXJuIGF0dGFjaG1lbnQuZmlsZV9pZCB8fCBhdHRhY2htZW50LnVybCB8fCBgJHthdHRhY2htZW50LmZpbGVuYW1lfS0ke2luZGV4fWA7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGdldEFsbEF0dGFjaG1lbnRzKG1zZzogTWVzc2FnZSk6IEF0dGFjaG1lbnRbXSB7XHJcbiAgICBjb25zdCBhbnlNc2cgPSBtc2cgYXMgYW55O1xyXG4gICAgY29uc3QgYXR0YWNobWVudHM6IEF0dGFjaG1lbnRbXSA9IFtdO1xyXG4gICAgY29uc3QgYWRkID0gKGF0dGFjaG1lbnQ6IFBhcnRpYWw8QXR0YWNobWVudD4gfCBzdHJpbmcgfCBudWxsIHwgdW5kZWZpbmVkKTogdm9pZCA9PiB7XHJcbiAgICAgIGNvbnN0IHJhdyA9IGF0dGFjaG1lbnQgYXMgYW55O1xyXG4gICAgICBjb25zdCBmaWxlSWQgPSBTdHJpbmcoXHJcbiAgICAgICAgdHlwZW9mIGF0dGFjaG1lbnQgPT09ICdzdHJpbmcnID8gYXR0YWNobWVudCA6XHJcbiAgICAgICAgcmF3Py5maWxlX2lkID8/XHJcbiAgICAgICAgcmF3Py5maWxlSWQgPz9cclxuICAgICAgICByYXc/LmlkID8/XHJcbiAgICAgICAgcmF3Py5hdHRhY2htZW50X2lkID8/XHJcbiAgICAgICAgcmF3Py5zdG9yYWdlX2ZpbGVfaWQgPz9cclxuICAgICAgICAnJ1xyXG4gICAgICApLnRyaW0oKTtcclxuICAgICAgaWYgKGZpbGVJZC5zdGFydHNXaXRoKCd7JykgfHwgZmlsZUlkLnN0YXJ0c1dpdGgoJ1snKSkge1xyXG4gICAgICAgIGNvbnN0IGlkcyA9IHRoaXMudG9BcnJheShmaWxlSWQpO1xyXG4gICAgICAgIGNvbnN0IGZpbGVuYW1lcyA9IHRoaXMudG9BcnJheShyYXc/LmZpbGVuYW1lcyA/PyByYXc/LmZpbGVuYW1lID8/IHJhdz8uZmlsZV9uYW1lKTtcclxuICAgICAgICBjb25zdCBtaW1lVHlwZXMgPSB0aGlzLnRvQXJyYXkocmF3Py5taW1lX3R5cGVzID8/IHJhdz8ubWltZVR5cGVzID8/IHJhdz8ubWltZV90eXBlKTtcclxuICAgICAgICBpZHMuZm9yRWFjaCgoaWQsIGlkeCkgPT4ge1xyXG4gICAgICAgICAgYWRkKHtcclxuICAgICAgICAgICAgZmlsZV9pZDogaWQsXHJcbiAgICAgICAgICAgIGZpbGVuYW1lOiBmaWxlbmFtZXNbaWR4XSB8fCBmaWxlbmFtZXNbMF0gfHwgcmF3Py5maWxlbmFtZSB8fCByYXc/LmZpbGVfbmFtZSB8fCBgQXR0YWNobWVudCAke2lkeCArIDF9YCxcclxuICAgICAgICAgICAgbWltZV90eXBlOiBtaW1lVHlwZXNbaWR4XSB8fCByYXc/Lm1pbWVfdHlwZSB8fCByYXc/Lm1pbWVUeXBlLFxyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICB9XHJcbiAgICAgIGNvbnN0IHVybCA9IFN0cmluZyhyYXc/LnVybCA/PyByYXc/LmZpbGVfdXJsID8/IHJhdz8uZG93bmxvYWRfdXJsID8/ICcnKS50cmltKCk7XHJcbiAgICAgIGlmICghZmlsZUlkICYmICF1cmwpIHJldHVybjtcclxuICAgICAgaWYgKGZpbGVJZCAmJiBhdHRhY2htZW50cy5zb21lKChhKSA9PiBhLmZpbGVfaWQgPT09IGZpbGVJZCkpIHJldHVybjtcclxuICAgICAgaWYgKCFmaWxlSWQgJiYgdXJsICYmIGF0dGFjaG1lbnRzLnNvbWUoKGEpID0+IGEudXJsID09PSB1cmwpKSByZXR1cm47XHJcbiAgICAgIGF0dGFjaG1lbnRzLnB1c2goe1xyXG4gICAgICAgIGZpbGVfaWQ6IGZpbGVJZCxcclxuICAgICAgICBmaWxlbmFtZTogU3RyaW5nKFxyXG4gICAgICAgICAgcmF3Py5maWxlbmFtZSA/P1xyXG4gICAgICAgICAgcmF3Py5maWxlX25hbWUgPz9cclxuICAgICAgICAgIHJhdz8ubmFtZSA/P1xyXG4gICAgICAgICAgKG1zZy5tZXNzYWdlX3R5cGUgPT09ICdJTUFHRScgPyAnSW1hZ2UnIDogJ0ZpbGUnKVxyXG4gICAgICAgICksXHJcbiAgICAgICAgbWltZV90eXBlOiByYXc/Lm1pbWVfdHlwZSA/PyByYXc/Lm1pbWVUeXBlID8/IChtc2cubWVzc2FnZV90eXBlID09PSAnSU1BR0UnID8gJ2ltYWdlLyonIDogdW5kZWZpbmVkKSxcclxuICAgICAgICBzaXplX2J5dGVzOiByYXc/LnNpemVfYnl0ZXMgPz8gcmF3Py5zaXplQnl0ZXMsXHJcbiAgICAgICAgdXJsOiB1cmwgfHwgdW5kZWZpbmVkLFxyXG4gICAgICB9KTtcclxuICAgIH07XHJcblxyXG4gICAgaWYgKEFycmF5LmlzQXJyYXkobXNnLmF0dGFjaG1lbnRzKSkge1xyXG4gICAgICBtc2cuYXR0YWNobWVudHMuZm9yRWFjaChhZGQpO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IG1lZGlhVmFsdWUgPSBTdHJpbmcobXNnLm1lZGlhX3VybCB8fCAnJykudHJpbSgpO1xyXG4gICAgaWYgKG1lZGlhVmFsdWUuc3RhcnRzV2l0aCgneycpIHx8IG1lZGlhVmFsdWUuc3RhcnRzV2l0aCgnWycpKSB7XHJcbiAgICAgIHRyeSB7XHJcbiAgICAgICAgY29uc3QgcGFyc2VkID0gSlNPTi5wYXJzZShtZWRpYVZhbHVlKTtcclxuICAgICAgICBjb25zdCBtZWRpYUF0dGFjaG1lbnRzID0gQXJyYXkuaXNBcnJheShwYXJzZWQpID8gcGFyc2VkIDogcGFyc2VkPy5hdHRhY2htZW50cztcclxuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShtZWRpYUF0dGFjaG1lbnRzKSkge1xyXG4gICAgICAgICAgbWVkaWFBdHRhY2htZW50cy5mb3JFYWNoKGFkZCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICghQXJyYXkuaXNBcnJheShwYXJzZWQpKSB7XHJcbiAgICAgICAgICBjb25zdCBpZHMgPSB0aGlzLnRvQXJyYXkocGFyc2VkPy5pZHMgPz8gcGFyc2VkPy5maWxlX2lkcyA/PyBwYXJzZWQ/LmF0dGFjaG1lbnRfaWRzKTtcclxuICAgICAgICAgIGNvbnN0IGZpbGVuYW1lcyA9IHRoaXMudG9BcnJheShwYXJzZWQ/LmZpbGVuYW1lcyk7XHJcbiAgICAgICAgICBjb25zdCBtaW1lVHlwZXMgPSB0aGlzLnRvQXJyYXkocGFyc2VkPy5taW1lX3R5cGVzID8/IHBhcnNlZD8ubWltZVR5cGVzKTtcclxuICAgICAgICAgIGlkcy5mb3JFYWNoKChpZCwgaWR4KSA9PiB7XHJcbiAgICAgICAgICAgIGFkZCh7XHJcbiAgICAgICAgICAgICAgZmlsZV9pZDogaWQsXHJcbiAgICAgICAgICAgICAgZmlsZW5hbWU6IGZpbGVuYW1lc1tpZHhdIHx8IGZpbGVuYW1lc1swXSB8fCAobXNnLm1lc3NhZ2VfdHlwZSA9PT0gJ0lNQUdFJyA/IGBJbWFnZSAke2lkeCArIDF9YCA6IGBBdHRhY2htZW50ICR7aWR4ICsgMX1gKSxcclxuICAgICAgICAgICAgICBtaW1lX3R5cGU6IG1pbWVUeXBlc1tpZHhdIHx8IChtc2cubWVzc2FnZV90eXBlID09PSAnSU1BR0UnID8gJ2ltYWdlLyonIDogdW5kZWZpbmVkKSxcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICAgIH0gY2F0Y2gge1xyXG4gICAgICAgIC8vIE5vbi1KU09OIG1lZGlhX3VybCB2YWx1ZXMgYXJlIGhhbmRsZWQgYnkgZ2V0UHJpbWFyeUF0dGFjaG1lbnQoKS5cclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGlkcyA9IHRoaXMudG9BcnJheShhbnlNc2c/LmF0dGFjaG1lbnRfaWRzID8/IGFueU1zZz8uZmlsZV9pZHMpO1xyXG4gICAgY29uc3QgZmlsZW5hbWVzID0gdGhpcy50b0FycmF5KGFueU1zZz8uZmlsZW5hbWVzKTtcclxuICAgIGNvbnN0IG1pbWVUeXBlcyA9IHRoaXMudG9BcnJheShhbnlNc2c/Lm1pbWVfdHlwZXMgPz8gYW55TXNnPy5taW1lVHlwZXMpO1xyXG4gICAgaWRzLmZvckVhY2goKGlkLCBpZHgpID0+IHtcclxuICAgICAgYWRkKHtcclxuICAgICAgICBmaWxlX2lkOiBpZCxcclxuICAgICAgICBmaWxlbmFtZTogZmlsZW5hbWVzW2lkeF0gfHwgZmlsZW5hbWVzWzBdIHx8IChtc2cubWVzc2FnZV90eXBlID09PSAnSU1BR0UnID8gYEltYWdlICR7aWR4ICsgMX1gIDogYEF0dGFjaG1lbnQgJHtpZHggKyAxfWApLFxyXG4gICAgICAgIG1pbWVfdHlwZTogbWltZVR5cGVzW2lkeF0gfHwgYW55TXNnPy5taW1lX3R5cGUgfHwgYW55TXNnPy5hdHRhY2htZW50X21pbWVfdHlwZSB8fCAobXNnLm1lc3NhZ2VfdHlwZSA9PT0gJ0lNQUdFJyA/ICdpbWFnZS8qJyA6IHVuZGVmaW5lZCksXHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcblxyXG4gICAgcmV0dXJuIGF0dGFjaG1lbnRzO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSB0b0FycmF5KHZhbHVlOiB1bmtub3duKTogc3RyaW5nW10ge1xyXG4gICAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSB7XHJcbiAgICAgIHJldHVybiB2YWx1ZVxyXG4gICAgICAgIC5tYXAoKHg6IGFueSkgPT4gKHR5cGVvZiB4ID09PSAnc3RyaW5nJyA/IHggOiB4Py5maWxlX2lkID8/IHg/LmlkID8/ICcnKSlcclxuICAgICAgICAubWFwKCh4KSA9PiBTdHJpbmcoeCkudHJpbSgpKVxyXG4gICAgICAgIC5maWx0ZXIoQm9vbGVhbik7XHJcbiAgICB9XHJcbiAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJyAmJiB2YWx1ZS50cmltKCkpIHtcclxuICAgICAgY29uc3QgdHJpbW1lZCA9IHZhbHVlLnRyaW0oKTtcclxuICAgICAgaWYgKHRyaW1tZWQuc3RhcnRzV2l0aCgneycpIHx8IHRyaW1tZWQuc3RhcnRzV2l0aCgnWycpKSB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgIGNvbnN0IHBhcnNlZCA9IEpTT04ucGFyc2UodHJpbW1lZCk7XHJcbiAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShwYXJzZWQpKSByZXR1cm4gdGhpcy50b0FycmF5KHBhcnNlZCk7XHJcbiAgICAgICAgICByZXR1cm4gdGhpcy50b0FycmF5KHBhcnNlZD8uaWRzID8/IHBhcnNlZD8uZmlsZV9pZHMgPz8gcGFyc2VkPy5hdHRhY2htZW50X2lkcyA/PyBwYXJzZWQ/LmF0dGFjaG1lbnRzKTtcclxuICAgICAgICB9IGNhdGNoIHtcclxuICAgICAgICAgIHJldHVybiBbXTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIHZhbHVlXHJcbiAgICAgICAgLnNwbGl0KC9bLFxcc10rLylcclxuICAgICAgICAubWFwKCh4KSA9PiB4LnRyaW0oKSlcclxuICAgICAgICAuZmlsdGVyKEJvb2xlYW4pO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIFtdO1xyXG4gIH1cclxuXHJcbiAgLyoqIFJldHVybnMgdGhlIHByaW1hcnkgYXR0YWNobWVudCBmb3IgYSBtZXNzYWdlLCBpZiBhbnkuICovXHJcbiAgcHJpdmF0ZSBnZXRQcmltYXJ5QXR0YWNobWVudChtc2c6IE1lc3NhZ2UpOiBBdHRhY2htZW50IHwgbnVsbCB7XHJcbiAgICBjb25zdCBhdHRhY2htZW50cyA9IHRoaXMuZ2V0QWxsQXR0YWNobWVudHMobXNnKTtcclxuICAgIGlmIChhdHRhY2htZW50cy5sZW5ndGggPiAwKSByZXR1cm4gYXR0YWNobWVudHNbMF07XHJcblxyXG4gICAgLy8gU29tZSBBUEkgcmVzcG9uc2VzIHByb3ZpZGUgZmlsZSBtZXRhZGF0YSBpbiBhbHRlcm5hdGUgZmllbGRzLlxyXG4gICAgY29uc3QgYW55TXNnID0gbXNnIGFzIGFueTtcclxuICAgIGNvbnN0IG11ID0gU3RyaW5nKG1zZy5tZWRpYV91cmwgfHwgJycpLnRyaW0oKTtcclxuICAgIGNvbnN0IG1lZGlhSXNEaXJlY3RVcmwgPVxyXG4gICAgICBtdS5zdGFydHNXaXRoKCdodHRwOi8vJykgfHwgbXUuc3RhcnRzV2l0aCgnaHR0cHM6Ly8nKSB8fCBtdS5zdGFydHNXaXRoKCdkYXRhOicpO1xyXG4gICAgY29uc3QgbWVkaWFJc1N0cnVjdHVyZWQgPSBtdS5zdGFydHNXaXRoKCd7JykgfHwgbXUuc3RhcnRzV2l0aCgnWycpO1xyXG4gICAgY29uc3QgZmlsZUlkID1cclxuICAgICAgYW55TXNnPy5maWxlX2lkIHx8XHJcbiAgICAgIGFueU1zZz8uYXR0YWNobWVudF9pZCB8fFxyXG4gICAgICBhbnlNc2c/LmF0dGFjaG1lbnRfaWRzPy5bMF0gfHxcclxuICAgICAgKCFtZWRpYUlzRGlyZWN0VXJsICYmICFtZWRpYUlzU3RydWN0dXJlZCAmJiBtdSA/IG11IDogdW5kZWZpbmVkKTtcclxuICAgIGNvbnN0IG1pbWUgPSBhbnlNc2c/Lm1pbWVfdHlwZSB8fCBhbnlNc2c/LmF0dGFjaG1lbnRfbWltZV90eXBlIHx8IChtc2cubWVzc2FnZV90eXBlID09PSAnSU1BR0UnID8gJ2ltYWdlLyonIDogdW5kZWZpbmVkKTtcclxuICAgIGNvbnN0IGV4cGxpY2l0RmlsZW5hbWUgPSBhbnlNc2c/LmZpbGVuYW1lIHx8IGFueU1zZz8uZmlsZV9uYW1lO1xyXG4gICAgY29uc3QgZmlsZW5hbWUgPVxyXG4gICAgICBleHBsaWNpdEZpbGVuYW1lIHx8XHJcbiAgICAgIChtc2cubWVzc2FnZV90eXBlID09PSAnSU1BR0UnID8gJ0ltYWdlJyA6IG1zZy5tZXNzYWdlX3R5cGUgPT09ICdGSUxFJyA/ICdGaWxlJyA6ICcnKTtcclxuICAgIGlmIChmaWxlSWQgfHwgZXhwbGljaXRGaWxlbmFtZSB8fCBtaW1lIHx8IG1zZy5tZXNzYWdlX3R5cGUgPT09ICdGSUxFJyB8fCBtc2cubWVzc2FnZV90eXBlID09PSAnSU1BR0UnKSB7XHJcbiAgICAgIHJldHVybiB7XHJcbiAgICAgICAgZmlsZV9pZDogU3RyaW5nKGZpbGVJZCB8fCAnJyksXHJcbiAgICAgICAgZmlsZW5hbWU6IFN0cmluZyhmaWxlbmFtZSB8fCAnRmlsZScpLFxyXG4gICAgICAgIG1pbWVfdHlwZTogbWltZSA/IFN0cmluZyhtaW1lKSA6IHVuZGVmaW5lZCxcclxuICAgICAgICB1cmw6IG1lZGlhSXNEaXJlY3RVcmwgPyBtdSA6IHVuZGVmaW5lZCxcclxuICAgICAgfTtcclxuICAgIH1cclxuICAgIHJldHVybiBudWxsO1xyXG4gIH1cclxuXHJcbiAgaXNJbWFnZUF0dGFjaG1lbnQobXNnOiBNZXNzYWdlLCBhdHRhY2htZW50PzogQXR0YWNobWVudCk6IGJvb2xlYW4ge1xyXG4gICAgY29uc3QgbWltZSA9IGF0dGFjaG1lbnQ/Lm1pbWVfdHlwZSB8fCB0aGlzLmdldFByaW1hcnlBdHRhY2htZW50KG1zZyk/Lm1pbWVfdHlwZSB8fCAnJztcclxuICAgIGlmIChtaW1lLnN0YXJ0c1dpdGgoJ2ltYWdlLycpKSByZXR1cm4gdHJ1ZTtcclxuICAgIGNvbnN0IG5hbWUgPSB0aGlzLmdldEZpbGVuYW1lTGlrZShtc2csIGF0dGFjaG1lbnQpO1xyXG4gICAgaWYgKC9cXC4ocG5nfGpwZT9nfGdpZnx3ZWJwfGJtcHxzdmd8aGVpY3xoZWlmKSQvaS50ZXN0KG5hbWUpKSByZXR1cm4gdHJ1ZTtcclxuICAgIHJldHVybiBtc2cubWVzc2FnZV90eXBlID09PSAnSU1BR0UnO1xyXG4gIH1cclxuXHJcbiAgLyoqIFJldHVybnMgdGhlIGNhY2hlZCBkYXRhIFVSTCBmb3IgYSBtZXNzYWdlJ3MgbWVkaWEsIG9yIG51bGwgYW5kIHRyaWdnZXJzIGJhY2tncm91bmQgbG9hZC4gKi9cclxuICBnZXRNZWRpYVVybChtc2c6IE1lc3NhZ2UsIGF0dGFjaG1lbnQ/OiBBdHRhY2htZW50KTogc3RyaW5nIHwgbnVsbCB7XHJcbiAgICBjb25zdCBhdHQgPSBhdHRhY2htZW50IHx8IHRoaXMuZ2V0UHJpbWFyeUF0dGFjaG1lbnQobXNnKTtcclxuICAgIGNvbnN0IGZpbGVJZCA9IGF0dD8uZmlsZV9pZD8udHJpbSgpO1xyXG5cclxuICAgIGNvbnN0IGRpcmVjdFVybCA9XHJcbiAgICAgIGF0dD8udXJsIHx8XHJcbiAgICAgICghYXR0YWNobWVudCA/IG1zZy5tZWRpYV91cmwgOiB1bmRlZmluZWQpIHx8XHJcbiAgICAgICghYXR0YWNobWVudCA/IChtc2cgYXMgYW55KT8udXJsIDogdW5kZWZpbmVkKSB8fFxyXG4gICAgICAoIWF0dGFjaG1lbnQgPyAobXNnIGFzIGFueSk/LmZpbGVfdXJsIDogdW5kZWZpbmVkKTtcclxuICAgIGlmIChcclxuICAgICAgZGlyZWN0VXJsICYmXHJcbiAgICAgIChkaXJlY3RVcmwuc3RhcnRzV2l0aCgnaHR0cDovLycpIHx8XHJcbiAgICAgICAgZGlyZWN0VXJsLnN0YXJ0c1dpdGgoJ2h0dHBzOi8vJykgfHxcclxuICAgICAgICBkaXJlY3RVcmwuc3RhcnRzV2l0aCgnZGF0YTonKSlcclxuICAgICkge1xyXG4gICAgICByZXR1cm4gZGlyZWN0VXJsO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICghZmlsZUlkKSB7XHJcbiAgICAgIHJldHVybiBudWxsO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGNhY2hlZCA9IHRoaXMuZmlsZVNlcnZpY2UuZ2V0Q2FjaGVkRGF0YVVybChmaWxlSWQpO1xyXG4gICAgaWYgKGNhY2hlZCkgcmV0dXJuIGNhY2hlZDtcclxuICAgIGlmICh0aGlzLm1lZGlhRmFpbGVkLmhhcyhmaWxlSWQpKSByZXR1cm4gbnVsbDtcclxuXHJcbiAgICAvLyBOb3QgeWV0IGNhY2hlZCDigJQga2ljayBvZmYgYSBiYWNrZ3JvdW5kIGZldGNoXHJcbiAgICB0aGlzLmZldGNoTWVkaWEoZmlsZUlkKTtcclxuICAgIHJldHVybiBudWxsO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBwcmV3YXJtTWVkaWEobWVzc2FnZXM6IE1lc3NhZ2VbXSk6IHZvaWQge1xyXG4gICAgZm9yIChjb25zdCBtc2cgb2YgbWVzc2FnZXMpIHtcclxuICAgICAgZm9yIChjb25zdCBhdHQgb2YgdGhpcy5nZXRSZW5kZXJhYmxlQXR0YWNobWVudHMobXNnKSkge1xyXG4gICAgICAgIGlmICghdGhpcy5pc0ltYWdlQXR0YWNobWVudChtc2csIGF0dCkpIGNvbnRpbnVlO1xyXG4gICAgICAgIGNvbnN0IGZpbGVJZCA9IGF0dC5maWxlX2lkPy50cmltKCk7XHJcbiAgICAgICAgaWYgKCFmaWxlSWQgfHwgZmlsZUlkLnN0YXJ0c1dpdGgoJ3RlbXAtJykpIGNvbnRpbnVlO1xyXG4gICAgICAgIGlmICh0aGlzLm1lZGlhRmFpbGVkLmhhcyhmaWxlSWQpKSBjb250aW51ZTtcclxuICAgICAgICBpZiAodGhpcy5maWxlU2VydmljZS5nZXRDYWNoZWREYXRhVXJsKGZpbGVJZCkpIGNvbnRpbnVlO1xyXG4gICAgICAgIC8vIFF1ZXVlIGFsbCBmaWxlcyBzbyBkb3dubG9hZCBsaW5rcyBhcHBlYXIgb25jZSByZXRyaWV2YWwgY29tcGxldGVzLlxyXG4gICAgICAgIHRoaXMuZmV0Y2hNZWRpYShmaWxlSWQpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGZldGNoTWVkaWEoZmlsZUlkOiBzdHJpbmcpOiB2b2lkIHtcclxuICAgIGlmICghZmlsZUlkIHx8IGZpbGVJZC5zdGFydHNXaXRoKCd0ZW1wLScpIHx8IHRoaXMubWVkaWFMb2FkaW5nLmhhcyhmaWxlSWQpIHx8IHRoaXMubWVkaWFGYWlsZWQuaGFzKGZpbGVJZCkpIHJldHVybjtcclxuICAgIHRoaXMubWVkaWFMb2FkaW5nLmFkZChmaWxlSWQpO1xyXG4gICAgdGhpcy5tZWRpYVF1ZXVlLnB1c2goZmlsZUlkKTtcclxuICAgIHRoaXMucHVtcE1lZGlhUXVldWUoKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgcHVtcE1lZGlhUXVldWUoKTogdm9pZCB7XHJcbiAgICB3aGlsZSAodGhpcy5hY3RpdmVNZWRpYVJlcXVlc3RzIDwgdGhpcy5tYXhNZWRpYVJlcXVlc3RzICYmIHRoaXMubWVkaWFRdWV1ZS5sZW5ndGggPiAwKSB7XHJcbiAgICAgIGNvbnN0IGZpbGVJZCA9IHRoaXMubWVkaWFRdWV1ZS5zaGlmdCgpO1xyXG4gICAgICBpZiAoIWZpbGVJZCkgY29udGludWU7XHJcbiAgICAgIHRoaXMuYWN0aXZlTWVkaWFSZXF1ZXN0cyArPSAxO1xyXG5cclxuICAgICAgdGhpcy5maWxlU2VydmljZS5nZXRGaWxlRGF0YVVybChmaWxlSWQpLnN1YnNjcmliZSh7XHJcbiAgICAgICAgbmV4dDogKCkgPT4ge1xyXG4gICAgICAgICAgdGhpcy5maW5pc2hNZWRpYVJlcXVlc3QoZmlsZUlkKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGVycm9yOiAoKSA9PiB7XHJcbiAgICAgICAgICB0aGlzLm1lZGlhRmFpbGVkLmFkZChmaWxlSWQpO1xyXG4gICAgICAgICAgdGhpcy5maW5pc2hNZWRpYVJlcXVlc3QoZmlsZUlkKTtcclxuICAgICAgICB9LFxyXG4gICAgICB9KTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHByaXZhdGUgZmluaXNoTWVkaWFSZXF1ZXN0KGZpbGVJZDogc3RyaW5nKTogdm9pZCB7XHJcbiAgICB0aGlzLmFjdGl2ZU1lZGlhUmVxdWVzdHMgPSBNYXRoLm1heCgwLCB0aGlzLmFjdGl2ZU1lZGlhUmVxdWVzdHMgLSAxKTtcclxuICAgIHRoaXMubWVkaWFMb2FkaW5nLmRlbGV0ZShmaWxlSWQpO1xyXG4gICAgdGhpcy5jZHIubWFya0ZvckNoZWNrKCk7XHJcbiAgICB0aGlzLnB1bXBNZWRpYVF1ZXVlKCk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHJlc2V0TWVkaWFRdWV1ZSgpOiB2b2lkIHtcclxuICAgIHRoaXMubWVkaWFRdWV1ZSA9IFtdO1xyXG4gICAgdGhpcy5tZWRpYUxvYWRpbmcuY2xlYXIoKTtcclxuICAgIHRoaXMuYWN0aXZlTWVkaWFSZXF1ZXN0cyA9IDA7XHJcbiAgfVxyXG5cclxuICBzaG91bGRTaG93TWVkaWFTcGlubmVyKHRhcmdldDogTWVzc2FnZSB8IEF0dGFjaG1lbnQpOiBib29sZWFuIHtcclxuICAgIGNvbnN0IGZpbGVJZCA9IHRoaXMuZ2V0QXR0YWNobWVudEZpbGVJZCh0YXJnZXQpO1xyXG4gICAgaWYgKCFmaWxlSWQgfHwgZmlsZUlkLnN0YXJ0c1dpdGgoJ3RlbXAtJykpIHJldHVybiBmYWxzZTtcclxuICAgIHJldHVybiB0aGlzLm1lZGlhTG9hZGluZy5oYXMoZmlsZUlkKSAmJiAhdGhpcy5tZWRpYUZhaWxlZC5oYXMoZmlsZUlkKTtcclxuICB9XHJcblxyXG4gIGlzVmlkZW9BdHRhY2htZW50KG1zZzogTWVzc2FnZSwgYXR0YWNobWVudD86IEF0dGFjaG1lbnQpOiBib29sZWFuIHtcclxuICAgIGNvbnN0IG1pbWUgPSBhdHRhY2htZW50Py5taW1lX3R5cGUgfHwgdGhpcy5nZXRQcmltYXJ5QXR0YWNobWVudChtc2cpPy5taW1lX3R5cGUgfHwgJyc7XHJcbiAgICBpZiAobWltZS5zdGFydHNXaXRoKCd2aWRlby8nKSkgcmV0dXJuIHRydWU7XHJcbiAgICBjb25zdCBuYW1lID0gdGhpcy5nZXRGaWxlbmFtZUxpa2UobXNnLCBhdHRhY2htZW50KTtcclxuICAgIHJldHVybiAvXFwuKG1wNHx3ZWJtfG1vdnxtNHZ8YXZpfG1rdikkL2kudGVzdChuYW1lKTtcclxuICB9XHJcblxyXG4gIGdldEF0dGFjaG1lbnRNaW1lVHlwZShtc2c6IE1lc3NhZ2UsIGF0dGFjaG1lbnQ/OiBBdHRhY2htZW50KTogc3RyaW5nIHtcclxuICAgIHJldHVybiBhdHRhY2htZW50Py5taW1lX3R5cGUgfHwgdGhpcy5nZXRQcmltYXJ5QXR0YWNobWVudChtc2cpPy5taW1lX3R5cGUgfHwgJ2FwcGxpY2F0aW9uL29jdGV0LXN0cmVhbSc7XHJcbiAgfVxyXG5cclxuICBnZXRBdHRhY2htZW50TmFtZShtc2c6IE1lc3NhZ2UsIGF0dGFjaG1lbnQ/OiBBdHRhY2htZW50KTogc3RyaW5nIHtcclxuICAgIHJldHVybiBhdHRhY2htZW50Py5maWxlbmFtZSB8fCB0aGlzLmdldFByaW1hcnlBdHRhY2htZW50KG1zZyk/LmZpbGVuYW1lIHx8IG1zZy5jb250ZW50IHx8ICdGaWxlJztcclxuICB9XHJcblxyXG4gIGhhc0ZpbGVBdHRhY2htZW50KG1zZzogTWVzc2FnZSk6IGJvb2xlYW4ge1xyXG4gICAgcmV0dXJuIG1zZy5tZXNzYWdlX3R5cGUgPT09ICdGSUxFJyB8fCB0aGlzLmdldFJlbmRlcmFibGVBdHRhY2htZW50cyhtc2cpLmxlbmd0aCA+IDA7XHJcbiAgfVxyXG5cclxuICBoYXNNZWRpYUZhaWxlZCh0YXJnZXQ6IE1lc3NhZ2UgfCBBdHRhY2htZW50KTogYm9vbGVhbiB7XHJcbiAgICBjb25zdCBmaWxlSWQgPSB0aGlzLmdldEF0dGFjaG1lbnRGaWxlSWQodGFyZ2V0KTtcclxuICAgIHJldHVybiAhIWZpbGVJZCAmJiB0aGlzLm1lZGlhRmFpbGVkLmhhcyhmaWxlSWQpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBnZXRBdHRhY2htZW50RmlsZUlkKHRhcmdldDogTWVzc2FnZSB8IEF0dGFjaG1lbnQpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xyXG4gICAgaWYgKCdmaWxlX2lkJyBpbiB0YXJnZXQpIHJldHVybiB0YXJnZXQuZmlsZV9pZDtcclxuICAgIHJldHVybiB0aGlzLmdldFByaW1hcnlBdHRhY2htZW50KHRhcmdldCk/LmZpbGVfaWQ7XHJcbiAgfVxyXG5cclxuICBnZXRGaWxlSWNvbihtc2c6IE1lc3NhZ2UsIGF0dGFjaG1lbnQ/OiBBdHRhY2htZW50KTogc3RyaW5nIHtcclxuICAgIGNvbnN0IG1pbWUgPSB0aGlzLmdldEF0dGFjaG1lbnRNaW1lVHlwZShtc2csIGF0dGFjaG1lbnQpO1xyXG4gICAgY29uc3QgbmFtZSA9IHRoaXMuZ2V0QXR0YWNobWVudE5hbWUobXNnLCBhdHRhY2htZW50KS50b0xvd2VyQ2FzZSgpO1xyXG4gICAgaWYgKG1pbWUuc3RhcnRzV2l0aCgndmlkZW8vJykgfHwgL1xcLihtcDR8d2VibXxtb3Z8bTR2fGF2aXxta3YpJC9pLnRlc3QobmFtZSkpIHJldHVybiAndmlkZW9jYW0nO1xyXG4gICAgaWYgKG1pbWUuc3RhcnRzV2l0aCgnYXVkaW8vJykgfHwgL1xcLihtcDN8d2F2fG9nZ3xtNGF8ZmxhYykkL2kudGVzdChuYW1lKSkgcmV0dXJuICdhdWRpb3RyYWNrJztcclxuICAgIGlmIChtaW1lLmluY2x1ZGVzKCdwZGYnKSB8fCBuYW1lLmVuZHNXaXRoKCcucGRmJykpIHJldHVybiAncGljdHVyZV9hc19wZGYnO1xyXG4gICAgaWYgKG1pbWUuaW5jbHVkZXMoJ3NwcmVhZHNoZWV0JykgfHwgbWltZS5pbmNsdWRlcygnZXhjZWwnKSB8fCAvXFwuKHhsc3x4bHN4fGNzdikkL2kudGVzdChuYW1lKSkgcmV0dXJuICd0YWJsZV9jaGFydCc7XHJcbiAgICBpZiAobWltZS5pbmNsdWRlcygnZG9jdW1lbnQnKSB8fCBtaW1lLmluY2x1ZGVzKCd3b3JkJykgfHwgL1xcLihkb2N8ZG9jeHx0eHR8cnRmKSQvaS50ZXN0KG5hbWUpKSByZXR1cm4gJ2Rlc2NyaXB0aW9uJztcclxuICAgIGlmIChtaW1lLmluY2x1ZGVzKCd6aXAnKSB8fCAvXFwuKHppcHxyYXJ8N3p8dGFyfGd6KSQvaS50ZXN0KG5hbWUpKSByZXR1cm4gJ2ZvbGRlcl96aXAnO1xyXG4gICAgcmV0dXJuICdpbnNlcnRfZHJpdmVfZmlsZSc7XHJcbiAgfVxyXG5cclxuICBvcGVuTGlnaHRib3goZGF0YVVybDogc3RyaW5nLCBldmVudD86IEV2ZW50KTogdm9pZCB7XHJcbiAgICBldmVudD8uc3RvcFByb3BhZ2F0aW9uKCk7XHJcbiAgICB0aGlzLmxpZ2h0Ym94T3Blbi5lbWl0KGRhdGFVcmwpO1xyXG4gIH1cclxuXHJcbiAgZG93bmxvYWRBdHRhY2htZW50KG1zZzogTWVzc2FnZSwgYXR0YWNobWVudDogQXR0YWNobWVudCwgZXZlbnQ/OiBFdmVudCk6IHZvaWQge1xyXG4gICAgZXZlbnQ/LnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICBldmVudD8uc3RvcFByb3BhZ2F0aW9uKCk7XHJcblxyXG4gICAgY29uc3QgZGlyZWN0VXJsID0gYXR0YWNobWVudC51cmw7XHJcbiAgICBpZiAoZGlyZWN0VXJsICYmIC9eKGh0dHBzPzp8ZGF0YTopL2kudGVzdChkaXJlY3RVcmwpKSB7XHJcbiAgICAgIHRoaXMudHJpZ2dlckRvd25sb2FkKGRpcmVjdFVybCwgdGhpcy5nZXRBdHRhY2htZW50TmFtZShtc2csIGF0dGFjaG1lbnQpKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGZpbGVJZCA9IGF0dGFjaG1lbnQuZmlsZV9pZD8udHJpbSgpO1xyXG4gICAgaWYgKCFmaWxlSWQgfHwgZmlsZUlkLnN0YXJ0c1dpdGgoJ3RlbXAtJykgfHwgZmlsZUlkLnN0YXJ0c1dpdGgoJ3snKSB8fCBmaWxlSWQuc3RhcnRzV2l0aCgnWycpKSB7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBjYWNoZWQgPSB0aGlzLmZpbGVTZXJ2aWNlLmdldENhY2hlZERhdGFVcmwoZmlsZUlkKTtcclxuICAgIGlmIChjYWNoZWQpIHtcclxuICAgICAgdGhpcy50cmlnZ2VyRG93bmxvYWQoY2FjaGVkLCB0aGlzLmdldEF0dGFjaG1lbnROYW1lKG1zZywgYXR0YWNobWVudCkpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5tZWRpYUxvYWRpbmcuYWRkKGZpbGVJZCk7XHJcbiAgICB0aGlzLmZpbGVTZXJ2aWNlLmdldEZpbGVEYXRhVXJsKGZpbGVJZCkuc3Vic2NyaWJlKHtcclxuICAgICAgbmV4dDogKGRhdGFVcmwpID0+IHtcclxuICAgICAgICB0aGlzLm1lZGlhTG9hZGluZy5kZWxldGUoZmlsZUlkKTtcclxuICAgICAgICB0aGlzLnRyaWdnZXJEb3dubG9hZChkYXRhVXJsLCB0aGlzLmdldEF0dGFjaG1lbnROYW1lKG1zZywgYXR0YWNobWVudCkpO1xyXG4gICAgICAgIHRoaXMuY2RyLm1hcmtGb3JDaGVjaygpO1xyXG4gICAgICB9LFxyXG4gICAgICBlcnJvcjogKCkgPT4ge1xyXG4gICAgICAgIHRoaXMubWVkaWFMb2FkaW5nLmRlbGV0ZShmaWxlSWQpO1xyXG4gICAgICAgIHRoaXMubWVkaWFGYWlsZWQuYWRkKGZpbGVJZCk7XHJcbiAgICAgICAgdGhpcy5jZHIubWFya0ZvckNoZWNrKCk7XHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgdHJpZ2dlckRvd25sb2FkKHVybDogc3RyaW5nLCBmaWxlbmFtZTogc3RyaW5nKTogdm9pZCB7XHJcbiAgICBjb25zdCBsaW5rID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYScpO1xyXG4gICAgbGluay5ocmVmID0gdXJsO1xyXG4gICAgbGluay5kb3dubG9hZCA9IGZpbGVuYW1lIHx8ICdhdHRhY2htZW50JztcclxuICAgIGxpbmsudGFyZ2V0ID0gJ19ibGFuayc7XHJcbiAgICBsaW5rLnJlbCA9ICdub29wZW5lcic7XHJcbiAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGxpbmspO1xyXG4gICAgbGluay5jbGljaygpO1xyXG4gICAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZChsaW5rKTtcclxuICB9XHJcblxyXG4gIC8vIOKUgOKUgCBSZWFjdGlvbnMg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcblxyXG4gIG9uRW1vamlTZWxlY3RlZChlbW9qaTogc3RyaW5nLCBtZXNzYWdlSWQ6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgdGhpcy50b2dnbGVSZWFjdGlvbihlbW9qaSwgbWVzc2FnZUlkKTtcclxuICB9XHJcblxyXG4gIHRvZ2dsZVJlYWN0aW9uKGVtb2ppOiBzdHJpbmcsIG1lc3NhZ2VJZDogc3RyaW5nKTogdm9pZCB7XHJcbiAgICBjb25zdCBtc2cgPSB0aGlzLm1lc3NhZ2VzLmZpbmQobSA9PiBtLm1lc3NhZ2VfaWQgPT09IG1lc3NhZ2VJZCk7XHJcbiAgICBpZiAoIW1zZykgcmV0dXJuO1xyXG4gICAgXHJcbiAgICBjb25zdCByZWFjdGlvbiA9IG1zZy5yZWFjdGlvbnM/LmZpbmQociA9PiByLmVtb2ppID09PSBlbW9qaSk7XHJcbiAgICBpZiAocmVhY3Rpb24/Lmhhc1JlYWN0ZWQpIHtcclxuICAgICAgdGhpcy5zdG9yZS5yZW1vdmVSZWFjdGlvbihtZXNzYWdlSWQsIGVtb2ppKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHRoaXMuc3RvcmUuYWRkUmVhY3Rpb24obWVzc2FnZUlkLCBlbW9qaSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBnZXRSZWFjdG9yVG9vbHRpcChyZWFjdGlvbjogYW55KTogc3RyaW5nIHtcclxuICAgIGlmICghcmVhY3Rpb24/LnJlYWN0b3JzPy5sZW5ndGgpIHJldHVybiAnJztcclxuICAgIHJldHVybiByZWFjdGlvbi5yZWFjdG9ycy5qb2luKCcsICcpO1xyXG4gIH1cclxufVxyXG4iXX0=