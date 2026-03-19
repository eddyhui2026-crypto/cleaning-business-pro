import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect, useCallback, type ReactNode } from 'react';
import type { AuthSession } from '@supabase/supabase-js';
import { supabase } from './lib/supabaseClient';
import { PlanProvider } from './context/PlanContext';
import { CustomerAuthProvider } from './context/CustomerAuthContext';
import { TrialBanner } from './components/TrialBanner';
import { ToastProvider } from './context/ToastContext';

import { Login } from './pages/Login';
import { BookLanding } from './pages/BookLanding';
import { CustomerLogin } from './pages/CustomerLogin';
import { CustomerDashboard } from './pages/CustomerDashboard';
import { CustomerBookPage } from './pages/CustomerBookPage';
import { StaffLogin } from './pages/StaffLogin';
import { Dashboard } from './pages/Dashboard';
import { StaffDashboard } from './pages/StaffDashboard';
import { StaffJobView } from './pages/StaffJobView';
import { StaffTimesheet } from './pages/StaffTimesheet';
import { StaffJobsList } from './pages/StaffJobsList';
import { Billing } from './pages/Billing';
import { JobReport } from './pages/JobReport';
import { AdminStaffManagement } from './pages/AdminStaffManagement';
import { AttendanceDashboard } from './pages/AttendanceDashboard';
import { AdminSchedulePage } from './pages/AdminSchedulePage';
import { AdminRecurringJobsPage } from './pages/AdminRecurringJobsPage';
import { AdminCustomersPage } from './pages/AdminCustomersPage';
import { AdminCustomerDetailPage } from './pages/AdminCustomerDetailPage';
import { AdminInvoicesPage } from './pages/AdminInvoicesPage';
import { AdminQuotesPage } from './pages/AdminQuotesPage';
import { AdminQuoteFormPage } from './pages/AdminQuoteFormPage';
import { AdminBookingsPage } from './pages/AdminBookingsPage';
import { AdminServicesPage } from './pages/AdminServicesPage';
import { AdminNewJobPage } from './pages/AdminNewJobPage';
import { Settings } from './pages/Settings';
import { SettingsChecklists } from './pages/SettingsChecklists';
import { CleanFlowHome } from './pages/CleanFlowHome';
import { AdminReportsPage } from './pages/AdminReportsPage';
import { AdminGettingStarted } from './pages/AdminGettingStarted';
import { PrivacyPolicy } from './pages/PrivacyPolicy';
import { TermsOfService } from './pages/TermsOfService';
import { DataAndCookiesPolicy } from './pages/DataAndCookiesPolicy';
import { Signup } from './pages/Signup';
import { SupportReportsPage } from './pages/SupportReportsPage';

/** Redirects to /billing when subscription is inactive; otherwise renders children. */
function AdminRoute({
  subStatus,
  companyId,
  children,
}: {
  subStatus: string | null;
  companyId: string | null;
  children: ReactNode;
}) {
  if (subStatus !== 'active') return <Navigate to="/billing" replace />;
  return <>{children}</>;
}

const ADMIN_ROUTES: Array<{
  path: string;
  element: (companyId: string | null) => ReactNode;
}> = [
  { path: '/admin/getting-started', element: () => <AdminGettingStarted /> },
  { path: '/admin/staff', element: (companyId) => <AdminStaffManagement companyId={companyId} /> },
  { path: '/admin/attendance', element: (companyId) => <AttendanceDashboard companyId={companyId} /> },
  { path: '/admin/schedule', element: (companyId) => <AdminSchedulePage companyId={companyId} /> },
  { path: '/admin/recurring-jobs', element: (companyId) => <AdminRecurringJobsPage companyId={companyId} /> },
  { path: '/admin/bookings', element: (companyId) => <AdminBookingsPage companyId={companyId} /> },
  { path: '/admin/services', element: (companyId) => <AdminServicesPage companyId={companyId} /> },
  { path: '/admin/jobs/new', element: (companyId) => <AdminNewJobPage companyId={companyId} /> },
  { path: '/admin/customers', element: (companyId) => <AdminCustomersPage companyId={companyId} /> },
  { path: '/admin/customers/:customerId', element: (companyId) => <AdminCustomerDetailPage companyId={companyId} /> },
  { path: '/admin/invoices', element: (companyId) => <AdminInvoicesPage companyId={companyId} /> },
  { path: '/admin/quotes', element: (companyId) => <AdminQuotesPage companyId={companyId} /> },
  { path: '/admin/quotes/new', element: (companyId) => <AdminQuoteFormPage companyId={companyId} /> },
  { path: '/admin/quotes/:id/edit', element: (companyId) => <AdminQuoteFormPage companyId={companyId} /> },
  { path: '/admin/settings', element: (companyId) => <Settings companyId={companyId} /> },
  { path: '/admin/settings/checklists', element: () => <SettingsChecklists /> },
  { path: '/admin/reports', element: (companyId) => <AdminReportsPage companyId={companyId} /> },
  { path: '/admin/support-reports', element: () => <SupportReportsPage /> },
];

export default function App() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [subStatus, setSubStatus] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = useCallback(async (userId: string) => {
    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, company_id')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) throw profileError;

      if (profile) {
        setRole(profile.role);
        setCompanyId(profile.company_id);

        if (profile.company_id) {
          const { data: company } = await supabase
            .from('companies')
            .select('subscription_status, trial_ends_at')
            .eq('id', profile.company_id)
            .maybeSingle();
          // 付費後應為 active（由 webhook 寫入）。勿用預設 trialing，否則試用過期會令已付費用戶仍被鎖。
          const status = company?.subscription_status ?? null;
          const trialEndsAt = company?.trial_ends_at ? new Date(company.trial_ends_at) : null;
          const trialingActive = status === 'trialing' && trialEndsAt && trialEndsAt > new Date();
          const paidActive = status === 'active';
          setSubStatus(paidActive || trialingActive ? 'active' : 'inactive');
        } else {
          setSubStatus('inactive');
        }
      }
    } catch (e) {
      console.error('Fetch user/profile error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s) fetchUserData(s.user.id);
      else setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setSession(s);
        if (s) fetchUserData(s.user.id);
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        setRole(null);
        setSubStatus(null);
        setCompanyId(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchUserData]);

  if (loading)
    return (
      <div className="flex h-screen items-center justify-center font-black text-slate-400 uppercase tracking-widest text-xs">
        Initializing System...
      </div>
    );

  return (
    <BrowserRouter>
      <ToastProvider>
        <PlanProvider>
          <CustomerAuthProvider>
            <Routes>
              <Route path="/report/:token" element={<JobReport />} />
              <Route path="/book" element={<BookLanding />} />
              <Route path="/book/:slug" element={<BookLanding />} />
              <Route path="/customer/login" element={<CustomerLogin />} />
              <Route path="/customer-login" element={<CustomerLogin />} />
              <Route path="/customer" element={<CustomerDashboard />} />
              <Route path="/customer/book" element={<CustomerBookPage />} />

              {!session ? (
                <>
                  <Route path="/" element={<CleanFlowHome />} />
                  <Route path="/signup" element={<Signup />} />
                  <Route path="/privacy" element={<PrivacyPolicy />} />
                  <Route path="/terms" element={<TermsOfService />} />
                  <Route path="/data-and-cookies" element={<DataAndCookiesPolicy />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/staff-login" element={<StaffLogin />} />
                  <Route path="*" element={<CleanFlowHome />} />
                </>
              ) : (
                <>
                  {role === 'admin' && (
                    <>
                      <Route
                        path="/dashboard"
                        element={
                          <AdminRoute subStatus={subStatus} companyId={companyId}>
                            <>
                              <TrialBanner />
                              <Dashboard companyId={companyId} />
                            </>
                          </AdminRoute>
                        }
                      />
                      <Route
                        path="/billing"
                        element={
                          subStatus === 'active' ? (
                            <Navigate to="/dashboard" replace />
                          ) : (
                            <Billing companyId={companyId} email={session.user.email} />
                          )
                        }
                      />
                      {ADMIN_ROUTES.map(({ path, element }) => (
                        <Route
                          key={path}
                          path={path}
                          element={
                            <AdminRoute subStatus={subStatus} companyId={companyId}>
                              {element(companyId)}
                            </AdminRoute>
                          }
                        />
                      ))}
                      <Route
                        path="/"
                        element={
                          <Navigate
                            to={subStatus === 'active' ? '/dashboard' : '/billing'}
                            replace
                          />
                        }
                      />
                    </>
                  )}

                  {(role === 'staff' || role === 'supervisor') && (
                    <>
                      <Route path="/staff" element={<StaffDashboard />} />
                      <Route path="/staff/jobs" element={<StaffJobsList />} />
                      <Route path="/staff/timesheet" element={<StaffTimesheet />} />
                      <Route path="/staff/job/:jobId" element={<StaffJobView />} />
                      <Route path="/" element={<Navigate to="/staff" replace />} />
                    </>
                  )}

                  <Route
                    path="*"
                    element={
                      role ? (
                        <Navigate to="/" replace />
                      ) : (
                        <div className="p-10 text-center font-bold">
                          Verifying Permissions...
                        </div>
                      )
                    }
                  />
                </>
              )}
            </Routes>
          </CustomerAuthProvider>
        </PlanProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
