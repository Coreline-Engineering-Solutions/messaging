export type PickedImage = {
    uri: string;
    fileName: string;
};
export type ImagePickerHostApi = {
    takePhoto: () => Promise<PickedImage | null>;
    pickImage: () => Promise<PickedImage | null>;
};
export declare function registerImagePickerHost(api: ImagePickerHostApi): void;
export declare function unregisterImagePickerHost(): void;
export declare function isImagePickerHostReady(): boolean;
export declare function takePhotoFromHost(): Promise<PickedImage | null>;
export declare function pickImageFromHost(): Promise<PickedImage | null>;
//# sourceMappingURL=imagePickerHost.d.ts.map