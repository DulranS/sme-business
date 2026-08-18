"use client";

import { useState } from "react";
import { useData } from "@/contexts/DataContext";
import { useToast, toastableErrorMessage } from "@/contexts/ToastContext";
import { formatMoney, todayIso } from "@/lib/format";
import { computeFixedAssetStatus } from "@/lib/calculations";
import type { FixedAsset } from "@/lib/types";
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  Label,
  Modal,
  PageHeader,
  Select,
  Stat,
  Table,
  EmptyState,
} from "@/components/ui";

const ASSET_CATEGORIES = [
  "Machinery & equipment",
  "Vehicles",
  "Furniture & fixtures",
  "Computers & electronics",
  "Buildings & leasehold improvements",
  "Other",
];

export default function AssetsPage() {
  const { fixedAssets, addFixedAsset, updateFixedAsset, deleteFixedAsset, settings } = useData();
  const toast = useToast();
  const currency = settings.currency;
  const asOf = todayIso();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FixedAsset | null>(null);

  function openNew() {
    setEditing(null);
    setModalOpen(true);
  }
  function openEdit(a: FixedAsset) {
    setEditing(a);
    setModalOpen(true);
  }

  const statuses = fixedAssets.map((a) => computeFixedAssetStatus(a, asOf));
  const held = statuses.filter((s) => !s.disposed);
  const totalNetBookValue = held.reduce((sum, s) => sum + s.netBookValue, 0);
  const totalCost = held.reduce((sum, s) => sum + s.asset.cost, 0);
  const monthlyDepreciation = held.reduce((sum, s) => sum + (s.fullyDepreciated ? 0 : s.monthlyDepreciation), 0);

  return (
    <>
      <PageHeader title="Fixed assets" action={<Button onClick={openNew}>+ Add asset</Button>} />

      {fixedAssets.length === 0 ? (
        <EmptyState
          title="No fixed assets on record"
          body="Machinery, vehicles, equipment, or fixtures the business owns and uses over time — not inventory held for resale, not a one-off expense. Depreciated straight-line over its useful life; the monthly charge flows into your Income Statement automatically, and net book value shows up on your Balance Sheet."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
            <Stat label="Net book value" value={formatMoney(totalNetBookValue, currency)} tone="good" />
            <Stat label="Original cost (held)" value={formatMoney(totalCost, currency)} />
            <Stat label="Depreciation / month" value={formatMoney(monthlyDepreciation, currency)} sub="non-cash expense" />
            <Stat label="Assets held" value={String(held.length)} />
          </div>

          <Card>
            <div className="table-container">
              <Table>
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted border-b border-line">
                    <th className="py-2 pr-3 font-medium">Asset</th>
                    <th className="py-2 px-3 font-medium text-right">Cost</th>
                    <th className="py-2 px-3 font-medium text-right">Accum. depreciation</th>
                    <th className="py-2 px-3 font-medium text-right">Net book value</th>
                    <th className="py-2 px-3 font-medium text-right">Monthly charge</th>
                    <th className="py-2 pl-3 font-medium text-right">·</th>
                  </tr>
                </thead>
                <tbody>
                  {statuses.map((s) => (
                    <tr key={s.asset.id} className="border-b border-line last:border-0">
                      <td className="py-2.5 pr-3">
                        <div className="font-medium">{s.asset.name}</div>
                        <div className="flex gap-1 mt-0.5 items-center">
                          {s.disposed && <Badge>disposed</Badge>}
                          {!s.disposed && s.fullyDepreciated && <Badge tone="amber">fully depreciated</Badge>}
                          <span className="text-xs text-muted">{s.asset.category}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 num text-right text-muted">
                        {formatMoney(s.asset.cost, currency)}
                      </td>
                      <td className="py-2.5 px-3 num text-right text-muted">
                        {formatMoney(s.accumulatedDepreciation, currency)}
                      </td>
                      <td className="py-2.5 px-3 num text-right">{formatMoney(s.netBookValue, currency)}</td>
                      <td className="py-2.5 px-3 num text-right text-muted">
                        {s.disposed || s.fullyDepreciated ? "—" : formatMoney(s.monthlyDepreciation, currency)}
                      </td>
                      <td className="py-2.5 pl-3 text-right">
                        <button onClick={() => openEdit(s.asset)} className="text-xs text-muted hover:text-fg">
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
            <div className="text-[11px] text-muted mt-3">
              Straight-line depreciation: (cost − salvage value) ÷ useful life in months, starting the month of
              purchase. The monthly charge is a non-cash expense on the Income Statement — the actual cash cost
              hits Investing Cash Flow once, on the purchase date, on the{" "}
              <a href="/statements" className="text-amber-soft">
                Statements
              </a>{" "}
              page.
            </div>
          </Card>
        </>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit asset" : "Add asset"}>
        <AssetForm
          initial={editing}
          onCancel={() => setModalOpen(false)}
          onSave={async (values) => {
            try {
              if (editing) await updateFixedAsset(editing.id, values);
              else await addFixedAsset(values);
              toast.success(editing ? "Asset updated" : "Asset added", values.name);
              setModalOpen(false);
            } catch (err) {
              toast.error("Couldn't save the asset", toastableErrorMessage(err));
            }
          }}
          onDelete={
            editing
              ? async () => {
                  if (!confirm(`Delete "${editing.name}"? This can't be undone.`)) return;
                  try {
                    await deleteFixedAsset(editing.id);
                    toast.success("Asset deleted", editing.name);
                    setModalOpen(false);
                  } catch (err) {
                    toast.error("Couldn't delete the asset", toastableErrorMessage(err));
                  }
                }
              : undefined
          }
        />
      </Modal>
    </>
  );
}

function AssetForm({
  initial,
  onSave,
  onCancel,
  onDelete,
}: {
  initial: FixedAsset | null;
  onSave: (values: Omit<FixedAsset, "id" | "createdAt">) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState(initial?.category ?? ASSET_CATEGORIES[0]);
  const [purchaseDate, setPurchaseDate] = useState(initial?.purchaseDate ?? todayIso());
  const [cost, setCost] = useState(initial?.cost?.toString() ?? "");
  const [usefulLifeMonths, setUsefulLifeMonths] = useState(initial?.usefulLifeMonths?.toString() ?? "60");
  const [salvageValue, setSalvageValue] = useState(initial?.salvageValue?.toString() ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [disposed, setDisposed] = useState(!!initial?.disposalDate);
  const [disposalDate, setDisposalDate] = useState(initial?.disposalDate ?? todayIso());
  const [disposalAmount, setDisposalAmount] = useState(initial?.disposalAmount?.toString() ?? "");
  const [busy, setBusy] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        await onSave({
          name,
          category,
          purchaseDate,
          cost: Number(cost),
          usefulLifeMonths: Number(usefulLifeMonths),
          salvageValue: salvageValue ? Number(salvageValue) : undefined,
          notes: notes || undefined,
          disposalDate: disposed ? disposalDate : undefined,
          disposalAmount: disposed && disposalAmount ? Number(disposalAmount) : undefined,
        });
        setBusy(false);
      }}
      className="space-y-4"
    >
      <Field>
        <Label>Asset name</Label>
        <Input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. PP Spunbond fabric machine"
        />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field>
          <Label>Category</Label>
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            {ASSET_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
        <Field>
          <Label>Purchase date</Label>
          <Input required type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field>
          <Label>Cost</Label>
          <Input required type="number" min="0" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} />
        </Field>
        <Field>
          <Label>Useful life (months)</Label>
          <Input
            required
            type="number"
            min="1"
            step="1"
            value={usefulLifeMonths}
            onChange={(e) => setUsefulLifeMonths(e.target.value)}
          />
        </Field>
        <Field>
          <Label>Salvage value (optional)</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={salvageValue}
            onChange={(e) => setSalvageValue(e.target.value)}
            placeholder="0"
          />
        </Field>
      </div>
      <div className="text-[11px] text-muted -mt-2">
        Straight-line: (cost − salvage) ÷ useful life, expensed monthly starting the purchase month.
      </div>
      <Field>
        <Label>Notes (optional)</Label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <label className="flex items-center gap-2 text-sm text-muted">
        <input type="checkbox" checked={disposed} onChange={(e) => setDisposed(e.target.checked)} className="accent-amber" />
        Sold or scrapped
      </label>
      {disposed && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-6">
          <Field>
            <Label>Disposal date</Label>
            <Input type="date" value={disposalDate} onChange={(e) => setDisposalDate(e.target.value)} />
          </Field>
          <Field>
            <Label>Amount received (optional)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={disposalAmount}
              onChange={(e) => setDisposalAmount(e.target.value)}
              placeholder="0 if scrapped"
            />
          </Field>
        </div>
      )}
      <div className="flex items-center justify-between pt-2 flex-wrap gap-2">
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
