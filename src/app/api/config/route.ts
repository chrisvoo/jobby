import { NextRequest, NextResponse } from 'next/server'
import { readConfig, writeConfig, defaultDuckDbPath } from '@/lib/app-config'

export async function GET() {
  const config = readConfig()
  // duckdb_path is always computed (never stored); include it for the Config UI display
  return NextResponse.json({ ...config, duckdb_path: defaultDuckDbPath() })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { llm_model, target_currency, groq_api_key } = body as {
    llm_model?: string
    target_currency?: string
    groq_api_key?: string
  }

  const current = readConfig()

  if (target_currency !== undefined) {
    if (!/^[A-Z]{3}$/.test(target_currency)) {
      return NextResponse.json({ error: 'target_currency must be a 3-letter ISO currency code' }, { status: 400 })
    }
  }

  writeConfig({
    llm_model: llm_model ?? current.llm_model,
    target_currency: target_currency ?? current.target_currency,
    groq_api_key: groq_api_key !== undefined ? groq_api_key : current.groq_api_key,
  })

  return NextResponse.json({ success: true })
}
