# Ledger — bookkeeping for product, service, or hybrid SMEs

Next.js 14 (App Router) + Firebase (Auth + Firestore). Tracks wholesale
orders through to receipt, purchases/service delivery costs, sales,
inventory, unit economics, EOQ reorder planning, employee payroll, recurring
revenue/expenses (incl. marketing/overhead), break-even & overhead coverage,
capital/ROI, and a growth forecast — for an owner running solo or with a
small team. Every business gets three roles out of the box: **Owner** (full
access), **Manager** (day-to-day operations, no delete/payroll/settings),
and **Staff** (log sales, count cash, record customer payments — nothing
else). The owner invites people from the Team page with a shareable link;
there's no shared login, and every permission is enforced server-side in
`firestore.rules`, not just hidden in the UI.

## 1. Set up Firebase

1. Create a project at https://console.firebase.google.com
2. **Build → Authentication → Get started → Email/Password → Enable**
3. **Build → Firestore Database → Create database** (start in production mode)
4. Deploy the included security rules (or paste `firestore.rules` into the
   Firestore "Rules" tab in console and publish):
   ```
   npm install -g firebase-tools
   firebase login
   firebase init firestore   # point it at this project, keep existing rules file
   firebase deploy --only firestore:rules
   ```
5. **Project settings → General → Your apps → Add app → Web**, copy the config.
6. `cp .env.local.example .env.local` and fill in the six `NEXT_PUBLIC_FIREBASE_*` values.

## 2. Run it

```
npm install
npm run dev
```

Open http://localhost:3000, create an account (email/password — this is the
Firebase Auth user, not a shared login — you're the Owner by default), and
start adding products or services. Invite a Manager or Staff member later
from the Team page once you have data worth sharing.

## 3. Products vs. services

Every offering has a `type`: **product** (physical, wholesale-bought, held as
inventory) or **service** (labor/time-based, no physical stock). Both use the
same costing engine — for a service, "Purchases" becomes "cost entries": log
what it costs you to deliver one unit (labor hours × rate, contractor fee per
job, materials per job) the same way you'd log a wholesale buy. This means a
hybrid business (e.g. selling parts *and* billing labor) gets one unified P&L,
inventory view, and forecast instead of two separate systems. EOQ / reorder
planning only applies to `type: product` — services have nothing to reorder.

## 4. Wholesale orders vs. purchases

**Purchases** (the Purchases page) is the log of stock/cost you already have
in hand — it's what actually feeds the WAC/inventory ledger. **Orders** (the
Orders page) is a separate, optional layer on top of that for products:
place a wholesale order with a supplier, track it (ordered → in transit →
received/cancelled), and see committed spend before anything arrives. Marking
an order "received" — with the actual quantity and cost, which can differ
from what was ordered — automatically creates the matching Purchase entry, so
inventory updates at the moment stock actually lands, not when you merely
placed the order. Units already on order are also subtracted from the
reorder-point check on the Products page, so a pending delivery doesn't get
double-flagged as "reorder now".

## 5. Employees & payroll

Adding an employee (Employees page) — name, role, gross pay, pay cadence, and
their own tax/withholding % — automatically books their pay as a recurring
expense (category "Payroll & labor"), the same mechanism as rent or a
subscription. That's the one and only source of truth: editing an employee's
pay or cadence updates the linked expense in the same batch write; marking
them inactive ends the recurring cost going forward without deleting the
historical record. The employee's tax % is purely a take-home reference (est.
net pay = gross × (1 − tax%)) — it does not change what the business pays
out, since the full gross pay is the actual cash cost regardless of how it
later splits between the employee and the tax authority. This is separate
from the business's own corporate tax rate in Settings.

## 6. How the numbers are calculated

**Inventory costing — Weighted Average Cost (WAC).** Every purchase/cost entry
re-averages the offering's cost: `newWAC = (qtyOnHand*oldWAC + boughtQty*unitCost) / (qtyOnHand+boughtQty)`.
Every sale draws down `qty` at the *current* WAC as its cost of goods sold.
This was chosen over FIFO/LIFO because those require lot-level batch tracking
(which purchase a given sale's units came from) — real bookkeeping overhead
that isn't worth it for a solo-entered ledger. WAC is what most small-business
accounting tools default to for this reason, and it's fully auditable from a
flat purchases + sales list, which is what's stored.

**Unit economics per sale:**
- `COGS = qty × WAC at time of sale`
- `Variable cost = per-unit fees (packaging, payment, delivery, subcontractor cut) + % of sale price`, configurable globally or per-offering
- `Gross profit = revenue − COGS`
- `Contribution margin = gross profit − variable cost`

**Economic Order Quantity (EOQ)** — product-type offerings only:
`EOQ = sqrt(2 × D × S / H)` where `D` = annual demand (estimated from the last
90 days of sales, annualized), `S` = ordering cost (fixed cost to place one
order), `H` = annual holding cost per unit (`holdingCostPct% × WAC`).
`Reorder point = daily demand × lead time (days)` — when stock on hand falls
to or below this, the Products page flags "reorder now". Ordering cost,
holding %, and lead time can be set per-product or fall back to Settings
defaults.

**Break-even & overhead coverage** blends the contribution margin ratio over
your last 3 months of sales and divides this month's fixed operating costs
(rent, salaries, marketing, subscriptions, etc.) by it to get the break-even
revenue, margin of safety, and an overhead coverage ratio (gross profit ÷
operating expenses — above 1× means overhead is actually being covered).

**Capital & ROI** tracks initial investment, reinvestment, and owner
withdrawals separately from operating P&L, so payback progress and net cash
position are visible alongside month-to-month profit.

**Payroll** is booked as a normal recurring Expense (see §5) so its cost
already flows through MRR / monthly P&L / spend-by-category untouched — the
Employees page just adds the staff-facing view (net pay estimate, total
monthly payroll run-rate for active staff).

**Monthly P&L:**
`Net profit (pre-tax) = gross profit − operating expenses (incl. recurring, monthly-normalized)`
`Tax = max(net pre-tax, 0) × tax rate` → `Net profit (after tax) = pre-tax − tax`

**Recurring revenue/expenses** (rent, subscriptions, marketing retainers,
retainer clients, etc.) carry a cadence (weekly/monthly/yearly) and are
normalized to a monthly figure for MRR and expanded into the specific months
they're active for period P&L. Expense categories (Marketing, Rent & utilities,
Payroll & labor, etc.) roll up into a spend-by-category view on the Expenses
page. Tax rate, currency, forecast horizon, and EOQ defaults are editable in
Settings.

**Forecasting:** least-squares linear regression over monthly revenue, plus a
trailing 3-month moving average, projected forward N months (Settings). ARIMA/
Prophet-style models need many clean periodic points to beat a trend line — a
solo ledger has few, noisy months, so a transparent, hand-verifiable trend is
the better choice here.

**Item-level profitability** (Profitability page) aggregates every sale by
product/service over a chosen window (last 30/90 days, this month, or all
time): units sold, average selling price vs. average unit cost, revenue,
COGS, gross profit, gross margin %, and — for physical products — units still
on hand and their inventory value. Ranked by gross profit so the best and
worst performers surface immediately. Margin is also bucketed into a rough
pricing-power signal (thin/moderate/healthy/strong) — thin margins usually
mean a commoditized, price-competitive item with easy substitutes; strong
margins usually mean real differentiation or low price-sensitivity. It's a
prompt to investigate, not a verdict.

**Loans & debt** (Loans page) model a standard fixed-payment monthly
amortizing loan: `payment = P·r(1+r)^n / ((1+r)^n − 1)`, `r` = monthly rate,
`n` = term in months, first payment one month after disbursement. Each
month's split between principal and interest is computed from this schedule
and flows automatically into the Income Statement (interest expense) and
Cash Flow Statement (principal repayment, plus loan proceeds in the
disbursement month) — nothing about a loan needs to be hand-entered as a
separate expense.

**Financial statements** (Statements page) — the three standard reports,
built entirely from data already in the ledger:
- **Income Statement**: revenue, COGS, variable costs, gross profit,
  operating expenses, interest expense, tax, net profit — for one month,
  accrual basis (same numbers as the dashboard's monthly P&L, just formally
  laid out with subtotals).
- **Cash Flow Statement**: actual cash in/out for one month, direct method.
  This differs from the Income Statement in one important way: inventory
  purchases hit cash when *bought*, not when the stock is later sold (COGS
  timing) — so a month with heavy restocking can show strong accrual profit
  and weak cash flow, which is exactly the kind of thing an SME needs to see
  coming. Operating activities cover sales cash, inventory cash paid,
  variable costs, opex, interest, and tax; financing activities cover loan
  proceeds/repayments and owner capital in/out. Investing activities aren't
  tracked in this build (no fixed-asset/equipment ledger yet).
- **Balance Sheet**: always as of today (this build doesn't replay historical
  WAC/cash state for an arbitrary past date). Assets = cash (the cumulative
  net cash flow across every month to date) + inventory value. Liabilities =
  outstanding loan balances. Equity = owner's capital (net of withdrawals) +
  retained earnings (cumulative net profit after tax). Cash is *derived*,
  never hand-entered, which is what keeps Assets = Liabilities + Equity true
  by construction rather than something that can drift out of balance.

Both the Income Statement's monthly figures and the Cash Flow/Balance Sheet
derivation depend on the monthly P&L covering *every* calendar month from
first activity to today — not just months that happen to contain a sale —
so a recurring rent or loan payment in a quiet month doesn't silently vanish
from either statement.

## 7. Architecture notes

- **Data model**: `users/{uid}/{products|purchases|purchaseOrders|sales|expenses|variableCosts|capitalEntries|employees|loans}`
  subcollections + a `users/{uid}/meta/settings` doc. Firestore security rules
  restrict every subtree to its owner (`firestore.rules`).
- **Caching / memory strategy**: Firestore is initialized once with
  `persistentLocalCache` (IndexedDB-backed), so data survives reloads and
  works read-only offline. A single `DataProvider` (React context) owns the
  only set of `onSnapshot` listeners for the whole app — every page reads
  from the same in-memory store instead of opening duplicate listeners.
  Derived numbers (WAC ledgers, per-sale economics, monthly P&L, forecast)
  are computed with `useMemo` keyed on the raw arrays, so switching pages
  never re-runs the math unless the underlying data actually changed.
- **CSV import/export** (`lib/csv.ts`, papaparse): export is per-entity
  (products/purchases/sales/expenses) since the schemas don't share columns.
  Import validates every row up front and rejects the whole file with a
  row-by-row error list on any bad data, rather than silently skipping rows —
  this is financial data, partial imports would be worse than a blocked one.
  Bulk writes are chunked into Firestore batches of ≤400 to stay under the
  500-write batch limit.
- **Team & roles**: `users/{businessId}/members/{uid}` holds one doc per
  person with access (role, active/removed) — the single source of truth
  both the client (`lib/permissions.ts`) and `firestore.rules` read for
  every permission decision. `memberships/{uid}` is a top-level pointer,
  written once at signup or invite-acceptance, so a signed-in client can
  find its own business with one doc read. Owners invite from the Team
  page; the link (`/join?biz=...&invite=...`) is shared out-of-band
  (WhatsApp, in person) and the invitee creates their own login — nothing
  is ever created on their behalf, since the client SDK only holds one
  session at a time. See the role matrix at the top of `firestore.rules`
  and in `lib/permissions.ts` (kept in sync manually — if you add a
  permission, update both).

## 8. CSV formats

| File | Columns |
|---|---|
| products.csv | `name, sku, category, type (product/service), active, orderingCost, holdingCostPct, leadTimeDays` |
| purchases.csv | `product` (name or SKU) or `productId`, `qty, unitCost, date, supplier, notes` |
| purchase_orders.csv | export-only — `product, qtyOrdered, unitCost, orderDate, expectedDate, supplier, status, receivedDate, qtyReceived, receivedUnitCost, notes` |
| sales.csv | `product` (name or SKU) or `productId`, `qty, unitPrice, date, customer, notes` |
| expenses.csv | `name, amount, category, kind (expense/revenue), isRecurring (true/false), recurrence (weekly/monthly/yearly), startDate, endDate` |
| capital_entries.csv | `kind (investment/reinvestment/withdrawal), amount, date, notes` |
| employees.csv | `name, role, payRate, payFrequency (weekly/monthly/yearly), taxPct, startDate, endDate, active, notes` — importing books each row's pay as a recurring expense automatically |

`date`/`startDate`/`endDate` are `YYYY-MM-DD`. Re-import your own export of
`products.csv` first if importing `purchases.csv`/`sales.csv` into a fresh
project, so product name/SKU lookups resolve. `purchase_orders.csv` is
export-only — orders are placed and received through the Orders page so the
resulting Purchase entry is created correctly.
