import { NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { LLM_MODELS, DEFAULT_LLM_MODEL, type LLMModel } from '@/lib/llm-models'
import { readConfig } from '@/lib/app-config'

// Models to exclude — audio/speech, not chat-capable
const EXCLUDED_PREFIXES = ['whisper', 'distil-whisper', 'playai']
const EXCLUDED_EXACT = new Set(['playai-tts', 'playai-tts-arabic'])

function isChatModel(id: string): boolean {
  const lower = id.toLowerCase()
  if (EXCLUDED_EXACT.has(lower)) return false
  return !EXCLUDED_PREFIXES.some((p) => lower.startsWith(p))
}

function detectTier(id: string): LLMModel['tier'] {
  if (id.includes('70b') || id.includes('72b') || id.includes('405b') || id.includes('123b') || id.includes('120b')) return 'high'
  if (id.includes('8b') || id.includes('7b') || id.includes('instant')) return 'fast'
  return 'balanced'
}

function humanLabel(id: string): string {
  // Use the static list label if available
  const known = LLM_MODELS.find((m) => m.id === id)
  if (known) return known.label
  // Otherwise prettify the id: llama-3.3-70b-versatile -> Llama 3.3 70b Versatile
  return id
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

const tierDescription: Record<LLMModel['tier'], string> = {
  high:     'Most capable · best quality, slower responses',
  balanced: 'Balanced · recommended',
  fast:     'Fastest · best for simple tasks',
}

export async function GET() {
  const { groq_api_key } = readConfig()

  if (!groq_api_key) {
    return NextResponse.json({ models: LLM_MODELS, source: 'fallback', error: 'Groq API key not configured' })
  }

  try {
    const client = new Groq({ apiKey: groq_api_key })
    const list = await client.models.list()

    const models: LLMModel[] = list.data
      .filter((m) => isChatModel(m.id))
      .map((m) => {
        const tier = detectTier(m.id)
        return {
          id: m.id,
          label: humanLabel(m.id),
          description: tierDescription[tier],
          tier,
          isDefault: m.id === DEFAULT_LLM_MODEL,
        }
      })
      .sort((a, b) => {
        // Put the default first, then sort by tier (high > balanced > fast), then alphabetically
        if (a.isDefault) return -1
        if (b.isDefault) return 1
        const tierOrder = { high: 0, balanced: 1, fast: 2 }
        return tierOrder[a.tier] - tierOrder[b.tier] || a.label.localeCompare(b.label)
      })

    if (models.length === 0) {
      return NextResponse.json({ models: LLM_MODELS, source: 'fallback', error: 'No chat models found in API response' })
    }

    return NextResponse.json({ models, source: 'live' })
  } catch (err) {
    console.error('[/api/llm-models] Fetch failed:', err)
    return NextResponse.json({ models: LLM_MODELS, source: 'fallback', error: String(err) })
  }
}
