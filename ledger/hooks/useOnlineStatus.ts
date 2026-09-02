"use client";

import { useEffect, useState } from "react";

// navigator.onLine only reflects network-interface state (it can be true on
// wifi with no real internet), which is a known limitation — but it's
// exactly the signal that matters for the situation this is meant to catch:
// someone genuinely off the grid on patchy mobile data, where the browser
// itself knows before any Firestore write times out. Good enough to turn
// "the app just silently didn't save" into "you're offline, this hasn't
// saved yet" without adding a network-probing dependency.
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return online;
}
