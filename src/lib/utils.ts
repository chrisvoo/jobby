import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { JobStatus } from './types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatSalary(range: [number, number] | null, currency?: string | null): string {
  if (!range) return '—'
  const cur = currency || 'EUR'
  const fmt = (n: number) => {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: cur,
        maximumFractionDigits: 0,
      }).format(n)
    } catch {
      return n.toLocaleString('en-US')
    }
  }
  return `${fmt(range[0])} – ${fmt(range[1])}`
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export const STATUS_LABELS: Record<JobStatus, string> = {
  applied: 'Applied',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
}

export const STATUS_COLORS: Record<JobStatus, string> = {
  applied: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  interview: 'bg-sky-500/15 text-sky-400 border-sky-500/25',
  offer: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  rejected: 'bg-red-500/15 text-red-400 border-red-500/25',
}
