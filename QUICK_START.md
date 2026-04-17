# Quick Start Guide - @ces/messaging

Get the messaging library integrated into your Angular app in **5 simple steps**.

---

## ⚡ 5-Minute Integration

### Step 1: Build the Library (2 minutes)

```bash
cd messaging-library/messaging-app
npm install
npm run build:lib
```

### Step 2: Install in Your App (1 minute)

```bash
# Option A: npm link (recommended for development)
cd dist/ces-messaging
npm link

cd /path/to/your-angular-app
npm link @ces/messaging
npm install @angular/material@^17.3.10 @angular/cdk@^17.3.10

# Option B: npm pack (for distribution)
cd dist/ces-messaging
npm pack
cd /path/to/your-angular-app
npm install /path/to/ces-messaging-1.0.0.tgz
npm install @angular/material@^17.3.10 @angular/cdk@^17.3.10
```

### Step 3: Configure Your App (1 minute)

**`src/app/app.config.ts`**
```typescript
import { MESSAGING_CONFIG, MessagingConfig } from '@ces/messaging';

const messagingConfig: MessagingConfig = {
  apiBaseUrl: 'https://your-api.com',
  wsBaseUrl: 'wss://your-api.com',
  storageApiUrl: 'https://your-storage.com/api'
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(),
    provideAnimations(),
    { provide: MESSAGING_CONFIG, useValue: messagingConfig }
  ]
};
```

**`src/index.html`** - Add Material Icons:
```html
<link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
```

**`src/styles.scss`** - Add Material theme:
```scss
@use '@angular/material' as mat;
@include mat.core();
@include mat.all-component-themes(mat.define-light-theme(...));
```

### Step 4: Add Overlay to App Component (30 seconds)

**`src/app/app.component.ts`**
```typescript
import { MessagingOverlayComponent } from '@ces/messaging';

@Component({
  imports: [RouterOutlet, MessagingOverlayComponent],
  template: `
    <router-outlet></router-outlet>
    <app-messaging-overlay></app-messaging-overlay>
  `
})
export class AppComponent {}
```

### Step 5: Initialize After Login (30 seconds)

**In your login component:**
```typescript
import { AuthService, Contact } from '@ces/messaging';

constructor(private messagingAuth: AuthService) {}

onLoginSuccess(sessionGid: string, userId: string, email: string) {
  const contact: Contact = {
    contact_id: userId,
    user_gid: sessionGid,
    email: email,
    company_name: 'Your Company',
    is_active: true
  };
  
  this.messagingAuth.setSession(sessionGid, contact);
  this.router.navigate(['/dashboard']);
}
```

---

## ✅ That's It!

Your messaging system is now integrated. The floating chat button will appear after login.

---

## 🎯 What You Get

- ✅ Floating chat button (draggable)
- ✅ Chat panel with inbox
- ✅ Real-time messaging via WebSocket
- ✅ Direct messages and group chats
- ✅ File attachments
- ✅ Unread counts
- ✅ Auto-reconnect on disconnect
- ✅ Responsive design

---

## 📚 Next Steps

### For Complete Examples
See the `examples/` folder for:
- Full login component with UI
- Dashboard with messaging stats
- Navbar with unread counts
- Complete styling examples

### For Detailed Documentation
- **DEVELOPER_INTEGRATION_GUIDE.md** - Complete step-by-step guide
- **FRONTEND_INTEGRATION_GUIDE.md** - Complete API documentation
- **ARCHITECTURE.md** - System architecture and diagrams
- **AI_INTEGRATION_PROMPT.md** - Prompt for AI assistants
- **examples/README.md** - Example files guide

### For Backend Setup
You need a backend that provides:
- REST API: `/messaging/*` endpoints
- WebSocket: `wss://host/messaging/ws/{contactId}`
- Session-based auth with `session_gid`

See `FRONTEND_INTEGRATION_GUIDE.md` for complete API specification.

---

## 🐛 Troubleshooting

### "Cannot find module '@ces/messaging'"
```bash
# Rebuild and relink
cd messaging-library/messaging-app
npm run build:lib
cd dist/ces-messaging
npm link
cd /path/to/your-app
npm link @ces/messaging
```

### Floating button not showing
- Check: `messagingAuth.isAuthenticated()` returns `true`
- Check: `MessagingOverlayComponent` is in app template
- Check: Browser console for errors

### WebSocket not connecting
- Verify `wsBaseUrl` in config
- Check backend WebSocket server is running
- Check browser console for connection errors

---

## 💡 Key Integration Points

### 1. Configuration (Required)
```typescript
{ provide: MESSAGING_CONFIG, useValue: { apiBaseUrl, wsBaseUrl, storageApiUrl } }
```

### 2. Session Initialization (Required)
```typescript
messagingAuth.setSession(sessionGid, contact)
```

### 3. Overlay Component (Required)
```html
<app-messaging-overlay></app-messaging-overlay>
```

---

## 🔐 Authentication Flow

```
1. User logs in with YOUR auth system
   ↓
2. You receive session_gid from your backend
   ↓
3. Call messagingAuth.setSession(sessionGid, contact)
   ↓
4. Messaging system activates automatically
   ↓
5. WebSocket connects
   ↓
6. User can start messaging
```

**Important:** The library does NOT handle user authentication. It expects you to provide the session after your own auth flow.

---

## 📦 What's Included

- **7 Components** - Overlay, panel, inbox, thread, input, new conversation, group manager
- **5 Services** - Auth, API, WebSocket, Store, File upload
- **Full TypeScript** - Complete type definitions
- **Material Design** - Beautiful, modern UI
- **WebSocket** - Real-time with auto-reconnect
- **State Management** - RxJS-based store

---

## 🚀 Production Checklist

- [ ] Build library (`npm run build:lib`)
- [ ] Install in your app
- [ ] Configure API URLs
- [ ] Add Material Icons to index.html
- [ ] Add Material theme to styles.scss
- [ ] Add overlay to app component
- [ ] Initialize session after login
- [ ] Test WebSocket connection
- [ ] Test sending/receiving messages
- [ ] Verify unread counts work
- [ ] Test on mobile devices
- [ ] Configure backend API
- [ ] Set up WebSocket server
- [ ] Deploy and test in production

---

## 🎨 Customization

All components use inline styles that can be easily customized. See `examples/` for styled versions.

---

## 📞 Support

- Check `DEVELOPER_INTEGRATION_GUIDE.md` for detailed instructions
- Review `examples/` folder for working code
- Check browser console for errors
- Verify backend API is accessible

---

**Built with Angular 17+ | Material Design | WebSocket | RxJS**

*Ready to integrate in 5 minutes. Production-ready out of the box.*
