"use client";

import { useState } from "react";
import { Modal } from "@/components/ui";
import { QuickSaleForm, QuickStockForm, QuickExpenseForm } from "@/components/QuickForms";
import { useAssistantModal } from "@/contexts/AssistantModalContext";

type Action = "sale" | "stock" | "expense" | null;

// Three unmissable buttons for the things a small-business owner actually
// does most days: sold something, bought stock, paid a bill. The fourth
// — "Tell me what happened" — opens the same shared Assistant modal as
// the floating sparkle button on every page (see AssistantModalContext),
// instead of owning a second, separate copy of the AI entry UI. One
// assistant, reachable the same way everywhere, not a different door on
// every page.
export default function QuickActionBar() {
  const [active, setActive] = useState<Action>(null);
  const { openAssistant } = useAssistantModal();

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
          onClick={openAssistant}
          className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-amber-soft/70 bg-panel hover:border-amber-soft hover:bg-panel2 transition-colors py-4 px-2"
        >
          <span className="text-xl">✨</span>
          <span className="text-xs font-medium text-amber-soft">Tell me what happened</span>
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
    </>
  );
}
