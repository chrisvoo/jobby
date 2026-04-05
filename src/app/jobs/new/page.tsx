'use client'

import { useEffect, useState } from 'react'
import { JobForm } from '@/components/job-form'
import type { Resume } from '@/lib/types'

export default function NewJobPage() {
  const [resumes, setResumes] = useState<Resume[]>([])

  useEffect(() => {
    fetch('/api/resumes').then((r) => r.json()).then(setResumes).catch(() => {})
  }, [])

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-100">New Application</h1>
        <p className="text-zinc-500 text-sm mt-1">Track a new job you're applying to</p>
      </div>
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <JobForm resumes={resumes} />
      </div>
    </div>
  )
}
