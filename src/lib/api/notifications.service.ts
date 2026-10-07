import apiClient from './client';

export interface NotificationItem {
  id: number;
  type: string;
  title: string;
  message: string;
  read: boolean;
  action_url: string | null;
  created_at: string;
  meta?: Record<string, unknown> | null;
}

export interface NotificationListResponse {
  notifications: NotificationItem[];
  unread_count: number;
}

export async function getNotifications(
  options: { skip?: number; limit?: number; unreadOnly?: boolean } = {}
): Promise<NotificationListResponse> {
  const params: Record<string, string | number | boolean> = {};
  if (options.skip !== undefined) params.skip = options.skip;
  if (options.limit !== undefined) params.limit = options.limit;
  if (options.unreadOnly) params.unread_only = true;

  const { data } = await apiClient.get<NotificationListResponse>(
    '/mobile/notifications',
    { params }
  );
  return data;
}

export async function markNotificationRead(
  notificationId: number
): Promise<NotificationItem> {
  const { data } = await apiClient.patch<NotificationItem>(
    `/mobile/notifications/${notificationId}/read`
  );
  return data;
}

export async function markAllNotificationsRead(): Promise<{ updated: number }> {
  const { data } = await apiClient.patch<{ updated: number }>(
    '/mobile/notifications/read-all'
  );
  return data;
}

export async function getUnreadNotificationCount(): Promise<number> {
  const { data } = await apiClient.get<{ count: number }>(
    '/mobile/notifications/unread-count'
  );
  return data.count ?? 0;
}

/** Map CMS/mobile action URLs onto PWA routes. */
export function notificationHref(actionUrl: string | null): string | null {
  if (!actionUrl) return null;
  if (actionUrl.startsWith('/dashboard/surveys')) return '/surveys';
  if (actionUrl.startsWith('/dashboard/assignments')) return '/surveys';
  if (actionUrl.startsWith('/dashboard/users')) return '/profile';
  if (actionUrl === '/tracking' || actionUrl.startsWith('/tracking')) {
    return '/tracking';
  }
  if (actionUrl.startsWith('/surveys') || actionUrl.startsWith('/sync')) {
    return actionUrl;
  }
  return '/surveys';
}
