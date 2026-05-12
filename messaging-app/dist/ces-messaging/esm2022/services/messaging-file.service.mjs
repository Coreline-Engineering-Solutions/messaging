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
            console.warn('[FileService] Blocked retrieve — temp ID:', fileId);
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
            console.warn('[FileService] Blocked delete — temp ID:', fileId);
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
            console.error('[FileService] sendMessageWithAttachments called with temp IDs — aborting', fileIds);
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
        return this.http.post(url, bodyFn()).pipe(tap(() => console.debug(`[FileService] ✓ ${url}`)), catchError((err) => {
            const body = err.error ? JSON.stringify(err.error) : '(no body)';
            console.warn(`[FileService] ✗ ${url} → ${err.status}: ${body}`);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVzc2FnaW5nLWZpbGUuc2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9saWIvc2VydmljZXMvbWVzc2FnaW5nLWZpbGUuc2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sRUFBRSxNQUFNLGVBQWUsQ0FBQztBQUVuRCxPQUFPLEVBQWMsVUFBVSxFQUFFLFFBQVEsRUFBRSxFQUFFLEVBQUUsTUFBTSxNQUFNLENBQUM7QUFDNUQsT0FBTyxFQUFFLFVBQVUsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLE1BQU0sZ0JBQWdCLENBQUM7QUFDdEQsT0FBTyxFQUFFLGdCQUFnQixFQUFtQixNQUFNLHFCQUFxQixDQUFDOzs7O0FBa0J4RSx5REFBeUQ7QUFDekQsTUFBTSxXQUFXLEdBQUcsT0FBTyxDQUFDO0FBQzVCLFNBQVMsUUFBUSxDQUFDLEVBQTZCO0lBQzdDLE9BQU8sQ0FBQyxFQUFFLElBQUksRUFBRSxDQUFDLFVBQVUsQ0FBQyxXQUFXLENBQUMsQ0FBQztBQUMzQyxDQUFDO0FBR0QsTUFBTSxPQUFPLG9CQUFvQjtJQWFyQjtJQUNBO0lBQzBCO0lBZHBDLHNFQUFzRTtJQUNyRCxJQUFJLENBQVM7SUFFOUIsMkVBQTJFO0lBQzFELGVBQWUsQ0FBVztJQUMxQixpQkFBaUIsQ0FBVztJQUM1QixlQUFlLENBQVc7SUFFM0Msb0VBQW9FO0lBQ25ELFVBQVUsR0FBRyxJQUFJLEdBQUcsRUFBa0IsQ0FBQztJQUV4RCxZQUNVLElBQWdCLEVBQ2hCLElBQWlCLEVBQ1MsTUFBdUI7UUFGakQsU0FBSSxHQUFKLElBQUksQ0FBWTtRQUNoQixTQUFJLEdBQUosSUFBSSxDQUFhO1FBQ1MsV0FBTSxHQUFOLE1BQU0sQ0FBaUI7UUFFekQsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFFLEVB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Q0osQ0FBQztJQUVPLGVBQWUsQ0FBQyxHQUFzQixFQUFFLEdBQVc7UUFDekQsTUFBTSxNQUFNLEdBQVcsR0FBRyxDQUFDLEtBQUssRUFBRSxNQUFNLElBQUksR0FBRyxDQUFDLEtBQUssRUFBRSxPQUFPLElBQUksRUFBRSxDQUFDO1FBQ3JFLElBQUksR0FBRyxDQUFDLE1BQU0sS0FBSyxHQUFHLElBQUksTUFBTSxDQUFDLFdBQVcsRUFBRSxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMsRUFBRSxDQUFDO1lBQ3JFLE9BQU8sSUFBSSxLQUFLLENBQUMsK0NBQStDLENBQUMsQ0FBQztRQUNwRSxDQUFDO1FBQ0QsSUFBSSxHQUFHLENBQUMsTUFBTSxLQUFLLEdBQUc7WUFBRSxPQUFPLElBQUksS0FBSyxDQUFDLHFEQUFxRCxDQUFDLENBQUM7UUFDaEcsSUFBSSxHQUFHLENBQUMsTUFBTSxLQUFLLENBQUM7WUFBSSxPQUFPLElBQUksS0FBSyxDQUFDLDhDQUE4QyxDQUFDLENBQUM7UUFDekYsT0FBTyxJQUFJLEtBQUssQ0FBQyxNQUFNLElBQUksMkJBQTJCLEdBQUcsQ0FBQyxNQUFNLE9BQU8sR0FBRyxFQUFFLENBQUMsQ0FBQztJQUNoRixDQUFDO3dHQXRLVSxvQkFBb0IsdUVBZXJCLGdCQUFnQjs0R0FmZixvQkFBb0IsY0FEUCxNQUFNOzs0RkFDbkIsb0JBQW9CO2tCQURoQyxVQUFVO21CQUFDLEVBQUUsVUFBVSxFQUFFLE1BQU0sRUFBRTs7MEJBZ0I3QixNQUFNOzJCQUFDLGdCQUFnQiIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEluamVjdGFibGUsIEluamVjdCB9IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xyXG5pbXBvcnQgeyBIdHRwQ2xpZW50LCBIdHRwRXJyb3JSZXNwb25zZSB9IGZyb20gJ0Bhbmd1bGFyL2NvbW1vbi9odHRwJztcclxuaW1wb3J0IHsgT2JzZXJ2YWJsZSwgdGhyb3dFcnJvciwgZm9ya0pvaW4sIG9mIH0gZnJvbSAncnhqcyc7XHJcbmltcG9ydCB7IGNhdGNoRXJyb3IsIG1hcCwgdGFwIH0gZnJvbSAncnhqcy9vcGVyYXRvcnMnO1xyXG5pbXBvcnQgeyBNRVNTQUdJTkdfQ09ORklHLCBNZXNzYWdpbmdDb25maWcgfSBmcm9tICcuLi9tZXNzYWdpbmcuY29uZmlnJztcclxuaW1wb3J0IHsgQXV0aFNlcnZpY2UgfSBmcm9tICcuL2F1dGguc2VydmljZSc7XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIEZpbGVVcGxvYWRSZXNwb25zZSB7XHJcbiAgZmlsZV9pZDogc3RyaW5nO1xyXG4gIGZpbGVuYW1lOiBzdHJpbmc7XHJcbiAgbWltZV90eXBlOiBzdHJpbmc7XHJcbiAgc2l6ZV9ieXRlczogbnVtYmVyO1xyXG4gIHVybD86IHN0cmluZztcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBGaWxlUmV0cmlldmVSZXNwb25zZSB7XHJcbiAgZmlsZV9pZDogc3RyaW5nO1xyXG4gIGZpbGVuYW1lOiBzdHJpbmc7XHJcbiAgbWltZV90eXBlOiBzdHJpbmc7XHJcbiAgYmFzZTY0X2RhdGE6IHN0cmluZztcclxufVxyXG5cclxuLyoqIFNlbnRpbmVsIHByZWZpeCDigJQgbmV2ZXIgc2VuZCB0aGVzZSBJRHMgdG8gYW55IEFQSS4gKi9cclxuY29uc3QgVEVNUF9QUkVGSVggPSAndGVtcC0nO1xyXG5mdW5jdGlvbiBpc1RlbXBJZChpZDogc3RyaW5nIHwgbnVsbCB8IHVuZGVmaW5lZCk6IGJvb2xlYW4ge1xyXG4gIHJldHVybiAhaWQgfHwgaWQuc3RhcnRzV2l0aChURU1QX1BSRUZJWCk7XHJcbn1cclxuXHJcbkBJbmplY3RhYmxlKHsgcHJvdmlkZWRJbjogJ3Jvb3QnIH0pXHJcbmV4cG9ydCBjbGFzcyBNZXNzYWdpbmdGaWxlU2VydmljZSB7XHJcbiAgLyoqIEJhc2UgVVJMLCBlLmcuIGh0dHBzOi8vY2VzLXRpY2tldGluZy1zeXN0ZW0tZGIub25yZW5kZXIuY29tL2FwaSAqL1xyXG4gIHByaXZhdGUgcmVhZG9ubHkgYmFzZTogc3RyaW5nO1xyXG5cclxuICAvKiogT3JkZXJlZCBmYWxsYmFjayBsaXN0cyDigJQgdHJpZWQgdG9wLXRvLWJvdHRvbSBvbiA0MDQgLyBuZXR3b3JrIGVycm9yLiAqL1xyXG4gIHByaXZhdGUgcmVhZG9ubHkgdXBsb2FkRW5kcG9pbnRzOiBzdHJpbmdbXTtcclxuICBwcml2YXRlIHJlYWRvbmx5IHJldHJpZXZlRW5kcG9pbnRzOiBzdHJpbmdbXTtcclxuICBwcml2YXRlIHJlYWRvbmx5IGRlbGV0ZUVuZHBvaW50czogc3RyaW5nW107XHJcblxyXG4gIC8qKiBJbi1zZXNzaW9uIGNhY2hlOiBmaWxlX2lkIOKGkiBkYXRhIFVSTC4gQ2xlYXJlZCBvbiBwYWdlIHJlbG9hZC4gKi9cclxuICBwcml2YXRlIHJlYWRvbmx5IG1lZGlhQ2FjaGUgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xyXG5cclxuICBjb25zdHJ1Y3RvcihcclxuICAgIHByaXZhdGUgaHR0cDogSHR0cENsaWVudCxcclxuICAgIHByaXZhdGUgYXV0aDogQXV0aFNlcnZpY2UsXHJcbiAgICBASW5qZWN0KE1FU1NBR0lOR19DT05GSUcpIHByaXZhdGUgY29uZmlnOiBNZXNzYWdpbmdDb25maWdcclxuICApIHtcclxuICAgIHRoaXMuYmFzZSA9IHRoaXMuY29uZmlnLmFwaUJhc2VVcmwucmVwbGFjZSgvXFwvKyQvLCAnJyk7XHJcblxyXG4gICAgdGhpcy51cGxvYWRFbmRwb2ludHMgICA9IFtgJHt0aGlzLmJhc2V9L3N0b3JhZ2UvdXBsb2FkYCwgICBgJHt0aGlzLmJhc2V9L21lc3NhZ2luZy9zdG9yYWdlL3VwbG9hZGAsICAgYCR7dGhpcy5iYXNlfS9tZXNzYWdpbmcvZmlsZXMvdXBsb2FkYF07XHJcbiAgICB0aGlzLnJldHJpZXZlRW5kcG9pbnRzID0gW2Ake3RoaXMuYmFzZX0vc3RvcmFnZS9yZXRyaWV2ZWAsIGAke3RoaXMuYmFzZX0vbWVzc2FnaW5nL3N0b3JhZ2UvcmV0cmlldmVgLCBgJHt0aGlzLmJhc2V9L21lc3NhZ2luZy9maWxlcy9yZXRyaWV2ZWBdO1xyXG4gICAgdGhpcy5kZWxldGVFbmRwb2ludHMgICA9IFtgJHt0aGlzLmJhc2V9L3N0b3JhZ2UvZGVsZXRlYCwgICBgJHt0aGlzLmJhc2V9L21lc3NhZ2luZy9zdG9yYWdlL2RlbGV0ZWAsICAgYCR7dGhpcy5iYXNlfS9tZXNzYWdpbmcvZmlsZXMvZGVsZXRlYF07XHJcbiAgfVxyXG5cclxuICAvLyDilIDilIAgVXBsb2FkIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG5cclxuICB1cGxvYWRGaWxlKGZpbGU6IEZpbGUsIGNhdGVnb3J5ID0gJ21lc3NhZ2luZ19hdHRhY2htZW50cycpOiBPYnNlcnZhYmxlPEZpbGVVcGxvYWRSZXNwb25zZT4ge1xyXG4gICAgY29uc3QgbWFrZUJvZHkgPSAoKSA9PiB7XHJcbiAgICAgIGNvbnN0IGZkID0gbmV3IEZvcm1EYXRhKCk7XHJcbiAgICAgIGZkLmFwcGVuZCgnZmlsZScsIGZpbGUsIGZpbGUubmFtZSk7XHJcbiAgICAgIGZkLmFwcGVuZCgnY2F0ZWdvcnknLCBjYXRlZ29yeSk7XHJcbiAgICAgIHJldHVybiBmZDtcclxuICAgIH07XHJcbiAgICByZXR1cm4gdGhpcy50cnlFbmRwb2ludHM8RmlsZVVwbG9hZFJlc3BvbnNlPih0aGlzLnVwbG9hZEVuZHBvaW50cywgbWFrZUJvZHkpO1xyXG4gIH1cclxuXHJcbiAgdXBsb2FkRmlsZXMoZmlsZXM6IEZpbGVbXSk6IE9ic2VydmFibGU8RmlsZVVwbG9hZFJlc3BvbnNlW10+IHtcclxuICAgIGlmIChmaWxlcy5sZW5ndGggPT09IDApIHJldHVybiBvZihbXSk7XHJcbiAgICByZXR1cm4gZm9ya0pvaW4oZmlsZXMubWFwKChmKSA9PiB0aGlzLnVwbG9hZEZpbGUoZikpKTtcclxuICB9XHJcblxyXG4gIC8vIOKUgOKUgCBSZXRyaWV2ZSDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuXHJcbiAgcmV0cmlldmVGaWxlKGZpbGVJZDogc3RyaW5nKTogT2JzZXJ2YWJsZTxGaWxlUmV0cmlldmVSZXNwb25zZT4ge1xyXG4gICAgaWYgKGlzVGVtcElkKGZpbGVJZCkpIHtcclxuICAgICAgY29uc29sZS53YXJuKCdbRmlsZVNlcnZpY2VdIEJsb2NrZWQgcmV0cmlldmUg4oCUIHRlbXAgSUQ6JywgZmlsZUlkKTtcclxuICAgICAgcmV0dXJuIHRocm93RXJyb3IoKCkgPT4gbmV3IEVycm9yKCdDYW5ub3QgcmV0cmlldmUgZmlsZTogdXBsb2FkIG5vdCBjb21wbGV0ZSB5ZXQuJykpO1xyXG4gICAgfVxyXG4gICAgY29uc3QgbWFrZUJvZHkgPSAoKSA9PiB7XHJcbiAgICAgIGNvbnN0IGZkID0gbmV3IEZvcm1EYXRhKCk7XHJcbiAgICAgIGZkLmFwcGVuZCgnZmlsZV9pZCcsIGZpbGVJZCk7XHJcbiAgICAgIHJldHVybiBmZDtcclxuICAgIH07XHJcbiAgICByZXR1cm4gdGhpcy50cnlFbmRwb2ludHM8RmlsZVJldHJpZXZlUmVzcG9uc2U+KHRoaXMucmV0cmlldmVFbmRwb2ludHMsIG1ha2VCb2R5KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFJldHVybnMgYSBkYXRhIFVSTCBmb3IgdGhlIGdpdmVuIGZpbGVfaWQuXHJcbiAgICogQ2FjaGVkIGluIG1lbW9yeSBmb3IgdGhlIHNlc3Npb24gbGlmZXRpbWUg4oCUIG5ldmVyIHJlLWZldGNoZWQgaWYgYWxyZWFkeSBsb2FkZWQuXHJcbiAgICovXHJcbiAgZ2V0RmlsZURhdGFVcmwoZmlsZUlkOiBzdHJpbmcpOiBPYnNlcnZhYmxlPHN0cmluZz4ge1xyXG4gICAgaWYgKGlzVGVtcElkKGZpbGVJZCkpIHtcclxuICAgICAgcmV0dXJuIHRocm93RXJyb3IoKCkgPT4gbmV3IEVycm9yKCdDYW5ub3QgcmV0cmlldmUgZmlsZTogdXBsb2FkIG5vdCBjb21wbGV0ZSB5ZXQuJykpO1xyXG4gICAgfVxyXG4gICAgY29uc3QgY2FjaGVkID0gdGhpcy5tZWRpYUNhY2hlLmdldChmaWxlSWQpO1xyXG4gICAgaWYgKGNhY2hlZCkgcmV0dXJuIG9mKGNhY2hlZCk7XHJcblxyXG4gICAgcmV0dXJuIHRoaXMucmV0cmlldmVGaWxlKGZpbGVJZCkucGlwZShcclxuICAgICAgbWFwKChyKSA9PiBgZGF0YToke3IubWltZV90eXBlfTtiYXNlNjQsJHtyLmJhc2U2NF9kYXRhfWApLFxyXG4gICAgICB0YXAoKGRhdGFVcmwpID0+IHRoaXMubWVkaWFDYWNoZS5zZXQoZmlsZUlkLCBkYXRhVXJsKSlcclxuICAgICk7XHJcbiAgfVxyXG5cclxuICAvKiogU3luY2hyb25vdXMgY2FjaGUgbG9va3VwIOKAlCBudWxsIGlmIG5vdCBsb2FkZWQgeWV0LiAqL1xyXG4gIGdldENhY2hlZERhdGFVcmwoZmlsZUlkOiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHtcclxuICAgIGlmIChpc1RlbXBJZChmaWxlSWQpKSByZXR1cm4gbnVsbDtcclxuICAgIHJldHVybiB0aGlzLm1lZGlhQ2FjaGUuZ2V0KGZpbGVJZCkgPz8gbnVsbDtcclxuICB9XHJcblxyXG4gIC8qKiBQcmUtd2FybSBjYWNoZSBmb3IgYSBsaXN0IG9mIGZpbGUgSURzIChmaXJlLWFuZC1mb3JnZXQsIHNraXBzIHRlbXAvY2FjaGVkKS4gKi9cclxuICBwcmV3YXJtQ2FjaGUoZmlsZUlkczogc3RyaW5nW10pOiB2b2lkIHtcclxuICAgIGZvciAoY29uc3QgaWQgb2YgZmlsZUlkcykge1xyXG4gICAgICBpZiAoIWlzVGVtcElkKGlkKSAmJiAhdGhpcy5tZWRpYUNhY2hlLmhhcyhpZCkpIHtcclxuICAgICAgICB0aGlzLmdldEZpbGVEYXRhVXJsKGlkKS5zdWJzY3JpYmUoeyBlcnJvcjogKCkgPT4ge30gfSk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8vIOKUgOKUgCBEZWxldGUg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcblxyXG4gIGRlbGV0ZUZpbGUoZmlsZUlkOiBzdHJpbmcpOiBPYnNlcnZhYmxlPGFueT4ge1xyXG4gICAgaWYgKGlzVGVtcElkKGZpbGVJZCkpIHtcclxuICAgICAgY29uc29sZS53YXJuKCdbRmlsZVNlcnZpY2VdIEJsb2NrZWQgZGVsZXRlIOKAlCB0ZW1wIElEOicsIGZpbGVJZCk7XHJcbiAgICAgIHJldHVybiBvZihudWxsKTtcclxuICAgIH1cclxuICAgIHRoaXMubWVkaWFDYWNoZS5kZWxldGUoZmlsZUlkKTtcclxuICAgIGNvbnN0IG1ha2VCb2R5ID0gKCkgPT4ge1xyXG4gICAgICBjb25zdCBmZCA9IG5ldyBGb3JtRGF0YSgpO1xyXG4gICAgICBmZC5hcHBlbmQoJ2ZpbGVfaWQnLCBmaWxlSWQpO1xyXG4gICAgICByZXR1cm4gZmQ7XHJcbiAgICB9O1xyXG4gICAgcmV0dXJuIHRoaXMudHJ5RW5kcG9pbnRzKHRoaXMuZGVsZXRlRW5kcG9pbnRzLCBtYWtlQm9keSk7XHJcbiAgfVxyXG5cclxuICAvLyDilIDilIAgU2VuZCBtZXNzYWdlIHdpdGggYXR0YWNobWVudHMg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcblxyXG4gIHNlbmRNZXNzYWdlV2l0aEF0dGFjaG1lbnRzKFxyXG4gICAgY29udmVyc2F0aW9uSWQ6IHN0cmluZyxcclxuICAgIHNlbmRlckNvbnRhY3RJZDogc3RyaW5nLFxyXG4gICAgY29udGVudDogc3RyaW5nLFxyXG4gICAgZmlsZUlkczogc3RyaW5nW10sXHJcbiAgICBmaWxlbmFtZXM6IHN0cmluZ1tdXHJcbiAgKTogT2JzZXJ2YWJsZTxhbnk+IHtcclxuICAgIC8vIEd1YXJkOiBuZXZlciBzZW5kIHRlbXAgZmlsZSBJRHMgdG8gdGhlIGJhY2tlbmRcclxuICAgIGNvbnN0IHJlYWxJZHMgPSBmaWxlSWRzLmZpbHRlcihpZCA9PiAhaXNUZW1wSWQoaWQpKTtcclxuICAgIGlmIChyZWFsSWRzLmxlbmd0aCAhPT0gZmlsZUlkcy5sZW5ndGgpIHtcclxuICAgICAgY29uc29sZS5lcnJvcignW0ZpbGVTZXJ2aWNlXSBzZW5kTWVzc2FnZVdpdGhBdHRhY2htZW50cyBjYWxsZWQgd2l0aCB0ZW1wIElEcyDigJQgYWJvcnRpbmcnLCBmaWxlSWRzKTtcclxuICAgICAgcmV0dXJuIHRocm93RXJyb3IoKCkgPT4gbmV3IEVycm9yKCdVcGxvYWQgbm90IGZpbmlzaGVkIOKAlCBjYW5ub3QgYXR0YWNoIHRlbXAgZmlsZS4nKSk7XHJcbiAgICB9XHJcbiAgICBjb25zdCBtZXNzYWdpbmdCYXNlID0gYCR7dGhpcy5iYXNlfS9tZXNzYWdpbmdgO1xyXG4gICAgcmV0dXJuIHRoaXMuaHR0cC5wb3N0KGAke21lc3NhZ2luZ0Jhc2V9L2NvbnZlcnNhdGlvbnMvJHtjb252ZXJzYXRpb25JZH0vbWVzc2FnZXNgLCB7XHJcbiAgICAgIHNlbmRlcl9pZDogcGFyc2VJbnQoc2VuZGVyQ29udGFjdElkLCAxMCksXHJcbiAgICAgIGNvbnRlbnQ6IGNvbnRlbnQgfHwgJycsXHJcbiAgICAgIGF0dGFjaG1lbnRfaWRzOiByZWFsSWRzLFxyXG4gICAgICBmaWxlbmFtZXMsXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8vIOKUgOKUgCBGYWxsYmFjayBlbmdpbmUg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcblxyXG4gIC8qKlxyXG4gICAqIFBPU1QgZWFjaCBVUkwgaW4gYHVybHNgIHNlcXVlbnRpYWxseSAodXNpbmcgdGhlIGJvZHkgZnJvbSBgYm9keUZuKClgKS5cclxuICAgKiBGYWxscyBiYWNrIHRvIHRoZSBuZXh0IFVSTCBvbmx5IG9uIDQwNCBvciBuZXR3b3JrIGVycm9yIChzdGF0dXMgMCkuXHJcbiAgICogTG9ncyBldmVyeSBhdHRlbXB0IHdpdGggaXRzIHJlc3VsdC5cclxuICAgKi9cclxuICBwcml2YXRlIHRyeUVuZHBvaW50czxUPih1cmxzOiBzdHJpbmdbXSwgYm9keUZuOiAoKSA9PiBGb3JtRGF0YSk6IE9ic2VydmFibGU8VD4ge1xyXG4gICAgaWYgKHVybHMubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgIHJldHVybiB0aHJvd0Vycm9yKCgpID0+IG5ldyBFcnJvcignQWxsIHN0b3JhZ2UgZW5kcG9pbnRzIGV4aGF1c3RlZC4nKSk7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgW3VybCwgLi4ucmVzdF0gPSB1cmxzO1xyXG4gICAgcmV0dXJuIHRoaXMuaHR0cC5wb3N0PFQ+KHVybCwgYm9keUZuKCkpLnBpcGUoXHJcbiAgICAgIHRhcCgoKSA9PiBjb25zb2xlLmRlYnVnKGBbRmlsZVNlcnZpY2VdIOKckyAke3VybH1gKSksXHJcbiAgICAgIGNhdGNoRXJyb3IoKGVycjogSHR0cEVycm9yUmVzcG9uc2UpID0+IHtcclxuICAgICAgICBjb25zdCBib2R5ID0gZXJyLmVycm9yID8gSlNPTi5zdHJpbmdpZnkoZXJyLmVycm9yKSA6ICcobm8gYm9keSknO1xyXG4gICAgICAgIGNvbnNvbGUud2FybihgW0ZpbGVTZXJ2aWNlXSDinJcgJHt1cmx9IOKGkiAke2Vyci5zdGF0dXN9OiAke2JvZHl9YCk7XHJcblxyXG4gICAgICAgIC8vIE9ubHkgZmFsbCB0aHJvdWdoIG9uIG5vdC1mb3VuZCBvciBuZXR3b3JrIGlzc3Vlc1xyXG4gICAgICAgIGlmICgoZXJyLnN0YXR1cyA9PT0gNDA0IHx8IGVyci5zdGF0dXMgPT09IDApICYmIHJlc3QubGVuZ3RoID4gMCkge1xyXG4gICAgICAgICAgcmV0dXJuIHRoaXMudHJ5RW5kcG9pbnRzPFQ+KHJlc3QsIGJvZHlGbik7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBUcmFuc2xhdGUgdG8gYSBmcmllbmRseSBlcnJvclxyXG4gICAgICAgIHJldHVybiB0aHJvd0Vycm9yKCgpID0+IHRoaXMudG9GcmllbmRseUVycm9yKGVyciwgdXJsKSk7XHJcbiAgICAgIH0pXHJcbiAgICApO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSB0b0ZyaWVuZGx5RXJyb3IoZXJyOiBIdHRwRXJyb3JSZXNwb25zZSwgdXJsOiBzdHJpbmcpOiBFcnJvciB7XHJcbiAgICBjb25zdCBkZXRhaWw6IHN0cmluZyA9IGVyci5lcnJvcj8uZGV0YWlsIHx8IGVyci5lcnJvcj8ubWVzc2FnZSB8fCAnJztcclxuICAgIGlmIChlcnIuc3RhdHVzID09PSA0MDQgJiYgZGV0YWlsLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoJ25vdCBmb3VuZCcpKSB7XHJcbiAgICAgIHJldHVybiBuZXcgRXJyb3IoJ0F0dGFjaG1lbnQgbm90IGF2YWlsYWJsZSBvciBub3QgdXBsb2FkZWQgeWV0LicpO1xyXG4gICAgfVxyXG4gICAgaWYgKGVyci5zdGF0dXMgPT09IDQwMSkgcmV0dXJuIG5ldyBFcnJvcignVW5hdXRob3JpemVkIOKAlCBjaGVjayBzdG9yYWdlIEFQSSBrZXkgY29uZmlndXJhdGlvbi4nKTtcclxuICAgIGlmIChlcnIuc3RhdHVzID09PSAwKSAgIHJldHVybiBuZXcgRXJyb3IoJ05ldHdvcmsgZXJyb3Ig4oCUIHN0b3JhZ2Ugc2VydmljZSB1bnJlYWNoYWJsZS4nKTtcclxuICAgIHJldHVybiBuZXcgRXJyb3IoZGV0YWlsIHx8IGBTdG9yYWdlIHJlcXVlc3QgZmFpbGVkICgke2Vyci5zdGF0dXN9KSDigJQgJHt1cmx9YCk7XHJcbiAgfVxyXG59XHJcbiJdfQ==