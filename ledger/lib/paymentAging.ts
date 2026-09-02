// Payment tracking and aging for accounts receivable and payable
import type { Sale, Purchase, ReceivablePayment, PayablePayment } from "./types";

export interface AgingBucket {
  label: string;
  days: number;
  amount: number;
  count: number;
}

export interface ReceivableAging {
  saleId: string;
  customerName?: string;
  customerContact?: string;
  invoiceDate: string;
  dueDate: string;
  totalAmount: number;
  amountPaid: number;
  balance: number;
  daysOverdue: number;
  status: "current" | "overdue" | "critical";
}

export interface PayableAging {
  purchaseId: string;
  supplier?: string;
  invoiceDate: string;
  dueDate: string;
  totalAmount: number;
  amountPaid: number;
  balance: number;
  daysOverdue: number;
  status: "current" | "overdue" | "critical";
}

export interface AgingReport {
  totalOutstanding: number;
  totalOverdue: number;
  totalCritical: number;
  buckets: AgingBucket[];
  receivables: ReceivableAging[];
  payables: PayableAging[];
}

/**
 * Calculate days overdue for a date
 */
function calculateDaysOverdue(dueDate: string): number {
  const today = new Date();
  const due = new Date(dueDate);
  const diffTime = today.getTime() - due.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Get aging bucket for days overdue
 */
function getAgingBucket(daysOverdue: number): string {
  if (daysOverdue <= 0) return "0-30 days (current)";
  if (daysOverdue <= 30) return "1-30 days overdue";
  if (daysOverdue <= 60) return "31-60 days overdue";
  if (daysOverdue <= 90) return "61-90 days overdue";
  return "90+ days overdue";
}

/**
 * Get status based on days overdue
 */
function getStatus(daysOverdue: number): "current" | "overdue" | "critical" {
  if (daysOverdue <= 0) return "current";
  if (daysOverdue <= 60) return "overdue";
  return "critical";
}

/**
 * Calculate receivable aging for a sale
 */
export function calculateReceivableAging(
  sale: Sale,
  payments: ReceivablePayment[]
): ReceivableAging {
  const salePayments = payments.filter(p => p.saleId === sale.id);
  const amountPaid = salePayments.reduce((sum, p) => sum + p.amount, 0);
  const totalAmount = sale.qty * sale.unitPrice;
  const balance = totalAmount - amountPaid;
  const dueDate = sale.dueDate || sale.date;
  const daysOverdue = calculateDaysOverdue(dueDate);

  return {
    saleId: sale.id,
    customerName: sale.customer,
    customerContact: sale.customerContact,
    invoiceDate: sale.date,
    dueDate,
    totalAmount,
    amountPaid,
    balance,
    daysOverdue,
    status: getStatus(daysOverdue),
  };
}

/**
 * Calculate payable aging for a purchase
 */
export function calculatePayableAging(
  purchase: Purchase,
  payments: PayablePayment[]
): PayableAging {
  const purchasePayments = payments.filter(p => p.purchaseId === purchase.id);
  const amountPaid = purchasePayments.reduce((sum, p) => sum + p.amount, 0);
  const totalAmount = purchase.qty * purchase.unitCost;
  const balance = totalAmount - amountPaid;
  const dueDate = purchase.dueDate || purchase.date;
  const daysOverdue = calculateDaysOverdue(dueDate);

  return {
    purchaseId: purchase.id,
    supplier: purchase.supplier,
    invoiceDate: purchase.date,
    dueDate,
    totalAmount,
    amountPaid,
    balance,
    daysOverdue,
    status: getStatus(daysOverdue),
  };
}

/**
 * Generate aging buckets from a list of aging records
 */
function generateAgingBuckets(records: { daysOverdue: number; balance: number }[]): AgingBucket[] {
  const buckets: Map<string, { amount: number; count: number }> = new Map([
    ["0-30 days (current)", { amount: 0, count: 0 }],
    ["1-30 days overdue", { amount: 0, count: 0 }],
    ["31-60 days overdue", { amount: 0, count: 0 }],
    ["61-90 days overdue", { amount: 0, count: 0 }],
    ["90+ days overdue", { amount: 0, count: 0 }],
  ]);

  records.forEach(record => {
    const bucketLabel = getAgingBucket(record.daysOverdue);
    const bucket = buckets.get(bucketLabel);
    if (bucket) {
      bucket.amount += record.balance;
      bucket.count += 1;
    }
  });

  return Array.from(buckets.entries()).map(([label, data]) => ({
    label,
    days: 0, // Not used in display
    amount: data.amount,
    count: data.count,
  }));
}

/**
 * Generate complete aging report
 */
export function generateAgingReport(
  sales: Sale[],
  purchases: Purchase[],
  receivablePayments: ReceivablePayment[],
  payablePayments: PayablePayment[]
): AgingReport {
  // Filter for credit sales only
  const creditSales = sales.filter(s => s.paymentMethod === "credit");
  const creditPurchases = purchases.filter(p => p.paymentMethod === "credit");

  // Calculate aging for receivables
  const receivables = creditSales
    .map(sale => calculateReceivableAging(sale, receivablePayments))
    .filter(r => r.balance > 0);

  // Calculate aging for payables
  const payables = creditPurchases
    .map(purchase => calculatePayableAging(purchase, payablePayments))
    .filter(p => p.balance > 0);

  // Generate buckets
  const receivableBuckets = generateAgingBuckets(receivables);
  const payableBuckets = generateAgingBuckets(payables);

  // Calculate totals
  const totalOutstanding = receivables.reduce((sum, r) => sum + r.balance, 0);
  const totalOverdue = receivables.filter(r => r.daysOverdue > 0).reduce((sum, r) => sum + r.balance, 0);
  const totalCritical = receivables.filter(r => r.status === "critical").reduce((sum, r) => sum + r.balance, 0);

  return {
    totalOutstanding,
    totalOverdue,
    totalCritical,
    buckets: receivableBuckets,
    receivables,
    payables,
  };
}

/**
 * Get overdue alerts for receivables
 */
export function getOverdueAlerts(receivables: ReceivableAging[]): ReceivableAging[] {
  return receivables
    .filter(r => r.daysOverdue > 0)
    .sort((a, b) => b.daysOverdue - a.daysOverdue);
}
