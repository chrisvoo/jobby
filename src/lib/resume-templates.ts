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
    id: 'sidebar',
    name: 'Two-Column Sidebar',
    description:
      'Narrow left sidebar (~30%) holds contact info, skills, and certifications; the wide right column holds summary, experience, and education. Visually distinct and great for roles where layout matters, while remaining ATS-friendly for plain-text parsers.',
  },
  {
    id: 'modern',
    name: 'Modern Accent',
    description:
      'Single-column layout with an indigo accent colour on the name and section titles. Section headings use a bold left border rule instead of an underline. Adds personality while keeping all content in a clean, parser-readable structure.',
  },
]

export type TemplateId = (typeof RESUME_TEMPLATES)[number]['id']

export const DEFAULT_TEMPLATE_ID: TemplateId = 'minimal'

export function isValidTemplateId(id: string): id is TemplateId {
  return RESUME_TEMPLATES.some((t) => t.id === id)
}
