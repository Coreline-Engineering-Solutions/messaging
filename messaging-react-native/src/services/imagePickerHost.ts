export type PickedImage = { uri: string; fileName: string };

export type ImagePickerHostApi = {
  takePhoto: () => Promise<PickedImage | null>;
  pickImage: () => Promise<PickedImage | null>;
};

let host: ImagePickerHostApi | null = null;

export function registerImagePickerHost(api: ImagePickerHostApi): void {
  host = api;
}

export function unregisterImagePickerHost(): void {
  host = null;
}

export function isImagePickerHostReady(): boolean {
  return host !== null;
}

export async function takePhotoFromHost(): Promise<PickedImage | null> {
  if (!host) {
    throw new Error('Image picker host is not mounted');
  }
  return host.takePhoto();
}

export async function pickImageFromHost(): Promise<PickedImage | null> {
  if (!host) {
    throw new Error('Image picker host is not mounted');
  }
  return host.pickImage();
}
