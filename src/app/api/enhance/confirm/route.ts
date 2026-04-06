import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { getDb } from '@/lib/db'
import { generateResumePDF } from '@/lib/pdf-generator'
import { isValidTemplateId, DEFAULT_TEMPLATE_ID } from '@/lib/resume-templates'
import { getDataDir } from '@/lib/app-config'
import type { ResumeData } from '@/lib/types'

interface MinimalBody {
  job_id: string
  output_filename: string
  template?: string
  resume: ResumeData
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { job_id, output_filename, template } = body as {
      job_id: string
      output_filename?: string
      template?: string
    }

    if (!job_id) {
      return NextResponse.json({ error: 'job_id is required' }, { status: 400 })
    }

    const { resume } = body as MinimalBody
    if (!resume) {
      return NextResponse.json({ error: 'resume is required' }, { status: 400 })
    }

    const adaptedDir = path.join(getDataDir(), 'uploads', 'adapted')
    if (!fs.existsSync(adaptedDir)) fs.mkdirSync(adaptedDir, { recursive: true })
    const outputPath = path.join(adaptedDir, `${job_id}.pdf`)

    const templateId =
      template && isValidTemplateId(template) ? template : DEFAULT_TEMPLATE_ID
    const pdfBuffer = await generateResumePDF(resume, templateId)
    fs.writeFileSync(outputPath, pdfBuffer)

    const conn = await getDb()
    await conn.run(
      `UPDATE jobs SET resume_path = '${outputPath.replace(/'/g, "''")}' WHERE id = '${job_id}'`,
    )

    const filename = output_filename ?? `${job_id}.pdf`

    return NextResponse.json({
      filename,
      download_url: `/api/jobs/${job_id}/resume`,
    })
  } catch (err) {
    console.error(err)
    const message = err instanceof Error ? err.message : 'PDF generation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
