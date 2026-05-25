import axios from 'axios';

/** Surface FastAPI / axios validation detail instead of generic status text. */
export function formatMessagingHttpError(error: unknown, stage: string): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    let detail = '';
    if (typeof data === 'string') {
      detail = data;
    } else if (data && typeof data === 'object') {
      const record = data as Record<string, unknown>;
      if (record.detail !== undefined) {
        detail =
          typeof record.detail === 'string'
            ? record.detail
            : JSON.stringify(record.detail);
      } else if (record.message !== undefined) {
        detail = String(record.message);
      } else {
        detail = JSON.stringify(data);
      }
    }
    const status = error.response?.status;
    const suffix = status ? ` (HTTP ${status})` : '';
    return detail
      ? `${stage}: ${detail}${suffix}`
      : `${stage}: ${error.message}${suffix}`;
  }
  if (error instanceof Error) return `${stage}: ${error.message}`;
  return `${stage}: ${String(error)}`;
}
