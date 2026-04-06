import { describe, it, expect } from 'vitest'
import { toISO, parseSalary } from '@/lib/db'

describe('toISO', () => {
  it('converts a JS Date to ISO string', () => {
    const d = new Date('2024-06-15T10:00:00.000Z')
    expect(toISO(d)).toBe('2024-06-15T10:00:00.000Z')
  })

  it('converts a BigInt microsecond timestamp (DuckDB TIMESTAMP) to ISO string', () => {
    // DuckDB stores timestamps as microseconds since epoch
    const epochMs = new Date('2024-01-01T00:00:00.000Z').getTime()
    const microseconds = BigInt(epochMs) * 1000n
    const result = toISO(microseconds)
    expect(result).toBe('2024-01-01T00:00:00.000Z')
  })

  it('passes a plain string through unchanged', () => {
    const iso = '2025-03-17T12:30:00.000Z'
    expect(toISO(iso)).toBe(iso)
  })

  it('returns a current-ish ISO string for null', () => {
    const before = Date.now()
    const result = toISO(null)
    const after = Date.now()
    const ts = new Date(result).getTime()
    expect(ts).toBeGreaterThanOrEqual(before)
    expect(ts).toBeLessThanOrEqual(after)
  })

  it('returns a current-ish ISO string for undefined', () => {
    const before = Date.now()
    const result = toISO(undefined)
    const after = Date.now()
    const ts = new Date(result).getTime()
    expect(ts).toBeGreaterThanOrEqual(before)
    expect(ts).toBeLessThanOrEqual(after)
  })

  it('converts a numeric string to a string', () => {
    expect(toISO('2024-06-01')).toBe('2024-06-01')
  })
})

describe('parseSalary', () => {
  it('returns null for null input', () => {
    expect(parseSalary(null)).toBeNull()
  })

  it('returns null for undefined input', () => {
    expect(parseSalary(undefined)).toBeNull()
  })

  it('returns null for an empty array', () => {
    expect(parseSalary([])).toBeNull()
  })

  it('returns null for an array with only one element', () => {
    expect(parseSalary([80000])).toBeNull()
  })

  it('parses a two-element numeric array', () => {
    expect(parseSalary([70000, 90000])).toEqual([70000, 90000])
  })

  it('coerces string numbers in the array', () => {
    expect(parseSalary(['80000', '120000'])).toEqual([80000, 120000])
  })

  it('coerces BigInt values from DuckDB', () => {
    expect(parseSalary([BigInt(50000), BigInt(75000)])).toEqual([50000, 75000])
  })

  it('returns null for non-array input', () => {
    expect(parseSalary('invalid')).toBeNull()
    expect(parseSalary(42)).toBeNull()
  })
})
