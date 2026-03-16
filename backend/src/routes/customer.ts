import { Router, Response } from 'express';
import crypto from 'crypto';
import { supabase } from '../lib/supabaseClient';
import { verifyToken, resolveCompany } from '../middleware/auth';
import { requireAdmin } from '../middleware/requireAdmin';
import { AuthRequest } from '../middleware/auth';
import { rateLimitAuth } from '../middleware/rateLimitAuth';
import { CustomerAuthRequest, verifyCustomerToken, signCustomerToken } from '../middleware/customerAuth';
import { ensureCustomerForCompany, sendWelcomeEmail, verifyCustomerPassword, updateCustomerPassword } from '../services/customerService';
import { notifyCompanyNewBooking } from '../services/notifications';
import { saveSubscription } from '../services/pushNotificationService';

const router = Router();

const SERVICE_TYPES = [
  'regular_domestic_clean', 'end_of_tenancy', 'deep_clean', 'oven_degreasing', 'steam_carpet',
  'internal_windows', 'limescale_treatment', 'standard_clean', 'carpet_clean', 'other',
] as const;

/** POST /api/customer/login — phone + password (with company_id or company slug) */
router.post('/login', rateLimitAuth(15 * 60 * 1000, 10), async (req: CustomerAuthRequest, res: Response): Promise<void> => {
  const { company_id, company_slug, phone, password } = req.body;
  let companyId = company_id;

  if (!phone?.trim() || !password) {
    res.status(400).json({ error: 'Phone and password are required' });
    return;
  }

  try {
    if (!companyId && company_slug) {
      const { data: company } = await supabase
        .from('companies')
        .select('id')
        .eq('booking_slug', String(company_slug).trim())
        .maybeSingle();
      companyId = company?.id;
    }
    if (!companyId) {
      res.status(400).json({ error: 'Company (company_id or company_slug) is required' });
      return;
    }

    const normalizedPhone = String(phone).trim().replace(/\s+/g, '');
    const { data: customer, error } = await supabase
      .from('customer_profiles')
      .select('id, company_id, full_name, phone, email')
      .eq('company_id', companyId)
      .eq('phone', normalizedPhone)
      .maybeSingle();

    if (error || !customer) {
      res.status(401).json({ error: 'Invalid phone number or company' });
      return;
    }

    const { data: full } = await supabase
      .from('customer_profiles')
      .select('password_hash')
      .eq('id', customer.id)
      .single();

    const valid = await verifyCustomerPassword((full as any)?.password_hash ?? '', password);
    if (!valid) {
      res.status(401).json({ error: 'Invalid password' });
      return;
    }

    const token = signCustomerToken({ customerId: customer.id, companyId: customer.company_id });
    res.json({
      token,
      customer: { id: customer.id, company_id: customer.company_id, full_name: customer.full_name, phone: customer.phone, email: customer.email },
    });
  } catch (err: any) {
    console.error('Customer login:', err);
    res.status(500).json({ error: err?.message ?? 'Login failed' });
  }
});

/** GET /api/customer/companies-by-phone?phone=... — list companies this phone has used (no auth). */
router.get('/companies-by-phone', async (req: CustomerAuthRequest, res: Response): Promise<void> => {
  const phone = String(req.query.phone ?? '').trim();
  if (!phone) {
    res.status(400).json({ error: 'Phone is required' });
    return;
  }
  const normalizedPhone = phone.replace(/\s+/g, '');
  try {
    const { data: profiles, error: profErr } = await supabase
      .from('customer_profiles')
      .select('company_id')
      .eq('phone', normalizedPhone);
    if (profErr) throw profErr;
    const companyIds = Array.from(
      new Set((profiles ?? []).map((p: any) => p.company_id).filter((id: string | null) => !!id))
    );
    if (!companyIds.length) {
      res.json([]);
      return;
    }
    const { data: companies, error: compErr } = await supabase
      .from('companies')
      .select('id, name')
      .in('id', companyIds);
    if (compErr) throw compErr;
    const result = (companies ?? []).map((c: any) => ({
      company_id: c.id,
      company_name: c.name ?? 'Cleaning company',
    }));
    res.json(result);
  } catch (err: any) {
    console.error('companies-by-phone:', err);
    res.status(500).json({ error: err?.message ?? 'Lookup failed' });
  }
});

/** POST /api/customer/forgot-password — request a reset code by phone (no auth). Body: phone, company_id or company_slug. */
router.post('/forgot-password', rateLimitAuth(15 * 60 * 1000, 5), async (req: CustomerAuthRequest, res: Response): Promise<void> => {
  const { phone, company_id, company_slug } = req.body;
  let companyId = company_id;
  if (!phone?.trim()) {
    res.status(400).json({ error: 'Phone is required' });
    return;
  }
  try {
    if (!companyId && company_slug) {
      const { data: company } = await supabase
        .from('companies')
        .select('id')
        .eq('booking_slug', String(company_slug).trim())
        .maybeSingle();
      companyId = company?.id;
    }
    if (!companyId) {
      res.status(400).json({ error: 'Company (company_id or company_slug) is required' });
      return;
    }
    const normalizedPhone = String(phone).trim().replace(/\s+/g, '');
    const { data: customer, error: findErr } = await supabase
      .from('customer_profiles')
      .select('id')
      .eq('company_id', companyId)
      .eq('phone', normalizedPhone)
      .maybeSingle();
    if (findErr) throw findErr;

    if (customer) {
      // Generate a 6-digit numeric reset code and store it with a short expiry (e.g. 30 minutes)
      const token = crypto.randomInt(100000, 999999).toString();
      const expires = new Date();
      expires.setMinutes(expires.getMinutes() + 30);

      const { error: updateErr } = await supabase
        .from('customer_profiles')
        .update({ reset_token: token, reset_token_expires_at: expires.toISOString() })
        .eq('id', customer.id);
      if (updateErr) throw updateErr;

      // For now we don't have SMS/email wired up; log token for support/admins in a controlled environment.
      console.log(
        `[Customer reset] Generated reset code ${token} for phone ${normalizedPhone} (company ${companyId}). ` +
        `In production this should be sent via SMS or email, not logged.`
      );
    }

    res.json({
      message:
        'If this phone number is registered with this cleaning company, a reset code has been generated. ' +
        'Please contact the cleaning company to receive your code.',
    });
  } catch (err: any) {
    console.error('Forgot password:', err);
    res.status(500).json({ error: err?.message ?? 'Reset failed' });
  }
});

/** POST /api/customer/reset-password-confirm — confirm reset with code. Body: phone, company_id or company_slug, token, new_password. */
router.post('/reset-password-confirm', rateLimitAuth(15 * 60 * 1000, 5), async (req: CustomerAuthRequest, res: Response): Promise<void> => {
  const { phone, company_id, company_slug, token, new_password } = req.body;
  let companyId = company_id;

  if (!phone?.trim() || !token?.trim() || !new_password?.trim()) {
    res.status(400).json({ error: 'Phone, reset code and new password are required' });
    return;
  }
  if (String(new_password).length < 6) {
    res.status(400).json({ error: 'New password must be at least 6 characters long' });
    return;
  }

  try {
    if (!companyId && company_slug) {
      const { data: company } = await supabase
        .from('companies')
        .select('id')
        .eq('booking_slug', String(company_slug).trim())
        .maybeSingle();
      companyId = company?.id;
    }
    if (!companyId) {
      res.status(400).json({ error: 'Company (company_id or company_slug) is required' });
      return;
    }

    const normalizedPhone = String(phone).trim().replace(/\s+/g, '');
    const code = String(token).trim();

    const { data: customer, error: findErr } = await supabase
      .from('customer_profiles')
      .select('id, reset_token, reset_token_expires_at')
      .eq('company_id', companyId)
      .eq('phone', normalizedPhone)
      .maybeSingle();
    if (findErr) throw findErr;

    if (!customer || !customer.reset_token || !customer.reset_token_expires_at) {
      res.status(400).json({ error: 'Invalid reset code or phone/company combination' });
      return;
    }

    const now = new Date();
    const expiresAt = new Date(customer.reset_token_expires_at as string);
    if (customer.reset_token !== code || expiresAt < now) {
      res.status(400).json({ error: 'Invalid or expired reset code' });
      return;
    }

    // Update password and clear reset token fields
    await updateCustomerPassword(customer.id as string, String(new_password));
    const { error: clearErr } = await supabase
      .from('customer_profiles')
      .update({ reset_token: null, reset_token_expires_at: null })
      .eq('id', customer.id);
    if (clearErr) throw clearErr;

    res.json({ message: 'Password has been reset. You can now log in with your new password.' });
  } catch (err: any) {
    console.error('Reset password confirm:', err);
    res.status(500).json({ error: err?.message ?? 'Reset failed' });
  }
});

/** PATCH /api/customer/me/password — change password (requires customer token). Body: current_password, new_password. */
router.patch('/me/password', verifyCustomerToken, async (req: CustomerAuthRequest, res: Response): Promise<void> => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password?.trim()) {
    res.status(400).json({ error: 'Current password and new password are required' });
    return;
  }
  try {
    const { data: row, error } = await supabase
      .from('customer_profiles')
      .select('password_hash')
      .eq('id', req.customerId)
      .single();
    if (error || !row) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }
    const valid = await verifyCustomerPassword((row as any).password_hash ?? '', current_password);
    if (!valid) {
      res.status(401).json({ error: 'Current password is incorrect' });
      return;
    }
    if (!req.customerId) {
      res.status(400).json({ error: 'Customer ID missing from token' });
      return;
    }
    await updateCustomerPassword(String(req.customerId), new_password.trim());
    res.json({ message: 'Password updated. Please use your new password next time you log in.' });
  } catch (err: any) {
    console.error('Change password:', err);
    res.status(500).json({ error: err?.message ?? 'Update failed' });
  }
});

/** GET /api/customer/me — current customer (requires customer token) */
router.get('/me', verifyCustomerToken, async (req: CustomerAuthRequest, res: Response): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('customer_profiles')
      .select('id, company_id, full_name, phone, email')
      .eq('id', req.customerId)
      .single();
    if (error || !data) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

/** GET /api/customer/jobs — jobs linked to this customer (for dashboard) */
router.get('/jobs', verifyCustomerToken, async (req: CustomerAuthRequest, res: Response): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('jobs')
      .select(`
        id, client_name, address, scheduled_at, status, price, notes,
        before_photos, after_photos, share_token, updated_at
      `)
      .eq('customer_id', req.customerId)
      .eq('company_id', req.customerCompanyId)
      .order('scheduled_at', { ascending: false });
    if (error) throw error;
    res.json(data ?? []);
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

/** GET /api/customer/bookings — list bookings for this customer */
router.get('/bookings', verifyCustomerToken, async (req: CustomerAuthRequest, res: Response): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        id, preferred_date, service_type, address, notes, status, payment_status, created_at,
        job_id
      `)
      .eq('customer_id', req.customerId)
      .eq('company_id', req.customerCompanyId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data ?? []);
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

/** POST /api/customer/bookings — create booking (dummy payment; no charge) */
router.post('/bookings', verifyCustomerToken, async (req: CustomerAuthRequest, res: Response): Promise<void> => {
  const { preferred_date, service_type, preferred_staff_id, address, notes, details } = req.body;
  if (!preferred_date) {
    res.status(400).json({ error: 'preferred_date is required' });
    return;
  }
  const serviceType = typeof service_type === 'string' && service_type.trim() ? service_type.trim() : 'other';
  const detailsObj = details && typeof details === 'object' ? details : {};

  try {
    const { data: booking, error } = await supabase
      .from('bookings')
      .insert({
        company_id: req.customerCompanyId,
        customer_id: req.customerId,
        preferred_date: preferred_date,
        service_type: serviceType,
        preferred_staff_id: preferred_staff_id || null,
        address: address || null,
        notes: notes || null,
        details: detailsObj,
        status: 'pending',
        payment_status: 'unpaid',
      })
      .select()
      .single();
    if (error) throw error;

    notifyCompanyNewBooking(req.customerCompanyId!, booking.id).catch(() => {});

    res.status(201).json(booking);
  } catch (err: any) {
    console.error('Create booking:', err);
    res.status(500).json({ error: err?.message ?? 'Failed to create booking' });
  }
});

/** GET /api/customer/quotes — List quotes sent to this customer (status sent or approved). */
router.get('/quotes', verifyCustomerToken, async (req: CustomerAuthRequest, res: Response): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('quotes')
      .select('id, quote_number, service_type, quantity, unit_price, total_price, notes, status, sent_at, approved_at, booking_id, created_at')
      .eq('customer_id', req.customerId)
      .eq('company_id', req.customerCompanyId)
      .in('status', ['sent', 'approved'])
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data ?? []);
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? 'Internal server error' });
  }
});

/** POST /api/customer/push-subscription — Save Web Push subscription for customer notifications. */
router.post('/push-subscription', verifyCustomerToken, async (req: CustomerAuthRequest, res: Response): Promise<void> => {
  if (!req.customerCompanyId) {
    res.status(403).json({ error: 'No company' });
    return;
  }
  const subscription = req.body?.subscription;
  if (!subscription || !subscription.endpoint) {
    res.status(400).json({ error: 'Subscription object with endpoint required' });
    return;
  }
  try {
    await saveSubscription(req.customerCompanyId, subscription, req.customerId);
    res.status(204).end();
  } catch (err: any) {
    console.error('Save customer push subscription:', err);
    res.status(500).json({ error: err?.message ?? 'Internal server error' });
  }
});

/** POST /api/customer/quotes/:id/approve — Approve quote: create job + invoice, update quote to approved; if quote has booking_id, set booking to confirmed and link job, notify company. */
router.post('/quotes/:id/approve', verifyCustomerToken, async (req: CustomerAuthRequest, res: Response): Promise<void> => {
  const quoteId = req.params.id;
  const { scheduled_at } = req.body || {};
  try {
    const { data: q, error: qErr } = await supabase
      .from('quotes')
      .select('*, customer:customer_profiles(full_name, address), booking_id')
      .eq('id', quoteId)
      .eq('customer_id', req.customerId)
      .eq('company_id', req.customerCompanyId)
      .single();
    if (qErr || !q) {
      res.status(404).json({ error: 'Quote not found' });
      return;
    }
    if ((q as any).status !== 'sent') {
      res.status(400).json({ error: 'Only sent quotes can be approved' });
      return;
    }
    const cust = (q as any).customer;
    const scheduledAt = scheduled_at ? new Date(scheduled_at).toISOString() : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: job, error: jobErr } = await supabase
      .from('jobs')
      .insert({
        company_id: req.customerCompanyId,
        customer_id: req.customerId,
        client_name: cust?.full_name ?? 'Customer',
        address: cust?.address ?? null,
        scheduled_at: scheduledAt,
        status: 'pending',
        price: String((q as any).total_price),
        notes: (q as any).notes ?? '',
        share_token: crypto.randomUUID(),
      })
      .select()
      .single();
    if (jobErr) throw jobErr;
    const year = new Date().getFullYear();
    const invPrefix = `INV-${year}-`;
    const { data: lastInvList } = await supabase
      .from('invoices')
      .select('invoice_number')
      .eq('company_id', req.customerCompanyId)
      .like('invoice_number', `${invPrefix}%`)
      .order('invoice_number', { ascending: false })
      .limit(1);
    const lastNum = (lastInvList ?? [])[0] as any;
    const nextNum = lastNum?.invoice_number ? parseInt(String(lastNum.invoice_number).replace(invPrefix, ''), 10) + 1 : 1;
    const invoiceNumber = `${invPrefix}${String(nextNum).padStart(4, '0')}`;
    const today = new Date().toISOString().slice(0, 10);
    const lineItems = [{ description: (q as any).service_type, quantity: (q as any).quantity, unit_price: (q as any).unit_price, amount: (q as any).total_price }];
    const { data: inv, error: invErr } = await supabase
      .from('invoices')
      .insert({
        company_id: req.customerCompanyId,
        customer_id: req.customerId,
        job_id: job.id,
        invoice_number: invoiceNumber,
        status: 'draft',
        total: (q as any).total_price,
        currency: 'GBP',
        issued_at: today,
        due_at: today,
        line_items: lineItems,
      })
      .select()
      .single();
    if (invErr) throw invErr;
    await supabase
      .from('quotes')
      .update({
        job_id: job.id,
        invoice_id: (inv as any)?.id ?? null,
        status: 'approved',
        approved_at: new Date().toISOString(),
      })
      .eq('id', quoteId)
      .eq('customer_id', req.customerId)
      .eq('company_id', req.customerCompanyId);

    const bookingId = (q as any).booking_id;
    if (bookingId) {
      await supabase
        .from('bookings')
        .update({ status: 'confirmed', job_id: job.id })
        .eq('id', bookingId)
        .eq('company_id', req.customerCompanyId);
      const { notifyCompany } = await import('../services/pushNotificationService');
      await notifyCompany(req.customerCompanyId!, {
        title: 'Booking confirmed',
        body: 'A client has accepted the quote and confirmed the booking.',
        url: '/admin/bookings',
        tag: `booking-confirmed-${bookingId}`,
      });
    }

    const { data: quoteUpdated } = await supabase.from('quotes').select('*').eq('id', quoteId).single();
    res.json({ quote: quoteUpdated, job, invoice: inv });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? 'Internal server error' });
  }
});

/** GET /api/customer/invoices — List invoices for logged-in customer. */
router.get('/invoices', verifyCustomerToken, async (req: CustomerAuthRequest, res: Response): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('invoices')
      .select('id, invoice_number, status, total, currency, issued_at, due_at, sent_at, created_at')
      .eq('customer_id', req.customerId)
      .eq('company_id', req.customerCompanyId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data ?? []);
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

/** GET /api/customer/invoices/:id/pdf — Download invoice PDF (customer must own invoice). */
router.get('/invoices/:id/pdf', verifyCustomerToken, rateLimitAuth(5 * 60 * 1000, 20), async (req: CustomerAuthRequest, res: Response): Promise<void> => {
  const id = req.params.id;
  try {
    const { data: inv, error } = await supabase
      .from('invoices')
      .select('*, customer:customer_profiles(full_name, email, address), company:companies(name)')
      .eq('id', id)
      .eq('customer_id', req.customerId)
      .eq('company_id', req.customerCompanyId)
      .single();
    if (error || !inv) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }
    const { generateInvoicePdf } = await import('../services/invoicePdf');
    const cust = (inv as any).customer;
    const comp = (inv as any).company;
    const pdfData = {
      invoiceNumber: (inv as any).invoice_number,
      companyName: comp?.name ?? 'Company',
      customerName: cust?.full_name ?? 'Customer',
      customerAddress: cust?.address ?? undefined,
      customerEmail: cust?.email ?? undefined,
      issuedAt: (inv as any).issued_at ?? '',
      dueAt: (inv as any).due_at ?? '',
      lineItems: Array.isArray((inv as any).line_items) ? (inv as any).line_items : [],
      total: Number((inv as any).total) || 0,
      currency: (inv as any).currency ?? 'GBP',
      status: (inv as any).status ?? 'draft',
      chargeVat: Boolean((inv as any).charge_vat),
    };
    const buffer = await generateInvoicePdf(pdfData);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${(inv as any).invoice_number}.pdf`);
    res.send(buffer);
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? 'Internal server error' });
  }
});

/** GET /api/customer/payment-instruction — dummy payment instruction for this customer */
router.get('/payment-instruction', verifyCustomerToken, async (req: CustomerAuthRequest, res: Response): Promise<void> => {
  try {
    const { data: settings, error } = await supabase
      .from('customer_payment_settings')
      .select('payment_method, payment_link_url, instructions')
      .eq('company_id', req.customerCompanyId)
      .eq('customer_id', req.customerId)
      .maybeSingle();
    if (error) throw error;

    const method = settings?.payment_method ?? 'self_collect';
    const link = settings?.payment_link_url ?? null;
    const customInstructions = settings?.instructions ?? null;

    // Dummy instructions for MVP
    const dummyInstructions: Record<string, string> = {
      self_collect: customInstructions || 'Please pay by cash or bank transfer on the day of the clean. Our team will provide details.',
      payment_link: customInstructions || (link ? `Pay online: ${link}` : 'A payment link will be sent to you before the appointment.'),
      stripe_connect: customInstructions || 'Payment will be taken automatically (Stripe). [Not yet active – dummy]',
    };
    res.json({
      payment_method: method,
      payment_link_url: link,
      instruction: dummyInstructions[method] || dummyInstructions.self_collect,
      is_dummy: true,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

/** POST /api/customer/register — admin only: register customer; returns customer + temp password. */
router.post('/register', verifyToken, resolveCompany, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  if (!companyId) {
    res.status(403).json({ error: 'No company' });
    return;
  }
  const { full_name, phone, email } = req.body;
  if (!phone?.trim()) {
    res.status(400).json({ error: 'phone is required' });
    return;
  }
  try {
    const result = await ensureCustomerForCompany(companyId, {
      full_name: full_name || 'Customer',
      phone,
      email: email || null,
    });
    const company = await supabase.from('companies').select('name').eq('id', companyId).single();
    const companyName = (company.data as any)?.name ?? 'Your cleaning company';
    const loginUrl = process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/customer/login` : '/customer/login';
    if (result.isNew && result.plainPassword) {
      await sendWelcomeEmail(
        result.customer,
        result.plainPassword,
        companyName,
        loginUrl
      );
      await supabase
        .from('customer_profiles')
        .update({ welcome_email_sent_at: new Date().toISOString() })
        .eq('id', result.customer.id);
    }
    res.status(201).json({
      customer: {
        id: result.customer.id,
        company_id: result.customer.company_id,
        full_name: result.customer.full_name,
        phone: result.customer.phone,
        email: result.customer.email,
      },
      is_new: result.isNew,
      temporary_password: result.isNew ? result.plainPassword : undefined,
    });
  } catch (err: any) {
    console.error('Customer register:', err);
    res.status(500).json({ error: err?.message ?? 'Registration failed' });
  }
});

export default router;
