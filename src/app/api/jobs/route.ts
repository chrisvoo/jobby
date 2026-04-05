import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getDb, toISO, parseSalary } from '@/lib/db'
import type { Job, CreateJobInput } from '@/lib/types'

function rowToJob(row: Record<string, unknown>): Job {
  return {
    id: String(row.id),
    company: String(row.company),
    role: String(row.role),
    url: row.url ? String(row.url) : null,
    status: String(row.status) as Job['status'],
    applied_at: toISO(row.applied_at),
    notes: row.notes ? String(row.notes) : null,
    gross_annual_salary: parseSalary(row.gross_annual_salary),
    base_resume_id: row.base_resume_id ? String(row.base_resume_id) : null,
    resume_path: row.resume_path ? String(row.resume_path) : null,
  }
}

export async function GET() {
  try {
    const conn = await getDb()
    const result = await conn.runAndReadAll(
      `SELECT * FROM jobs ORDER BY applied_at DESC`,
    )
    const jobs = result.getRowObjects().map(rowToJob)
    return NextResponse.json(jobs)
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
      INSERT INTO jobs (id, company, role, url, status, applied_at, notes, gross_annual_salary, base_resume_id)
      VALUES (
        '${id}',
        '${body.company.replace(/'/g, "''")}',
        '${body.role.replace(/'/g, "''")}',
        ${body.url ? `'${body.url.replace(/'/g, "''")}'` : 'NULL'},
        '${body.status ?? 'applied'}',
        ${appliedAt},
        ${body.notes ? `'${body.notes.replace(/'/g, "''")}'` : 'NULL'},
        ${salary},
        ${body.base_resume_id ? `'${body.base_resume_id}'` : 'NULL'}
      )
    `)

    const result = await conn.runAndReadAll(`SELECT * FROM jobs WHERE id = '${id}'`)
    const rows = result.getRowObjects()
    return NextResponse.json(rowToJob(rows[0] as Record<string, unknown>), { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to create job' }, { status: 500 })
  }
}
