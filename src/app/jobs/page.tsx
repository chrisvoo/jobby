'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Pencil, Trash2, Download, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { StatusBadge } from '@/components/status-badge'
import { formatDate, formatSalary } from '@/lib/utils'
import type { Job, JobStatus } from '@/lib/types'
import { ConfirmDialog } from '@/components/confirm-dialog'

const ALL_STATUSES: ('all' | JobStatus)[] = ['all', 'applied', 'interview', 'offer', 'rejected']

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | JobStatus>('all')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/jobs')
      .then((r) => r.json())
      .then((data) => { setJobs(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtered = filter === 'all' ? jobs : jobs.filter((j) => j.status === filter)

  async function deleteJob(id: string) {
    setDeleting(id)
    try {
      const res = await fetch(`/api/jobs/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      setJobs((prev) => prev.filter((j) => j.id !== id))
      toast.success('Application deleted')
    } catch {
      toast.error('Failed to delete')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">Applications</h1>
          <p className="text-zinc-500 text-sm mt-1">{jobs.length} total</p>
        </div>
        <Link href="/jobs/new" className={btnPrimary}>
          <Plus className="w-4 h-4" />
          New Application
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="overflow-x-auto pb-1">
      <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1 w-fit min-w-max">
        {ALL_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              filter === s
                ? 'bg-indigo-600 text-white'
                : 'text-zinc-400 hover:text-zinc-100'
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
            <span className="ml-1.5 text-xs opacity-60">
              {s === 'all' ? jobs.length : jobs.filter((j) => j.status === s).length}
            </span>
          </button>
        ))}
      </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="px-6 py-16 text-center text-zinc-500 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-zinc-500 text-sm">No applications found.</p>
            <Link href="/jobs/new" className="text-indigo-400 hover:text-indigo-300 text-sm mt-2 inline-block">
              Add one →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b border-zinc-800">
                {['Company', 'Role', 'Status', 'Applied', 'Salary', ''].map((h, i) => (
                  <th key={i} className="px-5 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {filtered.map((job) => (
                <tr key={job.id} className="hover:bg-zinc-800/40 transition-colors group">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-zinc-100">{job.company}</span>
                      {job.url && (
                        <a href={job.url} target="_blank" rel="noreferrer" className="text-zinc-600 hover:text-zinc-400">
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-zinc-400">{job.role}</td>
                  <td className="px-5 py-3"><StatusBadge status={job.status} /></td>
                  <td className="px-5 py-3 text-zinc-500">{formatDate(job.applied_at)}</td>
                  <td className="px-5 py-3 text-zinc-500 tabular-nums">{formatSalary(job.gross_annual_salary)}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                      {job.resume_path && (
                        <a
                          href={`/api/jobs/${job.id}/resume`}
                          download
                          title="Download adapted resume"
                          className="p-1.5 rounded-md text-zinc-400 hover:text-emerald-400 hover:bg-zinc-700 transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <Link
                        href={`/jobs/${job.id}/edit`}
                        className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Link>
                      <button
                        onClick={() => setConfirmDeleteId(job.id)}
                        disabled={deleting === job.id}
                        className="p-1.5 rounded-md text-zinc-400 hover:text-red-400 hover:bg-zinc-700 transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="Delete application"
        description="This action cannot be undone. The application and any associated resume will be permanently removed."
        confirmLabel="Delete"
        onConfirm={() => {
          if (confirmDeleteId) deleteJob(confirmDeleteId)
          setConfirmDeleteId(null)
        }}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  )
}

const btnPrimary =
  'inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors'
