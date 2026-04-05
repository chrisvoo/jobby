# Jobby

Personal job application tracker with AI-powered resume enhancement.

No API key required — uses your local `claude` CLI and your existing claude.ai subscription.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Run
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

Data (database + PDFs) is stored in `./data/` and persists between runs.

## Prerequisites

- **Node.js 18+**
- **`claude` CLI** installed and authenticated:
  ```bash
  npm install -g @anthropic-ai/claude-code
  claude   # follow the login prompt (uses your claude.ai account)
  ```

## How it works

1. **Job Tracker** — full CRUD for job applications stored in a local DuckDB file
2. **Resume Enhancer** — upload your base resume PDF, select a job, paste the job description (or fetch it from a URL). Jobby:
   - Extracts text from your PDF (`unpdf`)
   - Asks Claude to generate an ATS-optimised version as structured JSON
   - Renders a clean professional PDF (`@react-pdf/renderer`)
   - Lets you download it — named `FirstName_LastName_JobTitle_Resume.pdf`

## Stack

| Layer | Technology |
|---|---|
| Frontend + API | Next.js 15 (React 19) |
| Database | DuckDB (embedded, file-based) |
| PDF text extraction | unpdf (Mozilla PDF.js) |
| AI | `claude` CLI subprocess (no API key) |
| PDF generation | @react-pdf/renderer |

## Project Structure

```
src/
  app/          Pages and API routes
  components/   Sidebar, forms, badges, Mermaid diagram
  lib/          DuckDB, claude CLI wrapper, pdf-extractor, pdf-generator
data/           DuckDB file + uploaded PDFs (created on first run)
```
