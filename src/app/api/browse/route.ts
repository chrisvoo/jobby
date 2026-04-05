import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import os from 'os'

export interface BrowseResult {
  path: string
  parent: string
  is_root: boolean
  dirs: string[]
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const raw = searchParams.get('path') || '~'

  // Expand ~ to home directory
  const requested = raw.startsWith('~') ? raw.replace(/^~/, os.homedir()) : raw

  try {
    const resolved = path.resolve(requested)
    const parent = path.dirname(resolved)
    const isRoot = resolved === parent

    const entries = fs.readdirSync(resolved, { withFileTypes: true })
    const dirs = entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort((a, b) => {
        // Hidden dirs go to the bottom
        const aHid = a.startsWith('.')
        const bHid = b.startsWith('.')
        if (aHid !== bHid) return aHid ? 1 : -1
        return a.localeCompare(b)
      })

    return NextResponse.json({
      path: resolved,
      parent: isRoot ? resolved : parent,
      is_root: isRoot,
      dirs,
    } satisfies BrowseResult)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Cannot read directory'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
