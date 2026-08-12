import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { RefreshTokenResponse } from '@/lib/types';
import { getApiBaseUrl } from './api-base-url';

const API_TIMEOUT = 30000;

// Storage keys
const STORAGE_KEYS = {
  ACCESS_TOKEN: 'brigada_access_token',
  REFRESH_TOKEN: 'brigada_refresh_token',
  USER: 'brigada_user',
};

// Token state
let accessToken: string | null = null;
let refreshToken: string | null = null;
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

/**
 * Create axios instance with base configuration
 */
export const apiClient: AxiosInstance = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Load tokens from storage
 */
export function loadTokensFromStorage(): void {
  if (typeof window === 'undefined') return;
  
  accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  refreshToken =
    sessionStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN) ||
    localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
}

/**
 * Save tokens to storage
 */
export function saveTokensToStorage(access: string, refresh?: string): void {
  if (typeof window === 'undefined') return;
  
  accessToken = access;
  localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, access);
  
  if (refresh) {
    refreshToken = refresh;
    // Persist refresh across tab closes so offline→online sync can renew the session.
    sessionStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refresh);
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refresh);
  }
}

/**
 * Clear tokens from storage
 */
export function clearTokensFromStorage(): void {
  if (typeof window === 'undefined') return;
  
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
  sessionStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.USER);
}

/**
 * Get access token
 */
export function getAccessToken(): string | null {
  return accessToken;
}

/**
 * Check if token is expired
 */
export function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = payload.exp * 1000;
    const now = Date.now();
    return now >= exp - 60000; // 60 seconds buffer
  } catch {
    return true;
  }
}

/**
 * Subscribe to token refresh
 */
function subscribeTokenRefresh(callback: (token: string) => void): void {
  refreshSubscribers.push(callback);
}

/**
 * Notify all queued requests with the new token
 */
function onTokenRefreshed(token: string): void {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
}

/**
 * Perform token refresh
 */
async function performTokenRefresh(): Promise<string | null> {
  if (!refreshToken) return null;

  try {
    const response = await axios.post<RefreshTokenResponse>(
      `${getApiBaseUrl()}/mobile/token/refresh`,
      { refresh_token: refreshToken },
      { timeout: 15000 }
    );

    const { access_token, refresh_token: new_refresh } = response.data;
    
    if (!access_token) return null;

    saveTokensToStorage(access_token, new_refresh);
    return access_token;
  } catch (error) {
    console.error('Token refresh failed:', error);
    return null;
  }
}

/**
 * Attempt token refresh with queue
 */
async function attemptTokenRefresh(): Promise<string | null> {
  if (isRefreshing) {
    return new Promise((resolve) => {
      subscribeTokenRefresh((token) => resolve(token));
    });
  }

  isRefreshing = true;
  try {
    const newToken = await performTokenRefresh();
    if (newToken) {
      onTokenRefreshed(newToken);
    }
    return newToken;
  } finally {
    isRefreshing = false;
  }
}

/**
 * Request interceptor - Add JWT token to requests
 */
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    loadTokensFromStorage();

    const isPublicEndpoint =
      config.url?.includes('/auth/login') ||
      config.url?.includes('/mobile/login') ||
      config.url?.includes('/mobile/token/refresh') ||
      config.url?.includes('/public/');

    if (!isPublicEndpoint && accessToken) {
      if (isTokenExpired(accessToken)) {
        const newToken = await attemptTokenRefresh();
        if (newToken) {
          config.headers.Authorization = `Bearer ${newToken}`;
        }
      } else {
        config.headers.Authorization = `Bearer ${accessToken}`;
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

/** 401 on these must not clear session / hard-redirect (login errors, logout, refresh). */
function isSessionRedirectExemptUrl(url?: string): boolean {
  if (!url) return false;
  return (
    url.includes('/auth/login') ||
    url.includes('/mobile/login') ||
    url.includes('/mobile/token/refresh') ||
    url.includes('/auth/logout') ||
    url.includes('/public/')
  );
}

let isRedirectingToLogin = false;

function redirectToLoginOnce(): void {
  if (typeof window === 'undefined') return;
  const path = window.location.pathname;
  if (path === '/login' || path === '/activate' || path.startsWith('/activate/')) {
    return;
  }
  if (isRedirectingToLogin) return;
  isRedirectingToLogin = true;
  // Soft full navigation without stacking history; avoids SW/auth loops on /login.
  window.location.replace('/login');
}

/**
 * Response interceptor - Handle errors and token refresh
 */
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // Handle 401 Unauthorized
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      // Never refresh/redirect on auth endpoints (wrong password, logout, refresh itself).
      if (isSessionRedirectExemptUrl(originalRequest.url)) {
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      const newToken = await attemptTokenRefresh();
      if (newToken) {
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      }

      // Refresh failed - clear session and go to login once
      clearTokensFromStorage();
      redirectToLoginOnce();
      return Promise.reject(error);
    }

    // Handle 403 Forbidden — let callers show inline errors (e.g. email_not_verified on login)
    if (error.response?.status === 403) {
      return Promise.reject(error);
    }

    // Handle network errors
    if (!error.response) {
      console.error('Network error:', error.message);
    }

    return Promise.reject(error);
  }
);

export default apiClient;
