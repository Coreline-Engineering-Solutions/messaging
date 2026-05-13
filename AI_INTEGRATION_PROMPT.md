# AI Agent Integration Prompt

**Copy this entire prompt and paste it into your AI assistant (ChatGPT, Claude, etc.) to get help integrating the @coreline-engineering-solutions/messaging library into your Angular application.**

---

## Context for AI Assistant

I need help integrating the `@coreline-engineering-solutions/messaging` Angular library into my Angular 17+ application. This is a complete messaging system with real-time WebSocket support, Material Design UI, and state management.

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

### Install the library (pick one)

**A — From Git (typical for consumer apps)**

```bash
npm install git+https://github.com/Coreline-Engineering-Solutions/messaging.git#main --legacy-peer-deps
```

Use `#v1.x.x` instead of `#main` to pin a release tag. Install Angular Material/CDK peers compatible with the host app’s Angular major (e.g. `^17.3.0` for Angular 17).

**B — Local clone / npm link (library developers only)**

```bash
cd messaging-app
npm install
npm run build:lib
cd dist/ces-messaging && npm link
# then in consumer app:
npm link @coreline-engineering-solutions/messaging
```

### CES / FastAPI style: `/api` prefix and numeric `contact_id`

If the messaging REST API lives under **`/api`** (e.g. `https://host/api/messaging/...`):

1. Set **`apiBaseUrl`** to include **`/api`**, e.g. `https://host/api`.
2. Set **`wsBaseUrl`** to the **same path prefix**, e.g. `wss://host/api` — not bare `wss://host` unless WebSockets are intentionally mounted at the host root.

The library opens WebSockets at:

`{wsBaseUrl}/messaging/ws/{contactId}`

so `wsBaseUrl` must match wherever your server upgrades WS (usually the same gateway prefix as HTTP).

**`contact_id`:** Many backends use **integer/bigint** ids in URL paths. Before `setSession`, resolve the numeric messaging contact id (e.g. **`GET /api/messaging/contacts/by-email/{email}`** when your API provides it). Put that **numeric** id in `Contact.contact_id` (digits as string is fine). Do **not** pass a raw email as `contact_id` when paths expect a number.

The library may emit **`console.warn`** in development if `apiBaseUrl` contains `/api` but `wsBaseUrl` does not, or if `contact_id` contains `@` — treat as configuration hints.

### Integration Requirements

**What I need to do:**

1. Install the library (see **Install the library** above).

2. **Configure API endpoints** in `app.config.ts`:
   ```typescript
   import { MESSAGING_CONFIG, MessagingConfig } from '@coreline-engineering-solutions/messaging';
   
   const messagingConfig: MessagingConfig = {
     apiBaseUrl: 'https://my-backend-api.com/api',
     wsBaseUrl: 'wss://my-backend-api.com/api',
     storageApiUrl: 'https://my-backend-api.com/api'
   };
   
   providers: [
     { provide: MESSAGING_CONFIG, useValue: messagingConfig }
   ]
   ```

3. **Add overlay to app component**:
   ```typescript
   import { MessagingOverlayComponent } from '@coreline-engineering-solutions/messaging';
   
   template: `
     <router-outlet></router-outlet>
     <app-messaging-overlay></app-messaging-overlay>
   `
   ```

4. **Initialize after login** — `contact_id` must be the **numeric** messaging id your API expects in paths (resolve via by-email or profile field if needed):
   ```typescript
   import { AuthService, Contact } from '@coreline-engineering-solutions/messaging';
   
   onLoginSuccess(response) {
     const contact: Contact = {
       contact_id: String(response.messaging_contact_id), // numeric id from API, not email
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

My backend must provide these REST endpoints (paths below are **after** the `{apiBaseUrl}/messaging` prefix that the library adds; if `apiBaseUrl` is `https://host/api`, full paths are `https://host/api/messaging/...`):

```
Base (relative to apiBaseUrl): /messaging

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

The browser URL is **`{wsBaseUrl}/messaging/ws/{contactId}`** (must match your server). Example when HTTP API is under `/api`:

```
WS: wss://my-api.com/api/messaging/ws/{contactId}

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
import { MESSAGING_CONFIG, MessagingConfig } from '@coreline-engineering-solutions/messaging';

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
import { MessagingOverlayComponent } from '@coreline-engineering-solutions/messaging';

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
import { AuthService, Contact } from '@coreline-engineering-solutions/messaging';

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
