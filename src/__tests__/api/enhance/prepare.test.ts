/**
 * Tests for POST /api/enhance/prepare
 *
 * The prepare route queries the DB for a job + resume, extracts PDF text, calls
 * Claude, then returns a minimal preview payload.
 * All external I/O is mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockRun = vi.fn()
const mockRunAndReadAll = vi.fn()
vi.mock('@/lib/db', () => ({
  getDb: vi.fn(() => Promise.resolve({ run: mockRun, runAndReadAll: mockRunAndReadAll })),
}))

vi.mock('@/lib/app-config', () => ({
  resolveDataPath: (p: string) => p,
  readConfig: vi.fn(() => ({ duckdb_path: '', claude_model: '', target_currency: 'EUR' })),
}))

vi.mock('fs', () => ({
  default: { existsSync: vi.fn(() => true) },
}))

const mockExtractPdfText = vi.fn(() => Promise.resolve('Extracted resume text content'))
vi.mock('@/lib/pdf-extractor', () => ({
  extractPdfText: (...args: unknown[]) => mockExtractPdfText(...args),
}))

const mockAskClaudeJSON = vi.fn()
vi.mock('@/lib/claude', () => ({
  askClaudeJSON: (...args: unknown[]) => mockAskClaudeJSON(...args),
}))

import { POST } from '@/app/api/enhance/prepare/route'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const JOB_ROW = { id: 'job-1', base_resume_id: 'res-1' }
const RESUME_ROW = { file_path: '/tmp/data/uploads/resumes/res-1.pdf' }

const MINIMAL_CLAUDE_RESPONSE = {
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
  mockRunAndReadAll
    .mockResolvedValueOnce({ getRowObjects: () => [JOB_ROW] })
    .mockResolvedValueOnce({ getRowObjects: () => [RESUME_ROW] })
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/enhance/prepare — input validation', () => {
  it('returns 400 when job_id is missing', async () => {
    const res = await POST(makeRequest({ job_description: 'a job desc' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/job_id/)
  })

  it('returns 400 when job_description is missing', async () => {
    const res = await POST(makeRequest({ job_id: 'job-1' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/job_description/)
  })
})

describe('POST /api/enhance/prepare — minimal template', () => {
  it('returns 200 with changes and resume data', async () => {
    mockAskClaudeJSON.mockResolvedValue(MINIMAL_CLAUDE_RESPONSE)

    const res = await POST(makeRequest({ job_id: 'job-1', job_description: 'Build things' }))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.template).toBe('minimal')
    expect(body.output_filename).toBe('John_Doe_Engineer_Resume.pdf')
    expect(body.changes).toHaveLength(1)
    expect(body.resume.name).toBe('John Doe')
  })

  it('always includes changes array even if Claude omits it', async () => {
    mockAskClaudeJSON.mockResolvedValue({
      ...MINIMAL_CLAUDE_RESPONSE,
      changes: undefined,
    })

    const res = await POST(makeRequest({ job_id: 'job-1', job_description: 'desc' }))
    const body = await res.json()
    expect(body.changes).toEqual([])
  })
})

describe('POST /api/enhance/prepare — error cases', () => {
  it('returns 404 when job is not found', async () => {
    mockRunAndReadAll.mockReset()
    mockRunAndReadAll.mockResolvedValue({ getRowObjects: () => [] })

    const res = await POST(makeRequest({ job_id: 'missing', job_description: 'desc' }))
    expect(res.status).toBe(404)
  })

  it('returns 400 when job has no base resume linked', async () => {
    mockRunAndReadAll.mockReset()
    mockRunAndReadAll.mockResolvedValue({
      getRowObjects: () => [{ id: 'job-1', base_resume_id: null }],
    })

    const res = await POST(makeRequest({ job_id: 'job-1', job_description: 'desc' }))
    expect(res.status).toBe(400)
  })

  it('returns 404 when the PDF file is missing on disk', async () => {
    const { default: fs } = await import('fs')
    vi.mocked(fs.existsSync).mockReturnValue(false)

    const res = await POST(makeRequest({ job_id: 'job-1', job_description: 'desc' }))
    expect(res.status).toBe(404)
  })

  it('returns 500 when Claude throws', async () => {
    mockAskClaudeJSON.mockRejectedValue(new Error('Claude timeout'))

    const res = await POST(makeRequest({ job_id: 'job-1', job_description: 'desc' }))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toMatch(/Claude timeout/)
  })
})
