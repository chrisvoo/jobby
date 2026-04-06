'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Database, Folder, ChevronRight, ArrowUp, X,
  Check, AlertTriangle, RotateCcw, Loader2, Bot, RefreshCw,
  DollarSign, ChevronDown,
} from 'lucide-react'
import { toast } from 'sonner'
import { CLAUDE_MODELS, DEFAULT_CLAUDE_MODEL, type ClaudeModel } from '@/lib/claude-models'

// ── localStorage model cache ─────────────────────────────────────

const MODELS_CACHE_KEY = 'jobby_claude_models_cache'
const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000

interface ModelsCache {
  models: ClaudeModel[]
  fetchedAt: number
  source: 'live' | 'fallback'
}

function readModelsCache(): ModelsCache | null {
  try {
    const raw = localStorage.getItem(MODELS_CACHE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as ModelsCache
  } catch {
    return null
  }
}

function writeModelsCache(cache: ModelsCache) {
  try {
    localStorage.setItem(MODELS_CACHE_KEY, JSON.stringify(cache))
  } catch {}
}

function formatAge(ts: number): string {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return d < 30 ? `${d}d ago` : 'over a month ago'
}

// ── Tier visuals ─────────────────────────────────────────────────

const tierStyle: Record<ClaudeModel['tier'], string> = {
  high:     'bg-violet-500/15 text-violet-300 border border-violet-500/25',
  balanced: 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/25',
  fast:     'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25',
}
const tierLabel: Record<ClaudeModel['tier'], string> = {
  high: 'Powerful', balanced: 'Balanced', fast: 'Fast',
}

// ── Breadcrumb helpers ───────────────────────────────────────────

interface BrowseResult {
  path: string
  parent: string
  is_root: boolean
  dirs: string[]
  error?: string
}

function pathSegments(p: string) {
  const parts = p.split('/').filter(Boolean)
  return [
    { label: '/', path: '/' },
    ...parts.map((part, i) => ({
      label: part,
      path: '/' + parts.slice(0, i + 1).join('/'),
    })),
  ]
}

function dirOf(filePath: string): string {
  const lastSlash = filePath.lastIndexOf('/')
  return lastSlash > 0 ? filePath.slice(0, lastSlash) : '/'
}

// ── Currency combobox ────────────────────────────────────────────

interface CurrencyComboboxProps {
  value: string
  onChange: (code: string) => void
  currencies: Record<string, string>
  loading: boolean
  id?: string
}

function CurrencyCombobox({ value, onChange, currencies, loading, id }: CurrencyComboboxProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const entries = Object.entries(currencies)
  const filtered = query
    ? entries.filter(([code, name]) =>
        code.toLowerCase().includes(query.toLowerCase()) ||
        name.toLowerCase().includes(query.toLowerCase()),
      )
    : entries

  const displayLabel = value
    ? `${value}${currencies[value] ? ` — ${currencies[value]}` : ''}`
    : ''

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  function select(code: string) {
    onChange(code)
    setOpen(false)
    setQuery('')
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        id={id}
        type="button"
        onClick={() => {
          setOpen((o) => !o)
          if (!open) setTimeout(() => inputRef.current?.focus(), 50)
        }}
        className="w-full flex items-center justify-between gap-2 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-left transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 hover:border-zinc-600"
      >
        {loading ? (
          <span className="flex items-center gap-2 text-zinc-500">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />Loading currencies…
          </span>
        ) : (
          <span className={value ? 'text-zinc-100 font-mono' : 'text-zinc-500'}>
            {displayLabel || 'Select a currency'}
          </span>
        )}
        <ChevronDown className="w-4 h-4 text-zinc-500 shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden">
          <div className="p-2 border-b border-zinc-800">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by code or name…"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <li className="px-3 py-4 text-center text-zinc-500 text-sm">No currencies found</li>
            )}
            {filtered.map(([code, name]) => (
              <li key={code}>
                <button
                  type="button"
                  onClick={() => select(code)}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm text-left transition-colors hover:bg-zinc-800 ${
                    code === value ? 'text-indigo-300 bg-indigo-500/10' : 'text-zinc-200'
                  }`}
                >
                  <span className="font-mono w-10 shrink-0 text-zinc-400">{code}</span>
                  <span className="truncate">{name}</span>
                  {code === value && <Check className="w-3.5 h-3.5 ml-auto shrink-0 text-indigo-400" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ── Config page ──────────────────────────────────────────────────

export default function ConfigPage() {
  // ── Database settings ──────────────────────────────────────────
  const [duckdbPath, setDuckdbPath] = useState('')
  const [savedPath, setSavedPath]   = useState('')
  const [saving, setSaving]         = useState(false)
  const [restartRequired, setRestartRequired] = useState(false)

  // ── Claude model settings ──────────────────────────────────────
  const [claudeModel, setClaudeModel] = useState(DEFAULT_CLAUDE_MODEL)
  const [savedModel, setSavedModel]   = useState(DEFAULT_CLAUDE_MODEL)
  const [models, setModels]           = useState<ClaudeModel[]>(CLAUDE_MODELS)
  const [modelsLoading, setModelsLoading] = useState(false)
  const [modelsLastSync, setModelsLastSync] = useState<number | null>(null)
  const [modelsSource, setModelsSource]     = useState<'live' | 'fallback' | null>(null)

  // ── Currency settings ──────────────────────────────────────────
  const [targetCurrency, setTargetCurrency] = useState('EUR')
  const [savedCurrency, setSavedCurrency]   = useState('EUR')
  const [currencies, setCurrencies]         = useState<Record<string, string>>({})
  const [currenciesLoading, setCurrenciesLoading] = useState(false)

  // ── Directory browser ──────────────────────────────────────────
  const [browseOpen, setBrowseOpen]     = useState(false)
  const [browseData, setBrowseData]     = useState<BrowseResult | null>(null)
  const [browseLoading, setBrowseLoading] = useState(false)

  // ── Fetch currency list ────────────────────────────────────────
  useEffect(() => {
    setCurrenciesLoading(true)
    fetch('/api/rates?currencies=true')
      .then((r) => r.json())
      .then((data: Record<string, string>) => setCurrencies(data))
      .catch(() => {})
      .finally(() => setCurrenciesLoading(false))
  }, [])

  // ── Fetch model list from support page (or serve from cache) ───
  const fetchModels = useCallback(async (force = false) => {
    if (!force) {
      const cached = readModelsCache()
      if (cached && Date.now() - cached.fetchedAt < ONE_MONTH_MS) {
        setModels(cached.models)
        setModelsLastSync(cached.fetchedAt)
        setModelsSource(cached.source)
        return
      }
    }

    setModelsLoading(true)
    try {
      const res  = await fetch('/api/claude-models')
      const data = await res.json() as { models: ClaudeModel[]; source: 'live' | 'fallback'; error?: string }
      const cache: ModelsCache = { models: data.models, fetchedAt: Date.now(), source: data.source }
      writeModelsCache(cache)
      setModels(data.models)
      setModelsLastSync(cache.fetchedAt)
      setModelsSource(data.source)
      if (data.source === 'fallback') {
        toast.warning(data.error ?? 'Could not reach support page — using built-in list')
      } else {
        if (force) toast.success(`Model list refreshed (${data.models.length} models)`)
      }
    } catch {
      toast.error('Failed to fetch model list')
    } finally {
      setModelsLoading(false)
    }
  }, [])

  // ── Load config + model list on mount ─────────────────────────
  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((data) => {
        setDuckdbPath(data.duckdb_path ?? '')
        setSavedPath(data.duckdb_path ?? '')
        setClaudeModel(data.claude_model ?? DEFAULT_CLAUDE_MODEL)
        setSavedModel(data.claude_model ?? DEFAULT_CLAUDE_MODEL)
        setTargetCurrency(data.target_currency ?? 'EUR')
        setSavedCurrency(data.target_currency ?? 'EUR')
      })
      .catch(() => {})

    fetchModels(false)
  }, [fetchModels])

  // ── Save ───────────────────────────────────────────────────────
  async function save() {
    setSaving(true)
    try {
      const res  = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          duckdb_path: duckdbPath,
          claude_model: claudeModel,
          target_currency: targetCurrency,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSavedPath(duckdbPath)
      setSavedModel(claudeModel)
      setSavedCurrency(targetCurrency)
      setRestartRequired(data.restart_required ?? false)
      toast.success('Configuration saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  // ── Directory browser ──────────────────────────────────────────
  const fetchDir = useCallback(async (p: string) => {
    setBrowseLoading(true)
    try {
      const res  = await fetch(`/api/browse?path=${encodeURIComponent(p)}`)
      const data: BrowseResult = await res.json()
      setBrowseData(data)
    } catch {
      setBrowseData({ path: p, parent: p, is_root: false, dirs: [], error: 'Failed to read directory' })
    } finally {
      setBrowseLoading(false)
    }
  }, [])

  function openBrowse() {
    setBrowseOpen(true)
    fetchDir(duckdbPath ? dirOf(duckdbPath) : '~')
  }

  function selectDirectory() {
    if (!browseData) return
    setDuckdbPath(`${browseData.path}/app.db`)
    setBrowseOpen(false)
  }

  const isDirty =
    duckdbPath !== savedPath ||
    claudeModel !== savedModel ||
    targetCurrency !== savedCurrency

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-100">Configuration</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Settings are saved in <code className="text-zinc-400 bg-zinc-800 px-1 rounded">jobby.config.json</code> at the project root.
        </p>
      </div>

      {/* ── Database ── */}
      <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center gap-3">
          <Database className="w-4 h-4 text-yellow-400" />
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Database</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Where Jobby stores its DuckDB file</p>
          </div>
        </div>
        <div className="px-5 py-5">
          <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">
            DuckDB File Path
          </label>
          <div className="flex gap-2">
            <input
              value={duckdbPath}
              onChange={(e) => setDuckdbPath(e.target.value)}
              className={inputCls}
              placeholder="/path/to/data/app.db"
              spellCheck={false}
            />
            <button
              onClick={openBrowse}
              className="shrink-0 inline-flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-zinc-300 text-sm transition-colors"
            >
              <Folder className="w-4 h-4" />
              Browse
            </button>
          </div>
          <p className="text-xs text-zinc-600 mt-2">
            Default: <code className="text-zinc-500">&lt;project&gt;/data/app.db</code>
          </p>
        </div>
      </section>

      {/* ── Claude Model ── */}
      <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Bot className="w-4 h-4 text-indigo-400 shrink-0" />
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">Claude Model</h2>
              {modelsLastSync ? (
                <p className="text-xs mt-0.5">
                  <span className={modelsSource === 'live' ? 'text-emerald-500/80' : 'text-amber-500/80'}>
                    {modelsSource === 'live' ? 'Live' : 'Fallback'}
                  </span>
                  <span className="text-zinc-600"> · synced {formatAge(modelsLastSync)} from support.claude.com</span>
                </p>
              ) : (
                <p className="text-xs text-zinc-500 mt-0.5">Which model Jobby uses for AI tasks</p>
              )}
            </div>
          </div>
          <button
            onClick={() => fetchModels(true)}
            disabled={modelsLoading}
            title="Rescan support.claude.com for the latest model list"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-200 disabled:opacity-50 transition-colors px-2 py-1.5 rounded-lg hover:bg-zinc-800"
          >
            {modelsLoading
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <RefreshCw className="w-3.5 h-3.5" />
            }
            Rescan
          </button>
        </div>

        <div className="px-5 py-4 space-y-2">
          {modelsLoading && models.length === 0 ? (
            <div className="py-8 flex items-center justify-center gap-2 text-zinc-500 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Fetching model list…
            </div>
          ) : (
            models.map((m) => (
              <button
                key={m.id}
                onClick={() => setClaudeModel(m.id)}
                className={`w-full flex items-start gap-4 px-4 py-3 rounded-lg border transition-all text-left ${
                  claudeModel === m.id
                    ? 'bg-indigo-600/10 border-indigo-500/50 ring-1 ring-inset ring-indigo-500/30'
                    : 'bg-zinc-800/40 border-zinc-700/60 hover:border-zinc-600 hover:bg-zinc-800'
                }`}
              >
                <span className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  claudeModel === m.id ? 'border-indigo-400' : 'border-zinc-600'
                }`}>
                  {claudeModel === m.id && <span className="w-2 h-2 rounded-full bg-indigo-400" />}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-medium ${claudeModel === m.id ? 'text-zinc-100' : 'text-zinc-300'}`}>
                      {m.label}
                    </span>
                    {m.isDefault && (
                      <span className="text-[10px] font-semibold uppercase tracking-wide bg-zinc-700 text-zinc-400 px-1.5 py-0.5 rounded">
                        default
                      </span>
                    )}
                    <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${tierStyle[m.tier]}`}>
                      {tierLabel[m.tier]}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">{m.description}</p>
                </div>
              </button>
            ))
          )}

          {!modelsLoading && !models.find((m) => m.id === claudeModel) && claudeModel && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-zinc-700/60 bg-zinc-800/40">
              <span className="mt-0.5 w-4 h-4 rounded-full border-2 border-indigo-400 flex items-center justify-center shrink-0">
                <span className="w-2 h-2 rounded-full bg-indigo-400" />
              </span>
              <div>
                <p className="text-sm font-medium text-zinc-300">{claudeModel}</p>
                <p className="text-xs text-zinc-500">Custom model — not in the current list</p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Currency ── */}
      <section className="bg-zinc-900 border border-zinc-800 rounded-xl">
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center gap-3 rounded-t-xl">
          <DollarSign className="w-4 h-4 text-emerald-400" />
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Currency</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Default target currency for salary conversion</p>
          </div>
        </div>
        <div className="px-5 py-5">
          <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">
            Target Currency
          </label>
          <CurrencyCombobox
            value={targetCurrency}
            onChange={setTargetCurrency}
            currencies={currencies}
            loading={currenciesLoading}
          />
          <p className="text-xs text-zinc-600 mt-2">
            Used as the default "convert to" currency in the Utils page. Rates sourced from{' '}
            <a
              href="https://www.frankfurter.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-500 hover:text-zinc-300 underline"
            >
              Frankfurter
            </a>{' '}
            (ECB + 40+ central banks, no API key required).
          </p>
        </div>
      </section>

      {/* ── Unified save ── */}
      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving || !isDirty}
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors"
        >
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        {isDirty && (
          <button
            onClick={() => {
              setDuckdbPath(savedPath)
              setClaudeModel(savedModel)
              setTargetCurrency(savedCurrency)
              setRestartRequired(false)
            }}
            className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
        )}
      </div>

      {restartRequired && !isDirty && (
        <div className="flex items-start gap-2.5 bg-amber-500/10 border border-amber-500/25 rounded-lg px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-300/90">
            Restart the dev server (<code className="text-amber-200 bg-amber-500/10 px-1 rounded">npm run dev</code>) for the new database path to take effect.
          </p>
        </div>
      )}

      {/* ── Directory browser modal ── */}
      {browseOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 z-50" onClick={() => setBrowseOpen(false)} />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none">
            <div
              className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-lg shadow-2xl flex flex-col pointer-events-auto"
              style={{ maxHeight: '70vh' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 shrink-0">
                <h3 className="text-sm font-semibold text-zinc-100">Choose Directory</h3>
                <button onClick={() => setBrowseOpen(false)} className="text-zinc-500 hover:text-zinc-300 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-5 py-2.5 border-b border-zinc-800 shrink-0 overflow-x-auto">
                <div className="flex items-center gap-0.5 text-xs text-zinc-400 whitespace-nowrap min-w-0">
                  {browseData
                    ? pathSegments(browseData.path).map((seg, i, arr) => (
                        <span key={seg.path} className="flex items-center gap-0.5">
                          {i > 0 && <ChevronRight className="w-3 h-3 text-zinc-700 shrink-0" />}
                          <button
                            onClick={() => fetchDir(seg.path)}
                            className={i === arr.length - 1 ? 'text-zinc-200 font-medium cursor-default' : 'hover:text-zinc-100 transition-colors'}
                          >
                            {seg.label}
                          </button>
                        </span>
                      ))
                    : <span className="text-zinc-600">Loading…</span>
                  }
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2">
                {browseLoading ? (
                  <div className="py-10 flex items-center justify-center gap-2 text-zinc-500 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" />Loading…
                  </div>
                ) : browseData?.error ? (
                  <div className="py-10 text-center text-red-400 text-sm px-4">{browseData.error}</div>
                ) : (
                  <div>
                    {!browseData?.is_root && (
                      <button
                        onClick={() => browseData && fetchDir(browseData.parent)}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors text-sm"
                      >
                        <ArrowUp className="w-4 h-4 shrink-0 text-zinc-600" />
                        <span className="text-zinc-500">..</span>
                      </button>
                    )}
                    {browseData?.dirs.length === 0 && (
                      <p className="py-6 text-center text-zinc-600 text-sm">No subdirectories</p>
                    )}
                    {browseData?.dirs.map((dir) => (
                      <button
                        key={dir}
                        onClick={() => browseData && fetchDir(`${browseData.path}/${dir}`)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm text-left ${
                          dir.startsWith('.') ? 'text-zinc-600 hover:bg-zinc-800 hover:text-zinc-400' : 'text-zinc-200 hover:bg-zinc-800'
                        }`}
                      >
                        <Folder className={`w-4 h-4 shrink-0 ${dir.startsWith('.') ? 'text-zinc-700' : 'text-yellow-500/60'}`} />
                        {dir}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="px-5 py-4 border-t border-zinc-800 shrink-0 space-y-3">
                <div className="text-xs font-mono text-zinc-500 break-all">
                  {browseData?.path ?? '—'}<span className="text-zinc-700">/app.db</span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setBrowseOpen(false)}
                    className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors px-3 py-2"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={selectDirectory}
                    disabled={!browseData || !!browseData.error}
                    className="flex-1 inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors"
                  >
                    <Check className="w-4 h-4" />
                    Use this directory
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

const inputCls =
  'flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 placeholder-zinc-500 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-colors w-full'
