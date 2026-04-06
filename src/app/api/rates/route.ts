import { NextRequest, NextResponse } from 'next/server'

const FRANKFURTER_BASE = 'https://api.frankfurter.dev/v2'

// Simple in-process cache for the currency list (refreshed every 24h)
let currenciesCache: Record<string, string> | null = null
let currenciesCachedAt = 0
const CURRENCIES_TTL_MS = 24 * 60 * 60 * 1000

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  // ── /api/rates?currencies=true — list all available currencies ──────────
  if (searchParams.get('currencies') === 'true') {
    const now = Date.now()
    if (!currenciesCache || now - currenciesCachedAt > CURRENCIES_TTL_MS) {
      try {
        const res = await fetch(`${FRANKFURTER_BASE}/currencies`)
        if (!res.ok) throw new Error(`Frankfurter error: ${res.status}`)
        // v2 may return an array of objects [{ iso_code, name, ... }]
        // or a keyed map { EUR: "Euro" } / { EUR: { name, ... } }.
        // Normalize everything to the simple { EUR: "Euro", ... } shape the UI expects.
        const raw = await res.json() as unknown
        if (Array.isArray(raw)) {
          currenciesCache = Object.fromEntries(
            (raw as { iso_code?: string; name?: string }[])
              .filter((item) => item.iso_code)
              .map((item) => [item.iso_code!, item.name ?? item.iso_code!]),
          )
        } else {
          currenciesCache = Object.fromEntries(
            Object.entries(raw as Record<string, string | { name?: string }>).map(([code, val]) => [
              code,
              typeof val === 'string' ? val : (val?.name ?? code),
            ]),
          )
        }
        currenciesCachedAt = now
      } catch (err) {
        return NextResponse.json(
          { error: err instanceof Error ? err.message : 'Failed to fetch currencies' },
          { status: 502 },
        )
      }
    }
    return NextResponse.json(currenciesCache)
  }

  // ── /api/rates?from=X&to=Y&amount=N — convert an amount ────────────────
  const from = searchParams.get('from')?.toUpperCase()
  const to = searchParams.get('to')?.toUpperCase()
  const amountStr = searchParams.get('amount')

  if (!from || !to) {
    return NextResponse.json({ error: 'from and to query params are required' }, { status: 400 })
  }

  const amount = amountStr ? parseFloat(amountStr) : 1
  if (isNaN(amount) || amount <= 0) {
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 })
  }

  if (from === to) {
    return NextResponse.json({ from, to, amount, result: amount, rate: 1, date: new Date().toISOString().slice(0, 10) })
  }

  try {
    const res = await fetch(`${FRANKFURTER_BASE}/rate/${from}/${to}`)
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { message?: string }
      return NextResponse.json(
        { error: body.message ?? `Frankfurter error: ${res.status}` },
        { status: res.status === 404 ? 404 : 502 },
      )
    }
    const data = await res.json() as { rate: number; date: string; base_currency: string; quote_currency: string }
    return NextResponse.json({
      from,
      to,
      amount,
      result: parseFloat((amount * data.rate).toFixed(6)),
      rate: data.rate,
      date: data.date,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch rate' },
      { status: 502 },
    )
  }
}
