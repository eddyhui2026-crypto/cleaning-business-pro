import { usePlan } from '../context/PlanContext';
import { Clock } from 'lucide-react';

export function TrialBanner() {
  const { isTrialActive, trialEndsAt } = usePlan() ?? {};

  if (!isTrialActive || !trialEndsAt) return null;

  const end = new Date(trialEndsAt);
  const days = Math.ceil((end.getTime() - Date.now()) / (24 * 60 * 60 * 1000));

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-center gap-2 text-amber-800 text-sm font-medium">
      <Clock size={16} />
      <span>
        Your 14-day trial ends in {days} day{days !== 1 ? 's' : ''} ({end.toLocaleDateString()}). Upgrade to keep full access.
      </span>
    </div>
  );
}
