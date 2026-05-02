/**
 * Tests for GET /api/dashboard
 *
 * Verifies status funnel aggregation, ghosting logic, and time-window filtering.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockRunAndReadAll = vi.fn()
const mockGetDb = vi.fn(() => Promise.resolve({ runAndReadAll: mockRunAndReadAll }))

vi.mock('@/lib/db', () => ({
  getDb: (...args: unknown[]) => mockGetDb(...args),
  toISO: (v: unknown) => (v instanceof Date ? v.toISOString() : String(v ?? new Date().toISOString())),
}))

vi.mock('@/lib/app-config', () => ({
  readConfig: vi.fn(() => ({ duckdb_path: '', claude_model: '', target_currency: 'EUR' })),
}))

import { GET } from '@/app/api/dashboard/route'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost/api/dashboard')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return new NextRequest(url, { method: 'GET' })
}

const RECENT_DATE = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()  // 10 days ago
const OLD_DATE = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()     // 60 days ago

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ now: new Date('2026-05-02T10:00:00Z') })
})

afterEach(() => {
  vi.useRealTimers()
})

// ── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/dashboard', () => {
  function setupMocks(historyRows: object[], noHistoryRows: object[] = []) {
    mockRunAndReadAll
      .mockResolvedValueOnce({ getRowObjects: () => historyRows })
      .mockResolvedValueOnce({ getRowObjects: () => noHistoryRows })
  }

  it('returns default months=3 when no param provided', async () => {
    setupMocks([])

    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.months).toBe(3)
  })

  it('accepts valid months param', async () => {
    setupMocks([])

    const res = await GET(makeRequest({ months: '12' }))
    const body = await res.json()
    expect(body.months).toBe(12)
  })

  it('falls back to 3 for invalid months param', async () => {
    setupMocks([])

    const res = await GET(makeRequest({ months: '7' }))
    const body = await res.json()
    expect(body.months).toBe(3)
  })

  it('computes stats from history rows', async () => {
    setupMocks([
      { job_id: 'j1', to_status: 'applied', changed_at: RECENT_DATE, applied_at: RECENT_DATE, current_status: 'applied' },
      { job_id: 'j2', to_status: 'applied', changed_at: RECENT_DATE, applied_at: RECENT_DATE, current_status: 'rejected' },
      { job_id: 'j2', to_status: 'rejected', changed_at: RECENT_DATE, applied_at: RECENT_DATE, current_status: 'rejected' },
      { job_id: 'j3', to_status: 'applied', changed_at: RECENT_DATE, applied_at: RECENT_DATE, current_status: 'hr_interview' },
      { job_id: 'j3', to_status: 'hr_interview', changed_at: RECENT_DATE, applied_at: RECENT_DATE, current_status: 'hr_interview' },
    ])

    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.stats.total).toBe(3)
    expect(body.stats.rejected).toBe(1)
    expect(body.stats.interview).toBe(1)
    expect(body.stats.offer).toBe(0)
  })

  it('builds correct transition paths', async () => {
    setupMocks([
      { job_id: 'j1', to_status: 'applied', changed_at: RECENT_DATE, applied_at: RECENT_DATE, current_status: 'rejected' },
      { job_id: 'j1', to_status: 'rejected', changed_at: RECENT_DATE, applied_at: RECENT_DATE, current_status: 'rejected' },
    ])

    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.paths).toHaveLength(1)
    expect(body.paths[0].path).toEqual(['applied', 'rejected'])
    expect(body.paths[0].count).toBe(1)
  })

  it('marks jobs as ghosted when last activity > 45 days and status is not rejected/offer', async () => {
    setupMocks([
      { job_id: 'j1', to_status: 'applied', changed_at: OLD_DATE, applied_at: OLD_DATE, current_status: 'applied' },
    ])

    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.stats.ghosted).toBe(1)
    expect(body.paths[0].path).toEqual(['applied', 'ghosted'])
  })

  it('does NOT ghost jobs with recent activity', async () => {
    setupMocks([
      { job_id: 'j1', to_status: 'applied', changed_at: RECENT_DATE, applied_at: RECENT_DATE, current_status: 'applied' },
    ])

    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.stats.ghosted).toBe(0)
    expect(body.paths[0].path).toEqual(['applied'])
  })

  it('does NOT ghost rejected jobs even if old', async () => {
    setupMocks([
      { job_id: 'j1', to_status: 'applied', changed_at: OLD_DATE, applied_at: OLD_DATE, current_status: 'rejected' },
      { job_id: 'j1', to_status: 'rejected', changed_at: OLD_DATE, applied_at: OLD_DATE, current_status: 'rejected' },
    ])

    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.stats.ghosted).toBe(0)
    expect(body.paths[0].path).toEqual(['applied', 'rejected'])
  })

  it('does NOT ghost offer jobs even if old', async () => {
    setupMocks([
      { job_id: 'j1', to_status: 'applied', changed_at: OLD_DATE, applied_at: OLD_DATE, current_status: 'offer' },
      { job_id: 'j1', to_status: 'offer', changed_at: OLD_DATE, applied_at: OLD_DATE, current_status: 'offer' },
    ])

    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.stats.ghosted).toBe(0)
  })

  it('includes jobs without history rows', async () => {
    setupMocks([], [
      { id: 'j1', applied_at: RECENT_DATE, status: 'applied' },
    ])

    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.stats.total).toBe(1)
    expect(body.paths[0].path).toEqual(['applied'])
  })

  it('prepends "applied" to paths of jobs without history that have progressed', async () => {
    setupMocks([], [
      { id: 'j1', applied_at: RECENT_DATE, status: 'rejected' },
    ])

    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.paths[0].path).toEqual(['applied', 'rejected'])
  })

  it('does not ghost jobs without history that have progressed past applied', async () => {
    setupMocks([], [
      { id: 'j1', applied_at: OLD_DATE, status: 'hr_interview' },
    ])

    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.stats.ghosted).toBe(0)
  })

  it('prepends "applied" when history starts with non-applied status', async () => {
    setupMocks([
      { job_id: 'j1', to_status: 'rejected', changed_at: RECENT_DATE, applied_at: RECENT_DATE, current_status: 'rejected' },
    ])

    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.paths[0].path).toEqual(['applied', 'rejected'])
  })

  it('sorts paths by length then count descending', async () => {
    setupMocks([
      { job_id: 'j1', to_status: 'applied', changed_at: RECENT_DATE, applied_at: RECENT_DATE, current_status: 'applied' },
      { job_id: 'j2', to_status: 'applied', changed_at: RECENT_DATE, applied_at: RECENT_DATE, current_status: 'applied' },
      { job_id: 'j3', to_status: 'applied', changed_at: RECENT_DATE, applied_at: RECENT_DATE, current_status: 'rejected' },
      { job_id: 'j3', to_status: 'rejected', changed_at: RECENT_DATE, applied_at: RECENT_DATE, current_status: 'rejected' },
    ])

    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.paths[0].path).toEqual(['applied'])
    expect(body.paths[0].count).toBe(2)
    expect(body.paths[1].path).toEqual(['applied', 'rejected'])
    expect(body.paths[1].count).toBe(1)
  })

  it('returns 500 on DB error', async () => {
    mockGetDb.mockRejectedValueOnce(new Error('DB down'))

    const res = await GET(makeRequest())
    expect(res.status).toBe(500)
  })
})
