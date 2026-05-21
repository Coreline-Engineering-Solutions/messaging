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
    mentionOptions = [];
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
    lastMentionConversationId = null;
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
        ]).subscribe(([convId, msgMap, chats, contacts, loading, removedGroupIds, messageTextScale, codeTextScale]) => {
            this.loading = loading;
            this.visibleContacts = contacts || [];
            this.messageTextScale = messageTextScale;
            this.codeTextScale = codeTextScale;
            if (this.isGroup && this.conversationId && this.mentionOptions.length === 0) {
                this.refreshMentionOptions();
            }
            if (convId && convId !== this.conversationId) {
                this.conversationId = convId;
                this.resetMediaQueue();
                this.clearReply();
                this.shouldScrollToBottom = true;
                const chat = chats.find((c) => c.conversationId === convId);
                this.conversationName = chat?.name || 'Chat';
                this.isGroup = chat?.isGroup || false;
                this.refreshMentionOptions();
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
        if (!this.isGroup || this.isSystemMessage(message))
            return;
        this.replyToMessage = message;
        this.messageInput?.focus();
    }
    clearReply() {
        this.replyToMessage = null;
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
        return String(message.content || '');
    }
    truncateReplyText(value) {
        const text = String(value || '').replace(/\s+/g, ' ').trim();
        return text.length > 120 ? `${text.slice(0, 117)}...` : text || 'Attachment';
    }
    refreshMentionOptions() {
        if (!this.isGroup || !this.conversationId) {
            this.mentionOptions = [];
            this.lastMentionConversationId = null;
            return;
        }
        const convId = this.conversationId;
        if (this.lastMentionConversationId === convId && this.mentionOptions.length > 0)
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
    onSendMessage(content) {
        if (this.isRemovedFromGroup)
            return;
        const mentions = this.getMentionIdsFromContent(content);
        this.store.sendMessage(this.conversationId, content, 'TEXT', {
            replyTo: this.replyToMessage,
            mentions,
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
                const outgoingText = this.store.prepareOutgoingMessageContent(messageText, this.replyToMessage);
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
        return String(msg.sender_id) === String(this.myContactId);
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
        if (/\b(function|const|let|var|=>|console\.log|import\s+.*from)\b/.test(trimmed))
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
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "17.3.12", type: ChatThreadComponent, isStandalone: true, selector: "app-chat-thread", outputs: { lightboxOpen: "lightboxOpen" }, viewQueries: [{ propertyName: "scrollContainer", first: true, predicate: ["scrollContainer"], descendants: true }, { propertyName: "messageInput", first: true, predicate: MessageInputComponent, descendants: true }], ngImport: i0, template: `
    <div
      class="chat-thread"
      [class.drag-over]="threadDragOver"
      [style.--message-text-scale]="messageTextScale"
      [style.--code-text-scale]="codeTextScale"
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
                  <div *ngIf="isCodeContent(getMessageCaption(msg)); else nonCodeCaption" class="code-message-wrap attachment-render-block">
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
                <button
                  *ngIf="isGroup"
                  type="button"
                  class="reply-message-btn"
                  (click)="startReply(msg, $event)"
                  matTooltip="Reply"
                  matTooltipPosition="above"
                >
                  <mat-icon>reply</mat-icon>
                </button>
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
        [replyTo]="replyToMessage ? getComposeReplyPreview(replyToMessage) : null"
        [enableMentions]="isGroup"
        [mentionOptions]="mentionOptions"
        (messageSent)="onSendMessage($event)"
        (messageWithFiles)="onSendWithFiles($event)"
        (replyCancelled)="clearReply()"
      ></app-message-input>
    </div>

  `, isInline: true, styles: [":host{--attachment-thumb-size: 180px}.chat-thread{display:flex;flex-direction:column;height:100%;background:#041322;position:relative;container-type:inline-size;--attachment-thumb-size: clamp(120px, 48cqw, 180px)}.chat-thread.drag-over{outline:2px dashed rgba(255,255,255,.45);outline-offset:-6px}.thread-drag-overlay{position:absolute;inset:8px;z-index:20;pointer-events:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:#fff;background:#1f4bd852;border:2px dashed rgba(255,255,255,.55);border-radius:14px;font-size:14px;font-weight:600}.thread-drag-overlay mat-icon{font-size:36px;width:36px;height:36px}.chat-header{display:flex;align-items:center;padding:8px 8px 8px 4px;border-bottom:1px solid rgba(255,255,255,.15);gap:4px;flex-shrink:0}.chat-header button mat-icon{color:#fffc}.chat-name{font-size:16px;font-weight:600;color:#fff}.header-info{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;padding:0 4px}.header-actions{display:flex;align-items:center;gap:0}.header-actions button{width:32px;height:32px;min-width:32px!important;padding:0!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;--mdc-icon-button-state-layer-size: 32px}.hdr-btn{border-radius:6px!important;transition:background .15s,box-shadow .15s}.hdr-btn:hover{background:#ffffff26!important;box-shadow:0 2px 8px #0003}.hdr-btn mat-icon{font-size:20px;width:20px;height:20px;line-height:20px;margin:0;display:flex;align-items:center;justify-content:center}:host ::ng-deep .hdr-btn .mat-mdc-button-touch-target{width:32px!important;height:32px!important}.messages-area{flex:1;overflow-y:auto;padding:12px;background:transparent;scrollbar-width:none;-ms-overflow-style:none}.messages-area::-webkit-scrollbar{display:none}.loading-indicator{display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;color:#ffffffb3;font-size:13px}.removed-group-state{height:100%;min-height:260px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:10px;padding:32px 24px;color:#ffffffc7;box-sizing:border-box}.removed-group-state mat-icon{width:44px;height:44px;font-size:44px;color:#f87171;margin-bottom:4px}.removed-group-state h4{margin:0;color:#fff;font-size:17px;font-weight:700}.removed-group-state p{margin:0 0 8px;max-width:280px;font-size:13px;line-height:1.4;color:#ffffff9e}.removed-exit-btn{border-radius:10px;background:#ffffff2e!important;color:#fff!important;font-weight:700;padding:0 18px}.load-more-btn{align-self:center;margin-bottom:16px;font-size:12px;color:#fff}.messages-list{display:flex;flex-direction:column;gap:1px;flex:1}.date-separator{text-align:center;margin:16px 0 8px;font-size:12px;color:#ffffffb3;font-weight:500}.message-bubble-row{display:flex;flex-direction:column;max-width:88%;margin-bottom:2px}.message-bubble-row.own{align-self:flex-end;align-items:flex-end}.message-bubble-row.other{align-self:flex-start;align-items:flex-start}.sender-name{font-size:11px;font-weight:700;color:#fffffff2;margin-bottom:3px;letter-spacing:.2px;padding:0 10px;text-shadow:0 1px 3px rgba(0,0,0,.4)}.system-message-row{align-self:center;max-width:88%;margin:8px auto;text-align:center}.system-message-text{display:inline-flex;align-items:center;justify-content:center;padding:5px 11px;border-radius:999px;background:#ffffff17;border:1px solid rgba(255,255,255,.12);color:#ffffffb8;font-size:11px;line-height:1.35}.message-bubble{padding:8px 14px 7px;border-radius:14px;font-size:calc(clamp(11px,3.4cqw,13px) * var(--message-text-scale, 1));line-height:1.32;word-break:break-word;color:#f5f7ff;position:relative;display:inline-block;min-width:fit-content}.message-bubble-row.other .message-bubble{background:#0d2540;border-bottom-left-radius:5px;box-shadow:0 1px 4px #0006}.message-bubble.own-bubble{background:#0a3d62;border-bottom-right-radius:5px;box-shadow:0 1px 4px #0006}.reply-context{display:flex;align-items:center;gap:7px;margin-bottom:7px;padding:7px 9px;border-radius:10px;background:#ffffff14;border-left:3px solid rgba(127,180,255,.78);max-width:min(68cqw,420px)}.reply-context mat-icon{color:#bfdbfe;font-size:16px;width:16px;height:16px;flex-shrink:0}.reply-context div{min-width:0}.reply-context span{display:block;color:#bfdbfe;font-size:11px;font-weight:700;margin-bottom:2px}.reply-context p{margin:0;color:#ffffffc7;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.text-content{white-space:pre-wrap;tab-size:4}.text-content.preformatted-text{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,Liberation Mono,monospace;font-size:calc(clamp(10px,3.1cqw,12px) * var(--code-text-scale, 1));line-height:1.45;overflow-x:auto;max-width:min(72cqw,520px);scrollbar-width:none;-ms-overflow-style:none}.text-content.preformatted-text::-webkit-scrollbar{display:none}.attachment-caption{margin-top:8px;width:var(--attachment-thumb-size);max-width:var(--attachment-thumb-size);box-sizing:border-box}.attachment-caption .text-content{white-space:pre-wrap;overflow-wrap:anywhere;max-width:100%}.attachment-render-block{width:100%;max-width:100%}.code-message-wrap{position:relative;max-width:min(76cqw,560px);border-radius:10px;overflow:hidden;border:1px solid rgba(255,255,255,.14);background:#061827}.render-copy-btn{position:absolute;top:6px;right:6px;z-index:2;width:26px;height:26px;border:none;border-radius:7px;display:inline-flex;align-items:center;justify-content:center;padding:0;background:#071d30d1;color:#ffffffc7;cursor:pointer;opacity:0;transition:opacity .12s,background .12s,color .12s}.code-message-wrap:hover .render-copy-btn,.table-message-wrap:hover .render-copy-btn,.md-message-wrap:hover .render-copy-btn,.render-copy-btn:focus{opacity:1}.render-copy-btn:hover{background:#7fb4ff38;color:#fff}.render-copy-btn mat-icon{font-size:16px;width:16px;height:16px;line-height:16px}.code-message{margin:0;padding:12px 42px 28px 12px;overflow-x:auto;color:#dbeafe;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,Liberation Mono,monospace;font-size:calc(clamp(10px,3.1cqw,12px) * var(--code-text-scale, 1));line-height:1.45;white-space:pre;tab-size:2;scrollbar-width:none;-ms-overflow-style:none}.code-message::-webkit-scrollbar{display:none}.code-language{position:absolute;right:8px;bottom:6px;padding:2px 7px;border-radius:999px;background:#7fb4ff29;color:#bfdbfe;font-size:10px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;pointer-events:none}.md-language{position:absolute;right:8px;bottom:6px;padding:2px 7px;border-radius:999px;background:#86efac24;color:#bbf7d0;font-size:10px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;pointer-events:none}:host ::ng-deep .code-token-keyword{color:#93c5fd;font-weight:700}:host ::ng-deep .code-token-string{color:#86efac}:host ::ng-deep .code-token-number{color:#fbbf24}:host ::ng-deep .code-token-comment{color:#94a3b8;font-style:italic}:host ::ng-deep .code-token-function{color:#c4b5fd}.table-message-wrap{position:relative;max-width:min(76cqw,560px);overflow-x:auto;border-radius:9px;border:1px solid rgba(255,255,255,.16);background:#ffffff0a;scrollbar-width:none;-ms-overflow-style:none}.table-message-wrap::-webkit-scrollbar{display:none}.pasted-table{border-collapse:collapse;min-width:100%;font-size:calc(clamp(10px,3.1cqw,12px) * var(--code-text-scale, 1));line-height:1.35;color:#f5f7ff}.pasted-table th,.pasted-table td{padding:6px 9px;border-right:1px solid rgba(255,255,255,.12);border-bottom:1px solid rgba(255,255,255,.12);text-align:left;white-space:pre-wrap;vertical-align:top}.pasted-table th{background:#ffffff1a;font-weight:700}.pasted-table tr:last-child td,.pasted-table tr:last-child th{border-bottom:none}.pasted-table th:last-child,.pasted-table td:last-child{border-right:none}.md-message-wrap{position:relative;max-width:min(76cqw,560px);overflow-x:auto;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:#ffffff0d;scrollbar-width:none;-ms-overflow-style:none}.md-message-wrap::-webkit-scrollbar{display:none}.md-message{padding:10px 42px 28px 12px;color:#f5f7ff;font-size:calc(clamp(11px,3.4cqw,13px) * var(--message-text-scale, 1));line-height:1.45;overflow-wrap:anywhere}:host ::ng-deep .md-message h1,:host ::ng-deep .md-message h2,:host ::ng-deep .md-message h3{margin:8px 0 6px;color:#fff;line-height:1.25}:host ::ng-deep .md-message h1{font-size:18px}:host ::ng-deep .md-message h2{font-size:16px}:host ::ng-deep .md-message h3{font-size:14px}:host ::ng-deep .md-message p{margin:6px 0}:host ::ng-deep .md-message ul,:host ::ng-deep .md-message ol{margin:6px 0;padding-left:20px}:host ::ng-deep .md-message blockquote{margin:8px 0;padding-left:10px;border-left:3px solid rgba(127,180,255,.55);color:#ffffffc7}:host ::ng-deep .md-message code{padding:1px 5px;border-radius:5px;background:#00000040;color:#bfdbfe;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,Liberation Mono,monospace;font-size:12px}:host ::ng-deep .md-message pre{margin:8px 0;padding:9px;border-radius:8px;overflow-x:auto;background:#061827;scrollbar-width:none;-ms-overflow-style:none}:host ::ng-deep .md-message pre::-webkit-scrollbar{display:none}:host ::ng-deep .md-message pre code{padding:0;background:transparent;color:#dbeafe;white-space:pre}.image-message{line-height:0}.media-wrapper{position:relative;display:inline-block;line-height:0;width:var(--attachment-thumb-size);height:var(--attachment-thumb-size);overflow:hidden;border-radius:10px;background:#ffffff14}.media-img{width:100%;height:100%;border-radius:inherit;display:block;cursor:zoom-in;object-fit:cover}.attachment-actions{position:absolute;right:6px;top:6px;display:flex;gap:4px;opacity:0;transition:opacity .12s ease;pointer-events:none}.media-wrapper:hover .attachment-actions{opacity:1;pointer-events:auto}.attachment-action-btn,.file-download-btn{border:none;border-radius:999px;background:#071d30d1;color:#fff;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0}.attachment-action-btn{width:28px;height:28px}.attachment-action-btn mat-icon{font-size:17px;width:17px;height:17px}.media-video{max-width:240px;max-height:260px;border-radius:10px;display:block;background:#000}.video-message{display:flex;flex-direction:column;gap:6px}.video-download{color:#ffffffc7;font-size:12px;text-decoration:underline;text-underline-offset:2px}.media-placeholder{display:flex;align-items:center;justify-content:center;gap:8px;width:var(--attachment-thumb-size);height:var(--attachment-thumb-size);border-radius:10px;background:#ffffff14;color:#fff9;font-size:11px}.media-load-label{font-size:11px;color:#fff9}.attachments-list{display:flex;flex-direction:column;gap:8px;max-width:100%}.attachment-item{max-width:100%}.file-message{display:flex;align-items:center;gap:8px;padding:4px 0}.attachment-thumb.file-message{position:relative;width:var(--attachment-thumb-size);height:var(--attachment-thumb-size);padding:12px;border-radius:10px;background:#ffffff14;flex-direction:column;justify-content:center;box-sizing:border-box;overflow:hidden}.file-download{display:inline-flex;align-items:center;gap:8px;color:#fff;text-decoration:none;max-width:240px}.file-msg-icon{font-size:42px;width:42px;height:42px;color:#fffc;flex-shrink:0}.file-msg-name{font-size:13px;color:#fff;line-height:1.2;max-width:100%;overflow:hidden;text-align:center;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;word-break:break-word}.file-download-icon{font-size:18px;width:18px;height:18px;color:#ffffffb3;flex-shrink:0}.file-download-btn{width:24px;height:24px;flex-shrink:0;position:absolute;right:6px;top:6px}.file-download-link{border:none;border-radius:999px;background:#ffffff29;color:#fff;cursor:pointer;font-size:11px;padding:4px 10px;margin-top:4px}.message-meta{display:flex;align-items:center;gap:4px;margin-top:3px}.msg-time{font-size:10px;color:#dae0faa8}.message-bubble-row.other .msg-time{color:#d8dff694}.read-icon{font-size:14px;width:14px;height:14px;opacity:.7}.read-icon.read{color:#60a5fa;opacity:1}.read-icon.unread{color:#dae0fa80;opacity:1}.reply-message-btn{position:absolute;right:-10px;bottom:-10px;width:24px;height:24px;border:1px solid rgba(255,255,255,.16);border-radius:999px;background:#071d30;color:#ffffffc7;display:inline-flex;align-items:center;justify-content:center;padding:0;cursor:pointer;opacity:0;transform:scale(.92);transition:opacity .12s,transform .12s,background .12s,color .12s;z-index:3}.message-bubble:hover .reply-message-btn,.reply-message-btn:focus{opacity:1;transform:scale(1)}.reply-message-btn:hover{background:#7fb4ff38;color:#fff}.reply-message-btn mat-icon{font-size:15px;width:15px;height:15px;line-height:15px}.quick-reactions{position:absolute;top:-18px;right:0;display:flex;align-items:center;gap:4px;padding:3px 5px;background:#071d30;border:1px solid rgba(255,255,255,.14);border-radius:999px;box-shadow:0 6px 14px #00000047;z-index:4}.message-bubble-row.other .quick-reactions{left:0;right:auto}.message-bubble-row.own .quick-reactions{left:auto;right:0}.quick-emoji-btn{width:20px;height:20px;border:none;border-radius:999px;background:transparent;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:13px;line-height:1;cursor:pointer;padding:0;transition:transform .12s ease,background .12s ease}.quick-emoji-btn:hover{background:#ffffff2e;transform:scale(1.14)}.reactions-row{display:flex;flex-wrap:wrap;gap:3px;margin-top:5px}.reaction-chip{background:#ffffff14;border:1px solid rgba(255,255,255,.2);border-radius:999px;padding:2px 7px;font-size:11px;color:#f2f6ff;cursor:pointer;transition:all .2s;display:inline-flex;align-items:center;gap:3px;max-width:180px}.reaction-chip:hover{background:#ffffff40;transform:scale(1.05)}.reaction-chip.own-reaction{background:#2a5bff4d;border-color:#2a5bff80}.empty-chat{display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;color:#9ca3af}.empty-chat mat-icon{font-size:48px;width:48px;height:48px;margin-bottom:8px}.empty-chat p{font-size:14px;margin:0}\n"], dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i6.NgForOf, selector: "[ngFor][ngForOf]", inputs: ["ngForOf", "ngForTrackBy", "ngForTemplate"] }, { kind: "directive", type: i6.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "ngmodule", type: MatIconModule }, { kind: "component", type: i7.MatIcon, selector: "mat-icon", inputs: ["color", "inline", "svgIcon", "fontSet", "fontIcon"], exportAs: ["matIcon"] }, { kind: "ngmodule", type: MatButtonModule }, { kind: "component", type: i8.MatButton, selector: "    button[mat-button], button[mat-raised-button], button[mat-flat-button],    button[mat-stroked-button]  ", exportAs: ["matButton"] }, { kind: "component", type: i8.MatIconButton, selector: "button[mat-icon-button]", exportAs: ["matButton"] }, { kind: "ngmodule", type: MatProgressSpinnerModule }, { kind: "component", type: i9.MatProgressSpinner, selector: "mat-progress-spinner, mat-spinner", inputs: ["color", "mode", "value", "diameter", "strokeWidth"], exportAs: ["matProgressSpinner"] }, { kind: "ngmodule", type: MatTooltipModule }, { kind: "directive", type: i10.MatTooltip, selector: "[matTooltip]", inputs: ["matTooltipPosition", "matTooltipPositionAtOrigin", "matTooltipDisabled", "matTooltipShowDelay", "matTooltipHideDelay", "matTooltipTouchGestures", "matTooltip", "matTooltipClass"], exportAs: ["matTooltip"] }, { kind: "component", type: MessageInputComponent, selector: "app-message-input", inputs: ["conversationId", "replyTo", "enableMentions", "mentionOptions"], outputs: ["messageSent", "messageWithFiles", "replyCancelled"] }] });
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
      [style.--message-text-scale]="messageTextScale"
      [style.--code-text-scale]="codeTextScale"
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
                  <div *ngIf="isCodeContent(getMessageCaption(msg)); else nonCodeCaption" class="code-message-wrap attachment-render-block">
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
                <button
                  *ngIf="isGroup"
                  type="button"
                  class="reply-message-btn"
                  (click)="startReply(msg, $event)"
                  matTooltip="Reply"
                  matTooltipPosition="above"
                >
                  <mat-icon>reply</mat-icon>
                </button>
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
        [replyTo]="replyToMessage ? getComposeReplyPreview(replyToMessage) : null"
        [enableMentions]="isGroup"
        [mentionOptions]="mentionOptions"
        (messageSent)="onSendMessage($event)"
        (messageWithFiles)="onSendWithFiles($event)"
        (replyCancelled)="clearReply()"
      ></app-message-input>
    </div>

  `, styles: [":host{--attachment-thumb-size: 180px}.chat-thread{display:flex;flex-direction:column;height:100%;background:#041322;position:relative;container-type:inline-size;--attachment-thumb-size: clamp(120px, 48cqw, 180px)}.chat-thread.drag-over{outline:2px dashed rgba(255,255,255,.45);outline-offset:-6px}.thread-drag-overlay{position:absolute;inset:8px;z-index:20;pointer-events:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:#fff;background:#1f4bd852;border:2px dashed rgba(255,255,255,.55);border-radius:14px;font-size:14px;font-weight:600}.thread-drag-overlay mat-icon{font-size:36px;width:36px;height:36px}.chat-header{display:flex;align-items:center;padding:8px 8px 8px 4px;border-bottom:1px solid rgba(255,255,255,.15);gap:4px;flex-shrink:0}.chat-header button mat-icon{color:#fffc}.chat-name{font-size:16px;font-weight:600;color:#fff}.header-info{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;padding:0 4px}.header-actions{display:flex;align-items:center;gap:0}.header-actions button{width:32px;height:32px;min-width:32px!important;padding:0!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;--mdc-icon-button-state-layer-size: 32px}.hdr-btn{border-radius:6px!important;transition:background .15s,box-shadow .15s}.hdr-btn:hover{background:#ffffff26!important;box-shadow:0 2px 8px #0003}.hdr-btn mat-icon{font-size:20px;width:20px;height:20px;line-height:20px;margin:0;display:flex;align-items:center;justify-content:center}:host ::ng-deep .hdr-btn .mat-mdc-button-touch-target{width:32px!important;height:32px!important}.messages-area{flex:1;overflow-y:auto;padding:12px;background:transparent;scrollbar-width:none;-ms-overflow-style:none}.messages-area::-webkit-scrollbar{display:none}.loading-indicator{display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;color:#ffffffb3;font-size:13px}.removed-group-state{height:100%;min-height:260px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:10px;padding:32px 24px;color:#ffffffc7;box-sizing:border-box}.removed-group-state mat-icon{width:44px;height:44px;font-size:44px;color:#f87171;margin-bottom:4px}.removed-group-state h4{margin:0;color:#fff;font-size:17px;font-weight:700}.removed-group-state p{margin:0 0 8px;max-width:280px;font-size:13px;line-height:1.4;color:#ffffff9e}.removed-exit-btn{border-radius:10px;background:#ffffff2e!important;color:#fff!important;font-weight:700;padding:0 18px}.load-more-btn{align-self:center;margin-bottom:16px;font-size:12px;color:#fff}.messages-list{display:flex;flex-direction:column;gap:1px;flex:1}.date-separator{text-align:center;margin:16px 0 8px;font-size:12px;color:#ffffffb3;font-weight:500}.message-bubble-row{display:flex;flex-direction:column;max-width:88%;margin-bottom:2px}.message-bubble-row.own{align-self:flex-end;align-items:flex-end}.message-bubble-row.other{align-self:flex-start;align-items:flex-start}.sender-name{font-size:11px;font-weight:700;color:#fffffff2;margin-bottom:3px;letter-spacing:.2px;padding:0 10px;text-shadow:0 1px 3px rgba(0,0,0,.4)}.system-message-row{align-self:center;max-width:88%;margin:8px auto;text-align:center}.system-message-text{display:inline-flex;align-items:center;justify-content:center;padding:5px 11px;border-radius:999px;background:#ffffff17;border:1px solid rgba(255,255,255,.12);color:#ffffffb8;font-size:11px;line-height:1.35}.message-bubble{padding:8px 14px 7px;border-radius:14px;font-size:calc(clamp(11px,3.4cqw,13px) * var(--message-text-scale, 1));line-height:1.32;word-break:break-word;color:#f5f7ff;position:relative;display:inline-block;min-width:fit-content}.message-bubble-row.other .message-bubble{background:#0d2540;border-bottom-left-radius:5px;box-shadow:0 1px 4px #0006}.message-bubble.own-bubble{background:#0a3d62;border-bottom-right-radius:5px;box-shadow:0 1px 4px #0006}.reply-context{display:flex;align-items:center;gap:7px;margin-bottom:7px;padding:7px 9px;border-radius:10px;background:#ffffff14;border-left:3px solid rgba(127,180,255,.78);max-width:min(68cqw,420px)}.reply-context mat-icon{color:#bfdbfe;font-size:16px;width:16px;height:16px;flex-shrink:0}.reply-context div{min-width:0}.reply-context span{display:block;color:#bfdbfe;font-size:11px;font-weight:700;margin-bottom:2px}.reply-context p{margin:0;color:#ffffffc7;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.text-content{white-space:pre-wrap;tab-size:4}.text-content.preformatted-text{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,Liberation Mono,monospace;font-size:calc(clamp(10px,3.1cqw,12px) * var(--code-text-scale, 1));line-height:1.45;overflow-x:auto;max-width:min(72cqw,520px);scrollbar-width:none;-ms-overflow-style:none}.text-content.preformatted-text::-webkit-scrollbar{display:none}.attachment-caption{margin-top:8px;width:var(--attachment-thumb-size);max-width:var(--attachment-thumb-size);box-sizing:border-box}.attachment-caption .text-content{white-space:pre-wrap;overflow-wrap:anywhere;max-width:100%}.attachment-render-block{width:100%;max-width:100%}.code-message-wrap{position:relative;max-width:min(76cqw,560px);border-radius:10px;overflow:hidden;border:1px solid rgba(255,255,255,.14);background:#061827}.render-copy-btn{position:absolute;top:6px;right:6px;z-index:2;width:26px;height:26px;border:none;border-radius:7px;display:inline-flex;align-items:center;justify-content:center;padding:0;background:#071d30d1;color:#ffffffc7;cursor:pointer;opacity:0;transition:opacity .12s,background .12s,color .12s}.code-message-wrap:hover .render-copy-btn,.table-message-wrap:hover .render-copy-btn,.md-message-wrap:hover .render-copy-btn,.render-copy-btn:focus{opacity:1}.render-copy-btn:hover{background:#7fb4ff38;color:#fff}.render-copy-btn mat-icon{font-size:16px;width:16px;height:16px;line-height:16px}.code-message{margin:0;padding:12px 42px 28px 12px;overflow-x:auto;color:#dbeafe;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,Liberation Mono,monospace;font-size:calc(clamp(10px,3.1cqw,12px) * var(--code-text-scale, 1));line-height:1.45;white-space:pre;tab-size:2;scrollbar-width:none;-ms-overflow-style:none}.code-message::-webkit-scrollbar{display:none}.code-language{position:absolute;right:8px;bottom:6px;padding:2px 7px;border-radius:999px;background:#7fb4ff29;color:#bfdbfe;font-size:10px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;pointer-events:none}.md-language{position:absolute;right:8px;bottom:6px;padding:2px 7px;border-radius:999px;background:#86efac24;color:#bbf7d0;font-size:10px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;pointer-events:none}:host ::ng-deep .code-token-keyword{color:#93c5fd;font-weight:700}:host ::ng-deep .code-token-string{color:#86efac}:host ::ng-deep .code-token-number{color:#fbbf24}:host ::ng-deep .code-token-comment{color:#94a3b8;font-style:italic}:host ::ng-deep .code-token-function{color:#c4b5fd}.table-message-wrap{position:relative;max-width:min(76cqw,560px);overflow-x:auto;border-radius:9px;border:1px solid rgba(255,255,255,.16);background:#ffffff0a;scrollbar-width:none;-ms-overflow-style:none}.table-message-wrap::-webkit-scrollbar{display:none}.pasted-table{border-collapse:collapse;min-width:100%;font-size:calc(clamp(10px,3.1cqw,12px) * var(--code-text-scale, 1));line-height:1.35;color:#f5f7ff}.pasted-table th,.pasted-table td{padding:6px 9px;border-right:1px solid rgba(255,255,255,.12);border-bottom:1px solid rgba(255,255,255,.12);text-align:left;white-space:pre-wrap;vertical-align:top}.pasted-table th{background:#ffffff1a;font-weight:700}.pasted-table tr:last-child td,.pasted-table tr:last-child th{border-bottom:none}.pasted-table th:last-child,.pasted-table td:last-child{border-right:none}.md-message-wrap{position:relative;max-width:min(76cqw,560px);overflow-x:auto;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:#ffffff0d;scrollbar-width:none;-ms-overflow-style:none}.md-message-wrap::-webkit-scrollbar{display:none}.md-message{padding:10px 42px 28px 12px;color:#f5f7ff;font-size:calc(clamp(11px,3.4cqw,13px) * var(--message-text-scale, 1));line-height:1.45;overflow-wrap:anywhere}:host ::ng-deep .md-message h1,:host ::ng-deep .md-message h2,:host ::ng-deep .md-message h3{margin:8px 0 6px;color:#fff;line-height:1.25}:host ::ng-deep .md-message h1{font-size:18px}:host ::ng-deep .md-message h2{font-size:16px}:host ::ng-deep .md-message h3{font-size:14px}:host ::ng-deep .md-message p{margin:6px 0}:host ::ng-deep .md-message ul,:host ::ng-deep .md-message ol{margin:6px 0;padding-left:20px}:host ::ng-deep .md-message blockquote{margin:8px 0;padding-left:10px;border-left:3px solid rgba(127,180,255,.55);color:#ffffffc7}:host ::ng-deep .md-message code{padding:1px 5px;border-radius:5px;background:#00000040;color:#bfdbfe;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,Liberation Mono,monospace;font-size:12px}:host ::ng-deep .md-message pre{margin:8px 0;padding:9px;border-radius:8px;overflow-x:auto;background:#061827;scrollbar-width:none;-ms-overflow-style:none}:host ::ng-deep .md-message pre::-webkit-scrollbar{display:none}:host ::ng-deep .md-message pre code{padding:0;background:transparent;color:#dbeafe;white-space:pre}.image-message{line-height:0}.media-wrapper{position:relative;display:inline-block;line-height:0;width:var(--attachment-thumb-size);height:var(--attachment-thumb-size);overflow:hidden;border-radius:10px;background:#ffffff14}.media-img{width:100%;height:100%;border-radius:inherit;display:block;cursor:zoom-in;object-fit:cover}.attachment-actions{position:absolute;right:6px;top:6px;display:flex;gap:4px;opacity:0;transition:opacity .12s ease;pointer-events:none}.media-wrapper:hover .attachment-actions{opacity:1;pointer-events:auto}.attachment-action-btn,.file-download-btn{border:none;border-radius:999px;background:#071d30d1;color:#fff;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0}.attachment-action-btn{width:28px;height:28px}.attachment-action-btn mat-icon{font-size:17px;width:17px;height:17px}.media-video{max-width:240px;max-height:260px;border-radius:10px;display:block;background:#000}.video-message{display:flex;flex-direction:column;gap:6px}.video-download{color:#ffffffc7;font-size:12px;text-decoration:underline;text-underline-offset:2px}.media-placeholder{display:flex;align-items:center;justify-content:center;gap:8px;width:var(--attachment-thumb-size);height:var(--attachment-thumb-size);border-radius:10px;background:#ffffff14;color:#fff9;font-size:11px}.media-load-label{font-size:11px;color:#fff9}.attachments-list{display:flex;flex-direction:column;gap:8px;max-width:100%}.attachment-item{max-width:100%}.file-message{display:flex;align-items:center;gap:8px;padding:4px 0}.attachment-thumb.file-message{position:relative;width:var(--attachment-thumb-size);height:var(--attachment-thumb-size);padding:12px;border-radius:10px;background:#ffffff14;flex-direction:column;justify-content:center;box-sizing:border-box;overflow:hidden}.file-download{display:inline-flex;align-items:center;gap:8px;color:#fff;text-decoration:none;max-width:240px}.file-msg-icon{font-size:42px;width:42px;height:42px;color:#fffc;flex-shrink:0}.file-msg-name{font-size:13px;color:#fff;line-height:1.2;max-width:100%;overflow:hidden;text-align:center;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;word-break:break-word}.file-download-icon{font-size:18px;width:18px;height:18px;color:#ffffffb3;flex-shrink:0}.file-download-btn{width:24px;height:24px;flex-shrink:0;position:absolute;right:6px;top:6px}.file-download-link{border:none;border-radius:999px;background:#ffffff29;color:#fff;cursor:pointer;font-size:11px;padding:4px 10px;margin-top:4px}.message-meta{display:flex;align-items:center;gap:4px;margin-top:3px}.msg-time{font-size:10px;color:#dae0faa8}.message-bubble-row.other .msg-time{color:#d8dff694}.read-icon{font-size:14px;width:14px;height:14px;opacity:.7}.read-icon.read{color:#60a5fa;opacity:1}.read-icon.unread{color:#dae0fa80;opacity:1}.reply-message-btn{position:absolute;right:-10px;bottom:-10px;width:24px;height:24px;border:1px solid rgba(255,255,255,.16);border-radius:999px;background:#071d30;color:#ffffffc7;display:inline-flex;align-items:center;justify-content:center;padding:0;cursor:pointer;opacity:0;transform:scale(.92);transition:opacity .12s,transform .12s,background .12s,color .12s;z-index:3}.message-bubble:hover .reply-message-btn,.reply-message-btn:focus{opacity:1;transform:scale(1)}.reply-message-btn:hover{background:#7fb4ff38;color:#fff}.reply-message-btn mat-icon{font-size:15px;width:15px;height:15px;line-height:15px}.quick-reactions{position:absolute;top:-18px;right:0;display:flex;align-items:center;gap:4px;padding:3px 5px;background:#071d30;border:1px solid rgba(255,255,255,.14);border-radius:999px;box-shadow:0 6px 14px #00000047;z-index:4}.message-bubble-row.other .quick-reactions{left:0;right:auto}.message-bubble-row.own .quick-reactions{left:auto;right:0}.quick-emoji-btn{width:20px;height:20px;border:none;border-radius:999px;background:transparent;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:13px;line-height:1;cursor:pointer;padding:0;transition:transform .12s ease,background .12s ease}.quick-emoji-btn:hover{background:#ffffff2e;transform:scale(1.14)}.reactions-row{display:flex;flex-wrap:wrap;gap:3px;margin-top:5px}.reaction-chip{background:#ffffff14;border:1px solid rgba(255,255,255,.2);border-radius:999px;padding:2px 7px;font-size:11px;color:#f2f6ff;cursor:pointer;transition:all .2s;display:inline-flex;align-items:center;gap:3px;max-width:180px}.reaction-chip:hover{background:#ffffff40;transform:scale(1.05)}.reaction-chip.own-reaction{background:#2a5bff4d;border-color:#2a5bff80}.empty-chat{display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;color:#9ca3af}.empty-chat mat-icon{font-size:48px;width:48px;height:48px;margin-bottom:8px}.empty-chat p{font-size:14px;margin:0}\n"] }]
        }], ctorParameters: () => [{ type: i1.MessagingStoreService }, { type: i2.MessagingApiService }, { type: i3.AuthService }, { type: i4.MessagingFileService }, { type: i0.ChangeDetectorRef }, { type: i5.DomSanitizer }], propDecorators: { scrollContainer: [{
                type: ViewChild,
                args: ['scrollContainer']
            }], messageInput: [{
                type: ViewChild,
                args: [MessageInputComponent]
            }], lightboxOpen: [{
                type: Output
            }] } });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdC10aHJlYWQuY29tcG9uZW50LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL2xpYi9jb21wb25lbnRzL2NoYXQtdGhyZWFkL2NoYXQtdGhyZWFkLmNvbXBvbmVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQ0wsU0FBUyxFQUFxQixTQUFTLEVBQ3ZDLE1BQU0sRUFBRSxZQUFZLEdBQ3JCLE1BQU0sZUFBZSxDQUFDO0FBRXZCLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUMvQyxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sd0JBQXdCLENBQUM7QUFDdkQsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBQzNELE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQzlFLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBQzdELE9BQU8sRUFBZ0IsYUFBYSxFQUFFLE1BQU0sTUFBTSxDQUFDO0FBS25ELE9BQU8sRUFBeUQscUJBQXFCLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUNuSixPQUFPLEVBQWlCLHFCQUFxQixFQUFnQyxNQUFNLDBDQUEwQyxDQUFDOzs7Ozs7Ozs7Ozs7QUF1dkM5SCxNQUFNLE9BQU8sbUJBQW1CO0lBc0NwQjtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUExQ29CLGVBQWUsQ0FBYztJQUN6QixZQUFZLENBQXlCO0lBQzdELFlBQVksR0FBRyxJQUFJLFlBQVksRUFBVSxDQUFDO0lBRXBELFFBQVEsR0FBYyxFQUFFLENBQUM7SUFDekIsZUFBZSxHQUFjLEVBQUUsQ0FBQztJQUNoQyxnQkFBZ0IsR0FBRyxFQUFFLENBQUM7SUFDdEIsT0FBTyxHQUFHLEtBQUssQ0FBQztJQUNoQixrQkFBa0IsR0FBRyxLQUFLLENBQUM7SUFDM0IsZ0JBQWdCLEdBQUcs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Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7R0FtVFQ7b1BBNDdCNkIsZUFBZTtzQkFBNUMsU0FBUzt1QkFBQyxpQkFBaUI7Z0JBQ00sWUFBWTtzQkFBN0MsU0FBUzt1QkFBQyxxQkFBcUI7Z0JBQ3RCLFlBQVk7c0JBQXJCLE1BQU0iLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge1xyXG4gIENvbXBvbmVudCwgT25Jbml0LCBPbkRlc3Ryb3ksIFZpZXdDaGlsZCwgRWxlbWVudFJlZiwgQWZ0ZXJWaWV3Q2hlY2tlZCwgQ2hhbmdlRGV0ZWN0b3JSZWYsXHJcbiAgT3V0cHV0LCBFdmVudEVtaXR0ZXIsXHJcbn0gZnJvbSAnQGFuZ3VsYXIvY29yZSc7XHJcbmltcG9ydCB7IERvbVNhbml0aXplciwgU2FmZUh0bWwgfSBmcm9tICdAYW5ndWxhci9wbGF0Zm9ybS1icm93c2VyJztcclxuaW1wb3J0IHsgQ29tbW9uTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvY29tbW9uJztcclxuaW1wb3J0IHsgTWF0SWNvbk1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL21hdGVyaWFsL2ljb24nO1xyXG5pbXBvcnQgeyBNYXRCdXR0b25Nb2R1bGUgfSBmcm9tICdAYW5ndWxhci9tYXRlcmlhbC9idXR0b24nO1xyXG5pbXBvcnQgeyBNYXRQcm9ncmVzc1NwaW5uZXJNb2R1bGUgfSBmcm9tICdAYW5ndWxhci9tYXRlcmlhbC9wcm9ncmVzcy1zcGlubmVyJztcclxuaW1wb3J0IHsgTWF0VG9vbHRpcE1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL21hdGVyaWFsL3Rvb2x0aXAnO1xyXG5pbXBvcnQgeyBTdWJzY3JpcHRpb24sIGNvbWJpbmVMYXRlc3QgfSBmcm9tICdyeGpzJztcclxuaW1wb3J0IHsgTWVzc2FnaW5nU3RvcmVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvbWVzc2FnaW5nLXN0b3JlLnNlcnZpY2UnO1xyXG5pbXBvcnQgeyBNZXNzYWdpbmdBcGlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvbWVzc2FnaW5nLWFwaS5zZXJ2aWNlJztcclxuaW1wb3J0IHsgTWVzc2FnaW5nRmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9tZXNzYWdpbmctZmlsZS5zZXJ2aWNlJztcclxuaW1wb3J0IHsgQXV0aFNlcnZpY2UgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9hdXRoLnNlcnZpY2UnO1xyXG5pbXBvcnQgeyBDb250YWN0LCBDb252ZXJzYXRpb25QYXJ0aWNpcGFudCwgTWVzc2FnZSwgQXR0YWNobWVudCwgZ2V0Q29udGFjdERpc3BsYXlOYW1lLCBnZXRNZXNzYWdlU2VuZGVyTmFtZSB9IGZyb20gJy4uLy4uL21vZGVscy9tZXNzYWdpbmcubW9kZWxzJztcclxuaW1wb3J0IHsgTWVudGlvbk9wdGlvbiwgTWVzc2FnZUlucHV0Q29tcG9uZW50LCBNZXNzYWdlUGF5bG9hZCwgUmVwbHlQcmV2aWV3IH0gZnJvbSAnLi4vbWVzc2FnZS1pbnB1dC9tZXNzYWdlLWlucHV0LmNvbXBvbmVudCc7XHJcblxyXG5AQ29tcG9uZW50KHtcclxuICBzZWxlY3RvcjogJ2FwcC1jaGF0LXRocmVhZCcsXHJcbiAgc3RhbmRhbG9uZTogdHJ1ZSxcclxuICBpbXBvcnRzOiBbXHJcbiAgICBDb21tb25Nb2R1bGUsIE1hdEljb25Nb2R1bGUsIE1hdEJ1dHRvbk1vZHVsZSxcclxuICAgIE1hdFByb2dyZXNzU3Bpbm5lck1vZHVsZSwgTWF0VG9vbHRpcE1vZHVsZSwgTWVzc2FnZUlucHV0Q29tcG9uZW50LFxyXG4gIF0sXHJcbiAgdGVtcGxhdGU6IGBcclxuICAgIDxkaXZcclxuICAgICAgY2xhc3M9XCJjaGF0LXRocmVhZFwiXHJcbiAgICAgIFtjbGFzcy5kcmFnLW92ZXJdPVwidGhyZWFkRHJhZ092ZXJcIlxyXG4gICAgICBbc3R5bGUuLS1tZXNzYWdlLXRleHQtc2NhbGVdPVwibWVzc2FnZVRleHRTY2FsZVwiXHJcbiAgICAgIFtzdHlsZS4tLWNvZGUtdGV4dC1zY2FsZV09XCJjb2RlVGV4dFNjYWxlXCJcclxuICAgICAgKGRyYWdlbnRlcik9XCJvblRocmVhZERyYWdFbnRlcigkZXZlbnQpXCJcclxuICAgICAgKGRyYWdvdmVyKT1cIm9uVGhyZWFkRHJhZ092ZXIoJGV2ZW50KVwiXHJcbiAgICAgIChkcmFnbGVhdmUpPVwib25UaHJlYWREcmFnTGVhdmUoJGV2ZW50KVwiXHJcbiAgICAgIChkcm9wKT1cIm9uVGhyZWFkRHJvcCgkZXZlbnQpXCJcclxuICAgID5cclxuICAgICAgPGRpdiBjbGFzcz1cImNoYXQtaGVhZGVyXCI+XHJcbiAgICAgICAgPGJ1dHRvbiBtYXQtaWNvbi1idXR0b24gY2xhc3M9XCJoZHItYnRuXCIgKGNsaWNrKT1cImdvQmFjaygpXCIgbWF0VG9vbHRpcD1cIkJhY2tcIiBtYXRUb29sdGlwUG9zaXRpb249XCJiZWxvd1wiPlxyXG4gICAgICAgICAgPG1hdC1pY29uPmFycm93X2JhY2s8L21hdC1pY29uPlxyXG4gICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgIDxkaXYgY2xhc3M9XCJoZWFkZXItaW5mb1wiPlxyXG4gICAgICAgICAgPHNwYW4gY2xhc3M9XCJjaGF0LW5hbWVcIj57eyBjb252ZXJzYXRpb25OYW1lIH19PC9zcGFuPlxyXG4gICAgICAgIDwvZGl2PlxyXG4gICAgICAgIDxkaXYgY2xhc3M9XCJoZWFkZXItYWN0aW9uc1wiPlxyXG4gICAgICAgICAgPGJ1dHRvbiAqbmdJZj1cImlzR3JvdXAgJiYgIWlzUmVtb3ZlZEZyb21Hcm91cFwiIG1hdC1pY29uLWJ1dHRvbiBjbGFzcz1cImhkci1idG5cIiAoY2xpY2spPVwib25Hcm91cFNldHRpbmdzKClcIiBtYXRUb29sdGlwPVwiR3JvdXAgc2V0dGluZ3NcIiBtYXRUb29sdGlwUG9zaXRpb249XCJiZWxvd1wiPlxyXG4gICAgICAgICAgICA8bWF0LWljb24+c2V0dGluZ3M8L21hdC1pY29uPlxyXG4gICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgPC9kaXY+XHJcbiAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgPGRpdiBjbGFzcz1cIm1lc3NhZ2VzLWFyZWFcIiAjc2Nyb2xsQ29udGFpbmVyIChzY3JvbGwpPVwib25TY3JvbGwoKVwiPlxyXG4gICAgICAgIDxkaXYgKm5nSWY9XCJ0aHJlYWREcmFnT3ZlclwiIGNsYXNzPVwidGhyZWFkLWRyYWctb3ZlcmxheVwiPlxyXG4gICAgICAgICAgPG1hdC1pY29uPmNsb3VkX3VwbG9hZDwvbWF0LWljb24+XHJcbiAgICAgICAgICA8c3Bhbj5Ecm9wIGZpbGVzIGFueXdoZXJlIGluIHRoaXMgY2hhdDwvc3Bhbj5cclxuICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgPGRpdiAqbmdJZj1cImlzUmVtb3ZlZEZyb21Hcm91cFwiIGNsYXNzPVwicmVtb3ZlZC1ncm91cC1zdGF0ZVwiPlxyXG4gICAgICAgICAgPG1hdC1pY29uPmJsb2NrPC9tYXQtaWNvbj5cclxuICAgICAgICAgIDxoND5Zb3Ugd2VyZSByZW1vdmVkIGZyb20gdGhpcyBncm91cDwvaDQ+XHJcbiAgICAgICAgICA8cD5NZXNzYWdlcywgYXR0YWNobWVudHMsIGFuZCBncm91cCBzZXR0aW5ncyBhcmUgbm8gbG9uZ2VyIGF2YWlsYWJsZS48L3A+XHJcbiAgICAgICAgICA8YnV0dG9uIHR5cGU9XCJidXR0b25cIiBtYXQtcmFpc2VkLWJ1dHRvbiBjbGFzcz1cInJlbW92ZWQtZXhpdC1idG5cIiAoY2xpY2spPVwiZXhpdFJlbW92ZWRHcm91cCgpXCI+XHJcbiAgICAgICAgICAgIEV4aXQgR3JvdXBcclxuICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICA8ZGl2ICpuZ0lmPVwiIWlzUmVtb3ZlZEZyb21Hcm91cCAmJiBsb2FkaW5nXCIgY2xhc3M9XCJsb2FkaW5nLWluZGljYXRvclwiPlxyXG4gICAgICAgICAgPG1hdC1zcGlubmVyIGRpYW1ldGVyPVwiMjRcIj48L21hdC1zcGlubmVyPlxyXG4gICAgICAgICAgPHNwYW4+TG9hZGluZyBtZXNzYWdlcy4uLjwvc3Bhbj5cclxuICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgKm5nSWY9XCIhaXNSZW1vdmVkRnJvbUdyb3VwICYmIG1lc3NhZ2VzLmxlbmd0aCA+PSA1MCAmJiAhbG9hZGluZ1wiXHJcbiAgICAgICAgICBtYXQtc3Ryb2tlZC1idXR0b25cclxuICAgICAgICAgIGNsYXNzPVwibG9hZC1tb3JlLWJ0blwiXHJcbiAgICAgICAgICAoY2xpY2spPVwibG9hZE9sZGVyKClcIlxyXG4gICAgICAgID5cclxuICAgICAgICAgIExvYWQgb2xkZXIgbWVzc2FnZXNcclxuICAgICAgICA8L2J1dHRvbj5cclxuXHJcbiAgICAgICAgPGRpdiAqbmdJZj1cIiFpc1JlbW92ZWRGcm9tR3JvdXBcIiBjbGFzcz1cIm1lc3NhZ2VzLWxpc3RcIj5cclxuICAgICAgICAgIDxuZy1jb250YWluZXIgKm5nRm9yPVwibGV0IG1zZyBvZiBtZXNzYWdlczsgbGV0IGkgPSBpbmRleFwiPlxyXG4gICAgICAgICAgICA8ZGl2XHJcbiAgICAgICAgICAgICAgKm5nSWY9XCJzaG91bGRTaG93RGF0ZVNlcGFyYXRvcihpKVwiXHJcbiAgICAgICAgICAgICAgY2xhc3M9XCJkYXRlLXNlcGFyYXRvclwiXHJcbiAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICA8c3Bhbj57eyBmb3JtYXREYXRlKG1zZy5jcmVhdGVkX2F0KSB9fTwvc3Bhbj5cclxuICAgICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgICA8ZGl2XHJcbiAgICAgICAgICAgICAgKm5nSWY9XCJpc1N5c3RlbU1lc3NhZ2UobXNnKTsgZWxzZSBjaGF0TWVzc2FnZVwiXHJcbiAgICAgICAgICAgICAgY2xhc3M9XCJzeXN0ZW0tbWVzc2FnZS1yb3dcIlxyXG4gICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJzeXN0ZW0tbWVzc2FnZS10ZXh0XCI+e3sgbXNnLmNvbnRlbnQgfX08L3NwYW4+XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgICAgPG5nLXRlbXBsYXRlICNjaGF0TWVzc2FnZT5cclxuICAgICAgICAgICAgICA8ZGl2XHJcbiAgICAgICAgICAgICAgICBjbGFzcz1cIm1lc3NhZ2UtYnViYmxlLXJvd1wiXHJcbiAgICAgICAgICAgICAgW2NsYXNzLm93bl09XCJpc093bk1lc3NhZ2UobXNnKVwiXHJcbiAgICAgICAgICAgICAgW2NsYXNzLm90aGVyXT1cIiFpc093bk1lc3NhZ2UobXNnKVwiXHJcbiAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICA8ZGl2ICpuZ0lmPVwiIWlzT3duTWVzc2FnZShtc2cpXCIgY2xhc3M9XCJzZW5kZXItbmFtZVwiPlxyXG4gICAgICAgICAgICAgICAge3sgZ2V0U2VuZGVyTmFtZShtc2cpIH19XHJcbiAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cIm1lc3NhZ2UtYnViYmxlXCIgW2NsYXNzLm93bi1idWJibGVdPVwiaXNPd25NZXNzYWdlKG1zZylcIiAobW91c2VlbnRlcik9XCJob3ZlcmVkTWVzc2FnZUlkID0gbXNnLm1lc3NhZ2VfaWRcIiAobW91c2VsZWF2ZSk9XCJob3ZlcmVkTWVzc2FnZUlkID0gbnVsbFwiPlxyXG4gICAgICAgICAgICAgICAgPGRpdiAqbmdJZj1cImdldFJlcGx5UHJldmlldyhtc2cpIGFzIHJlcGx5XCIgY2xhc3M9XCJyZXBseS1jb250ZXh0XCI+XHJcbiAgICAgICAgICAgICAgICAgIDxtYXQtaWNvbj5yZXBseTwvbWF0LWljb24+XHJcbiAgICAgICAgICAgICAgICAgIDxkaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgPHNwYW4+e3sgcmVwbHkuc2VuZGVyTmFtZSB9fTwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICA8cD57eyByZXBseS5jb250ZW50IH19PC9wPlxyXG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgPCEtLSBBVFRBQ0hNRU5UUyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIAgLS0+XHJcbiAgICAgICAgICAgICAgICA8ZGl2ICpuZ0lmPVwiaGFzRmlsZUF0dGFjaG1lbnQobXNnKVwiIGNsYXNzPVwiYXR0YWNobWVudHMtbGlzdFwiPlxyXG4gICAgICAgICAgICAgICAgICA8ZGl2ICpuZ0Zvcj1cImxldCBhdHRhY2htZW50IG9mIGdldFJlbmRlcmFibGVBdHRhY2htZW50cyhtc2cpOyB0cmFja0J5OiB0cmFja0J5QXR0YWNobWVudFwiIGNsYXNzPVwiYXR0YWNobWVudC1pdGVtXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgPG5nLWNvbnRhaW5lciAqbmdJZj1cImlzSW1hZ2VBdHRhY2htZW50KG1zZywgYXR0YWNobWVudCk7IGVsc2Ugbm9uSW1hZ2VBdHRhY2htZW50XCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiaW1hZ2UtbWVzc2FnZVwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8bmctY29udGFpbmVyICpuZ0lmPVwiZ2V0TWVkaWFVcmwobXNnLCBhdHRhY2htZW50KSBhcyBkYXRhVXJsOyBlbHNlIGltZ0ZhbGxiYWNrXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cIm1lZGlhLXdyYXBwZXJcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxpbWdcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgW3NyY109XCJkYXRhVXJsXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYWx0PVwiSW1hZ2VcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbGFzcz1cIm1lZGlhLWltZ1wiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIChtb3VzZWRvd24pPVwiJGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKGNsaWNrKT1cIm9wZW5MaWdodGJveChkYXRhVXJsLCAkZXZlbnQpXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiYXR0YWNobWVudC1hY3Rpb25zXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxidXR0b25cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbGFzcz1cImF0dGFjaG1lbnQtYWN0aW9uLWJ0blwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKGNsaWNrKT1cIm9wZW5MaWdodGJveChkYXRhVXJsLCAkZXZlbnQpXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aXRsZT1cIk9wZW4gaW1hZ2VcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPG1hdC1pY29uPm9wZW5faW5fZnVsbDwvbWF0LWljb24+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8YnV0dG9uXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZT1cImJ1dHRvblwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3M9XCJhdHRhY2htZW50LWFjdGlvbi1idG5cIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIChjbGljayk9XCJkb3dubG9hZEF0dGFjaG1lbnQobXNnLCBhdHRhY2htZW50LCAkZXZlbnQpXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aXRsZT1cIkRvd25sb2FkIGltYWdlXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxtYXQtaWNvbj5kb3dubG9hZDwvbWF0LWljb24+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDwvbmctY29udGFpbmVyPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8bmctdGVtcGxhdGUgI2ltZ0ZhbGxiYWNrPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgKm5nSWY9XCJzaG91bGRTaG93TWVkaWFTcGlubmVyKGF0dGFjaG1lbnQpOyBlbHNlIGltZ0FzRmlsZVwiIGNsYXNzPVwibWVkaWEtcGxhY2Vob2xkZXJcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxtYXQtc3Bpbm5lciBkaWFtZXRlcj1cIjIyXCI+PC9tYXQtc3Bpbm5lcj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8bmctdGVtcGxhdGUgI2ltZ0FzRmlsZT5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmaWxlLW1lc3NhZ2VcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPG1hdC1pY29uIGNsYXNzPVwiZmlsZS1tc2ctaWNvblwiPmltYWdlPC9tYXQtaWNvbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJmaWxlLW1zZy1uYW1lXCI+e3sgZ2V0QXR0YWNobWVudE5hbWUobXNnLCBhdHRhY2htZW50KSB9fTwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDwvbmctdGVtcGxhdGU+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDwvbmctdGVtcGxhdGU+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICA8L25nLWNvbnRhaW5lcj5cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgPG5nLXRlbXBsYXRlICNub25JbWFnZUF0dGFjaG1lbnQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmlsZS1tZXNzYWdlIGF0dGFjaG1lbnQtdGh1bWJcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzPVwiZmlsZS1kb3dubG9hZC1idG5cIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIChjbGljayk9XCJkb3dubG9hZEF0dGFjaG1lbnQobXNnLCBhdHRhY2htZW50LCAkZXZlbnQpXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICB0aXRsZT1cIkRvd25sb2FkIGZpbGVcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPG1hdC1pY29uIGNsYXNzPVwiZmlsZS1kb3dubG9hZC1pY29uXCI+ZG93bmxvYWQ8L21hdC1pY29uPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPG1hdC1pY29uIGNsYXNzPVwiZmlsZS1tc2ctaWNvblwiPnt7IGdldEZpbGVJY29uKG1zZywgYXR0YWNobWVudCkgfX08L21hdC1pY29uPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cImZpbGUtbXNnLW5hbWVcIiBbdGl0bGVdPVwiZ2V0QXR0YWNobWVudE5hbWUobXNnLCBhdHRhY2htZW50KVwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHt7IGdldEF0dGFjaG1lbnROYW1lKG1zZywgYXR0YWNobWVudCkgfX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgPC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8YnV0dG9uXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZT1cImJ1dHRvblwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3M9XCJmaWxlLWRvd25sb2FkLWxpbmtcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIChjbGljayk9XCJkb3dubG9hZEF0dGFjaG1lbnQobXNnLCBhdHRhY2htZW50LCAkZXZlbnQpXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICB0aXRsZT1cIkRvd25sb2FkIGZpbGVcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgRG93bmxvYWRcclxuICAgICAgICAgICAgICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICA8L25nLXRlbXBsYXRlPlxyXG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgPGRpdlxyXG4gICAgICAgICAgICAgICAgICAqbmdJZj1cImhhc0ZpbGVBdHRhY2htZW50KG1zZykgJiYgZ2V0TWVzc2FnZUNhcHRpb24obXNnKVwiXHJcbiAgICAgICAgICAgICAgICAgIGNsYXNzPVwiYXR0YWNobWVudC1jYXB0aW9uXCJcclxuICAgICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgICAgPGRpdiAqbmdJZj1cImlzQ29kZUNvbnRlbnQoZ2V0TWVzc2FnZUNhcHRpb24obXNnKSk7IGVsc2Ugbm9uQ29kZUNhcHRpb25cIiBjbGFzcz1cImNvZGUtbWVzc2FnZS13cmFwIGF0dGFjaG1lbnQtcmVuZGVyLWJsb2NrXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgPGJ1dHRvbiB0eXBlPVwiYnV0dG9uXCIgY2xhc3M9XCJyZW5kZXItY29weS1idG5cIiAoY2xpY2spPVwiY29weVRleHRWYWx1ZShnZXRNZXNzYWdlQ2FwdGlvbihtc2cpLCAkZXZlbnQpXCIgdGl0bGU9XCJDb3B5IGNvZGVcIj5cclxuICAgICAgICAgICAgICAgICAgICAgIDxtYXQtaWNvbj5jb250ZW50X2NvcHk8L21hdC1pY29uPlxyXG4gICAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgICAgICAgICAgIDxwcmUgY2xhc3M9XCJjb2RlLW1lc3NhZ2VcIj48Y29kZSBbaW5uZXJIVE1MXT1cImdldEhpZ2hsaWdodGVkQ29kZUNvbnRlbnQoZ2V0TWVzc2FnZUNhcHRpb24obXNnKSlcIj48L2NvZGU+PC9wcmU+XHJcbiAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJjb2RlLWxhbmd1YWdlXCI+e3sgZ2V0Q29kZUxhbmd1YWdlQ29udGVudChnZXRNZXNzYWdlQ2FwdGlvbihtc2cpKSB9fTwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgIDxuZy10ZW1wbGF0ZSAjbm9uQ29kZUNhcHRpb24+XHJcbiAgICAgICAgICAgICAgICAgICAgPGRpdiAqbmdJZj1cImlzTWFya2Rvd25Db250ZW50KGdldE1lc3NhZ2VDYXB0aW9uKG1zZykpOyBlbHNlIHBsYWluQ2FwdGlvblwiIGNsYXNzPVwibWQtbWVzc2FnZS13cmFwIGF0dGFjaG1lbnQtcmVuZGVyLWJsb2NrXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8YnV0dG9uIHR5cGU9XCJidXR0b25cIiBjbGFzcz1cInJlbmRlci1jb3B5LWJ0blwiIChjbGljayk9XCJjb3B5VGV4dFZhbHVlKGdldE1lc3NhZ2VDYXB0aW9uKG1zZyksICRldmVudClcIiB0aXRsZT1cIkNvcHkgbWFya2Rvd25cIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPG1hdC1pY29uPmNvbnRlbnRfY29weTwvbWF0LWljb24+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJtZC1tZXNzYWdlXCIgW2lubmVySFRNTF09XCJnZXRNYXJrZG93bkh0bWxDb250ZW50KGdldE1lc3NhZ2VDYXB0aW9uKG1zZykpXCI+PC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cIm1kLWxhbmd1YWdlXCI+bWQ8L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgPG5nLXRlbXBsYXRlICNwbGFpbkNhcHRpb24+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzPVwidGV4dC1jb250ZW50XCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgW2NsYXNzLnByZWZvcm1hdHRlZC10ZXh0XT1cImlzUHJlZm9ybWF0dGVkQ29udGVudChnZXRNZXNzYWdlQ2FwdGlvbihtc2cpKVwiXHJcbiAgICAgICAgICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHt7IGdldE1lc3NhZ2VDYXB0aW9uKG1zZykgfX1cclxuICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgIDwvbmctdGVtcGxhdGU+XHJcbiAgICAgICAgICAgICAgICAgIDwvbmctdGVtcGxhdGU+XHJcbiAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgIDxuZy1jb250YWluZXIgKm5nSWY9XCJtc2cubWVzc2FnZV90eXBlID09PSAnVEVYVCcgJiYgIWhhc0ZpbGVBdHRhY2htZW50KG1zZylcIj5cclxuICAgICAgICAgICAgICAgICAgPGRpdiAqbmdJZj1cImlzQ29kZVRleHQobXNnKTsgZWxzZSBub25Db2RlVGV4dE1lc3NhZ2VcIiBjbGFzcz1cImNvZGUtbWVzc2FnZS13cmFwXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgPGJ1dHRvbiB0eXBlPVwiYnV0dG9uXCIgY2xhc3M9XCJyZW5kZXItY29weS1idG5cIiAoY2xpY2spPVwiY29weUNvZGUobXNnLCAkZXZlbnQpXCIgdGl0bGU9XCJDb3B5IGNvZGVcIj5cclxuICAgICAgICAgICAgICAgICAgICAgIDxtYXQtaWNvbj5jb250ZW50X2NvcHk8L21hdC1pY29uPlxyXG4gICAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgICAgICAgICAgIDxwcmUgY2xhc3M9XCJjb2RlLW1lc3NhZ2VcIj48Y29kZSBbaW5uZXJIVE1MXT1cImdldEhpZ2hsaWdodGVkQ29kZShtc2cpXCI+PC9jb2RlPjwvcHJlPlxyXG4gICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwiY29kZS1sYW5ndWFnZVwiPnt7IGdldENvZGVMYW5ndWFnZShtc2cpIH19PC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgPG5nLXRlbXBsYXRlICNub25Db2RlVGV4dE1lc3NhZ2U+XHJcbiAgICAgICAgICAgICAgICAgIDxkaXYgKm5nSWY9XCJpc1RhYmxlVGV4dChtc2cpOyBlbHNlIHBsYWluVGV4dE1lc3NhZ2VcIiBjbGFzcz1cInRhYmxlLW1lc3NhZ2Utd3JhcFwiPlxyXG4gICAgICAgICAgICAgICAgICAgIDxidXR0b24gdHlwZT1cImJ1dHRvblwiIGNsYXNzPVwicmVuZGVyLWNvcHktYnRuXCIgKGNsaWNrKT1cImNvcHlNZXNzYWdlVGV4dChtc2csICRldmVudClcIiB0aXRsZT1cIkNvcHkgdGFibGVcIj5cclxuICAgICAgICAgICAgICAgICAgICAgIDxtYXQtaWNvbj5jb250ZW50X2NvcHk8L21hdC1pY29uPlxyXG4gICAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgICAgICAgICAgIDx0YWJsZSBjbGFzcz1cInBhc3RlZC10YWJsZVwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPHRib2R5PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dHIgKm5nRm9yPVwibGV0IHJvdyBvZiBnZXRUYWJsZVJvd3MobXNnKTsgbGV0IHJvd0luZGV4ID0gaW5kZXhcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8bmctY29udGFpbmVyICpuZ0Zvcj1cImxldCBjZWxsIG9mIHJvd1wiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRoICpuZ0lmPVwicm93SW5kZXggPT09IDA7IGVsc2UgdGFibGVDZWxsXCI+e3sgY2VsbCB9fTwvdGg+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8bmctdGVtcGxhdGUgI3RhYmxlQ2VsbD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRkPnt7IGNlbGwgfX08L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9uZy10ZW1wbGF0ZT5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8L25nLWNvbnRhaW5lcj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPC90cj5cclxuICAgICAgICAgICAgICAgICAgICAgIDwvdGJvZHk+XHJcbiAgICAgICAgICAgICAgICAgICAgPC90YWJsZT5cclxuICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgIDxuZy10ZW1wbGF0ZSAjcGxhaW5UZXh0TWVzc2FnZT5cclxuICAgICAgICAgICAgICAgICAgICA8ZGl2ICpuZ0lmPVwiaXNNYXJrZG93blRleHQobXNnKTsgZWxzZSByYXdUZXh0TWVzc2FnZVwiIGNsYXNzPVwibWQtbWVzc2FnZS13cmFwXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8YnV0dG9uIHR5cGU9XCJidXR0b25cIiBjbGFzcz1cInJlbmRlci1jb3B5LWJ0blwiIChjbGljayk9XCJjb3B5TWVzc2FnZVRleHQobXNnLCAkZXZlbnQpXCIgdGl0bGU9XCJDb3B5IG1hcmtkb3duXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxtYXQtaWNvbj5jb250ZW50X2NvcHk8L21hdC1pY29uPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwibWQtbWVzc2FnZVwiIFtpbm5lckhUTUxdPVwiZ2V0TWFya2Rvd25IdG1sKG1zZylcIj48L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwibWQtbGFuZ3VhZ2VcIj5tZDwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICA8bmctdGVtcGxhdGUgI3Jhd1RleHRNZXNzYWdlPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPGRpdlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjbGFzcz1cInRleHQtY29udGVudFwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIFtjbGFzcy5wcmVmb3JtYXR0ZWQtdGV4dF09XCJpc1ByZWZvcm1hdHRlZFRleHQobXNnKVwiXHJcbiAgICAgICAgICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHt7IGdldE1lc3NhZ2VCb2R5KG1zZykgfX1cclxuICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgIDwvbmctdGVtcGxhdGU+XHJcbiAgICAgICAgICAgICAgICAgIDwvbmctdGVtcGxhdGU+XHJcbiAgICAgICAgICAgICAgICAgIDwvbmctdGVtcGxhdGU+XHJcbiAgICAgICAgICAgICAgICA8L25nLWNvbnRhaW5lcj5cclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJtZXNzYWdlLW1ldGFcIj5cclxuICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJtc2ctdGltZVwiPnt7IGZvcm1hdFRpbWUobXNnLmNyZWF0ZWRfYXQpIH19PC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICA8bWF0LWljb25cclxuICAgICAgICAgICAgICAgICAgICAqbmdJZj1cImlzT3duTWVzc2FnZShtc2cpICYmIGlzTWVzc2FnZVJlYWQobXNnKVwiXHJcbiAgICAgICAgICAgICAgICAgICAgY2xhc3M9XCJyZWFkLWljb24gcmVhZFwiXHJcbiAgICAgICAgICAgICAgICAgICAgW21hdFRvb2x0aXBdPVwiZ2V0UmVhZFRvb2x0aXAobXNnKVwiXHJcbiAgICAgICAgICAgICAgICAgICAgbWF0VG9vbHRpcFBvc2l0aW9uPVwiYWJvdmVcIlxyXG4gICAgICAgICAgICAgICAgICA+ZG9uZV9hbGw8L21hdC1pY29uPlxyXG4gICAgICAgICAgICAgICAgICA8bWF0LWljb25cclxuICAgICAgICAgICAgICAgICAgICAqbmdJZj1cImlzT3duTWVzc2FnZShtc2cpICYmICFpc01lc3NhZ2VSZWFkKG1zZylcIlxyXG4gICAgICAgICAgICAgICAgICAgIGNsYXNzPVwicmVhZC1pY29uIHVucmVhZFwiXHJcbiAgICAgICAgICAgICAgICAgICAgbWF0VG9vbHRpcD1cIlNlbnRcIlxyXG4gICAgICAgICAgICAgICAgICAgIG1hdFRvb2x0aXBQb3NpdGlvbj1cImFib3ZlXCJcclxuICAgICAgICAgICAgICAgICAgPmRvbmU8L21hdC1pY29uPlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICA8YnV0dG9uXHJcbiAgICAgICAgICAgICAgICAgICpuZ0lmPVwiaXNHcm91cFwiXHJcbiAgICAgICAgICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxyXG4gICAgICAgICAgICAgICAgICBjbGFzcz1cInJlcGx5LW1lc3NhZ2UtYnRuXCJcclxuICAgICAgICAgICAgICAgICAgKGNsaWNrKT1cInN0YXJ0UmVwbHkobXNnLCAkZXZlbnQpXCJcclxuICAgICAgICAgICAgICAgICAgbWF0VG9vbHRpcD1cIlJlcGx5XCJcclxuICAgICAgICAgICAgICAgICAgbWF0VG9vbHRpcFBvc2l0aW9uPVwiYWJvdmVcIlxyXG4gICAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgICA8bWF0LWljb24+cmVwbHk8L21hdC1pY29uPlxyXG4gICAgICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICAgICAgICA8ZGl2ICpuZ0lmPVwiaG92ZXJlZE1lc3NhZ2VJZCA9PT0gbXNnLm1lc3NhZ2VfaWRcIiBjbGFzcz1cInF1aWNrLXJlYWN0aW9uc1wiPlxyXG4gICAgICAgICAgICAgICAgICA8YnV0dG9uXHJcbiAgICAgICAgICAgICAgICAgICAgKm5nRm9yPVwibGV0IGVtb2ppIG9mIHF1aWNrRW1vamlzXCJcclxuICAgICAgICAgICAgICAgICAgICBjbGFzcz1cInF1aWNrLWVtb2ppLWJ0blwiXHJcbiAgICAgICAgICAgICAgICAgICAgKGNsaWNrKT1cIm9uRW1vamlTZWxlY3RlZChlbW9qaSwgbXNnLm1lc3NhZ2VfaWQpXCJcclxuICAgICAgICAgICAgICAgICAgICBbYXR0ci5hcmlhLWxhYmVsXT1cIidSZWFjdCB3aXRoICcgKyBlbW9qaVwiXHJcbiAgICAgICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgICAgICB7eyBlbW9qaSB9fVxyXG4gICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgPGRpdiAqbmdJZj1cIm1zZy5yZWFjdGlvbnMgJiYgbXNnLnJlYWN0aW9ucy5sZW5ndGggPiAwXCIgY2xhc3M9XCJyZWFjdGlvbnMtcm93XCI+XHJcbiAgICAgICAgICAgICAgICAgIDxidXR0b24gXHJcbiAgICAgICAgICAgICAgICAgICAgKm5nRm9yPVwibGV0IHIgb2YgbXNnLnJlYWN0aW9uc1wiIFxyXG4gICAgICAgICAgICAgICAgICAgIGNsYXNzPVwicmVhY3Rpb24tY2hpcFwiXHJcbiAgICAgICAgICAgICAgICAgICAgKGNsaWNrKT1cInRvZ2dsZVJlYWN0aW9uKHIuZW1vamksIG1zZy5tZXNzYWdlX2lkKVwiXHJcbiAgICAgICAgICAgICAgICAgICAgW2NsYXNzLm93bi1yZWFjdGlvbl09XCJyLmhhc1JlYWN0ZWRcIlxyXG4gICAgICAgICAgICAgICAgICAgIFttYXRUb29sdGlwXT1cImdldFJlYWN0b3JUb29sdGlwKHIpXCJcclxuICAgICAgICAgICAgICAgICAgICBtYXRUb29sdGlwUG9zaXRpb249XCJhYm92ZVwiXHJcbiAgICAgICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cInJlYWN0aW9uLWVtb2ppXCI+e3sgci5lbW9qaSB9fTwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cInJlYWN0aW9uLWNvdW50XCI+e3sgci5jb3VudCB9fTwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgPC9uZy10ZW1wbGF0ZT5cclxuICAgICAgICAgIDwvbmctY29udGFpbmVyPlxyXG4gICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICA8ZGl2ICpuZ0lmPVwiIWlzUmVtb3ZlZEZyb21Hcm91cCAmJiBtZXNzYWdlcy5sZW5ndGggPT09IDAgJiYgIWxvYWRpbmdcIiBjbGFzcz1cImVtcHR5LWNoYXRcIj5cclxuICAgICAgICAgIDxtYXQtaWNvbj5jaGF0X2J1YmJsZV9vdXRsaW5lPC9tYXQtaWNvbj5cclxuICAgICAgICAgIDxwPk5vIG1lc3NhZ2VzIHlldC4gU2F5IGhlbGxvITwvcD5cclxuICAgICAgICA8L2Rpdj5cclxuICAgICAgPC9kaXY+XHJcblxyXG4gICAgICA8YXBwLW1lc3NhZ2UtaW5wdXRcclxuICAgICAgICAqbmdJZj1cIiFpc1JlbW92ZWRGcm9tR3JvdXBcIlxyXG4gICAgICAgIFtjb252ZXJzYXRpb25JZF09XCJjb252ZXJzYXRpb25JZFwiXHJcbiAgICAgICAgW3JlcGx5VG9dPVwicmVwbHlUb01lc3NhZ2UgPyBnZXRDb21wb3NlUmVwbHlQcmV2aWV3KHJlcGx5VG9NZXNzYWdlKSA6IG51bGxcIlxyXG4gICAgICAgIFtlbmFibGVNZW50aW9uc109XCJpc0dyb3VwXCJcclxuICAgICAgICBbbWVudGlvbk9wdGlvbnNdPVwibWVudGlvbk9wdGlvbnNcIlxyXG4gICAgICAgIChtZXNzYWdlU2VudCk9XCJvblNlbmRNZXNzYWdlKCRldmVudClcIlxyXG4gICAgICAgIChtZXNzYWdlV2l0aEZpbGVzKT1cIm9uU2VuZFdpdGhGaWxlcygkZXZlbnQpXCJcclxuICAgICAgICAocmVwbHlDYW5jZWxsZWQpPVwiY2xlYXJSZXBseSgpXCJcclxuICAgICAgPjwvYXBwLW1lc3NhZ2UtaW5wdXQ+XHJcbiAgICA8L2Rpdj5cclxuXHJcbiAgYCxcclxuICBzdHlsZXM6IFtgXHJcbiAgICA6aG9zdCB7XHJcbiAgICAgIC0tYXR0YWNobWVudC10aHVtYi1zaXplOiAxODBweDtcclxuICAgIH1cclxuXHJcbiAgICAuY2hhdC10aHJlYWQge1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xyXG4gICAgICBoZWlnaHQ6IDEwMCU7XHJcbiAgICAgIGJhY2tncm91bmQ6ICMwNDEzMjI7XHJcbiAgICAgIHBvc2l0aW9uOiByZWxhdGl2ZTtcclxuICAgICAgY29udGFpbmVyLXR5cGU6IGlubGluZS1zaXplO1xyXG4gICAgICAtLWF0dGFjaG1lbnQtdGh1bWItc2l6ZTogY2xhbXAoMTIwcHgsIDQ4Y3F3LCAxODBweCk7XHJcbiAgICB9XHJcblxyXG4gICAgLmNoYXQtdGhyZWFkLmRyYWctb3ZlciB7XHJcbiAgICAgIG91dGxpbmU6IDJweCBkYXNoZWQgcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjQ1KTtcclxuICAgICAgb3V0bGluZS1vZmZzZXQ6IC02cHg7XHJcbiAgICB9XHJcblxyXG4gICAgLnRocmVhZC1kcmFnLW92ZXJsYXkge1xyXG4gICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XHJcbiAgICAgIGluc2V0OiA4cHg7XHJcbiAgICAgIHotaW5kZXg6IDIwO1xyXG4gICAgICBwb2ludGVyLWV2ZW50czogbm9uZTtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XHJcbiAgICAgIGdhcDogOHB4O1xyXG4gICAgICBjb2xvcjogI2ZmZjtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgzMSwgNzUsIDIxNiwgMC4zMik7XHJcbiAgICAgIGJvcmRlcjogMnB4IGRhc2hlZCByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNTUpO1xyXG4gICAgICBib3JkZXItcmFkaXVzOiAxNHB4O1xyXG4gICAgICBmb250LXNpemU6IDE0cHg7XHJcbiAgICAgIGZvbnQtd2VpZ2h0OiA2MDA7XHJcbiAgICB9XHJcblxyXG4gICAgLnRocmVhZC1kcmFnLW92ZXJsYXkgbWF0LWljb24ge1xyXG4gICAgICBmb250LXNpemU6IDM2cHg7XHJcbiAgICAgIHdpZHRoOiAzNnB4O1xyXG4gICAgICBoZWlnaHQ6IDM2cHg7XHJcbiAgICB9XHJcblxyXG4gICAgLmNoYXQtaGVhZGVyIHtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAgcGFkZGluZzogOHB4IDhweCA4cHggNHB4O1xyXG4gICAgICBib3JkZXItYm90dG9tOiAxcHggc29saWQgcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjE1KTtcclxuICAgICAgZ2FwOiA0cHg7XHJcbiAgICAgIGZsZXgtc2hyaW5rOiAwO1xyXG4gICAgfVxyXG5cclxuICAgIC5jaGF0LWhlYWRlciBidXR0b24gbWF0LWljb24ge1xyXG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjgpO1xyXG4gICAgfVxyXG5cclxuICAgIC5jaGF0LW5hbWUge1xyXG4gICAgICBmb250LXNpemU6IDE2cHg7XHJcbiAgICAgIGZvbnQtd2VpZ2h0OiA2MDA7XHJcbiAgICAgIGNvbG9yOiAjZmZmO1xyXG4gICAgfVxyXG5cclxuICAgIC5oZWFkZXItaW5mbyB7XHJcbiAgICAgIGZsZXg6IDE7XHJcbiAgICAgIHdoaXRlLXNwYWNlOiBub3dyYXA7XHJcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XHJcbiAgICAgIHRleHQtb3ZlcmZsb3c6IGVsbGlwc2lzO1xyXG4gICAgICBkaXNwbGF5OiBibG9jaztcclxuICAgICAgcGFkZGluZzogMCA0cHg7XHJcbiAgICB9XHJcblxyXG4gICAgLmhlYWRlci1hY3Rpb25zIHtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAgZ2FwOiAwO1xyXG4gICAgfVxyXG5cclxuICAgIC5oZWFkZXItYWN0aW9ucyBidXR0b24ge1xyXG4gICAgICB3aWR0aDogMzJweDtcclxuICAgICAgaGVpZ2h0OiAzMnB4O1xyXG4gICAgICBtaW4td2lkdGg6IDMycHggIWltcG9ydGFudDtcclxuICAgICAgcGFkZGluZzogMCAhaW1wb3J0YW50O1xyXG4gICAgICBkaXNwbGF5OiBpbmxpbmUtZmxleCAhaW1wb3J0YW50O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyICFpbXBvcnRhbnQ7XHJcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyICFpbXBvcnRhbnQ7XHJcbiAgICAgIC0tbWRjLWljb24tYnV0dG9uLXN0YXRlLWxheWVyLXNpemU6IDMycHg7XHJcbiAgICB9XHJcblxyXG4gICAgLmhkci1idG4ge1xyXG4gICAgICBib3JkZXItcmFkaXVzOiA2cHggIWltcG9ydGFudDtcclxuICAgICAgdHJhbnNpdGlvbjogYmFja2dyb3VuZCAwLjE1cywgYm94LXNoYWRvdyAwLjE1cztcclxuICAgIH1cclxuXHJcbiAgICAuaGRyLWJ0bjpob3ZlciB7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xNSkgIWltcG9ydGFudDtcclxuICAgICAgYm94LXNoYWRvdzogMCAycHggOHB4IHJnYmEoMCwgMCwgMCwgMC4yKTtcclxuICAgIH1cclxuXHJcbiAgICAuaGRyLWJ0biBtYXQtaWNvbiB7XHJcbiAgICAgIGZvbnQtc2l6ZTogMjBweDtcclxuICAgICAgd2lkdGg6IDIwcHg7XHJcbiAgICAgIGhlaWdodDogMjBweDtcclxuICAgICAgbGluZS1oZWlnaHQ6IDIwcHg7XHJcbiAgICAgIG1hcmdpbjogMDtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XHJcbiAgICB9XHJcblxyXG4gICAgOmhvc3QgOjpuZy1kZWVwIC5oZHItYnRuIC5tYXQtbWRjLWJ1dHRvbi10b3VjaC10YXJnZXQge1xyXG4gICAgICB3aWR0aDogMzJweCAhaW1wb3J0YW50O1xyXG4gICAgICBoZWlnaHQ6IDMycHggIWltcG9ydGFudDtcclxuICAgIH1cclxuXHJcbiAgICAubWVzc2FnZXMtYXJlYSB7XHJcbiAgICAgIGZsZXg6IDE7XHJcbiAgICAgIG92ZXJmbG93LXk6IGF1dG87XHJcbiAgICAgIHBhZGRpbmc6IDEycHg7XHJcbiAgICAgIGJhY2tncm91bmQ6IHRyYW5zcGFyZW50O1xyXG4gICAgICBzY3JvbGxiYXItd2lkdGg6IG5vbmU7XHJcbiAgICAgIC1tcy1vdmVyZmxvdy1zdHlsZTogbm9uZTtcclxuICAgIH1cclxuXHJcbiAgICAubWVzc2FnZXMtYXJlYTo6LXdlYmtpdC1zY3JvbGxiYXIge1xyXG4gICAgICBkaXNwbGF5OiBub25lO1xyXG4gICAgfVxyXG5cclxuICAgIC5sb2FkaW5nLWluZGljYXRvciB7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xyXG4gICAgICBnYXA6IDhweDtcclxuICAgICAgcGFkZGluZzogMTJweDtcclxuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC43KTtcclxuICAgICAgZm9udC1zaXplOiAxM3B4O1xyXG4gICAgfVxyXG5cclxuICAgIC5yZW1vdmVkLWdyb3VwLXN0YXRlIHtcclxuICAgICAgaGVpZ2h0OiAxMDAlO1xyXG4gICAgICBtaW4taGVpZ2h0OiAyNjBweDtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XHJcbiAgICAgIHRleHQtYWxpZ246IGNlbnRlcjtcclxuICAgICAgZ2FwOiAxMHB4O1xyXG4gICAgICBwYWRkaW5nOiAzMnB4IDI0cHg7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNzgpO1xyXG4gICAgICBib3gtc2l6aW5nOiBib3JkZXItYm94O1xyXG4gICAgfVxyXG5cclxuICAgIC5yZW1vdmVkLWdyb3VwLXN0YXRlIG1hdC1pY29uIHtcclxuICAgICAgd2lkdGg6IDQ0cHg7XHJcbiAgICAgIGhlaWdodDogNDRweDtcclxuICAgICAgZm9udC1zaXplOiA0NHB4O1xyXG4gICAgICBjb2xvcjogI2Y4NzE3MTtcclxuICAgICAgbWFyZ2luLWJvdHRvbTogNHB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5yZW1vdmVkLWdyb3VwLXN0YXRlIGg0IHtcclxuICAgICAgbWFyZ2luOiAwO1xyXG4gICAgICBjb2xvcjogI2ZmZjtcclxuICAgICAgZm9udC1zaXplOiAxN3B4O1xyXG4gICAgICBmb250LXdlaWdodDogNzAwO1xyXG4gICAgfVxyXG5cclxuICAgIC5yZW1vdmVkLWdyb3VwLXN0YXRlIHAge1xyXG4gICAgICBtYXJnaW46IDAgMCA4cHg7XHJcbiAgICAgIG1heC13aWR0aDogMjgwcHg7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTNweDtcclxuICAgICAgbGluZS1oZWlnaHQ6IDEuNDtcclxuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC42Mik7XHJcbiAgICB9XHJcblxyXG4gICAgLnJlbW92ZWQtZXhpdC1idG4ge1xyXG4gICAgICBib3JkZXItcmFkaXVzOiAxMHB4O1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMTgpICFpbXBvcnRhbnQ7XHJcbiAgICAgIGNvbG9yOiAjZmZmICFpbXBvcnRhbnQ7XHJcbiAgICAgIGZvbnQtd2VpZ2h0OiA3MDA7XHJcbiAgICAgIHBhZGRpbmc6IDAgMThweDtcclxuICAgIH1cclxuXHJcbiAgICAubG9hZC1tb3JlLWJ0biB7XHJcbiAgICAgIGFsaWduLXNlbGY6IGNlbnRlcjtcclxuICAgICAgbWFyZ2luLWJvdHRvbTogMTZweDtcclxuICAgICAgZm9udC1zaXplOiAxMnB4O1xyXG4gICAgICBjb2xvcjogI2ZmZjtcclxuICAgIH1cclxuXHJcbiAgICAubWVzc2FnZXMtbGlzdCB7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XHJcbiAgICAgIGdhcDogMXB4O1xyXG4gICAgICBmbGV4OiAxO1xyXG4gICAgfVxyXG5cclxuICAgIC5kYXRlLXNlcGFyYXRvciB7XHJcbiAgICAgIHRleHQtYWxpZ246IGNlbnRlcjtcclxuICAgICAgbWFyZ2luOiAxNnB4IDAgOHB4O1xyXG4gICAgICBmb250LXNpemU6IDEycHg7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNyk7XHJcbiAgICAgIGZvbnQtd2VpZ2h0OiA1MDA7XHJcbiAgICB9XHJcblxyXG4gICAgLm1lc3NhZ2UtYnViYmxlLXJvdyB7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XHJcbiAgICAgIG1heC13aWR0aDogODglO1xyXG4gICAgICBtYXJnaW4tYm90dG9tOiAycHg7XHJcbiAgICB9XHJcblxyXG4gICAgLm1lc3NhZ2UtYnViYmxlLXJvdy5vd24ge1xyXG4gICAgICBhbGlnbi1zZWxmOiBmbGV4LWVuZDtcclxuICAgICAgYWxpZ24taXRlbXM6IGZsZXgtZW5kO1xyXG4gICAgfVxyXG5cclxuICAgIC5tZXNzYWdlLWJ1YmJsZS1yb3cub3RoZXIge1xyXG4gICAgICBhbGlnbi1zZWxmOiBmbGV4LXN0YXJ0O1xyXG4gICAgICBhbGlnbi1pdGVtczogZmxleC1zdGFydDtcclxuICAgIH1cclxuXHJcbiAgICAuc2VuZGVyLW5hbWUge1xyXG4gICAgICBmb250LXNpemU6IDExcHg7XHJcbiAgICAgIGZvbnQtd2VpZ2h0OiA3MDA7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuOTUpO1xyXG4gICAgICBtYXJnaW4tYm90dG9tOiAzcHg7XHJcbiAgICAgIGxldHRlci1zcGFjaW5nOiAwLjJweDtcclxuICAgICAgcGFkZGluZzogMCAxMHB4O1xyXG4gICAgICB0ZXh0LXNoYWRvdzogMCAxcHggM3B4IHJnYmEoMCwgMCwgMCwgMC40KTtcclxuICAgIH1cclxuXHJcbiAgICAuc3lzdGVtLW1lc3NhZ2Utcm93IHtcclxuICAgICAgYWxpZ24tc2VsZjogY2VudGVyO1xyXG4gICAgICBtYXgtd2lkdGg6IDg4JTtcclxuICAgICAgbWFyZ2luOiA4cHggYXV0bztcclxuICAgICAgdGV4dC1hbGlnbjogY2VudGVyO1xyXG4gICAgfVxyXG5cclxuICAgIC5zeXN0ZW0tbWVzc2FnZS10ZXh0IHtcclxuICAgICAgZGlzcGxheTogaW5saW5lLWZsZXg7XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xyXG4gICAgICBwYWRkaW5nOiA1cHggMTFweDtcclxuICAgICAgYm9yZGVyLXJhZGl1czogOTk5cHg7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4wOSk7XHJcbiAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xMik7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNzIpO1xyXG4gICAgICBmb250LXNpemU6IDExcHg7XHJcbiAgICAgIGxpbmUtaGVpZ2h0OiAxLjM1O1xyXG4gICAgfVxyXG5cclxuICAgIC5tZXNzYWdlLWJ1YmJsZSB7XHJcbiAgICAgIHBhZGRpbmc6IDhweCAxNHB4IDdweDtcclxuICAgICAgYm9yZGVyLXJhZGl1czogMTRweDtcclxuICAgICAgZm9udC1zaXplOiBjYWxjKGNsYW1wKDExcHgsIDMuNGNxdywgMTNweCkgKiB2YXIoLS1tZXNzYWdlLXRleHQtc2NhbGUsIDEpKTtcclxuICAgICAgbGluZS1oZWlnaHQ6IDEuMzI7XHJcbiAgICAgIHdvcmQtYnJlYWs6IGJyZWFrLXdvcmQ7XHJcbiAgICAgIGNvbG9yOiAjZjVmN2ZmO1xyXG4gICAgICBwb3NpdGlvbjogcmVsYXRpdmU7XHJcbiAgICAgIGRpc3BsYXk6IGlubGluZS1ibG9jaztcclxuICAgICAgbWluLXdpZHRoOiBmaXQtY29udGVudDtcclxuICAgIH1cclxuXHJcbiAgICAubWVzc2FnZS1idWJibGUtcm93Lm90aGVyIC5tZXNzYWdlLWJ1YmJsZSB7XHJcbiAgICAgIGJhY2tncm91bmQ6ICMwZDI1NDA7XHJcbiAgICAgIGJvcmRlci1ib3R0b20tbGVmdC1yYWRpdXM6IDVweDtcclxuICAgICAgYm94LXNoYWRvdzogMCAxcHggNHB4IHJnYmEoMCwgMCwgMCwgMC40KTtcclxuICAgIH1cclxuXHJcbiAgICAubWVzc2FnZS1idWJibGUub3duLWJ1YmJsZSB7XHJcbiAgICAgIGJhY2tncm91bmQ6ICMwYTNkNjI7XHJcbiAgICAgIGJvcmRlci1ib3R0b20tcmlnaHQtcmFkaXVzOiA1cHg7XHJcbiAgICAgIGJveC1zaGFkb3c6IDAgMXB4IDRweCByZ2JhKDAsIDAsIDAsIDAuNCk7XHJcbiAgICB9XHJcblxyXG4gICAgLnJlcGx5LWNvbnRleHQge1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBnYXA6IDdweDtcclxuICAgICAgbWFyZ2luLWJvdHRvbTogN3B4O1xyXG4gICAgICBwYWRkaW5nOiA3cHggOXB4O1xyXG4gICAgICBib3JkZXItcmFkaXVzOiAxMHB4O1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMDgpO1xyXG4gICAgICBib3JkZXItbGVmdDogM3B4IHNvbGlkIHJnYmEoMTI3LCAxODAsIDI1NSwgMC43OCk7XHJcbiAgICAgIG1heC13aWR0aDogbWluKDY4Y3F3LCA0MjBweCk7XHJcbiAgICB9XHJcblxyXG4gICAgLnJlcGx5LWNvbnRleHQgbWF0LWljb24ge1xyXG4gICAgICBjb2xvcjogI2JmZGJmZTtcclxuICAgICAgZm9udC1zaXplOiAxNnB4O1xyXG4gICAgICB3aWR0aDogMTZweDtcclxuICAgICAgaGVpZ2h0OiAxNnB4O1xyXG4gICAgICBmbGV4LXNocmluazogMDtcclxuICAgIH1cclxuXHJcbiAgICAucmVwbHktY29udGV4dCBkaXYge1xyXG4gICAgICBtaW4td2lkdGg6IDA7XHJcbiAgICB9XHJcblxyXG4gICAgLnJlcGx5LWNvbnRleHQgc3BhbiB7XHJcbiAgICAgIGRpc3BsYXk6IGJsb2NrO1xyXG4gICAgICBjb2xvcjogI2JmZGJmZTtcclxuICAgICAgZm9udC1zaXplOiAxMXB4O1xyXG4gICAgICBmb250LXdlaWdodDogNzAwO1xyXG4gICAgICBtYXJnaW4tYm90dG9tOiAycHg7XHJcbiAgICB9XHJcblxyXG4gICAgLnJlcGx5LWNvbnRleHQgcCB7XHJcbiAgICAgIG1hcmdpbjogMDtcclxuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC43OCk7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTJweDtcclxuICAgICAgd2hpdGUtc3BhY2U6IG5vd3JhcDtcclxuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcclxuICAgICAgdGV4dC1vdmVyZmxvdzogZWxsaXBzaXM7XHJcbiAgICB9XHJcblxyXG4gICAgLnRleHQtY29udGVudCB7XHJcbiAgICAgIHdoaXRlLXNwYWNlOiBwcmUtd3JhcDtcclxuICAgICAgdGFiLXNpemU6IDQ7XHJcbiAgICB9XHJcblxyXG4gICAgLnRleHQtY29udGVudC5wcmVmb3JtYXR0ZWQtdGV4dCB7XHJcbiAgICAgIGZvbnQtZmFtaWx5OiB1aS1tb25vc3BhY2UsIFNGTW9uby1SZWd1bGFyLCBNZW5sbywgTW9uYWNvLCBDb25zb2xhcywgXCJMaWJlcmF0aW9uIE1vbm9cIiwgbW9ub3NwYWNlO1xyXG4gICAgICBmb250LXNpemU6IGNhbGMoY2xhbXAoMTBweCwgMy4xY3F3LCAxMnB4KSAqIHZhcigtLWNvZGUtdGV4dC1zY2FsZSwgMSkpO1xyXG4gICAgICBsaW5lLWhlaWdodDogMS40NTtcclxuICAgICAgb3ZlcmZsb3cteDogYXV0bztcclxuICAgICAgbWF4LXdpZHRoOiBtaW4oNzJjcXcsIDUyMHB4KTtcclxuICAgICAgc2Nyb2xsYmFyLXdpZHRoOiBub25lO1xyXG4gICAgICAtbXMtb3ZlcmZsb3ctc3R5bGU6IG5vbmU7XHJcbiAgICB9XHJcblxyXG4gICAgLnRleHQtY29udGVudC5wcmVmb3JtYXR0ZWQtdGV4dDo6LXdlYmtpdC1zY3JvbGxiYXIge1xyXG4gICAgICBkaXNwbGF5OiBub25lO1xyXG4gICAgfVxyXG5cclxuICAgIC5hdHRhY2htZW50LWNhcHRpb24ge1xyXG4gICAgICBtYXJnaW4tdG9wOiA4cHg7XHJcbiAgICAgIHdpZHRoOiB2YXIoLS1hdHRhY2htZW50LXRodW1iLXNpemUpO1xyXG4gICAgICBtYXgtd2lkdGg6IHZhcigtLWF0dGFjaG1lbnQtdGh1bWItc2l6ZSk7XHJcbiAgICAgIGJveC1zaXppbmc6IGJvcmRlci1ib3g7XHJcbiAgICB9XHJcblxyXG4gICAgLmF0dGFjaG1lbnQtY2FwdGlvbiAudGV4dC1jb250ZW50IHtcclxuICAgICAgd2hpdGUtc3BhY2U6IHByZS13cmFwO1xyXG4gICAgICBvdmVyZmxvdy13cmFwOiBhbnl3aGVyZTtcclxuICAgICAgbWF4LXdpZHRoOiAxMDAlO1xyXG4gICAgfVxyXG5cclxuICAgIC5hdHRhY2htZW50LXJlbmRlci1ibG9jayB7XHJcbiAgICAgIHdpZHRoOiAxMDAlO1xyXG4gICAgICBtYXgtd2lkdGg6IDEwMCU7XHJcbiAgICB9XHJcblxyXG4gICAgLmNvZGUtbWVzc2FnZS13cmFwIHtcclxuICAgICAgcG9zaXRpb246IHJlbGF0aXZlO1xyXG4gICAgICBtYXgtd2lkdGg6IG1pbig3NmNxdywgNTYwcHgpO1xyXG4gICAgICBib3JkZXItcmFkaXVzOiAxMHB4O1xyXG4gICAgICBvdmVyZmxvdzogaGlkZGVuO1xyXG4gICAgICBib3JkZXI6IDFweCBzb2xpZCByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMTQpO1xyXG4gICAgICBiYWNrZ3JvdW5kOiAjMDYxODI3O1xyXG4gICAgfVxyXG5cclxuICAgIC5yZW5kZXItY29weS1idG4ge1xyXG4gICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XHJcbiAgICAgIHRvcDogNnB4O1xyXG4gICAgICByaWdodDogNnB4O1xyXG4gICAgICB6LWluZGV4OiAyO1xyXG4gICAgICB3aWR0aDogMjZweDtcclxuICAgICAgaGVpZ2h0OiAyNnB4O1xyXG4gICAgICBib3JkZXI6IG5vbmU7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDdweDtcclxuICAgICAgZGlzcGxheTogaW5saW5lLWZsZXg7XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xyXG4gICAgICBwYWRkaW5nOiAwO1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDcsIDI5LCA0OCwgMC44Mik7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNzgpO1xyXG4gICAgICBjdXJzb3I6IHBvaW50ZXI7XHJcbiAgICAgIG9wYWNpdHk6IDA7XHJcbiAgICAgIHRyYW5zaXRpb246IG9wYWNpdHkgMC4xMnMsIGJhY2tncm91bmQgMC4xMnMsIGNvbG9yIDAuMTJzO1xyXG4gICAgfVxyXG5cclxuICAgIC5jb2RlLW1lc3NhZ2Utd3JhcDpob3ZlciAucmVuZGVyLWNvcHktYnRuLFxyXG4gICAgLnRhYmxlLW1lc3NhZ2Utd3JhcDpob3ZlciAucmVuZGVyLWNvcHktYnRuLFxyXG4gICAgLm1kLW1lc3NhZ2Utd3JhcDpob3ZlciAucmVuZGVyLWNvcHktYnRuLFxyXG4gICAgLnJlbmRlci1jb3B5LWJ0bjpmb2N1cyB7XHJcbiAgICAgIG9wYWNpdHk6IDE7XHJcbiAgICB9XHJcblxyXG4gICAgLnJlbmRlci1jb3B5LWJ0bjpob3ZlciB7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMTI3LCAxODAsIDI1NSwgMC4yMik7XHJcbiAgICAgIGNvbG9yOiAjZmZmO1xyXG4gICAgfVxyXG5cclxuICAgIC5yZW5kZXItY29weS1idG4gbWF0LWljb24ge1xyXG4gICAgICBmb250LXNpemU6IDE2cHg7XHJcbiAgICAgIHdpZHRoOiAxNnB4O1xyXG4gICAgICBoZWlnaHQ6IDE2cHg7XHJcbiAgICAgIGxpbmUtaGVpZ2h0OiAxNnB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5jb2RlLW1lc3NhZ2Uge1xyXG4gICAgICBtYXJnaW46IDA7XHJcbiAgICAgIHBhZGRpbmc6IDEycHggNDJweCAyOHB4IDEycHg7XHJcbiAgICAgIG92ZXJmbG93LXg6IGF1dG87XHJcbiAgICAgIGNvbG9yOiAjZGJlYWZlO1xyXG4gICAgICBmb250LWZhbWlseTogdWktbW9ub3NwYWNlLCBTRk1vbm8tUmVndWxhciwgTWVubG8sIE1vbmFjbywgQ29uc29sYXMsIFwiTGliZXJhdGlvbiBNb25vXCIsIG1vbm9zcGFjZTtcclxuICAgICAgZm9udC1zaXplOiBjYWxjKGNsYW1wKDEwcHgsIDMuMWNxdywgMTJweCkgKiB2YXIoLS1jb2RlLXRleHQtc2NhbGUsIDEpKTtcclxuICAgICAgbGluZS1oZWlnaHQ6IDEuNDU7XHJcbiAgICAgIHdoaXRlLXNwYWNlOiBwcmU7XHJcbiAgICAgIHRhYi1zaXplOiAyO1xyXG4gICAgICBzY3JvbGxiYXItd2lkdGg6IG5vbmU7XHJcbiAgICAgIC1tcy1vdmVyZmxvdy1zdHlsZTogbm9uZTtcclxuICAgIH1cclxuXHJcbiAgICAuY29kZS1tZXNzYWdlOjotd2Via2l0LXNjcm9sbGJhciB7XHJcbiAgICAgIGRpc3BsYXk6IG5vbmU7XHJcbiAgICB9XHJcblxyXG4gICAgLmNvZGUtbGFuZ3VhZ2Uge1xyXG4gICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XHJcbiAgICAgIHJpZ2h0OiA4cHg7XHJcbiAgICAgIGJvdHRvbTogNnB4O1xyXG4gICAgICBwYWRkaW5nOiAycHggN3B4O1xyXG4gICAgICBib3JkZXItcmFkaXVzOiA5OTlweDtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgxMjcsIDE4MCwgMjU1LCAwLjE2KTtcclxuICAgICAgY29sb3I6ICNiZmRiZmU7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTBweDtcclxuICAgICAgZm9udC13ZWlnaHQ6IDcwMDtcclxuICAgICAgbGV0dGVyLXNwYWNpbmc6IDAuMDVlbTtcclxuICAgICAgdGV4dC10cmFuc2Zvcm06IHVwcGVyY2FzZTtcclxuICAgICAgcG9pbnRlci1ldmVudHM6IG5vbmU7XHJcbiAgICB9XHJcblxyXG4gICAgLm1kLWxhbmd1YWdlIHtcclxuICAgICAgcG9zaXRpb246IGFic29sdXRlO1xyXG4gICAgICByaWdodDogOHB4O1xyXG4gICAgICBib3R0b206IDZweDtcclxuICAgICAgcGFkZGluZzogMnB4IDdweDtcclxuICAgICAgYm9yZGVyLXJhZGl1czogOTk5cHg7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMTM0LCAyMzksIDE3MiwgMC4xNCk7XHJcbiAgICAgIGNvbG9yOiAjYmJmN2QwO1xyXG4gICAgICBmb250LXNpemU6IDEwcHg7XHJcbiAgICAgIGZvbnQtd2VpZ2h0OiA3MDA7XHJcbiAgICAgIGxldHRlci1zcGFjaW5nOiAwLjA1ZW07XHJcbiAgICAgIHRleHQtdHJhbnNmb3JtOiB1cHBlcmNhc2U7XHJcbiAgICAgIHBvaW50ZXItZXZlbnRzOiBub25lO1xyXG4gICAgfVxyXG5cclxuICAgIDpob3N0IDo6bmctZGVlcCAuY29kZS10b2tlbi1rZXl3b3JkIHsgY29sb3I6ICM5M2M1ZmQ7IGZvbnQtd2VpZ2h0OiA3MDA7IH1cclxuICAgIDpob3N0IDo6bmctZGVlcCAuY29kZS10b2tlbi1zdHJpbmcgeyBjb2xvcjogIzg2ZWZhYzsgfVxyXG4gICAgOmhvc3QgOjpuZy1kZWVwIC5jb2RlLXRva2VuLW51bWJlciB7IGNvbG9yOiAjZmJiZjI0OyB9XHJcbiAgICA6aG9zdCA6Om5nLWRlZXAgLmNvZGUtdG9rZW4tY29tbWVudCB7IGNvbG9yOiAjOTRhM2I4OyBmb250LXN0eWxlOiBpdGFsaWM7IH1cclxuICAgIDpob3N0IDo6bmctZGVlcCAuY29kZS10b2tlbi1mdW5jdGlvbiB7IGNvbG9yOiAjYzRiNWZkOyB9XHJcblxyXG4gICAgLnRhYmxlLW1lc3NhZ2Utd3JhcCB7XHJcbiAgICAgIHBvc2l0aW9uOiByZWxhdGl2ZTtcclxuICAgICAgbWF4LXdpZHRoOiBtaW4oNzZjcXcsIDU2MHB4KTtcclxuICAgICAgb3ZlcmZsb3cteDogYXV0bztcclxuICAgICAgYm9yZGVyLXJhZGl1czogOXB4O1xyXG4gICAgICBib3JkZXI6IDFweCBzb2xpZCByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMTYpO1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMDQpO1xyXG4gICAgICBzY3JvbGxiYXItd2lkdGg6IG5vbmU7XHJcbiAgICAgIC1tcy1vdmVyZmxvdy1zdHlsZTogbm9uZTtcclxuICAgIH1cclxuXHJcbiAgICAudGFibGUtbWVzc2FnZS13cmFwOjotd2Via2l0LXNjcm9sbGJhciB7XHJcbiAgICAgIGRpc3BsYXk6IG5vbmU7XHJcbiAgICB9XHJcblxyXG4gICAgLnBhc3RlZC10YWJsZSB7XHJcbiAgICAgIGJvcmRlci1jb2xsYXBzZTogY29sbGFwc2U7XHJcbiAgICAgIG1pbi13aWR0aDogMTAwJTtcclxuICAgICAgZm9udC1zaXplOiBjYWxjKGNsYW1wKDEwcHgsIDMuMWNxdywgMTJweCkgKiB2YXIoLS1jb2RlLXRleHQtc2NhbGUsIDEpKTtcclxuICAgICAgbGluZS1oZWlnaHQ6IDEuMzU7XHJcbiAgICAgIGNvbG9yOiAjZjVmN2ZmO1xyXG4gICAgfVxyXG5cclxuICAgIC5wYXN0ZWQtdGFibGUgdGgsXHJcbiAgICAucGFzdGVkLXRhYmxlIHRkIHtcclxuICAgICAgcGFkZGluZzogNnB4IDlweDtcclxuICAgICAgYm9yZGVyLXJpZ2h0OiAxcHggc29saWQgcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjEyKTtcclxuICAgICAgYm9yZGVyLWJvdHRvbTogMXB4IHNvbGlkIHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xMik7XHJcbiAgICAgIHRleHQtYWxpZ246IGxlZnQ7XHJcbiAgICAgIHdoaXRlLXNwYWNlOiBwcmUtd3JhcDtcclxuICAgICAgdmVydGljYWwtYWxpZ246IHRvcDtcclxuICAgIH1cclxuXHJcbiAgICAucGFzdGVkLXRhYmxlIHRoIHtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjEpO1xyXG4gICAgICBmb250LXdlaWdodDogNzAwO1xyXG4gICAgfVxyXG5cclxuICAgIC5wYXN0ZWQtdGFibGUgdHI6bGFzdC1jaGlsZCB0ZCxcclxuICAgIC5wYXN0ZWQtdGFibGUgdHI6bGFzdC1jaGlsZCB0aCB7XHJcbiAgICAgIGJvcmRlci1ib3R0b206IG5vbmU7XHJcbiAgICB9XHJcblxyXG4gICAgLnBhc3RlZC10YWJsZSB0aDpsYXN0LWNoaWxkLFxyXG4gICAgLnBhc3RlZC10YWJsZSB0ZDpsYXN0LWNoaWxkIHtcclxuICAgICAgYm9yZGVyLXJpZ2h0OiBub25lO1xyXG4gICAgfVxyXG5cclxuICAgIC5tZC1tZXNzYWdlLXdyYXAge1xyXG4gICAgICBwb3NpdGlvbjogcmVsYXRpdmU7XHJcbiAgICAgIG1heC13aWR0aDogbWluKDc2Y3F3LCA1NjBweCk7XHJcbiAgICAgIG92ZXJmbG93LXg6IGF1dG87XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDEwcHg7XHJcbiAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xMik7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4wNSk7XHJcbiAgICAgIHNjcm9sbGJhci13aWR0aDogbm9uZTtcclxuICAgICAgLW1zLW92ZXJmbG93LXN0eWxlOiBub25lO1xyXG4gICAgfVxyXG5cclxuICAgIC5tZC1tZXNzYWdlLXdyYXA6Oi13ZWJraXQtc2Nyb2xsYmFyIHtcclxuICAgICAgZGlzcGxheTogbm9uZTtcclxuICAgIH1cclxuXHJcbiAgICAubWQtbWVzc2FnZSB7XHJcbiAgICAgIHBhZGRpbmc6IDEwcHggNDJweCAyOHB4IDEycHg7XHJcbiAgICAgIGNvbG9yOiAjZjVmN2ZmO1xyXG4gICAgICBmb250LXNpemU6IGNhbGMoY2xhbXAoMTFweCwgMy40Y3F3LCAxM3B4KSAqIHZhcigtLW1lc3NhZ2UtdGV4dC1zY2FsZSwgMSkpO1xyXG4gICAgICBsaW5lLWhlaWdodDogMS40NTtcclxuICAgICAgb3ZlcmZsb3ctd3JhcDogYW55d2hlcmU7XHJcbiAgICB9XHJcblxyXG4gICAgOmhvc3QgOjpuZy1kZWVwIC5tZC1tZXNzYWdlIGgxLFxyXG4gICAgOmhvc3QgOjpuZy1kZWVwIC5tZC1tZXNzYWdlIGgyLFxyXG4gICAgOmhvc3QgOjpuZy1kZWVwIC5tZC1tZXNzYWdlIGgzIHtcclxuICAgICAgbWFyZ2luOiA4cHggMCA2cHg7XHJcbiAgICAgIGNvbG9yOiAjZmZmO1xyXG4gICAgICBsaW5lLWhlaWdodDogMS4yNTtcclxuICAgIH1cclxuXHJcbiAgICA6aG9zdCA6Om5nLWRlZXAgLm1kLW1lc3NhZ2UgaDEgeyBmb250LXNpemU6IDE4cHg7IH1cclxuICAgIDpob3N0IDo6bmctZGVlcCAubWQtbWVzc2FnZSBoMiB7IGZvbnQtc2l6ZTogMTZweDsgfVxyXG4gICAgOmhvc3QgOjpuZy1kZWVwIC5tZC1tZXNzYWdlIGgzIHsgZm9udC1zaXplOiAxNHB4OyB9XHJcblxyXG4gICAgOmhvc3QgOjpuZy1kZWVwIC5tZC1tZXNzYWdlIHAge1xyXG4gICAgICBtYXJnaW46IDZweCAwO1xyXG4gICAgfVxyXG5cclxuICAgIDpob3N0IDo6bmctZGVlcCAubWQtbWVzc2FnZSB1bCxcclxuICAgIDpob3N0IDo6bmctZGVlcCAubWQtbWVzc2FnZSBvbCB7XHJcbiAgICAgIG1hcmdpbjogNnB4IDA7XHJcbiAgICAgIHBhZGRpbmctbGVmdDogMjBweDtcclxuICAgIH1cclxuXHJcbiAgICA6aG9zdCA6Om5nLWRlZXAgLm1kLW1lc3NhZ2UgYmxvY2txdW90ZSB7XHJcbiAgICAgIG1hcmdpbjogOHB4IDA7XHJcbiAgICAgIHBhZGRpbmctbGVmdDogMTBweDtcclxuICAgICAgYm9yZGVyLWxlZnQ6IDNweCBzb2xpZCByZ2JhKDEyNywgMTgwLCAyNTUsIDAuNTUpO1xyXG4gICAgICBjb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjc4KTtcclxuICAgIH1cclxuXHJcbiAgICA6aG9zdCA6Om5nLWRlZXAgLm1kLW1lc3NhZ2UgY29kZSB7XHJcbiAgICAgIHBhZGRpbmc6IDFweCA1cHg7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDVweDtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgwLCAwLCAwLCAwLjI1KTtcclxuICAgICAgY29sb3I6ICNiZmRiZmU7XHJcbiAgICAgIGZvbnQtZmFtaWx5OiB1aS1tb25vc3BhY2UsIFNGTW9uby1SZWd1bGFyLCBNZW5sbywgTW9uYWNvLCBDb25zb2xhcywgXCJMaWJlcmF0aW9uIE1vbm9cIiwgbW9ub3NwYWNlO1xyXG4gICAgICBmb250LXNpemU6IDEycHg7XHJcbiAgICB9XHJcblxyXG4gICAgOmhvc3QgOjpuZy1kZWVwIC5tZC1tZXNzYWdlIHByZSB7XHJcbiAgICAgIG1hcmdpbjogOHB4IDA7XHJcbiAgICAgIHBhZGRpbmc6IDlweDtcclxuICAgICAgYm9yZGVyLXJhZGl1czogOHB4O1xyXG4gICAgICBvdmVyZmxvdy14OiBhdXRvO1xyXG4gICAgICBiYWNrZ3JvdW5kOiAjMDYxODI3O1xyXG4gICAgICBzY3JvbGxiYXItd2lkdGg6IG5vbmU7XHJcbiAgICAgIC1tcy1vdmVyZmxvdy1zdHlsZTogbm9uZTtcclxuICAgIH1cclxuXHJcbiAgICA6aG9zdCA6Om5nLWRlZXAgLm1kLW1lc3NhZ2UgcHJlOjotd2Via2l0LXNjcm9sbGJhciB7XHJcbiAgICAgIGRpc3BsYXk6IG5vbmU7XHJcbiAgICB9XHJcblxyXG4gICAgOmhvc3QgOjpuZy1kZWVwIC5tZC1tZXNzYWdlIHByZSBjb2RlIHtcclxuICAgICAgcGFkZGluZzogMDtcclxuICAgICAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQ7XHJcbiAgICAgIGNvbG9yOiAjZGJlYWZlO1xyXG4gICAgICB3aGl0ZS1zcGFjZTogcHJlO1xyXG4gICAgfVxyXG5cclxuICAgIC5pbWFnZS1tZXNzYWdlIHtcclxuICAgICAgbGluZS1oZWlnaHQ6IDA7XHJcbiAgICB9XHJcblxyXG4gICAgLm1lZGlhLXdyYXBwZXIge1xyXG4gICAgICBwb3NpdGlvbjogcmVsYXRpdmU7XHJcbiAgICAgIGRpc3BsYXk6IGlubGluZS1ibG9jaztcclxuICAgICAgbGluZS1oZWlnaHQ6IDA7XHJcbiAgICAgIHdpZHRoOiB2YXIoLS1hdHRhY2htZW50LXRodW1iLXNpemUpO1xyXG4gICAgICBoZWlnaHQ6IHZhcigtLWF0dGFjaG1lbnQtdGh1bWItc2l6ZSk7XHJcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDEwcHg7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4wOCk7XHJcbiAgICB9XHJcblxyXG4gICAgLm1lZGlhLWltZyB7XHJcbiAgICAgIHdpZHRoOiAxMDAlO1xyXG4gICAgICBoZWlnaHQ6IDEwMCU7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IGluaGVyaXQ7XHJcbiAgICAgIGRpc3BsYXk6IGJsb2NrO1xyXG4gICAgICBjdXJzb3I6IHpvb20taW47XHJcbiAgICAgIG9iamVjdC1maXQ6IGNvdmVyO1xyXG4gICAgfVxyXG5cclxuICAgIC5hdHRhY2htZW50LWFjdGlvbnMge1xyXG4gICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XHJcbiAgICAgIHJpZ2h0OiA2cHg7XHJcbiAgICAgIHRvcDogNnB4O1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBnYXA6IDRweDtcclxuICAgICAgb3BhY2l0eTogMDtcclxuICAgICAgdHJhbnNpdGlvbjogb3BhY2l0eSAwLjEycyBlYXNlO1xyXG4gICAgICBwb2ludGVyLWV2ZW50czogbm9uZTtcclxuICAgIH1cclxuXHJcbiAgICAubWVkaWEtd3JhcHBlcjpob3ZlciAuYXR0YWNobWVudC1hY3Rpb25zIHtcclxuICAgICAgb3BhY2l0eTogMTtcclxuICAgICAgcG9pbnRlci1ldmVudHM6IGF1dG87XHJcbiAgICB9XHJcblxyXG4gICAgLmF0dGFjaG1lbnQtYWN0aW9uLWJ0bixcclxuICAgIC5maWxlLWRvd25sb2FkLWJ0biB7XHJcbiAgICAgIGJvcmRlcjogbm9uZTtcclxuICAgICAgYm9yZGVyLXJhZGl1czogOTk5cHg7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoNywgMjksIDQ4LCAwLjgyKTtcclxuICAgICAgY29sb3I6ICNmZmY7XHJcbiAgICAgIGRpc3BsYXk6IGlubGluZS1mbGV4O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcclxuICAgICAgY3Vyc29yOiBwb2ludGVyO1xyXG4gICAgICBwYWRkaW5nOiAwO1xyXG4gICAgfVxyXG5cclxuICAgIC5hdHRhY2htZW50LWFjdGlvbi1idG4ge1xyXG4gICAgICB3aWR0aDogMjhweDtcclxuICAgICAgaGVpZ2h0OiAyOHB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5hdHRhY2htZW50LWFjdGlvbi1idG4gbWF0LWljb24ge1xyXG4gICAgICBmb250LXNpemU6IDE3cHg7XHJcbiAgICAgIHdpZHRoOiAxN3B4O1xyXG4gICAgICBoZWlnaHQ6IDE3cHg7XHJcbiAgICB9XHJcblxyXG4gICAgLm1lZGlhLXZpZGVvIHtcclxuICAgICAgbWF4LXdpZHRoOiAyNDBweDtcclxuICAgICAgbWF4LWhlaWdodDogMjYwcHg7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDEwcHg7XHJcbiAgICAgIGRpc3BsYXk6IGJsb2NrO1xyXG4gICAgICBiYWNrZ3JvdW5kOiAjMDAwO1xyXG4gICAgfVxyXG5cclxuICAgIC52aWRlby1tZXNzYWdlIHtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcclxuICAgICAgZ2FwOiA2cHg7XHJcbiAgICB9XHJcblxyXG4gICAgLnZpZGVvLWRvd25sb2FkIHtcclxuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC43OCk7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTJweDtcclxuICAgICAgdGV4dC1kZWNvcmF0aW9uOiB1bmRlcmxpbmU7XHJcbiAgICAgIHRleHQtdW5kZXJsaW5lLW9mZnNldDogMnB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5tZWRpYS1wbGFjZWhvbGRlciB7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xyXG4gICAgICBnYXA6IDhweDtcclxuICAgICAgd2lkdGg6IHZhcigtLWF0dGFjaG1lbnQtdGh1bWItc2l6ZSk7XHJcbiAgICAgIGhlaWdodDogdmFyKC0tYXR0YWNobWVudC10aHVtYi1zaXplKTtcclxuICAgICAgYm9yZGVyLXJhZGl1czogMTBweDtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjA4KTtcclxuICAgICAgY29sb3I6IHJnYmEoMjU1LDI1NSwyNTUsMC42KTtcclxuICAgICAgZm9udC1zaXplOiAxMXB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5tZWRpYS1sb2FkLWxhYmVsIHtcclxuICAgICAgZm9udC1zaXplOiAxMXB4O1xyXG4gICAgICBjb2xvcjogcmdiYSgyNTUsMjU1LDI1NSwwLjYpO1xyXG4gICAgfVxyXG5cclxuICAgIC5hdHRhY2htZW50cy1saXN0IHtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcclxuICAgICAgZ2FwOiA4cHg7XHJcbiAgICAgIG1heC13aWR0aDogMTAwJTtcclxuICAgIH1cclxuXHJcbiAgICAuYXR0YWNobWVudC1pdGVtIHtcclxuICAgICAgbWF4LXdpZHRoOiAxMDAlO1xyXG4gICAgfVxyXG5cclxuICAgIC5maWxlLW1lc3NhZ2Uge1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBnYXA6IDhweDtcclxuICAgICAgcGFkZGluZzogNHB4IDA7XHJcbiAgICB9XHJcblxyXG4gICAgLmF0dGFjaG1lbnQtdGh1bWIuZmlsZS1tZXNzYWdlIHtcclxuICAgICAgcG9zaXRpb246IHJlbGF0aXZlO1xyXG4gICAgICB3aWR0aDogdmFyKC0tYXR0YWNobWVudC10aHVtYi1zaXplKTtcclxuICAgICAgaGVpZ2h0OiB2YXIoLS1hdHRhY2htZW50LXRodW1iLXNpemUpO1xyXG4gICAgICBwYWRkaW5nOiAxMnB4O1xyXG4gICAgICBib3JkZXItcmFkaXVzOiAxMHB4O1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMDgpO1xyXG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xyXG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcclxuICAgICAgYm94LXNpemluZzogYm9yZGVyLWJveDtcclxuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcclxuICAgIH1cclxuXHJcbiAgICAuZmlsZS1kb3dubG9hZCB7XHJcbiAgICAgIGRpc3BsYXk6IGlubGluZS1mbGV4O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBnYXA6IDhweDtcclxuICAgICAgY29sb3I6ICNmZmY7XHJcbiAgICAgIHRleHQtZGVjb3JhdGlvbjogbm9uZTtcclxuICAgICAgbWF4LXdpZHRoOiAyNDBweDtcclxuICAgIH1cclxuXHJcbiAgICAuZmlsZS1tc2ctaWNvbiB7XHJcbiAgICAgIGZvbnQtc2l6ZTogNDJweDtcclxuICAgICAgd2lkdGg6IDQycHg7XHJcbiAgICAgIGhlaWdodDogNDJweDtcclxuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC44KTtcclxuICAgICAgZmxleC1zaHJpbms6IDA7XHJcbiAgICB9XHJcblxyXG4gICAgLmZpbGUtbXNnLW5hbWUge1xyXG4gICAgICBmb250LXNpemU6IDEzcHg7XHJcbiAgICAgIGNvbG9yOiAjZmZmO1xyXG4gICAgICBsaW5lLWhlaWdodDogMS4yO1xyXG4gICAgICBtYXgtd2lkdGg6IDEwMCU7XHJcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XHJcbiAgICAgIHRleHQtYWxpZ246IGNlbnRlcjtcclxuICAgICAgdGV4dC1vdmVyZmxvdzogZWxsaXBzaXM7XHJcbiAgICAgIGRpc3BsYXk6IC13ZWJraXQtYm94O1xyXG4gICAgICAtd2Via2l0LWxpbmUtY2xhbXA6IDM7XHJcbiAgICAgIC13ZWJraXQtYm94LW9yaWVudDogdmVydGljYWw7XHJcbiAgICAgIHdvcmQtYnJlYWs6IGJyZWFrLXdvcmQ7XHJcbiAgICB9XHJcblxyXG4gICAgLmZpbGUtZG93bmxvYWQtaWNvbiB7XHJcbiAgICAgIGZvbnQtc2l6ZTogMThweDtcclxuICAgICAgd2lkdGg6IDE4cHg7XHJcbiAgICAgIGhlaWdodDogMThweDtcclxuICAgICAgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC43KTtcclxuICAgICAgZmxleC1zaHJpbms6IDA7XHJcbiAgICB9XHJcblxyXG4gICAgLmZpbGUtZG93bmxvYWQtYnRuIHtcclxuICAgICAgd2lkdGg6IDI0cHg7XHJcbiAgICAgIGhlaWdodDogMjRweDtcclxuICAgICAgZmxleC1zaHJpbms6IDA7XHJcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcclxuICAgICAgcmlnaHQ6IDZweDtcclxuICAgICAgdG9wOiA2cHg7XHJcbiAgICB9XHJcblxyXG4gICAgLmZpbGUtZG93bmxvYWQtbGluayB7XHJcbiAgICAgIGJvcmRlcjogbm9uZTtcclxuICAgICAgYm9yZGVyLXJhZGl1czogOTk5cHg7XHJcbiAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xNik7XHJcbiAgICAgIGNvbG9yOiAjZmZmO1xyXG4gICAgICBjdXJzb3I6IHBvaW50ZXI7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTFweDtcclxuICAgICAgcGFkZGluZzogNHB4IDEwcHg7XHJcbiAgICAgIG1hcmdpbi10b3A6IDRweDtcclxuICAgIH1cclxuXHJcbiAgICAubWVzc2FnZS1tZXRhIHtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAgZ2FwOiA0cHg7XHJcbiAgICAgIG1hcmdpbi10b3A6IDNweDtcclxuICAgIH1cclxuXHJcbiAgICAubXNnLXRpbWUge1xyXG4gICAgICBmb250LXNpemU6IDEwcHg7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDIxOCwgMjI0LCAyNTAsIDAuNjYpO1xyXG4gICAgfVxyXG5cclxuICAgIC5tZXNzYWdlLWJ1YmJsZS1yb3cub3RoZXIgLm1zZy10aW1lIHtcclxuICAgICAgY29sb3I6IHJnYmEoMjE2LCAyMjMsIDI0NiwgMC41OCk7XHJcbiAgICB9XHJcblxyXG4gICAgLnJlYWQtaWNvbiB7XHJcbiAgICAgIGZvbnQtc2l6ZTogMTRweDtcclxuICAgICAgd2lkdGg6IDE0cHg7XHJcbiAgICAgIGhlaWdodDogMTRweDtcclxuICAgICAgb3BhY2l0eTogMC43O1xyXG4gICAgfVxyXG5cclxuICAgIC5yZWFkLWljb24ucmVhZCB7XHJcbiAgICAgIGNvbG9yOiAjNjBhNWZhO1xyXG4gICAgICBvcGFjaXR5OiAxO1xyXG4gICAgfVxyXG5cclxuICAgIC5yZWFkLWljb24udW5yZWFkIHtcclxuICAgICAgY29sb3I6IHJnYmEoMjE4LCAyMjQsIDI1MCwgMC41KTtcclxuICAgICAgb3BhY2l0eTogMTtcclxuICAgIH1cclxuXHJcbiAgICAucmVwbHktbWVzc2FnZS1idG4ge1xyXG4gICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XHJcbiAgICAgIHJpZ2h0OiAtMTBweDtcclxuICAgICAgYm90dG9tOiAtMTBweDtcclxuICAgICAgd2lkdGg6IDI0cHg7XHJcbiAgICAgIGhlaWdodDogMjRweDtcclxuICAgICAgYm9yZGVyOiAxcHggc29saWQgcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjE2KTtcclxuICAgICAgYm9yZGVyLXJhZGl1czogOTk5cHg7XHJcbiAgICAgIGJhY2tncm91bmQ6ICMwNzFkMzA7XHJcbiAgICAgIGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNzgpO1xyXG4gICAgICBkaXNwbGF5OiBpbmxpbmUtZmxleDtcclxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XHJcbiAgICAgIHBhZGRpbmc6IDA7XHJcbiAgICAgIGN1cnNvcjogcG9pbnRlcjtcclxuICAgICAgb3BhY2l0eTogMDtcclxuICAgICAgdHJhbnNmb3JtOiBzY2FsZSgwLjkyKTtcclxuICAgICAgdHJhbnNpdGlvbjogb3BhY2l0eSAwLjEycywgdHJhbnNmb3JtIDAuMTJzLCBiYWNrZ3JvdW5kIDAuMTJzLCBjb2xvciAwLjEycztcclxuICAgICAgei1pbmRleDogMztcclxuICAgIH1cclxuXHJcbiAgICAubWVzc2FnZS1idWJibGU6aG92ZXIgLnJlcGx5LW1lc3NhZ2UtYnRuLFxyXG4gICAgLnJlcGx5LW1lc3NhZ2UtYnRuOmZvY3VzIHtcclxuICAgICAgb3BhY2l0eTogMTtcclxuICAgICAgdHJhbnNmb3JtOiBzY2FsZSgxKTtcclxuICAgIH1cclxuXHJcbiAgICAucmVwbHktbWVzc2FnZS1idG46aG92ZXIge1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDEyNywgMTgwLCAyNTUsIDAuMjIpO1xyXG4gICAgICBjb2xvcjogI2ZmZjtcclxuICAgIH1cclxuXHJcbiAgICAucmVwbHktbWVzc2FnZS1idG4gbWF0LWljb24ge1xyXG4gICAgICBmb250LXNpemU6IDE1cHg7XHJcbiAgICAgIHdpZHRoOiAxNXB4O1xyXG4gICAgICBoZWlnaHQ6IDE1cHg7XHJcbiAgICAgIGxpbmUtaGVpZ2h0OiAxNXB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5xdWljay1yZWFjdGlvbnMge1xyXG4gICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XHJcbiAgICAgIHRvcDogLTE4cHg7XHJcbiAgICAgIHJpZ2h0OiAwO1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBnYXA6IDRweDtcclxuICAgICAgcGFkZGluZzogM3B4IDVweDtcclxuICAgICAgYmFja2dyb3VuZDogIzA3MWQzMDtcclxuICAgICAgYm9yZGVyOiAxcHggc29saWQgcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjE0KTtcclxuICAgICAgYm9yZGVyLXJhZGl1czogOTk5cHg7XHJcbiAgICAgIGJveC1zaGFkb3c6IDAgNnB4IDE0cHggcmdiYSgwLCAwLCAwLCAwLjI4KTtcclxuICAgICAgei1pbmRleDogNDtcclxuICAgIH1cclxuXHJcbiAgICAvKiBSZWNlaXZlZCBtZXNzYWdlcyBzaXQgb24gdGhlIGxlZnQsIHNvIGdyb3cgdGhlIHBpY2tlciByaWdodHdhcmQuXHJcbiAgICAgICBPd24gbWVzc2FnZXMgc2l0IG9uIHRoZSByaWdodCwgc28gZ3JvdyB0aGUgcGlja2VyIGxlZnR3YXJkLiAqL1xyXG4gICAgLm1lc3NhZ2UtYnViYmxlLXJvdy5vdGhlciAucXVpY2stcmVhY3Rpb25zIHtcclxuICAgICAgbGVmdDogMDtcclxuICAgICAgcmlnaHQ6IGF1dG87XHJcbiAgICB9XHJcblxyXG4gICAgLm1lc3NhZ2UtYnViYmxlLXJvdy5vd24gLnF1aWNrLXJlYWN0aW9ucyB7XHJcbiAgICAgIGxlZnQ6IGF1dG87XHJcbiAgICAgIHJpZ2h0OiAwO1xyXG4gICAgfVxyXG5cclxuICAgIC5xdWljay1lbW9qaS1idG4ge1xyXG4gICAgICB3aWR0aDogMjBweDtcclxuICAgICAgaGVpZ2h0OiAyMHB4O1xyXG4gICAgICBib3JkZXI6IG5vbmU7XHJcbiAgICAgIGJvcmRlci1yYWRpdXM6IDk5OXB4O1xyXG4gICAgICBiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudDtcclxuICAgICAgY29sb3I6ICNmZmY7XHJcbiAgICAgIGRpc3BsYXk6IGlubGluZS1mbGV4O1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcclxuICAgICAgZm9udC1zaXplOiAxM3B4O1xyXG4gICAgICBsaW5lLWhlaWdodDogMTtcclxuICAgICAgY3Vyc29yOiBwb2ludGVyO1xyXG4gICAgICBwYWRkaW5nOiAwO1xyXG4gICAgICB0cmFuc2l0aW9uOiB0cmFuc2Zvcm0gMC4xMnMgZWFzZSwgYmFja2dyb3VuZCAwLjEycyBlYXNlO1xyXG4gICAgfVxyXG5cclxuICAgIC5xdWljay1lbW9qaS1idG46aG92ZXIge1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMTgpO1xyXG4gICAgICB0cmFuc2Zvcm06IHNjYWxlKDEuMTQpO1xyXG4gICAgfVxyXG5cclxuICAgIC5yZWFjdGlvbnMtcm93IHtcclxuICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgZmxleC13cmFwOiB3cmFwO1xyXG4gICAgICBnYXA6IDNweDtcclxuICAgICAgbWFyZ2luLXRvcDogNXB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5yZWFjdGlvbi1jaGlwIHtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsMjU1LDI1NSwwLjA4KTtcclxuICAgICAgYm9yZGVyOiAxcHggc29saWQgcmdiYSgyNTUsMjU1LDI1NSwwLjIpO1xyXG4gICAgICBib3JkZXItcmFkaXVzOiA5OTlweDtcclxuICAgICAgcGFkZGluZzogMnB4IDdweDtcclxuICAgICAgZm9udC1zaXplOiAxMXB4O1xyXG4gICAgICBjb2xvcjogI2YyZjZmZjtcclxuICAgICAgY3Vyc29yOiBwb2ludGVyO1xyXG4gICAgICB0cmFuc2l0aW9uOiBhbGwgMC4ycztcclxuICAgICAgZGlzcGxheTogaW5saW5lLWZsZXg7XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgIGdhcDogM3B4O1xyXG4gICAgICBtYXgtd2lkdGg6IDE4MHB4O1xyXG4gICAgfVxyXG5cclxuICAgIC5yZWFjdGlvbi1jaGlwOmhvdmVyIHtcclxuICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsMjU1LDI1NSwwLjI1KTtcclxuICAgICAgdHJhbnNmb3JtOiBzY2FsZSgxLjA1KTtcclxuICAgIH1cclxuXHJcbiAgICAucmVhY3Rpb24tY2hpcC5vd24tcmVhY3Rpb24ge1xyXG4gICAgICBiYWNrZ3JvdW5kOiByZ2JhKDQyLDkxLDI1NSwwLjMpO1xyXG4gICAgICBib3JkZXItY29sb3I6IHJnYmEoNDIsOTEsMjU1LDAuNSk7XHJcbiAgICB9XHJcblxyXG4gICAgLmVtcHR5LWNoYXQge1xyXG4gICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xyXG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcclxuICAgICAgZmxleDogMTtcclxuICAgICAgY29sb3I6ICM5Y2EzYWY7XHJcbiAgICB9XHJcblxyXG4gICAgLmVtcHR5LWNoYXQgbWF0LWljb24ge1xyXG4gICAgICBmb250LXNpemU6IDQ4cHg7XHJcbiAgICAgIHdpZHRoOiA0OHB4O1xyXG4gICAgICBoZWlnaHQ6IDQ4cHg7XHJcbiAgICAgIG1hcmdpbi1ib3R0b206IDhweDtcclxuICAgIH1cclxuXHJcbiAgICAuZW1wdHktY2hhdCBwIHtcclxuICAgICAgZm9udC1zaXplOiAxNHB4O1xyXG4gICAgICBtYXJnaW46IDA7XHJcbiAgICB9XHJcbiAgYF0sXHJcbn0pXHJcbmV4cG9ydCBjbGFzcyBDaGF0VGhyZWFkQ29tcG9uZW50IGltcGxlbWVudHMgT25Jbml0LCBPbkRlc3Ryb3ksIEFmdGVyVmlld0NoZWNrZWQge1xyXG4gIEBWaWV3Q2hpbGQoJ3Njcm9sbENvbnRhaW5lcicpIHNjcm9sbENvbnRhaW5lciE6IEVsZW1lbnRSZWY7XHJcbiAgQFZpZXdDaGlsZChNZXNzYWdlSW5wdXRDb21wb25lbnQpIG1lc3NhZ2VJbnB1dD86IE1lc3NhZ2VJbnB1dENvbXBvbmVudDtcclxuICBAT3V0cHV0KCkgbGlnaHRib3hPcGVuID0gbmV3IEV2ZW50RW1pdHRlcjxzdHJpbmc+KCk7XHJcblxyXG4gIG1lc3NhZ2VzOiBNZXNzYWdlW10gPSBbXTtcclxuICB2aXNpYmxlQ29udGFjdHM6IENvbnRhY3RbXSA9IFtdO1xyXG4gIGNvbnZlcnNhdGlvbk5hbWUgPSAnJztcclxuICBpc0dyb3VwID0gZmFsc2U7XHJcbiAgaXNSZW1vdmVkRnJvbUdyb3VwID0gZmFsc2U7XHJcbiAgbWVzc2FnZVRleHRTY2FsZSA9IDE7XHJcbiAgY29kZVRleHRTY2FsZSA9IDE7XHJcbiAgbG9hZGluZyA9IGZhbHNlO1xyXG4gIG15Q29udGFjdElkOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcclxuICByZXBseVRvTWVzc2FnZTogTWVzc2FnZSB8IG51bGwgPSBudWxsO1xyXG4gIG1lbnRpb25PcHRpb25zOiBNZW50aW9uT3B0aW9uW10gPSBbXTtcclxuXHJcbiAgY29udmVyc2F0aW9uSWQ6IHN0cmluZyB8IG51bGwgPSBudWxsO1xyXG4gIHByaXZhdGUgc3ViITogU3Vic2NyaXB0aW9uO1xyXG4gIHByaXZhdGUgc2hvdWxkU2Nyb2xsVG9Cb3R0b20gPSB0cnVlO1xyXG5cclxuICB1cGxvYWRpbmcgPSBmYWxzZTtcclxuICBob3ZlcmVkTWVzc2FnZUlkOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcclxuICBxdWlja0Vtb2ppcyA9IFsn4p2k77iPJywgJ/CfkY0nLCAn8J+YgicsICfwn5iuJywgJ/CfmKInLCAn8J+UpSddO1xyXG4gIHRocmVhZERyYWdPdmVyID0gZmFsc2U7XHJcbiAgcHJpdmF0ZSB0aHJlYWREcmFnRGVwdGggPSAwO1xyXG4gIHByaXZhdGUgYm91bmRSZXNldFRocmVhZERyYWcgPSB0aGlzLnJlc2V0VGhyZWFkRHJhZy5iaW5kKHRoaXMpO1xyXG5cclxuICAvKiogVHJhY2tzIHdoaWNoIGZpbGUgSURzIGFyZSBjdXJyZW50bHkgYmVpbmcgZmV0Y2hlZCB0byBhdm9pZCBkdXBsaWNhdGUgcmVxdWVzdHMgKi9cclxuICBwcml2YXRlIG1lZGlhTG9hZGluZyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xyXG4gIC8qKiBUcmFja3MgZmlsZSBJRHMgd2hlcmUgcmV0cmlldmFsIGZhaWxlZCBzbyBVSSBkb2Vzbid0IHNwaW4gZm9yZXZlci4gKi9cclxuICBwcml2YXRlIG1lZGlhRmFpbGVkID0gbmV3IFNldDxzdHJpbmc+KCk7XHJcbiAgcHJpdmF0ZSBtZWRpYVF1ZXVlOiBzdHJpbmdbXSA9IFtdO1xyXG4gIHByaXZhdGUgYWN0aXZlTWVkaWFSZXF1ZXN0cyA9IDA7XHJcbiAgcHJpdmF0ZSByZWFkb25seSBtYXhNZWRpYVJlcXVlc3RzID0gMjtcclxuICBwcml2YXRlIGxhc3RNZW50aW9uQ29udmVyc2F0aW9uSWQ6IHN0cmluZyB8IG51bGwgPSBudWxsO1xyXG5cclxuICBjb25zdHJ1Y3RvcihcclxuICAgIHByaXZhdGUgc3RvcmU6IE1lc3NhZ2luZ1N0b3JlU2VydmljZSxcclxuICAgIHByaXZhdGUgYXBpOiBNZXNzYWdpbmdBcGlTZXJ2aWNlLFxyXG4gICAgcHJpdmF0ZSBhdXRoOiBBdXRoU2VydmljZSxcclxuICAgIHByaXZhdGUgZmlsZVNlcnZpY2U6IE1lc3NhZ2luZ0ZpbGVTZXJ2aWNlLFxyXG4gICAgcHJpdmF0ZSBjZHI6IENoYW5nZURldGVjdG9yUmVmLFxyXG4gICAgcHJpdmF0ZSBzYW5pdGl6ZXI6IERvbVNhbml0aXplcixcclxuICApIHt9XHJcblxyXG4gIG5nT25Jbml0KCk6IHZvaWQge1xyXG4gICAgdGhpcy5teUNvbnRhY3RJZCA9IHRoaXMuYXV0aC5jb250YWN0SWQ7XHJcbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdkcm9wJywgdGhpcy5ib3VuZFJlc2V0VGhyZWFkRHJhZywgdHJ1ZSk7XHJcbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdkcmFnZW5kJywgdGhpcy5ib3VuZFJlc2V0VGhyZWFkRHJhZywgdHJ1ZSk7XHJcblxyXG4gICAgdGhpcy5zdWIgPSBjb21iaW5lTGF0ZXN0KFtcclxuICAgICAgdGhpcy5zdG9yZS5hY3RpdmVDb252ZXJzYXRpb25JZCxcclxuICAgICAgdGhpcy5zdG9yZS5tZXNzYWdlc01hcCxcclxuICAgICAgdGhpcy5zdG9yZS5vcGVuQ2hhdHMsXHJcbiAgICAgIHRoaXMuc3RvcmUudmlzaWJsZUNvbnRhY3RzLFxyXG4gICAgICB0aGlzLnN0b3JlLmxvYWRpbmdNZXNzYWdlcyxcclxuICAgICAgdGhpcy5zdG9yZS5yZW1vdmVkR3JvdXBJZHMsXHJcbiAgICAgIHRoaXMuc3RvcmUubWVzc2FnZVRleHRTY2FsZSxcclxuICAgICAgdGhpcy5zdG9yZS5jb2RlVGV4dFNjYWxlLFxyXG4gICAgXSkuc3Vic2NyaWJlKChbY29udklkLCBtc2dNYXAsIGNoYXRzLCBjb250YWN0cywgbG9hZGluZywgcmVtb3ZlZEdyb3VwSWRzLCBtZXNzYWdlVGV4dFNjYWxlLCBjb2RlVGV4dFNjYWxlXSkgPT4ge1xyXG4gICAgICB0aGlzLmxvYWRpbmcgPSBsb2FkaW5nO1xyXG4gICAgICB0aGlzLnZpc2libGVDb250YWN0cyA9IGNvbnRhY3RzIHx8IFtdO1xyXG4gICAgICB0aGlzLm1lc3NhZ2VUZXh0U2NhbGUgPSBtZXNzYWdlVGV4dFNjYWxlO1xyXG4gICAgICB0aGlzLmNvZGVUZXh0U2NhbGUgPSBjb2RlVGV4dFNjYWxlO1xyXG4gICAgICBpZiAodGhpcy5pc0dyb3VwICYmIHRoaXMuY29udmVyc2F0aW9uSWQgJiYgdGhpcy5tZW50aW9uT3B0aW9ucy5sZW5ndGggPT09IDApIHtcclxuICAgICAgICB0aGlzLnJlZnJlc2hNZW50aW9uT3B0aW9ucygpO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBpZiAoY29udklkICYmIGNvbnZJZCAhPT0gdGhpcy5jb252ZXJzYXRpb25JZCkge1xyXG4gICAgICAgIHRoaXMuY29udmVyc2F0aW9uSWQgPSBjb252SWQ7XHJcbiAgICAgICAgdGhpcy5yZXNldE1lZGlhUXVldWUoKTtcclxuICAgICAgICB0aGlzLmNsZWFyUmVwbHkoKTtcclxuICAgICAgICB0aGlzLnNob3VsZFNjcm9sbFRvQm90dG9tID0gdHJ1ZTtcclxuICAgICAgICBjb25zdCBjaGF0ID0gY2hhdHMuZmluZCgoYykgPT4gYy5jb252ZXJzYXRpb25JZCA9PT0gY29udklkKTtcclxuICAgICAgICB0aGlzLmNvbnZlcnNhdGlvbk5hbWUgPSBjaGF0Py5uYW1lIHx8ICdDaGF0JztcclxuICAgICAgICB0aGlzLmlzR3JvdXAgPSBjaGF0Py5pc0dyb3VwIHx8IGZhbHNlO1xyXG4gICAgICAgIHRoaXMucmVmcmVzaE1lbnRpb25PcHRpb25zKCk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGlmICh0aGlzLmNvbnZlcnNhdGlvbklkKSB7XHJcbiAgICAgICAgY29uc3QgcHJldkxlbiA9IHRoaXMubWVzc2FnZXMubGVuZ3RoO1xyXG4gICAgICAgIHRoaXMubWVzc2FnZXMgPSBtc2dNYXAuZ2V0KHRoaXMuY29udmVyc2F0aW9uSWQpIHx8IFtdO1xyXG4gICAgICAgIGlmICh0aGlzLm1lc3NhZ2VzLmxlbmd0aCA+IHByZXZMZW4pIHtcclxuICAgICAgICAgIHRoaXMuc2hvdWxkU2Nyb2xsVG9Cb3R0b20gPSB0cnVlO1xyXG4gICAgICAgIH1cclxuICAgICAgICAvLyBQcmUtd2FybSBtZWRpYSBjYWNoZSBmb3IgYW55IGltYWdlL2ZpbGUgbWVzc2FnZXMgdmlzaWJsZVxyXG4gICAgICAgIHRoaXMucHJld2FybU1lZGlhKHRoaXMubWVzc2FnZXMpO1xyXG4gICAgICB9XHJcbiAgICAgIHRoaXMuaXNSZW1vdmVkRnJvbUdyb3VwID0gISF0aGlzLmNvbnZlcnNhdGlvbklkICYmIHJlbW92ZWRHcm91cElkcy5oYXMoU3RyaW5nKHRoaXMuY29udmVyc2F0aW9uSWQpKTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgbmdBZnRlclZpZXdDaGVja2VkKCk6IHZvaWQge1xyXG4gICAgaWYgKHRoaXMuc2hvdWxkU2Nyb2xsVG9Cb3R0b20pIHtcclxuICAgICAgdGhpcy5zY3JvbGxUb0JvdHRvbSgpO1xyXG4gICAgICB0aGlzLnNob3VsZFNjcm9sbFRvQm90dG9tID0gZmFsc2U7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBuZ09uRGVzdHJveSgpOiB2b2lkIHtcclxuICAgIHRoaXMuc3ViPy51bnN1YnNjcmliZSgpO1xyXG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignZHJvcCcsIHRoaXMuYm91bmRSZXNldFRocmVhZERyYWcsIHRydWUpO1xyXG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignZHJhZ2VuZCcsIHRoaXMuYm91bmRSZXNldFRocmVhZERyYWcsIHRydWUpO1xyXG4gIH1cclxuXHJcbiAgZ29CYWNrKCk6IHZvaWQge1xyXG4gICAgdGhpcy5zdG9yZS5zZXRWaWV3KCdpbmJveCcpO1xyXG4gIH1cclxuXHJcbiAgb25DbGVhckNvbnZlcnNhdGlvbigpOiB2b2lkIHtcclxuICAgIGlmICh0aGlzLmNvbnZlcnNhdGlvbklkKSB7XHJcbiAgICAgIHRoaXMuc3RvcmUuY2xlYXJDb252ZXJzYXRpb24odGhpcy5jb252ZXJzYXRpb25JZCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBvbkRlbGV0ZUNvbnZlcnNhdGlvbigpOiB2b2lkIHtcclxuICAgIGlmICh0aGlzLmNvbnZlcnNhdGlvbklkKSB7XHJcbiAgICAgIHRoaXMuc3RvcmUuZGVsZXRlQ29udmVyc2F0aW9uKHRoaXMuY29udmVyc2F0aW9uSWQpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgb25Hcm91cFNldHRpbmdzKCk6IHZvaWQge1xyXG4gICAgaWYgKHRoaXMuaXNSZW1vdmVkRnJvbUdyb3VwKSByZXR1cm47XHJcbiAgICBpZiAodGhpcy5jb252ZXJzYXRpb25JZCkge1xyXG4gICAgICB0aGlzLnN0b3JlLm9wZW5Hcm91cFNldHRpbmdzKHRoaXMuY29udmVyc2F0aW9uSWQsIHRoaXMuY29udmVyc2F0aW9uTmFtZSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBzdGFydFJlcGx5KG1lc3NhZ2U6IE1lc3NhZ2UsIGV2ZW50PzogRXZlbnQpOiB2b2lkIHtcclxuICAgIGV2ZW50Py5zdG9wUHJvcGFnYXRpb24oKTtcclxuICAgIGlmICghdGhpcy5pc0dyb3VwIHx8IHRoaXMuaXNTeXN0ZW1NZXNzYWdlKG1lc3NhZ2UpKSByZXR1cm47XHJcbiAgICB0aGlzLnJlcGx5VG9NZXNzYWdlID0gbWVzc2FnZTtcclxuICAgIHRoaXMubWVzc2FnZUlucHV0Py5mb2N1cygpO1xyXG4gIH1cclxuXHJcbiAgY2xlYXJSZXBseSgpOiB2b2lkIHtcclxuICAgIHRoaXMucmVwbHlUb01lc3NhZ2UgPSBudWxsO1xyXG4gIH1cclxuXHJcbiAgZ2V0UmVwbHlQcmV2aWV3KG1lc3NhZ2U6IE1lc3NhZ2UpOiBSZXBseVByZXZpZXcgfCBudWxsIHtcclxuICAgIGNvbnN0IHJlcGx5ID0gbWVzc2FnZS5yZXBseV90bztcclxuICAgIGlmICghcmVwbHkpIHJldHVybiBudWxsO1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgc2VuZGVyTmFtZTogcmVwbHkuc2VuZGVyX25hbWUgfHwgJ01lc3NhZ2UnLFxyXG4gICAgICBjb250ZW50OiB0aGlzLnRydW5jYXRlUmVwbHlUZXh0KHJlcGx5LmNvbnRlbnQgfHwgJ0F0dGFjaG1lbnQnKSxcclxuICAgIH07XHJcbiAgfVxyXG5cclxuICBnZXRDb21wb3NlUmVwbHlQcmV2aWV3KG1lc3NhZ2U6IE1lc3NhZ2UpOiBSZXBseVByZXZpZXcge1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgc2VuZGVyTmFtZTogdGhpcy5nZXRTZW5kZXJOYW1lKG1lc3NhZ2UpLFxyXG4gICAgICBjb250ZW50OiB0aGlzLnRydW5jYXRlUmVwbHlUZXh0KHRoaXMuZ2V0TWVzc2FnZUJvZHkobWVzc2FnZSkgfHwgdGhpcy5nZXRBdHRhY2htZW50TmFtZShtZXNzYWdlKSksXHJcbiAgICB9O1xyXG4gIH1cclxuXHJcbiAgZ2V0TWVzc2FnZUJvZHkobWVzc2FnZTogTWVzc2FnZSk6IHN0cmluZyB7XHJcbiAgICByZXR1cm4gU3RyaW5nKG1lc3NhZ2UuY29udGVudCB8fCAnJyk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHRydW5jYXRlUmVwbHlUZXh0KHZhbHVlOiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gICAgY29uc3QgdGV4dCA9IFN0cmluZyh2YWx1ZSB8fCAnJykucmVwbGFjZSgvXFxzKy9nLCAnICcpLnRyaW0oKTtcclxuICAgIHJldHVybiB0ZXh0Lmxlbmd0aCA+IDEyMCA/IGAke3RleHQuc2xpY2UoMCwgMTE3KX0uLi5gIDogdGV4dCB8fCAnQXR0YWNobWVudCc7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHJlZnJlc2hNZW50aW9uT3B0aW9ucygpOiB2b2lkIHtcclxuICAgIGlmICghdGhpcy5pc0dyb3VwIHx8ICF0aGlzLmNvbnZlcnNhdGlvbklkKSB7XHJcbiAgICAgIHRoaXMubWVudGlvbk9wdGlvbnMgPSBbXTtcclxuICAgICAgdGhpcy5sYXN0TWVudGlvbkNvbnZlcnNhdGlvbklkID0gbnVsbDtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGNvbnZJZCA9IHRoaXMuY29udmVyc2F0aW9uSWQ7XHJcbiAgICBpZiAodGhpcy5sYXN0TWVudGlvbkNvbnZlcnNhdGlvbklkID09PSBjb252SWQgJiYgdGhpcy5tZW50aW9uT3B0aW9ucy5sZW5ndGggPiAwKSByZXR1cm47XHJcbiAgICB0aGlzLmxhc3RNZW50aW9uQ29udmVyc2F0aW9uSWQgPSBjb252SWQ7XHJcblxyXG4gICAgdGhpcy5hcGkuZ2V0Q29udmVyc2F0aW9uUGFydGljaXBhbnRzKGNvbnZJZCkuc3Vic2NyaWJlKHtcclxuICAgICAgbmV4dDogKG1lbWJlcnMpID0+IHtcclxuICAgICAgICBjb25zdCBvcHRpb25zID0gbWVtYmVyc1xyXG4gICAgICAgICAgLmZpbHRlcigobWVtYmVyKSA9PiBTdHJpbmcobWVtYmVyLmNvbnRhY3RfaWQpICE9PSBTdHJpbmcodGhpcy5hdXRoLmNvbnRhY3RJZCB8fCAnJykpXHJcbiAgICAgICAgICAubWFwKChtZW1iZXIpID0+IHRoaXMucGFydGljaXBhbnRUb01lbnRpb25PcHRpb24obWVtYmVyKSlcclxuICAgICAgICAgIC5maWx0ZXIoKG9wdGlvbik6IG9wdGlvbiBpcyBNZW50aW9uT3B0aW9uID0+ICEhb3B0aW9uKTtcclxuICAgICAgICB0aGlzLm1lbnRpb25PcHRpb25zID0gb3B0aW9ucy5sZW5ndGggPyBvcHRpb25zIDogdGhpcy5jb250YWN0c1RvTWVudGlvbk9wdGlvbnMoKTtcclxuICAgICAgICB0aGlzLmNkci5tYXJrRm9yQ2hlY2soKTtcclxuICAgICAgfSxcclxuICAgICAgZXJyb3I6ICgpID0+IHtcclxuICAgICAgICB0aGlzLm1lbnRpb25PcHRpb25zID0gdGhpcy5jb250YWN0c1RvTWVudGlvbk9wdGlvbnMoKTtcclxuICAgICAgICB0aGlzLmNkci5tYXJrRm9yQ2hlY2soKTtcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBwYXJ0aWNpcGFudFRvTWVudGlvbk9wdGlvbihtZW1iZXI6IENvbnZlcnNhdGlvblBhcnRpY2lwYW50KTogTWVudGlvbk9wdGlvbiB8IG51bGwge1xyXG4gICAgY29uc3QgdG9rZW4gPSB0aGlzLnRvTWVudGlvblRva2VuKG1lbWJlci51c2VybmFtZSB8fCBtZW1iZXIuZW1haWwgfHwgU3RyaW5nKG1lbWJlci5jb250YWN0X2lkKSk7XHJcbiAgICBpZiAoIXRva2VuKSByZXR1cm4gbnVsbDtcclxuICAgIHJldHVybiB7XHJcbiAgICAgIGNvbnRhY3RJZDogU3RyaW5nKG1lbWJlci5jb250YWN0X2lkKSxcclxuICAgICAgbGFiZWw6IG1lbWJlci51c2VybmFtZSB8fCBtZW1iZXIuZW1haWwgfHwgYENvbnRhY3QgJHttZW1iZXIuY29udGFjdF9pZH1gLFxyXG4gICAgICB0b2tlbixcclxuICAgIH07XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGNvbnRhY3RzVG9NZW50aW9uT3B0aW9ucygpOiBNZW50aW9uT3B0aW9uW10ge1xyXG4gICAgcmV0dXJuIHRoaXMudmlzaWJsZUNvbnRhY3RzXHJcbiAgICAgIC5maWx0ZXIoKGNvbnRhY3QpID0+IFN0cmluZyhjb250YWN0LmNvbnRhY3RfaWQpICE9PSBTdHJpbmcodGhpcy5hdXRoLmNvbnRhY3RJZCB8fCAnJykpXHJcbiAgICAgIC5tYXAoKGNvbnRhY3QpID0+IHtcclxuICAgICAgICBjb25zdCBsYWJlbCA9IGdldENvbnRhY3REaXNwbGF5TmFtZShjb250YWN0KTtcclxuICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgY29udGFjdElkOiBTdHJpbmcoY29udGFjdC5jb250YWN0X2lkKSxcclxuICAgICAgICAgIGxhYmVsLFxyXG4gICAgICAgICAgdG9rZW46IHRoaXMudG9NZW50aW9uVG9rZW4oY29udGFjdC51c2VybmFtZSB8fCBjb250YWN0LmVtYWlsPy5zcGxpdCgnQCcpWzBdIHx8IGxhYmVsKSxcclxuICAgICAgICB9O1xyXG4gICAgICB9KVxyXG4gICAgICAuZmlsdGVyKChvcHRpb24pID0+ICEhb3B0aW9uLnRva2VuKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgdG9NZW50aW9uVG9rZW4odmFsdWU6IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgICByZXR1cm4gU3RyaW5nKHZhbHVlIHx8ICcnKVxyXG4gICAgICAudHJpbSgpXHJcbiAgICAgIC5yZXBsYWNlKC9eQC8sICcnKVxyXG4gICAgICAucmVwbGFjZSgvQC4qJC8sICcnKVxyXG4gICAgICAucmVwbGFjZSgvW15hLXpBLVowLTkuXy1dL2csICcnKVxyXG4gICAgICAuc2xpY2UoMCwgMzIpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBnZXRNZW50aW9uSWRzRnJvbUNvbnRlbnQoY29udGVudDogc3RyaW5nKTogc3RyaW5nW10ge1xyXG4gICAgaWYgKCF0aGlzLmlzR3JvdXAgfHwgIWNvbnRlbnQgfHwgIXRoaXMubWVudGlvbk9wdGlvbnMubGVuZ3RoKSByZXR1cm4gW107XHJcbiAgICBjb25zdCBtZW50aW9uZWRUb2tlbnMgPSBuZXcgU2V0KFxyXG4gICAgICBBcnJheS5mcm9tKGNvbnRlbnQubWF0Y2hBbGwoLyhefFteYS16QS1aMC05Ll8tXSlAKFthLXpBLVowLTkuXy1dKykvZykpXHJcbiAgICAgICAgLm1hcCgobWF0Y2gpID0+IG1hdGNoWzJdLnRvTG93ZXJDYXNlKCkpXHJcbiAgICApO1xyXG4gICAgcmV0dXJuIHRoaXMubWVudGlvbk9wdGlvbnNcclxuICAgICAgLmZpbHRlcigob3B0aW9uKSA9PiBtZW50aW9uZWRUb2tlbnMuaGFzKG9wdGlvbi50b2tlbi50b0xvd2VyQ2FzZSgpKSlcclxuICAgICAgLm1hcCgob3B0aW9uKSA9PiBvcHRpb24uY29udGFjdElkKTtcclxuICB9XHJcblxyXG4gIG9uU2VuZE1lc3NhZ2UoY29udGVudDogc3RyaW5nKTogdm9pZCB7XHJcbiAgICBpZiAodGhpcy5pc1JlbW92ZWRGcm9tR3JvdXApIHJldHVybjtcclxuICAgIGNvbnN0IG1lbnRpb25zID0gdGhpcy5nZXRNZW50aW9uSWRzRnJvbUNvbnRlbnQoY29udGVudCk7XHJcbiAgICB0aGlzLnN0b3JlLnNlbmRNZXNzYWdlKHRoaXMuY29udmVyc2F0aW9uSWQsIGNvbnRlbnQsICdURVhUJywge1xyXG4gICAgICByZXBseVRvOiB0aGlzLnJlcGx5VG9NZXNzYWdlLFxyXG4gICAgICBtZW50aW9ucyxcclxuICAgIH0pO1xyXG4gICAgdGhpcy5jbGVhclJlcGx5KCk7XHJcbiAgICB0aGlzLnNob3VsZFNjcm9sbFRvQm90dG9tID0gdHJ1ZTtcclxuICB9XHJcblxyXG4gIG9uU2VuZFdpdGhGaWxlcyhwYXlsb2FkOiBNZXNzYWdlUGF5bG9hZCk6IHZvaWQge1xyXG4gICAgaWYgKHRoaXMuaXNSZW1vdmVkRnJvbUdyb3VwKSByZXR1cm47XHJcbiAgICBpZiAoIXRoaXMuY29udmVyc2F0aW9uSWQgfHwgIXRoaXMuYXV0aC5jb250YWN0SWQpIHJldHVybjtcclxuICAgIHRoaXMudXBsb2FkaW5nID0gdHJ1ZTtcclxuXHJcbiAgICAvLyBTdGVwIDE6IFVwbG9hZCBhbGwgZmlsZXMgYW5kIG9idGFpbiByZWFsIGZpbGVfaWRzIGZyb20gdGhlIHNlcnZlci5cclxuICAgIC8vIFRlbXAgSURzIGFyZSBORVZFUiBzZW50IHRvIGFueSBBUEkg4oCUIHdlIHdhaXQgZm9yIHJlYWwgSURzIGhlcmUuXHJcbiAgICB0aGlzLmZpbGVTZXJ2aWNlLnVwbG9hZEZpbGVzKHBheWxvYWQuZmlsZXMpLnN1YnNjcmliZSh7XHJcbiAgICAgIG5leHQ6IChyZXNwb25zZXMpID0+IHtcclxuICAgICAgICBjb25zdCBmaWxlSWRzICAgPSByZXNwb25zZXMubWFwKChyKSA9PiByLmZpbGVfaWQpO1xyXG4gICAgICAgIGNvbnN0IGZpbGVuYW1lcyA9IHJlc3BvbnNlcy5tYXAoKHIpID0+IHIuZmlsZW5hbWUpO1xyXG4gICAgICAgIGNvbnN0IG1pbWVUeXBlcyA9IHJlc3BvbnNlcy5tYXAoKHIsIGlkeCkgPT4gci5taW1lX3R5cGUgfHwgcGF5bG9hZC5maWxlc1tpZHhdPy50eXBlIHx8ICcnKTtcclxuXHJcbiAgICAgICAgLy8gR3VhcmQ6IGVuc3VyZSBhbGwgSURzIGFyZSByZWFsIChub3QgdGVtcClcclxuICAgICAgICBjb25zdCBoYXNUZW1wID0gZmlsZUlkcy5zb21lKGlkID0+IGlkPy5zdGFydHNXaXRoKCd0ZW1wLScpKTtcclxuICAgICAgICBpZiAoaGFzVGVtcCkge1xyXG4gICAgICAgICAgdGhpcy51cGxvYWRpbmcgPSBmYWxzZTtcclxuICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIFN0ZXAgMjogUHJlLXdhcm0gaW1hZ2UgY2FjaGUgc28gdGhlIG9wdGltaXN0aWMgYnViYmxlIHJlbmRlcnMgaW1tZWRpYXRlbHkuXHJcbiAgICAgICAgdGhpcy5maWxlU2VydmljZS5wcmV3YXJtQ2FjaGUoZmlsZUlkcyk7XHJcblxyXG4gICAgICAgIC8vIFN0ZXAgMzogU2VuZCB0aGUgbWVzc2FnZSB3aXRoIHRoZSByZWFsIGZpbGVfaWRzLlxyXG4gICAgICAgIGNvbnN0IG1lc3NhZ2VUZXh0ID0gcGF5bG9hZC50ZXh0IHx8IGZpbGVuYW1lcy5qb2luKCcsICcpO1xyXG4gICAgICAgIGNvbnN0IG91dGdvaW5nVGV4dCA9IHRoaXMuc3RvcmUucHJlcGFyZU91dGdvaW5nTWVzc2FnZUNvbnRlbnQobWVzc2FnZVRleHQsIHRoaXMucmVwbHlUb01lc3NhZ2UpO1xyXG4gICAgICAgIGNvbnN0IHJlcGx5VG8gPSB0aGlzLnJlcGx5VG9NZXNzYWdlID8ge1xyXG4gICAgICAgICAgbWVzc2FnZV9pZDogU3RyaW5nKHRoaXMucmVwbHlUb01lc3NhZ2UubWVzc2FnZV9pZCB8fCAnJyksXHJcbiAgICAgICAgICBzZW5kZXJfbmFtZTogdGhpcy5nZXRTZW5kZXJOYW1lKHRoaXMucmVwbHlUb01lc3NhZ2UpLFxyXG4gICAgICAgICAgY29udGVudDogdGhpcy50cnVuY2F0ZVJlcGx5VGV4dCh0aGlzLmdldE1lc3NhZ2VCb2R5KHRoaXMucmVwbHlUb01lc3NhZ2UpIHx8IHRoaXMuZ2V0QXR0YWNobWVudE5hbWUodGhpcy5yZXBseVRvTWVzc2FnZSkpLFxyXG4gICAgICAgIH0gOiB1bmRlZmluZWQ7XHJcbiAgICAgICAgY29uc3QgbWVudGlvbnMgPSB0aGlzLmdldE1lbnRpb25JZHNGcm9tQ29udGVudChtZXNzYWdlVGV4dCk7XHJcbiAgICAgICAgdGhpcy5maWxlU2VydmljZVxyXG4gICAgICAgICAgLnNlbmRNZXNzYWdlV2l0aEF0dGFjaG1lbnRzKFxyXG4gICAgICAgICAgICB0aGlzLmNvbnZlcnNhdGlvbklkISxcclxuICAgICAgICAgICAgdGhpcy5hdXRoLmNvbnRhY3RJZCEsXHJcbiAgICAgICAgICAgIG91dGdvaW5nVGV4dCxcclxuICAgICAgICAgICAgZmlsZUlkcyxcclxuICAgICAgICAgICAgZmlsZW5hbWVzLFxyXG4gICAgICAgICAgICBtaW1lVHlwZXNcclxuICAgICAgICAgIClcclxuICAgICAgICAgIC5zdWJzY3JpYmUoe1xyXG4gICAgICAgICAgICBuZXh0OiAocmVzOiBhbnkpID0+IHtcclxuICAgICAgICAgICAgICB0aGlzLnVwbG9hZGluZyA9IGZhbHNlO1xyXG4gICAgICAgICAgICAgIHRoaXMuc2hvdWxkU2Nyb2xsVG9Cb3R0b20gPSB0cnVlO1xyXG5cclxuICAgICAgICAgICAgICAvLyBBZGQgb3B0aW1pc3RpYyBtZXNzYWdlIHNvIHRoZSBpbWFnZSBhcHBlYXJzIGluc3RhbnRseSDigJRcclxuICAgICAgICAgICAgICAvLyB0aGUgV2ViU29ja2V0IGV2ZW50IG1heSBhcnJpdmUgYSBtb21lbnQgbGF0ZXIgYW5kIGRlZHVwIGl0LlxyXG4gICAgICAgICAgICAgIGNvbnN0IGZpcnN0SWQgPSBmaWxlSWRzWzBdIHx8ICcnO1xyXG4gICAgICAgICAgICAgIGNvbnN0IGlzSW1nID1cclxuICAgICAgICAgICAgICAgIChtaW1lVHlwZXNbMF0gfHwgJycpLnN0YXJ0c1dpdGgoJ2ltYWdlLycpIHx8XHJcbiAgICAgICAgICAgICAgICAvXFwuKHBuZ3xqcGU/Z3xnaWZ8d2VicHxibXB8c3ZnfGhlaWN8aGVpZikkL2kudGVzdChmaWxlbmFtZXNbMF0gfHwgJycpO1xyXG4gICAgICAgICAgICAgIGNvbnN0IG9wdGltaXN0aWM6IGFueSA9IHtcclxuICAgICAgICAgICAgICAgIG1lc3NhZ2VfaWQ6IHJlcz8ubWVzc2FnZV9pZCA/IFN0cmluZyhyZXMubWVzc2FnZV9pZCkgOiAndGVtcC0nICsgRGF0ZS5ub3coKSxcclxuICAgICAgICAgICAgICAgIGNvbnZlcnNhdGlvbl9pZDogdGhpcy5jb252ZXJzYXRpb25JZCEsXHJcbiAgICAgICAgICAgICAgICBzZW5kZXJfaWQ6IHRoaXMuYXV0aC5jb250YWN0SWQhLFxyXG4gICAgICAgICAgICAgICAgc2VuZGVyX25hbWU6ICdZb3UnLFxyXG4gICAgICAgICAgICAgICAgbWVzc2FnZV90eXBlOiBpc0ltZyA/ICdJTUFHRScgOiAnRklMRScsXHJcbiAgICAgICAgICAgICAgICBjb250ZW50OiBtZXNzYWdlVGV4dCxcclxuICAgICAgICAgICAgICAgIHJlcGx5X3RvOiByZXBseVRvLFxyXG4gICAgICAgICAgICAgICAgbWVudGlvbnMsXHJcbiAgICAgICAgICAgICAgICBtZWRpYV91cmw6IGZpcnN0SWQsXHJcbiAgICAgICAgICAgICAgICBjcmVhdGVkX2F0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXHJcbiAgICAgICAgICAgICAgICBpc19yZWFkOiBmYWxzZSxcclxuICAgICAgICAgICAgICAgIGF0dGFjaG1lbnRzOiBmaWxlSWRzLm1hcCgoaWQsIGlkeCkgPT4gKHtcclxuICAgICAgICAgICAgICAgICAgZmlsZV9pZDogaWQsXHJcbiAgICAgICAgICAgICAgICAgIGZpbGVuYW1lOiBmaWxlbmFtZXNbaWR4XSB8fCBmaWxlbmFtZXNbMF0gfHwgYEF0dGFjaG1lbnQgJHtpZHggKyAxfWAsXHJcbiAgICAgICAgICAgICAgICAgIG1pbWVfdHlwZTogbWltZVR5cGVzW2lkeF0gfHwgdW5kZWZpbmVkLFxyXG4gICAgICAgICAgICAgICAgICBzaXplX2J5dGVzOiBwYXlsb2FkLmZpbGVzW2lkeF0/LnNpemUsXHJcbiAgICAgICAgICAgICAgICAgIHVybDogcmVzcG9uc2VzW2lkeF0/LnVybCxcclxuICAgICAgICAgICAgICAgIH0pKSxcclxuICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICAgIHRoaXMuc3RvcmUuYXBwZW5kT3B0aW1pc3RpY01lc3NhZ2Uob3B0aW1pc3RpYyk7XHJcbiAgICAgICAgICAgICAgdGhpcy5jbGVhclJlcGx5KCk7XHJcbiAgICAgICAgICAgICAgdGhpcy5jZHIubWFya0ZvckNoZWNrKCk7XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIGVycm9yOiAoKSA9PiB7XHJcbiAgICAgICAgICAgICAgdGhpcy51cGxvYWRpbmcgPSBmYWxzZTtcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgIH0pO1xyXG4gICAgICB9LFxyXG4gICAgICBlcnJvcjogKCkgPT4ge1xyXG4gICAgICAgIHRoaXMudXBsb2FkaW5nID0gZmFsc2U7XHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIGxvYWRPbGRlcigpOiB2b2lkIHtcclxuICAgIGlmICh0aGlzLmNvbnZlcnNhdGlvbklkICYmIHRoaXMubWVzc2FnZXMubGVuZ3RoID4gMCkge1xyXG4gICAgICB0aGlzLnN0b3JlLmxvYWRNZXNzYWdlcyh0aGlzLmNvbnZlcnNhdGlvbklkLCB0aGlzLm1lc3NhZ2VzWzBdLm1lc3NhZ2VfaWQpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgb25TY3JvbGwoKTogdm9pZCB7fVxyXG5cclxuICBvblRocmVhZERyYWdFbnRlcihldmVudDogRHJhZ0V2ZW50KTogdm9pZCB7XHJcbiAgICBpZiAodGhpcy5pc1JlbW92ZWRGcm9tR3JvdXApIHJldHVybjtcclxuICAgIGlmICghdGhpcy5kcmFnSGFzRmlsZXMoZXZlbnQpKSByZXR1cm47XHJcbiAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XHJcbiAgICB0aGlzLnRocmVhZERyYWdEZXB0aCsrO1xyXG4gICAgdGhpcy50aHJlYWREcmFnT3ZlciA9IHRydWU7XHJcbiAgfVxyXG5cclxuICBvblRocmVhZERyYWdPdmVyKGV2ZW50OiBEcmFnRXZlbnQpOiB2b2lkIHtcclxuICAgIGlmICh0aGlzLmlzUmVtb3ZlZEZyb21Hcm91cCkgcmV0dXJuO1xyXG4gICAgaWYgKCF0aGlzLmRyYWdIYXNGaWxlcyhldmVudCkpIHJldHVybjtcclxuICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcclxuICAgIGlmIChldmVudC5kYXRhVHJhbnNmZXIpIHtcclxuICAgICAgZXZlbnQuZGF0YVRyYW5zZmVyLmRyb3BFZmZlY3QgPSAnY29weSc7XHJcbiAgICB9XHJcbiAgICB0aGlzLnRocmVhZERyYWdPdmVyID0gdHJ1ZTtcclxuICB9XHJcblxyXG4gIG9uVGhyZWFkRHJhZ0xlYXZlKGV2ZW50OiBEcmFnRXZlbnQpOiB2b2lkIHtcclxuICAgIGlmICghdGhpcy5kcmFnSGFzRmlsZXMoZXZlbnQpKSByZXR1cm47XHJcbiAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XHJcbiAgICB0aGlzLnRocmVhZERyYWdEZXB0aCA9IE1hdGgubWF4KDAsIHRoaXMudGhyZWFkRHJhZ0RlcHRoIC0gMSk7XHJcbiAgICB0aGlzLnRocmVhZERyYWdPdmVyID0gdGhpcy50aHJlYWREcmFnRGVwdGggPiAwO1xyXG4gIH1cclxuXHJcbiAgb25UaHJlYWREcm9wKGV2ZW50OiBEcmFnRXZlbnQpOiB2b2lkIHtcclxuICAgIGlmICh0aGlzLmlzUmVtb3ZlZEZyb21Hcm91cCkgcmV0dXJuO1xyXG4gICAgaWYgKCF0aGlzLmRyYWdIYXNGaWxlcyhldmVudCkpIHJldHVybjtcclxuICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcclxuICAgIHRoaXMucmVzZXRUaHJlYWREcmFnKCk7XHJcbiAgICBjb25zdCBmaWxlcyA9IGV2ZW50LmRhdGFUcmFuc2Zlcj8uZmlsZXMgPyBBcnJheS5mcm9tKGV2ZW50LmRhdGFUcmFuc2Zlci5maWxlcykgOiBbXTtcclxuICAgIHRoaXMubWVzc2FnZUlucHV0Py5hZGRGaWxlcyhmaWxlcyk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHJlc2V0VGhyZWFkRHJhZygpOiB2b2lkIHtcclxuICAgIHRoaXMudGhyZWFkRHJhZ0RlcHRoID0gMDtcclxuICAgIHRoaXMudGhyZWFkRHJhZ092ZXIgPSBmYWxzZTtcclxuICB9XHJcblxyXG4gIGV4aXRSZW1vdmVkR3JvdXAoKTogdm9pZCB7XHJcbiAgICBpZiAodGhpcy5jb252ZXJzYXRpb25JZCkge1xyXG4gICAgICB0aGlzLnN0b3JlLmV4aXRSZW1vdmVkR3JvdXAodGhpcy5jb252ZXJzYXRpb25JZCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGRyYWdIYXNGaWxlcyhldmVudDogRHJhZ0V2ZW50KTogYm9vbGVhbiB7XHJcbiAgICBjb25zdCB0eXBlcyA9IGV2ZW50LmRhdGFUcmFuc2Zlcj8udHlwZXM7XHJcbiAgICBpZiAoIXR5cGVzKSByZXR1cm4gZmFsc2U7XHJcbiAgICByZXR1cm4gQXJyYXkuZnJvbSh0eXBlcykuaW5jbHVkZXMoJ0ZpbGVzJyk7XHJcbiAgfVxyXG5cclxuICBzaG91bGRTaG93RGF0ZVNlcGFyYXRvcihpbmRleDogbnVtYmVyKTogYm9vbGVhbiB7XHJcbiAgICBpZiAoaW5kZXggPT09IDApIHJldHVybiB0cnVlO1xyXG4gICAgY29uc3QgY3VyciA9IG5ldyBEYXRlKHRoaXMubWVzc2FnZXNbaW5kZXhdLmNyZWF0ZWRfYXQpLnRvRGF0ZVN0cmluZygpO1xyXG4gICAgY29uc3QgcHJldiA9IG5ldyBEYXRlKHRoaXMubWVzc2FnZXNbaW5kZXggLSAxXS5jcmVhdGVkX2F0KS50b0RhdGVTdHJpbmcoKTtcclxuICAgIHJldHVybiBjdXJyICE9PSBwcmV2O1xyXG4gIH1cclxuXHJcbiAgc2hvdWxkU2hvd1NlbmRlcihpbmRleDogbnVtYmVyKTogYm9vbGVhbiB7XHJcbiAgICBpZiAoaW5kZXggPT09IDApIHJldHVybiB0cnVlO1xyXG4gICAgcmV0dXJuIHRoaXMubWVzc2FnZXNbaW5kZXhdLnNlbmRlcl9pZCAhPT0gdGhpcy5tZXNzYWdlc1tpbmRleCAtIDFdLnNlbmRlcl9pZDtcclxuICB9XHJcblxyXG4gIGlzT3duTWVzc2FnZShtc2c6IE1lc3NhZ2UpOiBib29sZWFuIHtcclxuICAgIHJldHVybiBTdHJpbmcobXNnLnNlbmRlcl9pZCkgPT09IFN0cmluZyh0aGlzLm15Q29udGFjdElkKTtcclxuICB9XHJcblxyXG4gIGlzU3lzdGVtTWVzc2FnZShtc2c6IE1lc3NhZ2UpOiBib29sZWFuIHtcclxuICAgIGNvbnN0IGNvbnRlbnQgPSBTdHJpbmcobXNnLmNvbnRlbnQgfHwgJycpLnRyaW0oKTtcclxuICAgIHJldHVybiBtc2cubWVzc2FnZV90eXBlID09PSAnU1lTVEVNJyB8fFxyXG4gICAgICAvXi4rIGFkZGVkIC4rIHRvIHRoZSBncm91cCQvLnRlc3QoY29udGVudCkgfHxcclxuICAgICAgL14uKyByZW1vdmVkIC4rIGZyb20gdGhlIGdyb3VwJC8udGVzdChjb250ZW50KTtcclxuICB9XHJcblxyXG4gIGlzUHJlZm9ybWF0dGVkVGV4dChtc2c6IE1lc3NhZ2UpOiBib29sZWFuIHtcclxuICAgIHJldHVybiB0aGlzLmlzUHJlZm9ybWF0dGVkQ29udGVudCh0aGlzLmdldE1lc3NhZ2VCb2R5KG1zZykpO1xyXG4gIH1cclxuXHJcbiAgaXNQcmVmb3JtYXR0ZWRDb250ZW50KGNvbnRlbnQ6IHN0cmluZyk6IGJvb2xlYW4ge1xyXG4gICAgcmV0dXJuIGNvbnRlbnQuaW5jbHVkZXMoJ1xcdCcpIHx8IGNvbnRlbnQuaW5jbHVkZXMoJ1xcbicpIHx8IC8gezIsfS8udGVzdChjb250ZW50KTtcclxuICB9XHJcblxyXG4gIGdldE1lc3NhZ2VDYXB0aW9uKG1zZzogTWVzc2FnZSk6IHN0cmluZyB7XHJcbiAgICBjb25zdCBjb250ZW50ID0gdGhpcy5nZXRNZXNzYWdlQm9keShtc2cpLnRyaW0oKTtcclxuICAgIGlmICghY29udGVudCkgcmV0dXJuICcnO1xyXG5cclxuICAgIGNvbnN0IGF0dGFjaG1lbnROYW1lcyA9IHRoaXMuZ2V0UmVuZGVyYWJsZUF0dGFjaG1lbnRzKG1zZylcclxuICAgICAgLm1hcCgoYXR0YWNobWVudCkgPT4gU3RyaW5nKGF0dGFjaG1lbnQuZmlsZW5hbWUgfHwgJycpLnRyaW0oKSlcclxuICAgICAgLmZpbHRlcihCb29sZWFuKTtcclxuICAgIGlmICghYXR0YWNobWVudE5hbWVzLmxlbmd0aCkgcmV0dXJuIGNvbnRlbnQ7XHJcblxyXG4gICAgY29uc3QgbmFtZXNUZXh0ID0gYXR0YWNobWVudE5hbWVzLmpvaW4oJywgJyk7XHJcbiAgICBpZiAoY29udGVudCA9PT0gbmFtZXNUZXh0IHx8IGF0dGFjaG1lbnROYW1lcy5pbmNsdWRlcyhjb250ZW50KSkgcmV0dXJuICcnO1xyXG4gICAgcmV0dXJuIGNvbnRlbnQ7XHJcbiAgfVxyXG5cclxuICBpc0NvZGVUZXh0KG1zZzogTWVzc2FnZSk6IGJvb2xlYW4ge1xyXG4gICAgcmV0dXJuIHRoaXMuaXNDb2RlQ29udGVudCh0aGlzLmdldE1lc3NhZ2VCb2R5KG1zZyksIG1zZyk7XHJcbiAgfVxyXG5cclxuICBpc0NvZGVDb250ZW50KHZhbHVlOiBzdHJpbmcsIG1zZz86IE1lc3NhZ2UpOiBib29sZWFuIHtcclxuICAgIGNvbnN0IGNvbnRlbnQgPSB2YWx1ZS50cmltKCk7XHJcbiAgICBpZiAoIWNvbnRlbnQgfHwgKG1zZyA/IHRoaXMuaXNUYWJsZVRleHQobXNnKSA6IHRoaXMuaXNUYWJsZUNvbnRlbnQoY29udGVudCkpKSByZXR1cm4gZmFsc2U7XHJcbiAgICBpZiAodGhpcy5sb29rc0xpa2VNYXJrZG93bihjb250ZW50KSAmJiAhdGhpcy5pc1NpbmdsZUZlbmNlZENvZGVCbG9jayhjb250ZW50KSkgcmV0dXJuIGZhbHNlO1xyXG4gICAgaWYgKC9eYGBgW1xcc1xcU10qYGBgJC8udGVzdChjb250ZW50KSkgcmV0dXJuIHRydWU7XHJcbiAgICByZXR1cm4gdGhpcy5kZXRlY3RDb2RlTGFuZ3VhZ2UoY29udGVudCkgIT09IG51bGw7XHJcbiAgfVxyXG5cclxuICBpc01hcmtkb3duVGV4dChtc2c6IE1lc3NhZ2UpOiBib29sZWFuIHtcclxuICAgIHJldHVybiB0aGlzLmlzTWFya2Rvd25Db250ZW50KHRoaXMuZ2V0TWVzc2FnZUJvZHkobXNnKSwgbXNnKTtcclxuICB9XHJcblxyXG4gIGlzTWFya2Rvd25Db250ZW50KHZhbHVlOiBzdHJpbmcsIG1zZz86IE1lc3NhZ2UpOiBib29sZWFuIHtcclxuICAgIGNvbnN0IGNvbnRlbnQgPSB2YWx1ZS50cmltKCk7XHJcbiAgICBpZiAoIWNvbnRlbnQgfHwgKG1zZyA/IHRoaXMuaXNUYWJsZVRleHQobXNnKSA6IHRoaXMuaXNUYWJsZUNvbnRlbnQoY29udGVudCkpIHx8IHRoaXMuaXNTaW5nbGVGZW5jZWRDb2RlQmxvY2soY29udGVudCkpIHJldHVybiBmYWxzZTtcclxuICAgIHJldHVybiB0aGlzLmxvb2tzTGlrZU1hcmtkb3duKGNvbnRlbnQpO1xyXG4gIH1cclxuXHJcbiAgZ2V0Q29kZUxhbmd1YWdlKG1zZzogTWVzc2FnZSk6IHN0cmluZyB7XHJcbiAgICByZXR1cm4gdGhpcy5nZXRDb2RlTGFuZ3VhZ2VDb250ZW50KHRoaXMuZ2V0TWVzc2FnZUJvZHkobXNnKSk7XHJcbiAgfVxyXG5cclxuICBnZXRDb2RlTGFuZ3VhZ2VDb250ZW50KGNvbnRlbnQ6IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgICBjb25zdCBwYXJzZWQgPSB0aGlzLnBhcnNlQ29kZUJsb2NrKGNvbnRlbnQpO1xyXG4gICAgcmV0dXJuIHBhcnNlZC5sYW5ndWFnZSB8fCB0aGlzLmRldGVjdENvZGVMYW5ndWFnZShwYXJzZWQuY29kZSkgfHwgJ2NvZGUnO1xyXG4gIH1cclxuXHJcbiAgZ2V0SGlnaGxpZ2h0ZWRDb2RlKG1zZzogTWVzc2FnZSk6IFNhZmVIdG1sIHtcclxuICAgIHJldHVybiB0aGlzLmdldEhpZ2hsaWdodGVkQ29kZUNvbnRlbnQodGhpcy5nZXRNZXNzYWdlQm9keShtc2cpKTtcclxuICB9XHJcblxyXG4gIGdldEhpZ2hsaWdodGVkQ29kZUNvbnRlbnQoY29udGVudDogc3RyaW5nKTogU2FmZUh0bWwge1xyXG4gICAgY29uc3QgcGFyc2VkID0gdGhpcy5wYXJzZUNvZGVCbG9jayhjb250ZW50KTtcclxuICAgIGNvbnN0IGxhbmd1YWdlID0gcGFyc2VkLmxhbmd1YWdlIHx8IHRoaXMuZGV0ZWN0Q29kZUxhbmd1YWdlKHBhcnNlZC5jb2RlKSB8fCAnY29kZSc7XHJcbiAgICBjb25zdCBlc2NhcGVkID0gdGhpcy5lc2NhcGVIdG1sKHBhcnNlZC5jb2RlKTtcclxuICAgIGNvbnN0IGhpZ2hsaWdodGVkID0gdGhpcy5oaWdobGlnaHRDb2RlKGVzY2FwZWQsIGxhbmd1YWdlKTtcclxuICAgIHJldHVybiB0aGlzLnNhbml0aXplci5ieXBhc3NTZWN1cml0eVRydXN0SHRtbChoaWdobGlnaHRlZCk7XHJcbiAgfVxyXG5cclxuICBnZXRNYXJrZG93bkh0bWwobXNnOiBNZXNzYWdlKTogU2FmZUh0bWwge1xyXG4gICAgcmV0dXJuIHRoaXMuZ2V0TWFya2Rvd25IdG1sQ29udGVudCh0aGlzLmdldE1lc3NhZ2VCb2R5KG1zZykpO1xyXG4gIH1cclxuXHJcbiAgZ2V0TWFya2Rvd25IdG1sQ29udGVudChjb250ZW50OiBzdHJpbmcpOiBTYWZlSHRtbCB7XHJcbiAgICByZXR1cm4gdGhpcy5zYW5pdGl6ZXIuYnlwYXNzU2VjdXJpdHlUcnVzdEh0bWwodGhpcy5yZW5kZXJNYXJrZG93bihjb250ZW50KSk7XHJcbiAgfVxyXG5cclxuICBjb3B5Q29kZShtc2c6IE1lc3NhZ2UsIGV2ZW50OiBNb3VzZUV2ZW50KTogdm9pZCB7XHJcbiAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcclxuICAgIGNvbnN0IGNvbnRlbnQgPSB0aGlzLmdldE1lc3NhZ2VCb2R5KG1zZyk7XHJcbiAgICBjb25zdCBwYXJzZWQgPSB0aGlzLnBhcnNlQ29kZUJsb2NrKGNvbnRlbnQpO1xyXG4gICAgdGhpcy5jb3B5VGV4dChwYXJzZWQuY29kZSB8fCBjb250ZW50KTtcclxuICB9XHJcblxyXG4gIGNvcHlNZXNzYWdlVGV4dChtc2c6IE1lc3NhZ2UsIGV2ZW50OiBNb3VzZUV2ZW50KTogdm9pZCB7XHJcbiAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcclxuICAgIHRoaXMuY29weVRleHQodGhpcy5nZXRNZXNzYWdlQm9keShtc2cpKTtcclxuICB9XHJcblxyXG4gIGNvcHlUZXh0VmFsdWUodGV4dDogc3RyaW5nLCBldmVudDogTW91c2VFdmVudCk6IHZvaWQge1xyXG4gICAgZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XHJcbiAgICB0aGlzLmNvcHlUZXh0KHRleHQpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBwYXJzZUNvZGVCbG9jayhjb250ZW50OiBzdHJpbmcpOiB7IGxhbmd1YWdlOiBzdHJpbmc7IGNvZGU6IHN0cmluZyB9IHtcclxuICAgIGNvbnN0IHRyaW1tZWQgPSBjb250ZW50LnRyaW0oKTtcclxuICAgIGNvbnN0IG1hdGNoID0gdHJpbW1lZC5tYXRjaCgvXmBgYChbYS16QS1aMC05XystXSopXFxzKlxcbj8oW1xcc1xcU10qPylgYGAkLyk7XHJcbiAgICBpZiAoIW1hdGNoKSByZXR1cm4geyBsYW5ndWFnZTogJycsIGNvZGU6IGNvbnRlbnQgfTtcclxuICAgIHJldHVybiB7IGxhbmd1YWdlOiAobWF0Y2hbMV0gfHwgJycpLnRvTG93ZXJDYXNlKCksIGNvZGU6IG1hdGNoWzJdIHx8ICcnIH07XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGlzU2luZ2xlRmVuY2VkQ29kZUJsb2NrKGNvbnRlbnQ6IHN0cmluZyk6IGJvb2xlYW4ge1xyXG4gICAgcmV0dXJuIC9eYGBgW2EtekEtWjAtOV8rLV0qXFxzKlxcbj9bXFxzXFxTXSo/YGBgJC8udGVzdChjb250ZW50LnRyaW0oKSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGxvb2tzTGlrZU1hcmtkb3duKGNvbnRlbnQ6IHN0cmluZyk6IGJvb2xlYW4ge1xyXG4gICAgcmV0dXJuIC8oXiN7MSw2fVxccyl8KF5bLSpdXFxzKXwoXlxcZCtcXC5cXHMpfChePlxccyl8KFxcKlxcKlteKl0rXFwqXFwqKXwoYFteYF0rYCl8KFxcW1teXFxdXStcXF1cXChbXildK1xcKSl8KF4tLS0kKXwoXi1cXHNcXFtbIHhdXFxdXFxzKXwoXmBgYFthLXpBLVowLTlfKy1dKlxccyokKS9tLnRlc3QoY29udGVudCk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGRldGVjdENvZGVMYW5ndWFnZShjb2RlOiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHtcclxuICAgIGNvbnN0IHRyaW1tZWQgPSBjb2RlLnRyaW0oKTtcclxuICAgIGlmICghdHJpbW1lZC5pbmNsdWRlcygnXFxuJykgJiYgdHJpbW1lZC5sZW5ndGggPCA0MCkgcmV0dXJuIG51bGw7XHJcbiAgICBpZiAoL15cXHMqKHNlbGVjdHx3aXRofGluc2VydHx1cGRhdGV8ZGVsZXRlfGNyZWF0ZXxhbHRlcnxkcm9wKVxcYi9pLnRlc3QodHJpbW1lZCkpIHJldHVybiAnc3FsJztcclxuICAgIGlmICgvXFxiKGZ1bmN0aW9ufGNvbnN0fGxldHx2YXJ8PT58Y29uc29sZVxcLmxvZ3xpbXBvcnRcXHMrLipmcm9tKVxcYi8udGVzdCh0cmltbWVkKSkgcmV0dXJuICdqYXZhc2NyaXB0JztcclxuICAgIGlmICgvXFxiKGRlZnxpbXBvcnR8ZnJvbXxwcmludHxjbGFzcylcXGIvLnRlc3QodHJpbW1lZCkgJiYgLzpcXHMqJHxeXFxzezR9L20udGVzdCh0cmltbWVkKSkgcmV0dXJuICdweXRob24nO1xyXG4gICAgaWYgKC88XFwvP1thLXpdW1xcc1xcU10qPi9pLnRlc3QodHJpbW1lZCkpIHJldHVybiAnaHRtbCc7XHJcbiAgICBpZiAoL1t7fTtdLy50ZXN0KHRyaW1tZWQpICYmIC9bOj1dLy50ZXN0KHRyaW1tZWQpKSByZXR1cm4gJ2NvZGUnO1xyXG4gICAgcmV0dXJuIG51bGw7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGhpZ2hsaWdodENvZGUoZXNjYXBlZENvZGU6IHN0cmluZywgbGFuZ3VhZ2U6IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgICBjb25zdCBwcm90ZWN0ZWRUb2tlbnM6IHN0cmluZ1tdID0gW107XHJcbiAgICBjb25zdCBwcm90ZWN0ID0gKHZhbHVlOiBzdHJpbmcsIHJlZ2V4OiBSZWdFeHAsIGNsYXNzTmFtZTogc3RyaW5nKTogc3RyaW5nID0+XHJcbiAgICAgIHZhbHVlLnJlcGxhY2UocmVnZXgsIChtYXRjaCkgPT4ge1xyXG4gICAgICAgIGNvbnN0IHRva2VuID0gYF9fQ09ERV9UT0tFTl8ke3Byb3RlY3RlZFRva2Vucy5sZW5ndGh9X19gO1xyXG4gICAgICAgIHByb3RlY3RlZFRva2Vucy5wdXNoKGA8c3BhbiBjbGFzcz1cIiR7Y2xhc3NOYW1lfVwiPiR7bWF0Y2h9PC9zcGFuPmApO1xyXG4gICAgICAgIHJldHVybiB0b2tlbjtcclxuICAgICAgfSk7XHJcblxyXG4gICAgbGV0IGhpZ2hsaWdodGVkID0gZXNjYXBlZENvZGU7XHJcblxyXG4gICAgaWYgKGxhbmd1YWdlID09PSAnc3FsJykge1xyXG4gICAgICBoaWdobGlnaHRlZCA9IHByb3RlY3QoaGlnaGxpZ2h0ZWQsIC8oLS0uKikkL2dtLCAnY29kZS10b2tlbi1jb21tZW50Jyk7XHJcbiAgICAgIGhpZ2hsaWdodGVkID0gcHJvdGVjdChoaWdobGlnaHRlZCwgLygmcXVvdDsuKj8mcXVvdDt8JiMzOTsuKj8mIzM5O3xgLio/YCkvZywgJ2NvZGUtdG9rZW4tc3RyaW5nJyk7XHJcbiAgICAgIGhpZ2hsaWdodGVkID0gaGlnaGxpZ2h0ZWQucmVwbGFjZSgvXFxiKFNFTEVDVHxGUk9NfFdIRVJFfEpPSU58TEVGVHxSSUdIVHxJTk5FUnxPVVRFUnxPTnxHUk9VUCBCWXxPUkRFUiBCWXxJTlNFUlR8SU5UT3xWQUxVRVN8VVBEQVRFfFNFVHxERUxFVEV8Q1JFQVRFfFRBQkxFfEFMVEVSfERST1B8QU5EfE9SfE5VTEx8SVN8Tk9UfEFTfExJTUlUKVxcYi9naSwgJzxzcGFuIGNsYXNzPVwiY29kZS10b2tlbi1rZXl3b3JkXCI+JDE8L3NwYW4+Jyk7XHJcbiAgICAgIGhpZ2hsaWdodGVkID0gaGlnaGxpZ2h0ZWQucmVwbGFjZSgvXFxiKFxcZCsoPzpcXC5cXGQrKT8pXFxiL2csICc8c3BhbiBjbGFzcz1cImNvZGUtdG9rZW4tbnVtYmVyXCI+JDE8L3NwYW4+Jyk7XHJcbiAgICAgIHJldHVybiB0aGlzLnJlc3RvcmVDb2RlVG9rZW5zKGhpZ2hsaWdodGVkLCBwcm90ZWN0ZWRUb2tlbnMpO1xyXG4gICAgfVxyXG5cclxuICAgIGhpZ2hsaWdodGVkID0gcHJvdGVjdChoaWdobGlnaHRlZCwgLyhcXC9cXC8uKnwjLiopJC9nbSwgJ2NvZGUtdG9rZW4tY29tbWVudCcpO1xyXG4gICAgaGlnaGxpZ2h0ZWQgPSBwcm90ZWN0KGhpZ2hsaWdodGVkLCAvKCZxdW90Oy4qPyZxdW90O3wmIzM5Oy4qPyYjMzk7fGAuKj9gKS9nLCAnY29kZS10b2tlbi1zdHJpbmcnKTtcclxuICAgIGhpZ2hsaWdodGVkID0gaGlnaGxpZ2h0ZWQucmVwbGFjZSgvXFxiKGZ1bmN0aW9ufGNvbnN0fGxldHx2YXJ8cmV0dXJufGlmfGVsc2V8Zm9yfHdoaWxlfGNsYXNzfGltcG9ydHxmcm9tfGV4cG9ydHxhc3luY3xhd2FpdHxkZWZ8cHJpbnR8dHJ5fGNhdGNofG5ld3x0cnVlfGZhbHNlfG51bGx8Tm9uZSlcXGIvZywgJzxzcGFuIGNsYXNzPVwiY29kZS10b2tlbi1rZXl3b3JkXCI+JDE8L3NwYW4+Jyk7XHJcbiAgICBoaWdobGlnaHRlZCA9IGhpZ2hsaWdodGVkLnJlcGxhY2UoL1xcYihcXGQrKD86XFwuXFxkKyk/KVxcYi9nLCAnPHNwYW4gY2xhc3M9XCJjb2RlLXRva2VuLW51bWJlclwiPiQxPC9zcGFuPicpO1xyXG4gICAgaGlnaGxpZ2h0ZWQgPSBoaWdobGlnaHRlZC5yZXBsYWNlKC9cXGIoW2EtekEtWl8kXVtcXHckXSopKD89XFwoKS9nLCAnPHNwYW4gY2xhc3M9XCJjb2RlLXRva2VuLWZ1bmN0aW9uXCI+JDE8L3NwYW4+Jyk7XHJcbiAgICByZXR1cm4gdGhpcy5yZXN0b3JlQ29kZVRva2VucyhoaWdobGlnaHRlZCwgcHJvdGVjdGVkVG9rZW5zKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgcmVzdG9yZUNvZGVUb2tlbnModmFsdWU6IHN0cmluZywgcHJvdGVjdGVkVG9rZW5zOiBzdHJpbmdbXSk6IHN0cmluZyB7XHJcbiAgICByZXR1cm4gcHJvdGVjdGVkVG9rZW5zLnJlZHVjZShcclxuICAgICAgKGh0bWwsIHRva2VuLCBpbmRleCkgPT4gaHRtbC5yZXBsYWNlKG5ldyBSZWdFeHAoYF9fQ09ERV9UT0tFTl8ke2luZGV4fV9fYCwgJ2cnKSwgdG9rZW4pLFxyXG4gICAgICB2YWx1ZVxyXG4gICAgKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgcmVuZGVyTWFya2Rvd24ocmF3OiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gICAgY29uc3QgY29kZUJsb2Nrczogc3RyaW5nW10gPSBbXTtcclxuICAgIGNvbnN0IHdpdGhvdXRDb2RlID0gcmF3LnJlcGxhY2UoL2BgYChbYS16QS1aMC05XystXSopXFxzKlxcbj8oW1xcc1xcU10qPylgYGAvZywgKF9tYXRjaCwgbGFuZywgY29kZSkgPT4ge1xyXG4gICAgICBjb25zdCBsYW5ndWFnZSA9IFN0cmluZyhsYW5nIHx8ICdjb2RlJykudG9Mb3dlckNhc2UoKTtcclxuICAgICAgY29uc3QgdG9rZW4gPSBgX19NRF9DT0RFXyR7Y29kZUJsb2Nrcy5sZW5ndGh9X19gO1xyXG4gICAgICBjb2RlQmxvY2tzLnB1c2goXHJcbiAgICAgICAgYDxwcmU+PGNvZGUgZGF0YS1sYW5ndWFnZT1cIiR7dGhpcy5lc2NhcGVIdG1sKGxhbmd1YWdlKX1cIj4ke3RoaXMuZXNjYXBlSHRtbChTdHJpbmcoY29kZSB8fCAnJykpfTwvY29kZT48L3ByZT5gXHJcbiAgICAgICk7XHJcbiAgICAgIHJldHVybiB0b2tlbjtcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IGxpbmVzID0gd2l0aG91dENvZGUuc3BsaXQoL1xccj9cXG4vKTtcclxuICAgIGNvbnN0IGh0bWw6IHN0cmluZ1tdID0gW107XHJcbiAgICBsZXQgbGlzdFR5cGU6ICd1bCcgfCAnb2wnIHwgbnVsbCA9IG51bGw7XHJcblxyXG4gICAgY29uc3QgY2xvc2VMaXN0ID0gKCkgPT4ge1xyXG4gICAgICBpZiAobGlzdFR5cGUpIHtcclxuICAgICAgICBodG1sLnB1c2goYDwvJHtsaXN0VHlwZX0+YCk7XHJcbiAgICAgICAgbGlzdFR5cGUgPSBudWxsO1xyXG4gICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIGZvciAoY29uc3QgbGluZSBvZiBsaW5lcykge1xyXG4gICAgICBjb25zdCB0cmltbWVkID0gbGluZS50cmltKCk7XHJcblxyXG4gICAgICBpZiAoIXRyaW1tZWQpIHtcclxuICAgICAgICBjbG9zZUxpc3QoKTtcclxuICAgICAgICBjb250aW51ZTtcclxuICAgICAgfVxyXG5cclxuICAgICAgY29uc3QgdG9rZW5NYXRjaCA9IHRyaW1tZWQubWF0Y2goL15fX01EX0NPREVfKFxcZCspX18kLyk7XHJcbiAgICAgIGlmICh0b2tlbk1hdGNoKSB7XHJcbiAgICAgICAgY2xvc2VMaXN0KCk7XHJcbiAgICAgICAgaHRtbC5wdXNoKGNvZGVCbG9ja3NbTnVtYmVyKHRva2VuTWF0Y2hbMV0pXSB8fCAnJyk7XHJcbiAgICAgICAgY29udGludWU7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGNvbnN0IGhlYWRpbmcgPSB0cmltbWVkLm1hdGNoKC9eKCN7MSwzfSlcXHMrKC4rKSQvKTtcclxuICAgICAgaWYgKGhlYWRpbmcpIHtcclxuICAgICAgICBjbG9zZUxpc3QoKTtcclxuICAgICAgICBodG1sLnB1c2goYDxoJHtoZWFkaW5nWzFdLmxlbmd0aH0+JHt0aGlzLnJlbmRlck1hcmtkb3duSW5saW5lKGhlYWRpbmdbMl0pfTwvaCR7aGVhZGluZ1sxXS5sZW5ndGh9PmApO1xyXG4gICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBpZiAoL14tLS0rJC8udGVzdCh0cmltbWVkKSkge1xyXG4gICAgICAgIGNsb3NlTGlzdCgpO1xyXG4gICAgICAgIGh0bWwucHVzaCgnPGhyPicpO1xyXG4gICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBjb25zdCB1bm9yZGVyZWQgPSB0cmltbWVkLm1hdGNoKC9eWy0qXVxccysoPzpcXFtbIHhdXFxdXFxzKyk/KC4rKSQvaSk7XHJcbiAgICAgIGlmICh1bm9yZGVyZWQpIHtcclxuICAgICAgICBpZiAobGlzdFR5cGUgIT09ICd1bCcpIHtcclxuICAgICAgICAgIGNsb3NlTGlzdCgpO1xyXG4gICAgICAgICAgaHRtbC5wdXNoKCc8dWw+Jyk7XHJcbiAgICAgICAgICBsaXN0VHlwZSA9ICd1bCc7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGh0bWwucHVzaChgPGxpPiR7dGhpcy5yZW5kZXJNYXJrZG93bklubGluZSh1bm9yZGVyZWRbMV0pfTwvbGk+YCk7XHJcbiAgICAgICAgY29udGludWU7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGNvbnN0IG9yZGVyZWQgPSB0cmltbWVkLm1hdGNoKC9eXFxkK1xcLlxccysoLispJC8pO1xyXG4gICAgICBpZiAob3JkZXJlZCkge1xyXG4gICAgICAgIGlmIChsaXN0VHlwZSAhPT0gJ29sJykge1xyXG4gICAgICAgICAgY2xvc2VMaXN0KCk7XHJcbiAgICAgICAgICBodG1sLnB1c2goJzxvbD4nKTtcclxuICAgICAgICAgIGxpc3RUeXBlID0gJ29sJztcclxuICAgICAgICB9XHJcbiAgICAgICAgaHRtbC5wdXNoKGA8bGk+JHt0aGlzLnJlbmRlck1hcmtkb3duSW5saW5lKG9yZGVyZWRbMV0pfTwvbGk+YCk7XHJcbiAgICAgICAgY29udGludWU7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGNvbnN0IHF1b3RlID0gdHJpbW1lZC5tYXRjaCgvXj5cXHMrKC4rKSQvKTtcclxuICAgICAgaWYgKHF1b3RlKSB7XHJcbiAgICAgICAgY2xvc2VMaXN0KCk7XHJcbiAgICAgICAgaHRtbC5wdXNoKGA8YmxvY2txdW90ZT4ke3RoaXMucmVuZGVyTWFya2Rvd25JbmxpbmUocXVvdGVbMV0pfTwvYmxvY2txdW90ZT5gKTtcclxuICAgICAgICBjb250aW51ZTtcclxuICAgICAgfVxyXG5cclxuICAgICAgY2xvc2VMaXN0KCk7XHJcbiAgICAgIGh0bWwucHVzaChgPHA+JHt0aGlzLnJlbmRlck1hcmtkb3duSW5saW5lKHRyaW1tZWQpfTwvcD5gKTtcclxuICAgIH1cclxuXHJcbiAgICBjbG9zZUxpc3QoKTtcclxuICAgIHJldHVybiBodG1sLmpvaW4oJycpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSByZW5kZXJNYXJrZG93bklubGluZSh2YWx1ZTogc3RyaW5nKTogc3RyaW5nIHtcclxuICAgIGxldCBodG1sID0gdGhpcy5lc2NhcGVIdG1sKHZhbHVlKTtcclxuICAgIGh0bWwgPSBodG1sLnJlcGxhY2UoL2AoW15gXSspYC9nLCAnPGNvZGU+JDE8L2NvZGU+Jyk7XHJcbiAgICBodG1sID0gaHRtbC5yZXBsYWNlKC9cXCpcXCooW14qXSspXFwqXFwqL2csICc8c3Ryb25nPiQxPC9zdHJvbmc+Jyk7XHJcbiAgICBodG1sID0gaHRtbC5yZXBsYWNlKC9cXCooW14qXSspXFwqL2csICc8ZW0+JDE8L2VtPicpO1xyXG4gICAgaHRtbCA9IGh0bWwucmVwbGFjZSgvXFxbKFteXFxdXSspXFxdXFwoKGh0dHBzPzpcXC9cXC9bXilcXHNdKylcXCkvZywgJzxhIGhyZWY9XCIkMlwiIHRhcmdldD1cIl9ibGFua1wiIHJlbD1cIm5vb3BlbmVyIG5vcmVmZXJyZXJcIj4kMTwvYT4nKTtcclxuICAgIHJldHVybiBodG1sO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBjb3B5VGV4dCh0ZXh0OiBzdHJpbmcpOiB2b2lkIHtcclxuICAgIGlmICghdGV4dCkgcmV0dXJuO1xyXG4gICAgaWYgKG5hdmlnYXRvci5jbGlwYm9hcmQ/LndyaXRlVGV4dCkge1xyXG4gICAgICBuYXZpZ2F0b3IuY2xpcGJvYXJkLndyaXRlVGV4dCh0ZXh0KS50aGVuKFxyXG4gICAgICAgICgpID0+IHRoaXMuc3RvcmUuc2hvd1RvYXN0KCdDb3BpZWQgdG8gY2xpcGJvYXJkJywgJ3N1Y2Nlc3MnLCAxNjAwKSxcclxuICAgICAgICAoKSA9PiB0aGlzLmZhbGxiYWNrQ29weVRleHQodGV4dClcclxuICAgICAgKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgdGhpcy5mYWxsYmFja0NvcHlUZXh0KHRleHQpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBmYWxsYmFja0NvcHlUZXh0KHRleHQ6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgdHJ5IHtcclxuICAgICAgY29uc3QgdGV4dGFyZWEgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCd0ZXh0YXJlYScpO1xyXG4gICAgICB0ZXh0YXJlYS52YWx1ZSA9IHRleHQ7XHJcbiAgICAgIHRleHRhcmVhLnN0eWxlLnBvc2l0aW9uID0gJ2ZpeGVkJztcclxuICAgICAgdGV4dGFyZWEuc3R5bGUubGVmdCA9ICctOTk5OXB4JztcclxuICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCh0ZXh0YXJlYSk7XHJcbiAgICAgIHRleHRhcmVhLnNlbGVjdCgpO1xyXG4gICAgICBkb2N1bWVudC5leGVjQ29tbWFuZCgnY29weScpO1xyXG4gICAgICBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKHRleHRhcmVhKTtcclxuICAgICAgdGhpcy5zdG9yZS5zaG93VG9hc3QoJ0NvcGllZCB0byBjbGlwYm9hcmQnLCAnc3VjY2VzcycsIDE2MDApO1xyXG4gICAgfSBjYXRjaCB7XHJcbiAgICAgIHRoaXMuc3RvcmUuc2hvd1RvYXN0KCdDb3VsZCBub3QgY29weScsICdlcnJvcicsIDIyMDApO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBlc2NhcGVIdG1sKHZhbHVlOiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gICAgcmV0dXJuIHZhbHVlXHJcbiAgICAgIC5yZXBsYWNlKC8mL2csICcmYW1wOycpXHJcbiAgICAgIC5yZXBsYWNlKC88L2csICcmbHQ7JylcclxuICAgICAgLnJlcGxhY2UoLz4vZywgJyZndDsnKVxyXG4gICAgICAucmVwbGFjZSgvXCIvZywgJyZxdW90OycpXHJcbiAgICAgIC5yZXBsYWNlKC8nL2csICcmIzM5OycpO1xyXG4gIH1cclxuXHJcbiAgaXNUYWJsZVRleHQobXNnOiBNZXNzYWdlKTogYm9vbGVhbiB7XHJcbiAgICBjb25zdCByb3dzID0gdGhpcy5nZXRUYWJsZVJvd3MobXNnKTtcclxuICAgIHJldHVybiByb3dzLmxlbmd0aCA+PSAyICYmIHJvd3Muc29tZSgocm93KSA9PiByb3cubGVuZ3RoID49IDIpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBpc1RhYmxlQ29udGVudChjb250ZW50OiBzdHJpbmcpOiBib29sZWFuIHtcclxuICAgIGNvbnN0IHJvd3MgPSB0aGlzLmdldFRhYmxlUm93c0Zyb21Db250ZW50KGNvbnRlbnQpO1xyXG4gICAgcmV0dXJuIHJvd3MubGVuZ3RoID49IDIgJiYgcm93cy5zb21lKChyb3cpID0+IHJvdy5sZW5ndGggPj0gMik7XHJcbiAgfVxyXG5cclxuICBnZXRUYWJsZVJvd3MobXNnOiBNZXNzYWdlKTogc3RyaW5nW11bXSB7XHJcbiAgICByZXR1cm4gdGhpcy5nZXRUYWJsZVJvd3NGcm9tQ29udGVudCh0aGlzLmdldE1lc3NhZ2VCb2R5KG1zZykpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBnZXRUYWJsZVJvd3NGcm9tQ29udGVudCh2YWx1ZTogc3RyaW5nKTogc3RyaW5nW11bXSB7XHJcbiAgICBjb25zdCBjb250ZW50ID0gdmFsdWUudHJpbSgpO1xyXG4gICAgaWYgKCFjb250ZW50LmluY2x1ZGVzKCdcXHQnKSkgcmV0dXJuIFtdO1xyXG5cclxuICAgIGNvbnN0IHJvd3MgPSBjb250ZW50XHJcbiAgICAgIC5zcGxpdCgvXFxyP1xcbi8pXHJcbiAgICAgIC5tYXAoKGxpbmUpID0+IGxpbmUuc3BsaXQoJ1xcdCcpLm1hcCgoY2VsbCkgPT4gY2VsbC50cmltKCkpKVxyXG4gICAgICAuZmlsdGVyKChyb3cpID0+IHJvdy5zb21lKChjZWxsKSA9PiBjZWxsLmxlbmd0aCA+IDApKTtcclxuXHJcbiAgICBjb25zdCBtYXhDb2x1bW5zID0gTWF0aC5tYXgoMCwgLi4ucm93cy5tYXAoKHJvdykgPT4gcm93Lmxlbmd0aCkpO1xyXG4gICAgaWYgKG1heENvbHVtbnMgPCAyKSByZXR1cm4gW107XHJcblxyXG4gICAgcmV0dXJuIHJvd3MubWFwKChyb3cpID0+IFtcclxuICAgICAgLi4ucm93LFxyXG4gICAgICAuLi5BcnJheS5mcm9tKHsgbGVuZ3RoOiBtYXhDb2x1bW5zIC0gcm93Lmxlbmd0aCB9LCAoKSA9PiAnJyksXHJcbiAgICBdKTtcclxuICB9XHJcblxyXG4gIGlzTWVzc2FnZVJlYWQobXNnOiBNZXNzYWdlKTogYm9vbGVhbiB7XHJcbiAgICBjb25zdCB2YWx1ZSA9IG1zZy5pc19yZWFkO1xyXG4gICAgcmV0dXJuIHZhbHVlID09PSB0cnVlIHx8IHZhbHVlID09PSAndHJ1ZScgfHwgdmFsdWUgPT09ICdUcnVlJyB8fCB2YWx1ZSA9PT0gJzEnO1xyXG4gIH1cclxuXHJcbiAgZ2V0UmVhZFRvb2x0aXAobXNnOiBNZXNzYWdlKTogc3RyaW5nIHtcclxuICAgIGlmICghdGhpcy5pc0dyb3VwKSByZXR1cm4gJ1JlYWQnO1xyXG5cclxuICAgIGNvbnN0IG5hbWVzID0gdGhpcy5nZXRSZWFkQnlOYW1lcyhtc2cpO1xyXG4gICAgaWYgKG5hbWVzLmxlbmd0aCA+IDApIHtcclxuICAgICAgcmV0dXJuIGBSZWFkIGJ5ICR7bmFtZXMuam9pbignLCAnKX1gO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiAnUmVhZCc7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGdldFJlYWRCeU5hbWVzKG1zZzogTWVzc2FnZSk6IHN0cmluZ1tdIHtcclxuICAgIGNvbnN0IGFueU1zZyA9IG1zZyBhcyBhbnk7XHJcbiAgICBjb25zdCByYXdOYW1lcyA9IFtcclxuICAgICAgLi4udGhpcy50b1JlYWRBcnJheShhbnlNc2cucmVhZF9ieV9uYW1lcyksXHJcbiAgICAgIC4uLnRoaXMudG9SZWFkQXJyYXkoYW55TXNnLnJlYWRCeU5hbWVzKSxcclxuICAgICAgLi4udGhpcy50b1JlYWRBcnJheShhbnlNc2cucmVhZGVyX25hbWVzKSxcclxuICAgICAgLi4udGhpcy50b1JlYWRBcnJheShhbnlNc2cucmVhZGVycyksXHJcbiAgICAgIC4uLnRoaXMudG9SZWFkQXJyYXkoYW55TXNnLnJlYWRfYnkpLFxyXG4gICAgICAuLi50aGlzLnRvUmVhZEFycmF5KGFueU1zZy5yZWFkQnkpLFxyXG4gICAgXTtcclxuXHJcbiAgICBjb25zdCBuYW1lcyA9IHJhd05hbWVzXHJcbiAgICAgIC5tYXAoKGVudHJ5KSA9PiB0aGlzLnJlYWRFbnRyeVRvTmFtZShlbnRyeSkpXHJcbiAgICAgIC5maWx0ZXIoKG5hbWUpOiBuYW1lIGlzIHN0cmluZyA9PiAhIW5hbWUgJiYgbmFtZSAhPT0gJ1lvdScpO1xyXG5cclxuICAgIHJldHVybiBBcnJheS5mcm9tKG5ldyBTZXQobmFtZXMpKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgdG9SZWFkQXJyYXkodmFsdWU6IHVua25vd24pOiB1bmtub3duW10ge1xyXG4gICAgaWYgKCF2YWx1ZSkgcmV0dXJuIFtdO1xyXG4gICAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSByZXR1cm4gdmFsdWU7XHJcbiAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykge1xyXG4gICAgICBjb25zdCB0cmltbWVkID0gdmFsdWUudHJpbSgpO1xyXG4gICAgICBpZiAoIXRyaW1tZWQpIHJldHVybiBbXTtcclxuICAgICAgdHJ5IHtcclxuICAgICAgICBjb25zdCBwYXJzZWQgPSBKU09OLnBhcnNlKHRyaW1tZWQpO1xyXG4gICAgICAgIHJldHVybiBBcnJheS5pc0FycmF5KHBhcnNlZCkgPyBwYXJzZWQgOiBbcGFyc2VkXTtcclxuICAgICAgfSBjYXRjaCB7XHJcbiAgICAgICAgcmV0dXJuIHRyaW1tZWQuaW5jbHVkZXMoJywnKSA/IHRyaW1tZWQuc3BsaXQoJywnKS5tYXAoKHYpID0+IHYudHJpbSgpKSA6IFt0cmltbWVkXTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIFt2YWx1ZV07XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHJlYWRFbnRyeVRvTmFtZShlbnRyeTogdW5rbm93bik6IHN0cmluZyB8IG51bGwge1xyXG4gICAgaWYgKGVudHJ5ID09IG51bGwpIHJldHVybiBudWxsO1xyXG4gICAgaWYgKHR5cGVvZiBlbnRyeSA9PT0gJ3N0cmluZycgfHwgdHlwZW9mIGVudHJ5ID09PSAnbnVtYmVyJykge1xyXG4gICAgICBjb25zdCBpZE9yTmFtZSA9IFN0cmluZyhlbnRyeSkudHJpbSgpO1xyXG4gICAgICBjb25zdCBjb250YWN0ID0gdGhpcy52aXNpYmxlQ29udGFjdHMuZmluZCgoYykgPT4gU3RyaW5nKGMuY29udGFjdF9pZCkgPT09IGlkT3JOYW1lKTtcclxuICAgICAgcmV0dXJuIGNvbnRhY3QgPyBnZXRDb250YWN0RGlzcGxheU5hbWUoY29udGFjdCkgOiBpZE9yTmFtZTtcclxuICAgIH1cclxuICAgIGlmICh0eXBlb2YgZW50cnkgPT09ICdvYmplY3QnKSB7XHJcbiAgICAgIGNvbnN0IG9iaiA9IGVudHJ5IGFzIGFueTtcclxuICAgICAgY29uc3QgZXhwbGljaXQgPSBvYmoudXNlcm5hbWUgfHwgb2JqLm5hbWUgfHwgb2JqLmRpc3BsYXlfbmFtZSB8fCBvYmouZGlzcGxheU5hbWUgfHwgb2JqLmVtYWlsO1xyXG4gICAgICBpZiAoZXhwbGljaXQpIHJldHVybiBTdHJpbmcoZXhwbGljaXQpO1xyXG4gICAgICBpZiAob2JqLmNvbnRhY3RfaWQgfHwgb2JqLmNvbnRhY3RJZCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLnJlYWRFbnRyeVRvTmFtZShvYmouY29udGFjdF9pZCB8fCBvYmouY29udGFjdElkKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIG51bGw7XHJcbiAgfVxyXG5cclxuICBnZXRTZW5kZXJOYW1lKG1zZzogTWVzc2FnZSk6IHN0cmluZyB7XHJcbiAgICBjb25zdCBmcm9tTWVzc2FnZSA9IGdldE1lc3NhZ2VTZW5kZXJOYW1lKG1zZyk7XHJcbiAgICBpZiAoZnJvbU1lc3NhZ2UgJiYgZnJvbU1lc3NhZ2UgIT09ICdVbmtub3duJykge1xyXG4gICAgICByZXR1cm4gZnJvbU1lc3NhZ2U7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgZnJvbUNvbnRhY3RzID0gdGhpcy52aXNpYmxlQ29udGFjdHMuZmluZChcclxuICAgICAgKGMpID0+IFN0cmluZyhjLmNvbnRhY3RfaWQpID09PSBTdHJpbmcobXNnLnNlbmRlcl9pZClcclxuICAgICk7XHJcbiAgICBpZiAoZnJvbUNvbnRhY3RzKSB7XHJcbiAgICAgIHJldHVybiBnZXRDb250YWN0RGlzcGxheU5hbWUoZnJvbUNvbnRhY3RzKTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAodGhpcy5pc093bk1lc3NhZ2UobXNnKSkge1xyXG4gICAgICByZXR1cm4gJ1lvdSc7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIGBVc2VyICR7bXNnLnNlbmRlcl9pZH1gO1xyXG4gIH1cclxuXHJcbiAgZm9ybWF0VGltZShkYXRlU3RyOiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gICAgaWYgKCFkYXRlU3RyKSByZXR1cm4gJyc7XHJcbiAgICBjb25zdCBkID0gbmV3IERhdGUoZGF0ZVN0cik7XHJcbiAgICByZXR1cm4gZC50b0xvY2FsZVRpbWVTdHJpbmcoJ2VuLUdCJywgeyBob3VyOiAnMi1kaWdpdCcsIG1pbnV0ZTogJzItZGlnaXQnIH0pO1xyXG4gIH1cclxuXHJcbiAgZm9ybWF0RGF0ZShkYXRlU3RyOiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gICAgY29uc3QgZCA9IG5ldyBEYXRlKGRhdGVTdHIpO1xyXG4gICAgY29uc3QgdG9kYXkgPSBuZXcgRGF0ZSgpO1xyXG4gICAgY29uc3QgeWVzdGVyZGF5ID0gbmV3IERhdGUodG9kYXkpO1xyXG4gICAgeWVzdGVyZGF5LnNldERhdGUoeWVzdGVyZGF5LmdldERhdGUoKSAtIDEpO1xyXG5cclxuICAgIGlmIChkLnRvRGF0ZVN0cmluZygpID09PSB0b2RheS50b0RhdGVTdHJpbmcoKSkgcmV0dXJuICdUb2RheSc7XHJcbiAgICBpZiAoZC50b0RhdGVTdHJpbmcoKSA9PT0geWVzdGVyZGF5LnRvRGF0ZVN0cmluZygpKSByZXR1cm4gJ1llc3RlcmRheSc7XHJcbiAgICByZXR1cm4gZC50b0xvY2FsZURhdGVTdHJpbmcoJ2VuLUdCJywgeyBkYXk6ICdudW1lcmljJywgbW9udGg6ICdzaG9ydCcsIHllYXI6ICdudW1lcmljJyB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgc2Nyb2xsVG9Cb3R0b20oKTogdm9pZCB7XHJcbiAgICB0cnkge1xyXG4gICAgICBjb25zdCBlbCA9IHRoaXMuc2Nyb2xsQ29udGFpbmVyPy5uYXRpdmVFbGVtZW50O1xyXG4gICAgICBpZiAoZWwpIHtcclxuICAgICAgICBlbC5zY3JvbGxUb3AgPSBlbC5zY3JvbGxIZWlnaHQ7XHJcbiAgICAgIH1cclxuICAgIH0gY2F0Y2ggeyAvKiBpZ25vcmUgKi8gfVxyXG4gIH1cclxuXHJcbiAgLy8g4pSA4pSAIE1lZGlhIGhlbHBlcnMg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcblxyXG4gIHByaXZhdGUgZ2V0RmlsZW5hbWVMaWtlKG1zZzogTWVzc2FnZSwgYXR0YWNobWVudD86IEF0dGFjaG1lbnQpOiBzdHJpbmcge1xyXG4gICAgY29uc3QgYW55TXNnID0gbXNnIGFzIGFueTtcclxuICAgIHJldHVybiBTdHJpbmcoXHJcbiAgICAgIGF0dGFjaG1lbnQ/LmZpbGVuYW1lIHx8XHJcbiAgICAgIHRoaXMuZ2V0UHJpbWFyeUF0dGFjaG1lbnQobXNnKT8uZmlsZW5hbWUgfHxcclxuICAgICAgYW55TXNnPy5maWxlbmFtZSB8fFxyXG4gICAgICBhbnlNc2c/LmZpbGVfbmFtZSB8fFxyXG4gICAgICBtc2cuY29udGVudCB8fFxyXG4gICAgICAnJ1xyXG4gICAgKS50b0xvd2VyQ2FzZSgpO1xyXG4gIH1cclxuXHJcbiAgZ2V0UmVuZGVyYWJsZUF0dGFjaG1lbnRzKG1zZzogTWVzc2FnZSk6IEF0dGFjaG1lbnRbXSB7XHJcbiAgICBjb25zdCBhdHRhY2htZW50cyA9IHRoaXMuZ2V0QWxsQXR0YWNobWVudHMobXNnKTtcclxuICAgIGlmIChhdHRhY2htZW50cy5sZW5ndGggPiAwKSByZXR1cm4gYXR0YWNobWVudHM7XHJcbiAgICBjb25zdCBwcmltYXJ5ID0gdGhpcy5nZXRQcmltYXJ5QXR0YWNobWVudChtc2cpO1xyXG4gICAgcmV0dXJuIHByaW1hcnkgPyBbcHJpbWFyeV0gOiBbXTtcclxuICB9XHJcblxyXG4gIHRyYWNrQnlBdHRhY2htZW50KGluZGV4OiBudW1iZXIsIGF0dGFjaG1lbnQ6IEF0dGFjaG1lbnQpOiBzdHJpbmcge1xyXG4gICAgcmV0dXJuIGF0dGFjaG1lbnQuZmlsZV9pZCB8fCBhdHRhY2htZW50LnVybCB8fCBgJHthdHRhY2htZW50LmZpbGVuYW1lfS0ke2luZGV4fWA7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGdldEFsbEF0dGFjaG1lbnRzKG1zZzogTWVzc2FnZSk6IEF0dGFjaG1lbnRbXSB7XHJcbiAgICBjb25zdCBhbnlNc2cgPSBtc2cgYXMgYW55O1xyXG4gICAgY29uc3QgYXR0YWNobWVudHM6IEF0dGFjaG1lbnRbXSA9IFtdO1xyXG4gICAgY29uc3QgYWRkID0gKGF0dGFjaG1lbnQ6IFBhcnRpYWw8QXR0YWNobWVudD4gfCBzdHJpbmcgfCBudWxsIHwgdW5kZWZpbmVkKTogdm9pZCA9PiB7XHJcbiAgICAgIGNvbnN0IHJhdyA9IGF0dGFjaG1lbnQgYXMgYW55O1xyXG4gICAgICBjb25zdCBmaWxlSWQgPSBTdHJpbmcoXHJcbiAgICAgICAgdHlwZW9mIGF0dGFjaG1lbnQgPT09ICdzdHJpbmcnID8gYXR0YWNobWVudCA6XHJcbiAgICAgICAgcmF3Py5maWxlX2lkID8/XHJcbiAgICAgICAgcmF3Py5maWxlSWQgPz9cclxuICAgICAgICByYXc/LmlkID8/XHJcbiAgICAgICAgcmF3Py5hdHRhY2htZW50X2lkID8/XHJcbiAgICAgICAgcmF3Py5zdG9yYWdlX2ZpbGVfaWQgPz9cclxuICAgICAgICAnJ1xyXG4gICAgICApLnRyaW0oKTtcclxuICAgICAgaWYgKGZpbGVJZC5zdGFydHNXaXRoKCd7JykgfHwgZmlsZUlkLnN0YXJ0c1dpdGgoJ1snKSkge1xyXG4gICAgICAgIGNvbnN0IGlkcyA9IHRoaXMudG9BcnJheShmaWxlSWQpO1xyXG4gICAgICAgIGNvbnN0IGZpbGVuYW1lcyA9IHRoaXMudG9BcnJheShyYXc/LmZpbGVuYW1lcyA/PyByYXc/LmZpbGVuYW1lID8/IHJhdz8uZmlsZV9uYW1lKTtcclxuICAgICAgICBjb25zdCBtaW1lVHlwZXMgPSB0aGlzLnRvQXJyYXkocmF3Py5taW1lX3R5cGVzID8/IHJhdz8ubWltZVR5cGVzID8/IHJhdz8ubWltZV90eXBlKTtcclxuICAgICAgICBpZHMuZm9yRWFjaCgoaWQsIGlkeCkgPT4ge1xyXG4gICAgICAgICAgYWRkKHtcclxuICAgICAgICAgICAgZmlsZV9pZDogaWQsXHJcbiAgICAgICAgICAgIGZpbGVuYW1lOiBmaWxlbmFtZXNbaWR4XSB8fCBmaWxlbmFtZXNbMF0gfHwgcmF3Py5maWxlbmFtZSB8fCByYXc/LmZpbGVfbmFtZSB8fCBgQXR0YWNobWVudCAke2lkeCArIDF9YCxcclxuICAgICAgICAgICAgbWltZV90eXBlOiBtaW1lVHlwZXNbaWR4XSB8fCByYXc/Lm1pbWVfdHlwZSB8fCByYXc/Lm1pbWVUeXBlLFxyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICB9XHJcbiAgICAgIGNvbnN0IHVybCA9IFN0cmluZyhyYXc/LnVybCA/PyByYXc/LmZpbGVfdXJsID8/IHJhdz8uZG93bmxvYWRfdXJsID8/ICcnKS50cmltKCk7XHJcbiAgICAgIGlmICghZmlsZUlkICYmICF1cmwpIHJldHVybjtcclxuICAgICAgaWYgKGZpbGVJZCAmJiBhdHRhY2htZW50cy5zb21lKChhKSA9PiBhLmZpbGVfaWQgPT09IGZpbGVJZCkpIHJldHVybjtcclxuICAgICAgaWYgKCFmaWxlSWQgJiYgdXJsICYmIGF0dGFjaG1lbnRzLnNvbWUoKGEpID0+IGEudXJsID09PSB1cmwpKSByZXR1cm47XHJcbiAgICAgIGF0dGFjaG1lbnRzLnB1c2goe1xyXG4gICAgICAgIGZpbGVfaWQ6IGZpbGVJZCxcclxuICAgICAgICBmaWxlbmFtZTogU3RyaW5nKFxyXG4gICAgICAgICAgcmF3Py5maWxlbmFtZSA/P1xyXG4gICAgICAgICAgcmF3Py5maWxlX25hbWUgPz9cclxuICAgICAgICAgIHJhdz8ubmFtZSA/P1xyXG4gICAgICAgICAgKG1zZy5tZXNzYWdlX3R5cGUgPT09ICdJTUFHRScgPyAnSW1hZ2UnIDogJ0ZpbGUnKVxyXG4gICAgICAgICksXHJcbiAgICAgICAgbWltZV90eXBlOiByYXc/Lm1pbWVfdHlwZSA/PyByYXc/Lm1pbWVUeXBlID8/IChtc2cubWVzc2FnZV90eXBlID09PSAnSU1BR0UnID8gJ2ltYWdlLyonIDogdW5kZWZpbmVkKSxcclxuICAgICAgICBzaXplX2J5dGVzOiByYXc/LnNpemVfYnl0ZXMgPz8gcmF3Py5zaXplQnl0ZXMsXHJcbiAgICAgICAgdXJsOiB1cmwgfHwgdW5kZWZpbmVkLFxyXG4gICAgICB9KTtcclxuICAgIH07XHJcblxyXG4gICAgaWYgKEFycmF5LmlzQXJyYXkobXNnLmF0dGFjaG1lbnRzKSkge1xyXG4gICAgICBtc2cuYXR0YWNobWVudHMuZm9yRWFjaChhZGQpO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IG1lZGlhVmFsdWUgPSBTdHJpbmcobXNnLm1lZGlhX3VybCB8fCAnJykudHJpbSgpO1xyXG4gICAgaWYgKG1lZGlhVmFsdWUuc3RhcnRzV2l0aCgneycpIHx8IG1lZGlhVmFsdWUuc3RhcnRzV2l0aCgnWycpKSB7XHJcbiAgICAgIHRyeSB7XHJcbiAgICAgICAgY29uc3QgcGFyc2VkID0gSlNPTi5wYXJzZShtZWRpYVZhbHVlKTtcclxuICAgICAgICBjb25zdCBtZWRpYUF0dGFjaG1lbnRzID0gQXJyYXkuaXNBcnJheShwYXJzZWQpID8gcGFyc2VkIDogcGFyc2VkPy5hdHRhY2htZW50cztcclxuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShtZWRpYUF0dGFjaG1lbnRzKSkge1xyXG4gICAgICAgICAgbWVkaWFBdHRhY2htZW50cy5mb3JFYWNoKGFkZCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICghQXJyYXkuaXNBcnJheShwYXJzZWQpKSB7XHJcbiAgICAgICAgICBjb25zdCBpZHMgPSB0aGlzLnRvQXJyYXkocGFyc2VkPy5pZHMgPz8gcGFyc2VkPy5maWxlX2lkcyA/PyBwYXJzZWQ/LmF0dGFjaG1lbnRfaWRzKTtcclxuICAgICAgICAgIGNvbnN0IGZpbGVuYW1lcyA9IHRoaXMudG9BcnJheShwYXJzZWQ/LmZpbGVuYW1lcyk7XHJcbiAgICAgICAgICBjb25zdCBtaW1lVHlwZXMgPSB0aGlzLnRvQXJyYXkocGFyc2VkPy5taW1lX3R5cGVzID8/IHBhcnNlZD8ubWltZVR5cGVzKTtcclxuICAgICAgICAgIGlkcy5mb3JFYWNoKChpZCwgaWR4KSA9PiB7XHJcbiAgICAgICAgICAgIGFkZCh7XHJcbiAgICAgICAgICAgICAgZmlsZV9pZDogaWQsXHJcbiAgICAgICAgICAgICAgZmlsZW5hbWU6IGZpbGVuYW1lc1tpZHhdIHx8IGZpbGVuYW1lc1swXSB8fCAobXNnLm1lc3NhZ2VfdHlwZSA9PT0gJ0lNQUdFJyA/IGBJbWFnZSAke2lkeCArIDF9YCA6IGBBdHRhY2htZW50ICR7aWR4ICsgMX1gKSxcclxuICAgICAgICAgICAgICBtaW1lX3R5cGU6IG1pbWVUeXBlc1tpZHhdIHx8IChtc2cubWVzc2FnZV90eXBlID09PSAnSU1BR0UnID8gJ2ltYWdlLyonIDogdW5kZWZpbmVkKSxcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICAgIH0gY2F0Y2gge1xyXG4gICAgICAgIC8vIE5vbi1KU09OIG1lZGlhX3VybCB2YWx1ZXMgYXJlIGhhbmRsZWQgYnkgZ2V0UHJpbWFyeUF0dGFjaG1lbnQoKS5cclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGlkcyA9IHRoaXMudG9BcnJheShhbnlNc2c/LmF0dGFjaG1lbnRfaWRzID8/IGFueU1zZz8uZmlsZV9pZHMpO1xyXG4gICAgY29uc3QgZmlsZW5hbWVzID0gdGhpcy50b0FycmF5KGFueU1zZz8uZmlsZW5hbWVzKTtcclxuICAgIGNvbnN0IG1pbWVUeXBlcyA9IHRoaXMudG9BcnJheShhbnlNc2c/Lm1pbWVfdHlwZXMgPz8gYW55TXNnPy5taW1lVHlwZXMpO1xyXG4gICAgaWRzLmZvckVhY2goKGlkLCBpZHgpID0+IHtcclxuICAgICAgYWRkKHtcclxuICAgICAgICBmaWxlX2lkOiBpZCxcclxuICAgICAgICBmaWxlbmFtZTogZmlsZW5hbWVzW2lkeF0gfHwgZmlsZW5hbWVzWzBdIHx8IChtc2cubWVzc2FnZV90eXBlID09PSAnSU1BR0UnID8gYEltYWdlICR7aWR4ICsgMX1gIDogYEF0dGFjaG1lbnQgJHtpZHggKyAxfWApLFxyXG4gICAgICAgIG1pbWVfdHlwZTogbWltZVR5cGVzW2lkeF0gfHwgYW55TXNnPy5taW1lX3R5cGUgfHwgYW55TXNnPy5hdHRhY2htZW50X21pbWVfdHlwZSB8fCAobXNnLm1lc3NhZ2VfdHlwZSA9PT0gJ0lNQUdFJyA/ICdpbWFnZS8qJyA6IHVuZGVmaW5lZCksXHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcblxyXG4gICAgcmV0dXJuIGF0dGFjaG1lbnRzO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSB0b0FycmF5KHZhbHVlOiB1bmtub3duKTogc3RyaW5nW10ge1xyXG4gICAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSB7XHJcbiAgICAgIHJldHVybiB2YWx1ZVxyXG4gICAgICAgIC5tYXAoKHg6IGFueSkgPT4gKHR5cGVvZiB4ID09PSAnc3RyaW5nJyA/IHggOiB4Py5maWxlX2lkID8/IHg/LmlkID8/ICcnKSlcclxuICAgICAgICAubWFwKCh4KSA9PiBTdHJpbmcoeCkudHJpbSgpKVxyXG4gICAgICAgIC5maWx0ZXIoQm9vbGVhbik7XHJcbiAgICB9XHJcbiAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJyAmJiB2YWx1ZS50cmltKCkpIHtcclxuICAgICAgY29uc3QgdHJpbW1lZCA9IHZhbHVlLnRyaW0oKTtcclxuICAgICAgaWYgKHRyaW1tZWQuc3RhcnRzV2l0aCgneycpIHx8IHRyaW1tZWQuc3RhcnRzV2l0aCgnWycpKSB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgIGNvbnN0IHBhcnNlZCA9IEpTT04ucGFyc2UodHJpbW1lZCk7XHJcbiAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShwYXJzZWQpKSByZXR1cm4gdGhpcy50b0FycmF5KHBhcnNlZCk7XHJcbiAgICAgICAgICByZXR1cm4gdGhpcy50b0FycmF5KHBhcnNlZD8uaWRzID8/IHBhcnNlZD8uZmlsZV9pZHMgPz8gcGFyc2VkPy5hdHRhY2htZW50X2lkcyA/PyBwYXJzZWQ/LmF0dGFjaG1lbnRzKTtcclxuICAgICAgICB9IGNhdGNoIHtcclxuICAgICAgICAgIHJldHVybiBbXTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIHZhbHVlXHJcbiAgICAgICAgLnNwbGl0KC9bLFxcc10rLylcclxuICAgICAgICAubWFwKCh4KSA9PiB4LnRyaW0oKSlcclxuICAgICAgICAuZmlsdGVyKEJvb2xlYW4pO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIFtdO1xyXG4gIH1cclxuXHJcbiAgLyoqIFJldHVybnMgdGhlIHByaW1hcnkgYXR0YWNobWVudCBmb3IgYSBtZXNzYWdlLCBpZiBhbnkuICovXHJcbiAgcHJpdmF0ZSBnZXRQcmltYXJ5QXR0YWNobWVudChtc2c6IE1lc3NhZ2UpOiBBdHRhY2htZW50IHwgbnVsbCB7XHJcbiAgICBjb25zdCBhdHRhY2htZW50cyA9IHRoaXMuZ2V0QWxsQXR0YWNobWVudHMobXNnKTtcclxuICAgIGlmIChhdHRhY2htZW50cy5sZW5ndGggPiAwKSByZXR1cm4gYXR0YWNobWVudHNbMF07XHJcblxyXG4gICAgLy8gU29tZSBBUEkgcmVzcG9uc2VzIHByb3ZpZGUgZmlsZSBtZXRhZGF0YSBpbiBhbHRlcm5hdGUgZmllbGRzLlxyXG4gICAgY29uc3QgYW55TXNnID0gbXNnIGFzIGFueTtcclxuICAgIGNvbnN0IG11ID0gU3RyaW5nKG1zZy5tZWRpYV91cmwgfHwgJycpLnRyaW0oKTtcclxuICAgIGNvbnN0IG1lZGlhSXNEaXJlY3RVcmwgPVxyXG4gICAgICBtdS5zdGFydHNXaXRoKCdodHRwOi8vJykgfHwgbXUuc3RhcnRzV2l0aCgnaHR0cHM6Ly8nKSB8fCBtdS5zdGFydHNXaXRoKCdkYXRhOicpO1xyXG4gICAgY29uc3QgbWVkaWFJc1N0cnVjdHVyZWQgPSBtdS5zdGFydHNXaXRoKCd7JykgfHwgbXUuc3RhcnRzV2l0aCgnWycpO1xyXG4gICAgY29uc3QgZmlsZUlkID1cclxuICAgICAgYW55TXNnPy5maWxlX2lkIHx8XHJcbiAgICAgIGFueU1zZz8uYXR0YWNobWVudF9pZCB8fFxyXG4gICAgICBhbnlNc2c/LmF0dGFjaG1lbnRfaWRzPy5bMF0gfHxcclxuICAgICAgKCFtZWRpYUlzRGlyZWN0VXJsICYmICFtZWRpYUlzU3RydWN0dXJlZCAmJiBtdSA/IG11IDogdW5kZWZpbmVkKTtcclxuICAgIGNvbnN0IG1pbWUgPSBhbnlNc2c/Lm1pbWVfdHlwZSB8fCBhbnlNc2c/LmF0dGFjaG1lbnRfbWltZV90eXBlIHx8IChtc2cubWVzc2FnZV90eXBlID09PSAnSU1BR0UnID8gJ2ltYWdlLyonIDogdW5kZWZpbmVkKTtcclxuICAgIGNvbnN0IGV4cGxpY2l0RmlsZW5hbWUgPSBhbnlNc2c/LmZpbGVuYW1lIHx8IGFueU1zZz8uZmlsZV9uYW1lO1xyXG4gICAgY29uc3QgZmlsZW5hbWUgPVxyXG4gICAgICBleHBsaWNpdEZpbGVuYW1lIHx8XHJcbiAgICAgIChtc2cubWVzc2FnZV90eXBlID09PSAnSU1BR0UnID8gJ0ltYWdlJyA6IG1zZy5tZXNzYWdlX3R5cGUgPT09ICdGSUxFJyA/ICdGaWxlJyA6ICcnKTtcclxuICAgIGlmIChmaWxlSWQgfHwgZXhwbGljaXRGaWxlbmFtZSB8fCBtaW1lIHx8IG1zZy5tZXNzYWdlX3R5cGUgPT09ICdGSUxFJyB8fCBtc2cubWVzc2FnZV90eXBlID09PSAnSU1BR0UnKSB7XHJcbiAgICAgIHJldHVybiB7XHJcbiAgICAgICAgZmlsZV9pZDogU3RyaW5nKGZpbGVJZCB8fCAnJyksXHJcbiAgICAgICAgZmlsZW5hbWU6IFN0cmluZyhmaWxlbmFtZSB8fCAnRmlsZScpLFxyXG4gICAgICAgIG1pbWVfdHlwZTogbWltZSA/IFN0cmluZyhtaW1lKSA6IHVuZGVmaW5lZCxcclxuICAgICAgICB1cmw6IG1lZGlhSXNEaXJlY3RVcmwgPyBtdSA6IHVuZGVmaW5lZCxcclxuICAgICAgfTtcclxuICAgIH1cclxuICAgIHJldHVybiBudWxsO1xyXG4gIH1cclxuXHJcbiAgaXNJbWFnZUF0dGFjaG1lbnQobXNnOiBNZXNzYWdlLCBhdHRhY2htZW50PzogQXR0YWNobWVudCk6IGJvb2xlYW4ge1xyXG4gICAgY29uc3QgbWltZSA9IGF0dGFjaG1lbnQ/Lm1pbWVfdHlwZSB8fCB0aGlzLmdldFByaW1hcnlBdHRhY2htZW50KG1zZyk/Lm1pbWVfdHlwZSB8fCAnJztcclxuICAgIGlmIChtaW1lLnN0YXJ0c1dpdGgoJ2ltYWdlLycpKSByZXR1cm4gdHJ1ZTtcclxuICAgIGNvbnN0IG5hbWUgPSB0aGlzLmdldEZpbGVuYW1lTGlrZShtc2csIGF0dGFjaG1lbnQpO1xyXG4gICAgaWYgKC9cXC4ocG5nfGpwZT9nfGdpZnx3ZWJwfGJtcHxzdmd8aGVpY3xoZWlmKSQvaS50ZXN0KG5hbWUpKSByZXR1cm4gdHJ1ZTtcclxuICAgIHJldHVybiBtc2cubWVzc2FnZV90eXBlID09PSAnSU1BR0UnO1xyXG4gIH1cclxuXHJcbiAgLyoqIFJldHVybnMgdGhlIGNhY2hlZCBkYXRhIFVSTCBmb3IgYSBtZXNzYWdlJ3MgbWVkaWEsIG9yIG51bGwgYW5kIHRyaWdnZXJzIGJhY2tncm91bmQgbG9hZC4gKi9cclxuICBnZXRNZWRpYVVybChtc2c6IE1lc3NhZ2UsIGF0dGFjaG1lbnQ/OiBBdHRhY2htZW50KTogc3RyaW5nIHwgbnVsbCB7XHJcbiAgICBjb25zdCBhdHQgPSBhdHRhY2htZW50IHx8IHRoaXMuZ2V0UHJpbWFyeUF0dGFjaG1lbnQobXNnKTtcclxuICAgIGNvbnN0IGZpbGVJZCA9IGF0dD8uZmlsZV9pZD8udHJpbSgpO1xyXG5cclxuICAgIGNvbnN0IGRpcmVjdFVybCA9XHJcbiAgICAgIGF0dD8udXJsIHx8XHJcbiAgICAgICghYXR0YWNobWVudCA/IG1zZy5tZWRpYV91cmwgOiB1bmRlZmluZWQpIHx8XHJcbiAgICAgICghYXR0YWNobWVudCA/IChtc2cgYXMgYW55KT8udXJsIDogdW5kZWZpbmVkKSB8fFxyXG4gICAgICAoIWF0dGFjaG1lbnQgPyAobXNnIGFzIGFueSk/LmZpbGVfdXJsIDogdW5kZWZpbmVkKTtcclxuICAgIGlmIChcclxuICAgICAgZGlyZWN0VXJsICYmXHJcbiAgICAgIChkaXJlY3RVcmwuc3RhcnRzV2l0aCgnaHR0cDovLycpIHx8XHJcbiAgICAgICAgZGlyZWN0VXJsLnN0YXJ0c1dpdGgoJ2h0dHBzOi8vJykgfHxcclxuICAgICAgICBkaXJlY3RVcmwuc3RhcnRzV2l0aCgnZGF0YTonKSlcclxuICAgICkge1xyXG4gICAgICByZXR1cm4gZGlyZWN0VXJsO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICghZmlsZUlkKSB7XHJcbiAgICAgIHJldHVybiBudWxsO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGNhY2hlZCA9IHRoaXMuZmlsZVNlcnZpY2UuZ2V0Q2FjaGVkRGF0YVVybChmaWxlSWQpO1xyXG4gICAgaWYgKGNhY2hlZCkgcmV0dXJuIGNhY2hlZDtcclxuICAgIGlmICh0aGlzLm1lZGlhRmFpbGVkLmhhcyhmaWxlSWQpKSByZXR1cm4gbnVsbDtcclxuXHJcbiAgICAvLyBOb3QgeWV0IGNhY2hlZCDigJQga2ljayBvZmYgYSBiYWNrZ3JvdW5kIGZldGNoXHJcbiAgICB0aGlzLmZldGNoTWVkaWEoZmlsZUlkKTtcclxuICAgIHJldHVybiBudWxsO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBwcmV3YXJtTWVkaWEobWVzc2FnZXM6IE1lc3NhZ2VbXSk6IHZvaWQge1xyXG4gICAgZm9yIChjb25zdCBtc2cgb2YgbWVzc2FnZXMpIHtcclxuICAgICAgZm9yIChjb25zdCBhdHQgb2YgdGhpcy5nZXRSZW5kZXJhYmxlQXR0YWNobWVudHMobXNnKSkge1xyXG4gICAgICAgIGlmICghdGhpcy5pc0ltYWdlQXR0YWNobWVudChtc2csIGF0dCkpIGNvbnRpbnVlO1xyXG4gICAgICAgIGNvbnN0IGZpbGVJZCA9IGF0dC5maWxlX2lkPy50cmltKCk7XHJcbiAgICAgICAgaWYgKCFmaWxlSWQgfHwgZmlsZUlkLnN0YXJ0c1dpdGgoJ3RlbXAtJykpIGNvbnRpbnVlO1xyXG4gICAgICAgIGlmICh0aGlzLm1lZGlhRmFpbGVkLmhhcyhmaWxlSWQpKSBjb250aW51ZTtcclxuICAgICAgICBpZiAodGhpcy5maWxlU2VydmljZS5nZXRDYWNoZWREYXRhVXJsKGZpbGVJZCkpIGNvbnRpbnVlO1xyXG4gICAgICAgIC8vIFF1ZXVlIGFsbCBmaWxlcyBzbyBkb3dubG9hZCBsaW5rcyBhcHBlYXIgb25jZSByZXRyaWV2YWwgY29tcGxldGVzLlxyXG4gICAgICAgIHRoaXMuZmV0Y2hNZWRpYShmaWxlSWQpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGZldGNoTWVkaWEoZmlsZUlkOiBzdHJpbmcpOiB2b2lkIHtcclxuICAgIGlmICghZmlsZUlkIHx8IGZpbGVJZC5zdGFydHNXaXRoKCd0ZW1wLScpIHx8IHRoaXMubWVkaWFMb2FkaW5nLmhhcyhmaWxlSWQpIHx8IHRoaXMubWVkaWFGYWlsZWQuaGFzKGZpbGVJZCkpIHJldHVybjtcclxuICAgIHRoaXMubWVkaWFMb2FkaW5nLmFkZChmaWxlSWQpO1xyXG4gICAgdGhpcy5tZWRpYVF1ZXVlLnB1c2goZmlsZUlkKTtcclxuICAgIHRoaXMucHVtcE1lZGlhUXVldWUoKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgcHVtcE1lZGlhUXVldWUoKTogdm9pZCB7XHJcbiAgICB3aGlsZSAodGhpcy5hY3RpdmVNZWRpYVJlcXVlc3RzIDwgdGhpcy5tYXhNZWRpYVJlcXVlc3RzICYmIHRoaXMubWVkaWFRdWV1ZS5sZW5ndGggPiAwKSB7XHJcbiAgICAgIGNvbnN0IGZpbGVJZCA9IHRoaXMubWVkaWFRdWV1ZS5zaGlmdCgpO1xyXG4gICAgICBpZiAoIWZpbGVJZCkgY29udGludWU7XHJcbiAgICAgIHRoaXMuYWN0aXZlTWVkaWFSZXF1ZXN0cyArPSAxO1xyXG5cclxuICAgICAgdGhpcy5maWxlU2VydmljZS5nZXRGaWxlRGF0YVVybChmaWxlSWQpLnN1YnNjcmliZSh7XHJcbiAgICAgICAgbmV4dDogKCkgPT4ge1xyXG4gICAgICAgICAgdGhpcy5maW5pc2hNZWRpYVJlcXVlc3QoZmlsZUlkKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGVycm9yOiAoKSA9PiB7XHJcbiAgICAgICAgICB0aGlzLm1lZGlhRmFpbGVkLmFkZChmaWxlSWQpO1xyXG4gICAgICAgICAgdGhpcy5maW5pc2hNZWRpYVJlcXVlc3QoZmlsZUlkKTtcclxuICAgICAgICB9LFxyXG4gICAgICB9KTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHByaXZhdGUgZmluaXNoTWVkaWFSZXF1ZXN0KGZpbGVJZDogc3RyaW5nKTogdm9pZCB7XHJcbiAgICB0aGlzLmFjdGl2ZU1lZGlhUmVxdWVzdHMgPSBNYXRoLm1heCgwLCB0aGlzLmFjdGl2ZU1lZGlhUmVxdWVzdHMgLSAxKTtcclxuICAgIHRoaXMubWVkaWFMb2FkaW5nLmRlbGV0ZShmaWxlSWQpO1xyXG4gICAgdGhpcy5jZHIubWFya0ZvckNoZWNrKCk7XHJcbiAgICB0aGlzLnB1bXBNZWRpYVF1ZXVlKCk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHJlc2V0TWVkaWFRdWV1ZSgpOiB2b2lkIHtcclxuICAgIHRoaXMubWVkaWFRdWV1ZSA9IFtdO1xyXG4gICAgdGhpcy5tZWRpYUxvYWRpbmcuY2xlYXIoKTtcclxuICAgIHRoaXMuYWN0aXZlTWVkaWFSZXF1ZXN0cyA9IDA7XHJcbiAgfVxyXG5cclxuICBzaG91bGRTaG93TWVkaWFTcGlubmVyKHRhcmdldDogTWVzc2FnZSB8IEF0dGFjaG1lbnQpOiBib29sZWFuIHtcclxuICAgIGNvbnN0IGZpbGVJZCA9IHRoaXMuZ2V0QXR0YWNobWVudEZpbGVJZCh0YXJnZXQpO1xyXG4gICAgaWYgKCFmaWxlSWQgfHwgZmlsZUlkLnN0YXJ0c1dpdGgoJ3RlbXAtJykpIHJldHVybiBmYWxzZTtcclxuICAgIHJldHVybiB0aGlzLm1lZGlhTG9hZGluZy5oYXMoZmlsZUlkKSAmJiAhdGhpcy5tZWRpYUZhaWxlZC5oYXMoZmlsZUlkKTtcclxuICB9XHJcblxyXG4gIGlzVmlkZW9BdHRhY2htZW50KG1zZzogTWVzc2FnZSwgYXR0YWNobWVudD86IEF0dGFjaG1lbnQpOiBib29sZWFuIHtcclxuICAgIGNvbnN0IG1pbWUgPSBhdHRhY2htZW50Py5taW1lX3R5cGUgfHwgdGhpcy5nZXRQcmltYXJ5QXR0YWNobWVudChtc2cpPy5taW1lX3R5cGUgfHwgJyc7XHJcbiAgICBpZiAobWltZS5zdGFydHNXaXRoKCd2aWRlby8nKSkgcmV0dXJuIHRydWU7XHJcbiAgICBjb25zdCBuYW1lID0gdGhpcy5nZXRGaWxlbmFtZUxpa2UobXNnLCBhdHRhY2htZW50KTtcclxuICAgIHJldHVybiAvXFwuKG1wNHx3ZWJtfG1vdnxtNHZ8YXZpfG1rdikkL2kudGVzdChuYW1lKTtcclxuICB9XHJcblxyXG4gIGdldEF0dGFjaG1lbnRNaW1lVHlwZShtc2c6IE1lc3NhZ2UsIGF0dGFjaG1lbnQ/OiBBdHRhY2htZW50KTogc3RyaW5nIHtcclxuICAgIHJldHVybiBhdHRhY2htZW50Py5taW1lX3R5cGUgfHwgdGhpcy5nZXRQcmltYXJ5QXR0YWNobWVudChtc2cpPy5taW1lX3R5cGUgfHwgJ2FwcGxpY2F0aW9uL29jdGV0LXN0cmVhbSc7XHJcbiAgfVxyXG5cclxuICBnZXRBdHRhY2htZW50TmFtZShtc2c6IE1lc3NhZ2UsIGF0dGFjaG1lbnQ/OiBBdHRhY2htZW50KTogc3RyaW5nIHtcclxuICAgIHJldHVybiBhdHRhY2htZW50Py5maWxlbmFtZSB8fCB0aGlzLmdldFByaW1hcnlBdHRhY2htZW50KG1zZyk/LmZpbGVuYW1lIHx8IG1zZy5jb250ZW50IHx8ICdGaWxlJztcclxuICB9XHJcblxyXG4gIGhhc0ZpbGVBdHRhY2htZW50KG1zZzogTWVzc2FnZSk6IGJvb2xlYW4ge1xyXG4gICAgcmV0dXJuIG1zZy5tZXNzYWdlX3R5cGUgPT09ICdGSUxFJyB8fCB0aGlzLmdldFJlbmRlcmFibGVBdHRhY2htZW50cyhtc2cpLmxlbmd0aCA+IDA7XHJcbiAgfVxyXG5cclxuICBoYXNNZWRpYUZhaWxlZCh0YXJnZXQ6IE1lc3NhZ2UgfCBBdHRhY2htZW50KTogYm9vbGVhbiB7XHJcbiAgICBjb25zdCBmaWxlSWQgPSB0aGlzLmdldEF0dGFjaG1lbnRGaWxlSWQodGFyZ2V0KTtcclxuICAgIHJldHVybiAhIWZpbGVJZCAmJiB0aGlzLm1lZGlhRmFpbGVkLmhhcyhmaWxlSWQpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBnZXRBdHRhY2htZW50RmlsZUlkKHRhcmdldDogTWVzc2FnZSB8IEF0dGFjaG1lbnQpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xyXG4gICAgaWYgKCdmaWxlX2lkJyBpbiB0YXJnZXQpIHJldHVybiB0YXJnZXQuZmlsZV9pZDtcclxuICAgIHJldHVybiB0aGlzLmdldFByaW1hcnlBdHRhY2htZW50KHRhcmdldCk/LmZpbGVfaWQ7XHJcbiAgfVxyXG5cclxuICBnZXRGaWxlSWNvbihtc2c6IE1lc3NhZ2UsIGF0dGFjaG1lbnQ/OiBBdHRhY2htZW50KTogc3RyaW5nIHtcclxuICAgIGNvbnN0IG1pbWUgPSB0aGlzLmdldEF0dGFjaG1lbnRNaW1lVHlwZShtc2csIGF0dGFjaG1lbnQpO1xyXG4gICAgY29uc3QgbmFtZSA9IHRoaXMuZ2V0QXR0YWNobWVudE5hbWUobXNnLCBhdHRhY2htZW50KS50b0xvd2VyQ2FzZSgpO1xyXG4gICAgaWYgKG1pbWUuc3RhcnRzV2l0aCgndmlkZW8vJykgfHwgL1xcLihtcDR8d2VibXxtb3Z8bTR2fGF2aXxta3YpJC9pLnRlc3QobmFtZSkpIHJldHVybiAndmlkZW9jYW0nO1xyXG4gICAgaWYgKG1pbWUuc3RhcnRzV2l0aCgnYXVkaW8vJykgfHwgL1xcLihtcDN8d2F2fG9nZ3xtNGF8ZmxhYykkL2kudGVzdChuYW1lKSkgcmV0dXJuICdhdWRpb3RyYWNrJztcclxuICAgIGlmIChtaW1lLmluY2x1ZGVzKCdwZGYnKSB8fCBuYW1lLmVuZHNXaXRoKCcucGRmJykpIHJldHVybiAncGljdHVyZV9hc19wZGYnO1xyXG4gICAgaWYgKG1pbWUuaW5jbHVkZXMoJ3NwcmVhZHNoZWV0JykgfHwgbWltZS5pbmNsdWRlcygnZXhjZWwnKSB8fCAvXFwuKHhsc3x4bHN4fGNzdikkL2kudGVzdChuYW1lKSkgcmV0dXJuICd0YWJsZV9jaGFydCc7XHJcbiAgICBpZiAobWltZS5pbmNsdWRlcygnZG9jdW1lbnQnKSB8fCBtaW1lLmluY2x1ZGVzKCd3b3JkJykgfHwgL1xcLihkb2N8ZG9jeHx0eHR8cnRmKSQvaS50ZXN0KG5hbWUpKSByZXR1cm4gJ2Rlc2NyaXB0aW9uJztcclxuICAgIGlmIChtaW1lLmluY2x1ZGVzKCd6aXAnKSB8fCAvXFwuKHppcHxyYXJ8N3p8dGFyfGd6KSQvaS50ZXN0KG5hbWUpKSByZXR1cm4gJ2ZvbGRlcl96aXAnO1xyXG4gICAgcmV0dXJuICdpbnNlcnRfZHJpdmVfZmlsZSc7XHJcbiAgfVxyXG5cclxuICBvcGVuTGlnaHRib3goZGF0YVVybDogc3RyaW5nLCBldmVudD86IEV2ZW50KTogdm9pZCB7XHJcbiAgICBldmVudD8uc3RvcFByb3BhZ2F0aW9uKCk7XHJcbiAgICB0aGlzLmxpZ2h0Ym94T3Blbi5lbWl0KGRhdGFVcmwpO1xyXG4gIH1cclxuXHJcbiAgZG93bmxvYWRBdHRhY2htZW50KG1zZzogTWVzc2FnZSwgYXR0YWNobWVudDogQXR0YWNobWVudCwgZXZlbnQ/OiBFdmVudCk6IHZvaWQge1xyXG4gICAgZXZlbnQ/LnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICBldmVudD8uc3RvcFByb3BhZ2F0aW9uKCk7XHJcblxyXG4gICAgY29uc3QgZGlyZWN0VXJsID0gYXR0YWNobWVudC51cmw7XHJcbiAgICBpZiAoZGlyZWN0VXJsICYmIC9eKGh0dHBzPzp8ZGF0YTopL2kudGVzdChkaXJlY3RVcmwpKSB7XHJcbiAgICAgIHRoaXMudHJpZ2dlckRvd25sb2FkKGRpcmVjdFVybCwgdGhpcy5nZXRBdHRhY2htZW50TmFtZShtc2csIGF0dGFjaG1lbnQpKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGZpbGVJZCA9IGF0dGFjaG1lbnQuZmlsZV9pZD8udHJpbSgpO1xyXG4gICAgaWYgKCFmaWxlSWQgfHwgZmlsZUlkLnN0YXJ0c1dpdGgoJ3RlbXAtJykgfHwgZmlsZUlkLnN0YXJ0c1dpdGgoJ3snKSB8fCBmaWxlSWQuc3RhcnRzV2l0aCgnWycpKSB7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBjYWNoZWQgPSB0aGlzLmZpbGVTZXJ2aWNlLmdldENhY2hlZERhdGFVcmwoZmlsZUlkKTtcclxuICAgIGlmIChjYWNoZWQpIHtcclxuICAgICAgdGhpcy50cmlnZ2VyRG93bmxvYWQoY2FjaGVkLCB0aGlzLmdldEF0dGFjaG1lbnROYW1lKG1zZywgYXR0YWNobWVudCkpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5tZWRpYUxvYWRpbmcuYWRkKGZpbGVJZCk7XHJcbiAgICB0aGlzLmZpbGVTZXJ2aWNlLmdldEZpbGVEYXRhVXJsKGZpbGVJZCkuc3Vic2NyaWJlKHtcclxuICAgICAgbmV4dDogKGRhdGFVcmwpID0+IHtcclxuICAgICAgICB0aGlzLm1lZGlhTG9hZGluZy5kZWxldGUoZmlsZUlkKTtcclxuICAgICAgICB0aGlzLnRyaWdnZXJEb3dubG9hZChkYXRhVXJsLCB0aGlzLmdldEF0dGFjaG1lbnROYW1lKG1zZywgYXR0YWNobWVudCkpO1xyXG4gICAgICAgIHRoaXMuY2RyLm1hcmtGb3JDaGVjaygpO1xyXG4gICAgICB9LFxyXG4gICAgICBlcnJvcjogKCkgPT4ge1xyXG4gICAgICAgIHRoaXMubWVkaWFMb2FkaW5nLmRlbGV0ZShmaWxlSWQpO1xyXG4gICAgICAgIHRoaXMubWVkaWFGYWlsZWQuYWRkKGZpbGVJZCk7XHJcbiAgICAgICAgdGhpcy5jZHIubWFya0ZvckNoZWNrKCk7XHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgdHJpZ2dlckRvd25sb2FkKHVybDogc3RyaW5nLCBmaWxlbmFtZTogc3RyaW5nKTogdm9pZCB7XHJcbiAgICBjb25zdCBsaW5rID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYScpO1xyXG4gICAgbGluay5ocmVmID0gdXJsO1xyXG4gICAgbGluay5kb3dubG9hZCA9IGZpbGVuYW1lIHx8ICdhdHRhY2htZW50JztcclxuICAgIGxpbmsudGFyZ2V0ID0gJ19ibGFuayc7XHJcbiAgICBsaW5rLnJlbCA9ICdub29wZW5lcic7XHJcbiAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGxpbmspO1xyXG4gICAgbGluay5jbGljaygpO1xyXG4gICAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZChsaW5rKTtcclxuICB9XHJcblxyXG4gIC8vIOKUgOKUgCBSZWFjdGlvbnMg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcblxyXG4gIG9uRW1vamlTZWxlY3RlZChlbW9qaTogc3RyaW5nLCBtZXNzYWdlSWQ6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgdGhpcy50b2dnbGVSZWFjdGlvbihlbW9qaSwgbWVzc2FnZUlkKTtcclxuICB9XHJcblxyXG4gIHRvZ2dsZVJlYWN0aW9uKGVtb2ppOiBzdHJpbmcsIG1lc3NhZ2VJZDogc3RyaW5nKTogdm9pZCB7XHJcbiAgICBjb25zdCBtc2cgPSB0aGlzLm1lc3NhZ2VzLmZpbmQobSA9PiBtLm1lc3NhZ2VfaWQgPT09IG1lc3NhZ2VJZCk7XHJcbiAgICBpZiAoIW1zZykgcmV0dXJuO1xyXG4gICAgXHJcbiAgICBjb25zdCByZWFjdGlvbiA9IG1zZy5yZWFjdGlvbnM/LmZpbmQociA9PiByLmVtb2ppID09PSBlbW9qaSk7XHJcbiAgICBpZiAocmVhY3Rpb24/Lmhhc1JlYWN0ZWQpIHtcclxuICAgICAgdGhpcy5zdG9yZS5yZW1vdmVSZWFjdGlvbihtZXNzYWdlSWQsIGVtb2ppKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHRoaXMuc3RvcmUuYWRkUmVhY3Rpb24obWVzc2FnZUlkLCBlbW9qaSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBnZXRSZWFjdG9yVG9vbHRpcChyZWFjdGlvbjogYW55KTogc3RyaW5nIHtcclxuICAgIGlmICghcmVhY3Rpb24/LnJlYWN0b3JzPy5sZW5ndGgpIHJldHVybiAnJztcclxuICAgIHJldHVybiByZWFjdGlvbi5yZWFjdG9ycy5qb2luKCcsICcpO1xyXG4gIH1cclxufVxyXG4iXX0=