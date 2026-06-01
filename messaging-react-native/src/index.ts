// Configuration
export {
  configureMessaging,
  getMessagingConfig,
  isMessagingConfigured,
  type MessagingRuntimeConfig,
} from './configure';

// Constants
export {
  MESSAGING_OPEN_EVENT,
  MESSAGING_PANEL_HEIGHT_DEFAULT,
  MESSAGING_PANEL_HEIGHT_MAX,
  MESSAGING_PANEL_HEIGHT_MIN,
  MESSAGING_PANEL_HEIGHT_KEY,
  MESSAGING_FAVORITES_KEY_PREFIX,
} from './constants/messagingConfig';

// Types
export type {
  Contact,
  InboxItem,
  InboxFilter,
  Message,
  MessageReaction,
  MessageAttachment,
  MessagingView,
  WebSocketMessage,
  WsStatus,
  GroupEditState,
} from './types/messaging';
export {
  getContactDisplayName,
  getInboxDisplayName,
  getMessageSenderName,
  resolveMessageSenderDisplayName,
  isProjectConversation,
} from './types/messaging';

// Context
export {
  MessagingProvider,
  useMessaging,
  useMessagingOptional,
  requestMessagingOpen,
  type MessagingPresentation,
} from './context/MessagingContext';

// UI
export { MessagingOverlay } from './components/MessagingOverlay';
export { MessagingPanel } from './components/MessagingPanel';
export { MessagingScreen } from './components/MessagingScreen';
export { MessagingImagePickerHost } from './components/MessagingImagePickerHost';
export {
  MessagingTabBarButton,
  type MessagingTabBarButtonProps,
} from './components/MessagingTabBarButton';
export { MapTabBarButton, type MapTabBarButtonProps } from './components/MapTabBarButton';

// Theme (optional overrides in host)
export { colors, spacing, borderRadius, borderWidth, shadows, fontSizes, fontWeights } from './theme';

// Services (advanced integration)
export { messagingWebSocket } from './services/messagingWebSocketService';
export { resolveContactByEmail } from './services/messagingApiService';
