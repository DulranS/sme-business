"use client";

import { useRef, useState } from "react";
import { Modal, Button } from "@/components/ui";
import { useAiAssistant } from "@/contexts/AiAssistantContext";
import { resizeImageFile } from "@/lib/imageResize";
import { ProposedEntryCard } from "./ProposedEntryCard";
import type { ProposedEntry } from "@/lib/aiTypes";

// The fourth quick action: "✨ Tell me what happened". A single free-text
// box (or a receipt photo) that turns into pre-filled, reviewable
// sale/purchase/expense entries via the same AI Assistant backing the full
// /assistant page — this is deliberately the fastest possible path from
// "I did a thing" to a logged entry, for the moment-to-moment data entry
// friction a solo owner actually feels.
export default function QuickAiEntryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { sendMessage, scanReceipt, currentSessionId, startNewSession, sending, error, clearError } = useAiAssistant();
  const [text, setText] = useState("");
  const [replyText, setReplyText] = useState<string | null>(null);
  const [proposals, setProposals] = useState<ProposedEntry[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  async function handlePhoto(file: File) {
    try {
      const img = await resizeImageFile(file);
      setReplyText(null);
      const result = await scanReceipt({ base64: img.base64, mediaType: img.mediaType });
      setReplyText(result.summary);
      setProposals(result.proposals);
    } catch {
      // error surfaced via context.error below
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Tell me what happened">
      <div className="space-y-3">
        <p className="text-sm text-muted">
          Describe a sale, a purchase, or a bill in your own words — or snap a photo of a receipt — and I&apos;ll fill in the entry for you to confirm.
        </p>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. Sold 3 bags of cement to Kamal for 4500 each, cash"
          rows={3}
          className="w-full bg-panel2 border border-line rounded-md px-3 py-2 text-base sm:text-sm text-fg placeholder:text-muted focus:outline-none focus:border-amber-dim resize-none"
        />

        <div className="flex flex-col sm:flex-row gap-2">
          <Button onClick={handleSend} disabled={!text.trim() || sending} className="flex-1">
            {sending ? "Working…" : "Send"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => fileInputRef.current?.click()}
            disabled={sending}
            className="flex-1"
          >
            📷 Scan a receipt
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handlePhoto(file);
              e.target.value = "";
            }}
          />
        </div>

        {error && <div className="text-sm text-bad">{error}</div>}
        {replyText && <div className="text-sm text-fg bg-panel2 border border-line rounded-md px-3 py-2">{replyText}</div>}

        {proposals.length > 0 && (
          <div className="space-y-3 pt-1">
            {proposals.map((p) => (
              <ProposedEntryCard key={p.id} entry={p} />
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
