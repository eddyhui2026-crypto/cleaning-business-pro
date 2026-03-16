import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Calendar, Receipt, Wallet, Settings as SettingsIcon, MoreHorizontal, UserCircle, FileText, BookOpen, Repeat, BarChart2 } from 'lucide-react';

const mainNavItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/schedule', icon: Calendar, label: 'Schedule' },
  { to: '/admin/invoices', icon: Receipt, label: 'Invoices' },
  { to: '/admin/attendance', icon: Wallet, label: 'Payroll' },
  { to: '/admin/quotes', icon: FileText, label: 'Quotes' },
];

const moreNavItems: { to: string; icon: typeof UserCircle; label: string; comingSoon?: boolean }[] = [
  { to: '/admin/reports', icon: BarChart2, label: 'Reports' },
  { to: '/admin/customers', icon: UserCircle, label: 'Customers' },
  { to: '/admin/recurring-jobs', icon: Repeat, label: 'Job detail' },
  { to: '/admin/settings', icon: SettingsIcon, label: 'Settings' },
  { to: '/admin/bookings', icon: BookOpen, label: 'Bookings' },
];

export function AdminBottomNav() {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const isMoreActive = moreNavItems.some((item) => location.pathname === item.to || (item.to !== '/admin' && location.pathname.startsWith(item.to + '/')));

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    }
    if (moreOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [moreOpen]);

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950 border-t border-slate-800 flex items-center justify-around py-2 safe-area-pb gap-0 min-h-[56px]"
        aria-label="Main navigation"
      >
        {mainNavItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            aria-label={label}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 sm:gap-1 px-2 sm:px-3 py-2 sm:py-1.5 rounded-xl text-xs font-medium transition-colors shrink-0 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 ${
                isActive ? 'text-emerald-400 bg-emerald-500/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
              }`
            }
          >
            <Icon size={22} className="shrink-0" />
            <span className="hidden sm:inline">{label}</span>
          </NavLink>
        ))}

        <div className="relative shrink-0" ref={moreRef}>
          <button
            type="button"
            onClick={() => setMoreOpen((o) => !o)}
            aria-label="More"
            aria-expanded={moreOpen}
            className={`flex flex-col items-center justify-center gap-0.5 sm:gap-1 px-2 sm:px-3 py-2 sm:py-1.5 rounded-xl text-xs font-medium transition-colors min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 ${
              isMoreActive || moreOpen ? 'text-emerald-400 bg-emerald-500/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
            }`}
          >
            <MoreHorizontal size={22} className="shrink-0" />
            <span className="hidden sm:inline">More</span>
          </button>

          {moreOpen && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 py-2 rounded-2xl bg-slate-900 border border-slate-700 shadow-xl z-50">
              {moreNavItems.map(({ to, icon: Icon, label, comingSoon }) => (
                comingSoon ? (
                  <div
                    key={to}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-slate-500 cursor-not-allowed first:rounded-t-2xl last:rounded-b-2xl"
                    title="Coming soon"
                  >
                    <Icon size={20} className="shrink-0 opacity-60" />
                    <span>{label}</span>
                    <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider text-slate-500">Coming soon</span>
                  </div>
                ) : (
                  <button
                    key={to}
                    type="button"
                    onClick={() => {
                      navigate(to);
                      setMoreOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-medium transition-colors first:rounded-t-2xl last:rounded-b-2xl ${
                      location.pathname === to || location.pathname.startsWith(to + '/')
                        ? 'text-emerald-400 bg-emerald-500/10'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-slate-100'
                    }`}
                  >
                    <Icon size={20} className="shrink-0" />
                    {label}
                  </button>
                )
              ))}
            </div>
          )}
        </div>
      </nav>
    </>
  );
}
