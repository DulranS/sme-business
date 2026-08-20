"use client";

// ONE-TIME TOOL — delete this whole folder once done.
//
// Run this WHILE SIGNED IN AS THE BUSINESS OWNER. Upload a JSON file
// produced by /legacy-export-once, review the counts, then confirm to
// write everything into this business (users/{ownerUid}/...).
//
// Two collections get special handling because of what firestore.rules
// actually allows, not just app convention:
//  - products:   also writes the matching cost-stripped `catalog` doc,
//                same shape DataContext.addProduct() writes, since catalog
//                is never auto-derived by a raw Firestore write.
//  - sales / cashCounts / receivablePayments / payablePayments:
//                firestore.rules requires createdByUid == the uid doing
//                the write on every create, with no owner exception. So
//                these MUST be re-attributed to the owner on import —
//                original attribution can't be preserved for these four.
//                The original creator's name (if present) is kept in a
//                new `migratedFromName` field so the history isn't lost,
//                just no longer drives permissions.
//  - timeEntries: firestore.rules DOES let Owner/Manager create one with
//                any memberUid, so original attribution is preserved here.
//  - meta/settings is intentionally never imported — the owner keeps
//                their own.

import { useState } from "react";
import { collection, doc, writeBatch } from "firebase/firestore";
import { getFirebase } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";

const REATTRIBUTED_TO_OWNER = ["sales", "cashCounts", "receivablePayments", "payablePayments"] as const;

type ExportPayload = {
  exportedFromUid: string;
  exportedFromEmail: string | null;
  exportedAt: string;
  data: Record<string, Array<Record<string, unknown>>>;
};

export default function LegacyImportPage() {
  const { user, businessId, role } = useAuth();
  const [file, setFile] = useState<ExportPayload | null>(null);
  const [status, setStatus] = useState("Idle.");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setDone(false);
    setStatus("Idle.");
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as ExportPayload;
        setFile(parsed);
        setStatus("File loaded. Review the counts below, then confirm.");
      } catch {
        setStatus("❌ That doesn't look like a valid export file.");
        setFile(null);
      }
    };
    reader.readAsText(f);
  }

  async function runImport() {
    if (!file || !user || !businessId) return;
    if (role !== "owner") {
      setStatus("❌ You must be signed in as the OWNER to run this. (Some collections, like employees, are owner-only to write.)");
      return;
    }

    setBusy(true);
    setStatus("Writing…");
    try {
      const { db } = getFirebase();
      const ownerUid = user.uid;
      const writtenCounts: Record<string, number> = {};

      for (const [col, docs] of Object.entries(file.data)) {
        if (!docs || docs.length === 0) continue;

        // Firestore batches cap at 500 writes; chunk generously under that
        // since products also write a second (catalog) doc per item.
        const chunkSize = col === "products" ? 200 : 400;
        for (let i = 0; i < docs.length; i += chunkSize) {
          const chunk = docs.slice(i, i + chunkSize);
          const batch = writeBatch(db);

          for (const raw of chunk) {
            const { _oldId, ...rest } = raw as { _oldId?: string } & Record<string, unknown>;
            const record: Record<string, unknown> = { ...rest };

            if ((REATTRIBUTED_TO_OWNER as readonly string[]).includes(col)) {
              if (typeof record.createdByName === "string") {
                record.migratedFromName = record.createdByName;
              }
              record.createdByUid = ownerUid;
              record.createdByName = user.email?.split("@")[0] ?? "Owner";
            }

            if (col === "products") {
              const productRef = doc(collection(db, "users", businessId, "products"));
              const catalogRef = doc(db, "users", businessId, "catalog", productRef.id);
              batch.set(productRef, record);
              batch.set(catalogRef, {
                name: record.name ?? "",
                sku: record.sku ?? "",
                category: record.category ?? "",
                type: record.type ?? "",
                active: record.active ?? true,
                sellPrice: (record.defaultSellPrice as number | undefined) ?? null,
              });
            } else {
              const ref = doc(collection(db, "users", businessId, col));
              batch.set(ref, record);
            }
          }

          await batch.commit();
          writtenCounts[col] = (writtenCounts[col] ?? 0) + chunk.length;
        }
      }

      setDone(true);
      setStatus(
        `✅ Import complete.\n\n${Object.entries(writtenCounts)
          .map(([k, v]) => `${k}: ${v}`)
          .join("\n")}\n\nGo check /products, /sales etc. to confirm it looks right, then delete the /legacy-export-once and /legacy-import-once folders and redeploy.`
      );
    } catch (err) {
      setStatus(`❌ Failed partway through: ${err instanceof Error ? err.message : String(err)}. Check which collections above already got written before re-running — re-running will duplicate anything already imported.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: "60px auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Import legacy account data</h1>
      <p style={{ fontSize: 14, color: "#666", marginBottom: 20, lineHeight: 1.5 }}>
        You must be signed in as the <strong>owner</strong> of this business. Upload the JSON file downloaded
        from <code>/legacy-export-once</code>, review the counts, then confirm.
      </p>

      <input type="file" accept="application/json" onChange={onFileChange} style={{ fontSize: 14 }} />

      {file && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 13, color: "#444", marginBottom: 8 }}>
            Exported from <strong>{file.exportedFromEmail}</strong> on {new Date(file.exportedAt).toLocaleString()}
          </div>
          <ul style={{ fontSize: 13, color: "#444", lineHeight: 1.6, marginBottom: 16 }}>
            {Object.entries(file.data).map(([k, v]) => (
              <li key={k}>
                {k}: {v.length}
                {(REATTRIBUTED_TO_OWNER as readonly string[]).includes(k) && v.length > 0 && (
                  <span style={{ color: "#a60" }}> — will be re-attributed to you (owner) on import, rules require this</span>
                )}
              </li>
            ))}
          </ul>
          <button
            onClick={runImport}
            disabled={busy || done}
            style={{
              padding: "10px 18px",
              borderRadius: 8,
              background: busy || done ? "#999" : "#111",
              color: "#fff",
              border: "none",
              fontSize: 14,
              cursor: busy || done ? "default" : "pointer",
            }}
          >
            {busy ? "Importing…" : done ? "Done" : "Confirm import"}
          </button>
        </div>
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
