'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Briefcase, FileText, Info, Menu, X, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/jobs', label: 'Jobs', icon: Briefcase },
  { href: '/resume', label: 'Resume', icon: FileText },
  { href: '/config', label: 'Settings', icon: Settings },
  { href: '/about', label: 'About', icon: Info },
]

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center shrink-0">
        <Briefcase className="w-4 h-4 text-white" />
      </div>
      <span className="text-zinc-100 font-semibold text-lg tracking-tight">Jobby</span>
    </div>
  )
}

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex-1 px-3 py-4 space-y-0.5">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
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
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      {/* ── Desktop sidebar ─────────────────────────────── */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-60 bg-zinc-900 border-r border-zinc-800 flex-col z-10">
        <div className="px-6 py-5 border-b border-zinc-800">
          <Logo />
        </div>
        <NavLinks pathname={pathname} />
        <div className="px-6 py-4 border-t border-zinc-800">
          <p className="text-xs text-zinc-600">Jobby v0.1.0</p>
        </div>
      </aside>

      {/* ── Mobile top header ───────────────────────────── */}
      <header className="md:hidden fixed top-0 inset-x-0 h-14 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-4 z-20">
        <Logo />
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      </header>

      {/* ── Mobile drawer ───────────────────────────────── */}
      {mobileOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-black/60 z-30"
            onClick={() => setMobileOpen(false)}
          />
          <div className="md:hidden fixed inset-y-0 left-0 w-72 bg-zinc-900 border-r border-zinc-800 flex flex-col z-40">
            <div className="px-6 py-5 border-b border-zinc-800 flex items-center justify-between">
              <Logo />
              <button
                onClick={() => setMobileOpen(false)}
                className="p-1 rounded-lg text-zinc-500 hover:text-zinc-300 transition-colors"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <NavLinks pathname={pathname} onNavigate={() => setMobileOpen(false)} />
            <div className="px-6 py-4 border-t border-zinc-800">
              <p className="text-xs text-zinc-600">Jobby v0.1.0</p>
            </div>
          </div>
        </>
      )}
    </>
  )
}
