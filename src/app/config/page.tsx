'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Database,
  Check, RotateCcw, Loader2, Bot, RefreshCw,
  DollarSign, ChevronDown, Key, Eye, EyeOff, Activity,
} from 'lucide-react'
import { toast } from 'sonner'
import { LLM_MODELS, DEFAULT_LLM_MODEL, type LLMModel } from '@/lib/llm-models'

// ── localStorage model cache ─────────────────────────────────────

const MODELS_CACHE_KEY = 'jobby_llm_models_cache'
const ONE_HOUR_MS = 60 * 60 * 1000

interface ModelsCache {
  models: LLMModel[]
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

// ── localStorage rate limits cache ───────────────────────────────

const LIMITS_CACHE_KEY = 'jobby_groq_limits_cache'

interface RateLimitBucket {
  limit: number
  remaining: number
  resetIn: string
}

interface GroqLimitsCache {
  tokens: RateLimitBucket
  requests: RateLimitBucket
  capturedAt: number
}

function readLimitsCache(): GroqLimitsCache | null {
  try {
    const raw = localStorage.getItem(LIMITS_CACHE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as GroqLimitsCache
  } catch {
    return null
  }
}

function writeLimitsCache(data: GroqLimitsCache) {
  try {
    localStorage.setItem(LIMITS_CACHE_KEY, JSON.stringify(data))
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

const tierStyle: Record<LLMModel['tier'], string> = {
  high:     'bg-violet-500/15 text-violet-300 border border-violet-500/25',
  balanced: 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/25',
  fast:     'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25',
}
const tierLabel: Record<LLMModel['tier'], string> = {
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

// ── Usage bar ────────────────────────────────────────────────────

interface UsageBarProps {
  label:  string
  bucket: { limit: number; remaining: number; resetIn: string }
}

// Parse a Groq duration string (e.g. "1m30s", "45s", "185ms") into milliseconds.
// Returns 0 for unrecognised formats.
function parseDurationMs(s: string): number {
  if (!s) return 0
  let ms = 0
  const mins  = s.match(/(\d+)m/)
  const secs  = s.match(/(\d+)s/)
  const millis = s.match(/(\d+)ms/)
  if (mins)   ms += parseInt(mins[1], 10) * 60_000
  // "ms" must be checked before "s" to avoid double-counting
  if (millis) ms += parseInt(millis[1], 10)
  else if (secs) ms += parseInt(secs[1], 10) * 1_000
  return ms
}

function UsageBar({ label, bucket }: UsageBarProps) {
  const used    = bucket.limit - bucket.remaining
  const pct     = bucket.limit > 0 ? Math.min(100, (used / bucket.limit) * 100) : 0
  const barColor =
    pct >= 90 ? 'bg-red-500'
    : pct >= 75 ? 'bg-amber-500'
    : 'bg-emerald-500'

  // Only show "resets in" when the wait is meaningful (≥ 1 s).
  // Sub-second values mean the tiny amount used is already being refilled —
  // showing "resets in 185ms" would be confusing since it's not a window reset.
  const showReset = bucket.resetIn && parseDurationMs(bucket.resetIn) >= 1_000

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium text-zinc-300">{label}</span>
        <span className="text-xs text-zinc-400 font-mono">
          {bucket.remaining.toLocaleString()} / {bucket.limit.toLocaleString()} remaining
        </span>
      </div>
      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showReset && (
        <p className="text-[11px] text-zinc-400 mt-1">resets in {bucket.resetIn}</p>
      )}
    </div>
  )
}

// ── Config page ──────────────────────────────────────────────────

export default function ConfigPage() {
  // ── Database settings (read-only) ─────────────────────────────
  const [duckdbPath, setDuckdbPath] = useState('')

  // ── Groq API key ───────────────────────────────────────────────
  const [groqApiKey, setGroqApiKey]       = useState('')
  const [savedApiKey, setSavedApiKey]     = useState('')
  const [apiKeyVisible, setApiKeyVisible] = useState(false)
  const [apiKeyEditing, setApiKeyEditing] = useState(false)

  // ── LLM model settings ─────────────────────────────────────────
  const [llmModel, setLlmModel]           = useState(DEFAULT_LLM_MODEL)
  const [savedModel, setSavedModel]       = useState(DEFAULT_LLM_MODEL)
  const [models, setModels]               = useState<LLMModel[]>(LLM_MODELS)
  const [modelsLoading, setModelsLoading] = useState(false)
  const [modelsLastSync, setModelsLastSync] = useState<number | null>(null)
  const [modelsSource, setModelsSource]     = useState<'live' | 'fallback' | null>(null)

  // ── Currency settings ──────────────────────────────────────────
  const [targetCurrency, setTargetCurrency] = useState('EUR')
  const [savedCurrency, setSavedCurrency]   = useState('EUR')
  const [currencies, setCurrencies]         = useState<Record<string, string>>({})
  const [currenciesLoading, setCurrenciesLoading] = useState(false)

  // ── Groq rate limits ───────────────────────────────────────────
  const [groqLimits, setGroqLimits]       = useState<GroqLimitsCache | null>(null)
  const [limitsLoading, setLimitsLoading] = useState(false)

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

  // ── Fetch model list from Groq API (or serve from cache) ───────
  const fetchModels = useCallback(async (force = false) => {
    if (!force) {
      const cached = readModelsCache()
      if (cached && Date.now() - cached.fetchedAt < ONE_HOUR_MS) {
        setModels(cached.models)
        setModelsLastSync(cached.fetchedAt)
        setModelsSource(cached.source)
        return
      }
    }

    setModelsLoading(true)
    try {
      const res  = await fetch('/api/llm-models')
      const data = await res.json() as { models: LLMModel[]; source: 'live' | 'fallback'; error?: string }
      const cache: ModelsCache = { models: data.models, fetchedAt: Date.now(), source: data.source }
      writeModelsCache(cache)
      setModels(data.models)
      setModelsLastSync(cache.fetchedAt)
      setModelsSource(data.source)
      if (data.source === 'fallback') {
        toast.warning(data.error ?? 'Could not reach Groq API — using built-in list')
      } else {
        if (force) toast.success(`Model list refreshed (${data.models.length} models)`)
      }
    } catch {
      toast.error('Failed to fetch model list')
    } finally {
      setModelsLoading(false)
    }
  }, [])

  // ── Fetch Groq rate limits (fresh=true spends 1 token) ────────
  const fetchLimits = useCallback(async () => {
    setLimitsLoading(true)
    try {
      const res  = await fetch('/api/groq-limits?fresh=true')
      const data = await res.json() as { tokens: RateLimitBucket; requests: RateLimitBucket; capturedAt: number; stale?: true; error?: string }
      if (!res.ok || data.error) {
        toast.error(data.error === 'no_key' ? 'Set a Groq API key first' : (data.error ?? 'Failed to fetch limits'))
        return
      }
      if (data.stale) return
      const cache: GroqLimitsCache = { tokens: data.tokens, requests: data.requests, capturedAt: data.capturedAt }
      writeLimitsCache(cache)
      setGroqLimits(cache)
    } catch {
      toast.error('Failed to fetch Groq rate limits')
    } finally {
      setLimitsLoading(false)
    }
  }, [])

  // ── Load config + model list on mount ─────────────────────────
  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((data) => {
        setDuckdbPath(data.duckdb_path ?? '')
        setLlmModel(data.llm_model ?? DEFAULT_LLM_MODEL)
        setSavedModel(data.llm_model ?? DEFAULT_LLM_MODEL)
        setTargetCurrency(data.target_currency ?? 'EUR')
        setSavedCurrency(data.target_currency ?? 'EUR')
        setGroqApiKey(data.groq_api_key ?? '')
        setSavedApiKey(data.groq_api_key ?? '')
      })
      .catch(() => {})

    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchModels(false)

    // Load rate limits from localStorage (free — no server call)
    const cached = readLimitsCache()
    if (cached) setGroqLimits(cached)
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
          llm_model: llmModel,
          target_currency: targetCurrency,
          groq_api_key: groqApiKey,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSavedModel(llmModel)
      setSavedCurrency(targetCurrency)
      setSavedApiKey(groqApiKey)
      setApiKeyEditing(false)
      toast.success('Configuration saved')
      // Refresh model list after saving key (key may have changed)
      fetchModels(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  function maskedKey(key: string): string {
    if (!key) return ''
    if (key.length <= 8) return '••••••••'
    return `${key.slice(0, 4)}…${key.slice(-4)}`
  }

  const isDirty =
    llmModel !== savedModel ||
    targetCurrency !== savedCurrency ||
    groqApiKey !== savedApiKey

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
            <p className="text-xs text-zinc-400 mt-0.5">
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
          <p className="text-xs text-zinc-400 mt-2">
            This path is managed automatically. Data is stored under <code className="text-zinc-500">./data/</code> relative to the project root.
          </p>
        </div>
      </section>

      {/* ── Groq API Key ── */}
      <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center gap-3">
          <Key className="w-4 h-4 text-orange-400" />
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Groq API Key</h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Required for AI resume enhancement and job description parsing
            </p>
          </div>
        </div>
        <div className="px-5 py-5">
          {apiKeyEditing ? (
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type={apiKeyVisible ? 'text' : 'password'}
                  value={groqApiKey}
                  onChange={(e) => setGroqApiKey(e.target.value)}
                  placeholder="gsk_..."
                  autoFocus
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 pr-10 text-sm font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setApiKeyVisible((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {apiKeyVisible
                    ? <EyeOff className="w-4 h-4" />
                    : <Eye className="w-4 h-4" />
                  }
                </button>
              </div>
              <button
                type="button"
                onClick={() => { setGroqApiKey(savedApiKey); setApiKeyEditing(false) }}
                className="text-xs text-zinc-400 hover:text-zinc-300 px-2 py-2 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm font-mono text-zinc-400">
                {savedApiKey ? maskedKey(savedApiKey) : <span className="text-zinc-600 italic">Not set</span>}
              </div>
              <button
                type="button"
                onClick={() => setApiKeyEditing(true)}
                className="text-xs text-zinc-400 hover:text-zinc-200 border border-zinc-700 hover:border-zinc-500 px-3 py-2 rounded-lg transition-colors"
              >
                {savedApiKey ? 'Change' : 'Set key'}
              </button>
            </div>
          )}
          <p className="text-xs text-zinc-400 mt-2">
            Free API key from{' '}
            <a
              href="https://console.groq.com/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-500 hover:text-zinc-300 underline"
            >
              console.groq.com
            </a>{' '}
            — stored locally in <code className="text-zinc-500">jobby.config.json</code> (never committed).
          </p>
        </div>
      </section>

      {/* ── Groq Usage Limits ── */}
      <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Activity className="w-4 h-4 text-violet-400 shrink-0" />
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">Usage Limits</h2>
              {groqLimits ? (
                <p className="text-xs text-zinc-400 mt-0.5">checked {formatAge(groqLimits.capturedAt)}</p>
              ) : (
                <p className="text-xs text-zinc-400 mt-0.5">Rate limits for the current minute window</p>
              )}
            </div>
          </div>
          <button
            onClick={fetchLimits}
            disabled={limitsLoading || !savedApiKey}
            title={savedApiKey ? 'Fetch current rate limits from Groq' : 'Set a Groq API key first'}
            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-50 transition-colors px-2 py-1.5 rounded-lg hover:bg-zinc-800"
          >
            {limitsLoading
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <RefreshCw className="w-3.5 h-3.5" />
            }
            Check now
          </button>
        </div>

        <div className="px-5 py-5 space-y-5">
          {!savedApiKey ? (
            <p className="text-sm text-zinc-600 italic">Configure your Groq API key first.</p>
          ) : !groqLimits ? (
            <p className="text-sm text-zinc-500">
              No data yet — enhance a resume or click <span className="text-zinc-300">Check now</span>.
            </p>
          ) : (
            <>
              <UsageBar label="Tokens / min"   bucket={groqLimits.tokens} />
              <UsageBar label="Requests / min" bucket={groqLimits.requests} />
            </>
          )}
        </div>
      </section>

      {/* ── AI Model ── */}
      <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Bot className="w-4 h-4 text-indigo-400 shrink-0" />
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">AI Model</h2>
              {modelsLastSync ? (
                <p className="text-xs mt-0.5">
                  <span className={modelsSource === 'live' ? 'text-emerald-500/80' : 'text-amber-500/80'}>
                    {modelsSource === 'live' ? 'Live' : 'Fallback'}
                  </span>
                  <span className="text-zinc-600"> · synced {formatAge(modelsLastSync)} from Groq API</span>
                </p>
              ) : (
                <p className="text-xs text-zinc-400 mt-0.5">Which model Jobby uses for AI tasks</p>
              )}
            </div>
          </div>
          <button
            onClick={() => fetchModels(true)}
            disabled={modelsLoading}
            title="Refresh model list from Groq API"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-50 transition-colors px-2 py-1.5 rounded-lg hover:bg-zinc-800"
          >
            {modelsLoading
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <RefreshCw className="w-3.5 h-3.5" />
            }
            Refresh
          </button>
        </div>

        <div className="px-5 py-4">
          {modelsLoading && models.length === 0 ? (
            <div className="py-8 flex items-center justify-center gap-2 text-zinc-500 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Fetching model list…
            </div>
          ) : (
            <div className="overflow-y-auto max-h-[24rem] space-y-2 pr-1">
              {models.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setLlmModel(m.id)}
                  className={`w-full flex items-start gap-4 px-4 py-3 rounded-lg border transition-all text-left ${
                    llmModel === m.id
                      ? 'bg-indigo-600/10 border-indigo-500/50 ring-1 ring-inset ring-indigo-500/30'
                      : 'bg-zinc-800/40 border-zinc-700/60 hover:border-zinc-600 hover:bg-zinc-800'
                  }`}
                >
                  <span className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    llmModel === m.id ? 'border-indigo-400' : 'border-zinc-600'
                  }`}>
                    {llmModel === m.id && <span className="w-2 h-2 rounded-full bg-indigo-400" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-sm font-medium ${llmModel === m.id ? 'text-zinc-100' : 'text-zinc-300'}`}>
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
                    <p className="text-xs text-zinc-400 mt-0.5">{m.description}</p>
                  </div>
                </button>
              ))}

              {!modelsLoading && !models.find((m) => m.id === llmModel) && llmModel && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-zinc-700/60 bg-zinc-800/40">
                  <span className="mt-0.5 w-4 h-4 rounded-full border-2 border-indigo-400 flex items-center justify-center shrink-0">
                    <span className="w-2 h-2 rounded-full bg-indigo-400" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-zinc-300">{llmModel}</p>
                    <p className="text-xs text-zinc-400">Custom model — not in the current list</p>
                  </div>
                </div>
              )}
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
            <p className="text-xs text-zinc-400 mt-0.5">Default target currency for salary conversion</p>
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
          <p className="text-xs text-zinc-400 mt-2">
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
              setLlmModel(savedModel)
              setTargetCurrency(savedCurrency)
              setGroqApiKey(savedApiKey)
              setApiKeyEditing(false)
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
