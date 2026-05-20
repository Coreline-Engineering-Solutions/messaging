import * as Haptics from 'expo-haptics';

/** Inbound message feedback (haptic; no bundled sound asset). */
export async function playMessagingNotificationSound(): Promise<void> {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    /* ignore */
  }
}
