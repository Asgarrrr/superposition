// Title screen as a printer's proof on the light table. The wordmark is
// an oversized anaglyph — two ink films that arrive mis-registered and
// snap into register (paper white) on load, then breathe. Around it, the
// marginalia of a real press sheet: registration crosses, a control strip,
// the colour separations, the edition line.

import { useEffect, useState } from "react";
import { LEVELS } from "../../engine/levels.ts";
import { m } from "../../paraglide/messages.js";
import { Wordmark } from "../components/Wordmark.tsx";
import { LangToggle } from "../components/LangToggle.tsx";
import { LightField } from "../components/LightField.tsx";
import { RegCross } from "../components/RegCross.tsx";

const reduced =
  typeof matchMedia !== "undefined" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

// swap to compare shader backdrops: 0 warm lamp · 1 halftone · 2 duotone
const FIELD_VARIANT = 2;

const chip = "h-2.5 w-[26px]";

export function TitleScreen({ onStart }: { onStart: () => void }) {
  const [aligned, setAligned] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setAligned(true), 650);
    const t2 = setTimeout(() => setAligned(false), 2500);
    const loop = setInterval(() => {
      setAligned(true);
      setTimeout(() => setAligned(false), 1900);
    }, 4600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearInterval(loop);
    };
  }, []);

  return (
    <div
      onClick={onStart}
      className="relative flex min-h-screen cursor-pointer flex-col items-center justify-center overflow-hidden font-mono text-paper select-none"
      style={{
        background:
          "radial-gradient(ellipse 72% 62% at 40% 46%, var(--color-box-glow), #1a1611 45%, var(--color-room) 78%)",
      }}
    >
      <LightField variant={FIELD_VARIANT} reduced={reduced} />
      <div className="grain absolute inset-0 opacity-[0.03]" />

      <RegCross pos="top-11 left-11" />
      <RegCross pos="top-11 right-11" />
      <RegCross pos="bottom-11 left-11" />
      <RegCross pos="bottom-11 right-11" />

      {/* top marginalia */}
      <div className="absolute inset-x-[92px] top-11 flex items-center justify-between text-[11px] tracking-[0.34em] text-paper/45 uppercase">
        <div className="hidden items-center gap-3 sm:flex">
          <span>Atelier</span>
          <span className="text-paper/25">—</span>
          <span>Sérigraphie</span>
        </div>
        <div className="ml-auto" onClick={(e) => e.stopPropagation()}>
          <LangToggle />
        </div>
      </div>

      {/* hero — centred on mobile, pinned left on desktop */}
      <div className="absolute top-1/2 flex -translate-y-1/2 flex-col items-start gap-6 px-6 lg:left-[9%] lg:px-0">
        <div className="flex items-center gap-3 text-[11px] tracking-[0.4em] text-paper/50 uppercase sm:text-[12px]">
          <span className="h-px w-6 bg-tape/90" />
          <span>{m.title_tagline()}</span>
        </div>

        <Wordmark
          size="clamp(58px, 11.5vw, 168px)"
          aligned={aligned}
          spread={2.4}
        />

        <div className="mt-1 flex items-center gap-5">
          <div className="flex overflow-hidden rounded-xs border border-paper/18">
            <span
              className={chip}
              style={{ background: "var(--color-ink-cyan)", opacity: 0.82 }}
            />
            <span
              className={chip}
              style={{ background: "var(--color-ink-magenta)", opacity: 0.82 }}
            />
            <span
              className={chip}
              style={{ background: "var(--color-paper)", opacity: 0.82 }}
            />
          </div>
          <span className="hidden h-px w-8 bg-paper/16 sm:block" />
          <span className="text-[11px] tracking-[0.28em] text-paper/55 uppercase sm:text-[12px]">
            {m.title_cta()}
          </span>
        </div>
      </div>

      {/* colour separations — desktop only */}
      <div className="absolute top-1/2 right-[9%] hidden -translate-y-1/2 flex-col items-end gap-4 lg:flex">
        <div className="flex flex-col items-end gap-3">
          <span className="text-[12px] font-semibold tracking-[0.34em] text-paper/50 uppercase">
            Séparations
          </span>
          <span className="h-px w-[196px] bg-paper/14" />
        </div>
        <SepRow n="01" name="Cyan" color="var(--color-ink-cyan)" />
        <SepRow n="02" name="Magenta" color="var(--color-ink-magenta)" />
        <span className="h-px w-[196px] bg-paper/10" />
        <SepRow n="=" name="Lumière" color="var(--color-paper)" accent />
      </div>

      {/* bottom marginalia */}
      <div className="absolute inset-x-[96px] bottom-12 hidden items-center justify-between text-[11px] tracking-[0.3em] text-paper/40 uppercase sm:flex">
        <span>{m.select_edition({ count: LEVELS.length })}</span>
        <span className="tracking-[0.24em]">I · II · III · IV · V · VI</span>
      </div>
    </div>
  );
}

function SepRow({
  n,
  name,
  color,
  accent = false,
}: {
  n: string;
  name: string;
  color: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center gap-4">
      <span
        className={`w-5 text-right text-[12px] ${accent ? "text-tape/85" : "text-paper/35"}`}
      >
        {n}
      </span>
      <span className="w-[112px] text-right text-[14px] font-medium tracking-[0.16em] text-paper/85 uppercase">
        {name}
      </span>
      <span
        className="h-2.5 w-2.5 rounded-full"
        style={{ background: color }}
      />
    </div>
  );
}
