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
export declare function getCachedMessagingMediaUrl(fileId: string): string | null;
export declare function getMessagingMediaUrl(fileId: string): Promise<string>;
export declare function prewarmMessagingMediaCache(fileIds: string[]): void;
export declare function deleteMessagingFile(fileId: string): Promise<void>;
export declare function uploadMessagingImage(uri: string, fileName: string): Promise<MessagingUploadResult>;
export declare function uploadMessagingImages(files: {
    uri: string;
    fileName: string;
}[]): Promise<MessagingUploadResult[]>;
//# sourceMappingURL=messagingFileService.d.ts.map