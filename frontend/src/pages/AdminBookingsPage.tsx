import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { apiUrl } from '../lib/api';
import { formatDateUK } from '../lib/dateFormat';
import { Loader2, Calendar, User, MapPin, CheckCircle } from 'lucide-react';
import { AdminBottomNav } from '../components/AdminBottomNav';
import { PageHeader } from '../components/PageHeader';

interface AdminBookingsPageProps {
  companyId: string | null;
}

interface BookingRow {
  id: string;
  preferred_date: string;
  service_type: string;
  address?: string | null;
  notes?: string | null;
  status: string;
  payment_status: string;
  created_at: string;
  job_id?: string | null;
  customer?: { id: string; full_name: string; phone?: string } | null;
}

const SERVICE_LABELS: Record<string, string> = {
  standard_clean: 'Standard clean',
  deep_clean: 'Deep clean',
  end_of_tenancy: 'End of tenancy',
  carpet_clean: 'Carpet clean',
  other: 'Other',
};

export function AdminBookingsPage({ companyId }: AdminBookingsPageProps) {
  const navigate = useNavigate();
  const [list, setList] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [quoteModal, setQuoteModal] = useState<{ bookingId: string } | null>(null);
  const [quoteSubmitting, setQuoteSubmitting] = useState(false);
  const [quoteForm, setQuoteForm] = useState({ total_price: '', notes: '' });
  const [error, setError] = useState<string | null>(null);

  const fetchList = async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
      const res = await fetch(apiUrl('/api/admin/bookings'), { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setList(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load bookings');
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  const handleConvertToJob = async (bookingId: string) => {
    setConvertingId(bookingId);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(apiUrl(`/api/admin/bookings/${bookingId}/convert-to-job`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any).error || 'Convert failed');
      await fetchList();
    } catch (e: any) {
      setError(e?.message || 'Convert failed');
    } finally {
      setConvertingId(null);
    }
  };

  const handleSendQuote = async (e: React.FormEvent) => {
    if (!quoteModal) return;
    e.preventDefault();
    const total = parseFloat(quoteForm.total_price);
    if (Number.isNaN(total) || total < 0) {
      setError('Enter a valid amount');
      return;
    }
    setQuoteSubmitting(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(apiUrl(`/api/admin/bookings/${quoteModal.bookingId}/quote`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ total_price: total, notes: quoteForm.notes || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any).error || 'Failed to send quote');
      setQuoteModal(null);
      setQuoteForm({ total_price: '', notes: '' });
      await fetchList();
    } catch (e: any) {
      setError(e?.message || 'Failed');
    } finally {
      setQuoteSubmitting(false);
    }
  };

  const pendingCount = list.filter((b) => b.status === 'pending').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 pb-20 lg:pb-8">
      <PageHeader
        title="Online bookings"
        subtitle="Coming soon"
        backTo="/dashboard"
        backLabel="Back to Dashboard"
        variant="dark"
      />
      <div className="p-4 md:p-8 max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[50vh]">
        <div className="bg-slate-900/80 rounded-2xl border border-slate-700 p-12 text-center max-w-md">
          <Calendar className="w-14 h-14 mx-auto mb-4 text-slate-500 opacity-70" />
          <h2 className="text-xl font-black text-slate-200 mb-2">Coming soon</h2>
          <p className="text-slate-400 text-sm">Online booking is not available yet. You can still add jobs from the Dashboard or Schedule.</p>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="mt-6 px-5 py-2.5 rounded-xl bg-slate-700 text-slate-200 font-bold text-sm hover:bg-slate-600"
          >
            Back to Dashboard
          </button>
        </div>
      </div>

      <AdminBottomNav />
    </div>
  );
}
