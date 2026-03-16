import PDFDocument from 'pdfkit';
import { UK_VAT_RATE, subtotalFromTotalIncludingVat, vatAmountFromTotalIncludingVat } from '../constants/vat';

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

export interface InvoicePdfData {
  invoiceNumber: string;
  companyName: string;
  companyAddress?: string;
  customerName: string;
  customerAddress?: string;
  customerEmail?: string;
  issuedAt: string;
  dueAt: string;
  lineItems: InvoiceLineItem[];
  total: number;
  currency: string;
  status: string;
  /** When true, total is incl. VAT; show Subtotal + VAT (20%) + Total. */
  chargeVat?: boolean;
}

const MARGIN = 50;
const PAGE_WIDTH = 595; // A4
const RIGHT_EDGE = PAGE_WIDTH - MARGIN;
/** Width for right-aligned amount column (so decimals line up). */
const AMOUNT_WIDTH = 100;
/** Header block: wide enough so "Invoice number: INV-2026-0004" and dates stay on one line. */
const HEADER_RIGHT_WIDTH = 200;

function formatDateUk(isoOrBlank: string): string {
  if (!isoOrBlank || !isoOrBlank.slice(0, 10)) return '—';
  const d = new Date(isoOrBlank.slice(0, 10));
  if (Number.isNaN(d.getTime())) return isoOrBlank;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatCurrency(currency: string, value: number): string {
  const sym = currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : currency + ' ';
  return sym + value.toFixed(2);
}

/** Generate PDF buffer for an invoice (UK-style layout). */
export function generateInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: MARGIN });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const issuedFormatted = formatDateUk(data.issuedAt);
    const dueFormatted = formatDateUk(data.dueAt);

    // —— Header: Company left, INVOICE + ref + dates right ——
    doc.fontSize(11).font('Helvetica-Bold').text(data.companyName, MARGIN, doc.y);
    if (data.companyAddress) {
      doc.font('Helvetica').fontSize(9).fillColor('#333');
      const addrLines = String(data.companyAddress).split(/\n/).filter(Boolean);
      addrLines.forEach((line) => doc.text(line.trim(), MARGIN, doc.y + 4));
      doc.y += addrLines.length * 14;
    }
    doc.fillColor('black');
    doc.moveDown(0.8);

    const headerRightY = 50;
    const headerLineGap = 18;
    doc.fontSize(18).font('Helvetica-Bold').text('INVOICE', RIGHT_EDGE - 80, headerRightY, { width: 80, align: 'right' });
    doc.fontSize(9).font('Helvetica');
    doc.text(`Invoice number: ${data.invoiceNumber}`, RIGHT_EDGE - HEADER_RIGHT_WIDTH, headerRightY + 24, { width: HEADER_RIGHT_WIDTH, align: 'right' });
    doc.text(`Date issued: ${issuedFormatted}`, RIGHT_EDGE - HEADER_RIGHT_WIDTH, headerRightY + 24 + headerLineGap, { width: HEADER_RIGHT_WIDTH, align: 'right' });
    doc.text(`Due date: ${dueFormatted}`, RIGHT_EDGE - HEADER_RIGHT_WIDTH, headerRightY + 24 + headerLineGap * 2, { width: HEADER_RIGHT_WIDTH, align: 'right' });

    // Reset Y for Bill To (below company block)
    const billToTop = data.companyAddress ? 50 + 14 * (String(data.companyAddress).split(/\n/).filter(Boolean).length + 1) + 20 : 90;
    doc.y = Math.max(doc.y, billToTop);

    // —— Bill To ——
    doc.fontSize(10).font('Helvetica-Bold').text('Bill to', MARGIN, doc.y);
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(9).fillColor('#333');
    doc.text(data.customerName, MARGIN, doc.y);
    if (data.customerAddress) {
      const custAddr = String(data.customerAddress).split(/\n/).filter(Boolean);
      custAddr.forEach((line) => doc.text(line.trim(), MARGIN, doc.y + 12));
      doc.y += custAddr.length * 12;
    }
    if (data.customerEmail) doc.text(data.customerEmail, MARGIN, doc.y + 12);
    doc.fillColor('black');
    doc.moveDown(1.2);

    // —— Table ——
    const tableLeft = MARGIN;
    const tableRight = RIGHT_EDGE;
    const colQty = tableRight - AMOUNT_WIDTH * 3 - 20;
    const colUnit = tableRight - AMOUNT_WIDTH * 2 - 10;
    const colAmount = tableRight - AMOUNT_WIDTH;
    const descWidth = colQty - tableLeft - 15;

    const rowHeight = 20;
    let y = doc.y;

    doc.font('Helvetica-Bold').fontSize(9);
    doc.text('Description', tableLeft, y);
    doc.text('Qty', colQty, y, { width: 50, align: 'right' });
    doc.text('Unit price', colUnit, y, { width: AMOUNT_WIDTH, align: 'right' });
    doc.text('Amount', colAmount, y, { width: AMOUNT_WIDTH, align: 'right' });
    y += 14;
    doc.moveTo(tableLeft, y).lineTo(tableRight, y).stroke();
    y += 10;

    doc.font('Helvetica').fontSize(9);
    for (const item of data.lineItems) {
      const descOneLine = item.description.length > 55 ? item.description.slice(0, 52) + '…' : item.description;
      doc.text(descOneLine, tableLeft, y, { width: descWidth });
      doc.text(String(item.quantity), colQty, y, { width: 50, align: 'right' });
      doc.text(formatCurrency(data.currency, Number(item.unit_price)), colUnit, y, { width: AMOUNT_WIDTH, align: 'right' });
      doc.text(formatCurrency(data.currency, Number(item.amount)), colAmount, y, { width: AMOUNT_WIDTH, align: 'right' });
      y += rowHeight;
    }

    y += 8;
    doc.moveTo(tableLeft, y).lineTo(tableRight, y).stroke();
    y += 14;

    const showVatBreakdown = Boolean(data.chargeVat) && Number(data.total) > 0;
    if (showVatBreakdown) {
      const subtotal = subtotalFromTotalIncludingVat(Number(data.total));
      const vatAmount = vatAmountFromTotalIncludingVat(Number(data.total));
      doc.font('Helvetica').fontSize(9);
      doc.text('Subtotal', tableLeft, y);
      doc.text(formatCurrency(data.currency, subtotal), colAmount, y, { width: AMOUNT_WIDTH, align: 'right' });
      y += 18;
      doc.text(`VAT (${Math.round(UK_VAT_RATE * 100)}%)`, tableLeft, y);
      doc.text(formatCurrency(data.currency, vatAmount), colAmount, y, { width: AMOUNT_WIDTH, align: 'right' });
      y += 18;
    }
    doc.font('Helvetica-Bold').fontSize(11);
    doc.text('Total', tableLeft, y);
    doc.text(formatCurrency(data.currency, Number(data.total)), colAmount, y, { width: AMOUNT_WIDTH, align: 'right' });

    y += 32;
    doc.font('Helvetica').fontSize(9).fillColor('#555');
    doc.text('Thank you for your business.', tableLeft, y);
    doc.fillColor('black');

    doc.end();
  });
}
