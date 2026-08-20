"use client";

// ONE-TIME MIGRATION PAGE — delete this whole folder after you run it once.
//
// Backfills the two docs the RBAC/multi-tenant rework introduced, for
// accounts that existed before that rework and therefore never got them:
//   memberships/{uid}                 -> { businessId: uid }
//   users/{uid}/members/{uid}         -> { role: "owner", ... }
//
// Safe to run more than once (it checks first and won't overwrite an
// existing owner record). Uses your normal signed-in session and the
// same firestore.rules already in the repo — no admin key needed.

import { useState } from "react";
import { doc, getDoc, setDoc, writeBatch } from "firebase/firestore";
import { getFirebase } from "@/lib/firebase";

export default function MigrateOwnerPage() {
  const [status, setStatus] = useState<string>("Idle.");
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setStatus("Checking current session…");
    try {
      const { auth, db } = getFirebase();
      const user = auth.currentUser;
      if (!user) {
        setStatus("❌ You're not signed in. Log into the app in this same browser first, then come back to this page.");
        setBusy(false);
        return;
      }

      const uid = user.uid;
      const email = (user.email || "").toLowerCase();

      setStatus(`Signed in as ${email} (uid: ${uid}). Checking existing docs…`);

      const membershipRef = doc(db, "memberships", uid);
      const memberRef = doc(db, "users", uid, "members", uid);

      const [membershipSnap, memberSnap] = await Promise.all([
        getDoc(membershipRef),
        getDoc(memberRef),
      ]);

      if (membershipSnap.exists() && memberSnap.exists()) {
        setStatus(
          `✅ Already migrated. memberships/${uid} -> businessId: ${
            (membershipSnap.data() as { businessId: string }).businessId
          }, and users/${uid}/members/${uid} already exists with role "${
            (memberSnap.data() as { role: string }).role
          }". Nothing to do — you can delete this page.`
        );
        setBusy(false);
        return;
      }

      setStatus("Writing membership pointer + owner record…");

      const batch = writeBatch(db);

      if (!membershipSnap.exists()) {
        batch.set(membershipRef, { businessId: uid });
      }

      if (!memberSnap.exists()) {
        batch.set(memberRef, {
          role: "owner",
          name: email.split("@")[0],
          email,
          active: true,
          createdAt: Date.now(),
        });
      }

      await batch.commit();

      setStatus(
        `✅ Done. Created ${!membershipSnap.exists() ? "memberships/" + uid + " " : ""}${
          !memberSnap.exists() ? "and users/" + uid + "/members/" + uid + " " : ""
        }as owner. Go back to /dashboard — everything should load now. Then delete this /app/_migrate-owner folder and redeploy.`
      );
    } catch (err) {
      setStatus(`❌ Failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: "60px auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>One-time owner migration</h1>
      <p style={{ fontSize: 14, color: "#666", marginBottom: 20, lineHeight: 1.5 }}>
        This backfills the <code>memberships/&#123;uid&#125;</code> pointer and{" "}
        <code>users/&#123;uid&#125;/members/&#123;uid&#125;</code> owner record for your existing
        account, which predates the Team/RBAC feature. Make sure you&apos;re logged into the app as
        yourself in this browser, then click the button below.
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
        {busy ? "Working…" : "Run migration"}
      </button>
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
