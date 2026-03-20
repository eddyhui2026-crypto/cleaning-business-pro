import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { LogIn, Phone, Lock, Loader2 } from 'lucide-react';

/** Normalise UK phone to +44... for auth email lookup */
function normalisePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('44')) return `+${digits}`;
  if (digits.startsWith('0')) return `+44${digits.slice(1)}`;
  return `+44${digits}`;
}

export const StaffLogin = () => {
  const [phone, setPhone] = useState('+44');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = phone.replace(/\s/g, '');
    if (!trimmed || trimmed === '+44') {
      alert('Please enter your phone number.');
      return;
    }
    if (!password) {
      alert('Please enter your password.');
      return;
    }
    setLoading(true);

    const normalised = normalisePhone(trimmed);
    const authEmail = `${normalised}@phone.cleaning.local`;

    const { error } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password,
    });

    if (error) {
      alert(error.message);
    } else {
      window.location.href = '/staff';
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50 p-6">
      <div className="bg-slate-900/80 p-8 rounded-3xl shadow-[0_18px_45px_rgba(15,23,42,0.9)] w-full max-w-md border border-slate-800">
        <div className="text-center mb-8">
          <div className="bg-emerald-400 w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/40">
            <LogIn className="text-slate-950" />
          </div>
          <h1 className="text-2xl font-black text-slate-50">Staff Login</h1>
          <p className="text-slate-400 text-sm mt-1">Sign in with your phone number (no email needed)</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-black text-slate-300 mb-1 uppercase tracking-widest">Phone number</label>
            <div className="relative flex">
              <span className="inline-flex items-center pl-3 pr-3 text-slate-200 border border-r-0 border-slate-800 rounded-l-2xl bg-slate-950 text-xs font-bold tracking-widest">
                +44
              </span>
              <div className="relative flex-1">
                <Phone className="absolute left-3 top-2.5 text-slate-500 pointer-events-none" size={18} />
                <input
                  type="tel"
                  required
                  className="w-full pl-10 pr-4 py-3 border border-slate-800 rounded-r-2xl bg-slate-950 text-sm text-slate-50 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-400 outline-none"
                  placeholder="7700 123456"
                  value={phone === '+44' ? '' : phone.replace(/^\+44/, '')}
                  onChange={(e) => {
                    let digits = e.target.value.replace(/\D/g, '');
                    if (digits.startsWith('44')) digits = digits.slice(2);
                    setPhone(digits ? `+44${digits}` : '+44');
                  }}
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-black text-slate-300 mb-1 uppercase tracking-widest">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 text-slate-500" size={18} />
              <input
                type="password"
                required
                className="w-full pl-10 pr-4 py-3 border border-slate-800 rounded-2xl bg-slate-950 text-sm text-slate-50 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-400 outline-none"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <p className="mt-1.5 text-xs text-slate-400">
              Use the <strong className="text-emerald-300">temporary password</strong> your admin shared when your account was created. You can change it after you sign in.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-400 text-slate-950 font-black py-3 rounded-2xl hover:bg-emerald-300 transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          <a href="/login" className="font-semibold text-emerald-300 hover:text-emerald-200 underline-offset-4 hover:underline">
            Admin? Sign in with email
          </a>
        </p>
      </div>
    </div>
  );
};
