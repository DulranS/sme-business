"use client";

import { useMemo, useState } from "react";
import { useData } from "@/contexts/DataContext";
import { formatMoney, formatNumber, todayIso } from "@/lib/format";
import type { OrderStatus, Product } from "@/lib/types";
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
  const [modalOpen, setModalOpen] = useState(false);
  const [receivingId, setReceivingId] = useState<string | null>(null);
  const currency = settings.currency;

  const stockProducts = useMemo(() => products.filter((p) => p.type === "product"), [products]);
  const openList = useMemo(
    () => purchaseOrders.filter((po) => po.status === "ordered" || po.status === "in_transit"),
    [purchaseOrders]
  );
  const closedList = useMemo(
    () => purchaseOrders.filter((po) => po.status === "received" || po.status === "cancelled"),
    [purchaseOrders]
  );

  return (
    <>
      <PageHeader
        title="Wholesale orders"
        action={
          <Button onClick={() => setModalOpen(true)} disabled={stockProducts.length === 0}>
            + Place order
          </Button>
        }
      />

      <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6">
        <Stat label="Open orders" value={formatNumber(openOrders.openOrderCount)} />
        <Stat label="Units on order" value={formatNumber(openOrders.openOrderUnits)} />
        <Stat label="Committed spend" value={formatMoney(openOrders.openOrderValue, currency)} tone="amber" />
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
                      <button onClick={() => cancelPurchaseOrder(po.id)} className="text-xs text-muted hover:text-bad">
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
                      <button onClick={() => deletePurchaseOrder(po.id)} className="text-xs text-muted hover:text-bad">
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Place wholesale order">
        <OrderForm
          products={stockProducts}
          onCancel={() => setModalOpen(false)}
          onSave={async (values) => {
            await addPurchaseOrder(values);
            setModalOpen(false);
          }}
        />
      </Modal>

      <Modal open={!!receivingId} onClose={() => setReceivingId(null)} title="Receive order">
        {receivingId && (
          <ReceiveForm
            po={purchaseOrders.find((p) => p.id === receivingId)!}
            onCancel={() => setReceivingId(null)}
            onSave={async (receipt) => {
              await receivePurchaseOrder(receivingId, receipt);
              setReceivingId(null);
            }}
          />
        )}
      </Modal>
    </>
  );
}

function OrderForm({
  products,
  onSave,
  onCancel,
}: {
  products: Product[];
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
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [qtyOrdered, setQtyOrdered] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [orderDate, setOrderDate] = useState(todayIso());
  const [expectedDate, setExpectedDate] = useState("");
  const [supplier, setSupplier] = useState("");
  const [notes, setNotes] = useState("");
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
          {busy ? "Saving…" : "Place order"}
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
