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
exports.MessagingImagePickerHost = MessagingImagePickerHost;
const ImagePicker = __importStar(require("expo-image-picker"));
const react_1 = require("react");
const react_native_1 = require("react-native");
const imagePickerHost_1 = require("../services/imagePickerHost");
function waitForActivityReady() {
    return new Promise((resolve) => {
        react_native_1.InteractionManager.runAfterInteractions(() => {
            setTimeout(resolve, react_native_1.Platform.OS === 'android' ? 350 : 0);
        });
    });
}
function assetToPicked(asset) {
    if (!asset?.uri)
        return null;
    const fileName = asset.fileName || asset.uri.split('/').pop() || `photo_${Date.now()}.jpg`;
    return { uri: asset.uri, fileName };
}
/**
 * Mount at tab root so expo-image-picker registers ActivityResultLauncher
 * (fixes Android IllegalStateException when launching from overlays).
 */
function MessagingImagePickerHost() {
    const [cameraPermission, requestCameraPermission] = ImagePicker.useCameraPermissions();
    const [libraryPermission, requestLibraryPermission] = ImagePicker.useMediaLibraryPermissions();
    const takePhoto = (0, react_1.useCallback)(async () => {
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
        if (result.canceled || !result.assets?.length)
            return null;
        return assetToPicked(result.assets[0]);
    }, [cameraPermission, requestCameraPermission]);
    const pickImage = (0, react_1.useCallback)(async () => {
        if (react_native_1.Platform.OS === 'ios' || (typeof react_native_1.Platform.Version === 'number' && react_native_1.Platform.Version < 33)) {
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
        if (result.canceled || !result.assets?.length)
            return null;
        return assetToPicked(result.assets[0]);
    }, [libraryPermission, requestLibraryPermission]);
    (0, react_1.useEffect)(() => {
        (0, imagePickerHost_1.registerImagePickerHost)({ takePhoto, pickImage });
        return () => (0, imagePickerHost_1.unregisterImagePickerHost)();
    }, [takePhoto, pickImage]);
    return null;
}
