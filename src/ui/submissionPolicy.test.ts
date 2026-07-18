// Pins the submission policy: one post per solve, best result per account,
// failures stay submittable, and — above all — no trace laundering: a solve
// evaluated under account A never auto-posts under account B.

import { describe, expect, it } from "vitest";
import type { TraceStep } from "../engine/types.ts";
import {
  decideSubmission,
  initialSubmission,
  type Solve,
  type SubmissionDecision,
  type SubmissionEvent,
  type SubmissionState,
} from "./submissionPolicy.ts";

const mv = (r: number, c: number): TraceStep => ({ kind: "move", dir: [r, c] });

const solveOf = (moves: number, undos = 0): Solve => {
  const trace: TraceStep[] = [];
  for (let i = 0; i < undos; i++) trace.push(mv(0, 1), { kind: "undo" });
  for (let i = 0; i < moves; i++) trace.push(mv(0, 1));
  return { trace, moves };
};

/** Runs events in order, collecting each decision's submit payload. */
const run = (events: SubmissionEvent[], from = initialSubmission) => {
  let state: SubmissionState = from;
  const submits: SubmissionDecision["submit"][] = [];
  for (const e of events) {
    const d = decideSubmission(state, e);
    state = d.state;
    if (d.submit) submits.push(d.submit);
  }
  return { state, submits };
};

describe("decideSubmission", () => {
  it("premier solve connecté → un seul post, avec la trace brute", () => {
    const s = solveOf(3);
    const { submits } = run([
      { kind: "session", uid: "A" },
      { kind: "solve", solve: s },
    ]);
    expect(submits).toEqual([s.trace]);
  });

  it("solve hors session, puis connexion → le compte le revendique", () => {
    const s = solveOf(3);
    const { submits } = run([
      { kind: "solve", solve: s },
      { kind: "session", uid: "A" },
    ]);
    expect(submits).toEqual([s.trace]);
  });

  it("après succès, session/retry ne repostent pas le même solve", () => {
    const s = solveOf(3);
    const { submits } = run([
      { kind: "session", uid: "A" },
      { kind: "solve", solve: s },
      { kind: "submitted" },
      { kind: "session", uid: "A" },
      { kind: "retry" },
    ]);
    expect(submits).toEqual([s.trace]);
  });

  it("anti-blanchiment : un solve posté sous A ne repart pas sous B", () => {
    const s = solveOf(3);
    const { submits } = run([
      { kind: "session", uid: "A" },
      { kind: "solve", solve: s },
      { kind: "submitted" },
      { kind: "session", uid: null }, // déconnexion
      { kind: "session", uid: "B" },
      { kind: "retry" },
    ]);
    expect(submits).toEqual([s.trace]); // un seul post, sous A
  });

  it("anti-blanchiment : un solve refusé sous A est consommé, B n'en hérite pas", () => {
    const better = solveOf(3);
    const worse = solveOf(5);
    const { submits } = run([
      { kind: "session", uid: "A" },
      { kind: "solve", solve: better },
      { kind: "submitted" },
      { kind: "solve", solve: worse }, // refusé : moins bon pour A
      { kind: "session", uid: null },
      { kind: "session", uid: "B" },
    ]);
    expect(submits).toEqual([better.trace]);
  });

  it("un solve amélioré reposte, un moins bon ou égal non", () => {
    const first = solveOf(5);
    const improved = solveOf(4);
    const equal = solveOf(4);
    const dirty = solveOf(4, 2); // mêmes coups, mais des corrections
    const { submits } = run([
      { kind: "session", uid: "A" },
      { kind: "solve", solve: first },
      { kind: "submitted" },
      { kind: "solve", solve: improved },
      { kind: "submitted" },
      { kind: "solve", solve: equal }, // égal au posté → refusé
      { kind: "solve", solve: dirty }, // moins propre → refusé
    ]);
    expect(submits).toEqual([first.trace, improved.trace]);
  });

  it("à moves égaux, moins de corrections reposte", () => {
    const dirty = solveOf(4, 2);
    const clean = solveOf(4, 0);
    const { submits } = run([
      { kind: "session", uid: "A" },
      { kind: "solve", solve: dirty },
      { kind: "submitted" },
      { kind: "solve", solve: clean },
    ]);
    expect(submits).toEqual([dirty.trace, clean.trace]);
  });

  it("échec → le solve reste soumissible, retry reposte", () => {
    const s = solveOf(3);
    const { submits } = run([
      { kind: "session", uid: "A" },
      { kind: "solve", solve: s },
      { kind: "failed" },
      { kind: "retry" },
    ]);
    expect(submits).toEqual([s.trace, s.trace]);
  });

  it("échec d'une amélioration → retry reposte l'amélioration", () => {
    const first = solveOf(5);
    const better = solveOf(3);
    const { submits } = run([
      { kind: "session", uid: "A" },
      { kind: "solve", solve: first },
      { kind: "submitted" },
      { kind: "solve", solve: better },
      { kind: "failed" },
      { kind: "retry" },
      { kind: "submitted" },
      { kind: "retry" }, // une fois posté, plus rien
    ]);
    expect(submits).toEqual([first.trace, better.trace, better.trace]);
  });

  it("échec puis changement de compte → B peut revendiquer (rien n'a été posté)", () => {
    const s = solveOf(3);
    const { submits } = run([
      { kind: "session", uid: "A" },
      { kind: "solve", solve: s },
      { kind: "failed" },
      { kind: "session", uid: null },
      { kind: "session", uid: "B" },
    ]);
    expect(submits).toEqual([s.trace, s.trace]);
  });

  it("un win annulé (undo) emporte son solve non posté", () => {
    const s = solveOf(3);
    const { submits } = run([
      { kind: "solve", solve: s },
      { kind: "solve", solve: null }, // undo avant toute session
      { kind: "session", uid: "A" },
    ]);
    expect(submits).toEqual([]);
  });

  it("pas de double post pendant qu'un envoi est en vol", () => {
    const s = solveOf(3);
    const { submits } = run([
      { kind: "session", uid: "A" },
      { kind: "solve", solve: s },
      { kind: "retry" }, // en vol : rien ne repart
      { kind: "session", uid: "A" },
    ]);
    expect(submits).toEqual([s.trace]);
  });

  it("un solve arrivé pendant l'envoi est évalué au retour du succès", () => {
    const first = solveOf(5);
    const better = solveOf(3);
    const { submits } = run([
      { kind: "session", uid: "A" },
      { kind: "solve", solve: first },
      { kind: "solve", solve: better }, // en vol : mis en attente
      { kind: "submitted" }, // first posté → better évalué → posté
    ]);
    expect(submits).toEqual([first.trace, better.trace]);
  });

  it("anti-blanchiment : l'amélioration échouée de A ne repart pas sous B, mais repart sous A", () => {
    const first = solveOf(5);
    const better = solveOf(3);
    const { state, submits } = run([
      { kind: "session", uid: "A" },
      { kind: "solve", solve: first },
      { kind: "submitted" },
      { kind: "solve", solve: better },
      { kind: "failed" }, // le pending survit…
      { kind: "session", uid: null },
      { kind: "session", uid: "B" }, // …mais B ne peut pas le revendiquer
    ]);
    expect(submits).toEqual([first.trace, better.trace]);
    // le pending appartient toujours à A : son retour relance le post
    const back = run([{ kind: "session", uid: "A" }], state);
    expect(back.submits).toEqual([better.trace]);
  });

  it("anti-blanchiment : un solve hors session APRÈS un post n'est pas revendiqué par B", () => {
    const s = solveOf(5);
    const later = solveOf(3);
    const { submits } = run([
      { kind: "session", uid: "A" },
      { kind: "solve", solve: s },
      { kind: "submitted" },
      { kind: "session", uid: null },
      { kind: "solve", solve: later }, // hors session, mais A a déjà posté
      { kind: "session", uid: "B" },
    ]);
    expect(submits).toEqual([s.trace]);
  });

  it("statut : échec → error, retry avec pending → submitting", () => {
    const s = solveOf(3);
    const failed = run([
      { kind: "session", uid: "A" },
      { kind: "solve", solve: s },
      { kind: "failed" },
    ]);
    expect(failed.state.status).toBe("error");
    const retried = run([{ kind: "retry" }], failed.state);
    expect(retried.state.status).toBe("submitting");
    expect(retried.submits).toEqual([s.trace]);
  });

  it("statut : un win annulé emporte l'erreur, retry sans pending reste idle", () => {
    const s = solveOf(3);
    const { state } = run([
      { kind: "session", uid: "A" },
      { kind: "solve", solve: s },
      { kind: "failed" },
      { kind: "solve", solve: null }, // le joueur annule le win
    ]);
    expect(state.status).toBe("idle");
    const retried = run([{ kind: "retry" }], state);
    expect(retried.state.status).toBe("idle"); // pas d'erreur fantôme
    expect(retried.submits).toEqual([]);
  });

  it("statut : un post enchaîné après un succès garde submitting, puis idle", () => {
    const first = solveOf(5);
    const better = solveOf(3);
    const chained = run([
      { kind: "session", uid: "A" },
      { kind: "solve", solve: first },
      { kind: "solve", solve: better }, // en vol : mis en attente
      { kind: "submitted" }, // enchaîne le post de better
    ]);
    expect(chained.state.status).toBe("submitting");
    const done = run([{ kind: "submitted" }], chained.state);
    expect(done.state.status).toBe("idle");
  });
});
