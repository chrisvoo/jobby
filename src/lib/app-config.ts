import fs from 'fs'
import path from 'path'
import { DEFAULT_CLAUDE_MODEL } from './claude-models'

// Stored at project root — never committed (see .gitignore)
export const CONFIG_FILE = path.join(process.cwd(), 'jobby.config.json')

export interface AppConfig {
  duckdb_path: string
  claude_model: string
  target_currency: string
}

export function defaultDuckDbPath(): string {
  return path.join(process.cwd(), 'data', 'app.db')
}

export function readConfig(): AppConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8')
      const parsed = JSON.parse(raw) as Partial<AppConfig>
      return {
        duckdb_path: parsed.duckdb_path ?? defaultDuckDbPath(),
        claude_model: parsed.claude_model ?? DEFAULT_CLAUDE_MODEL,
        target_currency: parsed.target_currency ?? 'EUR',
      }
    }
  } catch {}
  return { duckdb_path: defaultDuckDbPath(), claude_model: DEFAULT_CLAUDE_MODEL, target_currency: 'EUR' }

}

export function writeConfig(config: AppConfig): void {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2))
}
