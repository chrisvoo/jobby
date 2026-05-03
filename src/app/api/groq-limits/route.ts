import { NextRequest, NextResponse } from 'next/server'
import { lastRateLimits, fetchRateLimits, type RateLimits } from '@/lib/llm'
import { readConfig } from '@/lib/app-config'

export interface GroqLimitsResponse {
  tokens:     { limit: number; remaining: number; resetIn: string }
  requests:   { limit: number; remaining: number; resetIn: string }
  capturedAt: number
  stale?:     true
}

function toResponse(limits: RateLimits): GroqLimitsResponse {
  return {
    tokens:     limits.tokens,
    requests:   limits.requests,
    capturedAt: limits.capturedAt,
  }
}

export async function GET(req: NextRequest) {
  const { groq_api_key } = readConfig()
  if (!groq_api_key) {
    return NextResponse.json({ error: 'no_key' }, { status: 401 })
  }

  const fresh = req.nextUrl.searchParams.get('fresh') === 'true'

  if (fresh) {
    try {
      const limits = await fetchRateLimits()
      return NextResponse.json(toResponse(limits))
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 502 })
    }
  }

  if (!lastRateLimits) {
    return NextResponse.json({ stale: true } satisfies { stale: true })
  }

  return NextResponse.json(toResponse(lastRateLimits))
}
