# Ledger — User Manual

Simple bookkeeping for small businesses. Track what you sell, what you buy, and see your profit.

---

## Quick Start (5 minutes)

### 1. Set Up
- Create account (email + password)
- Go to **Settings** → Set currency (LKR, USD, etc.)

### 2. Add Products/Services
**Products** → "+ Add item"

**Physical product:** Name, Type: Product, Price, Cost
**Service:** Name, Type: Service, Price, Cost (time/materials)

### 3. Log First Sale
**Sales** → "+ Add sale"
- Select product, quantity, price, date

Done! Profit shows on Dashboard.

---

## Day-to-Day

### Add Products/Services
**Products** → "+ Add item"
- Product: physical inventory, set price + cost
- Service: labor/time, set rate + cost

### Log Sales
**Sales** → "+ Add sale"
- What, how many, price, customer (optional)

### Buy Stock/Materials
**Purchases** → "+ I bought something"
- What, quantity, cost, supplier, date

### Add Expenses
**Expenses** → "+ Add item"
- One-time: Kind: Expense, amount, date
- Recurring: Kind: Expense, amount, cadence (weekly/monthly/yearly), start date
- Recurring revenue: Kind: Revenue, amount, cadence

### Manage Employees
**Employees** → "+ Add employee"
- Name, role, gross pay, frequency, tax % (take-home reference only)
- Auto-books as monthly expense

### Track Loans
**Loans** → "+ Add loan"
- Name, lender, principal, interest rate, term (months)
- Auto-calculates payments, splits principal vs interest

---

## Understanding Numbers

### Dashboard
Revenue, expenses, net profit, cash on hand, forecast, growth rates, average order value, revenue per employee, inventory turnover, days of inventory on hand, cash runway.

### Products Page
Stock level, value, reorder flag, EOQ (optimal order quantity).

### Profitability Page
Units sold, revenue vs cost, gross profit, margin %. Green = healthy, Red = thin.

### Statements Page
**Income Statement:** Revenue, COGS, expenses, net profit.
**Cash Flow:** Actual cash movement (differs from profit due to inventory timing).
**Balance Sheet:** Assets (cash + inventory), liabilities (loans), equity.

---

## Advanced

### Purchase Orders (Optional)
**Purchase Orders** → "+ Place order"
- Track stock before it arrives
- Click "Receive" when it lands → auto-creates Purchase entry

### Import/Export
**Import-Export** page
- Export to CSV (backups, Excel)
- Import from CSV (bulk add)

### Settings
Tax rate, currency, forecast horizon, EOQ defaults, owner pay.

---

## Common Questions

**Q: Purchases vs Orders?**
A: Purchases = stock in hand. Orders = pending (optional). Skip orders if not needed.

**Q: Services?**
A: Add as Type: Service. Log cost in Purchases, sale in Sales. Same math.

**Q: WAC?**
A: Weighted Average Cost. Average cost across all purchases. Simple, accurate.

**Q: Two profit numbers?**
A: Net profit = actual. True profit = net minus what you'd pay someone else to do your job.

**Q: Multiple businesses?**
A: Separate accounts for separate businesses.

**Q: Data safe?**
A: Yes, Firebase with security rules, cloud-backed.

**Q: Strategic metrics?**
A: Growth rates (MoM/YoY), average order value, revenue per employee, inventory turnover, days inventory on hand, cash runway.

---

## Tips

1. Log sales/purchases regularly (daily/weekly)
2. Use expense categories (Rent, Marketing, etc.)
3. Check reorder flags on Products page
4. Review Dashboard/Statements monthly
5. Export CSV backups periodically

---

## Summary

**Daily:** Log sales, log purchases
**Weekly:** Check stock, review expenses
**Monthly:** Review profit, check statements, adjust forecasts

App handles all calculations automatically.
