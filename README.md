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

## Quick Start (production)

The production setup builds the Next.js app once and serves it as a static standalone server.

**macOS / Linux**

```bash
./start.sh
```

**Windows** -- double-click `start.bat`, or:

```bat
start.bat
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
./start.sh --dev
```

**Windows**

```bat
start.bat --dev
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

## Architecture

```
docker compose up
  └── node     (Next.js :3000)  -- UI, API routes, Claude calls

Host mounts:
  ~/.claude.json  ->  container (read-only auth)
  ./data/         ->  container (DuckDB + PDFs, persists between runs)
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
src/
  app/            Pages and API routes
  components/     Sidebar, forms, dialogs, editors
  lib/            DuckDB, Claude wrapper, PDF tools, config
data/             DuckDB file + uploaded PDFs (created on first run, git-ignored)
```
