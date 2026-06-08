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

let runtimeConfig: MessagingRuntimeConfig | null = null;

export function configureMessaging(config: MessagingRuntimeConfig): void {
  runtimeConfig = config;
}

export function getMessagingConfig(): MessagingRuntimeConfig {
  if (!runtimeConfig) {
    throw new Error(
      'Messaging is not configured. Call configureMessaging({ apiBaseUrl, wsBaseUrl }) before using the library.'
    );
  }
  return runtimeConfig;
}

export function isMessagingConfigured(): boolean {
  return runtimeConfig !== null;
}
