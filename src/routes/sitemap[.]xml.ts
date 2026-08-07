// sitemap.xml, a route for the same reason as robots.txt: every <loc> must be
// absolute, and the origin lives in BETTER_AUTH_URL. The brackets escape the
// dot for file-based routing.
//
// The document itself is built in server/seo.ts, pure and tested there; with no
// origin configured it declines to exist rather than emit relative URLs.

import { createFileRoute } from "@tanstack/react-router";
import { sitemapXml } from "../server/seo.ts";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: () => {
        const body = sitemapXml(process.env.BETTER_AUTH_URL);
        if (body === null) return new Response(null, { status: 404 });
        return new Response(body, {
          headers: { "content-type": "application/xml; charset=utf-8" },
        });
      },
    },
  },
});
