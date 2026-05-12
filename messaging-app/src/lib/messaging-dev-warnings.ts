/**
 * One-shot dev warnings for common misconfiguration. Safe to call from services;
 * each logical warning fires at most once per process for a given contact id / prefix check.
 */

const warnedEmailLikeContactIds = new Set<string>();
let warnedWsApiPrefixMismatch = false;

export function warnEmailLikeContactId(contactId: string | null | undefined): void {
  if (!contactId?.includes('@')) return;
  if (warnedEmailLikeContactIds.has(contactId)) return;
  warnedEmailLikeContactIds.add(contactId);
  console.warn(
    '[@coreline-engineering-solutions/messaging] contact_id looks like an email. Many backends expect a numeric contact id in REST paths and WebSockets. Resolve the numeric id first when your API supports it (for example GET .../messaging/contacts/by-email?email=...), then set Contact.contact_id to that value.'
  );
}

export function warnIfWsBaseUrlMissingApiPrefixWhenApiHasIt(
  apiBaseUrl: string | undefined,
  wsBaseUrl: string | undefined
): void {
  if (warnedWsApiPrefixMismatch) return;
  const api = apiBaseUrl ?? '';
  const ws = wsBaseUrl ?? '';
  if (!api.includes('/api') || ws.includes('/api')) return;
  warnedWsApiPrefixMismatch = true;
  console.warn(
    '[@coreline-engineering-solutions/messaging] apiBaseUrl includes "/api" but wsBaseUrl does not. If REST is mounted under /api, wsBaseUrl should usually use the same URL path prefix (e.g. wss://your-host/api). Some deployments mount WebSockets at the root; this is only a warning.'
  );
}
