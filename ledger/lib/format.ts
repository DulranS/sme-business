const SYMBOLS: Record<string, string> = {
  LKR: "Rs",
  USD: "$",
  AED: "AED",
  EUR: "€",
  GBP: "£",
  INR: "₹",
};

export function formatMoney(amount: number, currency: string): string {
  const symbol = SYMBOLS[currency] ?? currency;
  const negative = amount < 0;
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${negative ? "-" : ""}${symbol} ${formatted}`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export function formatMonth(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toLocaleDateString(undefined, { month: "short", year: "numeric", timeZone: "UTC" });
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
