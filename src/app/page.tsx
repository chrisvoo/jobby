'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Briefcase, TrendingUp, Award, XCircle, Plus, ArrowRight } from 'lucide-react'
import { StatusBadge } from '@/components/status-badge'

interface PathEntry {
  path: string[]
  count: number
}

interface DashboardData {
  months: number
  stats: { total: number; interview: number; offer: number; rejected: number; ghosted: number }
  paths: PathEntry[]
}

const TIME_OPTIONS = [
  { value: 3, label: 'Last 3 months' },
  { value: 6, label: 'Last 6 months' },
  { value: 12, label: 'Last 12 months' },
]

export default function DashboardPage() {
  const [months, setMonths] = useState(3)
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchDashboard = useCallback(async (m: number) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/dashboard?months=${m}`)
      const json = await res.json()
      setData(json)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDashboard(months)
  }, [months, fetchDashboard])

  const stats = data?.stats ?? { total: 0, interview: 0, offer: 0, rejected: 0, ghosted: 0 }
  const paths = data?.paths ?? []

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-100">Dashboard</h1>
            <p className="text-zinc-500 text-sm mt-1">Your job search at a glance</p>
          </div>
          <select
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
            className="bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {TIME_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <Link href="/jobs/new" className={btnPrimary} title="New Application">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New Application</span>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard
          icon={<Briefcase className="w-5 h-5 text-zinc-400" />}
          label="Total"
          value={stats.total}
          color="bg-zinc-800"
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5 text-sky-400" />}
          label="In Interview"
          value={stats.interview}
          color="bg-sky-500/10"
        />
        <StatCard
          icon={<Award className="w-5 h-5 text-emerald-400" />}
          label="Offers"
          value={stats.offer}
          color="bg-emerald-500/10"
        />
        <StatCard
          icon={<XCircle className="w-5 h-5 text-red-400" />}
          label="Rejected"
          value={stats.rejected}
          color="bg-red-500/10"
        />
        <StatCard
          icon={<span className="text-lg leading-none">👻</span>}
          label="Ghosted"
          value={stats.ghosted}
          color="bg-fuchsia-500/10"
        />
      </div>

      {/* Application Flow */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-100">Application Flow</h2>
          <p className="text-xs text-zinc-400 mt-0.5">Status transition paths for your applications</p>
        </div>

        {loading ? (
          <div className="px-6 py-12 text-center text-zinc-500 text-sm">Loading…</div>
        ) : paths.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-zinc-500 text-sm">No application data for this period.</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/60">
            {paths.map((entry, i) => (
              <div key={i} className="px-6 py-3 flex items-center justify-between gap-4 hover:bg-zinc-800/30 transition-colors">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  {entry.path.map((status, si) => (
                    <span key={si} className="flex items-center gap-2">
                      {si > 0 && <ArrowRight className="w-4 h-4 text-zinc-400 shrink-0" />}
                      {status === 'ghosted' ? (
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium border border-dashed bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/30"
                          title="No activity for 45+ days"
                        >
                          <span className="text-sm leading-none">👻</span>
                          Ghosted
                        </span>
                      ) : (
                        <StatusBadge status={status} />
                      )}
                    </span>
                  ))}
                </div>
                <span className="text-sm font-semibold text-zinc-200 tabular-nums shrink-0">{entry.count}</span>
              </div>
            ))}
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
      <p className="text-xs text-zinc-400 mt-0.5">{label}</p>
    </div>
  )
}

const btnPrimary =
  'inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors'
