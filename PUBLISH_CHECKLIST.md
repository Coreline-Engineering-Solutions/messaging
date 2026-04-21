# Publishing Checklist - Make Library Available from Git

Follow these steps to make your library installable from Git.

---

## ✅ Pre-Publishing Checklist

### 1. Build the Library
```bash
cd messaging-app
npm install
npm run build:lib
```

**Verify:** Check that `messaging-app/dist/ces-messaging/` exists and contains:
- `package.json`
- `index.d.ts`
- `fesm2022/` folder
- Other compiled files

---

### 2. Update `.gitignore`

**Current `.gitignore`** should NOT ignore the built library.

Check your root `.gitignore`:
```bash
cat .gitignore
```

**Option A:** Comment out dist ignore:
```
# dist/  ← Comment this out
```

**Option B:** Be specific:
```
# Ignore all dist except library build
dist/*
!messaging-app/dist/ces-messaging/
```

---

### 3. Update `package.json`

Already done! ✅ Your `messaging-app/package.json` now has:
- ✅ `"private": false`
- ✅ `"repository"` field
- ✅ `"description"` field
- ✅ `"author"` field
- ✅ `"license"` field

Already configured with the correct repository URL:
```json
"repository": {
  "type": "git",
  "url": "https://github.com/Coreline-Engineering-Solutions/messaging.git"
}
```

---

### 4. Commit Built Files

```bash
# From repository root
git add messaging-app/dist/ces-messaging/
git add messaging-app/package.json
git commit -m "Prepare library for Git installation"
```

---

### 5. Push to GitHub

```bash
git push origin main
```

---

### 6. Create Version Tag (Recommended)

```bash
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0
```

---

## 🚀 Installation in Other Projects

Once published, install in any Angular project:

```bash
npm install git+https://github.com/Coreline-Engineering-Solutions/messaging.git#main
```

Or with version tag:
```bash
npm install git+https://github.com/Coreline-Engineering-Solutions/messaging.git#v1.0.0
```

---

## 🔄 Updating the Library

When you make changes:

1. **Make code changes** in `messaging-app/src/`
2. **Rebuild:**
   ```bash
   cd messaging-app
   npm run build:lib
   ```
3. **Update version** in `messaging-app/package.json`:
   ```json
   "version": "1.1.0"
   ```
4. **Commit:**
   ```bash
   git add .
   git commit -m "Update to v1.1.0"
   ```
5. **Tag:**
   ```bash
   git tag -a v1.1.0 -m "Release version 1.1.0"
   ```
6. **Push:**
   ```bash
   git push origin main
   git push origin v1.1.0
   ```

---

## 📋 Quick Commands

### Build and Publish
```bash
# Build
cd messaging-app && npm run build:lib && cd ..

# Commit
git add .
git commit -m "Update library"

# Tag
git tag -a v1.0.0 -m "Release v1.0.0"

# Push
git push origin main --tags
```

### Install in Project
```bash
npm install git+https://github.com/Coreline-Engineering-Solutions/messaging.git#v1.0.0
```

---

## ⚠️ Important Notes

1. **Always rebuild before committing** - Built files must match source code
2. **Commit dist folder** - Unlike typical projects, you MUST commit `dist/ces-messaging/`
3. **Use version tags** - Makes it easy to install specific versions
4. **Update package.json version** - Keep version in sync with Git tags

---

## ✅ Verification

After pushing, verify your library is accessible:

```bash
# Test installation in a temporary directory
mkdir test-install
cd test-install
npm init -y
npm install git+https://github.com/Coreline-Engineering-Solutions/messaging.git#main
```

If successful, you should see `@ces/messaging` in `node_modules/`.

---

## 🎯 Current Status

- [x] Library built
- [x] `package.json` updated
- [ ] `.gitignore` updated (check this)
- [ ] Built files committed
- [ ] Pushed to GitHub
- [ ] Version tag created
- [ ] Tested installation

---

**See `GIT_INSTALLATION_GUIDE.md` for complete details.**
