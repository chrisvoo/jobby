/**
 * Tests for POST /api/enhance/prepare
 *
 * The prepare route accepts resume_id + job_description, looks up the resume
 * directly, extracts PDF text, calls the LLM, then returns a preview payload.
 * All external I/O is mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockRunAndReadAll = vi.fn()
vi.mock('@/lib/db', () => ({
  getDb: vi.fn(() => Promise.resolve({ runAndReadAll: mockRunAndReadAll })),
}))

vi.mock('@/lib/app-config', () => ({
  resolveDataPath: (p: string) => p,
  readConfig: vi.fn(() => ({ duckdb_path: '', llm_model: '', target_currency: 'EUR', groq_api_key: '' })),
}))

vi.mock('fs', () => ({
  default: { existsSync: vi.fn(() => true) },
}))

const mockExtractPdfText = vi.fn(() => Promise.resolve('Extracted resume text content'))
vi.mock('@/lib/pdf-extractor', () => ({
  extractPdfText: (...args: unknown[]) => mockExtractPdfText(...args),
}))

const mockAskLLMJSON = vi.fn()
vi.mock('@/lib/llm', () => ({
  askLLMJSON: (...args: unknown[]) => mockAskLLMJSON(...args),
}))

import { POST } from '@/app/api/enhance/prepare/route'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const RESUME_ROW = { file_path: '/tmp/data/uploads/resumes/res-1.pdf' }

const MINIMAL_LLM_RESPONSE = {
  output_filename: 'John_Doe_Engineer_Resume.pdf',
  warnings: [],
  changes: [{ original_text: 'old', replacement_text: 'new', reason: 'better' }],
  resume: { name: 'John Doe', experience: [], education: [], skills: [] },
}

function makeRequest(body: object): NextRequest {
  return new NextRequest('http://localhost/api/enhance/prepare', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(async () => {
  vi.clearAllMocks()
  const { default: fs } = await import('fs')
  vi.mocked(fs.existsSync).mockReturnValue(true)
  mockRunAndReadAll.mockResolvedValue({ getRowObjects: () => [RESUME_ROW] })
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/enhance/prepare — input validation', () => {
  it('returns 400 when resume_id is missing', async () => {
    const res = await POST(makeRequest({ job_description: 'a job desc' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/resume_id/)
  })

  it('returns 400 when job_description is missing', async () => {
    const res = await POST(makeRequest({ resume_id: 'res-1' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/job_description/)
  })
})

describe('POST /api/enhance/prepare — minimal template', () => {
  it('returns 200 with changes and resume data', async () => {
    mockAskLLMJSON.mockResolvedValue(MINIMAL_LLM_RESPONSE)

    const res = await POST(makeRequest({ resume_id: 'res-1', job_description: 'Build things' }))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.template).toBe('minimal')
    expect(body.output_filename).toBe('John_Doe_Engineer_Resume.pdf')
    expect(body.changes).toHaveLength(1)
    expect(body.resume.name).toBe('John Doe')
  })

  it('always includes changes array even if LLM omits it', async () => {
    mockAskLLMJSON.mockResolvedValue({
      ...MINIMAL_LLM_RESPONSE,
      changes: undefined,
    })

    const res = await POST(makeRequest({ resume_id: 'res-1', job_description: 'desc' }))
    const body = await res.json()
    expect(body.changes).toEqual([])
  })
})

describe('POST /api/enhance/prepare — error cases', () => {
  it('returns 404 when resume is not found', async () => {
    mockRunAndReadAll.mockResolvedValue({ getRowObjects: () => [] })

    const res = await POST(makeRequest({ resume_id: 'missing', job_description: 'desc' }))
    expect(res.status).toBe(404)
  })

  it('returns 404 when the PDF file is missing on disk', async () => {
    const { default: fs } = await import('fs')
    vi.mocked(fs.existsSync).mockReturnValue(false)

    const res = await POST(makeRequest({ resume_id: 'res-1', job_description: 'desc' }))
    expect(res.status).toBe(404)
  })

  it('returns 500 when LLM throws', async () => {
    mockAskLLMJSON.mockRejectedValue(new Error('LLM timeout'))

    const res = await POST(makeRequest({ resume_id: 'res-1', job_description: 'desc' }))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toMatch(/LLM timeout/)
  })
})
