import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { getDb } from '@/lib/db'
import { generateResumePDF } from '@/lib/pdf-generator'
import { isValidTemplateId, DEFAULT_TEMPLATE_ID } from '@/lib/resume-templates'
import type { ResumeData } from '@/lib/types'

const DATA_DIR = process.env.DUCKDB_PATH
  ? path.dirname(process.env.DUCKDB_PATH)
  : path.join(process.cwd(), 'data')

export async function POST(req: NextRequest) {
  try {
    const { job_id, resume, output_filename, template } = await req.json() as {
      job_id: string
      resume: ResumeData
      output_filename: string
      template?: string
    }

    if (!job_id || !resume) {
      return NextResponse.json({ error: 'job_id and resume are required' }, { status: 400 })
    }

    const templateId = template && isValidTemplateId(template) ? template : DEFAULT_TEMPLATE_ID
    const pdfBuffer = await generateResumePDF(resume, templateId)

    const adaptedDir = path.join(DATA_DIR, 'uploads', 'adapted')
    if (!fs.existsSync(adaptedDir)) fs.mkdirSync(adaptedDir, { recursive: true })

    const outputPath = path.join(adaptedDir, `${job_id}.pdf`)
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
