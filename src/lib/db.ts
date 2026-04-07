import { DuckDBInstance } from '@duckdb/node-api'
import path from 'path'
import fs from 'fs'
import { readConfig } from './app-config'

// Survive Next.js hot-reload in development
declare global {
  // eslint-disable-next-line no-var
  var __duckdb_instance: DuckDBInstance | undefined
  // eslint-disable-next-line no-var
  var __duckdb_conn: Awaited<ReturnType<DuckDBInstance['connect']>> | undefined
  // eslint-disable-next-line no-var
  var __duckdb_path: string | undefined
}

async function initSchema(conn: Awaited<ReturnType<DuckDBInstance['connect']>>) {
  await conn.run(`
    CREATE TYPE IF NOT EXISTS job_status AS ENUM ('applied', 'interview', 'offer', 'rejected');
  `)

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
      status              job_status DEFAULT 'applied',
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
