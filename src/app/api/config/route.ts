import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { readConfig, writeConfig } from '@/lib/app-config'

export async function GET() {
  return NextResponse.json(readConfig())
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { duckdb_path?: string; claude_model?: string }

  const current = readConfig()

  // ── Validate duckdb_path ──────────────────────────────────────
  const duckdb_path = body.duckdb_path ?? current.duckdb_path
  const dir = path.dirname(duckdb_path)

  if (!fs.existsSync(dir)) {
    return NextResponse.json({ error: `Directory does not exist: ${dir}` }, { status: 400 })
  }
  try {
    fs.accessSync(dir, fs.constants.W_OK)
  } catch {
    return NextResponse.json({ error: `Directory is not writable: ${dir}` }, { status: 400 })
  }

  // ── Validate claude_model ─────────────────────────────────────
  // Accept any non-empty string starting with "claude-" so that newly released
  // models fetched from the support page are not rejected by a hardcoded list.
  const claude_model = body.claude_model ?? current.claude_model
  if (!claude_model || typeof claude_model !== 'string' || !claude_model.startsWith('claude-')) {
    return NextResponse.json(
      { error: `Invalid model ID "${claude_model}". Must start with "claude-"` },
      { status: 400 },
    )
  }

  writeConfig({ duckdb_path, claude_model })

  const dbPathChanged = duckdb_path !== current.duckdb_path

  return NextResponse.json({ success: true, restart_required: dbPathChanged })
}
