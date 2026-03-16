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
        // 更新資料庫中的訂閱狀態
        const { error } = await supabase
          .from('companies')
          .update({ subscription_status: 'active' })
          .eq('id', companyId);

        if (error) {
          console.error(`❌ DB Update Failed for Company ${companyId}:`, error);
          return res.status(500).json({ error: 'Database update failed' });
        }
        console.log(`✅ Subscription Activated for Company: ${companyId}`);
      }
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