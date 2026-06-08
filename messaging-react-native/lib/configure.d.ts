export type MessagingRuntimeConfig = {
    apiBaseUrl: string;
    wsBaseUrl: string;
    /**
     * @deprecated Ignored for attachment upload/retrieve. Storage uses `apiBaseUrl` (same as Angular web package).
     */
    storageApiUrl?: string;
    /** Return the current auth session id. Defaults to AsyncStorage key `session_gid` when omitted. */
    getSessionGid?: () => Promise<string | null>;
};
export declare function configureMessaging(config: MessagingRuntimeConfig): void;
export declare function getMessagingConfig(): MessagingRuntimeConfig;
export declare function isMessagingConfigured(): boolean;
//# sourceMappingURL=configure.d.ts.map