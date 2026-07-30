// Hold-to-confirm. The state lives here, not in the control, so the button and
// the keyboard shortcut share one sweep instead of racing two.

import { useCallback, useEffect, useRef, useState } from "react";

export interface Hold {
  holding: boolean;
  ms: number;
  start: () => void;
  cancel: () => void;
  /** fire without the wait, for activations that CANNOT hold */
  confirmNow: () => void;
}

export function useHold(onConfirm: () => void, ms = 700): Hold {
  const [holding, setHolding] = useState(false);
  const timer = useRef(0);
  const fire = useRef(onConfirm);
  fire.current = onConfirm;

  const cancel = useCallback(() => {
    if (!timer.current) return;
    clearTimeout(timer.current);
    timer.current = 0;
    setHolding(false);
  }, []);

  const start = useCallback(() => {
    if (timer.current) return;
    setHolding(true);
    timer.current = window.setTimeout(() => {
      timer.current = 0;
      setHolding(false);
      fire.current();
    }, ms);
  }, [ms]);

  const confirmNow = useCallback(() => {
    cancel();
    fire.current();
  }, [cancel]);

  useEffect(() => () => clearTimeout(timer.current), []);

  return { holding, ms, start, cancel, confirmNow };
}
