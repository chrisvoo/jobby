import { query, type SDKAssistantMessage } from '@anthropic-ai/claude-agent-sdk'
import { readConfig } from './app-config'

const TIMEOUT_MS = 120_000

/**
 * Sends a prompt to Claude via the claude-agent-sdk and returns the text response.
 * Uses the same auth as the `claude` CLI (OAuth session from ~/.claude.json) — no API key needed.
 * The model is read from jobby.config.json on each call, so config changes apply immediately.
 */
export async function askClaude(prompt: string, model?: string): Promise<string> {
  const collected: string[] = []
  const effectiveModel = model ?? readConfig().claude_model

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Claude timed out after 2 minutes')), TIMEOUT_MS),
  )

  const queryPromise = (async () => {
    for await (const message of query({
        prompt,
        options: {
          allowedTools: [],
          model: effectiveModel,
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
 * Falls back to extracting the first complete JSON object when Claude mixes
 * a fenced block with a trailing raw JSON value.
 */
export async function askClaudeJSON<T>(prompt: string, model?: string): Promise<T> {
  const raw = await askClaude(prompt, model)
  const clean = raw
    .replace(/^```(?:json)?\s*/m, '')
    // Remove closing fence plus any non-newline content that may follow on the same line
    // (handles "```{...}" when Claude emits both a fenced block and a raw JSON)
    .replace(/\s*```.*$/m, '')
    .trim()
  try {
    return JSON.parse(clean) as T
  } catch {
    // Fallback: bracket-count to find the first complete JSON object or array
    const start = raw.search(/[{[]/)
    if (start !== -1) {
      const opener = raw[start]
      const closer = opener === '{' ? '}' : ']'
      let depth = 0, inStr = false, esc = false
      for (let i = start; i < raw.length; i++) {
        const c = raw[i]
        if (esc)              { esc = false; continue }
        if (c === '\\' && inStr) { esc = true;  continue }
        if (c === '"')        { inStr = !inStr; continue }
        if (inStr)            continue
        if (c === opener)     depth++
        if (c === closer && --depth === 0) {
          try { return JSON.parse(raw.slice(start, i + 1)) as T } catch {}
          break
        }
      }
    }
    throw new Error(`Claude returned non-JSON output:\n${raw.slice(0, 500)}`)
  }
}
