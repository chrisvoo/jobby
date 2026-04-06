'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import {
  ArrowRightLeft, Loader2, AlertCircle, Info,
  ChevronDown, Check, ExternalLink, Settings, RefreshCw,
  TrendingUp, Building2,
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

// ── Types ────────────────────────────────────────────────────────

interface ConversionResult {
  from: string
  to: string
  amount: number
  result: number
  rate: number
  date: string
}

interface RemoteCountry {
  code: string
  name: string
  currency: { code: string; name: string; symbol: string; slug: string }
  region_slug: string
  child_regions: { code: string; name: string; status: string; slug: string }[]
  has_additional_fields: boolean
  availability: string
  original_country_slug: string
}

interface CostBreakdown {
  employer_currency_costs?: {
    annual_gross_salary?: number
    annual_employer_total?: number
    monthly_gross_salary?: number
    monthly_employer_total?: number
    contributions_total?: number
    currency?: string
  }
  country?: { name: string }
}

// ── Currency combobox ────────────────────────────────────────────

interface CurrencyComboboxProps {
  value: string
  onChange: (code: string) => void
  currencies: Record<string, string>
  loading: boolean
  placeholder?: string
  id?: string
}

function CurrencyCombobox({ value, onChange, currencies, loading, placeholder = 'Select currency', id }: CurrencyComboboxProps) {
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

  const label = value ? `${value}${currencies[value] ? ` — ${currencies[value]}` : ''}` : ''

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
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
          </span>
        ) : (
          <span className={value ? 'text-zinc-100 font-mono' : 'text-zinc-500'}>
            {label || placeholder}
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

// ── Country combobox ─────────────────────────────────────────────

interface CountryComboboxProps {
  value: string
  onChange: (slug: string, country: RemoteCountry) => void
  countries: RemoteCountry[]
  loading: boolean
}

function CountryCombobox({ value, onChange, countries, loading }: CountryComboboxProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = query
    ? countries.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()) || c.code.toLowerCase().includes(query.toLowerCase()))
    : countries

  const selected = countries.find((c) => c.region_slug === value)

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

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o)
          if (!open) setTimeout(() => inputRef.current?.focus(), 50)
        }}
        className="w-full flex items-center justify-between gap-2 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-left transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 hover:border-zinc-600"
      >
        {loading ? (
          <span className="flex items-center gap-2 text-zinc-500">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
          </span>
        ) : (
          <span className={selected ? 'text-zinc-100' : 'text-zinc-500'}>
            {selected ? `${selected.name} (${selected.currency.code})` : 'Select a country'}
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
              placeholder="Search country…"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <li className="px-3 py-4 text-center text-zinc-500 text-sm">No countries found</li>
            )}
            {filtered.map((c) => (
              <li key={c.region_slug}>
                <button
                  type="button"
                  onClick={() => { onChange(c.region_slug, c); setOpen(false); setQuery('') }}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm text-left transition-colors hover:bg-zinc-800 ${
                    c.region_slug === value ? 'text-indigo-300 bg-indigo-500/10' : 'text-zinc-200'
                  }`}
                >
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="font-mono text-xs text-zinc-500">{c.currency.code}</span>
                  {c.region_slug === value && <Check className="w-3.5 h-3.5 shrink-0 text-indigo-400" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ── Utils page ───────────────────────────────────────────────────

export default function UtilsPage() {
  // ── Config ─────────────────────────────────────────────────────
  const [defaultTargetCurrency, setDefaultTargetCurrency] = useState('EUR')
  const [hasRemoteToken, setHasRemoteToken] = useState(false)

  // ── Currencies ─────────────────────────────────────────────────
  const [currencies, setCurrencies]           = useState<Record<string, string>>({})
  const [currenciesLoading, setCurrenciesLoading] = useState(false)

  // ── Currency converter ─────────────────────────────────────────
  const [amount, setAmount]       = useState('')
  const [fromCurrency, setFrom]   = useState('')
  const [toCurrency, setTo]       = useState('')
  const [converting, setConverting] = useState(false)
  const [convResult, setConvResult] = useState<ConversionResult | null>(null)
  const [convError, setConvError]   = useState<string | null>(null)

  // ── Cost estimator ─────────────────────────────────────────────
  const [countries, setCountries]         = useState<RemoteCountry[]>([])
  const [countriesLoading, setCountriesLoading] = useState(false)
  const [countriesError, setCountriesError]     = useState<string | null>(null)
  const [selectedRegion, setSelectedRegion]     = useState('')
  const [selectedCountry, setSelectedCountry]   = useState<RemoteCountry | null>(null)
  const [selectedChildRegion, setSelectedChildRegion] = useState('')
  const [grossSalary, setGrossSalary]       = useState('')
  const [employerCurrency, setEmployerCurrency] = useState('')
  const [estimating, setEstimating]         = useState(false)
  const [estimate, setEstimate]             = useState<CostBreakdown | null>(null)
  const [estimateError, setEstimateError]   = useState<string | null>(null)

  // ── Load config + currencies ───────────────────────────────────
  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((data) => {
        const target = data.target_currency ?? 'EUR'
        setDefaultTargetCurrency(target)
        setTo(target)
        setEmployerCurrency(target)
        setHasRemoteToken(!!data.remote_api_token)
      })
      .catch(() => {})

    setCurrenciesLoading(true)
    fetch('/api/rates?currencies=true')
      .then((r) => r.json())
      .then((data: Record<string, string>) => setCurrencies(data))
      .catch(() => {})
      .finally(() => setCurrenciesLoading(false))
  }, [])

  // ── Load Remote countries when token is configured ─────────────
  const loadCountries = useCallback(async () => {
    setCountriesLoading(true)
    setCountriesError(null)
    try {
      const res = await fetch('/api/cost-countries')
      const data = await res.json() as { data?: RemoteCountry[]; error?: string }
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`)
      setCountries((data.data ?? []).filter((c) => c.availability === 'active'))
    } catch (err) {
      setCountriesError(err instanceof Error ? err.message : 'Failed to load countries')
    } finally {
      setCountriesLoading(false)
    }
  }, [])

  useEffect(() => {
    if (hasRemoteToken) loadCountries()
  }, [hasRemoteToken, loadCountries])

  // ── Convert ────────────────────────────────────────────────────
  async function convert() {
    if (!fromCurrency || !toCurrency || !amount) return
    const parsed = parseFloat(amount)
    if (isNaN(parsed) || parsed <= 0) {
      toast.error('Enter a valid positive amount')
      return
    }

    setConverting(true)
    setConvError(null)
    setConvResult(null)

    try {
      const res = await fetch(
        `/api/rates?from=${fromCurrency}&to=${toCurrency}&amount=${parsed}`,
      )
      const data = await res.json() as ConversionResult & { error?: string }
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`)
      setConvResult(data)
    } catch (err) {
      setConvError(err instanceof Error ? err.message : 'Conversion failed')
    } finally {
      setConverting(false)
    }
  }

  // ── Estimate ───────────────────────────────────────────────────
  async function estimate_() {
    if (!selectedRegion || !grossSalary || !employerCurrency) return
    const salary = parseFloat(grossSalary)
    if (isNaN(salary) || salary <= 0) {
      toast.error('Enter a valid gross salary')
      return
    }

    setEstimating(true)
    setEstimateError(null)
    setEstimate(null)

    const regionSlug = selectedChildRegion || selectedRegion

    try {
      const res = await fetch('/api/cost-estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employer_currency_slug: employerCurrency,
          include_benefits: false,
          include_cost_breakdowns: false,
          employments: [
            {
              annual_gross_salary: salary,
              annual_gross_salary_in_employer_currency: salary,
              region_slug: regionSlug,
              employment_term: 'indefinite',
              regional_to_employer_exchange_rate: '1',
              title: 'Employee',
            },
          ],
        }),
      })
      const data = await res.json() as { data?: { estimations?: CostBreakdown[] }; error?: string }
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`)
      const first = data.data?.estimations?.[0] ?? null
      setEstimate(first)
    } catch (err) {
      setEstimateError(err instanceof Error ? err.message : 'Estimation failed')
    } finally {
      setEstimating(false)
    }
  }

  function swapCurrencies() {
    setFrom(toCurrency)
    setTo(fromCurrency)
    setConvResult(null)
  }

  const canConvert = !!fromCurrency && !!toCurrency && !!amount && !converting
  const canEstimate = !!selectedRegion && !!grossSalary && !!employerCurrency && !estimating

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-100">Utils</h1>
        <p className="text-zinc-500 text-sm mt-1">Currency tools to help evaluate job offers</p>
      </div>

      {/* ── Currency Converter ── */}
      <section className="bg-zinc-900 border border-zinc-800 rounded-xl">
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center gap-3 rounded-t-xl">
          <ArrowRightLeft className="w-4 h-4 text-emerald-400" />
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Currency Converter</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Live rates from{' '}
              <a
                href="https://www.frankfurter.dev"
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-400 hover:text-zinc-200 underline"
              >
                Frankfurter
              </a>{' '}
              (ECB + 40+ central banks)
            </p>
          </div>
        </div>

        <div className="px-5 py-5 space-y-4">
          {/* Amount */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">Amount</label>
            <input
              type="number"
              min="0"
              step="any"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setConvResult(null) }}
              onKeyDown={(e) => e.key === 'Enter' && canConvert && convert()}
              placeholder="e.g. 5000"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 placeholder-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-colors"
            />
          </div>

          {/* From / Swap / To */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
            <div>
              <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">From</label>
              <CurrencyCombobox
                value={fromCurrency}
                onChange={(c) => { setFrom(c); setConvResult(null) }}
                currencies={currencies}
                loading={currenciesLoading}
                placeholder="Select currency"
              />
            </div>

            <button
              type="button"
              onClick={swapCurrencies}
              title="Swap currencies"
              className="mb-0.5 p-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-100 hover:border-zinc-600 transition-colors"
            >
              <ArrowRightLeft className="w-4 h-4" />
            </button>

            <div>
              <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">To</label>
              <CurrencyCombobox
                value={toCurrency}
                onChange={(c) => { setTo(c); setConvResult(null) }}
                currencies={currencies}
                loading={currenciesLoading}
                placeholder="Select currency"
              />
            </div>
          </div>

          {/* Convert button */}
          <button
            onClick={convert}
            disabled={!canConvert}
            className="w-full inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white px-4 py-2.5 rounded-lg font-medium text-sm transition-colors"
          >
            {converting && <Loader2 className="w-4 h-4 animate-spin" />}
            {converting ? 'Converting…' : 'Convert'}
          </button>

          {/* Error */}
          {convError && (
            <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/25 rounded-lg px-4 py-3">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">{convError}</p>
            </div>
          )}

          {/* Result */}
          {convResult && (
            <div className="bg-zinc-800/60 border border-zinc-700 rounded-xl p-5 space-y-3">
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="text-3xl font-bold text-zinc-100 tabular-nums">
                  {convResult.result.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                </span>
                <span className="text-lg font-semibold text-zinc-400">{convResult.to}</span>
              </div>
              <div className="flex flex-wrap gap-4 text-xs text-zinc-500">
                <span>
                  <span className="font-mono text-zinc-400">1 {convResult.from}</span>
                  {' = '}
                  <span className="font-mono text-zinc-400">{convResult.rate} {convResult.to}</span>
                </span>
                <span>Rate date: {convResult.date}</span>
              </div>
              <p className="text-xs text-zinc-600">
                {convResult.amount.toLocaleString()} {convResult.from} at the above rate
              </p>
            </div>
          )}

          {/* Default currency note */}
          {defaultTargetCurrency && !toCurrency && (
            <p className="text-xs text-zinc-600">
              Default target currency is <span className="text-zinc-400 font-mono">{defaultTargetCurrency}</span> (set in{' '}
              <Link href="/config" className="text-zinc-500 hover:text-zinc-300 underline">Settings</Link>).
            </p>
          )}
        </div>
      </section>

      {/* ── Employee Cost Estimator ── */}
      <section className="bg-zinc-900 border border-zinc-800 rounded-xl">
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center gap-3 rounded-t-xl">
          <Building2 className="w-4 h-4 text-violet-400" />
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Employee Cost Estimator</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Total employer cost via Remote.com API</p>
          </div>
        </div>

        {!hasRemoteToken ? (
          /* ── No token configured ── */
          <div className="px-5 py-8 flex flex-col items-center gap-4 text-center">
            <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-zinc-500" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-zinc-300">Remote.com API token required</p>
              <p className="text-xs text-zinc-500 max-w-xs">
                This feature calculates mandatory employer costs (taxes, social security, healthcare…) by country. It uses the{' '}
                <a
                  href="https://developer.remote.com/docs/employment-cost-estimation"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zinc-400 hover:text-zinc-200 underline inline-flex items-center gap-0.5"
                >
                  Remote.com Cost Estimation API
                  <ExternalLink className="w-3 h-3" />
                </a>
                , which requires a free API token.
              </p>
            </div>
            <div className="flex gap-3">
              <a
                href="https://developer.remote.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 px-4 py-2 rounded-lg transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Get API token
              </a>
              <Link
                href="/config"
                className="inline-flex items-center gap-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg transition-colors"
              >
                <Settings className="w-3.5 h-3.5" />
                Open Settings
              </Link>
            </div>
          </div>
        ) : (
          /* ── Token configured ── */
          <div className="px-5 py-5 space-y-4">
            {countriesError && (
              <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/25 rounded-lg px-4 py-3">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-red-300">{countriesError}</p>
                  <button
                    onClick={loadCountries}
                    className="mt-1.5 inline-flex items-center gap-1 text-xs text-red-400/80 hover:text-red-300 transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" /> Retry
                  </button>
                </div>
              </div>
            )}

            {/* Country */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">Country</label>
              <CountryCombobox
                value={selectedRegion}
                onChange={(slug, country) => {
                  setSelectedRegion(slug)
                  setSelectedCountry(country)
                  setSelectedChildRegion('')
                  setEstimate(null)
                }}
                countries={countries}
                loading={countriesLoading}
              />
            </div>

            {/* Sub-region (if any) */}
            {selectedCountry && selectedCountry.child_regions.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">
                  Region / State <span className="text-zinc-600 normal-case">(optional)</span>
                </label>
                <select
                  value={selectedChildRegion}
                  onChange={(e) => { setSelectedChildRegion(e.target.value); setEstimate(null) }}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-colors"
                >
                  <option value="">— Use country default —</option>
                  {selectedCountry.child_regions
                    .filter((r) => r.status === 'active')
                    .map((r) => (
                      <option key={r.slug} value={r.slug}>{r.name}</option>
                    ))}
                </select>
              </div>
            )}

            {/* Gross salary */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">
                Annual Gross Salary
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={grossSalary}
                onChange={(e) => { setGrossSalary(e.target.value); setEstimate(null) }}
                placeholder="e.g. 60000"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 placeholder-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-colors"
              />
            </div>

            {/* Employer currency */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">
                Employer Currency
              </label>
              <CurrencyCombobox
                value={employerCurrency}
                onChange={(c) => { setEmployerCurrency(c); setEstimate(null) }}
                currencies={currencies}
                loading={currenciesLoading}
              />
            </div>

            {/* Info note */}
            <div className="flex items-start gap-2 text-xs text-zinc-600">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-zinc-700" />
              <span>Estimates are approximate and may vary from actual hiring costs. Does not include optional benefits.</span>
            </div>

            {/* Estimate button */}
            <button
              onClick={estimate_}
              disabled={!canEstimate}
              className="w-full inline-flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white px-4 py-2.5 rounded-lg font-medium text-sm transition-colors"
            >
              {estimating && <Loader2 className="w-4 h-4 animate-spin" />}
              {estimating ? 'Estimating…' : 'Estimate total cost'}
            </button>

            {/* Error */}
            {estimateError && (
              <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/25 rounded-lg px-4 py-3">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-300">{estimateError}</p>
              </div>
            )}

            {/* Result */}
            {estimate && estimate.employer_currency_costs && (() => {
              const c = estimate.employer_currency_costs
              const currency = c.currency ?? employerCurrency
              const fmt = (n?: number) =>
                n != null
                  ? n.toLocaleString(undefined, { style: 'currency', currency, maximumFractionDigits: 0 })
                  : '—'
              const contributions = (c.annual_employer_total ?? 0) - (c.annual_gross_salary ?? 0)
              return (
                <div className="bg-zinc-800/60 border border-zinc-700 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-zinc-700/60">
                    <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-1">
                      {estimate.country?.name ?? selectedCountry?.name} — Annual breakdown
                    </p>
                  </div>
                  <div className="divide-y divide-zinc-700/50">
                    <div className="flex items-center justify-between px-5 py-3">
                      <span className="text-sm text-zinc-400">Gross salary</span>
                      <span className="text-sm font-mono text-zinc-100">{fmt(c.annual_gross_salary)}</span>
                    </div>
                    <div className="flex items-center justify-between px-5 py-3">
                      <span className="text-sm text-zinc-400">Employer contributions</span>
                      <span className="text-sm font-mono text-zinc-300">{fmt(contributions > 0 ? contributions : undefined)}</span>
                    </div>
                    <div className="flex items-center justify-between px-5 py-3 bg-zinc-800/40">
                      <span className="text-sm font-semibold text-zinc-100">Total employer cost</span>
                      <span className="text-sm font-bold font-mono text-emerald-400">{fmt(c.annual_employer_total)}</span>
                    </div>
                  </div>
                  {c.monthly_employer_total && (
                    <div className="px-5 py-3 border-t border-zinc-700/60">
                      <p className="text-xs text-zinc-600">
                        Monthly: <span className="font-mono text-zinc-500">{fmt(c.monthly_employer_total)}</span>
                        {c.monthly_gross_salary && (
                          <> · Gross per month: <span className="font-mono text-zinc-500">{fmt(c.monthly_gross_salary)}</span></>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        )}
      </section>
    </div>
  )
}
