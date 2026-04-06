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
    name: 'Claude',
    description: 'Anthropic\u2019s Claude Agent SDK handles all AI calls \u2014 resume optimisation and job description parsing \u2014 using your existing claude.ai subscription. No API key required.',
    color: 'bg-amber-500/5 border-amber-500/15',
    logo: <ClaudeLogo />,
  },
  {
    name: 'PyMuPDF',
    description: 'Python library for surgical PDF text replacement. Powers the Pixel-Perfect mode \u2014 rewrites text in your original resume while preserving fonts, colours, and layout.',
    color: 'bg-emerald-500/5 border-emerald-500/15',
    logo: <PyMuPDFLogo />,
  },
  {
    name: '@react-pdf',
    description: 'Generates clean, ATS-optimised resume PDFs from Claude\u2019s structured output using React components. Powers the Minimal template mode.',
    color: 'bg-rose-500/5 border-rose-500/15',
    logo: <ReactPdfLogo />,
  },
  {
    name: 'Docker',
    description: 'Two-container Compose stack \u2014 Node.js for the web app, Python for PDF processing. One command to run on any OS, no local dependencies beyond Docker.',
    color: 'bg-sky-500/5 border-sky-500/15',
    logo: <DockerLogo />,
  },
]

export default function AboutPage() {
  return (
    <div className="space-y-12 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-100">About Jobby</h1>
        <p className="text-zinc-500 text-sm mt-1">
          A personal job tracking and AI resume enhancement tool &mdash; runs entirely on your machine.
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
          Two Docker containers work together. The Node.js container serves the UI and API, calling Claude
          for AI tasks. The Python sidecar handles PDF text replacement for Pixel-Perfect mode. Your credentials
          stay in <code className="text-zinc-400 bg-zinc-800 px-1 rounded">~/.claude.json</code> on your
          machine, mounted read-only into the container.
        </p>
        <ArchitectureDiagram />
      </section>

      {/* Data privacy note */}
      <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-zinc-100 mb-2">Data &amp; Privacy</h2>
        <ul className="space-y-1.5 text-sm text-zinc-500">
          <li>&bull; All data (database, PDFs) lives in <code className="text-zinc-400 bg-zinc-800 px-1 rounded">./data/</code> on your machine &mdash; never uploaded to any server.</li>
          <li>&bull; Claude receives your resume text and job description only when you trigger an enhancement. No account data or metadata is included.</li>
          <li>&bull; No API key is stored in this project. Authentication is handled by the Claude Agent SDK using your existing claude.ai session.</li>
        </ul>
      </section>
    </div>
  )
}

// ── Architecture diagram (static SVG) ───────────────────────────

function ArchitectureDiagram() {
  return (
    <div className="w-full overflow-x-auto rounded-xl bg-zinc-900 border border-zinc-800 p-6 flex justify-center">
      <svg viewBox="0 0 720 420" className="w-full max-w-2xl" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Docker Compose group */}
        <rect x="140" y="40" width="440" height="230" rx="16" stroke="#3f3f46" strokeWidth="1.5" strokeDasharray="6 4" fill="#18181b" />
        <text x="160" y="68" fill="#71717a" fontSize="12" fontFamily="system-ui, sans-serif" fontWeight="600">Docker Compose</text>

        {/* Node.js container */}
        <rect x="170" y="90" width="230" height="155" rx="12" stroke="#4f46e5" strokeWidth="1.5" fill="#1e1b4b" fillOpacity="0.3" />
        <text x="190" y="115" fill="#a5b4fc" fontSize="11" fontFamily="system-ui, sans-serif" fontWeight="600">node :3000</text>
        <rect x="190" y="130" width="90" height="32" rx="6" fill="#27272a" stroke="#3f3f46" strokeWidth="1" />
        <text x="235" y="151" fill="#d4d4d8" fontSize="11" fontFamily="system-ui, sans-serif" textAnchor="middle">React UI</text>
        <rect x="190" y="174" width="90" height="32" rx="6" fill="#27272a" stroke="#3f3f46" strokeWidth="1" />
        <text x="235" y="195" fill="#d4d4d8" fontSize="11" fontFamily="system-ui, sans-serif" textAnchor="middle">API Routes</text>
        <rect x="300" y="130" width="80" height="32" rx="6" fill="#27272a" stroke="#3f3f46" strokeWidth="1" />
        <text x="340" y="151" fill="#d4d4d8" fontSize="11" fontFamily="system-ui, sans-serif" textAnchor="middle">Claude</text>

        {/* Python container */}
        <rect x="430" y="90" width="130" height="155" rx="12" stroke="#059669" strokeWidth="1.5" fill="#064e3b" fillOpacity="0.3" />
        <text x="450" y="115" fill="#6ee7b7" fontSize="11" fontFamily="system-ui, sans-serif" fontWeight="600">python :5001</text>
        <rect x="448" y="135" width="95" height="32" rx="6" fill="#27272a" stroke="#3f3f46" strokeWidth="1" />
        <text x="496" y="156" fill="#d4d4d8" fontSize="11" fontFamily="system-ui, sans-serif" textAnchor="middle">PyMuPDF</text>
        <rect x="448" y="180" width="95" height="32" rx="6" fill="#27272a" stroke="#3f3f46" strokeWidth="1" />
        <text x="496" y="201" fill="#d4d4d8" fontSize="11" fontFamily="system-ui, sans-serif" textAnchor="middle">POST /replace</text>

        {/* Arrow: API -> Python */}
        <line x1="400" y1="190" x2="445" y2="196" stroke="#6ee7b7" strokeWidth="1.5" markerEnd="url(#arrow-green)" />

        {/* Arrow: UI <-> API */}
        <line x1="235" y1="162" x2="235" y2="174" stroke="#71717a" strokeWidth="1" />

        {/* Browser */}
        <rect x="30" y="150" width="100" height="40" rx="20" fill="#27272a" stroke="#3f3f46" strokeWidth="1.5" />
        <text x="80" y="175" fill="#f4f4f5" fontSize="12" fontFamily="system-ui, sans-serif" textAnchor="middle">Browser</text>
        <line x1="130" y1="170" x2="187" y2="146" stroke="#71717a" strokeWidth="1.5" markerEnd="url(#arrow-grey)" />

        {/* Host mounts */}
        <rect x="30" y="310" width="130" height="38" rx="8" fill="#27272a" stroke="#3f3f46" strokeWidth="1" />
        <text x="95" y="334" fill="#a1a1aa" fontSize="11" fontFamily="system-ui, sans-serif" textAnchor="middle">~/.claude.json</text>

        <rect x="200" y="310" width="130" height="38" rx="8" fill="#27272a" stroke="#3f3f46" strokeWidth="1" />
        <text x="265" y="334" fill="#a1a1aa" fontSize="11" fontFamily="system-ui, sans-serif" textAnchor="middle">./data/</text>

        {/* Host label */}
        <text x="30" y="296" fill="#52525b" fontSize="11" fontFamily="system-ui, sans-serif" fontWeight="600">Host machine</text>

        {/* Dashed lines: host -> containers */}
        <line x1="95" y1="310" x2="260" y2="248" stroke="#71717a" strokeWidth="1" strokeDasharray="4 3" />
        <text x="145" y="278" fill="#52525b" fontSize="9" fontFamily="system-ui, sans-serif">readonly</text>

        <line x1="265" y1="310" x2="285" y2="248" stroke="#71717a" strokeWidth="1" strokeDasharray="4 3" />
        <line x1="265" y1="310" x2="496" y2="248" stroke="#71717a" strokeWidth="1" strokeDasharray="4 3" />
        <text x="370" y="290" fill="#52525b" fontSize="9" fontFamily="system-ui, sans-serif">read/write</text>

        {/* Arrow markers */}
        <defs>
          <marker id="arrow-grey" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#71717a" />
          </marker>
          <marker id="arrow-green" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#6ee7b7" />
          </marker>
        </defs>
      </svg>
    </div>
  )
}

// ── Logo components ────────────────────────────────────────────

function NextjsLogo() {
  return (
    <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-600 flex items-center justify-center shrink-0">
      <span className="text-zinc-100 font-black text-xs tracking-tighter">N</span>
    </div>
  )
}

function DuckDBLogo() {
  return (
    <div className="w-8 h-8 rounded-lg bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center shrink-0">
      <svg viewBox="0 0 60 60" className="w-5 h-5">
        <circle cx="30" cy="30" r="28" fill="#FBD234" />
        <circle cx="30" cy="30" r="14" fill="#1a1a1a" />
        <circle cx="30" cy="30" r="7" fill="#FBD234" />
      </svg>
    </div>
  )
}

function ClaudeLogo() {
  return (
    <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
        <path d="M16.98 7.16l-4.1 8.9-1.93-4.17L6.71 7.16h3.06l1.8 3.86 1.27-2.75.56-1.11h3.58zm.15 0h3.06l-5.97 12.92h-3.05l2.25-4.86 3.71-8.06z" fill="#D97706" />
      </svg>
    </div>
  )
}

function PyMuPDFLogo() {
  return (
    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
      <span className="text-emerald-400 font-bold text-[9px] tracking-tight leading-none">Mu</span>
    </div>
  )
}

function ReactPdfLogo() {
  return (
    <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#fb7185">
        <path d="M12 10.11c1.03 0 1.87.84 1.87 1.89 0 1-.84 1.85-1.87 1.85S10.13 13 10.13 12c0-1.05.84-1.89 1.87-1.89M7.37 20c.63.38 2.01-.2 3.6-1.7-.52-.59-1.03-1.23-1.51-1.9a22.7 22.7 0 01-2.4-.36c-.51 2.14-.32 3.61.31 3.96m.71-5.74l-.29-.51c-.11.29-.22.58-.29.86.27.06.57.11.88.16l-.3-.51m6.54-.76l.81-1.5-.81-1.5c-.3-.53-.62-1-.91-1.47C13.17 9 12.6 9 12 9c-.6 0-1.17 0-1.71.03-.29.47-.61.94-.91 1.47L8.57 12l.81 1.5c.3.53.62 1 .91 1.47.54.03 1.11.03 1.71.03.6 0 1.17 0 1.71-.03.29-.47.61-.94.91-1.47M12 6.78c-.19.22-.39.45-.59.72h1.18c-.2-.27-.4-.5-.59-.72m0 10.44c.19-.22.39-.45.59-.72h-1.18c.2.27.4.5.59.72M16.62 4c-.62-.38-2 .2-3.59 1.7.52.59 1.03 1.23 1.51 1.9.82.08 1.63.2 2.4.36.51-2.14.32-3.61-.32-3.96m-.7 5.74l.29.51c.11-.29.22-.58.29-.86-.27-.06-.57-.11-.88-.16l.3.51m1.45-7.05c1.47.84 1.63 3.05 1.01 5.63 2.54.75 4.37 1.99 4.37 3.68s-1.83 2.93-4.37 3.68c.62 2.58.46 4.79-1.01 5.63-1.46.84-3.45-.12-5.37-1.95-1.92 1.83-3.91 2.79-5.38 1.95-1.46-.84-1.62-3.05-1-5.63-2.54-.75-4.37-1.99-4.37-3.68s1.83-2.93 4.37-3.68c-.62-2.58-.46-4.79 1-5.63 1.47-.84 3.46.12 5.38 1.95 1.92-1.83 3.91-2.79 5.37-1.95M17.08 12c.34.75.64 1.5.89 2.26 2.1-.63 3.28-1.53 3.28-2.26 0-.73-1.18-1.63-3.28-2.26-.25.76-.55 1.51-.89 2.26M6.92 12c-.34-.75-.64-1.5-.89-2.26-2.1.63-3.28 1.53-3.28 2.26 0 .73 1.18 1.63 3.28 2.26.25-.76.55-1.51.89-2.26m9 2.26l-.3.51c.31-.05.61-.1.88-.16-.07-.28-.18-.57-.29-.86l-.29.51m-2.89 4.04c1.59 1.5 2.97 2.08 3.59 1.7.64-.35.83-1.82.32-3.96-.77.16-1.58.28-2.4.36-.48.67-.99 1.31-1.51 1.9M8.08 9.74l.3-.51c-.31.05-.61.1-.88.16.07.28.18.57.29.86l.29-.51m2.89-4.04C9.38 4.2 8 3.62 7.37 4c-.63.35-.82 1.82-.31 3.96a22.7 22.7 0 012.4-.36c.48-.67.99-1.31 1.51-1.9z" />
      </svg>
    </div>
  )
}

function DockerLogo() {
  return (
    <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0">
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#38bdf8">
        <path d="M13.98 11.08h2.12a.19.19 0 00.19-.19V9.01a.19.19 0 00-.19-.19h-2.12a.19.19 0 00-.18.19v1.88c0 .1.08.19.18.19m-2.95-5.43h2.12a.19.19 0 00.18-.19V3.57a.19.19 0 00-.18-.18h-2.12a.19.19 0 00-.19.18v1.89c0 .1.09.19.19.19m0 2.71h2.12a.19.19 0 00.18-.18V6.29a.19.19 0 00-.18-.18h-2.12a.19.19 0 00-.19.18v1.89c0 .1.09.18.19.18m-2.93 0H10.22a.19.19 0 00.18-.18V6.29a.19.19 0 00-.18-.18H8.1a.19.19 0 00-.19.18v1.89c0 .1.09.18.19.18m-2.96 0h2.12a.19.19 0 00.18-.18V6.29a.19.19 0 00-.18-.18H5.14a.19.19 0 00-.19.18v1.89c0 .1.09.18.19.18m5.89 2.72h2.12a.19.19 0 00.18-.19V9.01a.19.19 0 00-.18-.19h-2.12a.19.19 0 00-.19.19v1.88c0 .1.09.19.19.19m-2.93 0H10.22a.19.19 0 00.18-.19V9.01a.19.19 0 00-.18-.19H8.1a.19.19 0 00-.19.19v1.88c0 .1.09.19.19.19m-2.96 0h2.12a.19.19 0 00.18-.19V9.01a.19.19 0 00-.18-.19H5.14a.19.19 0 00-.19.19v1.88c0 .1.09.19.19.19m-2.93 0h2.12a.19.19 0 00.18-.19V9.01a.19.19 0 00-.18-.19H2.21a.19.19 0 00-.18.19v1.88c0 .1.08.19.18.19M23.76 9.89c-.06-.05-.67-.51-1.95-.51-.34 0-.68.03-1.01.09-.25-1.7-1.65-2.53-1.72-2.57l-.34-.2-.23.33c-.28.44-.49.92-.61 1.43-.23.97-.09 1.88.4 2.66-.59.33-1.55.41-1.74.42H.75a.75.75 0 00-.75.75 11.38 11.38 0 00.69 4.06c.55 1.43 1.36 2.48 2.41 3.12 1.18.72 3.1 1.14 5.28 1.14.98 0 1.96-.09 2.93-.27a12.25 12.25 0 003.82-1.39c.98-.57 1.86-1.29 2.61-2.14 1.25-1.42 2-3 2.55-4.4h.22c1.37 0 2.22-.55 2.68-1.01.31-.29.55-.65.71-1.05l.1-.29z" />
      </svg>
    </div>
  )
}
