import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { MESSAGING_CONFIG, MessagingConfig } from '@coreline-engineering-solutions/messaging';
import { routes } from './app.routes';

/**
 * MESSAGING CONFIGURATION
 * 
 * Configure your messaging API endpoints here.
 * These should point to your backend messaging API.
 */
const messagingConfig: MessagingConfig = {
  // REST API base URL (without /messaging suffix)
  apiBaseUrl: 'https://your-backend-api.com',
  
  // WebSocket base URL (without /messaging/ws suffix)
  wsBaseUrl: 'wss://your-backend-api.com',
  
  // File storage API URL for attachments
  storageApiUrl: 'https://your-storage-api.com/api'
};

/**
 * EXAMPLE CONFIGURATIONS FOR DIFFERENT ENVIRONMENTS
 */

// Development (local)
const devMessagingConfig: MessagingConfig = {
  apiBaseUrl: 'http://localhost:8000',
  wsBaseUrl: 'ws://localhost:8000',
  storageApiUrl: 'http://localhost:8000/api'
};

// Staging
const stagingMessagingConfig: MessagingConfig = {
  apiBaseUrl: 'https://staging-api.yourcompany.com',
  wsBaseUrl: 'wss://staging-api.yourcompany.com',
  storageApiUrl: 'https://staging-storage.yourcompany.com/api'
};

// Production
const prodMessagingConfig: MessagingConfig = {
  apiBaseUrl: 'https://api.yourcompany.com',
  wsBaseUrl: 'wss://api.yourcompany.com',
  storageApiUrl: 'https://storage.yourcompany.com/api'
};

/**
 * Select config based on environment
 */
const environment = 'development'; // or 'staging' or 'production'
const selectedConfig = 
  environment === 'production' ? prodMessagingConfig :
  environment === 'staging' ? stagingMessagingConfig :
  devMessagingConfig;

/**
 * APPLICATION CONFIGURATION
 */
export const appConfig: ApplicationConfig = {
  providers: [
    // Router
    provideRouter(routes),
    
    // HTTP Client (required for messaging API calls)
    provideHttpClient(),
    
    // Animations (required for Material components)
    provideAnimations(),
    
    // Messaging Configuration (REQUIRED)
    { provide: MESSAGING_CONFIG, useValue: selectedConfig }
  ]
};
