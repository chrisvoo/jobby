import { cn, STATUS_COLORS, STATUS_LABELS } from '@/lib/utils'
import type { JobStatus } from '@/lib/types'

export function StatusBadge({ status }: { status: JobStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border',
        STATUS_COLORS[status],
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}
