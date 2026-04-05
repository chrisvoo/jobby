import { NextResponse } from 'next/server'
import { CLAUDE_MODELS, DEFAULT_CLAUDE_MODEL, type ClaudeModel } from '@/lib/claude-models'

const SUPPORT_URL =
  'https://support.claude.com/en/articles/11940350-claude-code-model-configuration'

function detectTier(id: string): ClaudeModel['tier'] {
  if (id.includes('opus'))  return 'high'
  if (id.includes('haiku')) return 'fast'
  return 'balanced'
}

const tierDescription: Record<ClaudeModel['tier'], string> = {
  high:     'Most capable · best quality, slower responses',
  balanced: 'Balanced · recommended',
  fast:     'Fastest · may not be available on all plans',
}

/**
 * Parse Claude model IDs and labels from the raw HTML of the support article.
 *
 * The "Supported models" section contains list items like:
 *   Sonnet 4.6, <code>claude-sonnet-4-6</code>
 *   Opus 4.5,   <code>claude-opus-4-5-20251101</code>
 *
 * After stripping all HTML tags the text becomes:
 *   "Sonnet 4.6, claude-sonnet-4-6"
 *
 * The regex matches "Label X.Y, claude-model-id" (comma separator).
 * It deliberately does NOT match "Label X.Y: claude --model …" (colon separator)
 * which appears in the "Change model for current session" section.
 */
function parseModels(html: string): ClaudeModel[] | null {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi,  ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#?\w+;/g,  ' ')
    .replace(/\s+/g, ' ')
    .trim()

  // Locate the "Supported models" heading and take the next ~2 000 chars —
  // enough for a short bulleted list but short enough to avoid false matches
  // in the command-example sections that follow.
  const idx = text.toLowerCase().indexOf('supported models')
  if (idx === -1) return null
  const chunk = text.slice(idx, idx + 2000)

  // e.g. "Sonnet 4.6, claude-sonnet-4-6" or "Opus 4.5, claude-opus-4-5-20251101"
  const re = /([A-Za-z]+\s+\d+\.\d+(?:\.\d+)?)\s*,\s*(claude-[a-z][a-z0-9-]*)/g
  const seen  = new Set<string>()
  const models: ClaudeModel[] = []

  let m: RegExpExecArray | null
  while ((m = re.exec(chunk)) !== null) {
    const id = m[2]
    if (seen.has(id)) continue
    seen.add(id)

    const t = detectTier(id)
    models.push({
      id,
      label:       `Claude ${m[1].trim()}`,
      description: tierDescription[t],
      tier:        t,
      isDefault:   id === DEFAULT_CLAUDE_MODEL,
    })
  }

  return models.length > 0 ? models : null
}

export async function GET() {
  try {
    const res = await fetch(SUPPORT_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Jobby/1.0)' },
      signal: AbortSignal.timeout(10_000),
      cache:  'no-store',
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const html   = await res.text()
    const parsed = parseModels(html)

    if (!parsed || parsed.length === 0) {
      return NextResponse.json({
        models: CLAUDE_MODELS,
        source: 'fallback',
        error:  'Could not parse model list from support page — using built-in fallback',
      })
    }

    return NextResponse.json({ models: parsed, source: 'live' })
  } catch (err) {
    console.error('[/api/claude-models] Fetch failed:', err)
    return NextResponse.json({
      models: CLAUDE_MODELS,
      source: 'fallback',
      error:  String(err),
    })
  }
}
