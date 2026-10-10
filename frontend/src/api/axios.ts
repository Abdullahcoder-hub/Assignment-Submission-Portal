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

export const getDownloadErrorMessage = async (error: unknown, fallback: string): Promise<string> => {
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
