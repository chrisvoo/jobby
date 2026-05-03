import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { getDb } from '@/lib/db'
import { generateResumePDF } from '@/lib/pdf-generator'
import { isValidTemplateId, DEFAULT_TEMPLATE_ID } from '@/lib/resume-templates'
import { getDataDir } from '@/lib/app-config'
import type { ResumeData } from '@/lib/types'

interface ConfirmBody {
  job_id?: string
  output_filename?: string
  template?: string
  resume: ResumeData
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as ConfirmBody

    if (!body.resume) {
      return NextResponse.json({ error: 'resume is required' }, { status: 400 })
    }

    const { job_id, output_filename, template, resume } = body

    const adaptedDir = path.join(getDataDir(), 'uploads', 'adapted')
    if (!fs.existsSync(adaptedDir)) fs.mkdirSync(adaptedDir, { recursive: true })

    const safeFilename = (output_filename ?? `resume_${crypto.randomUUID()}.pdf`)
      .replace(/[^a-zA-Z0-9_.\- ]/g, '_')
    const outputPath = path.join(adaptedDir, safeFilename)

    const templateId = template && isValidTemplateId(template) ? template : DEFAULT_TEMPLATE_ID
    const pdfBuffer = await generateResumePDF(resume, templateId)
    fs.writeFileSync(outputPath, pdfBuffer)

    if (job_id) {
      const conn = await getDb()
      await conn.run(
        `UPDATE jobs SET resume_path = '${outputPath.replace(/'/g, "''")}' WHERE id = '${job_id}'`,
      )
    }

    const filename = output_filename ?? safeFilename

    return NextResponse.json({
      filename,
      download_url: `/api/enhance/download/${encodeURIComponent(safeFilename)}`,
    })
  } catch (err) {
    console.error(err)
    const message = err instanceof Error ? err.message : 'PDF generation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
