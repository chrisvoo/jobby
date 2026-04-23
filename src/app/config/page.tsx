'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Database,
  Check, RotateCcw, Loader2, Bot, RefreshCw,
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
        className="w-full flex items-center justify-between gap-2 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-left transition-colors focus:outline-hidden focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 hover:border-zinc-600"
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
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/50"
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
  // ── Database settings (read-only) ─────────────────────────────
  const [duckdbPath, setDuckdbPath] = useState('')

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

  const [saving, setSaving] = useState(false)

  // ── Fetch currency list ────────────────────────────────────────
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
        setClaudeModel(data.claude_model ?? DEFAULT_CLAUDE_MODEL)
        setSavedModel(data.claude_model ?? DEFAULT_CLAUDE_MODEL)
        setTargetCurrency(data.target_currency ?? 'EUR')
        setSavedCurrency(data.target_currency ?? 'EUR')
      })
      .catch(() => {})

    // eslint-disable-next-line react-hooks/set-state-in-effect
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
      setSavedModel(claudeModel)
      setSavedCurrency(targetCurrency)
      toast.success('Configuration saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const isDirty =
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

      {/* ── Database (read-only) ── */}
      <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center gap-3">
          <Database className="w-4 h-4 text-yellow-400" />
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Database</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              All data is stored in the <code className="text-zinc-400">./data/</code> directory and persists between runs.
            </p>
          </div>
        </div>
        <div className="px-5 py-5">
          <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">
            DuckDB File Path
          </label>
          <div className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm font-mono text-zinc-400 select-all">
            {duckdbPath || '—'}
          </div>
          <p className="text-xs text-zinc-600 mt-2">
            This path is managed automatically. Data is stored under <code className="text-zinc-500">./data/</code> relative to the project root
            and is bind-mounted into the Docker container.
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
            Used as the default &ldquo;convert to&rdquo; currency in the Utils page. Rates sourced from{' '}
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
              setClaudeModel(savedModel)
              setTargetCurrency(savedCurrency)
            }}
            className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
        )}
      </div>
    </div>
  )
}
