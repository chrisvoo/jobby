/**
 * Tests for GET /api/jobs (paginated listing) and POST /api/jobs (create).
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
  readConfig: vi.fn(() => ({ duckdb_path: '', llm_model: '', target_currency: 'EUR', groq_api_key: '' })),
}))

import { GET, POST } from '@/app/api/jobs/route'

// ── Fixtures ─────────────────────────────────────────────────────────────────

const DB_ROW = {
  id: 'job-1',
  company: 'Acme',
  role: 'Engineer',
  url: null,
  status: 'applied',
  applied_at: '2024-06-01T00:00:00.000Z',
  notes: null,
  description: null,
  gross_annual_salary: null,
  salary_currency: null,
  base_resume_id: null,
  resume_path: null,
}

function makeGetRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost/api/jobs')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return new NextRequest(url, { method: 'GET' })
}

function makePostRequest(body: object): NextRequest {
  return new NextRequest('http://localhost/api/jobs', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ── GET /api/jobs (paginated) ────────────────────────────────────────────────

describe('GET /api/jobs', () => {
  function setupMocks(opts: { total?: number; rows?: object[]; statusCounts?: Array<{ status: string; cnt: number }> } = {}) {
    const { total = 1, rows = [DB_ROW], statusCounts = [{ status: 'applied', cnt: 1 }] } = opts
    mockRunAndReadAll
      .mockResolvedValueOnce({ getRowObjects: () => [{ cnt: total }] })
      .mockResolvedValueOnce({ getRowObjects: () => rows })
      .mockResolvedValueOnce({ getRowObjects: () => statusCounts })
  }

  it('returns paginated response with defaults (page=1, pageSize=10)', async () => {
    setupMocks()

    const res = await GET(makeGetRequest())
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.page).toBe(1)
    expect(body.pageSize).toBe(10)
    expect(body.total).toBe(1)
    expect(body.jobs).toHaveLength(1)
    expect(body.jobs[0].id).toBe('job-1')
    expect(body.statusCounts).toBeDefined()
    expect(body.statusCounts.all).toBe(1)
  })

  it('respects page and pageSize params', async () => {
    setupMocks({ total: 25 })

    const res = await GET(makeGetRequest({ page: '2', pageSize: '5' }))
    const body = await res.json()
    expect(body.page).toBe(2)
    expect(body.pageSize).toBe(5)

    const sqlCalls = mockRunAndReadAll.mock.calls
    const selectSql = sqlCalls[1][0] as string
    expect(selectSql).toContain('LIMIT 5')
    expect(selectSql).toContain('OFFSET 5')
  })

  it('applies status filter to SQL queries', async () => {
    setupMocks()

    await GET(makeGetRequest({ status: 'rejected' }))

    const sqlCalls = mockRunAndReadAll.mock.calls
    const countSql = sqlCalls[0][0] as string
    const selectSql = sqlCalls[1][0] as string
    expect(countSql).toContain("WHERE status = 'rejected'")
    expect(selectSql).toContain("WHERE status = 'rejected'")
  })

  it('clamps pageSize to max 100', async () => {
    setupMocks()

    const res = await GET(makeGetRequest({ pageSize: '500' }))
    const body = await res.json()
    expect(body.pageSize).toBe(100)
  })

  it('clamps page to min 1', async () => {
    setupMocks()

    const res = await GET(makeGetRequest({ page: '-5' }))
    const body = await res.json()
    expect(body.page).toBe(1)
  })

  it('computes statusCounts with all total', async () => {
    setupMocks({
      total: 10,
      statusCounts: [
        { status: 'applied', cnt: 5 },
        { status: 'rejected', cnt: 3 },
        { status: 'hr_interview', cnt: 2 },
      ],
    })

    const res = await GET(makeGetRequest())
    const body = await res.json()
    expect(body.statusCounts.applied).toBe(5)
    expect(body.statusCounts.rejected).toBe(3)
    expect(body.statusCounts.hr_interview).toBe(2)
    expect(body.statusCounts.all).toBe(10)
  })

  it('returns 500 on DB error', async () => {
    mockGetDb.mockRejectedValueOnce(new Error('DB down'))

    const res = await GET(makeGetRequest())
    expect(res.status).toBe(500)
  })
})

// ── POST /api/jobs ───────────────────────────────────────────────────────────

describe('POST /api/jobs', () => {
  it('creates a job and returns 201', async () => {
    mockRun.mockResolvedValue(undefined)
    mockRunAndReadAll.mockResolvedValue({ getRowObjects: () => [DB_ROW] })

    const res = await POST(makePostRequest({ company: 'Acme', role: 'Engineer' }))
    expect(res.status).toBe(201)

    const body = await res.json()
    expect(body.company).toBe('Acme')
    expect(body.status).toBe('applied')
  })

  it('inserts a status history row on creation', async () => {
    mockRun.mockResolvedValue(undefined)
    mockRunAndReadAll.mockResolvedValue({ getRowObjects: () => [DB_ROW] })

    await POST(makePostRequest({ company: 'Test', role: 'Dev' }))

    const historySql = mockRun.mock.calls[1][0] as string
    expect(historySql).toContain('INSERT INTO job_status_history')
    expect(historySql).toContain("'applied'")
  })

  it('returns 500 on DB error', async () => {
    mockGetDb.mockRejectedValueOnce(new Error('locked'))

    const res = await POST(makePostRequest({ company: 'Test', role: 'Dev' }))
    expect(res.status).toBe(500)
  })
})
