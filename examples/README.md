# Example Integration Files

This folder contains complete, working examples showing how to integrate the `@coreline-engineering-solutions/messaging` library into your Angular application.

## 📁 Files Included

### Configuration
- **`app.config.example.ts`** - Application configuration with messaging setup
  - Shows how to configure API endpoints
  - Includes examples for dev/staging/production environments
  - Demonstrates required providers (HttpClient, Animations, MESSAGING_CONFIG)

### Components
- **`app.component.example.ts`** - Root component with messaging overlay
  - Shows where to place `<app-messaging-overlay>`
  - Minimal setup required

- **`login.component.example.ts`** - Login component with messaging initialization
  - Complete login flow with form validation
  - Shows how to call `messagingAuth.setSession()` after login
  - Includes error handling and loading states
  - Beautiful styled UI

- **`navbar.component.example.ts`** - Navigation bar with messaging integration
  - Displays unread message count
  - Shows user info from messaging auth
  - Handles logout properly
  - Responsive design

- **`dashboard.component.example.ts`** - Dashboard with messaging stats
  - Displays messaging statistics (unread count, conversations)
  - Shows recent conversations
  - Demonstrates how to use messaging services directly
  - Interactive conversation opening

## 🚀 How to Use These Examples

### 1. Copy to Your Project

```bash
# Copy the example files to your Angular project
cp examples/app.config.example.ts your-app/src/app/app.config.ts
cp examples/app.component.example.ts your-app/src/app/app.component.ts
cp examples/login.component.example.ts your-app/src/app/components/login/login.component.ts
cp examples/navbar.component.example.ts your-app/src/app/components/navbar/navbar.component.ts
cp examples/dashboard.component.example.ts your-app/src/app/pages/dashboard/dashboard.component.ts
```

### 2. Update Configuration

Edit `app.config.ts` and replace the placeholder URLs:

```typescript
const messagingConfig: MessagingConfig = {
  apiBaseUrl: 'https://YOUR-ACTUAL-API.com',
  wsBaseUrl: 'wss://YOUR-ACTUAL-API.com',
  storageApiUrl: 'https://YOUR-STORAGE-API.com/api'
};
```

### 3. Customize for Your Auth System

In `login.component.ts`, update the authentication logic to match your backend:

```typescript
private async authenticateWithYourBackend(email: string, password: string): Promise<any> {
  // Replace with your actual auth API call
  return this.http.post<any>('https://your-api.com/auth', {
    email,
    password
  }).toPromise();
}
```

### 4. Add Routes

Create `app.routes.ts` if you don't have one:

```typescript
import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';

export const routes: Routes = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'dashboard', component: DashboardComponent },
  // Add your other routes here
];
```

## 📝 Important Notes

### TypeScript Errors in Examples Folder

The example files will show TypeScript errors because:
- They're in the `examples/` folder (not part of an Angular project)
- Angular dependencies aren't installed in this folder
- They're meant to be **copied** to your actual Angular project

**These errors are expected and will disappear when you copy the files to your Angular app.**

### Required Dependencies

Make sure your Angular app has these installed:

```bash
npm install @angular/material@^17.3.10 @angular/cdk@^17.3.10
```

### Material Icons

Add to your `index.html`:

```html
<link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
```

## 🎯 Integration Checklist

- [ ] Build the messaging library (`npm run build:lib`)
- [ ] Install library in your app (`npm link @coreline-engineering-solutions/messaging`)
- [ ] Install peer dependencies (Material, CDK)
- [ ] Copy example files to your project
- [ ] Update API URLs in `app.config.ts`
- [ ] Add Material Icons to `index.html`
- [ ] Add Material theme to `styles.scss`
- [ ] Update login logic to match your auth system
- [ ] Test login and messaging initialization
- [ ] Verify WebSocket connection
- [ ] Test sending/receiving messages

## 🔍 What Each Example Demonstrates

### app.config.example.ts
✅ How to provide MESSAGING_CONFIG
✅ Environment-specific configuration
✅ Required providers setup

### app.component.example.ts
✅ Where to place MessagingOverlayComponent
✅ Minimal root component setup

### login.component.example.ts
✅ Complete login flow with validation
✅ How to initialize messaging after auth
✅ Creating Contact object from auth response
✅ Error handling and loading states
✅ Beautiful Material-inspired UI

### navbar.component.example.ts
✅ Accessing messaging state (unread count)
✅ Displaying user info from messaging auth
✅ Proper logout handling
✅ Responsive navigation design

### dashboard.component.example.ts
✅ Using MessagingStoreService observables
✅ Accessing inbox data
✅ Opening conversations programmatically
✅ Displaying messaging statistics
✅ Using MessagingApiService directly

## 🛠️ Customization

All example files include:
- Detailed comments explaining each section
- Inline styles (easy to extract to separate files)
- TypeScript type safety
- Error handling
- Loading states
- Responsive design

Feel free to:
- Modify styles to match your brand
- Adjust layouts and components
- Add additional features
- Extract styles to separate SCSS files
- Add more error handling
- Implement your own auth flow

## 📚 Additional Resources

- **DEVELOPER_INTEGRATION_GUIDE.md** - Complete step-by-step integration guide
- **FRONTEND_INTEGRATION_GUIDE.md** - API documentation and backend requirements
- **messaging-app/README.md** - Library documentation

## 💡 Tips

1. **Start with login.component.example.ts** - This is the most critical integration point
2. **Test authentication first** - Make sure `messagingAuth.setSession()` is called correctly
3. **Check browser console** - Look for "Messaging session initialized" and "WebSocket connected"
4. **Use Network tab** - Verify API calls and WebSocket connection
5. **Test incrementally** - Get login working, then add other components

## 🐛 Troubleshooting

### "Cannot find module '@coreline-engineering-solutions/messaging'"
→ Build and link the library first (see DEVELOPER_INTEGRATION_GUIDE.md)

### Floating button not showing
→ Check that user is authenticated: `messagingAuth.isAuthenticated()`

### WebSocket not connecting
→ Verify `wsBaseUrl` in config and check backend is running

### Messages not sending
→ Check Network tab for API errors and verify session_gid is valid

## ✨ Next Steps

1. Copy the example files to your project
2. Update the configuration with your API URLs
3. Customize the authentication logic
4. Test the integration
5. Start building your own features!

---

**These examples provide a complete, production-ready integration of the messaging library.**
