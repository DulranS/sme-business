// ---------------------------------------------------------------------------
// Multi-currency support.
//
// The business has one base/reporting currency (Settings > currency) — every
// figure in lib/calculations.ts (P&L, WAC/COGS, cash flow, aging, etc.) is
// computed purely in that base currency, and none of that engine changes.
//
// A single Sale or Purchase can still be transacted in a *different*
// currency (e.g. a supplier invoiced in USD, or a customer paid in AED).
// When that happens we convert to the base currency once, at entry time,
// using the exchange rate the user enters (1 unit of the foreign currency =
// `exchangeRate` units of base currency). The converted amount is what gets
// stored in `unitPrice` / `unitCost` — the fields every calculation already
// reads — so the rest of the app needs zero changes. The original
// currency, rate, and foreign-currency amount are kept alongside purely for
// display and audit ("what did I actually charge/pay, and in what?").
//
// This is the same approach real accounting systems use for foreign-currency
// transactions (translate to functional currency at the transaction date),
// rather than trying to carry mixed currencies through every downstream sum.
// ---------------------------------------------------------------------------

export const CURRENCIES = ["LKR", "USD", "AED", "EUR", "GBP", "INR"];

export function convertToBase(foreignAmount: number, exchangeRate: number): number {
  const rate = exchangeRate > 0 ? exchangeRate : 1;
  return foreignAmount * rate;
}
