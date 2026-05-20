import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { MESSAGING_CONFIG, MessagingConfig } from '@coreline-engineering-solutions/messaging';

import { routes } from './app.routes';

const messagingConfig: MessagingConfig = {
  apiBaseUrl: 'https://ces-ticketing-system-db.onrender.com/api',
  wsBaseUrl: 'wss://ces-ticketing-system-db.onrender.com/api',
  storageApiUrl: 'https://ces-ticketing-system-db.onrender.com/api'
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
    provideAnimations(),
    { provide: MESSAGING_CONFIG, useValue: messagingConfig }
  ]
};
