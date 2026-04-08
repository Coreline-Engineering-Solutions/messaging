# Global Messaging System - Integration Guide

Complete Angular 17+ standalone messaging system with WebSocket support, designed to float globally above your application.

## Table of Contents
1. [Overview](#overview)
2. [Features](#features)
3. [Project Structure](#project-structure)
4. [Installation Steps](#installation-steps)
5. [Configuration](#configuration)
6. [Complete Code Files](#complete-code-files)
7. [Integration Instructions](#integration-instructions)
8. [API Requirements](#api-requirements)

---

## Overview

This is a **production-ready, global messaging overlay** built with Angular 17+ that:
- Floats above your entire application (persists across routes)
- Provides real-time messaging via WebSocket
- Includes draggable floating button with unread badge
- Features resizable chat panel with localStorage persistence
- Supports direct messaging, group chats, and conversation management

---

## Features

### Core Functionality
- ✅ **Global Overlay** - Always accessible, persists across navigation
- ✅ **Draggable Floating Button** - Position anywhere on screen
- ✅ **Resizable Chat Panel** - Resize from any edge (top/bottom/left/right)
- ✅ **Auto-positioning** - Panel opens near button with smart spacing
- ✅ **WebSocket Integration** - Real-time messages with auto-reconnect
- ✅ **State Persistence** - Panel size and button position saved
- ✅ **Direct & Group Messaging** - Full conversation support
- ✅ **Unread Counts** - Badge with pulse animation
- ✅ **Responsive Design** - Mobile-friendly full-screen mode

### UI Components
- Floating button with drag & drop
- Chat panel with minimize/expand
- Inbox list with search
- Chat thread with pagination
- Message input with enter-to-send
- New conversation picker
- Group manager with multi-select

---

## Project Structure

```
messaging-app/src/app/
├── messaging/
│   ├── models/
│   │   └── messaging.models.ts          # TypeScript interfaces
│   ├── services/
│   │   ├── auth.service.ts              # Authentication & session
│   │   ├── messaging-api.service.ts     # REST API calls
│   │   ├── messaging-websocket.service.ts # WebSocket management
│   │   └── messaging-store.service.ts   # Global state store (RxJS)
│   ├── components/
│   │   ├── floating-button/             # Draggable FAB
│   │   ├── chat-panel/                  # Main overlay panel
│   │   ├── inbox-list/                  # Conversation list
│   │   ├── chat-thread/                 # Message thread
│   │   ├── message-input/               # Send message input
│   │   ├── new-conversation/            # Contact picker
│   │   └── group-manager/               # Group creation
│   └── messaging-overlay.component.ts   # Root wrapper
├── layout/
│   └── nav-bar/                         # Navigation bar
├── pages/
│   ├── login/                           # Login page
│   ├── dashboard/                       # Dashboard
│   └── [other-pages]/                   # Your app pages
└── environments/
    └── environment.ts                   # API configuration
```

---

## Installation Steps

### 1. Install Dependencies

```bash
npm install @angular/material @angular/cdk
```

### 2. Update angular.json

Add Material theme to styles array:

```json
"styles": [
  "src/styles.scss"
]
```

### 3. Update app.config.ts

```typescript
import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
    provideAnimations(),
  ],
};
```

### 4. Update index.html

Add Material Icons and Inter font:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Your App - Messaging</title>
  <base href="/">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" type="image/x-icon" href="favicon.ico">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
</head>
<body>
  <app-root></app-root>
</body>
</html>
```

### 5. Update styles.scss

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

*,
*::before,
*::after {
  box-sizing: border-box;
}

html, body {
  height: 100%;
  margin: 0;
  padding: 0;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  background: #f9fafb;
  color: #1f2937;
}

a {
  text-decoration: none;
  color: inherit;
}

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

## Configuration

### environment.ts

Create `src/environments/environment.ts`:

```typescript
export const environment = {
  apiBaseUrl: 'https://your-api-host',
  wsBaseUrl: 'wss://your-api-host',
};
```

**Replace with your actual API endpoints.**

---

## Complete Code Files

Due to the size of the complete codebase, I'll provide the key files. You can find all files in the `messaging-app/src/app/messaging/` directory.

### Key Integration Points

#### 1. app.component.ts

```typescript
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { MessagingOverlayComponent } from './messaging/messaging-overlay.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, MessagingOverlayComponent],
  template: `
    <main>
      <router-outlet></router-outlet>
    </main>
    <app-messaging-overlay></app-messaging-overlay>
  `,
  styles: [`
    main {
      min-height: 100vh;
      background: #f9fafb;
    }
  `],
})
export class AppComponent {}
```

#### 2. messaging-overlay.component.ts

```typescript
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FloatingButtonComponent } from './components/floating-button/floating-button.component';
import { ChatPanelComponent } from './components/chat-panel/chat-panel.component';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-messaging-overlay',
  standalone: true,
  imports: [CommonModule, FloatingButtonComponent, ChatPanelComponent],
  template: `
    <ng-container *ngIf="auth.isAuthenticated()">
      <app-floating-button></app-floating-button>
      <app-chat-panel></app-chat-panel>
    </ng-container>
  `,
})
export class MessagingOverlayComponent {
  constructor(public auth: AuthService) {}
}
```

---

## Integration Instructions

### Step 1: Copy Files

Copy the entire `messaging/` folder into your Angular project:

```
your-project/src/app/messaging/
```

### Step 2: Update Environment

Edit `src/environments/environment.ts` with your API URLs:

```typescript
export const environment = {
  apiBaseUrl: 'https://your-actual-api.com',
  wsBaseUrl: 'wss://your-actual-api.com',
};
```

### Step 3: Add to App Component

Update your root `app.component.ts`:

```typescript
import { MessagingOverlayComponent } from './messaging/messaging-overlay.component';

@Component({
  // ... other config
  imports: [
    // ... other imports
    MessagingOverlayComponent
  ],
  template: `
    <!-- Your existing content -->
    <router-outlet></router-outlet>
    
    <!-- Add messaging overlay -->
    <app-messaging-overlay></app-messaging-overlay>
  `
})
```

### Step 4: Initialize on Login

In your login component/service, after successful authentication:

```typescript
import { MessagingStoreService } from './messaging/services/messaging-store.service';

constructor(private messagingStore: MessagingStoreService) {}

onLoginSuccess(sessionGid: string, contactId: string) {
  // Store auth data
  localStorage.setItem('session_gid', sessionGid);
  localStorage.setItem('contact_id', contactId);
  
  // Initialize messaging
  this.messagingStore.initialize();
  
  // Navigate to dashboard
  this.router.navigate(['/dashboard']);
}
```

### Step 5: Cleanup on Logout

```typescript
onLogout() {
  this.messagingStore.teardown();
  localStorage.removeItem('session_gid');
  localStorage.removeItem('contact_id');
  this.router.navigate(['/login']);
}
```

---

## API Requirements

Your backend must provide these endpoints:

### Authentication
- Session-based auth using `session_gid` UUID

### REST Endpoints
```
GET    /messaging/contacts/{contactId}/inbox
GET    /messaging/contacts/{contactId}/visible-contacts
GET    /messaging/conversations/{conversationId}/messages
POST   /messaging/conversations/{conversationId}/messages
POST   /messaging/direct-messages
POST   /messaging/conversations
POST   /messaging/conversations/{conversationId}/participants
DELETE /messaging/conversations/{conversationId}/participants/{participantId}
PATCH  /messaging/conversations/{conversationId}
POST   /messaging/conversations/{conversationId}/read
```

### WebSocket
```
WS     /messaging/ws/{contactId}
```

**WebSocket Message Format:**
```json
{
  "action": "authenticate|subscribe|unsubscribe|ping",
  "session_gid": "uuid",
  "conversation_id": "uuid"
}
```

**Server Events:**
```json
{
  "type": "new_message|conversation_update|notification",
  "data": { ... }
}
```

---

## Usage

### For Users
1. **Login** - Use demo users or real credentials
2. **Click floating button** - Opens messaging panel
3. **Drag button** - Reposition anywhere (panel auto-closes/opens)
4. **Resize panel** - Drag any edge (top/bottom/left/right)
5. **Start conversation** - Click "New Message" or "New Group"
6. **Send messages** - Type and press Enter

### For Developers
- All state managed in `MessagingStoreService` (RxJS)
- WebSocket auto-reconnects with exponential backoff
- Panel size/position persisted to localStorage
- Fully typed with TypeScript interfaces
- Standalone components (no modules needed)

---

## Customization

### Change Colors
Edit the Material theme in `styles.scss`:

```scss
$primary-palette: mat.define-palette(mat.$indigo-palette, 400);
$accent-palette: mat.define-palette(mat.$purple-palette, A200);
```

### Adjust Panel Constraints
In `chat-panel.component.ts`:

```typescript
// Min/max width
newWidth = Math.max(280, Math.min(600, newWidth));

// Min/max height
newHeight = Math.max(200, Math.min(window.innerHeight * 0.8, newHeight));
```

### Change Default Size
In `messaging-store.service.ts`:

```typescript
private panelSize$ = new BehaviorSubject<{ width: number; height: number }>({ 
  width: 380,  // Change default width
  height: 560  // Change default height
});
```

---

## Troubleshooting

### CORS Issues
Ensure your API allows requests from your frontend origin.

### WebSocket Connection Fails
- Check `wsBaseUrl` in environment.ts
- Verify WebSocket endpoint accepts connections
- Check browser console for error messages

### Messages Not Appearing
- Verify API endpoints return correct data format
- Check network tab for failed requests
- Ensure `session_gid` and `contactId` are valid

### Panel Not Showing
- Verify user is authenticated (`auth.isAuthenticated()`)
- Check that `MessagingOverlayComponent` is in app template
- Ensure Material Icons font is loaded

---

## File Checklist

Copy these files to your project:

**Models:**
- [ ] `messaging/models/messaging.models.ts`

**Services:**
- [ ] `messaging/services/auth.service.ts`
- [ ] `messaging/services/messaging-api.service.ts`
- [ ] `messaging/services/messaging-websocket.service.ts`
- [ ] `messaging/services/messaging-store.service.ts`

**Components:**
- [ ] `messaging/components/floating-button/floating-button.component.ts`
- [ ] `messaging/components/chat-panel/chat-panel.component.ts`
- [ ] `messaging/components/inbox-list/inbox-list.component.ts`
- [ ] `messaging/components/chat-thread/chat-thread.component.ts`
- [ ] `messaging/components/message-input/message-input.component.ts`
- [ ] `messaging/components/new-conversation/new-conversation.component.ts`
- [ ] `messaging/components/group-manager/group-manager.component.ts`
- [ ] `messaging/messaging-overlay.component.ts`

**Configuration:**
- [ ] `environments/environment.ts`

---

## Support

For issues or questions:
1. Check the browser console for errors
2. Verify all API endpoints are working
3. Ensure WebSocket connection is established
4. Check that authentication is properly configured

---

## License

This messaging system is provided as-is for integration into your application.

---

**Built with Angular 17+ | Material Design | WebSocket | RxJS**
