/**
 * Notifications: modular service for booking and job events.
 * MVP: logs to console. Later: wire to Resend/SendGrid or in-app push.
 */

import { supabase } from '../lib/supabaseClient';
import { notifyCompany } from './pushNotificationService';

export async function notifyCompanyNewBooking(companyId: string, bookingId: string): Promise<void> {
  try {
    const { data: booking } = await supabase
      .from('bookings')
      .select('id, preferred_date, service_type, created_at, customer:customer_profiles(full_name, phone)')
      .eq('id', bookingId)
      .single();
    const { data: company } = await supabase
      .from('companies')
      .select('name, contact_email')
      .eq('id', companyId)
      .single();
    const customerName = (booking as any)?.customer?.full_name ?? 'A customer';
    const date = (booking as any)?.preferred_date ?? '';
    const service = (booking as any)?.service_type ?? 'cleaning';
    console.log(`[Notification] New booking for ${(company as any)?.name ?? companyId}: ${customerName} on ${date} (${service}). Booking ID: ${bookingId}`);
    await supabase.from('booking_notifications').insert({ company_id: companyId, booking_id: bookingId });
    await notifyCompany(companyId, {
      title: 'New booking request',
      body: `${customerName} – ${date} (${service})`,
      url: '/admin/bookings',
      tag: `booking-${bookingId}`,
    });
  } catch (e) {
    console.error('notifyCompanyNewBooking:', e);
  }
}

export async function notifyCustomerJobCompleted(customerId: string, jobId: string): Promise<void> {
  try {
    const { data: job } = await supabase.from('jobs').select('id, client_name, completed_at').eq('id', jobId).single();
    const { data: customer } = await supabase
      .from('customer_profiles')
      .select('email, full_name')
      .eq('id', customerId)
      .single();
    console.log(`[Notification] Job completed for customer ${(customer as any)?.full_name ?? customerId}. Job ID: ${jobId}`);
    // TODO: send email to customer.email when configured
  } catch (e) {
    console.error('notifyCustomerJobCompleted:', e);
  }
}

/** Send quote email (MVP: log; later: attach PDF and send via Resend/SendGrid). */
export async function sendQuoteEmail(
  toEmail: string,
  customerName: string,
  companyName: string,
  quoteNumber: string,
  total: number,
  _pdfBuffer?: Buffer
): Promise<void> {
  console.log(`[Quote Email] Would send to ${toEmail}: Subject "Your Cleaning Quote from ${companyName}". Quote #${quoteNumber} for ${customerName}, £${total.toFixed(2)}. PDF attachment placeholder.`);
  // TODO: integrate Resend/SendGrid; attach _pdfBuffer; subject: "Your Cleaning Quote from [Company Name]"
}

export interface InvoiceEmailOptions {
  includePhotos?: boolean;
  photoUrls?: string[];
}

/** Send invoice email (MVP: log; later: attach PDF and send via Resend/SendGrid). */
export async function sendInvoiceEmail(
  toEmail: string,
  customerName: string,
  invoiceNumber: string,
  total: number,
  currency: string,
  _pdfBuffer?: Buffer,
  options?: InvoiceEmailOptions
): Promise<void> {
  const photosInfo =
    options?.includePhotos && options.photoUrls && options.photoUrls.length > 0
      ? ` with ${options.photoUrls.length} photo(s) attached`
      : '';
  console.log(
    `[Invoice Email] Would send to ${toEmail}: Invoice #${invoiceNumber} for ${customerName}, ${currency} ${total}. PDF attachment placeholder${photosInfo}.`,
  );
  // TODO: integrate Resend/SendGrid; attach _pdfBuffer as PDF
}
