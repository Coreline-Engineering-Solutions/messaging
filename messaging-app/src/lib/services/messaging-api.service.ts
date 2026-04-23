import { Injectable, Inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { MESSAGING_CONFIG, MessagingConfig } from '../messaging.config';
import { AuthService } from './auth.service';
import {
  InboxItem,
  Message,
  Contact,
  Conversation,
  ConversationParticipant,
  CompanyConnection,
} from '../models/messaging.models';

@Injectable({ providedIn: 'root' })
export class MessagingApiService {
  private base: string;

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    @Inject(MESSAGING_CONFIG) private config: MessagingConfig
  ) {
    this.base = `${this.config.apiBaseUrl}/messaging`;
  }

  // ── Inbox ──
  getInbox(contactId: string): Observable<InboxItem[]> {
    const params = new HttpParams().set('session_gid', this.auth.sessionGid!);
    return this.http.get<InboxItem[]>(`${this.base}/contacts/${contactId}/inbox`, { params });
  }

  // ── Messages ──
  getMessages(
    conversationId: string,
    contactId: string,
    beforeMessageId?: string,
    limit = 50
  ): Observable<Message[]> {
    let params = new HttpParams()
      .set('contactId', contactId)
      .set('limit', limit.toString())
      .set('sessionGid', this.auth.sessionGid!);
    if (beforeMessageId) {
      params = params.set('beforeMessageId', beforeMessageId);
    }
    return this.http.get<Message[]>(
      `${this.base}/conversations/${conversationId}/messages`,
      { params }
    );
  }

  sendMessage(
    conversationId: string,
    senderContactId: string,
    content: string,
    messageType: 'TEXT' | 'IMAGE' = 'TEXT',
    mediaUrl?: string
  ): Observable<any> {
    const body: any = {
      session_gid: this.auth.sessionGid,
      senderContactId,
      messageType,
    };
    if (messageType === 'TEXT') {
      body.content = content;
    } else {
      body.mediaUrl = mediaUrl || content;
    }
    return this.http.post(`${this.base}/conversations/${conversationId}/messages`, body);
  }

  sendDirectMessage(
    senderContactId: string,
    recipientContactId: string,
    content: string,
    messageType: 'TEXT' | 'IMAGE' = 'TEXT'
  ): Observable<any> {
    return this.http.post(`${this.base}/direct-messages`, {
      session_gid: this.auth.sessionGid,
      senderContactId,
      recipientContactId,
      messageType,
      content,
    });
  }

  markConversationRead(conversationId: string, contactId: string): Observable<any> {
    return this.http.post(`${this.base}/conversations/${conversationId}/read`, {
      session_gid: this.auth.sessionGid,
      contactId,
    });
  }

  // ── Conversations ──
  createConversation(
    creatorContactId: string,
    participantContactIds: string[],
    name?: string
  ): Observable<Conversation> {
    return this.http.post<Conversation>(`${this.base}/conversations`, {
      session_gid: this.auth.sessionGid,
      creatorContactId,
      participantContactIds,
      name: name || null,
    });
  }

  getDirectConversation(contactA: string, contactB: string): Observable<any> {
    const params = new HttpParams()
      .set('contactA', contactA)
      .set('contactB', contactB)
      .set('sessionGid', this.auth.sessionGid!);
    return this.http.get(`${this.base}/conversations/direct`, { params });
  }

  getConversationParticipants(conversationId: string): Observable<ConversationParticipant[]> {
    const params = new HttpParams().set('session_gid', this.auth.sessionGid!);
    return this.http.get<ConversationParticipant[]>(
      `${this.base}/conversations/${conversationId}/participants`,
      { params }
    );
  }

  // ── Contacts ──
  getVisibleContacts(contactId: string): Observable<Contact[]> {
    const params = new HttpParams().set('session_gid', this.auth.sessionGid!);
    return this.http.get<Contact[]>(
      `${this.base}/contacts/${contactId}/visible-contacts`,
      { params }
    );
  }

  checkContactProfile(userGid: string, updates?: any): Observable<any> {
    return this.http.post(`${this.base}/contacts/check`, {
      session_gid: this.auth.sessionGid,
      userGid,
      updates: updates || {},
    });
  }

  // ── Groups ──
  manageGroup(
    contactId: string,
    action: 'create' | 'add' | 'remove' | 'rename',
    conversationId?: string,
    groupName?: string,
    participantContactIds?: string[]
  ): Observable<any> {
    const body: any = {
      session_gid: this.auth.sessionGid,
      contactId,
      action,
    };
    if (conversationId) body.conversationId = conversationId;
    if (groupName) body.groupName = groupName;
    if (participantContactIds) body.participantContactIds = participantContactIds;
    return this.http.post(`${this.base}/groups`, body);
  }

  // ── Delete / Clear ──
  deleteConversation(conversationId: string, contactId: string): Observable<any> {
    return this.http.post(`${this.base}/conversations/${conversationId}/delete`, {
      session_gid: this.auth.sessionGid,
      contactId,
    });
  }

  clearConversation(conversationId: string, contactId: string): Observable<any> {
    return this.http.post(`${this.base}/conversations/${conversationId}/clear`, {
      session_gid: this.auth.sessionGid,
      contactId,
    });
  }

  deleteGroup(conversationId: string, contactId: string): Observable<any> {
    return this.http.post(`${this.base}/groups/${conversationId}/delete`, {
      session_gid: this.auth.sessionGid,
      contactId,
    });
  }

  // ── Attachments ──
  uploadAttachment(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file, file.name);
    formData.append('session_gid', this.auth.sessionGid!);
    return this.http.post(`${this.base}/attachments/upload`, formData);
  }

  // ── Connections ──
  sendConnectionInvite(adminContactId: string, targetCompany: string): Observable<any> {
    return this.http.post(`${this.base}/connections/invites`, {
      session_gid: this.auth.sessionGid,
      adminContactId,
      targetCompany,
    });
  }

  respondToConnection(adminContactId: string, connectionId: string, accept: boolean): Observable<any> {
    return this.http.post(`${this.base}/connections/${connectionId}/respond`, {
      session_gid: this.auth.sessionGid,
      adminContactId,
      accept,
    });
  }

  getCompanyConnections(contactId: string): Observable<CompanyConnection[]> {
    const params = new HttpParams().set('session_gid', this.auth.sessionGid!);
    return this.http.get<CompanyConnection[]>(
      `${this.base}/contacts/${contactId}/connections`,
      { params }
    );
  }
}
