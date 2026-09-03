"use client";

import { useState } from "react";
import Link from "next/link";
import { Modal, Button } from "@/components/ui";
import { useAiAssistant } from "@/contexts/AiAssistantContext";
import { ProposedEntryCard } from "./ProposedEntryCard";
import type { ProposedEntry } from "@/lib/aiTypes";

// The fourth quick action: "✨ Tell me what happened". A single free-text
// box that turns into pre-filled, reviewable sale/purchase/expense entries
// via the same AI Assistant backing the full /assistant page — this is
// deliberately the fastest possible path from "I did a thing" to a logged
// entry, for the moment-to-moment data entry friction a solo owner
// actually feels.
export default function QuickAiEntryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { sendMessage, currentSessionId, startNewSession, sending, error, clearError } = useAiAssistant();
  const [text, setText] = useState("");
  const [replyText, setReplyText] = useState<string | null>(null);
  const [proposals, setProposals] = useState<ProposedEntry[]>([]);

  function reset() {
    setText("");
    setReplyText(null);
    setProposals([]);
    clearError();
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    if (!currentSessionId) startNewSession();
    setReplyText(null);
    try {
      const result = await sendMessage(trimmed);
      setReplyText(result.reply);
      setProposals(result.proposals);
    } catch {
      // error surfaced via context.error below
    }
    setText("");
  }

  return (
    <Modal open={open} onClose={handleClose} title="Tell me what happened">
      <div className="space-y-3">
        <p className="text-sm text-muted">
          Describe a sale, a purchase, or a bill in your own words and I&apos;ll fill in the entry for you to confirm.
        </p>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // Same Enter-to-send / Shift+Enter-for-newline behavior as the
            // full /assistant page's composer — the assistant should feel
            // like the same assistant no matter which door you came in.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="e.g. Sold 3 bags of cement to Kamal for 4500 each, cash"
          rows={3}
          className="w-full bg-panel2 border border-line rounded-md px-3 py-2 text-base sm:text-sm text-fg placeholder:text-muted focus:outline-none focus:border-amber-dim resize-none"
        />

        <Button onClick={handleSend} disabled={!text.trim() || sending} className="w-full">
          {sending ? "Working…" : "Send"}
        </Button>

        {error && <div className="text-sm text-bad">{error}</div>}
        {replyText && <div className="text-sm text-fg bg-panel2 border border-line rounded-md px-3 py-2">{replyText}</div>}

        {proposals.length > 0 && (
          <div className="space-y-3 pt-1">
            {proposals.map((p) => (
              <ProposedEntryCard key={p.id} entry={p} />
            ))}
          </div>
        )}

        {currentSessionId && (
          // The modal is a fast entry point, not a separate conversation —
          // this hands off to /assistant on the *same* session (currentSessionId
          // lives in AiAssistantContext, above this modal, so the full page
          // picks it straight up) instead of the exchange just vanishing
          // when the modal closes.
          <Link
            href="/assistant"
            onClick={handleClose}
            className="block text-center text-xs text-muted hover:text-fg pt-1"
          >
            Continue this conversation in the full assistant →
          </Link>
        )}
      </div>
    </Modal>
  );
}
