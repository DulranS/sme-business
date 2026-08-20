"use client";

import { useEffect } from "react";

// Route-level error boundary. Next.js renders this in place of a page's
// content when that page (or anything it renders) throws during render —
// without this file, an uncaught error in, say, the dashboard's charts or
// calculations used to just produce a blank content area under a working
// sidebar: the error was swallowed by the framework's default handling and
// nothing told you why. This makes failures visible and recoverable instead
// of silently blank, on every route that doesn't define its own error.tsx.
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Route error:", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        <div className="text-sm font-medium text-fg">Something went wrong loading this page</div>
        <div className="text-sm text-muted mt-2">
          This didn&apos;t affect the rest of the app — try again, or head back and come back to this page in a
          moment.
        </div>
        {error.message && (
          <div className="text-xs text-muted mt-3 font-mono bg-panel2 border border-line rounded-md px-3 py-2 text-left break-words">
            {error.message}
          </div>
        )}
        <div className="flex items-center justify-center gap-2 mt-5">
          <button
            onClick={reset}
            className="px-3.5 py-2 rounded-md text-sm font-medium bg-amber text-ink hover:bg-amber-soft transition-colors"
          >
            Try again
          </button>
          <button
            onClick={() => (window.location.href = "/dashboard")}
            className="px-3.5 py-2 rounded-md text-sm font-medium bg-transparent border border-line text-fg hover:border-muted transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
