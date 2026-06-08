import * as ImagePicker from 'expo-image-picker';
import { InteractionManager, Platform } from 'react-native';

let isImagePickerActive = false;

/**
 * Android: launching from Alert callbacks leaves ActivityResultLauncher unregistered.
 * Wait until UI transitions finish before opening camera/library.
 */
function waitForPickerReady(): Promise<void> {
  return new Promise((resolve) => {
    InteractionManager.runAfterInteractions(() => {
      const delay = Platform.OS === 'android' ? 400 : 50;
      setTimeout(resolve, delay);
    });
  });
}

/** Android 13+ uses system photo picker; broad READ_MEDIA_* / storage read not used for library pick. */
function needsMediaLibraryPermissionRequest(): boolean {
  if (Platform.OS === 'ios') return true;
  if (Platform.OS === 'android') {
    return typeof Platform.Version !== 'number' || Platform.Version < 33;
  }
  return true;
}

export async function pickImage(): Promise<{ uri: string; fileName: string } | null> {
  try {
    if (isImagePickerActive) {
      return null;
    }

    if (needsMediaLibraryPermissionRequest()) {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        throw new Error('Permission to access media library is required');
      }
    }

    await waitForPickerReady();
    isImagePickerActive = true;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.5,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      if (!asset?.uri) {
        return null;
      }
      const fileName = asset.uri.split('/').pop() || `photo_${Date.now()}.jpg`;
      return { uri: asset.uri, fileName };
    }

    return null;
  } finally {
    isImagePickerActive = false;
  }
}

export async function takePhoto(): Promise<{ uri: string; fileName: string } | null> {
  try {
    if (isImagePickerActive) {
      return null;
    }

    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) {
      throw new Error('Permission to access camera is required');
    }

    await waitForPickerReady();
    isImagePickerActive = true;
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.3,
    });

    if (result.canceled) return null;
    if (!result.assets || result.assets.length === 0) {
      return null;
    }

    const asset = result.assets[0];
    if (!asset?.uri) {
      throw new Error('Camera did not return a valid image. This may happen on emulators without camera support.');
    }

    return { uri: asset.uri, fileName: `photo_${Date.now()}.jpg` };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('cancelled') || msg.includes('canceled')) {
      return null;
    }
    throw new Error(msg || 'Camera failed. On emulators, use Photo Library instead.');
  } finally {
    isImagePickerActive = false;
  }
}

export async function pickMultipleImages(
  max = 5
): Promise<{ uri: string; fileName: string }[]> {
  try {
    if (isImagePickerActive) return [];

    if (needsMediaLibraryPermissionRequest()) {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        throw new Error('Permission to access media library is required');
      }
    }

    await waitForPickerReady();
    isImagePickerActive = true;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: max,
      allowsEditing: false,
      quality: 0.5,
    });

    if (result.canceled || !result.assets?.length) return [];

    return result.assets
      .filter((a) => a.uri)
      .map((asset, i) => ({
        uri: asset.uri!,
        fileName: asset.uri!.split('/').pop() || `photo_${Date.now()}_${i}.jpg`,
      }));
  } finally {
    isImagePickerActive = false;
  }
}

