import axios from 'axios';
import { backendPool } from './backendPool';

declare module 'axios' {
  interface AxiosRequestConfig {
    backendOrigin?: string;
    backendFailoverRetried?: boolean;
  }
}

const api = axios.create({
  baseURL: backendPool.getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to attach JWT token for authenticated requests (Student or Admin)
api.interceptors.request.use(
  (config) => {
    config.backendOrigin = config.backendOrigin || backendPool.getSnapshot().activeUrl;
    config.baseURL = `${config.backendOrigin}/api`;
    if (!config.timeout) {
      const longRequest = config.method?.toLowerCase() === 'post'
        || config.url?.includes('/export-pdf')
        || config.url?.includes('/download');
      config.timeout = longRequest ? 120000 : 30000;
    }
    const token = localStorage.getItem('portalToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error) || !error.config) throw error;
    const config = error.config;
    const status = error.response?.status;
    const transportFailure = !error.response && error.code !== 'ERR_CANCELED';
    if (!transportFailure && status !== 502 && status !== 503 && status !== 504) throw error;

    const attemptedOrigin = config.backendOrigin || backendPool.getSnapshot().activeUrl;
    await backendPool.handleRequestFailure(attemptedOrigin);
    const method = (config.method || 'get').toLowerCase();
    const canRetry = ['get', 'head'].includes(method)
      && !config.backendFailoverRetried
      && backendPool.getSnapshot().activeUrl !== attemptedOrigin;
    if (!canRetry) throw error;

    config.backendFailoverRetried = true;
    config.backendOrigin = backendPool.getSnapshot().activeUrl;
    config.baseURL = `${config.backendOrigin}/api`;
    return api.request(config);
  },
);

export default api;

type ZipFileHandle = {
  createWritable: () => Promise<WritableStream<Uint8Array>>;
};

type ZipSavePickerOptions = {
  suggestedName: string;
  types: Array<{ description: string; accept: Record<string, string[]> }>;
};

type WindowWithSavePicker = Window & {
  showSaveFilePicker?: (options: ZipSavePickerOptions) => Promise<ZipFileHandle>;
};

const isZipSignature = (bytes: Uint8Array): boolean => bytes[0] === 0x50 && bytes[1] === 0x4b;
const zipEndRecordSignature = [0x50, 0x4b, 0x05, 0x06];
const maxZipCommentLength = 0xffff;

const hasZipEndRecord = (bytes: Uint8Array): boolean => {
  const searchStart = Math.max(0, bytes.length - 22 - maxZipCommentLength);
  for (let offset = bytes.length - 22; offset >= searchStart; offset--) {
    if (zipEndRecordSignature.every((value, index) => bytes[offset + index] === value)) {
      const commentLength = bytes[offset + 20] | (bytes[offset + 21] << 8);
      if (offset + 22 + commentLength !== bytes.length) continue;
      const entryCount = bytes[offset + 10] | (bytes[offset + 11] << 8);
      return entryCount > 0;
    }
  }
  return false;
};

const appendZipTail = (tail: Uint8Array, chunk: Uint8Array): Uint8Array => {
  const maxTailLength = 22 + maxZipCommentLength;
  const combined = new Uint8Array(Math.min(tail.length + chunk.length, maxTailLength));
  const chunkStart = Math.max(0, chunk.length - combined.length);
  const tailLength = combined.length - (chunk.length - chunkStart);
  if (tailLength > 0) combined.set(tail.subarray(tail.length - tailLength), 0);
  combined.set(chunk.subarray(chunkStart), tailLength);
  return combined;
};

export const downloadZipFile = async (endpoint: string, fileName: string): Promise<void> => {
  const saveFilePicker = (window as WindowWithSavePicker).showSaveFilePicker;

  if (saveFilePicker) {
    const fileHandle = await saveFilePicker.call(window, {
      suggestedName: fileName,
      types: [{ description: 'ZIP archive', accept: { 'application/zip': ['.zip'] } }],
    });
    const token = localStorage.getItem('portalToken');
    const fetchZip = () => fetch(`${backendPool.getApiBaseUrl()}${endpoint}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const attemptedOrigin = backendPool.getSnapshot().activeUrl;
    let response: Response;
    try {
      response = await fetchZip();
    } catch (error) {
      await backendPool.handleRequestFailure(attemptedOrigin);
      if (backendPool.getSnapshot().activeUrl === attemptedOrigin) throw error;
      response = await fetchZip();
    }
    if ([502, 503, 504].includes(response.status)) {
      await backendPool.handleRequestFailure(attemptedOrigin);
      if (backendPool.getSnapshot().activeUrl !== attemptedOrigin) {
        response = await fetch(`${backendPool.getApiBaseUrl()}${endpoint}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
      }
    }

    if (!response.ok) {
      let message = `ZIP download failed (${response.status}).`;
      try {
        const data: unknown = await response.json();
        if (typeof data === 'object' && data !== null && 'message' in data && typeof data.message === 'string') {
          message = data.message;
        }
      } catch {
        // Keep the HTTP status message when the response is not JSON.
      }
      throw new Error(message);
    }

    if (!response.body) {
      throw new Error('The browser could not stream the ZIP download.');
    }

    let receivedBytes = 0;
    const signatureBytes: number[] = [];
    let zipTail: Uint8Array<ArrayBufferLike> = new Uint8Array(0);
    const checkedBody = response.body.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          for (let index = 0; index < chunk.length && signatureBytes.length < 2; index++) {
            signatureBytes.push(chunk[index]);
          }
          if (signatureBytes.length === 2 && !isZipSignature(Uint8Array.from(signatureBytes))) {
            throw new Error('The server did not return a valid ZIP archive.');
          }
          receivedBytes += chunk.length;
          zipTail = appendZipTail(zipTail, chunk);
          controller.enqueue(chunk);
        },
        flush() {
          if (receivedBytes < 2) {
            throw new Error('The server returned an empty ZIP archive.');
          }
          if (!hasZipEndRecord(zipTail)) {
            throw new Error('The ZIP download was interrupted or contains no files.');
          }
        },
      })
    );
    await checkedBody.pipeTo(await fileHandle.createWritable());
    return;
  }

  const response = await api.get(endpoint, { responseType: 'blob' });
  if (response.data.size < 2) {
    throw new Error('The server returned an empty ZIP archive.');
  }
  const signature = new Uint8Array(await response.data.slice(0, 2).arrayBuffer());
  if (!isZipSignature(signature)) {
    throw new Error('The server did not return a valid ZIP archive.');
  }
  const tail = new Uint8Array(await response.data.slice(-22 - maxZipCommentLength).arrayBuffer());
  if (!hasZipEndRecord(tail)) {
    throw new Error('The ZIP download was interrupted or contains no files.');
  }
  const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/zip' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => window.URL.revokeObjectURL(url), 1000);
};

export const getDownloadErrorMessage = async (error: unknown, fallback: string): Promise<string> => {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error.message : fallback;
  }

  const data = error.response?.data;
  if (data instanceof Blob) {
    try {
      const parsed: unknown = JSON.parse(await data.text());
      if (typeof parsed === 'object' && parsed !== null && 'message' in parsed && typeof parsed.message === 'string') {
        return parsed.message;
      }
    } catch {
      return fallback;
    }
  }

  if (typeof data === 'object' && data !== null && 'message' in data && typeof data.message === 'string') {
    return data.message;
  }
  return getApiErrorMessage(error, fallback);
};

export const getApiErrorMessage = (error: unknown, fallback: string): string => {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error.message : fallback;
  }

  if (!error.response) {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return 'The backend request timed out. Check service health and try again.';
    }
    return 'Cannot reach the backend. Verify its service is running, VITE_API_URL is correct, and a backup is configured if needed.';
  }

  if (error.response.status === 404) {
    return 'The backend did not find this API endpoint. Check the backend URL and deploy the matching API version.';
  }
  if ([502, 503, 504].includes(error.response.status)) {
    return 'The backend is temporarily unavailable. Check its health and configured backups.';
  }

  const data: unknown = error.response.data;
  if (typeof data === 'object' && data !== null && 'message' in data && typeof data.message === 'string') {
    return data.message;
  }
  return error.response.status >= 500
    ? `The backend returned an error (HTTP ${error.response.status}).`
    : fallback;
};

export const openSubmissionFile = async (submissionId: string): Promise<void> => {
  const fileWindow = window.open('about:blank', '_blank');
  if (!fileWindow) {
    throw new Error('Please allow pop-ups to open submission files.');
  }
  fileWindow.opener = null;
  fileWindow.location.replace(`/submission-preview/${encodeURIComponent(submissionId)}`);
};
