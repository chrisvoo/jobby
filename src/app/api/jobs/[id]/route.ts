import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import { getDb, toISO, parseSalary } from '@/lib/db'
import { resolveDataPath } from '@/lib/app-config'
import type { Job, UpdateJobInput } from '@/lib/types'

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
    base_resume_id: row.base_resume_id ? String(row.base_resume_id) : null,
    resume_path: row.resume_path ? String(row.resume_path) : null,
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const conn = await getDb()
    const result = await conn.runAndReadAll(`SELECT * FROM jobs WHERE id = '${id}'`)
    const rows = result.getRowObjects()
    if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(rowToJob(rows[0] as Record<string, unknown>))
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to fetch job' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body: UpdateJobInput = await req.json()
    const conn = await getDb()

    const setClauses: string[] = []

    if (body.company !== undefined)
      setClauses.push(`company = '${body.company.replace(/'/g, "''")}'`)
    if (body.role !== undefined)
      setClauses.push(`role = '${body.role.replace(/'/g, "''")}'`)
    if (body.url !== undefined)
      setClauses.push(`url = ${body.url ? `'${body.url.replace(/'/g, "''")}'` : 'NULL'}`)
    if (body.status !== undefined)
      setClauses.push(`status = '${body.status}'`)
    if (body.applied_at !== undefined)
      setClauses.push(`applied_at = '${body.applied_at}'`)
    if (body.notes !== undefined)
      setClauses.push(`notes = ${body.notes ? `'${body.notes.replace(/'/g, "''")}'` : 'NULL'}`)
    if (body.description !== undefined)
      setClauses.push(`description = ${body.description ? `'${body.description.replace(/'/g, "''")}'` : 'NULL'}`)
    if (body.salary_min != null && body.salary_max != null)
      setClauses.push(`gross_annual_salary = [${body.salary_min}, ${body.salary_max}]`)
    if (body.salary_min === null && body.salary_max === null)
      setClauses.push(`gross_annual_salary = NULL`)
    if (body.base_resume_id !== undefined)
      setClauses.push(`base_resume_id = ${body.base_resume_id ? `'${body.base_resume_id}'` : 'NULL'}`)
    if (body.resume_path !== undefined)
      setClauses.push(`resume_path = ${body.resume_path ? `'${body.resume_path.replace(/'/g, "''")}'` : 'NULL'}`)

    if (!setClauses.length)
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })

    await conn.run(`UPDATE jobs SET ${setClauses.join(', ')} WHERE id = '${id}'`)

    const result = await conn.runAndReadAll(`SELECT * FROM jobs WHERE id = '${id}'`)
    const rows = result.getRowObjects()
    if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(rowToJob(rows[0] as Record<string, unknown>))
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to update job' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const conn = await getDb()

    const result = await conn.runAndReadAll(`SELECT resume_path FROM jobs WHERE id = '${id}'`)
    const rows = result.getRowObjects()
    const rawPath = rows[0]?.resume_path ? String(rows[0].resume_path) : null
    const resumePath = rawPath ? resolveDataPath(rawPath) : null

    await conn.run(`DELETE FROM jobs WHERE id = '${id}'`)

    if (resumePath) {
      try {
        fs.unlinkSync(resumePath)
      } catch {
        // File already gone or inaccessible — not a hard failure
      }
    }

    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to delete job' }, { status: 500 })
  }
}
