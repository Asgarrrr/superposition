// The alternate gesture's shortcut, phrased for the input device: the tactile
// maintien-slide (hold still, then slide) on a phone, the Maj+arrow chord on a
// keyboard. One owner so every hint that mentions it — the in-game rule line and
// the tutorial captions — stays in step.

import { m } from "../paraglide/messages.js";
import { coarsePointer } from "./pointer.ts";

export const altHint = (): string =>
  coarsePointer() ? m.gesture_alt_touch() : m.gesture_alt_key();
