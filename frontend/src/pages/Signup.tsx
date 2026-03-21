import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Building2, Users, Phone, Mail, ArrowRight, Loader2 } from 'lucide-react';
import { apiUrl } from '../lib/api';

export const Signup = () => {
  const navigate = useNavigate();
  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [staffCount, setStaffCount] = useState('');
  /** Honeypot — leave empty */
  const [website, setWebsite] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [emailSent, setEmailSent] = useState<boolean | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (website.trim() !== '') return;
    setSubmitting(true);
    try {
      const staffNum = staffCount.trim() === '' ? undefined : parseInt(staffCount, 10);
      const res = await fetch(apiUrl('/api/public/register-trial'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName,
          contactName,
          email,
          phone,
          staffCount: Number.isFinite(staffNum as number) && (staffNum as number) > 0 ? staffNum : 10,
          website,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data && data.message) || data.error || 'Something went wrong. Please try again.');
        return;
      }
      setEmailSent(data.emailSent !== false);
      setDone(true);
    } catch {
      setError('Network error. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-3xl rounded-3xl border border-emerald-400/40 bg-slate-950/80 shadow-[0_24px_80px_rgba(16,185,129,0.45)] p-6 sm:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="md:w-1/2 space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-400/10 border border-emerald-400/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-200">
              <Sparkles className="h-3 w-3" />
              <span>14‑day free trial</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Start your CleanFlow trial
            </h1>
            <p className="text-sm text-slate-300/80">
              Create your company account in minutes. We&apos;ll email your login link, temporary password, and a short
              welcome message — then you can invite staff and run jobs from the dashboard.
            </p>
            <ul className="mt-2 space-y-1 text-xs text-slate-400">
              <li>• No credit card required to start.</li>
              <li>• Check your inbox (and spam) for login details right after you sign up.</li>
              <li>• Full access to all features during the trial.</li>
            </ul>
          </div>

          {done ? (
            <div className="md:w-1/2 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-6 space-y-3">
              <h2 className="text-lg font-black text-emerald-200">You&apos;re almost there</h2>
              {emailSent ? (
                <p className="text-sm text-slate-200">
                  We&apos;ve sent a welcome email to <strong className="text-white">{email}</strong> with your login page,
                  email address, and temporary password. Please sign in and change your password when you can.
                </p>
              ) : (
                <p className="text-sm text-amber-100">
                  Your account was created, but we couldn&apos;t send email automatically. Please contact support and
                  mention <strong>{email}</strong> so we can send your login details.
                </p>
              )}
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-4 py-3 text-xs font-black uppercase tracking-[0.2em] text-slate-950 shadow-lg shadow-emerald-500/40 hover:bg-emerald-300"
              >
                Go to login
                <ArrowRight size={14} />
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="md:w-1/2 mt-4 md:mt-0 space-y-4">
              {/* Honeypot — hidden from users */}
              <div className="hidden" aria-hidden="true">
                <label htmlFor="signup-website">Website</label>
                <input
                  id="signup-website"
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </div>

              {error && (
                <div className="rounded-xl border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-[11px] font-black text-slate-300 mb-1 uppercase tracking-[0.2em]">
                  Company name
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    className="w-full pl-9 pr-3 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-sm text-slate-50 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-400 outline-none"
                    placeholder="BrightSpark Cleaning Co."
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-black text-slate-300 mb-1 uppercase tracking-[0.2em]">
                    Contact name
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-sm text-slate-50 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-400 outline-none"
                    placeholder="Your name"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-slate-300 mb-1 uppercase tracking-[0.2em]">
                    Estimated staff count
                  </label>
                  <div className="relative">
                    <Users className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                    <input
                      type="number"
                      min={1}
                      className="w-full pl-9 pr-3 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-sm text-slate-50 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-400 outline-none"
                      placeholder="e.g. 8"
                      value={staffCount}
                      onChange={(e) => setStaffCount(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-black text-slate-300 mb-1 uppercase tracking-[0.2em]">
                    Work email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                    <input
                      type="email"
                      required
                      className="w-full pl-9 pr-3 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-sm text-slate-50 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-400 outline-none"
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-black text-slate-300 mb-1 uppercase tracking-[0.2em]">
                    Phone / WhatsApp
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                    <input
                      type="tel"
                      required
                      className="w-full pl-9 pr-3 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-sm text-slate-50 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-400 outline-none"
                      placeholder="+44..."
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-4 py-3 text-xs font-black uppercase tracking-[0.25em] text-slate-950 shadow-lg shadow-emerald-500/40 hover:bg-emerald-300 disabled:opacity-60 disabled:pointer-events-none"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating account…
                  </>
                ) : (
                  <>
                    Create my trial account
                    <ArrowRight size={14} />
                  </>
                )}
              </button>

              <p className="mt-2 text-[11px] text-slate-400 text-center">
                Or{' '}
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="font-semibold text-emerald-300 hover:text-emerald-200 underline-offset-2 hover:underline"
                >
                  go straight to admin login
                </button>{' '}
                if you already have an account.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
