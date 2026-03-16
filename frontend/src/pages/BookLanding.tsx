import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiUrl } from '../lib/api';
import { useCustomerAuth } from '../context/CustomerAuthContext';
import { Calendar, LogIn, BookOpen } from 'lucide-react';

export function BookLanding() {
  const { slug } = useParams<{ slug?: string }>();
  const navigate = useNavigate();
  const { token, customer, setCustomerFromStorage } = useCustomerAuth();
  const [company, setCompany] = useState<{ company_id: string; name: string } | null>(null);
  const [loading, setLoading] = useState(!!slug);

  useEffect(() => {
    setCustomerFromStorage();
  }, [setCustomerFromStorage]);

  useEffect(() => {
    if (slug) {
      fetch(apiUrl(`/api/booking/company-by-slug/${slug}`))
        .then((r) => r.json())
        .then((data) => {
          if (data.company_id) setCompany({ company_id: data.company_id, name: data.name });
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-500 font-medium">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-lg mx-auto px-6 py-16 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-100 text-indigo-600 mb-8">
          <Calendar size={32} />
        </div>
        <h1 className="text-3xl font-black text-slate-800 mb-2">Online Booking</h1>
        {company ? (
          <>
            <p className="text-slate-600 mb-8">Book a clean with <strong>{company.name}</strong></p>
            <div className="space-y-4">
              {token && customer ? (
                <>
                  <p className="text-slate-600 text-sm">Logged in as {customer.full_name}</p>
                  <button
                    onClick={() => navigate('/customer')}
                    className="w-full py-3 px-6 rounded-xl font-semibold bg-slate-800 text-white hover:bg-slate-700"
                  >
                    Go to Dashboard
                  </button>
                  <button
                    onClick={() => navigate('/customer/book')}
                    className="w-full py-3 px-6 rounded-xl font-semibold border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-50 flex items-center justify-center gap-2"
                  >
                    <BookOpen size={20} /> New Booking
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => navigate('/customer/login', { state: { companyId: company.company_id, companyName: company.name } })}
                    className="w-full py-3 px-6 rounded-xl font-semibold bg-indigo-600 text-white hover:bg-indigo-700 flex items-center justify-center gap-2"
                  >
                    <LogIn size={20} /> Log in to book
                  </button>
                  <p className="text-slate-500 text-sm">Use the phone number and password we sent you.</p>
                </>
              )}
            </div>
          </>
        ) : (
          <p className="text-slate-600">
            {slug ? 'Company not found. Check the booking link.' : 'Use your company booking link to get started.'}
          </p>
        )}
      </div>
    </div>
  );
}
