// iPhone haptics for a game that never asked for a native app. Safari has
// never implemented the Web Vibration API, so `navigator.vibrate` is undefined
// on iOS and every buzz the game emits is silently dropped — which is why the
// board feels dead in the hand on an iPhone.
//
// The one lever WebKit gives us is the switch control shipped in Safari 17.4:
// toggling an `<input type="checkbox" switch>` fires the Taptic Engine. Clicking
// the input from script does nothing; the activation has to arrive through its
// `<label>`, so we keep one hidden label/switch pair around and `label.click()`
// it to produce a single "tick".
//
// There is no intensity or duration knob — one toggle is one fixed tick. We fake
// both by how MANY ticks we fire and how tightly we pack them: a longer buzz
// becomes more ticks, and ticks spaced by ~PULSE_GAP fuse into a stronger,
// grittier sensation. That lets the existing `vibrate()` patterns (a plain
// number, or a Web-Vibration `[on, off, on, …]` array) map onto something the
// hand can actually tell apart — a soft block vs. a chunky merge vs. a win.
//
// Honest limits: this works on iOS 17.4–26.4 only. Apple closed the
// programmatic-toggle loophole in iOS 26.5, so on newer iPhones this degrades
// back to no haptics (a no-op, never an error). Android keeps using
// `navigator.vibrate` — see haptics.ts.

/** Rapid ticks closer than this fuse into one buzz; wider reads as a gap. */
const PULSE_GAP = 45;

let pair: HTMLLabelElement | null = null;

/** iOS 17.4+ is the whole audience for this trick. We gate on the switch
 *  control existing (feature, not UA) and on a touch-capable Apple device so we
 *  never inject a stray element on Android/desktop, where navigator.vibrate or
 *  nothing-at-all already has it covered. */
function supported(): boolean {
  if (typeof document === "undefined" || typeof navigator === "undefined")
    return false;
  if (!("switch" in document.createElement("input"))) return false;
  const ua = navigator.userAgent;
  // iPadOS 13+ masquerades as macOS, so trust touch points there too.
  return (
    /iP(hone|ad|od)/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/** Lazily build the hidden label→switch pair the first time we need it, so SSR
 *  and unsupported browsers never touch the DOM. Kept off-screen and inert. */
function ticker(): HTMLLabelElement {
  if (pair) return pair;
  const label = document.createElement("label");
  const input = document.createElement("input");
  input.type = "checkbox";
  input.setAttribute("switch", "");
  input.tabIndex = -1;
  input.setAttribute("aria-hidden", "true");
  label.setAttribute("aria-hidden", "true");
  label.append(input);
  Object.assign(label.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "1px",
    height: "1px",
    opacity: "0",
    pointerEvents: "none",
    zIndex: "-1",
  });
  document.body.append(label);
  pair = label;
  return pair;
}

/** Turn a Web-Vibration pattern into the offsets (ms from now) at which to fire
 *  a tick. A bare number is a single buzz; an array is `[on, off, on, …]` where
 *  even slots vibrate and odd slots pause. Each "on" duration becomes 1–4 ticks
 *  (its stand-in for intensity), each "off" duration becomes real dead time. */
function offsets(pattern: number | number[]): number[] {
  const slots = Array.isArray(pattern) ? pattern : [pattern];
  const out: number[] = [];
  let clock = 0;
  slots.forEach((ms, i) => {
    if (i % 2 === 1) {
      clock += ms; // a pause between buzzes
      return;
    }
    const ticks = Math.min(4, Math.max(1, Math.round(ms / 15)));
    for (let t = 0; t < ticks; t++) {
      out.push(clock);
      clock += PULSE_GAP;
    }
  });
  return out;
}

/** Play `pattern` on the Taptic Engine via the switch trick. Returns false when
 *  the platform can't do it, so haptics.ts knows the buzz went nowhere. */
export function iosVibrate(pattern: number | number[]): boolean {
  if (!supported()) return false;
  const label = ticker();
  for (const at of offsets(pattern)) {
    if (at === 0) label.click();
    else setTimeout(() => label.click(), at);
  }
  return true;
}
