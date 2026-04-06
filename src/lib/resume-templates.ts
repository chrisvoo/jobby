export interface ResumeTemplate {
  id: string
  name: string
  description: string
}

export const RESUME_TEMPLATES: ResumeTemplate[] = [
  {
    id: 'minimal',
    name: 'Minimal',
    description:
      'Single-column, black-and-white layout with no graphic elements. Uses plain Helvetica throughout, uppercase section headings with a fine rule, and dense bullet-point experience blocks. Maximises content density and ATS compatibility — every character is readable by automated parsers.',
  },
  {
    id: 'pixel-perfect',
    name: 'Pixel-Perfect',
    description:
      'Keeps your original PDF layout, fonts, colours, and images intact. Claude surgically rewrites specific text sections (summary, bullets, skills) without altering the visual design. Best for professionally designed resumes. ⚠️ Because PDF positions are fixed, replacement text must stay close to the original length — if it is significantly longer, the font shrinks to fit. For larger rewrites, use Minimal instead.',
  },
]

export type TemplateId = (typeof RESUME_TEMPLATES)[number]['id']

export const DEFAULT_TEMPLATE_ID: TemplateId = 'minimal'

export function isValidTemplateId(id: string): id is TemplateId {
  return RESUME_TEMPLATES.some((t) => t.id === id)
}
