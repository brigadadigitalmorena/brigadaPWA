type PeriodicSyncRegistration = ServiceWorkerRegistration & {
  periodicSync?: {
    register: (tag: string, options: { minInterval: number }) => Promise<void>;
  };
};

/** Best-effort Chrome Periodic Background Sync. Wakes open clients to flush Dexie. */
export async function registerPeriodicSync(): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    const registration = (await navigator.serviceWorker.ready) as PeriodicSyncRegistration;
    await registration.periodicSync?.register('brigada-dexie-sync', {
      minInterval: 15 * 60 * 1000,
    });
  } catch {
    // Permission or browser support is optional.
  }
}
