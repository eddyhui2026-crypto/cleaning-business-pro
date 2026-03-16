/**
 * Web Push Notification service using web-push.
 * Requires VAPID keys in env: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY (or generate via web-push generate-vapid-keys).
 */

import webpush from 'web-push';
import { supabase } from '../lib/supabaseClient';

let vapidConfigured = false;

function ensureVapid(): void {
  if (vapidConfigured) return;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (publicKey && privateKey) {
    webpush.setVapidDetails(
      process.env.VAPID_MAILTO || 'mailto:eddyhui2026@gmail.com',
      publicKey,
      privateKey
    );
    vapidConfigured = true;
  }
}

export interface PushPayload {
  title: string;
  body?: string;
  url?: string;
  tag?: string;
}

async function sendToSubscription(subscription: webpush.PushSubscription, payload: PushPayload): Promise<boolean> {
  ensureVapid();
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    console.warn('[Push] VAPID keys not set; skipping web push.');
    return false;
  }
  try {
    const payloadStr = JSON.stringify(payload);
    await webpush.sendNotification(subscription, payloadStr);
    return true;
  } catch (err: any) {
    if (err.statusCode === 410 || err.statusCode === 404) {
      console.warn('[Push] Subscription expired or invalid:', err.body || err.message);
    } else {
      console.error('[Push] Send failed:', err?.message || err);
    }
    return false;
  }
}

/** Get all push subscriptions for a company (admin notifications). customer_id IS NULL. */
export async function getCompanySubscriptions(companyId: string): Promise<webpush.PushSubscription[]> {
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('subscription_json')
    .eq('company_id', companyId)
    .is('customer_id', null);
  if (error) {
    console.error('[Push] getCompanySubscriptions:', error);
    return [];
  }
  return (data ?? []).map((r: any) => r.subscription_json as webpush.PushSubscription);
}

/** Get all push subscriptions for a customer (client notifications). */
export async function getCustomerSubscriptions(customerId: string, companyId: string): Promise<webpush.PushSubscription[]> {
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('subscription_json')
    .eq('customer_id', customerId)
    .eq('company_id', companyId);
  if (error) {
    console.error('[Push] getCustomerSubscriptions:', error);
    return [];
  }
  return (data ?? []).map((r: any) => r.subscription_json as webpush.PushSubscription);
}

/** Notify company (admins) e.g. new pending booking or booking confirmed. */
export async function notifyCompany(companyId: string, payload: PushPayload): Promise<void> {
  const subs = await getCompanySubscriptions(companyId);
  for (const sub of subs) {
    await sendToSubscription(sub, payload);
  }
}

/** Notify customer e.g. quote received. */
export async function notifyCustomer(customerId: string, companyId: string, payload: PushPayload): Promise<void> {
  const subs = await getCustomerSubscriptions(customerId, companyId);
  for (const sub of subs) {
    await sendToSubscription(sub, payload);
  }
}

/** Save a push subscription (company-only or customer). */
export async function saveSubscription(
  companyId: string,
  subscription: webpush.PushSubscription,
  customerId?: string | null
): Promise<void> {
  const { error } = await supabase.from('push_subscriptions').insert({
    company_id: companyId,
    customer_id: customerId ?? null,
    subscription_json: subscription,
  });
  if (error) console.error('[Push] saveSubscription:', error);
}

/** Remove a subscription by endpoint (browser sends this in subscription_json.endpoint). */
export async function removeSubscription(companyId: string, endpoint: string, customerId?: string | null): Promise<void> {
  const { data: rows } = await supabase
    .from('push_subscriptions')
    .select('id, customer_id, subscription_json')
    .eq('company_id', companyId);
  if (!rows?.length) return;
  const match = rows.find((r: any) => {
    const sub = r.subscription_json;
    const sameCustomer = (r.customer_id == null && customerId == null) || (r.customer_id === customerId);
    return sameCustomer && sub?.endpoint === endpoint;
  });
  if (!match) return;
  await supabase.from('push_subscriptions').delete().eq('id', (match as any).id);
}
