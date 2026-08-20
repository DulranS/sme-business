"use client";

import { useEffect } from "react";

// Catches errors thrown by the root layout itself (AuthProvider,
// DataProvider, AppShell) — the one class of failure app/error.tsx can't
// catch, since that file's boundary sits inside the layout, not around it.
// Must render its own <html>/<body> since it replaces the root layout
// entirely when it fires.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ background: "#0B0E14", color: "#E8E6E1" }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
            fontFamily: "-apple-system, Segoe UI, system-ui, sans-serif",
          }}
        >
          <div style={{ maxWidth: 420, textAlign: "center" }}>
            <div style={{ fontSize: 14, fontWeight: 500 }}>The app failed to start</div>
            <div style={{ fontSize: 14, color: "#8A92A6", marginTop: 8 }}>
              Something went wrong before the page could load — reloading usually fixes it. If it keeps happening,
              check your internet connection or try again shortly.
            </div>
            {error.message && (
              <div
                style={{
                  fontSize: 12,
                  color: "#8A92A6",
                  marginTop: 12,
                  fontFamily: "ui-monospace, monospace",
                  background: "#171C28",
                  border: "1px solid #262C3A",
                  borderRadius: 6,
                  padding: "8px 12px",
                  textAlign: "left",
                  wordBreak: "break-word",
                }}
              >
                {error.message}
              </div>
            )}
            <button
              onClick={reset}
              style={{
                marginTop: 20,
                padding: "8px 14px",
                borderRadius: 6,
                fontSize: 14,
                fontWeight: 500,
                background: "#C97C3D",
                color: "#0B0E14",
                border: "none",
                cursor: "pointer",
              }}
            >
              Reload
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
