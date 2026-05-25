"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatMessagingHttpError = formatMessagingHttpError;
const axios_1 = __importDefault(require("axios"));
/** Surface FastAPI / axios validation detail instead of generic status text. */
function formatMessagingHttpError(error, stage) {
    if (axios_1.default.isAxiosError(error)) {
        const data = error.response?.data;
        let detail = '';
        if (typeof data === 'string') {
            detail = data;
        }
        else if (data && typeof data === 'object') {
            const record = data;
            if (record.detail !== undefined) {
                detail =
                    typeof record.detail === 'string'
                        ? record.detail
                        : JSON.stringify(record.detail);
            }
            else if (record.message !== undefined) {
                detail = String(record.message);
            }
            else {
                detail = JSON.stringify(data);
            }
        }
        const status = error.response?.status;
        const suffix = status ? ` (HTTP ${status})` : '';
        return detail
            ? `${stage}: ${detail}${suffix}`
            : `${stage}: ${error.message}${suffix}`;
    }
    if (error instanceof Error)
        return `${stage}: ${error.message}`;
    return `${stage}: ${String(error)}`;
}
