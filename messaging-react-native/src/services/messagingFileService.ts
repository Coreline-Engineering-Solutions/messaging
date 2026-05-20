import { Platform } from 'react-native';
import { getMessagingStorageApiUrl, resolveMessagingAccessToken } from './messagingRuntime';
import { isTempMessageId } from '../utils/messagingHelpers';

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

const mediaCache = new Map<string, string>();

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
  bodyFn: () => FormData
): Promise<T> {
  const base = getMessagingStorageApiUrl().replace(/\/+$/, '');
  let lastError: Error | null = null;
  for (const path of paths) {
    try {
      const response = await fetch(`${base}${path}`, {
        method: 'POST',
        body: bodyFn(),
        headers: await authHeaders(),
      });
      if (response.status === 404 && paths.indexOf(path) < paths.length - 1) continue;
      if (!response.ok) {
        lastError = new Error(`Request failed: HTTP ${response.status}`);
        continue;
      }
      return (await response.json()) as T;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastError ?? new Error('Storage request failed');
}

export function getCachedMessagingMediaUrl(fileId: string): string | null {
  if (isTempMessageId(fileId)) return null;
  return mediaCache.get(fileId) ?? null;
}

export async function getMessagingMediaUrl(fileId: string): Promise<string> {
  if (isTempMessageId(fileId)) {
    throw new Error('Upload not complete');
  }
  const cached = mediaCache.get(fileId);
  if (cached) return cached;

  const data = await tryPostEndpoints<FileRetrieveResponse>(RETRIEVE_PATHS, () => {
    const fd = new FormData();
    fd.append('file_id', fileId);
    return fd;
  });

  const dataUrl = `data:${data.mime_type || 'image/jpeg'};base64,${data.base64_data}`;
  mediaCache.set(fileId, dataUrl);
  return dataUrl;
}

export function prewarmMessagingMediaCache(fileIds: string[]): void {
  for (const id of fileIds) {
    if (!isTempMessageId(id) && !mediaCache.has(id)) {
      void getMessagingMediaUrl(id).catch(() => {});
    }
  }
}

export async function deleteMessagingFile(fileId: string): Promise<void> {
  if (isTempMessageId(fileId)) return;
  mediaCache.delete(fileId);
  await tryPostEndpoints(DELETE_PATHS, () => {
    const fd = new FormData();
    fd.append('file_id', fileId);
    return fd;
  });
}

export async function uploadMessagingImage(
  uri: string,
  fileName: string
): Promise<MessagingUploadResult> {
  const formData = new FormData();
  const file = {
    uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
    name: fileName,
    type: getMimeType(fileName),
  } as unknown as Blob;
  formData.append('file', file as unknown as string);
  formData.append('category', 'messaging_attachments');

  const data = await tryPostEndpoints<MessagingUploadResult & { id?: string }>(
    UPLOAD_PATHS,
    () => formData
  );
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
