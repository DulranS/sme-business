"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

// One shared "is the Assistant modal open" flag, instead of every button
// that wants to reach the assistant (dashboard quick actions, a global
// floating button, anywhere else in future) owning its own separate
// local state and its own copy of the modal. Call openAssistant() from
// wherever; it always opens the same modal, in the same state.
type AssistantModalContextValue = {
  open: boolean;
  openAssistant: () => void;
  closeAssistant: () => void;
};

const AssistantModalContext = createContext<AssistantModalContextValue | null>(null);

export function AssistantModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <AssistantModalContext.Provider
      value={{ open, openAssistant: () => setOpen(true), closeAssistant: () => setOpen(false) }}
    >
      {children}
    </AssistantModalContext.Provider>
  );
}

export function useAssistantModal() {
  const ctx = useContext(AssistantModalContext);
  if (!ctx) throw new Error("useAssistantModal must be used within AssistantModalProvider");
  return ctx;
}
