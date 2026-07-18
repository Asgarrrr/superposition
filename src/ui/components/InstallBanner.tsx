// The "add to home screen" invitation — a discreet strip along the bottom of
// the title and select screens. On installable Chrome a tap fires the real
// prompt; on iOS Safari (no such API) it teaches the share-sheet gesture with
// the system share glyph. Renders nothing when there's nothing to offer
// (standalone, dismissed, or a browser that can't install). Paper-on-box, no
// masking-tape — installing isn't a record moment.

import { motion } from "motion/react";
import { m } from "../../paraglide/messages.js";
import { reducedMotion as reduced } from "../motion.ts";
import { useInstallPrompt } from "../hooks/useInstallPrompt.ts";

export function InstallBanner() {
  const { mode, install, dismiss } = useInstallPrompt();
  if (!mode) return null;

  return (
    <motion.div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-4"
      style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      initial={reduced ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <div className="pointer-events-auto flex w-[min(92vw,420px)] items-center gap-2.5 rounded-xs border border-paper/12 bg-box/85 py-2.5 pr-2 pl-3.5 font-mono text-[12px] text-paper/85 backdrop-blur-sm">
        {mode === "android" ? (
          <button
            type="button"
            onClick={install}
            className="flex flex-1 cursor-pointer items-center gap-2.5 text-left"
          >
            <InstallGlyph />
            <span className="flex flex-col leading-tight">
              <span className="text-paper/90">{m.install_cta()}</span>
              <span className="text-[10px] tracking-[0.04em] text-paper/40">
                {m.install_hint()}
              </span>
            </span>
          </button>
        ) : (
          <span className="flex flex-1 items-center gap-1.5 leading-tight text-paper/80">
            <span>{m.install_ios_before()}</span>
            <ShareGlyph />
            <span>{m.install_ios_after()}</span>
          </span>
        )}
        <button
          type="button"
          onClick={dismiss}
          aria-label={m.install_dismiss()}
          className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-xs text-paper/40 transition-colors hover:text-paper/70"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
    </motion.div>
  );
}

// down-into-tray: the install action, in the same thin-stroke family as the
// board's registration marks
function InstallGlyph() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 text-paper/70"
      aria-hidden
    >
      <path d="M12 3v11" />
      <path d="M8 10l4 4 4-4" />
      <path d="M5 19h14" />
    </svg>
  );
}

// the iOS system share symbol — a box with an arrow leaving the top; drawn
// inline so it matches Safari's own icon exactly rather than an emoji stand-in
function ShareGlyph() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mb-0.5 inline-block shrink-0 text-ink-cyan/90"
      aria-hidden
    >
      <path d="M12 3v11" />
      <path d="M8 7l4-4 4 4" />
      <path d="M7 11H5v9h14v-9h-2" />
    </svg>
  );
}
