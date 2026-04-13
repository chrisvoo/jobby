'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Upload, FileText, Trash2, Sparkles, Download,
  AlertTriangle, CheckCircle2, Loader2, Link2, BookmarkPlus, X, Eraser, FileCheck2, ChevronDown,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { ResumeEditor } from '@/components/resume-editor'
import { RESUME_TEMPLATES, DEFAULT_TEMPLATE_ID } from '@/lib/resume-templates'
import type { TemplateId } from '@/lib/resume-templates'
import type { Job, JobStatus, Resume, ExtractedJobFields, ResumeData } from '@/lib/types'

interface PrepareResult {
  template: 'minimal'
  output_filename: string
  warnings: string[]
  changes: Array<{ original_text: string; replacement_text: string; reason: string }>
  resume: ResumeData
}

const CURRENCY_OPTIONS = [
  { code: 'EUR', label: 'EUR — Euro' },
  { code: 'USD', label: 'USD — US Dollar' },
  { code: 'GBP', label: 'GBP — British Pound' },
  { code: 'CHF', label: 'CHF — Swiss Franc' },
  { code: 'CAD', label: 'CAD — Canadian Dollar' },
  { code: 'AUD', label: 'AUD — Australian Dollar' },
  { code: 'NZD', label: 'NZD — New Zealand Dollar' },
  { code: 'SEK', label: 'SEK — Swedish Krona' },
  { code: 'NOK', label: 'NOK — Norwegian Krone' },
  { code: 'DKK', label: 'DKK — Danish Krone' },
  { code: 'PLN', label: 'PLN — Polish Zloty' },
  { code: 'BRL', label: 'BRL — Brazilian Real' },
  { code: 'INR', label: 'INR — Indian Rupee' },
  { code: 'SGD', label: 'SGD — Singapore Dollar' },
  { code: 'JPY', label: 'JPY — Japanese Yen' },
]

interface QuickAddForm {
  company: string
  role: string
  url: string
  status: JobStatus
  salary_min: string
  salary_max: string
  salary_currency: string
  notes: string
  applied_at: string
}

const LS_KEY = 'jobby_resume_form'

const defaultQuickAdd = (): QuickAddForm => ({
  company: '', role: '', url: '', status: 'applied',
  salary_min: '', salary_max: '', salary_currency: '', notes: '',
  applied_at: new Date().toISOString().split('T')[0],
})

export default function ResumePage() {
  const [resumes, setResumes] = useState<Resume[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [uploading, setUploading] = useState(false)
  const [selectedResumeId, setSelectedResumeId] = useState('')
  const [selectedJobId, setSelectedJobId] = useState('')
  const [jobUrl, setJobUrl] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [scrapedFields, setScrapedFields] = useState<Partial<ExtractedJobFields> | null>(null)
  const [scraping, setScraping] = useState(false)
  const [enhancing, setEnhancing] = useState(false)
  const [preview, setPreview] = useState<PrepareResult | null>(null)
  const [draftResume, setDraftResume] = useState<ResumeData | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId>(DEFAULT_TEMPLATE_ID)
  const [confirming, setConfirming] = useState(false)
  const [finalResult, setFinalResult] = useState<{ filename: string; download_url: string } | null>(null)
  const [lsLoaded, setLsLoaded] = useState(false)

  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [quickAddForm, setQuickAddForm] = useState<QuickAddForm>(defaultQuickAdd())
  const [quickAdding, setQuickAdding] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [confirmDeleteResumeId, setConfirmDeleteResumeId] = useState<string | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)

  // Restore form state from localStorage on mount
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(LS_KEY) ?? '{}')
      if (stored.selectedResumeId) setSelectedResumeId(stored.selectedResumeId)
      if (stored.selectedJobId) setSelectedJobId(stored.selectedJobId)
      if (stored.jobUrl) setJobUrl(stored.jobUrl)
      if (stored.jobDescription) setJobDescription(stored.jobDescription)
      if (stored.scrapedFields) setScrapedFields(stored.scrapedFields)
    } catch {}
    setLsLoaded(true)
  }, [])

  // Persist form state to localStorage whenever it changes
  useEffect(() => {
    if (!lsLoaded) return
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        selectedResumeId, selectedJobId, jobUrl, jobDescription, scrapedFields,
      }))
    } catch {}
  }, [lsLoaded, selectedResumeId, selectedJobId, jobUrl, jobDescription, scrapedFields])

  useEffect(() => {
    Promise.all([
      fetch('/api/resumes').then((r) => r.json()),
      fetch('/api/jobs').then((r) => r.json()),
    ])
      .then(([r, j]) => {
        const resumes = Array.isArray(r) ? r as Resume[] : []
        const jobs = Array.isArray(j) ? j as Job[] : []
        setResumes(resumes)
        setJobs(jobs)

        setSelectedResumeId((prev) => {
          if (prev && !resumes.find((x) => x.id === prev)) {
            try {
              const stored = JSON.parse(localStorage.getItem(LS_KEY) ?? '{}')
              localStorage.setItem(LS_KEY, JSON.stringify({ ...stored, selectedResumeId: '' }))
            } catch {}
            return ''
          }
          return prev
        })
        setSelectedJobId((prev) => {
          if (prev && !jobs.find((x) => x.id === prev)) {
            try {
              const stored = JSON.parse(localStorage.getItem(LS_KEY) ?? '{}')
              localStorage.setItem(LS_KEY, JSON.stringify({ ...stored, selectedJobId: '' }))
            } catch {}
            return ''
          }
          return prev
        })
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!selectedJobId || !jobs.length) return
    const job = jobs.find((j) => j.id === selectedJobId)
    if (job?.description && !jobDescription.trim()) {
      setJobDescription(job.description)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedJobId, jobs])

  function clearForm() {
    setSelectedResumeId('')
    setSelectedJobId('')
    setJobUrl('')
    setJobDescription('')
    setScrapedFields(null)
    setPreview(null)
    setDraftResume(null)
    setFinalResult(null)
    try { localStorage.removeItem(LS_KEY) } catch {}
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.type !== 'application/pdf') {
      toast.error('Only PDF files are supported')
      return
    }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('name', file.name.replace(/\.pdf$/i, ''))
      const res = await fetch('/api/resumes', { method: 'POST', body: fd })
      if (!res.ok) { const e = await res.json().catch(() => null); throw new Error(e?.error ?? `Server error ${res.status}`) }
      const newResume: Resume = await res.json()
      setResumes((prev) => [newResume, ...prev])
      setSelectedResumeId(newResume.id)
      toast.success('Resume uploaded')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function deleteResume(id: string) {
    try {
      const res = await fetch(`/api/resumes/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      setResumes((prev) => prev.filter((r) => r.id !== id))
      if (selectedResumeId === id) setSelectedResumeId('')
      toast.success('Resume deleted')
    } catch {
      toast.error('Failed to delete')
    }
  }

  async function scrapeJob() {
    if (!jobUrl.trim()) return
    setScraping(true)
    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: jobUrl }),
      })
      if (!res.ok) { const e = await res.json().catch(() => null); throw new Error(e?.error ?? `Server error ${res.status}`) }
      const fields: ExtractedJobFields = await res.json()
      setJobDescription(fields.description ?? '')
      setScrapedFields(fields)

      const match = jobs.find(
        (j) =>
          j.company?.toLowerCase() === fields.company?.toLowerCase() ||
          j.url === jobUrl,
      )
      if (match) setSelectedJobId(match.id)

      toast.success('Job description extracted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Scrape failed')
    } finally {
      setScraping(false)
    }
  }

  function currencyFromFields(fields: Partial<ExtractedJobFields>): string {
    if (fields.salary_currency) return fields.salary_currency
    if (fields.salary_min != null || fields.salary_max != null) return 'EUR'
    return ''
  }

  async function openQuickAdd() {
    if (scrapedFields) {
      setQuickAddForm({
        company: scrapedFields.company ?? '',
        role: scrapedFields.role ?? '',
        url: jobUrl,
        status: 'applied',
        salary_min: scrapedFields.salary_min?.toString() ?? '',
        salary_max: scrapedFields.salary_max?.toString() ?? '',
        salary_currency: currencyFromFields(scrapedFields),
        notes: '',
        applied_at: new Date().toISOString().split('T')[0],
      })
      setQuickAddOpen(true)
    } else if (jobDescription.trim()) {
      setExtracting(true)
      try {
        const res = await fetch('/api/scrape', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: jobDescription }),
        })
        const fields = res.ok ? await res.json() : {}
        setScrapedFields(fields)
        setQuickAddForm({
          company: fields.company ?? '',
          role: fields.role ?? '',
          url: jobUrl,
          status: 'applied',
          salary_min: fields.salary_min?.toString() ?? '',
          salary_max: fields.salary_max?.toString() ?? '',
          salary_currency: currencyFromFields(fields),
          notes: '',
          applied_at: new Date().toISOString().split('T')[0],
        })
      } finally {
        setExtracting(false)
        setQuickAddOpen(true)
      }
    }
  }

  async function submitQuickAdd() {
    if (!quickAddForm.company.trim() || !quickAddForm.role.trim()) {
      toast.error('Company and role are required')
      return
    }
    setQuickAdding(true)
    try {
      const hasSalary = Boolean(quickAddForm.salary_min || quickAddForm.salary_max)
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company: quickAddForm.company,
          role: quickAddForm.role,
          url: quickAddForm.url || undefined,
          status: quickAddForm.status,
          salary_min: quickAddForm.salary_min ? parseInt(quickAddForm.salary_min) : undefined,
          salary_max: quickAddForm.salary_max ? parseInt(quickAddForm.salary_max) : undefined,
          salary_currency: hasSalary ? (quickAddForm.salary_currency || 'EUR') : undefined,
          notes: quickAddForm.notes || undefined,
          description: jobDescription.trim() || undefined,
          applied_at: quickAddForm.applied_at || undefined,
          base_resume_id: selectedResumeId || undefined,
        }),
      })
      if (!res.ok) { const e = await res.json().catch(() => null); throw new Error(e?.error ?? `Server error ${res.status}`) }
      const newJob: Job = await res.json()
      setJobs((prev) => [newJob, ...prev])
      setSelectedJobId(newJob.id)
      setQuickAddOpen(false)
      toast.success('Job application added')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add job')
    } finally {
      setQuickAdding(false)
    }
  }

  async function enhance() {
    if (!selectedResumeId) { toast.error('Select a base resume first'); return }
    if (!selectedJobId) { toast.error('Select a job to target'); return }
    if (!jobDescription.trim()) { toast.error('Provide a job description'); return }

    const patchRes = await fetch(`/api/jobs/${selectedJobId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base_resume_id: selectedResumeId,
        description: jobDescription.trim() || undefined,
      }),
    })
    if (!patchRes.ok) { toast.error('Failed to link resume to job'); return }

    setEnhancing(true)
    setPreview(null)
    setDraftResume(null)
    setFinalResult(null)
    try {
      const res = await fetch('/api/enhance/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: selectedJobId,
          job_description: jobDescription,
          template: selectedTemplate,
        }),
      })
      if (!res.ok) { const e = await res.json().catch(() => null); throw new Error(e?.error ?? `Server error ${res.status}`) }
      const data: PrepareResult = await res.json()
      setPreview(data)
      setDraftResume(data.resume)
      toast.success('Resume ready — review and generate PDF')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Enhancement failed')
    } finally {
      setEnhancing(false)
    }
  }

  async function confirmGenerate() {
    if (!preview || !draftResume) return

    setConfirming(true)
    try {
      const res = await fetch('/api/enhance/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: selectedJobId,
          resume: draftResume,
          output_filename: preview.output_filename,
          template: selectedTemplate,
        }),
      })
      if (!res.ok) {
        const errBody = await res.json().catch(() => null)
        throw new Error(errBody?.error ?? `Server error ${res.status}`)
      }
      const data = await res.json()
      setFinalResult(data)
      toast.success('PDF generated!')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'PDF generation failed')
    } finally {
      setConfirming(false)
    }
  }

  const hasContent = jobDescription.trim().length > 0

  const missingForEnhance = [
    !selectedResumeId && 'select a base resume',
    !selectedJobId && 'select a target job',
    !jobDescription.trim() && 'add a job description',
  ].filter(Boolean) as string[]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-100">Resume Enhancer</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Tailor your resume to a specific job posting using Claude AI
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left panel — Base resumes */}
        <div className="flex flex-col gap-4">
          <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-zinc-100">Base Resumes</h2>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              >
                {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                Upload PDF
              </button>
              <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handleUpload} />
            </div>

            {resumes.length === 0 ? (
              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-zinc-700 rounded-lg p-8 text-center cursor-pointer hover:border-indigo-500/50 transition-colors"
              >
                <FileText className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                <p className="text-zinc-500 text-sm">Drop your resume PDF here</p>
                <p className="text-zinc-600 text-xs mt-1">or click to browse</p>
              </div>
            ) : (
              <div className="space-y-2">
                {resumes.map((r) => (
                  <div
                    key={r.id}
                    onClick={() => setSelectedResumeId(r.id)}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedResumeId === r.id
                        ? 'border-indigo-500/50 bg-indigo-500/10'
                        : 'border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800'
                    }`}
                  >
                    <FileText className="w-4 h-4 text-zinc-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-100 truncate">{r.name}</p>
                      <p className="text-xs text-zinc-500">{formatDate(r.uploaded_at)}</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmDeleteResumeId(r.id) }}
                      className="p-1 rounded text-zinc-600 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Target job selector */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-zinc-100 mb-3">Target Job</h2>
            <select
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
              className={selectCls}
            >
              <option value="">— Select a job —</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.company} · {j.role}
                </option>
              ))}
            </select>
            {jobs.length === 0 && (
              <p className="text-xs text-zinc-600 mt-2">
                Add jobs in the Jobs tab first.
              </p>
            )}
          </div>

          {/* Template picker */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-zinc-100 mb-3">Resume Template</h2>
            <div className="space-y-2">
              {RESUME_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => setSelectedTemplate(tpl.id as TemplateId)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedTemplate === tpl.id
                      ? 'border-indigo-500/60 bg-indigo-500/10'
                      : 'border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${
                      selectedTemplate === tpl.id ? 'bg-indigo-400' : 'bg-zinc-600'
                    }`} />
                    <span className="text-sm font-medium text-zinc-100">{tpl.name}</span>
                  </div>
                  <p className="text-xs text-zinc-500 leading-relaxed pl-4">{tpl.description}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right panel — Job description + enhance */}
        <div className="flex flex-col gap-4">
          <div className="flex-1 flex flex-col bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-zinc-100">Job Posting</h2>
              {hasContent && (
                <button
                  onClick={openQuickAdd}
                  disabled={extracting}
                  title="Add to job tracker"
                  className="inline-flex items-center gap-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                >
                  {extracting
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <BookmarkPlus className="w-3 h-3" />}
                  Add to Jobs
                </button>
              )}
            </div>

            <div className="flex gap-2 mb-3">
              <input
                value={jobUrl}
                onChange={(e) => setJobUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && scrapeJob()}
                placeholder="Paste job URL to auto-extract…"
                className={`${inputCls} flex-1`}
              />
              <button
                onClick={scrapeJob}
                disabled={scraping || !jobUrl.trim()}
                className="inline-flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 px-3 py-2 rounded-lg text-sm transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                {scraping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
                Fetch
              </button>
            </div>

            <textarea
              value={jobDescription}
              onChange={(e) => { setJobDescription(e.target.value); setScrapedFields(null) }}
              placeholder="Or paste the job description here directly…"
              className={`${inputCls} flex-1 min-h-[10rem] resize-none`}
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={clearForm}
              title="Clear all fields"
              className="inline-flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-400 hover:text-zinc-200 px-4 py-3 rounded-xl text-sm transition-colors"
            >
              <Eraser className="w-4 h-4" />
              Clear
            </button>
            <button
              onClick={enhance}
              disabled={enhancing || missingForEnhance.length > 0}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-3 rounded-xl font-medium text-sm transition-colors"
            >
              {enhancing ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Enhancing with Claude…</>
              ) : (
                <><Sparkles className="w-4 h-4" /> Enhance Resume</>
              )}
            </button>
          </div>
          {!enhancing && missingForEnhance.length > 0 && (
            <p className="text-xs text-zinc-500 text-center -mt-1">
              Still needed: {missingForEnhance.join(', ')}
            </p>
          )}
        </div>
      </div>

      {/* Review & Edit */}
      {preview && draftResume && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-lg font-semibold text-zinc-100">Review &amp; Edit</h2>
            <div className="flex items-center gap-3 flex-wrap">
              {finalResult && (
                <a
                  href={finalResult.download_url}
                  download={finalResult.filename}
                  className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download {finalResult.filename}
                </a>
              )}
              <button
                onClick={confirmGenerate}
                disabled={confirming}
                className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors"
              >
                {confirming
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
                  : <><FileCheck2 className="w-4 h-4" /> {finalResult ? 'Regenerate PDF' : 'Generate PDF'}</>
                }
              </button>
            </div>
          </div>

          {preview.warnings.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl p-4 space-y-1.5">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-semibold text-amber-400">ATS Warnings</span>
              </div>
              {preview.warnings.map((w, i) => (
                <p key={i} className="text-sm text-amber-300/80">{'\u2022'} {w}</p>
              ))}
            </div>
          )}

          <ResumeEditor value={draftResume} onChange={setDraftResume} />

          {preview.changes.length > 0 && (
            <details className="group bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <summary className="flex items-center justify-between px-5 py-3 cursor-pointer list-none hover:bg-zinc-800/40 transition-colors">
                <span className="text-sm font-semibold text-zinc-100">
                  Claude&apos;s notes ({preview.changes.length} changes)
                </span>
                <ChevronDown className="w-4 h-4 text-zinc-500 group-open:rotate-180 transition-transform" />
              </summary>
              <div className="divide-y divide-zinc-800 border-t border-zinc-800">
                {preview.changes.map((c, i) => (
                  <div key={i} className="px-5 py-4">
                    <div className="flex items-start gap-2 mb-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                      <p className="text-xs text-zinc-500">{c.reason}</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                        <p className="text-xs text-red-400 font-medium mb-1 uppercase tracking-wide">Before</p>
                        <p className="text-xs text-red-300/80 leading-relaxed">{c.original_text}</p>
                      </div>
                      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
                        <p className="text-xs text-emerald-400 font-medium mb-1 uppercase tracking-wide">After</p>
                        <p className="text-xs text-emerald-300/80 leading-relaxed">{c.replacement_text}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Quick Add Job dialog */}
      {quickAddOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
              <h2 className="text-sm font-semibold text-zinc-100">Add Job Application</h2>
              <button onClick={() => setQuickAddOpen(false)} className="text-zinc-500 hover:text-zinc-300 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Company *</label>
                  <input
                    value={quickAddForm.company}
                    onChange={(e) => setQuickAddForm((f) => ({ ...f, company: e.target.value }))}
                    className={inputCls}
                    placeholder="Acme Inc."
                  />
                </div>
                <div>
                  <label className={labelCls}>Role *</label>
                  <input
                    value={quickAddForm.role}
                    onChange={(e) => setQuickAddForm((f) => ({ ...f, role: e.target.value }))}
                    className={inputCls}
                    placeholder="Senior Engineer"
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>Job URL</label>
                <input
                  value={quickAddForm.url}
                  onChange={(e) => setQuickAddForm((f) => ({ ...f, url: e.target.value }))}
                  className={inputCls}
                  placeholder="https://…"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Salary min</label>
                  <input
                    type="number"
                    value={quickAddForm.salary_min}
                    onChange={(e) => setQuickAddForm((f) => ({ ...f, salary_min: e.target.value }))}
                    className={inputCls}
                    placeholder="60000"
                  />
                </div>
                <div>
                  <label className={labelCls}>Salary max</label>
                  <input
                    type="number"
                    value={quickAddForm.salary_max}
                    onChange={(e) => setQuickAddForm((f) => ({ ...f, salary_max: e.target.value }))}
                    className={inputCls}
                    placeholder="90000"
                  />
                </div>
                <div>
                  <label className={labelCls}>Currency</label>
                  <select
                    value={quickAddForm.salary_currency}
                    onChange={(e) => setQuickAddForm((f) => ({ ...f, salary_currency: e.target.value }))}
                    className={selectCls}
                  >
                    <option value="">—</option>
                    {CURRENCY_OPTIONS.map((c) => (
                      <option key={c.code} value={c.code}>{c.code}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Status</label>
                  <select
                    value={quickAddForm.status}
                    onChange={(e) => setQuickAddForm((f) => ({ ...f, status: e.target.value as JobStatus }))}
                    className={selectCls}
                  >
                    <option value="applied">Applied</option>
                    <option value="interview">Interview</option>
                    <option value="offer">Offer</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Applied date</label>
                  <input
                    type="date"
                    value={quickAddForm.applied_at}
                    onChange={(e) => setQuickAddForm((f) => ({ ...f, applied_at: e.target.value }))}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Notes</label>
                  <input
                    value={quickAddForm.notes}
                    onChange={(e) => setQuickAddForm((f) => ({ ...f, notes: e.target.value }))}
                    className={inputCls}
                    placeholder="Optional notes…"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-zinc-800">
              <button
                onClick={() => setQuickAddOpen(false)}
                className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitQuickAdd}
                disabled={quickAdding || !quickAddForm.company.trim() || !quickAddForm.role.trim()}
                className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors"
              >
                {quickAdding && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Add Application
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDeleteResumeId !== null}
        title="Delete resume"
        description="This will permanently remove the base resume file. Any enhanced resumes already generated will not be affected."
        confirmLabel="Delete"
        onConfirm={() => {
          if (confirmDeleteResumeId) deleteResume(confirmDeleteResumeId)
          setConfirmDeleteResumeId(null)
        }}
        onCancel={() => setConfirmDeleteResumeId(null)}
      />
    </div>
  )
}

const inputCls =
  'bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 placeholder-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-colors w-full'

const selectCls =
  'bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-colors w-full'

const labelCls = 'block text-xs text-zinc-400 mb-1.5'
