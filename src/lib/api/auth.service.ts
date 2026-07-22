import apiClient, { saveTokensToStorage, clearTokensFromStorage } from './client';
import { LoginRequest, LoginResponse, User } from '@/lib/types';

/**
 * Get or generate a unique device ID for this browser
 */
function getDeviceId(): string {
  if (typeof window === 'undefined') return 'web-unknown';

  const storageKey = 'brigada_device_id';
  let deviceId = localStorage.getItem(storageKey);

  if (!deviceId) {
    // Generate a unique device ID
    deviceId = `web-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem(storageKey, deviceId);
  }

  return deviceId;
}

/**
 * Login with email and password
 * Uses mobile endpoint for consistency with mobile app
 */
export async function login(credentials: LoginRequest): Promise<LoginResponse> {
  // Get or generate device ID for tracking
  const deviceId = getDeviceId();
  const appVersion = process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0';

  const response = await apiClient.post<LoginResponse>('/mobile/login', {
    email: credentials.username,
    password: credentials.password,
    device_id: deviceId,
    app_version: appVersion,
  });

  const { access_token, refresh_token, user } = response.data;

  // Save tokens to storage
  saveTokensToStorage(access_token, refresh_token);

  // Save user to storage
  if (typeof window !== 'undefined') {
    localStorage.setItem('brigada_user', JSON.stringify(user));
  }

  return response.data;
}

/**
 * Logout user
 */
export async function logout(): Promise<void> {
  try {
    await apiClient.post('/auth/logout');
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    clearTokensFromStorage();
  }
}

/**
 * Get current user from storage
 */
export function getCurrentUser(): User | null {
  if (typeof window === 'undefined') return null;

  const userJson = localStorage.getItem('brigada_user');
  if (!userJson) return null;

  try {
    return JSON.parse(userJson);
  } catch {
    return null;
  }
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;

  const token = localStorage.getItem('brigada_access_token');
  return !!token;
}

/**
 * Refresh user data from API
 */
export async function refreshUser(): Promise<User | null> {
  try {
    const response = await apiClient.get<User>('/users/me');
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('brigada_user', JSON.stringify(response.data));
    }

    return response.data;
  } catch (error) {
    console.error('Failed to refresh user:', error);
    return null;
  }
}
