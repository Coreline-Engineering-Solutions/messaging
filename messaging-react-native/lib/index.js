"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveContactByEmail = exports.messagingWebSocket = exports.fontWeights = exports.fontSizes = exports.shadows = exports.borderWidth = exports.borderRadius = exports.spacing = exports.colors = exports.MapTabBarButton = exports.MessagingTabBarButton = exports.MessagingImagePickerHost = exports.MessagingScreen = exports.MessagingPanel = exports.MessagingOverlay = exports.requestMessagingOpen = exports.useMessagingOptional = exports.useMessaging = exports.MessagingProvider = exports.isProjectConversation = exports.resolveMessageSenderDisplayName = exports.getMessageSenderName = exports.getInboxDisplayName = exports.getContactDisplayName = exports.MESSAGING_FAVORITES_KEY_PREFIX = exports.MESSAGING_PANEL_HEIGHT_KEY = exports.MESSAGING_PANEL_HEIGHT_MIN = exports.MESSAGING_PANEL_HEIGHT_MAX = exports.MESSAGING_PANEL_HEIGHT_DEFAULT = exports.MESSAGING_OPEN_EVENT = exports.isMessagingConfigured = exports.getMessagingConfig = exports.configureMessaging = void 0;
// Configuration
var configure_1 = require("./configure");
Object.defineProperty(exports, "configureMessaging", { enumerable: true, get: function () { return configure_1.configureMessaging; } });
Object.defineProperty(exports, "getMessagingConfig", { enumerable: true, get: function () { return configure_1.getMessagingConfig; } });
Object.defineProperty(exports, "isMessagingConfigured", { enumerable: true, get: function () { return configure_1.isMessagingConfigured; } });
// Constants
var messagingConfig_1 = require("./constants/messagingConfig");
Object.defineProperty(exports, "MESSAGING_OPEN_EVENT", { enumerable: true, get: function () { return messagingConfig_1.MESSAGING_OPEN_EVENT; } });
Object.defineProperty(exports, "MESSAGING_PANEL_HEIGHT_DEFAULT", { enumerable: true, get: function () { return messagingConfig_1.MESSAGING_PANEL_HEIGHT_DEFAULT; } });
Object.defineProperty(exports, "MESSAGING_PANEL_HEIGHT_MAX", { enumerable: true, get: function () { return messagingConfig_1.MESSAGING_PANEL_HEIGHT_MAX; } });
Object.defineProperty(exports, "MESSAGING_PANEL_HEIGHT_MIN", { enumerable: true, get: function () { return messagingConfig_1.MESSAGING_PANEL_HEIGHT_MIN; } });
Object.defineProperty(exports, "MESSAGING_PANEL_HEIGHT_KEY", { enumerable: true, get: function () { return messagingConfig_1.MESSAGING_PANEL_HEIGHT_KEY; } });
Object.defineProperty(exports, "MESSAGING_FAVORITES_KEY_PREFIX", { enumerable: true, get: function () { return messagingConfig_1.MESSAGING_FAVORITES_KEY_PREFIX; } });
var messaging_1 = require("./types/messaging");
Object.defineProperty(exports, "getContactDisplayName", { enumerable: true, get: function () { return messaging_1.getContactDisplayName; } });
Object.defineProperty(exports, "getInboxDisplayName", { enumerable: true, get: function () { return messaging_1.getInboxDisplayName; } });
Object.defineProperty(exports, "getMessageSenderName", { enumerable: true, get: function () { return messaging_1.getMessageSenderName; } });
Object.defineProperty(exports, "resolveMessageSenderDisplayName", { enumerable: true, get: function () { return messaging_1.resolveMessageSenderDisplayName; } });
Object.defineProperty(exports, "isProjectConversation", { enumerable: true, get: function () { return messaging_1.isProjectConversation; } });
// Context
var MessagingContext_1 = require("./context/MessagingContext");
Object.defineProperty(exports, "MessagingProvider", { enumerable: true, get: function () { return MessagingContext_1.MessagingProvider; } });
Object.defineProperty(exports, "useMessaging", { enumerable: true, get: function () { return MessagingContext_1.useMessaging; } });
Object.defineProperty(exports, "useMessagingOptional", { enumerable: true, get: function () { return MessagingContext_1.useMessagingOptional; } });
Object.defineProperty(exports, "requestMessagingOpen", { enumerable: true, get: function () { return MessagingContext_1.requestMessagingOpen; } });
// UI
var MessagingOverlay_1 = require("./components/MessagingOverlay");
Object.defineProperty(exports, "MessagingOverlay", { enumerable: true, get: function () { return MessagingOverlay_1.MessagingOverlay; } });
var MessagingPanel_1 = require("./components/MessagingPanel");
Object.defineProperty(exports, "MessagingPanel", { enumerable: true, get: function () { return MessagingPanel_1.MessagingPanel; } });
var MessagingScreen_1 = require("./components/MessagingScreen");
Object.defineProperty(exports, "MessagingScreen", { enumerable: true, get: function () { return MessagingScreen_1.MessagingScreen; } });
var MessagingImagePickerHost_1 = require("./components/MessagingImagePickerHost");
Object.defineProperty(exports, "MessagingImagePickerHost", { enumerable: true, get: function () { return MessagingImagePickerHost_1.MessagingImagePickerHost; } });
var MessagingTabBarButton_1 = require("./components/MessagingTabBarButton");
Object.defineProperty(exports, "MessagingTabBarButton", { enumerable: true, get: function () { return MessagingTabBarButton_1.MessagingTabBarButton; } });
var MapTabBarButton_1 = require("./components/MapTabBarButton");
Object.defineProperty(exports, "MapTabBarButton", { enumerable: true, get: function () { return MapTabBarButton_1.MapTabBarButton; } });
// Theme (optional overrides in host)
var theme_1 = require("./theme");
Object.defineProperty(exports, "colors", { enumerable: true, get: function () { return theme_1.colors; } });
Object.defineProperty(exports, "spacing", { enumerable: true, get: function () { return theme_1.spacing; } });
Object.defineProperty(exports, "borderRadius", { enumerable: true, get: function () { return theme_1.borderRadius; } });
Object.defineProperty(exports, "borderWidth", { enumerable: true, get: function () { return theme_1.borderWidth; } });
Object.defineProperty(exports, "shadows", { enumerable: true, get: function () { return theme_1.shadows; } });
Object.defineProperty(exports, "fontSizes", { enumerable: true, get: function () { return theme_1.fontSizes; } });
Object.defineProperty(exports, "fontWeights", { enumerable: true, get: function () { return theme_1.fontWeights; } });
// Services (advanced integration)
var messagingWebSocketService_1 = require("./services/messagingWebSocketService");
Object.defineProperty(exports, "messagingWebSocket", { enumerable: true, get: function () { return messagingWebSocketService_1.messagingWebSocket; } });
var messagingApiService_1 = require("./services/messagingApiService");
Object.defineProperty(exports, "resolveContactByEmail", { enumerable: true, get: function () { return messagingApiService_1.resolveContactByEmail; } });
