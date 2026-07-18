import {
  createCsrfMiddleware,
  createMiddleware,
  createStart,
} from "@tanstack/react-start";

// Reject cross-site calls to our state-changing server functions (the score
// submits). Scoped to serverFn mutations: better-auth's own route handler under
// /api/auth (handlerType "router") keeps its cross-origin OAuth flows, and the
// read RPCs (GET getDailyPuzzle/getDailyBoard/getLevelBoard) stay ungated — a
// same-origin GET sends no Origin header, so CSRF-gating a side-effect-free read
// only risks 403ing legitimate clients that also omit Sec-Fetch-Site/Referer.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) =>
    ctx.handlerType === "serverFn" && ctx.request.method !== "GET",
});

// Resolve the request's locale before anything renders, so the server-rendered
// public profile (ssr: true) follows the visitor's cookie/Accept-Language rather
// than the French fallback. paraglideMiddleware runs the rest of the request
// inside an AsyncLocalStorage carrying the negotiated locale, which is what
// `getLocale()` reads during SSR; without it the server always resolves to
// baseLocale. Runs for every document request (handlerType "router"). Imported
// lazily and only in `.server` so the Node-only middleware never reaches the
// browser bundle. The locale strategy (vite.config.ts) is cookie-first, then
// preferredLanguage, so the value the client resolves on hydration matches.
const localeMiddleware = createMiddleware({ type: "request" }).server(
  async ({ request, next }) => {
    const { paraglideMiddleware } = await import("./paraglide/server.js");
    return paraglideMiddleware(request, async () => {
      const result = await next();
      // The SSR'd document varies by the resolved locale — the PARAGLIDE_LOCALE
      // cookie, or Accept-Language on a first visit before the cookie is set — so
      // tell shared caches not to serve one visitor's language to another. Set
      // here (handlerType "router") because this is the one middleware on the
      // document response that already knows the locale is request-derived.
      result.response.headers.append("Vary", "Cookie, Accept-Language");
      return result;
    });
  },
);

// The game's components are client-only (AudioContext, localStorage,
// keyboard/swipe), so `data-only` stays the app-wide default: loaders and head
// run on the server, those components render only on the client. The public
// profile is the exception — it renders fully server-side (ssr: true on
// `/profile/$username` + the root) so crawlers and visitors get the real page
// in the initial HTML. A child can't be more SSR-permissive than its parents,
// which is why the root opts into `ssr: true`; every other route keeps
// inheriting `data-only` (undefined ssr reads defaultSsr, not the parent), and
// the live game boards opt back out with `ssr: false` (e.g. daily.$tier).
export const startInstance = createStart(() => ({
  defaultSsr: "data-only",
  requestMiddleware: [localeMiddleware, csrfMiddleware],
}));
