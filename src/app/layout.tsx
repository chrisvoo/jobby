import type { Metadata } from 'next'
import './globals.css'
import { Sidebar } from '@/components/sidebar'
import { Toaster } from 'sonner'

export const metadata: Metadata = {
  title: 'Jobby — Job Application Tracker',
  description: 'Track your job applications and enhance your resume with AI',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        <Sidebar />
        <main className="md:ml-60 min-h-screen pt-14 md:pt-0">
          <div className="max-w-6xl mx-auto px-4 py-6 sm:px-8 sm:py-8">{children}</div>
        </main>
        <Toaster
          position="bottom-right"
          theme="dark"
          toastOptions={{
            style: {
              background: '#18181b',
              border: '1px solid #3f3f46',
              color: '#f4f4f5',
            },
          }}
        />
      </body>
    </html>
  )
}
