export type MessagingRuntimeConfig = {
  apiBaseUrl: string;
  wsBaseUrl: string;
  storageApiUrl?: string;
  /** Defaults to AsyncStorage key `access_token` when omitted. */
  getAccessToken?: () => Promise<string | null>;
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
