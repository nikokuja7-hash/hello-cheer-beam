/**
 * Web Push Notification utilities for Nexarena
 * Handles service worker registration, permission management, and notification dispatch
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
  type:
    | "payment_confirmed"
    | "match_assigned"
    | "check_in_reminder"
    | "check_in_missed"
    | "result_verified"
    | "result_disputed"
    | "match_forfeit"
    | "advancement"
    | "elimination"
    | "payment_failed"
    | "tournament_started"
    | "tournament_ended"
    | "prize_distributed"
    | "promotion"
    | "relegation"
    | "season_started"
    | "season_ended"
    | "league_standings_update"
    | "warning_strike";
  title: string;
  body: string;
  data?: Record<string, string>;
}

/**
 * Initialize service worker and web push support
 */
export async function initializeNotifications(): Promise<boolean> {
  try {
    if (!('serviceWorker' in navigator) || !('Notification' in window)) {
      console.warn('Service Worker or Notification API not available');
      return false;
    }

    // Register service worker
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });
    console.log('Service Worker registered:', registration);

    return true;
  } catch (error) {
    console.error('Failed to initialize notifications:', error);
    return false;
  }
}

/**
 * Check if notifications are currently permitted
 */
export function getNotificationPermission(): NotificationPermission {
  if (!('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission;
}

/**
 * Request notification permission from user
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    console.warn('Notification API not available');
    return 'denied';
  }

  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (error) {
    console.error('Failed to request notification permission:', error);
    return 'denied';
  }
}

/**
 * Check if a service worker is registered and push capable
 */
export async function isPushCapable(): Promise<boolean> {
  try {
    if (!('serviceWorker' in navigator)) return false;

    const registration = await navigator.serviceWorker.ready;
    return !!registration;
  } catch {
    return false;
  }
}

/**
 * Send a local notification (via service worker)
 */
export async function sendLocalNotification(
  payload: NotificationPayload
): Promise<void> {
  try {
    if (getNotificationPermission() !== 'granted') {
      console.warn('Notification permission not granted');
      return;
    }

    if (!('serviceWorker' in navigator)) {
      console.warn('Service Worker not available');
      return;
    }

    const registration = await navigator.serviceWorker.ready;
    if (!registration) return;

    // Show notification through service worker
    await registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon || '/icon-192.png',
      badge: payload.badge || '/icon-192.png',
      tag: payload.tag || 'nexarena-notification',
      requireInteraction: false,
      data: {
        link: payload.link || '/',
        ...payload.data,
      },
    });
  } catch (error) {
    console.error('Failed to send local notification:', error);
  }
}

/**
 * Subscribe to push notifications (for server-sent pushes)
 * Returns the subscription object for sending to server
 */
export async function subscribeToPush(vapidPublicKey: string): Promise<PushSubscription | null> {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push not supported');
      return null;
    }

    const registration = await navigator.serviceWorker.ready;
    if (!registration) return null;

    // Check if already subscribed
    let subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      return subscription;
    }

    // Subscribe with VAPID key
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });

    return subscription;
  } catch (error) {
    console.error('Failed to subscribe to push:', error);
    return null;
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPush(): Promise<boolean> {
  try {
    if (!('serviceWorker' in navigator)) return false;

    const registration = await navigator.serviceWorker.ready;
    if (!registration) return false;

    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return true;

    const success = await subscription.unsubscribe();
    return success;
  } catch (error) {
    console.error('Failed to unsubscribe from push:', error);
    return false;
  }
}

/**
 * Helper to convert VAPID public key from base64 to Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Get active service worker
 */
export async function getServiceWorkerController(): Promise<ServiceWorkerContainer | null> {
  try {
    if (!('serviceWorker' in navigator)) return null;

    const registration = await navigator.serviceWorker.ready;
    return navigator.serviceWorker;
  } catch {
    return null;
  }
}

/**
 * Store push subscription in Supabase database
 */
export async function storePushSubscription(
  supabaseClient: any,
  userId: string,
  subscription: PushSubscription
): Promise<boolean> {
  try {
    const { error } = await supabaseClient.from("push_subscriptions").upsert({
      user_id: userId,
      subscription_json: JSON.parse(JSON.stringify(subscription)),
      is_active: true,
    });

    if (error) {
      console.error("Failed to store subscription:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Failed to store push subscription:", error);
    return false;
  }
}

/**
 * Remove push subscription from database
 */
export async function removePushSubscription(
  supabaseClient: any,
  subscription: PushSubscription
): Promise<boolean> {
  try {
    const { error } = await supabaseClient
      .from("push_subscriptions")
      .update({ is_active: false })
      .eq("subscription_json", JSON.parse(JSON.stringify(subscription)));

    if (error) {
      console.error("Failed to remove subscription:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Failed to remove push subscription:", error);
    return false;
  }
}

/**
 * Send a server-side push notification via Edge Function
 */
export async function sendServerPushNotification(
  supabaseClient: any,
  payload: ServerNotificationPayload
): Promise<boolean> {
  try {
    const { data, error } = await supabaseClient.functions.invoke(
      "send-push-notification",
      {
        body: JSON.stringify(payload),
      }
    );

    if (error) {
      console.error("Failed to send push notification:", error);
      return false;
    }

    console.log("Push notification sent:", data);
    return true;
  } catch (error) {
    console.error("Failed to invoke push function:", error);
    return false;
  }
}

/**
 * Mark a notification as read
 */
export async function markNotificationAsRead(
  supabaseClient: any,
  notificationId: number
): Promise<boolean> {
  try {
    const { error } = await supabaseClient
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId);

    if (error) {
      console.error("Failed to mark notification as read:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Failed to mark notification as read:", error);
    return false;
  }
}

/**
 * Get unread notifications count
 */
export async function getUnreadNotificationsCount(
  supabaseClient: any,
  userId: string
): Promise<number> {
  try {
    const { count, error } = await supabaseClient
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_read", false);

    if (error) {
      console.error("Failed to get unread count:", error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error("Failed to get unread count:", error);
    return 0;
  }
}
