import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readConfig } from '@/lib/app-config'

// Shared create mock — reconfigured per test
const createMock = vi.fn()

vi.mock('groq-sdk', () => {
  function GroqMock() {
    return { chat: { completions: { create: createMock } } }
  }
  return { default: GroqMock }
})

vi.mock('@/lib/app-config', () => ({
  readConfig: vi.fn(() => ({
    llm_model: 'llama-3.3-70b-versatile',
    duckdb_path: '',
    target_currency: 'EUR',
    groq_api_key: 'gsk_test_key',
  })),
}))

import { askLLM, askLLMJSON } from '@/lib/llm'

const defaultConfig = {
  llm_model: 'llama-3.3-70b-versatile',
  duckdb_path: '',
  target_currency: 'EUR',
  groq_api_key: 'gsk_test_key',
}

function mockResponse(content: string) {
  createMock.mockResolvedValue({ choices: [{ message: { content } }] })
}

beforeEach(() => {
  createMock.mockReset()
  vi.mocked(readConfig).mockReturnValue(defaultConfig)
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ─── askLLM ───────────────────────────────────────────────────────────────────

describe('askLLM', () => {
  it('returns the text content from the response', async () => {
    mockResponse('Hello world')
    const result = await askLLM('test prompt')
    expect(result).toBe('Hello world')
  })

  it('returns empty string when choices are empty', async () => {
    createMock.mockResolvedValue({ choices: [] })
    const result = await askLLM('test prompt')
    expect(result).toBe('')
  })

  it('throws when Groq API key is not configured', async () => {
    vi.mocked(readConfig).mockReturnValue({ ...defaultConfig, groq_api_key: '' })
    await expect(askLLM('test')).rejects.toThrow('Groq API key not configured')
  })

  it('throws when the API call fails', async () => {
    createMock.mockRejectedValue(new Error('Network error'))
    await expect(askLLM('test')).rejects.toThrow('Network error')
  })
})

// ─── askLLMJSON ───────────────────────────────────────────────────────────────

describe('askLLMJSON', () => {
  it('parses a JSON response', async () => {
    mockResponse('{"foo":"bar"}')
    const result = await askLLMJSON<{ foo: string }>('test')
    expect(result).toEqual({ foo: 'bar' })
  })

  it('parses a JSON array response', async () => {
    mockResponse('[1,2,3]')
    const result = await askLLMJSON<number[]>('test')
    expect(result).toEqual([1, 2, 3])
  })

  it('throws when response is not valid JSON', async () => {
    mockResponse('Sorry, I cannot do that.')
    await expect(askLLMJSON('test')).rejects.toThrow(SyntaxError)
  })

  it('uses response_format json_object in the request', async () => {
    mockResponse('{"ok":true}')
    await askLLMJSON('test')
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ response_format: { type: 'json_object' } }),
      expect.anything(),
    )
  })
})
