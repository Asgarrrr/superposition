// The engine contract: state is FINITE, DISCRETE, DETERMINISTIC, HASHABLE.
// No randomness during play, no real time, no hidden information.

export type Pos = readonly [number, number];

export type Input =
  | { kind: "move"; dir: Pos }
  | { kind: "split"; dir: Pos }
  | { kind: "shift"; dir: Pos }; // shifts layer B by one cell

/** A raw play-session event: an applied input, or a correction (undo / reset).
 * The full trace is submitted to the campaign leaderboard so the server can
 * replay it and count corrections — a "clean" solve has none. Discriminated by
 * `kind` (the control tokens can't collide with an Input's kind). */
export type TraceStep = Input | { kind: "undo" } | { kind: "reset" };

/** `off`: offset of layer B relative to layer A (bounded). */
export type GameState =
  | { merged: false; a: Pos; b: Pos; off: Pos }
  | { merged: true; m: Pos; off: Pos };

export interface LayerDef {
  start: Pos;
  goal: Pos;
  walls: Pos[];
}

export type MechanicId =
  "fusion" | "scission" | "lumiere" | "glace" | "decalage" | "verso" | "repere";

export interface Level {
  id: string;
  ch: string;
  name: string;
  size: number;
  mods: MechanicId[];
  a: LayerDef;
  b: LayerDef;
  lightWalls?: Pos[]; // in board coordinates (layer A)
  pins?: Pos[]; // registration pins, in board coordinates (layer A)
}

export interface MoveCtx {
  level: Level;
  walls: Set<number>;
}

export interface Mechanic {
  id: MechanicId;
  /** Necessity proofs (solver side): the ids to remove alongside this one when
   * testing whether the level needs it. Fusion drags scission along — a split
   * is meaningless without a merge to undo, so they form one capability.
   * Omitted = the mechanic stands alone ([id]). */
  removedWith?: MechanicId[];
  /** True when a level advertising this mechanic must be UNSOLVABLE without
   * it (the generator rejects the level otherwise). Ice and light are exempt:
   * they change the texture of play even when avoidable. */
  mustBeNeeded?: boolean;
  hooks: {
    /** At most ONE active mechanic may define this — movement has no
     * composition order, and successors() throws if two are active. */
    resolveMove?: (pos: Pos, dir: Pos, ctx: MoveCtx) => Pos;
    mergedWalls?: (level: Level) => Pos[];
    enablesMerge?: boolean;
    extraSuccessors?: (state: GameState, level: Level) => [Input, GameState][];
    /** Remaps layer B's `move` direction while unmerged, applied BEFORE the
     * mover resolves. At most ONE active mechanic may define this — remapping
     * has no composition order, and successors() throws if two are active. */
    mapDirB?: (dir: Pos) => Pos;
    /** Post-processes every produced successor state (all branches). Merged
     * states must be returned untouched. successors() drops a settled state
     * equal to its origin (no no-op transitions). At most ONE active mechanic
     * may define this — the correction has no composition order. */
    settle?: (next: GameState, level: Level) => GameState;
  };
}
