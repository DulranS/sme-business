// Recurring transaction automation
import type { Expense, Recurrence } from "./types";

export interface RecurringTransaction {
  id: string;
  name: string;
  amount: number;
  category: string;
  kind: "expense" | "revenue";
  recurrence: Recurrence;
  startDate: string;
  endDate?: string;
  lastGeneratedDate?: string;
  nextDueDate: string;
}

export interface GeneratedTransaction {
  originalRecurringId: string;
  name: string;
  amount: number;
  category: string;
  kind: "expense" | "revenue";
  date: string;
}

/**
 * Calculate the next due date for a recurring transaction
 */
export function calculateNextDueDate(
  recurrence: Recurrence,
  lastDate: string
): string {
  const date = new Date(lastDate);
  
  switch (recurrence) {
    case "weekly":
      date.setDate(date.getDate() + 7);
      break;
    case "monthly":
      date.setMonth(date.getMonth() + 1);
      break;
    case "yearly":
      date.setFullYear(date.getFullYear() + 1);
      break;
    default:
      return lastDate;
  }
  
  return date.toISOString().split('T')[0];
}

/**
 * Generate transactions that are due for a given date range
 */
export function generateDueTransactions(
  recurringTransactions: RecurringTransaction[],
  startDate: string,
  endDate: string
): GeneratedTransaction[] {
  const generated: GeneratedTransaction[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  for (const rt of recurringTransactions) {
    // Skip if ended before start date
    if (rt.endDate && rt.endDate < startDate) continue;
    
    // Skip if recurrence is none
    if (rt.recurrence === "none") continue;

    let currentDate = new Date(rt.lastGeneratedDate || rt.startDate);
    
    // Advance to first date within range
    while (currentDate < start) {
      currentDate = new Date(calculateNextDueDate(rt.recurrence, currentDate.toISOString().split('T')[0]));
    }

    // Generate all occurrences within range
    while (currentDate <= end) {
      if (rt.endDate && currentDate > new Date(rt.endDate)) break;

      generated.push({
        originalRecurringId: rt.id,
        name: rt.name,
        amount: rt.amount,
        category: rt.category,
        kind: rt.kind,
        date: currentDate.toISOString().split('T')[0],
      });

      currentDate = new Date(calculateNextDueDate(rt.recurrence, currentDate.toISOString().split('T')[0]));
    }
  }

  return generated;
}

/**
 * Convert Expense to RecurringTransaction format
 */
export function expenseToRecurring(expense: Expense): RecurringTransaction {
  return {
    id: expense.id,
    name: expense.name,
    amount: expense.amount,
    category: expense.category,
    kind: expense.kind,
    recurrence: expense.recurrence,
    startDate: expense.startDate,
    endDate: expense.endDate,
    lastGeneratedDate: expense.startDate, // Assume generated on start date initially
    nextDueDate: calculateNextDueDate(expense.recurrence, expense.startDate),
  };
}

/**
 * Generate and save recurring transactions to Firestore
 */
export async function generateAndSaveRecurringTransactions(
  db: any,
  businessId: string,
  recurringTransactions: RecurringTransaction[],
  targetDate: string
): Promise<{ generated: number; errors: string[] }> {
  const generated: GeneratedTransaction[] = generateDueTransactions(
    recurringTransactions,
    targetDate,
    targetDate
  );

  const batch = db.batch();
  let count = 0;
  const errors: string[] = [];

  for (const gt of generated) {
    try {
      const ref = db.collection(`users/${businessId}/expenses`).doc();
      batch.set(ref, {
        name: gt.name,
        amount: gt.amount,
        category: gt.category,
        kind: gt.kind,
        isRecurring: false, // Generated instance is not recurring itself
        recurrence: "none",
        startDate: gt.date,
        createdAt: Date.now(),
      });
      count++;

      // Update lastGeneratedDate for the recurring transaction
      const rtRef = db.doc(`users/${businessId}/expenses/${gt.originalRecurringId}`);
      batch.update(rtRef, { lastGeneratedDate: gt.date });
    } catch (err) {
      errors.push(`Failed to generate ${gt.name}: ${err}`);
    }
  }

  if (count > 0) {
    await batch.commit();
  }

  return { generated: count, errors };
}
