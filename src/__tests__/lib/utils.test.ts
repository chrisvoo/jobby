import { describe, it, expect } from 'vitest'
import { formatSalary, formatDate, STATUS_LABELS, STATUS_COLORS } from '@/lib/utils'

describe('formatSalary', () => {
  it('returns an em dash for null', () => {
    expect(formatSalary(null)).toBe('—')
  })

  it('defaults to EUR when no currency is provided', () => {
    const result = formatSalary([80000, 120000])
    expect(result).toMatch(/80,000/)
    expect(result).toMatch(/120,000/)
    expect(result).toContain('–')
    expect(result).toContain('€')
  })

  it('formats a salary range in USD when currency is USD', () => {
    const result = formatSalary([80000, 120000], 'USD')
    expect(result).toMatch(/80,000/)
    expect(result).toMatch(/120,000/)
    expect(result).toContain('$')
    expect(result).toContain('–')
  })

  it('formats a salary range in GBP when currency is GBP', () => {
    const result = formatSalary([50000, 70000], 'GBP')
    expect(result).toMatch(/50,000/)
    expect(result).toMatch(/70,000/)
    expect(result).toContain('£')
  })

  it('falls back gracefully for an unknown currency code', () => {
    const result = formatSalary([50000, 70000], 'ZZZ')
    expect(result).toMatch(/50,000/)
    expect(result).toMatch(/70,000/)
    expect(result).toContain('–')
  })

  it('defaults to EUR when null is passed as currency', () => {
    const result = formatSalary([60000, 90000], null)
    expect(result).toContain('€')
  })
})

describe('formatDate', () => {
  it('returns a human-readable date string', () => {
    // Use a fixed date to avoid locale differences causing test flakiness
    const result = formatDate('2024-06-15T00:00:00.000Z')
    expect(result).toMatch(/2024/)
    expect(result).toMatch(/Jun|June/)
  })
})

describe('STATUS_LABELS', () => {
  it('has labels for every status', () => {
    const statuses = ['applied', 'hr_interview', 'tech_interview', 'offer', 'rejected'] as const
    for (const s of statuses) {
      expect(STATUS_LABELS[s]).toBeTruthy()
    }
  })
})

describe('STATUS_COLORS', () => {
  it('has a CSS class for every status', () => {
    const statuses = ['applied', 'hr_interview', 'tech_interview', 'offer', 'rejected'] as const
    for (const s of statuses) {
      expect(STATUS_COLORS[s]).toBeTruthy()
    }
  })
})
