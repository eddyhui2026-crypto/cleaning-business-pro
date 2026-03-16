import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useCustomerAuth } from '../context/CustomerAuthContext';
import { apiUrl } from '../lib/api';
import { ArrowLeft, Loader2, Lock } from 'lucide-react';

const DEFAULT_PASSWORD_HINT = '12345678';

export function CustomerLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useCustomerAuth();
  const state = location.state as { companyId?: string; companyName?: string } | null;
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [companyChoices, setCompanyChoices] = useState<Array<{ company_id: string; company_name: string }>>([]);
  const [companySelectOpen, setCompanySelectOpen] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotPhone, setForgotPhone] = useState('');
  const [forgotCompany, setForgotCompany] = useState(state?.companyId ?? '');
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotRequested, setForgotRequested] = useState(false);
  const [resetCode, setResetCode] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetDone, setResetDone] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!phone.trim()) {
      setError('Phone number is required');
      return;
    }
    if (!password) {
      setError('Password is required');
      return;
    }
    setLoading(true);
    try {
      // Step 1: find companies by phone
      const res = await fetch(apiUrl(`/api/customer/companies-by-phone?phone=${encodeURIComponent(phone.trim())}`));
      const data = await res.json().catch(() => []);
      const companies = Array.isArray(data) ? data : [];
      if (!companies.length) {
        setError('No cleaning company account found for this phone.');
        return;
      }
      if (companies.length === 1) {
        const result = await login(companies[0].company_id, phone.trim(), password);
        if (result.success) {
          navigate('/customer');
        } else {
          setError(result.error || 'Login failed');
        }
        return;
      }
      // Multiple companies: ask user to pick one
      setCompanyChoices(companies);
      setCompanySelectOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    setResetDone(false);
    const cid = (state?.companyId || forgotCompany).trim();
    if (!cid) {
      setForgotError('Enter company ID or booking slug.');
      return;
    }
    if (!forgotPhone.trim()) {
      setForgotError('Enter your phone number.');
      return;
    }
    setForgotLoading(true);
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cid);
      const body = isUuid ? { company_id: cid, phone: forgotPhone.trim() } : { company_slug: cid, phone: forgotPhone.trim() };
      const res = await fetch(apiUrl('/api/customer/forgot-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setForgotRequested(true);
      } else {
        setForgotError((data as any).error || 'Reset failed.');
      }
    } catch (e: any) {
      setForgotError(e?.message || 'Network error.');
    }
    setForgotLoading(false);
  };

  const handleResetConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    setResetDone(false);
    const cid = (state?.companyId || forgotCompany).trim();
    if (!cid) {
      setForgotError('Enter company ID or booking slug.');
      return;
    }
    if (!forgotPhone.trim()) {
      setForgotError('Enter your phone number.');
      return;
    }
    if (!resetCode.trim()) {
      setForgotError('Enter the reset code.');
      return;
    }
    if (!resetNewPassword.trim()) {
      setForgotError('Enter a new password.');
      return;
    }
    if (resetNewPassword.length < 6) {
      setForgotError('New password must be at least 6 characters.');
      return;
    }
    setForgotLoading(true);
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cid);
      const body = isUuid
        ? { company_id: cid, phone: forgotPhone.trim(), token: resetCode.trim(), new_password: resetNewPassword }
        : { company_slug: cid, phone: forgotPhone.trim(), token: resetCode.trim(), new_password: resetNewPassword };
      const res = await fetch(apiUrl('/api/customer/reset-password-confirm'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setResetDone(true);
      } else {
        setForgotError((data as any).error || 'Reset failed.');
      }
    } catch (e: any) {
      setForgotError(e?.message || 'Network error.');
    }
    setForgotLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col">
      <div className="p-4">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-slate-300 hover:text-slate-100 font-medium px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800"
        >
          <ArrowLeft size={20} /> Back
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center px-6 pb-16">
        <div className="w-full max-w-sm bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-[0_18px_45px_rgba(15,23,42,0.9)]">
          <h1 className="text-2xl font-black text-slate-50 mb-2">Customer login</h1>
          <p className="text-slate-400 text-sm mb-2">
            Enter your phone number and password to view your bookings and reports.
          </p>
          <p className="text-amber-200 bg-amber-500/10 border border-amber-500/40 rounded-xl px-3 py-2 text-sm mb-6">
            If your cleaning company created your account for you, they may give you a simple first password such as{' '}
            <strong className="text-amber-300">{DEFAULT_PASSWORD_HINT}</strong>. You can change it after logging in.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 不再需要輸入公司 ID/slug，改為根據電話自動查找曾用公司的列表 */}
            <div>
              <label className="block text-xs font-black text-slate-300 mb-1 uppercase tracking-widest">Phone number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="07XXXXXXXX"
                className="w-full border border-slate-800 bg-slate-950 rounded-2xl px-4 py-3 text-sm text-slate-50 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-400 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-black text-slate-300 mb-1 uppercase tracking-widest">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={DEFAULT_PASSWORD_HINT}
                className="w-full border border-slate-800 bg-slate-950 rounded-2xl px-4 py-3 text-sm text-slate-50 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-400 outline-none"
                required
              />
            </div>
            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 text-red-300 border border-red-500/40 text-sm">{error}</div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-2xl font-black bg-emerald-400 text-slate-950 hover:bg-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/40"
            >
              {loading && <Loader2 className="w-5 h-5 animate-spin" />}
              Log in
            </button>
            <button
              type="button"
              onClick={() => {
                setForgotOpen(true);
                setForgotError(null);
                setForgotRequested(false);
                setResetDone(false);
                setResetCode('');
                setResetNewPassword('');
                setForgotPhone(phone || '');
                setForgotCompany(state?.companyId || '');
              }}
              className="w-full text-sm text-emerald-300 hover:text-emerald-200 hover:underline font-medium flex items-center justify-center gap-1"
            >
              <Lock size={14} /> Forgot password?
            </button>
          </form>
        </div>
      </div>

      {forgotOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={() => !forgotLoading && setForgotOpen(false)}>
          <div className="bg-slate-950 border border-slate-800 rounded-3xl shadow-[0_18px_45px_rgba(15,23,42,0.9)] max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-black text-slate-50 mb-2">Reset password</h2>
            <p className="text-slate-400 text-sm mb-4">
              Step 1: enter your phone number (and company if needed) so we can generate a reset code. Step 2: enter the reset
              code and your new password.
            </p>
            <form onSubmit={forgotRequested ? handleResetConfirm : handleForgotSubmit} className="space-y-4">
              {!state?.companyId && (
                <div>
                  <label className="block text-xs font-black text-slate-300 mb-1 uppercase tracking-widest">Company ID or booking slug</label>
                  <input
                    type="text"
                    value={forgotCompany}
                    onChange={(e) => setForgotCompany(e.target.value)}
                    placeholder="e.g. acme-cleaning"
                    className="w-full border border-slate-800 bg-slate-950 rounded-2xl px-4 py-3 text-sm text-slate-50 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-400 outline-none"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-black text-slate-300 mb-1 uppercase tracking-widest">Phone number</label>
                <input
                  type="tel"
                  value={forgotPhone}
                  onChange={(e) => setForgotPhone(e.target.value)}
                  placeholder="07XXXXXXXX"
                  className="w-full border border-slate-800 bg-slate-950 rounded-2xl px-4 py-3 text-sm text-slate-50 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-400 outline-none"
                />
              </div>
              {forgotRequested && (
                <>
                  <div>
                    <label className="block text-xs font-black text-slate-300 mb-1 uppercase tracking-widest">Reset code</label>
                    <input
                      type="text"
                      value={resetCode}
                      onChange={(e) => setResetCode(e.target.value)}
                      placeholder="6-digit code"
                      className="w-full border border-slate-800 bg-slate-950 rounded-2xl px-4 py-3 text-sm text-slate-50 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-300 mb-1 uppercase tracking-widest">New password</label>
                    <input
                      type="password"
                      value={resetNewPassword}
                      onChange={(e) => setResetNewPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      className="w-full border border-slate-800 bg-slate-950 rounded-2xl px-4 py-3 text-sm text-slate-50 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-400 outline-none"
                    />
                  </div>
                </>
              )}
              {forgotError && <div className="p-3 rounded-xl bg-red-500/10 text-red-300 border border-red-500/40 text-sm">{forgotError}</div>}
              {resetDone && (
                <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-200 border border-emerald-500/40 text-sm">
                  Password has been reset. You can now log in with your new password.
                </div>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setForgotOpen(false)}
                  className="flex-1 py-2 rounded-2xl border border-slate-700 text-slate-200 font-medium hover:bg-slate-900 transition"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="flex-1 py-2 rounded-2xl bg-emerald-400 text-slate-950 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:bg-emerald-300 transition"
                >
                  {forgotLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {forgotRequested ? 'Confirm reset' : 'Request code'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {companySelectOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={() => setCompanySelectOpen(false)}>
          <div
            className="bg-slate-950 border border-slate-800 rounded-3xl shadow-[0_18px_45px_rgba(15,23,42,0.9)] max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-black text-slate-50 mb-2">Select your cleaning company</h2>
            <p className="text-slate-400 text-sm mb-4">
              This phone number is linked to multiple cleaning companies. Choose which company you want to log in to.
            </p>
            <div className="space-y-2">
              {companyChoices.map((c) => (
                <button
                  key={c.company_id}
                  type="button"
                  onClick={async () => {
                    setError(null);
                    setLoading(true);
                    try {
                      const result = await login(c.company_id, phone.trim(), password);
                      if (result.success) {
                        setCompanySelectOpen(false);
                        navigate('/customer');
                      } else {
                        setError(result.error || 'Login failed');
                        setCompanySelectOpen(false);
                      }
                    } finally {
                      setLoading(false);
                    }
                  }}
                  className="w-full text-left px-4 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-sm font-medium text-slate-50"
                >
                  {c.company_name}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setCompanySelectOpen(false)}
              className="mt-4 w-full py-2 rounded-2xl border border-slate-700 text-slate-200 text-sm hover:bg-slate-900"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
