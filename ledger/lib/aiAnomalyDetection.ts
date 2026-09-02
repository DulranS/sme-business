// AI anomaly detection for unusual spending patterns
import type { Expense, Purchase } from "./types";

export interface Anomaly {
  id: string;
  type: "expense" | "purchase";
  description: string;
  amount: number;
  date: string;
  severity: "low" | "medium" | "high";
  category?: string;
  supplier?: string;
  averageAmount: number;
  deviationPct: number;
}

export interface AnomalyReport {
  anomalies: Anomaly[];
  totalAnomalies: number;
  highSeverity: number;
  totalAnomalousAmount: number;
}

/**
 * Calculate statistics for a category
 */
function calculateCategoryStats(
  items: (Expense | Purchase)[],
  category: string
): { average: number; stdDev: number; count: number } {
  const categoryItems = items.filter(
    item => (item as Expense).category === category || (item as Purchase).supplier === category
  );
  
  if (categoryItems.length < 3) {
    return { average: 0, stdDev: 0, count: categoryItems.length };
  }

  const amounts = categoryItems.map(item => 
    (item as Expense).amount || ((item as Purchase).qty * (item as Purchase).unitCost)
  );
  
  const average = amounts.reduce((sum, amt) => sum + amt, 0) / amounts.length;
  const variance = amounts.reduce((sum, amt) => sum + Math.pow(amt - average, 2), 0) / amounts.length;
  const stdDev = Math.sqrt(variance);

  return { average, stdDev, count: amounts.length };
}

/**
 * Detect anomalies in expenses
 */
export function detectExpenseAnomalies(expenses: Expense[]): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const categories = [...new Set(expenses.map(e => e.category).filter(Boolean))];

  categories.forEach(category => {
    const stats = calculateCategoryStats(expenses, category as string);
    if (stats.count < 3) return;

    const categoryExpenses = expenses.filter(e => e.category === category);
    categoryExpenses.forEach(expense => {
      const amount = expense.amount;
      const deviation = Math.abs(amount - stats.average) / stats.average;
      
      // Flag if deviation > 2 standard deviations or > 50% from average
      if (deviation > 0.5 || Math.abs(amount - stats.average) > 2 * stats.stdDev) {
        anomalies.push({
          id: expense.id,
          type: "expense",
          description: `Unusual ${category} expense`,
          amount,
          date: expense.startDate,
          severity: deviation > 1 ? "high" : deviation > 0.75 ? "medium" : "low",
          category,
          averageAmount: stats.average,
          deviationPct: deviation * 100,
        });
      }
    });
  });

  return anomalies;
}

/**
 * Detect anomalies in purchases
 */
export function detectPurchaseAnomalies(purchases: Purchase[]): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const suppliers = [...new Set(purchases.map(p => p.supplier).filter(Boolean))];

  suppliers.forEach(supplier => {
    const stats = calculateCategoryStats(purchases, supplier as string);
    if (stats.count < 3) return;

    const supplierPurchases = purchases.filter(p => p.supplier === supplier);
    supplierPurchases.forEach(purchase => {
      const amount = purchase.qty * purchase.unitCost;
      const deviation = Math.abs(amount - stats.average) / stats.average;
      
      if (deviation > 0.5 || Math.abs(amount - stats.average) > 2 * stats.stdDev) {
        anomalies.push({
          id: purchase.id,
          type: "purchase",
          description: `Unusual purchase from ${supplier}`,
          amount,
          date: purchase.date,
          severity: deviation > 1 ? "high" : deviation > 0.75 ? "medium" : "low",
          supplier,
          averageAmount: stats.average,
          deviationPct: deviation * 100,
        });
      }
    });
  });

  return anomalies;
}

/**
 * Generate complete anomaly report
 */
export function generateAnomalyReport(
  expenses: Expense[],
  purchases: Purchase[]
): AnomalyReport {
  const expenseAnomalies = detectExpenseAnomalies(expenses);
  const purchaseAnomalies = detectPurchaseAnomalies(purchases);
  const anomalies = [...expenseAnomalies, ...purchaseAnomalies];

  return {
    anomalies,
    totalAnomalies: anomalies.length,
    highSeverity: anomalies.filter(a => a.severity === "high").length,
    totalAnomalousAmount: anomalies.reduce((sum, a) => sum + a.amount, 0),
  };
}
