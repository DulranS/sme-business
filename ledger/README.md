# Ledger — Bookkeeping for Small Business

Next.js 14 + Firebase (Auth + Firestore). Track products, services, sales, purchases, inventory, payroll, loans, and financial statements. Perfect for solo entrepreneurs and small teams (1-10 employees).

**Three roles:** Owner (full access), Manager (operations, no delete/payroll), Staff (log sales, count cash). Server-side permissions enforced in Firestore rules.

## Quick Start

### 1. Firebase Setup
```
1. Create project at https://console.firebase.google.com
2. Enable Authentication → Email/Password
3. Create Firestore Database (production mode)
4. Deploy firestore.rules:
   npm install -g firebase-tools
   firebase login
   firebase init firestore
   firebase deploy --only firestore:rules
5. Add Web app → Copy config
6. cp .env.local.example .env.local → Fill in NEXT_PUBLIC_FIREBASE_* values
```

### 2. Run
```
npm install
npm run dev
```
Open http://localhost:3000, create account (you're Owner), start adding products/services.

## Key Concepts

**Products vs Services:** Products = physical inventory. Services = labor/time-based. Both use same costing engine. Hybrid businesses get unified P&L.

**Purchases vs Orders:** Purchases = stock in hand. Orders = pending supplier orders (optional). Marking order "received" auto-creates Purchase entry.

**Employees:** Adding employee auto-books their pay as recurring expense. Tax % is for take-home reference only.

## Calculations

**WAC (Weighted Average Cost):** `newWAC = (qtyOnHand*oldWAC + boughtQty*unitCost) / (qtyOnHand+boughtQty)`. Simple, accurate for small businesses.

**Unit Economics:** COGS = qty × WAC. Variable cost = fees + % of price. Gross profit = revenue − COGS. Contribution margin = gross profit − variable cost.

**EOQ:** `sqrt(2 × D × S / H)` where D = annual demand, S = ordering cost, H = holding cost. Reorder point = daily demand × lead time.

**Break-even:** Contribution margin ratio ÷ fixed costs = break-even revenue.

**Financial Statements:** Income Statement (P&L), Cash Flow Statement (actual cash movement), Balance Sheet (assets = liabilities + equity).

## Architecture

**Data model:** `users/{uid}/{products|purchases|purchaseOrders|sales|expenses|variableCosts|capitalEntries|employees|loans}` subcollections + `users/{uid}/meta/settings`.

**Caching:** Firestore with persistent local cache (IndexedDB). Single DataProvider context owns all listeners. Derived calculations use useMemo.

**CSV Import/Export:** Per-entity export. Import validates all rows, rejects on any error. Bulk writes chunked ≤400 per batch.

**Team:** `users/{businessId}/members/{uid}` = single source of truth. Owners invite via shareable link. No shared logins.

## CSV Formats

| File | Columns |
|---|---|
| products.csv | name, sku, category, type, active, orderingCost, holdingCostPct, leadTimeDays |
| purchases.csv | product/productId, qty, unitCost, date, supplier, notes |
| sales.csv | product/productId, qty, unitPrice, date, customer, notes |
| expenses.csv | name, amount, category, kind, isRecurring, recurrence, startDate, endDate |
| capital_entries.csv | kind, amount, date, notes |
| employees.csv | name, role, payRate, payFrequency, taxPct, startDate, endDate, active, notes |

Dates = YYYY-MM-DD. Import products.csv first for name/SKU lookups.
