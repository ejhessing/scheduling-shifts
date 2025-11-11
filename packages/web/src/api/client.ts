import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const token = localStorage.getItem('accessToken');
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor to handle token refresh
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const refreshToken = localStorage.getItem('refreshToken');
            const response = await axios.post(`${API_URL}/auth/refresh`, {
              refreshToken,
            });

            const { accessToken } = response.data;
            localStorage.setItem('accessToken', accessToken);

            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
            return this.client(originalRequest);
          } catch (refreshError) {
            // Refresh failed, redirect to login
            localStorage.clear();
            window.location.href = '/login';
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  // Auth methods
  async signup(data: any) {
    const response = await this.client.post('/auth/signup', data);
    return response.data;
  }

  async login(email: string, password: string) {
    const response = await this.client.post('/auth/login', { email, password });
    if (response.data.accessToken) {
      localStorage.setItem('accessToken', response.data.accessToken);
      localStorage.setItem('refreshToken', response.data.refreshToken);
    }
    return response.data;
  }

  async logout() {
    localStorage.clear();
  }

  // User methods
  async getProfile(userId?: string) {
    const url = userId ? `/users/${userId}` : '/users/me';
    const response = await this.client.get(url);
    return response.data;
  }

  async updateProfile(userId: string, data: any) {
    const response = await this.client.put(`/users/${userId}`, data);
    return response.data;
  }

  async listUsers() {
    const response = await this.client.get('/users');
    return response.data;
  }

  // Time tracking methods
  async clockIn(data: any) {
    const response = await this.client.post('/time-tracking/clock-in', data);
    return response.data;
  }

  async clockOut(data: any) {
    const response = await this.client.post('/time-tracking/clock-out', data);
    return response.data;
  }

  async getTimesheet(params: any) {
    const response = await this.client.get('/time-tracking/timesheet', { params });
    return response.data;
  }

  async updateTimeEntry(entryId: string, data: any) {
    const response = await this.client.put(`/time-tracking/entries/${entryId}`, data);
    return response.data;
  }

  async approveTimeEntries(data: any) {
    const response = await this.client.post('/time-tracking/approve', data);
    return response.data;
  }

  // Schedule methods
  async getSchedule(params: any) {
    const response = await this.client.get('/schedule', { params });
    return response.data;
  }

  async createShift(data: any) {
    const response = await this.client.post('/schedule/shifts', data);
    return response.data;
  }

  async updateShift(shiftId: string, data: any) {
    const response = await this.client.put(`/schedule/shifts/${shiftId}`, data);
    return response.data;
  }

  async deleteShift(shiftId: string) {
    const response = await this.client.delete(`/schedule/shifts/${shiftId}`);
    return response.data;
  }

  async swapShift(data: any) {
    const response = await this.client.post('/schedule/shifts/swap', data);
    return response.data;
  }
}

export const apiClient = new ApiClient();
