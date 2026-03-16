import bcrypt from 'bcrypt';
import { supabase } from '../lib/supabaseClient';

const SALT_ROUNDS = 10;
/** Default customer password (UK cleaning companies: simple for clients). */
export const CUSTOMER_DEFAULT_PASSWORD = '12345678';

/**
 * Create or get customer for a company (by phone).
 * Returns { customer, isNew, plainPassword } — plainPassword only when isNew.
 */
export interface CustomerCreateData {
  full_name: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
}

export async function ensureCustomerForCompany(
  companyId: string,
  data: CustomerCreateData
): Promise<{ customer: any; isNew: boolean; plainPassword?: string }> {
  const normalizedPhone = String(data.phone).trim().replace(/\s+/g, '');
  if (!normalizedPhone) throw new Error('Phone is required');

  const existing = await supabase
    .from('customer_profiles')
    .select('*')
    .eq('company_id', companyId)
    .eq('phone', normalizedPhone)
    .maybeSingle();

  if (existing.data) {
    return { customer: existing.data, isNew: false };
  }

  const plainPassword = CUSTOMER_DEFAULT_PASSWORD;
  const password_hash = await bcrypt.hash(plainPassword, SALT_ROUNDS);

  const insertPayload: Record<string, unknown> = {
    company_id: companyId,
    full_name: (data.full_name || 'Customer').trim(),
    phone: normalizedPhone,
    email: data.email?.trim() || null,
    password_hash,
  };
  if (data.address !== undefined) insertPayload.address = data.address?.trim() || null;
  if (data.notes !== undefined) insertPayload.notes = data.notes?.trim() || null;

  const { data: inserted, error } = await supabase
    .from('customer_profiles')
    .insert(insertPayload)
    .select()
    .single();

  if (error) throw error;
  return { customer: inserted, isNew: true, plainPassword };
}

export async function sendWelcomeEmail(
  customer: { full_name: string; email: string | null; phone: string },
  plainPassword: string,
  companyName: string,
  loginUrl: string
): Promise<void> {
  if (!customer.email?.trim()) {
    console.log(`[Welcome] No email for customer ${customer.phone}; skip sending. Add login URL to your records: ${loginUrl}`);
    return;
  }
  // MVP: log only. Later: Resend/SendGrid
  console.log(`[Welcome] Would send to ${customer.email}: Your ${companyName} customer account. Login: ${loginUrl}. Temporary password: ${plainPassword}`);
}

export function verifyCustomerPassword(passwordHash: string, plainPassword: string): Promise<boolean> {
  return bcrypt.compare(plainPassword, passwordHash);
}

/** Update customer password by id (for change-password after login). */
export async function updateCustomerPassword(customerId: string, newPlainPassword: string): Promise<void> {
  if (!newPlainPassword?.trim()) throw new Error('New password is required');
  const password_hash = await bcrypt.hash(newPlainPassword.trim(), SALT_ROUNDS);
  const { error } = await supabase
    .from('customer_profiles')
    .update({ password_hash, updated_at: new Date().toISOString() })
    .eq('id', customerId);
  if (error) throw error;
}

/** Reset customer password to default by company + phone (for forgot-password). */
export async function resetCustomerPasswordByPhone(companyId: string, phone: string): Promise<boolean> {
  const normalizedPhone = String(phone).trim().replace(/\s+/g, '');
  if (!normalizedPhone) throw new Error('Phone is required');
  const { data: customer, error: findErr } = await supabase
    .from('customer_profiles')
    .select('id')
    .eq('company_id', companyId)
    .eq('phone', normalizedPhone)
    .maybeSingle();
  if (findErr || !customer) return false;
  const password_hash = await bcrypt.hash(CUSTOMER_DEFAULT_PASSWORD, SALT_ROUNDS);
  const { error: updateErr } = await supabase
    .from('customer_profiles')
    .update({ password_hash, updated_at: new Date().toISOString() })
    .eq('id', customer.id);
  if (updateErr) throw updateErr;
  return true;
}
