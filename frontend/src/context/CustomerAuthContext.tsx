import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { apiUrl } from '../lib/api';

const CUSTOMER_TOKEN_KEY = 'customer_token';
const CUSTOMER_DATA_KEY = 'customer_data';

interface CustomerData {
  id: string;
  company_id: string;
  full_name: string;
  phone: string;
  email?: string | null;
}

interface CustomerAuthContextType {
  token: string | null;
  customer: CustomerData | null;
  companyId: string | null;
  login: (companyId: string, phone: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  setCustomerFromStorage: () => void;
}

const CustomerAuthContext = createContext<CustomerAuthContextType | null>(null);

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(CUSTOMER_TOKEN_KEY));
  const [customer, setCustomer] = useState<CustomerData | null>(() => {
    try {
      const raw = localStorage.getItem(CUSTOMER_DATA_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const setCustomerFromStorage = useCallback(() => {
    const t = localStorage.getItem(CUSTOMER_TOKEN_KEY);
    setToken(t);
    try {
      const raw = localStorage.getItem(CUSTOMER_DATA_KEY);
      setCustomer(raw ? JSON.parse(raw) : null);
    } catch {
      setCustomer(null);
    }
  }, []);

  useEffect(() => {
    if (token) localStorage.setItem(CUSTOMER_TOKEN_KEY, token);
    else localStorage.removeItem(CUSTOMER_TOKEN_KEY);
  }, [token]);
  useEffect(() => {
    if (customer) localStorage.setItem(CUSTOMER_DATA_KEY, JSON.stringify(customer));
    else localStorage.removeItem(CUSTOMER_DATA_KEY);
  }, [customer]);

  const login = useCallback(async (companyId: string, phone: string, password: string) => {
    try {
      const body = { company_id: companyId.trim(), phone: phone.trim(), password };
      const res = await fetch(apiUrl('/api/customer/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: data.error || 'Login failed' };
      }
      setToken(data.token);
      setCustomer(data.customer ?? null);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Network error' };
    }
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setCustomer(null);
  }, []);

  const companyId = customer?.company_id ?? null;

  return (
    <CustomerAuthContext.Provider
      value={{ token, customer, companyId, login, logout, setCustomerFromStorage }}
    >
      {children}
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth() {
  const ctx = useContext(CustomerAuthContext);
  if (!ctx) throw new Error('useCustomerAuth must be used within CustomerAuthProvider');
  return ctx;
}

export function customerAuthHeaders(token: string | null): HeadersInit {
  const h: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}
