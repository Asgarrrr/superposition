// Screen router — title, select, play. Sound and mute live
// here: a single AudioContext for the session, a setting that survives
// level changes.

import { useState } from 'react'
import { LEVELS } from '../engine/levels.ts'
import { useBestScores } from './hooks/useBestScores.ts'
import { useSound } from './hooks/useSound.ts'
import { PlayScreen } from './screens/PlayScreen.tsx'
import { SelectScreen } from './screens/SelectScreen.tsx'
import { TitleScreen } from './screens/TitleScreen.tsx'

type Screen = 'title' | 'select' | 'play'

export default function App() {
  const [screen, setScreen] = useState<Screen>('title')
  const [idx, setIdx] = useState(0)
  const [muted, setMutedState] = useState(false)
  const { best, record } = useBestScores()
  const { fx, setMuted } = useSound()

  if (screen === 'title') return <TitleScreen onStart={() => setScreen('select')} />

  if (screen === 'select')
    return (
      <SelectScreen
        best={best}
        onPick={(i) => {
          setIdx(i)
          setScreen('play')
        }}
      />
    )

  const level = LEVELS[idx]
  return (
    <PlayScreen
      key={level.id}
      level={level}
      plate={idx + 1}
      total={LEVELS.length}
      best={best[level.id]}
      fx={fx}
      muted={muted}
      onToggleMute={() => {
        setMuted(!muted)
        setMutedState(!muted)
      }}
      onWin={(moves) => record(level.id, moves)}
      onNext={idx < LEVELS.length - 1 ? () => setIdx(idx + 1) : null}
      onExit={() => setScreen('select')}
    />
  )
}
