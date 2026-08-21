"use client";

import { useMemo, useState } from "react";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { formatMoney, todayIso } from "@/lib/format";
import type { ReceivableLine } from "@/lib/calculations";
import type { Sale, Settings } from "@/lib/types";
import { QuickSaleForm } from "@/components/QuickForms";
import { RecordPaymentForm } from "@/components/RecordPaymentForm";
import { Badge, Button, Card, Modal, PageHeader, Table, EmptyState } from "@/components/ui";
import { escapeHtml, openPrintWindow, printBaseStyles, buildLetterheadHtml } from "@/lib/print";

export default function SalesPage() {
  const { role } = useAuth();
  if (role === "staff") return <StaffSalesView />;
  return <FullSalesView />;
}

// Owner/Manager: the complete record, with edit/delete and full economics.
function FullSalesView() {
  const { products, sales, saleEconomics, deleteSale, settings, loading, receivablesAging } = useData();
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Sale | null>(null);
  const [payingFor, setPayingFor] = useState<ReceivableLine | null>(null);
  const currency = settings.currency;

  const econById = useMemo(() => new Map(saleEconomics.map((e) => [e.saleId, e])), [saleEconomics]);
  const receivableBySaleId = useMemo(() => new Map(receivablesAging.lines.map((l) => [l.saleId, l])), [receivablesAging]);

  function openNew() {
    setEditing(null);
    setModalOpen(true);
  }
  function openEdit(s: Sale) {
    setEditing(s);
    setModalOpen(true);
  }

  function handleDelete(saleId: string) {
    if (!confirm("Delete this sale? This can't be undone — it'll put the stock back.")) return;
    deleteSale(saleId)
      .then(() => toast.success("Sale deleted"))
      .catch(() => toast.error("Couldn't delete the sale"));
  }

  return (
    <>
      <PageHeader
        title="Things You Sold"
        action={
          <Button onClick={openNew} disabled={products.length === 0}>
            + I sold something
          </Button>
        }
      />

      {!loading && products.length === 0 && (
        <EmptyState title="Add something to sell first" body="Add a product or service before you record a sale." />
      )}

      {!loading && products.length > 0 && sales.length === 0 && (
        <EmptyState title="Nothing sold yet" body="Record a sale and we'll work out your profit for you, automatically." />
      )}

      {sales.length > 0 && (
        <Card>
          <Table>
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted border-b border-line">
                <th className="py-2 pr-3 font-medium">Date</th>
                <th className="py-2 px-3 font-medium">Item</th>
                <th className="py-2 px-3 font-medium text-right">How many</th>
                <th className="py-2 px-3 font-medium text-right">Price each</th>
                <th className="py-2 px-3 font-medium text-right">Money in</th>
                <th className="py-2 px-3 font-medium text-right">Profit</th>
                <th className="py-2 px-3 font-medium">Who rang it up</th>
                <th className="py-2 pl-3 font-medium text-right">·</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => {
                const product = products.find((p) => p.id === s.productId);
                const econ = econById.get(s.id);
                const receivable = receivableBySaleId.get(s.id);
                const isCredit = (s.paymentMethod ?? "cash") === "credit";
                return (
                  <tr key={s.id} className="border-b border-line last:border-0">
                    <td className="py-2.5 pr-3 text-muted num">{s.date}</td>
                    <td className="py-2.5 px-3 font-medium">
                      {product?.name ?? "—"}
                      {product?.type === "service" && (
                        <span className="ml-1.5">
                          <Badge tone="amber">service</Badge>
                        </span>
                      )}
                      {econ?.oversold && (
                        <span className="ml-1.5">
                          <Badge tone="bad">oversold</Badge>
                        </span>
                      )}
                      {isCredit && (
                        <span className="ml-1.5">
                          <Badge tone={receivable ? "bad" : "good"}>{receivable ? `owed · due ${s.dueDate}` : "paid off"}</Badge>
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 num text-right">{s.qty}</td>
                    <td className="py-2.5 px-3 num text-right">
                      {formatMoney(s.unitPrice, currency)}
                      {s.currency && s.currency !== currency && s.foreignUnitPrice !== undefined && (
                        <div className="text-[11px] text-muted">{formatMoney(s.foreignUnitPrice, s.currency)}</div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 num text-right">{formatMoney(econ?.revenue ?? 0, currency)}</td>
                    <td className="py-2.5 px-3 num text-right">
                      <span className={econ && econ.grossProfit >= 0 ? "text-good" : "text-bad"}>
                        {formatMoney(econ?.grossProfit ?? 0, currency)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-muted text-xs">{s.createdByName ?? "—"}</td>
                    <td className="py-2.5 pl-3 text-right whitespace-nowrap">
                      {receivable && (
                        <button onClick={() => setPayingFor(receivable)} className="text-xs text-amber-soft hover:underline mr-3">
                          Record payment
                        </button>
                      )}
                      <button
                        onClick={() => openPrintWindow(buildSaleReceiptHtml(s, product?.name ?? "Item", settings))}
                        className="text-xs text-muted hover:text-fg mr-3"
                      >
                        Print receipt
                      </button>
                      <button onClick={() => openEdit(s)} className="text-xs text-muted hover:text-fg mr-3">
                        Edit
                      </button>
                      <button onClick={() => handleDelete(s.id)} className="text-xs text-muted hover:text-bad">
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit this sale" : "I sold something"}>
        <QuickSaleForm existingSale={editing ?? undefined} onDone={() => setModalOpen(false)} />
      </Modal>

      <Modal open={!!payingFor} onClose={() => setPayingFor(null)} title="Record a payment">
        {payingFor && <RecordPaymentForm line={payingFor} onDone={() => setPayingFor(null)} />}
      </Modal>
    </>
  );
}

// Staff: log a sale, see only what they personally rang up, no cost/margin,
// no edit, no delete. Record a payment against their own credit sales.
// This is the whole point of the role — a floor employee's entire footprint
// in the ledger is create-only, which is exactly what makes "log it low,
// pocket the difference" not work: there's nothing to quietly correct
// afterward.
function StaffSalesView() {
  const { catalog, sales, settings, loading, receivablesAging } = useData();
  const [modalOpen, setModalOpen] = useState(false);
  const [payingFor, setPayingFor] = useState<ReceivableLine | null>(null);
  const currency = settings.currency;

  const receivableBySaleId = useMemo(() => new Map(receivablesAging.lines.map((l) => [l.saleId, l])), [receivablesAging]);

  return (
    <>
      <PageHeader
        title="Your Sales Today"
        action={
          <Button onClick={() => setModalOpen(true)} disabled={catalog.length === 0}>
            + I sold something
          </Button>
        }
      />

      {!loading && catalog.length === 0 && (
        <EmptyState title="Nothing set up to sell yet" body="Ask your manager to add products before you can log a sale." />
      )}

      {!loading && catalog.length > 0 && sales.length === 0 && (
        <EmptyState title="Nothing logged yet" body="Every sale you log shows up here — you can't edit or delete once it's saved." />
      )}

      {sales.length > 0 && (
        <Card>
          <Table>
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted border-b border-line">
                <th className="py-2 pr-3 font-medium">Date</th>
                <th className="py-2 px-3 font-medium">Item</th>
                <th className="py-2 px-3 font-medium text-right">How many</th>
                <th className="py-2 px-3 font-medium text-right">Total</th>
                <th className="py-2 pl-3 font-medium">·</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => {
                const item = catalog.find((c) => c.id === s.productId);
                const receivable = receivableBySaleId.get(s.id);
                const isCredit = (s.paymentMethod ?? "cash") === "credit";
                return (
                  <tr key={s.id} className="border-b border-line last:border-0">
                    <td className="py-2.5 pr-3 text-muted num">{s.date}</td>
                    <td className="py-2.5 px-3 font-medium">
                      {item?.name ?? "—"}
                      {isCredit && (
                        <span className="ml-1.5">
                          <Badge tone={receivable ? "bad" : "good"}>{receivable ? `owed · due ${s.dueDate}` : "paid off"}</Badge>
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 num text-right">{s.qty}</td>
                    <td className="py-2.5 px-3 num text-right">{formatMoney(s.qty * s.unitPrice, currency)}</td>
                    <td className="py-2.5 pl-3 text-right whitespace-nowrap">
                      {receivable && (
                        <button onClick={() => setPayingFor(receivable)} className="text-xs text-amber-soft hover:underline mr-3">
                          Record payment
                        </button>
                      )}
                      <button
                        onClick={() => openPrintWindow(buildSaleReceiptHtml(s, item?.name ?? "Item", settings))}
                        className="text-xs text-muted hover:text-fg"
                      >
                        Print receipt
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="I sold something">
        <QuickSaleForm onDone={() => setModalOpen(false)} />
      </Modal>

      <Modal open={!!payingFor} onClose={() => setPayingFor(null)} title="Record a payment">
        {payingFor && <RecordPaymentForm line={payingFor} onDone={() => setPayingFor(null)} />}
      </Modal>
    </>
  );
}

// ---------------------------------------------------------------------------
// A printable receipt for a single sale — the retail/walk-in counterpart to
// the project quote/invoice in app/projects/page.tsx, sharing the same
// print machinery from lib/print.ts (letterhead, base styles, print
// trigger). Every SME sells *something* to a walk-in or one-off customer at
// some point, project-based or not, and until now there was no way to hand
// them anything on paper — every sale record just sat in the app. This
// covers a single sale line; a combined multi-item receipt for one register
// transaction isn't modeled here since Sale itself is one line per record.
// ---------------------------------------------------------------------------
function buildSaleReceiptHtml(sale: Sale, productName: string, settings: Settings): string {
  const currency = settings.currency;
  const isCredit = (sale.paymentMethod ?? "cash") === "credit";
  const total = sale.qty * sale.unitPrice;
  return `<!doctype html><html><head><meta charset="utf-8"><title>Receipt — ${escapeHtml(productName)}</title>${printBaseStyles()}</head>
    <body>
      ${buildLetterheadHtml(settings, "Receipt")}
      <div class="meta">
        <div>${sale.customer ? `<strong>Customer:</strong> ${escapeHtml(sale.customer)}` : ""}</div>
        <div><strong>Date:</strong> ${sale.date}</div>
      </div>
      <table>
        <thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Price</th><th class="num">Amount</th></tr></thead>
        <tbody>
          <tr>
            <td>${escapeHtml(productName)}</td>
            <td class="num">${sale.qty}</td>
            <td class="num">${formatMoney(sale.unitPrice, currency)}</td>
            <td class="num">${formatMoney(total, currency)}</td>
          </tr>
        </tbody>
        <tfoot><tr class="total-row"><td colspan="3">Total</td><td class="num">${formatMoney(total, currency)}</td></tr></tfoot>
      </table>
      ${
        isCredit
          ? `<div class="footer">Sold on credit${sale.dueDate ? ` — payment due ${sale.dueDate}` : ""}.</div>`
          : `<div class="footer">Paid${sale.paymentMethod ? ` by ${sale.paymentMethod.replace("_", " ")}` : ""} on ${sale.date}.</div>`
      }
      <div class="footer">Printed ${todayIso()}.</div>
    </body></html>`;
}
