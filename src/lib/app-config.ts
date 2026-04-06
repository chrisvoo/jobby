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
  const fallback = defaultDuckDbPath()
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8')
      const parsed = JSON.parse(raw) as Partial<AppConfig>
      let dbPath = parsed.duckdb_path ?? fallback
      const cwd = process.cwd()
      if (dbPath !== fallback && !dbPath.startsWith(cwd + path.sep)) {
        dbPath = fallback
      }
      return {
        duckdb_path: dbPath,
        claude_model: parsed.claude_model ?? DEFAULT_CLAUDE_MODEL,
        target_currency: parsed.target_currency ?? 'EUR',
      }
    }
  } catch {}
  return { duckdb_path: fallback, claude_model: DEFAULT_CLAUDE_MODEL, target_currency: 'EUR' }
}

export function writeConfig(config: AppConfig): void {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2))
}

export function getDataDir(): string {
  return path.dirname(readConfig().duckdb_path)
}

/**
 * Resolves a file path that may have been stored with a different base directory
 * (e.g. a host-absolute path now running inside a Docker container).
 * If the path doesn't start under process.cwd(), extracts the relative portion
 * after "data/" and rebuilds it under the current data directory.
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
