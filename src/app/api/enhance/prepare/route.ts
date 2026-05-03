import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import { getDb } from '@/lib/db'
import { extractPdfText } from '@/lib/pdf-extractor'
import { askLLMJSON } from '@/lib/llm'
import { resolveDataPath } from '@/lib/app-config'
import type { ResumeData } from '@/lib/types'

const MINIMAL_PROMPT = `You are an expert resume writer optimising resumes for both human readers and Applicant Tracking Systems (ATS).

Given an original resume and a job description, produce an improved version of the candidate's resume that:
- Retains ONLY information actually present in the original resume — do not invent experience, skills, or credentials
- IMPORTANT: Include EVERY work experience entry from the original resume in the "experience" array — never omit, merge, or skip any position, regardless of relevance to the target role
- Incorporates relevant keywords and phrases from the job posting naturally
- Uses consistent date formatting throughout (e.g. always "Jan 2020 – Mar 2024")
- Stays ATS-safe: standard fonts, no photos/logos/charts/icons/stars/arrows/checkmarks
- Rewrites bullet points to be achievement-oriented: "Achieved X by doing Y, resulting in Z"
- Keeps language professional, concise, and scannable

For the "changes" array, document EVERY meaningful text change you make — be exhaustive, not selective. Include changes to the summary, each individual bullet point, skill list, certifications, and any other section. A complete resume enhancement should typically produce 10–30 change entries.

Generate the output filename using the format: FirstName_LastName_JobTitle_Resume.pdf

Respond with ONLY a valid JSON object — no markdown fences, no explanation:
{
  "output_filename": "FirstName_LastName_JobTitle_Resume.pdf",
  "warnings": ["list any ATS issues found in the original, e.g. presence of a photo, fancy symbols, non-standard fonts"],
  "changes": [
    {
      "section": "human-readable label identifying where this change is (e.g. 'Summary', 'Experience — Acme Corp', 'Skills', 'Education — MIT', 'Certifications')",
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

interface MinimalResponse {
  output_filename: string
  warnings: string[]
  changes: Array<{ section: string; original_text: string; replacement_text: string; reason: string }>
  resume: ResumeData
}

export async function POST(req: NextRequest) {
  try {
    const { resume_id, job_description, candidate_name } = await req.json()

    if (!resume_id || !job_description) {
      return NextResponse.json({ error: 'resume_id and job_description required' }, { status: 400 })
    }

    const conn = await getDb()

    const resumeResult = await conn.runAndReadAll(
      `SELECT file_path FROM resumes WHERE id = '${resume_id}'`,
    )
    const resumes = resumeResult.getRowObjects()
    if (!resumes.length) return NextResponse.json({ error: 'Resume not found' }, { status: 404 })

    const resumePath = resolveDataPath(String((resumes[0] as Record<string, unknown>).file_path))
    if (!fs.existsSync(resumePath)) {
      return NextResponse.json({ error: 'Resume file missing on disk' }, { status: 404 })
    }

    const resumeText = await extractPdfText(resumePath)

    const prompt = `${MINIMAL_PROMPT}

---
ORIGINAL RESUME TEXT:
${resumeText.slice(0, 16000)}

---
JOB DESCRIPTION:
${job_description}

---
Candidate name hint (for filename): ${candidate_name ?? 'extract from resume'}`

    const result = await askLLMJSON<MinimalResponse>(prompt)
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
