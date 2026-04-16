// ── Configuration ──
export { MessagingConfig, MESSAGING_CONFIG } from './messaging.config';

// ── Models ──
export {
  AuthSession,
  Contact,
  InboxItem,
  Message,
  Conversation,
  ConversationParticipant,
  CompanyConnection,
  WebSocketMessage,
  ChatWindow,
  Attachment,
  SidebarSide,
  getContactDisplayName,
  getMessageSenderName,
} from './models/messaging.models';

// ── Services ──
export { AuthService } from './services/auth.service';
export { MessagingApiService } from './services/messaging-api.service';
export { MessagingWebSocketService } from './services/messaging-websocket.service';
export { MessagingFileService } from './services/messaging-file.service';
export { MessagingAuthBridgeService } from './services/messaging-auth-bridge.service';
export { MessagingStoreService } from './services/messaging-store.service';

// ── Components ──
export { MessagingOverlayComponent } from './messaging-overlay.component';
export { FloatingButtonComponent } from './components/floating-button/floating-button.component';
export { ChatPanelComponent } from './components/chat-panel/chat-panel.component';
export { ChatThreadComponent } from './components/chat-thread/chat-thread.component';
export { InboxListComponent } from './components/inbox-list/inbox-list.component';
export { NewConversationComponent } from './components/new-conversation/new-conversation.component';
export { GroupManagerComponent } from './components/group-manager/group-manager.component';
export { MessageInputComponent, MessagePayload } from './components/message-input/message-input.component';
