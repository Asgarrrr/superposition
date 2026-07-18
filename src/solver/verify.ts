// Level bank verification — `bun run verify`.
// Rejects any unsolvable level and measures difficulty.

import { LEVELS } from "../engine/levels.ts";
import { MECHANICS } from "../engine/mechanics/registry.ts";
import { fmtInput, isRequired, solve } from "./bfs.ts";

let failed = false;
for (const lv of LEVELS) {
  const sol = solve(lv);
  if (!sol) {
    console.error(`✗ ${lv.id} : INSOLUBLE`);
    failed = true;
    continue;
  }
  // tag each mechanic the level truly cannot do without (per its declaration)
  const tags = lv.mods
    .filter((mo) => MECHANICS[mo].mustBeNeeded)
    .filter((mo) => isRequired(lv, mo))
    .map((mo) => `${mo} obligatoire`)
    .join(", ");
  console.log(
    `✓ ${lv.ch.padEnd(3)} ${lv.name.padEnd(12)} ${String(sol.inputs.length).padStart(2)} coups` +
      (tags ? `  [${tags}]` : "") +
      `  ${sol.inputs.map(fmtInput).join(" ")}`,
  );
}
process.exit(failed ? 1 : 0);
