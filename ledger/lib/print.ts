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
  return `
    <div class="letterhead">
      <div>
        <div class="biz-name">${escapeHtml(settings.businessName)}</div>
        ${metaLine ? `<div class="biz-meta">${metaLine}</div>` : ""}
      </div>
      <div class="doc-type">${docType}</div>
    </div>
  `;
}
