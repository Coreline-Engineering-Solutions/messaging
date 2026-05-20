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
    sendMessageWithAttachments(conversationId, senderContactId, content, fileIds, filenames, mimeTypes = []) {
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
            mime_types: mimeTypes,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVzc2FnaW5nLWZpbGUuc2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9saWIvc2VydmljZXMvbWVzc2FnaW5nLWZpbGUuc2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sRUFBRSxNQUFNLGVBQWUsQ0FBQztBQUVuRCxPQUFPLEVBQWMsVUFBVSxFQUFFLFFBQVEsRUFBRSxFQUFFLEVBQUUsTUFBTSxNQUFNLENBQUM7QUFDNUQsT0FBTyxFQUFFLFVBQVUsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLE1BQU0sZ0JBQWdCLENBQUM7QUFDdEQsT0FBTyxFQUFFLGdCQUFnQixFQUFtQixNQUFNLHFCQUFxQixDQUFDOzs7O0FBa0J4RSx5REFBeUQ7QUFDekQsTUFBTSxXQUFXLEdBQUcsT0FBTyxDQUFDO0FBQzVCLFNBQVMsUUFBUSxDQUFDLEVBQTZCO0lBQzdDLE9BQU8sQ0FBQyxFQUFFLElBQUksRUFBRSxDQUFDLFVBQVUsQ0FBQyxXQUFXLENBQUMsQ0FBQztBQUMzQyxDQUFDO0FBR0QsTUFBTSxPQUFPLG9CQUFvQjtJQWFyQjtJQUNBO0lBQzBCO0lBZHBDLHNFQUFzRTtJQUNyRCxJQUFJLENBQVM7SUFFOUIsMkVBQTJFO0lBQzFELGVBQWUsQ0FBVztJQUMxQixpQkFBaUIsQ0FBVztJQUM1QixlQUFlLENBQVc7SUFFM0Msb0VBQW9FO0lBQ25ELFVBQVUsR0FBRyxJQUFJLEdBQUcsRUFBa0IsQ0FBQztJQUV4RCxZQUNVLElBQWdCLEVBQ2hCLElBQWlCLEVBQ1MsTUFBdUI7UUFGakQsU0FBSSxHQUFKLElBQUksQ0FBWTtRQUNoQixTQUFJLEdBQUosSUFBSSxDQUFhO1FBQ1MsV0FBTSxHQUFOLE1BQU0sQ0FBaUI7UUFFekQsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFFLEVB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T0FBTyxJQUFJLEtBQUssQ0FBQyw4Q0FBOEMsQ0FBQyxDQUFDO1FBQ3pGLE9BQU8sSUFBSSxLQUFLLENBQUMsTUFBTSxJQUFJLDJCQUEyQixHQUFHLENBQUMsTUFBTSxPQUFPLEdBQUcsRUFBRSxDQUFDLENBQUM7SUFDaEYsQ0FBQzt3R0FqS1Usb0JBQW9CLHVFQWVyQixnQkFBZ0I7NEdBZmYsb0JBQW9CLGNBRFAsTUFBTTs7NEZBQ25CLG9CQUFvQjtrQkFEaEMsVUFBVTttQkFBQyxFQUFFLFVBQVUsRUFBRSxNQUFNLEVBQUU7OzBCQWdCN0IsTUFBTTsyQkFBQyxnQkFBZ0IiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBJbmplY3RhYmxlLCBJbmplY3QgfSBmcm9tICdAYW5ndWxhci9jb3JlJztcbmltcG9ydCB7IEh0dHBDbGllbnQsIEh0dHBFcnJvclJlc3BvbnNlIH0gZnJvbSAnQGFuZ3VsYXIvY29tbW9uL2h0dHAnO1xuaW1wb3J0IHsgT2JzZXJ2YWJsZSwgdGhyb3dFcnJvciwgZm9ya0pvaW4sIG9mIH0gZnJvbSAncnhqcyc7XG5pbXBvcnQgeyBjYXRjaEVycm9yLCBtYXAsIHRhcCB9IGZyb20gJ3J4anMvb3BlcmF0b3JzJztcbmltcG9ydCB7IE1FU1NBR0lOR19DT05GSUcsIE1lc3NhZ2luZ0NvbmZpZyB9IGZyb20gJy4uL21lc3NhZ2luZy5jb25maWcnO1xuaW1wb3J0IHsgQXV0aFNlcnZpY2UgfSBmcm9tICcuL2F1dGguc2VydmljZSc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgRmlsZVVwbG9hZFJlc3BvbnNlIHtcbiAgZmlsZV9pZDogc3RyaW5nO1xuICBmaWxlbmFtZTogc3RyaW5nO1xuICBtaW1lX3R5cGU6IHN0cmluZztcbiAgc2l6ZV9ieXRlczogbnVtYmVyO1xuICB1cmw/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgRmlsZVJldHJpZXZlUmVzcG9uc2Uge1xuICBmaWxlX2lkOiBzdHJpbmc7XG4gIGZpbGVuYW1lOiBzdHJpbmc7XG4gIG1pbWVfdHlwZTogc3RyaW5nO1xuICBiYXNlNjRfZGF0YTogc3RyaW5nO1xufVxuXG4vKiogU2VudGluZWwgcHJlZml4IOKAlCBuZXZlciBzZW5kIHRoZXNlIElEcyB0byBhbnkgQVBJLiAqL1xuY29uc3QgVEVNUF9QUkVGSVggPSAndGVtcC0nO1xuZnVuY3Rpb24gaXNUZW1wSWQoaWQ6IHN0cmluZyB8IG51bGwgfCB1bmRlZmluZWQpOiBib29sZWFuIHtcbiAgcmV0dXJuICFpZCB8fCBpZC5zdGFydHNXaXRoKFRFTVBfUFJFRklYKTtcbn1cblxuQEluamVjdGFibGUoeyBwcm92aWRlZEluOiAncm9vdCcgfSlcbmV4cG9ydCBjbGFzcyBNZXNzYWdpbmdGaWxlU2VydmljZSB7XG4gIC8qKiBCYXNlIFVSTCwgZS5nLiBodHRwczovL2Nlcy10aWNrZXRpbmctc3lzdGVtLWRiLm9ucmVuZGVyLmNvbS9hcGkgKi9cbiAgcHJpdmF0ZSByZWFkb25seSBiYXNlOiBzdHJpbmc7XG5cbiAgLyoqIE9yZGVyZWQgZmFsbGJhY2sgbGlzdHMg4oCUIHRyaWVkIHRvcC10by1ib3R0b20gb24gNDA0IC8gbmV0d29yayBlcnJvci4gKi9cbiAgcHJpdmF0ZSByZWFkb25seSB1cGxvYWRFbmRwb2ludHM6IHN0cmluZ1tdO1xuICBwcml2YXRlIHJlYWRvbmx5IHJldHJpZXZlRW5kcG9pbnRzOiBzdHJpbmdbXTtcbiAgcHJpdmF0ZSByZWFkb25seSBkZWxldGVFbmRwb2ludHM6IHN0cmluZ1tdO1xuXG4gIC8qKiBJbi1zZXNzaW9uIGNhY2hlOiBmaWxlX2lkIOKGkiBkYXRhIFVSTC4gQ2xlYXJlZCBvbiBwYWdlIHJlbG9hZC4gKi9cbiAgcHJpdmF0ZSByZWFkb25seSBtZWRpYUNhY2hlID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIGh0dHA6IEh0dHBDbGllbnQsXG4gICAgcHJpdmF0ZSBhdXRoOiBBdXRoU2VydmljZSxcbiAgICBASW5qZWN0KE1FU1NBR0lOR19DT05GSUcpIHByaXZhdGUgY29uZmlnOiBNZXNzYWdpbmdDb25maWdcbiAgKSB7XG4gICAgdGhpcy5iYXNlID0gdGhpcy5jb25maWcuYXBpQmFzZVVybC5yZXBsYWNlKC9cXC8rJC8sICcnKTtcblxuICAgIHRoaXMudXBsb2FkRW5kcG9pbnRzICAgPSBbYCR7dGhpcy5iYXNlfS9zdG9yYWdlL3VwbG9hZGAsICAgYCR7dGhpcy5iYXNlfS9tZXNzYWdpbmcvc3RvcmFnZS91cGxvYWRgLCAgIGAke3RoaXMuYmFzZX0vbWVzc2FnaW5nL2ZpbGVzL3VwbG9hZGBdO1xuICAgIHRoaXMucmV0cmlldmVFbmRwb2ludHMgPSBbYCR7dGhpcy5iYXNlfS9zdG9yYWdlL3JldHJpZXZlYCwgYCR7dGhpcy5iYXNlfS9tZXNzYWdpbmcvc3RvcmFnZS9yZXRyaWV2ZWAsIGAke3RoaXMuYmFzZX0vbWVzc2FnaW5nL2ZpbGVzL3JldHJpZXZlYF07XG4gICAgdGhpcy5kZWxldGVFbmRwb2ludHMgICA9IFtgJHt0aGlzLmJhc2V9L3N0b3JhZ2UvZGVsZXRlYCwgICBgJHt0aGlzLmJhc2V9L21lc3NhZ2luZy9zdG9yYWdlL2RlbGV0ZWAsICAgYCR7dGhpcy5iYXNlfS9tZXNzYWdpbmcvZmlsZXMvZGVsZXRlYF07XG4gIH1cblxuICAvLyDilIDilIAgVXBsb2FkIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuXG4gIHVwbG9hZEZpbGUoZmlsZTogRmlsZSwgY2F0ZWdvcnkgPSAnbWVzc2FnaW5nX2F0dGFjaG1lbnRzJyk6IE9ic2VydmFibGU8RmlsZVVwbG9hZFJlc3BvbnNlPiB7XG4gICAgY29uc3QgbWFrZUJvZHkgPSAoKSA9PiB7XG4gICAgICBjb25zdCBmZCA9IG5ldyBGb3JtRGF0YSgpO1xuICAgICAgZmQuYXBwZW5kKCdmaWxlJywgZmlsZSwgZmlsZS5uYW1lKTtcbiAgICAgIGZkLmFwcGVuZCgnY2F0ZWdvcnknLCBjYXRlZ29yeSk7XG4gICAgICByZXR1cm4gZmQ7XG4gICAgfTtcbiAgICByZXR1cm4gdGhpcy50cnlFbmRwb2ludHM8RmlsZVVwbG9hZFJlc3BvbnNlPih0aGlzLnVwbG9hZEVuZHBvaW50cywgbWFrZUJvZHkpO1xuICB9XG5cbiAgdXBsb2FkRmlsZXMoZmlsZXM6IEZpbGVbXSk6IE9ic2VydmFibGU8RmlsZVVwbG9hZFJlc3BvbnNlW10+IHtcbiAgICBpZiAoZmlsZXMubGVuZ3RoID09PSAwKSByZXR1cm4gb2YoW10pO1xuICAgIHJldHVybiBmb3JrSm9pbihmaWxlcy5tYXAoKGYpID0+IHRoaXMudXBsb2FkRmlsZShmKSkpO1xuICB9XG5cbiAgLy8g4pSA4pSAIFJldHJpZXZlIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuXG4gIHJldHJpZXZlRmlsZShmaWxlSWQ6IHN0cmluZyk6IE9ic2VydmFibGU8RmlsZVJldHJpZXZlUmVzcG9uc2U+IHtcbiAgICBpZiAoaXNUZW1wSWQoZmlsZUlkKSkge1xuICAgICAgcmV0dXJuIHRocm93RXJyb3IoKCkgPT4gbmV3IEVycm9yKCdDYW5ub3QgcmV0cmlldmUgZmlsZTogdXBsb2FkIG5vdCBjb21wbGV0ZSB5ZXQuJykpO1xuICAgIH1cbiAgICBjb25zdCBtYWtlQm9keSA9ICgpID0+IHtcbiAgICAgIGNvbnN0IGZkID0gbmV3IEZvcm1EYXRhKCk7XG4gICAgICBmZC5hcHBlbmQoJ2ZpbGVfaWQnLCBmaWxlSWQpO1xuICAgICAgcmV0dXJuIGZkO1xuICAgIH07XG4gICAgcmV0dXJuIHRoaXMudHJ5RW5kcG9pbnRzPEZpbGVSZXRyaWV2ZVJlc3BvbnNlPih0aGlzLnJldHJpZXZlRW5kcG9pbnRzLCBtYWtlQm9keSk7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyBhIGRhdGEgVVJMIGZvciB0aGUgZ2l2ZW4gZmlsZV9pZC5cbiAgICogQ2FjaGVkIGluIG1lbW9yeSBmb3IgdGhlIHNlc3Npb24gbGlmZXRpbWUg4oCUIG5ldmVyIHJlLWZldGNoZWQgaWYgYWxyZWFkeSBsb2FkZWQuXG4gICAqL1xuICBnZXRGaWxlRGF0YVVybChmaWxlSWQ6IHN0cmluZyk6IE9ic2VydmFibGU8c3RyaW5nPiB7XG4gICAgaWYgKGlzVGVtcElkKGZpbGVJZCkpIHtcbiAgICAgIHJldHVybiB0aHJvd0Vycm9yKCgpID0+IG5ldyBFcnJvcignQ2Fubm90IHJldHJpZXZlIGZpbGU6IHVwbG9hZCBub3QgY29tcGxldGUgeWV0LicpKTtcbiAgICB9XG4gICAgY29uc3QgY2FjaGVkID0gdGhpcy5tZWRpYUNhY2hlLmdldChmaWxlSWQpO1xuICAgIGlmIChjYWNoZWQpIHJldHVybiBvZihjYWNoZWQpO1xuXG4gICAgcmV0dXJuIHRoaXMucmV0cmlldmVGaWxlKGZpbGVJZCkucGlwZShcbiAgICAgIG1hcCgocikgPT4gYGRhdGE6JHtyLm1pbWVfdHlwZX07YmFzZTY0LCR7ci5iYXNlNjRfZGF0YX1gKSxcbiAgICAgIHRhcCgoZGF0YVVybCkgPT4gdGhpcy5tZWRpYUNhY2hlLnNldChmaWxlSWQsIGRhdGFVcmwpKVxuICAgICk7XG4gIH1cblxuICAvKiogU3luY2hyb25vdXMgY2FjaGUgbG9va3VwIOKAlCBudWxsIGlmIG5vdCBsb2FkZWQgeWV0LiAqL1xuICBnZXRDYWNoZWREYXRhVXJsKGZpbGVJZDogc3RyaW5nKTogc3RyaW5nIHwgbnVsbCB7XG4gICAgaWYgKGlzVGVtcElkKGZpbGVJZCkpIHJldHVybiBudWxsO1xuICAgIHJldHVybiB0aGlzLm1lZGlhQ2FjaGUuZ2V0KGZpbGVJZCkgPz8gbnVsbDtcbiAgfVxuXG4gIC8qKiBQcmUtd2FybSBjYWNoZSBmb3IgYSBsaXN0IG9mIGZpbGUgSURzIChmaXJlLWFuZC1mb3JnZXQsIHNraXBzIHRlbXAvY2FjaGVkKS4gKi9cbiAgcHJld2FybUNhY2hlKGZpbGVJZHM6IHN0cmluZ1tdKTogdm9pZCB7XG4gICAgZm9yIChjb25zdCBpZCBvZiBmaWxlSWRzKSB7XG4gICAgICBpZiAoIWlzVGVtcElkKGlkKSAmJiAhdGhpcy5tZWRpYUNhY2hlLmhhcyhpZCkpIHtcbiAgICAgICAgdGhpcy5nZXRGaWxlRGF0YVVybChpZCkuc3Vic2NyaWJlKHsgZXJyb3I6ICgpID0+IHt9IH0pO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIOKUgOKUgCBEZWxldGUg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5cbiAgZGVsZXRlRmlsZShmaWxlSWQ6IHN0cmluZyk6IE9ic2VydmFibGU8YW55PiB7XG4gICAgaWYgKGlzVGVtcElkKGZpbGVJZCkpIHtcbiAgICAgIHJldHVybiBvZihudWxsKTtcbiAgICB9XG4gICAgdGhpcy5tZWRpYUNhY2hlLmRlbGV0ZShmaWxlSWQpO1xuICAgIGNvbnN0IG1ha2VCb2R5ID0gKCkgPT4ge1xuICAgICAgY29uc3QgZmQgPSBuZXcgRm9ybURhdGEoKTtcbiAgICAgIGZkLmFwcGVuZCgnZmlsZV9pZCcsIGZpbGVJZCk7XG4gICAgICByZXR1cm4gZmQ7XG4gICAgfTtcbiAgICByZXR1cm4gdGhpcy50cnlFbmRwb2ludHModGhpcy5kZWxldGVFbmRwb2ludHMsIG1ha2VCb2R5KTtcbiAgfVxuXG4gIC8vIOKUgOKUgCBTZW5kIG1lc3NhZ2Ugd2l0aCBhdHRhY2htZW50cyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcblxuICBzZW5kTWVzc2FnZVdpdGhBdHRhY2htZW50cyhcbiAgICBjb252ZXJzYXRpb25JZDogc3RyaW5nLFxuICAgIHNlbmRlckNvbnRhY3RJZDogc3RyaW5nLFxuICAgIGNvbnRlbnQ6IHN0cmluZyxcbiAgICBmaWxlSWRzOiBzdHJpbmdbXSxcbiAgICBmaWxlbmFtZXM6IHN0cmluZ1tdLFxuICAgIG1pbWVUeXBlczogc3RyaW5nW10gPSBbXVxuICApOiBPYnNlcnZhYmxlPGFueT4ge1xuICAgIC8vIEd1YXJkOiBuZXZlciBzZW5kIHRlbXAgZmlsZSBJRHMgdG8gdGhlIGJhY2tlbmRcbiAgICBjb25zdCByZWFsSWRzID0gZmlsZUlkcy5maWx0ZXIoaWQgPT4gIWlzVGVtcElkKGlkKSk7XG4gICAgaWYgKHJlYWxJZHMubGVuZ3RoICE9PSBmaWxlSWRzLmxlbmd0aCkge1xuICAgICAgcmV0dXJuIHRocm93RXJyb3IoKCkgPT4gbmV3IEVycm9yKCdVcGxvYWQgbm90IGZpbmlzaGVkIOKAlCBjYW5ub3QgYXR0YWNoIHRlbXAgZmlsZS4nKSk7XG4gICAgfVxuICAgIGNvbnN0IG1lc3NhZ2luZ0Jhc2UgPSBgJHt0aGlzLmJhc2V9L21lc3NhZ2luZ2A7XG4gICAgcmV0dXJuIHRoaXMuaHR0cC5wb3N0KGAke21lc3NhZ2luZ0Jhc2V9L2NvbnZlcnNhdGlvbnMvJHtjb252ZXJzYXRpb25JZH0vbWVzc2FnZXNgLCB7XG4gICAgICBzZW5kZXJfaWQ6IHBhcnNlSW50KHNlbmRlckNvbnRhY3RJZCwgMTApLFxuICAgICAgY29udGVudDogY29udGVudCB8fCAnJyxcbiAgICAgIGF0dGFjaG1lbnRfaWRzOiByZWFsSWRzLFxuICAgICAgZmlsZW5hbWVzLFxuICAgICAgbWltZV90eXBlczogbWltZVR5cGVzLFxuICAgIH0pO1xuICB9XG5cbiAgLy8g4pSA4pSAIEZhbGxiYWNrIGVuZ2luZSDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcblxuICAvKipcbiAgICogUE9TVCBlYWNoIFVSTCBpbiBgdXJsc2Agc2VxdWVudGlhbGx5ICh1c2luZyB0aGUgYm9keSBmcm9tIGBib2R5Rm4oKWApLlxuICAgKiBGYWxscyBiYWNrIHRvIHRoZSBuZXh0IFVSTCBvbmx5IG9uIDQwNCBvciBuZXR3b3JrIGVycm9yIChzdGF0dXMgMCkuXG4gICAqIExvZ3MgZXZlcnkgYXR0ZW1wdCB3aXRoIGl0cyByZXN1bHQuXG4gICAqL1xuICBwcml2YXRlIHRyeUVuZHBvaW50czxUPih1cmxzOiBzdHJpbmdbXSwgYm9keUZuOiAoKSA9PiBGb3JtRGF0YSk6IE9ic2VydmFibGU8VD4ge1xuICAgIGlmICh1cmxzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIHRocm93RXJyb3IoKCkgPT4gbmV3IEVycm9yKCdBbGwgc3RvcmFnZSBlbmRwb2ludHMgZXhoYXVzdGVkLicpKTtcbiAgICB9XG5cbiAgICBjb25zdCBbdXJsLCAuLi5yZXN0XSA9IHVybHM7XG4gICAgcmV0dXJuIHRoaXMuaHR0cC5wb3N0PFQ+KHVybCwgYm9keUZuKCkpLnBpcGUoXG4gICAgICBjYXRjaEVycm9yKChlcnI6IEh0dHBFcnJvclJlc3BvbnNlKSA9PiB7XG4gICAgICAgIC8vIE9ubHkgZmFsbCB0aHJvdWdoIG9uIG5vdC1mb3VuZCBvciBuZXR3b3JrIGlzc3Vlc1xuICAgICAgICBpZiAoKGVyci5zdGF0dXMgPT09IDQwNCB8fCBlcnIuc3RhdHVzID09PSAwKSAmJiByZXN0Lmxlbmd0aCA+IDApIHtcbiAgICAgICAgICByZXR1cm4gdGhpcy50cnlFbmRwb2ludHM8VD4ocmVzdCwgYm9keUZuKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFRyYW5zbGF0ZSB0byBhIGZyaWVuZGx5IGVycm9yXG4gICAgICAgIHJldHVybiB0aHJvd0Vycm9yKCgpID0+IHRoaXMudG9GcmllbmRseUVycm9yKGVyciwgdXJsKSk7XG4gICAgICB9KVxuICAgICk7XG4gIH1cblxuICBwcml2YXRlIHRvRnJpZW5kbHlFcnJvcihlcnI6IEh0dHBFcnJvclJlc3BvbnNlLCB1cmw6IHN0cmluZyk6IEVycm9yIHtcbiAgICBjb25zdCBkZXRhaWw6IHN0cmluZyA9IGVyci5lcnJvcj8uZGV0YWlsIHx8IGVyci5lcnJvcj8ubWVzc2FnZSB8fCAnJztcbiAgICBpZiAoZXJyLnN0YXR1cyA9PT0gNDA0ICYmIGRldGFpbC50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKCdub3QgZm91bmQnKSkge1xuICAgICAgcmV0dXJuIG5ldyBFcnJvcignQXR0YWNobWVudCBub3QgYXZhaWxhYmxlIG9yIG5vdCB1cGxvYWRlZCB5ZXQuJyk7XG4gICAgfVxuICAgIGlmIChlcnIuc3RhdHVzID09PSA0MDEpIHJldHVybiBuZXcgRXJyb3IoJ1VuYXV0aG9yaXplZCDigJQgY2hlY2sgc3RvcmFnZSBBUEkga2V5IGNvbmZpZ3VyYXRpb24uJyk7XG4gICAgaWYgKGVyci5zdGF0dXMgPT09IDApICAgcmV0dXJuIG5ldyBFcnJvcignTmV0d29yayBlcnJvciDigJQgc3RvcmFnZSBzZXJ2aWNlIHVucmVhY2hhYmxlLicpO1xuICAgIHJldHVybiBuZXcgRXJyb3IoZGV0YWlsIHx8IGBTdG9yYWdlIHJlcXVlc3QgZmFpbGVkICgke2Vyci5zdGF0dXN9KSDigJQgJHt1cmx9YCk7XG4gIH1cbn1cbiJdfQ==