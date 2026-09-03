"use client";

import clsx from "clsx";
import { useEffect, useRef } from "react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx("bg-panel border border-line rounded-lg p-4 sm:p-5", className)}>
      {children}
    </div>
  );
}

export function Stat({
  label,
  value,
  tone = "default",
  sub,
}: {
  label: string;
  value: string;
  tone?: "default" | "good" | "bad" | "amber";
  sub?: string;
}) {
  const toneClass = {
    default: "text-fg",
    good: "text-good",
    bad: "text-bad",
    amber: "text-amber-soft",
  }[tone];
  return (
    <Card>
      <div className="text-[11px] uppercase tracking-wider text-muted font-medium">{label}</div>
      <div className={clsx("num text-xl sm:text-2xl lg:text-3xl mt-1.5 font-medium break-words", toneClass)}>{value}</div>
      {sub && <div className="text-xs text-muted mt-1">{sub}</div>}
    </Card>
  );
}

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }) {
  // min-h-[44px] keeps every button at (or above) the widely-used 44px
  // touch-target minimum (Apple HIG / WCAG 2.5.5) on phones and tablets,
  // without visually bloating it on desktop — px/py alone comfortably
  // clear 44px on their own once line-height is accounted for, this is
  // just an explicit floor so short-label buttons don't fall under it.
  const base =
    "inline-flex items-center justify-center min-h-[44px] sm:min-h-[38px] px-3.5 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]";
  const variants = {
    primary: "bg-amber text-ink hover:bg-amber-soft",
    ghost: "bg-transparent border border-line text-fg hover:border-muted",
    danger: "bg-transparent border border-bad/40 text-bad hover:bg-bad/10",
  };
  return <button className={clsx(base, variants[variant], className)} {...props} />;
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={clsx(
        // text-base (16px) rather than text-sm below the sm breakpoint —
        // any input under 16px triggers iOS Safari's automatic zoom-in on
        // focus, which shoves the whole page around and is one of the most
        // common "this feels broken on my phone" complaints in web apps.
        // min-h-[44px] is the same touch-target floor as Button.
        "w-full min-h-[44px] sm:min-h-0 bg-panel2 border border-line rounded-md px-3 py-2 text-base sm:text-sm text-fg placeholder:text-muted focus:outline-none focus:border-amber-dim",
        props.className
      )}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={clsx(
        "w-full min-h-[44px] sm:min-h-0 bg-panel2 border border-line rounded-md px-3 py-2 text-base sm:text-sm text-fg focus:outline-none focus:border-amber-dim",
        props.className
      )}
    />
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <label className="block text-xs text-muted mb-1.5">{children}</label>;
}

export function Field({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}

export function PageHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 sm:mb-6">
      <h1 className="font-display text-xl sm:text-2xl font-medium">{title}</h1>
      {action && <div className="[&>button]:w-full sm:[&>button]:w-auto">{action}</div>}
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <Card className="text-center py-10">
      <div className="text-sm font-medium text-fg">{title}</div>
      <div className="text-sm text-muted mt-1 max-w-sm mx-auto">{body}</div>
    </Card>
  );
}

export function Badge({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "good" | "bad" | "amber" }) {
  const toneClass = {
    default: "bg-panel2 text-muted border-line",
    good: "bg-good/10 text-good border-good/30",
    bad: "bg-bad/10 text-bad border-bad/30",
    amber: "bg-amber/10 text-amber-soft border-amber/30",
  }[tone];
  return (
    <span className={clsx("text-[11px] px-1.5 py-0.5 rounded border font-medium whitespace-nowrap", toneClass)}>
      {children}
    </span>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Lock background scroll while a modal is open (otherwise the page behind
  // a bottom-sheet keeps scrolling on touch devices — a common source of
  // "the app feels janky" reports) and move focus into the dialog once,
  // when it opens.
  //
  // Deliberately keyed on `open` alone, not `onClose`. onClose is usually
  // an inline arrow function from the parent, so it gets a new reference
  // on every parent re-render — including every keystroke in a form
  // inside this modal. If this effect (and its dialogRef.current.focus()
  // call) depended on onClose too, it would re-run on every keystroke and
  // steal focus back from whatever input the user was typing into after
  // each character. Splitting the Escape-key listener into its own effect
  // below keeps that handler correctly wired to the latest onClose
  // without the focus effect re-firing on every render.
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="relative bg-panel border border-line rounded-t-lg sm:rounded-lg w-full sm:max-w-lg max-h-[92vh] sm:max-h-[90vh] overflow-y-auto p-5 sm:p-6 focus:outline-none"
      >
        {/* Small drag-handle affordance on mobile bottom sheets — a visual
            cue this is a sheet you could swipe, matching iOS/Android
            conventions, even though swipe-to-dismiss isn't wired up. */}
        <div className="sm:hidden w-9 h-1 rounded-full bg-line mx-auto -mt-1 mb-3" />
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-medium pr-2">{title}</h2>
          <button
            onClick={onClose}
            className="text-muted hover:text-fg w-9 h-9 sm:w-7 sm:h-7 shrink-0 flex items-center justify-center rounded-md hover:bg-panel2"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: { key: T; label: ReactNode }[];
  value: T;
  onChange: (key: T) => void;
  className?: string;
}) {
  return (
    <div role="tablist" className={clsx("flex gap-1 mb-4 border-b border-line overflow-x-auto scroll-touch", className)}>
      {tabs.map((t) => (
        <button
          key={t.key}
          role="tab"
          aria-selected={value === t.key}
          onClick={() => onChange(t.key)}
          className={clsx(
            "px-3.5 py-2.5 sm:py-2 text-sm border-b-2 -mb-px transition-colors whitespace-nowrap",
            value === t.key
              ? "border-amber text-fg font-medium"
              : "border-transparent text-muted hover:text-fg"
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// A single pulsing placeholder block. Every other Skeleton* component below
// is built out of these, sized and arranged to match the real component
// it's standing in for, so the transition from skeleton to real content
// doesn't cause any layout jump.
export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("animate-pulse rounded-md bg-panel2", className)} aria-hidden />;
}

// Mirrors the shape of a single <Stat>: a label-height bar plus a
// value-height bar inside the same Card padding as the real thing.
export function StatSkeleton() {
  return (
    <Card>
      <Skeleton className="h-[11px] w-20 mb-2.5" />
      <Skeleton className="h-6 sm:h-7 w-24" />
    </Card>
  );
}

// A row of StatSkeletons, using the same responsive grid every Stat grid
// in the app already uses, so `count` stat cards placeholder in exactly
// the space the real ones will occupy.
export function StatGridSkeleton({ count = 3, className }: { count?: number; className?: string }) {
  return (
    <div className={clsx("grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 mb-6", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <StatSkeleton key={i} />
      ))}
    </div>
  );
}

// Mirrors a <Table> — a header row of short bars, then `rows` rows of
// `cols` value-shaped bars — without needing real column data yet.
export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div>
      <div className="flex gap-4 pb-2.5 mb-2.5 border-b border-line">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-2.5 flex-1 max-w-[8rem]" />
        ))}
      </div>
      <div className="space-y-3.5">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-4">
            {Array.from({ length: cols }).map((__, c) => (
              <Skeleton key={c} className="h-3.5 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// The same TableSkeleton, pre-wrapped in a Card — the common case, since
// almost every table in the app sits inside one.
export function TableCardSkeleton({ rows = 5, cols = 4, className }: { rows?: number; cols?: number; className?: string }) {
  return (
    <Card className={className}>
      <TableSkeleton rows={rows} cols={cols} />
    </Card>
  );
}

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="relative">
      <div className="overflow-x-auto -mx-4 sm:mx-0 scroll-touch">
        <table className="w-full text-sm border-collapse min-w-[560px]">{children}</table>
      </div>
      {/* Right-edge fade hints that a wide table scrolls horizontally —
          otherwise on a phone it just looks like the table got cut off,
          with no signal there's more to see. Purely decorative, so it's
          hidden from assistive tech. */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 right-0 bottom-0 w-6 sm:hidden bg-gradient-to-l from-panel to-transparent"
      />
    </div>
  );
}

