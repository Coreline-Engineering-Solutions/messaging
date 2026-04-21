# @coreline-engineering-solutions/messaging — Angular Messaging Library

A reusable Angular 17 library that adds a full-featured messaging sidebar to any Angular application. Includes real-time WebSocket messaging, file attachments, group management, and a modern blue-themed UI.

## Prerequisites

- Angular 17.3+
- Angular Material 17.3+
- `HttpClientModule` (or `provideHttpClient()`) in the host app

## Building the Library

```bash
cd messaging-app
npm install
npm run build:lib
```

This outputs the compiled library to `dist/ces-messaging/`.

## Installation in a Host App

### Option A — npm link (local development)

```bash
# In this library folder:
cd dist/ces-messaging
npm link

# In your host app:
npm link @coreline-engineering-solutions/messaging
```

### Option B — Copy dist folder

Copy `dist/ces-messaging/` into your host app's `node_modules/@coreline-engineering-solutions/messaging/`.

### Option C — npm pack (portable tarball)

```bash
cd dist/ces-messaging
npm pack
# Produces @ces-messaging-1.0.0.tgz

# In your host app:
npm install /path/to/@ces-messaging-1.0.0.tgz
```

## Integration

### 1. Provide Configuration

In your host app's `app.config.ts` (or module providers):

```typescript
import { MESSAGING_CONFIG, MessagingConfig } from '@coreline-engineering-solutions/messaging';

const messagingConfig: MessagingConfig = {
  apiBaseUrl: 'https://auth-api-frankfurt.onrender.com',
  wsBaseUrl: 'wss://auth-api-frankfurt.onrender.com',
  storageApiUrl: 'https://ces-ticketing-system-db.onrender.com/api',
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(),
    provideAnimations(),
    { provide: MESSAGING_CONFIG, useValue: messagingConfig },
  ],
};
```

### 2. Add the Overlay Component

In your root component's template (e.g. `app.component.html`):

```html
<app-messaging-overlay></app-messaging-overlay>
```

Import it in the component:

```typescript
import { MessagingOverlayComponent } from '@coreline-engineering-solutions/messaging';

@Component({
  imports: [MessagingOverlayComponent],
  // ...
})
export class AppComponent {}
```

### 3. Initialize Messaging Session

After your user logs in, set the messaging session:

```typescript
import { AuthService, Contact } from '@coreline-engineering-solutions/messaging';

export class AppComponent {
  constructor(private messagingAuth: AuthService) {}

  onUserLoggedIn(sessionGid: string, email: string, name: string) {
    const contact: Contact = {
      contact_id: email,          // Backend maps to numeric ID
      user_gid: sessionGid,
      username: name,
      first_name: name.split(' ')[0],
      last_name: name.split(' ').slice(1).join(' '),
      email: email,
      company_name: 'Your Company',
      is_active: true,
    };

    this.messagingAuth.setSession(sessionGid, contact);
  }
}
```

## What's Included

| Export | Type | Description |
|---|---|---|
| `MESSAGING_CONFIG` | InjectionToken | Config token for API URLs |
| `MessagingConfig` | Interface | Config shape (apiBaseUrl, wsBaseUrl, storageApiUrl) |
| `MessagingOverlayComponent` | Component | Drop-in overlay (floating button + sidebar) |
| `AuthService` | Service | Session management |
| `MessagingStoreService` | Service | Central state (inbox, messages, panel) |
| `MessagingApiService` | Service | REST API calls |
| `MessagingWebSocketService` | Service | WebSocket connection |
| `MessagingFileService` | Service | File upload/download |
| `Contact`, `Message`, `InboxItem`, etc. | Interfaces | Data models |

## Exported Components (for custom layouts)

If you don't want the full overlay, import individual components:

- `FloatingButtonComponent` — the chat toggle button
- `ChatPanelComponent` — the sidebar panel
- `InboxListComponent` — conversation list
- `ChatThreadComponent` — message thread
- `NewConversationComponent` — start new DM
- `GroupManagerComponent` — create/edit groups
- `MessageInputComponent` — text + file input bar
