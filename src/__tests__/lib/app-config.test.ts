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
import { DEFAULT_LLM_MODEL } from '@/lib/llm-models'

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
    expect(cfg.llm_model).toBe(DEFAULT_LLM_MODEL)
    expect(cfg.target_currency).toBe('EUR')
    expect(cfg.groq_api_key).toBe('')
  })

  it('returns parsed config when file exists and is valid', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({
        duckdb_path: path.join(CWD, 'data', 'custom.db'),
        llm_model: 'qwen-qwq-32b',
        target_currency: 'USD',
        groq_api_key: 'gsk_test',
      }),
    )

    const cfg = readConfig()
    expect(cfg.duckdb_path).toBe(path.join(CWD, 'data', 'custom.db'))
    expect(cfg.llm_model).toBe('qwen-qwq-32b')
    expect(cfg.target_currency).toBe('USD')
    expect(cfg.groq_api_key).toBe('gsk_test')
  })

  it('falls back to default db path when stored duckdb_path is outside cwd', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({
        duckdb_path: '/some/other/absolute/path/app.db',
        llm_model: DEFAULT_LLM_MODEL,
        target_currency: 'EUR',
        groq_api_key: '',
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
    expect(cfg.llm_model).toBe(DEFAULT_LLM_MODEL)
    expect(cfg.target_currency).toBe('EUR')
    expect(cfg.groq_api_key).toBe('')
  })

  it('returns defaults when the config file contains malformed JSON', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue('{ not valid json')

    const cfg = readConfig()
    expect(cfg.duckdb_path).toBe(DEFAULT_DB)
    expect(cfg.llm_model).toBe(DEFAULT_LLM_MODEL)
  })
})

describe('writeConfig', () => {
  it('serialises config to JSON and writes it to CONFIG_FILE', () => {
    const mockWrite = vi.mocked(fs.writeFileSync)
    const config = {
      duckdb_path: DEFAULT_DB,
      llm_model: DEFAULT_LLM_MODEL,
      target_currency: 'GBP',
      groq_api_key: 'gsk_test',
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
    expect(resolveDataPath(p)).toBe(p)
  })

  it('remaps an external path that contains /data/ to the local data dir', () => {
    const externalPath = '/old/host/path/data/uploads/resumes/abc.pdf'
    const expectedResolved = path.join(DEFAULT_DATA_DIR, 'uploads', 'resumes', 'abc.pdf')

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
