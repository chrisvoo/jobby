import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { readConfig, writeConfig } from '@/lib/app-config'

export async function GET() {
  const config = readConfig()
  return NextResponse.json(config)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    duckdb_path,
    llm_model,
    target_currency,
    groq_api_key,
  } = body as {
    duckdb_path?: string
    llm_model?: string
    target_currency?: string
    groq_api_key?: string
  }

  const current = readConfig()

  if (duckdb_path !== undefined) {
    if (!duckdb_path || typeof duckdb_path !== 'string') {
      return NextResponse.json({ error: 'duckdb_path is required' }, { status: 400 })
    }

    const dir = path.dirname(duckdb_path)

    if (!fs.existsSync(dir)) {
      return NextResponse.json({ error: `Directory does not exist: ${dir}` }, { status: 400 })
    }

    try {
      fs.accessSync(dir, fs.constants.W_OK)
    } catch {
      return NextResponse.json({ error: `Directory is not writable: ${dir}` }, { status: 400 })
    }
  }

  if (target_currency !== undefined) {
    if (!/^[A-Z]{3}$/.test(target_currency)) {
      return NextResponse.json({ error: 'target_currency must be a 3-letter ISO currency code' }, { status: 400 })
    }
  }

  writeConfig({
    duckdb_path: duckdb_path ?? current.duckdb_path,
    llm_model: llm_model ?? current.llm_model,
    target_currency: target_currency ?? current.target_currency,
    groq_api_key: groq_api_key !== undefined ? groq_api_key : current.groq_api_key,
  })

  return NextResponse.json({
    success: true,
    restart_required: duckdb_path !== undefined && duckdb_path !== current.duckdb_path,
  })
}
