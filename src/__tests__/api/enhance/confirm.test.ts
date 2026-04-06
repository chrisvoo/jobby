/**
 * Tests for POST /api/enhance/confirm
 *
 * The confirm route generates the final PDF — either via React-PDF (minimal) or
 * by forwarding replacements to the Python sidecar (pixel-perfect).
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
  isValidTemplateId: (id: string) => ['minimal', 'pixel-perfect'].includes(id),
  DEFAULT_TEMPLATE_ID: 'minimal',
}))

// Minimal fetch mock — tests replace this per-test
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

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

const PIXEL_PERFECT_BODY = {
  job_id: 'job-1',
  output_filename: 'John_Doe_Resume.pdf',
  template: 'pixel-perfect',
  resume_path: '/tmp/data/uploads/resumes/res-1.pdf',
  replacements: [{ old: 'old text', new: 'improved text' }],
}

beforeEach(async () => {
  vi.clearAllMocks()
  // existsSync defaults to true; individual tests override when testing missing-file paths
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

  it('returns 400 for minimal template when resume is missing', async () => {
    const res = await POST(makeRequest({ job_id: 'job-1', template: 'minimal' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/resume/)
  })

  it('returns 400 for pixel-perfect when replacements array is empty', async () => {
    const res = await POST(
      makeRequest({
        job_id: 'job-1',
        template: 'pixel-perfect',
        resume_path: '/tmp/data/res.pdf',
        replacements: [],
      }),
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/replacements/)
  })

  it('returns 404 for pixel-perfect when the input PDF is missing', async () => {
    const { default: fs } = await import('fs')
    vi.mocked(fs.existsSync).mockReturnValue(false)

    const res = await POST(makeRequest(PIXEL_PERFECT_BODY))
    expect(res.status).toBe(404)
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

describe('POST /api/enhance/confirm — pixel-perfect template', () => {
  it('forwards replacements to the sidecar and returns 200', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ replaced: 1, warnings: [] }),
    })

    const res = await POST(makeRequest(PIXEL_PERFECT_BODY))
    expect(res.status).toBe(200)

    expect(mockFetch).toHaveBeenCalledOnce()
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toMatch(/\/replace$/)
    const payload = JSON.parse(init.body as string)
    expect(payload.replacements).toHaveLength(1)
    expect(payload.replacements[0].old).toBe('old text')
  })

  it('skips blank new-text replacements before sending to sidecar', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ replaced: 0, warnings: [] }),
    })

    const body = {
      ...PIXEL_PERFECT_BODY,
      replacements: [
        { old: 'remove me', new: '' },
        { old: 'keep me', new: 'improved' },
      ],
    }

    await POST(makeRequest(body))
    const [, init] = mockFetch.mock.calls[0]
    const payload = JSON.parse(init.body as string)
    expect(payload.replacements).toHaveLength(1)
    expect(payload.replacements[0].old).toBe('keep me')
  })

  it('returns 502 when the sidecar reports an error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Text not found' }),
    })

    const res = await POST(makeRequest(PIXEL_PERFECT_BODY))
    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body.error).toMatch(/Text not found/)
  })
})
