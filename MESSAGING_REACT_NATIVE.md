# React Native messaging library

Package: `@coreline-engineering-solutions/messaging-react-native`  
Path: `messaging-react-native/`

## Build & push (maintainer)

```bash
cd messaging-react-native
npm install
npm run build
cd ..
git add messaging-react-native/lib messaging-react-native/src messaging-react-native/package.json messaging-react-native/README.md
git commit -m "build: messaging-react-native"
git push
```

Built `lib/` must be committed for `npm install` from Git (same pattern as Angular `messaging-app/dist`).

## Consumer install

```bash
npm install github:Coreline-Engineering-Solutions/messaging#main
```

Point `package.json` at the subfolder if publishing only RN from monorepo:

```json
"@coreline-engineering-solutions/messaging-react-native": "github:Coreline-Engineering-Solutions/messaging#main"
```

After push, reinstall in the host app so the lockfile picks up the new commit.

See `messaging-react-native/README.md` for `configureMessaging`, `MessagingProvider`, and tab button setup.
