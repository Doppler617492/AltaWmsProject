import PDFDocument = require('pdfkit');
import QRCode from 'qrcode';

interface SkartPdfPayload {
  uid: string;
  storeName: string | null;
  status: string;
  createdAt: Date | string;
  receivedAt: Date | string | null;
  note: string | null;
  items: Array<{
    code: string;
    name: string;
    qty: number;
    reason: string;
    receivedQty: number | null;
  }>;
}

export async function buildSkartQrPdf(payload: SkartPdfPayload): Promise<Buffer> {
  const pdf = new PDFDocument({ margin: 42, size: 'A4' });
  const buffers: Buffer[] = [];
  pdf.on('data', (chunk) => buffers.push(chunk));

  const qrDataUrl = await QRCode.toDataURL(payload.uid, { margin: 1, scale: 6 });
  const [, base64] = qrDataUrl.split(',');
  const qrBuffer = Buffer.from(base64, 'base64');

  pdf.fontSize(22).fillColor('#111827').text('SKART DOKUMENT', { align: 'left', underline: true });
  pdf.moveDown(0.5);

  pdf.fontSize(12).fillColor('#1f2937').text(`UID: ${payload.uid}`);
  pdf.text(`Prodavnica: ${payload.storeName ?? '-'}`);
  pdf.text(`Status: ${payload.status}`);
  pdf.text(`Kreirano: ${formatDate(payload.createdAt)}`);
  if (payload.receivedAt) {
    pdf.text(`Primljeno: ${formatDate(payload.receivedAt)}`);
  }
  if (payload.note) {
    pdf.moveDown(0.4);
    pdf.font('Helvetica-Oblique').text(`Napomena: ${payload.note}`, { width: 360 });
    pdf.font('Helvetica');
  }

  pdf.image(qrBuffer, pdf.page.width - 180, 60, { fit: [120, 120], align: 'right' });

  pdf.moveDown(1.2);
  pdf.fontSize(14).fillColor('#111827').text('Stavke', { underline: true });
  pdf.moveDown(0.4);

  pdf.fontSize(11);
  const tableTop = pdf.y;
  const colWidths = [80, 160, 60, 80, 60];
  const headers = ['Šifra', 'Naziv', 'Količina', 'Razlog', 'Primljeno'];

  renderRow(pdf, tableTop, colWidths, headers, true);

  let currentY = tableTop + 22;
  payload.items.forEach((item) => {
    const row = [
      item.code,
      item.name,
      formatNumber(item.qty),
      item.reason,
      item.receivedQty !== null ? formatNumber(item.receivedQty) : '-',
    ];
    renderRow(pdf, currentY, colWidths, row, false);
    currentY += 20;
    if (currentY > pdf.page.height - 80) {
      pdf.addPage();
      currentY = pdf.y;
    }
  });

  pdf.moveDown(2);
  pdf.fontSize(10).fillColor('#6b7280').text('Generisano iz Alta WMS SKART modula.', { align: 'center' });

  pdf.end();

  return new Promise<Buffer>((resolve) => {
    pdf.on('end', () => resolve(Buffer.concat(buffers)));
  });
}

function renderRow(pdf: any, y: number, widths: number[], values: string[], header: boolean) {
  const startX = pdf.page.margins.left;
  pdf.rect(startX, y - 4, widths.reduce((a, b) => a + b, 0), 22).strokeColor('#d1d5db').stroke();
  let x = startX + 4;
  values.forEach((value, index) => {
    pdf.font(header ? 'Helvetica-Bold' : 'Helvetica');
    pdf.fillColor(header ? '#111827' : '#1f2937');
    pdf.text(value, x, y, { width: widths[index] - 8, ellipsis: true });
    x += widths[index];
  });
}

function formatDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleString('sr-Latn-RS');
}

function formatNumber(value: number) {
  return Number(value || 0).toLocaleString('sr-Latn-RS', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
}

interface PovracajPdfPayload {
  uid: string;
  storeName: string | null;
  status: string;
  createdAt: Date | string;
  receivedAt: Date | string | null;
  note: string | null;
  items: Array<{
    code: string;
    name: string;
    qty: number;
    reason: string;
    receivedQty: number | null;
  }>;
}

export async function buildPovracajQrPdf(payload: PovracajPdfPayload): Promise<Buffer> {
  const pdf = new PDFDocument({ margin: 42, size: 'A4' });
  const buffers: Buffer[] = [];
  pdf.on('data', (chunk) => buffers.push(chunk));

  const qrDataUrl = await QRCode.toDataURL(payload.uid, { margin: 1, scale: 6 });
  const [, base64] = qrDataUrl.split(',');
  const qrBuffer = Buffer.from(base64, 'base64');

  pdf.fontSize(22).fillColor('#111827').text('POVRAĆAJ DOKUMENT', { align: 'left', underline: true });
  pdf.moveDown(0.5);

  pdf.fontSize(12).fillColor('#1f2937').text(`UID: ${payload.uid}`);
  pdf.text(`Prodavnica: ${payload.storeName ?? '-'}`);
  pdf.text(`Status: ${payload.status}`);
  pdf.text(`Kreirano: ${formatDate(payload.createdAt)}`);
  if (payload.receivedAt) {
    pdf.text(`Primljeno: ${formatDate(payload.receivedAt)}`);
  }
  if (payload.note) {
    pdf.moveDown(0.4);
    pdf.font('Helvetica-Oblique').text(`Napomena: ${payload.note}`, { width: 360 });
    pdf.font('Helvetica');
  }

  pdf.image(qrBuffer, pdf.page.width - 180, 60, { fit: [120, 120], align: 'right' });

  pdf.moveDown(1.2);
  pdf.fontSize(14).fillColor('#111827').text('Stavke', { underline: true });
  pdf.moveDown(0.4);

  pdf.fontSize(11);
  const tableTop = pdf.y;
  const colWidths = [80, 160, 60, 80, 60];
  const headers = ['Šifra', 'Naziv', 'Količina', 'Razlog', 'Primljeno'];

  renderRow(pdf, tableTop, colWidths, headers, true);

  let currentY = tableTop + 22;
  payload.items.forEach((item) => {
    const row = [
      item.code,
      item.name,
      formatNumber(item.qty),
      item.reason,
      item.receivedQty !== null ? formatNumber(item.receivedQty) : '-',
    ];
    renderRow(pdf, currentY, colWidths, row, false);
    currentY += 20;
    if (currentY > pdf.page.height - 80) {
      pdf.addPage();
      currentY = pdf.y;
    }
  });

  pdf.moveDown(2);
  pdf.fontSize(10).fillColor('#6b7280').text('Generisano iz Alta WMS Povraćaj modula.', { align: 'center' });

  pdf.end();

  return new Promise<Buffer>((resolve) => {
    pdf.on('end', () => resolve(Buffer.concat(buffers)));
  });
}


