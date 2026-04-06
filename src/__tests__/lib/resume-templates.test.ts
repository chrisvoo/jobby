import { describe, it, expect } from 'vitest'
import {
  RESUME_TEMPLATES,
  DEFAULT_TEMPLATE_ID,
  isValidTemplateId,
} from '@/lib/resume-templates'

describe('RESUME_TEMPLATES', () => {
  it('contains exactly two templates', () => {
    expect(RESUME_TEMPLATES).toHaveLength(2)
  })

  it('includes minimal and pixel-perfect ids', () => {
    const ids = RESUME_TEMPLATES.map((t) => t.id)
    expect(ids).toContain('minimal')
    expect(ids).toContain('pixel-perfect')
  })

  it('every template has id, name, and description', () => {
    for (const t of RESUME_TEMPLATES) {
      expect(t.id).toBeTruthy()
      expect(t.name).toBeTruthy()
      expect(t.description).toBeTruthy()
    }
  })
})

describe('DEFAULT_TEMPLATE_ID', () => {
  it('is "minimal"', () => {
    expect(DEFAULT_TEMPLATE_ID).toBe('minimal')
  })

  it('is a valid template id', () => {
    expect(isValidTemplateId(DEFAULT_TEMPLATE_ID)).toBe(true)
  })
})

describe('isValidTemplateId', () => {
  it('returns true for "minimal"', () => {
    expect(isValidTemplateId('minimal')).toBe(true)
  })

  it('returns true for "pixel-perfect"', () => {
    expect(isValidTemplateId('pixel-perfect')).toBe(true)
  })

  it('returns false for an unknown id', () => {
    expect(isValidTemplateId('fancy')).toBe(false)
  })

  it('returns false for an empty string', () => {
    expect(isValidTemplateId('')).toBe(false)
  })

  it('is case-sensitive', () => {
    expect(isValidTemplateId('Minimal')).toBe(false)
    expect(isValidTemplateId('PIXEL-PERFECT')).toBe(false)
  })
})
