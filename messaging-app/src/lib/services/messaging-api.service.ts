import { Injectable, Inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { MESSAGING_CONFIG, MessagingConfig } from '../messaging.config';
import { warnEmailLikeContactId } from '../messaging-dev-warnings';
import { AuthService } from './auth.service';
import {
  InboxItem,
  Message,
  Contact,
  Conversation,
  ConversationParticipant,
} from '../models/messaging.models';

export interface EligibleProjectUsersResponse {
  db_gid: string;
  project_gid: string;
  project_name?: string;
  users: Contact[];
}

@Injectable({ providedIn: 'root' })
export class MessagingApiService {
  private base: string;
  private activeDbGid: string | null = null;

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    @Inject(MESSAGING_CONFIG) private config: MessagingConfig
  ) {
    this.base = `${this.config.apiBaseUrl}/messaging`;
  }

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

  setActiveDbGid(dbGid: string | null | undefined): void {
    const normalized = String(dbGid || '').trim();
    this.activeDbGid = normalized || null;
  }

  // ── Inbox ──
  getInbox(contactId: string): Observable<InboxItem[]> {
    warnEmailLikeContactId(contactId);
    let params = new HttpParams();
    if (this.activeDbGid) params = params.set('db_gid', this.activeDbGid);
    return this.http.get<InboxItem[]>(
      `${this.base}/my-inbox`,
      this.authOptions({ params })
    );
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
    messageType: 'TEXT' | 'IMAGE' | 'SYSTEM' = 'TEXT',
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
      recipient_id: parseInt(recipientContactId),
      content,
    }), this.authOptions());
  }

  markConversationRead(conversationId: string, contactId: string): Observable<any> {
    return this.http.post(`${this.base}/conversations/${conversationId}/read`, this.sessionBody(), this.authOptions());
  }

  // ── Conversations ──
  createConversation(
    creatorContactId: string,
    participantContactIds: string[],
    name?: string
  ): Observable<Conversation> {
    return this.http.post<Conversation>(`${this.base}/conversations`, this.sessionBody({
      participants: participantContactIds.map(id => parseInt(id)),
      name: name || null,
    }), this.authOptions());
  }

  getDirectConversation(contactA: string, contactB: string): Observable<any> {
    const params = new HttpParams().set('contactB', contactB);
    return this.http.get(`${this.base}/conversations/direct`, this.authOptions({ params }));
  }

  getConversationParticipants(conversationId: string): Observable<ConversationParticipant[]> {
    return this.http.get<ConversationParticipant[]>(
      `${this.base}/conversations/${conversationId}/participants`,
      this.authOptions()
    );
  }

  // ── Contacts ──
  getVisibleContacts(contactId: string): Observable<Contact[]> {
    warnEmailLikeContactId(contactId);
    return this.http.get<Contact[]>(
      `${this.base}/my-visible-contacts`,
      this.authOptions()
    );
  }

  getEligibleProjectUsers(dbGid: string, projectGid: string): Observable<EligibleProjectUsersResponse> {
    return this.http.get<EligibleProjectUsersResponse>(
      `${this.base}/project-groups/${encodeURIComponent(dbGid)}/${encodeURIComponent(projectGid)}/eligible-users`,
      this.authOptions()
    );
  }

  checkContactProfile(contactId: string, updates?: any): Observable<any> {
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
    if (conversationId) payload.conversation_id = parseInt(conversationId);
    if (groupName) payload.name = groupName;
    if (participantContactIds) payload.participant_ids = participantContactIds.map(id => parseInt(id));
    if (action === 'remove') payload.contact_id = parseInt(contactId);
    return this.http.post(`${this.base}/groups`, {
      ...this.sessionBody(),
      action,
      payload,
    }, this.authOptions());
  }

  // ── Delete / Clear ──
  deleteConversation(conversationId: string, contactId: string): Observable<any> {
    return this.http.post(`${this.base}/conversations/${conversationId}/delete`, {
      contactId,
    }, this.authOptions());
  }

  clearConversation(conversationId: string, contactId: string): Observable<any> {
    return this.http.post(`${this.base}/conversations/${conversationId}/clear`, {
      contactId,
    }, this.authOptions());
  }

  deleteGroup(conversationId: string, contactId: string): Observable<any> {
    return this.manageGroup(contactId, 'remove', conversationId);
  }

  setGroupAdmin(conversationId: string, contactId: string, isAdmin: boolean): Observable<any> {
    return this.http.post(
      `${this.base}/groups/${encodeURIComponent(conversationId)}/admins/${encodeURIComponent(contactId)}`,
      this.sessionBody({ is_admin: isAdmin }),
      this.authOptions()
    );
  }

  // ── Attachments ──
  uploadAttachment(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file, file.name);
    return this.http.post(`${this.base}/attachments/upload`, formData, this.authOptions());
  }

  // ── Reactions ──
  addReaction(messageId: string, contactId: string, emoji: string): Observable<any> {
    return this.http.post(`${this.base}/messages/${messageId}/reactions`, this.sessionBody({
      emoji,
    }), this.authOptions());
  }

  removeReaction(messageId: string, contactId: string, emoji: string): Observable<any> {
    return this.http.delete(`${this.base}/messages/${messageId}/reactions`, this.authOptions({
      body: this.sessionBody({
        emoji,
      }),
    }));
  }

  getReactions(messageId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/messages/${messageId}/reactions`, this.authOptions());
  }

  // ── Threads ──
  getThreadMessages(parentMessageId: string, contactId: string): Observable<Message[]> {
    return this.http.get<Message[]>(`${this.base}/messages/${parentMessageId}/thread`, this.authOptions());
  }

  sendThreadReply(parentMessageId: string, senderContactId: string, content: string): Observable<any> {
    return this.http.post(`${this.base}/messages/${parentMessageId}/replies`, this.sessionBody({
      content,
    }), this.authOptions());
  }

  // ── Message Actions ──
  editMessage(messageId: string, contactId: string, newContent: string): Observable<any> {
    return this.http.put(`${this.base}/messages/${messageId}`, this.sessionBody({
      content: newContent,
    }), this.authOptions());
  }

  deleteMessage(messageId: string, contactId: string): Observable<any> {
    return this.http.delete(`${this.base}/messages/${messageId}`, this.authOptions({
      body: this.sessionBody(),
    }));
  }

  pinMessage(messageId: string, conversationId: string, contactId: string): Observable<any> {
    return this.http.post(`${this.base}/messages/${messageId}/pin`, {
      conversationId,
      contactId,
    }, this.authOptions());
  }

  unpinMessage(messageId: string, contactId: string): Observable<any> {
    return this.http.delete(`${this.base}/messages/${messageId}/pin`, this.authOptions({
      body: {
        contactId,
      },
    }));
  }

  // ── Presence ──
  updatePresence(contactId: string, status: string, customStatus?: string): Observable<any> {
    warnEmailLikeContactId(contactId);
    return this.http.put(`${this.base}/contacts/${contactId}/presence`, this.sessionBody({ status, custom_status: customStatus }), this.authOptions());
  }

  getPresence(contactId: string): Observable<any> {
    warnEmailLikeContactId(contactId);
    return this.http.get(`${this.base}/contacts/${contactId}/presence`, this.authOptions());
  }

  // ── Search ──
  searchMessages(contactId: string, query: string, conversationId?: string): Observable<Message[]> {
    return this.http.post<Message[]>(`${this.base}/search`, this.sessionBody({
      query,
      conversation_id: conversationId ? parseInt(conversationId) : null,
    }), this.authOptions());
  }

  // ── Notifications ──
  updateNotificationSettings(conversationId: string, contactId: string, settings: any): Observable<any> {
    return this.http.put(`${this.base}/conversations/${conversationId}/notifications`, {
      contactId,
      ...settings,
    }, this.authOptions());
  }
}
