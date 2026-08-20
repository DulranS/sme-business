import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { DataProvider } from "@/contexts/DataContext";
import { ToastProvider } from "@/contexts/ToastContext";
import AppShell from "@/components/AppShell";

// Font stacks are plain CSS custom properties defined in globals.css
// (system fonts only — no next/font/google). This app previously loaded
// Space Grotesk / Inter / JetBrains Mono from fonts.googleapis.com at
// build time via next/font/google. That's a hard network dependency: in
// any offline build, sandboxed CI runner, or network-restricted
// environment, `next build` fails outright with NextFontError and the
// app doesn't ship at all — the entire UI (sidebar included) never
// renders. Self-hosting the same three-token type system (display/body/
// mono — see tailwind.config.ts) as a system-font stack keeps the design
// intent without any external request, so the app builds and renders
// identically everywhere, with no dependency on Google's servers being
// reachable at build or runtime.

export const metadata: Metadata = {
  title: "Ledger — inventory & unit economics",
  description: "Wholesale inventory, unit economics, and growth forecasting for a solo-run SME.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0B0E14",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <DataProvider>
            <ToastProvider>
              <AppShell>{children}</AppShell>
            </ToastProvider>
          </DataProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
