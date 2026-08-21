import type {
  Notification,
  NotificationType,
  NotificationPriority,
  Product,
  Expense,
  Loan,
} from "./types";
import type { ReceivableLine, PayableLine, ProductLedgerResult, ProjectBudgetAlert } from "./calculations";
import { todayIso } from "./format";

/**
 * Notification automation hooks for business events.
 * These functions generate notifications based on business state changes.
 * They're designed to be called from the frontend when data changes,
 * providing a pull-based notification system without requiring backend jobs.
 */

// Helper function to calculate days between two ISO dates
function daysBetween(fromIso: string, toIso: string): number {
  const [fy, fm, fd] = fromIso.split("-").map(Number);
  const [ty, tm, td] = toIso.split("-").map(Number);
  const from = Date.UTC(fy, fm - 1, fd);
  const to = Date.UTC(ty, tm - 1, td);
  return Math.round((to - from) / (1000 * 60 * 60 * 24));
}

const PRIORITY_FOR_DAYS_OVERDUE: Record<number, NotificationPriority> = {
  0: "low",      // Not yet due
  1: "low",      // 1 day overdue
  7: "medium",   // 1 week overdue
  14: "medium",  // 2 weeks overdue
  30: "high",    // 1 month overdue
  60: "high",    // 2+ months overdue
};

function getPriorityForDaysOverdue(daysOverdue: number): NotificationPriority {
  if (daysOverdue <= 0) return "low";
  if (daysOverdue <= 1) return "low";
  if (daysOverdue <= 7) return "medium";
  if (daysOverdue <= 14) return "medium";
  if (daysOverdue <= 30) return "high";
  return "high";
}

/**
 * Generate notifications for overdue receivables
 */
export function generateReceivableNotifications(
  receivables: ReceivableLine[]
): Omit<Notification, "id" | "createdAt">[] {
  const notifications: Omit<Notification, "id" | "createdAt">[] = [];
  const today = todayIso();

  for (const r of receivables) {
    const daysOverdue = daysBetween(r.dueDate, today);
    const priority = getPriorityForDaysOverdue(daysOverdue);

    // Only create notifications for items that are overdue or due soon
    if (daysOverdue <= -7) continue; // Not due for 7+ days

    const type: NotificationType = daysOverdue > 0 ? "receivable_overdue" : "receivable_due_soon";
    const title = daysOverdue > 0
      ? `Overdue payment from ${r.customer}`
      : `Payment due from ${r.customer}`;

    const message = daysOverdue > 0
      ? `${r.productName} - ${r.amountOutstanding.toLocaleString()} overdue by ${daysOverdue} day${daysOverdue !== 1 ? "s" : ""}`
      : `${r.productName} - ${r.amountOutstanding.toLocaleString()} due in ${Math.abs(daysOverdue)} day${Math.abs(daysOverdue) !== 1 ? "s" : ""}`;

    notifications.push({
      type,
      priority,
      title,
      message,
      entityId: r.saleId,
      entityType: "sale",
      dueDate: r.dueDate,
      isRead: false,
    });
  }

  return notifications;
}

/**
 * Generate notifications for overdue payables
 */
export function generatePayableNotifications(
  payables: PayableLine[]
): Omit<Notification, "id" | "createdAt">[] {
  const notifications: Omit<Notification, "id" | "createdAt">[] = [];
  const today = todayIso();

  for (const p of payables) {
    const daysOverdue = daysBetween(p.dueDate, today);
    const priority = getPriorityForDaysOverdue(daysOverdue);

    // Only create notifications for items that are overdue or due soon
    if (daysOverdue <= -7) continue; // Not due for 7+ days

    const type: NotificationType = daysOverdue > 0 ? "payable_overdue" : "payable_due_soon";
    const title = daysOverdue > 0
      ? `Overdue payment to ${p.supplier}`
      : `Payment due to ${p.supplier}`;

    const message = daysOverdue > 0
      ? `${p.productName} - ${p.amountOutstanding.toLocaleString()} overdue by ${daysOverdue} day${daysOverdue !== 1 ? "s" : ""}`
      : `${p.productName} - ${p.amountOutstanding.toLocaleString()} due in ${Math.abs(daysOverdue)} day${Math.abs(daysOverdue) !== 1 ? "s" : ""}`;

    notifications.push({
      type,
      priority,
      title,
      message,
      entityId: p.purchaseId,
      entityType: "purchase",
      dueDate: p.dueDate,
      isRead: false,
    });
  }

  return notifications;
}

/**
 * Generate notifications for low stock items
 */
export function generateLowStockNotifications(
  products: Product[],
  ledgers: Map<string, ProductLedgerResult>,
  eoqByProduct: Map<string, { eoq: number }>,
  lowStockThreshold: number = 5
): Omit<Notification, "id" | "createdAt">[] {
  const notifications: Omit<Notification, "id" | "createdAt">[] = [];

  for (const product of products) {
    const ledger = ledgers.get(product.id);
    const qtyOnHand = ledger?.qtyOnHand || 0;

    if (qtyOnHand <= lowStockThreshold) {
      const eoq = eoqByProduct.get(product.id)?.eoq || 0;
      const priority = qtyOnHand === 0 ? "high" : "medium";

      notifications.push({
        type: "low_stock",
        priority,
        title: `Low stock: ${product.name}`,
        message: `Only ${qtyOnHand} unit${qtyOnHand !== 1 ? "s" : ""} remaining. Suggested reorder: ${eoq} units.`,
        entityId: product.id,
        entityType: "product",
        isRead: false,
      });
    }
  }

  return notifications;
}

/**
 * Generate notifications for due expenses
 */
export function generateExpenseNotifications(
  expenses: Expense[]
): Omit<Notification, "id" | "createdAt">[] {
  const notifications: Omit<Notification, "id" | "createdAt">[] = [];
  const today = todayIso();

  for (const expense of expenses) {
    if (!expense.isRecurring || expense.recurrence === "none") continue;
    if (expense.endDate && today > expense.endDate) continue;

    // Check if expense is due within the next 7 days
    const daysUntilDue = daysBetween(today, expense.startDate);
    if (daysUntilDue > 7 || daysUntilDue < 0) continue;

    const priority = daysUntilDue <= 1 ? "high" : "medium";

    notifications.push({
      type: "expense_due",
      priority,
      title: `Expense due: ${expense.name}`,
      message: `${expense.amount.toLocaleString()} due in ${daysUntilDue} day${daysUntilDue !== 1 ? "s" : ""}`,
      entityId: expense.id,
      entityType: "expense",
      dueDate: expense.startDate,
      isRead: false,
    });
  }

  return notifications;
}

/**
 * Generate notifications for loan payments
 */
export function generateLoanNotifications(
  loans: Loan[]
): Omit<Notification, "id" | "createdAt">[] {
  const notifications: Omit<Notification, "id" | "createdAt">[] = [];
  const today = todayIso();

  for (const loan of loans) {
    if (!loan.active) continue;

    // Calculate next payment date (simplified - in production you'd use computeLoanSchedule)
    const daysUntilDue = daysBetween(today, loan.startDate);
    if (daysUntilDue > 7 || daysUntilDue < 0) continue;

    const priority = daysUntilDue <= 1 ? "high" : "medium";

    notifications.push({
      type: "loan_payment_due",
      priority,
      title: `Loan payment due: ${loan.name}`,
      message: `Payment due in ${daysUntilDue} day${daysUntilDue !== 1 ? "s" : ""}`,
      entityId: loan.id,
      entityType: "loan",
      dueDate: loan.startDate,
      isRead: false,
    });
  }

  return notifications;
}

/**
 * Generate notifications for projects approaching or past their quoted
 * budget. `computeProjectBudgetAlerts` (lib/calculations.ts) already does
 * the filtering/threshold work — this just turns each alert into a
 * notification, medium priority while still under 100% (a heads-up) and
 * high once actual cost has passed the quote (already losing money).
 */
export function generateProjectBudgetNotifications(
  alerts: ProjectBudgetAlert[]
): Omit<Notification, "id" | "createdAt">[] {
  return alerts.map((a) => ({
    type: "project_over_budget" as NotificationType,
    priority: (a.isOverBudget ? "high" : "medium") as NotificationPriority,
    title: a.isOverBudget ? `Over budget: ${a.name}` : `Approaching budget: ${a.name}`,
    message: a.isOverBudget
      ? `Actual cost ${a.totalCost.toLocaleString()} has passed the quoted price of ${a.quotedPrice.toLocaleString()} (${a.budgetUsedPct.toFixed(0)}% used).`
      : `Actual cost ${a.totalCost.toLocaleString()} is at ${a.budgetUsedPct.toFixed(0)}% of the quoted price ${a.quotedPrice.toLocaleString()}.`,
    entityId: a.projectId,
    entityType: "project",
    isRead: false,
  }));
}

/**
 * Generate all notifications based on current business state
 * This is the main entry point for notification automation
 */
export function generateAllNotifications(params: {
  receivables: ReceivableLine[];
  payables: PayableLine[];
  products: Product[];
  ledgers: Map<string, ProductLedgerResult>;
  eoqByProduct: Map<string, { eoq: number }>;
  expenses: Expense[];
  loans: Loan[];
  projectBudgetAlerts: ProjectBudgetAlert[];
}): Omit<Notification, "id" | "createdAt">[] {
  const { receivables, payables, products, ledgers, eoqByProduct, expenses, loans, projectBudgetAlerts } = params;

  return [
    ...generateReceivableNotifications(receivables),
    ...generatePayableNotifications(payables),
    ...generateLowStockNotifications(products, ledgers, eoqByProduct),
    ...generateExpenseNotifications(expenses),
    ...generateLoanNotifications(loans),
    ...generateProjectBudgetNotifications(projectBudgetAlerts),
  ];
}
