import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { paraglideVitePlugin } from "@inlang/paraglide-js";
import { serviceWorker } from "./scripts/sw-plugin.ts";

const config = defineConfig({
  resolve: { tsconfigPaths: true, dedupe: ["react", "react-dom"] },
  // The OG-image renderer (satori + native resvg) is server-only, loaded via a
  // dynamic import in the /api/og handler. Keep it out of client pre-bundling:
  // resvg ships a native .node binary the optimizer can't load, and satori's
  // deps use the Node `Buffer` global that doesn't exist in the browser.
  optimizeDeps: { exclude: ["@resvg/resvg-js", "satori"] },
  ssr: { external: ["@resvg/resvg-js"] },
  plugins: [
    paraglideVitePlugin({
      project: "./project.inlang",
      outdir: "./src/paraglide",
      // Cookie-first so the server and the client resolve the same locale: the
      // public profile is server-rendered, and a cookie is the only override the
      // server can read (localStorage isn't sent with the request). On a first
      // visit with no cookie, preferredLanguage negotiates from Accept-Language
      // on the server and from navigator.languages on the client — the same
      // browser preference — so the SSR HTML matches hydration. setLocale
      // (LangToggle) writes the cookie, keeping the choice server-visible.
      //
      // The cookie's own attributes aren't configurable here: paraglide's
      // generated runtime writes PARAGLIDE_LOCALE with a ~400-day max-age and
      // SameSite=Lax (the browser default, since the string sets no SameSite),
      // no Secure/HttpOnly — it must be JS-readable for client-side locale
      // resolution. Fine for a language preference; noted so nobody hunts for a
      // knob that doesn't exist.
      strategy: ["cookie", "preferredLanguage", "baseLocale"],
    }),
    tailwindcss(),
    tanstackStart(),
    // Nitro server target: self-serves the client bundle, reads PORT, and emits
    // a single .output/server/index.mjs — the documented Railway/Node/Bun path.
    nitro({ preset: "bun" }),
    serviceWorker(),
    viteReact(),
    // React Compiler via rolldown-vite's babel bridge (plugin-react v6 has no
    // babel option; this is the pattern the original Vite app used).
    babel({ presets: [reactCompilerPreset()] }),
  ],
});

export default config;
