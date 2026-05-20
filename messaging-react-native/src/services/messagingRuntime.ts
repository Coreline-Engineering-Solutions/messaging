import AsyncStorage from '@react-native-async-storage/async-storage';
import { getMessagingConfig } from '../configure';

export function getMessagingApiBaseUrl(): string {
  return getMessagingConfig().apiBaseUrl;
}

export function getMessagingWsBaseUrl(): string {
  return getMessagingConfig().wsBaseUrl;
}

export function getMessagingStorageApiUrl(): string {
  const cfg = getMessagingConfig();
  return cfg.storageApiUrl ?? cfg.apiBaseUrl;
}

export async function resolveMessagingAccessToken(): Promise<string | null> {
  const cfg = getMessagingConfig();
  if (cfg.getAccessToken) {
    return cfg.getAccessToken();
  }
  return AsyncStorage.getItem('access_token');
}
