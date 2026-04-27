import { cn, STATUS_COLORS, STATUS_LABELS } from '@/lib/utils'
import type { JobStatus } from '@/lib/types'

// Legacy values that may exist in older databases before migration
const LEGACY_LABELS: Record<string, string> = { interview: 'Interview' }
const LEGACY_COLORS = 'bg-sky-500/15 text-sky-400 border-sky-500/25'

export function StatusBadge({ status }: { status: JobStatus | string }) {
  const label = STATUS_LABELS[status as JobStatus] ?? LEGACY_LABELS[status] ?? status
  const color = STATUS_COLORS[status as JobStatus] ?? LEGACY_COLORS
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border',
        color,
      )}
    >
      {label}
    </span>
  )
}
