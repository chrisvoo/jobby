import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import { getDb } from '@/lib/db'
import { resolveDataPath } from '@/lib/app-config'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const conn = await getDb()
    const result = await conn.runAndReadAll(
      `SELECT resume_path, company, role FROM jobs WHERE id = '${id}'`,
    )
    const rows = result.getRowObjects()
    if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const row = rows[0] as Record<string, unknown>
    const filePath = row.resume_path ? resolveDataPath(String(row.resume_path)) : null
    if (!filePath) return NextResponse.json({ error: 'No adapted resume yet' }, { status: 404 })
    if (!fs.existsSync(filePath))
      return NextResponse.json({ error: 'File not found on disk' }, { status: 404 })

    const company = String(row.company).replace(/[^a-zA-Z0-9]/g, '_')
    const role = String(row.role).replace(/[^a-zA-Z0-9]/g, '_')
    const filename = `${company}_${role}_Resume.pdf`

    const buffer = fs.readFileSync(filePath)
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.length),
      },
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to download resume' }, { status: 500 })
  }
}
