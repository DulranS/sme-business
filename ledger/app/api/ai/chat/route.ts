import { randomUUID } from "crypto";
import { requireAiContext, loadBusinessContext, loadMemoryNotes, loadRecentMessages, ensureSession, addMemoryNote, appendMessage, AiAuthError, type CompactProduct } from "@/lib/firebaseAdmin";
import type { QuerySnapshot } from "firebase-admin/firestore";
import { callClaude, extractToolUses, extractText, AnthropicApiError, type AnthropicTool, type AnthropicTextBlock, type AnthropicMessage } from "@/lib/anthropic";
import { formatProductCatalogBlock, formatExpenseCategoriesBlock, formatMemoryBlock, ASSISTANT_PERSONA } from "@/lib/aiPrompts";
import { runReport, type ReportMetric } from "@/lib/aiReport";
import { bestMatch } from "@/lib/aiMatch";
import { generateAnomalyReport } from "@/lib/aiAnomalyDetection";
import { generateCashFlowForecast } from "@/lib/aiCashFlowPrediction";
import { generateSmartReminders } from "@/lib/aiSmartReminders";
import { aiErrorResponse } from "@/lib/apiError";
import type { AiChatMessage, AiChatRequest, AiChatResponse, ProposedEntry } from "@/lib/aiTypes";
import type { Expense, Purchase, Sale, Settings, ReceivablePayment, PayablePayment } from "@/lib/types";

export const runtime = "nodejs";

const REPORT_TOOL: AnthropicTool = {
  name: "run_report",
  description: "Compute ledger numbers. Use for totals, spend, revenue, comparisons. Never estimate.",
  input_schema: {
    type: "object",
    properties: {
      metric: {
        type: "string",
        enum: ["expense_total", "expense_by_category", "sale_total", "sale_by_product", "sale_by_customer", "purchase_total", "purchase_by_supplier", "net_cashflow"],
        description: "expense_total/expense_by_category = one-off bills. sale_total/sale_by_product/sale_by_customer = revenue. purchase_total/purchase_by_supplier = stock/materials. net_cashflow = revenue minus purchases minus bills.",
      },
      startDate: { type: "string", description: "ISO date yyyy-mm-dd. Compute from user's phrase (e.g. 'last quarter')." },
      endDate: { type: "string", description: "ISO date yyyy-mm-dd." },
      category: { type: "string", description: "Optional expense category filter." },
      productName: { type: "string", description: "Optional product name filter (fuzzy)." },
      supplier: { type: "string", description: "Optional supplier name filter (fuzzy, purchase metrics only)." },
      customer: { type: "string", description: "Optional customer name filter (fuzzy, sale metrics only)." },
    },
    required: ["metric", "startDate", "endDate"],
  },
};

const PROPOSE_ENTRIES_TOOL: AnthropicTool = {
  name: "propose_entries",
  description: "Propose ledger entries (sale/purchase/expense) from user's description.",
  input_schema: {
    type: "object",
    properties: {
      entries: {
        type: "array",
        items: {
          type: "object",
          properties: {
            kind: { type: "string", enum: ["sale", "purchase", "expense"] },
            productName: { type: "string", description: "For sale/purchase: product name." },
            name: { type: "string", description: "For expense: bill label." },
            qty: { type: "number", description: "For sale/purchase." },
            unitPrice: { type: "number", description: "For sale: price per unit." },
            unitCost: { type: "number", description: "For purchase: cost per unit." },
            amount: { type: "number", description: "For expense: total." },
            category: { type: "string", description: "For expense: match category list." },
            isRecurring: { type: "boolean", description: "For expense: true if recurring bill." },
            currency: { type: "string", description: "Only if different from business currency." },
            customer: { type: "string", description: "For sale." },
            supplier: { type: "string", description: "For purchase." },
            date: { type: "string", description: "ISO yyyy-mm-dd. Today unless specified." },
            paymentMethod: { type: "string", enum: ["cash", "card", "bank_transfer", "credit"] },
            notes: { type: "string" },
            confidence: { type: "number", description: "0-1 certainty." },
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
  description: "Save a durable fact for future conversations. Use sparingly.",
  input_schema: {
    type: "object",
    properties: { note: { type: "string", description: "Short sentence, under 240 chars." } },
    required: ["note"],
  },
};

const ANOMALY_DETECTION_TOOL: AnthropicTool = {
  name: "detect_anomalies",
  description: "Detect unusual spending patterns in expenses and purchases. Use when user asks about unusual costs, anomalies, or spending patterns.",
  input_schema: {
    type: "object",
    properties: {},
    required: [],
  },
};

const CASH_FLOW_FORECAST_TOOL: AnthropicTool = {
  name: "forecast_cash_flow",
  description: "Generate cash flow predictions for future months. Use when user asks about cash flow, future projections, or financial forecasts.",
  input_schema: {
    type: "object",
    properties: {
      months: { type: "number", description: "Number of months to forecast (default: 3)." },
    },
    required: [],
  },
};

const SMART_REMINDERS_TOOL: AnthropicTool = {
  name: "get_reminders",
  description: "Get smart reminders for overdue payments and important business events. Use when user asks about reminders, overdue items, or things to follow up on.",
  input_schema: {
    type: "object",
    properties: {},
    required: [],
  },
};

const CREATE_PRODUCT_TOOL: AnthropicTool = {
  name: "create_product",
  description: "Create a new product when the user mentions a product name that doesn't exist in the catalog. Use this BEFORE propose_entries when you encounter a new product.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Product name as mentioned by the user." },
      type: { type: "string", enum: ["product", "service"], description: "Whether this is a physical product or a service. Default to 'product' unless clearly a service." },
      category: { type: "string", description: "Product category. Use 'General' if not specified." },
      defaultSellPrice: { type: "number", description: "Default selling price per unit if mentioned." },
      defaultCostPrice: { type: "number", description: "Default cost price per unit if mentioned." },
    },
    required: ["name"],
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

    let runningMessages: AnthropicMessage[] = [...toAnthropicMessages(recentMessages), { role: "user", content: message }];

    let response = await callClaude({
      system: systemBlocks,
      messages: runningMessages,
      tools: [REPORT_TOOL, PROPOSE_ENTRIES_TOOL, CREATE_PRODUCT_TOOL, REMEMBER_TOOL, ANOMALY_DETECTION_TOOL, CASH_FLOW_FORECAST_TOOL, SMART_REMINDERS_TOOL],
      maxTokens: 800,
    });

    let proposals: ProposedEntry[] = [];
    let rememberedNote: string | undefined;

    // Ledger data for run_report is only fetched when actually needed —
    // most turns (a question that doesn't need a number, or a data-entry
    // prompt) never touch these three collections at all. Declared outside
    // the round loop below so a compound request that calls run_report in
    // two different rounds still only pays for a matching date range once.
    let ledgerData: { startDate: string; endDate: string; expenses: Expense[]; purchases: Purchase[]; sales: Sale[] } | null = null;
    const productNameById = new Map(products.map((p) => [p.id, p.name]));

    // Backing data for detect_anomalies / forecast_cash_flow — both are
    // statistical over recent history rather than a single date range the
    // model supplies, so (unlike run_report) there's no caller-given
    // window to push down into the query. A fixed 12-month lookback keeps
    // the read bounded as the ledger grows, the same cost concern
    // run_report's range query exists for, while still giving both
    // functions enough months to establish a real baseline/trend. Shared
    // across both tools if a single turn calls both.
    let recentOperationalData: { expenses: Expense[]; purchases: Purchase[]; sales: Sale[] } | null = null;
    async function loadRecentOperationalData() {
      if (recentOperationalData) return recentOperationalData;
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
      const since = twelveMonthsAgo.toISOString().slice(0, 10);
      // The explicit tuple annotation here (and on the two other
      // Promise.all destructures below) isn't decorative — without it,
      // TypeScript's control-flow analysis of the `let ledgerData` /
      // `let recentOperationalData` / `let overdueData` variables across
      // this `for` loop's iterations gets tangled up with inferring
      // these destructured elements' types from Promise.all, and it
      // gives up with "'expensesSnap' implicitly has type 'any' because
      // it does not have a type annotation and is referenced directly
      // or indirectly in its own initializer" (TS7022), which then
      // cascades into "Parameter 'd' implicitly has an 'any' type"
      // (TS7006) everywhere `.docs.map((d) => ...)` is used below.
      const [expensesSnap, purchasesSnap, salesSnap]: [QuerySnapshot, QuerySnapshot, QuerySnapshot] = await Promise.all([
        db.collection(`users/${businessId}/expenses`).where("startDate", ">=", since).get(),
        db.collection(`users/${businessId}/purchases`).where("date", ">=", since).get(),
        db.collection(`users/${businessId}/sales`).where("date", ">=", since).get(),
      ]);
      recentOperationalData = {
        expenses: expensesSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Expense),
        purchases: purchasesSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Purchase),
        sales: salesSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Sale),
      };
      return recentOperationalData;
    }

    // Backing data for get_reminders — overdue receivables/payables can
    // originate from any point in the ledger's history (an invoice from
    // eight months ago is still overdue today), so unlike the two loaders
    // above this deliberately isn't date-bounded. Mirrors the same
    // full-collection read app/api/aging/report/route.ts already does for
    // the same reminder-relevant data.
    let overdueData: { sales: Sale[]; purchases: Purchase[]; receivablePayments: ReceivablePayment[]; payablePayments: PayablePayment[] } | null = null;
    async function loadOverdueData() {
      if (overdueData) return overdueData;
      const [salesSnap, purchasesSnap, receivablePaymentsSnap, payablePaymentsSnap]: [QuerySnapshot, QuerySnapshot, QuerySnapshot, QuerySnapshot] = await Promise.all([
        db.collection(`users/${businessId}/sales`).get(),
        db.collection(`users/${businessId}/purchases`).get(),
        db.collection(`users/${businessId}/receivablePayments`).get(),
        db.collection(`users/${businessId}/payablePayments`).get(),
      ]);
      overdueData = {
        sales: salesSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Sale),
        purchases: purchasesSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Purchase),
        receivablePayments: receivablePaymentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as ReceivablePayment),
        payablePayments: payablePaymentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as PayablePayment),
      };
      return overdueData;
    }

    // Bounded loop, not a single `if` — a compound request ("what did I
    // spend on packaging last month, and log this delivery bill too") needs
    // the model to see one tool's result before it can decide to call a
    // second tool. The previous shape here was exactly one round: initial
    // call, then (if tool_use) exactly one follow-up call, whose own result
    // was read for text only. Any tool_use in *that* follow-up — a second
    // run_report after the first, a propose_entries called only once the
    // model had the numbers in hand — was silently discarded: no error, no
    // proposal, nothing logged, same failure shape as the thinking-mode bug
    // above but with a different cause. MAX_TOOL_ROUNDS bounds the retry
    // cost if a model ever got stuck calling tools indefinitely; hitting it
    // still returns whatever text/proposals/note were already collected
    // rather than erroring the whole turn out.
    const MAX_TOOL_ROUNDS = 4;
    let round = 0;

    while (response.stop_reason === "tool_use" && round < MAX_TOOL_ROUNDS) {
      round++;
      const toolUses = extractToolUses(response);
      const toolResults: { type: "tool_result"; tool_use_id: string; content: string }[] = [];

      for (const use of toolUses) {
        if (use.name === "run_report") {
          const input = use.input as { metric: ReportMetric; startDate?: string; endDate?: string; category?: string; productName?: string; supplier?: string; customer?: string };
          // startDate/endDate are marked "required" in the tool schema, but
          // that's only a hint to the model — DeepSeek (or any model) can
          // still omit one, and an undefined value passed straight into
          // .where() throws a hard Firestore error ("Value for argument
          // \"value\" is not a valid query constraint") before the request
          // ever reaches runReport. Fall back to a sensible bounded window
          // instead of crashing the whole turn over a malformed tool call.
          const dateRe = /^\d{4}-\d{2}-\d{2}$/;
          const oneYearAgo = new Date();
          oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
          const safeStartDate = input.startDate && dateRe.test(input.startDate) ? input.startDate : oneYearAgo.toISOString().slice(0, 10);
          const safeEndDate = input.endDate && dateRe.test(input.endDate) ? input.endDate : today;
          if (!ledgerData || ledgerData.startDate !== safeStartDate || ledgerData.endDate !== safeEndDate) {
            // Pushed down as Firestore range queries on the date field instead
            // of `.get()`-ing the whole collection: expenses/purchases/sales
            // grow without bound over a business's lifetime, but a report
            // question only ever needs rows inside [startDate, endDate]. This
            // is the same window aiReport.ts would filter down to anyway — the
            // model already gives us the range — so pushing it into the query
            // means a "sales this month" question costs a month of reads, not
            // the business's entire sales history, no matter how many years
            // of data have piled up.
            const [expensesSnap, purchasesSnap, salesSnap]: [QuerySnapshot, QuerySnapshot, QuerySnapshot] = await Promise.all([
              db
                .collection(`users/${businessId}/expenses`)
                .where("startDate", ">=", safeStartDate)
                .where("startDate", "<=", safeEndDate)
                .get(),
              db
                .collection(`users/${businessId}/purchases`)
                .where("date", ">=", safeStartDate)
                .where("date", "<=", safeEndDate)
                .get(),
              db
                .collection(`users/${businessId}/sales`)
                .where("date", ">=", safeStartDate)
                .where("date", "<=", safeEndDate)
                .get(),
            ]);
            ledgerData = {
              startDate: safeStartDate,
              endDate: safeEndDate,
              expenses: expensesSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Expense),
              purchases: purchasesSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Purchase),
              sales: salesSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Sale),
            };
          }
          const result = runReport({ ...input, startDate: safeStartDate, endDate: safeEndDate, productNameById }, ledgerData, settings.currency);
          toolResults.push({ type: "tool_result", tool_use_id: use.id, content: JSON.stringify(result) });
        } else if (use.name === "create_product") {
          const input = use.input as { name: string; type?: string; category?: string; defaultSellPrice?: number; defaultCostPrice?: number };
          const newProduct = {
            name: input.name,
            type: (input.type as "product" | "service") || "product",
            category: input.category || "General",
            sku: "",
            active: true,
            defaultSellPrice: input.defaultSellPrice,
            defaultCostPrice: input.defaultCostPrice,
            createdAt: Date.now(),
          };
          const docRef = await db.collection(`users/${businessId}/products`).add(newProduct);
          // Add to products list for subsequent propose_entries calls
          products.push({ id: docRef.id, name: input.name, type: newProduct.type, sku: "" });
          toolResults.push({ type: "tool_result", tool_use_id: use.id, content: `Created product "${input.name}" with ID ${docRef.id}.` });
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
        } else if (use.name === "detect_anomalies") {
          const { expenses, purchases } = await loadRecentOperationalData();
          const report = generateAnomalyReport(expenses, purchases);
          toolResults.push({ type: "tool_result", tool_use_id: use.id, content: JSON.stringify(report) });
        } else if (use.name === "forecast_cash_flow") {
          const input = use.input as { months?: number };
          const { sales, expenses, purchases } = await loadRecentOperationalData();
          const forecast = generateCashFlowForecast(sales, expenses, purchases, settings, input.months || 3);
          toolResults.push({ type: "tool_result", tool_use_id: use.id, content: JSON.stringify(forecast) });
        } else if (use.name === "get_reminders") {
          const { sales, purchases, receivablePayments, payablePayments } = await loadOverdueData();
          const reminders = generateSmartReminders(sales, purchases, receivablePayments, payablePayments);
          toolResults.push({ type: "tool_result", tool_use_id: use.id, content: JSON.stringify(reminders) });
        }
      }

      runningMessages = [...runningMessages, { role: "assistant", content: response.content }, { role: "user", content: toolResults }];
      response = await callClaude({
        system: systemBlocks,
        messages: runningMessages,
        tools: [REPORT_TOOL, PROPOSE_ENTRIES_TOOL, CREATE_PRODUCT_TOOL, REMEMBER_TOOL, ANOMALY_DETECTION_TOOL, CASH_FLOW_FORECAST_TOOL, SMART_REMINDERS_TOOL],
        maxTokens: 400,
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
      ...(proposals.length ? { proposals } : {}),
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