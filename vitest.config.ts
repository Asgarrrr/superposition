import { defineConfig } from "vitest/config";

// Deux projets, séparés par l'extension du fichier, pour qu'aucun ne paie le
// coût de l'autre :
//
//  · `pure` — le moteur, le solveur, les règles serveur et chaque politique
//    extraite. Du TS nu en environnement node : pas de plugin, pas de DOM.
//    C'est là que vivent les règles intéressantes, et la séparation entretient
//    cette pression : une règle qui a besoin de jsdom pour être testée est une
//    règle rangée dans le mauvais module.
//  · `dom` — composants et hooks, sous jsdom. `.test.tsx` uniquement, pour
//    qu'ajouter un test DOM reste un acte délibéré plutôt qu'une dérive.
//
// Le JSX ne demande aucun plugin ici : tsconfig fixe `jsx: react-jsx`, qu'esbuild
// respecte. Le React Compiler est une affaire de build et reste volontairement
// absent — les tests exercent la source telle qu'elle est écrite.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "pure",
          include: ["src/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        test: {
          name: "dom",
          include: ["src/**/*.test.tsx"],
          environment: "jsdom",
          setupFiles: ["src/test/setup.ts"],
        },
      },
    ],
  },
});
