08:35 update


# Messaging Integration (Single Source of Truth)

This is the only integration guide for `@coreline-engineering-solutions/messaging` in this repo.

## Contract (Library Expectations)

The library always builds URLs like this:

- REST: `${apiBaseUrl}/messaging/...`
- WebSocket: `${wsBaseUrl}/messaging/ws/${contactId}`

If your backend is mounted under `/api`, configure:

- `apiBaseUrl = https://host/api`
- `wsBaseUrl = wss://host/api`

Do not use root `wss://host` unless your websocket endpoint is intentionally mounted at root.

## Required Session Rules

- REST requests authenticate with `X-Messaging-Session: <session_gid>`.
- Do not put `session_gid` in query strings.
- Resolve the current messaging contact with `GET /api/messaging/auth/me`.
- Use `GET /api/messaging/my-inbox` and `GET /api/messaging/my-visible-contacts`.

## Angular Consumer Setup (Minimum)

Install:

```bash
npm install git+https://github.com/Coreline-Engineering-Solutions/messaging.git#main --legacy-peer-deps
npm install @angular/material@^17.3.0 @angular/cdk@^17.3.0 --legacy-peer-deps
```

Configure:

```typescript
const messagingConfig: MessagingConfig = {
  apiBaseUrl: 'https://your-messaging-host/api',
  wsBaseUrl: 'wss://your-messaging-host/api',
  storageApiUrl: 'https://your-messaging-host/api',
};
```

Session init:

```typescript
const contact = await messagingAuth.refreshMessagingSession();
if (!contact) {
  // Keep messaging logged out until the auth API accepts the session.
  return;
}
```

Recommended defensive behavior in host apps:

- Clear stale messaging session before initializing a new one.
- Keep messaging logged out if `/messaging/auth/me` cannot resolve the current session.
- Do not call legacy email lookup endpoints from host-app bootstrap code.

## CES Incident Summary (Known Failure Pattern)

Observed failure mode:

1. Frontend pointed messaging calls to an old host -> messaging routes returned 404.
2. Host app attempted a legacy email lookup instead of `/api/messaging/auth/me`.
3. Stale/invalid contact state reached library init -> runtime error:
   - `TypeError: contactId?.includes is not a function`

Fix that worked:

- Split API bases: messaging uses its own host.
- Keep non-messaging auth/app APIs on their own host.
- Set messaging config to `/api` for both REST and WS base.
- Update host bootstrap to call `/api/messaging/auth/me` with `X-Messaging-Session`.
- Add defensive session cleanup and `contact_id` coercion.

Current result: build passes and messaging loads correctly.

## Packaging / Release Rules (Git Installs)

For `npm install git+...` consumers, built output must be present in Git:

1. Build library:
   - `cd messaging-app && npm run build:lib`
2. Ensure `messaging-app/dist/ces-messaging/**` is tracked.
3. Push `main`.
4. In consumer app, reinstall dependency so lockfile moves to latest commit.

If consumers report "Failed to resolve entry for package", first verify `node_modules/@coreline-engineering-solutions/messaging/messaging-app/dist/ces-messaging/fesm2022/coreline-engineering-solutions-messaging.mjs` exists.
