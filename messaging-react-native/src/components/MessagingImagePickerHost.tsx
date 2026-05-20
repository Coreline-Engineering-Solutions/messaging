import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect } from 'react';
import { InteractionManager, Platform } from 'react-native';
import {
  registerImagePickerHost,
  unregisterImagePickerHost,
  type PickedImage,
} from '../services/imagePickerHost';

function waitForActivityReady(): Promise<void> {
  return new Promise((resolve) => {
    InteractionManager.runAfterInteractions(() => {
      setTimeout(resolve, Platform.OS === 'android' ? 350 : 0);
    });
  });
}

function assetToPicked(asset: ImagePicker.ImagePickerAsset): PickedImage | null {
  if (!asset?.uri) return null;
  const fileName = asset.fileName || asset.uri.split('/').pop() || `photo_${Date.now()}.jpg`;
  return { uri: asset.uri, fileName };
}

/**
 * Mount at tab root so expo-image-picker registers ActivityResultLauncher
 * (fixes Android IllegalStateException when launching from overlays).
 */
export function MessagingImagePickerHost() {
  const [cameraPermission, requestCameraPermission] = ImagePicker.useCameraPermissions();
  const [libraryPermission, requestLibraryPermission] = ImagePicker.useMediaLibraryPermissions();

  const takePhoto = useCallback(async (): Promise<PickedImage | null> => {
    if (!cameraPermission?.granted) {
      const res = await requestCameraPermission();
      if (!res.granted) {
        throw new Error('Camera permission is required');
      }
    }
    await waitForActivityReady();
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.5,
    });
    if (result.canceled || !result.assets?.length) return null;
    return assetToPicked(result.assets[0]);
  }, [cameraPermission, requestCameraPermission]);

  const pickImage = useCallback(async (): Promise<PickedImage | null> => {
    if (Platform.OS === 'ios' || (typeof Platform.Version === 'number' && Platform.Version < 33)) {
      if (!libraryPermission?.granted) {
        const res = await requestLibraryPermission();
        if (!res.granted) {
          throw new Error('Photo library permission is required');
        }
      }
    }
    await waitForActivityReady();
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.5,
    });
    if (result.canceled || !result.assets?.length) return null;
    return assetToPicked(result.assets[0]);
  }, [libraryPermission, requestLibraryPermission]);

  useEffect(() => {
    registerImagePickerHost({ takePhoto, pickImage });
    return () => unregisterImagePickerHost();
  }, [takePhoto, pickImage]);

  return null;
}
