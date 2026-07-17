// Dynamic Open Graph card for a public profile (/api/og/<username> → PNG). The
// profile route points og:image here; social crawlers fetch it server-side. All
// the rendering (DB, satori, native resvg, embedded fonts) lives in a server-only
// module loaded via dynamic import inside the handler, so none of it is pulled
// into the client bundle by this route's presence in the route tree.

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/og/$username")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        // import.meta.env.SSR is statically false in the client build, so this
        // whole branch — and the server-only card module (satori, native resvg,
        // embedded fonts) it pulls in — is dead-code-eliminated from the client
        // bundle, which would otherwise crash on the Node `Buffer` global.
        if (!import.meta.env.SSR) return new Response(null, { status: 404 });
        const { ogResponse } = await import("../../../server/og/card.tsx");
        return ogResponse(params.username);
      },
    },
  },
});
