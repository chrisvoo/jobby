import { query, type SDKAssistantMessage } from '@anthropic-ai/claude-agent-sdk'

const DEFAULT_MODEL = 'claude-sonnet-4-5'
const TIMEOUT_MS = 120_000

/**
 * Sends a prompt to Claude via the claude-agent-sdk and returns the text response.
 * Uses the same auth as the `claude` CLI (OAuth session from ~/.claude.json) — no API key needed.
 */
export async function askClaude(prompt: string, model?: string): Promise<string> {
  const collected: string[] = []

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Claude timed out after 2 minutes')), TIMEOUT_MS),
  )

  const queryPromise = (async () => {
    for await (const message of query({
        prompt,
        options: {
          allowedTools: [],
          model: model ?? DEFAULT_MODEL,
          settingSources: ['user'],
        },
      })) {
        if (message.type === 'auth_status' && (message as { error?: string }).error) {
          throw new Error(`Claude auth error: ${(message as { error: string }).error}`)
        }
        if (message.type === 'assistant') {
          const msg = message as SDKAssistantMessage
          if (msg.message?.content) {
            for (const block of msg.message.content) {
              if (block.type === 'text') {
                collected.push((block as { type: 'text'; text: string }).text)
              }
            }
          }
        }
        if (message.type === 'result') {
          const result = message as { subtype?: string; errors?: string[] }
          if (result.subtype !== 'success') {
            throw new Error(`Claude error (${result.subtype ?? 'unknown'}): ${result.errors?.join('; ') ?? ''}`)
          }
        }
      }
      return collected.join('')
  })()

  return Promise.race([queryPromise, timeoutPromise])
}

/**
 * Calls Claude and parses the response as JSON.
 * Strips markdown code fences if Claude wraps the output.
 */
export async function askClaudeJSON<T>(prompt: string, model?: string): Promise<T> {
  const raw = await askClaude(prompt, model)
  const clean = raw
    .replace(/^```(?:json)?\s*/m, '')
    .replace(/\s*```\s*$/m, '')
    .trim()
  try {
    return JSON.parse(clean) as T
  } catch {
    throw new Error(`Claude returned non-JSON output:\n${raw.slice(0, 500)}`)
  }
}
