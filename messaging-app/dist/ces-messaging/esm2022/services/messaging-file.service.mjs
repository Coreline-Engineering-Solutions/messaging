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
    /** Cache a URL returned by upload so later WS / REST refreshes do not fall back to spinners. */
    rememberFileUrl(fileId, url) {
        if (isTempId(fileId) || !url)
            return;
        this.mediaCache.set(fileId, url);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVzc2FnaW5nLWZpbGUuc2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9saWIvc2VydmljZXMvbWVzc2FnaW5nLWZpbGUuc2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sRUFBRSxNQUFNLGVBQWUsQ0FBQztBQUVuRCxPQUFPLEVBQWMsVUFBVSxFQUFFLFFBQVEsRUFBRSxFQUFFLEVBQUUsTUFBTSxNQUFNLENBQUM7QUFDNUQsT0FBTyxFQUFFLFVBQVUsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLE1BQU0sZ0JBQWdCLENBQUM7QUFDdEQsT0FBTyxFQUFFLGdCQUFnQixFQUFtQixNQUFNLHFCQUFxQixDQUFDOzs7O0FBa0J4RSx5REFBeUQ7QUFDekQsTUFBTSxXQUFXLEdBQUcsT0FBTyxDQUFDO0FBQzVCLFNBQVMsUUFBUSxDQUFDLEVBQTZCO0lBQzdDLE9BQU8sQ0FBQyxFQUFFLElBQUksRUFBRSxDQUFDLFVBQVUsQ0FBQyxXQUFXLENBQUMsQ0FBQztBQUMzQyxDQUFDO0FBR0QsTUFBTSxPQUFPLG9CQUFvQjtJQWFyQjtJQUNBO0lBQzBCO0lBZHBDLHNFQUFzRTtJQUNyRCxJQUFJLENBQVM7SUFFOUIsMkVBQTJFO0lBQzFELGVBQWUsQ0FBVztJQUMxQixpQkFBaUIsQ0FBVztJQUM1QixlQUFlLENBQVc7SUFFM0Msb0VBQW9FO0lBQ25ELFVBQVUsR0FBRyxJQUFJLEdBQUcsRUFBa0IsQ0FBQztJQUV4RCxZQUNVLElBQWdCLEVBQ2hCLElBQWlCLEVBQ1MsTUFBdUI7UUFGakQsU0FBSSxHQUFKLElBQUksQ0FBWTtRQUNoQixTQUFJLEdBQUosSUFBSSxDQUFhO1FBQ1MsV0FBTSxHQUFOLE1BQU0sQ0FBaUI7UUFFekQsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBRXZELElBQUksQ0FBQyxlQUFlLEdBQUssQ0FBQyxHQUFHLElBQUksQ0FBQyxJQUFJLGlCQUFpQixFQUFJLEdBQUcsSUFBSSxDQUFDLElBQUksMkJBQTJCLEVBQUksR0FBRyxJQUFJLENBQUMsSUFBSSx5QkFBeUIsQ0FBQyxDQUFDO1FBQzdJLElBQUksQ0FBQyxpQkFBaUIsR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDLElBQUksbUJBQW1CLEVBQUUsR0FBRyxJQUFJLENBQUMsSUFBSSw2QkFBNkIsRUFBRSxHQUFHLElBQUksQ0FBQyxJQUFJLDJCQUEyQixDQUFDLENBQUM7UUFDL0ksSUFBSSxDQUFDLGVBQWUsR0FBSyxDQUFDLEdBQUcsSUFBSSxDQUFDLElBQUksaUJBQWlCLEVBQUksR0FBRyxJQUFJLENBQUMsSUFBSSwyQkFBMkIsRUFBSSxHQUFHLElBQUksQ0FBQyxJQUFJLHlCQUF5QixDQUFDLENBQUM7SUFDL0ksQ0FBQztJQUVELDRFQUE0RTtJQUU1RSxVQUFVLENBQUMsSUFBVSxFQUFFLFFBQVEsR0FBRyx1QkFBdUI7UUFDdkQsTUFBTSxRQUFRLEdBQUcsR0FBRyxFQUFFO1lBQ3BCLE1BQU0sRUFBRSxHQUFHLElBQUksUUFBUSxFQUFFLENBQUM7WUFDMUIsRUFBRSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNuQyxFQUFFLENBQUMsTUFBTSxDQUFDLFVBQVUsRUFBRSxRQUFRLENBQUMsQ0FBQztZQUNoQyxPQUFPLEVBQUUsQ0FBQztRQUNaLENBQUMsQ0FBQztRQUNGLE9BQU8sSUFBSSxDQUFDLFlBQVksQ0FBcUIsSUFBSSxDQUFDLGVBQWUsRUFBRSxRQUFRLENBQUMsQ0FBQztJQUMvRSxDQUFDO0lBRUQsV0FBVyxDQUFDLEtBQWE7UUFDdkIsSUFBSSxLQUFLLENBQUMsTUFBTSxLQUFLLENBQUM7WUFBRSxPQUFPLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUN0QyxPQUFPLFFBQVEsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUN4RCxDQUFDO0lBRUQsNEVBQTRFO0lBRTVFLFlBQVksQ0FBQyxNQUFjO1FBQ3pCLElBQUksUUFBUSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUM7WUFDckIsT0FBTyxVQUFVLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxLQUFLLENBQUMsZ0RBQWdELENBQUMsQ0FBQyxDQUFDO1FBQ3ZGLENBQUM7UUFDRCxNQUFNLFFBQVEsR0FBRyxHQUFHLEVBQUU7WUFDcEIsTUFBTSxFQUFFLEdBQUcsSUFBSSxRQUFRLEVBQUUsQ0FBQztZQUMxQixFQUFFLENBQUMsTUFBTSxDQUFDLFNBQVMsRUFBRSxNQUFNLENBQUMsQ0FBQztZQUM3QixPQUFPLEVBQUUsQ0FBQztRQUNaLENBQUMsQ0FBQztRQUNGLE9BQU8sSUFBSSxDQUFDLFlBQVksQ0FBdUIsSUFBSSxDQUFDLGlCQUFpQixFQUFFLFFBQVEsQ0FBQyxDQUFDO0lBQ25GLENBQUM7SUFFRDs7O09BR0c7SUFDSCxjQUFjLENBQUMsTUFBYztRQUMzQixJQUFJLFFBQVEsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDO1lBQ3JCLE9BQU8sVUFBVSxDQUFDLEdBQUcsRUFBRSxDQUFDLElBQUksS0FBSyxDQUFDLGdEQUFnRCxDQUFDLENBQUMsQ0FBQztRQUN2RixDQUFDO1FBQ0QsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDM0MsSUFBSSxNQUFNO1lBQUUsT0FBTyxFQUFFLENBQUMsTUFBTSxDQUFDLENBQUM7UUFFOUIsT0FBTyxJQUFJLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FDbkMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxTQUFTLFdBQVcsQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDLEVBQ3pELEdBQUcsQ0FBQyxDQUFDLE9BQU8sRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQ3ZELENBQUM7SUFDSixDQUFDO0lBRUQseURBQXlEO0lBQ3pELGdCQUFnQixDQUFDLE1BQWM7UUFDN0IsSUFBSSxRQUFRLENBQUMsTUFBTSxDQUFDO1lBQUUsT0FBTyxJQUFJLENBQUM7UUFDbEMsT0FBTyxJQUFJLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsSUFBSSxJQUFJLENBQUM7SUFDN0MsQ0FBQztJQUVELGdHQUFnRztJQUNoRyxlQUFlLENBQUMsTUFBYyxFQUFFLEdBQThCO1FBQzVELElBQUksUUFBUSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRztZQUFFLE9BQU87UUFDckMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLEdBQUcsQ0FBQyxDQUFDO0lBQ25DLENBQUM7SUFFRCxrRkFBa0Y7SUFDbEYsWUFBWSxDQUFDLE9BQWlCO1FBQzVCLEtBQUssTUFBTSxFQUFFLElBQUksT0FBTyxFQUFFLENBQUM7WUFDekIsSUFBSSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUM7Z0JBQzlDLElBQUksQ0FBQyxjQUFjLENBQUMsRUFBRSxDQUFDLENBQUMsU0FBUyxDQUFDLEVBQUUsS0FBSyxFQUFFLEdBQUcsRUFBRSxHQUFFLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDekQsQ0FBQztRQUNILENBQUM7SUFDSCxDQUFDO0lBRUQsNkVBQTZFO0lBRTdFLFVBQVUsQ0FBQyxNQUFjO1FBQ3ZCLElBQUksUUFBUSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUM7WUFDckIsT0FBTyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDbEIsQ0FBQztRQUNELElBQUksQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQy9CLE1BQU0sUUFBUSxHQUFHLEdBQUcsRUFBRTtZQUNwQixNQUFNLEVBQUUsR0FBRyxJQUFJLFFBQVEsRUFBRSxDQUFDO1lBQzFCLEVBQUUsQ0FBQyxNQUFNLENBQUMsU0FBUyxFQUFFLE1BQU0sQ0FBQyxDQUFDO1lBQzdCLE9BQU8sRUFBRSxDQUFDO1FBQ1osQ0FBQyxDQUFDO1FBQ0YsT0FBTyxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxlQUFlLEVBQUUsUUFBUSxDQUFDLENBQUM7SUFDM0QsQ0FBQztJQUVELDRFQUE0RTtJQUU1RSwwQkFBMEIsQ0FDeEIsY0FBc0IsRUFDdEIsZUFBdUIsRUFDdkIsT0FBZSxFQUNmLE9BQWlCLEVBQ2pCLFNBQW1CLEVBQ25CLFlBQXNCLEVBQUU7UUFFeEIsaURBQWlEO1FBQ2pELE1BQU0sT0FBTyxHQUFHLE9BQU8sQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQ3BELElBQUksT0FBTyxDQUFDLE1BQU0sS0FBSyxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDdEMsT0FBTyxVQUFVLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxLQUFLLENBQUMsZ0RBQWdELENBQUMsQ0FBQyxDQUFDO1FBQ3ZGLENBQUM7UUFDRCxNQUFNLGFBQWEsR0FBRyxHQUFHLElBQUksQ0FBQyxJQUFJLFlBQVksQ0FBQztRQUMvQyxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsYUFBYSxrQkFBa0IsY0FBYyxXQUFXLEVBQUU7WUFDakYsU0FBUyxFQUFFLFFBQVEsQ0FBQyxlQUFlLEVBQUUsRUFBRSxDQUFDO1lBQ3hDLE9BQU8sRUFBRSxPQUFPLElBQUksRUFBRTtZQUN0QixjQUFjLEVBQUUsT0FBTztZQUN2QixTQUFTO1lBQ1QsVUFBVSxFQUFFLFNBQVM7U0FDdEIsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVELDZFQUE2RTtJQUU3RTs7OztPQUlHO0lBQ0ssWUFBWSxDQUFJLElBQWMsRUFBRSxNQUFzQjtRQUM1RCxJQUFJLElBQUksQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDdEIsT0FBTyxVQUFVLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxLQUFLLENBQUMsa0NBQWtDLENBQUMsQ0FBQyxDQUFDO1FBQ3pFLENBQUM7UUFFRCxNQUFNLENBQUMsR0FBRyxFQUFFLEdBQUcsSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDO1FBQzVCLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUksR0FBRyxFQUFFLE1BQU0sRUFBRSxDQUFDLENBQUMsSUFBSSxDQUMxQyxVQUFVLENBQUMsQ0FBQyxHQUFzQixFQUFFLEVBQUU7WUFDcEMsbURBQW1EO1lBQ25ELElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTSxLQUFLLEdBQUcsSUFBSSxHQUFHLENBQUMsTUFBTSxLQUFLLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUM7Z0JBQ2hFLE9BQU8sSUFBSSxDQUFDLFlBQVksQ0FBSSxJQUFJLEVBQUUsTUFBTSxDQUFDLENBQUM7WUFDNUMsQ0FBQztZQUVELGdDQUFnQztZQUNoQyxPQUFPLFVBQVUsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQzFELENBQUMsQ0FBQyxDQUNILENBQUM7SUFDSixDQUFDO0lBRU8sZUFBZSxDQUFDLEdBQXNCLEVBQUUsR0FBVztRQUN6RCxNQUFNLE1BQU0sR0FBVyxHQUFHLENBQUMsS0FBSyxFQUFFLE1BQU0sSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFLE9BQU8sSUFBSSxFQUFFLENBQUM7UUFDckUsSUFBSSxHQUFHLENBQUMsTUFBTSxLQUFLLEdBQUcsSUFBSSxNQUFNLENBQUMsV0FBVyxFQUFFLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQyxFQUFFLENBQUM7WUFDckUsT0FBTyxJQUFJLEtBQUssQ0FBQywrQ0FBK0MsQ0FBQyxDQUFDO1FBQ3BFLENBQUM7UUFDRCxJQUFJLEdBQUcsQ0FBQyxNQUFNLEtBQUssR0FBRztZQUFFLE9BQU8sSUFBSSxLQUFLLENBQUMscURBQXFELENBQUMsQ0FBQztRQUNoRyxJQUFJLEdBQUcsQ0FBQyxNQUFNLEtBQUssQ0FBQztZQUFJLE9BQU8sSUFBSSxLQUFLLENBQUMsOENBQThDLENBQUMsQ0FBQztRQUN6RixPQUFPLElBQUksS0FBSyxDQUFDLE1BQU0sSUFBSSwyQkFBMkIsR0FBRyxDQUFDLE1BQU0sT0FBTyxHQUFHLEVBQUUsQ0FBQyxDQUFDO0lBQ2hGLENBQUM7d0dBdktVLG9CQUFvQix1RUFlckIsZ0JBQWdCOzRHQWZmLG9CQUFvQixjQURQLE1BQU07OzRGQUNuQixvQkFBb0I7a0JBRGhDLFVBQVU7bUJBQUMsRUFBRSxVQUFVLEVBQUUsTUFBTSxFQUFFOzswQkFnQjdCLE1BQU07MkJBQUMsZ0JBQWdCIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgSW5qZWN0YWJsZSwgSW5qZWN0IH0gZnJvbSAnQGFuZ3VsYXIvY29yZSc7XG5pbXBvcnQgeyBIdHRwQ2xpZW50LCBIdHRwRXJyb3JSZXNwb25zZSB9IGZyb20gJ0Bhbmd1bGFyL2NvbW1vbi9odHRwJztcbmltcG9ydCB7IE9ic2VydmFibGUsIHRocm93RXJyb3IsIGZvcmtKb2luLCBvZiB9IGZyb20gJ3J4anMnO1xuaW1wb3J0IHsgY2F0Y2hFcnJvciwgbWFwLCB0YXAgfSBmcm9tICdyeGpzL29wZXJhdG9ycyc7XG5pbXBvcnQgeyBNRVNTQUdJTkdfQ09ORklHLCBNZXNzYWdpbmdDb25maWcgfSBmcm9tICcuLi9tZXNzYWdpbmcuY29uZmlnJztcbmltcG9ydCB7IEF1dGhTZXJ2aWNlIH0gZnJvbSAnLi9hdXRoLnNlcnZpY2UnO1xuXG5leHBvcnQgaW50ZXJmYWNlIEZpbGVVcGxvYWRSZXNwb25zZSB7XG4gIGZpbGVfaWQ6IHN0cmluZztcbiAgZmlsZW5hbWU6IHN0cmluZztcbiAgbWltZV90eXBlOiBzdHJpbmc7XG4gIHNpemVfYnl0ZXM6IG51bWJlcjtcbiAgdXJsPzogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEZpbGVSZXRyaWV2ZVJlc3BvbnNlIHtcbiAgZmlsZV9pZDogc3RyaW5nO1xuICBmaWxlbmFtZTogc3RyaW5nO1xuICBtaW1lX3R5cGU6IHN0cmluZztcbiAgYmFzZTY0X2RhdGE6IHN0cmluZztcbn1cblxuLyoqIFNlbnRpbmVsIHByZWZpeCDigJQgbmV2ZXIgc2VuZCB0aGVzZSBJRHMgdG8gYW55IEFQSS4gKi9cbmNvbnN0IFRFTVBfUFJFRklYID0gJ3RlbXAtJztcbmZ1bmN0aW9uIGlzVGVtcElkKGlkOiBzdHJpbmcgfCBudWxsIHwgdW5kZWZpbmVkKTogYm9vbGVhbiB7XG4gIHJldHVybiAhaWQgfHwgaWQuc3RhcnRzV2l0aChURU1QX1BSRUZJWCk7XG59XG5cbkBJbmplY3RhYmxlKHsgcHJvdmlkZWRJbjogJ3Jvb3QnIH0pXG5leHBvcnQgY2xhc3MgTWVzc2FnaW5nRmlsZVNlcnZpY2Uge1xuICAvKiogQmFzZSBVUkwsIGUuZy4gaHR0cHM6Ly9jZXMtdGlja2V0aW5nLXN5c3RlbS1kYi5vbnJlbmRlci5jb20vYXBpICovXG4gIHByaXZhdGUgcmVhZG9ubHkgYmFzZTogc3RyaW5nO1xuXG4gIC8qKiBPcmRlcmVkIGZhbGxiYWNrIGxpc3RzIOKAlCB0cmllZCB0b3AtdG8tYm90dG9tIG9uIDQwNCAvIG5ldHdvcmsgZXJyb3IuICovXG4gIHByaXZhdGUgcmVhZG9ubHkgdXBsb2FkRW5kcG9pbnRzOiBzdHJpbmdbXTtcbiAgcHJpdmF0ZSByZWFkb25seSByZXRyaWV2ZUVuZHBvaW50czogc3RyaW5nW107XG4gIHByaXZhdGUgcmVhZG9ubHkgZGVsZXRlRW5kcG9pbnRzOiBzdHJpbmdbXTtcblxuICAvKiogSW4tc2Vzc2lvbiBjYWNoZTogZmlsZV9pZCDihpIgZGF0YSBVUkwuIENsZWFyZWQgb24gcGFnZSByZWxvYWQuICovXG4gIHByaXZhdGUgcmVhZG9ubHkgbWVkaWFDYWNoZSA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSBodHRwOiBIdHRwQ2xpZW50LFxuICAgIHByaXZhdGUgYXV0aDogQXV0aFNlcnZpY2UsXG4gICAgQEluamVjdChNRVNTQUdJTkdfQ09ORklHKSBwcml2YXRlIGNvbmZpZzogTWVzc2FnaW5nQ29uZmlnXG4gICkge1xuICAgIHRoaXMuYmFzZSA9IHRoaXMuY29uZmlnLmFwaUJhc2VVcmwucmVwbGFjZSgvXFwvKyQvLCAnJyk7XG5cbiAgICB0aGlzLnVwbG9hZEVuZHBvaW50cyAgID0gW2Ake3RoaXMuYmFzZX0vc3RvcmFnZS91cGxvYWRgLCAgIGAke3RoaXMuYmFzZX0vbWVzc2FnaW5nL3N0b3JhZ2UvdXBsb2FkYCwgICBgJHt0aGlzLmJhc2V9L21lc3NhZ2luZy9maWxlcy91cGxvYWRgXTtcbiAgICB0aGlzLnJldHJpZXZlRW5kcG9pbnRzID0gW2Ake3RoaXMuYmFzZX0vc3RvcmFnZS9yZXRyaWV2ZWAsIGAke3RoaXMuYmFzZX0vbWVzc2FnaW5nL3N0b3JhZ2UvcmV0cmlldmVgLCBgJHt0aGlzLmJhc2V9L21lc3NhZ2luZy9maWxlcy9yZXRyaWV2ZWBdO1xuICAgIHRoaXMuZGVsZXRlRW5kcG9pbnRzICAgPSBbYCR7dGhpcy5iYXNlfS9zdG9yYWdlL2RlbGV0ZWAsICAgYCR7dGhpcy5iYXNlfS9tZXNzYWdpbmcvc3RvcmFnZS9kZWxldGVgLCAgIGAke3RoaXMuYmFzZX0vbWVzc2FnaW5nL2ZpbGVzL2RlbGV0ZWBdO1xuICB9XG5cbiAgLy8g4pSA4pSAIFVwbG9hZCDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcblxuICB1cGxvYWRGaWxlKGZpbGU6IEZpbGUsIGNhdGVnb3J5ID0gJ21lc3NhZ2luZ19hdHRhY2htZW50cycpOiBPYnNlcnZhYmxlPEZpbGVVcGxvYWRSZXNwb25zZT4ge1xuICAgIGNvbnN0IG1ha2VCb2R5ID0gKCkgPT4ge1xuICAgICAgY29uc3QgZmQgPSBuZXcgRm9ybURhdGEoKTtcbiAgICAgIGZkLmFwcGVuZCgnZmlsZScsIGZpbGUsIGZpbGUubmFtZSk7XG4gICAgICBmZC5hcHBlbmQoJ2NhdGVnb3J5JywgY2F0ZWdvcnkpO1xuICAgICAgcmV0dXJuIGZkO1xuICAgIH07XG4gICAgcmV0dXJuIHRoaXMudHJ5RW5kcG9pbnRzPEZpbGVVcGxvYWRSZXNwb25zZT4odGhpcy51cGxvYWRFbmRwb2ludHMsIG1ha2VCb2R5KTtcbiAgfVxuXG4gIHVwbG9hZEZpbGVzKGZpbGVzOiBGaWxlW10pOiBPYnNlcnZhYmxlPEZpbGVVcGxvYWRSZXNwb25zZVtdPiB7XG4gICAgaWYgKGZpbGVzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIG9mKFtdKTtcbiAgICByZXR1cm4gZm9ya0pvaW4oZmlsZXMubWFwKChmKSA9PiB0aGlzLnVwbG9hZEZpbGUoZikpKTtcbiAgfVxuXG4gIC8vIOKUgOKUgCBSZXRyaWV2ZSDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcblxuICByZXRyaWV2ZUZpbGUoZmlsZUlkOiBzdHJpbmcpOiBPYnNlcnZhYmxlPEZpbGVSZXRyaWV2ZVJlc3BvbnNlPiB7XG4gICAgaWYgKGlzVGVtcElkKGZpbGVJZCkpIHtcbiAgICAgIHJldHVybiB0aHJvd0Vycm9yKCgpID0+IG5ldyBFcnJvcignQ2Fubm90IHJldHJpZXZlIGZpbGU6IHVwbG9hZCBub3QgY29tcGxldGUgeWV0LicpKTtcbiAgICB9XG4gICAgY29uc3QgbWFrZUJvZHkgPSAoKSA9PiB7XG4gICAgICBjb25zdCBmZCA9IG5ldyBGb3JtRGF0YSgpO1xuICAgICAgZmQuYXBwZW5kKCdmaWxlX2lkJywgZmlsZUlkKTtcbiAgICAgIHJldHVybiBmZDtcbiAgICB9O1xuICAgIHJldHVybiB0aGlzLnRyeUVuZHBvaW50czxGaWxlUmV0cmlldmVSZXNwb25zZT4odGhpcy5yZXRyaWV2ZUVuZHBvaW50cywgbWFrZUJvZHkpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgYSBkYXRhIFVSTCBmb3IgdGhlIGdpdmVuIGZpbGVfaWQuXG4gICAqIENhY2hlZCBpbiBtZW1vcnkgZm9yIHRoZSBzZXNzaW9uIGxpZmV0aW1lIOKAlCBuZXZlciByZS1mZXRjaGVkIGlmIGFscmVhZHkgbG9hZGVkLlxuICAgKi9cbiAgZ2V0RmlsZURhdGFVcmwoZmlsZUlkOiBzdHJpbmcpOiBPYnNlcnZhYmxlPHN0cmluZz4ge1xuICAgIGlmIChpc1RlbXBJZChmaWxlSWQpKSB7XG4gICAgICByZXR1cm4gdGhyb3dFcnJvcigoKSA9PiBuZXcgRXJyb3IoJ0Nhbm5vdCByZXRyaWV2ZSBmaWxlOiB1cGxvYWQgbm90IGNvbXBsZXRlIHlldC4nKSk7XG4gICAgfVxuICAgIGNvbnN0IGNhY2hlZCA9IHRoaXMubWVkaWFDYWNoZS5nZXQoZmlsZUlkKTtcbiAgICBpZiAoY2FjaGVkKSByZXR1cm4gb2YoY2FjaGVkKTtcblxuICAgIHJldHVybiB0aGlzLnJldHJpZXZlRmlsZShmaWxlSWQpLnBpcGUoXG4gICAgICBtYXAoKHIpID0+IGBkYXRhOiR7ci5taW1lX3R5cGV9O2Jhc2U2NCwke3IuYmFzZTY0X2RhdGF9YCksXG4gICAgICB0YXAoKGRhdGFVcmwpID0+IHRoaXMubWVkaWFDYWNoZS5zZXQoZmlsZUlkLCBkYXRhVXJsKSlcbiAgICApO1xuICB9XG5cbiAgLyoqIFN5bmNocm9ub3VzIGNhY2hlIGxvb2t1cCDigJQgbnVsbCBpZiBub3QgbG9hZGVkIHlldC4gKi9cbiAgZ2V0Q2FjaGVkRGF0YVVybChmaWxlSWQ6IHN0cmluZyk6IHN0cmluZyB8IG51bGwge1xuICAgIGlmIChpc1RlbXBJZChmaWxlSWQpKSByZXR1cm4gbnVsbDtcbiAgICByZXR1cm4gdGhpcy5tZWRpYUNhY2hlLmdldChmaWxlSWQpID8/IG51bGw7XG4gIH1cblxuICAvKiogQ2FjaGUgYSBVUkwgcmV0dXJuZWQgYnkgdXBsb2FkIHNvIGxhdGVyIFdTIC8gUkVTVCByZWZyZXNoZXMgZG8gbm90IGZhbGwgYmFjayB0byBzcGlubmVycy4gKi9cbiAgcmVtZW1iZXJGaWxlVXJsKGZpbGVJZDogc3RyaW5nLCB1cmw6IHN0cmluZyB8IG51bGwgfCB1bmRlZmluZWQpOiB2b2lkIHtcbiAgICBpZiAoaXNUZW1wSWQoZmlsZUlkKSB8fCAhdXJsKSByZXR1cm47XG4gICAgdGhpcy5tZWRpYUNhY2hlLnNldChmaWxlSWQsIHVybCk7XG4gIH1cblxuICAvKiogUHJlLXdhcm0gY2FjaGUgZm9yIGEgbGlzdCBvZiBmaWxlIElEcyAoZmlyZS1hbmQtZm9yZ2V0LCBza2lwcyB0ZW1wL2NhY2hlZCkuICovXG4gIHByZXdhcm1DYWNoZShmaWxlSWRzOiBzdHJpbmdbXSk6IHZvaWQge1xuICAgIGZvciAoY29uc3QgaWQgb2YgZmlsZUlkcykge1xuICAgICAgaWYgKCFpc1RlbXBJZChpZCkgJiYgIXRoaXMubWVkaWFDYWNoZS5oYXMoaWQpKSB7XG4gICAgICAgIHRoaXMuZ2V0RmlsZURhdGFVcmwoaWQpLnN1YnNjcmliZSh7IGVycm9yOiAoKSA9PiB7fSB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyDilIDilIAgRGVsZXRlIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuXG4gIGRlbGV0ZUZpbGUoZmlsZUlkOiBzdHJpbmcpOiBPYnNlcnZhYmxlPGFueT4ge1xuICAgIGlmIChpc1RlbXBJZChmaWxlSWQpKSB7XG4gICAgICByZXR1cm4gb2YobnVsbCk7XG4gICAgfVxuICAgIHRoaXMubWVkaWFDYWNoZS5kZWxldGUoZmlsZUlkKTtcbiAgICBjb25zdCBtYWtlQm9keSA9ICgpID0+IHtcbiAgICAgIGNvbnN0IGZkID0gbmV3IEZvcm1EYXRhKCk7XG4gICAgICBmZC5hcHBlbmQoJ2ZpbGVfaWQnLCBmaWxlSWQpO1xuICAgICAgcmV0dXJuIGZkO1xuICAgIH07XG4gICAgcmV0dXJuIHRoaXMudHJ5RW5kcG9pbnRzKHRoaXMuZGVsZXRlRW5kcG9pbnRzLCBtYWtlQm9keSk7XG4gIH1cblxuICAvLyDilIDilIAgU2VuZCBtZXNzYWdlIHdpdGggYXR0YWNobWVudHMg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5cbiAgc2VuZE1lc3NhZ2VXaXRoQXR0YWNobWVudHMoXG4gICAgY29udmVyc2F0aW9uSWQ6IHN0cmluZyxcbiAgICBzZW5kZXJDb250YWN0SWQ6IHN0cmluZyxcbiAgICBjb250ZW50OiBzdHJpbmcsXG4gICAgZmlsZUlkczogc3RyaW5nW10sXG4gICAgZmlsZW5hbWVzOiBzdHJpbmdbXSxcbiAgICBtaW1lVHlwZXM6IHN0cmluZ1tdID0gW11cbiAgKTogT2JzZXJ2YWJsZTxhbnk+IHtcbiAgICAvLyBHdWFyZDogbmV2ZXIgc2VuZCB0ZW1wIGZpbGUgSURzIHRvIHRoZSBiYWNrZW5kXG4gICAgY29uc3QgcmVhbElkcyA9IGZpbGVJZHMuZmlsdGVyKGlkID0+ICFpc1RlbXBJZChpZCkpO1xuICAgIGlmIChyZWFsSWRzLmxlbmd0aCAhPT0gZmlsZUlkcy5sZW5ndGgpIHtcbiAgICAgIHJldHVybiB0aHJvd0Vycm9yKCgpID0+IG5ldyBFcnJvcignVXBsb2FkIG5vdCBmaW5pc2hlZCDigJQgY2Fubm90IGF0dGFjaCB0ZW1wIGZpbGUuJykpO1xuICAgIH1cbiAgICBjb25zdCBtZXNzYWdpbmdCYXNlID0gYCR7dGhpcy5iYXNlfS9tZXNzYWdpbmdgO1xuICAgIHJldHVybiB0aGlzLmh0dHAucG9zdChgJHttZXNzYWdpbmdCYXNlfS9jb252ZXJzYXRpb25zLyR7Y29udmVyc2F0aW9uSWR9L21lc3NhZ2VzYCwge1xuICAgICAgc2VuZGVyX2lkOiBwYXJzZUludChzZW5kZXJDb250YWN0SWQsIDEwKSxcbiAgICAgIGNvbnRlbnQ6IGNvbnRlbnQgfHwgJycsXG4gICAgICBhdHRhY2htZW50X2lkczogcmVhbElkcyxcbiAgICAgIGZpbGVuYW1lcyxcbiAgICAgIG1pbWVfdHlwZXM6IG1pbWVUeXBlcyxcbiAgICB9KTtcbiAgfVxuXG4gIC8vIOKUgOKUgCBGYWxsYmFjayBlbmdpbmUg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5cbiAgLyoqXG4gICAqIFBPU1QgZWFjaCBVUkwgaW4gYHVybHNgIHNlcXVlbnRpYWxseSAodXNpbmcgdGhlIGJvZHkgZnJvbSBgYm9keUZuKClgKS5cbiAgICogRmFsbHMgYmFjayB0byB0aGUgbmV4dCBVUkwgb25seSBvbiA0MDQgb3IgbmV0d29yayBlcnJvciAoc3RhdHVzIDApLlxuICAgKiBMb2dzIGV2ZXJ5IGF0dGVtcHQgd2l0aCBpdHMgcmVzdWx0LlxuICAgKi9cbiAgcHJpdmF0ZSB0cnlFbmRwb2ludHM8VD4odXJsczogc3RyaW5nW10sIGJvZHlGbjogKCkgPT4gRm9ybURhdGEpOiBPYnNlcnZhYmxlPFQ+IHtcbiAgICBpZiAodXJscy5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiB0aHJvd0Vycm9yKCgpID0+IG5ldyBFcnJvcignQWxsIHN0b3JhZ2UgZW5kcG9pbnRzIGV4aGF1c3RlZC4nKSk7XG4gICAgfVxuXG4gICAgY29uc3QgW3VybCwgLi4ucmVzdF0gPSB1cmxzO1xuICAgIHJldHVybiB0aGlzLmh0dHAucG9zdDxUPih1cmwsIGJvZHlGbigpKS5waXBlKFxuICAgICAgY2F0Y2hFcnJvcigoZXJyOiBIdHRwRXJyb3JSZXNwb25zZSkgPT4ge1xuICAgICAgICAvLyBPbmx5IGZhbGwgdGhyb3VnaCBvbiBub3QtZm91bmQgb3IgbmV0d29yayBpc3N1ZXNcbiAgICAgICAgaWYgKChlcnIuc3RhdHVzID09PSA0MDQgfHwgZXJyLnN0YXR1cyA9PT0gMCkgJiYgcmVzdC5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgcmV0dXJuIHRoaXMudHJ5RW5kcG9pbnRzPFQ+KHJlc3QsIGJvZHlGbik7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBUcmFuc2xhdGUgdG8gYSBmcmllbmRseSBlcnJvclxuICAgICAgICByZXR1cm4gdGhyb3dFcnJvcigoKSA9PiB0aGlzLnRvRnJpZW5kbHlFcnJvcihlcnIsIHVybCkpO1xuICAgICAgfSlcbiAgICApO1xuICB9XG5cbiAgcHJpdmF0ZSB0b0ZyaWVuZGx5RXJyb3IoZXJyOiBIdHRwRXJyb3JSZXNwb25zZSwgdXJsOiBzdHJpbmcpOiBFcnJvciB7XG4gICAgY29uc3QgZGV0YWlsOiBzdHJpbmcgPSBlcnIuZXJyb3I/LmRldGFpbCB8fCBlcnIuZXJyb3I/Lm1lc3NhZ2UgfHwgJyc7XG4gICAgaWYgKGVyci5zdGF0dXMgPT09IDQwNCAmJiBkZXRhaWwudG9Mb3dlckNhc2UoKS5pbmNsdWRlcygnbm90IGZvdW5kJykpIHtcbiAgICAgIHJldHVybiBuZXcgRXJyb3IoJ0F0dGFjaG1lbnQgbm90IGF2YWlsYWJsZSBvciBub3QgdXBsb2FkZWQgeWV0LicpO1xuICAgIH1cbiAgICBpZiAoZXJyLnN0YXR1cyA9PT0gNDAxKSByZXR1cm4gbmV3IEVycm9yKCdVbmF1dGhvcml6ZWQg4oCUIGNoZWNrIHN0b3JhZ2UgQVBJIGtleSBjb25maWd1cmF0aW9uLicpO1xuICAgIGlmIChlcnIuc3RhdHVzID09PSAwKSAgIHJldHVybiBuZXcgRXJyb3IoJ05ldHdvcmsgZXJyb3Ig4oCUIHN0b3JhZ2Ugc2VydmljZSB1bnJlYWNoYWJsZS4nKTtcbiAgICByZXR1cm4gbmV3IEVycm9yKGRldGFpbCB8fCBgU3RvcmFnZSByZXF1ZXN0IGZhaWxlZCAoJHtlcnIuc3RhdHVzfSkg4oCUICR7dXJsfWApO1xuICB9XG59XG4iXX0=