"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCachedMessagingMediaUrl = getCachedMessagingMediaUrl;
exports.getMessagingMediaUrl = getMessagingMediaUrl;
exports.prewarmMessagingMediaCache = prewarmMessagingMediaCache;
exports.deleteMessagingFile = deleteMessagingFile;
exports.uploadMessagingImage = uploadMessagingImage;
exports.uploadMessagingImages = uploadMessagingImages;
const react_native_1 = require("react-native");
const configure_1 = require("../configure");
const messagingRuntime_1 = require("./messagingRuntime");
const messagingHelpers_1 = require("../utils/messagingHelpers");
/** Align with Angular MessagingFileService endpoint order. */
const UPLOAD_PATHS = [
    '/storage/upload',
    '/files/upload',
    '/messaging/storage/upload',
    '/messaging/files/upload',
];
const RETRIEVE_PATHS = [
    '/storage/retrieve',
    '/files/retrieve',
    '/messaging/storage/retrieve',
    '/messaging/files/retrieve',
];
const DELETE_PATHS = [
    '/storage/delete',
    '/files/delete',
    '/messaging/storage/delete',
    '/messaging/files/delete',
];
const mediaCache = new Map();
const mediaFailures = new Set();
let storageBaseWarned = false;
function getStorageApiBase() {
    const cfg = (0, configure_1.getMessagingConfig)();
    if (cfg.storageApiUrl && !storageBaseWarned) {
        storageBaseWarned = true;
        console.warn('[messaging-react-native] storageApiUrl is ignored for attachments; using apiBaseUrl (same as Angular @coreline-engineering-solutions/messaging).');
    }
    return (0, messagingRuntime_1.getMessagingApiBaseUrl)().replace(/\/+$/, '');
}
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
    return (0, messagingRuntime_1.getMessagingSessionHeaders)();
}
async function tryPostEndpoints(paths, bodyFn, fallbackOnNetwork = true) {
    const base = getStorageApiBase();
    let lastError = null;
    for (let i = 0; i < paths.length; i++) {
        const hasMore = i < paths.length - 1;
        try {
            const response = await fetch(`${base}${paths[i]}`, {
                method: 'POST',
                body: bodyFn(),
                headers: await authHeaders(),
            });
            if (!response.ok) {
                const detail = await response.text().catch(() => '');
                lastError = new Error(detail || `Request failed: HTTP ${response.status}`);
                if (hasMore && response.status === 404)
                    continue;
                throw lastError;
            }
            return (await response.json());
        }
        catch (e) {
            if (e instanceof Error && e === lastError)
                throw e;
            lastError = e instanceof Error ? e : new Error(String(e));
            if (hasMore && fallbackOnNetwork)
                continue;
            throw lastError;
        }
    }
    throw lastError ?? new Error('Storage request failed');
}
function getCachedMessagingMediaUrl(fileId) {
    if ((0, messagingHelpers_1.isTempMessageId)(fileId) || (0, messagingHelpers_1.isStructuredAttachmentId)(fileId) || mediaFailures.has(fileId)) {
        return null;
    }
    return mediaCache.get(fileId) ?? null;
}
async function getMessagingMediaUrl(fileId) {
    if ((0, messagingHelpers_1.isTempMessageId)(fileId)) {
        throw new Error('Cannot retrieve file: upload not complete yet.');
    }
    if ((0, messagingHelpers_1.isStructuredAttachmentId)(fileId)) {
        throw new Error('Cannot retrieve file: invalid structured attachment id.');
    }
    if (mediaFailures.has(fileId)) {
        throw new Error('Cannot retrieve file: previous retrieve failed.');
    }
    const cached = mediaCache.get(fileId);
    if (cached)
        return cached;
    try {
        const data = await tryPostEndpoints(RETRIEVE_PATHS, () => {
            const fd = new FormData();
            fd.append('file_id', fileId);
            return fd;
        }, false);
        const dataUrl = `data:${data.mime_type || 'image/jpeg'};base64,${data.base64_data}`;
        mediaCache.set(fileId, dataUrl);
        return dataUrl;
    }
    catch (e) {
        mediaFailures.add(fileId);
        throw e;
    }
}
function prewarmMessagingMediaCache(fileIds) {
    for (const id of fileIds) {
        if (!(0, messagingHelpers_1.isTempMessageId)(id) &&
            !(0, messagingHelpers_1.isStructuredAttachmentId)(id) &&
            !mediaFailures.has(id) &&
            !mediaCache.has(id)) {
            void getMessagingMediaUrl(id).catch(() => { });
        }
    }
}
async function deleteMessagingFile(fileId) {
    if ((0, messagingHelpers_1.isTempMessageId)(fileId) || (0, messagingHelpers_1.isStructuredAttachmentId)(fileId))
        return;
    mediaCache.delete(fileId);
    mediaFailures.delete(fileId);
    await tryPostEndpoints(DELETE_PATHS, () => {
        const fd = new FormData();
        fd.append('file_id', fileId);
        return fd;
    }, false);
}
function appendFileToFormData(formData, uri, fileName) {
    const file = {
        uri: react_native_1.Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
        name: fileName,
        type: getMimeType(fileName),
    };
    formData.append('file', file, fileName);
}
async function uploadMessagingImage(uri, fileName) {
    const formData = new FormData();
    appendFileToFormData(formData, uri, fileName);
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
