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
    warnEmailLikeContactId(contactId);
    return this.http.get<InboxItem[]>(`${this.base}/contacts/${contactId}/inbox`);
  }

  // ── Messages ──
  getMessages(
    conversationId: string,
    contactId: string,
    beforeMessageId?: string,
    limit = 50
  ): Observable<Message[]> {
    let params = new HttpParams()
      .set('contact_id', contactId)
      .set('limit', limit.toString());
    if (beforeMessageId) {
      params = params.set('before', beforeMessageId);
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
    messageType: 'TEXT' | 'IMAGE' | 'SYSTEM' = 'TEXT',
    mediaUrl?: string
  ): Observable<any> {
    const body: any = {
      sender_id: parseInt(senderContactId),
      content,
    };
    return this.http.post(`${this.base}/conversations/${conversationId}/messages`, body);
  }

  sendDirectMessage(
    senderContactId: string,
    recipientContactId: string,
    content: string,
    messageType: 'TEXT' | 'IMAGE' = 'TEXT'
  ): Observable<any> {
    return this.http.post(`${this.base}/direct-messages`, {
      sender_id: parseInt(senderContactId),
      recipient_id: parseInt(recipientContactId),
      content,
    });
  }

  markConversationRead(conversationId: string, contactId: string): Observable<any> {
    return this.http.post(`${this.base}/conversations/${conversationId}/read`, {
      contact_id: parseInt(contactId, 10),
    });
  }

  // ── Conversations ──
  createConversation(
    creatorContactId: string,
    participantContactIds: string[],
    name?: string
  ): Observable<Conversation> {
    return this.http.post<Conversation>(`${this.base}/conversations`, {
      creator_id: parseInt(creatorContactId),
      participants: participantContactIds.map(id => parseInt(id)),
      name: name || null,
    });
  }

  getDirectConversation(contactA: string, contactB: string): Observable<any> {
    const params = new HttpParams()
      .set('contactA', contactA)
      .set('contactB', contactB);
    return this.http.get(`${this.base}/conversations/direct`, { params });
  }

  getConversationParticipants(conversationId: string): Observable<ConversationParticipant[]> {
    return this.http.get<ConversationParticipant[]>(
      `${this.base}/conversations/${conversationId}/participants`
    );
  }

  // ── Contacts ──
  getVisibleContacts(contactId: string): Observable<Contact[]> {
    warnEmailLikeContactId(contactId);
    return this.http.get<Contact[]>(
      `${this.base}/contacts/${contactId}/visible-contacts`
    );
  }

  checkContactProfile(contactId: string, updates?: any): Observable<any> {
    return this.http.post(`${this.base}/contacts/check`, {
      contact_id: parseInt(contactId),
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
    const payload: any = {
      contact_id: parseInt(contactId),
    };
    if (conversationId) payload.conversation_id = parseInt(conversationId);
    if (groupName) payload.name = groupName;
    if (participantContactIds) payload.participant_ids = participantContactIds.map(id => parseInt(id));
    return this.http.post(`${this.base}/groups`, {
      action,
      payload,
    });
  }

  // ── Delete / Clear ──
  deleteConversation(conversationId: string, contactId: string): Observable<any> {
    return this.http.post(`${this.base}/conversations/${conversationId}/delete`, {
      contactId,
    });
  }

  clearConversation(conversationId: string, contactId: string): Observable<any> {
    return this.http.post(`${this.base}/conversations/${conversationId}/clear`, {
      contactId,
    });
  }

  deleteGroup(conversationId: string, contactId: string): Observable<any> {
    return this.manageGroup(contactId, 'remove', conversationId);
  }

  // ── Attachments ──
  uploadAttachment(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file, file.name);
    return this.http.post(`${this.base}/attachments/upload`, formData);
  }

  // ── Connections ──
  sendConnectionInvite(adminContactId: string, targetCompany: string): Observable<any> {
    return this.http.post(`${this.base}/connections/invites`, {
      admin_contact_id: parseInt(adminContactId),
      target_company: targetCompany,
    });
  }

  respondToConnection(adminContactId: string, connectionId: string, accept: boolean): Observable<any> {
    return this.http.post(`${this.base}/connections/${connectionId}/respond`, {
      admin_contact_id: parseInt(adminContactId),
      accept,
    });
  }

  getCompanyConnections(contactId: string): Observable<CompanyConnection[]> {
    warnEmailLikeContactId(contactId);
    return this.http.get<CompanyConnection[]>(
      `${this.base}/contacts/${contactId}/connections`
    );
  }

  // ── Reactions ──
  addReaction(messageId: string, contactId: string, emoji: string): Observable<any> {
    return this.http.post(`${this.base}/messages/${messageId}/reactions`, {
      contact_id: parseInt(contactId),
      emoji,
    });
  }

  removeReaction(messageId: string, contactId: string, emoji: string): Observable<any> {
    return this.http.delete(`${this.base}/messages/${messageId}/reactions`, {
      body: {
        contact_id: parseInt(contactId),
        emoji,
      },
    });
  }

  getReactions(messageId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/messages/${messageId}/reactions`);
  }

  // ── Threads ──
  getThreadMessages(parentMessageId: string, contactId: string): Observable<Message[]> {
    const params = new HttpParams()
      .set('contact_id', contactId);
    return this.http.get<Message[]>(`${this.base}/messages/${parentMessageId}/thread`, { params });
  }

  sendThreadReply(parentMessageId: string, senderContactId: string, content: string): Observable<any> {
    return this.http.post(`${this.base}/messages/${parentMessageId}/replies`, {
      sender_id: parseInt(senderContactId),
      content,
    });
  }

  // ── Message Actions ──
  editMessage(messageId: string, contactId: string, newContent: string): Observable<any> {
    return this.http.put(`${this.base}/messages/${messageId}`, {
      contactId,
      content: newContent,
    });
  }

  deleteMessage(messageId: string, contactId: string): Observable<any> {
    return this.http.delete(`${this.base}/messages/${messageId}`, {
      body: {
        contactId,
      },
    });
  }

  pinMessage(messageId: string, conversationId: string, contactId: string): Observable<any> {
    return this.http.post(`${this.base}/messages/${messageId}/pin`, {
      conversationId,
      contactId,
    });
  }

  unpinMessage(messageId: string, contactId: string): Observable<any> {
    return this.http.delete(`${this.base}/messages/${messageId}/pin`, {
      body: {
        contactId,
      },
    });
  }

  // ── Presence ──
  updatePresence(contactId: string, status: string, customStatus?: string): Observable<any> {
    warnEmailLikeContactId(contactId);
    const params = new HttpParams().set('status', status);
    return this.http.put(`${this.base}/contacts/${contactId}/presence`, null, { params });
  }

  getPresence(contactId: string): Observable<any> {
    warnEmailLikeContactId(contactId);
    return this.http.get(`${this.base}/contacts/${contactId}/presence`);
  }

  // ── Search ──
  searchMessages(contactId: string, query: string, conversationId?: string): Observable<Message[]> {
    return this.http.post<Message[]>(`${this.base}/search`, {
      contact_id: parseInt(contactId),
      query,
      conversation_id: conversationId ? parseInt(conversationId) : null,
    });
  }

  // ── Notifications ──
  updateNotificationSettings(conversationId: string, contactId: string, settings: any): Observable<any> {
    return this.http.put(`${this.base}/conversations/${conversationId}/notifications`, {
      contactId,
      ...settings,
    });
  }
}
