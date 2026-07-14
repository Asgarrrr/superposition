// Mute setting, persisted in localStorage so it survives navigation between
// levels (each level is now its own route, so a plain useState would reset it).

import { useEffect, useState } from "react";

const STORAGE_KEY = "superposition.muted";

export function useMuted(): [boolean, () => void] {
  const [muted, setMuted] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, muted ? "1" : "0");
    } catch {
      // storage unavailable — setting just won't persist
    }
  }, [muted]);

  return [muted, () => setMuted((m) => !m)];
}
