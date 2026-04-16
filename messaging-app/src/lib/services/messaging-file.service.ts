import { Injectable, Inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
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

@Injectable({ providedIn: 'root' })
export class MessagingFileService {
  private readonly storageUrl: string;
  private readonly messagingUrl: string;

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    @Inject(MESSAGING_CONFIG) private config: MessagingConfig
  ) {
    this.storageUrl = config.storageApiUrl;
    this.messagingUrl = `${config.apiBaseUrl}/messaging`;
  }

  uploadFile(file: File, category = 'messaging_attachments'): Observable<FileUploadResponse> {
    const formData = new FormData();
    formData.append('file', file, file.name);
    formData.append('category', category);

    return this.http
      .post<FileUploadResponse>(`${this.storageUrl}/storage/upload`, formData)
      .pipe(catchError(this.handleError));
  }

  uploadFiles(files: File[]): Observable<FileUploadResponse[]> {
    if (files.length === 0) return of([]);
    return forkJoin(files.map((f) => this.uploadFile(f)));
  }

  retrieveFile(fileId: string): Observable<FileRetrieveResponse> {
    const formData = new FormData();
    formData.append('file_id', fileId);
    return this.http
      .post<FileRetrieveResponse>(`${this.storageUrl}/storage/retrieve`, formData)
      .pipe(catchError(this.handleError));
  }

  getFileDataUrl(fileId: string): Observable<string> {
    return this.retrieveFile(fileId).pipe(
      map((r) => `data:${r.mime_type};base64,${r.base64_data}`)
    );
  }

  deleteFile(fileId: string): Observable<any> {
    const formData = new FormData();
    formData.append('file_id', fileId);
    return this.http
      .post(`${this.storageUrl}/storage/delete`, formData)
      .pipe(catchError(this.handleError));
  }

  sendMessageWithAttachments(
    conversationId: string,
    senderContactId: string,
    content: string,
    fileIds: string[],
    filenames: string[]
  ): Observable<any> {
    return this.http.post(`${this.messagingUrl}/conversations/${conversationId}/messages`, {
      session_gid: this.auth.sessionGid,
      senderContactId,
      messageType: fileIds.length > 0 ? 'FILE' : 'TEXT',
      content,
      attachment_ids: fileIds,
      filenames,
    });
  }

  private handleError(error: HttpErrorResponse) {
    let msg = 'File operation failed';
    if (error.status === 401) msg = 'Unauthorized file access';
    else if (error.status === 404) msg = 'File not found';
    else if (error.status === 0) msg = 'Network error or CORS issue';
    else if (error.error?.detail) msg = error.error.detail;
    console.error('MessagingFileService error:', msg);
    return throwError(() => new Error(msg));
  }
}
