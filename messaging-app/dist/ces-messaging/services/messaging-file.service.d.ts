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
    private readonly storageUrl;
    private readonly messagingUrl;
    constructor(http: HttpClient, auth: AuthService, config: MessagingConfig);
    uploadFile(file: File, category?: string): Observable<FileUploadResponse>;
    uploadFiles(files: File[]): Observable<FileUploadResponse[]>;
    retrieveFile(fileId: string): Observable<FileRetrieveResponse>;
    getFileDataUrl(fileId: string): Observable<string>;
    deleteFile(fileId: string): Observable<any>;
    sendMessageWithAttachments(conversationId: string, senderContactId: string, content: string, fileIds: string[], filenames: string[]): Observable<any>;
    private handleError;
    static ɵfac: i0.ɵɵFactoryDeclaration<MessagingFileService, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<MessagingFileService>;
}
