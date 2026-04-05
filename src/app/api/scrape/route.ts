import { NextRequest, NextResponse } from 'next/server'
import { askClaudeJSON } from '@/lib/claude'

interface JobFields {
  company: string
  role: string
  salary_min?: number
  salary_max?: number
  description: string
}

const PROMPT_TEMPLATE = (text: string) => `Extract structured information from the following job posting text.

Respond with ONLY a valid JSON object — no markdown fences, no explanation:
{
  "company": "company name or empty string if not found",
  "role": "job title",
  "salary_min": null or integer (annual gross, in the currency mentioned — omit currency symbol),
  "salary_max": null or integer,
  "description": "concise 3-5 sentence summary of the role, key responsibilities, and must-have requirements"
}

Job posting text:
---
${text.slice(0, 8000)}`

// Ashby: https://jobs.ashbyhq.com/{board}/{jobId}
// Uses the public posting API: GET /posting-api/job-board/{board}?includeCompensation=true
async function tryAshby(url: string): Promise<JobFields | null> {
  const match = url.match(/ashbyhq\.com\/([^/?#]+)\/([0-9a-f-]{36})/i)
  if (!match) return null

  const [, board, jobId] = match
  const apiUrl = `https://api.ashbyhq.com/posting-api/job-board/${board}?includeCompensation=true`
  const res = await fetch(apiUrl, { signal: AbortSignal.timeout(10_000) })
  if (!res.ok) throw new Error(`Ashby API returned HTTP ${res.status}`)

  const data = await res.json()
  const job = (data.jobs ?? []).find((j: { id: string }) => j.id === jobId)
  if (!job) throw new Error(`Job not found in Ashby board "${board}"`)

  const rawDesc: string = job.descriptionPlain ?? job.descriptionHtml ?? ''
  const text = rawDesc.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

  return {
    company: board.charAt(0).toUpperCase() + board.slice(1),
    role: job.title ?? '',
    salary_min: job.compensation?.compensationTierSummary?.minValue ?? undefined,
    salary_max: job.compensation?.compensationTierSummary?.maxValue ?? undefined,
    description: text.slice(0, 1500),
  }
}

function extractTextFromHtml(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function POST(req: NextRequest) {
  try {
    const { url, text } = await req.json()
    if (!url && !text) return NextResponse.json({ error: 'url or text required' }, { status: 400 })

    // Text-only path: extract fields from a pasted description using a lighter model
    if (!url) {
      const fields = await askClaudeJSON<JobFields>(PROMPT_TEMPLATE(text), 'claude-3-5-haiku-20241022')
      return NextResponse.json(fields)
    }

    // Try native APIs for known SPA job boards first
    const native = await tryAshby(url)
    if (native) return NextResponse.json(native)

    // Generic HTML fetch
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Jobby/1.0)' },
      signal: AbortSignal.timeout(10_000),
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch URL: HTTP ${response.status}` },
        { status: 400 },
      )
    }

    const html = await response.text()
    const pageText = extractTextFromHtml(html)

    if (pageText.length < 200) {
      return NextResponse.json(
        { error: 'This page requires JavaScript to render. Please paste the job description manually.' },
        { status: 400 },
      )
    }

    const fields = await askClaudeJSON<JobFields>(PROMPT_TEMPLATE(pageText), 'claude-3-5-haiku-20241022')
    return NextResponse.json(fields)
  } catch (err) {
    console.error(err)
    const message = err instanceof Error ? err.message : 'Scrape failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
