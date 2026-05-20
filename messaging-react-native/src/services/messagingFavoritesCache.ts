import AsyncStorage from '@react-native-async-storage/async-storage';
import { MESSAGING_FAVORITES_KEY_PREFIX } from '../constants/messagingConfig';

function storageKey(contactId: string): string {
  return `${MESSAGING_FAVORITES_KEY_PREFIX}${contactId}`;
}

export async function loadFavoriteConversationIds(contactId: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(contactId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(String);
  } catch {
    return [];
  }
}

export async function persistFavoriteConversationIds(
  contactId: string,
  conversationIds: string[]
): Promise<void> {
  try {
    await AsyncStorage.setItem(storageKey(contactId), JSON.stringify(conversationIds));
  } catch {
    /* ignore */
  }
}
