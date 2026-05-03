/**
 * Tests for POST /api/enhance/confirm
 *
 * The confirm route generates the final PDF via React-PDF (minimal template).
 * job_id is optional — when provided the job record is updated; when absent
 * the PDF is saved under a generated filename. All external I/O is mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockRun = vi.fn()
vi.mock('@/lib/db', () => ({
  getDb: vi.fn(() => Promise.resolve({ run: mockRun })),
}))

vi.mock('@/lib/app-config', () => ({
  getDataDir: vi.fn(() => '/tmp/data'),
  resolveDataPath: (p: string) => p,
  readConfig: vi.fn(() => ({ duckdb_path: '', llm_model: '', target_currency: 'EUR', groq_api_key: '' })),
}))

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
  },
}))

const mockGenerateResumePDF = vi.fn(() => Promise.resolve(Buffer.from('%PDF-1.4 test')))
vi.mock('@/lib/pdf-generator', () => ({
  generateResumePDF: (...args: unknown[]) => mockGenerateResumePDF(...args),
}))

vi.mock('@/lib/resume-templates', () => ({
  isValidTemplateId: (id: string) => id === 'minimal',
  DEFAULT_TEMPLATE_ID: 'minimal',
}))

import { POST } from '@/app/api/enhance/confirm/route'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body: object): NextRequest {
  return new NextRequest('http://localhost/api/enhance/confirm', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const RESUME_PAYLOAD = { name: 'John Doe', experience: [], education: [], skills: [] }

const BODY_WITH_JOB = {
  job_id: 'job-1',
  output_filename: 'John_Doe_Resume.pdf',
  template: 'minimal',
  resume: RESUME_PAYLOAD,
}

const BODY_WITHOUT_JOB = {
  output_filename: 'John_Doe_Resume.pdf',
  template: 'minimal',
  resume: RESUME_PAYLOAD,
}

beforeEach(async () => {
  vi.clearAllMocks()
  const { default: fs } = await import('fs')
  vi.mocked(fs.existsSync).mockReturnValue(true)
  mockRun.mockResolvedValue(undefined)
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/enhance/confirm — input validation', () => {
  it('returns 400 when resume is missing', async () => {
    const res = await POST(makeRequest({ template: 'minimal' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/resume/)
  })
})

describe('POST /api/enhance/confirm — with job_id', () => {
  it('returns 200, generates PDF, updates DB, and returns download_url', async () => {
    const res = await POST(makeRequest(BODY_WITH_JOB))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.filename).toBe('John_Doe_Resume.pdf')
    expect(body.download_url).toMatch(/\/api\/enhance\/download\//)

    expect(mockGenerateResumePDF).toHaveBeenCalledOnce()
    expect(mockRun).toHaveBeenCalledOnce()
    const [[sql]] = mockRun.mock.calls
    expect(sql).toMatch(/UPDATE jobs SET resume_path/)
  })
})

describe('POST /api/enhance/confirm — without job_id', () => {
  it('returns 200, generates PDF, skips DB update', async () => {
    const res = await POST(makeRequest(BODY_WITHOUT_JOB))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.filename).toBe('John_Doe_Resume.pdf')
    expect(body.download_url).toMatch(/\/api\/enhance\/download\//)

    expect(mockGenerateResumePDF).toHaveBeenCalledOnce()
    expect(mockRun).not.toHaveBeenCalled()
  })

  it('generates a fallback filename when output_filename is absent', async () => {
    const { output_filename: _, ...bodyWithoutFilename } = BODY_WITHOUT_JOB
    const res = await POST(makeRequest(bodyWithoutFilename))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.filename).toMatch(/resume_/)
    expect(body.download_url).toMatch(/\/api\/enhance\/download\//)
  })
})

describe('POST /api/enhance/confirm — template handling', () => {
  it('uses DEFAULT_TEMPLATE_ID when template field is absent', async () => {
    const { template: _, ...bodyWithoutTemplate } = BODY_WITHOUT_JOB
    const res = await POST(makeRequest(bodyWithoutTemplate))
    expect(res.status).toBe(200)
    expect(mockGenerateResumePDF).toHaveBeenCalledOnce()
  })
})
