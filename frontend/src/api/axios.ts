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

export const openSubmissionFile = async (submissionId: string): Promise<void> => {
  const fileWindow = window.open('about:blank', '_blank');
  if (!fileWindow) {
    throw new Error('Please allow pop-ups to open submission files.');
  }
  fileWindow.opener = null;

  try {
    const response = await api.get(`/submissions/${encodeURIComponent(submissionId)}/view`, {
      responseType: 'blob',
    });
    const fileUrl = URL.createObjectURL(response.data);
    fileWindow.location.replace(fileUrl);
    window.setTimeout(() => URL.revokeObjectURL(fileUrl), 60_000);
  } catch (error) {
    fileWindow.close();
    throw error;
  }
};
