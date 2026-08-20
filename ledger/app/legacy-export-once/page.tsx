"use client";

// ONE-TIME TOOL — delete this whole folder once done.
//
// For a pre-existing (pre-Team-feature) login that has its OWN real data
// saved under its own uid (users/{uid}/...), this reads it all and offers
// a JSON download. Run this WHILE SIGNED IN AS THAT LEGACY ACCOUNT — it
// only ever reads that account's own data, which the deployed rules
// already allow (isOwner(uid) on their own uid).
//
// Give the downloaded file to whoever runs /legacy-import-once (the
// business owner) — it does the actual merge into the real business.

import { useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { getFirebase } from "@/lib/firebase";

// Every collection worth carrying over. Deliberately excludes:
//  - catalog        (auto-derived from products by the app, never copy directly)
//  - meta/settings   (business-specific; owner keeps their own)
//  - notifications   (system-generated reminders, not historical record)
//  - auditLog        (append-only trail tied to the old account, not portable)
const COLLECTIONS = [
  "products",
  "purchases",
  "purchaseOrders",
  "sales",
  "expenses",
  "variableCosts",
  "capitalEntries",
  "loans",
  "employees",
  "cashCounts",
  "receivablePayments",
  "payablePayments",
  "timeEntries",
  "fixedAssets",
] as const;

export default function LegacyExportPage() {
  const [status, setStatus] = useState("Idle.");
  const [busy, setBusy] = useState(false);
  const [counts, setCounts] = useState<Record<string, number> | null>(null);

  async function run() {
    setBusy(true);
    setCounts(null);
    setStatus("Checking session…");
    try {
      const { auth, db } = getFirebase();
      const user = auth.currentUser;
      if (!user) {
        setStatus("❌ Not signed in. Log in as the OLD account you want to export, then come back here.");
        setBusy(false);
        return;
      }

      const uid = user.uid;
      setStatus(`Signed in as ${user.email} (uid: ${uid}). Reading collections…`);

      const out: Record<string, unknown[]> = {};
      const liveCounts: Record<string, number> = {};

      for (const col of COLLECTIONS) {
        const snap = await getDocs(collection(db, "users", uid, col));
        out[col] = snap.docs.map((d) => ({ _oldId: d.id, ...d.data() }));
        liveCounts[col] = snap.size;
      }

      setCounts(liveCounts);

      const payload = {
        exportedFromUid: uid,
        exportedFromEmail: user.email,
        exportedAt: new Date().toISOString(),
        data: out,
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ledger-export-${uid.slice(0, 8)}.json`;
      a.click();
      URL.revokeObjectURL(url);

      const total = Object.values(liveCounts).reduce((a, b) => a + b, 0);
      setStatus(
        total === 0
          ? "No documents found under this account — either it's already empty, or you're signed in as the wrong login."
          : `✅ Downloaded. Send this file to whoever runs the import (the business owner). Nothing was deleted or changed here — this account's data is untouched.`
      );
    } catch (err) {
      setStatus(`❌ Failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: "60px auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Export this account&apos;s data</h1>
      <p style={{ fontSize: 14, color: "#666", marginBottom: 20, lineHeight: 1.5 }}>
        Make sure you are signed in, in this browser, as the <strong>old pre-existing login</strong> whose
        data needs to move into the real business. This only reads — nothing is changed or deleted.
      </p>
      <button
        onClick={run}
        disabled={busy}
        style={{
          padding: "10px 18px",
          borderRadius: 8,
          background: busy ? "#999" : "#111",
          color: "#fff",
          border: "none",
          fontSize: 14,
          cursor: busy ? "default" : "pointer",
        }}
      >
        {busy ? "Working…" : "Export & download"}
      </button>
      {counts && (
        <ul style={{ marginTop: 16, fontSize: 13, color: "#444", lineHeight: 1.6 }}>
          {Object.entries(counts).map(([k, v]) => (
            <li key={k}>
              {k}: {v}
            </li>
          ))}
        </ul>
      )}
      <pre
        style={{
          marginTop: 20,
          padding: 14,
          background: "#f5f5f5",
          borderRadius: 8,
          fontSize: 13,
          whiteSpace: "pre-wrap",
          lineHeight: 1.5,
        }}
      >
        {status}
      </pre>
    </div>
  );
}
