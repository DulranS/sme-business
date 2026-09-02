// Invoice generation for sales
import type { Sale, Product } from "./types";

export interface Invoice {
  id: string;
  invoiceNumber: string;
  saleId: string;
  customerName?: string;
  customerContact?: string;
  items: InvoiceItem[];
  subtotal: number;
  taxAmount: number;
  total: number;
  currency: string;
  issueDate: string;
  dueDate?: string;
  status: "draft" | "sent" | "paid" | "overdue";
  notes?: string;
  createdAt: number;
}

export interface InvoiceItem {
  productId: string;
  productName: string;
  sku?: string;
  qty: number;
  unitPrice: number;
  total: number;
}

export interface InvoiceTemplate {
  businessName?: string;
  businessAddress?: string;
  businessPhone?: string;
  logoUrl?: string;
}

/**
 * Generate invoice number (format: INV-YYYY-XXXX)
 */
export function generateInvoiceNumber(lastInvoiceNumber?: string): string {
  const year = new Date().getFullYear();
  let sequence = 1;

  if (lastInvoiceNumber) {
    const match = lastInvoiceNumber.match(/INV-(\d+)-(\d+)/);
    if (match) {
      const lastYear = parseInt(match[1]);
      const lastSequence = parseInt(match[2]);
      if (lastYear === year) {
        sequence = lastSequence + 1;
      }
    }
  }

  return `INV-${year}-${String(sequence).padStart(4, '0')}`;
}

/**
 * Convert a sale to an invoice
 */
export function saleToInvoice(
  sale: Sale,
  product: Product,
  lastInvoiceNumber?: string,
  taxRatePct = 0
): Invoice {
  const subtotal = sale.qty * sale.unitPrice;
  const taxAmount = subtotal * (taxRatePct / 100);
  const total = subtotal + taxAmount;

  const dueDate = sale.dueDate || sale.date;

  return {
    id: sale.id, // Use sale ID as invoice ID for simplicity
    invoiceNumber: generateInvoiceNumber(lastInvoiceNumber),
    saleId: sale.id,
    customerName: sale.customer,
    customerContact: sale.customerContact,
    items: [{
      productId: sale.productId,
      productName: product.name,
      sku: product.sku,
      qty: sale.qty,
      unitPrice: sale.unitPrice,
      total: subtotal,
    }],
    subtotal,
    taxAmount,
    total,
    currency: sale.currency || "LKR",
    issueDate: sale.date,
    dueDate,
    status: sale.paymentMethod === "credit" ? "sent" : "paid",
    notes: sale.notes,
    createdAt: sale.createdAt,
  };
}

/**
 * Generate HTML for invoice printing
 */
export function generateInvoiceHtml(
  invoice: Invoice,
  template: InvoiceTemplate
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Invoice ${invoice.invoiceNumber}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    .header { display: flex; justify-content: space-between; margin-bottom: 30px; }
    .business-info { flex: 1; }
    .invoice-info { text-align: right; }
    .invoice-number { font-size: 24px; font-weight: bold; color: #333; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f5f5f5; }
    .totals { text-align: right; margin-top: 20px; }
    .total-row { display: flex; justify-content: flex-end; margin: 5px 0; }
    .total-label { width: 150px; }
    .total-amount { width: 150px; font-weight: bold; }
    .grand-total { font-size: 18px; border-top: 2px solid #333; padding-top: 10px; }
    .status { display: inline-block; padding: 5px 10px; border-radius: 3px; font-size: 12px; font-weight: bold; }
    .status.sent { background: #e3f2fd; color: #1976d2; }
    .status.paid { background: #e8f5e9; color: #388e3c; }
    .status.overdue { background: #ffebee; color: #d32f2f; }
    .status.draft { background: #f5f5f5; color: #666; }
  </style>
</head>
<body>
  <div class="header">
    <div class="business-info">
      ${template.logoUrl ? `<img src="${template.logoUrl}" alt="" style="width:48px;height:48px;object-fit:contain;border-radius:4px;margin-bottom:8px;" />` : ''}
      ${template.businessName ? `<h1>${template.businessName}</h1>` : ''}
      ${template.businessAddress ? `<p>${template.businessAddress}</p>` : ''}
      ${template.businessPhone ? `<p>${template.businessPhone}</p>` : ''}
    </div>
    <div class="invoice-info">
      <div class="invoice-number">INVOICE</div>
      <p><strong>${invoice.invoiceNumber}</strong></p>
      <p>Date: ${invoice.issueDate}</p>
      ${invoice.dueDate ? `<p>Due: ${invoice.dueDate}</p>` : ''}
      <p>Status: <span class="status ${invoice.status}">${invoice.status.toUpperCase()}</span></p>
    </div>
  </div>

  <div style="margin-bottom: 20px;">
    <h3>Bill To:</h3>
    <p><strong>${invoice.customerName || 'Customer'}</strong></p>
    ${invoice.customerContact ? `<p>${invoice.customerContact}</p>` : ''}
  </div>

  <table>
    <thead>
      <tr>
        <th>Item</th>
        <th>SKU</th>
        <th>Qty</th>
        <th>Price</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>
      ${invoice.items.map(item => `
        <tr>
          <td>${item.productName}</td>
          <td>${item.sku || '-'}</td>
          <td>${item.qty}</td>
          <td>${item.unitPrice.toFixed(2)} ${invoice.currency}</td>
          <td>${item.total.toFixed(2)} ${invoice.currency}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="totals">
    <div class="total-row">
      <span class="total-label">Subtotal:</span>
      <span class="total-amount">${invoice.subtotal.toFixed(2)} ${invoice.currency}</span>
    </div>
    <div class="total-row">
      <span class="total-label">Tax (${((invoice.taxAmount / invoice.subtotal) * 100).toFixed(1)}%):</span>
      <span class="total-amount">${invoice.taxAmount.toFixed(2)} ${invoice.currency}</span>
    </div>
    <div class="total-row grand-total">
      <span class="total-label">Total:</span>
      <span class="total-amount">${invoice.total.toFixed(2)} ${invoice.currency}</span>
    </div>
  </div>

  ${invoice.notes ? `
    <div style="margin-top: 30px; padding: 15px; background: #f9f9f9; border-radius: 5px;">
      <strong>Notes:</strong>
      <p>${invoice.notes}</p>
    </div>
  ` : ''}
</body>
</html>
  `.trim();
}
