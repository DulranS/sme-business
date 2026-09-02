// Shared types for the AI Assistant feature: natural-language Q&A over the
// ledger, natural-language data entry, and receipt/invoice OCR. Used by
// both the client (contexts/AiAssistantContext.tsx, app/assistant) and the
// server routes (app/api/ai/*). Kept dependency-free so it can be imported
// from either side without pulling in firebase-admin or the Anthropic SDK.

// ---------------------------------------------------------------------------
// Chat history — persisted at users/{businessId}/aiChatSessions/{sessionId}
// and .../messages/{messageId}. This is the durable "history" half of the
// feature: every session survives a refresh, a new device, or a re-login.
// ---------------------------------------------------------------------------

export interface AiChatSession {
  id: string;
  title: string; // auto-generated from the first message, editable later
  createdAt: number;
  updatedAt: number;
  createdByUid: string;
  createdByName?: string;
  lastMessagePreview?: string;
}

export type AiMessageRole = "user" | "assistant";

export interface AiChatMessage {
  id: string;
  role: AiMessageRole;
  text: string;
  // Present on a user message that attached a photo (receipt/invoice) —
  // stored as a small data URL only long enough to render the bubble; not
  // re-sent to the model on later turns (the extraction result already is).
  imageDataUrl?: string;
  // Present on an assistant message that proposed one or more ledger
  // entries for the user to review/confirm. Populated by /api/ai/chat or
  // /api/ai/ocr. Each entry tracks its own confirmed/discarded state so a
  // partially-actioned proposal renders correctly on reload.
  proposals?: ProposedEntry[];
  createdAt: number;
}

// ---------------------------------------------------------------------------
// Proposed ledger entries — what the model produces from a natural-language
// description or a receipt photo. Never written to the ledger directly by
// the server: the client renders each one pre-filled into the same
// QuickSaleForm/QuickStockForm/QuickExpenseForm used everywhere else in the
// app, the user reviews it, and only the existing addSale/addPurchase/
// addExpense calls (same permission checks, same audit log) commit it.
// ---------------------------------------------------------------------------

export type ProposedEntryStatus = "pending" | "confirmed" | "discarded";

interface ProposedEntryBase {
  id: string; // client-generated, stable within the message
  status: ProposedEntryStatus;
  // 0-1 confidence the model reported for this specific entry — surfaced
  // as a subtle "double-check this one" hint below ~0.6, never blocking.
  confidence?: number;
  sourceNote?: string; // short reason string, e.g. "matched from receipt"
}

export interface ProposedSaleEntry extends ProposedEntryBase {
  kind: "sale";
  productName: string; // free text as understood from the prompt/receipt
  matchedProductId?: string; // resolved server-side by fuzzy name match, if any
  qty: number;
  unitPrice: number;
  currency?: string; // only set if different from the business's base currency
  customer?: string;
  date: string; // ISO date
  paymentMethod?: "cash" | "card" | "bank_transfer" | "credit";
  notes?: string;
}

export interface ProposedPurchaseEntry extends ProposedEntryBase {
  kind: "purchase";
  productName: string;
  matchedProductId?: string;
  qty: number;
  unitCost: number;
  currency?: string;
  supplier?: string;
  date: string;
  notes?: string;
}

export interface ProposedExpenseEntry extends ProposedEntryBase {
  kind: "expense";
  name: string;
  amount: number;
  category?: string;
  isRecurring: boolean;
  date: string;
  notes?: string;
}

export type ProposedEntry = ProposedSaleEntry | ProposedPurchaseEntry | ProposedExpenseEntry;

// ---------------------------------------------------------------------------
// Long-term memory — a short, capped list of durable facts the assistant
// has learned about how this business likes things logged (a regular
// supplier, a preferred category mapping, a recurring correction). Stored
// at users/{businessId}/aiMemory/{noteId}. Deliberately small and fully
// visible/deletable by the owner in Settings → AI memory — this is context
// the model gets to read, not a hidden profile.
// ---------------------------------------------------------------------------

export interface AiMemoryNote {
  id: string;
  text: string;
  createdAt: number;
}

export const AI_MEMORY_MAX_NOTES = 40;
export const AI_MEMORY_MAX_NOTE_LENGTH = 240;

// ---------------------------------------------------------------------------
// API request/response shapes for app/api/ai/chat and app/api/ai/ocr.
// ---------------------------------------------------------------------------

export interface AiChatRequest {
  sessionId: string;
  message: string;
  imageBase64?: string; // optional receipt/photo attached to this turn
  imageMediaType?: string;
}

export interface AiChatResponse {
  reply: string;
  proposals: ProposedEntry[];
  rememberedNote?: string;
}

export interface AiOcrRequest {
  imageBase64: string;
  imageMediaType: string;
}

export interface AiOcrResponse {
  documentType: "purchase_receipt" | "expense_receipt" | "invoice" | "unknown";
  vendor?: string;
  date?: string;
  summary: string;
  proposals: ProposedEntry[];
}

export const AI_MODEL = "claude-haiku-4-5-20251001";
