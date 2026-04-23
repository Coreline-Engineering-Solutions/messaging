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
        const params = new HttpParams().set('session_gid', this.auth.sessionGid);
        return this.http.get(`${this.base}/contacts/${contactId}/inbox`, { params });
    }
    // ── Messages ──
    getMessages(conversationId, contactId, beforeMessageId, limit = 50) {
        let params = new HttpParams()
            .set('contactId', contactId)
            .set('limit', limit.toString())
            .set('sessionGid', this.auth.sessionGid);
        if (beforeMessageId) {
            params = params.set('beforeMessageId', beforeMessageId);
        }
        return this.http.get(`${this.base}/conversations/${conversationId}/messages`, { params });
    }
    sendMessage(conversationId, senderContactId, content, messageType = 'TEXT', mediaUrl) {
        const body = {
            session_gid: this.auth.sessionGid,
            senderContactId,
            messageType,
        };
        if (messageType === 'TEXT') {
            body.content = content;
        }
        else {
            body.mediaUrl = mediaUrl || content;
        }
        return this.http.post(`${this.base}/conversations/${conversationId}/messages`, body);
    }
    sendDirectMessage(senderContactId, recipientContactId, content, messageType = 'TEXT') {
        return this.http.post(`${this.base}/direct-messages`, {
            session_gid: this.auth.sessionGid,
            senderContactId,
            recipientContactId,
            messageType,
            content,
        });
    }
    markConversationRead(conversationId, contactId) {
        return this.http.post(`${this.base}/conversations/${conversationId}/read`, {
            session_gid: this.auth.sessionGid,
            contactId,
        });
    }
    // ── Conversations ──
    createConversation(creatorContactId, participantContactIds, name) {
        return this.http.post(`${this.base}/conversations`, {
            session_gid: this.auth.sessionGid,
            creatorContactId,
            participantContactIds,
            name: name || null,
        });
    }
    getDirectConversation(contactA, contactB) {
        const params = new HttpParams()
            .set('contactA', contactA)
            .set('contactB', contactB)
            .set('sessionGid', this.auth.sessionGid);
        return this.http.get(`${this.base}/conversations/direct`, { params });
    }
    getConversationParticipants(conversationId) {
        const params = new HttpParams().set('session_gid', this.auth.sessionGid);
        return this.http.get(`${this.base}/conversations/${conversationId}/participants`, { params });
    }
    // ── Contacts ──
    getVisibleContacts(contactId) {
        const params = new HttpParams().set('session_gid', this.auth.sessionGid);
        return this.http.get(`${this.base}/contacts/${contactId}/visible-contacts`, { params });
    }
    checkContactProfile(userGid, updates) {
        return this.http.post(`${this.base}/contacts/check`, {
            session_gid: this.auth.sessionGid,
            userGid,
            updates: updates || {},
        });
    }
    // ── Groups ──
    manageGroup(contactId, action, conversationId, groupName, participantContactIds) {
        const body = {
            session_gid: this.auth.sessionGid,
            contactId,
            action,
        };
        if (conversationId)
            body.conversationId = conversationId;
        if (groupName)
            body.groupName = groupName;
        if (participantContactIds)
            body.participantContactIds = participantContactIds;
        return this.http.post(`${this.base}/groups`, body);
    }
    // ── Delete / Clear ──
    deleteConversation(conversationId, contactId) {
        return this.http.post(`${this.base}/conversations/${conversationId}/delete`, {
            session_gid: this.auth.sessionGid,
            contactId,
        });
    }
    clearConversation(conversationId, contactId) {
        return this.http.post(`${this.base}/conversations/${conversationId}/clear`, {
            session_gid: this.auth.sessionGid,
            contactId,
        });
    }
    deleteGroup(conversationId, contactId) {
        return this.http.post(`${this.base}/groups/${conversationId}/delete`, {
            session_gid: this.auth.sessionGid,
            contactId,
        });
    }
    // ── Attachments ──
    uploadAttachment(file) {
        const formData = new FormData();
        formData.append('file', file, file.name);
        formData.append('session_gid', this.auth.sessionGid);
        return this.http.post(`${this.base}/attachments/upload`, formData);
    }
    // ── Connections ──
    sendConnectionInvite(adminContactId, targetCompany) {
        return this.http.post(`${this.base}/connections/invites`, {
            session_gid: this.auth.sessionGid,
            adminContactId,
            targetCompany,
        });
    }
    respondToConnection(adminContactId, connectionId, accept) {
        return this.http.post(`${this.base}/connections/${connectionId}/respond`, {
            session_gid: this.auth.sessionGid,
            adminContactId,
            accept,
        });
    }
    getCompanyConnections(contactId) {
        const params = new HttpParams().set('session_gid', this.auth.sessionGid);
        return this.http.get(`${this.base}/contacts/${contactId}/connections`, { params });
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVzc2FnaW5nLWFwaS5zZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL2xpYi9zZXJ2aWNlcy9tZXNzYWdpbmctYXBpLnNlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLEVBQUUsTUFBTSxlQUFlLENBQUM7QUFDbkQsT0FBTyxFQUFjLFVBQVUsRUFBRSxNQUFNLHNCQUFzQixDQUFDO0FBRTlELE9BQU8sRUFBRSxnQkFBZ0IsRUFBbUIsTUFBTSxxQkFBcUIsQ0FBQzs7OztBQVl4RSxNQUFNLE9BQU8sbUJBQW1CO0lBSXBCO0lBQ0E7SUFDMEI7SUFMNUIsSUFBSSxDQUFTO0lBRXJCLFlBQ1UsSUFBZ0IsRUFDaEIsSUFBaUIsRUFDUyxNQUF1QjtRQUZqRCxTQUFJLEdBQUosSUFBSSxDQUFZO1FBQ2hCLFNBQUksR0FBSixJQUFJLENBQWE7UUFDUyxXQUFNLEdBQU4sTUFBTSxDQUFpQjtRQUV6RCxJQUFJLENBQUMsSUFBSSxHQUFHLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxVQUFVLFlBQVksQ0FBQztJQUNwRCxDQUFDO0lBRUQsY0FBYztJQUNkLFFBQVEsQ0FBQyxTQUFpQjtRQUN4QixNQUFNLE1BQU0sR0FBRyxJQUFJLFVBQVUsRUFBRSxDQUFDLEdBQUcsQ0FBQyxhQUFhLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFXLENBQUMsQ0FBQztRQUMxRSxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFjLEdBQUcsSUFBSSxDQUFDLElBQUksYUFBYSxTQUFTLFFBQVEsRUFBRSxFQUFFLE1BQU0sRUFBRSxDQUFDLENBQUM7SUFDNUYsQ0FBQztJQUVELGlCQUFpQjtJQUNqQixXQUFXLENBQ1QsY0FBc0IsRUFDdEIsU0FBaUIsRUFDakIsZUFBd0IsRUFDeEIsS0FBSyxHQUFHLEVBQUU7UUFFVixJQUFJLE1BQU0sR0FBRyxJQUFJLFVBQVUs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O3dHQXRNVSxtQkFBbUIsdUVBTXBCLGdCQUFnQjs0R0FOZixtQkFBbUIsY0FETixNQUFNOzs0RkFDbkIsbUJBQW1CO2tCQUQvQixVQUFVO21CQUFDLEVBQUUsVUFBVSxFQUFFLE1BQU0sRUFBRTs7MEJBTzdCLE1BQU07MkJBQUMsZ0JBQWdCIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgSW5qZWN0YWJsZSwgSW5qZWN0IH0gZnJvbSAnQGFuZ3VsYXIvY29yZSc7XG5pbXBvcnQgeyBIdHRwQ2xpZW50LCBIdHRwUGFyYW1zIH0gZnJvbSAnQGFuZ3VsYXIvY29tbW9uL2h0dHAnO1xuaW1wb3J0IHsgT2JzZXJ2YWJsZSB9IGZyb20gJ3J4anMnO1xuaW1wb3J0IHsgTUVTU0FHSU5HX0NPTkZJRywgTWVzc2FnaW5nQ29uZmlnIH0gZnJvbSAnLi4vbWVzc2FnaW5nLmNvbmZpZyc7XG5pbXBvcnQgeyBBdXRoU2VydmljZSB9IGZyb20gJy4vYXV0aC5zZXJ2aWNlJztcbmltcG9ydCB7XG4gIEluYm94SXRlbSxcbiAgTWVzc2FnZSxcbiAgQ29udGFjdCxcbiAgQ29udmVyc2F0aW9uLFxuICBDb252ZXJzYXRpb25QYXJ0aWNpcGFudCxcbiAgQ29tcGFueUNvbm5lY3Rpb24sXG59IGZyb20gJy4uL21vZGVscy9tZXNzYWdpbmcubW9kZWxzJztcblxuQEluamVjdGFibGUoeyBwcm92aWRlZEluOiAncm9vdCcgfSlcbmV4cG9ydCBjbGFzcyBNZXNzYWdpbmdBcGlTZXJ2aWNlIHtcbiAgcHJpdmF0ZSBiYXNlOiBzdHJpbmc7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSBodHRwOiBIdHRwQ2xpZW50LFxuICAgIHByaXZhdGUgYXV0aDogQXV0aFNlcnZpY2UsXG4gICAgQEluamVjdChNRVNTQUdJTkdfQ09ORklHKSBwcml2YXRlIGNvbmZpZzogTWVzc2FnaW5nQ29uZmlnXG4gICkge1xuICAgIHRoaXMuYmFzZSA9IGAke3RoaXMuY29uZmlnLmFwaUJhc2VVcmx9L21lc3NhZ2luZ2A7XG4gIH1cblxuICAvLyDilIDilIAgSW5ib3gg4pSA4pSAXG4gIGdldEluYm94KGNvbnRhY3RJZDogc3RyaW5nKTogT2JzZXJ2YWJsZTxJbmJveEl0ZW1bXT4ge1xuICAgIGNvbnN0IHBhcmFtcyA9IG5ldyBIdHRwUGFyYW1zKCkuc2V0KCdzZXNzaW9uX2dpZCcsIHRoaXMuYXV0aC5zZXNzaW9uR2lkISk7XG4gICAgcmV0dXJuIHRoaXMuaHR0cC5nZXQ8SW5ib3hJdGVtW10+KGAke3RoaXMuYmFzZX0vY29udGFjdHMvJHtjb250YWN0SWR9L2luYm94YCwgeyBwYXJhbXMgfSk7XG4gIH1cblxuICAvLyDilIDilIAgTWVzc2FnZXMg4pSA4pSAXG4gIGdldE1lc3NhZ2VzKFxuICAgIGNvbnZlcnNhdGlvbklkOiBzdHJpbmcsXG4gICAgY29udGFjdElkOiBzdHJpbmcsXG4gICAgYmVmb3JlTWVzc2FnZUlkPzogc3RyaW5nLFxuICAgIGxpbWl0ID0gNTBcbiAgKTogT2JzZXJ2YWJsZTxNZXNzYWdlW10+IHtcbiAgICBsZXQgcGFyYW1zID0gbmV3IEh0dHBQYXJhbXMoKVxuICAgICAgLnNldCgnY29udGFjdElkJywgY29udGFjdElkKVxuICAgICAgLnNldCgnbGltaXQnLCBsaW1pdC50b1N0cmluZygpKVxuICAgICAgLnNldCgnc2Vzc2lvbkdpZCcsIHRoaXMuYXV0aC5zZXNzaW9uR2lkISk7XG4gICAgaWYgKGJlZm9yZU1lc3NhZ2VJZCkge1xuICAgICAgcGFyYW1zID0gcGFyYW1zLnNldCgnYmVmb3JlTWVzc2FnZUlkJywgYmVmb3JlTWVzc2FnZUlkKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuaHR0cC5nZXQ8TWVzc2FnZVtdPihcbiAgICAgIGAke3RoaXMuYmFzZX0vY29udmVyc2F0aW9ucy8ke2NvbnZlcnNhdGlvbklkfS9tZXNzYWdlc2AsXG4gICAgICB7IHBhcmFtcyB9XG4gICAgKTtcbiAgfVxuXG4gIHNlbmRNZXNzYWdlKFxuICAgIGNvbnZlcnNhdGlvbklkOiBzdHJpbmcsXG4gICAgc2VuZGVyQ29udGFjdElkOiBzdHJpbmcsXG4gICAgY29udGVudDogc3RyaW5nLFxuICAgIG1lc3NhZ2VUeXBlOiAnVEVYVCcgfCAnSU1BR0UnID0gJ1RFWFQnLFxuICAgIG1lZGlhVXJsPzogc3RyaW5nXG4gICk6IE9ic2VydmFibGU8YW55PiB7XG4gICAgY29uc3QgYm9keTogYW55ID0ge1xuICAgICAgc2Vzc2lvbl9naWQ6IHRoaXMuYXV0aC5zZXNzaW9uR2lkLFxuICAgICAgc2VuZGVyQ29udGFjdElkLFxuICAgICAgbWVzc2FnZVR5cGUsXG4gICAgfTtcbiAgICBpZiAobWVzc2FnZVR5cGUgPT09ICdURVhUJykge1xuICAgICAgYm9keS5jb250ZW50ID0gY29udGVudDtcbiAgICB9IGVsc2Uge1xuICAgICAgYm9keS5tZWRpYVVybCA9IG1lZGlhVXJsIHx8IGNvbnRlbnQ7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmh0dHAucG9zdChgJHt0aGlzLmJhc2V9L2NvbnZlcnNhdGlvbnMvJHtjb252ZXJzYXRpb25JZH0vbWVzc2FnZXNgLCBib2R5KTtcbiAgfVxuXG4gIHNlbmREaXJlY3RNZXNzYWdlKFxuICAgIHNlbmRlckNvbnRhY3RJZDogc3RyaW5nLFxuICAgIHJlY2lwaWVudENvbnRhY3RJZDogc3RyaW5nLFxuICAgIGNvbnRlbnQ6IHN0cmluZyxcbiAgICBtZXNzYWdlVHlwZTogJ1RFWFQnIHwgJ0lNQUdFJyA9ICdURVhUJ1xuICApOiBPYnNlcnZhYmxlPGFueT4ge1xuICAgIHJldHVybiB0aGlzLmh0dHAucG9zdChgJHt0aGlzLmJhc2V9L2RpcmVjdC1tZXNzYWdlc2AsIHtcbiAgICAgIHNlc3Npb25fZ2lkOiB0aGlzLmF1dGguc2Vzc2lvbkdpZCxcbiAgICAgIHNlbmRlckNvbnRhY3RJZCxcbiAgICAgIHJlY2lwaWVudENvbnRhY3RJZCxcbiAgICAgIG1lc3NhZ2VUeXBlLFxuICAgICAgY29udGVudCxcbiAgICB9KTtcbiAgfVxuXG4gIG1hcmtDb252ZXJzYXRpb25SZWFkKGNvbnZlcnNhdGlvbklkOiBzdHJpbmcsIGNvbnRhY3RJZDogc3RyaW5nKTogT2JzZXJ2YWJsZTxhbnk+IHtcbiAgICByZXR1cm4gdGhpcy5odHRwLnBvc3QoYCR7dGhpcy5iYXNlfS9jb252ZXJzYXRpb25zLyR7Y29udmVyc2F0aW9uSWR9L3JlYWRgLCB7XG4gICAgICBzZXNzaW9uX2dpZDogdGhpcy5hdXRoLnNlc3Npb25HaWQsXG4gICAgICBjb250YWN0SWQsXG4gICAgfSk7XG4gIH1cblxuICAvLyDilIDilIAgQ29udmVyc2F0aW9ucyDilIDilIBcbiAgY3JlYXRlQ29udmVyc2F0aW9uKFxuICAgIGNyZWF0b3JDb250YWN0SWQ6IHN0cmluZyxcbiAgICBwYXJ0aWNpcGFudENvbnRhY3RJZHM6IHN0cmluZ1tdLFxuICAgIG5hbWU/OiBzdHJpbmdcbiAgKTogT2JzZXJ2YWJsZTxDb252ZXJzYXRpb24+IHtcbiAgICByZXR1cm4gdGhpcy5odHRwLnBvc3Q8Q29udmVyc2F0aW9uPihgJHt0aGlzLmJhc2V9L2NvbnZlcnNhdGlvbnNgLCB7XG4gICAgICBzZXNzaW9uX2dpZDogdGhpcy5hdXRoLnNlc3Npb25HaWQsXG4gICAgICBjcmVhdG9yQ29udGFjdElkLFxuICAgICAgcGFydGljaXBhbnRDb250YWN0SWRzLFxuICAgICAgbmFtZTogbmFtZSB8fCBudWxsLFxuICAgIH0pO1xuICB9XG5cbiAgZ2V0RGlyZWN0Q29udmVyc2F0aW9uKGNvbnRhY3RBOiBzdHJpbmcsIGNvbnRhY3RCOiBzdHJpbmcpOiBPYnNlcnZhYmxlPGFueT4ge1xuICAgIGNvbnN0IHBhcmFtcyA9IG5ldyBIdHRwUGFyYW1zKClcbiAgICAgIC5zZXQoJ2NvbnRhY3RBJywgY29udGFjdEEpXG4gICAgICAuc2V0KCdjb250YWN0QicsIGNvbnRhY3RCKVxuICAgICAgLnNldCgnc2Vzc2lvbkdpZCcsIHRoaXMuYXV0aC5zZXNzaW9uR2lkISk7XG4gICAgcmV0dXJuIHRoaXMuaHR0cC5nZXQoYCR7dGhpcy5iYXNlfS9jb252ZXJzYXRpb25zL2RpcmVjdGAsIHsgcGFyYW1zIH0pO1xuICB9XG5cbiAgZ2V0Q29udmVyc2F0aW9uUGFydGljaXBhbnRzKGNvbnZlcnNhdGlvbklkOiBzdHJpbmcpOiBPYnNlcnZhYmxlPENvbnZlcnNhdGlvblBhcnRpY2lwYW50W10+IHtcbiAgICBjb25zdCBwYXJhbXMgPSBuZXcgSHR0cFBhcmFtcygpLnNldCgnc2Vzc2lvbl9naWQnLCB0aGlzLmF1dGguc2Vzc2lvbkdpZCEpO1xuICAgIHJldHVybiB0aGlzLmh0dHAuZ2V0PENvbnZlcnNhdGlvblBhcnRpY2lwYW50W10+KFxuICAgICAgYCR7dGhpcy5iYXNlfS9jb252ZXJzYXRpb25zLyR7Y29udmVyc2F0aW9uSWR9L3BhcnRpY2lwYW50c2AsXG4gICAgICB7IHBhcmFtcyB9XG4gICAgKTtcbiAgfVxuXG4gIC8vIOKUgOKUgCBDb250YWN0cyDilIDilIBcbiAgZ2V0VmlzaWJsZUNvbnRhY3RzKGNvbnRhY3RJZDogc3RyaW5nKTogT2JzZXJ2YWJsZTxDb250YWN0W10+IHtcbiAgICBjb25zdCBwYXJhbXMgPSBuZXcgSHR0cFBhcmFtcygpLnNldCgnc2Vzc2lvbl9naWQnLCB0aGlzLmF1dGguc2Vzc2lvbkdpZCEpO1xuICAgIHJldHVybiB0aGlzLmh0dHAuZ2V0PENvbnRhY3RbXT4oXG4gICAgICBgJHt0aGlzLmJhc2V9L2NvbnRhY3RzLyR7Y29udGFjdElkfS92aXNpYmxlLWNvbnRhY3RzYCxcbiAgICAgIHsgcGFyYW1zIH1cbiAgICApO1xuICB9XG5cbiAgY2hlY2tDb250YWN0UHJvZmlsZSh1c2VyR2lkOiBzdHJpbmcsIHVwZGF0ZXM/OiBhbnkpOiBPYnNlcnZhYmxlPGFueT4ge1xuICAgIHJldHVybiB0aGlzLmh0dHAucG9zdChgJHt0aGlzLmJhc2V9L2NvbnRhY3RzL2NoZWNrYCwge1xuICAgICAgc2Vzc2lvbl9naWQ6IHRoaXMuYXV0aC5zZXNzaW9uR2lkLFxuICAgICAgdXNlckdpZCxcbiAgICAgIHVwZGF0ZXM6IHVwZGF0ZXMgfHwge30sXG4gICAgfSk7XG4gIH1cblxuICAvLyDilIDilIAgR3JvdXBzIOKUgOKUgFxuICBtYW5hZ2VHcm91cChcbiAgICBjb250YWN0SWQ6IHN0cmluZyxcbiAgICBhY3Rpb246ICdjcmVhdGUnIHwgJ2FkZCcgfCAncmVtb3ZlJyB8ICdyZW5hbWUnLFxuICAgIGNvbnZlcnNhdGlvbklkPzogc3RyaW5nLFxuICAgIGdyb3VwTmFtZT86IHN0cmluZyxcbiAgICBwYXJ0aWNpcGFudENvbnRhY3RJZHM/OiBzdHJpbmdbXVxuICApOiBPYnNlcnZhYmxlPGFueT4ge1xuICAgIGNvbnN0IGJvZHk6IGFueSA9IHtcbiAgICAgIHNlc3Npb25fZ2lkOiB0aGlzLmF1dGguc2Vzc2lvbkdpZCxcbiAgICAgIGNvbnRhY3RJZCxcbiAgICAgIGFjdGlvbixcbiAgICB9O1xuICAgIGlmIChjb252ZXJzYXRpb25JZCkgYm9keS5jb252ZXJzYXRpb25JZCA9IGNvbnZlcnNhdGlvbklkO1xuICAgIGlmIChncm91cE5hbWUpIGJvZHkuZ3JvdXBOYW1lID0gZ3JvdXBOYW1lO1xuICAgIGlmIChwYXJ0aWNpcGFudENvbnRhY3RJZHMpIGJvZHkucGFydGljaXBhbnRDb250YWN0SWRzID0gcGFydGljaXBhbnRDb250YWN0SWRzO1xuICAgIHJldHVybiB0aGlzLmh0dHAucG9zdChgJHt0aGlzLmJhc2V9L2dyb3Vwc2AsIGJvZHkpO1xuICB9XG5cbiAgLy8g4pSA4pSAIERlbGV0ZSAvIENsZWFyIOKUgOKUgFxuICBkZWxldGVDb252ZXJzYXRpb24oY29udmVyc2F0aW9uSWQ6IHN0cmluZywgY29udGFjdElkOiBzdHJpbmcpOiBPYnNlcnZhYmxlPGFueT4ge1xuICAgIHJldHVybiB0aGlzLmh0dHAucG9zdChgJHt0aGlzLmJhc2V9L2NvbnZlcnNhdGlvbnMvJHtjb252ZXJzYXRpb25JZH0vZGVsZXRlYCwge1xuICAgICAgc2Vzc2lvbl9naWQ6IHRoaXMuYXV0aC5zZXNzaW9uR2lkLFxuICAgICAgY29udGFjdElkLFxuICAgIH0pO1xuICB9XG5cbiAgY2xlYXJDb252ZXJzYXRpb24oY29udmVyc2F0aW9uSWQ6IHN0cmluZywgY29udGFjdElkOiBzdHJpbmcpOiBPYnNlcnZhYmxlPGFueT4ge1xuICAgIHJldHVybiB0aGlzLmh0dHAucG9zdChgJHt0aGlzLmJhc2V9L2NvbnZlcnNhdGlvbnMvJHtjb252ZXJzYXRpb25JZH0vY2xlYXJgLCB7XG4gICAgICBzZXNzaW9uX2dpZDogdGhpcy5hdXRoLnNlc3Npb25HaWQsXG4gICAgICBjb250YWN0SWQsXG4gICAgfSk7XG4gIH1cblxuICBkZWxldGVHcm91cChjb252ZXJzYXRpb25JZDogc3RyaW5nLCBjb250YWN0SWQ6IHN0cmluZyk6IE9ic2VydmFibGU8YW55PiB7XG4gICAgcmV0dXJuIHRoaXMuaHR0cC5wb3N0KGAke3RoaXMuYmFzZX0vZ3JvdXBzLyR7Y29udmVyc2F0aW9uSWR9L2RlbGV0ZWAsIHtcbiAgICAgIHNlc3Npb25fZ2lkOiB0aGlzLmF1dGguc2Vzc2lvbkdpZCxcbiAgICAgIGNvbnRhY3RJZCxcbiAgICB9KTtcbiAgfVxuXG4gIC8vIOKUgOKUgCBBdHRhY2htZW50cyDilIDilIBcbiAgdXBsb2FkQXR0YWNobWVudChmaWxlOiBGaWxlKTogT2JzZXJ2YWJsZTxhbnk+IHtcbiAgICBjb25zdCBmb3JtRGF0YSA9IG5ldyBGb3JtRGF0YSgpO1xuICAgIGZvcm1EYXRhLmFwcGVuZCgnZmlsZScsIGZpbGUsIGZpbGUubmFtZSk7XG4gICAgZm9ybURhdGEuYXBwZW5kKCdzZXNzaW9uX2dpZCcsIHRoaXMuYXV0aC5zZXNzaW9uR2lkISk7XG4gICAgcmV0dXJuIHRoaXMuaHR0cC5wb3N0KGAke3RoaXMuYmFzZX0vYXR0YWNobWVudHMvdXBsb2FkYCwgZm9ybURhdGEpO1xuICB9XG5cbiAgLy8g4pSA4pSAIENvbm5lY3Rpb25zIOKUgOKUgFxuICBzZW5kQ29ubmVjdGlvbkludml0ZShhZG1pbkNvbnRhY3RJZDogc3RyaW5nLCB0YXJnZXRDb21wYW55OiBzdHJpbmcpOiBPYnNlcnZhYmxlPGFueT4ge1xuICAgIHJldHVybiB0aGlzLmh0dHAucG9zdChgJHt0aGlzLmJhc2V9L2Nvbm5lY3Rpb25zL2ludml0ZXNgLCB7XG4gICAgICBzZXNzaW9uX2dpZDogdGhpcy5hdXRoLnNlc3Npb25HaWQsXG4gICAgICBhZG1pbkNvbnRhY3RJZCxcbiAgICAgIHRhcmdldENvbXBhbnksXG4gICAgfSk7XG4gIH1cblxuICByZXNwb25kVG9Db25uZWN0aW9uKGFkbWluQ29udGFjdElkOiBzdHJpbmcsIGNvbm5lY3Rpb25JZDogc3RyaW5nLCBhY2NlcHQ6IGJvb2xlYW4pOiBPYnNlcnZhYmxlPGFueT4ge1xuICAgIHJldHVybiB0aGlzLmh0dHAucG9zdChgJHt0aGlzLmJhc2V9L2Nvbm5lY3Rpb25zLyR7Y29ubmVjdGlvbklkfS9yZXNwb25kYCwge1xuICAgICAgc2Vzc2lvbl9naWQ6IHRoaXMuYXV0aC5zZXNzaW9uR2lkLFxuICAgICAgYWRtaW5Db250YWN0SWQsXG4gICAgICBhY2NlcHQsXG4gICAgfSk7XG4gIH1cblxuICBnZXRDb21wYW55Q29ubmVjdGlvbnMoY29udGFjdElkOiBzdHJpbmcpOiBPYnNlcnZhYmxlPENvbXBhbnlDb25uZWN0aW9uW10+IHtcbiAgICBjb25zdCBwYXJhbXMgPSBuZXcgSHR0cFBhcmFtcygpLnNldCgnc2Vzc2lvbl9naWQnLCB0aGlzLmF1dGguc2Vzc2lvbkdpZCEpO1xuICAgIHJldHVybiB0aGlzLmh0dHAuZ2V0PENvbXBhbnlDb25uZWN0aW9uW10+KFxuICAgICAgYCR7dGhpcy5iYXNlfS9jb250YWN0cy8ke2NvbnRhY3RJZH0vY29ubmVjdGlvbnNgLFxuICAgICAgeyBwYXJhbXMgfVxuICAgICk7XG4gIH1cbn1cbiJdfQ==