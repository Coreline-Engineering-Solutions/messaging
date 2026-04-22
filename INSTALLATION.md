# Installation Guide

## Quick Install

Install the messaging library from GitHub:

```bash
npm install git+https://github.com/Coreline-Engineering-Solutions/messaging.git
```

## Install Specific Version

Install a specific version or branch:

```bash
# Latest main branch
npm install git+https://github.com/Coreline-Engineering-Solutions/messaging.git#main

# Specific version tag
npm install git+https://github.com/Coreline-Engineering-Solutions/messaging.git#v1.0.6
```

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
