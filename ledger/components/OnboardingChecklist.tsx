"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useData } from "@/contexts/DataContext";
import { Card } from "@/components/ui";

const DISMISS_KEY = "ledger_onboarding_dismissed";

// Sequencing, not a new feature: an owner landing on an empty dashboard has
// to discover "add products → log a purchase → log a sale → set an opening
// balance" on their own. This just says that out loud, with a link to each
// step, and gets out of the way for good once all four are done (or the
// owner dismisses it manually). No new data model — every check reads off
// arrays DataContext already loads.
export default function OnboardingChecklist() {
  const { products, purchases, sales, capitalEntries } = useData();
  const [dismissed, setDismissed] = useState(true); // default true avoids a flash before localStorage is read

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  const steps = [
    { label: "Add a product or service", href: "/products", done: products.length > 0 },
    { label: "Log a purchase or cost entry", href: "/purchases", done: purchases.length > 0 },
    { label: "Log a sale", href: "/sales", done: sales.length > 0 },
    { label: "Set your opening balance", href: "/profitability", done: capitalEntries.length > 0 },
  ];
  const allDone = steps.every((s) => s.done);

  if (dismissed || allDone) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  return (
    <Card className="mb-5 sm:mb-6 border-amber-dim/40">
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm font-medium">Get set up</div>
        <button onClick={dismiss} className="text-xs text-muted hover:text-fg shrink-0" aria-label="Dismiss checklist">
          Hide
        </button>
      </div>
      <div className="text-xs text-muted mt-1 mb-3">Four steps and this page fills itself in.</div>
      <ul className="space-y-2">
        {steps.map((step) => (
          <li key={step.href} className="flex items-center gap-2.5 text-sm">
            <span
              className={
                step.done
                  ? "flex items-center justify-center w-5 h-5 rounded-full bg-good/15 text-good text-xs shrink-0"
                  : "flex items-center justify-center w-5 h-5 rounded-full border border-line text-transparent text-xs shrink-0"
              }
            >
              ✓
            </span>
            {step.done ? (
              <span className="text-muted line-through">{step.label}</span>
            ) : (
              <Link href={step.href} className="text-fg hover:text-amber-soft">
                {step.label} →
              </Link>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
