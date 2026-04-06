import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import { getDb } from '@/lib/db'
import { extractPdfText } from '@/lib/pdf-extractor'
import { askClaudeJSON } from '@/lib/claude'
import { resolveDataPath } from '@/lib/app-config'
import type { ResumeData } from '@/lib/types'

const MINIMAL_PROMPT = `You are an expert resume writer optimising resumes for both human readers and Applicant Tracking Systems (ATS).

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

const PIXEL_PERFECT_PROMPT = `You are an expert resume writer. The user has a beautifully formatted PDF resume and wants to tailor it to a specific job posting WITHOUT changing the layout, fonts, or visual design.

Your job is to propose **surgical text replacements** — each one is an exact "find and replace" that will be applied directly in the PDF. The original formatting (font, size, colour, position) is preserved automatically.

Rules:
- Each "old" value MUST be an EXACT substring that appears verbatim in the original resume text. Copy it character-for-character.
- CRITICAL — length constraint: the "new" text MUST NOT exceed the word count of "old" by more than 10%. PDFs have fixed layouts; the replacement is painted into the exact same bounding box as the original text. If "new" is too long, text overflows and gets cut off or rendered at a reduced font size. Prefer slightly shorter or equal-length rewrites.
- NEVER replace section headers, company names, institution names, dates, or structural text (e.g. "Experience", "Education", "Skills").
- Focus on: professional summary, bullet points, and skill lists.
- Retain ONLY information actually present in the original — do not invent experience or credentials.
- Incorporate relevant keywords from the job posting naturally.
- Rewrite bullets to be achievement-oriented where possible.

Generate the output filename using the format: FirstName_LastName_JobTitle_Resume.pdf

Respond with ONLY a valid JSON object — no markdown fences, no explanation:
{
  "output_filename": "FirstName_LastName_JobTitle_Resume.pdf",
  "warnings": ["any issues or limitations noticed"],
  "replacements": [
    {
      "section": "summary | experience | skills | other",
      "old": "exact text from the original resume",
      "new": "improved replacement text",
      "reason": "brief explanation"
    }
  ]
}`

interface MinimalResponse {
  output_filename: string
  warnings: string[]
  changes: Array<{ original_text: string; replacement_text: string; reason: string }>
  resume: ResumeData
}

interface PixelPerfectResponse {
  output_filename: string
  warnings: string[]
  replacements: Array<{ section: string; old: string; new: string; reason: string }>
}

export async function POST(req: NextRequest) {
  try {
    const { job_id, job_description, candidate_name, template } = await req.json()

    if (!job_id || !job_description) {
      return NextResponse.json({ error: 'job_id and job_description required' }, { status: 400 })
    }

    const conn = await getDb()

    const jobResult = await conn.runAndReadAll(`SELECT * FROM jobs WHERE id = '${job_id}'`)
    const jobs = jobResult.getRowObjects()
    if (!jobs.length) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

    const job = jobs[0] as Record<string, unknown>
    const baseResumeId = job.base_resume_id ? String(job.base_resume_id) : null
    if (!baseResumeId) {
      return NextResponse.json({ error: 'No base resume linked to this job' }, { status: 400 })
    }

    const resumeResult = await conn.runAndReadAll(
      `SELECT file_path FROM resumes WHERE id = '${baseResumeId}'`,
    )
    const resumes = resumeResult.getRowObjects()
    if (!resumes.length) return NextResponse.json({ error: 'Resume not found' }, { status: 404 })

    const resumePath = resolveDataPath(String((resumes[0] as Record<string, unknown>).file_path))
    if (!fs.existsSync(resumePath)) {
      return NextResponse.json({ error: 'Resume file missing on disk' }, { status: 404 })
    }

    const resumeText = await extractPdfText(resumePath)
    const isPixelPerfect = template === 'pixel-perfect'
    const systemPrompt = isPixelPerfect ? PIXEL_PERFECT_PROMPT : MINIMAL_PROMPT

    const prompt = `${systemPrompt}

---
ORIGINAL RESUME TEXT:
${resumeText.slice(0, 16000)}

---
JOB DESCRIPTION:
${job_description}

---
Candidate name hint (for filename): ${candidate_name ?? 'extract from resume'}`

    if (isPixelPerfect) {
      const result = await askClaudeJSON<PixelPerfectResponse>(prompt)
      return NextResponse.json({
        template: 'pixel-perfect',
        output_filename: result.output_filename,
        warnings: result.warnings ?? [],
        replacements: result.replacements ?? [],
        resume_path: resumePath,
      })
    }

    const result = await askClaudeJSON<MinimalResponse>(prompt)
    return NextResponse.json({
      template: 'minimal',
      output_filename: result.output_filename,
      warnings: result.warnings ?? [],
      changes: result.changes ?? [],
      resume: result.resume,
    })
  } catch (err) {
    console.error(err)
    const message = err instanceof Error ? err.message : 'Enhancement failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
