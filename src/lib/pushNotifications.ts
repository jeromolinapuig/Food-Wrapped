import { supabase } from './supabaseClient';

export const VAPID_PUBLIC_KEY = String(import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '').trim();
export const PUSH_SUBSCRIPTION_CHANGED_EVENT = 'bw-push-subscription-changed';

export type PushEnvironment = 'ready' | 'ios_requires_install' | 'unsupported';

export class PushNotificationError extends Error {
  readonly code: 'configuration' | 'permission_denied' | 'unsupported' | 'subscription_failed';

  constructor(
    code: PushNotificationError['code'],
    message: string
  ) {
    super(message);
    this.name = 'PushNotificationError';
    this.code = code;
  }
}

const isIos = () => {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

export const isStandaloneApp = () => {
  if (typeof window === 'undefined') return false;
  const iosStandalone = Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return iosStandalone || window.matchMedia('(display-mode: standalone)').matches;
};

export const getPushEnvironment = (): PushEnvironment => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'unsupported';
  if (isIos() && !isStandaloneApp()) return 'ios_requires_install';
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return 'unsupported';
  }
  return 'ready';
};

const urlBase64ToUint8Array = (value: string) => {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
};

const dispatchSubscriptionChanged = () => {
  window.dispatchEvent(new CustomEvent(PUSH_SUBSCRIPTION_CHANGED_EVENT));
};

export const getDeviceTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

export const getCurrentPushSubscription = async () => {
  if (getPushEnvironment() !== 'ready') return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
};

const registerSubscription = async (subscription: PushSubscription, userId: string) => {
  const json = subscription.toJSON();
  const endpoint = json.endpoint ?? subscription.endpoint;
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    throw new PushNotificationError('subscription_failed', 'The browser returned an invalid push subscription.');
  }

  const { error } = await supabase.rpc('register_push_subscription', {
    p_endpoint: endpoint,
    p_p256dh: p256dh,
    p_auth: auth,
    p_user_agent: navigator.userAgent,
    p_timezone: getDeviceTimeZone(),
  });

  if (error) {
    throw new PushNotificationError('subscription_failed', error.message);
  }

  const { error: preferencesError } = await supabase
    .from('notification_preferences')
    .upsert(
      { user_id: userId },
      { onConflict: 'user_id', ignoreDuplicates: true }
    );

  if (preferencesError) {
    console.error('Could not initialize notification preferences', preferencesError);
  }
};

export const subscribeToPushNotifications = async (userId: string) => {
  if (!VAPID_PUBLIC_KEY) {
    throw new PushNotificationError('configuration', 'VITE_VAPID_PUBLIC_KEY is not configured.');
  }

  if (getPushEnvironment() !== 'ready') {
    throw new PushNotificationError('unsupported', 'Push notifications are not available in this browser.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new PushNotificationError('permission_denied', 'Notification permission was not granted.');
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  let createdSubscription = false;

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
    createdSubscription = true;
  }

  try {
    await registerSubscription(subscription, userId);
  } catch (error) {
    if (createdSubscription) {
      await subscription.unsubscribe().catch(() => false);
    }
    throw error;
  }

  dispatchSubscriptionChanged();
  return subscription;
};

export const syncCurrentPushSubscription = async (userId: string) => {
  if (!VAPID_PUBLIC_KEY || getPushEnvironment() !== 'ready' || Notification.permission !== 'granted') {
    return null;
  }
  const subscription = await getCurrentPushSubscription();
  if (!subscription) return null;
  await registerSubscription(subscription, userId);
  return subscription;
};

export const unsubscribeFromPushNotifications = async () => {
  const subscription = await getCurrentPushSubscription();
  if (!subscription) return;

  const { error } = await supabase.rpc('unregister_push_subscription', {
    p_endpoint: subscription.endpoint,
  });
  if (error) {
    throw new PushNotificationError('subscription_failed', error.message);
  }

  await subscription.unsubscribe();
  dispatchSubscriptionChanged();
};

export const unregisterCurrentPushSubscription = async () => {
  try {
    await unsubscribeFromPushNotifications();
  } catch (error) {
    console.error('Could not unregister push subscription', error);
  }
};
