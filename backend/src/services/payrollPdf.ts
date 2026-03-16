import PDFDocument from 'pdfkit';

export interface PayrollRow {
  staff_name: string;
  total_hours: number;
  total_pay: number;
}

/** Extended row for payslip: daily breakdown + pay method for employee to verify. */
export interface PayslipRow extends PayrollRow {
  dailyBreakdown: { date: string; hours: number; pay: number }[];
  payMethod: string;
  payRateLabel: string;
}

const MARGIN = 50;
const PAGE_WIDTH = 595;
const RIGHT_EDGE = PAGE_WIDTH - MARGIN;
const AMOUNT_WIDTH = 90;

function formatDateUk(dateStr: string): string {
  if (!dateStr || !dateStr.slice(0, 10)) return '—';
  const d = new Date(dateStr.slice(0, 10));
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatCurrency(value: number, currency = 'GBP'): string {
  const sym = currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : currency + ' ';
  return sym + value.toFixed(2);
}

/** PDF for accountants: company name, period, table (Staff | Hours | Pay), total. */
export function generatePayrollReportPdf(data: {
  companyName: string;
  dateFrom: string;
  dateTo: string;
  rows: PayrollRow[];
  currency?: string;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: MARGIN });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const currency = data.currency ?? 'GBP';
    const fromUk = formatDateUk(data.dateFrom);
    const toUk = formatDateUk(data.dateTo);

    doc.fontSize(18).font('Helvetica-Bold').text('Payroll Summary', { align: 'left' });
    doc.fontSize(10).font('Helvetica').text(data.companyName, { align: 'left' });
    doc.fontSize(9).fillColor('#555').text(`Period: ${fromUk} to ${toUk}`, { align: 'left' });
    doc.moveDown(1.5);

    const tableTop = doc.y;
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#000');
    doc.text('Staff', 50, tableTop);
    doc.text('Hours', 320, tableTop);
    doc.text(`Pay (${currency})`, 420, tableTop, { width: 100, align: 'right' });
    doc.moveTo(50, tableTop + 14).lineTo(550, tableTop + 14).stroke();
    doc.moveDown(0.5);

    let y = tableTop + 22;
    let totalHours = 0;
    let totalPay = 0;
    doc.font('Helvetica').fontSize(9);

    for (const row of data.rows) {
      doc.text(row.staff_name, 50, y, { width: 260 });
      doc.text(row.total_hours.toFixed(2), 320, y);
      doc.text(formatCurrency(row.total_pay, currency), 420, y, { width: 100, align: 'right' });
      totalHours += row.total_hours;
      totalPay += row.total_pay;
      y += 20;
    }

    y += 8;
    doc.moveTo(50, y).lineTo(550, y).stroke();
    y += 16;
    doc.font('Helvetica-Bold').fontSize(11);
    doc.text('Total', 50, y);
    doc.text(totalHours.toFixed(2), 320, y);
    doc.text(formatCurrency(totalPay, currency), 420, y, { width: 100, align: 'right' });

    doc.moveDown(2);
    doc.font('Helvetica').fontSize(8).fillColor('#666').text('Generated for accounting purposes. This is a summary of hours and pay for the period.', 50, doc.y);

    doc.end();
  });
}

/** One page per staff: UK-style payslip with daily hours, pay method, and total. */
export function generatePayslipsPdf(data: {
  companyName: string;
  dateFrom: string;
  dateTo: string;
  rows: PayslipRow[];
  currency?: string;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: MARGIN });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const currency = data.currency ?? 'GBP';
    const fromUk = formatDateUk(data.dateFrom);
    const toUk = formatDateUk(data.dateTo);

    for (let i = 0; i < data.rows.length; i++) {
      if (i > 0) doc.addPage();
      const row = data.rows[i] as PayslipRow;

      // —— Header: company left, PAYSLIP + period right ——
      doc.fontSize(11).font('Helvetica-Bold').text(data.companyName, MARGIN, 50);
      doc.fontSize(18).font('Helvetica-Bold').text('Payslip', RIGHT_EDGE - 80, 50, { width: 80, align: 'right' });
      doc.fontSize(9).font('Helvetica').fillColor('#555');
      doc.text(`Period: ${fromUk} to ${toUk}`, RIGHT_EDGE - 180, 72, { width: 180, align: 'right' });
      doc.fillColor('black');
      doc.y = 95;

      // Employee name
      doc.fontSize(10).font('Helvetica').fillColor('#555').text('Employee', MARGIN, doc.y);
      doc.fontSize(14).font('Helvetica-Bold').fillColor('black').text(row.staff_name, MARGIN, doc.y + 16);
      doc.y += 42;

      // Pay method (so employee can verify)
      doc.fontSize(9).font('Helvetica').fillColor('#555').text('Pay method', MARGIN, doc.y);
      doc.fontSize(10).fillColor('black').text(row.payRateLabel, MARGIN, doc.y + 14);
      doc.y += 38;

      // —— Daily breakdown: Date | Hours | Pay ——
      doc.fontSize(10).font('Helvetica-Bold').text('Hours worked by date', MARGIN, doc.y);
      doc.y += 20;

      const tableLeft = MARGIN;
      const colDate = tableLeft + 20;
      const colHours = RIGHT_EDGE - AMOUNT_WIDTH * 2 - 10;
      const colPay = RIGHT_EDGE - AMOUNT_WIDTH;

      if (row.dailyBreakdown && row.dailyBreakdown.length > 0) {
        doc.font('Helvetica-Bold').fontSize(9);
        doc.text('Date', colDate, doc.y);
        doc.text('Hours', colHours, doc.y, { width: AMOUNT_WIDTH, align: 'right' });
        doc.text('Pay', colPay, doc.y, { width: AMOUNT_WIDTH, align: 'right' });
        doc.y += 14;
        doc.moveTo(tableLeft, doc.y).lineTo(RIGHT_EDGE, doc.y).stroke();
        doc.y += 10;

        doc.font('Helvetica').fontSize(9);
        for (const d of row.dailyBreakdown) {
          doc.text(formatDateUk(d.date), colDate, doc.y);
          doc.text(d.hours.toFixed(2), colHours, doc.y, { width: AMOUNT_WIDTH, align: 'right' });
          doc.text(formatCurrency(d.pay, currency), colPay, doc.y, { width: AMOUNT_WIDTH, align: 'right' });
          doc.y += 18;
        }
        doc.y += 6;
      } else {
        doc.font('Helvetica').fontSize(9).fillColor('#666').text('No shifts in this period.', colDate, doc.y);
        doc.fillColor('black');
        doc.y += 22;
      }

      doc.moveTo(tableLeft, doc.y).lineTo(RIGHT_EDGE, doc.y).stroke();
      doc.y += 16;

      // Totals
      doc.font('Helvetica').fontSize(10);
      doc.text('Total hours', tableLeft, doc.y);
      doc.text(row.total_hours.toFixed(2), colHours, doc.y, { width: AMOUNT_WIDTH, align: 'right' });
      doc.text(formatCurrency(row.total_pay, currency), colPay, doc.y, { width: AMOUNT_WIDTH, align: 'right' });
      doc.y += 22;

      doc.font('Helvetica-Bold').fontSize(12);
      doc.text('Total pay', tableLeft, doc.y);
      doc.text(formatCurrency(row.total_pay, currency), colPay, doc.y, { width: AMOUNT_WIDTH, align: 'right' });
      doc.y += 28;

      // Calculation note (so they can verify)
      doc.font('Helvetica').fontSize(8).fillColor('#555');
      doc.text(`Calculation: ${row.payRateLabel}. Total hours × rate (or %/fixed per job) = amount above. Hours rounded per company payroll settings.`, tableLeft, doc.y, { width: RIGHT_EDGE - tableLeft });
      doc.fillColor('black');
    }

    doc.end();
  });
}
