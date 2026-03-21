import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { supabase } from '../lib/supabaseClient';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-02-25.clover' as any,
});

const router = Router();

/** Subscription/checkout may be missing metadata on old subs — map Stripe customer email → admin profile.company_id */
async function resolveCompanyIdFromSubscription(sub: Stripe.Subscription): Promise<string | null> {
  const fromMeta = (sub.metadata as Record<string, string> | undefined)?.companyId?.trim();
  if (fromMeta) return fromMeta;

  const customerId =
    typeof sub.customer === 'string' ? sub.customer : sub.customer && typeof sub.customer === 'object' ? sub.customer.id : null;
  if (!customerId) {
    return null;
  }
  try {
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted || !('email' in customer) || !customer.email?.trim()) {
      return null;
    }
    const email = customer.email.trim().toLowerCase();
    const { data: rows, error } = await supabase
      .from('profiles')
      .select('company_id')
      .ilike('email', email)
      .eq('role', 'admin')
      .not('company_id', 'is', null)
      .limit(5);

    if (error) {
      console.error('⚠️ resolveCompanyIdFromSubscription: profiles lookup failed', error);
      return null;
    }
    const ids = [...new Set((rows ?? []).map((r: { company_id: string | null }) => r.company_id).filter(Boolean))] as string[];
    if (ids.length === 1) {
      console.log(`ℹ️ Resolved companyId via Stripe customer email → profiles (admin): ${ids[0]}`);
      return ids[0]!;
    }
    if (ids.length > 1) {
      console.warn(`⚠️ resolveCompanyIdFromSubscription: multiple admin profiles for email ${email}, skip auto-resolve`);
    }
  } catch (e) {
    console.error('⚠️ resolveCompanyIdFromSubscription: Stripe customer retrieve failed', e);
  }
  return null;
}

// 注意：這個路由在 index.ts 必須使用 express.raw({ type: 'application/json' })
router.post('/stripe', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

  let event: Stripe.Event;

  try {
    // 1. 驗證這封請求真的是從 Stripe 發出的
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err: any) {
    console.error(`❌ Webhook Signature Verification Failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // 2. 處理事件
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const companyId = session.metadata?.companyId;

      if (companyId) {
        // Stripe 訂閱試用期的完結時間（與舊有 companies.trial_ends_at 無關，避免手動改 SQL 後出現「俾咗錢仍當試用過期」）
        const updatePayload: Record<string, unknown> = { subscription_status: 'active' };
        const cust =
          typeof session.customer === 'string'
            ? session.customer
            : session.customer && typeof session.customer === 'object'
              ? (session.customer as Stripe.Customer).id
              : null;
        if (cust) {
          updatePayload.stripe_customer_id = cust;
        }
        try {
          const subId =
            typeof session.subscription === 'string'
              ? session.subscription
              : session.subscription && typeof session.subscription === 'object'
                ? (session.subscription as Stripe.Subscription).id
                : null;
          if (subId) {
            const sub = await stripe.subscriptions.retrieve(subId);
            if (sub.trial_end) {
              updatePayload.trial_ends_at = new Date(sub.trial_end * 1000).toISOString();
            }
          }
        } catch (e) {
          console.error('⚠️ checkout.session.completed: could not sync trial_ends_at from Stripe:', e);
        }

        const { error } = await supabase.from('companies').update(updatePayload).eq('id', companyId);

        if (error) {
          console.error(`❌ DB Update Failed for Company ${companyId}:`, error);
          return res.status(500).json({ error: 'Database update failed' });
        }
        console.log(`✅ Subscription Activated for Company: ${companyId}`);
      } else {
        console.log('⚠️ checkout.session.completed: missing session.metadata.companyId');
      }
      break;
    }

    case 'customer.subscription.updated':
    case 'customer.subscription.created': {
      const sub = event.data.object as Stripe.Subscription;
      const companyId = await resolveCompanyIdFromSubscription(sub);
      if (!companyId) {
        console.log(
          `⚠️ ${event.type}: cannot resolve company — add subscription metadata companyId (Supabase companies.id) or ensure Stripe customer email matches an admin profile`,
        );
        break;
      }
      const stripeStatus = sub.status;
      const paidLike = ['active', 'trialing', 'past_due'].includes(stripeStatus);
      const customerId =
        typeof sub.customer === 'string'
          ? sub.customer
          : sub.customer && typeof sub.customer === 'object'
            ? (sub.customer as Stripe.Customer).id
            : null;
      const updatePayload: Record<string, unknown> = {
        subscription_status: paidLike ? 'active' : 'inactive',
      };
      if (customerId) {
        updatePayload.stripe_customer_id = customerId;
      }
      if (sub.trial_end) {
        updatePayload.trial_ends_at = new Date(sub.trial_end * 1000).toISOString();
      }
      const { error: upErr } = await supabase.from('companies').update(updatePayload).eq('id', companyId);
      if (upErr) {
        console.error(`❌ ${event.type}: DB update failed for company ${companyId}`, upErr);
      } else {
        console.log(`✅ Synced subscription ${stripeStatus} → DB for company ${companyId}`);
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const companyId = await resolveCompanyIdFromSubscription(sub);
      if (companyId) {
        const { error: upErr } = await supabase
          .from('companies')
          .update({ subscription_status: 'inactive' })
          .eq('id', companyId);
        if (upErr) {
          console.error(`❌ subscription.deleted: DB update failed for company ${companyId}`, upErr);
        } else {
          console.log(`✅ Subscription set inactive for Company: ${companyId}`);
        }
      } else {
        console.log('⚠️ Subscription deleted (could not resolve companyId)');
      }
      break;
    }

    default:
      console.log(`ℹ️ Unhandled event type ${event.type}`);
  }

  // 3. 必須回傳 200 給 Stripe，否則它會一直重複發送
  res.json({ received: true });
});

export default router;