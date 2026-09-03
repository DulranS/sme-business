"use client";

import { useState } from "react";
import Link from "next/link";
import { Modal, Button, Checkbox } from "@/components/ui";
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
  const { sendMessage, currentSessionId, startNewSession, sending, error, clearError, autoConfirmEntries } = useAiAssistant();
  const [text, setText] = useState("");
  const [replyText, setReplyText] = useState<string | null>(null);
  const [proposals, setProposals] = useState<ProposedEntry[]>([]);
  const [autoConfirm, setAutoConfirm] = useState(true);
  const [autoConfirming, setAutoConfirming] = useState(false);

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

      // Auto-confirm if enabled and we have proposals
      if (autoConfirm && result.proposals.length > 0) {
        setAutoConfirming(true);
        setReplyText("⚡ Logging entries automatically...");
        try {
          const confirmResults = await autoConfirmEntries(result.proposals);
          const allSuccess = confirmResults.every(r => r.success);
          if (allSuccess) {
            setReplyText(`✓ ${result.proposals.length} entr${result.proposals.length === 1 ? 'y' : 'ies'} logged automatically!`);
            setProposals([]);
            setText("");
          } else {
            const failed = confirmResults.filter(r => !r.success);
            setReplyText(`⚠ ${failed.length} entr${failed.length === 1 ? 'y' : 'ies'} failed to auto-confirm. Please review below.`);
          }
        } catch (err) {
          setReplyText("⚠ Auto-confirmation failed. Please review and confirm manually.");
        } finally {
          setAutoConfirming(false);
        }
      }
    } catch {
      // error surfaced via context.error below
    }
    setText("");
  }

  return (
    <Modal open={open} onClose={handleClose} title="Quick Entry with AI">
      <div className="space-y-4">
        <div className="bg-panel2 border border-line rounded-md p-3">
          <p className="text-sm text-fg mb-2 font-medium">
            Describe any transaction in plain English:
          </p>
          <ul className="text-xs text-muted space-y-1 mb-2">
            <li>• &ldquo;Sold 5 cement bags to John for 2000 each&rdquo;</li>
            <li>• &ldquo;Bought 10 widgets from Supplier ABC for 500&rdquo;</li>
            <li>• &ldquo;Paid 1500 for electricity bill&rdquo;</li>
            <li>• &ldquo;Customer Mary bought 3 services for 3000&rdquo;</li>
          </ul>
          <p className="text-xs text-muted">
            💡 New products are created automatically if they don&apos;t exist
          </p>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Type your transaction here... (Press Enter to send)"
          rows={4}
          className="w-full bg-panel2 border border-line rounded-md px-3 py-2 text-base sm:text-sm text-fg placeholder:text-muted focus:outline-none focus:border-amber-dim resize-none"
          autoFocus
        />

        <div className="flex items-center gap-2 bg-panel2 border border-line rounded-md px-3 py-2">
          <Checkbox
            id="auto-confirm"
            checked={autoConfirm}
            onCheckedChange={(checked: boolean) => setAutoConfirm(checked)}
          />
          <label htmlFor="auto-confirm" className="text-sm text-fg cursor-pointer flex-1">
            Auto-confirm entries (skip manual review)
          </label>
        </div>

        <Button onClick={handleSend} disabled={!text.trim() || sending || autoConfirming} className="w-full">
          {sending ? "Thinking..." : autoConfirming ? "Logging..." : "Log Entry"}
        </Button>

        {error && (
          <div className="text-sm text-bad bg-bad/10 border border-bad/30 rounded-md px-3 py-2">
            ⚠ {error}
          </div>
        )}
        
        {replyText && (
          <div className={`text-sm rounded-md px-3 py-2 ${
            replyText.includes("✓") ? "bg-good/10 border border-good/30 text-good" :
            replyText.includes("⚠") ? "bg-amber/10 border border-amber/30 text-amber-soft" :
            "bg-panel2 border border-line text-fg"
          }`}>
            {replyText}
          </div>
        )}

        {proposals.length > 0 && (
          <div className="space-y-3 pt-2 border-t border-line">
            <p className="text-sm text-muted">Review and confirm entries:</p>
            {proposals.map((p) => (
              <ProposedEntryCard key={p.id} entry={p} />
            ))}
          </div>
        )}

        {currentSessionId && (
          <Link
            href="/assistant"
            onClick={handleClose}
            className="block text-center text-xs text-muted hover:text-fg pt-2"
          >
            Continue conversation in full assistant →
          </Link>
        )}
      </div>
    </Modal>
  );
}
