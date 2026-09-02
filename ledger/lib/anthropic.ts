// Server-only. Never imported from a "use client" file — it reads
// process.env.ANTHROPIC_API_KEY, which must never reach the browser bundle.
//
// Deliberately a thin hand-rolled fetch wrapper rather than the
// @anthropic-ai/sdk package: the assistant only ever needs one endpoint
// (Messages, with tool use and an optional image block), and keeping this
// dependency-free means one less thing to keep updated in a solo-owner's
// app. If the tool surface grows meaningfully, switching to the official
// SDK is a contained change limited to this file.
//
// Model: Claude Haiku 4.5 (claude-haiku-4-5-20251001) — the right choice
// for this feature specifically. Every call the AI Assistant makes is
// bounded and mechanical (classify a request, extract fields from a
// receipt photo, phrase an already-computed number) rather than open-ended
// reasoning, so Haiku 4.5's accuracy is more than sufficient and its cost
// is roughly a fifth of Sonnet's per token — meaningful for a feature that
// may run on every "I sold something" prompt a solo owner types all day.

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

export const AI_MODEL = "claude-haiku-4-5-20251001";

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
  | { type: "tool_result"; tool_use_id: string; content: string };

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
// (not a plain string) so the largest, most-repeated part of it — the
// business context block callers build with cache_control set — is
// eligible for Anthropic's prompt caching: the product catalog, category
// list, and tool definitions are identical on every turn of a session, so
// after the first call in a session only the new user message and the
// small "recent memory" tail cost full input-token price.
export async function callClaude(params: {
  system: AnthropicTextBlock[];
  messages: AnthropicMessage[];
  tools?: AnthropicTool[];
  maxTokens?: number;
}): Promise<AnthropicResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new AnthropicApiError(
      "ANTHROPIC_API_KEY isn't set on the server. Add it to your deployment's environment variables to enable the AI Assistant."
    );
  }

  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: AI_MODEL,
      max_tokens: params.maxTokens ?? 1024,
      system: params.system,
      messages: params.messages,
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
    throw new AnthropicApiError(`Anthropic API error (${res.status}): ${detail}`, res.status);
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
