import { Injectable, Inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, from, of } from 'rxjs';
import { catchError, concatMap, map, tap, toArray } from 'rxjs/operators';
import { MESSAGING_CONFIG, MessagingConfig } from '../messaging.config';
import { AuthService } from './auth.service';

export interface FileUploadResponse {
  file_id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  url?: string;
}

export interface FileRetrieveResponse {
  file_id: string;
  filename: string;
  mime_type: string;
  base64_data: string;
}

/** Sentinel prefix — never send these IDs to any API. */
const TEMP_PREFIX = 'temp-';
function isTempId(id: string | null | undefined): boolean {
  return !id || id.startsWith(TEMP_PREFIX);
}

function isStructuredId(id: string | null | undefined): boolean {
  const value = String(id || '').trim();
  return value.startsWith('{') || value.startsWith('[');
}

@Injectable({ providedIn: 'root' })
export class MessagingFileService {
  /** Base URL, e.g. https://api.example.com/api */
  private readonly base: string;

  /** Ordered fallback lists — tried top-to-bottom on 404 / network error. */
  private readonly uploadEndpoints: string[];
  private readonly retrieveEndpoints: string[];
  private readonly deleteEndpoints: string[];

  /** In-session cache: file_id → data URL. Cleared on page reload. */
  private readonly mediaCache = new Map<string, string>();
  private readonly mediaFailures = new Set<string>();

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    @Inject(MESSAGING_CONFIG) private config: MessagingConfig
  ) {
    this.base = this.config.apiBaseUrl.replace(/\/+$/, '');

    this.uploadEndpoints   = [`${this.base}/storage/upload`,   `${this.base}/files/upload`,   `${this.base}/messaging/storage/upload`,   `${this.base}/messaging/files/upload`];
    this.retrieveEndpoints = [`${this.base}/storage/retrieve`, `${this.base}/files/retrieve`, `${this.base}/messaging/storage/retrieve`, `${this.base}/messaging/files/retrieve`];
    this.deleteEndpoints   = [`${this.base}/storage/delete`,   `${this.base}/files/delete`,   `${this.base}/messaging/storage/delete`,   `${this.base}/messaging/files/delete`];
  }

  private authOptions(
    options: { headers?: Record<string, string> } = {}
  ): { headers?: Record<string, string> } {
    const token = this.auth.sessionGid;
    if (!token) return options;
    return {
      ...options,
      headers: {
        ...(options.headers || {}),
        'X-Messaging-Session': token,
      },
    };
  }

  // ── Upload ───────────────────────────────────────────────────────────────

  uploadFile(file: File, category = 'messaging_attachments'): Observable<FileUploadResponse> {
    const makeBody = () => {
      const fd = new FormData();
      fd.append('file', file, file.name);
      fd.append('category', category);
      return fd;
    };
    return this.tryEndpoints<FileUploadResponse>(this.uploadEndpoints, makeBody);
  }

  uploadFiles(files: File[]): Observable<FileUploadResponse[]> {
    if (files.length === 0) return of([]);
    return from(files).pipe(
      concatMap((file) => this.uploadFile(file)),
      toArray()
    );
  }

  // ── Retrieve ─────────────────────────────────────────────────────────────

  retrieveFile(fileId: string): Observable<FileRetrieveResponse> {
    if (isTempId(fileId)) {
      return throwError(() => new Error('Cannot retrieve file: upload not complete yet.'));
    }
    if (isStructuredId(fileId)) {
      return throwError(() => new Error('Cannot retrieve file: invalid structured attachment id.'));
    }
    if (this.mediaFailures.has(fileId)) {
      return throwError(() => new Error('Cannot retrieve file: previous retrieve failed.'));
    }
    const makeBody = () => {
      const fd = new FormData();
      fd.append('file_id', fileId);
      return fd;
    };
    return this.tryEndpoints<FileRetrieveResponse>(this.retrieveEndpoints, makeBody, false).pipe(
      catchError((err) => {
        this.mediaFailures.add(fileId);
        return throwError(() => err);
      })
    );
  }

  /**
   * Returns a data URL for the given file_id.
   * Cached in memory for the session lifetime — never re-fetched if already loaded.
   */
  getFileDataUrl(fileId: string): Observable<string> {
    if (isTempId(fileId)) {
      return throwError(() => new Error('Cannot retrieve file: upload not complete yet.'));
    }
    if (isStructuredId(fileId)) {
      return throwError(() => new Error('Cannot retrieve file: invalid structured attachment id.'));
    }
    if (this.mediaFailures.has(fileId)) {
      return throwError(() => new Error('Cannot retrieve file: previous retrieve failed.'));
    }
    const cached = this.mediaCache.get(fileId);
    if (cached) return of(cached);

    return this.retrieveFile(fileId).pipe(
      map((r) => `data:${r.mime_type};base64,${r.base64_data}`),
      tap((dataUrl) => this.mediaCache.set(fileId, dataUrl))
    );
  }

  /** Synchronous cache lookup — null if not loaded yet. */
  getCachedDataUrl(fileId: string): string | null {
    if (isTempId(fileId) || isStructuredId(fileId) || this.mediaFailures.has(fileId)) return null;
    return this.mediaCache.get(fileId) ?? null;
  }

  /** Pre-warm cache for a list of file IDs (fire-and-forget, skips temp/cached). */
  prewarmCache(fileIds: string[]): void {
    for (const id of fileIds) {
      if (!isTempId(id) && !isStructuredId(id) && !this.mediaFailures.has(id) && !this.mediaCache.has(id)) {
        this.getFileDataUrl(id).subscribe({ error: () => {} });
      }
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  deleteFile(fileId: string): Observable<any> {
    if (isTempId(fileId) || isStructuredId(fileId)) {
      return of(null);
    }
    this.mediaCache.delete(fileId);
    const makeBody = () => {
      const fd = new FormData();
      fd.append('file_id', fileId);
      return fd;
    };
    return this.tryEndpoints(this.deleteEndpoints, makeBody, false);
  }

  // ── Send message with attachments ────────────────────────────────────────

  sendMessageWithAttachments(
    conversationId: string,
    senderContactId: string,
    content: string,
    fileIds: string[],
    filenames: string[],
    mimeTypes: string[] = []
  ): Observable<any> {
    // Guard: never send temp file IDs to the backend
    const realIds = fileIds.filter(id => !isTempId(id));
    if (realIds.length !== fileIds.length) {
      return throwError(() => new Error('Upload not finished — cannot attach temp file.'));
    }
    const messagingBase = `${this.base}/messaging`;
    return this.http.post(`${messagingBase}/conversations/${conversationId}/messages`, {
      content: content || '',
      attachment_ids: realIds,
      filenames,
      mime_types: mimeTypes,
    }, this.authOptions());
  }

  // ── Fallback engine ───────────────────────────────────────────────────────

  /**
   * POST each URL in `urls` sequentially (using the body from `bodyFn()`).
   * Falls back to the next URL only on 404 or network error (status 0).
   * Logs every attempt with its result.
   */
  private tryEndpoints<T>(urls: string[], bodyFn: () => FormData, fallbackOnNetwork = true): Observable<T> {
    if (urls.length === 0) {
      return throwError(() => new Error('All storage endpoints exhausted.'));
    }

    const [url, ...rest] = urls;
    return this.http.post<T>(url, bodyFn(), this.authOptions()).pipe(
      catchError((err: HttpErrorResponse) => {
        // Only fall through on not-found or network issues
        if ((err.status === 404 || (fallbackOnNetwork && err.status === 0)) && rest.length > 0) {
          return this.tryEndpoints<T>(rest, bodyFn, fallbackOnNetwork);
        }

        // Translate to a friendly error
        return throwError(() => this.toFriendlyError(err, url));
      })
    );
  }

  private toFriendlyError(err: HttpErrorResponse, url: string): Error {
    const detail: string = err.error?.detail || err.error?.message || '';
    if (err.status === 404 && detail.toLowerCase().includes('not found')) {
      return new Error('Attachment not available or not uploaded yet.');
    }
    if (err.status === 401) return new Error('Unauthorized — check storage API key configuration.');
    if (err.status === 0)   return new Error('Network error — storage service unreachable.');
    return new Error(detail || `Storage request failed (${err.status}) — ${url}`);
  }
}
