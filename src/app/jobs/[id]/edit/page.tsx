'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { JobForm } from '@/components/job-form'
import { StatusBadge } from '@/components/status-badge'
import { formatDate } from '@/lib/utils'
import type { Job, Resume, JobStatusHistory } from '@/lib/types'
import { ArrowRight } from 'lucide-react'

export default function EditJobPage() {
  const params = useParams()
  const id = params.id as string

  const [job, setJob] = useState<Job | null>(null)
  const [resumes, setResumes] = useState<Resume[]>([])
  const [history, setHistory] = useState<JobStatusHistory[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch(`/api/jobs/${id}`).then((r) => r.json()),
      fetch('/api/resumes').then((r) => r.json()),
      fetch(`/api/jobs/${id}/history`).then((r) => r.json()),
    ])
      .then(([j, r, h]) => {
        setJob(j)
        setResumes(Array.isArray(r) ? r : [])
        setHistory(Array.isArray(h) ? h : [])
      })
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return <div className="text-zinc-500 text-sm">Loading…</div>
  }

  if (!job || job.id === undefined) {
    return <div className="text-zinc-500 text-sm">Job not found.</div>
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-100">Edit Application</h1>
        <p className="text-zinc-500 text-sm mt-1">
          {job.company} — {job.role}
        </p>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <JobForm job={job} resumes={resumes} />
      </div>

      {history.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-zinc-100 mb-4">Status History</h2>
          <ol className="space-y-3">
            {history.map((entry) => (
              <li key={entry.id} className="flex items-center gap-3 text-sm">
                <span className="text-zinc-600 text-xs w-28 shrink-0">
                  {formatDate(entry.changed_at)}
                </span>
                {entry.from_status ? (
                  <>
                    <StatusBadge status={entry.from_status} />
                    <ArrowRight className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                  </>
                ) : (
                  <span className="text-zinc-600 text-xs italic">created as</span>
                )}
                <StatusBadge status={entry.to_status} />
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}
