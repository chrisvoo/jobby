import Groq from 'groq-sdk'
import { readConfig } from './app-config'
import { LLM_MODELS } from './llm-models'

const TIMEOUT_MS = 300_000 // 5 minutes — resume enhancement is a heavy task

function getClient(): Groq {
  const { groq_api_key } = readConfig()
  if (!groq_api_key) {
    throw new Error('Groq API key not configured — set it in the Config page')
  }
  return new Groq({ apiKey: groq_api_key })
}

// ── Rate limit cache ────────────────────────────────────────────────────────
// Populated after every real LLM call via .withResponse(). Module-level
// (server process lifetime). Mirrored to localStorage on the client for
// cross-reload persistence. Do NOT use global.* here — this holds no OS
// resource; global.* is reserved for singletons that hold open file handles
// (e.g. DuckDB) where HMR would otherwise cause lock conflicts.

export interface RateLimitBucket {
  limit: number
  remaining: number
  resetIn: string  // raw value from header, e.g. "1m0s"
}

export interface RateLimits {
  tokens: RateLimitBucket
  requests: RateLimitBucket
  capturedAt: number  // unix ms
}

export let lastRateLimits: RateLimits | null = null

function parseRateLimits(headers: Headers): RateLimits | null {
  const limitTokens     = headers.get('x-ratelimit-limit-tokens')
  const remainingTokens = headers.get('x-ratelimit-remaining-tokens')
  const resetTokens     = headers.get('x-ratelimit-reset-tokens')
  const limitReqs       = headers.get('x-ratelimit-limit-requests')
  const remainingReqs   = headers.get('x-ratelimit-remaining-requests')
  const resetReqs       = headers.get('x-ratelimit-reset-requests')

  if (!limitTokens || !remainingTokens || !limitReqs || !remainingReqs) return null

  return {
    tokens: {
      limit:     parseInt(limitTokens, 10),
      remaining: parseInt(remainingTokens, 10),
      resetIn:   resetTokens ?? '',
    },
    requests: {
      limit:     parseInt(limitReqs, 10),
      remaining: parseInt(remainingReqs, 10),
      resetIn:   resetReqs ?? '',
    },
    capturedAt: Date.now(),
  }
}

/**
 * Sends a prompt to a Groq-hosted model and returns the text response.
 * The model is read from jobby.config.json on each call, so config changes apply immediately.
 */
export async function askLLM(prompt: string, model?: string): Promise<string> {
  const effectiveModel = model ?? readConfig().llm_model
  const { data: response, response: rawResponse } = await getClient().chat.completions
    .create(
      {
        model: effectiveModel,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      },
      { signal: AbortSignal.timeout(TIMEOUT_MS) },
    )
    .withResponse()

  const parsed = parseRateLimits(rawResponse.headers)
  if (parsed) lastRateLimits = parsed

  return response.choices[0]?.message?.content ?? ''
}

/**
 * Calls the LLM and parses the response as JSON.
 * Uses response_format json_object to enforce valid JSON output directly,
 * eliminating the need for fence-stripping / bracket-count salvage.
 */
export async function askLLMJSON<T>(prompt: string, model?: string): Promise<T> {
  const effectiveModel = model ?? readConfig().llm_model
  const { data: response, response: rawResponse } = await getClient().chat.completions
    .create(
      {
        model: effectiveModel,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      },
      { signal: AbortSignal.timeout(TIMEOUT_MS) },
    )
    .withResponse()

  const parsed = parseRateLimits(rawResponse.headers)
  if (parsed) lastRateLimits = parsed

  const raw = response.choices[0]?.message?.content ?? ''
  return JSON.parse(raw) as T
}

function detectTier(id: string): 'high' | 'balanced' | 'fast' {
  if (/70b|72b|405b|123b|120b/.test(id)) return 'high'
  if (/8b|7b|instant/.test(id)) return 'fast'
  return 'balanced'
}

const EXCLUDED_MODEL_PREFIXES = ['whisper', 'distil-whisper', 'playai']

/**
 * Verifies that `currentModel` exists in the live Groq model list.
 * If not, returns the first available model of the same tier as a fallback.
 * Silently returns the current model unchanged when the list cannot be fetched.
 */
export async function resolveValidModel(
  apiKey: string,
  currentModel: string,
): Promise<{ model: string; switchedFrom?: string }> {
  if (!apiKey) return { model: currentModel }
  try {
    const client = new Groq({ apiKey })
    const list = await client.models.list()
    const chatModels = list.data.filter(
      (m) => !EXCLUDED_MODEL_PREFIXES.some((p) => m.id.toLowerCase().startsWith(p)),
    )
    if (chatModels.some((m) => m.id === currentModel)) {
      return { model: currentModel }
    }
    // Use static list for tier — heuristics on model ID are unreliable for unknown models.
    // Default to 'balanced' when unknown: safest middle ground.
    const tier = LLM_MODELS.find((m) => m.id === currentModel)?.tier ?? 'balanced'
    const sameTier = chatModels.filter((m) => detectTier(m.id) === tier)
    const fallback = sameTier[0]?.id ?? chatModels.find((m) => detectTier(m.id) === 'balanced')?.id ?? chatModels[0]?.id ?? currentModel
    return { model: fallback, switchedFrom: currentModel }
  } catch {
    return { model: currentModel }
  }
}

/**
 * Makes a minimal 1-token call purely to retrieve fresh rate limit headers.
 * Used by /api/groq-limits?fresh=true. Costs approximately 1 output token.
 */
export async function fetchRateLimits(): Promise<RateLimits> {
  const { groq_api_key, llm_model } = readConfig()
  if (!groq_api_key) throw new Error('Groq API key not configured')

  const client = new Groq({ apiKey: groq_api_key })
  const { response: rawResponse } = await client.chat.completions
    .create(
      {
        model: llm_model ?? 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 1,
        temperature: 0,
      },
      { signal: AbortSignal.timeout(10_000) },
    )
    .withResponse()

  const parsed = parseRateLimits(rawResponse.headers)
  if (!parsed) throw new Error('Rate limit headers not present in Groq response')
  lastRateLimits = parsed
  return parsed
}
