"use client";

import { useState } from "react";
import { Modal } from "@/components/ui";
import { QuickSaleForm, QuickStockForm, QuickExpenseForm } from "@/components/QuickForms";
import QuickAiEntryModal from "@/components/ai/QuickAiEntryModal";

type Action = "sale" | "stock" | "expense" | "ai" | null;

// Four unmissable buttons for the things a small-business owner actually
// does most days: sold something, bought stock, paid a bill — or just
// wants to type/photograph what happened and let the assistant fill in
// which of those three it was. No nav-hunting required — this is the
// "monkey brain easy" front door, with the full Products/Sales/Purchases/
// Expenses pages still there underneath for anyone who wants the full
// record.
export default function QuickActionBar() {
  const [active, setActive] = useState<Action>(null);

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <button
          onClick={() => setActive("sale")}
          className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-line bg-panel hover:border-amber-dim hover:bg-panel2 transition-colors py-4 px-2"
        >
          <span className="text-xl">💰</span>
          <span className="text-xs font-medium">I sold something</span>
        </button>
        <button
          onClick={() => setActive("stock")}
          className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-line bg-panel hover:border-amber-dim hover:bg-panel2 transition-colors py-4 px-2"
        >
          <span className="text-xl">📦</span>
          <span className="text-xs font-medium">I bought stock</span>
        </button>
        <button
          onClick={() => setActive("expense")}
          className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-line bg-panel hover:border-amber-dim hover:bg-panel2 transition-colors py-4 px-2"
        >
          <span className="text-xl">🧾</span>
          <span className="text-xs font-medium">I paid a bill</span>
        </button>
        <button
          onClick={() => setActive("ai")}
          className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-amber-dim/60 bg-panel hover:border-amber-dim hover:bg-panel2 transition-colors py-4 px-2"
        >
          <span className="text-xl">✨</span>
          <span className="text-xs font-medium">Tell me what happened</span>
        </button>
      </div>

      <Modal open={active === "sale"} onClose={() => setActive(null)} title="I sold something">
        <QuickSaleForm onDone={() => setActive(null)} />
      </Modal>
      <Modal open={active === "stock"} onClose={() => setActive(null)} title="I bought stock">
        <QuickStockForm onDone={() => setActive(null)} />
      </Modal>
      <Modal open={active === "expense"} onClose={() => setActive(null)} title="I paid a bill">
        <QuickExpenseForm onDone={() => setActive(null)} />
      </Modal>
      <QuickAiEntryModal open={active === "ai"} onClose={() => setActive(null)} />
    </>
  );
}
