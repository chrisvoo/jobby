'use client'

import { useEffect, useState } from 'react'
import { ArrowRightLeft, Loader2, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { CurrencyCombobox } from '@/components/currency-combobox'

interface ConversionResult {
  from: string
  to: string
  amount: number
  result: number
  rate: number
  date: string
}

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
    if (!fromCurrency || !toCurrency || !amount) {
      return
    }
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
      if (!res.ok) {
        throw new Error(data.error ?? `Error ${res.status}`)
      }
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

      <section className="bg-zinc-900 border border-zinc-800 rounded-xl">
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center gap-3 rounded-t-xl">
          <ArrowRightLeft className="w-4 h-4 text-emerald-400" />
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Currency Converter</h2>
            <p className="text-xs text-zinc-400 mt-0.5">
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

          <button
            onClick={convert}
            disabled={!canConvert}
            className="w-full inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white px-4 py-2.5 rounded-lg font-medium text-sm transition-colors"
          >
            {converting && <Loader2 className="w-4 h-4 animate-spin" />}
            {converting ? 'Converting…' : 'Convert'}
          </button>

          {convError && (
            <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/25 rounded-lg px-4 py-3">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">{convError}</p>
            </div>
          )}

          {convResult && (
            <div className="bg-zinc-800/60 border border-zinc-700 rounded-xl p-5 space-y-3">
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="text-3xl font-bold text-zinc-100 tabular-nums">
                  {convResult.result.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                </span>
                <span className="text-lg font-semibold text-zinc-400">{convResult.to}</span>
              </div>
              <div className="flex flex-wrap gap-4 text-xs text-zinc-400">
                <span>
                  <span className="font-mono text-zinc-400">1 {convResult.from}</span>
                  {' = '}
                  <span className="font-mono text-zinc-400">{convResult.rate} {convResult.to}</span>
                </span>
                <span>Rate date: {convResult.date}</span>
              </div>
              <p className="text-xs text-zinc-400">
                {convResult.amount.toLocaleString()} {convResult.from} at the above rate
              </p>
            </div>
          )}

          {defaultTargetCurrency && !toCurrency && (
            <p className="text-xs text-zinc-400">
              Default target currency is <span className="text-zinc-400 font-mono">{defaultTargetCurrency}</span> (set in{' '}
              <Link href="/config" className="text-zinc-500 hover:text-zinc-300 underline">Settings</Link>).
            </p>
          )}
        </div>
      </section>
    </div>
  )
}
