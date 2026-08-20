// ONE-TIME SCRIPT — delete this file (and serviceAccountKey.json) once done.
//
// Merges one or more pre-existing (pre-Team-feature) legacy accounts'
// data into the real business, using firebase-admin — which bypasses
// firestore.rules entirely. That's the whole point here: no re-attribution
// tricks needed, no logging in twice per person, no JSON round-tripping
// through the browser. It reads users/{legacyUid}/* for every listed
// account and writes it straight into users/{ownerUid}/*, preserving
// every field exactly as it was, including createdByUid/createdByName.
//
// SETUP (one time):
//   1. Firebase console -> Project settings -> Service accounts ->
//      "Generate new private key". Save the downloaded file as
//      scripts/serviceAccountKey.json (already gitignored below).
//   2. npm install --save-dev firebase-admin
//   3. Fill in CONFIG below with your owner uid and each legacy account.
//   4. node scripts/migrate-legacy-accounts.mjs --dry-run   (preview counts)
//   5. node scripts/migrate-legacy-accounts.mjs             (actually write)
//
// Find a uid: Firebase console -> Authentication -> Users tab -> the UID
// column next to each email.

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
const CONFIG = {
  // Your own uid — the business everything gets merged INTO.
  ownerUid: "hXy4821do3dBgPLtmWFkTyvkt472",

  // Every pre-existing legacy login whose data needs to move in.
  // `makeMember` is optional: if set, also writes memberships/{uid} +
  // users/{ownerUid}/members/{uid} so that person can keep logging in
  // as themselves afterward and land directly in the merged business,
  // skipping the normal invite/join flow. Omit it (or set to null) to
  // just import that account's data without turning it into a login.
  legacyAccounts: [
    { uid: "jZfSTm1kD5hHa1YtYs14IsxiT4K2", makeMember: null },
    { uid: "4DzJaIaI6kT8BIDK1E3LU5IRu8X2", makeMember: null },
    { uid: "ufQjvZC50rg6XGAS8n8e1noqQsJ3", makeMember: null },
    { uid: "pwRdZP6bD6eDsNASksAuOFAiFUc2", makeMember: null },
    { uid: "VBp3vCKkzHgLLuepQgFwNVRJAY33", makeMember: null },
  ],
};
// ---------------------------------------------------------------------------

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
];

const DRY_RUN = process.argv.includes("--dry-run");

function initAdmin() {
  const keyPath = join(__dirname, "serviceAccountKey.json");
  let serviceAccount;
  try {
    serviceAccount = JSON.parse(readFileSync(keyPath, "utf8"));
  } catch {
    console.error(
      `\nCouldn't read ${keyPath}.\nDownload it from Firebase console -> Project settings -> Service accounts -> "Generate new private key", save it there, and re-run.\n`
    );
    process.exit(1);
  }
  initializeApp({ credential: cert(serviceAccount) });
  return getFirestore();
}

async function migrateOne(db, ownerUid, legacyUid, makeMember) {
  console.log(`\n=== ${legacyUid} -> ${ownerUid} ===`);

  for (const col of COLLECTIONS) {
    const snap = await db.collection("users").doc(legacyUid).collection(col).get();
    if (snap.empty) continue;

    console.log(`  ${col}: ${snap.size} doc(s)${DRY_RUN ? " (dry run, not writing)" : ""}`);
    if (DRY_RUN) continue;

    // Firestore batches cap at 500 writes; products also write a second
    // (catalog) doc per item, so chunk generously under that.
    const chunkSize = col === "products" ? 200 : 400;
    const docs = snap.docs;
    for (let i = 0; i < docs.length; i += chunkSize) {
      const batch = db.batch();
      for (const d of docs.slice(i, i + chunkSize)) {
        const record = d.data(); // preserved exactly — admin bypasses rules, no re-attribution needed

        const newRef = db.collection("users").doc(ownerUid).collection(col).doc();
        batch.set(newRef, record);

        if (col === "products") {
          const catalogRef = db.collection("users").doc(ownerUid).collection("catalog").doc(newRef.id);
          batch.set(catalogRef, {
            name: record.name ?? "",
            sku: record.sku ?? "",
            category: record.category ?? "",
            type: record.type ?? "",
            active: record.active ?? true,
            sellPrice: record.defaultSellPrice ?? null,
          });
        }
      }
      await batch.commit();
    }
  }

  if (makeMember && !DRY_RUN) {
    console.log(`  Adding as team member: ${makeMember.role}`);
    await db.collection("memberships").doc(legacyUid).set({ businessId: ownerUid });
    await db
      .collection("users")
      .doc(ownerUid)
      .collection("members")
      .doc(legacyUid)
      .set({
        role: makeMember.role,
        name: makeMember.name,
        email: makeMember.email.toLowerCase(),
        active: true,
        createdAt: Date.now(),
      });
  } else if (makeMember && DRY_RUN) {
    console.log(`  Would add as team member: ${makeMember.role} (dry run, not writing)`);
  }
}

async function main() {
  if (CONFIG.ownerUid.startsWith("PASTE_")) {
    console.error("\nEdit CONFIG in this script first — fill in ownerUid and legacyAccounts.\n");
    process.exit(1);
  }
  if (CONFIG.legacyAccounts.length === 0) {
    console.error("\nCONFIG.legacyAccounts is empty — nothing to do. Add at least one account.\n");
    process.exit(1);
  }

  const db = initAdmin();

  if (DRY_RUN) console.log("--- DRY RUN: no writes will happen ---");

  for (const { uid, makeMember } of CONFIG.legacyAccounts) {
    await migrateOne(db, CONFIG.ownerUid, uid, makeMember);
  }

  console.log(DRY_RUN ? "\nDry run complete. Re-run without --dry-run to actually write." : "\nDone. Check the app to confirm everything looks right.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
