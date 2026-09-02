import { randomUUID } from "crypto";
import { requireAiContext, loadBusinessContext, AiAuthError } from "@/lib/firebaseAdmin";
import { callClaude, extractToolUses, AnthropicApiError, type AnthropicTool, type AnthropicTextBlock } from "@/lib/anthropic";
import { formatProductCatalogBlock, formatExpenseCategoriesBlock } from "@/lib/aiPrompts";
import { bestMatch } from "@/lib/aiMatch";
import type { AiOcrRequest, AiOcrResponse, ProposedEntry } from "@/lib/aiTypes";

export const runtime = "nodejs";

const EXTRACT_TOOL: AnthropicTool = {
  name: "extract_receipt",
  description: "Report the structured contents of a receipt/invoice photo.",
  input_schema: {
    type: "object",
    properties: {
      documentType: { type: "string", enum: ["purchase_receipt", "expense_receipt", "invoice", "unknown"], description: "purchase_receipt = stock/materials bought for resale/use in the business. expense_receipt/invoice = a bill/service (utilities, rent, a subscription, professional fees). unknown if illegible or not a receipt." },
      vendor: { type: "string" },
      date: { type: "string", description: "ISO date yyyy-mm-dd, as printed on the document." },
      currency: { type: "string", description: "Only if visibly different from the business's own currency." },
      lineItems: {
        type: "array",
        description: "One entry per distinct line item (only meaningful for purchase_receipt — leave empty for a single-line bill).",
        items: {
          type: "object",
          properties: {
            description: { type: "string" },
            qty: { type: "number" },
            unitPrice: { type: "number" },
          },
          required: ["description"],
        },
      },
      total: { type: "number", description: "The grand total on the document." },
      suggestedCategory: { type: "string", description: "For expense_receipt/invoice: best-fit category from the list given below." },
      confidence: { type: "string", enum: ["high", "medium", "low"] },
      summary: { type: "string", description: "One short sentence describing what this document is." },
    },
    required: ["documentType", "total", "summary"],
  },
};

export async function POST(req: Request) {
  let ctx;
  try {
    ctx = await requireAiContext(req);
  } catch (err) {
    if (err instanceof AiAuthError) return Response.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const body = (await req.json()) as AiOcrRequest;
  if (!body.imageBase64 || !body.imageMediaType) return Response.json({ error: "An image is required." }, { status: 400 });

  const { db, businessId } = ctx;
  const { settings, products } = await loadBusinessContext(db, businessId);
  const today = new Date().toISOString().slice(0, 10);

  const systemBlocks: AnthropicTextBlock[] = [
    {
      type: "text",
      text: `You read receipt/invoice photos for a small-business ledger app and extract their contents precisely — every number must come straight from the document, never estimated. Today's date: ${today}. Business currency: ${settings.currency}.\n\nProduct/service catalog (for matching purchase line items):\n${formatProductCatalogBlock(products)}\n\nExpense categories: ${formatExpenseCategoriesBlock()}\n\nAlways call extract_receipt with what you can read. If a field isn't legible, omit it rather than guess.`,
      cache_control: { type: "ephemeral" },
    },
  ];

  let response;
  try {
    response = await callClaude({
      system: systemBlocks,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: body.imageMediaType, data: body.imageBase64 } },
            { type: "text", text: "Extract this receipt/invoice." },
          ],
        },
      ],
      tools: [EXTRACT_TOOL],
      maxTokens: 1200,
    });
  } catch (err) {
    if (err instanceof AnthropicApiError) return Response.json({ error: err.message }, { status: 502 });
    throw err;
  }

  const toolUse = extractToolUses(response)[0];
  if (!toolUse) {
    return Response.json({ documentType: "unknown", summary: "Couldn't read that photo — try a clearer, well-lit shot.", proposals: [] } satisfies AiOcrResponse);
  }

  const input = toolUse.input as {
    documentType: AiOcrResponse["documentType"];
    vendor?: string;
    date?: string;
    currency?: string;
    lineItems?: { description: string; qty?: number; unitPrice?: number }[];
    total: number;
    suggestedCategory?: string;
    confidence?: "high" | "medium" | "low";
    summary: string;
  };

  const date = input.date && /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? input.date : today;
  const confidenceScore = input.confidence === "high" ? 0.9 : input.confidence === "medium" ? 0.6 : 0.35;
  const proposals: ProposedEntry[] = [];

  if (input.documentType === "purchase_receipt" && input.lineItems && input.lineItems.length > 0) {
    for (const item of input.lineItems) {
      const match = bestMatch(item.description, products.map((p) => ({ id: p.id, name: p.name })));
      proposals.push({
        id: randomUUID(),
        status: "pending",
        kind: "purchase",
        productName: item.description,
        matchedProductId: match.id,
        qty: item.qty && item.qty > 0 ? item.qty : 1,
        unitCost: item.unitPrice ?? (item.qty ? input.total / item.qty : input.total),
        currency: input.currency,
        supplier: input.vendor,
        date,
        notes: "From scanned receipt",
        confidence: confidenceScore,
      });
    }
  } else if (input.documentType === "purchase_receipt") {
    // No itemized lines were readable — still worth proposing a single
    // purchase entry against the vendor name so nothing has to be re-typed
    // from scratch, just matched to the right product by the user.
    proposals.push({
      id: randomUUID(),
      status: "pending",
      kind: "purchase",
      productName: input.vendor ?? "Item from receipt",
      qty: 1,
      unitCost: input.total,
      currency: input.currency,
      supplier: input.vendor,
      date,
      notes: "From scanned receipt — line items weren't legible, please check quantity/product",
      confidence: Math.min(confidenceScore, 0.5),
    });
  } else {
    proposals.push({
      id: randomUUID(),
      status: "pending",
      kind: "expense",
      name: input.vendor ? `${input.vendor}` : "Expense from receipt",
      amount: input.total,
      category: input.suggestedCategory,
      isRecurring: false,
      date,
      notes: "From scanned receipt",
      confidence: confidenceScore,
    });
  }

  const payload: AiOcrResponse = {
    documentType: input.documentType,
    vendor: input.vendor,
    date,
    summary: input.summary,
    proposals,
  };
  return Response.json(payload);
}
