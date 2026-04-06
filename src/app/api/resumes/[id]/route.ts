import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { resolveDataPath } from '@/lib/app-config'
import fs from 'fs'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const conn = await getDb()

    const result = await conn.runAndReadAll(`SELECT file_path FROM resumes WHERE id = '${id}'`)
    const rows = result.getRowObjects()
    if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const filePath = resolveDataPath(String((rows[0] as Record<string, unknown>).file_path))

    await conn.run(`UPDATE jobs SET base_resume_id = NULL WHERE base_resume_id = '${id}'`)
    await conn.run(`DELETE FROM resumes WHERE id = '${id}'`)

    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath) } catch {}
    }

    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to delete resume' }, { status: 500 })
  }
}
