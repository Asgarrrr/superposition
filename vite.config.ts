import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { paraglideVitePlugin } from "@inlang/paraglide-js";

const config = defineConfig({
  resolve: { tsconfigPaths: true, dedupe: ["react", "react-dom"] },
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
    viteReact(),
    // React Compiler via rolldown-vite's babel bridge (plugin-react v6 has no
    // babel option; this is the pattern the original Vite app used).
    babel({ presets: [reactCompilerPreset()] }),
  ],
});

export default config;
