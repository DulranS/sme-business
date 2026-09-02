"use client";

import Link from "next/link";
import { useData } from "@/contexts/DataContext";
import { Card } from "@/components/ui";

const STALE_DAYS = 14; // beyond this, nudge turns from muted to amber

// Backup is manual/on-demand (see lib/backup.ts) — there is no scheduled
// export, so an owner who never visits Import/Export and clicks the
// button has zero backup and, worse, no way of knowing that from the
// dashboard. This reads the timestamp Import/Export writes on a
// successful backup (settings.lastBackupAt) and just says the plain
// truth about it. No new backup system — a one-line status on data
// that already exists.
export default function BackupNudge() {
  const { settings } = useData();

  const days =
    settings.lastBackupAt != null
      ? Math.floor((Date.now() - settings.lastBackupAt) / (24 * 60 * 60 * 1000))
      : null;

  const stale = days === null || days > STALE_DAYS;

  return (
    <Card className={`mb-5 sm:mb-6 flex items-center justify-between gap-3 flex-wrap ${stale ? "border-amber-dim/40" : ""}`}>
      <div className="text-sm">
        {days === null ? (
          <span className="text-muted">
            No backup on record yet — your data only lives in this Firebase project.
          </span>
        ) : days === 0 ? (
          <span className="text-muted">Last backed up today.</span>
        ) : (
          <span className={stale ? "text-fg" : "text-muted"}>
            Last backed up {days} day{days === 1 ? "" : "s"} ago.
          </span>
        )}
      </div>
      <Link href="/import-export" className="text-sm font-medium text-info hover:underline shrink-0">
        {days === null ? "Back up now →" : "Back up →"}
      </Link>
    </Card>
  );
}
