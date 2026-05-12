import { InjectionToken } from '@angular/core';
/**
 * Runtime configuration for REST, WebSocket, and file storage.
 *
 * **WebSocket URL (built by the library)**
 * The client opens:
 * `${wsBaseUrl}/messaging/ws/${contactId}`
 * so `wsBaseUrl` must be the **origin + path prefix** where your server upgrades WebSockets
 * (no trailing slash).
 *
 * **Align `apiBaseUrl` and `wsBaseUrl` path prefixes (e.g. CES / FastAPI under `/api`)**
 * If HTTP messaging lives at `https://host/api` (i.e. `apiBaseUrl` ends with `/api`),
 * use the **same** path prefix for WebSockets, e.g. `wss://host/api`, not `wss://host`
 * unless your gateway intentionally serves WS at the host root.
 *
 * **Numeric `contact_id` vs email**
 * Many backends treat `{contactId}` in paths as a bigint or integer. In that case
 * `Contact.contact_id` must be that **numeric** string (or digits-only), not an email.
 * When your API exposes a lookup (e.g. `GET .../messaging/contacts/by-email?email=...`),
 * resolve that first, then call `setSession` with the returned id. See `createContactFromUser`
 * JSDoc in `messaging.models.ts` and integration guides.
 */
export interface MessagingConfig {
    /**
     * Base URL for messaging REST calls. The library appends `/messaging/...`.
     * Example: `https://api.example.com` or `https://api.example.com/api`.
     */
    apiBaseUrl: string;
    /**
     * Base URL for the messaging WebSocket. Final URL:
     * `${wsBaseUrl}/messaging/ws/${contactId}`.
     * Use the same scheme/host/path prefix as HTTP when your app is behind one gateway (e.g. `wss://host/api` if REST is `https://host/api`).
     */
    wsBaseUrl: string;
    /** Base URL for attachment / storage API (library-specific paths appended). */
    storageApiUrl: string;
    /**
     * Optional hint for `createContactFromUser`: which field on the user object becomes `Contact.contact_id`.
     * Supported values:
     * - `'email'`: use `user.email` (only if your backend accepts email in path/query; many APIs require numeric id)
     * - `'id'`: use `user.id`
     * - `'userId'`: use `user.userId`
     * - `'customId'`: use `user.customId`
     * - any other string: use `user[contactIdHint]`
     *
     * If not provided, `createContactFromUser` defaults `contact_id` from email.
     * For backends that expect bigint contact ids, resolve via by-email (or similar) first,
     * then pass the numeric id via `contactIdHint: 'id'` or build `Contact` manually.
     */
    contactIdHint?: 'email' | 'id' | 'userId' | 'customId' | string;
}
export declare const MESSAGING_CONFIG: InjectionToken<MessagingConfig>;
