// Level factory for tests — never imported by the game.
import type { Level } from './types.ts'

export const testLevel = (
  over: Partial<Level> & Pick<Level, 'size' | 'a' | 'b'>,
): Level => ({
  id: 'test',
  ch: 'T',
  name: 'test',
  mods: [],
  ...over,
})
