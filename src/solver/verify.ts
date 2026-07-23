// Level bank verification — `bun run verify`.
// Rejects any unsolvable level and measures difficulty.

import { LEVELS } from "../engine/levels.ts";
import { PAR } from "../engine/par.ts";
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
  // par is derived data (src/engine/par.ts): it must equal the optimum the
  // solver just measured, or the "bon à tirer" stamp would be a lie
  if (PAR[lv.id] !== sol.inputs.length) {
    console.error(
      `✗ ${lv.id} : par ${PAR[lv.id]} ≠ ${sol.inputs.length} coups`,
    );
    failed = true;
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
// a par entry with no board is a stale lie (a missing one is already caught
// above, where PAR[lv.id] comes back undefined)
const ids = new Set(LEVELS.map((lv) => lv.id));
for (const id of Object.keys(PAR)) {
  if (!ids.has(id)) {
    console.error(`✗ ${id} : par sans planche`);
    failed = true;
  }
}
process.exit(failed ? 1 : 0);
