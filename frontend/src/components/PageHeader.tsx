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
      className={`px-3 py-3 sm:px-4 sm:py-4 md:px-6 md:py-5 flex flex-row items-center justify-between gap-2 sm:gap-3 border-b min-w-0 ${
        isDark ? 'bg-slate-950/90 border-slate-800' : 'bg-white border-slate-100'
      }`}
    >
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
        {backTo && (
          <button
            type="button"
            onClick={() => navigate(backTo)}
            className={`p-2 -ml-1 sm:-ml-2 rounded-xl shrink-0 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
              isDark ? 'hover:bg-slate-900' : 'hover:bg-slate-100'
            }`}
            aria-label={backLabel ?? 'Back'}
          >
            <ChevronLeft size={22} className={isDark ? 'text-slate-300' : 'text-slate-600 sm:w-6 sm:h-6'} />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1
            className={`text-base sm:text-xl md:text-2xl font-bold truncate leading-tight ${
              isDark ? 'text-slate-50' : 'text-slate-800'
            }`}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              className={`hidden sm:block text-sm mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
            >
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {action && (
        <div className="shrink-0 flex items-center flex-nowrap pl-1">
          {action}
        </div>
      )}
    </header>
  );
}
