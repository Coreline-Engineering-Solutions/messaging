import { Platform } from 'react-native';
import { getMessagingConfig } from '../configure';
import { getMessagingApiBaseUrl, resolveMessagingAccessToken } from './messagingRuntime';
import { isStructuredAttachmentId, isTempMessageId } from '../utils/messagingHelpers';

export interface MessagingUploadResult {
  file_id: string;
  filename: string;
  mime_type?: string;
  url?: string;
}

export interface FileRetrieveResponse {
  file_id: string;
  filename: string;
  mime_type: string;
  base64_data: string;
}

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

const mediaCache = new Map<string, string>();
const mediaFailures = new Set<string>();

let storageBaseWarned = false;

function getStorageApiBase(): string {
  const cfg = getMessagingConfig();
  if (cfg.storageApiUrl && !storageBaseWarned) {
    storageBaseWarned = true;
    console.warn(
      '[messaging-react-native] storageApiUrl is ignored for attachments; using apiBaseUrl (same as Angular @coreline-engineering-solutions/messaging).'
    );
  }
  return getMessagingApiBaseUrl().replace(/\/+$/, '');
}

function getMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'mp4') return 'video/mp4';
  if (ext === 'pdf') return 'application/pdf';
  return 'image/jpeg';
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await resolveMessagingAccessToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function tryPostEndpoints<T>(
  paths: string[],
  bodyFn: () => FormData,
  fallbackOnNetwork = true
): Promise<T> {
  const base = getStorageApiBase();
  let lastError: Error | null = null;

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
        if (hasMore && response.status === 404) continue;
        throw lastError;
      }
      return (await response.json()) as T;
    } catch (e) {
      if (e instanceof Error && e === lastError) throw e;
      lastError = e instanceof Error ? e : new Error(String(e));
      if (hasMore && fallbackOnNetwork) continue;
      throw lastError;
    }
  }
  throw lastError ?? new Error('Storage request failed');
}

export function getCachedMessagingMediaUrl(fileId: string): string | null {
  if (isTempMessageId(fileId) || isStructuredAttachmentId(fileId) || mediaFailures.has(fileId)) {
    return null;
  }
  return mediaCache.get(fileId) ?? null;
}

export async function getMessagingMediaUrl(fileId: string): Promise<string> {
  if (isTempMessageId(fileId)) {
    throw new Error('Cannot retrieve file: upload not complete yet.');
  }
  if (isStructuredAttachmentId(fileId)) {
    throw new Error('Cannot retrieve file: invalid structured attachment id.');
  }
  if (mediaFailures.has(fileId)) {
    throw new Error('Cannot retrieve file: previous retrieve failed.');
  }

  const cached = mediaCache.get(fileId);
  if (cached) return cached;

  try {
    const data = await tryPostEndpoints<FileRetrieveResponse>(RETRIEVE_PATHS, () => {
      const fd = new FormData();
      fd.append('file_id', fileId);
      return fd;
    }, false);

    const dataUrl = `data:${data.mime_type || 'image/jpeg'};base64,${data.base64_data}`;
    mediaCache.set(fileId, dataUrl);
    return dataUrl;
  } catch (e) {
    mediaFailures.add(fileId);
    throw e;
  }
}

export function prewarmMessagingMediaCache(fileIds: string[]): void {
  for (const id of fileIds) {
    if (
      !isTempMessageId(id) &&
      !isStructuredAttachmentId(id) &&
      !mediaFailures.has(id) &&
      !mediaCache.has(id)
    ) {
      void getMessagingMediaUrl(id).catch(() => {});
    }
  }
}

export async function deleteMessagingFile(fileId: string): Promise<void> {
  if (isTempMessageId(fileId) || isStructuredAttachmentId(fileId)) return;
  mediaCache.delete(fileId);
  mediaFailures.delete(fileId);
  await tryPostEndpoints(DELETE_PATHS, () => {
    const fd = new FormData();
    fd.append('file_id', fileId);
    return fd;
  }, false);
}

function appendFileToFormData(formData: FormData, uri: string, fileName: string): void {
  const file = {
    uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
    name: fileName,
    type: getMimeType(fileName),
  };
  (formData.append as (name: string, value: unknown, fileName?: string) => void)(
    'file',
    file,
    fileName
  );
}

export async function uploadMessagingImage(
  uri: string,
  fileName: string
): Promise<MessagingUploadResult> {
  const formData = new FormData();
  appendFileToFormData(formData, uri, fileName);
  formData.append('category', 'messaging_attachments');

  const data = await tryPostEndpoints<MessagingUploadResult & { id?: string }>(UPLOAD_PATHS, () => formData);
  const fileId = data.file_id || data.id;
  if (!fileId) throw new Error('Upload response missing file_id');
  return {
    file_id: String(fileId),
    filename: data.filename || fileName,
    mime_type: data.mime_type || getMimeType(fileName),
    url: data.url,
  };
}

export async function uploadMessagingImages(
  files: { uri: string; fileName: string }[]
): Promise<MessagingUploadResult[]> {
  const results: MessagingUploadResult[] = [];
  for (const f of files) {
    results.push(await uploadMessagingImage(f.uri, f.fileName));
  }
  return results;
}
