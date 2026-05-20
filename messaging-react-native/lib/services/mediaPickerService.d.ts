export declare function pickImage(): Promise<{
    uri: string;
    fileName: string;
} | null>;
export declare function takePhoto(): Promise<{
    uri: string;
    fileName: string;
} | null>;
export declare function pickMultipleImages(max?: number): Promise<{
    uri: string;
    fileName: string;
}[]>;
//# sourceMappingURL=mediaPickerService.d.ts.map