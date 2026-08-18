"use client";

import { useMemo, useState } from "react";
import { useData } from "@/contexts/DataContext";
import { useToast, toastableErrorMessage } from "@/contexts/ToastContext";
import { useRequireRole } from "@/lib/roleGuard";
import { formatMoney, formatNumber, todayIso } from "@/lib/format";
import type { OrderStatus, Product, PurchaseOrder } from "@/lib/types";
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

const STATUS_TONE: Record<OrderStatus, "default" | "good" | "bad" | "amber"> = {
  ordered: "amber",
  in_transit: "amber",
  received: "good",
  cancelled: "bad",
};

export default function PurchaseOrdersPage() {
  const { allowed, loading: guardLoading } = useRequireRole(["owner", "manager"]);
  const {
    products,
    purchaseOrders,
    addPurchaseOrder,
    updatePurchaseOrder,
    cancelPurchaseOrder,
    deletePurchaseOrder,
    receivePurchaseOrder,
    openOrders,
    settings,
    loading,
  } = useData();
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PurchaseOrder | null>(null);
  const [receivingId, setReceivingId] = useState<string | null>(null);
  const currency = settings.currency;

  function openNew() {
    setEditing(null);
    setModalOpen(true);
  }
  function openEdit(po: PurchaseOrder) {
    setEditing(po);
    setModalOpen(true);
  }

  function handleCancel(id: string) {
    if (!confirm("Cancel this order? You can still delete it afterward if it was a mistake.")) return;
    cancelPurchaseOrder(id)
      .then(() => toast.success("Order cancelled"))
      .catch(() => toast.error("Couldn't cancel the order"));
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this order from history? This can't be undone.")) return;
    deletePurchaseOrder(id)
      .then(() => toast.success("Order deleted"))
      .catch(() => toast.error("Couldn't delete the order"));
  }

  const stockProducts = useMemo(() => products.filter((p) => p.type === "product"), [products]);
  const openList = useMemo(
    () => purchaseOrders.filter((po) => po.status === "ordered" || po.status === "in_transit"),
    [purchaseOrders]
  );
  const closedList = useMemo(
    () => purchaseOrders.filter((po) => po.status === "received" || po.status === "cancelled"),
    [purchaseOrders]
  );

  if (guardLoading || !allowed) return null;

  return (
    <>
      <PageHeader
        title="Wholesale orders"
        action={
          <Button onClick={openNew} disabled={stockProducts.length === 0}>
            + Place order
          </Button>
        }
      />

      <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6">
        <Stat label="Open orders" value={formatNumber(openOrders.openOrderCount)} />
        <Stat label="Units on order" value={formatNumber(openOrders.openOrderUnits)} />
        <Stat label="Already committed to spend" value={formatMoney(openOrders.openOrderValue, currency)} tone="amber" />
      </div>

      {!loading && stockProducts.length === 0 && (
        <EmptyState
          title="Add a physical product first"
          body="Wholesale orders apply to type: product offerings — services have nothing to reorder. Add one on the Products page."
        />
      )}

      {!loading && stockProducts.length > 0 && purchaseOrders.length === 0 && (
        <EmptyState
          title="No orders placed yet"
          body="Place a wholesale order to track it from commitment through to delivery. Receiving it automatically logs the stock on the Purchases page."
        />
      )}

      {openList.length > 0 && (
        <Card className="mb-6">
          <div className="text-sm font-medium mb-3">Open orders</div>
          <Table>
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted border-b border-line">
                <th className="py-2 pr-3 font-medium">Ordered</th>
                <th className="py-2 px-3 font-medium">Product</th>
                <th className="py-2 px-3 font-medium text-right">Qty</th>
                <th className="py-2 px-3 font-medium text-right">Unit cost</th>
                <th className="py-2 px-3 font-medium">Expected</th>
                <th className="py-2 px-3 font-medium">Supplier</th>
                <th className="py-2 px-3 font-medium">Status</th>
                <th className="py-2 pl-3 font-medium text-right">·</th>
              </tr>
            </thead>
            <tbody>
              {openList.map((po) => {
                const product = products.find((p) => p.id === po.productId);
                return (
                  <tr key={po.id} className="border-b border-line last:border-0">
                    <td className="py-2.5 pr-3 text-muted num">{po.orderDate}</td>
                    <td className="py-2.5 px-3 font-medium">{product?.name ?? "—"}</td>
                    <td className="py-2.5 px-3 num text-right">{po.qtyOrdered}</td>
                    <td className="py-2.5 px-3 num text-right">{formatMoney(po.unitCost, currency)}</td>
                    <td className="py-2.5 px-3 text-muted num">{po.expectedDate || "—"}</td>
                    <td className="py-2.5 px-3 text-muted">{po.supplier || "—"}</td>
                    <td className="py-2.5 px-3">
                      <Badge tone={STATUS_TONE[po.status]}>{po.status.replace("_", " ")}</Badge>
                    </td>
                    <td className="py-2.5 pl-3 text-right whitespace-nowrap">
                      <button onClick={() => setReceivingId(po.id)} className="text-xs text-good hover:underline mr-3">
                        Receive
                      </button>
                      <button onClick={() => openEdit(po)} className="text-xs text-muted hover:text-fg mr-3">
                        Edit
                      </button>
                      <button onClick={() => handleCancel(po.id)} className="text-xs text-muted hover:text-bad">
                        Cancel
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      )}

      {closedList.length > 0 && (
        <Card>
          <div className="text-sm font-medium mb-3">Order history</div>
          <Table>
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted border-b border-line">
                <th className="py-2 pr-3 font-medium">Ordered</th>
                <th className="py-2 px-3 font-medium">Product</th>
                <th className="py-2 px-3 font-medium text-right">Qty ordered</th>
                <th className="py-2 px-3 font-medium text-right">Qty received</th>
                <th className="py-2 px-3 font-medium">Status</th>
                <th className="py-2 pl-3 font-medium text-right">·</th>
              </tr>
            </thead>
            <tbody>
              {closedList.map((po) => {
                const product = products.find((p) => p.id === po.productId);
                return (
                  <tr key={po.id} className="border-b border-line last:border-0">
                    <td className="py-2.5 pr-3 text-muted num">{po.orderDate}</td>
                    <td className="py-2.5 px-3 font-medium">{product?.name ?? "—"}</td>
                    <td className="py-2.5 px-3 num text-right">{po.qtyOrdered}</td>
                    <td className="py-2.5 px-3 num text-right">{po.qtyReceived ?? "—"}</td>
                    <td className="py-2.5 px-3">
                      <Badge tone={STATUS_TONE[po.status]}>{po.status}</Badge>
                    </td>
                    <td className="py-2.5 pl-3 text-right">
                      <button onClick={() => handleDelete(po.id)} className="text-xs text-muted hover:text-bad">
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit order" : "Place wholesale order"}>
        <OrderForm
          products={stockProducts}
          initial={editing}
          onCancel={() => setModalOpen(false)}
          onSave={async (values) => {
            try {
              if (editing) {
                await updatePurchaseOrder(editing.id, values);
                toast.success("Order updated");
              } else {
                await addPurchaseOrder(values);
                toast.success("Order placed");
              }
              setModalOpen(false);
            } catch (err) {
              toast.error(editing ? "Couldn't update the order" : "Couldn't place the order", toastableErrorMessage(err));
            }
          }}
        />
      </Modal>

      <Modal open={!!receivingId} onClose={() => setReceivingId(null)} title="Receive order">
        {receivingId && (
          <ReceiveForm
            po={purchaseOrders.find((p) => p.id === receivingId)!}
            onCancel={() => setReceivingId(null)}
            onSave={async (receipt) => {
              try {
                await receivePurchaseOrder(receivingId, receipt);
                toast.success("Order received", "Stock updated");
                setReceivingId(null);
              } catch (err) {
                toast.error("Couldn't receive the order", toastableErrorMessage(err));
              }
            }}
          />
        )}
      </Modal>
    </>
  );
}

function OrderForm({
  products,
  initial,
  onSave,
  onCancel,
}: {
  products: Product[];
  initial?: PurchaseOrder | null;
  onSave: (values: {
    productId: string;
    qtyOrdered: number;
    unitCost: number;
    orderDate: string;
    expectedDate?: string;
    supplier?: string;
    notes?: string;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [productId, setProductId] = useState(initial?.productId ?? products[0]?.id ?? "");
  const [qtyOrdered, setQtyOrdered] = useState(initial?.qtyOrdered?.toString() ?? "");
  const [unitCost, setUnitCost] = useState(initial?.unitCost?.toString() ?? "");
  const [orderDate, setOrderDate] = useState(initial?.orderDate ?? todayIso());
  const [expectedDate, setExpectedDate] = useState(initial?.expectedDate ?? "");
  const [supplier, setSupplier] = useState(initial?.supplier ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [busy, setBusy] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        await onSave({
          productId,
          qtyOrdered: Number(qtyOrdered),
          unitCost: Number(unitCost),
          orderDate,
          expectedDate: expectedDate || undefined,
          supplier,
          notes,
        });
        setBusy(false);
      }}
      className="space-y-4"
    >
      <Field>
        <Label>Product</Label>
        <Select required value={productId} onChange={(e) => setProductId(e.target.value)}>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <Label>Quantity ordered</Label>
          <Input required type="number" min="0" step="1" value={qtyOrdered} onChange={(e) => setQtyOrdered(e.target.value)} />
        </Field>
        <Field>
          <Label>Quoted unit cost</Label>
          <Input required type="number" min="0" step="0.01" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <Label>Order date</Label>
          <Input required type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
        </Field>
        <Field>
          <Label>Expected delivery (optional)</Label>
          <Input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
        </Field>
      </div>
      <Field>
        <Label>Supplier (optional)</Label>
        <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} />
      </Field>
      <Field>
        <Label>Notes (optional)</Label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : initial ? "Save changes" : "Place order"}
        </Button>
      </div>
    </form>
  );
}

function ReceiveForm({
  po,
  onSave,
  onCancel,
}: {
  po: { qtyOrdered: number; unitCost: number };
  onSave: (receipt: { qtyReceived: number; receivedUnitCost: number; receivedDate: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const [qtyReceived, setQtyReceived] = useState(po.qtyOrdered.toString());
  const [receivedUnitCost, setReceivedUnitCost] = useState(po.unitCost.toString());
  const [receivedDate, setReceivedDate] = useState(todayIso());
  const [busy, setBusy] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        await onSave({
          qtyReceived: Number(qtyReceived),
          receivedUnitCost: Number(receivedUnitCost),
          receivedDate,
        });
        setBusy(false);
      }}
      className="space-y-4"
    >
      <div className="text-xs text-muted">
        Confirm what actually arrived — this creates the inventory entry. Quantity or cost can differ from what was
        originally ordered.
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <Label>Quantity received</Label>
          <Input required type="number" min="0" step="1" value={qtyReceived} onChange={(e) => setQtyReceived(e.target.value)} />
        </Field>
        <Field>
          <Label>Actual unit cost</Label>
          <Input required type="number" min="0" step="0.01" value={receivedUnitCost} onChange={(e) => setReceivedUnitCost(e.target.value)} />
        </Field>
      </div>
      <Field>
        <Label>Received date</Label>
        <Input required type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} />
      </Field>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Mark received"}
        </Button>
      </div>
    </form>
  );
}
