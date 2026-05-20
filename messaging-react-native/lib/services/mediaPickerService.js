"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.pickImage = pickImage;
exports.takePhoto = takePhoto;
exports.pickMultipleImages = pickMultipleImages;
const ImagePicker = __importStar(require("expo-image-picker"));
const react_native_1 = require("react-native");
let isImagePickerActive = false;
/**
 * Android: launching from Alert callbacks leaves ActivityResultLauncher unregistered.
 * Wait until UI transitions finish before opening camera/library.
 */
function waitForPickerReady() {
    return new Promise((resolve) => {
        react_native_1.InteractionManager.runAfterInteractions(() => {
            const delay = react_native_1.Platform.OS === 'android' ? 400 : 50;
            setTimeout(resolve, delay);
        });
    });
}
/** Android 13+ uses system photo picker; broad READ_MEDIA_* / storage read not used for library pick. */
function needsMediaLibraryPermissionRequest() {
    if (react_native_1.Platform.OS === 'ios')
        return true;
    if (react_native_1.Platform.OS === 'android') {
        return typeof react_native_1.Platform.Version !== 'number' || react_native_1.Platform.Version < 33;
    }
    return true;
}
async function pickImage() {
    try {
        if (isImagePickerActive) {
            console.warn('[pickImage] Skipping launch: picker already active');
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
                console.warn('[pickImage] Asset URI is undefined');
                return null;
            }
            const fileName = asset.uri.split('/').pop() || `photo_${Date.now()}.jpg`;
            return { uri: asset.uri, fileName };
        }
        return null;
    }
    finally {
        isImagePickerActive = false;
    }
}
async function takePhoto() {
    try {
        if (isImagePickerActive) {
            console.warn('[takePhoto] Skipping launch: picker already active');
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
        if (result.canceled)
            return null;
        if (!result.assets || result.assets.length === 0) {
            console.warn('[takePhoto] No assets returned from camera');
            return null;
        }
        const asset = result.assets[0];
        if (!asset?.uri) {
            console.warn('[takePhoto] Asset URI is undefined');
            throw new Error('Camera did not return a valid image. This may happen on emulators without camera support.');
        }
        return { uri: asset.uri, fileName: `photo_${Date.now()}.jpg` };
    }
    catch (error) {
        console.error('[takePhoto] Error:', error);
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes('cancelled') || msg.includes('canceled')) {
            return null;
        }
        throw new Error(msg || 'Camera failed. On emulators, use Photo Library instead.');
    }
    finally {
        isImagePickerActive = false;
    }
}
async function pickMultipleImages(max = 5) {
    try {
        if (isImagePickerActive)
            return [];
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
        if (result.canceled || !result.assets?.length)
            return [];
        return result.assets
            .filter((a) => a.uri)
            .map((asset, i) => ({
            uri: asset.uri,
            fileName: asset.uri.split('/').pop() || `photo_${Date.now()}_${i}.jpg`,
        }));
    }
    finally {
        isImagePickerActive = false;
    }
}
