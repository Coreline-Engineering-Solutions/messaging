# Versioning and Git tags

## Rules

- **Semantic versioning** (`MAJOR.MINOR.PATCH`) in:
  - Root `package.json` (what consumers install from Git/npm).
  - `messaging-app/package.json` (must match before `npm run build:lib` so `dist/ces-messaging/package.json` is correct).
- **Git tag** = `v` + the same version, e.g. **`v1.0.7`** for package version **`1.0.7`**.

## Install by tag

```bash
npm install git+https://github.com/Coreline-Engineering-Solutions/messaging.git#v1.0.7 --legacy-peer-deps
```

Use your fork URL if different.

## Release checklist (maintainers)

1. Bump `version` in **root** and **`messaging-app/package.json`**.
2. From repo root: **`npm run build:lib`** (refreshes `messaging-app/dist/ces-messaging`).
3. Update **`CHANGELOG.md`**.
4. Commit: `git add -A && git commit -m "chore: release vX.Y.Z"`.
5. Tag: `git tag -a vX.Y.Z -m "Release vX.Y.Z"`.
6. Push branch and tags: `git push origin <branch> && git push origin vX.Y.Z`.

CI (`.github/workflows/ci.yml`) must be green before tagging.
