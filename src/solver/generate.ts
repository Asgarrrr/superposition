// Generator CLI — `bun run gen -- --mods fusion,scission,glace --size 5 --min 18 --ms 30000`.
// Thin wrapper over hunt() (src/solver/hunt.ts): parses argv, prints the best finds.

import type { MechanicId } from "../engine/types.ts";
import { hunt } from "./hunt.ts";

const arg = (name: string, dflt: string) => {
  const i = process.argv.indexOf("--" + name);
  return i > -1 ? process.argv[i + 1] : dflt;
};

const mods = arg("mods", "fusion,scission").split(",") as MechanicId[];
const size = Number(arg("size", "5"));
const minLen = Number(arg("min", "16"));
const budgetMs = Number(arg("ms", "30000"));

const { found, tested } = hunt({ mods, size, minLen, budgetMs });

console.log(
  `mods=[${mods}] size=${size} · testés ${tested} · retenus ${found.length}\n`,
);
for (const f of found.slice(0, 5)) {
  console.log(`score ${f.score} · ${f.len} coups · ${f.proofs.join(", ")}`);
  console.log(`  a: ${JSON.stringify(f.lv.a)}`);
  console.log(`  b: ${JSON.stringify(f.lv.b)}`);
  if (f.lv.lightWalls)
    console.log(`  lumière: ${JSON.stringify(f.lv.lightWalls)}`);
  console.log(`  sol: ${f.sol}\n`);
}
