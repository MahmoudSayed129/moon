import jsPDF from 'jspdf';
import { RAVIN_LOGO_LIGHT_PNG, RAVIN_LOGO_RATIO } from './ravin-logo';

export const ravinPdfColors = {
  ink: [17, 17, 17] as const,
  slate: [102, 102, 102] as const,
  border: [226, 226, 226] as const,
  paper: [250, 250, 250] as const,
  panel: [255, 244, 240] as const,
  accent: [255, 51, 0] as const,
  accentDark: [184, 37, 0] as const,
  emerald: [22, 163, 74] as const,
  amber: [217, 119, 6] as const,
  red: [220, 38, 38] as const,
  blue: [37, 99, 235] as const,
};

export const createRavinPdf = () => new jsPDF({ unit: 'mm', format: 'a4' });

export const drawRavinHeader = (
  doc: jsPDF,
  title: string,
  rightLabel: string,
  subtitle?: string
) => {
  doc.setFillColor(...ravinPdfColors.ink);
  doc.rect(0, 0, 210, 34, 'F');
  doc.setFillColor(...ravinPdfColors.accent);
  doc.rect(0, 34, 210, 4, 'F');

  const logoHeight = 8;
  doc.addImage(RAVIN_LOGO_LIGHT_PNG, 'PNG', 14, 6, logoHeight * RAVIN_LOGO_RATIO, logoHeight, 'ravin-logo', 'FAST');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(title, 14, 23.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(rightLabel, 196, 20, { align: 'right' });

  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(subtitle, 14, 30);
  }

  doc.setTextColor(...ravinPdfColors.ink);
  return 46;
};

export const drawRavinSectionTitle = (doc: jsPDF, title: string, y: number) => {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...ravinPdfColors.ink);
  doc.text(title, 14, y);
  return y + 4;
};

export const drawRavinMetaGrid = (
  doc: jsPDF,
  leftLines: string[],
  rightLines: string[],
  startY: number
) => {
  const rowHeight = 7;
  const boxHeight = Math.max(leftLines.length, rightLines.length) * rowHeight + 10;

  doc.setDrawColor(...ravinPdfColors.border);
  doc.setFillColor(...ravinPdfColors.paper);
  doc.roundedRect(14, startY, 182, boxHeight, 4, 4, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(...ravinPdfColors.ink);

  leftLines.forEach((line, index) => {
    doc.text(line, 20, startY + 8 + rowHeight * index);
  });

  rightLines.forEach((line, index) => {
    doc.text(line, 112, startY + 8 + rowHeight * index);
  });

  return startY + boxHeight + 8;
};

export const drawRavinStatStrip = (
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
        ? ravinPdfColors.panel
        : stat.tone === 'good'
          ? [236, 253, 245]
          : stat.tone === 'warn'
            ? [255, 247, 237]
            : stat.tone === 'danger'
              ? [254, 242, 242]
              : [255, 255, 255];

    doc.setDrawColor(...ravinPdfColors.border);
    doc.setFillColor(fill[0], fill[1], fill[2]);
    doc.roundedRect(x, startY, width, height, 3, 3, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...ravinPdfColors.slate);
    doc.text(stat.label, x + 4, startY + 7);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...ravinPdfColors.ink);
    doc.text(stat.value, x + 4, startY + 15);
  });

  return startY + height + 8;
};

export const drawRavinNotesBox = (doc: jsPDF, notes: string, startY: number) => {
  const lines = doc.splitTextToSize(notes, 174);
  const height = Math.max(18, lines.length * 5 + 10);

  doc.setDrawColor(...ravinPdfColors.border);
  doc.setFillColor(...ravinPdfColors.paper);
  doc.roundedRect(14, startY, 182, height, 4, 4, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...ravinPdfColors.ink);
  doc.text('Notes', 20, startY + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...ravinPdfColors.slate);
  doc.text(lines, 20, startY + 15);

  return startY + height + 8;
};

export const ravinTableTheme = {
  headStyles: {
    fillColor: [...ravinPdfColors.ink] as [number, number, number],
    textColor: [255, 255, 255] as [number, number, number],
    fontStyle: 'bold' as const,
    fontSize: 9,
  },
  bodyStyles: {
    textColor: [...ravinPdfColors.ink] as [number, number, number],
    fontSize: 9,
    cellPadding: 3,
    lineColor: [...ravinPdfColors.border] as [number, number, number],
    lineWidth: 0.2,
  },
  alternateRowStyles: {
    fillColor: [251, 250, 255] as [number, number, number],
  },
  margin: { left: 14, right: 14 },
};
