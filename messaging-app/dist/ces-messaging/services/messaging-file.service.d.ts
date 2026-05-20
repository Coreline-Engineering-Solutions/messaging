import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { MessagingConfig } from '../messaging.config';
import { AuthService } from './auth.service';
import * as i0 from "@angular/core";
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
export declare class MessagingFileService {
    private http;
    private auth;
    private config;
    /** Base URL, e.g. https://ces-ticketing-system-db.onrender.com/api */
    private readonly base;
    /** Ordered fallback lists — tried top-to-bottom on 404 / network error. */
    private readonly uploadEndpoints;
    private readonly retrieveEndpoints;
    private readonly deleteEndpoints;
    /** In-session cache: file_id → data URL. Cleared on page reload. */
    private readonly mediaCache;
    constructor(http: HttpClient, auth: AuthService, config: MessagingConfig);
    uploadFile(file: File, category?: string): Observable<FileUploadResponse>;
    uploadFiles(files: File[]): Observable<FileUploadResponse[]>;
    retrieveFile(fileId: string): Observable<FileRetrieveResponse>;
    /**
     * Returns a data URL for the given file_id.
     * Cached in memory for the session lifetime — never re-fetched if already loaded.
     */
    getFileDataUrl(fileId: string): Observable<string>;
    /** Synchronous cache lookup — null if not loaded yet. */
    getCachedDataUrl(fileId: string): string | null;
    /** Cache a URL returned by upload so later WS / REST refreshes do not fall back to spinners. */
    rememberFileUrl(fileId: string, url: string | null | undefined): void;
    /** Pre-warm cache for a list of file IDs (fire-and-forget, skips temp/cached). */
    prewarmCache(fileIds: string[]): void;
    deleteFile(fileId: string): Observable<any>;
    sendMessageWithAttachments(conversationId: string, senderContactId: string, content: string, fileIds: string[], filenames: string[], mimeTypes?: string[]): Observable<any>;
    /**
     * POST each URL in `urls` sequentially (using the body from `bodyFn()`).
     * Falls back to the next URL only on 404 or network error (status 0).
     * Logs every attempt with its result.
     */
    private tryEndpoints;
    private toFriendlyError;
    static ɵfac: i0.ɵɵFactoryDeclaration<MessagingFileService, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<MessagingFileService>;
}
