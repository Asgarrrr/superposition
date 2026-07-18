import { describe, expect, it } from "vitest";
import type { GameState } from "../engine/types.ts";
import { applyInput } from "../engine/successors.ts";
import { DEMOS, demoSteps, pickDemo } from "./demos.ts";
import { LEVELS } from "../engine/levels.ts";

const byId = (id: string) => {
  const d = DEMOS.find((d) => d.id === id);
  if (!d) throw new Error(`unknown demo ${id}`);
  return d;
};
// narrow a state to its split (non-merged) shape or fail the test
const split = (s: GameState) => {
  if (s.merged) throw new Error("expected a split state");
  return s;
};

describe("démos — invariants moteur", () => {
  it("intro_fusion fusionne puis scinde en deux encres opposées", () => {
    const { steps } = demoSteps(byId("intro_fusion"));
    expect(steps.some((s) => s.merged)).toBe(true); // une étape passe en fusionné
    const last = split(steps[steps.length - 1].state);
    expect(last.a).toEqual([2, 0]); // cyan descend
    expect(last.b).toEqual([0, 0]); // magenta monte
    expect(last.a).not.toEqual(last.b);
  });

  it("intro_lumiere : le blanc bute sur la lumière, les encres la traversent", () => {
    const demo = byId("intro_lumiere");
    const { steps } = demoSteps(demo);
    expect(steps[0].blocked).toBe(true); // le blanc est bloqué par le carré de lumière
    const s = split(steps[1].state);
    const light = demo.level.lightWalls?.[0];
    expect(s.a).toEqual(light); // une encre occupe la case de lumière : elles la traversent
  });

  it("intro_glace glisse de plus d’une case et s’arrête au mur", () => {
    const { steps } = demoSteps(byId("intro_glace"));
    const s = split(steps[0].state);
    expect(s.a).toEqual([1, 2]); // parti de [1,0], glissé jusqu’au mur en [1,3]
    expect(Math.abs(s.a[1])).toBeGreaterThan(1);
  });

  it("intro_decalage : la poussée garde l'écart, le glissement du monde fusionne", () => {
    const { steps } = demoSteps(byId("intro_decalage"));
    const after = split(steps[0].state); // push: both move, still apart
    expect(after.a).not.toEqual(after.b);
    expect(after.off).toEqual([0, 0]);
    expect(steps[1].merged).toBe(true); // the shift ITSELF triggers the merge
    expect(steps[1].state.off).toEqual([0, -1]);
  });

  it("chaque étape non bloquée fait avancer l’état", () => {
    for (const d of DEMOS) {
      const { start, steps } = demoSteps(d);
      let prev = start;
      for (const s of steps) {
        if (!s.blocked) expect(s.state).not.toBe(prev);
        else expect(s.state).toBe(prev);
        prev = s.state;
      }
    }
  });
});

describe("démos — beats guidés", () => {
  it("chaque démo a un titre, un sous-titre, et une consigne + payoff par beat", () => {
    for (const d of DEMOS) {
      expect(d.title().length).toBeGreaterThan(0);
      expect(d.sub().length).toBeGreaterThan(0);
      for (const b of d.beats) {
        expect(b.say().length).toBeGreaterThan(0);
        expect(b.done().length).toBeGreaterThan(0);
      }
    }
  });

  it("scission libre : chaque direction légale diverge, les autres sont refusées par le moteur", () => {
    const d = byId("intro_fusion");
    const { steps } = demoSteps(d);
    const merged = steps[0].state; // after the push-left merge
    expect(merged.merged).toBe(true);
    let legal = 0;
    for (const dir of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ] as const) {
      const next = applyInput(merged, d.level, { kind: "split", dir });
      if (next === null) continue; // engine-refused: an ink would leave the board
      legal++;
      const s = split(next);
      expect(s.a).not.toEqual(s.b); // cyan follows, magenta mirrors: they diverge
    }
    expect(legal).toBeGreaterThan(0);
  });

  it("décalage : aucune poussée seule ne fusionne depuis le départ", () => {
    // the choreography's premise — pushes preserve the board gap, only the
    // world gesture closes it
    const d = byId("intro_decalage");
    for (const dir of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ] as const) {
      const next = applyInput(d.start, d.level, { kind: "move", dir });
      if (next !== null) expect(next.merged).toBe(false);
    }
  });

  it("seule la leçon lumière contient un geste bloqué scripté", () => {
    for (const d of DEMOS) {
      const blocked = demoSteps(d)
        .steps.map((s, i) => (s.blocked ? i : -1))
        .filter((i) => i >= 0);
      expect(blocked).toEqual(d.id === "intro_lumiere" ? [0] : []);
    }
  });
});

describe("démos — déclenchement à la première rencontre", () => {
  const L = (id: string) => {
    const l = LEVELS.find((l) => l.id === id);
    if (!l) throw new Error(`unknown level ${id}`);
    return l;
  };

  it("Blanc déclenche la démo fusion", () => {
    expect(pickDemo(L("blanc"), [])?.id).toBe("intro_fusion");
  });
  it("déjà vue → plus de déclenchement", () => {
    expect(pickDemo(L("blanc"), ["intro_fusion"])).toBeNull();
  });
  it("Éclipse déclenche lumière quand fusion est déjà vue", () => {
    expect(pickDemo(L("eclipse"), ["intro_fusion"])?.id).toBe("intro_lumiere");
  });
  it("Trinité déclenche glace quand le reste est vu", () => {
    expect(pickDemo(L("trinite"), ["intro_fusion", "intro_lumiere"])?.id).toBe(
      "intro_glace",
    );
  });
  it("Dérive déclenche décalage quand fusion est déjà vue", () => {
    expect(pickDemo(L("derive"), ["intro_fusion"])?.id).toBe("intro_decalage");
  });
  it("un niveau sans mécanique neuve (Accord) ne déclenche rien", () => {
    expect(pickDemo(L("accord"), [])).toBeNull();
  });
});
