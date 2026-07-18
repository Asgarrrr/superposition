// FR / EN switch. setLocale persists the choice (cookie strategy, so the server
// sees it on the next request and the SSR'd profile matches) and reloads the
// page so every message re-renders in the new locale.

import { getLocale, setLocale, locales } from "../../paraglide/runtime.js";

export function LangToggle({ className = "" }: { className?: string }) {
  const current = getLocale();
  return (
    <div
      className={`flex items-center gap-1.5 text-[11px] uppercase ${className}`}
    >
      {locales.map((loc) => (
        <button
          key={loc}
          type="button"
          className={`btn border-none p-0 ${loc === current ? "text-paper/50" : "text-paper/28"}`}
          onClick={() => {
            if (loc !== current) setLocale(loc);
          }}
        >
          {loc}
        </button>
      ))}
    </div>
  );
}
