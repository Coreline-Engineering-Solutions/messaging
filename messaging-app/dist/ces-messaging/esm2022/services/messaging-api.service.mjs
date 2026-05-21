import { Injectable, Inject } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { MESSAGING_CONFIG } from '../messaging.config';
import { warnEmailLikeContactId } from '../messaging-dev-warnings';
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
        warnEmailLikeContactId(contactId);
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
        warnEmailLikeContactId(contactId);
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
        return this.manageGroup(contactId, 'remove', conversationId);
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
        warnEmailLikeContactId(contactId);
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
        warnEmailLikeContactId(contactId);
        const params = new HttpParams().set('status', status);
        return this.http.put(`${this.base}/contacts/${contactId}/presence`, null, { params });
    }
    getPresence(contactId) {
        warnEmailLikeContactId(contactId);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVzc2FnaW5nLWFwaS5zZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL2xpYi9zZXJ2aWNlcy9tZXNzYWdpbmctYXBpLnNlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLEVBQUUsTUFBTSxlQUFlLENBQUM7QUFDbkQsT0FBTyxFQUFjLFVBQVUsRUFBRSxNQUFNLHNCQUFzQixDQUFDO0FBRTlELE9BQU8sRUFBRSxnQkFBZ0IsRUFBbUIsTUFBTSxxQkFBcUIsQ0FBQztBQUN4RSxPQUFPLEVBQUUsc0JBQXNCLEVBQUUsTUFBTSwyQkFBMkIsQ0FBQzs7OztBQVluRSxNQUFNLE9BQU8sbUJBQW1CO0lBSXBCO0lBQ0E7SUFDMEI7SUFMNUIsSUFBSSxDQUFTO0lBRXJCLFlBQ1UsSUFBZ0IsRUFDaEIsSUFBaUIsRUFDUyxNQUF1QjtRQUZqRCxTQUFJLEdBQUosSUFBSSxDQUFZO1FBQ2hCLFNBQUksR0FBSixJQUFJLENBQWE7UUFDUyxXQUFNLEdBQU4sTUFBTSxDQUFpQjtRQUV6RCxJQUFJLENBQUMsSUFBSSxHQUFHLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxVQUFVLFlBQVksQ0FBQztJQUNwRCxDQUFDO0lBRUQsY0FBYztJQUNkLFFBQVEsQ0FBQyxTQUFpQjtRQUN4QixzQkFBc0IsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUNsQyxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFjLEdBQUcsSUFBSSxDQUFDLElBQUksYUFBYSxTQUFTLFFBQVEsQ0FBQyxDQUFDO0lBQ2hGLENBQUM7SUFFRCxpQkFBaUI7SUFDakIsV0FBVyxDQUNULGNBQXNCLEVBQ3RCLFNBQWlCLEVBQ2pCLGVBQXdCLEVBQ3hCLEtBQUssR0FBRyxFQUFFO1FBRVYsSUFBSSxNQUFNLEdBQUcsSUFBSSxVQUFVLEVBQUU7YUFDMUIsR0FBRyxDQUFDLFlBQVksRUFBRSxTQUFTLENB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LENBQUM7SUFDTCxDQUFDO3dHQTVRVSxtQkFBbUIsdUVBTXBCLGdCQUFnQjs0R0FOZixtQkFBbUIsY0FETixNQUFNOzs0RkFDbkIsbUJBQW1CO2tCQUQvQixVQUFVO21CQUFDLEVBQUUsVUFBVSxFQUFFLE1BQU0sRUFBRTs7MEJBTzdCLE1BQU07MkJBQUMsZ0JBQWdCIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgSW5qZWN0YWJsZSwgSW5qZWN0IH0gZnJvbSAnQGFuZ3VsYXIvY29yZSc7XHJcbmltcG9ydCB7IEh0dHBDbGllbnQsIEh0dHBQYXJhbXMgfSBmcm9tICdAYW5ndWxhci9jb21tb24vaHR0cCc7XHJcbmltcG9ydCB7IE9ic2VydmFibGUgfSBmcm9tICdyeGpzJztcclxuaW1wb3J0IHsgTUVTU0FHSU5HX0NPTkZJRywgTWVzc2FnaW5nQ29uZmlnIH0gZnJvbSAnLi4vbWVzc2FnaW5nLmNvbmZpZyc7XHJcbmltcG9ydCB7IHdhcm5FbWFpbExpa2VDb250YWN0SWQgfSBmcm9tICcuLi9tZXNzYWdpbmctZGV2LXdhcm5pbmdzJztcclxuaW1wb3J0IHsgQXV0aFNlcnZpY2UgfSBmcm9tICcuL2F1dGguc2VydmljZSc7XHJcbmltcG9ydCB7XHJcbiAgSW5ib3hJdGVtLFxyXG4gIE1lc3NhZ2UsXHJcbiAgQ29udGFjdCxcclxuICBDb252ZXJzYXRpb24sXHJcbiAgQ29udmVyc2F0aW9uUGFydGljaXBhbnQsXHJcbiAgQ29tcGFueUNvbm5lY3Rpb24sXHJcbn0gZnJvbSAnLi4vbW9kZWxzL21lc3NhZ2luZy5tb2RlbHMnO1xyXG5cclxuQEluamVjdGFibGUoeyBwcm92aWRlZEluOiAncm9vdCcgfSlcclxuZXhwb3J0IGNsYXNzIE1lc3NhZ2luZ0FwaVNlcnZpY2Uge1xyXG4gIHByaXZhdGUgYmFzZTogc3RyaW5nO1xyXG5cclxuICBjb25zdHJ1Y3RvcihcclxuICAgIHByaXZhdGUgaHR0cDogSHR0cENsaWVudCxcclxuICAgIHByaXZhdGUgYXV0aDogQXV0aFNlcnZpY2UsXHJcbiAgICBASW5qZWN0KE1FU1NBR0lOR19DT05GSUcpIHByaXZhdGUgY29uZmlnOiBNZXNzYWdpbmdDb25maWdcclxuICApIHtcclxuICAgIHRoaXMuYmFzZSA9IGAke3RoaXMuY29uZmlnLmFwaUJhc2VVcmx9L21lc3NhZ2luZ2A7XHJcbiAgfVxyXG5cclxuICAvLyDilIDilIAgSW5ib3gg4pSA4pSAXHJcbiAgZ2V0SW5ib3goY29udGFjdElkOiBzdHJpbmcpOiBPYnNlcnZhYmxlPEluYm94SXRlbVtdPiB7XHJcbiAgICB3YXJuRW1haWxMaWtlQ29udGFjdElkKGNvbnRhY3RJZCk7XHJcbiAgICByZXR1cm4gdGhpcy5odHRwLmdldDxJbmJveEl0ZW1bXT4oYCR7dGhpcy5iYXNlfS9jb250YWN0cy8ke2NvbnRhY3RJZH0vaW5ib3hgKTtcclxuICB9XHJcblxyXG4gIC8vIOKUgOKUgCBNZXNzYWdlcyDilIDilIBcclxuICBnZXRNZXNzYWdlcyhcclxuICAgIGNvbnZlcnNhdGlvbklkOiBzdHJpbmcsXHJcbiAgICBjb250YWN0SWQ6IHN0cmluZyxcclxuICAgIGJlZm9yZU1lc3NhZ2VJZD86IHN0cmluZyxcclxuICAgIGxpbWl0ID0gNTBcclxuICApOiBPYnNlcnZhYmxlPE1lc3NhZ2VbXT4ge1xyXG4gICAgbGV0IHBhcmFtcyA9IG5ldyBIdHRwUGFyYW1zKClcclxuICAgICAgLnNldCgnY29udGFjdF9pZCcsIGNvbnRhY3RJZClcclxuICAgICAgLnNldCgnbGltaXQnLCBsaW1pdC50b1N0cmluZygpKTtcclxuICAgIGlmIChiZWZvcmVNZXNzYWdlSWQpIHtcclxuICAgICAgcGFyYW1zID0gcGFyYW1zLnNldCgnYmVmb3JlJywgYmVmb3JlTWVzc2FnZUlkKTtcclxuICAgIH1cclxuICAgIHJldHVybiB0aGlzLmh0dHAuZ2V0PE1lc3NhZ2VbXT4oXHJcbiAgICAgIGAke3RoaXMuYmFzZX0vY29udmVyc2F0aW9ucy8ke2NvbnZlcnNhdGlvbklkfS9tZXNzYWdlc2AsXHJcbiAgICAgIHsgcGFyYW1zIH1cclxuICAgICk7XHJcbiAgfVxyXG5cclxuICBzZW5kTWVzc2FnZShcclxuICAgIGNvbnZlcnNhdGlvbklkOiBzdHJpbmcsXHJcbiAgICBzZW5kZXJDb250YWN0SWQ6IHN0cmluZyxcclxuICAgIGNvbnRlbnQ6IHN0cmluZyxcclxuICAgIG1lc3NhZ2VUeXBlOiAnVEVYVCcgfCAnSU1BR0UnIHwgJ1NZU1RFTScgPSAnVEVYVCcsXHJcbiAgICBtZWRpYVVybD86IHN0cmluZ1xyXG4gICk6IE9ic2VydmFibGU8YW55PiB7XHJcbiAgICBjb25zdCBib2R5OiBhbnkgPSB7XHJcbiAgICAgIHNlbmRlcl9pZDogcGFyc2VJbnQoc2VuZGVyQ29udGFjdElkKSxcclxuICAgICAgY29udGVudCxcclxuICAgIH07XHJcbiAgICByZXR1cm4gdGhpcy5odHRwLnBvc3QoYCR7dGhpcy5iYXNlfS9jb252ZXJzYXRpb25zLyR7Y29udmVyc2F0aW9uSWR9L21lc3NhZ2VzYCwgYm9keSk7XHJcbiAgfVxyXG5cclxuICBzZW5kRGlyZWN0TWVzc2FnZShcclxuICAgIHNlbmRlckNvbnRhY3RJZDogc3RyaW5nLFxyXG4gICAgcmVjaXBpZW50Q29udGFjdElkOiBzdHJpbmcsXHJcbiAgICBjb250ZW50OiBzdHJpbmcsXHJcbiAgICBtZXNzYWdlVHlwZTogJ1RFWFQnIHwgJ0lNQUdFJyA9ICdURVhUJ1xyXG4gICk6IE9ic2VydmFibGU8YW55PiB7XHJcbiAgICByZXR1cm4gdGhpcy5odHRwLnBvc3QoYCR7dGhpcy5iYXNlfS9kaXJlY3QtbWVzc2FnZXNgLCB7XHJcbiAgICAgIHNlbmRlcl9pZDogcGFyc2VJbnQoc2VuZGVyQ29udGFjdElkKSxcclxuICAgICAgcmVjaXBpZW50X2lkOiBwYXJzZUludChyZWNpcGllbnRDb250YWN0SWQpLFxyXG4gICAgICBjb250ZW50LFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBtYXJrQ29udmVyc2F0aW9uUmVhZChjb252ZXJzYXRpb25JZDogc3RyaW5nLCBjb250YWN0SWQ6IHN0cmluZyk6IE9ic2VydmFibGU8YW55PiB7XHJcbiAgICByZXR1cm4gdGhpcy5odHRwLnBvc3QoYCR7dGhpcy5iYXNlfS9jb252ZXJzYXRpb25zLyR7Y29udmVyc2F0aW9uSWR9L3JlYWRgLCB7XHJcbiAgICAgIGNvbnRhY3RfaWQ6IHBhcnNlSW50KGNvbnRhY3RJZCwgMTApLFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvLyDilIDilIAgQ29udmVyc2F0aW9ucyDilIDilIBcclxuICBjcmVhdGVDb252ZXJzYXRpb24oXHJcbiAgICBjcmVhdG9yQ29udGFjdElkOiBzdHJpbmcsXHJcbiAgICBwYXJ0aWNpcGFudENvbnRhY3RJZHM6IHN0cmluZ1tdLFxyXG4gICAgbmFtZT86IHN0cmluZ1xyXG4gICk6IE9ic2VydmFibGU8Q29udmVyc2F0aW9uPiB7XHJcbiAgICByZXR1cm4gdGhpcy5odHRwLnBvc3Q8Q29udmVyc2F0aW9uPihgJHt0aGlzLmJhc2V9L2NvbnZlcnNhdGlvbnNgLCB7XHJcbiAgICAgIGNyZWF0b3JfaWQ6IHBhcnNlSW50KGNyZWF0b3JDb250YWN0SWQpLFxyXG4gICAgICBwYXJ0aWNpcGFudHM6IHBhcnRpY2lwYW50Q29udGFjdElkcy5tYXAoaWQgPT4gcGFyc2VJbnQoaWQpKSxcclxuICAgICAgbmFtZTogbmFtZSB8fCBudWxsLFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBnZXREaXJlY3RDb252ZXJzYXRpb24oY29udGFjdEE6IHN0cmluZywgY29udGFjdEI6IHN0cmluZyk6IE9ic2VydmFibGU8YW55PiB7XHJcbiAgICBjb25zdCBwYXJhbXMgPSBuZXcgSHR0cFBhcmFtcygpXHJcbiAgICAgIC5zZXQoJ2NvbnRhY3RBJywgY29udGFjdEEpXHJcbiAgICAgIC5zZXQoJ2NvbnRhY3RCJywgY29udGFjdEIpO1xyXG4gICAgcmV0dXJuIHRoaXMuaHR0cC5nZXQoYCR7dGhpcy5iYXNlfS9jb252ZXJzYXRpb25zL2RpcmVjdGAsIHsgcGFyYW1zIH0pO1xyXG4gIH1cclxuXHJcbiAgZ2V0Q29udmVyc2F0aW9uUGFydGljaXBhbnRzKGNvbnZlcnNhdGlvbklkOiBzdHJpbmcpOiBPYnNlcnZhYmxlPENvbnZlcnNhdGlvblBhcnRpY2lwYW50W10+IHtcclxuICAgIHJldHVybiB0aGlzLmh0dHAuZ2V0PENvbnZlcnNhdGlvblBhcnRpY2lwYW50W10+KFxyXG4gICAgICBgJHt0aGlzLmJhc2V9L2NvbnZlcnNhdGlvbnMvJHtjb252ZXJzYXRpb25JZH0vcGFydGljaXBhbnRzYFxyXG4gICAgKTtcclxuICB9XHJcblxyXG4gIC8vIOKUgOKUgCBDb250YWN0cyDilIDilIBcclxuICBnZXRWaXNpYmxlQ29udGFjdHMoY29udGFjdElkOiBzdHJpbmcpOiBPYnNlcnZhYmxlPENvbnRhY3RbXT4ge1xyXG4gICAgd2FybkVtYWlsTGlrZUNvbnRhY3RJZChjb250YWN0SWQpO1xyXG4gICAgcmV0dXJuIHRoaXMuaHR0cC5nZXQ8Q29udGFjdFtdPihcclxuICAgICAgYCR7dGhpcy5iYXNlfS9jb250YWN0cy8ke2NvbnRhY3RJZH0vdmlzaWJsZS1jb250YWN0c2BcclxuICAgICk7XHJcbiAgfVxyXG5cclxuICBjaGVja0NvbnRhY3RQcm9maWxlKGNvbnRhY3RJZDogc3RyaW5nLCB1cGRhdGVzPzogYW55KTogT2JzZXJ2YWJsZTxhbnk+IHtcclxuICAgIHJldHVybiB0aGlzLmh0dHAucG9zdChgJHt0aGlzLmJhc2V9L2NvbnRhY3RzL2NoZWNrYCwge1xyXG4gICAgICBjb250YWN0X2lkOiBwYXJzZUludChjb250YWN0SWQpLFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvLyDilIDilIAgR3JvdXBzIOKUgOKUgFxyXG4gIG1hbmFnZUdyb3VwKFxyXG4gICAgY29udGFjdElkOiBzdHJpbmcsXHJcbiAgICBhY3Rpb246ICdjcmVhdGUnIHwgJ2FkZCcgfCAncmVtb3ZlJyB8ICdyZW5hbWUnLFxyXG4gICAgY29udmVyc2F0aW9uSWQ/OiBzdHJpbmcsXHJcbiAgICBncm91cE5hbWU/OiBzdHJpbmcsXHJcbiAgICBwYXJ0aWNpcGFudENvbnRhY3RJZHM/OiBzdHJpbmdbXVxyXG4gICk6IE9ic2VydmFibGU8YW55PiB7XHJcbiAgICBjb25zdCBwYXlsb2FkOiBhbnkgPSB7XHJcbiAgICAgIGNvbnRhY3RfaWQ6IHBhcnNlSW50KGNvbnRhY3RJZCksXHJcbiAgICB9O1xyXG4gICAgaWYgKGNvbnZlcnNhdGlvbklkKSBwYXlsb2FkLmNvbnZlcnNhdGlvbl9pZCA9IHBhcnNlSW50KGNvbnZlcnNhdGlvbklkKTtcclxuICAgIGlmIChncm91cE5hbWUpIHBheWxvYWQubmFtZSA9IGdyb3VwTmFtZTtcclxuICAgIGlmIChwYXJ0aWNpcGFudENvbnRhY3RJZHMpIHBheWxvYWQucGFydGljaXBhbnRfaWRzID0gcGFydGljaXBhbnRDb250YWN0SWRzLm1hcChpZCA9PiBwYXJzZUludChpZCkpO1xyXG4gICAgcmV0dXJuIHRoaXMuaHR0cC5wb3N0KGAke3RoaXMuYmFzZX0vZ3JvdXBzYCwge1xyXG4gICAgICBhY3Rpb24sXHJcbiAgICAgIHBheWxvYWQsXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8vIOKUgOKUgCBEZWxldGUgLyBDbGVhciDilIDilIBcclxuICBkZWxldGVDb252ZXJzYXRpb24oY29udmVyc2F0aW9uSWQ6IHN0cmluZywgY29udGFjdElkOiBzdHJpbmcpOiBPYnNlcnZhYmxlPGFueT4ge1xyXG4gICAgcmV0dXJuIHRoaXMuaHR0cC5wb3N0KGAke3RoaXMuYmFzZX0vY29udmVyc2F0aW9ucy8ke2NvbnZlcnNhdGlvbklkfS9kZWxldGVgLCB7XHJcbiAgICAgIGNvbnRhY3RJZCxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgY2xlYXJDb252ZXJzYXRpb24oY29udmVyc2F0aW9uSWQ6IHN0cmluZywgY29udGFjdElkOiBzdHJpbmcpOiBPYnNlcnZhYmxlPGFueT4ge1xyXG4gICAgcmV0dXJuIHRoaXMuaHR0cC5wb3N0KGAke3RoaXMuYmFzZX0vY29udmVyc2F0aW9ucy8ke2NvbnZlcnNhdGlvbklkfS9jbGVhcmAsIHtcclxuICAgICAgY29udGFjdElkLFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBkZWxldGVHcm91cChjb252ZXJzYXRpb25JZDogc3RyaW5nLCBjb250YWN0SWQ6IHN0cmluZyk6IE9ic2VydmFibGU8YW55PiB7XHJcbiAgICByZXR1cm4gdGhpcy5tYW5hZ2VHcm91cChjb250YWN0SWQsICdyZW1vdmUnLCBjb252ZXJzYXRpb25JZCk7XHJcbiAgfVxyXG5cclxuICAvLyDilIDilIAgQXR0YWNobWVudHMg4pSA4pSAXHJcbiAgdXBsb2FkQXR0YWNobWVudChmaWxlOiBGaWxlKTogT2JzZXJ2YWJsZTxhbnk+IHtcclxuICAgIGNvbnN0IGZvcm1EYXRhID0gbmV3IEZvcm1EYXRhKCk7XHJcbiAgICBmb3JtRGF0YS5hcHBlbmQoJ2ZpbGUnLCBmaWxlLCBmaWxlLm5hbWUpO1xyXG4gICAgcmV0dXJuIHRoaXMuaHR0cC5wb3N0KGAke3RoaXMuYmFzZX0vYXR0YWNobWVudHMvdXBsb2FkYCwgZm9ybURhdGEpO1xyXG4gIH1cclxuXHJcbiAgLy8g4pSA4pSAIENvbm5lY3Rpb25zIOKUgOKUgFxyXG4gIHNlbmRDb25uZWN0aW9uSW52aXRlKGFkbWluQ29udGFjdElkOiBzdHJpbmcsIHRhcmdldENvbXBhbnk6IHN0cmluZyk6IE9ic2VydmFibGU8YW55PiB7XHJcbiAgICByZXR1cm4gdGhpcy5odHRwLnBvc3QoYCR7dGhpcy5iYXNlfS9jb25uZWN0aW9ucy9pbnZpdGVzYCwge1xyXG4gICAgICBhZG1pbl9jb250YWN0X2lkOiBwYXJzZUludChhZG1pbkNvbnRhY3RJZCksXHJcbiAgICAgIHRhcmdldF9jb21wYW55OiB0YXJnZXRDb21wYW55LFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICByZXNwb25kVG9Db25uZWN0aW9uKGFkbWluQ29udGFjdElkOiBzdHJpbmcsIGNvbm5lY3Rpb25JZDogc3RyaW5nLCBhY2NlcHQ6IGJvb2xlYW4pOiBPYnNlcnZhYmxlPGFueT4ge1xyXG4gICAgcmV0dXJuIHRoaXMuaHR0cC5wb3N0KGAke3RoaXMuYmFzZX0vY29ubmVjdGlvbnMvJHtjb25uZWN0aW9uSWR9L3Jlc3BvbmRgLCB7XHJcbiAgICAgIGFkbWluX2NvbnRhY3RfaWQ6IHBhcnNlSW50KGFkbWluQ29udGFjdElkKSxcclxuICAgICAgYWNjZXB0LFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBnZXRDb21wYW55Q29ubmVjdGlvbnMoY29udGFjdElkOiBzdHJpbmcpOiBPYnNlcnZhYmxlPENvbXBhbnlDb25uZWN0aW9uW10+IHtcclxuICAgIHdhcm5FbWFpbExpa2VDb250YWN0SWQoY29udGFjdElkKTtcclxuICAgIHJldHVybiB0aGlzLmh0dHAuZ2V0PENvbXBhbnlDb25uZWN0aW9uW10+KFxyXG4gICAgICBgJHt0aGlzLmJhc2V9L2NvbnRhY3RzLyR7Y29udGFjdElkfS9jb25uZWN0aW9uc2BcclxuICAgICk7XHJcbiAgfVxyXG5cclxuICAvLyDilIDilIAgUmVhY3Rpb25zIOKUgOKUgFxyXG4gIGFkZFJlYWN0aW9uKG1lc3NhZ2VJZDogc3RyaW5nLCBjb250YWN0SWQ6IHN0cmluZywgZW1vamk6IHN0cmluZyk6IE9ic2VydmFibGU8YW55PiB7XHJcbiAgICByZXR1cm4gdGhpcy5odHRwLnBvc3QoYCR7dGhpcy5iYXNlfS9tZXNzYWdlcy8ke21lc3NhZ2VJZH0vcmVhY3Rpb25zYCwge1xyXG4gICAgICBjb250YWN0X2lkOiBwYXJzZUludChjb250YWN0SWQpLFxyXG4gICAgICBlbW9qaSxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcmVtb3ZlUmVhY3Rpb24obWVzc2FnZUlkOiBzdHJpbmcsIGNvbnRhY3RJZDogc3RyaW5nLCBlbW9qaTogc3RyaW5nKTogT2JzZXJ2YWJsZTxhbnk+IHtcclxuICAgIHJldHVybiB0aGlzLmh0dHAuZGVsZXRlKGAke3RoaXMuYmFzZX0vbWVzc2FnZXMvJHttZXNzYWdlSWR9L3JlYWN0aW9uc2AsIHtcclxuICAgICAgYm9keToge1xyXG4gICAgICAgIGNvbnRhY3RfaWQ6IHBhcnNlSW50KGNvbnRhY3RJZCksXHJcbiAgICAgICAgZW1vamksXHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIGdldFJlYWN0aW9ucyhtZXNzYWdlSWQ6IHN0cmluZyk6IE9ic2VydmFibGU8YW55W10+IHtcclxuICAgIHJldHVybiB0aGlzLmh0dHAuZ2V0PGFueVtdPihgJHt0aGlzLmJhc2V9L21lc3NhZ2VzLyR7bWVzc2FnZUlkfS9yZWFjdGlvbnNgKTtcclxuICB9XHJcblxyXG4gIC8vIOKUgOKUgCBUaHJlYWRzIOKUgOKUgFxyXG4gIGdldFRocmVhZE1lc3NhZ2VzKHBhcmVudE1lc3NhZ2VJZDogc3RyaW5nLCBjb250YWN0SWQ6IHN0cmluZyk6IE9ic2VydmFibGU8TWVzc2FnZVtdPiB7XHJcbiAgICBjb25zdCBwYXJhbXMgPSBuZXcgSHR0cFBhcmFtcygpXHJcbiAgICAgIC5zZXQoJ2NvbnRhY3RfaWQnLCBjb250YWN0SWQpO1xyXG4gICAgcmV0dXJuIHRoaXMuaHR0cC5nZXQ8TWVzc2FnZVtdPihgJHt0aGlzLmJhc2V9L21lc3NhZ2VzLyR7cGFyZW50TWVzc2FnZUlkfS90aHJlYWRgLCB7IHBhcmFtcyB9KTtcclxuICB9XHJcblxyXG4gIHNlbmRUaHJlYWRSZXBseShwYXJlbnRNZXNzYWdlSWQ6IHN0cmluZywgc2VuZGVyQ29udGFjdElkOiBzdHJpbmcsIGNvbnRlbnQ6IHN0cmluZyk6IE9ic2VydmFibGU8YW55PiB7XHJcbiAgICByZXR1cm4gdGhpcy5odHRwLnBvc3QoYCR7dGhpcy5iYXNlfS9tZXNzYWdlcy8ke3BhcmVudE1lc3NhZ2VJZH0vcmVwbGllc2AsIHtcclxuICAgICAgc2VuZGVyX2lkOiBwYXJzZUludChzZW5kZXJDb250YWN0SWQpLFxyXG4gICAgICBjb250ZW50LFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvLyDilIDilIAgTWVzc2FnZSBBY3Rpb25zIOKUgOKUgFxyXG4gIGVkaXRNZXNzYWdlKG1lc3NhZ2VJZDogc3RyaW5nLCBjb250YWN0SWQ6IHN0cmluZywgbmV3Q29udGVudDogc3RyaW5nKTogT2JzZXJ2YWJsZTxhbnk+IHtcclxuICAgIHJldHVybiB0aGlzLmh0dHAucHV0KGAke3RoaXMuYmFzZX0vbWVzc2FnZXMvJHttZXNzYWdlSWR9YCwge1xyXG4gICAgICBjb250YWN0SWQsXHJcbiAgICAgIGNvbnRlbnQ6IG5ld0NvbnRlbnQsXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIGRlbGV0ZU1lc3NhZ2UobWVzc2FnZUlkOiBzdHJpbmcsIGNvbnRhY3RJZDogc3RyaW5nKTogT2JzZXJ2YWJsZTxhbnk+IHtcclxuICAgIHJldHVybiB0aGlzLmh0dHAuZGVsZXRlKGAke3RoaXMuYmFzZX0vbWVzc2FnZXMvJHttZXNzYWdlSWR9YCwge1xyXG4gICAgICBib2R5OiB7XHJcbiAgICAgICAgY29udGFjdElkLFxyXG4gICAgICB9LFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwaW5NZXNzYWdlKG1lc3NhZ2VJZDogc3RyaW5nLCBjb252ZXJzYXRpb25JZDogc3RyaW5nLCBjb250YWN0SWQ6IHN0cmluZyk6IE9ic2VydmFibGU8YW55PiB7XHJcbiAgICByZXR1cm4gdGhpcy5odHRwLnBvc3QoYCR7dGhpcy5iYXNlfS9tZXNzYWdlcy8ke21lc3NhZ2VJZH0vcGluYCwge1xyXG4gICAgICBjb252ZXJzYXRpb25JZCxcclxuICAgICAgY29udGFjdElkLFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICB1bnBpbk1lc3NhZ2UobWVzc2FnZUlkOiBzdHJpbmcsIGNvbnRhY3RJZDogc3RyaW5nKTogT2JzZXJ2YWJsZTxhbnk+IHtcclxuICAgIHJldHVybiB0aGlzLmh0dHAuZGVsZXRlKGAke3RoaXMuYmFzZX0vbWVzc2FnZXMvJHttZXNzYWdlSWR9L3BpbmAsIHtcclxuICAgICAgYm9keToge1xyXG4gICAgICAgIGNvbnRhY3RJZCxcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLy8g4pSA4pSAIFByZXNlbmNlIOKUgOKUgFxyXG4gIHVwZGF0ZVByZXNlbmNlKGNvbnRhY3RJZDogc3RyaW5nLCBzdGF0dXM6IHN0cmluZywgY3VzdG9tU3RhdHVzPzogc3RyaW5nKTogT2JzZXJ2YWJsZTxhbnk+IHtcclxuICAgIHdhcm5FbWFpbExpa2VDb250YWN0SWQoY29udGFjdElkKTtcclxuICAgIGNvbnN0IHBhcmFtcyA9IG5ldyBIdHRwUGFyYW1zKCkuc2V0KCdzdGF0dXMnLCBzdGF0dXMpO1xyXG4gICAgcmV0dXJuIHRoaXMuaHR0cC5wdXQoYCR7dGhpcy5iYXNlfS9jb250YWN0cy8ke2NvbnRhY3RJZH0vcHJlc2VuY2VgLCBudWxsLCB7IHBhcmFtcyB9KTtcclxuICB9XHJcblxyXG4gIGdldFByZXNlbmNlKGNvbnRhY3RJZDogc3RyaW5nKTogT2JzZXJ2YWJsZTxhbnk+IHtcclxuICAgIHdhcm5FbWFpbExpa2VDb250YWN0SWQoY29udGFjdElkKTtcclxuICAgIHJldHVybiB0aGlzLmh0dHAuZ2V0KGAke3RoaXMuYmFzZX0vY29udGFjdHMvJHtjb250YWN0SWR9L3ByZXNlbmNlYCk7XHJcbiAgfVxyXG5cclxuICAvLyDilIDilIAgU2VhcmNoIOKUgOKUgFxyXG4gIHNlYXJjaE1lc3NhZ2VzKGNvbnRhY3RJZDogc3RyaW5nLCBxdWVyeTogc3RyaW5nLCBjb252ZXJzYXRpb25JZD86IHN0cmluZyk6IE9ic2VydmFibGU8TWVzc2FnZVtdPiB7XHJcbiAgICByZXR1cm4gdGhpcy5odHRwLnBvc3Q8TWVzc2FnZVtdPihgJHt0aGlzLmJhc2V9L3NlYXJjaGAsIHtcclxuICAgICAgY29udGFjdF9pZDogcGFyc2VJbnQoY29udGFjdElkKSxcclxuICAgICAgcXVlcnksXHJcbiAgICAgIGNvbnZlcnNhdGlvbl9pZDogY29udmVyc2F0aW9uSWQgPyBwYXJzZUludChjb252ZXJzYXRpb25JZCkgOiBudWxsLFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvLyDilIDilIAgTm90aWZpY2F0aW9ucyDilIDilIBcclxuICB1cGRhdGVOb3RpZmljYXRpb25TZXR0aW5ncyhjb252ZXJzYXRpb25JZDogc3RyaW5nLCBjb250YWN0SWQ6IHN0cmluZywgc2V0dGluZ3M6IGFueSk6IE9ic2VydmFibGU8YW55PiB7XHJcbiAgICByZXR1cm4gdGhpcy5odHRwLnB1dChgJHt0aGlzLmJhc2V9L2NvbnZlcnNhdGlvbnMvJHtjb252ZXJzYXRpb25JZH0vbm90aWZpY2F0aW9uc2AsIHtcclxuICAgICAgY29udGFjdElkLFxyXG4gICAgICAuLi5zZXR0aW5ncyxcclxuICAgIH0pO1xyXG4gIH1cclxufVxyXG4iXX0=