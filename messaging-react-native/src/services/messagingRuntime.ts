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

let currentSessionGid: string | null = null;

export function setMessagingSessionGid(sessionGid: string | null): void {
  currentSessionGid = sessionGid;
}

export async function resolveMessagingSessionGid(): Promise<string | null> {
  if (currentSessionGid) return currentSessionGid;
  const cfg = getMessagingConfig();
  if (cfg.getSessionGid) {
    return cfg.getSessionGid();
  }
  return AsyncStorage.getItem('session_gid');
}

export async function getMessagingSessionHeaders(): Promise<Record<string, string>> {
  const sessionGid = await resolveMessagingSessionGid();
  return sessionGid ? { 'X-Messaging-Session': sessionGid } : {};
}
