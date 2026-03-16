import { Router, Response } from 'express';
import { supabase } from '../lib/supabaseClient';
import { AuthRequest } from '../middleware/auth';
import { rateLimitAuth } from '../middleware/rateLimitAuth';
import { requireAdmin } from '../middleware/requireAdmin';
import { addVatToAmount } from '../constants/vat';
import { generateInvoicePdf } from '../services/invoicePdf';
import { sendInvoiceEmail } from '../services/notifications';

const router = Router();

const INVOICE_STATUSES = ['draft', 'sent', 'paid'] as const;
// Payment methods: stripe_placeholder reserved for future Stripe Connect integration
const PAYMENT_METHODS = ['cash', 'bank_transfer', 'payment_link', 'stripe_placeholder'] as const;

async function nextInvoiceNumber(companyId: string): Promise<string> {
  const year = new Date().getFullYear();
  const { data: companyRow } = await supabase
    .from('companies')
    .select('invoice_number_prefix')
    .eq('id', companyId)
    .maybeSingle();
  const prefixLabel = (companyRow as any)?.invoice_number_prefix?.trim() || 'INV';
  const prefix = `${prefixLabel}-${year}-`;
  const { data } = await supabase
    .from('invoices')
    .select('invoice_number')
    .eq('company_id', companyId)
    .like('invoice_number', `${prefix}%`)
    .order('invoice_number', { ascending: false })
    .limit(1);
  const last = (data ?? [])[0] as any;
  const lastNum = last?.invoice_number ? parseInt(last.invoice_number.replace(prefix, ''), 10) : 0;
  return `${prefix}${String(lastNum + 1).padStart(4, '0')}`;
}

/** GET /api/admin/invoices/payments — List payments for company. */
router.get('/payments', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  if (!companyId) {
    res.status(403).json({ error: 'No company' });
    return;
  }
  const { page, page_size } = req.query;
  const pageNum = Math.max(1, Number(page) || 1);
  const pageSizeRaw = Number(page_size) || 200;
  const pageSize = Math.max(1, Math.min(500, pageSizeRaw));
  const fromIndex = (pageNum - 1) * pageSize;
  const toIndex = fromIndex + pageSize - 1;

  try {
    const { data, error } = await supabase
      .from('payments')
      .select(`
        id, invoice_id, customer_id, amount, method, status, paid_at, reference, created_at,
        customer:customer_profiles(full_name)
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .range(fromIndex, toIndex);
    if (error) throw error;
    res.json(data ?? []);
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? 'Internal server error' });
  }
});

/** POST /api/admin/invoices/payments — Record a payment. */
router.post('/payments', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  if (!companyId) {
    res.status(403).json({ error: 'No company' });
    return;
  }
  const { customer_id, invoice_id, amount, method, reference } = req.body;
  if (!customer_id || amount == null || !method) {
    res.status(400).json({ error: 'customer_id, amount, and method are required' });
    return;
  }
  if (!PAYMENT_METHODS.includes(method)) {
    res.status(400).json({ error: 'method must be cash, bank_transfer, payment_link, or stripe_placeholder' });
    return;
  }
  const amt = Number(amount);
  if (isNaN(amt) || amt <= 0) {
    res.status(400).json({ error: 'amount must be a positive number' });
    return;
  }
  try {
    const { data, error } = await supabase
      .from('payments')
      .insert({
        company_id: companyId,
        customer_id: customer_id,
        invoice_id: invoice_id || null,
        amount: amt,
        method,
        status: 'completed',
        paid_at: new Date().toISOString(),
        reference: reference?.trim() || null,
      })
      .select()
      .single();
    if (error) throw error;
    if (invoice_id) {
      await supabase.from('invoices').update({ status: 'paid' }).eq('id', invoice_id).eq('company_id', companyId);
    }
    res.status(201).json(data);
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? 'Internal server error' });
  }
});

/** GET /api/admin/invoices — List invoices for company. */
router.get('/', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  if (!companyId) {
    res.status(403).json({ error: 'No company' });
    return;
  }
  const { page, page_size } = req.query;
  const pageNum = Math.max(1, Number(page) || 1);
  const pageSizeRaw = Number(page_size) || 200;
  const pageSize = Math.max(1, Math.min(500, pageSizeRaw));
  const fromIndex = (pageNum - 1) * pageSize;
  const toIndex = fromIndex + pageSize - 1;

  try {
    const { data, error } = await supabase
      .from('invoices')
      .select(`
        id, invoice_number, customer_id, booking_id, job_id, status, total, currency,
        issued_at, due_at, sent_at, created_at,
        customer:customer_profiles(full_name, email)
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .range(fromIndex, toIndex);
    if (error) throw error;
    res.json(data ?? []);
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? 'Internal server error' });
  }
});

/** POST /api/admin/invoices — Create invoice (draft). */
router.post('/', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  if (!companyId) {
    res.status(403).json({ error: 'No company' });
    return;
  }
  const { customer_id, booking_id, job_id, line_items, due_at } = req.body;
  if (!customer_id) {
    res.status(400).json({ error: 'customer_id is required' });
    return;
  }
  const items = Array.isArray(line_items) ? line_items : [];
  const subtotal = items.reduce((sum: number, i: any) => sum + (Number(i.amount) || 0), 0);
  let chargeVat = false;
  if (job_id) {
    const { data: job } = await supabase
      .from('jobs')
      .select('price_includes_vat')
      .eq('id', job_id)
      .eq('company_id', companyId)
      .maybeSingle();
    if (job && (job as any).price_includes_vat === false) chargeVat = true;
  }
  const total = chargeVat ? addVatToAmount(subtotal) : subtotal;
  try {
    const invoiceNumber = await nextInvoiceNumber(companyId);
    const issuedAt = new Date().toISOString().slice(0, 10);
    const dueAt = due_at?.slice(0, 10) || issuedAt;
    const { data, error } = await supabase
      .from('invoices')
      .insert({
        company_id: companyId,
        customer_id: customer_id,
        booking_id: booking_id || null,
        job_id: job_id || null,
        invoice_number: invoiceNumber,
        status: 'draft',
        total,
        charge_vat: chargeVat,
        currency: 'GBP',
        issued_at: issuedAt,
        due_at: dueAt,
        line_items: items,
      })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? 'Internal server error' });
  }
});

/** GET /api/admin/invoices/:id — Get one invoice. */
router.get('/:id', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  const id = req.params.id;
  if (!companyId) {
    res.status(403).json({ error: 'No company' });
    return;
  }
  try {
    const { data, error } = await supabase
      .from('invoices')
      .select(`
        *,
        customer:customer_profiles(id, full_name, email, address, phone),
        company:companies(id, name)
      `)
      .eq('id', id)
      .eq('company_id', companyId)
      .single();
    if (error || !data) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? 'Internal server error' });
  }
});

/** PATCH /api/admin/invoices/:id — Update invoice (e.g. line_items, status). */
router.patch('/:id', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  const id = req.params.id;
  const { line_items, status, due_at } = req.body;
  if (!companyId) {
    res.status(403).json({ error: 'No company' });
    return;
  }
  try {
    const updates: Record<string, unknown> = {};
    if (Array.isArray(line_items)) {
      updates.line_items = line_items;
      updates.total = line_items.reduce((sum: number, i: any) => sum + (Number(i.amount) || 0), 0);
    }
    if (status !== undefined && INVOICE_STATUSES.includes(status)) updates.status = status;
    if (due_at !== undefined) updates.due_at = due_at.slice(0, 10);
    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }
    const { data, error } = await supabase
      .from('invoices')
      .update(updates)
      .eq('id', id)
      .eq('company_id', companyId)
      .select()
      .single();
    if (error) throw error;
    if (!data) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? 'Internal server error' });
  }
});

/** DELETE /api/admin/invoices/:id — Delete invoice (only draft, for “created by mistake”). */
router.delete('/:id', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  const id = req.params.id;
  if (!companyId) {
    res.status(403).json({ error: 'No company' });
    return;
  }
  try {
    const { data: inv, error: fetchErr } = await supabase
      .from('invoices')
      .select('id, status')
      .eq('id', id)
      .eq('company_id', companyId)
      .single();
    if (fetchErr || !inv) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }
    if ((inv as any).status !== 'draft') {
      res.status(400).json({ error: 'Only draft invoices can be deleted' });
      return;
    }
    const { error: deleteErr } = await supabase
      .from('invoices')
      .delete()
      .eq('id', id)
      .eq('company_id', companyId);
    if (deleteErr) throw deleteErr;
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? 'Internal server error' });
  }
});

/** GET /api/admin/invoices/:id/pdf — Generate PDF and return as download. */
router.get('/:id/pdf', requireAdmin, rateLimitAuth(5 * 60 * 1000, 20), async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  const id = req.params.id;
  if (!companyId) {
    res.status(403).json({ error: 'No company' });
    return;
  }
  try {
    const { data: inv, error } = await supabase
      .from('invoices')
      .select(`
        *,
        customer:customer_profiles(full_name, email, address),
        company:companies(name)
      `)
      .eq('id', id)
      .eq('company_id', companyId)
      .single();
    if (error || !inv) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }
    const cust = (inv as any).customer;
    const comp = (inv as any).company;
    const pdfData = {
      invoiceNumber: (inv as any).invoice_number,
      companyName: comp?.name ?? 'Company',
      companyAddress: undefined,
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

/** POST /api/admin/invoices/:id/send — Mark as sent and send email (MVP: log). Body: { include_photos?: boolean } */
router.post('/:id/send', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  const id = req.params.id;
  if (!companyId) {
    res.status(403).json({ error: 'No company' });
    return;
  }
  try {
    const includePhotos = Boolean(req.body?.include_photos);
    const { data: inv, error } = await supabase
      .from('invoices')
      .select('*, customer:customer_profiles(full_name, email)')
      .eq('id', id)
      .eq('company_id', companyId)
      .single();
    if (error || !inv) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }
    const cust = (inv as any).customer;
    const toEmail = cust?.email;
    if (!toEmail?.trim()) {
      res.status(400).json({ error: 'Customer has no email; cannot send invoice' });
      return;
    }
    // Optional: fetch after_photos from linked job when requested
    let photoUrls: string[] | undefined;
    if (includePhotos && (inv as any).job_id) {
      const { data: job } = await supabase
        .from('jobs')
        .select('after_photos')
        .eq('id', (inv as any).job_id)
        .eq('company_id', companyId)
        .maybeSingle();
      if (job && Array.isArray((job as any).after_photos)) {
        photoUrls = (job as any).after_photos.filter((u: any) => typeof u === 'string' && u.trim());
      }
    }
    const pdfBuffer = await generateInvoicePdf({
      invoiceNumber: (inv as any).invoice_number,
      companyName: '',
      customerName: cust?.full_name ?? 'Customer',
      issuedAt: (inv as any).issued_at ?? '',
      dueAt: (inv as any).due_at ?? '',
      lineItems: Array.isArray((inv as any).line_items) ? (inv as any).line_items : [],
      total: Number((inv as any).total) || 0,
      currency: (inv as any).currency ?? 'GBP',
      status: 'sent',
      chargeVat: Boolean((inv as any).charge_vat),
    });
    await sendInvoiceEmail(
      toEmail,
      cust?.full_name ?? 'Customer',
      (inv as any).invoice_number,
      Number((inv as any).total),
      (inv as any).currency ?? 'GBP',
      pdfBuffer,
      includePhotos ? { includePhotos: true, photoUrls } : undefined,
    );
    const { data: updated, error: updateErr } = await supabase
      .from('invoices')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', id)
      .eq('company_id', companyId)
      .select()
      .single();
    if (updateErr) throw updateErr;
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? 'Internal server error' });
  }
});

export default router;
