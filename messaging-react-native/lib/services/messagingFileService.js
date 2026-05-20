"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCachedMessagingMediaUrl = getCachedMessagingMediaUrl;
exports.getMessagingMediaUrl = getMessagingMediaUrl;
exports.prewarmMessagingMediaCache = prewarmMessagingMediaCache;
exports.deleteMessagingFile = deleteMessagingFile;
exports.uploadMessagingImage = uploadMessagingImage;
exports.uploadMessagingImages = uploadMessagingImages;
const react_native_1 = require("react-native");
const messagingRuntime_1 = require("./messagingRuntime");
const messagingHelpers_1 = require("../utils/messagingHelpers");
const UPLOAD_PATHS = [
    '/storage/upload',
    '/messaging/storage/upload',
    '/messaging/attachments/upload',
    '/messaging/files/upload',
];
const RETRIEVE_PATHS = [
    '/storage/retrieve',
    '/messaging/storage/retrieve',
    '/messaging/files/retrieve',
];
const DELETE_PATHS = [
    '/storage/delete',
    '/messaging/storage/delete',
    '/messaging/files/delete',
];
const mediaCache = new Map();
function getMimeType(fileName) {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'png')
        return 'image/png';
    if (ext === 'gif')
        return 'image/gif';
    if (ext === 'webp')
        return 'image/webp';
    if (ext === 'mp4')
        return 'video/mp4';
    if (ext === 'pdf')
        return 'application/pdf';
    return 'image/jpeg';
}
async function authHeaders() {
    const token = await (0, messagingRuntime_1.resolveMessagingAccessToken)();
    const headers = {};
    if (token)
        headers.Authorization = `Bearer ${token}`;
    return headers;
}
async function tryPostEndpoints(paths, bodyFn) {
    const base = (0, messagingRuntime_1.getMessagingStorageApiUrl)().replace(/\/+$/, '');
    let lastError = null;
    for (const path of paths) {
        try {
            const response = await fetch(`${base}${path}`, {
                method: 'POST',
                body: bodyFn(),
                headers: await authHeaders(),
            });
            if (response.status === 404 && paths.indexOf(path) < paths.length - 1)
                continue;
            if (!response.ok) {
                lastError = new Error(`Request failed: HTTP ${response.status}`);
                continue;
            }
            return (await response.json());
        }
        catch (e) {
            lastError = e instanceof Error ? e : new Error(String(e));
        }
    }
    throw lastError ?? new Error('Storage request failed');
}
function getCachedMessagingMediaUrl(fileId) {
    if ((0, messagingHelpers_1.isTempMessageId)(fileId))
        return null;
    return mediaCache.get(fileId) ?? null;
}
async function getMessagingMediaUrl(fileId) {
    if ((0, messagingHelpers_1.isTempMessageId)(fileId)) {
        throw new Error('Upload not complete');
    }
    const cached = mediaCache.get(fileId);
    if (cached)
        return cached;
    const data = await tryPostEndpoints(RETRIEVE_PATHS, () => {
        const fd = new FormData();
        fd.append('file_id', fileId);
        return fd;
    });
    const dataUrl = `data:${data.mime_type || 'image/jpeg'};base64,${data.base64_data}`;
    mediaCache.set(fileId, dataUrl);
    return dataUrl;
}
function prewarmMessagingMediaCache(fileIds) {
    for (const id of fileIds) {
        if (!(0, messagingHelpers_1.isTempMessageId)(id) && !mediaCache.has(id)) {
            void getMessagingMediaUrl(id).catch(() => { });
        }
    }
}
async function deleteMessagingFile(fileId) {
    if ((0, messagingHelpers_1.isTempMessageId)(fileId))
        return;
    mediaCache.delete(fileId);
    await tryPostEndpoints(DELETE_PATHS, () => {
        const fd = new FormData();
        fd.append('file_id', fileId);
        return fd;
    });
}
async function uploadMessagingImage(uri, fileName) {
    const formData = new FormData();
    const file = {
        uri: react_native_1.Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
        name: fileName,
        type: getMimeType(fileName),
    };
    formData.append('file', file);
    formData.append('category', 'messaging_attachments');
    const data = await tryPostEndpoints(UPLOAD_PATHS, () => formData);
    const fileId = data.file_id || data.id;
    if (!fileId)
        throw new Error('Upload response missing file_id');
    return {
        file_id: String(fileId),
        filename: data.filename || fileName,
        mime_type: data.mime_type || getMimeType(fileName),
        url: data.url,
    };
}
async function uploadMessagingImages(files) {
    const results = [];
    for (const f of files) {
        results.push(await uploadMessagingImage(f.uri, f.fileName));
    }
    return results;
}
