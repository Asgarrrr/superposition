import { useEffect } from "react";
import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router";

import appCss from "../index.css?url";
import {
  cookieName,
  getLocale,
  isLocale,
  localStorageKey,
  setLocale,
} from "../paraglide/runtime.js";
import { RegisterSW } from "../ui/RegisterSW.tsx";

export const Route = createRootRoute({
  // The root opts into full SSR so the one route that wants it — the public
  // profile — can render server-side (a child can't be more SSR-permissive than
  // its parents). The app-wide default stays `data-only` (src/start.ts), so
  // every other route still renders its component client-only; this only lifts
  // the parent ceiling. The root has no component of its own beyond the shell,
  // which already renders server-side regardless.
  ssr: true,
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1.0, viewport-fit=cover",
      },
      { name: "theme-color", content: "#14110E" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black" },
      { name: "apple-mobile-web-app-title", content: "Superposition" },
      { title: "Superposition" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  // One-time migration off the old localStorage strategy. Before the switch to
  // the cookie strategy the chosen locale lived in localStorage; those visitors
  // still carry it there with no cookie, and the server (which can't read
  // localStorage) now renders them in the fallback locale. On first hydration,
  // promote the saved value to the cookie via setLocale — which also reloads so
  // the SSR'd page comes back in the right language — then drop the stale key.
  // Removing before setLocale so the key is gone even across the reload.
  useEffect(() => {
    const saved = localStorage.getItem(localStorageKey);
    const hasCookie = document.cookie.includes(`${cookieName}=`);
    if (saved && !hasCookie) {
      localStorage.removeItem(localStorageKey);
      if (isLocale(saved)) setLocale(saved);
    }
  }, []);

  return (
    // literal mirrors --color-room: paints the root dark on the very first
    // frame, before the stylesheet (and its token) has loaded. lang follows the
    // request's resolved locale (set server-side by the paraglide middleware),
    // so the server-rendered profile announces the right language to crawlers
    // and assistive tech; the cookie/preferredLanguage strategy makes the client
    // resolve the same value on hydration.
    <html lang={getLocale()} style={{ backgroundColor: "#14110e" }}>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <RegisterSW />
        <Scripts />
      </body>
    </html>
  );
}
