import Stripe from 'stripe';
import dotenv from 'dotenv'; // 1. 引入 dotenv

dotenv.config(); // 2. 執行讀取 .env 的動作

// 🔍 除錯小技巧：如果你還是報錯，取消下面這行的註解來檢查 Key 是否真的有讀到
// console.log('Stripe Key Check:', process.env.STRIPE_SECRET_KEY ? 'Found' : 'NOT FOUND');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-02-25.clover' as any, 
});

type PlanKey = 'small' | 'medium' | 'large';
type BillingInterval = 'monthly' | 'yearly';

const PLAN_PRICE_ENV: Record<PlanKey, Record<BillingInterval, string | undefined>> = {
  small: {
    monthly: process.env.STRIPE_PRICE_SMALL_MONTHLY || process.env.STRIPE_PRICE_SMALL,
    yearly: process.env.STRIPE_PRICE_SMALL_YEARLY,
  },
  medium: {
    monthly: process.env.STRIPE_PRICE_MEDIUM_MONTHLY || process.env.STRIPE_PRICE_MEDIUM,
    yearly: process.env.STRIPE_PRICE_MEDIUM_YEARLY,
  },
  large: {
    monthly: process.env.STRIPE_PRICE_LARGE_MONTHLY || process.env.STRIPE_PRICE_LARGE,
    yearly: process.env.STRIPE_PRICE_LARGE_YEARLY,
  },
};

const CHECKOUT_TRIAL_DAYS = 14;
const AUTO_PROMO_30_OFF_3MO = process.env.STRIPE_PROMO_30_OFF_3MO;

function getPriceIdForPlan(plan: string | null | undefined, interval: string | null | undefined): string {
  const key = (plan ?? 'small') as PlanKey;
  const billingInterval: BillingInterval = interval === 'yearly' ? 'yearly' : 'monthly';
  const priceId = PLAN_PRICE_ENV[key]?.[billingInterval];
  if (!priceId) {
    throw new Error(
      `Stripe price ID missing for ${key}/${billingInterval}. Set STRIPE_PRICE_${key.toUpperCase()}_${billingInterval.toUpperCase()} in backend env.`,
    );
  }
  return priceId;
}

export const createCheckoutSession = async (
  companyId: string,
  email: string,
  plan: string | null | undefined,
  interval: string | null | undefined,
) => {
  try {
    const priceId = getPriceIdForPlan(plan, interval);
    const discounts =
      AUTO_PROMO_30_OFF_3MO && AUTO_PROMO_30_OFF_3MO.trim()
        ? [{ promotion_code: AUTO_PROMO_30_OFF_3MO.trim() }]
        : undefined;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/billing`,
      customer_email: email,
      metadata: {
        companyId: companyId,
      },
      subscription_data: {
        trial_period_days: CHECKOUT_TRIAL_DAYS,
        metadata: {
          companyId,
        },
      },
      discounts,
    });

    return session;
  } catch (error) {
    console.error('Stripe Session Creation Error:', error);
    throw error;
  }
};