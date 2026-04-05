import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { getDb } from '@/lib/db'
import { extractPdfText } from '@/lib/pdf-extractor'
import { askClaudeJSON } from '@/lib/claude'
import { generateResumePDF } from '@/lib/pdf-generator'
import type { ResumeData } from '@/lib/pdf-generator'

const DATA_DIR = process.env.DUCKDB_PATH
  ? path.dirname(process.env.DUCKDB_PATH)
  : path.join(process.cwd(), 'data')

const SYSTEM_PROMPT = `You are an expert resume writer optimising resumes for both human readers and Applicant Tracking Systems (ATS).

Given an original resume and a job description, produce an improved version of the candidate's resume that:
- Retains ONLY information actually present in the original resume — do not invent experience, skills, or credentials
- Incorporates relevant keywords and phrases from the job posting naturally
- Uses consistent date formatting throughout (e.g. always "Jan 2020 – Mar 2024")
- Stays ATS-safe: standard fonts, no photos/logos/charts/icons/stars/arrows/checkmarks
- Rewrites bullet points to be achievement-oriented: "Achieved X by doing Y, resulting in Z"
- Keeps language professional, concise, and scannable

Generate the output filename using the format: FirstName_LastName_JobTitle_Resume.pdf

Respond with ONLY a valid JSON object — no markdown fences, no explanation:
{
  "output_filename": "FirstName_LastName_JobTitle_Resume.pdf",
  "warnings": ["list any ATS issues found in the original, e.g. presence of a photo, fancy symbols, non-standard fonts"],
  "changes": [
    {
      "original_text": "exact phrase from the original resume that was changed",
      "replacement_text": "the improved version of that phrase",
      "reason": "brief explanation of why this change improves ATS or readability"
    }
  ],
  "resume": {
    "name": "Full Name",
    "email": "email@example.com",
    "phone": "+1 555 000 0000",
    "location": "City, State / Remote",
    "linkedin": "linkedin.com/in/handle",
    "website": "optional",
    "summary": "2-3 sentence professional summary tailored to the role",
    "experience": [
      {
        "company": "Company Name",
        "role": "Job Title",
        "dates": "Jan 2020 – Mar 2024",
        "location": "City, State",
        "bullets": ["Achievement-oriented bullet", "..."]
      }
    ],
    "education": [
      {
        "institution": "University Name",
        "degree": "B.S. Computer Science",
        "dates": "2015 – 2019",
        "details": "Optional: GPA, honours, relevant coursework"
      }
    ],
    "skills": ["Skill 1", "Skill 2", "Skill 3"],
    "certifications": ["Optional cert 1"]
  }
}`

interface Change {
  original_text: string
  replacement_text: string
  reason: string
}

interface ClaudeEnhanceResponse {
  output_filename: string
  warnings: string[]
  changes: Change[]
  resume: ResumeData
}

export async function POST(req: NextRequest) {
  try {
    const { job_id, job_description, candidate_name } = await req.json()

    if (!job_id || !job_description) {
      return NextResponse.json({ error: 'job_id and job_description required' }, { status: 400 })
    }

    const conn = await getDb()

    // Fetch job
    const jobResult = await conn.runAndReadAll(`SELECT * FROM jobs WHERE id = '${job_id}'`)
    const jobs = jobResult.getRowObjects()
    if (!jobs.length) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

    const job = jobs[0] as Record<string, unknown>
    const baseResumeId = job.base_resume_id ? String(job.base_resume_id) : null
    if (!baseResumeId) {
      return NextResponse.json({ error: 'No base resume linked to this job' }, { status: 400 })
    }

    // Fetch resume path
    const resumeResult = await conn.runAndReadAll(
      `SELECT file_path FROM resumes WHERE id = '${baseResumeId}'`,
    )
    const resumes = resumeResult.getRowObjects()
    if (!resumes.length) return NextResponse.json({ error: 'Resume not found' }, { status: 404 })

    const resumePath = String((resumes[0] as Record<string, unknown>).file_path)
    if (!fs.existsSync(resumePath)) {
      return NextResponse.json({ error: 'Resume file missing on disk' }, { status: 404 })
    }

    // Extract text from the uploaded PDF
    const resumeText = await extractPdfText(resumePath)

    // Build prompt and call Claude CLI
    const prompt = `${SYSTEM_PROMPT}

---
ORIGINAL RESUME TEXT:
${resumeText.slice(0, 8000)}

---
JOB DESCRIPTION:
${job_description.slice(0, 4000)}

---
Candidate name hint (for filename): ${candidate_name ?? 'extract from resume'}`

    const result = await askClaudeJSON<ClaudeEnhanceResponse>(prompt)

    // Generate clean PDF from Claude's structured resume JSON
    const pdfBuffer = await generateResumePDF(result.resume)

    // Save to disk
    const adaptedDir = path.join(DATA_DIR, 'uploads', 'adapted')
    if (!fs.existsSync(adaptedDir)) fs.mkdirSync(adaptedDir, { recursive: true })

    const outputPath = path.join(adaptedDir, `${job_id}.pdf`)
    fs.writeFileSync(outputPath, pdfBuffer)

    // Update jobs table
    await conn.run(
      `UPDATE jobs SET resume_path = '${outputPath.replace(/'/g, "''")}' WHERE id = '${job_id}'`,
    )

    return NextResponse.json({
      filename: result.output_filename,
      warnings: result.warnings ?? [],
      changes: result.changes ?? [],
      download_url: `/api/jobs/${job_id}/resume`,
    })
  } catch (err) {
    console.error(err)
    const message = err instanceof Error ? err.message : 'Enhancement failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
