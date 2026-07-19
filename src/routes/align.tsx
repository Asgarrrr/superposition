// Prototype — "align to enter". The menu IS the mechanic: drag the magenta
// film onto the cyan one; within range it snaps into register, the word
// prints white, a "bon à tirer" stamp lands, and it opens the game.
// Throwaway test route at /align — not wired into the app's screen flow.

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";

export const Route = createFileRoute("/align")({ component: AlignPrototype });

const SNAP = 18; // px: auto-lock radius while dragging
const MAGNET = 60; // px: pull-in radius on release

function AlignPrototype() {
  const navigate = useNavigate();
  const [off, setOff] = useState({ x: 72, y: 46 }); // magenta offset from register
  const [solved, setSolved] = useState(false);
  const drag = useRef<{
    px: number;
    py: number;
    ox: number;
    oy: number;
  } | null>(null);

  const dist = Math.hypot(off.x, off.y);
  const progress = solved ? 1 : Math.max(0, 1 - dist / 120);

  const lock = () => {
    setOff({ x: 0, y: 0 });
    setSolved(true);
  };

  const onDown = (e: React.PointerEvent) => {
    if (solved) return;
    drag.current = { px: e.clientX, py: e.clientY, ox: off.x, oy: off.y };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || solved) return;
    const nx = d.ox + (e.clientX - d.px);
    const ny = d.oy + (e.clientY - d.py);
    if (Math.hypot(nx, ny) < SNAP) return lock();
    setOff({ x: nx, y: ny });
  };
  const onUp = () => {
    if (!drag.current || solved) return;
    drag.current = null;
    if (dist < MAGNET) lock();
  };

  const reset = () => {
    setSolved(false);
    setOff({ x: 72, y: 46 });
  };

  const layer = (
    color: string,
    dx: number,
    dy: number,
  ): React.CSSProperties => ({
    position: "absolute",
    inset: 0,
    color,
    mixBlendMode: "screen",
    transform: `translate(${dx}px, ${dy}px)`,
    transition: drag.current
      ? "none"
      : "transform 480ms cubic-bezier(0.22,1,0.36,1)",
    whiteSpace: "nowrap",
  });

  return (
    <div
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      className="relative flex min-h-dvh touch-none flex-col items-center justify-center overflow-hidden font-mono text-paper select-none"
      style={{
        cursor: solved ? "default" : drag.current ? "grabbing" : "grab",
        background:
          "radial-gradient(ellipse 70% 60% at 50% 46%, var(--color-box-glow), #1a1611 46%, var(--color-room) 78%)",
      }}
    >
      <div className="grain absolute inset-0 opacity-5" />

      <div className="mb-14 flex items-center gap-3 text-[12px] font-semibold tracking-[0.4em] text-paper/45 uppercase">
        <span
          className="h-px w-6"
          style={{ background: "var(--color-tape)" }}
        />
        <span>{solved ? "Calé — bon à tirer" : "Épreuve — à caler"}</span>
        <span
          className="h-px w-6"
          style={{ background: "var(--color-tape)" }}
        />
      </div>

      {/* the two films */}
      <div
        className="relative"
        style={{ fontSize: "clamp(52px, 10vw, 150px)" }}
      >
        {/* register target */}
        <div
          className="absolute rounded-md border border-dashed transition-opacity duration-500"
          style={{
            inset: "-8px -14px",
            borderColor: "rgba(242,237,228,0.22)",
            opacity: solved ? 0 : 0.5 + progress * 0.4,
          }}
        />
        <div
          className="relative font-display italic"
          style={{ lineHeight: 1, letterSpacing: "0.02em" }}
        >
          <span style={layer("var(--color-ink-cyan)", 0, 0)}>
            Superposition
          </span>
          <span style={layer("var(--color-ink-magenta)", off.x, off.y)}>
            Superposition
          </span>
          <span className="invisible">Superposition</span>

          {/* drag handle rides the magenta film */}
          {!solved && (
            <div
              className="absolute grid place-items-center rounded-full border"
              style={{
                right: -10,
                bottom: 6,
                width: 44,
                height: 44,
                transform: `translate(${off.x}px, ${off.y}px)`,
                transition: drag.current
                  ? "none"
                  : "transform 480ms cubic-bezier(0.22,1,0.36,1)",
                background: "rgba(20,17,14,0.55)",
                borderColor: "rgba(242,237,228,0.5)",
                boxShadow: `0 0 0 ${4 + progress * 8}px rgba(232,184,75,${0.06 + progress * 0.14})`,
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 22 22"
                fill="none"
                stroke="var(--color-paper)"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M11 3v16M3 11h16M11 3l-2.5 2.5M11 3l2.5 2.5M11 19l-2.5-2.5M11 19l2.5-2.5M3 11l2.5-2.5M3 11l2.5 2.5M19 11l-2.5-2.5M19 11l-2.5 2.5" />
              </svg>
            </div>
          )}

          {/* register bloom + stamp on lock */}
          {solved && (
            <>
              <div
                className="pointer-events-none absolute left-1/2 top-1/2 rounded-full border"
                style={{
                  width: 40,
                  height: 40,
                  marginLeft: -20,
                  marginTop: -20,
                  borderColor: "var(--color-paper)",
                  animation: "sp-bloom 620ms ease-out forwards",
                }}
              />
              <div
                className="absolute font-display text-[26px] tracking-[0.06em] text-tape italic"
                style={{
                  right: -30,
                  top: -34,
                  animation: "sp-stamp 520ms ease-out both",
                }}
              >
                bon à tirer
              </div>
            </>
          )}
        </div>
      </div>

      {/* instruction / result */}
      <div className="mt-16 flex h-8 items-center gap-4 text-[13px] tracking-[0.14em] text-paper/70">
        {solved ? (
          <button
            type="button"
            onClick={() => navigate({ to: "/" })}
            className="btn tracking-[0.24em] text-paper/80 uppercase"
          >
            Entrer dans le tirage →
          </button>
        ) : (
          <span>Glissez le film magenta sur le cyan</span>
        )}
      </div>

      {solved && (
        <button
          type="button"
          onClick={reset}
          className="absolute bottom-10 text-[11px] tracking-[0.3em] text-paper/30 uppercase"
        >
          recommencer
        </button>
      )}
    </div>
  );
}
