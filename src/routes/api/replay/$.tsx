// Animated-GIF replay of a solve (/api/replay/…). The splat carries the level
// identity and the compact, engine-validated move line; the win overlays point
// share actions here. Two shapes, parsed server-side:
//   /api/replay/c/<plate>/<trace>.gif        campaign
//   /api/replay/d/<date>/<tier>/<trace>.gif  daily (only once its day is past)
//
// All the rendering (resvg, the DB for daily, the hand-rolled GIF encoder) lives
// in a server-only module loaded via dynamic import inside the handler, so none
// of it is pulled into the client bundle by this route's presence in the tree.

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/replay/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        // import.meta.env.SSR is statically false in the client build, so this
        // branch — and the server-only render module (resvg, DB, GIF encoder)
        // it pulls in — is dead-code-eliminated from the client bundle.
        if (!import.meta.env.SSR) return new Response(null, { status: 404 });
        const { replayResponse } =
          await import("../../../server/replay/render.ts");
        return replayResponse(params._splat ?? "");
      },
    },
  },
});
