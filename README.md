# Jobby

Personal job application tracker with AI-powered resume enhancement.

Uses Groq's free API tier (Llama 3.3 70B) for AI features — no subscription required, just a free API key.

## Prerequisites

- **Node.js 20+**
- A free **Groq API key** — sign up at [console.groq.com](https://console.groq.com/keys) (no credit card required)

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), navigate to the **Config** page, and paste your Groq API key.

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

All settings live in `jobby.config.json` at the project root (gitignored — never committed). They are managed via the **Config page** in the UI:

| Setting | Description |
|---|---|
| `groq_api_key` | Your Groq API key (`gsk_...`) |
| `llm_model` | Model to use for AI tasks (default: `llama-3.3-70b-versatile`) |
| `target_currency` | Default currency for salary conversion (default: `EUR`) |
| `duckdb_path` | Path to the DuckDB file (managed automatically) |

## Architecture

```
npm run dev
  └── Next.js :3000  -- UI, API routes, LLM calls, PDF generation

Local data:
  ./data/            -- DuckDB + PDFs (persists between runs, git-ignored)

External:
  api.groq.com       -- Llama 3.3 70B inference (free tier)
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
