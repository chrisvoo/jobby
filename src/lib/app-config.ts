import fs from 'fs'
import path from 'path'
import { DEFAULT_LLM_MODEL } from './llm-models'

// Config is stored in .env at the project root (gitignored).
// Next.js loads it into process.env at startup; writeConfig() updates process.env
// in-memory for immediate effect and writes .env for persistence across restarts.
export const ENV_FILE = path.join(process.cwd(), '.env')

export const DEFAULT_GHOSTING_DAYS = 45

export interface AppConfig {
  llm_model: string
  target_currency: string
  groq_api_key: string
  ghosting_days: number
}

export function defaultDuckDbPath(): string {
  return path.join(process.cwd(), 'data', 'app.db')
}

export function readConfig(): AppConfig {
  const parsed = parseInt(process.env.GHOSTING_DAYS ?? '', 10)
  return {
    llm_model: process.env.LLM_MODEL || DEFAULT_LLM_MODEL,
    target_currency: process.env.TARGET_CURRENCY || 'EUR',
    groq_api_key: process.env.GROQ_API_KEY || '',
    ghosting_days: Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_GHOSTING_DAYS,
  }
}

export function writeConfig(config: AppConfig): void {
  // Update process.env immediately — current process picks up the change without restart
  process.env.GROQ_API_KEY = config.groq_api_key
  process.env.LLM_MODEL = config.llm_model
  process.env.TARGET_CURRENCY = config.target_currency
  process.env.GHOSTING_DAYS = String(config.ghosting_days)

  // Persist to .env — docker-compose restart and future npm run dev pick it up
  const content = [
    `GROQ_API_KEY=${config.groq_api_key}`,
    `LLM_MODEL=${config.llm_model}`,
    `TARGET_CURRENCY=${config.target_currency}`,
    `GHOSTING_DAYS=${config.ghosting_days}`,
    '',
  ].join('\n')
  fs.writeFileSync(ENV_FILE, content)
}

export function getDataDir(): string {
  return path.dirname(defaultDuckDbPath())
}

/**
 * Resolves a file path that may have been stored with a different base directory.
 * Handles legacy paths stored when the app ran inside Docker (host-absolute paths
 * that no longer match the current cwd). Kept for backward compatibility.
 */
export function resolveDataPath(storedPath: string): string {
  const cwd = process.cwd()
  if (storedPath.startsWith(cwd + path.sep)) return storedPath

  const marker = `${path.sep}data${path.sep}`
  const idx = storedPath.lastIndexOf(marker)
  if (idx !== -1) {
    const relative = storedPath.slice(idx + marker.length)
    const resolved = path.join(getDataDir(), relative)
    if (fs.existsSync(resolved)) return resolved
  }

  return storedPath
}
