import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { LogIn, Mail, Lock, Loader2 } from 'lucide-react';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert(error.message);
    } else {
      // 登入成功後跳轉到 Dashboard
      window.location.href = '/dashboard';
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
          <h1 className="text-2xl font-black text-slate-50 tracking-tight">Cleaning Business Pro</h1>
          <p className="text-slate-400 text-sm mt-1">Sign in to manage your cleaning team</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-black text-slate-300 mb-1 uppercase tracking-widest">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 text-slate-500" size={18} />
              <input 
                type="email"
                required
                className="w-full pl-10 pr-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-sm text-slate-50 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-400 outline-none transition-all"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-black text-slate-300 mb-1 uppercase tracking-widest">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 text-slate-500" size={18} />
              <input 
                type="password"
                required
                className="w-full pl-10 pr-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-sm text-slate-50 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-400 outline-none transition-all"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
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
          <a href="/staff-login" className="font-semibold text-emerald-300 hover:text-emerald-200 underline-offset-4 hover:underline">
            Staff login
          </a>
        </p>
      </div>
    </div>
  );
};