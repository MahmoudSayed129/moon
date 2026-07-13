import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  BarcodeFormat,
  EncodeHintType,
  QRCodeWriter,
} from '@zxing/library';
import { formatEGPForPdf } from './currency';
import {
  createMoonPdf,
  drawMoonHeader,
  drawMoonMetaGrid,
  drawMoonNotesBox,
  drawMoonSectionTitle,
  drawMoonStatStrip,
  moonPdfColors,
  moonTableTheme,
} from './pdf-theme';

interface InvoiceItem {
  productName: string;
  productBarcode: string;
  quantity: number;
  returnedQuantity?: number;
  unitPrice: number;
  lineTotal: number;
}

interface InvoiceReturnItem {
  productName: string;
  productBarcode: string;
  quantity: number;
  lineTotal: number;
}

interface InvoiceReturnRecord {
  reason?: string;
  totalReturned: number;
  createdAt: string;
  items: InvoiceReturnItem[];
}

interface InvoicePayload {
  invoiceNumber: string;
  createdAt: string;
  subtotal: number;
  discountAmount?: number;
  totalAmount: number;
  returnedTotalAmount?: number;
  netTotalAmount?: number;
  commissionRate: number;
  commissionAmount: number;
  returnedCommissionAmount?: number;
  netCommissionAmount?: number;
  returnStatus?: 'none' | 'partial' | 'full';
  notes?: string;
  employeeCode?: string;
  employeeName?: string;
  client?: {
    name?: string;
    phone?: string;
    email?: string;
  } | null;
  items: InvoiceItem[];
  returns?: InvoiceReturnRecord[];
}

const money = (value: number) => formatEGPForPdf(value);

const RECEIPT_LEFT = 6;
const RECEIPT_RIGHT = 74;
const RECEIPT_CENTER = (RECEIPT_LEFT + RECEIPT_RIGHT) / 2;
const RECEIPT_WIDTH = RECEIPT_RIGHT - RECEIPT_LEFT;

const drawReceiptDivider = (doc: jsPDF, y: number, style: 'solid' | 'dashed' = 'dashed') => {
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.2);
  if (style === 'dashed') {
    doc.setLineDashPattern([1, 1], 0);
  }
  doc.line(RECEIPT_LEFT, y, RECEIPT_RIGHT, y);
  doc.setLineDashPattern([], 0);
  doc.setLineWidth(0.2);
};

const drawReceiptRow = (
  doc: jsPDF,
  label: string,
  value: string,
  y: number,
  { bold = false, size = 8 }: { bold?: boolean; size?: number } = {}
) => {
  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  doc.setFontSize(size);
  doc.text(label, RECEIPT_LEFT, y);
  doc.text(value, RECEIPT_RIGHT, y, { align: 'right' });
};

const qrWriter = new QRCodeWriter();
const CODE128_START_B = 104;
const CODE128_STOP = 106;
const CODE128_PATTERNS = [
  [2, 1, 2, 2, 2, 2], [2, 2, 2, 1, 2, 2], [2, 2, 2, 2, 2, 1], [1, 2, 1, 2, 2, 3],
  [1, 2, 1, 3, 2, 2], [1, 3, 1, 2, 2, 2], [1, 2, 2, 2, 1, 3], [1, 2, 2, 3, 1, 2],
  [1, 3, 2, 2, 1, 2], [2, 2, 1, 2, 1, 3], [2, 2, 1, 3, 1, 2], [2, 3, 1, 2, 1, 2],
  [1, 1, 2, 2, 3, 2], [1, 2, 2, 1, 3, 2], [1, 2, 2, 2, 3, 1], [1, 1, 3, 2, 2, 2],
  [1, 2, 3, 1, 2, 2], [1, 2, 3, 2, 2, 1], [2, 2, 3, 2, 1, 1], [2, 2, 1, 1, 3, 2],
  [2, 2, 1, 2, 3, 1], [2, 1, 3, 2, 1, 2], [2, 2, 3, 1, 1, 2], [3, 1, 2, 1, 3, 1],
  [3, 1, 1, 2, 2, 2], [3, 2, 1, 1, 2, 2], [3, 2, 1, 2, 2, 1], [3, 1, 2, 2, 1, 2],
  [3, 2, 2, 1, 1, 2], [3, 2, 2, 2, 1, 1], [2, 1, 2, 1, 2, 3], [2, 1, 2, 3, 2, 1],
  [2, 3, 2, 1, 2, 1], [1, 1, 1, 3, 2, 3], [1, 3, 1, 1, 2, 3], [1, 3, 1, 3, 2, 1],
  [1, 1, 2, 3, 1, 3], [1, 3, 2, 1, 1, 3], [1, 3, 2, 3, 1, 1], [2, 1, 1, 3, 1, 3],
  [2, 3, 1, 1, 1, 3], [2, 3, 1, 3, 1, 1], [1, 1, 2, 1, 3, 3], [1, 1, 2, 3, 3, 1],
  [1, 3, 2, 1, 3, 1], [1, 1, 3, 1, 2, 3], [1, 1, 3, 3, 2, 1], [1, 3, 3, 1, 2, 1],
  [3, 1, 3, 1, 2, 1], [2, 1, 1, 3, 3, 1], [2, 3, 1, 1, 3, 1], [2, 1, 3, 1, 1, 3],
  [2, 1, 3, 3, 1, 1], [2, 1, 3, 1, 3, 1], [3, 1, 1, 1, 2, 3], [3, 1, 1, 3, 2, 1],
  [3, 3, 1, 1, 2, 1], [3, 1, 2, 1, 1, 3], [3, 1, 2, 3, 1, 1], [3, 3, 2, 1, 1, 1],
  [3, 1, 4, 1, 1, 1], [2, 2, 1, 4, 1, 1], [4, 3, 1, 1, 1, 1], [1, 1, 1, 2, 2, 4],
  [1, 1, 1, 4, 2, 2], [1, 2, 1, 1, 2, 4], [1, 2, 1, 4, 2, 1], [1, 4, 1, 1, 2, 2],
  [1, 4, 1, 2, 2, 1], [1, 1, 2, 2, 1, 4], [1, 1, 2, 4, 1, 2], [1, 2, 2, 1, 1, 4],
  [1, 2, 2, 4, 1, 1], [1, 4, 2, 1, 1, 2], [1, 4, 2, 2, 1, 1], [2, 4, 1, 2, 1, 1],
  [2, 2, 1, 1, 1, 4], [4, 1, 3, 1, 1, 1], [2, 4, 1, 1, 1, 2], [1, 3, 4, 1, 1, 1],
  [1, 1, 1, 2, 4, 2], [1, 2, 1, 1, 4, 2], [1, 2, 1, 2, 4, 1], [1, 1, 4, 2, 1, 2],
  [1, 2, 4, 1, 1, 2], [1, 2, 4, 2, 1, 1], [4, 1, 1, 2, 1, 2], [4, 2, 1, 1, 1, 2],
  [4, 2, 1, 2, 1, 1], [2, 1, 2, 1, 4, 1], [2, 1, 4, 1, 2, 1], [4, 1, 2, 1, 2, 1],
  [1, 1, 1, 1, 4, 3], [1, 1, 1, 3, 4, 1], [1, 3, 1, 1, 4, 1], [1, 1, 4, 1, 1, 3],
  [1, 1, 4, 3, 1, 1], [4, 1, 1, 1, 1, 3], [4, 1, 1, 3, 1, 1], [1, 1, 3, 1, 4, 1],
  [1, 1, 4, 1, 3, 1], [3, 1, 1, 1, 4, 1], [4, 1, 1, 1, 3, 1], [2, 1, 1, 4, 1, 2],
  [2, 1, 1, 2, 1, 4], [2, 1, 1, 2, 3, 2], [2, 3, 3, 1, 1, 1, 2],
] as const;

const drawBitMatrix = (
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  contents: string,
  hints?: Map<EncodeHintType, unknown>
) => {
  const matrix = qrWriter.encode(contents, BarcodeFormat.QR_CODE, Math.round(width), Math.round(height), hints);
  const matrixWidth = matrix.getWidth();
  const matrixHeight = matrix.getHeight();
  const cellWidth = width / matrixWidth;
  const cellHeight = height / matrixHeight;

  doc.setFillColor(20, 20, 20);
  for (let row = 0; row < matrixHeight; row += 1) {
    for (let col = 0; col < matrixWidth; col += 1) {
      if (!matrix.get(col, row)) continue;
      doc.rect(x + col * cellWidth, y + row * cellHeight, cellWidth, cellHeight, 'F');
    }
  }
};

const encodeCode128B = (value: string) => {
  if (!value) throw new Error('Barcode value is required');

  const codes = [CODE128_START_B];
  for (const char of value) {
    const codePoint = char.charCodeAt(0);
    if (codePoint < 32 || codePoint > 126) {
      throw new Error(`Unsupported CODE128-B character: ${char}`);
    }
    codes.push(codePoint - 32);
  }

  const checksum =
    codes.reduce((sum, code, index) => sum + (index === 0 ? code : code * index), 0) % 103;
  codes.push(checksum, CODE128_STOP);
  return codes;
};

const drawCode128Barcode = (
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  value: string
) => {
  const codes = encodeCode128B(value);
  const patterns = codes.map((code) => CODE128_PATTERNS[code]);
  const totalUnits = patterns.reduce(
    (sum, pattern) => sum + pattern.reduce((patternSum, unit) => patternSum + unit, 0),
    0
  );
  const moduleWidth = width / totalUnits;

  let cursor = x;
  doc.setFillColor(20, 20, 20);

  for (const pattern of patterns) {
    let drawBar = true;
    for (const unit of pattern) {
      const segmentWidth = unit * moduleWidth;
      if (drawBar) {
        doc.rect(cursor, y, segmentWidth, height, 'F');
      }
      cursor += segmentWidth;
      drawBar = !drawBar;
    }
  }
};

export const buildInvoicePdf = (payload: InvoicePayload) => {
  const doc = createMoonPdf();
  const hasReturns = (payload.returnedTotalAmount || 0) > 0;

  let y = drawMoonHeader(
    doc,
    'MOON Store Invoice',
    payload.invoiceNumber,
    hasReturns ? 'Sales receipt with return summary' : 'Sales receipt'
  );

  y = drawMoonMetaGrid(
    doc,
    [
      `Issued: ${new Date(payload.createdAt).toLocaleString()}`,
      `Client: ${payload.client?.name || 'Walk-in Client'}`,
      `Phone: ${payload.client?.phone || 'Not provided'}`,
      `Email: ${payload.client?.email || 'Not provided'}`,
    ],
    [
      `Employee: ${payload.employeeName || 'No employee'}`,
      `Code: ${payload.employeeCode || 'Not applied'}`,
      `Commission Rate: ${payload.commissionRate.toFixed(2)}%`,
      `Commission: ${money(payload.commissionAmount)}`,
    ],
    y
  );

  const hasDiscount = (payload.discountAmount || 0) > 0;
  y = drawMoonStatStrip(
    doc,
    [
      { label: 'Subtotal', value: money(payload.subtotal) },
      ...(hasDiscount
        ? [{ label: 'Discount', value: `-${money(payload.discountAmount || 0)}`, tone: 'good' as const }]
        : []),
      ...(hasReturns
        ? [{ label: 'Returned', value: `-${money(payload.returnedTotalAmount || 0)}`, tone: 'warn' as const }]
        : []),
      {
        label: hasReturns ? 'Net Total' : 'Total',
        value: money(payload.netTotalAmount ?? payload.totalAmount),
        tone: 'accent',
      },
      {
        label: hasReturns ? 'Net Commission' : 'Commission',
        value: money(payload.netCommissionAmount ?? payload.commissionAmount),
      },
    ],
    y
  );

  y = drawMoonSectionTitle(doc, 'Items', y);

  autoTable(doc, {
    ...moonTableTheme,
    startY: y,
    head: [['Code', 'Item', 'Qty', 'Returned', 'Net Qty', 'Unit', 'Line Total']],
    body: payload.items.map((item) => [
      item.productBarcode,
      item.productName,
      item.quantity.toString(),
      (item.returnedQuantity || 0).toString(),
      String(item.quantity - (item.returnedQuantity || 0)),
      money(item.unitPrice),
      money(item.lineTotal),
    ]),
    columnStyles: {
      0: { cellWidth: 28 },
      1: { cellWidth: 48 },
      2: { halign: 'center' },
      3: { halign: 'center' },
      4: { halign: 'center' },
      5: { halign: 'right' },
      6: { halign: 'right' },
    },
  });

  y = ((doc as any).lastAutoTable?.finalY || y) + 8;

  if (payload.notes) {
    y = drawMoonNotesBox(doc, payload.notes, y);
  }

  if (hasReturns) {
    y = drawMoonSectionTitle(
      doc,
      `Return Summary${payload.returnStatus ? ` · ${payload.returnStatus.toUpperCase()}` : ''}`,
      y
    );

    autoTable(doc, {
      ...moonTableTheme,
      startY: y,
      head: [['Return Date', 'Reason', 'Items', 'Returned Total']],
      headStyles: {
        ...moonTableTheme.headStyles,
        fillColor: [...moonPdfColors.accentDark] as number[],
      },
      body: (payload.returns || []).map((entry) => [
        new Date(entry.createdAt).toLocaleDateString(),
        entry.reason || 'No reason provided',
        entry.items.map((item) => `${item.productName} x${item.quantity}`).join(', '),
        money(entry.totalReturned),
      ]),
      columnStyles: {
        0: { cellWidth: 28 },
        1: { cellWidth: 50 },
        2: { cellWidth: 72 },
        3: { halign: 'right' },
      },
    });
    y = ((doc as any).lastAutoTable?.finalY || y) + 8;
  }

  doc.setDrawColor(...moonPdfColors.border);
  doc.line(14, 286, 196, 286);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...moonPdfColors.slate);
  doc.text('MOON Store - Moon Fashion Suez, Egypt', 14, 291);
  doc.text('Thank you for shopping with MOON', 196, 291, { align: 'right' });

  return doc;
};

export const buildReceiptPdf = (payload: InvoicePayload) => {
  const itemRows = payload.items.map((item) => ({
    name: item.productName,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    lineTotal: item.lineTotal,
  }));
  const returnedTotal = payload.returnedTotalAmount || 0;
  const netTotal = payload.netTotalAmount ?? payload.totalAmount;
  const notes = payload.notes?.trim() || '';

  // Rough height estimate — each item takes 2 lines (name + qty/price), plus totals block.
  const estimatedHeight =
    150 +
    itemRows.length * 10 +
    (returnedTotal > 0 ? 6 : 0) +
    (notes ? Math.min(30, Math.ceil(notes.length / 34) * 4 + 8) : 0);
  const doc = new jsPDF({ unit: 'mm', format: [80, Math.max(estimatedHeight, 180)] });

  let y = 6;

  // --- Store header band ---------------------------------------------------
  doc.setFillColor(20, 20, 30);
  doc.rect(0, 0, 80, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('MOON STORE', RECEIPT_CENTER, 10, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('Moon Fashion  ·  Suez, Egypt', RECEIPT_CENTER, 15, { align: 'center' });
  doc.text('Sales Receipt', RECEIPT_CENTER, 19, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  y = 27;

  // --- Meta block ----------------------------------------------------------
  const createdAt = new Date(payload.createdAt);
  const dateLabel = createdAt.toLocaleDateString('en-GB');
  const timeLabel = createdAt.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });

  doc.setFontSize(8);
  drawReceiptRow(doc, 'Invoice', payload.invoiceNumber, y);
  y += 4.5;
  drawReceiptRow(doc, 'Date', `${dateLabel}  ${timeLabel}`, y);
  y += 4.5;
  drawReceiptRow(doc, 'Client', payload.client?.name || 'Walk-in Client', y);
  y += 4.5;
  drawReceiptRow(
    doc,
    'Cashier',
    payload.employeeName || payload.employeeCode || 'Not applied',
    y
  );
  y += 5;

  drawReceiptDivider(doc, y);
  y += 5;

  // --- Items table ---------------------------------------------------------
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('ITEM', RECEIPT_LEFT, y);
  doc.text('QTY', RECEIPT_LEFT + 40, y, { align: 'right' });
  doc.text('TOTAL', RECEIPT_RIGHT, y, { align: 'right' });
  y += 2;
  drawReceiptDivider(doc, y, 'solid');
  y += 4;

  doc.setFontSize(8);
  for (const row of itemRows) {
    const nameLines = doc.splitTextToSize(row.name, 38);
    doc.setFont('helvetica', 'normal');
    doc.text(nameLines, RECEIPT_LEFT, y);
    doc.text(String(row.quantity), RECEIPT_LEFT + 40, y, { align: 'right' });
    doc.text(money(row.lineTotal), RECEIPT_RIGHT, y, { align: 'right' });

    // second line: unit price detail, small, muted
    const nameHeight = Math.max(4, nameLines.length * 3.6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(120, 120, 120);
    doc.text(`@ ${money(row.unitPrice)} each`, RECEIPT_LEFT, y + nameHeight);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(8);

    y += nameHeight + 4.5;
  }

  y += 1;
  drawReceiptDivider(doc, y);
  y += 6;

  // --- Totals block --------------------------------------------------------
  // Show the subtotal + discount lines only when a discount or return is in
  // play; otherwise the item table already carries all the info and the big
  // TOTAL band is enough on its own.
  const discountTotal = payload.discountAmount || 0;
  if (discountTotal > 0 || returnedTotal > 0) {
    drawReceiptRow(doc, 'Subtotal', money(payload.subtotal), y);
    y += 5;
  }
  if (discountTotal > 0) {
    drawReceiptRow(doc, 'Discount', `- ${money(discountTotal)}`, y);
    y += 5;
  }
  if (returnedTotal > 0) {
    drawReceiptRow(doc, 'Returned', `- ${money(returnedTotal)}`, y);
    y += 5;
  }

  // Big total in a filled band so it stands out.
  doc.setFillColor(20, 20, 30);
  doc.rect(RECEIPT_LEFT, y - 4, RECEIPT_WIDTH, 9, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('TOTAL', RECEIPT_LEFT + 2, y + 2.5);
  doc.text(money(netTotal), RECEIPT_RIGHT - 2, y + 2.5, { align: 'right' });
  doc.setTextColor(0, 0, 0);
  y += 12;

  // --- Optional notes ------------------------------------------------------
  if (notes) {
    drawReceiptDivider(doc, y);
    y += 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('Notes', RECEIPT_LEFT, y);
    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    const noteLines = doc.splitTextToSize(notes, RECEIPT_WIDTH);
    doc.text(noteLines, RECEIPT_LEFT, y);
    y += noteLines.length * 3.6 + 3;
  }

  drawReceiptDivider(doc, y);
  y += 7;

  // --- Thank you & tagline -------------------------------------------------
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('THANK YOU!', RECEIPT_CENTER, y, { align: 'center' });
  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(110, 110, 110);
  doc.text('Come back and visit us again.', RECEIPT_CENTER, y, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  y += 6;

  // --- QR + Barcode --------------------------------------------------------
  const barcodeValue = payload.invoiceNumber;
  const qrHints = new Map<EncodeHintType, unknown>([[EncodeHintType.MARGIN, 0]]);

  const qrSize = 18;
  drawBitMatrix(
    doc,
    RECEIPT_CENTER - qrSize / 2,
    y,
    qrSize,
    qrSize,
    barcodeValue,
    qrHints
  );
  y += qrSize + 4;

  drawCode128Barcode(doc, RECEIPT_LEFT + 2, y, RECEIPT_WIDTH - 4, 12, barcodeValue);
  y += 14;

  doc.setFont('courier', 'normal');
  doc.setFontSize(7);
  doc.text(barcodeValue, RECEIPT_CENTER, y, { align: 'center' });

  return doc;
};

export const downloadInvoicePdf = (payload: InvoicePayload) => {
  const doc = buildInvoicePdf(payload);
  doc.save(`${payload.invoiceNumber}.pdf`);
};

export const openInvoicePdf = (payload: InvoicePayload) => {
  const doc = buildInvoicePdf(payload);
  const blobUrl = doc.output('bloburl');
  window.open(blobUrl, '_blank', 'noopener,noreferrer');
};

export const printReceiptPdf = (payload: InvoicePayload) => {
  const doc = buildReceiptPdf(payload);
  const blob = doc.output('blob');
  const blobUrl = URL.createObjectURL(blob);
  const iframe = document.createElement('iframe');

  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.setAttribute('aria-hidden', 'true');
  iframe.src = blobUrl;

  const cleanup = () => {
    window.setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
      iframe.remove();
    }, 1000);
  };

  iframe.onload = () => {
    const frameWindow = iframe.contentWindow;
    if (!frameWindow) {
      cleanup();
      return;
    }

    frameWindow.focus();
    frameWindow.print();
    cleanup();
  };

  document.body.appendChild(iframe);
};
