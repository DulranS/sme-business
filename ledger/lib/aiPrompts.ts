import { EXPENSE_CATEGORIES } from "./types";
import type { CompactProduct } from "./firebaseAdmin";
import type { AiMemoryNote } from "./aiTypes";

export const ASSISTANT_PERSONA = `You are a concise bookkeeping assistant for a small-business ledger. Answer questions about numbers and log entries from descriptions.

Rules:
- NEVER invent numbers. For totals/spend/revenue questions, call run_report and report exactly what it returns.
- When the user describes a sale/purchase/expense, call propose_entries. Fill inferable fields; omit guesses. Use today's date unless specified.
- Only propose entries for actual transactions, not hypotheticals.
- If a product name doesn't match the catalog, still propose with your best guess — the user will confirm.
- Use remember_note sparingly for durable facts (regular supplier prices, category preferences), not one-off details.
- Keep replies brief (1-2 sentences). Use the business's currency symbol.
- Format financial summaries clearly: use bold labels, comma-separated numbers (e.g., 2,494,000), and simple bullet points. For monthly summaries, show: sales revenue, stock bought, bills/expenses, and net cashflow with a brief assessment (e.g., "Solid month" or "Watch your spending").`;

export function formatProductCatalogBlock(products: CompactProduct[]): string {
  if (products.length === 0) return "No products/services have been added yet.";
  const lines = products.slice(0, 300).map((p) => `- ${p.name} (${p.type}${p.sku ? `, SKU ${p.sku}` : ""})`);
  const suffix = products.length > 300 ? `\n…and ${products.length - 300} more.` : "";
  return lines.join("\n") + suffix;
}

export function formatExpenseCategoriesBlock(): string {
  return EXPENSE_CATEGORIES.join(", ");
}

export function formatMemoryBlock(notes: AiMemoryNote[]): string {
  if (notes.length === 0) return "(none yet)";
  return notes.map((n) => `- ${n.text}`).join("\n");
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}
