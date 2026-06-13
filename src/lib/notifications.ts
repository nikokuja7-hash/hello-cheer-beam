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

export interface ServerNotificationPayload {
  user_id: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

export async function initializeNotifications(): Promise<boolean> {
  try {
    if (!('serviceWorker' in navigator) || !('Notification' in window)) return false;
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    console.log('Service Worker registered:', registration);
    return true;
  } catch (error) {
    console.error('Failed to initialize notifications:', error);
    return false;
  }
}

export function getNotificationPermission(): NotificationPermission {
  if (!('Notification' in window)) return 'denied';
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied';
  try { return await Notification.requestPermission(); } catch { return 'denied'; }
}

export async function isPushCapable(): Promise<boolean> {
  try { if (!('serviceWorker' in navigator)) return false; return !!(await navigator.serviceWorker.ready); } catch { return false; }
}

export async function sendLocalNotification(payload: NotificationPayload): Promise<void> {
  try {
    if (getNotificationPermission() !== 'granted' || !('serviceWorker' in navigator)) return;
    const registration = await navigator.serviceWorker.ready;
    if (!registration) return;
    await registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon || '/icon-192.png',
      badge: payload.badge || '/icon-192.png',
      tag: payload.tag || 'nexarena-notification',
      requireInteraction: false,
      data: { link: payload.link || '/', ...payload.data },
    });
  } catch (error) { console.error('Failed to send local notification:', error); }
}

export async function subscribeToPush(vapidPublicKey: string): Promise<PushSubscription | null> {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
    const registration = await navigator.serviceWorker.ready;
    if (!registration) return null;
    let subscription = await registration.pushManager.getSubscription();
    if (subscription) return subscription;
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
    return subscription;
  } catch (error) { console.error('Failed to subscribe to push:', error); return null; }
}

export async function unsubscribeFromPush(): Promise<boolean> {
  try {
    if (!('serviceWorker' in navigator)) return false;
    const registration = await navigator.serviceWorker.ready;
    if (!registration) return false;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return true;
    return await subscription.unsubscribe();
  } catch (error) { console.error('Failed to unsubscribe from push:', error); return false; }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export async function getServiceWorkerController(): Promise<ServiceWorkerContainer | null> {
  try { if (!('serviceWorker' in navigator)) return null; return navigator.serviceWorker; } catch { return null; }
}

export async function sendServerPushNotification(supabaseClient: any, payload: ServerNotificationPayload): Promise<boolean> {
  try {
    const { error } = await supabaseClient.functions.invoke("send-push-notification", { body: JSON.stringify(payload) });
    if (error) { console.error("Failed to send push notification:", error); return false; }
    return true;
  } catch (error) { console.error("Failed to invoke push function:", error); return false; }
}

export async function markNotificationAsRead(supabaseClient: any, notificationId: string): Promise<boolean> {
  try {
    const { error } = await supabaseClient.from("notifications").update({ read: true }).eq("id", notificationId);
    if (error) { console.error("Failed to mark notification as read:", error); return false; }
    return true;
  } catch (error) { return false; }
}

export async function getUnreadNotificationsCount(supabaseClient: any, userId: string): Promise<number> {
  try {
    const { count, error } = await supabaseClient.from("notifications").select("*", { count: "exact", head: true }).eq("user_id", userId).eq("read", false);
    if (error) { console.error("Failed to get unread count:", error); return 0; }
    return count || 0;
  } catch (error) { return 0; }
}
