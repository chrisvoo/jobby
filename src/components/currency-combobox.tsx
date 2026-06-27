'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Filter currency entries by a free-text query, matching either the ISO code
 * or the display name (case-insensitive). An empty query returns every entry.
 *
 * Exported so the matching logic can be unit-tested without a DOM — see the
 * Frankfurter normalization gotcha in AGENTS.md (numeric keys from an array
 * response would surface here as invalid currency codes).
 */
export function filterCurrencies(
  currencies: Record<string, string>,
  query: string,
): [string, string][] {
  const entries = Object.entries(currencies)
  if (!query) return entries
  const q = query.toLowerCase()
  return entries.filter(
    ([code, name]) =>
      code.toLowerCase().includes(q) || name.toLowerCase().includes(q),
  )
}

/**
 * Build the trigger label for a selected currency, e.g. "EUR — Euro".
 * Falls back to just the code when no display name is known, and to an empty
 * string when nothing is selected (so the placeholder shows instead).
 */
export function formatCurrencyLabel(
  value: string,
  currencies: Record<string, string>,
): string {
  if (!value) return ''
  return `${value}${currencies[value] ? ` — ${currencies[value]}` : ''}`
}

export interface CurrencyComboboxProps {
  value: string
  onChange: (code: string) => void
  currencies: Record<string, string>
  loading: boolean
  /** Optional id forwarded to the trigger button (for <label htmlFor>). */
  id?: string
  /** Text shown when no currency is selected. */
  placeholder?: string
  /** Text shown next to the spinner while currencies are loading. */
  loadingText?: string
  /** Extra classes merged onto the trigger button for per-page customization. */
  className?: string
}

export function CurrencyCombobox({
  value,
  onChange,
  currencies,
  loading,
  id,
  placeholder = 'Select currency',
  loadingText = 'Loading…',
  className,
}: CurrencyComboboxProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = filterCurrencies(currencies, query)
  const label = formatCurrencyLabel(value, currencies)

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
        className={cn(
          'w-full flex items-center justify-between gap-2 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-left transition-colors focus:outline-hidden focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 hover:border-zinc-600',
          className,
        )}
      >
        {loading ? (
          <span className="flex items-center gap-2 text-zinc-500">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            {loadingText}
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
