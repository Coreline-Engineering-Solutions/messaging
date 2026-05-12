/**
 * One-shot dev warnings for common misconfiguration. Safe to call from services;
 * each logical warning fires at most once per process for a given contact id / prefix check.
 */
export declare function warnEmailLikeContactId(contactId: string | null | undefined): void;
export declare function warnIfWsBaseUrlMissingApiPrefixWhenApiHasIt(apiBaseUrl: string | undefined, wsBaseUrl: string | undefined): void;
