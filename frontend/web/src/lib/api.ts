import axios from 'axios';
import { useAuthStore } from '../stores/authStore';

// API base URL - will be set from environment variables
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/prod';

// Create axios instance
export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle errors and token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and not already retried, try to refresh token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = useAuthStore.getState().refreshToken;
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken,
          });

          const { token: newToken, refreshToken: newRefreshToken } = response.data.data;

          // Update store with new tokens
          const user = useAuthStore.getState().user;
          if (user) {
            useAuthStore.getState().setAuth(user, newToken, newRefreshToken);
          }

          // Retry original request with new token
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, logout user
        useAuthStore.getState().clearAuth();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// API methods
export const authApi = {
  signup: (data: { email: string; password: string; name: string; orgName?: string }) =>
    api.post('/auth/signup', data),
  login: (data: { email: string; password: string }) => api.post('/auth/login', data),
  refreshToken: (refreshToken: string) => api.post('/auth/refresh', { refreshToken }),
};

export const userApi = {
  getProfile: (userId: string) => api.get(`/users/${userId}`),
  updateProfile: (userId: string, data: any) => api.put(`/users/${userId}`, data),
  listUsers: () => api.get('/users'),
};

export const locationApi = {
  getLocations: () => api.get('/locations'),
  createLocation: (data: any) => api.post('/locations', data),
  updateLocation: (locationId: string, data: any) => api.put(`/locations/${locationId}`, data),
  deleteLocation: (locationId: string) => api.delete(`/locations/${locationId}`),
};

export const timeApi = {
  clockIn: (data: { locationId: string; location: any; photo?: string; notes?: string }) =>
    api.post('/time/clock-in', data),
  clockOut: (data: { entryId: string; location: any; photo?: string; notes?: string }) =>
    api.post('/time/clock-out', data),
  getTimesheet: (params?: { userId?: string; startDate?: string; endDate?: string }) =>
    api.get('/time/timesheet', { params }),
  updateEntry: (entryId: string, data: any) => api.put(`/time/entry/${entryId}`, data),
  approveEntries: (data: { entryIds: string[]; action: 'approve' | 'reject' }) =>
    api.post('/time/approve', data),
};

export const scheduleApi = {
  getSchedule: (params?: {
    startDate?: string;
    endDate?: string;
    userId?: string;
    locationId?: string;
  }) => api.get('/schedule', { params }),
  createShift: (data: any) => api.post('/schedule/shifts', data),
  updateShift: (shiftId: string, data: any) => api.put(`/schedule/shifts/${shiftId}`, data),
  deleteShift: (shiftId: string) => api.delete(`/schedule/shifts/${shiftId}`),
  swapShift: (data: { shiftId: string; targetUserId: string; message?: string }) =>
    api.post('/schedule/shifts/swap', data),
};

export const reportsApi = {
  generateReport: (params: {
    type: 'timesheet' | 'labor_cost' | 'attendance' | 'overtime';
    startDate: string;
    endDate: string;
    format?: 'json' | 'csv';
    userId?: string;
  }) => api.get('/reports/generate', { params, responseType: params.format === 'csv' ? 'blob' : 'json' }),
};
