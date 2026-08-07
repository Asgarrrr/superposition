// The two crawler documents, as pure text builders so they can be tested
// without a server (their routes are thin: read the env, pick a status, set a
// Content-Type).
//
// Both hinge on an ORIGIN the repo cannot know: a sitemap's <loc> must be
// absolute by protocol, and robots' `Sitemap:` directive too — which is why
// these are routes reading BETTER_AUTH_URL and not files in public/. The origin
// is normalised here, the same way __root.tsx and profile.$username.tsx
// normalise it for og:image: a hand-written `https://host/` would otherwise
// yield `https://host//levels`, a protocol-relative URL pointing at the host
// `levels`.
//
// The sitemap lists STATIC routes only. Profiles are user data: publishable one
// by one from a leaderboard row, but enumerating every account in a file served
// to everyone is a different act, and not one a sitemap should perform.

import { LEVELS } from "../engine/levels.ts";

/** Trailing slashes stripped; an unset or blank origin answers null so each
 *  caller decides what a document with no absolute URL should be. */
function normalise(raw: string | undefined): string | null {
  const origin = (raw ?? "").replace(/\/+$/, "");
  return origin === "" ? null : origin;
}

/** Every crawlable path, derived from the bank so adding a plate to LEVELS
 *  extends the sitemap on its own.
 *
 *  `/align` is deliberately absent: it is a throwaway prototype route, not
 *  wired into the app's screen flow, and a sitemap is a claim that a page is
 *  worth landing on. */
function paths(): string[] {
  return ["/", "/levels", ...LEVELS.map((_, i) => `/level/${i + 1}`)];
}

/** The sitemap, or null when no origin is configured (local dev): a sitemap of
 *  relative <loc>s is invalid, and an invalid one is worse than none — the
 *  route answers 404 rather than teaching a crawler a broken URL. */
export function sitemapXml(rawOrigin: string | undefined): string | null {
  const origin = normalise(rawOrigin);
  if (origin === null) return null;
  const urls = paths()
    .map((p) => `  <url><loc>${origin}${p}</loc></url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

/** robots.txt. Unlike the sitemap it stays useful without an origin — the
 *  Disallow rules are relative by design — so a missing origin only drops the
 *  `Sitemap:` line instead of failing the document.
 *
 *  /api/ is closed: auth endpoints, replay GIFs and OG cards are machinery, not
 *  pages. Nothing else is hidden here — robots.txt is public, so listing a path
 *  to keep it private would advertise it instead. */
export function robotsTxt(rawOrigin: string | undefined): string {
  const origin = normalise(rawOrigin);
  const sitemap = origin === null ? "" : `\nSitemap: ${origin}/sitemap.xml\n`;
  return `User-agent: *
Disallow: /api/
${sitemap}`;
}
