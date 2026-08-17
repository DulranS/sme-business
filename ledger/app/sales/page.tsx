"use client";

import { useMemo, useState } from "react";
import { useData } from "@/contexts/DataContext";
import { useToast } from "@/contexts/ToastContext";
import { formatMoney } from "@/lib/format";
import { QuickSaleForm } from "@/components/QuickForms";
import { Badge, Button, Card, Modal, PageHeader, Table, EmptyState, Select } from "@/components/ui";

export default function SalesPage() {
  const { products, sales, saleEconomics, deleteSale, settings, loading, projects } = useData();
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const currency = settings.currency;

  const econById = useMemo(() => new Map(saleEconomics.map((e) => [e.saleId, e])), [saleEconomics]);

  const filteredSales = useMemo(() => {
    if (selectedProject === "all") return sales;
    return sales.filter((s) => s.projectId === selectedProject);
  }, [sales, selectedProject]);

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
          <Button onClick={() => setModalOpen(true)} disabled={products.length === 0}>
            + I sold something
          </Button>
        }
      />

      {projects.length > 0 && (
        <div className="mb-4">
          <Select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="max-w-xs"
          >
            <option value="all">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
      )}

      {!loading && products.length === 0 && (
        <EmptyState title="Add something to sell first" body="Add a product or service before you record a sale." />
      )}

      {!loading && products.length > 0 && filteredSales.length === 0 && sales.length > 0 && (
        <EmptyState title="No sales for this project" body="Select a different project or add sales to this project." />
      )}

      {!loading && products.length > 0 && sales.length === 0 && (
        <EmptyState title="Nothing sold yet" body="Record a sale and we'll work out your profit for you, automatically." />
      )}

      {filteredSales.length > 0 && (
        <Card>
          <div className="table-container">
            <Table>
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted border-b border-line">
                <th className="py-2 pr-3 font-medium">Date</th>
                <th className="py-2 px-3 font-medium">Item</th>
                <th className="py-2 px-3 font-medium text-right">How many</th>
                <th className="py-2 px-3 font-medium text-right">Price each</th>
                <th className="py-2 px-3 font-medium text-right">Money in</th>
                <th className="py-2 px-3 font-medium text-right">Profit</th>
                <th className="py-2 px-3 font-medium text-right">After extra costs</th>
                <th className="py-2 pl-3 font-medium text-right">·</th>
              </tr>
            </thead>
            <tbody>
              {filteredSales.map((s) => {
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
          </div>
        </Card>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="I sold something">
        <QuickSaleForm onDone={() => setModalOpen(false)} />
      </Modal>
    </>
  );
}
