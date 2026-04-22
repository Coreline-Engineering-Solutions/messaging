import { InjectionToken } from '@angular/core';

export interface MessagingConfig {
  apiBaseUrl: string;
  wsBaseUrl: string;
  storageApiUrl: string;
  /**
   * Optional hint for auto-detecting contact_id from user data.
   * Supported values:
   * - 'email': Use user's email as contact_id (recommended)
   * - 'id': Use user's id field as contact_id
   * - 'userId': Use user's userId field as contact_id
   * - 'customId': Use user's customId field as contact_id
   * 
   * If not provided, you must manually set contact_id in the Contact object.
   * 
   * @example
   * const config: MessagingConfig = {
   *   apiBaseUrl: 'https://api.example.com',
   *   wsBaseUrl: 'wss://api.example.com',
   *   storageApiUrl: 'https://storage.example.com/api',
   *   contactIdHint: 'email'  // Auto-detect from user.email
   * };
   */
  contactIdHint?: 'email' | 'id' | 'userId' | 'customId' | string;
}

export const MESSAGING_CONFIG = new InjectionToken<MessagingConfig>('MESSAGING_CONFIG');
