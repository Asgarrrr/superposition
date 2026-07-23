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

  it("intro_decalage : poussée murée, le glissement fusionne, le blanc traverse", () => {
    const demo = byId("intro_decalage");
    const { steps } = demoSteps(demo);
    expect(steps[0].blocked).toBe(true); // both pawns pinned: the door is shut
    expect(steps[1].merged).toBe(true); // the shift ITSELF triggers the merge
    expect(steps[1].state.off).toEqual([0, -1]);
    const last = steps[2].state;
    if (!last.merged) throw new Error("expected a merged state");
    expect(last.m).toEqual([2, 3]); // the white pawn stands where walls were
    const walled = [...demo.level.a.walls, ...demo.level.b.walls];
    expect(walled).toContainEqual([2, 3]); // …an ink-walled cell in A's film
  });

  it("intro_verso : une poussée horizontale sépare les encres en sens opposés", () => {
    const d = byId("intro_verso");
    const st0 = split(d.start);
    const { steps } = demoSteps(d);
    const s1 = split(steps[0].state);
    const dCyan = s1.a[1] - st0.a[1]; // cyan column delta
    const dMag = s1.b[1] - st0.b[1]; // magenta column delta
    expect(dCyan * dMag).toBeLessThan(0); // opposite horizontal directions: the mirror
    expect(s1.a[0]).toBe(st0.a[0]); // rows unchanged — a horizontal push
    // beat 2 — the edge holds cyan while magenta keeps sliding
    const s2 = split(steps[1].state);
    expect(s2.a).toEqual(s1.a); // cyan pinned against the edge
    expect(s2.b[1]).toBeLessThan(s1.b[1]); // magenta still moving left
  });

  it("intro_repere : le monde se décale, puis la goupille recale et fusionne", () => {
    const { steps } = demoSteps(byId("intro_repere"));
    expect(steps[0].merged).toBe(false);
    expect(steps[0].state.off).not.toEqual([0, 0]); // the shift takes the marks off-register
    expect(steps[1].merged).toBe(true); // the pin snap ITSELF triggers the fusion
    expect(steps[1].state.off).toEqual([0, 0]); // …and pulls the marks back home
    const merged = steps[1].state;
    if (!merged.merged) throw new Error("expected a merged state");
    expect(merged.m).toEqual([2, 2]); // fused on the pin
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

  it("les gestes bloqués scriptés sont exactement les leçons lumière et décalage", () => {
    for (const d of DEMOS) {
      const blocked = demoSteps(d)
        .steps.map((s, i) => (s.blocked ? i : -1))
        .filter((i) => i >= 0);
      expect(blocked).toEqual(
        d.id === "intro_lumiere" || d.id === "intro_decalage" ? [0] : [],
      );
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
  it("Reflet déclenche verso", () => {
    expect(pickDemo(L("reflet"), [])?.id).toBe("intro_verso");
  });
  it("Envers déclenche verso même quand fusion est déjà vue (verso est la neuve)", () => {
    expect(pickDemo(L("envers"), ["intro_fusion"])?.id).toBe("intro_verso");
  });
  it("Goupille déclenche repere quand décalage est déjà vu", () => {
    expect(pickDemo(L("goupille"), ["intro_fusion", "intro_decalage"])?.id).toBe(
      "intro_repere",
    );
  });
  it("Calage (cinq mécaniques) déclenche repere en dernier", () => {
    expect(
      pickDemo(L("calage"), ["intro_fusion", "intro_glace", "intro_decalage"])
        ?.id,
    ).toBe("intro_repere");
  });
  it("un niveau sans mécanique neuve (Accord) ne déclenche rien", () => {
    expect(pickDemo(L("accord"), [])).toBeNull();
  });
});
