export const resolveOrderFinancials = (row: {
  subtotal?: number | string | null;
  commission_amount?: number | string | null;
  total_amount?: number | string | null;
  net_subtotal?: number | string | null;
  net_commission_amount?: number | string | null;
  net_total_amount?: number | string | null;
  has_return?: boolean | null;
  return_status?: string | null;
}) => {
  const subtotal = Number(row.subtotal ?? 0);
  const commissionAmount = Number(row.commission_amount ?? 0);
  const totalAmount = Number(row.total_amount ?? 0);
  const hasReturn = Boolean(row.has_return) || row.return_status === 'partial' || row.return_status === 'full';

  return {
    netSubtotal: hasReturn ? Number(row.net_subtotal ?? subtotal) : subtotal,
    netCommissionAmount: hasReturn ? Number(row.net_commission_amount ?? commissionAmount) : commissionAmount,
    netTotalAmount: hasReturn ? Number(row.net_total_amount ?? totalAmount) : totalAmount,
  };
};
