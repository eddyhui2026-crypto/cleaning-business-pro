import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { apiUrl } from '../lib/api';

export const SubscriptionGuard = ({ children, companyId }: { children: React.ReactNode, companyId: string }) => {
  const [status, setStatus] = useState<'loading' | 'active' | 'inactive'>('loading');

  useEffect(() => {
    const checkSub = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = {};
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
      const res = await fetch(apiUrl(`/api/billing/status/${companyId}`), { headers });
      const data = await res.json();
      setStatus(data.status ?? 'inactive');
    };
    checkSub();
  }, [companyId]);

  if (status === 'loading') return <div>Checking subscription...</div>;

  if (status === 'inactive') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h2 className="text-xl font-bold">Subscription Required</h2>
        <p className="text-slate-500 mb-4">Upgrade to continue. Plans start from £19/month.</p>
        <button className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold">
          Upgrade Now
        </button>
      </div>
    );
  }

  return <>{children}</>;
};