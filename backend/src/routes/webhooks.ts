import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { supabase } from '../lib/supabaseClient';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-02-25.clover' as any,
});

const router = Router();

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
      const companyId = (sub.metadata as Record<string, string> | undefined)?.companyId;
      if (!companyId) {
        console.log(`⚠️ ${event.type}: no companyId on subscription metadata`);
        break;
      }
      const stripeStatus = sub.status;
      const paidLike = ['active', 'trialing', 'past_due'].includes(stripeStatus);
      const updatePayload: Record<string, unknown> = {
        subscription_status: paidLike ? 'active' : 'inactive',
      };
      if (sub.trial_end) {
        updatePayload.trial_ends_at = new Date(sub.trial_end * 1000).toISOString();
      }
      await supabase.from('companies').update(updatePayload).eq('id', companyId);
      console.log(`✅ Synced subscription ${stripeStatus} → DB for company ${companyId}`);
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const companyId = (sub.metadata as Record<string, string> | undefined)?.companyId;
      if (companyId) {
        await supabase
          .from('companies')
          .update({ subscription_status: 'inactive' })
          .eq('id', companyId);
        console.log(`✅ Subscription set inactive for Company: ${companyId}`);
      } else {
        console.log('⚠️ Subscription deleted (no companyId in metadata)');
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