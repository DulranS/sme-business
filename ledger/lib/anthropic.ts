// Server-only. Never imported from a "use client" file — it reads
// process.env.DEEPSEEK_API_KEY, which must never reach the browser bundle.
//
// Deliberately a thin hand-rolled fetch wrapper rather than an SDK package:
// the assistant only ever needs one endpoint (Messages, with tool use),
// and keeping this dependency-free means one less thing to keep updated in
// a solo-owner's app.
//
// Model: DeepSeek V4 Flash (deepseek-v4-flash), called through DeepSeek's
// Anthropic-compatible endpoint (base_url https://api.deepseek.com/anthropic)
// rather than its native OpenAI-style one. Reasoning, evaluated Sep 2026:
//
// - Every call the AI Assistant makes is bounded and mechanical (classify a
//   request, extract fields from a plain-text description, phrase an
//   already-computed number via tool use) rather than open-ended reasoning,
//   so a budget-tier model's accuracy is more than sufficient here.
// - On cost, it's the cheapest model of any of the majors (Anthropic,
//   OpenAI, Google, DeepSeek, Mistral, xAI, Alibaba) that still clears the
//   bar for reliable tool-use/structured-output on a bounded task: DeepSeek
//   publishes $0.22/$0.66 per million input/output tokens off-peak (peak
//   hours 01:00-04:00 and 06:00-10:00 UTC run 2x that), against $1/$5 for
//   the Claude Haiku 4.5 this replaced — roughly a 4-5x cut for this
//   workload. Cheaper still exist (Qwen/Gemini Flash-Lite variants), but
//   they don't clear the "trustworthy structured tool-calling for a real
//   ledger" bar as comfortably; DeepSeek V4 Flash officially supports
//   function_calling and structured_output and is the field's standard
//   budget pick for exactly this kind of task.
// - Practically: DeepSeek's Anthropic-compatible endpoint accepts the same
//   system/messages/tools shape this file already spoke, so the swap is a
//   base URL, an API key, and a model name — not a rewrite. Two fields
//   that mattered here changed meaning: `cache_control` is accepted but
//   silently ignored (DeepSeek caches repeated prefixes automatically —
//   cache-hit input is billed near-free — so it costs nothing to leave the
//   hint in place, it's just inert), and `anthropic-version`/`anthropic-beta`
//   headers are ignored, so they're dropped below rather than sent for show.
//
// Worth knowing if this ever needs revisiting: DeepSeek is a Chinese lab,
// so ledger data (sales, customers, suppliers, expense notes) sent to the
// assistant now transits DeepSeek's infrastructure rather than Anthropic's
// — a data-residency tradeoff for the owner to be comfortable with, not
// just a price one. Swapping back is symmetric: restore the Anthropic
// base_url/key and set AI_MODEL to a claude-haiku-* id.

const DEEPSEEK_API_URL = "https://api.deepseek.com/anthropic/v1/messages";

export const AI_MODEL = "deepseek-v4-flash";

export interface AnthropicTextBlock {
  type: "text";
  text: string;
  cache_control?: { type: "ephemeral" };
}

export interface AnthropicImageBlock {
  type: "image";
  source: { type: "base64"; media_type: string; data: string };
}

export type AnthropicContentBlock =
  | AnthropicTextBlock
  | AnthropicImageBlock
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string }
  // DeepSeek's Anthropic-compatible endpoint returns chain-of-thought as a
  // content[type=thinking] block when thinking mode is on. We always send
  // thinking: { type: "disabled" } below, so this shouldn't appear in
  // practice — kept in the union (and deliberately ignored by extractText/
  // extractToolUses, which only match "text"/"tool_use") purely so a block
  // of this shape can't silently widen into something it isn't.
  | { type: "thinking"; thinking: string };

export interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | AnthropicContentBlock[];
}

export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface AnthropicResponse {
  id: string;
  content: AnthropicContentBlock[];
  stop_reason: string;
  usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number };
}

export class AnthropicApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = "AnthropicApiError";
  }
}

// One call to /v1/messages. `system` is passed as a content-block array
// (not a plain string) so callers can keep marking the large, repeated
// part of it (product catalog, category list) with cache_control — a
// no-op on DeepSeek's endpoint today, but free to leave in place, and it
// keeps this function's shape unchanged if the backing model ever moves
// back to Anthropic's own API.
export async function callClaude(params: {
  system: AnthropicTextBlock[];
  messages: AnthropicMessage[];
  tools?: AnthropicTool[];
  maxTokens?: number;
}): Promise<AnthropicResponse> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new AnthropicApiError(
      "DEEPSEEK_API_KEY isn't set on the server. Add it to your deployment's environment variables to enable the AI Assistant."
    );
  }

  const res = await fetch(DEEPSEEK_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      model: AI_MODEL,
      max_tokens: params.maxTokens ?? 1024,
      system: params.system,
      messages: params.messages,
      // DeepSeek's Anthropic-compatible endpoint defaults V4 models to
      // thinking mode ON — undocumented in the shape of this request, but
      // confirmed by DeepSeek's own docs (chain-of-thought is returned as a
      // content[type=thinking] block, and `max_tokens` caps *that plus* the
      // final answer/tool_use as one shared budget). At maxTokens 400-800
      // for this assistant's short, bounded turns, the model was burning
      // the entire budget on hidden reasoning before it ever emitted the
      // tool_use call or reply text — response.content came back with no
      // "text" or "tool_use" block at all, which read to the rest of this
      // file as an empty turn and fell through to the "Done." fallback in
      // app/api/ai/chat/route.ts. No error, no proposal, nothing logged.
      // Every call this assistant makes is exactly the bounded/mechanical
      // kind DeepSeek's own guidance says V4's tool-calling works fine
      // without thinking for, so disable it outright rather than just
      // raising max_tokens and hoping the budget is enough. This field is
      // part of the standard Anthropic Messages request shape (not a
      // DeepSeek-only extension), so it stays correct if this ever swaps
      // back to Anthropic's own API per the note above AI_MODEL.
      thinking: { type: "disabled" },
      ...(params.tools ? { tools: params.tools } : {}),
    }),
  });

  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body?.error?.message ?? JSON.stringify(body);
    } catch {
      detail = await res.text().catch(() => "");
    }
    throw new AnthropicApiError(`AI Assistant API error (${res.status}): ${detail}`, res.status);
  }

  return (await res.json()) as AnthropicResponse;
}

// Convenience for the common case: pull every tool_use block out of a
// response (there can be more than one — the model may propose several
// entries and remember a note in the same turn).
export function extractToolUses(response: AnthropicResponse) {
  return response.content.filter(
    (b): b is Extract<AnthropicContentBlock, { type: "tool_use" }> => b.type === "tool_use"
  );
}

export function extractText(response: AnthropicResponse): string {
  return response.content
    .filter((b): b is AnthropicTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}
