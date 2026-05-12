import { Injectable, Inject } from '@angular/core';
import { throwError, forkJoin, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { MESSAGING_CONFIG } from '../messaging.config';
import * as i0 from "@angular/core";
import * as i1 from "@angular/common/http";
import * as i2 from "./auth.service";
/** Sentinel prefix — never send these IDs to any API. */
const TEMP_PREFIX = 'temp-';
function isTempId(id) {
    return !id || id.startsWith(TEMP_PREFIX);
}
export class MessagingFileService {
    http;
    auth;
    config;
    /** Base URL, e.g. https://ces-ticketing-system-db.onrender.com/api */
    base;
    /** Ordered fallback lists — tried top-to-bottom on 404 / network error. */
    uploadEndpoints;
    retrieveEndpoints;
    deleteEndpoints;
    /** In-session cache: file_id → data URL. Cleared on page reload. */
    mediaCache = new Map();
    constructor(http, auth, config) {
        this.http = http;
        this.auth = auth;
        this.config = config;
        this.base = this.config.apiBaseUrl.replace(/\/+$/, '');
        this.uploadEndpoints = [`${this.base}/storage/upload`, `${this.base}/messaging/storage/upload`, `${this.base}/messaging/files/upload`];
        this.retrieveEndpoints = [`${this.base}/storage/retrieve`, `${this.base}/messaging/storage/retrieve`, `${this.base}/messaging/files/retrieve`];
        this.deleteEndpoints = [`${this.base}/storage/delete`, `${this.base}/messaging/storage/delete`, `${this.base}/messaging/files/delete`];
    }
    // ── Upload ───────────────────────────────────────────────────────────────
    uploadFile(file, category = 'messaging_attachments') {
        const makeBody = () => {
            const fd = new FormData();
            fd.append('file', file, file.name);
            fd.append('category', category);
            return fd;
        };
        return this.tryEndpoints(this.uploadEndpoints, makeBody);
    }
    uploadFiles(files) {
        if (files.length === 0)
            return of([]);
        return forkJoin(files.map((f) => this.uploadFile(f)));
    }
    // ── Retrieve ─────────────────────────────────────────────────────────────
    retrieveFile(fileId) {
        if (isTempId(fileId)) {
            return throwError(() => new Error('Cannot retrieve file: upload not complete yet.'));
        }
        const makeBody = () => {
            const fd = new FormData();
            fd.append('file_id', fileId);
            return fd;
        };
        return this.tryEndpoints(this.retrieveEndpoints, makeBody);
    }
    /**
     * Returns a data URL for the given file_id.
     * Cached in memory for the session lifetime — never re-fetched if already loaded.
     */
    getFileDataUrl(fileId) {
        if (isTempId(fileId)) {
            return throwError(() => new Error('Cannot retrieve file: upload not complete yet.'));
        }
        const cached = this.mediaCache.get(fileId);
        if (cached)
            return of(cached);
        return this.retrieveFile(fileId).pipe(map((r) => `data:${r.mime_type};base64,${r.base64_data}`), tap((dataUrl) => this.mediaCache.set(fileId, dataUrl)));
    }
    /** Synchronous cache lookup — null if not loaded yet. */
    getCachedDataUrl(fileId) {
        if (isTempId(fileId))
            return null;
        return this.mediaCache.get(fileId) ?? null;
    }
    /** Pre-warm cache for a list of file IDs (fire-and-forget, skips temp/cached). */
    prewarmCache(fileIds) {
        for (const id of fileIds) {
            if (!isTempId(id) && !this.mediaCache.has(id)) {
                this.getFileDataUrl(id).subscribe({ error: () => { } });
            }
        }
    }
    // ── Delete ────────────────────────────────────────────────────────────────
    deleteFile(fileId) {
        if (isTempId(fileId)) {
            return of(null);
        }
        this.mediaCache.delete(fileId);
        const makeBody = () => {
            const fd = new FormData();
            fd.append('file_id', fileId);
            return fd;
        };
        return this.tryEndpoints(this.deleteEndpoints, makeBody);
    }
    // ── Send message with attachments ────────────────────────────────────────
    sendMessageWithAttachments(conversationId, senderContactId, content, fileIds, filenames) {
        // Guard: never send temp file IDs to the backend
        const realIds = fileIds.filter(id => !isTempId(id));
        if (realIds.length !== fileIds.length) {
            return throwError(() => new Error('Upload not finished — cannot attach temp file.'));
        }
        const messagingBase = `${this.base}/messaging`;
        return this.http.post(`${messagingBase}/conversations/${conversationId}/messages`, {
            sender_id: parseInt(senderContactId, 10),
            content: content || '',
            attachment_ids: realIds,
            filenames,
        });
    }
    // ── Fallback engine ───────────────────────────────────────────────────────
    /**
     * POST each URL in `urls` sequentially (using the body from `bodyFn()`).
     * Falls back to the next URL only on 404 or network error (status 0).
     * Logs every attempt with its result.
     */
    tryEndpoints(urls, bodyFn) {
        if (urls.length === 0) {
            return throwError(() => new Error('All storage endpoints exhausted.'));
        }
        const [url, ...rest] = urls;
        return this.http.post(url, bodyFn()).pipe(catchError((err) => {
            // Only fall through on not-found or network issues
            if ((err.status === 404 || err.status === 0) && rest.length > 0) {
                return this.tryEndpoints(rest, bodyFn);
            }
            // Translate to a friendly error
            return throwError(() => this.toFriendlyError(err, url));
        }));
    }
    toFriendlyError(err, url) {
        const detail = err.error?.detail || err.error?.message || '';
        if (err.status === 404 && detail.toLowerCase().includes('not found')) {
            return new Error('Attachment not available or not uploaded yet.');
        }
        if (err.status === 401)
            return new Error('Unauthorized — check storage API key configuration.');
        if (err.status === 0)
            return new Error('Network error — storage service unreachable.');
        return new Error(detail || `Storage request failed (${err.status}) — ${url}`);
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: MessagingFileService, deps: [{ token: i1.HttpClient }, { token: i2.AuthService }, { token: MESSAGING_CONFIG }], target: i0.ɵɵFactoryTarget.Injectable });
    static ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: MessagingFileService, providedIn: 'root' });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: MessagingFileService, decorators: [{
            type: Injectable,
            args: [{ providedIn: 'root' }]
        }], ctorParameters: () => [{ type: i1.HttpClient }, { type: i2.AuthService }, { type: undefined, decorators: [{
                    type: Inject,
                    args: [MESSAGING_CONFIG]
                }] }] });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVzc2FnaW5nLWZpbGUuc2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9saWIvc2VydmljZXMvbWVzc2FnaW5nLWZpbGUuc2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sRUFBRSxNQUFNLGVBQWUsQ0FBQztBQUVuRCxPQUFPLEVBQWMsVUFBVSxFQUFFLFFBQVEsRUFBRSxFQUFFLEVBQUUsTUFBTSxNQUFNLENBQUM7QUFDNUQsT0FBTyxFQUFFLFVBQVUsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLE1BQU0sZ0JBQWdCLENBQUM7QUFDdEQsT0FBTyxFQUFFLGdCQUFnQixFQUFtQixNQUFNLHFCQUFxQixDQUFDOzs7O0FBa0J4RSx5REFBeUQ7QUFDekQsTUFBTSxXQUFXLEdBQUcsT0FBTyxDQUFDO0FBQzVCLFNBQVMsUUFBUSxDQUFDLEVBQTZCO0lBQzdDLE9BQU8sQ0FBQyxFQUFFLElBQUksRUFBRSxDQUFDLFVBQVUsQ0FBQyxXQUFXLENBQUMsQ0FBQztBQUMzQyxDQUFDO0FBR0QsTUFBTSxPQUFPLG9CQUFvQjtJQWFyQjtJQUNBO0lBQzBCO0lBZHBDLHNFQUFzRTtJQUNyRCxJQUFJLENBQVM7SUFFOUIsMkVBQTJFO0lBQzFELGVBQWUsQ0FBVztJQUMxQixpQkFBaUIsQ0FBVztJQUM1QixlQUFlLENBQVc7SUFFM0Msb0VBQW9FO0lBQ25ELFVBQVUsR0FBRyxJQUFJLEdBQUcsRUFBa0IsQ0FBQztJQUV4RCxZQUNVLElBQWdCLEVBQ2hCLElBQWlCLEVBQ1MsTUFBdUI7UUFGakQsU0FBSSxHQUFKLElBQUksQ0FBWTtRQUNoQixTQUFJLEdBQUosSUFBSSxDQUFhO1FBQ1MsV0FBTSxHQUFOLE1BQU0sQ0FBaUI7UUFFekQsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFFLEVB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QUN6RixPQUFPLElBQUksS0FBSyxDQUFDLE1BQU0sSUFBSSwyQkFBMkIsR0FBRyxDQUFDLE1BQU0sT0FBTyxHQUFHLEVBQUUsQ0FBQyxDQUFDO0lBQ2hGLENBQUM7d0dBL0pVLG9CQUFvQix1RUFlckIsZ0JBQWdCOzRHQWZmLG9CQUFvQixjQURQLE1BQU07OzRGQUNuQixvQkFBb0I7a0JBRGhDLFVBQVU7bUJBQUMsRUFBRSxVQUFVLEVBQUUsTUFBTSxFQUFFOzswQkFnQjdCLE1BQU07MkJBQUMsZ0JBQWdCIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgSW5qZWN0YWJsZSwgSW5qZWN0IH0gZnJvbSAnQGFuZ3VsYXIvY29yZSc7XHJcbmltcG9ydCB7IEh0dHBDbGllbnQsIEh0dHBFcnJvclJlc3BvbnNlIH0gZnJvbSAnQGFuZ3VsYXIvY29tbW9uL2h0dHAnO1xyXG5pbXBvcnQgeyBPYnNlcnZhYmxlLCB0aHJvd0Vycm9yLCBmb3JrSm9pbiwgb2YgfSBmcm9tICdyeGpzJztcclxuaW1wb3J0IHsgY2F0Y2hFcnJvciwgbWFwLCB0YXAgfSBmcm9tICdyeGpzL29wZXJhdG9ycyc7XHJcbmltcG9ydCB7IE1FU1NBR0lOR19DT05GSUcsIE1lc3NhZ2luZ0NvbmZpZyB9IGZyb20gJy4uL21lc3NhZ2luZy5jb25maWcnO1xyXG5pbXBvcnQgeyBBdXRoU2VydmljZSB9IGZyb20gJy4vYXV0aC5zZXJ2aWNlJztcclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgRmlsZVVwbG9hZFJlc3BvbnNlIHtcclxuICBmaWxlX2lkOiBzdHJpbmc7XHJcbiAgZmlsZW5hbWU6IHN0cmluZztcclxuICBtaW1lX3R5cGU6IHN0cmluZztcclxuICBzaXplX2J5dGVzOiBudW1iZXI7XHJcbiAgdXJsPzogc3RyaW5nO1xyXG59XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIEZpbGVSZXRyaWV2ZVJlc3BvbnNlIHtcclxuICBmaWxlX2lkOiBzdHJpbmc7XHJcbiAgZmlsZW5hbWU6IHN0cmluZztcclxuICBtaW1lX3R5cGU6IHN0cmluZztcclxuICBiYXNlNjRfZGF0YTogc3RyaW5nO1xyXG59XHJcblxyXG4vKiogU2VudGluZWwgcHJlZml4IOKAlCBuZXZlciBzZW5kIHRoZXNlIElEcyB0byBhbnkgQVBJLiAqL1xyXG5jb25zdCBURU1QX1BSRUZJWCA9ICd0ZW1wLSc7XHJcbmZ1bmN0aW9uIGlzVGVtcElkKGlkOiBzdHJpbmcgfCBudWxsIHwgdW5kZWZpbmVkKTogYm9vbGVhbiB7XHJcbiAgcmV0dXJuICFpZCB8fCBpZC5zdGFydHNXaXRoKFRFTVBfUFJFRklYKTtcclxufVxyXG5cclxuQEluamVjdGFibGUoeyBwcm92aWRlZEluOiAncm9vdCcgfSlcclxuZXhwb3J0IGNsYXNzIE1lc3NhZ2luZ0ZpbGVTZXJ2aWNlIHtcclxuICAvKiogQmFzZSBVUkwsIGUuZy4gaHR0cHM6Ly9jZXMtdGlja2V0aW5nLXN5c3RlbS1kYi5vbnJlbmRlci5jb20vYXBpICovXHJcbiAgcHJpdmF0ZSByZWFkb25seSBiYXNlOiBzdHJpbmc7XHJcblxyXG4gIC8qKiBPcmRlcmVkIGZhbGxiYWNrIGxpc3RzIOKAlCB0cmllZCB0b3AtdG8tYm90dG9tIG9uIDQwNCAvIG5ldHdvcmsgZXJyb3IuICovXHJcbiAgcHJpdmF0ZSByZWFkb25seSB1cGxvYWRFbmRwb2ludHM6IHN0cmluZ1tdO1xyXG4gIHByaXZhdGUgcmVhZG9ubHkgcmV0cmlldmVFbmRwb2ludHM6IHN0cmluZ1tdO1xyXG4gIHByaXZhdGUgcmVhZG9ubHkgZGVsZXRlRW5kcG9pbnRzOiBzdHJpbmdbXTtcclxuXHJcbiAgLyoqIEluLXNlc3Npb24gY2FjaGU6IGZpbGVfaWQg4oaSIGRhdGEgVVJMLiBDbGVhcmVkIG9uIHBhZ2UgcmVsb2FkLiAqL1xyXG4gIHByaXZhdGUgcmVhZG9ubHkgbWVkaWFDYWNoZSA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XHJcblxyXG4gIGNvbnN0cnVjdG9yKFxyXG4gICAgcHJpdmF0ZSBodHRwOiBIdHRwQ2xpZW50LFxyXG4gICAgcHJpdmF0ZSBhdXRoOiBBdXRoU2VydmljZSxcclxuICAgIEBJbmplY3QoTUVTU0FHSU5HX0NPTkZJRykgcHJpdmF0ZSBjb25maWc6IE1lc3NhZ2luZ0NvbmZpZ1xyXG4gICkge1xyXG4gICAgdGhpcy5iYXNlID0gdGhpcy5jb25maWcuYXBpQmFzZVVybC5yZXBsYWNlKC9cXC8rJC8sICcnKTtcclxuXHJcbiAgICB0aGlzLnVwbG9hZEVuZHBvaW50cyAgID0gW2Ake3RoaXMuYmFzZX0vc3RvcmFnZS91cGxvYWRgLCAgIGAke3RoaXMuYmFzZX0vbWVzc2FnaW5nL3N0b3JhZ2UvdXBsb2FkYCwgICBgJHt0aGlzLmJhc2V9L21lc3NhZ2luZy9maWxlcy91cGxvYWRgXTtcclxuICAgIHRoaXMucmV0cmlldmVFbmRwb2ludHMgPSBbYCR7dGhpcy5iYXNlfS9zdG9yYWdlL3JldHJpZXZlYCwgYCR7dGhpcy5iYXNlfS9tZXNzYWdpbmcvc3RvcmFnZS9yZXRyaWV2ZWAsIGAke3RoaXMuYmFzZX0vbWVzc2FnaW5nL2ZpbGVzL3JldHJpZXZlYF07XHJcbiAgICB0aGlzLmRlbGV0ZUVuZHBvaW50cyAgID0gW2Ake3RoaXMuYmFzZX0vc3RvcmFnZS9kZWxldGVgLCAgIGAke3RoaXMuYmFzZX0vbWVzc2FnaW5nL3N0b3JhZ2UvZGVsZXRlYCwgICBgJHt0aGlzLmJhc2V9L21lc3NhZ2luZy9maWxlcy9kZWxldGVgXTtcclxuICB9XHJcblxyXG4gIC8vIOKUgOKUgCBVcGxvYWQg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcblxyXG4gIHVwbG9hZEZpbGUoZmlsZTogRmlsZSwgY2F0ZWdvcnkgPSAnbWVzc2FnaW5nX2F0dGFjaG1lbnRzJyk6IE9ic2VydmFibGU8RmlsZVVwbG9hZFJlc3BvbnNlPiB7XHJcbiAgICBjb25zdCBtYWtlQm9keSA9ICgpID0+IHtcclxuICAgICAgY29uc3QgZmQgPSBuZXcgRm9ybURhdGEoKTtcclxuICAgICAgZmQuYXBwZW5kKCdmaWxlJywgZmlsZSwgZmlsZS5uYW1lKTtcclxuICAgICAgZmQuYXBwZW5kKCdjYXRlZ29yeScsIGNhdGVnb3J5KTtcclxuICAgICAgcmV0dXJuIGZkO1xyXG4gICAgfTtcclxuICAgIHJldHVybiB0aGlzLnRyeUVuZHBvaW50czxGaWxlVXBsb2FkUmVzcG9uc2U+KHRoaXMudXBsb2FkRW5kcG9pbnRzLCBtYWtlQm9keSk7XHJcbiAgfVxyXG5cclxuICB1cGxvYWRGaWxlcyhmaWxlczogRmlsZVtdKTogT2JzZXJ2YWJsZTxGaWxlVXBsb2FkUmVzcG9uc2VbXT4ge1xyXG4gICAgaWYgKGZpbGVzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIG9mKFtdKTtcclxuICAgIHJldHVybiBmb3JrSm9pbihmaWxlcy5tYXAoKGYpID0+IHRoaXMudXBsb2FkRmlsZShmKSkpO1xyXG4gIH1cclxuXHJcbiAgLy8g4pSA4pSAIFJldHJpZXZlIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG5cclxuICByZXRyaWV2ZUZpbGUoZmlsZUlkOiBzdHJpbmcpOiBPYnNlcnZhYmxlPEZpbGVSZXRyaWV2ZVJlc3BvbnNlPiB7XHJcbiAgICBpZiAoaXNUZW1wSWQoZmlsZUlkKSkge1xyXG4gICAgICByZXR1cm4gdGhyb3dFcnJvcigoKSA9PiBuZXcgRXJyb3IoJ0Nhbm5vdCByZXRyaWV2ZSBmaWxlOiB1cGxvYWQgbm90IGNvbXBsZXRlIHlldC4nKSk7XHJcbiAgICB9XHJcbiAgICBjb25zdCBtYWtlQm9keSA9ICgpID0+IHtcclxuICAgICAgY29uc3QgZmQgPSBuZXcgRm9ybURhdGEoKTtcclxuICAgICAgZmQuYXBwZW5kKCdmaWxlX2lkJywgZmlsZUlkKTtcclxuICAgICAgcmV0dXJuIGZkO1xyXG4gICAgfTtcclxuICAgIHJldHVybiB0aGlzLnRyeUVuZHBvaW50czxGaWxlUmV0cmlldmVSZXNwb25zZT4odGhpcy5yZXRyaWV2ZUVuZHBvaW50cywgbWFrZUJvZHkpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUmV0dXJucyBhIGRhdGEgVVJMIGZvciB0aGUgZ2l2ZW4gZmlsZV9pZC5cclxuICAgKiBDYWNoZWQgaW4gbWVtb3J5IGZvciB0aGUgc2Vzc2lvbiBsaWZldGltZSDigJQgbmV2ZXIgcmUtZmV0Y2hlZCBpZiBhbHJlYWR5IGxvYWRlZC5cclxuICAgKi9cclxuICBnZXRGaWxlRGF0YVVybChmaWxlSWQ6IHN0cmluZyk6IE9ic2VydmFibGU8c3RyaW5nPiB7XHJcbiAgICBpZiAoaXNUZW1wSWQoZmlsZUlkKSkge1xyXG4gICAgICByZXR1cm4gdGhyb3dFcnJvcigoKSA9PiBuZXcgRXJyb3IoJ0Nhbm5vdCByZXRyaWV2ZSBmaWxlOiB1cGxvYWQgbm90IGNvbXBsZXRlIHlldC4nKSk7XHJcbiAgICB9XHJcbiAgICBjb25zdCBjYWNoZWQgPSB0aGlzLm1lZGlhQ2FjaGUuZ2V0KGZpbGVJZCk7XHJcbiAgICBpZiAoY2FjaGVkKSByZXR1cm4gb2YoY2FjaGVkKTtcclxuXHJcbiAgICByZXR1cm4gdGhpcy5yZXRyaWV2ZUZpbGUoZmlsZUlkKS5waXBlKFxyXG4gICAgICBtYXAoKHIpID0+IGBkYXRhOiR7ci5taW1lX3R5cGV9O2Jhc2U2NCwke3IuYmFzZTY0X2RhdGF9YCksXHJcbiAgICAgIHRhcCgoZGF0YVVybCkgPT4gdGhpcy5tZWRpYUNhY2hlLnNldChmaWxlSWQsIGRhdGFVcmwpKVxyXG4gICAgKTtcclxuICB9XHJcblxyXG4gIC8qKiBTeW5jaHJvbm91cyBjYWNoZSBsb29rdXAg4oCUIG51bGwgaWYgbm90IGxvYWRlZCB5ZXQuICovXHJcbiAgZ2V0Q2FjaGVkRGF0YVVybChmaWxlSWQ6IHN0cmluZyk6IHN0cmluZyB8IG51bGwge1xyXG4gICAgaWYgKGlzVGVtcElkKGZpbGVJZCkpIHJldHVybiBudWxsO1xyXG4gICAgcmV0dXJuIHRoaXMubWVkaWFDYWNoZS5nZXQoZmlsZUlkKSA/PyBudWxsO1xyXG4gIH1cclxuXHJcbiAgLyoqIFByZS13YXJtIGNhY2hlIGZvciBhIGxpc3Qgb2YgZmlsZSBJRHMgKGZpcmUtYW5kLWZvcmdldCwgc2tpcHMgdGVtcC9jYWNoZWQpLiAqL1xyXG4gIHByZXdhcm1DYWNoZShmaWxlSWRzOiBzdHJpbmdbXSk6IHZvaWQge1xyXG4gICAgZm9yIChjb25zdCBpZCBvZiBmaWxlSWRzKSB7XHJcbiAgICAgIGlmICghaXNUZW1wSWQoaWQpICYmICF0aGlzLm1lZGlhQ2FjaGUuaGFzKGlkKSkge1xyXG4gICAgICAgIHRoaXMuZ2V0RmlsZURhdGFVcmwoaWQpLnN1YnNjcmliZSh7IGVycm9yOiAoKSA9PiB7fSB9KTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLy8g4pSA4pSAIERlbGV0ZSDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuXHJcbiAgZGVsZXRlRmlsZShmaWxlSWQ6IHN0cmluZyk6IE9ic2VydmFibGU8YW55PiB7XHJcbiAgICBpZiAoaXNUZW1wSWQoZmlsZUlkKSkge1xyXG4gICAgICByZXR1cm4gb2YobnVsbCk7XHJcbiAgICB9XHJcbiAgICB0aGlzLm1lZGlhQ2FjaGUuZGVsZXRlKGZpbGVJZCk7XHJcbiAgICBjb25zdCBtYWtlQm9keSA9ICgpID0+IHtcclxuICAgICAgY29uc3QgZmQgPSBuZXcgRm9ybURhdGEoKTtcclxuICAgICAgZmQuYXBwZW5kKCdmaWxlX2lkJywgZmlsZUlkKTtcclxuICAgICAgcmV0dXJuIGZkO1xyXG4gICAgfTtcclxuICAgIHJldHVybiB0aGlzLnRyeUVuZHBvaW50cyh0aGlzLmRlbGV0ZUVuZHBvaW50cywgbWFrZUJvZHkpO1xyXG4gIH1cclxuXHJcbiAgLy8g4pSA4pSAIFNlbmQgbWVzc2FnZSB3aXRoIGF0dGFjaG1lbnRzIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG5cclxuICBzZW5kTWVzc2FnZVdpdGhBdHRhY2htZW50cyhcclxuICAgIGNvbnZlcnNhdGlvbklkOiBzdHJpbmcsXHJcbiAgICBzZW5kZXJDb250YWN0SWQ6IHN0cmluZyxcclxuICAgIGNvbnRlbnQ6IHN0cmluZyxcclxuICAgIGZpbGVJZHM6IHN0cmluZ1tdLFxyXG4gICAgZmlsZW5hbWVzOiBzdHJpbmdbXVxyXG4gICk6IE9ic2VydmFibGU8YW55PiB7XHJcbiAgICAvLyBHdWFyZDogbmV2ZXIgc2VuZCB0ZW1wIGZpbGUgSURzIHRvIHRoZSBiYWNrZW5kXHJcbiAgICBjb25zdCByZWFsSWRzID0gZmlsZUlkcy5maWx0ZXIoaWQgPT4gIWlzVGVtcElkKGlkKSk7XHJcbiAgICBpZiAocmVhbElkcy5sZW5ndGggIT09IGZpbGVJZHMubGVuZ3RoKSB7XHJcbiAgICAgIHJldHVybiB0aHJvd0Vycm9yKCgpID0+IG5ldyBFcnJvcignVXBsb2FkIG5vdCBmaW5pc2hlZCDigJQgY2Fubm90IGF0dGFjaCB0ZW1wIGZpbGUuJykpO1xyXG4gICAgfVxyXG4gICAgY29uc3QgbWVzc2FnaW5nQmFzZSA9IGAke3RoaXMuYmFzZX0vbWVzc2FnaW5nYDtcclxuICAgIHJldHVybiB0aGlzLmh0dHAucG9zdChgJHttZXNzYWdpbmdCYXNlfS9jb252ZXJzYXRpb25zLyR7Y29udmVyc2F0aW9uSWR9L21lc3NhZ2VzYCwge1xyXG4gICAgICBzZW5kZXJfaWQ6IHBhcnNlSW50KHNlbmRlckNvbnRhY3RJZCwgMTApLFxyXG4gICAgICBjb250ZW50OiBjb250ZW50IHx8ICcnLFxyXG4gICAgICBhdHRhY2htZW50X2lkczogcmVhbElkcyxcclxuICAgICAgZmlsZW5hbWVzLFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvLyDilIDilIAgRmFsbGJhY2sgZW5naW5lIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG5cclxuICAvKipcclxuICAgKiBQT1NUIGVhY2ggVVJMIGluIGB1cmxzYCBzZXF1ZW50aWFsbHkgKHVzaW5nIHRoZSBib2R5IGZyb20gYGJvZHlGbigpYCkuXHJcbiAgICogRmFsbHMgYmFjayB0byB0aGUgbmV4dCBVUkwgb25seSBvbiA0MDQgb3IgbmV0d29yayBlcnJvciAoc3RhdHVzIDApLlxyXG4gICAqIExvZ3MgZXZlcnkgYXR0ZW1wdCB3aXRoIGl0cyByZXN1bHQuXHJcbiAgICovXHJcbiAgcHJpdmF0ZSB0cnlFbmRwb2ludHM8VD4odXJsczogc3RyaW5nW10sIGJvZHlGbjogKCkgPT4gRm9ybURhdGEpOiBPYnNlcnZhYmxlPFQ+IHtcclxuICAgIGlmICh1cmxzLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICByZXR1cm4gdGhyb3dFcnJvcigoKSA9PiBuZXcgRXJyb3IoJ0FsbCBzdG9yYWdlIGVuZHBvaW50cyBleGhhdXN0ZWQuJykpO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IFt1cmwsIC4uLnJlc3RdID0gdXJscztcclxuICAgIHJldHVybiB0aGlzLmh0dHAucG9zdDxUPih1cmwsIGJvZHlGbigpKS5waXBlKFxyXG4gICAgICBjYXRjaEVycm9yKChlcnI6IEh0dHBFcnJvclJlc3BvbnNlKSA9PiB7XHJcbiAgICAgICAgLy8gT25seSBmYWxsIHRocm91Z2ggb24gbm90LWZvdW5kIG9yIG5ldHdvcmsgaXNzdWVzXHJcbiAgICAgICAgaWYgKChlcnIuc3RhdHVzID09PSA0MDQgfHwgZXJyLnN0YXR1cyA9PT0gMCkgJiYgcmVzdC5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgICByZXR1cm4gdGhpcy50cnlFbmRwb2ludHM8VD4ocmVzdCwgYm9keUZuKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIFRyYW5zbGF0ZSB0byBhIGZyaWVuZGx5IGVycm9yXHJcbiAgICAgICAgcmV0dXJuIHRocm93RXJyb3IoKCkgPT4gdGhpcy50b0ZyaWVuZGx5RXJyb3IoZXJyLCB1cmwpKTtcclxuICAgICAgfSlcclxuICAgICk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHRvRnJpZW5kbHlFcnJvcihlcnI6IEh0dHBFcnJvclJlc3BvbnNlLCB1cmw6IHN0cmluZyk6IEVycm9yIHtcclxuICAgIGNvbnN0IGRldGFpbDogc3RyaW5nID0gZXJyLmVycm9yPy5kZXRhaWwgfHwgZXJyLmVycm9yPy5tZXNzYWdlIHx8ICcnO1xyXG4gICAgaWYgKGVyci5zdGF0dXMgPT09IDQwNCAmJiBkZXRhaWwudG9Mb3dlckNhc2UoKS5pbmNsdWRlcygnbm90IGZvdW5kJykpIHtcclxuICAgICAgcmV0dXJuIG5ldyBFcnJvcignQXR0YWNobWVudCBub3QgYXZhaWxhYmxlIG9yIG5vdCB1cGxvYWRlZCB5ZXQuJyk7XHJcbiAgICB9XHJcbiAgICBpZiAoZXJyLnN0YXR1cyA9PT0gNDAxKSByZXR1cm4gbmV3IEVycm9yKCdVbmF1dGhvcml6ZWQg4oCUIGNoZWNrIHN0b3JhZ2UgQVBJIGtleSBjb25maWd1cmF0aW9uLicpO1xyXG4gICAgaWYgKGVyci5zdGF0dXMgPT09IDApICAgcmV0dXJuIG5ldyBFcnJvcignTmV0d29yayBlcnJvciDigJQgc3RvcmFnZSBzZXJ2aWNlIHVucmVhY2hhYmxlLicpO1xyXG4gICAgcmV0dXJuIG5ldyBFcnJvcihkZXRhaWwgfHwgYFN0b3JhZ2UgcmVxdWVzdCBmYWlsZWQgKCR7ZXJyLnN0YXR1c30pIOKAlCAke3VybH1gKTtcclxuICB9XHJcbn1cclxuIl19