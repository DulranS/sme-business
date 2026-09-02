// Deliberately short (one or two sentences) and free of further jargon —
// the point is to unblock someone reading a statement, not to teach a full
// accounting course inline. Bounded, static list; add terms here as they
// come up rather than building a general help system.
export const GLOSSARY: Record<string, string> = {
  cogs:
    "Cost of Goods Sold — what it actually cost you to buy or make the things you sold this period. Revenue minus COGS is your gross profit.",
  "gross margin":
    "What's left from a sale after subtracting what it cost you to buy or make (COGS), shown as a % of the sale price. Higher means more room to cover your other bills.",
  "gross profit": "Revenue minus COGS — what you made before rent, salaries, and other running costs.",
  "net profit":
    "What's left after every cost is subtracted from revenue — COGS, running costs, interest, everything. This is the real bottom line.",
  "contribution margin":
    "What one more sale adds to covering your fixed costs — the sale price minus the costs that scale directly with it (materials, delivery, commission). Doesn't include rent or salaries, which don't change with one extra sale.",
  "break-even point":
    "The sales level where your contribution margin exactly covers your fixed costs (rent, salaries, etc.) — below it you're losing money, above it every extra sale is profit.",
  "accrual basis":
    "Counting a sale or a bill the moment it happens, whether or not cash has actually changed hands yet. This is what the Income Statement and Profit page use — it shows whether the business itself is profitable, separate from cash timing.",
  "cash basis":
    "Counting money only when it actually moves — cash in, cash out. This is what the Cash Flow page tracks, since a profitable business can still run out of cash if payments are slow to arrive.",
  "accounts receivable":
    "Money customers owe you for sales already made — you've delivered, they haven't paid yet.",
  "accounts payable": "Money you owe suppliers or others for things already received — you haven't paid yet.",
  "fixed costs":
    "Costs that stay roughly the same regardless of how much you sell — rent, salaries, insurance.",
  "variable costs": "Costs that rise and fall directly with how much you sell — materials, delivery, commission.",
  runway: "How many months your current cash would last if income stopped and outgoings stayed the same.",
  eoq:
    "Economic Order Quantity — the order size that minimizes your total cost of ordering plus holding stock, based on how fast an item sells.",
};

export type GlossaryKey = keyof typeof GLOSSARY;
