// robots.txt, served as a route rather than a file in public/ because its
// `Sitemap:` directive needs an absolute URL, and only the server knows the
// origin (BETTER_AUTH_URL). The brackets escape the dot, which file-based
// routing would otherwise read as a path separator (/robots/txt).
//
// The document itself is built in server/seo.ts, pure and tested there.

import { createFileRoute } from "@tanstack/react-router";
import { robotsTxt } from "../server/seo.ts";

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: () =>
        new Response(robotsTxt(process.env.BETTER_AUTH_URL), {
          headers: { "content-type": "text/plain; charset=utf-8" },
        }),
    },
  },
});
