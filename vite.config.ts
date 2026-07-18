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
      strategy: ["localStorage", "preferredLanguage", "baseLocale"],
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
