# Architecture Overview - @ces/messaging

Visual guide to understanding how the messaging library works and integrates with your app.

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        YOUR ANGULAR APP                             │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  App Component (app.component.ts)                            │  │
│  │  ┌────────────────────┐  ┌──────────────────────────────┐   │  │
│  │  │  <router-outlet>   │  │  <app-messaging-overlay>     │   │  │
│  │  │  Your app pages    │  │  (Floats above everything)   │   │  │
│  │  └────────────────────┘  └──────────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  App Config (app.config.ts)                                  │  │
│  │  • MESSAGING_CONFIG (API URLs)                               │  │
│  │  • provideHttpClient()                                       │  │
│  │  • provideAnimations()                                       │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Your Login Component                                        │  │
│  │  1. User logs in                                             │  │
│  │  2. Get session_gid from YOUR backend                        │  │
│  │  3. Call: messagingAuth.setSession(sessionGid, contact)      │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    @ces/messaging LIBRARY                           │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  MessagingOverlayComponent                                   │  │
│  │  ┌────────────────────┐  ┌──────────────────────────────┐   │  │
│  │  │  FloatingButton    │  │  ChatPanel                   │   │  │
│  │  │  • Draggable       │  │  • InboxList                 │   │  │
│  │  │  • Unread badge    │  │  • ChatThread                │   │  │
│  │  │  • Toggle panel    │  │  • MessageInput              │   │  │
│  │  │                    │  │  • NewConversation           │   │  │
│  │  │                    │  │  • GroupManager              │   │  │
│  │  └────────────────────┘  └──────────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Services Layer                                              │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │  │
│  │  │ AuthService  │  │ StoreService │  │ ApiService   │      │  │
│  │  │ • Session    │  │ • State      │  │ • REST calls │      │  │
│  │  │ • Contact    │  │ • Inbox      │  │ • Messages   │      │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘      │  │
│  │  ┌──────────────┐  ┌──────────────┐                        │  │
│  │  │ WebSocket    │  │ FileService  │                        │  │
│  │  │ • Real-time  │  │ • Uploads    │                        │  │
│  │  │ • Reconnect  │  │ • Downloads  │                        │  │
│  │  └──────────────┘  └──────────────┘                        │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│                      YOUR BACKEND API                               │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  REST API Endpoints                                          │  │
│  │  • GET  /messaging/contacts/{id}/inbox                       │  │
│  │  • GET  /messaging/conversations/{id}/messages               │  │
│  │  • POST /messaging/conversations/{id}/messages               │  │
│  │  • POST /messaging/conversations                             │  │
│  │  • ... (see FRONTEND_INTEGRATION_GUIDE.md)                   │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  WebSocket Server                                            │  │
│  │  • wss://host/messaging/ws/{contactId}                       │  │
│  │  • Broadcasts new messages                                   │  │
│  │  • Handles subscriptions                                     │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Database (PostgreSQL)                                       │  │
│  │  • Contacts, Messages, Conversations                         │  │
│  │  • Company connections                                       │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Authentication Flow

```
┌──────────────┐
│   User       │
│   Opens App  │
└──────┬───────┘
       │
       ↓
┌──────────────────────────────────────────────────────────┐
│  1. YOUR Login Page                                      │
│     User enters email/password                           │
└──────┬───────────────────────────────────────────────────┘
       │
       ↓
┌──────────────────────────────────────────────────────────┐
│  2. YOUR Auth API                                        │
│     POST /auth { email, password }                       │
│     Returns: { session_gid, user_id, name, ... }        │
└──────┬───────────────────────────────────────────────────┘
       │
       ↓
┌──────────────────────────────────────────────────────────┐
│  3. YOUR Login Component                                 │
│     const contact: Contact = {                           │
│       contact_id: response.user_id,                      │
│       user_gid: response.session_gid,                    │
│       email: email,                                      │
│       ...                                                │
│     };                                                   │
│     messagingAuth.setSession(session_gid, contact);      │
└──────┬───────────────────────────────────────────────────┘
       │
       ↓
┌──────────────────────────────────────────────────────────┐
│  4. @ces/messaging Library                               │
│     • Stores session in AuthService                      │
│     • Saves to localStorage                              │
│     • Shows MessagingOverlay                             │
│     • Connects WebSocket                                 │
│     • Loads inbox                                        │
└──────┬───────────────────────────────────────────────────┘
       │
       ↓
┌──────────────────────────────────────────────────────────┐
│  5. User Sees Messaging UI                               │
│     • Floating chat button appears                       │
│     • Can click to open chat panel                       │
│     • Can send/receive messages                          │
└──────────────────────────────────────────────────────────┘
```

---

## 📡 Real-Time Messaging Flow

```
┌─────────────┐                                    ┌─────────────┐
│   User A    │                                    │   User B    │
│  (Sender)   │                                    │ (Receiver)  │
└──────┬──────┘                                    └──────┬──────┘
       │                                                  │
       │ 1. Types message                                │
       │    Clicks send                                  │
       ↓                                                  │
┌──────────────────────────────────────────┐            │
│  MessagingApiService                     │            │
│  POST /conversations/{id}/messages       │            │
│  { content: "Hello!", ... }              │            │
└──────┬───────────────────────────────────┘            │
       │                                                  │
       ↓                                                  │
┌──────────────────────────────────────────┐            │
│  Backend API                             │            │
│  • Saves message to database             │            │
│  • Returns message_id                    │            │
└──────┬───────────────────────────────────┘            │
       │                                                  │
       ├──────────────────────────────────────────────┐  │
       │                                              │  │
       ↓                                              ↓  │
┌──────────────────────┐                  ┌──────────────────────┐
│  User A's UI         │                  │  WebSocket Server    │
│  • Shows message     │                  │  • Broadcasts to     │
│  • Optimistic update │                  │    User B's socket   │
└──────────────────────┘                  └──────┬───────────────┘
                                                  │
                                                  ↓
                                          ┌──────────────────────┐
                                          │  User B's WebSocket  │
                                          │  Receives message    │
                                          └──────┬───────────────┘
                                                  │
                                                  ↓
                                          ┌──────────────────────┐
                                          │  MessagingStore      │
                                          │  • Updates inbox     │
                                          │  • Adds to thread    │
                                          │  • Increments unread │
                                          └──────┬───────────────┘
                                                  │
                                                  ↓
                                          ┌──────────────────────┐
                                          │  User B's UI         │
                                          │  • Shows message     │
                                          │  • Updates badge     │
                                          │  • Plays sound (opt) │
                                          └──────────────────────┘
```

---

## 🗂️ State Management

```
┌─────────────────────────────────────────────────────────────┐
│  MessagingStoreService (RxJS BehaviorSubjects)              │
│                                                             │
│  ┌────────────────────────────────────────────────────┐    │
│  │  session$                                          │    │
│  │  • Current session_gid                             │    │
│  │  • Observable<string | null>                       │    │
│  └────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌────────────────────────────────────────────────────┐    │
│  │  contact$                                          │    │
│  │  • Current user's contact info                     │    │
│  │  • Observable<Contact | null>                      │    │
│  └────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌────────────────────────────────────────────────────┐    │
│  │  inbox$                                            │    │
│  │  • List of conversations                           │    │
│  │  • Observable<InboxItem[]>                         │    │
│  │  • Auto-updates on new messages                    │    │
│  └────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌────────────────────────────────────────────────────┐    │
│  │  messages$                                         │    │
│  │  • Messages for active conversation                │    │
│  │  • Observable<Message[]>                           │    │
│  │  • Paginated, sorted by timestamp                  │    │
│  └────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌────────────────────────────────────────────────────┐    │
│  │  totalUnreadCount$                                 │    │
│  │  • Sum of unread across all conversations          │    │
│  │  • Observable<number>                              │    │
│  │  • Drives badge display                            │    │
│  └────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌────────────────────────────────────────────────────┐    │
│  │  isPanelOpen$                                      │    │
│  │  • Chat panel visibility state                     │    │
│  │  • Observable<boolean>                             │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘

All components subscribe to these observables for reactive updates
```

---

## 📦 Component Hierarchy

```
MessagingOverlayComponent (Root)
│
├── FloatingButtonComponent
│   ├── Draggable behavior
│   ├── Unread badge (subscribes to totalUnreadCount$)
│   ├── Click handler (toggles panel)
│   └── Position persistence (localStorage)
│
└── ChatPanelComponent
    ├── Resizable behavior
    ├── Position calculation
    ├── Size persistence (localStorage)
    │
    ├── InboxListComponent
    │   ├── Search bar
    │   ├── Conversation list (subscribes to inbox$)
    │   ├── Unread indicators
    │   └── Click handlers (opens thread)
    │
    ├── ChatThreadComponent
    │   ├── Message list (subscribes to messages$)
    │   ├── Scroll to bottom
    │   ├── Pagination (load more)
    │   ├── Sender/receiver styling
    │   └── Timestamp formatting
    │
    ├── MessageInputComponent
    │   ├── Text input
    │   ├── File upload button
    │   ├── Send button
    │   ├── Enter key handler
    │   └── Emoji picker (optional)
    │
    ├── NewConversationComponent
    │   ├── Contact search
    │   ├── Contact list
    │   ├── Selection handler
    │   └── Create conversation
    │
    └── GroupManagerComponent
        ├── Group name input
        ├── Multi-select contacts
        ├── Add/remove participants
        └── Create/update group
```

---

## 🔌 Service Dependencies

```
┌─────────────────────────────────────────────────────────────┐
│  AuthService                                                │
│  • Manages session_gid and contact                          │
│  • Provides authentication state                            │
│  • Used by: All other services                              │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  MessagingApiService                                        │
│  • Depends on: AuthService (for session_gid)                │
│  • Provides: REST API methods                               │
│  • Used by: StoreService, Components                        │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  MessagingWebSocketService                                  │
│  • Depends on: AuthService (for session_gid, contactId)     │
│  • Provides: Real-time message stream                       │
│  • Used by: StoreService                                    │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  MessagingStoreService                                      │
│  • Depends on: AuthService, ApiService, WebSocketService    │
│  • Provides: Centralized state management                   │
│  • Used by: All components                                  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  MessagingFileService                                       │
│  • Depends on: AuthService, MESSAGING_CONFIG                │
│  • Provides: File upload/download                           │
│  • Used by: MessageInputComponent                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 🌐 Network Communication

### REST API Calls

```
Component/Service
      ↓
MessagingApiService
      ↓
HttpClient (Angular)
      ↓
Backend REST API
      ↓
Database
```

### WebSocket Communication

```
MessagingWebSocketService
      ↓
WebSocket Connection
      ↓
Backend WebSocket Server
      ↓
Broadcast to subscribers
      ↓
Other users' WebSocket connections
      ↓
Their MessagingWebSocketService
      ↓
Their MessagingStoreService
      ↓
Their UI updates
```

---

## 💾 Data Persistence

### LocalStorage

```
┌─────────────────────────────────────────────────────────┐
│  messaging_session                                      │
│  {                                                      │
│    session_gid: "uuid",                                 │
│    contact: { contact_id, email, ... }                  │
│  }                                                      │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  messaging_panel_size                                   │
│  { width: 380, height: 560 }                            │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  messaging_button_position                              │
│  { bottom: 20, right: 20 }                              │
└─────────────────────────────────────────────────────────┘
```

### Session Storage
Not used (could be added for temporary state)

### In-Memory State
All reactive state in `MessagingStoreService` (BehaviorSubjects)

---

## 🔒 Security Considerations

### Session Management
- `session_gid` stored in localStorage
- Sent with every API request
- Validated by backend
- Expired sessions handled with 401 response

### WebSocket Authentication
- Must authenticate after connection
- Session validated on server
- Unauthorized connections rejected

### XSS Protection
- All user content sanitized
- Angular's built-in sanitization
- No innerHTML usage

### CORS
- Backend must allow frontend origin
- Credentials included in requests

---

## 🎨 Styling Architecture

### Material Theme
- Base theme from `@angular/material`
- Customizable color palettes
- Typography configuration

### Component Styles
- Inline styles in components (scoped)
- Can be extracted to separate files
- Uses CSS variables for theming

### Responsive Design
- Mobile-first approach
- Breakpoints: 768px (tablet), 1024px (desktop)
- Full-screen mode on mobile

---

## 🚀 Performance Optimizations

### Lazy Loading
- Components loaded on-demand
- WebSocket connects only when authenticated

### Virtual Scrolling
- Could be added for long message lists
- Currently using standard scrolling

### Change Detection
- OnPush strategy where possible
- Observables for reactive updates

### Caching
- Inbox cached in memory
- Messages cached per conversation
- Contacts cached after first load

---

## 🧪 Testing Strategy

### Unit Tests
- Services: Mock HttpClient, WebSocket
- Components: Mock services
- Models: Test utility functions

### Integration Tests
- Test service interactions
- Test WebSocket flow
- Test state management

### E2E Tests
- Test full user flows
- Test real-time messaging
- Test file uploads

---

## 📊 Monitoring & Debugging

### Console Logging
- Connection status
- Message send/receive
- Error messages
- State changes

### Network Tab
- API requests/responses
- WebSocket frames
- File uploads

### Angular DevTools
- Component tree
- Change detection
- Performance profiling

---

This architecture provides a solid foundation for understanding how the messaging library works and how it integrates with your application.
