import { useState, useCallback, useEffect } from 'react';
import { X, Save, Trash2, MapPin, Camera, Loader2, Link as LinkIcon, Check, Clock, AlertCircle, Mail, ChevronDown, ChevronUp } from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

declare global {
  interface Window {
    google?: typeof google;
  }
}
import { supabase } from '../lib/supabaseClient';
import { apiUrl } from '../lib/api';

interface Props {
  job: any;
  staffList: any[];
  onClose: () => void;
  onSuccess: () => void;
}

export const EditJobModal = ({ job, staffList, onClose, onSuccess }: Props) => {
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [staffSearch, setStaffSearch] = useState('');
  
  const raw = job.extendedProps || job;
  const initialScheduled = job.scheduled_at || raw?.scheduled_at || job.start;
  const toDatetimeLocal = (iso: string) => {
    const d = new Date(iso);
    const m = d.getMinutes();
    const rounded = Math.round(m / 15) * 15;
    d.setMinutes(rounded % 60);
    d.setHours(d.getHours() + Math.floor(rounded / 60));
    return d.toISOString().slice(0, 16);
  };
  const detailsObj = (job.details ?? raw?.details) as Record<string, unknown> | undefined;
  const [formData, setFormData] = useState({
    client_name: job.client_name || job.title || '',
    address: job.address || raw?.address || '',
    staff_ids: (job.staff_members || raw?.staff_members || []).map((s: any) => s.id) as string[],
    notes: job.notes || raw?.notes || '',
    before_photos: job.before_photos || raw?.before_photos || [],
    after_photos: job.after_photos || raw?.after_photos || [],
    status: job.status || raw?.status || 'pending',
    job_latitude: job.job_latitude != null ? String(job.job_latitude) : (raw?.job_latitude != null ? String(raw.job_latitude) : ''),
    job_longitude: job.job_longitude != null ? String(job.job_longitude) : (raw?.job_longitude != null ? String(raw.job_longitude) : ''),
    job_start_time: job.job_start_time || raw?.job_start_time ? (job.job_start_time || raw?.job_start_time).slice(0, 16) : '',
    scheduled_at: initialScheduled ? toDatetimeLocal(initialScheduled) : '',
    property_type: (detailsObj?.property_type as string) || 'residential',
    bedrooms: detailsObj?.bedrooms != null ? String(detailsObj.bedrooms) : '',
    sq_ft: detailsObj?.sq_ft != null ? String(detailsObj.sq_ft) : '',
    estimated_hours: detailsObj?.estimated_hours != null ? String(detailsObj.estimated_hours) : '2',
    client_phone: (job.client_phone ?? raw?.client_phone ?? (detailsObj?.client_phone as string) ?? '') as string,
    client_email: (job.client_email ?? raw?.client_email ?? (detailsObj?.client_email as string) ?? '') as string,
  });
  const recurringJobId = job.recurring_job_id ?? raw?.recurring_job_id ?? null;
  const [editScope, setEditScope] = useState<'this' | 'future'>('this');
  const [geocodeStatus, setGeocodeStatus] = useState<'idle' | 'looking' | 'ok' | 'fail'>('idle');
  const [postcodeLookupLoading, setPostcodeLookupLoading] = useState(false);
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const [timeError, setTimeError] = useState<string | null>(null);

  const fetchCoordinatesFromAddress = useCallback((address: string) => {
    const trimmed = address?.trim() || '';
    if (trimmed.length < 5) {
      setFormData(prev => ({ ...prev, job_latitude: '', job_longitude: '' }));
      setGeocodeStatus('idle');
      return;
    }
    if (typeof window === 'undefined' || !window.google?.maps?.Geocoder) {
      setGeocodeStatus('fail');
      return;
    }
    setGeocodeStatus('looking');
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ address: trimmed }, (results, status) => {
      if (status === 'OK' && results?.[0]?.geometry?.location) {
        const lat = results[0].geometry.location.lat();
        const lng = results[0].geometry.location.lng();
        setFormData(prev => ({ ...prev, job_latitude: String(lat), job_longitude: String(lng) }));
        setGeocodeStatus('ok');
      } else {
        setFormData(prev => ({ ...prev, job_latitude: '', job_longitude: '' }));
        setGeocodeStatus('fail');
      }
    });
  }, []);

  const handlePostcodeLookup = () => {
    const query = formData.address.trim();
    if (query.length < 3) return;
    if (typeof window === 'undefined' || !window.google?.maps?.Geocoder) {
      setGeocodeStatus('fail');
      return;
    }
    setPostcodeLookupLoading(true);
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ address: query }, (results, status) => {
      if (status === 'OK' && results?.[0]) {
        const street = results[0].formatted_address;
        setFormData(prev => ({ ...prev, address: street }));
        fetchCoordinatesFromAddress(street);
      } else {
        setGeocodeStatus('fail');
      }
      setPostcodeLookupLoading(false);
    });
  };

  // When opening a job that has address but no coordinates yet, auto-fetch once
  useEffect(() => {
    const addr = formData.address.trim();
    const hasCoords = formData.job_latitude && formData.job_longitude;
    if (addr.length >= 5 && !hasCoords && typeof window !== 'undefined' && window.google?.maps?.Geocoder) {
      fetchCoordinatesFromAddress(addr);
    }
  }, [fetchCoordinatesFromAddress]);

  // 🔗 複製報告連結
  const copyShareLink = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const token = job.share_token || job.extendedProps?.share_token;
    if (!token) return;

    const link = `${window.location.origin}/report/${token}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      window.prompt("Copy manually:", link);
    }
  };

  // 📸 照片上傳
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'before' | 'after') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${job.id}/${type}_${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('job-photos')
        .upload(fileName, file);
      
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('job-photos')
        .getPublicUrl(fileName);

      const fieldName = type === 'before' ? 'before_photos' : 'after_photos';
      setFormData(prev => ({ 
        ...prev, 
        [fieldName]: [...(prev[fieldName as keyof typeof prev] as string[]), publicUrl] 
      }));
    } catch (err) {
      alert("Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (type: 'before' | 'after', index: number) => {
    const fieldName = type === 'before' ? 'before_photos' : 'after_photos';
    const updatedPhotos = [...(formData[fieldName as keyof typeof formData] as string[])].filter((_, i) => i !== index);
    setFormData({ ...formData, [fieldName]: updatedPhotos });
  };

  // 👥 員工多選切換
  const toggleStaff = (staffId: string) => {
    setFormData(prev => ({
      ...prev,
      staff_ids: prev.staff_ids.includes(staffId)
        ? prev.staff_ids.filter(id => id !== staffId)
        : [...prev.staff_ids, staffId]
    }));
  };

  // ✅ 提交更新
  const handleUpdate = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setTimeError(null);
    if (!formData.scheduled_at || formData.scheduled_at.trim() === '') {
      setTimeError('Please set date and time for the job.');
      return;
    }
    const scheduledDate = new Date(formData.scheduled_at);
    const h = scheduledDate.getHours();
    const m = scheduledDate.getMinutes();
    if (h === 0 && m === 0) {
      setTimeError('Please set a time for the job (not midnight 00:00).');
      return;
    }
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

      if (recurringJobId && editScope === 'future') {
        const startTime = formData.scheduled_at
          ? new Date(formData.scheduled_at).toTimeString().slice(0, 5)
          : undefined;
        const res = await fetch(apiUrl(`/api/admin/recurring-job/${recurringJobId}`), {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            job_template_name: formData.client_name,
            address: formData.address,
            start_time: startTime,
            preferred_staff_id: formData.staff_ids.length > 0 ? formData.staff_ids[0] : null,
          }),
        });
        if (res.ok) {
          onSuccess();
          onClose();
        } else {
          const errData = await res.json();
          alert(`Error: ${errData.error}`);
        }
        setLoading(false);
        return;
      }

      const existingDetails = (typeof job.details === 'object' && job.details !== null ? job.details : raw?.details) as Record<string, unknown> | undefined;
      const details: Record<string, unknown> = { ...(existingDetails || {}) };
      if (formData.property_type) details.property_type = formData.property_type;
      if (formData.bedrooms.trim() !== '') details.bedrooms = parseInt(formData.bedrooms, 10);
      else delete details.bedrooms;
      if (formData.sq_ft.trim() !== '') details.sq_ft = parseInt(formData.sq_ft, 10);
      else delete details.sq_ft;
      const hrs = parseFloat(formData.estimated_hours);
      details.estimated_hours = !Number.isNaN(hrs) && hrs > 0 ? hrs : 2;
      if (formData.client_phone?.trim()) details.client_phone = formData.client_phone.trim();
      else delete details.client_phone;
      if (formData.client_email?.trim()) details.client_email = formData.client_email.trim();
      else delete details.client_email;

      const payload: Record<string, unknown> = {
        client_name: formData.client_name,
        address: formData.address,
        staffIds: formData.staff_ids,
        notes: formData.notes,
        before_photos: formData.before_photos,
        after_photos: formData.after_photos,
        status: formData.status,
        details,
      };
      const lat = formData.job_latitude.trim() ? parseFloat(formData.job_latitude) : undefined;
      const lng = formData.job_longitude.trim() ? parseFloat(formData.job_longitude) : undefined;
      if (lat != null && !Number.isNaN(lat)) payload.job_latitude = lat;
      if (lng != null && !Number.isNaN(lng)) payload.job_longitude = lng;
      if (formData.job_start_time) payload.job_start_time = new Date(formData.job_start_time).toISOString();
      if (formData.scheduled_at) payload.scheduled_at = new Date(formData.scheduled_at).toISOString();

      const res = await fetch(apiUrl(`/api/jobs/${job.id}`), {
        method: 'PATCH',
        headers,
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        onSuccess();
        onClose();
      } else {
        const errData = await res.json();
        alert(`Error: ${errData.error}`);
      }
    } catch (err) {
      alert('Update failed.');
    } finally {
      setLoading(false);
    }
  };

  // 🗑️ 刪除任務
  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault(); 
    e.stopPropagation();
    if (!window.confirm("Sure you want to delete this task?")) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(apiUrl(`/api/jobs/${job.id}`), {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (res.ok) { 
        onSuccess(); 
        onClose(); 
      }
    } catch (err) { 
      alert("Delete failed.");
    }
  };

  const shareToken = job.share_token || job.extendedProps?.share_token;
  const shareLinkValue = `${window.location.origin}/report/${shareToken}`;

  const filteredStaff = staffList.filter((staff: any) =>
    (staff.full_name ?? staff.name ?? '').toLowerCase().includes(staffSearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-950 w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-y-auto max-h-[90vh] border border-slate-800" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 sm:p-8 text-slate-50">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-black text-slate-50 uppercase tracking-tight">Edit Job</h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleUpdate}
                disabled={loading || !formData.scheduled_at || (() => {
                  const d = new Date(formData.scheduled_at);
                  return d.getHours() === 0 && d.getMinutes() === 0;
                })()}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500 text-slate-950 text-xs font-bold hover:bg-emerald-400 shadow-sm disabled:opacity-50"
                title={!formData.scheduled_at ? 'Set date and time first' : (() => {
                  const d = new Date(formData.scheduled_at);
                  return (d.getHours() === 0 && d.getMinutes() === 0) ? 'Set a time (not 00:00)' : undefined;
                })()}
              >
                {loading ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                Save Changes
              </button>
              <button
                type="button"
                onClick={() => {
                  window.location.href = `/admin/jobs/new?fromJob=${job.id}`;
                }}
                className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 text-slate-200 text-[11px] font-semibold hover:bg-slate-700 border border-slate-600"
              >
                Job detail
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-2 hover:bg-slate-900 rounded-full transition-colors text-slate-400 hover:text-slate-100"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="space-y-6 text-left">
            {/* 🌟 狀態快速切換區 */}
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Update Status</label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {[
                  { id: 'pending', label: 'Pending', tone: 'amber', icon: <Clock size={12}/> },
                  { id: 'in_progress', label: 'In Progress', tone: 'blue', icon: <Loader2 size={12} className="animate-spin-slow"/> },
                  { id: 'completed', label: 'Completed', tone: 'emerald', icon: <Check size={12}/> },
                  { id: 'cancelled', label: 'Cancelled', tone: 'rose', icon: <AlertCircle size={12}/> }
                ].map((s) => {
                  const isActive = formData.status === s.id;
                  const activeClass =
                    s.tone === 'amber'
                      ? 'bg-amber-500/20 border-amber-400/70 text-amber-200'
                      : s.tone === 'blue'
                      ? 'bg-blue-500/20 border-blue-400/70 text-blue-200'
                      : s.tone === 'emerald'
                      ? 'bg-emerald-500/25 border-emerald-400/80 text-emerald-200'
                      : 'bg-rose-500/20 border-rose-400/70 text-rose-200';
                  const idleClass = 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500';
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setFormData({...formData, status: s.id})}
                      className={`py-3 px-4 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 border-2 ${
                        isActive ? activeClass : idleClass
                      }`}
                    >
                      {s.icon} {s.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {recurringJobId && (
              <div className="p-3 bg-slate-900 rounded-2xl border border-slate-700">
                <p className="text-[10px] font-black uppercase text-slate-300 mb-2 tracking-widest">Part of recurring series</p>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="editScope" checked={editScope === 'this'} onChange={() => setEditScope('this')} className="text-emerald-500" />
                    <span className="text-sm font-medium text-slate-200">Edit this instance only</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="editScope" checked={editScope === 'future'} onChange={() => setEditScope('future')} className="text-emerald-500" />
                    <span className="text-sm font-medium text-slate-200">Edit all future jobs</span>
                  </label>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">All future applies to the recurring template (name, address, time, preferred staff).</p>
              </div>
            )}

            {/* Date & Time — manual edit (15-min increments) */}
            <div>
                <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Date & Start Time</label>
              <DatePicker
                selected={formData.scheduled_at ? new Date(formData.scheduled_at) : null}
                onChange={(date: Date | null) =>
                  setFormData({
                    ...formData,
                    scheduled_at: date ? date.toISOString().slice(0, 16) : '',
                  })
                }
                showTimeSelect
                timeFormat="HH:mm"
                timeIntervals={15}
                dateFormat="yyyy-MM-dd HH:mm"
                className="w-full bg-slate-900 border border-slate-700 rounded-2xl p-3 mt-1 font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-slate-50"
              />
              <p className="text-[10px] text-slate-500 mt-1 ml-2">15-minute steps (:00, :15, :30, :45). Syncs with calendar when you save.</p>
              {timeError && (
                <p className="text-xs text-amber-400 font-medium mt-2 ml-2 flex items-center gap-1">
                  <AlertCircle size={14} />
                  {timeError}
                </p>
              )}
              {formData.scheduled_at && !timeError && (() => {
                const d = new Date(formData.scheduled_at);
                const h = d.getHours();
                const m = d.getMinutes();
                const mins = h * 60 + m;
                const outsideStandard = mins < 7 * 60 || mins >= 19 * 60;
                return outsideStandard ? (
                  <p className="text-[10px] text-amber-600 mt-1 ml-2 font-medium">Note: This job is outside standard hours (07:00–19:00).</p>
                ) : null;
              })()}
            </div>

            {/* Assigned Team — 最常改，放 Date 下面 */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Assigned Team</label>
              <input
                type="text"
                value={staffSearch}
                onChange={(e) => setStaffSearch(e.target.value)}
                placeholder="Search staff by name..."
                className="w-full bg-slate-900 border border-slate-700 rounded-2xl p-3 mt-2 text-xs font-medium outline-none focus:ring-2 focus:ring-emerald-500 text-slate-50 placeholder:text-slate-500"
              />
              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-1 mt-2">
                {filteredStaff.map((staff: any) => (
                  <button
                    key={staff.id}
                    type="button"
                    onClick={() => toggleStaff(staff.id)}
                    className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all border-2 ${
                      formData.staff_ids.includes(staff.id)
                        ? 'bg-emerald-500 border-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/40'
                        : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-emerald-400'
                    }`}
                  >
                    {staff.full_name ?? staff.name}
                  </button>
                ))}
                {filteredStaff.length === 0 && (
                  <div className="text-[11px] text-slate-400 ml-2 mt-1">No staff found. Try a different search.</div>
                )}
              </div>
              <p className="text-[10px] text-slate-500 mt-1 ml-2">You can select multiple staff. Use search above to filter.</p>
            </div>

            {/* Estimated hours */}
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Estimated hours</label>
              <input
                type="number"
                min={0.5}
                step={0.5}
                value={formData.estimated_hours}
                onChange={(e) => setFormData((p) => ({ ...p, estimated_hours: e.target.value }))}
                className="w-full bg-slate-900 border border-slate-700 rounded-2xl p-4 mt-1 font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-slate-50"
                placeholder="e.g. 2"
              />
            </div>

            {/* Client name + optional phone / email */}
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Client Name</label>
                <input type="text" value={formData.client_name} onChange={e => setFormData({...formData, client_name: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-2xl p-4 mt-1 font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-slate-50" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Client phone <span className="text-slate-400 font-normal">(optional)</span></label>
                <input type="tel" value={formData.client_phone} onChange={e => setFormData({...formData, client_phone: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-2xl p-4 mt-1 font-medium outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-slate-50" placeholder="e.g. 07xxx" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Client email <span className="text-slate-400 font-normal">(optional)</span></label>
                <input type="email" value={formData.client_email} onChange={e => setFormData({...formData, client_email: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-2xl p-4 mt-1 font-medium outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-slate-50" placeholder="e.g. client@example.com" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Location</label>
                <div className="relative">
                  <MapPin size={16} className="absolute left-4 top-5 text-slate-400" />
                  <input
                    type="text"
                    value={formData.address}
                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                    onBlur={() => fetchCoordinatesFromAddress(formData.address)}
                    placeholder="Postcode or full address (used to enable staff clock-in on site)"
                    className="w-full bg-slate-900 border border-slate-700 rounded-2xl p-4 pl-12 mt-1 outline-none font-medium focus:ring-2 focus:ring-emerald-500 transition-all text-slate-50"
                  />
                </div>
                <div className="flex items-center gap-2 mt-2 ml-2">
                  <button
                    type="button"
                    onClick={handlePostcodeLookup}
                    disabled={postcodeLookupLoading}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/60 text-emerald-300 text-[11px] font-semibold hover:bg-emerald-500/20 disabled:opacity-50"
                  >
                    {postcodeLookupLoading ? <Loader2 size={12} className="animate-spin" /> : null}
                    <span>Postcode lookup</span>
                  </button>
                  <p className="text-[10px] text-slate-500">Enter postcode then use lookup, or type address manually.</p>
                </div>
                {geocodeStatus === 'looking' && <p className="text-[10px] text-slate-500 mt-1 ml-2">Finding location for clock-in…</p>}
                {geocodeStatus === 'ok' && <p className="text-[10px] text-emerald-400 mt-1 ml-2">Location saved — staff can clock in when at this address.</p>}
                {geocodeStatus === 'fail' && formData.address.trim().length >= 5 && <p className="text-[10px] text-amber-400 mt-1 ml-2">Could not find this address. Try a fuller address or postcode.</p>}
              </div>
            </div>

            <textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-2xl p-4 min-h-[100px] outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium text-slate-50" placeholder="Internal notes..." />

            {/* More — Property + Photos 收起 */}
            <div className="border border-slate-700 rounded-2xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowMoreDetails((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 bg-slate-900 hover:bg-slate-800 transition-colors text-left"
              >
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">More (Property & photos)</span>
                {showMoreDetails ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
              </button>
              {showMoreDetails && (
                <div className="p-4 space-y-6 border-t border-slate-800 bg-slate-950">
                  {/* Property details — Bedrooms (Residential) / Sq Ft (Commercial) */}
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Property</label>
                    <div className="flex gap-4 mt-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="property_type"
                          checked={formData.property_type === 'residential'}
                          onChange={() => setFormData((p) => ({ ...p, property_type: 'residential' }))}
                          className="text-emerald-500"
                        />
                        <span className="text-sm font-medium text-slate-700">Residential</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="property_type"
                          checked={formData.property_type === 'commercial'}
                          onChange={() => setFormData((p) => ({ ...p, property_type: 'commercial' }))}
                          className="text-emerald-500"
                        />
                        <span className="text-sm font-medium text-slate-700">Commercial</span>
                      </label>
                    </div>
                    {formData.property_type === 'residential' ? (
                      <div className="mt-2">
                        <label className="block text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Bedrooms</label>
                        <input
                          type="number"
                          min={0}
                          value={formData.bedrooms}
                          onChange={(e) => setFormData((p) => ({ ...p, bedrooms: e.target.value }))}
                          className="w-full bg-slate-900 border border-slate-700 rounded-2xl p-4 mt-1 font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-slate-50"
                          placeholder="e.g. 3"
                        />
                      </div>
                    ) : (
                      <div className="mt-2">
                        <label className="block text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Sq Ft</label>
                        <input
                          type="number"
                          min={0}
                          value={formData.sq_ft}
                          onChange={(e) => setFormData((p) => ({ ...p, sq_ft: e.target.value }))}
                          className="w-full bg-slate-900 border border-slate-700 rounded-2xl p-4 mt-1 font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-slate-50"
                          placeholder="e.g. 1200"
                        />
                      </div>
                    )}
                  </div>
                  {/* Photos */}
                  <div className="grid grid-cols-1 gap-6">
                    {(['before', 'after'] as const).map((type) => (
                      <div key={type} className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-emerald-400 ml-2 tracking-widest">{type} Photos</label>
                        <div className="grid grid-cols-3 gap-2">
                          {formData[type === 'before' ? 'before_photos' : 'after_photos'].map((url: string, index: number) => (
                            <div key={index} className="relative aspect-square rounded-2xl overflow-hidden border border-slate-100 shadow-sm group">
                              <img src={url} className="w-full h-full object-cover" alt={`${type}`} />
                              <button type="button" onClick={() => removePhoto(type, index)} className="absolute top-1 right-1 bg-rose-500 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"><X size={12} /></button>
                            </div>
                          ))}
                          <div className="relative aspect-square bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center hover:bg-slate-100 transition-colors">
                            {uploading ? <Loader2 className="animate-spin text-emerald-400" /> : <Camera className="text-slate-300" />}
                            <input type="file" accept="image/*" onChange={(e) => handlePhotoUpload(e, type)} className="absolute inset-0 opacity-0 cursor-pointer" disabled={uploading} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 分享連結 */}
          {formData.status === 'completed' && shareToken && (
            <div className="mt-8 p-4 bg-emerald-50 rounded-[2rem] border border-emerald-100">
              <label className="text-[10px] font-black uppercase text-emerald-600 ml-2 block mb-2 text-center tracking-widest">Share Report</label>
              <div className="flex flex-wrap gap-2">
                <input type="text" readOnly value={shareLinkValue} className="flex-1 min-w-0 bg-white border-none rounded-xl px-4 py-2 text-xs font-mono text-emerald-700 focus:outline-none" />
                <button type="button" onClick={copyShareLink} className={`p-3 rounded-xl transition-all ${copied ? 'bg-emerald-500 text-white' : 'bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95'}`}>
                  {copied ? <Check size={18} /> : <LinkIcon size={18} />}
                </button>
                <a
                  href={`mailto:?subject=${encodeURIComponent('Service Report')}&body=${encodeURIComponent(`View report: ${shareLinkValue}`)}`}
                  className="p-3 rounded-xl bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition-all inline-flex items-center gap-1.5 text-xs font-bold"
                >
                  <Mail size={18} /> Email
                </a>
              </div>
            </div>
          )}

        <div className="flex flex-col gap-3 mt-8">
          <button 
            type="button" 
            onClick={handleUpdate} 
            disabled={loading}
            className="w-full bg-emerald-500 text-slate-950 py-4 rounded-2xl font-black flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/40 hover:bg-emerald-400 transition-all active:scale-95 disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
            Save Changes
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="w-full bg-slate-950 text-rose-400 py-4 rounded-2xl font-black flex items-center justify-center gap-2 border-2 border-rose-500/40 hover:bg-rose-500/10 transition-all"
          >
            <Trash2 size={20} /> Delete Task
          </button>
        </div>
        </div>
      </div>
    </div>
  );
};