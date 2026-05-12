# Using this library in another Angular project

Start here when you want to **install and run** `@coreline-engineering-solutions/messaging` from this repo in your own app.

---

## Option A — Local development (fastest)

From the **root** of this repository:

```bash
npm run build:lib
```

Then link the built package:

```bash
cd messaging-app/dist/ces-messaging
npm link
```

In **your** Angular project:

```bash
npm link @coreline-engineering-solutions/messaging
npm install @angular/material@^17.3.10 @angular/cdk@^17.3.10
```

After you change library source, run `npm run build:lib` again from the repo root (or `messaging-app`) and refresh your app.

---

## Option B — `file:` dependency (no global link)

Build the library (from repo root):

```bash
npm run build:lib
```

In your app’s `package.json`:

```json
"@coreline-engineering-solutions/messaging": "file:../messaging/messaging-app/dist/ces-messaging"
```

Adjust the relative path to match where this repo lives on your machine. Then:

```bash
npm install
```

---

## Option C — Install from Git

When this package is published from the **repository root** (see root `package.json` `files` field), consumers can install from Git:

```bash
npm install git+https://github.com/<org-or-user>/messaging.git#main --legacy-peer-deps
```

Use your real fork/org URL and branch or tag. See **INSTALLATION.md** for details and `--legacy-peer-deps` rationale.

---

## Required steps in your app (every option)

1. **Peer dependencies** — Angular 17+ (aligned with your app), `@angular/material`, `@angular/cdk`, `rxjs`, `zone.js` as needed.
2. **Provide config** — `MESSAGING_CONFIG` with `apiBaseUrl`, `wsBaseUrl`, and `storageApiUrl` (see **QUICK_START.md** Step 3).
3. **Bootstrap** — `provideHttpClient()`, `provideAnimations()`, Material theme + icons in `index.html` / `styles`.
4. **Template** — Add `<app-messaging-overlay></app-messaging-overlay>` after your user is authenticated (or wire `AuthService.setSession` after your own login).

Full walkthrough: **QUICK_START.md**  
Backend contracts and edge cases: **DEVELOPER_INTEGRATION_GUIDE.md**  
API-oriented detail: **FRONTEND_INTEGRATION_GUIDE.md**

---

## Optional local sandbox

A **`demo_webste/`** app is **gitignored** in this repo (personal testing only). To run one locally, create an Angular app beside `messaging-app` (or anywhere), add:

```json
"@coreline-engineering-solutions/messaging": "file:../messaging/messaging-app/dist/ces-messaging"
```

Then `npm run build:lib` from the repo root and `npm install && npm start` in your sandbox app.

---

## CI

Pull requests run **GitHub Actions** (`.github/workflows/ci.yml`): install and **build the library** only (`messaging-app`).
