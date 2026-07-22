'use client';

import Link from 'next/link';
import { useSync } from '@/contexts/sync.context';
import { StatusBadge } from '@/components/common/status-badge';

export function SyncIndicator() {
  const { isOnline, isSyncing, pendingCount } = useSync();

  return (
    <Link href="/sync" className="touch-target flex items-center">
      <StatusBadge
        isOnline={isOnline}
        isSyncing={isSyncing}
        pendingCount={pendingCount}
      />
    </Link>
  );
}
