/**
 * LlmProvider — the single configured LLM provider abstraction for the
 * canonical RespondLeadz pipeline.
 *
 * The Canonical_Implementation uses a single configured LLM provider for intent
 * extraction and response generation (Requirement 11.4). To guarantee that a
 * tenant cannot silently mix providers, the concrete provider is selected by
 * configuration through {@link createLlmProvider}; the only supported provider
 * is Anthropic Claude Haiku.
 *
 * This module intentionally exposes a small, stage-aware `complete` surface so
 * the AI_Responder can drive both intent extraction (≤ 50 tokens) and response
 * generation (≤ 300 tokens) through one interface, capping the requested tokens
 * per call (Requirement 14.2) and surfacing failures as a typed {@link LlmError}
 * so the responder can fall back gracefully (Requirements 8.1–8.3).
 *
 * Feature: respond-leadz
 * Requirements: 11.4
 */

import { Config } from '../config'
import { ConfigError, LlmError } from './errors'

/** The pipeline stage a completion request belongs to. */
export type LlmStage = 'extract' | 'generate'

/** A single text-completion request issued to the configured LLM provider. */
export interface LlmCompletionRequest {
  /** The fully-rendered prompt to send to the model. */
  prompt: string
  /**
   * The maximum number of tokens the model may produce for this call. Callers
   * enforce the per-stage caps (Requirement 14.2): 50 for `extract`, 300 for
   * `generate`.
   */
  maxTokens: number
  /** The pipeline stage this request belongs to; used for error reporting. */
  stage: LlmStage
}

/**
 * The provider-agnostic interface the AI_Responder depends on. A single
 * implementation is wired into production at a time (Requirement 11.4).
 */
export interface LlmProvider {
  /** Stable provider identifier (e.g. the canonical provider name). */
  readonly name: string
  /**
   * Produce a text completion for the given request. Implementations MUST
   * request at most `request.maxTokens` tokens and MUST throw an
   * {@link LlmError} (carrying `request.stage`) on any failure so callers can
   * produce a Fallback_Response.
   */
  complete(request: LlmCompletionRequest): Promise<string>
}

/** The canonical LLM provider name; the only provider wired into production. */
export const CANONICAL_LLM_PROVIDER = 'claude-haiku' as const

/** The set of provider names this build supports. */
export type LlmProviderName = typeof CANONICAL_LLM_PROVIDER

/** Optional overrides for {@link ClaudeHaikuProvider}, primarily for tests. */
export interface ClaudeHaikuProviderOptions {
  apiKey?: string
  model?: string
  apiUrl?: string
}

/** Anthropic Messages API version pinned for the canonical provider. */
const ANTHROPIC_VERSION = '2023-06-01'

/**
 * The canonical Claude Haiku provider. Calls the Anthropic Messages API with
 * the configured model and a per-call token cap, returning the model's text.
 *
 * Any transport, HTTP, or shape failure is surfaced as an {@link LlmError} that
 * carries the originating stage, allowing the AI_Responder to fall back without
 * inspecting provider internals (Requirements 8.1–8.3).
 */
export class ClaudeHaikuProvider implements LlmProvider {
  readonly name = CANONICAL_LLM_PROVIDER

  private readonly apiKey: string | undefined
  private readonly model: string
  private readonly apiUrl: string

  constructor(options: ClaudeHaikuProviderOptions = {}) {
    const ai = Config.ai
    this.apiKey = options.apiKey ?? ai.anthropicApiKey
    this.model = options.model ?? ai.model
    this.apiUrl = options.apiUrl ?? ai.anthropicUrl
  }

  /** Whether the provider has an API key configured and can issue requests. */
  isConfigured(): boolean {
    return typeof this.apiKey === 'string' && this.apiKey.trim().length > 0
  }

  async complete(request: LlmCompletionRequest): Promise<string> {
    if (!this.isConfigured()) {
      // No key: the provider cannot serve this request. Signal failure for the
      // stage so the caller produces a Fallback_Response (Requirement 8.1).
      throw new LlmError(request.stage, 'LLM provider is not configured (missing API key)')
    }

    let response: Response
    try {
      response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey as string,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: request.maxTokens,
          messages: [{ role: 'user', content: request.prompt }],
        }),
      })
    } catch (cause) {
      throw new LlmError(request.stage, `LLM ${request.stage} request failed`, { cause })
    }

    if (!response.ok) {
      throw new LlmError(
        request.stage,
        `LLM ${request.stage} request failed with status ${response.status}`
      )
    }

    let data: unknown
    try {
      data = await response.json()
    } catch (cause) {
      throw new LlmError(request.stage, `LLM ${request.stage} response was not valid JSON`, {
        cause,
      })
    }

    const text = extractText(data)
    if (text === null) {
      throw new LlmError(request.stage, `LLM ${request.stage} response contained no text`)
    }
    return text
  }
}

/** Extract the first text block from an Anthropic Messages API response. */
function extractText(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) return null
  const content = (data as { content?: unknown }).content
  if (!Array.isArray(content) || content.length === 0) return null
  const first = content[0]
  if (typeof first !== 'object' || first === null) return null
  const text = (first as { text?: unknown }).text
  return typeof text === 'string' ? text.trim() : null
}

/**
 * Select the configured LLM provider. Only the canonical provider is supported;
 * any other configured name is rejected with a named {@link ConfigError} so a
 * tenant cannot silently run a non-canonical provider (Requirement 11.4).
 *
 * @param providerName The configured provider name; defaults to the canonical provider.
 * @param options Optional provider overrides (primarily for tests).
 */
export function createLlmProvider(
  providerName: string = CANONICAL_LLM_PROVIDER,
  options: ClaudeHaikuProviderOptions = {}
): LlmProvider {
  if (providerName !== CANONICAL_LLM_PROVIDER) {
    throw new ConfigError(
      'llm_provider',
      `Unsupported LLM provider "${providerName}"; the only supported provider is "${CANONICAL_LLM_PROVIDER}"`
    )
  }
  return new ClaudeHaikuProvider(options)
}
