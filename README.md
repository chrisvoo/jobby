# Jobby

Personal job application tracker with AI-powered resume enhancement.

Uses Groq's free API tier (Llama 3.3 70B) for AI features — no subscription required, just a free API key.

## Prerequisites

- A free **Groq API key** — sign up at [console.groq.com](https://console.groq.com/keys) (no credit card required)
- **Node.js 20+** (local mode) **or Docker + Docker Compose** (container mode)

## Quick Start

### Local (Node.js)

```bash
cp .env.dist .env        # create your config
# edit .env and set GROQ_API_KEY=gsk_...
npm install
npm run dev
```

### Docker

```bash
cp .env.dist .env        # create your config
# edit .env and set GROQ_API_KEY=gsk_...
docker-compose up --build
```

Both modes share the same `./data/` directory (DuckDB file and uploaded PDFs), so you can switch between them freely — just don't run both at the same time (DuckDB holds a file lock).

Open [http://localhost:3000](http://localhost:3000) in either mode. You can also configure settings from the **Config** page without editing `.env` directly — changes are saved back to `.env` and take effect immediately. If you switch modes after a Config page change, restart the other mode to pick up the updated `.env`.

## How it works

1. **Job Tracker** — full CRUD for job applications stored in a local DuckDB file.
2. **Resume Enhancer** — upload your base resume PDF, select a job, paste the job description (or fetch it from a URL). Jobby then:
   - Extracts text from your PDF
   - Asks the LLM to generate an optimised version
   - Generates a tailored PDF
   - Lets you review and edit before downloading

The LLM returns structured JSON for the enhanced resume; a new PDF is generated from scratch with a clean Helvetica layout optimised for ATS compatibility.

> **Note:** An earlier approach used PyMuPDF to apply in-place text replacements directly onto the original PDF (preserving the original design). It was abandoned due to persistent issues: replaced spans lost their original font styles, text overflowed bounding boxes, and overlapping characters made the output unreadable. Generating a fresh PDF proved far more reliable.

## Configuration

Settings live in `.env` at the project root (gitignored — never committed). Use `.env.dist` as the template. They can also be changed at runtime via the **Config page** in the UI, which writes back to `.env`.

| Variable | Description | Default |
|---|---|---|
| `GROQ_API_KEY` | Your Groq API key (`gsk_...`) | — |
| `LLM_MODEL` | Model for AI tasks | `llama-3.3-70b-versatile` |
| `TARGET_CURRENCY` | Default currency for salary conversion (ISO 4217) | `EUR` |

The DuckDB path is managed automatically (`./data/app.db`) and is not configurable.

## Architecture

```
npm run dev                  docker-compose up
  └── Next.js :3000    OR      └── Next.js :3000 (container)
        │                              │
        └──────────┬───────────────────┘
                   │
              ./data/          -- shared volume: DuckDB + uploaded PDFs
              .env             -- shared config: API key, model, currency

External:
  api.groq.com                 -- Llama 3.3 70B inference (free tier)
```

## Stack

| Layer | Technology |
|---|---|
| Frontend + API | Next.js (React, Turbopack) |
| Database | DuckDB (embedded, file-based) |
| PDF text extraction | unpdf (Mozilla PDF.js) |
| AI | Groq SDK + Llama 3.3 70B (free tier) |
| PDF generation | @react-pdf/renderer |

## Project structure

```
scripts/          fix-missing-history.ts (DuckDB maintenance utility)
src/
  app/            Pages and API routes
  components/     Sidebar, forms, dialogs, editors
  lib/            DuckDB, Groq LLM wrapper, PDF tools, config
data/             DuckDB file + uploaded PDFs (created on first run, git-ignored)
```
