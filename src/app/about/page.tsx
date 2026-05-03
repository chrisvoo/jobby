import { readFileSync } from 'fs'
import { join } from 'path'
import nextPkg from 'next/package.json'
import duckdbPkg from '@duckdb/node-api/package.json'
import reactPdfPkg from '@react-pdf/renderer/package.json'

const groqSdkVersion: string = JSON.parse(
  readFileSync(join(process.cwd(), 'node_modules/groq-sdk/package.json'), 'utf8')
).version

const TECH_STACK = [
  {
    name: 'Next.js',
    version: nextPkg.version,
    description: 'React framework serving the UI and all server-side logic — job CRUD, PDF extraction, AI calls, and PDF generation all live in API routes.',
    color: 'bg-white/5 border-white/10',
    logo: <NextjsLogo />,
  },
  {
    name: 'DuckDB',
    version: duckdbPkg.version,
    description: 'Embedded SQL database storing all job applications and resume records in a single local file. No server, no cloud.',
    color: 'bg-yellow-500/5 border-yellow-500/15',
    logo: <DuckDBLogo />,
  },
  {
    name: 'Groq',
    version: groqSdkVersion,
    description: 'Groq SDK powers all AI calls — resume optimisation and job description parsing — using Llama 3.3 70B on Groq\'s free API tier. Requires a free API key from console.groq.com.',
    color: 'bg-orange-500/5 border-orange-500/15',
    logo: <GroqLogo />,
  },
  {
    name: '@react-pdf',
    version: reactPdfPkg.version,
    description: 'Generates clean, ATS-optimised resume PDFs from the structured output using React components.',
    color: 'bg-rose-500/5 border-rose-500/15',
    logo: <ReactPdfLogo />,
  },
]

export default function AboutPage() {
  return (
    <div className="space-y-12 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-100">About Jobby</h1>
        <p className="text-zinc-500 text-sm mt-1">
          A personal job tracking and AI resume enhancement tool &mdash; runs entirely on your machine.
          No cloud database, no subscription. Just a free Groq API key.
        </p>
      </div>

      {/* Tech stack */}
      <section>
        <h2 className="text-base font-semibold text-zinc-100 mb-4">Technology Stack</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {TECH_STACK.map(({ name, version, description, color, logo }) => (
            <div key={name} className={`border rounded-xl p-4 ${color}`}>
              <div className="flex items-center gap-3 mb-3">
                {logo}
                <div>
                  <span className="font-semibold text-zinc-100 text-sm">{name}</span>
                  {version && (
                    <span className="ml-2 text-xs text-zinc-400 font-mono">v{version}</span>
                  )}
                </div>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Architecture diagram */}
      <section>
        <h2 className="text-base font-semibold text-zinc-100 mb-2">Architecture</h2>
        <p className="text-zinc-500 text-sm mb-4">
          Next.js runs locally via <code className="text-zinc-400 bg-zinc-800 px-1 rounded">npm run dev</code>.
          All data lives in <code className="text-zinc-400 bg-zinc-800 px-1 rounded">./data/</code> on your machine.
          AI calls go to Groq&apos;s API using your API key stored in{' '}
          <code className="text-zinc-400 bg-zinc-800 px-1 rounded">jobby.config.json</code>.
        </p>
        <ArchitectureDiagram />
      </section>

      {/* Data privacy note */}
      <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-zinc-100 mb-2">Data &amp; Privacy</h2>
        <ul className="space-y-1.5 text-sm text-zinc-500">
          <li>&bull; All data (database, PDFs) lives in <code className="text-zinc-400 bg-zinc-800 px-1 rounded">./data/</code> on your machine &mdash; never uploaded to any server.</li>
          <li>&bull; Resume text and job descriptions are sent to Groq&apos;s API only when you trigger an enhancement. Zero Data Retention (ZDR) can be enabled in your Groq account settings.</li>
          <li>&bull; Your Groq API key is stored in <code className="text-zinc-400 bg-zinc-800 px-1 rounded">jobby.config.json</code> (gitignored) and never committed to version control.</li>
        </ul>
      </section>
    </div>
  )
}

// ── Architecture diagram ─────────────────────────────────────────

function ArchitectureDiagram() {
  return (
    <div className="w-full overflow-x-auto rounded-xl bg-zinc-900 border border-zinc-800 p-6 flex justify-center">
      <svg viewBox="0 0 580 280" className="w-full max-w-2xl" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#71717a" />
          </marker>
          <marker id="arr-indigo" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#818cf8" />
          </marker>
          <marker id="arr-orange" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#f97316" />
          </marker>
        </defs>

        {/* Next.js box */}
        <rect x="100" y="40" width="340" height="155" rx="10" stroke="#4f46e5" strokeWidth="1.5" fill="#1e1b4b" fillOpacity="0.25" />
        <text x="119" y="62" fill="#a5b4fc" fontSize="10" fontFamily="system-ui, sans-serif" fontWeight="700" letterSpacing="0.06em">NEXT.JS APP  ·  localhost:3000</text>

        {/* React UI pill */}
        <rect x="119" y="72" width="88" height="30" rx="6" fill="#27272a" stroke="#4f46e5" strokeWidth="1" />
        <text x="163" y="92" fill="#c7d2fe" fontSize="10" fontFamily="system-ui, sans-serif" textAnchor="middle" fontWeight="500">React UI</text>

        {/* API Routes pill */}
        <rect x="119" y="118" width="88" height="30" rx="6" fill="#27272a" stroke="#4f46e5" strokeWidth="1" />
        <text x="163" y="138" fill="#c7d2fe" fontSize="10" fontFamily="system-ui, sans-serif" textAnchor="middle" fontWeight="500">API Routes</text>

        {/* DuckDB pill */}
        <rect x="231" y="72" width="88" height="30" rx="6" fill="#27272a" stroke="#ca8a04" strokeWidth="1" />
        <text x="275" y="92" fill="#fde68a" fontSize="10" fontFamily="system-ui, sans-serif" textAnchor="middle" fontWeight="500">DuckDB</text>

        {/* react-pdf pill */}
        <rect x="231" y="118" width="88" height="30" rx="6" fill="#27272a" stroke="#be185d" strokeWidth="1" />
        <text x="275" y="138" fill="#fda4af" fontSize="10" fontFamily="system-ui, sans-serif" textAnchor="middle" fontWeight="500">@react-pdf</text>

        {/* Groq pill */}
        <rect x="343" y="95" width="78" height="30" rx="6" fill="#27272a" stroke="#f97316" strokeWidth="1" />
        <text x="382" y="115" fill="#fdba74" fontSize="10" fontFamily="system-ui, sans-serif" textAnchor="middle" fontWeight="500">Groq SDK</text>

        {/* Internal connector: UI ↔ API */}
        <line x1="163" y1="102" x2="163" y2="118" stroke="#4f46e5" strokeWidth="1" strokeDasharray="3 2" />

        {/* Internal connector: API → DuckDB */}
        <line x1="207" y1="87" x2="231" y2="87" stroke="#ca8a04" strokeWidth="1" markerEnd="url(#arr)" />

        {/* Internal connector: API → react-pdf */}
        <line x1="207" y1="133" x2="231" y2="133" stroke="#be185d" strokeWidth="1" markerEnd="url(#arr)" />

        {/* Internal connector: API → Groq SDK */}
        <path d="M 319 125 Q 335 125 343 110" stroke="#f97316" strokeWidth="1" markerEnd="url(#arr-orange)" />

        {/* Browser box */}
        <rect x="10" y="105" width="70" height="40" rx="20" fill="#27272a" stroke="#3f3f46" strokeWidth="1.5" />
        <text x="45" y="130" fill="#f4f4f5" fontSize="11" fontFamily="system-ui, sans-serif" textAnchor="middle">Browser</text>

        {/* Arrow: Browser → Next.js */}
        <line x1="80" y1="125" x2="97" y2="114" stroke="#71717a" strokeWidth="1.5" markerEnd="url(#arr)" />

        {/* Groq API cloud */}
        <rect x="460" y="80" width="100" height="58" rx="10" fill="#1c1917" stroke="#f97316" strokeWidth="1" strokeDasharray="4 3" />
        <text x="510" y="103" fill="#f97316" fontSize="9" fontFamily="system-ui, sans-serif" textAnchor="middle" fontWeight="600">api.groq.com</text>
        <text x="510" y="118" fill="#78716c" fontSize="9" fontFamily="system-ui, sans-serif" textAnchor="middle">Llama 3.3 70B</text>
        <text x="510" y="131" fill="#78716c" fontSize="9" fontFamily="system-ui, sans-serif" textAnchor="middle">(free tier)</text>

        {/* Arrow: Groq SDK → cloud */}
        <line x1="421" y1="110" x2="458" y2="110" stroke="#f97316" strokeWidth="1" strokeDasharray="4 3" markerEnd="url(#arr-orange)" />

        {/* ./data/ box */}
        <rect x="170" y="225" width="100" height="36" rx="8" fill="#27272a" stroke="#3f3f46" strokeWidth="1" />
        <text x="220" y="248" fill="#a1a1aa" fontSize="10" fontFamily="system-ui, sans-serif" textAnchor="middle">./data/</text>

        {/* Mount arrow API → data */}
        <line x1="220" y1="225" x2="220" y2="198" stroke="#52525b" strokeWidth="1" strokeDasharray="4 3" markerEnd="url(#arr)" />
        <text x="226" y="215" fill="#52525b" fontSize="8" fontFamily="system-ui, sans-serif">read/write</text>
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

function GroqLogo() {
  return (
    <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
        <circle cx="12" cy="12" r="4.5" stroke="#f97316" strokeWidth="2" />
        <path d="M12 7.5V3M12 21v-4.5M7.5 12H3M21 12h-4.5M9.17 9.17 5.64 5.64M18.36 18.36l-3.53-3.53M9.17 14.83l-3.53 3.53M18.36 5.64l-3.53 3.53" stroke="#f97316" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
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
