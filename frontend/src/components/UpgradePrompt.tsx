import { useNavigate } from 'react-router-dom';
import { usePlan } from '../context/PlanContext';
import { AlertCircle, TrendingUp } from 'lucide-react';

interface UpgradePromptProps {
  limit: 'staff' | 'jobs';
  current: number;
  max: number;
}

export function UpgradePrompt({ limit, current, max }: UpgradePromptProps) {
  const navigate = useNavigate();
  const atLimit = max !== Infinity && current >= max;

  if (!atLimit) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
      <div className="p-2 rounded-lg bg-amber-100">
        <AlertCircle className="text-amber-600" size={20} />
      </div>
      <div className="flex-1">
        <p className="font-bold text-amber-900 text-sm">
          {limit === 'staff' ? 'Staff limit reached' : 'Job limit reached'}
        </p>
        <p className="text-amber-700 text-xs mt-0.5">
          Your plan allows up to {max} {limit}. Upgrade to add more.
        </p>
        <button
          type="button"
          onClick={() => navigate('/billing')}
          className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-bold hover:bg-amber-700"
        >
          <TrendingUp size={14} /> Upgrade plan
        </button>
      </div>
    </div>
  );
}
