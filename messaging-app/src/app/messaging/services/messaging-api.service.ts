import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import {
  InboxItem,
  Message,
  Contact,
  Conversation,
} from '../models/messaging.models';

@Injectable({ providedIn: 'root' })
export class MessagingApiService {
  private base = `${environment.apiBaseUrl}/messaging`;

  constructor(private http: HttpClient, private auth: AuthService) {}

  private authOptions(
    options: { headers?: Record<string, string>; params?: HttpParams; body?: any } = {}
  ): { headers?: Record<string, string>; params?: HttpParams; body?: any } {
    const sessionGid = this.auth.sessionGid;
    if (!sessionGid) return options;
    return {
      ...options,
      headers: {
        ...(options.headers || {}),
        'X-Messaging-Session': sessionGid,
      },
    };
  }

  private sessionBody(body: any = {}): any {
    return body;
  }

  // ── Inbox ──
  getInbox(contactId: string): Observable<InboxItem[]> {
    return this.http.get<InboxItem[]>(`${this.base}/my-inbox`, this.authOptions());
  }

  // ── Messages ──
  getMessages(
    conversationId: string,
    contactId: string,
    beforeMessageId?: string,
    limit = 50
  ): Observable<Message[]> {
    let params = new HttpParams().set('limit', limit.toString());
    if (beforeMessageId) {
      params = params.set('before', beforeMessageId);
    }
    return this.http.get<Message[]>(
      `${this.base}/conversations/${conversationId}/messages`,
      this.authOptions({ params })
    );
  }

  sendMessage(
    conversationId: string,
    senderContactId: string,
    content: string,
    messageType: 'TEXT' | 'IMAGE' = 'TEXT',
    mediaUrl?: string
  ): Observable<any> {
    const body: any = this.sessionBody({
      content,
    });
    return this.http.post(`${this.base}/conversations/${conversationId}/messages`, body, this.authOptions());
  }

  sendDirectMessage(
    senderContactId: string,
    recipientContactId: string,
    content: string,
    messageType: 'TEXT' | 'IMAGE' = 'TEXT'
  ): Observable<any> {
    return this.http.post(`${this.base}/direct-messages`, this.sessionBody({
      recipient_id: parseInt(recipientContactId, 10),
      content,
    }), this.authOptions());
  }

  markConversationRead(conversationId: string, contactId: string): Observable<any> {
    return this.http.post(`${this.base}/conversations/${conversationId}/read`, this.sessionBody(), this.authOptions());
  }

  editMessage(messageId: string, contactId: string, newContent: string): Observable<any> {
    return this.http.put(`${this.base}/messages/${messageId}`, this.sessionBody({
      content: newContent,
    }), this.authOptions());
  }

  deleteMessage(messageId: string, contactId: string): Observable<any> {
    return this.http.delete(`${this.base}/messages/${messageId}`, this.authOptions({ body: this.sessionBody() }));
  }

  // ── Conversations ──
  createConversation(
    creatorContactId: string,
    participantContactIds: string[],
    name?: string
  ): Observable<Conversation> {
    return this.http.post<Conversation>(`${this.base}/conversations`, this.sessionBody({
      participants: participantContactIds.map(id => parseInt(id, 10)),
      name: name || null,
    }), this.authOptions());
  }

  getDirectConversation(contactA: string, contactB: string): Observable<any> {
    const params = new HttpParams().set('contactB', contactB);
    return this.http.get(`${this.base}/conversations/direct`, this.authOptions({ params }));
  }

  // ── Contacts ──
  getVisibleContacts(contactId: string): Observable<Contact[]> {
    return this.http.get<Contact[]>(
      `${this.base}/my-visible-contacts`,
      this.authOptions()
    );
  }

  checkContactProfile(userGid: string, updates?: any): Observable<any> {
    return this.http.post(`${this.base}/contacts/check`, this.sessionBody(), this.authOptions());
  }

  // ── Groups ──
  manageGroup(
    contactId: string,
    action: 'create' | 'add' | 'remove' | 'rename',
    conversationId?: string,
    groupName?: string,
    participantContactIds?: string[]
  ): Observable<any> {
    const payload: any = {};
    if (conversationId) payload.conversation_id = parseInt(conversationId, 10);
    if (groupName) payload.name = groupName;
    if (participantContactIds) payload.participant_ids = participantContactIds.map(id => parseInt(id, 10));
    if (action === 'remove') payload.contact_id = parseInt(contactId, 10);
    return this.http.post(`${this.base}/groups`, { ...this.sessionBody(), action, payload }, this.authOptions());
  }

}
