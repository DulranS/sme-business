# Ledger — solo bookkeeping for product, service, or hybrid SMEs

Next.js 14 (App Router) + Firebase (Auth + Firestore). Tracks wholesale
purchases/service delivery costs, sales, inventory, unit economics, EOQ
reorder planning, recurring revenue/expenses (incl. marketing/overhead),
break-even & overhead coverage, capital/ROI, and a growth forecast — for a
single operator, no team/multi-tenant auth needed.

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
Firebase Auth user, not a shared login), and start adding products or services.

## 3. Products vs. services

Every offering has a `type`: **product** (physical, wholesale-bought, held as
inventory) or **service** (labor/time-based, no physical stock). Both use the
same costing engine — for a service, "Purchases" becomes "cost entries": log
what it costs you to deliver one unit (labor hours × rate, contractor fee per
job, materials per job) the same way you'd log a wholesale buy. This means a
hybrid business (e.g. selling parts *and* billing labor) gets one unified P&L,
inventory view, and forecast instead of two separate systems. EOQ / reorder
planning only applies to `type: product` — services have nothing to reorder.

## 4. How the numbers are calculated

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

## 4. Architecture notes

- **Data model**: `users/{uid}/{products|purchases|sales|expenses|variableCosts|capitalEntries}`
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
- **No auth** was the original ask; this revision uses Firebase
  Authentication (email/password) purely to keep the ledger private to you —
  there's no multi-user/team layer, sharing, or roles.

## 5. CSV formats

| File | Columns |
|---|---|
| products.csv | `name, sku, category, type (product/service), active, orderingCost, holdingCostPct, leadTimeDays` |
| purchases.csv | `product` (name or SKU) or `productId`, `qty, unitCost, date, supplier, notes` |
| sales.csv | `product` (name or SKU) or `productId`, `qty, unitPrice, date, customer, notes` |
| expenses.csv | `name, amount, category, kind (expense/revenue), isRecurring (true/false), recurrence (weekly/monthly/yearly), startDate, endDate` |
| capital_entries.csv | `kind (investment/reinvestment/withdrawal), amount, date, notes` |

`date`/`startDate`/`endDate` are `YYYY-MM-DD`. Re-import your own export of
`products.csv` first if importing `purchases.csv`/`sales.csv` into a fresh
project, so product name/SKU lookups resolve.
