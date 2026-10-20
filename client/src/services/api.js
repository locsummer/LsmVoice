import axios from 'axios';
import { Capacitor } from '@capacitor/core';

// Cấu hình URL máy chủ Backend chính cho ứng dụng di động (Android & iOS)
export const DEFAULT_PRODUCTION_BACKEND = 'https://lsmvoice.onrender.com';

export const isNativeApp = () => {
  if (typeof window === 'undefined') return false;
  if (window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform()) {
    return true;
  }
  const platform = window.Capacitor?.getPlatform?.();
  if (platform === 'android' || platform === 'ios') {
    return true;
  }
  if (window.location) {
    if (window.location.protocol === 'capacitor:') return true;
    // Trên Android Capacitor, origin là https://localhost không có port
    if (window.location.hostname === 'localhost' && (!window.location.port || window.location.port === '')) {
      return true;
    }
  }
  return false;
};

export const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL.replace(/\/+$/, '');
  }
  // Khi chạy trong ứng dụng native (Android hoặc iOS qua Capacitor)
  if (isNativeApp()) {
    return DEFAULT_PRODUCTION_BACKEND;
  }
  // Khi chạy trên nền tảng Web thông thường
  return '';
};

export const resolveBackendUrl = (path = '') => {
  if (!path) return '';
  if (
    path.startsWith('http://') ||
    path.startsWith('https://') ||
    path.startsWith('blob:') ||
    path.startsWith('data:')
  ) {
    return path;
  }
  const base = getApiBaseUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return base ? `${base}${cleanPath}` : cleanPath;
};

const api = axios.create({
  baseURL: getApiBaseUrl() ? `${getApiBaseUrl()}/api` : '/api',
  timeout: 45000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor tự động gán dynamic baseURL cho mobile & JWT Token nếu đã đăng nhập
api.interceptors.request.use((config) => {
  const base = getApiBaseUrl();
  if (base && (!config.baseURL || config.baseURL === '/api' || !config.baseURL.startsWith('http'))) {
    config.baseURL = `${base}/api`;
  }
  const token = localStorage.getItem('lsm_token') || sessionStorage.getItem('lsm_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor bắt lỗi và format thông báo tiếng Việt
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    let msg = 'Đã có lỗi xảy ra trong quá trình xử lý.';
    if (error.response && error.response.data && error.response.data.message) {
      msg = error.response.data.message;
    } else if (error.message === 'Network Error') {
      msg = 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại kết nối mạng.';
    } else if (error.code === 'ECONNABORTED') {
      msg = 'Yêu cầu vượt quá thời gian phản hồi (timeout). Vui lòng thử lại.';
    }
    return Promise.reject(new Error(msg));
  }
);

// --- TTS Endpoints ---
export const fetchVoices = (params) => api.get('/voices', { params });
export const fetchProvidersStatus = () => api.get('/tts/providers');
export const previewVoice = (data) => api.post('/tts/preview', data);
export const createTtsJob = (data) => api.post('/tts/jobs', data);
export const getTtsJob = (jobId) => api.get(`/tts/jobs/${jobId}`);
export const cancelTtsJob = (jobId) => api.post(`/tts/jobs/${jobId}/cancel`);
export const retryTtsChunk = (chunkId) => api.post(`/tts/chunks/${chunkId}/retry`);

// --- File Upload ---
export const uploadDocument = (formData) =>
  api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

// --- Library Endpoints (Fallback sang LocalStorage nếu chưa đăng nhập) ---
export const fetchLibrary = (params) => api.get('/library', { params });
export const saveToLibrary = (data) => api.post('/library', data);
export const updateLibrary = (id, data) => api.put(`/library/${id}`, data);
export const removeLibrary = (id) => api.delete(`/library/${id}`);

// --- History Endpoints ---
export const fetchHistory = (params) => api.get('/history', { params });
export const logHistory = (data) => api.post('/history', data);
export const removeHistory = (id) => api.delete(`/history/${id}`);
export const wipeHistory = () => api.delete('/history');

// --- Category Endpoints ---
export const fetchCategories = () => api.get('/categories');
export const createCategory = (data) => api.post('/categories', data);

// --- Auth & Account Security Endpoints ---
export const authRegister = (data) => api.post('/auth/register', data);
export const authRequestLoginOtp = (data) => api.post('/auth/login/request-otp', data);
export const authVerifyLoginOtp = (data) => api.post('/auth/login/verify-otp', data);
export const authLoginWithPassword = (data) => api.post('/auth/login', data);
export const authLogout = () => api.post('/auth/logout');
export const authLogoutAll = () => api.post('/auth/logout-all');
export const fetchProfile = () => api.get('/auth/me');
export const modifyProfile = (data) => api.put('/auth/profile', data);

// Đổi mật khẩu qua OTP
export const authRequestPasswordChangeOtp = () => api.post('/auth/password/change/request-otp');
export const authVerifyPasswordChangeOtp = (data) => api.post('/auth/password/change/verify-otp', data);
export const authConfirmPasswordChange = (data) => api.post('/auth/password/change/confirm', data);

// Quên & khôi phục mật khẩu qua OTP
export const authRequestPasswordResetOtp = (data) => api.post('/auth/password/reset/request-otp', data);
export const authVerifyPasswordResetOtp = (data) => api.post('/auth/password/reset/verify-otp', data);
export const authConfirmPasswordReset = (data) => api.post('/auth/password/reset/confirm', data);

// Xác minh email qua OTP
export const authRequestEmailVerification = () => api.post('/auth/email-verification/request');
export const authVerifyEmailVerification = (data) => api.post('/auth/email-verification/verify', data);

// --- Admin Endpoints ---
export const adminGetDashboardSummary = () => api.get('/admin/dashboard/summary');
export const adminGetDashboardCharts = (days = 7) => api.get('/admin/dashboard/charts', { params: { days } });
export const adminGetCustomers = (params) => api.get('/admin/customers', { params });
export const adminGetCustomerDetails = (id) => api.get(`/admin/customers/${id}`);
export const adminUpdateCustomerStatus = (id, data) => api.patch(`/admin/customers/${id}/status`, data);
export const adminUpdateCustomerRole = (id, data) => api.patch(`/admin/customers/${id}/role`, data);
export const adminDeleteCustomer = (id) => api.delete(`/admin/customers/${id}`);
export const adminRevokeCustomerSessions = (id) => api.post(`/admin/customers/${id}/revoke-sessions`);
export const adminResendCustomerVerification = (id) => api.post(`/admin/customers/${id}/resend-verification`);
export const adminGetLoginEvents = (params) => api.get('/admin/login-events', { params });
export const adminGetAuditLogs = (params) => api.get('/admin/audit-logs', { params });
export const adminExportBackup = () => api.get('/admin/backup/export');
export const adminImportBackup = (backup) => api.post('/admin/backup/import', { backup });

// --- Audio Download Helper ---
export const getAudioDownloadUrl = (filename, title = '') => {
  const cleanName = filename.startsWith('/audio/') ? filename.replace('/audio/', '') : filename;
  const path = `/api/audio/download/${encodeURIComponent(cleanName)}?title=${encodeURIComponent(title)}`;
  return resolveBackendUrl(path);
};

// --- LocalStorage Helpers cho Chế độ Khách ---
export const GuestStorage = {
  getDraft() {
    try {
      return JSON.parse(localStorage.getItem('lsm_draft') || '{}');
    } catch {
      return {};
    }
  },
  saveDraft(draft) {
    localStorage.setItem('lsm_draft', JSON.stringify(draft));
  },
  clearDraft() {
    localStorage.removeItem('lsm_draft');
  },
  getLibrary() {
    try {
      return JSON.parse(localStorage.getItem('lsm_guest_library') || '[]');
    } catch {
      return [];
    }
  },
  saveLibraryItem(item) {
    const list = this.getLibrary();
    const existingIndex = list.findIndex((i) => i.id === item.id);
    if (existingIndex >= 0) {
      list[existingIndex] = { ...list[existingIndex], ...item, updated_at: new Date().toISOString() };
    } else {
      list.unshift({ ...item, id: item.id || 'guest_' + Date.now(), created_at: new Date().toISOString() });
    }
    localStorage.setItem('lsm_guest_library', JSON.stringify(list));
    return list;
  },
  deleteLibraryItem(id) {
    const list = this.getLibrary().filter((i) => i.id !== id);
    localStorage.setItem('lsm_guest_library', JSON.stringify(list));
    return list;
  },
  getHistory() {
    try {
      return JSON.parse(localStorage.getItem('lsm_guest_history') || '[]');
    } catch {
      return [];
    }
  },
  saveHistoryItem(record) {
    const list = this.getHistory();
    const existingIndex = list.findIndex(
      (h) => (record.libraryId && h.library_id === record.libraryId) || (record.jobId && h.job_id === record.jobId) || h.title === record.title
    );
    if (existingIndex >= 0) {
      list[existingIndex] = {
        ...list[existingIndex],
        ...record,
        last_position: record.lastPosition,
        total_duration: record.totalDuration,
        last_listened_at: new Date().toISOString(),
      };
    } else {
      list.unshift({
        id: 'hist_' + Date.now(),
        ...record,
        last_position: record.lastPosition,
        total_duration: record.totalDuration,
        last_listened_at: new Date().toISOString(),
      });
    }
    localStorage.setItem('lsm_guest_history', JSON.stringify(list));
    return list;
  },
  deleteHistoryItem(id) {
    const list = this.getHistory().filter((h) => h.id !== id);
    localStorage.setItem('lsm_guest_history', JSON.stringify(list));
    return list;
  },
  clearHistory() {
    localStorage.removeItem('lsm_guest_history');
  },
};

export default api;
