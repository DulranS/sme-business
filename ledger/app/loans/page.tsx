"use client";

import { useState } from "react";
import { useData } from "@/contexts/DataContext";
import { useToast, toastableErrorMessage } from "@/contexts/ToastContext";
import { useRequireRole } from "@/lib/roleGuard";
import { formatMoney, todayIso } from "@/lib/format";
import { computeLoanSummary, computeLoanSchedule } from "@/lib/calculations";
import type { Loan } from "@/lib/types";
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  Label,
  Modal,
  PageHeader,
  Stat,
  StatGridSkeleton,
  Table,
  TableCardSkeleton,
  EmptyState,
} from "@/components/ui";

export default function LoansPage() {
  const { allowed, loading: guardLoading } = useRequireRole(["owner", "manager"]);
  const { loans, loanPortfolio, addLoan, updateLoan, deleteLoan, settings, loading } = useData();
  const toast = useToast();
  const currency = settings.currency;
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Loan | null>(null);
  const [scheduleFor, setScheduleFor] = useState<Loan | null>(null);
  const asOf = todayIso();

  function openNew() {
    setEditing(null);
    setModalOpen(true);
  }
  function openEdit(l: Loan) {
    setEditing(l);
    setModalOpen(true);
  }

  if (guardLoading || !allowed) return null;

  if (loading) {
    return (
      <>
        <PageHeader title="Loans & debt" action={<Button disabled>+ Add loan</Button>} />
        <StatGridSkeleton count={4} />
        <TableCardSkeleton rows={4} cols={5} />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Loans & debt" action={<Button onClick={openNew}>+ Add loan</Button>} />

      {loans.length === 0 ? (
        <EmptyState
          title="No loans on record"
          body="Add a bank loan, equipment loan, or other business debt to see its monthly payment split (principal vs interest), remaining balance, and payoff date — and to have it flow into your P&L and Balance Sheet automatically."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
            <Stat label="Outstanding balance" value={formatMoney(loanPortfolio.totalOutstanding, currency)} tone="bad" />
            <Stat label="Debt service / month" value={formatMoney(loanPortfolio.totalMonthlyPayment, currency)} />
            <Stat label="Interest paid to date" value={formatMoney(loanPortfolio.totalInterestPaidToDate, currency)} sub="the true cost of borrowing" />
            <Stat label="Principal paid to date" value={formatMoney(loanPortfolio.totalPrincipalPaidToDate, currency)} tone="good" />
          </div>

          <Card>
            <Table>
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted border-b border-line">
                  <th className="py-2 pr-3 font-medium">Loan</th>
                  <th className="py-2 px-3 font-medium text-right">Original</th>
                  <th className="py-2 px-3 font-medium text-right">Rate</th>
                  <th className="py-2 px-3 font-medium text-right">Balance</th>
                  <th className="py-2 px-3 font-medium text-right">Monthly payment</th>
                  <th className="py-2 px-3 font-medium text-right">Progress</th>
                  <th className="py-2 px-3 font-medium">Payoff</th>
                  <th className="py-2 pl-3 font-medium text-right">·</th>
                </tr>
              </thead>
              <tbody>
                {loans.map((l) => {
                  const s = computeLoanSummary(l, asOf);
                  const paidOff = s.currentBalance <= 0;
                  return (
                    <tr key={l.id} className="border-b border-line last:border-0">
                      <td className="py-2.5 pr-3">
                        <div className="font-medium">{l.name}</div>
                        <div className="flex gap-1 mt-0.5">
                          {!l.active && <Badge>closed</Badge>}
                          {l.lender && <span className="text-xs text-muted">{l.lender}</span>}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 num text-right text-muted">{formatMoney(l.principal, currency)}</td>
                      <td className="py-2.5 px-3 num text-right text-muted">{l.annualInterestRatePct.toFixed(1)}%</td>
                      <td className="py-2.5 px-3 num text-right">
                        {paidOff ? (
                          <Badge tone="good">paid off</Badge>
                        ) : (
                          formatMoney(s.currentBalance, currency)
                        )}
                      </td>
                      <td className="py-2.5 px-3 num text-right text-muted">{formatMoney(s.monthlyPayment, currency)}</td>
                      <td className="py-2.5 px-3 num text-right text-muted">{s.percentPaid.toFixed(0)}%</td>
                      <td className="py-2.5 px-3 text-muted text-xs">{s.payoffDate ?? "—"}</td>
                      <td className="py-2.5 pl-3 text-right whitespace-nowrap">
                        <button onClick={() => setScheduleFor(l)} className="text-xs text-amber-soft hover:underline mr-3">
                          See payments
                        </button>
                        <button onClick={() => openEdit(l)} className="text-xs text-muted hover:text-fg">
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            <div className="text-[11px] text-muted mt-3">
              Interest and principal are split automatically each month using a standard amortization schedule and
              flow into the Income Statement (interest expense) and Cash Flow Statement (principal repayment) on the{" "}
              <a href="/statements" className="text-amber-soft">
                Statements
              </a>{" "}
              page.
            </div>
          </Card>
        </>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit loan" : "Add loan"}>
        <LoanForm
          initial={editing}
          onCancel={() => setModalOpen(false)}
          onSave={async (values) => {
            try {
              if (editing) await updateLoan(editing.id, values);
              else await addLoan(values);
              toast.success(editing ? "Loan updated" : "Loan added", values.name);
              setModalOpen(false);
            } catch (err) {
              toast.error("Couldn't save the loan", toastableErrorMessage(err));
            }
          }}
          onDelete={
            editing
              ? async () => {
                  if (!confirm(`Delete "${editing.name}"? This can't be undone.`)) return;
                  try {
                    await deleteLoan(editing.id);
                    toast.success("Loan deleted", editing.name);
                    setModalOpen(false);
                  } catch (err) {
                    toast.error("Couldn't delete the loan", toastableErrorMessage(err));
                  }
                }
              : undefined
          }
        />
      </Modal>

      <Modal open={!!scheduleFor} onClose={() => setScheduleFor(null)} title={scheduleFor ? `Payments — ${scheduleFor.name}` : "Payments"}>
        {scheduleFor && <LoanSchedule loan={scheduleFor} currency={currency} asOf={asOf} />}
      </Modal>
    </>
  );
}

function LoanSchedule({ loan, currency, asOf }: { loan: Loan; currency: string; asOf: string }) {
  const schedule = computeLoanSchedule(loan);
  return (
    <div>
      <div className="text-xs text-muted mb-3">
        Every payment, split into how much goes to interest (the cost of borrowing) vs. principal (what actually
        reduces what you owe) — this is what your Statements pull from each month.
      </div>
      <div className="max-h-[60vh] overflow-y-auto -mx-1 px-1">
        <Table>
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-muted border-b border-line sticky top-0 bg-panel">
              <th className="py-2 pr-3 font-medium">#</th>
              <th className="py-2 px-3 font-medium">Date</th>
              <th className="py-2 px-3 font-medium text-right">Payment</th>
              <th className="py-2 px-3 font-medium text-right">Interest</th>
              <th className="py-2 px-3 font-medium text-right">Principal</th>
              <th className="py-2 pl-3 font-medium text-right">Balance after</th>
            </tr>
          </thead>
          <tbody>
            {schedule.map((p) => (
              <tr key={p.periodIndex} className={`border-b border-line last:border-0 ${p.date <= asOf ? "" : "text-muted"}`}>
                <td className="py-2 pr-3 num text-muted">{p.periodIndex}</td>
                <td className="py-2 px-3 num">{p.date}</td>
                <td className="py-2 px-3 num text-right">{formatMoney(p.payment, currency)}</td>
                <td className="py-2 px-3 num text-right text-bad">{formatMoney(p.interest, currency)}</td>
                <td className="py-2 px-3 num text-right text-good">{formatMoney(p.principal, currency)}</td>
                <td className="py-2 pl-3 num text-right text-muted">{formatMoney(p.balance, currency)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </div>
  );
}

function LoanForm({
  initial,
  onSave,
  onCancel,
  onDelete,
}: {
  initial: Loan | null;
  onSave: (values: Omit<Loan, "id" | "createdAt">) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [lender, setLender] = useState(initial?.lender ?? "");
  const [principal, setPrincipal] = useState(initial?.principal?.toString() ?? "");
  const [annualInterestRatePct, setAnnualInterestRatePct] = useState(
    initial?.annualInterestRatePct?.toString() ?? ""
  );
  const [termMonths, setTermMonths] = useState(initial?.termMonths?.toString() ?? "");
  const [startDate, setStartDate] = useState(initial?.startDate ?? todayIso());
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [active, setActive] = useState(initial?.active ?? true);
  const [busy, setBusy] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        await onSave({
          name,
          lender: lender || undefined,
          principal: Number(principal),
          annualInterestRatePct: Number(annualInterestRatePct),
          termMonths: Number(termMonths),
          startDate,
          notes: notes || undefined,
          active,
        });
        setBusy(false);
      }}
      className="space-y-4"
    >
      <Field>
        <Label>Loan name</Label>
        <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Working capital loan" />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field>
          <Label>Lender (optional)</Label>
          <Input value={lender} onChange={(e) => setLender(e.target.value)} placeholder="e.g. Bank of Ceylon" />
        </Field>
        <Field>
          <Label>Disbursement date</Label>
          <Input required type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Field>
          <Label>Principal ({"amount"})</Label>
          <Input required type="number" min="0" step="0.01" value={principal} onChange={(e) => setPrincipal(e.target.value)} />
        </Field>
        <Field>
          <Label>Annual rate %</Label>
          <Input
            required
            type="number"
            min="0"
            step="0.01"
            value={annualInterestRatePct}
            onChange={(e) => setAnnualInterestRatePct(e.target.value)}
          />
        </Field>
        <Field className="col-span-2 sm:col-span-1">
          <Label>Term (months)</Label>
          <Input required type="number" min="1" step="1" value={termMonths} onChange={(e) => setTermMonths(e.target.value)} />
        </Field>
      </div>
      <div className="text-[11px] text-muted -mt-2">
        Assumes equal monthly payments (standard amortizing loan), first payment one month after the disbursement date.
      </div>
      <Field>
        <Label>Notes (optional)</Label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <label className="flex items-center gap-2 text-sm text-muted">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="accent-amber" />
        Active (uncheck if closed/paid off early — kept for history, excluded from current liabilities)
      </label>
      <div className="flex items-center justify-between pt-2">
        <div>
          {onDelete && (
            <Button type="button" variant="danger" onClick={onDelete}>
              Delete
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </form>
  );
}
