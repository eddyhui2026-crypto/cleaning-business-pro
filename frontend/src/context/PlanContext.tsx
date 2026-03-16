import React, { createContext, useContext, useCallback, useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { apiUrl } from '../lib/api';

export type PlanSlug = 'starter' | 'standard' | 'premium';

export interface PlanUsage {
  plan: PlanSlug;
  staffCount: number;
  jobCount: number;
  staffLimit: number | null;
  jobLimit: number | null;
}

export interface CompanyInfo {
  id: string;
  name: string;
  plan: PlanSlug;
  subscription_status: string;
  trial_ends_at: string | null;
}

interface PlanContextValue {
  company: CompanyInfo | null;
  usage: PlanUsage | null;
  loading: boolean;
  refetch: () => Promise<void>;
  isStarter: boolean;
  isStandardOrPremium: boolean;
  trialEndsAt: string | null;
  isTrialActive: boolean;
}

const PlanContext = createContext<PlanContextValue | null>(null);

const TRIAL_DAYS = 14;

export function PlanProvider({ children }: { children: React.ReactNode }) {
  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [usage, setUsage] = useState<PlanUsage | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setCompany(null);
      setUsage(null);
      setLoading(false);
      return;
    }
    const headers = { Authorization: `Bearer ${session.access_token}` };
    try {
      const [companyRes, usageRes] = await Promise.all([
        fetch(apiUrl('/api/companies'), { headers }),
        fetch(apiUrl('/api/companies/usage'), { headers }),
      ]);
      if (companyRes.ok) {
        const data = await companyRes.json();
        setCompany(data?.id ? { ...data, plan: (data.plan || 'starter') as PlanSlug } : null);
      } else setCompany(null);
      if (usageRes.ok) {
        const data = await usageRes.json();
        setUsage(data);
      } else setUsage(null);
    } catch {
      setCompany(null);
      setUsage(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const trialEndsAt = company?.trial_ends_at ?? null;
  const isTrialActive = trialEndsAt ? new Date(trialEndsAt) > new Date() : false;
  const isStarter = (company?.plan ?? 'starter') === 'starter';
  const isStandardOrPremium = company?.plan === 'standard' || company?.plan === 'premium';

  return (
    <PlanContext.Provider
      value={{
        company,
        usage,
        loading,
        refetch,
        isStarter,
        isStandardOrPremium,
        trialEndsAt,
        isTrialActive,
      }}
    >
      {children}
    </PlanContext.Provider>
  );
}

export function usePlan() {
  const ctx = useContext(PlanContext);
  return ctx;
}
