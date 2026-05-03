# Jobby — agent memory (Next.js + DuckDB + Groq SDK)

Dense facts for coding agents. Source: repo + prior Cursor transcripts.

## Architecture

- **Next.js (App Router)**: UI + API routes under `src/app/api/*`. Owns DuckDB, Groq LLM calls, orchestration, React-PDF generation.
- **Groq**: `groq-sdk` in `src/lib/llm.ts` — `askLLM(prompt, model?)` and `askLLMJSON<T>(prompt, model?)`. Model read from **`jobby.config.json`** each call (`readConfig().llm_model`). API key read from `readConfig().groq_api_key` — stored in `jobby.config.json`, managed via Config UI. **No env vars needed**.
- **DuckDB**: `@duckdb/node-api` in `src/lib/db.ts`. DB file path from config (`duckdb_path`). **Global singleton** (`global.__duckdb_*`) survives Next dev HMR; invalidates if `duckdb_path` changes. The `global.*` pattern is used here **specifically** because DuckDB holds an open file handle — if HMR created a second instance, it would try to open the same `.db` file and produce lock conflicts and connection leaks. Do **not** use `global.*` for caching data that holds no OS resource.

## Critical paths

| Path | Role |
|------|------|
| `jobby.config.json` | **Gitignored.** `duckdb_path`, `llm_model`, `target_currency`, `groq_api_key`. Created/updated via Config UI + `src/app/api/config/route.ts`. |
| `src/lib/app-config.ts` | `readConfig` / `writeConfig` / `getDataDir` / **`resolveDataPath`** (legacy path fix for rows created when running in Docker). |
| `src/lib/db.ts` | Schema `initSchema`, idempotent **`runMigrations`** (`ALTER ... ADD COLUMN IF NOT EXISTS` only; never delete old migration lines). |
| `src/lib/llm.ts` | `askLLM`, `askLLMJSON<T>` — Groq SDK wrapper. `response_format: json_object` enforces valid JSON; no fence-stripping needed. **5 min** timeout via `AbortSignal.timeout`. Uses `.withResponse()` to capture rate-limit headers after every call; stores them in module-level `lastRateLimits`. `fetchRateLimits()` makes a 1-token call for on-demand refresh. |
| `src/lib/llm-models.ts` | Static `LLM_MODELS` fallback list + `DEFAULT_LLM_MODEL`. |
| `src/app/api/llm-models/route.ts` | Live model list via `client.models.list()`; falls back to static list if API key missing or call fails. |
| `src/app/api/groq-limits/route.ts` | `GET` returns cached `lastRateLimits` from `llm.ts` (`{ stale: true }` if no call yet). `GET ?fresh=true` makes a 1-token call via `fetchRateLimits()` and returns fresh headers. |
| `src/lib/pdf-extractor.ts` | `extractPdfText(filePath)` — uses `unpdf` to extract text from a PDF file. Called in `prepare/route.ts` before sending to LLM. Requires `Promise.try` polyfill (see `src/instrumentation.ts`). |
| `src/instrumentation.ts` | Next.js `register()` hook — runs once on server startup. Polyfills `Promise.try` for Node < 24; without it `unpdf`/PDF.js throws "Promise.try is not a function" and `enhance/prepare` hangs with no response. |
| `src/app/api/enhance/prepare/route.ts` | `MINIMAL_PROMPT`; returns preview JSON (resume + changes). |
| `src/app/api/enhance/confirm/route.ts` | `generateResumePDF(resume)` → new PDF (ATS-oriented, React layout). |
| `src/app/api/enhance/download/[filename]/route.ts` | `GET` — serves enhanced PDFs from `{dataDir}/uploads/adapted/`. `path.basename` guards against path traversal. |
| `src/app/api/enhance/route.ts` | **Legacy one-shot** enhance (LLM → `generateResumePDF` → disk); UI flow prefers **prepare + confirm**. |
| `src/lib/pdf-generator.tsx` | `generateResumePDF(data, templateId)` — Minimal layout only. |
| `src/lib/resume-templates.ts` | Canonical template id: **`minimal`**; `DEFAULT_TEMPLATE_ID = 'minimal'`. |
| `scripts/fix-missing-history.ts` | One-off DuckDB maintenance: backfills `job_status_history`. Run with `npx tsx scripts/fix-missing-history.ts`. |

## Enhancement flow: Minimal

- **Minimal** (`prepare`: `MINIMAL_PROMPT`): LLM returns full structured **`resume`** + human-readable **`changes`** (original/replacement/reason). **`confirm`**: `generateResumePDF(resume)` → new PDF (ATS-oriented, React layout).
- **UI** (`src/app/resume/page.tsx`): resume editor preview + enhancement notes accordion.

## DuckDB path resolution

- **Default DB**: `data/app.db` under `process.cwd()` (`defaultDuckDbPath()`).
- **`readConfig` guard**: if `jobby.config.json` sets `duckdb_path` **outside** `process.cwd() + path.sep`, it is **ignored** and default under `./data` is used.
- **`resolveDataPath(storedPath)`**: if path not under cwd, finds last **`/data/`** segment and rejoins under `getDataDir()` — kept for backward compatibility with rows that stored host-absolute paths when the app ran in Docker.
- **Migrations**: `_migrationsRan` once per process; all DDL idempotent.

## Known gotchas fixed (keep regression in mind)

- **Ashby job URLs**: Board is a **SPA**; raw HTML scrape yields JS noise → LLM failures. Fix: **`GET`** `https://api.ashbyhq.com/posting-api/job-board/{board}?includeCompensation=true`, parse **`jobs`** array (not `jobPostings`), match job id UUID, map **`compensation.compensationTierSummary`**, description fields; company may be missing — **board slug fallback**. Avoid variable shadowing **`text`** vs extracted **`pageText`** in scrape route when calling LLM.
- **Enhance button disabled**: requires **`selectedResumeId`**, **`selectedJobId`**, non-empty **`jobDescription`**. Ashby company fallback **`dash0`**-style slugs may prevent auto job match — user must pick job in UI.
- **Enhance API vs UI**: Response must include **`changes: []`** not only `changes_count` — frontend maps/displays `changes`.
- **Frankfurter v2 `/currencies`**: response shape is **array of objects** or rich keyed objects — **normalize** to `{ CODE: displayName }` before combobox; **`Object.entries` on array** yields numeric keys → invalid currency codes.
- **UI**: **`overflow-hidden` on `<section>`** clips **absolute** dropdowns — remove for sections with comboboxes (utilities/config pages).
- **Remote.com cost API**: public endpoints work **without** bearer token; **currency slug** for estimation is not raw ISO — map from countries list (transcript: removed `remote_api_token` from config).
- **`Promise.try` / unpdf on Node < 24**: `unpdf` bundles PDF.js which calls `Promise.try` at runtime. Node added `Promise.try` in v24; on older versions `enhance/prepare` hangs silently (unhandled rejection, no HTTP response). Fixed via polyfill in `src/instrumentation.ts` — do not remove.

## Run

- `npm install` → `npm run dev` (port 3000)
- Open Config page, enter Groq API key (`gsk_...`) from [console.groq.com](https://console.groq.com/keys)
- Key is persisted to `jobby.config.json` (gitignored); no restart needed after changing it

## Database schema (baseline)

- **`job_status` type**: previously a DuckDB ENUM, now plain **`VARCHAR`** (DuckDB 1.5 doesn't support `ALTER TYPE ADD VALUE`). Migration converts the column via `ALTER TABLE jobs ALTER COLUMN status SET DATA TYPE VARCHAR` and updates legacy `'interview'` rows to `'hr_interview'`. Valid app-level values: `applied`, `hr_interview`, `tech_interview`, `offer`, `rejected`.
- **`resumes`**: `id`, `name`, `file_path`, `uploaded_at`.
- **`jobs`**: `id`, `company`, `role`, `url`, `status`, `applied_at`, `notes`, `gross_annual_salary INTEGER[2]`, `base_resume_id` FK → `resumes`, `resume_path`, + migrated **`description TEXT`**, migrated **`salary_currency VARCHAR`**.
- **`job_status_history`**: `id`, `job_id`, `from_status` (nullable — NULL on creation), `to_status`, `changed_at`. Populated on job INSERT and on status-changing PATCH.
- **Helpers**: `toISO`, `parseSalary` for DuckDB ↔ app types.
- **SQL in routes**: string-built queries with IDs — **escape single quotes** in paths (`replace(/'/g, "''")`) where interpolated.

## Coding conventions observed

- **Paths**: Always **`resolveDataPath`** when reading `file_path` / `resume_path` from DB for filesystem I/O.
- **Config**: Prefer **`readConfig()`** at runtime for model/key; `getClient()` in `llm.ts` reads `groq_api_key` on each call so Config page changes take effect immediately.
- **LLM JSON**: `askLLMJSON` relies on `response_format: json_object` — the model is forced to return valid JSON. No fence stripping needed.
- **Types**: Shared resume shape in **`src/lib/types.ts`** vs **`ResumeData`** in pdf-generator — keep in sync when extending schema.
- **LLM swap seam**: `src/lib/llm.ts` is the sole integration point. The Groq SDK is OpenAI-compatible — swapping to any other OpenAI-compatible provider means changing only the base URL and API key.
- **Groq rate limit cache**: `lastRateLimits` in `llm.ts` is a module-level variable (server process lifetime) populated via `.withResponse()` after every real LLM call — zero extra token cost. On the client, limits are mirrored to `localStorage` key `jobby_groq_limits_cache` for cross-reload persistence. Do **not** use `global.*` for this — it holds no OS resource (contrast with DuckDB).

<!-- BEGIN:nextjs-agent-rules -->

### Next.js: ALWAYS read docs before coding

Before any Next.js work, find and read the relevant doc in `node_modules/next/dist/docs/`. Your training data is 
outdated — the docs are the source of truth.

<!-- END:nextjs-agent-rules -->

## AI task map (Groq)

- **Job field extraction**: `src/app/api/scrape/route.ts` — `askLLMJSON` on page text. Uses `llm_model` from config (default: `llama-3.3-70b-versatile`).
- **Resume enhancement**: `prepare` route — `askLLMJSON` with `MINIMAL_PROMPT`; returns structured resume + changes.
