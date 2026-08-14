"use client";

import { useState } from "react";
import { Modal } from "@/components/ui";
import { QuickSaleForm, QuickStockForm, QuickExpenseForm } from "@/components/QuickForms";

type Action = "sale" | "stock" | "expense" | null;

// Three unmissable buttons for the three things a small-business owner
// actually does most days: sold something, bought stock, paid a bill. No
// nav-hunting required — this is the "monkey brain easy" front door, with
// the full Products/Sales/Purchases/Expenses pages still there underneath
// for anyone who wants the full record.
export default function QuickActionBar() {
  const [active, setActive] = useState<Action>(null);

  return (
    <>
      <div className="grid grid-cols-3 gap-3 mb-6">
        <button
          onClick={() => setActive("sale")}
          className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-line bg-panel hover:border-amber-dim hover:bg-panel2 transition-colors py-4 px-2"
        >
          <span className="text-xl">💰</span>
          <span className="text-xs font-medium">Log a sale</span>
        </button>
        <button
          onClick={() => setActive("stock")}
          className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-line bg-panel hover:border-amber-dim hover:bg-panel2 transition-colors py-4 px-2"
        >
          <span className="text-xl">📦</span>
          <span className="text-xs font-medium">Add stock</span>
        </button>
        <button
          onClick={() => setActive("expense")}
          className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-line bg-panel hover:border-amber-dim hover:bg-panel2 transition-colors py-4 px-2"
        >
          <span className="text-xl">🧾</span>
          <span className="text-xs font-medium">Add expense</span>
        </button>
      </div>

      <Modal open={active === "sale"} onClose={() => setActive(null)} title="Log a sale">
        <QuickSaleForm onDone={() => setActive(null)} />
      </Modal>
      <Modal open={active === "stock"} onClose={() => setActive(null)} title="Add stock">
        <QuickStockForm onDone={() => setActive(null)} />
      </Modal>
      <Modal open={active === "expense"} onClose={() => setActive(null)} title="Add expense">
        <QuickExpenseForm onDone={() => setActive(null)} />
      </Modal>
    </>
  );
}
