import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { MESSAGING_CONFIG, MessagingConfig } from '../lib/messaging.config';
import { environment } from '../environments/environment';

import { routes } from './app.routes';

const messagingConfig: MessagingConfig = {
  apiBaseUrl: `${environment.apiBaseUrl.replace(/\/$/, '')}/api`,
  wsBaseUrl: `${environment.wsBaseUrl.replace(/\/$/, '')}/api`,
  storageApiUrl: `${environment.apiBaseUrl.replace(/\/$/, '')}/api`,
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
    provideAnimations(),
    { provide: MESSAGING_CONFIG, useValue: messagingConfig },
  ],
};
