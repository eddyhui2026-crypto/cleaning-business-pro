import Stripe from 'stripe';
import dotenv from 'dotenv'; // 1. 引入 dotenv

dotenv.config(); // 2. 執行讀取 .env 的動作

// 🔍 除錯小技巧：如果你還是報錯，取消下面這行的註解來檢查 Key 是否真的有讀到
// console.log('Stripe Key Check:', process.env.STRIPE_SECRET_KEY ? 'Found' : 'NOT FOUND');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-02-25.clover' as any, 
});

export const createCheckoutSession = async (companyId: string, email: string) => {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'gbp',
            product_data: {
              name: 'Cleaning Business Pro - Monthly Subscription',
              description: 'Manage jobs, staff, and generate PDF reports.',
            },
            unit_amount: 990, // £9.90
            recurring: { interval: 'month' },
          },
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
      allow_promotion_codes: true,
    });

    return session;
  } catch (error) {
    console.error('Stripe Session Creation Error:', error);
    throw error;
  }
};