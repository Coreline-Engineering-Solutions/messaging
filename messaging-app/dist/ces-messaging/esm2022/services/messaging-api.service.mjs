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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVzc2FnaW5nLWFwaS5zZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL2xpYi9zZXJ2aWNlcy9tZXNzYWdpbmctYXBpLnNlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLEVBQUUsTUFBTSxlQUFlLENBQUM7QUFDbkQsT0FBTyxFQUFjLFVBQVUsRUFBRSxNQUFNLHNCQUFzQixDQUFDO0FBRTlELE9BQU8sRUFBRSxnQkFBZ0IsRUFBbUIsTUFBTSxxQkFBcUIsQ0FBQzs7OztBQVd4RSxNQUFNLE9BQU8sbUJBQW1CO0lBSXBCO0lBQ0E7SUFDMEI7SUFMNUIsSUFBSSxDQUFTO0lBRXJCLFlBQ1UsSUFBZ0IsRUFDaEIsSUFBaUIsRUFDUyxNQUF1QjtRQUZqRCxTQUFJLEdBQUosSUFBSSxDQUFZO1FBQ2hCLFNBQUksR0FBSixJQUFJLENBQWE7UUFDUyxXQUFNLEdBQU4sTUFBTSxDQUFpQjtRQUV6RCxJQUFJLENBQUMsSUFBSSxHQUFHLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxVQUFVLFlBQVksQ0FBQztJQUNwRCxDQUFDO0lBRUQsY0FBYztJQUNkLFFBQVEsQ0FBQyxTQUFpQjtRQUN4QixNQUFNLE1BQU0sR0FBRyxJQUFJLFVBQVUsRUFBRSxDQUFDLEdBQUcsQ0FBQyxhQUFhLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFXLENBQUMsQ0FBQztRQUMxRSxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFjLEdBQUcsSUFBSSxDQUFDLElBQUksYUFBYSxTQUFTLFFBQVEsRUFBRSxFQUFFLE1BQU0sRUFBRSxDQUFDLENBQUM7SUFDNUYsQ0FBQztJQUVELGlCQUFpQjtJQUNqQixXQUFXLENBQ1QsY0FBc0IsRUFDdEIsU0FBaUIsRUFDakIsZUFBd0IsRUFDeEIsS0FBSyxHQUFHLEVBQUU7UUFFVixJQUFJLE1BQU0sR0FBRyxJQUFJLFVBQVUs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QUFDO0lBRUQsb0JBQW9CO0lBQ3BCLG9CQUFvQixDQUFDLGNBQXNCLEVBQUUsYUFBcUI7UUFDaEUsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxJQUFJLHNCQUFzQixFQUFFO1lBQ3hELFdBQVcsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVU7WUFDakMsY0FBYztZQUNkLGFBQWE7U0FDZCxDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQsbUJBQW1CLENBQUMsY0FBc0IsRUFBRSxZQUFvQixFQUFFLE1BQWU7UUFDL0UsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxJQUFJLGdCQUFnQixZQUFZLFVBQVUsRUFBRTtZQUN4RSxXQUFXLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVO1lBQ2pDLGNBQWM7WUFDZCxNQUFNO1NBQ1AsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVELHFCQUFxQixDQUFDLFNBQWlCO1FBQ3JDLE1BQU0sTUFBTSxHQUFHLElBQUksVUFBVSxFQUFFLENBQUMsR0FBRyxDQUFDLGFBQWEsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVcsQ0FBQyxDQUFDO1FBQzFFLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQ2xCLEdBQUcsSUFBSSxDQUFDLElBQUksYUFBYSxTQUFTLGNBQWMsRUFDaEQsRUFBRSxNQUFNLEVBQUUsQ0FDWCxDQUFDO0lBQ0osQ0FBQzt3R0E5TFUsbUJBQW1CLHVFQU1wQixnQkFBZ0I7NEdBTmYsbUJBQW1CLGNBRE4sTUFBTTs7NEZBQ25CLG1CQUFtQjtrQkFEL0IsVUFBVTttQkFBQyxFQUFFLFVBQVUsRUFBRSxNQUFNLEVBQUU7OzBCQU83QixNQUFNOzJCQUFDLGdCQUFnQiIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEluamVjdGFibGUsIEluamVjdCB9IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xuaW1wb3J0IHsgSHR0cENsaWVudCwgSHR0cFBhcmFtcyB9IGZyb20gJ0Bhbmd1bGFyL2NvbW1vbi9odHRwJztcbmltcG9ydCB7IE9ic2VydmFibGUgfSBmcm9tICdyeGpzJztcbmltcG9ydCB7IE1FU1NBR0lOR19DT05GSUcsIE1lc3NhZ2luZ0NvbmZpZyB9IGZyb20gJy4uL21lc3NhZ2luZy5jb25maWcnO1xuaW1wb3J0IHsgQXV0aFNlcnZpY2UgfSBmcm9tICcuL2F1dGguc2VydmljZSc7XG5pbXBvcnQge1xuICBJbmJveEl0ZW0sXG4gIE1lc3NhZ2UsXG4gIENvbnRhY3QsXG4gIENvbnZlcnNhdGlvbixcbiAgQ29tcGFueUNvbm5lY3Rpb24sXG59IGZyb20gJy4uL21vZGVscy9tZXNzYWdpbmcubW9kZWxzJztcblxuQEluamVjdGFibGUoeyBwcm92aWRlZEluOiAncm9vdCcgfSlcbmV4cG9ydCBjbGFzcyBNZXNzYWdpbmdBcGlTZXJ2aWNlIHtcbiAgcHJpdmF0ZSBiYXNlOiBzdHJpbmc7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSBodHRwOiBIdHRwQ2xpZW50LFxuICAgIHByaXZhdGUgYXV0aDogQXV0aFNlcnZpY2UsXG4gICAgQEluamVjdChNRVNTQUdJTkdfQ09ORklHKSBwcml2YXRlIGNvbmZpZzogTWVzc2FnaW5nQ29uZmlnXG4gICkge1xuICAgIHRoaXMuYmFzZSA9IGAke3RoaXMuY29uZmlnLmFwaUJhc2VVcmx9L21lc3NhZ2luZ2A7XG4gIH1cblxuICAvLyDilIDilIAgSW5ib3gg4pSA4pSAXG4gIGdldEluYm94KGNvbnRhY3RJZDogc3RyaW5nKTogT2JzZXJ2YWJsZTxJbmJveEl0ZW1bXT4ge1xuICAgIGNvbnN0IHBhcmFtcyA9IG5ldyBIdHRwUGFyYW1zKCkuc2V0KCdzZXNzaW9uX2dpZCcsIHRoaXMuYXV0aC5zZXNzaW9uR2lkISk7XG4gICAgcmV0dXJuIHRoaXMuaHR0cC5nZXQ8SW5ib3hJdGVtW10+KGAke3RoaXMuYmFzZX0vY29udGFjdHMvJHtjb250YWN0SWR9L2luYm94YCwgeyBwYXJhbXMgfSk7XG4gIH1cblxuICAvLyDilIDilIAgTWVzc2FnZXMg4pSA4pSAXG4gIGdldE1lc3NhZ2VzKFxuICAgIGNvbnZlcnNhdGlvbklkOiBzdHJpbmcsXG4gICAgY29udGFjdElkOiBzdHJpbmcsXG4gICAgYmVmb3JlTWVzc2FnZUlkPzogc3RyaW5nLFxuICAgIGxpbWl0ID0gNTBcbiAgKTogT2JzZXJ2YWJsZTxNZXNzYWdlW10+IHtcbiAgICBsZXQgcGFyYW1zID0gbmV3IEh0dHBQYXJhbXMoKVxuICAgICAgLnNldCgnY29udGFjdElkJywgY29udGFjdElkKVxuICAgICAgLnNldCgnbGltaXQnLCBsaW1pdC50b1N0cmluZygpKVxuICAgICAgLnNldCgnc2Vzc2lvbkdpZCcsIHRoaXMuYXV0aC5zZXNzaW9uR2lkISk7XG4gICAgaWYgKGJlZm9yZU1lc3NhZ2VJZCkge1xuICAgICAgcGFyYW1zID0gcGFyYW1zLnNldCgnYmVmb3JlTWVzc2FnZUlkJywgYmVmb3JlTWVzc2FnZUlkKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuaHR0cC5nZXQ8TWVzc2FnZVtdPihcbiAgICAgIGAke3RoaXMuYmFzZX0vY29udmVyc2F0aW9ucy8ke2NvbnZlcnNhdGlvbklkfS9tZXNzYWdlc2AsXG4gICAgICB7IHBhcmFtcyB9XG4gICAgKTtcbiAgfVxuXG4gIHNlbmRNZXNzYWdlKFxuICAgIGNvbnZlcnNhdGlvbklkOiBzdHJpbmcsXG4gICAgc2VuZGVyQ29udGFjdElkOiBzdHJpbmcsXG4gICAgY29udGVudDogc3RyaW5nLFxuICAgIG1lc3NhZ2VUeXBlOiAnVEVYVCcgfCAnSU1BR0UnID0gJ1RFWFQnLFxuICAgIG1lZGlhVXJsPzogc3RyaW5nXG4gICk6IE9ic2VydmFibGU8YW55PiB7XG4gICAgY29uc3QgYm9keTogYW55ID0ge1xuICAgICAgc2Vzc2lvbl9naWQ6IHRoaXMuYXV0aC5zZXNzaW9uR2lkLFxuICAgICAgc2VuZGVyQ29udGFjdElkLFxuICAgICAgbWVzc2FnZVR5cGUsXG4gICAgfTtcbiAgICBpZiAobWVzc2FnZVR5cGUgPT09ICdURVhUJykge1xuICAgICAgYm9keS5jb250ZW50ID0gY29udGVudDtcbiAgICB9IGVsc2Uge1xuICAgICAgYm9keS5tZWRpYVVybCA9IG1lZGlhVXJsIHx8IGNvbnRlbnQ7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmh0dHAucG9zdChgJHt0aGlzLmJhc2V9L2NvbnZlcnNhdGlvbnMvJHtjb252ZXJzYXRpb25JZH0vbWVzc2FnZXNgLCBib2R5KTtcbiAgfVxuXG4gIHNlbmREaXJlY3RNZXNzYWdlKFxuICAgIHNlbmRlckNvbnRhY3RJZDogc3RyaW5nLFxuICAgIHJlY2lwaWVudENvbnRhY3RJZDogc3RyaW5nLFxuICAgIGNvbnRlbnQ6IHN0cmluZyxcbiAgICBtZXNzYWdlVHlwZTogJ1RFWFQnIHwgJ0lNQUdFJyA9ICdURVhUJ1xuICApOiBPYnNlcnZhYmxlPGFueT4ge1xuICAgIHJldHVybiB0aGlzLmh0dHAucG9zdChgJHt0aGlzLmJhc2V9L2RpcmVjdC1tZXNzYWdlc2AsIHtcbiAgICAgIHNlc3Npb25fZ2lkOiB0aGlzLmF1dGguc2Vzc2lvbkdpZCxcbiAgICAgIHNlbmRlckNvbnRhY3RJZCxcbiAgICAgIHJlY2lwaWVudENvbnRhY3RJZCxcbiAgICAgIG1lc3NhZ2VUeXBlLFxuICAgICAgY29udGVudCxcbiAgICB9KTtcbiAgfVxuXG4gIG1hcmtDb252ZXJzYXRpb25SZWFkKGNvbnZlcnNhdGlvbklkOiBzdHJpbmcsIGNvbnRhY3RJZDogc3RyaW5nKTogT2JzZXJ2YWJsZTxhbnk+IHtcbiAgICByZXR1cm4gdGhpcy5odHRwLnBvc3QoYCR7dGhpcy5iYXNlfS9jb252ZXJzYXRpb25zLyR7Y29udmVyc2F0aW9uSWR9L3JlYWRgLCB7XG4gICAgICBzZXNzaW9uX2dpZDogdGhpcy5hdXRoLnNlc3Npb25HaWQsXG4gICAgICBjb250YWN0SWQsXG4gICAgfSk7XG4gIH1cblxuICAvLyDilIDilIAgQ29udmVyc2F0aW9ucyDilIDilIBcbiAgY3JlYXRlQ29udmVyc2F0aW9uKFxuICAgIGNyZWF0b3JDb250YWN0SWQ6IHN0cmluZyxcbiAgICBwYXJ0aWNpcGFudENvbnRhY3RJZHM6IHN0cmluZ1tdLFxuICAgIG5hbWU/OiBzdHJpbmdcbiAgKTogT2JzZXJ2YWJsZTxDb252ZXJzYXRpb24+IHtcbiAgICByZXR1cm4gdGhpcy5odHRwLnBvc3Q8Q29udmVyc2F0aW9uPihgJHt0aGlzLmJhc2V9L2NvbnZlcnNhdGlvbnNgLCB7XG4gICAgICBzZXNzaW9uX2dpZDogdGhpcy5hdXRoLnNlc3Npb25HaWQsXG4gICAgICBjcmVhdG9yQ29udGFjdElkLFxuICAgICAgcGFydGljaXBhbnRDb250YWN0SWRzLFxuICAgICAgbmFtZTogbmFtZSB8fCBudWxsLFxuICAgIH0pO1xuICB9XG5cbiAgZ2V0RGlyZWN0Q29udmVyc2F0aW9uKGNvbnRhY3RBOiBzdHJpbmcsIGNvbnRhY3RCOiBzdHJpbmcpOiBPYnNlcnZhYmxlPGFueT4ge1xuICAgIGNvbnN0IHBhcmFtcyA9IG5ldyBIdHRwUGFyYW1zKClcbiAgICAgIC5zZXQoJ2NvbnRhY3RBJywgY29udGFjdEEpXG4gICAgICAuc2V0KCdjb250YWN0QicsIGNvbnRhY3RCKVxuICAgICAgLnNldCgnc2Vzc2lvbkdpZCcsIHRoaXMuYXV0aC5zZXNzaW9uR2lkISk7XG4gICAgcmV0dXJuIHRoaXMuaHR0cC5nZXQoYCR7dGhpcy5iYXNlfS9jb252ZXJzYXRpb25zL2RpcmVjdGAsIHsgcGFyYW1zIH0pO1xuICB9XG5cbiAgLy8g4pSA4pSAIENvbnRhY3RzIOKUgOKUgFxuICBnZXRWaXNpYmxlQ29udGFjdHMoY29udGFjdElkOiBzdHJpbmcpOiBPYnNlcnZhYmxlPENvbnRhY3RbXT4ge1xuICAgIGNvbnN0IHBhcmFtcyA9IG5ldyBIdHRwUGFyYW1zKCkuc2V0KCdzZXNzaW9uX2dpZCcsIHRoaXMuYXV0aC5zZXNzaW9uR2lkISk7XG4gICAgcmV0dXJuIHRoaXMuaHR0cC5nZXQ8Q29udGFjdFtdPihcbiAgICAgIGAke3RoaXMuYmFzZX0vY29udGFjdHMvJHtjb250YWN0SWR9L3Zpc2libGUtY29udGFjdHNgLFxuICAgICAgeyBwYXJhbXMgfVxuICAgICk7XG4gIH1cblxuICBjaGVja0NvbnRhY3RQcm9maWxlKHVzZXJHaWQ6IHN0cmluZywgdXBkYXRlcz86IGFueSk6IE9ic2VydmFibGU8YW55PiB7XG4gICAgcmV0dXJuIHRoaXMuaHR0cC5wb3N0KGAke3RoaXMuYmFzZX0vY29udGFjdHMvY2hlY2tgLCB7XG4gICAgICBzZXNzaW9uX2dpZDogdGhpcy5hdXRoLnNlc3Npb25HaWQsXG4gICAgICB1c2VyR2lkLFxuICAgICAgdXBkYXRlczogdXBkYXRlcyB8fCB7fSxcbiAgICB9KTtcbiAgfVxuXG4gIC8vIOKUgOKUgCBHcm91cHMg4pSA4pSAXG4gIG1hbmFnZUdyb3VwKFxuICAgIGNvbnRhY3RJZDogc3RyaW5nLFxuICAgIGFjdGlvbjogJ2NyZWF0ZScgfCAnYWRkJyB8ICdyZW1vdmUnIHwgJ3JlbmFtZScsXG4gICAgY29udmVyc2F0aW9uSWQ/OiBzdHJpbmcsXG4gICAgZ3JvdXBOYW1lPzogc3RyaW5nLFxuICAgIHBhcnRpY2lwYW50Q29udGFjdElkcz86IHN0cmluZ1tdXG4gICk6IE9ic2VydmFibGU8YW55PiB7XG4gICAgY29uc3QgYm9keTogYW55ID0ge1xuICAgICAgc2Vzc2lvbl9naWQ6IHRoaXMuYXV0aC5zZXNzaW9uR2lkLFxuICAgICAgY29udGFjdElkLFxuICAgICAgYWN0aW9uLFxuICAgIH07XG4gICAgaWYgKGNvbnZlcnNhdGlvbklkKSBib2R5LmNvbnZlcnNhdGlvbklkID0gY29udmVyc2F0aW9uSWQ7XG4gICAgaWYgKGdyb3VwTmFtZSkgYm9keS5ncm91cE5hbWUgPSBncm91cE5hbWU7XG4gICAgaWYgKHBhcnRpY2lwYW50Q29udGFjdElkcykgYm9keS5wYXJ0aWNpcGFudENvbnRhY3RJZHMgPSBwYXJ0aWNpcGFudENvbnRhY3RJZHM7XG4gICAgcmV0dXJuIHRoaXMuaHR0cC5wb3N0KGAke3RoaXMuYmFzZX0vZ3JvdXBzYCwgYm9keSk7XG4gIH1cblxuICAvLyDilIDilIAgRGVsZXRlIC8gQ2xlYXIg4pSA4pSAXG4gIGRlbGV0ZUNvbnZlcnNhdGlvbihjb252ZXJzYXRpb25JZDogc3RyaW5nLCBjb250YWN0SWQ6IHN0cmluZyk6IE9ic2VydmFibGU8YW55PiB7XG4gICAgcmV0dXJuIHRoaXMuaHR0cC5wb3N0KGAke3RoaXMuYmFzZX0vY29udmVyc2F0aW9ucy8ke2NvbnZlcnNhdGlvbklkfS9kZWxldGVgLCB7XG4gICAgICBzZXNzaW9uX2dpZDogdGhpcy5hdXRoLnNlc3Npb25HaWQsXG4gICAgICBjb250YWN0SWQsXG4gICAgfSk7XG4gIH1cblxuICBjbGVhckNvbnZlcnNhdGlvbihjb252ZXJzYXRpb25JZDogc3RyaW5nLCBjb250YWN0SWQ6IHN0cmluZyk6IE9ic2VydmFibGU8YW55PiB7XG4gICAgcmV0dXJuIHRoaXMuaHR0cC5wb3N0KGAke3RoaXMuYmFzZX0vY29udmVyc2F0aW9ucy8ke2NvbnZlcnNhdGlvbklkfS9jbGVhcmAsIHtcbiAgICAgIHNlc3Npb25fZ2lkOiB0aGlzLmF1dGguc2Vzc2lvbkdpZCxcbiAgICAgIGNvbnRhY3RJZCxcbiAgICB9KTtcbiAgfVxuXG4gIGRlbGV0ZUdyb3VwKGNvbnZlcnNhdGlvbklkOiBzdHJpbmcsIGNvbnRhY3RJZDogc3RyaW5nKTogT2JzZXJ2YWJsZTxhbnk+IHtcbiAgICByZXR1cm4gdGhpcy5odHRwLnBvc3QoYCR7dGhpcy5iYXNlfS9ncm91cHMvJHtjb252ZXJzYXRpb25JZH0vZGVsZXRlYCwge1xuICAgICAgc2Vzc2lvbl9naWQ6IHRoaXMuYXV0aC5zZXNzaW9uR2lkLFxuICAgICAgY29udGFjdElkLFxuICAgIH0pO1xuICB9XG5cbiAgLy8g4pSA4pSAIEF0dGFjaG1lbnRzIOKUgOKUgFxuICB1cGxvYWRBdHRhY2htZW50KGZpbGU6IEZpbGUpOiBPYnNlcnZhYmxlPGFueT4ge1xuICAgIGNvbnN0IGZvcm1EYXRhID0gbmV3IEZvcm1EYXRhKCk7XG4gICAgZm9ybURhdGEuYXBwZW5kKCdmaWxlJywgZmlsZSwgZmlsZS5uYW1lKTtcbiAgICBmb3JtRGF0YS5hcHBlbmQoJ3Nlc3Npb25fZ2lkJywgdGhpcy5hdXRoLnNlc3Npb25HaWQhKTtcbiAgICByZXR1cm4gdGhpcy5odHRwLnBvc3QoYCR7dGhpcy5iYXNlfS9hdHRhY2htZW50cy91cGxvYWRgLCBmb3JtRGF0YSk7XG4gIH1cblxuICAvLyDilIDilIAgQ29ubmVjdGlvbnMg4pSA4pSAXG4gIHNlbmRDb25uZWN0aW9uSW52aXRlKGFkbWluQ29udGFjdElkOiBzdHJpbmcsIHRhcmdldENvbXBhbnk6IHN0cmluZyk6IE9ic2VydmFibGU8YW55PiB7XG4gICAgcmV0dXJuIHRoaXMuaHR0cC5wb3N0KGAke3RoaXMuYmFzZX0vY29ubmVjdGlvbnMvaW52aXRlc2AsIHtcbiAgICAgIHNlc3Npb25fZ2lkOiB0aGlzLmF1dGguc2Vzc2lvbkdpZCxcbiAgICAgIGFkbWluQ29udGFjdElkLFxuICAgICAgdGFyZ2V0Q29tcGFueSxcbiAgICB9KTtcbiAgfVxuXG4gIHJlc3BvbmRUb0Nvbm5lY3Rpb24oYWRtaW5Db250YWN0SWQ6IHN0cmluZywgY29ubmVjdGlvbklkOiBzdHJpbmcsIGFjY2VwdDogYm9vbGVhbik6IE9ic2VydmFibGU8YW55PiB7XG4gICAgcmV0dXJuIHRoaXMuaHR0cC5wb3N0KGAke3RoaXMuYmFzZX0vY29ubmVjdGlvbnMvJHtjb25uZWN0aW9uSWR9L3Jlc3BvbmRgLCB7XG4gICAgICBzZXNzaW9uX2dpZDogdGhpcy5hdXRoLnNlc3Npb25HaWQsXG4gICAgICBhZG1pbkNvbnRhY3RJZCxcbiAgICAgIGFjY2VwdCxcbiAgICB9KTtcbiAgfVxuXG4gIGdldENvbXBhbnlDb25uZWN0aW9ucyhjb250YWN0SWQ6IHN0cmluZyk6IE9ic2VydmFibGU8Q29tcGFueUNvbm5lY3Rpb25bXT4ge1xuICAgIGNvbnN0IHBhcmFtcyA9IG5ldyBIdHRwUGFyYW1zKCkuc2V0KCdzZXNzaW9uX2dpZCcsIHRoaXMuYXV0aC5zZXNzaW9uR2lkISk7XG4gICAgcmV0dXJuIHRoaXMuaHR0cC5nZXQ8Q29tcGFueUNvbm5lY3Rpb25bXT4oXG4gICAgICBgJHt0aGlzLmJhc2V9L2NvbnRhY3RzLyR7Y29udGFjdElkfS9jb25uZWN0aW9uc2AsXG4gICAgICB7IHBhcmFtcyB9XG4gICAgKTtcbiAgfVxufVxuIl19