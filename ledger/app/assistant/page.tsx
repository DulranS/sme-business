"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { useRequireRole } from "@/lib/roleGuard";
import { useAiAssistant } from "@/contexts/AiAssistantContext";
import { resizeImageFile, type ResizedImage } from "@/lib/imageResize";
import { PageHeader, Card, Button, EmptyState, Modal } from "@/components/ui";
import { ProposedEntryCard } from "@/components/ai/ProposedEntryCard";
import type { AiChatSession } from "@/lib/aiTypes";

function relativeDay(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  if (isToday) return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function AssistantPage() {
  const { allowed, loading: guardLoading } = useRequireRole(["owner", "manager"]);
  const {
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
    forgetMemoryNote,
  } = useAiAssistant();

  const [draft, setDraft] = useState("");
  const [pendingImage, setPendingImage] = useState<ResizedImage | null>(null);
  const [mobileSessionsOpen, setMobileSessionsOpen] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Land on the most recent conversation by default rather than an empty
  // composer with no context — matches how every chat app opens.
  useEffect(() => {
    if (!currentSessionId && sessions.length > 0) selectSession(sessions[0].id);
  }, [currentSessionId, sessions, selectSession]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, sending]);

  if (guardLoading || !allowed) return null;

  async function handleSend() {
    const text = draft.trim();
    if (!text && !pendingImage) return;
    clearError();
    setDraft("");
    const image = pendingImage ? { base64: pendingImage.base64, mediaType: pendingImage.mediaType } : undefined;
    setPendingImage(null);
    try {
      await sendMessage(text || "", image);
    } catch {
      // surfaced via `error` below
    }
  }

  function handleNewChat() {
    startNewSession();
    setMobileSessionsOpen(false);
  }

  async function commitRename(id: string) {
    const title = renameValue.trim();
    setRenamingId(null);
    if (title) await renameSession(id, title).catch(() => {});
  }

  async function handleDelete(session: AiChatSession) {
    if (!confirm(`Delete "${session.title}"? This can't be undone.`)) return;
    await deleteSession(session.id).catch(() => {});
  }

  function SessionRow({ session, onSelect }: { session: AiChatSession; onSelect: () => void }) {
    const active = session.id === currentSessionId;
    if (renamingId === session.id) {
      return (
        <input
          autoFocus
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onBlur={() => commitRename(session.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename(session.id);
            if (e.key === "Escape") setRenamingId(null);
          }}
          className="w-full bg-panel2 border border-amber-dim rounded-md px-2.5 py-2 text-sm text-fg focus:outline-none"
        />
      );
    }
    return (
      <div
        className={clsx(
          "group flex items-center gap-1.5 rounded-md px-2.5 py-2 cursor-pointer",
          active ? "bg-panel2 border border-amber-dim/60" : "hover:bg-panel2 border border-transparent"
        )}
        onClick={onSelect}
      >
        <div className="min-w-0 flex-1">
          <div className="text-sm text-fg truncate">{session.title}</div>
          <div className="text-[11px] text-muted">{relativeDay(session.updatedAt)}</div>
        </div>
        <button
          className="opacity-0 group-hover:opacity-100 sm:opacity-100 text-muted hover:text-fg text-xs w-7 h-7 flex items-center justify-center shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            setRenamingId(session.id);
            setRenameValue(session.title);
          }}
          aria-label="Rename"
        >
          ✎
        </button>
        <button
          className="opacity-0 group-hover:opacity-100 sm:opacity-100 text-muted hover:text-bad text-xs w-7 h-7 flex items-center justify-center shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            handleDelete(session);
          }}
          aria-label="Delete"
        >
          🗑
        </button>
      </div>
    );
  }

  function SessionList({ onPick }: { onPick?: () => void }) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" onClick={handleNewChat} className="w-full">
          + New conversation
        </Button>
        {sessions.length === 0 ? (
          <div className="text-xs text-muted px-1">No conversations yet.</div>
        ) : (
          <div className="space-y-1">
            {sessions.map((s) => (
              <SessionRow
                key={s.id}
                session={s}
                onSelect={() => {
                  selectSession(s.id);
                  onPick?.();
                }}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const currentTitle = sessions.find((s) => s.id === currentSessionId)?.title ?? "New conversation";

  return (
    <>
      <PageHeader
        title="AI Assistant"
        action={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setMemoryOpen(true)}>
              🧠 Memory{memoryNotes.length > 0 ? ` (${memoryNotes.length})` : ""}
            </Button>
            <Button variant="ghost" onClick={handleNewChat}>
              + New chat
            </Button>
          </div>
        }
      />

      <div className="sm:hidden mb-4">
        <Button variant="ghost" onClick={() => setMobileSessionsOpen(true)} className="w-full justify-between">
          <span className="truncate">{currentTitle}</span>
          <span className="ml-2 shrink-0">▾</span>
        </Button>
      </div>

      <div className="flex gap-5 items-start">
        <aside className="hidden sm:block w-64 shrink-0">
          <Card>
            <SessionList />
          </Card>
        </aside>

        <div className="flex-1 min-w-0">
          <Card className="flex flex-col h-[65vh] sm:h-[70vh] p-0 overflow-hidden">
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {messages.length === 0 && (
                <EmptyState
                  title="Ask me anything about your numbers"
                  body="Or tell me what you sold, bought, or paid for — I'll fill in the entry for you to review and confirm."
                />
              )}
              {messages.map((m) => (
                <div key={m.id}>
                  <div className={clsx("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                    <div
                      className={clsx(
                        "max-w-[88%] sm:max-w-[75%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
                        m.role === "user" ? "bg-amber text-ink" : "bg-panel2 text-fg"
                      )}
                    >
                      {m.imageDataUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.imageDataUrl} alt="Attached receipt" className="rounded-md mb-2 max-h-48 w-full object-cover" />
                      )}
                      {m.text}
                    </div>
                  </div>
                  {m.proposals && m.proposals.length > 0 && (
                    <div className="mt-2 space-y-2 max-w-[88%] sm:max-w-[75%]">
                      {m.proposals.map((p) => (
                        <ProposedEntryCard key={p.id} entry={p} />
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {sending && <div className="text-xs text-muted px-1">Thinking…</div>}
            </div>

            <div className="border-t border-line p-3 shrink-0">
              {pendingImage && (
                <div className="mb-2 flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={pendingImage.dataUrl} alt="Attached" className="w-12 h-12 rounded object-cover border border-line" />
                  <button type="button" className="text-xs text-muted hover:text-bad" onClick={() => setPendingImage(null)}>
                    Remove photo
                  </button>
                </div>
              )}
              {error && <div className="text-xs text-bad mb-2">{error}</div>}
              <div className="flex gap-2 items-end">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Ask a question, or describe what happened…"
                  rows={1}
                  className="flex-1 resize-none bg-panel2 border border-line rounded-md px-3 py-2.5 text-base sm:text-sm text-fg placeholder:text-muted focus:outline-none focus:border-amber-dim max-h-32 min-h-[44px]"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="shrink-0 min-h-[44px] min-w-[44px] rounded-md border border-line text-muted hover:text-fg hover:border-muted flex items-center justify-center"
                  aria-label="Attach photo"
                >
                  📷
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) setPendingImage(await resizeImageFile(f));
                    e.target.value = "";
                  }}
                />
                <Button onClick={handleSend} disabled={sending || (!draft.trim() && !pendingImage)}>
                  Send
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Modal open={mobileSessionsOpen} onClose={() => setMobileSessionsOpen(false)} title="Conversations">
        <SessionList onPick={() => setMobileSessionsOpen(false)} />
      </Modal>

      <Modal open={memoryOpen} onClose={() => setMemoryOpen(false)} title="What the assistant remembers">
        <p className="text-sm text-muted mb-3">
          A short list of durable facts the assistant has picked up — a regular supplier, a category you always use for a
          certain cost. Delete anything you don't want it remembering.
        </p>
        {memoryNotes.length === 0 ? (
          <div className="text-sm text-muted">Nothing yet.</div>
        ) : (
          <div className="space-y-2">
            {memoryNotes.map((n) => (
              <div key={n.id} className="flex items-start justify-between gap-3 bg-panel2 border border-line rounded-md px-3 py-2">
                <div className="text-sm text-fg">{n.text}</div>
                <button
                  className="text-xs text-muted hover:text-bad shrink-0"
                  onClick={() => forgetMemoryNote(n.id)}
                  aria-label="Forget this"
                >
                  Forget
                </button>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </>
  );
}
