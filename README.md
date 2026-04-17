# @ces/messaging - Angular Messaging Library

A complete, production-ready Angular 17+ messaging system with real-time WebSocket support, Material Design UI, and RxJS state management.

[![Angular](https://img.shields.io/badge/Angular-17%2B-red)](https://angular.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue)](https://www.typescriptlang.org/)
[![Material](https://img.shields.io/badge/Material-17.3-purple)](https://material.angular.io/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

---

## ✨ Features

- ✅ **Real-time Messaging** - WebSocket with auto-reconnect
- ✅ **Material Design UI** - Beautiful, modern interface
- ✅ **Direct & Group Chats** - One-on-one and group conversations
- ✅ **File Attachments** - Upload and share files
- ✅ **Unread Badges** - Visual notification system
- ✅ **Responsive Design** - Works on desktop and mobile
- ✅ **State Management** - RxJS-based reactive store
- ✅ **TypeScript** - Full type safety
- ✅ **Standalone Components** - Angular 17+ architecture
- ✅ **Draggable UI** - Floating button with resizable panel

---

## 🚀 Quick Start

### Installation

```bash
npm install git+https://github.com/YOUR_USERNAME/messaging-library.git#main
npm install @angular/material@^17.3.10 @angular/cdk@^17.3.10
```

### Configuration

**`app.config.ts`**
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

**`app.component.ts`**
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

**After Login**
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
}
```

**That's it!** The messaging system is now active. 🎉

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| **[QUICK_START.md](QUICK_START.md)** | 5-minute integration guide |
| **[DEVELOPER_INTEGRATION_GUIDE.md](DEVELOPER_INTEGRATION_GUIDE.md)** | Complete step-by-step guide |
| **[GIT_INSTALLATION_GUIDE.md](GIT_INSTALLATION_GUIDE.md)** | Installing from Git repository |
| **[ARCHITECTURE.md](ARCHITECTURE.md)** | System architecture & diagrams |
| **[FRONTEND_INTEGRATION_GUIDE.md](FRONTEND_INTEGRATION_GUIDE.md)** | Complete API documentation |
| **[AI_INTEGRATION_PROMPT.md](AI_INTEGRATION_PROMPT.md)** | Prompt for AI assistants |
| **[examples/](examples/)** | Working code examples |

---

## 🎯 What's Included

### Components (7)
- `MessagingOverlayComponent` - Root overlay wrapper
- `FloatingButtonComponent` - Draggable chat button
- `ChatPanelComponent` - Resizable chat panel
- `InboxListComponent` - Conversation list
- `ChatThreadComponent` - Message thread
- `MessageInputComponent` - Message composer
- `NewConversationComponent` - Start new chat
- `GroupManagerComponent` - Manage groups

### Services (5)
- `AuthService` - Session & authentication
- `MessagingApiService` - REST API calls
- `MessagingWebSocketService` - Real-time messaging
- `MessagingStoreService` - State management
- `MessagingFileService` - File uploads

### Models
Complete TypeScript interfaces for all data structures

---

## 🔐 Authentication

**Important:** This library does NOT handle user authentication. It expects your app to:

1. Authenticate users through your own auth system
2. Obtain a `session_gid` (UUID) from your backend
3. Call `messagingAuth.setSession(sessionGid, contact)` after login

The library manages the messaging session, not user authentication.

---

## 🌐 Backend Requirements

Your backend must provide:

### REST API
```
GET    /messaging/contacts/{contactId}/inbox
GET    /messaging/contacts/{contactId}/visible-contacts
GET    /messaging/conversations/{conversationId}/messages
POST   /messaging/conversations/{conversationId}/messages
POST   /messaging/conversations
POST   /messaging/direct-messages
POST   /messaging/groups
POST   /messaging/attachments/upload
```

### WebSocket
```
WS: wss://your-api.com/messaging/ws/{contactId}
```

See [FRONTEND_INTEGRATION_GUIDE.md](FRONTEND_INTEGRATION_GUIDE.md) for complete API specification.

---

## 💻 Development

### Build the Library

```bash
cd messaging-app
npm install
npm run build:lib
```

Output: `messaging-app/dist/ces-messaging/`

### Run Demo App

```bash
cd messaging-app
npm start
```

### Run Tests

```bash
cd messaging-app
npm test
```

---

## 📦 Publishing Updates

1. Make changes in `messaging-app/src/`
2. Rebuild: `npm run build:lib`
3. Update version in `package.json`
4. Commit: `git add . && git commit -m "Update to v1.1.0"`
5. Tag: `git tag -a v1.1.0 -m "Release v1.1.0"`
6. Push: `git push origin main --tags`

See [PUBLISH_CHECKLIST.md](PUBLISH_CHECKLIST.md) for details.

---

## 🎨 Customization

All components use inline styles that can be easily customized. See the `examples/` folder for styled versions.

---

## 🐛 Troubleshooting

### "Cannot find module '@ces/messaging'"
```bash
npm cache clean --force
npm install git+https://github.com/YOUR_USERNAME/messaging-library.git#main
```

### Floating button not showing
- Check: `messagingAuth.isAuthenticated()` returns `true`
- Check: `MessagingOverlayComponent` is in app template
- Check: Browser console for errors

### WebSocket not connecting
- Verify `wsBaseUrl` in config
- Check backend WebSocket server is running
- Check browser console for connection errors

See documentation for more troubleshooting tips.

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

---

## 👥 Author

**Coreline Engineering Solutions**

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Build and test
5. Submit a pull request

---

## 📞 Support

- Check the documentation in the repository
- Review example code in `examples/` folder
- Use `AI_INTEGRATION_PROMPT.md` with your AI assistant
- Open an issue on GitHub

---

## 🎉 What You Get

After integration, users will see:

1. **Floating chat button** (bottom-right corner)
2. **Click to open** chat panel
3. **Inbox** with all conversations
4. **Real-time messages** via WebSocket
5. **Unread badges** on button
6. **New conversation** button
7. **Group creation** option
8. **File attachments** support
9. **Responsive design** (mobile-friendly)
10. **Auto-reconnect** on disconnect

All with **minimal code** on your side!

---

**Built with Angular 17+ | Material Design | WebSocket | RxJS**

*Production-ready messaging system in 5 minutes* ⚡
