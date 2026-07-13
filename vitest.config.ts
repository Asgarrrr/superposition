import { defineConfig } from 'vitest/config'

// Config dédiée : les tests moteur sont du TS pur, inutile de charger
// les plugins React/Tailwind de vite.config.ts.
export default defineConfig({
  test: { include: ['src/**/*.test.ts'] },
})
