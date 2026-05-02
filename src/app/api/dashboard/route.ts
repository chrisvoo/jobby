import { NextRequest, NextResponse } from 'next/server'
import { getDb, toISO } from '@/lib/db'
import type { JobStatus } from '@/lib/types'

const VALID_MONTHS = new Set([3, 6, 12])
const FORTY_FIVE_DAYS_MS = 45 * 24 * 60 * 60 * 1000

export async function GET(req: NextRequest) {
  try {
    const conn = await getDb()
    const url = new URL(req.url)
    const monthsParam = parseInt(url.searchParams.get('months') ?? '3', 10)
    const months = VALID_MONTHS.has(monthsParam) ? monthsParam : 3

    const historyResult = await conn.runAndReadAll(`
      SELECT jsh.job_id,
             CAST(jsh.to_status AS VARCHAR) AS to_status,
             jsh.changed_at,
             j.applied_at,
             CAST(j.status AS VARCHAR) AS current_status
      FROM job_status_history jsh
      JOIN jobs j ON j.id = jsh.job_id
      WHERE j.applied_at >= NOW() - INTERVAL ${months} MONTH
      ORDER BY jsh.job_id, jsh.changed_at ASC
    `)

    const rows = historyResult.getRowObjects() as Array<{
      job_id: string
      to_status: string
      changed_at: unknown
      applied_at: unknown
      current_status: string
    }>

    const jobMap = new Map<string, { statuses: string[]; lastActivityAt: string; currentStatus: string }>()

    for (const row of rows) {
      let entry = jobMap.get(row.job_id)
      if (!entry) {
        entry = {
          statuses: [],
          lastActivityAt: toISO(row.changed_at),
          currentStatus: row.current_status,
        }
        jobMap.set(row.job_id, entry)
      }
      entry.statuses.push(row.to_status)
      // Rows are ordered by changed_at ASC, so the last one wins
      entry.lastActivityAt = toISO(row.changed_at)
    }

    // Also include jobs that might have no history rows at all within the window.
    // For these, we only have applied_at as a date reference. If the current status
    // differs from "applied", the job progressed at an unknown date -- we use "now"
    // to avoid falsely marking it as ghosted.
    const jobsWithoutHistory = await conn.runAndReadAll(`
      SELECT j.id, j.applied_at, CAST(j.status AS VARCHAR) AS status
      FROM jobs j
      WHERE j.applied_at >= NOW() - INTERVAL ${months} MONTH
        AND j.id NOT IN (SELECT DISTINCT job_id FROM job_status_history)
    `)
    for (const row of jobsWithoutHistory.getRowObjects() as Array<{ id: string; applied_at: unknown; status: string }>) {
      if (!jobMap.has(row.id)) {
        const hasProgressed = row.status !== 'applied'
        jobMap.set(row.id, {
          statuses: hasProgressed ? ['applied', row.status] : [row.status],
          lastActivityAt: hasProgressed ? new Date().toISOString() : toISO(row.applied_at),
          currentStatus: row.status,
        })
      }
    }

    const now = Date.now()
    const pathCounts = new Map<string, number>()
    const stats = { total: 0, interview: 0, offer: 0, rejected: 0, ghosted: 0 }

    for (const [, entry] of jobMap) {
      stats.total++
      const cs = entry.currentStatus as JobStatus
      if (cs === 'hr_interview' || cs === 'tech_interview') stats.interview++
      else if (cs === 'offer') stats.offer++
      else if (cs === 'rejected') stats.rejected++

      // Ensure every path starts with "applied" even if history is incomplete
      const statuses = entry.statuses[0] === 'applied' ? entry.statuses : ['applied', ...entry.statuses]

      const isGhosted =
        cs !== 'rejected' &&
        cs !== 'offer' &&
        now - new Date(entry.lastActivityAt).getTime() > FORTY_FIVE_DAYS_MS

      if (isGhosted) stats.ghosted++

      const displayPath = isGhosted ? [...statuses, 'ghosted'] : statuses
      const key = JSON.stringify(displayPath)
      pathCounts.set(key, (pathCounts.get(key) ?? 0) + 1)
    }

    const paths = Array.from(pathCounts.entries())
      .map(([key, count]) => ({
        path: JSON.parse(key) as string[],
        count,
      }))
      .sort((a, b) => a.path.length - b.path.length || b.count - a.count)

    return NextResponse.json({ months, stats, paths })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to load dashboard data' }, { status: 500 })
  }
}
