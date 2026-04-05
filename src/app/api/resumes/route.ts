import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import path from 'path'
import fs from 'fs'
import { getDb, toISO } from '@/lib/db'
import type { Resume } from '@/lib/types'

const DATA_DIR = process.env.DUCKDB_PATH
  ? path.dirname(process.env.DUCKDB_PATH)
  : path.join(process.cwd(), 'data')

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
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const name = formData.get('name') as string | null

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'Only PDF files are supported' }, { status: 400 })
    }

    const id = randomUUID()
    const resumesDir = path.join(DATA_DIR, 'uploads', 'resumes')
    if (!fs.existsSync(resumesDir)) fs.mkdirSync(resumesDir, { recursive: true })

    const filePath = path.join(resumesDir, `${id}.pdf`)
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
    console.error(err)
    return NextResponse.json({ error: 'Failed to upload resume' }, { status: 500 })
  }
}
