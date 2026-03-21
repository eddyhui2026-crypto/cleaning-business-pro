import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Mail, Save, Image as ImageIcon, Loader2, CheckCircle2, Globe, Package, Download, ClipboardList, Users, ChevronLeft, Shield, KeyRound, Lock, CreditCard, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { apiUrl } from '../lib/api';
import { useToast } from '../context/ToastContext';
import { AdminBottomNav } from '../components/AdminBottomNav';
import { HelpLink } from '../components/HelpLink';
import { HelpAnchor } from '../config/helpAnchors';
import { DATA_RETENTION_MESSAGE } from '../lib/dataRetention';

// 1. 定義 Props 介面，解決 Dashboard 傳入 companyId 的錯誤
interface SettingsProps {
  companyId: string | null;
}

// 2. 定義公司資料的型別
interface CompanyData {
  id: string;
  name: string;
  contact_email: string;
  logo_url: string;
  report_footer: string;
  booking_slug: string;
  /** Set after first successful Stripe Checkout — enables Customer Portal */
  stripe_customer_id?: string | null;
}

export const Settings = ({ companyId }: SettingsProps) => {
  const navigate = useNavigate();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [catalogEmpty, setCatalogEmpty] = useState<boolean | null>(null);
  const [importingCatalog, setImportingCatalog] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ newPassword: '', confirmPassword: '' });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [company, setCompany] = useState<CompanyData>({
    id: '',
    name: '',
    contact_email: '',
    logo_url: '',
    report_footer: '',
    booking_slug: '',
    stripe_customer_id: null,
  });
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    fetchCompanySettings();
  }, [companyId]); // 當 companyId 改變時重新讀取

  const fetchCompanySettings = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 優先使用 props 傳進來的 companyId，若無則根據 owner_id 抓取
      let { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq(companyId ? 'id' : 'owner_id', companyId || user.id)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        // 如果沒資料，建立一筆預設的
        const { data: newCompany, error: insertError } = await supabase
          .from('companies')
          .insert([{ 
            owner_id: user.id, 
            name: 'My Cleaning Business', 
            subscription_status: 'active' 
          }])
          .select()
          .single();
        
        if (insertError) throw insertError;
        data = newCompany;
      }

      if (data) {
        setCompany({
          id: data.id,
          name: data.name || '',
          contact_email: data.contact_email || '',
          logo_url: data.logo_url || '',
          report_footer: data.report_footer || '',
          booking_slug: data.booking_slug || '',
          stripe_customer_id: (data as { stripe_customer_id?: string | null }).stripe_customer_id ?? null,
        });
      }
    } catch (err: any) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCatalogEmpty = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const res = await fetch(apiUrl('/api/admin/services'), { headers: { Authorization: `Bearer ${session.access_token}` } });
      const list = await res.json().catch(() => []);
      setCatalogEmpty(Array.isArray(list) && list.length === 0);
    } catch {
      setCatalogEmpty(null);
    }
  };

  useEffect(() => {
    if (company.id) fetchCatalogEmpty();
    else setCatalogEmpty(null);
  }, [company.id]);

  const handleImportUkStandard = async () => {
    setImportingCatalog(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(apiUrl('/api/admin/services/import-uk-standard'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error((data as any).error || 'Import failed');
        return;
      }
      toast.success('UK Standard services imported successfully!');
      setCatalogEmpty(false);
    } catch {
      toast.error('Import failed');
    } finally {
      setImportingCatalog(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !company.id) return;

    // 限制檔案大小 (2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert("File is too large. Please upload an image under 2MB.");
      return;
    }

    setSaving(true);
    try {
      const fileExt = file.name.split('.').pop();
      // 使用時間戳作為檔名一部分，強制讓瀏覽器識別為新圖
      const fileName = `logo_${company.id}_${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('company-assets')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true 
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('company-assets')
        .getPublicUrl(fileName);

      setCompany(prev => ({ ...prev, logo_url: publicUrl }));
      
      // 自動同步到資料庫
      const { error: updateError } = await supabase
        .from('companies')
        .update({ logo_url: publicUrl })
        .eq('id', company.id);

      if (updateError) throw updateError;

      setMessage('Logo updated successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      console.error("Upload error:", err);
      alert("Upload failed: " + (err.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  const saveSettings = async () => {
    if (!company.id) return;
    setSaving(true);
    setMessage('');

    try {
      const { error } = await supabase
        .from('companies')
        .update({
          name: company.name,
          contact_email: company.contact_email,
          logo_url: company.logo_url,
          report_footer: company.report_footer,
          booking_slug: company.booking_slug?.trim() || null,
          updated_at: new Date()
        })
        .eq('id', company.id);

      if (error) throw error;

      setMessage('Settings saved successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      console.error("Save error:", err);
      alert("Save failed: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);

    if (passwordForm.newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: 'New password must be at least 6 characters.' });
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'New password and confirm do not match.' });
      return;
    }

    setPasswordSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: passwordForm.newPassword });
      if (error) {
        setPasswordMessage({ type: 'error', text: error.message });
        return;
      }
      setPasswordMessage({ type: 'success', text: 'Password updated successfully.' });
      setPasswordForm({ newPassword: '', confirmPassword: '' });
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('cf_admin_password_changed', '1');
      }
    } catch (err: any) {
      setPasswordMessage({ type: 'error', text: err?.message || 'Failed to update password.' });
    } finally {
      setPasswordSaving(false);
    }
  };

  const openBillingPortal = async () => {
    setPortalLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error('Please sign in again.');
        return;
      }
      const res = await fetch(apiUrl('/api/billing/create-portal-session'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: '{}',
      });
      const data = await res.json().catch(() => ({}));
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      toast.error(data.message || data.error || 'Could not open subscription management.');
    } catch {
      toast.error('Network error.');
    } finally {
      setPortalLoading(false);
    }
  };

  if (loading) return (
    <div className="flex h-96 items-center justify-center bg-slate-950">
      <Loader2 className="animate-spin text-emerald-400" size={32} />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 pb-20">
      <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in duration-500 px-4 pt-4">
      {/* 頂部：返回鍵 + 標題 */}
      <div className="flex items-center justify-between gap-3 w-full">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="p-2 -ml-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors shrink-0"
            aria-label="Back"
          >
            <ChevronLeft size={24} />
          </button>
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-50 tracking-tight uppercase">Company Settings</h1>
            <p className="text-slate-400 font-bold text-sm mt-0.5 uppercase tracking-widest">
              Brand your business & reports
            </p>
          </div>
        </div>
        <HelpLink anchor={HelpAnchor.Settings} className="shrink-0" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* 左側：品牌預覽 */}
        <div className="space-y-6">
          <div className="bg-slate-900/80 p-8 rounded-[3rem] border border-slate-800 shadow-[0_18px_45px_rgba(15,23,42,0.9)] flex flex-col items-center text-center">
            <label className="relative group cursor-pointer">
              <div className="w-32 h-32 rounded-[2.5rem] bg-slate-950 border-2 border-dashed border-slate-700 flex items-center justify-center overflow-hidden transition-all group-hover:bg-slate-900">
                {company.logo_url ? (
                  <img src={company.logo_url} alt="Logo" className="w-full h-full object-contain p-4" />
                ) : (
                  <div className="flex flex-col items-center text-slate-500">
                    <ImageIcon size={32} />
                    <span className="text-[10px] font-black mt-2 uppercase tracking-tighter">No Logo</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-emerald-400/10 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center text-emerald-400">
                  <ImageIcon size={24} />
                </div>
              </div>
              <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
            </label>
            <h3 className="mt-6 font-black text-slate-50 uppercase tracking-tight truncate w-full px-2">
              {company.name || 'Your Business'}
            </h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1 italic">
              Brand Identity
            </p>
          </div>

          <div className="bg-slate-900/80 p-6 rounded-[2.5rem] border border-slate-800">
            <h4 className="text-[10px] font-black text-emerald-300 uppercase tracking-widest flex items-center gap-2">
               <Globe size={14} /> Report Tip
            </h4>
            <p className="text-xs text-slate-300 mt-2 font-medium leading-relaxed">
              Transparent PNGs look best. Your logo appears on all public job reports and customer invoices.
            </p>
          </div>
        </div>

        {/* 右側：詳細設定 */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-slate-900/80 p-6 md:p-8 rounded-[2.5rem] border border-emerald-500/20 shadow-[0_18px_45px_rgba(15,23,42,0.9)] space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-emerald-300 flex items-center gap-2">
              <CreditCard size={16} /> Billing & subscription
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Upgrade during your trial, change plan, or manage payment method and cancellation in Stripe&apos;s secure
              portal.
            </p>
            <div className="flex flex-col sm:flex-row flex-wrap gap-3">
              <button
                type="button"
                onClick={() => navigate('/billing')}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 text-slate-950 px-5 py-3 text-xs font-black uppercase tracking-wider hover:bg-emerald-400"
              >
                Plans & upgrade
                <ExternalLink size={14} />
              </button>
              <button
                type="button"
                onClick={openBillingPortal}
                disabled={portalLoading || !company.stripe_customer_id}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-600 bg-slate-950 px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-200 hover:border-emerald-500/50 hover:text-emerald-300 disabled:opacity-45 disabled:pointer-events-none"
              >
                {portalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard size={14} />}
                Manage subscription
              </button>
            </div>
            {!company.stripe_customer_id && (
              <p className="text-[11px] text-slate-500">
                &quot;Manage subscription&quot; unlocks after you complete checkout once (same email as your admin
                account).
              </p>
            )}
          </div>

          <div className="bg-slate-900/80 p-6 md:p-10 rounded-[3rem] border border-slate-800 shadow-[0_18px_45px_rgba(15,23,42,0.9)] space-y-8">
            
            <div className="grid grid-cols-1 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-300 ml-2 tracking-widest flex items-center gap-2">
                  <Building2 size={12} /> Business Name
                </label>
                <input 
                  type="text" 
                  value={company.name} 
                  onChange={e => setCompany({...company, name: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 font-bold text-slate-50 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-400 transition-all outline-none" 
                  placeholder="e.g. Pure Cleaning Services"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-300 ml-2 tracking-widest flex items-center gap-2">
                  <Mail size={12} /> Contact Email (for reports)
                </label>
                <input 
                  type="email" 
                  value={company.contact_email} 
                  onChange={e => setCompany({...company, contact_email: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 font-bold text-slate-50 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-400 transition-all outline-none" 
                  placeholder="hello@cleaning.com"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-300 ml-2 tracking-widest flex items-center gap-2">
                  <Globe size={12} /> Online booking link slug
                </label>
                <input 
                  type="text" 
                  value={company.booking_slug} 
                  onChange={e => setCompany({...company, booking_slug: e.target.value.replace(/\s+/g, '-').toLowerCase()})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 font-bold text-slate-50 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-400 transition-all outline-none" 
                  placeholder="e.g. acme-cleaning"
                />
                <p className="text-[9px] text-slate-500 font-bold ml-2 italic">Customers can book at /book/your-slug</p>
              </div>
            </div>

            <div className="space-y-2 border-t border-slate-800 pt-8">
              <label className="text-[10px] font-black uppercase text-slate-300 ml-2 tracking-widest">
                Report Footer Message
              </label>
              <textarea 
                value={company.report_footer} 
                onChange={e => setCompany({...company, report_footer: e.target.value})}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 font-medium text-slate-50 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-400 transition-all outline-none min-h-[100px]" 
                placeholder="e.g. Thank you for choosing our services. This report is valid for 30 days."
              />
              <p className="text-[9px] text-slate-500 font-bold ml-2 italic">Visible at the bottom of the public report page.</p>
            </div>

            <div className="pt-4 flex flex-wrap items-center gap-4">
              <button 
                onClick={saveSettings}
                disabled={saving}
                className="bg-emerald-400 text-slate-950 px-10 py-4 rounded-3xl font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-emerald-500/40 hover:bg-emerald-300 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>}
                Save Configuration
              </button>

              {message && (
                <div className="flex items-center gap-2 text-emerald-300 font-black text-[10px] uppercase animate-in fade-in slide-in-from-left-2">
                  <CheckCircle2 size={16} /> {message}
                </div>
              )}
            </div>

          </div>

          <div className="bg-slate-900/80 p-6 rounded-[2.5rem] border border-slate-800">
            <h3 className="text-[10px] font-black uppercase text-slate-300 tracking-widest mb-2">Checklist templates</h3>
            <p className="text-xs text-slate-400 mb-4">Edit the task lists staff see on each job (Standard Clean, Office Clean, etc.). You can add or remove items.</p>
            <button
              type="button"
              onClick={() => navigate('/admin/settings/checklists')}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 rounded-xl font-medium hover:bg-emerald-500/30 transition-colors"
            >
              <ClipboardList size={18} /> Edit checklists
            </button>
          </div>

          <div className="bg-slate-900/80 p-6 rounded-[2.5rem] border border-slate-800">
            <h3 className="text-[10px] font-black uppercase text-slate-300 tracking-widest mb-2">Staff management</h3>
            <p className="text-xs text-slate-400 mb-4">Add and manage staff, roles and permissions.</p>
            <button
              type="button"
              onClick={() => navigate('/admin/staff')}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 rounded-xl font-medium hover:bg-emerald-500/30 transition-colors"
            >
              <Users size={18} /> Open staff management
            </button>
          </div>

          <div className="bg-slate-900/80 p-6 rounded-[2.5rem] border border-slate-800">
            <h3 className="text-[10px] font-black uppercase text-slate-300 tracking-widest mb-2">Service catalog</h3>
            <p className="text-xs text-slate-400 mb-4">Manage your services and base prices in one place. Changes sync to the Quote Editor and customer booking.</p>
            {catalogEmpty === true && (
              <div className="mb-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-400/30">
                <p className="text-sm font-medium text-amber-200 mb-3">Your catalog is empty. Import the UK standard price list in one click.</p>
                <button
                  type="button"
                  onClick={handleImportUkStandard}
                  disabled={importingCatalog}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 disabled:opacity-50 transition-colors"
                >
                  {importingCatalog ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                  Import UK Standard Price List
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => navigate('/admin/services')}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 rounded-xl font-medium hover:bg-emerald-500/30 transition-colors"
            >
              <Package size={18} /> Open Service catalog
            </button>
          </div>

          <div className="bg-slate-900/80 p-6 rounded-[2.5rem] border border-slate-800">
            <h3 className="text-[10px] font-black uppercase text-slate-300 tracking-widest mb-2 flex items-center gap-2">
              <KeyRound size={14} /> Security
            </h3>
            <p className="text-xs text-slate-400 mb-4">Change your admin login password.</p>

            <button
              type="button"
              onClick={() => setShowChangePassword(v => !v)}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 rounded-xl font-medium hover:bg-emerald-500/30 transition-colors"
            >
              <Lock size={18} /> {showChangePassword ? 'Hide' : 'Change password'}
            </button>

            {showChangePassword && (
              <form onSubmit={handleChangePassword} className="mt-4 space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-300 ml-2 tracking-widest">
                    New password
                  </label>
                  <input
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 font-bold text-slate-50 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-400 transition-all outline-none"
                    placeholder="Enter new password"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-300 ml-2 tracking-widest">
                    Confirm new password
                  </label>
                  <input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 font-bold text-slate-50 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-400 transition-all outline-none"
                    placeholder="Confirm new password"
                  />
                </div>

                {passwordMessage && (
                  <p className={`text-xs font-bold ${passwordMessage.type === 'success' ? 'text-emerald-300' : 'text-rose-300'} `}>
                    {passwordMessage.text}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={passwordSaving}
                  className="bg-emerald-400 text-slate-950 px-10 py-4 rounded-3xl font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-emerald-500/40 hover:bg-emerald-300 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
                >
                  {passwordSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  {passwordSaving ? 'Saving...' : 'Update password'}
                </button>
              </form>
            )}
          </div>

          <div className="bg-slate-900/80 p-6 rounded-[2.5rem] border border-slate-800">
            <h3 className="text-[10px] font-black uppercase text-slate-300 tracking-widest mb-2 flex items-center gap-2">
              <Shield size={14} /> Data retention
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              {DATA_RETENTION_MESSAGE} You can inform your staff and customers of this policy. Old photos are cleared automatically every day by the server; you do not need to run any SQL manually.
            </p>
          </div>
        </div>
      </div>
      </div>
      <AdminBottomNav />
    </div>
  );
};