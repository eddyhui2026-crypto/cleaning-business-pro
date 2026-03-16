/**
 * Plan limits for multi-tenant cleaning app (UK).
 * Enforced on backend for staff count and job count.
 */

export type PlanSlug = 'starter' | 'standard' | 'premium';

export const PLAN_LIMITS: Record<PlanSlug, { staff: number; jobs: number }> = {
  // Plans now only differ by how many staff accounts you can add.
  // All features are available on every plan; job count is unlimited.
  starter: { staff: 10, jobs: Infinity },
  standard: { staff: 20, jobs: Infinity },
  premium: { staff: 30, jobs: Infinity },
};

export const TRIAL_DAYS = 14;

export function getPlanLimit(plan: string | null | undefined): { staff: number; jobs: number } {
  const key = (plan ?? 'starter') as PlanSlug;
  return PLAN_LIMITS[key] ?? PLAN_LIMITS.starter;
}

export function isTrialActive(trialEndsAt: string | null | undefined): boolean {
  if (!trialEndsAt) return false;
  return new Date(trialEndsAt) > new Date();
}
