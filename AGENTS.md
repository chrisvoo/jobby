# Jobby — agent memory (Next.js + Python + DuckDB + Claude SDK)

Dense facts for coding agents. Source: repo + prior Cursor transcripts.

## Architecture

- **Next.js (App Router)**: UI + API routes under `src/app/api/*`. Owns DuckDB, Claude calls, orchestration, React-PDF generation for Minimal template.
- **Python sidecar** (`scripts/pdf_replace.py`): single-process `HTTPServer` on `PORT` (default **5001**). **GET `/health`**, **POST `/replace`** with JSON `{ input_pdf, output_pdf, replacements: [{old,new}] }`. Uses **PyMuPDF (`fitz`)**: locate text → redact rects → `insert_textbox` with captured font/size/color (Base-14 fallback when subset fonts unusable).
- **Claude**: `@anthropic-ai/claude-agent-sdk` in `src/lib/claude.ts` — `query({ prompt, options: { allowedTools: [], model, settingSources: ['user'] } })`. Collects assistant text blocks; **no API key in env** — uses same session as `claude` CLI (**OAuth** + optional credential file). Model read from **`jobby.config.json`** each call (`readConfig().claude_model`).
- **DuckDB**: `@duckdb/node-api` in `src/lib/db.ts`. DB file path from config (`duckdb_path`). **Global singleton** (`global.__duckdb_*`) survives Next dev HMR; invalidates if `duckdb_path` changes.
- **Docker Compose**: `node` + `python` services. Bind `./data:/app/data` on both. Node env **`PYTHON_SIDECAR_URL=http://python:5001`**. Python **only `expose` 5001** (no host publish) — Node reaches it by service name.

## Critical paths

| Path | Role |
|------|------|
| `jobby.config.json` | **Gitignored.** `duckdb_path`, `claude_model`, `target_currency`. Created/updated via Config UI + `src/app/api/config/route.ts`. |
| `src/lib/app-config.ts` | `readConfig` / `writeConfig` / `getDataDir` / **`resolveDataPath`** (host→container path fix). |
| `src/lib/db.ts` | Schema `initSchema`, idempotent **`runMigrations`** (`ALTER ... ADD COLUMN IF NOT EXISTS` only; never delete old migration lines). |
| `src/lib/claude.ts` | `askClaude`, `askClaudeJSON` (fence strip + bracket-count JSON salvage). **5 min** timeout. |
| `src/app/api/enhance/prepare/route.ts` | Two prompts: **Minimal** vs **Pixel-Perfect**; returns preview JSON only. |
| `src/app/api/enhance/confirm/route.ts` | Minimal → `generateResumePDF`; Pixel-Perfect → **`fetch(PYTHON_SIDECAR_URL/replace)`**. |
| `src/app/api/enhance/route.ts` | **Legacy one-shot** enhance (Claude → `generateResumePDF` → disk); UI flow prefers **prepare + confirm**. |
| `src/lib/pdf-generator.tsx` | `generateResumePDF(data, templateId)` — **`templateId` mostly reserved**; only Minimal layout implemented (`_templateId` comment in code). |
| `src/lib/resume-templates.ts` | Canonical template ids: **`minimal`**, **`pixel-perfect`**; `DEFAULT_TEMPLATE_ID = 'minimal'`. |
| `scripts/pdf_replace.py` | Pixel-perfect engine; `scripts/requirements.txt` for deps. |
| `docker-compose.yml` / `docker-compose.dev.yml` | Prod vs dev stacks; see Run section. |
| `Dockerfile.node` / `Dockerfile.node.dev` / `Dockerfile.python` | Prod standalone Next build vs `next dev` vs Python image. |
| `start.sh` | Preconditions, **macOS Keychain → `.credentials.json` export**, compose up, open browser. |

## Enhancement templates: Minimal vs Pixel-Perfect

- **Minimal** (`prepare`: `MINIMAL_PROMPT`): Claude returns full structured **`resume`** + human-readable **`changes`** (original/replacement/reason). **`confirm`**: `generateResumePDF(resume)` → new PDF (ATS-oriented, React layout). No Python sidecar.
- **Pixel-Perfect** (`prepare`: `PIXEL_PERFECT_PROMPT`): Claude returns **`replacements`** `{ section, old, new, reason }` only (no full `resume` for PDF). **`old` must be verbatim** from extracted resume text. Prompt **length rule**: new text must not exceed **~10% more words** than old (fixed bounding boxes). **`confirm`**: maps to `{old,new}`, resolves **`resume_path`**, POSTs to sidecar. Sidecar paths must exist **inside container** (same `/app/data` mount as Node).
- **UI** (`src/app/resume/page.tsx`): template picker; preview differs (replacements table vs structured resume); can **re-enhance** toggling template.

## PDF replacement algorithm (pixel-perfect) — implementation facts

- **Locate** (`_find_region`): (1) `search_for(full old_text)` (2) per-line union if lines >8 chars; reject union if height **> 45% page** (false matches) (3) first **6 words** anchor.
- **Style**: first span containing anchor → font name, size, flags, color → **`_font_for_redact`** → Base-14 substitute if not embeddable.
- **Measure first** (`_measure_textbox`): probe overflow on a **throwaway temp page** before touching the real document. If `overflow < 0`, trigger reflow then expand the insert rect.
- **Reflow** (`_reflow`): works at **LINE level** (not block level — crucial because all work-experience entries often live in one PDF block). Collects every line with `ly0 > changed_rect.y1` in the same column, snapshots span data, redacts those line rects, re-inserts spans at `origin_y + delta`. Then calls `_shift_drawings`.
- **Column detection** (`_detect_column`): clusters text-block left-edges (`bx0`); finds the largest x-gap → separator; if gap < 10% page width → single column. Skips blocks wider than 60% of page (full-width headers).
- **Path adjustment** (`_shift_drawings`): only handles single-`'re'` (rectangle) paths. Rects entirely below shift point → cover with white + redraw shifted. Rects straddling shift point (sidebars) → add extension rect below unless already page-height.
- **Insert**: `insert_textbox` in (possibly expanded) rect; try font sizes **`1.0, 0.95, …, 0.75`** of original; **`overflow >= 0`** = success; else warning **"Text overflow even at 75% font size"**.
- **Unicode**: `_safe_text` maps smart quotes, bullets, em-dash, NBSP, etc. to ASCII for Base-14 safety.
- **Empty `new`**: skipped (logged).

## DuckDB path resolution (Docker + config)

- **Default DB**: `data/app.db` under `process.cwd()` (`defaultDuckDbPath()`).
- **`readConfig` guard**: if `jobby.config.json` sets `duckdb_path` **outside** `process.cwd() + path.sep`, it is **ignored** and default under `./data` is used — avoids broken host-absolute paths inside container.
- **`resolveDataPath(storedPath)`**: if path not under cwd, finds last **`/data/`** segment and rejoins under `getDataDir()` so rows created on host still resolve when Node runs in Docker with `./data` mounted at `/app/data`.
- **Migrations**: `_migrationsRan` once per process; all DDL idempotent. Example: `jobs.description` via `ALTER TABLE ... IF NOT EXISTS`.

## Claude OAuth / credentials in Docker

- **Prod compose** mounts **`${HOME}/.claude.json` → `/home/nextjs/.claude.json`** and **`${HOME}/.claude/.credentials.json` → `/home/nextjs/.claude/.credentials.json`** (read-only). Runner user **nextjs** (uid 1001).
- **Dev compose** mounts same files to **`/root/.`** — `Dockerfile.node.dev` runs as root; matches SDK path expectations inside container.
- **macOS**: OAuth tokens often live in **Keychain**; containers cannot read Keychain. **`start.sh`** runs `security find-generic-password -a "$USER" -s "Claude Code-credentials" -w` and writes **`~/.claude/.credentials.json`** (chmod 600) so the SDK fallback works when bind-mounted.
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

- **Local (no Docker)**: `npm install` → `npm run dev` (port 3000). Run Python manually if using pixel-perfect: `pip install -r scripts/requirements.txt` → `python scripts/pdf_replace.py` (default localhost:5001). Ensure `claude` CLI logged in; **`PYTHON_SIDECAR_URL`** unset defaults to `http://localhost:5001`.
- **Docker prod**: `./start.sh` or `docker compose up --build -d` — uses **`Dockerfile.node`** (standalone output), **`Dockerfile.python`**. Requires **`~/.claude.json`** and exportable **`.credentials.json`** (see `start.sh`).
- **Docker dev**: `./start.sh --dev` or `docker compose -f docker-compose.dev.yml up --build -d` — bind-mount **`.` → `/app`**, named volume **`node_modules`**, **`WATCHPACK_POLLING`** in dev image for file watching.

## Database schema (baseline)

- **ENUM** `job_status`: `applied`, `interview`, `offer`, `rejected`.
- **`resumes`**: `id`, `name`, `file_path`, `uploaded_at`.
- **`jobs`**: `id`, `company`, `role`, `url`, `status`, `applied_at`, `notes`, `gross_annual_salary INTEGER[2]`, `base_resume_id` FK → `resumes`, `resume_path`, + migrated **`description TEXT`**.
- **Helpers**: `toISO`, `parseSalary` for DuckDB ↔ app types.
- **SQL in routes**: string-built queries with IDs — **escape single quotes** in paths (`replace(/'/g, "''")`) where interpolated.

## Coding conventions observed

- **Paths**: Always **`resolveDataPath`** when reading `file_path` / `resume_path` from DB for filesystem or sidecar I/O.
- **Config**: Prefer **`readConfig()`** at runtime for model/path; changing **`duckdb_path`** effectively requires new DB connection (handled in `getDb`).
- **Sidecar**: Use **`AbortSignal.timeout(60_000)`** (or similar) on `fetch` to `/replace`; treat **502** if sidecar errors.
- **Claude JSON**: Defensive parse in **`askClaudeJSON`**; prompts ask for raw JSON but models still wrap in fences sometimes.
- **Types**: Shared resume shape in **`src/lib/types.ts`** vs **`ResumeData`** in pdf-generator — keep in sync when extending schema.
- **Optional LLM swap** (transcript/wiki): replacing `claude.ts` with OpenAI-compatible HTTP client is the intended seam; **`/api/scrape`** and **`/api/enhance/prepare`** are the call sites.

## AI task map (Claude)

- **Job field extraction**: `src/app/api/scrape/route.ts` — `askClaudeJSON` on page text (Haiku model may be passed for cost).
- **Resume enhancement**: `prepare` route — Sonnet/config model; two prompt variants by template.
- **Not used for**: PDF binary manipulation (Python only).
