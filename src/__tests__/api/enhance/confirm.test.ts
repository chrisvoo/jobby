/**
 * Tests for POST /api/enhance/confirm
 *
 * The confirm route generates the final PDF via React-PDF (minimal template).
 * All external I/O is mocked.
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
  readConfig: vi.fn(() => ({ duckdb_path: '', claude_model: '', target_currency: 'EUR' })),
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

const MINIMAL_BODY = {
  job_id: 'job-1',
  output_filename: 'John_Doe_Resume.pdf',
  template: 'minimal',
  resume: { name: 'John Doe', experience: [], education: [], skills: [] },
}

beforeEach(async () => {
  vi.clearAllMocks()
  const { default: fs } = await import('fs')
  vi.mocked(fs.existsSync).mockReturnValue(true)
  mockRun.mockResolvedValue(undefined)
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/enhance/confirm — input validation', () => {
  it('returns 400 when job_id is missing', async () => {
    const res = await POST(makeRequest({ template: 'minimal', resume: {} }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when resume is missing', async () => {
    const res = await POST(makeRequest({ job_id: 'job-1', template: 'minimal' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/resume/)
  })
})

describe('POST /api/enhance/confirm — minimal template', () => {
  it('returns 200, generates PDF, updates DB, and returns download_url', async () => {
    const res = await POST(makeRequest(MINIMAL_BODY))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.filename).toBe('John_Doe_Resume.pdf')
    expect(body.download_url).toMatch(/\/api\/jobs\/job-1\/resume/)

    expect(mockGenerateResumePDF).toHaveBeenCalledOnce()
    expect(mockRun).toHaveBeenCalledOnce()
    const [[sql]] = mockRun.mock.calls
    expect(sql).toMatch(/UPDATE jobs SET resume_path/)
  })

  it('uses DEFAULT_TEMPLATE_ID when template field is absent', async () => {
    const { template: _t, ...bodyWithoutTemplate } = MINIMAL_BODY
    const res = await POST(makeRequest(bodyWithoutTemplate))
    expect(res.status).toBe(200)
    expect(mockGenerateResumePDF).toHaveBeenCalledOnce()
  })
})
