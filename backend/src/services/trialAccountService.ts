import { supabase } from '../lib/supabaseClient';

export type TrialPlan = 'starter' | 'standard' | 'premium';

export interface CreateTrialAccountParams {
  companyName: string;
  contactName: string;
  email: string;
  phone?: string | null;
  staffCount?: number;
  trialDays?: number;
}

export interface CreateTrialAccountResult {
  userId: string;
  companyId: string;
  email: string;
  temporaryPassword: string;
  loginUrl: string;
  trialEndsAt: string;
  plan: TrialPlan;
  companyName: string;
  contactName: string;
}

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 12; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

/** Map staff count to plan (1–10 starter, 11–20 standard, 21–30 premium) */
export function planFromStaffCount(staffCount: number): TrialPlan {
  if (staffCount <= 10) return 'starter';
  if (staffCount <= 20) return 'standard';
  return 'premium';
}

function frontendBaseUrl(): string {
  return (process.env.FRONTEND_URL || 'https://cleaning-business-pro.vercel.app').replace(/\/$/, '');
}

/**
 * Creates Supabase Auth user, company (trialing), and admin profile.
 * Caller is responsible for sending welcome email with temporaryPassword.
 */
export async function createTrialAccount(params: CreateTrialAccountParams): Promise<CreateTrialAccountResult> {
  const name = (params.companyName || '').trim();
  const contact = (params.contactName || '').trim();
  const emailTrim = (params.email || '').trim().toLowerCase();

  if (!name || !contact || !emailTrim) {
    throw Object.assign(new Error('companyName, contactName, and email are required.'), { status: 400 });
  }

  const count =
    typeof params.staffCount === 'number' && Number.isFinite(params.staffCount) && params.staffCount > 0
      ? Math.min(999, Math.floor(params.staffCount))
      : 10;
  const plan = planFromStaffCount(count);
  const days = typeof params.trialDays === 'number' && params.trialDays > 0 ? params.trialDays : 14;
  const trialEndsAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  const tempPassword = generateTempPassword();

  const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
    email: emailTrim,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: contact, company_name: name },
  });

  if (authErr) {
    const err: any = Object.assign(new Error(authErr.message || 'Failed to create login account'), {
      status: 400,
      code: authErr.message?.toLowerCase().includes('already') ? 'EMAIL_TAKEN' : undefined,
    });
    throw err;
  }
  if (!authUser.user) {
    throw Object.assign(new Error('Auth returned no user'), { status: 500 });
  }

  const userId = authUser.user.id;

  const { data: company, error: companyErr } = await supabase
    .from('companies')
    .insert({
      name,
      plan,
      owner_id: userId,
      subscription_status: 'trialing',
      trial_ends_at: trialEndsAt,
      contact_email: emailTrim,
    })
    .select('id')
    .single();

  if (companyErr || !company) {
    console.error('createTrialAccount company insert error:', companyErr);
    await supabase.auth.admin.deleteUser(userId).catch(() => {});
    throw Object.assign(new Error((companyErr as any)?.message ?? 'Company creation failed'), { status: 500 });
  }

  const { error: profileErr } = await supabase.from('profiles').insert({
    id: userId,
    company_id: company.id,
    full_name: contact,
    email: emailTrim,
    phone: (params.phone || '').trim() || null,
    role: 'admin',
  });

  if (profileErr) {
    console.error('createTrialAccount profile insert error:', profileErr);
    await supabase.from('companies').delete().eq('id', company.id);
    await supabase.auth.admin.deleteUser(userId).catch(() => {});
    throw Object.assign(new Error((profileErr as any)?.message ?? 'Profile creation failed'), { status: 500 });
  }

  const loginUrl = `${frontendBaseUrl()}/login`;

  return {
    userId,
    companyId: company.id,
    email: emailTrim,
    temporaryPassword: tempPassword,
    loginUrl,
    trialEndsAt,
    plan,
    companyName: name,
    contactName: contact,
  };
}
