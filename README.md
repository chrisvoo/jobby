# Jobby

Personal job application tracker with AI-powered resume enhancement.

No API key required -- uses your local `claude` CLI session and your existing claude.ai subscription.

## Prerequisites

- **Docker** (Desktop or Engine) -- [install](https://docker.com/get-started)
- **Claude CLI** authenticated once on the host:
  ```bash
  npx @anthropic-ai/claude-code   # follow the login prompt
  ```
  This creates `~/.claude.json`, which is mounted read-only into the container.
  On macOS, `scripts/start.sh` also exports OAuth credentials from the Keychain to
  `~/.claude/.credentials.json` (see [token expiry](#claude-auth--token-expiry-docker) if you hit auth errors later).

## Quick Start (production)

The production setup builds the Next.js app once and serves it as a static standalone server.

**macOS / Linux**

```bash
./scripts/start.sh
```

**Windows** -- double-click `scripts\start.bat`, or:

```bat
scripts\start.bat
```

The script checks for Docker and Claude auth, runs `docker compose up --build -d`, and opens [http://localhost:3000](http://localhost:3000).

Stop with:
```bash
docker compose down
```

**Or run the compose command directly:**

```bash
docker compose up --build -d
```

## Development (hot-reload)

The development setup bind-mounts your source code into the container and runs `next dev --turbopack`, so every file edit is picked up automatically -- no rebuild needed.

**macOS / Linux**

```bash
./scripts/start.sh --dev
```

**Windows**

```bat
scripts\start.bat --dev
```

**Or run the compose command directly:**

```bash
docker compose -f docker-compose.dev.yml up --build -d
```

View logs:
```bash
docker compose -f docker-compose.dev.yml logs -f node
```

Stop:
```bash
docker compose -f docker-compose.dev.yml down
```

## How it works

1. **Job Tracker** -- full CRUD for job applications stored in a local DuckDB file.
2. **Resume Enhancer** -- upload your base resume PDF, select a job, paste the job description (or fetch it from a URL). Jobby then:
   - Extracts text from your PDF
   - Asks Claude to generate an optimised version
   - Generates a tailored PDF
   - Lets you review and edit before downloading

Claude returns structured JSON for the enhanced resume; a new PDF is generated from scratch with a clean Helvetica layout optimised for ATS compatibility.

> **Note:** An earlier approach used PyMuPDF to apply in-place text replacements directly onto the original PDF (preserving the original design). It was abandoned due to persistent issues: replaced spans lost their original font styles, text overflowed bounding boxes, and overlapping characters made the output unreadable. Generating a fresh PDF proved far more reliable.

## Claude auth & token expiry (Docker)

The Claude SDK authenticates via **OAuth tokens** with a limited lifetime.  When running in Docker the token is read from a file mounted into the container, not from the host Keychain.

| Platform | Credential storage |
|---|---|
| **macOS** | OAuth token lives in the **macOS Keychain**. `scripts/start.sh` exports it to `~/.claude/.credentials.json` on every launch. |
| **Linux** | The SDK already stores credentials as plaintext under `~/.claude/` — no export step needed. |

### Symptom

After running for a while you see:

```
[Error: Claude Code returned an error result: Failed to authenticate. API Error: 401 ...]
```

or

```
Claude Code returned an error result: Not logged in · Please run /login
```

### Fix

1. **Re-authenticate** (if the token is fully expired):
   ```bash
   claude        # then type /login inside the REPL
   ```
2. **Re-export credentials** (macOS only):
   ```bash
   ./scripts/export-credentials.sh
   ```
   On Linux this script is a no-op — just re-authenticate with step 1.
3. **Restart the container** so it picks up the fresh file:
   ```bash
   docker compose restart node
   ```

> **Tip:** `./scripts/start.sh` already runs the export automatically, so a full
> `./scripts/start.sh` also works — but `export-credentials.sh` + `restart` is
> faster because it skips the image rebuild check.

## Architecture

```
docker compose up
  └── node     (Next.js :3000)  -- UI, API routes, Claude calls

Host mounts:
  ~/.claude.json                ->  container (read-only auth config)
  ~/.claude/.credentials.json   ->  container (read-only OAuth token, macOS only)
  ./data/                       ->  container (DuckDB + PDFs, persists between runs)
```

## Stack

| Layer | Technology |
|---|---|
| Frontend + API | Next.js 15 (React 19, Turbopack) |
| Database | DuckDB (embedded, file-based) |
| PDF text extraction | unpdf (Mozilla PDF.js) |
| AI | Claude Agent SDK (no API key) |
| PDF generation | @react-pdf/renderer |
| Containerisation | Docker Compose |

## Project structure

```
scripts/          start.sh, start.bat, export-credentials.sh
src/
  app/            Pages and API routes
  components/     Sidebar, forms, dialogs, editors
  lib/            DuckDB, Claude wrapper, PDF tools, config
data/             DuckDB file + uploaded PDFs (created on first run, git-ignored)
```
