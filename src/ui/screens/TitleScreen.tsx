// Title screen: the wordmark breathes — mis-registered, aligned, mis-registered.

import { useEffect, useState } from 'react'
import { m } from '../../paraglide/messages.js'
import { Wordmark } from '../components/Wordmark.tsx'
import { LangToggle } from '../components/LangToggle.tsx'

export function TitleScreen({ onStart }: { onStart: () => void }) {
  const [aligned, setAligned] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setAligned(true), 700)
    const t2 = setTimeout(() => setAligned(false), 2600)
    const loop = setInterval(() => {
      setAligned(true)
      setTimeout(() => setAligned(false), 1900)
    }, 4600)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearInterval(loop)
    }
  }, [])

  return (
    <div
      onClick={onStart}
      className="relative flex min-h-screen cursor-pointer flex-col items-center justify-center overflow-hidden select-none"
      style={{ background: 'radial-gradient(ellipse 90% 70% at 50% 42%, var(--color-box-glow), var(--color-room) 75%)' }}
    >
      <div className="grain absolute inset-0 opacity-5" />
      <div className="absolute top-4 right-4" onClick={(e) => e.stopPropagation()}>
        <LangToggle />
      </div>
      <div className="mb-4.5 font-mono text-[10px] tracking-[0.5em] text-paper/28 uppercase">
        {m.title_tagline()}
      </div>
      <Wordmark aligned={aligned} />
      <div className="mt-8.5 font-mono text-[11px] tracking-[0.25em] text-paper/50 uppercase">
        {m.title_cta()}
      </div>
    </div>
  )
}
