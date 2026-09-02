"use client";

import { useState } from "react";
import { GLOSSARY } from "@/lib/glossary";

// Click/tap-to-toggle rather than hover-only, since hover doesn't exist on
// a phone — this is meant for an SME owner checking their numbers on their
// phone as much as at a desk. `term` keys into lib/glossary.ts; `children`
// is the label actually shown (defaults to the term itself).
export default function Term({ term, children }: { term: keyof typeof GLOSSARY; children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const definition = GLOSSARY[term];
  if (!definition) return <>{children ?? term}</>;

  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="underline decoration-dotted decoration-muted underline-offset-2 text-inherit font-inherit"
        aria-expanded={open}
      >
        {children ?? term}
      </button>
      {open && (
        <>
          {/* Full-viewport transparent layer to catch the "tap elsewhere to close" gesture without a global listener. */}
          <span className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <span className="absolute z-50 left-0 top-full mt-1.5 w-64 max-w-[80vw] bg-panel2 border border-line rounded-md p-2.5 text-xs font-normal text-fg shadow-lg">
            {definition}
          </span>
        </>
      )}
    </span>
  );
}
