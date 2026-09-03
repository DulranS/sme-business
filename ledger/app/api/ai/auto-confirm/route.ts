import { requireAiContext } from "@/lib/firebaseAdmin";
import type { ProposedEntry, ProposedSaleEntry, ProposedPurchaseEntry, ProposedExpenseEntry } from "@/lib/aiTypes";
import type { Sale, Purchase, Expense } from "@/lib/types";
import { aiErrorResponse } from "@/lib/apiError";

export const runtime = "nodejs";

interface AutoConfirmRequest {
  entries: ProposedEntry[];
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAiContext(req);
    const body = (await req.json()) as AutoConfirmRequest;
    const { entries } = body;

    if (!entries || !Array.isArray(entries)) {
      return Response.json({ error: "entries array is required" }, { status: 400 });
    }

    const { db, businessId, uid, memberName } = ctx;
    const results: { id: string; success: boolean; error?: string }[] = [];

    for (const entry of entries) {
      try {
        if (entry.kind === "sale") {
          await autoConfirmSale(db, businessId, uid, memberName, entry);
          results.push({ id: entry.id, success: true });
        } else if (entry.kind === "purchase") {
          await autoConfirmPurchase(db, businessId, uid, memberName, entry);
          results.push({ id: entry.id, success: true });
        } else if (entry.kind === "expense") {
          await autoConfirmExpense(db, businessId, uid, memberName, entry);
          results.push({ id: entry.id, success: true });
        } else {
          const unknownEntry = entry as ProposedEntry;
          results.push({ id: unknownEntry.id, success: false, error: "Unknown entry kind" });
        }
      } catch (err) {
        const errorEntry = entry as ProposedEntry;
        results.push({ 
          id: errorEntry.id, 
          success: false, 
          error: err instanceof Error ? err.message : "Unknown error" 
        });
      }
    }

    return Response.json({ results });
  } catch (err) {
    return aiErrorResponse(err, "api/ai/auto-confirm");
  }
}

async function autoConfirmSale(
  db: any,
  businessId: string,
  uid: string,
  memberName: string | null,
  entry: ProposedSaleEntry
): Promise<void> {
  if (!entry.matchedProductId) {
    throw new Error("Cannot auto-confirm sale without matched product");
  }

  const sale: Omit<Sale, "id"> = {
    productId: entry.matchedProductId,
    qty: entry.qty,
    unitPrice: entry.unitPrice,
    date: entry.date,
    customer: entry.customer,
    customerContact: undefined,
    notes: entry.notes,
    paymentMethod: entry.paymentMethod || "cash",
    creditTermDays: undefined,
    dueDate: undefined,
    currency: entry.currency,
    exchangeRate: undefined,
    foreignUnitPrice: undefined,
    createdByUid: uid,
    createdByName: memberName || undefined,
    createdAt: Date.now(),
  };

  await db.collection(`users/${businessId}/sales`).add(sale);
}

async function autoConfirmPurchase(
  db: any,
  businessId: string,
  uid: string,
  memberName: string | null,
  entry: ProposedPurchaseEntry
): Promise<void> {
  if (!entry.matchedProductId) {
    throw new Error("Cannot auto-confirm purchase without matched product");
  }

  const purchase: Omit<Purchase, "id"> = {
    productId: entry.matchedProductId,
    qty: entry.qty,
    unitCost: entry.unitCost,
    date: entry.date,
    supplier: entry.supplier,
    notes: entry.notes,
    paymentMethod: undefined,
    creditTermDays: undefined,
    dueDate: undefined,
    currency: entry.currency,
    exchangeRate: undefined,
    foreignUnitCost: undefined,
    createdAt: Date.now(),
  };

  await db.collection(`users/${businessId}/purchases`).add(purchase);
}

async function autoConfirmExpense(
  db: any,
  businessId: string,
  uid: string,
  memberName: string | null,
  entry: ProposedExpenseEntry
): Promise<void> {
  const expense: Omit<Expense, "id"> = {
    name: entry.name,
    amount: entry.amount,
    category: entry.category || "Other overhead",
    kind: "expense",
    isRecurring: entry.isRecurring,
    recurrence: "none",
    startDate: entry.date,
    endDate: undefined,
    employeeId: undefined,
    projectId: undefined,
    createdAt: Date.now(),
  };

  await db.collection(`users/${businessId}/expenses`).add(expense);
}
