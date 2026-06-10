import { InjectionToken } from '@angular/core';
/**
 * Runtime configuration for REST, WebSocket, and file storage.
 *
 * **WebSocket URL (built by the library)**
 * The client opens:
 * `${wsBaseUrl}/messaging/ws/${contactId}` and then sends
 * `{ type: 'auth', session_gid }` as the first WebSocket message.
 * so `wsBaseUrl` must be the **origin + path prefix** where your server upgrades WebSockets
 * (no trailing slash).
 *
 * **Align `apiBaseUrl` and `wsBaseUrl` path prefixes (e.g. CES / FastAPI under `/api`)**
 * If HTTP messaging lives at `https://host/api` (i.e. `apiBaseUrl` ends with `/api`),
 * use the **same** path prefix for WebSockets, e.g. `wss://host/api`, not `wss://host`
 * unless your gateway intentionally serves WS at the host root.
 *
 * **Session-based identity**
 * The current CES messaging API resolves the contact with `GET /messaging/auth/me`
 * and `X-Messaging-Session`; host apps should not look up contacts by email or put
 * session IDs in query strings.
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
     * The client authenticates with `{ type: 'auth', session_gid }` after connect.
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
     * Prefer `AuthService.refreshMessagingSession()` when using the current CES API;
     * it resolves the canonical numeric contact id from `/messaging/auth/me`.
     */
    contactIdHint?: 'email' | 'id' | 'userId' | 'customId' | string;
    /**
     * Enables GIS project-group UI, including the Projects tab and project-scoped
     * group member management. Keep disabled for non-GIS host apps.
     */
    enableProjectGroups?: boolean;
}
export declare const MESSAGING_CONFIG: InjectionToken<MessagingConfig>;
