// ---------------------------------------------------------------------------
// Shared printable-document helpers. Every printable document in the app
// (project quotes/invoices, sale receipts) is deliberately implemented as a
// browser print dialog — window.open + document.write + print() — rather
// than a PDF-generation library: every OS's print dialog already offers
// "Save as PDF", so this gets a downloadable, professional-looking document
// without adding a client-side PDF dependency to the bundle. Centralized
// here so every document type (project or otherwise) shares one letterhead,
// one set of base styles, and one print trigger instead of each page
// reinventing its own.
// ---------------------------------------------------------------------------
import type { Settings } from "./types";
import { formatMoney, todayIso } from "./format";

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

export function openPrintWindow(html: string) {
  const win = window.open("", "_blank", "width=800,height=1000");
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
  // Give the new document a beat to lay out before invoking print.
  setTimeout(() => {
    win.focus();
    win.print();
  }, 250);
}

export function printBaseStyles(): string {
  return `
    <style>
      * { box-sizing: border-box; }
      body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #1a1a1a; padding: 40px; max-width: 720px; margin: 0 auto; }
      h1 { font-size: 22px; margin: 0 0 4px; }
      .muted { color: #666; font-size: 13px; }
      .meta { display: flex; justify-content: space-between; margin: 24px 0; font-size: 13px; }
      table { width: 100%; border-collapse: collapse; margin-top: 16px; }
      th, td { text-align: left; padding: 8px 6px; border-bottom: 1px solid #ddd; font-size: 13px; }
      th { text-transform: uppercase; letter-spacing: 0.03em; font-size: 10px; color: #666; }
      td.num, th.num { text-align: right; }
      .total-row td { border-top: 2px solid #1a1a1a; border-bottom: none; font-weight: 600; }
      .letterhead { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1a1a1a; padding-bottom: 16px; margin-bottom: 20px; }
      .letterhead .biz-name { font-size: 17px; font-weight: 700; }
      .letterhead .biz-meta { font-size: 12px; color: #666; margin-top: 2px; }
      .letterhead .doc-type { font-size: 20px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; text-align: right; }
      .footer { margin-top: 32px; font-size: 11px; color: #888; }
      @media print { body { padding: 0; } }
    </style>
  `;
}

// Letterhead strip shown at the top of any printed document, built from
// Settings.businessName/Address/Phone (all optional — see lib/types.ts).
// When no business name is set, this renders a plain heading instead of a
// half-empty header, so an owner who hasn't filled in Settings yet still
// gets a clean document instead of a broken-looking placeholder.
export function buildLetterheadHtml(settings: Settings, docType: string): string {
  if (!settings.businessName?.trim()) {
    return `<h1>${docType}</h1>`;
  }
  const metaLine = [settings.businessAddress, settings.businessPhone]
    .filter((v): v is string => Boolean(v))
    .map(escapeHtml)
    .join(" · ");
  const logo = settings.logoUrl
    ? `<img src="${escapeHtml(settings.logoUrl)}" alt="" style="width:40px;height:40px;object-fit:contain;border-radius:4px;flex-shrink:0;" />`
    : "";
  return `
    <div class="letterhead">
      <div style="display:flex;align-items:center;gap:10px;">
        ${logo}
        <div>
          <div class="biz-name">${escapeHtml(settings.businessName)}</div>
          ${metaLine ? `<div class="biz-meta">${metaLine}</div>` : ""}
        </div>
      </div>
      <div class="doc-type">${docType}</div>
    </div>
  `;
}

// A safe, universal WhatsApp share link: it deliberately never targets a
// specific number. customerContact is free text (phone OR email — see
// Sale.customerContact in lib/types.ts) with no enforced format, so
// guessing at country codes to build a wa.me/<number> deep link risks
// silently pointing at the wrong person. wa.me/?text=... instead just
// opens WhatsApp with the message pre-filled and lets the owner pick the
// contact themselves — one tap slower, zero chance of misfiring.
export function buildWhatsAppShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function buildReceivableReminderText(params: {
  businessName?: string;
  customer: string;
  itemName: string;
  amountOutstanding: number;
  dueDate: string;
  daysOverdue: number;
  currency: string;
}): string {
  const { businessName, customer, itemName, amountOutstanding, dueDate, daysOverdue, currency } = params;
  const from = businessName?.trim() ? businessName.trim() : "us";
  const amount = formatMoney(amountOutstanding, currency);
  const status =
    daysOverdue > 0
      ? `is now ${daysOverdue} day${daysOverdue === 1 ? "" : "s"} overdue (was due ${dueDate})`
      : `is due ${dueDate}`;
  return `Hi ${customer}, this is a friendly reminder from ${from}: ${amount} for ${itemName} ${status}. Let us know if you'd like to arrange payment — thank you!`;
}

// ---------------------------------------------------------------------------
// A proper Invoice for a credit sale — distinct from the "Receipt" a cash
// sale prints (see Sales page). A receipt says "here's what you were
// charged"; a customer chasing an invoice needs to see what's still owed
// after whatever they've already paid you, which a receipt alone can't show
// once partial payments start coming in against a credit sale. Shared here
// (rather than duplicated per-page, the way buildSaleReceiptHtml/the
// project buildInvoiceHtml are page-local) because both the Sales page
// (send it the moment you make the credit sale) and the Receivables page
// (re-send it while chasing an outstanding balance) need the exact same
// document — same layout, same payments-received breakdown, same balance
// math — and drifting into two near-identical copies would be its own bug
// waiting to happen. Deliberately kept to a single line item + a payments
// table: Sale is one line per record (see Sale in lib/types.ts), so there's
// nothing to batch, and no new field, collection, or invoice-numbering
// scheme is introduced — the invoice reference is just the existing sale
// id, which is already unique and already what a payment is filed against.
export interface InvoicePaymentRow {
  date: string;
  method: string;
  amount: number;
}

export function buildSaleInvoiceHtml(params: {
  saleId: string;
  itemName: string;
  amount: number; // full sale value, base currency
  customer?: string;
  customerContact?: string;
  issueDate: string;
  dueDate?: string;
  payments: InvoicePaymentRow[];
  settings: Settings;
}): string {
  const { saleId, itemName, amount, customer, customerContact, issueDate, dueDate, payments, settings } = params;
  const currency = settings.currency;
  const amountPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const balanceDue = Math.max(amount - amountPaid, 0);
  const isOverdue = balanceDue > 0.005 && !!dueDate && dueDate < todayIso();
  const invoiceRef = `INV-${saleId.slice(-6).toUpperCase()}`;

  const paymentsRows =
    payments.length > 0
      ? `
        <div class="muted" style="margin-top:20px;font-size:11px;text-transform:uppercase;letter-spacing:0.03em;">Payments received</div>
        <table>
          <thead><tr><th>Date</th><th>Method</th><th class="num">Amount</th></tr></thead>
          <tbody>
            ${payments
              .map(
                (p) =>
                  `<tr><td>${escapeHtml(p.date)}</td><td>${escapeHtml(p.method.replace("_", " "))}</td><td class="num">${formatMoney(p.amount, currency)}</td></tr>`
              )
              .join("")}
          </tbody>
        </table>
      `
      : "";

  return `<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${invoiceRef}</title>${printBaseStyles()}</head>
    <body>
      ${buildLetterheadHtml(settings, "Invoice")}
      <div class="meta">
        <div>
          ${customer ? `<strong>Bill to:</strong> ${escapeHtml(customer)}${customerContact ? `<br/>${escapeHtml(customerContact)}` : ""}` : ""}
        </div>
        <div style="text-align:right;">
          <div><strong>Invoice:</strong> ${invoiceRef}</div>
          <div><strong>Date:</strong> ${issueDate}</div>
          ${dueDate ? `<div><strong>Due:</strong> ${dueDate}${isOverdue ? " (overdue)" : ""}</div>` : ""}
        </div>
      </div>
      <table>
        <thead><tr><th>Description</th><th class="num">Amount</th></tr></thead>
        <tbody>
          <tr><td>${escapeHtml(itemName)}</td><td class="num">${formatMoney(amount, currency)}</td></tr>
        </tbody>
      </table>
      ${paymentsRows}
      <table style="margin-top:8px;">
        <tfoot>
          <tr><td>Amount due</td><td class="num">${formatMoney(amount, currency)}</td></tr>
          ${amountPaid > 0 ? `<tr><td>Less payments received</td><td class="num">−${formatMoney(amountPaid, currency)}</td></tr>` : ""}
          <tr class="total-row"><td>Balance due</td><td class="num">${formatMoney(balanceDue, currency)}</td></tr>
        </tfoot>
      </table>
      <div class="footer">${balanceDue <= 0.005 ? "Paid in full — thank you." : isOverdue ? "This invoice is past its due date." : "Thank you for your business."}</div>
      <div class="footer">Printed ${todayIso()}.</div>
    </body></html>`;
}
