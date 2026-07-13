const formatAmount = (value: number) => {
  const safe = Number.isFinite(value) ? value : 0;
  const [intPart, decPart] = Math.abs(safe).toFixed(2).split('.');
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const signed = safe < 0 ? `-${withThousands}` : withThousands;
  return `${signed}.${decPart}`;
};

// UI display: Arabic pound symbol, safe inside the RTL app.
export const formatEGP = (value: number) => `${formatAmount(value)} ج.م`;

// PDF display: helvetica can't render Arabic, so we use the Latin "EGP" mark
// (same as the Egyptian Pound ISO code) to keep receipts and invoices legible.
export const formatEGPForPdf = (value: number) => `${formatAmount(value)} EGP`;
