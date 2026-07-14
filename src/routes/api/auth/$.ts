// Better Auth mount point. The splat catches every /api/auth/* path
// (sign-up, sign-in, session, sign-out, …) and hands the raw Request to
// better-auth, which returns the Response (including Set-Cookie).

import { createFileRoute } from "@tanstack/react-router";
import { auth } from "../../../lib/auth.ts";

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => auth.handler(request),
      POST: ({ request }) => auth.handler(request),
    },
  },
});
