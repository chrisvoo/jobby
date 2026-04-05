'use client'

import { useEffect, useRef } from 'react'

interface Props {
  chart: string
}

export function MermaidDiagram({ chart }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false

    async function render() {
      const mermaid = (await import('mermaid')).default
      mermaid.initialize({
        startOnLoad: false,
        theme: 'dark',
        themeVariables: {
          background: '#09090b',
          mainBkg: '#18181b',
          nodeBorder: '#3f3f46',
          lineColor: '#71717a',
          textColor: '#f4f4f5',
          edgeLabelBackground: '#18181b',
          clusterBkg: '#18181b',
        },
      })

      if (ref.current && !cancelled) {
        try {
          const id = `mermaid-${Math.random().toString(36).slice(2)}`
          const { svg } = await mermaid.render(id, chart)
          if (ref.current && !cancelled) {
            ref.current.innerHTML = svg
            // Make SVG responsive
            const svgEl = ref.current.querySelector('svg')
            if (svgEl) {
              svgEl.removeAttribute('height')
              svgEl.style.width = '100%'
            }
          }
        } catch (e) {
          console.error('Mermaid render error:', e)
        }
      }
    }

    render()
    return () => { cancelled = true }
  }, [chart])

  return (
    <div
      ref={ref}
      className="w-full overflow-x-auto rounded-xl bg-zinc-900 border border-zinc-800 p-6"
    />
  )
}
