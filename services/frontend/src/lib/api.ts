import axios, { AxiosInstance, AxiosResponse } from 'axios';

// Use relative URLs since all services are accessible through the same load balancer
const API_BASE_URL = '';
const AUTH_BASE_URL = '';
const IMAGE_BASE_URL = '';

// API Client for main API service
export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Auth Client for authentication service  
export const authClient: AxiosInstance = axios.create({
  baseURL: AUTH_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Image Client for image service
export const imageClient: AxiosInstance = axios.create({
  baseURL: IMAGE_BASE_URL,
  timeout: 30000, // Longer timeout for image processing
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
const addAuthInterceptor = (client: AxiosInstance) => {
  client.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem('authToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );
};

// Response interceptor for error handling
const addResponseInterceptor = (client: AxiosInstance) => {
  client.interceptors.response.use(
    (response: AxiosResponse) => response,
    (error) => {
      if (error.response?.status === 401) {
        // Clear token and redirect to login
        localStorage.removeItem('authToken');
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }
  );
};

// Apply interceptors
[apiClient, authClient, imageClient].forEach((client) => {
  addAuthInterceptor(client);
  addResponseInterceptor(client);
});

// API Functions
export const api = {
  // Health checks
  health: {
    api: () => apiClient.get('/api/health'),
    auth: () => authClient.get('/api/v1/auth/health'),
    image: () => imageClient.get('/api/v1/images/health'),
  },

  // Authentication
  auth: {
    login: (email: string, password: string) =>
      authClient.post('/api/v1/auth/login', { email, password }),
    register: (userData: { email: string; password: string; name?: string }) =>
      authClient.post('/api/v1/auth/register', userData),
    logout: () => authClient.post('/api/v1/auth/logout'),
    verify: (token: string) => authClient.post('/api/v1/auth/verify', { token }),
    refresh: () => authClient.post('/api/v1/auth/refresh'),
  },

  // Users
  users: {
    getProfile: () => apiClient.get('/api/users/profile'),
    updateProfile: (data: any) => apiClient.put('/api/users/profile', data),
    list: () => apiClient.get('/api/users'),
  },

  // Images
  images: {
    list: () => apiClient.get('/api/images'),
    upload: (formData: FormData) =>
      apiClient.post('/api/images/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }),
    delete: (id: string) => apiClient.delete(`/api/images/${id}`),
    process: (id: string, operations: any) =>
      imageClient.post(`/api/v1/images/process/${id}`, operations),
    download: (id: string) => apiClient.get(`/api/images/${id}/download`, {
      responseType: 'blob',
    }),
  },

  // System metrics and status
  system: {
    metrics: () => apiClient.get('/metrics'),
    status: () => apiClient.get('/api/system/status'),
  },
};

export default api;