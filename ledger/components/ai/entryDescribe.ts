// One-line human-readable summary of a proposed entry, shown above the
// pre-filled form so the user can sanity-check it at a glance before
// (or without) reading every field.
import { formatMoney } from "@/lib/format";
import type { ProposedEntry } from "@/lib/aiTypes";

export function describeEntry(entry: ProposedEntry, currency: string): string {
  const money = (n: number) => formatMoney(n, entry.currency ?? currency);
  if (entry.kind === "sale") {
    const who = entry.customer ? ` to ${entry.customer}` : "";
    return `${entry.qty} × ${entry.productName} @ ${money(entry.unitPrice)}${who} — ${entry.date}`;
  }
  if (entry.kind === "purchase") {
    const from = entry.supplier ? ` from ${entry.supplier}` : "";
    return `${entry.qty} × ${entry.productName} @ ${money(entry.unitCost)}${from} — ${entry.date}`;
  }
  const cat = entry.category ? ` (${entry.category})` : "";
  return `${entry.name}${cat} — ${money(entry.amount)} — ${entry.date}`;
}
