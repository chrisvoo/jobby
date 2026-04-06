/**
 * Tests for /api/jobs/[id] route (GET, PATCH, DELETE).
 *
 * All external dependencies (DuckDB, fs, app-config) are mocked so the tests
 * run fast without a real database or file system.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockRun = vi.fn()
const mockRunAndReadAll = vi.fn()
const mockGetDb = vi.fn(() => Promise.resolve({ run: mockRun, runAndReadAll: mockRunAndReadAll }))

vi.mock('@/lib/db', () => ({
  getDb: (...args: unknown[]) => mockGetDb(...args),
  toISO: (v: unknown) => (v instanceof Date ? v.toISOString() : String(v ?? new Date().toISOString())),
  parseSalary: (v: unknown) =>
    Array.isArray(v) && v.length === 2 ? [Number(v[0]), Number(v[1])] : null,
}))

vi.mock('@/lib/app-config', () => ({
  resolveDataPath: (p: string) => p,
  readConfig: vi.fn(() => ({ duckdb_path: '', claude_model: '', target_currency: 'EUR' })),
  getDataDir: vi.fn(() => '/tmp/data'),
}))

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(() => true),
    unlinkSync: vi.fn(),
  },
}))

import { GET, PATCH, DELETE } from '@/app/api/jobs/[id]/route'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(method: string, body?: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/jobs/job-123`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

const PARAMS = { params: Promise.resolve({ id: 'job-123' }) }

const DB_ROW = {
  id: 'job-123',
  company: 'Acme',
  role: 'Engineer',
  url: 'https://acme.com/jobs/1',
  status: 'applied',
  applied_at: '2024-06-01T00:00:00.000Z',
  notes: null,
  description: 'Build things',
  gross_annual_salary: [80000, 100000],
  base_resume_id: 'resume-abc',
  resume_path: null,
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ── GET ───────────────────────────────────────────────────────────────────────

describe('GET /api/jobs/[id]', () => {
  it('returns 200 with the job when found', async () => {
    mockRunAndReadAll.mockResolvedValue({ getRowObjects: () => [DB_ROW] })

    const res = await GET(makeRequest('GET'), PARAMS)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.id).toBe('job-123')
    expect(body.company).toBe('Acme')
    expect(body.role).toBe('Engineer')
    expect(body.gross_annual_salary).toEqual([80000, 100000])
  })

  it('returns 404 when job does not exist', async () => {
    mockRunAndReadAll.mockResolvedValue({ getRowObjects: () => [] })

    const res = await GET(makeRequest('GET'), PARAMS)
    expect(res.status).toBe(404)
  })

  it('returns 500 when the DB throws', async () => {
    mockGetDb.mockRejectedValueOnce(new Error('DB down'))

    const res = await GET(makeRequest('GET'), PARAMS)
    expect(res.status).toBe(500)
  })
})

// ── PATCH ─────────────────────────────────────────────────────────────────────

describe('PATCH /api/jobs/[id]', () => {
  it('returns 200 with the updated job', async () => {
    mockRun.mockResolvedValue(undefined)
    mockRunAndReadAll.mockResolvedValue({ getRowObjects: () => [{ ...DB_ROW, status: 'interview' }] })

    const res = await PATCH(makeRequest('PATCH', { status: 'interview' }), PARAMS)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.status).toBe('interview')
  })

  it('returns 400 when no updatable fields are provided', async () => {
    const res = await PATCH(makeRequest('PATCH', {}), PARAMS)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/No fields/)
  })

  it('escapes single quotes in string fields', async () => {
    mockRun.mockResolvedValue(undefined)
    mockRunAndReadAll.mockResolvedValue({ getRowObjects: () => [DB_ROW] })

    await PATCH(makeRequest('PATCH', { company: "O'Brien Corp" }), PARAMS)

    const [[sql]] = mockRun.mock.calls
    expect(sql).toContain("O''Brien Corp")
  })

  it('returns 500 on DB error', async () => {
    mockGetDb.mockRejectedValueOnce(new Error('timeout'))
    const res = await PATCH(makeRequest('PATCH', { role: 'PM' }), PARAMS)
    expect(res.status).toBe(500)
  })
})

// ── DELETE ────────────────────────────────────────────────────────────────────

describe('DELETE /api/jobs/[id]', () => {
  it('returns 204 on success', async () => {
    mockRunAndReadAll.mockResolvedValue({ getRowObjects: () => [{ resume_path: null }] })
    mockRun.mockResolvedValue(undefined)

    const res = await DELETE(makeRequest('DELETE'), PARAMS)
    expect(res.status).toBe(204)
  })

  it('attempts to unlink the resume_path if present', async () => {
    const { default: fs } = await import('fs')
    mockRunAndReadAll.mockResolvedValue({
      getRowObjects: () => [{ resume_path: '/tmp/data/adapted/job-123.pdf' }],
    })
    mockRun.mockResolvedValue(undefined)

    await DELETE(makeRequest('DELETE'), PARAMS)
    expect(fs.unlinkSync).toHaveBeenCalledWith('/tmp/data/adapted/job-123.pdf')
  })

  it('returns 500 on DB error', async () => {
    mockGetDb.mockRejectedValueOnce(new Error('locked'))
    const res = await DELETE(makeRequest('DELETE'), PARAMS)
    expect(res.status).toBe(500)
  })
})
