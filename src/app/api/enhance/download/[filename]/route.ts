import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { getDataDir } from '@/lib/app-config'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ filename: string }> }) {
  try {
    const { filename: rawFilename } = await params
    const filename = path.basename(rawFilename)

    const filePath = path.join(getDataDir(), 'uploads', 'adapted', filename)
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

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
    return NextResponse.json({ error: 'Failed to serve file' }, { status: 500 })
  }
}
