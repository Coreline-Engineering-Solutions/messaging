# @coreline-engineering-solutions/messaging-react-native

React Native / Expo messenger UI for inbox, DMs, groups, favorites, image attachments, and WebSocket updates. This package is the React Native companion to the Angular `@coreline-engineering-solutions/messaging` package and expects the same backend messaging API.

## Agent Integration Summary

Use this README as the integration guide when adding the package to another Expo / React Native app.

The host app must provide:

- An installed `@coreline-engineering-solutions/messaging-react-native` package.
- Expo / React Native with React Navigation bottom tabs or Expo Router tabs.
- A logged-in user email.
- A session gid or auth session identifier for WebSocket auth.
- A bearer token available through `AsyncStorage` or a custom `getAccessToken` callback.
- An API base URL that serves the messaging REST routes and WebSocket route.

## Install

### Current GitHub Repo Layout

This package currently lives in the `messaging-react-native` subfolder of the `Coreline-Engineering-Solutions/messaging` repository. The repository root package is the Angular package, so this is not a reliable install command for a separate React Native app:

```bash
npm install github:Coreline-Engineering-Solutions/messaging#main
```

Use one of the supported install options below.

### Option 1: Published Package

If this package is published to npm or GitHub Packages, install it directly:

```bash
npm install @coreline-engineering-solutions/messaging-react-native
```

### Option 2: Packed Tarball

From this repository:

```bash
cd messaging-react-native
npm install
npm run build
npm pack
```

Then in the target app:

```bash
npm install /path/to/coreline-engineering-solutions-messaging-react-native-1.0.0.tgz
```

### Option 3: Standalone GitHub Repo

If `messaging-react-native` is moved to its own repository, consumers can install it with:

```bash
npm install github:Coreline-Engineering-Solutions/messaging-react-native#main
```

## Peer Dependencies

Install any missing peer dependencies in the target app:

```bash
npm install axios @react-native-async-storage/async-storage @react-navigation/bottom-tabs
npx expo install expo-haptics expo-image expo-image-picker @expo/vector-icons
```

The package expects:

- `react >= 18`
- `react-native >= 0.76`
- `expo >= 52` when used in an Expo app
- `axios >= 1.6`
- `@react-native-async-storage/async-storage >= 2`
- `@react-navigation/bottom-tabs >= 7`
- `expo-haptics >= 14`
- `expo-image >= 2`
- `expo-image-picker >= 16`
- `@expo/vector-icons >= 14`

## Environment

Set the target app API URL. For Expo, use an `EXPO_PUBLIC_` variable:

```bash
EXPO_PUBLIC_TICKETING_API_URL=https://your-api.example.com
```

The library calls REST endpoints under:

```text
${apiBaseUrl}/messaging/...
```

The WebSocket client connects to:

```text
${wsBaseUrl}/messaging/ws/{contactId}
```

Attachment upload and retrieval use `storageApiUrl` when configured, otherwise `apiBaseUrl`. Supported storage paths include `/storage/upload`, `/messaging/storage/upload`, `/messaging/attachments/upload`, `/messaging/files/upload`, and matching retrieve/delete paths.

## Configure Once

Call `configureMessaging` before rendering any messaging components. In Expo Router this usually belongs in the root layout, app entry, or the first authenticated layout that wraps the tab navigator.

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { configureMessaging } from '@coreline-engineering-solutions/messaging-react-native';

const apiBase = process.env.EXPO_PUBLIC_TICKETING_API_URL;

if (!apiBase) {
  throw new Error('Missing EXPO_PUBLIC_TICKETING_API_URL');
}

configureMessaging({
  apiBaseUrl: apiBase,
  wsBaseUrl: apiBase.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:'),
  getAccessToken: () => AsyncStorage.getItem('access_token'),
});
```

`getAccessToken` is optional. If omitted, the package reads `AsyncStorage.getItem('access_token')`.

Use `storageApiUrl` only when file storage is served from a different origin:

```typescript
configureMessaging({
  apiBaseUrl: apiBase,
  wsBaseUrl: apiBase.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:'),
  storageApiUrl: process.env.EXPO_PUBLIC_STORAGE_API_URL,
});
```

## Wrap The App

Wrap the tab navigator, or the authenticated app shell that contains it, with `MessagingProvider`.

```tsx
import {
  MessagingImagePickerHost,
  MessagingOverlay,
  MessagingProvider,
} from '@coreline-engineering-solutions/messaging-react-native';

export function AuthenticatedAppShell({
  children,
  sessionId,
  userEmail,
}: {
  children: React.ReactNode;
  sessionId: string | null;
  userEmail: string | null;
}) {
  return (
    <MessagingProvider sessionGid={sessionId} userEmail={userEmail}>
      <MessagingImagePickerHost />
      {children}
      <MessagingOverlay panelBottomInset={0} />
    </MessagingProvider>
  );
}
```

Provider props:

- `sessionGid`: Session identifier sent to the WebSocket after connect. Pass `null` while logged out.
- `userEmail`: Current authenticated user email. The package resolves this to a messaging contact through `/messaging/contacts/by-email/{email}`. Pass `null` while logged out.

## Add Tab Buttons

For an Expo Router tab layout:

```tsx
import {
  MapTabBarButton,
  MessagingTabBarButton,
} from '@coreline-engineering-solutions/messaging-react-native';
import { Tabs, router } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarButton: (props) => (
            <MessagingTabBarButton
              {...props}
              onNavigateToHost={() => router.navigate('/(tabs)/map')}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Map',
          tabBarButton: (props) => (
            <MapTabBarButton
              {...props}
              onNavigateToHost={() => router.navigate('/(tabs)/map')}
            />
          ),
        }}
      />
    </Tabs>
  );
}
```

`MessagingTabBarButton` opens the messaging overlay. `MapTabBarButton` is a host navigation button for returning to the app's map/home tab. Change `/(tabs)/map` to the route used by the target app.

## Agent Integration Checklist

When integrating this package into another project, an AI coding agent should complete these steps:

1. Inspect the target app package manager and install method.
2. Install `@coreline-engineering-solutions/messaging-react-native` using a published package, packed tarball, or standalone GitHub repo.
3. Install missing peer dependencies with `npm install` and `npx expo install` as shown above.
4. Confirm the app has `EXPO_PUBLIC_TICKETING_API_URL` or add the equivalent environment variable.
5. Locate the app entry, root layout, or authenticated app shell.
6. Add `configureMessaging` before rendering messaging UI.
7. Confirm where the app stores the bearer token. Use the app's existing token getter instead of hard-coding `AsyncStorage` if needed.
8. Locate the authenticated user object and pass the user's email into `MessagingProvider`.
9. Locate the session identifier used by the backend and pass it as `sessionGid`.
10. Wrap the authenticated tab navigator or app shell with `MessagingProvider`.
11. Render `MessagingImagePickerHost` inside the provider.
12. Render `MessagingOverlay` inside the provider and outside the tab navigator content.
13. Add `MessagingTabBarButton` to the messages tab or another host control that should open messaging.
14. Update `onNavigateToHost` routes to match the target app's navigation structure.
15. Run TypeScript, lint, and the app on a device or simulator.
16. Verify login, contact resolution, inbox loading, message sending, image picking, and WebSocket status.

## Backend Requirements

The backend must support the messaging routes used by the package:

- `GET /messaging/contacts/by-email/{email}`
- `GET /messaging/contacts/{contactId}/inbox`
- `GET /messaging/contacts/{contactId}/visible-contacts`
- `GET /messaging/conversations/{conversationId}/messages`
- `POST /messaging/conversations/{conversationId}/messages`
- `POST /messaging/direct-messages`
- `POST /messaging/conversations`
- `POST /messaging/groups`
- `POST /messaging/search`
- `PUT /messaging/contacts/{contactId}/presence`
- `WS /messaging/ws/{contactId}`

The package also calls message reactions, replies, edit/delete, pin/unpin, read, clear/delete conversation, connections, notifications, and storage endpoints when those UI actions are used.

All REST requests include `Authorization: Bearer {token}` when `getAccessToken` or `AsyncStorage.getItem('access_token')` returns a token.

## Verification

After integration:

1. Start the target app.
2. Log in as a user with a known messaging contact.
3. Confirm the provider resolves the user email to a contact.
4. Open the messaging tab/button and confirm the overlay appears.
5. Confirm inbox data loads from `/messaging/contacts/{contactId}/inbox`.
6. Open a conversation and send a text message.
7. Pick and send an image if attachments are enabled.
8. Confirm WebSocket status reaches `authenticated` and incoming messages update the UI.
9. Restart the app and confirm favorites persist locally.

## Troubleshooting

- `Messaging is not configured`: Call `configureMessaging` before rendering `MessagingProvider`, `MessagingOverlay`, or any hook that uses messaging.
- Inbox does not load: Check `EXPO_PUBLIC_TICKETING_API_URL`, bearer token storage, and `/messaging/contacts/by-email/{email}`.
- WebSocket does not authenticate: Check `sessionGid`, the `wsBaseUrl`, and the backend `/messaging/ws/{contactId}` auth protocol.
- Images do not upload: Confirm `expo-image-picker` is installed, `MessagingImagePickerHost` is rendered, and the backend supports one of the storage upload paths.
- The tab button does not navigate correctly: Replace `/(tabs)/map` with the target app's real route.
- The package imports fail after GitHub install: Confirm the target app installed the React Native package, not the repository root Angular package.

## Favorites

Favorites are stored on device only with `AsyncStorage` key `@messaging_favorites/{contactId}`. They are not synced to the server.

## Build And Publish Workflow

For maintainers updating this package:

```bash
cd messaging-react-native
npm install
npm run build
git add lib src package.json README.md
git commit -m "build: messaging-react-native"
git push
```

Consumers must reinstall or update their package reference to pick up a new published package, tarball, or GitHub commit.
