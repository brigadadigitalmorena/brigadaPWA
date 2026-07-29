/**
 * Web Push registration stub.
 * Expo push tokens are not compatible — needs a web-specific backend endpoint.
 */

const STORAGE_KEY = 'brigada_web_push_subscription';

export function isWebPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export async function registerWebPush(
  vapidPublicKey?: string
): Promise<PushSubscriptionJSON | null> {
  if (!isWebPushSupported()) return null;
  if (!vapidPublicKey) {
    console.warn('Web Push: missing VAPID public key (NEXT_PUBLIC_VAPID_PUBLIC_KEY)');
    return null;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  if (existing) {
    const json = existing.toJSON();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(json));
    return json;
  }

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  });

  const json = subscription.toJSON();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(json));

  // Backend endpoint for web push tokens may differ from Expo's /mobile/push-token.
  try {
    await fetch('/api/backend/mobile/push-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform: 'web',
        subscription: json,
      }),
    });
  } catch (err) {
    console.warn('Web Push token registration failed (endpoint may be unavailable)', err);
  }

  return json;
}

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
