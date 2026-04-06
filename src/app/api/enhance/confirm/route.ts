import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { getDb } from '@/lib/db'
import { generateResumePDF } from '@/lib/pdf-generator'
import { isValidTemplateId, DEFAULT_TEMPLATE_ID } from '@/lib/resume-templates'
import { getDataDir, resolveDataPath } from '@/lib/app-config'
import type { ResumeData } from '@/lib/types'

const PYTHON_SIDECAR_URL =
  process.env.PYTHON_SIDECAR_URL ?? 'http://localhost:5001'

interface PixelPerfectBody {
  job_id: string
  output_filename: string
  template: 'pixel-perfect'
  replacements: Array<{ old: string; new: string }>
  resume_path: string
}

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

    const adaptedDir = path.join(getDataDir(), 'uploads', 'adapted')
    if (!fs.existsSync(adaptedDir)) fs.mkdirSync(adaptedDir, { recursive: true })
    const outputPath = path.join(adaptedDir, `${job_id}.pdf`)

    if (template === 'pixel-perfect') {
      const { replacements, resume_path: rawResumePath } = body as PixelPerfectBody

      if (!replacements?.length) {
        return NextResponse.json(
          { error: 'replacements array is required for pixel-perfect mode' },
          { status: 400 },
        )
      }
      const resume_path = resolveDataPath(rawResumePath ?? '')
      if (!resume_path || !fs.existsSync(resume_path)) {
        return NextResponse.json(
          { error: `Input PDF not found: ${rawResumePath}` },
          { status: 404 },
        )
      }

      const sidecarPayload = {
        input_pdf: resume_path,
        output_pdf: outputPath,
        replacements: replacements
          .filter((r) => r.new.trim() !== '')
          .map((r) => ({ old: r.old, new: r.new })),
      }

      const sidecarRes = await fetch(`${PYTHON_SIDECAR_URL}/replace`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sidecarPayload),
        signal: AbortSignal.timeout(60_000),
      })

      if (!sidecarRes.ok) {
        const errBody = await sidecarRes.json().catch(() => ({}))
        const errMsg =
          (errBody as Record<string, string>).error ?? `Sidecar returned ${sidecarRes.status}`
        return NextResponse.json({ error: errMsg }, { status: 502 })
      }
    } else {
      const { resume } = body as MinimalBody
      if (!resume) {
        return NextResponse.json({ error: 'resume is required' }, { status: 400 })
      }
      const templateId =
        template && isValidTemplateId(template) ? template : DEFAULT_TEMPLATE_ID
      const pdfBuffer = await generateResumePDF(resume, templateId)
      fs.writeFileSync(outputPath, pdfBuffer)
    }

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
