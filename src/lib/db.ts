import { DuckDBInstance } from '@duckdb/node-api'
import path from 'path'
import fs from 'fs'
import { readConfig } from './app-config'

// Survive Next.js hot-reload in development
declare global {
  var __duckdb_instance: DuckDBInstance | undefined
  var __duckdb_conn: Awaited<ReturnType<DuckDBInstance['connect']>> | undefined
  var __duckdb_path: string | undefined
}

async function initSchema(conn: Awaited<ReturnType<DuckDBInstance['connect']>>) {
  // No longer using a DuckDB ENUM for job_status — status is plain VARCHAR.
  // Any legacy `job_status` ENUM type created by older versions is left in place (unused).

  await conn.run(`
    CREATE TABLE IF NOT EXISTS resumes (
      id      VARCHAR PRIMARY KEY,
      name    VARCHAR NOT NULL,
      file_path VARCHAR NOT NULL,
      uploaded_at TIMESTAMP DEFAULT now()
    );
  `)

  await conn.run(`
    CREATE TABLE IF NOT EXISTS jobs (
      id                  VARCHAR PRIMARY KEY,
      company             VARCHAR NOT NULL,
      role                VARCHAR NOT NULL,
      url                 VARCHAR,
      status              VARCHAR DEFAULT 'applied',
      applied_at          TIMESTAMP DEFAULT now(),
      notes               TEXT,
      gross_annual_salary INTEGER[],
      base_resume_id      VARCHAR REFERENCES resumes(id),
      resume_path         VARCHAR
    );
  `)
}

// Migrations run once per process (not per request).
// All statements must be idempotent (IF NOT EXISTS / IF EXISTS).
// Add new ALTER TABLE statements here — never edit or remove old ones.
let _migrationsRan = false
async function runMigrations(conn: Awaited<ReturnType<DuckDBInstance['connect']>>) {
  if (_migrationsRan) return
  await conn.run(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS description TEXT`)
  await conn.run(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS salary_currency VARCHAR`)

  // Convert the legacy job_status ENUM column to plain VARCHAR (idempotent — already VARCHAR is a no-op).
  // This also allows the new hr_interview / tech_interview values without DuckDB ALTER TYPE limitations.
  await conn.run(`ALTER TABLE jobs ALTER COLUMN status SET DATA TYPE VARCHAR`)

  // Migrate legacy 'interview' rows → 'hr_interview' (idempotent)
  await conn.run(`UPDATE jobs SET status = 'hr_interview' WHERE status = 'interview'`)

  // Status history table — records every status transition per job
  await conn.run(`
    CREATE TABLE IF NOT EXISTS job_status_history (
      id          VARCHAR PRIMARY KEY,
      job_id      VARCHAR NOT NULL,
      from_status VARCHAR,
      to_status   VARCHAR NOT NULL,
      changed_at  TIMESTAMP DEFAULT now()
    )
  `)

  // Flush all WAL entries into the main DB file so that a clean container restart
  // never has to replay ALTER TABLE statements (DuckDB has a WAL replay bug where
  // ALTER TABLE ADD COLUMN fails if the table has columns with DEFAULT expressions).
  await conn.run(`CHECKPOINT`)
  _migrationsRan = true
}

export async function getDb() {
  const dbPath = readConfig().duckdb_path

  if (global.__duckdb_conn && global.__duckdb_path === dbPath) {
    await runMigrations(global.__duckdb_conn)
    return global.__duckdb_conn
  }

  if (global.__duckdb_conn && global.__duckdb_path !== dbPath) {
    global.__duckdb_conn = undefined
    global.__duckdb_instance = undefined
    _migrationsRan = false
  }

  const dir = path.dirname(dbPath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  const instance = await DuckDBInstance.create(dbPath)
  const conn = await instance.connect()

  await initSchema(conn)
  await runMigrations(conn)

  global.__duckdb_instance = instance
  global.__duckdb_conn = conn
  global.__duckdb_path = dbPath

  return conn
}

// Safely convert a DuckDB timestamp to ISO string
export function toISO(value: unknown): string {
  if (!value) return new Date().toISOString()
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'bigint') return new Date(Number(value) / 1000).toISOString()
  return String(value)
}

// Parse DuckDB INTEGER[] back to [number, number] | null
// @duckdb/node-api returns list types as DuckDBListValue { items: [...] }, not a plain JS array
export function parseSalary(value: unknown): [number, number] | null {
  if (!value) return null
  const items =
    Array.isArray(value)
      ? value
      : (value as { items?: unknown[] })?.items
  if (Array.isArray(items) && items.length === 2) {
    return [Number(items[0]), Number(items[1])]
  }
  return null
}
