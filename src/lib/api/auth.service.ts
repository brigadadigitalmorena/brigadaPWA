import apiClient, { saveTokensToStorage, clearTokensFromStorage } from './client';
import { LoginRequest, LoginResponse, User } from '@/lib/types';

const USER_STORAGE_KEY = 'brigada_user';

interface UserMeResponse {
  id: number;
  email: string;
  full_name?: string;
  nombre?: string;
  apellido?: string;
  phone?: string;
  telefono?: string;
  avatar_url?: string | null;
  role_key?: string;
  is_active?: boolean;
  activo?: boolean;
  created_at: string;
  permissions?: string[];
  create_user_targets?: string[];
  allowed_survey_ids?: number[];
  custom_role_id?: number;
  custom_role_name?: string;
}

export function splitFullName(fullName: string): { nombre: string; apellido: string } {
  const trimmed = fullName.trim();
  const space = trimmed.indexOf(' ');
  if (space <= 0) return { nombre: trimmed, apellido: '' };
  return {
    nombre: trimmed.slice(0, space),
    apellido: trimmed.slice(space + 1).trim(),
  };
}

export function persistUser(user: User): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
}

export function mapUserFromApi(raw: UserMeResponse, previous?: User | null): User {
  const fromFull = raw.full_name ? splitFullName(raw.full_name) : null;
  return {
    id: raw.id,
    email: raw.email,
    nombre: raw.nombre || fromFull?.nombre || previous?.nombre || '',
    apellido: raw.apellido || fromFull?.apellido || previous?.apellido || '',
    role_key: raw.role_key ?? previous?.role_key ?? '',
    telefono: raw.telefono ?? raw.phone ?? previous?.telefono,
    avatar_url: raw.avatar_url ?? previous?.avatar_url,
    created_at: raw.created_at || previous?.created_at || new Date().toISOString(),
    activo: raw.activo ?? raw.is_active ?? previous?.activo ?? true,
    permissions: raw.permissions ?? previous?.permissions ?? [],
    create_user_targets: raw.create_user_targets ?? previous?.create_user_targets ?? [],
    allowed_survey_ids: raw.allowed_survey_ids ?? previous?.allowed_survey_ids ?? [],
    custom_role_id: raw.custom_role_id ?? previous?.custom_role_id,
    custom_role_name: raw.custom_role_name ?? previous?.custom_role_name,
  };
}

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

  persistUser(user);

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

  const userJson = localStorage.getItem(USER_STORAGE_KEY);
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
    const response = await apiClient.get<UserMeResponse>('/users/me');
    const user = mapUserFromApi(response.data, getCurrentUser());
    persistUser(user);
    return user;
  } catch (error) {
    console.error('Failed to refresh user:', error);
    return null;
  }
}

export async function updateProfile(data: {
  full_name?: string;
  phone?: string | null;
  avatar_url?: string | null;
}): Promise<User> {
  const response = await apiClient.patch<UserMeResponse>('/users/me', data);
  const user = mapUserFromApi(response.data, getCurrentUser());
  persistUser(user);
  return user;
}

export async function uploadAvatar(file: File): Promise<User> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await apiClient.post<UserMeResponse>('/users/me/avatar', formData);
  const user = mapUserFromApi(response.data, getCurrentUser());
  persistUser(user);
  return user;
}

export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  await apiClient.post('/users/me/change-password', {
    current_password: currentPassword,
    new_password: newPassword,
  });
}
