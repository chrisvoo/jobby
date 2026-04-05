import { MermaidDiagram } from '@/components/mermaid-diagram'

const TECH_STACK = [
  {
    name: 'Next.js',
    description: 'React framework serving the UI and all server-side logic — job CRUD, PDF extraction, AI calls, and PDF generation all live in API routes.',
    color: 'bg-white/5 border-white/10',
    logo: <NextjsLogo />,
  },
  {
    name: 'DuckDB',
    description: 'Embedded SQL database storing all job applications and resume records in a single local file. No server, no cloud.',
    color: 'bg-yellow-500/5 border-yellow-500/15',
    logo: <DuckDBLogo />,
  },
  {
    name: 'unpdf',
    description: 'Modern PDF text extraction built on Mozilla PDF.js. Reads uploaded resumes and extracts clean text to send to Claude.',
    color: 'bg-orange-500/5 border-orange-500/15',
    logo: <UnpdfLogo />,
  },
  {
    name: 'Claude CLI',
    description: 'Anthropic\'s local CLI tool handles all AI calls — resume optimisation and job description parsing — using your existing claude.ai subscription. No API key required.',
    color: 'bg-violet-500/5 border-violet-500/15',
    logo: <ClaudeLogo />,
  },
  {
    name: '@react-pdf',
    description: 'Generates clean, ATS-optimised resume PDFs from Claude\'s structured output using React components. No browser or headless Chrome needed.',
    color: 'bg-rose-500/5 border-rose-500/15',
    logo: <ReactPdfLogo />,
  }
]

const DIAGRAM = `flowchart TD
  Browser(["Browser"])

  subgraph App ["Next.js :3000"]
    UI["React UI"]
    API["API Routes"]
  end

  Claude(["Claude CLI"])
  DB[("DuckDB")]
  Files[("PDF Files")]

  Browser <--> UI
  UI <--> API
  API <--> DB
  API <--> Files
  API <--> Claude`

export default function AboutPage() {
  return (
    <div className="space-y-12 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-100">About Jobby</h1>
        <p className="text-zinc-500 text-sm mt-1">
          A personal job tracking and AI resume enhancement tool — runs entirely on your machine.
          No API key, no cloud database, no subscription beyond what you already have.
        </p>
      </div>

      {/* Tech stack */}
      <section>
        <h2 className="text-base font-semibold text-zinc-100 mb-4">Technology Stack</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {TECH_STACK.map(({ name, description, color, logo }) => (
            <div key={name} className={`border rounded-xl p-4 ${color}`}>
              <div className="flex items-center gap-3 mb-3">
                {logo}
                <span className="font-semibold text-zinc-100 text-sm">{name}</span>
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Architecture diagram */}
      <section>
        <h2 className="text-base font-semibold text-zinc-100 mb-2">Architecture</h2>
        <p className="text-zinc-500 text-sm mb-4">
          A single Next.js process handles everything. The <code className="text-zinc-400 bg-zinc-800 px-1 rounded">claude</code> CLI
          is called as a subprocess — your credentials stay in <code className="text-zinc-400 bg-zinc-800 px-1 rounded">~/.claude.json</code> on
          your machine and are never sent anywhere else.
        </p>
        <MermaidDiagram chart={DIAGRAM} />
      </section>

      {/* Data privacy note */}
      <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-zinc-100 mb-2">Data &amp; Privacy</h2>
        <ul className="space-y-1.5 text-sm text-zinc-500">
          <li>• All data (database, PDFs) lives in <code className="text-zinc-400 bg-zinc-800 px-1 rounded">./data/</code> on your machine — never uploaded to any server.</li>
          <li>• The <code className="text-zinc-400 bg-zinc-800 px-1 rounded">claude</code> CLI sends your resume text and job description to Anthropic when you trigger an enhancement. No account data or metadata is included.</li>
          <li>• No API key is stored in this project. Authentication is handled entirely by the <code className="text-zinc-400 bg-zinc-800 px-1 rounded">claude</code> CLI using your existing claude.ai session.</li>
        </ul>
      </section>
    </div>
  )
}

// ── Logo components ────────────────────────────────────────────

function NextjsLogo() {
  return (
    <div className="w-8 h-8 rounded-lg bg-black border border-zinc-700 flex items-center justify-center shrink-0">
      <svg viewBox="0 0 180 180" className="w-5 h-5" fill="white">
        <path d="M90 0C40.3 0 0 40.3 0 90s40.3 90 90 90 90-40.3 90-90S139.7 0 90 0zm44.3 163.8L69.5 75H55v49.9h14.5V93l58.4 76.5c-5.7 2.5-11.7 4-18 4.6v-.3zm22.7-14.2c-1.6 2.4-3.4 4.7-5.3 6.8L98.5 75H113v65.4c0 3.8-2.4 7.3-6 9.2z" />
      </svg>
    </div>
  )
}

function DuckDBLogo() {
  return (
    <div className="w-8 h-8 rounded-lg bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center shrink-0">
      <svg viewBox="0 0 60 60" className="w-5 h-5">
        <circle cx="30" cy="30" r="28" fill="#FBD234" />
        <circle cx="30" cy="30" r="14" fill="#000" />
        <circle cx="30" cy="30" r="7" fill="#FBD234" />
      </svg>
    </div>
  )
}

function UnpdfLogo() {
  return (
    <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
      <span className="text-orange-400 font-bold text-[10px] tracking-tight">PDF</span>
    </div>
  )
}

function ClaudeLogo() {
  return (
    <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#7C3AED">
        <path d="M4.255 13.164c.494.094.838.567.744 1.061l-.983 5.147 4.626-2.736a.907.907 0 0 1 .909 0l4.626 2.736-.983-5.147a.906.906 0 0 1 .744-1.061l5.012-.966-3.594-3.64a.9.9 0 0 1-.255-.8l.836-5.113-4.51 2.5a.907.907 0 0 1-.91 0l-4.51-2.5.836 5.113a.9.9 0 0 1-.255.8L3.004 12.2l5.251-.036z" />
      </svg>
    </div>
  )
}

function ReactPdfLogo() {
  return (
    <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#e11d48">
        <path d="M12 9.861A2.139 2.139 0 1 0 12 14.139 2.139 2.139 0 1 0 12 9.861zM6.008 16.255l-.472-.12C2.018 15.246 0 13.737 0 11.996s2.018-3.25 5.536-4.139l.472-.119.133.468a23.53 23.53 0 0 0 1.363 3.578l.101.213-.101.213a23.307 23.307 0 0 0-1.363 3.578l-.133.467zM5.317 8.95c-2.674.751-4.315 1.9-4.315 3.046 0 1.145 1.641 2.294 4.315 3.046a24.95 24.95 0 0 1 1.182-3.046A24.752 24.752 0 0 1 5.317 8.95zM17.992 16.255l-.133-.468a23.557 23.557 0 0 0-1.364-3.578l-.101-.213.101-.213a23.42 23.42 0 0 0 1.364-3.578l.133-.468.473.119c3.517.889 5.535 2.398 5.535 4.139s-2.018 3.25-5.535 4.139l-.473.12zm-.491-4.259c.48 1.039.877 2.06 1.182 3.046 2.675-.752 4.315-1.901 4.315-3.046 0-1.146-1.641-2.294-4.315-3.046a24.788 24.788 0 0 1-1.182 3.046z" />
      </svg>
    </div>
  )
}

function DockerLogo() {
  return (
    <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0">
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#2496ED">
        <path d="M13.983 11.078h2.119a.186.186 0 0 0 .186-.185V9.006a.186.186 0 0 0-.186-.186h-2.119a.185.185 0 0 0-.185.185v1.888c0 .102.083.185.185.185m-2.954-5.43h2.118a.186.186 0 0 0 .186-.186V3.574a.186.186 0 0 0-.186-.185h-2.118a.185.185 0 0 0-.185.185v1.888c0 .102.082.185.185.185m0 2.716h2.118a.187.187 0 0 0 .186-.186V6.29a.186.186 0 0 0-.186-.185h-2.118a.185.185 0 0 0-.185.185v1.887c0 .102.082.186.185.186m-2.93 0h2.12a.186.186 0 0 0 .184-.186V6.29a.185.185 0 0 0-.185-.185H8.1a.185.185 0 0 0-.185.185v1.887c0 .102.083.186.185.186m-2.964 0h2.119a.186.186 0 0 0 .185-.186V6.29a.185.185 0 0 0-.185-.185H5.136a.186.186 0 0 0-.186.185v1.887c0 .102.084.186.186.186m5.893 2.715h2.118a.186.186 0 0 0 .186-.185V9.006a.186.186 0 0 0-.186-.186h-2.118a.185.185 0 0 0-.185.185v1.888c0 .102.082.185.185.185m-2.93 0h2.12a.185.185 0 0 0 .184-.185V9.006a.185.185 0 0 0-.184-.186h-2.12a.185.185 0 0 0-.185.185v1.888c0 .102.083.185.185.185m-2.964 0h2.119a.185.185 0 0 0 .185-.185V9.006a.185.185 0 0 0-.184-.186h-2.12a.186.186 0 0 0-.186.186v1.887c0 .102.084.185.186.185m-2.92 0h2.12a.186.186 0 0 0 .184-.185V9.006a.185.185 0 0 0-.184-.186h-2.12a.185.185 0 0 0-.185.185v1.888c0 .102.083.185.185.185M23.763 9.89c-.065-.051-.672-.51-1.954-.51-.338.001-.676.03-1.01.087-.248-1.7-1.653-2.53-1.716-2.566l-.344-.199-.226.327c-.284.438-.49.922-.612 1.43-.23.97-.09 1.882.403 2.661-.595.332-1.55.413-1.744.42H.751a.751.751 0 0 0-.75.748 11.376 11.376 0 0 0 .692 4.062c.545 1.428 1.355 2.48 2.41 3.124 1.18.723 3.1 1.137 5.275 1.137.983.003 1.963-.086 2.93-.266a12.248 12.248 0 0 0 3.823-1.389c.98-.567 1.86-1.288 2.61-2.136 1.252-1.418 1.998-2.997 2.553-4.4h.221c1.372 0 2.215-.549 2.68-1.009.309-.293.55-.65.707-1.046l.098-.288z" />
      </svg>
    </div>
  )
}
