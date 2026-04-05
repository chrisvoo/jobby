import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import path from 'path'
import fs from 'fs'
import { getDb, toISO } from '@/lib/db'
import { readConfig } from '@/lib/app-config'
import type { Resume } from '@/lib/types'

// Always derive the upload directory from the same config that drives DuckDB,
// so both the DB file and PDF uploads stay under the same root.
function getDataDir() {
  return path.dirname(readConfig().duckdb_path)
}

function rowToResume(row: Record<string, unknown>): Resume {
  return {
    id: String(row.id),
    name: String(row.name),
    file_path: String(row.file_path),
    uploaded_at: toISO(row.uploaded_at),
  }
}

export async function GET() {
  try {
    const conn = await getDb()
    const result = await conn.runAndReadAll(`SELECT * FROM resumes ORDER BY uploaded_at DESC`)
    return NextResponse.json(result.getRowObjects().map(rowToResume))
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to fetch resumes' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  let filePath: string | null = null
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const name = formData.get('name') as string | null

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'Only PDF files are supported' }, { status: 400 })
    }

    const id = randomUUID()
    const resumesDir = path.join(getDataDir(), 'uploads', 'resumes')
    if (!fs.existsSync(resumesDir)) fs.mkdirSync(resumesDir, { recursive: true })

    // Write the file first so we have the path ready for the DB row.
    // If the DB insert below fails we clean it up in the catch block.
    filePath = path.join(resumesDir, `${id}.pdf`)
    const buffer = Buffer.from(await file.arrayBuffer())
    fs.writeFileSync(filePath, buffer)

    const conn = await getDb()
    const resumeName = (name ?? file.name.replace(/\.pdf$/i, '')).replace(/'/g, "''")
    await conn.run(`
      INSERT INTO resumes (id, name, file_path)
      VALUES ('${id}', '${resumeName}', '${filePath.replace(/'/g, "''")}')
    `)

    const result = await conn.runAndReadAll(`SELECT * FROM resumes WHERE id = '${id}'`)
    return NextResponse.json(
      rowToResume(result.getRowObjects()[0] as Record<string, unknown>),
      { status: 201 },
    )
  } catch (err) {
    // If the DB insert failed, remove the PDF we already wrote so there
    // is no orphaned file on disk.
    if (filePath && fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath) } catch {}
    }
    console.error(err)
    return NextResponse.json({ error: 'Failed to upload resume' }, { status: 500 })
  }
}
