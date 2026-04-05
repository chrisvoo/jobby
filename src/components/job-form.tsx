'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { Job, JobStatus, Resume } from '@/lib/types'

const STATUS_OPTIONS: JobStatus[] = ['applied', 'interview', 'offer', 'rejected']

interface Props {
  job?: Job
  resumes: Resume[]
  onSuccess?: () => void
}

export function JobForm({ job, resumes, onSuccess }: Props) {
  const router = useRouter()
  const isEdit = Boolean(job)

  const [form, setForm] = useState({
    company: job?.company ?? '',
    role: job?.role ?? '',
    url: job?.url ?? '',
    status: job?.status ?? ('applied' as JobStatus),
    applied_at: job?.applied_at ? job.applied_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
    notes: job?.notes ?? '',
    salary_min: job?.gross_annual_salary?.[0]?.toString() ?? '',
    salary_max: job?.gross_annual_salary?.[1]?.toString() ?? '',
    base_resume_id: job?.base_resume_id ?? '',
  })

  const [loading, setLoading] = useState(false)

  const set = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.company.trim() || !form.role.trim()) {
      toast.error('Company and role are required')
      return
    }

    setLoading(true)
    try {
      const body = {
        company: form.company.trim(),
        role: form.role.trim(),
        url: form.url.trim() || undefined,
        status: form.status,
        applied_at: form.applied_at || undefined,
        notes: form.notes.trim() || undefined,
        salary_min: form.salary_min ? Number(form.salary_min) : undefined,
        salary_max: form.salary_max ? Number(form.salary_max) : undefined,
        base_resume_id: form.base_resume_id || undefined,
      }

      const res = await fetch(isEdit ? `/api/jobs/${job!.id}` : '/api/jobs', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) throw new Error(await res.text())

      toast.success(isEdit ? 'Job updated' : 'Job created')
      if (onSuccess) {
        onSuccess()
      } else {
        router.push('/jobs')
        router.refresh()
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Company *">
          <input
            value={form.company}
            onChange={(e) => set('company', e.target.value)}
            placeholder="Acme Corp"
            className={inputCls}
          />
        </Field>
        <Field label="Role *">
          <input
            value={form.role}
            onChange={(e) => set('role', e.target.value)}
            placeholder="Senior Engineer"
            className={inputCls}
          />
        </Field>
      </div>

      <Field label="Job URL">
        <input
          value={form.url}
          onChange={(e) => set('url', e.target.value)}
          placeholder="https://..."
          className={inputCls}
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Status">
          <select
            value={form.status}
            onChange={(e) => set('status', e.target.value)}
            className={inputCls}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Applied Date">
          <input
            type="date"
            value={form.applied_at}
            onChange={(e) => set('applied_at', e.target.value)}
            className={inputCls}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Salary Min (annual)">
          <input
            type="number"
            value={form.salary_min}
            onChange={(e) => set('salary_min', e.target.value)}
            placeholder="50000"
            className={inputCls}
          />
        </Field>
        <Field label="Salary Max (annual)">
          <input
            type="number"
            value={form.salary_max}
            onChange={(e) => set('salary_max', e.target.value)}
            placeholder="80000"
            className={inputCls}
          />
        </Field>
      </div>

      {resumes.length > 0 && (
        <Field label="Base Resume">
          <select
            value={form.base_resume_id}
            onChange={(e) => set('base_resume_id', e.target.value)}
            className={inputCls}
          >
            <option value="">— None —</option>
            {resumes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </Field>
      )}

      <Field label="Notes">
        <textarea
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
          rows={3}
          placeholder="Recruiter contact, interview notes…"
          className={`${inputCls} resize-none`}
        />
      </Field>

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={loading} className={btnPrimary}>
          {loading ? 'Saving…' : isEdit ? 'Save changes' : 'Create job'}
        </button>
        <button type="button" onClick={() => router.back()} className={btnSecondary}>
          Cancel
        </button>
      </div>
    </form>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  )
}

const inputCls =
  'bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 placeholder-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-colors w-full'

const btnPrimary =
  'bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors'

const btnSecondary =
  'bg-zinc-800 hover:bg-zinc-700 text-zinc-100 px-4 py-2 rounded-lg font-medium text-sm border border-zinc-700 transition-colors'
