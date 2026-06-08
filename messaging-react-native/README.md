# @coreline-engineering-solutions/messaging-react-native

React Native / Expo messenger UI for inbox, DMs, groups, favorites, image attachments, and WebSocket updates. This package is the React Native companion to the Angular `@coreline-engineering-solutions/messaging` package and expects the same backend messaging API.

## Agent Integration Summary

Use this README as the integration guide when adding the package to another Expo / React Native app.

The host app must provide:

- An installed `@coreline-engineering-solutions/messaging-react-native` package.
- Expo / React Native with React Navigation bottom tabs or Expo Router tabs.
- A logged-in user email.
- A current `session_gid` from the host app login session.
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

Attachment upload and retrieval use **`apiBaseUrl` only** (same as the Angular `@coreline-engineering-solutions/messaging` web package). `storageApiUrl` is ignored as of v1.2.0. The client tries `/storage/*`, then `/files/*`, then `/messaging/storage/*` and `/messaging/files/*` for upload, retrieve, and delete. REST and file requests authenticate with `X-Messaging-Session: {session_gid}`.

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
  getSessionGid: () => AsyncStorage.getItem('session_gid'),
});
```

`getSessionGid` is optional when `MessagingProvider` receives `sessionGid`; the provider stores the active session in the package runtime. If both are omitted, the package falls back to `AsyncStorage.getItem('session_gid')`.

Do not point `storageApiUrl` at a separate file-storage API for chat attachments; it is deprecated and ignored. Host apps only need `apiBaseUrl`, `wsBaseUrl`, and a valid `session_gid`.

## Wrap The App

Wrap the tab navigator, or the authenticated app shell that contains it, with `MessagingProvider`.

### Overlay mode (bottom sheet)

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
    <MessagingProvider sessionGid={sessionId} userEmail={userEmail} presentation="overlay">
      <MessagingImagePickerHost />
      {children}
      <MessagingOverlay panelBottomInset={0} />
    </MessagingProvider>
  );
}
```

### Screen mode (dedicated Messages tab)

Use `presentation="screen"` and render `MessagingScreen` on the host app's messages route. Do not mount `MessagingOverlay` in this mode.

```tsx
import {
  MessagingImagePickerHost,
  MessagingProvider,
  MessagingScreen,
  useMessaging,
} from '@coreline-engineering-solutions/messaging-react-native';

export function AuthenticatedAppShell({ children, sessionId, userEmail }) {
  return (
    <MessagingProvider sessionGid={sessionId} userEmail={userEmail} presentation="screen">
      <MessagingImagePickerHost />
      {children}
    </MessagingProvider>
  );
}

// app/(tabs)/messages.tsx
export default function MessagesTabScreen() {
  return <MessagingScreen />;
}
```

Show unread counts on the tab bar with `useMessaging().totalUnread` and React Navigation `tabBarBadge`.

Provider props:

- `sessionGid`: Current login session identifier. REST/file requests send it as `X-Messaging-Session`; WebSockets send it in the first `{ type: 'auth', session_gid }` message. Pass `null` while logged out.
- `userEmail`: Current authenticated user email. The package keeps this for display/fallback purposes; the backend resolves the canonical contact through `/messaging/auth/me`. Pass `null` while logged out.
- `presentation`: `'overlay'` (default) opens UI in a resizable bottom sheet; `'screen'` renders inbox/chat in a full-screen host route via `MessagingScreen`.

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
7. Confirm where the app stores the current `session_gid`. Use the app's existing session getter instead of hard-coding `AsyncStorage` if needed.
8. Locate the authenticated user object and pass the user's email into `MessagingProvider`.
9. Locate the session identifier used by the backend and pass it as `sessionGid`.
10. Wrap the authenticated tab navigator or app shell with `MessagingProvider` (`presentation="overlay"` or `"screen"`).
11. Render `MessagingImagePickerHost` inside the provider.
12. **Overlay:** render `MessagingOverlay` outside tab content. **Screen:** add a messages tab route that renders `MessagingScreen`.
13. Add `MessagingTabBarButton` to the messages tab or another host control that should open messaging.
14. Update `onNavigateToHost` routes to match the target app's navigation structure.
15. Run TypeScript, lint, and the app on a device or simulator.
16. Verify login, contact resolution, inbox loading, message sending, image picking, and WebSocket status.

## Backend Requirements

The backend must support the session-based messaging routes used by the package:

- `GET /messaging/auth/me`
- `GET /messaging/my-inbox`
- `GET /messaging/my-visible-contacts`
- `GET /messaging/conversations/{conversationId}/messages`
- `POST /messaging/conversations/{conversationId}/messages`
- `POST /messaging/direct-messages`
- `POST /messaging/conversations`
- `POST /messaging/groups`
- `POST /messaging/search`
- `PUT /messaging/contacts/{contactId}/presence`
- `WS /messaging/ws/{contactId}`

The package also calls message reactions, replies, edit/delete, read, group management, and storage endpoints when those UI actions are used.

All REST and file requests include `X-Messaging-Session: {session_gid}` when `MessagingProvider.sessionGid`, `getSessionGid`, or `AsyncStorage.getItem('session_gid')` returns a session.

## Verification

After integration:

1. Start the target app.
2. Log in as a user with a known messaging contact.
3. Confirm the provider resolves `/messaging/auth/me` to a contact.
4. Open the messaging tab/button and confirm the overlay appears.
5. Confirm inbox data loads from `/messaging/my-inbox`.
6. Open a conversation and send a text message.
7. Pick and send an image if attachments are enabled.
8. Confirm WebSocket status reaches `authenticated` and incoming messages update the UI.
9. Restart the app and confirm favorites persist locally.

## Troubleshooting

- `Messaging is not configured`: Call `configureMessaging` before rendering `MessagingProvider`, `MessagingOverlay`, or any hook that uses messaging.
- Inbox does not load: Check `EXPO_PUBLIC_TICKETING_API_URL`, `session_gid` storage, and `/messaging/auth/me`.
- WebSocket does not authenticate: Check `sessionGid`, the `wsBaseUrl`, and the backend `/messaging/ws/{contactId}` first-message auth protocol.
- Images do not upload: Confirm `expo-image-picker` is installed, `MessagingImagePickerHost` is rendered, `apiBaseUrl` is the ticketing API (not a separate file-storage `/store` service), and the backend exposes `/storage/upload` or `/files/upload` on that same base. Check `attachmentError` on `useMessaging()` for the last failure message.
- Attachments send but peers do not see images: Ensure messages use `attachment_ids` + `mime_types` (v1.2.0+); reinstall the package if an older build sent `content=file_id` for single images.
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
