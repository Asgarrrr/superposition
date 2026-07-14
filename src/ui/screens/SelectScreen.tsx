// Selection: the full edition, level by level, chapter by chapter.

import { motion } from "motion/react";
import { LEVELS } from "../../engine/levels.ts";
import { m } from "../../paraglide/messages.js";
import { chapterName } from "../copy.ts";
import { Wordmark } from "../components/Wordmark.tsx";
import { LangToggle } from "../components/LangToggle.tsx";
import { RevealOverlay } from "./RevealOverlay.tsx";

const reduced =
  typeof matchMedia !== "undefined" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

// the develop-in: header then plates rise and surface in sequence, so the
// edition reads as a print coming up on the table rather than a static list
const column = {
  hidden: {},
  visible: { transition: { delayChildren: 0.3, staggerChildren: 0.06 } },
};
const plates = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.035 } },
};
const rise = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
  },
};

// `reveal` (set when arriving from the enter screen) opens the selector out of
// the same white flood the enter screen ends on: the halftone rosette resolves
// while the edition develops in underneath, so the route swap reads as one
// continuous gesture. False on a plain return — then it renders at rest.
export function SelectScreen({
  best,
  onPick,
  reveal = false,
}: {
  best: Record<string, number>;
  onPick: (idx: number) => void;
  reveal?: boolean;
}) {
  const play = reveal && !reduced;
  return (
    <motion.div
      className="relative flex min-h-screen flex-col items-center bg-room px-4 pt-9 pb-12 font-mono text-paper select-none"
      variants={column}
      initial={play ? "hidden" : false}
      animate="visible"
    >
      {play && <RevealOverlay />}
      <div className="grain fixed inset-0" />
      <LangToggle className="absolute top-4 right-4" />
      <motion.div variants={rise} className="mb-1.5 origin-center scale-55">
        <Wordmark aligned />
      </motion.div>
      <motion.div
        variants={rise}
        className="mb-7.5 text-[10px] tracking-[0.4em] text-paper/28 uppercase"
      >
        {m.select_edition({ count: LEVELS.length })}
      </motion.div>
      <motion.div
        variants={plates}
        className="flex w-[min(92vw,420px)] flex-col gap-2"
      >
        {LEVELS.map((lv, i) => (
          <motion.div variants={rise} key={lv.id} className="flex flex-col">
            {(i === 0 || lv.ch !== LEVELS[i - 1].ch) && (
              <div className="mx-0 mt-4 mb-2 flex items-baseline gap-2.5 text-[10px] tracking-[0.3em] text-paper/28 uppercase">
                <span>{m.select_set({ ch: lv.ch })}</span>
                <span className="flex-1 border-b border-paper/12" />
                <span className="font-display text-[15px] normal-case italic tracking-[0.02em] text-paper/50">
                  {chapterName(lv.ch)}
                </span>
              </div>
            )}
            <button
              type="button"
              className="btn flex items-center gap-3.5 border-paper/14 px-3.5 py-3 text-left"
              onClick={() => onPick(i)}
            >
              <span className="text-[11px] text-paper/28">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="flex-1 font-display text-sm italic tracking-[0.02em] text-paper">
                {lv.name}
              </span>
              {best[lv.id] !== undefined && (
                <span className="text-[10px] tracking-[0.1em] text-tape">
                  ✓ {best[lv.id]}
                </span>
              )}
            </button>
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
}
