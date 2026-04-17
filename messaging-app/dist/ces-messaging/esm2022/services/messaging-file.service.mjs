import { Injectable, Inject } from '@angular/core';
import { throwError, forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { MESSAGING_CONFIG } from '../messaging.config';
import * as i0 from "@angular/core";
import * as i1 from "@angular/common/http";
import * as i2 from "./auth.service";
export class MessagingFileService {
    http;
    auth;
    config;
    storageUrl;
    messagingUrl;
    constructor(http, auth, config) {
        this.http = http;
        this.auth = auth;
        this.config = config;
        this.storageUrl = config.storageApiUrl;
        this.messagingUrl = `${config.apiBaseUrl}/messaging`;
    }
    uploadFile(file, category = 'messaging_attachments') {
        const formData = new FormData();
        formData.append('file', file, file.name);
        formData.append('category', category);
        return this.http
            .post(`${this.storageUrl}/storage/upload`, formData)
            .pipe(catchError(this.handleError));
    }
    uploadFiles(files) {
        if (files.length === 0)
            return of([]);
        return forkJoin(files.map((f) => this.uploadFile(f)));
    }
    retrieveFile(fileId) {
        const formData = new FormData();
        formData.append('file_id', fileId);
        return this.http
            .post(`${this.storageUrl}/storage/retrieve`, formData)
            .pipe(catchError(this.handleError));
    }
    getFileDataUrl(fileId) {
        return this.retrieveFile(fileId).pipe(map((r) => `data:${r.mime_type};base64,${r.base64_data}`));
    }
    deleteFile(fileId) {
        const formData = new FormData();
        formData.append('file_id', fileId);
        return this.http
            .post(`${this.storageUrl}/storage/delete`, formData)
            .pipe(catchError(this.handleError));
    }
    sendMessageWithAttachments(conversationId, senderContactId, content, fileIds, filenames) {
        return this.http.post(`${this.messagingUrl}/conversations/${conversationId}/messages`, {
            session_gid: this.auth.sessionGid,
            senderContactId,
            messageType: fileIds.length > 0 ? 'FILE' : 'TEXT',
            content,
            attachment_ids: fileIds,
            filenames,
        });
    }
    handleError(error) {
        let msg = 'File operation failed';
        if (error.status === 401)
            msg = 'Unauthorized file access';
        else if (error.status === 404)
            msg = 'File not found';
        else if (error.status === 0)
            msg = 'Network error or CORS issue';
        else if (error.error?.detail)
            msg = error.error.detail;
        console.error('MessagingFileService error:', msg);
        return throwError(() => new Error(msg));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVzc2FnaW5nLWZpbGUuc2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9saWIvc2VydmljZXMvbWVzc2FnaW5nLWZpbGUuc2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sRUFBRSxNQUFNLGVBQWUsQ0FBQztBQUVuRCxPQUFPLEVBQWMsVUFBVSxFQUFFLFFBQVEsRUFBRSxFQUFFLEVBQUUsTUFBTSxNQUFNLENBQUM7QUFDNUQsT0FBTyxFQUFFLFVBQVUsRUFBRSxHQUFHLEVBQUUsTUFBTSxnQkFBZ0IsQ0FBQztBQUNqRCxPQUFPLEVBQUUsZ0JBQWdCLEVBQW1CLE1BQU0scUJBQXFCLENBQUM7Ozs7QUFtQnhFLE1BQU0sT0FBTyxvQkFBb0I7SUFLckI7SUFDQTtJQUMwQjtJQU5uQixVQUFVLENBQVM7SUFDbkIsWUFBWSxDQUFTO0lBRXRDLFlBQ1UsSUFBZ0IsRUFDaEIsSUFBaUIsRUFDUyxNQUF1QjtRQUZqRCxTQUFJLEdBQUosSUFBSSxDQUFZO1FBQ2hCLFNBQUksR0FBSixJQUFJLENBQWE7UUFDUyxXQUFNLEdBQU4sTUFBTSxDQUFpQjtRQUV6RCxJQUFJLENBQUMsVUFBVSxHQUFHLE1BQU0sQ0FBQyxhQUFhLENBQUM7UUFDdkMsSUFBSSxDQUFDLFlBQVksR0FBRyxHQUFHLE1BQU0sQ0FBQyxVQUFVLFlBQVksQ0FBQztJQUN2RCxDQUFDO0lBRUQsVUFBVSxDQUFDLElBQVUsRUFBRSxRQUFRLEdBQUcsdUJBQXVCO1FBQ3ZELE1BQU0sUUFBUSxHQUFHLElBQUksUUFBUSxFQUFFLENBQUM7UUFDaEMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN6QyxRQUFRLENBQUMsTUFBTSxDQUFDLFVBQVUsRUFBRSxRQUFRLENBQUMsQ0FBQztRQUV0QyxPQUFPLElBQUksQ0FBQyxJ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R0FBRyxFQUFFLENBQUMsSUFBSSxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztJQUMxQyxDQUFDO3dHQTNFVSxvQkFBb0IsdUVBT3JCLGdCQUFnQjs0R0FQZixvQkFBb0IsY0FEUCxNQUFNOzs0RkFDbkIsb0JBQW9CO2tCQURoQyxVQUFVO21CQUFDLEVBQUUsVUFBVSxFQUFFLE1BQU0sRUFBRTs7MEJBUTdCLE1BQU07MkJBQUMsZ0JBQWdCIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgSW5qZWN0YWJsZSwgSW5qZWN0IH0gZnJvbSAnQGFuZ3VsYXIvY29yZSc7XG5pbXBvcnQgeyBIdHRwQ2xpZW50LCBIdHRwRXJyb3JSZXNwb25zZSB9IGZyb20gJ0Bhbmd1bGFyL2NvbW1vbi9odHRwJztcbmltcG9ydCB7IE9ic2VydmFibGUsIHRocm93RXJyb3IsIGZvcmtKb2luLCBvZiB9IGZyb20gJ3J4anMnO1xuaW1wb3J0IHsgY2F0Y2hFcnJvciwgbWFwIH0gZnJvbSAncnhqcy9vcGVyYXRvcnMnO1xuaW1wb3J0IHsgTUVTU0FHSU5HX0NPTkZJRywgTWVzc2FnaW5nQ29uZmlnIH0gZnJvbSAnLi4vbWVzc2FnaW5nLmNvbmZpZyc7XG5pbXBvcnQgeyBBdXRoU2VydmljZSB9IGZyb20gJy4vYXV0aC5zZXJ2aWNlJztcblxuZXhwb3J0IGludGVyZmFjZSBGaWxlVXBsb2FkUmVzcG9uc2Uge1xuICBmaWxlX2lkOiBzdHJpbmc7XG4gIGZpbGVuYW1lOiBzdHJpbmc7XG4gIG1pbWVfdHlwZTogc3RyaW5nO1xuICBzaXplX2J5dGVzOiBudW1iZXI7XG4gIHVybD86IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBGaWxlUmV0cmlldmVSZXNwb25zZSB7XG4gIGZpbGVfaWQ6IHN0cmluZztcbiAgZmlsZW5hbWU6IHN0cmluZztcbiAgbWltZV90eXBlOiBzdHJpbmc7XG4gIGJhc2U2NF9kYXRhOiBzdHJpbmc7XG59XG5cbkBJbmplY3RhYmxlKHsgcHJvdmlkZWRJbjogJ3Jvb3QnIH0pXG5leHBvcnQgY2xhc3MgTWVzc2FnaW5nRmlsZVNlcnZpY2Uge1xuICBwcml2YXRlIHJlYWRvbmx5IHN0b3JhZ2VVcmw6IHN0cmluZztcbiAgcHJpdmF0ZSByZWFkb25seSBtZXNzYWdpbmdVcmw6IHN0cmluZztcblxuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIGh0dHA6IEh0dHBDbGllbnQsXG4gICAgcHJpdmF0ZSBhdXRoOiBBdXRoU2VydmljZSxcbiAgICBASW5qZWN0KE1FU1NBR0lOR19DT05GSUcpIHByaXZhdGUgY29uZmlnOiBNZXNzYWdpbmdDb25maWdcbiAgKSB7XG4gICAgdGhpcy5zdG9yYWdlVXJsID0gY29uZmlnLnN0b3JhZ2VBcGlVcmw7XG4gICAgdGhpcy5tZXNzYWdpbmdVcmwgPSBgJHtjb25maWcuYXBpQmFzZVVybH0vbWVzc2FnaW5nYDtcbiAgfVxuXG4gIHVwbG9hZEZpbGUoZmlsZTogRmlsZSwgY2F0ZWdvcnkgPSAnbWVzc2FnaW5nX2F0dGFjaG1lbnRzJyk6IE9ic2VydmFibGU8RmlsZVVwbG9hZFJlc3BvbnNlPiB7XG4gICAgY29uc3QgZm9ybURhdGEgPSBuZXcgRm9ybURhdGEoKTtcbiAgICBmb3JtRGF0YS5hcHBlbmQoJ2ZpbGUnLCBmaWxlLCBmaWxlLm5hbWUpO1xuICAgIGZvcm1EYXRhLmFwcGVuZCgnY2F0ZWdvcnknLCBjYXRlZ29yeSk7XG5cbiAgICByZXR1cm4gdGhpcy5odHRwXG4gICAgICAucG9zdDxGaWxlVXBsb2FkUmVzcG9uc2U+KGAke3RoaXMuc3RvcmFnZVVybH0vc3RvcmFnZS91cGxvYWRgLCBmb3JtRGF0YSlcbiAgICAgIC5waXBlKGNhdGNoRXJyb3IodGhpcy5oYW5kbGVFcnJvcikpO1xuICB9XG5cbiAgdXBsb2FkRmlsZXMoZmlsZXM6IEZpbGVbXSk6IE9ic2VydmFibGU8RmlsZVVwbG9hZFJlc3BvbnNlW10+IHtcbiAgICBpZiAoZmlsZXMubGVuZ3RoID09PSAwKSByZXR1cm4gb2YoW10pO1xuICAgIHJldHVybiBmb3JrSm9pbihmaWxlcy5tYXAoKGYpID0+IHRoaXMudXBsb2FkRmlsZShmKSkpO1xuICB9XG5cbiAgcmV0cmlldmVGaWxlKGZpbGVJZDogc3RyaW5nKTogT2JzZXJ2YWJsZTxGaWxlUmV0cmlldmVSZXNwb25zZT4ge1xuICAgIGNvbnN0IGZvcm1EYXRhID0gbmV3IEZvcm1EYXRhKCk7XG4gICAgZm9ybURhdGEuYXBwZW5kKCdmaWxlX2lkJywgZmlsZUlkKTtcbiAgICByZXR1cm4gdGhpcy5odHRwXG4gICAgICAucG9zdDxGaWxlUmV0cmlldmVSZXNwb25zZT4oYCR7dGhpcy5zdG9yYWdlVXJsfS9zdG9yYWdlL3JldHJpZXZlYCwgZm9ybURhdGEpXG4gICAgICAucGlwZShjYXRjaEVycm9yKHRoaXMuaGFuZGxlRXJyb3IpKTtcbiAgfVxuXG4gIGdldEZpbGVEYXRhVXJsKGZpbGVJZDogc3RyaW5nKTogT2JzZXJ2YWJsZTxzdHJpbmc+IHtcbiAgICByZXR1cm4gdGhpcy5yZXRyaWV2ZUZpbGUoZmlsZUlkKS5waXBlKFxuICAgICAgbWFwKChyKSA9PiBgZGF0YToke3IubWltZV90eXBlfTtiYXNlNjQsJHtyLmJhc2U2NF9kYXRhfWApXG4gICAgKTtcbiAgfVxuXG4gIGRlbGV0ZUZpbGUoZmlsZUlkOiBzdHJpbmcpOiBPYnNlcnZhYmxlPGFueT4ge1xuICAgIGNvbnN0IGZvcm1EYXRhID0gbmV3IEZvcm1EYXRhKCk7XG4gICAgZm9ybURhdGEuYXBwZW5kKCdmaWxlX2lkJywgZmlsZUlkKTtcbiAgICByZXR1cm4gdGhpcy5odHRwXG4gICAgICAucG9zdChgJHt0aGlzLnN0b3JhZ2VVcmx9L3N0b3JhZ2UvZGVsZXRlYCwgZm9ybURhdGEpXG4gICAgICAucGlwZShjYXRjaEVycm9yKHRoaXMuaGFuZGxlRXJyb3IpKTtcbiAgfVxuXG4gIHNlbmRNZXNzYWdlV2l0aEF0dGFjaG1lbnRzKFxuICAgIGNvbnZlcnNhdGlvbklkOiBzdHJpbmcsXG4gICAgc2VuZGVyQ29udGFjdElkOiBzdHJpbmcsXG4gICAgY29udGVudDogc3RyaW5nLFxuICAgIGZpbGVJZHM6IHN0cmluZ1tdLFxuICAgIGZpbGVuYW1lczogc3RyaW5nW11cbiAgKTogT2JzZXJ2YWJsZTxhbnk+IHtcbiAgICByZXR1cm4gdGhpcy5odHRwLnBvc3QoYCR7dGhpcy5tZXNzYWdpbmdVcmx9L2NvbnZlcnNhdGlvbnMvJHtjb252ZXJzYXRpb25JZH0vbWVzc2FnZXNgLCB7XG4gICAgICBzZXNzaW9uX2dpZDogdGhpcy5hdXRoLnNlc3Npb25HaWQsXG4gICAgICBzZW5kZXJDb250YWN0SWQsXG4gICAgICBtZXNzYWdlVHlwZTogZmlsZUlkcy5sZW5ndGggPiAwID8gJ0ZJTEUnIDogJ1RFWFQnLFxuICAgICAgY29udGVudCxcbiAgICAgIGF0dGFjaG1lbnRfaWRzOiBmaWxlSWRzLFxuICAgICAgZmlsZW5hbWVzLFxuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBoYW5kbGVFcnJvcihlcnJvcjogSHR0cEVycm9yUmVzcG9uc2UpIHtcbiAgICBsZXQgbXNnID0gJ0ZpbGUgb3BlcmF0aW9uIGZhaWxlZCc7XG4gICAgaWYgKGVycm9yLnN0YXR1cyA9PT0gNDAxKSBtc2cgPSAnVW5hdXRob3JpemVkIGZpbGUgYWNjZXNzJztcbiAgICBlbHNlIGlmIChlcnJvci5zdGF0dXMgPT09IDQwNCkgbXNnID0gJ0ZpbGUgbm90IGZvdW5kJztcbiAgICBlbHNlIGlmIChlcnJvci5zdGF0dXMgPT09IDApIG1zZyA9ICdOZXR3b3JrIGVycm9yIG9yIENPUlMgaXNzdWUnO1xuICAgIGVsc2UgaWYgKGVycm9yLmVycm9yPy5kZXRhaWwpIG1zZyA9IGVycm9yLmVycm9yLmRldGFpbDtcbiAgICBjb25zb2xlLmVycm9yKCdNZXNzYWdpbmdGaWxlU2VydmljZSBlcnJvcjonLCBtc2cpO1xuICAgIHJldHVybiB0aHJvd0Vycm9yKCgpID0+IG5ldyBFcnJvcihtc2cpKTtcbiAgfVxufVxuIl19