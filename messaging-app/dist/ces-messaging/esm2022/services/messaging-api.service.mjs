import { Injectable, Inject } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { MESSAGING_CONFIG } from '../messaging.config';
import * as i0 from "@angular/core";
import * as i1 from "@angular/common/http";
import * as i2 from "./auth.service";
export class MessagingApiService {
    http;
    auth;
    config;
    base;
    constructor(http, auth, config) {
        this.http = http;
        this.auth = auth;
        this.config = config;
        this.base = `${this.config.apiBaseUrl}/messaging`;
    }
    // ── Inbox ──
    getInbox(contactId) {
        return this.http.get(`${this.base}/contacts/${contactId}/inbox`);
    }
    // ── Messages ──
    getMessages(conversationId, contactId, beforeMessageId, limit = 50) {
        let params = new HttpParams()
            .set('contact_id', contactId)
            .set('limit', limit.toString());
        if (beforeMessageId) {
            params = params.set('before', beforeMessageId);
        }
        return this.http.get(`${this.base}/conversations/${conversationId}/messages`, { params });
    }
    sendMessage(conversationId, senderContactId, content, messageType = 'TEXT', mediaUrl) {
        const body = {
            sender_id: parseInt(senderContactId),
            content,
        };
        return this.http.post(`${this.base}/conversations/${conversationId}/messages`, body);
    }
    sendDirectMessage(senderContactId, recipientContactId, content, messageType = 'TEXT') {
        return this.http.post(`${this.base}/direct-messages`, {
            sender_id: parseInt(senderContactId),
            recipient_id: parseInt(recipientContactId),
            content,
        });
    }
    markConversationRead(conversationId, contactId) {
        return this.http.post(`${this.base}/conversations/${conversationId}/read`, {
            contact_id: parseInt(contactId, 10),
        });
    }
    // ── Conversations ──
    createConversation(creatorContactId, participantContactIds, name) {
        return this.http.post(`${this.base}/conversations`, {
            creator_id: parseInt(creatorContactId),
            participants: participantContactIds.map(id => parseInt(id)),
            name: name || null,
        });
    }
    getDirectConversation(contactA, contactB) {
        const params = new HttpParams()
            .set('contactA', contactA)
            .set('contactB', contactB);
        return this.http.get(`${this.base}/conversations/direct`, { params });
    }
    getConversationParticipants(conversationId) {
        return this.http.get(`${this.base}/conversations/${conversationId}/participants`);
    }
    // ── Contacts ──
    getVisibleContacts(contactId) {
        return this.http.get(`${this.base}/contacts/${contactId}/visible-contacts`);
    }
    checkContactProfile(contactId, updates) {
        return this.http.post(`${this.base}/contacts/check`, {
            contact_id: parseInt(contactId),
        });
    }
    // ── Groups ──
    manageGroup(contactId, action, conversationId, groupName, participantContactIds) {
        const payload = {
            contact_id: parseInt(contactId),
        };
        if (conversationId)
            payload.conversation_id = parseInt(conversationId);
        if (groupName)
            payload.name = groupName;
        if (participantContactIds)
            payload.participant_ids = participantContactIds.map(id => parseInt(id));
        return this.http.post(`${this.base}/groups`, {
            action,
            payload,
        });
    }
    // ── Delete / Clear ──
    deleteConversation(conversationId, contactId) {
        return this.http.post(`${this.base}/conversations/${conversationId}/delete`, {
            contactId,
        });
    }
    clearConversation(conversationId, contactId) {
        return this.http.post(`${this.base}/conversations/${conversationId}/clear`, {
            contactId,
        });
    }
    deleteGroup(conversationId, contactId) {
        return this.http.post(`${this.base}/groups/${conversationId}/delete`, {
            contactId,
        });
    }
    // ── Attachments ──
    uploadAttachment(file) {
        const formData = new FormData();
        formData.append('file', file, file.name);
        return this.http.post(`${this.base}/attachments/upload`, formData);
    }
    // ── Connections ──
    sendConnectionInvite(adminContactId, targetCompany) {
        return this.http.post(`${this.base}/connections/invites`, {
            admin_contact_id: parseInt(adminContactId),
            target_company: targetCompany,
        });
    }
    respondToConnection(adminContactId, connectionId, accept) {
        return this.http.post(`${this.base}/connections/${connectionId}/respond`, {
            admin_contact_id: parseInt(adminContactId),
            accept,
        });
    }
    getCompanyConnections(contactId) {
        return this.http.get(`${this.base}/contacts/${contactId}/connections`);
    }
    // ── Reactions ──
    addReaction(messageId, contactId, emoji) {
        return this.http.post(`${this.base}/messages/${messageId}/reactions`, {
            contact_id: parseInt(contactId),
            emoji,
        });
    }
    removeReaction(messageId, contactId, emoji) {
        return this.http.delete(`${this.base}/messages/${messageId}/reactions`, {
            body: {
                contact_id: parseInt(contactId),
                emoji,
            },
        });
    }
    getReactions(messageId) {
        return this.http.get(`${this.base}/messages/${messageId}/reactions`);
    }
    // ── Threads ──
    getThreadMessages(parentMessageId, contactId) {
        const params = new HttpParams()
            .set('contact_id', contactId);
        return this.http.get(`${this.base}/messages/${parentMessageId}/thread`, { params });
    }
    sendThreadReply(parentMessageId, senderContactId, content) {
        return this.http.post(`${this.base}/messages/${parentMessageId}/replies`, {
            sender_id: parseInt(senderContactId),
            content,
        });
    }
    // ── Message Actions ──
    editMessage(messageId, contactId, newContent) {
        return this.http.put(`${this.base}/messages/${messageId}`, {
            contactId,
            content: newContent,
        });
    }
    deleteMessage(messageId, contactId) {
        return this.http.delete(`${this.base}/messages/${messageId}`, {
            body: {
                contactId,
            },
        });
    }
    pinMessage(messageId, conversationId, contactId) {
        return this.http.post(`${this.base}/messages/${messageId}/pin`, {
            conversationId,
            contactId,
        });
    }
    unpinMessage(messageId, contactId) {
        return this.http.delete(`${this.base}/messages/${messageId}/pin`, {
            body: {
                contactId,
            },
        });
    }
    // ── Presence ──
    updatePresence(contactId, status, customStatus) {
        const params = new HttpParams().set('status', status);
        return this.http.put(`${this.base}/contacts/${contactId}/presence`, null, { params });
    }
    getPresence(contactId) {
        return this.http.get(`${this.base}/contacts/${contactId}/presence`);
    }
    // ── Search ──
    searchMessages(contactId, query, conversationId) {
        return this.http.post(`${this.base}/search`, {
            contact_id: parseInt(contactId),
            query,
            conversation_id: conversationId ? parseInt(conversationId) : null,
        });
    }
    // ── Notifications ──
    updateNotificationSettings(conversationId, contactId, settings) {
        return this.http.put(`${this.base}/conversations/${conversationId}/notifications`, {
            contactId,
            ...settings,
        });
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: MessagingApiService, deps: [{ token: i1.HttpClient }, { token: i2.AuthService }, { token: MESSAGING_CONFIG }], target: i0.ɵɵFactoryTarget.Injectable });
    static ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: MessagingApiService, providedIn: 'root' });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: MessagingApiService, decorators: [{
            type: Injectable,
            args: [{ providedIn: 'root' }]
        }], ctorParameters: () => [{ type: i1.HttpClient }, { type: i2.AuthService }, { type: undefined, decorators: [{
                    type: Inject,
                    args: [MESSAGING_CONFIG]
                }] }] });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVzc2FnaW5nLWFwaS5zZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL2xpYi9zZXJ2aWNlcy9tZXNzYWdpbmctYXBpLnNlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLEVBQUUsTUFBTSxlQUFlLENBQUM7QUFDbkQsT0FBTyxFQUFjLFVBQVUsRUFBRSxNQUFNLHNCQUFzQixDQUFDO0FBRTlELE9BQU8sRUFBRSxnQkFBZ0IsRUFBbUIsTUFBTSxxQkFBcUIsQ0FBQzs7OztBQVl4RSxNQUFNLE9BQU8sbUJBQW1CO0lBSXBCO0lBQ0E7SUFDMEI7SUFMNUIsSUFBSSxDQUFTO0lBRXJCLFlBQ1UsSUFBZ0IsRUFDaEIsSUFBaUIsRUFDUyxNQUF1QjtRQUZqRCxTQUFJLEdBQUosSUFBSSxDQUFZO1FBQ2hCLFNBQUksR0FBSixJQUFJLENBQWE7UUFDUyxXQUFNLEdBQU4sTUFBTSxDQUFpQjtRQUV6RCxJQUFJLENBQUMsSUFBSSxHQUFHLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxVQUFVLFlBQVksQ0FBQztJQUNwRCxDQUFDO0lBRUQsY0FBYztJQUNkLFFBQVEsQ0FBQyxTQUFpQjtRQUN4QixPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFjLEdBQUcsSUFBSSxDQUFDLElBQUksYUFBYSxTQUFTLFFBQVEsQ0FBQyxDQUFDO0lBQ2hGLENBQUM7SUFFRCxpQkFBaUI7SUFDakIsV0FBVyxDQUNULGNBQXNCLEVBQ3RCLFNBQWlCLEVBQ2pCLGVBQXdCLEVBQ3hCLEtBQUssR0FBRyxFQUFFO1FBRVYsSUFBSSxNQUFNLEdBQUcsSUFBSSxVQUFVLEVBQUU7YUFDMUIsR0FBRyxDQUFDLFlBQVksRUFBRSxTQUFTLENBQUM7YUFDNUIsR0FBRyxDQUFDLE9BQU8sRUFBRSxLQUFLLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQztRQUNsQyxJQUFJLGVBQWUsRUFB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ImltcG9ydCB7IEluamVjdGFibGUsIEluamVjdCB9IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xyXG5pbXBvcnQgeyBIdHRwQ2xpZW50LCBIdHRwUGFyYW1zIH0gZnJvbSAnQGFuZ3VsYXIvY29tbW9uL2h0dHAnO1xyXG5pbXBvcnQgeyBPYnNlcnZhYmxlIH0gZnJvbSAncnhqcyc7XHJcbmltcG9ydCB7IE1FU1NBR0lOR19DT05GSUcsIE1lc3NhZ2luZ0NvbmZpZyB9IGZyb20gJy4uL21lc3NhZ2luZy5jb25maWcnO1xyXG5pbXBvcnQgeyBBdXRoU2VydmljZSB9IGZyb20gJy4vYXV0aC5zZXJ2aWNlJztcclxuaW1wb3J0IHtcclxuICBJbmJveEl0ZW0sXHJcbiAgTWVzc2FnZSxcclxuICBDb250YWN0LFxyXG4gIENvbnZlcnNhdGlvbixcclxuICBDb252ZXJzYXRpb25QYXJ0aWNpcGFudCxcclxuICBDb21wYW55Q29ubmVjdGlvbixcclxufSBmcm9tICcuLi9tb2RlbHMvbWVzc2FnaW5nLm1vZGVscyc7XHJcblxyXG5ASW5qZWN0YWJsZSh7IHByb3ZpZGVkSW46ICdyb290JyB9KVxyXG5leHBvcnQgY2xhc3MgTWVzc2FnaW5nQXBpU2VydmljZSB7XHJcbiAgcHJpdmF0ZSBiYXNlOiBzdHJpbmc7XHJcblxyXG4gIGNvbnN0cnVjdG9yKFxyXG4gICAgcHJpdmF0ZSBodHRwOiBIdHRwQ2xpZW50LFxyXG4gICAgcHJpdmF0ZSBhdXRoOiBBdXRoU2VydmljZSxcclxuICAgIEBJbmplY3QoTUVTU0FHSU5HX0NPTkZJRykgcHJpdmF0ZSBjb25maWc6IE1lc3NhZ2luZ0NvbmZpZ1xyXG4gICkge1xyXG4gICAgdGhpcy5iYXNlID0gYCR7dGhpcy5jb25maWcuYXBpQmFzZVVybH0vbWVzc2FnaW5nYDtcclxuICB9XHJcblxyXG4gIC8vIOKUgOKUgCBJbmJveCDilIDilIBcclxuICBnZXRJbmJveChjb250YWN0SWQ6IHN0cmluZyk6IE9ic2VydmFibGU8SW5ib3hJdGVtW10+IHtcclxuICAgIHJldHVybiB0aGlzLmh0dHAuZ2V0PEluYm94SXRlbVtdPihgJHt0aGlzLmJhc2V9L2NvbnRhY3RzLyR7Y29udGFjdElkfS9pbmJveGApO1xyXG4gIH1cclxuXHJcbiAgLy8g4pSA4pSAIE1lc3NhZ2VzIOKUgOKUgFxyXG4gIGdldE1lc3NhZ2VzKFxyXG4gICAgY29udmVyc2F0aW9uSWQ6IHN0cmluZyxcclxuICAgIGNvbnRhY3RJZDogc3RyaW5nLFxyXG4gICAgYmVmb3JlTWVzc2FnZUlkPzogc3RyaW5nLFxyXG4gICAgbGltaXQgPSA1MFxyXG4gICk6IE9ic2VydmFibGU8TWVzc2FnZVtdPiB7XHJcbiAgICBsZXQgcGFyYW1zID0gbmV3IEh0dHBQYXJhbXMoKVxyXG4gICAgICAuc2V0KCdjb250YWN0X2lkJywgY29udGFjdElkKVxyXG4gICAgICAuc2V0KCdsaW1pdCcsIGxpbWl0LnRvU3RyaW5nKCkpO1xyXG4gICAgaWYgKGJlZm9yZU1lc3NhZ2VJZCkge1xyXG4gICAgICBwYXJhbXMgPSBwYXJhbXMuc2V0KCdiZWZvcmUnLCBiZWZvcmVNZXNzYWdlSWQpO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHRoaXMuaHR0cC5nZXQ8TWVzc2FnZVtdPihcclxuICAgICAgYCR7dGhpcy5iYXNlfS9jb252ZXJzYXRpb25zLyR7Y29udmVyc2F0aW9uSWR9L21lc3NhZ2VzYCxcclxuICAgICAgeyBwYXJhbXMgfVxyXG4gICAgKTtcclxuICB9XHJcblxyXG4gIHNlbmRNZXNzYWdlKFxyXG4gICAgY29udmVyc2F0aW9uSWQ6IHN0cmluZyxcclxuICAgIHNlbmRlckNvbnRhY3RJZDogc3RyaW5nLFxyXG4gICAgY29udGVudDogc3RyaW5nLFxyXG4gICAgbWVzc2FnZVR5cGU6ICdURVhUJyB8ICdJTUFHRScgPSAnVEVYVCcsXHJcbiAgICBtZWRpYVVybD86IHN0cmluZ1xyXG4gICk6IE9ic2VydmFibGU8YW55PiB7XHJcbiAgICBjb25zdCBib2R5OiBhbnkgPSB7XHJcbiAgICAgIHNlbmRlcl9pZDogcGFyc2VJbnQoc2VuZGVyQ29udGFjdElkKSxcclxuICAgICAgY29udGVudCxcclxuICAgIH07XHJcbiAgICByZXR1cm4gdGhpcy5odHRwLnBvc3QoYCR7dGhpcy5iYXNlfS9jb252ZXJzYXRpb25zLyR7Y29udmVyc2F0aW9uSWR9L21lc3NhZ2VzYCwgYm9keSk7XHJcbiAgfVxyXG5cclxuICBzZW5kRGlyZWN0TWVzc2FnZShcclxuICAgIHNlbmRlckNvbnRhY3RJZDogc3RyaW5nLFxyXG4gICAgcmVjaXBpZW50Q29udGFjdElkOiBzdHJpbmcsXHJcbiAgICBjb250ZW50OiBzdHJpbmcsXHJcbiAgICBtZXNzYWdlVHlwZTogJ1RFWFQnIHwgJ0lNQUdFJyA9ICdURVhUJ1xyXG4gICk6IE9ic2VydmFibGU8YW55PiB7XHJcbiAgICByZXR1cm4gdGhpcy5odHRwLnBvc3QoYCR7dGhpcy5iYXNlfS9kaXJlY3QtbWVzc2FnZXNgLCB7XHJcbiAgICAgIHNlbmRlcl9pZDogcGFyc2VJbnQoc2VuZGVyQ29udGFjdElkKSxcclxuICAgICAgcmVjaXBpZW50X2lkOiBwYXJzZUludChyZWNpcGllbnRDb250YWN0SWQpLFxyXG4gICAgICBjb250ZW50LFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBtYXJrQ29udmVyc2F0aW9uUmVhZChjb252ZXJzYXRpb25JZDogc3RyaW5nLCBjb250YWN0SWQ6IHN0cmluZyk6IE9ic2VydmFibGU8YW55PiB7XHJcbiAgICByZXR1cm4gdGhpcy5odHRwLnBvc3QoYCR7dGhpcy5iYXNlfS9jb252ZXJzYXRpb25zLyR7Y29udmVyc2F0aW9uSWR9L3JlYWRgLCB7XHJcbiAgICAgIGNvbnRhY3RfaWQ6IHBhcnNlSW50KGNvbnRhY3RJZCwgMTApLFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvLyDilIDilIAgQ29udmVyc2F0aW9ucyDilIDilIBcclxuICBjcmVhdGVDb252ZXJzYXRpb24oXHJcbiAgICBjcmVhdG9yQ29udGFjdElkOiBzdHJpbmcsXHJcbiAgICBwYXJ0aWNpcGFudENvbnRhY3RJZHM6IHN0cmluZ1tdLFxyXG4gICAgbmFtZT86IHN0cmluZ1xyXG4gICk6IE9ic2VydmFibGU8Q29udmVyc2F0aW9uPiB7XHJcbiAgICByZXR1cm4gdGhpcy5odHRwLnBvc3Q8Q29udmVyc2F0aW9uPihgJHt0aGlzLmJhc2V9L2NvbnZlcnNhdGlvbnNgLCB7XHJcbiAgICAgIGNyZWF0b3JfaWQ6IHBhcnNlSW50KGNyZWF0b3JDb250YWN0SWQpLFxyXG4gICAgICBwYXJ0aWNpcGFudHM6IHBhcnRpY2lwYW50Q29udGFjdElkcy5tYXAoaWQgPT4gcGFyc2VJbnQoaWQpKSxcclxuICAgICAgbmFtZTogbmFtZSB8fCBudWxsLFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBnZXREaXJlY3RDb252ZXJzYXRpb24oY29udGFjdEE6IHN0cmluZywgY29udGFjdEI6IHN0cmluZyk6IE9ic2VydmFibGU8YW55PiB7XHJcbiAgICBjb25zdCBwYXJhbXMgPSBuZXcgSHR0cFBhcmFtcygpXHJcbiAgICAgIC5zZXQoJ2NvbnRhY3RBJywgY29udGFjdEEpXHJcbiAgICAgIC5zZXQoJ2NvbnRhY3RCJywgY29udGFjdEIpO1xyXG4gICAgcmV0dXJuIHRoaXMuaHR0cC5nZXQoYCR7dGhpcy5iYXNlfS9jb252ZXJzYXRpb25zL2RpcmVjdGAsIHsgcGFyYW1zIH0pO1xyXG4gIH1cclxuXHJcbiAgZ2V0Q29udmVyc2F0aW9uUGFydGljaXBhbnRzKGNvbnZlcnNhdGlvbklkOiBzdHJpbmcpOiBPYnNlcnZhYmxlPENvbnZlcnNhdGlvblBhcnRpY2lwYW50W10+IHtcclxuICAgIHJldHVybiB0aGlzLmh0dHAuZ2V0PENvbnZlcnNhdGlvblBhcnRpY2lwYW50W10+KFxyXG4gICAgICBgJHt0aGlzLmJhc2V9L2NvbnZlcnNhdGlvbnMvJHtjb252ZXJzYXRpb25JZH0vcGFydGljaXBhbnRzYFxyXG4gICAgKTtcclxuICB9XHJcblxyXG4gIC8vIOKUgOKUgCBDb250YWN0cyDilIDilIBcclxuICBnZXRWaXNpYmxlQ29udGFjdHMoY29udGFjdElkOiBzdHJpbmcpOiBPYnNlcnZhYmxlPENvbnRhY3RbXT4ge1xyXG4gICAgcmV0dXJuIHRoaXMuaHR0cC5nZXQ8Q29udGFjdFtdPihcclxuICAgICAgYCR7dGhpcy5iYXNlfS9jb250YWN0cy8ke2NvbnRhY3RJZH0vdmlzaWJsZS1jb250YWN0c2BcclxuICAgICk7XHJcbiAgfVxyXG5cclxuICBjaGVja0NvbnRhY3RQcm9maWxlKGNvbnRhY3RJZDogc3RyaW5nLCB1cGRhdGVzPzogYW55KTogT2JzZXJ2YWJsZTxhbnk+IHtcclxuICAgIHJldHVybiB0aGlzLmh0dHAucG9zdChgJHt0aGlzLmJhc2V9L2NvbnRhY3RzL2NoZWNrYCwge1xyXG4gICAgICBjb250YWN0X2lkOiBwYXJzZUludChjb250YWN0SWQpLFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvLyDilIDilIAgR3JvdXBzIOKUgOKUgFxyXG4gIG1hbmFnZUdyb3VwKFxyXG4gICAgY29udGFjdElkOiBzdHJpbmcsXHJcbiAgICBhY3Rpb246ICdjcmVhdGUnIHwgJ2FkZCcgfCAncmVtb3ZlJyB8ICdyZW5hbWUnLFxyXG4gICAgY29udmVyc2F0aW9uSWQ/OiBzdHJpbmcsXHJcbiAgICBncm91cE5hbWU/OiBzdHJpbmcsXHJcbiAgICBwYXJ0aWNpcGFudENvbnRhY3RJZHM/OiBzdHJpbmdbXVxyXG4gICk6IE9ic2VydmFibGU8YW55PiB7XHJcbiAgICBjb25zdCBwYXlsb2FkOiBhbnkgPSB7XHJcbiAgICAgIGNvbnRhY3RfaWQ6IHBhcnNlSW50KGNvbnRhY3RJZCksXHJcbiAgICB9O1xyXG4gICAgaWYgKGNvbnZlcnNhdGlvbklkKSBwYXlsb2FkLmNvbnZlcnNhdGlvbl9pZCA9IHBhcnNlSW50KGNvbnZlcnNhdGlvbklkKTtcclxuICAgIGlmIChncm91cE5hbWUpIHBheWxvYWQubmFtZSA9IGdyb3VwTmFtZTtcclxuICAgIGlmIChwYXJ0aWNpcGFudENvbnRhY3RJZHMpIHBheWxvYWQucGFydGljaXBhbnRfaWRzID0gcGFydGljaXBhbnRDb250YWN0SWRzLm1hcChpZCA9PiBwYXJzZUludChpZCkpO1xyXG4gICAgcmV0dXJuIHRoaXMuaHR0cC5wb3N0KGAke3RoaXMuYmFzZX0vZ3JvdXBzYCwge1xyXG4gICAgICBhY3Rpb24sXHJcbiAgICAgIHBheWxvYWQsXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8vIOKUgOKUgCBEZWxldGUgLyBDbGVhciDilIDilIBcclxuICBkZWxldGVDb252ZXJzYXRpb24oY29udmVyc2F0aW9uSWQ6IHN0cmluZywgY29udGFjdElkOiBzdHJpbmcpOiBPYnNlcnZhYmxlPGFueT4ge1xyXG4gICAgcmV0dXJuIHRoaXMuaHR0cC5wb3N0KGAke3RoaXMuYmFzZX0vY29udmVyc2F0aW9ucy8ke2NvbnZlcnNhdGlvbklkfS9kZWxldGVgLCB7XHJcbiAgICAgIGNvbnRhY3RJZCxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgY2xlYXJDb252ZXJzYXRpb24oY29udmVyc2F0aW9uSWQ6IHN0cmluZywgY29udGFjdElkOiBzdHJpbmcpOiBPYnNlcnZhYmxlPGFueT4ge1xyXG4gICAgcmV0dXJuIHRoaXMuaHR0cC5wb3N0KGAke3RoaXMuYmFzZX0vY29udmVyc2F0aW9ucy8ke2NvbnZlcnNhdGlvbklkfS9jbGVhcmAsIHtcclxuICAgICAgY29udGFjdElkLFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBkZWxldGVHcm91cChjb252ZXJzYXRpb25JZDogc3RyaW5nLCBjb250YWN0SWQ6IHN0cmluZyk6IE9ic2VydmFibGU8YW55PiB7XHJcbiAgICByZXR1cm4gdGhpcy5odHRwLnBvc3QoYCR7dGhpcy5iYXNlfS9ncm91cHMvJHtjb252ZXJzYXRpb25JZH0vZGVsZXRlYCwge1xyXG4gICAgICBjb250YWN0SWQsXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8vIOKUgOKUgCBBdHRhY2htZW50cyDilIDilIBcclxuICB1cGxvYWRBdHRhY2htZW50KGZpbGU6IEZpbGUpOiBPYnNlcnZhYmxlPGFueT4ge1xyXG4gICAgY29uc3QgZm9ybURhdGEgPSBuZXcgRm9ybURhdGEoKTtcclxuICAgIGZvcm1EYXRhLmFwcGVuZCgnZmlsZScsIGZpbGUsIGZpbGUubmFtZSk7XHJcbiAgICByZXR1cm4gdGhpcy5odHRwLnBvc3QoYCR7dGhpcy5iYXNlfS9hdHRhY2htZW50cy91cGxvYWRgLCBmb3JtRGF0YSk7XHJcbiAgfVxyXG5cclxuICAvLyDilIDilIAgQ29ubmVjdGlvbnMg4pSA4pSAXHJcbiAgc2VuZENvbm5lY3Rpb25JbnZpdGUoYWRtaW5Db250YWN0SWQ6IHN0cmluZywgdGFyZ2V0Q29tcGFueTogc3RyaW5nKTogT2JzZXJ2YWJsZTxhbnk+IHtcclxuICAgIHJldHVybiB0aGlzLmh0dHAucG9zdChgJHt0aGlzLmJhc2V9L2Nvbm5lY3Rpb25zL2ludml0ZXNgLCB7XHJcbiAgICAgIGFkbWluX2NvbnRhY3RfaWQ6IHBhcnNlSW50KGFkbWluQ29udGFjdElkKSxcclxuICAgICAgdGFyZ2V0X2NvbXBhbnk6IHRhcmdldENvbXBhbnksXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHJlc3BvbmRUb0Nvbm5lY3Rpb24oYWRtaW5Db250YWN0SWQ6IHN0cmluZywgY29ubmVjdGlvbklkOiBzdHJpbmcsIGFjY2VwdDogYm9vbGVhbik6IE9ic2VydmFibGU8YW55PiB7XHJcbiAgICByZXR1cm4gdGhpcy5odHRwLnBvc3QoYCR7dGhpcy5iYXNlfS9jb25uZWN0aW9ucy8ke2Nvbm5lY3Rpb25JZH0vcmVzcG9uZGAsIHtcclxuICAgICAgYWRtaW5fY29udGFjdF9pZDogcGFyc2VJbnQoYWRtaW5Db250YWN0SWQpLFxyXG4gICAgICBhY2NlcHQsXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIGdldENvbXBhbnlDb25uZWN0aW9ucyhjb250YWN0SWQ6IHN0cmluZyk6IE9ic2VydmFibGU8Q29tcGFueUNvbm5lY3Rpb25bXT4ge1xyXG4gICAgcmV0dXJuIHRoaXMuaHR0cC5nZXQ8Q29tcGFueUNvbm5lY3Rpb25bXT4oXHJcbiAgICAgIGAke3RoaXMuYmFzZX0vY29udGFjdHMvJHtjb250YWN0SWR9L2Nvbm5lY3Rpb25zYFxyXG4gICAgKTtcclxuICB9XHJcblxyXG4gIC8vIOKUgOKUgCBSZWFjdGlvbnMg4pSA4pSAXHJcbiAgYWRkUmVhY3Rpb24obWVzc2FnZUlkOiBzdHJpbmcsIGNvbnRhY3RJZDogc3RyaW5nLCBlbW9qaTogc3RyaW5nKTogT2JzZXJ2YWJsZTxhbnk+IHtcclxuICAgIHJldHVybiB0aGlzLmh0dHAucG9zdChgJHt0aGlzLmJhc2V9L21lc3NhZ2VzLyR7bWVzc2FnZUlkfS9yZWFjdGlvbnNgLCB7XHJcbiAgICAgIGNvbnRhY3RfaWQ6IHBhcnNlSW50KGNvbnRhY3RJZCksXHJcbiAgICAgIGVtb2ppLFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICByZW1vdmVSZWFjdGlvbihtZXNzYWdlSWQ6IHN0cmluZywgY29udGFjdElkOiBzdHJpbmcsIGVtb2ppOiBzdHJpbmcpOiBPYnNlcnZhYmxlPGFueT4ge1xyXG4gICAgcmV0dXJuIHRoaXMuaHR0cC5kZWxldGUoYCR7dGhpcy5iYXNlfS9tZXNzYWdlcy8ke21lc3NhZ2VJZH0vcmVhY3Rpb25zYCwge1xyXG4gICAgICBib2R5OiB7XHJcbiAgICAgICAgY29udGFjdF9pZDogcGFyc2VJbnQoY29udGFjdElkKSxcclxuICAgICAgICBlbW9qaSxcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgZ2V0UmVhY3Rpb25zKG1lc3NhZ2VJZDogc3RyaW5nKTogT2JzZXJ2YWJsZTxhbnlbXT4ge1xyXG4gICAgcmV0dXJuIHRoaXMuaHR0cC5nZXQ8YW55W10+KGAke3RoaXMuYmFzZX0vbWVzc2FnZXMvJHttZXNzYWdlSWR9L3JlYWN0aW9uc2ApO1xyXG4gIH1cclxuXHJcbiAgLy8g4pSA4pSAIFRocmVhZHMg4pSA4pSAXHJcbiAgZ2V0VGhyZWFkTWVzc2FnZXMocGFyZW50TWVzc2FnZUlkOiBzdHJpbmcsIGNvbnRhY3RJZDogc3RyaW5nKTogT2JzZXJ2YWJsZTxNZXNzYWdlW10+IHtcclxuICAgIGNvbnN0IHBhcmFtcyA9IG5ldyBIdHRwUGFyYW1zKClcclxuICAgICAgLnNldCgnY29udGFjdF9pZCcsIGNvbnRhY3RJZCk7XHJcbiAgICByZXR1cm4gdGhpcy5odHRwLmdldDxNZXNzYWdlW10+KGAke3RoaXMuYmFzZX0vbWVzc2FnZXMvJHtwYXJlbnRNZXNzYWdlSWR9L3RocmVhZGAsIHsgcGFyYW1zIH0pO1xyXG4gIH1cclxuXHJcbiAgc2VuZFRocmVhZFJlcGx5KHBhcmVudE1lc3NhZ2VJZDogc3RyaW5nLCBzZW5kZXJDb250YWN0SWQ6IHN0cmluZywgY29udGVudDogc3RyaW5nKTogT2JzZXJ2YWJsZTxhbnk+IHtcclxuICAgIHJldHVybiB0aGlzLmh0dHAucG9zdChgJHt0aGlzLmJhc2V9L21lc3NhZ2VzLyR7cGFyZW50TWVzc2FnZUlkfS9yZXBsaWVzYCwge1xyXG4gICAgICBzZW5kZXJfaWQ6IHBhcnNlSW50KHNlbmRlckNvbnRhY3RJZCksXHJcbiAgICAgIGNvbnRlbnQsXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8vIOKUgOKUgCBNZXNzYWdlIEFjdGlvbnMg4pSA4pSAXHJcbiAgZWRpdE1lc3NhZ2UobWVzc2FnZUlkOiBzdHJpbmcsIGNvbnRhY3RJZDogc3RyaW5nLCBuZXdDb250ZW50OiBzdHJpbmcpOiBPYnNlcnZhYmxlPGFueT4ge1xyXG4gICAgcmV0dXJuIHRoaXMuaHR0cC5wdXQoYCR7dGhpcy5iYXNlfS9tZXNzYWdlcy8ke21lc3NhZ2VJZH1gLCB7XHJcbiAgICAgIGNvbnRhY3RJZCxcclxuICAgICAgY29udGVudDogbmV3Q29udGVudCxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgZGVsZXRlTWVzc2FnZShtZXNzYWdlSWQ6IHN0cmluZywgY29udGFjdElkOiBzdHJpbmcpOiBPYnNlcnZhYmxlPGFueT4ge1xyXG4gICAgcmV0dXJuIHRoaXMuaHR0cC5kZWxldGUoYCR7dGhpcy5iYXNlfS9tZXNzYWdlcy8ke21lc3NhZ2VJZH1gLCB7XHJcbiAgICAgIGJvZHk6IHtcclxuICAgICAgICBjb250YWN0SWQsXHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHBpbk1lc3NhZ2UobWVzc2FnZUlkOiBzdHJpbmcsIGNvbnZlcnNhdGlvbklkOiBzdHJpbmcsIGNvbnRhY3RJZDogc3RyaW5nKTogT2JzZXJ2YWJsZTxhbnk+IHtcclxuICAgIHJldHVybiB0aGlzLmh0dHAucG9zdChgJHt0aGlzLmJhc2V9L21lc3NhZ2VzLyR7bWVzc2FnZUlkfS9waW5gLCB7XHJcbiAgICAgIGNvbnZlcnNhdGlvbklkLFxyXG4gICAgICBjb250YWN0SWQsXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHVucGluTWVzc2FnZShtZXNzYWdlSWQ6IHN0cmluZywgY29udGFjdElkOiBzdHJpbmcpOiBPYnNlcnZhYmxlPGFueT4ge1xyXG4gICAgcmV0dXJuIHRoaXMuaHR0cC5kZWxldGUoYCR7dGhpcy5iYXNlfS9tZXNzYWdlcy8ke21lc3NhZ2VJZH0vcGluYCwge1xyXG4gICAgICBib2R5OiB7XHJcbiAgICAgICAgY29udGFjdElkLFxyXG4gICAgICB9LFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvLyDilIDilIAgUHJlc2VuY2Ug4pSA4pSAXHJcbiAgdXBkYXRlUHJlc2VuY2UoY29udGFjdElkOiBzdHJpbmcsIHN0YXR1czogc3RyaW5nLCBjdXN0b21TdGF0dXM/OiBzdHJpbmcpOiBPYnNlcnZhYmxlPGFueT4ge1xyXG4gICAgY29uc3QgcGFyYW1zID0gbmV3IEh0dHBQYXJhbXMoKS5zZXQoJ3N0YXR1cycsIHN0YXR1cyk7XHJcbiAgICByZXR1cm4gdGhpcy5odHRwLnB1dChgJHt0aGlzLmJhc2V9L2NvbnRhY3RzLyR7Y29udGFjdElkfS9wcmVzZW5jZWAsIG51bGwsIHsgcGFyYW1zIH0pO1xyXG4gIH1cclxuXHJcbiAgZ2V0UHJlc2VuY2UoY29udGFjdElkOiBzdHJpbmcpOiBPYnNlcnZhYmxlPGFueT4ge1xyXG4gICAgcmV0dXJuIHRoaXMuaHR0cC5nZXQoYCR7dGhpcy5iYXNlfS9jb250YWN0cy8ke2NvbnRhY3RJZH0vcHJlc2VuY2VgKTtcclxuICB9XHJcblxyXG4gIC8vIOKUgOKUgCBTZWFyY2gg4pSA4pSAXHJcbiAgc2VhcmNoTWVzc2FnZXMoY29udGFjdElkOiBzdHJpbmcsIHF1ZXJ5OiBzdHJpbmcsIGNvbnZlcnNhdGlvbklkPzogc3RyaW5nKTogT2JzZXJ2YWJsZTxNZXNzYWdlW10+IHtcclxuICAgIHJldHVybiB0aGlzLmh0dHAucG9zdDxNZXNzYWdlW10+KGAke3RoaXMuYmFzZX0vc2VhcmNoYCwge1xyXG4gICAgICBjb250YWN0X2lkOiBwYXJzZUludChjb250YWN0SWQpLFxyXG4gICAgICBxdWVyeSxcclxuICAgICAgY29udmVyc2F0aW9uX2lkOiBjb252ZXJzYXRpb25JZCA/IHBhcnNlSW50KGNvbnZlcnNhdGlvbklkKSA6IG51bGwsXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8vIOKUgOKUgCBOb3RpZmljYXRpb25zIOKUgOKUgFxyXG4gIHVwZGF0ZU5vdGlmaWNhdGlvblNldHRpbmdzKGNvbnZlcnNhdGlvbklkOiBzdHJpbmcsIGNvbnRhY3RJZDogc3RyaW5nLCBzZXR0aW5nczogYW55KTogT2JzZXJ2YWJsZTxhbnk+IHtcclxuICAgIHJldHVybiB0aGlzLmh0dHAucHV0KGAke3RoaXMuYmFzZX0vY29udmVyc2F0aW9ucy8ke2NvbnZlcnNhdGlvbklkfS9ub3RpZmljYXRpb25zYCwge1xyXG4gICAgICBjb250YWN0SWQsXHJcbiAgICAgIC4uLnNldHRpbmdzLFxyXG4gICAgfSk7XHJcbiAgfVxyXG59XHJcbiJdfQ==