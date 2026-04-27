import { NextRequest, NextResponse } from 'next/server'
import { getDb, toISO } from '@/lib/db'
import type { JobStatusHistory } from '@/lib/types'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const conn = await getDb()
    const result = await conn.runAndReadAll(
      `SELECT * FROM job_status_history WHERE job_id = '${id}' ORDER BY changed_at ASC`,
    )
    const rows = result.getRowObjects() as Record<string, unknown>[]
    const history: JobStatusHistory[] = rows.map((r) => ({
      id: String(r.id),
      job_id: String(r.job_id),
      from_status: r.from_status ? (String(r.from_status) as JobStatusHistory['from_status']) : null,
      to_status: String(r.to_status) as JobStatusHistory['to_status'],
      changed_at: toISO(r.changed_at),
    }))
    return NextResponse.json(history)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 })
  }
}
