/**
 * Tests for /api/resumes (GET, POST) and /api/resumes/[id] (DELETE).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockRun = vi.fn()
const mockRunAndReadAll = vi.fn()
const mockGetDb = vi.fn(() => Promise.resolve({ run: mockRun, runAndReadAll: mockRunAndReadAll }))

vi.mock('@/lib/db', () => ({
  getDb: (...args: unknown[]) => mockGetDb(...args),
  toISO: (v: unknown) => String(v ?? new Date().toISOString()),
}))

vi.mock('@/lib/app-config', () => ({
  getDataDir: vi.fn(() => '/tmp/data'),
  resolveDataPath: (p: string) => p,
  readConfig: vi.fn(() => ({ duckdb_path: '', llm_model: '', target_currency: 'EUR', groq_api_key: '' })),
}))

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    unlinkSync: vi.fn(),
  },
}))

// crypto.randomUUID is global in Node 18+ / Next.js — no mock needed

import { GET, POST } from '@/app/api/resumes/route'
import { DELETE } from '@/app/api/resumes/[id]/route'

const RESUME_ROW = {
  id: 'resume-abc',
  name: 'My Resume',
  file_path: '/tmp/data/uploads/resumes/resume-abc.pdf',
  uploaded_at: '2024-06-01T00:00:00.000Z',
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ── GET /api/resumes ──────────────────────────────────────────────────────────

describe('GET /api/resumes', () => {
  it('returns an array of resumes', async () => {
    mockRunAndReadAll.mockResolvedValue({ getRowObjects: () => [RESUME_ROW] })

    const res = await GET()
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body[0].id).toBe('resume-abc')
  })

  it('returns 500 on DB error', async () => {
    mockGetDb.mockRejectedValueOnce(new Error('DB down'))
    const res = await GET()
    expect(res.status).toBe(500)
  })
})

// ── POST /api/resumes ─────────────────────────────────────────────────────────

async function buildFormDataRequest(file: File | null, name?: string): Promise<NextRequest> {
  const fd = new FormData()
  if (file) fd.append('file', file)
  if (name) fd.append('name', name)
  return new NextRequest('http://localhost/api/resumes', { method: 'POST', body: fd })
}

describe('POST /api/resumes', () => {
  it('returns 400 when no file is attached', async () => {
    const req = await buildFormDataRequest(null)
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/No file/)
  })

  it('returns 400 for a non-PDF file', async () => {
    const file = new File(['hello'], 'cv.docx', { type: 'application/msword' })
    const req = await buildFormDataRequest(file)
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/PDF/)
  })

  it('returns 201 and the resume row on successful upload', async () => {
    mockRun.mockResolvedValue(undefined)
    mockRunAndReadAll.mockResolvedValue({ getRowObjects: () => [RESUME_ROW] })

    const file = new File(['%PDF-1.4 content'], 'resume.pdf', { type: 'application/pdf' })
    const req = await buildFormDataRequest(file, 'My Resume')
    const res = await POST(req)
    expect(res.status).toBe(201)

    const body = await res.json()
    expect(body.id).toBe('resume-abc')
    expect(body.name).toBe('My Resume')
  })

  it('cleans up the file on disk when the DB insert fails', async () => {
    const { default: fs } = await import('fs')
    mockRun.mockRejectedValueOnce(new Error('constraint violation'))

    const file = new File(['%PDF-1.4 content'], 'resume.pdf', { type: 'application/pdf' })
    const req = await buildFormDataRequest(file)
    const res = await POST(req)
    expect(res.status).toBe(500)
    expect(fs.unlinkSync).toHaveBeenCalled()
  })
})

// ── DELETE /api/resumes/[id] ──────────────────────────────────────────────────

describe('DELETE /api/resumes/[id]', () => {
  const PARAMS = { params: Promise.resolve({ id: 'resume-abc' }) }

  it('returns 204 on success and unlinks the file', async () => {
    const { default: fs } = await import('fs')
    mockRunAndReadAll.mockResolvedValue({ getRowObjects: () => [RESUME_ROW] })
    mockRun.mockResolvedValue(undefined)

    const req = new NextRequest('http://localhost/api/resumes/resume-abc', { method: 'DELETE' })
    const res = await DELETE(req, PARAMS)
    expect(res.status).toBe(204)
    expect(fs.unlinkSync).toHaveBeenCalledWith(RESUME_ROW.file_path)
  })

  it('returns 404 when resume does not exist', async () => {
    mockRunAndReadAll.mockResolvedValue({ getRowObjects: () => [] })

    const req = new NextRequest('http://localhost/api/resumes/missing', { method: 'DELETE' })
    const res = await DELETE(req, PARAMS)
    expect(res.status).toBe(404)
  })

  it('returns 500 on DB error', async () => {
    mockGetDb.mockRejectedValueOnce(new Error('locked'))
    const req = new NextRequest('http://localhost/api/resumes/resume-abc', { method: 'DELETE' })
    const res = await DELETE(req, PARAMS)
    expect(res.status).toBe(500)
  })
})
