"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerImagePickerHost = registerImagePickerHost;
exports.unregisterImagePickerHost = unregisterImagePickerHost;
exports.isImagePickerHostReady = isImagePickerHostReady;
exports.takePhotoFromHost = takePhotoFromHost;
exports.pickImageFromHost = pickImageFromHost;
let host = null;
function registerImagePickerHost(api) {
    host = api;
}
function unregisterImagePickerHost() {
    host = null;
}
function isImagePickerHostReady() {
    return host !== null;
}
async function takePhotoFromHost() {
    if (!host) {
        throw new Error('Image picker host is not mounted');
    }
    return host.takePhoto();
}
async function pickImageFromHost() {
    if (!host) {
        throw new Error('Image picker host is not mounted');
    }
    return host.pickImage();
}
