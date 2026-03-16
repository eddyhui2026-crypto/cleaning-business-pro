import { useState } from 'react';
import { X, UserPlus } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { apiUrl } from '../lib/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  companyId: string;
}

export const CreateStaffModal = ({ isOpen, onClose, onSuccess, companyId }: Props) => {
  const [name, setName] = useState('');
  const [role, setRole] = useState('cleaner');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      // 🔐 1. 獲取最新 Session 以取得 JWT Token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        alert("Session expired. Please login again.");
        return;
      }

      const token = session.access_token;

      // 📡 2. 發送 POST 請求
      const res = await fetch(apiUrl('/api/staff'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ name, role }),
      });

      // 檢查結果
      if (res.ok) {
        onSuccess();
        onClose();
        setName('');
      } else {
        // 如果報錯，嘗試讀取 JSON 錯誤訊息
        const errorData = await res.json().catch(() => ({ error: 'Unknown server error' }));
        console.error("Server responded with error:", errorData);
        alert(`Failed to add staff: ${errorData.error || res.statusText}`);
      }
    } catch (err) {
      console.error("Add staff network error:", err);
      alert("Network error, check if your backend (port 4000) is running.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
        <div className="p-8">
          <div className="flex justify-between items-center mb-8">
            <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600">
              <UserPlus size={24} />
            </div>
            <button 
              onClick={onClose} 
              className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          <h2 className="text-2xl font-black text-slate-800 mb-2">Add Team Member</h2>
          <p className="text-slate-500 text-sm mb-8 font-medium">Bring a new professional into your empire.</p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Full Name</label>
              <input
                type="text"
                required
                disabled={isSubmitting}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-slate-700 disabled:opacity-50"
                placeholder="e.g. John Smith"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Role / Position</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setRole('cleaner')}
                  className={`py-3 rounded-xl font-bold text-sm transition-all ${
                    role === 'cleaner' 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' 
                    : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                  }`}
                >
                  Cleaner
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setRole('manager')}
                  className={`py-3 rounded-xl font-bold text-sm transition-all ${
                    role === 'manager' 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' 
                    : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                  }`}
                >
                  Manager
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-black shadow-lg shadow-indigo-100 transition-all active:scale-95 flex items-center justify-center gap-2 mt-4 disabled:bg-slate-300 disabled:shadow-none"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                "Confirm & Add Member"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};