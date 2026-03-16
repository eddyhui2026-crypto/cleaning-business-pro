import { Router, Response } from 'express';
import crypto from 'crypto';
import { supabase } from '../lib/supabaseClient';
import { AuthRequest } from '../middleware/auth';
import { rateLimitAuth } from '../middleware/rateLimitAuth';
import { requireAdmin } from '../middleware/requireAdmin';
import { generateQuotePdf } from '../services/quotePdf';
import { sendQuoteEmail } from '../services/notifications';

const router = Router();

const QUOTE_STATUSES = ['draft', 'sent', 'approved'] as const;

const SERVICE_OPTIONS = [
  'House cleaning',
  'Office cleaning',
  'Deep clean',
  'End of tenancy',
  'Carpet cleaning',
  'Window cleaning',
  'Other',
];

/** Remove "Add VAT (20%): yes/no" line from notes so it is not shown in the PDF. */
function notesForPdfDisplay(notes: string): string {
  if (!notes?.trim()) return notes ?? '';
  const lines = notes.split('\n').filter((line) => {
    const t = line.trim();
    return !/^Add VAT\s*\(20%\)\s*:\s*(yes|no)\s*$/i.test(t) && !/^Add VAT\s*:\s*(yes|no)\s*$/i.test(t);
  });
  return lines.join('\n').trim() || '';
}

async function nextQuoteNumber(companyId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `QUO-${year}-`;
  const { data } = await supabase
    .from('quotes')
    .select('quote_number')
    .eq('company_id', companyId)
    .like('quote_number', `${prefix}%`)
    .order('quote_number', { ascending: false })
    .limit(1);
  const last = (data ?? [])[0] as any;
  const lastNum = last?.quote_number ? parseInt(last.quote_number.replace(prefix, ''), 10) : 0;
  return `${prefix}${String(lastNum + 1).padStart(4, '0')}`;
}

async function nextInvoiceNumber(companyId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
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

/** GET /api/admin/quotes — List quotes (filter by status, search by customer name / date). */
router.get('/', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  const { status, search, date_from, date_to, page, page_size } = req.query;
  if (!companyId) {
    res.status(403).json({ error: 'No company' });
    return;
  }
  const pageNum = Math.max(1, Number(page) || 1);
  const pageSizeRaw = Number(page_size) || 200;
  const pageSize = Math.max(1, Math.min(500, pageSizeRaw));
  const fromIndex = (pageNum - 1) * pageSize;
  const toIndex = fromIndex + pageSize - 1;

  try {
    let query = supabase
      .from('quotes')
      .select(`
        id, quote_number, customer_id, service_type, quantity, unit_price, total_price, notes,
        status, sent_at, approved_at, job_id, invoice_id, created_at,
        customer:customer_profiles(full_name, email, address, phone)
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .range(fromIndex, toIndex);

    if (status && typeof status === 'string' && QUOTE_STATUSES.includes(status as any)) {
      query = query.eq('status', status);
    }
    if (date_from) query = query.gte('created_at', String(date_from));
    if (date_to) query = query.lte('created_at', String(date_to) + 'T23:59:59.999Z');

    const { data, error } = await query;
    if (error) throw error;

    let list = data ?? [];
    if (search && typeof search === 'string') {
      const term = search.toLowerCase();
      list = list.filter((q: any) => {
        const name = (q.customer as any)?.full_name?.toLowerCase() ?? '';
        const email = (q.customer as any)?.email?.toLowerCase() ?? '';
        return name.includes(term) || email.includes(term) || (q.quote_number || '').toLowerCase().includes(term);
      });
    }
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? 'Internal server error' });
  }
});

function totalFromLineItems(lineItems: any[]): number {
  if (!Array.isArray(lineItems) || lineItems.length === 0) return 0;
  return lineItems.reduce((sum, row) => {
    const q = Math.max(0, Number(row.quantity) || 0);
    const u = Number(row.unit_price);
    const t = Number.isFinite(u) ? Math.round(q * u * 100) / 100 : (Number(row.total) || 0);
    return sum + t;
  }, 0);
}

/** POST /api/admin/quotes — Create quote (draft). Accepts line_items (array) or legacy service_type/quantity/unit_price. */
router.post('/', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  if (!companyId) {
    res.status(403).json({ error: 'No company' });
    return;
  }
  const { customer_id, service_type, quantity, unit_price, notes, line_items: bodyLineItems } = req.body;
  if (!customer_id) {
    res.status(400).json({ error: 'customer_id is required' });
    return;
  }
  const lineItems = Array.isArray(bodyLineItems) ? bodyLineItems : [];
  let total: number;
  let serviceType: string;
  let qty: number;
  let unit: number;
  if (lineItems.length > 0) {
    total = Math.round(totalFromLineItems(lineItems) * 100) / 100;
    serviceType = (lineItems[0] as any)?.name || 'Multiple services';
    qty = 1;
    unit = total;
  } else {
    qty = Math.max(0, Number(quantity) || 0);
    unit = Math.max(0, Number(unit_price) || 0);
    total = Math.round(qty * unit * 100) / 100;
    serviceType = typeof service_type === 'string' && service_type.trim() ? service_type.trim() : 'Cleaning service';
  }
  try {
    const quoteNumber = await nextQuoteNumber(companyId);
    const insertPayload: Record<string, unknown> = {
      company_id: companyId,
      customer_id: customer_id,
      quote_number: quoteNumber,
      service_type: serviceType,
      quantity: qty,
      unit_price: unit,
      total_price: total,
      notes: notes?.trim() || null,
      status: 'draft',
    };
    if (lineItems.length > 0) insertPayload.line_items = lineItems;
    const { data, error } = await supabase
      .from('quotes')
      .insert(insertPayload)
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? 'Internal server error' });
  }
});

/** GET /api/admin/quotes/:id — Get one quote. */
router.get('/:id', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  const id = req.params.id;
  if (!companyId) {
    res.status(403).json({ error: 'No company' });
    return;
  }
  try {
    const { data, error } = await supabase
      .from('quotes')
      .select(`
        *,
        customer:customer_profiles(id, full_name, email, address, phone),
        company:companies(id, name, contact_email)
      `)
      .eq('id', id)
      .eq('company_id', companyId)
      .single();
    if (error || !data) {
      res.status(404).json({ error: 'Quote not found' });
      return;
    }
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? 'Internal server error' });
  }
});

/** PATCH /api/admin/quotes/:id — Update quote (draft only). Accepts line_items or legacy service_type/quantity/unit_price. */
router.patch('/:id', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  const id = req.params.id;
  const { service_type, quantity, unit_price, notes, line_items: bodyLineItems } = req.body;
  if (!companyId) {
    res.status(403).json({ error: 'No company' });
    return;
  }
  try {
    const { data: existing } = await supabase
      .from('quotes')
      .select('status, quantity, unit_price, service_type, notes, line_items')
      .eq('id', id)
      .eq('company_id', companyId)
      .single();
    if (!existing || (existing as any).status !== 'draft') {
      res.status(400).json({ error: 'Only draft quotes can be updated' });
      return;
    }
    const r = existing as any;
    const updates: Record<string, unknown> = {};
    const lineItems = Array.isArray(bodyLineItems) ? bodyLineItems : (r.line_items ?? []);
    if (lineItems.length > 0) {
      updates.line_items = lineItems;
      updates.total_price = Math.round(totalFromLineItems(lineItems) * 100) / 100;
      updates.service_type = (lineItems[0] as any)?.name || 'Multiple services';
      updates.quantity = 1;
      updates.unit_price = updates.total_price;
    } else {
      if (service_type !== undefined) updates.service_type = String(service_type).trim();
      if (quantity !== undefined) updates.quantity = Math.max(0, Number(quantity) || 0);
      if (unit_price !== undefined) updates.unit_price = Math.max(0, Number(unit_price) || 0);
      if (notes !== undefined) updates.notes = notes?.trim() ?? null;
      const newQty = updates.quantity !== undefined ? Number(updates.quantity) : Number(r.quantity ?? 0);
      const newUnit = updates.unit_price !== undefined ? Number(updates.unit_price) : Number(r.unit_price ?? 0);
      updates.total_price = Math.round(newQty * newUnit * 100) / 100;
    }
    if (notes !== undefined) updates.notes = notes?.trim() ?? null;
    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }
    const { data, error } = await supabase
      .from('quotes')
      .update(updates)
      .eq('id', id)
      .eq('company_id', companyId)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? 'Internal server error' });
  }
});

/** GET /api/admin/quotes/:id/pdf — Generate quote PDF. */
router.get('/:id/pdf', requireAdmin, rateLimitAuth(5 * 60 * 1000, 20), async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  const id = req.params.id;
  if (!companyId) {
    res.status(403).json({ error: 'No company' });
    return;
  }
  try {
    const { data: q, error } = await supabase
      .from('quotes')
      .select(`
        *,
        customer:customer_profiles(full_name, email, address, phone),
        company:companies(name, contact_email)
      `)
      .eq('id', id)
      .eq('company_id', companyId)
      .single();
    if (error || !q) {
      res.status(404).json({ error: 'Quote not found' });
      return;
    }
    const cust = (q as any).customer;
    const comp = (q as any).company;
    const notesStr = (q as any).notes ?? '';
    const addVat = /\bAdd VAT\s*\(20%\)\s*:\s*yes/i.test(notesStr) || /\bAdd VAT\s*:\s*yes/i.test(notesStr);
    const subtotal = Number((q as any).total_price) || 0;
    let lineItems: { name: string; quantity: number; unitPrice: number; total: number }[] | undefined;
    const lineItemsRaw = (q as any).line_items;
    if (Array.isArray(lineItemsRaw) && lineItemsRaw.length > 0) {
      lineItems = lineItemsRaw.map((row: any) => ({
        name: row.name ?? 'Service',
        quantity: Math.max(0, Number(row.quantity) || 0),
        unitPrice: Number(row.unit_price) || 0,
        total: Number(row.total) ?? Math.max(0, Number(row.quantity) || 0) * (Number(row.unit_price) || 0),
      }));
      if (addVat) {
        const vatAmount = Math.round(subtotal * 0.2 * 100) / 100;
        lineItems.push({ name: 'VAT (20%)', quantity: 1, unitPrice: vatAmount, total: vatAmount });
      }
    }
    const totalPrice = addVat ? Math.round(subtotal * 1.2 * 100) / 100 : subtotal;
    const pdfData = {
      quoteNumber: (q as any).quote_number,
      companyName: comp?.name ?? 'Company',
      companyContact: comp?.contact_email ?? undefined,
      customerName: cust?.full_name ?? 'Customer',
      customerAddress: cust?.address ?? undefined,
      customerEmail: cust?.email ?? undefined,
      customerPhone: cust?.phone ?? undefined,
      lineItems,
      serviceType: (q as any).service_type ?? 'Cleaning',
      quantity: Number((q as any).quantity) || 0,
      unitPrice: Number((q as any).unit_price) || 0,
      totalPrice,
      currency: 'GBP',
      notes: notesForPdfDisplay((q as any).notes ?? '') || undefined,
      createdAt: (q as any).created_at ? new Date((q as any).created_at).toLocaleDateString('en-GB') : '',
    };
    const buffer = await generateQuotePdf(pdfData);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=quote-${(q as any).quote_number}.pdf`);
    res.send(buffer);
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? 'Internal server error' });
  }
});

/** POST /api/admin/quotes/:id/send — Send quote: generate PDF, email customer, set status to sent. */
router.post('/:id/send', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  const id = req.params.id;
  if (!companyId) {
    res.status(403).json({ error: 'No company' });
    return;
  }
  try {
    const { data: q, error } = await supabase
      .from('quotes')
      .select(`
        *,
        customer:customer_profiles(full_name, email, address, phone),
        company:companies(name, contact_email)
      `)
      .eq('id', id)
      .eq('company_id', companyId)
      .single();
    if (error || !q) {
      res.status(404).json({ error: 'Quote not found' });
      return;
    }
    if ((q as any).status !== 'draft') {
      res.status(400).json({ error: 'Only draft quotes can be sent' });
      return;
    }
    const cust = (q as any).customer;
    const comp = (q as any).company;
    const toEmail = cust?.email?.trim();
    if (!toEmail) {
      res.status(400).json({ error: 'Customer has no email; cannot send quote' });
      return;
    }
    const notesStr = (q as any).notes ?? '';
    const addVat = /\bAdd VAT\s*\(20%\)\s*:\s*yes/i.test(notesStr) || /\bAdd VAT\s*:\s*yes/i.test(notesStr);
    const subtotal = Number((q as any).total_price) || 0;
    let lineItems: { name: string; quantity: number; unitPrice: number; total: number }[] | undefined;
    const lineItemsRaw = (q as any).line_items;
    if (Array.isArray(lineItemsRaw) && lineItemsRaw.length > 0) {
      lineItems = lineItemsRaw.map((row: any) => ({
        name: row.name ?? 'Service',
        quantity: Math.max(0, Number(row.quantity) || 0),
        unitPrice: Number(row.unit_price) || 0,
        total: Number(row.total) ?? Math.max(0, Number(row.quantity) || 0) * (Number(row.unit_price) || 0),
      }));
      if (addVat) {
        const vatAmount = Math.round(subtotal * 0.2 * 100) / 100;
        lineItems.push({ name: 'VAT (20%)', quantity: 1, unitPrice: vatAmount, total: vatAmount });
      }
    }
    const totalPrice = addVat ? Math.round(subtotal * 1.2 * 100) / 100 : subtotal;
    const pdfData = {
      quoteNumber: (q as any).quote_number,
      companyName: comp?.name ?? 'Company',
      companyContact: comp?.contact_email ?? undefined,
      customerName: cust?.full_name ?? 'Customer',
      customerAddress: cust?.address ?? undefined,
      customerEmail: cust?.email ?? undefined,
      customerPhone: cust?.phone ?? undefined,
      lineItems,
      serviceType: (q as any).service_type ?? 'Cleaning',
      quantity: Number((q as any).quantity) || 0,
      unitPrice: Number((q as any).unit_price) || 0,
      totalPrice,
      currency: 'GBP',
      notes: notesForPdfDisplay((q as any).notes ?? '') || undefined,
      createdAt: (q as any).created_at ? new Date((q as any).created_at).toLocaleDateString('en-GB') : '',
    };
    const pdfBuffer = await generateQuotePdf(pdfData);
    await sendQuoteEmail(toEmail, cust?.full_name ?? 'Customer', comp?.name ?? 'Company', (q as any).quote_number, Number((q as any).total_price), pdfBuffer);
    await supabase.from('quote_emails').insert({ quote_id: id, sent_to: toEmail });
    const { data: updated, error: updateErr } = await supabase
      .from('quotes')
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

/** POST /api/admin/quotes/:id/convert-to-job — Convert approved quote to job (or create job from quote). */
router.post('/:id/convert-to-job', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  const id = req.params.id;
  const { scheduled_at } = req.body || {};
  if (!companyId) {
    res.status(403).json({ error: 'No company' });
    return;
  }
  try {
    const { data: q, error } = await supabase
      .from('quotes')
      .select(`
        *,
        customer:customer_profiles(full_name, email, address)
      `)
      .eq('id', id)
      .eq('company_id', companyId)
      .single();
    if (error || !q) {
      res.status(404).json({ error: 'Quote not found' });
      return;
    }
    const cust = (q as any).customer;
    const scheduledAt = scheduled_at ? new Date(scheduled_at).toISOString() : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: job, error: jobErr } = await supabase
      .from('jobs')
      .insert({
        company_id: companyId,
        customer_id: (q as any).customer_id,
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
    const invoiceNumber = await nextInvoiceNumber(companyId);
    const today = new Date().toISOString().slice(0, 10);
    const { data: inv } = await supabase
      .from('invoices')
      .insert({
        company_id: companyId,
        customer_id: (q as any).customer_id,
        job_id: job.id,
        invoice_number: invoiceNumber,
        status: 'draft',
        total: (q as any).total_price,
        currency: 'GBP',
        issued_at: today,
        due_at: today,
        line_items: [{ description: (q as any).service_type, quantity: (q as any).quantity, unit_price: (q as any).unit_price, amount: (q as any).total_price }],
      })
      .select()
      .single();
    await supabase
      .from('quotes')
      .update({ job_id: job.id, invoice_id: (inv as any)?.id ?? null, status: 'approved', approved_at: new Date().toISOString() })
      .eq('id', id)
      .eq('company_id', companyId);
    const { data: quoteUpdated } = await supabase.from('quotes').select('*').eq('id', id).single();
    res.json({ job, invoice: inv, quote: quoteUpdated });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? 'Internal server error' });
  }
});

export default router;
