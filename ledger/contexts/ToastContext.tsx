"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

type ToastKind = "success" | "error" | "info";
interface ToastItem {
  id: number;
  kind: ToastKind;
  title: string;
  detail?: string;
}

interface ToastContextValue {
  success: (title: string, detail?: string) => void;
  error: (title: string, detail?: string) => void;
  info: (title: string, detail?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// Centralized feedback for every write action in the app. Without this, a
// failed Firestore write (bad connection, a permissions issue, the
// undefined-field bug we hit earlier) fails silently — the modal just sits
// there or closes with nothing to show for it, which is confusing for
// anyone who isn't reading the browser console. Every quick-action and form
// in the app should route success/failure through this instead of
// swallowing errors locally.
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const push = useCallback((kind: ToastKind, title: string, detail?: string) => {
    const id = nextId.current++;
    setToasts((t) => [...t, { id, kind, title, detail }]);
    const timeout = kind === "error" ? 6000 : 3500;
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, timeout);
  }, []);

  const value: ToastContextValue = {
    success: (title, detail) => push("success", title, detail),
    error: (title, detail) => push("error", title, detail),
    info: (title, detail) => push("info", title, detail),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Positioned above the fixed mobile bottom nav (see AppShell) so a
          toast never renders underneath/behind it — bottom-20 clears the
          ~56px nav plus its safe-area padding with room to spare; back to
          a tight bottom-4 on desktop, where there's no bottom nav. */}
      <div className="fixed bottom-20 sm:bottom-4 right-4 left-4 sm:left-auto z-[100] flex flex-col gap-2 sm:w-80 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={
              "pointer-events-auto rounded-md border px-3.5 py-3 shadow-lg text-sm backdrop-blur-sm animate-toast-in " +
              (t.kind === "success"
                ? "bg-good/10 border-good/30 text-good"
                : t.kind === "error"
                  ? "bg-bad/10 border-bad/30 text-bad"
                  : "bg-panel border-line text-fg")
            }
          >
            <div className="font-medium">{t.title}</div>
            {t.detail && <div className="text-xs opacity-80 mt-0.5">{t.detail}</div>}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

// Small helper so every form's submit handler can share one error-shape
// convention instead of each writing its own catch/message logic.
export function toastableErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Something went wrong — please try again.";
}
