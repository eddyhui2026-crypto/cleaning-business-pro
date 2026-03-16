import { useState, useEffect } from 'react';
import { X, Loader2, Search } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { apiUrl } from '../lib/api';

// 🛠️ 介面定義
interface Staff {
  id: string;
  full_name: string;
  role: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  companyId: string;
  initialDate?: string;
  staffList: Staff[];
}

export const CreateJobModal = ({ isOpen, onClose, onSuccess, companyId, initialDate, staffList }: Props) => {
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    client_name: '',
    door_number: '', 
    postcode: '',    
    address: '',     
    scheduled_at: '',
    staffIds: [] as string[],
    notes: '',
    price: '',
    status: 'pending',
    client_phone: '',
    client_email: '',
  });

  // 🔄 當 Modal 開啟時初始化數據 (15-min round for Date & Time)
  useEffect(() => {
    if (isOpen) {
      let dateStr = '';
      if (initialDate) {
        const d = new Date(initialDate);
        const m = d.getMinutes();
        const rounded = Math.round(m / 15) * 15;
        d.setMinutes(rounded % 60);
        d.setHours(d.getHours() + Math.floor(rounded / 60));
        dateStr = d.toISOString().slice(0, 16);
      }
      setFormData({
        client_name: '',
        door_number: '',
        postcode: '',
        address: '',
        scheduled_at: dateStr,
        staffIds: [],
        notes: '',
        price: '',
        status: 'pending',
        client_phone: '',
        client_email: '',
      });
      setFormError(null);
    }
  }, [isOpen, initialDate]);

  // 🔍 Google Postcode 搜尋地址邏輯
  const handlePostcodeLookup = async () => {
    setFormError(null);
    if (!formData.postcode?.trim()) {
      setFormError('Please enter a postcode first.');
      return;
    }
    if (typeof google === 'undefined' || !google.maps) {
      setFormError('Address lookup is loading. Please refresh or try again in a moment.');
      return;
    }

    setSearching(true);
    try {
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ address: formData.postcode.trim() }, (results, status) => {
        if (status === 'OK' && results && results[0]) {
          const street = results[0].formatted_address;
          setFormData(prev => ({ ...prev, address: street }));
          setFormError(null);
        } else {
          setFormError('Address not found for this postcode. Please enter the address manually.');
        }
        setSearching(false);
      });
    } catch (error) {
      console.error('Google Map Error:', error);
      setFormError('Address lookup failed. Please enter the address manually.');
      setSearching(false);
    }
  };

  // 👥 切換員工選擇
  const toggleStaff = (id: string) => {
    setFormData(prev => ({
      ...prev,
      staffIds: prev.staffIds.includes(id)
        ? prev.staffIds.filter(sid => sid !== id)
        : [...prev.staffIds, id]
    }));
  };

  // Get coordinates from address (Google Geocoder) for staff clock-in
  const geocodeAddress = (address: string): Promise<{ lat: number; lng: number } | null> => {
    return new Promise((resolve) => {
      if (!address?.trim() || typeof google === 'undefined' || !google.maps?.Geocoder) {
        resolve(null);
        return;
      }
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ address: address.trim() }, (results, status) => {
        if (status === 'OK' && results?.[0]?.geometry?.location) {
          resolve({ lat: results[0].geometry.location.lat(), lng: results[0].geometry.location.lng() });
        } else {
          resolve(null);
        }
      });
    });
  };

  // 📤 提交表單
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const finalAddress = `${formData.door_number ? formData.door_number + ', ' : ''}${formData.address} ${formData.postcode}`.trim();

      const coords = await geocodeAddress(finalAddress);
      const payload: Record<string, unknown> = {
        client_name: formData.client_name,
        address: finalAddress,
        scheduled_at: formData.scheduled_at,
        notes: formData.notes,
        staffIds: formData.staffIds,
        status: formData.status,
        price: formData.price || '0',
      };
      if (coords) {
        payload.job_latitude = coords.lat;
        payload.job_longitude = coords.lng;
      }
      if (formData.client_phone?.trim()) payload.client_phone = formData.client_phone.trim();
      if (formData.client_email?.trim()) payload.client_email = formData.client_email.trim();

      const response = await fetch(apiUrl('/api/jobs'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        onSuccess();
        onClose();
      } else {
        const errorData = await response.json().catch(() => ({}));
        setFormError((errorData as any).error || 'Failed to save job.');
      }
    } catch (err) {
      console.error("Submit error:", err);
      setFormError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 text-left">
      <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-y-auto max-h-[95vh] animate-in zoom-in duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-8 border-b border-slate-50 bg-slate-50/30">
          <div>
            <h2 className="text-2xl font-black text-slate-800">New Job</h2>
            <p className="text-sm text-slate-500 font-medium">Postcode lookup powered by Google</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-white hover:shadow-md rounded-full transition-all">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {formError && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm font-medium" role="alert">
              {formError}
            </div>
          )}

          {/* Client & Price Row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Client name <span className="text-red-500">*</span></label>
              <input 
                type="text" 
                required 
                placeholder="e.g. John Smith"
                className="w-full px-4 py-3.5 bg-slate-50 border-none rounded-2xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 transition" 
                value={formData.client_name} 
                onChange={e => setFormData({...formData, client_name: e.target.value})} 
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Price (£)</label>
              <input 
                type="number" 
                step="0.01"
                placeholder="0.00"
                className="w-full px-4 py-3.5 bg-slate-50 border-none rounded-2xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 transition" 
                value={formData.price} 
                onChange={e => setFormData({...formData, price: e.target.value})} 
              />
            </div>
          </div>

          {/* Client phone & email — creates customer account and sends login details */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Client phone (optional)</label>
              <input 
                type="tel" 
                placeholder="07XXXXXXXX"
                className="w-full px-4 py-3.5 bg-slate-50 border-none rounded-2xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 transition" 
                value={formData.client_phone} 
                onChange={e => setFormData({...formData, client_phone: e.target.value})} 
              />
              <p className="text-[10px] text-slate-400 mt-1 px-1">Creates customer account; sends login by email</p>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Client email (optional)</label>
              <input 
                type="email" 
                placeholder="client@example.com"
                className="w-full px-4 py-3.5 bg-slate-50 border-none rounded-2xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 transition" 
                value={formData.client_email} 
                onChange={e => setFormData({...formData, client_email: e.target.value})} 
              />
            </div>
          </div>

          {/* Door No. & Postcode Row */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Door No.</label>
              <input 
                type="text" 
                placeholder="Flat 1" 
                className="w-full px-4 py-3.5 bg-slate-50 border-none rounded-2xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 transition"
                value={formData.door_number} 
                onChange={e => setFormData({...formData, door_number: e.target.value})} 
              />
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Postcode</label>
              <p className="text-[10px] text-slate-400 mb-1 px-1">Enter UK postcode then click Look up address.</p>
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="e.g. SW1A 1AA"
                  className="w-full px-4 py-3.5 bg-slate-50 border-none rounded-2xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 transition uppercase"
                  value={formData.postcode} 
                  onChange={e => setFormData({...formData, postcode: e.target.value})} 
                />
                <button 
                  type="button" 
                  onClick={handlePostcodeLookup} 
                  className="absolute right-2 top-2 p-1.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100"
                >
                  {searching ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
                </button>
              </div>
            </div>
          </div>

          {/* Street Address Textarea */}
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Street Address</label>
            <textarea 
              required 
              placeholder="Address will auto-fill or enter manually..."
              className="w-full px-4 py-3.5 bg-slate-50 border-none rounded-2xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 transition min-h-[60px]"
              value={formData.address} 
              onChange={e => setFormData({...formData, address: e.target.value})} 
            />
          </div>

          {/* Date & Time — 15-minute increments */}
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Date & Start Time</label>
            <input 
              type="datetime-local" 
              required 
              step="900"
              className="w-full px-4 py-3.5 bg-slate-50 border-none rounded-2xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 transition"
              value={formData.scheduled_at} 
              onChange={e => setFormData({...formData, scheduled_at: e.target.value})} 
            />
            <p className="text-[10px] text-slate-500 mt-1 px-1">15-minute steps (:00, :15, :30, :45).</p>
            {formData.scheduled_at && (() => {
              const d = new Date(formData.scheduled_at);
              const h = d.getHours();
              const m = d.getMinutes();
              const mins = h * 60 + m;
              const outsideStandard = mins < 7 * 60 || mins >= 19 * 60;
              return outsideStandard ? (
                <p className="text-[10px] text-amber-600 mt-1 px-1 font-medium">Note: This job is outside standard hours (07:00–19:00).</p>
              ) : null;
            })()}
          </div>

          {/* Staff Selection */}
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1">Assign Staff</label>
            <div className="flex flex-wrap gap-2 p-4 bg-slate-50 border border-slate-100 rounded-[2rem] min-h-[70px]">
              {staffList.length > 0 ? staffList.map(staff => (
                <button 
                  key={staff.id} 
                  type="button" 
                  onClick={() => toggleStaff(staff.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all duration-200 ${
                    formData.staffIds.includes(staff.id) 
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-105' 
                      : 'bg-white text-slate-500 border border-slate-100 hover:border-indigo-200'
                  }`}
                >
                  {staff.full_name}
                </button>
              )) : (
                <p className="text-[10px] font-bold text-slate-400 italic w-full text-center py-2">No staff available</p>
              )}
            </div>
          </div>

          {/* Submit & Cancel Buttons */}
          <div className="flex gap-4 pt-4 border-t border-slate-50">
            <button 
              type="button" 
              onClick={onClose} 
              className="flex-1 px-4 py-4 rounded-2xl font-black text-slate-400 hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={loading} 
              className="flex-[2] bg-slate-900 hover:bg-indigo-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-slate-200 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:bg-slate-200"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : 'Publish Job'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};