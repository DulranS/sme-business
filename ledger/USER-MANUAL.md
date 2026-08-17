# Ledger - Simple User Manual

A simple bookkeeping tool for small businesses. Track what you sell, what you buy, and see your profit in plain language.

---

## Quick Start (5 minutes)

### 1. Set Up
- Open the app and create your account (email + password)
- Go to **Settings** and set your currency (e.g., LKR, USD)

### 2. Add What You Sell
Go to **Products** and click "+ Add item"

**For physical products:**
- Name: "T-shirt"
- Type: Product
- Price: 1500
- Cost: 800

**For services:**
- Name: "Consulting hour"
- Type: Service
- Price: 5000
- Cost: 2000 (your time, materials, etc.)

### 3. Log Your First Sale
Go to **Sales** and click "+ Add sale"
- Select what you sold
- How many: 1
- Price: 1500
- Date: today

That's it! You'll see your profit on the Dashboard.

---

## Day-to-Day Tasks

### Adding Products or Services
**Products** page → "+ Add item"

**Physical product** (things you buy and resell):
- Type: Product
- Set your selling price
- Set what it costs you to buy
- Add SKU if you use barcodes

**Service** (your time, labor):
- Type: Service
- Set your hourly rate or per-job price
- Set what it costs you (materials, subcontractor fees)

### Logging Sales
**Sales** page → "+ Add sale"
- What did you sell?
- How many?
- At what price?
- Who bought it? (optional)
- Any notes? (optional)

### Buying Stock or Materials
**Purchases** page → "+ I bought something"
- What did you buy?
- How many?
- What did each one cost?
- From whom? (optional)
- Date of purchase

**For services:** Use this to log what it cost you to deliver (labor hours × rate, materials per job)

### Adding Regular Expenses
**Expenses** page → "+ Add item"

**One-time costs:**
- Kind: Expense
- Amount: 50000
- Date: when you paid

**Recurring costs (rent, subscriptions, salaries):**
- Kind: Expense
- Amount: 15000
- Cadence: Monthly
- Start date: when it starts

**Recurring revenue (retainer clients):**
- Kind: Revenue
- Amount: 50000
- Cadence: Monthly

### Managing Employees
**Employees** page → "+ Add employee"
- Name and role
- Gross pay (what you pay them)
- How often (weekly/monthly/yearly)
- Their tax % (for their take-home reference only)

This automatically books their pay as a monthly expense. No need to add it separately.

### Tracking Loans
**Loans** page → "+ Add loan"
- Loan name
- Lender (bank name)
- Principal amount
- Annual interest rate
- Term (how many months)

The app automatically calculates monthly payments and splits principal vs interest.

---

## Understanding Your Numbers

### Dashboard
Shows you at a glance:
- Revenue this month
- Expenses this month
- Net profit (what you actually made)
- Cash on hand
- Forecast (what's coming based on trends)

### Products Page
- **Stock level:** How many you have
- **Value:** What that stock is worth (at cost)
- **Reorder now:** Flagged when stock is low
- **EOQ:** How many to order next time (saves money)

### Profitability Page
Shows which items make you the most money:
- Units sold
- Revenue vs cost
- Gross profit per item
- Margin percentage

Green = healthy margins. Red = thin margins (might be too competitive).

### Statements Page
Three standard financial reports:

**Income Statement:**
- Revenue in
- Cost of goods sold
- Operating expenses
- Net profit

**Cash Flow Statement:**
- Actual cash that moved in/out
- Different from profit (inventory bought today hits cash now, profit later)

**Balance Sheet:**
- What you own (cash + inventory)
- What you owe (loans)
- What the business is worth (equity)

---

## Advanced Features

### Wholesale Orders (Optional)
If you order stock from suppliers and want to track it before it arrives:

**Purchase Orders** page → "+ Place order"
- What product?
- How many?
- Expected cost
- Expected delivery date

When it arrives, click "Receive" and it automatically adds to your Purchases and inventory.

### Import/Export
**Import-Export** page lets you:
- Export your data to CSV (for Excel, backups)
- Import data from CSV (bulk add products, sales, etc.)

Useful for migrating data or doing bulk updates.

### Settings
Configure your business:
- **Tax rate:** Your corporate tax %
- **Currency:** LKR, USD, EUR, etc.
- **Forecast horizon:** How many months to project forward
- **EOQ defaults:** Ordering cost, holding cost %, lead time (for reorder planning)
- **Owner pay:** What you'd pay someone else to do your job (shows "true profit")

---

## Common Questions

**Q: What's the difference between Purchases and Orders?**
- A: Purchases = stock you already have in hand. Orders = stock you've ordered but haven't received yet. Orders are optional — you can skip them and just use Purchases.

**Q: How do I handle services?**
- A: Add them as Type: Service in Products. When you deliver the service, log the cost in Purchases (what it cost you in time/materials). Then log the sale in Sales. The profit calculation works the same.

**Q: What's WAC?**
- A: Weighted Average Cost. If you buy 10 units at 100, then 10 units at 120, your average cost is 110. Every sale uses this average cost. It's simple and accurate for most small businesses.

**Q: Why are there two profit numbers?**
- A: "Net profit" is your actual profit. "True profit" subtracts what you'd pay someone else to do your job — shows if the business is profitable beyond just your unpaid labor.

**Q: Can I use this for multiple businesses?**
- A: Each account is for one business. Create separate accounts for separate businesses.

**Q: Is my data safe?**
- A: Yes. Data is stored in Firebase with security rules that only you can access. It's backed up in the cloud.

---

## Tips for Best Results

1. **Be consistent** - Log sales and purchases regularly (daily or weekly)
2. **Use categories** - Add categories to expenses (Rent, Marketing, etc.) for better tracking
3. **Check reorder flags** - The Products page tells you when to restock
4. **Review monthly** - Look at the Dashboard and Statements each month
5. **Export backups** - Use Import-Export to download CSV backups periodically

---

## Getting Help

If something isn't clear:
1. Check this manual first
2. Look at the existing README.md for technical details
3. Your data is always safe — you can export it anytime

---

## Summary

**What you need to do daily:**
- Log sales (Sales page)
- Log purchases (Purchases page)

**What you need to do weekly:**
- Check stock levels (Products page)
- Review expenses (Expenses page)

**What you need to do monthly:**
- Review profit (Dashboard)
- Check statements (Statements page)
- Adjust forecasts if needed

That's it! The app handles all the calculations automatically.
