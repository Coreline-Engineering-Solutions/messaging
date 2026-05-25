export type MessagingRuntimeConfig = {
    apiBaseUrl: string;
    wsBaseUrl: string;
    /**
     * @deprecated Ignored for attachment upload/retrieve. Storage uses `apiBaseUrl` (same as Angular web package).
     */
    storageApiUrl?: string;
    /** Defaults to AsyncStorage key `access_token` when omitted. */
    getAccessToken?: () => Promise<string | null>;
};
export declare function configureMessaging(config: MessagingRuntimeConfig): void;
export declare function getMessagingConfig(): MessagingRuntimeConfig;
export declare function isMessagingConfigured(): boolean;
//# sourceMappingURL=configure.d.ts.map