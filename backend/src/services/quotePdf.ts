import PDFDocument from 'pdfkit';

export interface QuoteLineItem {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface QuotePdfData {
  quoteNumber: string;
  companyName: string;
  companyContact?: string;
  customerName: string;
  customerAddress?: string;
  customerEmail?: string;
  customerPhone?: string;
  /** When set, table shows each line; otherwise single row from serviceType/quantity/unitPrice/totalPrice */
  lineItems?: QuoteLineItem[];
  serviceType: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  currency: string;
  notes?: string;
  createdAt: string;
}

/** Generate PDF buffer for a quote (UK format, £ GBP). */
export function generateQuotePdf(data: QuotePdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header — company branding
    doc.fontSize(20).font('Helvetica-Bold').text('QUOTE', { align: 'right' });
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica').text(`Quote #${data.quoteNumber}`, { align: 'right' });
    doc.moveDown(2);

    // Company
    doc.fontSize(11).font('Helvetica-Bold').text(data.companyName);
    if (data.companyContact) doc.font('Helvetica').fontSize(9).text(data.companyContact);
    doc.moveDown(1.5);

    // Prepared for
    doc.fontSize(10).font('Helvetica-Bold').text('Prepared for');
    doc.font('Helvetica').fontSize(9).text(data.customerName);
    if (data.customerAddress) doc.text(data.customerAddress);
    if (data.customerEmail) doc.text(data.customerEmail);
    if (data.customerPhone) doc.text(data.customerPhone);
    doc.moveDown(1.5);

    doc.fontSize(9).fillColor('#666').text(`Date: ${data.createdAt}`);
    doc.moveDown(1);

    // Service table
    const tableTop = doc.y;
    doc.font('Helvetica-Bold').fontSize(9).fillColor('black');
    doc.text('Service', 50, tableTop);
    doc.text('Qty', 320, tableTop);
    doc.text('Unit price', 380, tableTop);
    doc.text('Total', 450, tableTop, { width: 80, align: 'right' });
    doc.moveTo(50, tableTop + 12).lineTo(550, tableTop + 12).stroke();
    doc.moveDown(0.5);

    let y = tableTop + 20;
    doc.font('Helvetica');
    doc.fontSize(9);

    const rows = data.lineItems && data.lineItems.length > 0
      ? data.lineItems.map((row) => ({
          name: row.name,
          quantity: row.quantity,
          unitPrice: row.unitPrice,
          total: row.total,
        }))
      : [{ name: data.serviceType, quantity: data.quantity, unitPrice: data.unitPrice, total: data.totalPrice }];

    for (const row of rows) {
      doc.text(row.name, 50, y, { width: 260 });
      doc.text(String(row.quantity), 320, y);
      doc.text(`£${Number(row.unitPrice).toFixed(2)}`, 380, y);
      doc.text(`£${Number(row.total).toFixed(2)}`, 450, y, { width: 80, align: 'right' });
      y += 24;
    }

    doc.moveTo(50, y).lineTo(550, y).stroke();
    y += 15;
    doc.font('Helvetica-Bold').fontSize(11);
    doc.text(`Total: £${Number(data.totalPrice).toFixed(2)}`, 450, y, { width: 80, align: 'right' });

    doc.moveDown(2);
    if (data.notes?.trim()) {
      doc.font('Helvetica').fontSize(9).text('Notes:', 50, doc.y);
      doc.text(data.notes.trim(), 50, doc.y + 14, { width: 500 });
      doc.moveDown(1.5);
    }

    doc.moveDown(2);
    doc.font('Helvetica').fontSize(8).fillColor('#666');
    doc.text('Thank you for your interest. This quote is valid for 30 days.', 50, doc.y);
    doc.text('Please contact us to accept this quote or if you have any questions.', 50, doc.y + 14);

    doc.end();
  });
}
