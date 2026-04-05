import { DuckDBInstance } from '@duckdb/node-api'
import path from 'path'
import fs from 'fs'

const DB_PATH = process.env.DUCKDB_PATH ?? path.join(process.cwd(), 'data', 'app.db')

// Survive Next.js hot-reload in development
declare global {
  // eslint-disable-next-line no-var
  var __duckdb_instance: DuckDBInstance | undefined
  // eslint-disable-next-line no-var
  var __duckdb_conn: Awaited<ReturnType<DuckDBInstance['connect']>> | undefined
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

export async function getDb() {
  if (global.__duckdb_conn) return global.__duckdb_conn

  const dir = path.dirname(DB_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  const instance = await DuckDBInstance.create(DB_PATH)
  const conn = await instance.connect()

  await initSchema(conn)

  global.__duckdb_instance = instance
  global.__duckdb_conn = conn

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
export function parseSalary(value: unknown): [number, number] | null {
  if (!value) return null
  if (Array.isArray(value) && value.length === 2) {
    return [Number(value[0]), Number(value[1])]
  }
  return null
}
