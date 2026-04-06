import { describe, it, expect } from 'vitest'
import { formatSalary, formatDate, STATUS_LABELS, STATUS_COLORS } from '@/lib/utils'

describe('formatSalary', () => {
  it('returns an em dash for null', () => {
    expect(formatSalary(null)).toBe('—')
  })

  it('formats a salary range in USD', () => {
    const result = formatSalary([80000, 120000])
    expect(result).toMatch(/80,000/)
    expect(result).toMatch(/120,000/)
    expect(result).toContain('–')
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
    const statuses = ['applied', 'interview', 'offer', 'rejected'] as const
    for (const s of statuses) {
      expect(STATUS_LABELS[s]).toBeTruthy()
    }
  })
})

describe('STATUS_COLORS', () => {
  it('has a CSS class for every status', () => {
    const statuses = ['applied', 'interview', 'offer', 'rejected'] as const
    for (const s of statuses) {
      expect(STATUS_COLORS[s]).toBeTruthy()
    }
  })
})
