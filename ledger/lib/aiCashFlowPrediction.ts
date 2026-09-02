// AI cash flow predictions
import type { Sale, Expense, Purchase, Settings } from "./types";

export interface CashFlowPrediction {
  date: string;
  projectedInflow: number;
  projectedOutflow: number;
  netCashFlow: number;
  cumulativeBalance: number;
}

export interface CashFlowForecast {
  predictions: CashFlowPrediction[];
  startingBalance: number;
  endingBalance: number;
  averageMonthlyCashFlow: number;
  riskLevel: "low" | "medium" | "high";
  recommendations: string[];
}

/**
 * Calculate average monthly revenue from sales
 */
function calculateAverageMonthlyRevenue(sales: Sale[]): number {
  if (sales.length === 0) return 0;
  
  const monthlyTotals = new Map<string, number>();
  sales.forEach(sale => {
    const month = sale.date.substring(0, 7); // YYYY-MM
    const amount = sale.qty * sale.unitPrice;
    monthlyTotals.set(month, (monthlyTotals.get(month) || 0) + amount);
  });

  const totals = Array.from(monthlyTotals.values());
  return totals.reduce((sum, val) => sum + val, 0) / totals.length;
}

/**
 * Calculate average monthly expenses
 */
function calculateAverageMonthlyExpenses(
  expenses: Expense[],
  purchases: Purchase[]
): number {
  let total = 0;
  let months = new Set<string>();

  expenses.forEach(expense => {
    if (expense.isRecurring) {
      const month = expense.startDate.substring(0, 7);
      months.add(month);
      total += expense.amount;
    }
  });

  purchases.forEach(purchase => {
    const month = purchase.date.substring(0, 7);
    months.add(month);
    total += purchase.qty * purchase.unitCost;
  });

  return months.size > 0 ? total / months.size : 0;
}

/**
 * Generate cash flow predictions for future months
 */
export function generateCashFlowForecast(
  sales: Sale[],
  expenses: Expense[],
  purchases: Purchase[],
  settings: Settings,
  months: number = 3
): CashFlowForecast {
  const avgRevenue = calculateAverageMonthlyRevenue(sales);
  const avgExpenses = calculateAverageMonthlyExpenses(expenses, purchases);
  const avgNetCashFlow = avgRevenue - avgExpenses;

  const predictions: CashFlowPrediction[] = [];
  let cumulativeBalance = 0;
  const startDate = new Date();

  for (let i = 1; i <= months; i++) {
    const predictionDate = new Date(startDate);
    predictionDate.setMonth(predictionDate.getMonth() + i);
    const dateStr = predictionDate.toISOString().split('T')[0];

    // Add some randomness to simulate real-world variation
    const revenueVariation = 0.9 + Math.random() * 0.2; // ±10%
    const expenseVariation = 0.9 + Math.random() * 0.2; // ±10%

    const projectedInflow = avgRevenue * revenueVariation;
    const projectedOutflow = avgExpenses * expenseVariation;
    const netCashFlow = projectedInflow - projectedOutflow;
    cumulativeBalance += netCashFlow;

    predictions.push({
      date: dateStr,
      projectedInflow,
      projectedOutflow,
      netCashFlow,
      cumulativeBalance,
    });
  }

  // Determine risk level
  const endingBalance = cumulativeBalance;
  const rentAmount = settings.rentAmount || 0;
  const riskLevel = endingBalance < rentAmount * 2 ? "high" : endingBalance < rentAmount * 4 ? "medium" : "low";

  // Generate recommendations
  const recommendations: string[] = [];
  if (riskLevel === "high") {
    recommendations.push("Cash flow is tight. Consider delaying non-essential purchases.");
    recommendations.push("Follow up on overdue receivables immediately.");
  } else if (riskLevel === "medium") {
    recommendations.push("Monitor cash flow closely over the next few months.");
    recommendations.push("Build a small cash buffer if possible.");
  } else {
    recommendations.push("Cash flow looks healthy. Consider investing in growth.");
  }

  if (avgNetCashFlow < 0) {
    recommendations.push("Average monthly cash flow is negative. Review expenses and pricing.");
  }

  return {
    predictions,
    startingBalance: 0,
    endingBalance,
    averageMonthlyCashFlow: avgNetCashFlow,
    riskLevel,
    recommendations,
  };
}
