import { InjectionToken } from '@angular/core';
export interface MessagingConfig {
    apiBaseUrl: string;
    wsBaseUrl: string;
    storageApiUrl: string;
}
export declare const MESSAGING_CONFIG: InjectionToken<MessagingConfig>;
