# Jobby — agent memory (Next.js + DuckDB + Claude SDK)

Dense facts for coding agents. Source: repo + prior Cursor transcripts.

## Architecture

- **Next.js (App Router)**: UI + API routes under `src/app/api/*`. Owns DuckDB, Claude calls, orchestration, React-PDF generation.
- **Claude**: `@anthropic-ai/claude-agent-sdk` in `src/lib/claude.ts` — `query({ prompt, options: { allowedTools: [], model, settingSources: ['user'] } })`. Collects assistant text blocks; **no API key in env** — uses same session as `claude` CLI (**OAuth** + optional credential file). Model read from **`jobby.config.json`** each call (`readConfig().claude_model`).
- **DuckDB**: `@duckdb/node-api` in `src/lib/db.ts`. DB file path from config (`duckdb_path`). **Global singleton** (`global.__duckdb_*`) survives Next dev HMR; invalidates if `duckdb_path` changes.
- **Docker Compose**: single `node` service. Bind `./data:/app/data`.

## Critical paths

| Path | Role |
|------|------|
| `jobby.config.json` | **Gitignored.** `duckdb_path`, `claude_model`, `target_currency`. Created/updated via Config UI + `src/app/api/config/route.ts`. |
| `src/lib/app-config.ts` | `readConfig` / `writeConfig` / `getDataDir` / **`resolveDataPath`** (host→container path fix). |
| `src/lib/db.ts` | Schema `initSchema`, idempotent **`runMigrations`** (`ALTER ... ADD COLUMN IF NOT EXISTS` only; never delete old migration lines). |
| `src/lib/claude.ts` | `askClaude`, `askClaudeJSON` (fence strip + bracket-count JSON salvage). **5 min** timeout. |
| `src/app/api/enhance/prepare/route.ts` | `MINIMAL_PROMPT`; returns preview JSON (resume + changes). |
| `src/app/api/enhance/confirm/route.ts` | `generateResumePDF(resume)` → new PDF (ATS-oriented, React layout). |
| `src/app/api/enhance/route.ts` | **Legacy one-shot** enhance (Claude → `generateResumePDF` → disk); UI flow prefers **prepare + confirm**. |
| `src/lib/pdf-generator.tsx` | `generateResumePDF(data, templateId)` — Minimal layout only. |
| `src/lib/resume-templates.ts` | Canonical template id: **`minimal`**; `DEFAULT_TEMPLATE_ID = 'minimal'`. |
| `docker-compose.yml` / `docker-compose.dev.yml` | Prod vs dev stacks; see Run section. |
| `Dockerfile.node` / `Dockerfile.node.dev` | Prod standalone Next build vs `next dev`. |
| `scripts/start.sh` | Preconditions, **macOS Keychain → `.credentials.json` export**, compose up, open browser. |
| `scripts/start.bat` | Windows equivalent of `start.sh`. |
| `scripts/export-credentials.sh` | Standalone macOS Keychain → `~/.claude/.credentials.json` re-export (no-op on Linux). |

## Enhancement flow: Minimal

- **Minimal** (`prepare`: `MINIMAL_PROMPT`): Claude returns full structured **`resume`** + human-readable **`changes`** (original/replacement/reason). **`confirm`**: `generateResumePDF(resume)` → new PDF (ATS-oriented, React layout).
- **UI** (`src/app/resume/page.tsx`): resume editor preview + Claude's notes accordion.

## DuckDB path resolution (Docker + config)

- **Default DB**: `data/app.db` under `process.cwd()` (`defaultDuckDbPath()`).
- **`readConfig` guard**: if `jobby.config.json` sets `duckdb_path` **outside** `process.cwd() + path.sep`, it is **ignored** and default under `./data` is used — avoids broken host-absolute paths inside container.
- **`resolveDataPath(storedPath)`**: if path not under cwd, finds last **`/data/`** segment and rejoins under `getDataDir()` so rows created on host still resolve when Node runs in Docker with `./data` mounted at `/app/data`.
- **Migrations**: `_migrationsRan` once per process; all DDL idempotent. Example: `jobs.description` via `ALTER TABLE ... IF NOT EXISTS`.

## Claude OAuth / credentials in Docker

- **Prod compose** mounts **`${HOME}/.claude.json` → `/home/nextjs/.claude.json`** and **`${HOME}/.claude/.credentials.json` → `/home/nextjs/.claude/.credentials.json`** (read-only). Runner user **nextjs** (uid 1001).
- **Dev compose** mounts same files to **`/root/.`** — `Dockerfile.node.dev` runs as root; matches SDK path expectations inside container.
- **macOS**: OAuth tokens often live in **Keychain**; containers cannot read Keychain. **`scripts/start.sh`** runs `security find-generic-password -a "$USER" -s "Claude Code-credentials" -w` and writes **`~/.claude/.credentials.json`** (chmod 600) so the SDK fallback works when bind-mounted. **`scripts/export-credentials.sh`** does the same export standalone (for token refresh without full restart).
- **Linux host**: may already have plaintext credentials under `~/.claude/`; script mostly no-ops except file check.
- **Troubleshooting (from transcripts)**: stale **`customApiKeyResponses.approved`** in `~/.claude.json` can force bad auth paths — clearing/fixing CLI auth may be required; surface **`auth_status`** errors from SDK in UI where possible.

## Known gotchas fixed (keep regression in mind)

- **Ashby job URLs**: Board is a **SPA**; raw HTML scrape yields JS noise → Claude failures. Fix: **`GET`** `https://api.ashbyhq.com/posting-api/job-board/{board}?includeCompensation=true`, parse **`jobs`** array (not `jobPostings`), match job id UUID, map **`compensation.compensationTierSummary`**, description fields; company may be missing — **board slug fallback**. Avoid variable shadowing **`text`** vs extracted **`pageText`** in scrape route when calling Claude.
- **Enhance button disabled**: requires **`selectedResumeId`**, **`selectedJobId`**, non-empty **`jobDescription`**. Ashby company fallback **`dash0`**-style slugs may prevent auto job match — user must pick job in UI.
- **Enhance API vs UI**: Response must include **`changes: []`** not only `changes_count` — frontend maps/displays `changes`.
- **Frankfurter v2 `/currencies`**: response shape is **array of objects** or rich keyed objects — **normalize** to `{ CODE: displayName }` before combobox; **`Object.entries` on array** yields numeric keys → invalid currency codes.
- **UI**: **`overflow-hidden` on `<section>`** clips **absolute** dropdowns — remove for sections with comboboxes (utilities/config pages).
- **Remote.com cost API**: public endpoints work **without** bearer token; **currency slug** for estimation is not raw ISO — map from countries list (transcript: removed `remote_api_token` from config).

## Run: dev vs prod

- **Local (no Docker)**: `npm install` → `npm run dev` (port 3000). Ensure `claude` CLI logged in.
- **Docker prod**: `./scripts/start.sh` or `docker compose up --build -d` — uses **`Dockerfile.node`** (standalone output). Requires **`~/.claude.json`** and exportable **`.credentials.json`** (see `scripts/start.sh`).
- **Docker dev**: `./scripts/start.sh --dev` or `docker compose -f docker-compose.dev.yml up --build -d` — bind-mount **`.` → `/app`**, named volume **`node_modules`**, **`WATCHPACK_POLLING`** in dev image for file watching.

## Database schema (baseline)

- **`job_status` type**: previously a DuckDB ENUM, now plain **`VARCHAR`** (DuckDB 1.5 doesn't support `ALTER TYPE ADD VALUE`). Migration converts the column via `ALTER TABLE jobs ALTER COLUMN status SET DATA TYPE VARCHAR` and updates legacy `'interview'` rows to `'hr_interview'`. Valid app-level values: `applied`, `hr_interview`, `tech_interview`, `offer`, `rejected`.
- **`resumes`**: `id`, `name`, `file_path`, `uploaded_at`.
- **`jobs`**: `id`, `company`, `role`, `url`, `status`, `applied_at`, `notes`, `gross_annual_salary INTEGER[2]`, `base_resume_id` FK → `resumes`, `resume_path`, + migrated **`description TEXT`**.
- **`job_status_history`**: `id`, `job_id`, `from_status` (nullable — NULL on creation), `to_status`, `changed_at`. Populated on job INSERT and on status-changing PATCH.
- **Helpers**: `toISO`, `parseSalary` for DuckDB ↔ app types.
- **SQL in routes**: string-built queries with IDs — **escape single quotes** in paths (`replace(/'/g, "''")`) where interpolated.

## Coding conventions observed

- **Paths**: Always **`resolveDataPath`** when reading `file_path` / `resume_path` from DB for filesystem I/O.
- **Config**: Prefer **`readConfig()`** at runtime for model/path; changing **`duckdb_path`** effectively requires new DB connection (handled in `getDb`).
- **Claude JSON**: Defensive parse in **`askClaudeJSON`**; prompts ask for raw JSON but models still wrap in fences sometimes.
- **Types**: Shared resume shape in **`src/lib/types.ts`** vs **`ResumeData`** in pdf-generator — keep in sync when extending schema.
- **Optional LLM swap** (transcript/wiki): replacing `claude.ts` with OpenAI-compatible HTTP client is the intended seam; **`/api/scrape`** and **`/api/enhance/prepare`** are the call sites.

<!-- BEGIN:nextjs-agent-rules -->

### Next.js: ALWAYS read docs before coding

Before any Next.js work, find and read the relevant doc in `node_modules/next/dist/docs/`. Your training data is 
outdated — the docs are the source of truth.

<!-- END:nextjs-agent-rules -->

## AI task map (Claude)

- **Job field extraction**: `src/app/api/scrape/route.ts` — `askClaudeJSON` on page text (Haiku model may be passed for cost).
- **Resume enhancement**: `prepare` route — Sonnet/config model; Minimal prompt only.
