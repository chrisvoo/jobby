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
  ENV_FILE,
} from '@/lib/app-config'
import { DEFAULT_LLM_MODEL } from '@/lib/llm-models'

const CWD = process.cwd()
const DEFAULT_DB = path.join(CWD, 'data', 'app.db')
const DEFAULT_DATA_DIR = path.join(CWD, 'data')

// Snapshot and restore process.env around each test
let envSnapshot: Record<string, string | undefined>

beforeEach(() => {
  vi.resetAllMocks()
  envSnapshot = {
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    LLM_MODEL: process.env.LLM_MODEL,
    TARGET_CURRENCY: process.env.TARGET_CURRENCY,
    GHOSTING_DAYS: process.env.GHOSTING_DAYS,
  }
  delete process.env.GROQ_API_KEY
  delete process.env.LLM_MODEL
  delete process.env.TARGET_CURRENCY
  delete process.env.GHOSTING_DAYS
})

afterEach(() => {
  vi.restoreAllMocks()
  // Restore env vars to their pre-test state
  for (const [k, v] of Object.entries(envSnapshot)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
})

describe('defaultDuckDbPath', () => {
  it('returns path under process.cwd()/data/app.db', () => {
    expect(defaultDuckDbPath()).toBe(DEFAULT_DB)
  })
})

describe('readConfig', () => {
  it('returns defaults when env vars are not set', () => {
    const cfg = readConfig()
    expect(cfg.llm_model).toBe(DEFAULT_LLM_MODEL)
    expect(cfg.target_currency).toBe('EUR')
    expect(cfg.groq_api_key).toBe('')
  })

  it('reads all values from process.env', () => {
    process.env.LLM_MODEL = 'qwen-qwq-32b'
    process.env.TARGET_CURRENCY = 'USD'
    process.env.GROQ_API_KEY = 'gsk_test'

    const cfg = readConfig()
    expect(cfg.llm_model).toBe('qwen-qwq-32b')
    expect(cfg.target_currency).toBe('USD')
    expect(cfg.groq_api_key).toBe('gsk_test')
  })

  it('uses default llm_model when LLM_MODEL is not set', () => {
    process.env.GROQ_API_KEY = 'gsk_test'
    const cfg = readConfig()
    expect(cfg.llm_model).toBe(DEFAULT_LLM_MODEL)
  })

  it('returns empty groq_api_key when GROQ_API_KEY is not set', () => {
    const cfg = readConfig()
    expect(cfg.groq_api_key).toBe('')
  })
})

describe('writeConfig', () => {
  it('writes .env content to ENV_FILE', () => {
    const mockWrite = vi.mocked(fs.writeFileSync)
    const config = { llm_model: DEFAULT_LLM_MODEL, target_currency: 'GBP', groq_api_key: 'gsk_test', ghosting_days: 30 }

    writeConfig(config)

    expect(mockWrite).toHaveBeenCalledOnce()
    const [filePath, content] = mockWrite.mock.calls[0]
    expect(filePath).toBe(ENV_FILE)
    expect(content).toContain('GROQ_API_KEY=gsk_test')
    expect(content).toContain(`LLM_MODEL=${DEFAULT_LLM_MODEL}`)
    expect(content).toContain('TARGET_CURRENCY=GBP')
    expect(content).toContain('GHOSTING_DAYS=30')
  })

  it('updates process.env immediately for in-process effect', () => {
    vi.mocked(fs.writeFileSync)
    writeConfig({ llm_model: 'fast-model', target_currency: 'USD', groq_api_key: 'gsk_new', ghosting_days: 60 })

    expect(process.env.LLM_MODEL).toBe('fast-model')
    expect(process.env.TARGET_CURRENCY).toBe('USD')
    expect(process.env.GROQ_API_KEY).toBe('gsk_new')
    expect(process.env.GHOSTING_DAYS).toBe('60')
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
