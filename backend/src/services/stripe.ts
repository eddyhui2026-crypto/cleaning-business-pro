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

/** 只在「冇內部試用完結日」時，畀自助開 checkout 嘅人（例如將來 flow）用 */
const CHECKOUT_TRIAL_DAYS = 14;
/** Stripe Checkout subscription trial_end 一般要至少約 48 小時後，否則用唔到 trial_end */
const STRIPE_MIN_TRIAL_SECONDS = 48 * 60 * 60;
const AUTO_PROMO_30_OFF_3MO = process.env.STRIPE_PROMO_30_OFF_3MO;

export type SubscriptionTrialPolicy = {
  /**
   * 總試用 14 日由開戶起计；試用內可訂閱，第一筆收費唔早於呢個時間。
   * Stripe 要求 trial_end 至少約 48 小時後；若剩低少過 48h，會用 max(試用完、now+48h)，避免提早扣款。
   * 已過期 / null → 無訂閱試用（試用完先落單通常即開始付費週期）。
   */
  appTrialEndsAtIso: string | null | undefined;
};

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

function buildSubscriptionTrial(
  companyId: string,
  policy: SubscriptionTrialPolicy | undefined,
): Stripe.Checkout.SessionCreateParams['subscription_data'] {
  const base: Stripe.Checkout.SessionCreateParams['subscription_data'] = {
    metadata: { companyId },
  };

  const raw = policy?.appTrialEndsAtIso?.trim();
  const nowSec = Math.floor(Date.now() / 1000);

  if (raw) {
    const endMs = new Date(raw).getTime();
    if (!Number.isNaN(endMs)) {
      const endSec = Math.floor(endMs / 1000);
      if (endSec > nowSec) {
        // 用咗 10 日 → 剩 4 日：trial_end = 原本試用完（唔再加 14 日）。Stripe 至少要 ~48h 後先接受 trial_end，
        // 故剩低 <48h 時用 max(試用完, now+48h)，保證「唔會早過試用完就扣第一筆」（可能遲少少先扣，因平台限制）。
        const trialEndUnix = Math.max(endSec, nowSec + STRIPE_MIN_TRIAL_SECONDS);
        return { ...base, trial_end: trialEndUnix };
      }
    }
    // 有 trial_ends_at 但已過期：唔再加 Stripe 試用（試用完先訂閱 → 即開始付費週期）
    return base;
  }

  // DB 無 trial_ends_at（罕見）：保留固定試用日數方便將來自助 signup
  return { ...base, trial_period_days: CHECKOUT_TRIAL_DAYS };
}

export const createCheckoutSession = async (
  companyId: string,
  email: string,
  plan: string | null | undefined,
  interval: string | null | undefined,
  trialPolicy?: SubscriptionTrialPolicy,
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
      subscription_data: buildSubscriptionTrial(companyId, trialPolicy),
      discounts,
    });

    return session;
  } catch (error) {
    console.error('Stripe Session Creation Error:', error);
    throw error;
  }
};