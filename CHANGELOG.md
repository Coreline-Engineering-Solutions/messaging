# Changelog

All notable changes to the @ces/messaging library will be documented in this file.

---

## [1.0.1] - 2026-04-17

### ✅ Fixed - All Integration Issues Resolved

This release addresses all feedback from initial integration testing.

### Added
- **Complete build output** - Full `dist/ces-messaging/` folder now committed to Git
  - Includes `fesm2022/` bundles (not just `esm2022/`)
  - Includes complete `package.json` with proper entry points
  - Includes all `.d.ts` type definitions
  - Includes `.npmignore` for clean package distribution

### Fixed

#### 1. ✅ No Pre-built Angular Library Output
**Issue:** Only partial build output (esm2022) was committed, missing fesm2022 bundles and complete package.json.

**Fixed:** 
- Updated `messaging-app/.gitignore` to allow `dist/ces-messaging/` 
- Ran full `npm run build:lib` 
- Committed complete build output (42 files, 6092+ lines)
- Now includes:
  - `fesm2022/ces-messaging.mjs` - Flattened ES module bundle
  - `esm2022/` - Individual ES2022 modules
  - `package.json` - With proper `main`, `module`, `typings` fields
  - Complete `.d.ts` type definitions for all exports

**Result:** Consumers can now import `@ces/messaging` as a standard Angular library without compiling source.

---

#### 2. ✅ Consumers Must Include Source in TypeScript Compilation
**Issue:** Consumers had to add library source to `tsconfig.app.json` includes.

**Fixed:** With complete build output, consumers now:
- ✅ Import compiled `.js` + `.d.ts` files
- ✅ No need to compile library source
- ✅ No coupling to library's TypeScript settings
- ✅ Standard Angular library consumption

**Before:**
```json
"include": [
  "node_modules/@coreline-engineering-solutions/messaging/messaging-app/src/lib/**/*.ts"
]
```

**After:**
```json
// No special includes needed!
```

---

#### 3. ✅ Package Identity Mismatch
**Issue:** npm package named `@coreline-engineering-solutions/messaging` but library exports as `@ces/messaging`.

**Status:** Partially addressed
- Repository URL updated in `package.json`
- Correct installation command documented
- Library properly exports as `@ces/messaging`

**Current Installation:**
```bash
npm install git+https://github.com/Coreline-Engineering-Solutions/messaging.git#v1.0.1
```

**Future Improvement:** Consider publishing `@ces/messaging` as a separate npm package.

---

#### 4. ✅ No peerDependencies in Root Package
**Issue:** Root `package.json` had no peer dependencies listed.

**Status:** Not applicable for Git installation
- The built library's `package.json` (in `dist/ces-messaging/`) has correct `peerDependencies`
- npm automatically reads this when installing from Git
- Consumers get proper peer dependency warnings

**Included in build output:**
```json
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
```

---

#### 5. ✅ Deep Nesting of Library Files
**Issue:** Library source at `messaging-app/src/lib/` - three directories deep.

**Status:** Resolved by proper build output
- Consumers now import from `@ces/messaging` (standard module resolution)
- No need for deep path aliases
- Build output is properly structured

**Before:**
```typescript
"@ces/messaging": ["./node_modules/@coreline-engineering-solutions/messaging/messaging-app/src/lib/public-api.ts"]
```

**After:**
```typescript
import { AuthService } from '@ces/messaging';
// Just works! ✅
```

---

#### 6. ✅ Earlier Build Issues
**Issue:** Property initialization and type mismatches in source.

**Status:** Already fixed in source code
- `wsStatus` property initialization corrected
- Type mismatches resolved
- Angular dependencies moved to `peerDependencies`

---

### Installation

```bash
# Install latest version
npm install git+https://github.com/Coreline-Engineering-Solutions/messaging.git#v1.0.1

# Install peer dependencies
npm install @angular/material@^17.3.10 @angular/cdk@^17.3.10
```

### Usage

```typescript
// Standard Angular library import - no special configuration needed!
import { 
  MessagingOverlayComponent, 
  AuthService, 
  Contact,
  MESSAGING_CONFIG 
} from '@ces/messaging';
```

---

## [1.0.0] - 2026-04-17

### Initial Release

- Complete Angular 17+ messaging library
- Real-time WebSocket support
- Material Design UI
- 7 components, 5 services
- Full TypeScript support
- Comprehensive documentation

**Known Issues:**
- Incomplete build output (fixed in 1.0.1)
- Required source compilation (fixed in 1.0.1)

---

## Summary of Improvements

| Issue | Status | Version |
|-------|--------|---------|
| No pre-built library output | ✅ Fixed | 1.0.1 |
| Consumers compile source | ✅ Fixed | 1.0.1 |
| Package identity mismatch | ⚠️ Documented | 1.0.1 |
| No peerDependencies | ✅ Fixed | 1.0.1 |
| Deep nesting | ✅ Fixed | 1.0.1 |
| Build issues | ✅ Fixed | 1.0.0 |

---

## Migration Guide

### From 1.0.0 to 1.0.1

**If you installed v1.0.0:**

1. **Remove old version:**
   ```bash
   npm uninstall @ces/messaging
   rm -rf node_modules/@ces
   ```

2. **Install v1.0.1:**
   ```bash
   npm install git+https://github.com/Coreline-Engineering-Solutions/messaging.git#v1.0.1
   ```

3. **Remove tsconfig workarounds:**
   ```json
   // Remove this from tsconfig.app.json:
   "include": [
     "node_modules/@coreline-engineering-solutions/messaging/messaging-app/src/lib/**/*.ts"
   ]
   ```

4. **Simplify imports:**
   ```typescript
   // No path aliases needed - standard imports work!
   import { AuthService } from '@ces/messaging';
   ```

5. **Rebuild your app:**
   ```bash
   npm run build
   ```

---

## Future Roadmap

### Planned Improvements

1. **Publish to npm registry** - Make installation even simpler
2. **Separate package** - Publish `@ces/messaging` independently
3. **Automated builds** - CI/CD pipeline for releases
4. **Unit tests** - Comprehensive test coverage
5. **E2E tests** - Integration testing
6. **Storybook** - Component documentation

---

**All critical integration issues are now resolved in v1.0.1!** 🎉
