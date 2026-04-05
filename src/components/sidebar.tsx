'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Briefcase, FileText, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/jobs', label: 'Jobs', icon: Briefcase },
  { href: '/resume', label: 'Resume', icon: FileText },
  { href: '/about', label: 'About', icon: Info },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed inset-y-0 left-0 w-60 bg-zinc-900 border-r border-zinc-800 flex flex-col z-10">
      <div className="px-6 py-5 border-b border-zinc-800">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
            <Briefcase className="w-4 h-4 text-white" />
          </div>
          <span className="text-zinc-100 font-semibold text-lg tracking-tight">Jobby</span>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active =
            href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-indigo-600/15 text-indigo-400'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800',
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="px-6 py-4 border-t border-zinc-800">
        <p className="text-xs text-zinc-600">Jobby v0.1.0</p>
      </div>
    </aside>
  )
}
