import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock the SDK and fs before importing anything that loads them
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
}))

vi.mock('fs')
vi.mock('@/lib/app-config', () => ({
  readConfig: vi.fn(() => ({ claude_model: 'claude-sonnet-4-6', duckdb_path: '', target_currency: 'EUR' })),
}))

import { query } from '@anthropic-ai/claude-agent-sdk'
import { askClaude, askClaudeJSON } from '@/lib/claude'

type MockQuery = ReturnType<typeof vi.fn>

function mockQueryYielding(...messages: object[]) {
  ;(query as MockQuery).mockImplementation(async function* () {
    for (const msg of messages) yield msg
  })
}

beforeEach(() => {
  vi.resetAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ─── askClaude ────────────────────────────────────────────────────────────────

describe('askClaude', () => {
  it('collects text blocks from assistant messages', async () => {
    mockQueryYielding(
      {
        type: 'assistant',
        message: { content: [{ type: 'text', text: 'Hello ' }, { type: 'text', text: 'world' }] },
      },
      { type: 'result', subtype: 'success' },
    )

    const result = await askClaude('test prompt')
    expect(result).toBe('Hello world')
  })

  it('ignores non-text content blocks', async () => {
    mockQueryYielding(
      {
        type: 'assistant',
        message: { content: [{ type: 'tool_use', id: 'x' }, { type: 'text', text: 'ok' }] },
      },
      { type: 'result', subtype: 'success' },
    )

    const result = await askClaude('test prompt')
    expect(result).toBe('ok')
  })

  it('throws when result subtype is not success', async () => {
    mockQueryYielding({ type: 'result', subtype: 'error', errors: ['Rate limit'] })

    await expect(askClaude('test')).rejects.toThrow('error')
  })

  it('throws on auth_status error', async () => {
    mockQueryYielding({ type: 'auth_status', error: 'Token expired' })

    await expect(askClaude('test')).rejects.toThrow('Claude auth error')
  })
})

// ─── askClaudeJSON ────────────────────────────────────────────────────────────

describe('askClaudeJSON', () => {
  it('parses a raw JSON response', async () => {
    mockQueryYielding(
      { type: 'assistant', message: { content: [{ type: 'text', text: '{"foo":"bar"}' }] } },
      { type: 'result', subtype: 'success' },
    )

    const result = await askClaudeJSON<{ foo: string }>('test')
    expect(result).toEqual({ foo: 'bar' })
  })

  it('strips ```json fences before parsing', async () => {
    const wrapped = '```json\n{"value":42}\n```'
    mockQueryYielding(
      { type: 'assistant', message: { content: [{ type: 'text', text: wrapped }] } },
      { type: 'result', subtype: 'success' },
    )

    const result = await askClaudeJSON<{ value: number }>('test')
    expect(result).toEqual({ value: 42 })
  })

  it('strips plain ``` fences before parsing', async () => {
    const wrapped = '```\n{"ok":true}\n```'
    mockQueryYielding(
      { type: 'assistant', message: { content: [{ type: 'text', text: wrapped }] } },
      { type: 'result', subtype: 'success' },
    )

    const result = await askClaudeJSON<{ ok: boolean }>('test')
    expect(result).toEqual({ ok: true })
  })

  it('uses bracket-count fallback when output mixes prose + JSON', async () => {
    // Claude sometimes emits "Here is the JSON:\n{...}"
    const mixed = 'Here is the result:\n{"data":[1,2,3]}'
    mockQueryYielding(
      { type: 'assistant', message: { content: [{ type: 'text', text: mixed }] } },
      { type: 'result', subtype: 'success' },
    )

    const result = await askClaudeJSON<{ data: number[] }>('test')
    expect(result).toEqual({ data: [1, 2, 3] })
  })

  it('uses bracket-count fallback for a top-level JSON array', async () => {
    const text = 'Prefix text\n[1,2,3]'
    mockQueryYielding(
      { type: 'assistant', message: { content: [{ type: 'text', text: text }] } },
      { type: 'result', subtype: 'success' },
    )

    const result = await askClaudeJSON<number[]>('test')
    expect(result).toEqual([1, 2, 3])
  })

  it('throws when response is not parseable JSON', async () => {
    mockQueryYielding(
      { type: 'assistant', message: { content: [{ type: 'text', text: 'Sorry, I cannot do that.' }] } },
      { type: 'result', subtype: 'success' },
    )

    await expect(askClaudeJSON('test')).rejects.toThrow('Claude returned non-JSON')
  })
})
