/**
 * One-time data-fix script: backfill missing history rows.
 *
 * Two passes per job:
 *  1. Ensures the history chain starts with "applied".
 *  2. If the job's current status differs from the last history to_status,
 *     inserts the missing transition (e.g. applied → rejected).
 *
 * Idempotent: safe to run multiple times.
 * Run with:  npx tsx scripts/fix-missing-history.ts
 */

import { DuckDBInstance } from '@duckdb/node-api'
import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

function resolveDbPath(): string {
  const configPath = path.join(process.cwd(), 'jobby.config.json')
  const defaultPath = path.join(process.cwd(), 'data', 'app.db')
  try {
    if (fs.existsSync(configPath)) {
      const parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
      const dbPath = parsed.duckdb_path
      if (dbPath && typeof dbPath === 'string' && dbPath.startsWith(process.cwd() + path.sep)) {
        return dbPath
      }
    }
  } catch { /* fall through */ }
  return defaultPath
}

async function main() {
  const dbPath = resolveDbPath()
  console.log(`Database: ${dbPath}`)

  if (!fs.existsSync(dbPath)) {
    console.error('Database file not found. Run the app first to create it.')
    process.exit(1)
  }

  const instance = await DuckDBInstance.create(dbPath)
  const conn = await instance.connect()

  const jobsResult = await conn.runAndReadAll(
    `SELECT id, CAST(status AS VARCHAR) AS status, applied_at FROM jobs ORDER BY applied_at ASC`,
  )
  const jobs = jobsResult.getRowObjects() as Array<{ id: string; status: string; applied_at: unknown }>

  let insertedApplied = 0
  let insertedTransition = 0
  let patchedCount = 0

  for (const job of jobs) {
    const histResult = await conn.runAndReadAll(
      `SELECT id, CAST(from_status AS VARCHAR) AS from_status, CAST(to_status AS VARCHAR) AS to_status, changed_at
       FROM job_status_history
       WHERE job_id = '${job.id}'
       ORDER BY changed_at ASC`,
    )
    const history = histResult.getRowObjects() as Array<{
      id: string; from_status: string | null; to_status: string; changed_at: unknown
    }>

    const formatTs = (v: unknown) =>
      v ? `'${v instanceof Date ? v.toISOString() : String(v)}'` : 'now()'

    // --- Pass 1: ensure chain starts with "applied" ---
    if (history.length === 0) {
      const histId = randomUUID()
      await conn.run(
        `INSERT INTO job_status_history (id, job_id, from_status, to_status, changed_at)
         VALUES ('${histId}', '${job.id}', NULL, 'applied', ${formatTs(job.applied_at)})`,
      )
      insertedApplied++
      history.push({ id: histId, from_status: null, to_status: 'applied', changed_at: job.applied_at })
      console.log(`  [INSERT] ${job.id} — added missing (NULL → applied)`)
    } else {
      const first = history[0]
      if (first.to_status !== 'applied' && !history.some((h) => h.to_status === 'applied')) {
        const histId = randomUUID()
        await conn.run(
          `INSERT INTO job_status_history (id, job_id, from_status, to_status, changed_at)
           VALUES ('${histId}', '${job.id}', NULL, 'applied', ${formatTs(job.applied_at)})`,
        )
        insertedApplied++
        console.log(`  [INSERT] ${job.id} — prepended (NULL → applied)`)

        if (!first.from_status || first.from_status === 'NULL') {
          await conn.run(
            `UPDATE job_status_history SET from_status = 'applied' WHERE id = '${first.id}'`,
          )
          patchedCount++
          console.log(`  [PATCH]  ${job.id} — set from_status='applied' on row ${first.id}`)
        }
      }
    }

    // --- Pass 2: ensure chain ends at the job's current status ---
    const lastToStatus = history[history.length - 1]?.to_status
    if (lastToStatus && lastToStatus !== job.status) {
      const alreadyHasTransition = history.some((h) => h.to_status === job.status)
      if (!alreadyHasTransition) {
        const histId = randomUUID()
        await conn.run(
          `INSERT INTO job_status_history (id, job_id, from_status, to_status)
           VALUES ('${histId}', '${job.id}', '${lastToStatus}', '${job.status}')`,
        )
        insertedTransition++
        console.log(`  [INSERT] ${job.id} — added missing transition (${lastToStatus} → ${job.status})`)
      }
    }
  }

  await conn.run('CHECKPOINT')

  console.log(`\nDone. ${jobs.length} jobs scanned.`)
  console.log(`  Inserted: ${insertedApplied} missing "applied" rows`)
  console.log(`  Inserted: ${insertedTransition} missing transition rows`)
  console.log(`  Patched:  ${patchedCount} from_status fields`)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
