/**
 * Web Push: request permission, subscribe with VAPID key, send subscription to backend.
 */

import { apiUrl } from './api';

export type PushRole = 'customer' | 'admin';

async function getVapidPublicKey(): Promise<string> {
  const res = await fetch(apiUrl('/api/booking/vapid-public-key'));
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error || 'VAPID not configured');
  }
  const data = await res.json();
  return (data as any).vapidPublicKey;
}

/** Convert base64 VAPID key to Uint8Array for pushManager.subscribe. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Request permission, subscribe, and POST subscription to backend. Returns success or error message. */
export async function enablePushCustomer(customerToken: string): Promise<{ ok: boolean; error?: string }> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { ok: false, error: 'Push not supported' };
  }
  const reg = await navigator.serviceWorker.ready;
  let permission = Notification.permission;
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }
  if (permission !== 'granted') {
    return { ok: false, error: 'Permission denied' };
  }
  const vapidKey = await getVapidPublicKey();
  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey),
  });
  const subJson = subscription.toJSON ? subscription.toJSON() : {
    endpoint: subscription.endpoint,
    keys: subscription.getKey('p256dh') && subscription.getKey('auth')
      ? { p256dh: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh')!))), auth: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth')!))) }
      : undefined,
  };
  const res = await fetch(apiUrl('/api/customer/push-subscription'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${customerToken}`,
    },
    body: JSON.stringify({ subscription: subJson }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false, error: (data as any).error || 'Failed to save subscription' };
  }
  return { ok: true };
}

/** Request permission, subscribe, and POST subscription to backend (admin). Uses Supabase session. */
export async function enablePushAdmin(getAuthHeaders: () => Promise<HeadersInit>): Promise<{ ok: boolean; error?: string }> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { ok: false, error: 'Push not supported' };
  }
  const reg = await navigator.serviceWorker.ready;
  let permission = Notification.permission;
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }
  if (permission !== 'granted') {
    return { ok: false, error: 'Permission denied' };
  }
  const vapidKey = await getVapidPublicKey();
  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey),
  });
  const subJson = subscription.toJSON ? subscription.toJSON() : {
    endpoint: subscription.endpoint,
    keys: subscription.getKey('p256dh') && subscription.getKey('auth')
      ? { p256dh: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh')!))), auth: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth')!))) }
      : undefined,
  };
  const headers = await getAuthHeaders();
  const res = await fetch(apiUrl('/api/admin/push-subscription'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(headers as Record<string, string>) },
    body: JSON.stringify({ subscription: subJson }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false, error: (data as any).error || 'Failed to save subscription' };
  }
  return { ok: true };
}
