import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  backTo?: string;
  backLabel?: string;
  action?: React.ReactNode;
  variant?: 'light' | 'dark';
}

export function PageHeader({ title, subtitle, backTo, backLabel, action, variant = 'light' }: PageHeaderProps) {
  const navigate = useNavigate();
  const isDark = variant === 'dark';
  return (
    <header
      className={`px-4 py-4 md:px-6 md:py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b ${
        isDark ? 'bg-slate-950/90 border-slate-800' : 'bg-white border-slate-100'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        {backTo && (
          <button
            type="button"
            onClick={() => navigate(backTo)}
            className={`p-2 -ml-2 rounded-xl shrink-0 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
              isDark ? 'hover:bg-slate-900' : 'hover:bg-slate-100'
            }`}
            aria-label={backLabel ?? 'Back'}
          >
            <ChevronLeft size={24} className={isDark ? 'text-slate-300' : 'text-slate-600'} />
          </button>
        )}
        <div className="min-w-0">
          <h1
            className={`text-xl md:text-2xl font-bold truncate ${
              isDark ? 'text-slate-50' : 'text-slate-800'
            }`}
          >
            {title}
          </h1>
          {subtitle && (
            <p className={`text-sm mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{subtitle}</p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
