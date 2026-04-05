export type JobStatus = 'applied' | 'interview' | 'offer' | 'rejected'

export interface ResumeData {
  name: string
  email?: string
  phone?: string
  location?: string
  linkedin?: string
  website?: string
  summary?: string
  experience: Array<{
    company: string
    role: string
    dates: string
    location?: string
    bullets: string[]
  }>
  education: Array<{
    institution: string
    degree: string
    dates: string
    details?: string
  }>
  skills: string[]
  certifications?: string[]
}

export interface Job {
  id: string
  company: string
  role: string
  url: string | null
  status: JobStatus
  applied_at: string
  notes: string | null
  description: string | null
  gross_annual_salary: [number, number] | null
  base_resume_id: string | null
  resume_path: string | null
}

export interface Resume {
  id: string
  name: string
  file_path: string
  uploaded_at: string
}

export interface CreateJobInput {
  company: string
  role: string
  url?: string
  status?: JobStatus
  applied_at?: string
  notes?: string
  description?: string
  salary_min?: number
  salary_max?: number
  base_resume_id?: string
}

export interface UpdateJobInput extends Partial<CreateJobInput> {
  resume_path?: string
}

export interface EnhanceResult {
  filename: string
  warnings: string[]
  changes: Array<{
    original_text: string
    replacement_text: string
    reason: string
  }>
}

export interface ExtractedJobFields {
  company: string
  role: string
  salary_min?: number
  salary_max?: number
  description: string
}
