"use client";

import clsx from "clsx";
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
      <div className={clsx("num text-2xl sm:text-3xl mt-1.5 font-medium", toneClass)}>{value}</div>
      {sub && <div className="text-xs text-muted mt-1">{sub}</div>}
    </Card>
  );
}

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }) {
  const base = "px-3.5 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed";
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
        "w-full bg-panel2 border border-line rounded-md px-3 py-2 text-sm text-fg placeholder:text-muted focus:outline-none focus:border-amber-dim",
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
        "w-full bg-panel2 border border-line rounded-md px-3 py-2 text-sm text-fg focus:outline-none focus:border-amber-dim",
        props.className
      )}
    />
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <label className="block text-xs text-muted mb-1.5">{children}</label>;
}

export function Field({ children }: { children: ReactNode }) {
  return <div>{children}</div>;
}

export function PageHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-5 sm:mb-6">
      <h1 className="font-display text-xl sm:text-2xl font-medium">{title}</h1>
      {action}
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
    <span className={clsx("text-[11px] px-1.5 py-0.5 rounded border font-medium", toneClass)}>
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
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-panel border border-line rounded-t-lg sm:rounded-lg w-full sm:max-w-lg max-h-[90vh] overflow-y-auto p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-medium">{title}</h2>
          <button
            onClick={onClose}
            className="text-muted hover:text-fg w-7 h-7 flex items-center justify-center rounded-md hover:bg-panel2"
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

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0">
      <table className="w-full text-sm border-collapse min-w-[560px]">{children}</table>
    </div>
  );
}
