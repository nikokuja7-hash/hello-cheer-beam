/**
 * Web Push Notification utilities for Nexarena
 */

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  link?: string;
  data?: Record<string, any>;
}

export async function initializeNotifications(): Promise<boolean> {
  try {
    if (!('serviceWorker' in navigator) || !('Notification' in window)) return false;
    await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    return true;
  } catch { return false; }
}

export function getNotificationPermission(): NotificationPermission {
  if (!('Notification' in window)) return 'denied';
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied';
  try { return await Notification.requestPermission(); } catch { return 'denied'; }
}

export async function subscribeToPush(vapidPublicKey: string): Promise<PushSubscription | null> {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (subscription) return subscription;
    const key = urlBase64ToUint8Array(vapidPublicKey);
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: key as any,
    });
    return subscription;
  } catch { return null; }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}
