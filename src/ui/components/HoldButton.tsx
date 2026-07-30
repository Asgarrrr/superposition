// An action button that must be HELD, not clicked.

import { useRef, type CSSProperties } from "react";
import type { Hold } from "../hooks/useHold.ts";

const SLOP = 8;

export function HoldButton({
  label,
  hint,
  keyCap,
  hold,
  className = "",
}: {
  label: string;
  hint: string;
  keyCap: string;
  hold: Hold;
  className?: string;
}) {
  // measured on press, not per move: pointermove would force layout every time.
  // Null unless a POINTER opened this hold — one opened on the keycap must not be
  // abandoned by a cursor travelling past.
  const bounds = useRef<DOMRect | null>(null);
  const release = () => {
    bounds.current = null;
    hold.cancel();
  };

  return (
    <button
      type="button"
      aria-label={`${label} — ${hint}`}
      title={hint}
      onClick={(e) => {
        // `detail === 0` is an activation with no press behind it: assistive tech
        // or voice control, which cannot hold. Refusing would leave no reset.
        if (e.detail === 0) hold.confirmNow();
      }}
      className={`btn relative flex w-[136px] touch-none items-center overflow-hidden transition-colors ${className} ${
        hold.holding ? "border-paper/40 text-paper/80" : ""
      }`}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        bounds.current = e.currentTarget.getBoundingClientRect();
        hold.start();
      }}
      onPointerMove={(e) => {
        const r = bounds.current;
        if (!r) return;
        if (
          e.clientX < r.left - SLOP ||
          e.clientX > r.right + SLOP ||
          e.clientY < r.top - SLOP ||
          e.clientY > r.bottom + SLOP
        )
          release();
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onBlur={release}
      // a touch long-press would otherwise raise the OS menu mid-hold
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        // Enter is bound globally to "next board": without this the same press
        // walks off the level it is resetting
        e.stopPropagation();
        if (!e.repeat) hold.start();
      }}
      onKeyUp={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.stopPropagation();
        hold.cancel();
      }}
    >
      <span
        aria-hidden
        className="sp-hold-fill absolute inset-0 border-r border-tape/70 bg-paper/8"
        style={
          {
            transform: hold.holding
              ? "translateX(0)"
              : "translateX(calc(-100% - 2px))",
            "--sp-hold-ms": `${hold.holding ? hold.ms : 180}ms`,
            "--sp-hold-ease": hold.holding
              ? "linear"
              : "cubic-bezier(0.4, 0, 0.2, 1)",
          } as CSSProperties
        }
      />
      <span className="relative">{label}</span>
      <kbd className="kbd relative ml-auto">{keyCap}</kbd>
    </button>
  );
}
