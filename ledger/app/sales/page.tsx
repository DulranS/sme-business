"use client";

import { useMemo, useState } from "react";
import { useData } from "@/contexts/DataContext";
import { useToast } from "@/contexts/ToastContext";
import { formatMoney } from "@/lib/format";
import { QuickSaleForm } from "@/components/QuickForms";
import { Badge, Button, Card, Modal, PageHeader, Table, EmptyState } from "@/components/ui";

export default function SalesPage() {
  const { products, sales, saleEconomics, deleteSale, settings, loading } = useData();
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const currency = settings.currency;

  const econById = useMemo(() => new Map(saleEconomics.map((e) => [e.saleId, e])), [saleEconomics]);

  function handleDelete(saleId: string) {
    if (!confirm("Delete this sale? This can't be undone and will restore the units to inventory.")) return;
    deleteSale(saleId)
      .then(() => toast.success("Sale deleted"))
      .catch(() => toast.error("Couldn't delete the sale"));
  }

  return (
    <>
      <PageHeader
        title="Sales"
        action={
          <Button onClick={() => setModalOpen(true)} disabled={products.length === 0}>
            + Log sale
          </Button>
        }
      />

      {!loading && products.length === 0 && (
        <EmptyState title="Add an offering first" body="You need at least one product or service before logging a sale." />
      )}

      {!loading && products.length > 0 && sales.length === 0 && (
        <EmptyState title="No sales logged" body="Log a sale to see gross profit and contribution margin calculated automatically." />
      )}

      {sales.length > 0 && (
        <Card>
          <Table>
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted border-b border-line">
                <th className="py-2 pr-3 font-medium">Date</th>
                <th className="py-2 px-3 font-medium">Offering</th>
                <th className="py-2 px-3 font-medium text-right">Qty</th>
                <th className="py-2 px-3 font-medium text-right">Price</th>
                <th className="py-2 px-3 font-medium text-right">Revenue</th>
                <th className="py-2 px-3 font-medium text-right">Gross profit</th>
                <th className="py-2 px-3 font-medium text-right">Contribution</th>
                <th className="py-2 pl-3 font-medium text-right">·</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => {
                const product = products.find((p) => p.id === s.productId);
                const econ = econById.get(s.id);
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
                    </td>
                    <td className="py-2.5 px-3 num text-right">{s.qty}</td>
                    <td className="py-2.5 px-3 num text-right">{formatMoney(s.unitPrice, currency)}</td>
                    <td className="py-2.5 px-3 num text-right">{formatMoney(econ?.revenue ?? 0, currency)}</td>
                    <td className="py-2.5 px-3 num text-right">
                      <span className={econ && econ.grossProfit >= 0 ? "text-good" : "text-bad"}>
                        {formatMoney(econ?.grossProfit ?? 0, currency)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 num text-right text-muted">
                      {formatMoney(econ?.contributionMargin ?? 0, currency)}
                    </td>
                    <td className="py-2.5 pl-3 text-right">
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Log sale">
        <QuickSaleForm onDone={() => setModalOpen(false)} />
      </Modal>
    </>
  );
}
