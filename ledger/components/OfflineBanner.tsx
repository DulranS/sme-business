"use client";

import { useOnlineStatus } from "@/hooks/useOnlineStatus";

// Firestore's persistent local cache (see lib/firebase.ts) already keeps
// reads working and queues writes while offline — this banner only adds
// the missing piece: telling the person that's what's happening, instead
// of a form that appears to save with no visible confirmation. It clears
// itself the moment the browser reports a connection again; Firestore
// flushes the queued writes on its own once that happens.
export default function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <div className="sticky top-0 z-40 bg-amber text-ink text-xs sm:text-sm font-medium text-center py-2 px-4">
      You&rsquo;re offline — new entries will be saved as soon as your connection comes back.
    </div>
  );
}
