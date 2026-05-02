import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getDb, toISO, parseSalary } from '@/lib/db'
import type { Job, JobStatus, CreateJobInput } from '@/lib/types'

function rowToJob(row: Record<string, unknown>): Job {
  return {
    id: String(row.id),
    company: String(row.company),
    role: String(row.role),
    url: row.url ? String(row.url) : null,
    status: String(row.status) as Job['status'],
    applied_at: toISO(row.applied_at),
    notes: row.notes ? String(row.notes) : null,
    description: row.description ? String(row.description) : null,
    gross_annual_salary: parseSalary(row.gross_annual_salary),
    salary_currency: row.salary_currency ? String(row.salary_currency) : null,
    base_resume_id: row.base_resume_id ? String(row.base_resume_id) : null,
    resume_path: row.resume_path ? String(row.resume_path) : null,
  }
}

export async function GET(req: NextRequest) {
  try {
    const conn = await getDb()
    const url = new URL(req.url)

    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1)
    const pageSize = Math.max(1, Math.min(100, parseInt(url.searchParams.get('pageSize') ?? '10', 10) || 10))
    const statusFilter = url.searchParams.get('status') as JobStatus | null
    const offset = (page - 1) * pageSize

    const where = statusFilter ? `WHERE status = '${statusFilter.replace(/'/g, "''")}'` : ''

    const countResult = await conn.runAndReadAll(`SELECT COUNT(*) AS cnt FROM jobs ${where}`)
    const total = Number((countResult.getRowObjects()[0] as Record<string, unknown>).cnt)

    const result = await conn.runAndReadAll(
      `SELECT * FROM jobs ${where} ORDER BY applied_at DESC LIMIT ${pageSize} OFFSET ${offset}`,
    )
    const jobs = result.getRowObjects().map(rowToJob)

    const countsResult = await conn.runAndReadAll(
      `SELECT CAST(status AS VARCHAR) AS status, COUNT(*) AS cnt FROM jobs GROUP BY status`,
    )
    const statusCounts: Record<string, number> = {}
    let totalAll = 0
    for (const row of countsResult.getRowObjects() as Array<{ status: string; cnt: unknown }>) {
      const c = Number(row.cnt)
      statusCounts[row.status] = c
      totalAll += c
    }
    statusCounts.all = totalAll

    return NextResponse.json({ jobs, total, page, pageSize, statusCounts })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: CreateJobInput = await req.json()
    const conn = await getDb()
    const id = randomUUID()

    const salary =
      body.salary_min != null && body.salary_max != null
        ? `[${body.salary_min}, ${body.salary_max}]`
        : 'NULL'

    const appliedAt = body.applied_at ? `'${body.applied_at}'` : 'now()'

    await conn.run(`
      INSERT INTO jobs (id, company, role, url, status, applied_at, notes, description, gross_annual_salary, salary_currency, base_resume_id)
      VALUES (
        '${id}',
        '${body.company.replace(/'/g, "''")}',
        '${body.role.replace(/'/g, "''")}',
        ${body.url ? `'${body.url.replace(/'/g, "''")}'` : 'NULL'},
        '${body.status ?? 'applied'}',
        ${appliedAt},
        ${body.notes ? `'${body.notes.replace(/'/g, "''")}'` : 'NULL'},
        ${body.description ? `'${body.description.replace(/'/g, "''")}'` : 'NULL'},
        ${salary},
        ${body.salary_currency ? `'${body.salary_currency.replace(/'/g, "''")}'` : 'NULL'},
        ${body.base_resume_id ? `'${body.base_resume_id}'` : 'NULL'}
      )
    `)

    const initialStatus: JobStatus = (body.status ?? 'applied') as JobStatus
    const historyId = randomUUID()
    await conn.run(`
      INSERT INTO job_status_history (id, job_id, from_status, to_status)
      VALUES ('${historyId}', '${id}', NULL, '${initialStatus}')
    `)

    const result = await conn.runAndReadAll(`SELECT * FROM jobs WHERE id = '${id}'`)
    const rows = result.getRowObjects()
    return NextResponse.json(rowToJob(rows[0] as Record<string, unknown>), { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to create job' }, { status: 500 })
  }
}
