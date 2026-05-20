# @coreline-engineering-solutions/messaging-react-native

React Native / Expo messenger (inbox, DMs, groups, favorites, WebSocket). Companion to the Angular `@coreline-engineering-solutions/messaging` package.

## Install (GitHub, same repo as Angular lib)

```bash
npm install github:Coreline-Engineering-Solutions/messaging#main --prefix messaging-react-native
```

Or pin the subfolder in `package.json`:

```json
"@coreline-engineering-solutions/messaging-react-native": "github:Coreline-Engineering-Solutions/messaging#main"
```

Run `npm install` from the repo root after `cd messaging-react-native && npm run build` so `lib/` is present (or rely on `prepare` on install).

## Configure once (app entry)

```typescript
import { configureMessaging } from '@coreline-engineering-solutions/messaging-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const apiBase = process.env.EXPO_PUBLIC_TICKETING_API_URL!;

configureMessaging({
  apiBaseUrl: apiBase,
  wsBaseUrl: apiBase.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:'),
  getAccessToken: () => AsyncStorage.getItem('access_token'),
});
```

REST and WebSocket paths match the Angular library: `${apiBaseUrl}/messaging/...`, `${wsBaseUrl}/messaging/ws/{contactId}`.

## Wrap app with provider

```tsx
import {
  MessagingProvider,
  MessagingOverlay,
  MessagingImagePickerHost,
  MessagingTabBarButton,
  MapTabBarButton,
} from '@coreline-engineering-solutions/messaging-react-native';

<MessagingProvider sessionGid={sessionId} userEmail={user?.email ?? null}>
  <MessagingImagePickerHost />
  <Tabs>
  ...
  </Tabs>
  <MessagingOverlay panelBottomInset={0} />
</MessagingProvider>
```

Tab buttons (host supplies navigation):

```tsx
tabBarButton: (props) => (
  <MessagingTabBarButton {...props} onNavigateToHost={() => router.navigate('/(tabs)/map')} />
),
```

```tsx
tabBarButton: (props) => (
  <MapTabBarButton {...props} onNavigateToHost={() => router.navigate('/(tabs)/map')} />
),
```

## Build & publish workflow

```bash
cd messaging-react-native
npm install
npm run build
git add lib src package.json
git commit -m "build: messaging-react-native"
git push
```

Consumers reinstall the git dependency to pick up the new commit.

## Favorites

Stored on device only (`AsyncStorage`, key `@messaging_favorites/{contactId}`). Not synced to server.
