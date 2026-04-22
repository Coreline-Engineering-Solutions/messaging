# Developer Integration Guide - @coreline-engineering-solutions/messaging

This guide shows exactly what you need to do to integrate the messaging library into your Angular application.

---

## Prerequisites

- Angular 17.3+
- Node.js 18+
- An existing Angular application
- A backend API that implements the messaging endpoints (see Backend Requirements section)

---

## Step 1: Build the Library

```bash
cd messaging-library/messaging-app
npm install
npm run build:lib
```

This creates the compiled library in `dist/ces-messaging/`.

---

## Step 2: Install in Your App

### Option A: Local Development (npm link)

```bash
# In the library folder
cd dist/ces-messaging
npm link

# In your Angular app
cd /path/to/your-app
npm link @coreline-engineering-solutions/messaging
```

### Option B: Local Package (npm install)

```bash
# In the library folder
cd dist/ces-messaging
npm pack
# This creates: ces-messaging-1.0.0.tgz

# In your Angular app
npm install /path/to/ces-messaging-1.0.0.tgz
```

### Option C: Copy to node_modules

```bash
# Copy the dist folder directly
cp -r dist/ces-messaging /path/to/your-app/node_modules/@coreline-engineering-solutions/messaging
```

---

## Step 3: Install Peer Dependencies

```bash
cd /path/to/your-app
npm install @angular/material@^17.3.10 @angular/cdk@^17.3.10
```

---

## Step 4: Configure Your Application

### 4.1 Update `app.config.ts`

Add the messaging configuration and required providers:

```typescript
import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { MESSAGING_CONFIG, MessagingConfig } from '@coreline-engineering-solutions/messaging';
import { routes } from './app.routes';

// Configure your messaging API endpoints
const messagingConfig: MessagingConfig = {
  apiBaseUrl: 'https://your-backend-api.com',      // Your messaging REST API
  wsBaseUrl: 'wss://your-backend-api.com',         // Your WebSocket server
  storageApiUrl: 'https://your-storage-api.com/api' // Your file storage API
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

### 4.2 Update `index.html`

Add Material Icons and fonts:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Your App</title>
  <base href="/">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" type="image/x-icon" href="favicon.ico">
  
  <!-- Add these lines -->
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
</head>
<body>
  <app-root></app-root>
</body>
</html>
```

### 4.3 Update `styles.scss`

Add Material theme:

```scss
@use '@angular/material' as mat;

@include mat.core();

$primary-palette: mat.define-palette(mat.$indigo-palette, 400);
$accent-palette: mat.define-palette(mat.$purple-palette, A200);
$warn-palette: mat.define-palette(mat.$red-palette);

$theme: mat.define-light-theme((
  color: (
    primary: $primary-palette,
    accent: $accent-palette,
    warn: $warn-palette,
  ),
  typography: mat.define-typography-config(),
));

@include mat.all-component-themes($theme);

// Base styles
html, body {
  height: 100%;
  margin: 0;
  padding: 0;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

// Custom scrollbar
::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}
```

---

## Step 5: Add Messaging Overlay to Your App

### 5.1 Update `app.component.ts`

```typescript
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { MessagingOverlayComponent } from '@coreline-engineering-solutions/messaging';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    MessagingOverlayComponent  // Import the messaging overlay
  ],
  template: `
    <router-outlet></router-outlet>
    
    <!-- Add messaging overlay - it will float above everything -->
    <app-messaging-overlay></app-messaging-overlay>
  `,
  styles: []
})
export class AppComponent {
  title = 'your-app';
}
```

---

## Step 6: Initialize Messaging After Login

### 6.1 In Your Login Component/Service

After your user successfully logs in, initialize the messaging session:

```typescript
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService, Contact } from '@coreline-engineering-solutions/messaging';

@Component({
  selector: 'app-login',
  standalone: true,
  template: `
    <div class="login-container">
      <h1>Login</h1>
      <form (ngSubmit)="onLogin()">
        <input [(ngModel)]="email" type="email" placeholder="Email" required>
        <input [(ngModel)]="password" type="password" placeholder="Password" required>
        <button type="submit">Login</button>
      </form>
    </div>
  `
})
export class LoginComponent {
  email = '';
  password = '';

  constructor(
    private router: Router,
    private messagingAuth: AuthService  // Inject messaging auth service
  ) {}

  async onLogin() {
    try {
      // 1. Authenticate with YOUR auth system
      const response = await this.yourAuthService.login(this.email, this.password);
      
      // 2. Extract session and user data
      const sessionGid = response.session_gid;
      const userId = response.user_id;
      const userName = response.name || this.email.split('@')[0];
      const companyName = response.company_name || 'Your Company';
      
      // 3. Create contact object for messaging
      const contact: Contact = {
        contact_id: userId,           // Your user's ID
        user_gid: sessionGid,         // Session UUID
        username: userName,
        first_name: userName.split(' ')[0],
        last_name: userName.split(' ').slice(1).join(' ') || '',
        email: this.email,
        company_name: companyName,
        is_active: true
      };
      
      // 4. Initialize messaging session
      this.messagingAuth.setSession(sessionGid, contact);
      
      // 5. Navigate to your app
      this.router.navigate(['/dashboard']);
      
    } catch (error) {
      console.error('Login failed:', error);
      alert('Login failed. Please try again.');
    }
  }
}
```

---

## Step 7: Handle Logout

### 7.1 Clear Messaging Session on Logout

```typescript
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@coreline-engineering-solutions/messaging';

@Component({
  selector: 'app-navbar',
  template: `
    <nav>
      <button (click)="onLogout()">Logout</button>
    </nav>
  `
})
export class NavbarComponent {
  constructor(
    private router: Router,
    private messagingAuth: AuthService
  ) {}

  onLogout() {
    // Clear messaging session
    this.messagingAuth.logout();
    
    // Clear your app's auth
    this.yourAuthService.logout();
    
    // Navigate to login
    this.router.navigate(['/login']);
  }
}
```

---

## Step 8: Optional - Use Messaging Services Directly

### 8.1 Access Messaging State

```typescript
import { Component, OnInit } from '@angular/core';
import { MessagingStoreService } from '@coreline-engineering-solutions/messaging';

@Component({
  selector: 'app-dashboard',
  template: `
    <div class="dashboard">
      <h1>Dashboard</h1>
      <p>Unread messages: {{ unreadCount$ | async }}</p>
    </div>
  `
})
export class DashboardComponent implements OnInit {
  unreadCount$ = this.messagingStore.totalUnreadCount$;

  constructor(private messagingStore: MessagingStoreService) {}

  ngOnInit() {
    // Access messaging state
    this.messagingStore.inbox$.subscribe(inbox => {
      console.log('Current inbox:', inbox);
    });
  }
}
```

### 8.2 Send Messages Programmatically

```typescript
import { Component } from '@angular/core';
import { MessagingApiService, AuthService } from '@coreline-engineering-solutions/messaging';

@Component({
  selector: 'app-custom-chat',
  template: `<button (click)="sendQuickMessage()">Send Quick Message</button>`
})
export class CustomChatComponent {
  constructor(
    private messagingApi: MessagingApiService,
    private auth: AuthService
  ) {}

  sendQuickMessage() {
    const conversationId = 'some-conversation-id';
    const senderContactId = this.auth.contactId!;
    
    this.messagingApi.sendMessage(
      conversationId,
      senderContactId,
      'Hello from custom component!',
      'TEXT'
    ).subscribe({
      next: () => console.log('Message sent'),
      error: (err) => console.error('Failed to send:', err)
    });
  }
}
```

---

## Backend Requirements

Your backend must implement these endpoints:

### REST API Endpoints

```
Base URL: https://your-api.com/messaging

Authentication: All requests require session_gid (in body or query params)

GET    /messaging/contacts/{contactId}/inbox
GET    /messaging/contacts/{contactId}/visible-contacts
GET    /messaging/conversations/{conversationId}/messages
POST   /messaging/conversations/{conversationId}/messages
POST   /messaging/conversations
POST   /messaging/direct-messages
POST   /messaging/conversations/{conversationId}/read
POST   /messaging/groups
POST   /messaging/attachments/upload
GET    /messaging/conversations/direct
```

### WebSocket Endpoint

```
WS     wss://your-api.com/messaging/ws/{contactId}

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

See `FRONTEND_INTEGRATION_GUIDE.md` for complete API documentation.

---

## Contact ID Strategy

### What is contact_id?

The `contact_id` is a **unique identifier** for each user in the messaging system. It's used to:
- Route messages to the correct user
- Identify participants in conversations
- Connect WebSocket sessions
- Query the messaging database

### How to Choose contact_id

You have three options:

#### Option 1: Email (Recommended)
Use the user's email as contact_id. This is the **recommended approach** because:
- Emails are unique
- Easy to debug (readable in logs)
- Works across systems
- Matches the Contact object

```typescript
const contact: Contact = {
  contact_id: user.email,        // ✅ Use email
  user_gid: sessionGid,
  email: user.email,
  first_name: user.firstName,
  last_name: user.lastName,
  company_name: user.company,
  is_active: true
};
```

#### Option 2: UUID or User ID
Use a unique identifier from your system:

```typescript
const contact: Contact = {
  contact_id: user.id,           // ✅ Use UUID/user ID
  user_gid: sessionGid,
  email: user.email,
  first_name: user.firstName,
  last_name: user.lastName,
  company_name: user.company,
  is_active: true
};
```

#### Option 3: Custom Identifier
Use any unique identifier your system provides:

```typescript
const contact: Contact = {
  contact_id: user.customId,     // ✅ Use custom ID
  user_gid: sessionGid,
  email: user.email,
  first_name: user.firstName,
  last_name: user.lastName,
  company_name: user.company,
  is_active: true
};
```

### Backend Mapping

Your backend must:
1. Accept the `contact_id` in API requests
2. Store it in the `messaging.contacts` table
3. Use it to route WebSocket messages
4. Validate it matches the authenticated user

Example database schema:
```sql
CREATE TABLE messaging.contacts (
  contact_id VARCHAR(255) PRIMARY KEY,  -- Email, UUID, or custom ID
  user_gid UUID NOT NULL,               -- Session GUID
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  company_name VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Common Mistakes

❌ **Mistake 1: Using session_gid as contact_id**
```typescript
// WRONG - session_gid changes on each login
const contact: Contact = {
  contact_id: sessionGid,  // ❌ WRONG!
  // ...
};
```
**Fix:** Use email or user ID instead.

❌ **Mistake 2: Inconsistent contact_id**
```typescript
// Login 1: contact_id = "user@example.com"
// Login 2: contact_id = "USER@EXAMPLE.COM"  // Different!
// Login 3: contact_id = "123"               // Different again!
```
**Fix:** Standardize contact_id format (lowercase emails, consistent UUIDs).

❌ **Mistake 3: Not creating contact record on backend**
```typescript
// Frontend sends contact_id = "user@example.com"
// But backend has no record in messaging.contacts table
// Result: "Contact not found" error
```
**Fix:** Ensure backend creates contact record when user logs in.

❌ **Mistake 4: Mismatched contact_id between frontend and backend**
```typescript
// Frontend: contact_id = "user@example.com"
// Backend: contact_id = "123" (user ID)
// Result: Messages don't route correctly
```
**Fix:** Agree on contact_id format with backend team.

### Using the Helper Function

The library provides `createContactFromUser()` to standardize mapping:

```typescript
import { createContactFromUser } from '@coreline-engineering-solutions/messaging';

// After login, create contact from user data
const contact = createContactFromUser({
  email: response.email,
  firstName: response.first_name,
  lastName: response.last_name,
  company: response.company_name
}, sessionGid);

// contact_id is automatically set to email
messagingAuth.setSession(sessionGid, contact);
```

### Validation

The library validates contact_id at runtime:
```typescript
// These will throw helpful errors:
messagingAuth.setSession(sessionGid, {
  contact_id: '',  // ❌ Error: contact_id cannot be empty
  email: 'user@example.com',
  // ...
});

messagingAuth.setSession(sessionGid, {
  contact_id: 'user@example.com',
  email: 'invalid-email',  // ❌ Error: email must be valid
  // ...
});
```

---

## Testing the Integration

### 1. Check Library Import

```typescript
import { MessagingOverlayComponent, AuthService } from '@coreline-engineering-solutions/messaging';
// Should not show any TypeScript errors
```

### 2. Check Console

After login, open browser console:
```javascript
// Should see:
// "Messaging session initialized"
// "WebSocket connected"
```

### 3. Check UI

- Floating chat button should appear in bottom-right corner
- Click button to open chat panel
- Should see inbox (empty if no conversations)

### 4. Test Messaging

- Click "New Message" to start a conversation
- Send a test message
- Check browser Network tab for API calls
- Check WebSocket connection in Network tab

---

## Troubleshooting

### Issue: "Cannot find module '@coreline-engineering-solutions/messaging'"

**Solution:** Rebuild and reinstall the library
```bash
cd messaging-library/messaging-app
npm run build:lib
cd dist/ces-messaging
npm link
cd /path/to/your-app
npm link @coreline-engineering-solutions/messaging
```

### Issue: "No provider for MESSAGING_CONFIG"

**Solution:** Add config to `app.config.ts` providers:
```typescript
{ provide: MESSAGING_CONFIG, useValue: messagingConfig }
```

### Issue: Floating button not showing

**Solution:** 
1. Check that user is authenticated: `messagingAuth.isAuthenticated()`
2. Check that `MessagingOverlayComponent` is in app template
3. Check browser console for errors

### Issue: WebSocket not connecting

**Solution:**
1. Verify `wsBaseUrl` in config
2. Check that backend WebSocket server is running
3. Check browser console for connection errors
4. Verify CORS settings on backend

### Issue: Messages not sending

**Solution:**
1. Check Network tab for failed API calls
2. Verify `session_gid` is valid
3. Check that user has required privileges on backend
4. Verify API endpoint URLs are correct

---

## Complete Example Project Structure

```
your-angular-app/
├── src/
│   ├── app/
│   │   ├── app.component.ts          # Add MessagingOverlayComponent
│   │   ├── app.config.ts             # Add MESSAGING_CONFIG
│   │   ├── app.routes.ts
│   │   ├── components/
│   │   │   ├── login/
│   │   │   │   └── login.component.ts  # Initialize messaging after login
│   │   │   ├── dashboard/
│   │   │   │   └── dashboard.component.ts
│   │   │   └── navbar/
│   │   │       └── navbar.component.ts  # Handle logout
│   │   └── services/
│   │       └── your-auth.service.ts
│   ├── index.html                    # Add Material Icons
│   ├── styles.scss                   # Add Material theme
│   └── main.ts
├── node_modules/
│   └── @ces/
│       └── messaging/                # Installed library
├── angular.json
├── package.json
└── tsconfig.json
```

---

## Next Steps

1. ✅ Build the library
2. ✅ Install in your app
3. ✅ Configure API endpoints
4. ✅ Add overlay to app component
5. ✅ Initialize on login
6. ✅ Test messaging functionality
7. 🎉 Start chatting!

---

## Additional Resources

- **QUICK_START.md** - 5-minute integration guide
- **FRONTEND_INTEGRATION_GUIDE.md** - Complete API documentation
- **ARCHITECTURE.md** - System architecture and diagrams
- **AI_INTEGRATION_PROMPT.md** - Copy/paste prompt for AI assistants
- **examples/** - Working code examples

## Support

For issues or questions:
1. Check this guide and QUICK_START.md
2. Review `FRONTEND_INTEGRATION_GUIDE.md` for API details
3. Use `AI_INTEGRATION_PROMPT.md` with your AI assistant
4. Check browser console for errors
5. Verify backend API is running and accessible

---

**Built with Angular 17+ | Material Design | WebSocket | RxJS**
