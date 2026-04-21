# Installing @ces/messaging from Git

This guide shows how to install the messaging library directly from your Git repository into other Angular projects.

---

## 📦 Installation Methods

### Method 1: Install from GitHub (Recommended)

Once your repository is pushed to GitHub, install it directly:

```bash
npm install git+https://github.com/Coreline-Engineering-Solutions/messaging.git#main
```

Or add to your `package.json`:

```json
{
  "dependencies": {
    "@ces/messaging": "git+https://github.com/Coreline-Engineering-Solutions/messaging.git#main"
  }
}
```

Then run:
```bash
npm install
```

---

### Method 2: Install from Specific Branch/Tag

Install from a specific branch:
```bash
npm install git+https://github.com/Coreline-Engineering-Solutions/messaging.git#develop
```

Install from a specific tag/version:
```bash
npm install git+https://github.com/Coreline-Engineering-Solutions/messaging.git#v1.0.0
```

Install from a specific commit:
```bash
npm install git+https://github.com/Coreline-Engineering-Solutions/messaging.git#abc1234
```

---

### Method 3: Install from Private Repository

If your repository is private, use SSH:

```bash
npm install git+ssh://git@github.com/Coreline-Engineering-Solutions/messaging.git#main
```

Or with authentication token:
```bash
npm install git+https://YOUR_TOKEN@github.com/Coreline-Engineering-Solutions/messaging.git#main
```

---

## 🔧 Required Setup Before Installation

### 1. Build the Library First

**IMPORTANT:** You must build the library and commit the `dist/` folder to Git.

```bash
cd messaging-library/messaging-app
npm install
npm run build:lib
```

This creates `dist/ces-messaging/` with the compiled library.

### 2. Update `.gitignore`

Make sure `dist/ces-messaging/` is **NOT** ignored in Git:

**`.gitignore`** - Remove or comment out:
```
# dist/  ← Make sure this is commented or removed
```

Or be more specific:
```
# Ignore all dist folders except the library build
dist/*
!dist/ces-messaging/
```

### 3. Commit the Built Library

```bash
git add messaging-app/dist/ces-messaging/
git commit -m "Add built library for npm installation"
git push origin main
```

### 4. Update `ng-package.json` (Already Done)

Your `ng-package.json` should specify the output directory:

```json
{
  "$schema": "node_modules/ng-packagr/ng-package.schema.json",
  "dest": "dist/ces-messaging",
  "lib": {
    "entryFile": "src/lib/public-api.ts"
  }
}
```

---

## 📝 Update `package.json` for Git Installation

Update `messaging-app/package.json`:

```json
{
  "name": "@ces/messaging",
  "version": "1.0.0",
  "description": "Angular 17+ messaging library with real-time WebSocket support",
  "author": "Coreline Engineering Solutions",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/Coreline-Engineering-Solutions/messaging.git",
    "directory": "messaging-app"
  },
  "main": "dist/ces-messaging/fesm2022/ces-messaging.mjs",
  "module": "dist/ces-messaging/fesm2022/ces-messaging.mjs",
  "typings": "dist/ces-messaging/index.d.ts",
  "private": false,
  "peerDependencies": {
    "@angular/animations": "^17.3.0",
    "@angular/cdk": "^17.3.10",
    "@angular/common": "^17.3.0",
    "@angular/core": "^17.3.0",
    "@angular/forms": "^17.3.0",
    "@angular/material": "^17.3.10",
    "@angular/platform-browser": "^17.3.0",
    "@angular/router": "^17.3.0",
    "rxjs": "~7.8.0"
  }
}
```

**Key changes:**
- `"private": false` - Allows npm installation
- `"repository"` - Points to your Git repo
- `"main"`, `"module"`, `"typings"` - Points to built files

---

## 🚀 Installing in Your Angular Project

### Step 1: Install the Library

```bash
cd /path/to/your-angular-app
npm install git+https://github.com/Coreline-Engineering-Solutions/messaging.git#main
```

### Step 2: Install Peer Dependencies

```bash
npm install @angular/material@^17.3.10 @angular/cdk@^17.3.10
```

### Step 3: Configure Your App

Follow the integration steps in `QUICK_START.md`:

1. Add to `app.config.ts`:
```typescript
import { MESSAGING_CONFIG, MessagingConfig } from '@ces/messaging';

const messagingConfig: MessagingConfig = {
  apiBaseUrl: 'https://your-api.com',
  wsBaseUrl: 'wss://your-api.com',
  storageApiUrl: 'https://your-storage.com/api'
};

providers: [
  { provide: MESSAGING_CONFIG, useValue: messagingConfig }
]
```

2. Add to `app.component.ts`:
```typescript
import { MessagingOverlayComponent } from '@ces/messaging';

template: `
  <router-outlet></router-outlet>
  <app-messaging-overlay></app-messaging-overlay>
`
```

3. Initialize after login:
```typescript
import { AuthService, Contact } from '@ces/messaging';

this.messagingAuth.setSession(sessionGid, contact);
```

---

## 🔄 Updating the Library

### When You Make Changes:

1. **Make your code changes**
2. **Rebuild the library:**
   ```bash
   cd messaging-library/messaging-app
   npm run build:lib
   ```

3. **Commit and push:**
   ```bash
   git add .
   git commit -m "Update messaging library"
   git push origin main
   ```

4. **Update in consuming projects:**
   ```bash
   cd /path/to/your-angular-app
   npm update @ces/messaging
   ```

   Or force reinstall:
   ```bash
   npm uninstall @ces/messaging
   npm install git+https://github.com/Coreline-Engineering-Solutions/messaging.git#main
   ```

---

## 🏷️ Using Version Tags (Recommended)

### Create Version Tags

```bash
cd messaging-library

# Create a tag
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0

# Create a new version
git tag -a v1.1.0 -m "Release version 1.1.0"
git push origin v1.1.0
```

### Install Specific Version

```bash
npm install git+https://github.com/Coreline-Engineering-Solutions/messaging.git#v1.0.0
```

### In `package.json`:

```json
{
  "dependencies": {
    "@ces/messaging": "git+https://github.com/Coreline-Engineering-Solutions/messaging.git#v1.0.0"
  }
}
```

---

## 📂 Repository Structure

Your Git repository should look like this:

```
messaging-library/
├── .git/
├── .gitignore
├── README.md
├── QUICK_START.md
├── DEVELOPER_INTEGRATION_GUIDE.md
├── ARCHITECTURE.md
├── AI_INTEGRATION_PROMPT.md
├── GIT_INSTALLATION_GUIDE.md
├── examples/
│   ├── README.md
│   ├── app.config.example.ts
│   ├── login.component.example.ts
│   └── ...
└── messaging-app/
    ├── package.json          ← Points to dist/ces-messaging
    ├── ng-package.json
    ├── src/
    │   └── lib/
    │       ├── public-api.ts
    │       ├── services/
    │       ├── components/
    │       └── models/
    └── dist/
        └── ces-messaging/    ← MUST be committed to Git
            ├── package.json
            ├── index.d.ts
            ├── fesm2022/
            └── ...
```

---

## ⚠️ Important Notes

### 1. **Always Commit Built Files**
- The `dist/ces-messaging/` folder MUST be in Git
- This is different from typical development where you ignore `dist/`
- Without it, npm install will fail

### 2. **Rebuild Before Committing**
- Always run `npm run build:lib` before committing changes
- Ensure the built files are up-to-date with your source code

### 3. **Version Management**
- Use Git tags for version control
- Update version in `package.json` before tagging
- Follow semantic versioning (1.0.0, 1.1.0, 2.0.0)

### 4. **Private Repositories**
- If private, users need Git access (SSH keys or tokens)
- Consider using npm private registry for production

---

## 🐛 Troubleshooting

### "Cannot find module '@ces/messaging'"

**Solution:** Check that `dist/ces-messaging/` is committed to Git:
```bash
git ls-files messaging-app/dist/ces-messaging/
```

If empty, build and commit:
```bash
cd messaging-app
npm run build:lib
git add dist/ces-messaging/
git commit -m "Add built library"
git push
```

### "Module not found" after installation

**Solution:** Clear npm cache and reinstall:
```bash
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### Changes not reflecting in consuming app

**Solution:** Force reinstall:
```bash
npm uninstall @ces/messaging
rm -rf node_modules/@ces
npm install git+https://github.com/Coreline-Engineering-Solutions/messaging.git#main
```

---

## 🎯 Quick Reference

### Install from GitHub
```bash
npm install git+https://github.com/Coreline-Engineering-Solutions/messaging.git#main
```

### Install specific version
```bash
npm install git+https://github.com/Coreline-Engineering-Solutions/messaging.git#v1.0.0
```

### Update library
```bash
npm update @ces/messaging
```

### Force reinstall
```bash
npm uninstall @ces/messaging
npm install git+https://github.com/Coreline-Engineering-Solutions/messaging.git#main
```

---

## 📚 Next Steps

1. ✅ Build the library (`npm run build:lib`)
2. ✅ Update `.gitignore` to include `dist/ces-messaging/`
3. ✅ Commit built files to Git
4. ✅ Push to GitHub
5. ✅ Install in your projects using Git URL
6. ✅ Follow `QUICK_START.md` for integration

---

## 🚀 Alternative: Publish to npm Registry

For production use, consider publishing to npm:

```bash
cd messaging-app/dist/ces-messaging
npm publish --access public
```

Then install normally:
```bash
npm install @ces/messaging
```

See npm documentation for publishing packages.

---

**Your library is now installable from Git! 🎉**
