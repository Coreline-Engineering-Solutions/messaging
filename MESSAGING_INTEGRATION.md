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

## Required `contact_id` Rules

- `Contact.contact_id` must be a string.
- For CES/FastAPI-style backends that cast IDs to `int`/`bigint`, it must be a numeric value.
- Do not pass raw email as `contact_id` for path-based routes.
- Resolve by email first when needed:
  - `GET /api/messaging/contacts/by-email/{email}`

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
const contact: Contact = {
  contact_id: String(numericContactId),
  user_gid: sessionGid,
  email,
  company_name,
  is_active: true,
};
messagingAuth.setSession(sessionGid, contact);
```

Recommended defensive behavior in host apps:

- Clear stale messaging session before initializing a new one.
- Keep messaging logged out if no valid numeric contact ID is available.
- Coerce `contact_id` to string before calling `setSession`.

## CES Incident Summary (Known Failure Pattern)

Observed failure mode:

1. Frontend pointed messaging calls to an old host -> messaging routes returned 404.
2. By-email lookup also hit old host -> `GET /api/messaging/contacts/by-email/{email}` returned 404.
3. Stale/invalid contact state reached library init -> runtime error:
   - `TypeError: contactId?.includes is not a function`

Fix that worked:

- Split API bases: messaging uses its own host.
- Keep non-messaging auth/app APIs on their own host.
- Set messaging config to `/api` for both REST and WS base.
- Update by-email lookup to the messaging host.
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
