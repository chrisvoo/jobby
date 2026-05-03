export type JobStatus = 'applied' | 'hr_interview' | 'tech_interview' | 'offer' | 'rejected'

export interface JobStatusHistory {
  id: string
  job_id: string
  from_status: JobStatus | null
  to_status: JobStatus
  changed_at: string
}

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
  salary_currency: string | null
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
  salary_currency?: string
  base_resume_id?: string
}

export interface UpdateJobInput extends Partial<CreateJobInput> {
  resume_path?: string
}

export interface EnhanceResult {
  filename: string
  warnings: string[]
  changes: Array<{
    section: string
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
  salary_currency?: string
  description: string
}
