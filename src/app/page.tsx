'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Briefcase, TrendingUp, Award, XCircle, Plus } from 'lucide-react'
import { StatusBadge } from '@/components/status-badge'
import { formatDate, formatSalary } from '@/lib/utils'
import type { Job } from '@/lib/types'

export default function DashboardPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/jobs')
      .then((r) => r.json())
      .then((data) => { setJobs(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const counts = {
    total: jobs.length,
    interview: jobs.filter((j) => j.status === 'interview').length,
    offer: jobs.filter((j) => j.status === 'offer').length,
    rejected: jobs.filter((j) => j.status === 'rejected').length,
  }

  const recent = jobs.slice(0, 8)

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">Dashboard</h1>
          <p className="text-zinc-500 text-sm mt-1">Your job search at a glance</p>
        </div>
        <Link href="/jobs/new" className={btnPrimary}>
          <Plus className="w-4 h-4" />
          New Application
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          icon={<Briefcase className="w-5 h-5 text-zinc-400" />}
          label="Total"
          value={counts.total}
          color="bg-zinc-800"
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5 text-sky-400" />}
          label="In Interview"
          value={counts.interview}
          color="bg-sky-500/10"
        />
        <StatCard
          icon={<Award className="w-5 h-5 text-emerald-400" />}
          label="Offers"
          value={counts.offer}
          color="bg-emerald-500/10"
        />
        <StatCard
          icon={<XCircle className="w-5 h-5 text-red-400" />}
          label="Rejected"
          value={counts.rejected}
          color="bg-red-500/10"
        />
      </div>

      {/* Recent applications */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-100">Recent Applications</h2>
          <Link href="/jobs" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
            View all →
          </Link>
        </div>

        {loading ? (
          <div className="px-6 py-12 text-center text-zinc-500 text-sm">Loading…</div>
        ) : recent.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-zinc-500 text-sm">No applications yet.</p>
            <Link href="/jobs/new" className="text-indigo-400 hover:text-indigo-300 text-sm mt-2 inline-block">
              Add your first one →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                {['Company', 'Role', 'Status', 'Applied', 'Salary'].map((h) => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {recent.map((job) => (
                <tr key={job.id} className="hover:bg-zinc-800/50 transition-colors">
                  <td className="px-6 py-3 font-medium text-zinc-100">{job.company}</td>
                  <td className="px-6 py-3 text-zinc-400">{job.role}</td>
                  <td className="px-6 py-3"><StatusBadge status={job.status} /></td>
                  <td className="px-6 py-3 text-zinc-500">{formatDate(job.applied_at)}</td>
                  <td className="px-6 py-3 text-zinc-500">{formatSalary(job.gross_annual_salary)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className={`${color} border border-zinc-800 rounded-xl p-5`}>
      <div className="flex items-center justify-between mb-3">
        {icon}
      </div>
      <p className="text-2xl font-bold text-zinc-100">{value}</p>
      <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
    </div>
  )
}

const btnPrimary =
  'inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors'
