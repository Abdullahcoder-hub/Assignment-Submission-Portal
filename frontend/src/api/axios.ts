import axios from 'axios';

const API_URL = import.meta.env.DEV
  ? '/api'
  : import.meta.env.VITE_API_URL || 'https://assignment-submission-portal-rfq1.onrender.com/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to attach JWT token for authenticated requests (Student or Admin)
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('portalToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
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

export const downloadZipFile = async (endpoint: string, fileName: string): Promise<void> => {
  const saveFilePicker = (window as WindowWithSavePicker).showSaveFilePicker;

  if (saveFilePicker) {
    const fileHandle = await saveFilePicker.call(window, {
      suggestedName: fileName,
      types: [{ description: 'ZIP archive', accept: { 'application/zip': ['.zip'] } }],
    });
    const token = localStorage.getItem('portalToken');
    const response = await fetch(`${API_URL}${endpoint}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

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
          controller.enqueue(chunk);
        },
        flush() {
          if (receivedBytes < 2) {
            throw new Error('The server returned an empty ZIP archive.');
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
  if (error instanceof Error) return error.message;
  if (!axios.isAxiosError(error)) return fallback;

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
  return fallback;
};

export const openSubmissionFile = async (submissionId: string): Promise<void> => {
  const fileWindow = window.open('about:blank', '_blank');
  if (!fileWindow) {
    throw new Error('Please allow pop-ups to open submission files.');
  }
  fileWindow.opener = null;
  fileWindow.location.replace(`/submission-preview/${encodeURIComponent(submissionId)}`);
};
