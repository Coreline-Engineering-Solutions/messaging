import { InjectionToken } from '@angular/core';

export interface MessagingConfig {
  apiBaseUrl: string;
  wsBaseUrl: string;
  storageApiUrl: string;
}

export const MESSAGING_CONFIG = new InjectionToken<MessagingConfig>('MESSAGING_CONFIG');
