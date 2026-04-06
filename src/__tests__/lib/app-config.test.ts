import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import path from 'path'

// Mock fs before importing the module under test
vi.mock('fs')

import fs from 'fs'
import {
  readConfig,
  writeConfig,
  defaultDuckDbPath,
  resolveDataPath,
  CONFIG_FILE,
} from '@/lib/app-config'
import { DEFAULT_CLAUDE_MODEL } from '@/lib/claude-models'

const CWD = process.cwd()
const DEFAULT_DB = path.join(CWD, 'data', 'app.db')
const DEFAULT_DATA_DIR = path.join(CWD, 'data')

beforeEach(() => {
  vi.resetAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('defaultDuckDbPath', () => {
  it('returns path under process.cwd()/data/app.db', () => {
    expect(defaultDuckDbPath()).toBe(DEFAULT_DB)
  })
})

describe('readConfig', () => {
  it('returns defaults when config file does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)

    const cfg = readConfig()
    expect(cfg.duckdb_path).toBe(DEFAULT_DB)
    expect(cfg.claude_model).toBe(DEFAULT_CLAUDE_MODEL)
    expect(cfg.target_currency).toBe('EUR')
  })

  it('returns parsed config when file exists and is valid', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({
        duckdb_path: path.join(CWD, 'data', 'custom.db'),
        claude_model: 'claude-opus-4-6',
        target_currency: 'USD',
      }),
    )

    const cfg = readConfig()
    expect(cfg.duckdb_path).toBe(path.join(CWD, 'data', 'custom.db'))
    expect(cfg.claude_model).toBe('claude-opus-4-6')
    expect(cfg.target_currency).toBe('USD')
  })

  it('falls back to default db path when stored duckdb_path is outside cwd', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({
        duckdb_path: '/some/other/absolute/path/app.db',
        claude_model: DEFAULT_CLAUDE_MODEL,
        target_currency: 'EUR',
      }),
    )

    const cfg = readConfig()
    expect(cfg.duckdb_path).toBe(DEFAULT_DB)
  })

  it('fills missing keys with defaults', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({}))

    const cfg = readConfig()
    expect(cfg.duckdb_path).toBe(DEFAULT_DB)
    expect(cfg.claude_model).toBe(DEFAULT_CLAUDE_MODEL)
    expect(cfg.target_currency).toBe('EUR')
  })

  it('returns defaults when the config file contains malformed JSON', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue('{ not valid json')

    const cfg = readConfig()
    expect(cfg.duckdb_path).toBe(DEFAULT_DB)
    expect(cfg.claude_model).toBe(DEFAULT_CLAUDE_MODEL)
  })
})

describe('writeConfig', () => {
  it('serialises config to JSON and writes it to CONFIG_FILE', () => {
    const mockWrite = vi.mocked(fs.writeFileSync)
    const config = {
      duckdb_path: DEFAULT_DB,
      claude_model: DEFAULT_CLAUDE_MODEL,
      target_currency: 'GBP',
    }

    writeConfig(config)

    expect(mockWrite).toHaveBeenCalledOnce()
    const [filePath, content] = mockWrite.mock.calls[0]
    expect(filePath).toBe(CONFIG_FILE)
    expect(JSON.parse(content as string)).toEqual(config)
  })
})

describe('resolveDataPath', () => {
  it('returns path unchanged when it already starts under cwd', () => {
    const p = path.join(CWD, 'data', 'uploads', 'resumes', 'abc.pdf')
    // resolveDataPath does no fs check if path starts under cwd
    expect(resolveDataPath(p)).toBe(p)
  })

  it('remaps an external path that contains /data/ to the local data dir', () => {
    const externalPath = '/old/host/path/data/uploads/resumes/abc.pdf'
    const expectedResolved = path.join(DEFAULT_DATA_DIR, 'uploads', 'resumes', 'abc.pdf')

    // existsSync: first call is from readConfig (config file check), second is the resolved path check
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      if (p === expectedResolved) return true
      return false
    })
    vi.mocked(fs.readFileSync).mockReturnValue('{}')

    const result = resolveDataPath(externalPath)
    expect(result).toBe(expectedResolved)
  })

  it('returns the original path when the resolved path does not exist', () => {
    const externalPath = '/old/host/path/data/uploads/resumes/missing.pdf'

    vi.mocked(fs.existsSync).mockReturnValue(false)
    vi.mocked(fs.readFileSync).mockReturnValue('{}')

    const result = resolveDataPath(externalPath)
    expect(result).toBe(externalPath)
  })

  it('returns path unchanged when there is no /data/ segment', () => {
    const p = '/some/absolute/path/without/data/segment.pdf'
    vi.mocked(fs.existsSync).mockReturnValue(false)
    vi.mocked(fs.readFileSync).mockReturnValue('{}')

    expect(resolveDataPath(p)).toBe(p)
  })
})
