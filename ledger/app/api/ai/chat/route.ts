import { randomUUID } from "crypto";
import {
  requireAiContext,
  loadBusinessContext,
  loadMemoryNotes,
  loadRecentMessages,
  ensureSession,
  appendMessage,
  addMemoryNote,
  type CompactProduct,
} from "@/lib/firebaseAdmin";
import {
  callClaude,
  extractToolUses,
  extractText,
  type AnthropicMessage,
  type AnthropicTool,
  type AnthropicTextBlock,
} from "@/lib/anthropic";
import { ASSISTANT_PERSONA, formatProductCatalogBlock, formatExpenseCategoriesBlock, formatMemoryBlock } from "@/lib/aiPrompts";
import { runReport, type ReportMetric } from "@/lib/aiReport";
import { bestMatch } from "@/lib/aiMatch";
import { aiErrorResponse } from "@/lib/apiError";
import type { AiChatMessage, AiChatRequest, AiChatResponse, ProposedEntry } from "@/lib/aiTypes";
import type { Expense, Purchase, Sale } from "@/lib/types";

export const runtime = "nodejs";

const REPORT_TOOL: AnthropicTool = {
  name: "run_report",
  description:
    "Compute a real number from the business's ledger. ALWAYS use this for any question about totals, spend, revenue, or comparisons — never answer from memory or estimate.",
  input_schema: {
    type: "object",
    properties: {
      metric: {
        type: "string",
        enum: ["expense_total", "expense_by_category", "sale_total", "sale_by_product", "purchase_total", "purchase_by_supplier", "net_cashflow"],
        description: "expense_total/expense_by_category = one-off bills paid. sale_total/sale_by_product = revenue. purchase_total/purchase_by_supplier = stock/materials bought. net_cashflow = revenue minus purchases minus bills, for a date range.",
      },
      startDate: { type: "string", description: "ISO date yyyy-mm-dd, inclusive. Compute this yourself from the user's phrase (e.g. 'last quarter') using today's date given below." },
      endDate: { type: "string", description: "ISO date yyyy-mm-dd, inclusive." },
      category: { type: "string", description: "Optional expense category filter, must exactly match one from the category list given below." },
      productName: { type: "string", description: "Optional product/service name filter (fuzzy-matched)." },
      supplier: { type: "string", description: "Optional supplier name filter (fuzzy-matched, purchase metrics only)." },
    },
    required: ["metric", "startDate", "endDate"],
  },
};

const PROPOSE_ENTRIES_TOOL: AnthropicTool = {
  name: "propose_entries",
  description: "Propose one or more ledger entries (sale/purchase/expense) for the user to review and confirm, based on something they described having done.",
  input_schema: {
    type: "object",
    properties: {
      entries: {
        type: "array",
        items: {
          type: "object",
          properties: {
            kind: { type: "string", enum: ["sale", "purchase", "expense"] },
            productName: { type: "string", description: "For kind=sale or purchase: the product/service name as best understood, even if unsure." },
            name: { type: "string", description: "For kind=expense: a short label for the bill (e.g. 'Electricity bill')." },
            qty: { type: "number", description: "For kind=sale or purchase." },
            unitPrice: { type: "number", description: "For kind=sale, the price per unit charged." },
            unitCost: { type: "number", description: "For kind=purchase, the cost per unit paid." },
            amount: { type: "number", description: "For kind=expense, the total amount." },
            category: { type: "string", description: "For kind=expense, must exactly match one from the category list below." },
            isRecurring: { type: "boolean", description: "For kind=expense: true only if the user described a recurring/regular bill, otherwise false." },
            currency: { type: "string", description: "Only set if the user specified a currency different from the business's own." },
            customer: { type: "string", description: "For kind=sale, if named." },
            supplier: { type: "string", description: "For kind=purchase, if named." },
            date: { type: "string", description: "ISO date yyyy-mm-dd — today's date unless the user said otherwise." },
            paymentMethod: { type: "string", enum: ["cash", "card", "bank_transfer", "credit"] },
            notes: { type: "string" },
            confidence: { type: "number", description: "0-1, how sure you are about this entry's details." },
          },
          required: ["kind", "date"],
        },
      },
    },
    required: ["entries"],
  },
};

const REMEMBER_TOOL: AnthropicTool = {
  name: "remember_note",
  description: "Save one short durable fact about how this business likes things logged, for future conversations. Use sparingly.",
  input_schema: {
    type: "object",
    properties: { note: { type: "string", description: "One short sentence, under 240 characters." } },
    required: ["note"],
  },
};

function toAnthropicMessages(history: AiChatMessage[]): AnthropicMessage[] {
  return history.map((m) => ({ role: m.role, content: m.text || "(empty)" }));
}

function normalizeProposedEntry(raw: Record<string, unknown>, products: CompactProduct[]): ProposedEntry | null {
  const kind = raw.kind as string;
  const id = randomUUID();
  const confidence = typeof raw.confidence === "number" ? raw.confidence : undefined;
  const date = typeof raw.date === "string" && raw.date ? raw.date : new Date().toISOString().slice(0, 10);

  if (kind === "sale") {
    const productName = String(raw.productName ?? "").trim();
    if (!productName) return null;
    const match = bestMatch(productName, products.map((p) => ({ id: p.id, name: p.name })));
    return {
      id,
      status: "pending",
      kind: "sale",
      productName,
      matchedProductId: match.id,
      qty: Number(raw.qty) || 1,
      unitPrice: Number(raw.unitPrice) || 0,
      currency: raw.currency as string | undefined,
      customer: raw.customer as string | undefined,
      date,
      paymentMethod: raw.paymentMethod as "cash" | "card" | "bank_transfer" | "credit" | undefined,
      notes: raw.notes as string | undefined,
      confidence,
    };
  }
  if (kind === "purchase") {
    const productName = String(raw.productName ?? "").trim();
    if (!productName) return null;
    const match = bestMatch(productName, products.map((p) => ({ id: p.id, name: p.name })));
    return {
      id,
      status: "pending",
      kind: "purchase",
      productName,
      matchedProductId: match.id,
      qty: Number(raw.qty) || 1,
      unitCost: Number(raw.unitCost) || 0,
      currency: raw.currency as string | undefined,
      supplier: raw.supplier as string | undefined,
      date,
      notes: raw.notes as string | undefined,
      confidence,
    };
  }
  if (kind === "expense") {
    const name = String(raw.name ?? raw.productName ?? "").trim();
    if (!name) return null;
    return {
      id,
      status: "pending",
      kind: "expense",
      name,
      amount: Number(raw.amount) || 0,
      category: raw.category as string | undefined,
      isRecurring: Boolean(raw.isRecurring),
      date,
      notes: raw.notes as string | undefined,
      confidence,
    };
  }
  return null;
}

export async function POST(req: Request) {
  // Everything below — including the Firebase Admin init inside
  // requireAiContext, which throws a plain Error (not AiAuthError) if the
  // server's env vars are missing, and the second/follow-up callClaude
  // call after a tool_use turn, which previously had no try/catch at
  // all — is now covered by one handler so no failure mode reaches the
  // client as an opaque platform 500/502 with no message.
  try {
    const ctx = await requireAiContext(req);
    const body = (await req.json()) as AiChatRequest;
    const message = (body.message ?? "").trim();
    if (!message) return Response.json({ error: "Message is empty." }, { status: 400 });
    if (!body.sessionId) return Response.json({ error: "sessionId is required." }, { status: 400 });

    const { db, businessId, uid, memberName } = ctx;

    const [{ settings, products }, memoryNotes, recentMessages] = await Promise.all([
      loadBusinessContext(db, businessId),
      loadMemoryNotes(db, businessId),
      loadRecentMessages(db, businessId, body.sessionId),
    ]);

    await ensureSession(db, businessId, body.sessionId, uid, memberName, message);

    const today = new Date().toISOString().slice(0, 10);
    const systemBlocks: AnthropicTextBlock[] = [
      { type: "text", text: ASSISTANT_PERSONA },
      {
        type: "text",
        text: `Today's date: ${today}\nBusiness currency: ${settings.currency}\n\nProduct/service catalog:\n${formatProductCatalogBlock(products)}\n\nExpense categories: ${formatExpenseCategoriesBlock()}\n\nThings you've learned about this business:\n${formatMemoryBlock(memoryNotes)}`,
        cache_control: { type: "ephemeral" },
      },
    ];

    const messages: AnthropicMessage[] = [...toAnthropicMessages(recentMessages), { role: "user", content: message }];

    let response = await callClaude({
      system: systemBlocks,
      messages,
      tools: [REPORT_TOOL, PROPOSE_ENTRIES_TOOL, REMEMBER_TOOL],
      maxTokens: 1200,
    });

    let proposals: ProposedEntry[] = [];
    let rememberedNote: string | undefined;

    if (response.stop_reason === "tool_use") {
      const toolUses = extractToolUses(response);
      const toolResults: { type: "tool_result"; tool_use_id: string; content: string }[] = [];

      // Ledger data for run_report is only fetched when actually needed —
      // most turns (a question that doesn't need a number, or a data-entry
      // prompt) never touch these three collections at all.
      let ledgerData: { startDate: string; endDate: string; expenses: Expense[]; purchases: Purchase[]; sales: Sale[] } | null = null;
      const productNameById = new Map(products.map((p) => [p.id, p.name]));

      for (const use of toolUses) {
        if (use.name === "run_report") {
          const input = use.input as { metric: ReportMetric; startDate: string; endDate: string; category?: string; productName?: string; supplier?: string };
          if (!ledgerData || ledgerData.startDate !== input.startDate || ledgerData.endDate !== input.endDate) {
            // Pushed down as Firestore range queries on the date field instead
            // of `.get()`-ing the whole collection: expenses/purchases/sales
            // grow without bound over a business's lifetime, but a report
            // question only ever needs rows inside [startDate, endDate]. This
            // is the same window aiReport.ts would filter down to anyway — the
            // model already gives us the range — so pushing it into the query
            // means a "sales this month" question costs a month of reads, not
            // the business's entire sales history, no matter how many years
            // of data have piled up.
            const [expensesSnap, purchasesSnap, salesSnap] = await Promise.all([
              db
                .collection(`users/${businessId}/expenses`)
                .where("startDate", ">=", input.startDate)
                .where("startDate", "<=", input.endDate)
                .get(),
              db
                .collection(`users/${businessId}/purchases`)
                .where("date", ">=", input.startDate)
                .where("date", "<=", input.endDate)
                .get(),
              db
                .collection(`users/${businessId}/sales`)
                .where("date", ">=", input.startDate)
                .where("date", "<=", input.endDate)
                .get(),
            ]);
            ledgerData = {
              startDate: input.startDate,
              endDate: input.endDate,
              expenses: expensesSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Expense),
              purchases: purchasesSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Purchase),
              sales: salesSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Sale),
            };
          }
          const result = runReport({ ...input, productNameById }, ledgerData, settings.currency);
          toolResults.push({ type: "tool_result", tool_use_id: use.id, content: JSON.stringify(result) });
        } else if (use.name === "propose_entries") {
          const input = use.input as { entries: Record<string, unknown>[] };
          const normalized = (input.entries ?? []).map((e) => normalizeProposedEntry(e, products)).filter((e): e is ProposedEntry => e !== null);
          proposals = proposals.concat(normalized);
          toolResults.push({ type: "tool_result", tool_use_id: use.id, content: `Proposed ${normalized.length} entr${normalized.length === 1 ? "y" : "ies"} for the user to review.` });
        } else if (use.name === "remember_note") {
          const input = use.input as { note: string };
          rememberedNote = input.note;
          await addMemoryNote(db, businessId, input.note);
          toolResults.push({ type: "tool_result", tool_use_id: use.id, content: "Saved." });
        }
      }

      response = await callClaude({
        system: systemBlocks,
        messages: [...messages, { role: "assistant", content: response.content }, { role: "user", content: toolResults }],
        tools: [REPORT_TOOL, PROPOSE_ENTRIES_TOOL, REMEMBER_TOOL],
        maxTokens: 500,
      });
    }

    const reply = extractText(response) || (proposals.length ? "Here's what I've got — take a look below." : "Done.");

    const userMessage: AiChatMessage = {
      id: randomUUID(),
      role: "user",
      text: message,
      createdAt: Date.now(),
    };
    const assistantMessage: AiChatMessage = {
      id: randomUUID(),
      role: "assistant",
      text: reply,
      proposals: proposals.length ? proposals : undefined,
      createdAt: Date.now() + 1,
    };
    await appendMessage(db, businessId, body.sessionId, userMessage);
    await appendMessage(db, businessId, body.sessionId, assistantMessage);

    const payload: AiChatResponse = { reply, proposals, rememberedNote };
    return Response.json(payload);
  } catch (err) {
    return aiErrorResponse(err, "api/ai/chat");
  }
}
