// Deployment healthcheck (`healthcheckPath` in .railway/railway.ts). Answers
// 200 only if this instance can reach Postgres; 503 otherwise. The old target,
// `/`, served the SPA shell and answered 200 to an instance with no database.
//
// The body stays opaque on failure: this route is public, and a driver error
// message carries the host and user of the connection. The reason goes to the
// logs instead.

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        // import.meta.env.SSR is statically false in the client build, so this
        // branch — and the `pg` pool it imports — is dead-code-eliminated from
        // the client bundle. Same shape as /api/replay/$.
        if (!import.meta.env.SSR) return new Response(null, { status: 404 });

        const [{ probe }, { pool }] = await Promise.all([
          import("../../server/health.ts"),
          import("../../db/index.ts"),
        ]);
        const health = await probe(pool);
        if (!health.ok)
          console.error("[health] database unreachable:", health.error);

        return Response.json(
          { status: health.ok ? "ok" : "degraded" },
          {
            status: health.ok ? 200 : 503,
            headers: { "cache-control": "no-store" },
          },
        );
      },
    },
  },
});
