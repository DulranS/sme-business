# Changelog — this build

Six small, additive changes on top of the existing app. Nothing here changes
existing data shapes, existing exports/imports, or existing permissions —
everything is either new UI wired to existing data, or a new file that
nothing else depends on yet.

## Added

- **First-run checklist** (`components/OnboardingChecklist.tsx`) — shows on
  the dashboard until a product, a purchase, a sale, and an opening balance
  all exist, then stops rendering for good. Dismissible early via `localStorage`.
- **Offline banner** (`hooks/useOnlineStatus.ts`, `components/OfflineBanner.tsx`)
  — a sticky bar across every page while the browser reports no connection.
  Firestore's existing offline queue (see `lib/firebase.ts`) does the actual
  work; this only makes it visible.
- **One-click full backup** (`lib/backup.ts`, wired into `/import-export`) —
  zips every entity CSV the app can already export into one file, plus a
  short manifest. Each file inside is identical to that entity's individual
  "Export CSV" output, so restoring is re-importing each file the normal
  way.
- **Inline glossary** (`lib/glossary.ts`, `components/Term.tsx`) — tap-to-reveal
  definitions wired onto the accounting terms that appear as-is on
  `/statements` (COGS, gross profit, contribution margin, accrual/cash
  basis, accounts receivable/payable). Not added to `/profitability`, which
  already phrases the same ideas in plain language ("Profit per sale", "You
  need to sell this much") — a glossary term there would be redundant.
- **Logo upload** (`lib/logoUpload.ts`, `storage.rules`, wired into
  `/settings` → General and every printed quote/invoice/receipt via
  `lib/print.ts` and `lib/invoiceGenerator.ts`). Owner-only, first use of
  Firebase Storage in this project — see the README's Firebase setup section
  for the one extra deploy step this needs.
- **Owner-recovery runbook** (`RECOVERY-RUNBOOK.md`) — documentation, not
  code. The single-owner-per-business architecture (`businessId == owner's
  uid`) means there's no "wrong person has owner access" scenario to
  defend against; the one real gap (owner loses password *and* email
  access) is rare enough to be a documented manual process rather than a
  built feature.

## Deliberately not built (see BUSINESS-VALUE.md / project scope discussion)

- **Scheduled/emailed backups.** The full backup above is manual (button
  click) rather than an automatic weekly email, because the automatic
  version needs new server-side infrastructure (a scheduled Cloud Function)
  and an email-delivery provider that aren't part of this project yet. If
  that infra gets added later, `lib/backup.ts`'s row-builders
  (`productsRows`, `purchasesRows`, etc. in `lib/csv.ts`) are already
  structured to be called from a Cloud Function the same way they're called
  from the browser here.
- **Self-service owner-recovery flow** (secondary email, phone verification,
  etc.) — real scope (new fields, new verification flow, new attack
  surface), not worth building ahead of it actually being needed. See
  `RECOVERY-RUNBOOK.md` for the manual process in the meantime.
