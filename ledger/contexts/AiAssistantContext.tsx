"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc, limit as fsLimit } from "firebase/firestore";
import { getFirebase } from "@/lib/firebase";
import { useAuth } from "./AuthContext";
import type { AiChatMessage, AiChatResponse, AiChatSession, AiMemoryNote, AiOcrResponse } from "@/lib/aiTypes";

interface AiAssistantContextValue {
  sessions: AiChatSession[];
  currentSessionId: string | null;
  messages: AiChatMessage[];
  memoryNotes: AiMemoryNote[];
  sending: boolean;
  error: string | null;
  clearError: () => void;
  startNewSession: () => void;
  selectSession: (id: string) => void;
  renameSession: (id: string, title: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  sendMessage: (text: string, image?: { base64: string; mediaType: string }) => Promise<AiChatResponse>;
  scanReceipt: (image: { base64: string; mediaType: string }) => Promise<AiOcrResponse>;
  forgetMemoryNote: (id: string) => Promise<void>;
}

const AiAssistantContext = createContext<AiAssistantContextValue | undefined>(undefined);

export function AiAssistantProvider({ children }: { children: ReactNode }) {
  const { user, businessId, role } = useAuth();
  const [sessions, setSessions] = useState<AiChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [memoryNotes, setMemoryNotes] = useState<AiMemoryNote[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enabled = Boolean(businessId && (role === "owner" || role === "manager"));

  // Session list — real-time so a rename/delete from another tab or device
  // (or a brand-new session created by the first sendMessage call) shows up
  // immediately without a manual refetch.
  useEffect(() => {
    if (!enabled || !businessId) {
      setSessions([]);
      return;
    }
    const { db } = getFirebase();
    const q = query(collection(db, "users", businessId, "aiChatSessions"), orderBy("updatedAt", "desc"), fsLimit(50));
    const unsub = onSnapshot(
      q,
      (snap) => setSessions(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AiChatSession, "id">) }))),
      (err) => console.error("aiChatSessions listener error:", err)
    );
    return unsub;
  }, [enabled, businessId]);

  // Active session's transcript — this is the durable "history" the whole
  // feature is built around: every message either side has ever sent in
  // this session, synced live, surviving a refresh or a switch to another
  // device signed into the same business.
  useEffect(() => {
    if (!enabled || !businessId || !currentSessionId) {
      setMessages([]);
      return;
    }
    const { db } = getFirebase();
    const q = query(
      collection(db, "users", businessId, "aiChatSessions", currentSessionId, "messages"),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(
      q,
      (snap) => setMessages(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AiChatMessage, "id">) }))),
      (err) => console.error("aiChatSession messages listener error:", err)
    );
    return unsub;
  }, [enabled, businessId, currentSessionId]);

  // Long-term memory notes — small and fully visible, so the owner can see
  // (and delete, via forgetMemoryNote) exactly what the assistant has
  // learned about how this business likes things logged.
  useEffect(() => {
    if (!enabled || !businessId) {
      setMemoryNotes([]);
      return;
    }
    const { db } = getFirebase();
    const q = query(collection(db, "users", businessId, "aiMemory"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => setMemoryNotes(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AiMemoryNote, "id">) }))),
      (err) => console.error("aiMemory listener error:", err)
    );
    return unsub;
  }, [enabled, businessId]);

  const clearError = useCallback(() => setError(null), []);

  const startNewSession = useCallback(() => {
    setCurrentSessionId(crypto.randomUUID());
    setMessages([]);
  }, []);

  const selectSession = useCallback((id: string) => setCurrentSessionId(id), []);

  const renameSession = useCallback(
    async (id: string, title: string) => {
      if (!businessId) return;
      const { db } = getFirebase();
      await updateDoc(doc(db, "users", businessId, "aiChatSessions", id), { title: title.trim().slice(0, 60) || "Untitled" });
    },
    [businessId]
  );

  const deleteSession = useCallback(
    async (id: string) => {
      if (!user) return;
      const idToken = await user.getIdToken();
      const res = await fetch("/api/ai/sessions", {
        method: "DELETE",
        headers: { "content-type": "application/json", authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ sessionId: id }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || "Couldn't delete that conversation.");
      }
      if (currentSessionId === id) {
        setCurrentSessionId(null);
        setMessages([]);
      }
    },
    [user, currentSessionId]
  );

  const sendMessage = useCallback(
    async (text: string, image?: { base64: string; mediaType: string }): Promise<AiChatResponse> => {
      if (!user) throw new Error("Not signed in.");
      const sessionId = currentSessionId ?? crypto.randomUUID();
      if (!currentSessionId) setCurrentSessionId(sessionId);
      setSending(true);
      setError(null);
      try {
        const idToken = await user.getIdToken();
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${idToken}` },
          body: JSON.stringify({ sessionId, message: text, imageBase64: image?.base64, imageMediaType: image?.mediaType }),
        });
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload.error || "The assistant didn't respond — try again.");
        }
        // The Firestore listener above will land the same persisted
        // messages a moment later for the live transcript view — this
        // direct return is for callers (like the quick-entry modal) that
        // need the reply/proposals immediately, without racing the
        // listener's snapshot latency.
        return (await res.json()) as AiChatResponse;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
        throw err;
      } finally {
        setSending(false);
      }
    },
    [user, currentSessionId]
  );

  const scanReceipt = useCallback(
    async (image: { base64: string; mediaType: string }): Promise<AiOcrResponse> => {
      if (!user) throw new Error("Not signed in.");
      setSending(true);
      setError(null);
      try {
        const idToken = await user.getIdToken();
        const res = await fetch("/api/ai/ocr", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${idToken}` },
          body: JSON.stringify({ imageBase64: image.base64, imageMediaType: image.mediaType }),
        });
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload.error || "Couldn't read that receipt — try again.");
        }
        return (await res.json()) as AiOcrResponse;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
        throw err;
      } finally {
        setSending(false);
      }
    },
    [user]
  );

  const forgetMemoryNote = useCallback(
    async (id: string) => {
      if (!businessId) return;
      const { db } = getFirebase();
      await deleteDoc(doc(db, "users", businessId, "aiMemory", id));
    },
    [businessId]
  );

  const value = useMemo(
    () => ({
      sessions,
      currentSessionId,
      messages,
      memoryNotes,
      sending,
      error,
      clearError,
      startNewSession,
      selectSession,
      renameSession,
      deleteSession,
      sendMessage,
      scanReceipt,
      forgetMemoryNote,
    }),
    [sessions, currentSessionId, messages, memoryNotes, sending, error, clearError, startNewSession, selectSession, renameSession, deleteSession, sendMessage, scanReceipt, forgetMemoryNote]
  );

  return <AiAssistantContext.Provider value={value}>{children}</AiAssistantContext.Provider>;
}

export function useAiAssistant() {
  const ctx = useContext(AiAssistantContext);
  if (!ctx) throw new Error("useAiAssistant must be used inside AiAssistantProvider");
  return ctx;
}
