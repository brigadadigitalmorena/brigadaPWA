import { apiClient } from '@/lib/api/client';
import type { DailyMetrics } from '@/lib/metrics/daily-metrics';

export async function getDailyMetrics(): Promise<DailyMetrics> {
  const response = await apiClient.get<DailyMetrics>('/mobile/daily-metrics');
  return {
    completed_today: response.data.completed_today ?? 0,
    pending_sync: response.data.pending_sync ?? 0,
    unread_comments: response.data.unread_comments ?? 0,
  };
}
