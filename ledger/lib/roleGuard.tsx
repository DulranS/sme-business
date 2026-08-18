"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import type { Role } from "./types";

// Client-side page guard — redirects away if the signed-in member's role
// isn't in `allowed`. This is a UX convenience, not the security boundary:
// even if someone bypassed this (e.g. by disabling JS-driven navigation),
// every read/write they attempted would still be rejected by
// firestore.rules, which enforce the same matrix at the database level.
// This just keeps a Staff account from ever landing on a page that would
// render broken or misleading data because the reads behind it are denied.
export function useRequireRole(allowed: Role[]) {
  const { role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (role && !allowed.includes(role)) {
      router.replace("/sales");
    }
    // allowed is expected to be a stable literal array at each call site
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, role, router]);

  return { allowed: !loading && !!role && allowed.includes(role), loading };
}
