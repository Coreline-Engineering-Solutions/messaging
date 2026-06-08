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
}
