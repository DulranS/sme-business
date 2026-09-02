import { getAdminDb, requireAiContext } from "@/lib/firebaseAdmin";
import { expenseToRecurring, generateAndSaveRecurringTransactions } from "@/lib/recurringTransactions";
import type { Expense } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const ctx = await requireAiContext(req);
    const { db, businessId } = ctx;

    const body = await req.json();
    const targetDate = body.date || new Date().toISOString().split('T')[0];

    // Fetch all recurring expenses
    const expensesSnap = await db
      .collection(`users/${businessId}/expenses`)
      .where("isRecurring", "==", true)
      .where("recurrence", "!=", "none")
      .get();

    const expenses = expensesSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Expense[];
    const recurringTransactions = expenses.map(e => expenseToRecurring(e));

    // Generate and save due transactions
    const result = await generateAndSaveRecurringTransactions(
      db,
      businessId,
      recurringTransactions,
      targetDate
    );

    return Response.json({
      success: true,
      generated: result.generated,
      errors: result.errors,
      targetDate,
    });
  } catch (err) {
    console.error("Recurring transaction generation error:", err);
    return Response.json({ error: "Failed to generate recurring transactions" }, { status: 500 });
  }
}
