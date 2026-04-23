'use client'

import { useEffect, useState, useRef } from 'react'
import { ArrowRightLeft, Loader2, AlertCircle, ChevronDown, Check } from 'lucide-react'
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

// ── Currency combobox ────────────────────────────────────────────

interface CurrencyComboboxProps {
  value: string
  onChange: (code: string) => void
  currencies: Record<string, string>
  loading: boolean
  placeholder?: string
}

function CurrencyCombobox({ value, onChange, currencies, loading, placeholder = 'Select currency' }: CurrencyComboboxProps) {
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
        type="button"
        onClick={() => {
          setOpen((o) => !o)
          if (!open) setTimeout(() => inputRef.current?.focus(), 50)
        }}
        className="w-full flex items-center justify-between gap-2 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-left transition-colors focus:outline-hidden focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 hover:border-zinc-600"
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

// ── Page ─────────────────────────────────────────────────────────

export default function UtilitiesPage() {
  const [defaultTargetCurrency, setDefaultTargetCurrency] = useState('EUR')

  const [currencies, setCurrencies] = useState<Record<string, string>>({})
  const [currenciesLoading, setCurrenciesLoading] = useState(false)

  const [amount, setAmount] = useState('')
  const [fromCurrency, setFrom] = useState('')
  const [toCurrency, setTo] = useState('')
  const [converting, setConverting] = useState(false)
  const [convResult, setConvResult] = useState<ConversionResult | null>(null)
  const [convError, setConvError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((data) => {
        const target = data.target_currency ?? 'EUR'
        setDefaultTargetCurrency(target)
        setTo(target)
      })
      .catch(() => {})

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrenciesLoading(true)
    fetch('/api/rates?currencies=true')
      .then((r) => r.json())
      .then((data: Record<string, string>) => setCurrencies(data))
      .catch(() => {})
      .finally(() => setCurrenciesLoading(false))
  }, [])

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

  function swapCurrencies() {
    setFrom(toCurrency)
    setTo(fromCurrency)
    setConvResult(null)
  }

  const canConvert = !!fromCurrency && !!toCurrency && !!amount && !converting

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-100">Utilities</h1>
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
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 placeholder-zinc-500 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-colors"
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
    </div>
  )
}
