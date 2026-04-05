import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
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

    const filePath = String((rows[0] as Record<string, unknown>).file_path)

    // Delete the DB row BEFORE the file.
    // If the DB delete fails the file is untouched and the user can retry.
    // If the DB delete succeeds but the file unlink fails it's a harmless
    // orphan — far better than a ghost DB row with no backing file.
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
