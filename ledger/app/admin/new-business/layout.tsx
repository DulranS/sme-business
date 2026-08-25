import type { Metadata } from "next";

// This route is intentionally not linked from anywhere in the app's own
// nav (see components/AppShell.tsx) and is blocked in public/robots.txt —
// this tag is the third, belt-and-suspenders layer stopping it from ever
// showing up in search results or a browser's "similar pages" suggestions.
// None of this is the actual access control — the passcode gate in
// page.tsx is — it just keeps the URL from being casually discoverable.
export const metadata: Metadata = {
  title: "Ledger",
  robots: { index: false, follow: false, nocache: true },
};

export default function NewBusinessAdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
