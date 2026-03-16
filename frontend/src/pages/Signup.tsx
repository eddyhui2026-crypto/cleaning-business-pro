import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Building2, Users, Phone, Mail, ArrowRight } from 'lucide-react';

export const Signup = () => {
  const navigate = useNavigate();
  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [staffCount, setStaffCount] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const subject = `New CleanFlow trial request – ${companyName || 'Cleaning company'}`;
    const lines = [
      `Company: ${companyName}`,
      `Contact: ${contactName}`,
      `Email: ${email}`,
      `Phone: ${phone}`,
      `Estimated staff: ${staffCount}`,
      '',
      'Please help me set up a CleanFlow trial account.',
    ];
    const body = encodeURIComponent(lines.join('\n'));
    window.location.href = `mailto:support@cleanflow.app?subject=${encodeURIComponent(subject)}&body=${body}`;
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
              Tell us a few details about your cleaning business and we&apos;ll help you get your
              account ready – staff logins, schedule, and invoice settings included.
            </p>
            <ul className="mt-2 space-y-1 text-xs text-slate-400">
              <li>• No credit card required to start.</li>
              <li>• Full access to all features during the trial.</li>
              <li>• We can migrate a small amount of data from your existing system.</li>
            </ul>
          </div>

          <form onSubmit={handleSubmit} className="md:w-1/2 mt-4 md:mt-0 space-y-4">
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
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-4 py-3 text-xs font-black uppercase tracking-[0.25em] text-slate-950 shadow-lg shadow-emerald-500/40 hover:bg-emerald-300"
            >
              Request trial setup
              <ArrowRight size={14} />
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
        </div>
      </div>
    </div>
  );
}

