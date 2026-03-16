import { useState } from 'react';
import { CreditCard, Check, Loader2, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { apiUrl } from '../lib/api';

interface BillingProps {
  companyId: string | null;
  email: string | undefined;
}

export const Billing = ({ companyId, email }: BillingProps) => {
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        alert('Please sign in to continue.');
        return;
      }
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      };
      const response = await fetch(apiUrl('/api/billing/create-checkout-session'), {
        method: 'POST',
        headers,
        body: JSON.stringify({ email: email ?? session.user?.email }),
      });

      const data = await response.json();
      if (data.url) window.location.href = data.url;
      else if (data.error) alert(data.error);
    } catch (err) {
      alert('Payment initialization failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100">
        {/* 使用了 Sparkles 圖標 */}
        <div className="bg-indigo-600 p-8 text-center text-white">
          <Sparkles className="mx-auto mb-4" size={40} />
          <h1 className="text-2xl font-bold">Cleaning Business Pro</h1>
          <p className="opacity-90">Scale your business today</p>
        </div>

        <div className="p-8">
          <div className="flex justify-center items-baseline gap-1 mb-2">
            <span className="text-4xl font-black text-slate-900">From £9.90</span>
            <span className="text-slate-500 font-medium">/ month</span>
          </div>
          <p className="text-xs text-slate-500 text-center mb-4">
            All plans include scheduling, CRM, staff app, GPS check‑ins, online booking, invoices and PDF reports.
          </p>

          <ul className="space-y-3 mb-4 text-sm">
            {[
              'All features included on every plan',
              'Simple pricing by number of staff accounts',
              '14‑day free trial · no credit card needed',
              'Job photos kept for 90 days, records for 6 years',
            ].map((feature) => (
              <li key={feature} className="flex items-center gap-3 text-slate-700">
                <Check size={18} className="text-emerald-500" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          <p className="mb-6 text-[11px] text-center text-slate-500">
            Launch offer:{' '}
            <span className="font-semibold text-emerald-600">
              use code EARLYBIRD50 at checkout in the first 3 months to get 50% off forever.
            </span>
          </p>

          <button
            onClick={handleUpgrade}
            disabled={loading}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {/* 使用了 Loader2 和 CreditCard 圖標 */}
            {loading ? <Loader2 className="animate-spin" size={20} /> : <><CreditCard size={20} /> Upgrade Now</>}
          </button>
        </div>
      </div>
    </div>
  );
};