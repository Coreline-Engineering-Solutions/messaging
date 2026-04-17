# AI Agent Integration Prompt

**Copy this entire prompt and paste it into your AI assistant (ChatGPT, Claude, etc.) to get help integrating the @ces/messaging library into your Angular application.**

---

## Context for AI Assistant

I need help integrating the `@ces/messaging` Angular library into my Angular 17+ application. This is a complete messaging system with real-time WebSocket support, Material Design UI, and state management.

### Library Overview

**What the library provides:**
- 7 pre-built UI components (floating button, chat panel, inbox, thread, message input, etc.)
- 5 services (Auth, API, WebSocket, Store, File handling)
- Complete TypeScript models and interfaces
- Real-time messaging via WebSocket with auto-reconnect
- RxJS-based state management
- Material Design themed UI
- File attachment support
- Direct and group messaging
- Unread count badges
- Session persistence

**What the library does NOT provide:**
- User authentication (I need to handle this in my app)
- Backend API (I need to provide this)
- WebSocket server (I need to provide this)

### Authentication Model

The library expects **external authentication**. My app must:
1. Authenticate users through my own auth system
2. Obtain a `session_gid` (UUID) from my backend
3. Call `messagingAuth.setSession(sessionGid, contact)` to activate messaging

The library does NOT handle login/registration - it only manages the messaging session after authentication.

### Integration Requirements

**What I need to do:**

1. **Build and install the library**
   ```bash
   cd messaging-library/messaging-app
   npm install
   npm run build:lib
   npm link dist/ces-messaging
   ```

2. **Configure API endpoints** in `app.config.ts`:
   ```typescript
   import { MESSAGING_CONFIG, MessagingConfig } from '@ces/messaging';
   
   const messagingConfig: MessagingConfig = {
     apiBaseUrl: 'https://my-backend-api.com',
     wsBaseUrl: 'wss://my-backend-api.com',
     storageApiUrl: 'https://my-storage-api.com/api'
   };
   
   providers: [
     { provide: MESSAGING_CONFIG, useValue: messagingConfig }
   ]
   ```

3. **Add overlay to app component**:
   ```typescript
   import { MessagingOverlayComponent } from '@ces/messaging';
   
   template: `
     <router-outlet></router-outlet>
     <app-messaging-overlay></app-messaging-overlay>
   `
   ```

4. **Initialize after login**:
   ```typescript
   import { AuthService, Contact } from '@ces/messaging';
   
   onLoginSuccess(response) {
     const contact: Contact = {
       contact_id: response.user_id,
       user_gid: response.session_gid,
       email: response.email,
       company_name: response.company_name,
       is_active: true
     };
     
     this.messagingAuth.setSession(response.session_gid, contact);
   }
   ```

5. **Handle logout**:
   ```typescript
   onLogout() {
     this.messagingAuth.logout();
   }
   ```

### Backend API Requirements

My backend must provide these REST endpoints:

```
Base: https://my-api.com/messaging

GET    /contacts/{contactId}/inbox
GET    /contacts/{contactId}/visible-contacts
GET    /conversations/{conversationId}/messages
POST   /conversations/{conversationId}/messages
POST   /conversations
POST   /direct-messages
POST   /conversations/{conversationId}/read
POST   /groups
POST   /attachments/upload
GET    /conversations/direct
```

All endpoints require `session_gid` in request body or query params.

### WebSocket Requirements

```
WS: wss://my-api.com/messaging/ws/{contactId}

Client sends:
{
  "action": "auth",
  "session_gid": "uuid"
}

{
  "action": "subscribe",
  "conversation_id": "uuid"
}

Server sends:
{
  "type": "new_message",
  "data": {
    "message_id": "123",
    "conversation_id": "456",
    "sender_id": "789",
    "content": "Hello!",
    ...
  }
}
```

### My Current Setup

**My Angular version:** [FILL IN YOUR VERSION]

**My authentication system:** [DESCRIBE YOUR AUTH - e.g., "JWT tokens", "Session cookies", "Firebase Auth", etc.]

**My backend framework:** [FILL IN - e.g., "Node.js/Express", "Python/FastAPI", "ASP.NET", etc.]

**My current auth flow:** [DESCRIBE HOW YOUR LOGIN WORKS]

**What I need help with:** [DESCRIBE YOUR SPECIFIC NEEDS]

---

## Questions for AI Assistant

Please help me with the following:

1. **Integration Steps**: Walk me through integrating this library into my specific Angular setup
2. **Authentication Bridge**: Show me how to connect my existing auth system to the messaging library
3. **Configuration**: Help me configure the library for my environment (dev/staging/prod)
4. **Login Component**: Help me modify my login component to initialize messaging
5. **Backend Setup**: [OPTIONAL] Guide me on setting up the required backend endpoints
6. **Troubleshooting**: Help me debug any issues that arise

---

## Available Documentation

The library includes these documentation files:
- `QUICK_START.md` - 5-minute integration guide
- `DEVELOPER_INTEGRATION_GUIDE.md` - Complete step-by-step guide
- `ARCHITECTURE.md` - System architecture and diagrams
- `FRONTEND_INTEGRATION_GUIDE.md` - Complete API documentation
- `examples/` folder - Working code examples

---

## Example Code Snippets

### Minimal Integration (app.config.ts)

```typescript
import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { MESSAGING_CONFIG, MessagingConfig } from '@ces/messaging';

const messagingConfig: MessagingConfig = {
  apiBaseUrl: 'https://my-api.com',
  wsBaseUrl: 'wss://my-api.com',
  storageApiUrl: 'https://my-storage.com/api'
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
    provideAnimations(),
    { provide: MESSAGING_CONFIG, useValue: messagingConfig }
  ]
};
```

### Minimal Integration (app.component.ts)

```typescript
import { Component } from '@angular/core';
import { MessagingOverlayComponent } from '@ces/messaging';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, MessagingOverlayComponent],
  template: `
    <router-outlet></router-outlet>
    <app-messaging-overlay></app-messaging-overlay>
  `
})
export class AppComponent {}
```

### Session Initialization (login.component.ts)

```typescript
import { AuthService, Contact } from '@ces/messaging';

export class LoginComponent {
  constructor(private messagingAuth: AuthService) {}

  async onLogin() {
    // 1. Authenticate with YOUR system
    const response = await this.myAuthService.login(email, password);
    
    // 2. Create contact object
    const contact: Contact = {
      contact_id: response.user_id,
      user_gid: response.session_gid,
      email: email,
      first_name: response.first_name,
      last_name: response.last_name,
      company_name: response.company_name,
      is_active: true
    };
    
    // 3. Initialize messaging
    this.messagingAuth.setSession(response.session_gid, contact);
    
    // 4. Navigate to app
    this.router.navigate(['/dashboard']);
  }
}
```

---

## Common Integration Patterns

### Pattern 1: JWT Authentication
If I use JWT tokens, I need to:
- Get JWT from my auth API
- Extract user info from JWT or separate API call
- Get/generate session_gid for messaging
- Call `messagingAuth.setSession()`

### Pattern 2: Session Cookies
If I use session cookies, I need to:
- Login returns session cookie + user data
- Extract session ID for messaging
- Call `messagingAuth.setSession()`

### Pattern 3: Firebase Auth
If I use Firebase, I need to:
- Authenticate with Firebase
- Get Firebase user object
- Create/get session_gid from my backend
- Call `messagingAuth.setSession()`

### Pattern 4: OAuth/SSO
If I use OAuth, I need to:
- Complete OAuth flow
- Exchange token for user data
- Get session_gid from backend
- Call `messagingAuth.setSession()`

---

## Expected Behavior After Integration

Once integrated correctly:

1. ✅ Floating chat button appears in bottom-right corner (after login)
2. ✅ Clicking button opens chat panel
3. ✅ Panel shows inbox with conversations
4. ✅ Can send/receive messages in real-time
5. ✅ Unread badge shows on button
6. ✅ WebSocket connects automatically
7. ✅ Button is draggable
8. ✅ Panel is resizable
9. ✅ Position/size persists across sessions
10. ✅ Works across all routes in the app

---

## Troubleshooting Checklist

If something doesn't work:

- [ ] Library is built (`npm run build:lib`)
- [ ] Library is installed in my app
- [ ] `@angular/material` and `@angular/cdk` are installed
- [ ] Material Icons are in `index.html`
- [ ] Material theme is in `styles.scss`
- [ ] `MESSAGING_CONFIG` is provided in `app.config.ts`
- [ ] `MessagingOverlayComponent` is in `app.component.ts`
- [ ] `messagingAuth.setSession()` is called after login
- [ ] `session_gid` and `contact` data are valid
- [ ] Backend API is running and accessible
- [ ] WebSocket server is running
- [ ] CORS is configured on backend
- [ ] No console errors in browser

---

## My Specific Questions

[ADD YOUR SPECIFIC QUESTIONS HERE - e.g.:]

1. How do I adapt this to work with my existing JWT authentication?
2. How do I set up the backend endpoints if I'm using Node.js/Express?
3. How do I handle the case where my auth system uses different field names?
4. How do I customize the UI colors to match my brand?
5. How do I add custom features like emoji reactions?

---

## Additional Context

[ADD ANY ADDITIONAL CONTEXT ABOUT YOUR PROJECT:]

- My app structure: [Describe your folder structure]
- My current auth implementation: [Describe in detail]
- My backend setup: [Describe your backend]
- Any constraints or requirements: [List any specific needs]
- Timeline: [When do you need this working?]

---

**Please provide step-by-step guidance for integrating this messaging library into my specific setup. Include code examples and explain any modifications I need to make to my existing code.**
