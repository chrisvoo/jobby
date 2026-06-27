import { describe, it, expect } from 'vitest'
import { filterCurrencies, formatCurrencyLabel } from '@/components/currency-combobox'

const CURRENCIES: Record<string, string> = {
  EUR: 'Euro',
  USD: 'United States Dollar',
  GBP: 'British Pound',
  BRL: 'Brazilian Real',
}

describe('filterCurrencies', () => {
  it('returns every entry when the query is empty', () => {
    expect(filterCurrencies(CURRENCIES, '')).toHaveLength(4)
  })

  it('matches on the ISO code, case-insensitively', () => {
    const result = filterCurrencies(CURRENCIES, 'usd')
    expect(result).toEqual([['USD', 'United States Dollar']])
  })

  it('matches on the display name, case-insensitively', () => {
    const result = filterCurrencies(CURRENCIES, 'pound')
    expect(result).toEqual([['GBP', 'British Pound']])
  })

  it('matches a substring that spans multiple results', () => {
    // "r" appears in Euro, Dollar, Pound, Brazilian Real…
    const codes = filterCurrencies(CURRENCIES, 'real').map(([code]) => code)
    expect(codes).toEqual(['BRL'])
  })

  it('returns an empty array when nothing matches', () => {
    expect(filterCurrencies(CURRENCIES, 'zzz')).toEqual([])
  })

  it('handles an empty currency map', () => {
    expect(filterCurrencies({}, 'eur')).toEqual([])
  })
})

describe('formatCurrencyLabel', () => {
  it('returns an empty string when nothing is selected', () => {
    expect(formatCurrencyLabel('', CURRENCIES)).toBe('')
  })

  it('combines the code and display name', () => {
    expect(formatCurrencyLabel('EUR', CURRENCIES)).toBe('EUR — Euro')
  })

  it('falls back to just the code when the name is unknown', () => {
    expect(formatCurrencyLabel('XYZ', CURRENCIES)).toBe('XYZ')
  })
})
