'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { JobForm } from '@/components/job-form'
import type { Job, Resume } from '@/lib/types'

export default function EditJobPage() {
  const params = useParams()
  const id = params.id as string

  const [job, setJob] = useState<Job | null>(null)
  const [resumes, setResumes] = useState<Resume[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch(`/api/jobs/${id}`).then((r) => r.json()),
      fetch('/api/resumes').then((r) => r.json()),
    ])
      .then(([j, r]) => { setJob(j); setResumes(Array.isArray(r) ? r : []) })
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return <div className="text-zinc-500 text-sm">Loading…</div>
  }

  if (!job || job.id === undefined) {
    return <div className="text-zinc-500 text-sm">Job not found.</div>
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-100">Edit Application</h1>
        <p className="text-zinc-500 text-sm mt-1">
          {job.company} — {job.role}
        </p>
      </div>
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <JobForm job={job} resumes={resumes} />
      </div>
    </div>
  )
}
