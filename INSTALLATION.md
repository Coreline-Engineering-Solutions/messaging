# Installation Guide

## Quick Install

Install the messaging library from GitHub:

```bash
npm install git+https://github.com/Coreline-Engineering-Solutions/messaging.git#main --legacy-peer-deps
```

## Install from Branch

Install from a specific branch:

```bash
# Latest main branch (recommended)
npm install git+https://github.com/Coreline-Engineering-Solutions/messaging.git#main --legacy-peer-deps

# Other branches
npm install git+https://github.com/Coreline-Engineering-Solutions/messaging.git#develop --legacy-peer-deps
```

## Note on --legacy-peer-deps

The `--legacy-peer-deps` flag is recommended because:
- Library supports Angular 17-21+
- Your project may use Angular 21.2.9 or later
- npm strict mode may flag minor version differences
- This flag allows compatible versions to install without errors

## Import in Your Code

After installation, import components and services:

```typescript
import { 
  MessagingOverlayComponent, 
  AuthService,
  MessagingConfig,
  MESSAGING_CONFIG,
  Contact
} from '@coreline-engineering-solutions/messaging';
```

## Peer Dependencies

The library requires:
- Angular 17-21+
- @angular/material 17-21+
- @angular/cdk 17-21+
- RxJS 7.8+ or 8.0+

These will be installed automatically with npm.

## Next Steps

1. See [QUICK_START.md](QUICK_START.md) for 5-minute integration
2. See [DEVELOPER_INTEGRATION_GUIDE.md](DEVELOPER_INTEGRATION_GUIDE.md) for complete setup
3. See [ARCHITECTURE.md](ARCHITECTURE.md) for system overview
