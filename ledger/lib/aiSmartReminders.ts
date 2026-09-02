// AI smart reminders for overdue payments and other business events
import type { Sale, Purchase, ReceivablePayment, PayablePayment } from "./types";

export interface Reminder {
  id: string;
  type: "overdue_receivable" | "overdue_payable" | "low_stock" | "recurring_due";
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  entityId: string;
  entityName?: string;
  amount?: number;
  daysOverdue?: number;
  actionUrl?: string;
}

/**
 * Generate reminders for overdue receivables
 */
export function generateReceivableReminders(
  sales: Sale[],
  payments: ReceivablePayment[]
): Reminder[] {
  const reminders: Reminder[] = [];
  const today = new Date();

  sales
    .filter(s => s.paymentMethod === "credit")
    .forEach(sale => {
      const salePayments = payments.filter(p => p.saleId === sale.id);
      const amountPaid = salePayments.reduce((sum, p) => sum + p.amount, 0);
      const totalAmount = sale.qty * sale.unitPrice;
      const balance = totalAmount - amountPaid;

      if (balance > 0) {
        const dueDate = sale.dueDate || sale.date;
        const due = new Date(dueDate);
        const daysOverdue = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));

        if (daysOverdue > 0) {
          reminders.push({
            id: `receivable-${sale.id}`,
            type: "overdue_receivable",
            title: `Overdue payment from ${sale.customer || "customer"}`,
            description: `${sale.customer || "Customer"} owes ${balance.toFixed(2)} - ${daysOverdue} days overdue`,
            priority: daysOverdue > 60 ? "high" : daysOverdue > 30 ? "medium" : "low",
            entityId: sale.id,
            entityName: sale.customer,
            amount: balance,
            daysOverdue,
            actionUrl: `/receivables`,
          });
        }
      }
    });

  return reminders;
}

/**
 * Generate reminders for overdue payables
 */
export function generatePayableReminders(
  purchases: Purchase[],
  payments: PayablePayment[]
): Reminder[] {
  const reminders: Reminder[] = [];
  const today = new Date();

  purchases
    .filter(p => p.paymentMethod === "credit")
    .forEach(purchase => {
      const purchasePayments = payments.filter(p => p.purchaseId === purchase.id);
      const amountPaid = purchasePayments.reduce((sum, p) => sum + p.amount, 0);
      const totalAmount = purchase.qty * purchase.unitCost;
      const balance = totalAmount - amountPaid;

      if (balance > 0) {
        const dueDate = purchase.dueDate || purchase.date;
        const due = new Date(dueDate);
        const daysOverdue = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));

        if (daysOverdue > 0) {
          reminders.push({
            id: `payable-${purchase.id}`,
            type: "overdue_payable",
            title: `Overdue payment to ${purchase.supplier || "supplier"}`,
            description: `Pay ${purchase.supplier || "supplier"} ${balance.toFixed(2)} - ${daysOverdue} days overdue`,
            priority: daysOverdue > 60 ? "high" : daysOverdue > 30 ? "medium" : "low",
            entityId: purchase.id,
            entityName: purchase.supplier,
            amount: balance,
            daysOverdue,
            actionUrl: `/payables`,
          });
        }
      }
    });

  return reminders;
}

/**
 * Generate all smart reminders
 */
export function generateSmartReminders(
  sales: Sale[],
  purchases: Purchase[],
  receivablePayments: ReceivablePayment[],
  payablePayments: PayablePayment[]
): Reminder[] {
  const receivableReminders = generateReceivableReminders(sales, receivablePayments);
  const payableReminders = generatePayableReminders(purchases, payablePayments);

  return [...receivableReminders, ...payableReminders].sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}
