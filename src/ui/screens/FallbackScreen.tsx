// The workshop door: one page for both of the root's route boundaries — a URL
// that names no plate, and a load that failed. Twin screens would drift apart;
// only the title, the body line and the presence of a retry differ, so they get
// a single owner.
//
// Mounted from `__root.tsx`, which is `ssr: true`: this component touches no
// browser API on the first render — no AudioContext, no localStorage, no window.
// It animates nothing either: motion serialises its `initial` into the server's
// HTML and would ship a blank page until hydration (the reason for
// ProfileScreen's `hydrated` flag), and the way back into the game is precisely
// what has to be readable on the first frame. The composition stays the
// edition's — same caisson, same type — so the visitor stays in the workshop
// rather than being thrown out of it.

import { m } from "../../paraglide/messages.js";
import { Room } from "../components/Room.tsx";
import { Wordmark } from "../components/Wordmark.tsx";
import { reducedMotion as reduced } from "../motion.ts";

export function FallbackScreen({
  title,
  body,
  onBack,
  onRetry,
}: {
  title: string;
  body: string;
  /** The way out, always there: back to the edition. */
  onBack: () => void;
  /** Error side only — `router.invalidate()`, which reruns the loader and rearms
   *  the boundary. Absent on a 404: there is nothing to reload. */
  onRetry?: () => void;
}) {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center gap-6 px-8 text-center font-mono text-paper select-none">
      {/* the same room as the rest of the game (variant 0: the warm lamp) */}
      <Room variant={0} reduced={reduced} />

      <div className="relative z-10 flex flex-col items-center gap-6">
        {/* the mark left out of register — that IS the page's state: the two
            films never superposed. Everywhere else it is `aligned`. */}
        <div className="origin-center scale-55 opacity-70">
          <Wordmark />
        </div>

        <div className="flex flex-col items-center gap-3.5">
          <h1 className="font-display text-3xl italic tracking-[0.02em] text-paper/90">
            {title}
          </h1>
          <p className="max-w-xs text-sm leading-relaxed text-paper/55">
            {body}
          </p>
        </div>

        <div className="mt-1 flex flex-wrap items-center justify-center gap-2.5">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="btn tracking-[0.2em] text-paper/70 uppercase"
            >
              {m.fallback_retry()}
            </button>
          )}
          <button
            type="button"
            onClick={onBack}
            className="btn tracking-[0.2em] text-paper/70 uppercase"
          >
            {m.fallback_back()}
          </button>
        </div>
      </div>
    </main>
  );
}
