import jsPDF from 'jspdf';

export const moonPdfColors = {
  ink: [24, 24, 39] as const,
  slate: [91, 104, 126] as const,
  border: [223, 226, 235] as const,
  paper: [250, 248, 255] as const,
  panel: [245, 240, 255] as const,
  accent: [123, 58, 237] as const,
  accentDark: [91, 33, 182] as const,
  emerald: [22, 163, 74] as const,
  amber: [217, 119, 6] as const,
  red: [220, 38, 38] as const,
  blue: [37, 99, 235] as const,
};

export const createMoonPdf = () => new jsPDF({ unit: 'mm', format: 'a4' });

export const drawMoonHeader = (
  doc: jsPDF,
  title: string,
  rightLabel: string,
  subtitle?: string
) => {
  doc.setFillColor(...moonPdfColors.ink);
  doc.rect(0, 0, 210, 34, 'F');
  doc.setFillColor(...moonPdfColors.accent);
  doc.rect(0, 34, 210, 4, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(23);
  doc.text(title, 14, 20);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(rightLabel, 196, 20, { align: 'right' });

  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(subtitle, 14, 29);
  }

  doc.setTextColor(...moonPdfColors.ink);
  return 46;
};

export const drawMoonSectionTitle = (doc: jsPDF, title: string, y: number) => {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...moonPdfColors.ink);
  doc.text(title, 14, y);
  return y + 4;
};

export const drawMoonMetaGrid = (
  doc: jsPDF,
  leftLines: string[],
  rightLines: string[],
  startY: number
) => {
  const rowHeight = 7;
  const boxHeight = Math.max(leftLines.length, rightLines.length) * rowHeight + 10;

  doc.setDrawColor(...moonPdfColors.border);
  doc.setFillColor(...moonPdfColors.paper);
  doc.roundedRect(14, startY, 182, boxHeight, 4, 4, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(...moonPdfColors.ink);

  leftLines.forEach((line, index) => {
    doc.text(line, 20, startY + 8 + rowHeight * index);
  });

  rightLines.forEach((line, index) => {
    doc.text(line, 112, startY + 8 + rowHeight * index);
  });

  return startY + boxHeight + 8;
};

export const drawMoonStatStrip = (
  doc: jsPDF,
  stats: Array<{ label: string; value: string; tone?: 'default' | 'accent' | 'good' | 'warn' | 'danger' }>,
  startY: number
) => {
  const gap = 4;
  const width = (182 - gap * (stats.length - 1)) / stats.length;
  const height = 22;

  stats.forEach((stat, index) => {
    const x = 14 + index * (width + gap);
    const fill: readonly [number, number, number] =
      stat.tone === 'accent'
        ? moonPdfColors.panel
        : stat.tone === 'good'
          ? [236, 253, 245]
          : stat.tone === 'warn'
            ? [255, 247, 237]
            : stat.tone === 'danger'
              ? [254, 242, 242]
              : [255, 255, 255];

    doc.setDrawColor(...moonPdfColors.border);
    doc.setFillColor(fill[0], fill[1], fill[2]);
    doc.roundedRect(x, startY, width, height, 3, 3, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...moonPdfColors.slate);
    doc.text(stat.label, x + 4, startY + 7);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...moonPdfColors.ink);
    doc.text(stat.value, x + 4, startY + 15);
  });

  return startY + height + 8;
};

export const drawMoonNotesBox = (doc: jsPDF, notes: string, startY: number) => {
  const lines = doc.splitTextToSize(notes, 174);
  const height = Math.max(18, lines.length * 5 + 10);

  doc.setDrawColor(...moonPdfColors.border);
  doc.setFillColor(...moonPdfColors.paper);
  doc.roundedRect(14, startY, 182, height, 4, 4, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...moonPdfColors.ink);
  doc.text('Notes', 20, startY + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...moonPdfColors.slate);
  doc.text(lines, 20, startY + 15);

  return startY + height + 8;
};

export const moonTableTheme = {
  headStyles: {
    fillColor: [...moonPdfColors.ink] as [number, number, number],
    textColor: [255, 255, 255] as [number, number, number],
    fontStyle: 'bold' as const,
    fontSize: 9,
  },
  bodyStyles: {
    textColor: [...moonPdfColors.ink] as [number, number, number],
    fontSize: 9,
    cellPadding: 3,
    lineColor: [...moonPdfColors.border] as [number, number, number],
    lineWidth: 0.2,
  },
  alternateRowStyles: {
    fillColor: [251, 250, 255] as [number, number, number],
  },
  margin: { left: 14, right: 14 },
};
